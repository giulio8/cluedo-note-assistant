import { CluedoSolver } from '../lib/cluedo-engine';
import { CardId } from '../lib/constants';

// Mock Data
const HERO = 'Hero';
const PLUM = 'Plum';
const PEACOCK = 'Peacock';
const PLAYERS = [HERO, PLUM, PEACOCK];

// Scenario Cards (Truth)
// Hero: Scarlett, Rope, Kitchen
// Peacock: Col. Mustard, Revolver, Ballroom (Target to deduce: Mustard)
// Plum: Rest...

async function runTest() {
    console.log('--- STARTING REFINED LOGIC VERIFICATION ---');

    // 1. Initialize
    const solver = new CluedoSolver(PLAYERS, HERO);

    // Set Initial Cards for Hero (Knowledge Base)
    // We strictly assume these cards are accurate.
    const heroCards = ['miss_scarlett', 'rope', 'kitchen'];
    heroCards.forEach(c => solver.setCardState(solver.players[0].id, c as any, 'YES'));
    solver.deriveKnowledge();
    console.log('[1] Initial State Set.');

    // ---------------------------------------------------------
    // TEST CASE A: The Observer Deduction (Indirect Constraint)
    // ---------------------------------------------------------
    console.log('\n--- TEST CASE A: Observer Deduction ---');

    // Turn 1: PLUM asks PEACOCK (Mustard, Dagger, Hall). 
    // Hero is observing. Peacock shows a card to Plum (hidden from Hero).
    console.log('Turn 1: Plum asks Peacock (Mustard, Dagger, Hall). Peacock answers (Hidden).');
    solver.addSuggestion(
        solver.players[1].id, // Plum
        ['col_mustard', 'dagger', 'hall'],
        solver.players[2].id, // Peacock
        null // Hero does NOT see the card
    );

    // Verify Constraint created
    // Peacock must have one of [Mustard, Dagger, Hall]
    const constraints = solver.constraints.filter(c => c.playerId === solver.players[2].id);
    if (constraints.length === 0) throw new Error('FAIL: No constraint created for Peacock');
    console.log(`[PASS] Constraint created for Peacock: has one of [Mustard, Dagger, Hall]`);

    // Turn 2: PLUM asks PEACOCK (Scarlett, Dagger, Hall). 
    // Peacock PASSES.
    // Note: Scarlett is Hero's card, but asking it is valid bluff/check.
    // Peacock passing means Peacock has NO (Scarlett, Dagger, Hall).
    console.log('Turn 2: Plum asks Peacock (Scarlett, Dagger, Hall). Peacock PASSES.');
    solver.addSuggestion(
        solver.players[1].id, // Plum
        ['miss_scarlett', 'dagger', 'hall'],
        null, // NO ANSWER (Peacock, and everyone else passed or handled by logic)
        null
    );
    // Actually `responderId: null` in registerTurn usually implies NOBODY answered.
    // Ideally we want to specify explicit passes, but the engine logic for `registerTurn` says:
    // If responderId is provided, everyone between asker and responder passes.
    // If responderId is NULL, EVERYONE (except asker) passes.
    // So `responderId: null` effectively means Peacock (and Hero) passed.

    // Check Deduction
    const peacockState = solver.grid[solver.players[2].id];
    console.log('Peacock State after Turn 2:');
    console.log(`- Dagger: ${peacockState['dagger']}`);
    console.log(`- Hall: ${peacockState['hall']}`);
    console.log(`- Mustard: ${peacockState['col_mustard']}`);

    if (peacockState['dagger'] !== 'NO') throw new Error('FAIL: Dagger should be NO (Passed)');
    if (peacockState['hall'] !== 'NO') throw new Error('FAIL: Hall should be NO (Passed)');

    if (peacockState['col_mustard'] === 'YES') {
        console.log('[SUCCESS] Engine deduced Peacock has Col. Mustard!');
    } else {
        throw new Error(`FAIL: Mustard should be YES on Peacock. Found: ${peacockState['col_mustard']}`);
    }

    // ---------------------------------------------------------
    // TEST CASE B: Direct Knowledge (Hero Asks)
    // ---------------------------------------------------------
    console.log('\n--- TEST CASE B: Direct Knowledge ---');
    // Turn 3: Hero asks Peacock (Revolver, Wrench, Study). 
    // Peacock shows Revolver.
    console.log('Turn 3: Hero asks Peacock. Peacock shows Revolver.');
    solver.addSuggestion(
        solver.players[0].id, // Hero
        ['revolver', 'wrench', 'study'],
        solver.players[2].id, // Peacock
        'revolver' // Explicitly shown
    );

    if (solver.grid[solver.players[2].id]['revolver'] === 'YES') {
        console.log('[SUCCESS] Engine marked Revolver as YES for Peacock.');
    } else {
        throw new Error('FAIL: Revolver should be YES.');
    }
}

runTest().catch(e => {
    console.error(e);
    process.exit(1);
});
