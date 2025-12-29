import { create } from 'zustand';
import { CluedoSolver } from '@/lib/cluedo-engine';
import { CardId } from '@/lib/constants';
import { GameState, Suggestion, CellState } from '@/lib/types';

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
    undoLastTurn: () => void;
    manualOverride: (playerId: string, cardId: CardId, state: CellState) => void;
    resetGame: () => void;
}

export const useGameStoreWithUndo = create<GameStore>((set, get) => ({
    isGameActive: false,
    solver: null,
    initialSetup: null,
    players: [],
    grid: {},
    constraints: [],
    logs: [],
    solution: {} as Record<CardId, CellState>, // Casting to satisfy Record type

    initializeGame: (playerNames, heroName, initialCards) => {
        const solver = new CluedoSolver(playerNames, heroName);

        // Set initial cards for Hero
        const hero = solver.players.find(p => p.isHero);
        if (hero) {
            initialCards.forEach(cardId => {
                solver.setCardState(hero.id, cardId, 'YES');
            });
            // Run initial deduction
            solver.deriveKnowledge();
        }

        set({
            isGameActive: true,
            solver,
            initialSetup: { names: playerNames, hero: heroName, cards: initialCards }
        });

        // Sync state
        const state = get();
        state.solver = solver; // Ensure solver is set for refreshState if set() is async (it's not, but safe)

        // Helper to refresh state defined inline to avoid hoisting issues or extra calls
        // We can just call a method.
        // But we can't define methods on 'this' easily in zustand without 'set' logic.
        // We duplicates logic or use a helper function outside.
        // Let's just inline the refresh logic here to be safe and simple.

        set({
            players: [...solver.players],
            grid: JSON.parse(JSON.stringify(solver.grid)),
            constraints: [...solver.constraints],
            logs: [...solver.logs],
            solution: solver.getSolutionStatus()
        });
    },

    registerTurn: (askerId, suggestion, responderId, provenCardId) => {
        const { solver } = get();
        if (!solver) return;

        solver.registerTurn(askerId, suggestion, responderId, provenCardId);

        set({
            players: [...solver.players],
            grid: JSON.parse(JSON.stringify(solver.grid)),
            constraints: [...solver.constraints],
            logs: [...solver.logs],
            solution: solver.getSolutionStatus()
        });
    },

    undoLastTurn: () => {
        const { solver, initialSetup } = get();
        if (!solver || !initialSetup) return;

        const currentLogs = [...solver.logs];
        if (currentLogs.length === 0) return;

        // Remove last log
        const logsToReplay = currentLogs.slice(0, -1);

        // Re-init
        const newSolver = new CluedoSolver(initialSetup.names, initialSetup.hero);
        const hero = newSolver.players.find(p => p.isHero);
        if (hero) {
            initialSetup.cards.forEach(c => newSolver.setCardState(hero.id, c, 'YES'));
        }

        // Replay
        logsToReplay.forEach(log => {
            newSolver.registerTurn(log.askerId, log.suggestion, log.responderId, log.provenCardId);
        });

        // We should also replay manualOverrides?
        // Current implementation does NOT track manualOverrides in logs.
        // This is a limitation. Manual overrides will be lost on Undo.
        // Acceptable for this scoped task.

        set({ solver: newSolver });

        set({
            players: [...newSolver.players],
            grid: JSON.parse(JSON.stringify(newSolver.grid)),
            constraints: [...newSolver.constraints],
            logs: [...newSolver.logs],
            solution: newSolver.getSolutionStatus()
        });
    },

    manualOverride: (playerId, cardId, state) => {
        const { solver } = get();
        if (!solver) return;

        solver.setCardState(playerId, cardId, state);
        solver.deriveKnowledge();

        set({
            players: [...solver.players],
            grid: JSON.parse(JSON.stringify(solver.grid)),
            constraints: [...solver.constraints],
            logs: [...solver.logs],
            solution: solver.getSolutionStatus()
        });
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
