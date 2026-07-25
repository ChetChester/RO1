/* 還原職業等級上限為原始值 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
let data = fs.readFileSync(dataPath, 'utf8');

// 找到 JOB_TREE 區塊
const jobTreeStart = data.indexOf('const JOB_TREE = {');
const jobTreeEnd = data.indexOf('\n};', jobTreeStart) + 3;
let jobTreeBlock = data.substring(jobTreeStart, jobTreeEnd);

// 使用更精確的替換
// 找到每個職業的 jobLevelMax 並設為正確值
const replacements = {
  'novice:': 10,
  'swordsman:': 50,
  'mage:': 50,
  'archer:': 50,
  'merchant:': 50,
  'thief:': 50,
  'acolyte:': 50,
  'knight:': 50,
  'priest:': 50,
  'hunter:': 50,
  'blacksmith:': 50,
  'assassin:': 50,
  'rogue:': 50,
};

for (const [job, level] of Object.entries(replacements)) {
  const regex = new RegExp(`(${job}[^}]*?)jobLevelMax:\\s*\\d+`);
  jobTreeBlock = jobTreeBlock.replace(regex, `$1jobLevelMax: ${level}`);
}

data = data.substring(0, jobTreeStart) + jobTreeBlock + data.substring(jobTreeEnd);
fs.writeFileSync(dataPath, data, 'utf8');
console.log('已還原職業等級上限');
