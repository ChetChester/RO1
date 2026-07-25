/* ============================================================
   怪物掉寶資料轉換工具
   將 ro_monster_data/monsters.json 的掉落資料合併到 data.js
   
   使用方式：node tools/convert_drops.js
   輸出：更新 data.js 中的 MONSTERS 區塊
   ============================================================ */

const fs = require('fs');
const path = require('path');

// ---- 讀取資料 ----
const rawMonsters = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'ro_monster_data', 'monsters.json'), 'utf8')
);
const itemMap = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'item_id_map.json'), 'utf8')
);
const dataPath = path.join(__dirname, '..', 'js', 'data.js');
let data = fs.readFileSync(dataPath, 'utf8');

console.log(`已載入 ${rawMonsters.length} 個原始怪物`);
console.log(`已載入 ${Object.keys(itemMap).length} 個物品對照`);

// ---- 從 data.js 提取現有怪物的 imgId → monsterId 對照 ----
const monsterImgIdMap = {};
const monsterRegex = /(\w+):\s*\{[^}]*imgId:(\d+)[^}]*\}/g;
let m;
while ((m = monsterRegex.exec(data)) !== null) {
  monsterImgIdMap[parseInt(m[2])] = m[1];
}
console.log(`已載入 ${Object.keys(monsterImgIdMap).length} 個怪物 imgId 對照`);

// ---- 轉換掉落率 ----
function parseDropRate(rateStr) {
  // "0.35%" → 0.0035
  // "27.5%" → 0.275
  // "5%" → 0.05
  if (!rateStr) return 0;
  const num = parseFloat(rateStr.replace('%', ''));
  return isNaN(num) ? 0 : num / 100;
}

// ---- 主轉換邏輯 ----
const stats = { total: 0, hasDrops: 0, converted: 0, skipped: 0, unmappedItems: 0 };
const dropUpdates = {}; // monsterId → drops array

for (const monster of rawMonsters) {
  stats.total++;
  
  // 找對應的遊戲怪物 ID
  const gameId = monsterImgIdMap[monster.id];
  if (!gameId) continue; // 遊戲中不存在的怪物
  
  if (!monster.drops || monster.drops.length === 0) continue;
  stats.hasDrops++;
  
  const drops = [];
  for (const drop of monster.drops) {
    // 跳過卡片掉落（已由卡片系統處理）
    if (drop.item_id >= 4001 && drop.item_id <= 4999) continue;
    
    // 映射 item_id → 遊戲 itemId
    const itemId = itemMap[drop.item_id];
    if (!itemId) {
      stats.unmappedItems++;
      continue;
    }
    
    const chance = parseDropRate(drop.drop_rate);
    if (chance <= 0) continue;
    
    drops.push({ item: itemId, chance: chance });
    stats.converted++;
  }
  
  if (drops.length > 0) {
    dropUpdates[gameId] = drops;
  }
}

console.log(`\n轉換完成！`);
console.log(`  原始怪物: ${stats.total}`);
console.log(`  有掉落: ${stats.hasDrops}`);
console.log(`  已轉換掉落: ${stats.converted}`);
console.log(`  無對照物品: ${stats.unmappedItems}`);
console.log(`  更新怪物數: ${Object.keys(dropUpdates).length}`);

// ---- 更新 data.js ----
let updateCount = 0;
for (const [monsterId, drops] of Object.entries(dropUpdates)) {
  // 找到怪物在 data.js 中的位置
  const pattern = new RegExp(`(${monsterId}:\\s*\\{[^}]*?)drops:\\[([^\\]]*)\\]`);
  const match = data.match(pattern);
  
  if (match) {
    const dropsStr = drops.map(d => `{item:'${d.item}',chance:${d.chance}}`).join(',');
    const oldDrops = match[2].trim();
    
    // 只在有新資料時更新
    if (oldDrops === '' || drops.length > oldDrops.split(',').length) {
      data = data.replace(match[0], match[1] + 'drops:[' + dropsStr + ']');
      updateCount++;
    }
  }
}

fs.writeFileSync(dataPath, data, 'utf8');
console.log(`\n已更新 data.js 中 ${updateCount} 個怪物的掉落資料`);

// ---- 統計更新後的掉落 ----
const finalDrops = data.match(/drops:\[[^\]]+\]/g) || [];
const withDrops = finalDrops.filter(d => d !== 'drops:[]').length;
console.log(`更新後有掉落的怪物: ${withDrops}`);
