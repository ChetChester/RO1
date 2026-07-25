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

// Build game monster map
const monStart = d.indexOf('const MONSTERS = {');
const monEnd = d.indexOf('\n};', monStart);
const monChunk = d.substring(monStart, monEnd + 3);

// Find and update each monster's drops
let updated = 0;

monData.forEach(mon => {
  const id = mon.english_name.toLowerCase().replace(/ /g, '_');
  
  // Find the monster in game data
  const searchStr = id + ": {id:'" + id + "'";
  const idx = monChunk.indexOf(searchStr);
  if (idx === -1) return;
  
  // Get the monster's drops section
  const monsterChunk = monChunk.substring(idx, idx + 2000);
  const dropsMatch = monsterChunk.match(/drops:\[([^\]]*)\]/);
  if (!dropsMatch) return;
  
  // Build new drops from JSON
  const newDrops = [];
  mon.drops.forEach(d => {
    const gameId = gameImgToId[d.item_id];
    if (gameId) {
      const chance = parseFloat(d.drop_rate) / 100;
      newDrops.push({ item: gameId, chance: chance });
    }
  });
  
  if (newDrops.length === 0) return;
  
  // Build new drops string
  const dropsStr = newDrops.map(d => `{item:'${d.item}',chance:${d.chance}}`).join(',');
  
  // Find old drops in main string
  const oldDropsStr = dropsMatch[1];
  const oldFull = 'drops:[' + oldDropsStr + ']';
  const newFull = 'drops:[' + dropsStr + ']';
  
  // Replace in main string
  const mainIdx = d.indexOf(oldFull, monStart);
  if (mainIdx !== -1) {
    d = d.substring(0, mainIdx) + newFull + d.substring(mainIdx + oldFull.length);
    updated++;
  }
});

// Write updated file
fs.writeFileSync('D:/mimo/ro-idle/js/data.js', d);

console.log('=== 掉落物更新完成 ===');
console.log('更新怪物數量: ' + updated);
