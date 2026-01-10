import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { CluedoSolver } from '@/lib/cluedo-engine';
import { ALL_CARDS, CardId } from '@/lib/constants';

// Zod Schemas
const PlayerIdSchema = z.string().describe("The ID of the player (e.g., 'p0', 'p1')");
const CardIdSchema = z.enum(ALL_CARDS.map(c => c.id) as [string, ...string[]]).describe("The ID of the card (suspect, weapon, or room)");

export const createCluedoTools = (solver: CluedoSolver) => {
    return {
        get_board_state: tool(
            async ({ players, cards }) => {
                const result: any = {};
                const targetPlayers = players
                    ? solver.players.filter(p => players.includes(p.id))
                    : solver.players;

                const targetCards = cards
                    ? ALL_CARDS.filter(c => cards.includes(c.id))
                    : ALL_CARDS;

                targetPlayers.forEach(p => {
                    result[p.name] = {};
                    targetCards.forEach(c => {
                        const cell = solver.grid[p.id][c.id];
                        // Simplify for LLM: only show non-MAYBE if possible, or all?
                        // Showing all is fine, but maybe verbose.
                        // Let's return concise state: YES, NO, or MAYBE
                        result[p.name][c.label] = cell.status;
                    });
                });
                return JSON.stringify(result);
            },
            {
                name: "get_board_state",
                description: 'Retrieves the current status of the grid for specific players or cards. Use this to check who might have a card.',
                schema: z.object({
                    players: z.array(PlayerIdSchema).optional().describe("Filter by specific players"),
                    cards: z.array(CardIdSchema).optional().describe("Filter by specific cards (suspects, weapons, rooms)")
                })
            }
        ),

        get_turn_history: tool(
            async ({ limit, involvedPlayer }) => {
                let logs = [...solver.logs].reverse();
                if (involvedPlayer) {
                    // Try to match name or id
                    const p = solver.players.find(pl => pl.name.toLowerCase().includes(involvedPlayer.toLowerCase()) || pl.id === involvedPlayer);
                    if (p) {
                        logs = logs.filter(l => {
                            if (l.type === 'SUGGESTION') {
                                return l.askerId === p.id || l.responderId === p.id;
                            }
                            if (l.type === 'ACCUSATION_FAILURE') {
                                return l.accuserId === p.id;
                            }
                            if (l.type === 'MANUAL_CONSTRAINT') {
                                return l.playerId === p.id;
                            }
                            return false;
                        });
                    }
                }
                const summary = logs.slice(0, limit).map(l => {
                    // Return human readable summary to save tokens
                    if (l.type === 'SUGGESTION') {
                        const asker = solver.players.find(x => x.id === l.askerId)?.name;
                        const responder = l.responderId ? solver.players.find(x => x.id === l.responderId)?.name : "None";
                        const cards = l.suggestion ? l.suggestion.join(", ") : "Pass";
                        return `Turn ${l.turnNumber}: ${asker} asked [${cards}]. Responder: ${responder}.` + (l.provenCardId ? ` (Showed ${l.provenCardId})` : "");
                    }
                    return `Turn ${l.turnNumber}: ${l.type}`;
                });
                return JSON.stringify(summary);
            },
            {
                name: "get_turn_history",
                description: 'Fetches the last N turns or turns involving specific players. Use this to understand what happened recently.',
                schema: z.object({
                    limit: z.number().max(20).default(5).describe("Number of recent turns to fetch"),
                    involvedPlayer: z.string().optional().describe("Filter for turns where this player asked or answered")
                })
            }
        ),

        explain_deduction: tool(
            async ({ cardId, playerId }) => {
                // Map name to ID if needed? Schema says ID.
                // Assuming Agent passes valid ID.
                const cell = solver.grid[playerId]?.[cardId as CardId];
                if (!cell) return "Cell not found.";

                if (!cell.provenance) {
                    if (cell.status === 'MAYBE') return `I don't know yet (State is MAYBE).`;
                    return `State is ${cell.status} but I don't have a specific trace (likely Initial Deal).`;
                }

                return JSON.stringify({
                    status: cell.status,
                    reason: cell.provenance.description,
                    logicType: cell.provenance.type,
                    sourceTurn: cell.provenance.turnId
                });
            },
            {
                name: "explain_deduction",
                description: 'CRITICAL: Asks WHY a specific cell has a certain value (YES/NO). Use this when the user asks for explanations.',
                schema: z.object({
                    cardId: CardIdSchema.describe("The card ID to explain"),
                    playerId: PlayerIdSchema.describe("The player ID to explain")
                })
            }
        ),

        simulate_suggestion: tool(
            async ({ askerId, suggestion }) => {
                // 1. Clone Solver
                const clone = new CluedoSolver(solver.players.map(p => p.name), solver.players.find(p => p.isHero)?.name || "");
                clone.restoreState(solver.logs);

                // 2. Measure Entropy (Count of MAYBEs)
                const countMaybes = (s: CluedoSolver) => {
                    let count = 0;
                    s.players.forEach(p => {
                        ALL_CARDS.forEach(c => {
                            if (s.grid[p.id][c.id].status === 'MAYBE') count++;
                        });
                    });
                    return count;
                };

                const initialEntropy = countMaybes(clone);

                // 3. Simulate scenarios
                // We don't know who has the cards, so we simulate all valid possibilities?
                // This is expensive (Monte Carlo).
                // Simplified Strategy:
                // Assume the "Best Case" (Someone responds and shows a card we don't know)
                // OR Assume "Worst Case" (Everyone passes? -> Impossible if solution is different)

                // Let's just simulate adding the suggestion and seeing if constraints trigger anything immediately
                // assuming a generic response logic?
                // Actually, 'simulate_suggestion' usually implies we input a *result* too?
                // Or does it mean "If I ask this, what is the expected gain?"

                // For simplicity v1: We just return a heuristic score.
                // High score if:
                // - We ask about cards that are currently MAYBE for many players.
                // - We ask about a room we are in (if movement rules apply? Cluedo Note doesn't track position usually).

                let value = 0;
                const [s, w, r] = suggestion;
                [s, w, r].forEach(c => {
                    // If we already know the answer (YES/NO for solution), low value.
                    // If we know Player X has it, asking is useless unless we want to force show?
                    // Value comes from eliminating MAYBEs.
                    const solutionStatus = clone.getSolutionStatus()[c as CardId];
                    if (solutionStatus === 'MAYBE') value += 10; // High value to find solution
                });

                return JSON.stringify({
                    heuristicValue: value,
                    message: `Simulated asking about ${suggestion.join(', ')}. Base value score: ${value}. (Monte Carlo not active in v1)`
                });
            },
            {
                name: "simulate_suggestion",
                description: 'Runs a hypothetical turn to see how much information would be gained. Use this to advise the user on what to ask.',
                schema: z.object({
                    askerId: PlayerIdSchema,
                    suggestion: z.array(CardIdSchema).length(3).describe("Array of [Suspect, Weapon, Room]")
                })
            }
        ),
    };
};
