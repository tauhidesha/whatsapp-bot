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

/**
 * Konstruksi Graph Zoya
 */
const workflow = new StateGraph(ZoyaState)
    .addNode('init', initNode)
    .addNode('classifier', classifierNode)
    .addNode('infoCollector', infoCollectorNode)
    .addNode('executor', toolExecutorNode)
    .addNode('formatter', formatterNode);

/**
 * Alur Kerja (Edges)
 */
workflow.addEdge(START, 'init');
workflow.addEdge('init', 'classifier');
workflow.addEdge('classifier', 'infoCollector');

// Router Logika:
workflow.addConditionalEdges(
    'infoCollector',
    (state) => {
        if (state.intent === 'HUMAN_HANDOVER') {
            return 'END';
        }
        // Jika sudah lengkap motor & layanannya, eksekusi tool (misal cek harga)
        if (state.context.isReadyForTools) {
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
