const { sanitizeMessagesForGemini, getMessageType, extractTextFromContent } = require('./src/ai/graph/utils/sanitizeMessages');

const mockMessages = [
    {
        id: ["langchain_core", "messages", "HumanMessage"],
        kwargs: { content: "Pesan lama 1" },
        lc: 1, type: "constructor"
    },
    {
        id: ["langchain_core", "messages", "AIMessage"],
        kwargs: { content: "Balasan AI lama" },
        lc: 1, type: "constructor"
    },
    {
        id: ["langchain_core", "messages", "HumanMessage"],
        kwargs: { content: "[USER]: Full detaling glosy udh smua kan ya" },
        lc: 1, type: "constructor"
    }
];

const sanitized = sanitizeMessagesForGemini(mockMessages);
console.log("Sanitized length:", sanitized.length);

const transcript = sanitized
    .filter(m => getMessageType(m) === 'human' || getMessageType(m) === 'ai')
    .map(m => {
        const type = getMessageType(m);
        const text = extractTextFromContent(m.content);
        if (!text.trim()) return null;
        return `[${type === 'human' ? 'USER' : 'AI'}]: ${text.trim()}`;
    })
    .filter(Boolean)
    .join('\n\n');

console.log("Transcript:\n", transcript);
