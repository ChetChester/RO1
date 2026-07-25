const fs = require('fs');
const d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');
const s = d.indexOf('const ITEMS');
const e = d.indexOf('};', s);
const c = d.substring(s, e + 3);
const lines = c.split('\n');

// Check each line for issues
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Check for double double quotes
  if (line.includes('""')) {
    console.log('Double quote at line ' + (i + 1) + ': ' + line.substring(0, 80));
    break;
  }
  // Check for missing comma before next key
  if (i > 0 && line.match(/^\s+\w+:/) && !lines[i-1].endsWith(',') && !lines[i-1].endsWith('{')) {
    console.log('Missing comma before line ' + (i + 1));
    break;
  }
}
