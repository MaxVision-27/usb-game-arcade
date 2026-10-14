/* Arcade engine. Classic script, no dependencies. Load it from a game's index.html:
 *   <script src="../../app/engine.js"></script>
 *
 * In game.js:
 *   Engine.start({
 *     width: 400, height: 300,   your game's size in pixels; the canvas is scaled to fit the screen
 *     init(data) {},             once at start. data = { best, state } from the save
 *     update(dt) {},             60 times a second, dt = 1/60
 *     draw(ctx) {},              every frame. ctx is a normal 2D canvas context, in your pixels
 *     onPause() {}               optional. The launcher paused you: a good moment to Engine.save()
 *   });
 *
 *   Engine.down(k)          is key k held?
 *   Engine.hit(k)           was key k pressed since the last update?
 *   Engine.hit(k, true)     same, but also true on the keyboard's auto-repeat while held
 *                           k: 'left' 'right' 'up' 'down' (arrows or WASD), 'action' (Space or Enter),
 *                           or any KeyboardEvent.code: 'KeyZ', 'Digit1', 'ShiftLeft', ...
 *   Engine.mouse            { x, y, down, hit } in your pixels. hit = clicked since the last update
 *   Engine.text(s, x, y, size = 16, color = '#fff', align = 'center')
 *   Engine.score(n)         report a score. The launcher keeps the best one
 *   Engine.save(state)      store any JSON value. It comes back as data.state next time
 *
 * Reserved keys, handled for you: Esc pause, F fullscreen, ` hide screen.
 * Opening a game's index.html directly also works (no saves) — handy while writing one.
 */
(function () {
  const ALIAS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'action', Enter: 'action' };
  const RESERVED = { Escape: 'pause', KeyF: 'fullscreen', Backquote: 'boss' };
  const STEP = 1000 / 60;
  const held = new Set(), hits = new Set(), reps = new Set();
  const mouse = { x: 0, y: 0, down: false, hit: false };
  const inFrame = parent !== window;
  const post = m => { if (inFrame) parent.postMessage(m, '*'); };
  let game, canvas, ctx, paused = false, running = false;

  const names = code => (ALIAS[code] ? [code, ALIAS[code]] : [code]);
  addEventListener('keydown', e => {
    if (RESERVED[e.code] && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      if (e.repeat) return;
      if (inFrame) post({ type: RESERVED[e.code] });
      else if (e.code === 'Escape') paused = !paused;
      return;
    }
    if (ALIAS[e.code]) e.preventDefault();
    for (const n of names(e.code)) {
      if (!e.repeat) { held.add(n); hits.add(n); }
      reps.add(n);
    }
  });
  addEventListener('keyup', e => names(e.code).forEach(n => held.delete(n)));
  addEventListener('blur', () => { held.clear(); mouse.down = false; post({ type: 'blur' }); });

  function point(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width * game.width;
    mouse.y = (e.clientY - r.top) / r.height * game.height;
  }
  function fit() {
    const s = Math.min(innerWidth / game.width, innerHeight / game.height), d = devicePixelRatio || 1;
    canvas.style.width = game.width * s + 'px';
    canvas.style.height = game.height * s + 'px';
    canvas.width = Math.round(game.width * s * d);
    canvas.height = Math.round(game.height * s * d);
    ctx.setTransform(canvas.width / game.width, 0, 0, canvas.height / game.height, 0, 0);
  }

  function begin(data) {
    if (running) return;
    running = true;
    game.init({ best: data.best || 0, state: data.state === undefined ? null : data.state });
    let last = performance.now(), acc = 0;
    requestAnimationFrame(function frame(now) {
      requestAnimationFrame(frame);
      acc += Math.min(now - last, 250);
      last = now;
      if (paused) { acc = 0; hits.clear(); reps.clear(); mouse.hit = false; }
      while (acc >= STEP) {
        game.update(STEP / 1000);
        hits.clear(); reps.clear(); mouse.hit = false;
        acc -= STEP;
      }
      game.draw(ctx);
    });
  }

  addEventListener('message', e => {
    if (e.source !== parent) return;
    const m = e.data || {};
    if (m.type === 'init') begin(m);
    else if (m.type === 'pause') { paused = true; if (game.onPause) game.onPause(); }
    else if (m.type === 'resume') paused = false;
  });

  window.Engine = {
    start(g) {
      game = g;
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
      document.body.style.cssText = 'margin:0;height:100vh;display:grid;place-items:center;overflow:hidden;background:#0b0f14';
      document.body.append(canvas);
      fit();
      addEventListener('resize', fit);
      canvas.addEventListener('pointerdown', e => { point(e); mouse.down = mouse.hit = true; });
      addEventListener('pointermove', point);
      addEventListener('pointerup', () => { mouse.down = false; });
      if (inFrame) post({ type: 'ready' }); else begin({});
    },
    down: k => held.has(k),
    hit: (k, repeat) => (repeat ? reps : hits).has(k),
    mouse,
    text(s, x, y, size = 16, color = '#fff', align = 'center') {
      ctx.font = '600 ' + size + 'px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillText(s, x, y);
    },
    score: n => post({ type: 'score', value: n }),
    save: state => post({ type: 'save', state }),
  };
})();
