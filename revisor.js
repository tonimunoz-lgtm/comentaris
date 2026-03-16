// revisor.js
// Panell de Revisió — UltraComentator / INS Matadepera
// Rol revisor: pot consultar i editar les dades dels cursos assignats

console.log('🔍 revisor.js carregat');

/* ══════════════════════════════════════════════════════
   INJECTAR BOTÓ REVISIÓ AL SIDEBAR
══════════════════════════════════════════════════════ */
window.injectarBotoRevisor = function() {
  if (document.getElementById('btnRevisorSidebar')) return;

  const nav = document.querySelector('.sidebar-nav') || document.querySelector('#sidebar nav');
  if (!nav) return;

  const btn = document.createElement('button');
  btn.id = 'btnRevisorSidebar';
  btn.className = 'nav-item';
  btn.dataset.screen = 'revisio';
  btn.innerHTML = `<span class="nav-icon">🔍</span><span>Revisió</span>`;
  btn.addEventListener('click', obrirPanellRevisio);
  nav.appendChild(btn);
};

/* ══════════════════════════════════════════════════════
   LLEGIR PERMISOS DEL REVISOR
══════════════════════════════════════════════════════ */
async function llegirPermisosRevisor() {
  const uid = firebase.auth().currentUser?.uid;
  if (!uid) return { nivells: [], cursos: [], grups: [], materies: [], totsNivells: false };

  try {
    const doc = await window.db.collection('professors').doc(uid).get();
    const data = doc.data() || {};

    // Suport nou camp revisio_nivells + camp llegat revisio_cursos/grups
    const nivells = data.revisio_nivells || [];
    const totsNivells = data.revisio_tot || nivells.includes('_tot') ||
                        window.teRol?.('admin') || window.teRol?.('superadmin') || false;

    return {
      nivells:     nivells.filter(n => n !== '_tot'),
      cursos:      data.revisio_cursos   || [],
      grups:       data.revisio_grups    || [],
      materies:    data.revisio_materies || [],
      totsNivells
    };
  } catch (e) {
    return { nivells: [], cursos: [], grups: [], materies: [], totsNivells: false };
  }
}

/* ══════════════════════════════════════════════════════
   PANELL PRINCIPAL REVISIÓ
══════════════════════════════════════════════════════ */
async function obrirPanellRevisio() {
  document.getElementById('panellRevisio')?.remove();

  const [permisos, materies, grups] = await Promise.all([
    llegirPermisosRevisor(),
    carregarMateriesCentre(),
    carregarGrupsCentre()
  ]);

  // Filtrar grups i matèries per permisos
  const grupsPermesos = permisos.totsNivells
    ? grups
    : grups.filter(g =>
        permisos.grups.includes(g.id) ||
        permisos.cursos.some(c => g.curs === c) ||
        permisos.nivells.some(nId => g.nivellId === nId)
      );

  const materiesesPermeses = permisos.totsNivells
    ? materies
    : permisos.materies.length > 0
      ? materies.filter(m => permisos.materies.includes(m.id))
      : materies;

  const cursos = [...new Set(grupsPermesos.map(g => g.curs))].sort();

  if (cursos.length === 0 && !permisos.totsNivells) {
    window.mostrarToast('⚠️ No tens cap curs o grup assignat per revisar. Contacta amb l\'administrador.', 5000);
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'panellRevisio';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:8888;background:rgba(15,23,42,0.7);
    display:flex;align-items:stretch;justify-content:flex-end;
  `;

  overlay.innerHTML = `
    <div style="
      width:min(1000px,100%);background:#fff;
      display:flex;flex-direction:column;overflow:hidden;
      box-shadow:-20px 0 60px rgba(0,0,0,0.3);
    ">
      <!-- HEADER -->
      <div style="
        background:linear-gradient(135deg,#164e63,#0891b2);
        color:#fff;padding:22px 28px;flex-shrink:0;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h2 style="font-size:20px;font-weight:800;margin:0;">🔍 Panell de Revisió</h2>
            <p style="font-size:13px;opacity:0.75;margin:4px 0 0;">
              ${permisos.totsNivells
                ? 'Accés total a tots els cursos'
                : `Cursos assignats: ${cursos.join(', ') || '—'}`}
            </p>
          </div>
          <button id="btnTancarRevisio" style="
            background:rgba(255,255,255,0.2);border:none;color:#fff;
            width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer;
          ">✕</button>
        </div>

        <!-- Filtres -->
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
                    <select id="selCursRevisio" style="
            padding:7px 12px;border-radius:8px;border:none;
            font-size:13px;background:rgba(255,255,255,0.2);color:#fff;outline:none;
          ">
            <option value="">— Selecciona curs —</option>
            ${cursos.map(c => `<option value="${c}" ${c === window._cursActiu ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <select id="selMateriaRevisio" style="
            padding:7px 12px;border-radius:8px;border:none;
            font-size:13px;background:rgba(255,255,255,0.2);color:#fff;outline:none;
          ">
            <option value="">— Totes les matèries —</option>
            ${materiesesPermeses.map(m => `<option value="${m.id}">${m.nom}</option>`).join('')}
          </select>
          <select id="selGrupRevisio" style="
            padding:7px 12px;border-radius:8px;border:none;
            font-size:13px;background:rgba(255,255,255,0.2);color:#fff;outline:none;
          ">
            <option value="">— Tots els grups —</option>
            ${grupsPermesos.map(g => `<option value="${g.id}">${g.nom}</option>`).join('')}
          </select>
          <button id="btnCarregarRevisio" style="
            padding:7px 16px;background:rgba(255,255,255,0.25);
            border:1.5px solid rgba(255,255,255,0.5);color:#fff;
            border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
          ">🔍 Carregar</button>
        </div>
      </div>

      <!-- CONTINGUT -->
      <div id="revisioContent" style="flex:1;overflow-y:auto;padding:24px;">
        <div style="text-align:center;padding:60px;color:#9ca3af;">
          <div style="font-size:36px;margin-bottom:12px;">🔍</div>
          Selecciona els filtres i clica Carregar per veure les dades
        </div>
      </div>
    </div>
  `;

   document.body.appendChild(overlay);

  // Auto-cargar si hay curs preseleccionado
  if (window._cursActiu && cursos.includes(window._cursActiu)) {
    setTimeout(() => {
      overlay.querySelector('#btnCarregarRevisio').click();
    }, 100);
  }

  overlay.querySelector('#btnTancarRevisio').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#btnCarregarRevisio').addEventListener('click', async () => {
    const curs    = overlay.querySelector('#selCursRevisio').value;
    const matId   = overlay.querySelector('#selMateriaRevisio').value;
    const grupId  = overlay.querySelector('#selGrupRevisio').value;
    await carregarDadesRevisio(curs, matId, grupId, materiesesPermeses, grupsPermesos);
  });
}

/* ══════════════════════════════════════════════════════
   CARREGAR DADES PER REVISAR
══════════════════════════════════════════════════════ */
async function carregarDadesRevisio(curs, matId, grupId, materies, grups) {
  const content = document.getElementById('revisioContent');
  if (!content) return;

  content.innerHTML = `<div style="color:#9ca3af;padding:20px;">⏳ Carregant dades...</div>`;

  try {
    const materiesToShow = matId
      ? materies.filter(m => m.id === matId)
      : materies;

    const cursFiltrat = curs || '';

    let html = '';
    let totalRegistres = 0;

    // Si no hay curs seleccionado, mostrar mensaje y salir
    if (!cursFiltrat) {
      content.innerHTML = `
        <div style="text-align:center;padding:40px;color:#9ca3af;background:#f9fafb;border-radius:12px;">
          <div style="font-size:36px;margin-bottom:12px;">📅</div>
          Selecciona un curs acadèmic per carregar les dades
        </div>
      `;
      return;
    }

    const cursosALlegir = [cursFiltrat];

    for (const cursActual of cursosALlegir) {
      for (const mat of materiesToShow) {
        let query = window.db
          .collection('avaluacio_centre')
          .doc(cursActual)
          .collection(mat.id);

        if (grupId) {
          query = query.where('grupClasseId', '==', grupId);
        }

        let dades = [];
        try {
          const snap = await query.get();
          dades = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
          if (grupId) {
            try {
              const snap2 = await window.db
                .collection('avaluacio_centre')
                .doc(cursActual)
                .collection(mat.id)
                .where('grupId', '==', grupId)
                .get();
              dades = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e2) {
              // Silenciar
            }
          }
        }
        
        if (dades.length === 0) continue;
        
        totalRegistres += dades.length;
        
        dades.sort((a, b) => {
          const gA = a.grup || '', gB = b.grup || '';
          if (gA !== gB) return gA.localeCompare(gB);
          return (a.cognoms || '').localeCompare(b.cognoms || '');
        });

        const maxItems = Math.max(...dades.map(a => (a.items || []).length), 0);

        html += `
          <div style="margin-bottom:28px;">
            <div style="
              display:flex;justify-content:space-between;align-items:center;
              padding:10px 14px;background:#e0f2fe;border-radius:10px;margin-bottom:12px;
            ">
              <h4 style="font-size:14px;font-weight:700;color:#0c4a6e;margin:0;">
                📚 ${escapeHtml(mat.nom)}
              </h4>
              <span style="font-size:12px;color:#0369a1;">${dades.length} alumnes</span>
            </div>

            <div style="overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:600px;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="padding:8px 12px;text-align:left;font-weight:700;color:#475569;border-bottom:2px solid #e2e8f0;">Alumne/a</th>
                    <th style="padding:8px 12px;text-align:left;font-weight:700;color:#475569;border-bottom:2px solid #e2e8f0;">Grup</th>
                    ${Array.from({length: maxItems}, (_, i) => `
                      <th style="padding:8px 12px;text-align:center;font-weight:700;color:#475569;border-bottom:2px solid #e2e8f0;">Ítem ${i+1}</th>
                    `).join('')}
                    <th style="padding:8px 12px;text-align:center;font-weight:700;color:#475569;border-bottom:2px solid #e2e8f0;">Accions</th>
                  </tr>
                </thead>
                <tbody>
                  ${dades.map((alumne, idx) => `
                    <tr style="border-bottom:1px solid #f1f5f9;${idx % 2 === 0 ? 'background:#fff;' : 'background:#fafbfc;'}">
                      <td style="padding:10px 12px;font-weight:600;color:#1e293b;">
                        ${escapeHtml(alumne.cognoms ? `${alumne.cognoms}, ${alumne.nom}` : alumne.nom)}
                      </td>
                      <td style="padding:10px 12px;color:#64748b;">${escapeHtml(alumne.grup || '—')}</td>
                      ${Array.from({length: maxItems}, (_, i) => {
                        const item = (alumne.items || [])[i];
                        const COLORS_SHORT = {
                          'Assoliment Excel·lent':   { bg:'#22c55e', s:'AE' },
                          'Assoliment Notable':      { bg:'#84cc16', s:'AN' },
                          'Assoliment Satisfactori': { bg:'#f59e0b', s:'AS' },
                          'No Assoliment':           { bg:'#ef4444', s:'NA' },
                          'No avaluat':              { bg:'#9ca3af', s:'--' }
                        };
                        const c = item ? (COLORS_SHORT[item.assoliment] || COLORS_SHORT['No avaluat']) : null;
                        return `<td style="padding:10px 12px;text-align:center;">
                          ${item ? `
                            <span title="${escapeHtml((item.titol||'') + ' — ' + (item.comentari||''))}"
                              style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;color:#fff;background:${c.bg};cursor:help;">
                              ${c.s}
                            </span>
                          ` : '<span style="color:#e2e8f0;">—</span>'}
                        </td>`;
                      }).join('')}
                      <td style="padding:10px 12px;text-align:center;">
                        <button class="btn-editar-revisio"
                          data-id="${alumne.id}"
                          data-matid="${mat.id}"
                          data-curs="${cursFiltrat}"
                          style="padding:4px 12px;background:#0891b2;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } // ← CIERRE del for (const mat of materiesToShow)
    } // ← CIERRE del for (const cursActual of cursosALlegir)

    content.innerHTML = html || `
      <div style="text-align:center;padding:40px;color:#9ca3af;background:#f9fafb;border-radius:12px;">
        No s'han trobat dades per a la selecció realitzada
      </div>
    `;

    content.querySelectorAll('.btn-editar-revisio').forEach(btn => {
      btn.addEventListener('click', async () => {
        const alumneId = btn.dataset.id;
        const matId2   = btn.dataset.matid;
        const curs2    = btn.dataset.curs;
        await obrirEditorRevisio(alumneId, matId2, curs2, materies);
      });
    });

  } catch (e) {
    content.innerHTML = `<div style="color:#ef4444;padding:20px;">Error: ${e.message}</div>`;
  }
}

/* ══════════════════════════════════════════════════════
   EDITOR DE REVISIÓ (editar ítems d'un alumne)
══════════════════════════════════════════════════════ */
async function obrirEditorRevisio(alumneId, matId, curs, materies) {
  document.getElementById('modalEditorRevisio')?.remove();

  let dades;
  try {
    const doc = await window.db
      .collection('avaluacio_centre')
      .doc(curs)
      .collection(matId)
      .doc(alumneId)
      .get();
    dades = doc.exists ? doc.data() : null;
  } catch (e) {
    window.mostrarToast('❌ Error llegint dades: ' + e.message);
    return;
  }

  if (!dades) {
    window.mostrarToast('⚠️ No s\'han trobat dades');
    return;
  }

  const mat = materies.find(m => m.id === matId);
  const ASSOLIMENTS = [
    'Assoliment Excel·lent',
    'Assoliment Notable',
    'Assoliment Satisfactori',
    'No Assoliment',
    'No avaluat'
  ];

  const modal = document.createElement('div');
  modal.id = 'modalEditorRevisio';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;

  const items = dades.items || [];

  modal.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px;width:100%;max-width:680px;
                max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div>
          <h3 style="font-size:17px;font-weight:800;color:#1e1b4b;margin:0;">
            ✏️ Editar registre
          </h3>
          <p style="font-size:13px;color:#9ca3af;margin:4px 0 0;">
            ${escapeHtml(dades.cognoms ? `${dades.cognoms}, ${dades.nom}` : dades.nom || alumneId)}
            · ${escapeHtml(mat?.nom || matId)}
          </p>
        </div>
        <button id="btnTancarEditorRev" style="background:none;border:none;font-size:22px;cursor:pointer;">✕</button>
      </div>

      <!-- Descripció comuna -->
      <div style="margin-bottom:16px;">
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
          Descripció comuna</label>
        <textarea id="editDescComuna" rows="3"
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
                 border-radius:10px;font-size:13px;outline:none;resize:vertical;font-family:inherit;"
        >${escapeHtml(dades.descripcioComuna || '')}</textarea>
      </div>

      <!-- Ítems -->
      <div style="margin-bottom:20px;">
        <h4 style="font-size:13px;font-weight:700;color:#374151;margin-bottom:12px;">Ítems</h4>
        <div id="editorItemsRev">
          ${items.map((item, idx) => `
            <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;
                        padding:14px;margin-bottom:10px;">
              <div style="margin-bottom:8px;">
                <label style="font-size:11px;font-weight:600;color:#9ca3af;">TÍTOL</label>
                <input class="edit-item-titol" data-idx="${idx}" type="text"
                  value="${escapeHtml(item.titol || '')}"
                  style="width:100%;box-sizing:border-box;padding:7px 10px;margin-top:4px;
                         border:1px solid #d1d5db;border-radius:8px;font-size:13px;
                         outline:none;font-family:inherit;">
              </div>
              <div style="margin-bottom:8px;">
                <label style="font-size:11px;font-weight:600;color:#9ca3af;">COMENTARI</label>
                <textarea class="edit-item-com" data-idx="${idx}" rows="2"
                  style="width:100%;box-sizing:border-box;padding:7px 10px;margin-top:4px;
                         border:1px solid #d1d5db;border-radius:8px;font-size:13px;
                         outline:none;resize:vertical;font-family:inherit;"
                >${escapeHtml(item.comentari || '')}</textarea>
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:#9ca3af;">ASSOLIMENT</label>
                <select class="edit-item-ass" data-idx="${idx}"
                  style="width:100%;padding:7px 10px;margin-top:4px;border:1px solid #d1d5db;
                         border-radius:8px;font-size:13px;outline:none;background:#fff;">
                  ${ASSOLIMENTS.map(a => `
                    <option value="${a}" ${a === item.assoliment ? 'selected' : ''}>${a}</option>
                  `).join('')}
                </select>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="btnCancelEditorRev" style="
          padding:10px 20px;background:#f3f4f6;border:none;
          border-radius:10px;font-weight:600;cursor:pointer;">Cancel·lar</button>
        <button id="btnGuardarEditorRev" style="
          padding:10px 24px;background:#0891b2;color:#fff;border:none;
          border-radius:10px;font-weight:700;cursor:pointer;">💾 Guardar canvis</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('#btnTancarEditorRev').addEventListener('click', () => modal.remove());
  modal.querySelector('#btnCancelEditorRev').addEventListener('click', () => modal.remove());

  modal.querySelector('#btnGuardarEditorRev').addEventListener('click', async () => {
    const descComuna = modal.querySelector('#editDescComuna').value.trim();
    const nouItems = items.map((_, idx) => ({
      titol:      modal.querySelector(`.edit-item-titol[data-idx="${idx}"]`)?.value?.trim() || '',
      comentari:  modal.querySelector(`.edit-item-com[data-idx="${idx}"]`)?.value?.trim() || '',
      assoliment: modal.querySelector(`.edit-item-ass[data-idx="${idx}"]`)?.value || 'No avaluat'
    }));

    try {
      await window.db
        .collection('avaluacio_centre')
        .doc(curs)
        .collection(matId)
        .doc(alumneId)
        .update({
          descripcioComuna: descComuna,
          items: nouItems,
          revisatPer: firebase.auth().currentUser?.email || '',
          revisatAt: firebase.firestore.FieldValue.serverTimestamp()
        });

      window.mostrarToast('✅ Canvis guardats correctament');
      modal.remove();
    } catch (e) {
      window.mostrarToast('❌ Error guardant: ' + e.message);
    }
  });
}

/* ══════════════════════════════════════════════════════
   UTILITATS
══════════════════════════════════════════════════════ */
async function carregarMateriesCentre() {
  try {
    // Las materias están en grups_centre con tipus = 'materia', 'projecte', 'optativa' o 'tutoria'
    const snap = await window.db.collection('grups_centre')
      .where('tipus', 'in', ['materia', 'projecte', 'optativa', 'tutoria'])
      .orderBy('ordre')
      .get();
    const totes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // DEDUPLICAR: solo una entrada por nombre único de materia
    const vistes = new Set();
    const uniques = [];
    for (const m of totes) {
      const nomNormalitzat = (m.nom || '').toLowerCase().trim();
      if (nomNormalitzat && !vistes.has(nomNormalitzat)) {
        vistes.add(nomNormalitzat);
        uniques.push(m);
      }
    }
    // Ordenar alfabéticamente
    uniques.sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'ca'));
    return uniques;
  } catch (e) { 
    // Fallback sin ordenar si no hay índice compuesto
    try {
      const snap = await window.db.collection('grups_centre').get();
      const totes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(g => ['materia', 'projecte', 'optativa', 'tutoria'].includes(g.tipus))
        .sort((a, b) => (a.ordre || 99) - (b.ordre || 99));
      // DEDUPLICAR también en el fallback
      const vistes = new Set();
      const uniques = [];
      for (const m of totes) {
        const nomNormalitzat = (m.nom || '').toLowerCase().trim();
        if (nomNormalitzat && !vistes.has(nomNormalitzat)) {
          vistes.add(nomNormalitzat);
          uniques.push(m);
        }
      }
      uniques.sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'ca'));
      return uniques;
    } catch (e2) {
      return []; 
    }
  }
}

async function carregarGrupsCentre() {
  try {
    const snap = await window.db.collection('grups_centre').orderBy('ordre').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

console.log('✅ revisor.js: inicialitzat');

// Exportar funcions principals
window.obrirPanellRevisio = obrirPanellRevisio;
