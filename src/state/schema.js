// Estado de la versión 6: forma, validación y conversión desde/hacia el formato v5.
// Funciones puras: no tocan localStorage ni el DOM.

export const SCHEMA_VERSION = 6;
export const MAX_HISTORY = 20;
export const MAX_DEVICES = 10;

/** Los 3 combos de ejemplo de v5 (DEC-04: se eliminan si no fueron modificados). */
export const LEGACY_SEED_COMBOS = [
  { name: 'Trío Fuerte (N3T₣L!X + D1sn3y✚ + V!X)', selected: { netflix: 1, disney: 1, vix: 1 }, promoPct: 10 },
  { name: 'Cuarteto Todo Terreno (N3T₣L!X + D1sn3y✚ + Hß0-₥ΔX + ΔMΔZØN ₱R!M€)', selected: { netflix: 1, disney: 1, hbomax: 1, prime: 1 }, promoPct: 10 },
  { name: 'Revive (CR∪NCH¥R0££ + ∪N!V€R$₳Ⱡ + P₳R₳MØ∪N₮✚)', selected: { crunchy: 1, universal: 1, paramount: 1 }, promoPct: 15 }
];

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback);
const clampDevices = v => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_DEVICES) : null;
};

export function emptyState(now = new Date()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    selection: {},
    promo: { pct: 0, setAt: null },
    savedCombos: [],
    history: [],
    meta: { createdAt: now.toISOString() }
  };
}

/**
 * Limpia una selección: conserva solo plataformas del catálogo, con selected booleano y devices 1..10.
 * Devuelve también los ids descartados.
 */
export function cleanSelection(sel, catalog) {
  const ids = new Set(catalog.platforms.map(p => p.id));
  const out = {};
  const dropped = [];
  if (!isObj(sel)) return { selection: out, dropped };
  for (const [id, entry] of Object.entries(sel)) {
    if (!ids.has(id)) { if (isObj(entry) && entry.selected) dropped.push(id); continue; }
    if (!isObj(entry)) continue;
    const base = catalog.platforms.find(p => p.id === id).baseDevices;
    const devices = entry.devices === undefined || entry.devices === null || entry.devices === 0 ? base : clampDevices(entry.devices);
    out[id] = { selected: entry.selected === true, devices: devices ?? base };
  }
  return { selection: out, dropped };
}

/** Valida y normaliza un estado v6 (guardado o importado). Nunca lanza excepciones. */
export function normalizeState(obj, catalog, maxPct) {
  const warnings = [];
  const state = emptyState();
  if (!isObj(obj)) return { state, warnings: ['Los datos guardados no tenían un formato válido; se empezó de cero.'] };

  state.selection = cleanSelection(obj.selection, catalog).selection;

  const pct = isObj(obj.promo) ? obj.promo.pct : undefined;
  if (typeof pct === 'number' && Number.isFinite(pct) && pct >= 0 && pct <= maxPct) {
    state.promo = { pct, setAt: str(obj.promo.setAt, null) || null };
  } else if (pct !== undefined && pct !== 0) {
    warnings.push(`El descuento guardado (${pct} %) no es válido; se quitó.`);
  }

  if (Array.isArray(obj.savedCombos)) {
    for (const c of obj.savedCombos) {
      if (!isObj(c) || typeof c.name !== 'string' || !isObj(c.selection)) continue;
      const { selection } = cleanSelection(c.selection, catalog);
      if (!Object.values(selection).some(e => e.selected)) continue;
      let promoPct = typeof c.promoPct === 'number' && Number.isFinite(c.promoPct) ? c.promoPct : 0;
      if (promoPct < 0 || promoPct > maxPct) promoPct = 0;
      state.savedCombos.push({ id: str(c.id) || newId('combo'), name: c.name, selection, promoPct });
    }
  }

  if (Array.isArray(obj.history)) {
    for (const h of obj.history) {
      if (!isObj(h) || typeof h.text !== 'string') continue;
      const entry = { id: str(h.id) || newId('hist'), ts: str(h.ts), name: str(h.name), text: h.text };
      if (typeof h.isoTs === 'string') entry.isoTs = h.isoTs;
      state.history.push(entry);
      if (state.history.length >= MAX_HISTORY) break;
    }
  }

  if (isObj(obj.meta)) state.meta = { ...state.meta, ...pickMeta(obj.meta) };
  return { state, warnings };
}

function pickMeta(m) {
  const out = {};
  for (const k of ['createdAt', 'migratedAt', 'migratedFromSchema', 'backupKey', 'lastCatalogVersion']) {
    if (typeof m[k] === 'string' || typeof m[k] === 'number') out[k] = m[k];
  }
  return out;
}

export function newId(prefix) {
  const rnd = (globalThis.crypto && globalThis.crypto.randomUUID) ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${rnd}`;
}

/** Convierte una selección v6 al formato v5 (todas las plataformas del catálogo, con editOpen). */
export function toV5Selection(sel, catalog) {
  const out = {};
  for (const p of catalog.platforms) {
    const e = sel[p.id];
    out[p.id] = { selected: !!(e && e.selected), devices: (e && e.devices) || p.baseDevices, editOpen: false };
  }
  return out;
}

/** Estado en formato v5, para que la versión anterior (misma dirección) vea los mismos datos. */
export function toV5Compatible(state, catalog) {
  return {
    platforms: JSON.parse(JSON.stringify(catalog.platforms)),
    selection: toV5Selection(state.selection, catalog),
    promoPct: state.promo.pct,
    savedCombos: state.savedCombos.map(c => ({ id: c.id, name: c.name, selection: toV5Selection(c.selection, catalog), promoPct: c.promoPct })),
    history: state.history.map(h => ({ id: h.id, ts: h.ts, name: h.name, text: h.text }))
  };
}

/** Huella de lo que el vendedor puede cambiar; sirve para saber si usó la versión anterior después de la nueva. */
export function fingerprint(state) {
  const sel = s => Object.keys(s).filter(id => s[id].selected).sort().map(id => `${id}:${s[id].devices}`).join(',');
  return JSON.stringify({
    s: sel(state.selection),
    p: state.promo.pct,
    c: state.savedCombos.map(c => [c.id, c.name, sel(c.selection), c.promoPct]),
    h: state.history.map(h => h.id)
  });
}
