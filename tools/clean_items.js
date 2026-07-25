const fs = require('fs');
let d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// Remove all lines that start with "null: {" (corrupted entries)
const lines = d.split('\n');
const fixedLines = [];
let removed = 0;

lines.forEach(line => {
  if (line.match(/^\s+null:\s*\{/)) {
    removed++;
    return;
  }
  fixedLines.push(line);
});

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', fixedLines.join('\n'));
console.log('Removed ' + removed + ' null entries');
