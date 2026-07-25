/* 檢查商店物品的 buyPrice */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const engine = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8');

// 提取商店物品列表
const weaponMatch = engine.match(/weapon:\s*\{[^}]*items:\s*\[([^\]]+)\]/);
const armorMatch = engine.match(/armor:\s*\{[^}]*items:\s*\[([^\]]+)\]/);

const weaponIds = weaponMatch ? weaponMatch[1].match(/'(\w+)'/g).map(s => s.replace(/'/g, '')) : [];
const armorIds = armorMatch ? armorMatch[1].match(/'(\w+)'/g).map(s => s.replace(/'/g, '')) : [];

console.log('=== 武器商店 ===');
const noPriceWeapons = [];
for (const id of weaponIds) {
  const regex = new RegExp(`"${id}":\\s*\\{[^}]*\\}`);
  const match = data.match(regex);
  if (match) {
    const bpMatch = match[0].match(/"buyPrice":(\d+)/);
    const bp = bpMatch ? parseInt(bpMatch[1]) : 0;
    if (bp === 0) {
      noPriceWeapons.push(id);
    }
  }
}
console.log(`總計: ${weaponIds.length} 個物品`);
console.log(`無 buyPrice: ${noPriceWeapons.length} 個`);
if (noPriceWeapons.length > 0) {
  console.log('無法購買的武器:', noPriceWeapons);
}

console.log('\n=== 防具商店 ===');
const noPriceArmors = [];
for (const id of armorIds) {
  const regex = new RegExp(`"${id}":\\s*\\{[^}]*\\}`);
  const match = data.match(regex);
  if (match) {
    const bpMatch = match[0].match(/"buyPrice":(\d+)/);
    const bp = bpMatch ? parseInt(bpMatch[1]) : 0;
    if (bp === 0) {
      noPriceArmors.push(id);
    }
  }
}
console.log(`總計: ${armorIds.length} 個物品`);
console.log(`無 buyPrice: ${noPriceArmors.length} 個`);
if (noPriceArmors.length > 0) {
  console.log('無法購買的防具:', noPriceArmors);
}
