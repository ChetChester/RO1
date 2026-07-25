const fs = require('fs');

// 讀取轉換後的怪物資料
const monstersData = JSON.parse(fs.readFileSync('D:/mimo/ro-idle/tools/monsters_converted.json', 'utf8'));

// 讀取現有的 data.js 來提取道具 ID
const dataContent = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');
const itemIds = new Set();
const itemMatches = dataContent.match(/(\w+):\s*\{\s*id:\s*'([^']+)'/g);
if (itemMatches) {
  itemMatches.forEach(m => {
    const id = m.match(/id:\s*'([^']+)'/);
    if (id) itemIds.add(id[1]);
  });
}

// 遊戲中使用的道具對照
const ITEM_MAP = {
  501: 'red_potion', 502: 'orange_potion', 503: 'yellow_potion', 504: 'white_potion',
  506: 'blue_potion', 2001: 'red_potion', 2002: 'orange_potion', 2003: 'yellow_potion',
  2004: 'white_potion', 2005: 'fresh_fish', 2006: 'blue_potion',
  1011: 'jellopy', 939: 'fluff', 940: 'fang', 916: 'feather',
  990: 'snake_squama', 962: 'tentacle', 991: 'shell', 713: 'empty_bottle', 6034: 'starfish',
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

// 生成怪物資料（使用原始格式）
let output = '/* ============================================================\n';
output += '   RO 放置世界 — 怪物資料表\n';
output += '   資料來源：RO 官方怪物資料庫\n';
output += '   ============================================================ */\n\n';

output += 'const MONSTERS = {\n';

const monsterKeys = Object.keys(monstersData);
monsterKeys.forEach((key, idx) => {
  const m = monstersData[key];

  // 轉換掉落物
  const drops = (m.drops || []).map(d => {
    const gameId = ITEM_MAP[d.item_id];
    if (!gameId || !itemIds.has(gameId)) return null;
    const chance = d.drop_rate || d.chance || 0;
    return `{item:'${gameId}',chance:${chance.toFixed(4)}}`;
  }).filter(d => d !== null);

  const dropsStr = drops.length > 0 ? `[${drops.join(',')}]` : '[]';
  const comma = idx < monsterKeys.length - 1 ? ',' : '';

  output += `  ${key}: {id:'${key}',imgId:${m.imgId},name:'${m.name.replace(/'/g,"\\'")}',icon:'${m.icon}',level:${m.level},hp:${m.hp},atk:${m.atk},def:${m.def},element:'${m.element}',exp:${m.exp},jobExp:${m.jobExp},drops:${dropsStr}}${comma}\n`;
});

output += '};\n';

fs.writeFileSync('D:/mimo/ro-idle/tools/monsters_db_clean.js', output);

console.log(`Generated monsters_db_clean.js with ${monsterKeys.length} monsters`);
