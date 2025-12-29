'use client';

import React, { useState, useMemo } from 'react';
import { useGameStoreWithUndo } from '@/store/gameStore';
import { DetectiveGrid } from '@/components/detective-grid';
import { InferenceLog } from '@/components/inference-log';
import GameSetup from '@/components/GameSetup';
import TurnInputModal from '@/components/TurnInputModal';
import { ConstraintBadge, ConstraintHighlight } from '@/components/constraint-visualization'; // Imported
import { SUSPECTS, WEAPONS, ROOMS, ALL_CARDS, CardId } from '@/lib/constants';
import { Card, CellState, LogEntry, GridState, Constraint } from '@/types/game'; // Added Constraint
import { Plus, RotateCcw } from 'lucide-react';

export default function Home() {
  const {
    isGameActive,
    players,
    grid,
    logs,
    constraints, // Added
    undoLastTurn,
    manualOverride
  } = useGameStoreWithUndo();

  const [isTurnModalOpen, setIsTurnModalOpen] = useState(false);
  const [hoveredConstraint, setHoveredConstraint] = useState<string | null>(null); // Added state

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
      const asker = players.find(p => p.id === log.askerId)?.name || log.askerId;
      const responder = log.responderId ? (players.find(p => p.id === log.responderId)?.name || log.responderId) : 'Nessuno';
      let text = '';
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
          }
        } else {
          text += `\n→ Nessuno ha risposto.`;
        }
      } else {
        // No suggestion = Pass turn or just moved
        text = `${asker} non fa ipotesi (o passa il turno).`;
      }

      return {
        id: log.id,
        turnNumber: log.turnNumber,
        text,
        type: 'info' as const,
        timestamp: new Date(log.timestamp).getTime()
      };
    }).reverse();
  }, [logs, players]);

  // Adapt store Constraints to UI Constraint type
  // UI Constraint: { id, turnNumber, playerId, involvedCards, description }
  // Store Constraint: { id, playerId, cards, resolved, sourceTurnId }
  // Mapping needed: involvedCards = cards, turnNumber lookup via sourceTurnId or default
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


  // Handle Cell Click (Manual Override)
  const handleCellClick = (cardId: string, playerId: string, _isRightClick?: boolean) => {
    const current = grid[playerId]?.[cardId as CardId] || 'MAYBE';
    let next = 'MAYBE';
    if (current === 'MAYBE') next = 'YES';
    else if (current === 'YES') next = 'NO';
    else if (current === 'NO') next = 'MAYBE';
    manualOverride(playerId, cardId as CardId, next as any);
  };

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
    </main>
  );
}
