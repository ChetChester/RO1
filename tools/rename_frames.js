const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'images', 'frames', 'knight_male');
fs.readdirSync(dir).filter(f => f.endsWith('.png')).forEach(f => {
  const n = f.replace(/^騎士攻擊動畫_frame_/, 'frame_');
  fs.renameSync(path.join(dir, f), path.join(dir, n));
  console.log(f + ' -> ' + n);
});
