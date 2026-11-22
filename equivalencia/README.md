# Red de equivalencia de precios — prueba de concepto (SPEC-00 / SPEC-08)

Comprueba que un motor de cálculo nuevo produce **exactamente** los mismos precios y textos que
`script.js` v5 en producción (SHA-256 0999e7dd7827ea157f049585bcef1cfe7360e3e864881bf1c45f9c28b6a905bc).

## Contenido
- `src/domain/pricing.js` — motor puro (estrategia "v5-round5"), expresiones copiadas literalmente de v5.
- `tests/oracle/legacy-v5.js` — copia byte a byte de `script.js` v5. NO MODIFICAR.
- `tests/golden/golden-master-v5.json` — 1.080 precios unitarios + 3.920 cotizaciones generadas con v5.
- `tests/parity.test.mjs` — 4 pruebas: golden de precios, golden de cotizaciones, diferencial aleatorio contra el oráculo, barrido exhaustivo del descuento (540.090 casos).
- `tools/generate-golden.cjs` — regenera el golden master desde una carpeta con index.html + script.js.

## Uso
    npm install
    npm test                    # ~3 s
    CASES=100000 npm test       # más casos aleatorios
    SEED=123 npm test           # otra semilla

Para regenerar el golden master (solo con aprobación del negocio):
    node tools/generate-golden.cjs <carpeta con index.html y script.js> tests/golden/golden-master-v5.json
