// Armonización MODIS ↔ VIIRS. Sin dependencias; usable también desde Node para pruebas.
// Referencia: MODIS (registro más largo). VIIRS se convierte a "unidades MODIS" con un
// factor k(mes) = ΣMODIS / ΣVIIRS sobre el periodo de solape, calculado por mes del año
// porque la razón cambia con la estación (fuegos pequeños y nocturnos que VIIRS ve y MODIS no).
const DAY = 864e5;
const Harmonize = {
  // daily: {modis:{'YYYY-MM-DD':n}, viirs:{...}} -> {series:[{date,modis,viirs,h}], k:[12], overlap:n}
  run(daily) {
    const m = daily.modis, v = daily.viirs;
    const all = Object.keys(m).concat(Object.keys(v)).sort();
    if (!all.length) return { series: [], k: [], overlap: 0 };
    const t0 = Date.parse(all[0]), t1 = Date.parse(all[all.length - 1]);
    const sm = Array(12).fill(0), sv = Array(12).fill(0); let overlap = 0;
    for (const d in v) if (d in m || hasModisOn(m, d)) { const i = +d.slice(5, 7) - 1; sm[i] += m[d] || 0; sv[i] += v[d]; overlap++; }
    const gm = sm.reduce((a, b) => a + b, 0), gv = sv.reduce((a, b) => a + b, 0), g = gv ? gm / gv : 1;
    const k = sm.map((x, i) => (sv[i] > 30 ? x / sv[i] : g)); // mes con poca muestra → razón global
    const series = [];
    for (let t = t0; t <= t1; t += DAY) {
      const date = new Date(t).toISOString().slice(0, 10), mi = +date.slice(5, 7) - 1;
      const a = m[date], b = v[date] != null ? v[date] * k[mi] : undefined;
      const h = a != null && b != null ? (a + b) / 2 : a != null ? a : b != null ? b : 0;
      series.push({ date, modis: a || 0, viirs: v[date] || 0, h });
    }
    return { series, k, overlap };
  },
  // matriz año × día-del-año, climatología (±win días, otros años) y anomalía z
  grid(series, win = 7) {
    const years = [...new Set(series.map(s => +s.date.slice(0, 4)))], y0 = years[0];
    const H = years.map(() => Array(366).fill(0));
    for (const s of series) { const d = new Date(s.date), y = d.getUTCFullYear(), doy = Math.floor((d - Date.UTC(y, 0, 1)) / DAY); H[y - y0][doy] = s.h; }
    const Z = H.map((row, yi) => row.map((val, d) => {
      const x = [];
      for (let yy = 0; yy < H.length; yy++) if (yy !== yi) for (let o = -win; o <= win; o++) { const dd = d + o; if (dd >= 0 && dd < 366) x.push(H[yy][dd]); }
      if (x.length < 10) return 0;
      const mu = x.reduce((a, b) => a + b, 0) / x.length, sd = Math.sqrt(x.reduce((a, b) => a + (b - mu) ** 2, 0) / x.length);
      return (val - mu) / Math.max(sd, 1);
    }));
    return { years, y0, H, Z };
  },
  // episodios: ≥minDays días consecutivos con z ≥ zmin
  episodes(g, zmin, minDays) {
    const out = [];
    g.years.forEach((y, yi) => {
      let s = -1;
      for (let d = 0; d <= 366; d++) {
        const on = d < 366 && g.Z[yi][d] >= zmin && g.H[yi][d] > 0;
        if (on && s < 0) s = d;
        if (!on && s >= 0) { if (d - s >= minDays) { let tot = 0, zm = 0; for (let i = s; i < d; i++) { tot += g.H[yi][i]; zm = Math.max(zm, g.Z[yi][i]); } out.push({ year: y, start: s, end: d - 1, total: tot, zmax: zm }); } s = -1; }
      }
    });
    return out.sort((a, b) => b.zmax - a.zmax);
  }
};
function hasModisOn(m, d) { return m[d] != null; }
if (typeof module !== 'undefined') module.exports = Harmonize;
