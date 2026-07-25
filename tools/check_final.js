/* 用 eval 檢查完整 data.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

try {
  vm.runInNewContext(data, {});
  console.log('data.js 語法正確！');
} catch (e) {
  console.log('data.js 錯誤:', e.message);
  
  // 找出具體位置
  if (e.message.includes('Unexpected token')) {
    // 嘗試用逐步排除法
    const lines = data.split('\n');
    let lastGood = 0;
    for (let i = 0; i < lines.length; i += 100) {
      const partial = lines.slice(0, i + 1).join('\n');
      try {
        vm.runInNewContext(partial, {});
        lastGood = i;
      } catch (e2) {
        // 在 lastGood 和 i 之間找
        for (let j = lastGood; j <= i; j++) {
          const p = lines.slice(0, j + 1).join('\n');
          try {
            vm.runInNewContext(p, {});
          } catch (e3) {
            console.log(`錯誤在第 ${j + 1} 行:`);
            console.log(`  ${lines[j].substring(0, 120)}`);
            console.log(`  前一行: ${lines[j-1]?.substring(0, 120)}`);
            return;
          }
        }
      }
    }
  }
}
