'use strict';
const $ = (id) => document.getElementById(id);
const english = /^en/i.test(navigator.language || '');
if (english) {
  document.documentElement.lang = 'en';
  document.querySelector('h1').textContent = 'DeepSeek Pet settings';
  document.querySelector('header p').textContent = 'Make the whale yours';
  document.querySelectorAll('h2')[0].textContent = 'Appearance';
  document.querySelectorAll('h2')[1].textContent = 'Sound';
  document.querySelectorAll('h2')[2].textContent = 'Connection';
  document.querySelectorAll('h2')[3].textContent = 'Startup';
  document.querySelector('.hint').textContent = 'Restart the pet after saving to apply changes.';
  $('save').textContent = 'Save and restart';
  const opts = { classic: '🌊 Classic blue', candy: '🍬 Candy pastel', night: '🌙 Night flight', pixel: '🟩 Retro pixel' };
  document.querySelectorAll('#style option').forEach((o) => { o.textContent = opts[o.value]; });
}
async function load() { const s = await window.pet.getSettings(); $('style').value=s.style||'classic'; $('sound').checked=!!s.sound; $('reducedMotion').checked=!!s.reducedMotion; $('launchAtLogin').checked=!!s.launchAtLogin; $('url').value=s.url||''; }
$('save').addEventListener('click', async () => { $('save').disabled=true; $('status').textContent='正在重启桌宠…'; await window.pet.saveSettings({style:$('style').value,sound:$('sound').checked,reducedMotion:$('reducedMotion').checked,launchAtLogin:$('launchAtLogin').checked,url:$('url').value.trim()}); }); load();
