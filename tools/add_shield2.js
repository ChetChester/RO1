const fs = require('fs');
let lines = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8').split('\n');

const shields = { novice:-6, swordsman:-5, mage:-10, archer:-9, merchant:-5, thief:-6, acolyte:-7, knight:-5, wizard:-8, hunter:-9, blacksmith:-5, assassin:-6, priest:-5 };

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // 找到包含 baseAspd: { 的行
  if (line.includes('baseAspd:') && line.includes('{')) {
    // 往上找職業名稱
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const idMatch = lines[j].match(/^\s+(\w+):\s*\{/) || lines[j].match(/id:\s*'(\w+)'/);
      if (idMatch) {
        const jobId = idMatch[1];
        if (shields[jobId] !== undefined && !lines[i].includes('shieldPenalty')) {
          // 在 baseAspd 行的 }, 後面加 shieldPenalty
          lines[i] = lines[i].replace('},', '}, shieldPenalty: ' + shields[jobId] + ',');
          console.log(jobId + ': added shieldPenalty=' + shields[jobId]);
        }
        break;
      }
    }
  }
}

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', lines.join('\n'));
console.log('Done!');
