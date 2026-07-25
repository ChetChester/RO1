/* 將 items_generated.js 的 ITEMS 合併到 data.js */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const itemsPath = path.join(__dirname, '..', 'js', 'items_generated.js');

let data = fs.readFileSync(dataPath, 'utf8');
const itemsContent = fs.readFileSync(itemsPath, 'utf8');

// 找到舊的 ITEMS 區塊範圍
const itemsStart = data.indexOf('const ITEMS = {');
const itemsEnd = data.indexOf('};', itemsStart) + 2;

if (itemsStart === -1 || itemsEnd === -1) {
  console.error('找不到 ITEMS 區塊');
  process.exit(1);
}

console.log(`舊 ITEMS 位置: ${itemsStart} ~ ${itemsEnd}`);
console.log(`舊 ITEMS 大小: ${itemsEnd - itemsStart} bytes`);

// 從 generated 檔案提取 ITEMS 區塊
const genItemsStart = itemsContent.indexOf('const ITEMS = {');
const genItemsEnd = itemsContent.indexOf('};', genItemsStart) + 2;
const newItemsBlock = itemsContent.substring(genItemsStart, genItemsEnd);

console.log(`新 ITEMS 大小: ${newItemsBlock.length} bytes`);

// 替換
const newData = data.substring(0, itemsStart) + newItemsBlock + data.substring(itemsEnd);

fs.writeFileSync(dataPath, newData, 'utf8');
console.log(`已更新 data.js`);
console.log(`新檔案大小: ${newData.length} bytes`);
