/* 找出 data.js 語法錯誤位置 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 逐段檢查
const lines = data.split('\n');
let found = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // 檢查常見問題
  // 1. 中文字元在屬性名中
  // 2. 未 escape 的引號
  // 3. 多餘的逗號
  
  // 檢查是否有未 escape 的引號在 JSON 值中
  if (line.includes('"shop":true') || line.includes('"shop": false')) {
    // 檢查這行的引號是否配對
    const quotes = line.match(/"/g);
    if (quotes && quotes.length % 2 !== 0) {
      console.log(`行 ${i+1}: 引號數量不對 (${quotes.length})`);
      console.log(`  ${line.substring(0, 100)}`);
      found = true;
    }
  }
}

if (!found) {
  // 用更精確的方法找錯誤
  // 嘗試解析每個行
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 檢查是否有非法字元
    for (let j = 0; j < line.length; j++) {
      const code = line.charCodeAt(j);
      // 控制字元（除了 tab, LF, CR）
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
        console.log(`行 ${i+1}, 位置 ${j}: 非法控制字元 (code ${code})`);
        found = true;
      }
    }
  }
}

if (!found) {
  // 嘗試用 eval 逐段檢查
  const chunks = data.split('\n\n');
  for (let i = 0; i < chunks.length; i++) {
    try {
      new Function(chunks[i]);
    } catch (e) {
      if (e.message.includes('Unexpected token') || e.message.includes('Invalid')) {
        console.log(`區塊 ${i} 有錯誤: ${e.message}`);
        console.log(`  開頭: ${chunks[i].substring(0, 100)}`);
        found = true;
        break;
      }
    }
  }
}

if (!found) {
  console.log('未找到明顯錯誤，嘗試二分搜尋...');
  
  // 二分搜尋找錯誤位置
  let low = 0, high = lines.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const partial = lines.slice(0, mid + 1).join('\n');
    try {
      new Function(partial);
      low = mid + 1;
    } catch (e) {
      high = mid;
    }
  }
  
  console.log(`錯誤大約在第 ${low + 1} 行`);
  console.log('該行:');
  console.log(lines[low]);
}
