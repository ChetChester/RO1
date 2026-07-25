/* 找出有 shop 標記的武器和防具 */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

// 找出所有有 shop:true 的物品
const regex = /(\w+):\s*\{[^}]*"shop":true[^}]*"type":"(weapon|armor)"[^}]*\}/g;
const weapons = [], armors = [];
let m;

while ((m = regex.exec(data)) !== null) {
  const id = m[1];
  const type = m[2];
  if (type === 'weapon') weapons.push(id);
  else armors.push(id);
}

console.log('有 shop 的武器:', weapons.length);
console.log('有 shop 的防具:', armors.length);

console.log('\n武器:');
weapons.forEach(id => console.log('  ' + id));

console.log('\n防具:');
armors.forEach(id => console.log('  ' + id));
