/* 用 acorn 解析器檢查（更精確） */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 嘗試用不同方法解析
// 1. 嘗試用 Function 構造器
try {
  new Function(data);
  console.log('方法1: Function 構造器 - 正確');
} catch (e) {
  console.log('方法1: Function 構造器 - 錯誤:', e.message);
}

// 2. 嘗試用 eval
try {
  eval('(function(){' + data + '})');
  console.log('方法2: eval - 正確');
} catch (e) {
  console.log('方法2: eval - 錯誤:', e.message);
}

// 3. 檢查是否有 BOM
if (data.charCodeAt(0) === 0xFEFF) {
  console.log('發現 BOM');
}

// 4. 檢查是否有 \r\n 問題
const crlfCount = (data.match(/\r\n/g) || []).length;
const lfCount = (data.match(/\n/g) || []).length;
console.log(`行尾: LF=${lfCount}, CRLF=${crlfCount}`);

// 5. 檢查是否有控制字元
let controlCount = 0;
for (let i = 0; i < data.length; i++) {
  const code = data.charCodeAt(i);
  if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
    controlCount++;
    if (controlCount <= 5) {
      console.log(`控制字元: 位置 ${i}, code ${code}`);
    }
  }
}
console.log(`控制字元總數: ${controlCount}`);
