// Datos sintéticos (solo para ver la app sin descargar nada). NO son observaciones reales.
const { add } = require('./ingest.js'), DAY = 864e5;
const C = [['Mexico', [-117, 15, -87, 31], 110, 3], ['Brazil', [-60, -20, -40, -2], 240, 9], ['Bolivia', [-66, -19, -58, -11], 235, 6], ['Colombia', [-76, 2, -70, 9], 40, 4],
  ['Peru', [-78, -12, -70, -5], 230, 3], ['Argentina', [-64, -35, -58, -25], 250, 4], ['Canada', [-125, 50, -90, 58], 195, 4], ['United States', [-122, 34, -100, 46], 215, 5],
  ['Australia', [125, -20, 150, -12], 300, 8], ['Indonesia', [101, -4, 115, 1], 270, 6], ['India', [76, 15, 85, 25], 85, 6], ['Russia', [90, 52, 130, 60], 180, 6],
  ['Democratic Republic of the Congo', [18, -10, 28, -2], 200, 9], ['Angola', [14, -14, 22, -8], 200, 8], ['Zambia', [24, -15, 31, -10], 230, 6],
  ['Spain', [-8, 37, 0, 42], 215, 2], ['Portugal', [-8.5, 38, -7, 41.5], 220, 1.5], ['Greece', [21, 36, 26, 40], 210, 1.5]];
function makeDemo() {
  let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, db = new Map(), nino = [2005, 2012, 2016, 2019, 2023];
  for (const [name, b, peak, sc] of C) {
    const cells = Array.from({ length: 8 }, () => [b[1] + r() * (b[3] - b[1]), b[0] + r() * (b[2] - b[0])]);
    for (let y = 2000; y <= 2025; y++) { const yf = (nino.includes(y) ? 2.2 : 1) * (0.7 + r() * 0.6), t0 = Date.UTC(y, 0, 1) / DAY;
      for (let d = 0; d < 365; d++) for (const [la, lo] of cells) {
        let base = sc * yf * 6 * Math.exp(-((d - peak) ** 2) / (2 * 30 ** 2)) + 0.3; if (nino.includes(y) && Math.abs(d - peak) < 7) base *= 3;
        const n = Math.round(base * (0.5 + r())); if (!n) continue; add(db, name, la, lo, t0 + d, 0, n);
        if (y >= 2012) add(db, name, la, lo, t0 + d, 1, Math.round(n * (2.2 + 0.8 * Math.sin(d / 58)) * (0.85 + r() * 0.3))); } }
  }
  return db;
}
module.exports = { makeDemo };
