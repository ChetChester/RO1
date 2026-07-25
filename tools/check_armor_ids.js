/* 檢查防具 ID 是否在 imgIdMap 中 */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

// 建立 imgId → 遊戲 ID 對照
const imgIdMap = {};
const regex = /(\w+):\s*\{"id":"[^"]+","imgId":(\d+)/g;
let m;
while ((m = regex.exec(data)) !== null) {
  imgIdMap[parseInt(m[2])] = m[1];
}

// 測試防具 ID
const testIds = [2301, 2303, 2305, 2101, 2401, 2501, 2220];

console.log('imgIdMap 中的防具:');
for (const [imgId, gameId] of Object.entries(imgIdMap)) {
  const id = parseInt(imgId);
  if (id >= 2100 && id <= 2700) {
    console.log(`  ${id} → ${gameId}`);
  }
}

console.log('\n測試防具 ID:');
for (const id of testIds) {
  console.log(`  ${id}: ${imgIdMap[id] || 'NOT FOUND'}`);
}
