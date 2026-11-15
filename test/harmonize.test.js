const test = require('node:test'), assert = require('node:assert'), H = require('../shared/harmonize.js');
test('VIIRS se escala a unidades MODIS en el solape', () => {
  const r = H.run({ modis: { '2013-01-01': 10, '2013-01-02': 20 }, viirs: { '2013-01-01': 20, '2013-01-02': 40 } });
  assert.strictEqual(r.series[0].h, 10); assert.strictEqual(r.series[1].h, 20);
});
test('un día solo con VIIRS usa el factor mensual', () => {
  const m = {}, v = {}; for (let d = 1; d <= 28; d++) { const k = '2013-01-' + String(d).padStart(2, '0'); m[k] = 10; v[k] = 30; } v['2013-01-29'] = 60;
  const r = H.run({ modis: m, viirs: v }); assert.ok(Math.abs(r.series.at(-1).h - 20) < 1e-9);
});
test('episodios detectan rachas anómalas', () => {
  const g = { years: [2000, 2001, 2002], H: [Array(366).fill(1), Array(366).fill(1), Array(366).fill(1)], Z: [Array(366).fill(0), Array(366).fill(0), Array(366).fill(0)] };
  for (let d = 100; d < 105; d++) { g.Z[1][d] = 3; g.H[1][d] = 50; }
  const e = H.episodes(g, 2, 3); assert.strictEqual(e.length, 1); assert.strictEqual(e[0].year, 2001);
});
