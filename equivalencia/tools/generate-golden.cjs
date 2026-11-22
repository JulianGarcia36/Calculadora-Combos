// Genera el golden master de reglas comerciales usando el script.js EN PRODUCCIÓN como oráculo.
// Uso: node golden.js <carpeta_proyecto> <salida.json>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');

const dir = process.argv[2];
const outFile = process.argv[3];
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace('<script src="script.js"></script>', '');
const js = fs.readFileSync(path.join(dir, 'script.js'), 'utf8');

const dom = new JSDOM(html, { url: 'https://example.test/', runScripts: 'outside-only' });
const w = dom.window;
// Helpers añadidos al final del mismo script para acceder a sus `let` globales.
w.eval(js + `

  window.__quote = function(sel, promo){
    selection = {};
    Object.entries(sel).forEach(([id, qty]) => { selection[id] = {selected:true, devices:qty, editOpen:false}; });
    promoPct = promo;
    const items = selectedItems();
    const durations = commonDurations(items);
    const totals = computeTotals(items, durations);
    const name = comboName(items);
    const devices = deviceLabel(items);
    const rows = durations.map(d => ({d, base: totals[d], final: promoPct > 0 ? round5(totals[d] * (1 - promoPct/100)) : totals[d]}));
    return {name, rows, text: buildCopyText(name, totals, durations, devices, items)};
  };
  window.__item = function(id, d, qty){
    selection = {}; selection[id] = {selected:true, devices:qty, editOpen:false};
    const it = platforms.find(p => p.id === id);
    const v = itemPriceByDuration(it, d);
    return v === undefined ? null : v;
  };
  window.__catalog = function(){ return JSON.parse(JSON.stringify(platforms)); };
`);

const catalog = w.__catalog();
const ids = catalog.map(p => p.id);
const DUR = [1, 2, 3, 6, 12, 24];

const gm = {
  meta: {
    generatedAt: new Date().toISOString(),
    source: 'script.js',
    sourceSha256: crypto.createHash('sha256').update(js).digest('hex'),
    note: 'Salida exacta del código en producción. Cualquier versión nueva debe reproducir cada caso byte a byte.'
  },
  catalog,
  itemPrices: [],
  quotes: []
};

// A. Precio por plataforma, duración y cantidad de dispositivos (1..10)
for (const id of ids) for (const d of DUR) for (let q = 1; q <= 10; q++) {
  gm.itemPrices.push({ id, d, qty: q, price: w.__item(id, d, q) });
}

const PROMOS = [0, 5, 10, 15, 20, 25, 30, 50];
const add = (sel, promo, tag) => { const r = w.__quote(sel, promo); gm.quotes.push({ tag, sel, promo, ...r }); };

// B. Plataformas solas, 1..10 dispositivos, promos comunes
for (const id of ids) for (let q = 1; q <= 10; q++) for (const p of PROMOS) add({ [id]: q }, p, 'single');
// C. Todas las parejas con (1,1), (2,1), (2,2) y promos 0/10/15
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
  for (const [a, b] of [[1, 1], [2, 1], [2, 2]]) for (const p of [0, 10, 15]) add({ [ids[i]]: a, [ids[j]]: b }, p, 'pair');
}
// D. Todas las ternas, 1 dispositivo, promo 10
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) for (let k = j + 1; k < ids.length; k++) {
  add({ [ids[i]]: 1, [ids[j]]: 1, [ids[k]]: 1 }, 10, 'triple');
}
// E. Combos semilla con cada promo entera 0..90 y algunas decimales
const seeds = [
  { netflix: 1, disney: 1, vix: 1 },
  { netflix: 1, disney: 1, hbomax: 1, prime: 1 },
  { crunchy: 1, universal: 1, paramount: 1 }
];
const promosAll = [...Array(91).keys(), 2.5, 7.5, 12.5, 33.3];
seeds.forEach((s, n) => promosAll.forEach(p => add(s, p, 'seed' + (n + 1))));
// F. Catálogo completo seleccionado
add(Object.fromEntries(ids.map(id => [id, 1])), 0, 'all');
add(Object.fromEntries(ids.map(id => [id, 1])), 10, 'all');

fs.writeFileSync(outFile, JSON.stringify(gm));
console.log(JSON.stringify({ itemPrices: gm.itemPrices.length, quotes: gm.quotes.length, bytes: fs.statSync(outFile).size, sha: gm.meta.sourceSha256 }));
