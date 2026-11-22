// Ejecuta el script.js v5 ORIGINAL (sin modificar) en jsdom y expone su cálculo como función.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JSDOM } = require(process.env.JSDOM_PATH || 'jsdom');

export function loadOracle(legacyPath) {
  const js = fs.readFileSync(legacyPath, 'utf8');
  const dom = new JSDOM('<!DOCTYPE html><div id="app"></div><div id="toast"></div>', { url: 'https://oracle.test/', runScripts: 'outside-only' });
  dom.window.eval(js + `
    window.__oracleQuote = function(catalog, sel, promo){
      platforms = JSON.parse(JSON.stringify(catalog));
      selection = JSON.parse(JSON.stringify(sel));
      promoPct = promo;
      const items = selectedItems();
      const durations = commonDurations(items);
      const totals = computeTotals(items, durations);
      const name = comboName(items);
      const devices = deviceLabel(items);
      const rows = durations.map(d => ({d, base: totals[d], final: promoPct > 0 ? round5(totals[d] * (1 - promoPct/100)) : totals[d]}));
      return JSON.stringify({name, rows, text: buildCopyText(name, totals, durations, devices, items)});
    };`);
  return (catalog, sel, promo) => JSON.parse(dom.window.__oracleQuote(catalog, sel, promo));
}

// Barrido exhaustivo de BR-06 usando el texto generado por buildCopyText() original.
export function oraclePromoSweep(legacyPath, maxT, step, promos) {
  const js = fs.readFileSync(legacyPath, 'utf8');
  const dom = new JSDOM('<!DOCTYPE html><div id="app"></div><div id="toast"></div>', { url: 'https://oracle.test/', runScripts: 'outside-only' });
  dom.window.eval(js + `
    window.__sweep = function(maxT, step, promos){
      const out = [];
      selection = {x:{selected:true, devices:1, editOpen:false}};
      for (let T = 0; T <= maxT; T += step) {
        platforms = [{id:'x', name:'X', baseDevices:1, table:{1:T}}];
        const items = selectedItems(); const totals = computeTotals(items, [1]);
        for (const p of promos) { promoPct = p; const line = buildCopyText('X', totals, [1], 1, items).split('\\n')[p > 0 ? 2 : 1]; out.push(line); }
      }
      return out.join('|');
    };`);
  return dom.window.__sweep(maxT, step, promos).split('|');
}
