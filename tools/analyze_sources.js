/* 分析 other_sources 的頻率和意義 */
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_items_data', 'items.json'), 'utf8'));

// 統計 other_sources 中每個值的頻率
const sourceFreq = {};
raw.forEach(i => {
  if (i.other_sources) {
    i.other_sources.forEach(s => {
      sourceFreq[s] = (sourceFreq[s] || 0) + 1;
    });
  }
});

// 排序找出最常見的
const sorted = Object.entries(sourceFreq).sort((a, b) => b[1] - a[1]);
console.log('other_sources 頻率 TOP 30:');
sorted.slice(0, 30).forEach(([id, count]) => {
  console.log(`  ${id}: ${count} 次`);
});

// 看哪些物品有 buyPrice
const withBuyPrice = raw.filter(i => {
  const desc = i.description || '';
  return desc.includes('商店') || desc.includes('贩卖') || desc.includes('販賣');
});
console.log('\n描述提到商店的物品 (前5個):');
withBuyPrice.slice(0, 5).forEach(i => {
  console.log(`  ${i.id} ${i.name}`);
  console.log(`    desc: ${i.description.substring(0, 100)}...`);
});

// 檢查 other_sources 中 603 是什麼
const items603 = raw.filter(i => i.other_sources && i.other_sources.includes(603));
console.log(`\n有 other_sources=603 的物品: ${items603.length}`);
console.log('範例:', items603.slice(0, 5).map(i => `${i.id} ${i.name}`).join(', '));
