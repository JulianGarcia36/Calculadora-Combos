const ALL_DURATIONS = [1,2,3,6,12,24];

const DEFAULT_PLATFORMS = [
  {id:'crunchy',    name:'CR∪NCH¥R0££',                baseDevices:1, table:{1:50,2:95,3:140,6:270,12:520}},
  {id:'deezer',     name:'D€€Z€R M∪$!C',                baseDevices:1, table:{1:50,2:95,3:140,6:270,12:520}},
  {id:'prime',      name:'ΔMΔZØN ₱R!M€ V!D€Ø',          baseDevices:1, table:{1:50,2:95,3:140,6:270,12:520}},
  {id:'hbomax',     name:'Hß0-₥ΔX',                     baseDevices:1, table:{1:50,2:95,3:140,6:270,12:520}},
  {id:'iptv',       name:'!₽TV',                        baseDevices:1, table:{1:50,2:95,3:140,6:270,12:520,24:1000}},
  {id:'plex',       name:'₱L€X',                        baseDevices:1, table:{1:50,2:95,3:140,6:270,12:520}},
  {id:'paramount',  name:'P₳R₳MØ∪N₮✚',                  baseDevices:1, table:{1:50,2:95,3:140,6:270,12:520}},
  {id:'vix',        name:'V!X PREMIUM',                 baseDevices:1, table:{1:50,2:95,3:140,6:270,12:520}},
  {id:'universal',  name:'∪N!V€R$₳Ⱡ',                   baseDevices:1, table:{1:50,2:95,3:140,6:270,12:520}},
  {id:'youtube',    name:'¥Ø∪₮∪฿€ PREMIUM',             baseDevices:1, table:{1:65}, badge:'SOLO 1 MES'},
  {id:'disney',     name:'D1sn3y✚',                     baseDevices:1, table:{1:70,2:130,3:190,6:380,12:740}},
  {id:'disneyespn', name:'D1sn3y✚ + 3SPN',               baseDevices:1, table:{1:90,2:170,3:245,6:490,12:950}},
  {id:'netflix',    name:'N3T₣L!X PREMIUM',             baseDevices:1, table:{1:75,2:140,3:200,6:390,12:760}},
  {id:'gemini',     name:'₲€₥!₦!',                      baseDevices:1, table:{1:120,2:230,3:340,6:670,12:1300}, badge:'SE ACTIVA CON TU CORREO'},
  {id:'canva',      name:'C₳NV₳',                       baseDevices:1, table:{1:70,2:130,3:190,6:380,12:740}},
  {id:'spotify',    name:'$P0T!₣¥ Premium',             baseDevices:1, table:{1:75,2:125,3:160,6:300,12:580}},
  {id:'appletv',    name:'₳₱₱ⱠɆ ₮V',                    baseDevices:1, table:{1:60,2:110,3:165,6:330,12:600}},
  {id:'magis',      name:'MΔG!$ ₸V (₣L∪JØ ₸V)',         baseDevices:1, table:{1:120,2:230,3:340,6:670,12:1300}, badge:'POR ENCARGO'},
];

let platforms = JSON.parse(JSON.stringify(DEFAULT_PLATFORMS));
let selection = {};      // id -> {selected, devices, editOpen}
let promoPct = 0;
let savedCombos = [];    // {id, name, selection, promoPct}
let history = [];        // {id, ts, name, text}
let searchTerm = '';

function selEntry(id, qty){ return {[id]: {selected:true, devices:qty, editOpen:false}}; }
function mergeSel(...entries){ return Object.assign({}, ...entries); }

const SEED_COMBOS = [
  {
    name: 'Trío Fuerte (N3T₣L!X + D1sn3y✚ + V!X)',
    selection: mergeSel(selEntry('netflix',1), selEntry('disney',1), selEntry('vix',1)),
    promoPct: 10
  },
  {
    name: 'Cuarteto Todo Terreno (N3T₣L!X + D1sn3y✚ + Hß0-₥ΔX + ΔMΔZØN ₱R!M€)',
    selection: mergeSel(selEntry('netflix',1), selEntry('disney',1), selEntry('hbomax',1), selEntry('prime',1)),
    promoPct: 10
  },
  {
    name: 'Revive (CR∪NCH¥R0££ + ∪N!V€R$₳Ⱡ + P₳R₳MØ∪N₮✚)',
    selection: mergeSel(selEntry('crunchy',1), selEntry('universal',1), selEntry('paramount',1)),
    promoPct: 15
  }
];

function round5(n){ return Math.round(n/5)*5; }
function fmt(n){ return '$' + n.toLocaleString('es-CO'); }
function isCustom(id){ return !DEFAULT_PLATFORMS.some(d => d.id === id); }

function getSel(id){
  if(!selection[id]) selection[id] = {selected:false, devices: (platforms.find(p=>p.id===id)||{}).baseDevices || 1, editOpen:false};
  return selection[id];
}

function itemPriceByDuration(item, duration){
  const s = getSel(item.id);
  const qty = s.devices || item.baseDevices;
  const base = item.table[duration];
  if(base === undefined) return undefined;
  if(qty === item.baseDevices) return base;
  return round5(base / item.baseDevices * qty);
}

function selectedItems(){
  return platforms.filter(p => selection[p.id] && selection[p.id].selected);
}

function commonDurations(items){
  if(items.length === 0) return [1,2,3,6,12];
  return ALL_DURATIONS.filter(d => items.every(it => it.table[d] !== undefined));
}

function computeTotals(items, durations){
  const totals = {};
  durations.forEach(d => {
    let sum = 0;
    items.forEach(it => sum += itemPriceByDuration(it, d));
    totals[d] = sum;
  });
  return totals;
}

function deviceWord(item, qty){
  if(item.id === 'netflix') return qty === 1 ? 'p€rfil' : 'p€rfil€s';
  return qty === 1 ? 'Dispositivo' : 'Dispositivos';
}

function deviceLabel(items){
  if(items.length === 0) return 1;
  if(items.length === 1) return getSel(items[0].id).devices || items[0].baseDevices;
  return Math.max(...items.map(it => getSel(it.id).devices || it.baseDevices));
}

function comboName(items){
  return items.map(it => {
    const qty = getSel(it.id).devices || it.baseDevices;
    if(items.length > 1 && qty >= 2){
      return `${it.name} (${qty} ${deviceWord(it, qty)})`;
    }
    if(items.length === 1 && it.id === 'netflix' && qty !== 1){
      return `N3T₣L!X PREMIUM (${qty} p€rfil€s)`;
    }
    return it.name;
  }).join(' + ');
}

function durLabel(d){ return d === 1 ? '1 mes' : d + ' meses'; }

function render(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div>
      <div class="panel">
        <div class="header">
          <div class="eyebrow">Catálogo</div>
          <h1>Armar combo</h1>
          <p>Marca las plataformas, ajusta dispositivos y toca ✎ para editar cualquier precio.</p>
        </div>
        <input type="text" id="searchInput" class="search-input" placeholder="Buscar plataforma..." value="${searchTerm}">
        <div id="platformList"></div>
      </div>

      <div class="panel">
        <div class="section-label">Promoción del día</div>
        <div class="promo-row">
          <label>Descuento extra</label>
          <input type="number" id="promoInput" min="0" max="90" value="${promoPct}"> <span style="color:var(--muted);font-size:13px;">%</span>
        </div>
        <div class="footnote">Se aplica sobre el total ya calculado de cada duración, solo para esta cotización.</div>
      </div>

      <details class="panel" id="newPlatDetails">
        <summary><span class="eyebrow" style="margin-bottom:0;">+ Agregar plataforma nueva</span><span class="chev">▾</span></summary>
        <div class="panel-inner" id="newPlatForm"></div>
      </details>

      <div class="panel">
        <div class="section-label">Respaldo de datos</div>
        <div class="footnote" style="margin-top:0;margin-bottom:10px;">Tus combos y precios se guardan solo en este navegador. Exporta un respaldo si vas a cambiar de dispositivo o navegador.</div>
        <div class="btn-row" style="padding:0;flex-wrap:wrap;">
          <button class="btn small" id="exportBtn">Exportar respaldo</button>
          <button class="btn small secondary" id="importBtn">Importar respaldo</button>
          <button class="btn small secondary danger-btn" id="resetAllBtn">Restablecer todo</button>
        </div>
        <input type="file" id="importFile" accept=".json" style="display:none;">
      </div>
    </div>

    <div>
      <div class="ticket">
        <div class="ticket-top">
          <div class="eyebrow">Cotización</div>
          <div class="ticket-name" id="ticketName">Selecciona al menos una plataforma</div>
          <div class="ticket-sub" id="ticketSub"></div>
        </div>
        <div class="ticket-body" id="ticketBody"></div>
      </div>

      <div class="panel">
        <div class="section-label">Combos guardados</div>
        <div class="save-row" style="margin-bottom:10px;">
          <input type="text" id="saveComboName" placeholder="Nombre para el combo actual...">
          <button class="btn small" id="saveComboBtn">Guardar</button>
        </div>
        <div id="savedCombosList"></div>
      </div>

      <div class="panel">
        <div class="section-label">Historial de cotizaciones</div>
        <div id="historyList"></div>
      </div>
    </div>
  `;

  renderPlatformList();
  renderNewPlatForm();
  renderSavedCombos();
  renderHistory();

  document.getElementById('searchInput').addEventListener('input', e => {
    searchTerm = e.target.value;
    renderPlatformList();
  });

  document.getElementById('promoInput').addEventListener('input', e => {
    promoPct = parseFloat(e.target.value) || 0;
    renderTicket();
    persist();
  });

  document.getElementById('saveComboBtn').addEventListener('click', () => {
    const items = selectedItems();
    if(items.length === 0) return;
    const nameInput = document.getElementById('saveComboName');
    const name = nameInput.value.trim() || comboName(items);
    savedCombos.unshift({
      id: 'combo_' + Date.now(),
      name,
      selection: JSON.parse(JSON.stringify(selection)),
      promoPct
    });
    nameInput.value = '';
    renderSavedCombos();
    persist();
  });

  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importData);
  document.getElementById('resetAllBtn').addEventListener('click', resetAll);

  renderTicket();
}

function renderPlatformList(){
  const list = document.getElementById('platformList');
  list.innerHTML = '';

  const term = searchTerm.trim().toLowerCase();
  const filtered = term
    ? platforms.filter(p => p.name.toLowerCase().includes(term) || p.id.toLowerCase().includes(term))
    : platforms;

  if(filtered.length === 0){
    list.innerHTML = '<div class="empty-mini">No se encontraron plataformas con ese nombre.</div>';
    return;
  }

  filtered.forEach(p => {
    const s = getSel(p.id);
    const wrap = document.createElement('div');
    wrap.className = 'item' + (s.selected ? ' checked' : '');

    const durKeys = ALL_DURATIONS.filter(d => p.table[d] !== undefined);
    const editFields = durKeys.map(d => `
      <div class="edit-field">
        <label>${d} m</label>
        <input type="number" data-edit-id="${p.id}" data-edit-dur="${d}" value="${p.table[d]}">
      </div>`).join('');

    wrap.innerHTML = `
      <div class="item-row">
        <input type="checkbox" ${s.selected ? 'checked' : ''} data-id="${p.id}">
        <div class="item-name">${p.name}${p.badge ? `<span class="badge">${p.badge}</span>` : ''}${isCustom(p.id) ? `<span class="badge" style="color:var(--accent);border-color:rgba(108,92,231,.4);">NUEVA</span>` : ''}</div>
        <div class="stepper">
          <button data-action="dec" data-id="${p.id}">−</button>
          <span>${s.devices}</span>
          <button data-action="inc" data-id="${p.id}">+</button>
        </div>
        ${!isCustom(p.id) ? `<button class="icon-btn" data-reset="${p.id}" title="Restablecer precio de catálogo">↺</button>` : ''}
        <button class="icon-btn" data-toggle="${p.id}" title="Editar precios">✎</button>
        ${isCustom(p.id) ? `<button class="icon-btn danger" data-remove="${p.id}" title="Eliminar plataforma">✕</button>` : ''}
      </div>
      <div class="edit-panel ${s.editOpen ? 'open' : ''}" data-panel="${p.id}">
        ${editFields}
      </div>
    `;
    list.appendChild(wrap);
  });

  list.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', e => {
      const id = e.target.dataset.id;
      getSel(id).selected = e.target.checked;
      renderPlatformList();
      renderTicket();
      persist();
    });
  });

  list.querySelectorAll('.stepper button').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.target.dataset.id;
      const item = platforms.find(x => x.id === id);
      const s = getSel(id);
      let q = s.devices || item.baseDevices;
      q = e.target.dataset.action === 'inc' ? Math.min(q+1, 10) : Math.max(q-1, 1);
      s.devices = q;
      renderPlatformList();
      renderTicket();
      persist();
    });
  });

  list.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.target.dataset.toggle;
      getSel(id).editOpen = !getSel(id).editOpen;
      renderPlatformList();
    });
  });

  list.querySelectorAll('[data-reset]').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.target.dataset.reset;
      const def = DEFAULT_PLATFORMS.find(d => d.id === id);
      const item = platforms.find(x => x.id === id);
      if(def && item){
        item.table = JSON.parse(JSON.stringify(def.table));
        item.baseDevices = def.baseDevices;
      }
      renderPlatformList();
      renderTicket();
      persist();
    });
  });

  list.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.target.dataset.remove;
      const item = platforms.find(x => x.id === id);
      if(!confirm(`¿Eliminar "${item ? item.name : 'esta plataforma'}"? Esta acción no se puede deshacer.`)) return;
      platforms = platforms.filter(x => x.id !== id);
      delete selection[id];
      renderPlatformList();
      renderTicket();
      persist();
    });
  });

  list.querySelectorAll('input[data-edit-id]').forEach(inp => {
    inp.addEventListener('change', e => {
      const id = e.target.dataset.editId;
      const dur = parseInt(e.target.dataset.editDur);
      const val = parseFloat(e.target.value) || 0;
      const item = platforms.find(x => x.id === id);
      item.table[dur] = val;
      renderTicket();
      persist();
    });
  });
}

function renderNewPlatForm(){
  const el = document.getElementById('newPlatForm');
  el.innerHTML = `
    <div class="new-plat-form">
      <input type="text" id="npName" placeholder="Nombre de la plataforma">
      <div class="row2">
        <div style="width:120px;">
          <label style="font-size:9.5px;color:var(--muted);font-family:'JetBrains Mono',monospace;text-transform:uppercase;display:block;margin-bottom:3px;">Dispositivos base</label>
          <input type="number" id="npDevices" value="1" min="1">
        </div>
      </div>
      <div class="grid5">
        <div><label>1 mes</label><input type="number" id="np1"></div>
        <div><label>2 meses</label><input type="number" id="np2"></div>
        <div><label>3 meses</label><input type="number" id="np3"></div>
        <div><label>6 meses</label><input type="number" id="np6"></div>
        <div><label>12 meses</label><input type="number" id="np12"></div>
      </div>
      <button class="btn small" id="npAddBtn" style="align-self:flex-start;">Agregar plataforma</button>
    </div>
  `;
  document.getElementById('npAddBtn').addEventListener('click', () => {
    const name = document.getElementById('npName').value.trim();
    if(!name) return;
    const baseDevices = parseInt(document.getElementById('npDevices').value) || 1;
    const table = {};
    [1,2,3,6,12].forEach(d => {
      const v = parseFloat(document.getElementById('np'+d).value);
      if(!isNaN(v) && v > 0) table[d] = v;
    });
    if(Object.keys(table).length === 0) return;
    const id = 'custom_' + Date.now();
    platforms.push({id, name, baseDevices, table});
    document.getElementById('newPlatDetails').removeAttribute('open');
    renderPlatformList();
    persist();
  });
}

function renderSavedCombos(){
  const el = document.getElementById('savedCombosList');
  if(savedCombos.length === 0){
    el.innerHTML = '<div class="empty-mini">Aún no has guardado ningún combo.</div>';
    return;
  }
  el.innerHTML = savedCombos.map(c => `
    <div class="list-row">
      <div class="list-main">
        <div class="list-title">${c.name}</div>
        <div class="list-sub">${c.promoPct > 0 ? 'Promo -' + c.promoPct + '%' : 'Sin promo'}</div>
      </div>
      <button class="btn small secondary" data-use-combo="${c.id}">Usar</button>
      <button class="icon-btn danger" data-del-combo="${c.id}" title="Eliminar">✕</button>
    </div>
  `).join('');

  el.querySelectorAll('[data-use-combo]').forEach(btn => {
    btn.addEventListener('click', e => {
      const c = savedCombos.find(x => x.id === e.target.dataset.useCombo);
      if(!c) return;
      selection = JSON.parse(JSON.stringify(c.selection));
      promoPct = c.promoPct || 0;
      render();
      persist();
    });
  });
  el.querySelectorAll('[data-del-combo]').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.target.dataset.delCombo;
      const combo = savedCombos.find(c => c.id === id);
      if(!confirm(`¿Eliminar el combo guardado "${combo ? combo.name : ''}"?`)) return;
      savedCombos = savedCombos.filter(x => x.id !== id);
      renderSavedCombos();
      persist();
    });
  });
}

function renderHistory(){
  const el = document.getElementById('historyList');
  if(history.length === 0){
    el.innerHTML = '<div class="empty-mini">Las cotizaciones que copies quedarán aquí.</div>';
    return;
  }
  el.innerHTML = history.map(h => `
    <div class="list-row">
      <div class="list-main">
        <div class="list-title">${h.name}</div>
        <div class="list-sub">${h.ts}</div>
      </div>
      <button class="btn small secondary" data-copy-hist="${h.id}">Copiar</button>
      <button class="icon-btn danger" data-del-hist="${h.id}" title="Eliminar">✕</button>
    </div>
  `).join('');

  el.querySelectorAll('[data-copy-hist]').forEach(btn => {
    btn.addEventListener('click', e => {
      const h = history.find(x => x.id === e.target.dataset.copyHist);
      if(!h) return;
      navigator.clipboard.writeText(h.text).then(() => showToast());
    });
  });
  el.querySelectorAll('[data-del-hist]').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.target.dataset.delHist;
      if(!confirm('¿Eliminar esta cotización del historial?')) return;
      history = history.filter(x => x.id !== id);
      renderHistory();
      persist();
    });
  });
}

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg || 'Copiado ✓';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1400);
}

function renderTicket(){
  const items = selectedItems();
  const nameEl = document.getElementById('ticketName');
  const subEl = document.getElementById('ticketSub');
  const bodyEl = document.getElementById('ticketBody');

  if(items.length === 0){
    nameEl.textContent = 'Selecciona al menos una plataforma';
    subEl.textContent = '';
    bodyEl.innerHTML = '<div class="empty-state">El combo aparecerá aquí con sus precios reales por duración.</div>';
    return;
  }

  const durations = commonDurations(items);
  const name = comboName(items);
  nameEl.textContent = name;
  const devices = deviceLabel(items);
  subEl.textContent = promoPct > 0 ? `Promo activa: -${promoPct}%` : 'Sin promoción activa';

  const totals = computeTotals(items, durations);
  let rowsHtml = '';
  durations.forEach(d => {
    const base = totals[d];
    const withPromo = promoPct > 0 ? round5(base * (1 - promoPct/100)) : base;
    rowsHtml += `
      <div class="row-line">
        <div class="dur">${durLabel(d)}</div>
        <div class="price-cell">
          ${promoPct > 0 ? `<span class="orig">${fmt(base)}</span>` : ''}
          <span class="final ${promoPct > 0 ? 'discounted' : ''}">${fmt(withPromo)}</span>
        </div>
      </div>`;
  });

  const copyText = buildCopyText(name, totals, durations, devices, items);

  const qtys = items.map(it => getSel(it.id).devices || it.baseDevices);
  const uniform = qtys.every(q => q === qtys[0]);
  let tagHtml = '';
  if(items.length === 1){
    tagHtml = `<div class="devices-tag">${devices} ${deviceWord(items[0], devices)}</div>`;
  } else if(uniform && qtys[0] === 1){
    tagHtml = `<div class="devices-tag">1 Dispositivo</div>`;
  }

  bodyEl.innerHTML = `
    ${rowsHtml}
    ${tagHtml}
    <div class="copy-block"><pre id="copyText">${copyText}</pre></div>
    <div class="btn-row" style="padding-left:0;padding-right:0;">
      <button class="btn" id="copyBtn">Copiar para enviar</button>
      <button class="btn secondary" id="resetBtn">Limpiar combo</button>
    </div>
  `;

  document.getElementById('copyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(copyText).then(() => {
      showToast();
      history.unshift({id:'hist_'+Date.now(), ts:new Date().toLocaleString('es-CO'), name, text:copyText});
      if(history.length > 20) history = history.slice(0,20);
      renderHistory();
      persist();
    });
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    Object.keys(selection).forEach(k => selection[k].selected = false);
    promoPct = 0;
    render();
    persist();
  });
}

function buildCopyText(name, totals, durations, devices, items){
  const lines = [];
  lines.push(name);
  if(promoPct > 0){
    lines.push(`🔥 Precio con -${promoPct}% de descuento`);
  }
  durations.forEach(d => {
    const base = totals[d];
    const withPromo = promoPct > 0 ? round5(base * (1 - promoPct/100)) : base;
    if(promoPct > 0){
      lines.push(`- ${durLabel(d)}: ~${fmt(base)}~ ${fmt(withPromo)}`);
    } else {
      lines.push(`- ${durLabel(d)}: ${fmt(withPromo)}`);
    }
  });
  const qtys = items.map(it => getSel(it.id).devices || it.baseDevices);
  const uniform = qtys.every(q => q === qtys[0]);
  if(items.length === 1){
    lines.push(`${devices} ${deviceWord(items[0], devices)}`);
  } else if(uniform && qtys[0] === 1){
    lines.push('1 Dispositivo');
  }
  return lines.join('\n');
}

function exportData(){
  const data = {platforms, selection, promoPct, savedCombos, history};
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'respaldo-combos-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Respaldo descargado ✓');
}

function importData(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      if(data.platforms) platforms = data.platforms;
      if(data.selection) selection = data.selection;
      if(typeof data.promoPct === 'number') promoPct = data.promoPct;
      if(data.savedCombos) savedCombos = data.savedCombos;
      if(data.history) history = data.history;
      persist();
      render();
      showToast('Respaldo importado ✓');
    }catch(err){
      alert('El archivo no es un respaldo válido.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function resetAll(){
  if(!confirm('¿Seguro que quieres borrar todos los datos guardados en este navegador? Esta acción no se puede deshacer.')) return;
  localStorage.removeItem('platforms-state-v5');
  platforms = JSON.parse(JSON.stringify(DEFAULT_PLATFORMS));
  selection = {};
  promoPct = 0;
  savedCombos = [];
  history = [];
  loadState();
}

function persist(){
  try{
    localStorage.setItem('platforms-state-v5', JSON.stringify({platforms, selection, promoPct, savedCombos, history}));
  }catch(e){
    console.error('No se pudo guardar', e);
  }
}

function loadState(){
  try{
    const raw = localStorage.getItem('platforms-state-v5');
    if(raw){
      const data = JSON.parse(raw);
      if(data.platforms){
        platforms = data.platforms;
        DEFAULT_PLATFORMS.forEach(def => {
          if(!platforms.some(p => p.id === def.id)){
            platforms.push(JSON.parse(JSON.stringify(def)));
          }
        });
      }
      if(data.selection) selection = data.selection;
      if(typeof data.promoPct === 'number') promoPct = data.promoPct;
      if(data.savedCombos) savedCombos = data.savedCombos;
      if(data.history) history = data.history;
    }
  }catch(e){
    /* sin estado guardado aún, o el navegador bloquea almacenamiento local */
  }
  const crunchyItem = platforms.find(p => p.id === 'crunchy');
  if(crunchyItem) crunchyItem.table = {1:50,2:95,3:140,6:270,12:520};
  const paramountItem = platforms.find(p => p.id === 'paramount');
  if(paramountItem) paramountItem.table = {1:50,2:95,3:140,6:270,12:520};
  SEED_COMBOS.forEach(seed => {
    if(!savedCombos.some(c => c.name === seed.name)){
      savedCombos.push({
        id: 'combo_seed_' + Math.random().toString(36).slice(2,7),
        name: seed.name,
        selection: JSON.parse(JSON.stringify(seed.selection)),
        promoPct: seed.promoPct
      });
    }
  });
  render();
  persist();
}

loadState();
