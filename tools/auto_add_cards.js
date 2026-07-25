const fs = require('fs');

// Read game data
let d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// Read cards JSON
const cardsData = JSON.parse(fs.readFileSync('D:/mimo/ro-idle/ro_cards_data/cards.json', 'utf8'));

// Build item ID mapping (imgId -> game id)
const itemStart = d.indexOf('const ITEMS = {');
const itemEnd = d.indexOf('\n};', itemStart);
const itemChunk = d.substring(itemStart, itemEnd + 3);
const gameImgToId = {};
const lines = itemChunk.split('\n');
lines.forEach(l => {
  const m = l.match(/imgId.:(\d+)/);
  const n = l.match(/id.:.(.+?).,/);
  if (m && n) gameImgToId[m[1]] = n[1];
});

// Get existing cards
const cardStart = d.indexOf('const CARDS = {');
const cardEnd = d.indexOf('\n};', cardStart);
const cardChunk = d.substring(cardStart, cardEnd + 3);
const existingCards = new Set();
const cr = /^\s+(\w+):\s*\{/gm;
let cm;
while ((cm = cr.exec(cardChunk)) !== null) existingCards.add(cm[1]);

// Add missing cards
let added = 0;
const newCards = [];

cardsData.forEach(card => {
  const gameId = gameImgToId[card.id.toString()];
  if (!gameId || existingCards.has(gameId)) return;
  
  // Parse attributes
  const bonus = {};
  card.attributes.forEach(attr => {
    if (attr.startsWith('[')) return; // skip slot type
    const match = attr.match(/(\w+)\+(\d+)/);
    if (match) {
      const stat = match[1].toLowerCase();
      const value = parseInt(match[2]);
      if (['str', 'agi', 'vit', 'int', 'dex', 'luk'].includes(stat)) {
        bonus[stat] = value;
      } else if (stat === 'atk') {
        bonus.atk = value;
      } else if (stat === 'def') {
        bonus.def = value;
      } else if (stat === 'hit') {
        bonus.hit = value;
      } else if (stat === 'flee') {
        bonus.flee = value;
      } else if (stat === 'critrate' || stat === 'cri') {
        bonus.critRate = value;
      }
    }
  });
  
  const bonusStr = Object.keys(bonus).length > 0 ? JSON.stringify(bonus) : '{}';
  const cardEntry = `  ${gameId}: { id: '${gameId}', monsterId: '${gameId.replace('_card', '')}', name: '${card.name}', icon: '🃏', slot: 'any', bonus: ${bonusStr}, desc: '${card.attributes.join(', ')}' },`;
  
  newCards.push(cardEntry);
  added++;
});

// Insert new cards before the closing of CARDS object
const insertPoint = cardEnd;
d = d.substring(0, insertPoint) + '\n' + newCards.join('\n') + d.substring(insertPoint);

// Write updated file
fs.writeFileSync('D:/mimo/ro-idle/js/data.js', d);

console.log('=== 卡片更新完成 ===');
console.log('新增卡片數量: ' + added);
console.log('現有卡片數量: ' + existingCards.size);
