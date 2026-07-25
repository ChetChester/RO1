/* 還原怪物 HIT/FLEE 為 ro_monster_data 原始值 */
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
  
  // 使用 ro.dvg.cn 的原始值
  // "100%命中" = 攻擊方需要的 HIT 值才能 100% 命中
  // "95%回避" = 攻擊方需要的 HIT 值才能 95% 命中
  // 怪物 FLEE = 100 + attackerHIT - hitPercentage (RO 公式反推)
  // 對於 "100%命中"=202: FLEE = 175 + 202 - 100 = 277
  // 但這太高了，改用 RO 標準公式: FLEE = 100 + level + AGI
  
  const hit100 = parseInt(stats['100%命中']) || 0;
  const level = parseInt(stats['等级(LV)']) || 1;
  const agi = parseInt(stats['Agi']) || 1;
  const dex = parseInt(stats['Dex']) || 1;
  
  if (hit100 === 0) continue;
  
  // 使用 RO 標準公式
  const monsterHit = 175 + level + dex;
  const monsterFlee = 100 + level + agi;
  
  // 更新遊戲資料中的怪物
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
console.log(`已還原 ${updateCount} 個怪物的 HIT/FLEE 為 RO 標準值`);
