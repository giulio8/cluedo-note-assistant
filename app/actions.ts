'use server';

import fs from 'fs';
import path from 'path';
import { GameLog, Player, Constraint } from '@/lib/types';
import { ALL_CARDS, SUSPECTS, WEAPONS, ROOMS, CardId } from '@/lib/constants';

const DATA_FILE = path.join(process.cwd(), 'data', 'games.json');

export interface SavedGame {
    id: string;
    name: string;
    createdAt: number;
    lastUpdated: number;
    mode: 'REAL' | 'DEV';

    // State
    players: Player[];
    heroName: string;

    // History
    logs: GameLog[];

    // Dev Mode Data
    groundTruth?: Record<string, CardId[]>; // playerId -> cards
    solution?: { suspect: CardId, weapon: CardId, room: CardId };
}

// Ensure data directory exists
function ensureDataDir() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    }
}

// --- ACTIONS ---

export async function getGames(): Promise<SavedGame[]> {
    ensureDataDir();
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading games:', error);
        return [];
    }
}

export async function saveGame(game: SavedGame): Promise<boolean> {
    ensureDataDir();
    try {
        const games = await getGames();
        const index = games.findIndex(g => g.id === game.id);

        // Update timestamp
        const updatedGame = { ...game, lastUpdated: Date.now() };

        if (index >= 0) {
            games[index] = updatedGame;
        } else {
            games.push(updatedGame);
        }

        fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving game:', error);
        return false;
    }
}

export async function loadGame(id: string): Promise<SavedGame | null> {
    const games = await getGames();
    return games.find(g => g.id === id) || null;
}

export async function deleteGame(id: string): Promise<boolean> {
    ensureDataDir();
    try {
        const games = await getGames();
        const filtered = games.filter(g => g.id !== id);
        fs.writeFileSync(DATA_FILE, JSON.stringify(filtered, null, 2));
        return true;
    } catch (error) {
        console.error('Error deleting game:', error);
        return false;
    }
}

export async function createNewGame(
    name: string,
    mode: 'REAL' | 'DEV',
    playerNames: string[],
    heroName: string
): Promise<SavedGame> {

    // 1. Basic Setup
    const totalPlayerCards = 18;
    const playerCount = playerNames.length;
    const baseCardsPerPlayer = Math.floor(totalPlayerCards / playerCount);
    const remainder = totalPlayerCards % playerCount;

    const players: Player[] = playerNames.map((pName, index) => ({
        id: `p${index}`,
        name: pName,
        isHero: pName === heroName,
        cardCount: baseCardsPerPlayer + (index < remainder ? 1 : 0),
        characterId: 'miss_scarlett' // Default, can be customized later if needed
    }));

    const newGame: SavedGame = {
        id: crypto.randomUUID(),
        name,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        mode,
        players,
        heroName,
        logs: []
    };

    // 2. Dev Mode Logic (Ground Truth Generation)
    if (mode === 'DEV') {
        // Randomly select solution
        const solutionSuspect = SUSPECTS[Math.floor(Math.random() * SUSPECTS.length)];
        const solutionWeapon = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
        const solutionRoom = ROOMS[Math.floor(Math.random() * ROOMS.length)];

        newGame.solution = {
            suspect: solutionSuspect.id as CardId,
            weapon: solutionWeapon.id as CardId,
            room: solutionRoom.id as CardId
        };

        const solutionIds = new Set([newGame.solution.suspect, newGame.solution.weapon, newGame.solution.room]);

        // Shuffle remaining cards
        const remainingCards = ALL_CARDS.filter(c => !solutionIds.has(c.id));

        // Fisher-Yates Shuffle
        for (let i = remainingCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remainingCards[i], remainingCards[j]] = [remainingCards[j], remainingCards[i]];
        }

        // Distribute
        const groundTruth: Record<string, CardId[]> = {};
        playerNames.forEach((_, idx) => groundTruth[`p${idx}`] = []);

        let pIdx = 0;
        remainingCards.forEach(card => {
            groundTruth[`p${pIdx}`].push(card.id);
            pIdx = (pIdx + 1) % playerCount;
        });

        newGame.groundTruth = groundTruth;
    }

    await saveGame(newGame);
    return newGame;
}
