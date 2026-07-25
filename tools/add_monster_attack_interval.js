/* 從 ro_monster_data 提取怪物攻擊間隔並更新遊戲資料 */
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
  
  // 提取攻擊間隔（秒）
  const attackInterval = parseFloat(stats['反击间隔']) || 1.0;
  
  if (attackInterval === 0) continue;
  
  // 更新遊戲資料中的怪物
  const insertRegex = new RegExp(`(${gameId}:\\s*\\{[^}]*level:(\\d+)[^}]*)(})`);
  const insertMatch = data.match(insertRegex);
  if (insertMatch) {
    const existing = insertMatch[0];
    // 檢查是否已有 atkInterval
    if (!existing.includes('atkInterval:')) {
      const replacement = existing.replace('}', `,atkInterval:${attackInterval}}`);
      data = data.replace(existing, replacement);
      updateCount++;
    }
  }
}

fs.writeFileSync(dataPath, data, 'utf8');
console.log(`已更新 ${updateCount} 個怪物的攻擊間隔`);
