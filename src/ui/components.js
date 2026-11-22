// Componentes visuales de Combo Studio. Solo presentación: reciben datos ya calculados
// y devuelven HTML escapado. No calculan precios ni tocan el estado.
import { html } from './html.js';

const svg = (paths, size = 18) => html`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

export const Icon = {
  calc: () => svg(html`<rect x="4" y="2" width="16" height="20" rx="2"></rect><path d="M8 6h8"></path><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"></path>`),
  bookmark: () => svg(html`<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>`),
  clock: () => svg(html`<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>`),
  download: () => svg(html`<path d="M12 3v12"></path><path d="M7 10l5 5 5-5"></path><path d="M5 21h14"></path>`),
  user: () => svg(html`<circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path>`, 16),
  logout: () => svg(html`<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="M16 17l5-5-5-5"></path><path d="M21 12H9"></path>`, 16),
  search: () => svg(html`<circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path>`, 16),
  check: () => svg(html`<path d="M5 12l5 5L20 7"></path>`, 12),
  copy: () => svg(html`<rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15V5a2 2 0 0 1 2-2h10"></path>`),
  chat: () => svg(html`<path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z"></path>`),
  sun: () => svg(html`<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>`, 16),
  moon: () => svg(html`<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path>`, 16),
  alert: () => svg(html`<circle cx="12" cy="12" r="9"></circle><path d="M12 8v5"></path><path d="M12 16h.01"></path>`, 14),
  chevronUp: () => svg(html`<path d="M6 15l6-6 6 6"></path>`, 16),
  chevronDown: () => svg(html`<path d="M6 9l6 6 6-6"></path>`, 16),
  tag: () => svg(html`<path d="M20.6 13.4L13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"></path><circle cx="7.5" cy="7.5" r="1.5"></circle>`, 16)
};

/** Tarjeta de plataforma. La casilla real (input checkbox) queda dentro de la etiqueta: accesible y probada. */
export function PlatformCard({ p, selected, devices, unit, from, pricesOpen, priceChips }) {
  const mono = p.id.slice(0, 2).toUpperCase();
  return html`
  <div class="item pcard ${selected ? 'checked' : ''}">
    <label class="pcard-main" for="chk-${p.id}">
      <input type="checkbox" class="sr-only pcard-check" id="chk-${p.id}" data-id="${p.id}" ${selected ? html`checked` : ''}>
      <span class="pcard-top">
        <span class="pcard-mono" aria-hidden="true">${mono}</span>
        <span class="pcard-tick" aria-hidden="true">${Icon.check()}</span>
      </span>
      <span class="pcard-name item-name">${p.name}</span>
      <span class="pcard-meta"><span class="pcard-from">${from}</span>${p.badge ? html`<span class="badge">${p.badge}</span>` : ''}</span>
    </label>
    <div class="pcard-foot">
      <div class="stepper" ${selected ? '' : html`hidden`}>
        <span class="stepper-label">${unit}</span>
        <div class="stepper-ctrl">
          <button type="button" data-act="dec" data-id="${p.id}" aria-label="Quitar uno a ${p.name}">−</button>
          <span class="stepper-value" aria-label="${unit}">${devices}</span>
          <button type="button" data-act="inc" data-id="${p.id}" aria-label="Agregar uno a ${p.name}">+</button>
        </div>
      </div>
      <button type="button" class="link-btn" data-act="prices" data-id="${p.id}" aria-expanded="${pricesOpen ? 'true' : 'false'}">${pricesOpen ? 'Ocultar precios' : 'Ver precios'}</button>
    </div>
    <div class="edit-panel ${pricesOpen ? 'open' : ''}">${priceChips}</div>
  </div>`;
}

export function PriceChip({ label, value }) {
  return html`<div class="price-chip"><span>${label}</span><strong>${value}</strong></div>`;
}

/** Fila de duración del resumen; al tocarla se destaca su precio como "Total a pagar". */
export function DurationRow({ d, label, base, final, hasPromo, active }) {
  return html`
  <button type="button" class="row-line ${active ? 'active' : ''}" data-act="highlight" data-d="${d}" aria-pressed="${active ? 'true' : 'false'}">
    <span class="dur">${label}</span>
    <span class="price-cell">${hasPromo ? html`<span class="orig">${base}</span>` : ''}<span class="final ${hasPromo ? 'discounted' : ''}">${final}</span></span>
  </button>`;
}

export function TotalHighlight({ label, final, base, hasPromo, promo }) {
  return html`
  <div class="total-box">
    <div class="total-label">Total a pagar · ${label}</div>
    <div class="total-row"><span class="total-final">${final}</span>${hasPromo ? html`<span class="total-orig">${base}</span>` : ''}</div>
    ${hasPromo ? html`<div class="total-promo">Promoción −${promo} % aplicada</div>` : ''}
  </div>`;
}

export function Notification({ id, kind, title, body, actions }) {
  return html`
  <div class="notice ${kind === 'warn' ? 'warn' : kind === 'error' ? 'error' : ''}" data-notice="${id}" ${kind === 'error' ? html`role="alert"` : ''}>
    <div class="notice-title">${title}</div>
    <div>${body}</div>
    ${actions && actions.length ? html`<div class="btn-row">${actions.map((a, i) => html`<button type="button" class="btn small ${i ? 'secondary' : ''}" data-act="${a.id}">${a.label}</button>`)}</div>` : ''}
  </div>`;
}

export function ListRow({ title, sub, actions }) {
  return html`
  <div class="list-row">
    <div class="list-main"><div class="list-title">${title}</div><div class="list-sub">${sub}</div></div>
    ${actions}
  </div>`;
}
