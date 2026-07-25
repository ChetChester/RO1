const fs = require('fs');
const data = JSON.parse(fs.readFileSync('D:/mimo/ro-idle/ro_aspd_data/aspd_weapon_base.json', 'utf8'));

// 映射：遊戲武器類型 → 查詢表武器名稱
const WEAPON_MAP = {
  dagger: '短劍', sword: '單手劍', tsword: '雙手劍',
  bow: '弓', rod: '單手杖', mace: '鈍器',
  katar: '拳刃', spear: '單手槍', knuckle: '拳套'
};

// 映射：遊戲職業 ID → 查詢表職業名稱
const JOB_MAP = {
  novice: '初心者', swordsman: '劍士', mage: '法師', archer: '弓箭手',
  merchant: '商人', thief: '盜賊', acolyte: '服事',
  knight: '騎士/騎士領主', wizard: '巫師/超魔導', hunter: '獵人/神射手',
  blacksmith: '鐵匠/神工匠', assassin: '刺客/十字刺客', priest: '祭司/神官'
};

// 從查詢表中提取武器 ASPD 值
function getWeaponAspd(jobId, weaponType) {
  const jobName = JOB_MAP[jobId];
  if (!jobName) return null;
  
  // 找到對應的職業
  for (const category of Object.values(data.weapon_base_aspd)) {
    for (const job of category.jobs) {
      if (job.name === jobName) {
        const weaponName = WEAPON_MAP[weaponType];
        return job.weapons[weaponName] !== undefined ? job.weapons[weaponName] : null;
      }
    }
  }
  return null;
}

// 讀取 data.js
let content = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// 更新每個職業的 baseAspd
const jobIds = ['novice', 'swordsman', 'mage', 'archer', 'merchant', 'thief', 'acolyte',
                'knight', 'wizard', 'hunter', 'blacksmith', 'assassin', 'priest'];

jobIds.forEach(jobId => {
  const aspdObj = {};
  ['dagger', 'sword', 'tsword', 'bow', 'rod', 'mace', 'katar', 'spear', 'knuckle'].forEach(wt => {
    aspdObj[wt] = getWeaponAspd(jobId, wt);
  });
  
  const newAspd = `baseAspd: ${JSON.stringify(aspdObj)}`;
  
  // 替換舊的 baseAspd 值
  const regex = new RegExp(`(${jobId}[\\s\\S]*?baseAspd:)[^,]+,`, 'm');
  const match = content.match(regex);
  if (match) {
    content = content.replace(match[0], match[0].replace(/baseAspd:\s*[^,]+/, `baseAspd: ${JSON.stringify(aspdObj)}`));
    console.log(`${jobId}: ${JSON.stringify(aspdObj)}`);
  } else {
    console.log(`${jobId}: NOT FOUND`);
  }
});

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', content);
console.log('\nDone!');
