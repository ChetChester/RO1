const fs = require('fs');
let d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// Find ITEMS section
const itemStart = d.indexOf('const ITEMS = {');
const itemEnd = d.indexOf('\n};', itemStart);

if (itemStart === -1 || itemEnd === -1) {
  console.log('ITEMS section not found');
  process.exit(1);
}

const itemChunk = d.substring(itemStart, itemEnd + 3);
const lines = itemChunk.split('\n');

const fixedLines = [];

lines.forEach((line, idx) => {
  if (idx === 0) {
    // First line is just "const ITEMS = {"
    fixedLines.push(line);
    return;
  }
  
  // Try to parse each item line
  // Pattern: key: {json_object}
  const match = line.match(/^\s+(\w+):\s*(.+)$/);
  if (!match) {
    fixedLines.push(line);
    return;
  }
  
  const key = match[1];
  let jsonStr = match[2];
  
  // Remove trailing comma if present
  jsonStr = jsonStr.replace(/,\s*$/, '');
  
  // Fix common quote issues
  // Pattern 1: 'id':"xxx" -> "id":"xxx"
  jsonStr = jsonStr.replace(/'id':"([^"]*)"/g, '"id":"$1"');
  jsonStr = jsonStr.replace(/"id"':'([^']*)'/g, '"id":"$1"');
  jsonStr = jsonStr.replace(/"id":"([^"]*)"/g, '"id":"$1"');
  
  // Pattern 2: imgId
  jsonStr = jsonStr.replace(/'imgId':(\d+)/g, '"imgId":$1');
  jsonStr = jsonStr.replace(/"imgId"':(\d+)/g, '"imgId":$1');
  jsonStr = jsonStr.replace(/"imgId":(\d+)/g, '"imgId":$1');
  
  // Pattern 3: shop
  jsonStr = jsonStr.replace(/'shop':true/g, '"shop":true');
  jsonStr = jsonStr.replace(/"shop"':true/g, '"shop":true');
  jsonStr = jsonStr.replace(/"shop":true/g, '"shop":true');
  
  // Pattern 4: name
  jsonStr = jsonStr.replace(/'name':"([^"]*)"/g, '"name":"$1"');
  jsonStr = jsonStr.replace(/"name"':'([^']*)'/g, '"name":"$1"');
  jsonStr = jsonStr.replace(/"name":"([^"]*)"/g, '"name":"$1"');
  
  // Pattern 5: type
  jsonStr = jsonStr.replace(/'type':"([^"]*)"/g, '"type":"$1"');
  jsonStr = jsonStr.replace(/"type"':'([^']*)'/g, '"type":"$1"');
  jsonStr = jsonStr.replace(/"type":"([^"]*)"/g, '"type":"$1"');
  
  // Pattern 6: icon
  jsonStr = jsonStr.replace(/'icon':"([^"]*)"/g, '"icon":"$1"');
  jsonStr = jsonStr.replace(/"icon"':'([^']*)'/g, '"icon":"$1"');
  jsonStr = jsonStr.replace(/"icon":"([^"]*)"/g, '"icon":"$1"');
  
  // Pattern 7: weight
  jsonStr = jsonStr.replace(/'weight':(\d+)/g, '"weight":$1');
  jsonStr = jsonStr.replace(/"weight"':(\d+)/g, '"weight":$1');
  jsonStr = jsonStr.replace(/"weight":(\d+)/g, '"weight":$1');
  
  // Pattern 8: sell
  jsonStr = jsonStr.replace(/'sell':(\d+)/g, '"sell":$1');
  jsonStr = jsonStr.replace(/"sell"':(\d+)/g, '"sell":$1');
  jsonStr = jsonStr.replace(/"sell":(\d+)/g, '"sell":$1');
  
  // Pattern 9: buyPrice
  jsonStr = jsonStr.replace(/'buyPrice':(\d+)/g, '"buyPrice":$1');
  jsonStr = jsonStr.replace(/"buyPrice"':(\d+)/g, '"buyPrice":$1');
  jsonStr = jsonStr.replace(/"buyPrice":(\d+)/g, '"buyPrice":$1');
  
  // Pattern 10: desc - fix escaped quotes
  jsonStr = jsonStr.replace(/'desc':"([^"]*)"/g, '"desc":"$1"');
  jsonStr = jsonStr.replace(/"desc"':'([^']*)'/g, '"desc":"$1"');
  jsonStr = jsonStr.replace(/"desc":"([^"]*)"/g, '"desc":"$1"');
  
  // Remove any remaining single quotes around values
  jsonStr = jsonStr.replace(/"([^"]*)"/g, '"$1"');
  
  fixedLines.push(`  ${key}: ${jsonStr}`);
});

// Reconstruct the file
const newContent = d.substring(0, itemStart) + fixedLines.join('\n') + d.substring(itemEnd);

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', newContent);
console.log('Rebuilt ITEMS section');
