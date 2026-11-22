import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as engine from '../../src/domain/pricing.js';
import { loadOracle } from './helpers/oracle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const gm = JSON.parse(fs.readFileSync(path.join(here, 'golden/golden-master-v5.json'), 'utf8'));
test('el oráculo es la copia exacta de script.js v5 en producción', async () => {
  const { createHash } = await import('node:crypto');
  const sha = createHash('sha256').update(fs.readFileSync(path.join(here, 'oracle/legacy-v5.js'))).digest('hex');
  assert.equal(sha, '0999e7dd7827ea157f049585bcef1cfe7360e3e864881bf1c45f9c28b6a905bc');
});

const toSel = sel => Object.fromEntries(Object.entries(sel).map(([id, q]) => [id, { selected: true, devices: q, editOpen: false }]));

test('golden master: 1.080 precios unitarios idénticos', () => {
  for (const c of gm.itemPrices) {
    const item = gm.catalog.find(p => p.id === c.id);
    const got = engine.itemPriceByDuration(item, c.d, { [c.id]: { selected: true, devices: c.qty } });
    assert.equal(got === undefined ? null : got, c.price, `${c.id} ${c.d}m x${c.qty}`);
  }
});

test('golden master: 3.920 cotizaciones idénticas byte a byte', () => {
  for (const q of gm.quotes) {
    const got = engine.quote(gm.catalog, toSel(q.sel), q.promo);
    assert.equal(got.text, q.text, `${q.tag} ${JSON.stringify(q.sel)} promo ${q.promo}`);
    assert.deepEqual(got.rows, q.rows);
  }
});

test('diferencial aleatorio contra el oráculo v5 (catálogos, cantidades y descuentos aleatorios)', () => {
  const oracle = loadOracle(path.join(here, 'oracle/legacy-v5.js'));
  let seed = Number(process.env.SEED || 20261121);
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const N = Number(process.env.CASES || 20000);
  for (let i = 0; i < N; i++) {
    const catalog = JSON.parse(JSON.stringify(gm.catalog));
    if (rnd() < 0.3) catalog.push({ id: 'custom_' + i, name: 'Plan ' + i, baseDevices: 1 + Math.floor(rnd() * 4),
      table: Object.fromEntries([1, 2, 3, 6, 12].filter(() => rnd() < 0.8).map(d => [d, pick([52, 99.5, 1234, 7, 333.33, 60])])) });
    if (rnd() < 0.5) catalog.sort(() => rnd() - 0.5);
    const sel = {};
    catalog.forEach(p => { if (rnd() < 0.2) sel[p.id] = { selected: true, devices: 1 + Math.floor(rnd() * 10), editOpen: false }; });
    const promo = pick([0, 5, 10, 15, 20, 25, 30, 33.3, 12.5, 90, 95, 150, -10, rnd() * 100]);
    const a = oracle(catalog, sel, promo), b = engine.quote(catalog, sel, promo);
    assert.deepEqual(b, a, `caso ${i}: ${JSON.stringify({ sel, promo })}`);
  }
});

import { oraclePromoSweep } from './helpers/oracle.mjs';
test('BR-06 exhaustivo: 540.090 combinaciones de total (0–30.000) y descuento (1–90 %)', () => {
  const promos = Array.from({ length: 90 }, (_, i) => i + 1);
  const expected = oraclePromoSweep(path.join(here, 'oracle/legacy-v5.js'), 30000, 5, promos);
  let k = 0;
  for (let T = 0; T <= 30000; T += 5) for (const p of promos) {
    const line = `- 1 mes: ~${engine.fmt(T)}~ ${engine.fmt(engine.applyPromo(T, p))}`;
    assert.equal(line, expected[k++], `total ${T}, descuento ${p}%`);
  }
});
