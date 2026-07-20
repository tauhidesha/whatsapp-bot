/**
 * Progressive Disclosure Policy
 * Defines how information should be progressively revealed to the user
 * to prevent overwhelming them with data.
 */

const config = {
    maxTopics: 5,         // Maximum main information chunks per message
    preferSummary: false, // Updated to false: we want to list packages, not summarize as ranges
    maxBullet: 4          // Maximum bullet points in a list
};

function getDisclosureDirectives(state, plannerDecision) {
    const directives = [];
    
    directives.push(`PROGRESSIVE DISCLOSURE: Jangan mengirim lebih dari ${config.maxTopics} informasi utama dalam satu pesan WA (Misal: Total, isi pekerjaan, range harga, penjelasan singkat, satu pertanyaan).`);
    
    // Always provide package breakdown with short summary
    directives.push(`PAKET HARGA: JIKA terdapat pilihan paket (misal Ekonomis, Basic, Standar, Premium), Anda WAJIB menjabarkan nama paket beserta harganya dalam bentuk bullet points. Berikan penjelasan perbedaan tiap paket secara RINGKAS (maksimal 1 kalimat atau poin pentingnya saja per paket). JANGAN diringkas menjadi rentang harga total.`);

    return directives;
}

module.exports = {
    config,
    getDisclosureDirectives
};
