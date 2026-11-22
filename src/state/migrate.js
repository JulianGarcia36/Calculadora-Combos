// Migración del formato v5 (clave platforms-state-v5) al estado v6. Función pura.
// Reglas acordadas (22 nov 2026):
//  - DEC-01: los precios son oficiales; las ediciones locales y las plataformas propias no se migran,
//    pero se listan en el informe para que el vendedor se las comunique al administrador.
//  - DEC-03: un descuento guardado mayor que el máximo se quita (se informa).
//  - DEC-04: los 3 combos de ejemplo se eliminan si no fueron modificados.
//  - El historial (texto ya enviado al cliente) se conserva intacto.
import { emptyState, cleanSelection, LEGACY_SEED_COMBOS, MAX_HISTORY, newId } from './schema.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** ¿Parece un estado v5? */
export function looksLikeV5(obj) {
  return isObj(obj) && obj.schemaVersion === undefined &&
    (Array.isArray(obj.platforms) || isObj(obj.selection) || Array.isArray(obj.savedCombos) || Array.isArray(obj.history));
}

function selectedMap(sel) {
  const out = {};
  if (!isObj(sel)) return out;
  for (const [id, e] of Object.entries(sel)) if (isObj(e) && e.selected) out[id] = e.devices || 1;
  return out;
}

function isUntouchedSeed(combo) {
  const seed = LEGACY_SEED_COMBOS.find(s => s.name === combo.name);
  if (!seed) return false;
  const a = selectedMap(combo.selection);
  const b = seed.selected;
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  return combo.promoPct === seed.promoPct && ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
}

export function migrateV5(v5, catalog, maxPct, now = new Date()) {
  const state = emptyState(now);
  const report = { priceEdits: [], customPlatforms: [], removedSeeds: 0, promoRemoved: null, combosChanged: [], combosRemoved: [], historyKept: 0 };
  if (!isObj(v5)) return { state, report };

  // Precios editados y plataformas propias (solo para el informe).
  const official = new Map(catalog.platforms.map(p => [p.id, p]));
  if (Array.isArray(v5.platforms)) {
    for (const p of v5.platforms) {
      if (!isObj(p) || typeof p.id !== 'string') continue;
      const off = official.get(p.id);
      if (!off) { if (typeof p.name === 'string') report.customPlatforms.push(p.name); continue; }
      const diffs = [];
      const durations = new Set([...Object.keys(off.table), ...Object.keys(isObj(p.table) ? p.table : {})]);
      for (const d of [...durations].sort((x, y) => x - y)) {
        const local = isObj(p.table) ? p.table[d] : undefined;
        if (local !== off.table[d]) diffs.push({ d: Number(d), local: local ?? null, official: off.table[d] ?? null });
      }
      if (diffs.length || (p.baseDevices !== undefined && p.baseDevices !== off.baseDevices)) {
        report.priceEdits.push({ id: p.id, name: off.name, diffs });
      }
    }
  }

  // Selección actual.
  state.selection = cleanSelection(v5.selection, catalog).selection;

  // Descuento.
  const pct = v5.promoPct;
  if (typeof pct === 'number' && Number.isFinite(pct) && pct > 0) {
    if (pct <= maxPct) state.promo = { pct, setAt: now.toISOString() };
    else report.promoRemoved = pct;
  }

  // Combos guardados.
  if (Array.isArray(v5.savedCombos)) {
    for (const c of v5.savedCombos) {
      if (!isObj(c) || typeof c.name !== 'string') continue;
      if (isUntouchedSeed(c)) { report.removedSeeds++; continue; }
      const { selection, dropped } = cleanSelection(c.selection, catalog);
      if (!Object.values(selection).some(e => e.selected)) { report.combosRemoved.push(c.name); continue; }
      let promoPct = typeof c.promoPct === 'number' && Number.isFinite(c.promoPct) && c.promoPct > 0 ? c.promoPct : 0;
      const notes = [];
      if (dropped.length) notes.push('sin plataformas propias');
      if (promoPct > maxPct) { notes.push(`descuento ${promoPct} % quitado`); promoPct = 0; }
      if (notes.length) report.combosChanged.push({ name: c.name, notes });
      state.savedCombos.push({ id: typeof c.id === 'string' && c.id ? c.id : newId('combo'), name: c.name, selection, promoPct });
    }
  }

  // Historial: se copia tal cual (nunca se recalcula).
  if (Array.isArray(v5.history)) {
    for (const h of v5.history) {
      if (!isObj(h) || typeof h.text !== 'string') continue;
      state.history.push({ id: typeof h.id === 'string' && h.id ? h.id : newId('hist'), ts: typeof h.ts === 'string' ? h.ts : '', name: typeof h.name === 'string' ? h.name : '', text: h.text });
      if (state.history.length >= MAX_HISTORY) break;
    }
  }
  report.historyKept = state.history.length;

  state.meta = { ...state.meta, migratedFromSchema: 5, migratedAt: now.toISOString() };
  return { state, report };
}

/** ¿El informe tiene algo que el vendedor deba saber? */
export function reportHasNews(r) {
  return r.priceEdits.length > 0 || r.customPlatforms.length > 0 || r.promoRemoved !== null || r.combosChanged.length > 0 || r.combosRemoved.length > 0;
}
