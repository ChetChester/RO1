/* 用 Node.js 語法解析器檢查 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 嘗試用 VM 模組解析
const vm = require('vm');
try {
  vm.createScript(data);
  console.log('語法正確！');
} catch (e) {
  console.log('語法錯誤:', e.message);
  if (e.message.includes('Unexpected token')) {
    console.log('位置:', e.message.match(/position (\d+)/)?.[1]);
  }
}
