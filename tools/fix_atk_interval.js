/* 修正怪物攻擊間隔：使用攻击速度計算 */
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
  
  // 使用攻击速度計算攻擊間隔
  // 攻击速度格式: "1.26 次/秒"
  const atkSpeedStr = stats['攻击速度'];
  if (!atkSpeedStr) continue;
  
  const atkSpeedMatch = atkSpeedStr.match(/([\d.]+)/);
  if (!atkSpeedMatch) continue;
  
  const atkSpeed = parseFloat(atkSpeedMatch[1]);
  if (atkSpeed <= 0) continue;
  
  // 計算攻擊間隔（秒）
  const atkInterval = 1 / atkSpeed;
  
  // 更新遊戲資料中的怪物
  const pattern = new RegExp(`(${gameId}:\\s*\\{[^}]*?)atkInterval:[\\d.]+`);
  if (data.match(pattern)) {
    data = data.replace(pattern, `$1atkInterval:${atkInterval.toFixed(2)}`);
    updateCount++;
  }
}

fs.writeFileSync(dataPath, data, 'utf8');
console.log(`已修正 ${updateCount} 個怪物的攻擊間隔`);
