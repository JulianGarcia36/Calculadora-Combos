// Pruebas sobre lo que está PUBLICADO en la raíz (script.js v5): cierran el hueco de que las pruebas
// de equivalencia solo vigilaban una copia congelada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadOracle } from './helpers/oracle.mjs';
import { bootV5, repoRoot } from './helpers/entornos.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const gm = JSON.parse(fs.readFileSync(path.join(here, 'golden/golden-master-v5.json'), 'utf8'));
const published = path.join(repoRoot, 'script.js');

test('el golden master corresponde al script.js publicado (si cambiaste script.js, ejecuta: npm run golden)', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(published)).digest('hex');
  assert.equal(gm.meta.sourceSha256, sha, 'script.js cambió: revisa el cambio de precios y regenera con "npm run golden"');
});

test('los precios del script.js publicado son los del golden master', () => {
  const v5 = bootV5();
  const platforms = JSON.parse(JSON.stringify(v5.win.__v5.platforms));
  const changes = [];
  for (const p of gm.catalog) {
    const now = platforms.find(x => x.id === p.id);
    if (!now) { changes.push(`${p.id}: ya no existe`); continue; }
    for (const d of new Set([...Object.keys(p.table), ...Object.keys(now.table)])) {
      if (p.table[d] !== now.table[d]) changes.push(`${p.id} ${d} m: ${p.table[d] ?? '—'} → ${now.table[d] ?? '—'}`);
    }
  }
  platforms.filter(x => !gm.catalog.some(p => p.id === x.id)).forEach(x => changes.push(`${x.id}: nueva`));
  assert.deepEqual(changes, [], 'Cambios de precio detectados:\n' + changes.join('\n'));
  assert.deepEqual(platforms, gm.catalog);
});

test('el script.js publicado aplica las mismas reglas de cálculo que la v5 original (diferencial aleatorio)', () => {
  const oracle = loadOracle(path.join(here, 'oracle/legacy-v5.js'));
  const current = loadOracle(published);
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = a => a[Math.floor(rnd() * a.length)];
  for (let i = 0; i < Number(process.env.CASES_PROD || 5000); i++) {
    const catalog = JSON.parse(JSON.stringify(gm.catalog));
    if (rnd() < 0.3) catalog.push({ id: 'c' + i, name: 'Plan ' + i, baseDevices: 1 + Math.floor(rnd() * 4), table: { 1: pick([52, 99.5, 7]), 3: pick([140, 333.33]) } });
    const sel = {};
    catalog.forEach(p => { if (rnd() < 0.2) sel[p.id] = { selected: true, devices: 1 + Math.floor(rnd() * 10), editOpen: false }; });
    const promo = pick([0, 5, 10, 15, 20, 25, 12.5, 30, rnd() * 25]);
    assert.deepEqual(current(catalog, sel, promo), oracle(catalog, sel, promo), `caso ${i}`);
  }
});
