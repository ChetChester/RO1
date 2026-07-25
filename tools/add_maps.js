const fs = require('fs');

// 讀取目前的 data.js
let dataContent = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// 找到插入點（在 REGIONS 之前）
const regionsMarker = 'const REGIONS = [';
const insertPoint = dataContent.indexOf(regionsMarker);

if (insertPoint === -1) {
  console.log('ERROR: Could not find REGIONS marker');
  process.exit(1);
}

// MAPS 資料（從原始 data.js 復原）
const mapsSection = `const MAPS = [
  {
    id: 'novice_ground', imgId: 5001, name: '新手訓練場',
    monsters: [{ id: 'poring', weight: 40 }, { id: 'lunatic', weight: 35 }, { id: 'fabre', weight: 25 }],
    bg: 'map-novice'
  },
  {
    id: 'prontera', imgId: 5002, name: '普隆德拉',
    monsters: [],
    bg: 'map-city'
  },
  {
    id: 'prt_fild00', imgId: 5003, name: '普隆德拉原野·東',
    monsters: [{ id: 'hornet', weight: 70 }, { id: 'creamy', weight: 10 }, { id: 'fabre', weight: 20 }, { id: 'pupa', weight: 30 }, { id: 'lunatic', weight: 30 }, { id: 'poring', weight: 40 }],
    bg: 'map-field'
  },
  {
    id: 'prt_fild01', imgId: 5004, name: '普隆德拉原野·北',
    monsters: [{ id: 'thief_bug', weight: 30 }, { id: 'fabre', weight: 20 }, { id: 'pupa', weight: 10 }, { id: 'lunatic', weight: 80 }, { id: 'poring', weight: 30 }],
    bg: 'map-field'
  },
  {
    id: 'prt_fild02', imgId: 5005, name: '曼陀羅原野',
    monsters: [{ id: 'mandragora', weight: 70 }, { id: 'fabre', weight: 50 }, { id: 'pupa', weight: 20 }, { id: 'lunatic', weight: 10 }, { id: 'poring', weight: 30 }],
    bg: 'map-field'
  },
  {
    id: 'prt_fild03', imgId: 5006, name: '溜溜猴谷',
    monsters: [{ id: 'yoyo', weight: 80 }, { id: 'smokie', weight: 40 }, { id: 'poporing', weight: 10 }],
    bg: 'map-field'
  },
  {
    id: 'prt_fild04', imgId: 5007, name: '搖滾蝗蟲原野',
    monsters: [{ id: 'rocker', weight: 70 }, { id: 'creamy', weight: 40 }, { id: 'pupa', weight: 10 }, { id: 'poring', weight: 30 }],
    bg: 'map-field'
  },
  {
    id: 'prt_fild05', imgId: 5008, name: '普隆德拉原野·西',
    monsters: [{ id: 'poring', weight: 70 }, { id: 'thief_bug_egg', weight: 20 }, { id: 'lunatic', weight: 30 }, { id: 'pupa', weight: 30 }, { id: 'thief_bug', weight: 10 }],
    bg: 'map-field'
  },
  {
    id: 'prt_fild06', imgId: 5009, name: '普隆德拉原野·南',
    monsters: [{ id: 'lunatic', weight: 60 }, { id: 'poring', weight: 60 }, { id: 'thief_bug_egg', weight: 20 }, { id: 'thief_bug', weight: 10 }, { id: 'pupa', weight: 20 }],
    bg: 'map-field'
  },
  {
    id: 'prt_fild07', imgId: 5010, name: '搖滾蝗蟲谷地',
    monsters: [{ id: 'rocker', weight: 80 }, { id: 'poporing', weight: 30 }],
    bg: 'map-field'
  },
  {
    id: 'prt_fild08', imgId: 5011, name: '普隆德拉草原',
    monsters: [{ id: 'poring', weight: 70 }, { id: 'lunatic', weight: 40 }, { id: 'pupa', weight: 20 }, { id: 'drops', weight: 10 }],
    bg: 'map-field'
  },
  {
    id: 'prt_fild09', imgId: 5012, name: '蠻荒邊境',
    monsters: [{ id: 'savage_babe', weight: 70 }, { id: 'baby_desert_wolf', weight: 20 }, { id: 'picky', weight: 20 }, { id: 'condor', weight: 10 }],
    bg: 'map-field'
  },
  {
    id: 'prt_fild10', imgId: 5013, name: '蠻荒之地',
    monsters: [{ id: 'savage', weight: 70 }, { id: 'savage_babe', weight: 40 }, { id: 'poporing', weight: 20 }, { id: 'thief_bug', weight: 10 }],
    bg: 'map-field'
  },
  {
    id: 'prt_fild11', imgId: 5014, name: '哥布林前哨',
    monsters: [{ id: 'goblin', weight: 110 }, { id: 'goblin_archer', weight: 10 }],
    bg: 'map-field'
  },
  {
    id: 'geffen', imgId: 5015, name: '吉芬',
    monsters: [],
    bg: 'map-city'
  },
  {
    id: 'gef_fild00', imgId: 5016, name: '吉芬原野·南',
    monsters: [{ id: 'mandragora', weight: 40 }, { id: 'willow', weight: 30 }, { id: 'spore', weight: 20 }, { id: 'hornet', weight: 15 }],
    bg: 'map-field'
  },
  {
    id: 'gef_fild01', imgId: 5017, name: '吉芬原野·北',
    monsters: [{ id: 'orc', weight: 50 }, { id: 'goblin', weight: 20 }, { id: 'goblin_archer', weight: 10 }],
    bg: 'map-orc'
  },
  {
    id: 'gef_fild02', imgId: 5018, name: '吉芬原野·東',
    monsters: [{ id: 'wolf', weight: 40 }, { id: 'savage', weight: 20 }, { id: 'orc', weight: 25 }, { id: 'baby_desert_wolf', weight: 15 }],
    bg: 'map-field'
  },
  {
    id: 'gef_fild03', imgId: 5019, name: '吉芬迷宮入口',
    monsters: [{ id: 'thief_bug', weight: 30 }, { id: 'smokie', weight: 25 }, { id: 'creamy', weight: 15 }, { id: 'thief_bug_egg', weight: 25 }],
    bg: 'map-field'
  },
  {
    id: 'payon', imgId: 5020, name: '培恩',
    monsters: [],
    bg: 'map-city'
  },
  {
    id: 'payon_field', imgId: 5021, name: '培恩原野',
    monsters: [{ id: 'willow', weight: 10 }, { id: 'spore', weight: 100 }, { id: 'poporing', weight: 10 }, { id: 'wolf', weight: 15 }, { id: 'hornet', weight: 15 }],
    bg: 'map-forest'
  },
  {
    id: 'pay_fild01', imgId: 5022, name: '培恩原野·竹林',
    monsters: [{ id: 'spore', weight: 60 }, { id: 'willow', weight: 20 }, { id: 'mandragora', weight: 15 }],
    bg: 'map-forest'
  },
  {
    id: 'pay_fild02', imgId: 5023, name: '培恩原野·深林',
    monsters: [{ id: 'wolf', weight: 40 }, { id: 'spore', weight: 30 }, { id: 'poporing', weight: 15 }, { id: 'hornet', weight: 15 }],
    bg: 'map-forest'
  },
  {
    id: 'morroc', imgId: 5024, name: '摩洛克',
    monsters: [],
    bg: 'map-city'
  },
  {
    id: 'morroc_desert', imgId: 5025, name: '摩洛克沙漠',
    monsters: [{ id: 'pecopeco', weight: 70 }, { id: 'picky', weight: 10 }, { id: 'goblin', weight: 20 }, { id: 'orc', weight: 10 }],
    bg: 'map-orc'
  },
  {
    id: 'moc_fild01', imgId: 5026, name: '夢羅克原野·荒地',
    monsters: [{ id: 'pecopeco', weight: 40 }, { id: 'savage', weight: 20 }, { id: 'baby_desert_wolf', weight: 20 }, { id: 'condor', weight: 20 }],
    bg: 'map-orc'
  },
  {
    id: 'moc_fild02', imgId: 5027, name: '夢羅克原野·蛇谷',
    monsters: [{ id: 'orc', weight: 35 }, { id: 'goblin', weight: 20 }, { id: 'goblin_archer', weight: 20 }],
    bg: 'map-orc'
  },
  {
    id: 'izlude', imgId: 5028, name: '依斯魯德',
    monsters: [],
    bg: 'map-city'
  },
  {
    id: 'byalan_island', imgId: 5029, name: '拜蘭島',
    monsters: [{ id: 'kukre', weight: 40 }, { id: 'plankton', weight: 30 }, { id: 'hydra', weight: 20 }, { id: 'marina', weight: 10 }],
    bg: 'map-field'
  },
  {
    id: 'undersea_1', imgId: 5030, name: '水洞1樓',
    monsters: [{ id: 'hydra', weight: 30 }, { id: 'plankton', weight: 25 }, { id: 'kukre', weight: 20 }, { id: 'marina', weight: 15 }, { id: 'vadon', weight: 10 }],
    bg: 'map-field'
  },
  {
    id: 'undersea_2', imgId: 5031, name: '水洞2樓',
    monsters: [{ id: 'hydra', weight: 20 }, { id: 'plankton', weight: 15 }, { id: 'kukre', weight: 20 }, { id: 'marina', weight: 15 }, { id: 'vadon', weight: 15 }, { id: 'cornutus', weight: 15 }],
    bg: 'map-field'
  },
  {
    id: 'undersea_3', imgId: 5032, name: '水洞3樓',
    monsters: [{ id: 'hydra', weight: 15 }, { id: 'marse', weight: 20 }, { id: 'cornutus', weight: 15 }, { id: 'obeaune', weight: 25 }, { id: 'merman', weight: 25 }],
    bg: 'map-field'
  },
  {
    id: 'undersea_4', imgId: 5033, name: '水洞4樓',
    monsters: [{ id: 'hydra', weight: 10 }, { id: 'marine_sphere', weight: 20 }, { id: 'phen', weight: 20 }, { id: 'marc', weight: 20 }, { id: 'swordfish', weight: 15 }, { id: 'merman', weight: 15 }],
    bg: 'map-field'
  }
];

`;

// 插入 MAPS
const newData = dataContent.substring(0, insertPoint) + mapsSection + '\n' + dataContent.substring(insertPoint);

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', newData);

console.log('Added MAPS section');
console.log('New file size:', newData.length);
