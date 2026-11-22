// Motor de cálculo v6 — estrategia "v5-round5".
// REGLA: las expresiones numéricas son copia literal de script.js v5 (l. 52–113, 473–554).
// No reescribir, simplificar ni "corregir" sin aprobación del negocio (ver BR-01 a BR-11).

export const ALL_DURATIONS = [1, 2, 3, 6, 12, 24];

export function round5(n) { return Math.round(n / 5) * 5; }                       // BR-03
export function fmt(n) { return '$' + n.toLocaleString('es-CO'); }                 // BR-11
export function durLabel(d) { return d === 1 ? '1 mes' : d + ' meses'; }

const qtyOf = (item, selection) => (selection[item.id] && selection[item.id].devices) || item.baseDevices;

export function itemPriceByDuration(item, duration, selection) {                  // BR-02
  const qty = qtyOf(item, selection);
  const base = item.table[duration];
  if (base === undefined) return undefined;
  if (qty === item.baseDevices) return base;
  return round5(base / item.baseDevices * qty);
}

export function selectedItems(catalog, selection) {                               // orden del catálogo (BR-08)
  return catalog.filter(p => selection[p.id] && selection[p.id].selected);
}

export function commonDurations(items) {                                         // BR-04
  if (items.length === 0) return [1, 2, 3, 6, 12];
  return ALL_DURATIONS.filter(d => items.every(it => it.table[d] !== undefined));
}

export function computeTotals(items, durations, selection) {                      // BR-05
  const totals = {};
  durations.forEach(d => {
    let sum = 0;
    items.forEach(it => sum += itemPriceByDuration(it, d, selection));
    totals[d] = sum;
  });
  return totals;
}

export function applyPromo(base, promoPct) {                                      // BR-06 (orden exacto)
  return promoPct > 0 ? round5(base * (1 - promoPct / 100)) : base;
}

export function deviceWord(item, qty) {                                          // BR-09
  if (item.id === 'netflix') return qty === 1 ? 'p€rfil' : 'p€rfil€s';
  return qty === 1 ? 'Dispositivo' : 'Dispositivos';
}

export function deviceLabel(items, selection) {
  if (items.length === 0) return 1;
  if (items.length === 1) return qtyOf(items[0], selection);
  return Math.max(...items.map(it => qtyOf(it, selection)));
}

export function comboName(items, selection) {                                    // BR-08 (incluye literal N6)
  return items.map(it => {
    const qty = qtyOf(it, selection);
    if (items.length > 1 && qty >= 2) return `${it.name} (${qty} ${deviceWord(it, qty)})`;
    if (items.length === 1 && it.id === 'netflix' && qty !== 1) return `N3T₣L!X PREMIUM (${qty} p€rfil€s)`;
    return it.name;
  }).join(' + ');
}

export function buildCopyText(name, totals, durations, devices, items, selection, promoPct) {   // BR-10
  const lines = [name];
  if (promoPct > 0) lines.push(`🔥 Precio con -${promoPct}% de descuento`);
  durations.forEach(d => {
    const base = totals[d];
    const withPromo = applyPromo(base, promoPct);
    lines.push(promoPct > 0 ? `- ${durLabel(d)}: ~${fmt(base)}~ ${fmt(withPromo)}` : `- ${durLabel(d)}: ${fmt(withPromo)}`);
  });
  const qtys = items.map(it => qtyOf(it, selection));
  const uniform = qtys.every(q => q === qtys[0]);
  if (items.length === 1) lines.push(`${devices} ${deviceWord(items[0], devices)}`);
  else if (uniform && qtys[0] === 1) lines.push('1 Dispositivo');
  return lines.join('\n');
}

/** Punto de entrada único: cotización completa a partir de datos puros. */
export function quote(catalog, selection, promoPct) {
  const items = selectedItems(catalog, selection);
  const durations = commonDurations(items);
  const totals = computeTotals(items, durations, selection);
  const name = comboName(items, selection);
  const devices = deviceLabel(items, selection);
  const rows = durations.map(d => ({ d, base: totals[d], final: applyPromo(totals[d], promoPct) }));
  return { name, rows, text: buildCopyText(name, totals, durations, devices, items, selection, promoPct) };
}
