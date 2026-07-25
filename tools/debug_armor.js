/* 調試防具檢查 */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

// 測試幾個防具 ID
const testIds = [2301, 2303, 2305, 2101, 2401, 2501, 2220];

for (const id of testIds) {
  // 先找 imgId
  const imgIdRegex = new RegExp(`"imgId":${id}`);
  const imgIdMatch = data.match(imgIdRegex);
  if (!imgIdMatch) {
    console.log(`${id}: imgId NOT FOUND`);
    continue;
  }
  
  // 找到完整的物品行
  const startIdx = Math.max(0, imgIdMatch.index - 200);
  const before = data.substring(startIdx, imgIdMatch.index);
  const idMatch = before.match(/(\w+):\s*\{"id":"(\w+)"/);
  if (!idMatch) {
    console.log(`${id}: ID NOT FOUND`);
    continue;
  }
  
  const gameId = idMatch[1];
  
  // 檢查屬性
  const regex = new RegExp(`"${gameId}":\\s*\\{[^}]+\\}`);
  const match = data.match(regex);
  if (!match) {
    console.log(`${id} (${gameId}): PROPS NOT FOUND`);
    continue;
  }
  
  const props = match[0];
  const defMatch = props.match(/"def":(\d+)/);
  const armorTypeMatch = props.match(/"armorType":"(\w+)"/);
  
  console.log(`${id} (${gameId}): def=${defMatch ? defMatch[1] : 'N/A'}, armorType=${armorTypeMatch ? armorTypeMatch[1] : 'N/A'}`);
}
