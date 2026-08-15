'use strict';

/* ============ DeepSeek 鲸鱼桌宠 v3 ============ */

(() => {
  const root = document.getElementById('pet-root');
  const wrap = document.getElementById('whale-wrap');
  const bubble = document.getElementById('bubble');
  const elState = document.getElementById('b-state');
  const elTime = document.getElementById('b-time');
  const elTitle = document.getElementById('b-title');
  const elGoal = document.getElementById('b-goal');
  const elStats = document.getElementById('b-stats');

  const STATE_LABEL = {
    offline: '离线', idle: '空闲', sleep: '睡觉', yawn: '打哈欠', working: '工作中',
    planning: '思考中', awaiting: '等待确认', excited: '来活了', happy: '任务完成',
    sad: '出错了', confused: '有点懵', hungry: '饿了', overheat: '过热中',
    scared: '吓一跳', shy: '害羞', poke: '被戳', dragging: '拖动中',
  };
  const EN_STATE_LABEL = { offline: 'Offline', idle: 'Idle', sleep: 'Sleeping', yawn: 'Yawning', working: 'Working', planning: 'Planning', awaiting: 'Needs you', excited: 'Excited', happy: 'Complete', sad: 'Error', confused: 'Confused', hungry: 'Hungry', overheat: 'Overheated', scared: 'Startled', shy: 'Shy', poke: 'Poked', dragging: 'Moving' };
  const english = /^en/i.test(navigator.language || '');
  if (english) {
    document.getElementById('act-start-dsh').textContent = '▶️ Run DSH';
    document.getElementById('act-start-dsh').title = 'Start local DSH Web';
    document.getElementById('act-web').textContent = '🌐 Open Web';
    document.getElementById('act-dir').textContent = '📂 Folder';
    document.getElementById('act-refresh').title = 'Refresh status';
  }

  const LINES = {
    idle: ['好闲啊…', '等你派活~', '摸鱼中，勿扰', '要不要聊聊天？'],
    sleep: ['呼噜呼噜…', 'Zzz…', '梦中写代码…'],
    yawn: ['哈啊…好困', '打工人困了…'],
    working: ['开始干活！💪', '敲代码中…', '这个 bug 有点难搞', '再来一杯咖啡就完美了', '正在全力输出！'],
    planning: ['让我先捋一捋…', '计划中，别急~', '脑子里有个大计划！'],
    awaiting: ['需要你确认一下！', '快看我快看我！', '等你点头呢~', '有个问题要问你！'],
    excited: ['来活了来活了！', '新任务冲冲冲！'],
    happy: ['搞定！🎉', '任务完成！', '小菜一碟~', '夸我夸我！'],
    sad: ['出错了…呜呜', '失败了，好难过', '让我再试一次…'],
    confused: ['这是什么意思？', '有点懵…', '让我缓缓…'],
    hungry: ['好饿…', '什么时候干饭？', '小鱼干呢…'],
    overheat: ['有点烫…', '让我缓缓', 'CPU 冒烟了！'],
    scared: ['哇！', '吓我一跳！'],
    shy: ['别夸我啦~', '好害羞…'],
    poke: ['干嘛呀~', '嗷！', '别戳我！', '痒痒的…', '再戳我要喷水了！', '咕噜咕噜…'],
  };

  let state = 'offline';
  let desired = 'offline';
  let snapshot = null;
  let demoMode = false;
  let demoTimer = null;
  const DEMO_SEQUENCE = ['idle', 'yawn', 'sleep', 'working', 'planning', 'awaiting', 'excited', 'happy', 'sad', 'confused', 'hungry', 'overheat', 'scared', 'shy', 'poke', 'dragging', 'offline'];
  let pendingApprovals = 0;
  let pendingQuestions = 0;
  let transientTimer = null;
  let speechTimer = null;
  let bubbleShown = false;
  let drag = null;
  let pokeTimer = null;
  let firstRender = true;
  let lastRunWasWorking = false;
  let idleSince = 0;
  let workSince = 0;
  let lastFedAt = Date.now();
  let hungryShown = false;
  let overheatOn = false;
  let soundOn = false;

  function applyStyle(style) {
    root.dataset.style = ['classic', 'candy', 'night', 'pixel'].includes(style) ? style : 'classic';
  }

  /* ------------------------- 音效 (WebAudio, 默认关) ------------------------- */

  const sfx = (() => {
    let ctx = null;
    let master = null;
    function ensure() {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.09;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(freq, dur, type = 'sine', vol = 1, when = 0, slideTo = null) {
      if (!soundOn) return;
      try {
        const c = ensure();
        const t0 = c.currentTime + when;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t0);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(master);
        o.start(t0); o.stop(t0 + dur + 0.02);
      } catch { /* noop */ }
    }
    function noise(dur, vol = 1, when = 0) {
      if (!soundOn) return;
      try {
        const c = ensure();
        const t0 = c.currentTime + when;
        const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const src = c.createBufferSource(); src.buffer = buf;
        const g = c.createGain(); g.gain.value = vol;
        src.connect(g); g.connect(master);
        src.start(t0);
      } catch { /* noop */ }
    }
    return {
      key() { tone(1400, 0.03, 'square', 0.35); },
      yawn() { tone(420, 0.9, 'sine', 0.5, 0, 150); },
      snore() { tone(95, 0.5, 'triangle', 0.5, 0, 80); },
      ding() { tone(880, 0.25, 'sine', 0.7); tone(1318, 0.35, 'sine', 0.6, 0.12); },
      pop() { tone(600, 0.07, 'sine', 0.5, 0, 900); },
      boing() { tone(220, 0.35, 'square', 0.4, 0, 660); noise(0.12, 0.3); },
      gulp() { tone(180, 0.16, 'sine', 0.6, 0, 120); },
    };
  })();

  window.pet.getSound && window.pet.getSound().then((v) => { soundOn = !!v; });
  window.pet.onSound && window.pet.onSound((v) => { soundOn = !!v; });
  window.pet.getStyle && window.pet.getStyle().then(applyStyle);
  window.pet.onStyle && window.pet.onStyle(applyStyle);

  /* ------------------------- 状态计算 ------------------------- */

  function desiredFromSnapshot(s) {
    if (!s || !s.online) return 'offline';
    if (pendingApprovals > 0 || pendingQuestions > 0) return 'awaiting';
    const sess = s.session;
    if (!sess) return 'idle';
    if (sess.running) return sess.planActive ? 'planning' : 'working';
    return 'idle';
  }

  function setStateClasses(next) {
    for (const cls of Array.from(wrap.classList)) {
      if (cls.startsWith('st-')) wrap.classList.remove(cls);
    }
    wrap.classList.add('st-' + next);
    root.classList.remove('offline', 'awaiting', 'sad');
    if (next === 'offline') root.classList.add('offline');
    if (next === 'awaiting') root.classList.add('awaiting');
    if (next === 'sad') root.classList.add('sad');
    elState.textContent = (english ? EN_STATE_LABEL[next] : STATE_LABEL[next]) || next;
  }

  function applyState(next, opts = {}) {
    const changed = state !== next;
    state = next;
    clearTimeout(transientTimer);
    setStateClasses(next);

    if (next === 'overheat') {
      overheatOn = true;
      if (changed && !opts.silent && !firstRender) speak('overheat');
    } else if (overheatOn && next !== 'working') {
      overheatOn = false;
    }

    if (changed && next !== 'idle' && !opts.silent && !firstRender && LINES[next]) {
      if (next === 'sleep') sfx.snore();
      if (next === 'yawn') sfx.yawn();
      if (next === 'happy') sfx.ding();
      if (next === 'scared') sfx.boing();
      if (next === 'hungry') sfx.gulp();
      if (next === 'working') scheduleKeySounds();
      // 打哈欠 / 睡觉只做动作和音效, 不弹气泡
      if (next !== 'sleep' && next !== 'yawn') speak(next);
    }
    firstRender = false;

    if (next === 'happy' || next === 'sad' || next === 'scared' || next === 'excited' || next === 'yawn' || next === 'shy' || next === 'hungry' || next === 'overheat') {
      if (demoMode) return; // 演示模式: 由 demo 定时器控制切换
      const dur = opts.duration || { happy: 5000, sad: 6000, scared: 1600, excited: 3000, yawn: 3600, shy: 2500, hungry: 20000, overheat: 20000 }[next] || 3000;
      transientTimer = setTimeout(() => {
        if (next === 'yawn') { applyState('sleep', { silent: true }); return; }
        applyState(desiredFromSnapshot(snapshot), { silent: true });
      }, dur);
    }
  }

  let keySfxTimer = null;
  function scheduleKeySounds() {
    clearInterval(keySfxTimer);
    keySfxTimer = setInterval(() => { if (state === 'working') sfx.key(); }, 520);
  }

  function applySnapshot(s) {
    snapshot = s;
    if (demoMode) return; // 演示模式不响应真实状态
    const d = desiredFromSnapshot(s);
    desired = d;

    // 工作 → 停止: 完成
    if (s?.online && s.session && !s.session.running && lastRunWasWorking && s.session.steps > 0) {
      lastRunWasWorking = false;
      lastFedAt = Date.now();
      hungryShown = false;
      applyState('happy');
      return;
    }
    // 空闲 → 开始工作: 兴奋一下
    if (s?.online && s.session?.running && !lastRunWasWorking) {
      applyState('excited');
      lastRunWasWorking = true;
      workSince = Date.now();
      return;
    }
    lastRunWasWorking = !!(s?.online && s.session?.running);

    // 过热: 连续工作 > 30min
    if (d === 'working' && Date.now() - workSince > 30 * 60 * 1000 && !overheatOn && Math.random() < 0.5) {
      applyState('overheat', { silent: true });
      return;
    }
    // 饥饿: 空闲 > 1h, 随机冒泡 20s
    if (d === 'idle' && Date.now() - lastFedAt > 60 * 60 * 1000 && !hungryShown && Math.random() < 0.3) {
      hungryShown = true;
      applyState('hungry', { duration: 20000, silent: false });
      return;
    }

    if (state === 'happy' || state === 'sad' || state === 'scared' || state === 'excited' || state === 'shy') return;
    applyState(d);
    updateBubble(s);
    if (d === 'idle' && !bubbleShown) bubble.classList.remove('show');
  }

  function speak(key) {
    const lines = LINES[key];
    if (!lines) return;
    showSpeech(lines[Math.floor(Math.random() * lines.length)]);
  }

  /* ------------------------- 气泡 ------------------------- */

  function showSpeech(text, ms = 2600) {
    elTitle.textContent = text;
    elGoal.classList.add('hidden');
    elStats.innerHTML = '';
    bubble.classList.add('show');
    clearTimeout(speechTimer);
    speechTimer = setTimeout(() => { if (!bubbleShown) bubble.classList.remove('show'); }, ms);
  }

  function updateBubble(s) {
    if (!s || !s.online) {
      elState.textContent = english ? 'Offline' : '离线';
      elTitle.textContent = english ? 'DeepSeek Harness is not connected' : 'DeepSeek Harness 未连接';
      elGoal.classList.add('hidden');
      elStats.textContent = english ? 'Run dsh web, or use the tray menu.' : '请先运行 dsh web, 或在托盘菜单中检查。';
      return;
    }
    const sess = s.session;
    if (!sess) {
      elState.textContent = '空闲';
      elTitle.textContent = '暂无活跃会话';
      elGoal.classList.add('hidden');
      const h = s.host || {};
      elStats.textContent = h.model ? `模型 ${h.model} · 待命` : '待命';
      return;
    }
    if (sess.title) elTitle.textContent = sess.title;
    else if (sess.running) elTitle.textContent = '正在思考中…';
    else elTitle.textContent = '空闲中 · 等待新任务';
    if (sess.goal) {
      elGoal.textContent = '🎯 ' + (typeof sess.goal === 'string' ? sess.goal : '进行中');
      elGoal.classList.remove('hidden');
    } else elGoal.classList.add('hidden');
    const h = s.host || {};
    const bits = [];
    if (h.model) bits.push(`模型 <b>${h.model}</b>`);
    if (sess.steps > 0) bits.push(`${sess.steps} 步`);
    if (sess.outputTokens > 0) bits.push(`输出 <b>${fmtTokens(sess.outputTokens)}</b> tokens`);
    if (sess.contextPct != null) bits.push(`上下文 <b>${sess.contextPct}%</b>`);
    if (sess.planActive) bits.push(`📋 计划中`);
    elStats.innerHTML = bits.length ? bits.join(' · ') : '已就绪';
    elTime.textContent = new Date(s.updatedAt || Date.now()).toLocaleTimeString('zh-CN', { hour12: false });
  }

  function fmtTokens(n) {
    if (n == null) return null;
    return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
  }

  /* ------------------------- 实时事件 ------------------------- */

  let errorStreak = 0;
  function onEvent(frame) {
    if (!frame || typeof frame.type !== 'string') return;
    switch (frame.type) {
      case 'approval/requested':
        pendingApprovals += 1;
        if (state === 'sleep') {
          applyState('scared', { silent: true });
          showSpeech('哇！', 1500);
          setTimeout(() => { applyState('awaiting'); showSpeech('🧐 需要你确认一个操作…'); }, 1600);
        } else {
          applyState('awaiting');
          showSpeech('🧐 需要你确认一个操作…');
        }
        break;
      case 'approval/resolved':
        pendingApprovals = Math.max(0, pendingApprovals - 1);
        applyState(desiredFromSnapshot(snapshot));
        break;
      case 'question/requested':
        pendingQuestions += 1;
        applyState('awaiting');
        showSpeech('❓ 有个问题要问你！');
        break;
      case 'question/resolved':
        pendingQuestions = Math.max(0, pendingQuestions - 1);
        applyState(desiredFromSnapshot(snapshot));
        break;
      case 'host/agent-error':
        errorStreak += 1;
        if (errorStreak >= 2 && Math.random() < 0.5) {
          applyState('confused', { duration: 4000 });
          showSpeech('连续出错，我有点懵…', 4000);
        } else {
          applyState('sad', { duration: 6000 });
          showSpeech('😢 出错了: ' + (frame.message || '未知错误'), 5000);
        }
        break;
      default:
        if (frame.type === 'session/event' && frame.event?.type === 'tool/result' && frame.event?.data?.isError) {
          errorStreak += 1;
        } else if (frame.type === 'session/event' && frame.event?.type === 'assistant/message') {
          errorStreak = 0;
        }
    }
  }

  /* ------------------------- 眼睛跟随 ------------------------- */

  let lastMouse = { x: -9999, y: -9999 };
  let hoverTimer = null;
  const pupils = () => Array.from(document.querySelectorAll('.eye .pupil, .eye.big .pupil'));

  window.addEventListener('mousemove', (e) => {
    const r = root.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 140) {
      const max = 4.5;
      const k = Math.min(1, 1 - dist / 140);
      const px = (dx / (dist || 1)) * max * k;
      const py = (dy / (dist || 1)) * max * k;
      pupils().forEach((p) => { p.style.transform = `translate(${px}px, ${py}px)`; });
      // 光标过顶: 悄悄歪头
      wrap.classList.toggle('head-tilt', dy < -70 && k > 0.6);
      if (!hoverTimer && dist < 40) {
        hoverTimer = setTimeout(() => {
          if (dist < 40 && state === 'idle') {
            wrap.classList.add('head-tilt');
            showSpeech('?', 1800);
          }
          hoverTimer = null;
        }, 3000);
      }
    } else {
      pupils().forEach((p) => { p.style.transform = 'translate(0, 0)'; });
      wrap.classList.remove('head-tilt');
    }
    lastMouse = { x: e.clientX, y: e.clientY };
  });

  /* ------------------------- 交互 ------------------------- */

  function poke() {
    clearTimeout(pokeTimer);
    const shy = Math.random() < 0.2;
    if (shy) {
      applyState('shy', { silent: true });
      sfx.pop();
      showSpeech(LINES.shy[Math.floor(Math.random() * LINES.shy.length)], 2200);
      pokeTimer = setTimeout(() => applyState(desiredFromSnapshot(snapshot), { silent: true }), 2600);
    } else {
      wrap.classList.add('st-poke');
      sfx.pop();
      showSpeech(LINES.poke[Math.floor(Math.random() * LINES.poke.length)], 2200);
      pokeTimer = setTimeout(() => wrap.classList.remove('st-poke'), 550);
    }
  }

  wrap.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, .b-actions')) return;
    if (bubbleShown && e.target.closest('#bubble')) return;
    drag = { lastX: e.screenX, lastY: e.screenY, moved: false };
    root.classList.add('dragging');
    wrap.classList.add('st-dragging');
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const dx = e.screenX - drag.lastX;
    const dy = e.screenY - drag.lastY;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    drag.moved = true;
    drag.lastX = e.screenX;
    drag.lastY = e.screenY;
    window.pet.moveBy(dx, dy);
  });

  window.addEventListener('mouseup', () => {
    if (!drag) return;
    const wasMove = drag.moved;
    drag = null;
    root.classList.remove('dragging');
    wrap.classList.remove('st-dragging');
    if (!wasMove) poke();
  });

  wrap.addEventListener('dblclick', () => window.pet.openWeb());
  wrap.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.pet.menu();
  });

  document.getElementById('act-web').addEventListener('click', (e) => { e.stopPropagation(); window.pet.openWeb(); });
  document.getElementById('act-start-dsh').addEventListener('click', async (e) => {
    e.stopPropagation();
    const button = e.currentTarget;
    button.disabled = true;
    button.textContent = '⏳ 启动中…';
    try { await window.pet.startDsh(); } catch (err) { showSpeech((english ? 'DSH could not start: ' : 'DSH 启动失败：') + (err?.message || 'unknown error'), 5000); } finally { setTimeout(() => { button.disabled = false; button.textContent = english ? '▶️ Run DSH' : '▶️ 运行 DSH'; }, 2200); }
  });
  document.getElementById('act-dir').addEventListener('click', (e) => { e.stopPropagation(); window.pet.openWorkspace(); });
  document.getElementById('act-refresh').addEventListener('click', (e) => { e.stopPropagation(); window.pet.refresh(); });

  /* ------------------------- 启动 ------------------------- */

  window.pet.onState((s) => applySnapshot(s));
  window.pet.onEvent((f) => onEvent(f));
  window.pet.onClickThrough((enabled) => { root.style.pointerEvents = enabled ? 'none' : 'auto'; });
  window.pet.onWs((info) => { if (info?.connected === true) window.pet.refresh(); });
  window.pet.onDshError && window.pet.onDshError((message) => showSpeech((english ? 'DSH error: ' : 'DSH 错误：') + message, 7000));
  window.pet.refresh();

  // 形态演示: 循环播放所有状态
  window.pet.onDemo((on) => {
    demoMode = !!on;
    clearInterval(demoTimer);
    demoTimer = null;
    if (demoMode) {
      let i = 0;
      const step = () => {
        const s = DEMO_SEQUENCE[i % DEMO_SEQUENCE.length];
        i += 1;
        applyState(s, { silent: true });
        const label = STATE_LABEL[s] || s;
        const line = (LINES[s] && LINES[s][0]) ? '「' + LINES[s][0] + '」' : '';
        showSpeech(`【演示 ${i}/${DEMO_SEQUENCE.length}】${label} ${line}`, 3600);
      };
      step();
      demoTimer = setInterval(step, 4000);
    } else {
      applyState(desiredFromSnapshot(snapshot), { silent: true });
      updateBubble(snapshot);
    }
  });

  // 空闲 → 打哈欠 → 睡觉
  setInterval(() => {
    if (desired === 'idle' && state !== 'hungry') {
      if (!idleSince) idleSince = Date.now();
      const idleMs = Date.now() - idleSince;
      if (idleMs > 60000 && state === 'idle') {
        applyState('yawn', { silent: true });
      }
      if (idleMs > 64000 && state === 'sleep') {
        // 保持睡眠
      }
    } else {
      idleSince = 0;
    }
  }, 2000);

  // 睡着后周期打呼
  setInterval(() => {
    if (state === 'sleep' && Math.random() < 0.3) sfx.snore();
  }, 4000);

  console.log('[ds-pet] renderer ready');
})();
