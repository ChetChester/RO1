/* 修正 wizard 職業等級上限 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
let data = fs.readFileSync(dataPath, 'utf8');

// 找到 wizard 職業區塊
const wizardIdx = data.indexOf('wizard:');
if (wizardIdx !== -1) {
  const wizardBlock = data.substring(wizardIdx, wizardIdx + 500);
  const newWizardBlock = wizardBlock.replace(/jobLevelMax:\s*99/, 'jobLevelMax: 50');
  data = data.substring(0, wizardIdx) + newWizardBlock + data.substring(wizardIdx + 500);
}

fs.writeFileSync(dataPath, data, 'utf8');
console.log('已修正 wizard 職業等級上限');
