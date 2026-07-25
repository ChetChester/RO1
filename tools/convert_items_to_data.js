const fs = require('fs');

// Read items.json
const itemsData = JSON.parse(fs.readFileSync('D:/mimo/ro-idle/ro_items_data/items.json', 'utf8'));

// Read current data.js
let d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// Find ITEMS section
const itemStart = d.indexOf('const ITEMS = {');
const itemEnd = d.indexOf('\n};', itemStart);

if (itemStart === -1 || itemEnd === -1) {
  console.log('ITEMS section not found');
  process.exit(1);
}

// Build new ITEMS object
const items = [];

itemsData.forEach(item => {
  // Create game ID from English name
  const gameId = item.english_name.toLowerCase().replace(/ /g, '_').replace(/__/g, '_');
  
  // Build item entry
  const entry = {
    id: gameId,
    imgId: item.id,
    name: item.name,
    type: 'material',
    icon: '📦',
    weight: parseInt(item.weight) || 1,
    sell: 1,
    desc: item.description.replace(/<br\/>/g, '').replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '').substring(0, 100)
  };
  
  items.push(`  ${gameId}: {"id":"${gameId}","imgId":${item.id},"name":"${entry.name}","type":"${entry.type}","icon":"${entry.icon}","weight":${entry.weight},"sell":${entry.sell},"desc":"${entry.desc}"}`);
});

// Build new ITEMS string
const newItems = 'const ITEMS = {\n' + items.join(',\n') + '\n};';

// Replace old ITEMS section
d = d.substring(0, itemStart) + newItems + d.substring(itemEnd);

// Write updated file
fs.writeFileSync('D:/mimo/ro-idle/js/data.js', d);

console.log('Rebuilt ITEMS with ' + items.length + ' items');
