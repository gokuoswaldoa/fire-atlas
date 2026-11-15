const $ = id => document.getElementById(id), fmt = n => Math.round(n).toLocaleString('es-MX');
const api = (p, q = {}) => fetch('/api/' + p + '?' + new URLSearchParams(q)).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; });
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const ALIAS = { unitedstatesofamerica: 'unitedstates', demrepcongo: 'democraticrepublicofthecongo', centralafricanrep: 'centralafricanrepublic', bosniaandherz: 'bosniaandherzegovina', eswatini: 'swaziland', czechia: 'czechrepublic', dominicanrep: 'dominicanrepublic', ssudan: 'southsudan', eqguinea: 'equatorialguinea', northmacedonia: 'macedonia' };
const key = n => { const k = norm(n); return ALIAS[k] || k; };
const S = { country: '', bbox: null, mode: 'int', byKey: {}, rows: [], res: null, grid: null };
const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const doyDate = (y, d) => new Date(Date.UTC(y, 0, 1) + d * DAY).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const GRAY = ['#e6e8ea', '#cfd3d6', '#b0b6bb', '#8e969c', '#69727a'];
const RAMP = ['#e9edf0', '#fde7b0', '#f5a524', '#d6451e', '#6b1020'];
let hot, map, geo, rect, drawing = false, p0 = null, lastDraw = 0, chRank, chTs, chYr, calMeta;

function colorOf(v, max, R = RAMP) { if (!v) return R[0]; const t = Math.log1p(v) / Math.log1p(max); return R[1 + Math.min(3, Math.floor(t * 4))]; }
const metric = () => $('metric').value, rng = () => [+$('y0').value, +$('y1').value];

async function init() {
  const meta = await api('meta');
  $('badge').textContent = meta.demo ? 'Datos de demostración (sintéticos)' : `${meta.files} archivos FIRMS · ${fmt(meta.rows)} detecciones`; $('badge').classList.toggle('demo', meta.demo);
  for (let y = meta.yearMin; y <= meta.yearMax; y++) for (const id of ['y0', 'y1']) $(id).add(new Option(y, y));
  $('y0').value = meta.yearMin; $('y1').value = meta.yearMax;
  meta.countries.forEach(c => $('country').add(new Option(c, c)));
  await initMap(); await refresh();
}
async function initMap() {
  map = L.map('map', { minZoom: 1, maxZoom: 9, zoomSnap: 0.5, worldCopyJump: false, attributionControl: false, maxBounds: [[-85, -180], [85, 180]], maxBoundsViscosity: 1 }).setView([20, 0], 1.5);
  L.control.attribution({ prefix: false }).addAttribution('Imagen: NASA GIBS · Blue Marble').addTo(map);
  let good = 0, bad = 0;
  const base = L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/EPSG3857_500m/{z}/{y}/{x}.jpeg', { noWrap: true, maxNativeZoom: 8, bounds: [[-85.05, -180], [85.05, 180]] }).addTo(map);
  base.on('tileload', () => good++); // si NASA GIBS no responde, usa Esri como respaldo
  base.on('tileerror', () => { if (++bad > 8 && !good) { base.remove(); L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { noWrap: true, maxNativeZoom: 17 }).addTo(map).bringToBack(); } });
  const lg = L.control({ position: 'bottomleft' }); lg.onAdd = () => { const d = L.DomUtil.create('div', 'maplegend'); d.innerHTML = '<i></i> Zona caliente <small>(tamaño = nº de detecciones)</small>'; return d; }; lg.addTo(map);
  try {
    const topo = await (await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')).json();
    geo = L.geoJSON(topojson.feature(topo, topo.objects.countries), { style, onEachFeature: (f, l) => {
      l.on('mouseover', () => l.setStyle({ weight: 2, color: '#ffffff' })); l.on('mouseout', () => geo.resetStyle(l));
      l.on('click', () => { if (Date.now() - lastDraw < 400) return; const r = S.byKey[key(f.properties.name)]; if (r) pick(r.country); });
      l.bindTooltip(() => { const r = S.byKey[key(f.properties.name)]; return `<b>${f.properties.name}</b><br>` + (r ? fmt(r[metric()]) + ' detecciones' : 'Sin datos cargados'); }, { sticky: true, className: 'tt' }); } }).addTo(map);
  } catch (e) { $('hint').textContent = 'No se pudo cargar el contorno de países (¿sin internet?). Usa el selector o arrastra un área.'; }
  map.on('mousedown', e => { if (drawing) p0 = e.latlng; });
  map.on('mousemove', e => { if (drawing && p0) setRect(p0, e.latlng); });
  map.on('mouseup', e => { if (!drawing || !p0) return; drawing = false; map.dragging.enable(); $('draw').classList.remove('on'); map.getContainer().style.cursor = '';
    const a = p0, b = e.latlng; p0 = null; lastDraw = Date.now(); if (Math.abs(a.lat - b.lat) < 0.05 && Math.abs(a.lng - b.lng) < 0.05) return;
    S.bbox = [Math.min(a.lng, b.lng), Math.min(a.lat, b.lat), Math.max(a.lng, b.lng), Math.max(a.lat, b.lat)]; S.country = ''; $('country').value = ''; refreshSeries(); });
}
const style = f => { const r = S.byKey[key(f.properties.name)], max = S.rows[0] ? S.rows[0][metric()] : 1, sel = r && r.country === S.country, fill = $('fill').checked;
  return { fillColor: sel ? '#ffffff' : r ? colorOf(r[metric()], max, GRAY) : '#000', fillOpacity: sel ? 0.18 : fill && r ? 0.55 : 0, color: sel ? '#ffd166' : 'rgba(255,255,255,.55)', weight: sel ? 2.5 : 0.6 }; };
function setRect(a, b) { rect && rect.remove(); rect = L.rectangle([a, b], { color: '#ffd166', weight: 2, fillOpacity: 0.1 }).addTo(map); }
function pick(c) { refreshHotLater(c); S.country = c; S.bbox = null; rect && rect.remove(); $('country').value = c; geo && geo.setStyle(style);
  geo && geo.eachLayer(l => { if (key(l.feature.properties.name) === key(c)) map.fitBounds(l.getBounds(), { maxZoom: 6, padding: [20, 20] }); }); refreshSeries(); }

$('fill').onchange = () => geo && geo.setStyle(style);
function refreshHotLater() { setTimeout(() => refreshHot().catch(console.error), 0); }
$('draw').onclick = () => { drawing = true; map.dragging.disable(); map.getContainer().style.cursor = 'crosshair'; $('draw').classList.add('on'); $('hint').textContent = 'Arrastra sobre el mapa para dibujar el área de interés.'; };
$('clear').onclick = () => { refreshHotLater(); S.country = ''; S.bbox = null; $('country').value = ''; rect && rect.remove(); geo && geo.setStyle(style); map && map.setView([20, 0], 1.5); refreshSeries(); };
$('country').onchange = e => (e.target.value ? pick(e.target.value) : $('clear').onclick());
['y0', 'y1', 'metric'].forEach(id => ($(id).onchange = () => { if (rng()[0] > rng()[1]) { $('y0').value = $('y1').value; } refresh(); }));

async function refresh() { await refreshRanking(); refreshHot().catch(console.error); await refreshSeries(); }
async function refreshRanking() {
  const [a, b] = rng(), r = await api('ranking', { from: a, to: b, metric: metric(), limit: 500 }); S.rows = r.rows; S.byKey = {};
  r.rows.forEach(x => (S.byKey[key(x.country)] = x)); geo && geo.setStyle(style);
  const top = r.rows.slice(0, 15); chRank && chRank.destroy();
  chRank = new Chart($('rank'), { type: 'bar', data: { labels: top.map(x => x.country), datasets: [{ data: top.map(x => x[metric()]), backgroundColor: top.map(x => x.country === S.country ? '#0f2a3d' : '#b93a14') }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmt(c.raw) + ' detecciones' } } },
      onClick: (e, els) => els[0] && pick(top[els[0].index].country), onHover: (e, els) => (e.native.target.style.cursor = els.length ? 'pointer' : '') } });
}
async function refreshHot() { // zonas calientes: círculos rojos por celda de 0.5°, tamaño según detecciones
  const [a, b] = rng(), q = { from: a, to: b, metric: metric() }; if (S.country) q.country = S.country;
  const { cells } = await api('cells', q); hot && hot.remove(); if (!cells.length) return; const max = cells.reduce((m, c) => Math.max(m, c[2]), 1);
  hot = L.layerGroup(cells.sort((x, y) => x[2] - y[2]).map(([la, lo, n]) => { const t = Math.sqrt(n / max);
    return L.circleMarker([la, lo], { radius: 2 + 11 * t, stroke: false, fillColor: '#ff3b1d', fillOpacity: 0.35 + 0.5 * t, interactive: false }); })).addTo(map);
}
async function refreshSeries() {
  const q = {}; if (S.country) q.country = S.country; if (S.bbox) q.bbox = S.bbox.join(',');
  const d = await api('daily', q), res = Harmonize.run(d), [a, b] = rng();
  res.series = res.series.filter(s => +s.date.slice(0, 4) >= a && +s.date.slice(0, 4) <= b); S.res = res;
  const label = S.country || (S.bbox ? `Área seleccionada (${S.bbox.map(x => x.toFixed(1)).join(', ')})` : 'Todos los países'); $('calTitle').textContent = 'Calendario diario · ' + label;
  if (!res.series.length) { $('kpis').innerHTML = '<div class="kpi"><b>Sin datos</b><span>No hay detecciones en esta selección.</span></div>'; return; }
  S.grid = Harmonize.grid(res.series); render();
  geo && geo.setStyle(style); chRank && (chRank.data.datasets[0].backgroundColor = chRank.data.labels.map(c => (c === S.country ? '#0f2a3d' : '#b93a14')), chRank.update());
}
function render() {
  const { series, k, overlap } = S.res, g = S.grid, ev = Harmonize.episodes(g, +$('z').value, +$('d').value);
  const tot = series.reduce((x, s) => x + s.h, 0), pk = series.reduce((x, s) => (s.h > x.h ? s : x), series[0]), kg = k.reduce((x, y) => x + y, 0) / 12;
  $('kpis').innerHTML = [[fmt(tot), 'detecciones armonizadas'], [pk.date, `día pico (${fmt(pk.h)})`], [ev.length, 'periodos críticos'], [S.rows[0] ? S.rows[0].country : '—', 'país con más detecciones'], [overlap ? '×' + kg.toFixed(2) : 'n/d', 'factor VIIRS → MODIS']].map(([x, y]) => `<div class="kpi"><b>${x}</b><span>${y}</span></div>`).join('');
  drawCal(g); drawTS(series); drawYr(series);
  $('events').innerHTML = ev.slice(0, 30).map(e => `<li><b>${doyDate(e.year, e.start)} – ${doyDate(e.year, e.end)} ${e.year}</b><br><small>${fmt(e.total)} detecciones · pico ${e.zmax.toFixed(1)} σ</small></li>`).join('') || '<li>Ninguno con este umbral.</li>';
  $('method').innerHTML = `<b>Método.</b> MODIS (Terra+Aqua, 1 km) es la referencia por ser el registro más largo. VIIRS (375 m) detecta fuegos más pequeños, así que se convierte a unidades MODIS con un factor por mes del año calculado en los ${fmt(overlap)} días de solape. Con ambos sensores el día se promedia; con uno solo se usa ese. La anomalía compara cada día con los mismos días (±7) de los demás años del rango. <br><br><b>Limitaciones.</b> Son detecciones térmicas, no área quemada. La presencia de nubes y el paso de los satélites afectan los conteos. VIIRS-SNPP, NOAA-20 y NOAA-21 se tratan como un solo VIIRS.`;
}
function color(v, max, z) { if (S.mode === 'anom') return z >= 3 ? '#6b1020' : z >= 2 ? '#d6451e' : z >= 1 ? '#f5a524' : z <= -1 ? '#1f6f7d' : '#e6ebee'; return colorOf(v, max); }
function drawCal(g) {
  const c = $('cal'), dpr = devicePixelRatio || 1, W = c.clientWidth, L0 = 40, cw = (W - L0) / 366, ch = Math.max(11, Math.min(18, 440 / g.years.length)), H = g.years.length * ch + 22;
  c.width = W * dpr; c.height = H * dpr; c.style.height = H + 'px'; const x = c.getContext('2d'); x.scale(dpr, dpr); const max = Math.max(...g.H.flat()); x.font = '11px "Source Sans 3"';
  g.years.forEach((y, yi) => { x.fillStyle = '#14232e'; x.fillText(y, 2, 22 + yi * ch + ch - 3);
    for (let d = 0; d < 366; d++) { x.fillStyle = color(g.H[yi][d], max, g.Z[yi][d]); x.fillRect(L0 + d * cw, 22 + yi * ch, Math.ceil(cw), ch - 1); } });
  x.fillStyle = '#14232e'; MES.forEach((m, i) => x.fillText(m, L0 + i * 30.5 * cw + 2, 12)); calMeta = { L0, cw, ch, g };
  $('legend').textContent = S.mode === 'anom' ? 'Azul: por debajo de lo normal · gris: normal · amarillo a granate: 1, 2 y 3+ desviaciones sobre lo normal.' : 'Color por detecciones del día en escala logarítmica: gris claro sin detecciones, granate el máximo del periodo.';
}
$('cal').onmousemove = e => { if (!calMeta) return; const r = e.target.getBoundingClientRect(), { L0, cw, ch, g } = calMeta, d = Math.floor((e.clientX - r.left - L0) / cw), yi = Math.floor((e.clientY - r.top - 22) / ch), t = $('tip');
  if (d < 0 || d > 365 || yi < 0 || yi >= g.years.length) { t.style.display = 'none'; return; } t.style.display = 'block'; t.style.left = e.clientX - r.left + 14 + 'px'; t.style.top = e.clientY - r.top + 70 + 'px';
  t.textContent = `${doyDate(g.years[yi], d)} ${g.years[yi]}: ${fmt(g.H[yi][d])} (${g.Z[yi][d] >= 0 ? '+' : ''}${g.Z[yi][d].toFixed(1)} σ)`; };
$('cal').onmouseleave = () => ($('tip').style.display = 'none');
document.querySelectorAll('.seg button').forEach(b => (b.onclick = () => { document.querySelectorAll('.seg button').forEach(x => x.classList.remove('on')); b.classList.add('on'); S.mode = b.dataset.m; S.grid && drawCal(S.grid); }));
function drawTS(series) {
  const mo = {}; for (const s of series) { const k = s.date.slice(0, 7), o = (mo[k] ||= { m: 0, v: 0, h: 0 }); o.m += s.modis; o.v += s.viirs; o.h += s.h; } const L = Object.keys(mo); chTs && chTs.destroy();
  chTs = new Chart($('ts'), { type: 'line', data: { labels: L, datasets: [{ label: 'MODIS', data: L.map(k => mo[k].m), borderColor: '#1f6f7d', borderWidth: 1, pointRadius: 0 }, { label: 'VIIRS (sin ajustar)', data: L.map(k => mo[k].v), borderColor: '#d89a1c', borderWidth: 1, borderDash: [4, 3], pointRadius: 0 }, { label: 'Armonizado', data: L.map(k => mo[k].h), borderColor: '#b93a14', borderWidth: 2, pointRadius: 0 }] },
    options: { animation: false, interaction: { mode: 'index', intersect: false }, scales: { x: { ticks: { maxTicksLimit: 10 } } } } });
}
function drawYr(series) {
  const yr = {}; for (const s of series) yr[s.date.slice(0, 4)] = (yr[s.date.slice(0, 4)] || 0) + s.h; const L = Object.keys(yr); chYr && chYr.destroy();
  chYr = new Chart($('yr'), { type: 'bar', data: { labels: L, datasets: [{ label: 'Detecciones armonizadas', data: L.map(k => Math.round(yr[k])), backgroundColor: '#b93a14' }] }, options: { animation: false, plugins: { legend: { display: false } } } });
}
['z', 'd'].forEach(i => ($(i).oninput = () => { $(i === 'z' ? 'zv' : 'dv').textContent = (+$(i).value).toFixed(i === 'z' ? 1 : 0); S.res && S.res.series.length && render(); }));
$('export').onclick = () => { if (!S.res) return; const csv = 'date,modis,viirs_raw,harmonized\n' + S.res.series.map(s => `${s.date},${s.modis},${s.viirs},${s.h.toFixed(2)}`).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'fuego_armonizado.csv'; a.click(); };
addEventListener('resize', () => S.grid && drawCal(S.grid));
init().catch(e => { $('badge').textContent = 'Error: ' + e.message; });
