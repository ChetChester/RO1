/* 找出所有非 ASCII 字元 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 找出所有非 ASCII 字元
const nonAscii = new Set();
for (let i = 0; i < data.length; i++) {
  const code = data.charCodeAt(i);
  if (code > 127) {
    nonAscii.add({ code, char: data[i], pos: i });
  }
}

console.log(`非 ASCII 字元種類: ${nonAscii.size}`);

// 分組統計
const groups = {};
for (const item of nonAscii) {
  const range = Math.floor(item.code / 256) * 256;
  if (!groups[range]) groups[range] = 0;
  groups[range]++;
}

console.log('\n分組統計:');
for (const [range, count] of Object.entries(groups).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${range}-${range + 255}: ${count} 個`);
}

// 找出可能是問題的字元
// 例如：全形符號、特殊控制字元等
const suspicious = [...nonAscii].filter(item => {
  // 排除常見的中文和 emoji
  if (item.code >= 0x4E00 && item.code <= 0x9FFF) return false; // 中文
  if (item.code >= 0x3000 && item.code <= 0x303F) return false; // 中文標點
  if (item.code >= 0xFF00 && item.code <= 0xFFEF) return false; // 全形
  if (item.code >= 0x1F000 && item.code <= 0x1FFFF) return false; // Emoji
  return true;
});

if (suspicious.length > 0) {
  console.log('\n可疑字元:');
  suspicious.slice(0, 20).forEach(item => {
    console.log(`  位置 ${item.pos}: code ${item.code}, char '${item.char}'`);
  });
}
