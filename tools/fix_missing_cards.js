const fs = require('fs');

// Read game data
let d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

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

// Read JSON monster data
const monData = JSON.parse(fs.readFileSync('D:/mimo/ro-idle/ro_monster_data/monsters.json', 'utf8'));

// Find monsters with card drops in JSON but not in game
let fixed = 0;

monData.forEach(mon => {
  const id = mon.english_name.toLowerCase().replace(/ /g, '_').replace(/__/g, '_');
  
  // Find the monster in game data
  const searchStr = id + ": {id:'" + id + "'";
  const idx = d.indexOf(searchStr);
  if (idx === -1) return;
  
  // Get the monster's drops section
  const monsterChunk = d.substring(idx, idx + 2000);
  const dropsMatch = monsterChunk.match(/drops:\[([^\]]*)\]/);
  if (!dropsMatch) return;
  
  // Check if already has card
  if (dropsMatch[1].includes('_card')) return;
  
  // Find card drop in JSON
  const cardDrop = mon.drops.find(d => d.name.includes('卡片'));
  if (!cardDrop) return;
  
  const cardId = gameImgToId[cardDrop.item_id];
  if (!cardId) return;
  
  // Add card to drops
  const oldDrops = dropsMatch[1];
  const newDrops = oldDrops + ",{item:'" + cardId + "',chance:0.0001}";
  const oldFull = 'drops:[' + oldDrops + ']';
  const newFull = 'drops:[' + newDrops + ']';
  
  const mainIdx = d.indexOf(oldFull, idx);
  if (mainIdx !== -1) {
    d = d.substring(0, mainIdx) + newFull + d.substring(mainIdx + oldFull.length);
    fixed++;
  }
});

// Write updated file
fs.writeFileSync('D:/mimo/ro-idle/js/data.js', d);

console.log('修正怪物數量: ' + fixed);
