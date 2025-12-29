export type Category = 'suspect' | 'weapon' | 'room';

export interface Card {
    id: string;
    name: string;
    category: Category;
}

export type CellState = 'empty' | 'yes' | 'no' | 'forced-yes' | 'forced-no';

export interface Player {
    id: string;
    name: string;
    isHero: boolean; // The user
    cardCount: number;
}

export interface GridState {
    [cardId: string]: {
        [playerId: string]: CellState;
    };
}

export interface Constraint {
    id: string;
    turnNumber: number;
    playerId: string; // The player who showed the card
    involvedCards: string[]; // IDs of possible cards shown
    description: string;
}

export interface LogEntry {
    id: string;
    turnNumber: number;
    text: string;
    type: 'info' | 'deduction' | 'error' | 'success';
    relatedConstraints?: string[]; // IDs of constraints
    timestamp: number;
}
