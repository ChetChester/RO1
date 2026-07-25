/* 正確更新商店：映射 ID + 剔除時裝 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const enginePath = path.join(__dirname, '..', 'js', 'engine.js');
let data = fs.readFileSync(dataPath, 'utf8');
let engine = fs.readFileSync(enginePath, 'utf8');

// 建立 imgId → 遊戲 ID 對照
const imgIdMap = {};
const itemRegex = /(\w+):\s*\{"id":"[^"]+","imgId":(\d+)[^}]*\}/g;
let m;
while ((m = itemRegex.exec(data)) !== null) {
  imgIdMap[parseInt(m[2])] = m[1];
}

// 讀取商店資料
const weaponData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_npcshop_data', 'weapon_list.json'), 'utf8'));
const armorData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_npcshop_data', 'armor_list.json'), 'utf8'));

const weapons = weaponData.pre_re;
const armors = armorData.pre_re;

// 過濾武器：只保留遊戲中存在的
const validWeapons = weapons.filter(w => imgIdMap[w.id]);
const invalidWeapons = weapons.filter(w => !imgIdMap[w.id]);

console.log(`原始武器: ${weapons.length}`);
console.log(`遊戲中存在: ${validWeapons.length}`);
console.log(`遊戲中不存在: ${invalidWeapons.length}`);

// 過濾防具：只保留遊戲中存在的，且排除時裝（DEF=0 的 headgear 和 accessory）
const validArmors = armors.filter(a => {
  if (!imgIdMap[a.id]) return false;
  
  // 檢查是否為時裝
  const regex = new RegExp(`"${imgIdMap[a.id]}":\\s*\\{[^}]+\\}`);
  const match = data.match(regex);
  if (!match) return false;
  
  const props = match[0];
  const defMatch = props.match(/"def":(\d+)/);
  const armorTypeMatch = props.match(/"armorType":"(\w+)"/);
  
  const def = defMatch ? parseInt(defMatch[1]) : 0;
  const armorType = armorTypeMatch ? armorTypeMatch[1] : '';
  
  // 排除 DEF=0 的 headgear 和 accessory（時裝）
  if (def === 0 && (armorType === 'headgear' || armorType === 'accessory')) {
    return false;
  }
  
  return true;
});

const invalidArmors = armors.filter(a => !imgIdMap[a.id]);
const fashionArmors = armors.filter(a => {
  if (!imgIdMap[a.id]) return false;
  const regex = new RegExp(`"${imgIdMap[a.id]}":\\s*\\{[^}]+\\}`);
  const match = data.match(regex);
  if (!match) return false;
  const props = match[0];
  const defMatch = props.match(/"def":(\d+)/);
  const armorTypeMatch = props.match(/"armorType":"(\w+)"/);
  const def = defMatch ? parseInt(defMatch[1]) : 0;
  const armorType = armorTypeMatch ? armorTypeMatch[1] : '';
  return def === 0 && (armorType === 'headgear' || armorType === 'accessory');
});

console.log(`\n原始防具: ${armors.length}`);
console.log(`遊戲中存在: ${armors.filter(a => imgIdMap[a.id]).length}`);
console.log(`遊戲中不存在: ${invalidArmors.length}`);
console.log(`時裝 (DEF=0 headgear/accessory): ${fashionArmors.length}`);
console.log(`有效防具: ${validArmors.length}`);

// 更新 engine.js 中的 NPC_SHOPS
const weaponGameIds = validWeapons.map(w => imgIdMap[w.id]);
const armorGameIds = validArmors.map(a => imgIdMap[a.id]);

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
