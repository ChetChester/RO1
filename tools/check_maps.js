/* 檢查 MAPS 區塊 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 找到 MAPS 區塊
const mapsStart = data.indexOf('const MAPS = [');
const mapsEnd = data.indexOf('\n];', mapsStart) + 3;

if (mapsStart === -1 || mapsEnd === -1) {
  console.error('找不到 MAPS 區塊');
  process.exit(1);
}

const mapsBlock = data.substring(mapsStart, mapsEnd);
console.log(`MAPS 區塊: ${mapsStart} ~ ${mapsEnd}`);
console.log(`大小: ${mapsEnd - mapsStart} bytes`);

// 嘗試解析
try {
  new Function('return ' + mapsBlock.replace('const MAPS = ', ''));
  console.log('MAPS 區塊語法正確');
} catch (e) {
  console.log('MAPS 區塊語法錯誤:', e.message);
}
