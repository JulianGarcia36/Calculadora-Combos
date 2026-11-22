// Validación del catálogo oficial (catalog/catalog.json). Sin DOM ni almacenamiento.
import { ALL_DURATIONS } from './pricing.js';

export function validateCatalog(cat) {
  const errors = [];
  if (!cat || typeof cat !== 'object') return { ok: false, errors: ['El catálogo no es un objeto.'] };
  if (typeof cat.catalogVersion !== 'string' || !cat.catalogVersion) errors.push('Falta catalogVersion.');
  if (!(typeof cat.maxDiscountPct === 'number' && cat.maxDiscountPct >= 0 && cat.maxDiscountPct <= 100)) errors.push('maxDiscountPct debe estar entre 0 y 100.');
  if (!Array.isArray(cat.discountTiers)) errors.push('discountTiers debe ser una lista.');
  else cat.discountTiers.forEach((t, i) => {
    if (!Number.isInteger(t.minPlatforms) || t.minPlatforms < 1) errors.push(`Tramo ${i + 1}: minPlatforms inválido.`);
    if (!(typeof t.pct === 'number' && t.pct >= 0 && t.pct <= cat.maxDiscountPct)) errors.push(`Tramo ${i + 1}: pct debe estar entre 0 y maxDiscountPct.`);
  });
  if (!Array.isArray(cat.platforms) || cat.platforms.length === 0) {
    errors.push('platforms debe ser una lista con al menos una plataforma.');
    return { ok: false, errors };
  }
  const seen = new Set();
  cat.platforms.forEach((p, i) => {
    const where = `Plataforma ${i + 1}${p && p.id ? ` (${p.id})` : ''}`;
    if (!p || typeof p !== 'object') { errors.push(`${where}: no es un objeto.`); return; }
    if (typeof p.id !== 'string' || !/^[a-z0-9_-]+$/.test(p.id)) errors.push(`${where}: id inválido.`);
    else if (seen.has(p.id)) errors.push(`${where}: id repetido.`);
    seen.add(p.id);
    if (typeof p.name !== 'string' || !p.name.trim()) errors.push(`${where}: falta el nombre.`);
    if (!Number.isInteger(p.baseDevices) || p.baseDevices < 1) errors.push(`${where}: baseDevices debe ser un entero ≥ 1.`);
    if (p.badge !== undefined && typeof p.badge !== 'string') errors.push(`${where}: badge debe ser texto.`);
    if (!p.table || typeof p.table !== 'object') { errors.push(`${where}: falta la tabla de precios.`); return; }
    const keys = Object.keys(p.table);
    if (keys.length === 0) errors.push(`${where}: la tabla de precios está vacía.`);
    keys.forEach(k => {
      if (!ALL_DURATIONS.includes(Number(k))) errors.push(`${where}: duración ${k} no permitida.`);
      const v = p.table[k];
      if (!(typeof v === 'number' && Number.isFinite(v) && v > 0)) errors.push(`${where}: precio de ${k} meses debe ser un número mayor que 0.`);
    });
  });
  return { ok: errors.length === 0, errors };
}
