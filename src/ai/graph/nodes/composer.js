const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { AIMessage } = require('@langchain/core/messages');
const { buildComposerPrompt } = require('../../prompts/promptBuilder');
const { prioritizeInformation } = require('../../response/prioritizer');

/**
 * Response Composer Node for Zoya V2
 * Uses Gemini to compose a natural language response based on the planner strategy and tool results.
 */

async function composerNode(state) {
    console.log('[Composer Node] Composing natural response with LLM...');
    
    // Pass the state through the Prioritizer middleware
    const prioritizedData = prioritizeInformation(state);
    
    const promptText = buildComposerPrompt(state, state.planner || {}, prioritizedData);
    
    // Inisialisasi model
    const llm = new ChatGoogleGenerativeAI({
        model: process.env.AI_MODEL || 'gemini-2.5-flash-lite',
        temperature: 0.7,
        maxOutputTokens: 512,
        apiKey: process.env.GOOGLE_API_KEY
    });

    try {
        const response = await llm.invoke([
            ['system', 'Anda adalah Zoya, konsultan sales dari Bosmat Garage. Anda ramah, profesional, menggunakan bahasa Indonesia santai (mas/kak), dan penuh empati. Jangan pernah terdengar seperti bot.'],
            ['human', promptText]
        ]);
        
        let responseText = response.content;
        
        // Trim standard quotes if generated
        responseText = responseText.replace(/^["']|["']$/g, '');

        console.log('[Composer Node] Generated text:', responseText);

        const result = {
            messages: [new AIMessage(responseText)],
            analytics: {
                responseCount: (state.analytics?.responseCount || 0) + 1
            }
        };
        console.log('[Composer Node] Output:', JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error('[Composer Node] LLM Error:', error);
        const fallbackText = 'Aduh maaf mas, sistem saya lagi gangguan sedikit 🙏. Boleh ditunggu sebentar ya.';
        return {
            messages: [new AIMessage(fallbackText)],
            analytics: {
                responseCount: (state.analytics?.responseCount || 0) + 1
            }
        };
    }
}

module.exports = {
    composerNode
};
