require('dotenv').config();
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage } = require('@langchain/core/messages');
const fs = require('fs');

async function testVision() {
    console.log('🧪 Testing Vision Capability...');

    if (!process.env.GOOGLE_API_KEY) {
        console.error('❌ GOOGLE_API_KEY is missing in .env');
        return;
    }

    const model = new ChatGoogleGenerativeAI({
        model: 'gemini-2.0-flash',
        apiKey: process.env.GOOGLE_API_KEY,
    });

    // Create a simple 1x1 pixel base64 image (red dot)
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const mimeType = "image/png";

    // 1. Test OLD format (likely failing)
    console.log('\n--- Test 1: OLD Format (type: "media") ---');
    try {
        const response1 = await model.invoke([
            new HumanMessage({
                content: [
                    { type: "text", text: "What color is this image?" },
                    { type: "media", mime_type: mimeType, data: base64Image }
                ]
            })
        ]);
        console.log('✅ OLD Format Result:', response1.content);
    } catch (error) {
        console.log('❌ OLD Format Failed:', error.message);
    }

    // 2. Test NEW Format (type: "image_url" with string)
    console.log('\n--- Test 2: NEW Format (type: "image_url" string) ---');
    try {
        const response2 = await model.invoke([
            new HumanMessage({
                content: [
                    { type: "text", text: "What color is this image?" },
                    { type: "image_url", image_url: `data:${mimeType};base64,${base64Image}` }
                ]
            })
        ]);
        console.log('✅ NEW Format (String) Result:', response2.content);
    } catch (error) {
        console.log('❌ NEW Format (String) Failed:', error.message);
    }

    // 3. Test NEW Format (type: "image_url" object - standard langchain)
    console.log('\n--- Test 3: NEW Format (type: "image_url" object) ---');
    try {
        const response3 = await model.invoke([
            new HumanMessage({
                content: [
                    { type: "text", text: "What color is this image?" },
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                ]
            })
        ]);
        console.log('✅ NEW Format (Object) Result:', response3.content);
    } catch (error) {
        console.log('❌ NEW Format (Object) Failed:', error.message);
    }
}

testVision();
