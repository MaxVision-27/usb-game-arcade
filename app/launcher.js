// Launcher: library, game player, saves (browser + USB), boss key.
const $ = s => document.querySelector(s);
const frame = $('#game'), notes = $('#notes');
const LS = 'arcade.saves';
let lib = window.LIBRARY || [];
let saves = load(), dir = null, usb = null, usbTimer = 0, writing = Promise.resolve();
let current = null, paused = false, favOnly = false, quiet = false;

// ---------- saves ----------
// Per game: newest record wins, but best/playtime/last always keep the higher value.
function merge(a, b) {
  const out = Object.assign({}, a);
  for (const id in b) {
    const x = a[id], y = b[id];
    if (!x) { out[id] = y; continue; }
    const n = (y.t || 0) > (x.t || 0) ? y : x;
    out[id] = Object.assign({}, n, {
      best: Math.max(x.best || 0, y.best || 0),
      playtime: Math.max(x.playtime || 0, y.playtime || 0),
      last: Math.max(x.last || 0, y.last || 0),
    });
  }
  return out;
}
console.assert(JSON.stringify(merge({ a: { best: 5, playtime: 9, last: 1, t: 1, state: 'old' } }, { a: { best: 3, playtime: 2, last: 2, t: 2, state: 'new' } }).a)
  === '{"best":5,"playtime":9,"last":2,"t":2,"state":"new"}', 'merge() is broken');

function load() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) {}
  return merge(s, window.SAVES || {});
}
const rec = id => saves[id] || (saves[id] = { best: 0, playtime: 0, last: 0, fav: false, state: null, t: 0 });
function store() { try { localStorage.setItem(LS, JSON.stringify(saves)); } catch (e) {} }
function touch(id) {
  rec(id).t = Date.now();
  store();
  if (usb && !usbTimer) usbTimer = setTimeout(writeUSB, 5000);
}
const savesText = () => 'window.SAVES = ' + JSON.stringify(saves) + ';\n';
const parse = text => JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));

// ---------- USB folder ----------
async function writeFile(d, name, text) {
  const w = await (await d.getFileHandle(name, { create: true })).createWritable();
  await w.write(text);
  await w.close();
}
async function readFile(d, name) {
  try { return await (await (await d.getFileHandle(name)).getFile()).text(); } catch (e) { return ''; }
}
function writeUSB() {
  clearTimeout(usbTimer); usbTimer = 0;
  return writing = writing.then(async () => {
    if (!usb) return;
    try { await writeFile(usb, 'saves.js', savesText()); usbLabel('USB ✓ saved', 'ok'); }
    catch (e) { usb = null; usbLabel('USB ⚠ not saving', 'warn'); }
  });
}
function usbLabel(text, cls) { const b = $('#usb'); b.textContent = text; b.className = cls || ''; }
function msg(text, warn) { const m = $('#msg'); m.textContent = text; m.className = warn ? 'warn' : ''; }

function idb(mode, fn) {
  return new Promise((res, rej) => {
    const o = indexedDB.open('arcade', 1);
    o.onupgradeneeded = () => o.result.createObjectStore('kv');
    o.onerror = () => rej(o.error);
    o.onsuccess = () => { const r = fn(o.result.transaction('kv', mode).objectStore('kv')); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); };
  });
}
idb('readonly', s => s.get('dir')).then(d => { dir = d || null; }).catch(() => {});

async function connect() {
  if (!window.showDirectoryPicker) return msg('This browser has no folder picker. Use Export / Import.', true);
  quiet = true;
  try {
    let ok = false;
    try { ok = dir && await dir.requestPermission({ mode: 'readwrite' }) === 'granted'; } catch (e) {}
    if (!ok) dir = await showDirectoryPicker({ id: 'arcade', mode: 'readwrite' });
    try { await dir.getFileHandle('START.html'); } catch (e) { dir = null; return msg('Pick the folder that has START.html in it.', true); }
    idb('readwrite', s => s.put(dir, 'dir')).catch(() => {});
    const data = await dir.getDirectoryHandle('data', { create: true });
    const text = await readFile(data, 'saves.js');
    if (text) {
      await writeFile(data, 'saves.bak.js', text);
      try { saves = merge(saves, parse(text)); store(); } catch (e) { msg('data\\saves.js was unreadable, kept a copy in saves.bak.js', true); }
    }
    usb = data;
    await writeUSB();
    render();
  } catch (e) {
    if (e.name !== 'AbortError') msg('USB: ' + e.message + ' (try again, or use Export / Import)', true);
  } finally { setTimeout(() => { quiet = false; }, 500); }
}

async function rescan() {
  if (!usb) return msg('Click Connect USB first.', true);
  try {
    const games = await dir.getDirectoryHandle('games'), list = [], bad = [];
    for await (const [id, h] of games.entries()) {
      if (h.kind !== 'directory' || /^[_.]/.test(id)) continue;
      try { list.push({ id, game: JSON.parse(await readFile(h, 'game.json')) }); } catch (e) { bad.push(id); }
    }
    list.sort((a, b) => a.id.localeCompare(b.id));
    await writeFile(usb, 'library.js', 'window.LIBRARY = ' + JSON.stringify(list, null, 1) + ';\n');
    lib = list;
    render();
    msg('Found ' + list.length + ' games' + (bad.length ? '. Skipped (missing or broken game.json): ' + bad.join(', ') : ''), bad.length);
  } catch (e) { msg('Rescan failed: ' + e.message, true); }
}

function exportSaves() {
  quiet = true;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([savesText()], { type: 'text/javascript' }));
  a.download = 'saves.js';
  a.click();
  setTimeout(() => { quiet = false; }, 1000);
  msg('Saved saves.js to Downloads. Copy it into the USB\'s data folder.');
}
$('#importFile').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try { saves = merge(saves, parse(await f.text())); store(); writeUSB(); render(); msg('Imported.'); }
  catch (err) { msg('That file is not a saves.js.', true); }
};

// ---------- library ----------
const fmt = n => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const title = e => e.game.title || e.id;

function card(e) {
  const g = e.game, s = saves[e.id] || {};
  const el = document.createElement('div');
  el.className = 'card';
  el.style.setProperty('--accent', g.color || '#1a9fff');
  el.innerHTML = '<div class="art"><button class="star" title="Favorite">★</button></div><div class="meta"><b></b><small></small><p></p></div>';
  const art = el.firstChild, fallback = () => { const f = document.createElement('div'); f.className = 'fallback'; f.textContent = title(e); art.prepend(f); };
  if (g.cover) {
    const img = new Image();
    img.alt = '';
    img.onerror = () => { img.remove(); fallback(); };
    img.src = 'games/' + encodeURIComponent(e.id) + '/' + g.cover;
    art.prepend(img);
  } else fallback();
  const star = el.querySelector('.star');
  star.classList.toggle('on', !!s.fav);
  star.onclick = ev => { ev.stopPropagation(); rec(e.id).fav = !rec(e.id).fav; touch(e.id); render(); };
  el.querySelector('b').textContent = title(e);
  el.querySelector('small').textContent = s.last ? 'Best ' + fmt(s.best || 0) + ' · ' + Math.round((s.playtime || 0) / 60) + ' min played' : 'Not played yet';
  el.querySelector('p').textContent = g.description || '';
  el.onclick = () => play(e.id);
  return el;
}

function render() {
  const q = $('#search').value.trim().toLowerCase();
  const list = lib.filter(e => (!favOnly || (saves[e.id] || {}).fav) && title(e).toLowerCase().includes(q));
  const last = e => (saves[e.id] || {}).last || 0;
  list.sort($('#sort').value === 'recent' ? (a, b) => last(b) - last(a) || title(a).localeCompare(title(b)) : (a, b) => title(a).localeCompare(title(b)));
  $('#grid').replaceChildren(...list.map(card));
  $('#count').textContent = '(' + list.length + ')';
  $('#empty').hidden = lib.length > 0;
  const recent = q || favOnly ? [] : lib.filter(last).sort((a, b) => last(b) - last(a)).slice(0, 6);
  $('#recent').replaceChildren(...recent.map(card));
  $('#recentWrap').hidden = !recent.length;
}

// ---------- player ----------
const send = m => frame.contentWindow && frame.contentWindow.postMessage(m, '*');

function play(id) {
  current = lib.find(e => e.id === id);
  if (!current) return;
  rec(id).last = Date.now();
  touch(id);
  paused = false;
  $('#pause').hidden = true;
  $('#home').hidden = true;
  $('#player').hidden = false;
  $('#ptitle').textContent = title(current);
  $('#controls').replaceChildren(...(current.game.controls || []).map(([k, v]) => {
    const tr = document.createElement('tr');
    tr.insertCell().textContent = k;
    tr.insertCell().textContent = v;
    return tr;
  }));
  frame.src = 'games/' + encodeURIComponent(id) + '/index.html';
}
function pause() {
  if (!current || paused) return;
  paused = true;
  send({ type: 'pause' });
  $('#pause').hidden = false;
  $('#resume').focus();
}
function resume() {
  paused = false;
  $('#pause').hidden = true;
  send({ type: 'resume' });
  frame.contentWindow.focus();
}
function exit() {
  current = null;
  paused = false;
  frame.src = 'about:blank';
  $('#player').hidden = true;
  $('#home').hidden = false;
  if (document.fullscreenElement) document.exitFullscreen();
  writeUSB();
  render();
}
function fullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}
frame.onload = () => { if (current) frame.contentWindow.focus(); };

addEventListener('message', e => {
  if (!current || e.source !== frame.contentWindow) return;
  const m = e.data || {}, r = rec(current.id);
  if (m.type === 'ready') { send({ type: 'init', best: r.best, state: r.state }); if (paused) send({ type: 'pause' }); }
  else if (m.type === 'score') { if (typeof m.value === 'number' && m.value > r.best) { r.best = m.value; touch(current.id); } }
  else if (m.type === 'save') { r.state = m.state === undefined ? null : m.state; touch(current.id); }
  else if (m.type === 'pause') pause();
  else if (m.type === 'fullscreen') fullscreen();
  else if (m.type === 'boss') boss();
  else if (m.type === 'blur') checkFocus();
});

setInterval(() => {
  if (current && !paused && document.hasFocus()) { rec(current.id).playtime++; touch(current.id); }
}, 1000);

// ---------- boss key ----------
const NOTES = 'Unit 4 review\n\n- Read pages 112-130 before Thursday\n- Vocabulary: osmosis, diffusion, active transport, concentration gradient\n- Lab write-up due Friday: hypothesis, method, results table, conclusion\n\nQuestions to ask:\n1. Does the quiz cover chapter 5?\n2. Can the lab be handed in on paper?\n';
try { notes.value = localStorage.getItem('arcade.notes') || NOTES; } catch (e) { notes.value = NOTES; }
notes.oninput = () => { try { localStorage.setItem('arcade.notes', notes.value); } catch (e) {} };

function boss(on = $('#boss').hidden) {
  $('#boss').hidden = !on;
  if (on) { pause(); notes.focus(); }
  else if (current) $('#resume').focus();
}
function checkFocus() {
  setTimeout(() => { if (!quiet && !document.hasFocus() && $('#boss').hidden) boss(true); }, 100);
}
addEventListener('blur', checkFocus);

addEventListener('keydown', e => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.code === 'Backquote') { e.preventDefault(); return boss(); }
  if (!$('#boss').hidden) return;
  if (current && e.code === 'Escape') { e.preventDefault(); paused ? resume() : pause(); }
  else if (current && e.code === 'KeyF') fullscreen();
  else if (!current && e.code === 'Escape') { $('#search').value = ''; render(); }
});

// ---------- wiring ----------
$('#search').oninput = render;
$('#sort').onchange = render;
$('#fav').onclick = () => { favOnly = !favOnly; $('#fav').classList.toggle('on', favOnly); render(); };
$('#usb').onclick = connect;
$('#rescan').onclick = rescan;
$('#export').onclick = exportSaves;
$('#import').onclick = () => { quiet = true; $('#importFile').click(); setTimeout(() => { quiet = false; }, 1000); };
$('#resume').onclick = resume;
$('#restart').onclick = () => { paused = false; $('#pause').hidden = true; frame.src = frame.src; };
$('#exit').onclick = exit;
store();
render();
