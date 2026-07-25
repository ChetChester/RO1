const fs = require('fs');
let d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// Find ITEMS section
const itemStart = d.indexOf('const ITEMS = {');
const itemEnd = d.indexOf('\n};', itemStart);

if (itemStart === -1 || itemEnd === -1) {
  console.log('ITEMS section not found');
  process.exit(1);
}

// Get ITEMS content
const before = d.substring(0, itemStart);
const itemsSection = d.substring(itemStart, itemEnd + 3);
const after = d.substring(itemEnd);

// Fix desc fields - remove or escape special characters
let fixedItems = itemsSection;

// Remove lines with problematic desc fields (containing special quotes or multi-line)
const lines = fixedItems.split('\n');
const fixedLines = [];

lines.forEach((line, idx) => {
  // Skip lines with problematic desc fields
  if (line.includes("'") && line.includes("desc:")) {
    // Try to fix by removing the problematic desc
    const descMatch = line.match(/"desc":"([^"]*)"/);
    if (descMatch && descMatch[1].includes("'")) {
      // Remove the desc field
      line = line.replace(/,"desc":"[^"]*"/, '');
    }
  }
  fixedLines.push(line);
});

// Reconstruct file
d = before + fixedLines.join('\n') + after;

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', d);
console.log('Fixed desc fields');
