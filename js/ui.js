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
  if (name === 'inventory') renderInventoryTab();
  if (name === 'jobtree') renderJobTree();
  if (name === 'character') renderCharacterTab();
  if (name === 'npc') renderNpcTab();
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
        <div class="town-npc-card" onclick="switchTab('npc');openNpcShop('weapon');">
          <div class="town-npc-icon">⚔️</div>
          <div class="town-npc-name">武器商人</div>
          <div class="town-npc-hint">購買各種武器</div>
        </div>
        <div class="town-npc-card" onclick="switchTab('npc');openNpcShop('armor');">
          <div class="town-npc-icon">🛡️</div>
          <div class="town-npc-name">防具商人</div>
          <div class="town-npc-hint">購買各種防具</div>
        </div>
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
      if (lv && ['buff_atk', 'buff_def', 'buff_aspd', 'buff_flee', 'buff_gold', 'buff_crit', 'buff_poison', 'buff_statpct', 'debuff_def', 'debuff', 'heal', 'heal_over_time'].includes(sk.type) && !sk.isQuest) {
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

/* ---------------- NPC 商店分頁 ---------------- */
function renderNpcTab() {
  const el = document.getElementById('tab-npc');
  if (!isInTown()) {
    el.innerHTML = '<div class="empty-hint">🏪 請先前往城鎮才能使用 NPC 商店。</div>';
    return;
  }

  let html = '<h3 class="panel-title">🏪 NPC 商店</h3>';
  html += '<div class="npc-shop-list">';

  Object.keys(NPC_SHOPS).forEach(shopId => {
    const shop = NPC_SHOPS[shopId];
    const itemCount = shop.getItems().length;
    html += `<div class="npc-shop-card" onclick="openNpcShop('${shopId}')">
      <div class="npc-shop-icon">${shop.icon}</div>
      <div class="npc-shop-info">
        <div class="npc-shop-name">${shop.name}</div>
        <div class="npc-shop-count">${itemCount} 項商品</div>
      </div>
      <div class="npc-shop-arrow">▶</div>
    </div>`;
  });

  html += '</div>';
  el.innerHTML = html;
}

/* ---------------- 背包分頁 ---------------- */
function renderInventoryTab() {
  const el = document.getElementById('tab-inventory');
  if (!el) return;

  hideEquipTooltip();

  try {
    // 10 格裝備視窗
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
    const weaponId = state.equip.weapon;
    const isWeaponTwoHanded = isTwoHanded(weaponId);

    let equipHtml = '<div class="ro-equip-grid">';
    equipSlotDefs.forEach(slot => {
      // 雙手武器時，盾牌欄顯示為被佔用
      if (slot.key === 'shield' && isWeaponTwoHanded) {
        equipHtml += `<div class="ro-equip-slot has-item" style="opacity:0.5"
          onmouseenter="showEquipTooltip(event,'weapon')"
          onmouseleave="hideEquipTooltip()"
        >
          <div class="slot-label">${slot.name}</div>
          <div class="slot-name" style="font-size:9px;color:var(--ink-dim)">雙手武器佔用</div>
        </div>`;
        return;
      }

      const itemId = state.equip[slot.key];
      const item = itemId ? ITEMS[itemId] : null;
      const refLevel = itemId ? getRefinementLevel(itemId) : 0;
      const hasItem = !!item;
      const iconHtml = item
        ? `<img class="slot-icon" src="${itemImgSrc(itemId)}" onerror="this.onerror=null;this.src='${placeholderImgSrc('armor')}'">`
        : `<div class="slot-empty">${slot.icon}</div>`;
      const nameHtml = hasItem ? `<div class="slot-name">${getItemDisplayName(itemId)}</div>` : '';
      const refHtml = refLevel > 0 ? `<div class="slot-refine">+${refLevel}</div>` : '';

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
      </div>`;
    });
    equipHtml += '</div>';

    // 背包列表
    const items = state.inventory.map(row => {
      const def = ITEMS[row.item];
      if (!def) return '';
      const displayName = getItemDisplayName(row.item);
      const canUse = def.type === 'consumable' || def.type === 'weapon' || def.type === 'armor';
      const elemTag = def.element ? ` ${ELEMENT_ICONS[def.element]}${ELEMENT_NAMES[def.element]}` : '';
      return `<div class="inv-row">
        <div class="inv-icon"><img src="${itemImgSrc(row.item)}" alt="${displayName}" onerror="this.onerror=null;this.src='${placeholderImgSrc(itemPlaceholderKind(def))}'"></div>
        <div class="inv-info"><div class="inv-name">${displayName} x${row.qty}${elemTag}</div><div class="inv-desc">${def.desc}</div></div>
        <div class="inv-actions">
          ${canUse ? `<button class="btn-small" onclick="useItem('${row.item}');renderInventoryTab();">${def.type === 'consumable' ? '使用' : '裝備'}</button>` : ''}
          <button class="btn-small ghost" onclick="sellItem('${row.item}',1);renderInventoryTab();renderTopBar();">賣出(${def.sell})</button>
          <button class="btn-small ghost" onclick="depositToWarehouse('${row.item}',1);renderInventoryTab();renderTopBar();">存倉庫</button>
        </div>
      </div>`;
    }).filter(html => html).join('');

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

    el.innerHTML = `<h3 class="panel-title">裝備欄</h3>${equipHtml}${vendingHtml}${craftingHtml}${warehouseHtml}<h3 class="panel-title">背包（${state.inventory.length}）</h3><div class="inv-list">${items || '<div class="empty-hint">背包空空如也，去打怪蒐集素材吧！</div>'}</div><div id="ro-equip-tooltip" class="ro-equip-tooltip"></div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty-hint">背包載入錯誤：${e.message}</div>`;
    console.error('renderInventoryTab error:', e);
  }
}

/* ---- 裝備視窗：hover 提示 ---- */
const _equipClickTimers = {};

function showEquipTooltip(event, slotKey) {
  const itemId = state.equip[slotKey];
  if (!itemId) return;
  const item = ITEMS[itemId];
  if (!item) return;
  const tt = document.getElementById('ro-equip-tooltip');
  if (!tt) return;

  const refLevel = getRefinementLevel(itemId);
  const cardId = getEquippedCard(slotKey);
  const card = cardId ? CARDS[cardId] : null;

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
  if (card) html += `<div class="tt-card">🃏 ${card.name}</div>`;
  html += `<div class="tt-hint">點擊 2 次卸下裝備</div>`;

  tt.innerHTML = html;
  tt.classList.add('show');

  // 定位：在滑鼠附近
  const slotEl = event.target.closest('.ro-equip-slot');
  if (slotEl) {
    const rect = slotEl.getBoundingClientRect();
    let left = rect.right + 8;
    let top = rect.top;
    // 防止超出右側
    if (left + 280 > window.innerWidth) left = rect.left - 288;
    // 防止超出底部
    if (top + 200 > window.innerHeight) top = window.innerHeight - 210;
    tt.style.left = left + 'px';
    tt.style.top = top + 'px';
  }
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
    renderInventoryTab();
    renderTopBar();
  } else {
    // 第一次點擊：提示
    _equipClickTimers[slotKey] = now;
    const tt = document.getElementById('ro-equip-tooltip');
    if (tt) {
      const item = ITEMS[itemId];
      const hint = tt.querySelector('.tt-hint');
      if (hint) hint.textContent = `再點一次卸下 ${item ? item.name : '裝備'}`;
      tt.classList.add('show');
    }
  }
}

/* ---------------- 角色分頁 ---------------- */
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
        return `
        <div class="stat-row">
          <div class="stat-label">${STAT_NAMES[k]}</div>
          <div class="stat-value">${state.stats[k]}${bonus > 0 ? `<span style="color:#4fc3f7">+${bonus}</span>` : ''}</div>
          <div class="stat-cost">-${cost}</div>
          <button class="btn-tiny" ${canAfford ? '' : 'disabled'} onclick="allocateStat('${k}');renderCharacterTab();renderTopBar();">+</button>
        </div>`;
      }).join('')}
    </div>
    <div class="stat-points-left">可分配屬性點：${state.statPoints}</div>
    ${buffListHtml}
    <div class="derived-grid">
      <div>物理攻擊 ATK：${state.atk}${(() => { const r = getRefinementLevel(state.equip.weapon); const wLv = state.equip.weapon ? (ITEMS[state.equip.weapon].weaponLv || 1) : 1; return r > 0 ? ` (+${getRefinementAtkBonus(r, wLv)}精煉)` : ''; })()}</div>
      <div>魔法攻擊 MATK：${state.matkMin}~${state.matkMax}</div>
      <div>防禦 DEF：${state.def}${(() => { let refBonus = 0; ['head_top','head_mid','head_bottom','armor','shield','garment','footgear','accessory1','accessory2'].forEach(s => { const lv = getRefinementLevel(state.equip[s]); if (lv > 0) refBonus += getRefinementDefBonus(lv); }); return refBonus > 0 ? ` (+${refBonus}精煉)` : ''; })()}</div>
      <div>攻擊速度 ASPD：${state.aspd}${state.buffs.some(b => b.type === 'aspd') ? ' <span class="buff-active">BUFF</span>' : ''}</div>
      <div>攻擊間隔：${(state.attackInterval / 1000).toFixed(2)} 秒</div>
      <div>命中 HIT：${effectiveHit}${effectiveHit > state.hit ? ` <span class="buff-active">(+${effectiveHit - state.hit})</span>` : ''}</div>
      <div>迴避 FLEE：${state.flee}</div>
      <div>暴擊率：${effectiveCritRate}%${effectiveCritRate > state.critRate ? ` <span class="buff-active">(+${effectiveCritRate - state.critRate})</span>` : ''}</div>
      <div>完全迴避：${state.perfectDodge}%</div>
      <div>武器屬性：${(() => { const w = state.equip.weapon ? ITEMS[state.equip.weapon] : null; const el = w && w.element ? w.element : 'none'; return ELEMENT_ICONS[el] + ' ' + ELEMENT_NAMES[el]; })()}</div>
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
  const itemId = state.equip[slotKey];
  if (!itemId) return;
  const item = ITEMS[itemId];
  const currentLevel = getRefinementLevel(itemId);
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
    const invRow = state.inventory.find(r => r.item === mat.id);
    return invRow && invRow.qty > 1;
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
    const invRow = state.inventory.find(r => r.item === mat.id);
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
    const success = refineItem(itemId, matKey);
    if (success) {
      showToast(`🔨 精煉成功！${item.name} +${currentLevel + 1}`);
    } else {
      showToast(`💥 精煉失敗！${item.name} 維持 +${currentLevel}`);
    }
    renderInventoryTab();
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
function showWarehousePanel() {
  const el = document.getElementById('tab-inventory');
  if (!el) return;
  const wh = loadWarehouse();

  let html = `<h3 class="panel-title">📦 倉庫（跨角色共用）</h3>`;
  html += `<button class="btn-small" onclick="renderInventoryTab()">← 返回</button>`;

  html += `<h3 class="panel-title">背包 → 存入倉庫</h3>`;
  const invRows = state.inventory.filter(row => ITEMS[row.item]);
  if (invRows.length === 0) {
    html += `<div class="empty-hint">背包是空的。</div>`;
  } else {
    html += '<div class="card-list">';
    invRows.forEach(row => {
      const name = getItemDisplayName(row.item);
      html += `<div class="card-row">
        <div class="card-info">
          <span class="card-icon">${ITEMS[row.item].icon || '📦'}</span>
          <div class="card-details"><span class="card-name">${name} x${row.qty}</span></div>
        </div>
        <button class="btn-small" onclick="depositToWarehouse('${row.item}',1);showWarehousePanel();">存入</button>
      </div>`;
    });
    html += '</div>';
  }

  html += `<h3 class="panel-title">倉庫 → 領出背包</h3>`;
  if (!wh.items || wh.items.length === 0) {
    html += `<div class="empty-hint">倉庫是空的。</div>`;
  } else {
    html += '<div class="card-list">';
    wh.items.forEach(row => {
      const def = ITEMS[row.item];
      if (!def) return;
      const name = getItemDisplayName(row.item);
      html += `<div class="card-row">
        <div class="card-info">
          <span class="card-icon">${def.icon || '📦'}</span>
          <div class="card-details"><span class="card-name">${name} x${row.qty}</span></div>
        </div>
        <button class="btn-small" onclick="withdrawFromWarehouse('${row.item}',1);showWarehousePanel();renderTopBar();">領出</button>
      </div>`;
    });
    html += '</div>';
  }
  el.innerHTML = html;
}

/* ---------------- 卡片系統 UI ---------------- */
function doRemoveCard(slotKey) {
  if (confirm('確定要移除卡片嗎？')) {
    removeCard(slotKey);
    renderInventoryTab();
    renderTopBar();
  }
}

function showCardSelect(slotKey) {
  const el = document.getElementById('tab-inventory');
  if (!el) return;

  // 從背包中篩選可用的卡片
  const availableCards = state.inventory
    .filter(row => CARDS[row.item] && row.qty > 0)
    .map(row => ({ cardId: row.item, qty: row.qty, card: CARDS[row.item] }))
    .filter(c => {
      // 檢查卡槽限制
      if (c.card.slot === 'weapon' && slotKey !== 'weapon') return false;
      if (c.card.slot === 'armor' && !['head_top', 'head_mid', 'head_bottom', 'armor', 'shield', 'garment', 'footgear'].includes(slotKey)) return false;
      return true;
    });

  let html = `<h3 class="panel-title">🃏 選擇卡片</h3>`;
  html += `<button class="btn-small" onclick="renderInventoryTab()">← 返回</button>`;

  if (availableCards.length === 0) {
    html += `<div class="empty-hint">背包中沒有可用的卡片。打怪有機率掉落卡片！</div>`;
  } else {
    html += '<div class="card-list">';
    availableCards.forEach(c => {
      html += `<div class="card-row">
        <div class="card-info">
          <span class="card-icon">${c.card.icon}</span>
          <div class="card-details">
            <span class="card-name">${c.card.name} x${c.qty}</span>
            <span class="card-desc">${c.card.desc}</span>
          </div>
        </div>
        <button class="btn-small" onclick="insertCard('${slotKey}','${c.cardId}');renderInventoryTab();">插卡</button>
      </div>`;
    });
    html += '</div>';
  }

  el.innerHTML = html;
}
