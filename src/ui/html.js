// Plantilla HTML que escapa por defecto (cierra el riesgo XSS de v5).
// Uso: html`<b>${texto}</b>` — todo valor se escapa salvo que venga de otra plantilla html``.
class SafeHTML { constructor(s) { this.s = s; } toString() { return this.s; } }

export function escapeHTML(v) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function piece(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof SafeHTML) return v.s;
  if (Array.isArray(v)) return v.map(piece).join('');
  return escapeHTML(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += piece(v) + strings[i + 1]; });
  return new SafeHTML(out);
}

export function setHTML(el, safe) {
  if (!(safe instanceof SafeHTML)) throw new Error('setHTML solo acepta plantillas html``');
  el.innerHTML = safe.s;
}
