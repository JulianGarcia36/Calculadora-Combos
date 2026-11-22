// Reglas de descuento definidas por el negocio (DEC-02 y DEC-03, 22 nov 2026).
// El vendedor escribe el porcentaje; la calculadora sugiere el tramo y aplica un tope.
// La fórmula del descuento (BR-06) vive en pricing.js y NO se modifica aquí.

/** Porcentaje sugerido según cuántas plataformas hay marcadas (0 si no aplica ningún tramo). */
export function suggestedDiscount(tiers, platformCount) {
  let pct = 0;
  for (const t of tiers || []) {
    if (platformCount >= t.minPlatforms && t.pct > pct) pct = t.pct;
  }
  return pct;
}

/**
 * Valida lo que el vendedor escribe en el campo de descuento.
 * Vacío = sin descuento (igual que v5). Devuelve el número tal cual (sin redondear) si es válido.
 */
export function validatePromo(raw, maxPct) {
  const text = String(raw ?? '').trim().replace(',', '.');
  if (text === '') return { ok: true, value: 0 };
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, error: 'Escribe solo números.' };
  if (value < 0) return { ok: false, error: 'El descuento no puede ser negativo.' };
  if (value > maxPct) return { ok: false, error: `El descuento máximo es ${maxPct} %.` };
  return { ok: true, value };
}
