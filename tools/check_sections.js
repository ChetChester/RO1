/* 分段檢查 data.js */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const data = fs.readFileSync(dataPath, 'utf8');

// 找到主要區塊
const sections = [
  { name: '開頭', start: 0, end: data.indexOf('const ITEMS = {') },
  { name: 'ITEMS', start: data.indexOf('const ITEMS = {'), end: data.indexOf('\n};', data.indexOf('const ITEMS = {')) + 3 },
  { name: 'MONSTERS', start: data.indexOf('const MONSTERS = {'), end: data.indexOf('\n};', data.indexOf('const MONSTERS = {')) + 3 },
  { name: '結尾', start: data.indexOf('\n};', data.indexOf('const MONSTERS = {')) + 3, end: data.length },
];

for (const section of sections) {
  if (section.start === -1 || section.end === -1) {
    console.log(`${section.name}: 找不到`);
    continue;
  }
  
  const block = data.substring(section.start, section.end);
  console.log(`${section.name}: ${section.start}~${section.end} (${block.length} bytes)`);
  
  // 檢查是否有明顯問題
  // 1. 引號配對
  let quotes = 0;
  for (const ch of block) {
    if (ch === '"') quotes++;
  }
  if (quotes % 2 !== 0) {
    console.log(`  ⚠️ 引號數量不對: ${quotes}`);
  }
  
  // 2. 花括號配對
  let braces = 0;
  for (const ch of block) {
    if (ch === '{') braces++;
    if (ch === '}') braces--;
  }
  if (braces !== 0) {
    console.log(`  ⚠️ 花括號不配對: ${braces}`);
  }
}
