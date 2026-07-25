/* 分析物品資料中是否有商店資訊 */
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_items_data', 'items.json'), 'utf8'));

// 看前幾個武器的完整結構
const weapons = raw.filter(i => i.description && i.description.includes('系列:'));
console.log('前3個武器的完整欄位:');
weapons.slice(0, 3).forEach(w => {
  console.log('---');
  console.log('id:', w.id, 'name:', w.name);
  console.log('english_name:', w.english_name);
  console.log('所有欄位:', Object.keys(w).join(', '));
  if (w.other_sources) console.log('other_sources:', w.other_sources);
  if (w.drop_monster_ids) console.log('drop_monster_ids:', w.drop_monster_ids);
});

// 統計有 other_sources 的物品
const withSources = raw.filter(i => i.other_sources && i.other_sources.length > 0);
console.log('\n有 other_sources 的物品:', withSources.length);

// 看 other_sources 的值範圍
const allSources = new Set();
withSources.forEach(i => i.other_sources.forEach(s => allSources.add(s)));
console.log('other_sources 唯一值:', allSources.size);
console.log('other_sources 值範圍:', Math.min(...allSources), '~', Math.max(...allSources));

// 看一些值的意義
const sourceSamples = [...allSources].slice(0, 20);
console.log('\nother_sources 前20個值:', sourceSamples.join(', '));

// 統計有 buyPrice 的物品
const withBuy = raw.filter(i => {
  const desc = i.description || '';
  return desc.includes('商店') || desc.includes('NPC') || desc.includes('贩卖') || desc.includes('販賣');
});
console.log('\n描述中提到商店/NPC的物品:', withBuy.length);
