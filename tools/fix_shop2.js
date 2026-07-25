/* 正確更新遊戲商店 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const enginePath = path.join(__dirname, '..', 'js', 'engine.js');
let data = fs.readFileSync(dataPath, 'utf8');
let engine = fs.readFileSync(enginePath, 'utf8');

// 建立 imgId → 遊戲 ID 對照
const imgIdMap = {};
const regex = /(\w+):\s*\{"id":"[^"]+","imgId":(\d+)/g;
let m;
while ((m = regex.exec(data)) !== null) {
  imgIdMap[parseInt(m[2])] = m[1];
}
console.log(`已建立 ${Object.keys(imgIdMap).length} 個 imgId 對照`);

// 讀取商店資料
const weaponData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_npcshop_data', 'weapon_list.json'), 'utf8'));
const armorData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_npcshop_data', 'armor_list.json'), 'utf8'));

const weapons = weaponData.pre_re;
const armors = armorData.pre_re;

// 過濾武器
const validWeapons = weapons.filter(w => imgIdMap[w.id]);
console.log(`\n武器: ${weapons.length} → ${validWeapons.length} 個有效`);

// 過濾防具：排除時裝
const validArmors = [];
const fashionArmors = [];
const missingArmors = [];

for (const a of armors) {
  const gameId = imgIdMap[a.id];
  if (!gameId) {
    missingArmors.push(a);
    continue;
  }
  
  // 找到物品屬性
  const itemRegex = new RegExp(`"${gameId}":\\s*\\{[^}]*\\}`);
  const itemMatch = data.match(itemRegex);
  if (!itemMatch) {
    missingArmors.push(a);
    continue;
  }
  
  const props = itemMatch[0];
  const defMatch = props.match(/"def":(\d+)/);
  const armorTypeMatch = props.match(/"armorType":"(\w+)"/);
  
  const def = defMatch ? parseInt(defMatch[1]) : 0;
  const armorType = armorTypeMatch ? armorTypeMatch[1] : '';
  
  // 排除 DEF=0 的 headgear 和 accessory
  if (def === 0 && (armorType === 'headgear' || armorType === 'accessory')) {
    fashionArmors.push({ id: a.id, gameId, name: a.name, armorType });
    continue;
  }
  
  validArmors.push(gameId);
}

console.log(`防具: ${armors.length} → ${validArmors.length} 個有效`);
console.log(`  排除時裝: ${fashionArmors.length} 個`);
console.log(`  排除不存在: ${missingArmors.length} 個`);

// 更新 engine.js
const weaponGameIds = validWeapons.map(w => imgIdMap[w.id]);
const armorGameIds = validArmors;

console.log(`\n武器商店: ${weaponGameIds.length} 個物品`);
console.log(`防具商店: ${armorGameIds.length} 個物品`);

const newShopCode = `/* ---------------- NPC 商店系統 ---------------- */
/* 基於 ro_npcshop_data，剔除時裝和不存在的物品 */
const NPC_SHOPS = {
  weapon: {
    name: '武器商人',
    icon: '⚔️',
    items: [${weaponGameIds.map(id => `'${id}'`).join(', ')}],
    getItems() {
      return this.items.filter(id => {
        const item = ITEMS[id];
        if (!item) return false;
        if (item.reqLevel && state.baseLevel < item.reqLevel) return false;
        return true;
      });
    }
  },
  armor: {
    name: '防具商人',
    icon: '🛡️',
    items: [${armorGameIds.map(id => `'${id}'`).join(', ')}],
    getItems() {
      return this.items.filter(id => {
        const item = ITEMS[id];
        if (!item) return false;
        if (item.reqLevel && state.baseLevel < item.reqLevel) return false;
        return true;
      });
    }
  }
};`;

engine = engine.replace(/\/\* ---------------- NPC 商店系統 ---------------- \*\/[\s\S]*?^};/m, newShopCode);
fs.writeFileSync(enginePath, engine, 'utf8');
console.log('\nengine.js 已儲存');
