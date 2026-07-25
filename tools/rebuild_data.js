const fs = require('fs');

// 讀取原始 data.js
const originalData = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// 讀取新的怪物資料庫
const newMonsters = fs.readFileSync('D:/mimo/ro-idle/tools/monsters_db_clean.js', 'utf8');

// 找到原始 MONSTERS 物件的位置
const monstersCommentStart = originalData.indexOf('/* ---------------- 怪物 ----------------');
const monstersConstStart = originalData.indexOf('const MONSTERS = {', monstersCommentStart);
const pictureHelperStart = originalData.indexOf('/* ---------------- 圖片路徑輔助函式 ----------------');

// 找到原始 MONSTERS 物件的結束位置
let braceCount = 0;
let originalMonstersEnd = -1;
for (let i = monstersConstStart; i < originalData.length; i++) {
  if (originalData[i] === '{') braceCount++;
  if (originalData[i] === '}') braceCount--;
  if (braceCount === 0) {
    originalMonstersEnd = i + 1;
    break;
  }
}

console.log('Original MONSTERS starts at:', monstersConstStart);
console.log('Original MONSTERS ends at:', originalMonstersEnd);
console.log('Original MONSTERS length:', originalMonstersEnd - monstersConstStart);

// 提取新的 MONSTERS 物件
const newMonstersStart = newMonsters.indexOf('const MONSTERS = {');
const newMonstersOnly = newMonsters.substring(newMonstersStart);

// 重建 data.js
const beforeMonsters = originalData.substring(0, monstersConstStart);
const afterMonsters = originalData.substring(originalMonstersEnd);

const newData = beforeMonsters + newMonstersOnly + afterMonsters;

// 寫入
fs.writeFileSync('D:/mimo/ro-idle/js/data.js', newData);

console.log('Rebuilt data.js successfully');
console.log('New file size:', newData.length);
