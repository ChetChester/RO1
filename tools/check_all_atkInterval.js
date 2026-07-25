/* 檢查遊戲是否正確載入怪物攻擊間隔 */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

// 找到 MONSTERS 區塊
const monstersStart = data.indexOf('const MONSTERS = {');
const monstersEnd = data.indexOf('\n};', monstersStart) + 3;
const monstersBlock = data.substring(monstersStart, monstersEnd);

// 檢查所有怪物的 atkInterval
const regex = /(\w+):\s*\{[^}]*atkInterval:([\d.]+)[^}]*\}/g;
let m;
let count = 0;
let noInterval = 0;

console.log('遊戲中怪物的 atkInterval:');
while ((m = regex.exec(monstersBlock)) !== null) {
  count++;
  if (count <= 10) {
    console.log(`  ${m[1]}: ${m[2]} 秒`);
  }
}
console.log(`... 共 ${count} 個怪物有 atkInterval`);

// 檢查沒有 atkInterval 的怪物
const noIntervalRegex = /(\w+):\s*\{[^}]*level:\d+[^}]*\}/g;
let noIntervalCount = 0;
while ((m = noIntervalRegex.exec(monstersBlock)) !== null) {
  if (!m[0].includes('atkInterval:')) {
    noIntervalCount++;
    if (noIntervalCount <= 5) {
      console.log(`  ${m[1]}: 無 atkInterval`);
    }
  }
}
console.log(`共 ${noIntervalCount} 個怪物無 atkInterval`);
