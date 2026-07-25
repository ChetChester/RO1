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

// Fix each line in ITEMS
const lines = itemsSection.split('\n');
const fixedLines = [];

lines.forEach((line, idx) => {
  // Skip the first line (const ITEMS = {)
  if (idx === 0) {
    fixedLines.push(line);
    return;
  }
  
  // Skip empty lines
  if (!line.trim()) {
    fixedLines.push(line);
    return;
  }
  
  // Try to parse the line as a key-value pair
  const match = line.match(/^\s+(\w+):\s*(.+)$/);
  if (!match) {
    fixedLines.push(line);
    return;
  }
  
  const key = match[1];
  let value = match[2];
  
  // Remove trailing comma
  value = value.replace(/,\s*$/, '');
  
  // Fix desc field - remove everything after desc:
  const descIdx = value.indexOf('"desc":');
  if (descIdx !== -1) {
    // Find the closing quote of desc
    let descEnd = descIdx + 7;
    let quoteCount = 0;
    let inDesc = false;
    for (let i = descIdx + 7; i < value.length; i++) {
      if (value[i] === '"') {
        quoteCount++;
        if (quoteCount % 2 === 1) {
          inDesc = true;
        } else {
          inDesc = false;
        }
      }
      if (inDesc && value[i] === '"') {
        // Check if this is the end of desc
        if (i + 1 < value.length && (value[i + 1] === ',' || value[i + 1] === '}')) {
          descEnd = i + 1;
          break;
        }
      }
    }
    value = value.substring(0, descEnd) + '}';
  }
  
  fixedLines.push(`  ${key}: ${value}`);
});

// Reconstruct file
d = before + fixedLines.join('\n') + after;

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', d);
console.log('Aggressively fixed ITEMS');
