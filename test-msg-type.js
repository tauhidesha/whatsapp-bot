const { getMessageType, extractTextFromContent } = require('./src/ai/graph/utils/sanitizeMessages');

const msg = {
    "id": [
      "langchain_core",
      "messages",
      "HumanMessage"
    ],
    "lc": 1,
    "type": "constructor",
    "kwargs": {
      "content": [
        {
          "text": "encana bodi halus sama velg kak",
          "type": "text"
        }
      ]
    }
};

const roleType = getMessageType(msg) || 'user';
const role = roleType === 'human' ? 'user' : roleType;
const content = msg.kwargs?.content || msg.content;
const textContent = extractTextFromContent(content);

console.log("roleType:", roleType);
console.log("role:", role);
console.log("content:", JSON.stringify(content));
console.log("textContent:", textContent);
