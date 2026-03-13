// secretaria.js — v2
// Panell de Secretaria complet: Nivells > Grups/Matèries/Projectes > Alumnes
// Gestió d'usuaris i rols
// Import d'alumnes via Excel

console.log('📁 secretaria.js carregat');

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

  body.innerHTML = `
    <div style="display:flex;gap:20px;height:100%;min-height:500px;">

      <!-- COLUMNA 1: NIVELLS -->
      <div style="width:200px;flex-shrink:0;display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <h3 style="font-size:13px;font-weight:700;color:#1e1b4b;margin:0;">Nivells</h3>
          <button id="btnNouNivell" style="background:#7c3aed;color:#fff;border:none;
            border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer;">+ Nou</button>
        </div>
        <div id="llista-nivells" style="display:flex;flex-direction:column;gap:6px;"></div>
      </div>

      <!-- SEPARADOR -->
      <div style="width:1px;background:#e5e7eb;flex-shrink:0;"></div>

      <!-- COLUMNA 2: GRUPS DEL NIVELL SELECCIONAT -->
      <div style="width:260px;flex-shrink:0;display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <h3 style="font-size:13px;font-weight:700;color:#1e1b4b;margin:0;" id="titol-grups-col">
            Grups
          </h3>
          <button id="btnNouGrup" style="background:#7c3aed;color:#fff;border:none;
            border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer;"
            disabled>+ Nou</button>
        </div>
        <div id="llista-grups-col" style="display:flex;flex-direction:column;gap:6px;">
          <p style="font-size:12px;color:#9ca3af;text-align:center;padding:20px 0;">
            Selecciona un nivell
          </p>
        </div>
      </div>

      <!-- SEPARADOR -->
      <div style="width:1px;background:#e5e7eb;flex-shrink:0;"></div>

      <!-- COLUMNA 3: ALUMNES DEL GRUP SELECCIONAT -->
      <div style="flex:1;display:flex;flex-direction:column;gap:10px;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:8px;">
          <h3 style="font-size:13px;font-weight:700;color:#1e1b4b;margin:0;" id="titol-alumnes-col">
            Alumnes
          </h3>
          <div style="display:flex;gap:6px;">
            <button id="btnNouAlumne" style="background:#7c3aed;color:#fff;border:none;
              border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer;"
              disabled>+ Alumne</button>
            <button id="btnImportarAlumnes" style="background:#059669;color:#fff;border:none;
              border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer;"
              disabled>📥 Excel</button>
          </div>
        </div>
        <div id="llista-alumnes-col" style="flex:1;overflow-y:auto;">
          <p style="font-size:12px;color:#9ca3af;text-align:center;padding:20px 0;">
            Selecciona un grup
          </p>
        </div>
      </div>
    </div>
  `;

  // Estat selecció
  let nivellActiu = null;
  let grupActiu = null;

  // Renderitzar nivells
  function renderNivells() {
    const cont = document.getElementById('llista-nivells');
    if (!cont) return;
    if (nivells.length === 0) {
      cont.innerHTML = `<p style="font-size:12px;color:#9ca3af;text-align:center;">Cap nivell</p>`;
      return;
    }
    cont.innerHTML = nivells.map(n => `
      <div class="nivell-item" data-id="${n.id}" style="
        padding:10px 12px;border-radius:10px;cursor:pointer;
        border:2px solid ${nivellActiu === n.id ? '#7c3aed' : '#e5e7eb'};
        background:${nivellActiu === n.id ? '#f5f3ff' : '#fff'};
        display:flex;justify-content:space-between;align-items:center;
        transition:all 0.15s;
      ">
        <div>
          <div style="font-weight:700;font-size:13px;color:#1e1b4b;">${esH(n.nom)}</div>
          <div style="font-size:11px;color:#9ca3af;">${esH(n.curs||'')} · ${(grupsPer[n.id]||[]).length} grups</div>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="btn-edit-niv" data-id="${n.id}"
            style="background:none;border:none;font-size:14px;cursor:pointer;padding:2px;">✏️</button>
          <button class="btn-del-niv" data-id="${n.id}" data-nom="${esH(n.nom)}"
            style="background:none;border:none;font-size:14px;cursor:pointer;padding:2px;">🗑️</button>
        </div>
      </div>
    `).join('');

    cont.querySelectorAll('.nivell-item').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        nivellActiu = el.dataset.id;
        grupActiu = null;
        renderNivells();
        renderGrups();
        renderAlumnes(null);
        document.getElementById('btnNouGrup').disabled = false;
        document.getElementById('titol-grups-col').textContent =
          nivells.find(n=>n.id===nivellActiu)?.nom || 'Grups';
      });
    });

    cont.querySelectorAll('.btn-edit-niv').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); modalNivell(nivells.find(n=>n.id===btn.dataset.id)); });
    });
    cont.querySelectorAll('.btn-del-niv').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm(`Eliminar el nivell "${btn.dataset.nom}" i tots els seus grups?`)) return;
        eliminarNivell(btn.dataset.id);
      });
    });
  }

  function renderGrups() {
    const cont = document.getElementById('llista-grups-col');
    if (!cont) return;
    if (!nivellActiu) {
      cont.innerHTML = `<p style="font-size:12px;color:#9ca3af;text-align:center;padding:20px 0;">Selecciona un nivell</p>`;
      return;
    }
    const grupsNivell = (grupsPer[nivellActiu] || []).sort((a,b)=>(a.ordre||99)-(b.ordre||99));
    if (grupsNivell.length === 0) {
      cont.innerHTML = `<p style="font-size:12px;color:#9ca3af;text-align:center;padding:20px 0;">Cap grup. Crea'n un!</p>`;
      return;
    }
    cont.innerHTML = grupsNivell.map(g => `
      <div class="grup-item" data-id="${g.id}" style="
        padding:10px 12px;border-radius:10px;cursor:pointer;
        border:2px solid ${grupActiu === g.id ? '#7c3aed' : '#e5e7eb'};
        background:${grupActiu === g.id ? '#f5f3ff' : '#fff'};
        display:flex;justify-content:space-between;align-items:center;
      ">
        <div>
          <div style="font-size:12px;color:#9ca3af;margin-bottom:2px;">
            ${TIPUS_GRUP[g.tipus]?.icon || '📁'} ${TIPUS_GRUP[g.tipus]?.label || g.tipus}
          </div>
          <div style="font-weight:700;font-size:13px;color:#1e1b4b;">${esH(g.nom)}</div>
          <div style="font-size:11px;color:#9ca3af;">${(g.alumnes||[]).length} alumnes</div>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="btn-edit-grp" data-id="${g.id}"
            style="background:none;border:none;font-size:14px;cursor:pointer;padding:2px;">✏️</button>
          <button class="btn-del-grp" data-id="${g.id}" data-nom="${esH(g.nom)}"
            style="background:none;border:none;font-size:14px;cursor:pointer;padding:2px;">🗑️</button>
        </div>
      </div>
    `).join('');

    cont.querySelectorAll('.grup-item').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        grupActiu = el.dataset.id;
        renderGrups();
        const g = grups.find(g=>g.id===grupActiu);
        document.getElementById('titol-alumnes-col').textContent = g?.nom || 'Alumnes';
        renderAlumnes(g);
        document.getElementById('btnNouAlumne').disabled = false;
        document.getElementById('btnImportarAlumnes').disabled = false;
      });
    });
    cont.querySelectorAll('.btn-edit-grp').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); modalGrup(grups.find(g=>g.id===btn.dataset.id)); });
    });
    cont.querySelectorAll('.btn-del-grp').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm(`Eliminar "${btn.dataset.nom}" i totes les classes associades?`)) return;
        eliminarGrupComplet(btn.dataset.id, btn.dataset.nom).then(() => {
          const idx = grups.findIndex(g=>g.id===btn.dataset.id);
          if (idx>=0) grups.splice(idx,1);
          Object.keys(grupsPer).forEach(k=>delete grupsPer[k]);
          grups.forEach(g=>{
            if(!grupsPer[g.nivellId]) grupsPer[g.nivellId]=[];
            grupsPer[g.nivellId].push(g);
          });
          if (grupActiu===btn.dataset.id) grupActiu=null;
          renderNivells();
          renderGrups();
          renderAlumnes(null);
        });
      });
    });
  }

  function renderAlumnes(grup) {
    const cont = document.getElementById('llista-alumnes-col');
    if (!cont) return;
    if (!grup) {
      cont.innerHTML = `<p style="font-size:12px;color:#9ca3af;text-align:center;padding:20px 0;">Selecciona un grup</p>`;
      return;
    }
    const alumnes = (grup.alumnes || []).sort((a,b)=>(a.cognoms||'').localeCompare(b.cognoms||''));
    if (alumnes.length === 0) {
      cont.innerHTML = `
        <div style="text-align:center;padding:30px;color:#9ca3af;">
          <div style="font-size:32px;margin-bottom:8px;">👤</div>
          Cap alumne. Afegeix-ne o importa des d'Excel.
        </div>`;
      return;
    }
    cont.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:6px 10px;text-align:left;font-weight:600;color:#374151;">#</th>
            <th style="padding:6px 10px;text-align:left;font-weight:600;color:#374151;">Cognoms, Nom</th>
            <th style="padding:6px 10px;text-align:left;font-weight:600;color:#374151;">RALC</th>
            <th style="padding:6px 10px;text-align:center;font-weight:600;color:#374151;">🗑️</th>
          </tr>
        </thead>
        <tbody>
          ${alumnes.map((a, i) => `
            <tr style="border-bottom:1px solid #f3f4f6;" data-alumne-idx="${grup.alumnes.indexOf(a)}">
              <td style="padding:6px 10px;color:#9ca3af;">${i+1}</td>
              <td style="padding:6px 10px;font-weight:600;color:#1e1b4b;">
                ${esH(a.cognoms ? a.cognoms+', '+a.nom : a.nom)}
              </td>
              <td style="padding:6px 10px;color:#6b7280;">${esH(a.ralc||'—')}</td>
              <td style="padding:6px 10px;text-align:center;">
                <div style="display:flex;gap:4px;justify-content:center;">
                  <button class="btn-edit-alumne"
                    data-idx="${grup.alumnes.indexOf(a)}"
                    style="background:none;border:none;color:#2563eb;cursor:pointer;font-size:14px;"
                    title="Editar">✏️</button>
                  <button class="btn-del-alumne" data-nom="${esH(a.nom)}"
                    data-idx="${grup.alumnes.indexOf(a)}"
                    style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;"
                    title="Eliminar">🗑️</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="padding:10px;font-size:12px;color:#9ca3af;text-align:right;">
        Total: ${alumnes.length} alumnes
      </div>
    `;

    cont.querySelectorAll('.btn-edit-alumne').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        modalEditarAlumne(grup, idx, () => renderAlumnes(grup));
      });
    });
    cont.querySelectorAll('.btn-del-alumne').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Eliminar "${btn.dataset.nom}"?`)) return;
        const idx = parseInt(btn.dataset.idx);
        const nous = [...grup.alumnes];
        nous.splice(idx, 1);
        await window.db.collection('grups_centre').doc(grup.id).update({ alumnes: nous });
        grup.alumnes = nous;
        renderAlumnes(grup);
        window.mostrarToast('🗑️ Alumne eliminat');
      });
    });
  }

  // Botó nou nivell
  document.getElementById('btnNouNivell').addEventListener('click', () => modalNivell());
  document.getElementById('btnNouGrup').addEventListener('click', () => {
    if (!nivellActiu) return;
    modalGrup(null, nivellActiu, nivells.find(n=>n.id===nivellActiu));
  });
  document.getElementById('btnNouAlumne').addEventListener('click', () => {
    if (!grupActiu) return;
    const g = grups.find(g=>g.id===grupActiu);
    if (g) modalAlumne(g, renderAlumnes);
  });
  document.getElementById('btnImportarAlumnes').addEventListener('click', () => {
    if (!grupActiu) return;
    const g = grups.find(g=>g.id===grupActiu);
    if (g) modalImportExcel(g, () => {
      renderGrups();
      renderAlumnes(grups.find(g2=>g2.id===grupActiu));
    });
  });

  // Callbacks de modals (actualitzen l'estat local)
  window._secOnNivellCreat = async () => {
    const nous = await carregarNivells();
    nivells.length = 0; nous.forEach(n => nivells.push(n));
    renderNivells();
  };
  window._secOnGrupCreat = async () => {
    const nousg = await carregarGrupsCentre();
    grups.length = 0; nousg.forEach(g => grups.push(g));
    Object.keys(grupsPer).forEach(k => delete grupsPer[k]);
    grups.forEach(g => {
      if (!grupsPer[g.nivellId]) grupsPer[g.nivellId] = [];
      grupsPer[g.nivellId].push(g);
    });
    renderNivells();   // ← actualitza comptadors de grups per nivell
    renderGrups();     // ← actualitza la columna de grups
  };

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
      <input id="inpNivCurs" type="text" value="${esH(existent?.curs||'2024-25')}" placeholder="2024-25"
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
  body.innerHTML = `
    <div style="text-align:center;padding:60px;color:#9ca3af;">
      <div style="font-size:48px;margin-bottom:12px;">📄</div>
      <h3 style="margin-bottom:8px;color:#374151;">Butlletins</h3>
      <p style="font-size:13px;">Per generar butlletins, primer els professors han d'afegir les avaluacions.<br>
      Disponible quan hi hagi dades a l'Avaluació Centre.</p>
    </div>
  `;
}

async function renderQuadreDades(body) {
  const [nivells, grups] = await Promise.all([carregarNivells(), carregarGrupsCentre()]);
  const cursos = [...new Set(grups.map(g=>g.curs).filter(Boolean))].sort().reverse();

  body.innerHTML = `
    <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin-bottom:16px;">📊 Quadre de dades</h3>
    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
      <select id="selCursQD" style="padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:9px;font-size:13px;outline:none;">
        ${cursos.map(c=>`<option value="${c}">${c}</option>`).join('')}
      </select>
      <select id="selNivellQD" style="padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:9px;font-size:13px;outline:none;">
        <option value="">— Tots els nivells —</option>
        ${nivells.map(n=>`<option value="${n.id}">${n.nom}</option>`).join('')}
      </select>
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
    );

    if (grupsFilt.length === 0) {
      res.innerHTML = `<p style="color:#9ca3af;text-align:center;padding:30px;">Cap dada trobada</p>`;
      return;
    }

    // Agrupar per nivell
    const perNivell = {};
    grupsFilt.forEach(g => {
      if (!perNivell[g.nivellNom||g.nivellId]) perNivell[g.nivellNom||g.nivellId] = [];
      perNivell[g.nivellNom||g.nivellId].push(g);
    });

    res.innerHTML = Object.entries(perNivell).map(([nom, gs]) => `
      <div style="margin-bottom:20px;">
        <h4 style="font-size:13px;font-weight:700;color:#1e1b4b;padding:8px 12px;
                   background:#e0e7ff;border-radius:8px;margin-bottom:10px;">${esH(nom)}</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">
          ${gs.map(g => `
            <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:10px;padding:14px;">
              <div style="font-size:11px;color:#9ca3af;">${TIPUS_GRUP[g.tipus]?.icon||'📁'} ${TIPUS_GRUP[g.tipus]?.label||g.tipus}</div>
              <div style="font-weight:700;color:#1e1b4b;margin:4px 0;">${esH(g.nom)}</div>
              <div style="font-size:12px;color:#6b7280;">${(g.alumnes||[]).length} alumnes</div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  });
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
