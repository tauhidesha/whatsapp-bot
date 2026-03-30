const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function syncPrompt() {
    try {
        const appJsPath = path.resolve(__dirname, '../app.js');
        const content = fs.readFileSync(appJsPath, 'utf8');
        
        // Match SYSTEM_PROMPT = `...`;
        const match = content.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/);
        
        if (!match || !match[1]) {
            throw new Error('Could not find SYSTEM_PROMPT in app.js');
        }
        
        const latestPrompt = match[1];
        console.log('--- FOUND PROMPT IN APP.JS ---');
        console.log(latestPrompt.substring(0, 100) + '...');
        
        // Update KeyValueStore
        await prisma.keyValueStore.upsert({
            where: { collection_key: { collection: 'settings', key: 'ai_config' } },
            update: {
                value: {
                    systemPrompt: latestPrompt,
                    updatedAt: new Date().toISOString()
                }
            },
            create: {
                collection: 'settings',
                key: 'ai_config',
                value: {
                    systemPrompt: latestPrompt,
                    updatedAt: new Date().toISOString()
                }
            }
        });
        
        console.log('✅ [SUCCESS] Production System Prompt updated in SQL database.');
    } catch (error) {
        console.error('❌ [ERROR] Failed to sync prompt:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

syncPrompt();
