/* 更精確的語法檢查 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 找到 ITEMS 區塊
const itemsStart = data.indexOf('const ITEMS = {');
const itemsEnd = data.indexOf('\n};', itemsStart) + 3;

if (itemsStart === -1 || itemsEnd === -1) {
  console.error('找不到 ITEMS 區塊');
  process.exit(1);
}

const itemsBlock = data.substring(itemsStart, itemsEnd);
console.log(`ITEMS 區塊: ${itemsStart} ~ ${itemsEnd}`);
console.log(`大小: ${itemsEnd - itemsStart} bytes`);
console.log(`前100字元: ${itemsBlock.substring(0, 100)}`);

// 嘗試用 Function 解析
try {
  new Function('return ' + itemsBlock.replace('const ITEMS = ', ''));
  console.log('\n語法正確！');
} catch (e) {
  console.log('\n語法錯誤:', e.message);
  
  // 找出錯誤的行號
  const match = e.message.match(/position (\d+)/);
  if (match) {
    const pos = parseInt(match[1]);
    const context = itemsBlock.substring(0, pos);
    const lines = context.split('\n');
    console.log(`錯誤在第 ${lines.length} 行`);
    
    // 顯示該行
    const errorLine = lines[lines.length - 1];
    console.log('該行:');
    console.log(errorLine);
    
    // 顯示前後文
    const lineStart = context.lastIndexOf('\n') + 1;
    const lineEnd = itemsBlock.indexOf('\n', pos);
    console.log('\n該行完整內容:');
    console.log(itemsBlock.substring(lineStart, lineEnd !== -1 ? lineEnd : lineStart + 200));
  }
}
