'use client';

import React from 'react';
import { Card, GridState, Player, CellState } from '@/types/game';
import { clsx } from 'clsx';
import { Check, X, Minus, Star } from 'lucide-react';

interface DetectiveGridProps {
    players: Player[];
    cards: Card[];
    gridState: GridState;
    onCellClick: (cardId: string, playerId: string, isRightClick?: boolean) => void;
    renderCellExtras?: (cardId: string, playerId: string) => React.ReactNode;
}

const CategoryHeader = ({ title }: { title: string }) => (
    <tr className="bg-noir-900 border-b border-noir-700">
        <td colSpan={100} className="py-2 px-4 text-gold-500 font-bold uppercase tracking-widest text-sm">
            {title}
        </td>
    </tr>
);

const CellIcon = ({ state }: { state: CellState }) => {
    switch (state) {
        case 'yes':
        case 'forced-yes':
            return <Check className="w-5 h-5 text-gold-500" />;
        case 'no':
        case 'forced-no':
            return <X className="w-5 h-5 text-alert-500/50" />;
        default:
            return <span className="block w-1 h-1 bg-noir-700/50 rounded-full" />;
    }
};

export function DetectiveGrid({ players, cards, gridState, onCellClick, renderCellExtras }: DetectiveGridProps) {
    // Group cards by category
    const suspects = cards.filter(c => c.category === 'suspect');
    const weapons = cards.filter(c => c.category === 'weapon');
    const rooms = cards.filter(c => c.category === 'room');

    const renderRows = (categoryCards: Card[]) => {
        return categoryCards.map((card) => {
            // Check if this row is a Solution (All players have No)
            const playerStates = players.map(p => gridState[card.id]?.[p.id] || 'empty');
            const isSolution = playerStates.every(s => s === 'no' || s === 'forced-no');

            return (
                <tr key={card.id} className={clsx(
                    "border-b border-noir-800 transition-colors group",
                    isSolution ? "bg-amber-500/10 hover:bg-amber-500/20" : "hover:bg-noir-800/50"
                )}>
                    <td className={clsx(
                        "py-3 px-4 font-medium border-r border-noir-800 sticky left-0 z-10 w-48 text-sm truncate",
                        isSolution ? "text-amber-400 font-bold bg-noir-800/90" : "text-slate-300 bg-noir-900/50"
                    )}>
                        {card.name}
                        {isSolution && <span className="ml-2 inline-flex"><Star className="w-3 h-3 text-amber-500 fill-amber-500" /></span>}
                    </td>
                    {players.map((player) => {
                        const state = gridState[card.id]?.[player.id] || 'empty';
                        return (
                            <td
                                key={`${card.id}-${player.id}`}
                                className={clsx(
                                    "w-12 text-center cursor-pointer relative border-r border-noir-800/50 last:border-0",
                                    "hover:bg-noir-700 transition-colors select-none",
                                    state === 'yes' || state === 'forced-yes' ? "bg-amber-900/10" : ""
                                )}
                                onClick={() => onCellClick(card.id, player.id)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    onCellClick(card.id, player.id, true);
                                }}
                            >
                                <div className="flex items-center justify-center h-full w-full relative">
                                    <CellIcon state={state} />
                                    {renderCellExtras && renderCellExtras(card.id, player.id)}
                                </div>
                            </td>
                        );
                    })}
                </tr>
            );
        });
    };

    return (
        <div className="overflow-x-auto rounded-lg border border-noir-700 shadow-2xl bg-noir-900">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-noir-800 text-slate-400 border-b border-noir-700">
                        <th className="py-4 px-4 text-left font-mono uppercase text-xs tracking-wider sticky left-0 z-20 bg-noir-800 w-48 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                            Evidence
                        </th>
                        {players.map((player) => (
                            <th key={player.id} className="py-4 px-2 font-mono text-center min-w-[3rem]">
                                <div className="flex flex-col items-center gap-1">
                                    <span className={clsx("text-xs font-bold uppercase", player.isHero ? "text-gold-500" : "text-slate-400")}>
                                        {player.name}
                                    </span>
                                    <span className="text-[10px] text-slate-600 font-normal">
                                        {player.cardCount}
                                    </span>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-noir-800">
                    <CategoryHeader title="Suspects" />
                    {renderRows(suspects)}
                    <CategoryHeader title="Weapons" />
                    {renderRows(weapons)}
                    <CategoryHeader title="Rooms" />
                    {renderRows(rooms)}
                </tbody>
            </table>
        </div>
    );
}
