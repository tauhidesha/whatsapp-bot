const { repaintBodiHalus, VELG_PRICE_MAP } = require('../src/data/repaintPrices');

const modelCount = {};
const duplicates = [];

for (const item of repaintBodiHalus) {
  const modelName = item.model.toLowerCase();
  if (modelCount[modelName]) {
    modelCount[modelName]++;
    if (modelCount[modelName] === 2) {
      duplicates.push(modelName);
    }
  } else {
    modelCount[modelName] = 1;
  }
}

console.log("Duplicate Models in repaintBodiHalus:", duplicates);

const velgKeys = Object.keys(VELG_PRICE_MAP);
const velgSet = new Set();
const velgDuplicates = [];
for (const k of velgKeys) {
  const key = k.toLowerCase();
  if (velgSet.has(key)) {
    velgDuplicates.push(key);
  }
  velgSet.add(key);
}

console.log("Duplicate Keys in VELG_PRICE_MAP:", velgDuplicates);
