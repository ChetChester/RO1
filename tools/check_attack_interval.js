/* 檢查怪物攻擊間隔是否與 ro_monster_data 一致 */
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_monster_data', 'monsters.json'), 'utf8'));
const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 建立 imgId → monsterId 對照
const imgIdMap = {};
const regex = /(\w+):\s*\{[^}]*imgId:(\d+)[^}]*\}/g;
let m;
while ((m = regex.exec(data)) !== null) {
  imgIdMap[parseInt(m[2])] = m[1];
}

// 檢查幾個怪物的攻擊間隔
const checkMonsters = ['poring', 'fabre', 'hornet', 'wolf', 'scorpion'];

console.log('怪物攻擊間隔比對:');
console.log('怪物 | 原始值(秒) | 遊戲值(秒)');
console.log('------|-----------|----------');

for (const monster of raw) {
  const gameId = imgIdMap[monster.id];
  if (!gameId || !checkMonsters.includes(gameId)) continue;
  
  const stats = monster.stats;
  if (!stats) continue;
  
  const originalInterval = parseFloat(stats['反击间隔']) || 1.0;
  
  // 從遊戲資料中提取 atkInterval
  const gameRegex = new RegExp(gameId + ':\\s*\\{[^}]+\\}');
  const gameMatch = data.match(gameRegex);
  let gameInterval = 'N/A';
  if (gameMatch) {
    const intervalMatch = gameMatch[0].match(/atkInterval:([\d.]+)/);
    if (intervalMatch) gameInterval = intervalMatch[1];
  }
  
  const match = originalInterval == gameInterval ? '✓' : '✗';
  console.log(`${gameId.padEnd(12)} | ${originalInterval.toFixed(2)} | ${gameInterval} ${match}`);
}

// 檢查遊戲中的攻擊觸發邏輯
console.log('\n=== 遊戲攻擊觸發邏輯 ===');
const tickMatch = data.match(/if\s*\(\s*now\s*-\s*mon\.lastAttackTime\s*>=\s*interval\s*\)/);
if (tickMatch) {
  console.log('攻擊觸發條件: now - mon.lastAttackTime >= interval');
  console.log('interval = monDef.atkInterval * 1000 (毫秒)');
  console.log('遊戲 tick 頻率: 100ms (TICK_MS)');
}
