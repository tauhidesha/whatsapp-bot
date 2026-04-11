const { StateGraph, START, END, MemorySaver } = require('@langchain/langgraph');
const { ZoyaState } = require('./state');
const { initNode } = require('./nodes/init');
const { infoCollectorNode } = require('./nodes/infoCollector');
const { toolExecutorNode } = require('./nodes/executor');
const { formatterNode } = require('./nodes/formatter');
const prisma = require('../../lib/prisma'); // Shared singleton

const checkpointer = new MemorySaver();

const { adminNode, adminExecutorNode } = require('./nodes/admin');

/**
 * Konstruksi Graph Zoya
 * 
 * OPTIMIZED FLOW (classifier merged into infoCollector):
 * START → init → [admin | infoCollector] → [executor | formatter] → END
 * 
 * Saves ~600-1000ms per message by eliminating 1 LLM round-trip.
 */
const workflow = new StateGraph(ZoyaState)
    .addNode('init', initNode)
    .addNode('admin', adminNode)
    .addNode('adminExecutor', adminExecutorNode)
    .addNode('infoCollector', infoCollectorNode)
    .addNode('executor', toolExecutorNode)
    .addNode('formatter', formatterNode);

/**
 * Alur Kerja (Edges)
 */
workflow.addEdge(START, 'init');

// Admin Router: init → admin (if admin) | infoCollector (if customer)
workflow.addConditionalEdges(
    'init',
    (state) => (state.isAdmin ? 'admin' : 'infoCollector'),
    {
        'admin': 'admin',
        'infoCollector': 'infoCollector'
    }
);

// Admin Flow:
workflow.addConditionalEdges(
    'admin',
    (state) => (state.context.isReadyForTools ? 'adminExecutor' : 'END'),
    {
        'adminExecutor': 'adminExecutor',
        'END': END
    }
);
workflow.addEdge('adminExecutor', 'admin');

// Customer Flow Router:
workflow.addConditionalEdges(
    'infoCollector',
    (state) => {
        const { intent, context } = state;

        if (intent === 'HUMAN_HANDOVER') {
            return 'executor';
        }

        if (context.isReadyForTools) {
            return 'executor';
        }
        return 'formatter';
    },
    {
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
