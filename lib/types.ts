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

export type LogType = 'SUGGESTION' | 'ACCUSATION_FAILURE' | 'MANUAL_CONSTRAINT';

export interface BaseLog {
    id: string;
    turnNumber: number;
    timestamp: Date;
    type: LogType;
}

export interface SuggestionLog extends BaseLog {
    type: 'SUGGESTION';
    askerId: string;
    suggestion: Suggestion | null;
    responderId: string | null;
    provenCardId?: CardId | null;
}

export interface AccusationLog extends BaseLog {
    type: 'ACCUSATION_FAILURE';
    accuserId: string;
    suggestion: Suggestion;
}

export interface ManualConstraintLog extends BaseLog {
    type: 'MANUAL_CONSTRAINT';
    playerId: string;
    cards: CardId[];
    // If true: Player has AT LEAST ONE of 'cards'. (If len=1 => YES).
    // If false: Player has NONE of 'cards'. (NO for all).
    hasOneOf: boolean;
}

export type GameLog = SuggestionLog | AccusationLog | ManualConstraintLog;

export interface Constraint {
    id: string;
    playerId: string;
    cards: CardId[];
    resolved: boolean;
    sourceTurnId?: string;
}

export interface GameState {
    players: Player[];
    grid: Record<string, Record<CardId, CellState>>; // playerId -> cardId -> state
    constraints: Constraint[];
    logs: GameLog[];
    solution: Record<CardId, CellState>;
}
