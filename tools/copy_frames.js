/* 複製職業攻擊幀到 images/frames/{job}_{gender}/ */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', '職業攻擊圖');
const outBase = path.join(__dirname, '..', 'images', 'frames');

const jobMap = { '新手': 'novice', '劍士': 'swordsman', '騎士': 'knight' };

if (!fs.existsSync(outBase)) fs.mkdirSync(outBase, { recursive: true });

for (const jobDir of fs.readdirSync(srcDir)) {
  const jobId = jobMap[jobDir];
  if (!jobId) continue;
  
  const jobPath = path.join(srcDir, jobDir);
  const files = fs.readdirSync(jobPath).filter(f => f.endsWith('.png'));
  
  // 依性別分組
  for (const gender of ['男', '女']) {
    const genderFiles = files.filter(f => f.includes(`_${gender}_`)).sort();
    if (genderFiles.length === 0) continue;
    
    const genderKey = gender === '男' ? 'male' : 'female';
    const outDir = path.join(outBase, `${jobId}_${genderKey}`);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    
    for (let i = 0; i < genderFiles.length; i++) {
      const src = path.join(jobPath, genderFiles[i]);
      const dst = path.join(outDir, `frame_${String(i).padStart(3, '0')}.png`);
      fs.copyFileSync(src, dst);
    }
    console.log(`${jobId}_${genderKey}: ${genderFiles.length} 幀 -> ${outDir}`);
  }
}
