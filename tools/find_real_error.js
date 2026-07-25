/* 找出真正的 "identifier starts immediately after numeric literal" */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 找 數字直接接字母（不含底線）的模式
// 例如: 123abc 而不是 123_abc
const regex = /(\d)([a-zA-Z])/g;
let m;
let count = 0;
const results = [];

while ((m = regex.exec(data)) !== null) {
  const prev = data.substring(Math.max(0, m.index - 30), m.index);
  const next = data.substring(m.index, m.index + 30);
  
  // 排除在引號內的
  let inQuote = false;
  for (let i = 0; i < m.index; i++) {
    if (data[i] === '"' && (i === 0 || data[i-1] !== '\\')) {
      inQuote = !inQuote;
    }
  }
  if (inQuote) continue;
  
  // 排除行首
  if (prev.endsWith('\n') || prev.endsWith('\n  ')) continue;
  
  count++;
  if (count <= 20) {
    results.push({ pos: m.index, context: data.substring(m.index - 20, m.index + 20) });
  }
}

console.log(`找到 ${count} 處數字直接接字母（不含底線）`);
results.forEach(r => {
  console.log(`  位置 ${r.pos}: ${r.context}`);
});
