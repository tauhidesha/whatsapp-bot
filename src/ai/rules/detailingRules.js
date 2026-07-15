/**
 * Detailing Flow Rules
 * Guides the conversation steps for detailing requests.
 */

function evaluateDetailingRules(state) {
    const rules = [];
    const requested = state.consultation?.requestedServices || [];
    
    if (!requested.includes('detailing') && !requested.includes('coating')) {
        return null;
    }

    const { vehicle, consultation } = state;
    const isBongkar = consultation?.isBongkarTotal;
    const paintType = vehicle?.paintType?.toLowerCase();
    
    // Langkah 1: Tanya jenis motor
    if (!vehicle?.model) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Tanyakan jenis motor customer (Misal: Nmax, Aerox, dll).'
        });
        return rules; // Pause logic untill fulfilled
    }

    // Langkah 2: Tanya sejauh mana detailing (Bongkar Rangka?)
    if (isBongkar === undefined || isBongkar === null) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Tanyakan sejauh mana detailing yang diinginkan (Apakah sampai bongkar rangka atau bodi luar saja?).'
        });
        return rules;
    }

    // Langkah 3: Tanya jenis cat jika belum tahu
    if (!paintType || (paintType !== 'glossy' && paintType !== 'doff')) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Tanyakan jenis cat motor customer (Glossy atau Doff) untuk menentukan paket yang tepat.'
        });
        return rules;
    }

    // Opsi Penawaran Paket berdasarkan kombinasi
    if (isBongkar === false) {
        if (paintType === 'doff') {
            rules.push({
                type: 'CONVERSATION_GUIDELINE',
                directive: 'Tawarkan paket "Coating Doff". Jelaskan bahwa ini sudah mencakup detailing kaki-kaki, bodi, dan coating agar cat doff lebih awet.'
            });
        } else if (paintType === 'glossy') {
            rules.push({
                type: 'CONVERSATION_GUIDELINE',
                directive: 'Tawarkan "Poles Bodi" ATAU "Coating Glossy". Jelaskan perbedaan benefit dari kedua layanan tersebut.'
            });
        }
    } else if (isBongkar === true) {
        if (paintType === 'doff') {
            rules.push({
                type: 'CONVERSATION_GUIDELINE',
                directive: 'Tawarkan "Cuci Komplit" ATAU "Complete Service Doff". Jelaskan perbedaan keduanya.'
            });
        } else if (paintType === 'glossy') {
            rules.push({
                type: 'CONVERSATION_GUIDELINE',
                directive: 'Tawarkan "Full Detailing" ATAU "Complete Service Glossy". Jelaskan perbedaan keduanya.'
            });
        }
    }

    return rules;
}

module.exports = {
    evaluateDetailingRules
};
