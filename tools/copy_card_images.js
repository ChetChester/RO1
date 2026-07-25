/* 複製卡片圖片到遊戲目錄 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'ro_cards_data', 'images', 'icon');
const dstDir = path.join(__dirname, '..', 'images', 'items');

// 讀取 CARDS 資料
const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const cardRegex = /(\w+):\s*\{"id":"[^"]+","imgId":(\d+)[^}]*"type":"material"[^}]*\}/g;

let count = 0, missingCount = 0;
let m;

while ((m = cardRegex.exec(data)) !== null) {
  const imgId = parseInt(m[2]);
  
  // 源圖片路徑（卡片圖片在 ro_cards_data/images/icon/）
  const srcFile = path.join(srcDir, `${imgId}.png`);
  
  if (!fs.existsSync(srcFile)) {
    missingCount++;
    continue;
  }
  
  // 目標路徑
  const dstFile = path.join(dstDir, `${imgId}.png`);
  
  // 複製檔案
  fs.copyFileSync(srcFile, dstFile);
  count++;
}

console.log(`複製完成！`);
console.log(`  卡片圖片: ${count}`);
console.log(`  缺少圖片: ${missingCount}`);
