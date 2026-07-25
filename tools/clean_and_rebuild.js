const fs = require('fs');

// Step 1: Read current file
let d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// Step 2: Find ITEMS section and remove it entirely
const itemStart = d.indexOf('const ITEMS = {');
const itemEnd = d.indexOf('\n};', itemStart);

if (itemStart === -1) {
  console.log('ITEMS section not found');
  process.exit(1);
}

// Find the end of ITEMS (look for next const or function)
let realEnd = itemEnd;
const afterItems = d.substring(itemEnd, itemEnd + 200);
if (afterItems.includes('const ') || afterItems.includes('function ')) {
  realEnd = itemEnd;
} else {
  // Try to find the actual end
  const nextConst = d.indexOf('\nconst ', itemEnd);
  const nextFunc = d.indexOf('\nfunction ', itemEnd);
  if (nextConst !== -1 && (nextFunc === -1 || nextConst < nextFunc)) {
    realEnd = nextConst;
  } else if (nextFunc !== -1) {
    realEnd = nextFunc;
  }
}

// Remove ITEMS section
const before = d.substring(0, itemStart);
const after = d.substring(realEnd);
d = before + after;

// Step 3: Read items.json and generate new ITEMS
const itemsData = JSON.parse(fs.readFileSync('D:/mimo/ro-idle/ro_items_data/items.json', 'utf8'));

const items = [];
const seen = new Set();

itemsData.forEach(item => {
  // Create game ID from English name
  let gameId = item.english_name.toLowerCase().replace(/ /g, '_').replace(/__/g, '_');
  
  // Skip null entries and duplicates
  if (!gameId || gameId === 'null' || seen.has(gameId)) return;
  seen.add(gameId);
  
  // Clean description
  let desc = item.description || '';
  desc = desc.replace(/<br\/>/g, ' ');
  desc = desc.replace(/<br>/g, ' ');
  desc = desc.replace(/<span[^>]*>/g, '');
  desc = desc.replace(/<\/span>/g, '');
  desc = desc.replace(/\n/g, ' ');
  desc = desc.replace(/"/g, '\\"');
  if (desc.length > 100) desc = desc.substring(0, 100);
  
  // Determine type based on item
  let type = 'material';
  if (item.weight && parseInt(item.weight) === 0) type = 'consumable';
  
  items.push(`  ${gameId}: {"id":"${gameId}","imgId":${item.id},"name":"${item.name}","type":"${type}","icon":"📦","weight":${parseInt(item.weight) || 1},"sell":1,"desc":"${desc}"}`);
});

// Step 4: Build new file
const newItems = 'const ITEMS = {\n' + items.join(',\n') + '\n};\n\n';
d = before + newItems + after;

// Step 5: Write file
fs.writeFileSync('D:/mimo/ro-idle/js/data.js', d);

console.log('Rebuilt ITEMS with ' + items.length + ' items');
