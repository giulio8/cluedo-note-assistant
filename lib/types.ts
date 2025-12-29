import { CardId, SuspectId } from './constants';

export type CellState = 'YES' | 'NO' | 'MAYBE';

export interface Player {
    id: string;
    name: string;
    characterId: SuspectId;
    cardCount: number;
    isHero: boolean;
}

export type Suggestion = [CardId, CardId, CardId]; // [Suspect, Weapon, Room]

export interface TurnLog {
    id: string;
    turnNumber: number;
    askerId: string;
    suggestion: Suggestion | null;
    responderId: string | null; // null if nobody answered (which shouldn't happen in standard rules unless winning, but technically possible if all pass)
    provenCardId?: CardId | null; // Known only if responder showed it to Hero, or Hero showed it
    timestamp: Date;
}

export interface Constraint {
    id: string;
    playerId: string;
    cards: CardId[]; // The player has at least one of these cards
    resolved: boolean; // true if we know which card it is (or if the constraint is satisfied/irrelevant)
    sourceTurnId?: string; // Optional link to the turn that generated this constraint
}

export interface GameState {
    players: Player[];
    grid: Record<string, Record<CardId, CellState>>; // playerId -> cardId -> state
    constraints: Constraint[];
    logs: TurnLog[];
    solution: Record<CardId, CellState>; // implicit 'YES' if all players are 'NO'
}
