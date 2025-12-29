'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameStoreWithUndo } from '@/store/gameStore';
import { loadGame, saveGame, SavedGame } from './actions';
import { DetectiveGrid } from '@/components/detective-grid';
import { InferenceLog } from '@/components/inference-log';
import GameSetup from '@/components/GameSetup';
import TurnInputModal from '@/components/TurnInputModal';
import { ConstraintBadge, ConstraintHighlight } from '@/components/constraint-visualization';
import CellModal from '@/components/CellModal';
import { SUSPECTS, WEAPONS, ROOMS, ALL_CARDS, CardId } from '@/lib/constants';
import { Card, CellState, LogEntry, GridState, Constraint } from '@/types/game';
import { Plus, RotateCcw, LogOut, Loader2, ExternalLink } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlGameId = searchParams.get('gameId');
  const [isLoading, setIsLoading] = useState(false);

  const {
    isGameActive,
    gameId,
    meta,
    gameMode,
    groundTruth,
    devSolution,
    players,
    grid,
    logs,
    constraints,
    undoLastTurn,
    manualOverride,
    addManualConstraint,
    loadSavedGame,
    resetGame
  } = useGameStoreWithUndo();

  const [isTurnModalOpen, setIsTurnModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ playerId: string, cardId: string } | null>(null);
  const [hoveredConstraint, setHoveredConstraint] = useState<string | null>(null);

  // --- PERSISTENCE SYNC ---

  // 1. Initial Load from URL
  useEffect(() => {
    if (!isGameActive && urlGameId && !isLoading) {
      setIsLoading(true);
      loadGame(urlGameId).then(g => {
        if (g) loadSavedGame(g);
        setIsLoading(false);
      }).catch((e) => {
        console.error("Failed to load game from URL", e);
        setIsLoading(false);
      });
    }
  }, [urlGameId, isGameActive, loadSavedGame]);

  // 2. Sync URL when active
  useEffect(() => {
    if (isGameActive && gameId) {
      const params = new URLSearchParams(searchParams.toString());
      if (params.get('gameId') !== gameId) {
        params.set('gameId', gameId);
        router.replace(`?${params.toString()}`);
      }
    }
  }, [isGameActive, gameId, router, searchParams]);

  // 3. Auto-Save Logic
  useEffect(() => {
    if (!isGameActive || !gameId || !meta) return;

    const timeoutId = setTimeout(() => {
      const hero = players.find(p => p.isHero);
      const gameToSave: SavedGame = {
        id: gameId,
        name: meta.name,
        createdAt: meta.createdAt,
        lastUpdated: Date.now(),
        mode: gameMode,
        players: players.map(p => ({
          id: p.id,
          name: p.name,
          isHero: p.isHero,
          cardCount: p.cardCount,
          characterId: p.characterId
        })),
        heroName: hero ? hero.name : '',
        logs: logs,
        groundTruth: groundTruth || undefined,
        solution: devSolution || undefined
      };

      saveGame(gameToSave).catch(e => console.error("Auto-save failed", e));
    }, 2000); // 2 seconds debounce

    return () => clearTimeout(timeoutId);
  }, [logs, isGameActive, gameId, meta, gameMode, players, groundTruth, devSolution]);

  // --- ADAPTERS ---
  // Adapt lib/constants cards to UI Card type
  const uiCards: Card[] = useMemo(() => [
    ...SUSPECTS.map(s => ({ ...s, name: s.label, category: 'suspect' as const })),
    ...WEAPONS.map(w => ({ ...w, name: w.label, category: 'weapon' as const })),
    ...ROOMS.map(r => ({ ...r, name: r.label, category: 'room' as const })),
  ], []);

  // Adapt store Grid to UI GridState
  const uiGridState: GridState = useMemo(() => {
    const newGrid: GridState = {};
    Object.entries(grid).forEach(([playerId, cardStates]) => {
      Object.entries(cardStates).forEach(([cardId, state]) => {
        if (!newGrid[cardId]) newGrid[cardId] = {};
        let uiState: CellState = 'empty';
        if (state === 'YES') uiState = 'yes';
        if (state === 'NO') uiState = 'no';
        newGrid[cardId][playerId] = uiState;
      });
    });
    return newGrid;
  }, [grid]);

  // Adapt store Logs to UI LogEntry
  const uiLogs: LogEntry[] = useMemo(() => {
    return logs.map(log => {
      let text = '';
      let type: LogEntry['type'] = 'info';

      switch (log.type) {
        case 'SUGGESTION': {
          const asker = players.find(p => p.id === log.askerId)?.name || log.askerId;
          const responder = log.responderId ? (players.find(p => p.id === log.responderId)?.name || log.responderId) : 'Nessuno';

          if (log.suggestion) {
            const sName = SUSPECTS.find(s => s.id === log.suggestion![0])?.label;
            const wName = WEAPONS.find(w => w.id === log.suggestion![1])?.label;
            const rName = ROOMS.find(r => r.id === log.suggestion![2])?.label;
            text = `${asker} chiede: ${sName} con ${wName} in ${rName}.`;

            if (log.responderId) {
              text += `\n→ ${responder} ha risposto.`;
              if (log.provenCardId) {
                const cardName = ALL_CARDS.find(c => c.id === log.provenCardId)?.label;
                text += ` (Ha mostrato: ${cardName})`;
                type = 'success';
              }
            } else {
              text += `\n→ Nessuno ha risposto.`;
            }
          } else {
            text = `${asker} passa il turno (nessuna ipotesi).`;
          }
          break;
        }
        case 'ACCUSATION_FAILURE': {
          const accuser = players.find(p => p.id === log.accuserId)?.name || log.accuserId;
          const sName = SUSPECTS.find(s => s.id === log.suggestion[0])?.label;
          const wName = WEAPONS.find(w => w.id === log.suggestion[1])?.label;
          const rName = ROOMS.find(r => r.id === log.suggestion[2])?.label;
          text = `ACCUSA FALLITA: ${accuser} sbaglia ipotizzando ${sName}, ${wName}, ${rName}.`;
          type = 'error';
          break;
        }
        case 'MANUAL_CONSTRAINT': {
          const player = players.find(p => p.id === log.playerId)?.name || log.playerId;
          const cardNames = log.cards.map(id => ALL_CARDS.find(c => c.id === id)?.label).join(', ');

          if (log.hasOneOf) {
            if (log.cards.length === 1) {
              text = `Nota Manuale: ${player} HA sicuramente ${cardNames}.`;
              type = 'success';
            } else {
              text = `Nota Manuale: ${player} ha UNA tra: ${cardNames}.`;
            }
          } else {
            text = `Nota Manuale: ${player} NON HA nessuna di: ${cardNames}.`;
          }
          break;
        }
      }

      return {
        id: log.id,
        turnNumber: log.turnNumber,
        text,
        type,
        timestamp: new Date(log.timestamp).getTime()
      };
    }).reverse();
  }, [logs, players]);

  // Adapt store Constraints to UI Constraint type
  const uiConstraints: Constraint[] = useMemo(() => {
    return constraints.filter(c => !c.resolved).map(c => {
      // Find turn number from logs if possible
      const log = logs.find(l => l.id === c.sourceTurnId);
      return {
        id: c.id,
        turnNumber: log ? log.turnNumber : 0,
        playerId: c.playerId,
        involvedCards: c.cards,
        description: 'Vincolo Attivo' // Basic description
      };
    });
  }, [constraints, logs]);


  // Handle Cell Click (Open Modal)
  const handleCellClick = (cardId: string, playerId: string, _isRightClick?: boolean) => {
    setSelectedCell({ playerId, cardId });
  };

  const handleModalConfirm = (action: 'YES' | 'NO' | 'CONSTRAINT', relatedCards?: string[]) => {
    if (!selectedCell) return;
    const { playerId, cardId } = selectedCell;

    if (action === 'YES') {
      // Manual Certainty YES
      manualOverride(playerId, cardId as any, 'YES');
    } else if (action === 'NO') {
      // Manual Certainty NO
      manualOverride(playerId, cardId as any, 'NO');
    } else if (action === 'CONSTRAINT' && relatedCards) {
      // "Has One Of [A, B, ...]"
      addManualConstraint(playerId, relatedCards as any[], true);
    }
    setSelectedCell(null);
  };

  const handleExit = () => {
    if (confirm("Torna al menu principale?")) {
      window.location.href = '/';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-noir-900 flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (!isGameActive) {
    return <GameSetup />;
  }

  return (
    <main className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-noir-900 text-slate-200">
      <div className="flex-1 overflow-auto p-4 md:p-8 flex flex-col items-center relative">
        <header className="mb-8 text-center flex items-center justify-center gap-4 relative w-full max-w-4xl">
          <button
            onClick={undoLastTurn}
            className="absolute left-0 p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Undo Last Turn"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={handleExit}
            className="absolute left-10 p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Exit Game"
          >
            <LogOut className="w-5 h-5" />
          </button>

          <button
            onClick={() => window.open(`/visual?gameId=${gameId}`, '_blank')}
            className="absolute right-0 p-2 text-zinc-500 hover:text-amber-500 transition-colors"
            title="Open Visual View"
          >
            <ExternalLink className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-3xl font-bold uppercase tracking-[0.2em] text-slate-100 mb-2">
              Cluedo <span className="text-gold-500">Assistant</span>
            </h1>
            <p className="text-sm font-mono text-slate-500">Case Active // Detective Mode</p>
          </div>
        </header>

        <div className="relative w-full max-w-5xl pb-24">
          <DetectiveGrid
            players={players}
            cards={uiCards}
            gridState={uiGridState}
            onCellClick={handleCellClick}
            renderCellExtras={(cardId, playerId) => {
              const currentState = grid[playerId]?.[cardId as CardId];
              // Don't show constraint badge if we already know it's NO (distraction)
              if (currentState === 'NO') return null;

              return (
                <>
                  <ConstraintBadge
                    constraints={uiConstraints}
                    hoveredConstraint={hoveredConstraint}
                    onHoverConstraint={setHoveredConstraint}
                    cardId={cardId}
                    playerId={playerId}
                  />
                  <ConstraintHighlight
                    constraints={uiConstraints}
                    hoveredConstraint={hoveredConstraint}
                    cardId={cardId}
                    playerId={playerId}
                  />
                </>
              );
            }}
          />
        </div>

        <button
          onClick={() => setIsTurnModalOpen(true)}
          className="fixed bottom-6 right-6 md:absolute md:bottom-8 md:right-8 bg-amber-600 hover:bg-amber-500 text-white rounded-full p-4 shadow-2xl shadow-amber-900/50 transition-all hover:scale-105 active:scale-95 z-40"
        >
          <Plus className="w-8 h-8" />
        </button>
      </div>

      <InferenceLog logs={uiLogs} />

      <TurnInputModal
        isOpen={isTurnModalOpen}
        onClose={() => setIsTurnModalOpen(false)}
      />

      <CellModal
        isOpen={!!selectedCell}
        onClose={() => setSelectedCell(null)}
        player={selectedCell ? players.find(p => p.id === selectedCell.playerId) || null : null}
        cardId={selectedCell?.cardId as any}
        onConfirm={handleModalConfirm}
      />
    </main>
  );
}
