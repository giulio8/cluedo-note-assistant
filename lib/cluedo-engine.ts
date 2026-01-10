import { ALL_CARDS, CardId } from './constants';
import { CellState, Constraint, GameLog, ManualConstraintLog, Player, Suggestion, CellData, ReasoningTrace, ReasonType } from './types';

export class CluedoSolver {
    players: Player[];
    grid: Record<string, Record<CardId, CellData>>; // playerId -> cardId -> CellData
    constraints: Constraint[];
    logs: GameLog[];
    solutionConstraints: Suggestion[]; // List of triplets that are NOT the solution

    constructor(playerNames: string[], heroName: string) {
        this.players = [];
        this.constraints = [];
        this.logs = [];
        this.solutionConstraints = [];
        this.grid = {};

        this.initializePlayers(playerNames, heroName);
        this.initializeGrid();
        console.log('CluedoSolver inizializzato con successo.');
    }

    // 1. Inizializzazione
    private initializePlayers(names: string[], heroName: string) {
        const totalPlayerCards = 18;
        const playerCount = names.length;
        const baseCardsPerPlayer = Math.floor(totalPlayerCards / playerCount);
        const remainder = totalPlayerCards % playerCount;

        // Ordine è importante per la distribuzione del resto
        names.forEach((name, index) => {
            const isHero = name === heroName;
            const extraCard = index < remainder ? 1 : 0;
            const cardCount = baseCardsPerPlayer + extraCard;

            const player: Player = {
                id: `p${index}`,
                name: name,
                characterId: 'miss_scarlett',
                cardCount,
                isHero
            };

            this.players.push(player);
        });
    }

    private initializeGrid() {
        this.players.forEach(p => {
            this.grid[p.id] = {} as Record<CardId, CellData>;
            ALL_CARDS.forEach(card => {
                this.grid[p.id][card.id] = { status: 'MAYBE', provenance: null };
            });
        });
    }

    // Helper per settare stato (init Hero cards, etc.)
    // Helper per settare stato (init Hero cards, etc.)
    public setCardState(playerId: string, cardId: CardId, state: CellState, reason: ReasoningTrace | null = null) {
        if (this.grid[playerId] && this.grid[playerId][cardId]) {
            const current = this.grid[playerId][cardId].status;
            // Only update if changing or if we have a better reason for an existing state?
            // For now, if state changes, we update. 
            // If state is same, we might update if 'reason' is more specific? (Future optimization)
            if (current !== state) {
                this.grid[playerId][cardId] = { status: state, provenance: reason };
            } else if (state !== 'MAYBE' && !this.grid[playerId][cardId].provenance && reason) {
                // If we had no reason before but now we do, update it
                this.grid[playerId][cardId].provenance = reason;
            }
        }
    }

    // --- ACTION HANDLERS ---

    public addSuggestion(
        askerId: string,
        suggestion: Suggestion | null,
        responderId: string | null,
        provenCardId?: CardId | null
    ) {
        const turnNumber = this.logs.length + 1;
        const log: GameLog = {
            id: `turn_${turnNumber}`,
            turnNumber,
            timestamp: new Date(),
            type: 'SUGGESTION',
            askerId,
            suggestion,
            responderId,
            provenCardId,
        };
        this.applyLog(log);
        this.logs.push(log);
        this.deriveKnowledge();
    }

    public addAccusationFailure(accuserId: string, suggestion: Suggestion) {
        const turnNumber = this.logs.length + 1;
        const log: GameLog = {
            id: `turn_${turnNumber}`,
            turnNumber,
            timestamp: new Date(),
            type: 'ACCUSATION_FAILURE',
            accuserId,
            suggestion
        };
        this.applyLog(log);
        this.logs.push(log);
        this.deriveKnowledge();
    }

    public addManualConstraint(playerId: string, cards: CardId[], hasOneOf: boolean) {
        const turnNumber = this.logs.length + 1;
        const log: GameLog = {
            id: `turn_${turnNumber}`,
            turnNumber,
            timestamp: new Date(),
            type: 'MANUAL_CONSTRAINT',
            playerId,
            cards,
            hasOneOf
        };
        this.applyLog(log);
        this.logs.push(log);
        this.deriveKnowledge();
    }

    // Restore state from full log history
    public restoreState(logs: GameLog[]) {
        // Reset grid (keep players)
        this.initializeGrid();
        this.logs = [];
        this.constraints = [];
        this.solutionConstraints = [];

        // Replay all logs
        logs.forEach(log => {
            this.logs.push(log);
            this.applyLog(log);
        });

        this.deriveKnowledge();
    }
    // Core State Update Logic
    private applyLog(log: GameLog) {
        if (log.type === 'SUGGESTION') {
            const { askerId, suggestion, responderId, provenCardId } = log;
            if (!suggestion) return;

            // Logica Passo
            if (responderId) {
                const askerIdx = this.players.findIndex(p => p.id === askerId);
                const responderIdx = this.players.findIndex(p => p.id === responderId);
                let currentIdx = (askerIdx + 1) % this.players.length;
                while (currentIdx !== responderIdx) {
                    const passedPlayerId = this.players[currentIdx].id;
                    suggestion.forEach(cardId => this.setCardState(passedPlayerId, cardId, 'NO', {
                        type: 'SUGGESTION_PASS',
                        turnId: log.id,
                        description: `Ha passato su suggerimento di ${this.getPlayerName(askerId)}`
                    }));
                    currentIdx = (currentIdx + 1) % this.players.length;
                }

                if (provenCardId) {
                    this.setCardState(responderId, provenCardId, 'YES', {
                        type: 'SUGGESTION_RESPONSE',
                        turnId: log.id,
                        description: `Ha mostrato la carta a ${this.getPlayerName(askerId)}`
                    });
                } else {
                    this.constraints.push({
                        id: `constraint_${log.turnNumber}`,
                        playerId: responderId,
                        cards: [...suggestion],
                        resolved: false,
                        sourceTurnId: log.id
                    });
                }
            } else {
                // Nessuno risponde => Soluzione o in mano ad Asker (Bluff)
                // Assumiamo che gli altri non ce l'abbiano
                this.players.forEach(p => {
                    if (p.id !== askerId) {
                        suggestion.forEach(c => this.setCardState(p.id, c, 'NO', {
                            type: 'SUGGESTION_PASS',
                            turnId: log.id,
                            description: `Nessuno ha risposto al suggerimento di ${this.getPlayerName(askerId)}`
                        }));
                    }
                });
            }
        }
        else if (log.type === 'ACCUSATION_FAILURE') {
            // Player failed with this triplet.
            // 1. Player is out (handled by UI manually? Or we mark them inactive? Not critical yet).
            // 2. This triplet is NOT the solution.
            this.solutionConstraints.push(log.suggestion);
        }
        else if (log.type === 'MANUAL_CONSTRAINT') {
            const { playerId, cards, hasOneOf } = log;
            if (hasOneOf) {
                // "Has AT LEAST ONE of [A, B...]"
                if (cards.length === 1) {
                    // Certainty YES
                    this.setCardState(playerId, cards[0], 'YES', {
                        type: 'MANUAL_CONSTRAINT',
                        turnId: log.id,
                        description: 'Impostato manualmente come YES'
                    });
                } else {
                    // Complex constraint
                    this.constraints.push({
                        id: `constraint_manual_${log.turnNumber}`,
                        playerId: playerId,
                        cards: [...cards],
                        resolved: false,
                        sourceTurnId: log.id
                    });
                }
            } else {
                // "Has NONE of [A, B...]"
                cards.forEach(c => this.setCardState(playerId, c, 'NO', {
                    type: 'MANUAL_CONSTRAINT',
                    turnId: log.id,
                    description: 'Impostato manualmente come NO'
                }));
            }
        }
    }

    // 3. Motore di Inferenza
    public deriveKnowledge() {
        let changed = true;
        let loopCount = 0;
        while (changed && loopCount < 100) {
            changed = false;
            loopCount++;

            // A. Regola Vincolo Logic (Standard)
            this.constraints.filter(c => !c.resolved).forEach(c => {
                const playerState = this.grid[c.playerId];
                const possibleCards = c.cards.filter(cardId => playerState[cardId].status !== 'NO');
                const alreadyYes = c.cards.some(cardId => playerState[cardId].status === 'YES');

                if (alreadyYes) {
                    c.resolved = true;
                    return;
                }

                if (possibleCards.length === 0) {
                    console.warn(`Vincolo impossibile per giocatore ${c.playerId}`, c);
                    c.resolved = true;
                } else if (possibleCards.length === 1) {
                    const forcedCard = possibleCards[0];
                    if (playerState[forcedCard].status !== 'YES') {
                        this.setCardState(c.playerId, forcedCard, 'YES', {
                            type: 'CONSTRAINT_SATISFACTION',
                            turnId: c.sourceTurnId,
                            description: `Per esclusione dal vincolo su ${c.cards.join(', ')}`
                        });
                        changed = true;
                    }
                    c.resolved = true;
                }
            });

            // B. Regola Cross-Exclusion (Unicità)
            ALL_CARDS.forEach(card => {
                const owner = this.players.find(p => this.grid[p.id][card.id].status === 'YES');
                if (owner) {
                    this.players.forEach(p => {
                        if (p.id !== owner.id && this.grid[p.id][card.id].status !== 'NO') {
                            this.setCardState(p.id, card.id, 'NO', {
                                type: 'CROSS_EXCLUSION',
                                description: `Posseduta da ${owner.name}`
                            });
                            changed = true;
                        }
                    });
                }
            });

            // C. Regola Conteggio Carte
            this.players.forEach(p => {
                let yesCount = 0;
                let maybeCount = 0;
                ALL_CARDS.forEach(card => {
                    const s = this.grid[p.id][card.id].status;
                    if (s === 'YES') yesCount++;
                    if (s === 'MAYBE') maybeCount++;
                });

                // C.1 Max Cards reached
                if (yesCount === p.cardCount && maybeCount > 0) {
                    ALL_CARDS.forEach(card => {
                        if (this.grid[p.id][card.id].status === 'MAYBE') {
                            this.setCardState(p.id, card.id, 'NO', {
                                type: 'CARD_COUNT_MAX',
                                description: `Giocatore ha già tutte le ${p.cardCount} carte`
                            });
                            changed = true;
                        }
                    });
                }

                // C.2 Min Cards forced
                if ((yesCount + maybeCount) === p.cardCount && maybeCount > 0) {
                    ALL_CARDS.forEach(card => {
                        if (this.grid[p.id][card.id].status === 'MAYBE') {
                            this.setCardState(p.id, card.id, 'YES', {
                                type: 'CARD_COUNT_MIN',
                                description: `Deve avere le restanti carte per arrivare a ${p.cardCount}`
                            });
                            changed = true;
                        }
                    });
                }
            });

            // D. Regola Soluzione Avanzata (Inc. Failed Accusations)
            // 1. Identify "Cards Known in Solution" (All players NO)
            const solutionCardsYes: CardId[] = [];
            ALL_CARDS.forEach(card => {
                if (this.players.every(p => this.grid[p.id][card.id].status === 'NO')) {
                    solutionCardsYes.push(card.id);
                }
            });

            // 2. Use Failed Accusations to exclude cards from Solution
            // If Accusation [A, B, C] failed And A, B are in Solution -> C CANNOT be in Solution.
            const cardsNotinSolution = new Set<CardId>();

            this.solutionConstraints.forEach(triplet => {
                // Count how many are YES in solution
                const yesInSol = triplet.filter(c => solutionCardsYes.includes(c));
                if (yesInSol.length === 2) {
                    // The 3rd must be NOT in solution
                    const third = triplet.find(c => !yesInSol.includes(c));
                    if (third) cardsNotinSolution.add(third);
                }
            });

            // 3. Inverse Deduction: If Card C is NOT in Solution, logic implies Someone has it.
            // If checks show N-1 players have NO for C -> Last player MUST have YES.
            cardsNotinSolution.forEach(cardId => {
                const potentialOwners = this.players.filter(p => this.grid[p.id][cardId].status !== 'NO');

                // If only 1 potential owner left
                if (potentialOwners.length === 1) {
                    const owner = potentialOwners[0];
                    if (this.grid[owner.id][cardId].status !== 'YES') {
                        this.setCardState(owner.id, cardId, 'YES', {
                            type: 'SOLUTION_MISMATCH',
                            description: 'Non può essere nella soluzione, l\'ultimo possibile proprietario sei tu (o Player X)'
                        });
                        changed = true;
                    }
                }
                // If 0 -> Error? (Impossible state)
            });
        }
    }

    public getSolutionStatus(): Record<CardId, CellState> {
        const solution: Record<string, CellState> = {};

        // Compute basic status
        ALL_CARDS.forEach(card => {
            const allNo = this.players.every(p => this.grid[p.id][card.id].status === 'NO');
            if (allNo) {
                solution[card.id] = 'YES';
            } else {
                const someoneHasIt = this.players.some(p => this.grid[p.id][card.id].status === 'YES');
                solution[card.id] = someoneHasIt ? 'NO' : 'MAYBE';
            }
        });

        // Apply Solution Constraints (Failed Accusations) overrides
        // If we know S and W are YES, and [S,W,R] failed -> R is NO.
        const yesCards = Object.entries(solution).filter(([_, s]) => s === 'YES').map(([c]) => c as CardId);

        this.solutionConstraints.forEach(triplet => {
            const yesInTriplet = triplet.filter(c => yesCards.includes(c));
            if (yesInTriplet.length === 2) {
                const third = triplet.find(c => !yesInTriplet.includes(c));
                if (third && solution[third] === 'MAYBE') {
                    solution[third] = 'NO'; // We know it's not the solution
                }
            }
        });

        return solution;
    }

    private getPlayerName(id: string): string {
        return this.players.find(p => p.id === id)?.name || id;
    }
}
