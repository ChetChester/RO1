/* 比對遊戲與 ro_monster_data 的攻擊間隔 */
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_monster_data', 'monsters.json'), 'utf8'));
const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

// 建立 imgId → monsterId 對照
const imgIdMap = {};
const regex = /(\w+):\s*\{[^}]*imgId:(\d+)[^}]*\}/g;
let m;
while ((m = regex.exec(data)) !== null) {
  imgIdMap[parseInt(m[2])] = m[1];
}

// 比對所有怪物
let match = 0, mismatch = 0, missing = 0;

for (const monster of raw) {
  const gameId = imgIdMap[monster.id];
  if (!gameId) continue;
  
  const stats = monster.stats;
  if (!stats) continue;
  
  const originalInterval = parseFloat(stats['反击间隔']) || null;
  if (originalInterval === null) continue;
  
  // 從遊戲資料中提取 atkInterval
  const gameRegex = new RegExp(gameId + ':\\s*\\{[^}]+\\}');
  const gameMatch = data.match(gameRegex);
  if (!gameMatch) {
    missing++;
    continue;
  }
  
  const intervalMatch = gameMatch[0].match(/atkInterval:([\d.]+)/);
  if (!intervalMatch) {
    missing++;
    continue;
  }
  
  const gameInterval = parseFloat(intervalMatch[1]);
  
  if (Math.abs(originalInterval - gameInterval) < 0.01) {
    match++;
  } else {
    mismatch++;
    if (mismatch <= 5) {
      console.log(`${gameId}: 原始=${originalInterval} 遊戲=${gameInterval}`);
    }
  }
}

console.log(`\n比對結果:`);
console.log(`  一致: ${match}`);
console.log(`  不一致: ${mismatch}`);
console.log(`  缺少: ${missing}`);
