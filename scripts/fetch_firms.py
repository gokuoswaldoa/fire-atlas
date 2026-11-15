#!/usr/bin/env python3
"""Descarga detecciones FIRMS por bbox y fechas (trozos de 10 días) y las guarda en data/.
Uso (bbox o código ISO3 de país, p. ej. MEX): FIRMS_KEY=xxxx python scripts/fetch_firms.py MODIS_SP -99.6,18.3,-98.6,19.2 2012-01-20 2024-12-31
Fuentes: MODIS_SP, MODIS_NRT, VIIRS_SNPP_SP, VIIRS_NOAA20_SP, VIIRS_NOAA21_NRT
Llave gratuita: https://firms.modaps.eosdis.nasa.gov/api/map_key"""
import os, sys, time, urllib.request
from datetime import date, timedelta

src, bbox, start, end = sys.argv[1:5]
key = os.environ["FIRMS_KEY"]
d, last = date.fromisoformat(start), date.fromisoformat(end)
out = f"data/{src}_{start}_{end}.csv"
header = None
with open(out, "w") as f:
    while d <= last:
        n = min(10, (last - d).days + 1)
        kind = "country" if bbox.isalpha() else "area"
        url = f"https://firms.modaps.eosdis.nasa.gov/api/{kind}/csv/{key}/{src}/{bbox}/{n}/{d}"
        rows = urllib.request.urlopen(url).read().decode().strip().splitlines()
        if rows and rows[0].startswith("latitude"):
            if header is None:
                f.write(rows[0] + "\n"); header = rows[0]
            if len(rows) > 1:
                f.write("\n".join(rows[1:]) + "\n")
        d += timedelta(days=n)
        time.sleep(0.3)
print("Guardado", out)
