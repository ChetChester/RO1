/* 逐步找出錯誤行 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');
const lines = data.split('\n');

console.log(`總行數: ${lines.length}`);

// 先確認整體有錯
try {
  vm.runInNewContext(data, {});
  console.log('沒有錯誤！');
  process.exit(0);
} catch (e) {
  console.log('確認有錯誤:', e.message);
}

// 逐步二分搜尋
let low = 0, high = lines.length;
while (low < high) {
  const mid = Math.floor((low + high) / 2);
  const partial = lines.slice(0, mid + 1).join('\n');
  try {
    vm.runInNewContext(partial + '\n}', {}); // 加一個 } 關閉可能未關閉的區塊
    low = mid + 1;
  } catch (e) {
    // 如果是 "Unexpected end of input" 表示前面的語法是對的，只是不完整
    if (e.message.includes('Unexpected end of input') || e.message.includes('Unexpected token') === false) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
}

console.log(`錯誤大約在第 ${low + 1} 行`);
console.log('該行:');
console.log(lines[low]);
console.log('前一行:');
console.log(lines[low - 1]);
console.log('後一行:');
console.log(lines[low + 1]);
