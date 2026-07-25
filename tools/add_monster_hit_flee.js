/* 從 ro_monster_data 提取怪物 HIT/FLEE 並更新遊戲資料 */
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

// 從 rAthena mob_db 提取的怪物 HIT/FLEE 公式:
// Monster HIT = 175 + level + DEX (簡化公式)
// Monster FLEE = 100 + level + AGI (簡化公式)
// 但 ro.dvg.cn 的資料更準確，直接用 "100%命中" 和 "95%回避" 反推:
//   hit100 = attackerHIT + 175 - monsterFLEE → monsterFLEE = attackerHIT + 175 - 100
//   hit95 = attackerHIT + 175 - monsterFLEE → monsterFLEE = attackerHIT + 175 - 95

let updateCount = 0;

for (const monster of raw) {
  const gameId = imgIdMap[monster.id];
  if (!gameId) continue;
  
  const stats = monster.stats;
  if (!stats) continue;
  
  // 提取 HIT 和 FLEE
  const hit100 = parseInt(stats['100%命中']) || 0;
  const flee95 = parseInt(stats['95%回避']) || 0;
  const level = parseInt(stats['等级(LV)']) || 1;
  const agi = parseInt(stats['Agi']) || 1;
  const dex = parseInt(stats['Dex']) || 1;
  
  if (hit100 === 0 && flee95 === 0) continue;
  
  // 計算怪物 HIT 和 FLEE
  // 從 hit100 反推: monsterFLEE = hit100 + 175 - 100 = hit100 + 75
  const monsterFlee = hit100 > 0 ? hit100 + 75 : 100 + level + agi;
  // 從 flee95 反推: monsterHIT = flee95 - 175 + 95 = flee95 - 80
  const monsterHit = flee95 > 0 ? flee95 - 80 : 175 + level + dex;
  
  // 更新遊戲資料中的怪物
  const gameRegex = new RegExp(`(${gameId}:\\s*\\{[^}]*)level:(\\d+)`);
  const match = data.match(gameRegex);
  if (!match) continue;
  
  // 在怪物資料中加入 hit 和 flee
  const insertRegex = new RegExp(`(${gameId}:\\s*\\{[^}]*level:(\\d+)[^}]*)(})`);
  const insertMatch = data.match(insertRegex);
  if (insertMatch) {
    const existing = insertMatch[0];
    // 檢查是否已有 hit/flee
    if (!existing.includes('hit:') && !existing.includes('flee:')) {
      const replacement = existing.replace('}', `,hit:${monsterHit},flee:${monsterFlee}}`);
      data = data.replace(existing, replacement);
      updateCount++;
    }
  }
}

fs.writeFileSync(dataPath, data, 'utf8');
console.log(`已更新 ${updateCount} 個怪物的 HIT/FLEE`);
