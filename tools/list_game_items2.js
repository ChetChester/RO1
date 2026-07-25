/* 找出遊戲中的武器和防具 ID */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

// 找出所有物品
const itemRegex = /(\w+):\s*\{"id":"[^"]+","imgId":(\d+)[^}]*\}/g;
const weapons = [];
const armors = [];
let m;

while ((m = itemRegex.exec(data)) !== null) {
  const id = m[1];
  const props = m[0];
  
  if (props.includes('"type":"weapon"')) {
    const atkMatch = props.match(/"atk":(\d+)/);
    const bpMatch = props.match(/"buyPrice":(\d+)/);
    weapons.push({
      id,
      atk: atkMatch ? parseInt(atkMatch[1]) : 0,
      buyPrice: bpMatch ? parseInt(bpMatch[1]) : 0
    });
  }
  
  if (props.includes('"type":"armor"')) {
    const defMatch = props.match(/"def":(\d+)/);
    const bpMatch = props.match(/"buyPrice":(\d+)/);
    const armorTypeMatch = props.match(/"armorType":"(\w+)"/);
    armors.push({
      id,
      def: defMatch ? parseInt(defMatch[1]) : 0,
      buyPrice: bpMatch ? parseInt(bpMatch[1]) : 0,
      armorType: armorTypeMatch ? armorTypeMatch[1] : '?'
    });
  }
}

console.log(`遊戲中的武器: ${weapons.length}`);
console.log(`遊戲中的防具: ${armors.length}`);

// 列出有 buyPrice 的武器和防具
const shopWeapons = weapons.filter(w => w.buyPrice > 0);
const shopArmors = armors.filter(a => a.buyPrice > 0);

console.log(`\n有 buyPrice 的武器: ${shopWeapons.length}`);
shopWeapons.slice(0, 30).forEach(w => {
  console.log(`  ${w.id}: ATK ${w.atk}, buyPrice ${w.buyPrice}`);
});

console.log(`\n有 buyPrice 的防具: ${shopArmors.length}`);
shopArmors.slice(0, 30).forEach(a => {
  console.log(`  ${a.id}: DEF ${a.def}, buyPrice ${a.buyPrice}, type ${a.armorType}`);
});

// 找出時裝物品（DEF=0 的防具）
const fashionArmors = shopArmors.filter(a => a.def === 0);
console.log(`\n時裝物品 (DEF=0): ${fashionArmors.length}`);
fashionArmors.forEach(a => {
  console.log(`  ${a.id}: buyPrice ${a.buyPrice}, type ${a.armorType}`);
});
