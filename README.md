# Atlas de actividad de incendios (MODIS + VIIRS)

Aplicación completa (backend + frontend) que armoniza las detecciones activas de incendio de MODIS (1 km, 2000–) y VIIRS 375 m (2012–) de NASA FIRMS en un solo registro. Permite explorar patrones históricos, condiciones inusuales y periodos críticos por país o por un área dibujada.

## Estructura
```
backend/    server.js (API + estáticos, sin dependencias) · ingest.js (CSV → agregados) · demo.js (datos sintéticos)
frontend/   index.html · styles.css · app.js (mapa, combo, gráficas, calendario)
shared/     harmonize.js (armonización y anomalías; lo usan backend y navegador)
scripts/    fetch_firms.py (descarga desde la API de FIRMS)
data/       aquí van los CSV de FIRMS (no se suben a git)
test/       pruebas con node:test
```

## Arranque
Ejecuta todo desde la carpeta raíz (la que contiene `package.json`), no desde `frontend/`.
```bash
npm start                     # o: npm run dev (se reinicia al cambiar el backend)
node backend/server.js        # http://localhost:8080  (Node ≥ 18, sin npm install)
npm test
docker build -t fire-atlas . && docker run -p 8080:8080 -v $PWD/data:/app/data fire-atlas
```
Sin CSV en `data/`, el servidor usa **datos sintéticos de demostración** (la insignia de arriba lo indica).

## Datos reales
1. En [FIRMS · Country yearly summary](https://firms.modaps.eosdis.nasa.gov/country/) descarga los CSV anuales por país de MODIS y de VIIRS, o usa `FIRMS_KEY=… python scripts/fetch_firms.py MODIS_SP MEX 2012-01-20 2024-12-31`.
2. Descomprime y deja los archivos en `data/` con el nombre `modis_AAAA_Pais.csv` o `viirs-snpp_AAAA_Pais.csv` (el nombre decide sensor, año y país).
3. Reinicia el servidor. Se leen por streaming y se agregan por país, celda de 0.5° y día.

## API
| Ruta | Parámetros | Devuelve |
|---|---|---|
| `/api/meta` | – | países, rango de años, si es demo |
| `/api/ranking` | `from`, `to`, `metric` (harmonized/modis/viirs), `limit` | países ordenados por detecciones |
| `/api/daily` | `country`, `bbox=w,s,e,n` | conteos diarios por sensor |

## Método
VIIRS se convierte a unidades MODIS con un factor por mes del año calculado en el periodo de solape; con ambos sensores el día se promedia. La anomalía compara cada día con los mismos días (±7) de los demás años. Periodos críticos = rachas de días con anomalía ≥ umbral.

## Limitaciones conocidas
Son detecciones, no área quemada. No hay filtro por confianza ni tipo de fuego. VIIRS-SNPP/NOAA-20/NOAA-21 se tratan como un solo sensor. La resolución espacial del recorte por área es de 0.5°. El mapa y las bibliotecas se cargan desde CDN, por lo que el navegador necesita internet; los contornos de países se emparejan con FIRMS por nombre y algunos países pueden quedar sin color.
