'use server';

import fs from 'fs';
import path from 'path';
import { kv } from '@vercel/kv';
import { GameLog, Player } from '@/lib/types';
import { ALL_CARDS, SUSPECTS, WEAPONS, ROOMS, CardId } from '@/lib/constants';

const DATA_FILE = path.join(process.cwd(), 'data', 'games.json');
const KV_KEY = 'cluedo_games';

// Determine Storage Strategy
// Checks for Vercel KV environment variables
const shouldUseKV = () => !!(process.env.KV_REST_API_URL || process.env.KV_URL || process.env.REDIS_URL);

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

// --- FILE SYSTEM HELPERS (Local Fallback) ---

function ensureDataDir() {
    try {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify([]));
        }
    } catch (e: any) {
        console.warn('[WARN] ensureDataDir failed (likely read-only FS on Vercel):', e.message);
    }
}

async function getGamesFS(): Promise<SavedGame[]> {
    ensureDataDir();
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading games (FS):', error);
        return [];
    }
}

async function saveGamesFS(games: SavedGame[]) {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(games, null, 2));
}

// --- ACTIONS ---

export async function getGames(): Promise<SavedGame[]> {
    const keys = Object.keys(process.env).filter(k => k.includes('KV') || k.includes('REDIS') || k.includes('URL'));
    console.log('[DEBUG] getGames called. Visible Keys:', keys, 'KV Mode:', shouldUseKV());
    if (shouldUseKV()) {
        try {
            // Retrieve from Vercel KV
            const games = await kv.get<SavedGame[]>(KV_KEY) || [];
            console.log(`[DEBUG] KV get success. Found ${games.length} games.`);
            return games;
        } catch (error) {
            console.error('Error reading games (KV):', error);
            return [];
        }
    } else {
        // Fallback to Local FS
        return getGamesFS();
    }
}

export async function saveGame(game: SavedGame): Promise<boolean> {
    try {
        const updatedGame = { ...game, lastUpdated: Date.now() };
        console.log(`[DEBUG] saveGame calling for ${game.id}. KV Mode: ${shouldUseKV()}`);

        if (shouldUseKV()) {
            // KV Strategy
            const games = await kv.get<SavedGame[]>(KV_KEY) || [];
            const index = games.findIndex(g => g.id === game.id);
            if (index >= 0) games[index] = updatedGame;
            else games.push(updatedGame);
            await kv.set(KV_KEY, games);
            console.log('[DEBUG] KV set success');
        } else {
            // FS Strategy
            const games = await getGamesFS();
            const index = games.findIndex(g => g.id === game.id);
            if (index >= 0) games[index] = updatedGame;
            else games.push(updatedGame);
            saveGamesFS(games);
        }
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
    try {
        if (shouldUseKV()) {
            const games = await kv.get<SavedGame[]>(KV_KEY) || [];
            const filtered = games.filter(g => g.id !== id);
            await kv.set(KV_KEY, filtered);
        } else {
            const games = await getGamesFS();
            const filtered = games.filter(g => g.id !== id);
            saveGamesFS(filtered);
        }
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
        characterId: 'miss_scarlett' // Default constant
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
        const solutionSuspect = SUSPECTS[Math.floor(Math.random() * SUSPECTS.length)];
        const solutionWeapon = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
        const solutionRoom = ROOMS[Math.floor(Math.random() * ROOMS.length)];

        newGame.solution = {
            suspect: solutionSuspect.id as CardId,
            weapon: solutionWeapon.id as CardId,
            room: solutionRoom.id as CardId
        };

        const solutionIds = new Set([newGame.solution.suspect, newGame.solution.weapon, newGame.solution.room]);
        const remainingCards = ALL_CARDS.filter(c => !solutionIds.has(c.id));

        // Shuffle
        for (let i = remainingCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remainingCards[i], remainingCards[j]] = [remainingCards[j], remainingCards[i]];
        }

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
