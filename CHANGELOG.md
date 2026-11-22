# Cambios

## 6.0.0-piloto — 22 nov 2026
- Nueva versión en `/v6/` (la raíz sigue en la versión 5).
- Precios oficiales en `catalog/catalog.json`; los vendedores ya no pueden editarlos ni agregar plataformas (DEC-01).
- Descuento máximo 25 % con tramo sugerido por cantidad de plataformas (DEC-02, DEC-03).
- Sin combos de ejemplo (DEC-04). Redondeo y texto al cliente idénticos a la versión 5 (DEC-06).
- Migración automática desde la versión 5 con copia de seguridad e informe; compatibilidad para volver atrás.
- Corrige: inyección de HTML (XSS), página en blanco con datos dañados, descuentos negativos o mayores a 100 %, fallos silenciosos del portapapeles y del guardado, pestañas que se pisaban.
- Nuevo: ver precios de cada plataforma (solo lectura), enviar por WhatsApp, avisos de descuento activo.
- Pruebas que vigilan el `script.js` publicado e informe de precios en cada pull request.
