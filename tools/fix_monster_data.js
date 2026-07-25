/* 修正怪物資料：將 hit/flee/atkInterval 從 drops 移到怪物層級 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
let data = fs.readFileSync(dataPath, 'utf8');

// 找到 MONSTERS 區塊
const monstersStart = data.indexOf('const MONSTERS = {');
const monstersEnd = data.indexOf('\n};', monstersStart) + 3;
const monstersBlock = data.substring(monstersStart, monstersEnd);

// 替換：將 drops 裡的 hit/flee/atkInterval 移到怪物層級
// 原始格式: drops:[{item:'xxx',chance:0.1,hit:125,flee:306,atkInterval:0.58},...]
// 目標格式: hit:125,flee:306,atkInterval:0.58,drops:[{item:'xxx',chance:0.1},...]

const fixedMonsters = monstersBlock.replace(
  /(\{[^}]*?)(drops:\[\{[^}]*?,)(hit:\d+,flee:\d+,atkInterval:[\d.]+)(\})/g,
  (match, before, dropsStart, stats, dropsEnd) => {
    return before + stats + dropsStart + dropsEnd;
  }
);

data = data.substring(0, monstersStart) + fixedMonsters + data.substring(monstersEnd);
fs.writeFileSync(dataPath, data, 'utf8');
console.log('已修正怪物資料格式');
