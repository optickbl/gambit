// Stockfish running in a Web Worker.
// Engine: stockfish.js 10 by Niklas Fiekas and the Stockfish authors, GPL-3.0 (see engine/COPYING.txt).
// Source code: https://github.com/niklasf/stockfish.js and https://github.com/official-stockfish/Stockfish
const WASM = typeof WebAssembly === 'object' && WebAssembly.validate(Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0));

export class Engine {
  constructor(base = 'engine/') {
    this.base = base;
    this.queue = Promise.resolve();
    this.boot();
  }
  boot() {
    this.w = new Worker(this.base + (WASM ? 'stockfish.wasm.js' : 'stockfish.js'));
    this.w.onmessage = e => this.line(String(e.data));
    this.w.onerror = e => { if (e && e.preventDefault) e.preventDefault(); this.crash(); };
    this.job = null;
    this.wait = null;
    this.skill = 20;
    this.multipv = 1;
    this.ready = this.cmd('uci', 'uciok').then(() => this.cmd('isready', 'readyok'));
  }
  // if the engine ever dies, finish the pending search empty-handed and start a fresh one
  crash() {
    try { this.w.terminate(); } catch {}
    const j = this.job, w = this.wait;
    this.job = null;
    this.wait = null;
    if (w) w.res(null);
    if (j) { clearTimeout(j.dog); j.res({ ...j, best: null, failed: true }); }
    this.boot();
  }
  cmd(c, until) {
    return new Promise(res => { this.wait = { until, res }; this.w.postMessage(c); });
  }
  line(l) {
    if (this.wait && l.startsWith(this.wait.until)) { const w = this.wait; this.wait = null; w.res(l); return; }
    const j = this.job;
    if (!j) return;
    if (l.startsWith('info') && l.includes(' score ')) {
      // with several lines (MultiPV, or a lowered skill level) only line 1 is the engine's main line
      const n = +((l.match(/ multipv (\d+)/) || [])[1] || 1);
      const s = l.match(/ score (cp|mate) (-?\d+)/), pv = l.match(/ pv (.+)$/);
      const score = s ? (s[1] === 'mate' ? { mate: +s[2] } : { cp: +s[2] }) : null, moves = pv ? pv[1].trim().split(/\s+/) : null;
      if (n > 1) { if (score && moves) j.lines[n - 1] = { score, pv: moves }; return; }
      if (score) j.score = score;
      const d = l.match(/ depth (\d+)/);
      if (d) j.depth = +d[1];
      if (moves) j.pv = moves;
      if (score && moves) j.lines[0] = { score, pv: moves };
    } else if (l.startsWith('bestmove')) {
      this.job = null;
      clearTimeout(j.dog);
      const b = l.split(/\s+/)[1];
      j.best = b && b !== '(none)' ? b : null;
      j.res(j);
    }
  }
  // Search a position. The score is from the point of view of the side to move.
  // multipv > 1 also returns the next best lines in `lines` (line 0 is the best).
  search(fen, { movetime = 700, depth = 0, skill = 20, multipv = 1 } = {}) {
    const run = async () => {
      await this.ready;
      if (skill !== this.skill) { this.skill = skill; this.w.postMessage(`setoption name Skill Level value ${skill}`); }
      if (multipv !== this.multipv) { this.multipv = multipv; this.w.postMessage(`setoption name MultiPV value ${multipv}`); }
      return new Promise(res => {
        const job = { res, score: null, best: null, pv: [], depth: 0, lines: [] };
        job.dog = setTimeout(() => { if (this.job === job) this.crash(); }, (depth ? 20000 : movetime) + 8000);
        this.job = job;
        this.w.postMessage('position fen ' + fen);
        this.w.postMessage(depth ? `go depth ${depth}` : `go movetime ${movetime}`);
      });
    };
    this.queue = this.queue.then(run, run);
    return this.queue;
  }
  stop() { if (this.job) this.w.postMessage('stop'); }
}

// score helpers; a score is always from the point of view of the side to move
export const winning = (s, cp = 300) => !!s && (s.mate != null ? s.mate > 0 : s.cp >= cp);
export const losing = (s, cp = 300) => !!s && (s.mate != null ? s.mate <= 0 : s.cp <= -cp);
export const flip = s => (s ? (s.mate != null ? { mate: -s.mate } : { cp: -s.cp }) : s);
