/* 修正怪物資料：在 atkInterval 後加逗號 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
let data = fs.readFileSync(dataPath, 'utf8');

// 修正 atkInterval:0.58drops → atkInterval:0.58,drops
data = data.replace(/atkInterval:([\d.]+)drops:/g, 'atkInterval:$1,drops:');

fs.writeFileSync(dataPath, data, 'utf8');
console.log('已修正怪物資料格式');
