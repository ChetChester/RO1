/* 使用 node --check 檢查 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');

try {
  execSync(`node --check "${dataPath}"`, { encoding: 'utf8' });
  console.log('node --check: 語法正確！');
} catch (e) {
  console.log('node --check 錯誤:');
  console.log(e.stdout || e.message);
  if (e.stderr) console.log('stderr:', e.stderr);
}
