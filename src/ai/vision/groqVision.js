// File: src/ai/vision/groqVision.js
// Helper for vision inference with Groq using llama-3.2-vision models

const { ChatGroq } = require('@langchain/groq');
const { HumanMessage } = require('@langchain/core/messages');

const modelCache = new Map();

function getModelInstance(modelName, apiKey, temperature = 0.2) {
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is required for vision inference.');
  }

  const cacheKey = `${modelName}::${apiKey}::${temperature}`;
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey);
  }

  const model = new ChatGroq({
    model: modelName,
    temperature: temperature,
    apiKey: apiKey,
  });

  modelCache.set(cacheKey, model);
  return model;
}

async function generateVisionAnalysis({
  model,
  apiKey,
  base64Image,
  mimeType,
  systemPrompt,
  userPrompt,
  temperature = 0.2,
}) {
  const modelInstance = getModelInstance(model, apiKey, temperature);

  // Groq vision models use different format - combine prompts
  const fullPrompt = systemPrompt 
    ? `${systemPrompt}\n\n${userPrompt}`
    : userPrompt;

  const message = new HumanMessage({
    content: [
      {
        type: 'text',
        text: fullPrompt,
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Image}`,
        },
      },
    ],
  });

  const result = await modelInstance.invoke([message]);
  
  const textOutput = result?.content?.trim() || '';

  return {
    text: textOutput,
    raw: result,
  };
}

module.exports = {
  generateVisionAnalysis,
};
