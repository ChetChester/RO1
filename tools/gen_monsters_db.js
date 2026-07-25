const fs = require('fs');

// 讀取轉換後的怪物資料
const monstersData = JSON.parse(fs.readFileSync('D:/mimo/ro-idle/tools/monsters_converted.json', 'utf8'));

// 讀取現有的 data.js 來保留道具定義
const dataContent = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// 從現有 data.js 提取道具 ID 列表（用於掉落物驗證）
const itemIds = new Set();
const itemMatch = dataContent.match(/(\w+):\s*\{\s*id:\s*'[^']+'/g);
if (itemMatch) {
  itemMatch.forEach(m => {
    const id = m.match(/id:\s*'([^']+)'/);
    if (id) itemIds.add(id[1]);
  });
}

// 遊戲中使用的道具對照（RO 道具 ID → 遊戲道具 ID）
const ITEM_MAP = {
  501: 'red_potion', 502: 'orange_potion', 503: 'yellow_potion', 504: 'white_potion',
  506: 'blue_potion', 2001: 'red_potion', 2002: 'orange_potion', 2003: 'yellow_potion',
  2004: 'white_potion', 2005: 'fresh_fish', 2006: 'blue_potion',
  1011: 'jellopy', 939: 'fluff', 940: 'fang', 916: 'feather',
  990: 'snake_squama', 962: 'tentacle', 991: 'shell', 713: 'empty_bottle', 6034: 'starfish',
  // 裝備
  1750: 'dagger_basic', 1752: 'dagger_cutter', 1754: 'dagger_main',
  1756: 'dagger_dirk', 1758: 'dagger_stiletto',
  1710: 'sword_basic', 1712: 'sword_falchion', 1714: 'sword_blade',
  1716: 'sword_rapier', 1718: 'sword_saber', 1720: 'sword_flamberge',
  1762: 'tsword_zweihander', 1764: 'tsword_claymore',
  1766: 'tsword_buster', 1768: 'tsword_mass',
  1713: 'bow_basic', 1715: 'bow_composite', 1717: 'bow_great',
  1719: 'bow_cross', 1721: 'bow_gakkung',
  1601: 'wand_basic', 1603: 'rod_branch', 1605: 'rod_wand',
  1607: 'rod_arcane', 1609: 'rod_staff',
  1611: 'mace_club', 1613: 'mace_mace',
  1201: 'cloth_armor', 1203: 'leather_armor',
  2101: 'shield_basic', 2103: 'shield_iron',
};

// 屬性名稱映射
const ELEMENT_NAMES_CN = {
  'none': '無', 'water': '水', 'earth': '地', 'fire': '火', 'wind': '風',
  'poison': '毒', 'holy': '聖', 'shadow': '暗', 'ghost': '念', 'undead': '不死'
};

// 轉換怪物資料為遊戲格式
function convertMonster(m) {
  const stats = m.stats || {};

  // 解析屬性
  let element = 'none';
  const elemStr = stats['属性'] || '';
  if (elemStr.includes('水')) element = 'water';
  else if (elemStr.includes('地')) element = 'earth';
  else if (elemStr.includes('火')) element = 'fire';
  else if (elemStr.includes('风')) element = 'wind';
  else if (elemStr.includes('毒')) element = 'poison';
  else if (elemStr.includes('圣')) element = 'holy';
  else if (elemStr.includes('暗')) element = 'shadow';
  else if (elemStr.includes('念')) element = 'ghost';
  else if (elemStr.includes('不死')) element = 'undead';

  // 解析掉落物
  const drops = (m.drops || []).map(d => {
    const gameId = ITEM_MAP[d.item_id];
    if (!gameId || !itemIds.has(gameId)) return null;
    return { item: gameId, chance: parseFloat(d.drop_rate) / 100 };
  }).filter(d => d !== null);

  return {
    id: m.id,
    imgId: m.imgId,
    name: m.name,
    icon: m.icon,
    level: m.level,
    hp: m.hp,
    atk: m.atk,
    def: m.def,
    element: element,
    exp: m.exp,
    jobExp: m.jobExp,
    drops: drops
  };
}

// 生成怪物資料
let output = '/* ============================================================\n';
output += '   RO 放置世界 — 怪物資料表\n';
output += '   資料來源：RO 官方怪物資料庫\n';
output += '   ============================================================ */\n\n';

output += 'const MONSTERS = {\n';

const monsterKeys = Object.keys(monstersData);
monsterKeys.forEach((key, idx) => {
  const m = monstersData[key];
  const converted = convertMonster(m);
  const dropsStr = JSON.stringify(converted.drops);
  const comma = idx < monsterKeys.length - 1 ? ',' : '';

  output += `  ${key}: { id: '${converted.id}', imgId: ${converted.imgId}, name: '${converted.name}', icon: '${converted.icon}', level: ${converted.level}, hp: ${converted.hp}, atk: ${converted.atk}, def: ${converted.def}, element: '${converted.element}', exp: ${converted.exp}, jobExp: ${converted.jobExp}, drops: ${dropsStr} }${comma}\n`;
});

output += '};\n';

fs.writeFileSync('D:/mimo/ro-idle/tools/monsters_db.js', output);

console.log(`Generated monsters_db.js with ${monsterKeys.length} monsters`);
