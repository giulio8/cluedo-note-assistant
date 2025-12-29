'use client';

import React from 'react';
import { Constraint } from '@/types/game';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface ConstraintVisualizationProps {
    constraints: Constraint[];
    hoveredConstraint: string | null;
    onHoverConstraint: (id: string | null) => void;
    cardId: string;
    playerId: string;
}

export function ConstraintBadge({ constraints, hoveredConstraint, onHoverConstraint, cardId, playerId }: ConstraintVisualizationProps) {
    // Find active constraints for this specific cell (card + player)
    // A cell is involved if the player matches AND the card is in the involvedCards list
    const activeConstraints = constraints.filter(
        c => c.playerId === playerId && c.involvedCards.includes(cardId)
    );

    if (activeConstraints.length === 0) return null;

    return (
        <div className="absolute top-0 right-0 p-0.5 flex flex-col gap-0.5 pointer-events-none">
            {activeConstraints.map(constraint => (
                <motion.div
                    key={constraint.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={clsx(
                        "text-[9px] font-bold px-1 rounded shadow-sm border pointer-events-auto cursor-help",
                        hoveredConstraint === constraint.id
                            ? "bg-gold-500 text-noir-900 border-gold-400 z-50 ring-2 ring-gold-500/50"
                            : "bg-noir-800 text-slate-400 border-noir-600 hover:bg-noir-700"
                    )}
                    onMouseEnter={() => onHoverConstraint(constraint.id)}
                    onMouseLeave={() => onHoverConstraint(null)}
                >
                    T{constraint.turnNumber}
                </motion.div>
            ))}
        </div>
    );
}

// Separate component for the highlight effect that spans multiple cells
export function ConstraintHighlight({ constraints, hoveredConstraint, cardId, playerId }: {
    constraints: Constraint[],
    hoveredConstraint: string | null,
    cardId: string,
    playerId: string
}) {
    if (!hoveredConstraint) return null;

    const constraint = constraints.find(c => c.id === hoveredConstraint);
    if (!constraint) return null;

    // Highlight if this cell is part of the constraint
    const isRelated = constraint.playerId === playerId && constraint.involvedCards.includes(cardId);

    if (!isRelated) return null;

    return (
        <motion.div
            layoutId={`constraint-highlight-${hoveredConstraint}`} // Shared layout ID might be tricky across table cells, basic fade is safer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gold-500/20 pointer-events-none z-0 mix-blend-overlay"
        />
    );
}
