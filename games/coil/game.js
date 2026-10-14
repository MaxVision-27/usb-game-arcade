// Coil: steer a growing line, eat sparks, don't hit the walls or yourself.
const C = 24, R = 18, S = 20, TOP = 40, W = C * S, H = R * S + TOP;
const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
let snake, dir, queue, food, score, best, state, stepT, time;

const rand = n => Math.random() * n | 0;
function place() {
  do food = { x: rand(C), y: rand(R) }; while (snake.some(p => p.x === food.x && p.y === food.y));
}
function reset() {
  snake = [{ x: 6, y: 9 }, { x: 5, y: 9 }, { x: 4, y: 9 }];
  dir = DIRS.right; queue = []; score = 0; stepT = 0;
  state = 'play';
  place();
}
function gameOver() {
  state = 'over';
  best = Math.max(best, score);
  Engine.score(score);
}

Engine.start({
  width: W, height: H,

  init(data) {
    best = data.best;
    time = 0;
    snake = [];
    state = 'ready';
  },

  update(dt) {
    time += dt;
    if (state !== 'play') { if (Engine.hit('action')) reset(); return; }
    for (const k in DIRS) if (Engine.hit(k) && queue.length < 3) queue.push(DIRS[k]);

    stepT += dt;
    if (stepT < Math.max(0.055, 0.12 - score * 0.002)) return;
    stepT = 0;
    // take the first queued turn that is a real turn (not straight ahead or straight back)
    while (queue.length) { const d = queue.shift(); if (d[0] * dir[0] + d[1] * dir[1] === 0) { dir = d; break; } }

    const head = { x: snake[0].x + dir[0], y: snake[0].y + dir[1] };
    const eat = head.x === food.x && head.y === food.y;
    if (!eat) snake.pop();
    if (head.x < 0 || head.y < 0 || head.x >= C || head.y >= R || snake.some(p => p.x === head.x && p.y === head.y)) return gameOver();
    snake.unshift(head);
    if (eat) {
      score++;
      Engine.score(score);
      if (snake.length === C * R) return gameOver();
      place();
    }
  },

  draw(ctx) {
    ctx.fillStyle = '#0c1210';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < R; y++) for (let x = (y % 2); x < C; x += 2) {
      ctx.fillStyle = '#101915';
      ctx.fillRect(x * S, TOP + y * S, S, S);
    }
    Engine.text('SCORE ' + (score || 0), 14, TOP / 2, 16, '#fff', 'left');
    Engine.text('BEST ' + Math.max(best, score || 0), W - 14, TOP / 2, 16, '#8f98a0', 'right');

    if (food && state !== 'ready') {
      const glow = 6 + Math.sin(time * 6) * 3;
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = glow * 2;
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(food.x * S + S / 2, TOP + food.y * S + S / 2, S / 2 - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    snake.forEach((p, i) => {
      const t = i / Math.max(1, snake.length - 1);
      ctx.fillStyle = 'hsl(' + (150 - t * 40) + ',70%,' + (62 - t * 25) + '%)';
      ctx.beginPath();
      ctx.roundRect(p.x * S + 1, TOP + p.y * S + 1, S - 2, S - 2, i ? 5 : 8);
      ctx.fill();
    });
    if (snake.length) {
      const h = snake[0], cx = h.x * S + S / 2 + dir[0] * 3, cy = TOP + h.y * S + S / 2 + dir[1] * 3;
      ctx.fillStyle = '#0c1210';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + dir[1] * 4 * s, cy + dir[0] * 4 * s, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (state !== 'play') {
      ctx.fillStyle = 'rgba(12,18,16,.8)';
      ctx.fillRect(0, TOP, W, R * S);
      if (state === 'over') {
        Engine.text('GAME OVER', W / 2, 140, 28, '#f2617a');
        Engine.text('Score ' + score, W / 2, 178, 16);
      } else Engine.text('COIL', W / 2, 150, 34, '#7ef0b0');
      Engine.text('Arrows / WASD to steer · eat the sparks', W / 2, 240, 14, '#8f98a0');
      Engine.text('Press Space to ' + (state === 'over' ? 'play again' : 'start'), W / 2, 290, 15);
    }
  },
});
