const fs = require('fs');

// 讀取新的怪物資料庫
const monstersContent = fs.readFileSync('D:/mimo/ro-idle/tools/monsters_db_clean.js', 'utf8');

// 讀取原始 data.js（從 ro-idle 資料夾的備份）
// 由於原始檔案已損壞，我們需要從其他來源還原

// 從 monsters_db_clean.js 提取怪物資料
const monstersStart = monstersContent.indexOf('const MONSTERS = {');
const monstersEnd = monstersContent.lastIndexOf('};') + 2;
const monstersSection = monstersContent.substring(monstersStart, monstersEnd);

// 生成完整的 data.js
let output = '';

output += `/* ============================================================
   RO 放置世界 — 核心資料表
   所有數值/文字資料集中於此，engine.js 只讀取不寫死。
   ============================================================ */

const STAT_KEYS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
const STAT_NAMES = { str: '力量', agi: '敏捷', vit: '體力', int: '智力', dex: '靈巧', luk: '幸運' };
const STAT_DESC = {
  str: '提升物理攻擊力與負重',
  agi: '提升迴避與攻擊速度',
  vit: '提升最大HP與物理防禦',
  int: '提升魔法攻擊力與最大SP',
  dex: '提升命中率與物理攻擊力',
  luk: '提升暴擊率與部分抗性'
};

const ELEMENTS = ['none', 'water', 'earth', 'fire', 'wind', 'poison', 'holy', 'shadow', 'ghost', 'undead'];
const ELEMENT_NAMES = {
  none: '無', water: '水', earth: '地', fire: '火', wind: '風',
  poison: '毒', holy: '聖', shadow: '暗', ghost: '念', undead: '不死'
};
const ELEMENT_ICONS = {
  none: '⚪', water: '💧', earth: '🌍', fire: '🔥', wind: '🌪️',
  poison: '☠️', holy: '✝️', shadow: '🌑', ghost: '👻', undead: '💀'
};
const ELEMENT_CHART = {
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
};
function getElementMultiplier(atkElement, defElement) {
  if (!atkElement || !defElement) return 1;
  const chart = ELEMENT_CHART[atkElement];
  if (!chart) return 1;
  const mult = chart[defElement];
  return mult !== undefined ? mult / 100 : 1;
}

`;

// 讀取原始 data.js 的 JOB_TREE 和 ITEMS 部分
// 由於原始檔案已損壞，我們需要手動重建

// 從 ro-idle 資料夾讀取原始 data.js
try {
  const origData = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');
  
  // 提取 JOB_TREE
  const jobTreeStart = origData.indexOf('const JOB_TREE = {');
  const jobTreeEnd = origData.indexOf('const JOB_TIER3_PLACEHOLDER');
  if (jobTreeStart > 0 && jobTreeEnd > jobTreeStart) {
    output += origData.substring(jobTreeStart, jobTreeEnd) + '\n';
  }
  
  // 提取 JOB_TIER3_PLACEHOLDER
  const placeholderStart = origData.indexOf('const JOB_TIER3_PLACEHOLDER');
  const placeholderEnd = origData.indexOf('];', placeholderStart) + 2;
  if (placeholderStart > 0 && placeholderEnd > placeholderStart) {
    output += origData.substring(placeholderStart, placeholderEnd) + '\n\n';
  }
  
  // 提取 ITEMS
  const itemsStart = origData.indexOf('const ITEMS = {');
  const itemsEnd = origData.indexOf('/* ---------------- 怪物 ----------------');
  if (itemsStart > 0 && itemsEnd > itemsStart) {
    output += origData.substring(itemsStart, itemsEnd) + '\n';
  }
} catch (e) {
  console.log('Could not read original data.js:', e.message);
  output += '// ITEMS section missing - need to restore from backup\n\n';
}

// 加入怪物資料
output += '/* ---------------- 怪物 ----------------\n';
output += '   資料來源：RO 官方怪物資料庫\n';
output += '------------------------------------------------- */\n';
output += monstersSection + '\n\n';

// 從原始 data.js 提取其他部分
try {
  const origData = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');
  
  // 提取 MAPS
  const mapsStart = origData.indexOf('const MAPS = [');
  const mapsEnd = origData.indexOf('/* ---------------- 地區分類 ----------------');
  if (mapsStart > 0 && mapsEnd > mapsStart) {
    output += origData.substring(mapsStart, mapsEnd) + '\n';
  }
  
  // 提取 REGIONS
  const regionsStart = origData.indexOf('const REGIONS = [');
  const regionsEnd = origData.indexOf('function regionOf');
  if (regionsStart > 0 && regionsEnd > regionsStart) {
    output += origData.substring(regionsStart, regionsEnd) + '\n';
  }
  
  // 提取 regionOf
  const regionOfStart = origData.indexOf('function regionOf');
  const regionOfEnd = origData.indexOf('function pickWeightedMonster');
  if (regionOfStart > 0 && regionOfEnd > regionOfStart) {
    output += origData.substring(regionOfStart, regionOfEnd) + '\n';
  }
  
  // 提取 pickWeightedMonster
  const pickStart = origData.indexOf('function pickWeightedMonster');
  const pickEnd = origData.indexOf('function mapImgSrc');
  if (pickStart > 0 && pickEnd > pickStart) {
    output += origData.substring(pickStart, pickEnd) + '\n';
  }
  
  // 提取 mapImgSrc
  const mapImgStart = origData.indexOf('function mapImgSrc');
  const mapImgEnd = origData.indexOf('const MUSIC_EXTS');
  if (mapImgStart > 0 && mapImgEnd > mapImgStart) {
    output += origData.substring(mapImgStart, mapImgEnd) + '\n';
  }
  
  // 提取 MUSIC_EXTS 和 mapMusicUrl
  const musicStart = origData.indexOf('const MUSIC_EXTS');
  const musicEnd = origData.indexOf('/* ---------------- 藥水等級');
  if (musicStart > 0 && musicEnd > musicStart) {
    output += origData.substring(musicStart, musicEnd) + '\n';
  }
  
  // 提取藥水等級
  const potionStart = origData.indexOf('/* ---------------- 藥水等級');
  const potionEnd = origData.indexOf('/* ---------------- 怪物卡片系統');
  if (potionStart > 0 && potionEnd > potionStart) {
    output += origData.substring(potionStart, potionEnd) + '\n';
  }
  
  // 提取怪物卡片系統
  const cardStart = origData.indexOf('/* ---------------- 怪物卡片系統');
  const cardEnd = origData.indexOf('/* ---------------- 精煉系統');
  if (cardStart > 0 && cardEnd > cardStart) {
    output += origData.substring(cardStart, cardEnd) + '\n';
  }
  
  // 提取精煉系統
  const refStart = origData.indexOf('/* ---------------- 精煉系統');
  const refEnd = origData.indexOf('function getRefinementCost');
  if (refStart > 0 && refEnd > refStart) {
    output += origData.substring(refStart, refEnd) + '\n';
  }
  
  // 提取精煉函式
  const refFuncStart = origData.indexOf('function getRefinementCost');
  const refFuncEnd = origData.indexOf('/* ---------------- 藥水等級（由低到高');
  if (refFuncStart > 0 && refFuncEnd > refFuncStart) {
    output += origData.substring(refFuncStart, refFuncEnd) + '\n';
  }
  
  // 提取經驗值曲線
  const expStart = origData.indexOf('/* ---------------- 經驗值曲線');
  if (expStart > 0) {
    output += origData.substring(expStart) + '\n';
  }
} catch (e) {
  console.log('Error extracting sections:', e.message);
}

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', output);

console.log('Built complete data.js');
console.log('File size:', output.length);
console.log('Lines:', output.split('\n').length);
