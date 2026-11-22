// Pruebas sobre lo PUBLICADO: la versión 6 en la raíz y la versión anterior congelada en /legacy/.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { bootV5, repoRoot, catalog } from './helpers/entornos.mjs';
import { validateCatalog } from '../../src/domain/catalog.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const gm = JSON.parse(fs.readFileSync(path.join(here, 'golden/golden-master-v5.json'), 'utf8'));
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const read = f => fs.readFileSync(path.join(repoRoot, f), 'utf8');
const ORACLE_SHA = '0999e7dd7827ea157f049585bcef1cfe7360e3e864881bf1c45f9c28b6a905bc';

test('la versión anterior en /legacy/ es exactamente la v5 original (congelada)', () => {
  assert.equal(sha(path.join(repoRoot, 'legacy/script.js')), ORACLE_SHA, 'legacy/script.js no se debe modificar');
  assert.equal(gm.meta.sourceSha256, ORACLE_SHA);
  const v5 = bootV5();
  assert.deepEqual(JSON.parse(JSON.stringify(v5.win.__v5.platforms)), gm.catalog);
});

test('la página principal carga la versión 6 con su política de seguridad', () => {
  const html = read('index.html');
  assert.match(html, /<script type="module" src="src\/main\.js"><\/script>/);
  assert.match(html, /href="assets\/app\.css"/);
  assert.match(html, /data-legacy-url="legacy\/"/);
  assert.match(html, /Content-Security-Policy" content="default-src 'self'; script-src 'self';/);
  assert.doesNotMatch(html, /script\.js/);
  assert.match(read('v6/index.html'), /http-equiv="refresh" content="0; url=\.\.\/"/);
  assert.match(read('legacy/index.html'), /<script src="aviso\.js"><\/script>\s*<script src="script\.js"><\/script>/);
});

test('catálogo oficial válido', () => {
  assert.deepEqual(validateCatalog(catalog), { ok: true, errors: [] });
});

test('si cambian los precios, también cambia catalogVersion (así la versión anterior avisa que está desactualizada)', () => {
  const frozen = /CATALOGO_CONGELADO = '([^']+)'/.exec(read('legacy/aviso.js'))[1];
  if (catalog.catalogVersion === frozen) {
    assert.deepEqual(catalog.platforms, gm.catalog, `Cambiaste precios sin cambiar catalogVersion (${frozen}). Súbelo, por ejemplo a "2026.12.01-1".`);
  }
});
