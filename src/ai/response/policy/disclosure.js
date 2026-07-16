/**
 * Progressive Disclosure Policy
 * Defines how information should be progressively revealed to the user
 * to prevent overwhelming them with data.
 */

const config = {
    maxTopics: 5,         // Maximum main information chunks per message
    preferSummary: true,  // Should we prefer summarizing ranges instead of listing all variants?
    maxBullet: 4          // Maximum bullet points in a list
};

function getDisclosureDirectives(state, plannerDecision) {
    const directives = [];
    
    directives.push(`PROGRESSIVE DISCLOSURE: Jangan mengirim lebih dari ${config.maxTopics} informasi utama dalam satu pesan WA (Misal: Total, isi pekerjaan, range harga, penjelasan singkat, satu pertanyaan).`);
    
    if (config.preferSummary) {
        directives.push(`PAKET HARGA: JANGAN jelaskan perbedaan paket (Basic, Standar, Premium, Ekonomis) secara detail KECUALI customer secara spesifik bertanya "apa bedanya?". Cukup sebutkan ada beberapa pilihan kualitas/paket, atau ringkas menjadi range harga total saja.`);
    }

    return directives;
}

module.exports = {
    config,
    getDisclosureDirectives
};
