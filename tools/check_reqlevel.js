/* 檢查商店物品的 reqLevel */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const engine = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8');

// 提取商店物品列表
const weaponMatch = engine.match(/weapon:\s*\{[^}]*items:\s*\[([^\]]+)\]/);
const armorMatch = engine.match(/armor:\s*\{[^}]*items:\s*\[([^\]]+)\]/);

const weaponIds = weaponMatch ? weaponMatch[1].match(/'(\w+)'/g).map(s => s.replace(/'/g, '')) : [];
const armorIds = armorMatch ? armorMatch[1].match(/'(\w+)'/g).map(s => s.replace(/'/g, '')) : [];

console.log('=== 武器商店 - 需求等級 ===');
const highLevelWeapons = [];
for (const id of weaponIds) {
  const regex = new RegExp(`"${id}":\\s*\\{[^}]*\\}`);
  const match = data.match(regex);
  if (match) {
    const rlMatch = match[0].match(/"reqLevel":(\d+)/);
    const bpMatch = match[0].match(/"buyPrice":(\d+)/);
    const rl = rlMatch ? parseInt(rlMatch[1]) : 1;
    const bp = bpMatch ? parseInt(bpMatch[1]) : 0;
    if (rl > 1) {
      highLevelWeapons.push({ id, reqLevel: rl, buyPrice: bp });
    }
  }
}
console.log(`需要等級 > 1 的武器: ${highLevelWeapons.length}`);
highLevelWeapons.forEach(w => console.log(`  ${w.id}: reqLevel ${w.reqLevel}, price ${w.buyPrice}`));

console.log('\n=== 防具商店 - 需求等級 ===');
const highLevelArmors = [];
for (const id of armorIds) {
  const regex = new RegExp(`"${id}":\\s*\\{[^}]*\\}`);
  const match = data.match(regex);
  if (match) {
    const rlMatch = match[0].match(/"reqLevel":(\d+)/);
    const bpMatch = match[0].match(/"buyPrice":(\d+)/);
    const rl = rlMatch ? parseInt(rlMatch[1]) : 1;
    const bp = bpMatch ? parseInt(bpMatch[1]) : 0;
    if (rl > 1) {
      highLevelArmors.push({ id, reqLevel: rl, buyPrice: bp });
    }
  }
}
console.log(`需要等級 > 1 的防具: ${highLevelArmors.length}`);
highLevelArmors.forEach(a => console.log(`  ${a.id}: reqLevel ${a.reqLevel}, price ${a.buyPrice}`));
