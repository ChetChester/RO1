/* 檢查檔案編碼和特殊字元 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const buffer = fs.readFileSync(dataPath);

console.log('檔案大小:', buffer.length, 'bytes');
console.log('前100 bytes hex:', buffer.slice(0, 100).toString('hex'));

// 找出 ITEMS 區塊
const data = buffer.toString('utf8');
const itemsStart = data.indexOf('const ITEMS = {');
const itemsEnd = data.indexOf('\n};', itemsStart) + 3;

if (itemsStart !== -1) {
  // 找出可能的問題字元
  const itemsBlock = data.substring(itemsStart, itemsEnd);
  
  // 檢查是否有 BOM 或其他控制字元
  for (let i = 0; i < Math.min(1000, itemsBlock.length); i++) {
    const code = itemsBlock.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      console.log(`位置 ${i}: 控制字元 code ${code}`);
    }
    if (code === 0xFEFF) {
      console.log(`位置 ${i}: BOM`);
    }
  }
  
  // 檢查是否有未關閉的字串
  let inString = false;
  let stringStart = -1;
  for (let i = 0; i < Math.min(2000, itemsBlock.length); i++) {
    const ch = itemsBlock[i];
    if (ch === '"' && (i === 0 || itemsBlock[i-1] !== '\\')) {
      inString = !inString;
      if (inString) {
        stringStart = i;
      } else {
        stringStart = -1;
      }
    }
  }
  if (inString) {
    console.log(`未關閉的字串，從位置 ${stringStart} 開始`);
    console.log(`字串開頭: ${itemsBlock.substring(stringStart, stringStart + 100)}`);
  }
}
