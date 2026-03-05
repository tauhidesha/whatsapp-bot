const { Client } = require('langsmith');
const { traceable } = require('langsmith/traceable');

function isLangSmithEnabled() {
  if (process.env.LANGSMITH_TRACING === 'false') return false;
  if (process.env.LANGSMITH_TRACING_V2 === 'false') return false;
  return Boolean(process.env.LANGSMITH_API_KEY);
}

/**
 * Get LangSmith tracing callbacks with metadata and tags
 * @param {string} runName - Name of the run
 * @param {Object} options - Additional options including metadata and tags
 */
function getLangSmithCallbacks(runName = 'whatsapp-ai-chatbot', options = {}) {
  if (!isLangSmithEnabled()) return [];

  const { LangChainTracer } = require('@langchain/core/tracers/tracer_langchain');

  const tracer = new LangChainTracer({
    projectName: process.env.LANGSMITH_PROJECT || 'WhatsApp AI Chatbot',
    apiUrl: process.env.LANGSMITH_ENDPOINT,
    metadata: options.metadata || {},
    tags: options.tags || [],
  });

  return [tracer];
}

module.exports = {
  getLangSmithCallbacks,
  traceable,
  Client
};
