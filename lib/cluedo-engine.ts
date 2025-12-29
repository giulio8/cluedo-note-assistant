import { ALL_CARDS, CardId } from './constants';
import { CellState, Constraint, Player, Suggestion, TurnLog } from './types';

export class CluedoSolver {
    players: Player[];
    grid: Record<string, Record<CardId, CellState>>; // playerId -> cardId -> state
    constraints: Constraint[];
    logs: TurnLog[];

    constructor(playerNames: string[], heroName: string) {
        this.players = [];
        this.constraints = [];
        this.logs = [];
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
            // In un'app reale, characterId dovrebbe essere selezionato dall'utente. 
            // Qui prendiamo un placeholder o lo passiamo nel costruttore se necessario.
            // Assumo che names siano solo stringhe per ora.
            const isHero = name === heroName;
            const extraCard = index < remainder ? 1 : 0;
            const cardCount = baseCardsPerPlayer + extraCard;

            const player: Player = {
                id: `p${index}`,
                name: name,
                characterId: 'miss_scarlett', // Placeholder, in futuro mappa dai nomi o input
                cardCount,
                isHero
            };

            this.players.push(player);
        });
    }

    private initializeGrid() {
        this.players.forEach(p => {
            this.grid[p.id] = {} as Record<CardId, CellState>;
            ALL_CARDS.forEach(card => {
                // 'chip' è CardId intero (es {id: 'rope'...}) ma qui usiamo solo l'id stringa
                this.grid[p.id][card.id] = 'MAYBE';
            });
        });
    }

    // Helper per settare stato (init Hero cards, etc.)
    public setCardState(playerId: string, cardId: CardId, state: CellState) {
        if (this.grid[playerId] && this.grid[playerId][cardId]) {
            this.grid[playerId][cardId] = state;
        }
    }

    // 2. Gestione Input (registerTurn)
    public registerTurn(
        askerId: string,
        suggestion: Suggestion | null,
        responderId: string | null,
        provenCardId?: CardId | null
    ) {
        // 2.1 Registra Log
        const turnNumber = this.logs.length + 1;
        const log: TurnLog = {
            id: `turn_${turnNumber}`,
            turnNumber,
            askerId,
            suggestion,
            responderId,
            provenCardId,
            timestamp: new Date()
        };
        this.logs.push(log);

        // If no suggestion (just moved), no logic to apply
        if (!suggestion) {
            return;
        }

        // 2.2 Logica "Passo": Chiunque sia tra asker (escluso) e responder (escluso) ha passato
        // e quindi NON ha nessuna delle carte suggerite.
        if (responderId) {
            const askerIdx = this.players.findIndex(p => p.id === askerId);
            const responderIdx = this.players.findIndex(p => p.id === responderId);

            // Calcola indici di chi ha passato
            let currentIdx = (askerIdx + 1) % this.players.length;
            while (currentIdx !== responderIdx) {
                const passedPlayerId = this.players[currentIdx].id;
                // Segna NO per tutte le carte suggerite
                suggestion.forEach(cardId => {
                    this.setCardState(passedPlayerId, cardId, 'NO');
                });
                currentIdx = (currentIdx + 1) % this.players.length;
            }

            // 2.3 Logica Responder
            if (provenCardId) {
                // Se la carta è provata (mostrata all'Hero o dall'Hero), è SICURAMENTE posseduta
                this.setCardState(responderId, provenCardId, 'YES');
            } else {
                // Altrimenti crea un vincolo: Responder ha ALMENO una delle carte
                this.constraints.push({
                    id: `constraint_${turnNumber}`,
                    playerId: responderId,
                    cards: [...suggestion],
                    resolved: false,
                    sourceTurnId: log.id
                });
            }
        } else {
            // Se NESSUNO risponde (responderId === null), allora NESSUNO ha quelle carte (tranne l'asker?)
            // Nelle regole standard, se nessuno risponde, l'asker potrebbe averle o sono nel dossier.
            // Se l'asker fa un'ipotesi bluffando, potrebbe averle lui.
            // Ma per tutti gli altri giocatori, è sicuramente 'NO'.
            this.players.forEach(p => {
                if (p.id !== askerId) {
                    suggestion.forEach(c => this.setCardState(p.id, c, 'NO'));
                }
            });
        }

        // 2.4 Esegui Motore Inferenziale automatica
        this.deriveKnowledge();
    }

    // 3. Motore di Inferenza
    public deriveKnowledge() {
        let changed = true;
        let loopCount = 0;
        while (changed && loopCount < 100) { // Safety break
            changed = false;
            loopCount++;

            // A. Regola Vincolo Logic
            this.constraints.filter(c => !c.resolved).forEach(c => {
                const playerState = this.grid[c.playerId];

                // Filtra carte che sono già NO
                const possibleCards = c.cards.filter(cardId => playerState[cardId] !== 'NO');

                // Se una delle carte è già YES, il vincolo è soddisfatto
                const alreadyYes = c.cards.some(cardId => playerState[cardId] === 'YES');
                if (alreadyYes) {
                    c.resolved = true;
                    // changed = true; // Risolto un vincolo non cambia la griglia direttamente, ma pulisce la lista
                    return;
                }

                if (possibleCards.length === 0) {
                    // Errore logico nei dati o nel gioco (cheater?)
                    console.warn(`Vincolo impossibile per giocatore ${c.playerId}`, c);
                    c.resolved = true; // Ignoralo per evitare loop
                } else if (possibleCards.length === 1) {
                    // Solo una possibilità rimasta -> DEVE essere YES
                    const forcedCard = possibleCards[0];
                    if (playerState[forcedCard] !== 'YES') {
                        this.setCardState(c.playerId, forcedCard, 'YES');
                        changed = true;
                    }
                    c.resolved = true;
                }
            });

            // B. Regola Cross-Exclusion (Unicità della carta)
            // Se un giocatore ha YES su una carta, tutti gli altri hanno NO
            ALL_CARDS.forEach(card => {
                const owner = this.players.find(p => this.grid[p.id][card.id] === 'YES');
                if (owner) {
                    this.players.forEach(p => {
                        if (p.id !== owner.id && this.grid[p.id][card.id] !== 'NO') {
                            this.setCardState(p.id, card.id, 'NO');
                            changed = true;
                        }
                    });
                }
            });

            // C. Regola "Esclusione" (Conteggio Carte)
            this.players.forEach(p => {
                let yesCount = 0;
                let maybeCount = 0;
                ALL_CARDS.forEach(card => {
                    const s = this.grid[p.id][card.id];
                    if (s === 'YES') yesCount++;
                    if (s === 'MAYBE') maybeCount++;
                });

                if (yesCount === p.cardCount && maybeCount > 0) {
                    // Ha trovato tutte le sue carte -> Tutte le MAYBE diventano NO
                    ALL_CARDS.forEach(card => {
                        if (this.grid[p.id][card.id] === 'MAYBE') {
                            this.setCardState(p.id, card.id, 'NO');
                            changed = true;
                        }
                    });
                }

                // C.2 Inverso (Opzionale/Avanzato): Se (MAYBE + YES) == cardCount, allora tutte le MAYBE sono YES
                // Se so che deve avere 4 carte, ne ho trovate 2 (YES), e ho solo 2 MAYBE rimaste -> Sono YES.
                if ((yesCount + maybeCount) === p.cardCount && maybeCount > 0) {
                    ALL_CARDS.forEach(card => {
                        if (this.grid[p.id][card.id] === 'MAYBE') {
                            this.setCardState(p.id, card.id, 'YES');
                            changed = true;
                        }
                    });
                }
            });

            // D. Regola Soluzione (Deduzione per Eliminazione Globale)
            // Se una carta è NO per TUTTI i giocatori, allora è nel dossier.
            // Questo non cambia la griglia dei giocatori (restano NO), ma è info utile.
            // Tuttavia, se la soluzione è "Tutti NO", non c'è azione di scrittura griglia "YES per player".
            // Ma possiamo usare l'informazione inversa:
            // Se sappiamo che una carta è nel Dossier (tutti hanno NO), non dobbiamo fare nulla di attivo sui player.

            // Però: Se sappiamo per certo che una carta NON è nel dossier (es. l'ho vista io), e tutti gli altri hanno NO...
            // beh allora ce l'ho io. Ma questo è coperto dal caso "Unicità".
        }
    }

    // Helper per UI: Ottieni stato soluzione
    public getSolutionStatus(): Record<CardId, CellState> {
        const solution: Record<string, CellState> = {};
        ALL_CARDS.forEach(card => {
            const allNo = this.players.every(p => this.grid[p.id][card.id] === 'NO');
            if (allNo) {
                solution[card.id] = 'YES';
            } else {
                // Se qualcuno ha YES, soluzione è NO.
                // Se nessuno ha YES ma ci sono MAYBE, soluzione è MAYBE.
                const someoneHasIt = this.players.some(p => this.grid[p.id][card.id] === 'YES');
                solution[card.id] = someoneHasIt ? 'NO' : 'MAYBE';
            }
        });
        return solution;
    }
}
