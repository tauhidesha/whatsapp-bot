const fs = require('fs');
const lines = fs.readFileSync('app.js', 'utf8').split('\n');
let startIdx = 963; // line 964
let bracketCount = 0;
let endIdx = -1;
let started = false;

for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const char of line) {
        if (char === '{') {
            bracketCount++;
            started = true;
        } else if (char === '}') {
            bracketCount--;
        }
    }
    if (started && bracketCount === 0) {
        endIdx = i;
        break;
    }
}
console.log(`Starts at line ${startIdx + 1}`);
console.log(`Ends at line ${endIdx + 1}`);
