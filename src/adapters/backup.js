// Exportar e importar respaldos .json (acepta archivos v5 y v6).
import { SCHEMA_VERSION } from '../state/schema.js';

export const BACKUP_FORMAT = 'calculadora-combos/respaldo';

export function buildBackup(state, catalog, now = new Date()) {
  return { format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), catalogVersion: catalog.catalogVersion, state };
}

/** Fecha local AAAA-MM-DD (evita que después de las 7 p. m. salga la fecha de mañana). */
export function localDate(now = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function downloadJson(win, data, filename) {
  const blob = new win.Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = win.URL.createObjectURL(blob);
  const a = win.document.createElement('a');
  a.href = url;
  a.download = filename;
  win.document.body.appendChild(a);
  a.click();
  win.document.body.removeChild(a);
  win.URL.revokeObjectURL(url);
}

/** Reconoce el contenido de un archivo: {kind:'v6', state} | {kind:'v5', data} | {kind:'invalid', error}. */
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { kind: 'invalid', error: 'El archivo no es un respaldo válido (no es JSON).' }; }
  if (data && data.format === BACKUP_FORMAT && data.schemaVersion === SCHEMA_VERSION && data.state) return { kind: 'v6', state: data.state };
  if (data && typeof data === 'object' && !Array.isArray(data) && (Array.isArray(data.platforms) || Array.isArray(data.savedCombos) || Array.isArray(data.history) || (data.selection && typeof data.selection === 'object'))) {
    return { kind: 'v5', data };
  }
  return { kind: 'invalid', error: 'El archivo no tiene el formato de un respaldo de la calculadora.' };
}
