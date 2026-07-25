/* 模擬商店篩選邏輯 */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

// 提取 ITEMS 區塊
const itemsStart = data.indexOf('const ITEMS = {');
const itemsEnd = data.indexOf('\n};', itemsStart) + 3;
const itemsBlock = data.substring(itemsStart, itemsEnd);

// 解析所有物品
const items = {};
const regex = /(\w+):\s*\{([^}]+)\}/g;
let m;

while ((m = regex.exec(itemsBlock)) !== null) {
  const id = m[1];
  const props = m[2];
  
  const shop = props.includes('"shop":true');
  const typeMatch = props.match(/"type":"(\w+)"/);
  const type = typeMatch ? typeMatch[1] : null;
  const buyMatch = props.match(/"buyPrice":(\d+)/);
  const buyPrice = buyMatch ? parseInt(buyMatch[1]) : 0;
  const reqLevelMatch = props.match(/"reqLevel":(\d+)/);
  const reqLevel = reqLevelMatch ? parseInt(reqLevelMatch[1]) : 1;
  const atkMatch = props.match(/"atk":(\d+)/);
  const atk = atkMatch ? parseInt(atkMatch[1]) : 0;
  
  items[id] = { shop, type, buyPrice, reqLevel, atk };
}

// 模擬武器商店篩選
console.log('=== 武器商店（reqLevel <= 40） ===');
const weaponShop = Object.entries(items)
  .filter(([id, item]) => {
    if (item.type !== 'weapon') return false;
    if (!item.shop) return false;
    if (!item.buyPrice) return false;
    if (item.reqLevel > 40) return false;
    return true;
  })
  .sort((a, b) => a[1].buyPrice - b[1].buyPrice);

console.log('總數:', weaponShop.length);
weaponShop.slice(0, 30).forEach(([id, item]) => {
  console.log(`  ${id}: ATK ${item.atk}, 價格 ${item.buyPrice}, 需求等級 ${item.reqLevel}`);
});

// 模擬防具商店篩選
console.log('\n=== 防具商店（reqLevel <= 40） ===');
const armorShop = Object.entries(items)
  .filter(([id, item]) => {
    if (item.type !== 'armor') return false;
    if (!item.shop) return false;
    if (!item.buyPrice) return false;
    if (item.reqLevel > 40) return false;
    return true;
  })
  .sort((a, b) => a[1].buyPrice - b[1].buyPrice);

console.log('總數:', armorShop.length);
armorShop.slice(0, 30).forEach(([id, item]) => {
  console.log(`  ${id}: 價格 ${item.buyPrice}, 需求等級 ${item.reqLevel}`);
});
