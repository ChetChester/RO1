const fs = require('fs');
const weaponData = JSON.parse(fs.readFileSync('D:/mimo/ro-idle/ro_aspd_data/aspd_weapon_base.json', 'utf8'));

const WEAPON_MAP = { dagger: '短劍', sword: '單手劍', tsword: '雙手劍', bow: '弓', rod: '單手杖', mace: '鈍器', katar: '拳刃', spear: '單手槍', knuckle: '拳套' };
const JOB_MAP = {
  novice: '初心者', swordsman: '劍士', mage: '法師', archer: '弓箭手',
  merchant: '商人', thief: '盜賊', acolyte: '服事',
  knight: '騎士/騎士領主', wizard: '巫師/超魔導', hunter: '獵人/神射手',
  blacksmith: '鐵匠/神工匠', assassin: '刺客/十字刺客', priest: '祭司/神官'
};

// Build lookup
const jobLookup = {};
for (const category of Object.values(weaponData.weapon_base_aspd)) {
  for (const job of category.jobs) {
    jobLookup[job.name] = job;
  }
}

function getJobData(gameJobId) {
  const name = JOB_MAP[gameJobId];
  return jobLookup[name] || null;
}

// Read data.js
let content = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Find job definition lines like "novice: {" or "id: 'knight',"
  let jobId = null;
  const jobIdMatch = line.match(/^\s+(\w+):\s*\{/);
  if (jobIdMatch && JOB_MAP[jobIdMatch[1]]) {
    jobId = jobIdMatch[1];
  }
  const idMatch = line.match(/id:\s*'(\w+)'/);
  if (idMatch && JOB_MAP[idMatch[1]]) {
    jobId = idMatch[1];
  }

  if (!jobId) continue;

  const jobData = getJobData(jobId);
  if (!jobData) {
    console.log(jobId + ': NOT FOUND in lookup');
    continue;
  }

  // Build baseAspd object
  const aspdObj = {};
  Object.keys(WEAPON_MAP).forEach(wt => {
    const weaponName = WEAPON_MAP[wt];
    aspdObj[wt] = jobData.weapons[weaponName] !== undefined ? jobData.weapons[weaponName] : null;
  });

  // Build shieldPenalty
  const shieldPenalty = jobData.shield['盾牌'] !== undefined ? jobData.shield['盾牌'] : -5;

  // Find the baseAspd line for this job
  for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
    if (lines[j].includes('baseAspd:') && lines[j].includes('{')) {
      // Replace this line
      lines[j] = lines[j].replace(/baseAspd:\s*\{[^}]+\}/, 'baseAspd: ' + JSON.stringify(aspdObj));
      // Add shieldPenalty if not present
      if (!lines[j].includes('shieldPenalty')) {
        lines[j] = lines[j].replace('},', '}, shieldPenalty: ' + shieldPenalty + ',');
      }
      console.log(jobId + ': baseAspd=' + JSON.stringify(aspdObj).substring(0, 60) + '... shield=' + shieldPenalty);
      break;
    }
  }
}

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', lines.join('\n'));
console.log('\nDone!');
