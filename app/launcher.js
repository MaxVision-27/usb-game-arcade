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

const stats = e => { const s = saves[e.id] || {}; return s.last ? 'Best ' + fmt(s.best || 0) + ' · ' + Math.round((s.playtime || 0) / 60) + ' min played' : 'Not played yet'; };
const coverSrc = e => (e.game.cover ? 'games/' + encodeURIComponent(e.id) + '/' + e.game.cover : null);

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
  el.querySelector('small').textContent = stats(e);
  el.querySelector('p').textContent = g.description || '';
  el.onclick = () => play(e.id);
  return el;
}

function render() {
  const q = $('#search').value.trim().toLowerCase();
  const list = lib.filter(e => (!favOnly || (saves[e.id] || {}).fav) && title(e).toLowerCase().includes(q));
  const last = e => (saves[e.id] || {}).last || 0;
  list.sort($('#sort').value === 'recent' ? (a, b) => last(b) - last(a) || title(a).localeCompare(title(b)) : (a, b) => title(a).localeCompare(title(b)));
  document.body.className = 'layout-' + layout;
  $('#layout').value = layout;
  const steam = layout === 'steam';
  $('#side').hidden = $('#shelves').hidden = !steam;
  $('#console').hidden = steam;
  $('#empty').hidden = lib.length > 0;
  if (!steam) return renderConsole(list);
  sideList(list);
  $('#grid').replaceChildren(...list.map(card));
  $('#count').textContent = '(' + list.length + ')';
  const recent = q || favOnly ? [] : lib.filter(last).sort((a, b) => last(b) - last(a)).slice(0, 6);
  $('#recent').replaceChildren(...recent.map(card));
  $('#recentWrap').hidden = !recent.length;
}

// ---------- layouts ----------
// Three ways to show the library: Steam-style (a sidebar list, the recent shelf and the cover grid), PlayStation-style
// (one row of tiles over a big backdrop of the selected game) and Xbox-style (a featured tile over a grid of tiles).
// The console styles work with the arrow keys and Enter, or a game controller. The choice is kept with the saves
// (under '_launcher'), so it travels with the USB.
const LAYOUTS = ['steam', 'ps', 'xbox'];
let layout = LAYOUTS.includes((saves._launcher || {}).layout) ? saves._launcher.layout : 'steam', sel = 0, shown = [];
function setLayout(v) {
  layout = LAYOUTS.includes(v) ? v : 'steam';
  saves._launcher = { layout, t: Date.now() };
  store();
  if (usb && !usbTimer) usbTimer = setTimeout(writeUSB, 5000);
  render();
}

function sideList(list) {   // Steam-style: every game as a compact row
  $('#side').replaceChildren(...list.map(e => {
    const b = document.createElement('button');
    b.className = 'side-item';
    b.style.setProperty('--accent', e.game.color || '#1a9fff');
    b.innerHTML = '<i></i><span></span>';
    b.querySelector('span').textContent = title(e);
    const src = coverSrc(e);
    if (src) b.querySelector('i').style.backgroundImage = 'url("' + src + '")';
    b.onclick = () => play(e.id);
    return b;
  }));
}

function art(e, cls) {   // a cover image, or the title on the game's colour when there is none
  const a = document.createElement('div'), src = coverSrc(e);
  a.className = cls;
  a.style.setProperty('--accent', e.game.color || '#1a9fff');
  const fallback = () => { a.textContent = title(e); a.classList.add('noart'); };
  if (src) { const img = new Image(); img.alt = ''; img.onerror = () => { img.remove(); fallback(); }; img.src = src; a.append(img); } else fallback();
  return a;
}
function tile(e, i) {
  const el = document.createElement('div');
  el.className = 'tile' + (i === sel ? ' sel' : '');
  el.append(art(e, 'tart'));
  const b = document.createElement('b');
  b.textContent = title(e);
  el.append(b);
  el.onclick = () => (i === sel ? play(e.id) : select(i));   // first click picks it, a second click plays
  return el;
}
function details(e) {   // title, stats, description, Play and Favorite
  const d = document.createElement('div'), s = saves[e.id] || {};
  d.className = 'cinfo';
  d.innerHTML = '<h2></h2><small></small><p></p><div class="cbtns"><button class="cplay">Play</button><button class="cfav" title="Favorite">★</button></div>';
  d.querySelector('h2').textContent = title(e);
  d.querySelector('small').textContent = stats(e);
  d.querySelector('p').textContent = e.game.description || '';
  d.querySelector('.cplay').onclick = () => play(e.id);
  const fav = d.querySelector('.cfav');
  fav.classList.toggle('on', !!s.fav);
  fav.onclick = () => { rec(e.id).fav = !rec(e.id).fav; touch(e.id); render(); };
  return d;
}
function renderConsole(list) {
  shown = list;
  sel = Math.max(0, Math.min(sel, list.length - 1));
  const c = $('#console'), e = list[sel];
  c.className = layout;
  if (!e) return c.replaceChildren();
  const bg = art(e, 'cbg');   // the selected game's cover, blurred, behind everything
  const tiles = document.createElement('div');
  tiles.append(...list.map(tile));
  if (layout === 'ps') {
    tiles.className = 'prow';
    c.replaceChildren(bg, tiles, details(e));
  } else {
    const hero = document.createElement('div'), h3 = document.createElement('h3');
    hero.className = 'xhero';
    hero.style.setProperty('--accent', e.game.color || '#1a9fff');
    hero.append(art(e, 'xart'), details(e));
    h3.textContent = 'My games (' + list.length + ')';
    tiles.className = 'xgrid';
    c.replaceChildren(bg, hero, h3, tiles);
  }
  const t = c.querySelector('.tile.sel');
  if (t) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function select(i) { sel = i; renderConsole(shown); }

// Arrow keys / d-pad move the selection, Enter / A plays. PlayStation-style is a single row; Xbox-style is a grid.
function nav(dir) {
  if (!shown.length) return false;
  if (dir === 'ok') { play(shown[sel].id); return true; }
  if (layout === 'ps' && (dir === 'up' || dir === 'down')) return false;
  const tiles = [...document.querySelectorAll('#console .tile')], cols = Math.max(1, tiles.filter(t => t.offsetTop === tiles[0].offsetTop).length);
  select(Math.max(0, Math.min(shown.length - 1, sel + { left: -1, right: 1, up: -cols, down: cols }[dir])));
  return true;
}
const KEYNAV = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'ok' };
let padHeld = '', padNext = 0;
setInterval(() => {   // game controllers: d-pad or left stick to move, A to play (library only, never during a game)
  if (current || layout === 'steam' || !navigator.getGamepads) return;
  const p = [...navigator.getGamepads()].find(Boolean);
  if (!p) return;
  const b = i => p.buttons[i] && p.buttons[i].pressed, ax = p.axes[0] || 0, ay = p.axes[1] || 0;
  const dir = b(0) ? 'ok' : b(14) || ax < -0.6 ? 'left' : b(15) || ax > 0.6 ? 'right' : b(12) || ay < -0.6 ? 'up' : b(13) || ay > 0.6 ? 'down' : '';
  const now = Date.now();
  if (dir && (dir !== padHeld || (dir !== 'ok' && now >= padNext))) { nav(dir); padNext = now + (dir === padHeld ? 120 : 400); }
  padHeld = dir;
}, 50);

// A clock in the top bar for the console styles.
const clock = document.createElement('span');
clock.id = 'clock';
$('header').append(clock);
const tick = () => { clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
tick(); setInterval(tick, 15000);

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
  else if (!current && layout !== 'steam' && KEYNAV[e.code] && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && nav(KEYNAV[e.code])) e.preventDefault();
});

// ---------- wiring ----------
$('#search').oninput = render;
$('#layout').onchange = e => { setLayout(e.target.value); e.target.blur(); };
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
