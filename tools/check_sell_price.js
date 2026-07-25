/* 檢查 ro_items_data 是否有賣價 */
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_items_data', 'items.json'), 'utf8'));

// 檢查前 10 個物品的所有欄位
console.log('前 5 個物品的所有欄位:');
raw.slice(0, 5).forEach(item => {
  console.log(`  ${item.id} ${item.name}: ${Object.keys(item).join(', ')}`);
});

// 檢查是否有 sell_price, buy_price 等欄位
const hasSellPrice = raw.some(i => i.sell_price || i.sellPrice || i.sell);
const hasBuyPrice = raw.some(i => i.buy_price || i.buyPrice || i.buy);

console.log(`\n有 sell 欄位: ${hasSellPrice}`);
console.log(`有 buy 欄位: ${hasBuyPrice}`);

// 檢查 description 中是否有價格資訊
console.log('\n前 3 個物品的 description:');
raw.slice(0, 3).forEach(item => {
  console.log(`  ${item.id} ${item.name}:`);
  console.log(`    ${item.description.substring(0, 150)}...`);
});
