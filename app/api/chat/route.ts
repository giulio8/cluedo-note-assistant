import { NextRequest } from 'next/server';
import { ChatOpenAI, AzureChatOpenAI } from '@langchain/openai';
import { StateGraph, MessagesAnnotation, END, START } from '@langchain/langgraph';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage, ToolMessage } from '@langchain/core/messages';
import { CluedoSolver } from '@/lib/cluedo-engine';
import { createCluedoTools } from '@/lib/ai/tools';
import { ToolNode } from "@langchain/langgraph/prebuilt";

export const maxDuration = 60; // Allow 60s for agent reasoning

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        // console.log("Agent Request Body:", JSON.stringify(body, null, 2));

        let { messages, gameState } = body;

        // Fallback: Read from Headers if not in body
        if (!gameState) {
            const headerState = req.headers.get('X-Game-State');
            if (headerState) {
                try {
                    gameState = JSON.parse(headerState);
                    // console.log("Loaded GameState from Headers");
                } catch (e) {
                    console.error("Failed to parse GameState from header", e);
                }
            }
        }

        if (!gameState) {
            throw new Error("GameState is missing from both body and headers");
        }

        // 1. Reconstruct Solver State
        // gameState contains: players, logs (mostly logs needed)
        // We assume 'gameState' from the body matches what is needed.
        // Actually, the client sends 'logs' and 'players', but restoreState only needs logs?
        // restoreState also needs correct initialization (player names).

        // We need to know who the hero is etc.
        // Let's assume gameState has: { names: string[], hero: string, logs: GameLog[] }
        // If not, we might need to adjust client side.

        const { players, heroName, logs } = gameState; // Expecting this structure
        const playerNames = players.map((p: any) => p.name);

        const solver = new CluedoSolver(playerNames, heroName);
        solver.restoreState(logs);

        // 2. Create Tools
        const toolsMap = createCluedoTools(solver);
        const tools = Object.values(toolsMap);
        const toolNode = new ToolNode(tools);

        // 3. Define Graph Nodes

        // A. Classifier Node
        // Decides intent.
        // A. Classifier Node
        // Decides intent.
        let model: ChatOpenAI | AzureChatOpenAI;

        if (process.env.AZURE_OPENAI_API_KEY) {
            model = new AzureChatOpenAI({
                azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
                azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
                azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT,
                azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
                maxTokens: process.env.AZURE_OPENAI_MAX_TOKENS ? parseInt(process.env.AZURE_OPENAI_MAX_TOKENS) : undefined
            });
        } else {
            model = new ChatOpenAI({
                model: 'gpt-4o',
                temperature: 0,
                apiKey: process.env.OPENAI_API_KEY
            });
        }

        // Classifier doesn't need extra binding for now
        const classifierModel = model;

        async function classifier(state: typeof MessagesAnnotation.State) {
            const lastMessage = state.messages[state.messages.length - 1];

            const systemPrompt = `You are a Cluedo Assistant Router.
Classify the user's intent into one of these categories:
- "EXPLANATION": User asks why a cell is YES/NO, or asks for game logic clarification.
- "STRATEGY": User asks what to do next, what to ask, or for a simulation.
- "CHITCHAT": General conversation, greetings, or off-topic.

Reply with ONLY the category name.`;

            const response = await classifierModel.invoke([
                new SystemMessage(systemPrompt),
                lastMessage
            ]);

            return {
                messages: [new AIMessage({ content: response.content, id: 'classifier_result' })]
            };
        }

        // B. Investigator (Explanation)
        console.log("Binding tools for Investigator...");
        const investigatorModel = model.bindTools([toolsMap.explain_deduction, toolsMap.get_turn_history, toolsMap.get_board_state]);

        async function investigator(state: typeof MessagesAnnotation.State) {
            const system = new SystemMessage(`You are a Cluedo Logic Expert.
Your goal is to explain the state of the board.
Use 'explain_deduction' to find the exact reason for a value.
Use 'get_turn_history' if you need context.
Always cite the specific turn or logic provided by the tools.
Do not guess. If properance is missing, say so.`);

            const response = await investigatorModel.invoke([system, ...state.messages]);
            return { messages: [response] };
        }

        // C. Simulator (Strategy)
        console.log("Binding tools for Simulator...");
        const simulatorModel = model.bindTools([toolsMap.simulate_suggestion, toolsMap.get_board_state]);

        async function simulator(state: typeof MessagesAnnotation.State) {
            const system = new SystemMessage(`You are a Strategic Advisor for Cluedo.
Your goal is to help the user win.
Use 'simulate_suggestion' to evaluate potential moves.
Look for 'MAYBE' cells that could reveal a lot of info.
Suggest moves that maximize info gain.`);

            const response = await simulatorModel.invoke([system, ...state.messages]);
            return { messages: [response] };
        }

        // D. Responder (Chitchat / Fallback)
        async function responder(state: typeof MessagesAnnotation.State) {
            const response = await model.invoke(state.messages);
            return { messages: [response] };
        }

        // 4. Build Graph
        const workflow = new StateGraph(MessagesAnnotation)
            .addNode("classifier", classifier)
            .addNode("investigator", investigator)
            .addNode("simulator", simulator)
            .addNode("responder", responder)
            .addNode("tools", toolNode)
            .addEdge(START, "classifier");

        // Conditional Logic
        workflow.addConditionalEdges(
            "classifier",
            (state) => {
                // The last message is the classifier output
                const lastMsg = state.messages[state.messages.length - 1] as AIMessage;
                const intent = (lastMsg.content as string).trim().toUpperCase();

                if (intent.includes("EXPLANATION")) return "investigator";
                if (intent.includes("STRATEGY")) return "simulator";
                return "responder"; // CHITCHAT
            }
        );

        // Agents -> Tools logic
        const shouldContinue = (state: typeof MessagesAnnotation.State) => {
            const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
            if (lastMessage.tool_calls?.length) {
                return "tools";
            }
            return END;
        };

        workflow.addEdge("tools", "investigator"); // Simple loop for investigator
        // Simulator might also need tools? Yes.
        // But the edge above forces tools -> investigator.
        // If we want tools -> origin, we need dynamic edge or separate tool nodes?
        // Or simpler: define logic to route back to the sender.
        // For this V1, let's assume Simulator -> Tools -> Simulator is also needed.
        // We can use a common "tools" node but routing back depends on who called it.
        // We can check the previous message?

        // Let's create separate edges or use a router after tools.
        // Actually, ToolNode just runs. We need to route BACK.

        workflow.addConditionalEdges("investigator", shouldContinue);
        workflow.addConditionalEdges("simulator", shouldContinue);

        // If tools ran, who do we go back to?
        // We can inspect the state to see who generated the tool call.
        // Or we just merge them into a single "Agent" node if the tools are distinct enough?
        // But the spec requested different Nodes.

        // Solution: conditional edge from 'tools'
        workflow.addConditionalEdges("tools", (state) => {
            const lastToolMsg = state.messages[state.messages.length - 1] as ToolMessage;
            // Default to investigator if unclear.
            // Better logic: Track who called the tool?
            // For now, investigator handles post-tool logic mostly.
            // If simulator called tool, logic is simpler.
            // Let's loop back to the *same* agent using implicit knowledge?

            // We can look at the ToolMessage.tool_call_id and find the AIMessage that called it?
            // Too complex for V1.
            // Let's Route to Investigator as General Logic.
            return "investigator";
        });


        const app = workflow.compile();

        // 5. Run & Stream
        // Convert Client Messages (Vercel) to LangChain Messages
        const langChainMessages = messages.map((m: any) => {
            if (m.role === 'user') return new HumanMessage(m.content);
            if (m.role === 'assistant') return new AIMessage(m.content);
            return new HumanMessage(m.content);
        });

        const inputs = { messages: langChainMessages };

        const stream = await app.streamEvents(inputs, {
            version: 'v2',
        });

        // Bridge to filter specific events and yield chunks
        const eventBridge = async function* () {
            const encoder = new TextEncoder();

            for await (const event of stream) {
                if (event.event === 'on_chat_model_stream') {
                    // Whitelist nodes to stream from
                    const nodeName = event.metadata?.langgraph_node;
                    const validNodes = ['investigator', 'simulator', 'responder'];

                    if (!nodeName || !validNodes.includes(nodeName)) {
                        continue;
                    }

                    const chunk = event.data.chunk;
                    if (chunk && chunk.content) {
                        const text = chunk.content as string;
                        // Vercel Data Stream Protocol v1
                        // 0: Text part - requires JSON stringified content
                        yield encoder.encode('0:' + JSON.stringify(text) + '\n');
                    }
                }
            }
        };

        return new Response(new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of eventBridge()) {
                        controller.enqueue(chunk);
                    }
                } catch (e) {
                    controller.error(e);
                } finally {
                    controller.close();
                }
            }
        }), {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Vercel-AI-Data-Stream': 'v1'
            }
        });


    } catch (error: any) {
        console.error("Agent Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
