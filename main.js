'use strict';

/**
 * ds-pet 主进程
 * —— 透明无边框置顶小窗 + DeepSeek Harness (DSH) 桥接
 *
 * 集成方式（与 DSH Web 前端同协议，仅回环地址，无鉴权）：
 *   - 一元 RPC : POST {base}/api/<method>   body: {type:"client-request", rpcId, method, payload}
 *   - 实时事件 : WS {base}/api/events.mux   每帧为 server-request 信封, payload 为 mux frame
 * 状态轮询  : host.describe + session.list
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, shell, nativeImage, globalShortcut, Notification } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const { spawnCli } = require('./lib/cli-process');

// 已知修复: AMD 显卡 + Windows 下窗口不绘制的 Chromium 问题
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
// 允许无用户手势播放 WebAudio 音效
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let DS_PET_URL = process.env.DS_PET_URL || 'http://127.0.0.1:3080';
const POLL_MS = 4000;
const TEST_MODE = process.env.DS_PET_TEST === '1';
const TEST_QUIT_MS = Number(process.env.DS_PET_TEST_MS || 9000);

let win = null;
let settingsWin = null;
let dshProcess = null;
let dshLastError = '';
let tray = null;
let clickThrough = false;
let ws = null;
let wsRetry = 0;
let wsTimer = null;
let pollTimer = null;
let lastState = null;

/* ---------------------------------------------------------------- DSH RPC */

function mintRpcId() {
  // 浏览器安全的随机 UUID
  const bytes = require('node:crypto').randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 一元 RPC 调用, 返回 result.value */
async function dshCall(method, payload = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const rpcId = mintRpcId();
    const res = await fetch(`${DS_PET_URL}/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${method}`);
    const full = await res.json();
    if (full.rpcId !== rpcId) throw new Error(`rpcId mismatch for ${method}`);
    if (!full.result?.ok) throw new Error(`${method} failed: ${full.result?.error?.code} ${full.result?.error?.message}`);
    return full.result.value;
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------------------------------------- 状态汇聚 */

/** 将 session.list 返回的原始数据整理成桌宠用的精简快照 */
function snapshotOf(host, list) {
  const items = (list?.items || []).slice();
  // 优先选正在运行的会话, 否则选最近更新的
  items.sort((a, b) => (b.running === true ? 1 : 0) - (a.running === true ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
  const session = items[0] || null;
  const proj = session?.projections?.values || {};
  const stats = proj.sessionStats || {};
  const usage = proj.tokenUsage || {};
  const pressure = proj.contextPressure || {};

  let contextPct = null;
  if (typeof pressure.pressureTokens === 'number' && typeof pressure.contextWindow === 'number' && pressure.contextWindow > 0) {
    contextPct = Math.min(100, Math.round((pressure.pressureTokens / pressure.contextWindow) * 1000) / 10);
  }

  return {
    online: true,
    host: {
      version: host?.version ?? null,
      provider: host?.provider ?? null,
      model: host?.model ?? null,
      cwd: host?.cwd ?? null,
      attachedSessions: host?.attachedSessions ?? 0,
    },
    session: session
      ? {
          sessionId: session.sessionId,
          running: session.running === true,
          blank: session.blank === true,
          cwd: session.cwd ?? null,
          agentPreset: session.agentPreset ?? null,
          title: proj.title || null,
          goal: proj.goal ?? null,
          planActive: proj.plan?.active === true,
          turns: stats.turns ?? 0,
          steps: stats.steps ?? 0,
          decodeTokens: stats.decodeTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          contextPct,
          contextPressureTokens: pressure.pressureTokens ?? null,
        }
      : null,
    updatedAt: Date.now(),
  };
}

async function refreshState() {
  try {
    const [host, list] = await Promise.all([dshCall('host.describe', {}), dshCall('session.list', {})]);
    lastState = snapshotOf(host, list);
  } catch (err) {
    lastState = { online: false, error: String(err.message || err), updatedAt: Date.now() };
  }
  if (win && !win.isDestroyed()) {
    win.webContents.send('dsh:state', lastState);
  }
  return lastState;
}

/* --------------------------------------------------------------- 实时事件 */

function openEventStream() {
  clearTimeout(wsTimer);
  try { if (ws) ws.close(); } catch { /* noop */ }
  const wsUrl = DS_PET_URL.replace(/^http/, 'ws') + '/api/events.mux';
  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    scheduleReconnect();
    return;
  }
  ws.onopen = () => {
    wsRetry = 0;
    if (win && !win.isDestroyed()) win.webContents.send('dsh:ws', { connected: true });
  };
  ws.onmessage = (ev) => {
    if (typeof ev.data !== 'string') return;
    let envelope;
    try {
      envelope = JSON.parse(ev.data);
    } catch {
      return;
    }
    const frame = envelope?.payload;
    if (!frame) return;
    if (win && !win.isDestroyed()) win.webContents.send('dsh:event', frame);
  };
  ws.onclose = () => scheduleReconnect();
  ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
}

function scheduleReconnect() {
  clearTimeout(wsTimer);
  const delay = Math.min(15000, 1000 * 2 ** Math.min(wsRetry, 4));
  wsRetry += 1;
  wsTimer = setTimeout(openEventStream, delay);
}

/* ------------------------------------------------------------------ 窗口 */

function defaultPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  const W = 260;
  const H = 300;
  return { x: Math.round(workArea.x + workArea.width - W - 24), y: Math.round(workArea.y + workArea.height - H - 16) };
}

function loadPosition() {
  try {
    const raw = fs.readFileSync(path.join(app.getPath('userData'), 'position.json'), 'utf8');
    const pos = JSON.parse(raw);
    if (typeof pos.x === 'number' && typeof pos.y === 'number') return pos;
  } catch { /* noop */ }
  return defaultPosition();
}

function savePosition() {
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(path.join(app.getPath('userData'), 'position.json'), JSON.stringify({ x, y }));
  } catch { /* noop */ }
}

function createWindow() {
  let pos = loadPosition();
  if (process.env.DS_PET_POS) {
    const [px, py] = process.env.DS_PET_POS.split(',').map(Number);
    if (Number.isFinite(px) && Number.isFinite(py)) pos = { x: px, y: py };
  }
  win = new BrowserWindow({
    ...pos,
    width: 260,
    height: 300,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => win.show());
  win.on('moved', () => savePosition());
  win.on('closed', () => { win = null; });

  if (TEST_MODE) {
    win.webContents.once('did-finish-load', async () => {
      try {
        await new Promise((r) => setTimeout(r, 1600));
        const img = await win.webContents.capturePage();
        const png = img.toPNG();
        fs.mkdirSync(path.join(__dirname, 'renderer'), { recursive: true });
        fs.writeFileSync(path.join(__dirname, 'renderer', 'whale-preview.png'), png);
        // 像素统计: 非透明像素包围盒 + 主色调, 便于无视觉环境下校验
        const { width, height } = img.getSize();
        const raw = img.toBitmap();
        let minX = width, minY = height, maxX = -1, maxY = -1, count = 0, rSum = 0, gSum = 0, bSum = 0;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (raw[i + 3] > 40) {
              count++; rSum += raw[i]; gSum += raw[i + 1]; bSum += raw[i + 2];
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
          }
        }
        console.log('[ds-pet] pixel stats:', JSON.stringify({
          size: `${width}x${height}`, opaque: count,
          bbox: [minX, minY, maxX, maxY],
          avgColor: count ? [Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count)] : null,
        }));
        console.log('[ds-pet] preview captured -> renderer/whale-preview.png');
      } catch (err) {
        console.error('[ds-pet] capture failed:', err);
      }
    });
  }
}

/* ---------------------------------------------------------------- 设置 */

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8'));
  } catch {
    return { sound: false, style: 'classic' };
  }
}

function saveSettings(s) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify(s));
  } catch { /* noop */ }
}

let settings = loadSettings();
if (typeof settings.url === 'string' && /^https?:\/\//.test(settings.url)) DS_PET_URL = settings.url.replace(/\/$/, '');
let demoOn = false;

function toggleDemo() {
  demoOn = !demoOn;
  if (tray) tray.setContextMenu(buildTrayMenu());
  if (win && !win.isDestroyed()) win.webContents.send('pet:demo', demoOn);
  return demoOn;
}

/* ------------------------------------------------------------------ 托盘 */

function buildTrayMenu() {
  const menu = Menu.buildFromTemplate([
    { label: '🐋 打开 DSH Web 界面', click: () => shell.openExternal(DS_PET_URL) },
    { label: '📂 打开工作目录', click: async () => {
        const cwd = lastState?.host?.cwd || lastState?.session?.cwd;
        if (cwd) shell.openPath(cwd);
      } },
    { type: 'separator' },
    { label: clickThrough ? '✅ 鼠标穿透（再次点击恢复）' : '🖱 鼠标穿透（点击鲸鱼穿过）', click: toggleClickThrough },
    { label: settings.sound ? '🔊 音效：开（点击关闭）' : '🔇 音效：关（点击开启）', click: toggleSound },
    { label: '🎨 桌宠风格', submenu: [
        { label: '🌊 经典蓝鲸', type: 'radio', checked: settings.style === 'classic', click: () => setStyle('classic') },
        { label: '🍬 软糖 Pastel', type: 'radio', checked: settings.style === 'candy', click: () => setStyle('candy') },
        { label: '🌙 夜航深色', type: 'radio', checked: settings.style === 'night', click: () => setStyle('night') },
        { label: '🟩 像素复古', type: 'radio', checked: settings.style === 'pixel', click: () => setStyle('pixel') },
      ] },
    { label: '⚙️ 打开设置', click: openSettingsWindow },
    { label: demoOn ? '🎬 形态演示：播放中（点击停止）' : '🎬 形态演示（循环播放所有形态）', click: toggleDemo },
    { label: '🔄 刷新状态', click: () => refreshState() },
    { type: 'separator' },
    { label: '🚪 退出桌宠', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  return menu;
}

function toggleSound() {
  settings.sound = !settings.sound;
  saveSettings(settings);
  if (tray) tray.setContextMenu(buildTrayMenu());
  if (win && !win.isDestroyed()) win.webContents.send('pet:sound', settings.sound);
  return settings.sound;
}

function openSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({ width: 480, height: 650, resizable: false, title: '桌宠设置', parent: win, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

function getSettings() { return { ...settings, url: DS_PET_URL }; }
function saveAllSettings(next) {
  const oldSound = settings.sound;
  settings = { ...settings, ...next, style: next.style || settings.style || 'classic' };
  if (typeof next.url === 'string' && /^https?:\/\//.test(next.url)) DS_PET_URL = next.url.replace(/\/$/, '');
  if (next.launchAtLogin !== undefined) app.setLoginItemSettings({ openAtLogin: !!next.launchAtLogin });
  saveSettings(settings);
  if (next.sound !== undefined && next.sound !== oldSound) {
    if (win && !win.isDestroyed()) win.webContents.send('pet:sound', settings.sound);
  }
  if (win && !win.isDestroyed()) win.webContents.send('pet:style', settings.style);
  if (tray) tray.setContextMenu(buildTrayMenu());
  setTimeout(() => { app.relaunch(); app.exit(0); }, 500);
  return getSettings();
}

function setStyle(style) {
  if (!['classic', 'candy', 'night', 'pixel'].includes(style)) return settings.style;
  settings.style = style;
  saveSettings(settings);
  if (tray) tray.setContextMenu(buildTrayMenu());
  if (win && !win.isDestroyed()) win.webContents.send('pet:style', style);
  return style;
}

function toggleClickThrough() {
  if (!win || win.isDestroyed()) return;
  clickThrough = !clickThrough;
  if (clickThrough) {
    win.setIgnoreMouseEvents(true, { forward: true });
    win.webContents.send('pet:clickthrough', true);
    notify('🖱 鼠标穿透已开启', '鲸鱼不再响应鼠标。按 Ctrl+Shift+D 或点击托盘鲸鱼图标即可恢复。');
  } else {
    win.setIgnoreMouseEvents(false);
    win.webContents.send('pet:clickthrough', false);
    notify('🐋 鼠标穿透已关闭', '可以继续和鲸鱼玩耍啦。');
  }
  if (tray) tray.setContextMenu(buildTrayMenu());
}

function notify(title, body) {
  try {
    if (Notification.isSupported()) {
      new Notification({ title, body, silent: true }).show();
    }
  } catch { /* noop */ }
}

function findExecutable(name) {
  const names = process.platform === 'win32' ? [`${name}.cmd`, `${name}.exe`, name] : [name];
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  if (process.platform === 'darwin' || process.platform === 'linux') {
    try {
      const home = app.getPath('home');
      const nvmRoot = path.join(home, '.nvm', 'versions', 'node');
      for (const version of fs.readdirSync(nvmRoot)) dirs.push(path.join(nvmRoot, version, 'bin'));
    } catch { /* NVM is optional */ }
    dirs.push('/opt/homebrew/bin', '/usr/local/bin', '/usr/bin');
  } else {
    dirs.push(process.env.APPDATA ? path.join(process.env.APPDATA, 'npm') : '');
    dirs.push(process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'nodejs') : '');
  }
  for (const dir of [...new Set(dirs)]) for (const candidate of names) {
    const full = path.join(dir, candidate);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function installDsh() {
  const npm = findExecutable('npm');
  if (!npm) return Promise.reject(new Error('npm was not found. Install Node.js first.'));
  return new Promise((resolve, reject) => {
    const child = spawnCli(npm, ['install', '--global', '@deepseek-ai/dsh'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let installError = '';
    child.stdout?.on('data', (chunk) => { installError = String(chunk).trim().slice(-1200); });
    child.stderr?.on('data', (chunk) => { installError = String(chunk).trim().slice(-1200); });
    child.once('error', reject);
    child.once('exit', (code) => code === 0
      ? resolve(findExecutable('dsh'))
      : reject(new Error(installError || `npm install exited with code ${code}`)));
  });
}

function portOpen(url) {
  return new Promise((resolve) => {
    try {
      const target = new URL(url);
      const socket = net.createConnection({ host: target.hostname, port: Number(target.port || 80) });
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => { socket.destroy(); resolve(false); });
      socket.setTimeout(500, () => { socket.destroy(); resolve(false); });
    } catch { resolve(false); }
  });
}

async function waitForPort(url, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await portOpen(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function startDsh() {
  // dsh web 在端口已占用时会报 EADDRINUSE；先检查端口，避免重复启动。
  return portOpen(DS_PET_URL).then((running) => {
    if (running) {
      shell.openExternal(DS_PET_URL);
      return { started: false, opened: true };
    }
    if (!dshProcess || dshProcess.exitCode !== null) {
      const dsh = findExecutable('dsh');
      const ready = dsh ? Promise.resolve(dsh) : installDsh();
      return ready.then((command) => {
        if (!command) throw new Error('DSH installation completed but dsh was not found');
        dshLastError = '';
        const commandDir = path.dirname(command);
        const childEnv = { ...process.env, PATH: `${commandDir}${path.delimiter}${process.env.PATH || ''}`, DSH_HOME: process.env.DSH_HOME || path.join(app.getPath('home'), '.dsh') };
        dshProcess = spawnCli(command, ['web'], { cwd: app.getPath('home'), env: childEnv, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        const report = (chunk) => { dshLastError = String(chunk).trim().slice(-1200); };
        dshProcess.stdout?.on('data', report);
        dshProcess.stderr?.on('data', report);
        dshProcess.once('error', (err) => { dshLastError = err.message; notify('DSH 启动失败', dshLastError); if (win && !win.isDestroyed()) win.webContents.send('pet:dsh-error', dshLastError); });
        dshProcess.once('exit', (code) => { if (code && !dshLastError) dshLastError = `dsh web exited with code ${code}`; });
        return waitForPort(DS_PET_URL).then((ready) => {
          if (!ready) throw new Error(dshLastError || ('DSH did not open its Web server on ' + DS_PET_URL));
          shell.openExternal(DS_PET_URL);
          return { started: true, installed: !dsh, opened: true };
        });
      }).catch((err) => {
        notify('DSH 启动失败', err.message || String(err));
        throw err;
      });
    }
    shell.openExternal(DS_PET_URL);
    return { started: false, opened: true };
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  if (!icon.isEmpty()) {
    const trayIcon = icon.resize({ width: 18, height: 18 });
    // macOS 菜单栏会把 Template 图片按系统主题着色；Windows/Linux 保留彩色图标。
    if (process.platform === 'darwin') trayIcon.setTemplateImage(true);
    tray = new Tray(trayIcon);
  } else {
    tray = new Tray(nativeImage.createEmpty());
  }
  tray.setToolTip('DeepSeek 鲸鱼桌宠 · 与 DSH 联动中');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => {
    if (clickThrough) toggleClickThrough();
    shell.openExternal(DS_PET_URL);
  });
}

function setDockIcon() {
  if (process.platform !== 'darwin' || !app.dock) return;
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  if (fs.existsSync(iconPath)) app.dock.setIcon(nativeImage.createFromPath(iconPath));
}

/* ------------------------------------------------------------------ IPC */

function registerIpc() {
  ipcMain.handle('dsh:call', (_ev, method, payload) => dshCall(method, payload ?? {}));
  ipcMain.handle('dsh:refresh', () => refreshState());
  ipcMain.handle('pet:get-sound', () => settings.sound);
  ipcMain.handle('pet:get-style', () => settings.style || 'classic');
  ipcMain.handle('pet:get-settings', () => getSettings());
  ipcMain.handle('pet:save-settings', (_ev, next) => saveAllSettings(next || {}));
  ipcMain.handle('pet:start-dsh', () => startDsh());
  ipcMain.on('pet:toggle-sound', () => toggleSound());
  ipcMain.on('pet:demo', () => toggleDemo());
  ipcMain.on('pet:move-by', (_ev, dx, dy) => {
    if (!win || win.isDestroyed()) return;
    const [x, y] = win.getPosition();
    const [w, h] = win.getSize();
    const { workArea } = screen.getDisplayNearestPoint({ x: x + dx, y: y + dy });
    const nx = Math.min(Math.max(x + dx, workArea.x - w + 70), workArea.x + workArea.width - 70);
    const ny = Math.min(Math.max(y + dy, workArea.y + 10), workArea.y + workArea.height - 70);
    win.setPosition(Math.round(nx), Math.round(ny));
  });
  ipcMain.on('pet:menu', () => {
    if (tray) tray.popUpContextMenu(buildTrayMenu());
  });
  ipcMain.on('pet:open-web', () => shell.openExternal(DS_PET_URL));
  ipcMain.on('pet:open-workspace', () => {
    const cwd = lastState?.host?.cwd || lastState?.session?.cwd;
    if (cwd) shell.openPath(cwd);
  });
  ipcMain.on('pet:toggle-clickthrough', () => toggleClickThrough());
  ipcMain.on('pet:quit', () => { app.isQuitting = true; app.quit(); });
}

/* ------------------------------------------------------------------ 启动 */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    app.setName('DeepSeek Pet');
    app.setAppUserModelId('com.dspet.whale');
    setDockIcon();
    registerIpc();
    createWindow();
    createTray();

    refreshState();
    pollTimer = setInterval(() => refreshState(), POLL_MS);
    openEventStream();

    try {
      globalShortcut.register('Ctrl+Shift+D', () => toggleClickThrough());
    } catch { /* noop */ }

    if (TEST_MODE) {
      setTimeout(() => {
        console.log('[ds-pet] test mode: quitting');
        app.isQuitting = true;
        app.quit();
      }, TEST_QUIT_MS);
    }
  });

  app.on('will-quit', () => {
    clearInterval(pollTimer);
    clearTimeout(wsTimer);
    try { if (ws) ws.close(); } catch { /* noop */ }
    try { if (dshProcess && !dshProcess.killed) dshProcess.kill(); } catch { /* noop */ }
    try { globalShortcut.unregisterAll(); } catch { /* noop */ }
  });

  app.on('window-all-closed', (e) => {
    // 桌宠常驻: 关窗不退出, 仅托盘退出
    if (app.isQuitting) app.quit();
  });
}
