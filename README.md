# Calculadora de Combos

Herramienta interna para armar y cotizar combos de plataformas, generar el texto de cotización para el cliente y llevar combos guardados e historial.

## Versiones publicadas

| Dirección | Versión | Estado |
| --- | --- | --- |
| `/` (raíz) | 5 (`index.html`, `script.js`, `style.css`) | La que usan hoy los vendedores |
| `/v6/` | 6 (`v6/index.html` + `src/` + `catalog/`) | Piloto. Precios oficiales, descuento máximo 25 %, sin combos de ejemplo |

La versión 6 lee automáticamente los datos de la versión 5 la primera vez que se abre (combos, historial y selección) y sigue escribiendo una copia compatible, así que se puede volver a la versión 5 sin perder nada.

## Reglas comerciales (decididas el 22 nov 2026)
- Los precios los define solo el administrador en `catalog/catalog.json` (los vendedores no pueden editarlos).
- El vendedor escribe el descuento; máximo **25 %**. Tramos sugeridos: 2 plataformas 5 %, 3 = 10 %, 4 = 15 %, 5 = 20 %, 6 o más = 25 %.
- El redondeo al múltiplo de 5 y el texto para el cliente son idénticos a la versión 5 (probado contra miles de casos).

## Cómo cambiar un precio (mientras convivan v5 y v6)
1. Crea una rama y edita **los tres lugares**: `catalog/catalog.json` (sube también `catalogVersion` y `updatedAt`), `DEFAULT_PLATFORMS` en `script.js` y, si es Crunchyroll, Paramount+, Netflix, Spotify o YouTube, el bloque correspondiente al final de `loadState()` en `script.js`.
2. En la carpeta `equivalencia/`: `npm ci` y luego `npm run golden` (registra los precios nuevos como referencia).
3. Abre un pull request. En la pestaña **Checks → Pruebas de precios → Summary** aparece el **Informe de precios** con lo que cambia. Si es lo que querías, haz merge.

Si olvidas uno de los tres lugares, las pruebas fallan y dicen cuál.

## Datos
Combos guardados e historial se guardan solo en el navegador de cada persona. Usa **Exportar respaldo** e **Importar respaldo** para pasarlos a otro navegador. La versión 6 importa respaldos de la versión 5.

## Estructura
- `index.html`, `style.css`, `script.js` — versión 5 (raíz)
- `v6/index.html` — página de la versión 6
- `src/domain/` — reglas de cálculo y descuento (sin pantalla ni almacenamiento)
- `src/state/` — formato de los datos y migración desde la versión 5
- `src/adapters/` — almacenamiento, portapapeles y respaldos
- `src/ui/` — pantalla (todo el texto se escapa: sin riesgo de inyección de HTML)
- `catalog/catalog.json` — catálogo oficial de precios, tramos y descuento máximo
- `assets/app.css` — estilos de la versión 6
- `equivalencia/` — pruebas automáticas (ver su README)
- `robots.txt` — evita que buscadores indexen el sitio
