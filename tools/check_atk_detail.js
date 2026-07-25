/* 檢查幾個怪物的攻擊間隔細節 */
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

// 檢查幾個怪物的詳細資訊
const checkMonsters = ['poring', 'fabre', 'hornet', 'wolf', 'scorpion', 'zombie'];

console.log('怪物攻擊間隔詳細:');
for (const monster of raw) {
  const gameId = imgIdMap[monster.id];
  if (!gameId || !checkMonsters.includes(gameId)) continue;
  
  const stats = monster.stats;
  if (!stats) continue;
  
  const level = parseInt(stats['等级(LV)']) || 0;
  const atkInterval = stats['反击间隔'];
  const atkSpeed = stats['攻击速度'];
  
  console.log(`${gameId} (Lv.${level}):`);
  console.log(`  反击间隔: ${atkInterval} 秒`);
  console.log(`  攻击速度: ${atkSpeed}`);
  
  // 從遊戲資料中提取
  const gameRegex = new RegExp(gameId + ':\\s*\\{[^}]+\\}');
  const gameMatch = data.match(gameRegex);
  if (gameMatch) {
    const intervalMatch = gameMatch[0].match(/atkInterval:([\d.]+)/);
    if (intervalMatch) {
      console.log(`  遊戲 atkInterval: ${intervalMatch[1]} 秒`);
      console.log(`  一致: ${intervalMatch[1] === atkInterval ? '✓' : '✗'}`);
    }
  }
}
