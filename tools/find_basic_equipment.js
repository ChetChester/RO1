/* 查詢 RO 原版商店價格 */
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_items_data', 'items.json'), 'utf8'));

// 找出基礎武器（不含 slot 版本）的價格
// RO 的價格通常在 NPC 腳本中定義，但我們可以從描述中找一些線索

console.log('=== 基礎武器（不含 slot） ===');
const basicWeapons = raw.filter(i => {
  if (!i.description) return false;
  if (!i.description.includes('系列:')) return false;
  if (!i.description.includes('攻击:')) return false;
  // 排除帶 slot 的版本
  if (i.name && i.name.match(/\[\d+\]/)) return false;
  // 只要基礎等級的（武器等級 1-2）
  const weaponLvMatch = i.description.match(/武器等级[:：]\s*(\d+)/);
  if (weaponLvMatch && parseInt(weaponLvMatch[1]) > 2) return false;
  return true;
});

console.log('數量:', basicWeapons.length);
basicWeapons.forEach(w => {
  const atkMatch = w.description.match(/攻击[:：]\s*(\d+)/);
  const seriesMatch = w.description.match(/系列[:：]\s*<[^>]*>([^<]+)/);
  const series = seriesMatch ? seriesMatch[1].trim() : '?';
  const weightMatch = w.description.match(/重量[:：]\s*(\d+)/);
  console.log(`  ${w.id} ${w.name}: ATK ${atkMatch ? atkMatch[1] : '?'}, 類型 ${series}, 重量 ${weightMatch ? weightMatch[1] : '?'}`);
});

console.log('\n=== 基礎防具（不含 slot） ===');
const basicArmors = raw.filter(i => {
  if (!i.description) return false;
  if (!i.description.includes('系列:')) return false;
  if (!i.description.includes('防御:')) return false;
  // 排除帶 slot 的版本
  if (i.name && i.name.match(/\[\d+\]/)) return false;
  return true;
});

console.log('數量:', basicArmors.length);
basicArmors.forEach(a => {
  const defMatch = a.description.match(/防御[:：]\s*(\d+)/);
  const seriesMatch = a.description.match(/系列[:：]\s*<[^>]*>([^<]+)/);
  const series = seriesMatch ? seriesMatch[1].trim() : '?';
  const weightMatch = a.description.match(/重量[:：]\s*(\d+)/);
  console.log(`  ${a.id} ${a.name}: DEF ${defMatch ? defMatch[1] : '?'}, 類型 ${series}, 重量 ${weightMatch ? weightMatch[1] : '?'}`);
});
