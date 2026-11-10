// Gambit — chess trainer: openings, tactics, endgames and games against the computer
import { Chess } from './chess.js';
import { OPENINGS } from './openings.js';
import { NOTES } from './notes.js';
import { PUZZLES } from './puzzles.js';
import { ENDGAMES } from './endgames.js';
import { Engine, winning, losing, flip } from './engine.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const MIN = 6e4, H = 36e5, DAY = 864e5;
const MAX = 6; // level 6 = mastered
// how long to wait before the next review once a line reaches level n
const IV = [0, 4 * H, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= opening data ================= */
const COMMENTS = new Map(); // "position|move" -> explanation
const byId = {}, lineById = {};
const fen4 = f => f.split(' ').slice(0, 4).join(' ');
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function parsePgn(p) {
  const out = [], re = /\{([^}]*)\}|(\S+)/g;
  let m;
  while ((m = re.exec(p))) {
    if (m[1] !== undefined) { if (out.length) out[out.length - 1].c = m[1].trim(); continue; }
    const t = m[2].replace(/^\d+\.(\.\.)?/, '');
    if (t) out.push({ san: t });
  }
  return out;
}
for (const op of OPENINGS) {
  byId[op.id] = op;
  op.par = op.side === 'w' ? 0 : 1;
  op.lines.forEach((ln, i) => {
    Object.assign(ln, { op, i, id: op.id + ':' + slug(ln.name), moves: [], vm: [] });
    lineById[ln.id] = ln;
    const g = new Chess();
    ln.fens = [g.fen()];
    for (const t of parsePgn(ln.pgn)) {
      const before = fen4(g.fen()), m = g.move(t.san);
      ln.moves.push(m.san);
      ln.vm.push({ from: m.from, to: m.to, captured: m.captured, san: m.san, flags: m.flags, color: m.color, promotion: m.promotion });
      ln.fens.push(g.fen());
      const key = before + '|' + m.san;
      if (t.c && !COMMENTS.has(key)) COMMENTS.set(key, t.c);
    }
  });
}
const ALL = OPENINGS.flatMap(o => o.lines);
const isMine = (ln, k) => (k & 1) === ln.op.par;
// explanation of the move played at ply k-1 (i.e. the move that leads to position k)
const commentAt = (ln, k) => (k > 0 ? COMMENTS.get(fen4(ln.fens[k - 1]) + '|' + ln.moves[k - 1]) || '' : '');
const moveLabel = (k, san) => `${(k >> 1) + 1}.${k & 1 ? '..' : ''}${san}`;
const colour = k => (k & 1 ? 'Black' : 'White');
const movesText = (moves, from = 0) =>
  moves.map((s, i) => { const k = from + i; return k & 1 ? (i ? s : `${(k + 1) >> 1}...${s}`) : `${(k >> 1) + 1}.${s}`; }).join(' ');
for (const [opId, li, label, text] of NOTES) {
  const ln = byId[opId] && byId[opId].lines[li];
  const k = ln ? ln.moves.findIndex((s, i) => moveLabel(i, s) === label) : -1;
  if (k < 0) continue;
  const key = fen4(ln.fens[k]) + '|' + ln.moves[k];
  if (!COMMENTS.has(key)) COMMENTS.set(key, text);
}
function branches(ln, k) {
  const map = new Map();
  for (const L of ln.op.lines) {
    if (L.moves.length <= k) continue;
    let same = true;
    for (let i = 0; i < k; i++) if (L.moves[i] !== ln.moves[i]) { same = false; break; }
    if (!same) continue;
    if (!map.has(L.moves[k])) map.set(L.moves[k], []);
    map.get(L.moves[k]).push(L);
  }
  return map;
}
function branchText(ln) {
  const base = ln.op.lines[0];
  let k = 0;
  if (ln === base) k = ln.op.start;
  else while (k < ln.moves.length && ln.moves[k] === base.moves[k]) k++;
  return movesText(ln.moves.slice(k, k + 6), k) + (ln.moves.length > k + 6 ? ' …' : '');
}
const findMove = (g, from, to, promo = 'q') =>
  g.moves({ square: from, verbose: true }).find(m => m.to === to && (!m.promotion || m.promotion === promo));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ================= saved progress ================= */
const KEY = 'gambit.v2';
const FRESH = () => ({ lines: {}, weak: {}, log: {}, xp: 0, pz: {}, prating: 1000, pn: 0, eg: {}, games: { w: 0, l: 0, d: 0 },
  elo: { r: 800, n: 0, peak: 800, w: 0, l: 0, d: 0, hist: [] }, beat: {}, live: null });
const S = { ...FRESH(), sound: true, theme: 'green', perDay: 2, bot: 1, warn: true, rated: false, tc: 0 };
try {
  const saved = localStorage.getItem(KEY);
  if (saved) Object.assign(S, JSON.parse(saved));
  else {
    const v1 = JSON.parse(localStorage.getItem('gambit.v1') || 'null');
    if (v1) {
      for (const id of Object.keys(v1.lines || {})) if (lineById[id]) S.lines[id] = { lvl: 1, due: Date.now(), seen: Date.now() };
      S.xp = v1.xp || 0;
      S.sound = v1.sound !== false;
      if (v1.day) S.log[v1.day] = { n: 1, c: 0, t: 0, nw: 0 };
    }
  }
} catch {}
if (!S.botv) { S.bot = [0, 2, 5, 7][S.bot] ?? 2; S.botv = 2; }   // four old levels onto the bot ladder
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
const noon = (t = Date.now()) => { const d = new Date(t); d.setHours(12, 0, 0, 0); return d.getTime(); };
const dkey = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA');
const today = () => S.log[dkey()] || (S.log[dkey()] = { n: 0, c: 0, t: 0, nw: 0 });
function streak() {
  let t = noon(), s = 0;
  if (!S.log[dkey(t)]?.n) t -= DAY; // today not trained yet: the streak is still alive from yesterday
  while (S.log[dkey(t)]?.n) { s++; t -= DAY; }
  return s;
}
function accuracy(days = 7) {
  let c = 0, t = 0;
  for (let i = 0; i < days; i++) { const d = S.log[dkey(noon() - i * DAY)]; if (d) { c += d.c; t += d.t; } }
  return t ? Math.round((100 * c) / t) : null;
}
const rec = ln => S.lines[ln.id];
const level = ln => rec(ln)?.lvl || 0;
const isDue = ln => { const r = rec(ln); return !!r && r.due <= Date.now(); };
function stage(ln) { const l = level(ln); if (!l) return 'new'; if (isDue(ln)) return 'due'; return l >= MAX ? 'mastered' : 'learning'; }
const mastery = op => op.lines.reduce((s, l) => s + level(l), 0) / (MAX * op.lines.length);
const learnedIn = op => op.lines.filter(l => rec(l)).length;
function counts() {
  const c = { new: 0, learning: 0, mastered: 0, due: 0 };
  for (const ln of ALL) { const l = level(ln); if (!l) c.new++; else if (l >= MAX) c.mastered++; else c.learning++; if (isDue(ln)) c.due++; }
  c.learned = c.learning + c.mastered;
  return c;
}
const addXP = n => { S.xp += n; if (R) R.stats.xp += n; };

function learned(ln) {
  S.lines[ln.id] = { lvl: 1, due: Date.now() + IV[1], seen: Date.now() };
  today().nw++;
}
function reviewed(ln, perfect) {
  const r = rec(ln), now = Date.now(), before = r.lvl, wasDue = r.due <= now;
  if (perfect) { if (wasDue) { r.lvl = Math.min(MAX, r.lvl + 1); r.due = now + IV[r.lvl]; } }
  else { r.lvl = Math.max(1, r.lvl - (wasDue ? 2 : 1)); r.due = now + 10 * MIN; }
  r.seen = now;
  return { before, after: r.lvl, wasDue };
}
const wkey = (ln, k) => ln.id + '@' + k;
const miss = (ln, k) => { S.weak[wkey(ln, k)] = 2; };
const hit = (ln, k) => { const key = wkey(ln, k); if (S.weak[key] && --S.weak[key] <= 0) delete S.weak[key]; };
function weakList() {
  return Object.keys(S.weak).map(key => { const at = key.lastIndexOf('@'), ln = lineById[key.slice(0, at)], k = +key.slice(at + 1); return ln && ln.moves[k] ? { ln, k } : null; }).filter(Boolean);
}
function fmtDue(t) {
  const d = t - Date.now();
  if (d <= 15 * MIN) return 'in a few minutes';
  if (d < 20 * H) { const h = Math.round(d / H); return h <= 1 ? 'in about an hour' : `in ${h} hours`; }
  const days = Math.round(d / DAY);
  return days <= 1 ? 'tomorrow' : `in ${days} days`;
}

// daily plan: reviews that are due, then new lines (finish openings you started first)
function freshLines(n) {
  const out = [], rem = OPENINGS.map(o => o.lines.filter(l => !rec(l)));
  const roundRobin = idx => {
    let more = true;
    while (more && out.length < n) { more = false; for (const i of idx) if (rem[i].length && out.length < n) { out.push(rem[i].shift()); more = true; } }
  };
  roundRobin(OPENINGS.map((o, i) => i).filter(i => OPENINGS[i].lines.some(l => rec(l))));
  roundRobin(OPENINGS.map((o, i) => i));
  return out;
}
function plan() {
  const due = ALL.filter(isDue).sort((a, b) => rec(a).due - rec(b).due).slice(0, 20);
  const fresh = freshLines(Math.max(0, S.perDay - (S.log[dkey()]?.nw || 0)));
  return { due, fresh };
}

/* ================= sound ================= */
let AC = null;
const BUF = {};
// real recordings of wooden pieces (Stefan Haack, chess-console, CC BY 4.0); see sounds/CREDITS.txt
const SOUND_FILES = ['move', 'move-opp', 'capture', 'castle', 'check', 'promote', 'illegal'];
let soundSide = 'w'; // the colour you are playing on the current screen
function audio() {
  try {
    if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); loadSounds(); }
    if (AC.state === 'suspended') AC.resume();
  } catch {}
}
function loadSounds() {
  for (const n of SOUND_FILES) {
    fetch(`sounds/${n}.wav`)
      .then(r => r.arrayBuffer())
      .then(ab => new Promise((res, rej) => AC.decodeAudioData(ab, res, rej)))
      .then(b => { BUF[n] = b; })
      .catch(() => {});
  }
}
function play(n, vol = 1) {
  if (!S.sound || !AC || !BUF[n]) return false;
  const s = AC.createBufferSource(), g = AC.createGain();
  s.buffer = BUF[n];
  g.gain.value = vol;
  s.connect(g).connect(AC.destination);
  s.start();
  return true;
}
// pick the sound the way chess.com does: check > promotion > castling > capture > your move / their move
function moveSound(m) {
  if (!m) return;
  const san = m.san || '', fl = m.flags || '';
  const n = /[+#]/.test(san) ? 'check' : m.promotion ? 'promote' : /[kq]/.test(fl) ? 'castle' : m.captured ? 'capture' : m.color && m.color !== soundSide ? 'move-opp' : 'move';
  play(n);
}
// only real piece sounds: no beeps, chimes or jingles anywhere
const sfx = {
  move: moveSound,
  bad: () => play('illegal'),
  good: () => {},
  done: () => {}
};

/* ================= icons ================= */
const ICONS = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  first: '<path d="M18 18l-6-6 6-6M8 6v12"/>',
  last: '<path d="M6 6l6 6-6 6M16 6v12"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  chart: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M15.1 14c.2-1 .7-1.7 1.4-2.5A4.7 4.7 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.8 1.2 1.5 1.4 2.5"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  restart: '<path d="M3 4v6h6"/><path d="M3.6 15a9 9 0 1 0 2.1-9.4L3 10"/>',
  flip: '<path d="M3 16l4 4 4-4M7 20V4M21 8l-4-4-4 4M17 4v16"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  award: '<circle cx="12" cy="8" r="6.5"/><path d="M8.2 13.6L7 22l5-3 5 3-1.2-8.4"/>',
  shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  layers: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
  swords: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 6.5L13 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/>',
  crown: '<path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7z"/><path d="M5 21h14"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4.5L17 13H4"/>',
  play: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

/* ================= board ================= */
const FILES = 'abcdefgh';
class Board {
  constructor(el, { mini = false, onMove = null } = {}) {
    Object.assign(this, { el, mini, onMove, flip: false, g: null, last: null, sel: null, targets: [], hintSq: null, arrow: null, interactive: false, side: null, drag: null, promo: null });
    el.classList.add('board');
    // a board you move pieces on keeps the page still under your finger; a board you only look at scrolls with the page
    if (onMove) el.classList.add('play');
    if (mini) el.classList.add('mini'); else this.bind();
  }
  set(g, { flip = this.flip, last = null, arrow = null, badge = null } = {}) {
    Object.assign(this, { g, flip, last, arrow, badge, sel: null, targets: [], hintSq: null, promo: null });
    this.render();
  }
  name(r, c) { return FILES[this.flip ? 7 - c : c] + (this.flip ? r + 1 : 8 - r); }
  pos(sq) { const f = FILES.indexOf(sq[0]), k = +sq[1]; return { c: this.flip ? 7 - f : f, r: this.flip ? k - 1 : 8 - k }; }
  cell(sq) { const { r, c } = this.pos(sq); return this.el.children[r * 8 + c]; }
  king(color) { for (const row of this.g.board()) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square; }
  render() {
    const g = this.g, chk = g && g.inCheck() ? this.king(g.turn()) : null;
    let h = '';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const sq = this.name(r, c), p = g && g.get(sq);
      let cls = 'sq ' + ((r + c) % 2 ? 'd' : 'l');
      if (this.last && (sq === this.last.from || sq === this.last.to)) cls += ' last';
      if (sq === this.sel) cls += ' sel';
      if (sq === this.hintSq) cls += ' hint';
      if (sq === chk) cls += ' chk';
      if (this.targets.includes(sq)) cls += p ? ' cap' : ' dot';
      let inner = p ? `<i class="pc ${p.color}${p.type.toUpperCase()}"></i>` : '';
      if (this.badge && sq === this.badge.sq) inner += this.badge.html.replace('class="mk', 'class="mk bdg');
      if (!this.mini) {
        if (c === 0) inner += `<b class="rk">${sq[1]}</b>`;
        if (r === 7) inner += `<b class="fl">${sq[0]}</b>`;
      }
      h += `<div class="${cls}">${inner}</div>`;
    }
    if (this.arrow) h += this.arrowSvg(this.arrow);
    if (this.promo) h += this.promoHtml(this.promo);
    this.el.innerHTML = h;
  }
  // the four pieces a pawn can become, stacked on the promotion square the way chess.com shows them
  promoHtml({ to }) {
    const { r, c } = this.pos(to), col = this.g.turn(), up = r > 3;
    return `<div class="promo"><div class="promo-col${up ? ' up' : ''}" style="left:${c * 12.5}%;top:${(up ? r - 3 : r) * 12.5}%">${['q', 'n', 'r', 'b'].map(t => `<i class="pc ${col}${t.toUpperCase()}" data-promo="${t}" role="button" aria-label="Promote to ${PIECE_NAME[t]}"></i>`).join('')}</div></div>`;
  }
  // a move chosen on the board: ask which piece first when it is a promotion
  commit(from, to, anim) {
    if (!this.onMove) return;
    if (this.g.moves({ square: from, verbose: true }).some(m => m.to === to && m.promotion)) { this.promo = { from, to, anim }; this.sel = null; this.targets = []; this.render(); return; }
    this.onMove(from, to, anim);
  }
  arrowSvg({ from, to }) {
    const a = this.pos(from), b = this.pos(to), f = n => n.toFixed(3);
    const x1 = a.c + 0.5, y1 = a.r + 0.5, x2 = b.c + 0.5, y2 = b.r + 0.5;
    const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, px = -uy, py = ux;
    const tx = x2 - ux * 0.12, ty = y2 - uy * 0.12, bx = tx - ux * 0.42, by = ty - uy * 0.42;
    return `<svg class="arrow" viewBox="0 0 8 8"><line x1="${f(x1 + ux * 0.2)}" y1="${f(y1 + uy * 0.2)}" x2="${f(bx)}" y2="${f(by)}"/><polygon points="${f(tx)},${f(ty)} ${f(bx + px * 0.26)},${f(by + py * 0.26)} ${f(bx - px * 0.26)},${f(by - py * 0.26)}"/></svg>`;
  }
  slide(from, to) {
    const cell = this.cell(to), el = cell && cell.querySelector('.pc');
    if (!el) return;
    const a = this.pos(from), b = this.pos(to), s = this.el.clientWidth / 8;
    cell.style.zIndex = 4;
    el.style.transition = 'none';
    el.style.transform = `translate(${(a.c - b.c) * s}px,${(a.r - b.r) * s}px)`;
    el.getBoundingClientRect();
    el.style.transition = 'transform .2s cubic-bezier(.2,.8,.2,1)';
    el.style.transform = '';
  }
  animate(from, to) {
    if (RM) return;
    this.slide(from, to);
    // castling (or taking it back): the rook slides too
    const p = this.g && this.g.get(to);
    if (p && p.type === 'k' && Math.abs(FILES.indexOf(from[0]) - FILES.indexOf(to[0])) === 2) {
      const castled = from[0] === 'e', k = castled ? to[0] : from[0], [home, next] = k === 'g' ? ['h', 'f'] : ['a', 'd'];
      if (castled) this.slide(home + to[1], next + to[1]); else this.slide(next + to[1], home + to[1]);
    }
  }
  flash(sq, cls, ms = 500) { const c = this.cell(sq); if (!c) return; c.classList.add(cls); setTimeout(() => c.classList.remove(cls), ms); }
  shake() { if (RM) return; const e = this.el; e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); setTimeout(() => e.classList.remove('shake'), 350); }
  at(e) {
    const r = this.el.getBoundingClientRect();
    const c = Math.floor(((e.clientX - r.left) / r.width) * 8), w = Math.floor(((e.clientY - r.top) / r.height) * 8);
    return c < 0 || c > 7 || w < 0 || w > 7 ? null : this.name(w, c);
  }
  pick(sq) { this.sel = sq; this.targets = this.g.moves({ square: sq, verbose: true }).map(m => m.to); this.render(); }
  clear(r = true) { this.sel = null; this.targets = []; if (r) this.render(); }
  bind() {
    const el = this.el;
    el.addEventListener('pointerdown', e => {
      audio();
      if (this.promo) {
        const pr = this.promo, pick = e.target.closest('[data-promo]');
        this.promo = null;
        e.preventDefault();
        if (pick && this.interactive && this.onMove) this.onMove(pr.from, pr.to, pr.anim, pick.dataset.promo); else this.render();
        return;
      }
      if (!this.interactive || !this.g || e.button > 0) return;
      const sq = this.at(e); if (!sq) return;
      if (this.sel && this.targets.includes(sq)) { const from = this.sel; this.clear(false); this.commit(from, sq, true); return; }
      const p = this.g.get(sq);
      if (p && p.color === this.g.turn() && (!this.side || p.color === this.side)) {
        const was = this.sel === sq;
        this.pick(sq);
        this.drag = { from: sq, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, was, touch: e.pointerType === 'touch', over: null };
        try { el.setPointerCapture(e.pointerId); } catch {}
        e.preventDefault();
        return;
      }
      if (this.sel) this.clear();
    });
    el.addEventListener('pointermove', e => {
      const d = this.drag; if (!d || e.pointerId !== d.id) return;
      if (!d.moved) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
        d.moved = true;
        const src = this.cell(d.from).querySelector('.pc');
        if (src) {
          d.src = src; src.style.opacity = '.3';
          // under a finger the piece is drawn bigger and lifted, so you can see where it is going
          d.s = (el.clientWidth / 8) * (d.touch ? 1.7 : 1.15);
          d.lift = d.touch ? d.s * 0.55 : 0;
          d.gh = document.createElement('i');
          d.gh.className = src.className + ' ghost';
          d.gh.style.width = d.gh.style.height = d.s + 'px';
          document.body.appendChild(d.gh);
        }
      }
      if (d.gh) d.gh.style.transform = `translate(${e.clientX - d.s / 2}px,${e.clientY - d.s / 2 - d.lift}px)`;
      // ring the square the piece would land on
      const sq = this.at(e), over = sq && this.targets.includes(sq) ? this.cell(sq) : null;
      if (over !== d.over) { if (d.over) d.over.classList.remove('over'); if (over) over.classList.add('over'); d.over = over; }
    });
    const end = e => {
      const d = this.drag; if (!d || e.pointerId !== d.id) return;
      this.drag = null;
      if (d.gh) d.gh.remove();
      if (d.src) d.src.style.opacity = '';
      if (d.over) d.over.classList.remove('over');
      if (!d.moved) { if (d.was) this.clear(); return; }
      const sq = e.type === 'pointercancel' ? null : this.at(e);
      if (sq && sq !== d.from && this.targets.includes(sq)) { this.clear(false); this.commit(d.from, sq, false); }
      else if (sq !== d.from) this.clear();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}
function miniBoard(el, op) {
  const ln = op.lines[0];
  new Board(el, { mini: true }).set(new Chess(ln.fens[op.start]), { flip: op.side === 'b', last: ln.vm[op.start - 1] });
}

/* ================= shared UI ================= */
let timers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const stopTimers = () => { timers.forEach(clearTimeout); timers = []; };
let toastT;
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 1900); }

// where you were on each tab, so coming back to it puts you in the same place
const tabScroll = {};
let shownTab = null;
function show(html, tabs = false) {
  stopTimers();
  closeSheet();
  if (ENG) ENG.stop();
  if (shownTab) tabScroll[shownTab] = window.scrollY;
  shownTab = tabs ? tab : null;
  app.innerHTML = html + (tabs ? tabBar() : '');
  app.className = tabs ? 'has-tabs' : html.includes('class="dock') ? 'has-dock' : '';
  if (!RM) { app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter'); }
  window.scrollTo(0, 0);
}
function sheet(html, dismissable = false, top = false) {
  closeSheet();
  const el = document.createElement('div');
  el.className = 'sheet-wrap';
  el.innerHTML = `<div class="scrim"${dismissable ? ' data-act="sheet-close"' : ''}></div><div class="sheet${top ? ' top' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(el);
  el.getBoundingClientRect();
  el.classList.add('on');
}
// a closed sheet slides away before it is removed; its ids go at once so a new sheet can reuse them
function closeSheet() {
  for (const e of $$('.sheet-wrap:not(.out)')) {
    if (RM) { e.remove(); continue; }
    e.classList.remove('on');
    e.classList.add('out');
    for (const x of $$('[id]', e)) x.removeAttribute('id');
    setTimeout(() => e.remove(), 240);
  }
}
const sheetOpen = () => $('.sheet-wrap:not(.out)');
const topbar = (title, act, id = '', sub = '', right = '') =>
  `<header class="bar"><button class="iconbtn" data-act="${act}" data-id="${id}" aria-label="Back">${icon('back')}</button><div class="bt"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div>${right || '<span class="sp"></span>'}</header>`;
const bars = (l, pop = -1) => `<span class="bars${l >= MAX ? ' gold' : ''}" aria-label="Level ${l} of ${MAX}">${Array.from({ length: MAX }, (_, i) => `<i${i < l ? ` class="on${i === pop ? ' pop' : ''}"` : ''}></i>`).join('')}</span>`;
function ring(p) {
  const r = 17, c = 2 * Math.PI * r, pct = Math.round(p * 100);
  return `<div class="ring${pct >= 100 ? ' gold' : ''}" aria-label="${pct}% done"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="${r}" class="rt"/>${p > 0 ? `<circle cx="22" cy="22" r="${r}" class="rv" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}"/>` : ''}</svg><span>${pct}<small>%</small></span></div>`;
}
function coach(kind, title, text = '', extra = '') {
  const el = $('#note'); if (!el) return;
  const changed = el.dataset.t !== title;
  el.dataset.t = title;
  el.className = 'coach ' + kind;
  if (changed && !RM) { void el.offsetWidth; el.classList.add('swap'); }
  el.innerHTML = `<div class="ava"><i class="pc wN"></i></div><div class="ct"><b>${title}</b>${text ? `<p>${text}</p>` : ''}${extra}</div>`;
}
function strip(el, moves, k, act, from = 0) {
  if (!el) return;
  el.innerHTML = moves.length
    ? moves.map((s, i) => { const ply = i + from; return `${ply & 1 ? (i ? '' : `<span class="no">${(ply + 1) >> 1}...</span>`) : `<span class="no">${(ply >> 1) + 1}.</span>`}<button class="mv${i === k - 1 ? ' cur' : ''}${i >= k ? ' fut' : ''}"${act ? ` data-act="${act}" data-k="${i + 1}"` : ' tabindex="-1"'}>${s}</button>`; }).join('')
    : `<span class="no">${from ? 'No moves yet' : 'Starting position'}</span>`;
  const cur = el.querySelector('.cur'), left = cur ? cur.offsetLeft - el.clientWidth / 2 + cur.offsetWidth / 2 : 0;
  // glide to the current move, except the first time a screen is drawn
  if (el.dataset.drawn && !RM) el.scrollTo({ left, behavior: 'smooth' }); else el.scrollLeft = left;
  el.dataset.drawn = 1;
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function applyTheme() { document.documentElement.dataset.theme = S.theme; }

/* ================= tabs ================= */
let tab = 'train', sideTab = 'w';
const TABS = [['train', 'target', 'Train'], ['openings', 'book', 'Openings'], ['tactics', 'swords', 'Tactics'], ['endgames', 'crown', 'Endgames'], ['progress', 'chart', 'Progress']];
const tabBar = () => `<nav class="tabs">${TABS.map(([id, ic, label]) => `<button class="tab${tab === id ? ' on' : ''}" data-act="tab" data-id="${id}"${tab === id ? ' aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button>`).join('')}</nav>`;
function openTab(id, keep = false) {
  tab = id;
  ({ train: trainTab, openings: openingsTab, tactics: tacticsTab, endgames: endgamesTab, progress: progressTab })[id]();
  if (keep && tabScroll[id]) window.scrollTo(0, tabScroll[id]);
}

function row(ic, title, sub, act, id = '') {
  const off = !act;
  return `<div class="row${off ? ' off' : ''}"${off ? '' : ` role="button" tabindex="0" data-act="${act}" data-id="${id}"`}><span class="tile">${icon(ic)}</span><span class="rt"><b>${title}</b><span>${sub}</span></span>${off ? '' : icon('next', 'chev')}</div>`;
}
function weekStrip() {
  const base = noon(), dow = (new Date(base).getDay() + 6) % 7;
  let h = '';
  for (let i = 0; i < 7; i++) {
    const t = base + (i - dow) * DAY, key = dkey(t), done = S.log[key]?.n;
    h += `<span class="day${done ? ' done' : ''}${i === dow ? ' now' : ''}${i > dow ? ' fut' : ''}"><small>${'MTWTFSS'[i]}</small>${done ? icon('check') : ''}</span>`;
  }
  return `<div class="week" aria-label="This week">${h}</div>`;
}

function trainTab() {
  const { due, fresh } = plan(), total = due.length + fresh.length, c = counts(), weak = weakList().length;
  const first = due[0] || fresh[0];
  let heroLn = first;
  if (!heroLn) { let best = 0; for (const ln of ALL) { const r = rec(ln); if (r && r.seen > best) { best = r.seen; heroLn = ln; } } }
  heroLn = heroLn || ALL[0];
  const parts = [due.length && plural(due.length, 'review'), fresh.length && plural(fresh.length, 'new line')].filter(Boolean);
  show(`
  <header class="top">
    <div class="brand"><i class="pc wN"></i><span>Gambit</span></div>
    <div class="stats"><span class="stat fire" title="Day streak">${icon('flame')}${streak()}</span><span class="stat xp" title="XP">${icon('zap')}${S.xp}</span></div>
  </header>
  <section class="today">
    <div class="hero-board" id="hb"></div>
    <div class="today-copy">
      <h1 class="display">${total ? 'Today’s session' : 'Done for today'}</h1>
      <p>${total ? parts.join(' and ') : c.learned ? 'Every review is done. A quick test keeps the lines sharp.' : 'Learn your first line to start training.'}</p>
      ${first ? `<p class="up">Up next: <b>${first.op.name}</b>, ${first.name}</p>` : ''}
      ${total ? '<button class="btn go big" data-act="session">Start session</button>'
        : c.learned ? '<button class="btn go big" data-act="test">Take a quick test</button>'
        : `<button class="btn go big" data-act="learn" data-id="${OPENINGS[0].id}" data-li="0">Learn the first line</button>`}
    </div>
  </section>
  <h2 class="h2">This week</h2>
  ${weekStrip()}
  <h2 class="h2">More training</h2>
  <div class="group">
    ${row('shuffle', 'Quick test', c.learned ? '10 positions from lines you have learned' : 'Unlocks after your first line', c.learned ? 'test' : '')}
    ${row('alert', 'Weak moves', weak ? `${plural(weak, 'move')} you keep missing` : 'Moves you miss show up here', weak ? 'weak' : '')}
    ${row('swords', 'Puzzles', pzDue().length ? `${plural(pzDue().length, 'puzzle')} to retry, tactics rating ${S.prating}` : `Tactics rating ${S.prating}`, 'pz-mix')}
    ${row('play', 'Play the computer', S.live && BOTS[S.live.bi] ? `Game in progress against ${BOTS[S.live.bi].name}` : S.elo.n ? `Your rating ${S.elo.r}${S.elo.n < 10 ? ', still settling' : ''}, ${S.games.w} won, ${S.games.l} lost, ${S.games.d} drawn`
      : S.games.w + S.games.l + S.games.d ? `${S.games.w} won, ${S.games.l} lost, ${S.games.d} drawn` : 'Use your openings in a real game', 'play')}
    ${row('layers', 'All openings', `${c.learned} of ${ALL.length} lines learned, ${c.mastered} mastered`, 'tab', 'openings')}
  </div>`, true);
  miniHero($('#hb'), heroLn);
}
// the hero board shows where this line branches off from the main line
function miniHero(el, ln) {
  const base = ln.op.lines[0];
  let k = ln.op.start;
  if (ln !== base) {
    k = 0;
    while (k < ln.moves.length && ln.moves[k] === base.moves[k]) k++;
    k = Math.min(ln.moves.length, Math.max(ln.op.start, k + 1));
  }
  new Board(el).set(new Chess(ln.fens[k]), { flip: ln.op.side === 'b', last: ln.vm[k - 1] });
}
function intro() {
  sheet(`<div class="intro">
    <h2>How Gambit works</h2>
    <ul class="ideas">
      <li><span><b>Learn.</b> A new line is shown move by move, with an arrow and the reason for every move.</span></li>
      <li><span><b>Review.</b> Then you play it from memory: 4 hours later, then after 1, 3, 7, 16 and 35 days.</span></li>
      <li><span><b>Level up.</b> Each perfect review moves a line up one of 6 levels. Level 6 means mastered.</span></li>
      <li><span><b>Fix mistakes.</b> A mistake drops the line a level and brings it back sooner. The exact move you missed goes to Weak moves.</span></li>
    </ul>
    <p class="note">Start every day with Today’s session. It mixes your reviews with new lines.</p>
    <div class="actions"><button class="btn go" data-act="intro-ok">Got it</button></div>
  </div>`);
}

function openingRow(op) {
  const d = op.lines.filter(isDue).length;
  return `<div class="orow" role="button" tabindex="0" data-act="open" data-id="${op.id}">
    <div class="mb" data-mini="${op.id}"></div>
    <div class="ot"><b>${op.name}</b><span class="nota">${movesText(op.lines[0].moves.slice(0, op.start))}</span>
    <span class="sub">${learnedIn(op)} of ${op.lines.length} lines learned${d ? `, <em>${d} due</em>` : ''}</span></div>
    ${ring(mastery(op))}</div>`;
}
function openingsTab() {
  show(`
  <header class="top"><h1 class="display">Openings</h1></header>
  <div class="seg" role="tablist">${['w', 'b'].map(s => `<button role="tab" aria-selected="${sideTab === s}" class="${sideTab === s ? 'on' : ''}" data-act="side" data-id="${s}">As ${s === 'w' ? 'White' : 'Black'}</button>`).join('')}</div>
  <p class="hint-text">${sideTab === 'w' ? 'Your openings when you play the white pieces.' : 'Your answers to 1.e4 and 1.d4 when you play black.'}</p>
  <div class="group">${OPENINGS.filter(o => o.side === sideTab).map(openingRow).join('')}</div>`, true);
  $$('[data-mini]').forEach(el => miniBoard(el, byId[el.dataset.mini]));
}

// your rating against the computer: the number, the change from your last rated game, and the last 12 results as a trend line
function ratingTile() {
  const e = S.elo;
  if (!e.n) return `<section class="panel rtile"><p class="tl">Rating against the computer</p><p class="tv"><b>${e.r}</b></p>
    <p class="tn">Everyone starts at 800. Play a rated game against the computer to move it.</p></section>`;
  const pts = [800, ...e.hist.map(h => h[1])].slice(-12), d = e.r - pts[pts.length - 2];
  const lo = Math.min(...pts), hi = Math.max(...pts), span = Math.max(hi - lo, 40);
  const x = i => 6 + (i * 288) / (pts.length - 1), y = v => 38 - ((v - lo) / span) * 32;
  const line = pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const best = BOTS.reduce((b, bot, i) => (S.beat[i] ? bot : b), null);
  return `<section class="panel rtile"><p class="tl">Rating against the computer</p>
    <p class="tv"><b>${e.r}</b><em class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} from your last game</em></p>
    <svg class="spark" viewBox="0 0 300 44" role="img" aria-label="Rating over the last ${pts.length - 1} rated games, from ${pts[0]} to ${e.r}"><polyline points="${line}"/><circle cx="${x(pts.length - 1).toFixed(1)}" cy="${y(e.r).toFixed(1)}" r="4"/></svg>
    <p class="tn">Best ${e.peak}. ${e.w} won, ${e.l} lost, ${e.d} drawn${e.n < 10 ? `, and it moves faster for your first 10 games` : ''}.${best ? ` Strongest bot beaten: ${best.name} (${best.elo}).` : ''}</p></section>`;
}
const flipSwitch = (b, on) => { b.classList.toggle('on', on); b.setAttribute('aria-checked', on); };
const choose = b => $$('button', b.parentElement).forEach(x => x.classList.toggle('on', x === b));
function progressTab() {
  const c = counts(), acc = accuracy(), total = ALL.length, weak = weakList().length;
  const base = noon(), dow = (new Date(base).getDay() + 6) % 7, start = base - (dow + 28) * DAY;
  let cal = '<div class="cal">' + [...'MTWTFSS'].map(x => `<span class="cd">${x}</span>`).join('');
  for (let i = 0; i < 35; i++) {
    const t = start + i * DAY, key = dkey(t), n = S.log[key]?.n || 0;
    cal += `<span class="cc${(Math.floor(i / 7) + (i % 7)) % 2 ? ' dk' : ''}${n ? ' on' : ''}${key === dkey() ? ' now' : ''}${t > base ? ' fut' : ''}" title="${key}${n ? `: ${n} trained` : ''}"></span>`;
  }
  cal += '</div>';
  show(`
  <header class="top"><h1 class="display">Progress</h1></header>
  <section class="panel">
    <p class="big-line"><b>${c.learned}</b> of ${total} lines learned, <b>${c.mastered}</b> mastered</p>
    <div class="stack"><i class="m" style="flex:${c.mastered}"></i><i class="l" style="flex:${c.learning}"></i><i class="n" style="flex:${c.new}"></i></div>
    <div class="legend"><span><i class="m"></i>Mastered ${c.mastered}</span><span><i class="l"></i>Learning ${c.learning}</span><span><i class="n"></i>Not started ${c.new}</span></div>
  </section>
  <section class="trio">
    <div><b>${streak()}</b><span>Day streak</span></div>
    <div><b>${acc == null ? '–' : acc + '%'}</b><span>Week accuracy</span></div>
    <div><b>${S.xp}</b><span>XP</span></div>
  </section>
  <section class="trio">
    <div><b>${S.prating}</b><span>Tactics rating</span></div>
    <div><b>${PRACTICE.filter(solved).length}</b><span>Puzzles solved</span></div>
    <div><b>${ENDGAMES.reduce((s, l) => s + egCount(l), 0)}/${ENDGAMES.reduce((s, l) => s + l.fens.length, 0)}</b><span>Endgames</span></div>
  </section>
  <h2 class="h2">Rated games</h2>
  ${ratingTile()}
  <h2 class="h2">Training days</h2>
  <section class="panel">${cal}</section>
  ${weak ? `<div class="group mt">${row('alert', 'Weak moves', `${plural(weak, 'move')} to fix`, 'weak')}</div>` : ''}
  <h2 class="h2">Openings</h2>
  <div class="group">${OPENINGS.map(openingRow).join('')}</div>
  <h2 class="h2">Settings</h2>
  <div class="group">
    <div class="srow"><span>Sound</span><button class="switch${S.sound ? ' on' : ''}" role="switch" aria-checked="${S.sound}" aria-label="Sound" data-act="sound"><i></i></button></div>
    <div class="srow"><span>Warn before blunders</span><button class="switch${S.warn ? ' on' : ''}" role="switch" aria-checked="${S.warn}" aria-label="Warn before blunders" data-act="warn"><i></i></button></div>
    <div class="srow"><span>Board</span><div class="seg sm">${[['green', 'Green'], ['brown', 'Wood'], ['blue', 'Slate']].map(([v, l]) => `<button class="${S.theme === v ? 'on' : ''}" data-act="theme" data-id="${v}">${l}</button>`).join('')}</div></div>
    <div class="srow"><span>New lines a day</span><div class="seg sm">${[1, 2, 3, 5].map(v => `<button class="${S.perDay === v ? 'on' : ''}" data-act="perday" data-id="${v}">${v}</button>`).join('')}</div></div>
    <div class="srow link-row" role="button" tabindex="0" data-act="intro"><span>How Gambit works</span>${icon('next', 'chev')}</div>
    <div class="srow link-row" role="button" tabindex="0" data-act="backup"><span>Back up progress</span>${icon('next', 'chev')}</div>
    <div class="srow link-row" role="button" tabindex="0" data-act="restore"><span>Restore from a backup</span>${icon('next', 'chev')}</div>
    <div class="srow"><button class="danger" data-act="reset">Reset all progress</button></div>
  </div>
  <p class="foot">Progress is saved on this phone. Back it up now and then.</p>
  <p class="foot credits">Piece sounds recorded by Stefan Haack for <a href="https://github.com/shaack/chess-console" target="_blank" rel="noopener">chess-console</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, trimmed and level-matched. Engine: Stockfish, GPL-3.0. Opening names: Lichess, public domain.</p>`, true);
  $$('[data-mini]').forEach(el => miniBoard(el, byId[el.dataset.mini]));
}

/* ================= opening page ================= */
function lineRow(ln) {
  const st = stage(ln), r = rec(ln);
  const when = r && st !== 'due' ? `<span class="when">Next review ${fmtDue(r.due)}</span>` : '';
  return `<div class="lrow" role="button" tabindex="0" data-act="line" data-id="${ln.op.id}" data-li="${ln.i}">
    <div class="lt"><b>${ln.name}</b><span class="nota">${branchText(ln)}</span>${when}</div>
    <div class="lr">${st === 'new' ? '<em class="pill new">New</em>' : st === 'due' ? '<em class="pill due">Review</em>' : st === 'mastered' ? '<em class="pill gold">Mastered</em>' : ''}${bars(level(ln))}</div></div>`;
}
function openingView(id) {
  const op = byId[id], nx = op.lines.find(l => !rec(l)), due = op.lines.filter(isDue).length, learnedN = learnedIn(op);
  show(`
  ${topbar(op.name, 'tab', tab, `${learnedN} of ${op.lines.length} lines learned`)}
  <div class="stage"><div id="opb"></div></div>
  <div class="pad">
    <p class="nota lg">${movesText(op.lines[0].moves.slice(0, op.start))}</p>
    <p class="lead">${op.about}</p>
    <p class="muted">Played by ${op.players}.</p>
    <ul class="ideas">${op.ideas.map(i => `<li>${i}</li>`).join('')}</ul>
    <div class="actions">
      ${nx ? `<button class="btn go" data-act="learn" data-id="${id}" data-li="${nx.i}">${learnedN ? 'Learn next line' : 'Learn first line'}</button>` : ''}
      <button class="btn${nx ? '' : ' go'}" data-act="practice" data-id="${id}"${learnedN ? '' : ' disabled'}>${due ? `Review ${due} due` : 'Practice'}</button>
    </div>
  </div>
  <h2 class="h2">Lines</h2>
  <div class="group">${op.lines.map(lineRow).join('')}</div>`);
  new Board($('#opb')).set(new Chess(op.lines[0].fens[op.start]), { flip: op.side === 'b', last: op.lines[0].vm[op.start - 1] });
}

/* ================= study a line (free browsing) ================= */
let V = null;
function lineView(id, li, k = 0, anim = false, resume = false) {
  const op = byId[id], ln = op.lines[li], flip = V && V.op === op ? V.flip : op.side === 'b';
  show(`
  ${topbar(op.name, 'open', id, ln.name, `<button class="iconbtn" data-act="v-flip" aria-label="Flip board">${icon('flip')}</button>`)}
  <div class="stage"><div id="bd"></div></div>
  <div class="strip" id="mv"></div>
  <div class="pad">
    <div class="coach" id="note"></div>
    <div id="alts"></div>
    <div class="actions">${resume
      ? '<button class="btn go" data-act="resume">Back to session</button>'
      : `<button class="btn" data-act="play-here">Play from here</button>${rec(ln)
        ? `<button class="btn go" data-act="practice-line" data-id="${id}" data-li="${li}">Practice line</button>`
        : `<button class="btn go" data-act="learn" data-id="${id}" data-li="${li}">Learn line</button>`}`}</div>
  </div>
  <nav class="dock">
    <button data-act="v-first" aria-label="Go to start">${icon('first')}</button>
    <button data-act="v-prev" aria-label="Previous move">${icon('back')}</button>
    <button data-act="v-next" class="primary" aria-label="Next move">${icon('next')}</button>
    <button data-act="v-last" aria-label="Go to end">${icon('last')}</button>
  </nav>`);
  V = { op, ln, k, flip, board: new Board($('#bd'), { onMove: studyMove }) };
  soundSide = op.side;
  V.board.interactive = true;
  studyShow(anim);
}
function studyShow(anim) {
  const { ln, k, board } = V, last = ln.vm[k - 1];
  board.set(new Chess(ln.fens[k]), { flip: V.flip, last });
  if (anim && last) board.animate(last.from, last.to);
  strip($('#mv'), ln.moves, k, 'v-jump');
  const end = k === ln.moves.length ? '<p class="end">End of the line.</p>' : '';
  if (k === 0) coach('info', ln.name, 'Step through with the arrows below, or play the moves yourself on the board.');
  else coach(isMine(ln, k - 1) ? 'you' : 'them', `${isMine(ln, k - 1) ? 'You play' : colour(k - 1) + ' plays'} ${moveLabel(k - 1, ln.moves[k - 1])}`, commentAt(ln, k), end);
  const br = branches(ln, k);
  br.delete(ln.moves[k]);
  $('#alts').innerHTML = br.size
    ? `<h3 class="h3">${isMine(ln, k) ? 'You could also play' : `If ${colour(k)} plays something else`}</h3><div class="group flush">${[...br].map(([s, ls]) => `<div class="brow" role="button" tabindex="0" data-act="v-alt" data-li="${ls[0].i}"><span class="nota">${moveLabel(k, s)}</span><span class="bn">${ls[0].name}</span>${icon('next', 'chev')}</div>`).join('')}</div>`
    : '';
}
function studyMove(from, to, anim, pr) {
  const { ln, k } = V, m = findMove(new Chess(ln.fens[k]), from, to, pr);
  if (!m) { V.board.render(); return; }
  const br = branches(ln, k);
  if (!br.has(m.san)) {
    V.board.render(); V.board.flash(to, 'bad'); sfx.bad();
    toast(k >= ln.moves.length ? 'This line ends here' : 'Not in this opening. Tap next to see the move.');
    return;
  }
  const ls = br.get(m.san), nl = ls.includes(ln) ? ln : ls[0];
  sfx.move(m);
  if (nl !== ln) return lineView(V.op.id, nl.i, k + 1, anim);
  V.k = k + 1;
  studyShow(anim);
}

/* ================= trainer: learn, review, practice, tests ================= */
let R = null;
const KIND = { learn: 'New line', review: 'Review', practice: 'Practice', pos: 'Find the move' };
const MODE = { session: 'Today’s session', learn: 'Learn', practice: 'Practice', test: 'Quick test', weak: 'Weak moves' };
function run(mode, tasks, back) {
  if (!tasks.length) return toast('Nothing to train here yet');
  R = { mode, tasks, back, i: -1, stats: { lines: 0, perfect: 0, c: 0, t: 0, xp: 0, ok: 0, n: 0 }, requeued: new Set() };
  nextTask();
}
function nextTask() {
  R.i++;
  if (R.i >= R.tasks.length) return summary();
  const t = (R.task = R.tasks[R.i]), ln = t.ln, op = ln.op, n = R.tasks.length;
  Object.assign(t, { mist: 0, fail: false, pm: 0, shown: false });
  const learnMode = t.kind === 'learn';
  show(`
  ${topbar(MODE[R.mode], 'quit', '', `${op.name}, ${ln.name}`, n > 1 ? `<span class="count">${R.i + 1}/${n}</span>` : '')}
  <div class="prog"><i id="pg"></i></div>
  <div class="stage"><div id="bd"></div></div>
  <div class="strip" id="mv"></div>
  <div class="pad"><div class="coach" id="note"></div></div>
  <nav class="dock">${learnMode
    ? `<button data-act="restart">${icon('restart')}<span>Restart line</span></button>`
    : `<button data-act="hint">${icon('bulb')}<span>Hint</span></button><button data-act="reveal">${icon('eye')}<span>Show move</span></button>${t.kind === 'pos' ? '' : `<button data-act="restart">${icon('restart')}<span>Restart</span></button>`}`}</nav>`);
  R.board = new Board($('#bd'), { onMove: trainerMove });
  R.board.side = op.side;
  soundSide = op.side;
  if (t.kind === 'pos') {
    R.k = t.k;
    R.g = new Chess(ln.fens[t.k]);
    R.board.set(R.g, { flip: op.side === 'b', last: ln.vm[t.k - 1] });
    stripT(); prog();
    R.board.interactive = true;
    coach('you', 'Find the book move', `${colour(t.k - 1)} just played ${moveLabel(t.k - 1, ln.moves[t.k - 1])}. What do you play?`);
    return;
  }
  R.k = 0;
  R.g = new Chess();
  R.board.set(R.g, { flip: op.side === 'b' });
  stripT();
  if (learnMode) coach('info', 'New line', `Follow the arrows and read why each move is played. ${op.side === 'b' ? 'White moves first.' : ''}`);
  step();
}
const stripT = () => strip($('#mv'), R.task.ln.moves.slice(0, R.k), R.k);
function prog(done) {
  const t = R.task, frac = done ? 1 : t.kind === 'pos' ? 0 : R.k / t.ln.moves.length;
  const el = $('#pg'); if (el) el.style.width = (((R.i + frac) / R.tasks.length) * 100).toFixed(1) + '%';
}
function arrowFor(ln, k) { const m = ln.vm[k]; return { from: m.from, to: m.to }; }
function prompt() {
  const t = R.task, ln = t.ln, k = R.k;
  const prev = k > 0 ? `<span class="prev">${colour(k - 1)} played ${moveLabel(k - 1, ln.moves[k - 1])}${commentAt(ln, k) ? `: ${commentAt(ln, k)}` : '.'}</span>` : '';
  if (t.kind === 'learn') coach('hint', `Play ${moveLabel(k, ln.moves[k])}`, prev + (commentAt(ln, k + 1) || 'Follow the arrow.'));
  else coach('you', 'Your move', prev);
}
function step() {
  const t = R.task, ln = t.ln;
  prog();
  if (R.k >= ln.moves.length) return finishLine();
  if (isMine(ln, R.k)) {
    if (t.kind === 'learn' && !R.board.arrow) { R.board.arrow = arrowFor(ln, R.k); R.board.render(); }
    R.board.interactive = true;
    prompt();
    return;
  }
  R.board.interactive = false;
  later(() => {
    if (!R || R.task !== t) return;
    const m = R.g.move(ln.moves[R.k]);
    R.k++;
    const nextMine = R.k < ln.moves.length && t.kind === 'learn';
    R.board.set(R.g, { last: m, arrow: nextMine ? arrowFor(ln, R.k) : null });
    R.board.animate(m.from, m.to);
    sfx.move(m);
    stripT();
    step();
  }, R.k === 0 ? 450 : 650);
}
function failPly() {
  const t = R.task;
  if (t.fail || t.kind === 'learn') return;
  t.fail = true; t.mist++;
  today().t++; R.stats.t++;
  miss(t.ln, R.k);
}
function trainerMove(from, to, anim, pr) {
  const t = R && R.task;
  if (!t || !R.board.interactive) return;
  const ln = t.ln, m = findMove(R.g, from, to, pr);
  if (!m) { R.board.render(); return; }
  if (m.san === ln.moves[R.k]) {
    if (t.kind !== 'learn' && !t.fail) { today().t++; today().c++; R.stats.t++; R.stats.c++; hit(ln, R.k); }
    Object.assign(t, { fail: false, pm: 0 });
    R.g.move(m.san);
    R.k++;
    R.board.set(R.g, { last: m });
    if (anim) R.board.animate(m.from, m.to);
    R.board.flash(m.to, 'good', 380);
    sfx.move(m);
    stripT();
    save();
    if (t.kind === 'pos') return finishPos();
    return step();
  }
  sfx.bad();
  R.board.render();
  R.board.flash(to, 'bad');
  R.board.shake();
  if (t.kind === 'learn') { coach('bad', 'Follow the arrow', `Play ${moveLabel(R.k, ln.moves[R.k])}. ${commentAt(ln, R.k + 1)}`); return; }
  failPly();
  t.pm++;
  save();
  if (t.pm >= 2) reveal('That is not it. Here is the book move.');
  else coach('bad', 'Not the book move', 'Try again. Use Hint if you are stuck.');
}
function reveal(title) {
  const t = R && R.task;
  if (!t || !R.board.interactive || t.kind === 'learn') return;
  failPly(); save();
  t.shown = true;
  R.board.hintSq = null;
  R.board.arrow = arrowFor(t.ln, R.k);
  R.board.render();
  coach('hint', title || `Play ${moveLabel(R.k, t.ln.moves[R.k])}`, commentAt(t.ln, R.k + 1) || 'This is the book move here.');
}
function hint() {
  const t = R && R.task;
  if (!t || !R.board.interactive || t.kind === 'learn') return;
  if (R.board.hintSq || R.board.arrow) return reveal();
  failPly(); save();
  R.board.hintSq = t.ln.vm[R.k].from;
  R.board.render();
  coach('hint', 'Move this piece', 'Tap Hint again to see the square.');
}
function restart() {
  const t = R && R.task;
  if (!t || t.kind === 'pos') return;
  stopTimers();
  Object.assign(t, { fail: false, pm: 0 });
  R.k = 0;
  R.g = new Chess();
  R.board.set(R.g, {});
  stripT();
  step();
}
function finishLine() {
  const t = R.task, ln = t.ln, perfect = !t.mist;
  R.board.interactive = false;
  let res;
  if (t.kind === 'learn' && !rec(ln)) { learned(ln); addXP(10); res = { before: 0, after: 1, wasDue: false }; }
  else { res = reviewed(ln, t.kind === 'learn' ? true : perfect); addXP(perfect ? 15 : 5); }
  today().n++;
  R.stats.lines++;
  if (perfect) R.stats.perfect++;
  if (!perfect && R.mode === 'session' && !R.requeued.has(ln.id)) { R.requeued.add(ln.id); R.tasks.push({ kind: 'review', ln }); }
  save();
  prog(true);
  later(sfx.done, 120);
  later(() => resultSheet(t, perfect, res), 450);
}
function resultSheet(t, perfect, res) {
  const ln = t.ln, r = rec(ln), more = R.i < R.tasks.length - 1, single = R.tasks.length === 1;
  const learnedNow = t.kind === 'learn' && res.before === 0;
  const title = learnedNow ? 'Line learned' : perfect ? 'Perfect' : `${plural(t.mist, 'mistake')}`;
  let note;
  if (learnedNow) note = `First review ${fmtDue(r.due)}. Each perfect review moves it up a level.`;
  else if (r.lvl >= MAX && perfect) note = `Mastered. Next check ${fmtDue(r.due)}.`;
  else if (perfect && res.after > res.before) note = `Up to level ${r.lvl}. Next review ${fmtDue(r.due)}.`;
  else if (perfect) note = `Extra practice. Your next scheduled review is still ${fmtDue(r.due)}.`;
  else note = `Down to level ${r.lvl}. It comes back ${fmtDue(r.due)}, and the moves you missed go to Weak moves.`;
  sheet(`
    <div class="res ${perfect ? 'ok' : 'meh'}">
      <span class="res-ic">${icon(perfect ? 'check' : 'restart')}</span>
      <h2>${title}</h2>
      <p class="muted">${ln.op.name}, ${ln.name}</p>
      <div class="lvl">${bars(r.lvl, res.after > res.before ? r.lvl - 1 : -1)}<span>Level ${r.lvl} of ${MAX}</span></div>
      <p class="note">${note}</p>
      <div class="actions">
        <button class="btn" data-act="study" data-id="${ln.op.id}" data-li="${ln.i}">Study the line</button>
        <button class="btn go" data-act="${more ? 'next-task' : single ? 'done' : 'finish'}">${more ? 'Continue' : single ? 'Done' : 'See results'}</button>
      </div>
    </div>`);
}
function finishPos() {
  const t = R.task, ok = !t.mist;
  R.board.interactive = false;
  R.stats.n++;
  if (ok) { R.stats.ok++; addXP(R.mode === 'weak' ? 3 : 2); }
  today().n++;
  save();
  prog(true);
  const c = commentAt(t.ln, R.k);
  const more = R.i < R.tasks.length - 1;
  if (ok) { sfx.good(); coach('good', 'Correct', c); later(nextTask, 1300); }
  else coach('info', 'Now you have it', c, `<button class="btn go sm" data-act="${more ? 'next-task' : 'finish'}">${more ? 'Next position' : 'See results'}</button>`);
}
function summary() {
  const s = R.stats, pos = R.mode === 'test' || R.mode === 'weak', weak = weakList().length;
  const acc = s.t ? Math.round((100 * s.c) / s.t) : 100;
  const head = pos ? `${s.ok} of ${s.n} correct` : R.mode === 'session' ? 'Session complete' : 'Practice complete';
  const sub = pos
    ? (s.ok === s.n ? 'Every move found. Those lines are sticking.' : 'The ones you missed are saved in Weak moves.')
    : `${plural(s.lines, 'line')} trained, ${s.perfect} without a mistake.`;
  show(`
  ${topbar(MODE[R.mode], 'done')}
  <section class="sum">
    <span class="sum-ic">${icon('award')}</span>
    <h1 class="display">${head}</h1>
    <p class="lead">${sub}</p>
    <div class="trio">
      <div><b>${pos ? Math.round((100 * s.ok) / Math.max(1, s.n)) + '%' : acc + '%'}</b><span>Accuracy</span></div>
      <div><b>+${s.xp}</b><span>XP</span></div>
      <div><b>${streak()}</b><span>Day streak</span></div>
    </div>
    <div class="actions one">
      ${weak && R.mode !== 'weak' ? `<button class="btn" data-act="weak">Fix ${plural(weak, 'weak move')}</button>` : ''}
      <button class="btn go" data-act="done">Done</button>
    </div>
  </section>`);
}
function goBack() {
  const b = R && R.back;
  R = null;
  if (b && b.op) return openingView(b.op);
  openTab(b && b.tab ? b.tab : 'train', true);
}

/* --- building training runs --- */
function sessionTasks() {
  const { due, fresh } = plan();
  return [...due.map(ln => ({ kind: 'review', ln })), ...fresh.map(ln => ({ kind: 'learn', ln }))];
}
function practiceTasks(op) {
  const due = op.lines.filter(isDue).map(ln => ({ kind: 'review', ln }));
  if (due.length) return due;
  return shuffle(op.lines.filter(l => rec(l))).sort((a, b) => level(a) - level(b)).slice(0, 5).map(ln => ({ kind: 'practice', ln }));
}
function testTasks(n = 10) {
  const seen = new Set(), pool = [];
  for (const ln of ALL) {
    if (!rec(ln)) continue;
    for (let k = 2; k < ln.moves.length; k++) {
      if (!isMine(ln, k)) continue;
      const key = fen4(ln.fens[k]) + ln.moves[k];
      if (!seen.has(key)) { seen.add(key); pool.push({ kind: 'pos', ln, k }); }
    }
  }
  return shuffle(pool).slice(0, n);
}
const weakTasks = () => shuffle(weakList()).slice(0, 15).map(w => ({ kind: 'pos', ln: w.ln, k: w.k }));

/* ================= tactics ================= */
const THEMES = [
  { key: 'hanging', name: 'Free pieces', about: 'The simplest tactic of all: take what is not defended, or defended fewer times than you attack it.', tip: 'After every move, ask what it left unprotected.' },
  { key: 'fork', name: 'Forks', about: 'One piece attacks two targets at once. Your opponent can only save one of them.', tip: 'Knights fork best. Look for a square that hits the king and a big piece together.' },
  { key: 'pin', name: 'Pins', about: 'A pinned piece cannot move without exposing something more valuable behind it, usually the king or queen.', tip: 'Attack a pinned piece again. It cannot run away.' },
  { key: 'skewer', name: 'Skewers', about: 'A pin in reverse: attack a valuable piece, it moves away, and you take the piece behind it.', tip: 'Look for a king or queen on the same line as another piece.' },
  { key: 'discovered', name: 'Discovered attacks', about: 'Move one piece out of the way and the piece behind it attacks. Two threats in one move.', tip: 'If your piece blocks your own queen, rook or bishop, ask what it could attack as it moves away.' },
  { key: 'doubleCheck', name: 'Double check', about: 'Two pieces give check at once. Blocking or capturing cannot stop both, so the king has to move.', tip: 'The checking piece can even land on a square where it could be taken.' },
  { key: 'removeDefender', name: 'Remove the defender', about: 'Capture or chase away the piece that guards something, then take what it was guarding.', tip: 'Ask what defends a target, and whether you can take that defender first.' },
  { key: 'deflection', name: 'Deflection', about: 'Force a defender away from its job with a check, a capture or a threat.', tip: 'A piece doing two jobs at once is the perfect target.' },
  { key: 'decoy', name: 'Decoy', about: 'Lure a piece, often the king, onto a bad square, usually with a sacrifice, then strike.', tip: 'Sacrifices that drag the king forward often end in mate or a fork.' },
  { key: 'trapped', name: 'Trapped pieces', about: 'A piece with no safe squares can be attacked and won.', tip: 'Pieces deep in enemy territory, especially bishops and knights, get trapped the most.' },
  { key: 'intermezzo', name: 'In-between moves', about: 'Before recapturing, play a stronger move first, usually a check or a bigger threat.', tip: 'Never recapture on autopilot. Look for checks and threats first.' },
  { key: 'f7', name: 'Attacking f7 and f2', about: 'Early in the game, f7 (or f2) is guarded only by the king, which makes it the classic target.', tip: 'With a bishop on c4 and your queen or knight nearby, always look at f7.' },
  { key: 'backRank', name: 'Back-rank mate', about: 'A king stuck behind its own pawns can be mated by a rook or queen on the back rank.', tip: 'Notice when the enemy king has no escape square, and give your own king one in time.' },
  { key: 'mate1', name: 'Mate in one', about: 'One move ends the game.', tip: 'Look at every check and count the king’s escape squares.' },
  { key: 'mate2', name: 'Mate in two', about: 'A forcing first move, usually a check or a sacrifice, sets up mate on the next move.', tip: 'Try checks first, then captures, then threats.' },
  { key: 'promotion', name: 'Promotion', about: 'Push a pawn to the last rank and make a new queen. Sometimes a sacrifice clears the way.', tip: 'A passed pawn close to promotion is worth almost anything.' }
];
const THEME = Object.fromEntries(THEMES.map(t => [t.key, t]));
const PZ = PUZZLES.map(([id, fen, sol, rating, theme]) => ({ id, fen, sol: sol.split(' '), rating, theme }));
const EXAMPLE = {}; // the easiest puzzle of each theme is its worked example
for (const p of PZ) if (!EXAMPLE[p.theme]) EXAMPLE[p.theme] = p;
const PRACTICE = PZ.filter(p => EXAMPLE[p.theme] !== p);
const pzOf = key => PRACTICE.filter(p => p.theme === key);
const prec = p => S.pz[p.id];
const solved = p => !!(prec(p) && prec(p).done);
const pzDue = () => PRACTICE.filter(p => { const r = prec(p); return r && !r.done && r.due <= Date.now(); });
function pzResult(p, ok) {
  const r = S.pz[p.id], now = Date.now();
  if (!r) { // only the first try moves the rating
    const exp = 1 / (1 + 10 ** ((p.rating - S.prating) / 400)), K = S.pn < 20 ? 40 : 20;
    const delta = Math.round(K * ((ok ? 1 : 0) - exp));
    S.prating = Math.max(400, S.prating + delta);
    S.pn++;
    S.pz[p.id] = ok ? { done: 1 } : { s: 0, due: now + DAY };
    return delta;
  }
  if (r.done) return 0;
  if (ok) { r.s++; if (r.s >= 3) S.pz[p.id] = { done: 1 }; else r.due = now + (r.s === 1 ? 3 : 7) * DAY; }
  else { r.s = 0; r.due = now + DAY; }
  return 0;
}
function pzSession() {
  const due = shuffle(pzDue()).slice(0, 4), unseen = PRACTICE.filter(p => !prec(p));
  const near = unseen.filter(p => Math.abs(p.rating - S.prating) <= 200);
  const pool = shuffle(near.length >= 12 ? near : unseen.slice().sort((a, b) => Math.abs(a.rating - S.prating) - Math.abs(b.rating - S.prating)).slice(0, 40));
  const pick = [], seen = new Set();
  for (const p of pool) if (pick.length + due.length < 10 && !seen.has(p.theme)) { pick.push(p); seen.add(p.theme); }
  for (const p of pool) if (pick.length + due.length < 10 && !pick.includes(p)) pick.push(p);
  return shuffle([...due, ...pick]);
}
function themeList(key) {
  const ps = pzOf(key), todo = ps.filter(p => !solved(p));
  return (todo.length ? todo : ps).slice(0, 10);
}
function tacticsTab() {
  const due = pzDue().length, done = PRACTICE.filter(solved).length;
  show(`
  <header class="top"><h1 class="display">Tactics</h1></header>
  <section class="today tac">
    <div class="rating"><b>${S.prating}</b><span>Tactics rating</span></div>
    <p>${S.pn ? `${done} of ${PRACTICE.length} puzzles solved.${due ? ` ${plural(due, 'puzzle')} to retry today.` : ''}` : 'Real positions from real games. Every first try moves your rating up or down.'}</p>
    <button class="btn go big" data-act="pz-mix">Start puzzles</button>
  </section>
  <h2 class="h2">Learn by theme</h2>
  <div class="group">${THEMES.map(t => { const ps = pzOf(t.key), n = ps.filter(solved).length; return `<div class="orow" role="button" tabindex="0" data-act="tactic" data-id="${t.key}"><div class="mb" data-pzmini="${t.key}"></div><div class="ot"><b>${t.name}</b><span class="sub">${n} of ${ps.length} solved</span></div>${ring(n / ps.length)}</div>`; }).join('')}</div>
  <p class="foot">Puzzles come from the Lichess puzzle database.</p>`, true);
  $$('[data-pzmini]').forEach(el => { const g = new Chess(EXAMPLE[el.dataset.pzmini].fen); new Board(el, { mini: true }).set(g, { flip: g.turn() === 'b' }); });
}
let TV = null;
function themeView(key) {
  const t = THEME[key], ps = pzOf(key), n = ps.filter(solved).length, ex = EXAMPLE[key], g = new Chess(ex.fen);
  show(`
  ${topbar(t.name, 'tab', 'tactics', `${n} of ${ps.length} solved`)}
  <div class="stage"><div id="bd"></div></div>
  <div class="pad">
    <div class="coach" id="note"></div>
    <p class="lead">${t.about}</p>
    <ul class="ideas"><li>${t.tip}</li></ul>
    <div class="actions"><button class="btn" data-act="theme-demo">See the example</button><button class="btn go" data-act="theme-go" data-id="${key}">${n >= ps.length ? 'Practise again' : n ? 'Continue' : 'Solve puzzles'}</button></div>
  </div>`);
  TV = { key, board: new Board($('#bd')) };
  soundSide = g.turn();
  TV.board.set(g, { flip: g.turn() === 'b' });
  coach('info', `Example: ${g.turn() === 'w' ? 'White' : 'Black'} to move`, 'Try to spot it, then tap See the example to watch the solution.');
}
function themeDemo() {
  if (!TV) return;
  stopTimers();
  const ex = EXAMPLE[TV.key], g = new Chess(ex.fen), b = TV.board;
  b.set(g, { flip: g.turn() === 'b' });
  let t = 300;
  ex.sol.forEach((san, i) => {
    later(() => {
      const m = g.moves({ verbose: true }).find(x => x.san === san);
      b.arrow = { from: m.from, to: m.to }; b.render();
      coach(i & 1 ? 'them' : 'hint', `${i & 1 ? 'Reply' : 'Play'} ${san}`, '');
    }, t);
    later(() => { const m = g.move(san); b.set(g, { last: m }); b.animate(m.from, m.to); sfx.move(m); }, t + 900);
    t += 1700;
  });
  later(() => coach('good', 'That is the idea', 'Now find it yourself in the puzzles.'), t);
}

let P = null;
function puzzleRun(list, title, back, mixed = false) {
  if (!list.length) return toast('No puzzles to do here right now');
  P = { list, i: -1, title, back, mixed, ok: 0, n: 0, delta: 0 };
  nextPuzzle();
}
function nextPuzzle() {
  P.i++;
  if (P.i >= P.list.length) return puzzleSummary();
  const p = (P.p = P.list[P.i]);
  Object.assign(P, { g: new Chess(p.fen), k: 0, fail: false, done: false, hint: 0 });
  const side = P.g.turn();
  show(`
  ${topbar(P.title, 'pz-quit', '', `Puzzle ${P.i + 1} of ${P.list.length}, rated ${p.rating}`)}
  <div class="prog"><i id="pg" style="width:${((P.i / P.list.length) * 100).toFixed(1)}%"></i></div>
  <div class="stage"><div id="bd"></div></div>
  <div class="pad"><div class="coach" id="note"></div></div>
  <nav class="dock"><button data-act="pz-hint">${icon('bulb')}<span>Hint</span></button><button data-act="pz-show">${icon('eye')}<span>Show move</span></button></nav>`);
  P.board = new Board($('#bd'), { onMove: puzzleMove });
  P.board.side = side;
  soundSide = side;
  P.board.set(P.g, { flip: side === 'b' });
  P.board.interactive = true;
  coach('you', `${side === 'w' ? 'White' : 'Black'} to move`, P.mixed ? 'Find the best move.' : THEME[p.theme].tip);
}
const pzMoveObj = () => P.g.moves({ verbose: true }).find(x => x.san === P.p.sol[P.k]);
function puzzleMove(from, to, anim, pr) {
  if (!P || P.done || !P.board.interactive) return;
  const p = P.p, m = findMove(P.g, from, to, pr);
  if (!m) { P.board.render(); return; }
  const want = p.sol[P.k], last = P.k === p.sol.length - 1;
  let ok = m.san === want;
  if (!ok && last && want.endsWith('#')) { const g2 = new Chess(P.g.fen()); g2.move(m.san); ok = g2.isCheckmate(); }
  if (!ok) {
    P.fail = true;
    sfx.bad(); P.board.render(); P.board.flash(to, 'bad'); P.board.shake();
    coach('bad', 'Not the move', 'Try again, or tap Show move.');
    return;
  }
  P.g.move(m.san);
  P.k++;
  P.board.set(P.g, { last: m });
  if (anim) P.board.animate(m.from, m.to);
  P.board.flash(m.to, 'good', 380);
  sfx.move(m);
  if (P.k >= p.sol.length) return puzzleDone();
  P.board.interactive = false;
  coach('good', 'Good move', 'Keep going.');
  later(() => {
    if (!P || P.p !== p) return;
    const r = P.g.move(p.sol[P.k]);
    P.k++;
    P.board.set(P.g, { last: r });
    P.board.animate(r.from, r.to);
    sfx.move(r);
    P.hint = 0;
    P.board.interactive = true;
    coach('you', 'Your move', 'Find the follow-up.');
  }, 600);
}
function pzHint() {
  if (!P || P.done || !P.board.interactive) return;
  P.fail = true;
  if (P.hint) return pzShow();
  P.hint = 1;
  P.board.hintSq = pzMoveObj().from;
  P.board.render();
  coach('hint', 'Move this piece', 'Tap Hint again to see the square.');
}
function pzShow() {
  if (!P || P.done || !P.board.interactive) return;
  P.fail = true;
  const m = pzMoveObj();
  P.board.hintSq = null;
  P.board.arrow = { from: m.from, to: m.to };
  P.board.render();
  coach('hint', `Play ${m.san}`, '');
}
function puzzleDone() {
  const p = P.p, ok = !P.fail, th = THEME[p.theme];
  P.done = true;
  P.board.interactive = false;
  const delta = pzResult(p, ok);
  P.n++; if (ok) P.ok++;
  P.delta += delta;
  today().n++;
  if (ok) addXP(5);
  save();
  if (ok) sfx.good();
  const el = $('#pg'); if (el) el.style.width = (((P.i + 1) / P.list.length) * 100).toFixed(1) + '%';
  coach(ok ? 'good' : 'info', ok ? 'Solved' : 'Now you know it', `<b class="th">${th.name}.</b> ${th.about}`,
    `${delta ? `<p class="delta ${delta > 0 ? 'up' : 'down'}">Rating ${delta > 0 ? '+' : '−'}${Math.abs(delta)}, now ${S.prating}</p>` : ok ? '' : '<p class="delta">It comes back tomorrow so you can solve it properly.</p>'}<button class="btn go sm" data-act="pz-next">${P.i < P.list.length - 1 ? 'Next puzzle' : 'See results'}</button>`);
}
function puzzleSummary() {
  const d = P.delta;
  show(`
  ${topbar(P.title, 'pz-quit')}
  <section class="sum">
    <span class="sum-ic">${icon('award')}</span>
    <h1 class="display">${P.ok} of ${P.n} solved</h1>
    <p class="lead">${d > 0 ? `Your rating went up ${d} points.` : d < 0 ? `Your rating went down ${-d} points. The ones you missed come back tomorrow.` : 'Missed puzzles come back until you solve them.'}</p>
    <div class="trio"><div><b>${S.prating}</b><span>Tactics rating</span></div><div><b>${P.n ? Math.round((100 * P.ok) / P.n) : 0}%</b><span>Solved</span></div><div><b>${streak()}</b><span>Day streak</span></div></div>
    <div class="actions"><button class="btn go" data-act="pz-more">More puzzles</button><button class="btn" data-act="pz-quit">Done</button></div>
  </section>`);
}
function pzBack() {
  const b = P && P.back;
  P = null;
  if (b && b.theme) return themeView(b.theme);
  openTab(b && b.tab ? b.tab : 'tactics', true);
}

/* ================= endgames ================= */
let ENG = null, E = null;
const engine = () => ENG || (ENG = new Engine());
const EGL = Object.fromEntries(ENDGAMES.map(l => [l.id, l]));
const GOAL = { mate: 'Checkmate the king', promote: 'Promote your pawn', win: 'Win the position', draw: 'Hold the draw' };
const goalLine = l => (l.goal === 'draw' ? `Hold the draw for ${l.target} moves` : GOAL[l.goal]);
const egDone = (l, i) => !!(S.eg[l.id] && S.eg[l.id][i]);
const egCount = l => l.fens.filter((_, i) => egDone(l, i)).length;
const uciMove = (g, u) => g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' });
const eAlive = me => E === me && me.board.el.isConnected;
const startPly = fen => { const f = fen.split(' '); return (+f[5] - 1) * 2 + (f[1] === 'b' ? 1 : 0); };
function onlyKing(g, color) { for (const row of g.board()) for (const p of row) if (p && p.color === color && p.type !== 'k') return false; return true; }

function endgamesTab() {
  const groups = [...new Set(ENDGAMES.map(l => l.group))];
  show(`
  <header class="top"><h1 class="display">Endgames</h1></header>
  <p class="hint-text">The endings every player must know. You play each one against the computer, and it tells you the moment a move throws the result away.</p>
  ${groups.map(name => `<h2 class="h2">${name}</h2><div class="group">${ENDGAMES.filter(l => l.group === name).map(l => { const n = egCount(l); return `<div class="orow" role="button" tabindex="0" data-act="eg" data-id="${l.id}"><div class="mb" data-egmini="${l.id}"></div><div class="ot"><b>${l.name}</b><span class="sub">${goalLine(l)}</span><span class="sub">${n} of ${l.fens.length} positions done</span></div>${ring(n / l.fens.length)}</div>`; }).join('')}</div>`).join('')}`, true);
  $$('[data-egmini]').forEach(el => { const l = EGL[el.dataset.egmini]; new Board(el, { mini: true }).set(new Chess(l.fens[0]), { flip: l.side === 'b' }); });
}
function egView(id) {
  const l = EGL[id], next = l.fens.findIndex((_, i) => !egDone(l, i));
  show(`
  ${topbar(l.name, 'tab', 'endgames', `${egCount(l)} of ${l.fens.length} positions done`)}
  <div class="stage"><div id="bd"></div></div>
  <div class="pad">
    <p class="lead">${l.about}</p>
    <h3 class="h3">The method</h3>
    <ul class="ideas">${l.steps.map(s => `<li>${s}</li>`).join('')}</ul>
    <h3 class="h3">Positions</h3>
    <div class="group flush">${l.fens.map((f, i) => `<div class="brow" role="button" tabindex="0" data-act="eg-play" data-id="${id}" data-li="${i}"><span class="nota">Position ${i + 1}</span><span class="bn">${egDone(l, i) ? `Done in ${plural(S.eg[id][i], 'move')}` : 'Not done yet'}</span>${egDone(l, i) ? icon('check', 'okic') : icon('next', 'chev')}</div>`).join('')}</div>
    <div class="actions"><button class="btn" data-act="eg-watch" data-id="${id}" data-li="${Math.max(0, next)}">Watch it played</button><button class="btn go" data-act="eg-play" data-id="${id}" data-li="${Math.max(0, next)}">${next < 0 ? 'Practise again' : 'Practise'}</button></div>
  </div>`);
  new Board($('#bd')).set(new Chess(l.fens[0]), { flip: l.side === 'b' });
}
function egStart(id, idx, watch = false) {
  const l = EGL[id];
  E = { l, idx, watch, g: new Chess(l.fens[idx]), hist: [], moves: 0, busy: true, best: null, par: null, over: false, failed: false, hint: 0 };
  const me = E;
  show(`
  ${topbar(l.name, 'eg-quit', id, watch ? `Watch: position ${idx + 1}` : `Position ${idx + 1} of ${l.fens.length}`)}
  <div class="stage"><div id="bd"></div></div>
  <div class="strip" id="mv"></div>
  <div class="pad"><div class="coach" id="note"></div></div>
  <nav class="dock">${watch
    ? `<button data-act="eg-play" data-id="${id}" data-li="${idx}">${icon('target')}<span>Practise this</span></button>`
    : `<button data-act="eg-hint">${icon('bulb')}<span>Hint</span></button><button data-act="eg-undo">${icon('undo')}<span>Take back</span></button><button data-act="eg-restart">${icon('restart')}<span>Restart</span></button>`}</nav>`);
  me.board = new Board($('#bd'), { onMove: egMove });
  me.board.side = l.side;
  soundSide = l.side;
  me.board.set(me.g, { flip: l.side === 'b' });
  egStrip();
  coach('info', watch ? 'Watch the technique' : goalLine(l), 'The computer is looking at the position…');
  engine().search(me.g.fen(), { movetime: 900 }).then(r => {
    if (!eAlive(me)) return;
    me.best = r.best;
    me.par = r.score;
    if (watch) return egWatchStep(me);
    me.busy = false;
    me.board.interactive = true;
    let txt = 'The computer defends perfectly. Find the winning plan.';
    if (l.goal === 'mate' && r.score && r.score.mate > 0) txt = `Perfect play mates in ${r.score.mate}. Use the method and you will get there.`;
    if (l.goal === 'draw') txt = 'The computer will try everything to win. Find the defensive moves.';
    coach('you', goalLine(l), txt);
  });
}
function egStrip() { const h = E.g.history(); strip($('#mv'), h, h.length, null, startPly(E.l.fens[E.idx])); }
// returns true if the game ended on the last move
function egFinished() {
  const me = E, g = me.g, l = me.l, userMoved = g.turn() !== l.side;
  if (g.isCheckmate()) { if (userMoved) egWin(); else egLose('Checkmate', 'Your king was mated.'); return true; }
  if (g.isDraw()) {
    if (l.goal === 'draw') egWin();
    else if (g.isStalemate()) egLose('Stalemate', 'The king has no legal move but is not in check, so the game is a draw. Always leave it a square.');
    else egLose('Draw', 'The position became a draw.');
    return true;
  }
  if (l.goal === 'win' && userMoved && onlyKing(g, l.side === 'w' ? 'b' : 'w')) { egWin(); return true; }
  return false;
}
function egMove(from, to, anim, pr) {
  const me = E;
  if (!me || me.watch || me.busy || me.over || !me.board.interactive) return;
  const m = findMove(me.g, from, to, pr);
  if (!m) { me.board.render(); return; }
  me.hist.push(me.g.fen());
  me.g.move(m.san);
  me.moves++;
  me.hint = 0;
  me.board.set(me.g, { last: m });
  if (anim) me.board.animate(m.from, m.to);
  sfx.move(m);
  egStrip();
  if (egFinished()) return;
  me.busy = true;
  me.board.interactive = false;
  coach('them', 'The computer is thinking…');
  engine().search(me.g.fen(), { movetime: me.l.goal === 'draw' ? 1000 : 700 }).then(r => {
    if (!eAlive(me)) return;
    if (!r.best) { me.busy = false; me.failed = true; coach('bad', 'The computer stopped', 'Tap Take back to try again.'); return; }
    const l = me.l, mine = flip(r.score), cp = l.cp || 300;
    if (l.goal === 'draw' ? losing(mine, cp) : !winning(mine, cp)) {
      me.busy = false;
      me.failed = true;
      coach('bad', l.goal === 'draw' ? 'That move loses' : 'That lets the win slip', 'Take it back and look for a better move. Hint shows the best one.', '<button class="btn go sm" data-act="eg-undo">Take back</button>');
      return;
    }
    if ((l.goal === 'promote' || l.goal === 'win') && m.promotion) return egWin();
    const rm = uciMove(me.g, r.best);
    me.board.set(me.g, { last: rm });
    me.board.animate(rm.from, rm.to);
    sfx.move(rm);
    me.best = r.pv[1] || null;
    egStrip();
    if (egFinished()) return;
    if (l.goal === 'draw' && me.moves >= l.target) return egWin();
    me.busy = false;
    me.board.interactive = true;
    coach('you', 'Your move', l.goal === 'draw' ? `Moves held: ${me.moves} of ${l.target}.` : l.goal === 'mate' ? `Moves so far: ${me.moves}.` : '');
  });
}
function egHint() {
  const me = E;
  if (!me || me.watch || me.busy || me.over || me.failed) return;
  const reveal = best => {
    if (!best || !eAlive(me)) return;
    if (!me.hint) { me.hint = 1; me.board.hintSq = best.slice(0, 2); me.board.render(); coach('hint', 'Move this piece', 'Tap Hint again to see the square.'); }
    else { me.board.hintSq = null; me.board.arrow = { from: best.slice(0, 2), to: best.slice(2, 4) }; me.board.render(); coach('hint', 'Try this move', ''); }
  };
  if (me.best) return reveal(me.best);
  me.busy = true;
  coach('them', 'Looking for the best move…');
  engine().search(me.g.fen(), { movetime: 800 }).then(r => { if (!eAlive(me)) return; me.busy = false; me.best = r.best; reveal(r.best); });
}
function egUndo() {
  const me = E;
  if (!me || me.watch || !me.hist.length || (me.busy && !me.failed)) return;
  closeSheet();
  me.g = new Chess(me.hist.pop());
  me.moves = Math.max(0, me.moves - 1);
  Object.assign(me, { over: false, busy: false, failed: false, best: null, hint: 0 });
  me.board.set(me.g, {});
  me.board.interactive = true;
  egStrip();
  coach('you', 'Your move', 'Try a different idea.');
}
function egWin() {
  const me = E, l = me.l;
  me.over = true; me.busy = false; me.board.interactive = false;
  if (me.watch) { coach('good', 'That is the technique', 'Now try it yourself.'); return; }
  S.eg[l.id] = S.eg[l.id] || {};
  const prev = S.eg[l.id][me.idx];
  if (!prev || me.moves < prev) S.eg[l.id][me.idx] = me.moves;
  today().n++;
  addXP(15);
  save();
  later(sfx.done, 100);
  const par = l.goal === 'mate' && me.par && me.par.mate > 0 ? ` Perfect play needs ${me.par.mate}.` : '';
  const msg = l.goal === 'mate' ? `Checkmate in ${plural(me.moves, 'move')}.${par}` : l.goal === 'draw' ? `You held the draw for ${plural(me.moves, 'move')}.` : `Won in ${plural(me.moves, 'move')}.`;
  coach('good', 'Well done', msg);
  const next = me.idx + 1 < l.fens.length ? me.idx + 1 : -1;
  later(() => sheet(`<div class="res ok"><span class="res-ic">${icon('check')}</span><h2>${l.goal === 'mate' ? 'Checkmate' : l.goal === 'draw' ? 'Draw held' : 'Position won'}</h2><p class="muted">${l.name}, position ${me.idx + 1}</p><p class="note">${msg}</p>
    <div class="actions"><button class="btn" data-act="eg-play" data-id="${l.id}" data-li="${me.idx}">Play it again</button>${next >= 0 ? `<button class="btn go" data-act="eg-play" data-id="${l.id}" data-li="${next}">Next position</button>` : `<button class="btn go" data-act="eg-quit" data-id="${l.id}">Done</button>`}</div></div>`), 700);
}
function egLose(title, text) {
  const me = E;
  me.over = true; me.busy = false; me.failed = true; me.board.interactive = false;
  coach('bad', title, text, me.watch ? '' : '<button class="btn go sm" data-act="eg-undo">Take back</button>');
}
function egWatchStep(me) {
  if (!eAlive(me) || me.over) return;
  if (me.moves >= 40) return coach('info', 'Paused', 'Tap Practise this to try it yourself.');
  engine().search(me.g.fen(), { movetime: 600 }).then(r => {
    if (!eAlive(me) || !r.best) return;
    const m = uciMove(me.g, r.best);
    me.board.set(me.g, { last: m });
    me.board.animate(m.from, m.to);
    sfx.move(m);
    egStrip();
    if (m.color === me.l.side) me.moves++;
    if (egFinished()) return;
    const l = me.l;
    if (m.color === l.side && (((l.goal === 'promote' || l.goal === 'win') && m.promotion) || (l.goal === 'draw' && me.moves >= l.target))) return egWin();
    coach('info', 'Watch the technique', l.steps[Math.min(l.steps.length - 1, Math.floor(me.moves / 3))]);
    later(() => egWatchStep(me), 500);
  });
}

/* ================= play the computer ================= */
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// the computer's ladder, weakest first: Stockfish skill level and search depth (depth 0 = one second a move)
const BOTS = [
  { name: 'Nico', elo: 400, pc: 'bP', about: 'Just learned how the pieces move.', skill: 0, depth: 1 },
  { name: 'Lina', elo: 600, pc: 'bN', about: 'Loves to attack and forgets to defend.', skill: 1, depth: 2 },
  { name: 'Tariq', elo: 800, pc: 'bB', about: 'Knows the basics but still hangs pieces.', skill: 3, depth: 3 },
  { name: 'Sofia', elo: 1000, pc: 'bR', about: 'Plays solid openings and misses some tactics.', skill: 5, depth: 4 },
  { name: 'Marc', elo: 1200, pc: 'bQ', about: 'A club regular who punishes loose pieces.', skill: 7, depth: 5 },
  { name: 'Eleni', elo: 1400, pc: 'bK', about: 'Sharp, and quick to spot tactics.', skill: 8, depth: 6 },
  { name: 'Karim', elo: 1700, pc: 'wN', about: 'A strong club player with few weak spots.', skill: 11, depth: 8 },
  { name: 'Anya', elo: 2000, pc: 'wQ', about: 'Expert level. She rarely makes a mistake.', skill: 15, depth: 0 },
];
// clock choices: minutes each, plus seconds added after every move
const TCS = [{ min: 0, inc: 0, label: 'Off' }, { min: 5, inc: 0, label: '5 min' }, { min: 10, inc: 0, label: '10 min' }, { min: 15, inc: 10, label: '15+10' }, { min: 30, inc: 0, label: '30 min' }];
const tcName = tc => (!tc.min ? 'no clock' : tc.inc ? `${tc.min} + ${tc.inc}` : `${tc.min} minutes`);
const PIECE_NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
// G.view: null while you are on the game itself, or the number of moves shown while you look back
// G.canMove: whether the game is waiting for your move (the board only takes it when you are not looking back)
// G.note: what the coach says about the game, shown again when you come back from looking back
// G.clock: time left for each colour in ms; `run` is the colour whose time is running since `at`
let G = null, pend = null;
const gAlive = me => G === me && me.board.el.isConnected;
const gLast = me => me.g.history({ verbose: true }).pop() || null;
// the game in progress is saved after every move, so closing the app never loses it
function gSave(me) {
  if (me.over) return;
  S.live = me.g.history({ verbose: true }).some(m => m.color === me.side)
    ? { start: me.start, side: me.side, bi: me.bi, tc: TCS.indexOf(me.tc), rated: me.rated, sans: me.g.history(), back: me.back,
      clock: me.clock ? { w: Math.max(0, clkLeft(me, 'w')), b: Math.max(0, clkLeft(me, 'b')) } : null }
    : null;
  save();
}
// with a game already in progress, offer to carry on with it before starting another
function playAsk(fen, side, back) {
  const L = S.live, bot = L && BOTS[L.bi];
  if (!bot) return playSheet(fen, side, back);
  pend = { fen, side, back };
  sheet(`<div class="res"><h2>Game in progress</h2><p class="note">${L.rated ? 'A rated' : 'A casual'} game against ${bot.name} (${bot.elo}), ${plural(Math.ceil(L.sans.length / 2), 'move')} played.${L.rated ? ' Starting a new game counts it as a loss.' : ''}</p>
    <div class="actions"><button class="btn" data-act="g-new">New game</button><button class="btn go" data-act="g-resume">Resume</button></div></div>`, true);
}
function playSheet(fen, side, back) {
  pend = { fen, side, back };
  const fresh = fen === START;
  sheet(`<div class="res play"><h2>Play the computer</h2>
    ${fresh ? `<div class="seg sm wide" id="pmode">${[['casual', 'Casual'], ['rated', 'Rated']].map(([v, n]) => `<button data-act="g-mode" data-id="${v}">${n}</button>`).join('')}</div>
    <p class="note" id="pnote"></p>`
    : '<p class="note">Play on from this position with the side you were learning. It’s a casual game, so your rating stays the same.</p>'}
    <div class="bots" id="pbots">${BOTS.map((b, i) => `<button class="bot" data-act="bot" data-id="${i}" aria-label="${b.name}, rated ${b.elo}"><i class="pc ${b.pc}"></i><b>${b.name}</b><span>${b.elo}</span>${S.beat[i] ? icon('check', 'won') : ''}</button>`).join('')}</div>
    <p class="note" id="pabout"></p>
    <span class="lab">Clock</span><div class="seg sm wide" id="ptc">${TCS.map((t, i) => `<button data-act="tc" data-id="${i}">${t.label}</button>`).join('')}</div>
    ${fresh ? `<span class="lab">Play as</span><div class="seg sm wide">${[['w', 'White'], ['b', 'Black']].map(([v, n]) => `<button class="${side === v ? 'on' : ''}" data-act="bot-side" data-id="${v}">${n}</button>`).join('')}</div>` : ''}
    <div class="actions"><button class="btn" data-act="sheet-close">Cancel</button><button class="btn go" data-act="g-start">Play</button></div></div>`, true);
  playSync(true);
}
// show the current choices in the play sheet
function playSync(scroll) {
  $$('#pmode button').forEach(b => b.classList.toggle('on', (b.dataset.id === 'rated') === S.rated));
  const note = $('#pnote'), bot = BOTS[S.bot];
  if (note) note.textContent = S.rated ? `No take backs, hints or blunder warnings. Your rating, now ${S.elo.r}, goes up or down with the result.` : 'Take backs, hints and blunder warnings are on. Your rating stays the same.';
  $$('#pbots .bot').forEach(b => b.classList.toggle('on', +b.dataset.id === S.bot));
  $('#pabout').textContent = bot.about + (S.beat[S.bot] ? ` You’ve beaten ${bot.name} in a rated game.` : '');
  $$('#ptc button').forEach(b => b.classList.toggle('on', +b.dataset.id === S.tc));
  const row = $('#pbots'), on = $('#pbots .bot.on');
  if (scroll && row && on) row.scrollLeft = on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2;
}
function playStart(live = null) {
  closeSheet();
  if (live) { pend = { fen: live.start, side: live.side, back: live.back }; S.bot = live.bi; S.tc = Math.max(0, live.tc); if (live.start === START) S.rated = live.rated; }
  const { fen, side, back } = pend;
  const bot = BOTS[S.bot], tc = TCS[S.tc] || TCS[0], rated = fen === START && S.rated, opp = side === 'w' ? 'b' : 'w';
  const me = G = { g: new Chess(fen), side, back, start: fen, over: false, view: null, canMove: false, stuck: false, note: null, hint: null,
    bot, bi: S.bot, rated, tc, clock: tc.min ? { w: tc.min * MIN, b: tc.min * MIN, run: null, at: 0 } : null };
  show(`
  ${topbar('Play the computer', 'g-quit', '', `${rated ? 'Rated' : 'Casual'} game, ${tcName(tc)}`)}
  <div class="pbar" id="pb-${opp}"></div>
  <div class="stage"><div id="bd"></div></div>
  <div class="pbar" id="pb-${side}"></div>
  <div class="strip" id="mv"></div>
  <div class="pad"><div class="coach" id="note"></div></div>
  <nav class="dock">
    ${rated ? '' : `<button data-act="g-undo">${icon('undo')}<span>Take back</span></button>
    <button data-act="g-hint">${icon('bulb')}<span>Hint</span></button>`}
    <button data-act="g-resign">${icon('flag')}<span>Resign</span></button>
    <button class="step" data-act="g-prev" aria-label="Previous move">${icon('back')}</button>
    <button class="step" data-act="g-next" aria-label="Next move">${icon('next')}</button>
  </nav>`);
  me.board = new Board($('#bd'), { onMove: gMove });
  me.board.side = side;
  // while you look back, touching the board brings you back to the game
  me.board.el.addEventListener('pointerdown', () => { if (G && G.view != null) gGo(Infinity); });
  soundSide = side;
  if (live) {
    try { for (const san of live.sans) me.g.move(san); } catch {}
    if (me.clock && live.clock) Object.assign(me.clock, { w: live.clock.w, b: live.clock.b });
  }
  me.board.set(me.g, { flip: side === 'b', last: gLast(me) });
  if (me.clock) me.tick = setInterval(() => gTick(me), 100);
  gTurn();
}
/* --- clocks --- */
const clkLeft = (me, c) => me.clock[c] - (me.clock.run === c ? Date.now() - me.clock.at : 0);
function clkStop(me) { const k = me.clock; if (!k || !k.run) return; k[k.run] -= Date.now() - k.at; k.run = null; }
function clkRun(me, c) {
  const k = me.clock;
  if (!k || me.over || k.run === c) return;
  clkStop(me);
  if (document.hidden) { k.paused = true; return; }   // starts when you come back to the app
  k.run = c; k.at = Date.now();
}
function clkAdd(me, c) { if (me.clock && me.tc.inc) me.clock[c] += me.tc.inc * 1000; }
function clkText(ms) {
  if (ms < 10000) return '0:0' + (Math.floor(ms / 100) / 10).toFixed(1);
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
// the clock does not run while the app is in the background (a call, another app)
document.addEventListener('visibilitychange', () => {
  const me = G, k = me && me.clock;
  if (!k || me.over) return;
  if (document.hidden) { if (k.run) { clkStop(me); k.paused = true; } }
  else if (k.paused) { k.paused = false; clkRun(me, me.pending ? me.side : me.g.turn()); }
});
function gTick(me) {
  if (!me.clock) return;
  if (!gAlive(me)) { clearInterval(me.tick); return; }
  for (const c of ['w', 'b']) {
    const el = $('#ck-' + c);
    if (!el) continue;
    const left = Math.max(0, clkLeft(me, c));
    el.textContent = clkText(left);
    el.classList.toggle('on', me.clock.run === c);
    el.classList.toggle('low', left < 20000);
  }
  const run = me.clock.run;
  if (run && !me.over && clkLeft(me, run) <= 0) gFlag(me, run);
}
// a side with only a king, or a king and one knight or bishop, cannot checkmate
function noMate(g, c) {
  const ps = [];
  for (const row of g.board()) for (const p of row) if (p && p.color === c && p.type !== 'k') ps.push(p.type);
  return !ps.length || (ps.length === 1 && (ps[0] === 'n' || ps[0] === 'b'));
}
function gFlag(me, c) {
  clkStop(me);
  me.clock[c] = 0;
  const other = c === 'w' ? 'b' : 'w', you = c === me.side, draw = noMate(me.g, other);
  const name = me.bot.name;
  if (draw) gEnd('d', you ? `You ran out of time, but ${name} can’t checkmate you.` : `${name} ran out of time, but you can’t checkmate them.`);
  else gEnd(you ? 'l' : 'w', you ? 'You ran out of time.' : `${name} ran out of time.`);
}
// the bars above and below the board: who is playing, what they have taken, and their clock
function gBars() {
  const me = G, hist = me.g.history({ verbose: true }), k = me.view ?? hist.length;
  const g = me.view == null ? me.g : new Chess(k ? hist[k - 1].after : me.start);
  const have = { w: {}, b: {} };
  for (const row of g.board()) for (const p of row) if (p) have[p.color][p.type] = (have[p.color][p.type] || 0) + 1;
  const full = { n: 2, b: 2, r: 2, q: 1 }, mat = c => Object.entries(have[c]).reduce((s, [t, n]) => s + VAL[t] * n, 0);
  const lead = mat('w') - mat('b');
  for (const c of ['w', 'b']) {
    const el = $('#pb-' + c);
    if (!el) continue;
    const o = c === 'w' ? 'b' : 'w', you = c === me.side, h = have[o];
    // what this side has taken is what the other side is missing (a promoted pawn is not missing)
    const extra = ['n', 'b', 'r', 'q'].reduce((s, t) => s + Math.max(0, (h[t] || 0) - full[t]), 0);
    let taken = '';
    for (let i = (h.p || 0) + extra; i < 8; i++) taken += `<i class="pc ${o}P"></i>`;
    for (const t of ['n', 'b', 'r', 'q']) for (let i = h[t] || 0; i < full[t]; i++) taken += `<i class="pc ${o}${t.toUpperCase()}"></i>`;
    const up = c === 'w' ? lead : -lead;
    el.innerHTML = `<i class="pc pav ${you ? c + 'K' : me.bot.pc}"></i><span class="pn"><b>${you ? 'You' : me.bot.name}</b><small>${you ? S.elo.r : me.bot.elo}</small></span>`
      + `<span class="caps">${taken}${up > 0 ? `<em>+${up}</em>` : ''}</span>${me.clock ? `<span class="clk" id="ck-${c}"></span>` : ''}`;
  }
  gTick(me);
}
// keep the saved clocks current when the app goes to the background
document.addEventListener('visibilitychange', () => { if (document.hidden && G && !G.over && !G.pending && S.live) gSave(G); });
function gNote(me, kind, title, text = '') {
  me.note = [kind, title, text];
  if (me.view == null) coach(kind, title, text);
}
function gLet(me, on) {
  me.canMove = on;
  if (me.view == null) me.board.interactive = on;
}
function gTurn() {
  const me = G;
  if (gOver()) return;
  gSave(me);
  if (me.g.turn() === me.side) {
    gLet(me, true);
    gNote(me, 'you', 'Your move', me.g.inCheck() ? 'You are in check.' : '');
    clkRun(me, me.side);
    gPrecheck(me);
  } else {
    gLet(me, false);
    gNote(me, 'them', `${me.bot.name} is thinking…`);
    // the computer's thinking time counts from your move, so the blunder check is part of it
    const { skill, depth } = me.bot, comp = me.g.turn(), t0 = me.movedAt || Date.now();
    me.movedAt = 0;
    clkRun(me, comp);
    const movetime = me.clock ? Math.max(100, Math.min(1000, clkLeft(me, comp) / 30)) : 1000;
    engine().search(me.g.fen(), depth ? { depth, skill } : { movetime, skill }).then(r => {
      if (!gAlive(me) || me.over || me.g.turn() === me.side) return;
      const left = r.best ? gThinkTime(me, r.best) - (Date.now() - t0) : 0;
      if (left > 0) later(() => gReply(me, r), left);
      else gReply(me, r);
    });
  }
  gShow();
}
// how long the computer takes to answer, so it feels like a person across the board:
// quick with a forced move, a recapture or an opening move, longer when the position needs thought
function gThinkTime(me, best) {
  const g = me.g, prev = gLast(me), r = (a, b) => a + (b - a) * Math.random();
  let ms;
  if (g.moves().length === 1) ms = r(500, 900);
  else if (prev && prev.captured && best.slice(2, 4) === prev.to) ms = r(800, 1600);
  else if (me.start === START && g.history().length < 8) ms = r(900, 2000);
  else if (g.inCheck()) ms = r(1000, 2500);
  else ms = 1500 + 3500 * Math.random() ** 1.6;   // usually 2 to 4 seconds, now and then up to 5
  ms *= 0.9 + 0.05 * me.bi;                         // stronger bots take a little longer
  if (me.clock) ms = Math.min(ms, Math.max(150, clkLeft(me, g.turn()) / 25));   // and hurry when their clock runs low
  return ms;
}
function gReply(me, r) {
  if (!gAlive(me) || me.over || me.g.turn() === me.side) return;
  if (!r.best) { me.stuck = true; gNote(me, 'bad', `${me.bot.name} stopped`, 'The engine didn’t answer. Tap Take back, or start a new game.'); gShow(); return; }
  clkStop(me);
  clkAdd(me, me.g.turn());
  const m = uciMove(me.g, r.best);
  // while you look back, the board stays where you are; the move still sounds and shows in the list
  if (me.view == null) { me.board.set(me.g, { last: m }); me.board.animate(m.from, m.to); }
  sfx.move(m);
  gTurn();
}
function gMove(from, to, anim, pr) {
  const me = G;
  if (!me || me.over || !me.canMove || me.view != null) return;
  const m = findMove(me.g, from, to, pr);
  if (!m) { me.board.render(); return; }
  const fen = me.g.fen(), key = `${fen} ${m.san}`;
  me.g.move(m.san);
  me.hint = null;
  me.movedAt = Date.now();
  me.board.set(me.g, { last: m });
  if (anim) me.board.animate(m.from, m.to);
  sfx.move(m);
  clkStop(me);
  // rated games have no warnings, and a move you already chose to play after a warning is not questioned again
  if (!S.warn || me.rated || me.warned === key) { clkAdd(me, me.side); return gTurn(); }
  gLet(me, false);
  gNote(me, 'them', `${me.bot.name} is thinking…`);
  gShow();
  const after = me.g.fen();
  gCheck(me, fen, m).then(why => {
    if (!gAlive(me) || me.over || me.g.fen() !== after) return;
    if (!why) { clkAdd(me, me.side); return gTurn(); }
    me.warned = key;
    me.pending = m;
    clkRun(me, me.side);                      // still your time while you decide
    if (me.view != null) gGo(Infinity);
    gNote(me, 'hint', 'Are you sure?', why);
    sheet(`<div class="res meh"><span class="res-ic">${icon('alert')}</span><h2>Are you sure?</h2><p class="note">${why}</p>
      <div class="actions"><button class="btn" data-act="g-anyway">Play it anyway</button><button class="btn go" data-act="g-rethink">Think again</button></div></div>`);
  });
}
/* --- blunder warning --- */
// while it is your move, the engine quietly scores the position, so your move can be checked straight away
function gPrecheck(me) {
  if (!S.warn || me.rated) return;
  const fen = me.g.fen();
  if (!me.pre || me.pre.fen !== fen) me.pre = { fen, p: engine().search(fen, { movetime: 400 }) };
}
// is the move you just played a big blunder? Returns what to tell you, or null when it is fine
async function gCheck(me, fen, m) {
  const g = me.g;
  if (g.isCheckmate()) return null;
  const pre = await (me.pre && me.pre.fen === fen ? me.pre.p : engine().search(fen, { movetime: 400 }));
  if (!pre || !pre.score) return null;
  if (pre.best && pre.best.slice(0, 4) === m.from + m.to) return null;      // the engine's own choice
  const clamp = cp => Math.max(-1500, Math.min(1500, cp)), before = clamp(toCp(pre.score));
  let after, why = '';
  if (g.isGameOver()) { after = 0; why = 'It ends the game in a draw.'; }
  else {
    const r = await engine().search(g.fen(), { movetime: 500 });
    if (!r || !r.score) return null;
    const doomed = pre.score.mate != null && pre.score.mate < 0;            // you were being mated anyway
    if (r.score.mate != null && r.score.mate > 0 && !doomed) return r.score.mate <= 3 ? `It lets ${me.bot.name} checkmate you.` : `It lets ${me.bot.name} force checkmate.`;
    after = clamp(-toCp(r.score));
    why = gLoses(g.fen(), r.pv, me.side, me.bot.name);
  }
  // only real blunders: losing a piece or more, not small slips
  const loss = before - after, drop = winP(before) - winP(after);
  if (loss < 250 || (drop < 0.15 && loss < 450)) return null;
  return why || `${me.bot.name} has a strong answer to it.`;
}
// what the computer's best line wins from you, in words
function gLoses(fen, pv, side, name) {
  const g = new Chess(fen);
  let net = 0, big = null;
  for (const u of (pv || []).slice(0, 10)) {
    let mv = null;
    try { mv = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { break; }
    if (!mv || !mv.captured) continue;
    if (mv.color === side) net -= VAL[mv.captured];
    else { net += VAL[mv.captured]; if (!big || VAL[mv.captured] > VAL[big]) big = mv.captured; }
  }
  if (net < 2 || !big) return '';
  return big === 'p' ? `${name} can win material.` : `${name} can win your ${PIECE_NAME[big]}.`;
}
function gRethink() {
  const me = G, m = me.pending;
  me.pending = null;
  me.view = null;
  me.movedAt = 0;
  me.g.undo();
  me.board.set(me.g, { last: gLast(me) });
  me.board.animate(m.to, m.from);
  gTurn();
  gNote(me, 'you', 'Your move', `Your move was taken back. Have another look.${me.g.inCheck() ? ' You are in check.' : ''}`);
}
// look at the board as it was after k moves of this game; k past the end means back to the game
function gGo(k) {
  const me = G;
  if (!me) return;
  const hist = me.g.history({ verbose: true }), n = hist.length, cur = me.view ?? n;
  k = Math.max(0, Math.min(n, k));
  if (k === cur) return;
  me.view = k === n ? null : k;
  if (me.view == null) {
    me.board.set(me.g, { last: hist[n - 1] || null, arrow: me.hint });
    me.board.interactive = me.canMove;
  } else {
    me.board.set(new Chess(k ? hist[k - 1].after : me.start), { last: hist[k - 1] || null });
    me.board.interactive = false;
  }
  if (k === cur + 1) { const m = hist[k - 1]; me.board.animate(m.from, m.to); sfx.move(m); }
  else if (k === cur - 1) { const m = hist[k]; me.board.animate(m.to, m.from); }
  gShow();
}
function gShow() {
  const me = G, hist = me.g.history({ verbose: true }), n = hist.length, from = startPly(me.start), k = me.view ?? n;
  strip($('#mv'), hist.map(m => m.san), k, 'g-view', from);
  gBars();
  const prev = $('[data-act="g-prev"]'), next = $('[data-act="g-next"]');
  if (prev) prev.disabled = k === 0;
  if (next) { next.disabled = me.view == null; next.classList.toggle('primary', me.view != null); }
  if (me.view == null) { if (me.note) coach(...me.note); return; }
  const m = hist[k - 1], nx = hist[k], mine = x => x.color === me.side;
  const title = m ? `${mine(m) ? 'You' : me.bot.name} played ${moveLabel(from + k - 1, m.san)}`
    : me.start === START ? 'Start of the game' : 'Starting position';
  let text = `Next ${mine(nx) ? 'you' : me.bot.name} played ${moveLabel(from + k, nx.san)}`;
  if (nx.captured) text += `, taking ${mine(nx) ? `${me.bot.name}’s` : 'your'} ${PIECE_NAME[nx.captured]}`;
  text += '.';
  if (!me.over && me.canMove) text += ' It’s your move in the game.';
  coach('info', title, text, '<button class="btn sm" data-act="g-live">Back to game</button>');
}
function gOver() {
  const g = G.g;
  let res = null, why = '';
  if (g.isCheckmate()) { res = g.turn() === G.side ? 'l' : 'w'; why = 'Checkmate.'; }
  else if (g.isStalemate()) { res = 'd'; why = 'Stalemate.'; }
  else if (g.isInsufficientMaterial()) { res = 'd'; why = 'Neither side can checkmate.'; }
  else if (g.isThreefoldRepetition()) { res = 'd'; why = 'The same position came up three times.'; }
  else if (g.isDraw()) { res = 'd'; why = 'Fifty moves without a capture or pawn move.'; }
  if (!res) return false;
  gEnd(res, why);
  return true;
}
function gEnd(res, why) {
  const me = G;
  clkStop(me);
  clearInterval(me.tick);
  me.over = true;
  me.result = res;
  // the game is over: show the final position, even if you were looking back
  if (me.view != null) { me.view = null; me.board.set(me.g, { last: gLast(me) }); }
  gLet(me, false);
  S.live = null;
  S.games[res]++;
  today().n++;
  if (res === 'w') addXP(25);
  const rate = me.rated ? gRate(me, res) : '';
  later(sfx.done, 100);
  save();
  const title = { w: 'You won', l: 'You lost', d: 'Draw' }[res];
  gNote(me, res === 'w' ? 'good' : res === 'l' ? 'bad' : 'info', title, why);
  gShow();
  later(() => gAlive(me) && me.over && sheet(`<div class="res ${res === 'w' ? 'ok' : 'meh'}"><span class="res-ic">${icon(res === 'w' ? 'check' : res === 'l' ? 'flag' : 'restart')}</span><h2>${title}</h2><p class="muted">${why}</p>${rate}
    <p class="note">${me.rated ? `Rated games: ${S.elo.w} won, ${S.elo.l} lost, ${S.elo.d} drawn.` : `Against the computer: ${S.games.w} won, ${S.games.l} lost, ${S.games.d} drawn.`}</p>
    <div class="actions"><button class="btn" data-act="g-quit">Done</button><button class="btn" data-act="g-review">Review</button><button class="btn go" data-act="g-again">Play again</button></div></div>`), 700);
}
function gRate(me, res) {
  const e = S.elo, before = e.r, first = res === 'w' && !S.beat[me.bi];
  const expect = 1 / (1 + 10 ** ((me.bot.elo - before) / 400)), score = res === 'w' ? 1 : res === 'd' ? 0.5 : 0;
  e.r = Math.max(100, Math.round(before + (e.n < 10 ? 40 : 24) * (score - expect)));
  e.n++;
  e[res]++;
  e.peak = Math.max(e.peak, e.r);
  e.hist.push([Date.now(), e.r]);
  if (e.hist.length > 300) e.hist.shift();
  if (res === 'w') S.beat[me.bi] = true;
  const d = e.r - before;
  return `<p class="rate">Rating <b>${e.r}</b> <em class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}</em></p>`
    + (first ? `<p class="note">Your first win against ${me.bot.name}.</p>` : '');
}
function gUndo() {
  const me = G;
  if (!me || me.rated || (!me.over && !me.canMove && !me.stuck)) return;
  if (!me.g.history().length) return;
  closeSheet();
  if (me.over) { S.games[me.result] = Math.max(0, S.games[me.result] - 1); me.over = false; save(); }
  Object.assign(me, { view: null, hint: null, stuck: false });
  me.g.undo();
  while (me.g.history().length && me.g.turn() !== me.side) me.g.undo();
  me.board.set(me.g, { last: gLast(me) });
  gTurn();
}
function gHint() {
  const me = G;
  if (!me || me.rated || me.over || !me.canMove) return;
  if (me.view != null) gGo(Infinity);
  gLet(me, false);
  gNote(me, 'them', 'Looking for a good move…');
  engine().search(me.g.fen(), { movetime: 800 }).then(r => {
    if (!gAlive(me) || me.over) return;
    gLet(me, true);
    if (!r.best) gNote(me, 'you', 'Your move', 'No hint this time.');
    else {
      me.hint = { from: r.best.slice(0, 2), to: r.best.slice(2, 4) };
      if (me.view == null) { me.board.arrow = me.hint; me.board.render(); }
      gNote(me, 'hint', 'Try this move', 'This is the engine’s suggestion.');
    }
    gShow();
  });
}
/* --- game review --- */
let RV = null;
const toCp = s => (!s ? 0 : s.mate != null ? (s.mate > 0 ? 10000 : -10000) : s.cp);
const winP = cp => 1 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cp))));
function bookCheck(sans, side) {
  let deepest = null;
  for (let k = 0; k < sans.length; k++) {
    const opts = new Map();
    for (const ln of ALL) {
      if (ln.moves.length <= k) continue;
      let same = true;
      for (let i = 0; i < k; i++) if (ln.moves[i] !== sans[i]) { same = false; break; }
      if (same) { if (!opts.has(ln.moves[k])) opts.set(ln.moves[k], []); opts.get(ln.moves[k]).push(ln); }
    }
    if (!opts.size) return { k, deepest, end: true };
    if (!opts.has(sans[k])) {
      const mine = (k & 1 ? 'b' : 'w') === side;
      const rep = mine ? [...opts].map(([s, ls]) => [s, ls.filter(l => l.op.side === side)]).filter(([, ls]) => ls.length) : [];
      return { k, deepest, mine, played: sans[k], rep };
    }
    deepest = opts.get(sans[k])[0];
  }
  return { k: sans.length, deepest, all: true };
}
function bookText(b) {
  if (!b.deepest) return 'The game left the lines in this app straight away.';
  const name = b.deepest.op.name, at = moveLabel(b.k, b.played || '');
  if (b.all) return `The whole game stayed inside your ${name} lines.`;
  if (b.end) return `The game followed your ${name} lines right to the end of a line.`;
  if (b.mine && b.rep.length) return `The game followed your ${name} lines until you played ${at}. Your repertoire move there is ${b.rep.map(([s, ls]) => `${moveLabel(b.k, s)} (${ls[0].op.name})`).join(' or ')}.`;
  if (b.mine) return `The game followed your ${name} lines until you left them with ${at}.`;
  return `The game followed your ${name} lines until the computer left them with ${at}.`;
}
// how each move is rated in the review, best to worst (the names chess.com uses)
const MK = {
  star: '<svg viewBox="0 0 24 24"><path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.4-4.1 6-.7z"/></svg>',
  thumb: '<svg viewBox="0 0 24 24"><path d="M3 10.5h3.5V20H3zM8.5 20h8.3a2 2 0 0 0 2-1.6l1.4-6.4a2 2 0 0 0-2-2.4h-4.6l.7-3.4a1.6 1.6 0 0 0-2.9-1.2l-2.9 5.4z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M3.5 5.5c2.8-.9 5.6-.6 7.5 1v13c-1.9-1.5-4.7-1.8-7.5-.9zM20.5 5.5c-2.8-.9-5.6-.6-7.5 1v13c1.9-1.5 4.7-1.8 7.5-.9z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>',
};
const CLS = {
  brilliant: { name: 'Brilliant', sym: '!!', say: 'brilliant', kind: 'good' },
  great: { name: 'Great', sym: '!', say: 'a great move', kind: 'good' },
  best: { name: 'Best', sym: MK.star, say: 'the best move', kind: 'good' },
  excellent: { name: 'Excellent', sym: MK.thumb, say: 'excellent', kind: 'good' },
  good: { name: 'Good', sym: MK.check, say: 'good', kind: 'info' },
  book: { name: 'Book', sym: MK.book, say: 'a book move', kind: 'info' },
  inaccuracy: { name: 'Inaccuracy', sym: '?!', say: 'an inaccuracy', kind: 'hint' },
  mistake: { name: 'Mistake', sym: '?', say: 'a mistake', kind: 'hint' },
  miss: { name: 'Miss', sym: MK.x, say: 'a miss', kind: 'bad' },
  blunder: { name: 'Blunder', sym: '??', say: 'a blunder', kind: 'bad' },
};
const SLIPS = new Set(['inaccuracy', 'mistake', 'miss', 'blunder']);
const mark = c => `<i class="mk c-${c}" aria-label="${CLS[c].name}">${CLS[c].sym}</i>`;
// the big opening book (every named opening), loaded the first time a game is reviewed
let OBOOK = null;
const loadBook = () => (OBOOK = OBOOK || import('./book.js').then(m => m.BOOK).catch(() => null));
// for each move of the game: the name of the opening reached so far, or null once the game has left the book
function bookPath(me, ob) {
  if (!ob) return [];
  const key = s => s.replace(/[+#]/g, '');
  let node = ob.tree, name = '';
  const step = s => { node = node && node[key(s)]; if (node && node.$ != null) name = ob.names[node.$]; return node ? name : null; };
  for (const s of me.pre) step(s);
  return me.sans.map(step);
}
// every position and move in your opening lines, so moves from them count as book moves
const BOOK = new Map();
for (const ln of ALL) ln.moves.forEach((san, k) => { const key = fen4(ln.fens[k]) + '|' + san; if (!BOOK.has(key)) BOOK.set(key, ln); });
// after a move, can the opponent take a knight or more from the side that moved and come out ahead,
// even counting what that move took? That is a sacrifice. (A piece taken by something cheaper, or taken with nothing able to take back.)
function sacrifice(fen, took) {
  const g = new Chess(fen);
  if (g.isGameOver()) return false;
  for (const c of g.moves({ verbose: true })) {
    if (!c.captured || c.captured === 'p') continue;
    const g2 = new Chess(fen);
    g2.move(c.san);
    const back = g2.moves({ verbose: true }).some(r => r.to === c.to);
    const gain = back ? VAL[c.captured] - VAL[c.piece] : VAL[c.captured];
    if (gain - took >= 1) return true;
  }
  return false;
}
function reviewStart() {
  closeSheet();
  const me = G, hist = me.g.history({ verbose: true }), g = new Chess(me.start), fens = [g.fen()];
  for (const m of hist) { g.move(m.san); fens.push(g.fen()); }
  const from = me.back && me.back.line && me.start !== START ? me.back.line : null;
  RV = { side: me.side, start: me.start, bot: me.bot, fens, hist, sans: hist.map(m => m.san), vm: hist.map(m => ({ from: m.from, to: m.to })),
    pre: me.start === START ? [] : from ? byId[from[0]].lines[from[1]].moves.slice(0, from[2]) : null,
    k: fens.length - 1, score: [], best: [], second: [], secondMove: [], cls: [], loss: [], acc: [], path: [], done: false };
  show(`
  ${topbar('Game review', 'g-quit', '', `Against ${me.bot.name} (${me.bot.elo}), you played ${me.side === 'w' ? 'White' : 'Black'}`)}
  <div class="stage"><div id="bd"></div></div>
  <div class="strip" id="mv"></div>
  <div class="pad"><div class="coach" id="note"></div><div id="rvsum"></div></div>
  <nav class="dock">
    <button data-act="rv-go" data-k="0" aria-label="Go to start">${icon('first')}</button>
    <button data-act="rv-step" data-k="-1" aria-label="Previous move">${icon('back')}</button>
    <button data-act="rv-step" data-k="1" class="primary" aria-label="Next move">${icon('next')}</button>
    <button data-act="rv-go" data-k="${fens.length - 1}" aria-label="Go to end">${icon('last')}</button>
  </nav>`);
  RV.board = new Board($('#bd'));
  rvShow();
  rvAnalyse(RV);
}
async function rvAnalyse(me) {
  const sum = $('#rvsum');
  if (sum) sum.innerHTML = '<div class="wait"><p><span>Analysing your game</span><span id="rvpc">0%</span></p><div class="prog"><i id="rvpg"></i></div></div>';
  for (let i = 0; i < me.fens.length; i++) {
    if (RV !== me || !me.board.el.isConnected) return;
    const pg = $('#rvpg'), pc = $('#rvpc'), pct = Math.round(((i + 1) / me.fens.length) * 100) + '%';
    if (pg) pg.style.width = pct;
    if (pc) pc.textContent = pct;
    const g = new Chess(me.fens[i]);
    if (g.isCheckmate()) { me.score[i] = { mate: 0 }; continue; }
    if (g.isDraw()) { me.score[i] = { cp: 0 }; continue; }
    // the two best moves, so a move that was the only good one can be recognised
    const r = await engine().search(me.fens[i], { movetime: 500, multipv: 2 });
    me.score[i] = r.score || { cp: 0 };
    me.best[i] = r.best;
    me.second[i] = r.lines[1] ? r.lines[1].score : null;
    me.secondMove[i] = r.lines[1] ? r.lines[1].pv[0] : null;
  }
  if (RV !== me) return;
  if (me.pre) me.path = bookPath(me, await loadBook());
  if (RV !== me) return;
  rvClassify(me);
  me.done = true;
  rvSummary(me);
  rvShow();
}
// rate every move from the engine's scores; scores are from the point of view of the side to move
function rvClassify(me) {
  let inBook = true;
  me.hist.forEach((m, i) => {
    const uci = m.from + m.to + (m.promotion || ''), best = me.best[i] === uci;
    // the engine's best and second-best moves are scored in the same search, which keeps them consistent;
    // any other move is scored from the position it leads to
    const before = toCp(me.score[i]);
    const after = best ? before : me.secondMove[i] === uci ? toCp(me.second[i]) : -toCp(me.score[i + 1]);
    const wb = winP(before), wa = winP(after), loss = Math.max(0, wb - wa);
    // accuracy of the move, 0 to 100, from the drop in winning chances (the formula Lichess publishes)
    me.acc[i] = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss * 100) - 3.1669));
    me.loss[i] = loss;
    let c;
    if (inBook && (me.path[i] != null || BOOK.has(fen4(me.fens[i]) + '|' + m.san))) c = 'book';
    else {
      inBook = false;
      // great: the only good move, when it isn't an obvious one (taking back, getting out of check,
      // saving an attacked piece, or simply winning material that can't be taken back)
      const pos = new Chess(me.fens[i]), them = m.color === 'w' ? 'b' : 'w';
      const freeTake = m.captured && (VAL[m.captured] >= VAL[m.piece] || !new Chess(me.fens[i + 1]).moves({ verbose: true }).some(r => r.to === m.to));
      const obvious = (i > 0 && me.hist[i - 1].captured && me.hist[i - 1].to === m.to) || pos.inCheck() || pos.isAttacked(m.from, them) || freeTake;
      const only = me.second[i] && wb - winP(toCp(me.second[i])) >= 0.2;
      // brilliant: a sound sacrifice, in a game you weren't already winning easily without it
      const without = winP(best && me.second[i] ? toCp(me.second[i]) : before);
      if ((best || loss <= 0.02) && wa >= 0.5 && without < 0.97 && sacrifice(me.fens[i + 1], m.captured ? VAL[m.captured] : 0)) c = 'brilliant';
      else if (best && only && !obvious && wa >= 0.25 && wb < 0.97) c = 'great';
      else if (best) c = 'best';
      else if (loss <= 0.02) c = 'excellent';
      else if (loss <= 0.05) c = 'good';
      else if (loss <= 0.1) c = 'inaccuracy';
      else if (i > 0 && me.loss[i - 1] >= 0.15 && wb >= 0.7 && loss >= 0.12) c = 'miss';   // the other side had just slipped badly, and this let it go
      else if (loss <= 0.2) c = 'mistake';
      else c = 'blunder';
    }
    me.cls[i] = c;
  });
}
// a side's accuracy for the game: the average of its move accuracies, pulled down by its worst moves
function rvAccuracy(me, col) {
  const a = me.hist.map((m, i) => (m.color === col ? me.acc[i] : null)).filter(x => x != null);
  if (!a.length) return null;
  const mean = a.reduce((s, x) => s + x, 0) / a.length, harm = a.length / a.reduce((s, x) => s + 1 / Math.max(1, x), 0);
  return (mean + harm) / 2;
}
// who was winning through the game: the light area is White's share of the winning chances, move by move
function rvGraph(me) {
  const n = me.fens.length - 1, W = 300, H = 64;
  const wp = i => winP((me.fens[i].split(' ')[1] === 'w' ? 1 : -1) * toCp(me.score[i]));
  const x = i => (i / n) * W, y = i => (1 - wp(i)) * H;
  const path = `M0,${H} ` + me.fens.map((_, i) => `L${x(i).toFixed(1)},${y(i).toFixed(1)}`).join(' ') + ` L${W},${H} Z`;
  const dots = me.hist.map((m, i) => (m.color === me.side && ['mistake', 'miss', 'blunder'].includes(me.cls[i])
    ? `<em class="c-${me.cls[i]}" style="left:${((i + 1) / n * 100).toFixed(2)}%;top:${(y(i + 1) / H * 100).toFixed(2)}%"></em>` : '')).join('');
  return `<div class="graph" data-act="rv-graph" role="img" aria-label="Who was ahead through the game. Tap to jump to a move.">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path class="wh" d="${path}"/><line class="mid" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"/></svg>${dots}<i id="rvcur"></i></div>`;
}
function rvSummary(me) {
  const other = me.side === 'w' ? 'b' : 'w', from = startPly(me.start);
  const count = (c, col) => me.hist.filter((m, i) => m.color === col && me.cls[i] === c).length;
  const fmt = a => (a == null ? '–' : a.toFixed(1));
  const rows = Object.keys(CLS).map(c => {
    const a = count(c, me.side), b = count(c, other);
    return `<div class="crow${a ? '' : ' none'}"${a ? ` role="button" tabindex="0" data-act="rv-cls" data-id="${c}" aria-label="${CLS[c].name}: ${a}. Show your ${CLS[c].name.toLowerCase()} moves"` : ''}>${mark(c)}<span class="cn">${CLS[c].name}</span><b>${a}</b><b>${b}</b></div>`;
  }).join('');
  const look = me.hist.map((m, i) => i).filter(i => me.hist[i].color === me.side && ['mistake', 'miss', 'blunder'].includes(me.cls[i]));
  const book = me.start === START ? bookText(bookCheck(me.sans, me.side)) : '';
  const opening = me.path.filter(Boolean).pop();
  $('#rvsum').innerHTML = `
    ${opening ? `<p class="opening">${opening}</p>` : ''}
    ${rvGraph(me)}
    <div class="accs"><div><b>${fmt(rvAccuracy(me, me.side))}</b><span>Your accuracy</span></div><div><b>${fmt(rvAccuracy(me, other))}</b><span>${me.bot.name}’s accuracy</span></div></div>
    <div class="ctab"><div class="chead"><span></span><span></span><span>You</span><span>${me.bot.name}</span></div>${rows}</div>
    ${book ? `<p class="book">${book}</p>` : ''}
    ${look.length ? `<h3 class="h3">Moves to look at</h3><div class="group flush">${look.map(i => `<div class="brow" role="button" tabindex="0" data-act="rv-go" data-k="${i + 1}"><span class="nota">${moveLabel(from + i, me.sans[i])} ${mark(me.cls[i])}</span><span class="bn">${CLS[me.cls[i]].name}. Better: ${rvSan(me, i)}</span>${icon('next', 'chev')}</div>`).join('')}</div>`
      : '<p class="book">No mistakes, misses or blunders. Clean game.</p>'}`;
}
// jump to your next move of one kind (the rows of the summary table)
function rvJump(c) {
  const me = RV;
  if (!me || !me.done) return;
  const idx = me.hist.map((m, i) => i).filter(i => me.hist[i].color === me.side && me.cls[i] === c);
  const next = idx.find(i => i + 1 > me.k) ?? idx[0];
  if (next == null) return;
  me.k = next + 1;
  rvShow();
  window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
}
function rvSan(me, i) {
  const u = me.best[i];
  if (!u) return '';
  const g = new Chess(me.fens[i]), m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' });
  return moveLabel(startPly(me.start) + i, m.san);
}
function evalText(cp, them = 'The computer') {
  if (Math.abs(cp) >= 10000) return cp > 0 ? 'You have a forced mate.' : `${them} has a forced mate.`;
  if (Math.abs(cp) < 50) return 'The position is about equal.';
  return `${cp > 0 ? 'You are' : `${them} is`} ahead by about ${(Math.abs(cp) / 100).toFixed(1)} pawns.`;
}
function rvShow() {
  const me = RV, k = me.k, i = k - 1, c = me.done && i >= 0 ? me.cls[i] : null, from = startPly(me.start);
  strip($('#mv'), me.sans.map((s, j) => s + (me.done ? mark(me.cls[j]) : '')), k, 'rv-go', from);
  const cur = $('#rvcur');
  if (cur) cur.style.left = ((k / (me.fens.length - 1)) * 100).toFixed(2) + '%';
  const m = me.hist[i], mine = m && m.color === me.side, who = mine ? 'Your move.' : `${me.bot.name}’s move.`;
  if (c && SLIPS.has(c) && me.best[i]) {
    // show the position before the slip, with the better move
    me.board.set(new Chess(me.fens[i]), { flip: me.side === 'b', last: me.vm[i - 1] || null, arrow: { from: me.best[i].slice(0, 2), to: me.best[i].slice(2, 4) } });
    const missed = c === 'miss' ? (mine ? ` ${me.bot.name} had just slipped, and this let them off the hook.` : ' You had just slipped, and this let you off the hook.') : '';
    coach(CLS[c].kind, `${moveLabel(from + i, me.sans[i])} is ${CLS[c].say}`, `${who}${missed} Better was ${rvSan(me, i)}, shown by the arrow.`);
    return;
  }
  me.board.set(new Chess(me.fens[k]), { flip: me.side === 'b', last: me.vm[i] || null, badge: c ? { sq: m.to, html: mark(c) } : null });
  if (k === 0) { coach('info', 'Start of the game', me.done ? 'Step through the moves, or tap a move to look at.' : 'The computer is analysing your game.'); return; }
  if (!me.done) { coach('info', moveLabel(from + i, me.sans[i]), 'Analysis in progress…'); return; }
  const cp = (new Chess(me.fens[k]).turn() === me.side ? 1 : -1) * toCp(me.score[k]);
  const ln = c === 'book' ? BOOK.get(fen4(me.fens[i]) + '|' + me.sans[i]) : null;
  const why = {
    brilliant: 'A strong sacrifice.',
    great: 'The only good move in the position.',
    excellent: `The best move was ${rvSan(me, i)}.`,
    good: `The best move was ${rvSan(me, i)}.`,
    book: `A known opening move${me.path[i] ? `: ${me.path[i]}` : ''}.${ln ? ` It’s in your ${ln.op.name} lines.` : ''}`,
  }[c] || '';
  coach(CLS[c].kind, `${moveLabel(from + i, me.sans[i])} is ${CLS[c].say}`, `${who} ${why ? why + ' ' : ''}${evalText(cp, me.bot.name)}`);
}
function gBack() {
  const b = G && G.back;
  G = null;
  RV = null;
  if (b && b.line) return lineView(b.line[0], b.line[1], b.line[2]);
  openTab(b && b.tab ? b.tab : 'train', true);
}

/* ================= taps ================= */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  audio();
  const a = b.dataset.act, id = b.dataset.id, li = b.dataset.li != null ? +b.dataset.li : 0;
  switch (a) {
    case 'tab':
      // tapping the tab you are on goes back to the top, like any phone app
      if (b.classList.contains('tab') && id === tab) window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
      else openTab(id, true);
      break;
    case 'side': sideTab = id; openingsTab(); break;
    case 'open': openingView(id); break;
    case 'line': lineView(id, li); break;
    case 'study': {
      closeSheet();
      const inRun = !!(R && R.tasks.length > 1);
      if (!inRun) R = null;
      lineView(id, li, 0, false, inRun);
      break;
    }
    case 'resume': if (R) nextTask(); break;
    // tactics
    case 'pz-mix': puzzleRun(pzSession(), 'Puzzles', { tab }, true); break;
    case 'tactic': themeView(id); break;
    case 'theme-demo': themeDemo(); break;
    case 'theme-go': puzzleRun(themeList(id), THEME[id].name, { theme: id }); break;
    case 'pz-next': nextPuzzle(); break;
    case 'pz-hint': pzHint(); break;
    case 'pz-show': pzShow(); break;
    case 'pz-more': { const b = P && P.back; if (!b) break; if (b.theme) puzzleRun(themeList(b.theme), THEME[b.theme].name, b); else puzzleRun(pzSession(), 'Puzzles', b, true); break; }
    case 'pz-quit': pzBack(); break;
    // endgames
    case 'eg': egView(id); break;
    case 'eg-play': closeSheet(); egStart(id, li); break;
    case 'eg-watch': egStart(id, li, true); break;
    case 'eg-hint': egHint(); break;
    case 'eg-undo': egUndo(); break;
    case 'eg-restart': if (E) egStart(E.l.id, E.idx); break;
    case 'eg-quit': closeSheet(); egView(id || (E && E.l.id)); break;
    // play the computer
    case 'play': playAsk(START, 'w', { tab }); break;
    case 'play-here': if (V) playAsk(V.ln.fens[V.k], V.op.side, { line: [V.op.id, V.ln.i, V.k] }); break;
    case 'bot': S.bot = +id; save(); playSync(); break;
    case 'g-mode': S.rated = id === 'rated'; save(); playSync(); break;
    case 'tc': S.tc = +id; save(); playSync(); break;
    case 'bot-side': if (pend) pend.side = id; choose(b); break;
    case 'g-start': if (pend) playStart(); break;
    case 'g-resume': if (S.live) playStart(S.live); else closeSheet(); break;
    case 'g-new': {
      const L = S.live;
      if (L && L.rated && BOTS[L.bi]) { S.games.l++; gRate({ bi: L.bi, bot: BOTS[L.bi] }, 'l'); toast('Your rated game was counted as a loss'); }
      S.live = null; save();
      if (shownTab) { openTab(tab, true); app.classList.remove('enter'); }   // the tab underneath no longer has a game in progress
      if (pend) playSheet(pend.fen, pend.side, pend.back);
      break;
    }
    case 'g-again': if (pend) playStart(); break;
    case 'g-undo': gUndo(); break;
    case 'g-hint': gHint(); break;
    case 'g-resign':
      if (G && !G.over) sheet(`<div class="res"><h2>Resign this game?</h2><p class="note">${G.rated ? 'It counts as a loss and lowers your rating.' : 'It counts as a loss.'}</p>
        <div class="actions"><button class="btn" data-act="sheet-close">Keep playing</button><button class="btn danger-btn" data-act="g-resign-yes">Resign</button></div></div>`, true);
      break;
    case 'g-resign-yes': closeSheet(); if (G && !G.over) gEnd('l', 'You resigned.'); break;
    case 'g-anyway': closeSheet(); if (G && G.pending) { G.pending = null; G.movedAt = Date.now(); clkStop(G); clkAdd(G, G.side); gTurn(); } break;
    case 'g-rethink': closeSheet(); if (G && G.pending) gRethink(); break;
    case 'g-prev': if (G) gGo((G.view ?? G.g.history().length) - 1); break;
    case 'g-next': if (G && G.view != null) gGo(G.view + 1); break;
    case 'g-view': if (G) gGo(+b.dataset.k); break;
    case 'g-live': if (G) gGo(Infinity); break;
    case 'g-quit':
      // leaving a rated game you have started counts as a loss, so ask first
      if (G && G.rated && !G.over && !RV && G.g.history({ verbose: true }).some(m => m.color === G.side)) {
        sheet(`<div class="res"><h2>Leave this game?</h2><p class="note">It’s a rated game, so leaving counts as a loss.</p>
          <div class="actions"><button class="btn" data-act="sheet-close">Keep playing</button><button class="btn danger-btn" data-act="g-leave">Leave</button></div></div>`, true);
        break;
      }
      // a casual game stays saved, clocks and all, so you can pick it up again later
      if (G && !G.over && !G.pending && S.live) { clkStop(G); gSave(G); }
      closeSheet(); gBack(); break;
    case 'g-leave': closeSheet(); if (G && !G.over) gEnd('l', 'You left the game.'); gBack(); break;
    case 'g-review': if (G && G.g.history().length) reviewStart(); else toast('No moves to review yet'); break;
    case 'rv-go': if (RV) { RV.k = Math.max(0, Math.min(RV.fens.length - 1, +b.dataset.k)); rvShow(); } break;
    case 'rv-step': if (RV) { RV.k = Math.max(0, Math.min(RV.fens.length - 1, RV.k + +b.dataset.k)); rvShow(); } break;
    case 'rv-cls': rvJump(id); break;
    case 'rv-graph': if (RV) { const r = b.getBoundingClientRect(); RV.k = Math.max(0, Math.min(RV.fens.length - 1, Math.round(((e.clientX - r.left) / r.width) * (RV.fens.length - 1)))); rvShow(); } break;
    case 'session': run('session', sessionTasks(), { tab: 'train' }); break;
    case 'learn': run('learn', [{ kind: 'learn', ln: byId[id].lines[li] }], app.classList.contains('has-tabs') ? { tab } : { op: id }); break;
    case 'practice': run('practice', practiceTasks(byId[id]), { op: id }); break;
    case 'practice-line': { const ln = byId[id].lines[li]; run('practice', [{ kind: isDue(ln) ? 'review' : 'practice', ln }], { op: id }); break; }
    case 'test': run('test', testTasks(), { tab }); break;
    case 'weak': run('weak', weakTasks(), { tab: tab === 'progress' ? 'progress' : 'train' }); break;
    case 'next-task': closeSheet(); nextTask(); break;
    case 'finish': closeSheet(); summary(); break;
    case 'done': closeSheet(); goBack(); break;
    case 'quit': goBack(); break;
    case 'hint': hint(); break;
    case 'reveal': reveal(); break;
    case 'restart': restart(); break;
    case 'v-flip': V.flip = !V.flip; studyShow(false); break;
    case 'v-next': if (V.k < V.ln.moves.length) { V.k++; sfx.move(V.ln.vm[V.k - 1]); studyShow(true); } break;
    case 'v-prev': if (V.k > 0) { V.k--; studyShow(false); } break;
    case 'v-first': V.k = 0; studyShow(false); break;
    case 'v-last': V.k = V.ln.moves.length; studyShow(false); break;
    case 'v-jump': V.k = +b.dataset.k; studyShow(false); break;
    case 'v-alt': sfx.move(V.op.lines[li].vm[V.k]); lineView(V.op.id, li, V.k + 1, true); break;
    case 'sound': S.sound = !S.sound; save(); flipSwitch(b, S.sound); break;
    case 'warn': S.warn = !S.warn; save(); flipSwitch(b, S.warn); break;
    case 'theme': S.theme = id; save(); applyTheme(); choose(b); break;
    case 'perday': S.perDay = +id; save(); choose(b); break;
    case 'reset':
      sheet(`<div class="res"><h2>Reset all progress?</h2><p class="note">This clears every learned line, review date, weak move, XP and your streak on this phone. It can't be undone.</p>
        <div class="actions"><button class="btn" data-act="sheet-close">Cancel</button><button class="btn danger-btn" data-act="reset-yes">Reset</button></div></div>`, true);
      break;
    case 'reset-yes':
      Object.assign(S, FRESH());
      save(); closeSheet(); toast('Progress reset'); progressTab();
      break;
    case 'sheet-close': closeSheet(); break;
    case 'backup': {
      const code = 'GAMBIT1:' + btoa(unescape(encodeURIComponent(JSON.stringify(S))));
      sheet(`<div class="res"><h2>Back up progress</h2><p class="note">Copy this code and keep it somewhere safe, like your Notes app. Paste it into Restore on any phone to get your progress back.</p>
        <textarea class="code" readonly aria-label="Backup code">${code}</textarea>
        <div class="actions"><button class="btn" data-act="sheet-close">Close</button><button class="btn go" data-act="copy-code">Copy code</button></div></div>`, true);
      break;
    }
    case 'copy-code': {
      const ta = $('.code');
      const fallback = () => { ta.focus(); ta.select(); toast('Select the code and copy it'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(() => toast('Backup code copied'), fallback);
      else fallback();
      break;
    }
    case 'restore':
      sheet(`<div class="res"><h2>Restore progress</h2><p class="note">Paste a backup code. It replaces the progress on this phone.</p>
        <textarea class="code" id="rc" placeholder="GAMBIT1:…" aria-label="Backup code" autocapitalize="off" autocomplete="off" spellcheck="false"></textarea>
        <div class="actions"><button class="btn" data-act="sheet-close">Cancel</button><button class="btn go" data-act="restore-yes">Restore</button></div></div>`, true, true);
      break;
    case 'restore-yes':
      try {
        const raw = $('#rc').value.trim();
        if (!raw.startsWith('GAMBIT1:')) throw new Error();
        const data = JSON.parse(decodeURIComponent(escape(atob(raw.slice(8)))));
        if (!data || typeof data.lines !== 'object') throw new Error();
        Object.assign(S, FRESH(), data);
        save(); applyTheme(); closeSheet(); toast('Progress restored'); progressTab();
      } catch { toast('That code is not a valid backup'); }
      break;
    case 'intro': intro(); break;
    case 'intro-ok': S.intro = 1; save(); closeSheet(); break;
  }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"]')) { e.preventDefault(); e.target.click(); }
  // arrow keys step through moves on any screen with move arrows
  if (e.key === 'Escape') { const sc = $('.sheet-wrap:not(.out) .scrim[data-act]'); if (sc) closeSheet(); }
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !sheetOpen()) {
    const b = $(`.dock [aria-label="${e.key === 'ArrowLeft' ? 'Previous' : 'Next'} move"]`);
    if (b && !b.disabled) { e.preventDefault(); b.click(); }
  }
});

applyTheme();
openTab('train');
if (!S.intro) intro();
