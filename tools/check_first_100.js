/* 檢查前幾行 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 只檢查前 100 行
const lines = data.split('\n');
const partial = lines.slice(0, 100).join('\n');

console.log('前 100 行:');
console.log(partial.substring(0, 500));

try {
  vm.createScript(partial);
  console.log('\n前 100 行語法正確');
} catch (e) {
  console.log('\n語法錯誤:', e.message);
}
