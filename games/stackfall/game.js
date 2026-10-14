// Stackfall: steer falling pieces, fill rows to clear them.
const COLS = 10, ROWS = 20, S = 22, BX = 20, BY = 20, W = 400, H = 480;
const PIECES = {
  I: { c: '#4fd1e8', m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
  O: { c: '#f2c94c', m: [[1, 1], [1, 1]] },
  T: { c: '#b06ef3', m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
  S: { c: '#5ad17a', m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
  Z: { c: '#f2617a', m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
  J: { c: '#5b8def', m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
  L: { c: '#f29a4c', m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
};
const POINTS = [0, 100, 300, 500, 800];
let board, piece, next, bag, score, lines, level, best, state, fallT, moveT, flash;

const empty = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));
const rotate = m => m[0].map((_, i) => m.map(r => r[i]).reverse());

function take() {
  if (!bag.length) {
    bag = Object.keys(PIECES);
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [bag[i], bag[j]] = [bag[j], bag[i]]; }
  }
  return bag.pop();
}
function blocked(m, x, y) {
  return m.some((row, r) => row.some((v, c) => v && (x + c < 0 || x + c >= COLS || y + r >= ROWS || (y + r >= 0 && board[y + r][x + c]))));
}
function spawn() {
  const k = next || take();
  next = take();
  piece = { k, m: PIECES[k].m, x: (COLS - PIECES[k].m.length) / 2 | 0, y: 0 };
  if (blocked(piece.m, piece.x, piece.y)) gameOver();
}
function reset() {
  board = empty(); bag = []; next = null;
  score = lines = 0; level = 1; fallT = moveT = flash = 0;
  state = 'play';
  spawn();
}
function gameOver() {
  state = 'over';
  best = Math.max(best, score);
  Engine.score(score);
}
function move(dx, dy) {
  if (blocked(piece.m, piece.x + dx, piece.y + dy)) return false;
  piece.x += dx; piece.y += dy;
  return true;
}
function turn(times) {
  let m = piece.m;
  for (let i = 0; i < times; i++) m = rotate(m);
  for (const dx of [0, -1, 1, -2, 2]) if (!blocked(m, piece.x + dx, piece.y)) { piece.m = m; piece.x += dx; return; }
}
function lock() {
  for (let r = 0; r < piece.m.length; r++) for (let c = 0; c < piece.m.length; c++) {
    if (!piece.m[r][c]) continue;
    if (piece.y + r < 0) return gameOver();
    board[piece.y + r][piece.x + c] = PIECES[piece.k].c;
  }
  board = board.filter(row => !row.every(Boolean));
  const n = ROWS - board.length;
  while (board.length < ROWS) board.unshift(Array(COLS).fill(0));
  if (n) { lines += n; score += POINTS[n] * level; level = 1 + (lines / 10 | 0); flash = 0.35; }
  Engine.score(score);
  spawn();
}
const ghostY = () => { let y = piece.y; while (!blocked(piece.m, piece.x, y + 1)) y++; return y; };

function cell(ctx, x, y, color, size) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.fillRect(x + 1, y + 1, size - 2, 3);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(x + 1, y + size - 4, size - 2, 3);
}
function drawShape(ctx, m, x, y, color, size) {
  m.forEach((row, r) => row.forEach((v, c) => { if (v) cell(ctx, x + c * size, y + r * size, color, size); }));
}

Engine.start({
  width: W, height: H,

  init(data) {
    best = data.best;
    board = empty();
    state = 'ready';
  },

  update(dt) {
    flash = Math.max(0, flash - dt);
    if (state !== 'play') { if (Engine.hit('action')) reset(); return; }

    // tap = one step, hold = repeat after a short delay
    for (const [k, dx] of [['left', -1], ['right', 1]]) if (Engine.hit(k)) { move(dx, 0); moveT = -0.12; }
    const dir = Engine.down('right') - Engine.down('left');
    if (dir && (moveT += dt) >= 0.05) { move(dir, 0); moveT = 0; }

    if (Engine.hit('up') || Engine.hit('KeyX')) turn(1);
    if (Engine.hit('KeyZ')) turn(3);
    if (Engine.hit('action')) {
      while (move(0, 1)) score += 2;
      return lock();
    }

    const soft = Engine.down('down');
    fallT += dt;
    if (fallT >= (soft ? 0.04 : Math.max(0.05, 0.8 * 0.85 ** (level - 1)))) {
      fallT = 0;
      if (!move(0, 1)) lock();
      else if (soft) score++;
    }
  },

  draw(ctx) {
    ctx.fillStyle = '#0e141b';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#151f2b';
    ctx.fillRect(BX - 4, BY - 4, COLS * S + 8, ROWS * S + 8);
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    for (let c = 1; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(BX + c * S, BY); ctx.lineTo(BX + c * S, BY + ROWS * S); ctx.stroke(); }
    for (let r = 1; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(BX, BY + r * S); ctx.lineTo(BX + COLS * S, BY + r * S); ctx.stroke(); }

    board.forEach((row, r) => row.forEach((v, c) => { if (v) cell(ctx, BX + c * S, BY + r * S, v, S); }));
    if (state === 'play') {
      ctx.globalAlpha = 0.2;
      drawShape(ctx, piece.m, BX + piece.x * S, BY + ghostY() * S, PIECES[piece.k].c, S);
      ctx.globalAlpha = 1;
      drawShape(ctx, piece.m, BX + piece.x * S, BY + piece.y * S, PIECES[piece.k].c, S);
    }
    if (flash) {
      ctx.fillStyle = 'rgba(255,255,255,' + flash * 0.4 + ')';
      ctx.fillRect(BX, BY, COLS * S, ROWS * S);
    }

    const px = BX + COLS * S + 24;
    Engine.text('NEXT', px, 34, 13, '#8f98a0', 'left');
    if (next) drawShape(ctx, PIECES[next].m, px, 50, PIECES[next].c, 18);
    [['SCORE', score], ['LINES', lines], ['LEVEL', level], ['BEST', Math.max(best, score || 0)]].forEach(([label, v], i) => {
      Engine.text(label, px, 150 + i * 60, 13, '#8f98a0', 'left');
      Engine.text(String(v || 0), px, 172 + i * 60, 22, '#fff', 'left');
    });

    if (state !== 'play') {
      ctx.fillStyle = 'rgba(11,15,20,.82)';
      ctx.fillRect(BX, BY, COLS * S, ROWS * S);
      const cx = BX + COLS * S / 2;
      if (state === 'over') {
        Engine.text('GAME OVER', cx, 150, 26, '#f2617a');
        Engine.text('Score ' + score, cx, 185, 16);
      } else Engine.text('STACKFALL', cx, 150, 28, '#4fd1e8');
      ['← →  move', '↑ / X  rotate', 'Z  rotate back', '↓  soft drop', 'Space  hard drop'].forEach((t, i) => Engine.text(t, cx, 240 + i * 24, 13, '#8f98a0'));
      Engine.text('Press Space to ' + (state === 'over' ? 'play again' : 'start'), cx, 390, 15);
    }
  },
});
