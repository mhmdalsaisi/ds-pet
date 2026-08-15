'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  /** 订阅 DSH 状态快照 (轮询, ~4s) */
  onState: (cb) => {
    const listener = (_ev, state) => cb(state);
    ipcRenderer.on('dsh:state', listener);
    return () => ipcRenderer.removeListener('dsh:state', listener);
  },
  /** 订阅 DSH 实时事件帧 (events.mux) */
  onEvent: (cb) => {
    const listener = (_ev, frame) => cb(frame);
    ipcRenderer.on('dsh:event', listener);
    return () => ipcRenderer.removeListener('dsh:event', listener);
  },
  /** WS 连接状态 */
  onWs: (cb) => {
    const listener = (_ev, info) => cb(info);
    ipcRenderer.on('dsh:ws', listener);
    return () => ipcRenderer.removeListener('dsh:ws', listener);
  },
  onDshError: (cb) => {
    const listener = (_ev, message) => cb(message);
    ipcRenderer.on('pet:dsh-error', listener);
    return () => ipcRenderer.removeListener('pet:dsh-error', listener);
  },
  /** 鼠标穿透开关变化 */
  onClickThrough: (cb) => {
    const listener = (_ev, enabled) => cb(enabled);
    ipcRenderer.on('pet:clickthrough', listener);
    return () => ipcRenderer.removeListener('pet:clickthrough', listener);
  },
  getStyle: () => ipcRenderer.invoke('pet:get-style'),
  getSettings: () => ipcRenderer.invoke('pet:get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('pet:save-settings', settings),
  onStyle: (cb) => {
    const listener = (_ev, style) => cb(style);
    ipcRenderer.on('pet:style', listener);
    return () => ipcRenderer.removeListener('pet:style', listener);
  },
  /** 音效状态 */
  getSound: () => ipcRenderer.invoke('pet:get-sound'),
  toggleSound: () => ipcRenderer.send('pet:toggle-sound'),
  onSound: (cb) => {
    const listener = (_ev, v) => cb(v);
    ipcRenderer.on('pet:sound', listener);
    return () => ipcRenderer.removeListener('pet:sound', listener);
  },
  /** 形态演示模式 */
  onDemo: (cb) => {
    const listener = (_ev, on) => cb(on);
    ipcRenderer.on('pet:demo', listener);
    return () => ipcRenderer.removeListener('pet:demo', listener);
  },
  /** 任意一元 RPC 调用 */
  call: (method, payload) => ipcRenderer.invoke('dsh:call', method, payload),
  refresh: () => ipcRenderer.invoke('dsh:refresh'),
  /** 按增量移动窗口 */
  moveBy: (dx, dy) => ipcRenderer.send('pet:move-by', dx, dy),
  menu: () => ipcRenderer.send('pet:menu'),
  openWeb: () => ipcRenderer.send('pet:open-web'),
  startDsh: () => ipcRenderer.invoke('pet:start-dsh'),
  openWorkspace: () => ipcRenderer.send('pet:open-workspace'),
  toggleClickThrough: () => ipcRenderer.send('pet:toggle-clickthrough'),
  quit: () => ipcRenderer.send('pet:quit'),
});
