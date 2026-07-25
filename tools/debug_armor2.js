/* 調試防具 ID 對照 */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

// 建立 imgId → 遊戲 ID 對照
const imgIdMap = {};
const regex = /(\w+):\s*\{"id":"[^"]+","imgId":(\d+)/g;
let m;
while ((m = regex.exec(data)) !== null) {
  imgIdMap[parseInt(m[2])] = m[1];
}

// 讀取商店資料
const armorData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_npcshop_data', 'armor_list.json'), 'utf8'));
const armors = armorData.pre_re;

console.log(`防具商店資料: ${armors.length} 個物品`);
console.log(`imgIdMap 大小: ${Object.keys(imgIdMap).length}`);

// 檢查前 10 個防具
console.log('\n前 10 個防具:');
armors.slice(0, 10).forEach(a => {
  console.log(`  ${a.id} ${a.name}: ${imgIdMap[a.id] ? 'FOUND' : 'NOT FOUND'}`);
});

// 檢查 2301 是否在 imgIdMap 中
console.log('\nimgIdMap[2301]:', imgIdMap[2301]);
console.log('imgIdMap[2303]:', imgIdMap[2303]);
console.log('imgIdMap[2101]:', imgIdMap[2101]);
