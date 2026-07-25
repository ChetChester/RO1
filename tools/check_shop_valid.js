/* 檢查商店物品是否存在於遊戲中 */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const engine = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8');

// 提取商店物品列表
const weaponMatch = engine.match(/weapon:\s*\{[^}]*items:\s*\[([^\]]+)\]/);
const armorMatch = engine.match(/armor:\s*\{[^}]*items:\s*\[([^\]]+)\]/);

const weaponIds = weaponMatch ? weaponMatch[1].match(/'(\w+)'/g).map(s => s.replace(/'/g, '')) : [];
const armorIds = armorMatch ? armorMatch[1].match(/'(\w+)'/g).map(s => s.replace(/'/g, '')) : [];

console.log(`武器商店: ${weaponIds.length} 個物品`);
console.log(`防具商店: ${armorIds.length} 個物品`);

// 檢查哪些物品不存在
const missingWeapons = weaponIds.filter(id => !data.includes(`"${id}":`));
const missingArmors = armorIds.filter(id => !data.includes(`"${id}":`));

console.log(`\n武器不存在: ${missingWeapons.length}`);
missingWeapons.forEach(id => console.log(`  ${id}`));

console.log(`\n防具不存在: ${missingArmors.length}`);
missingArmors.forEach(id => console.log(`  ${id}`));

// 檢查防具的 DEF 和類型
console.log('\n=== 防具分析 ===');
const fashionItems = [];
const validArmors = [];

for (const id of armorIds) {
  const regex = new RegExp(`"${id}":\\s*\\{[^}]+\\}`);
  const match = data.match(regex);
  if (!match) continue;
  
  const props = match[0];
  const defMatch = props.match(/"def":(\d+)/);
  const typeMatch = props.match(/"type":"(\w+)"/);
  const armorTypeMatch = props.match(/"armorType":"(\w+)"/);
  
  const def = defMatch ? parseInt(defMatch[1]) : 0;
  const type = typeMatch ? typeMatch[1] : '';
  const armorType = armorTypeMatch ? armorTypeMatch[1] : '';
  
  if (def === 0 && type === 'armor') {
    fashionItems.push({ id, armorType });
  } else {
    validArmors.push({ id, def, type, armorType });
  }
}

console.log(`\n時裝物品 (DEF=0 的防具): ${fashionItems.length}`);
fashionItems.forEach(i => console.log(`  ${i.id} (${i.armorType})`));

console.log(`\n有效防具: ${validArmors.length}`);
validArmors.forEach(i => console.log(`  ${i.id}: DEF ${i.def}, ${i.armorType}`));
