// Gambit — personal chess openings trainer
import { Chess } from './chess.js';
import { OPENINGS } from './openings.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const DAY = 864e5;
const IV = [0, 1, 3, 7, 14, 30]; // review interval in days, by perfect-streak
const LABEL = { new: 'New', learning: 'Learning', review: 'Review', learned: 'Learned', mastered: 'Mastered' };

/* ---------------- opening data ---------------- */
const COMMENTS = new Map(); // "position|move" -> explanation
const byId = {};
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
  op.lines.forEach((ln, i) => {
    Object.assign(ln, { op, i, id: op.id + ':' + slug(ln.name), moves: [], vm: [] });
    const g = new Chess();
    ln.fens = [g.fen()];
    for (const t of parsePgn(ln.pgn)) {
      const before = fen4(g.fen()), m = g.move(t.san);
      ln.moves.push(m.san);
      ln.vm.push({ from: m.from, to: m.to, captured: m.captured });
      ln.fens.push(g.fen());
      const key = before + '|' + m.san;
      if (t.c && !COMMENTS.has(key)) COMMENTS.set(key, t.c);
    }
  });
}

const commentAt = (ln, k) => (k > 0 ? COMMENTS.get(fen4(ln.fens[k - 1]) + '|' + ln.moves[k - 1]) : null);
const moveLabel = (k, san) => `${(k >> 1) + 1}.${k & 1 ? '..' : ''}${san}`;
const movesText = (moves, from = 0) =>
  moves.map((s, i) => { const k = from + i; return k & 1 ? (i ? s : `${(k + 1) >> 1}...${s}`) : `${(k >> 1) + 1}.${s}`; }).join(' ');

// every book move at ply k among lines that share this line's first k moves
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
const findMove = (g, from, to) =>
  g.moves({ square: from, verbose: true }).find(m => m.to === to && (!m.promotion || m.promotion === 'q'));

/* ---------------- progress (saved on this phone) ---------------- */
const KEY = 'gambit.v1';
const S = { lines: {}, xp: 0, day: null, streak: 0, sound: true, sides: {} };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
const dayStr = t => new Date(t).toLocaleDateString('en-CA');
const streakNow = () => (S.day === dayStr(Date.now()) || S.day === dayStr(Date.now() - DAY) ? S.streak : 0);
function bumpDay() {
  const t = dayStr(Date.now());
  if (S.day === t) return;
  S.streak = S.day === dayStr(Date.now() - DAY) ? S.streak + 1 : 1;
  S.day = t;
}
const rec = ln => S.lines[ln.id];
function status(ln) {
  const r = rec(ln);
  if (!r) return 'new';
  if (!r.streak) return 'learning';
  if (r.due <= Date.now()) return 'review';
  return r.streak >= 3 ? 'mastered' : 'learned';
}
function record(ln, perfect) {
  const r = S.lines[ln.id] || { streak: 0, due: 0, seen: 0 };
  r.seen++;
  if (perfect) { r.streak++; r.due = Date.now() + IV[Math.min(r.streak, 5)] * DAY - 3 * 36e5; }
  else { r.streak = 0; r.due = Date.now(); }
  S.lines[ln.id] = r;
  S.xp += perfect ? 10 : 3;
  bumpDay();
  save();
}
const allLines = () => OPENINGS.flatMap(o => o.lines);
const dueLines = () => allLines().filter(l => { const r = rec(l); return r && r.due <= Date.now(); });
const nextNew = () => allLines().find(l => !rec(l));
const drillSide = op => S.sides[op.id] || op.side;
function prog(op) {
  let pts = 0, n = 0;
  for (const l of op.lines) { const r = rec(l); if (r && r.streak) { n++; pts += Math.min(r.streak, 3); } }
  return { n, pct: Math.round((100 * pts) / (3 * op.lines.length)) };
}

/* ---------------- sound ---------------- */
let AC = null;
function audio() {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
  } catch {}
}
function tone(f, d, type = 'sine', v = 0.12, at = 0) {
  const a = S.sound && AC; if (!a) return;
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(1e-4, t + d);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + 0.05);
}
function knock(f, v) {
  const a = S.sound && AC; if (!a) return;
  const n = Math.floor(a.sampleRate * 0.07), b = a.createBuffer(1, n, a.sampleRate), x = b.getChannelData(0);
  for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 5;
  const s = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
  s.buffer = b; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 1.4; g.gain.value = v;
  s.connect(bp).connect(g).connect(a.destination); s.start();
}
const sfx = {
  move: m => (m && m.captured ? (knock(650, 1.8), knock(1400, 0.9)) : knock(1150, 1.5)),
  bad: () => tone(150, 0.22, 'square', 0.05),
  done: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.09, i * 0.08))
};

/* ---------------- board ---------------- */
const FILES = 'abcdefgh';
class Board {
  constructor(el, { mini = false, onMove = null } = {}) {
    Object.assign(this, { el, mini, onMove, flip: false, g: null, last: null, sel: null, targets: [], hintSq: null, arrow: null, interactive: false, side: null, drag: null });
    el.classList.add('board');
    if (mini) el.classList.add('mini'); else this.bind();
  }
  set(g, { flip = this.flip, last = null } = {}) {
    Object.assign(this, { g, flip, last, sel: null, targets: [], hintSq: null, arrow: null });
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
      if (!this.mini) {
        if (c === 0) inner += `<b class="rk">${sq[1]}</b>`;
        if (r === 7) inner += `<b class="fl">${sq[0]}</b>`;
      }
      h += `<div class="${cls}">${inner}</div>`;
    }
    if (this.arrow) h += this.arrowSvg(this.arrow);
    this.el.innerHTML = h;
  }
  arrowSvg({ from, to }) {
    const a = this.pos(from), b = this.pos(to), f = n => n.toFixed(3);
    const x1 = a.c + 0.5, y1 = a.r + 0.5, x2 = b.c + 0.5, y2 = b.r + 0.5;
    const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, px = -uy, py = ux;
    const tx = x2 - ux * 0.12, ty = y2 - uy * 0.12, bx = tx - ux * 0.42, by = ty - uy * 0.42;
    return `<svg class="arrow" viewBox="0 0 8 8"><line x1="${f(x1 + ux * 0.2)}" y1="${f(y1 + uy * 0.2)}" x2="${f(bx)}" y2="${f(by)}"/><polygon points="${f(tx)},${f(ty)} ${f(bx + px * 0.26)},${f(by + py * 0.26)} ${f(bx - px * 0.26)},${f(by - py * 0.26)}"/></svg>`;
  }
  animate(from, to) {
    const cell = this.cell(to), el = cell && cell.querySelector('.pc');
    if (!el) return;
    const a = this.pos(from), b = this.pos(to), s = this.el.clientWidth / 8;
    cell.style.zIndex = 4;
    el.style.transition = 'none';
    el.style.transform = `translate(${(a.c - b.c) * s}px,${(a.r - b.r) * s}px)`;
    el.getBoundingClientRect();
    el.style.transition = 'transform .18s ease-out';
    el.style.transform = '';
  }
  flash(sq, cls, ms = 500) { const c = this.cell(sq); if (!c) return; c.classList.add(cls); setTimeout(() => c.classList.remove(cls), ms); }
  shake() { const e = this.el; e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); setTimeout(() => e.classList.remove('shake'), 350); }
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
      if (!this.interactive || !this.g || e.button > 0) return;
      const sq = this.at(e); if (!sq) return;
      if (this.sel && this.targets.includes(sq)) { const from = this.sel; this.clear(false); this.onMove && this.onMove(from, sq, true); return; }
      const p = this.g.get(sq);
      if (p && p.color === this.g.turn() && (!this.side || p.color === this.side)) {
        const was = this.sel === sq;
        this.pick(sq);
        this.drag = { from: sq, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, was };
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
          d.s = (el.clientWidth / 8) * 1.15;
          d.gh = document.createElement('i');
          d.gh.className = src.className + ' ghost';
          d.gh.style.width = d.gh.style.height = d.s + 'px';
          document.body.appendChild(d.gh);
        }
      }
      if (d.gh) d.gh.style.transform = `translate(${e.clientX - d.s / 2}px,${e.clientY - d.s / 2}px)`;
    });
    const end = e => {
      const d = this.drag; if (!d || e.pointerId !== d.id) return;
      this.drag = null;
      if (d.gh) d.gh.remove();
      if (d.src) d.src.style.opacity = '';
      if (!d.moved) { if (d.was) this.clear(); return; }
      const sq = e.type === 'pointercancel' ? null : this.at(e);
      if (sq && sq !== d.from && this.targets.includes(sq)) { this.clear(false); this.onMove && this.onMove(d.from, sq, false); }
      else if (sq !== d.from) this.clear();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}
const miniBoard = (el, op) => {
  const ln = op.lines[0];
  new Board(el, { mini: true }).set(new Chess(ln.fens[op.start]), { flip: op.side === 'b', last: ln.vm[op.start - 1] });
};

/* ---------------- shared UI bits ---------------- */
let timers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const stopTimers = () => { timers.forEach(clearTimeout); timers = []; };
let toastT;
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 1800); }
const say = (t, kind) => { const e = $('#st'); if (e) { e.textContent = t; e.className = 'status ' + kind; } };
const bar = (title, back, id = '', extra = '') =>
  `<header class="bar"><button class="icon" data-act="${back}" data-id="${id}" aria-label="Back">‹</button><h1>${title}</h1>${extra || '<span class="sp"></span>'}</header>`;

/* ---------------- home ---------------- */
function card(op) {
  const p = prog(op), due = op.lines.filter(l => status(l) === 'review').length;
  return `<div class="ocard" role="button" tabindex="0" data-act="open" data-id="${op.id}">
    <div class="ocb" data-mini="${op.id}"></div>
    <div class="oc"><b>${op.name}</b><small class="mono">${movesText(op.lines[0].moves.slice(0, op.start))}</small>
    <div class="meter"><i style="width:${p.pct}%"></i></div>
    <small class="muted">${p.n}/${op.lines.length} lines learned${due ? ` · <span class="due">${due} to review</span>` : ''}</small></div></div>`;
}
const section = (title, side) => `<h3 class="sec">${title}</h3><div class="list">${OPENINGS.filter(o => o.side === side).map(card).join('')}</div>`;

function home() {
  stopTimers();
  const due = dueLines().length, nn = nextNew();
  app.innerHTML = `
  <header class="top">
    <div class="brand"><i class="pc wN"></i><span>Gambit</span></div>
    <div class="stats"><span class="stat" title="Day streak">🔥 ${streakNow()}</span><span class="stat" title="XP">⚡ ${S.xp}</span>
    <button class="icon" data-act="sound" aria-label="Sound on/off">${S.sound ? '🔊' : '🔇'}</button></div>
  </header>
  <section class="hero">
    <div><h2>${due ? 'Daily review' : nn ? 'Learn a new line' : 'All caught up'}</h2>
    <p>${due ? `${due} line${due > 1 ? 's' : ''} ready — keep them fresh.` : nn ? `${nn.op.name} · ${nn.name}` : 'Every line is learned. Come back tomorrow.'}</p></div>
    ${due ? '<button class="btn primary" data-act="review">Start</button>' : nn ? `<button class="btn primary" data-act="learn" data-id="${nn.op.id}" data-li="${nn.i}">Start</button>` : ''}
  </section>
  ${section('Play as White', 'w')}${section('Play as Black', 'b')}
  <h3 class="sec">Coming next</h3>
  <div class="soon"><span>⚔️</span><div><b>Middlegame tactics</b><p>Forks, pins, skewers and mating patterns — puzzles that train your eye.</p></div></div>
  <div class="soon"><span>👑</span><div><b>Endgames</b><p>Basic mates, king &amp; pawn and rook endings — the technique to convert a win.</p></div></div>`;
  app.querySelectorAll('[data-mini]').forEach(el => miniBoard(el, byId[el.dataset.mini]));
}

/* ---------------- opening page ---------------- */
function branchText(ln) {
  const base = ln.op.lines[0];
  let k = 0;
  if (ln === base) k = ln.op.start;
  else while (k < ln.moves.length && ln.moves[k] === base.moves[k]) k++;
  return movesText(ln.moves.slice(k, k + 6), k) + (ln.moves.length > k + 6 ? ' …' : '');
}
function openView(id) {
  stopTimers();
  const op = byId[id], side = drillSide(op);
  app.innerHTML = `
  ${bar(op.name, 'home')}
  <div class="ophero"><div class="opb" id="opb"></div>
    <div><p class="mono">${movesText(op.lines[0].moves.slice(0, op.start))}</p><p>${op.about}</p><p class="muted small">Played by ${op.players}</p></div></div>
  <div class="card"><h3>Key ideas</h3><ul>${op.ideas.map(i => `<li>${i}</li>`).join('')}</ul></div>
  <div class="row2"><button class="btn" data-act="learn" data-id="${id}" data-li="0">📖 Learn</button><button class="btn primary" data-act="drill" data-id="${id}">🎯 Drill</button></div>
  <p class="center small muted">You drill as <button class="link" data-act="side" data-id="${id}">${side === 'w' ? 'White' : 'Black'} ⇄</button></p>
  <h3 class="sec">${op.lines.length} lines · tap one to study it</h3>
  <div class="list">${op.lines.map(ln => { const st = status(ln); return `<div class="lrow" role="button" tabindex="0" data-act="learn" data-id="${id}" data-li="${ln.i}"><div><b>${ln.name}</b><small class="mono">${branchText(ln)}</small></div><span class="tag ${st}">${LABEL[st]}</span></div>`; }).join('')}</div>`;
  miniBoard($('#opb'), op);
}

/* ---------------- learn mode ---------------- */
let L = null;
function learnView(id, li, k = 0, anim = false) {
  stopTimers();
  const op = byId[id], ln = op.lines[li];
  const flip = L && L.op === op ? L.flip : drillSide(op) === 'b';
  app.innerHTML = `
  ${bar(op.name, 'open', id, '<button class="icon" data-act="flip" aria-label="Flip board">⇅</button>')}
  <p class="lname">${ln.name}</p>
  <div class="bwrap"><div id="bd"></div></div>
  <div class="ctrl"><button class="icon" data-act="l-first" aria-label="Start">⏮</button><button class="icon" data-act="l-prev" aria-label="Back">◀</button><button class="icon big" data-act="l-next" aria-label="Next move">▶</button><button class="icon" data-act="l-last" aria-label="End">⏭</button></div>
  <div class="note" id="note"></div>
  <div id="alts"></div>
  <div class="moves" id="mv"></div>
  <button class="btn primary wide" data-act="drill-line" data-id="${id}" data-li="${li}">🎯 Drill this line</button>`;
  L = { op, ln, k, flip, board: new Board($('#bd'), { onMove: learnMove }) };
  L.board.interactive = true;
  learnShow(anim);
}
function learnShow(anim) {
  const { ln, k, board } = L, last = ln.vm[k - 1];
  board.set(new Chess(ln.fens[k]), { flip: L.flip, last });
  if (anim && last) board.animate(last.from, last.to);
  let h;
  if (k === 0) h = `<b>${ln.name}</b><p>${L.op.about}</p><p class="muted small">Tap ▶ — or play the moves yourself on the board.</p>`;
  else { const c = commentAt(ln, k); h = `<b>${moveLabel(k - 1, ln.moves[k - 1])}</b>${c ? `<p>${c}</p>` : ''}`; }
  if (k === ln.moves.length) h += '<p class="ok">✓ End of the line — now drill it to lock it in.</p>';
  $('#note').innerHTML = h;
  const br = branches(ln, k);
  br.delete(ln.moves[k]);
  const mine = (k & 1 ? 'b' : 'w') === drillSide(L.op);
  $('#alts').innerHTML = br.size
    ? `<p class="small muted">${mine ? 'You can also play' : `What if ${k & 1 ? 'Black' : 'White'} plays…`}</p>` +
      [...br].map(([s, ls]) => `<button class="chip" data-act="l-alt" data-li="${ls[0].i}">${moveLabel(k, s)}<small>${ls[0].name}</small></button>`).join('')
    : '';
  $('#mv').innerHTML = ln.moves.map((s, i) => (i & 1 ? '' : `<span class="no">${(i >> 1) + 1}.</span>`) + `<button class="m${i === k - 1 ? ' cur' : ''}" data-act="l-jump" data-k="${i + 1}">${s}</button>`).join('');
}
function learnMove(from, to, anim) {
  const { ln, k } = L, m = findMove(new Chess(ln.fens[k]), from, to);
  if (!m) { L.board.render(); return; }
  const br = branches(ln, k);
  if (!br.has(m.san)) {
    L.board.render(); L.board.flash(to, 'bad'); sfx.bad();
    toast(k >= ln.moves.length ? 'That is the end of this line' : 'Not the book move here — tap ▶ to see it');
    return;
  }
  const ls = br.get(m.san), nl = ls.includes(ln) ? ln : ls[0];
  sfx.move(m);
  if (nl !== ln) return learnView(L.op.id, nl.i, k + 1, anim);
  L.k = k + 1;
  learnShow(anim);
}

/* ---------------- drill mode ---------------- */
let D = null;
function pickLine(pool, avoid) {
  const now = Date.now(), cand = pool.length > 1 ? pool.filter(l => l !== avoid) : pool;
  const score = l => { const r = rec(l); if (!r) return 1e3 + pool.indexOf(l); if (r.due <= now) return r.due / 1e13; return 1e4 + (r.due - now) / DAY; };
  return cand.reduce((a, b) => (score(b) < score(a) ? b : a));
}
function startDrill(mode, opId, li) {
  stopTimers();
  const pool = mode === 'review' ? dueLines() : byId[opId].lines;
  if (!pool.length) return home();
  const ln = li != null ? byId[opId].lines[li] : pickLine(pool, D && D.ln);
  D = { mode, opId: ln.op.id, ln, side: drillSide(ln.op), g: new Chess(), k: 0, perfect: true, miss: 0 };
  app.innerHTML = `
  ${bar(mode === 'review' ? 'Daily review' : 'Drill', mode === 'review' ? 'home' : 'open', ln.op.id, `<span class="pill">${ln.op.name}</span>`)}
  <div class="status" id="st"></div>
  <div class="bwrap"><div id="bd"></div></div>
  <div class="ctrl3"><button class="btn" data-act="d-hint">💡 Hint</button><button class="btn" data-act="d-show">👁 Show</button><button class="btn" data-act="d-restart">↺ Restart</button></div>
  <div class="note" id="note"><p class="muted">You play ${D.side === 'w' ? 'White' : 'Black'}. Play the book moves — the app answers with the replies it knows, so over time you get tested on all of them.</p></div>
  <div id="ov"></div>`;
  D.board = new Board($('#bd'), { onMove: drillMove });
  D.board.side = D.side;
  D.board.set(D.g, { flip: D.side === 'b' });
  drillStep();
}
function dnote() {
  const c = commentAt(D.ln, D.k);
  $('#note').innerHTML = `<b>${moveLabel(D.k - 1, D.ln.moves[D.k - 1])}</b>${c ? `<p>${c}</p>` : ''}`;
}
function drillStep() {
  const d = D;
  if (d.k >= d.ln.moves.length) return drillDone();
  if (d.g.turn() === d.side) { d.board.interactive = true; say('Your move', 'you'); return; }
  d.board.interactive = false;
  say(`${d.g.turn() === 'w' ? 'White' : 'Black'} is moving…`, 'them');
  later(() => {
    if (D !== d) return;
    const m = d.g.move(d.ln.moves[d.k]);
    d.k++;
    d.board.set(d.g, { last: m });
    d.board.animate(m.from, m.to);
    sfx.move(m);
    dnote();
    drillStep();
  }, 600);
}
function drillMove(from, to, anim) {
  const d = D;
  if (!d || d.g.turn() !== d.side || d.k >= d.ln.moves.length) return;
  const m = findMove(d.g, from, to);
  if (!m) { d.board.render(); return; }
  const br = branches(d.ln, d.k);
  if (br.has(m.san)) {
    const ls = br.get(m.san);
    if (!ls.includes(d.ln)) d.ln = pickLine(ls);
    d.g.move(m.san);
    d.k++; d.miss = 0;
    d.board.set(d.g, { last: m });
    if (anim) d.board.animate(m.from, m.to);
    d.board.flash(m.to, 'good', 350);
    sfx.move(m);
    dnote();
    drillStep();
  } else {
    d.perfect = false; d.miss++;
    sfx.bad();
    d.board.render(); d.board.flash(to, 'bad'); d.board.shake();
    if (d.miss >= 2) { showAnswer(); say('Not the book move — play the arrow', 'bad'); }
    else say('Not the book move — try again', 'bad');
  }
}
function bookMove() { return D.g.moves({ verbose: true }).find(x => x.san === D.ln.moves[D.k]); }
function showAnswer() {
  const d = D;
  if (!d || d.k >= d.ln.moves.length || d.g.turn() !== d.side) return;
  const m = bookMove(), c = COMMENTS.get(fen4(d.g.fen()) + '|' + m.san);
  d.perfect = false;
  d.board.hintSq = null; d.board.arrow = { from: m.from, to: m.to }; d.board.render();
  $('#note').innerHTML = `<b>Book move: ${moveLabel(d.k, m.san)}</b>${c ? `<p>${c}</p>` : ''}`;
}
function hint() {
  const d = D;
  if (!d || d.k >= d.ln.moves.length || d.g.turn() !== d.side) return;
  d.perfect = false;
  if (d.board.hintSq || d.board.arrow) { showAnswer(); say('Play the arrow move', 'hint'); return; }
  d.board.hintSq = bookMove().from; d.board.render();
  say('Hint: move this piece (tap again for the square)', 'hint');
}
function restart() {
  if (!D) return;
  stopTimers();
  Object.assign(D, { g: new Chess(), k: 0, miss: 0 });
  $('#ov').innerHTML = '';
  D.board.set(D.g, {});
  drillStep();
}
function drillDone() {
  const d = D;
  d.board.interactive = false;
  record(d.ln, d.perfect);
  later(sfx.done, 150);
  say(d.perfect ? 'Perfect line!' : 'Line complete', 'good');
  const more = d.mode === 'review' ? dueLines().length > 0 : true;
  const days = IV[Math.min(rec(d.ln).streak, 5)];
  $('#ov').innerHTML = `<div class="sheet"><div class="big">${d.perfect ? '🏆' : '✅'}</div><h2>${d.perfect ? 'Perfect!' : 'Line complete'}</h2><p><b>${d.ln.name}</b></p>
  <p class="muted small">+${d.perfect ? 10 : 3} XP · ${d.perfect ? `next review in ${days} day${days > 1 ? 's' : ''}` : 'no worries — it comes back until it sticks'}</p>
  <div class="row2"><button class="btn" data-act="learn" data-id="${d.ln.op.id}" data-li="${d.ln.i}">📖 Study it</button>${more ? '<button class="btn primary" data-act="d-next">Next line →</button>' : '<button class="btn primary" data-act="home">Done</button>'}</div></div>`;
}

/* ---------------- taps ---------------- */
const NAV = new Set(['home', 'open', 'learn', 'drill', 'drill-line', 'review', 'd-next', 'side']);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  audio();
  const a = b.dataset.act, id = b.dataset.id, li = b.dataset.li != null ? +b.dataset.li : null;
  switch (a) {
    case 'home': home(); break;
    case 'open': openView(id); break;
    case 'learn': learnView(id, li ?? 0, 0); break;
    case 'drill': startDrill('op', id); break;
    case 'drill-line': startDrill('op', id, li); break;
    case 'review': startDrill('review'); break;
    case 'd-next': startDrill(D.mode, D.opId); break;
    case 'sound': S.sound = !S.sound; save(); home(); break;
    case 'side': S.sides[id] = drillSide(byId[id]) === 'w' ? 'b' : 'w'; save(); openView(id); break;
    case 'flip': L.flip = !L.flip; learnShow(false); break;
    case 'l-next': if (L.k < L.ln.moves.length) { L.k++; sfx.move(L.ln.vm[L.k - 1]); learnShow(true); } break;
    case 'l-prev': if (L.k > 0) { L.k--; learnShow(false); } break;
    case 'l-first': L.k = 0; learnShow(false); break;
    case 'l-last': L.k = L.ln.moves.length; learnShow(false); break;
    case 'l-jump': L.k = +b.dataset.k; learnShow(false); break;
    case 'l-alt': sfx.move(L.op.lines[li].vm[L.k]); learnView(L.op.id, li, L.k + 1, true); break;
    case 'd-hint': hint(); break;
    case 'd-show': showAnswer(); say('Play the arrow move', 'hint'); break;
    case 'd-restart': restart(); break;
  }
  if (NAV.has(a)) window.scrollTo(0, 0);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('[role="button"]')) e.target.click();
});

home();
