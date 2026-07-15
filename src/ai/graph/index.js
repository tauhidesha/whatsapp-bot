const { StateGraph, START, END } = require('@langchain/langgraph');
const { ZoyaState } = require('./state');
const { initNode } = require('./nodes/init');
const { ruleEngineNode } = require('./nodes/ruleEngine');
const { plannerNode } = require('./nodes/planner');
const { capabilityRouterNode } = require('./nodes/capabilityRouter');
const { composerNode } = require('./nodes/composer');
const { memoryNode } = require('./nodes/memoryNode');
const { analyticsNode } = require('./nodes/analyticsNode');
const { PrismaCheckpointer } = require('./PrismaCheckpointer');
const prisma = require('../../lib/prisma');

// Gunakan checkpointer berbasis PostgreSQL/Prisma
const checkpointer = new PrismaCheckpointer(prisma);

const { adminNode, adminExecutorNode } = require('./nodes/admin');

/**
 * Konstruksi Graph Zoya V2
 * 
 * AGENTIC LOOP V2:
 * START → init → planner → capabilityRouter → [composer | END]
 * (Tool executor logic akan disematkan di dalam router/capability untuk modularitas di sprint selanjutnya)
 */
const workflow = new StateGraph(ZoyaState)
    .addNode('init', initNode)
    .addNode('admin', adminNode)
    .addNode('adminExecutor', adminExecutorNode)
    .addNode('ruleEngineNode', ruleEngineNode)
    .addNode('plannerNode', plannerNode)
    .addNode('capabilityRouterNode', capabilityRouterNode)
    .addNode('composerNode', composerNode)
    .addNode('memoryNode', memoryNode)
    .addNode('analyticsNode', analyticsNode);

/**
 * Alur Kerja (Edges)
 */
workflow.addEdge(START, 'init');

// Admin Router: init → admin (if admin) | ruleEngine (if customer)
workflow.addConditionalEdges(
    'init',
    (state) => (state.isAdmin ? 'admin' : 'ruleEngineNode'),
    {
        'admin': 'admin',
        'ruleEngineNode': 'ruleEngineNode'
    }
);

// Admin Flow:
workflow.addConditionalEdges(
    'admin',
    // In V2, we might want to change isReadyForTools mapping, but we keep admin flow isolated for now
    (state) => (state.consultation?.missingFacts?.length === 0 ? 'adminExecutor' : 'END'),
    {
        'adminExecutor': 'adminExecutor',
        'END': END
    }
);
workflow.addEdge('adminExecutor', 'admin');

// Customer Flow V2:
workflow.addEdge('ruleEngineNode', 'plannerNode');
workflow.addEdge('plannerNode', 'capabilityRouterNode');

workflow.addConditionalEdges(
    'capabilityRouterNode',
    (state) => {
        const capability = state.planner?.capability;
        // Jika planner meminta tool execution, state sudah diupdate oleh router
        // Di full V2 implementation, kita akan re-route balik ke planner (re-evaluate)
        // Untuk Sprint 1, kita asumsikan setelah tool berjalan, atau jika tidak butuh tool, langsung ke composer.
        return 'composerNode';
    },
    {
        'composerNode': 'composerNode'
    }
);

workflow.addEdge('composerNode', 'memoryNode');
workflow.addEdge('memoryNode', 'analyticsNode');
workflow.addEdge('analyticsNode', END);

/**
 * Kompilasi Graph
 */
const zoyaAgent = workflow.compile({ checkpointer });

module.exports = { zoyaAgent, checkpointer };
