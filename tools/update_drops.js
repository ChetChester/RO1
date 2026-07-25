const fs = require('fs');

// Read game data
const d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

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
while ((gm = gameMonRe.exec(monChunk)) !== null) {
  const drops = [];
  const dr = /item:'([^']+)'/g;
  let dd;
  while ((dd = dr.exec(gm[3])) !== null) drops.push(dd[1]);
  gameMonDrops[gm[2]] = drops;
}

// Compare and report
let totalMissing = 0;
let totalExtra = 0;
const updates = [];

monData.forEach(mon => {
  const id = mon.english_name.toLowerCase().replace(/ /g, '_');
  const gameDrops = gameMonDrops[id];
  if (!gameDrops) return;
  
  const jsonDrops = mon.drops.map(d => gameImgToId[d.item_id]).filter(x => x);
  const gameSet = new Set(gameDrops);
  const jsonSet = new Set(jsonDrops);
  
  const missing = [...jsonSet].filter(x => !gameSet.has(x));
  const extra = [...gameSet].filter(x => !jsonSet.has(x));
  
  if (missing.length > 0 || extra.length > 0) {
    totalMissing += missing.length;
    totalExtra += extra.length;
    updates.push({ id, missing, extra });
  }
});

console.log('=== 掉落物差異統計 ===');
console.log('缺少: ' + totalMissing + ' 個');
console.log('多餘: ' + totalExtra + ' 個');
console.log('');
console.log('=== 需要更新的怪物 ===');
updates.forEach(u => {
  console.log(u.id + ':');
  if (u.missing.length > 0) console.log('  缺少: ' + u.missing.join(', '));
  if (u.extra.length > 0) console.log('  多餘: ' + u.extra.join(', '));
});
