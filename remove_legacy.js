const fs = require('fs');

function removeLines(file, start, end) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const newLines = [...lines.slice(0, start - 1), ...lines.slice(end)];
    fs.writeFileSync(file, newLines.join('\n'));
    console.log(`Removed lines ${start} to ${end} from ${file}.`);
}

removeLines('app.js', 964, 1596);
