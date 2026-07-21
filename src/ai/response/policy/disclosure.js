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
    
    // Package display: name + price + 1-liner from summary field
    directives.push(`PAKET HARGA: JIKA terdapat pilihan paket (misal Ekonomis, Basic, Standar, Premium):
- WAJIB format tiap bullet: "- Paket [Nama]: Rp[Harga] — [1 kalimat ringkas perbedaan utama]"
- Ambil 1-liner dari field "summary" tiap paket di TOOL RESULT data (jangan copy panjang, cukup inti bedanya).
- Contoh: "- Paket Standar: Rp1.430.000 — Mirror finish, tahan baret, garansi 1 tahun."
- JANGAN tampilkan harga saja tanpa deskripsi.
- JANGAN diringkas menjadi rentang harga total.`);

    return directives;
}

module.exports = {
    config,
    getDisclosureDirectives
};
