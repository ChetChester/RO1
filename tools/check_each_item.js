/* 檢查 ITEMS 區塊的每個物品 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 找到 ITEMS 區塊
const itemsStart = data.indexOf('const ITEMS = {');
const itemsEnd = data.indexOf('\n};', itemsStart) + 3;

const itemsBlock = data.substring(itemsStart, itemsEnd);

// 提取每個物品行
const lines = itemsBlock.split('\n');
console.log(`ITEMS 區塊有 ${lines.length} 行`);

// 檢查每一行
for (let i = 1; i < lines.length - 1; i++) { // 跳過第一行 (const ITEMS = {) 和最後一行 (};)
  const line = lines[i].trim();
  if (!line || line === '}' || line === '{') continue;
  
  // 嘗試解析這行
  try {
    // 構建一個完整的物件
    const testObj = `{${line.replace(/,\s*$/, '')}}`;
    JSON.parse(testObj.replace(/(\w+):/g, '"$1":'));
  } catch (e) {
    // 如果有錯誤，顯示該行
    if (e.message.includes('Unexpected token') || e.message.includes('Invalid')) {
      console.log(`\n第 ${i + 1} 行有問題:`);
      console.log(line.substring(0, 150));
      console.log('錯誤:', e.message);
    }
  }
}

console.log('\n檢查完成');
