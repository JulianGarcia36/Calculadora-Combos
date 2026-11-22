// Almacenamiento en el navegador. Única pieza que toca localStorage.
export const KEY_V6 = 'calculadora-combos-v6';
export const KEY_V5 = 'platforms-state-v5';
export const KEY_THEME = 'calculadora-combos-tema';

export function createStorage(win) {
  const ls = (() => { try { return win.localStorage; } catch { return null; } })();
  const read = key => {
    if (!ls) return { ok: false, error: 'El navegador no permite guardar datos.' };
    try {
      const raw = ls.getItem(key);
      if (raw === null) return { ok: true, value: null, raw: null };
      return { ok: true, value: JSON.parse(raw), raw };
    } catch (e) {
      return { ok: false, error: 'Los datos guardados están dañados.', raw: safeGet(ls, key) };
    }
  };
  const write = (key, value) => {
    if (!ls) return false;
    try { ls.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); return true; }
    catch { return false; }
  };
  return {
    available: !!ls,
    readV6: () => read(KEY_V6),
    readV5: () => read(KEY_V5),
    writeV6: v => write(KEY_V6, v),
    writeV5: v => write(KEY_V5, v),
    /** Copia de seguridad con fecha, que nunca se sobrescribe dentro del mismo día. */
    backupRaw: (prefix, raw, label) => {
      if (!ls || raw == null) return null;
      const key = `${prefix}.respaldo-${label}`;
      try { if (ls.getItem(key) === null) ls.setItem(key, raw); return key; } catch { return null; }
    },
    /** Preferencia visual (modo noche / día). No forma parte de los datos de cotización. */
    readTheme: () => { try { const v = ls && ls.getItem(KEY_THEME); return v === 'light' || v === 'dark' ? v : null; } catch { return null; } },
    writeTheme: v => { try { ls && ls.setItem(KEY_THEME, v); } catch { /* sin acción */ } },
    removeV6: () => { try { ls && ls.removeItem(KEY_V6); } catch { /* sin acción */ } },
    onExternalChange: cb => win.addEventListener('storage', e => { if (e.key === KEY_V6 || e.key === null) cb(); })
  };
}

function safeGet(ls, key) { try { return ls.getItem(key); } catch { return null; } }
