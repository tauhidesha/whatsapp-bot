const { StateGraph, START, END } = require('@langchain/langgraph');
const { ZoyaState } = require('./state');
const { initNode } = require('./nodes/init');
const { classifierNode } = require('./nodes/classifier');
const { infoCollectorNode } = require('./nodes/infoCollector');
const { toolExecutorNode } = require('./nodes/executor');
const { formatterNode } = require('./nodes/formatter');
const { PrismaCheckpointer } = require('./PrismaCheckpointer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const checkpointer = new PrismaCheckpointer(prisma);

const { adminNode, adminExecutorNode } = require('./nodes/admin');

/**
 * Konstruksi Graph Zoya
 */
const workflow = new StateGraph(ZoyaState)
    .addNode('init', initNode)
    .addNode('admin', adminNode)
    .addNode('adminExecutor', adminExecutorNode)
    .addNode('classifier', classifierNode)
    .addNode('infoCollector', infoCollectorNode)
    .addNode('executor', toolExecutorNode)
    .addNode('formatter', formatterNode);

/**
 * Alur Kerja (Edges)
 */
workflow.addEdge(START, 'init');

// Admin Router:
workflow.addConditionalEdges(
    'init',
    (state) => (state.isAdmin ? 'admin' : 'classifier'),
    {
        'admin': 'admin',
        'classifier': 'classifier'
    }
);

workflow.addEdge('classifier', 'infoCollector');

// Admin Flow:
workflow.addConditionalEdges(
    'admin',
    (state) => (state.context.isReadyForTools ? 'adminExecutor' : END),
    {
        'adminExecutor': 'adminExecutor',
        'END': END
    }
);
workflow.addEdge('adminExecutor', 'admin');

// Router Logika:
workflow.addConditionalEdges(
    'infoCollector',
    (state) => {
        const { intent, context } = state;

        if (intent === 'HUMAN_HANDOVER') {
            return 'END';
        }

        // Tentukan mode balasan (replyMode)
        let replyMode = 'inform';
        if (intent === 'GREETING') {
            replyMode = 'greet';
        } else if (context.missingQuestions.length > 0) {
            replyMode = 'ask';
        }

        // Simpan replyMode ke metadata (state update)
        // Catatan: Di real LangGraph, kita mengembalikan node selanjutnya.
        // Untuk menyimpan data, kita butuh node perantara atau merubah state di dalam router (tidak direkomendasikan tapi praktis di sini).
        // Sebagai alternatif, kita kirimkan data ini via metadata di return value node infoCollector (sudah dilakukan sebagian).
        // Namun di sini kita akan biarkan formatter menentukannya sendiri berdasarkan state yang ada jika metadata tidak bisa diupdate di router.
        
        // Agar konsisten dengan rekomendasi user:
        if (context.isReadyForTools) {
            return 'executor';
        }
        return 'formatter';
    },
    {
        'END': END,
        'executor': 'executor',
        'formatter': 'formatter'
    }
);

workflow.addEdge('executor', 'formatter');
workflow.addEdge('formatter', END);

/**
 * Kompilasi Graph
 */
const zoyaAgent = workflow.compile({ checkpointer });

module.exports = { zoyaAgent };
