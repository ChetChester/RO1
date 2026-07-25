/* ============================================================
   商店標記工具
   將有商店販售的物品加上 shop: true 標記
   
   使用方式：node tools/add_shop_flags.js
   ============================================================ */

const fs = require('fs');
const path = require('path');

// ---- 讀取資料 ----
const rawItems = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'ro_items_data', 'items.json'), 'utf8')
);
const itemMap = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'item_id_map.json'), 'utf8')
);
const dataPath = path.join(__dirname, '..', 'js', 'data.js');
let data = fs.readFileSync(dataPath, 'utf8');

// 商店 NPC ID（主要販售基礎裝備的 NPC）
const SHOP_NPCS = [603, 617, 12023, 12623];

console.log(`已載入 ${rawItems.length} 個原始物品`);
console.log(`已載入 ${Object.keys(itemMap).length} 個物品對照`);

// ---- 建立 imgId → shop 標記 ----
const shopItems = new Set(); // 存放有商店販售的物品 imgId

for (const item of rawItems) {
  if (!item.other_sources) continue;
  
  // 檢查是否有任一商店 NPC
  const hasShop = item.other_sources.some(s => SHOP_NPCS.includes(s));
  if (hasShop) {
    shopItems.add(item.id);
  }
}

console.log(`\n有商店販售的物品: ${shopItems.size}`);

// ---- 更新 data.js ----
let updateCount = 0;

// 找到 ITEMS 區塊
const itemsStart = data.indexOf('const ITEMS = {');
const itemsEnd = data.indexOf('\n};', itemsStart) + 3;
const itemsBlock = data.substring(itemsStart, itemsEnd);

// 對每個物品加上 shop: true
const itemRegex = /(\w+):\s*\{([^}]*"imgId":(\d+))([^}]*)\}/g;
let newItemsBlock = itemsBlock;
let m;

while ((m = itemRegex.exec(itemsBlock)) !== null) {
  const fullMatch = m[0];
  const imgId = parseInt(m[3]);
  
  if (shopItems.has(imgId) && !fullMatch.includes('"shop":')) {
    // 在 desc 之前插入 shop: true
    const replacement = m[1] + ': {' + m[2] + ',"shop":true' + m[4] + '}';
    newItemsBlock = newItemsBlock.replace(fullMatch, replacement);
    updateCount++;
  }
}

// 替換 ITEMS 區塊
data = data.substring(0, itemsStart) + newItemsBlock + data.substring(itemsEnd);

fs.writeFileSync(dataPath, data, 'utf8');
console.log(`已更新 ${updateCount} 個物品加上 shop: true`);

// ---- 統計 ----
const shopCount = (data.match(/"shop":true/g) || []).length;
console.log(`更新後有 shop 標記的物品: ${shopCount}`);
