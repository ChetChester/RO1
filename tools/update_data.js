const fs = require('fs');

// 讀取現有 data.js
let dataContent = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// 讀取新的怪物資料庫
const monstersContent = fs.readFileSync('D:/mimo/ro-idle/tools/monsters_db.js', 'utf8');

// 找到 MONSTERS 物件的範圍
const startMarker = '/* ---------------- 怪物 ----------------';
const endMarker = '/* ---------------- 圖片路徑輔助函式 ----------------';

const startIdx = dataContent.indexOf(startMarker);
const endIdx = dataContent.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.log('ERROR: Could not find MONSTERS object markers');
  console.log('startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

// 找到 const MONSTERS = { 的位置
const monstersStart = dataContent.indexOf('const MONSTERS = {', startIdx);
if (monstersStart === -1) {
  console.log('ERROR: Could not find const MONSTERS = {');
  process.exit(1);
}

// 找到 MONSTERS 物件的結束位置（};）
let braceCount = 0;
let monstersEnd = -1;
for (let i = monstersStart; i < dataContent.length; i++) {
  if (dataContent[i] === '{') braceCount++;
  if (dataContent[i] === '}') braceCount--;
  if (braceCount === 0) {
    monstersEnd = i + 1;
    break;
  }
}

if (monstersEnd === -1) {
  console.log('ERROR: Could not find end of MONSTERS object');
  process.exit(1);
}

// 提取新的 MONSTERS 物件（不含開頭的註釋）
const newMonstersStart = monstersContent.indexOf('const MONSTERS = {');
const newMonsters = monstersContent.substring(newMonstersStart);

// 替換
const newData = dataContent.substring(0, monstersStart) + newMonsters + dataContent.substring(monstersEnd);

// 寫入
fs.writeFileSync('D:/mimo/ro-idle/js/data.js', newData);

console.log('Updated data.js with new monsters database');
console.log('Old MONSTERS object: chars', monstersEnd - monstersStart);
console.log('New MONSTERS object: chars', newMonsters.length);
