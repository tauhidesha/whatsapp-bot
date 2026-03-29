// Replicating the logic from generateDocumentTool.js lines 122-169
function parseItemsSimulated(finalItems) {
    if (!finalItems || finalItems === '-') return [];

    const itemList = finalItems.split('\n').map(i => i.trim()).filter(Boolean);
    const results = [];

    for (const itemStr of itemList) {
        let name = itemStr;
        let price = 0;
        let desc = '';
        
        if (itemStr.includes('||')) {
            // New format: Name||Price||Description
            const parts = itemStr.split('||');
            name = (parts[0] || '').trim();
            price = parseInt(parts[1]) || 0;
            desc = (parts[2] || '').trim();
        } else {
            // Legacy format: "Name: Price" or just "Name"
            const lastColon = itemStr.lastIndexOf(':');
            if (lastColon > -1) {
                name = itemStr.substring(0, lastColon).trim();
                price = parseInt(itemStr.substring(lastColon + 1).replace(/[^\d]/g, '')) || 0;
            }
        }
        results.push({ name, price, desc });
    }
    return results;
}

const testItems = [
    "Repaint Cover CVT, Arm || 450000",
    "Servis Injeksi || 150000 || Pembersihan injector",
    "Ganti Oli\nRepaint Bodi Halus || 800000",
    "Item Tanpa Harga",
    "Item Dengan Koma, Tapi Tanpa Harga",
    "Multi || Line || Test\nSecond Line || 100"
].join('\n');

console.log("Testing parseItems with input:");
console.log("----------------------------");
console.log(testItems);
console.log("----------------------------\n");

const result = parseItemsSimulated(testItems);

console.log("Result:");
console.log(JSON.stringify(result, null, 2));

const expectedCount = 7;
if (result.length === expectedCount) {
    console.log(`\n✅ Success: Parsed ${result.length} items correctly.`);
} else {
    console.log(`\n❌ Failure: Expected ${expectedCount} items, but got ${result.length}.`);
}

// Check specific cases
const repaintCvt = result.find(i => i.name.includes('Cover CVT, Arm'));
if (repaintCvt && repaintCvt.price === 450000) {
    console.log("✅ Success: 'Repaint Cover CVT, Arm' parsed correctly with price 450000.");
} else {
    console.log("❌ Failure: 'Repaint Cover CVT, Arm' parsing failed.");
}

const multiLine = result.find(i => i.name === 'Multi');
if (multiLine) {
    console.log("✅ Success: Multi-line parsing works.");
}
