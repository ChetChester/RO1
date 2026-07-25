const fs = require('fs');

// 讀取新的怪物資料庫
const monstersContent = fs.readFileSync('D:/mimo/ro-idle/tools/monsters_db_clean.js', 'utf8');

// 讀取原始 data.js 的其他部分
const originalData = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// 提取各個部分
function extractSection(content, startMarker, endMarker) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start);
  if (start === -1 || end === -1) return null;
  return content.substring(start, end);
}

// 提取各個 section
const statKeys = extractSection(originalData, "const STAT_KEYS", "const STAT_NAMES");
const statNames = extractSection(originalData, "const STAT_NAMES", "const STAT_DESC");
const statDesc = extractSection(originalData, "const STAT_DESC", "const ELEMENTS");
const elements = extractSection(originalData, "const ELEMENTS", "const ELEMENT_NAMES");
const elementNames = extractSection(originalData, "const ELEMENT_NAMES", "const ELEMENT_ICONS");
const elementIcons = extractSection(originalData, "const ELEMENT_ICONS", "const ELEMENT_CHART");
const elementChart = extractSection(originalData, "const ELEMENT_CHART", "function getElementMultiplier");
const getElementMult = extractSection(originalData, "function getElementMultiplier", "/* ---------------- 職業樹 ----------------");
const jobTree = extractSection(originalData, "/* ---------------- 職業樹 ----------------", "/* ---------------- 道具 ----------------");
const items = extractSection(originalData, "/* ---------------- 道具 ----------------", "/* ---------------- 怪物 ----------------");
const maps = extractSection(originalData, "const MAPS = [", "/* ---------------- 地區分類 ----------------");
const regions = extractSection(originalData, "const REGIONS = [", "function regionOf");
const regionOf = extractSection(originalData, "function regionOf", "function pickWeightedMonster");
const pickWeighted = extractSection(originalData, "function pickWeightedMonster", "function mapImgSrc");
const mapImgSrc = extractSection(originalData, "function mapImgSrc", "const MUSIC_EXTS");
const musicExts = extractSection(originalData, "const MUSIC_EXTS", "function mapMusicUrl");
const mapMusicUrl = extractSection(originalData, "function mapMusicUrl", "/* ---------------- 藥水等級");
const potionTiers = extractSection(originalData, "/* ---------------- 藥水等級", "/* ---------------- 經驗值曲線");
const expCurve = extractSection(originalData, "/* ---------------- 經驗值曲線", "function expToNextBaseLevel");
const expFunctions = extractSection(originalData, "function expToNextBaseLevel", "/* ---------------- 精煉系統");
const refinement = extractSection(originalData, "/* ---------------- 精煉系統", "/* ---------------- 怪物卡片系統");
const cards = extractSection(originalData, "const CARDS = {", "const MONSTER_CARD_DROPS");
const monCardDrops = extractSection(originalData, "const MONSTER_CARD_DROPS", "const EQUIP_CARD_SLOTS");
const equipSlots = extractSection(originalData, "const EQUIP_CARD_SLOTS", "/* ---------------- 圖片路徑輔助函式");
const imgHelpers = extractSection(originalData, "/* ---------------- 圖片路徑輔助函式", "function monsterImgSrc");
const monsterImgSrc = extractSection(originalData, "function monsterImgSrc", "function itemImgSrc");
const itemImgSrc = extractSection(originalData, "function itemImgSrc", "function placeholderImgSrc");
const placeholderImgSrc = extractSection(originalData, "function placeholderImgSrc", "function itemPlaceholderKind");
const itemPlaceholderKind = extractSection(originalData, "function itemPlaceholderKind", null);

// 組裝新的 data.js
let output = '';

// Header
output += '/* ============================================================\n';
output += '   RO 放置世界 — 核心資料表\n';
output += '   所有數值/文字資料集中於此，engine.js 只讀取不寫死。\n';
output += '   ============================================================ */\n\n';

// STAT section
output += (statKeys || "const STAT_KEYS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];") + '\n';
output += (statNames || "const STAT_NAMES = { str: '力量', agi: '敏捷', vit: '體力', int: '智力', dex: '靈巧', luk: '幸運' };") + '\n';
output += (statDesc || `const STAT_DESC = {
  str: '提升物理攻擊力與負重',
  agi: '提升迴避與攻擊速度',
  vit: '提升最大HP與物理防禦',
  int: '提升魔法攻擊力與最大SP',
  dex: '提升命中率與物理攻擊力',
  luk: '提升暴擊率與部分抗性'
};`) + '\n\n';

// Element section
output += (elements || "const ELEMENTS = ['none', 'water', 'earth', 'fire', 'wind', 'poison', 'holy', 'shadow', 'ghost', 'undead'];") + '\n';
output += (elementNames || `const ELEMENT_NAMES = {
  none: '無', water: '水', earth: '地', fire: '火', wind: '風',
  poison: '毒', holy: '聖', shadow: '暗', ghost: '念', undead: '不死'
};`) + '\n';
output += (elementIcons || `const ELEMENT_ICONS = {
  none: '⚪', water: '💧', earth: '🌍', fire: '🔥', wind: '🌪️',
  poison: '☠️', holy: '✝️', shadow: '🌑', ghost: '👻', undead: '💀'
};`) + '\n';
output += (elementChart || `const ELEMENT_CHART = {
  none:    { none: 100, water: 100, earth: 100, fire: 100, wind: 100, poison: 100, holy: 100, shadow: 100, ghost: 100, undead: 100 },
  water:   { none: 100, water: 25,  earth: 150, fire: 200, wind: 50,  poison: 100, holy: 100, shadow: 100, ghost: 75,  undead: 100 },
  earth:   { none: 100, water: 50,  earth: 25,  fire: 50,  wind: 200, poison: 100, holy: 100, shadow: 100, ghost: 75,  undead: 100 },
  fire:    { none: 100, water: 50,  earth: 200, fire: 25,  wind: 150, poison: 100, holy: 100, shadow: 100, ghost: 75,  undead: 100 },
  wind:    { none: 100, water: 150, earth: 50,  fire: 50,  wind: 25,  poison: 100, holy: 100, shadow: 100, ghost: 75,  undead: 100 },
  poison:  { none: 100, water: 100, earth: 50,  fire: 100, wind: 100, poison: 0,   holy: 50,  shadow: 150, ghost: 100, undead: 100 },
  holy:    { none: 100, water: 100, earth: 100, fire: 100, wind: 100, poison: 100, holy: 0,   shadow: 200, ghost: 100, undead: 200 },
  shadow:  { none: 100, water: 100, earth: 100, fire: 100, wind: 100, poison: 100, holy: 200, shadow: 0,   ghost: 100, undead: 50  },
  ghost:   { none: 100, water: 100, earth: 100, fire: 100, wind: 100, poison: 100, holy: 100, shadow: 100, ghost: 200, undead: 100 },
  undead:  { none: 100, water: 100, earth: 100, fire: 200, wind: 100, poison: 100, holy: 200, shadow: 50,  ghost: 100, undead: 0   }
};`) + '\n';
output += (getElementMult || `function getElementMultiplier(atkElement, defElement) {
  if (!atkElement || !defElement) return 1;
  const chart = ELEMENT_CHART[atkElement];
  if (!chart) return 1;
  const mult = chart[defElement];
  return mult !== undefined ? mult / 100 : 1;
};`) + '\n\n';

// Job Tree section
output += (jobTree || '// Job tree placeholder') + '\n';

// Items section
output += (items || '// Items placeholder') + '\n';

// Monsters section (use new data)
output += monstersContent + '\n';

// Maps section
output += (maps || '// Maps placeholder') + '\n';

// Regions section
output += (regions || '// Regions placeholder') + '\n';
output += (regionOf || 'function regionOf(mapId) { return REGIONS.find(r => r.maps.includes(mapId)); }') + '\n\n';

// Helper functions
output += (pickWeighted || '// pickWeightedMonster placeholder') + '\n';
output += (mapImgSrc || '// mapImgSrc placeholder') + '\n';
output += (musicExts || 'const MUSIC_EXTS = ["mp3", "ogg", "wav"];') + '\n';
output += (mapMusicUrl || '// mapMusicUrl placeholder') + '\n\n';

// Potion section
output += (potionTiers || '// Potion tiers placeholder') + '\n';

// Exp curve
output += (expCurve || '// Exp curve placeholder') + '\n';
output += (expFunctions || `function expToNextBaseLevel(level) { return Math.floor(20 * Math.pow(level, 1.55) + 15); }
function expToNextJobLevel(level) { return Math.floor(15 * Math.pow(level, 1.4) + 10); }`) + '\n\n';

// Refinement section
output += (refinement || '// Refinement placeholder') + '\n';

// Cards section (skip - already in original)
// output += (cards || '// Cards placeholder') + '\n';
// output += (monCardDrops || '// Monster card drops placeholder') + '\n';
// output += (equipSlots || 'const EQUIP_CARD_SLOTS = { weapon: 1, armor: 1, shield: 1, garment: 1, footgear: 1, accessory1: 0, accessory2: 0 };') + '\n\n';

// Image helpers
output += (imgHelpers || '// Image helpers placeholder') + '\n';
output += (monsterImgSrc || '// monsterImgSrc placeholder') + '\n';
output += (itemImgSrc || '// itemImgSrc placeholder') + '\n';
output += (placeholderImgSrc || '// placeholderImgSrc placeholder') + '\n';
output += (itemPlaceholderKind || '// itemPlaceholderKind placeholder') + '\n';

// 寫入
fs.writeFileSync('D:/mimo/ro-idle/js/data.js', output);

console.log('Built new data.js');
console.log('File size:', output.length);
