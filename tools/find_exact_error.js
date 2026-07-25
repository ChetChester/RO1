/* 精確找出品 data.js 語法錯誤 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 找到 ITEMS 區塊
const itemsStart = data.indexOf('const ITEMS = {');
const itemsEnd = data.indexOf('\n};', itemsStart) + 3;

console.log(`ITEMS 區塊: ${itemsStart} ~ ${itemsEnd}`);
console.log(`大小: ${itemsEnd - itemsStart} bytes`);

// 嘗試解析 ITEMS 區塊
const itemsBlock = data.substring(itemsStart, itemsEnd);

try {
  new Function('return ' + itemsBlock.replace('const ITEMS = ', ''));
  console.log('ITEMS 區塊語法正確');
} catch (e) {
  console.log('ITEMS 區塊語法錯誤:', e.message);
  
  // 嘗試用 eval 找出具體位置
  try {
    eval(itemsBlock.replace('const ITEMS = ', 'var ITEMS = '));
  } catch (evalErr) {
    console.log('eval 錯誤:', evalErr.message);
    
    // 檢查是否是重複屬性的問題
    const propRegex = /(\w+):\s*\{/g;
    const props = {};
    let m;
    while ((m = propRegex.exec(itemsBlock)) !== null) {
      const prop = m[1];
      if (props[prop]) {
        console.log(`重複屬性: ${prop} (位置 ${props[prop]} 和 ${m.index})`);
      }
      props[prop] = m.index;
    }
  }
}

// 也檢查 MONSTERS 區塊
const monstersStart = data.indexOf('const MONSTERS = {');
const monstersEnd = data.indexOf('\n};', monstersStart) + 3;

if (monstersStart !== -1 && monstersEnd !== -1) {
  console.log(`\nMONSTERS 區塊: ${monstersStart} ~ ${monstersEnd}`);
  console.log(`大小: ${monstersEnd - monstersStart} bytes`);
  
  const monstersBlock = data.substring(monstersStart, monstersEnd);
  try {
    new Function('return ' + monstersBlock.replace('const MONSTERS = ', ''));
    console.log('MONSTERS 區塊語法正確');
  } catch (e) {
    console.log('MONSTERS 區塊語法錯誤:', e.message);
  }
}
