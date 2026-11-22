// Pruebas del acceso con clave única (functions/_middleware.js, Cloudflare Pages).
import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/_middleware.js';

const BASE = 'https://calculadora.example.pages.dev';
const env = { CLAVE_VENDEDORES: 'tigre-azul-mango-42' };
const nextOk = async () => new Response('APP', { status: 200, headers: { 'Content-Type': 'text/html' } });
const run = (path, init = {}, e = env) => onRequest({ request: new Request(BASE + path, init), env: e, next: nextOk });
const login = async (clave, volver = '/') => run('/acceso', { method: 'POST', body: new URLSearchParams({ clave, volver }) });
const cookieOf = res => res.headers.get('Set-Cookie').split(';')[0];

test('sin clave configurada no deja entrar a nadie', async () => {
  assert.equal((await run('/', {}, {})).status, 500);
  assert.equal((await run('/', {}, { CLAVE_VENDEDORES: 'corta' })).status, 500);
});

test('sin sesión, cualquier dirección lleva a la página de acceso (incluido el catálogo)', async () => {
  for (const p of ['/', '/catalog/catalog.json', '/legacy/script.js', '/src/main.js']) {
    const r = await run(p);
    assert.equal(r.status, 302, p);
    assert.equal(r.headers.get('Location'), '/acceso?volver=' + encodeURIComponent(p));
  }
  const form = await run('/acceso?volver=/');
  assert.equal(form.status, 200);
  assert.match(await form.text(), /type="password"/);
});

test('clave incorrecta: 401 y sin cookie; clave correcta: cookie de 30 días y vuelve a donde iba', async () => {
  const mal = await login('otra-clave');
  assert.equal(mal.status, 401);
  assert.equal(mal.headers.get('Set-Cookie'), null);
  const bien = await login('tigre-azul-mango-42', '/legacy/');
  assert.equal(bien.status, 303);
  assert.equal(bien.headers.get('Location'), '/legacy/');
  assert.match(bien.headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=Lax/);
  assert.match(bien.headers.get('Set-Cookie'), /Max-Age=2592000/);
});

test('con sesión se ve la calculadora con cabeceras de seguridad; las carpetas internas no se publican', async () => {
  const c = cookieOf(await login('tigre-azul-mango-42'));
  const r = await run('/', { headers: { Cookie: c } });
  assert.equal(r.status, 200);
  assert.equal(await r.text(), 'APP');
  assert.equal(r.headers.get('X-Frame-Options'), 'DENY');
  for (const p of ['/equivalencia/tests/golden/golden-master-v5.json', '/functions/_middleware.js', '/.github/workflows/precios.yml']) {
    assert.equal((await run(p, { headers: { Cookie: c } })).status, 404, p);
  }
  assert.equal((await run('/config/sitio.json', { headers: { Cookie: c } })).status, 200);
});

test('cambiar la clave en Cloudflare cierra la sesión de todos', async () => {
  const c = cookieOf(await login('tigre-azul-mango-42'));
  const r = await run('/', { headers: { Cookie: c } }, { CLAVE_VENDEDORES: 'nueva-clave-segura-7' });
  assert.equal(r.status, 302);
  assert.equal((await run('/', { headers: { Cookie: 'acceso_calc=inventada' } })).status, 302);
});

test('no se puede usar el acceso para redirigir a otro sitio', async () => {
  for (const v of ['https://malo.com', '//malo.com', '/\\malo.com']) {
    const r = await login('tigre-azul-mango-42', v);
    assert.equal(r.headers.get('Location'), '/', v);
  }
  const f = await (await run('/acceso?volver=' + encodeURIComponent('"><script>x</script>'))).text();
  assert.doesNotMatch(f, /<script>x/);
});

test('cerrar sesión borra la cookie', async () => {
  const r = await run('/salir');
  assert.equal(r.status, 303);
  assert.match(r.headers.get('Set-Cookie'), /Max-Age=0/);
});
