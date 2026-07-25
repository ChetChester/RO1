/* 找出 "identifier starts immediately after numeric literal" 錯誤 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 找 "數字後直接接 identifier" 的模式
// 例如: 123abc (缺少運算符)
const regex = /(\d)([a-zA-Z_$])/g;
let m;
let count = 0;
while ((m = regex.exec(data)) !== null) {
  // 排除正常情況：行首縮進、屬性名前面有空格
  const prev = data.substring(Math.max(0, m.index - 5), m.index);
  const next = data.substring(m.index, m.index + 20);
  
  // 跳過在行首的（可能是行號或縮進）
  if (prev.endsWith('\n  ') || prev.endsWith('\n')) continue;
  // 跳過在引號內的（屬性值）
  if (prev.includes('"') && !prev.endsWith('"')) continue;
  
  count++;
  if (count <= 10) {
    console.log(`位置 ${m.index}: ...${data.substring(m.index - 20, m.index + 20)}...`);
  }
}
console.log(`\n找到 ${count} 處數字後接 identifier`);
