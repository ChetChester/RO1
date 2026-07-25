/* 檢查 CARDS 區塊 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 找到 CARDS 區塊
const cardsStart = data.indexOf('const CARDS = {');
const cardsEnd = data.indexOf('\n};', cardsStart) + 3;

if (cardsStart === -1 || cardsEnd === -1) {
  console.error('找不到 CARDS 區塊');
  process.exit(1);
}

const cardsBlock = data.substring(cardsStart, cardsEnd);
console.log(`CARDS 區塊: ${cardsStart} ~ ${cardsEnd}`);
console.log(`大小: ${cardsEnd - cardsStart} bytes`);

// 嘗試解析
try {
  new Function('return ' + cardsBlock.replace('const CARDS = ', ''));
  console.log('CARDS 區塊語法正確');
} catch (e) {
  console.log('CARDS 區塊語法錯誤:', e.message);
  
  // 找出錯誤的行
  const lines = cardsBlock.split('\n');
  for (let i = 0; i < lines.length; i++) {
    try {
      new Function('return {' + lines.slice(1, i + 2).join('\n') + '\n}');
    } catch (e2) {
      if (e2.message.includes('Unexpected token') || e2.message.includes('Invalid')) {
        console.log(`第 ${i + 1} 行有問題:`);
        console.log(lines[i + 1].substring(0, 150));
        break;
      }
    }
  }
}
