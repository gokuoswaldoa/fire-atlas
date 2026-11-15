// Servidor sin dependencias externas (solo Node ≥18). Sirve la API y el frontend.
const http = require('http'), fs = require('fs'), path = require('path');
const Harmonize = require('../shared/harmonize.js'), { loadDir, CELL } = require('./ingest.js'), { makeDemo } = require('./demo.js');
const ROOT = path.join(__dirname, '..'), DATA = process.env.FIRMS_DIR || path.join(ROOT, 'data'), PORT = +process.env.PORT || 8080, DAY = 864e5;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
let db, demo = false, files = 0, rows = 0; const cache = new Map(), isoMemo = new Map();
const iso = d => isoMemo.get(d) || (isoMemo.set(d, new Date(d * DAY).toISOString().slice(0, 10)), isoMemo.get(d));

function collect(countries, bbox) { // suma diaria por sensor para países y/o rectángulo [w,s,e,n]
  const out = { modis: {}, viirs: {} };
  for (const c of countries) for (const [cell, days] of db.get(c)) {
    if (bbox) { const [i, j] = cell.split(',').map(Number), la = (i + 0.5) * CELL, lo = (j + 0.5) * CELL; if (lo < bbox[0] || lo > bbox[2] || la < bbox[1] || la > bbox[3]) continue; }
    for (const [d, v] of days) { const k = iso(d); if (v[0]) out.modis[k] = (out.modis[k] || 0) + v[0]; if (v[1]) out.viirs[k] = (out.viirs[k] || 0) + v[1]; } }
  return out;
}
const full = c => cache.get(c) || (cache.set(c, { res: Harmonize.run(collect([c])) }), cache.get(c));

const routes = {
  '/api/health': () => ({ ok: true }),
  '/api/meta': () => { let y0 = 9999, y1 = 0; for (const c of db.keys()) { const s = full(c).res.series; if (s.length) { y0 = Math.min(y0, +s[0].date.slice(0, 4)); y1 = Math.max(y1, +s[s.length - 1].date.slice(0, 4)); } }
    return { demo, files, rows, countries: [...db.keys()].sort(), yearMin: y0, yearMax: y1 }; },
  '/api/ranking': q => { const a = +q.get('from') || 0, b = +q.get('to') || 9999, rowsOut = [];
    for (const c of db.keys()) { const t = { country: c, modis: 0, viirs: 0, harmonized: 0 };
      for (const s of full(c).res.series) { const y = +s.date.slice(0, 4); if (y < a || y > b) continue; t.modis += s.modis; t.viirs += s.viirs; t.harmonized += s.h; }
      if (t.modis + t.viirs) rowsOut.push(t); }
    const m = ['modis', 'viirs'].includes(q.get('metric')) ? q.get('metric') : 'harmonized';
    return { metric: m, rows: rowsOut.sort((x, y) => y[m] - x[m]).slice(0, +q.get('limit') || 25) }; },
  '/api/cells': q => { const a = +q.get('from') || 0, b = +q.get('to') || 9999, met = q.get('metric'), c = q.get('country'), out = [];
    for (const name of c ? [c] : db.keys()) { if (!db.has(name)) continue; const k = full(name).res.k, kg = k.length ? k.reduce((x, y) => x + y, 0) / k.length : 1;
      for (const [cell, days] of db.get(name)) { let t = 0;
        for (const [d, v] of days) { const y = +iso(d).slice(0, 4); if (y < a || y > b) continue; t += met === 'modis' ? v[0] : met === 'viirs' ? v[1] : (v[0] && v[1] ? (v[0] + v[1] * kg) / 2 : v[0] + v[1] * kg); }
        if (t > 0) { const [i, j] = cell.split(',').map(Number); out.push([(i + 0.5) * CELL, (j + 0.5) * CELL, Math.round(t)]); } } }
    return { cells: out }; },
  '/api/daily': q => { const c = q.get('country'), bb = q.get('bbox') ? q.get('bbox').split(',').map(Number) : null;
    if (c && !db.has(c)) throw Object.assign(new Error('País desconocido'), { code: 404 });
    if (bb && (bb.length !== 4 || bb.some(isNaN))) throw Object.assign(new Error('bbox inválido: w,s,e,n'), { code: 400 });
    if (c && !bb) { const s = full(c).res.series; const o = { modis: {}, viirs: {} }; for (const x of s) { if (x.modis) o.modis[x.date] = x.modis; if (x.viirs) o.viirs[x.date] = x.viirs; } return o; }
    return collect(c ? [c] : [...db.keys()], bb); }
};

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), send = (code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache' }); res.end(body); };
  try {
    if (routes[u.pathname]) return send(200, JSON.stringify(routes[u.pathname](u.searchParams)));
    const base = u.pathname.startsWith('/shared/') ? ROOT : path.join(ROOT, 'frontend');
    const f = path.normalize(path.join(base, u.pathname === '/' ? 'index.html' : u.pathname));
    if (!f.startsWith(base) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(404, '{"error":"No encontrado"}');
    send(200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream');
  } catch (e) { send(e.code || 500, JSON.stringify({ error: e.message })); }
});
(async () => {
  const r = await loadDir(DATA); db = r.db; files = r.files; rows = r.rows;
  if (!db.size) { demo = true; db = makeDemo(); console.log('Sin CSV en', DATA, '→ usando datos de DEMOSTRACIÓN sintéticos.'); }
  else console.log(`${files} archivos, ${rows} detecciones, ${db.size} países.`);
  server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
})();
module.exports = { collect };
