const fs = require('fs');

// 讀取目前的 data.js
let dataContent = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// 找到插入點（在 MAPS 之前）
const mapsMarker = 'const MAPS = [';
const insertPoint = dataContent.indexOf(mapsMarker);

if (insertPoint === -1) {
  console.log('ERROR: Could not find MAPS marker');
  process.exit(1);
}

// CARDS 和 MONSTER_CARD_DROPS 資料
const cardsSection = `/* ---------------- 怪物卡片系統 ---------------- */
const CARDS = {
  poring_card: { id: 'poring_card', monsterId: 'poring', name: '波利卡片', icon: '🟢', slot: 'any', bonus: { hp: 50 }, desc: 'MaxHP +50' },
  lunatic_card: { id: 'lunatic_card', monsterId: 'lunatic', name: '瘋兔卡片', icon: '🐇', slot: 'any', bonus: { luk: 3 }, desc: 'LUK +3' },
  fabre_card: { id: 'fabre_card', monsterId: 'fabre', name: '綠棉蟲卡片', icon: '🐛', slot: 'any', bonus: { def: 3 }, desc: 'DEF +3' },
  hornet_card: { id: 'hornet_card', monsterId: 'hornet', name: '蜂兵卡片', icon: '🐝', slot: 'weapon', bonus: { atk: 8 }, desc: 'ATK +8' },
  hydra_card: { id: 'hydra_card', monsterId: 'hydra', name: '海葵卡片', icon: '🪸', slot: 'armor', bonus: { def: 3, hp: 80 }, desc: 'DEF +3, MaxHP +80' },
  plankton_card: { id: 'plankton_card', monsterId: 'plankton', name: '浮游生物卡片', icon: '🦠', slot: 'weapon', bonus: { atk: 5 }, desc: 'ATK +5' },
  kukre_card: { id: 'kukre_card', monsterId: 'kukre', name: '海星卡片', icon: '⭐', slot: 'weapon', bonus: { atk: 8 }, desc: 'ATK +8' },
  marina_card: { id: 'marina_card', monsterId: 'marina', name: '水母卡片', icon: '🪼', slot: 'armor', bonus: { def: 5 }, desc: 'DEF +5' },
  vadon_card: { id: 'vadon_card', monsterId: 'vadon', name: '螃蟹卡片', icon: '🦀', slot: 'armor', bonus: { def: 8 }, desc: 'DEF +8' },
  cornutus_card: { id: 'cornutus_card', monsterId: 'cornutus', name: '貝殼卡片', icon: '🐚', slot: 'armor', bonus: { def: 6 }, desc: 'DEF +6' },
  marse_card: { id: 'marse_card', monsterId: 'marse', name: '海龜卡片', icon: '🐢', slot: 'armor', bonus: { def: 10, hp: 120 }, desc: 'DEF +10, MaxHP +120' },
  obeaune_card: { id: 'obeaune_card', monsterId: 'obeaune', name: '人魚卡片', icon: '🧜', slot: 'weapon', bonus: { matk: 10 }, desc: 'MATK +10' },
  merman_card: { id: 'merman_card', monsterId: 'merman', name: '人魚士兵卡片', icon: '🧜‍♂️', slot: 'weapon', bonus: { atk: 12 }, desc: 'ATK +12' },
  marine_sphere_card: { id: 'marine_sphere_card', monsterId: 'marine_sphere', name: '氣泡蟲卡片', icon: '🫧', slot: 'weapon', bonus: { atk: 5 }, desc: 'ATK +5' },
  phen_card: { id: 'phen_card', monsterId: 'phen', name: '水母卡片', icon: '🪼', slot: 'armor', bonus: { def: 5 }, desc: 'DEF +5' },
  marc_card: { id: 'marc_card', monsterId: 'marc', name: '海馬卡片', icon: '🐴', slot: 'weapon', bonus: { atk: 15 }, desc: 'ATK +15' },
  swordfish_card: { id: 'swordfish_card', monsterId: 'swordfish', name: '劍魚卡片', icon: '🗡️', slot: 'weapon', bonus: { atk: 20 }, desc: 'ATK +20' }
};

const MONSTER_CARD_DROPS = {
  poring: { card: 'poring_card', chance: 0.005 },
  lunatic: { card: 'lunatic_card', chance: 0.005 },
  fabre: { card: 'fabre_card', chance: 0.005 },
  hornet: { card: 'hornet_card', chance: 0.005 },
  hydra: { card: 'hydra_card', chance: 0.005 },
  plankton: { card: 'plankton_card', chance: 0.005 },
  kukre: { card: 'kukre_card', chance: 0.005 },
  marina: { card: 'marina_card', chance: 0.005 },
  vadon: { card: 'vadon_card', chance: 0.005 },
  cornutus: { card: 'cornutus_card', chance: 0.005 },
  marse: { card: 'marse_card', chance: 0.005 },
  obeaune: { card: 'obeaune_card', chance: 0.005 },
  merman: { card: 'merman_card', chance: 0.008 },
  marine_sphere: { card: 'marine_sphere_card', chance: 0.005 },
  phen: { card: 'phen_card', chance: 0.005 },
  marc: { card: 'marc_card', chance: 0.008 },
  swordfish: { card: 'swordfish_card', chance: 0.008 }
};

`;

// 插入 CARDS 和 MONSTER_CARD_DROPS
const newData = dataContent.substring(0, insertPoint) + cardsSection + '\n' + dataContent.substring(insertPoint);

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', newData);

console.log('Added CARDS and MONSTER_CARD_DROPS sections');
console.log('New file size:', newData.length);
