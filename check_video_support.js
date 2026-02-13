require('dotenv').config();
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage } = require('@langchain/core/messages');

async function testVideoSupport() {
    console.log('🧪 Testing Video Support...');

    if (!process.env.GOOGLE_API_KEY) {
        console.error('❌ GOOGLE_API_KEY is missing in .env');
        return;
    }

    const model = new ChatGoogleGenerativeAI({
        model: 'gemini-2.0-flash',
        apiKey: process.env.GOOGLE_API_KEY,
    });

    // Minimal valid MP4 header (ftypisom) - just to test mime type acceptance
    // This is NOT a playable video, so the model might say "corrupted", but if it tries to process it, the format is accepted.
    // If it throws "Invalid argument" or "Invalid mime type", then the format is wrong.
    const dummyVideoBase64 = "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yavcCBXmobW9vdg==";
    const mimeType = "video/mp4";

    console.log('\n--- Test: Video via "image_url" field ---');
    try {
        const response = await model.invoke([
            new HumanMessage({
                content: [
                    { type: "text", text: "Is this a video file? (It might be corrupted/empty, just check format)" },
                    // LangChain often uses "image_url" as a generic bucket for data URIs in some implementations,
                    // OR it passes it through to Gemini which might parse the mime type from the data URI.
                    { type: "image_url", image_url: `data:${mimeType};base64,${dummyVideoBase64}` }
                ]
            })
        ]);
        console.log('✅ Result:', response.content);
    } catch (error) {
        console.log('❌ Failed:', error.message);
    }
}

testVideoSupport();
