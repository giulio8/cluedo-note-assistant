import { CluedoSolver } from '../lib/cluedo-engine';
import { POST } from '../app/api/chat/route';
import { NextRequest } from 'next/server';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

// Mock NextRequest
class MockRequest extends NextRequest {
    constructor(body: any) {
        super('http://localhost:3000/api/agent', {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }
}

async function testAgent() {
    console.log("Testing Agent API...");

    // Setup Dummy State
    const players = [
        { id: 'p1', name: 'Scarlett', isHero: true },
        { id: 'p2', name: 'Mustard', isHero: false }
    ];
    // Create a scenario where Scarlett has Rope (Initial Deal)
    // We can't easily inject initial deal without full simulation or logs.
    // Let's just pass empty logs and ask a general question.

    const body = {
        messages: [
            { role: 'user', content: 'Why is Mustard suspicious?' } // Should trigger Explanation or Chitchat
        ],
        gameState: {
            players,
            heroName: 'Scarlett',
            logs: []
        }
    };

    try {
        const req = new MockRequest(body);
        const res = await POST(req);

        console.log("Status:", res.status);
        if (res.body) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                console.log("Chunk:", decoder.decode(value));
            }
        }
    } catch (e) {
        console.error("Test Failed:", e);
    }
}

testAgent();
