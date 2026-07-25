/* 最終版：更新商店 */
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

// 讀取商店資料
const weaponData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_npcshop_data', 'weapon_list.json'), 'utf8'));
const armorData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_npcshop_data', 'armor_list.json'), 'utf8'));

const weapons = weaponData.pre_re;
const armors = armorData.pre_re;

// 過濾武器
const validWeapons = weapons.filter(w => imgIdMap[w.id]).map(w => imgIdMap[w.id]);
console.log(`武器: ${weapons.length} → ${validWeapons.length} 個有效`);

// 過濾防具：只排除不存在的物品
const validArmors = armors.filter(a => imgIdMap[a.id]).map(a => imgIdMap[a.id]);
const missingArmors = armors.filter(a => !imgIdMap[a.id]);
console.log(`防具: ${armors.length} → ${validArmors.length} 個有效`);
if (missingArmors.length > 0) {
  console.log(`  排除不存在: ${missingArmors.length}`);
}

// 更新 engine.js
const newShopCode = `/* ---------------- NPC 商店系統 ---------------- */
/* 基於 ro_npcshop_data，剔除不存在的物品 */
const NPC_SHOPS = {
  weapon: {
    name: '武器商人',
    icon: '⚔️',
    items: [${validWeapons.map(id => `'${id}'`).join(', ')}],
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
    items: [${validArmors.map(id => `'${id}'`).join(', ')}],
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
