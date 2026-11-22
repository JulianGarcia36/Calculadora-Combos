// Entornos de prueba: la versión 6 y la versión 5 (script.js) compartiendo un mismo localStorage simulado.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createApp } from '../../../src/ui/app.js';
import { createStorage } from '../../../src/adapters/storage.js';

const require = createRequire(import.meta.url);
const { JSDOM } = require(process.env.JSDOM_PATH || 'jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '../../..');
export const catalog = JSON.parse(fs.readFileSync(path.join(repoRoot, 'catalog/catalog.json'), 'utf8'));
const golden = JSON.parse(fs.readFileSync(path.join(here, '../golden/golden-master-v5.json'), 'utf8'));
/** Catálogo de prueba: las reglas del catálogo oficial con los precios fijos del golden master.
 *  Así las pruebas de la interfaz no dependen de los precios vigentes (que el administrador puede cambiar). */
export const testCatalog = { ...catalog, catalogVersion: 'prueba', platforms: golden.catalog };

function newDom() {
  const dom = new JSDOM('<!DOCTYPE html><body><div class="app" id="app"></div><div class="toast" id="toast"></div></body>', { url: 'https://juliangarcia36.github.io/Calculadora-Combos/', runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.confirm = () => true;
  dom.window.alert = () => {};
  return dom;
}

function loadStore(win, store) { for (const [k, v] of Object.entries(store)) win.localStorage.setItem(k, v); }
export function dumpStore(win) { const out = {}; for (let i = 0; i < win.localStorage.length; i++) { const k = win.localStorage.key(i); out[k] = win.localStorage.getItem(k); } return out; }

/** Arranca la versión 6. clipboard: 'api' | 'exec-ok' | 'none' */
export function bootV6(store = {}, { clipboard = 'api', now, cat = testCatalog } = {}) {
  const dom = newDom();
  const win = dom.window;
  loadStore(win, store);
  win.__clip = null;
  if (clipboard === 'api') Object.defineProperty(win.navigator, 'clipboard', { value: { writeText: t => { win.__clip = t; return Promise.resolve(); } }, configurable: true });
  win.document.execCommand = cmd => clipboard === 'exec-ok' && cmd === 'copy';
  const app = createApp({ win, root: win.document.getElementById('app'), catalog: cat, storage: createStorage(win), version: 'prueba', legacyUrl: 'legacy/', now });
  return { win, doc: win.document, app, store: () => dumpStore(win) };
}

/** Arranca el script.js v5 (por defecto la versión anterior publicada en /legacy/). */
export function bootV5(store = {}, scriptPath = path.join(repoRoot, 'legacy/script.js')) {
  const dom = newDom();
  const win = dom.window;
  loadStore(win, store);
  Object.defineProperty(win.navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true });
  win.eval(fs.readFileSync(scriptPath, 'utf8') + '\nwindow.__v5 = { get platforms(){ return platforms; } };');
  return { win, doc: win.document, store: () => dumpStore(win) };
}

export const fire = (win, el, type) => el.dispatchEvent(new win.Event(type, { bubbles: true }));
export const click = (win, el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
export const tick = () => new Promise(r => setTimeout(r, 0));
