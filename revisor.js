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
      display:flex;flex-direction:column;
      height:100vh;max-height:100vh;
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
            font-size:13px;background:#fff;color:#1e293b;outline:none;
          ">
            <option value="">— Selecciona curs —</option>
            ${cursos.map(c => `<option value="${c}" ${c === window._cursActiu ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          
          <select id="selNivellRevisio" style="
            padding:7px 12px;border-radius:8px;border:none;
            font-size:13px;background:#fff;color:#1e293b;outline:none;
          " disabled>
            <option value="">— Tria nivell —</option>
          </select>
          
          <select id="selGrupRevisio" style="
            padding:7px 12px;border-radius:8px;border:none;
            font-size:13px;background:#fff;color:#1e293b;outline:none;
          " disabled>
            <option value="">— Tria grup —</option>
          </select>
          
          <select id="selMateriaRevisio" style="
            padding:7px 12px;border-radius:8px;border:none;
            font-size:13px;background:#fff;color:#1e293b;outline:none;
          " disabled>
            <option value="">— Tria matèria —</option>
          </select>
          
          <button id="btnCarregarRevisio" style="
            padding:7px 16px;background:rgba(255,255,255,0.25);
            border:1.5px solid rgba(255,255,255,0.5);color:#fff;
            border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
          ">🔍 Carregar</button>
        </div>
      </div>

      <!-- CONTINGUT CON SCROLL -->
      <div id="revisioContent" style="
        flex:1;
        overflow-y:auto;
        padding:24px;
        min-height:0;
      ">
        <div style="text-align:center;padding:60px;color:#9ca3af;">
          <div style="font-size:36px;margin-bottom:12px;">🔍</div>
          Selecciona els filtres i clica Carregar per veure les dades
        </div>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

  // === LÓGICA DE FILTROS DEPENDIENTES ===
  
  // Extraer nivells únicos de los grupos permitidos
  const nivellsUnics = [...new Map(grupsPermesos.map(g => [g.nivellId, { id: g.nivellId, nom: g.nivellNom || g.nivellId }])).values()]
    .filter(n => n.id)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'ca'));

  // Función para actualizar nivells según curs
  const actualitzarNivells = (cursSeleccionat) => {
    const selNivell = overlay.querySelector('#selNivellRevisio');
    const selGrup = overlay.querySelector('#selGrupRevisio');
    const selMateria = overlay.querySelector('#selMateriaRevisio');
    
    if (!cursSeleccionat) {
      selNivell.innerHTML = '<option value="">— Tria nivell —</option>';
      selNivell.disabled = true;
      selGrup.innerHTML = '<option value="">— Tria grup —</option>';
      selGrup.disabled = true;
      selMateria.innerHTML = '<option value="">— Tria matèria —</option>';
      selMateria.disabled = true;
      return;
    }
    
    // Filtrar nivells que tienen grupos en este curs
    const nivellsDelCurs = nivellsUnics.filter(n => 
      grupsPermesos.some(g => g.nivellId === n.id && g.curs === cursSeleccionat)
    );
    
    selNivell.innerHTML = '<option value="">— Tria nivell —</option>' +
      nivellsDelCurs.map(n => `<option value="${n.id}">${escapeHtml(n.nom)}</option>`).join('');
    selNivell.disabled = false;
    
    // Resetear grupos y materias
    selGrup.innerHTML = '<option value="">— Tria grup —</option>';
    selGrup.disabled = true;
    selMateria.innerHTML = '<option value="">— Tria matèria —</option>';
    selMateria.disabled = true;
  };

  // Función para actualizar grups según nivell
  const actualitzarGrups = (cursSeleccionat, nivellId) => {
    const selGrup = overlay.querySelector('#selGrupRevisio');
    const selMateria = overlay.querySelector('#selMateriaRevisio');
    
    if (!nivellId) {
      selGrup.innerHTML = '<option value="">— Tria grup —</option>';
      selGrup.disabled = true;
      selMateria.innerHTML = '<option value="">— Tria matèria —</option>';
      selMateria.disabled = true;
      return;
    }
    
    // Filtrar grupos de este nivell y curs (solo grupos clase)
    const grupsDelNivell = grupsPermesos.filter(g => 
      g.nivellId === nivellId && 
      g.curs === cursSeleccionat &&
      g.tipus === 'classe'
    ).sort((a, b) => (a.ordre || 99) - (b.ordre || 99));
    
    selGrup.innerHTML = '<option value="">— Tria grup —</option>' +
      grupsDelNivell.map(g => `<option value="${g.id}">${escapeHtml(g.nom)}</option>`).join('');
    selGrup.disabled = false;
    
    // Guardar referencia para usar en materias
    selGrup._grupsDisponibles = grupsDelNivell;
    
    // Resetear materias
    selMateria.innerHTML = '<option value="">— Tria matèria —</option>';
    selMateria.disabled = true;
  };

    // Función para actualizar materias según grup
  const actualitzarMateries = async (grupId) => {
    const selMateria = overlay.querySelector('#selMateriaRevisio');
    
    if (!grupId) {
      selMateria.innerHTML = '<option value="">— Tria matèria —</option>';
      selMateria.disabled = true;
      return;
    }
    
    // OBTENER GRUP CLASE (si es tutoria, obtener padre)
    let grupClasseId = grupId;
    try {
      const grupDoc = await window.db.collection('grups_centre').doc(grupId).get();
      if (grupDoc.exists && grupDoc.data().parentGrupId) {
        grupClasseId = grupDoc.data().parentGrupId;
      }
    } catch(e) {}
    
    // Buscar materias con parentGrupId = grupClasseId
    let materiesDelGrup = [];
    try {
      const snap = await window.db.collection('grups_centre')
        .where('parentGrupId', '==', grupClasseId)
        .where('tipus', 'in', ['materia', 'projecte', 'optativa'])
        .get();
      materiesDelGrup = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      // Fallback: usar materiesesPermeses filtradas manualmente
      materiesDelGrup = materiesesPermeses.filter(m => m.parentGrupId === grupClasseId);
    }
    
    // Si no hay, mostrar TODAS las materias permitidas (para no bloquear)
    const materiesMostrar = materiesDelGrup.length > 0 ? materiesDelGrup : materiesesPermeses;
    
    // Guardar para usar luego en carregarDadesRevisio
    window._materiesRevisioActual = materiesMostrar;
    
    selMateria.innerHTML = '<option value="">— Totes les matèries —</option>' +
      materiesMostrar.map(m => `<option value="${m.id}">${escapeHtml(m.nom || m.id)}</option>`).join('');
    selMateria.disabled = false;
  };

  // Event listeners para los selects
  overlay.querySelector('#selCursRevisio').addEventListener('change', (e) => {
    actualitzarNivells(e.target.value);
  });
  
  overlay.querySelector('#selNivellRevisio').addEventListener('change', (e) => {
    const curs = overlay.querySelector('#selCursRevisio').value;
    actualitzarGrups(curs, e.target.value);
  });
  
  overlay.querySelector('#selGrupRevisio').addEventListener('change', (e) => {
    actualitzarMateries(e.target.value);
  });

  // Auto-cargar si hay curs preseleccionado
  if (window._cursActiu && cursos.includes(window._cursActiu)) {
    actualitzarNivells(window._cursActiu);
    setTimeout(() => {
      // Solo auto-cargar si también hay nivell seleccionado automáticamente
      const selNivell = overlay.querySelector('#selNivellRevisio');
      if (selNivell.options.length === 2) { // Solo 1 nivell disponible
        selNivell.selectedIndex = 1;
        actualitzarGrups(window._cursActiu, selNivell.value);
        setTimeout(() => {
          const selGrup = overlay.querySelector('#selGrupRevisio');
          if (selGrup.options.length === 2) { // Solo 1 grup disponible
            selGrup.selectedIndex = 1;
            actualitzarMateries(selGrup.value);
          }
        }, 50);
      }
    }, 50);
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
   - Lee las materias del grupo seleccionado (como tutoria-nova.js)
   - Muestra solo el último período enviado de cada materia
══════════════════════════════════════════════════════ */
async function carregarDadesRevisio(curs, matId, grupId, materies, grups) {
  const content = document.getElementById('revisioContent');
  if (!content) return;

  // Si no hay curs o grupo, mostrar mensaje
  if (!curs || !grupId) {
    content.innerHTML = `
      <div style="text-align:center;padding:40px;color:#9ca3af;background:#f9fafb;border-radius:12px;">
        <div style="font-size:36px;margin-bottom:12px;">📋</div>
        Selecciona un curs i un grup per veure les dades
      </div>
    `;
    return;
  }

  content.innerHTML = `<div style="color:#9ca3af;padding:20px;">⏳ Carregant dades...</div>`;

  try {
    const db = window.db;
    
    // 1. OBTENER EL GRUP CLASE (si es tutoria, obtener el padre)
    let grupDoc = await db.collection('grups_centre').doc(grupId).get();
    let grupClasseId = grupId;
    let grupData = grupDoc.exists ? grupDoc.data() : null;
    
    if (grupData?.parentGrupId) {
      grupClasseId = grupData.parentGrupId;
    }

    // 2. OBTENER LAS MATERIAS DE ESTE GRUPO (como hace tutoria-nova.js)
    let materiesDelGrup = [];
    
    // Buscar materias con parentGrupId = grupClasseId
    const snapMateries = await db.collection('grups_centre')
      .where('parentGrupId', '==', grupClasseId)
      .get();
    materiesDelGrup = snapMateries.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(m => m.tipus !== 'tutoria');

    // Si no hay, intentar buscar por curs (fallback)
    if (materiesDelGrup.length === 0) {
      const snapAll = await db.collection('grups_centre').get();
      materiesDelGrup = snapAll.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(m => m.curs === curs && !['classe', 'tutoria'].includes(m.tipus));
    }

    // Si se seleccionó una materia específica, filtrar
    const materiesToShow = matId 
      ? materiesDelGrup.filter(m => m.id === matId)
      : materiesDelGrup;

    if (materiesToShow.length === 0) {
      content.innerHTML = `
        <div style="text-align:center;padding:40px;color:#9ca3af;background:#f9fafb;border-radius:12px;">
          No s'han trobat matèries per a aquest grup
        </div>
      `;
      return;
    }

    // 3. LEER LOS ALUMNOS DEL GRUPO (desde grups_centre)
    let alumnesDelGrup = [];
    try {
      const grupCentreDoc = await db.collection('grups_centre').doc(grupId).get();
      if (grupCentreDoc.exists) {
        alumnesDelGrup = grupCentreDoc.data().alumnes || [];
      }
    } catch(e) {
      console.warn('Error llegint alumnes del grup:', e);
    }

    // Crear mapa de alumnos por RALC/nombre
    const alumnesMap = {};
    alumnesDelGrup.forEach((a, idx) => {
      const key = a.ralc || `${a.cognoms}_${a.nom}`;
      alumnesMap[key] = {
        id: key,
        nom: a.nom || '',
        cognoms: a.cognoms || '',
        ralc: a.ralc || '',
        grup: grupData?.nom || '',
        materies: {}
      };
    });

    // 4. PARA CADA MATERIA, LEER SU ÚLTIMO ENVÍO
    for (const mat of materiesToShow) {
      try {
        // Leer todos los documentos de esta materia para este grupo
        const snapAvaluacio = await db.collection('avaluacio_centre')
          .doc(curs)
          .collection(mat.id)
          .where('grupClasseId', '==', grupClasseId)
          .get();

        // Si no hay con grupClasseId, intentar con grupId (legacy)
        let docsAvaluacio = snapAvaluacio.docs;
        
        if (docsAvaluacio.length === 0) {
          const snapLegacy = await db.collection('avaluacio_centre')
            .doc(curs)
            .collection(mat.id)
            .where('grupId', '==', grupClasseId)
            .get();
          docsAvaluacio = snapLegacy.docs;
        }

                       // Procesar cada evaluación encontrada
        docsAvaluacio.forEach(doc => {
          const data = doc.data();
          const key = data.ralc || `${data.cognoms}_${data.nom}`;
          const docIdReal = doc.id; // ← ID REAL del documento en Firestore
          
          // Si el alumno no está en el grupo, añadirlo (por si es nuevo)
          if (!alumnesMap[key]) {
            alumnesMap[key] = {
              id: docIdReal, // ← Usar el ID REAL del documento
              nom: data.nom || '',
              cognoms: data.cognoms || '',
              ralc: data.ralc || '',
              grup: data.grup || grupData?.nom || '',
              materies: {}
            };
          } else {
            // IMPORTANTE: Actualizar el ID al real de Firestore
            alumnesMap[key].id = docIdReal;
          }

          // GUARDAR SOLO EL ÚLTIMO PERÍODO (o el más reciente)
          const periodeActual = data.periodeNom || data.periode || 'Sense període';
          const existent = alumnesMap[key].materies[mat.id];
          
          // Si no existe o el período es más reciente, actualizar
          // (asumiendo que los períodos van: Pre-avaluació → T1 → T2 → T3 → Final)
          const ordrePeriodes = ['Pre-avaluació', 'T1', '1r Trimestre', 'T2', '2n Trimestre', 'T3', '3r Trimestre', 'Final', 'Final de curs'];
          const indexNou = ordrePeriodes.indexOf(periodeActual);
          const indexVell = existent ? ordrePeriodes.indexOf(existent.periodeNom) : -1;
          
          // Si no existe, o el nuevo período está después en la lista, o no se reconoce el período
          if (!existent || indexNou > indexVell || indexNou === -1) {
            alumnesMap[key].materies[mat.id] = {
              nom: mat.nom || mat.id,
              periodeNom: periodeActual,
              items: data.items || [],
              descripcioComuna: data.descripcioComuna || '',
              comentariGlobal: data.comentariGlobal || '',
              enviatAt: data.enviatAt || data.createdAt || null
            };
          }
        });

      } catch (e) {
        console.warn(`Error llegint matèria ${mat.id}:`, e);
      }
    }

    // 5. PREPARAR DATOS PARA MOSTRAR
    const alumnes = Object.values(alumnesMap)
      .filter(a => Object.keys(a.materies).length > 0) // Solo alumnos con evaluaciones
      .sort((a, b) => (a.cognoms || a.nom).localeCompare(b.cognoms || b.nom, 'ca'));

    if (alumnes.length === 0) {
      content.innerHTML = `
        <div style="text-align:center;padding:40px;color:#9ca3af;background:#f9fafb;border-radius:12px;">
          No s'han trobat avaluacions per a aquest grup i curs
        </div>
      `;
      return;
    }

    // 6. RENDERIZAR RESULTADOS
    let html = '';
    
    for (const mat of materiesToShow) {
      // Filtrar alumnos que tienen esta materia
      const alumnesAmbMateria = alumnes.filter(a => a.materies[mat.id]);
      
      if (alumnesAmbMateria.length === 0) continue;

      // Encontrar máximo de ítems
      const maxItems = Math.max(...alumnesAmbMateria.map(a => 
        (a.materies[mat.id]?.items || []).length
      ), 0);

      // Mostrar período de esta materia (el último enviado)
      const primerAlumne = alumnesAmbMateria[0];
      const dadesMat = primerAlumne.materies[mat.id];
      const periodeMostrat = dadesMat?.periodeNom || '';

      html += `
        <div style="margin-bottom:28px;">
          <div style="
            display:flex;justify-content:space-between;align-items:center;
            padding:10px 14px;background:#e0f2fe;border-radius:10px;margin-bottom:12px;
          ">
            <div>
              <h4 style="font-size:14px;font-weight:700;color:#0c4a6e;margin:0;">
                📚 ${escapeHtml(mat.nom)}
              </h4>
              ${periodeMostrat ? `<span style="font-size:11px;color:#0369a1;">${escapeHtml(periodeMostrat)}</span>` : ''}
            </div>
            <span style="font-size:12px;color:#0369a1;">${alumnesAmbMateria.length} alumnes</span>
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
                ${alumnesAmbMateria.map((alumne, idx) => {
                  const matData = alumne.materies[mat.id];
                  return `
                    <tr style="border-bottom:1px solid #f1f5f9;${idx % 2 === 0 ? 'background:#fff;' : 'background:#fafbfc;'}">
                      <td style="padding:10px 12px;font-weight:600;color:#1e293b;">
                        ${escapeHtml(alumne.cognoms ? `${alumne.cognoms}, ${alumne.nom}` : alumne.nom)}
                      </td>
                      <td style="padding:10px 12px;color:#64748b;">${escapeHtml(alumne.grup || '—')}</td>
                      ${Array.from({length: maxItems}, (_, i) => {
                        const item = (matData?.items || [])[i];
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
                          data-curs="${curs}"
                          data-alumne-nom="${escapeHtml(alumne.nom)}"
                          data-alumne-cognoms="${escapeHtml(alumne.cognoms || '')}"
                          data-alumne-ralc="${escapeHtml(alumne.ralc || '')}"
                          style="padding:4px 12px;background:#0891b2;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    content.innerHTML = html || `
      <div style="text-align:center;padding:40px;color:#9ca3af;background:#f9fafb;border-radius:12px;">
        No s'han trobat avaluacions per a la selecció realitzada
      </div>
    `;

            // Events editar - PASAR ID COMO STRING (como en versión anterior)
    content.querySelectorAll('.btn-editar-revisio').forEach(btn => {
      btn.addEventListener('click', async () => {
        const alumneId = btn.dataset.id;  // ← ID string directo
        const matId2   = btn.dataset.matid;
        const curs2    = btn.dataset.curs;
        
        // Usar materiesToShow que tiene las materias correctas del grupo
        const materiesPerEditor = materiesToShow.length > 0 ? materiesToShow : materies;
        
        await obrirEditorRevisio(alumneId, matId2, curs2, materiesPerEditor);
      });
    });

  } catch (e) {
    console.error('Error carregarDadesRevisio:', e);
    content.innerHTML = `<div style="color:#ef4444;padding:20px;">Error: ${e.message}</div>`;
  }
}

/* ══════════════════════════════════════════════════════
   EDITOR DE REVISIÓ (editar ítems d'un alumne)
══════════════════════════════════════════════════════ */
async function obrirEditorRevisio(alumneId, matId, curs, materies) {
  document.getElementById('modalEditorRevisio')?.remove();

  console.log('Editar:', { alumneId, matId, curs }); // Diagnóstico

  let dades = null;
  let docRef = null;

  try {
    // ESTRATEGIA 1: Intentar leer directamente por ID
    const docDirecto = await window.db
      .collection('avaluacio_centre')
      .doc(curs)
      .collection(matId)
      .doc(alumneId)
      .get();
    
    if (docDirecto.exists) {
      dades = docDirecto.data();
      docRef = docDirecto.ref;
      console.log('Encontrado por ID directo');
    } else {
      console.log('No encontrado por ID directo, buscando por RALC/nombre...');
      
      // ESTRATEGIA 2: Buscar por RALC (si alumneId parece ser RALC)
      const snapRalc = await window.db
        .collection('avaluacio_centre')
        .doc(curs)
        .collection(matId)
        .where('ralc', '==', alumneId)
        .limit(1)
        .get();
      
      if (!snapRalc.empty) {
        dades = snapRalc.docs[0].data();
        docRef = snapRalc.docs[0].ref;
        console.log('Encontrado por RALC');
      }
    }
  } catch (e) {
    window.mostrarToast('❌ Error llegint dades: ' + e.message);
    console.error('Error:', e);
    return;
  }

  if (!dades || !docRef) {
    window.mostrarToast('⚠️ No s\'han trobat dades');
    console.log('No se encontraron datos para:', { alumneId, matId, curs });
    return;
  }

  // Resto de la función igual...
  const mat = materies.find(m => m.id === matId);
  const ASSOLIMENTS = [...];
  // ... etc
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
            ${escapeHtml(dades.cognoms ? `${dades.cognoms}, ${dades.nom}` : dades.nom || alumneData.nom || docId)}
          · ${escapeHtml(mat.nom || matId)}
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
        .doc(alumneId)  // ← Usar alumneId (string)
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
