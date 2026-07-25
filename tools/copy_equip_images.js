/* 複製裝備圖片到遊戲目錄 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'ro_items_data', 'images', 'icon');
const dstWeaponDir = path.join(__dirname, '..', 'images', 'equip', 'weapon');
const dstArmorDir = path.join(__dirname, '..', 'images', 'equip', 'armor');

// 讀取 ITEMS 資料
const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const itemRegex = /(\w+):\s*\{"id":"[^"]+","imgId":(\d+)[^}]*"type":"(weapon|armor)"[^}]*\}/g;

let weaponCount = 0, armorCount = 0, missingCount = 0;
let m;

while ((m = itemRegex.exec(data)) !== null) {
  const id = m[1];
  const imgId = parseInt(m[2]);
  const type = m[3];
  
  // 源圖片路徑
  const srcFile = path.join(srcDir, `${imgId}.png`);
  
  if (!fs.existsSync(srcFile)) {
    missingCount++;
    continue;
  }
  
  // 目標目錄
  const dstDir = type === 'weapon' ? dstWeaponDir : dstArmorDir;
  const dstFile = path.join(dstDir, `${imgId}.png`);
  
  // 複製檔案
  fs.copyFileSync(srcFile, dstFile);
  
  if (type === 'weapon') weaponCount++;
  else armorCount++;
}

console.log(`複製完成！`);
console.log(`  武器圖片: ${weaponCount}`);
console.log(`  防具圖片: ${armorCount}`);
console.log(`  缺少圖片: ${missingCount}`);
