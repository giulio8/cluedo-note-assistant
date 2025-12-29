import React, { useState, useMemo } from 'react';
import { CardId, ALL_CARDS, SUSPECTS, WEAPONS, ROOMS } from '@/lib/constants';
import { Player } from '@/types/game';
import { Check, X, ShieldAlert, BadgeCheck } from 'lucide-react';

interface CellModalProps {
    isOpen: boolean;
    onClose: () => void;
    player: Player | null; // Can be null if closing
    cardId: CardId | null;
    onConfirm: (action: 'YES' | 'NO' | 'CONSTRAINT', relatedCards?: CardId[]) => void;
}

export default function CellModal({ isOpen, onClose, player, cardId, onConfirm }: CellModalProps) {
    const [selectedCards, setSelectedCards] = useState<Set<CardId>>(new Set());
    const [mode, setMode] = useState<'SIMPLE' | 'COMPLEX'>('SIMPLE');

    // Reset state when opening
    React.useEffect(() => {
        if (isOpen) {
            setMode('SIMPLE');
            setSelectedCards(new Set());
        }
    }, [isOpen, cardId]);

    if (!isOpen || !player || !cardId) return null;

    const card = ALL_CARDS.find(c => c.id === cardId);
    if (!card) return null;

    const handleConstraintSubmit = () => {
        // Includes the current card + selected others
        const allCards = [cardId, ...Array.from(selectedCards)];
        onConfirm('CONSTRAINT', allCards);
    };

    const toggleCard = (cId: CardId) => {
        const newSet = new Set(selectedCards);
        if (newSet.has(cId)) newSet.delete(cId);
        else newSet.add(cId);
        setSelectedCards(newSet);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex justify-between items-start">
                    <div>
                        <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
                            Modifica Manuale
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-slate-100">{player.name}</span>
                            <span className="text-zinc-600">/</span>
                            <span className="text-amber-500 font-medium">{card.label}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto custom-scrollbar">

                    {/* Mode Toggle (if needed, but simple buttons work better) */}

                    {mode === 'SIMPLE' && (
                        <div className="grid gap-3">
                            <p className="text-sm text-zinc-500 mb-2">
                                Definisci lo stato di questa casella se hai informazioni certe.
                            </p>

                            <button
                                onClick={() => onConfirm('YES')}
                                className="flex items-center gap-4 p-4 rounded-xl bg-green-900/20 border border-green-900/50 hover:bg-green-900/30 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                                    <Check className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <h4 className="font-bold text-green-400">Sicuramente C'È (YES)</h4>
                                    <p className="text-xs text-green-500/70">{player.name} possiede questa carta.</p>
                                </div>
                            </button>

                            <button
                                onClick={() => onConfirm('NO')}
                                className="flex items-center gap-4 p-4 rounded-xl bg-red-900/20 border border-red-900/50 hover:bg-red-900/30 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                                    <X className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <h4 className="font-bold text-red-400">Sicuramente NON C'È (NO)</h4>
                                    <p className="text-xs text-red-500/70">{player.name} NON possiede questa carta.</p>
                                </div>
                            </button>

                            <div className="my-2 border-t border-zinc-800" />

                            <button
                                onClick={() => setMode('COMPLEX')}
                                className="flex items-center gap-4 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 hover:bg-zinc-800 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-full bg-amber-600/20 text-amber-500 flex items-center justify-center border border-amber-600/30 group-hover:border-amber-500 transition-colors">
                                    <ShieldAlert className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <h4 className="font-bold text-zinc-300">Vincolo Complesso</h4>
                                    <p className="text-xs text-zinc-500">"{player.name} ha una tra questa e altre carte..."</p>
                                </div>
                            </button>
                        </div>
                    )}

                    {mode === 'COMPLEX' && (
                        <div className="flex flex-col h-full">
                            <div className="mb-4 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
                                <p className="text-sm text-amber-200">
                                    Seleziona le <strong>altre carte</strong> coinvolte nel vincolo.
                                    <br />
                                    <span className="text-xs opacity-70">
                                        Logica: {player.name} ha ALMENO UNA tra:
                                        <span className="font-bold text-white mx-1">{card.label}</span>
                                        {Array.from(selectedCards).map(id => ALL_CARDS.find(c => c.id === id)?.label).map(l => `, ${l}`).join('')}
                                    </span>
                                </p>
                            </div>

                            <div className="space-y-4">
                                {[
                                    { label: 'Sospetti', items: SUSPECTS },
                                    { label: 'Armi', items: WEAPONS },
                                    { label: 'Stanze', items: ROOMS }
                                ].map(group => (
                                    <div key={group.label}>
                                        <h5 className="text-xs font-bold text-zinc-500 uppercase mb-2 ml-1">{group.label}</h5>
                                        <div className="grid grid-cols-2 gap-2">
                                            {group.items
                                                .filter(c => c.id !== cardId) // Exclude current card
                                                .map(c => (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => toggleCard(c.id as CardId)}
                                                        className={`p-2 rounded text-xs text-left transition-all border ${selectedCards.has(c.id as CardId)
                                                                ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-900/20'
                                                                : 'bg-zinc-800/50 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
                                                            }`}
                                                    >
                                                        {c.label}
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-6 mt-4 border-t border-zinc-800 flex gap-3">
                                <button
                                    onClick={() => setMode('SIMPLE')}
                                    className="px-4 py-3 rounded-xl bg-zinc-800 text-zinc-400 font-medium hover:bg-zinc-700 transition-colors"
                                >
                                    Indietro
                                </button>
                                <button
                                    onClick={handleConstraintSubmit}
                                    disabled={selectedCards.size === 0}
                                    className="flex-1 px-4 py-3 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                                >
                                    Crea Vincolo
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
