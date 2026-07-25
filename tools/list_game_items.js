/* 找出遊戲中的武器和防具 ID */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

// 找出所有武器
const weaponRegex = /(\w+):\s*\{[^}]*"type":"weapon"[^}]*\}/g;
const armorRegex = /(\w+):\s*\{[^}]*"type":"armor"[^}]*\}/g;

const weapons = [];
const armors = [];
let m;

while ((m = weaponRegex.exec(data)) !== null) {
  weapons.push(m[1]);
}

while ((m = armorRegex.exec(data)) !== null) {
  armors.push(m[1]);
}

console.log(`遊戲中的武器: ${weapons.length}`);
console.log(`遊戲中的防具: ${armors.length}`);

// 列出前 30 個武器和防具
console.log('\n武器 (前30):');
weapons.slice(0, 30).forEach(id => {
  const regex = new RegExp(`"${id}":\\s*\\{[^}]+\\}`);
  const match = data.match(regex);
  if (match) {
    const atkMatch = match[0].match(/"atk":(\d+)/);
    const bpMatch = match[0].match(/"buyPrice":(\d+)/);
    const shopMatch = match[0].includes('"shop":true');
    console.log(`  ${id}: ATK ${atkMatch ? atkMatch[1] : '?'}, buyPrice ${bpMatch ? bpMatch[1] : 'N/A'}, shop ${shopMatch}`);
  }
});

console.log('\n防具 (前30):');
armors.slice(0, 30).forEach(id => {
  const regex = new RegExp(`"${id}":\\s*\\{[^}]+\\}`);
  const match = data.match(regex);
  if (match) {
    const defMatch = match[0].match(/"def":(\d+)/);
    const bpMatch = match[0].match(/"buyPrice":(\d+)/);
    const shopMatch = match[0].includes('"shop":true');
    const armorTypeMatch = match[0].match(/"armorType":"(\w+)"/);
    console.log(`  ${id}: DEF ${defMatch ? defMatch[1] : '?'}, buyPrice ${bpMatch ? bpMatch[1] : 'N/A'}, shop ${shopMatch}, type ${armorTypeMatch ? armorTypeMatch[1] : '?'}`);
  }
});
