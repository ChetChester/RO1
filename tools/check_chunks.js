/* 分段檢查 data.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

console.log('檔案大小:', data.length, 'bytes');

// 分成 10 段檢查
const chunkSize = Math.ceil(data.length / 10);
for (let i = 0; i < 10; i++) {
  const start = i * chunkSize;
  const end = Math.min((i + 1) * chunkSize, data.length);
  const chunk = data.substring(start, end);
  
  try {
    vm.createScript(chunk);
    console.log(`區段 ${i + 1} (${start}~${end}): 正確`);
  } catch (e) {
    console.log(`區段 ${i + 1} (${start}~${end}): ${e.message}`);
    
    // 如果有錯誤，找出該區段中的問題
    const lines = chunk.split('\n');
    for (let j = 0; j < lines.length; j++) {
      const partial = lines.slice(0, j + 1).join('\n');
      try {
        vm.createScript(partial);
      } catch (e2) {
        if (e2.message.includes('Unexpected token') || e2.message.includes('Invalid')) {
          console.log(`  第 ${j + 1} 行有問題:`);
          console.log(`  ${lines[j].substring(0, 100)}`);
          break;
        }
      }
    }
  }
}
