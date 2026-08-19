/* 存檔匯出 / 匯入（importSaveToSlot）測試。
   驗證：匯出拿得到原始序列化、匯入會跑相容性遷移、
   覆寫與失敗還原都不會誤傷其他欄位。 */
const H = require('./harness');

const g = H.boot();
const t = H.tester();
const key = i => g.getSlotKey(i);

// 建一隻角色、存進欄位 0，取得它的序列化原始字串
g.createCharacter('甲', { str: 5, agi: 5, vit: 5, int: 0, dex: 0, luk: 0 }, 'male');
g.state.gold = 123456;
g.state.relics = undefined;      // 故意拿掉，測匯入時遷移會補回
g.saveGame();
const raw0 = g.localStorage.getItem(key(0));
t.ok('匯出拿得到原始 JSON', typeof raw0 === 'string' && raw0.includes('甲'));
const s0 = JSON.parse(raw0);

// 匯入到空欄位 1：成功、欄位出現、名字對、遷移補回 relics
const r1 = g.importSaveToSlot(1, JSON.parse(JSON.stringify(s0)));
t.ok('匯入空欄位成功', r1.ok);
const s1 = JSON.parse(g.localStorage.getItem(key(1)));
t.eq('匯入後名字相同', s1.name, '甲');
t.eq('遷移補回八格遺物', Object.keys(s1.relics).length, 8);
t.eq('匯入後鋅幣保留', s1.gold, 123456);

// 覆寫已佔用欄位：欄位 1 放一隻「乙」，再用「甲」蓋掉
g.localStorage.setItem(key(1), JSON.stringify(Object.assign({}, s0, { name: '乙' })));
const r2 = g.importSaveToSlot(1, JSON.parse(JSON.stringify(s0)));
t.ok('覆寫已佔用欄位成功', r2.ok);
const s2 = JSON.parse(g.localStorage.getItem(key(1)));
t.eq('覆寫後名字變成甲', s2.name, '甲');

// 無效檔案：格式對（有 name/jobId）但結構壞掉 → 失敗且原存檔不變
const r3 = g.importSaveToSlot(2, { name: 'X', jobId: 'novice', garbage: true });
t.ok('結構壞掉但格式合格的存檔被拒絕', !r3.ok);
t.eq('失敗時欄位 2 沒有被寫入', g.localStorage.getItem(key(2)), null);
t.eq('失敗時欄位 1 原存檔不變', JSON.parse(g.localStorage.getItem(key(1))).name, '甲');

// 完全不是存檔 → 拒絕
const r4 = g.importSaveToSlot(3, { foo: 1 });
t.ok('非存檔物件被拒絕', !r4.ok);
t.eq('拒絕後欄位 3 沒有被寫入', g.localStorage.getItem(key(3)), null);

/* ---------------- 倉庫匯出 / 匯入 ---------------- */
const WH_KEY = 'ro_idle_warehouse';
g.localStorage.removeItem(WH_KEY);
// 匯入：物品、個體裝備、鋅幣都進得去
const whSrc = {
  gold: 5000,
  items: [
    { item: 'red_potion', qty: 30 },
    { item: 'does_not_exist', qty: 99 },           // 白名單外，該被丟掉
    { item: 'not_a_string', qty: 1 },              // 形狀錯，該被丟掉
    { item: 'knife', qty: 1, instanceId: 'x1', refine: 7, cards: ['a'] }
  ]
};
const rw1 = g.importWarehouse(whSrc);
t.ok('倉庫匯入成功', rw1.ok);
const wh1 = JSON.parse(g.localStorage.getItem(WH_KEY));
t.eq('倉庫鋅幣帶入', wh1.gold, 5000);
t.eq('一般物品帶入', wh1.items.find(r => r.item === 'red_potion').qty, 30);
t.ok('不存在的道具被丟掉', !wh1.items.some(r => r.item === 'does_not_exist'));
t.ok('形狀錯的列被丟掉', !wh1.items.some(r => r.item === 'not_a_string'));
const inst = wh1.items.find(r => r.item === 'knife');
t.ok('個體裝備帶入且保留精煉', inst && inst.refine === 7);
t.ok('個體裝備卡片原樣帶入', inst && Array.isArray(inst.cards) && inst.cards[0] === 'a');
t.ok('個體裝備換了新 instanceId', inst && inst.instanceId && inst.instanceId !== 'x1');
// 匯入會先清掉舊資料（覆寫語意）
const rw2 = g.importWarehouse({ gold: 1, items: [] });
const wh2 = JSON.parse(g.localStorage.getItem(WH_KEY));
t.ok('覆寫後舊物品清空', wh2.items.length === 0);
t.eq('覆寫後鋅幣更新', wh2.gold, 1);
// 非倉庫檔案 → 拒絕，且不動到已存在的倉庫
const rw3 = g.importWarehouse({ foo: 1 });
t.ok('非倉庫檔案被拒絕', !rw3.ok);
t.eq('拒絕後倉庫原樣不動', JSON.parse(g.localStorage.getItem(WH_KEY)).gold, 1);

process.exit(t.report('存檔匯出/匯入'));