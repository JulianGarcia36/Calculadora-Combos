// Aviso de la versión anterior: si el catálogo oficial cambió después de congelar esta versión,
// sus precios ya no son los vigentes y se advierte en rojo.
(function () {
  var CATALOGO_CONGELADO = '2026.11.22-1';
  var css = document.createElement('style');
  css.textContent = '.legacy-banner{background:#3a2a00;color:#FFB020;border:1px solid rgba(255,176,32,.45);border-radius:10px;padding:10px 14px;margin:0 4px 14px;font:13px Inter,sans-serif}.legacy-banner a{color:#9D90F0}.legacy-banner.stale{background:#3a0f12;color:#FF6B6B;border-color:rgba(255,107,107,.5)}';
  document.head.appendChild(css);
  fetch('../catalog/catalog.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (c) {
    if (c && c.catalogVersion !== CATALOGO_CONGELADO) {
      var b = document.getElementById('legacyBanner');
      b.className = 'legacy-banner stale';
      b.innerHTML = '<strong>Precios desactualizados:</strong> el administrador cambió precios después de esta versión. No envíes cotizaciones desde aquí. <a href="../">Ir a la versión nueva</a>';
    }
  }).catch(function () {});
})();
