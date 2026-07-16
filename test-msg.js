const { AIMessage, HumanMessage } = require("@langchain/core/messages");
const ai = new AIMessage("hello");
const human = new HumanMessage("hi");
console.log("AI JSON:", JSON.stringify(ai));
console.log("Human JSON:", JSON.stringify(human));
