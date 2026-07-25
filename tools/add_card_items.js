const fs = require('fs');

// Read game data
let d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// Read cards JSON
const cardsData = JSON.parse(fs.readFileSync('D:/mimo/ro-idle/ro_cards_data/cards.json', 'utf8'));

// Build existing items map (imgId -> game id)
const itemStart = d.indexOf('const ITEMS = {');
const itemEnd = d.indexOf('\n};', itemStart);
const itemChunk = d.substring(itemStart, itemEnd + 3);
const existingItems = new Set();
const lines = itemChunk.split('\n');
lines.forEach(l => {
  const m = l.match(/imgId.:(\d+)/);
  if (m) existingItems.add(m[1]);
});

// Add missing card items
let added = 0;
const newItems = [];

cardsData.forEach(card => {
  if (existingItems.has(card.id.toString())) return;
  
  // Create game ID from English name (handle double underscores)
  const gameId = card.english_name.toLowerCase().replace(/ /g, '_').replace(/__/g, '_');
  
  // Create item entry
  const itemEntry = `  ${gameId}: {"id":"${gameId}","imgId":${card.id},"name":"${card.name}","type":"material","icon":"📦","weight":1,"sell":1,"desc":"${card.attributes.join(', ')}"}`;
  
  newItems.push(itemEntry);
  added++;
});

// Insert new items before the closing of ITEMS object
const insertPoint = itemEnd;
d = d.substring(0, insertPoint) + '\n' + newItems.join('\n') + d.substring(insertPoint);

// Write updated file
fs.writeFileSync('D:/mimo/ro-idle/js/data.js', d);

console.log('新增卡片物品數量: ' + added);
