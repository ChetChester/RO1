/* ============================================================
   RO 放置世界 — 畫面渲染
   ============================================================ */

let creationAlloc = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 };
let creationBudget = 15;
let selectedGender = 'male';
let activeTab = 'map';

/* ---------------- 初始畫面切換 ---------------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

let slotPage = 0;
const SLOTS_PER_PAGE = 3;

function initApp() {
  renderCreationStats();
  showScreen('screen-title');
}

function playTitleMusic() {
  bgmToken++;
  const myToken = bgmToken;
  stopMusic();
  const muted = state && state.muted;
  if (muted) return;
  const vol = (state && state.bgmVolume != null) ? state.bgmVolume : 0.5;
  const audio = new Audio();
  audio.loop = true;
  audio.volume = vol;
  audio.addEventListener('canplaythrough', () => {
    if (bgmToken !== myToken) return;
    bgmAudio = audio;
    audio.play().catch(() => {});
  }, { once: true });
  audio.src = 'music/maps/0000.mp3';
  audio.load();
}

function showSlotSelect() {
  document.getElementById('title-buttons').classList.add('hidden');
  document.getElementById('slot-select').classList.remove('hidden');
  slotPage = 0;
  renderSlotList();
  // 點擊開始冒險後播放標題音樂
  playTitleMusic();
}

function backToTitle() {
  saveGame();
  if (typeof tickTimer !== 'undefined' && tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  stopAnim();
  if (animCanvas) animCanvas.style.display = 'none';
  const img = document.getElementById('player-img');
  if (img) img.style.display = '';
  document.getElementById('title-buttons').classList.remove('hidden');
  document.getElementById('slot-select').classList.add('hidden');
  showScreen('screen-title');
  playTitleMusic();
}

function renderSlotList() {
  const list = document.getElementById('slot-list');
  const pagination = document.getElementById('slot-pagination');
  if (!list) return;
  const start = slotPage * SLOTS_PER_PAGE;
  const end = Math.min(start + SLOTS_PER_PAGE, MAX_SLOTS);
  let html = '';
  for (let i = start; i < end; i++) {
    const raw = localStorage.getItem(getSlotKey(i));
    if (raw) {
      try {
        const s = JSON.parse(raw);
        const job = JOB_TREE[s.jobId] || { icon: '?', name: '???' };
        html += `<div class="slot-item has-save" onclick="selectSlot(${i})">
          <div class="slot-header">欄位 ${i + 1}</div>
          <div class="slot-info">${job.icon} ${s.name || '無名'} Lv.${s.baseLevel || '?'} ${job.name}</div>
          <button class="btn-small ghost" onclick="event.stopPropagation();deleteSlotConfirm(${i})">刪除</button>
        </div>`;
      } catch(e) {
        html += `<div class="slot-item" onclick="selectSlot(${i})"><div class="slot-header">欄位 ${i + 1}</div><div class="slot-info">損壞的存檔</div></div>`;
      }
    } else {
      html += `<div class="slot-item empty-slot" onclick="selectSlot(${i})">
        <div class="slot-header">欄位 ${i + 1}</div>
        <div class="slot-info">空欄位</div>
      </div>`;
    }
  }
  list.innerHTML = html;

  // 分頁按鈕
  const totalPages = Math.ceil(MAX_SLOTS / SLOTS_PER_PAGE);
  let pagHtml = `<button class="btn-small" onclick="if(slotPage>0){slotPage--;renderSlotList();}" ${slotPage===0?'disabled':''}>◀</button>`;
  for (let p = 0; p < totalPages; p++) {
    pagHtml += `<button class="btn-small ${p===slotPage?'active':''}" onclick="slotPage=${p};renderSlotList();">${p + 1}</button>`;
  }
  pagHtml += `<button class="btn-small" onclick="if(slotPage<${totalPages - 1}){slotPage++;renderSlotList();}" ${slotPage>=totalPages-1?'disabled':''}>▶</button>`;
  pagination.innerHTML = pagHtml;
}

function selectSlot(slot) {
  currentSlot = slot;
  if (hasSave()) {
    continueGame();
  } else {
    goCreateNew();
  }
}

function deleteSlotConfirm(slot) {
  if (confirm('確定要刪除欄位 ' + (slot + 1) + ' 的存檔嗎？')) {
    localStorage.removeItem(getSlotKey(slot));
    renderSlotList();
  }
}

function goCreateNew() {
  creationAlloc = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 };
  creationBudget = 15;
  renderCreationStats();
  showScreen('screen-create');
}

function continueGame() {
  try {
    if (loadGame()) {
      const off = computeOfflineProgress();
      enterGame();
      if (off) showOfflineModal(off);
    } else {
      console.error('Failed to load game');
    }
  } catch (e) {
    console.error('continueGame error:', e);
  }
}

const CREATE_STAT_CAP = 9; // 創角階段單項屬性上限

function creationAdjust(key, delta) {
  if (delta > 0) {
    if (creationBudget <= 0) return;
    if (1 + creationAlloc[key] >= CREATE_STAT_CAP) return;
    creationAlloc[key]++;
    creationBudget--;
  } else {
    if (creationAlloc[key] <= 0) return;
    creationAlloc[key]--;
    creationBudget++;
  }
  renderCreationStats();
}

function renderCreationStats() {
  document.getElementById('creation-budget').textContent = creationBudget;
  STAT_KEYS.forEach(k => {
    const val = 1 + creationAlloc[k];
    document.getElementById(`create-val-${k}`).textContent = val;
    document.getElementById(`create-plus-${k}`).disabled = (creationBudget <= 0 || val >= CREATE_STAT_CAP);
    document.getElementById(`create-minus-${k}`).disabled = (creationAlloc[k] <= 0);
  });
}

function selectGender(g) {
  selectedGender = g;
  document.getElementById('btn-gender-male').classList.toggle('active', g === 'male');
  document.getElementById('btn-gender-female').classList.toggle('active', g === 'female');
}

function confirmCreate() {
  const nameInput = document.getElementById('char-name-input');
  const name = (nameInput.value || '').trim().slice(0, 12) || '無名冒險者';
  createCharacter(name, creationAlloc, selectedGender);
  enterGame();
}

function enterGame() {
  startLoop();
  activeTab = 'map';
  const cur = regionOf(state.mapId);
  selectedRegionId = cur ? cur.id : null;
  renderAll();
  renderMapBackground();
  updatePlayerSprite();
  initVolumeSliders();
  const muteBtn = document.getElementById('btn-mute');
  if (muteBtn) muteBtn.textContent = state.muted ? '🔇' : '🔊';
  playMapMusic();
  showScreen('screen-game');
}

/* ---------------- 主畫面渲染 ---------------- */
function onTickUI() {
  if (document.getElementById('screen-game').classList.contains('active')) {
    renderTopBar();
    // 檢測怪物列表是否變更
    const currentIds = state.monsters ? state.monsters.map(m => m.id).join(',') : '';
    if (lastMonsterDefId !== currentIds) {
      renderMonster();
    } else {
      updateMonsterHp();
    }
    renderSkillBar();
    // 即時更新角色分頁的 BUFF 倒數
    if (activeTab === 'character') updateBuffCountdown();
  }
}

// 輕量級：只更新 BUFF 倒數顯示
function updateBuffCountdown() {
  const el = document.getElementById('active-buffs');
  if (!el) return;
  if (!state.buffs || state.buffs.length === 0) {
    el.innerHTML = '';
    return;
  }
  const buffNames = { aspd: '攻速', atk: '攻擊', def: '防禦', flee: '迴避', gold: '金錢', crit: '暴擊', hit: '命中' };
  el.innerHTML = state.buffs.map(b => {
    const name = buffNames[b.type] || b.type;
    const remain = Math.ceil(b.msRemaining / 1000);
    const bonus = b.flatBonus ? `+${b.flatBonus}` : `×${b.mult.toFixed(2)}`;
    return `<span class="buff-tag">${name} ${bonus} (${remain}s)</span>`;
  }).join('');
}

function renderAll() {
  renderTopBar();
  renderMonster();
  switchTab(activeTab);
  renderLog();
}

function switchTab(name) {
  activeTab = name;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
  if (name === 'map') renderMapTab();
  if (name === 'autobattle') renderAutoBattleTab();
  if (name === 'skills') renderSkillsTab();
  if (name === 'equip') renderEquipTab();
  if (name === 'inventory') renderInventoryTab();
  if (name === 'jobtree') renderJobTree();
  if (name === 'character') renderCharacterTab();
  if (name === 'codex') renderCodexTab();
  if (name === 'achievements') renderAchievementsTab();
}

function pct(a, b) { return Math.max(0, Math.min(100, (a / b) * 100)); }

function renderTopBar() {
  const job = currentJob();
  document.getElementById('hud-name').textContent = state.name;
  document.getElementById('hud-job').textContent = `${job.icon} ${job.name}`;
  document.getElementById('hud-lv').textContent = `Lv.${state.baseLevel} / 職業Lv.${state.jobLevel}`;
  document.getElementById('hud-gold').textContent = `${state.gold} 鋅幣`;

  setBar('hud-hp-bar', 'hud-hp-text', state.hp, state.maxHp, 'HP');
  setBar('hud-sp-bar', 'hud-sp-text', state.sp, state.maxSp, 'SP');
  const bexpNeed = expToNextBaseLevel(state.baseLevel);
  setBar('hud-bexp-bar', 'hud-bexp-text', state.baseExp, bexpNeed, 'EXP');
  const jexpNeed = expToNextJobLevel(state.jobLevel);
  const jobCapped = state.jobLevel >= job.jobLevelMax;
  setBar('hud-jexp-bar', 'hud-jexp-text', jobCapped ? 1 : state.jobExp, jobCapped ? 1 : jexpNeed, jobCapped ? '職業已滿' : 'JOB EXP');

  const jobBtn = document.getElementById('btn-jobchange-alert');
  const canAny = job.next.some(canJobChange);
  jobBtn.classList.toggle('hidden', !canAny);
}

function setBar(barId, textId, val, max, label) {
  document.getElementById(barId).style.width = pct(val, max) + '%';
  document.getElementById(textId).textContent = `${label} ${Math.max(0, Math.floor(val))}/${Math.floor(max)}`;
}

// 根據職業+性別更新玩家圖片與攻擊動畫
let animTimer = null;
let animFrameIdx = 0;
let animFrameImages = {};   // { key: Image[] }
let animFramesLoaded = {};  // { key: boolean }
let animating = false;
let animCanvas = null;
let animCanvasCtx = null;
let currentAnimKey = null;

function getAnimKey() {
  const job = currentJob();
  const gender = (state && state.gender) || 'male';
  return `${job.id}_${gender}`;
}

function updatePlayerSprite() {
  const img = document.getElementById('player-img');
  if (!img) return;
  const key = getAnimKey();

  if (animFramesLoaded[key]) {
    showAnimCanvas(key);
    return;
  }
  if (animFramesLoaded[key] === false) {
    if (animCanvas) animCanvas.style.display = 'none';
    img.style.display = '';
    img.src = 'images/player_swordsman.svg';
    return;
  }
  loadAnimFrames(key).then(() => {
    if (animFrameImages[key] && animFrameImages[key].length) {
      showAnimCanvas(key);
    } else {
      if (animCanvas) animCanvas.style.display = 'none';
      img.style.display = '';
      img.src = 'images/player_swordsman.svg';
    }
  });
  img.style.display = '';
  img.src = 'images/player_swordsman.svg';
}

function showAnimCanvas(key) {
  const img = document.getElementById('player-img');
  if (!img) return;
  const frames = animFrameImages[key];
  if (!frames || !frames.length) return;
  img.style.display = 'none';
  if (!animCanvas) {
    animCanvas = document.createElement('canvas');
    animCanvas.style.cssText = 'width:120px;height:160px;image-rendering:auto;';
    img.parentNode.insertBefore(animCanvas, img);
  }
  animCanvas.style.display = '';
  animCanvas.width = frames[0].naturalWidth;
  animCanvas.height = frames[0].naturalHeight;
  animCanvasCtx = animCanvas.getContext('2d');
  currentAnimKey = key;
  animFrameIdx = 0;
  drawAnimFrame();
}

function drawAnimFrame() {
  if (!animCanvasCtx || !currentAnimKey) return;
  const frames = animFrameImages[currentAnimKey];
  if (!frames || !frames.length) return;
  animCanvasCtx.clearRect(0, 0, animCanvas.width, animCanvas.height);
  animCanvasCtx.drawImage(frames[animFrameIdx], 0, 0);
}

async function loadAnimFrames(key) {
  if (key in animFramesLoaded) return;
  animFramesLoaded[key] = false;
  const promises = [];
  for (let i = 0; i < 20; i++) {
    const src = `images/frames/${key}/frame_${String(i).padStart(3, '0')}.png`;
    promises.push(new Promise(resolve => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    }));
  }
  const results = await Promise.all(promises);
  animFrameImages[key] = results.filter(Boolean);
  animFramesLoaded[key] = animFrameImages[key].length > 0;
}

function playAttackAnim() {
  if (!currentAnimKey || !animFrameImages[currentAnimKey] || !animFrameImages[currentAnimKey].length) return;
  stopAnim();
  animating = true;
  animFrameIdx = 0;
  drawAnimFrame();
  const frames = animFrameImages[currentAnimKey];
  const interval = (state.attackInterval || 1000) / frames.length;
  animTimer = setInterval(() => {
    animFrameIdx++;
    if (animFrameIdx >= frames.length) {
      stopAnim();
      animFrameIdx = 0;
      drawAnimFrame();
      animating = false;
      return;
    }
    drawAnimFrame();
  }, interval);
}

function stopAnim() {
  if (animTimer) { clearInterval(animTimer); animTimer = null; }
}

// 音效管理
let attackAudio = null;
let hitAudio = null;

function initSoundEffects() {
  attackAudio = new Audio('WAV/_swordman_attack.wav');
  hitAudio = new Audio('WAV/_swordman_hit.wav');
}

function playAttackSound() {
  if (!attackAudio) initSoundEffects();
  if (attackAudio) {
    attackAudio.volume = (state.sfxVolume != null ? state.sfxVolume : 0.5);
    attackAudio.currentTime = 0;
    attackAudio.play().catch(() => {});
  }
}

function playHitSound() {
  if (!hitAudio) initSoundEffects();
  if (hitAudio) {
    hitAudio.volume = (state.sfxVolume != null ? state.sfxVolume : 0.5);
    hitAudio.currentTime = 0;
    hitAudio.play().catch(() => {});
  }
}

let lastMonsterDefId = null; // 追蹤目前顯示的怪物，避免重複渲染
function renderMonster() {
  const wrap = document.getElementById('monster-area');
  if (!wrap) return;
  if (!state.monsters || state.monsters.length === 0) {
    lastMonsterDefId = null;
    const map = currentMap();
    if (map && map.monsters.length === 0) {
      wrap.innerHTML = '<div class="monster-empty monster-safe">🏠 安全城鎮</div>';
    } else {
      wrap.innerHTML = '<div class="monster-empty">搜尋中…</div>';
    }
    return;
  }

  // 站位配置：左玩家 | 中1號目標 | 右側2~5號錯落
  const count = state.monsters.length;
  let html = '<div class="monster-semi-circle">';

  // 右側怪物站位（前後錯落）
  const rightPositions = [
    { x: 72, y: 15, front: true },   // ② 上方，稍靠左（前）
    { x: 82, y: 35, front: false },  // ③ 中上，稍靠右（後）
    { x: 72, y: 55, front: true },   // ④ 中下，稍靠左（前）
    { x: 82, y: 75, front: false },  // ⑤ 下方，稍靠右（後）
  ];

  state.monsters.forEach((mon, idx) => {
    const def = MONSTERS[mon.defId];
    const elemIcon = ELEMENT_ICONS[def.element] || '⚪';
    const isTarget = idx === 0;

    let x, y, size;
    if (isTarget) {
      // 中間：1號目標
      x = 50;
      y = 50;
      size = 100;
    } else {
      // 右側：2~5號錯落
      const rightIdx = Math.min(idx - 1, rightPositions.length - 1);
      const pos = rightPositions[rightIdx];
      x = pos.x;
      y = pos.y;
      size = 65;
    }

    html += `
      <div class="monster-slot ${isTarget ? 'target' : ''}" id="monster-slot-${mon.id}" style="left:${x}%;top:${y}%;transform:translate(-50%,-50%);">
        <img src="${monsterImgSrc(mon.defId)}" alt="${def.name}" style="width:${size}px;height:${size}px;" onerror="this.onerror=null;this.src='${placeholderImgSrc('monster')}'">
        <div class="monster-name" style="font-size:${isTarget ? '12' : '10'}px;">${def.name} Lv.${def.level} <span class="monster-element elem-${def.element}">${elemIcon}</span></div>
        <div class="monster-hp-bar" style="width:${isTarget ? 80 : 56}px;"><div id="monster-hp-bar-${mon.id}" class="monster-hp-fill" style="width:${pct(mon.hp, mon.maxHp)}%"></div></div>
        <div id="monster-hp-text-${mon.id}" style="font-size:10px;color:var(--ink-dim);">${Math.floor(mon.hp)}/${mon.maxHp}</div>
      </div>`;
  });
  html += '</div>';
  wrap.innerHTML = html;
  lastMonsterDefId = state.monsters.map(m => m.id).join(',');
}

// 只更新 HP 條
function updateMonsterHp() {
  if (!state.monsters || state.monsters.length === 0) return;
  state.monsters.forEach(mon => {
    const hpBar = document.getElementById(`monster-hp-bar-${mon.id}`);
    const hpText = document.getElementById(`monster-hp-text-${mon.id}`);
    if (hpBar) hpBar.style.width = pct(mon.hp, mon.maxHp) + '%';
    if (hpText) hpText.textContent = `${Math.max(0, mon.hp)}/${mon.maxHp}`;
  });
}

/* ---------------- 傷害飄字系統 ---------------- */
let damageFloatId = 0;
let pendingFloatTargetId = null; // AoE 設定此值讓飄字定位到指定怪物 instanceId
let _floatDelayMs = 0; // 累積延遲，讓連續飄字錯開

// 在玩家頭上顯示飄字
function showPlayerFloat(dmg, type) {
  const el = document.createElement('div');
  el.className = 'damage-float';
  if (type === 'crit') el.classList.add('crit');
  else if (type === 'heal') el.classList.add('heal');
  else if (type === 'miss') el.classList.add('miss');
  else if (type === 'element-good') el.classList.add('element-good');
  else if (type === 'element-bad') el.classList.add('element-bad');
  el.textContent = dmg;

  const playerEl = document.getElementById('player-sprite');
  if (playerEl) {
    const rect = playerEl.getBoundingClientRect();
    el.style.position = 'fixed';
    el.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 20) + 'px';
    el.style.top = (rect.top - 10) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }
}

function showDamageFloat(dmg, type, element) {
  // 找到目標怪物 DOM 元素來取得座標
  let targetEl = null;
  if (pendingFloatTargetId != null) {
    targetEl = document.getElementById('monster-slot-' + pendingFloatTargetId);
  }
  if (!targetEl) targetEl = document.querySelector('.monster-slot.target');

  const el = document.createElement('div');
  el.className = 'damage-float';
  if (type === 'crit') el.classList.add('crit');
  else if (type === 'heal') el.classList.add('heal');
  else if (type === 'miss') el.classList.add('miss');
  else if (type === 'element-good') el.classList.add('element-good');
  else if (type === 'element-bad') el.classList.add('element-bad');
  else if (type === 'element-immune') el.classList.add('element-immune');

  el.textContent = dmg;

  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    // 每次呼叫自動遞增偏移，讓連續傷害數字錯開
    const offsetX = (_floatDelayMs % 5) * 18 - 36 + (Math.random() - 0.5) * 10;
    const offsetY = -(_floatDelayMs % 5) * 14;
    el.style.position = 'fixed';
    el.style.left = (rect.left + rect.width / 2 + offsetX) + 'px';
    el.style.top = (rect.top - 10 + offsetY) + 'px';
    el.style.animationDelay = (_floatDelayMs * 30) + 'ms';
    document.body.appendChild(el);
    _floatDelayMs++;
    // 快速重置：200ms 後歸零（一次攻擊間隔）
    clearTimeout(el._resetTimer);
    el._resetTimer = setTimeout(() => { _floatDelayMs = 0; }, 200);
  } else {
    // fallback：戰鬥區域中間
    el.style.position = 'absolute';
    el.style.left = '50%';
    el.style.top = '30%';
    const container = document.getElementById('damage-container');
    if (container) container.appendChild(el);
    else return;
  }
  setTimeout(() => el.remove(), 1500);
}

function triggerMonsterHit(isCrit) {
  const icon = document.getElementById('monster-icon');
  if (!icon) return;
  icon.classList.remove('monster-hit', 'crit-flash');
  void icon.offsetWidth;
  icon.classList.add('monster-hit');
  if (isCrit) icon.classList.add('crit-flash');
}

// 暴擊特效：Canvas 閃光 + 數字放大
function showCritEffect() {
  // 找怪物位置
  const monsterSlot = document.querySelector('.monster-slot.target');
  let cx = window.innerWidth * 0.5, cy = window.innerHeight * 0.4;
  if (monsterSlot) {
    const rect = monsterSlot.getBoundingClientRect();
    cx = rect.left + rect.width / 2;
    cy = rect.top + rect.height / 2;
  }

  // 建立 Canvas（每次都新建，避免殘留）
  const cvs = document.createElement('canvas');
  cvs.width = window.innerWidth;
  cvs.height = window.innerHeight;
  cvs.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:9997;';
  document.body.appendChild(cvs);
  const ctx = cvs.getContext('2d');

  let frame = 0;
  const maxFrames = 18;

  function drawFrame() {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    const t = frame / maxFrames;
    const alpha = 1 - t;

    // 放射線閃光
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 / 12) * i + t * 0.8;
      const len = 100 * (1 - t * 0.3) * (0.6 + Math.random() * 0.4);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
      ctx.strokeStyle = `rgba(255, ${Math.floor(80 + Math.random() * 120)}, 0, ${alpha})`;
      ctx.lineWidth = 3 + Math.random() * 3;
      ctx.stroke();
    }

    // 中心閃光圈
    const glowR = 80 * (1 - t * 0.5);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
    grad.addColorStop(0, `rgba(255, 255, 220, ${alpha})`);
    grad.addColorStop(0.4, `rgba(255, 120, 50, ${alpha * 0.6})`);
    grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // 飛散粒子
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 / 10) * i + t * 3;
      const d = 20 + t * 100;
      const s = 4 * (1 - t);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, s, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 220, 80, ${alpha})`;
      ctx.fill();
    }
    ctx.restore();

    frame++;
    if (frame <= maxFrames) {
      requestAnimationFrame(drawFrame);
    } else {
      cvs.remove();
    }
  }

  requestAnimationFrame(drawFrame);

  // 全螢幕紅色閃光（CSS）
  const overlay = document.createElement('div');
  overlay.className = 'crit-flash-overlay';
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 300);
}

function triggerMonsterDie() {
  const card = document.getElementById('monster-card');
  if (!card) return;
  card.classList.add('monster-dying');
}

/* ---------------- 戰鬥日誌增強 ---------------- */
// 傷害飄字邏輯已移至 engine.js 的 logMsg 函式中處理

function renderLog() {
  const el = document.getElementById('combat-log');
  if (!el) return;
  el.innerHTML = combatLogBuf.slice(-30).map(m => `<div class="log-line">${m}</div>`).join('');
  el.scrollTop = el.scrollHeight;
}

/* ---------------- 地圖分頁 ---------------- */
let selectedRegionId = null; // 目前下拉選單一選中的地區
let selectedKingdomId = null; // 目前選中的王國

function renderMapTab() {
  const el = document.getElementById('tab-map');
  if (!selectedRegionId) {
    const cur = regionOf(state.mapId);
    selectedRegionId = cur ? cur.id : REGIONS[0].id;
  }
  // 自動選取所屬王國
  if (!selectedKingdomId) {
    const k = KINGDOMS.find(k => k.regions.includes(selectedRegionId));
    selectedKingdomId = k ? k.id : KINGDOMS[0].id;
  }
  const kingdom = KINGDOMS.find(k => k.id === selectedKingdomId) || KINGDOMS[0];
  // 篩選屬於該王國的區域
  const filteredRegions = REGIONS.filter(r => kingdom.regions.includes(r.id));
  const region = filteredRegions.find(r => r.id === selectedRegionId) || filteredRegions[0] || REGIONS[0];

  const kingdomOptions = KINGDOMS.map(k =>
    `<option value="${k.id}" ${k.id === kingdom.id ? 'selected' : ''}>${k.icon} ${k.name}</option>`
  ).join('');

  const regionOptions = filteredRegions.map(r =>
    `<option value="${r.id}" ${r.id === region.id ? 'selected' : ''}>${r.icon} ${r.name}</option>`
  ).join('');

  const mapOptions = region.maps.map(mapId => {
    const m = MAPS.find(x => x.id === mapId);
    if (!m) return '';
    const isCity = m.monsters.length === 0;
    return `<option value="${m.id}" ${state.mapId === m.id ? 'selected' : ''}>${m.name}${isCity ? '（安全區）' : ''}</option>`;
  }).join('');

  const currentMapObj = MAPS.find(x => x.id === state.mapId) || MAPS.find(x => x.id === region.maps[0]);
  if (!currentMapObj) { el.innerHTML = '<div class="empty-hint">地圖資料錯誤</div>'; return; }
  const isCity = currentMapObj.monsters.length === 0;
  const monsterPreview = isCity
    ? '此地為安全城鎮，沒有怪物出沒。'
    : [...currentMapObj.monsters].sort((a, b) => b.weight - a.weight).map(o => {
        const m = MONSTERS[o.id];
        if (!m) return `[${o.id}]`;
        const elemIcon = ELEMENT_ICONS[m.element] || '⚪';
        return `${m.icon} ${m.name} ${elemIcon}`;
      }).join('　');

  el.innerHTML = `
    <h3 class="panel-title">選擇地區</h3>
    <div class="map-select-group">
      <label class="map-select-label">王國/大陸</label>
      <select class="map-select" onchange="onKingdomSelectChange(this.value)">${kingdomOptions}</select>
    </div>
    <div class="map-select-group">
      <label class="map-select-label">地區</label>
      <select class="map-select" onchange="onRegionSelectChange(this.value)">${regionOptions}</select>
    </div>
    <div class="map-select-group">
      <label class="map-select-label">地點</label>
      <select class="map-select" onchange="selectMap(this.value)">${mapOptions}</select>
    </div>
    <div class="region-subtitle-detail">${region.subtitle}</div>
    <div class="map-preview-box">
      <div class="map-preview-title">${isCity ? '🏠 安全區' : '⚔️ 遇怪列表'}</div>
      <div class="map-preview-body">${monsterPreview}</div>
      ${!isCity ? '<div class="map-preview-hint">怪物強度不設限，越級挑戰有風險，也可能有意外的收穫——探索本身就是樂趣！</div>' : ''}
    </div>
    ${!isCity && MVP_MAP_DATA[currentMapObj.id] ? `
    <label style="display:flex;align-items:center;gap:8px;margin:10px 0;cursor:pointer;font-size:14px;">
      <input type="checkbox" ${state.mvpMode ? 'checked' : ''} onchange="toggleMvpMode(this.checked)" style="width:18px;height:18px;cursor:pointer;">
      <span>🎯 MVP 模式（20% 機率出 Boss）</span>
    </label>
    <div style="font-size:11px;color:var(--ink-dim);margin-top:-6px;margin-bottom:8px;">此地圖可遭遇 MVP：${MVP_MAP_DATA[currentMapObj.id].map(id => { const m = MONSTERS[id]; return m ? m.icon + m.name : id; }).join('、')}</div>
    ` : ''}
    ${isCity ? `
    <div class="town-npcs">
      <h4 class="town-npc-title">🏪 城鎮 NPC</h4>
      <div class="town-npc-list">
        ${/* 直接由 NPC_SHOPS 產生，之後新增商店不用再回來改這裡 */
          Object.keys(NPC_SHOPS).map(id => {
            const shop = NPC_SHOPS[id];
            return `<div class="town-npc-card" onclick="openNpcShop('${id}');">
              <div class="town-npc-icon">${shop.icon}</div>
              <div class="town-npc-name">${shop.name}</div>
              <div class="town-npc-hint">${shop.getItems().length} 項商品</div>
            </div>`;
          }).join('')}
      </div>
    </div>
    ` : ''}`;
}

function onKingdomSelectChange(kingdomId) {
  selectedKingdomId = kingdomId;
  const kingdom = KINGDOMS.find(k => k.id === kingdomId);
  if (kingdom && kingdom.regions.length > 0) {
    selectedRegionId = kingdom.regions[0];
    const region = REGIONS.find(r => r.id === selectedRegionId);
    if (region) selectMap(region.maps[0]);
  }
  renderMapTab();
}

function onRegionSelectChange(regionId) {
  selectedRegionId = regionId;
  // 自動更新所屬王國
  const k = KINGDOMS.find(k => k.regions.includes(regionId));
  if (k) selectedKingdomId = k.id;
  const region = REGIONS.find(r => r.id === regionId);
  selectMap(region.maps[0]); // 切換地區時，預設進入該地區的第一張地圖（城鎮）
}

/* ---------------- 自動戰鬥分頁 ---------------- */
function renderAutoBattleTab() {
  const el = document.getElementById('tab-autobattle');
  if (!el) return;

  const job = currentJob();
  const config = state.autoSkillConfig || { skillId: null, mode: 'once', spThreshold: 30 };

  // 收集所有已學的主動攻擊技能（跨職業）
  const attackSkills = [];
  const allJobs = getAllLearnedJobs();
  for (const jobId of allJobs) {
    const jobDef = JOB_TREE[jobId];
    if (!jobDef) continue;
    jobDef.skills.forEach(sk => {
      const lv = state.learnedSkills[sk.id];
      if (lv && ['damage', 'magic', 'dot', 'damage_multihit', 'damage_multi', 'damage_aoe', 'magic_aoe', 'poison_proc'].includes(sk.type) && !sk.isQuest) {
        attackSkills.push({ ...sk, lv, jobName: jobDef.name });
      }
    });
  }

  // 收集所有已學的輔助技能（buff/debuff/heal）
  const supportSkills = [];
  for (const jobId of allJobs) {
    const jobDef = JOB_TREE[jobId];
    if (!jobDef) continue;
    jobDef.skills.forEach(sk => {
      const lv = state.learnedSkills[sk.id];
      if (lv && ['buff_atk', 'buff_def', 'buff_aspd', 'buff_flee', 'buff_gold', 'buff_crit', 'buff_poison', 'buff_statpct', 'buff_maxroll', 'buff_blessing', 'buff_shield', 'buff_sprate', 'buff_lukflat', 'buff_holyweapon', 'debuff_def', 'debuff', 'heal', 'heal_over_time', 'field_heal', 'field_aoe_magic', 'stun_field', 'multi_dot_stun'].includes(sk.type) && !sk.isQuest) {
        supportSkills.push({ ...sk, lv, jobName: jobDef.name });
      }
    });
  }

  // 藥水設定 - 兩個下拉選單
  const hpThreshold = state.autoPotion.hpThreshold || 50;
  const currentPrimary = state.autoPotion.primary || '';
  const currentFallback = state.autoPotion.fallback || 'red_potion';

  // 下拉1：背包回復道具（消耗品/材料中可回復HP/SP的）
  const invHealItems = state.inventory.filter(row => {
    if (row.instanceId) return false;
    const d = ITEMS[row.item];
    if (!d) return false;
    if (d.heal || d.restoreSp) return true;
    if (d.type !== 'consumable' && d.type !== 'material') return false;
    const desc = d.desc || '';
    const hasHealText = (desc.includes('恢復') || desc.includes('恢复')) && (desc.includes('HP') || desc.includes('SP'));
    return hasHealText;
  });
  const invOptions = invHealItems.map(row => {
    const def = ITEMS[row.item];
    let effect = '';
    if (def.heal) effect = `恢復${def.heal}HP`;
    else if (def.restoreSp) effect = `恢復${def.restoreSp}SP`;
    else effect = '回復道具';
    return `<option value="${row.item}" ${currentPrimary === row.item ? 'selected' : ''}>${def.name} (${effect}) x${row.qty}</option>`;
  }).join('');

  // 下拉2：4種固定藥水
  const potionOptions = POTION_TIERS.map(tier => {
    const def = ITEMS[tier];
    const effect = def.heal ? `恢復${def.heal}HP` : `恢復${def.restoreSp}SP`;
    const qty = getItemQty(tier);
    return `<option value="${tier}" ${currentFallback === tier ? 'selected' : ''}>${def.name} (${effect}) 持有${qty}</option>`;
  }).join('');

  // ---- SP 藥水設定（結構比照 HP：第一格背包任選、第二格藍水）----
  const spCfg = state.autoSpPotion || { enabled: false, primary: '', fallback: 'blue_potion', spThreshold: 30 };
  const spThreshold = spCfg.spThreshold || 30;
  const invSpItems = state.inventory.filter(row => {
    if (row.instanceId) return false;
    const d = ITEMS[row.item];
    return d && d.restoreSp > 0;
  });
  const invSpOptions = invSpItems.map(row => {
    const def = ITEMS[row.item];
    return `<option value="${row.item}" ${spCfg.primary === row.item ? 'selected' : ''}>${def.name} (恢復${def.restoreSp}SP) x${row.qty}</option>`;
  }).join('');
  const aspdCfg = state.autoAspdPotion || { enabled: false, items: [] };
  const spFallbackDef = ITEMS['blue_potion'];
  const spFallbackOption = spFallbackDef
    ? `<option value="blue_potion" selected>${spFallbackDef.name} (恢復${spFallbackDef.restoreSp}SP) 持有${getItemQty('blue_potion')}</option>`
    : '';

  // 攻擊技能下拉選項
  const attackOptions = attackSkills.map(sk =>
    `<option value="${sk.id}" ${config.skillId === sk.id ? 'selected' : ''}>[${sk.jobName}] ${sk.name} Lv${sk.lv}</option>`
  ).join('');
  const attackOptions2 = attackSkills.map(sk =>
    `<option value="${sk.id}" ${config.skillId2 === sk.id ? 'selected' : ''}>[${sk.jobName}] ${sk.name} Lv${sk.lv}</option>`
  ).join('');

  // 輔助技能勾選
  const supportRows = supportSkills.map(sk => {
    const enabled = state.autoSupportSkills && state.autoSupportSkills[sk.id];
    const spCost = Array.isArray(sk.spCost) ? sk.spCost[sk.lv - 1] : sk.spCost;
    const cd = Array.isArray(sk.cooldown) ? sk.cooldown[sk.lv - 1] : sk.cooldown;
    let healCfgHtml = '';
    if (sk.type === 'heal') {
      const healCfg = (state.autoHealConfig && state.autoHealConfig[sk.id]) || { hpThreshold: 70, spThreshold: 0 };
      healCfgHtml = `<span class="support-skill-heal-cfg">
        HP% ≤ <input type="number" min="1" max="99" value="${healCfg.hpThreshold}" style="width:3.5em" onchange="setAutoHealHpThreshold('${sk.id}', this.value)">才施放
        ・ SP% ≥ <input type="number" min="0" max="100" value="${healCfg.spThreshold}" style="width:3.5em" onchange="setAutoHealSpThreshold('${sk.id}', this.value)">才施放
      </span>`;
    }
    return `<div class="support-skill-row ${enabled ? 'enabled' : ''}">
      <label class="support-skill-toggle">
        <input type="checkbox" ${enabled ? 'checked' : ''} onchange="toggleAutoSupportSkill('${sk.id}', this.checked);">
        <span class="support-skill-info">
          <span class="support-skill-name">${sk.name} Lv${sk.lv}</span>
          <span class="support-skill-desc">${sk.desc}</span>
          <span class="support-skill-cost">SP ${spCost} ・ 冷卻 ${cd}s</span>
          ${healCfgHtml}
        </span>
      </label>
    </div>`;
  }).join('');

  el.innerHTML = `
    <h3 class="panel-title">⚔️ 自動戰鬥設定</h3>

    <!-- 狀態概覽 -->
    <div class="ab-status">
      <div class="ab-hp">
        <div class="ab-bar-label">HP ${Math.floor(state.hp)}/${state.maxHp}</div>
        <div class="bar-track"><div class="bar-fill hp-fill" style="width:${pct(state.hp, state.maxHp)}%"></div></div>
      </div>
      <div class="ab-sp">
        <div class="ab-bar-label">SP ${Math.floor(state.sp)}/${state.maxSp}</div>
        <div class="bar-track"><div class="bar-fill sp-fill" style="width:${pct(state.sp, state.maxSp)}%"></div></div>
      </div>
      <div class="ab-info-row">
        <span>ATK ${state.atk}</span>
        <span>MATK ${state.matkMin}~${state.matkMax}</span>
        <span>DEF ${state.def}</span>
        <span>ASPD ${state.aspd}</span>
      </div>
    </div>

    <!-- 遇怪模式 -->
    <div class="ab-section">
      <h4 class="ab-section-title">⚔️ 遇怪模式</h4>
      <div class="ab-mode-btns">
        <button class="btn-small ${(state.encounterMode || 'melee') === 'melee' ? 'active' : ''}" onclick="setEncounterMode('melee')">近戰模式（最多5隻）</button>
        <button class="btn-small ${state.encounterMode === 'ranged' ? 'active' : ''}" onclick="setEncounterMode('ranged')">遠攻模式（1隻）</button>
      </div>
      <div class="ab-info-text">
        ${state.encounterMode === 'ranged' ? '遠攻：怪物死後才會再生下一隻。' : '近戰：0隻時0.5秒一隻，1隻以上時3秒一隻，最多5隻。'}
      </div>
    </div>

    <!-- 攻擊技能設定 -->
    <div class="ab-section">
      <h4 class="ab-section-title">🗡️ 攻擊技能</h4>
      <label class="auto-toggle"><input type="checkbox" ${state.autoSkill ? 'checked' : ''} onchange="state.autoSkill=this.checked;saveGame();"> 自動施放技能</label>
      <div class="ab-attack-config">
        <!-- 第一招 -->
        <div class="ab-skill-slot">
          <div class="ab-skill-slot-label">第一招</div>
          <div class="ab-config-row">
            <label class="ab-config-label">選擇技能</label>
            <select class="ab-select" onchange="setAutoSkillConfig('skillId', this.value)">
              <option value="">不使用技能</option>
              ${attackOptions}
            </select>
          </div>
          ${config.skillId ? `
          <div class="ab-config-row">
            <label class="ab-config-label">SP 保留 %</label>
            <input type="range" class="ab-slider" min="5" max="90" value="${config.spThreshold}"
              oninput="setAutoSkillConfig('spThreshold', parseInt(this.value));document.getElementById('sp-threshold-val').textContent=this.value+'%'">
            <span id="sp-threshold-val" class="ab-slider-val">${config.spThreshold}%</span>
          </div>
          ` : ''}
        </div>
        <!-- 第二招 -->
        <div class="ab-skill-slot">
          <div class="ab-skill-slot-label">第二招（範圍技推薦）</div>
          <div class="ab-config-row">
            <label class="ab-config-label">選擇技能</label>
            <select class="ab-select" onchange="setAutoSkillConfig('skillId2', this.value)">
              <option value="">不使用技能</option>
              ${attackOptions2}
            </select>
          </div>
          <div class="ab-config-row">
            <label class="ab-config-label">SP 保留 %</label>
            <input type="range" class="ab-slider" min="5" max="90" value="${config.spThreshold2}"
              oninput="setAutoSkillConfig('spThreshold2', parseInt(this.value));document.getElementById('sp-threshold2-val').textContent=this.value+'%'">
            <span id="sp-threshold2-val" class="ab-slider-val">${config.spThreshold2}%</span>
          </div>
          <div class="ab-config-row">
            <label class="ab-config-label">怪物數量門檻</label>
            <input type="range" class="ab-slider" min="1" max="5" value="${config.monsterCount2}"
              oninput="setAutoSkillConfig('monsterCount2', parseInt(this.value));document.getElementById('monster-count2-val').textContent=this.value+'隻'">
            <span id="monster-count2-val" class="ab-slider-val">${config.monsterCount2}隻</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 能量外套 -->
    ${state.hasEnergyCoatUnlock ? `
    <div class="ab-section">
      <h4 class="ab-section-title">🛡️ 能量外套</h4>
      <label class="auto-toggle"><input type="checkbox" ${state.energyCoatEnabled ? 'checked' : ''} onchange="setEnergyCoatEnabled(this.checked);"> 啟動（減傷${state.energyCoatDmgReductionPct}%，每次受擊消耗${state.energyCoatSpCostPct}%最大SP）</label>
      <div class="ab-config-row">
        <label class="ab-config-label">SP 低於</label>
        <input type="range" class="ab-slider" min="0" max="90" value="${state.energyCoatSpFloorPct}"
          oninput="setEnergyCoatSpFloor(this.value);document.getElementById('energycoat-floor-val').textContent=this.value+'%'">
        <span id="energycoat-floor-val" class="ab-slider-val">${state.energyCoatSpFloorPct}%</span>
        <span class="ab-config-hint">時暫停生效</span>
      </div>
    </div>
    ` : ''}

    <!-- 輔助技能設定 -->
    ${supportSkills.length > 0 ? `
    <div class="ab-section">
      <h4 class="ab-section-title">💚 輔助技能</h4>
      <div class="support-skill-list">${supportRows}</div>
    </div>
    ` : ''}

    <!-- 藥水設定 -->
    <div class="ab-section">
      <h4 class="ab-section-title">🧪 藥水設定</h4>
      <div class="potion-toggles">
        <label class="auto-toggle"><input type="checkbox" ${state.autoPotion.enabled ? 'checked' : ''} onchange="setAutoPotionEnabled(this.checked);"> 自動使用回復道具</label>
        <label class="auto-toggle"><input type="checkbox" ${state.autoBuyPotion ? 'checked' : ''} onchange="setAutoBuyPotion(this.checked);"> 藥水不足時自動購買${AUTO_BUY_QTY}瓶</label>
      </div>
      <div class="ab-config-row">
        <label class="ab-config-label">HP 低於</label>
        <input type="range" class="ab-slider" min="10" max="90" value="${hpThreshold}"
          oninput="setAutoPotionThreshold(this.value);document.getElementById('hp-threshold-val').textContent=this.value+'%'">
        <span id="hp-threshold-val" class="ab-slider-val">${hpThreshold}%</span>
        <span class="ab-config-hint">時使用</span>
      </div>
      <div class="ab-config-row">
        <label class="ab-config-label">首先使用</label>
        <select class="ab-select" onchange="setAutoPotionTier(this.value);renderAutoBattleTab();">
          <option value="">不使用背包道具</option>
          ${invOptions}
        </select>
      </div>
      <div class="ab-config-row">
        <label class="ab-config-label">用完後使用</label>
        <select class="ab-select" onchange="setAutoPotionFallback(this.value);renderAutoBattleTab();">
          ${potionOptions}
        </select>
      </div>
    </div>

    <div class="ab-section">
      <h4 class="ab-section-title">💧 SP 藥水設定</h4>
      <div class="potion-toggles">
        <label class="auto-toggle"><input type="checkbox" ${spCfg.enabled ? 'checked' : ''} onchange="setAutoSpPotionEnabled(this.checked);"> 自動使用回復SP道具</label>
        <label class="auto-toggle"><input type="checkbox" ${state.autoBuySpPotion ? 'checked' : ''} onchange="setAutoBuySpPotion(this.checked);"> 藍水不足時自動購買${AUTO_BUY_SP_QTY}瓶</label>
      </div>
      <div class="ab-config-row">
        <label class="ab-config-label">SP 低於</label>
        <input type="range" class="ab-slider" min="10" max="90" value="${spThreshold}"
          oninput="setAutoSpPotionThreshold(this.value);document.getElementById('sp-threshold-val').textContent=this.value+'%'">
        <span id="sp-threshold-val" class="ab-slider-val">${spThreshold}%</span>
        <span class="ab-config-hint">時使用</span>
      </div>
      <div class="ab-config-row">
        <label class="ab-config-label">首先使用</label>
        <select class="ab-select" onchange="setAutoSpPotionPrimary(this.value);renderAutoBattleTab();">
          <option value="">不使用背包道具</option>
          ${invSpOptions}
        </select>
      </div>
      <div class="ab-config-row">
        <label class="ab-config-label">用完後使用</label>
        <select class="ab-select" onchange="setAutoSpPotionFallback(this.value);renderAutoBattleTab();">
          ${spFallbackOption}
        </select>
      </div>
      <div class="ab-config-hint" style="margin-top:4px">商店只賣藍色藥水（${(ITEMS['blue_potion']||{}).buyPrice || 1000}z），其他回SP道具要打怪取得。</div>
    </div>

    <div class="ab-section">
      <h4 class="ab-section-title">⚡ 攻速藥水</h4>
      <div class="potion-toggles">
        <label class="auto-toggle"><input type="checkbox" ${aspdCfg.enabled ? 'checked' : ''} onchange="setAutoAspdPotionEnabled(this.checked);renderAutoBattleTab();"> 效果結束後自動補喝</label>
        <label class="auto-toggle"><input type="checkbox" ${state.autoBuyAspdPotion ? 'checked' : ''} onchange="setAutoBuyAspdPotion(this.checked);"> 沒了自動購買${AUTO_BUY_ASPD_QTY}瓶</label>
      </div>
      ${Object.keys(ASPD_POTIONS).map(id => {
        const d = ITEMS[id];
        if (!d) return '';
        const block = aspdPotionBlockReason(id);
        const checked = (aspdCfg.items || []).includes(id);
        return `<label class="auto-toggle aspd-potion-row${block ? ' disabled' : ''}" title="${block || '可使用'}">
          <input type="checkbox" ${checked ? 'checked' : ''} ${block ? 'disabled' : ''}
            onchange="toggleAutoAspdPotion('${id}',this.checked);renderAutoBattleTab();">
          ${d.name}　<span class="ab-config-hint">攻速+${d.aspdPct}%　持有 ${getItemQty(id)}</span>
          ${block ? `<span class="aspd-potion-block">${block}</span>` : ''}
        </label>`;
      }).join('')}
      <div class="ab-config-hint" style="margin-top:4px">效果較高的優先使用。限制依道具敘述：覺醒需 40 級且服事／祭司不可，菠色克需 85 級且限法師系／劍士系／商人系。</div>
    </div>
  `;
}

// 自動戰鬥配置設定
function setAutoSkillConfig(key, value) {
  if (!state.autoSkillConfig) state.autoSkillConfig = { skillId: null, mode: 'once', spThreshold: 30 };
  state.autoSkillConfig[key] = value;
  saveGame();
  renderAutoBattleTab();
}

// 輔助技能開關
function toggleAutoSupportSkill(skillId, enabled) {
  if (!state.autoSupportSkills) state.autoSupportSkills = {};
  state.autoSupportSkills[skillId] = enabled;
  // 隱匿（盜賊）與偽裝（刺客）效果重疊，自動施放只能二選一
  const fleeExclusivePair = ['hiding', 'cloaking'];
  if (enabled && fleeExclusivePair.includes(skillId)) {
    const other = fleeExclusivePair.find(id => id !== skillId);
    state.autoSupportSkills[other] = false;
  }
  saveGame();
  renderAutoBattleTab();
}

// 遇怪模式切換
function setEncounterMode(mode) {
  state.encounterMode = mode;
  state.maxMonsters = mode === 'melee' ? 5 : 1;
  state.lastSpawnTime = 0; // 重置生怪計時
  saveGame();
  renderAutoBattleTab();
}
/* ---------------- 技能分頁（可縮放、按職業分組） ---------------- */
let expandedJobs = {}; // { jobId: true/false }

function renderSkillsTab() {
  const el = document.getElementById('tab-skills');
  const allJobs = getAllLearnedJobs();

  // 預設展開目前職業
  allJobs.forEach(jid => {
    if (expandedJobs[jid] === undefined) {
      expandedJobs[jid] = (jid === state.jobId);
    }
  });

  if (!state.jobSkillPoints) state.jobSkillPoints = {};

  let html = `<div class="skills-header">
    <h3 class="panel-title">技能點：${state.skillPoints}</h3>
    <button class="btn-small btn-respec" onclick="if(confirm('確定要重置所有技能嗎？')){resetSkills();renderSkillsTab();renderSkillBar();}">重置技能</button>
  </div>`;

  for (const jobId of allJobs) {
    const job = JOB_TREE[jobId];
    if (!job || !job.skills.length) continue;

    const isCurrentJob = jobId === state.jobId;
    const isExpanded = expandedJobs[jobId];
    const jobPoints = state.jobSkillPoints[jobId] || 0;

    // 計算該職業已投入的技能點數
    let spentPoints = 0;
    job.skills.forEach(sk => {
      const lv = state.learnedSkills[sk.id] || 0;
      if (!sk.isQuest && lv > 0) spentPoints += lv;
    });

    html += `<div class="skill-job-section ${isCurrentJob ? 'current-job' : ''} ${isExpanded ? 'expanded' : 'collapsed'}">
      <div class="skill-job-header" onclick="toggleJobSection('${jobId}')">
        <span class="skill-job-toggle">${isExpanded ? '▼' : '▶'}</span>
        ${job.icon} ${job.name}
        <span class="skill-job-tier">Tier ${job.tier}</span>
        ${isCurrentJob ? '<span class="skill-job-current">目前</span>' : ''}
        <span class="skill-job-points">技能點 ${jobPoints}</span>
        <span class="skill-job-spent">已投入 ${spentPoints}</span>
      </div>`;

    if (isExpanded) {
      html += '<div class="skill-list">';
      job.skills.forEach(sk => {
        const lv = state.learnedSkills[sk.id] || 0;
        const isQuest = sk.isQuest;
        const isMaxed = lv >= sk.maxLv;
        const canLevelUp = !isQuest && !isMaxed && jobPoints > 0;

        const spCost = Array.isArray(sk.spCost) ? sk.spCost[Math.max(0, lv - 1)] || sk.spCost[0] : sk.spCost;
        const cd = Array.isArray(sk.cooldown) ? sk.cooldown[Math.max(0, lv - 1)] || sk.cooldown[0] : sk.cooldown;

        let statusTag = '';
        if (isQuest) {
          statusTag = '<span class="skill-tag quest">任務技能</span>';
        } else if (isMaxed) {
          statusTag = '<span class="skill-tag maxed">MAX</span>';
        } else if (lv > 0) {
          statusTag = `<span class="skill-tag">Lv${lv}/${sk.maxLv}</span>`;
        } else {
          statusTag = '<span class="skill-tag unlearned">未習得</span>';
        }

        let typeTag = '';
        if (sk.type === 'passive') typeTag = '<span class="skill-type passive">被動</span>';
        else if (['damage', 'magic'].includes(sk.type)) typeTag = '<span class="skill-type attack">攻擊</span>';
        else if (sk.type === 'heal' || sk.type === 'heal_over_time') typeTag = '<span class="skill-type heal">治療</span>';
        else if (sk.type === 'dot') typeTag = '<span class="skill-type dot">持續</span>';
        else if (sk.type.includes('buff')) typeTag = '<span class="skill-type buff">輔助</span>';
        else if (sk.type.includes('debuff')) typeTag = '<span class="skill-type debuff">減益</span>';

        const elemTag = sk.element && sk.element !== 'none' ? `<span class="skill-element elem-${sk.element}">${ELEMENT_ICONS[sk.element]}</span>` : '';

        html += `<div class="skill-row ${lv > 0 ? 'learned' : ''}">
          <div class="skill-info">
            <div class="skill-name">${sk.name} ${statusTag} ${typeTag} ${elemTag}</div>
            <div class="skill-desc">${sk.desc}</div>
            <div class="skill-cost">SP ${spCost} ・ 冷卻 ${cd}s</div>
          </div>
          ${isQuest ? '' : `<div class="skill-actions">
            <button class="btn-small btn-levelup" ${canLevelUp ? '' : 'disabled'}
              onclick="levelUpSkill('${sk.id}');renderSkillsTab();renderSkillBar();">+</button>
          </div>`}
        </div>`;
      });
      html += '</div>';
    }

    html += '</div>';
  }

  html += '</div>';
  el.innerHTML = html;
}

// 切換職業技能區塊的展開/收合
function toggleJobSection(jobId) {
  expandedJobs[jobId] = !expandedJobs[jobId];
  renderSkillsTab();
}

function renderSkillBar() {
  const bar = document.getElementById('skill-bar');
  const learned = [];
  const allJobs = getAllLearnedJobs();
  for (const jobId of allJobs) {
    const job = JOB_TREE[jobId];
    if (!job) continue;
    job.skills.forEach(s => {
      const lv = state.learnedSkills[s.id];
      if (lv && s.type !== 'passive' && !s.isQuest) {
        learned.push(s);
      }
    });
  }
  if (!learned.length) { bar.innerHTML = ''; return; }
  bar.innerHTML = learned.map(sk => {
    const lv = state.learnedSkills[sk.id];
    const ready = skillReady(sk.id);
    const spCost = Array.isArray(sk.spCost) ? sk.spCost[lv - 1] : sk.spCost;
    const enoughSp = state.sp >= spCost;
    const cdSec = state.cooldowns[sk.id] ? Math.ceil(state.cooldowns[sk.id] / 1000) : 0;
    return `<button class="skill-btn" title="${sk.desc}" ${(!ready || !enoughSp) ? 'disabled' : ''} onclick="castSkill('${sk.id}')">
      <span class="skill-btn-name">${sk.name}</span>
      <span class="skill-btn-lv">Lv${lv}</span>
      <span class="skill-btn-cost">${spCost} SP</span>
      ${cdSec > 0 ? `<span class="skill-btn-cd">${cdSec}</span>` : ''}
    </button>`;
  }).join('');
}

/* ---------------- 成就分頁 ---------------- */
let acvCat = 'all';
let acvHideDone = false;

function setAcvCat(c) { acvCat = c; renderAchievementsTab(); }
function setAcvHideDone(v) { acvHideDone = v; renderAchievementsTab(); }

// 由 checkAchievements() 解鎖時回呼
function onAchievementUnlocked(list) {
  const first = list[0];
  const extra = list.length > 1 ? `（+${list.length - 1}）` : '';
  showToast(`🏆 達成成就「${first.name}」${extra}`);
  const btn = document.querySelector('.tab-btn[data-tab="achievements"]');
  if (btn && activeTab !== 'achievements') btn.classList.add('has-new');
  if (activeTab === 'achievements') renderAchievementsTab();
  renderTopBar();
}

function renderAchievementsTab() {
  const el = document.getElementById('tab-achievements');
  if (!el || !state) return;

  const btn = document.querySelector('.tab-btn[data-tab="achievements"]');
  if (btn) btn.classList.remove('has-new');

  const sum = getAchievementSummary();
  const done = ensureAchievements().done;

  let list = ACHIEVEMENTS.filter(a => acvCat === 'all' || a.cat === acvCat);
  if (acvHideDone) list = list.filter(a => !done[a.id]);

  // 未完成的排前面，並且「差最少就達成」的排最前——玩家一打開就看到下一個目標
  const rows = list.map(a => {
    const cur = achievementProgress(a);
    return { a, cur, done: !!done[a.id], ratio: Math.min(1, cur / a.goal) };
  });
  rows.sort((x, y) => {
    if (x.done !== y.done) return x.done ? 1 : -1;
    if (x.done) return (done[y.a.id] || 0) - (done[x.a.id] || 0); // 已完成：最近解鎖的在前
    return y.ratio - x.ratio;
  });

  const catBtns = ['all'].concat(Object.keys(ACHIEVEMENT_CATEGORIES)).map(c => {
    const label = c === 'all' ? '全部' : `${ACHIEVEMENT_CATEGORIES[c].icon} ${ACHIEVEMENT_CATEGORIES[c].name}`;
    const n = c === 'all' ? `${sum.done}/${sum.total}` : `${sum.byCat[c].done}/${sum.byCat[c].total}`;
    return `<button class="btn-small ${acvCat === c ? 'active' : ''}" onclick="setAcvCat('${c}')">${label} <span class="acv-cat-n">${n}</span></button>`;
  }).join('');

  const pctDone = sum.total ? (sum.done / sum.total * 100) : 0;

  let html = `<h3 class="panel-title">🏆 成就</h3>
    <div class="acv-summary">
      <div class="acv-points"><span class="acv-points-num">${sum.points}</span><span class="acv-points-label">成就點數</span></div>
      <div class="acv-summary-bar">
        <div class="codex-prog-head"><span>總進度</span><span>${sum.done} / ${sum.total}　${pctDone.toFixed(1)}%</span></div>
        <div class="bar-track"><div class="bar-fill acv-prog-fill" style="width:${pctDone}%"></div></div>
      </div>
    </div>
    <div class="acv-cats">${catBtns}</div>
    <label class="auto-toggle acv-hide"><input type="checkbox" ${acvHideDone ? 'checked' : ''} onchange="setAcvHideDone(this.checked)"> 隱藏已完成</label>`;

  if (!rows.length) {
    html += '<div class="empty-hint">這個分類已經全部完成了！</div>';
  } else {
    html += '<div class="acv-list">';
    rows.forEach(r => {
      const a = r.a;
      const p = r.ratio * 100;
      const goalTxt = a.goal.toLocaleString();
      const curTxt = Math.min(r.cur, a.goal).toLocaleString();
      const rewardTxt = `${a.reward.gold ? `💰 ${a.reward.gold.toLocaleString()}　` : ''}🏆 ${a.reward.point}`;
      html += `<div class="acv-row ${r.done ? 'done' : ''} tier-${Math.min(a.tier || 1, 5)}">
        <div class="acv-icon">${a.icon}</div>
        <div class="acv-body">
          <div class="acv-name">${a.name}${r.done ? ' <span class="acv-check">✔</span>' : ''}</div>
          <div class="acv-desc">${a.desc}</div>
          <div class="acv-bar"><div class="acv-bar-fill" style="width:${p}%"></div></div>
        </div>
        <div class="acv-side">
          <div class="acv-count">${curTxt} / ${goalTxt}</div>
          <div class="acv-reward">${rewardTxt}</div>
        </div>
      </div>`;
    });
    html += '</div>';
  }

  el.innerHTML = html;
}

/* ---------------- 圖鑑分頁 ---------------- */
const CODEX_PAGE_SIZE = 60;
const RACE_LABELS = {
  plant: '植物', insect: '昆蟲', brute: '動物', formless: '無形', fish: '魚貝',
  undead: '不死', humanoid: '人型', demon: '惡魔', dragon: '龍族', angel: '天使'
};
const SIZE_LABELS = { small: '小型', medium: '中型', large: '大型' };
const ITEM_TYPE_LABELS = {
  weapon: '武器', armor: '防具', consumable: '消耗品', material: '素材', etc: '雜物', card: '卡片'
};
let codexView = 'mon';      // mon | card | item
let codexFilter = 'all';    // all | found | missing
let codexSearch = '';
let codexPage = 0;
let codexOpenId = null;

function setCodexView(v) { codexView = v; codexPage = 0; codexOpenId = null; renderCodexTab(); }
function setCodexFilter(f) { codexFilter = f; codexPage = 0; renderCodexTab(); }
function setCodexPage(p) { codexPage = p; renderCodexTab(); }
function onCodexSearch(v) {
  codexSearch = (v || '').trim().toLowerCase();
  codexPage = 0;
  renderCodexTab();
  // 重繪會讓輸入框失焦，手動把游標接回去，不然每打一個字就要重點一次
  const box = document.getElementById('codex-search');
  if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
}
function toggleCodexDetail(id) {
  codexOpenId = (codexOpenId === id) ? null : id;
  renderCodexTab();
}

function codexBar(label, found, total) {
  const p = total ? (found / total * 100) : 0;
  return `<div class="codex-prog">
    <div class="codex-prog-head"><span>${label}</span><span>${found} / ${total}　${p.toFixed(1)}%</span></div>
    <div class="bar-track"><div class="bar-fill codex-prog-fill" style="width:${p}%"></div></div>
  </div>`;
}

function renderCodexTab() {
  const el = document.getElementById('tab-codex');
  if (!el || !state) return;

  const pool = getCodexPool();
  const book = ensureCodex();
  const prog = getCodexProgress();

  // 依目前分頁組出清單，並套用搜尋/篩選
  let rows;
  if (codexView === 'mon') {
    rows = pool.monsters.map(id => ({ id, name: MONSTERS[id].name, found: !!book.seen[id] }));
  } else if (codexView === 'card') {
    rows = pool.cards.map(id => ({ id, name: (CARDS[id] || ITEMS[id]).name, found: !!book.item[id] }));
  } else {
    rows = pool.items.map(id => ({ id, name: ITEMS[id].name, found: !!book.item[id] }));
  }
  if (codexFilter === 'found') rows = rows.filter(r => r.found);
  else if (codexFilter === 'missing') rows = rows.filter(r => !r.found);
  // 未發現的東西不給搜尋，不然可以直接用搜尋框把還沒發現的內容查出來
  if (codexSearch) rows = rows.filter(r => r.found && (r.name || '').toLowerCase().includes(codexSearch));

  const totalPages = Math.max(1, Math.ceil(rows.length / CODEX_PAGE_SIZE));
  if (codexPage >= totalPages) codexPage = totalPages - 1;
  const pageRows = rows.slice(codexPage * CODEX_PAGE_SIZE, (codexPage + 1) * CODEX_PAGE_SIZE);

  let html = `<h3 class="panel-title">📕 圖鑑</h3>
    <div class="codex-progress">
      ${codexBar('👾 怪物', prog.monsters.found, prog.monsters.total)}
      ${codexBar('🃏 卡片', prog.cards.found, prog.cards.total)}
      ${codexBar('🎒 道具', prog.items.found, prog.items.total)}
    </div>
    <div class="codex-tabs">
      <button class="btn-small ${codexView === 'mon' ? 'active' : ''}" onclick="setCodexView('mon')">👾 怪物</button>
      <button class="btn-small ${codexView === 'card' ? 'active' : ''}" onclick="setCodexView('card')">🃏 卡片</button>
      <button class="btn-small ${codexView === 'item' ? 'active' : ''}" onclick="setCodexView('item')">🎒 道具</button>
    </div>
    <div class="codex-controls">
      <input id="codex-search" class="codex-search" type="text" placeholder="搜尋已發現的名稱…"
        value="${codexSearch.replace(/"/g, '&quot;')}" oninput="onCodexSearch(this.value)">
      <div class="codex-filters">
        <button class="btn-small ${codexFilter === 'all' ? 'active' : ''}" onclick="setCodexFilter('all')">全部</button>
        <button class="btn-small ${codexFilter === 'found' ? 'active' : ''}" onclick="setCodexFilter('found')">已發現</button>
        <button class="btn-small ${codexFilter === 'missing' ? 'active' : ''}" onclick="setCodexFilter('missing')">未發現</button>
      </div>
    </div>`;

  if (codexOpenId) html += renderCodexDetail(codexOpenId);

  if (!pageRows.length) {
    html += '<div class="empty-hint">沒有符合條件的項目。</div>';
  } else {
    html += '<div class="codex-grid">';
    pageRows.forEach(r => {
      html += (codexView === 'mon') ? codexMonCell(r, book) : codexItemCell(r, book);
    });
    html += '</div>';
  }

  if (totalPages > 1) {
    html += '<div class="codex-pager">';
    html += `<button class="btn-small" ${codexPage === 0 ? 'disabled' : ''} onclick="setCodexPage(${codexPage - 1})">‹ 上一頁</button>`;
    html += `<span class="codex-pager-info">${codexPage + 1} / ${totalPages}　（共 ${rows.length} 筆）</span>`;
    html += `<button class="btn-small" ${codexPage >= totalPages - 1 ? 'disabled' : ''} onclick="setCodexPage(${codexPage + 1})">下一頁 ›</button>`;
    html += '</div>';
  }

  el.innerHTML = html;
}

function codexMonCell(r, book) {
  const d = MONSTERS[r.id];
  const kills = book.mon[r.id] || 0;
  if (!r.found) {
    return `<div class="codex-cell locked" title="尚未發現">
      <img class="codex-icon silhouette" src="${monsterImgSrc(r.id)}" alt="" onerror="this.style.visibility='hidden'">
      <div class="codex-cell-name">？？？</div>
      <div class="codex-cell-sub">Lv.${d.level || '?'}</div>
    </div>`;
  }
  const elemIcon = ELEMENT_ICONS[d.element] || '⚪';
  return `<div class="codex-cell ${codexOpenId === r.id ? 'open' : ''}" onclick="toggleCodexDetail('${r.id}')">
    <img class="codex-icon" src="${monsterImgSrc(r.id)}" alt="${d.name}" onerror="this.onerror=null;this.src='${placeholderImgSrc('monster')}'">
    <div class="codex-cell-name">${d.name}</div>
    <div class="codex-cell-sub">Lv.${d.level || '?'} ${elemIcon}</div>
    <div class="codex-cell-count ${kills ? '' : 'zero'}">☠ ${kills}</div>
  </div>`;
}

function codexItemCell(r, book) {
  const d = ITEMS[r.id];
  const got = book.item[r.id] || 0;
  if (!r.found) {
    return `<div class="codex-cell locked" title="尚未取得">
      <div class="codex-icon silhouette-box">？</div>
      <div class="codex-cell-name">？？？</div>
      <div class="codex-cell-sub">未取得</div>
    </div>`;
  }
  const sub = CARDS[r.id] ? (CARDS[r.id].slot === 'weapon' ? '武器卡' : CARDS[r.id].slot === 'armor' ? '防具卡' : '卡片')
                          : (ITEM_TYPE_LABELS[d.type] || d.type || '');
  return `<div class="codex-cell ${codexOpenId === r.id ? 'open' : ''}" onclick="toggleCodexDetail('${r.id}')">
    <img class="codex-icon" src="${itemImgSrc(r.id)}" alt="${d.name}" onerror="this.onerror=null;this.src='${placeholderImgSrc(itemPlaceholderKind(d))}'">
    <div class="codex-cell-name">${d.name}</div>
    <div class="codex-cell-sub">${sub}</div>
    <div class="codex-cell-count">×${got}</div>
  </div>`;
}

function renderCodexDetail(id) {
  const book = ensureCodex();
  if (codexView === 'mon') {
    const d = MONSTERS[id];
    if (!d) return '';
    const kills = book.mon[id] || 0;
    const maps = getMonsterMaps(id);
    const drops = (d.drops || []).slice().sort((a, b) => b.chance - a.chance);
    const cd = (typeof MONSTER_CARD_DROPS !== 'undefined') ? MONSTER_CARD_DROPS[id] : null;
    const dropRows = drops.map(x => {
      const it = ITEMS[x.item];
      if (!it) return '';
      const got = book.item[x.item] || 0;
      return `<div class="codex-drop ${got ? 'got' : ''}">
        <img src="${itemImgSrc(x.item)}" onerror="this.onerror=null;this.src='${placeholderImgSrc(itemPlaceholderKind(it))}'">
        <span class="codex-drop-name">${it.name}</span>
        <span class="codex-drop-rate">${(x.chance * 100).toFixed(2)}%</span>
        <span class="codex-drop-got">${got ? '✔ ×' + got : '—'}</span>
      </div>`;
    }).join('');
    let cardRow = '';
    if (cd && (CARDS[cd.card] || ITEMS[cd.card])) {
      const cname = (CARDS[cd.card] || ITEMS[cd.card]).name;
      const got = book.item[cd.card] || 0;
      cardRow = `<div class="codex-drop card ${got ? 'got' : ''}">
        <img src="${itemImgSrc(cd.card)}" onerror="this.onerror=null;this.src='${placeholderImgSrc('item')}'">
        <span class="codex-drop-name">🃏 ${cname}</span>
        <span class="codex-drop-rate">${(cd.chance * 100).toFixed(2)}%</span>
        <span class="codex-drop-got">${got ? '✔ ×' + got : '—'}</span>
      </div>`;
    }
    return `<div class="codex-detail">
      <button class="codex-detail-close" onclick="toggleCodexDetail('${id}')">✕</button>
      <div class="codex-detail-head">
        <img class="codex-detail-icon" src="${monsterImgSrc(id)}" onerror="this.onerror=null;this.src='${placeholderImgSrc('monster')}'">
        <div>
          <div class="codex-detail-name">${d.name} <span class="codex-detail-lv">Lv.${d.level || '?'}</span></div>
          <div class="codex-detail-tags">
            <span>${ELEMENT_ICONS[d.element] || '⚪'} ${ELEMENT_NAMES[d.element] || d.element || '無'}</span>
            ${d.race ? `<span>${RACE_LABELS[d.race] || d.race}</span>` : ''}
            ${d.size ? `<span>${SIZE_LABELS[d.size] || d.size}</span>` : ''}
            ${d.isBoss ? '<span class="codex-mvp">MVP</span>' : ''}
          </div>
          <div class="codex-detail-kills">累計擊殺 <b>${kills}</b></div>
        </div>
      </div>
      <div class="codex-detail-stats">
        <span>HP ${d.hp}</span><span>ATK ${d.atk}</span><span>DEF ${d.def}</span>
        <span>EXP ${d.exp}</span><span>JOB ${d.jobExp}</span>
      </div>
      <div class="codex-detail-sec">出沒地圖</div>
      <div class="codex-maps">${maps.length ? maps.map(m => `<span>${m}</span>`).join('') : '<span class="dim">無（MVP 專屬）</span>'}</div>
      <div class="codex-detail-sec">掉落物</div>
      <div class="codex-drops">${cardRow}${dropRows || (cardRow ? '' : '<div class="dim">沒有掉落物</div>')}</div>
    </div>`;
  }

  // 道具 / 卡片
  const d = ITEMS[id];
  if (!d) return '';
  const card = CARDS[id];
  const got = book.item[id] || 0;
  const sources = getItemSources(id).slice(0, 12);
  const srcRows = sources.map(s => {
    const m = MONSTERS[s.mon];
    if (!m) return '';
    const seen = book.seen[s.mon];
    return `<div class="codex-src">
      <img src="${monsterImgSrc(s.mon)}" onerror="this.onerror=null;this.src='${placeholderImgSrc('monster')}'">
      <span class="codex-src-name">${seen ? m.name : '？？？'}</span>
      <span class="codex-src-lv">Lv.${m.level || '?'}</span>
      <span class="codex-drop-rate">${(s.chance * 100).toFixed(2)}%</span>
    </div>`;
  }).join('');
  const statBits = [];
  ['atk', 'matk', 'def', 'hp', 'sp', 'str', 'agi', 'vit', 'int', 'dex', 'luk', 'hit', 'flee', 'critRate'].forEach(k => {
    if (typeof d[k] === 'number' && d[k] !== 0) statBits.push(`${k.toUpperCase()} ${d[k] > 0 ? '+' : ''}${d[k]}`);
  });
  if (d.heal) statBits.push(`回復 ${d.heal} HP`);
  if (d.restoreSp) statBits.push(`回復 ${d.restoreSp} SP`);

  // 卡片插圖：只在詳情展開時才出現在 DOM，等同延遲載入，一次也只會抓一張
  const illustration = card
    ? `<div class="codex-card-art">
         <img src="${cardArtSrc(id)}" alt="${d.name}" loading="lazy"
              onerror="this.closest('.codex-card-art').style.display='none'">
       </div>`
    : '';
  // 解析不出來的原始效果文字：老實標成未實裝，不讓玩家誤以為有作用
  const unimpl = (card && card.unimplemented && card.unimplemented.length)
    ? `<div class="codex-detail-sec">尚未實裝的效果</div>
       <div class="codex-unimpl">${card.unimplemented.map(u => `<div>• ${u}</div>`).join('')}</div>`
    : '';

  // 卡片的機制效果直接從 bonus 欄位列出，才是引擎真正吃到的數值
  const bonusBits = [];
  if (card && card.bonus) {
    for (const [k, v] of Object.entries(card.bonus)) bonusBits.push(formatCardBonus(k, v));
  }

  return `<div class="codex-detail">
    <button class="codex-detail-close" onclick="toggleCodexDetail('${id}')">✕</button>
    <div class="codex-detail-head">
      <img class="codex-detail-icon" src="${itemImgSrc(id)}" onerror="this.onerror=null;this.src='${placeholderImgSrc(itemPlaceholderKind(d))}'">
      <div>
        <div class="codex-detail-name">${d.name}</div>
        <div class="codex-detail-tags">
          <span>${card ? '卡片' : (ITEM_TYPE_LABELS[d.type] || d.type || '')}</span>
          ${card ? `<span>${CARD_SLOT_LABELS[card.slot] || card.slot}</span>` : ''}
          ${d.sell ? `<span>售價 ${d.sell}</span>` : ''}
        </div>
        <div class="codex-detail-kills">累計取得 <b>${got}</b></div>
      </div>
    </div>
    ${illustration}
    ${bonusBits.length ? `<div class="codex-detail-stats">${bonusBits.map(s => `<span>${s}</span>`).join('')}</div>` : ''}
    ${!card && statBits.length ? `<div class="codex-detail-stats">${statBits.map(s => `<span>${s}</span>`).join('')}</div>` : ''}
    ${(card && card.desc) || d.desc ? `<div class="codex-detail-desc">${(card && card.desc) || d.desc}</div>` : ''}
    ${unimpl}
    <div class="codex-detail-sec">取得來源</div>
    <div class="codex-srcs">${srcRows || '<div class="dim">商店販售或任務取得</div>'}</div>
  </div>`;
}

const CARD_SLOT_LABELS = {
  weapon: '武器插槽', armor: '鎧甲插槽', shield: '盾牌插槽', headgear: '頭飾插槽',
  garment: '披風插槽', footgear: '鞋子插槽', accessory: '飾品插槽', any: '任意插槽'
};
const CARD_BONUS_LABELS = {
  str: 'STR', agi: 'AGI', vit: 'VIT', int: 'INT', dex: 'DEX', luk: 'LUK',
  atk: 'ATK', matk: 'MATK', def: 'DEF', hit: 'HIT', flee: 'FLEE',
  critRate: '暴擊率', perfectDodge: '完全迴避', hp: 'MaxHP', sp: 'MaxSP',
  hpPct: 'MaxHP', spPct: 'MaxSP', hpRegenPct: 'HP恢復力', spRegenPct: 'SP恢復力'
};
function cardArtSrc(cardId) {
  const it = ITEMS[cardId];
  return `images/cards/${it ? it.imgId : cardId}.jpg`;
}
function formatCardBonus(k, v) {
  const pctKeys = ['hpPct', 'spPct', 'hpRegenPct', 'spRegenPct'];
  if (CARD_BONUS_LABELS[k]) return `${CARD_BONUS_LABELS[k]} +${v}${pctKeys.includes(k) ? '%' : ''}`;
  if (k.startsWith('eleDmg_')) return `對${ELEMENT_NAMES[k.slice(7)] || k.slice(7)}屬性傷害 +${v}%`;
  if (k.startsWith('eleReduce_')) return `受${ELEMENT_NAMES[k.slice(10)] || k.slice(10)}屬性傷害 -${v}%`;
  if (k.startsWith('raceDmgReduce_')) return `受${RACE_LABELS[k.slice(14)] || k.slice(14)}傷害 -${v}%`;
  if (k.startsWith('raceDmg_')) return `對${RACE_LABELS[k.slice(8)] || k.slice(8)}傷害 +${v}%`;
  if (k.startsWith('sizeDmg_')) return `對${SIZE_LABELS[k.slice(8)] || k.slice(8)}傷害 +${v}%`;
  return `${k} +${v}`;
}

/* ---------------- NPC 商店分頁 ---------------- */
/* ---------------- 背包分頁 ----------------
   背包分成 武器／防具／卡片／道具 四類。卡片獨立成一類是因為它在資料上
   type 是 material，跟 900 多個素材混在一起會完全找不到。
   分類與子分類全部讀既有欄位（type / weaponType / armorType / CARDS.slot），不需要改資料。
------------------------------------------------- */
const INV_CATEGORIES = [
  { key: 'weapon', name: '武器', icon: '⚔️' },
  { key: 'armor',  name: '防具', icon: '🛡️' },
  { key: 'card',   name: '卡片', icon: '🃏' },
  { key: 'item',   name: '道具', icon: '🎒' }
];
const WEAPON_TYPE_LABELS = {
  dagger: '匕首', sword: '單手劍', tsword: '雙手劍', spear: '矛',
  mace: '鈍器', bow: '弓', knuckle: '拳刃'
};
const ARMOR_TYPE_LABELS = {
  headgear: '頭飾', leather: '鎧甲', shield: '盾牌',
  garment: '披風', footgear: '鞋子', accessory: '飾品'
};
const ITEM_SUBTYPE_LABELS = { consumable: '消耗品', material: '素材', ammo: '箭矢', etc: '雜物' };

let invCategory = 'weapon';
let invSub = 'all';
let invSearch = '';        // 四個分類共用同一個搜尋字串
let invSort = 'name';      // name | qty | value

function invCategoryOf(itemId) {
  if (CARDS[itemId]) return 'card';
  const d = ITEMS[itemId];
  if (!d) return 'item';
  if (d.type === 'weapon') return 'weapon';
  if (d.type === 'armor') return 'armor';
  return 'item';
}
// 子分類的值與顯示名稱
function invSubOf(itemId) {
  const cat = invCategoryOf(itemId);
  const d = ITEMS[itemId];
  if (cat === 'weapon') return d.weaponType || 'other';
  if (cat === 'armor') return d.armorType || 'other';
  if (cat === 'card') return (CARDS[itemId].slot || 'any');
  return d.type || 'etc';
}
function invSubLabel(cat, sub) {
  if (cat === 'weapon') return WEAPON_TYPE_LABELS[sub] || '其他';
  if (cat === 'armor') return ARMOR_TYPE_LABELS[sub] || '其他';
  if (cat === 'card') return CARD_SLOT_LABELS[sub] || sub;
  return ITEM_SUBTYPE_LABELS[sub] || sub;
}

/* 裝備比較：算出「換上這件」相對於「目前穿的那件」的數值差。
   只比裝備本身的欄位（含精煉加成），不含卡片——卡片是插在裝備上的，
   換裝時不會跟著走，把它算進去會讓比較結果誤導。 */
const COMPARE_STATS = [
  ['atk', 'ATK'], ['matk', 'MATK'], ['def', 'DEF'], ['mdef', 'MDEF'],
  ['hit', 'HIT'], ['flee', 'FLEE'], ['critRate', '暴擊'], ['perfectDodge', '完全迴避'],
  ['hp', 'MaxHP'], ['sp', 'MaxSP'],
  ['str', 'STR'], ['agi', 'AGI'], ['vit', 'VIT'], ['int', 'INT'], ['dex', 'DEX'], ['luk', 'LUK']
];
// 這件裝備會佔用哪個欄位（用來決定跟誰比）
/* 直接沿用引擎決定「這件會裝到哪一格」的同一套邏輯。
   自己寫一份簡化版會出錯：頭飾一律當成「頭上」，害頭中／頭下的裝備
   （例：金屬口罩是頭下）跑去跟頭上那件比；飾品也一律比飾品1。 */
function targetSlotOf(itemId) {
  const d = ITEMS[itemId];
  if (!d) return null;
  if (d.type !== 'weapon' && d.type !== 'armor') return null;
  return resolveEquipSlotFor(itemId);
}
// 精煉度現在是跟著「那一件」走，不能從 itemId 反查，必須由呼叫端傳進來
function statWithRefine(itemId, key, ref) {
  const d = ITEMS[itemId];
  if (!d) return 0;
  let v = typeof d[key] === 'number' ? d[key] : 0;
  // 精煉只加成武器 ATK 與防具 DEF，跟 equippedAtk()/equippedDef() 的算法一致
  ref = ref || 0;
  if (ref > 0 && key === 'atk' && d.type === 'weapon') v += getRefinementAtkBonus(ref, d.weaponLv || 1);
  if (ref > 0 && key === 'def' && d.type === 'armor') v += ref;
  return v;
}
function compareEquip(itemId, newRefine) {
  const slot = targetSlotOf(itemId);
  if (!slot) return null;
  const curId = getEquipBaseItemId(slot);
  const curRef = getRefinementLevel(slot);
  const rows = [];
  COMPARE_STATS.forEach(([key, label]) => {
    const nv = statWithRefine(itemId, key, newRefine);
    const cv = curId ? statWithRefine(curId, key, curRef) : 0;
    if (nv === 0 && cv === 0) return;
    rows.push({ label, cur: cv, next: nv, diff: nv - cv });
  });
  return { slot, curId, curRef, rows };
}
function renderCompareBadge(itemId, newRefine) {
  const cmp = compareEquip(itemId, newRefine);
  if (!cmp || !cmp.rows.length) return '';
  const parts = cmp.rows.filter(r => r.diff !== 0).map(r =>
    `<span class="cmp-${r.diff > 0 ? 'up' : 'down'}">${r.label} ${r.diff > 0 ? '▲+' : '▼'}${r.diff}</span>`
  );
  if (!parts.length) return `<div class="inv-compare same">與目前裝備數值相同</div>`;
  const curName = cmp.curId ? `${cmp.curRef > 0 ? '+' + cmp.curRef + ' ' : ''}${getItemDisplayName(cmp.curId)}` : '（空欄位）';
  return `<div class="inv-compare">對比 ${curName}：${parts.join('')}</div>`;
}

function setInvCategory(c) { invCategory = c; invSub = 'all'; renderInventoryTab(); }
function setInvSub(s) { invSub = s; renderInventoryTab(); }
function setInvSort(s) { invSort = s; renderInventoryTab(); }
function onInvSearch(v) {
  invSearch = (v || '').trim().toLowerCase();
  renderInventoryTab();
  // 重繪會讓輸入框失焦，把游標接回去，不然每打一個字都要重點一次
  const box = document.getElementById('inv-search');
  if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
}

/* 10 格裝備視窗的 HTML；背包分頁已不再顯示它，改由「裝備」分頁使用 */
/* ---------------- 裝備視窗外觀（可切換，仿 RO 換 UI 皮膚） ----------------
   grid    = 現在這套格狀排版
   ro      = RO 原版底圖（淺色，basic_equipwin_bg 原色）
   ro_dark = 同一張底圖 CSS 反轉成深色，配合本作深色主題
   底圖上的 10 個橢圓位置是直接從圖檔量出來的百分比座標。
------------------------------------------------- */
const EQUIP_SKINS = [
  { key: 'grid',    name: '格狀（預設）' },
  { key: 'ro',      name: 'RO 原版（淺色）' },
  { key: 'ro_dark', name: 'RO 原版（深色）' },
];
// 圖檔 280×130，左欄橢圓中心 x=6.1%、右欄 93.6%，五列 y=13.1/32.3/52.3/72.3/92.3%
const EQUIPWIN_POS = {
  head_top:    { x: 6.1,  y: 13.1, name: '頭上' },
  head_mid:    { x: 6.1,  y: 32.3, name: '頭中' },
  weapon:      { x: 6.1,  y: 52.3, name: '武器' },
  garment:     { x: 6.1,  y: 72.3, name: '披風' },
  accessory1:  { x: 6.1,  y: 92.3, name: '飾品1' },
  head_bottom: { x: 93.6, y: 13.1, name: '頭下' },
  armor:       { x: 93.6, y: 32.3, name: '身體' },
  shield:      { x: 93.6, y: 52.3, name: '左手' },
  footgear:    { x: 93.6, y: 72.3, name: '鞋子' },
  accessory2:  { x: 93.6, y: 92.3, name: '飾品2' },
  ammo:        { x: 50.4, y: 88.5, name: '箭矢' },   // 中間那顆大橢圓（原本是角色影子）
};
function getEquipSkin() { return (state && state.equipSkin) || 'grid'; }
function setEquipSkin(v) { state.equipSkin = v; saveGame(); renderEquipTab(); }

function buildEquipPanelHtml() {
  return getEquipSkin() === 'grid' ? buildEquipGridHtml() : buildEquipWinHtml();
}

// RO 底圖版：把 10 格（＋箭矢格）用百分比疊在底圖上
function buildEquipWinHtmlInner() {
  const weaponId = getEquipBaseItemId('weapon');
  const twoHanded = isTwoHanded(weaponId);
  const dark = getEquipSkin() === 'ro_dark';

  let html = `<div class="equipwin${dark ? ' equipwin--dark' : ''}">
    <img class="equipwin-bg" src="images/ui/equipwin_bg.png" alt="">`;

  Object.keys(EQUIPWIN_POS).forEach(key => {
    const p = EQUIPWIN_POS[key];
    // 左手被雙手武器佔住時，顯示同一把武器
    const shadow = (key === 'shield' && twoHanded);
    const srcSlot = shadow ? 'weapon' : key;
    const itemId = key === 'ammo' ? getEquippedAmmoId() : getEquipBaseItemId(srcSlot);
    const ref = key === 'ammo' ? 0 : getRefinementLevel(srcSlot);
    const cards = key === 'ammo' ? [] : getEquippedCards(srcSlot);
    const style = `left:${p.x}%;top:${p.y}%`;

    if (!itemId) {
      html += `<div class="equipwin-slot is-empty" style="${style}" title="${p.name}"></div>`;
      return;
    }
    const qtyTag = key === 'ammo' ? `<span class="equipwin-qty">${getItemQty(itemId)}</span>` : '';
    html += `<div class="equipwin-slot${shadow ? ' two-hand-shadow' : ''}" style="${style}"
      title="${p.name}"
      onmouseenter="showEquipTooltip(event,'${srcSlot}')" onmouseleave="hideEquipTooltip()"
      onclick="showSlotActions('${srcSlot}')">
      <img src="${itemImgSrc(itemId)}" onerror="this.onerror=null;this.src='${placeholderImgSrc(key === 'ammo' ? 'item' : 'armor')}'">
      ${ref > 0 ? `<span class="equipwin-refine">+${ref}</span>` : ''}
      ${cards.length ? `<span class="equipwin-card">🃏</span>` : ''}
      ${qtyTag}
    </div>`;
  });

  html += `</div>`;
  return html;
}
// 底圖版也要有箭矢的操作入口（中間那顆橢圓只是顯示，按鈕仍放在下方一列）
function buildEquipWinHtml() {
  return buildEquipWinHtmlInner() + buildAmmoRowHtml();
}

/* 底圖版的格子太小塞不下按鈕，改成點格子開這個動作面板（卸下／插卡／取出／精煉都在這） */
function showSlotActions(slotKey) {
  const el = document.getElementById('tab-equip');
  if (!el) return;
  const itemId = getEquipBaseItemId(slotKey);
  if (!itemId) return;
  const d = ITEMS[itemId];
  const ref = getRefinementLevel(slotKey);
  const cards = getEquippedCards(slotKey);
  const maxSlots = getEquipCardSlots(slotKey);

  let html = `<h3 class="panel-title">${ref > 0 ? `+${ref} ` : ''}${getItemDisplayName(itemId)}</h3>`;
  html += `<button class="btn-small" onclick="renderEquipTab()">← 返回裝備欄</button>`;
  html += `<div class="equip-pick-stats" style="margin:8px 0">${
    [d.atk ? `ATK ${statWithRefine(itemId,'atk',ref)}` : '', d.def ? `DEF ${statWithRefine(itemId,'def',ref)}` : '',
     d.element ? `${ELEMENT_ICONS[d.element]}${ELEMENT_NAMES[d.element]}` : '',
     maxSlots ? `插槽 ${cards.length}/${maxSlots}` : ''].filter(Boolean).join('　')}</div>`;
  if (cards.length) {
    html += `<div class="equip-pick-cards">🃏 ${cards.map(id => CARDS[id] ? CARDS[id].name : id).join('、')}</div>`;
  }
  html += `<div class="equip-pick-head">
    <button class="btn-small" onclick="unequipItem('${slotKey}');renderEquipTab();renderTopBar();">卸下</button>
    ${maxSlots > cards.length ? `<button class="btn-small ghost" onclick="showCardSelect('${slotKey}')">插卡</button>` : ''}
    ${cards.length ? `<button class="btn-small ghost danger" onclick="doRemoveCard('${slotKey}')">取出卡片</button>` : ''}
    <button class="btn-small ghost" onclick="doRefineSlot('${slotKey}')">精煉</button>
  </div>`;
  el.innerHTML = html;
}

function buildEquipGridHtml() {
  {
    const equipSlotDefs = [
      { key: 'head_top',   name: '頭上', icon: '👑' },
      { key: 'head_mid',   name: '頭中', icon: '🎭' },
      { key: 'head_bottom', name: '頭下', icon: '😷' },
      { key: 'weapon',     name: '武器', icon: '⚔️' },
      { key: 'armor',      name: '身體', icon: '🛡️' },
      { key: 'shield',     name: '左手', icon: '🔰' },
      { key: 'garment',    name: '披風', icon: '🧣' },
      { key: 'footgear',   name: '鞋子', icon: '👢' },
      { key: 'accessory1', name: '飾品1', icon: '💍' },
      { key: 'accessory2', name: '飾品2', icon: '📿' },
    ];

    // 檢查是否為雙手武器
    const weaponId = getEquipBaseItemId('weapon');
    const isWeaponTwoHanded = isTwoHanded(weaponId);

    let equipHtml = '<div class="ro-equip-grid">';
    equipSlotDefs.forEach(slot => {
      // 雙手武器佔住左手：左手格直接顯示同一把武器的圖示（淡一點表示是被佔用而非另一件裝備）
      if (slot.key === 'shield' && isWeaponTwoHanded) {
        const twoHandRef = getRefinementLevel('weapon');
        equipHtml += `<div class="ro-equip-slot has-item two-hand-shadow"
          onmouseenter="showEquipTooltip(event,'weapon')"
          onmouseleave="hideEquipTooltip()"
          onclick="onEquipSlotClick('weapon')"
        >
          <div class="slot-label">${slot.name}</div>
          ${twoHandRef > 0 ? `<div class="slot-refine">+${twoHandRef}</div>` : ''}
          <img class="slot-icon" src="${itemImgSrc(weaponId)}" onerror="this.onerror=null;this.src='${placeholderImgSrc('weapon')}'">
          <div class="slot-name">${getItemDisplayName(weaponId)}</div>
        </div>`;
        return;
      }

      const itemId = getEquipBaseItemId(slot.key);
      const item = itemId ? ITEMS[itemId] : null;
      const refLevel = getRefinementLevel(slot.key);
      const hasItem = !!item;
      const iconHtml = item
        ? `<img class="slot-icon" src="${itemImgSrc(itemId)}" onerror="this.onerror=null;this.src='${placeholderImgSrc('armor')}'">`
        : `<div class="slot-empty">${slot.icon}</div>`;
      const nameHtml = hasItem ? `<div class="slot-name">${getItemDisplayName(itemId)}</div>` : '';
      const refHtml = refLevel > 0 ? `<div class="slot-refine">+${refLevel}</div>` : '';

      // 卡片插槽：顯示 ●（已插）/ ○（空孔），並提供插卡／取出的入口
      let cardHtml = '';
      if (hasItem) {
        const maxSlots = getEquipCardSlots(slot.key);
        if (maxSlots > 0) {
          const inserted = getEquippedCards(slot.key);
          const pips = '●'.repeat(inserted.length) + '○'.repeat(Math.max(0, maxSlots - inserted.length));
          cardHtml = `<div class="slot-cards" title="卡片插槽 ${inserted.length}/${maxSlots}">
            <span class="slot-pips">${pips}</span>
            ${inserted.length < maxSlots ? `<button class="btn-pip" onclick="event.stopPropagation();showCardSelect('${slot.key}')">插卡</button>` : ''}
            ${inserted.length ? `<button class="btn-pip danger" onclick="event.stopPropagation();doRemoveCard('${slot.key}')">取出</button>` : ''}
          </div>`;
        }
      }

      // 雙手武器讓武器欄看起來更寬
      const spanStyle = (slot.key === 'weapon' && isWeaponTwoHanded) ? 'grid-column: span 2;' : '';

      equipHtml += `<div class="ro-equip-slot${hasItem ? ' has-item' : ''}"
        data-slot="${slot.key}"
        style="${spanStyle}"
        onmouseenter="showEquipTooltip(event,'${slot.key}')"
        onmouseleave="hideEquipTooltip()"
        onclick="onEquipSlotClick('${slot.key}')"
      >
        <div class="slot-label">${slot.name}${isWeaponTwoHanded && slot.key === 'weapon' ? ' (雙手)' : ''}</div>
        ${refHtml}
        ${iconHtml}
        ${nameHtml}
        ${cardHtml}
      </div>`;
    });
    equipHtml += '</div>';

    // 箭矢欄（格狀版沒有中間那顆橢圓，改成底圖版之外的獨立一列）
    equipHtml += buildAmmoRowHtml();
    return equipHtml;
  }
}

/* 箭矢狀態列：裝了哪種箭、剩幾支；拿弓卻沒箭時給明顯警告 */
function buildAmmoRowHtml() {
  const ammoId = getEquippedAmmoId();
  const bow = needsAmmo();
  if (!ammoId && !bow) return '';
  const d = ammoId ? ITEMS[ammoId] : null;
  const qty = getAmmoCount();
  const warn = bow && qty <= 0;
  return `<div class="ammo-row${warn ? ' warn' : ''}">
    <span class="ammo-label">🏹 箭矢</span>
    ${d
      ? `<img class="ammo-icon" src="${itemImgSrc(ammoId)}" onerror="this.onerror=null;this.src='${placeholderImgSrc('item')}'">
         <span class="ammo-name">${d.name}${d.element && d.element !== 'none' ? ` ${ELEMENT_ICONS[d.element]}` : ''}　ATK+${d.atk || 0}</span>
         <span class="ammo-qty${qty <= 0 ? ' zero' : ''}">×${qty}</span>
         <button class="btn-small ghost" onclick="unequipAmmo();renderEquipTab();renderTopBar();">卸下</button>`
      : `<span class="ammo-name">未裝備</span>`}
    <button class="btn-small" onclick="showAmmoSelect()">選擇箭矢</button>
    ${warn ? `<span class="ammo-warn">沒箭矢，弓無法攻擊！</span>` : ''}
  </div>`;
}

// 選箭矢：只列背包裡真的有的箭
function showAmmoSelect() {
  const el = document.getElementById('tab-equip');
  if (!el) return;
  const rows = state.inventory.filter(r => !r.instanceId && isAmmoItem(r.item) && r.qty > 0);
  let html = `<h3 class="panel-title">🏹 選擇箭矢</h3>`;
  html += `<button class="btn-small" onclick="renderEquipTab()">← 返回裝備欄</button>`;
  if (!rows.length) {
    html += `<div class="equip-pick-empty">背包裡沒有箭矢。弓箭手可以在城鎮的武器商人買到。</div>`;
  } else {
    html += rows.map(r => {
      const d = ITEMS[r.item];
      const on = getEquippedAmmoId() === r.item;
      return `<div class="equip-pick-row${on ? ' equipped' : ''}">
        <img src="${itemImgSrc(r.item)}" onerror="this.onerror=null;this.src='${placeholderImgSrc('item')}'">
        <div class="equip-pick-info">
          <div class="equip-pick-name">${d.name}　<span class="ammo-qty">×${r.qty}</span></div>
          <div class="equip-pick-stats">ATK +${d.atk || 0}${d.element && d.element !== 'none' ? `　${ELEMENT_ICONS[d.element]}${ELEMENT_NAMES[d.element]}屬性` : '　無屬性'}</div>
        </div>
        ${on ? `<span class="equip-pick-stats">使用中</span>`
             : `<button class="btn-small" onclick="equipAmmo('${r.item}');renderEquipTab();renderTopBar();">裝備</button>`}
      </div>`;
    }).join('');
  }
  el.innerHTML = html;
}

/* ---------------- 裝備分頁 ----------------
   上半是裝備欄（sticky 釘住不動），下半列出背包裡「本職業穿得上」的武器／防具，
   直接點就換裝。個體裝備（精煉／插卡過的）跟普通那疊分開列，各自是一件。
------------------------------------------------- */
let equipPickCat = 'weapon';   // 'weapon' | 'armor'
function setEquipPickCat(c) { equipPickCat = c; renderEquipTab(); }

/* 裝備欄現在住在「裝備」分頁，但背包分頁也會顯示個體裝備列，
   兩邊都可能因為換裝／精煉／插卡而需要重畫——重畫目前看得到的那個就好 */
function refreshEquipViews() {
  if (activeTab === 'inventory') renderInventoryTab();
  else renderEquipTab();
}

/* 這件裝備目前這個職業穿不穿得上。
   reqJob 寫的是「本職」名稱（例：日本刀是 swordsman/merchant/thief），
   而二轉職業穿得下一轉的裝備，所以要比對整條職業鏈（騎士＝novice→swordsman→knight）。
   沒寫 reqJob 的視為全職業通用。 */
function canJobEquip(def) {
  if (!def || !def.reqJob || !def.reqJob.length) return true;
  return getAllLearnedJobs().some(j => def.reqJob.includes(j));
}

function renderEquipTab() {
  const el = document.getElementById('tab-equip');
  if (!el) return;
  hideEquipTooltip();

  try {
    const rows = state.inventory.filter(r => {
      const d = ITEMS[r.item];
      return d && d.type === equipPickCat && canJobEquip(d);
    }).sort((a, b) => {
      // 個體（精煉/插卡）排前面，其次照名稱
      const ai = a.instanceId ? 0 : 1, bi = b.instanceId ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return (ITEMS[a.item].name || '').localeCompare(ITEMS[b.item].name || '', 'zh-Hant');
    });

    const listHtml = rows.length ? rows.map(r => {
      const d = ITEMS[r.item];
      const inst = r.instanceId ? (state.instances || {})[r.instanceId] : null;
      if (r.instanceId && !inst) return '';
      const refine = inst ? (inst.refine || 0) : 0;
      const cards = inst ? (inst.cards || []) : [];

      const bits = [];
      if (d.atk) bits.push(`ATK ${statWithRefine(r.item, 'atk', refine)}`);
      if (d.def) bits.push(`DEF ${statWithRefine(r.item, 'def', refine)}`);
      if (d.matk) bits.push(`MATK ${d.matk}`);
      if (d.element) bits.push(`${ELEMENT_ICONS[d.element]}${ELEMENT_NAMES[d.element]}`);
      if (!r.instanceId && r.qty > 1) bits.push(`×${r.qty}`);

      // 這份清單來源是背包，穿在身上的裝備不在裡面，所以一律是「裝備」；
      // 要卸下請點上方裝備欄那一格（連點兩下）
      const action = r.instanceId ? `equipInstance('${r.instanceId}')` : `equipItem('${r.item}')`;
      return `<div class="equip-pick-row">
        <img src="${itemImgSrc(r.item)}" onerror="this.onerror=null;this.src='${placeholderImgSrc(itemPlaceholderKind(d))}'">
        <div class="equip-pick-info">
          <div class="equip-pick-name">${refine > 0 ? `<span class="slot-refine">+${refine}</span> ` : ''}${getItemDisplayName(r.item)}${d.slots ? ` <span class="inv-slots">[${d.slots}]</span>` : ''}</div>
          <div class="equip-pick-stats">${bits.join('　')}</div>
          ${cards.length ? `<div class="equip-pick-cards">🃏 ${cards.map(id => CARDS[id] ? CARDS[id].name : id).join('、')}</div>` : ''}
          ${renderCompareBadge(r.item, refine)}
        </div>
        <button class="btn-small" onclick="${action};renderEquipTab();renderTopBar();">裝備</button>
      </div>`;
    }).join('') : `<div class="equip-pick-empty">背包裡沒有${currentJob().name}穿得上的${equipPickCat === 'weapon' ? '武器' : '防具'}。</div>`;

    el.innerHTML = `
      <div class="equip-fixed">
        <div class="equip-fixed-head">
          <h3 class="panel-title">裝備欄</h3>
          <select class="ab-select equip-skin-select" onchange="setEquipSkin(this.value)" title="切換裝備視窗外觀">
            ${EQUIP_SKINS.map(s => `<option value="${s.key}" ${getEquipSkin() === s.key ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </div>
        ${buildEquipPanelHtml()}
      </div>
      <div class="equip-pick-head">
        <button class="btn-small ${equipPickCat === 'weapon' ? 'active' : 'ghost'}" onclick="setEquipPickCat('weapon')">⚔️ 武器</button>
        <button class="btn-small ${equipPickCat === 'armor' ? 'active' : 'ghost'}" onclick="setEquipPickCat('armor')">🛡️ 防具</button>
        <span class="equip-pick-stats">${currentJob().name}可裝備 ${rows.length} 件</span>
      </div>
      ${listHtml}
      <div id="ro-equip-tooltip" class="ro-equip-tooltip"></div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty-hint">裝備分頁載入錯誤：${e.message}</div>`;
    console.error('renderEquipTab error:', e);
  }
}

function renderInventoryTab() {
  const el = document.getElementById('tab-inventory');
  if (!el) return;

  hideEquipTooltip();

  try {
    // ---- 背包：四分類 ----
    const known = state.inventory.filter(r => ITEMS[r.item]);
    const catCount = {};
    INV_CATEGORIES.forEach(c => { catCount[c.key] = 0; });
    known.forEach(r => { catCount[invCategoryOf(r.item)]++; });

    // 目前分類底下的子分類清單（只列真的持有的）
    const inCat = known.filter(r => invCategoryOf(r.item) === invCategory);
    const subCount = {};
    inCat.forEach(r => { const s = invSubOf(r.item); subCount[s] = (subCount[s] || 0) + 1; });
    const subKeys = Object.keys(subCount).sort((a, b) => subCount[b] - subCount[a]);

    let rows = inCat;
    if (invSub !== 'all') rows = rows.filter(r => invSubOf(r.item) === invSub);
    if (invSearch) rows = rows.filter(r => (ITEMS[r.item].name || '').toLowerCase().includes(invSearch));

    rows = rows.slice().sort((a, b) => {
      if (invSort === 'qty') return b.qty - a.qty;
      if (invSort === 'value') return (ITEMS[b.item].sell || 0) * b.qty - (ITEMS[a.item].sell || 0) * a.qty;
      // 同名時把個體裝備（精煉/插卡過的）排在普通那疊前面，比較顯眼
      const nameCmp = (ITEMS[a.item].name || '').localeCompare(ITEMS[b.item].name || '', 'zh-Hant');
      if (nameCmp !== 0) return nameCmp;
      return (b.instanceId ? 1 : 0) - (a.instanceId ? 1 : 0);
    });

    const catTabs = INV_CATEGORIES.map(c =>
      `<button class="btn-small ${invCategory === c.key ? 'active' : ''}" onclick="setInvCategory('${c.key}')">${c.icon} ${c.name} <span class="inv-cat-n">${catCount[c.key]}</span></button>`
    ).join('');

    const subChips = subKeys.length > 1
      ? `<div class="inv-subs">
           <button class="btn-chip ${invSub === 'all' ? 'active' : ''}" onclick="setInvSub('all')">全部 ${inCat.length}</button>
           ${subKeys.map(s => `<button class="btn-chip ${invSub === s ? 'active' : ''}" onclick="setInvSub('${s}')">${invSubLabel(invCategory, s)} ${subCount[s]}</button>`).join('')}
         </div>`
      : '';

    const items = rows.map(row => {
      const def = ITEMS[row.item];
      const displayName = getItemDisplayName(row.item);
      const isCard = !!CARDS[row.item];
      const canUse = def.type === 'consumable' || def.type === 'weapon' || def.type === 'armor';
      const elemTag = def.element ? ` ${ELEMENT_ICONS[def.element]}${ELEMENT_NAMES[def.element]}` : '';

      // ---- 個體裝備（精煉過或插過卡）：獨立一行，狀態跟著這一件走 ----
      if (row.instanceId) {
        const inst = state.instances ? state.instances[row.instanceId] : null;
        if (!inst) return '';
        const iLocked = isItemLocked(row.item);
        const refTag = inst.refine > 0 ? `<span class="slot-refine">+${inst.refine}</span> ` : '';
        const iCards = inst.cards || [];
        const maxSlots = def.slots || 0;
        const cardsHtml = iCards.length
          ? `<div class="inv-cardslot">🃏 ${iCards.map(id => CARDS[id] ? CARDS[id].name : id).join('、')}（${iCards.length}/${maxSlots}）</div>`
          : '';
        return `<div class="inv-row${iLocked ? ' locked' : ''}">
          <div class="inv-row-main">
            <div class="inv-icon"><img src="${itemImgSrc(row.item)}" alt="${displayName}" onerror="this.onerror=null;this.src='${placeholderImgSrc(itemPlaceholderKind(def))}'"></div>
            <div class="inv-info">
              <div class="inv-name">${iLocked ? '<span class="inv-lock-tag">🔒</span> ' : ''}${refTag}${displayName}${def.slots ? ` <span class="inv-slots">[${def.slots}]</span>` : ''}${elemTag}</div>
              <div class="inv-desc">${def.desc || ''}</div>
              ${cardsHtml}
              ${renderCompareBadge(row.item, inst.refine)}
            </div>
          </div>
          <div class="inv-actions">
            <button class="btn-small ${iLocked ? '' : 'ghost'}" title="${iLocked ? '解除鎖定' : '鎖定後不會被賣出／自動販賣'}"
              onclick="toggleItemLock('${row.item}');renderInventoryTab();">${iLocked ? '🔒' : '🔓'}</button>
            <button class="btn-small" onclick="equipInstance('${row.instanceId}');renderInventoryTab();renderTopBar();">裝備</button>
            ${iLocked ? '' : `<button class="btn-small ghost" onclick="sellItemInstance('${row.instanceId}');renderInventoryTab();renderTopBar();">賣出(${def.sell})</button>`}
            <button class="btn-small ghost" onclick="depositInstanceToWarehouse('${row.instanceId}');renderInventoryTab();renderTopBar();">存倉庫</button>
            ${iCards.length ? `<button class="btn-small ghost danger" onclick="doDestroyInstance('${row.instanceId}')">拆卸取回卡片</button>` : ''}
          </div>
        </div>`;
      }

      // 卡片優先列出引擎真的吃到的加成；沒有可實裝加成時退回卡片自己的敘述，
      // 而不是 ITEMS 的敘述——後者尾巴帶著「系列: 卡片 装备: 武器 重量: 1」這類匯入殘留
      let cardBonus = '';
      if (isCard) {
        const cd = CARDS[row.item];
        const bonusKeys = Object.keys(cd.bonus || {});
        cardBonus = bonusKeys.length
          ? bonusKeys.map(k => formatCardBonus(k, cd.bonus[k])).join('、')
          : (cd.desc || '');
      }
      const slotTag = def.slots ? ` <span class="inv-slots">[${def.slots}]</span>` : '';
      const locked = isItemLocked(row.item);
      // 只有能穿的裝備才做比較，素材消耗品沒有比較的意義
      const compareHtml = (def.type === 'weapon' || def.type === 'armor') ? renderCompareBadge(row.item) : '';
      return `<div class="inv-row${locked ? ' locked' : ''}">
        <div class="inv-row-main">
          <div class="inv-icon"><img src="${itemImgSrc(row.item)}" alt="${displayName}" onerror="this.onerror=null;this.src='${placeholderImgSrc(itemPlaceholderKind(def))}'"></div>
          <div class="inv-info">
            <div class="inv-name">${locked ? '<span class="inv-lock-tag">🔒</span> ' : ''}${displayName} x${row.qty}${slotTag}${elemTag}</div>
            <div class="inv-desc">${cardBonus || def.desc || ''}</div>
            ${isCard ? `<div class="inv-cardslot">插槽：${cardSlotLabel(CARDS[row.item])}</div>` : ''}
            ${compareHtml}
          </div>
        </div>
        <div class="inv-actions">
          <button class="btn-small ${locked ? '' : 'ghost'}" title="${locked ? '解除鎖定' : '鎖定後不會被賣出／自動販賣'}"
            onclick="toggleItemLock('${row.item}');renderInventoryTab();">${locked ? '🔒' : '🔓'}</button>
          ${def.ammo ? `<button class="btn-small" onclick="equipAmmo('${row.item}');renderInventoryTab();renderTopBar();">裝備箭矢</button>` : ''}
          ${(() => {
            // 原石：湊滿 5 個就能合成
            const k = Object.keys(ORE_SYNTHESIS).find(x => ORE_SYNTHESIS[x].from === row.item);
            if (!k) return '';
            const r = ORE_SYNTHESIS[k];
            return `<button class="btn-small" ${row.qty >= r.need ? '' : 'disabled'}
              onclick="synthesizeOre('${k}');renderInventoryTab();renderTopBar();"
              title="${r.need} 個合成 1 個${ITEMS[r.to].name}">合成(${row.qty}/${r.need})</button>`;
          })()}
          ${canUse ? `<button class="btn-small" onclick="useItem('${row.item}');renderInventoryTab();">${def.type === 'consumable' ? '使用' : '裝備'}</button>` : ''}
          ${locked ? '' : `<button class="btn-small ghost" onclick="sellItem('${row.item}',1);renderInventoryTab();renderTopBar();">賣出(${def.sell})</button>`}
          ${!locked && row.qty > 1 ? `<button class="btn-small ghost" onclick="sellItemAll('${row.item}');renderInventoryTab();renderTopBar();">全部賣出</button>` : ''}
          <button class="btn-small ghost" onclick="depositToWarehouse('${row.item}',1);renderInventoryTab();renderTopBar();">存倉庫</button>
          ${row.qty > 1 ? `<button class="btn-small ghost" onclick="depositToWarehouseAll('${row.item}');renderInventoryTab();renderTopBar();">全部存倉</button>` : ''}
        </div>
      </div>`;
    }).join('');

    const emptyMsg = invSearch
      ? '沒有符合搜尋的道具。'
      : (inCat.length === 0 ? `背包裡還沒有${INV_CATEGORIES.find(c => c.key === invCategory).name}。` : '這個子分類沒有東西。');

    const invHtml = `
      <div class="inv-cats">${catTabs}</div>
      <div class="inv-toolbar">
        <input id="inv-search" class="codex-search" type="text" placeholder="🔍 搜尋名稱…（四類共用）"
          value="${invSearch.replace(/"/g, '&quot;')}" oninput="onInvSearch(this.value)">
        <select class="ab-select inv-sort" onchange="setInvSort(this.value)">
          <option value="name" ${invSort === 'name' ? 'selected' : ''}>依名稱</option>
          <option value="qty" ${invSort === 'qty' ? 'selected' : ''}>依數量</option>
          <option value="value" ${invSort === 'value' ? 'selected' : ''}>依總價值</option>
        </select>
      </div>
      ${subChips}
      <div class="inv-list">${items || `<div class="empty-hint">${emptyMsg}</div>`}</div>`;

    // 露天商店（僅商人職業且已學會露天商店技能時顯示）
    let vendingHtml = '';
    if (state.jobId === 'merchant' && state.learnedSkills && state.learnedSkills['vending']) {
      const cfg = state.vendingConfig || { items: [] };
      const itemNames = cfg.items.length
        ? cfg.items.map(id => ITEMS[id] ? ITEMS[id].name : id).join('、')
        : '尚未選擇';
      const readyIn = Math.max(0, Math.ceil(((state.vendingReadyAt || 0) - Date.now()) / 1000));
      vendingHtml = `<div class="vending-panel">
        <h3 class="panel-title">🏪 露天商店</h3>
        <div class="vending-info">已選擇：${itemNames}${readyIn > 0 ? `（下次販售倒數 ${readyIn}s）` : ''}</div>
        <button class="btn-small" onclick="showVendingSelect()">設定販售道具</button>
      </div>`;
    }

    // 鐵匠鍛造（僅鐵匠職業且已學會至少一種鍛造技能時顯示）
    let craftingHtml = '';
    if (state.jobId === 'blacksmith' && state.unlockedCraftCategories && state.unlockedCraftCategories.length > 0) {
      craftingHtml = `<div class="crafting-panel">
        <h3 class="panel-title">🔨 鍛造</h3>
        <div class="empty-hint">已解鎖：${state.unlockedCraftCategories.map(c => CRAFT_CATEGORY_NAMES[c] || c).join('、')}　鍛造成功率：${getCraftingSuccessChance().toFixed(1)}%</div>
        <button class="btn-small" onclick="showCraftingPanel()">開始鍛造</button>
      </div>`;
    }

    // 跨角色倉庫（任何職業都可使用）
    const warehouseHtml = `<div class="warehouse-panel">
      <h3 class="panel-title">📦 倉庫</h3>
      <button class="btn-small" onclick="showWarehousePanel()">開啟倉庫</button>
    </div>`;

    // 自動販賣（任何職業都可使用）
    const autoSellCfg = state.autoSellConfig || { enabled: false, items: [] };
    const autoSellHtml = `<div class="autosell-panel">
      <h3 class="panel-title">🏷️ 自動販賣</h3>
      <div class="empty-hint">${autoSellCfg.enabled ? `已啟用，已選 ${autoSellCfg.items.length} 種道具，每30秒自動賣出` : '尚未啟用'}</div>
      <button class="btn-small" onclick="showAutoSellPanel()">設定自動販賣</button>
    </div>`;

    el.innerHTML = `${vendingHtml}${craftingHtml}${warehouseHtml}${autoSellHtml}`
      + `<h3 class="panel-title">背包（${known.length}）</h3>${invHtml}`;
  } catch (e) {
    el.innerHTML = `<div class="empty-hint">背包載入錯誤：${e.message}</div>`;
    console.error('renderInventoryTab error:', e);
  }
}

/* ---- 裝備視窗：hover 提示 ---- */
const _equipClickTimers = {};

function showEquipTooltip(event, slotKey) {
  const itemId = getEquipBaseItemId(slotKey);
  if (!itemId) return;
  const item = ITEMS[itemId];
  if (!item) return;
  const tt = document.getElementById('ro-equip-tooltip');
  if (!tt) return;

  const refLevel = getRefinementLevel(slotKey);
  const slotCards = getEquippedCards(slotKey);
  const maxSlots = getEquipCardSlots(slotKey);

  let html = `<div class="tt-name">${getItemDisplayName(itemId)}${refLevel > 0 ? ` <span class="tt-refine">+${refLevel}</span>` : ''}</div>`;
  html += `<div class="tt-type">${item.type === 'weapon' ? '武器' : '防具'}${item.element ? ' · ' + ELEMENT_ICONS[item.element] + ELEMENT_NAMES[item.element] : ''}</div>`;
  if (item.desc) html += `<div class="tt-desc">${item.desc}</div>`;
  // 顯示數值
  const stats = [];
  if (item.atk) stats.push(`<span>ATK +${item.atk}</span>`);
  if (item.def) stats.push(`<span>DEF +${item.def}</span>`);
  if (item.matk) stats.push(`<span>MATK +${item.matk}</span>`);
  if (item.mdef) stats.push(`<span>MDEF +${item.mdef}</span>`);
  if (item.hit) stats.push(`<span>HIT +${item.hit}</span>`);
  if (item.flee) stats.push(`<span>FLEE +${item.flee}</span>`);
  if (item.aspd) stats.push(`<span>ASPD +${item.aspd}</span>`);
  if (item.crit) stats.push(`<span>CRIT +${item.crit}</span>`);
  if (item.hp) stats.push(`<span>HP +${item.hp}</span>`);
  if (item.sp) stats.push(`<span>SP +${item.sp}</span>`);
  if (item.str) stats.push(`<span>STR +${item.str}</span>`);
  if (item.agi) stats.push(`<span>AGI +${item.agi}</span>`);
  if (item.vit) stats.push(`<span>VIT +${item.vit}</span>`);
  if (item.int) stats.push(`<span>INT +${item.int}</span>`);
  if (item.dex) stats.push(`<span>DEX +${item.dex}</span>`);
  if (item.luk) stats.push(`<span>LUK +${item.luk}</span>`);
  if (stats.length) html += `<div class="tt-stats">${stats.join('')}</div>`;
  if (maxSlots > 0) {
    html += `<div class="tt-slots">插槽 ${slotCards.length}/${maxSlots}</div>`;
    slotCards.forEach(cid => {
      if (CARDS[cid]) html += `<div class="tt-card">🃏 ${CARDS[cid].name}</div>`;
    });
  }
  html += `<div class="tt-hint">點擊 2 次卸下裝備</div>`;

  tt.innerHTML = html;
  tt.classList.add('show');

  // 定位：貼在被指到的那一格旁邊。格狀版是 .ro-equip-slot，底圖版是 .equipwin-slot，
  // 兩個都要認得，否則底圖版會找不到基準點、提示框停在畫面外看不到。
  const slotEl = event.target.closest('.ro-equip-slot, .equipwin-slot');
  const rect = slotEl ? slotEl.getBoundingClientRect()
                      : { right: event.clientX || 0, left: event.clientX || 0, top: event.clientY || 0 };
  let left = rect.right + 8;
  let top = rect.top;
  // 防止超出右側
  if (left + 280 > window.innerWidth) left = rect.left - 288;
  if (left < 4) left = 4;
  // 防止超出底部
  if (top + 200 > window.innerHeight) top = window.innerHeight - 210;
  if (top < 4) top = 4;
  tt.style.left = left + 'px';
  tt.style.top = top + 'px';
}

function hideEquipTooltip() {
  const tt = document.getElementById('ro-equip-tooltip');
  if (tt) tt.classList.remove('show');
}

function onEquipSlotClick(slotKey) {
  const itemId = state.equip[slotKey];
  if (!itemId) return;

  // 雙擊確認卸下
  const now = Date.now();
  if (_equipClickTimers[slotKey] && now - _equipClickTimers[slotKey] < 500) {
    // 第二次點擊：卸下
    clearTimeout(_equipClickTimers[slotKey]);
    delete _equipClickTimers[slotKey];
    unequipItem(slotKey);
    refreshEquipViews();
    renderTopBar();
  } else {
    // 第一次點擊：提示
    _equipClickTimers[slotKey] = now;
    const tt = document.getElementById('ro-equip-tooltip');
    if (tt) {
      const item = ITEMS[getEquipBaseItemId(slotKey)];
      const hint = tt.querySelector('.tt-hint');
      if (hint) hint.textContent = `再點一次卸下 ${item ? item.name : '裝備'}`;
      tt.classList.add('show');
    }
  }
}

/* ---------------- 角色分頁 ---------------- */
/* 素質加成的來源明細（給 title 用，滑過去就看得到是哪件裝備／哪張卡給的）。
   走訪所有裝備欄與已插的卡片，把有貢獻這項素質的列出來。 */
function statGearSources(stat) {
  const out = [];
  EQUIP_SLOTS_ALL.forEach(slot => {
    const id = getEquipBaseItemId(slot);
    const d = id ? ITEMS[id] : null;
    if (d && typeof d[stat] === 'number' && d[stat] !== 0) {
      out.push({ name: getItemDisplayName(id), v: d[stat] });
    }
  });
  allEquippedCards().forEach(cid => {
    const c = CARDS[cid];
    if (c && c.bonus && c.bonus[stat]) out.push({ name: c.name, v: c.bonus[stat] });
  });
  return out;
}
// title 屬性不能直接放引號/HTML，統一轉成純文字多行
function statGearSourceTitle(stat) {
  const src = statGearSources(stat);
  if (!src.length) return '裝備／卡片加成';
  const total = src.reduce((a, b) => a + b.v, 0);
  return ['裝備／卡片加成　合計 ' + (total > 0 ? '+' : '') + total]
    .concat(src.map(s => `・${s.name}　${s.v > 0 ? '+' : ''}${s.v}`))
    .join('\n').replace(/"/g, '＂');
}
function statJobSourceTitle(stat, bonus) {
  // 職業加成是跨職業累計繼承的，把整條職業鏈列出來比較好懂
  const chain = (typeof getAllLearnedJobs === 'function' ? getAllLearnedJobs() : [state.jobId])
    .map(j => (JOB_TREE[j] && JOB_TREE[j].name) || j);
  return `職業加成　+${bonus}\n來自：${chain.join(' → ')}`.replace(/"/g, '＂');
}

function renderCharacterTab() {
  const job = currentJob();
  const el = document.getElementById('tab-character');

  // 計算 buff 加成後的實際數值
  const critBuff = buffMult('crit');
  const hitBuff = buffMult('hit');
  const effectiveCritRate = Math.min(100, Math.round(state.critRate * critBuff.mult + critBuff.flatBonus));
  const effectiveHit = Math.round(state.hit * hitBuff.mult + hitBuff.flatBonus);

  // 顯示目前啟動中的 buffs
  let buffListHtml = '<div id="active-buffs" class="active-buffs">';
  if (state.buffs && state.buffs.length > 0) {
    const buffNames = { aspd: '攻速', atk: '攻擊', def: '防禦', flee: '迴避', gold: '金錢', crit: '暴擊', hit: '命中' };
    buffListHtml += state.buffs.map(b => {
      const name = buffNames[b.type] || b.type;
      const remain = Math.ceil(b.msRemaining / 1000);
      const bonus = b.flatBonus ? `+${b.flatBonus}` : `×${b.mult.toFixed(2)}`;
      return `<span class="buff-tag">${name} ${bonus} (${remain}s)</span>`;
    }).join('');
  }
  buffListHtml += '</div>';

  const jobBonus = computeJobBonuses();
  el.innerHTML = `
    <h3 class="panel-title">${job.icon} ${state.name}　<span class="job-name">${job.name}</span></h3>
    <div class="stat-grid">
      ${STAT_KEYS.map(k => {
        const cost = statPointCost(state.stats[k]);
        const canAfford = state.statPoints >= cost;
        const bonus = jobBonus[k];
        // 裝備與卡片的素質加成本來就有算進戰鬥數值，只是這裡沒顯示，
        // 看起來就像「魔術師帽的 AGI+1 沒效果」——補上金色那段
        const gear = equippedStatBonus(k) + getCardBonus(k);
        return `
        <div class="stat-row">
          <div class="stat-label">${STAT_NAMES[k]}</div>
          <div class="stat-value"><span class="stat-seg" title="基礎值（已分配的屬性點）">${state.stats[k]}</span>${
            bonus > 0 ? `<span class="stat-seg" style="color:#4fc3f7" title="${statJobSourceTitle(k, bonus)}">+${bonus}</span>` : ''}${
            gear !== 0 ? `<span class="stat-seg" style="color:var(--gold-soft)" title="${statGearSourceTitle(k)}">${gear > 0 ? '+' : ''}${gear}</span>` : ''}</div>
          <div class="stat-cost">-${cost}</div>
          <button class="btn-tiny" ${canAfford ? '' : 'disabled'} onclick="allocateStat('${k}');renderCharacterTab();renderTopBar();">+</button>
        </div>`;
      }).join('')}
    </div>
    <div class="stat-points-left">可分配屬性點：${state.statPoints}</div>
    ${buffListHtml}
    <div class="derived-grid">
      <div>物理攻擊 ATK：${state.atk}${(() => { const r = getRefinementLevel('weapon'); const wId = getEquipBaseItemId('weapon'); const wLv = wId ? (ITEMS[wId].weaponLv || 1) : 1; return r > 0 ? ` (+${getRefinementAtkBonus(r, wLv)}精煉)` : ''; })()}</div>
      <div>魔法攻擊 MATK：${state.matkMin}~${state.matkMax}</div>
      <div>防禦 DEF：${state.def}${(() => { let refBonus = 0; ['head_top','head_mid','head_bottom','armor','shield','garment','footgear','accessory1','accessory2'].forEach(s => { const lv = getRefinementLevel(s); if (lv > 0) refBonus += getRefinementDefBonus(lv); }); return refBonus > 0 ? ` (+${refBonus}精煉)` : ''; })()}</div>
      <div>攻擊速度 ASPD：${state.aspd}${state.buffs.some(b => b.type === 'aspd') ? ' <span class="buff-active">BUFF</span>' : ''}</div>
      <div>攻擊間隔：${(state.attackInterval / 1000).toFixed(2)} 秒</div>
      <div>命中 HIT：${effectiveHit}${effectiveHit > state.hit ? ` <span class="buff-active">(+${effectiveHit - state.hit})</span>` : ''}</div>
      <div>迴避 FLEE：${state.flee}</div>
      <div>暴擊率：${effectiveCritRate}%${effectiveCritRate > state.critRate ? ` <span class="buff-active">(+${effectiveCritRate - state.critRate})</span>` : ''}</div>
      <div>完全迴避：${state.perfectDodge}%</div>
      <div>武器屬性：${(() => { const wId = getEquipBaseItemId('weapon'); const w = wId ? ITEMS[wId] : null; const el = w && w.element ? w.element : 'none'; return ELEMENT_ICONS[el] + ' ' + ELEMENT_NAMES[el]; })()}</div>
    </div>
    <p class="stat-formula-hint">數值公式參考 RO 正式版邏輯調整：ATK=STR+(STR/10)²+DEX/5+LUK/5；HIT=175+等級+DEX；FLEE=100+等級+AGI；DEF 採比例減傷而非直接相減。屬性點數規則對齊官方對照表：每級獲得 floor((等級-1)/5)+3 點；加點消耗隨數值升高而增加（1~10 花2點、11~20花3點...以此類推）。</p>`;
}

/* ---------------- 轉職樹（簽名視覺元素） ---------------- */
function renderJobTree() {
  const el = document.getElementById('tab-jobtree');
  const tiers = [['novice'], ['swordsman', 'mage', 'archer', 'merchant', 'thief', 'acolyte'], ['knight', 'wizard', 'hunter', 'blacksmith', 'assassin', 'priest']];
  const nodeW = 108, nodeH = 64, gapX = 20, tierGapY = 130;
  const svgW = tiers[1].length * (nodeW + gapX);
  const svgH = tierGapY * 2 + nodeH + 40;

  function xOf(tierIdx, i, count) {
    const rowW = count * (nodeW + gapX) - gapX;
    const startX = (svgW - rowW) / 2;
    return startX + i * (nodeW + gapX);
  }

  let lines = '';
  let nodes = '';
  tiers.forEach((tier, tIdx) => {
    const y = 20 + tIdx * tierGapY;
    tier.forEach((jobId, i) => {
      const x = xOf(tIdx, i, tier.length);
      const cx = x + nodeW / 2;
      const jd = JOB_TREE[jobId];
      const isCurrent = state.jobId === jobId;
      const unlocked = isCurrent || isJobUnlocked(jobId);
      const canChange = tIdx > 0 && canJobChange(jobId);

      if (jd.parent) {
        const pTierIdx = tIdx - 1;
        const pTier = tiers[pTierIdx];
        const pi = pTier.indexOf(jd.parent);
        const px = xOf(pTierIdx, pi, pTier.length) + nodeW / 2;
        const py = 20 + pTierIdx * tierGapY + nodeH;
        lines += `<line x1="${px}" y1="${py}" x2="${cx}" y2="${y}" class="tree-line ${unlocked ? 'tree-line-active' : ''}" />`;
      }

      nodes += `<g class="tree-node ${isCurrent ? 'tree-node-current' : ''} ${unlocked ? 'tree-node-unlocked' : 'tree-node-locked'}"
                   transform="translate(${x},${y})" ${canChange ? `onclick="doJobChange('${jobId}');renderJobTree();renderAll();"` : ''} style="${canChange ? 'cursor:pointer' : ''}">
          <rect width="${nodeW}" height="${nodeH}" rx="10" class="tree-rect"/>
          <text x="${nodeW / 2}" y="24" class="tree-icon" text-anchor="middle">${jd.icon}</text>
          <text x="${nodeW / 2}" y="46" class="tree-label" text-anchor="middle">${jd.name}</text>
          ${canChange ? `<text x="${nodeW / 2}" y="58" class="tree-cta" text-anchor="middle">點擊轉職</text>` : ''}
        </g>`;
    });
  });

  el.innerHTML = `<h3 class="panel-title">轉職之路</h3>
    <div class="job-tree-wrap">
      <svg viewBox="0 0 ${svgW} ${svgH}" class="job-tree-svg">${lines}${nodes}</svg>
    </div>
    <p class="tree-hint">金色代表你已走過或正在的道路。二轉需職業等級滿級並達到基礎等級門檻。三轉之路仍在雲霧之中，敬請期待未來的資料片。</p>`;
}

/* ---------------- 地圖背景圖 ---------------- */
function renderMapBackground() {
  const img = document.getElementById('map-bg-img');
  if (!img) return;
  img.src = mapImgSrc(state.mapId);
}

/* ---------------- 背景音樂 ----------------
   規則：依序嘗試 music/maps/{地圖編號}.mp3 / .ogg / .wav，
   全部都找不到就安靜不播放（不會報錯、不會卡住遊戲）。
------------------------------------------------- */
let bgmAudio = null;
let bgmToken = 0;

function playMapMusic() {
  bgmToken++;
  const myToken = bgmToken;
  stopMusic();
  if (state.muted) return;
  tryMusicExt(state.mapId, 0, myToken);
}

function tryMusicExt(mapId, extIdx, token) {
  if (extIdx >= MUSIC_EXTS.length) return;
  const ext = MUSIC_EXTS[extIdx];
  const audio = new Audio();
  audio.loop = true;
  audio.volume = (state.bgmVolume != null ? state.bgmVolume : 0.5);
  audio.addEventListener('error', () => {
    if (bgmToken === token) tryMusicExt(mapId, extIdx + 1, token);
  }, { once: true });
  audio.addEventListener('canplaythrough', () => {
    if (bgmToken !== token) return;
    bgmAudio = audio;
    audio.play().catch(() => {});
  }, { once: true });
  audio.src = mapMusicUrl(mapId, ext);
  audio.load();
}

function stopMusic() {
  if (bgmAudio) {
    bgmAudio.pause();
    bgmAudio.src = '';
    bgmAudio = null;
  }
}

function toggleMute() {
  state.muted = !state.muted;
  const btn = document.getElementById('btn-mute');
  if (btn) btn.textContent = state.muted ? '🔇' : '🔊';
  if (state.muted) stopMusic(); else playMapMusic();
  saveGame();
}

/* ---------------- 音量控制 ---------------- */
function setBgmVolume(val) {
  state.bgmVolume = val / 100;
  document.getElementById('vol-bgm-text').textContent = val + '%';
  if (bgmAudio) bgmAudio.volume = state.bgmVolume;
  saveGame();
}

function setSfxVolume(val) {
  state.sfxVolume = val / 100;
  document.getElementById('vol-sfx-text').textContent = val + '%';
  saveGame();
}

function initVolumeSliders() {
  const bgmVal = state.bgmVolume != null ? Math.round(state.bgmVolume * 100) : 50;
  const sfxVal = state.sfxVolume != null ? Math.round(state.sfxVolume * 100) : 50;
  const bgmSlider = document.getElementById('vol-bgm');
  const sfxSlider = document.getElementById('vol-sfx');
  if (bgmSlider) { bgmSlider.value = bgmVal; document.getElementById('vol-bgm-text').textContent = bgmVal + '%'; }
  if (sfxSlider) { sfxSlider.value = sfxVal; document.getElementById('vol-sfx-text').textContent = sfxVal + '%'; }
}

/* ---------------- 選擇地圖（含背景圖/音樂切換） ---------------- */
function selectMap(mapId) {
  if (changeMap(mapId)) {
    renderMapBackground();
    playMapMusic();
    renderMapTab();
  }
}

/* ---------------- 離線掛機結算彈窗 ---------------- */
function formatDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} 小時 ${m} 分鐘`;
  return `${m} 分鐘`;
}

function showOfflineModal(off) {
  if (off.safeTown) {
    document.getElementById('offline-modal-body').innerHTML = `
      <p class="offline-duration">離開了 <strong>${formatDuration(off.elapsedMs)}</strong>。你的角色待在城鎮裡安穩地休息，沒有遭遇戰鬥，也沒有任何收穫——想練功記得前往原野喔！</p>`;
    document.getElementById('offline-modal').classList.remove('hidden');
    return;
  }
  const itemsHtml = off.itemsGained.length
    ? off.itemsGained.map(r => `<span class="offline-item">${ITEMS[r.item].icon} ${ITEMS[r.item].name} x${r.qty}</span>`).join('')
    : '<span class="offline-item-empty">（沒有掉落物）</span>';

  const levelUpHtml = (off.baseLevelUps > 0 || off.jobLevelUps > 0)
    ? `<div class="offline-levelup">🎉 基礎等級 +${off.baseLevelUps}　職業等級 +${off.jobLevelUps}</div>`
    : '';

  document.getElementById('offline-modal-body').innerHTML = `
    <p class="offline-duration">離開了 <strong>${formatDuration(off.elapsedMs)}</strong>，你的角色在原地持續戰鬥了 ${off.kills} 場戰鬥：</p>
    ${levelUpHtml}
    <div class="offline-stats-grid">
      <div>經驗值 +${off.expGained}</div>
      <div>職業經驗 +${off.jobExpGained}</div>
      <div>鋅幣 +${off.goldGained}</div>
    </div>
    <div class="offline-items">${itemsHtml}</div>`;
  document.getElementById('offline-modal').classList.remove('hidden');
}

function closeOfflineModal() {
  document.getElementById('offline-modal').classList.add('hidden');
}

/* ---------------- 手動存檔 ---------------- */
function manualSave() {
  saveGame();
  showToast('💾 已儲存進度');
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

function isJobUnlocked(jobId) {
  // 沿著 parent 鏈往回追，看是否是目前職業的祖先或本身
  let cur = state.jobId;
  while (cur) {
    if (cur === jobId) return true;
    cur = JOB_TREE[cur].parent;
  }
  return false;
}

/* ---------------- 裝備精煉 UI ---------------- */
function doRefineSlot(slotKey) {
  const itemId = getEquipBaseItemId(slotKey);
  if (!itemId) return;
  const item = ITEMS[itemId];
  const currentLevel = getRefinementLevel(slotKey);
  const isArmor = item.type === 'armor';
  const weaponLv = isArmor ? 0 : (item.weaponLv || 1);

  if (currentLevel >= REFINEMENT_MAX) {
    showToast(`${item.name} 已達最大精煉 +${REFINEMENT_MAX}！`);
    return;
  }

  // 取得可用材料
  const availableMats = Object.entries(REFINEMENT_MATERIALS).filter(([key, mat]) => {
    if (isArmor && !mat.usableArmor) return false;
    if (!isArmor && !mat.usableWeaponLv.includes(weaponLv)) return false;
    const invRow = state.inventory.find(r => r.item === mat.id && !r.instanceId);
    return invRow && invRow.qty >= 1;   // 一次只消耗 1 個，剩 1 個當然也能精煉
  });

  if (availableMats.length === 0) {
    showToast('沒有可用的精煉材料！');
    return;
  }

  const cost = REFINEMENT_COST;
  if (state.gold < cost) {
    showToast(`鋅幣不足！需要 ${cost} 鋅幣`);
    return;
  }

  // 顯示材料選擇
  const matList = availableMats.map(([key, mat]) => {
    const invRow = state.inventory.find(r => r.item === mat.id && !r.instanceId);
    const rate = getRefinementSuccessRate(currentLevel, weaponLv, key);
    const safe = getRefinementSafeLevel(weaponLv, isArmor);
    const penalty = getRefinementFailPenalty(key);
    const penaltyText = penalty === 'none' ? '無懲罰' : (currentLevel >= safe ? '降3級或損壞' : '不降級');
    return `${mat.name} (x${invRow ? invRow.qty : 0}) - 成功率 ${rate}%, ${penaltyText}`;
  }).join('\n');

  const msg = `精煉 ${item.name} +${currentLevel}→+${currentLevel + 1}\n花費 ${cost} 鋅幣\n\n可用材料：\n${matList}\n\n選擇材料後點擊確定`;

  // 簡化版：自動使用第一個可用材料
  if (confirm(msg)) {
    const matKey = availableMats[0][0];
    const success = refineItem(slotKey, matKey);
    if (success) {
      showToast(`🔨 精煉成功！${item.name} +${currentLevel + 1}`);
    } else {
      showToast(`💥 精煉失敗！${item.name} 維持 +${currentLevel}`);
    }
    refreshEquipViews();
    renderTopBar();
  }
}

/* ---------------- 露天商店 UI ---------------- */
let _vendingTempSelection = [];
function showVendingSelect() {
  if (!state.vendingConfig) state.vendingConfig = { items: [] };
  _vendingTempSelection = [...state.vendingConfig.items];
  renderVendingSelectUI();
}
function renderVendingSelectUI() {
  const el = document.getElementById('tab-inventory');
  if (!el) return;
  const sk = findSkillById('vending');
  const sellMult = sk.sellMultiplier || 10;
  const sellableItems = state.inventory.filter(row => {
    if (row.instanceId) return false;   // 精煉/插卡過的裝備不列入自動販售，免得整件連卡帶精煉被賣掉
    const def = ITEMS[row.item];
    return def && def.sell > 0;
  });
  let html = `<h3 class="panel-title">🏪 選擇露天商店販售道具（最多3樣）</h3>`;
  html += `<button class="btn-small" onclick="renderInventoryTab()">← 返回</button>`;
  html += `<div class="empty-hint">已選 ${_vendingTempSelection.length}/3，每${sk.internalCooldown || 60}秒自動以${sellMult}倍價格各賣出1個</div>`;
  if (sellableItems.length === 0) {
    html += `<div class="empty-hint">背包裡沒有可販售的道具。</div>`;
  } else {
    html += '<div class="card-list">';
    sellableItems.forEach(row => {
      const def = ITEMS[row.item];
      const selected = _vendingTempSelection.includes(row.item);
      html += `<div class="card-row${selected ? ' enabled' : ''}">
        <div class="card-info">
          <span class="card-icon">${def.icon || '📦'}</span>
          <div class="card-details">
            <span class="card-name">${def.name} x${row.qty}</span>
            <span class="card-desc">原價${def.sell} → ${sellMult}倍價${def.sell * sellMult}</span>
          </div>
        </div>
        <button class="btn-small" onclick="toggleVendingItem('${row.item}')">${selected ? '取消' : '選擇'}</button>
      </div>`;
    });
    html += '</div>';
  }
  html += `<button class="btn btn-primary" ${_vendingTempSelection.length === 0 ? 'disabled' : ''} onclick="confirmVendingSelect()">確認設定</button>`;
  el.innerHTML = html;
}
function toggleVendingItem(itemId) {
  const idx = _vendingTempSelection.indexOf(itemId);
  if (idx >= 0) {
    _vendingTempSelection.splice(idx, 1);
  } else {
    if (_vendingTempSelection.length >= 3) {
      showToast('最多只能選3樣道具');
      return;
    }
    _vendingTempSelection.push(itemId);
  }
  renderVendingSelectUI();
}
function confirmVendingSelect() {
  setVendingItems(_vendingTempSelection);
  showToast('露天商店設定完成！');
  renderInventoryTab();
}

/* ---------------- 鐵匠鍛造 UI ---------------- */
function showCraftingPanel() {
  const el = document.getElementById('tab-inventory');
  if (!el) return;
  const chance = getCraftingSuccessChance();
  const ironQty = getItemQty('iron');
  const steelQty = getItemQty('steel');

  let html = `<h3 class="panel-title">🔨 鍛造</h3>`;
  html += `<button class="btn-small" onclick="renderInventoryTab()">← 返回</button>`;
  html += `<div class="empty-hint">成功率 ${chance.toFixed(1)}%（失敗材料照樣消耗）。目前持有：鐵x${ironQty}、鋼鐵x${steelQty}、鋅幣${state.gold}</div>`;

  if (state.unlockedMaterialCrafts && state.unlockedMaterialCrafts.length > 0) {
    html += `<h3 class="panel-title">原料鍛造</h3>`;
    html += `<div class="empty-hint">成功率固定 ${MATERIAL_CRAFT_SUCCESS_CHANCE}%（失敗材料照樣消耗），每次花費鋅幣${MATERIAL_CRAFT_ZENY_COST}。</div>`;
    html += '<div class="card-list">';
    Object.keys(MATERIAL_CRAFT_RECIPES).forEach(kind => {
      const recipe = MATERIAL_CRAFT_RECIPES[kind];
      if (!state.unlockedMaterialCrafts.includes(recipe.unlockCategory)) return;
      const resultDef = ITEMS[recipe.result];
      const matText = recipe.consume.map(c => `${ITEMS[c.item] ? ITEMS[c.item].name : c.item}x${c.qty}（持有${getItemQty(c.item)}）`).join('、');
      const canCraft = recipe.consume.every(c => getItemQty(c.item) >= c.qty) && state.gold >= MATERIAL_CRAFT_ZENY_COST;
      html += `<div class="card-row${canCraft ? ' enabled' : ''}">
        <div class="card-info">
          <span class="card-icon">${resultDef ? resultDef.icon : '📦'}</span>
          <div class="card-details">
            <span class="card-name">${resultDef ? resultDef.name : recipe.result}</span>
            <span class="card-desc">需要：${matText}、鋅幣${MATERIAL_CRAFT_ZENY_COST}</span>
          </div>
        </div>
        <button class="btn-small" ${canCraft ? '' : 'disabled'} onclick="doCraftMaterial('${kind}')">鍛造</button>
      </div>`;
    });
    html += '</div>';
  }

  html += `<h3 class="panel-title">武器鍛造</h3>`;
  html += '<div class="card-list">';

  state.unlockedCraftCategories.forEach(cat => {
    const subtypes = Object.keys(CRAFT_SUBTYPE_CATEGORY).filter(st => CRAFT_SUBTYPE_CATEGORY[st] === cat);
    subtypes.forEach(subtype => {
      const mat = CRAFT_SUBTYPE_MATERIALS[subtype];
      const subtypeName = CRAFT_SUBTYPE_NAMES[subtype] || subtype;
      Object.keys(CRAFT_ELEMENT_STONE).forEach(element => {
        const stoneId = CRAFT_ELEMENT_STONE[element];
        const stoneQty = getItemQty(stoneId);
        const elementName = CRAFT_ELEMENT_NAMES[element];
        const stoneDef = ITEMS[stoneId];
        const canCraft = ironQty >= mat.iron && steelQty >= mat.steel && stoneQty >= 1 && state.gold >= CRAFT_ZENY_COST;
        html += `<div class="card-row${canCraft ? ' enabled' : ''}">
          <div class="card-info">
            <span class="card-icon">⚔️</span>
            <div class="card-details">
              <span class="card-name">${subtypeName}（${elementName}屬性）</span>
              <span class="card-desc">需要：鐵x${mat.iron}、鋼鐵x${mat.steel}、${stoneDef ? stoneDef.name : stoneId}x1（持有${stoneQty}）、鋅幣${CRAFT_ZENY_COST}</span>
            </div>
          </div>
          <button class="btn-small" ${canCraft ? '' : 'disabled'} onclick="doCraftWeapon('${subtype}','${element}')">鍛造</button>
        </div>`;
      });
    });
  });
  html += '</div>';
  el.innerHTML = html;
}
function doCraftWeapon(subtype, element) {
  craftWeapon(subtype, element);
  showCraftingPanel();
  renderTopBar();
}
function doCraftMaterial(kind) {
  craftMaterial(kind);
  showCraftingPanel();
  renderTopBar();
}

/* ---------------- 跨角色倉庫 UI ---------------- */
/* 倉庫做成「非阻斷浮動視窗」：外層鋪滿畫面但 pointer-events:none，
   只有中間的 frame 收事件。這樣戰鬥照跑、旁邊的分頁也照樣點得到，
   不像一般 modal 會把整個畫面鎖住。標題列可拖曳。 */
let whCategory = 'weapon';
let whSub = 'all';
let whSearch = '';
let whQty = '';          // 空字串＝整疊

function setWhCategory(c) { whCategory = c; whSub = 'all'; renderWarehouse(); }
function setWhSub(s) { whSub = s; renderWarehouse(); }
function setWhQty(v) { whQty = (v || '').trim(); }
function onWhSearch(v) {
  whSearch = (v || '').trim().toLowerCase();
  renderWarehouse();
  const box = document.getElementById('wh-search');
  if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
}
// 數量欄留空＝整疊，否則取指定數量（夾在 1~持有數之間）
function whAmount(have) {
  const n = parseInt(whQty, 10);
  if (!whQty || isNaN(n) || n < 1) return have;
  return Math.min(n, have);
}
function whDeposit(itemId, have) { depositToWarehouse(itemId, whAmount(have)); renderWarehouse(); renderTopBar(); }
function whWithdraw(itemId, have) { withdrawFromWarehouse(itemId, whAmount(have)); renderWarehouse(); renderTopBar(); }
// 個體裝備一次就是一件，沒有數量的問題
function whDepositInstance(instanceId) { depositInstanceToWarehouse(instanceId); renderWarehouse(); renderTopBar(); }
function whWithdrawInstance(whInstanceId) { withdrawInstanceFromWarehouse(whInstanceId); renderWarehouse(); renderTopBar(); }

function showWarehousePanel() { openWarehouse(); }

function openWarehouse() {
  let win = document.getElementById('warehouse-window');
  if (!win) {
    win = document.createElement('div');
    win.id = 'warehouse-window';
    win.className = 'wh-window';
    win.innerHTML = `<div id="warehouse-frame" class="wh-frame">
        <header id="warehouse-drag" class="wh-header">
          <div><h3>📦 倉庫</h3><span class="wh-sub">跨角色共用，所有存檔通用</span></div>
          <button class="btn-small ghost" onclick="closeWarehouse()">✕ 關閉</button>
        </header>
        <div id="warehouse-body" class="wh-body"></div>
      </div>`;
    document.body.appendChild(win);
    makeDraggable(document.getElementById('warehouse-drag'), document.getElementById('warehouse-frame'));
  }
  win.classList.remove('hidden');
  renderWarehouse();
}
function closeWarehouse() {
  const win = document.getElementById('warehouse-window');
  if (win) win.classList.add('hidden');
}

// 讓 handle 可以拖曳 frame；拖曳後改用 left/top 定位，所以要先解掉置中的 transform
function makeDraggable(handle, frame) {
  if (!handle || !frame) return;
  let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
  handle.addEventListener('mousedown', e => {
    if (e.target.closest('button')) return;
    dragging = true;
    const r = frame.getBoundingClientRect();
    frame.style.transform = 'none';
    frame.style.left = r.left + 'px';
    frame.style.top = r.top + 'px';
    sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const nx = Math.max(0, Math.min(window.innerWidth - 80, ox + e.clientX - sx));
    const ny = Math.max(0, Math.min(window.innerHeight - 40, oy + e.clientY - sy));
    frame.style.left = nx + 'px';
    frame.style.top = ny + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}

function renderWarehouse() {
  const body = document.getElementById('warehouse-body');
  if (!body || !state) return;
  const wh = loadWarehouse();

  // 背包與倉庫共用同一套四分類與篩選
  const bagAll = state.inventory.filter(r => ITEMS[r.item]);
  const whAll = (wh.items || []).filter(r => ITEMS[r.item]);
  const inCat = list => list.filter(r => invCategoryOf(r.item) === whCategory);
  const applyFilters = list => {
    let out = inCat(list);
    if (whSub !== 'all') out = out.filter(r => invSubOf(r.item) === whSub);
    if (whSearch) out = out.filter(r => (ITEMS[r.item].name || '').toLowerCase().includes(whSearch));
    return out.sort((a, b) => (ITEMS[a.item].name || '').localeCompare(ITEMS[b.item].name || '', 'zh-Hant'));
  };
  const bagRows = applyFilters(bagAll);
  const whRows = applyFilters(whAll);

  const catCount = {};
  INV_CATEGORIES.forEach(c => { catCount[c.key] = 0; });
  bagAll.concat(whAll).forEach(r => { catCount[invCategoryOf(r.item)]++; });

  const subCount = {};
  inCat(bagAll).concat(inCat(whAll)).forEach(r => { const s = invSubOf(r.item); subCount[s] = (subCount[s] || 0) + 1; });
  const subKeys = Object.keys(subCount).sort((a, b) => subCount[b] - subCount[a]);

  const listHtml = (rows, side) => rows.length
    ? rows.map(r => {
        const d = ITEMS[r.item];
        const locked = side === 'bag' && isItemLocked(r.item);
        // 個體裝備：精煉度與卡片跟著這一件進出倉庫，不能走一般堆疊那條路
        if (r.instanceId) {
          const inst = side === 'bag' ? (state.instances || {})[r.instanceId] : r;
          if (!inst) return '';
          const refine = inst.refine || 0;
          const cards = inst.cards || [];
          const action = side === 'bag'
            ? `whDepositInstance('${r.instanceId}')`
            : `whWithdrawInstance('${r.instanceId}')`;
          return `<div class="wh-row" onclick="${action}">
            <img src="${itemImgSrc(r.item)}" onerror="this.onerror=null;this.src='${placeholderImgSrc(itemPlaceholderKind(d))}'">
            <span class="wh-row-name">${locked ? '🔒 ' : ''}${refine > 0 ? `+${refine} ` : ''}${getItemDisplayName(r.item)}${cards.length ? `　🃏${cards.length}` : ''}</span>
            <span class="wh-row-qty">×1</span>
          </div>`;
        }
        return `<div class="wh-row" onclick="${side === 'bag' ? `whDeposit('${r.item}',${r.qty})` : `whWithdraw('${r.item}',${r.qty})`}">
          <img src="${itemImgSrc(r.item)}" onerror="this.onerror=null;this.src='${placeholderImgSrc(itemPlaceholderKind(d))}'">
          <span class="wh-row-name">${locked ? '🔒 ' : ''}${getItemDisplayName(r.item)}</span>
          <span class="wh-row-qty">×${r.qty}</span>
        </div>`;
      }).join('')
    : `<div class="empty-hint">這個分類${side === 'bag' ? '背包' : '倉庫'}沒有東西。</div>`;

  body.innerHTML = `
    <div class="wh-hint">點背包物品＝存入　▶　　◀　點倉庫物品＝取出。數量欄留空＝整疊全部。</div>

    <div class="wh-gold">
      <span>鋅幣　背包 <b>${state.gold.toLocaleString()}</b>　倉庫 <b>${(wh.gold || 0).toLocaleString()}</b></span>
      <input type="number" id="wh-gold-amount" min="1" placeholder="金額" class="wh-gold-input">
      <button class="btn-small" onclick="depositGoldToWarehouse(document.getElementById('wh-gold-amount').value);renderWarehouse();renderTopBar();">存入 ▶</button>
      <button class="btn-small" onclick="withdrawGoldFromWarehouse(document.getElementById('wh-gold-amount').value);renderWarehouse();renderTopBar();">◀ 取出</button>
      <button class="btn-small ghost" onclick="depositGoldToWarehouse(state.gold);renderWarehouse();renderTopBar();">📥 全部</button>
      <button class="btn-small ghost" onclick="withdrawGoldFromWarehouse(loadWarehouse().gold||0);renderWarehouse();renderTopBar();">📤 全部</button>
    </div>

    <div class="inv-cats">${INV_CATEGORIES.map(c =>
      `<button class="btn-small ${whCategory === c.key ? 'active' : ''}" onclick="setWhCategory('${c.key}')">${c.icon} ${c.name} <span class="inv-cat-n">${catCount[c.key]}</span></button>`
    ).join('')}</div>

    <div class="wh-toolbar">
      <input id="wh-search" class="codex-search" type="text" placeholder="🔍 搜尋名稱…（存入取出共用）"
        value="${whSearch.replace(/"/g, '&quot;')}" oninput="onWhSearch(this.value)">
      <label class="wh-qty-label">數量 <input type="number" min="1" class="wh-qty" value="${whQty}" placeholder="全部" oninput="setWhQty(this.value)"></label>
    </div>

    ${subKeys.length > 1 ? `<div class="inv-subs">
      <button class="btn-chip ${whSub === 'all' ? 'active' : ''}" onclick="setWhSub('all')">全部</button>
      ${subKeys.map(s => `<button class="btn-chip ${whSub === s ? 'active' : ''}" onclick="setWhSub('${s}')">${invSubLabel(whCategory, s)} ${subCount[s]}</button>`).join('')}
    </div>` : ''}

    <div class="wh-cols">
      <div class="wh-col">
        <div class="wh-col-head">背包（點擊存入 ▶）</div>
        <div class="wh-list">${listHtml(bagRows, 'bag')}</div>
      </div>
      <div class="wh-col">
        <div class="wh-col-head">倉庫（點擊取出 ◀）　${whAll.length} 種</div>
        <div class="wh-list">${listHtml(whRows, 'wh')}</div>
      </div>
    </div>`;
}

/* ---------------- 自動販賣 UI ---------------- */
function showAutoSellPanel() {
  const el = document.getElementById('tab-inventory');
  if (!el) return;
  if (!state.autoSellConfig) state.autoSellConfig = { enabled: false, items: [] };
  const cfg = state.autoSellConfig;

  let html = `<h3 class="panel-title">🏷️ 自動販賣</h3>`;
  html += `<button class="btn-small" onclick="renderInventoryTab()">← 返回</button>`;

  const readyIn = Math.max(0, Math.ceil(((state.autoSellReadyAt || 0) - Date.now()) / 1000));
  html += `<div class="empty-hint">
    勾選要自動販賣的道具，啟用後每30秒自動賣出背包內所有已勾選道具（依原價）。
    ${cfg.enabled ? `目前已啟用，下次自動販賣倒數 ${readyIn}s。` : '目前尚未啟用。'}
  </div>`;
  html += `<div class="card-row">
    <label><input type="checkbox" ${cfg.enabled ? 'checked' : ''} onchange="setAutoSellEnabled(this.checked);showAutoSellPanel();"> 啟用自動販賣（每30秒）</label>
  </div>`;
  html += `<div class="card-row">
    <button class="btn-small" onclick="runAutoSellNow();showAutoSellPanel();renderTopBar();">立即手動販賣已選道具</button>
  </div>`;

  html += `<h3 class="panel-title">選擇要自動販賣的道具</h3>`;
  const invRows = state.inventory.filter(row => !row.instanceId && ITEMS[row.item] && ITEMS[row.item].sell > 0);
  if (invRows.length === 0) {
    html += `<div class="empty-hint">背包內沒有可販賣的道具。</div>`;
  } else {
    html += '<div class="card-list">';
    invRows.forEach(row => {
      const def = ITEMS[row.item];
      const name = getItemDisplayName(row.item);
      const checked = cfg.items.includes(row.item);
      html += `<div class="card-row">
        <label style="flex:1;display:flex;align-items:center;gap:6px">
          <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleAutoSellItem('${row.item}');showAutoSellPanel();">
          <span class="card-icon">${def.icon || '📦'}</span>
          <span class="card-name">${name} x${row.qty}（單價 ${def.sell}）</span>
        </label>
      </div>`;
    });
    html += '</div>';
  }
  el.innerHTML = html;
}

/* ---------------- 卡片系統 UI ---------------- */
// 拔卡會毀掉裝備，所以確認訊息要把代價講清楚，不能只問「確定移除嗎」
function doRemoveCard(slotKey) {
  const cards = getEquippedCards(slotKey);
  if (!cards.length) return;
  const equipId = getEquipBaseItemId(slotKey);
  const equipName = equipId && ITEMS[equipId] ? getItemDisplayName(equipId) : '裝備';
  const cardNames = cards.map(id => CARDS[id] ? CARDS[id].name : id).join('、');
  const msg = `要從「${equipName}」取出卡片嗎？\n\n`
    + `✅ 取回：${cardNames}\n`
    + `❌ 損毀：${equipName}（含精煉度，無法復原）`;
  if (confirm(msg)) {
    removeCard(slotKey);
    refreshEquipViews();
    renderTopBar();
  }
}

// 背包裡那件個體裝備的拆卸，代價跟身上那件一樣：裝備銷毀換回卡片
function doDestroyInstance(instanceId) {
  const inst = state.instances ? state.instances[instanceId] : null;
  if (!inst || !inst.cards || !inst.cards.length) return;
  const equipName = ITEMS[inst.item] ? getItemDisplayName(inst.item) : '裝備';
  const cardNames = inst.cards.map(id => CARDS[id] ? CARDS[id].name : id).join('、');
  const msg = `要拆卸「${inst.refine > 0 ? '+' + inst.refine + ' ' : ''}${equipName}」取回卡片嗎？\n\n`
    + `✅ 取回：${cardNames}\n`
    + `❌ 損毀：${equipName}（含精煉度，無法復原）`;
  if (confirm(msg)) {
    destroyInstanceForCards(instanceId);
    refreshEquipViews();
    renderTopBar();
  }
}

// 插卡入口在裝備欄上，而裝備欄住在「裝備」分頁，所以這個選單也畫在那裡
function showCardSelect(slotKey) {
  const el = document.getElementById('tab-equip');
  if (!el) return;

  const equipId = getEquipBaseItemId(slotKey);
  const equipName = equipId && ITEMS[equipId] ? getItemDisplayName(equipId) : '（無裝備）';
  const maxSlots = getEquipCardSlots(slotKey);
  const used = getEquippedCards(slotKey);

  // 只列出這個部位真的插得進去的卡片
  const availableCards = state.inventory
    .filter(row => !row.instanceId && CARDS[row.item] && row.qty > 0)
    .map(row => ({ cardId: row.item, qty: row.qty, card: CARDS[row.item] }))
    .filter(c => cardFitsSlot(c.card, slotKey));

  let html = `<h3 class="panel-title">🃏 ${equipName}　插槽 ${used.length}/${maxSlots}</h3>`;
  html += `<button class="btn-small" onclick="renderEquipTab()">← 返回裝備欄</button>`;

  if (used.length) {
    html += '<div class="codex-detail-sec">已插入</div><div class="card-list">';
    used.forEach(id => {
      const c = CARDS[id];
      html += `<div class="card-row inserted">
        <div class="card-info">
          <span class="card-icon">${c.icon}</span>
          <div class="card-details">
            <span class="card-name">${c.name}</span>
            <span class="card-desc">${c.desc}</span>
          </div>
        </div>
      </div>`;
    });
    html += '</div>';
    html += `<div class="card-warn">⚠️ 取出卡片會讓 ${equipName} 損毀。要取出請回上一頁點「取出卡片」。</div>`;
  }

  if (used.length >= maxSlots) {
    html += `<div class="empty-hint">插槽已滿（${maxSlots}/${maxSlots}）。</div>`;
  } else if (availableCards.length === 0) {
    html += `<div class="empty-hint">背包裡沒有能插在這個部位的卡片。</div>`;
  } else {
    html += '<div class="codex-detail-sec">可插入</div><div class="card-list">';
    availableCards.forEach(c => {
      html += `<div class="card-row">
        <div class="card-info">
          <span class="card-icon">${c.card.icon}</span>
          <div class="card-details">
            <span class="card-name">${c.card.name} x${c.qty}</span>
            <span class="card-desc">${c.card.desc}</span>
          </div>
        </div>
        <button class="btn-small" onclick="insertCard('${slotKey}','${c.cardId}');showCardSelect('${slotKey}');">插卡</button>
      </div>`;
    });
    html += '</div>';
  }

  el.innerHTML = html;
}
