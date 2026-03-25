const { buildPrompt, parseExtractedJSON } = require('./src/ai/agents/contextExtractor.js');

const userMessage = "Mas, saya mau repaint velg nmax saya sama sekalian detailing mesin ya. Berapa ya biayanya?";
const aiReply = "Boleh mas, motornya NMAX ya. Untuk repaint velg dan detailing mesin, sebentar Zoya cek dulu harganya.";
const currentSummary = "User menanyakan layanan untuk motor Nmax.";

const prompt = buildPrompt(userMessage, aiReply, currentSummary, new Date().toISOString());

console.log("--- TEST PROMPT ---");
console.log(prompt);
console.log("\n--- TEST EXPECTATION ---");
console.log("The model should return a JSON with target_services: ['Repaint Velg', 'Detailing Mesin']");
