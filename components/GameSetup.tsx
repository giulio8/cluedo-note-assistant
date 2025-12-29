'use client';

import React, { useState } from 'react';
import { useGameStoreWithUndo } from '@/store/gameStore';
import { SUSPECTS, WEAPONS, ROOMS, ALL_CARDS, CardId } from '@/lib/constants';
import { ArrowRight, Check, User, Users, GripVertical, Play } from 'lucide-react';

const STEPS = ['Players', 'Hero', 'Order', 'Cards'];

export default function GameSetup() {
    const initializeGame = useGameStoreWithUndo(state => state.initializeGame);
    const [step, setStep] = useState(0);

    // Form State
    const [playerNames, setPlayerNames] = useState<string[]>(['', '', '']);
    const [heroIndex, setHeroIndex] = useState<number | null>(null); // Index in playerNames
    const [orderedNames, setOrderedNames] = useState<string[]>([]); // For step 3
    const [selectedCards, setSelectedCards] = useState<Set<CardId>>(new Set());

    // Validations
    const isValidPlayers = playerNames.every(n => n.trim().length > 0) && playerNames.length >= 2 && playerNames.length <= 6;

    const handleNext = () => {
        if (step === 0) {
            // Filter empty
            const validNames = playerNames.filter(n => n.trim() !== '');
            setPlayerNames(validNames);
            setOrderedNames(validNames);
        }
        setStep(s => s + 1);
    };

    const handleStartGame = () => {
        if (heroIndex === null) return;
        const heroName = orderedNames[heroIndex]; // orderedNames is what we use in step 2? 
        // Wait, if we reorder in step 3, heroIndex might point to wrong person if we just store index.
        // Better to store Hero Name.
        // Let's refine state:
        // Step 1: defines pool of names.
        // Step 2: identify who is Hero among those names.
        // Step 3: reorder those same names.
        // Step 4: pick cards.
        // Init game with ordered names.

        initializeGame(orderedNames, heroName, Array.from(selectedCards));
    };

    return (
        <div className="max-w-md mx-auto p-4 bg-zinc-900 min-h-screen text-zinc-100 flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold font-serif tracking-in-expand">Nuova Partita</h1>
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
                                            // We can proceed immediately or let them review
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

                        {/* Simple Swap Interface since we didn't add dnd-kit yet, keeping it lightweight */}
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
                            className="w-full bg-amber-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-amber-500 transition-all flex items-center justify-center gap-2"
                        >
                            <Play className="fill-current w-5 h-5" />
                            Inizia Indagine
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
