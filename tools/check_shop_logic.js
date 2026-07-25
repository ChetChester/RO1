/* 檢查商店篩選邏輯 */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

// 提取 ITEMS 區塊
const itemsStart = data.indexOf('const ITEMS = {');
const itemsEnd = data.indexOf('\n};', itemsStart) + 3;
const itemsBlock = data.substring(itemsStart, itemsEnd);

// 找出有 shop:true 的武器和防具
const regex = /(\w+):\s*\{([^}]+)\}/g;
let m;
const shopWeapons = [], shopArmors = [];

while ((m = regex.exec(itemsBlock)) !== null) {
  const id = m[1];
  const props = m[2];
  
  if (!props.includes('"shop":true')) continue;
  
  if (props.includes('"type":"weapon"')) {
    const atkMatch = props.match(/"atk":(\d+)/);
    const buyMatch = props.match(/"buyPrice":(\d+)/);
    const reqLevelMatch = props.match(/"reqLevel":(\d+)/);
    shopWeapons.push({
      id,
      atk: atkMatch ? parseInt(atkMatch[1]) : 0,
      buyPrice: buyMatch ? parseInt(buyMatch[1]) : 0,
      reqLevel: reqLevelMatch ? parseInt(reqLevelMatch[1]) : 1
    });
  }
  
  if (props.includes('"type":"armor"')) {
    const defMatch = props.match(/"def":(\d+)/);
    const buyMatch = props.match(/"buyPrice":(\d+)/);
    const reqLevelMatch = props.match(/"reqLevel":(\d+)/);
    shopArmors.push({
      id,
      def: defMatch ? parseInt(defMatch[1]) : 0,
      buyPrice: buyMatch ? parseInt(buyMatch[1]) : 0,
      reqLevel: reqLevelMatch ? parseInt(reqLevelMatch[1]) : 1
    });
  }
}

console.log('=== 武器商店（有 buyPrice 的武器） ===');
console.log('總數:', shopWeapons.length);

// 按 ATK 排序顯示前 20
shopWeapons.sort((a, b) => a.atk - b.atk);
console.log('\n前 20 個（按 ATK 排序）:');
shopWeapons.slice(0, 20).forEach(w => {
  console.log(`  ${w.id}: ATK ${w.atk}, 價格 ${w.buyPrice}, 需求等級 ${w.reqLevel}`);
});

console.log('\n=== 防具商店（有 buyPrice 的防具） ===');
console.log('總數:', shopArmors.length);

shopArmors.sort((a, b) => a.def - b.def);
console.log('\n前 20 個（按 DEF 排序）:');
shopArmors.slice(0, 20).forEach(a => {
  console.log(`  ${a.id}: DEF ${a.def}, 價格 ${a.buyPrice}, 需求等級 ${a.reqLevel}`);
});
