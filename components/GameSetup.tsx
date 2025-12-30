'use client';

import React, { useState } from 'react';
import { useGameStoreWithUndo } from '@/store/gameStore';
import { createNewGame, getGames, deleteGame, SavedGame, testRedisConnection } from '@/app/actions';
import { SUSPECTS, WEAPONS, ROOMS, ALL_CARDS, CardId } from '@/lib/constants';
import { ArrowRight, Check, User, Users, GripVertical, Play, Trash2, FolderOpen, Flame, FlaskConical, Gamepad2 } from 'lucide-react';

const STEPS = ['Players', 'Hero', 'Order', 'Cards'];

export default function GameSetup() {
    const loadSavedGame = useGameStoreWithUndo(state => state.loadSavedGame);
    const addManualConstraint = useGameStoreWithUndo(state => state.addManualConstraint);

    // View State
    const [view, setView] = useState<'NEW' | 'LOAD'>('NEW');
    const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Wizard State
    const [step, setStep] = useState(0);
    const [gameMode, setGameMode] = useState<'REAL' | 'DEV'>('REAL');
    const [playerNames, setPlayerNames] = useState<string[]>(['', '', '']);
    const [heroIndex, setHeroIndex] = useState<number | null>(null);
    const [orderedNames, setOrderedNames] = useState<string[]>([]);
    const [selectedCards, setSelectedCards] = useState<Set<CardId>>(new Set());

    // Validations
    const isValidPlayers = playerNames.every(n => n.trim().length > 0) && playerNames.length >= 2 && playerNames.length <= 6;

    // Load Games
    React.useEffect(() => {
        if (view === 'LOAD') {
            setIsLoading(true);
            getGames().then(g => {
                setSavedGames(g.sort((a, b) => b.lastUpdated - a.lastUpdated));
                setIsLoading(false);
            });
        }
    }, [view]);

    const handleNext = () => {
        if (step === 0) {
            const validNames = playerNames.filter(n => n.trim() !== '');
            setPlayerNames(validNames);
            setOrderedNames(validNames);
        }
        setStep(s => s + 1);
    };

    const handleStartGame = async () => {
        if (heroIndex === null) return;
        const heroName = orderedNames[heroIndex];
        setIsLoading(true);

        try {
            // 1. Create on Server
            const name = `Partita ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            const newGame = await createNewGame(name, gameMode, orderedNames, heroName, Array.from(selectedCards));

            // 2. Load into Store
            loadSavedGame(newGame);

            // 3. Apply Initial Knowledge (Manual Constraints)
            const correctHeroIndex = orderedNames.indexOf(heroName);
            const computedHeroId = `p${correctHeroIndex}`; // CluedoEngine naming convention p0..pN

            if (selectedCards.size > 0) {
                Array.from(selectedCards).forEach(cId => {
                    addManualConstraint(computedHeroId, [cId], true);
                });
            }

        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteGame = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Eliminare questa partita?')) return;
        await deleteGame(id);
        setSavedGames(prev => prev.filter(g => g.id !== id));
    };

    return (
        <div className="max-w-md mx-auto p-4 bg-zinc-900 min-h-screen text-zinc-100 flex flex-col">

            {/* Top Navigation */}
            <div className="flex gap-2 p-1 bg-zinc-800/50 rounded-xl mb-6">
                <button
                    onClick={() => setView('NEW')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${view === 'NEW' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                >
                    <Flame className="w-4 h-4" /> Nuova
                </button>
                <button
                    onClick={() => setView('LOAD')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${view === 'LOAD' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                >
                    <FolderOpen className="w-4 h-4" /> Carica
                </button>
            </div>

            {view === 'LOAD' && (
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="text-center text-zinc-500 mt-10">Caricamento...</div>
                    ) : savedGames.length === 0 ? (
                        <div className="text-center text-zinc-500 mt-10">Nessuna partita salvata.</div>
                    ) : (
                        <div className="space-y-3">
                            {savedGames.map(game => (
                                <div
                                    key={game.id}
                                    onClick={() => loadSavedGame(game)}
                                    className="p-4 bg-zinc-800 rounded-xl border border-zinc-700 hover:bg-zinc-750 active:scale-95 transition-all cursor-pointer group relative overflow-hidden"
                                >
                                    <div className="flex items-center gap-3 mb-2 pr-10">
                                        <h3 className="font-bold text-lg text-zinc-100 truncate">{game.name}</h3>
                                        {game.mode === 'DEV' && (
                                            <span className="shrink-0 text-[10px] font-bold bg-amber-900/50 text-amber-500 px-2 py-1 rounded border border-amber-900">DEV</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-zinc-400 flex flex-col gap-1">
                                        <span>Giocatori: {game.players.map(p => p.name).join(', ')}</span>
                                        <span>Ultima modifica: {new Date(game.lastUpdated).toLocaleString()}</span>
                                    </div>

                                    <button
                                        onClick={(e) => handleDeleteGame(game.id, e)}
                                        className="absolute top-4 right-4 p-2 text-zinc-600 hover:text-red-400 transition-colors"
                                        title="Elimina Partita"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {view === 'NEW' && (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold font-serif tracking-in-expand">Nuova Indagine</h1>
                        <div className="text-sm text-zinc-500">Step {step + 1}/{STEPS.length}</div>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex gap-1 mb-8">
                        {STEPS.map((s, i) => (
                            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-amber-600' : 'bg-zinc-800'}`} />
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {step === 0 && (
                            <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300">

                                {/* Mode Toggle */}
                                <div className="bg-zinc-800/30 p-1 rounded-lg flex gap-1 mb-4">
                                    <button
                                        onClick={() => setGameMode('REAL')}
                                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold flex flex-col items-center gap-1 transition-all border-2 ${gameMode === 'REAL'
                                            ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                                            : 'border-transparent text-zinc-500 hover:bg-zinc-800/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2"><Gamepad2 className="w-4 h-4" /> Classica</div>
                                        <span className="text-[10px] font-normal opacity-70">Partita Reale</span>
                                    </button>
                                    <button
                                        onClick={() => setGameMode('DEV')}
                                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold flex flex-col items-center gap-1 transition-all border-2 ${gameMode === 'DEV'
                                            ? 'bg-amber-900/20 border-amber-600/50 text-amber-500'
                                            : 'border-transparent text-zinc-500 hover:bg-zinc-800/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2"><FlaskConical className="w-4 h-4" /> Sviluppo</div>
                                        <span className="text-[10px] font-normal opacity-70">Carte Scoperte</span>
                                    </button>
                                </div>

                                <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-amber-500" />
                                    Chi sta giocando?
                                </h2>
                                <p className="text-sm text-zinc-400 mb-4">Inserisci i nomi dei giocatori (2-6).</p>
                                {playerNames.map((name, idx) => (
                                    <input
                                        key={idx}
                                        type="text"
                                        placeholder={`Giocatore ${idx + 1}`}
                                        value={name}
                                        onChange={e => {
                                            const newNames = [...playerNames];
                                            newNames[idx] = e.target.value;
                                            setPlayerNames(newNames);
                                        }}
                                        className="w-full bg-zinc-800 border-zinc-700 rounded-lg p-3 focus:ring-2 focus:ring-amber-600 focus:outline-none placeholder:text-zinc-600"
                                    />
                                ))}
                                {playerNames.length < 6 && (
                                    <button
                                        onClick={() => setPlayerNames([...playerNames, ''])}
                                        className="text-sm text-amber-500 hover:text-amber-400 font-medium py-2"
                                    >
                                        + Aggiungi un altro giocatore
                                    </button>
                                )}

                                <button
                                    disabled={!isValidPlayers}
                                    onClick={handleNext}
                                    className="w-full mt-6 bg-zinc-100 text-zinc-900 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors flex items-center justify-center gap-2"
                                >
                                    Avanti <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {step === 1 && (
                            <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300">
                                <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                                    <User className="w-5 h-5 text-amber-500" />
                                    Chi sei tu?
                                </h2>
                                <div className="grid grid-cols-1 gap-2">
                                    {playerNames.map((name, idx) => {
                                        if (!name.trim()) return null;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setHeroIndex(idx);
                                                }}
                                                className={`p-4 rounded-xl text-left transition-all border-2 ${heroIndex === idx
                                                    ? 'bg-amber-900/30 border-amber-600 text-amber-100'
                                                    : 'bg-zinc-800 border-transparent hover:bg-zinc-700'
                                                    }`}
                                            >
                                                {name}
                                                {heroIndex === idx && <span className="float-right text-amber-500 font-bold">HERO</span>}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    disabled={heroIndex === null}
                                    onClick={handleNext}
                                    className="w-full mt-6 bg-zinc-100 text-zinc-900 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-white transition-colors"
                                >
                                    Conferma
                                </button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300">
                                <h2 className="text-xl font-semibold mb-2">Ordine di Turno</h2>
                                <p className="text-sm text-zinc-400">Trascina per ordinare i giocatori. Il primo in alto è chi inizia.</p>

                                <div className="space-y-2">
                                    {orderedNames.map((name, idx) => (
                                        <div key={name} className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg">
                                            <span className="text-zinc-500 font-mono text-sm w-4">{idx + 1}.</span>
                                            <div className="flex-1 font-medium">{name} {heroIndex !== null && playerNames[heroIndex] === name && <span className="text-xs bg-amber-900 text-amber-200 px-1 rounded ml-2">YOU</span>}</div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => {
                                                        if (idx === 0) return;
                                                        const newOrder = [...orderedNames];
                                                        [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
                                                        setOrderedNames(newOrder);
                                                    }}
                                                    disabled={idx === 0}
                                                    className="p-1 hover:bg-zinc-700 rounded disabled:opacity-30"
                                                >
                                                    ▲
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (idx === orderedNames.length - 1) return;
                                                        const newOrder = [...orderedNames];
                                                        [newOrder[idx + 1], newOrder[idx]] = [newOrder[idx], newOrder[idx + 1]];
                                                        setOrderedNames(newOrder);
                                                    }}
                                                    disabled={idx === orderedNames.length - 1}
                                                    className="p-1 hover:bg-zinc-700 rounded disabled:opacity-30"
                                                >
                                                    ▼
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button onClick={handleNext} className="w-full mt-6 bg-zinc-100 text-zinc-900 py-3 rounded-xl font-bold">
                                    Conferma Ordine
                                </button>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300 pb-20">
                                <h2 className="text-xl font-semibold mb-2">Le tue Carte</h2>
                                <p className="text-sm text-zinc-400">Seleziona le carte che hai in mano all&apos;inizio (queste sono le prime certezze &apos;YES&apos;).</p>

                                <div className="space-y-6">
                                    {['suspect', 'weapon', 'room'].map(type => {
                                        let items: readonly { id: string; label: string }[] = [];
                                        let label = '';
                                        if (type === 'suspect') { items = SUSPECTS; label = 'Sospettati'; }
                                        if (type === 'weapon') { items = WEAPONS; label = 'Armi'; }
                                        if (type === 'room') { items = ROOMS; label = 'Stanze'; }

                                        return (
                                            <div key={type}>
                                                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">{label}</h3>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {items.map(card => {
                                                        const isSelected = selectedCards.has(card.id as CardId);
                                                        return (
                                                            <button
                                                                key={card.id}
                                                                onClick={() => {
                                                                    const newSet = new Set(selectedCards);
                                                                    if (isSelected) newSet.delete(card.id as CardId);
                                                                    else newSet.add(card.id as CardId);
                                                                    setSelectedCards(newSet);
                                                                }}
                                                                className={`p-3 text-sm rounded-lg text-left transition-all border ${isSelected
                                                                    ? 'bg-green-900/40 border-green-500 text-green-100'
                                                                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750'
                                                                    }`}
                                                            >
                                                                <div className="flex justify-between items-center">
                                                                    <span>{card.label}</span>
                                                                    {isSelected && <Check className="w-4 h-4 text-green-500" />}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {step === 3 && (
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-900 border-t border-zinc-800">
                            <div className="max-w-md mx-auto">
                                <button
                                    onClick={handleStartGame}
                                    disabled={isLoading}
                                    className="w-full bg-amber-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-amber-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isLoading ? 'Creazione in corso...' : (
                                        <>
                                            <Play className="fill-current w-5 h-5" />
                                            Inizia Indagine
                                        </>
                                    )}
                                </button>
                                <button onClick={async () => alert((await testRedisConnection()).message)} className="block mx-auto mt-2 text-xs text-zinc-600 underline hover:text-zinc-400">
                                    Test Database
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
