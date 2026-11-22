// Rediseño "Arcaverse Combo Studio": solo cambia la presentación.
// Estas pruebas cubren lo nuevo (tema día/noche, secciones, duración destacada, hoja móvil)
// y confirman que nada de eso altera el texto que recibe el cliente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { bootV6, fire, click, repoRoot } from './helpers/entornos.mjs';

const KEY_THEME = 'calculadora-combos-tema';
const copyTextOf = env => env.doc.getElementById('copyText').textContent;
function pick(env, ids) {
  for (const id of ids) {
    const cb = env.doc.querySelector(`input[type=checkbox][data-id="${id}"]`);
    cb.checked = true; fire(env.win, cb, 'change');
  }
}

test('tema: arranca en modo noche, el botón cambia a día y la elección se recuerda', () => {
  const env = bootV6();
  const root = env.doc.documentElement;
  const btn = env.doc.getElementById('themeToggle');
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(btn.getAttribute('aria-pressed'), 'true');
  click(env.win, btn);
  assert.equal(root.dataset.theme, 'light');
  assert.equal(env.store()[KEY_THEME], 'light');
  const again = bootV6(env.store());
  assert.equal(again.doc.documentElement.dataset.theme, 'light', 'al volver a abrir conserva el modo día');
  click(again.win, again.doc.getElementById('themeToggle'));
  assert.equal(again.doc.documentElement.dataset.theme, 'dark');
});

test('cambiar de tema no altera la cotización', () => {
  const env = bootV6();
  pick(env, ['netflix', 'disney']);
  const before = copyTextOf(env);
  click(env.win, env.doc.getElementById('themeToggle'));
  assert.equal(copyTextOf(env), before);
});

test('secciones: Calculadora, Combos, Historial y Datos se muestran de a una', () => {
  const env = bootV6();
  const visible = () => ['calc', 'combos', 'historial', 'datos'].filter(v => !env.doc.getElementById('view-' + v).hasAttribute('hidden'));
  assert.deepEqual(visible(), ['calc']);
  for (const v of ['combos', 'historial', 'datos', 'calc']) {
    click(env.win, env.doc.querySelector(`[data-act="nav"][data-view="${v}"]`));
    assert.deepEqual(visible(), [v]);
    assert.equal(env.doc.querySelector(`[data-act="nav"][data-view="${v}"]`).getAttribute('aria-current'), 'page');
  }
});

test('duración destacada: es solo visual; el mensaje sigue llevando todas las duraciones', () => {
  const env = bootV6();
  pick(env, ['netflix']);
  const text = copyTextOf(env);
  const rows = [...env.doc.querySelectorAll('.row-line')];
  assert.ok(rows.length > 1);
  assert.ok(rows[0].classList.contains('active'), 'por defecto se destaca la primera duración');
  const last = rows[rows.length - 1];
  const lastFinal = last.querySelector('.final').textContent;
  click(env.win, last);
  assert.equal(env.doc.querySelector('.total-final').textContent, lastFinal);
  assert.ok(env.doc.querySelectorAll('.row-line')[rows.length - 1].classList.contains('active'));
  assert.equal(copyTextOf(env), text, 'el texto para el cliente no cambia');
});

test('móvil: la barra inferior abre y cierra el resumen', () => {
  const env = bootV6();
  pick(env, ['spotify']);
  const bar = env.doc.getElementById('sumBar');
  assert.equal(bar.getAttribute('aria-expanded'), 'false');
  click(env.win, bar);
  assert.ok(env.doc.getElementById('summary').classList.contains('open'));
  assert.equal(env.doc.getElementById('sumBar').getAttribute('aria-expanded'), 'true');
  click(env.win, env.doc.getElementById('sumBar'));
  assert.ok(!env.doc.getElementById('summary').classList.contains('open'));
});

test('"Guardar combo" desde el resumen lleva a Combos y guarda la misma cotización', () => {
  const env = bootV6();
  pick(env, ['netflix', 'youtube']);
  const text = copyTextOf(env);
  click(env.win, env.doc.querySelector('[data-act="quick-save"]'));
  assert.ok(!env.doc.getElementById('view-combos').hasAttribute('hidden'));
  click(env.win, env.doc.querySelector('[data-act="save-combo"]'));
  click(env.win, env.doc.querySelector('[data-act="clear"]'));
  click(env.win, env.doc.querySelector('[data-act="use-combo"]'));
  assert.equal(copyTextOf(env), text);
});

test('al cambiar dispositivos solo se redibuja esa tarjeta (las demás quedan intactas)', () => {
  const env = bootV6();
  pick(env, ['netflix', 'disney']);
  const other = env.doc.querySelector('.pcard:has(#chk-disney)');
  click(env.win, env.doc.querySelector('[data-act="inc"][data-id="netflix"]'));
  assert.equal(env.doc.querySelector('.pcard:has(#chk-disney)'), other);
  assert.equal(env.doc.querySelector('[data-act="inc"][data-id="netflix"]').parentElement.querySelector('.stepper-value').textContent, '2');
});

test('la interfaz del vendedor no muestra información financiera interna', () => {
  const env = bootV6();
  pick(env, ['netflix', 'disney', 'spotify']);
  const text = env.doc.body.textContent.toLowerCase();
  for (const word of ['costo', 'margen', 'utilidad', 'ganancia', 'proveedor']) assert.ok(!text.includes(word), word);
});

test('la hoja de estilos define ambos temas y no usa efectos que el diseño descarta', () => {
  const css = fs.readFileSync(path.join(repoRoot, 'assets/app.css'), 'utf8');
  assert.match(css, /\[data-theme="light"\]/);
  assert.match(css, /--bg: #11121A/);
  assert.doesNotMatch(css, /backdrop-filter|linear-gradient|radial-gradient/);
  assert.doesNotMatch(css, /#000000|#000;|:\s*black\b/i, 'sin negro puro');
});
