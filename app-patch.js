// app-patch.js — v2
// 1. Integra rols amb app.js (injecta botons sidebar)
// 2. Intercepta "Crear classe" per mostrar desplegable de grups centre
// 3. Fix: botó Professor (alias btnTutoria per compatibilitat)

console.log('🔧 app-patch.js carregat');
let _grupsCentreData = {};
/* ══════════════════════════════════════════════════════
   INIT — esperar Firebase + usuari autenticat
══════════════════════════════════════════════════════ */
firebase.auth().onAuthStateChanged(async user => {
  if (!user) return;

  // Ocultar nav immediatament — evita flash de botons incorrectes
  const _nav = document.querySelector('.sidebar-nav');
  if (_nav) _nav.style.visibility = 'hidden';

  // Fallback: si alguna cosa falla, el nav es mostra als 6s
  const _navFallback = setTimeout(() => {
    if (_nav) _nav.style.visibility = 'visible';
  }, 6000);

  // Esperar que rols.js hagi carregat carregarPerfilUsuari
  await esperarFn('carregarPerfilUsuari', 6000);

  try {
    // Carregar perfil usuari
    await window.carregarPerfilUsuari(user.uid);

    // 🔹 Assegurar Superadmin fix en memòria/UI
    assegurarSuperAdmin(user);

    // 🔹 Regenerar superadmin a Firebase si ha desaparegut
    if (esSuperAdminFix(user)) {
  const profRef = db.collection('professors').doc(user.uid);
  const doc = await profRef.get();
  if (!doc.exists) {
    // Document inexistent → crear-lo completament
    await profRef.set({
      nom: user.displayName || 'SuperAdmin',
      email: user.email,
      rols: ['superadmin','admin'],
      isAdmin: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else if (!doc.data().isAdmin) {
    // Document existent → assegurar isAdmin
    await profRef.update({ isAdmin: true });
    console.log('⚡ Superadmin fix actualitzat amb isAdmin: true');
  }
}

    // Actualitzar UI segons rols (botons correctes ja injectats)
    window.actualitzarUIRols();

    // Verificar canvi de password
    await verificarPasswordChange(user);
  } catch(e) {
    console.error('app-patch init:', e);
  }

  // ✅ Rols carregats i botons injectats → mostrar nav amb fade suau
  clearTimeout(_navFallback);
  if (_nav) {
    _nav.style.transition = 'opacity 0.2s ease';
    _nav.style.opacity = '0';
    _nav.style.visibility = 'visible';
    requestAnimationFrame(() => { _nav.style.opacity = '1'; });
  }

  // Interceptar creació de classe
  interceptarCrearClasse();

  // Alias btnTutoria → btnProfessor per compatibilitat amb app.js
  patchBotoTutoriaAlias();

  // Mostrar panell Superadmin fix
  window.mostrarPanelSuperAdmin?.();
});
/* ══════════════════════════════════════════════════════
   ESPERAR FUNCIÓ GLOBAL
══════════════════════════════════════════════════════ */
function esperarFn(nom, ms = 5000) {
  return new Promise(res => {
    const t0 = Date.now();
    const c = () => typeof window[nom]==='function' ? res(true) :
      Date.now()-t0 < ms ? setTimeout(c, 150) : res(false);
    c();
  });
}

/* ══════════════════════════════════════════════════════
   VERIFICAR CANVI DE CONTRASENYA
══════════════════════════════════════════════════════ */
async function verificarPasswordChange(user) {
  if (sessionStorage.getItem('pwChangeDone')) return;
  try {
    const doc = await window.db.collection('professors').doc(user.uid).get();
    if (doc.exists && doc.data().forcePasswordChange) {
      setTimeout(() => window.mostrarModalCambioPassword?.(), 1500);
    }
  } catch(e) {}
}

/* ══════════════════════════════════════════════════════
   ALIAS btnTutoria per compatibilitat amb app.js
   app.js cerca 'btnTutoria' — creem ghost invisible
══════════════════════════════════════════════════════ */
function patchBotoTutoriaAlias() {
  if (document.getElementById('btnTutoria')) return;
  const ghost = document.createElement('button');
  ghost.id = 'btnTutoria';
  ghost.style.cssText = 'display:none!important;position:absolute;left:-9999px;';
  ghost.setAttribute('aria-hidden','true');
  document.body.appendChild(ghost);
}

/* ══════════════════════════════════════════════════════
   INTERCEPTAR CREAR CLASSE
   Substitueix el modal "Crear nou grup" d'app.js per un
   desplegable de grups/matèries/projectes de Secretaria
══════════════════════════════════════════════════════ */
function interceptarCrearClasse() {
  // Esperar que el botó existeixi
  const btn = document.getElementById('btnCreateClass');
  if (!btn) {
    setTimeout(interceptarCrearClasse, 500);
    return;
  }

  // Clonar el botó per eliminar listeners originals
  const btnNou = btn.cloneNode(true);
  btn.parentNode.replaceChild(btnNou, btn);

  btnNou.addEventListener('click', async () => {
    await obrirModalTriarGrupCentre();
  });

  // Interceptar també el botó original del modal — substituir pel nostre
  patchModalCreateClass();
}

function patchModalCreateClass() {
  // El modal original: id="modalCreateClass", input id="modalClassName"
  // Substituïm el seu contingut per el nostre desplegable
  const modal = document.getElementById('modalCreateClass');
  if (!modal) return;

  const box = modal.querySelector('.modal-box');
  if (!box) return;

    box.innerHTML = `
    <h3 class="modal-title">Afegir classe del centre</h3>
    <p style="font-size:13px;color:#6b7280;margin-bottom:16px;">
      Selecciona un nivell, un grup classe i la matèria/projecte amb els alumnes que s'importaran.
    </p>

    <!-- Selector Nivell -->
    <div style="margin-bottom:12px;">
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
        Nivell
      </label>
      <select id="patchSelNivell" style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;
              border-radius:9px;font-size:14px;outline:none;background:#f9fafb;">
        <option value="">⏳ Carregant...</option>
      </select>
    </div>

    <!-- Selector Grup Classe -->
    <div style="margin-bottom:12px;">
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
        Grup Classe
      </label>
      <select id="patchSelGrupClasse" style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;
              border-radius:9px;font-size:14px;outline:none;background:#f9fafb;" disabled>
        <option value="">— Primer tria un nivell —</option>
      </select>
    </div>

    <!-- Selector Matèria / Projecte -->
    <div style="margin-bottom:12px;">
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
        Matèria / Projecte / Optativa
      </label>
      <select id="patchSelMateria" style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;
              border-radius:9px;font-size:14px;outline:none;background:#f9fafb;" disabled>
        <option value="">— Primer tria un grup classe —</option>
      </select>
    </div>

    <!-- Info alumnes -->
    <div id="patchInfoAlumnes" style="background:#f9fafb;border:1.5px solid #e5e7eb;
         border-radius:9px;padding:10px 12px;font-size:13px;color:#6b7280;margin-bottom:4px;">
      Selecciona un grup per veure els alumnes que s'importaran.
    </div>

    <div class="modal-actions">
      <button data-modal-close="modalCreateClass" class="modal-close btn-secondary">Cancel·lar</button>
      <button id="patchBtnCrearClasse" class="btn-primary" disabled>Crear classe</button>
    </div>
  `;

    // Carregar nivells (la función carregarOpcionesNivells se modificará abajo)
  carregarOpcionesNivells();

  // Selector nivell → emplenar Grups Classe
  document.getElementById('patchSelNivell').addEventListener('change', async (e) => {
    const nivellId = e.target.value;
    const selGrupClasse = document.getElementById('patchSelGrupClasse');
    const selMateria = document.getElementById('patchSelMateria');

    selGrupClasse.innerHTML = `<option value="">⏳ Carregant grups...</option>`;
    selGrupClasse.disabled = true;
    selMateria.innerHTML = `<option value="">— Primer tria un grup classe —</option>`; // Reset del selector de materia
    selMateria.disabled = true;
    document.getElementById('patchBtnCrearClasse').disabled = true;
    document.getElementById('patchInfoAlumnes').textContent = 'Selecciona un grup per veure els alumnes.';

    if (!nivellId) {
      selGrupClasse.innerHTML = `<option value="">— Primer tria un nivell —</option>`;
      return;
    }

    const nivellData = _grupsCentreData[nivellId];
    const grupsClasse = nivellData?.grupsClasse || [];

    if (grupsClasse.length === 0) {
      selGrupClasse.innerHTML = `<option value="">Cap grup classe en aquest nivell</option>`;
      return;
    }

    selGrupClasse.innerHTML = `<option value="">— Tria un grup classe —</option>` +
      grupsClasse.map(g => `
        <option value="${g.id}" data-nom="${esH(g.nom)}">
          ${esH(g.nom)}
        </option>
      `).join('');
    selGrupClasse.disabled = false;
  });

  // Selector Grup Classe → emplenar Materias/Projectes/Optatives
  document.getElementById('patchSelGrupClasse').addEventListener('change', (e) => {
    const nivellId = document.getElementById('patchSelNivell').value;
    const grupClasseId = e.target.value;
    const selMateria = document.getElementById('patchSelMateria');

    selMateria.innerHTML = `<option value="">⏳ Carregant matèries...</option>`;
    selMateria.disabled = true;
    document.getElementById('patchBtnCrearClasse').disabled = true;
    document.getElementById('patchInfoAlumnes').textContent = 'Selecciona una matèria/projecte per veure els alumnes.';

    if (!grupClasseId) {
      selMateria.innerHTML = `<option value="">— Primer tria un grup classe —</option>`;
      return;
    }

    const nivellData = _grupsCentreData[nivellId];
    // Asegurarse de que las materias se buscan bajo el ID del grupo clase
    const materias = nivellData?.materiasPorGrupId[grupClasseId] || [];

    if (materias.length === 0) {
      selMateria.innerHTML = `<option value="">Cap matèria/projecte en aquest grup</option>`;
      return;
    }

    const TIPUS = {classe:'🏫 Grups classe',materia:'📚 Matèria',projecte:'🔬 Projecte',optativa:'🎨 Optativa',tutoria:'🧑‍🏫 Tutoria'}; // Añadido TIPUS aquí para usarlo en el mapeo
    selMateria.innerHTML = `<option value="">— Tria la matèria/projecte —</option>` +
      materias.map(m => `
        <option value="${m.id}"
          data-nom="${esH(m.nom)}"
          data-tipus="${esH(m.tipus)}"
          data-num-alumnes="${(m.alumnes||[]).length}"
          data-alumnes='${JSON.stringify(m.alumnes||[])}'>
          ${TIPUS[m.tipus] || ''} ${esH(m.nom)} (${(m.alumnes||[]).length} alumnes)
        </option>
      `).join('');
    selMateria.disabled = false;
  });

  // Selector Materia → mostrar info alumnes (AHORA SE ACTIVA CON EL ÚLTIMO SELECTOR)
  document.getElementById('patchSelMateria').addEventListener('change', (e) => {
    const opt = e.target.options[e.target.selectedIndex];
    const btnCrear = document.getElementById('patchBtnCrearClasse');
    const info = document.getElementById('patchInfoAlumnes');

    if (!e.target.value) {
      btnCrear.disabled = true;
      info.textContent = 'Selecciona una matèria/projecte per veure els alumnes.';
      info.style.background = '#f9fafb';
      info.style.color = '#6b7280';
      return;
    }

    const num = parseInt(opt.dataset.numAlumnes||'0');
    const alumnes = JSON.parse(opt.dataset.alumnes||'[]');
    const mostra = alumnes.slice(0,5).map(a=>`${a.cognoms||''} ${a.nom}`.trim()).join(', ');

    info.style.background = '#f0fdf4';
    info.style.color = '#166534';
    info.innerHTML = `
      <strong>✅ ${num} alumnes s'importaran automàticament</strong><br>
      <span style="font-size:12px;">${mostra}${num>5?`, ... i ${num-5} més`:''}</span>
    `;
    btnCrear.disabled = false;
  });

  // Botó crear
  document.getElementById('patchBtnCrearClasse').addEventListener('click', async () => {
    await crearClasseDesDeGrupCentre();
  });
}

async function carregarOpcionesNivells() {
  const selNivell = document.getElementById('patchSelNivell');
  if (!selNivell) return;

  // Resetear todos los selectores y estados
  selNivell.innerHTML = `<option value="">⏳ Carregant...</option>`;
  document.getElementById('patchSelGrupClasse').innerHTML = `<option value="">— Primer tria un nivell —</option>`;
  document.getElementById('patchSelGrupClasse').disabled = true;
  document.getElementById('patchSelMateria').innerHTML = `<option value="">— Primer tria un grup classe —</option>`;
  document.getElementById('patchSelMateria').disabled = true;
  document.getElementById('patchBtnCrearClasse').disabled = true;
  document.getElementById('patchInfoAlumnes').textContent = 'Selecciona una matèria/projecte per veure els alumnes.';

  try {
    const [nivellsSnap, grupsSnap] = await Promise.all([
      window.db.collection('nivells_centre').orderBy('ordre').get(),
      window.db.collection('grups_centre').get() // Cargar todos los grupos de una vez
    ]);

    const nivells = nivellsSnap.docs.map(d => ({id:d.id, ...d.data()}));
    const todosGrups = grupsSnap.docs.map(d => ({id:d.id, ...d.data()}));

    // Reorganizar los datos de grupos para fácil acceso en _grupsCentreData
    _grupsCentreData = {};
    nivells.forEach(n => {
      _grupsCentreData[n.id] = {
        info: n,
        grupsClasse: todosGrups.filter(g => g.nivellId === n.id && g.tipus === 'classe')
                           .sort((a,b)=>(a.ordre||99)-(b.ordre||99)),
        materiasPorGrupId: {} // Para almacenar materias por su parentGrupId (el ID del grupo clase)
      };
      // Asigna materias a su grupo clase padre o al nivel si no tienen parentGrupId
      todosGrups.filter(g => g.tipus !== 'classe') // Solo materias/proyectos/optativas/tutorias
                .forEach(m => {
                  // Si tiene parentGrupId y coincide con un grupo clase del nivel, asigna a ese grupo
                  // Si no tiene parentGrupId, o el parentGrupId es el ID del nivel, lo asigna al ID del nivel (para materias "flotantes")
                  const parentId = m.parentGrupId || m.nivellId;

                  // Solo añadir si la materia realmente pertenece a este nivel (por nivellId)
                  if (m.nivellId === n.id) {
                      if (!_grupsCentreData[n.id].materiasPorGrupId[parentId]) {
                          _grupsCentreData[n.id].materiasPorGrupId[parentId] = [];
                      }
                      _grupsCentreData[n.id].materiasPorGrupId[parentId].push(m);
                      // Ordenar las materias
                      _grupsCentreData[n.id].materiasPorGrupId[parentId].sort((a,b)=>(a.ordre||99)-(b.ordre||99));
                  }
                });
    });

    if (nivells.length === 0) {
      selNivell.innerHTML = `<option value="">⚠️ Cap nivell creat per Secretaria</option>`;
      return;
    }
    selNivell.innerHTML = `<option value="">— Tria un nivell —</option>` +
            nivells.map(n=>`<option value="${n.id}">${esH(n.nom)} (${esH(n.curs||'')})</option>`).join('');
  } catch(e) {
    selNivell.innerHTML = `<option value="">Error carregant nivells: ${e.message}</option>`;
    console.error(e);
  }
}

/* ══════════════════════════════════════════════════════
   MODAL TRIADA DE GRUP (alternatiu, si no hi ha Secretaria)
══════════════════════════════════════════════════════ */
async function obrirModalTriarGrupCentre() {
  // Simplement obrim el modal original ja modificat
  if (typeof window.openModal === 'function') {
    window.openModal('modalCreateClass');
    // Recarregar els nivells cada vegada que s'obre
    setTimeout(carregarOpcionesNivells, 100);
  }
}

/* ══════════════════════════════════════════════════════
   CREAR CLASSE A PARTIR DEL GRUP CENTRE
   Importa els alumnes del grup centre a una nova classe
══════════════════════════════════════════════════════ */
async function crearClasseDesDeGrupCentre() {
  const selNivell = document.getElementById('patchSelNivell');
  const selGrupClasse = document.getElementById('patchSelGrupClasse');
  const selMateria = document.getElementById('patchSelMateria'); // Nuevo selector
  const btn = document.getElementById('patchBtnCrearClasse');

  const nivellId = selNivell.value;
  const grupClasseId = selGrupClasse.value;
  const materiaId = selMateria.value; // ID de la materia/proyecto seleccionada

  if (!nivellId || !grupClasseId || !materiaId) {
    window.mostrarToast('⚠️ Tria el nivell, el grup classe i la matèria/projecte');
    return;
  }

  // Obtener las opciones seleccionadas para sus datasets
  const optNivell = selNivell.options[selNivell.selectedIndex];
  const optGrupClasse = selGrupClasse.options[selGrupClasse.selectedIndex];
  const optMateria = selMateria.options[selMateria.selectedIndex];

  const nivellNom = optNivell.textContent.split('(')[0].trim(); // "1r ESO"
  const nomGrupClasse = optGrupClasse.dataset.nom; // "A"
  const nomMateria = optMateria.dataset.nom; // "Matemàtiques"
  const tipusMateria = optMateria.dataset.tipus; // "Matèria"
  const alumnesCentre = JSON.parse(optMateria.dataset.alumnes||'[]'); // Alumnos de la materia seleccionada

  btn.disabled = true;
  btn.textContent = '⏳ Creant...';

  try {
    const db = window.db;
    const professorUID = firebase.auth().currentUser?.uid;

    // Nombre completo de la clase: "Matemàtiques 1r ESO - A"
    const nomClasse = `${nomMateria} ${nivellNom} - ${nomGrupClasse}`;

    // Comprovar si ja existeix una classe amb el mateix nom i grupCentreId
    const classesExistents = await db.collection('classes')
      .where('grupCentreId', '==', materiaId)
      .get();

    if (!classesExistents.empty) {
      const existent = classesExistents.docs[0].data();
      const creatPer = existent.ownerEmail
        ? existent.ownerEmail.split('@')[0]
        : (existent.ownerUid || 'un altre professor/a');
      btn.disabled = false;
      btn.textContent = 'Crear classe';
      window.mostrarToast(`⚠️ Aquesta classe ja ha estat creada per ${creatPer}`, 5000);
      return;
    }

    // Crear la clase
    const classeRef = db.collection('classes').doc();

    // Crear los alumnos en la colección alumnes
    const alumneIds = [];
    const batch = db.batch();

    for (const a of alumnesCentre) {
      const alRef = db.collection('alumnes').doc();
      batch.set(alRef, {
        nom:     a.nom || '',
        cognoms: a.cognoms || '',
        ralc:    a.ralc || '',
        comentari: '',
        ownerUid:  professorUID,
        classId:   classeRef.id,
        grupCentreId: materiaId, // Ahora el grupCentreId será el de la MATERIA seleccionada
      });
      alumneIds.push(alRef.id);
    }

    // Crear la clase con los alumnos
    batch.set(classeRef, {
      nom:         nomClasse,
      nomGrup:     nomMateria, // El nombre de la materia será el nombre principal para el profesor
      nivellNom,
      grupClasseNom: nomGrupClasse, // Nombre del grupo clase
      tipusGrupCentre: tipusMateria, // Tipo de la materia (Matèria, Projecte, etc.)
      grupCentreId: materiaId, // El ID de la materia seleccionada
      nivellCentreId: nivellId, // El ID del nivel
      parentGrupCentreId: grupClasseId, // El ID del grupo clase padre (el grupo clase A, B, C...)
      alumnes:     alumneIds,
      ownerUid:    professorUID,
      ownerEmail:  firebase.auth().currentUser?.email || '',
      creatAt:     firebase.firestore.FieldValue.serverTimestamp(),
    });

    // Afegir classe al professor
    await batch.commit();
    await db.collection('professors').doc(professorUID).update({
      classes: firebase.firestore.FieldValue.arrayUnion(classeRef.id)
    });

    window.mostrarToast(`✅ Classe "${nomClasse}" creada amb ${alumneIds.length} alumnes`);

    // Tancar modal i recarregar
    if (typeof window.closeModal === 'function') window.closeModal('modalCreateClass');

    // Recarregar la vista de classes immediatament
    setTimeout(() => {
      if (typeof window.loadClassesScreen === 'function') {
        window.loadClassesScreen();
      } else {
        // Fallback: click al botó de navegació (si no existe loadClassesScreen)
        document.getElementById('navClasses')?.click();
      }
    }, 300);

  } catch(e) {
    console.error('Error creant classe:', e);
    window.mostrarToast('❌ Error: ' + e.message, 5000);
    btn.disabled = false;
    btn.textContent = 'Crear classe';
  }
}

/* ══════════════════════════════════════════════════════
   SUPERADMIN FIX AVANÇAT — Autoprotecció i regeneració
══════════════════════════════════════════════════════ */
const SUPERADMINS_FIXED = [
  "tonaco92@gmail.com",   
  "toni.munoz@institutmatadepera.cat"      
];

function esSuperAdminFix(user) {
  if (!user) return false;
  return SUPERADMINS_FIXED.includes(user.email);
}

// Gestió centralitzada de rols en memòria
window._userRols = window._userRols || [];

// Funció per forçar superadmin fix
function assegurarSuperAdmin(user) {
  if (!user) return;
  if (esSuperAdminFix(user)) {
    window._userRols = window._userRols || [];
    ['superadmin','admin'].forEach(r => {
      if (!window._userRols.includes(r)) {
        window._userRols.push(r);
        console.warn(`⚡ Rol "${r}" regenerat automàticament per ${user.email}`);
      }
    });
    mostrarAlertSuperAdmin("Rols fix regenerats automàticament!");
  }
}
// ✅ Nova funció: regenerar document a Firebase si s'ha esborrat
async function regenerarSuperAdminFirebase(user) {
  if (!user || !esSuperAdminFix(user)) return;

  const db = window.db;
  if (!db) return console.warn("❌ db no inicialitzat per Firebase");

  const profRef = db.collection('professors').doc(user.uid);
  const doc = await profRef.get();

  if (!doc.exists) {
    console.warn('⚡ Superadmin fix no trobat a Firebase, regenerant document...', user.email);

    await profRef.set({
      nom: user.displayName || 'SuperAdmin',
      email: user.email,
      rols: ['superadmin','admin'],
      creatAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    window._userRols = window._userRols || [];
    ['superadmin','admin'].forEach(r => {
      if (!window._userRols.includes(r)) window._userRols.push(r);
    });

    window.mostrarToast?.(`✅ Superadmin fix regenerat a Firebase: ${user.email}`, 4000);
  }
}

// Funció d'alerta flotant
function mostrarAlertSuperAdmin(msg) {
  if (document.getElementById('_alertSuperAdmin')) return;
  const alertDiv = document.createElement('div');
  alertDiv.id = '_alertSuperAdmin';
  alertDiv.style.cssText = `
    position:fixed;top:12px;right:12px;z-index:99999;
    background:#ff4b4b;color:#fff;padding:10px 16px;border-radius:12px;
    font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);
  `;
  alertDiv.textContent = "SUPERADMIN: " + msg;
  document.body.appendChild(alertDiv);
  setTimeout(() => alertDiv.remove(), 3000);
}

// Sobreescriure l'actualització de UI per integrar superadmin fix
const _origActUIRols2 = window.actualitzarUIRols;
window.actualitzarUIRols = function() {
  _origActUIRols2?.();

  const user = firebase.auth().currentUser;
  const rols = window._userRols || [];

  // Regenerar superadmin fix si cal
  assegurarSuperAdmin(user);

  // ══════════════════════════════════════════════════════
  // MATRIU DE BOTONS PER ROL — comprovació ESTRICTA (includes, no jerarquia)
  //
  // professor  → cap botó especial (crea grups i envia avaluacions)
  // alumne     → cap botó (té pantalla pròpia)
  // tutor      → Tutoria (filtrat als grups assignats)
  // pedagog    → Tutoria (tots els grups)
  // secretaria → Secretaria
  // revisor    → Revisió
  // admin/superadmin → tots els botons
  // ══════════════════════════════════════════════════════

  const esAdmin = rols.includes('admin') || rols.includes('superadmin') || !!window._isSuperAdmin;

  // Secretaria: rol explícit o admin. Revisor: accés limitat només al Quadre de dades
  if (esAdmin || rols.includes('secretaria') || rols.includes('revisor'))
    window.injectarBotoSecretaria?.();

  // Tutoria: tutor o pedagog (o admin). Secretaria NO.
  if (esAdmin || rols.includes('tutor') || rols.includes('pedagog'))
    window.injectarBotoTutoria?.();

  // Revisió: revisor (o admin). Secretaria, tutor, pedagog NO.
  if (esAdmin || rols.includes('revisor'))
    window.injectarBotoRevisor?.();

  // Junta Avaluació: rol explícit o admin
  if (esAdmin || rols.includes('juntaavaluacio'))
    window.injectarBotoJuntaAvaluacio?.();
};

// Panell flotant per superadmins fixos
window.mostrarPanelSuperAdmin = function() {
  const user = firebase.auth().currentUser;
  if (!esSuperAdminFix(user)) return;

  if (document.getElementById('_panelSuperAdmin')) return;
  const panel = document.createElement('div');
  panel.id = '_panelSuperAdmin';
  panel.style.cssText = `
    position:fixed;bottom:12px;right:12px;z-index:99999;
    background:#1e1b4b;color:#fff;padding:12px 16px;border-radius:12px;
    font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);
  `;
  panel.innerHTML = `
    SUPERADMIN 🔐
    <button id="_btnSuperAdminTest" style="
      margin-left:8px;padding:2px 6px;font-size:12px;
      border:none;border-radius:6px;background:#fff;color:#1e1b4b;cursor:pointer;">
      Test permisos
    </button>
  `;
  document.body.appendChild(panel);

  document.getElementById('_btnSuperAdminTest').addEventListener('click', () => {
    alert('Rols actuals: ' + (window._userRols||[]).join(', '));
  });
};

// Activar panell i assegurar superadmin després de login
firebase.auth().onAuthStateChanged(user => {
  if (!user) return;
  setTimeout(() => {
    assegurarSuperAdmin(user);
    window.mostrarPanelSuperAdmin?.();
  }, 500);
});

/* ══════════════════════════════════════════════════════
   ACTUALITZAR UI ROLS — eliminat bloc duplicat (fusionat al bloc superior)
══════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
   INICIALITZAR COL·LECCIONS BASE (primera vegada)
══════════════════════════════════════════════════════ */
firebase.auth().onAuthStateChanged(async user => {
  if (!user) return;
  await esperarFn('_userRols', 4000);
  const rols = window._userRols || [];
  if (!rols.some(r=>['admin','superadmin','secretaria'].includes(r))) return;

  try {
    const cfgDoc = await window.db.collection('_sistema').doc('config').get();
    if (cfgDoc.exists) return;
    await window.db.collection('_sistema').doc('config').set({
      inicialitzat: true, versio: '1.0', centre: 'INS Matadepera',
      creatAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Col·leccions base inicialitzades');
  } catch(e) {
    console.warn('app-patch init col·leccions:', e.message);
  }
});

function esH(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


/* ══════════════════════════════════════════════════════
   PATCH: Mostrar Cognoms + Nom a la llista d'alumnes
   app.js usa data.nom — patchegem perquè mostri nom complet
══════════════════════════════════════════════════════ */
function patchMostrarNomComplet() {
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        const noms = node.classList?.contains('student-name')
          ? [node]
          : [...(node.querySelectorAll?.('.student-name') || [])];
        noms.forEach(span => {
          if (span.dataset.nomPatchat) return;
          span.dataset.nomPatchat = '1';
          const li = span.closest('[data-id]');
          if (!li?.dataset?.id) return;
          window.db?.collection('alumnes').doc(li.dataset.id).get().then(doc => {
            if (!doc?.exists) return;
            const d = doc.data();
            if (d.cognoms) {
              const nomComplet = `${d.cognoms}, ${d.nom}`;
              span.textContent = nomComplet;
              if (li.dataset) li.dataset.nom = nomComplet.toLowerCase();
            }
            // Indicador d'enviament a Avaluació Centre
            if (d.grupCentreId) {
              // Eliminar badge anterior i re-verificar per al periode actiu
              li.querySelector('.badge-avc')?.remove();
              verificarEnviamentAvaluacio(li.dataset.id, d, li);
            }
          }).catch(()=>{});
        });
      });
    });
  });

  // Observar el contenidor principal d'alumnes
  const tryObserve = () => {
    const list = document.getElementById('studentsList');
    if (list) {
      observer.observe(list, { childList: true, subtree: true });
    } else {
      setTimeout(tryObserve, 500);
    }
  };
  tryObserve();
}


/* ══════════════════════════════════════════════════════
   VERIFICAR ENVIAMENT A AVALUACIÓ CENTRE
   Mostra un petit badge 🏫 a l'alumne que ja té dades enviades
══════════════════════════════════════════════════════ */
async function verificarEnviamentAvaluacio(alumneId, alumneData, liEl) {
  if (!window.db || !alumneData.grupCentreId) return;
  try {
    const curs      = window._cursActiu || await obtenirCursActiu();
    // Llegir el periode actiu i el seu nom per filtrar
    const periodeId = window.currentPeriodeId || window._tcClassId;
    let   periodeNom = null;
    if (periodeId && window.currentPeriodes?.[periodeId]) {
      periodeNom = window.currentPeriodes[periodeId].nom;
    }

    const doc = await window.db.collection('avaluacio_centre')
      .doc(curs)
      .collection(alumneData.grupCentreId)
      .doc(alumneId)
      .get();

    if (!doc.exists) return;

    // Si tenim periodeNom, verificar que el doc correspon a aquest periode
    if (periodeNom) {
      const docPeriodeNom = doc.data()?.periodeNom;
      // Si el doc té periodeNom i no coincideix → no mostrar badge
      if (docPeriodeNom && docPeriodeNom !== periodeNom) return;
    }

    // Afegir o actualitzar badge
    let badge = liEl.querySelector('.badge-avc');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'badge-avc';
      badge.style.cssText = `
        display:inline-block;background:#059669;color:#fff;
        border-radius:4px;font-size:9px;font-weight:700;
        padding:1px 5px;margin-left:5px;vertical-align:middle;
      `;
      const span = liEl.querySelector('.student-name');
      if (span) span.insertAdjacentElement('afterend', badge);
    }
    badge.textContent = '🏫';
    badge.title = `Avaluació enviada${periodeNom ? ' — ' + periodeNom : ''}`;
  } catch(e) {}
}

async function obtenirCursActiu() {
  try {
    const doc = await window.db.collection('_sistema').doc('config').get();
    const curs = doc.data()?.cursActiu;
    if (curs) { window._cursActiu = curs; return curs; }
  } catch(e) {}
  const ara = new Date();
  const any = ara.getMonth() >= 8 ? ara.getFullYear() : ara.getFullYear()-1;
  return `${any}-${String(any+1).slice(-2)}`;
}

// Activar el patch
document.addEventListener('DOMContentLoaded', patchMostrarNomComplet);
// Per si ja ha carregat
if (document.readyState !== 'loading') patchMostrarNomComplet();

/* ══════════════════════════════════════════════════════
   NOTIFICACIÓ CANVIS DE GRUP DES DE SECRETARIA
   Quan Secretaria actualitza un grup_centre, notificar
   al professor que recarregui la classe
══════════════════════════════════════════════════════ */
function iniciarEscoltaCanvisGrup() {
  if (!window.currentClassId || !window.db) return;

  // Llegir el grupCentreId de la classe actual
  window.db.collection('classes').doc(window.currentClassId).get().then(doc => {
    const grupCentreId = doc.data()?.grupCentreId;
    if (!grupCentreId) return;

    // Clau localStorage per recordar quan el professor va veure per última vegada els alumnes del grup
    const vistaKey = `_alumnesVistAt_${grupCentreId}`;

    // Escoltar canvis al grup del centre
    const unsub = window.db.collection('grups_centre').doc(grupCentreId)
      .onSnapshot(snap => {
        if (!snap.metadata.hasPendingWrites && !snap.metadata.fromCache && snap.exists) {
          const alumnesCentre = snap.data()?.alumnes || [];
          if (!alumnesCentre.length) return;

          // Comprovar si secretaria ha actualitzat DESPRÉS de l'última vegada que el professor va veure el grup
          const updatedAt = snap.data()?.alumnesUpdatedAt?.toMillis?.() || 0;
          if (!updatedAt) return; // Sense timestamp = canvi antic, no mostrar

          const vistaAt = parseInt(localStorage.getItem(vistaKey) || '0');
          if (updatedAt <= vistaAt) return; // Ja ho havia vist

          // Nou canvi de secretaria! Mostrar banner
          if (!document.getElementById('_bannerActualitzacio')) {
            (async () => {
              try {
                const classId = window.currentClassId;
                if (!classId) return;
                const classeDoc2 = await window.db.collection('classes').doc(classId).get();
                const alumnesIds = classeDoc2?.data()?.alumnes || [];
                mostrarBannerActualitzacio(alumnesCentre.length, alumnesIds.length, grupCentreId, vistaKey, updatedAt);
              } catch(e) {}
            })();
          }
        }
      }, () => {});

    // Netejar listener quan es canvia de classe
    window._unsubGrupCentre = unsub;
  }).catch(()=>{});
}

function mostrarBannerActualitzacio(nCentre, nClasse, grupCentreId, vistaKey, updatedAt) {
  if (document.getElementById('_bannerActualitzacio')) return;

  const banner = document.createElement('div');
  banner.id = '_bannerActualitzacio';
  banner.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:99998;
    background:linear-gradient(135deg,#f59e0b,#d97706);
    color:#fff;padding:12px 20px;
    display:flex;align-items:center;justify-content:space-between;
    box-shadow:0 4px 12px rgba(0,0,0,0.2);font-family:inherit;
  `;
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:18px;">📋</span>
      <div>
        <strong>Secretaria ha actualitzat la llista d'alumnes</strong>
        <div style="font-size:12px;opacity:0.9;">
          Centre: ${nCentre} alumnes · Classe actual: ${nClasse} alumnes
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <button id="_btnActualitzarClasse" style="padding:8px 18px;background:#fff;color:#d97706;
        border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">
        🔄 Actualitzar classe
      </button>

    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById('_btnActualitzarClasse').addEventListener('click', async () => {
    if (vistaKey && updatedAt) localStorage.setItem(vistaKey, String(updatedAt));
    banner.innerHTML = '<div style="padding:4px 20px;">⏳ Actualitzant alumnes...</div>';
    try {
      const grupDoc = await window.db.collection('grups_centre').doc(grupCentreId).get();
      const alumnesCentre = grupDoc.data()?.alumnes || [];
      const classId = window.currentClassId;

      const classeDoc = await window.db.collection('classes').doc(classId).get();
      const alumnesActuals = classeDoc.data()?.alumnes || [];

      // Llegir docs dels alumnes actuals
      const docsActuals = await Promise.all(
        alumnesActuals.map(id => window.db.collection('alumnes').doc(id).get())
      );

      // Normalitzar noms per comparació robusta (independentment de si nom és complet o separat)
      const _norm = s => (s||'').toLowerCase().replace(/\s+/g,' ').trim();

      // Conjunts de RALCs i noms del centre (font de veritat)
      const ralcsCentre = new Set(alumnesCentre.map(a => a.ralc).filter(Boolean));
      const nomsCentre  = new Set(alumnesCentre.map(a => _norm(`${a.nom||''} ${a.cognoms||''}`)));

      const batch = window.db.batch();
      const profUID = firebase.auth().currentUser?.uid;

      // ── 1. ELIMINAR: alumnes de la classe que ja no són al centre ──
      const idsEliminar = [];
      for (const doc of docsActuals) {
        if (!doc.exists) { idsEliminar.push(doc.id); continue; }
        const data = doc.data();
        const nomDoc = data.cognoms
          ? _norm(`${data.nom||''} ${data.cognoms||''}`)
          : _norm(data.nom || '');
        const ralcDoc = data.ralc || '';

        const alCentre = (ralcDoc && ralcsCentre.has(ralcDoc)) || nomsCentre.has(nomDoc);
        if (!alCentre) {
          idsEliminar.push(doc.id);
          batch.delete(window.db.collection('alumnes').doc(doc.id));
        }
      }

      // ── 2. AFEGIR: alumnes del centre que no estan a la classe ──
      const ralcsActuals = new Set(docsActuals.map(d => d.data()?.ralc).filter(Boolean));
      const nomsActuals  = new Set(docsActuals.map(d => {
        const data = d.data() || {};
        return data.cognoms ? _norm(`${data.nom} ${data.cognoms}`) : _norm(data.nom || '');
      }));

      const idsAfegir = [];
      for (const a of alumnesCentre) {
        const key = _norm(`${a.nom||''} ${a.cognoms||''}`);
        if ((a.ralc && ralcsActuals.has(a.ralc)) || nomsActuals.has(key)) continue;
        const ref = window.db.collection('alumnes').doc();
        batch.set(ref, {
          nom: a.nom, cognoms: a.cognoms || '', ralc: a.ralc || '',
          comentari: '', ownerUid: profUID, classId
        });
        idsAfegir.push(ref.id);
      }

      // ── 3. Nova llista d'IDs: actuals - eliminats + afegits ──
      const nousIds = [
        ...alumnesActuals.filter(id => !idsEliminar.includes(id)),
        ...idsAfegir
      ];
      batch.update(window.db.collection('classes').doc(classId), { alumnes: nousIds });
      await batch.commit();

      sessionStorage.setItem(`_bannerResolt_${window.currentClassId}_${grupCentreId}`, '1');
      banner.remove();

      const missatge = [];
      if (idsAfegir.length)   missatge.push(`${idsAfegir.length} afegit${idsAfegir.length !== 1 ? 's' : ''}`);
      if (idsEliminar.length) missatge.push(`${idsEliminar.length} eliminat${idsEliminar.length !== 1 ? 's' : ''}`);
      window.mostrarToast?.(`✅ Alumnes actualitzats: ${missatge.join(', ') || 'sense canvis'}`);

      if (typeof window.renderStudentsList === 'function') {
        window.classStudents = nousIds;
        window.renderStudentsList();
      }
      if (typeof loadClassData === 'function') loadClassData();

    } catch(e) {
      banner.remove();
      window.mostrarToast?.('❌ Error: ' + e.message);
    }
  });
}

// Activar quan es carrega una classe
firebase.auth().onAuthStateChanged(user => {
  if (!user) return;
  // Observar canvis de currentClassId
  const _origOpenClass = window.openClass;
  if (_origOpenClass && !window._openClassPatched) {
    window._openClassPatched = true;
  }
  // Escoltar via MutationObserver o polling
  let _lastClassId = null;
  setInterval(() => {
    const cId = window.currentClassId;
    if (cId && cId !== _lastClassId) {
      _lastClassId = cId;
      window._unsubGrupCentre?.();
      document.getElementById('_bannerActualitzacio')?.remove();
      setTimeout(iniciarEscoltaCanvisGrup, 500);
    }
  }, 1000);
});


/* ══════════════════════════════════════════════════════
   DRAG & DROP PESTANYES DE PERÍODES
   El professor pot reordenar les pestanyes arrossegant
══════════════════════════════════════════════════════ */
function activarDragDropTabs() {
  const container = document.getElementById('periodesTabs');
  if (!container || container._ddActivat) return;
  container._ddActivat = true;

  let ddFrom = null;

  const actualitzarDragListeners = () => {
    container.querySelectorAll('.periode-tab').forEach((tab, i) => {
      if (tab._ddBound) return;
      tab._ddBound = true;
      tab.draggable = true;
      tab.style.cursor = 'grab';

      tab.addEventListener('dragstart', e => {
        ddFrom = i;
        tab.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
      });
      tab.addEventListener('dragend', () => { tab.style.opacity = '1'; });
      tab.addEventListener('dragover', e => {
        e.preventDefault();
        tab.style.outline = '2px dashed #7c3aed';
      });
      tab.addEventListener('dragleave', () => { tab.style.outline = ''; });
      tab.addEventListener('drop', async e => {
        e.preventDefault();
        tab.style.outline = '';
        const tabs = [...container.querySelectorAll('.periode-tab')];
        const toIdx = tabs.indexOf(tab);
        if (ddFrom === null || ddFrom === toIdx) return;

        // Reordenar els períodes
        const periodes = window.currentPeriodes;
        if (!periodes) return;

        const sorted = Object.entries(periodes)
          .sort((a,b) => (a[1].ordre||0) - (b[1].ordre||0));

        // Moure l'element
        const [moved] = sorted.splice(ddFrom, 1);
        sorted.splice(toIdx, 0, moved);

        // Actualitzar ordres
        sorted.forEach(([pid, pdata], i) => {
          periodes[pid] = { ...pdata, ordre: i };
        });

        // Guardar a Firebase
        try {
          await window.db.collection('classes').doc(window.currentClassId).update({
            periodes
          });
          // Re-renderitzar
          window.currentPeriodes = periodes;
          if (typeof window.renderPeriodesTabs === 'function') {
            window.renderPeriodesTabs();
          }
        } catch(e) {
          window.mostrarToast?.('❌ Error guardant ordre: ' + e.message);
        }
      });
    });
  };

  // Activar en el render inicial i cada vegada que es re-renderitzen
  actualitzarDragListeners();
  const obs = new MutationObserver(actualitzarDragListeners);
  obs.observe(container, { childList: true });
}

// Activar quan el container existeixi
const _initDDTabs = () => {
  if (document.getElementById('periodesTabs')) {
    activarDragDropTabs();
  } else {
    setTimeout(_initDDTabs, 500);
  }
};
setTimeout(_initDDTabs, 1000);

// Re-activar cada cop que es renderitzen les tabs
const _wrapRPT = window.renderPeriodesTabs;
if (_wrapRPT && !window._ddTabsWrapped) {
  window._ddTabsWrapped = true;
  window.renderPeriodesTabs = function(p) {
    _wrapRPT(p);
    // Reset els flags perquè el MutationObserver els detecti com a nous
    setTimeout(() => {
      document.querySelectorAll('.periode-tab').forEach(t => delete t._ddBound);
      activarDragDropTabs();
    }, 50);
  };
}


/* ══════════════════════════════════════════════════════
   OCULTAR BOTONS D'ALUMNES DEL PROFESSOR
   El control d'alumnes és exclusiu de Secretaria
══════════════════════════════════════════════════════ */
function ocultarBotonsAlumnesProfesor() {
  if (document.getElementById('_styleOcultarAlumnes')) return;
  const style = document.createElement('style');
  style.id = '_styleOcultarAlumnes';
  style.textContent = `
    #btnAddStudent,
    #btnImportAL,
    #btnDeleteMode,
    #btnCancelDeleteStudents,
    #confirmDeleteStudentsBtn,
    #btnImportClassroom,
    #modalClassroomImport,
    .student-item-btn.delete,
    .delete-checkbox {
      display: none !important;
    }
    .student-item-actions {
      /* Amagar accions d'alumne */
    }
  `;
  document.head.appendChild(style);
}

// Activar immediatament
document.addEventListener('DOMContentLoaded', ocultarBotonsAlumnesProfesor);
if (document.readyState !== 'loading') ocultarBotonsAlumnesProfesor();


/* Forçar refresc del badge 🏫 de l'alumne actiu després d'enviar */
window._refrescarBadgeAlumneActiu = function() {
  const li = document.querySelector('#studentsList li.active[data-id]');
  if (!li) return;
  li.querySelector('.badge-avc')?.remove();
  const alumneId = li.dataset.id;
  window.db?.collection('alumnes').doc(alumneId).get().then(doc => {
    if (doc?.exists) {
      const d = doc.data();
      if (d.grupCentreId) {
        verificarEnviamentAvaluacio(alumneId, d, li);
      }
    }
  }).catch(()=>{});
  // Refresc de tots els alumnes visibles
  document.querySelectorAll('#studentsList li[data-id]').forEach(li2 => {
    li2.querySelector('.badge-avc')?.remove();
    window.db?.collection('alumnes').doc(li2.dataset.id).get().then(doc => {
      if (doc?.exists) {
        const d = doc.data();
        if (d.grupCentreId) verificarEnviamentAvaluacio(li2.dataset.id, d, li2);
      }
    }).catch(()=>{});
  });
};


console.log('✅ app-patch.js v2: integració completada');


/* ══════════════════════════════════════════════════════
   PESTANYES PERÍODES — Professor
   1. Eliminar el menú ⋮ (professors no gestionen períodes)
   2. Botó + mostra selector de períodes fixes
      (els períodes disponibles vénen de _sistema/periodes)
══════════════════════════════════════════════════════ */

const PERIODES_FIXES_PROF = [
  { codi: 'preav', nom: 'Pre-avaluació', ordre: 0 },
  { codi: 'T1',    nom: '1r Trimestre',  ordre: 1 },
  { codi: 'T2',    nom: '2n Trimestre',  ordre: 2 },
  { codi: 'T3',    nom: '3r Trimestre',  ordre: 3 },
  { codi: 'final', nom: 'Final de curs', ordre: 4 },
];

// Ocultar el menú ⋮ de les pestanyes (professors no editen períodes)
function ocultarMenuPestanyes() {
  // Afegir CSS global per ocultar els ⋮
  if (document.getElementById('_styleOcultarMenu')) return;
  const style = document.createElement('style');
  style.id = '_styleOcultarMenu';
  style.textContent = `.periode-tab-menu { display: none !important; }`;
  document.head.appendChild(style);
}

// Substituir el botó + per un selector de períodes fixes
function patchBotoAddPeriode() {
  const btn = document.getElementById('btnAddPeriode');
  if (!btn || btn._patched) return;
  btn._patched = true;

  // Clonar per eliminar l'event listener original d'app.js
  const nou = btn.cloneNode(true);
  nou._patched = true;
  btn.parentNode.replaceChild(nou, btn);

  nou.addEventListener('click', async e => {
    e.stopPropagation();
    await mostrarSelectorPeriodes();
  });
}

async function mostrarSelectorPeriodes() {
  document.getElementById('_selectorPeriodes')?.remove();

  // Períodes ja existents a la classe actual
  const existentsNoms = Object.values(window.currentPeriodes || {}).map(p => p.nom);

  // Llegir configuració de Secretaria: tancats + noms personalitzats + ordre
  let tancats = [];
  let nomsPersonalitzats = {};
  let ordreSecretaria = [];
  try {
    const doc = await window.db.collection('_sistema').doc('periodes_tancats').get();
    if (doc.exists) {
      tancats            = doc.data()?.tancats || [];
      nomsPersonalitzats = doc.data()?.noms    || {};
      ordreSecretaria    = doc.data()?.ordre   || [];
    }
  } catch(e) {}

  // Construir llista completa de períodes disponibles
  // Combinar els 5 fixes + els customs creats per Secretaria
  const FIXES_CODIS = ['preav','T1','T2','T3','final'];
  const periodesTots = [
    ...PERIODES_FIXES_PROF.map(p => ({
      ...p,
      nom: nomsPersonalitzats[p.codi] || p.nom
    })),
    // Afegir custom periods de Secretaria
    ...ordreSecretaria
      .filter(codi => !FIXES_CODIS.includes(codi))
      .map((codi, i) => ({
        codi,
        nom: nomsPersonalitzats[codi] || codi,
        ordre: 10 + i
      }))
  ];

  // Mantenir l'ordre de Secretaria si existeix
  const periodesOrdenats = ordreSecretaria.length > 0
    ? ordreSecretaria
        .map(codi => periodesTots.find(p => p.codi === codi))
        .filter(Boolean)
    : periodesTots;

  // Filtrar els que ja existeixen a la classe
  const disponibles = periodesOrdenats.filter(p => !existentsNoms.includes(p.nom));

  if (disponibles.length === 0) {
    window.mostrarToast('Ja tens tots els períodes disponibles creats', 3000);
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = '_selectorPeriodes';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.4);
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:24px;width:100%;max-width:380px;
                box-shadow:0 20px 50px rgba(0,0,0,0.25);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:800;color:#1e1b4b;margin:0;">+ Nou període</h3>
        <button id="_btnTancarSP" style="background:none;border:none;font-size:20px;
          cursor:pointer;color:#9ca3af;line-height:1;">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:7px;">
        ${disponibles.map(p => {
          const tancat = tancats.includes(p.codi);
          return `
            <button class="btn-sel-periode" data-nom="${p.nom}" data-codi="${p.codi}" data-ordre="${p.ordre}"
              ${tancat ? 'disabled' : ''}
              style="padding:10px 14px;border-radius:9px;text-align:left;font-family:inherit;
                     border:1.5px solid ${tancat ? '#fef2f2' : '#e5e7eb'};
                     background:${tancat ? '#fef2f2' : '#fff'};
                     cursor:${tancat ? 'default' : 'pointer'};
                     display:flex;justify-content:space-between;align-items:center;
                     font-size:13px;font-weight:600;
                     color:${tancat ? '#dc2626' : '#1e1b4b'};">
              <span>${p.nom}</span>
              <span style="font-size:11px;font-weight:400;color:#9ca3af;">
                ${tancat ? '🔒 Tancat' : ''}
              </span>
            </button>`;
        }).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('#_btnTancarSP').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('.btn-sel-periode:not([disabled])').forEach(btn => {
    btn.style.transition = 'border-color 0.12s';
    btn.addEventListener('mouseenter', () => btn.style.borderColor = '#7c3aed');
    btn.addEventListener('mouseleave', () => btn.style.borderColor = '#e5e7eb');

    btn.addEventListener('click', async () => {
      const nom   = btn.dataset.nom;
      const ordre = parseInt(btn.dataset.ordre);
      const codi  = btn.dataset.codi;

      btn.innerHTML = '⏳ Creant...'; btn.disabled = true;

      try {
        // Usar la mateixa lògica que app.js internament
        // Accedim a window.currentPeriodes (exportat via defineProperty a app.js)
        const periodes = window.currentPeriodes || {};
        const nouId    = `p_${Date.now()}`;
        const maxOrdre = Object.keys(periodes).length === 0 ? 0
          : Math.max(...Object.values(periodes).map(p => p.ordre || 0)) + 1;

        periodes[nouId] = { nom, ordre: Math.max(ordre, maxOrdre), codi };

        await window.db.collection('classes').doc(window.currentClassId).update({
          periodes
        });

        // Actualitzar les variables d'app.js a través de window
        window.currentPeriodeId = nouId;
        window._tcClassId       = nouId;

        // Cridar les funcions d'app.js exportades
        if (typeof window.renderPeriodesTabs === 'function') window.renderPeriodesTabs();
        if (typeof window.renderStudentsList  === 'function') window.renderStudentsList();

        window.mostrarToast?.(`✅ Període "${nom}" creat`);
        overlay.remove();
      } catch(err) {
        console.error('Crear periode:', err);
        window.mostrarToast?.('❌ Error: ' + err.message);
        btn.disabled = false;
        btn.textContent = nom;
      }
    });
  });
}

// Activar: ocultar menú i patchejar botó quan es carrega una classe
const _initPeriodesPatch = () => {
  ocultarMenuPestanyes();

  // Esperar que el botó existeixi
  const tryPatch = () => {
    if (document.getElementById('btnAddPeriode')) {
      patchBotoAddPeriode();
    } else {
      setTimeout(tryPatch, 300);
    }
  };
  tryPatch();

  // Re-patchejar quan es renderitzen les tabs (app.js les recrea)
  if (typeof window.renderPeriodesTabs === 'function' && !window._ptPatchDone) {
    window._ptPatchDone = true;
    const _orig = window.renderPeriodesTabs;
    window.renderPeriodesTabs = function(p) {
      _orig(p);
      setTimeout(patchBotoAddPeriode, 50);
    };
  }
};

// Esperar que app.js hagi exportat renderPeriodesTabs
const _waitAndInit = () => {
  if (typeof window.renderPeriodesTabs === 'function') {
    _initPeriodesPatch();
  } else {
    setTimeout(_waitAndInit, 300);
  }
};
setTimeout(_waitAndInit, 500);

