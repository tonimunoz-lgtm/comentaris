// secretaria.js — v2
// Panell de Secretaria complet: Nivells > Grups/Matèries/Projectes > Alumnes
// Gestió d'usuaris i rols
// Import d'alumnes via Excel

console.log('📁 secretaria.js carregat');

/* ══════════════════════════════════════════════════════
   CURS ACADÈMIC GLOBAL
   Llegeix/escriu a _sistema/config.cursActiu
   Tots els desplegables usen window._cursActiu
══════════════════════════════════════════════════════ */
window._cursActiu = null;

async function carregarCursActiu() {
  if (window._cursActiu) return window._cursActiu;
  try {
    const doc = await window.db.collection('_sistema').doc('config').get();
    const curs = doc.data()?.cursActiu;
    if (curs) { window._cursActiu = curs; return curs; }
  } catch(e) {}
  // Fallback: curs més recent dels nivells
  try {
    const snap = await window.db.collection('nivells_centre').orderBy('ordre','desc').limit(5).get();
    const cursos = [...new Set(snap.docs.map(d=>d.data().curs).filter(Boolean))].sort().reverse();
    if (cursos[0]) { window._cursActiu = cursos[0]; return cursos[0]; }
  } catch(e) {}
  // Fallback final: any actual
  const ara = new Date();
  const any = ara.getMonth() >= 8 ? ara.getFullYear() : ara.getFullYear()-1;
  const curs = `${any}-${String(any+1).slice(-2)}`;
  window._cursActiu = curs;
  return curs;
}

async function guardarCursActiu(curs) {
  window._cursActiu = curs;
  try {
    await window.db.collection('_sistema').doc('config').set(
      { cursActiu: curs }, { merge: true }
    );
  } catch(e) { console.warn('guardarCursActiu:', e.message); }
}

// Actualitzar el curs actiu quan es modifica un nivell
window._onCursCanviat = async function(nouCurs, cursAntic) {
  if (!nouCurs || nouCurs === cursAntic) return;
  await guardarCursActiu(nouCurs);
  window.mostrarToast(`✅ Curs actiu actualitzat a ${nouCurs} a tot el sistema`, 3000);
};


/* ══════════════════════════════════════════════════════
   ESTRUCTURA FIREBASE (nova)
   
   nivells_centre/{nivellId}
     nom: "3r ESO"
     ordre: 3
     curs: "2024-25"
   
   grups_centre/{grupId}
     nom: "3A"
     tipus: "classe" | "materia" | "projecte" | "optativa"
     nivellId: "..."
     nivellNom: "3r ESO"
     ordre: 1
     curs: "2024-25"
     alumnes: [{nom, cognoms, ralc}]   ← llista mestra
══════════════════════════════════════════════════════ */

const TIPUS_GRUP = {
  classe:   { label: 'Grup classe', icon: '🏫' },
  materia:  { label: 'Matèria',     icon: '📚' },
  projecte: { label: 'Projecte',    icon: '🔬' },
  optativa: { label: 'Optativa',    icon: '🎨' },
};

/* ══════════════════════════════════════════════════════
   EXPORTAR FUNCIÓ PRINCIPAL
══════════════════════════════════════════════════════ */
window.obrirPanellSecretaria = obrirPanellSecretaria;
let _secretariaInjectTimer = null; // guard anti-race-condition
window.injectarBotoSecretaria = function() {
  if (document.getElementById('btnSecretariaSidebar')) return;
  // Guard de rol intern: NOMÉS secretaria, admin, superadmin
  const rols = window._userRols || [];
  const esAdmin = rols.includes('admin') || rols.includes('superadmin') || !!window._isSuperAdmin;
  if (!esAdmin && !rols.includes('secretaria')) return;
  // Debounce anti-race-condition
  if (_secretariaInjectTimer) return;
  _secretariaInjectTimer = setTimeout(() => {
    _secretariaInjectTimer = null;
    if (document.getElementById('btnSecretariaSidebar')) return;
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
  const btn = document.createElement('button');
  btn.id = 'btnSecretariaSidebar';
  btn.className = 'nav-item nav-item-rol';
  btn.innerHTML = `<span class="nav-icon">📋</span><span>Secretaria</span>`;
    btn.addEventListener('click', obrirPanellSecretaria);
    nav.appendChild(btn);

    // Listener en temps real: actualitza el badge immediatament
    // quan arriba qualsevol canvi a la col·lecció professors
    // (registre nou via Google, via email, canvi de rols, etc.)
    iniciarListenerPendents();
  }, 100);
};

/* ══════════════════════════════════════════════════════
   PANELL PRINCIPAL
══════════════════════════════════════════════════════ */
async function obrirPanellSecretaria() {
  document.getElementById('panellSecretaria')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'panellSecretaria';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:8888;background:rgba(15,23,42,0.7);
    display:flex;align-items:stretch;
  `;

  overlay.innerHTML = `
    <div style="width:100%;background:#fff;display:flex;flex-direction:column;
                overflow:hidden;box-shadow:-20px 0 60px rgba(0,0,0,0.3);">

      <!-- HEADER -->
      <div style="background:linear-gradient(135deg,#1e1b4b,#4c1d95);color:#fff;
                  padding:20px 24px;flex-shrink:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div>
            <h2 style="font-size:20px;font-weight:800;margin:0;">📋 Secretaria</h2>
            <p style="font-size:12px;opacity:0.7;margin:4px 0 0;">Gestió institucional del centre</p>
          </div>
          <button id="btnTancarSec" style="background:rgba(255,255,255,0.2);border:none;
            color:#fff;width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer;">✕</button>
        </div>
        <!-- Tabs -->
        <div style="display:flex;gap:3px;flex-wrap:wrap;">
          ${[
            {id:'estructura', icon:'🏗️', label:'Estructura'},
            {id:'usuaris',    icon:'👥', label:'Usuaris'},
            {id:'periodes',   icon:'🔒', label:'Períodes'},
            {id:'butlletins', icon:'📄', label:'Butlletins'},
            {id:'quadre',     icon:'📊', label:'Quadre dades'},
          ].map(t => `
            <button class="sec-tab" data-tab="${t.id}" style="
              padding:7px 14px;border-radius:8px 8px 0 0;border:none;cursor:pointer;
              font-size:13px;font-weight:600;
              background:rgba(255,255,255,0.15);color:#fff;white-space:nowrap;">
              ${t.icon} ${t.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- CONTINGUT -->
      <div id="secBody" style="flex:1;overflow-y:auto;padding:24px;"></div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('#btnTancarSec').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('.sec-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.sec-tab').forEach(t => {
        t.style.background = 'rgba(255,255,255,0.15)'; t.style.color = '#fff';
      });
      tab.style.background = '#fff'; tab.style.color = '#4c1d95';
      carregarTab(tab.dataset.tab);
    });
  });

  // Carregar primera tab
  overlay.querySelector('.sec-tab').click();

  // Re-aplicar badge de pendents ara que els tabs ja existeixen al DOM
  comprovarUsuarisPendents();
}

/* ══════════════════════════════════════════════════════
   ROUTER TABS
══════════════════════════════════════════════════════ */
async function carregarTab(tab) {
  const body = document.getElementById('secBody');
  if (!body) return;
  body.innerHTML = `<div style="padding:40px;text-align:center;color:#9ca3af;">⏳ Carregant...</div>`;
  switch(tab) {
    case 'estructura': await renderEstructura(body); break;
    case 'usuaris':    await renderUsuaris(body);    break;
    case 'periodes':   await renderPeriodes(body);   break;
    case 'butlletins': await renderButlletins(body); break;
    case 'quadre':     await renderQuadreDades(body);break;
  }
}

/* ══════════════════════════════════════════════════════
   TAB ESTRUCTURA: Nivells → Grups/Matèries/Projectes → Alumnes
══════════════════════════════════════════════════════ */
async function renderEstructura(body) {
  const cursActiu = await carregarCursActiu();

  const [nivells, grups] = await Promise.all([
    carregarNivells(),
    carregarGrupsCentre()
  ]);

  // Índexs
  const grupsPer = {};   // grupsPer[nivellId] = [grups]
  const materiesPer = {}; // materiesPer[grupId] = [matèries/projectes/optatives]
  grups.forEach(g => {
    if (g.tipus === 'classe') {
      if (!grupsPer[g.nivellId]) grupsPer[g.nivellId] = [];
      grupsPer[g.nivellId].push(g);
    } else {
      // matèria/projecte/optativa: parentGrupId és el grup classe pare
      const parentId = g.parentGrupId || g.nivellId;
      if (!materiesPer[parentId]) materiesPer[parentId] = [];
      materiesPer[parentId].push(g);
    }
  });

  // Estat de selecció
  let nivellActiu  = null;
  let grupActiu    = null;   // grup classe seleccionat
  let materiaActiva = null;  // matèria/projecte/optativa seleccionada
  // Quin panell mostra alumnes: 'grup' o 'materia'
  let alumnesFont  = null;

  // ── Layout 4 columnes ──────────────────────────────
  body.innerHTML = `
    <div style="display:flex;gap:0;height:calc(100vh - 180px);min-height:400px;overflow-x:auto;">

      <!-- COL 1: NIVELLS -->
      <div style="width:175px;flex-shrink:0;display:flex;flex-direction:column;padding-right:14px;border-right:1px solid #e5e7eb;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:11px;font-weight:700;color:#7c3aed;letter-spacing:0.04em;">NIVELLS</span>
          <button id="btnNouNivell" style="background:#7c3aed;color:#fff;border:none;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700;cursor:pointer;">+ Nou</button>
        </div>
        <div id="col-nivells" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px;"></div>
      </div>

      <!-- COL 2: GRUPS (A, B, C, Els Anecs...) -->
      <div style="width:175px;flex-shrink:0;display:flex;flex-direction:column;padding:0 14px;border-right:1px solid #e5e7eb;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:11px;font-weight:700;color:#2563eb;letter-spacing:0.04em;">GRUPS</span>
          <button id="btnNouGrup" disabled style="background:#2563eb;color:#fff;border:none;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700;cursor:pointer;opacity:0.4;">+ Nou</button>
        </div>
        <div id="col-grups" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">
          <p style="font-size:11px;color:#9ca3af;text-align:center;padding:20px 0;">← Tria un nivell</p>
        </div>
      </div>

      <!-- COL 3: MATÈRIES del grup seleccionat -->
      <div style="width:300px;flex-shrink:0;display:flex;flex-direction:column;padding:0 14px;border-right:1px solid #e5e7eb;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:11px;font-weight:700;color:#059669;letter-spacing:0.04em;" id="titol-col-mat">MATÈRIES</span>
            <div style="display:flex;gap:4px;">
              <button id="btnNouMateria" disabled style="background:#059669;color:#fff;border:none;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700;cursor:pointer;opacity:0.4;">+ Nova</button>
              <button id="btnCopiarEstructura" disabled style="background:#4f46e5;color:#fff;border:none;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700;cursor:pointer;opacity:0.4;">📋 Copiar estructura</button>
              <button id="btnCopiarTots" style="background:#9333ea;color:#fff;border:none;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700;cursor:pointer;opacity:0.4;"> 🚀 Copiar a tots</button>
         </div>
         </div>
        <div id="col-materies" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">
          <p style="font-size:11px;color:#9ca3af;text-align:center;padding:20px 0;">← Tria un grup</p>
        </div>
      </div>

      <!-- COL 4: ALUMNES -->
      <div style="flex:1;min-width:220px;display:flex;flex-direction:column;padding-left:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:5px;">
          <span style="font-size:11px;font-weight:700;color:#d97706;letter-spacing:0.04em;" id="titol-col-alumnes">ALUMNES</span>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <button id="btnNouAlumne" disabled style="background:#d97706;color:#fff;border:none;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700;cursor:pointer;opacity:0.4;">+ Alumne</button>
            <button id="btnImportarAlumnes" disabled style="background:#059669;color:#fff;border:none;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700;cursor:pointer;opacity:0.4;">📥 Excel</button>
            <button id="btnCopiarDe" disabled style="background:#4f46e5;color:#fff;border:none;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700;cursor:pointer;opacity:0.4;">📋 Copiar de...</button>
            <button id="btnCopiarAlumnesATotes" disabled style="background:#9333ea;color:#fff;border:none;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700;cursor:pointer;opacity:0.4;">🚀 Copiar a totes</button>
          </div>
        </div>
        <div id="col-alumnes" style="flex:1;overflow-y:auto;">
          <p style="font-size:11px;color:#9ca3af;text-align:center;padding:20px 0;">← Tria un grup o matèria</p>
        </div>
      </div>
    </div>
  `;

  // ── Helpers ──────────────────────────────────────────

  const color = { nivell:'#7c3aed', grup:'#2563eb', materia:'#059669', alumne:'#d97706' };

  function cardStyle(actiu, c) {
    return `padding:7px 9px;border-radius:7px;cursor:pointer;user-select:none;
      border:1.5px solid ${actiu ? c : '#e5e7eb'};
      background:${actiu ? c+'18' : '#fff'};
      display:flex;justify-content:space-between;align-items:center;
      font-size:12px;transition:border-color 0.1s;`;
  }

  function botoEdit(c) { return `<button class="btn-ed" style="background:none;border:none;font-size:12px;cursor:pointer;opacity:0.6;padding:1px 2px;" title="Editar">✏️</button>`; }
  function botoDel()   { return `<button class="btn-dl" style="background:none;border:none;font-size:12px;cursor:pointer;opacity:0.6;padding:1px 2px;" title="Eliminar">🗑️</button>`; }

  function enableBtn(id) {
    const btn = document.getElementById(id);
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }

  // Drag & drop entre elements de la mateixa llista
  function afegirDD(el, cont, arr, idx, onDrop) {
    el.addEventListener('dragstart', e => {
      e._ddIdx = idx; el.style.opacity='0.45';
      e.dataTransfer.effectAllowed='move';
      cont._ddFrom = idx;
    });
    el.addEventListener('dragend', () => { el.style.opacity='1'; });
    el.addEventListener('dragover', e => { e.preventDefault(); el.style.outline='2px dashed #7c3aed'; });
    el.addEventListener('dragleave', () => { el.style.outline=''; });
    el.addEventListener('drop', e => {
      e.preventDefault(); el.style.outline='';
      const from = cont._ddFrom;
      const to   = idx;
      if (from === undefined || from === to) return;
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      arr.forEach((x,i) => {
        x.ordre = i+1;
        onDrop(x, i+1);
      });
      // Re-renderitzar la columna immediatament
      if (typeof onDrop._rerender === 'function') onDrop._rerender();
    });
  }

  // ── COL 1: NIVELLS ───────────────────────────────────
  function renderNivells() {
    const cont = document.getElementById('col-nivells');
    if (!cont) return;
    const sorted = [...nivells].sort((a,b)=>(a.ordre||99)-(b.ordre||99));
    cont.innerHTML = sorted.length ? '' : '<p style="font-size:11px;color:#9ca3af;text-align:center;padding:16px 0;">Cap nivell</p>';
    sorted.forEach((n, i) => {
      const el = document.createElement('div');
      el.className = 'dd-item'; el.draggable = true;
      el.style.cssText = cardStyle(nivellActiu===n.id, color.nivell);
      el.innerHTML = `
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;color:#1e1b4b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esH(n.nom)}</div>
          <div style="font-size:10px;color:#9ca3af;">${esH(n.curs||'')} · ${(grupsPer[n.id]||[]).length} grups</div>
        </div>
        <div>${botoEdit()}${botoDel()}</div>`;
      el.querySelector('.btn-ed').addEventListener('click', e => { e.stopPropagation(); modalNivell(n); });
      el.querySelector('.btn-dl').addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm(`Eliminar "${n.nom}"?`)) return;
        eliminarNivell(n.id);
      });
      el.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        nivellActiu = n.id; grupActiu = null; materiaActiva = null;
        renderNivells(); renderGrups(); renderMateries(); renderAlumnes(null);
        enableBtn('btnNouGrup');
      });
      const _cbNivell = (x,o) => window.db.collection('nivells_centre').doc(x.id).update({ordre:o}).catch(()=>{});
      _cbNivell._rerender = renderNivells;
      afegirDD(el, cont, sorted, i, _cbNivell);
      cont.appendChild(el);
    });
  }

  // ── COL 2: GRUPS (A, B, C, etc.) ─────────────────────
  function renderGrups() {
    const cont = document.getElementById('col-grups');
    if (!cont) return;
    if (!nivellActiu) {
      cont.innerHTML = '<p style="font-size:11px;color:#9ca3af;text-align:center;padding:20px 0;">← Tria un nivell</p>';
      return;
    }
    const gs = [...(grupsPer[nivellActiu]||[])].sort((a,b)=>(a.ordre||99)-(b.ordre||99));
    cont.innerHTML = gs.length ? '' : '<p style="font-size:11px;color:#9ca3af;text-align:center;padding:20px 0;">Cap grup. Crea\'n un!</p>';
    gs.forEach((g, i) => {
      const el = document.createElement('div');
      el.className = 'dd-item'; el.draggable = true;
      el.style.cssText = cardStyle(grupActiu===g.id, color.grup);
      el.innerHTML = `
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;color:#1e1b4b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">🏫 ${esH(g.nom)}</div>
          <div style="font-size:10px;color:#9ca3af;">${(materiesPer[g.id]||[]).length} matèries</div>
        </div>
        <div>${botoEdit()}${botoDel()}</div>`;
      el.querySelector('.btn-ed').addEventListener('click', e => { e.stopPropagation(); modalGrup(g); });
      el.querySelector('.btn-dl').addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm(`Eliminar "${g.nom}" i totes les dades associades?`)) return;
        eliminarGrupComplet(g.id, g.nom).then(() => recarregar());
      });
      el.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        grupActiu = g.id; materiaActiva = null;
        renderGrups(); renderMateries();
        // Quan cliques un grup, mostrar la columna alumnes buida fins que es triï una matèria
        document.getElementById('titol-col-alumnes').textContent = `ALUMNES`;
        alumnesFont = null;
        renderAlumnes(null);
        // Missatge orientatiu
        const colAl = document.getElementById('col-alumnes');
        if (colAl) colAl.innerHTML = '<p style="font-size:11px;color:#9ca3af;text-align:center;padding:20px 0;">← Tria una matèria per veure els alumnes</p>';
        // Desactivar botons alumnes (només actius amb matèria seleccionada)
        ['btnNouAlumne','btnImportarAlumnes'].forEach(id=>{
          const b=document.getElementById(id); if(b){b.disabled=true;b.style.opacity='0.4';}
        });
        enableBtn('btnNouMateria');
        enableBtn('btnCopiarEstructura');
        enableBtn('btnCopiarTots');
        document.getElementById('titol-col-mat').textContent = `MATÈRIES — ${g.nom}`;
      });
      const _cbGrup = (x,o) => window.db.collection('grups_centre').doc(x.id).update({ordre:o}).catch(()=>{});
      _cbGrup._rerender = renderGrups;
      afegirDD(el, cont, gs, i, _cbGrup);
      cont.appendChild(el);
    });
  }

  // ── COL 3: MATÈRIES del grup seleccionat ─────────────
  function renderMateries() {
    const cont = document.getElementById('col-materies');
    if (!cont) return;
    if (!grupActiu) {
      cont.innerHTML = '<p style="font-size:11px;color:#9ca3af;text-align:center;padding:20px 0;">← Tria un grup</p>';
      return;
    }
    const ICONA = { materia:'📚', projecte:'🔬', optativa:'🎨', tutoria:'🧑‍🏫' };
    const ms = [...(materiesPer[grupActiu]||[])].sort((a,b)=>(a.ordre||99)-(b.ordre||99));
    cont.innerHTML = ms.length ? '' : '<p style="font-size:11px;color:#9ca3af;text-align:center;padding:20px 0;">Cap matèria. Crea\'n una!</p>';
    ms.forEach((m, i) => {
      const el = document.createElement('div');
      el.className = 'dd-item'; el.draggable = true;
      el.style.cssText = cardStyle(materiaActiva===m.id, color.materia);
      el.innerHTML = `
        <div style="flex:1;min-width:0;">
          <div style="font-size:10px;color:#9ca3af;">${ICONA[m.tipus]||'📁'} ${m.tipus}</div>
          <div style="font-weight:700;color:#1e1b4b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esH(m.nom)}</div>
          <div style="font-size:10px;color:#9ca3af;">${(m.alumnes||[]).length} alumnes</div>
        </div>
        <div>${botoEdit()}${botoDel()}</div>`;
      el.querySelector('.btn-ed').addEventListener('click', e => { e.stopPropagation(); modalGrup(m); });
      el.querySelector('.btn-dl').addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm(`Eliminar "${m.nom}"?`)) return;
        eliminarGrupComplet(m.id, m.nom).then(() => recarregar());
      });
      el.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        materiaActiva = m.id;
        renderMateries();
        document.getElementById('titol-col-alumnes').textContent = `ALUMNES — ${m.nom}`;
        alumnesFont = 'materia';
        renderAlumnes(m);
        enableBtn('btnNouAlumne');
        enableBtn('btnImportarAlumnes');
        enableBtn('btnCopiarDe');
        enableBtn('btnCopiarAlumnesATotes');
      });
      const _cbMat = (x,o) => window.db.collection('grups_centre').doc(x.id).update({ordre:o}).catch(()=>{});
      _cbMat._rerender = renderMateries;
      afegirDD(el, cont, ms, i, _cbMat);
      cont.appendChild(el);
    });
  }

  // ── COL 4: ALUMNES ───────────────────────────────────
  function renderAlumnes(grup) {
    const cont = document.getElementById('col-alumnes');
    if (!cont) return;
    if (!grup) {
      cont.innerHTML = '<p style="font-size:11px;color:#9ca3af;text-align:center;padding:20px 0;">← Tria un grup o matèria</p>';
      return;
    }
    const alumnes = [...(grup.alumnes||[])].sort((a,b)=>(a.cognoms||'').localeCompare(b.cognoms||'','ca'));
    if (!alumnes.length) {
      cont.innerHTML = `
        <div style="text-align:center;padding:24px;color:#9ca3af;">
          <div style="font-size:28px;margin-bottom:6px;">👤</div>
          Cap alumne. Afegeix-ne o importa des d'Excel.
        </div>`;
      return;
    }
    cont.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:11px;" id="taulaAl">
        <thead><tr style="background:#f3f4f6;">
          <th style="padding:5px 7px;text-align:left;">#</th>
          <th style="padding:5px 7px;text-align:left;">Cognoms, Nom</th>
          <th style="padding:5px 7px;text-align:left;">RALC</th>
          <th style="padding:5px 7px;text-align:center;">✎ 🗑</th>
        </tr></thead>
        <tbody id="tbAl">
          ${alumnes.map((a,i)=>`
            <tr draggable="true" data-idx="${grup.alumnes.indexOf(a)}" style="border-bottom:1px solid #f5f5f5;cursor:grab;">
              <td style="padding:4px 7px;color:#9ca3af;">${i+1}</td>
              <td style="padding:4px 7px;font-weight:600;color:#1e1b4b;">${esH(a.cognoms?a.cognoms+', '+a.nom:a.nom)}</td>
              <td style="padding:4px 7px;color:#9ca3af;">${esH(a.ralc||'—')}</td>
              <td style="padding:4px 7px;text-align:center;white-space:nowrap;">
                <button class="btn-ed-al" data-idx="${grup.alumnes.indexOf(a)}"
                  style="background:none;border:none;color:#2563eb;cursor:pointer;font-size:12px;padding:1px 3px;">✏️</button>
                <button class="btn-dl-al" data-nom="${esH(a.nom)}" data-idx="${grup.alumnes.indexOf(a)}"
                  style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px;padding:1px 3px;">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div style="padding:5px 7px;font-size:10px;color:#9ca3af;text-align:right;">Total: ${alumnes.length}</div>
    `;

    cont.querySelectorAll('.btn-ed-al').forEach(btn => {
      btn.addEventListener('click', () => modalEditarAlumne(grup, parseInt(btn.dataset.idx), () => renderAlumnes(grup)));
    });
    cont.querySelectorAll('.btn-dl-al').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Eliminar "${btn.dataset.nom}"?`)) return;
        const nous = [...grup.alumnes]; nous.splice(parseInt(btn.dataset.idx),1);
        await window.db.collection('grups_centre').doc(grup.id).update({alumnes:nous, alumnesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()});
        grup.alumnes = nous; renderAlumnes(grup);
        window.mostrarToast('🗑️ Alumne eliminat');
      });
    });

    // Drag & drop files de taula
    const tbody = document.getElementById('tbAl');
    let ddFrom = null;
    tbody?.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('dragstart', e => { ddFrom=parseInt(tr.dataset.idx); tr.style.opacity='0.45'; e.dataTransfer.effectAllowed='move'; });
      tr.addEventListener('dragend', () => tr.style.opacity='1');
      tr.addEventListener('dragover', e => { e.preventDefault(); tr.style.background='#fef3c7'; });
      tr.addEventListener('dragleave', () => tr.style.background='');
      tr.addEventListener('drop', async e => {
        e.preventDefault(); tr.style.background='';
        const to = parseInt(tr.dataset.idx);
        if (ddFrom===null||ddFrom===to) return;
        const nous = [...grup.alumnes];
        const [item] = nous.splice(ddFrom,1); nous.splice(to,0,item);
        await window.db.collection('grups_centre').doc(grup.id).update({alumnes:nous, alumnesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()});
        grup.alumnes = nous; renderAlumnes(grup);
      });
    });
  }

  // ── BOTONS PRINCIPALS ────────────────────────────────
  document.getElementById('btnNouNivell').addEventListener('click', () => modalNivell());

  document.getElementById('btnNouGrup').addEventListener('click', () => {
    if (!nivellActiu) return;
    const n = nivells.find(x=>x.id===nivellActiu);
    // Grups sempre tipus=classe
    modalGrup(null, nivellActiu, n, 'classe');
  });

  document.getElementById('btnNouMateria').addEventListener('click', () => {
    if (!grupActiu) return;
    const g = grups.find(x=>x.id===grupActiu);
    const n = nivells.find(x=>x.id===nivellActiu);
    // Matèries: el parentGrupId és el grup classe
    modalGrupMateria(null, grupActiu, g, n);
  });

  document.getElementById('btnCopiarEstructura').addEventListener('click', () => {
    if (!grupActiu) return;
    const g = grups.find(x=>x.id===grupActiu);
    // buscar altres grups del mateix nivell amb matèries
    const candidats = grups.filter(x =>
    x.tipus === 'classe' &&
    x.nivellId === nivellActiu &&
    x.id !== grupActiu &&
    (materiesPer[x.id] || []).length > 0
   );
    modalCopiarEstructura(g, candidats, recarregar);
    });

   document.getElementById('btnCopiarTots').addEventListener('click', () => {
  if (!grupActiu) return;
  const grupFont = grups.find(x => x.id === grupActiu);
  const altresGrups = grups.filter(g =>
    g.tipus === 'classe' &&
    g.nivellId === nivellActiu &&
    g.id !== grupActiu
  );
  // Pasa materiesPer como el tercer argumento
  copiarEstructuraATots(grupFont, altresGrups, materiesPer, recarregar);
});

  document.getElementById('btnNouAlumne').addEventListener('click', () => {
    const gId = materiaActiva || grupActiu;
    const g = grups.find(x=>x.id===gId);
    if (g) modalAlumne(g, () => renderAlumnes(g));
  });

  document.getElementById('btnImportarAlumnes').addEventListener('click', () => {
    const gId = materiaActiva || grupActiu;
    const g = grups.find(x=>x.id===gId);
    if (g) modalImportExcel(g, () => recarregar().then(() => {
      const gAct = grups.find(x=>x.id===gId);
      if (gAct) renderAlumnes(gAct);
    }));
  });

    document.getElementById('btnCopiarDe').addEventListener('click', () => {
    const grupOrigen = grups.find(x => x.id === (materiaActiva || grupActiu));
    if (!grupOrigen) return;

    let candidates;
    if (grupOrigen.tipus === 'classe') { // Si el origen es un grupo clase
      // Mostrar materias de ese mismo grupo clase
      candidates = grups.filter(x =>
        x.parentGrupId === grupOrigen.id &&
        (x.alumnes && x.alumnes.length > 0)
      );
    } else { // Si el origen es una materia
      // Mostrar otras materias del mismo grupo clase padre
      candidates = grups.filter(x =>
        x.parentGrupId === grupOrigen.parentGrupId &&
        (x.alumnes && x.alumnes.length > 0) &&
        x.id !== grupOrigen.id // Excluir la materia actual
      );
    }
    
    modalCopiarAlumnesDe(grupOrigen, candidates, () => recarregar().then(() => {
      const gAct = grups.find(x => x.id === (materiaActiva || grupActiu));
      if (gAct) renderAlumnes(gAct);
    }));
  });

     document.getElementById('btnCopiarAlumnesATotes').addEventListener('click', () => {
    if (!materiaActiva) {
      window.mostrarToast('⚠️ Selecciona una matèria per copiar els alumnes.', 3000);
      return;
    }
    const materiaOrigen = grups.find(x => x.id === materiaActiva);
    if (!materiaOrigen) return;
    
    copiarAlumnesATotesLesMateries(materiaOrigen, grups, recarregar);
  });

  // ── RECARREGAR ──────────────────────────────────────
  async function recarregar() {
    const nousg = await carregarGrupsCentre();
    grups.length=0; nousg.forEach(g=>grups.push(g));
    Object.keys(grupsPer).forEach(k=>delete grupsPer[k]);
    Object.keys(materiesPer).forEach(k=>delete materiesPer[k]);
    grups.forEach(g=>{
      if (g.tipus==='classe') {
        if (!grupsPer[g.nivellId]) grupsPer[g.nivellId]=[];
        grupsPer[g.nivellId].push(g);
      } else {
        const p = g.parentGrupId || g.nivellId;
        if (!materiesPer[p]) materiesPer[p]=[];
        materiesPer[p].push(g);
      }
    });
    renderNivells(); renderGrups(); renderMateries();
    const gAct = grups.find(g=>g.id===(materiaActiva||grupActiu));
    renderAlumnes(gAct||null);
  }

  window._secOnNivellCreat = async () => {
    const nous = await carregarNivells();
    nivells.length=0; nous.forEach(n=>nivells.push(n));
    renderNivells();
  };
  window._secOnGrupCreat = recarregar;

  // ── RENDER INICIAL ───────────────────────────────────
  renderNivells();
}

/* ══════════════════════════════════════════════════════
   MODAL GRUP MATÈRIA (nou tipus independent)
   Diferent de modalGrup perquè permet triar entre
   Matèria / Projecte / Optativa / Tutoria
   i guarda parentGrupId = grup classe pare
══════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════
   MODAL GRUPS — creació múltiple (A, B, C, D...)
   Edició: modal simple per canviar el nom
══════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════
   MODAL NIVELL — crear i editar
══════════════════════════════════════════════════════ */
function modalNivell(existent) {
  crearModal(`${existent ? '✏️ Editar' : '+ Nou'} nivell`, `
    <div style="margin-bottom:12px;">
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Nom *</label>
      <input id="inpNivNom" type="text" value="${esH(existent?.nom||'')}"
        placeholder="Ex: 1r ESO, 2n Batxillerat..."
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
               border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
    </div>
    <div>
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Curs acadèmic *</label>
      <input id="inpNivCurs" type="text"
        value="${esH(existent?.curs||(window._cursActiu||'2025-26'))}"
        placeholder="2025-26"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
               border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
    </div>
  `, async () => {
    const nom  = document.getElementById('inpNivNom').value.trim();
    const curs = document.getElementById('inpNivCurs').value.trim();
    if (!nom || !curs) { window.mostrarToast('⚠️ Omple els camps obligatoris'); return false; }
    const data = { nom, curs, ordre: existent?.ordre ?? 99 };
    if (existent) {
      await window.db.collection('nivells_centre').doc(existent.id).update(data);
    } else {
      // Calcular ordre màxim
      const snap = await window.db.collection('nivells_centre').get();
      data.ordre = snap.size + 1;
      await window.db.collection('nivells_centre').add(data);
    }
    await guardarCursActiu(curs);
    window.mostrarToast(existent ? '✅ Nivell actualitzat' : '✅ Nivell creat');
    await window._secOnNivellCreat?.();
    return true;
  });
  setTimeout(() => document.getElementById('inpNivNom')?.focus(), 100);
}

function modalGrupMateria(existent, parentGrupId, parentGrup, nivell) {
  const TIPUS_MAT = [
    {v:'materia',  i:'📚', l:'Matèria'},
    {v:'projecte', i:'🔬', l:'Projecte'},
    {v:'optativa', i:'🎨', l:'Optativa'},
    {v:'tutoria',  i:'🧑‍🏫', l:'Tutoria'},
  ];
  const tipusOpts = TIPUS_MAT.map(t=>`<option value="${t.v}">${t.i} ${t.l}</option>`).join('');

  // MODE EDICIÓ: modal simple
  if (existent) {
    crearModal('✏️ Editar matèria', `
      <div style="margin-bottom:12px;">
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Nom *</label>
        <input id="inpMNom" type="text" value="${esH(existent.nom||'')}"
          style="width:100%;box-sizing:border-box;padding:9px 11px;border:1.5px solid #e5e7eb;border-radius:9px;font-size:13px;outline:none;font-family:inherit;">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:8px;">Tipus</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          ${TIPUS_MAT.map(t=>`
            <label style="display:flex;align-items:center;gap:7px;cursor:pointer;padding:8px 10px;
                          border:1.5px solid ${(existent.tipus||'materia')===t.v?'#059669':'#e5e7eb'};
                          border-radius:8px;font-size:12px;background:#f9fafb;"
                   class="lbl-tipus-edit" data-v="${t.v}">
              <input type="radio" name="tipusMEdit" value="${t.v}"
                ${(existent.tipus||'materia')===t.v?'checked':''}
                style="accent-color:#059669;">
              ${t.i} ${t.l}
            </label>`).join('')}
        </div>
      </div>
    `, async () => {
      const nom   = document.getElementById('inpMNom').value.trim();
      const tipus = document.querySelector('input[name="tipusMEdit"]:checked')?.value || existent.tipus;
      if (!nom) { window.mostrarToast('⚠️ El nom és obligatori'); return false; }
      await window.db.collection('grups_centre').doc(existent.id).update({ nom, tipus });
      window.mostrarToast('✅ Actualitzat');
      await window._secOnGrupCreat?.();
      return true;
    }, 'Guardar');
    setTimeout(() => {
      document.getElementById('inpMNom')?.focus();
      document.querySelectorAll('input[name="tipusMEdit"]').forEach(r => {
        r.addEventListener('change', () => {
          document.querySelectorAll('.lbl-tipus-edit').forEach(l => l.style.borderColor='#e5e7eb');
          r.closest('.lbl-tipus-edit').style.borderColor='#059669';
        });
      });
    }, 100);
    return;
  }

  // MODE CREACIÓ MÚLTIPLE
  const nNom = nivell?.nom || parentGrup?.nivellNom || '';
  const curs = nivell?.curs || parentGrup?.curs || window._cursActiu || '';
  const nId  = nivell?.id || parentGrup?.nivellId || '';

  crearModal('+ Noves matèries', `
    <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:9px;
                padding:9px 12px;margin-bottom:14px;font-size:12px;color:#166534;">
      Grup: <strong>${esH(parentGrup?.nom||'')} — ${esH(nNom)}${curs?' ('+esH(curs)+')':''}</strong>
    </div>
    <div style="display:grid;grid-template-columns:1fr 150px 28px;gap:8px;
                margin-bottom:5px;font-size:10px;font-weight:700;color:#9ca3af;padding:0 2px;">
      <span>NOM</span><span>TIPUS</span><span></span>
    </div>
    <div id="contMat" style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;"></div>
    <button id="btnAfegirMat" style="width:100%;padding:7px;background:#f3f4f6;
      border:1.5px dashed #d1d5db;border-radius:8px;font-size:12px;font-weight:600;
      color:#6b7280;cursor:pointer;">+ Afegir una altra matèria</button>
  `, async () => {
    const files = [...document.querySelectorAll('.fila-mat')];
    const nous  = files.map(f=>({
      nom:   f.querySelector('.inp-mat-nom').value.trim(),
      tipus: f.querySelector('.sel-mat-tipus').value,
    })).filter(x=>x.nom);
    if (!nous.length) { window.mostrarToast('⚠️ Escriu almenys un nom'); return false; }

    let ordre = 1;
    try {
      const snap = await window.db.collection('grups_centre').where('parentGrupId','==',parentGrupId).get();
      ordre = snap.size + 1;
    } catch(e){}

    for (const m of nous) {
      await window.db.collection('grups_centre').add({
        nom: m.nom, tipus: m.tipus,
        parentGrupId, nivellId: nId, nivellNom: nNom, curs,
        ordre: ordre++, alumnes: []
      });
    }
    window.mostrarToast(`✅ ${nous.length} matèri${nous.length!==1?'es':'a'} creada${nous.length!==1?'s':''}`);
    await window._secOnGrupCreat?.();
    return true;
  }, 'Crear');

  let _mIdx = 0;
  const addFilaMat = () => {
    const cont = document.getElementById('contMat');
    if (!cont) return;
    const div = document.createElement('div');
    div.className='fila-mat';
    div.style.cssText='display:grid;grid-template-columns:1fr 150px 28px;gap:6px;align-items:center;';
    div.innerHTML=`
      <input class="inp-mat-nom" type="text" placeholder="Ex: Matemàtiques, STEM..."
        style="padding:8px 9px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:12px;
               outline:none;font-family:inherit;width:100%;box-sizing:border-box;">
      <select class="sel-mat-tipus"
        style="padding:8px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:12px;
               outline:none;background:#f9fafb;width:100%;">
        ${tipusOpts}
      </select>
      <button class="btn-rm" style="background:none;border:none;color:#9ca3af;font-size:16px;cursor:pointer;line-height:1;padding:0;">✕</button>
    `;
    div.querySelector('.btn-rm').addEventListener('click', ()=>{ if(cont.children.length>1) div.remove(); });
    div.querySelector('.inp-mat-nom').addEventListener('keydown', e=>{
      if(e.key==='Enter'){ e.preventDefault(); addFilaMat();
        setTimeout(()=>{ const ins=cont.querySelectorAll('.inp-mat-nom'); ins[ins.length-1]?.focus(); },40); }
    });
    cont.appendChild(div);
  };

  setTimeout(()=>{
    addFilaMat();
    document.getElementById('btnAfegirMat')?.addEventListener('click', addFilaMat);
    setTimeout(()=>document.querySelector('#contMat .inp-mat-nom')?.focus(), 40);
  }, 80);
}

function modalGrup(existent, nivellIdFix, nivellFix) {
  // MODE EDICIÓ
  if (existent) {
    crearModal('✏️ Editar grup', `
      <div>
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Nom del grup *</label>
        <input id="inpGrpNom" type="text" value="${esH(existent.nom||'')}"
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
                 border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
      </div>
    `, async () => {
      const nom = document.getElementById('inpGrpNom').value.trim();
      if (!nom) { window.mostrarToast('⚠️ El nom és obligatori'); return false; }
      await window.db.collection('grups_centre').doc(existent.id).update({ nom });
      window.mostrarToast('✅ Grup actualitzat');
      await window._secOnGrupCreat?.();
      return true;
    });
    setTimeout(()=>document.getElementById('inpGrpNom')?.focus(), 100);
    return;
  }

  // MODE CREACIÓ MÚLTIPLE
  const nId  = nivellIdFix;
  const nNom = nivellFix?.nom || '';
  const curs = nivellFix?.curs || window._cursActiu || '';

  crearModal('+ Nous grups', `
    <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:9px;
                padding:9px 12px;margin-bottom:14px;font-size:12px;color:#1d4ed8;">
      Nivell: <strong>${esH(nNom)}${curs?' ('+esH(curs)+')':''}</strong>
    </div>
    <div style="font-size:10px;font-weight:700;color:#9ca3af;margin-bottom:5px;padding:0 2px;">NOM DEL GRUP</div>
    <div id="contGrups" style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;"></div>
    <button id="btnAfegirGrup" style="width:100%;padding:7px;background:#f3f4f6;
      border:1.5px dashed #d1d5db;border-radius:8px;font-size:12px;font-weight:600;
      color:#6b7280;cursor:pointer;">+ Afegir un altre grup</button>
    <p style="font-size:11px;color:#9ca3af;margin-top:8px;text-align:center;">
      Prem Enter per afegir ràpidament el següent grup
    </p>
  `, async () => {
    const files = [...document.querySelectorAll('.fila-grup')];
    const nous  = files.map(f=>f.value.trim()).filter(Boolean);
    if (!nous.length) { window.mostrarToast('⚠️ Escriu almenys un nom'); return false; }

    let ordre = 1;
    try {
      const snap = await window.db.collection('grups_centre')
        .where('nivellId','==',nId).where('tipus','==','classe').get();
      ordre = snap.size + 1;
    } catch(e){}

    for (const nom of nous) {
      await window.db.collection('grups_centre').add({
        nom, tipus:'classe', nivellId:nId, nivellNom:nNom, curs, ordre:ordre++, alumnes:[]
      });
    }
    window.mostrarToast(`✅ ${nous.length} grup${nous.length!==1?'s':''} creat${nous.length!==1?'s':''}`);
    await window._secOnGrupCreat?.();
    return true;
  }, 'Crear');

  const addFilaGrup = () => {
    const cont = document.getElementById('contGrups');
    if (!cont) return;
    const div = document.createElement('div');
    div.style.cssText='display:flex;gap:7px;align-items:center;';
    div.innerHTML=`
      <input class="fila-grup" type="text" placeholder="Ex: A, B, Els Anecs..."
        style="flex:1;padding:9px 11px;border:1.5px solid #e5e7eb;border-radius:9px;font-size:13px;
               outline:none;font-family:inherit;">
      <button class="btn-rm" style="background:none;border:none;color:#9ca3af;font-size:17px;cursor:pointer;line-height:1;padding:0;">✕</button>
    `;
    div.querySelector('.btn-rm').addEventListener('click', ()=>{ if(cont.children.length>1) div.remove(); });
    div.querySelector('input').addEventListener('keydown', e=>{
      if(e.key==='Enter'){ e.preventDefault(); addFilaGrup();
        setTimeout(()=>{ const ins=cont.querySelectorAll('.fila-grup'); ins[ins.length-1]?.focus(); },40); }
    });
    cont.appendChild(div);
  };

  setTimeout(()=>{
    addFilaGrup();
    document.getElementById('btnAfegirGrup')?.addEventListener('click', addFilaGrup);
    setTimeout(()=>document.querySelector('#contGrups .fila-grup')?.focus(), 40);
  }, 80);
}


/* ══════════════════════════════════════════════════════
   MODAL COPIAR ALUMNES D'ALTRA MATÈRIA
══════════════════════════════════════════════════════ */
function modalCopiarAlumnesDe(grupDesti, candidates, onRefresh) {
  if (!candidates.length) {
    window.mostrarToast('⚠️ No hi ha altres matèries amb alumnes al mateix grup', 3000);
    return;
  }

  crearModal('📋 Copiar alumnes de...', `
    <p style="font-size:13px;color:#6b7280;margin-bottom:14px;">
      Selecciona la matèria d'on vols copiar els alumnes a
      <strong>"${esH(grupDesti.nom)}"</strong>.
    </p>
    <div style="display:flex;flex-direction:column;gap:7px;">
      ${candidates.map(c => `
        <button class="btn-copiar-font" data-id="${c.id}"
          style="padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:9px;
                 background:#fff;cursor:pointer;text-align:left;font-family:inherit;
                 display:flex;align-items:center;justify-content:space-between;
                 font-size:13px;font-weight:600;color:#1e1b4b;
                 transition:border-color 0.15s,background 0.15s;">
          <span>${esH(c.nom)}</span>
          <span style="font-size:11px;color:#9ca3af;font-weight:400;">${(c.alumnes||[]).length} alumnes</span>
        </button>`).join('')}
    </div>
    <p style="font-size:11px;color:#9ca3af;margin-top:12px;">
      Es copiaran nom, cognoms i RALC. Els alumnes ja existents (per RALC) no es duplicaran.
    </p>
  `, () => false, '');

  setTimeout(() => {
    // Amagar botó OK, canviar Cancel·lar per Tancar
    document.getElementById('_btnOkModal')?.style.setProperty('display','none');
    const cancel = document.getElementById('_btnCancelModal');
    if (cancel) cancel.textContent = 'Tancar';

    document.querySelectorAll('.btn-copiar-font').forEach(btn => {
      btn.addEventListener('mouseenter', () => { btn.style.borderColor='#4f46e5'; btn.style.background='#eef2ff'; });
      btn.addEventListener('mouseleave', () => { btn.style.borderColor='#e5e7eb'; btn.style.background='#fff'; });
      btn.addEventListener('click', async () => {
        const font = candidates.find(c=>c.id===btn.dataset.id);
        if (!font) return;
        btn.disabled = true; btn.textContent = '⏳ Copiant...';
        try {
          const actuals = grupDesti.alumnes || [];
          const ralcsActuals = new Set(actuals.map(a=>a.ralc).filter(Boolean));
          const nomsActuals  = new Set(actuals.map(a=>`${a.nom}_${a.cognoms}`));

          const nous = (font.alumnes||[]).filter(a => {
            if (a.ralc && ralcsActuals.has(a.ralc)) return false;
            if (nomsActuals.has(`${a.nom}_${a.cognoms}`)) return false;
            return true;
          });

          const total = [...actuals, ...nous];
          await window.db.collection('grups_centre').doc(grupDesti.id).update({ alumnes: total, alumnesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp() });
          grupDesti.alumnes = total;

          document.getElementById('_modalSec')?.remove();
          window.mostrarToast(`✅ ${nous.length} alumnes copiats (${(font.alumnes||[]).length - nous.length} duplicats ignorats)`);
          onRefresh?.();
        } catch(e) {
          window.mostrarToast('❌ Error: ' + e.message);
          btn.disabled = false;
        }
      });
    });
  }, 100);
}

/* ══════════════════════════════════════════════════════
   MODAL COPIAR ALUMNES A TOTES LES MATÈRIES SENSE ALUMNES DEL GRUP
══════════════════════════════════════════════════════ */
async function copiarAlumnesATotesLesMateries(materiaOrigen, grups, onRefresh) {
  if (!materiaOrigen || !materiaOrigen.alumnes || materiaOrigen.alumnes.length === 0) {
    window.mostrarToast('⚠️ La matèria d\'origen no té alumnes per copiar.', 3000);
    return;
  }

  // Buscar todas las materias del mismo grupo clase padre (parentGrupId)
  // que no sean la materia origen y que no tengan alumnos.
  const materiesDesti = grups.filter(g =>
    g.parentGrupId === materiaOrigen.parentGrupId && // Mismo grupo clase padre
    g.id !== materiaOrigen.id && // No es la materia origen
    (!g.alumnes || g.alumnes.length === 0) // No tiene alumnos
  );

  if (materiesDesti.length === 0) {
    window.mostrarToast('⚠️ No hi ha altres matèries sense alumnes en aquest grup per copiar.', 3000);
    return;
  }

  const nomsMateriesDesti = materiesDesti.map(m => `"${esH(m.nom)}"`).join(', ');

  modalConfirmacio(
    '🚀 Copiar alumnes a totes les matèries',
    `Estàs a punt de copiar els ${materiaOrigen.alumnes.length} alumnes de
    <strong>"${esH(materiaOrigen.nom)}"</strong> a les següents matèries del mateix grup que no tenen alumnes:
    <strong>${nomsMateriesDesti}</strong>.
    <br><br>
    Aquesta acció només afectarà les matèries actualment sense alumnes i NO té marxa enrere.`,
    async () => {
      window.mostrarToast('⏳ Copiant alumnes...', 2000);
      try {
        for (const desti of materiesDesti) {
          // Copiar solo si la materia destino sigue sin alumnos (para evitar race conditions o cambios de última hora)
          const currentDesti = grups.find(g => g.id === desti.id); // Re-fetch para el estado actual
          if (currentDesti && (!currentDesti.alumnes || currentDesti.alumnes.length === 0)) {
            await window.db.collection('grups_centre').doc(desti.id).update({
              alumnes: materiaOrigen.alumnes,
              alumnesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          }
        }
        window.mostrarToast(`✅ Alumnes copiats a ${materiesDesti.length} matèries.`, 3000);
        onRefresh?.();
      } catch (e) {
        window.mostrarToast('❌ Error copiant alumnes: ' + e.message, 5000);
        console.error('Error copiando alumnos a todas las materias:', e);
      }
    }
  );
}


/* ══════════════════════════════════════════════════════
   MODAL COPIAR ESTRUCTURA D'ALTRA NIVELL
══════════════════════════════════════════════════════ */
function modalCopiarEstructura(grupDesti, candidats, onRefresh) {

  if (!candidats.length) {
    window.mostrarToast('⚠️ No hi ha cap altre grup amb matèries',3000);
    return;
  }
  crearModal('📋 Copiar estructura de...', `
    <p style="font-size:13px;color:#6b7280;margin-bottom:14px;">
      Selecciona el grup d'on vols copiar totes les matèries a
      <strong>${grupDesti.nom}</strong>.
    </p>
    <div style="display:flex;flex-direction:column;gap:7px;">
      ${candidats.map(g => `
        <button class="btn-copy-estruct" data-id="${g.id}"
          style="padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:9px;
                 background:#fff;cursor:pointer;text-align:left;
                 font-size:13px;font-weight:600;">
          ${g.nom}
        </button>
      `).join('')}
    </div>
  `, () => false, '');

   setTimeout(() => {
    document.getElementById('_btnOkModal')?.style.setProperty('display','none');
    document.querySelectorAll('.btn-copy-estruct').forEach(btn => {
      btn.addEventListener('click', () => { // Inicio de la función callback del click
        const grupFont = candidats.find(x => x.id === btn.dataset.id);
        if (!grupFont) return;

        modalConfirmacio(
          '⚠️ Copiar matèries',
          `Estàs a punt de copiar totes les matèries de "${grupFont.nom}" a "${grupDesti.nom}". Això NO té marxa enrere.`,
          async () => {
            btn.disabled = true;
            btn.textContent = '⏳ Copiant...';

            try {
              const materiesFont = (materiesPer[grupFont.id] || []);
              let ordre = 1;
              for (const m of materiesFont) {
                await window.db.collection('grups_centre').add({
                  nom: m.nom,
                  tipus: m.tipus,
                  parentGrupId: grupDesti.id,
                  nivellId: grupDesti.nivellId,
                  nivellNom: grupDesti.nivellNom,
                  curs: grupDesti.curs,
                  ordre: ordre++,
                  alumnes: []
                });
              }
              window.mostrarToast(`✅ ${materiesFont.length} matèries copiades`);
              onRefresh?.();
            } catch(e) {
              window.mostrarToast('❌ Error: ' + e.message);
            }
          }
        );
      }); // <-- CIERRE DE LA FUNCIÓN CALLBACK DE addEventListener
    }); // <-- CIERRE DEL forEach
  }, 100); // <-- CIERRE DE LA FUNCIÓN CALLBACK DE setTimeout Y CIERRE DE setTimeout
} // <-- CIERRE DE LA FUNCIÓN modalCopiarEstructura

/* ══════════════════════════════════════════════════════
   MODAL COPIAR ESTRUCTURA A TOTS ELS GRUPS
══════════════════════════════════════════════════════ */
async function copiarEstructuraATots(grupFont, grupsDesti, materiesPer, onRefresh) {
  const materies = materiesPer[grupFont.id] || [];

  if (!materies.length) {
    window.mostrarToast('⚠️ Aquest grup no té matèries');
    return;
  }

 modalConfirmacio(
  '⚠️ Copiar estructures a tots els grups',
  `Estàs a punt de copiar ${materies.length} matèries de "${grupFont.nom}" a ${grupsDesti.length} grups.\nAixò NO té marxa enrere.`,
  async () => {
    try {
      for (const g of grupsDesti) {
        const existents = (materiesPer[g.id] || []).map(x => x.nom.toLowerCase());
        let ordre = (materiesPer[g.id]?.length || 0) + 1;

        for (const m of materies) {
          if (existents.includes(m.nom.toLowerCase())) continue;
          await window.db.collection('grups_centre').add({
            nom: m.nom,
            tipus: m.tipus,
            parentGrupId: g.id,
            nivellId: g.nivellId,
            nivellNom: g.nivellNom,
            curs: g.curs,
            ordre: ordre++,
            alumnes: []
          });
        }
      }
      window.mostrarToast(`✅ Estructura copiada a ${grupsDesti.length} grups`);
      onRefresh?.();
    } catch(e) {
      window.mostrarToast('❌ Error: ' + e.message);
    }
  }
);
} 

/* ══════════════════════════════════════════════════════
   MODAL AFEGIR ALUMNE
══════════════════════════════════════════════════════ */
function modalAlumne(grup, onRefresh) {
  crearModal('+ Nou alumne/a', `
    <div style="margin-bottom:12px;">
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Nom *</label>
      <input id="inpAlNom" type="text" placeholder="Pere"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Cognoms</label>
      <input id="inpAlCognoms" type="text" placeholder="Garcia Puig"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
    </div>
    <div>
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">RALC</label>
      <input id="inpAlRalc" type="text" placeholder="1234567890"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
    </div>
  `, async () => {
    const nom     = document.getElementById('inpAlNom').value.trim();
    const cognoms = document.getElementById('inpAlCognoms').value.trim();
    const ralc    = document.getElementById('inpAlRalc').value.trim();
    if (!nom) { window.mostrarToast('⚠️ El nom és obligatori'); return false; }
    const alumnes = [...(grup.alumnes||[]), {nom, cognoms, ralc}];
    await window.db.collection('grups_centre').doc(grup.id).update({alumnes, alumnesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()});
    grup.alumnes = alumnes;
    window.mostrarToast('✅ Alumne afegit');
    onRefresh?.(grup);
    return true;
  });
  setTimeout(()=>document.getElementById('inpAlNom')?.focus(), 100);
}

/* ══════════════════════════════════════════════════════
   MODAL CONFIRMACIÓ
══════════════════════════════════════════════════════ */

function modalConfirmacio(titol, missatge, onConfirm) {
  crearModal(titol, `
    <p style="font-size:13px;color:#6b7280;margin-bottom:20px;">${missatge}</p>
    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button id="_btnCancelModal" style="padding:6px 12px;border-radius:6px;border:1px solid #d1d5db;background:#f3f4f6;cursor:pointer;">Cancelar</button>
      <button id="_btnOkModal" style="padding:6px 12px;border-radius:6px;border:none;background:#4f46e5;color:#fff;font-weight:600;cursor:pointer;">Confirmar</button>
    </div>
  `, () => false, '');

  // Esdeveniments dels botons
  setTimeout(() => {
    document.getElementById('_btnCancelModal')?.addEventListener('click', () => {
      document.getElementById('_modalSec')?.remove();
    });
    document.getElementById('_btnOkModal')?.addEventListener('click', () => {
      document.getElementById('_modalSec')?.remove();
      onConfirm?.();
    });
  }, 50);
}
   
/* ══════════════════════════════════════════════════════
   MODAL EDITAR ALUMNE
══════════════════════════════════════════════════════ */
function modalEditarAlumne(grup, idx, onRefresh) {
  const a = grup.alumnes[idx];
  if (!a) return;

  crearModal('✏️ Editar alumne/a', `
    <div style="margin-bottom:12px;">
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Nom *</label>
      <input id="inpEditNom" type="text" value="${esH(a.nom||'')}"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
               border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Cognoms</label>
      <input id="inpEditCognoms" type="text" value="${esH(a.cognoms||'')}"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
               border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
    </div>
    <div>
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">RALC</label>
      <input id="inpEditRalc" type="text" value="${esH(a.ralc||'')}"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
               border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
    </div>
  `, async () => {
    const nom     = document.getElementById('inpEditNom').value.trim();
    const cognoms = document.getElementById('inpEditCognoms').value.trim();
    const ralc    = document.getElementById('inpEditRalc').value.trim();
    if (!nom) { window.mostrarToast('⚠️ El nom és obligatori'); return false; }
    const alumnesNous = [...grup.alumnes];
    alumnesNous[idx] = { nom, cognoms, ralc };
    await window.db.collection('grups_centre').doc(grup.id).update({ alumnes: alumnesNous, alumnesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    grup.alumnes = alumnesNous;
    window.mostrarToast('✅ Alumne actualitzat');
    onRefresh?.();
    return true;
  }, 'Guardar');

  setTimeout(() => document.getElementById('inpEditNom')?.focus(), 100);
}

function modalImportExcel(grup, onRefresh) {
  // Config columnes guardada per sessió
  const cfgKey = '_excelColCfg';
  const cfgDef = { primerFila: 2, colNom: 'C', colCog1: 'A', colCog2: 'B', colRalc: 'D' };
  const cfg = Object.assign({}, cfgDef, JSON.parse(sessionStorage.getItem(cfgKey)||'{}'));

  // Genera options <A-Z> amb selected
  const optsCol = (sel, buit) => {
    let html = buit ? '<option value="">— cap —</option>' : '';
    for (let i=0;i<26;i++) {
      const l = String.fromCharCode(65+i);
      html += `<option value="${l}"${sel===l?' selected':''}>${l}</option>`;
    }
    return html;
  };

  const inputStyle = 'width:100%;box-sizing:border-box;padding:7px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;background:#f9fafb;';
  const labelStyle = 'font-size:11px;font-weight:700;color:#6b7280;display:block;margin-bottom:4px;';

  crearModal('📥 Importar alumnes des d\'Excel',
    `<div style="margin-bottom:14px;">
      <label style="font-size:13px;font-weight:700;color:#374151;display:block;margin-bottom:8px;">
        1. Selecciona el fitxer
      </label>
      <input type="file" id="inpExcelAlumnes" accept=".xlsx,.xls,.csv"
        style="width:100%;padding:10px;border:2px dashed #7c3aed;border-radius:10px;font-size:13px;cursor:pointer;background:#f9fafb;box-sizing:border-box;">
      <div id="infoFitxer" style="font-size:11px;color:#9ca3af;margin-top:6px;"></div>
    </div>

    <div id="seccioCols" style="display:none;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;padding:14px;margin-bottom:12px;">
      <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:12px;">
        2. Indica quina columna conté cada camp
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <label style="${labelStyle}">Fila inici *</label>
          <input id="cfgFila" type="number" min="1" value="${cfg.primerFila}"
            style="${inputStyle}text-align:center;width:60px;">
        </div>
        <div>
          <label style="${labelStyle}">NOM *</label>
          <select id="cfgNom" style="${inputStyle}">${optsCol(cfg.colNom, false)}</select>
        </div>
        <div>
          <label style="${labelStyle}">COGNOM 1</label>
          <select id="cfgCog1" style="${inputStyle}">${optsCol(cfg.colCog1, true)}</select>
        </div>
        <div>
          <label style="${labelStyle}">COGNOM 2</label>
          <select id="cfgCog2" style="${inputStyle}">${optsCol(cfg.colCog2, true)}</select>
        </div>
        <div>
          <label style="${labelStyle}">RALC</label>
          <select id="cfgRalc" style="${inputStyle}">${optsCol(cfg.colRalc, true)}</select>
        </div>
      </div>

      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;font-size:11px;color:#92400e;margin-bottom:10px;">
        💡 "Fila inici" = primera fila amb dades d'alumnes (si la fila 1 és capçalera, posa 2)
      </div>

      <button id="btnPreview" style="padding:6px 14px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
        🔄 Vista prèvia
      </button>
    </div>

    <div id="previewImport" style="max-height:200px;overflow-y:auto;"></div>`,
    async () => {
      const file = document.getElementById('inpExcelAlumnes')?.files[0];
      if (!file) { window.mostrarToast('⚠️ Selecciona un fitxer'); return false; }
      const colCfg = llegirCfgCols();
      sessionStorage.setItem(cfgKey, JSON.stringify(colCfg));
      const nous = await parseExcelAlumnes(file, colCfg);
      if (!nous.length) { window.mostrarToast('⚠️ Cap alumne trobat. Revisa la configuració'); return false; }
      const actuals = grup.alumnes || [];
      const nodupl = nous.filter(a => !actuals.some(ex =>
        (a.ralc && ex.ralc === a.ralc) || (ex.nom===a.nom && ex.cognoms===a.cognoms)
      ));
      await window.db.collection('grups_centre').doc(grup.id).update({ alumnes: [...actuals, ...nodupl], alumnesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      grup.alumnes = [...actuals, ...nodupl];
      window.mostrarToast(`✅ ${nodupl.length} alumnes importats (${nous.length-nodupl.length} duplicats ignorats)`);
      onRefresh?.();
      return true;
    }, 'Importar');

  function llegirCfgCols() {
    return {
      primerFila: parseInt(document.getElementById('cfgFila')?.value||'2')||2,
      colNom:  document.getElementById('cfgNom')?.value  || 'C',
      colCog1: document.getElementById('cfgCog1')?.value || '',
      colCog2: document.getElementById('cfgCog2')?.value || '',
      colRalc: document.getElementById('cfgRalc')?.value || '',
    };
  }

  async function mostrarPreview() {
    const file = document.getElementById('inpExcelAlumnes')?.files[0];
    if (!file) return;
    const alumnes = await parseExcelAlumnes(file, llegirCfgCols());
    const div = document.getElementById('previewImport');
    if (!div) return;
    if (!alumnes.length) {
      div.innerHTML = '<div style="color:#ef4444;padding:8px;font-size:12px;">⚠️ Cap alumne amb aquesta config. Ajusta les columnes o la fila inici.</div>';
      return;
    }
    div.innerHTML = `
      <p style="font-size:12px;font-weight:700;color:#059669;margin:4px 0 8px;">✅ ${alumnes.length} alumnes detectats</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <tr style="background:#f3f4f6;">
          <th style="padding:5px 8px;text-align:left;">#</th>
          <th style="padding:5px 8px;text-align:left;">Cognoms</th>
          <th style="padding:5px 8px;text-align:left;">Nom</th>
          <th style="padding:5px 8px;text-align:left;">RALC</th>
        </tr>
        ${alumnes.slice(0,20).map((a,i)=>`
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:4px 8px;color:#9ca3af;">${i+1}</td>
            <td style="padding:4px 8px;">${esH(a.cognoms||'—')}</td>
            <td style="padding:4px 8px;font-weight:600;">${esH(a.nom)}</td>
            <td style="padding:4px 8px;color:#6b7280;">${esH(a.ralc||'—')}</td>
          </tr>`).join('')}
        ${alumnes.length>20?`<tr><td colspan="4" style="padding:5px 8px;color:#9ca3af;font-style:italic;">... i ${alumnes.length-20} alumnes més</td></tr>`:''}
      </table>`;
  }

  setTimeout(() => {
    document.getElementById('btnPreview')?.addEventListener('click', mostrarPreview);
    document.getElementById('inpExcelAlumnes')?.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      // Mostrar info del fitxer i capçalera
      try {
        await new Promise(res => {
          const r = new FileReader();
          r.onload = ev => {
            try {
              const wb = XLSX.read(ev.target.result, {type:'binary'});
              const ws = wb.Sheets[wb.SheetNames[0]];
              const rang = XLSX.utils.decode_range(ws['!ref']||'A1:A1');
              const nF = rang.e.r+1, nC = rang.e.c+1;
              // Llegir fila 1 per mostrar capçalera
              const cap = [];
              for (let c=0; c<Math.min(nC,8); c++) {
                const cell = ws[XLSX.utils.encode_cell({r:0,c})];
                cap.push(cell ? `${String.fromCharCode(65+c)}:"${cell.v}"` : '');
              }
              const info = document.getElementById('infoFitxer');
              if (info) info.innerHTML = `📊 ${nF} files × ${nC} columnes &nbsp;·&nbsp; Fila 1: ${cap.filter(Boolean).join(' &nbsp; ')}`;
            } catch(e){}
            res();
          };
          r.readAsBinaryString(file);
        });
      } catch(e){}
      document.getElementById('seccioCols').style.display = 'block';
      await mostrarPreview();
    });
  }, 200);
}

async function parseExcelAlumnes(file, colCfg) {
  const cfg = colCfg || { primerFila:2, colNom:'C', colCog1:'A', colCog2:'B', colRalc:'D' };
  const ci = l => l ? l.toUpperCase().charCodeAt(0)-65 : -1;
  const iNom  = ci(cfg.colNom);
  const iCog1 = ci(cfg.colCog1 || cfg.colCognom1);
  const iCog2 = ci(cfg.colCog2 || cfg.colCognom2);
  const iRalc = ci(cfg.colRalc);
  const inici = (cfg.primerFila||2) - 1; // 0-indexed

  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, {type:'binary'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
        const alumnes = [];
        for (let i=inici; i<rows.length; i++) {
          const row = rows[i];
          const nom = iNom>=0 ? String(row[iNom]||'').trim() : '';
          if (!nom) continue;
          const cog1 = iCog1>=0 ? String(row[iCog1]||'').trim() : '';
          const cog2 = iCog2>=0 ? String(row[iCog2]||'').trim() : '';
          const ralc = iRalc>=0 ? String(row[iRalc]||'').trim() : '';
          alumnes.push({ nom, cognoms:[cog1,cog2].filter(Boolean).join(' '), ralc });
        }
        resolve(alumnes);
      } catch(err) {
        console.error('parseExcelAlumnes:', err);
        resolve([]);
      }
    };
    reader.readAsBinaryString(file);
  });
}

/* ══════════════════════════════════════════════════════
   ELIMINAR GRUP EN CASCADA
   Esborra: grups_centre, avaluacio_centre, classes (ownerUid qualsevol)
══════════════════════════════════════════════════════ */
async function eliminarGrupComplet(grupId, nomGrup) {
  const db = window.db;
  window.mostrarToast(`⏳ Eliminant "${nomGrup}"...`, 2000);

  try {
    // 1. Eliminar el grup de grups_centre
    await db.collection('grups_centre').doc(grupId).delete();

    // 2. Eliminar classes que apunten a aquest grup
    //    (les classes creades a partir del grup tenen grupCentreId)
    try {
      const classesSnap = await db.collection('classes')
        .where('grupCentreId', '==', grupId).get();

      if (!classesSnap.empty) {
        const batch = db.batch();
        const alumneIds = [];

        classesSnap.docs.forEach(classeDoc => {
          const alumnesClasse = classeDoc.data().alumnes || [];
          alumneIds.push(...alumnesClasse);
          batch.delete(classeDoc.ref);
        });

        // Eliminar els alumnes de la col·lecció alumnes
        // (en blocs de 500 per límit de Firestore)
        for (let i = 0; i < alumneIds.length; i += 400) {
          const chunk = alumneIds.slice(i, i+400);
          const batchAl = db.batch();
          chunk.forEach(id => batchAl.delete(db.collection('alumnes').doc(id)));
          await batchAl.commit();
        }

        await batch.commit();

        // Eliminar referència de les classes dels professors
        const profSnap = await db.collection('professors').get();
        const batchProf = db.batch();
        const classIds = classesSnap.docs.map(d => d.id);
        profSnap.docs.forEach(pDoc => {
          const classes = (pDoc.data().classes || []).filter(c => !classIds.includes(c));
          if (classes.length !== (pDoc.data().classes||[]).length) {
            batchProf.update(pDoc.ref, { classes });
          }
        });
        await batchProf.commit();
      }
    } catch(e) {
      console.warn('No shan pogut eliminar classes:', e.message);
    }

    // 3. Eliminar dades d'avaluació centre per aquest grup
    //    Estructura: avaluacio_centre/{curs}/{subColId}/{alumneId}
    //    El grupId pot ser el ID de la subcolecció (materiaId)
    try {
      // Llegir tots els cursos que existeixen a avaluacio_centre
      const cursosSnap = await db.collection('avaluacio_centre').get();
      for (const cursDoc of cursosSnap.docs) {
        // Intentar llegir la subcolecció amb el grupId
        try {
          const subSnap = await db.collection('avaluacio_centre')
            .doc(cursDoc.id)
            .collection(grupId)
            .get();
          if (!subSnap.empty) {
            const batchAv = db.batch();
            subSnap.docs.forEach(d => batchAv.delete(d.ref));
            await batchAv.commit();
          }
        } catch(e2) {}

        // També buscar per grupId dins de qualsevol subcolecció
        // (per si el professor va enviar amb el grup classe com a referència)
        try {
          const totsGrups = await db.collection('grups_centre').get();
          for (const g of totsGrups.docs) {
            const snap3 = await db.collection('avaluacio_centre')
              .doc(cursDoc.id)
              .collection(g.id)
              .where('grupId', '==', grupId)
              .get();
            if (!snap3.empty) {
              const b3 = db.batch();
              snap3.docs.forEach(d => b3.delete(d.ref));
              await b3.commit();
            }
          }
        } catch(e3) {}
      }
    } catch(e) { console.warn('eliminar avaluacio_centre:', e.message); }

    window.mostrarToast(`✅ "${nomGrup}" eliminat correctament`);
  } catch(e) {
    console.error('eliminarGrupComplet:', e);
    window.mostrarToast(`❌ Error eliminant: ${e.message}`, 5000);
  }
}

/* ══════════════════════════════════════════════════════
   MODAL ELIMINAR NIVELL
══════════════════════════════════════════════════════ */
async function eliminarNivell(nivellId) {
  const db = window.db;
  window.mostrarToast('⏳ Eliminant nivell...', 2000);
  // Eliminar tots els grups del nivell (classes i matèries)
  const snap = await db.collection('grups_centre').where('nivellId','==',nivellId).get();
  // Per a cada grup, fer eliminació completa en cascada
  for (const d of snap.docs) {
    await eliminarGrupComplet(d.id, d.data().nom);
  }
  // Eliminar el nivell
  await db.collection('nivells_centre').doc(nivellId).delete();
  window.mostrarToast('🗑️ Nivell i tots els grups eliminats');
  await window._secOnNivellCreat?.();
}

/* ══════════════════════════════════════════════════════
   TAB USUARIS — gestió completa
══════════════════════════════════════════════════════ */
async function renderUsuaris(body) {
  let usuaris = [];
  try {
    const snap = await window.db.collection('professors').orderBy('email').get();
    usuaris = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    body.innerHTML = `<div style="color:#ef4444;">Error: ${e.message}</div>`;
    return;
  }

  // Comptar pendents
  const pendents = usuaris.filter(u => Array.isArray(u.rols) && u.rols.length === 0);
  const nPendents = pendents.length;

  body.innerHTML = `
    ${nPendents > 0 ? `
    <div id="bannerPendents" style="
      background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;
      padding:14px 18px;margin-bottom:18px;
      display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
    ">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:24px;">⚠️</span>
        <div>
          <div style="font-size:14px;font-weight:800;color:#b91c1c;">
            ${nPendents} usuari${nPendents!==1?'s':''} pendent${nPendents!==1?'s':''} d'assignar rol
          </div>
          <div style="font-size:12px;color:#ef4444;margin-top:2px;">
            Aquests usuaris no poden accedir a l'aplicació fins que els assignis un rol.
          </div>
        </div>
      </div>
      <button id="btnFiltrarPendents" style="
        padding:8px 16px;background:#ef4444;color:#fff;border:none;
        border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;
      ">Veure pendents</button>
    </div>` : ''}

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
      <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin:0;">👥 Usuaris (${usuaris.length})</h3>
      <div style="display:flex;gap:8px;">
        <input id="buscaUser" type="text" placeholder="🔍 Cercar..."
          style="padding:7px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;width:180px;">
        <button id="btnNouUsuari" style="padding:8px 16px;background:#7c3aed;color:#fff;
          border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
          + Nou usuari
        </button>
      </div>
    </div>

    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;" id="taulaUsuaris">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px 14px;text-align:left;font-weight:600;color:#374151;">Nom / Email</th>
            <th style="padding:10px 14px;text-align:left;font-weight:600;color:#374151;">Rols</th>
            <th style="padding:10px 14px;text-align:center;font-weight:600;color:#374151;">Estat</th>
            <th style="padding:10px 14px;text-align:center;font-weight:600;color:#374151;">Accions</th>
          </tr>
        </thead>
        <tbody id="tbody-usuaris">
          ${renderFilesUsuaris(usuaris)}
        </tbody>
      </table>
    </div>
  `;

  // Cerca en temps real
  document.getElementById('buscaUser').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtrats = usuaris.filter(u =>
      (u.nom||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q)
    );
    document.getElementById('tbody-usuaris').innerHTML = renderFilesUsuaris(filtrats);
    assignarEventsUsuaris(filtrats, usuaris);
  });

  document.getElementById('btnNouUsuari').addEventListener('click', () =>
    modalNouUsuari(() => renderUsuaris(body))
  );

  // Botó filtre pendents
  document.getElementById('btnFiltrarPendents')?.addEventListener('click', () => {
    const filtrats = usuaris.filter(u => Array.isArray(u.rols) && u.rols.length === 0);
    document.getElementById('tbody-usuaris').innerHTML = renderFilesUsuaris(filtrats);
    document.getElementById('buscaUser').value = '';
    assignarEventsUsuaris(filtrats, usuaris);
    // Ressaltar que estem filtrant
    const btn = document.getElementById('btnFiltrarPendents');
    if (btn) {
      btn.textContent = '✕ Treure filtre';
      btn.style.background = '#6b7280';
      btn.onclick = () => {
        document.getElementById('tbody-usuaris').innerHTML = renderFilesUsuaris(usuaris);
        assignarEventsUsuaris(usuaris, usuaris);
        btn.textContent = 'Veure pendents';
        btn.style.background = '#ef4444';
        btn.onclick = null;
      };
    }
  });

  assignarEventsUsuaris(usuaris, usuaris);
}

function renderFilesUsuaris(usuaris) {
  return usuaris.map(u => {
    // Assegurar que rols és sempre array
    const rols = Array.isArray(u.rols) ? u.rols :
                 (u.isAdmin ? ['admin'] : ['professor']);
    return `
      <tr style="border-bottom:1px solid #f3f4f6;" data-uid="${u.id}">
        <td style="padding:12px 14px;">
          <div style="font-weight:600;color:#1e1b4b;">${esH(u.nom || '—')}</div>
          <div style="font-size:12px;color:#9ca3af;">${esH(u.email || '')}</div>
        </td>
        <td style="padding:12px 14px;">
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            ${rols.map(r => `
              <span style="padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;
                           background:${rolColor(r)};color:#fff;">${r}</span>
            `).join('')}
          </div>
        </td>
        <td style="padding:12px 14px;text-align:center;">
          ${u.forcePasswordChange
            ? '<span style="color:#f59e0b;font-size:12px;">🔑 Pendent</span>'
            : '<span style="color:#22c55e;font-size:12px;">✅ Actiu</span>'
          }
        </td>
        <td style="padding:12px 14px;text-align:center;">
          <div style="display:flex;gap:6px;justify-content:center;">
            <button class="btn-rols-user" data-id="${u.id}" style="
              padding:5px 10px;background:#e0e7ff;color:#4338ca;border:none;
              border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
              🎭 Rols
            </button>
            <button class="btn-reset-pw" data-id="${u.id}" data-email="${esH(u.email)}" style="
              padding:5px 10px;background:#fef3c7;color:#92400e;border:none;
              border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
              🔑 Reset pw
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function assignarEventsUsuaris(usuarisFiltrats, usuarisTotal) {
  document.querySelectorAll('.btn-rols-user').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = usuarisTotal.find(u => u.id === btn.dataset.id);
      if (u) modalEditarRols(u, () => {
        const body = document.getElementById('secBody');
        if (body) renderUsuaris(body);
      });
    });
  });
  document.querySelectorAll('.btn-reset-pw').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Marcar "${btn.dataset.email}" per canviar contrasenya en el proper accés?`)) return;
      await window.db.collection('professors').doc(btn.dataset.id).update({forcePasswordChange: true});
      window.mostrarToast('✅ L\'usuari haurà de canviar la contrasenya');
    });
  });
}

/* ══════════════════════════════════════════════════════
   MODAL NOU USUARI
══════════════════════════════════════════════════════ */
function modalNouUsuari(onCreat) {
  const pwGen = generarPassword();
  const cfgKey = '_excelColCfg';
  const cfgDef = { primerFila: 2, colNom: 'B', colCog1: 'A', colCog2: '', colEmail: 'C' };
  const cfg = Object.assign({}, cfgDef, JSON.parse(sessionStorage.getItem(cfgKey)||'{}'));

  const optsCol = (sel, buit) => {
    let html = buit ? '<option value="">— cap —</option>' : '';
    for (let i=0;i<26;i++){
      const l = String.fromCharCode(65+i);
      html += `<option value="${l}"${sel===l?' selected':''}>${l}</option>`;
    }
    return html;
  };

  const inputStyle = 'width:100%;box-sizing:border-box;padding:7px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;background:#f9fafb;';
  const labelStyle = 'font-size:11px;font-weight:700;color:#6b7280;display:block;margin-bottom:4px;';

  crearModal('+ Nou usuari', `
    <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:12px;">
      <button id="btnIndividual" style="flex:1;padding:9px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
        👤 Crear un usuari
      </button>
      <button id="btnImportExcel" style="flex:1;padding:9px;background:#4ade80;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
        📥 Importar Excel
      </button>
    </div>

    <div id="seccioIndividual">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Nom complet *</label>
          <input id="inpNomUser" type="text" placeholder="Maria Garcia"
            style="width:100%;box-sizing:border-box;padding:9px 11px;border:1.5px solid #e5e7eb;border-radius:9px;font-size:13px;">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Email *</label>
          <input id="inpEmailUser" type="email" placeholder="professor@insmatadepera.cat"
            style="width:100%;box-sizing:border-box;padding:9px 11px;border:1.5px solid #e5e7eb;border-radius:9px;font-size:13px;">
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Contrasenya inicial *</label>
        <div style="display:flex;gap:8px;">
          <input id="inpPwUser" type="text" value="${pwGen}"
            style="flex:1;padding:9px 11px;border:1.5px solid #e5e7eb;border-radius:9px;font-size:13px;">
          <button id="btnGenPw2" style="padding:9px 14px;background:#f3f4f6;border:none;border-radius:9px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">🎲 Nova</button>
        </div>
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Rols</label>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
         ${(['alumne','professor','tutor','secretaria','revisor','admin','superadmin']
       .filter(r => {
         const uRols = window._userRols || [];
         if (uRols.includes('superadmin')) return true;
         if (uRols.includes('admin')) return r !== 'superadmin';
         if (uRols.includes('secretaria')) return r !== 'admin' && r !== 'superadmin';
         return false;
       })
      ).map(r => `
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input type="checkbox" class="chk-rol-nou" value="${r}" ${r==='professor'?'checked':''}
                style="width:16px;height:16px;accent-color:${rolColor(r)};"
                onchange="window._aaOnRolNouChange && window._aaOnRolNouChange(this)">
              <span style="font-size:13px;font-weight:600;color:${rolColor(r)};">${r}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <!-- Camp RALC — visible només quan es marca el rol alumne -->
      <div id="secRALC" style="display:none;margin-bottom:14px;padding:12px;background:#e0f2fe;border:1.5px solid #7dd3fc;border-radius:10px;">
        <label style="font-size:12px;font-weight:700;color:#0369a1;display:block;margin-bottom:6px;">
          🎓 RALC de l'alumne <span style="color:#ef4444;">*</span>
        </label>
        <input id="inpRalcAlumne" type="text" placeholder="Ex: 12345678A"
          style="width:100%;box-sizing:border-box;padding:9px 11px;border:1.5px solid #7dd3fc;border-radius:8px;font-size:13px;outline:none;background:#fff;">
        <div style="font-size:11px;color:#0369a1;margin-top:5px;">Identifica l'alumne i permet associar les seves autoavaluacions.</div>
      </div>
      <div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#374151;">
          <input type="checkbox" id="chkForcePw" checked style="width:16px;height:16px;">
          Forçar canvi de contrasenya en el primer accés
        </label>
      </div>
      <div id="errUser" style="color:#ef4444;font-size:12px;min-height:16px;margin-top:10px;"></div>
    </div>

    <div id="seccioImport" style="display:none;">
      <div style="margin-bottom:14px;">
        <input type="file" id="inpExcelUsuaris" accept=".xlsx,.xls,.csv"
          style="width:100%;padding:10px;border:2px dashed #7c3aed;border-radius:10px;font-size:13px;cursor:pointer;background:#f9fafb;">
        <div id="infoFitxer" style="font-size:11px;color:#9ca3af;margin-top:6px;"></div>
      </div>

      <div id="seccioCols" style="display:none;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;padding:14px;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:12px;">Indica quina columna conté cada camp</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px;">
          <div>
            <label style="${labelStyle}">Fila inici *</label>
            <input id="cfgFila" type="number" min="1" value="${cfg.primerFila}" style="${inputStyle}text-align:center;">
          </div>
          <div>
            <label style="${labelStyle}">Nom *</label>
            <select id="cfgNom" style="${inputStyle}">${optsCol(cfg.colNom,false)}</select>
          </div>
          <div>
            <label style="${labelStyle}">Cognoms</label>
            <select id="cfgCog1" style="${inputStyle}">${optsCol(cfg.colCog1,true)}</select>
          </div>
          <div>
            <label style="${labelStyle}">Email *</label>
            <select id="cfgEmail" style="${inputStyle}">${optsCol(cfg.colEmail,false)}</select>
          </div>
        </div>
        <button id="btnPreview" style="padding:6px 14px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">🔄 Vista prèvia</button>
      </div>
      <div id="previewImport" style="max-height:200px;overflow-y:auto;"></div>
    </div>
  `, async () => {
    // ── Callback onOk ──────────────────────────────────
    const seccioInd = document.getElementById('seccioIndividual');
    const inpExcel  = document.getElementById('inpExcelUsuaris');

    if (seccioInd && seccioInd.style.display !== 'none') {
      // ── Crear usuari individual ──────────────────────
      const nom   = document.getElementById('inpNomUser').value.trim();
      const email = document.getElementById('inpEmailUser').value.trim();
      const pw    = document.getElementById('inpPwUser').value.trim();
      const rols  = [...document.querySelectorAll('.chk-rol-nou:checked')].map(c=>c.value);
      const force = document.getElementById('chkForcePw').checked;
      const errEl = document.getElementById('errUser');

      if (!nom || !email || !pw) { errEl.textContent = '⚠️ Omple els camps obligatoris'; return false; }
      if (pw.length < 6)         { errEl.textContent = '⚠️ Mínim 6 caràcters';            return false; }

      errEl.textContent = '⏳ Creant usuari...';

      try {
        // Segona instància Firebase per crear usuari sense tancar la sessió admin
        const app2 = firebase.apps.find(a=>a.name==='_sec_create') ||
                     firebase.initializeApp(firebase.app().options, '_sec_create');
        const auth2 = app2.auth();

        const cred = await auth2.createUserWithEmailAndPassword(email, pw);
        const uid  = cred.user.uid;

        // Enviar email de benvinguda amb link per crear contrasenya pròpia
        // Ho fem ABANS de signOut perquè auth2 és la instància activa
        await auth2.sendPasswordResetEmail(email);
        await auth2.signOut();

        const ralc = document.getElementById('inpRalcAlumne')?.value?.trim()?.toUpperCase() || '';
        await window.db.collection('professors').doc(uid).set({
          nom,
          email,
          rols: rols.length > 0 ? rols : [],
          isAdmin: rols.includes('admin') || rols.includes('superadmin'),
          ...(ralc && rols.includes('alumne') ? { ralc } : {}),
          forcePasswordChange: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          creatPer: firebase.auth().currentUser?.uid || '',
          suspended: false,
          deleted: false,
        });

        window.mostrarToast(`✅ Usuari creat i email enviat a ${email}`, 4000);
        setTimeout(() => comprovarUsuarisPendents(), 500);
        onCreat?.();
        return true;

      } catch(e) {
        const missatges = {
          'auth/email-already-in-use': '⚠️ Aquest email ja existeix',
          'auth/invalid-email':        '⚠️ Email no vàlid',
          'auth/weak-password':        '⚠️ Contrasenya massa feble',
        };
        errEl.textContent = missatges[e.code] || ('Error: ' + e.message);
        return false;
      }

    } else {
      // ── Import Excel ─────────────────────────────────
      const file = inpExcel?.files[0];
      if (!file) { window.mostrarToast('⚠️ Selecciona un fitxer Excel'); return false; }

      const colCfg = JSON.parse(sessionStorage.getItem(cfgKey) || '{}');
      const usuaris = await parseExcelUsuaris(file, colCfg);
      if (!usuaris.length) { window.mostrarToast('⚠️ Cap usuari detectat'); return false; }

      const errEl = document.getElementById('errUser');
      if (errEl) errEl.textContent = `⏳ Creant ${usuaris.length} usuaris...`;

      const app2 = firebase.apps.find(a=>a.name==='_sec_create') ||
                   firebase.initializeApp(firebase.app().options, '_sec_create');
      const auth2 = app2.auth();

      let creats = 0, errors = 0;
      for (const u of usuaris) {
        try {
          const cred = await auth2.createUserWithEmailAndPassword(u.email, u.passwordClar);
          const uid  = cred.user.uid;

          // Enviar email per crear contrasenya pròpia
          await auth2.sendPasswordResetEmail(u.email);
          await auth2.signOut();

          await window.db.collection('professors').doc(uid).set({
            nom: u.nom,
            email: u.email,
            rols: ['professor'],
            isAdmin: false,
            forcePasswordChange: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            creatPer: firebase.auth().currentUser?.uid || '',
            suspended: false,
            deleted: false,
          });
          creats++;
        } catch(e) {
          console.warn(`Error creant ${u.email}:`, e.message);
          errors++;
        }
      }

      window.mostrarToast(`✅ ${creats} usuaris creats${errors ? ` · ${errors} errors` : ''}`, 4000);
      onCreat?.();
      return true;
    }
  }, 'Crear usuari');

  setTimeout(() => {
    // Canviar secció
    document.getElementById('btnIndividual')?.addEventListener('click', () => {
      document.getElementById('seccioIndividual').style.display = '';
      document.getElementById('seccioImport').style.display = 'none';
    });
    document.getElementById('btnImportExcel')?.addEventListener('click', () => {
      document.getElementById('seccioIndividual').style.display = 'none';
      document.getElementById('seccioImport').style.display = '';
    });

    // Nova contrasenya
    document.getElementById('btnGenPw2')?.addEventListener('click', () => {
      document.getElementById('inpPwUser').value = generarPassword();
    });

    document.getElementById('inpNomUser')?.focus();

    const inpExcel   = document.getElementById('inpExcelUsuaris');
    const seccioCols = document.getElementById('seccioCols');
    const previewDiv = document.getElementById('previewImport');

    function processarFitxerExcel(file) {
      if (!file) return;
      seccioCols.style.display = 'block';
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const wb = XLSX.read(ev.target.result, {type:'binary'});
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
          const nF = rows.length, nC = Math.max(...rows.map(r=>r.length));
          previewDiv.innerHTML = `<p style="font-size:12px;color:#374151;">✅ <strong>${file.name}</strong> · ${nF} files × ${nC} columnes</p>`;
        } catch(e) { previewDiv.innerHTML = '<p style="color:#ef4444;">⚠️ Error llegint el fitxer</p>'; }
      };
      reader.readAsBinaryString(file);
    }

    inpExcel?.addEventListener('change', e => processarFitxerExcel(e.target.files[0]));

    // Drag & drop
    const dropZone = inpExcel?.parentElement || inpExcel;
    if (dropZone) {
      dropZone.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); if(inpExcel) inpExcel.style.borderColor='#7c3aed'; });
      dropZone.addEventListener('dragleave', e => { e.stopPropagation(); if(inpExcel) inpExcel.style.borderColor=''; });
      dropZone.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation();
        if(inpExcel) inpExcel.style.borderColor='';
        const file = e.dataTransfer.files[0];
        if (file) { const dt = new DataTransfer(); dt.items.add(file); inpExcel.files = dt.files; processarFitxerExcel(file); }
      });
    }

    document.getElementById('btnPreview')?.addEventListener('click', async () => {
      const file = inpExcel?.files[0]; if (!file) return;
      const colCfg = {
        primerFila: parseInt(document.getElementById('cfgFila')?.value||'2') || 2,
        colNom:   document.getElementById('cfgNom')?.value  || 'B',
        colCog1:  document.getElementById('cfgCog1')?.value || '',
        colEmail: document.getElementById('cfgEmail')?.value || 'C',
      };
      sessionStorage.setItem(cfgKey, JSON.stringify(colCfg));
      const alumnes = await parseExcelUsuaris(file, colCfg);
      if (!alumnes.length) {
        previewDiv.innerHTML = '<div style="color:#ef4444;">⚠️ Cap usuari detectat. Revisa les columnes.</div>';
      } else {
        previewDiv.innerHTML = `
          <p style="font-size:12px;color:#059669;">✅ ${alumnes.length} usuaris detectats</p>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <tr style="background:#f3f4f6;"><th style="padding:4px 6px;">#</th><th style="padding:4px 6px;">Nom</th><th style="padding:4px 6px;">Cognoms</th><th style="padding:4px 6px;">Email</th></tr>
            ${alumnes.slice(0,20).map((u,i)=>`
              <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:3px 6px;">${i+1}</td>
                <td style="padding:3px 6px;">${esH(u.nom)}</td>
                <td style="padding:3px 6px;">${esH(u.cognoms)}</td>
                <td style="padding:3px 6px;">${esH(u.email)}</td>
              </tr>`).join('')}
            ${alumnes.length > 20 ? `<tr><td colspan="4" style="padding:4px 6px;color:#9ca3af;">... i ${alumnes.length-20} més</td></tr>` : ''}
          </table>`;
      }
    });

  }, 200);
}

// Funció parse Excel per usuaris
async function parseExcelUsuaris(file,colCfg){
  const ci=l=>l?l.toUpperCase().charCodeAt(0)-65:-1;
  const iNom = ci(colCfg.colNom), iCog = ci(colCfg.colCog1), iEmail = ci(colCfg.colEmail);
  const inici = (colCfg.primerFila||2)-1;
  return new Promise(resolve=>{
    const reader = new FileReader();
    reader.onload = e=>{
      try{
        const wb = XLSX.read(e.target.result,{type:'binary'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
        const usuaris = [];
        for(let i=inici;i<rows.length;i++){
          const row=rows[i];
          const nom = iNom>=0?String(row[iNom]||'').trim():'';
          const cognoms = iCog>=0?String(row[iCog]||'').trim():'';
          const email = iEmail>=0?String(row[iEmail]||'').trim():'';
          if(!nom||!email) continue;
          usuaris.push({nom,cognoms,email,passwordClar:generarPassword()});
        }
        resolve(usuaris);
      } catch(err){ console.error(err); resolve([]); }
    };
    reader.readAsBinaryString(file);
  });
}


/* ══════════════════════════════════════════════════════
   MODAL EDITAR ROLS
══════════════════════════════════════════════════════ */
async function modalEditarRols(usuari, onGuardat) {
  const rolsActuals = Array.isArray(usuari.rols) ? usuari.rols :
                      (usuari.isAdmin ? ['admin'] : ['professor']);
  const descrip = {
    professor:  'Genera comentaris i avaluació',
    tutor:      'Panell tutoria — grup assignat',
    pedagog:    'Panell tutoria — tots els grups',
    secretaria: 'Gestió estructura i butlletins',
    revisor:    'Lectura/edició cursos assignats',
    admin:      'Accés total a la plataforma',
  };

  // Carregar nivells per assignar al revisor
  let nivellsCentre = [];
  try {
    const snap = await window.db.collection('nivells_centre').orderBy('ordre').get();
    nivellsCentre = snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch(e){}

  const revisorNivells = Array.isArray(usuari.revisio_nivells) ? usuari.revisio_nivells : [];

  // Carregar grups classe per assignar al tutor (A, B, C, D...)
  let grupsTutoria = [];
  try {
    const snapT = await window.db.collection('grups_centre')
      .where('tipus','==','classe').orderBy('ordre').get();
    grupsTutoria = snapT.docs.map(d=>({id:d.id,...d.data()}));
  } catch(e){
    // Si no hi ha índex, carregar tots i filtrar
    try {
      const snapT2 = await window.db.collection('grups_centre').get();
      grupsTutoria = snapT2.docs.map(d=>({id:d.id,...d.data()}))
        .filter(g => g.tipus === 'classe')
        .sort((a,b) => (a.ordre||99)-(b.ordre||99));
    } catch(e2){}
  }
  const tutorGrups = Array.isArray(usuari.tutoria_grups) ? usuari.tutoria_grups : [];

  crearModal(`🎭 Rols — ${usuari.nom||usuari.email}`, `
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${(['alumne','professor','tutor','pedagog','secretaria','revisor','admin','superadmin']
   .filter(r => {
     const uRols = window._userRols || [];
     if (uRols.includes('superadmin')) return true;
     if (uRols.includes('admin')) return r !== 'superadmin';
     // Secretaria: NO veu superadmin (rol ocult). Veu admin però no el pot modificar.
     if (uRols.includes('secretaria')) return r !== 'superadmin';
     return false;
   })
).map(r=>{
    const uRols2 = window._userRols || [];
    const esRestringit = uRols2.includes('secretaria') &&
      !uRols2.some(x => ['admin','superadmin'].includes(x)) &&
      r === 'admin';
    return `
        <label style="display:flex;align-items:center;gap:12px;
                      ${esRestringit ? 'cursor:not-allowed;opacity:0.55;' : 'cursor:pointer;'}
                      padding:12px 14px;border-radius:10px;background:#f9fafb;
                      border:2px solid ${rolsActuals.includes(r)?rolColor(r):'#e5e7eb'};
                      transition:border-color 0.2s;"
               id="row-rol-${r}">
          <input type="checkbox" class="chk-rol-edit" value="${r}"
            ${rolsActuals.includes(r)?'checked':''}
            ${esRestringit ? 'disabled title="No pots modificar rols dadministrador"' : ''}
            style="width:18px;height:18px;accent-color:${rolColor(r)};"
            onchange="window._aaOnRolEditChange && window._aaOnRolEditChange(this)">
          <div style="flex:1;">
            <div style="font-weight:700;color:${rolColor(r)};">${r}</div>
            <div style="font-size:12px;color:#9ca3af;">${descrip[r]||''}</div>
          </div>
        </label>
      `;
  }).join('')}
    </div>

    <!-- Camp RALC editar rols — visible només quan es marca alumne -->
    <div id="secRalcEdit" style="margin-top:12px;padding:12px;background:#e0f2fe;border:1.5px solid #7dd3fc;border-radius:10px;display:${rolsActuals.includes('alumne')?'block':'none'};">
      <label style="font-size:12px;font-weight:700;color:#0369a1;display:block;margin-bottom:6px;">
        🎓 RALC de l'alumne
      </label>
      <input id="inpRalcEdit" type="text" value="${esH(usuari.ralc||'')}" placeholder="Ex: 12345678A"
        style="width:100%;box-sizing:border-box;padding:9px 11px;border:1.5px solid #7dd3fc;border-radius:8px;font-size:13px;outline:none;background:#fff;">
    </div>

    <!-- Secció revisor: assignar nivells -->
    <div id="secRevisorNivells" style="margin-top:14px;padding:14px;background:#fef3c7;
         border:1.5px solid #fde68a;border-radius:10px;
         display:${rolsActuals.includes('revisor')?'block':'none'};">
      <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:10px;">
        🔍 Nivells que pot revisar
      </div>
      ${nivellsCentre.length === 0
        ? `<p style="font-size:12px;color:#9ca3af;">Cap nivell creat. Creen primer des de la pestanya Estructura.</p>`
        : `<div style="display:flex;flex-direction:column;gap:6px;">
            <label style="font-size:12px;display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="chkRevisorTot" ${revisorNivells.includes('_tot')?'checked':''}
                style="width:15px;height:15px;"> Tot el centre (tots els nivells)
            </label>
            <div id="selNivellsRevisor" style="padding-left:20px;display:flex;flex-direction:column;gap:4px;
                 ${revisorNivells.includes('_tot')?'opacity:0.4;pointer-events:none':''}">
              ${nivellsCentre.map(n=>`
                <label style="font-size:12px;display:flex;align-items:center;gap:8px;cursor:pointer;">
                  <input type="checkbox" class="chk-nivell-revisor" value="${n.id}"
                    ${revisorNivells.includes(n.id)?'checked':''}
                    style="width:15px;height:15px;">
                  ${esH(n.nom)} <span style="color:#9ca3af;">(${esH(n.curs||'')})</span>
                </label>
              `).join('')}
            </div>
          </div>`
      }
    </div>

    <!-- Secció tutor: assignar grups de tutoria -->
    <div id="secTutorGrups" style="margin-top:14px;padding:14px;background:#eff6ff;
         border:1.5px solid #bfdbfe;border-radius:10px;
         display:${rolsActuals.includes('tutor')?'block':'none'};">
      <div style="font-size:13px;font-weight:700;color:#1d4ed8;margin-bottom:10px;">
        🏫 Grups que pot observar (tutoria)
      </div>
      ${grupsTutoria.length === 0
        ? `<p style="font-size:12px;color:#9ca3af;">Cap grup de tutoria creat. Crea'n des de la pestanya Estructura.</p>`
        : `<div style="display:flex;flex-direction:column;gap:6px;">
            <label style="font-size:12px;display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="chkTutorTot" ${tutorGrups.includes('_tot')?'checked':''}
                style="width:15px;height:15px;accent-color:#2563eb;"> Tots els grups de tutoria
            </label>
            <div id="selGrupsTutor" style="padding-left:20px;display:flex;flex-direction:column;gap:4px;
                 ${tutorGrups.includes('_tot')?'opacity:0.4;pointer-events:none':''}">
              ${grupsTutoria.map(g=>`
                <label style="font-size:12px;display:flex;align-items:center;gap:8px;cursor:pointer;">
                  <input type="checkbox" class="chk-grup-tutor" value="${g.id}"
                    ${tutorGrups.includes(g.id)?'checked':''}
                    style="width:15px;height:15px;accent-color:#2563eb;">
                  🏫 ${esH(g.nivellNom||'')} — ${esH(g.nom)}
                  <span style="color:#9ca3af;">${esH(g.curs||'')}</span>
                </label>
              `).join('')}
            </div>
          </div>`
      }
    </div>
  `, async () => {
    const rols = [...document.querySelectorAll('.chk-rol-edit:checked')].map(c=>c.value);

    // Recollir nivells assignats al revisor
    let revisioNivells = [];
    if (rols.includes('revisor')) {
      if (document.getElementById('chkRevisorTot')?.checked) {
        revisioNivells = ['_tot'];
      } else {
        revisioNivells = [...document.querySelectorAll('.chk-nivell-revisor:checked')].map(c=>c.value);
      }
    }

    // Recollir grups assignats al tutor
    let tutoriaGrups = [];
    if (rols.includes('tutor')) {
      if (document.getElementById('chkTutorTot')?.checked) {
        tutoriaGrups = ['_tot'];
      } else {
        tutoriaGrups = [...document.querySelectorAll('.chk-grup-tutor:checked')].map(c=>c.value);
      }
    }

    const ralcEdit = document.getElementById('inpRalcEdit')?.value?.trim()?.toUpperCase() || '';

    // Preservar admin/superadmin originals si qui edita és secretaria
    const uRolsEditor = window._userRols || [];
    const potEditarAdmin = uRolsEditor.some(r => ['admin','superadmin'].includes(r));
    let rolsFinals = [...rols];
    if (!potEditarAdmin) {
      (usuari.rols || [])
        .filter(r => ['admin','superadmin'].includes(r))
        .forEach(r => { if (!rolsFinals.includes(r)) rolsFinals.push(r); });
    }

    await window.db.collection('professors').doc(usuari.id).update({
      rols: rolsFinals.length > 0 ? rolsFinals : [],
      isAdmin: rolsFinals.includes('admin') || rolsFinals.includes('superadmin'),
      revisio_nivells: revisioNivells,
      revisio_tot: revisioNivells.includes('_tot'),
      tutoria_grups: tutoriaGrups,
      ...(rolsFinals.includes('alumne') && ralcEdit ? { ralc: ralcEdit } : {}),
    });
    window.mostrarToast('✅ Rols actualitzats');
    // Actualitzar el badge de pendents
    setTimeout(() => comprovarUsuarisPendents(), 500);
    onGuardat?.();
    return true;
  }, 'Guardar rols');

  // Actualitzar bord checkbox visualment + mostrar secció revisor
  setTimeout(()=>{
    document.querySelectorAll('.chk-rol-edit').forEach(chk=>{
      chk.addEventListener('change', ()=>{
        const row = document.getElementById(`row-rol-${chk.value}`);
        if (row) row.style.borderColor = chk.checked ? rolColor(chk.value) : '#e5e7eb';
        // Mostrar/ocultar secció grups tutor
        if (chk.value === 'tutor') {
          const sec = document.getElementById('secTutorGrups');
          if (sec) sec.style.display = chk.checked ? 'block' : 'none';
        }
        // Mostrar/ocultar secció nivells revisor
        if (chk.value === 'revisor') {
          const sec = document.getElementById('secRevisorNivells');
          if (sec) sec.style.display = chk.checked ? 'block' : 'none';
        }
      });
    });
    // Tot el centre toggle
    document.getElementById('chkRevisorTot')?.addEventListener('change', (e)=>{
      const sel = document.getElementById('selNivellsRevisor');
      if (sel) { sel.style.opacity = e.target.checked ? '0.4' : '1';
                 sel.style.pointerEvents = e.target.checked ? 'none' : ''; }
    });
    document.getElementById('chkTutorTot')?.addEventListener('change', (e)=>{
      const sel = document.getElementById('selGrupsTutor');
      if (sel) { sel.style.opacity = e.target.checked ? '0.4' : '1';
                 sel.style.pointerEvents = e.target.checked ? 'none' : ''; }
    });
  }, 100);
}

/* ══════════════════════════════════════════════════════
   TAB BUTLLETINS i QUADRE DADES (simplificats)
══════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════
   TAB PERÍODES — Bloqueig de trimestres
   Secretaria pot bloquejar un trimestre perquè els
   professors no puguin modificar aquella avaluació
══════════════════════════════════════════════════════ */
async function renderPeriodes(body) {
  const PERIODES = [
    { codi: 'preav', nom: 'Pre-avaluació', ordre: 0 },
    { codi: 'T1',    nom: '1r Trimestre',  ordre: 1 },
    { codi: 'T2',    nom: '2n Trimestre',  ordre: 2 },
    { codi: 'T3',    nom: '3r Trimestre',  ordre: 3 },
    { codi: 'final', nom: 'Final de curs', ordre: 4 },
  ];

  let tancats = [];
  let nomsPersonalitzats = {};
  let ordre = PERIODES.map(p=>p.codi); // ordre arrossegable

  const llegirConfig = async () => {
    try {
      const doc = await window.db.collection('_sistema').doc('periodes_tancats').get();
      if (doc.exists) {
        tancats = doc.data()?.tancats || [];
        nomsPersonalitzats = doc.data()?.noms || {};
        if (doc.data()?.ordre?.length) ordre = doc.data().ordre;
      }
    } catch(e) {}
  };

  const guardarConfig = async () => {
    // Processar canvis de nom pendents
    if (window._tempNomPeriode) {
      const { codi, nom } = window._tempNomPeriode;
      nomsPersonalitzats[codi] = nom;
      delete window._tempNomPeriode;
    }
    // Processar eliminació de periode pendent
    if (window._tempEliminarPeriode) {
      const codi = window._tempEliminarPeriode;
      ordre = ordre.filter(c => c !== codi);
      tancats = tancats.filter(c => c !== codi);
      delete nomsPersonalitzats[codi];
      delete window._tempEliminarPeriode;
    }
    await window.db.collection('_sistema').doc('periodes_tancats').set(
      { tancats, noms: nomsPersonalitzats, ordre }, { merge: false }
    );
  };

  await llegirConfig();

  const periodes = () => ordre.map(codi => {
    const base = PERIODES.find(p=>p.codi===codi) || { codi, nom: codi, ordre: 99 };
    return { ...base, nomMostrat: nomsPersonalitzats[codi] || base.nom };
  });

  const render = () => {
    const ps = periodes();
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin:0;">📅 Períodes d'avaluació</h3>
        <button id="btnNouPeriode" style="padding:7px 16px;background:#7c3aed;color:#fff;border:none;
          border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">+ Crear nou</button>
      </div>
      <p style="font-size:12px;color:#6b7280;margin-bottom:16px;">
        Arrossega per canviar l'ordre. Tanca un període per bloquejar l'enviament d'avaluacions.
      </p>

      <div id="llista-periodes-ctrl" style="display:flex;flex-direction:column;gap:8px;max-width:600px;"></div>

      <div style="margin-top:24px;background:#fef3c7;border:1.5px solid #fde68a;border-radius:10px;
                  padding:12px 16px;font-size:12px;color:#92400e;max-width:600px;">
        <strong>⚠️</strong> Tancar un període impedeix als professors enviar noves avaluacions.
        Poden continuar veient els comentaris però no modificar-los.
      </div>
    `;

    const cont = document.getElementById('llista-periodes-ctrl');
    let ddFrom = null;

    ps.forEach((p, i) => {
      const tancat = tancats.includes(p.codi);
      const el = document.createElement('div');
      el.draggable = true;
      el.dataset.codi = p.codi;
      el.style.cssText = `display:flex;align-items:center;gap:10px;padding:12px 16px;
        border-radius:11px;border:2px solid ${tancat?'#fca5a5':'#e5e7eb'};
        background:${tancat?'#fef2f2':'#f9fafb'};transition:border-color 0.15s;cursor:default;`;

      el.innerHTML = `
        <!-- Drag handle -->
        <span class="drag-handle" style="color:#d1d5db;font-size:18px;cursor:grab;flex-shrink:0;user-select:none;"
          title="Arrossega per canviar l'ordre">⠿</span>

        <!-- Nom -->
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:14px;color:${tancat?'#dc2626':'#1e1b4b'};">
            ${tancat?'🔒 ':''}${esH(p.nomMostrat)}
          </div>
          <div style="font-size:11px;color:#9ca3af;">
            ${tancat ? 'Tancat — professors no poden enviar avaluacions' : 'Obert — professors poden enviar avaluacions'}
          </div>
        </div>

        <!-- Botons accions -->
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn-editar-periode" data-codi="${p.codi}"
            style="padding:6px 12px;background:#e0e7ff;color:#4338ca;border:none;
                   border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;">✏️ Editar</button>
          <button class="btn-toggle-periode" data-codi="${p.codi}" data-tancat="${tancat}"
            style="padding:6px 12px;border:none;border-radius:7px;font-size:12px;font-weight:600;
                   cursor:pointer;background:${tancat?'#d1fae5':'#fee2e2'};
                   color:${tancat?'#065f46':'#991b1b'};">
            ${tancat?'🔓 Obrir':'🔒 Tancar'}
          </button>
        </div>
      `;

      // Drag & drop per reordenar
      el.addEventListener('dragstart', e => {
        ddFrom = i; el.style.opacity='0.5';
        e.dataTransfer.effectAllowed='move';
      });
      el.addEventListener('dragend', () => { el.style.opacity='1'; });
      el.addEventListener('dragover', e => {
        e.preventDefault(); el.style.borderColor='#7c3aed';
      });
      el.addEventListener('dragleave', () => {
        el.style.borderColor = tancats.includes(p.codi) ? '#fca5a5' : '#e5e7eb';
      });
      el.addEventListener('drop', async e => {
        e.preventDefault();
        el.style.borderColor = tancats.includes(p.codi) ? '#fca5a5' : '#e5e7eb';
        if (ddFrom === null || ddFrom === i) return;
        const [item] = ordre.splice(ddFrom, 1);
        ordre.splice(i, 0, item);
        await guardarConfig();
        render();
      });

      // Botons
      el.querySelector('.btn-toggle-periode').addEventListener('click', async () => {
        const t = tancats.includes(p.codi);
        if (t) tancats = tancats.filter(c=>c!==p.codi);
        else tancats.push(p.codi);
        await guardarConfig();
        render();
        window.mostrarToast(t ? '✅ Període obert' : '🔒 Període tancat');
      });

      el.querySelector('.btn-editar-periode').addEventListener('click', () => {
        modalEditarPeriode(p, guardarConfig, render);
      });

      cont.appendChild(el);
    });

    // Botó crear nou
    document.getElementById('btnNouPeriode').addEventListener('click', () => {
      modalCrearPeriode(ordre, PERIODES, nomsPersonalitzats, guardarConfig, render);
    });
  };

  render();
}

function modalEditarPeriode(periode, guardarConfig, onOk) {
  crearModal(`✏️ Editar — ${esH(periode.nomMostrat)}`, `
    <div style="margin-bottom:14px;">
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Nom del període</label>
      <input id="inpNomPeriode" type="text" value="${esH(periode.nomMostrat)}"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
               border-radius:9px;font-size:14px;outline:none;font-family:inherit;">
    </div>
    <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:9px;padding:10px 14px;">
      <p style="font-size:12px;color:#dc2626;margin:0 0 8px;font-weight:600;">⚠️ Zona de perill</p>
      <button id="btnEliminarPeriode" style="padding:7px 14px;background:#dc2626;color:#fff;border:none;
        border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;">🗑️ Eliminar aquest període</button>
    </div>
  `, async () => {
    const nou = document.getElementById('inpNomPeriode').value.trim();
    if (!nou) { window.mostrarToast('⚠️ El nom no pot estar buit'); return false; }
    // Guardar nom personalitzat
    const base = { preav:'Pre-avaluació', T1:'1r Trimestre', T2:'2n Trimestre', T3:'3r Trimestre', final:'Final de curs' };
    if (nou !== base[periode.codi]) {
      // Accedir a nomsPersonalitzats via closure (guardarConfig té accés)
      window._tempNomPeriode = { codi: periode.codi, nom: nou };
    }
    await guardarConfig();
    window.mostrarToast('✅ Nom actualitzat');
    onOk();
    return true;
  }, 'Guardar');

  setTimeout(() => {
    document.getElementById('btnEliminarPeriode')?.addEventListener('click', async () => {
      if (!confirm(`Eliminar el període "${periode.nomMostrat}"?\nAquesta acció no es pot desfer.`)) return;
      // Eliminar de l'ordre
      window._tempEliminarPeriode = periode.codi;
      await guardarConfig();
      document.getElementById('_modalSec')?.remove();
      onOk();
      window.mostrarToast('🗑️ Període eliminat');
    });
    document.getElementById('inpNomPeriode')?.focus();
    document.getElementById('inpNomPeriode')?.select();
  }, 100);
}

function modalCrearPeriode(ordre, PERIODES, nomsPersonalitzats, guardarConfig, onOk) {
  const jaCreats = ordre;
  const disponibles = PERIODES.filter(p => !jaCreats.includes(p.codi));
  // Permetre crear períodes personalitzats fins i tot si els predefinits estan tots creats

  crearModal('+ Nou període', `
    ${disponibles.length > 0 ? `
    <div style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:8px;">PERÍODES PREDEFINITS</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;">
      ${disponibles.map(p => `
        <button class="btn-crear-periode" data-codi="${p.codi}" style="
          padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:9px;
          background:#fff;cursor:pointer;text-align:left;font-family:inherit;
          font-size:13px;font-weight:600;color:#1e1b4b;
          display:flex;align-items:center;justify-content:space-between;
          transition:border-color 0.15s,background 0.15s;">
          ${esH(nomsPersonalitzats[p.codi] || p.nom)}
          <span style="font-size:11px;color:#9ca3af;font-weight:400;">clic per crear</span>
        </button>`).join('')}
    </div>` : ''}
    <div style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:8px;">PERÍODE PERSONALITZAT</div>
    <div style="display:flex;gap:8px;">
      <input id="inpNomNouPeriode" type="text" placeholder="Ex: Avaluació intermèdia, Projecte..."
        style="flex:1;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:9px;
               font-size:13px;outline:none;font-family:inherit;">
      <button id="btnCrearPersonalitzat" style="padding:9px 16px;background:#7c3aed;color:#fff;
        border:none;border-radius:9px;font-weight:700;cursor:pointer;font-size:13px;white-space:nowrap;">
        + Crear
      </button>
    </div>
  `, async () => { return false; }, ''); // no ok button, uses individual buttons

  setTimeout(() => {
    document.querySelectorAll('.btn-crear-periode').forEach(btn => {
      btn.addEventListener('mouseenter', () => { btn.style.borderColor='#7c3aed'; btn.style.background='#f5f3ff'; });
      btn.addEventListener('mouseleave', () => { btn.style.borderColor='#e5e7eb'; btn.style.background='#fff'; });
      btn.addEventListener('click', async () => {
        ordre.push(btn.dataset.codi);
        await guardarConfig();
        document.getElementById('_modalSec')?.remove();
        onOk();
        window.mostrarToast(`✅ Període creat`);
      });
    });
    // Període personalitzat
    const inpCustom = document.getElementById('inpNouNouPeriode') || document.getElementById('inpNomNouPeriode');
    document.getElementById('btnCrearPersonalitzat')?.addEventListener('click', async () => {
      const nom = document.getElementById('inpNomNouPeriode')?.value?.trim();
      if (!nom) { window.mostrarToast('⚠️ Escriu un nom'); return; }
      const codi = `custom_${Date.now()}`;
      nomsPersonalitzats[codi] = nom;
      ordre.push(codi);
      await guardarConfig();
      document.getElementById('_modalSec')?.remove();
      onOk();
      window.mostrarToast(`✅ Període "${nom}" creat`);
    });
    document.getElementById('inpNomNouPeriode')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btnCrearPersonalitzat')?.click();
    });
    // Ocultar el botó Cancel·lar i canviar el títol del modal
    const cancelBtn = document.getElementById('_btnCancelModal');
    const okBtn = document.getElementById('_btnOkModal');
    if (cancelBtn) cancelBtn.textContent = 'Tancar';
    if (okBtn) okBtn.style.display = 'none';
  }, 100);
}


async function renderButlletins(body) {
  const [nivells, grups, cursActiu] = await Promise.all([
    carregarNivells(), carregarGrupsCentre(), carregarCursActiu()
  ]);

  body.innerHTML = `
    <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin-bottom:16px;">📄 Butlletins</h3>

    <!-- Filtres -->
    <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:12px;align-items:end;">
        <div>
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Curs</label>
          <select id="bCurs" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
            <option value="">— Tria curs —</option>
            ${[...new Set(grups.map(g=>g.curs).filter(Boolean))].sort().reverse()
              .map(c=>`<option value="${c}" ${c===cursActiu?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Període</label>
          <select id="bTrimestre" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
            <option value="">⏳ Carregant...</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Nivell</label>
          <select id="bNivell" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
            <option value="">— Tots —</option>
            ${nivells.map(n=>`<option value="${n.id}">${esH(n.nom)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Grup classe</label>
          <select id="bGrup" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
            <option value="">— Tria grup —</option>
          </select>
        </div>
        <button id="bCarregar" style="padding:8px 18px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap;">
          🔍 Carregar
        </button>
      </div>
    </div>

    <!-- Resum matèries disponibles -->
    <div id="bResumMateries" style="margin-bottom:16px;display:none;">
      <h4 style="font-size:13px;font-weight:700;color:#374151;margin-bottom:8px;">Matèries amb dades d'avaluació:</h4>
      <div id="bLlistaMateries" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
    </div>

    <!-- Llista alumnes + generar -->
    <div id="bLlistaAlumnes" style=""></div>
  `;

  // Quan canvia curs o nivell, actualitzar grups classe
  const actualitzarGrups = () => {
    const curs = document.getElementById('bCurs').value;
    const nivellId = document.getElementById('bNivell').value;
    const selGrup = document.getElementById('bGrup');
    const grGrup = grups.filter(g =>
      g.tipus === 'classe' &&
      (!curs || g.curs === curs) &&
      (!nivellId || g.nivellId === nivellId)
    );
    selGrup.innerHTML = '<option value="">— Tria grup —</option>' +
      grGrup.map(g=>`<option value="${g.id}" data-curs="${g.curs||''}">${esH(g.nom)} (${esH(g.nivellNom||'')})</option>`).join('');
  };

  // Carregar períodes reals de Firestore al desplegable
  (async () => {
    try {
      const doc = await window.db.collection('_sistema').doc('periodes_tancats').get();
      const BASE = [
        { codi:'preav', nom:'Pre-avaluació' },
        { codi:'T1',    nom:'1r Trimestre'  },
        { codi:'T2',    nom:'2n Trimestre'  },
        { codi:'T3',    nom:'3r Trimestre'  },
        { codi:'final', nom:'Final de curs' },
      ];
      let periodes = BASE;
      if (doc.exists) {
        const data = doc.data();
        const noms = data.noms || {};
        const ordre = data.ordre || BASE.map(p => p.codi);
        periodes = ordre.map(codi => {
          const base = BASE.find(p => p.codi === codi) || { codi, nom: codi };
          return { nom: noms[codi] || base.nom };
        });
      }
      const sel = document.getElementById('bTrimestre');
      if (sel) {
        sel.innerHTML = '<option value="">— Tots els períodes —</option>' +
          periodes.map(p => `<option value="${p.nom}">${p.nom}</option>`).join('');
        // Preseleccionar 1r Trimestre si existeix
        const opt1r = [...sel.options].find(o => o.value.includes('1r') || o.value.includes('T1'));
        if (opt1r) sel.value = opt1r.value;
      }
    } catch(e) { console.warn('butlletins: error carregant períodes', e); }
  })();

  document.getElementById('bCurs').addEventListener('change', actualitzarGrups);
  document.getElementById('bNivell').addEventListener('change', actualitzarGrups);
  document.getElementById('bCarregar').addEventListener('click', () => carregarDadesButlletins(grups));
  // Preseleccionar T1 per defecte
  document.getElementById('bTrimestre').value = '1r Trimestre';
}

async function carregarDadesButlletins(grups) {
  const grupId    = document.getElementById('bGrup')?.value;
  const curs      = document.getElementById('bCurs')?.value;
  const trimestre = document.getElementById('bTrimestre')?.value || '';
  // 'tots' o buit = sense filtre; qualsevol altre valor = filtra per periodeNom
  if (!grupId || !curs) {
    window.mostrarToast('⚠️ Tria el curs i el grup classe', 3000);
    return;
  }

  const resDiv = document.getElementById('bLlistaAlumnes');
  const matDiv = document.getElementById('bResumMateries');
  const matLlista = document.getElementById('bLlistaMateries');
  matDiv.style.display = 'none';

  // ── Progress banner dinàmic ──
  const progId = '_bProgres';
  document.getElementById(progId)?.remove();
  const progDiv = document.createElement('div');
  progDiv.id = progId;
  progDiv.style.cssText = 'background:#ede9fe;border:1.5px solid #c4b5fd;border-radius:10px;padding:12px 16px;margin-bottom:12px;font-size:13px;color:#4c1d95;';
  progDiv.innerHTML = '<span id="_bProgresText">⏳ Preparant cerca...</span><div style="margin-top:6px;background:#ddd6fe;border-radius:99px;height:6px;overflow:hidden;"><div id="_bProgresBar" style="background:#7c3aed;height:100%;width:0%;transition:width .3s;border-radius:99px;"></div></div>';
  resDiv.parentElement.insertBefore(progDiv, resDiv);
  resDiv.innerHTML = '';

  const setProgres = (txt, pct) => {
    const el = document.getElementById('_bProgresText');
    const bar = document.getElementById('_bProgresBar');
    if (el) el.textContent = txt;
    if (bar) bar.style.width = pct + '%';
  };

  try {
    const db = window.db;
    const grupDoc = grups.find(g=>g.id===grupId);
    let alumnesCentre = grupDoc?.alumnes || [];

    // ── Optimització: NOMÉS cercar les matèries del grup seleccionat ──
    // En lloc de recórrer TOTS els grups del curs, usem només els fills directes del grup
    const totsGrups = await carregarGrupsCentre();
    // Matèries/projectes/optatives fills del grup classe seleccionat
    const candidats = totsGrups.filter(g =>
      g.parentGrupId === grupId && g.tipus !== 'tutoria'
    );
    // Si no hi ha fills directes, fallback a tots els del curs (compatibilitat llegat)
    const candidatsEfectius = candidats.length > 0
      ? candidats
      : totsGrups.filter(g => !g.curs || g.curs === curs);

    setProgres(`⏳ Cercant dades de ${candidatsEfectius.length} matèria${candidatsEfectius.length!==1?'es':''}...`, 5);

    const materiesAmbDades = [];
    const alumnesAmbDades  = {};

    // 1r: Si el grup té alumnes a grups_centre, usar-los com a llista mestra
    alumnesCentre.forEach(a => {
      const key = a.ralc || `${a.cognoms}_${a.nom}`;
      alumnesAmbDades[key] = {
        nom: a.nom, cognoms: a.cognoms||'', ralc: a.ralc||'',
        nomComplet: a.cognoms ? `${a.cognoms}, ${a.nom}` : a.nom,
        materies: {}
      };
    });

    // Llegir cada candidat com a possible subcolecció
    for (let ci = 0; ci < candidatsEfectius.length; ci++) {
      const cand = candidatsEfectius[ci];
      const pct = Math.round(5 + ((ci + 1) / candidatsEfectius.length) * 85);
      setProgres(`⏳ Matèria ${ci+1}/${candidatsEfectius.length}: ${cand.nom || cand.id}`, pct);
      try {
        let snap = await db.collection('avaluacio_centre')
          .doc(curs)
          .collection(cand.id)
          .where('grupClasseId', '==', grupId)
          .get();
        if (snap.empty) {
          snap = await db.collection('avaluacio_centre')
            .doc(curs)
            .collection(cand.id)
            .where('grupId', '==', grupId)
            .get();
        }

        if (!snap.empty) {
          const nomMat = cand.nom || cand.id;
          // Comprovar si hi ha docs que passen el filtre de trimestre
          // IMPORTANT: push a materiesAmbDades NOMÉS si hi ha docs del trimestre seleccionat
          const docsTriestre = trimestre
            ? snap.docs.filter(doc => {
                const d = doc.data();
                return d.periodeNom && d.periodeNom === trimestre;
              })
            : snap.docs;

          if (docsTriestre.length > 0) {
            materiesAmbDades.push({ id: cand.id, nom: nomMat });

            docsTriestre.forEach(doc => {
              const d = doc.data();
              const key = d.ralc || `${d.cognoms}_${d.nom}`;
              if (!alumnesAmbDades[key]) {
                alumnesAmbDades[key] = {
                  nom: d.nom||'', cognoms: d.cognoms||'', ralc: d.ralc||'',
                  nomComplet: d.cognoms ? `${d.cognoms}, ${d.nom}` : (d.nom||'Desconegut'),
                  materies: {}
                };
              }
              alumnesAmbDades[key].materies[cand.id] = {
                nom: nomMat,
                periodeNom: d.periodeNom || '',
                items: d.items || [],
                descripcioComuna: d.descripcioComuna || '',
                comentariGlobal: d.comentariGlobal || '',
              };
            });
          }
        }
      } catch(e) { /* ignorem errors de subcoleccions que no existeixen */ }
    }

    setProgres('✅ Dades carregades!', 100);
    setTimeout(() => document.getElementById(progId)?.remove(), 1500);

    // Deduplicar matèries
    const matUniques = [...new Map(materiesAmbDades.map(m=>[m.id,m])).values()];

    // Mostrar resum matèries
    if (matUniques.length > 0) {
      matLlista.innerHTML = `
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">
          ${matUniques.length} matèrie${matUniques.length!==1?'s':''} amb dades enviades:
        </div>` +
        matUniques.map(m => `
          <span style="padding:4px 10px;background:#e0e7ff;color:#4338ca;border-radius:8px;
                       font-size:11px;font-weight:600;">${esH(m.nom)}</span>
        `).join('');
      matDiv.style.display = 'block';
    } else {
      matLlista.innerHTML = '<span style="font-size:12px;color:#dc2626;">⚠️ Cap matèria amb dades enviades per a aquest grup</span>';
      matDiv.style.display = 'block';
    }

    const alumnes = Object.values(alumnesAmbDades)
      .sort((a,b) => (a.cognoms||a.nom).localeCompare(b.cognoms||b.nom,'ca'));

    const ambDades = alumnes.filter(a => Object.keys(a.materies).length > 0);
    const senseDades = alumnes.filter(a => Object.keys(a.materies).length === 0);

    if (alumnes.length === 0) {
      resDiv.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:30px;">Cap alumne trobat per a aquest grup.</p>';
      return;
    }

    // Recompte de matèries: quines han enviat i quines no
    const materiesGrup = grups.filter(g =>
      g.parentGrupId === grupId && g.tipus !== 'tutoria'
    );
    const materiesAmbEnviament = matUniques.map(m=>m.nom);
    const materiesSenseEnviament = materiesGrup
      .filter(g => !materiesAmbEnviament.includes(g.nom))
      .map(g => g.nom);

    resDiv.innerHTML = `
      ${materiesGrup.length > 0 ? `
      <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:10px;
                  padding:12px 16px;margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;">
          📚 Estat d'enviament per matèria
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${materiesGrup.map(g => {
            const enviada = materiesAmbEnviament.includes(g.nom);
            return `<span style="padding:4px 10px;border-radius:7px;font-size:11px;font-weight:600;
              background:${enviada?'#f0fdf4':'#fef2f2'};
              color:${enviada?'#059669':'#dc2626'};
              border:1px solid ${enviada?'#bbf7d0':'#fca5a5'};">
              ${enviada?'✅':'⚠️'} ${esH(g.nom)}
            </span>`;
          }).join('')}
        </div>
        ${materiesSenseEnviament.length > 0 ? `
        <div style="font-size:11px;color:#dc2626;margin-top:8px;">
          ⚠️ Matèries sense enviament: ${materiesSenseEnviament.map(n=>esH(n)).join(', ')}
        </div>` : '<div style="font-size:11px;color:#059669;margin-top:6px;">✅ Totes les matèries han enviat avaluació</div>'}
      </div>` : ''}

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:13px;color:#6b7280;">
          <strong style="color:#1e1b4b;">${alumnes.length}</strong> alumnes ·
          <strong style="color:#059669;">${ambDades.length}</strong> amb dades ·
          <strong style="color:#dc2626;">${senseDades.length}</strong> sense dades
        </div>
        <div style="display:flex;gap:8px;">
          ${alumnesCentre.length === 0 && ambDades.length > 0 ? `
            <button id="bReconstruir" style="padding:7px 14px;background:#f59e0b;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:12px;"
              title="Recupera la llista d'alumnes al grup classe des de les dades d'avaluació">
              🔄 Recuperar alumnes al grup
            </button>
          ` : ''}
          <button id="bGenTots" style="padding:7px 14px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:12px;">
            📄 Generar tots (${ambDades.length})
          </button>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 10px;text-align:left;">Alumne/a</th>
            <th style="padding:8px 10px;text-align:center;">Matèries</th>
            <th style="padding:8px 10px;text-align:center;">Ítems</th>
            <th style="padding:8px 10px;text-align:center;">Accions</th>
          </tr>
        </thead>
        <tbody>
          ${alumnes.map((a, idx) => {
            const nMat = Object.keys(a.materies).length;
            const nItems = Object.values(a.materies).reduce((s,m)=>s+(m.items?.length||0),0);
            return `
              <tr style="border-bottom:1px solid #f3f4f6;" data-idx="${idx}">
                <td style="padding:7px 10px;font-weight:600;color:#1e1b4b;">${esH(a.nomComplet)}</td>
                <td style="padding:7px 10px;text-align:center;">
                  ${nMat > 0
                    ? `<span style="color:#059669;font-weight:700;">${nMat}</span>`
                    : '<span style="color:#dc2626;">0</span>'}
                </td>
                <td style="padding:7px 10px;text-align:center;color:#6b7280;">${nItems||'—'}</td>
                <td style="padding:7px 10px;text-align:center;">
                  ${nMat > 0
                    ? `<button class="btn-gen-butlleti" data-idx="${idx}" style="padding:4px 10px;background:#4f46e5;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">
                        📄 Butlletí
                      </button>`
                    : '<span style="color:#9ca3af;font-size:11px;">sense dades</span>'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    // Events
    document.getElementById('bReconstruir')?.addEventListener('click', async () => {
      const btn = document.getElementById('bReconstruir');
      btn.disabled = true; btn.textContent = '⏳ Recuperant...';
      // Reconstruir la llista d'alumnes al grup classe des d'avaluacio_centre
      const alumnesRecup = ambDades.map(a => ({
        nom: a.nom, cognoms: a.cognoms, ralc: a.ralc
      }));
      try {
        await window.db.collection('grups_centre').doc(grupId).update({ alumnes: alumnesRecup, alumnesUpdatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        window.mostrarToast(`✅ ${alumnesRecup.length} alumnes recuperats al grup classe`, 3000);
        btn.textContent = '✅ Recuperat!';
        setTimeout(() => document.getElementById('bCarregar')?.click(), 1000);
      } catch(e) {
        window.mostrarToast('❌ Error: ' + e.message);
        btn.disabled = false; btn.textContent = '🔄 Recuperar alumnes al grup';
      }
    });

    document.getElementById('bGenTots')?.addEventListener('click', async () => {
      const _infoButlleti = await _carregarInfoButlleti(trimestre);
      ambDades.forEach(a => generarButlleti(a, curs, grupDoc?.nom||'', trimestre, grupId, grupDoc?.nivellNom||'', _infoButlleti));
    });

    // Guardar alumnes en window per accés des dels botons (evita JSON en atributs HTML)
    window._butlletinsAlumnes = alumnes;

    document.querySelectorAll('.btn-gen-butlleti').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.idx);
        const alumne = window._butlletinsAlumnes?.[idx];
        if (alumne) generarButlleti(alumne, curs, grupDoc?.nom||'', trimestre, grupId, grupDoc?.nivellNom||'', await _carregarInfoButlleti(trimestre));
      });
    });

  } catch(e) {
    console.error('carregarDadesButlletins:', e);
    resDiv.innerHTML = `<div style="color:#ef4444;padding:16px;">Error: ${e.message}</div>`;
  }
}

// Carrega el text informatiu del butlletí per a un periode concret
async function _carregarInfoButlleti(periode) {
  if (!periode) return '';
  try {
    const doc = await window.db.collection('_sistema').doc('info_butlletins').get();
    return doc.exists ? (doc.data()?.[periode] || '') : '';
  } catch(e) { return ''; }
}

async function generarButlleti(alumne, curs, grupNom, trimestre, grupId, nivellNom = '', infoButlleti = '') {
  // Normalitzar assoliment independent de majúscules/accents
  const _normAss = s => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
  const colorAss = s => {
    const n = _normAss(s).replace(/[·•·]/g,''); // eliminar punt mig
    if (n.includes('excellent') || n.includes('excelllent') || n.includes('excel')) return '#059669';
    if (n.includes('notable'))      return '#2563eb';
    if (n.includes('satisfactori')) return '#d97706';
    if (n.includes('no ass'))       return '#dc2626';
    return '#9ca3af';
  };
  const shortAss = s => {
    const n = _normAss(s).replace(/[·•·]/g,'');
    if (n.includes('excellent') || n.includes('excelllent') || n.includes('excel')) return 'AE';
    if (n.includes('notable'))      return 'AN';
    if (n.includes('satisfactori')) return 'AS';
    if (n.includes('no ass'))       return 'NA';
    return '--';
  };
  // Compatibilitat: COLORS_ASSL i SHORT com a funcions
  const COLORS_ASSL = { };
  const SHORT = { };

  const nomComplet = alumne.cognoms ? `${alumne.cognoms}, ${alumne.nom}` : alumne.nom;
  const materies = Object.values(alumne.materies);

  // ── Llegir firmes (tutor + director) ──
  let tutorNomComplet = '';
  let directorNomComplet = '';
  let firmaBase64 = '';
  let segellBase64 = '';

  try {
    if (typeof window.carregarFirmesConfig === 'function') {
      const cfg = await window.carregarFirmesConfig();
      const tutorData = grupId ? (cfg.tutors || {})[grupId] : null;
      if (tutorData) {
        tutorNomComplet = [tutorData.nom, tutorData.cognom1, tutorData.cognom2]
          .filter(Boolean).join(' ');
      }
      const dir = cfg.director || {};
      directorNomComplet = [dir.nom, dir.cognom1, dir.cognom2].filter(Boolean).join(' ');
      firmaBase64  = dir.firmaBase64  || '';
      segellBase64 = dir.segellBase64 || '';
    }
  } catch(e) { /* firmes.js potser no carregat, deixem els camps buits */ }

  const html = `<!DOCTYPE html>
<html lang="ca">
<head>
  <meta charset="UTF-8">
  <title>Butlletí — ${nomComplet}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; padding: 15mm; }
    .cap { display: flex; justify-content: space-between; align-items: center;
           border-bottom: 2px solid #1e1b4b; padding-bottom: 10px; margin-bottom: 12px; }
    .cap-esquerra { display: flex; align-items: center; gap: 10px; min-width: 160px; }
    .cap-titol { text-align: center; font-size: 12pt; font-weight: bold; color: #1e1b4b; flex: 1; padding: 0 16px; }
    .cap-titol .sub { font-size: 10pt; font-weight: normal; color: #555; margin-top: 4px; }
    .cap-logo { min-width: 60px; text-align: right; }
    .dades { background: #f3f4f6; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 9.5pt; }
    .dades span { margin-right: 16px; }
    .materia { margin-bottom: 10px; }
    .mat-head { background: #1e1b4b; color: #fff; padding: 6px 10px; border-radius: 4px 4px 0 0; font-weight: bold; font-size: 10pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .mat-desc { background: #f9fafb; padding: 6px 10px; font-size: 9pt; color: #444; border: 1px solid #e5e7eb; border-top: none; font-style: italic; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; }
    th { background: #f3f4f6; padding: 5px 8px; text-align: left; font-size: 9pt; border-bottom: 1px solid #e5e7eb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    td { padding: 5px 8px; font-size: 9pt; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 8.5pt; font-weight: bold; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .peu { margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 9.5pt; gap: 12px; }
    .firma-box { display: flex; flex-direction: column; align-items: center; min-width: 140px; }
    .firma-img-area { height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px; }
    .firma-linia { border-top: 1px solid #999; width: 140px; padding-top: 4px; text-align: center; font-size: 8.5pt; color: #555; }
    .firma-nom { font-size: 8.5pt; color: #333; font-weight: 600; text-align: center; margin-top: 2px; }
    @media print {
      @page { margin: 12mm 15mm; size: A4; }
      html, body { padding: 0 !important; margin: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .mat-head { background: #1e1b4b !important; color: #fff !important; }
      .badge { color: #fff !important; }
      .dades { background: #f3f4f6 !important; }
      .th-bg { background: #f3f4f6 !important; }
      .materia { page-break-inside: avoid; break-inside: avoid; }
      .info-butlleti-bloc { page-break-after: always; break-after: page; }
    }
  </style>
</head>
<body>
  <div class="cap">
    <div class="cap-esquerra">
      <img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAnACQDASIAAhEBAxEB/8QAGQABAQEBAQEAAAAAAAAAAAAABgAHBQMC/8QAMhAAAQIFAwIDBwMFAAAAAAAAAQIDAAQFBhEHEiEiMRNBURU3OHR1sbIIFDIzQlNigf/EABoBAAEFAQAAAAAAAAAAAAAAAAUBAgMEBgf/xAAuEQABAwIEBAILAAAAAAAAAAABAgMRACEEBRIxQVFhoTKBBhMUIkJikaKxwdH/2gAMAwEAAhEDEQA/ANpvmpTbd81px64ahIUOmhgzgTNutISVNBSgjYQc4DfAI5WAMFRKgdYu+7a9pdXbsodbqVJpVOmESrKP3SlPu5WgZU4SVDhzyI8sqXCrVymmpXfWaYFFLH7NdTf43BSky4Q2CPL+ks59Qg84jP7V+Ee6vqyPzl4EuqVrUOiq6Bl7LXqGXIBOpsQRaDv5mN+Vel/1K5qFYdjVyQvK5RN1dpS5krqjykkjZjgqI/uMMavctUo95osm7a7PImZhlLshUmJ11hKlryEpcDagO6cZ2geqfOBWsHuj0t+XX9moR6v0put/qPoVKdSFpmKTs2k4CjtfwCcHjMMlSSY+XuKs6GnEIDgGzxmBI0qtfoOG1a5pC7VlUiqy9YnZicmJapKbQ484VnwyyytGCeey8nPmTFHjohMLfs95EwrdNS885LzCijapSkJSEqV6qUjYon/aKCrPgFYPMRGKWOtHLi6L/v8ADpwXLdSWs+afCV2/6FRlNrfCPdX1ZH5y8PNYp92RuWuVlpIU3KsKp0yVchCHJZCkKwOR1OqTk/5M9gYB2r8I91fVkfnLwMdPvqHRVbbAIIwzS+a2e1v4fOrWD3R6W/Lr+zUN70+LK0/p6fxfgRrB7o9Lfl1/ZqO9rVVfYn6h6HUxu3M0obdn8txDyRtGDk5IwPM8Q0mCSeaPxUyGy4hCE7kYgfdWv6SKQtq5FIIKfbHBHyktFHzopKqkrReln9gmxOLcmkpB6XXEocKTnvgLAB7EAGKCrPgFYPMY9pUBwt9BXGuy3bjcvqpVKRoYnKVOJaRMNB1nMyENbD0rUO4cUnukkJPbgqE13S685OxKxblqyANMqbqZhUjNTTYdZWFpOEq3FKuEDuRjPdeMxRRErCoVMk3/AHVxjPMQwEhKRaN5vp2m+4rm3nYWpNw2daFAatBUu5Q21NuOuVCWKV52c8OE46fSF7tjXMu5Td9apCqxXUteDKJYeZ8GVwOlY8RacnknO3gj+B7xRQgwiAZk8O1Sr9IcQpIQEJAGrafiMkTMwTTvSqk1qk0io+3mQ1NzdQVMABxK+jwm0pHTwMBG3HokHziiiiwlISIFB33i+4XFCCeVf//Z" alt="Generalitat de Catalunya" style="height:50px;width:auto;display:block;">
      <div style="font-size:8.5pt;color:#333;line-height:1.4;">
        <div>Generalitat de Catalunya</div>
        <div>Departament d'Educació</div>
        <div><strong>INS Matadepera</strong></div>
      </div>
    </div>
    <div class="cap-titol">
      Butlletí d'avaluació
      <div class="sub">${esH(curs)} · ${esH(grupNom)}${trimestre ? ' · ' + esH(trimestre) : ''}</div>
    </div>
    <div class="cap-logo">
      <img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABHAHEDASIAAhEBAxEB/8QAHAABAAIDAQEBAAAAAAAAAAAAAAUGAwQHAgEI/8QAPRAAAQMDAgMFBQUECwAAAAAAAQIDBAAFEQYhEhMxFEFRcYEHIjJhkSMzQlKCFRYkkhdDVGJjcoOTobPR/8QAGwEBAAMBAQEBAAAAAAAAAAAAAAIDBAEFBgf/xAAtEQACAgECBAQEBwAAAAAAAAAAAQIDEQQhEjFRYRMyQXEFsdHwFCJSgZHB4f/aAAwDAQACEQMRAD8A/ZdKUoBSlY332WGy4+820gdVLUEgepoDJSqvM9oOjozoZTfY0t4nhDcIKkrJ8MNBRr01quRLCjbtK398A4Cn44jA+XNUk/8AFS4JdCHiR6lmqHlaq0xFnmBJ1FaWZYUEllyY2lYPhgnOajJtvv8AqVxMW6tiz2gbvMx5RU/JPclS0gcCPEAknxFSDOkdLswDBb0/bExykpKOzJOQeuTjPrXcRXMZk+RNggjIOQaVQG5U32ePdmuS35mlFrAjyyCty3Z24He8tZ6L7uh7jV8ZdbfZQ8y4hxtaQpC0nIUD0INclHHsdjLO3qe6UpUSQpSlAKUpQCscp9mLGckyHUNMtJK1rWcBIHUk1kqCvkdy8XSPajgQGSJE3/EIP2bXkSOI/JIH4q6lk43hEfJ13bngY1jg3O53JYHJjGA+wk56KUtxASlHfnPlmvdp0k1IUq46rTHu90eVxq40cTEcdzbSFbADPU7nv7sWqlS4seUjwZ825hiRYsRrlRYzMdv8rSAkfQVmpWheL1abO0HLncY0RJ6BxwAq8h1PpUOZLZG/SqDcvaNzXCzp+zyJY/tUv7Bn0BHGr+UD51Wr1dNQXRparre3WIqUlSo8DMdJH95YPGf5gPlWe3V01bSlv23LYU2T8q/o6+sMSW3WVct5ByhxBwobjcEeR6VR3rBfdISXZujQmdalniesb7mAg95jrPwE/kPu+GNsc7npdtdgsFohyZUF99Lt3lKjvqbWFOnDQKgc7JyP01IWvW2sLcEoNzZuTScAJmsjjx4caMfUgmt8YNLY8i74hTCzgns16o6hpTV9m1GlbcV1yPOaOH4MpHKkMq7wpB39RkVYK4td9U6d1Hy06r01NhSm/ubpbHONbB8QpPC4PLhUKs2kLxeVx1N2jUEHV7DAHE28OzTUJ3xk44VHb8QTnB3rkq/Vff7mmrVQs5PPt9DodKhocy+drYcuECNGivko5aHSt1pWMpKj8ODgggZwSNzvUzVTWDSnkUpSuHRXlDaEFRSkArPEo+Jr1SgME+ZEt8RcudJZjR2xlbrqwlKfMmqhc/aNbEoUmyQZd3d/CpCeUz6uK7v8oVWx7XQDo1QIz/GRv+1NUqsOt1j0+FFZbNGn0/jN5eEjZnag1Xc0kP3Jq2Nq6tQE+8B4cxW/qAmouLbYcd5UhLRckL+OQ8ouOr81qyT9a26j5l7tEN7kSLjGQ93NBwFw+SRufpXjT1Go1D4ct9l/h6Maaad+XdkhWncmHZ64lnj/AHtykojE/lbJy6r0bCz9Kwz7smEzzpMKXGaPwuTEiIhXkXinPpSx3eOuPd9S9pjNotkNUaMULLv8TIwhB91OD4e6T1NatFoLnbGU44S6mfVa2pVyUZbkbd5gueo7pc0/cuP8iMnuSw0OBAHnhSv1VhqJjPTWY7bKEMkISE5Lb2+P0CsnOuZ6GOP9Bw/+V9Xwn53bCdk3Jtb90SVdH9hsAC1XG9lO82RymleLbWU/Ti465LxXJxaGTKbaLq0tJUmApWFKISP6wd5FfpHTtsYstig2mMPsojCGknG5wMEn5k7+tVW/ljjqen8J0zVjsfob5AIwRmlKVmPoBSlKAVFXXUdltTEx+fPQy3CKBIJSo8BX8I2G5PgMmpWuTais+o7pFUEW6ShyfcZUx043bSkdnjpP6Fcz9NThFSe5XZNxWyLJrmfadQW6Lp+FfIbE+4BmXELiFLQtAPMB2wNwkkAkE4OOlVWyWO13qKmQNcSZQdkmM2iLE7I2XAkqKPfStZwAckKHSpuLFukPW1xlwbHMagQLYWg24lKm5TraQI5Z7weEupODjcZr1aLPdrUbPzYb0kWSyuyF8Iz2me78QHidnP8AcFJU1Sw5JP3wRVti5PH8/fUosyw224Wx65RNYWiPBQ6tCnnrbIeOUIK1A89xQOEgk4SOlbNo0dIXeHLDE1pCcntth51hFukMjhIyCoIcSj0qZuumry/+6Wnn7dIfiJjcdxkJALfNccQp4LOdvdDgHjzKveloT7dzvt1lsKaemzOBsKG/IaSEI9CeNX6qtlwqGFyK4Rbllo5U5pyDadRt2ZeptMMXdxxCUt/sl0uFa/hBVzOpyOp7x4ity4WW1mwXC2DV0BM23zzcbu6YTim8hPLQAkKzhGANlHBG9Z7bYL/L9or17m2qQ2w089LQXEZStwBQR8+gYA+aDX3T9g1V+7V2RcYKkTri9HtyeBBTwR3F82Q6ck97zoz4oFRhTXXLijzOTlKyLhJbbkQjTaVu2xka2tAcuozCSq2PJLv1c2zjbOM91fY+mkPtXJ1rXFkKLYSJijb3QGsEg9XNxkEZGdxVkmWrUcn2jSrs9bibZbG1dgQhs5cLTJDYG++Vvrx82xUM1pu/OaWjcyBeYaZVyityW4yUdoTGabKispVn4nypWPmCfCrk+/yMf4Kn9Hz+p907YrZE1Fp6ddNWwH2H3ufEjogOsqkKGUpyVKPCAsg7gZIGK6evVmnkG5A3Nsi17TFJQopaOcYyBgnO2Bk5quzdMTrnrCdd5Uuf2eA2wmDH4WwH1obKwoqKc7LVnrjiTvsBVXfsGof6LLdbIY1CLg7MVKmhxLaVpcCFuqA2Puqe4cZ3JPhVbUZ4yzVVDwE4wjhHSF6v00hq1um7x+C6nEIjJ5u4HhtuQMnGCQOtTtcpjaVvLes7NF7G2LPb2Y8YOBCvhbTzVniJ/E7yx4nh+Rrq1VTjFYwaa5SlnKFKUqBYKUpQClKUApSlAKUpQClKUApSlAKUpQClKUB//9k=" alt="Institut Matadepera" style="height:50px;width:auto;display:block;margin-left:auto;">
    </div>
  </div>

  <div class="dades">
    <span><strong>Alumne/a:</strong> ${esH(nomComplet)}</span>
    ${alumne.ralc ? `<span><strong>RALC:</strong> ${esH(alumne.ralc)}</span>` : ''}
    ${nivellNom ? `<span><strong>Nivell:</strong> ${esH(nivellNom)}</span>` : ''}
    <span><strong>Grup:</strong> ${esH(grupNom)}</span>
    <span><strong>Curs:</strong> ${esH(curs)}</span>
  </div>

  ${infoButlleti ? `
  <div class="info-butlleti-bloc" style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
    <div style="font-size:10.5pt;font-weight:bold;color:#166534;margin-bottom:6px;">Resultats de l'avaluació</div>
    <div style="font-size:10pt;color:#1e293b;white-space:pre-wrap;line-height:1.6;">${esH(infoButlleti)}</div>
  </div>` : ''}

  ${materies.map(mat => `
    <div class="materia">
      <div class="mat-head">${esH(mat.nom)}</div>
      ${mat.descripcioComuna
        ? `<div class="mat-desc" style="font-style:italic;">${esH(mat.descripcioComuna)}</div>`
        : ''}
      ${(mat.items||[]).length > 0 ? `
      <table>
        <thead>
          <tr>
            <th style="width:30%">Aprenentatge / Competència</th>
            <th>Comentari</th>
            <th style="width:120px;text-align:center;">Assoliment</th>
          </tr>
        </thead>
        <tbody>
          ${(mat.items||[]).map(it => `
            <tr>
              <td><strong>${esH(it.titol||'')}</strong></td>
              <td>${esH(it.comentari||'')}</td>
              <td style="text-align:center;">
                <span class="badge" style="background:${colorAss(it.assoliment)}">
                  ${shortAss(it.assoliment)}
                </span><br>
                <span style="font-size:8pt;color:#666;">${esH(it.assoliment||'No avaluat')}</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>` : ''}
    </div>
  `).join('')}

  <div class="peu">
    <!-- Tutor/a -->
    <div class="firma-box">
      <div class="firma-img-area"></div>
      <div class="firma-linia">Tutor/a</div>
      ${tutorNomComplet ? `<div class="firma-nom">${esH(tutorNomComplet)}</div>` : ''}
    </div>

    <!-- Director/a (amb firma i segell si disponibles) -->
    <div class="firma-box">
      <div class="firma-img-area" style="gap:8px;">
        ${firmaBase64  ? `<img src="${firmaBase64}"  style="max-height:55px;max-width:90px;object-fit:contain;">` : ''}
        ${segellBase64 ? `<img src="${segellBase64}" style="max-height:55px;max-width:90px;object-fit:contain;">` : ''}
      </div>
      <div class="firma-linia">Director/a</div>
      ${directorNomComplet ? `<div class="firma-nom">${esH(directorNomComplet)}</div>` : ''}
    </div>

    <!-- Família -->
    <div class="firma-box">
      <div class="firma-img-area"></div>
      <div class="firma-linia">Signatura família</div>
    </div>
  </div>
</body>
</html>`;

  // Generar PDF directament amb html2pdf (sense capçalera/peu del navegador)
  const nomFitxer = `Butlleti_${(alumne.cognoms||'').replace(/\s+/g,'_')}_${(alumne.nom||'').replace(/\s+/g,'_')}_${trimestre||'notas'}.pdf`;

  // Crear iframe ocult per renderitzar l'HTML
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
  document.body.appendChild(iframe);

  iframe.onload = async () => {
    try {
      // Esperar que els recursos (imatges base64) carreguin
      await new Promise(r => setTimeout(r, 300));

      // Comprovar si html2pdf està disponible, si no, carregar-lo
      if (typeof html2pdf === 'undefined') {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      const element = iframe.contentDocument.body;
      const opt = {
        margin:       [12, 15, 12, 15], // top, right, bottom, left en mm
        filename:     nomFitxer,
        image:        { type: 'jpeg', quality: 0.95 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().set(opt).from(element).save();
    } catch(e) {
      console.error('html2pdf error:', e);
      // Fallback: obrir finestra i imprimir
      const win = window.open('', '_blank');
      if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
    } finally {
      document.body.removeChild(iframe);
    }
  };

  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
}

async function renderQuadreDades(body) {
  const [nivells, grups, cursActiu] = await Promise.all([
    carregarNivells(), carregarGrupsCentre(), carregarCursActiu()
  ]);
  const cursos = [...new Set(grups.map(g=>g.curs).filter(Boolean))].sort().reverse();

  body.innerHTML = `
    <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin-bottom:16px;">📊 Quadre de dades</h3>
    <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:12px;align-items:end;">
        <div>
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Curs</label>
          <select id="qdCurs" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
            <option value="">— Tots —</option>
            ${cursos.map(c=>`<option value="${c}" ${c===cursActiu?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Nivell</label>
          <select id="qdNivell" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
            <option value="">— Tots —</option>
            ${nivells.map(n=>`<option value="${n.id}">${esH(n.nom)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Grup classe</label>
          <select id="qdGrup" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
            <option value="">— Tots —</option>
          </select>
        </div>
        <button id="qdCarregar" style="padding:8px 18px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap;">
          🔍 Carregar
        </button>
      </div>
    </div>
    <div id="resultatsQD"></div>
  `;

  // Cascada: el desplegable de grup mostra NOMÉS grups classe (tipus='classe')
  const actualitzarGrups = () => {
    const curs     = document.getElementById('qdCurs').value;
    const nivellId = document.getElementById('qdNivell').value;
    const selGrup  = document.getElementById('qdGrup');
    const grupsFilt = grups.filter(g =>
      g.tipus === 'classe' &&
      (!curs     || g.curs     === curs) &&
      (!nivellId || g.nivellId === nivellId)
    ).sort((a,b) => (a.ordre||99) - (b.ordre||99));
    selGrup.innerHTML = '<option value="">— Tots —</option>' +
      grupsFilt.map(g => `<option value="${g.id}">${esH(g.nom)} (${esH(g.nivellNom||'')})</option>`).join('');
  };

  document.getElementById('qdCurs').addEventListener('change', actualitzarGrups);
  document.getElementById('qdNivell').addEventListener('change', actualitzarGrups);
  actualitzarGrups();

  document.getElementById('qdCarregar').addEventListener('click', async () => {
    const curs     = document.getElementById('qdCurs').value;
    const nivellId = document.getElementById('qdNivell').value;
    const grupId   = document.getElementById('qdGrup').value;
    const res = document.getElementById('resultatsQD');
    res.innerHTML = `<p style="color:#9ca3af;">⏳ Carregant...</p>`;

    // Carregar classes creades per professors (per columna "Classe creada per")
    const classesSnap = await window.db.collection('classes').get();
    const classePerGrup = {};
    classesSnap.docs.forEach(doc => {
      const d = doc.data();
      if (d.grupCentreId) {
        const email = d.ownerEmail || '';
        const nom = email ? email.split('@')[0] : (d.ownerUid ? '(usuari)' : '—');
        classePerGrup[d.grupCentreId] = nom;
      }
    });

    // Grups classe filtrats (tipus='classe')
    const grupesClasse = grups.filter(g =>
      g.tipus === 'classe' &&
      (!curs     || g.curs     === curs) &&
      (!nivellId || g.nivellId === nivellId) &&
      (!grupId   || g.id       === grupId)
    ).sort((a,b) => (a.ordre||99) - (b.ordre||99));

    if (grupesClasse.length === 0) {
      res.innerHTML = `<p style="color:#9ca3af;text-align:center;padding:30px;">Cap grup trobat per a aquest filtre.</p>`;
      return;
    }

    // Per cada grup classe, agafar les seves matèries (parentGrupId === grup.id)
    res.innerHTML = grupesClasse.map(gc => {
      const materies = grups.filter(g =>
        g.parentGrupId === gc.id &&
        g.tipus !== 'classe'
      ).sort((a,b) => (a.ordre||99) - (b.ordre||99));

      const filesMateries = materies.map(m => `
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:7px 10px;font-size:11px;color:#9ca3af;">
            ${TIPUS_GRUP[m.tipus]?.icon||'📁'} ${TIPUS_GRUP[m.tipus]?.label||m.tipus||'—'}
          </td>
          <td style="padding:7px 10px;color:#374151;">${esH(m.nom||'—')}</td>
          <td style="padding:7px 10px;text-align:center;color:#6b7280;">${(m.alumnes||[]).length}</td>
          <td style="padding:7px 10px;text-align:center;color:#6b7280;font-size:11px;">
            ${classePerGrup[m.id] ? `<span style="background:#e0e7ff;color:#4338ca;padding:2px 8px;border-radius:99px;font-weight:600;">${esH(classePerGrup[m.id])}</span>` : '<span style="color:#d1d5db;">—</span>'}
          </td>
          <td style="padding:7px 10px;text-align:center;">
            <button class="btn-del-qd" data-id="${m.id}" data-nom="${esH(m.nom)}"
              style="padding:3px 10px;background:#fee2e2;color:#dc2626;border:none;
                     border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">
              🗑️ Eliminar
            </button>
          </td>
        </tr>
      `).join('');

      return `
        <div style="margin-bottom:24px;">
          <!-- Capçalera grup classe -->
          <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
                      background:#e0e7ff;border-radius:8px;margin-bottom:10px;">
            <span style="font-size:14px;">🏫</span>
            <span style="font-size:13px;font-weight:700;color:#1e1b4b;">${esH(gc.nom)} — ${esH(gc.nivellNom||'')}</span>
            <span style="font-size:11px;color:#6366f1;margin-left:auto;">${materies.length} matèrie${materies.length!==1?'s':''}</span>
          </div>
          ${materies.length > 0 ? `
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:7px 10px;text-align:left;font-weight:600;">Tipus</th>
                  <th style="padding:7px 10px;text-align:left;font-weight:600;">Nom</th>
                  <th style="padding:7px 10px;text-align:center;font-weight:600;">Alumnes</th>
                  <th style="padding:7px 10px;text-align:center;font-weight:600;">Classe creada per</th>
                  <th style="padding:7px 10px;text-align:center;font-weight:600;">Accions</th>
                </tr>
              </thead>
              <tbody>${filesMateries}</tbody>
            </table>
          </div>` : `<p style="color:#9ca3af;font-size:12px;padding:8px 14px;">Cap matèria afegida a aquest grup.</p>`}
        </div>
      `;
    }).join('');

    // Events eliminar
    res.querySelectorAll('.btn-del-qd').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Eliminar "${btn.dataset.nom}" i totes les dades associades?`)) return;
        btn.disabled = true; btn.textContent = '⏳';
        await eliminarGrupComplet(btn.dataset.id, btn.dataset.nom);
        document.getElementById('qdCarregar')?.click();
      });
    });
  });

  // Auto-carregar
  if (cursos.length > 0) {
    setTimeout(() => document.getElementById('qdCarregar')?.click(), 100);
  }
}

/* ══════════════════════════════════════════════════════
   HELPER: MODAL GENÈRIC
══════════════════════════════════════════════════════ */
function crearModal(titol, contingut, onOk, labelOk = 'Guardar') {
  document.getElementById('_modalSec')?.remove();
  const modal = document.createElement('div');
  modal.id = '_modalSec';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:18px;padding:28px;width:100%;max-width:520px;
                max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="font-size:16px;font-weight:800;color:#1e1b4b;margin:0;">${titol}</h3>
        <button id="_btnTancarModal" style="background:none;border:none;font-size:22px;
          cursor:pointer;color:#9ca3af;line-height:1;">✕</button>
      </div>
      ${contingut}
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
        <button id="_btnCancelModal" style="padding:10px 20px;background:#f3f4f6;border:none;
          border-radius:10px;font-weight:600;cursor:pointer;font-size:14px;">Cancel·lar</button>
        <button id="_btnOkModal" style="padding:10px 22px;background:#7c3aed;color:#fff;border:none;
          border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">${labelOk}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const tancar = () => modal.remove();
  modal.querySelector('#_btnTancarModal').addEventListener('click', tancar);
  modal.querySelector('#_btnCancelModal').addEventListener('click', tancar);
  modal.addEventListener('click', e => { if (e.target === modal) tancar(); });
  modal.querySelector('#_btnOkModal').addEventListener('click', async () => {
    const ok = await onOk();
    if (ok !== false) tancar();
  });
  return modal;
}

/* ══════════════════════════════════════════════════════
   UTILITATS
══════════════════════════════════════════════════════ */
async function carregarNivells() {
  try {
    const snap = await window.db.collection('nivells_centre').orderBy('ordre').get();
    return snap.docs.map(d => ({id:d.id,...d.data()}));
  } catch(e) { return []; }
}

async function carregarGrupsCentre() {
  try {
    const snap = await window.db.collection('grups_centre').orderBy('ordre').get();
    return snap.docs.map(d => ({id:d.id,...d.data()}));
  } catch(e) { return []; }
}

function rolColor(rol) {
  const c = {superadmin:'#7c3aed',admin:'#dc2626',secretaria:'#0891b2',
              tutor:'#059669',professor:'#2563eb',revisor:'#d97706',alumne:'#0e7490'};
  return c[rol]||'#6b7280';
}

function generarPassword() {
  const c = 'ABCDEFGHJKMNPQRSTWXYZabcdefghjkmnpqrstwxyz23456789';
  return Array.from({length:10},()=>c[Math.floor(Math.random()*c.length)]).join('');
}

function esH(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ══════════════════════════════════════════════════════
   CÒPIA DE SEGURETAT v2
   - Genera JSON local (sense escriure a Firestore)
   - Descàrrega directa al navegador
   - Opció d'enviar per email via EmailJS
   - Col·leccions completes de l'app
══════════════════════════════════════════════════════ */

// Totes les col·leccions de l'aplicació
const BACKUP_COLS = [
  'professors',
  'classes',
  'alumnes',
  'grups_centre',
  'materies_centre',
  'nivells_centre',
  'activitats',
  'avaluacio_centre',
  'tutoria_config',
  'ultracomentator_plantilles',
  '_sistema',
  '_peticions_usuari',
];

// Col·leccions que tenen sub-col·leccions conegudes
const BACKUP_SUBCOLS = {
  professors: ['logins'],
  classes: ['comentaris', 'periodes', 'alumnes'],
};

// Funció principal: exporta tot a JSON
window.generarBackupJSON = async function(onProgress) {
  const db = window.db;
  const snapshot = {
    _meta: {
      versio: '2.0',
      app: 'ComentaIA',
      timestamp: new Date().toISOString(),
      creador: firebase.auth().currentUser?.email || 'sistema',
    }
  };

  const totalCols = BACKUP_COLS.length;
  let done = 0;

  for (const col of BACKUP_COLS) {
    try {
      const snap = await db.collection(col).get();
      snapshot[col] = {};
      for (const docRef of snap.docs) {
        snapshot[col][docRef.id] = docRef.data();
        // Sub-col·leccions
        if (BACKUP_SUBCOLS[col]) {
          snapshot[col][docRef.id]._subcols = {};
          for (const sub of BACKUP_SUBCOLS[col]) {
            try {
              const subSnap = await docRef.ref.collection(sub).get();
              if (!subSnap.empty) {
                snapshot[col][docRef.id]._subcols[sub] = {};
                subSnap.docs.forEach(sd => {
                  snapshot[col][docRef.id]._subcols[sub][sd.id] = sd.data();
                });
              }
            } catch(e) { /* sub-col sense permisos o inexistent */ }
          }
          if (!Object.keys(snapshot[col][docRef.id]._subcols).length) {
            delete snapshot[col][docRef.id]._subcols;
          }
        }
      }
    } catch(e) {
      snapshot[col] = { _error: e.message };
    }
    done++;
    onProgress?.(Math.round((done/totalCols)*100), col);
  }

  return snapshot;
};

// Descarregar JSON al navegador
window.descarregarBackup = function(snapshot) {
  const dataStr = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const data = snapshot._meta?.timestamp?.slice(0,10) || new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `comentaIA_backup_${data}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
};

// Enviar backup per email via EmailJS
window.enviarBackupEmail = async function(snapshot, destinatari) {
  // Comprova que emailjs està carregat
  if (typeof emailjs === 'undefined') {
    throw new Error('EmailJS no carregat. Afegeix el script a index.html');
  }
  const cfgSnap = await window.db.collection('_sistema').doc('emailjs').get().catch(()=>null);
  const cfg = cfgSnap?.data() || {};
  if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey) {
    throw new Error('EmailJS no configurat. Configura\'l des del panell d\'administrador.');
  }

  const dataStr = JSON.stringify(snapshot, null, 2);
  const kb = Math.round(dataStr.length / 1024);
  const data = snapshot._meta?.timestamp?.slice(0,10) || new Date().toISOString().slice(0,10);

  // EmailJS té límit de ~50KB per missatge — adjuntem resum + avís de descàrrega
  const resum = {
    data: data,
    creador: snapshot._meta?.creador,
    cols: Object.keys(snapshot).filter(k=>!k.startsWith('_')).map(col => ({
      col,
      docs: Object.keys(snapshot[col]||{}).length
    })),
    mida_kb: kb,
  };

  await emailjs.init(cfg.publicKey);
  await emailjs.send(cfg.serviceId, cfg.templateId, {
    to_email: destinatari,
    subject: `📦 Backup ComentaIA — ${data}`,
    resum: JSON.stringify(resum, null, 2),
    mida: `${kb} KB`,
    data_backup: data,
    creador: snapshot._meta?.creador || 'Sistema',
  });
};

// Realitzar còpia completa: genera + descarrega + envia email si configurat
window.realitzarCopiaSeguretat = async function(silenciosa = false) {
  const rols = window._userRols || [];
  if (!rols.some(r=>['admin','superadmin'].includes(r))) return;

  try {
    if (!silenciosa) window.mostrarToast('💾 Generant còpia...', 60000);

    const snapshot = await window.generarBackupJSON();
    window.descarregarBackup(snapshot);

    // Intentar enviar per email (si configurat) sense bloquejar
    try {
      const cfgSnap = await window.db.collection('_sistema').doc('emailjs').get();
      const cfg = cfgSnap?.data() || {};
      if (cfg.serviceId && cfg.adminEmails?.length) {
        for (const mail of cfg.adminEmails) {
          await window.enviarBackupEmail(snapshot, mail);
        }
      }
    } catch(e) { /* email opcional, no bloquejar */ }

    if (!silenciosa) window.mostrarToast('✅ Còpia generada i descarregada!', 4000);
    return snapshot;
  } catch(e) {
    console.warn('CòpiaSeguretat:', e.message);
    if (!silenciosa) window.mostrarToast('❌ Error: ' + e.message, 4000);
  }
};

// Còpia setmanal automàtica (silenciosa, només descarrega)
firebase.auth().onAuthStateChanged(user => {
  if (!user) return;
  setTimeout(() => {
    if (!window._userRols?.some(r=>['admin','superadmin'].includes(r))) return;
    const KEY = '_ultima_copia_v2';
    const ara = Date.now();
    const ultima = parseInt(localStorage.getItem(KEY)||'0');
    if (ara - ultima > 7*24*60*60*1000) {
      window.realitzarCopiaSeguretat(true)
        .then(() => localStorage.setItem(KEY, String(ara)))
        .catch(() => {});
    }
  }, 8000);
});

/* ══════════════════════════════════════════════════════
   BADGE USUARIS PENDENTS
   Mostra un badge al botó de secretaria del sidebar
   quan hi ha usuaris sense cap rol assignat.
══════════════════════════════════════════════════════ */
async function comprovarUsuarisPendents() {
  try {
    // Firestore no suporta query per array buit, cal carregar tots i filtrar al client
    const snapTots = await window.db.collection('professors').get();
    const pendents = snapTots.docs.filter(d => {
      const data = d.data();
      if (data.deleted || data.suspended) return false;
      const rols = data.rols;
      return !Array.isArray(rols) || rols.length === 0;
    });

    const count = pendents.length;
    actualitzarBadgePendents(count);
    return count;
  } catch(e) {
    console.warn('secretaria: error comprovant pendents', e);
    return 0;
  }
}

/* ══════════════════════════════════════════════════════
   LISTENER EN TEMPS REAL DE PENDENTS
   Substitueix el setInterval — detecta nous usuaris
   (inclosos els que es registren via Google) a l'instant
══════════════════════════════════════════════════════ */
let _pendentsUnsubscribe = null;

function iniciarListenerPendents() {
  // Cancel·lar listener anterior si existeix
  if (_pendentsUnsubscribe) {
    _pendentsUnsubscribe();
    _pendentsUnsubscribe = null;
  }

  try {
    _pendentsUnsubscribe = window.db.collection('professors')
      .onSnapshot(snap => {
        const pendents = snap.docs.filter(d => {
          const data = d.data();
          if (data.deleted || data.suspended) return false;
          const rols = data.rols;
          return !Array.isArray(rols) || rols.length === 0;
        });
        actualitzarBadgePendents(pendents.length);
      }, err => {
        console.warn('secretaria: error listener pendents', err);
        // Fallback: polling cada 5 min si el listener falla
        comprovarUsuarisPendents();
        setInterval(comprovarUsuarisPendents, 5 * 60 * 1000);
      });
  } catch(e) {
    console.warn('secretaria: no s\'ha pogut iniciar el listener', e);
    comprovarUsuarisPendents();
  }
}

window.iniciarListenerPendents = iniciarListenerPendents;

function actualitzarBadgePendents(count) {
  const badgeCSS = `
    display:inline-flex;align-items:center;justify-content:center;
    background:#ef4444;color:#fff;border-radius:99px;
    font-size:10px;font-weight:800;min-width:18px;height:18px;
    padding:0 5px;margin-left:6px;line-height:1;
  `;
  const titolBadge = `${count} usuari${count !== 1 ? 's' : ''} pendent${count !== 1 ? 's' : ''} d'assignar rol`;

  // Badge al botó Secretaria del sidebar
  const btnSec = document.getElementById('btnSecretariaSidebar');
  if (btnSec) {
    btnSec.querySelector('.aa-pending-badge')?.remove();
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'aa-pending-badge';
      badge.style.cssText = badgeCSS;
      badge.textContent = count;
      badge.title = titolBadge;
      btnSec.appendChild(badge);
    }
  }

  // Badge idèntic al botó Usuaris del panell de secretaria (tab header)
  const tabUsuaris = document.querySelector('button.sec-tab[data-tab="usuaris"]');
  if (tabUsuaris) {
    tabUsuaris.querySelector('.aa-pending-badge')?.remove();
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'aa-pending-badge';
      badge.style.cssText = badgeCSS;
      badge.textContent = count;
      badge.title = titolBadge;
      tabUsuaris.appendChild(badge);
    }
  }
}

// Exposar per a ús extern
window.comprovarUsuarisPendents = comprovarUsuarisPendents;

console.log('✅ secretaria.js v2: inicialitzat');
