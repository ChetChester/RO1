/* 檢查特定物品的屬性 */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

const items = ['doom_slayer', 'berserk_guitar', 'red_ether_bag', 'combo_battle_glove', 'bow', 'knife', 'sword'];

for (const id of items) {
  const regex = new RegExp(id + ':\\s*\\{[^}]+\\}');
  const m = data.match(regex);
  if (m) {
    const rl = m[0].match(/"reqLevel":(\d+)/);
    const bp = m[0].match(/"buyPrice":(\d+)/);
    const shop = m[0].includes('"shop":true');
    const atk = m[0].match(/"atk":(\d+)/);
    console.log(`${id}: ATK=${atk?atk[1]:'N/A'}, reqLevel=${rl?rl[1]:'N/A'}, buyPrice=${bp?bp[1]:'N/A'}, shop=${shop}`);
  } else {
    console.log(`${id}: NOT FOUND`);
  }
}
