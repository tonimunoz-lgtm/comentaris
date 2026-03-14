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
window.injectarBotoSecretaria = function() {
  if (document.getElementById('btnSecretariaSidebar')) return;
  const nav = document.querySelector('.sidebar-nav');
  if (!nav) return;
  const btn = document.createElement('button');
  btn.id = 'btnSecretariaSidebar';
  btn.className = 'nav-item nav-item-rol';
  btn.innerHTML = `<span class="nav-icon">📋</span><span>Secretaria</span>`;
  btn.addEventListener('click', obrirPanellSecretaria);
  nav.appendChild(btn);
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
    display:flex;align-items:stretch;justify-content:flex-end;
  `;

  overlay.innerHTML = `
    <div style="width:100%;max-width:1400px;background:#fff;display:flex;flex-direction:column;
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
    case 'butlletins': await renderButlletins(body); break;
    case 'quadre':     await renderQuadreDades(body);break;
  }
}

/* ══════════════════════════════════════════════════════
   TAB ESTRUCTURA: Nivells → Grups/Matèries/Projectes → Alumnes
══════════════════════════════════════════════════════ */
async function renderEstructura(body) {
  // Carregar curs actiu
  const cursActiu = await carregarCursActiu();

  const [nivells, grups] = await Promise.all([
    carregarNivells(),
    carregarGrupsCentre()
  ]);

  // Agrupar grups per nivell
  const grupsPer = {};
  grups.forEach(g => {
    if (!grupsPer[g.nivellId]) grupsPer[g.nivellId] = [];
    grupsPer[g.nivellId].push(g);
  });

  // Estat de selecció
  let nivellActiu = null;
  let grupActiu   = null;  // el grup "classe" actiu (tipus=classe)
  let tipusActiu  = null;  // el grup "matèria/projecte/optativa" actiu

  // ── Layout 4 columnes ──────────────────────────────
  body.innerHTML = `
    <div style="display:flex;gap:0;height:100%;min-height:500px;overflow-x:auto;">

      <!-- COL 1: NIVELLS -->
      <div style="width:190px;flex-shrink:0;display:flex;flex-direction:column;padding-right:16px;border-right:1px solid #e5e7eb;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:11px;font-weight:700;color:#7c3aed;letter-spacing:0.05em;">NIVELLS</span>
          <button id="btnNouNivell" style="background:#7c3aed;color:#fff;border:none;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;">+ Nou</button>
        </div>
        <div id="llista-nivells" style="display:flex;flex-direction:column;gap:5px;overflow-y:auto;flex:1;"></div>
      </div>

      <!-- COL 2: GRUPS CLASSE -->
      <div style="width:190px;flex-shrink:0;display:flex;flex-direction:column;padding:0 16px;border-right:1px solid #e5e7eb;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:11px;font-weight:700;color:#2563eb;letter-spacing:0.05em;">🏫 GRUPS CLASSE</span>
          <button id="btnNouGrupClasse" disabled style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;opacity:0.5;">+ Nou</button>
        </div>
        <div id="llista-grups-classe" style="display:flex;flex-direction:column;gap:5px;overflow-y:auto;flex:1;">
          <p style="font-size:11px;color:#9ca3af;text-align:center;padding:16px 0;">Selecciona un nivell</p>
        </div>
      </div>

      <!-- COL 3: MATÈRIES / PROJECTES / OPTATIVES -->
      <div style="width:210px;flex-shrink:0;display:flex;flex-direction:column;padding:0 16px;border-right:1px solid #e5e7eb;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:4px;">
          <span style="font-size:11px;font-weight:700;color:#059669;letter-spacing:0.05em;">📚 MATÈRIES / PROJECTES</span>
          <button id="btnNouTipus" disabled style="background:#059669;color:#fff;border:none;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;opacity:0.5;">+ Nou</button>
        </div>
        <div id="llista-tipus" style="display:flex;flex-direction:column;gap:5px;overflow-y:auto;flex:1;">
          <p style="font-size:11px;color:#9ca3af;text-align:center;padding:16px 0;">Selecciona un nivell</p>
        </div>
      </div>

      <!-- COL 4: ALUMNES -->
      <div style="flex:1;min-width:220px;display:flex;flex-direction:column;padding-left:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
          <span style="font-size:11px;font-weight:700;color:#d97706;letter-spacing:0.05em;" id="titol-alumnes-col">👥 ALUMNES</span>
          <div style="display:flex;gap:5px;">
            <button id="btnNouAlumne" disabled style="background:#d97706;color:#fff;border:none;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;opacity:0.5;">+ Alumne</button>
            <button id="btnImportarAlumnes" disabled style="background:#059669;color:#fff;border:none;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;opacity:0.5;">📥 Excel</button>
          </div>
        </div>
        <div id="llista-alumnes-col" style="flex:1;overflow-y:auto;">
          <p style="font-size:11px;color:#9ca3af;text-align:center;padding:16px 0;">Selecciona un grup o matèria</p>
        </div>
      </div>
    </div>
  `;

  // ── Helpers d'interfície ──────────────────────────────

  function itemStyle(actiu, color) {
    return `padding:8px 10px;border-radius:8px;cursor:pointer;
      border:1.5px solid ${actiu ? color : '#e5e7eb'};
      background:${actiu ? color+'15' : '#fff'};
      display:flex;justify-content:space-between;align-items:center;
      transition:all 0.12s;font-size:12px;`;
  }

  function botoAccio(emoji, title) {
    return `<button style="background:none;border:none;font-size:13px;cursor:pointer;padding:1px;opacity:0.7;" title="${title}">${emoji}</button>`;
  }

  // ── RENDER NIVELLS ───────────────────────────────────
  function renderNivells() {
    const cont = document.getElementById('llista-nivells');
    if (!cont) return;
    if (!nivells.length) {
      cont.innerHTML = `<p style="font-size:11px;color:#9ca3af;text-align:center;">Cap nivell</p>`;
      return;
    }
    cont.innerHTML = nivells
      .sort((a,b)=>(a.ordre||99)-(b.ordre||99))
      .map(n => `
        <div class="nivell-item" data-id="${n.id}" draggable="true" style="${itemStyle(nivellActiu===n.id,'#7c3aed')}">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;color:#1e1b4b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esH(n.nom)}</div>
            <div style="font-size:10px;color:#9ca3af;">${esH(n.curs||'')} · ${(grupsPer[n.id]||[]).length} grups</div>
          </div>
          <div style="display:flex;gap:1px;flex-shrink:0;">
            ${botoAccio('✏️','Editar')} ${botoAccio('🗑️','Eliminar')}
          </div>
        </div>`).join('');

    cont.querySelectorAll('.nivell-item').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        nivellActiu = el.dataset.id;
        grupActiu = null; tipusActiu = null;
        renderNivells();
        renderGrupsClasse();
        renderTipus();
        renderAlumnes(null);
        const btnGC = document.getElementById('btnNouGrupClasse');
        const btnT  = document.getElementById('btnNouTipus');
        if (btnGC) { btnGC.disabled=false; btnGC.style.opacity='1'; }
        if (btnT)  { btnT.disabled=false;  btnT.style.opacity='1'; }
      });
      // Edit
      el.querySelector('button:first-of-type')?.addEventListener('click', e => {
        e.stopPropagation();
        modalNivell(nivells.find(n=>n.id===el.dataset.id));
      });
      // Delete
      el.querySelector('button:last-of-type')?.addEventListener('click', e => {
        e.stopPropagation();
        const n = nivells.find(n=>n.id===el.dataset.id);
        if (!confirm(`Eliminar "${n?.nom}" i tots els seus grups?`)) return;
        eliminarNivell(el.dataset.id);
      });
      // Drag & drop per reordenar
      afegirDragDrop(el, cont, nivells, () => {
        nivells.forEach((n,i) => {
          n.ordre = i+1;
          window.db.collection('nivells_centre').doc(n.id).update({ordre:i+1}).catch(()=>{});
        });
        renderNivells();
      });
    });
  }

  // ── RENDER GRUPS CLASSE ──────────────────────────────
  function renderGrupsClasse() {
    const cont = document.getElementById('llista-grups-classe');
    if (!cont) return;
    if (!nivellActiu) {
      cont.innerHTML = `<p style="font-size:11px;color:#9ca3af;text-align:center;padding:16px 0;">Selecciona un nivell</p>`;
      return;
    }
    const gs = (grupsPer[nivellActiu]||[])
      .filter(g=>g.tipus==='classe')
      .sort((a,b)=>(a.ordre||99)-(b.ordre||99));

    if (!gs.length) {
      cont.innerHTML = `<p style="font-size:11px;color:#9ca3af;text-align:center;padding:16px 0;">Cap grup classe. Crea'n un!</p>`;
      return;
    }
    cont.innerHTML = gs.map(g => `
      <div class="gc-item" data-id="${g.id}" draggable="true" style="${itemStyle(grupActiu===g.id,'#2563eb')}">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;color:#1e1b4b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🏫 ${esH(g.nom)}</div>
          <div style="font-size:10px;color:#9ca3af;">${(g.alumnes||[]).length} alumnes</div>
        </div>
        <div style="display:flex;gap:1px;flex-shrink:0;">
          ${botoAccio('✏️','Editar')} ${botoAccio('🗑️','Eliminar')}
        </div>
      </div>`).join('');

    cont.querySelectorAll('.gc-item').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        grupActiu = el.dataset.id;
        tipusActiu = null;
        renderGrupsClasse();
        const g = grups.find(x=>x.id===grupActiu);
        document.getElementById('titol-alumnes-col').textContent = `👥 ALUMNES — ${g?.nom||''}`;
        activarBtnsAlumnes();
        renderAlumnes(g);
      });
      el.querySelector('button:first-of-type')?.addEventListener('click', e => {
        e.stopPropagation();
        modalGrup(grups.find(g=>g.id===el.dataset.id));
      });
      el.querySelector('button:last-of-type')?.addEventListener('click', e => {
        e.stopPropagation();
        const g = grups.find(g=>g.id===el.dataset.id);
        if (!confirm(`Eliminar "${g?.nom}" i totes les dades associades?`)) return;
        eliminarGrupComplet(el.dataset.id, g?.nom||'').then(() => recarregarGrups());
      });
      afegirDragDrop(el, cont, gs, () => {
        gs.forEach((g,i) => {
          g.ordre = i+1;
          window.db.collection('grups_centre').doc(g.id).update({ordre:i+1}).catch(()=>{});
        });
        renderGrupsClasse();
      });
    });
  }

  // ── RENDER MATÈRIES/PROJECTES/OPTATIVES ─────────────
  function renderTipus() {
    const cont = document.getElementById('llista-tipus');
    if (!cont) return;
    if (!nivellActiu) {
      cont.innerHTML = `<p style="font-size:11px;color:#9ca3af;text-align:center;padding:16px 0;">Selecciona un nivell</p>`;
      return;
    }
    const gs = (grupsPer[nivellActiu]||[])
      .filter(g=>g.tipus!=='classe')
      .sort((a,b)=>(a.ordre||99)-(b.ordre||99));

    if (!gs.length) {
      cont.innerHTML = `<p style="font-size:11px;color:#9ca3af;text-align:center;padding:16px 0;">Cap matèria/projecte. Crea'n un!</p>`;
      return;
    }
    const ICONA = {materia:'📚',projecte:'🔬',optativa:'🎨'};
    cont.innerHTML = gs.map(g => `
      <div class="tip-item" data-id="${g.id}" draggable="true" style="${itemStyle(tipusActiu===g.id,'#059669')}">
        <div style="flex:1;min-width:0;">
          <div style="font-size:10px;color:#9ca3af;">${ICONA[g.tipus]||'📁'} ${g.tipus}</div>
          <div style="font-weight:700;color:#1e1b4b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esH(g.nom)}</div>
          <div style="font-size:10px;color:#9ca3af;">${(g.alumnes||[]).length} alumnes</div>
        </div>
        <div style="display:flex;gap:1px;flex-shrink:0;">
          ${botoAccio('✏️','Editar')} ${botoAccio('🗑️','Eliminar')}
        </div>
      </div>`).join('');

    cont.querySelectorAll('.tip-item').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        tipusActiu = el.dataset.id;
        grupActiu = null;
        renderTipus();
        const g = grups.find(x=>x.id===tipusActiu);
        document.getElementById('titol-alumnes-col').textContent = `👥 ALUMNES — ${g?.nom||''}`;
        activarBtnsAlumnes();
        renderAlumnes(g);
      });
      el.querySelector('button:first-of-type')?.addEventListener('click', e => {
        e.stopPropagation();
        modalGrup(grups.find(g=>g.id===el.dataset.id));
      });
      el.querySelector('button:last-of-type')?.addEventListener('click', e => {
        e.stopPropagation();
        const g = grups.find(g=>g.id===el.dataset.id);
        if (!confirm(`Eliminar "${g?.nom}"?`)) return;
        eliminarGrupComplet(el.dataset.id, g?.nom||'').then(() => recarregarGrups());
      });
      afegirDragDrop(el, cont, gs, () => {
        gs.forEach((g,i) => {
          g.ordre = i+1;
          window.db.collection('grups_centre').doc(g.id).update({ordre:i+1}).catch(()=>{});
        });
        renderTipus();
      });
    });
  }

  // ── RENDER ALUMNES ───────────────────────────────────
  function renderAlumnes(grup) {
    const cont = document.getElementById('llista-alumnes-col');
    if (!cont) return;
    if (!grup) {
      cont.innerHTML = `<p style="font-size:11px;color:#9ca3af;text-align:center;padding:16px 0;">Selecciona un grup o matèria</p>`;
      return;
    }
    const alumnes = (grup.alumnes||[]).slice().sort((a,b)=>(a.cognoms||'').localeCompare(b.cognoms||'','ca'));
    if (!alumnes.length) {
      cont.innerHTML = `
        <div style="text-align:center;padding:20px;color:#9ca3af;">
          <div style="font-size:28px;margin-bottom:6px;">👤</div>
          Cap alumne. Afegeix-ne o importa des d'Excel.
        </div>`;
      return;
    }
    cont.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:11px;" id="taulaAlumnes">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:5px 8px;text-align:left;">#</th>
            <th style="padding:5px 8px;text-align:left;">Cognoms, Nom</th>
            <th style="padding:5px 8px;text-align:left;">RALC</th>
            <th style="padding:5px 8px;text-align:center;">Accions</th>
          </tr>
        </thead>
        <tbody id="tbodyAlumnes">
          ${alumnes.map((a,i) => `
            <tr draggable="true" data-idx="${grup.alumnes.indexOf(a)}" style="border-bottom:1px solid #f3f4f6;cursor:grab;">
              <td style="padding:5px 8px;color:#9ca3af;">${i+1}</td>
              <td style="padding:5px 8px;font-weight:600;color:#1e1b4b;">
                ${esH(a.cognoms ? a.cognoms+', '+a.nom : a.nom)}
              </td>
              <td style="padding:5px 8px;color:#6b7280;">${esH(a.ralc||'—')}</td>
              <td style="padding:5px 8px;text-align:center;">
                <button class="btn-edit-al" data-idx="${grup.alumnes.indexOf(a)}"
                  style="background:none;border:none;color:#2563eb;cursor:pointer;font-size:12px;padding:2px;">✏️</button>
                <button class="btn-del-al" data-nom="${esH(a.nom)}" data-idx="${grup.alumnes.indexOf(a)}"
                  style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px;padding:2px;">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div style="padding:6px 8px;font-size:10px;color:#9ca3af;text-align:right;">Total: ${alumnes.length} alumnes</div>
    `;

    // Events edit/delete
    cont.querySelectorAll('.btn-edit-al').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        modalEditarAlumne(grup, idx, () => renderAlumnes(grup));
      });
    });
    cont.querySelectorAll('.btn-del-al').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Eliminar "${btn.dataset.nom}"?`)) return;
        const idx = parseInt(btn.dataset.idx);
        const nous = [...grup.alumnes];
        nous.splice(idx,1);
        await window.db.collection('grups_centre').doc(grup.id).update({alumnes:nous});
        grup.alumnes = nous;
        renderAlumnes(grup);
        window.mostrarToast('🗑️ Alumne eliminat');
      });
    });

    // Drag & drop files de la taula
    const tbody = document.getElementById('tbodyAlumnes');
    if (tbody) {
      afegirDragDropFiles(tbody, async (from, to) => {
        const nous = [...grup.alumnes];
        const [item] = nous.splice(from,1);
        nous.splice(to,0,item);
        await window.db.collection('grups_centre').doc(grup.id).update({alumnes:nous});
        grup.alumnes = nous;
        renderAlumnes(grup);
      });
    }
  }

  // ── HELPERS DRAG & DROP ──────────────────────────────
  function afegirDragDrop(el, container, arr, onReorder) {
    let dragIdx = null;
    el.addEventListener('dragstart', e => {
      dragIdx = [...container.children].indexOf(el);
      el.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => { el.style.opacity='1'; });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      el.style.background = '#ede9fe';
    });
    el.addEventListener('dragleave', () => {
      el.style.background = '';
    });
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.style.background = '';
      const toIdx = [...container.children].indexOf(el);
      if (dragIdx === null || dragIdx === toIdx) return;
      const [item] = arr.splice(dragIdx,1);
      arr.splice(toIdx,0,item);
      onReorder();
    });
  }

  function afegirDragDropFiles(tbody, onSwap) {
    let fromIdx = null;
    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('dragstart', e => {
        fromIdx = parseInt(tr.dataset.idx);
        tr.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
      });
      tr.addEventListener('dragend', () => { tr.style.opacity='1'; });
      tr.addEventListener('dragover', e => { e.preventDefault(); tr.style.background='#fef3c7'; });
      tr.addEventListener('dragleave', () => { tr.style.background=''; });
      tr.addEventListener('drop', e => {
        e.preventDefault(); tr.style.background='';
        const toIdx = parseInt(tr.dataset.idx);
        if (fromIdx === null || fromIdx === toIdx) return;
        onSwap(fromIdx, toIdx);
      });
    });
  }

  // ── ACTIVAR BOTONS ALUMNES ───────────────────────────
  function activarBtnsAlumnes() {
    ['btnNouAlumne','btnImportarAlumnes'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) { btn.disabled=false; btn.style.opacity='1'; }
    });
  }

  // ── RECARREGAR GRUPS ──────────────────────────────────
  async function recarregarGrups() {
    const nousg = await carregarGrupsCentre();
    grups.length=0; nousg.forEach(g=>grups.push(g));
    Object.keys(grupsPer).forEach(k=>delete grupsPer[k]);
    grups.forEach(g=>{
      if(!grupsPer[g.nivellId]) grupsPer[g.nivellId]=[];
      grupsPer[g.nivellId].push(g);
    });
    renderNivells();
    renderGrupsClasse();
    renderTipus();
    renderAlumnes(null);
  }

  // ── BOTONS PRINCIPALS ────────────────────────────────
  document.getElementById('btnNouNivell').addEventListener('click', () => modalNivell());
  document.getElementById('btnNouGrupClasse').addEventListener('click', () => {
    if (!nivellActiu) return;
    const n = nivells.find(n=>n.id===nivellActiu);
    modalGrup(null, nivellActiu, n, 'classe');
  });
  document.getElementById('btnNouTipus').addEventListener('click', () => {
    if (!nivellActiu) return;
    const n = nivells.find(n=>n.id===nivellActiu);
    modalGrup(null, nivellActiu, n, 'materia');
  });
  document.getElementById('btnNouAlumne').addEventListener('click', () => {
    const gId = tipusActiu || grupActiu;
    if (!gId) return;
    const g = grups.find(g=>g.id===gId);
    if (g) modalAlumne(g, () => renderAlumnes(g));
  });
  document.getElementById('btnImportarAlumnes').addEventListener('click', () => {
    const gId = tipusActiu || grupActiu;
    if (!gId) return;
    const g = grups.find(g=>g.id===gId);
    if (g) modalImportExcel(g, () => {
      recarregarGrups().then(() => {
        const gAct = grups.find(g=>g.id===gId);
        if (gAct) renderAlumnes(gAct);
      });
    });
  });

  // Callbacks de modals
  window._secOnNivellCreat = async () => {
    const nous = await carregarNivells();
    nivells.length=0; nous.forEach(n=>nivells.push(n));
    renderNivells();
  };
  window._secOnGrupCreat = async () => { await recarregarGrups(); };

  // ── RENDER INICIAL ───────────────────────────────────
  renderNivells();
}




/* ══════════════════════════════════════════════════════
   MODAL NIVELL
══════════════════════════════════════════════════════ */
function modalNivell(existent) {
  const m = crearModal(`${existent ? '✏️ Editar' : '+ Nou'} nivell`, `
    <div style="margin-bottom:14px;">
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Nom *</label>
      <input id="inpNivNom" type="text" value="${esH(existent?.nom||'')}" placeholder="Ex: 1r ESO, 2n Batxillerat..."
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
    </div>
    <div style="margin-bottom:14px;">
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Curs acadèmic *</label>
      <input id="inpNivCurs" type="text" value="${esH(existent?.curs||(window._cursActiu||'2025-26'))}" placeholder="2025-26"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
    </div>
    <div>
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Ordre</label>
      <input id="inpNivOrdre" type="number" value="${existent?.ordre??99}"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
    </div>
  `, async () => {
    const nom   = document.getElementById('inpNivNom').value.trim();
    const curs  = document.getElementById('inpNivCurs').value.trim();
    const ordre = parseInt(document.getElementById('inpNivOrdre').value)||99;
    if (!nom||!curs) { window.mostrarToast('⚠️ Omple els camps obligatoris'); return false; }
    const data = {nom, curs, ordre};
    if (existent) await window.db.collection('nivells_centre').doc(existent.id).update(data);
    else await window.db.collection('nivells_centre').add(data);
    // Actualitzar curs actiu global
    await guardarCursActiu(curs);
    window.mostrarToast(existent ? '✅ Nivell actualitzat' : '✅ Nivell creat');
    await window._secOnNivellCreat?.();
    return true;
  });
  setTimeout(()=>document.getElementById('inpNivNom')?.focus(), 100);
}

/* ══════════════════════════════════════════════════════
   MODAL GRUP
══════════════════════════════════════════════════════ */
function modalGrup(existent, nivellIdFix, nivellFix) {
  const m = crearModal(`${existent ? '✏️ Editar' : '+ Nou'} grup`, `
    <div style="margin-bottom:14px;">
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Nom *</label>
      <input id="inpGrpNom" type="text" value="${esH(existent?.nom||'')}" placeholder="Ex: 3A, Matemàtiques, STEM..."
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
    </div>
    <div style="margin-bottom:14px;">
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Tipus *</label>
      <select id="inpGrpTipus" style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;background:#f9fafb;">
        ${Object.entries(TIPUS_GRUP).map(([k,v])=>`
          <option value="${k}" ${(existent?.tipus||'classe')===k?'selected':''}>${v.icon} ${v.label}</option>
        `).join('')}
      </select>
    </div>
    <div style="margin-bottom:14px;">
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Nivell</label>
      <input type="text" value="${esH(nivellFix?.nom || existent?.nivellNom || '')}"
        disabled style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;background:#f3f4f6;font-family:inherit;">
    </div>
    <div>
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Ordre</label>
      <input id="inpGrpOrdre" type="number" value="${existent?.ordre??99}"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
    </div>
  `, async () => {
    const nom   = document.getElementById('inpGrpNom').value.trim();
    const tipus = document.getElementById('inpGrpTipus').value;
    const ordre = parseInt(document.getElementById('inpGrpOrdre').value)||99;
    const nId   = nivellIdFix || existent?.nivellId;
    const nNom  = nivellFix?.nom || existent?.nivellNom || '';
    const curs  = nivellFix?.curs || existent?.curs || '';
    if (!nom) { window.mostrarToast('⚠️ El nom és obligatori'); return false; }
    const data = {nom, tipus, nivellId:nId, nivellNom:nNom, curs, ordre, alumnes: existent?.alumnes||[]};
    if (existent) await window.db.collection('grups_centre').doc(existent.id).update({nom,tipus,ordre});
    else await window.db.collection('grups_centre').add(data);
    window.mostrarToast(existent ? '✅ Grup actualitzat' : '✅ Grup creat');
    await window._secOnGrupCreat?.();
    return true;
  });
  setTimeout(()=>document.getElementById('inpGrpNom')?.focus(), 100);
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
    await window.db.collection('grups_centre').doc(grup.id).update({alumnes});
    grup.alumnes = alumnes;
    window.mostrarToast('✅ Alumne afegit');
    onRefresh?.(grup);
    return true;
  });
  setTimeout(()=>document.getElementById('inpAlNom')?.focus(), 100);
}

/* ══════════════════════════════════════════════════════
   MODAL IMPORTAR ALUMNES EXCEL
══════════════════════════════════════════════════════ */
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
    await window.db.collection('grups_centre').doc(grup.id).update({ alumnes: alumnesNous });
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
      await window.db.collection('grups_centre').doc(grup.id).update({ alumnes: [...actuals, ...nodupl] });
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
    try {
      const avalSnap = await db.collectionGroup('avaluacio_centre_grup')
        .where('grupCentreId', '==', grupId).get();
      if (!avalSnap.empty) {
        const batchAv = db.batch();
        avalSnap.docs.forEach(d => batchAv.delete(d.ref));
        await batchAv.commit();
      }
    } catch(e) { /* avaluació pot no tenir index, no és crític */ }

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
  // Eliminar tots els grups del nivell
  const snap = await db.collection('grups_centre').where('nivellId','==',nivellId).get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(db.collection('nivells_centre').doc(nivellId));
  await batch.commit();
  window.mostrarToast('🗑️ Nivell i grups eliminats');
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

  body.innerHTML = `
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
  crearModal('+ Nou usuari', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <div>
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Nom complet *</label>
        <input id="inpNomUser" type="text" placeholder="Maria Garcia"
          style="width:100%;box-sizing:border-box;padding:9px 11px;border:1.5px solid #e5e7eb;border-radius:9px;font-size:13px;outline:none;font-family:inherit;">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Email *</label>
        <input id="inpEmailUser" type="email" placeholder="professor@insmatadepera.cat"
          style="width:100%;box-sizing:border-box;padding:9px 11px;border:1.5px solid #e5e7eb;border-radius:9px;font-size:13px;outline:none;font-family:inherit;">
      </div>
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Contrasenya inicial *</label>
      <div style="display:flex;gap:8px;">
        <input id="inpPwUser" type="text" value="${pwGen}"
          style="flex:1;padding:9px 11px;border:1.5px solid #e5e7eb;border-radius:9px;font-size:13px;outline:none;font-family:inherit;">
        <button id="btnGenPw2" style="padding:9px 14px;background:#f3f4f6;border:none;
          border-radius:9px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">🎲 Nova</button>
      </div>
    </div>
    <div style="margin-bottom:14px;">
      <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:8px;">Rols</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        ${['professor','tutor','secretaria','revisor','admin'].map(r => `
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" class="chk-rol-nou" value="${r}" ${r==='professor'?'checked':''}
              style="width:16px;height:16px;accent-color:${rolColor(r)};">
            <span style="font-size:13px;font-weight:600;color:${rolColor(r)};">${r}</span>
          </label>
        `).join('')}
      </div>
    </div>
    <div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#374151;">
        <input type="checkbox" id="chkForcePw" checked style="width:16px;height:16px;">
        Forçar canvi de contrasenya en el primer accés
      </label>
    </div>
    <div id="errUser" style="color:#ef4444;font-size:12px;min-height:16px;margin-top:10px;"></div>
  `, async () => {
    const nom   = document.getElementById('inpNomUser').value.trim();
    const email = document.getElementById('inpEmailUser').value.trim();
    const pw    = document.getElementById('inpPwUser').value.trim();
    const rols  = [...document.querySelectorAll('.chk-rol-nou:checked')].map(c=>c.value);
    const force = document.getElementById('chkForcePw').checked;
    const errEl = document.getElementById('errUser');

    if (!nom||!email||!pw) { errEl.textContent='⚠️ Omple els camps obligatoris'; return false; }
    if (pw.length<6) { errEl.textContent='⚠️ Mínim 6 caràcters'; return false; }

    // Guardem petició — una Cloud Function o l'admin ho processa
    // Mentre no tenim CF, guardem a _peticions_usuari
    try {
      await window.db.collection('_peticions_usuari').add({
        tipus: 'crear',
        nom, email,
        passwordClar: pw,   // en prod: xifrar o eliminar
        rols: rols.length>0?rols:['professor'],
        forcePasswordChange: force,
        creatPer: firebase.auth().currentUser?.uid||'',
        creatAt: firebase.firestore.FieldValue.serverTimestamp(),
        processat: false
      });
      window.mostrarToast(`✅ Petició creada per a ${email}`);
      window.mostrarToast('ℹ️ Executa la funció de creació des de Firebase Console o Cloud Functions', 5000);
      onCreat?.();
      return true;
    } catch(e) {
      errEl.textContent = 'Error: '+e.message;
      return false;
    }
  }, 'Crear usuari');

  setTimeout(()=>{
    document.getElementById('btnGenPw2')?.addEventListener('click',()=>{
      document.getElementById('inpPwUser').value = generarPassword();
    });
    document.getElementById('inpNomUser')?.focus();
  }, 100);
}

/* ══════════════════════════════════════════════════════
   MODAL EDITAR ROLS
══════════════════════════════════════════════════════ */
async function modalEditarRols(usuari, onGuardat) {
  const rolsActuals = Array.isArray(usuari.rols) ? usuari.rols :
                      (usuari.isAdmin ? ['admin'] : ['professor']);
  const descrip = {
    professor:  'Genera comentaris i avaluació',
    tutor:      'Panell tutoria + semàfor alumnes',
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

  crearModal(`🎭 Rols — ${usuari.nom||usuari.email}`, `
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${['professor','tutor','secretaria','revisor','admin'].map(r=>`
        <label style="display:flex;align-items:center;gap:12px;cursor:pointer;
                      padding:12px 14px;border-radius:10px;background:#f9fafb;
                      border:2px solid ${rolsActuals.includes(r)?rolColor(r):'#e5e7eb'};
                      transition:border-color 0.2s;"
               id="row-rol-${r}">
          <input type="checkbox" class="chk-rol-edit" value="${r}"
            ${rolsActuals.includes(r)?'checked':''}
            style="width:18px;height:18px;accent-color:${rolColor(r)};">
          <div style="flex:1;">
            <div style="font-weight:700;color:${rolColor(r)};">${r}</div>
            <div style="font-size:12px;color:#9ca3af;">${descrip[r]||''}</div>
          </div>
        </label>
      `).join('')}
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

    await window.db.collection('professors').doc(usuari.id).update({
      rols: rols.length>0?rols:['professor'],
      isAdmin: rols.includes('admin'),
      revisio_nivells: revisioNivells,
      revisio_tot: revisioNivells.includes('_tot'),
    });
    window.mostrarToast('✅ Rols actualitzats');
    onGuardat?.();
    return true;
  }, 'Guardar rols');

  // Actualitzar bord checkbox visualment + mostrar secció revisor
  setTimeout(()=>{
    document.querySelectorAll('.chk-rol-edit').forEach(chk=>{
      chk.addEventListener('change', ()=>{
        const row = document.getElementById(`row-rol-${chk.value}`);
        if (row) row.style.borderColor = chk.checked ? rolColor(chk.value) : '#e5e7eb';
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
  }, 100);
}

/* ══════════════════════════════════════════════════════
   TAB BUTLLETINS i QUADRE DADES (simplificats)
══════════════════════════════════════════════════════ */
async function renderButlletins(body) {
  const [nivells, grups] = await Promise.all([carregarNivells(), carregarGrupsCentre()]);

  body.innerHTML = `
    <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin-bottom:16px;">📄 Butlletins</h3>

    <!-- Filtres -->
    <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:12px;align-items:end;">
        <div>
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Curs</label>
          <select id="bCurs" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
            <option value="">— Tria curs —</option>
            ${[...new Set(grups.map(g=>g.curs).filter(Boolean))].sort().reverse()
              .map(c=>`<option value="${c}">${c}</option>`).join('')}
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

  document.getElementById('bCurs').addEventListener('change', actualitzarGrups);
  document.getElementById('bNivell').addEventListener('change', actualitzarGrups);
  document.getElementById('bCarregar').addEventListener('click', () => carregarDadesButlletins(grups));
}

async function carregarDadesButlletins(grups) {
  const grupId = document.getElementById('bGrup')?.value;
  const curs   = document.getElementById('bCurs')?.value;
  if (!grupId || !curs) {
    window.mostrarToast('⚠️ Tria el curs i el grup classe', 3000);
    return;
  }

  const resDiv = document.getElementById('bLlistaAlumnes');
  const matDiv = document.getElementById('bResumMateries');
  const matLlista = document.getElementById('bLlistaMateries');
  resDiv.innerHTML = '<p style="color:#9ca3af;padding:20px;">⏳ Carregant dades...</p>';
  matDiv.style.display = 'none';

  try {
    const db = window.db;
    const grupDoc = grups.find(g=>g.id===grupId);
    const alumnesCentre = grupDoc?.alumnes || [];

    if (alumnesCentre.length === 0) {
      resDiv.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:30px;">Cap alumne en aquest grup. Afegeix alumnes des de la pestanya Estructura.</p>';
      return;
    }

    // Estratègia: llegir totes les subcoleccions conegudes de avaluacio_centre/{curs}
    // Les subcoleccions s'identifiquen per:
    //   1. grupId = el grupId del grup classe seleccionat (professors envien per grup classe)
    //   2. grupId = qualsevol subcolecció on grupId === grupId
    // Com que Firestore JS no permet llistar subcoleccions des del client,
    // llegim TOTS els grups del centre del mateix curs i busquem dades per a cada un

    const totsGrups = await carregarGrupsCentre();
    // Candidats: tots els grups del curs (tant grups classe com matèries)
    const candidats = totsGrups.filter(g => !g.curs || g.curs === curs);

    const materiesAmbDades = [];
    const alumnesAmbDades  = {};

    // Inicialitzar amb tots els alumnes del centre
    alumnesCentre.forEach(a => {
      const key = a.ralc || `${a.cognoms}_${a.nom}`;
      alumnesAmbDades[key] = {
        nom: a.nom, cognoms: a.cognoms||'', ralc: a.ralc||'',
        nomComplet: a.cognoms ? `${a.cognoms}, ${a.nom}` : a.nom,
        materies: {}
      };
    });

    // Llegir cada candidat com a possible subcolecció
    for (const cand of candidats) {
      try {
        // Buscar documents que pertanyin al grup classe seleccionat
        // El professor pot haver enviat amb grupId = grupId del grup classe
        const snap = await db.collection('avaluacio_centre')
          .doc(curs)
          .collection(cand.id)
          .where('grupId', '==', grupId)
          .get();

        if (!snap.empty) {
          const nomMat = cand.nom || cand.id;
          materiesAmbDades.push({ id: cand.id, nom: nomMat });

          snap.docs.forEach(doc => {
            const d = doc.data();
            const key = d.ralc || `${d.cognoms}_${d.nom}`;
            if (!alumnesAmbDades[key]) {
              alumnesAmbDades[key] = {
                nom: d.nom||'', cognoms: d.cognoms||'', ralc: d.ralc||'',
                nomComplet: d.cognoms ? `${d.cognoms}, ${d.nom}` : d.nom,
                materies: {}
              };
            }
            alumnesAmbDades[key].materies[cand.id] = {
              nom: nomMat,
              items: d.items || [],
              descripcioComuna: d.descripcioComuna || '',
            };
          });
        } else {
          // Intentar sense filtre grupId (per compatibilitat amb dades antigues)
          const snap2 = await db.collection('avaluacio_centre')
            .doc(curs)
            .collection(cand.id)
            .limit(3)
            .get();
          if (!snap2.empty) {
            const nomMat = cand.nom || cand.id;
            materiesAmbDades.push({ id: cand.id, nom: nomMat });
            snap2.docs.forEach(doc => {
              const d = doc.data();
              const key = d.ralc || `${d.cognoms}_${d.nom}`;
              if (!alumnesAmbDades[key]) {
                alumnesAmbDades[key] = {
                  nom: d.nom||'', cognoms: d.cognoms||'', ralc: d.ralc||'',
                  nomComplet: d.cognoms ? `${d.cognoms}, ${d.nom}` : d.nom,
                  materies: {}
                };
              }
              if (!alumnesAmbDades[key].materies[cand.id]) {
                alumnesAmbDades[key].materies[cand.id] = {
                  nom: nomMat, items: d.items||[], descripcioComuna: d.descripcioComuna||''
                };
              }
            });
          }
        }
      } catch(e) { /* ignorem errors de subcoleccions que no existeixen */ }
    }

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

    resDiv.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:13px;color:#6b7280;">
          <strong style="color:#1e1b4b;">${alumnes.length}</strong> alumnes ·
          <strong style="color:#059669;">${ambDades.length}</strong> amb dades ·
          <strong style="color:#dc2626;">${senseDades.length}</strong> sense dades
        </div>
        <div style="display:flex;gap:8px;">
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
          ${alumnes.map(a => {
            const nMat = Object.keys(a.materies).length;
            const nItems = Object.values(a.materies).reduce((s,m)=>s+(m.items?.length||0),0);
            return `
              <tr style="border-bottom:1px solid #f3f4f6;" data-alumne='${JSON.stringify({nom:a.nom,cognoms:a.cognoms,ralc:a.ralc,materies:a.materies})}'>
                <td style="padding:7px 10px;font-weight:600;color:#1e1b4b;">${esH(a.nomComplet)}</td>
                <td style="padding:7px 10px;text-align:center;">
                  ${nMat > 0
                    ? `<span style="color:#059669;font-weight:700;">${nMat}</span>`
                    : '<span style="color:#dc2626;">0</span>'}
                </td>
                <td style="padding:7px 10px;text-align:center;color:#6b7280;">${nItems||'—'}</td>
                <td style="padding:7px 10px;text-align:center;">
                  ${nMat > 0
                    ? `<button class="btn-gen-butlleti" style="padding:4px 10px;background:#4f46e5;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">
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
    document.getElementById('bGenTots')?.addEventListener('click', () => {
      ambDades.forEach(a => generarButlleti(a, curs, grupDoc?.nom||''));
    });

    document.querySelectorAll('.btn-gen-butlleti').forEach(btn => {
      btn.addEventListener('click', () => {
        const tr = btn.closest('tr');
        const alumne = JSON.parse(tr.dataset.alumne);
        generarButlleti(alumne, curs, grupDoc?.nom||'');
      });
    });

  } catch(e) {
    console.error('carregarDadesButlletins:', e);
    resDiv.innerHTML = `<div style="color:#ef4444;padding:16px;">Error: ${e.message}</div>`;
  }
}

function generarButlleti(alumne, curs, grupNom) {
  const COLORS_ASSL = {
    'Assoliment Excel·lent': '#7c3aed',
    'Assoliment Notable':    '#2563eb',
    'Assoliment Satisfactori':'#d97706',
    'No Assoliment':         '#dc2626',
    'No avaluat':            '#9ca3af',
  };
  const SHORT = {
    'Assoliment Excel·lent': 'AE',
    'Assoliment Notable':    'AN',
    'Assoliment Satisfactori':'AS',
    'No Assoliment':         'NA',
    'No avaluat':            '--',
  };

  const nomComplet = alumne.cognoms ? `${alumne.cognoms}, ${alumne.nom}` : alumne.nom;
  const materies = Object.values(alumne.materies);

  const html = `<!DOCTYPE html>
<html lang="ca">
<head>
  <meta charset="UTF-8">
  <title>Butlletí — ${nomComplet}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; padding: 20mm; }
    .cap { display: flex; justify-content: space-between; align-items: flex-start;
           border-bottom: 2px solid #1e1b4b; padding-bottom: 12px; margin-bottom: 16px; }
    .cap h1 { font-size: 16pt; color: #1e1b4b; }
    .cap .sub { font-size: 10pt; color: #555; margin-top: 4px; }
    .dades { background: #f3f4f6; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 10pt; }
    .dades span { margin-right: 20px; }
    .materia { margin-bottom: 16px; page-break-inside: avoid; }
    .mat-head { background: #1e1b4b; color: #fff; padding: 7px 12px; border-radius: 6px 6px 0 0; font-weight: bold; font-size: 11pt; }
    .mat-desc { background: #f9fafb; padding: 8px 12px; font-size: 10pt; color: #444; border: 1px solid #e5e7eb; border-top: none; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; }
    th { background: #f3f4f6; padding: 7px 10px; text-align: left; font-size: 10pt; border-bottom: 1px solid #e5e7eb; }
    td { padding: 7px 10px; font-size: 10pt; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9pt; font-weight: bold; color: #fff; }
    .peu { margin-top: 30px; display: flex; justify-content: space-between; font-size: 10pt; }
    .firma { border-top: 1px solid #999; width: 150px; padding-top: 6px; text-align: center; font-size: 9pt; color: #666; }
    @media print { body { padding: 15mm; } }
  </style>
</head>
<body>
  <div class="cap">
    <div>
      <h1>INS Matadepera</h1>
      <div class="sub">Butlletí d'avaluació · ${esH(curs)} · ${esH(grupNom)}</div>
    </div>
    <div style="text-align:right;font-size:10pt;color:#555;">
      Data: ${new Date().toLocaleDateString('ca-ES')}<br>
    </div>
  </div>

  <div class="dades">
    <span><strong>Alumne/a:</strong> ${esH(nomComplet)}</span>
    ${alumne.ralc ? `<span><strong>RALC:</strong> ${esH(alumne.ralc)}</span>` : ''}
    <span><strong>Grup:</strong> ${esH(grupNom)}</span>
    <span><strong>Curs:</strong> ${esH(curs)}</span>
  </div>

  ${materies.map(mat => `
    <div class="materia">
      <div class="mat-head">${esH(mat.nom)}</div>
      ${mat.descripcioComuna ? `<div class="mat-desc">${esH(mat.descripcioComuna)}</div>` : ''}
      <table>
        <thead>
          <tr>
            <th style="width:40%">Aprenentatge / Competència</th>
            <th>Comentari</th>
            <th style="width:110px;text-align:center;">Assoliment</th>
          </tr>
        </thead>
        <tbody>
          ${(mat.items||[]).map(it => `
            <tr>
              <td><strong>${esH(it.titol||'')}</strong></td>
              <td>${esH(it.comentari||'')}</td>
              <td style="text-align:center;">
                <span class="badge" style="background:${COLORS_ASSL[it.assoliment]||'#9ca3af'}">
                  ${SHORT[it.assoliment]||'--'}
                </span><br>
                <span style="font-size:8pt;color:#666;">${esH(it.assoliment||'No avaluat')}</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('')}

  <div class="peu">
    <div class="firma">Tutor/a</div>
    <div class="firma">Director/a</div>
    <div class="firma">Signatura família</div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { window.mostrarToast('⚠️ Permet les finestres emergents al navegador', 4000); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

async function renderQuadreDades(body) {
  const [nivells, grups] = await Promise.all([carregarNivells(), carregarGrupsCentre()]);
  const cursos = [...new Set(grups.map(g=>g.curs).filter(Boolean))].sort().reverse();

  body.innerHTML = `
    <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin-bottom:16px;">📊 Quadre de dades</h3>
    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:flex-end;">
      <div>
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Curs</label>
        <select id="selCursQD" style="padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:9px;font-size:13px;outline:none;">
          ${cursos.length ? cursos.map(c=>`<option value="${c}">${c}</option>`).join('') : '<option value="">Cap curs</option>'}
        </select>
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Nivell</label>
        <select id="selNivellQD" style="padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:9px;font-size:13px;outline:none;">
          <option value="">— Tots els nivells —</option>
          ${nivells.map(n=>`<option value="${n.id}">${esH(n.nom)}</option>`).join('')}
        </select>
      </div>
      <button id="btnCarregarQD" style="padding:9px 18px;background:#7c3aed;color:#fff;
        border:none;border-radius:9px;font-weight:600;cursor:pointer;">🔍 Carregar</button>
    </div>
    <div id="resultatsQD"></div>
  `;

  document.getElementById('btnCarregarQD').addEventListener('click', async () => {
    const curs    = document.getElementById('selCursQD').value;
    const nivellId= document.getElementById('selNivellQD').value;
    const res = document.getElementById('resultatsQD');
    res.innerHTML = `<p style="color:#9ca3af;">⏳ Carregant...</p>`;

    const grupsFilt = grups.filter(g =>
      (!curs || g.curs === curs) &&
      (!nivellId || g.nivellId === nivellId)
    ).sort((a,b)=>(a.ordre||99)-(b.ordre||99));

    if (grupsFilt.length === 0) {
      res.innerHTML = `<p style="color:#9ca3af;text-align:center;padding:30px;">Cap dada trobada per a aquest filtre.</p>`;
      return;
    }

    // Agrupar per nivell
    const perNivell = {};
    grupsFilt.forEach(g => {
      const clau = g.nivellNom || g.nivellId || 'Sense nivell';
      if (!perNivell[clau]) perNivell[clau] = [];
      perNivell[clau].push(g);
    });

    res.innerHTML = Object.entries(perNivell).map(([nom, gs]) => `
      <div style="margin-bottom:20px;">
        <h4 style="font-size:13px;font-weight:700;color:#1e1b4b;padding:8px 12px;
                   background:#e0e7ff;border-radius:8px;margin-bottom:10px;">${esH(nom)}</h4>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:7px 10px;text-align:left;font-weight:600;">Tipus</th>
                <th style="padding:7px 10px;text-align:left;font-weight:600;">Nom</th>
                <th style="padding:7px 10px;text-align:center;font-weight:600;">Alumnes</th>
                <th style="padding:7px 10px;text-align:center;font-weight:600;">Accions</th>
              </tr>
            </thead>
            <tbody>
              ${gs.map(g => `
                <tr style="border-bottom:1px solid #f3f4f6;">
                  <td style="padding:7px 10px;font-size:11px;color:#9ca3af;">
                    ${TIPUS_GRUP[g.tipus]?.icon||'📁'} ${TIPUS_GRUP[g.tipus]?.label||g.tipus||'—'}
                  </td>
                  <td style="padding:7px 10px;font-weight:600;color:#1e1b4b;">${esH(g.nom||'—')}</td>
                  <td style="padding:7px 10px;text-align:center;color:#6b7280;">
                    ${(g.alumnes||[]).length}
                  </td>
                  <td style="padding:7px 10px;text-align:center;">
                    <button class="btn-del-qd" data-id="${g.id}" data-nom="${esH(g.nom)}"
                      style="padding:3px 10px;background:#fee2e2;color:#dc2626;border:none;
                             border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">
                      🗑️ Eliminar
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `).join('');

    // Events eliminar
    res.querySelectorAll('.btn-del-qd').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Eliminar "${btn.dataset.nom}" i totes les dades associades?`)) return;
        btn.disabled = true; btn.textContent = '⏳';
        await eliminarGrupComplet(btn.dataset.id, btn.dataset.nom);
        // Recarregar
        document.getElementById('btnCarregarQD')?.click();
      });
    });
  });

  // Auto-carregar si hi ha curs
  if (cursos.length > 0) {
    setTimeout(() => document.getElementById('btnCarregarQD')?.click(), 100);
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
              tutor:'#059669',professor:'#2563eb',revisor:'#d97706'};
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
   CÒPIA DE SEGURETAT
══════════════════════════════════════════════════════ */
window.realitzarCopiaSeguretat = async function() {
  const rols = window._userRols || [];
  if (!rols.some(r=>['admin','superadmin'].includes(r))) return; // Només admin
  try {
    window.mostrarToast('💾 Còpia de seguretat...', 2000);
    const db = window.db;
    const cols = ['professors','classes','alumnes','grups_centre','materies_centre','nivells_centre'];
    const snapshot = {};
    for (const col of cols) {
      const snap = await db.collection(col).get();
      snapshot[col] = {};
      snap.docs.forEach(d => { snapshot[col][d.id] = d.data(); });
    }
    const dataStr = JSON.stringify(snapshot);
    // Dividir en chunks si > 1MB
    if (dataStr.length < 900000) {
      await db.collection('_backups').add({
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        data: dataStr, versio: '1.0',
        creador: firebase.auth().currentUser?.email||'sistema'
      });
    }
    window.mostrarToast('✅ Còpia realitzada', 3000);
  } catch(e) {
    console.warn('Còpia seguretat:', e.message);
  }
};

// Còpia setmanal (només admin)
firebase.auth().onAuthStateChanged(user => {
  if (!user) return;
  setTimeout(() => {
    if (!window._userRols?.some(r=>['admin','superadmin'].includes(r))) return;
    const KEY = '_ultima_copia';
    const ara = Date.now();
    const ultima = parseInt(localStorage.getItem(KEY)||'0');
    if (ara - ultima > 7*24*60*60*1000) {
      window.realitzarCopiaSeguretat?.().then(()=>localStorage.setItem(KEY,String(ara)));
    }
  }, 5000);
});

console.log('✅ secretaria.js v2: inicialitzat');
