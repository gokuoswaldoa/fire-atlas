// Lee CSV de FIRMS (data/modis_2020_Mexico.csv, data/viirs-snpp_2020_Mexico.csv…) y los agrega en
// país → celda de 0.5° → día → [modis, viirs]. Lectura por streaming: soporta archivos grandes.
const fs = require('fs'), path = require('path'), readline = require('readline');
const DAY = 864e5, CELL = 0.5;
const cellKey = (lat, lon) => Math.floor(lat / CELL) + ',' + Math.floor(lon / CELL);
function add(db, country, lat, lon, day, s, n = 1) {
  let cells = db.get(country); if (!cells) db.set(country, (cells = new Map()));
  const k = cellKey(lat, lon); let days = cells.get(k); if (!days) cells.set(k, (days = new Map()));
  let v = days.get(day); if (!v) days.set(day, (v = [0, 0])); v[s] += n;
}
async function loadDir(dir) {
  const db = new Map(), files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.csv$/i.test(f)) : []; let used = 0, rows = 0;
  for (const f of files) {
    const m = f.match(/^(modis|viirs[\w-]*)_(\d{4})_(.+)\.csv$/i); if (!m) { console.warn('Se omite (nombre no reconocido):', f); continue; }
    const s = /^viirs/i.test(m[1]) ? 1 : 0, country = m[3].replace(/_/g, ' '); let ix = null; used++;
    const rl = readline.createInterface({ input: fs.createReadStream(path.join(dir, f)), crlfDelay: Infinity });
    for await (const l of rl) { const c = l.split(',');
      if (!ix) { ix = ['latitude', 'longitude', 'acq_date'].map(k => c.indexOf(k)); if (ix.includes(-1)) { console.warn('Sin columnas FIRMS:', f); break; } continue; }
      const day = Math.floor(Date.parse(c[ix[2]]) / DAY); if (isNaN(day)) continue; add(db, country, +c[ix[0]], +c[ix[1]], day, s); rows++; }
  }
  return { db, files: used, rows };
}
module.exports = { loadDir, add, CELL };
