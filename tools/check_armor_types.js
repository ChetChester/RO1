/* 檢查防具類型分佈 */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

// 提取 ITEMS 區塊
const itemsStart = data.indexOf('const ITEMS = {');
const itemsEnd = data.indexOf('\n};', itemsStart) + 3;
const itemsBlock = data.substring(itemsStart, itemsEnd);

// 解析所有有 shop 的防具
const regex = /(\w+):\s*\{([^}]+)\}/g;
let m;
const armorTypes = {};

while ((m = regex.exec(itemsBlock)) !== null) {
  const props = m[2];
  if (!props.includes('"shop":true')) continue;
  if (!props.includes('"type":"armor"')) continue;
  
  const armorTypeMatch = props.match(/"armorType":"(\w+)"/);
  const armorType = armorTypeMatch ? armorTypeMatch[1] : 'unknown';
  
  if (!armorTypes[armorType]) armorTypes[armorType] = [];
  
  const defMatch = props.match(/"def":(\d+)/);
  const buyMatch = props.match(/"buyPrice":(\d+)/);
  const reqLevelMatch = props.match(/"reqLevel":(\d+)/);
  
  armorTypes[armorType].push({
    def: defMatch ? parseInt(defMatch[1]) : 0,
    buyPrice: buyMatch ? parseInt(buyMatch[1]) : 0,
    reqLevel: reqLevelMatch ? parseInt(reqLevelMatch[1]) : 1
  });
}

console.log('防具類型分佈:');
for (const [type, items] of Object.entries(armorTypes)) {
  console.log(`  ${type}: ${items.length} 個`);
  // 顯示前 3 個
  items.slice(0, 3).forEach(i => {
    console.log(`    DEF ${i.def}, 價格 ${i.buyPrice}, 需求等級 ${i.reqLevel}`);
  });
}
