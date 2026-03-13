// app-patch.js — v2
// 1. Integra rols amb app.js (injecta botons sidebar)
// 2. Intercepta "Crear classe" per mostrar desplegable de grups centre
// 3. Fix: botó Professor (alias btnTutoria per compatibilitat)

console.log('🔧 app-patch.js carregat');

/* ══════════════════════════════════════════════════════
   INIT — esperar Firebase + usuari autenticat
══════════════════════════════════════════════════════ */
firebase.auth().onAuthStateChanged(async user => {
  if (!user) return;

  // Esperar que rols.js hagi carregat carregarPerfilUsuari
  await esperarFn('carregarPerfilUsuari', 6000);

  try {
    await window.carregarPerfilUsuari(user.uid);
    window.actualitzarUIRols();
    await verificarPasswordChange(user);
  } catch(e) {
    console.error('app-patch init:', e);
  }

  // Interceptar creació de classe
  interceptarCrearClasse();

  // Alias btnTutoria → btnProfessor per compatibilitat amb app.js
  patchBotoTutoriaAlias();
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
      Selecciona un grup de Secretaria per crear la teva classe amb els alumnes ja carregats.
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

    <!-- Selector Grup/Matèria/Projecte -->
    <div style="margin-bottom:12px;">
      <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
        Grup / Matèria / Projecte
      </label>
      <select id="patchSelGrup" style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;
              border-radius:9px;font-size:14px;outline:none;background:#f9fafb;" disabled>
        <option value="">— Primer tria un nivell —</option>
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

  // Carregar nivells
  carregarOpcionesNivells();

  // Selector nivell → emplenar grups
  document.getElementById('patchSelNivell').addEventListener('change', async (e) => {
    const nivellId = e.target.value;
    const selGrup = document.getElementById('patchSelGrup');
    selGrup.innerHTML = `<option value="">⏳ Carregant grups...</option>`;
    selGrup.disabled = true;
    document.getElementById('patchBtnCrearClasse').disabled = true;
    document.getElementById('patchInfoAlumnes').textContent = 'Selecciona un grup per veure els alumnes.';

    if (!nivellId) {
      selGrup.innerHTML = `<option value="">— Primer tria un nivell —</option>`;
      return;
    }

    try {
      const snap = await window.db.collection('grups_centre')
        .where('nivellId','==',nivellId)
        .get();
      const grups = snap.docs.map(d=>({id:d.id,...d.data()}))
        .sort((a,b)=>(a.ordre||99)-(b.ordre||99));

      if (grups.length === 0) {
        selGrup.innerHTML = `<option value="">Cap grup en aquest nivell</option>`;
        return;
      }

      // Agrupar per tipus
      const perTipus = {};
      grups.forEach(g => {
        if (!perTipus[g.tipus]) perTipus[g.tipus]=[];
        perTipus[g.tipus].push(g);
      });

      const TIPUS = {classe:'🏫 Grups classe',materia:'📚 Matèries',projecte:'🔬 Projectes',optativa:'🎨 Optatives'};
      selGrup.innerHTML = `<option value="">— Tria el grup —</option>` +
        Object.entries(perTipus).map(([t,gs])=>`
          <optgroup label="${TIPUS[t]||t}">
            ${gs.map(g=>`
              <option value="${g.id}"
                data-nom="${esH(g.nom)}"
                data-nivell="${esH(g.nivellNom||'')}"
                data-num-alumnes="${(g.alumnes||[]).length}"
                data-alumnes='${JSON.stringify(g.alumnes||[])}'>
                ${g.nom} (${(g.alumnes||[]).length} alumnes)
              </option>
            `).join('')}
          </optgroup>
        `).join('');
      selGrup.disabled = false;
    } catch(e) {
      selGrup.innerHTML = `<option value="">Error carregant grups</option>`;
      console.error(e);
    }
  });

  // Selector grup → mostrar info alumnes
  document.getElementById('patchSelGrup').addEventListener('change', (e) => {
    const opt = e.target.options[e.target.selectedIndex];
    const btnCrear = document.getElementById('patchBtnCrearClasse');
    const info = document.getElementById('patchInfoAlumnes');

    if (!e.target.value) {
      btnCrear.disabled = true;
      info.textContent = 'Selecciona un grup per veure els alumnes.';
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
  const sel = document.getElementById('patchSelNivell');
  if (!sel) return;
  try {
    const snap = await window.db.collection('nivells_centre').orderBy('ordre').get();
    if (snap.empty) {
      sel.innerHTML = `<option value="">⚠️ Cap nivell creat per Secretaria</option>`;
      return;
    }
    sel.innerHTML = `<option value="">— Tria un nivell —</option>` +
      snap.docs.map(d=>`<option value="${d.id}">${esH(d.data().nom)} (${esH(d.data().curs||'')})</option>`).join('');
  } catch(e) {
    sel.innerHTML = `<option value="">Error carregant nivells: ${e.message}</option>`;
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
  const selGrup   = document.getElementById('patchSelGrup');
  const btn       = document.getElementById('patchBtnCrearClasse');

  const grupId = selGrup.value;
  if (!grupId) { window.mostrarToast('⚠️ Tria un grup'); return; }

  const opt = selGrup.options[selGrup.selectedIndex];
  const nomGrup    = opt.dataset.nom || opt.textContent.split('(')[0].trim();
  const nivellNom  = opt.dataset.nivell || selNivell.options[selNivell.selectedIndex]?.text?.split('(')[0]?.trim() || '';
  const alumnesCentre = JSON.parse(opt.dataset.alumnes||'[]');

  btn.disabled = true;
  btn.textContent = '⏳ Creant...';

  try {
    const db = window.db;
    const professorUID = firebase.auth().currentUser?.uid;

    // Nom complet de la classe: "3A — 3r ESO" o simplement "3A"
    const nomClasse = nivellNom ? `${nomGrup} — ${nivellNom}` : nomGrup;

    // Crear la classe
    const classeRef = db.collection('classes').doc();
    
    // Crear els alumnes a la col·lecció alumnes
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
        grupCentreId: grupId,
      });
      alumneIds.push(alRef.id);
    }

    // Crear la classe amb els alumnes
    batch.set(classeRef, {
      nom:         nomClasse,
      nomGrup:     nomGrup,
      nivellNom,
      grupCentreId: grupId,
      alumnes:     alumneIds,
      ownerUid:    professorUID,
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
    if (typeof window.loadClassesScreen === 'function') {
      // No és accessible directament, però podem recarregar la pàgina o fer trigger
      // Cridem a l'event de tecla Escape per tancar el modal
    }

    // Recarregar la vista de classes (app.js ho exposa com a global)
    setTimeout(() => {
      // app.js no exposa loadClassesScreen, però podem fer servir el botó "Grups"
      document.getElementById('navClasses')?.click();
    }, 300);

  } catch(e) {
    console.error('Error creant classe:', e);
    window.mostrarToast('❌ Error: ' + e.message, 5000);
    btn.disabled = false;
    btn.textContent = 'Crear classe';
  }
}

/* ══════════════════════════════════════════════════════
   ACTUALITZAR UI ROLS — estén rols.js per cridar injectadors
══════════════════════════════════════════════════════ */
const _origActUIRols = window.actualitzarUIRols;
window.actualitzarUIRols = function() {
  _origActUIRols?.();
  const rols = window._userRols || [];
  if (rols.some(r=>['secretaria','admin','superadmin'].includes(r)))
    window.injectarBotoSecretaria?.();
  if (rols.some(r=>['tutor','admin','superadmin'].includes(r)))
    window.injectarBotoTutoria?.();
  if (rols.some(r=>['revisor','admin','superadmin'].includes(r)))
    window.injectarBotoRevisor?.();
};

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

console.log('✅ app-patch.js v2: integració completada');
