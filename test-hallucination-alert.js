const { composerNode } = require('./src/ai/graph/nodes/composer.js');
const { AIMessage } = require('@langchain/core/messages');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');

// Mock LLM
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
ChatGoogleGenerativeAI.prototype.invoke = async function() {
    return { content: "Harga paket Bodi Halus adalah Rp1.350.000 ya kak." };
};

// Mock humanHandover
require('./src/ai/utils/humanHandover.js').sendWhatsappNotification = (msg) => {
    console.log("\n>>> MOCK WA SENT TO ADMIN:");
    console.log(msg);
    console.log("<<<\n");
};

async function run() {
    const state = {
        messages: [new HumanMessage("Berapa harganya?")],
        metadata: { phoneReal: "62899999999@c.us" },
        planner: {
            conversation: {
                responseLength: "Singkat",
                informationPriority: []
            },
            execution: {
                toolIntent: "NONE",
            }
        },
        consultation: {
            requestedServices: ["Repaint Bodi Halus"]
        }
    };
    
    const result = await composerNode(state);
    console.log("Result:", result.messages[0].content);
    process.exit(0);
}
run();
