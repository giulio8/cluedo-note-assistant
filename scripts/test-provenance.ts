import { CluedoSolver } from '../lib/cluedo-engine';
import { createCluedoTools } from '../lib/ai/tools';

async function testProvenance() {
    console.log("Testing Provenance Logic...");

    // 1. Init
    const solver = new CluedoSolver(['Scarlett', 'Mustard', 'White'], 'Scarlett');

    // 2. Register a Turn: Scarlett asks Mustard about Rope. Mustard Does NOT have it. White shows something.
    // Actually, let's do a simple constraint.
    // Mustard passes.

    // Manual setup for testing
    // solver.setCardState('p2', 'card_rope', 'NO', { type: 'SUGGESTION_PASS', description: "Passed on Rope" });

    // Let's use registerTurn logic simulation or just setCardState
    console.log("Setting Mustard does not have Rope (Reason: Pass)...");
    solver.setCardState('p2', 'rope', 'NO', { type: 'SUGGESTION_PASS', description: "Passed on Rope suggestion" });

    // Check grid
    const cell = solver.grid['p2']['rope'];
    console.log(`Cell status: ${cell.status}`);
    console.log(`Provenance: ${JSON.stringify(cell.provenance)}`);

    if (cell.status !== 'NO' || !cell.provenance) {
        console.error("FAIL: Provenance not recorded.");
    } else {
        console.log("PASS: Provenance recorded.");
    }

    // 3. Check Tools
    console.log("Testing explain_deduction tool...");
    const tools = createCluedoTools(solver);
    // @ts-ignore
    const explanation = await tools.explain_deduction.invoke({ cardId: 'rope', playerId: 'p2' });
    console.log("Explanation Output:", explanation);

    if (explanation.includes("Passed on Rope")) {
        console.log("PASS: Tool explanation correct.");
    } else {
        console.error("FAIL: Tool explanation missing reason.");
    }
}

testProvenance().catch(console.error);
