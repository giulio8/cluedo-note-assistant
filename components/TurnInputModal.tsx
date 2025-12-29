'use client';

import React, { useState, useEffect } from 'react';
import { useGameStoreWithUndo } from '@/store/gameStore';
import { SUSPECTS, WEAPONS, ROOMS, CardId } from '@/lib/constants';
import { X, Check, HelpCircle, User, ChevronRight } from 'lucide-react';

interface TurnInputModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function TurnInputModal({ isOpen, onClose }: TurnInputModalProps) {
    const { players, registerTurn, logs } = useGameStoreWithUndo();

    // Logic to guess next asker
    const lastLog = logs[logs.length - 1];
    const lastAskerIndex = lastLog ? players.findIndex(p => p.id === lastLog.askerId) : -1;
    const nextAskerId = lastAskerIndex >= 0
        ? players[(lastAskerIndex + 1) % players.length].id
        : players[0]?.id;

    // Local State
    const [askerId, setAskerId] = useState<string>('');
    const [noSuggestion, setNoSuggestion] = useState(false); // New state for 'Nessuna Ipotesi'
    const [selectedSuspect, setSelectedSuspect] = useState<CardId | null>(null);
    const [selectedWeapon, setSelectedWeapon] = useState<CardId | null>(null);
    const [selectedRoom, setSelectedRoom] = useState<CardId | null>(null);
    const [responderId, setResponderId] = useState<string | null>(null); // 'null' string or actual ID? Let's use string|null
    const [provenCardId, setProvenCardId] = useState<CardId | null>(null);

    // Initialize defaults when opening
    useEffect(() => {
        if (isOpen && players.length > 0) {
            setAskerId(nextAskerId || players[0].id);
            setNoSuggestion(false);
            setSelectedSuspect(null);
            setSelectedWeapon(null);
            setSelectedRoom(null);
            setResponderId(null);
            setProvenCardId(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    if (!isOpen) return null;

    const asker = players.find(p => p.id === askerId);
    const isHeroAsker = asker?.isHero;

    // Responder logic
    // "None" option + all other players except asker
    const potentialResponders = players.filter(p => p.id !== askerId);

    const responder = players.find(p => p.id === responderId);
    const isHeroResponder = responder?.isHero;

    // Validation
    const canSubmit = askerId && (
        noSuggestion || (
            selectedSuspect && selectedWeapon && selectedRoom && (
                responderId === null || // Nobody answered
                (responderId && !isHeroAsker && !isHeroResponder) || // AI vs AI
                (responderId && isHeroAsker && provenCardId) || // Hero asked, got shown a card (Must specify)
                (responderId && isHeroResponder) // Hero responded (Card optional/recommended)
            )
        )
    );

    const handleSubmit = () => {
        if (!canSubmit) return;

        if (noSuggestion) {
            registerTurn(askerId, null, null, null);
        } else {
            if (!selectedSuspect || !selectedWeapon || !selectedRoom) return; // TS check
            registerTurn(
                askerId,
                [selectedSuspect, selectedWeapon, selectedRoom],
                responderId,
                provenCardId
            );
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-zinc-900 sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-zinc-800 flex flex-col">

                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900/95 backdrop-blur z-10">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-amber-500" />
                        Registra Turno
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full">
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>

                <div className="p-4 space-y-6 flex-1">

                    {/* Section 1: Asker */}
                    <section>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Chi Chiede?</label>
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                            {players.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setAskerId(p.id);
                                        setResponderId(null); // Reset responder if asker changes
                                    }}
                                    className={`flex-shrink-0 px-4 py-3 rounded-xl border flex flex-col items-center gap-1 min-w-[80px] transition-all ${askerId === p.id
                                        ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-900/40'
                                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750'
                                        }`}
                                >
                                    <User className="w-4 h-4 opacity-70" />
                                    <span className="text-sm font-medium truncate w-full text-center">{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* No Suggestion Toggle */}
                    <section className="flex items-center gap-3 bg-zinc-800/30 p-3 rounded-lg border border-zinc-800">
                        <input
                            type="checkbox"
                            id="noSuggestion"
                            checked={noSuggestion}
                            onChange={e => setNoSuggestion(e.target.checked)}
                            className="w-5 h-5 rounded border-zinc-600 bg-zinc-700 text-amber-600 focus:ring-amber-500"
                        />
                        <label htmlFor="noSuggestion" className="text-sm text-zinc-300 font-medium cursor-pointer">
                            Nessuna ipostesi (Solo movimento / Passa turno)
                        </label>
                    </section>

                    {/* Logic Sections (Only if making suggestion) */}
                    {!noSuggestion && (
                        <>
                            {/* Section 2: Cards (The Core Interaction) */}
                            <section className="grid grid-cols-3 gap-2">
                                {[
                                    { label: 'Chi?', active: selectedSuspect, setter: setSelectedSuspect, list: SUSPECTS },
                                    { label: 'Con cosa?', active: selectedWeapon, setter: setSelectedWeapon, list: WEAPONS },
                                    { label: 'Dove?', active: selectedRoom, setter: setSelectedRoom, list: ROOMS },
                                ].map((col, i) => (
                                    <div key={i} className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase text-center">{col.label}</label>
                                        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto no-scrollbar bg-zinc-800/50 rounded-lg p-1">
                                            {col.list.map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => col.setter(item.id as CardId)}
                                                    className={`px-2 py-3 rounded-lg text-xs leading-tight text-center transition-all ${col.active === item.id
                                                        ? 'bg-amber-100 text-amber-900 font-bold shadow'
                                                        : 'text-zinc-400 hover:bg-zinc-700'
                                                        }`}
                                                >
                                                    {item.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </section>

                            {/* Section 3: Responder */}
                            <section>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Chi Risponde?</label>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setResponderId(null)}
                                        className={`px-4 py-2 rounded-lg text-sm border transition-all ${responderId === null
                                            ? 'bg-zinc-700 border-zinc-500 text-white'
                                            : 'bg-zinc-800/50 border-zinc-800 text-zinc-500'
                                            }`}
                                    >
                                        Nessuno
                                    </button>
                                    {potentialResponders.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setResponderId(p.id)}
                                            className={`px-4 py-2 rounded-lg text-sm border transition-all ${responderId === p.id
                                                ? 'bg-blue-600 border-blue-500 text-white'
                                                : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                                                }`}
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Conditional Logic: Card Shown */}
                            {responderId && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50">
                                    {isHeroAsker ? (
                                        <div>
                                            <label className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 block">
                                                Che carta ti ha mostrato {responder?.name}?
                                            </label>
                                            <div className="flex gap-2 flex-wrap">
                                                {[selectedSuspect, selectedWeapon, selectedRoom].filter(Boolean).map(cId => {
                                                    const cardDef = [...SUSPECTS, ...WEAPONS, ...ROOMS].find(c => c.id === cId);
                                                    return (
                                                        <button
                                                            key={cId}
                                                            onClick={() => setProvenCardId(cId)}
                                                            className={`px-3 py-2 rounded text-sm border ${provenCardId === cId
                                                                ? 'bg-green-600 border-green-500 text-white'
                                                                : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                                                                }`}
                                                        >
                                                            {cardDef?.label}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ) : isHeroResponder ? (
                                        <div>
                                            <label className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 block">
                                                Che carta hai mostrato? (Opzionale)
                                            </label>
                                            <div className="flex gap-2 flex-wrap">
                                                {[selectedSuspect, selectedWeapon, selectedRoom].filter(Boolean).map(cId => {
                                                    const cardDef = [...SUSPECTS, ...WEAPONS, ...ROOMS].find(c => c.id === cId);
                                                    return (
                                                        <button
                                                            key={cId}
                                                            onClick={() => setProvenCardId(provenCardId === cId ? null : cId)}
                                                            className={`px-3 py-2 rounded text-sm border ${provenCardId === cId
                                                                ? 'bg-green-600 border-green-500 text-white'
                                                                : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                                                                }`}
                                                        >
                                                            {cardDef?.label}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-zinc-500 italic flex items-center gap-2">
                                            <HelpCircle className="w-4 h-4" />
                                            Non sappiamo quale carta è stata mostrata, ma il sistema ne terrà conto.
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-900/95 sticky bottom-0">
                    <button
                        disabled={!canSubmit}
                        onClick={handleSubmit}
                        className="w-full bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed hover:bg-amber-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2"
                    >
                        <Check className="w-5 h-5" />
                        Registra Turno
                    </button>
                </div>

            </div>
        </div>
    );
}
