# Pruebas automáticas

Se ejecutan solas en GitHub Actions en cada pull request (check **equivalencia**). Para correrlas en tu computador: `npm ci` y luego `npm test` (≈ 2 minutos).

| Archivo | Qué protege |
| --- | --- |
| `tests/parity.test.mjs` | El motor `src/domain/pricing.js` calcula exactamente igual que la versión 5 original: golden master (1.080 precios + 3.920 cotizaciones), 20.000 casos aleatorios contra el oráculo y 540.090 combinaciones de descuento |
| `tests/produccion.test.mjs` | Lo publicado: la raíz carga la versión 6 con su CSP, `/legacy/` es la v5 original sin cambios, el catálogo es válido y cada cambio de precios sube `catalogVersion` |
| `tests/v6.test.mjs` | La versión 6 de punta a punta: la pantalla produce el mismo texto que el golden master, reglas DEC-01 a DEC-04, migración desde v5, vuelta a la versión anterior, datos dañados, importación y seguridad |

Otros archivos:
- `tests/oracle/legacy-v5.js` — copia congelada de `script.js` v5 (SHA-256 0999e7dd…). **No modificar.**
- `tests/golden/golden-master-v5.json` — resultados de referencia de las reglas (con precios fijos). **No** se regenera al cambiar precios.
- `tools/informe-precios.mjs` — informe de qué precios cambian en un pull request.
- `tools/generate-golden.cjs` — generador del golden master.

Variables opcionales: `CASES=100000` (más casos aleatorios), `SEED=123` (otra semilla), `CASES_PROD=20000`.
