const { BaseCheckpointSaver } = require('@langchain/langgraph-checkpoint');

/**
 * PrismaCheckpointer
 * Menyimpan state LangGraph ke PostgreSQL melalui Prisma (KeyValueStore).
 */
class PrismaCheckpointer extends BaseCheckpointSaver {
    constructor(prisma) {
        super();
        this.prisma = prisma;
        this.collection = 'langgraph_checkpoints';
    }

    /**
     * Mengambil checkpoint untuk thread_id tertentu
     */
    async getTuple(config) {
        const threadId = config.configurable?.thread_id;
        const checkpointId = config.configurable?.checkpoint_id;

        if (!threadId) return undefined;

        try {
            // Jika ada checkpointId spesifik, cari itu. Jika tidak, cari yang terbaru (last updated).
            // Namun untuk simplicity awal, kita simpan 1 state per thread_id di KeyValueStore.
            const record = await this.prisma.keyValueStore.findUnique({
                where: {
                    collection_key: {
                        collection: this.collection,
                        key: threadId
                    }
                }
            });

            if (!record) return undefined;

            const { checkpoint, metadata, parent_config } = record.value;

            return {
                config: {
                    configurable: {
                        thread_id: threadId,
                        checkpoint_id: checkpointId || record.id // Gunakan ID record jika tdk ada ID spesifik
                    }
                },
                checkpoint,
                metadata,
                parentConfig: parent_config
            };
        } catch (error) {
            console.error('[PrismaCheckpointer] Error getTuple:', error);
            return undefined;
        }
    }

    /**
     * Menyimpan checkpoint baru
     */
    async put(config, checkpoint, metadata, newVersions) {
        const threadId = config.configurable?.thread_id;
        if (!threadId) return config;

        try {
            await this.prisma.keyValueStore.upsert({
                where: { collection_key: { collection: this.collection, key: threadId } },
                update: {
                    value: {
                        checkpoint,
                        metadata,
                        parent_config: config.configurable?.parent_config,
                        newVersions
                    },
                    updatedAt: new Date()
                },
                create: {
                    collection: this.collection,
                    key: threadId,
                    value: {
                        checkpoint,
                        metadata,
                        parent_config: config.configurable?.parent_config,
                        newVersions
                    }
                }
            });

            return {
                configurable: {
                    thread_id: threadId,
                    checkpoint_id: checkpoint.id
                }
            };
        } catch (error) {
            console.error('[PrismaCheckpointer] Error put:', error);
            return config;
        }
    }

    /**
     * Menyimpan intermediate writes (pending writes)
     */
    async putWrites(config, writes, taskId) {
        // Sederhananya, kita abaikan dulu karena bot ini stateless antar node
        // Namun fungsi ini harus ada agar LangGraph tidak error.
        return;
    }

    /**
     * List checkpoints (opsional, untuk history)
     */
    async *list(config, options) {
        const threadId = config.configurable?.thread_id;
        if (!threadId) return;

        const record = await this.prisma.keyValueStore.findUnique({
            where: { collection_key: { collection: this.collection, key: threadId } }
        });

        if (record) {
            yield {
                config: { configurable: { thread_id: threadId, checkpoint_id: record.id } },
                checkpoint: record.value.checkpoint,
                metadata: record.value.metadata
            };
        }
    }
}

module.exports = { PrismaCheckpointer };
