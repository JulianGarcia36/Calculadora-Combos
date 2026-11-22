// Compara dos catálogos y escribe un informe en Markdown de los precios que cambian.
// Uso: node tools/informe-precios.mjs <catalogo-base.json> <catalogo-nuevo.json>
import fs from 'node:fs';

const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const [baseFile, newFile] = process.argv.slice(2);
const base = read(baseFile), next = read(newFile);
const out = ['## Informe de precios'];
if (!next) { out.push('No se pudo leer el catálogo nuevo.'); }
else if (!base || !Array.isArray(base.platforms)) { out.push(`Catálogo nuevo (${next.catalogVersion}): ${next.platforms.length} plataformas. No hay catálogo anterior con qué comparar.`); }
else {
  const rows = [];
  const fmt = v => (v === undefined ? '—' : '$' + v.toLocaleString('es-CO'));
  const ids = [...new Set([...base.platforms.map(p => p.id), ...next.platforms.map(p => p.id)])];
  for (const id of ids) {
    const a = base.platforms.find(p => p.id === id), b = next.platforms.find(p => p.id === id);
    if (!a) { rows.push(`| ${b.name} | nueva | | |`); continue; }
    if (!b) { rows.push(`| ${a.name} | eliminada | | |`); continue; }
    if (a.name !== b.name) rows.push(`| ${a.name} | nombre | ${a.name} | ${b.name} |`);
    if (a.baseDevices !== b.baseDevices) rows.push(`| ${b.name} | dispositivos base | ${a.baseDevices} | ${b.baseDevices} |`);
    for (const d of [...new Set([...Object.keys(a.table), ...Object.keys(b.table)])].sort((x, y) => x - y)) {
      if (a.table[d] !== b.table[d]) rows.push(`| ${b.name} | ${d} ${d === '1' ? 'mes' : 'meses'} | ${fmt(a.table[d])} | ${fmt(b.table[d])} |`);
    }
  }
  if (base.maxDiscountPct !== next.maxDiscountPct) rows.push(`| (descuento máximo) | | ${base.maxDiscountPct} % | ${next.maxDiscountPct} % |`);
  if (JSON.stringify(base.discountTiers) !== JSON.stringify(next.discountTiers)) rows.push(`| (tramos de descuento) | | ${base.discountTiers.map(t => t.minPlatforms + '→' + t.pct + '%').join(' ')} | ${next.discountTiers.map(t => t.minPlatforms + '→' + t.pct + '%').join(' ')} |`);
  if (rows.length === 0) out.push('Este cambio **no modifica ningún precio**.');
  else out.push(`Este cambio modifica **${rows.length}** valores del catálogo (${base.catalogVersion} → ${next.catalogVersion}):`, '', '| Plataforma | Qué cambia | Antes | Después |', '| --- | --- | --- | --- |', ...rows);
}
console.log(out.join('\n'));
