const admin = require('firebase-admin');

/**
 * Mengelola state percakapan yang persisten di Firestore.
 */
async function updateState(senderNumber, data) {
    if (!senderNumber || !data || typeof data !== 'object') return;

    const db = admin.firestore();
    const docId = senderNumber.replace(/[^0-9]/g, '');
    const stateRef = db.collection('conversationState').doc(docId);

    try {
        await stateRef.set({
            ...data,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log(`[State] Updated state for ${docId}:`, data);
    } catch (error) {
        console.error(`[State] Error updating state for ${docId}:`, error);
    }
}

async function getState(senderNumber) {
    if (!senderNumber) return null;

    const db = admin.firestore();
    const docId = senderNumber.replace(/[^0-9]/g, '');
    const stateRef = db.collection('conversationState').doc(docId);

    try {
        const doc = await stateRef.get();
        if (doc.exists) {
            return doc.data();
        }
        return null;
    } catch (error) {
        console.error(`[State] Error getting state for ${docId}:`, error);
        return null;
    }
}

async function clearState(senderNumber) {
    if (!senderNumber) return;

    const db = admin.firestore();
    const docId = senderNumber.replace(/[^0-9]/g, '');
    const stateRef = db.collection('conversationState').doc(docId);

    try {
        await stateRef.delete();
        console.log(`[State] Cleared state for ${docId}`);
    } catch (error) {
        console.error(`[State] Error clearing state for ${docId}:`, error);
    }
}

module.exports = {
    updateState,
    getState,
    clearState
};
