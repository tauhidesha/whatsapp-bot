/**
 * Readability and Formatting Policy
 * Controls formatting for WhatsApp to ensure the message looks professional
 * and is easy to scan.
 */

const config = {
    maxEmoji: 2,
    shortParagraphs: true
};

function getReadabilityDirectives(state, plannerDecision) {
    const directives = [];
    
    // Formatting basics
    directives.push(`FORMAT & STYLING:\n- Gunakan paragraf pendek agar mudah dibaca di HP.\n- MAKSIMAL ${config.maxEmoji} emoji untuk seluruh teks.\n- TONE: Friendly Professional (kasual tapi sopan, gunakan Mas/Kak).`);
    directives.push(`WA FORMATTING:\n- Gunakan satu bintang untuk *Teks Tebal*. JANGAN PERNAH gunakan dua bintang (**Teks**).\n- BULLET POINTS: Gunakan strip (-) atau angka (1., 2.), BUKAN bintang (*).\n- Tanda bintang pembuka dan penutup harus menempel pada kata (contoh: *kata*).`);
    directives.push(`LINK & LOKASI: Jika memberikan alamat atau link, BERIKAN SECARA UTUH (contoh: https://maps.app.goo.gl/...). Jangan suruh pengguna mencari sendiri.`);
    
    // Length policy
    const length = plannerDecision?.conversation?.responseLength || 'MEDIUM';
    if (length === 'SHORT') {
        directives.push(`RESPONSE LENGTH: SHORT. Jawab sesingkat mungkin dalam 1-2 kalimat.`);
    } else if (length === 'MEDIUM') {
        directives.push(`RESPONSE LENGTH: MEDIUM. Standar chat biasa, padat dan jelas.`);
    } else if (length === 'LONG') {
        directives.push(`RESPONSE LENGTH: LONG. Boleh memberikan penjelasan detail jika memang sangat diperlukan, tapi tetap gunakan paragraf pendek.`);
    }

    return directives;
}

module.exports = {
    config,
    getReadabilityDirectives
};
