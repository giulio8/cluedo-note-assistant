import React from 'react';
import { CardId } from '@/lib/constants';

interface CardAssetProps {
    cardId: CardId;
    label: string;
    type: 'suspect' | 'weapon' | 'room';
    size?: 'sm' | 'md' | 'lg';
    faceUp?: boolean;
}

export const CardAsset: React.FC<CardAssetProps> = ({
    cardId,
    label,
    type,
    size = 'md',
    faceUp = true
}) => {
    // Styling based on Type
    const baseColor =
        type === 'suspect' ? 'bg-amber-900 border-amber-700 text-amber-100' :
            type === 'weapon' ? 'bg-zinc-800 border-zinc-600 text-zinc-300' :
                'bg-slate-800 border-slate-600 text-slate-200';

    const sizeClasses =
        size === 'sm' ? 'w-16 h-24 text-[10px]' :
            size === 'md' ? 'w-24 h-36 text-xs' :
                'w-32 h-48 text-sm';

    if (!faceUp) {
        return (
            <div className={`${sizeClasses} rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900 flex items-center justify-center shadow-lg relative overflow-hidden`}>
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-500 to-zinc-900" />
                <span className="text-zinc-600 font-serif font-bold text-2xl">?</span>
            </div>
        );
    }

    return (
        <div className={`${sizeClasses} ${baseColor} border-2 rounded-lg p-2 flex flex-col items-center justify-between shadow-xl relative overflow-hidden transition-transform hover:-translate-y-1`}>
            {/* Texture overlay */}
            <div className="absolute inset-0 opacity-20 bg-noise mix-blend-overlay pointer-events-none" />

            <div className="font-bold text-center w-full uppercase tracking-widest opacity-80 border-b border-white/10 pb-1 truncate">
                {type}
            </div>

            <div className="flex-1 flex items-center justify-center text-center font-serif font-bold leading-tight px-1 z-10">
                {label}
            </div>

            {/* Decorative bottom element */}
            <div className="w-full h-1 bg-white/20 rounded-full" />
        </div>
    );
};
