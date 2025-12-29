'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGameStoreWithUndo } from '@/store/gameStore';
import { loadGame } from '@/app/actions';
import { CardAsset } from '@/components/visual/CardAsset';
import { ALL_CARDS, CardId } from '@/lib/constants';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function VisualPage() {
    const searchParams = useSearchParams();
    const gameId = searchParams.get('gameId');

    const loadSavedGame = useGameStoreWithUndo(state => state.loadSavedGame);
    const players = useGameStoreWithUndo(state => state.players);
    const grid = useGameStoreWithUndo(state => state.grid);
    const groundTruth = useGameStoreWithUndo(state => state.groundTruth);
    const gameMode = useGameStoreWithUndo(state => state.gameMode);
    const solution = useGameStoreWithUndo(state => state.solution);
    const devSolution = useGameStoreWithUndo(state => state.devSolution);

    const [showGodMode, setShowGodMode] = useState(false);
    const [isPolling, setIsPolling] = useState(true);

    // Polling Logic
    useEffect(() => {
        if (!gameId) return;

        const fetchData = async () => {
            try {
                const game = await loadGame(gameId);
                if (game) {
                    loadSavedGame(game);
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        };

        fetchData(); // Initial
        const interval = setInterval(fetchData, 2000); // Poll every 2s

        return () => clearInterval(interval);
    }, [gameId, loadSavedGame]);

    if (!gameId) {
        return <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">Nessun Game ID specificato nell'URL.</div>;
    }

    if (players.length === 0) {
        return <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center"><Loader2 className="animate-spin mr-2" /> Caricamento Partita...</div>;
    }

    // Helper to get cards to show for a player
    const getCardsForPlayer = (playerId: string) => {
        if (showGodMode && groundTruth && groundTruth[playerId]) {
            return groundTruth[playerId].map(id => ALL_CARDS.find(c => c.id === id)!);
        }

        // Standard Mode: Show Only YES cards
        const yesCards: CardId[] = [];
        if (grid[playerId]) {
            Object.entries(grid[playerId]).forEach(([cId, state]) => {
                if (state === 'YES') yesCards.push(cId as CardId);
            });
        }
        return yesCards.map(id => ALL_CARDS.find(c => c.id === id)!);
    };

    const toggleMode = () => {
        if (gameMode === 'DEV') setShowGodMode(!showGodMode);
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 overflow-hidden font-sans">
            {/* Header / Toolbar */}
            <div className="fixed top-4 right-4 flex gap-4 z-50">
                {gameMode === 'DEV' && (
                    <button
                        onClick={toggleMode}
                        className={`px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2 transition-all ${showGodMode ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-400'
                            }`}
                    >
                        {showGodMode ? <><Eye className="w-4 h-4" /> GOD MODE: ON</> : <><EyeOff className="w-4 h-4" /> GOD MODE: OFF</>}
                    </button>
                )}
                <div className="px-4 py-2 bg-zinc-900 rounded-full border border-zinc-800 text-xs text-zinc-500 font-mono">
                    ID: {gameId.slice(0, 8)}...
                </div>
            </div>

            {/* Layout Table */}
            <div className="max-w-7xl mx-auto h-full flex flex-col items-center justify-center min-h-[80vh]">

                {/* Dealer / Top Player? Doing a simple grid for now */}

                <h1 className="text-3xl font-serif font-bold text-zinc-700 tracking-[0.2em] uppercase mb-8">
                    Visualizzazione Tavolo
                </h1>

                {/* Solution Section */}
                <div className="flex flex-col items-center mb-16 animate-in slide-in-from-top fade-in duration-700">
                    <div className="flex gap-8">
                        {(['suspect', 'weapon', 'room'] as const).map(cat => {
                            let cardToShow;
                            if (showGodMode && devSolution) {
                                cardToShow = ALL_CARDS.find(c => c.id === devSolution[cat]);
                            } else {
                                const solvedId = ALL_CARDS.find(c => c.category === cat && solution[c.id] === 'YES')?.id;
                                if (solvedId) cardToShow = ALL_CARDS.find(c => c.id === solvedId);
                            }

                            return (
                                <div key={cat} className="flex flex-col items-center gap-4">
                                    <span className="text-zinc-500 font-mono text-xs uppercase tracking-[0.2em]">{cat}</span>
                                    <div className={`transition-all duration-500 ${cardToShow ? 'scale-110' : ''}`}>
                                        <CardAsset
                                            cardId={cardToShow?.id as any}
                                            label={cardToShow?.label || '?'}
                                            type={cat}
                                            faceUp={!!cardToShow}
                                            size="lg"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
                    {players.map(player => {
                        const cards = getCardsForPlayer(player.id);
                        const isHero = player.isHero;

                        return (
                            <div key={player.id} className={`relative p-6 rounded-2xl border-2 transition-all ${isHero ? 'bg-amber-950/20 border-amber-800/50' : 'bg-zinc-900/50 border-zinc-800'
                                }`}>
                                {/* Player Label */}
                                <div className="absolute -top-3 left-6 px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-full text-zinc-300 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                                    {player.name}
                                    {isHero && <span className="text-[10px] bg-amber-900 text-amber-500 px-1 rounded">YOU</span>}
                                    <span className="text-zinc-600 text-[10px] ml-2">({player.cardCount} carte)</span>
                                </div>

                                {/* Cards Grid */}
                                <div className="flex flex-wrap gap-2 mt-2 min-h-[160px] items-center justify-center">
                                    {cards.length === 0 ? (
                                        <div className="text-zinc-700 italic text-sm">Nessuna carta nota</div>
                                    ) : (
                                        cards.map(c => (
                                            <CardAsset
                                                key={c.id}
                                                cardId={c.id}
                                                label={c.label}
                                                type={c.category}
                                                size="sm"
                                            />
                                        ))
                                    )}

                                    {/* Placeholders for unknown cards */}
                                    {Array.from({ length: Math.max(0, player.cardCount - cards.length) }).map((_, i) => (
                                        <CardAsset
                                            key={`unknown_${i}`}
                                            cardId={'mustard' as any} // Dummy
                                            label="?"
                                            type="suspect" // Dummy
                                            size="sm"
                                            faceUp={false}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
