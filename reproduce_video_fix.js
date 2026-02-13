require('dotenv').config();
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage } = require('@langchain/core/messages');

async function testVideoFix() {
    console.log('🧪 Testing Video Support with "media" type and correct casing...');

    if (!process.env.GOOGLE_API_KEY) {
        console.error('❌ GOOGLE_API_KEY is missing in .env');
        return;
    }

    const model = new ChatGoogleGenerativeAI({
        model: 'gemini-2.0-flash',
        apiKey: process.env.GOOGLE_API_KEY,
    });

    // Minimal valid MP4 header (ftypisom)
    const dummyVideoBase64 = "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yavcCBXmobW9vdg==";
    const mimeType = "video/mp4";

    // 2. Test "media" type with IMAGE (should work if "media" type implementation is correct)
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    console.log('\n--- Test: Image via "media" type with mimeType (camelCase) ---');
    try {
        const response = await model.invoke([
            new HumanMessage({
                content: [
                    { type: "text", text: "What is this?" },
                    { type: "media", mimeType: "image/png", data: base64Image }
                ]
            })
        ]);
        console.log('✅ Image Result:', response.content);
    } catch (error) {
        console.log('❌ Image Failed:', error.message);
    }

    console.log('\n--- Test: Video via "media" type with mimeType (camelCase) ---');
    try {
        const response = await model.invoke([
            new HumanMessage({
                content: [
                    { type: "text", text: "Is this a video file? (Check format only)" },
                    // CORRECT: mimeType (camelCase)
                    { type: "media", mimeType: mimeType, data: dummyVideoBase64 }
                ]
            })
        ]);
        console.log('✅ Video Result:', response.content);
    } catch (error) {
        console.log('❌ Video Failed:', error.message);
    }
}

testVideoFix();
