const fs = require('fs');
let c = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');
const shields = { novice:-6, swordsman:-5, mage:-10, archer:-9, merchant:-5, thief:-6, acolyte:-7, knight:-5, wizard:-8, hunter:-9, blacksmith:-5, assassin:-6, priest:-5 };
Object.entries(shields).forEach(([id, val]) => {
  const re = new RegExp('(' + id + '[\\s\\S]*?baseAspd:\\s*\\{[^}]+\\},)');
  if (re.test(c)) {
    c = c.replace(re, (m) => m.replace(/},/, '}, shieldPenalty: ' + val + ','));
    console.log(id + ': OK');
  } else {
    console.log(id + ': SKIP');
  }
});
fs.writeFileSync('D:/mimo/ro-idle/js/data.js', c);
console.log('Done!');
