const { repaintBodiHalus } = require('../src/data/repaintPrices');

const aliasMap = {};
const duplicateAliases = [];

for (const item of repaintBodiHalus) {
  const modelName = item.model.toLowerCase();
  
  // Model name itself is considered an alias match
  if (aliasMap[modelName]) {
    duplicateAliases.push({ alias: modelName, models: [aliasMap[modelName], item.model] });
  } else {
    aliasMap[modelName] = item.model;
  }
  
  for (const alias of item.aliases || []) {
    const a = alias.toLowerCase();
    if (aliasMap[a] && aliasMap[a] !== item.model) {
      duplicateAliases.push({ alias: a, models: [aliasMap[a], item.model] });
    } else {
      aliasMap[a] = item.model;
    }
  }
}

if (duplicateAliases.length > 0) {
    console.log("Duplicate Aliases found:");
    console.log(duplicateAliases);
} else {
    console.log("No duplicate aliases found.");
}
