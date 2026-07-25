/* 分析物品 imgId → itemId 對照 */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

// 從 ITEMS 區塊提取 imgId → itemId 對照
const itemsMatch = data.match(/const ITEMS = \{([\s\S]*?)\n\};/);
if (!itemsMatch) { console.error('找不到 ITEMS'); process.exit(1); }

const itemsBlock = itemsMatch[1];
const itemRegex = /(\w+):\s*\{"id":"[^"]+","imgId":(\d+)/g;
const imgIdToKey = {};
let m;
while ((m = itemRegex.exec(itemsBlock)) !== null) {
  imgIdToKey[parseInt(m[2])] = m[1];
}

console.log(`已建立 ${Object.keys(imgIdToKey).length} 個 imgId → itemId 對照`);

// 測試幾個
const tests = [1011, 939, 940, 916, 962, 991, 501, 1750, 1710, 1201];
console.log('\n測試對照:');
tests.forEach(id => console.log(`  ${id} → ${imgIdToKey[id] || 'NOT FOUND'}`));

// 儲存對照供其他腳本使用
fs.writeFileSync(
  path.join(__dirname, 'item_id_map.json'),
  JSON.stringify(imgIdToKey, null, 2),
  'utf8'
);
console.log('\n已儲存 item_id_map.json');
