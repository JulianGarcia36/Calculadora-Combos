// Interfaz de la versión 6. Recibe todo por parámetro (ventana, catálogo, almacenamiento)
// para poder probarse en jsdom igual que en el navegador.
import * as pricing from '../domain/pricing.js';
import { validatePromo } from '../domain/discounts.js';
import { emptyState, normalizeState, toV5Compatible, fingerprint, newId, MAX_HISTORY, MAX_DEVICES } from '../state/schema.js';
import { migrateV5, reportHasNews } from '../state/migrate.js';
import { KEY_V6, KEY_V5 } from '../adapters/storage.js';
import { copyText } from '../adapters/clipboard.js';
import { buildBackup, downloadJson, localDate, parseBackup } from '../adapters/backup.js';
import { html, setHTML } from './html.js';
import { Icon, PlatformCard, PriceChip, DurationRow, TotalHighlight, Notification, ListRow } from './components.js';

export function createApp({ win, root, catalog, storage, version, legacyUrl = null, moveTo = null, logoutUrl = null, now = () => new Date() }) {
  const doc = win.document;
  const P = catalog.platforms;
  const MAX = catalog.maxDiscountPct;
  let state = emptyState(now());
  let notices = [];            // {id, kind, title, body(SafeHTML), actions:[{id,label}]}
  let search = '';
  const openPrices = new Set();
  let lastCopyFailed = false;
  // Estado solo visual (no se guarda con los datos de cotización).
  let view = 'calc';             // calc | combos | historial | datos
  let highlight = null;          // duración destacada como "Total a pagar"
  let sheetOpen = false;         // resumen desplegado en móvil
  let theme = storage.readTheme ? (storage.readTheme() || 'dark') : 'dark';

  // ---------- Persistencia ----------
  function persist() {
    state.meta.lastCatalogVersion = catalog.catalogVersion;
    const ok6 = storage.writeV6(state);
    const ok5 = storage.writeV5(toV5Compatible(state, catalog));
    if (!ok6 || !ok5) addNotice({ id: 'save-failed', kind: 'error', title: 'No se pudo guardar en este navegador', body: html`Los cambios funcionan mientras la página esté abierta, pero se perderán al cerrarla. Exporta un respaldo.` });
    else removeNotice('save-failed');
  }

  function migrationNotice(report, origin) {
    const items = [];
    if (report.priceEdits.length) items.push(html`<li>Precios distintos a los oficiales que ya no se usan: ${report.priceEdits.map((e, i) => html`${i ? ', ' : ''}<strong>${e.name}</strong> (${e.diffs.map(d => `${d.d} m: ${d.local === null ? '—' : pricing.fmt(d.local)} → ${d.official === null ? '—' : pricing.fmt(d.official)}`).join('; ')})`)}. Desde ahora los precios los define el administrador.</li>`);
    if (report.customPlatforms.length) items.push(html`<li>Plataformas propias que no están en el catálogo oficial: <strong>${report.customPlatforms.join(', ')}</strong>. Pídele al administrador que las agregue si las sigues vendiendo.</li>`);
    if (report.promoRemoved !== null) items.push(html`<li>Tu descuento guardado de ${report.promoRemoved} % supera el máximo de ${MAX} % y se quitó.</li>`);
    report.combosChanged.forEach(c => items.push(html`<li>Combo «${c.name}»: ${c.notes.join(', ')}.</li>`));
    if (report.combosRemoved.length) items.push(html`<li>Combos que solo tenían plataformas propias y se quitaron: ${report.combosRemoved.join(', ')}.</li>`);
    if (report.removedSeeds) items.push(html`<li>Se quitaron ${report.removedSeeds} combos de ejemplo.</li>`);
    addNotice({
      id: 'migration', kind: reportHasNews(report) ? 'warn' : 'info',
      title: origin === 'import' ? 'Respaldo importado' : 'La calculadora se actualizó a la versión 6',
      body: html`Se conservaron tus combos guardados y ${report.historyKept === 1 ? '1 cotización' : report.historyKept + ' cotizaciones'} del historial.${items.length ? html`<ul>${items}</ul>` : ''}`,
      actions: [{ id: 'dismiss:migration', label: 'Entendido' }]
    });
  }

  // ---------- Arranque ----------
  function load() {
    const r6 = storage.readV6();
    const r5 = storage.readV5();
    if (r6.ok && r6.value) {
      const n = normalizeState(r6.value, catalog, MAX);
      state = n.state;
      n.warnings.forEach((w, i) => addNotice({ id: 'warn-' + i, kind: 'warn', title: 'Aviso', body: html`${w}` }));
      if (r5.ok && r5.value) {
        const m = migrateV5(r5.value, catalog, MAX, now());
        if (fingerprint(m.state) !== fingerprint(state)) {
          addNotice({ id: 'v5-newer', kind: 'warn', title: 'Hay cambios hechos en la versión anterior', body: html`Usaste la versión anterior después de esta. ¿Quieres traer su selección, combos e historial? Lo que tienes aquí se reemplazará.`, actions: [{ id: 'adopt-v5', label: 'Traer datos de la versión anterior' }, { id: 'dismiss:v5-newer', label: 'Mantener los de aquí' }] });
        }
      }
      return;
    }
    if (!r6.ok) {
      const key = storage.backupRaw(KEY_V6, r6.raw, 'danado-' + localDate(now()));
      addNotice({ id: 'v6-corrupt', kind: 'error', title: 'Los datos de la versión 6 estaban dañados', body: html`Se guardó una copia${key ? html` en <code>${key}</code>` : ''} y se recuperaron los datos de la versión anterior si existían.` });
    }
    if (r5.ok && r5.value) {
      storage.backupRaw(KEY_V5, r5.raw, localDate(now()));
      const m = migrateV5(r5.value, catalog, MAX, now());
      state = m.state;
      migrationNotice(m.report, 'auto');
      persist();
      return;
    }
    if (!r5.ok) {
      const key = storage.backupRaw(KEY_V5, r5.raw, 'danado-' + localDate(now()));
      addNotice({ id: 'v5-corrupt', kind: 'error', title: 'Los datos guardados estaban dañados', body: html`La calculadora empezó de cero. Se guardó una copia de los datos dañados${key ? html` en <code>${key}</code>` : ''}.` });
    }
    state = emptyState(now());
    persist();
  }

  // ---------- Avisos ----------
  function addNotice(n) { notices = notices.filter(x => x.id !== n.id).concat(n); renderNotices(); }
  function removeNotice(id) { const before = notices.length; notices = notices.filter(x => x.id !== id); if (notices.length !== before) renderNotices(); }

  function toast(msg) {
    const t = doc.getElementById('toast');
    if (!t) return;
    t.textContent = msg || 'Copiado ✓';
    t.classList.add('show');
    win.setTimeout(() => t.classList.remove('show'), 1400);
  }

  // ---------- Datos derivados ----------
  const sel = id => state.selection[id] || (state.selection[id] = { selected: false, devices: P.find(p => p.id === id).baseDevices });
  const currentQuote = () => pricing.quote(P, state.selection, state.promo.pct);

  function devicesTag(items) {
    if (items.length === 0) return '';
    const qtys = items.map(it => (state.selection[it.id] && state.selection[it.id].devices) || it.baseDevices);
    const devices = pricing.deviceLabel(items, state.selection);
    if (items.length === 1) return `${devices} ${pricing.deviceWord(items[0], devices)}`;
    if (qtys.every(q => q === qtys[0]) && qtys[0] === 1) return '1 Dispositivo';
    return '';
  }

  // ---------- Estructura fija ----------
  function applyTheme() {
    doc.documentElement.dataset.theme = theme;
    const btn = doc.getElementById('themeToggle');
    if (!btn) return;
    const dark = theme === 'dark';
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    btn.setAttribute('aria-label', dark ? 'Cambiar a modo día' : 'Cambiar a modo noche');
    setHTML(btn, html`${dark ? Icon.sun() : Icon.moon()}<span class="theme-text">${dark ? 'Modo día' : 'Modo noche'}</span>`);
  }

  const NAV = [
    { id: 'calc', label: 'Calculadora', icon: Icon.calc },
    { id: 'combos', label: 'Combos guardados', icon: Icon.bookmark, count: () => state.savedCombos.length },
    { id: 'historial', label: 'Historial', icon: Icon.clock, count: () => state.history.length },
    { id: 'datos', label: 'Datos y respaldo', icon: Icon.download }
  ];

  function layout() {
    setHTML(root, html`
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">A</div>
          <div class="brand-text"><div class="brand-name">ARCAVERSE</div><div class="brand-sub">COMBO STUDIO</div></div>
        </div>
        <div class="topbar-actions">
          <button type="button" class="pill-btn" id="themeToggle" data-act="theme"></button>
          <div class="user-chip"><span class="user-avatar">${Icon.user()}</span><span>Vendedor</span></div>
          ${logoutUrl ? html`<a class="ghost-link" href="${logoutUrl}">${Icon.logout()}<span>Salir</span></a>` : ''}
        </div>
      </header>

      <div class="shell">
        <nav class="sidenav" aria-label="Secciones" id="sidenav"></nav>

        <main class="workspace">
          <div class="notices" id="notices" aria-live="polite"></div>

          <section class="view" id="view-calc">
            <div class="page-head"><h1>Crear combo</h1><p>Marca las plataformas, ajusta dispositivos y copia la cotización.</p></div>
            <div class="calc-grid">
              <div class="calc-config">
                <section class="panel">
                  <div class="panel-head"><h2>01. Plataformas</h2><span class="count-chip" id="selCount"></span></div>
                  <label class="search-field" for="searchInput">
                    ${Icon.search()}
                    <span class="sr-only">Buscar plataforma</span>
                    <input type="text" id="searchInput" class="search-input" placeholder="Buscar plataforma..." autocomplete="off">
                  </label>
                  <div id="platformList" class="pgrid"></div>
                </section>

                <section class="panel">
                  <div class="panel-head"><h2>02. Promoción del día</h2></div>
                  <div class="promo-row">
                    <label for="promoInput">Descuento extra</label>
                    <div class="promo-field">
                      <input type="number" id="promoInput" min="0" max="${MAX}" step="any" inputmode="decimal" aria-describedby="promoError promoHelp">
                      <span class="muted-pct" aria-hidden="true">%</span>
                    </div>
                  </div>
                  <div class="field-error" id="promoError" role="alert"></div>
                  <p class="footnote" id="promoHelp">Se aplica sobre el total ya calculado de cada duración, solo para esta cotización.</p>
                </section>
              </div>

              <aside class="summary" id="summary" aria-label="Resumen de cotización">
                <button type="button" class="sum-bar" data-act="sheet" aria-expanded="false" aria-controls="sumBody" id="sumBar"></button>
                <div class="sum-body" id="sumBody">
                  <div class="sum-head">
                    <h2>03. Resumen de cotización</h2>
                    <button type="button" class="icon-btn sum-close" data-act="sheet" aria-label="Cerrar resumen">${Icon.chevronDown()}</button>
                  </div>
                  <div class="ticket-name" id="ticketName"></div>
                  <div class="ticket-sub" id="ticketSub"></div>
                  <div class="ticket-body" id="ticketBody"></div>
                </div>
              </aside>
            </div>
          </section>

          <section class="view" id="view-combos" hidden>
            <div class="page-head"><h1>Combos guardados</h1><p>Guarda el combo que tienes armado y vuelve a usarlo con los precios vigentes.</p></div>
            <section class="panel">
              <div class="save-row">
                <label class="sr-only" for="saveComboName">Nombre del combo</label>
                <input type="text" id="saveComboName" class="text-field" placeholder="Nombre para el combo actual...">
                <button type="button" class="btn" data-act="save-combo">Guardar combo actual</button>
              </div>
              <div class="field-error" id="saveComboError" role="alert"></div>
              <div id="savedCombosList" class="list"></div>
            </section>
          </section>

          <section class="view" id="view-historial" hidden>
            <div class="page-head"><h1>Historial</h1><p>Las últimas ${String(MAX_HISTORY)} cotizaciones que copiaste o enviaste, con el texto exacto.</p></div>
            <section class="panel"><div id="historyList" class="list"></div></section>
          </section>

          <section class="view" id="view-datos" hidden>
            <div class="page-head"><h1>Datos y respaldo</h1><p>Tus combos e historial se guardan solo en este navegador. Exporta un respaldo si vas a cambiar de dispositivo.</p></div>
            <section class="panel">
              <div class="btn-row">
                <button type="button" class="btn" data-act="export">Exportar respaldo</button>
                <button type="button" class="btn secondary" data-act="import">Importar respaldo</button>
                <button type="button" class="btn secondary danger-btn" data-act="reset-all">Restablecer todo</button>
              </div>
              <input type="file" id="importFile" accept=".json,application/json" class="hidden-input">
            </section>
          </section>

          <footer class="app-footer">
            Versión ${version} · Catálogo ${catalog.catalogVersion} (${catalog.updatedAt || ''})${legacyUrl ? html` · <a href="${legacyUrl}">Usar la versión anterior</a>` : ''}
          </footer>
        </main>
      </div>`);
    applyTheme();
  }

  // ---------- Renderizado por partes ----------
  function renderNav() {
    const el = doc.getElementById('sidenav');
    setHTML(el, html`${NAV.map(n => html`
      <button type="button" class="nav-item ${view === n.id ? 'active' : ''}" data-act="nav" data-view="${n.id}" ${view === n.id ? html`aria-current="page"` : ''}>
        ${n.icon()}<span class="nav-label">${n.label}</span>${n.count ? html`<span class="nav-count">${String(n.count())}</span>` : ''}
      </button>`)}`);
    for (const n of NAV) {
      const sec = doc.getElementById('view-' + n.id);
      if (sec) { if (n.id === view) sec.removeAttribute('hidden'); else sec.setAttribute('hidden', ''); }
    }
  }

  function renderNotices() {
    const el = doc.getElementById('notices');
    if (!el) return;
    setHTML(el, html`${notices.map(n => Notification(n))}`);
  }

  const cardCache = { ids: null, html: [] };
  function renderList() {
    const el = doc.getElementById('platformList');
    const term = search.trim().toLowerCase();
    const list = term ? P.filter(p => p.name.toLowerCase().includes(term) || p.id.toLowerCase().includes(term)) : P;
    const count = P.filter(p => state.selection[p.id] && state.selection[p.id].selected).length;
    doc.getElementById('selCount').textContent = count === 1 ? '1 seleccionada' : `${count} seleccionadas`;
    if (list.length === 0) { setHTML(el, html`<div class="empty-mini">No se encontraron plataformas con ese nombre.</div>`); return; }
    const cards = list.map(p => {
      const s = sel(p.id);
      const durs = pricing.ALL_DURATIONS.filter(d => p.table[d] !== undefined);
      return PlatformCard({
        p, selected: s.selected, devices: s.devices,
        unit: p.id === 'netflix' ? 'Perfiles' : 'Dispositivos',
        from: p.table[1] !== undefined ? `Desde ${pricing.fmt(p.table[1])} / mes` : `Desde ${pricing.fmt(p.table[durs[0]])} / ${pricing.durLabel(durs[0])}`,
        pricesOpen: openPrices.has(p.id),
        priceChips: durs.map(d => PriceChip({ label: pricing.durLabel(d), value: pricing.fmt(p.table[d]) }))
      });
    });
    // Solo se redibujan las tarjetas que cambiaron (más rápido y no pierde el foco del teclado).
    const ids = list.map(p => p.id).join('|');
    if (cardCache.ids !== ids || el.children.length !== cards.length) {
      setHTML(el, html`${cards}`);
      cardCache.ids = ids; cardCache.html = cards.map(String);
      return;
    }
    cards.forEach((c, i) => {
      const str = String(c);
      if (cardCache.html[i] === str) return;
      const holder = doc.createElement('div');
      setHTML(holder, c);
      const fresh = holder.firstElementChild;
      const focusedId = doc.activeElement && el.children[i].contains(doc.activeElement) ? (doc.activeElement.id || null) : null;
      const focusedAct = !focusedId && doc.activeElement && el.children[i].contains(doc.activeElement) ? doc.activeElement.dataset.act : null;
      el.replaceChild(fresh, el.children[i]);
      cardCache.html[i] = str;
      if (focusedId) { const f = doc.getElementById(focusedId); f && f.focus(); }
      else if (focusedAct) { const f = fresh.querySelector(`[data-act="${focusedAct}"]`); f && f.focus(); }
    });
  }

  function renderPromo() {
    const input = doc.getElementById('promoInput');
    if (doc.activeElement !== input) input.value = state.promo.pct ? String(state.promo.pct) : '0';
  }

  function renderTicket() {
    const items = pricing.selectedItems(P, state.selection);
    const nameEl = doc.getElementById('ticketName');
    const subEl = doc.getElementById('ticketSub');
    const bodyEl = doc.getElementById('ticketBody');
    const bar = doc.getElementById('sumBar');
    const summary = doc.getElementById('summary');
    summary.classList.toggle('open', sheetOpen);
    bar.setAttribute('aria-expanded', sheetOpen ? 'true' : 'false');
    if (items.length === 0) {
      nameEl.textContent = 'Selecciona al menos una plataforma';
      subEl.textContent = '';
      setHTML(bodyEl, html`<div class="empty-state">El combo aparecerá aquí con sus precios reales por duración.</div>`);
      setHTML(bar, html`<span class="sum-bar-empty">Marca plataformas para ver el total</span>`);
      return;
    }
    const q = currentQuote();
    const promo = state.promo.pct;
    const hasPromo = promo > 0;
    nameEl.textContent = q.name;
    subEl.textContent = hasPromo ? `Promo activa: -${promo}%` : 'Sin promoción activa';
    const tag = devicesTag(items);
    const wa = 'https://wa.me/?text=' + encodeURIComponent(q.text);
    const hl = q.rows.find(r => r.d === highlight) || q.rows[0];
    setHTML(bar, hl ? html`
      <span class="sum-bar-main">
        <span class="sum-bar-label">Total · ${pricing.durLabel(hl.d)}${hasPromo ? ` · promo −${promo} %` : ''}</span>
        <span class="sum-bar-price"><span class="sum-bar-final">${pricing.fmt(hl.final)}</span>${hasPromo ? html`<span class="total-orig">${pricing.fmt(hl.base)}</span>` : ''}</span>
      </span>
      <span class="sum-bar-toggle">${sheetOpen ? 'Ocultar' : 'Ver resumen'} ${sheetOpen ? Icon.chevronDown() : Icon.chevronUp()}</span>` : html`<span class="sum-bar-empty">Sin duraciones en común</span>`);
    setHTML(bodyEl, html`
      ${q.rows.length === 0 ? html`<div class="notice warn">Estas plataformas no comparten ninguna duración: ${items.filter(it => Object.keys(it.table).length === 1).map(it => it.name).join(', ') || 'revisa la selección'} limita el combo.</div>` : ''}
      ${hl ? TotalHighlight({ label: pricing.durLabel(hl.d), final: pricing.fmt(hl.final), base: pricing.fmt(hl.base), hasPromo, promo }) : ''}
      ${q.rows.length ? html`<div class="rows-label">Todas las duraciones (van en el mensaje)</div>` : ''}
      <div class="rows">${q.rows.map(r => DurationRow({ d: r.d, label: pricing.durLabel(r.d), base: pricing.fmt(r.base), final: pricing.fmt(r.final), hasPromo, active: hl && r.d === hl.d }))}</div>
      ${tag ? html`<div class="devices-tag">${tag}</div>` : ''}
      <details class="msg-box" open>
        <summary>Mensaje para el cliente</summary>
        <div class="copy-block"><pre id="copyText">${q.text}</pre></div>
      </details>
      <div class="copy-help" id="copyHelp">${lastCopyFailed ? 'No se pudo copiar automáticamente: selecciona el texto de arriba y cópialo manualmente.' : ''}</div>
      <div class="actions">
        <button type="button" class="btn primary-lg" data-act="copy">${Icon.copy()}<span>Copiar cotización</span></button>
        <a class="btn wa-btn" id="waLink" data-act="whatsapp" href="${wa}" target="_blank" rel="noopener noreferrer">${Icon.chat()}<span>Compartir por WhatsApp</span></a>
        <div class="actions-row">
          <button type="button" class="btn secondary" data-act="quick-save">Guardar combo</button>
          <button type="button" class="btn secondary" data-act="clear">Limpiar</button>
        </div>
      </div>`);
  }

  function renderCombos() {
    const el = doc.getElementById('savedCombosList');
    if (state.savedCombos.length === 0) { setHTML(el, html`<div class="empty-mini">Aún no has guardado ningún combo.</div>`); return; }
    setHTML(el, html`${state.savedCombos.map(c => ListRow({
      title: c.name,
      sub: c.promoPct > 0 ? 'Promo -' + c.promoPct + '%' : 'Sin promo',
      actions: html`<button type="button" class="btn small secondary" data-act="use-combo" data-id="${c.id}">Usar</button>
        <button type="button" class="icon-btn danger" data-act="del-combo" data-id="${c.id}" aria-label="Eliminar combo ${c.name}" title="Eliminar">✕</button>`
    }))}`);
  }

  function renderHistory() {
    const el = doc.getElementById('historyList');
    if (state.history.length === 0) { setHTML(el, html`<div class="empty-mini">Las cotizaciones que copies quedarán aquí.</div>`); return; }
    setHTML(el, html`${state.history.map(h => ListRow({
      title: h.name, sub: h.ts,
      actions: html`<button type="button" class="btn small secondary" data-act="copy-hist" data-id="${h.id}">Copiar</button>
        <button type="button" class="icon-btn danger" data-act="del-hist" data-id="${h.id}" aria-label="Eliminar del historial" title="Eliminar">✕</button>`
    }))}`);
  }

  function renderAll() { renderNav(); renderNotices(); renderList(); renderPromo(); renderTicket(); renderCombos(); renderHistory(); }
  const afterChange = () => { persist(); renderList(); renderPromo(); renderTicket(); };

  // ---------- Acciones ----------
  function setPromo(value) {
    const prev = state.promo.pct;
    state.promo = { pct: value, setAt: value > 0 ? (prev === value && state.promo.setAt ? state.promo.setAt : now().toISOString()) : null };
  }

  function addHistory(q) {
    const d = now();
    state.history.unshift({ id: newId('hist'), ts: d.toLocaleString('es-CO'), isoTs: d.toISOString(), name: q.name, text: q.text });
    if (state.history.length > MAX_HISTORY) state.history = state.history.slice(0, MAX_HISTORY);
  }

  async function onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t || !root.contains(t)) return;
    const act = t.dataset.act, id = t.dataset.id;
    if (act.startsWith('dismiss:')) { removeNotice(act.slice(8)); return; }
    switch (act) {
      case 'theme': theme = theme === 'dark' ? 'light' : 'dark'; if (storage.writeTheme) storage.writeTheme(theme); applyTheme(); break;
      case 'nav': view = t.dataset.view; sheetOpen = false; renderNav(); renderTicket(); win.scrollTo && win.scrollTo(0, 0); break;
      case 'highlight': highlight = Number(t.dataset.d); renderTicket(); break;
      case 'sheet': sheetOpen = !sheetOpen; renderTicket(); break;
      case 'quick-save': view = 'combos'; renderNav(); { const inp = doc.getElementById('saveComboName'); inp && inp.focus && inp.focus(); } break;
      case 'inc': case 'dec': {
        const s = sel(id);
        s.devices = act === 'inc' ? Math.min(s.devices + 1, MAX_DEVICES) : Math.max(s.devices - 1, 1);
        afterChange(); break;
      }
      case 'prices': openPrices.has(id) ? openPrices.delete(id) : openPrices.add(id); renderList(); break;
      case 'copy': {
        e.preventDefault();
        const q = currentQuote();
        const ok = await copyText(win, q.text);
        lastCopyFailed = !ok;
        if (ok) { addHistory(q); persist(); toast('Cotización copiada ✓'); renderHistory(); renderNav(); }
        renderTicket();
        if (!ok) selectCopyText();
        break;
      }
      case 'whatsapp': { const q = currentQuote(); addHistory(q); persist(); renderHistory(); renderNav(); toast('Abriendo WhatsApp…'); break; }
      case 'clear':
        Object.keys(state.selection).forEach(k => { state.selection[k].selected = false; });
        setPromo(0); afterChange(); break;
      case 'save-combo': {
        const items = pricing.selectedItems(P, state.selection);
        const err = doc.getElementById('saveComboError');
        if (items.length === 0) { err.textContent = 'Marca al menos una plataforma para guardar un combo.'; break; }
        err.textContent = '';
        const input = doc.getElementById('saveComboName');
        const name = input.value.trim() || pricing.comboName(items, state.selection);
        state.savedCombos.unshift({ id: newId('combo'), name, selection: JSON.parse(JSON.stringify(state.selection)), promoPct: state.promo.pct });
        input.value = '';
        persist(); renderCombos(); renderNav(); toast('Combo guardado ✓'); break;
      }
      case 'use-combo': {
        const c = state.savedCombos.find(x => x.id === id);
        if (!c) break;
        state.selection = JSON.parse(JSON.stringify(c.selection));
        setPromo(c.promoPct || 0);
        afterChange(); break;
      }
      case 'del-combo': {
        const c = state.savedCombos.find(x => x.id === id);
        if (!c || !win.confirm(`¿Eliminar el combo guardado "${c.name}"?`)) break;
        state.savedCombos = state.savedCombos.filter(x => x.id !== id);
        persist(); renderCombos(); renderNav(); break;
      }
      case 'copy-hist': {
        const h = state.history.find(x => x.id === id);
        if (h && await copyText(win, h.text)) toast('Copiado ✓');
        else if (h) toast('No se pudo copiar');
        break;
      }
      case 'del-hist':
        if (!win.confirm('¿Eliminar esta cotización del historial?')) break;
        state.history = state.history.filter(x => x.id !== id);
        persist(); renderHistory(); renderNav(); break;
      case 'export':
        downloadJson(win, buildBackup(state, catalog, now()), `respaldo-combos-${localDate(now())}.json`);
        toast('Respaldo descargado ✓'); break;
      case 'import': doc.getElementById('importFile').click(); break;
      case 'reset-all':
        if (!win.confirm('¿Seguro que quieres borrar los combos, el historial y la selección de este navegador? Esta acción no se puede deshacer.')) break;
        state = emptyState(now()); persist(); renderAll(); break;
      case 'adopt-v5': {
        const r5 = storage.readV5();
        if (r5.ok && r5.value) {
          storage.backupRaw(KEY_V6, JSON.stringify(state), 'antes-de-traer-' + localDate(now()) + '-' + now().getTime());
          const m = migrateV5(r5.value, catalog, MAX, now());
          state = m.state; persist(); removeNotice('v5-newer'); migrationNotice(m.report, 'auto'); renderAll();
        }
        break;
      }
    }
  }

  function selectCopyText() {
    const pre = doc.getElementById('copyText');
    if (!pre || !win.getSelection) return;
    try { const r = doc.createRange(); r.selectNodeContents(pre); const s = win.getSelection(); s.removeAllRanges(); s.addRange(r); } catch { /* sin acción */ }
  }

  function onChange(e) {
    const t = e.target;
    if (t.matches('input[type=checkbox][data-id]')) {
      sel(t.dataset.id).selected = t.checked;
      afterChange();
    } else if (t.id === 'importFile') {
      const file = t.files && t.files[0];
      t.value = '';
      if (file) readImport(file);
    }
  }

  function readImport(file) {
    const reader = new win.FileReader();
    reader.onload = () => importText(String(reader.result));
    reader.readAsText(file);
  }

  /** Importa el contenido de un archivo de respaldo (v5 o v6). Expuesto para pruebas. */
  function importText(text) {
    const parsed = parseBackup(text);
    if (parsed.kind === 'invalid') { addNotice({ id: 'import-error', kind: 'error', title: 'No se pudo importar', body: html`${parsed.error} Tus datos actuales no cambiaron.`, actions: [{ id: 'dismiss:import-error', label: 'Cerrar' }] }); return false; }
    if (!win.confirm('Importar reemplazará los combos, el historial y la selección de este navegador. ¿Continuar?')) return false;
    storage.backupRaw(KEY_V6, JSON.stringify(state), 'antes-de-importar-' + localDate(now()) + '-' + now().getTime());
    if (parsed.kind === 'v6') {
      const n = normalizeState(parsed.state, catalog, MAX);
      state = n.state;
      addNotice({ id: 'migration', kind: n.warnings.length ? 'warn' : 'info', title: 'Respaldo importado', body: n.warnings.length ? html`<ul>${n.warnings.map(w => html`<li>${w}</li>`)}</ul>` : html`Todo se importó correctamente.`, actions: [{ id: 'dismiss:migration', label: 'Entendido' }] });
    } else {
      const m = migrateV5(parsed.data, catalog, MAX, now());
      state = m.state;
      migrationNotice(m.report, 'import');
    }
    removeNotice('import-error');
    persist(); renderAll(); toast('Respaldo importado ✓');
    return true;
  }

  function onInput(e) {
    const t = e.target;
    if (t.id === 'searchInput') { search = t.value; renderList(); }
    else if (t.id === 'promoInput') {
      const v = validatePromo(t.value, MAX);
      const err = doc.getElementById('promoError');
      if (v.ok) { err.textContent = ''; t.removeAttribute('aria-invalid'); setPromo(v.value); persist(); renderPromo(); renderTicket(); }
      else { err.textContent = v.error + ' La cotización sigue con ' + state.promo.pct + ' %.'; t.setAttribute('aria-invalid', 'true'); }
    }
  }

  function onFocusOut(e) {
    if (e.target.id === 'promoInput' && e.target.getAttribute('aria-invalid') === 'true') {
      e.target.value = String(state.promo.pct);
      e.target.removeAttribute('aria-invalid');
      doc.getElementById('promoError').textContent = '';
    }
  }

  // ---------- Inicio ----------
  layout();
  load();
  if (moveTo) {
    addNotice({
      id: 'mudanza', kind: 'warn', title: 'La calculadora cambió de dirección',
      body: html`Para llevar tus combos e historial: <strong>1.</strong> pulsa «Exportar respaldo» aquí; <strong>2.</strong> abre <a href="${moveTo}" target="_blank" rel="noopener">${moveTo}</a> y entra con la clave; <strong>3.</strong> allá pulsa «Importar respaldo» y elige el archivo descargado.`,
      actions: [{ id: 'export', label: 'Exportar respaldo' }]
    });
  }
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
  root.addEventListener('focusout', onFocusOut);
  storage.onExternalChange(() => {
    const r6 = storage.readV6();
    if (r6.ok && r6.value) { state = normalizeState(r6.value, catalog, MAX).state; renderAll(); }
  });
  renderAll();

  return { getState: () => state, importText, quote: currentQuote };
}
