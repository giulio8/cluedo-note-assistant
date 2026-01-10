'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UIMessage } from '@ai-sdk/react';
import { Bot, User, X, Send, Sparkles, BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming this exists, or I will use standard class names

interface AIAssistantProps {
    messages: UIMessage[];
    input: string;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: (e: React.FormEvent) => void;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    isLoading: boolean;
}

export default function AIAssistant({
    messages,
    input = '',
    handleInputChange,
    handleSubmit,
    isOpen,
    setIsOpen,
    isLoading
}: AIAssistantProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-24 md:bottom-8 md:right-24 bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 rounded-full shadow-2xl hover:scale-105 transition-transform z-50 flex items-center gap-2 border border-violet-400/30"
            >
                <Sparkles className="w-6 h-6 animate-pulse" />
                <span className="font-bold hidden md:inline">Ask AI</span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-[90vw] md:w-[400px] h-[600px] max-h-[80vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden backdrop-blur-md bg-opacity-95">
            {/* Header */}
            <div className="bg-slate-800 p-4 flex items-center justify-between border-b border-slate-700">
                <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 p-2 rounded-lg">
                        <BrainCircuit className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-100">Cluedo Strategic Agent</h3>
                        <p className="text-xs text-emerald-400 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            Online
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-slate-400 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-slate-500 mt-10">
                        <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Ask me anything about the board!</p>
                        <p className="text-sm mt-2">"Why is Plum NO?"</p>
                        <p className="text-sm">"What should I ask next?"</p>
                    </div>
                )}

                {messages.map((m) => (
                    <div
                        key={m.id}
                        className={cn(
                            "flex gap-3 max-w-[90%]",
                            m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                        )}
                    >
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                            m.role === 'user' ? "bg-amber-600" : "bg-indigo-600"
                        )}>
                            {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                        </div>
                        <div className={cn(
                            "p-3 rounded-2xl text-sm leading-relaxed shadow-lg",
                            m.role === 'user'
                                ? "bg-amber-600/20 text-amber-100 rounded-tr-none border border-amber-600/30"
                                : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700"
                        )}>
                            {(m as any).content}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3 mr-auto">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-700 flex items-center gap-1">
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 bg-slate-800/50 border-t border-slate-700">
                <div className="relative">
                    <input
                        className="w-full bg-slate-900 border border-slate-600 focus:border-indigo-500 rounded-full py-3 px-5 pr-12 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                        value={input}
                        onChange={(e) => {
                            if (handleInputChange) {
                                handleInputChange(e);
                            } else {
                                console.warn("handleInputChange is undefined");
                            }
                        }}
                        placeholder="Type a message..."
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    );
}
