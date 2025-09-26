// File: src/ai/utils/langsmith.js
// Helper utilities to integrate LangSmith tracing when environment variables are provided.

let LangSmithTracer;
try {
  ({ LangSmithTracer } = require('langsmith'));
} catch (error) {
  // Dependency might not be installed yet (offline install). Log once lazily.
  LangSmithTracer = null;
}

function isLangSmithEnabled() {
  if (!LangSmithTracer) return false;
  if (process.env.LANGSMITH_TRACING === 'false') return false;
  if (process.env.LANGSMITH_TRACING_V2 === 'false') return false;
  return Boolean(process.env.LANGSMITH_API_KEY);
}

function getLangSmithCallbacks(runName = 'whatsapp-ai-chatbot') {
  if (!isLangSmithEnabled()) return [];

  const tracer = new LangSmithTracer({
    projectName: process.env.LANGSMITH_PROJECT || 'WhatsApp AI Chatbot',
    apiUrl: process.env.LANGSMITH_ENDPOINT,
    runName,
  });

  return [tracer];
}

module.exports = {
  getLangSmithCallbacks,
};
