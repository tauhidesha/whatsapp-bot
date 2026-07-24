/**
 * Helper to determine salutation ('mas' vs 'kak') based on customer name.
 * Rule: If name indicates a male/guy, return 'mas'. If female, ambiguous, or empty, return 'kak'.
 */
function getSalutation(name) {
    if (!name || typeof name !== 'string') return 'kak';
    const nameLower = name.toLowerCase().trim();
    
    // Male indicators & common Indonesian male name tokens
    const maleNames = [
        'budi', 'xl', 'andi', 'rian', 'rizky', 'risky', 'dimas', 'bayu', 'fajar', 
        'agus', 'hendra', 'dika', 'dani', 'reza', 'gilang', 'wahyu', 'irfan', 'fikri', 
        'doni', 'bagus', 'yoga', 'satria', 'ilham', 'fauzi', 'aris', 'taufik', 'roni',
        'anton', 'bambang', 'danang', 'aditya', 'adit', 'alvin', 'alamsyah', 'anugerah',
        'arif', 'arifin', 'arya', 'bintang', 'candra', 'chandra', 'darma', 'dewa',
        'dharma', 'dicky', 'didi', 'fadel', 'fadil', 'fahmi', 'faisal',
        'farhan', 'ferry', 'firman', 'hafiz', 'hanif', 'hadi', 'hari', 'heru', 'hidayat',
        'indra', 'irwan', 'joko', 'kiki', 'krisna', 'luthfi', 'martha', 'maulana',
        'miki', 'nugroho', 'nanda', 'okta', 'panji', 'pratama', 'putra', 'raden',
        'rahmat', 'rama', 'randy', 'rendy', 'rio', 'rivaldi', 'robert',
        'rudi', 'rudy', 'syahrul', 'teguh', 'tri', 'utomo', 'vicky', 'wibowo',
        'wawan', 'yudi', 'yusuf', 'zacky', 'zainal', 'bro', 'bos', 'om', 'gan'
    ];
    
    const tokens = nameLower.split(/\s+/);
    const isMale = tokens.some(t => maleNames.includes(t));
    
    return isMale ? 'mas' : 'kak';
}

function getDisplayName(name) {
    if (!name || typeof name !== 'string' || name.toLowerCase().trim() === 'customer') {
        return 'kak';
    }
    const salutation = getSalutation(name);
    const firstName = name.trim().split(/\s+/)[0];
    return `${salutation} ${firstName}`;
}

module.exports = {
    getSalutation,
    getDisplayName
};
