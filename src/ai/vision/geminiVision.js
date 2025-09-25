// File: src/ai/vision/geminiVision.js
// Helper to run multimodal (vision) inference with Gemini using the official Google Generative AI SDK.

const { GoogleGenerativeAI } = require('@google/generative-ai');

const modelCache = new Map();

function getModelInstance(modelName, apiKey) {
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is required for vision inference.');
  }

  const cacheKey = `${modelName}::${apiKey}`;
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
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
  generationConfig,
}) {
  const modelInstance = getModelInstance(model, apiKey);

  const promptParts = [];
  if (systemPrompt) {
    promptParts.push({ text: systemPrompt });
  }
  if (userPrompt) {
    promptParts.push({ text: userPrompt });
  }
  promptParts.push({
    inlineData: {
      data: base64Image,
      mimeType: mimeType || 'image/jpeg',
    },
  });

  const result = await modelInstance.generateContent({
    contents: [
      {
        role: 'user',
        parts: promptParts,
      },
    ],
    generationConfig: generationConfig || {
      temperature: 0.2,
      maxOutputTokens: 1024,
      topP: 0.95,
      topK: 40,
    },
  });

  const response = result?.response;
  const lines = [];

  if (response) {
    if (typeof response.text === 'function') {
      const baseText = response.text();
      if (baseText) {
        lines.push(baseText.trim());
      }
    }

    const candidates = Array.isArray(response.candidates) ? response.candidates : [];
    if (candidates.length > 0) {
      for (const candidate of candidates) {
        const contentParts = candidate?.content?.parts || [];
        contentParts.forEach((part) => {
          if (typeof part?.text === 'string') {
            lines.push(part.text.trim());
          }
        });
      }
    }
  }

  const uniqueLines = lines.filter(Boolean);
  const textOutput = uniqueLines.length > 0 ? uniqueLines.join('\n').trim() : '';

  return {
    text: textOutput,
    raw: result,
  };
}

module.exports = {
  generateVisionAnalysis,
};
