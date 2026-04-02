/**
 * File: src/ai/utils/serviceTypeMapper.js
 * Maps various service names to core categories for rebooking logic.
 */

const SERVICE_TYPE_MAP = {
    // Repaint
    'Repaint Bodi Halus':       'repaint',
    'Repaint Bodi Kasar':       'repaint',
    'Repaint Velg':             'repaint',
    'Repaint Cover CVT / Arm':  'repaint',
    'Spot Repair':              'repaint',

    // Detailing
    'Detailing Mesin':          'detailing',
    'Cuci Komplit':             'detailing',
    'Poles Bodi Glossy':        'detailing',
    'Full Detailing Glossy':    'detailing',

    // Coating
    'Coating Motor Doff':       'coating',
    'Coating Motor Glossy':     'coating',
    'Complete Service Doff':    'coating',
    'Complete Service Glossy':  'coating',
    'Maintenance Coating':      'coating', // Added per user feedback
    'Maintanance Coating':      'coating', // Handle typo
};

/**
 * Normalizes serviceType string to a core category.
 * If multiple services are present, follows priority:
 * coating > repaint > detailing
 * 
 * @param {string} serviceTypeStr - Raw service type from booking
 * @returns {'coating'|'repaint'|'detailing'|null}
 */
function parseServiceType(serviceTypeStr) {
    if (!serviceTypeStr) return null;

    // Split by common separators: newline, bullet, or comma
    const services = serviceTypeStr
        .split(/[\n§,-]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    const categories = new Set();
    
    for (const service of services) {
        // Direct match
        if (SERVICE_TYPE_MAP[service]) {
            categories.add(SERVICE_TYPE_MAP[service]);
            continue;
        }

        // Partial match (case insensitive)
        const lowerService = service.toLowerCase();
        if (lowerService.includes('coating')) {
            categories.add('coating');
        } else if (lowerService.includes('repaint') || lowerService.includes('cat')) {
            categories.add('repaint');
        } else if (lowerService.includes('detailing') || lowerService.includes('cuci') || lowerService.includes('poles')) {
            categories.add('detailing');
        }
    }

    // Priority Check
    if (categories.has('coating')) return 'coating';
    if (categories.has('repaint')) return 'repaint';
    if (categories.has('detailing')) return 'detailing';

    return null;
}

module.exports = {
    parseServiceType,
    SERVICE_TYPE_MAP
};
