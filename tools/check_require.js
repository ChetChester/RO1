/* 直接用 Node.js require 檢查 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 嘗試用 require 解析
// 先寫到一個暫存檔
const tmpPath = path.join(__dirname, '_test_data.js');
fs.writeFileSync(tmpPath, data, 'utf8');

try {
  delete require.cache[require.resolve(tmpPath)];
  require(tmpPath);
  console.log('data.js 語法正確！可以正常載入。');
} catch (e) {
  console.log('data.js 錯誤:', e.message);
  
  // 如果是語法錯誤，嘗試找出位置
  if (e.message.includes('Unexpected token') || e.message.includes('Invalid')) {
    console.log('\n嘗試找出錯誤位置...');
    
    // 讀取原始檔案找行號
    const lines = data.split('\n');
    
    // 找出 ITEMS 區塊
    const itemsStart = data.indexOf('const ITEMS = {');
    if (itemsStart !== -1) {
      const itemsLines = data.substring(0, itemsStart).split('\n').length;
      console.log(`ITEMS 區塊從第 ${itemsLines} 行開始`);
    }
    
    // 找出 MONSTERS 區塊
    const monstersStart = data.indexOf('const MONSTERS = {');
    if (monstersStart !== -1) {
      const monstersLines = data.substring(0, monstersStart).split('\n').length;
      console.log(`MONSTERS 區塊從第 ${monstersLines} 行開始`);
    }
  }
}

// 清理暫存檔
fs.unlinkSync(tmpPath);
