const fs = require('fs');

// 讀取目前的 data.js
let dataContent = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// 找到插入點（在 MONSTERS 之前）
const monstersMarker = '/* ---------------- 怪物 ----------------';
const insertPoint = dataContent.indexOf(monstersMarker);

if (insertPoint === -1) {
  console.log('ERROR: Could not find monsters marker');
  process.exit(1);
}

// 從 engine.js 中提取 NPC_SHOPS 的物品列表
const engineContent = fs.readFileSync('D:/mimo/ro-idle/js/engine.js', 'utf8');
const shopItemsMatch = engineContent.match(/items:\s*\[([^\]]+)\]/);
let shopItems = [];
if (shopItemsMatch) {
  shopItems = shopItemsMatch[1].split(',').map(s => s.trim().replace(/'/g, ''));
}

// 從 engine.js 中提取物品 ID
const itemIds = new Set();
shopItems.forEach(id => itemIds.add(id));

// 從 monsters_db_clean.js 中提取掉落物品 ID
const monstersContent = fs.readFileSync('D:/mimo/ro-idle/tools/monsters_db_clean.js', 'utf8');
const dropMatches = monstersContent.match(/item:'([^']+)'/g);
if (dropMatches) {
  dropMatches.forEach(m => {
    const id = m.match(/item:'([^']+)'/)[1];
    itemIds.add(id);
  });
}

// 建立基本物品資料
const items = {};

// 藥水
items.red_potion = { id: 'red_potion', imgId: 501, name: '紅色藥水', type: 'consumable', icon: '🧪', heal: 55, weight: 7, buyPrice: 50, sell: 25, desc: '基礎的回復藥水。' };
items.orange_potion = { id: 'orange_potion', imgId: 502, name: '橘色藥水', type: 'consumable', icon: '🍊', heal: 125, weight: 10, buyPrice: 200, sell: 100, desc: '中級回復藥水。' };
items.yellow_potion = { id: 'yellow_potion', imgId: 503, name: '黃色藥水', type: 'consumable', icon: '🟡', heal: 205, weight: 13, buyPrice: 550, sell: 275, desc: '高級回復藥水。' };
items.white_potion = { id: 'white_potion', imgId: 504, name: '白色藥水', type: 'consumable', icon: '🥛', heal: 365, weight: 15, buyPrice: 1200, sell: 600, desc: '最高級的回復藥水。' };
items.blue_potion = { id: 'blue_potion', imgId: 506, name: '藍色藥水', type: 'consumable', icon: '💧', restoreSp: 50, weight: 15, buyPrice: 0, sell: 0, desc: '回復SP的藥水。' };

// 素材
items.jellopy = { id: 'jellopy', imgId: 1011, name: '果凍質塊', type: 'material', icon: '🟡', weight: 1, sell: 1, desc: '波利掉落的黏稠物質。' };
items.fluff = { id: 'fluff', imgId: 939, name: '獸毛', type: 'material', icon: '🐾', weight: 1, sell: 2, desc: '柔軟的動物毛絮。' };
items.fang = { id: 'fang', imgId: 940, name: '尖牙', type: 'material', icon: '🦷', weight: 1, sell: 5, desc: '狼類怪物的利牙。' };
items.feather = { id: 'feather', imgId: 916, name: '羽毛', type: 'material', icon: '🪶', weight: 1, sell: 3, desc: '輕盈的鳥類羽毛。' };
items.tentacle = { id: 'tentacle', imgId: 962, name: '觸手', type: 'material', icon: '🦑', weight: 1, sell: 3, desc: '海葵的觸手。' };
items.shell = { id: 'shell', imgId: 991, name: '貝殼', type: 'material', icon: '🐚', weight: 1, sell: 5, desc: '堅硬的貝殼碎片。' };
items.snake_squama = { id: 'snake_squama', imgId: 990, name: '蛇鱗', type: 'material', icon: '🐍', weight: 1, sell: 5, desc: '蛇類怪物的鱗片。' };
items.empty_bottle = { id: 'empty_bottle', imgId: 713, name: '空瓶', type: 'material', icon: '🍶', weight: 1, sell: 5, desc: '空的玻璃瓶。' };
items.starfish = { id: 'starfish', imgId: 6034, name: '海星', type: 'material', icon: '⭐', weight: 1, sell: 5, desc: '從海底撿到的海星。' };

// 武器
items.dagger_basic = { id: 'dagger_basic', imgId: 1750, name: '小刀', type: 'weapon', weaponType: 'dagger', icon: '🔪', atk: 17, weaponWeight: 1, sell: 12, buyPrice: 24, reqJobTier: [1, 2], reqLevel: 2, desc: '基礎的小刀。' };
items.sword_basic = { id: 'sword_basic', imgId: 1710, name: '劍', type: 'weapon', weaponType: 'sword', icon: '🗡️', atk: 25, weaponWeight: -3, sell: 15, buyPrice: 30, reqJobTier: [1, 2], reqLevel: 2, desc: '基礎的劍。' };
items.sword_falchion = { id: 'sword_falchion', imgId: 1712, name: '彎刀', type: 'weapon', weaponType: 'sword', icon: '🗡️', atk: 39, weaponWeight: -4, sell: 23, buyPrice: 46, reqJobTier: [1, 2], reqLevel: 2, desc: '彎曲的劍。' };
items.sword_blade = { id: 'sword_blade', imgId: 1714, name: '利刃', type: 'weapon', weaponType: 'sword', icon: '🗡️', atk: 53, weaponWeight: -5, sell: 31, buyPrice: 62, reqJobTier: [1, 2], reqLevel: 2, desc: '鋒利的劍。' };
items.sword_rapier = { id: 'sword_rapier', imgId: 1716, name: '刺劍', type: 'weapon', weaponType: 'sword', icon: '⚔️', atk: 70, weaponWeight: -6, sell: 42, buyPrice: 84, reqJobTier: [1, 2], reqLevel: 14, desc: '細長的刺劍。' };
items.sword_saber = { id: 'sword_saber', imgId: 1718, name: '軍刀', type: 'weapon', weaponType: 'sword', icon: '⚔️', atk: 115, weaponWeight: -7, sell: 69, buyPrice: 138, reqJobTier: [1, 2], reqLevel: 27, desc: '標準的軍刀。' };
items.bow_basic = { id: 'bow_basic', imgId: 1713, name: '弓', type: 'weapon', weaponType: 'bow', icon: '🏹', atk: 15, weaponWeight: -3, sell: 9, buyPrice: 18, reqJobTier: [1, 2], reqLevel: 4, desc: '基礎的弓。' };
items.wand_basic = { id: 'wand_basic', imgId: 1601, name: '法杖', type: 'weapon', weaponType: 'rod', icon: '🪄', matk: 15, weaponWeight: -3, sell: 9, buyPrice: 18, reqJobTier: [1, 2], reqLevel: 2, desc: '基礎的法杖。' };
items.tsword_zweihander = { id: 'tsword_zweihander', imgId: 1762, name: '雙手劍', type: 'weapon', weaponType: 'tsword', icon: '⚔️', atk: 35, weaponWeight: -15, sell: 80, buyPrice: 160, reqJobTier: [1, 2], reqLevel: 8, reqJob: ['swordsman', 'knight'], desc: '標準的雙手劍。' };

// 防具
items.cloth_armor = { id: 'cloth_armor', imgId: 1201, name: '棉製襯衫', type: 'armor', armorType: 'cloth', icon: '🧥', def: 10, weight: 10, sell: 5, buyPrice: 10, reqLevel: 1, desc: '基礎的棉製衬衫。' };
items.leather_armor = { id: 'leather_armor', imgId: 1203, name: '木製護甲', type: 'armor', armorType: 'leather', icon: '🦺', def: 15, weight: 80, sell: 50, buyPrice: 100, reqLevel: 1, desc: '木製的護甲。' };
items.shield_basic = { id: 'shield_basic', imgId: 2101, name: '盾牌', type: 'armor', armorType: 'shield', icon: '🛡️', def: 10, weight: 50, sell: 50, buyPrice: 100, reqJob: ['swordsman', 'knight', 'merchant', 'blacksmith', 'acolyte', 'priest'], desc: '基礎的盾牌。' };

// 生成 ITEMS 物件
let itemsStr = 'const ITEMS = {\n';
Object.values(items).forEach((item, idx) => {
  const comma = idx < Object.values(items).length - 1 ? ',' : '';
  itemsStr += `  ${item.id}: ${JSON.stringify(item)}${comma}\n`;
});
itemsStr += '};\n\n';

// 從原始 data.js 提取 MAPS（如果有的話）
let mapsSection = '';
try {
  const origData = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');
  const mapsStart = origData.indexOf('const MAPS = [');
  const mapsEnd = origData.indexOf('/* ---------------- 地區分類 ----------------');
  if (mapsStart > 0 && mapsEnd > mapsStart) {
    mapsSection = origData.substring(mapsStart, mapsEnd);
  }
} catch (e) {
  console.log('Could not extract MAPS:', e.message);
}

// 插入 ITEMS 和 MAPS
const newData = dataContent.substring(0, insertPoint) + itemsStr + mapsSection + '\n' + dataContent.substring(insertPoint);

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', newData);

console.log('Added ITEMS and MAPS sections');
console.log('New file size:', newData.length);
