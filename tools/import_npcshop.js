/* 用 ro_npcshop_data 更新遊戲商店 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const enginePath = path.join(__dirname, '..', 'js', 'engine.js');
let data = fs.readFileSync(dataPath, 'utf8');
let engine = fs.readFileSync(enginePath, 'utf8');

// 讀取商店資料
const weaponData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_npcshop_data', 'weapon_list.json'), 'utf8'));
const armorData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_npcshop_data', 'armor_list.json'), 'utf8'));

const weapons = weaponData.pre_re;
const armors = armorData.pre_re;

console.log(`武器商店: ${weapons.length} 個物品`);
console.log(`防具商店: ${armors.length} 個物品`);

// 1. 更新 data.js 中的 buyPrice 和 sellPrice
let weaponUpdate = 0, armorUpdate = 0, missingItems = [];

// 更新武器
for (const w of weapons) {
  const regex = new RegExp(`"imgId":${w.id}`);
  if (data.match(regex)) {
    // 更新 buyPrice
    const buyRegex = new RegExp(`("imgId":${w.id}[^}]*?"buyPrice":)(\\d+)`);
    if (data.match(buyRegex)) {
      data = data.replace(buyRegex, `$1${w.price}`);
    } else {
      const addRegex = new RegExp(`("imgId":${w.id}[^}]*?)}`);
      data = data.replace(addRegex, `$1,"buyPrice":${w.price}}`);
    }
    // 更新 sellPrice (buy / 2)
    const sellPrice = Math.floor(w.price / 2);
    const sellRegex = new RegExp(`("imgId":${w.id}[^}]*?"sell":)(\\d+)`);
    if (data.match(sellRegex)) {
      data = data.replace(sellRegex, `$1${sellPrice}`);
    }
    weaponUpdate++;
  } else {
    missingItems.push({ type: 'weapon', id: w.id, name: w.name });
  }
}

// 更新防具
for (const a of armors) {
  const regex = new RegExp(`"imgId":${a.id}`);
  if (data.match(regex)) {
    const buyRegex = new RegExp(`("imgId":${a.id}[^}]*?"buyPrice":)(\\d+)`);
    if (data.match(buyRegex)) {
      data = data.replace(buyRegex, `$1${a.price}`);
    } else {
      const addRegex = new RegExp(`("imgId":${a.id}[^}]*?)}`);
      data = data.replace(addRegex, `$1,"buyPrice":${a.price}}`);
    }
    const sellPrice = Math.floor(a.price / 2);
    const sellRegex = new RegExp(`("imgId":${a.id}[^}]*?"sell":)(\\d+)`);
    if (data.match(sellRegex)) {
      data = data.replace(sellRegex, `$1${sellPrice}`);
    }
    armorUpdate++;
  } else {
    missingItems.push({ type: 'armor', id: a.id, name: a.name });
  }
}

console.log(`\n更新了 ${weaponUpdate} 個武器的價格`);
console.log(`更新了 ${armorUpdate} 個防具的價格`);

if (missingItems.length > 0) {
  console.log(`\n遊戲中未找到的物品 (${missingItems.length}):`);
  missingItems.forEach(i => console.log(`  ${i.type}: ${i.id} ${i.name}`));
}

fs.writeFileSync(dataPath, data, 'utf8');
console.log('\ndata.js 已儲存');

// 2. 更新 engine.js 中的 NPC_SHOPS
// 從商店資料中提取物品 ID，轉換為遊戲 ID
function getGameId(imgId) {
  const regex = new RegExp(`"imgId":${imgId}`);
  const match = data.match(regex);
  if (match) {
    const before = data.substring(Math.max(0, match.index - 200), match.index);
    const idMatch = before.match(/(\w+):\s*\{"id":"(\w+)"/);
    if (idMatch) return idMatch[2];
  }
  return null;
}

// 取得所有武器商店物品的遊戲 ID
const weaponGameIds = weapons
  .map(w => getGameId(w.id))
  .filter(Boolean);

// 取得所有防具商店物品的遊戲 ID
const armorGameIds = armors
  .map(a => getGameId(a.id))
  .filter(Boolean);

console.log(`\n武器商店: ${weaponGameIds.length} 個物品（遊戲 ID）`);
console.log(`防具商店: ${armorGameIds.length} 個物品（遊戲 ID）`);

// 替換 NPC_SHOPS
const newShopCode = `/* ---------------- NPC 商店系統 ---------------- */
/* 基於 ro_npcshop_data 資料，統一全地圖相同 */
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
console.log('engine.js 已儲存');

console.log('\n完成！');
