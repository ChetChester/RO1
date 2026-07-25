/* 找出售價為 0 的材料物品 */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

// 找出所有 type=material 且 sell=0 的物品
const regex = /(\w+):\s*\{"id":"[^"]+","imgId":(\d+)[^}]*"type":"material"[^}]*\}/g;
const noSell = [];
let m;

while ((m = regex.exec(data)) !== null) {
  const id = m[1];
  const sellMatch = m[0].match(/"sell":(\d+)/);
  const sell = sellMatch ? parseInt(sellMatch[1]) : 0;
  if (sell === 0) {
    noSell.push({ id, imgId: parseInt(m[2]) });
  }
}

console.log(`sell=0 的材料: ${noSell.length}`);
noSell.slice(0, 20).forEach(i => console.log(`  ${i.id} (imgId:${i.imgId})`));
