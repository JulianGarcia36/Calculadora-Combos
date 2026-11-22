// Arranque de la versión 6 en el navegador.
import { createApp } from './ui/app.js';
import { createStorage } from './adapters/storage.js';
import { validateCatalog } from './domain/catalog.js';

export const VERSION = '6.0.0-piloto';

function showFatal(root, title, lines) {
  root.textContent = '';
  const box = document.createElement('div');
  box.className = 'notice error';
  const h = document.createElement('div');
  h.className = 'notice-title';
  h.textContent = title;
  box.appendChild(h);
  lines.forEach(l => { const p = document.createElement('div'); p.textContent = l; box.appendChild(p); });
  const wrap = document.createElement('div');
  wrap.className = 'notices';
  wrap.appendChild(box);
  root.appendChild(wrap);
}

async function start() {
  const root = document.getElementById('app');
  const legacyUrl = root.dataset.legacyUrl || null;
  let catalog;
  try {
    const res = await fetch(new URL('../catalog/catalog.json', import.meta.url), { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    catalog = await res.json();
  } catch (e) {
    showFatal(root, 'No se pudo cargar el catálogo de precios', ['Revisa tu conexión y recarga la página.', legacyUrl ? 'Mientras tanto puedes usar la versión anterior.' : '']);
    return;
  }
  const v = validateCatalog(catalog);
  if (!v.ok) {
    showFatal(root, 'El catálogo de precios tiene errores; avisa al administrador', v.errors);
    return;
  }
  createApp({ win: window, root, catalog, storage: createStorage(window), version: VERSION, legacyUrl });
}

start();
