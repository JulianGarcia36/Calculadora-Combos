// El informe de precios nunca debe romperse, aunque cambie la forma del catálogo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tool = path.join(here, '../tools/informe-precios.mjs');
const official = JSON.parse(fs.readFileSync(path.join(here, '../../catalog/catalog.json'), 'utf8'));
const tmp = obj => { const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inf-')), 'c.json'); fs.writeFileSync(f, JSON.stringify(obj)); return f; };
const run = (a, b) => execFileSync(process.execPath, [tool, a, b], { encoding: 'utf8' });

test('informe: sin cambios, con cambio de precio, sin catálogo anterior y con o sin tramos', () => {
  assert.match(run(tmp(official), tmp(official)), /no modifica ningún precio/);
  const changed = JSON.parse(JSON.stringify(official));
  changed.platforms[0].table['1'] += 5;
  assert.match(run(tmp(official), tmp(changed)), /\| 1 mes \| \$50 \| \$55 \|/);
  assert.match(run(tmp({}), tmp(official)), /No hay catálogo anterior/);
  const withTiers = { ...official, discountTiers: [{ minPlatforms: 2, pct: 5 }] };
  assert.match(run(tmp(withTiers), tmp(official)), /tramos de descuento.*2→5%.*sin tramos/);
  assert.match(run(tmp(official), tmp(withTiers)), /sin tramos.*2→5%/);
});
