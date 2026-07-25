const fs = require('fs');
let d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// Find CARDS section
const carStart = d.indexOf('const CARDS = {');
const carEnd = d.indexOf('\n};', carStart);

if (carStart === -1 || carEnd === -1) {
  console.log('CARDS section not found');
  process.exit(1);
}

const carChunk = d.substring(carStart, carEnd + 3);
const lines = carChunk.split('\n');

// Remove corrupted lines (missing key names and multi-line strings)
const fixedLines = [];
lines.forEach((line, idx) => {
  // Skip lines that start with "  :" (missing key name)
  if (line.match(/^\s+:\s*\{/)) return;
  // Skip lines that contain <br>
  if (line.includes('<br>')) return;
  fixedLines.push(line);
});

// Reconstruct the file
const newContent = d.substring(0, carStart) + fixedLines.join('\n') + d.substring(carEnd);

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', newContent);
console.log('Fixed CARDS section');
