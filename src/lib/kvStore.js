const prisma = require('./prisma.js');
const crypto = require('crypto');

class KVDocument {
    constructor(collection, key) {
        this.collection = collection;
        this.key = key;
    }

    async get() {
        const row = await prisma.keyValueStore.findUnique({
             where: { collection_key: { collection: this.collection, key: this.key } }
        });
        if (row) {
            return {
                exists: true,
                id: this.key,
                data: () => row.value
            };
        }
        return { exists: false, id: this.key, data: () => undefined };
    }

    async set(value, options = {}) {
        let finalValue = value;
        // Replace fake FieldValues
        finalValue = JSON.parse(JSON.stringify(finalValue, (k, v) => {
             if (v === '___SERVER_TIMESTAMP___') return new Date().toISOString();
             return v;
        }));

        if (options.merge) {
            const existing = await this.get();
            if (existing.exists) {
                finalValue = { ...(existing.data() || {}), ...finalValue };
            }
        }

        await prisma.keyValueStore.upsert({
            where: { collection_key: { collection: this.collection, key: this.key } },
            update: { value: finalValue },
            create: { collection: this.collection, key: this.key, value: finalValue }
        });
    }

    async update(value) {
        const existing = await this.get();
        if (!existing.exists) throw new Error(`Document ${this.key} not found for update in ${this.collection}`);
        let finalValue = { ...(existing.data() || {}), ...value };
        
        finalValue = JSON.parse(JSON.stringify(finalValue, (k, v) => {
             if (v === '___SERVER_TIMESTAMP___') return new Date().toISOString();
             return v;
        }));

        await prisma.keyValueStore.update({
            where: { collection_key: { collection: this.collection, key: this.key } },
            data: { value: finalValue }
        });
    }
    
    async delete() {
        await prisma.keyValueStore.delete({
            where: { collection_key: { collection: this.collection, key: this.key } }
        }).catch(() => {});
    }
}

class KVCollection {
    constructor(name) {
        this.name = name;
    }
    doc(key) {
        return new KVDocument(this.name, key || crypto.randomUUID());
    }
    async add(value) {
        const key = crypto.randomUUID();
        const doc = this.doc(key);
        await doc.set(value);
        return { id: key };
    }
    async get() {
         const rows = await prisma.keyValueStore.findMany({ where: { collection: this.name } });
         return {
             empty: rows.length === 0,
             docs: rows.map(r => ({
                 id: r.key,
                 exists: true,
                 data: () => r.value
             })),
             forEach: function(cb) {
                 this.docs.forEach(cb);
             }
         };
    }
}

const kvStore = {
    collection: (name) => new KVCollection(name),
    FieldValue: {
        serverTimestamp: () => '___SERVER_TIMESTAMP___',
        increment: (n) => n // Dummy, as true increment requires read-modify-write in SQL JSON if we were to support it
    }
};

module.exports = kvStore;
