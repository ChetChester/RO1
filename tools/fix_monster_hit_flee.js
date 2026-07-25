/* 直接修正怪物 FLEE 值 */
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_monster_data', 'monsters.json'), 'utf8'));
const dataPath = path.join(__dirname, '..', 'js', 'data.js');
let data = fs.readFileSync(dataPath, 'utf8');

// 建立 imgId → monsterId 對照
const imgIdMap = {};
const regex = /(\w+):\s*\{[^}]*imgId:(\d+)[^}]*\}/g;
let m;
while ((m = regex.exec(data)) !== null) {
  imgIdMap[parseInt(m[2])] = m[1];
}

let updateCount = 0;

for (const monster of raw) {
  const gameId = imgIdMap[monster.id];
  if (!gameId) continue;
  
  const stats = monster.stats;
  if (!stats) continue;
  
  const level = parseInt(stats['等级(LV)']) || 1;
  const agi = parseInt(stats['Agi']) || 1;
  const dex = parseInt(stats['Dex']) || 1;
  
  // 正確的 HIT/FLEE 計算 (RO 公式)
  const monsterHit = 175 + level + dex;
  const monsterFlee = 100 + level + agi;
  
  // 更新遊戲資料中的怪物
  // 使用更精確的替換
  const pattern = new RegExp(`(${gameId}:\\s*\\{[^}]*?)hit:\\d+`);
  if (data.match(pattern)) {
    data = data.replace(pattern, `$1hit:${monsterHit}`);
  }
  
  const pattern2 = new RegExp(`(${gameId}:\\s*\\{[^}]*?)flee:\\d+`);
  if (data.match(pattern2)) {
    data = data.replace(pattern2, `$1flee:${monsterFlee}`);
    updateCount++;
  }
}

fs.writeFileSync(dataPath, data, 'utf8');
console.log(`已修正 ${updateCount} 個怪物的 HIT/FLEE`);
