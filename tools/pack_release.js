/* 打包單機版（#121）。

   產出 `dist/諸神放置錄_v1.1.zip`，玩家解壓縮後雙擊 index.html 就能玩。

   **只放遊戲跑起來真的會用到的東西**：
     index.html / css / js / images / music / WAV / LICENSE / 玩法說明
   刻意排除的：
     tools（測試治具，本來就 gitignore）、docs（開發紀錄）、node_modules、
     .git、參考用、原始資料 yml、Godot 匯入殘留

   為什麼不用 npm 套件：這個專案沒有任何執行期依賴，為了打包裝一個 zip 套件
   反而讓「clone 下來就能跑」不成立。改用系統本來就有的壓縮工具
   （Windows 的 tar / PowerShell Compress-Archive），失敗就退回「複製成資料夾」，
   那個至少一定會成功。

   用法：node tools/pack_release.js [版本號]
*/
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VERSION = process.argv[2] || 'v1.1';
const NAME = `諸神放置錄_${VERSION}`;
const DIST = path.join(ROOT, 'dist');
const STAGE = path.join(DIST, NAME);

/* 要帶走的東西。目錄整包複製，檔案單獨複製 */
const INCLUDE_DIRS = ['css', 'js', 'images', 'music', 'WAV'];
const INCLUDE_FILES = ['index.html', 'LICENSE'];

/* 目錄裡面仍要濾掉的：開發用的說明與 Godot 匯入殘留 */
const SKIP_NAMES = new Set(['.DS_Store', 'Thumbs.db']);
const SKIP_EXT = new Set(['.import']);

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  let files = 0, bytes = 0;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP_NAMES.has(e.name)) continue;
    if (SKIP_EXT.has(path.extname(e.name))) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) {
      const r = copyDir(s, d);
      files += r.files; bytes += r.bytes;
    } else {
      fs.copyFileSync(s, d);
      files++; bytes += fs.statSync(s).size;
    }
  }
  return { files, bytes };
}

const README_TXT = `諸神放置錄 ${VERSION}　—　單機版

【怎麼玩】
  雙擊 index.html 就能玩，不需要安裝任何東西，也不需要連網路。
  建議用 Chrome、Edge 或 Firefox 開啟。

【存檔在哪】
  存在你的瀏覽器裡（localStorage），不會上傳到任何地方。
  ⚠️ 用瀏覽器的「清除瀏覽資料」會把存檔一起清掉，請留意。
  ⚠️ 換瀏覽器或換電腦，存檔不會跟著走。

【完全免費】
  本作永遠免費，沒有付費項目、沒有抽卡、沒有廣告。
  若你是付費取得本作的，那不是作者提供的版本，請要求退款。

【授權】
  CC BY-NC-SA 4.0 —— 可自由散布與修改，但不得用於任何商業用途，
  修改版本亦須採用相同授權。完整條款見 LICENSE。

  本作設定致敬《仙境傳說 Ragnarok Online》，相關素材權利歸
  Gravity Co., Ltd. 及其授權方所有。本專案僅供同人交流，
  未獲原權利人授權或認可。若原權利人認為有侵權之虞，
  請聯繫作者，本專案將立即下架。

【特別鳴謝】
  本作品靈感源自 秋玥[shifine] 發布的免費遊戲
  https://forum.gamer.com.tw/C.php?bsn=84452&snA=8362&to=1
`;

function main() {
  // 每次重打包都從乾淨的暫存目錄開始，不然上一版刪掉的檔案會留在裡面
  if (fs.existsSync(STAGE)) fs.rmSync(STAGE, { recursive: true, force: true });
  fs.mkdirSync(STAGE, { recursive: true });

  let files = 0, bytes = 0;
  INCLUDE_DIRS.forEach(d => {
    const src = path.join(ROOT, d);
    if (!fs.existsSync(src)) { console.log(`  ⚠️ 找不到 ${d}/，略過`); return; }
    const r = copyDir(src, path.join(STAGE, d));
    files += r.files; bytes += r.bytes;
    console.log(`  ${d}/　${r.files} 個檔案　${(r.bytes / 1048576).toFixed(1)} MB`);
  });
  INCLUDE_FILES.forEach(f => {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src)) { console.log(`  ⚠️ 找不到 ${f}，略過`); return; }
    fs.copyFileSync(src, path.join(STAGE, f));
    files++; bytes += fs.statSync(src).size;
  });
  fs.writeFileSync(path.join(STAGE, '玩法說明.txt'), README_TXT, 'utf8');
  files++;

  console.log(`\n  合計 ${files} 個檔案、${(bytes / 1048576).toFixed(1)} MB`);

  /* 壓縮。Windows 10 內建 bsdtar，`tar -a -cf x.zip` 會依副檔名選 zip；
     失敗就退回 PowerShell 的 Compress-Archive。兩個都不行也不算失敗——
     資料夾本身已經可以直接玩了。 */
  const zip = path.join(DIST, `${NAME}.zip`);
  if (fs.existsSync(zip)) fs.rmSync(zip);
  const tries = [
    ['tar', ['-a', '-c', '-f', zip, '-C', DIST, NAME]],
    ['powershell', ['-NoProfile', '-Command',
      `Compress-Archive -Path '${STAGE}' -DestinationPath '${zip}' -Force`]],
  ];
  for (const [cmd, args] of tries) {
    try {
      execFileSync(cmd, args, { stdio: 'ignore' });
      if (fs.existsSync(zip)) {
        console.log(`\n✅ ${path.relative(ROOT, zip)}　${(fs.statSync(zip).size / 1048576).toFixed(1)} MB`);
        return;
      }
    } catch (e) { /* 換下一個 */ }
  }
  console.log(`\n⚠️ 壓縮失敗，但資料夾已經備好且可以直接玩：${path.relative(ROOT, STAGE)}`);
}

main();
