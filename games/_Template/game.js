// Template game: move the square, collect dots. Copy this folder, rename it (no leading _), and edit.
// The full engine API is listed at the top of app/engine.js.
let p, dot, score, best, total;

function newDot() { dot = { x: 20 + Math.random() * 280, y: 40 + Math.random() * 140 }; }

Engine.start({
  width: 320, height: 200,              // your game's size in pixels; it's scaled to fit the screen

  init(data) {                          // data.best = best score so far, data.state = what you last saved
    best = data.best;
    total = (data.state && data.state.total) || 0;
    p = { x: 160, y: 110 };
    score = 0;
    newDot();
  },

  update(dt) {                          // 60 times a second
    const step = 140 * dt;
    if (Engine.down('left')) p.x -= step;
    if (Engine.down('right')) p.x += step;
    if (Engine.down('up')) p.y -= step;
    if (Engine.down('down')) p.y += step;
    if (Engine.mouse.down) {            // hold the mouse to pull the square toward it
      p.x += Math.sign(Engine.mouse.x - p.x) * step;
      p.y += Math.sign(Engine.mouse.y - p.y) * step;
    }
    p.x = Math.max(8, Math.min(312, p.x));
    p.y = Math.max(32, Math.min(192, p.y));

    if (Engine.hit('action')) score = 0;  // Space / Enter

    if (Math.hypot(p.x - dot.x, p.y - dot.y) < 12) {
      score++;
      total++;
      Engine.score(score);              // the launcher keeps the best
      newDot();
    }
  },

  draw(ctx) {
    ctx.fillStyle = '#0e141b';
    ctx.fillRect(0, 0, 320, 200);
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4fc3f7';
    ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
    Engine.text('Score ' + score + '   Best ' + Math.max(best, score), 160, 14, 12);
    Engine.text('Dots ever collected: ' + total + '   (Space resets score)', 160, 190, 9, '#8f98a0');
  },

  onPause() { Engine.save({ total }); },  // optional: called when the launcher pauses the game
});
