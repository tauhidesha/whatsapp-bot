const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient({
    // log: ['query', 'info', 'warn', 'error'], // uncomment to debug queries
});

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

module.exports = prisma;
