// Pruebas de la versión 6: equivalencia de precios a través de la interfaz, reglas nuevas (DEC-01 a DEC-07),
// migración desde v5, compatibilidad para volver atrás y seguridad.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootV6, bootV5, fire, click, tick, catalog as officialCatalog, testCatalog as catalog } from './helpers/entornos.mjs';
import { validateCatalog } from '../../src/domain/catalog.js';
import { suggestedDiscount, validatePromo } from '../../src/domain/discounts.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const gm = JSON.parse(fs.readFileSync(path.join(here, 'golden/golden-master-v5.json'), 'utf8'));
const KEY6 = 'calculadora-combos-v6', KEY5 = 'platforms-state-v5';

// ---------- utilidades para manejar la interfaz como un vendedor ----------
function setSelection(env, sel) {
  const { win, doc } = env;
  const clear = doc.querySelector('[data-act="clear"]');
  if (clear) click(win, clear);
  for (const p of catalog.platforms) {
    const target = sel[p.id] || 1;
    let span = () => doc.querySelector(`[data-act="inc"][data-id="${p.id}"]`).parentElement.querySelector('span');
    let guard = 0;
    while (Number(span().textContent) !== target && guard++ < 20) {
      click(win, doc.querySelector(`[data-act="${Number(span().textContent) < target ? 'inc' : 'dec'}"][data-id="${p.id}"]`));
    }
  }
  for (const id of Object.keys(sel)) {
    const cb = doc.querySelector(`input[type=checkbox][data-id="${id}"]`);
    cb.checked = true; fire(win, cb, 'change');
  }
}
function typePromo(env, value) {
  const inp = env.doc.getElementById('promoInput');
  inp.value = String(value);
  fire(env.win, inp, 'input');
}
const copyTextOf = env => env.doc.getElementById('copyText').textContent;

// ---------- catálogo y reglas nuevas ----------
test('catálogo oficial válido, con los tramos y el máximo decididos (DEC-02, DEC-03)', () => {
  assert.deepEqual(validateCatalog(officialCatalog), { ok: true, errors: [] });
  assert.equal(officialCatalog.maxDiscountPct, 25);
  assert.deepEqual(officialCatalog.discountTiers.map(t => [t.minPlatforms, t.pct]), [[2, 5], [3, 10], [4, 15], [5, 20], [6, 25]]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 9].map(n => suggestedDiscount(catalog.discountTiers, n)), [0, 0, 5, 10, 15, 20, 25, 25]);
  assert.deepEqual(validatePromo('25', 25), { ok: true, value: 25 });
  assert.deepEqual(validatePromo('12,5', 25), { ok: true, value: 12.5 });
  assert.deepEqual(validatePromo('', 25), { ok: true, value: 0 });
  assert.equal(validatePromo('26', 25).ok, false);
  assert.equal(validatePromo('-1', 25).ok, false);
});

// ---------- equivalencia de precios a través de la interfaz ----------
test('la interfaz v6 produce exactamente el texto del golden master (todas las cotizaciones con descuento ≤ 25 %)', () => {
  const env = bootV6();
  const cases = gm.quotes.filter(q => q.promo >= 0 && q.promo <= 25);
  assert.ok(cases.length > 3000, `casos: ${cases.length}`);
  let lastSel = null;
  for (const q of cases) {
    const key = JSON.stringify(q.sel);
    if (key !== lastSel) { setSelection(env, q.sel); lastSel = key; }
    typePromo(env, q.promo);
    assert.equal(copyTextOf(env), q.text, `${q.tag} ${key} promo ${q.promo}`);
    const finals = [...env.doc.querySelectorAll('.row-line .final')].map(e => e.textContent);
    assert.deepEqual(finals, q.rows.map(r => '$' + r.final.toLocaleString('es-CO')));
  }
});

test('DEC-01: los vendedores no pueden editar precios ni agregar o borrar plataformas', () => {
  const env = bootV6();
  assert.equal(env.doc.querySelectorAll('input[data-edit-id], [data-reset], [data-remove], #npName, #npAddBtn').length, 0);
  assert.equal(env.doc.querySelectorAll('input[type=number]').length, 1, 'solo el campo de descuento');
  click(env.win, env.doc.querySelector('[data-act="prices"][data-id="netflix"]'));
  const chips = [...env.doc.querySelectorAll('.edit-panel.open .price-chip strong')].map(e => e.textContent);
  assert.deepEqual(chips, ['$80', '$150', '$215', '$415', '$810']);
});

test('DEC-03: un descuento mayor a 25 % se rechaza y la cotización conserva el último válido', () => {
  const env = bootV6();
  setSelection(env, { netflix: 1, disney: 1 });
  typePromo(env, 10);
  const before = copyTextOf(env);
  typePromo(env, 30);
  assert.match(env.doc.getElementById('promoError').textContent, /máximo es 25/);
  assert.equal(env.doc.getElementById('promoInput').getAttribute('aria-invalid'), 'true');
  assert.equal(copyTextOf(env), before);
  fire(env.win, env.doc.getElementById('promoInput'), 'focusout');
  assert.equal(env.doc.getElementById('promoInput').value, '10');
  typePromo(env, -5);
  assert.match(env.doc.getElementById('promoError').textContent, /negativo/);
});

test('DEC-02: la calculadora sugiere el tramo y el vendedor decide si lo aplica', () => {
  const env = bootV6();
  setSelection(env, { netflix: 1, disney: 1, vix: 1 });
  assert.match(env.doc.getElementById('promoHint').textContent, /3 plataformas: 10 %/);
  assert.equal(env.app.getState().promo.pct, 0, 'no se aplica solo');
  click(env.win, env.doc.querySelector('[data-act="apply-tier"]'));
  assert.equal(env.app.getState().promo.pct, 10);
  assert.match(env.doc.getElementById('promoBanner').textContent, /Descuento activo: 10 %/);
  click(env.win, env.doc.querySelector('[data-act="clear-promo"]'));
  assert.equal(env.app.getState().promo.pct, 0);
});

test('DEC-04: la v6 no crea combos de ejemplo', () => {
  const env = bootV6();
  assert.equal(env.app.getState().savedCombos.length, 0);
  assert.match(env.doc.getElementById('savedCombosList').textContent, /Aún no has guardado/);
});

// ---------- combos, historial y portapapeles ----------
test('guardar y usar un combo restaura selección, dispositivos y descuento', async () => {
  const env = bootV6();
  click(env.win, env.doc.querySelector('[data-act="save-combo"]'));
  assert.match(env.doc.getElementById('saveComboError').textContent, /al menos una plataforma/);
  setSelection(env, { netflix: 2, disney: 1 });
  typePromo(env, 5);
  const text = copyTextOf(env);
  env.doc.getElementById('saveComboName').value = 'Mi combo';
  click(env.win, env.doc.querySelector('[data-act="save-combo"]'));
  click(env.win, env.doc.querySelector('[data-act="clear"]'));
  click(env.win, env.doc.querySelector('[data-act="use-combo"]'));
  assert.equal(copyTextOf(env), text);
});

test('copiar guarda el texto exacto en el historial; si el portapapeles falla no se registra y se avisa', async () => {
  const ok = bootV6({}, { clipboard: 'api' });
  setSelection(ok, { spotify: 1 });
  typePromo(ok, 25);
  click(ok.win, ok.doc.querySelector('[data-act="copy"]'));
  await tick();
  assert.equal(ok.win.__clip, copyTextOf(ok));
  assert.equal(ok.app.getState().history[0].text, copyTextOf(ok));

  const fallback = bootV6({}, { clipboard: 'exec-ok' });
  setSelection(fallback, { spotify: 1 });
  click(fallback.win, fallback.doc.querySelector('[data-act="copy"]'));
  await tick();
  assert.equal(fallback.app.getState().history.length, 1);

  const none = bootV6({}, { clipboard: 'none' });
  setSelection(none, { spotify: 1 });
  click(none.win, none.doc.querySelector('[data-act="copy"]'));
  await tick();
  assert.equal(none.app.getState().history.length, 0);
  assert.match(none.doc.getElementById('copyHelp').textContent, /cópialo manualmente/);
});

test('el enlace de WhatsApp lleva exactamente el texto de la cotización', () => {
  const env = bootV6();
  setSelection(env, { netflix: 1, youtube: 1 });
  const href = env.doc.getElementById('waLink').getAttribute('href');
  assert.equal(decodeURIComponent(href.replace('https://wa.me/?text=', '')), copyTextOf(env));
});

test('aviso cuando las plataformas no comparten duraciones', () => {
  const env = bootV6();
  setSelection(env, { youtube: 1, iptv: 1 });
  assert.equal(env.doc.querySelectorAll('.row-line').length, 1, 'YouTube + IPTV comparten 1 mes');
});

// ---------- migración desde v5 ----------
function v5WithData() {
  // Un vendedor real usando la v5 publicada: edita HBO, agrega una plataforma propia, guarda combos, copia y deja 30 %.
  const v5 = bootV5();
  const { win, doc } = v5;
  const hbo = doc.querySelector('input[data-edit-id="hbomax"][data-edit-dur="1"]');
  hbo.value = '55'; fire(win, hbo, 'change');
  doc.getElementById('npName').value = 'Plan Propio';
  doc.getElementById('np1').value = '40';
  click(win, doc.getElementById('npAddBtn'));
  const custom = [...doc.querySelectorAll('input[type=checkbox]')].pop();
  custom.checked = true; fire(win, custom, 'change');
  const nf = doc.querySelector('input[type=checkbox][data-id="netflix"]');
  nf.checked = true; fire(win, nf, 'change');
  doc.getElementById('saveComboName').value = 'Netflix + propio';
  click(win, doc.getElementById('saveComboBtn'));
  custom.checked = false;
  const customNow = [...doc.querySelectorAll('input[type=checkbox]')].pop();
  customNow.checked = false; fire(win, customNow, 'change');
  const dis = doc.querySelector('input[type=checkbox][data-id="disney"]');
  dis.checked = true; fire(win, dis, 'change');
  const st = JSON.parse(win.localStorage.getItem(KEY5));
  st.history = [{ id: 'hist_1', ts: '21/11/2026, 10:00:00 a. m.', name: 'Combo enviado', text: 'N3T₣L!X PREMIUM\n- 1 mes: $75' }];
  st.promoPct = 30;
  win.localStorage.setItem(KEY5, JSON.stringify(st));
  return v5.store();
}

test('migración v5 → v6: conserva combos e historial, informa ediciones y quita lo que ya no aplica', () => {
  const store = v5WithData();
  const env = bootV6(store, { now: () => new Date('2026-11-22T15:00:00Z') });
  const st = env.app.getState();
  assert.equal(st.schemaVersion, 6);
  assert.deepEqual(st.savedCombos.map(c => c.name), ['Netflix + propio'], 'combos de ejemplo eliminados, el del vendedor se conserva');
  assert.deepEqual(Object.keys(st.savedCombos[0].selection).filter(k => st.savedCombos[0].selection[k].selected), ['netflix']);
  assert.equal(st.history[0].text, 'N3T₣L!X PREMIUM\n- 1 mes: $75', 'el historial no se recalcula');
  assert.equal(st.promo.pct, 0, '30 % supera el máximo');
  assert.deepEqual(Object.keys(st.selection).filter(k => st.selection[k].selected).sort(), ['disney', 'netflix']);
  const notice = env.doc.querySelector('[data-notice="migration"]').textContent;
  assert.match(notice, /Hß0-₥ΔX/); assert.match(notice, /\$55 → \$50/);
  assert.match(notice, /Plan Propio/); assert.match(notice, /30 %/); assert.match(notice, /combos de ejemplo/);
  const keys = Object.keys(env.store());
  assert.ok(keys.includes(KEY6));
  assert.ok(keys.some(k => k.startsWith(KEY5 + '.respaldo-2026-11-22')), 'copia de seguridad de la v5 creada');
  assert.equal(env.store()[KEY5 + '.respaldo-2026-11-22'], store[KEY5], 'la copia es idéntica al original');
  // Cotización con precios oficiales (DEC-01).
  assert.equal(copyTextOf(env), gm.quotes.find(q => q.tag === 'pair' && q.sel.netflix === 1 && q.sel.disney === 1 && Object.keys(q.sel).length === 2 && q.promo === 0).text);
});

test('la migración es idempotente: recargar no vuelve a migrar ni duplica nada', () => {
  const first = bootV6(v5WithData());
  const again = bootV6(first.store());
  assert.deepEqual(again.app.getState().savedCombos, first.app.getState().savedCombos);
  assert.deepEqual(again.app.getState().history, first.app.getState().history);
  assert.equal(again.doc.querySelector('[data-notice="v5-newer"]'), null);
});

test('volver a la versión anterior: la v5 abre los mismos datos y la v6 no pide re-importar si no hubo cambios', () => {
  const v6 = bootV6(v5WithData());
  const v5 = bootV5(v6.store());
  const v5combos = JSON.parse(v5.win.localStorage.getItem(KEY5)).savedCombos.map(c => c.name);
  assert.ok(v5combos.includes('Netflix + propio'));
  assert.equal(v5.doc.getElementById('ticketName').textContent, v6.doc.getElementById('ticketName').textContent);
  const back = bootV6(v5.store());
  assert.equal(back.doc.querySelector('[data-notice="v5-newer"]'), null, 'abrir la v5 sin cambiar nada no genera aviso');
  // Ahora sí cambia algo en la v5 (guarda un combo) y vuelve a la v6.
  v5.doc.getElementById('saveComboName').value = 'Hecho en v5';
  click(v5.win, v5.doc.getElementById('saveComboBtn'));
  const back2 = bootV6(v5.store());
  assert.ok(back2.doc.querySelector('[data-notice="v5-newer"]'));
  click(back2.win, back2.doc.querySelector('[data-act="adopt-v5"]'));
  assert.ok(back2.app.getState().savedCombos.some(c => c.name === 'Hecho en v5'));
});

// ---------- robustez y seguridad ----------
test('datos dañados nunca dejan la página en blanco', () => {
  for (const raw of ['{"platforms":"hola"}', '{"platforms":[null]}', '{no es json', '[]', 'null']) {
    const env = bootV6({ [KEY5]: raw });
    assert.ok(env.doc.getElementById('platformList').querySelectorAll('.item').length === 18, `con ${raw}`);
  }
  const env = bootV6({ [KEY6]: '{roto' });
  assert.ok(env.doc.querySelector('[data-notice="v6-corrupt"]'));
  assert.equal(env.doc.querySelectorAll('.item').length, 18);
});

test('importar: rechaza archivos inválidos sin tocar los datos y acepta respaldos v5 y v6', () => {
  const env = bootV6();
  setSelection(env, { netflix: 1 });
  const before = JSON.stringify(env.app.getState());
  assert.equal(env.app.importText('esto no es json'), false);
  assert.equal(env.app.importText('{"hola":1}'), false);
  assert.equal(JSON.stringify(env.app.getState()), before);
  assert.ok(env.doc.querySelector('[data-notice="import-error"]'));
  assert.equal(env.app.importText(JSON.stringify({ platforms: [{ id: 'roto', name: 'Roto' }], savedCombos: [{ name: 'X', selection: { vix: { selected: true, devices: 2 } }, promoPct: 10 }] })), true);
  assert.deepEqual(env.app.getState().savedCombos.map(c => c.name), ['X']);
  const v6backup = JSON.stringify({ format: 'calculadora-combos/respaldo', schemaVersion: 6, state: { selection: { gemini: { selected: true, devices: 3 } }, promo: { pct: 99 }, savedCombos: [], history: [] } });
  assert.equal(env.app.importText(v6backup), true);
  assert.equal(env.app.getState().promo.pct, 0, '99 % se rechaza');
  assert.equal(env.app.getState().selection.gemini.devices, 3);
});

test('XSS: nombres con HTML en respaldos se muestran como texto', () => {
  const env = bootV6();
  env.app.importText(JSON.stringify({
    savedCombos: [{ id: 'c1', name: '<img src=x onerror="window.__pwn=1">', selection: { vix: { selected: true, devices: 1 } }, promoPct: 0 }],
    history: [{ id: 'h1', ts: '<b id="x2">t</b>', name: '<svg onload=alert(1)>', text: 'ok' }]
  }));
  assert.equal(env.doc.querySelectorAll('img, svg, #x2').length, 0);
  assert.match(env.doc.getElementById('savedCombosList').textContent, /<img src=x/);
  env.doc.getElementById('searchInput').value = '"><img src=x>';
  fire(env.win, env.doc.getElementById('searchInput'), 'input');
  assert.equal(env.doc.querySelectorAll('img').length, 0);
});

test('dos pestañas: un cambio en otra pestaña se refleja sin recargar', () => {
  const env = bootV6();
  const st = JSON.parse(env.win.localStorage.getItem(KEY6));
  st.savedCombos = [{ id: 'otra', name: 'Desde otra pestaña', selection: { vix: { selected: true, devices: 1 } }, promoPct: 0 }];
  env.win.localStorage.setItem(KEY6, JSON.stringify(st));
  env.win.dispatchEvent(new env.win.StorageEvent('storage', { key: KEY6 }));
  assert.match(env.doc.getElementById('savedCombosList').textContent, /Desde otra pestaña/);
});

test('exportar genera un respaldo v6 que se vuelve a importar igual', () => {
  const env = bootV6();
  let saved = null;
  env.win.URL.createObjectURL = blob => { saved = blob; return 'blob:x'; };
  env.win.URL.revokeObjectURL = () => {};
  setSelection(env, { canva: 2 });
  click(env.win, env.doc.querySelector('[data-act="export"]'));
  assert.ok(saved);
  return new Promise(res => { const r = new env.win.FileReader(); r.onload = () => res(String(r.result)); r.readAsText(saved); }).then(text => {
    const other = bootV6();
    assert.equal(other.app.importText(text), true);
    assert.equal(copyTextOf(other), copyTextOf(env));
  });
});
