import { CardId, SuspectId } from './constants';

export type CellState = 'YES' | 'NO' | 'MAYBE';

export type ReasonType =
    | 'INITIAL_DEAL'          // Given at start
    | 'MANUAL_CONSTRAINT'     // User manually set it
    | 'SUGGESTION_RESPONSE'   // Player showed a card
    | 'SUGGESTION_PASS'       // Player passed (doesn't have any of the 3)
    | 'CONSTRAINT_SATISFACTION' // Logic: "Must have one of X, Y, Z" -> X, Y are NO -> Z is YES
    | 'CROSS_EXCLUSION'       // Logic: Someone has it -> Others don't
    | 'CARD_COUNT_MAX'        // Logic: Player has all their cards
    | 'CARD_COUNT_MIN'        // Logic: Player must have remaining cards to reach count
    | 'SOLUTION_DEDUCTION'    // Logic: No one else has it -> Solution
    | 'SOLUTION_MISMATCH';    // Logic: Card is in solution -> Players don't have it

export interface ReasoningTrace {
    type: ReasonType;
    turnId?: string;          // Related log ID
    dependencyIds?: string[]; // IDs of other constraints/cards that led to this
    description: string;      // Human readable concise reason
}

export interface CellData {
    status: CellState;
    provenance: ReasoningTrace | null;
}

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
    grid: Record<string, Record<CardId, CellData>>; // playerId -> cardId -> CellData
    constraints: Constraint[];
    logs: GameLog[];
    solution: Record<CardId, CellState>;
}
