/**
 * Detailing Flow Rules
 * Guides the conversation steps for detailing requests.
 */

const { businessRules } = require('./businessRulesData');

function evaluateDetailingRules(state) {
    const rules = [];
    const requested = state.consultation?.requestedServices || [];
    
    const isDetailing = requested.some(s => {
        const lower = s.toLowerCase();
        return lower.includes('detailing') || lower.includes('coating') || lower.includes('poles') || lower.includes('cuci');
    });
    
    if (!isDetailing) {
        return null;
    }

    const { vehicle, consultation } = state;
    let isBongkar = consultation?.isBongkarTotal;
    
    // Auto-infer bongkar status for specific services
    if (isBongkar === undefined || isBongkar === null) {
        if (requested.some(s => s.toLowerCase().includes('poles') || s.toLowerCase().includes('bodi') || s.toLowerCase().includes('coating'))) {
            isBongkar = false;
        } else if (requested.some(s => s.toLowerCase() === 'cuci komplit' || s.toLowerCase().includes('full detailing'))) {
            isBongkar = true;
        }
    }
    
    let paintType = null;
    if (typeof vehicle?.paintType === 'string') {
        paintType = vehicle.paintType.toLowerCase();
    } else if (vehicle?.paintType?.value) {
        paintType = vehicle.paintType.value.toLowerCase();
    }
    
    // Langkah 1: Tanya jenis motor
    if (!vehicle?.model) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Tanyakan jenis motor customer (Misal: Nmax, Aerox, dll).'
        });
        return rules; // Pause logic untill fulfilled
    } else {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: businessRules.communication.noMotorVariantQuestion
        });
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
