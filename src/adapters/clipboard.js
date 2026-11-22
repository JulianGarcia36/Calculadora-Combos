// Copiar al portapapeles con respaldo para navegadores integrados (WhatsApp, Instagram).
export async function copyText(win, text) {
  try {
    if (win.navigator && win.navigator.clipboard && win.isSecureContext !== false) {
      await win.navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* se intenta el método alternativo */ }
  try {
    const doc = win.document;
    const ta = doc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.className = 'clipboard-helper';
    doc.body.appendChild(ta);
    ta.select();
    const ok = typeof doc.execCommand === 'function' && doc.execCommand('copy');
    doc.body.removeChild(ta);
    return !!ok;
  } catch {
    return false;
  }
}
