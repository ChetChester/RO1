/* 檢查 data.js 語法 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 嘗試用 eval 檢查語法
try {
  // 只檢查語法，不執行
  new Function(data);
  console.log('語法正確');
} catch (e) {
  console.log('語法錯誤:', e.message);
  
  // 找出錯誤位置
  const match = e.message.match(/position (\d+)/);
  if (match) {
    const pos = parseInt(match[1]);
    const lines = data.substring(0, pos).split('\n');
    const lineNum = lines.length;
    const col = lines[lines.length - 1].length;
    console.log(`錯誤位置: 第 ${lineNum} 行, 第 ${col} 字元`);
    console.log('上下文:');
    const contextStart = Math.max(0, pos - 100);
    const contextEnd = Math.min(data.length, pos + 100);
    console.log(data.substring(contextStart, contextEnd));
  }
}
