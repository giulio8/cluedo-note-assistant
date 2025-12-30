'use server';

import fs from 'fs';
import path from 'path';
import { createClient } from 'redis';
import { GameLog, Player } from '@/lib/types';
import { ALL_CARDS, SUSPECTS, WEAPONS, ROOMS, CardId } from '@/lib/constants';

const DATA_FILE = path.join(process.cwd(), 'data', 'games.json');
const KV_KEY = 'cluedo_games';

// Determine Storage Strategy
// Checks for REDIS_URL environment variable
const shouldUseRedis = () => !!process.env.REDIS_URL;

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

// --- REDIS HELPER ---

async function withRedis<T>(operation: (client: ReturnType<typeof createClient>) => Promise<T>): Promise<T> {
    const client = createClient({
        url: process.env.REDIS_URL
    });

    // Suppress connection errors from crashing the process immediately
    client.on('error', (err) => console.error('[REDIS CLIENT ERROR]', err));

    await client.connect();
    try {
        return await operation(client);
    } finally {
        await client.disconnect();
    }
}

// --- ACTIONS ---

export async function getGames(): Promise<SavedGame[]> {
    console.log('[DEBUG] getGames. REDIS_URL:', process.env.REDIS_URL ? 'FOUND' : 'MISSING', 'Using Redis:', shouldUseRedis());

    if (shouldUseRedis()) {
        try {
            return await withRedis(async (client) => {
                const data = await client.get(KV_KEY);
                return data ? JSON.parse(data) : [];
            });
        } catch (error) {
            console.error('[ERROR] Redis Read Failed:', error);
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

        if (shouldUseRedis()) {
            // Redis Strategy
            await withRedis(async (client) => {
                const data = await client.get(KV_KEY);
                const games: SavedGame[] = data ? JSON.parse(data) : [];

                const index = games.findIndex(g => g.id === game.id);
                if (index >= 0) games[index] = updatedGame;
                else games.push(updatedGame);

                await client.set(KV_KEY, JSON.stringify(games));
            });
            console.log('[DEBUG] Redis Save Success');
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
    // Reuse getGames which handles the dual logic
    const games = await getGames();
    return games.find(g => g.id === id) || null;
}

export async function deleteGame(id: string): Promise<boolean> {
    try {
        if (shouldUseRedis()) {
            await withRedis(async (client) => {
                const data = await client.get(KV_KEY);
                if (!data) return;

                const games: SavedGame[] = JSON.parse(data);
                const filtered = games.filter(g => g.id !== id);

                await client.set(KV_KEY, JSON.stringify(filtered));
            });
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
    heroName: string,
    heroCards: CardId[] = []
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
        characterId: 'miss_scarlett'
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
        const heroPlayer = players.find(p => p.isHero);
        if (!heroPlayer) throw new Error("Hero not found");

        const heroCardsSet = new Set(heroCards);

        // A. Select Solution (Must NOT be in Hero's hand)
        // Filter candidates
        const availableSuspects = SUSPECTS.filter(c => !heroCardsSet.has(c.id as CardId));
        const availableWeapons = WEAPONS.filter(c => !heroCardsSet.has(c.id as CardId));
        const availableRooms = ROOMS.filter(c => !heroCardsSet.has(c.id as CardId));

        if (availableSuspects.length === 0 || availableWeapons.length === 0 || availableRooms.length === 0) {
            throw new Error("Impossible configuration: Hero has all cards of a category!");
        }

        const solutionSuspect = availableSuspects[Math.floor(Math.random() * availableSuspects.length)];
        const solutionWeapon = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
        const solutionRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];

        newGame.solution = {
            suspect: solutionSuspect.id as CardId,
            weapon: solutionWeapon.id as CardId,
            room: solutionRoom.id as CardId
        };

        const solutionIds = new Set([newGame.solution.suspect, newGame.solution.weapon, newGame.solution.room]);

        // B. Prepare Pool (All - Solution - HeroKnown)
        // Note: HeroKnown are already 'taken' by hero.
        // We need to fill hands.

        let remainingCards = ALL_CARDS.filter(c => !solutionIds.has(c.id) && !heroCardsSet.has(c.id));

        // Shuffle Pool
        for (let i = remainingCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remainingCards[i], remainingCards[j]] = [remainingCards[j], remainingCards[i]];
        }

        const groundTruth: Record<string, CardId[]> = {};
        playerNames.forEach((_, idx) => groundTruth[`p${idx}`] = []);

        // C. Assign Known Cards to Hero
        groundTruth[heroPlayer.id] = [...heroCards];

        // D. Fill Hero's hand if they selected fewer than cardCount
        while (groundTruth[heroPlayer.id].length < heroPlayer.cardCount) {
            if (remainingCards.length === 0) break; // Should not happen
            const card = remainingCards.pop()!;
            groundTruth[heroPlayer.id].push(card.id);
        }

        // E. Distribute rest to others
        // We use a round-robin skipping the hero, or just fill by count?
        // Round robin is fairer if counts are even, but we calculated cardCount above.
        // Let's simpler: iterate players, fill until full.

        for (const p of players) {
            if (p.isHero) continue; // Already full
            while (groundTruth[p.id].length < p.cardCount) {
                if (remainingCards.length === 0) break;
                const card = remainingCards.pop()!;
                groundTruth[p.id].push(card.id);
            }
        }

        // F. If any remain (shouldn't if strict 18), distribute random? 
        // With 18 cards / N players, math is exact.

        newGame.groundTruth = groundTruth;
    }

    await saveGame(newGame);
    return newGame;
}

export async function testRedisConnection(): Promise<{ success: boolean; message: string }> {
    if (!shouldUseRedis()) return { success: false, message: 'REDIS_URL not found in Env' };
    try {
        await withRedis(async (client) => {
            await client.set('cluedo_test_ping', 'pong');
            const res = await client.get('cluedo_test_ping');
            if (res !== 'pong') throw new Error('Read/Write mismatch');
        });
        return { success: true, message: 'Redis Connected & Working!' };
    } catch (e: any) {
        return { success: false, message: 'Redis Error: ' + e.message };
    }
}
