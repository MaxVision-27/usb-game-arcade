// Ore Mill: click the rock, buy machines, they keep mining while you're away (up to 8 hours).
const W = 720, H = 440, ROCK = { x: 190, y: 260, r: 120 };
const SHOP = [
  { name: 'Sharper Pick', info: '+1 ore per click', cost: 50, click: 1 },
  { name: 'Hand Drill', info: '+0.5 ore/s', cost: 20, rate: 0.5 },
  { name: 'Ore Cart', info: '+4 ore/s', cost: 160, rate: 4 },
  { name: 'Steam Rig', info: '+20 ore/s', cost: 1400, rate: 20 },
  { name: 'Deep Shaft', info: '+120 ore/s', cost: 15000, rate: 120 },
  { name: 'Magma Pump', info: '+700 ore/s', cost: 170000, rate: 700 },
  { name: 'Core Tap', info: '+4,000 ore/s', cost: 2000000, rate: 4000 },
];
const ROW = { x: 390, y: 70, w: 310, h: 44, gap: 6 };
const AWAY_CAP = 8 * 3600;
const PTS = Array.from({ length: 16 }, (_, i) => {
  const a = i / 16 * Math.PI * 2, k = 0.84 + 0.16 * Math.abs(Math.sin(i * 2.7));
  return [Math.cos(a) * k, Math.sin(a) * k];
});
const SPECKS = [[-0.35, -0.25, 0.1], [0.28, -0.42, 0.07], [0.42, 0.12, 0.11], [-0.08, 0.36, 0.08], [-0.52, 0.22, 0.06], [0.06, -0.04, 0.06], [0.2, 0.45, 0.05]];
let ore, total, own, chips, away, bump, saveT;

const fmt = n => n < 1000 ? String(Math.floor(n)) : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const cost = i => Math.ceil(SHOP[i].cost * 1.15 ** own[i]);
const rate = () => SHOP.reduce((s, it, i) => s + (it.rate || 0) * own[i], 0);
const perClick = () => 1 + SHOP.reduce((s, it, i) => s + (it.click || 0) * own[i], 0);
const rowAt = (p) => SHOP.findIndex((_, i) => p.x >= ROW.x && p.x <= ROW.x + ROW.w && p.y >= ROW.y + i * (ROW.h + ROW.gap) && p.y <= ROW.y + i * (ROW.h + ROW.gap) + ROW.h);

function save() {
  saveT = 0;
  Engine.save({ ore, total, own, t: Date.now() });
  Engine.score(Math.floor(total));
}
function mine(x, y) {
  const n = perClick();
  ore += n; total += n; bump = 1;
  chips.push({ x, y, t: 0.9, text: '+' + fmt(n) });
  if (chips.length > 30) chips.shift();
}
function buy(i) {
  if (ore < cost(i)) return;
  ore -= cost(i);
  own[i]++;
  save();
}

Engine.start({
  width: W, height: H,

  init(data) {
    const s = data.state || {};
    ore = s.ore || 0; total = s.total || 0;
    own = SHOP.map((_, i) => (s.own && s.own[i]) || 0);
    chips = []; bump = 0; saveT = 0; away = null;
    if (s.t) {
      const gain = rate() * Math.min(Math.max(0, (Date.now() - s.t) / 1000), AWAY_CAP);
      if (gain >= 1) { ore += gain; total += gain; away = { text: 'While you were away: +' + fmt(gain) + ' ore', t: 6 }; }
    }
  },

  update(dt) {
    const r = rate() * dt;
    ore += r; total += r;
    const m = Engine.mouse;
    if (m.hit) {
      if (Math.hypot(m.x - ROCK.x, m.y - ROCK.y) < ROCK.r) mine(m.x, m.y);
      const i = rowAt(m);
      if (i >= 0) buy(i);
    }
    if (Engine.hit('action')) mine(ROCK.x + (Math.random() - 0.5) * 120, ROCK.y - 40);
    SHOP.forEach((_, i) => { if (Engine.hit('Digit' + (i + 1))) buy(i); });

    chips.forEach(c => { c.t -= dt; c.y -= 50 * dt; });
    chips = chips.filter(c => c.t > 0);
    bump = Math.max(0, bump - dt * 6);
    if (away) away.t -= dt;
    if ((saveT += dt) >= 10) save();
  },

  onPause: save,

  draw(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1d1712');
    g.addColorStop(1, '#0d0b09');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    Engine.text(fmt(ore) + ' ore', ROCK.x, 46, 30, '#ffd27a');
    Engine.text((rate() < 100 ? rate().toFixed(1) : fmt(rate())) + ' ore/s  ·  ' + fmt(perClick()) + ' per click', ROCK.x, 82, 13, '#b8a48c');

    // rock
    const k = ROCK.r * (1 - bump * 0.05);
    ctx.save();
    ctx.translate(ROCK.x, ROCK.y);
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 30;
    const rg = ctx.createRadialGradient(-k * 0.3, -k * 0.4, k * 0.1, 0, 0, k);
    rg.addColorStop(0, '#8a8178');
    rg.addColorStop(1, '#3d3732');
    ctx.fillStyle = rg;
    ctx.beginPath();
    PTS.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x * k, y * k));
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    for (const [x, y, s] of SPECKS) {
      ctx.fillStyle = '#f2a33a';
      ctx.beginPath();
      ctx.arc(x * k, y * k, s * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,180,.6)';
      ctx.beginPath();
      ctx.arc(x * k - s * k * 0.3, y * k - s * k * 0.3, s * k * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    chips.forEach(c => {
      ctx.globalAlpha = Math.min(1, c.t * 2);
      Engine.text(c.text, c.x, c.y, 18, '#ffd27a');
    });
    ctx.globalAlpha = 1;
    Engine.text('Click the rock or press Space · 1–7 buys', ROCK.x, H - 22, 12, '#7d6f60');

    // shop
    Engine.text('MACHINES', ROW.x, 46, 13, '#b8a48c', 'left');
    const hover = rowAt(Engine.mouse);
    SHOP.forEach((it, i) => {
      const y = ROW.y + i * (ROW.h + ROW.gap), ok = ore >= cost(i);
      ctx.fillStyle = i === hover && ok ? '#3a2e22' : '#241d17';
      ctx.fillRect(ROW.x, y, ROW.w, ROW.h);
      ctx.fillStyle = ok ? '#f2a33a' : '#4a3d31';
      ctx.fillRect(ROW.x, y, 4, ROW.h);
      ctx.globalAlpha = ok ? 1 : 0.45;
      Engine.text((i + 1) + '  ' + it.name, ROW.x + 14, y + 15, 15, '#fff', 'left');
      Engine.text(it.info + '  ·  costs ' + fmt(cost(i)), ROW.x + 14, y + 32, 11, '#b8a48c', 'left');
      Engine.text(String(own[i]), ROW.x + ROW.w - 14, y + ROW.h / 2, 22, '#ffd27a', 'right');
      ctx.globalAlpha = 1;
    });

    if (away && away.t > 0) {
      ctx.globalAlpha = Math.min(1, away.t);
      ctx.fillStyle = '#f2a33a';
      ctx.fillRect(ROCK.x - 170, 100, 340, 30);
      Engine.text(away.text, ROCK.x, 115, 14, '#1d1712');
      ctx.globalAlpha = 1;
    }
  },
});
