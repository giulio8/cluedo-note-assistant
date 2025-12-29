'use client';

import React from 'react';
import { LogEntry } from '@/types/game';

import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, AlertCircle, Info, CheckCircle2 } from 'lucide-react'; // Icons

interface InferenceLogProps {
    logs: LogEntry[];
}

const LogIcon = ({ type }: { type: LogEntry['type'] }) => {
    switch (type) {
        case 'deduction': return <Lightbulb className="w-4 h-4 text-gold-500" />;
        case 'error': return <AlertCircle className="w-4 h-4 text-alert-500" />;
        case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
        default: return <Info className="w-4 h-4 text-slate-500" />;
    }
};

export function InferenceLog({ logs }: InferenceLogProps) {
    return (
        <div className="flex flex-col h-full bg-noir-800/50 border-l border-noir-700 w-full md:w-80">
            <div className="p-4 border-b border-noir-700 bg-noir-900 sticky top-0 z-10">
                <h2 className="text-lg font-mono font-bold text-slate-200 flex items-center gap-2">
                    Case Log
                    <span className="text-xs font-normal text-slate-500 bg-noir-800 px-2 py-0.5 rounded-full border border-noir-700">
                        {logs.length} entries
                    </span>
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                <AnimatePresence initial={false}>
                    {logs.map((log) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={clsx(
                                "p-3 rounded-md border text-sm font-mono relative pl-10",
                                log.type === 'deduction' ? "bg-amber-900/10 border-gold-500/30 text-gold-100" :
                                    log.type === 'error' ? "bg-red-900/10 border-alert-500/30 text-red-100" :
                                        "bg-noir-900/50 border-noir-700 text-slate-300"
                            )}
                        >
                            <div className="absolute left-3 top-3.5">
                                <LogIcon type={log.type} />
                            </div>

                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Turn {log.turnNumber}
                                </span>
                                <span className="text-[10px] text-slate-600">
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>

                            <p className="leading-relaxed whitespace-pre-wrap">
                                {log.text}
                            </p>
                        </motion.div>
                    ))}
                    {logs.length === 0 && (
                        <div className="text-center text-slate-600 text-sm py-10 italic">
                            No evidence recorded yet...
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
