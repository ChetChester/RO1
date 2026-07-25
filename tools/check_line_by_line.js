/* 逐行檢查 data.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');
const lines = data.split('\n');

// 找出第一個有語法錯誤的行
let lastGoodLine = 0;
for (let i = 0; i < lines.length; i++) {
  const partial = lines.slice(0, i + 1).join('\n');
  try {
    vm.createScript(partial);
    lastGoodLine = i;
  } catch (e) {
    if (e.message.includes('Unexpected token') || e.message.includes('Invalid')) {
      console.log(`第 ${i + 1} 行有錯誤:`);
      console.log(lines[i]);
      console.log('\n前一行:');
      console.log(lines[i - 1]);
      break;
    }
  }
}
