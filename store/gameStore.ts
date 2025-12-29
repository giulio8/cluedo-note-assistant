import { create } from 'zustand';
import { CluedoSolver } from '@/lib/cluedo-engine';
import { CardId } from '@/lib/constants';
import { GameState, Suggestion, CellState } from '@/lib/types';
import { SavedGame } from '@/app/actions';

interface GameStore {
    isGameActive: boolean;
    solver: CluedoSolver | null;
    initialSetup: { names: string[], hero: string, cards: CardId[] } | null;

    // Reactive State Snapshot
    players: GameState['players'];
    grid: GameState['grid'];
    constraints: GameState['constraints'];
    logs: GameState['logs'];
    solution: GameState['solution'];

    // Actions
    initializeGame: (playerNames: string[], heroName: string, initialCards: CardId[]) => void;
    registerTurn: (askerId: string, suggestion: Suggestion | null, responderId: string | null, provenCardId?: CardId | null) => void;
    addManualConstraint: (playerId: string, cards: CardId[], hasOneOf: boolean) => void;
    addAccusationFailure: (accuserId: string, suggestion: Suggestion) => void;
    undoLastTurn: () => void;
    manualOverride: (playerId: string, cardId: CardId, state: CellState) => void;
    resetGame: () => void;

    // Persistence
    gameId: string | null;
    gameMode: 'REAL' | 'DEV';
    meta: {
        name: string;
        createdAt: number;
        lastUpdated: number;
    } | null;
    groundTruth: Record<string, CardId[]> | null;
    devSolution: { suspect: CardId, weapon: CardId, room: CardId } | null;
    loadSavedGame: (game: SavedGame) => void;
}

export const useGameStoreWithUndo = create<GameStore>((set, get) => ({
    isGameActive: false,
    solver: null,
    initialSetup: null,

    gameId: null,
    gameMode: 'REAL',
    meta: null,
    groundTruth: null,
    devSolution: null,
    players: [],
    grid: {},
    constraints: [],
    logs: [],
    solution: {} as Record<CardId, CellState>, // Casting to satisfy Record type

    initializeGame: (playerNames, heroName, initialCards) => {
        const solver = new CluedoSolver(playerNames, heroName);

        // Log Initial Cards for Persistence Replay via Manual Constraints
        const hero = solver.players.find(p => p.isHero);
        if (hero && initialCards.length > 0) {
            initialCards.forEach(cardId => {
                solver.addManualConstraint(hero.id, [cardId], true);
            });
        }

        set({
            isGameActive: true,
            solver,
            initialSetup: { names: playerNames, hero: heroName, cards: initialCards },

            // Sync Initial State
            players: solver.players,
            grid: { ...solver.grid },
            constraints: [...solver.constraints],
            logs: [...solver.logs],
            solution: solver.getSolutionStatus(),

            // Reset Persistence
            gameId: null,
            gameMode: 'REAL',
            meta: null,
            groundTruth: null,
            devSolution: null
        });
    },

    loadSavedGame: (game: SavedGame) => {
        const playerNames = game.players.map(p => p.name);
        const solver = new CluedoSolver(playerNames, game.heroName);

        solver.restoreState(game.logs);

        set({
            isGameActive: true,
            solver,
            initialSetup: { names: playerNames, hero: game.heroName, cards: [] },

            players: solver.players,
            grid: { ...solver.grid },
            constraints: [...solver.constraints],
            logs: [...solver.logs],
            solution: solver.getSolutionStatus(),

            gameId: game.id,
            gameMode: game.mode,
            meta: {
                name: game.name,
                createdAt: game.createdAt,
                lastUpdated: game.lastUpdated
            },
            groundTruth: game.groundTruth || null,
            devSolution: game.solution || null
        });
    },


    registerTurn: (askerId, suggestion, responderId, provenCardId) => {
        const { solver } = get();
        if (!solver) return;

        solver.addSuggestion(askerId, suggestion, responderId, provenCardId);

        set({
            players: [...solver.players],
            grid: JSON.parse(JSON.stringify(solver.grid)),
            constraints: [...solver.constraints],
            logs: [...solver.logs],
            solution: solver.getSolutionStatus()
        });
    },

    addManualConstraint: (playerId, cards, hasOneOf) => {
        const { solver } = get();
        if (!solver) return;
        solver.addManualConstraint(playerId, cards, hasOneOf);
        set(state => ({
            players: [...solver.players],
            grid: JSON.parse(JSON.stringify(solver.grid)),
            constraints: [...solver.constraints],
            logs: [...solver.logs],
            solution: solver.getSolutionStatus()
        }));
    },

    addAccusationFailure: (accuserId, suggestion) => {
        const { solver } = get();
        if (!solver) return;
        solver.addAccusationFailure(accuserId, suggestion);
        set(state => ({
            players: [...solver.players],
            grid: JSON.parse(JSON.stringify(solver.grid)),
            constraints: [...solver.constraints],
            logs: [...solver.logs],
            solution: solver.getSolutionStatus()
        }));
    },

    undoLastTurn: () => {
        const { solver, initialSetup } = get();
        if (!solver || !initialSetup) return;

        const currentLogs = [...solver.logs];
        if (currentLogs.length === 0) return;

        const logsToReplay = currentLogs.slice(0, -1);

        const newSolver = new CluedoSolver(initialSetup.names, initialSetup.hero);
        const hero = newSolver.players.find(p => p.isHero);
        if (hero) {
            initialSetup.cards.forEach(c => newSolver.setCardState(hero.id, c, 'YES'));
            newSolver.deriveKnowledge();
        }

        logsToReplay.forEach(log => {
            if (log.type === 'SUGGESTION') {
                newSolver.addSuggestion(log.askerId, log.suggestion, log.responderId, log.provenCardId);
            } else if (log.type === 'MANUAL_CONSTRAINT') {
                newSolver.addManualConstraint(log.playerId, log.cards, log.hasOneOf);
            } else if (log.type === 'ACCUSATION_FAILURE') {
                newSolver.addAccusationFailure(log.accuserId, log.suggestion);
            }
        });

        set({
            solver: newSolver,
            players: [...newSolver.players],
            grid: JSON.parse(JSON.stringify(newSolver.grid)),
            constraints: [...newSolver.constraints],
            logs: [...newSolver.logs],
            solution: newSolver.getSolutionStatus()
        });
    },

    manualOverride: (playerId, cardId, state) => {
        const { addManualConstraint } = get();
        if (state === 'YES') {
            addManualConstraint(playerId, [cardId], true);
        } else if (state === 'NO') {
            addManualConstraint(playerId, [cardId], false);
        }
    },

    resetGame: () => {
        set({
            isGameActive: false,
            solver: null,
            initialSetup: null,
            players: [],
            grid: {},
            constraints: [],
            logs: [],
            solution: {} as Record<CardId, CellState>
        });
    }
}));
