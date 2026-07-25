/* 檢查掉落物的賣價 */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

// 找出 sell=1 的材料物品（掉落物通常賣 1 zeny）
const regex = /(\w+):\s*\{"id":"[^"]+","imgId":(\d+)[^}]*"type":"material"[^}]*\}/g;
const sellOne = [];
let m;

while ((m = regex.exec(data)) !== null) {
  const id = m[1];
  const imgId = parseInt(m[2]);
  const sellMatch = m[0].match(/"sell":(\d+)/);
  const sell = sellMatch ? parseInt(sellMatch[1]) : 0;
  if (sell === 1) {
    sellOne.push({ id, imgId });
  }
}

console.log(`sell=1 的材料: ${sellOne.length}`);

// 檢查 rAthena 的 etc item_db
const rathenaData = fs.readFileSync(path.join(__dirname, '..', 'ro_npcshop_data', '..', 'ro_items_data', 'items.json'), 'utf8');
const rawItems = JSON.parse(rathenaData);

// 找出這些物品在原始資料中的價格
console.log('\n檢查原始資料中的價格:');
sellOne.slice(0, 10).forEach(item => {
  const raw = rawItems.find(i => i.id === item.imgId);
  if (raw) {
    console.log(`  ${item.id} (${item.imgId}): ${raw.name}`);
    console.log(`    description: ${raw.description ? raw.description.substring(0, 100) : 'N/A'}...`);
  }
});
