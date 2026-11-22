// Cloudflare Pages Functions: acceso con UNA clave compartida para todos los vendedores.
// La clave vive en Cloudflare como variable secreta CLAVE_VENDEDORES (nunca en el repositorio).
// Al entrar, el navegador guarda una cookie por 30 días. Cambiar la clave cierra la sesión de todos.

const COOKIE = 'acceso_calc';
const DIAS = 30;
const PRIVADO = [/^\/equivalencia(\/|$)/, /^\/functions(\/|$)/, /^\/\.github(\/|$)/, /^\/config\/(?!sitio\.json$)/];
const SEGURIDAD = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow'
};

const enc = new TextEncoder();
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function firmar(clave) {
  const key = await crypto.subtle.importKey('raw', enc.encode(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode('calculadora-combos/acceso/v1')));
}

/** Comparación en tiempo constante (sobre los hash, para que la longitud no importe). */
async function iguales(a, b) {
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(String(s)))));
  const ua = new Uint8Array(x), ub = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

function leerCookie(header, nombre) {
  for (const parte of (header || '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return v.join('=');
  }
  return null;
}

/** Solo rutas internas (evita redirecciones a otros sitios). */
function destinoSeguro(v) {
  const s = String(v || '/');
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') && !s.startsWith('/acceso') ? s : '/';
}

const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function pagina(mensaje, status, volver) {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Calculadora de Combos · Acceso</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0A0F14;color:#E8EDF2;font-family:Inter,system-ui,sans-serif;padding:16px;box-sizing:border-box}
form{background:#111820;border:1px solid rgba(232,237,242,.09);border-radius:12px;padding:24px;width:100%;max-width:360px;box-sizing:border-box}
h1{font-size:20px;margin:0 0 6px}p{color:#8593A3;font-size:13px;margin:0 0 16px}
label{display:block;font-size:13px;color:#8593A3;margin-bottom:6px}
input{width:100%;box-sizing:border-box;background:#161F29;border:1px solid rgba(232,237,242,.15);color:#E8EDF2;border-radius:8px;padding:12px;font-size:16px}
button{margin-top:14px;width:100%;background:#6C5CE7;color:#fff;border:0;border-radius:8px;padding:12px;font-size:15px;font-weight:600;cursor:pointer}
.error{color:#FF6B6B;font-size:13px;margin:10px 0 0}
</style></head><body>
<form method="post" action="/acceso">
<h1>Calculadora de Combos</h1>
<p>Escribe la clave de acceso que te dio el administrador.</p>
<input type="text" name="usuario" value="vendedores" autocomplete="username" hidden>
<label for="clave">Clave</label>
<input id="clave" name="clave" type="password" autocomplete="current-password" required autofocus>
<input type="hidden" name="volver" value="${escapar(destinoSeguro(volver))}">
<button type="submit">Entrar</button>
${mensaje ? `<div class="error" role="alert">${escapar(mensaje)}</div>` : ''}
</form></body></html>`;
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      ...SEGURIDAD
    }
  });
}

const espera = ms => new Promise(r => setTimeout(r, ms));

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const clave = env && env.CLAVE_VENDEDORES;
  if (!clave || String(clave).length < 8) {
    return new Response('Falta configurar la variable CLAVE_VENDEDORES (mínimo 8 caracteres) en Cloudflare Pages.', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
  const token = await firmar(clave);

  if (url.pathname === '/acceso') {
    if (request.method === 'POST') {
      const form = await request.formData();
      if (await iguales(form.get('clave') || '', clave)) {
        return new Response(null, {
          status: 303,
          headers: {
            Location: destinoSeguro(form.get('volver')),
            'Set-Cookie': `${COOKIE}=${token}; Path=/; Max-Age=${DIAS * 86400}; HttpOnly; Secure; SameSite=Lax`,
            'Cache-Control': 'no-store'
          }
        });
      }
      await espera(800); // frena intentos repetidos
      return pagina('Clave incorrecta.', 401, form.get('volver'));
    }
    return pagina('', 200, url.searchParams.get('volver'));
  }

  if (url.pathname === '/salir') {
    return new Response(null, { status: 303, headers: { Location: '/acceso', 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }

  const cookie = leerCookie(request.headers.get('Cookie'), COOKIE);
  if (!cookie || !(await iguales(cookie, token))) {
    return new Response(null, { status: 302, headers: { Location: '/acceso?volver=' + encodeURIComponent(url.pathname + url.search), 'Cache-Control': 'no-store' } });
  }

  if (PRIVADO.some(r => r.test(url.pathname))) return new Response('No encontrado', { status: 404 });

  const res = await next();
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SEGURIDAD)) out.headers.set(k, v);
  out.headers.set('Cache-Control', 'private, no-cache');
  return out;
}
