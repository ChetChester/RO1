/* 生怪速度的顯示，以及事件音效的接線（#146）。

   **生怪速度**：本作沒有「移動」，官方所有「移動速度上升」一律換算成生怪加速。
   問題是畫面上沒有任何地方看得到——玩家點了騎乘術、裝了月夜貓卡，
   也不知道到底有沒有生效。角色分頁現在會顯示，而顯示用的必須是
   **spawnMonster() 實際在用的那一支**，兩邊各算一次遲早會對不上。

   **事件音效**：ui.js 不在治具的載入清單裡，所以這裡驗的是接線的兩端——
   音檔真的在那個路徑上、engine.js 呼叫時有 typeof 防呆（沒有的話
   離線結算或測試環境一跑到升級就整支炸掉）。 */
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const t = H.tester();

const ROOT = path.join(__dirname, '..');

function hero() {
  const g = H.boot();
  H.mkChar(g, { path: ['swordsman', 'knight'], job: 'knight', baseLevel: 99 });
  g.state.mapId = g.MAPS.find(m => (m.monsters || []).length).id;
  g.state.encounterMode = 'melee';
  g.state.farmMode = 0;
  g.recomputeDerived(true);
  return g;
}

/* ---------- 基準值與各個加速來源 ---------- */
{
  const g = hero();
  g.state.hasRiding = false;
  g.state.cardSpawnSpeedPct = 0;
  g.state.songSpawnSpeedPct = 0;
  t.eq('沒有任何加速：場上有怪 3 秒補一批', g.spawnDelayMs(false), 3000);
  t.eq('沒有任何加速：清場後 0.5 秒補一批', g.spawnDelayMs(true), 500);
  t.eq('沒有加速來源時列表是空的', g.spawnSpeedSources().length, 0);

  g.state.hasRiding = true;
  t.eq('騎乘術：3000 → 2250', g.spawnDelayMs(false), 2250);
  t.eq('騎乘術：500 → 375', g.spawnDelayMs(true), 375);
  t.ok('列得出騎乘術', g.spawnSpeedSources().some(x => /騎乘/.test(x.name)));

  g.state.hasRiding = false;
  g.state.cardSpawnSpeedPct = 100;
  t.eq('卡片 +100% 等於快一倍', g.spawnDelayMs(false), 1500);
  const src = g.spawnSpeedSources();
  t.eq('列得出卡片那一項', (src.find(x => x.name === '卡片') || {}).pct, 100);
}
{
  // 多個來源要相乘，不是相加
  const g = hero();
  g.state.hasRiding = true;            // 3000 → 2250
  g.state.cardSpawnSpeedPct = 50;      // ÷1.5 → 1500
  g.state.songSpawnSpeedPct = 50;      // ÷1.5 → 1000
  t.eq('三個來源相乘', g.spawnDelayMs(false), 1000);
  t.eq('三個來源都列得出來', g.spawnSpeedSources().length, 3);
}
{
  // 下限 100ms：補得太快等於單方面拉高挨打量
  const g = hero();
  g.state.cardSpawnSpeedPct = 100000;
  t.eq('不會低於 100ms', g.spawnDelayMs(false), 100);
  t.eq('清場那一段也吃同一個下限', g.spawnDelayMs(true), 100);
}
{
  // 打寶模式的 spawn 是**乘**在延遲上（0.8 = 快 25%）
  const g = hero();
  const base = g.spawnDelayMs(false);
  g.state.farmMode = 2;
  t.ok('打寶模式補怪更快', g.spawnDelayMs(false) < base, base + ' → ' + g.spawnDelayMs(false));
  t.ok('列得出打寶模式', g.spawnSpeedSources().some(x => x.name === '打寶模式'));
}

/* ---------- 顯示的數字要跟真正生怪用的一致 ----------
   這是抽成函式的唯一理由。spawnMonster() 自己算一份、畫面另算一份的話，
   玩家看到「快 25%」但實際沒變，比不顯示更糟。 */
{
  const g = hero();
  // 騎士本來就帶著騎乘術（清場 375ms），要驗基準值得先關掉
  g.state.hasRiding = false;
  g.state.cardSpawnSpeedPct = 0;
  g.state.monsters = [];
  const gap = g.spawnDelayMs(true);
  t.eq('前提：清場間隔是 500ms', gap, 500);
  g.state.lastSpawnTime = Date.now() - 400;       // 還沒到 500ms
  g.spawnMonster();
  t.eq('沒到間隔就不生', g.state.monsters.length, 0);

  g.state.cardSpawnSpeedPct = 100;                // 500 → 250，400ms 已經超過了
  g.state.lastSpawnTime = Date.now() - 400;
  g.spawnMonster();
  t.ok('加速之後同樣的 400ms 就生得出來', g.state.monsters.length > 0,
    '間隔 ' + g.spawnDelayMs(true) + 'ms');
}
{
  /* 產出預估（地圖分頁的每 10 分鐘收益）以前只認騎乘術，
     卡片／合奏／手推車／打寶四個加速來源全都沒算，裝了月夜貓卡的人看到的一直偏低。 */
  const g = hero();
  const map = g.MAPS.find(m => m.id === g.state.mapId);
  const before = g.estimateMapYield(map);
  g.state.cardSpawnSpeedPct = 200;
  const after = g.estimateMapYield(map);
  t.ok('預估抓得到數字（後面的斷言才有意義）', before.killsPer10m > 0, JSON.stringify(before.killsPer10m));
  t.ok('產出預估會跟著生怪加速一起變', after.killsPer10m >= before.killsPer10m,
    before.killsPer10m.toFixed(1) + ' → ' + after.killsPer10m.toFixed(1));
  // 生怪被節流時才會有差；沒被節流的話兩邊本來就一樣，那也是對的
  t.ok('節流旗標讀得到', typeof before.spawnCapped === 'boolean');
}

/* ---------- 事件音效的檔案與接線 ---------- */
{
  const files = ['levelup.ogg', 'refine_success.ogg', 'mvp_victory.ogg', 'login.ogg'];
  const missing = files.filter(f => !fs.existsSync(path.join(ROOT, 'WAV', 'event', f)));
  t.eq('四個音檔都在 WAV/event/ 底下', missing.length, 0, missing.join('、'));
  /* 檔名要是**純 ASCII**：既有那四個資料夾是中文名，而 `file://`（單機版就是
     雙擊 index.html）不會自己補 URL 編碼，當初整批 404 過一次。 */
  const nonAscii = fs.readdirSync(path.join(ROOT, 'WAV', 'event')).filter(f => /[^\x20-\x7e]/.test(f));
  t.eq('檔名沒有中文（file:// 不會自動編碼）', nonAscii.length, 0, nonAscii.join('、'));
  t.ok('原本的中文資料夾已經清掉', !fs.existsSync(path.join(ROOT, '音效')));

  const eng = fs.readFileSync(path.join(ROOT, 'js', 'engine.js'), 'utf8');
  const calls = eng.match(/playEventSfx\(/g) || [];
  t.ok('engine.js 真的有呼叫', calls.length >= 3, calls.length + ' 處');
  /* 每一處都要有 typeof 防呆：engine.js 會在沒有 ui.js 的環境跑（治具、離線結算），
     少一個防呆就是升級的當下整支炸掉。 */
  const unguarded = (eng.match(/^.*playEventSfx\(.*$/gm) || [])
    .filter(l => !/typeof playEventSfx === 'function'/.test(l));
  t.eq('每一處都有 typeof 防呆', unguarded.length, 0, unguarded.slice(0, 2).join(' | '));

  const ui = fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8');
  t.ok('ui.js 定義了 playEventSfx', /function playEventSfx\(/.test(ui));
  files.forEach(f => t.ok(f + ' 有被 ui.js 引用', ui.includes(f)));
}
{
  // 升級音效整支 gainExp 只放一次，不是每升一級放一次
  const eng = fs.readFileSync(path.join(ROOT, 'js', 'engine.js'), 'utf8');
  const body = eng.slice(eng.indexOf('function gainExp('), eng.indexOf('function gainExp(') + 2000);
  t.eq('gainExp 裡只有一處播放', (body.match(/playEventSfx\('levelup'\)/g) || []).length, 1);
  t.ok('而且在迴圈外面（靠 leveled 旗標）', /leveled && typeof playEventSfx/.test(body));
}
{
  // 真的連升好幾級也不會爆掉（沒有 ui.js 的環境）。99 是這個職業的上限，要從低等開始
  const g = H.boot();
  H.mkChar(g, { path: ['swordsman', 'knight'], job: 'knight', baseLevel: 30 });
  const before = g.state.baseLevel;
  g.gainExp(1e12, 1e12);
  t.ok('沒有 ui.js 時大量升級不會丟例外', g.state.baseLevel > before,
    before + ' → ' + g.state.baseLevel);
}

process.exit(t.report('生怪速度顯示與事件音效'));
