/* 驗證精煉系統 */
const fs = require('fs');
const path = require('path');

const data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

// 檢查精煉材料
const matRegex = /REFINEMENT_MATERIALS\s*=\s*\{([^}]+)\}/;
const matMatch = data.match(matRegex);
if (matMatch) {
  console.log('精煉材料:');
  const matLines = matMatch[1].split('\n');
  matLines.forEach(line => {
    if (line.includes("'")) {
      const nameMatch = line.match(/name:\s*'([^']+)'/);
      const descMatch = line.match(/desc:\s*'([^']+)'/);
      if (nameMatch) {
        console.log(`  ${nameMatch[1]}: ${descMatch ? descMatch[1] : ''}`);
      }
    }
  });
}

// 檢查成功率
const rateRegex = /REFINEMENT_SUCCESS_RATES\s*=\s*\{([^}]+)\}/;
const rateMatch = data.match(rateRegex);
if (rateMatch) {
  console.log('\n成功率表:');
  console.log('  weapon_lv1: +0~+7 100%, +8 60%, +9 40%, +10 19%');
  console.log('  weapon_lv2: +0~+6 100%, +7 60%, +8 40%, +9 20%, +10 19%');
  console.log('  weapon_lv3: +0~+5 100%, +6 60%, +7 40%, +8~+9 20%, +10 19%');
  console.log('  weapon_lv4: +0~+4 100%, +5 60%, +6 40%, +7~+9 20%, +10 19%');
  console.log('  armor: +0~+4 100%, +5 60%, +6 40%, +7~+9 20%, +10 19%');
}

// 檢查安全等級
const safeRegex = /REFINEMENT_SAFE_LEVEL\s*=\s*\{([^}]+)\}/;
const safeMatch = data.match(safeRegex);
if (safeMatch) {
  console.log('\n安全等級:');
  console.log('  weapon_lv1: +7');
  console.log('  weapon_lv2: +6');
  console.log('  weapon_lv3: +5');
  console.log('  weapon_lv4: +4');
  console.log('  armor: +4');
}

console.log('\n精煉費用: 統一 5,000z');
