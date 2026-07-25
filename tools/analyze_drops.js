/* 分析原始怪物掉落資料 */
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_monster_data', 'monsters.json'), 'utf8'));
const itemMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'item_id_map.json'), 'utf8'));

const withDrops = raw.filter(m => m.drops && m.drops.length > 0);
console.log(`有掉落的怪物: ${withDrops.length}`);

// 範例
console.log('\n蝎子掉落:');
console.log(JSON.stringify(withDrops[0].drops, null, 2));

// 統計有多少掉落的 item_id 在遊戲中有對照
let mapped = 0, unmapped = 0;
const unmappedIds = new Set();
withDrops.forEach(m => {
  m.drops.forEach(d => {
    if (itemMap[d.item_id]) mapped++;
    else { unmapped++; unmappedIds.add(d.item_id); }
  });
});
console.log(`\n掉落條目: ${mapped + unmapped}`);
console.log(`有對照: ${mapped}`);
console.log(`無對照: ${unmapped}`);
if (unmappedIds.size > 0) {
  console.log(`無對照的 item_id (前20): ${[...unmappedIds].slice(0, 20).join(', ')}`);
}
