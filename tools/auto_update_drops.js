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

// Build game monster drops map
const monStart = d.indexOf('const MONSTERS = {');
const monEnd = d.indexOf('\n};', monStart);
const monChunk = d.substring(monStart, monEnd + 3);
const gameMonRe = /(\w+):\s*\{id:'([^']+)'[^}]*drops:\[([^\]]*)\]/g;
let gm;
const gameMonDrops = {};
const gameMonPositions = {};
while ((gm = gameMonRe.exec(monChunk)) !== null) {
  const drops = [];
  const dr = /item:'([^']+)'/g;
  let dd;
  while ((dd = dr.exec(gm[3])) !== null) drops.push(dd[1]);
  gameMonDrops[gm[2]] = drops;
  gameMonPositions[gm[2]] = { start: monStart + gm.index, end: monStart + gm.index + gm[0].length };
}

// Update each monster's drops
let updated = 0;
let skipped = 0;

monData.forEach(mon => {
  const id = mon.english_name.toLowerCase().replace(/ /g, '_');
  const gameDrops = gameMonDrops[id];
  if (!gameDrops) return;
  
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
  
  // Find and replace in file
  const pos = gameMonPositions[id];
  if (!pos) return;
  
  const oldDropsStr = gameMonDrops[id].map(item => `{item:'${item}',chance:0.05}`).join(',');
  const oldFull = `drops:[${gameMonDrops[id].map(item => `{item:'${item}',chance:0.05}`).join(',')}]`;
  const newFull = `drops:[${dropsStr}]`;
  
  if (oldFull !== newFull) {
    d = d.replace(oldFull, newFull);
    updated++;
  }
});

// Write updated file
fs.writeFileSync('D:/mimo/ro-idle/js/data.js', d);

console.log('=== 更新完成 ===');
console.log('更新怪物數量: ' + updated);
console.log('跳過怪物數量: ' + skipped);
