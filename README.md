# Calculadora de Combos

Herramienta interna para armar y cotizar combos de plataformas, generar el texto de cotización para el cliente y llevar combos guardados e historial.

## Versiones publicadas

| Dirección | Versión | Para qué |
| --- | --- | --- |
| `/` (raíz) | 6 (`index.html` + `src/` + `catalog/` + `assets/`) | La calculadora que usan los vendedores |
| `/legacy/` | 5, congelada | Solo para volver atrás si la nueva falla. Muestra un aviso, y si el catálogo cambia advierte en rojo que sus precios están desactualizados |
| `/v6/` | — | Redirige a la raíz (enlaces del piloto) |

La versión 6 trae automáticamente los datos de la versión 5 la primera vez que se abre (combos, historial y selección) y sigue escribiendo una copia compatible, así que `/legacy/` muestra los mismos datos.

## Reglas comerciales (decididas el 22 nov 2026)
- Los precios los define solo el administrador en `catalog/catalog.json` (los vendedores no pueden editarlos).
- El vendedor escribe el descuento a mano, igual que en la versión 5; máximo **25 %**.
- El redondeo al múltiplo de 5 y el texto para el cliente son idénticos a la versión 5 (probado contra miles de casos).

## Cómo cambiar un precio
1. Crea una rama y edita solo `catalog/catalog.json`: el precio, y súbele `catalogVersion` (por ejemplo `2026.12.01-1`) y `updatedAt`.
2. Abre un pull request. En **Checks → Pruebas de precios → Summary** aparece el **Informe de precios** con lo que cambia. Si es lo que querías, haz merge.

Si cambias un precio sin subir `catalogVersion`, las pruebas fallan y te lo dicen. El máximo de 25 % también está en `catalog.json` (`maxDiscountPct`); cambiarlo exige actualizar la prueba que lo fija.

## Acceso privado (Cloudflare Pages)
El sitio se publica en Cloudflare Pages con **una sola clave compartida** para todos los vendedores (no se les pide correo). La pide `functions/_middleware.js` antes de entregar cualquier archivo, incluido el catálogo de precios.

- La clave se guarda en Cloudflare como variable secreta `CLAVE_VENDEDORES` (mínimo 8 caracteres). **Nunca** se escribe en el repositorio.
- Cada vendedor la escribe una vez; el navegador la recuerda 30 días.
- Para quitarle el acceso a alguien: cambia la clave en Cloudflare y comparte la nueva con los demás. Todos tendrán que volver a escribirla.
- `/salir` cierra la sesión en ese navegador.
- Las carpetas `equivalencia/`, `functions/` y `.github/` no se publican.

Mudanza desde github.io: escribe la dirección nueva en `config/sitio.json` (`"direccionNueva": "https://…pages.dev/"`). La página antigua mostrará a cada vendedor cómo exportar sus datos y abrirlos en la nueva.

## Datos
Combos guardados e historial se guardan solo en el navegador de cada persona. Usa **Exportar respaldo** e **Importar respaldo** para pasarlos a otro navegador. La versión 6 importa respaldos de la versión 5.

## Estructura
- `index.html` — página principal (versión 6)
- `legacy/` — versión 5 congelada (`index.html`, `style.css`, `script.js`, `aviso.js`)
- `v6/index.html` — redirección a la raíz
- `src/domain/` — reglas de cálculo y descuento (sin pantalla ni almacenamiento)
- `src/state/` — formato de los datos y migración desde la versión 5
- `src/adapters/` — almacenamiento, portapapeles y respaldos
- `src/ui/` — pantalla (todo el texto se escapa: sin riesgo de inyección de HTML); `components.js` tiene solo piezas visuales, sin cálculos
- `catalog/catalog.json` — catálogo oficial de precios y descuento máximo
- `assets/app.css` — estilos (modo noche por defecto, modo día con `data-theme="light"`); cambiar colores aquí no toca precios
- `equivalencia/` — pruebas automáticas (ver su README)
- `robots.txt` — evita que buscadores indexen el sitio
