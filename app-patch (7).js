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

    // Recarregar la vista de classes immediatament
    setTimeout(() => {
      if (typeof window.loadClassesScreen === 'function') {
        window.loadClassesScreen();
      } else {
        // Fallback: click al botó de navegació
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

    // Escoltar canvis al grup del centre
    const unsub = window.db.collection('grups_centre').doc(grupCentreId)
      .onSnapshot(snap => {
        if (!snap.metadata.hasPendingWrites && !snap.metadata.fromCache && snap.exists) {
          const alumnesCentre = snap.data()?.alumnes || [];
          if (!alumnesCentre.length) return;
          // Async check en IIFE
          (async () => {
            try {
              const classId = window.currentClassId;
              if (!classId) return;
              const classeDoc2 = await window.db.collection('classes').doc(classId).get();
              const alumnesIds = classeDoc2?.data()?.alumnes || [];
              // Carregar RALCs dels alumnes actuals (mostra de 5 per velocitat)
              const sampleDocs = await Promise.all(
                alumnesIds.slice(0,10).map(id => window.db.collection('alumnes').doc(id).get())
              );
              const ralcsClasse = new Set(sampleDocs.map(d=>d.data()?.ralc).filter(Boolean));
              const ralcsCentre = alumnesCentre.map(a=>a.ralc).filter(Boolean);
              const novsRalcs = ralcsCentre.filter(r => r && !ralcsClasse.has(r));
              if (novsRalcs.length > 0 && !document.getElementById('_bannerActualitzacio')) {
                // Verificar que no s'hagi ja resolt per a aquest grup+classe
                const resolKey = `_bannerResolt_${window.currentClassId}_${grupCentreId}`;
                const jaResolt = sessionStorage.getItem(resolKey);
                if (!jaResolt) {
                  mostrarBannerActualitzacio(alumnesCentre.length, alumnesIds.length, grupCentreId);
                }
              }
            } catch(e) {}
          })();
        }
      }, () => {});

    // Netejar listener quan es canvia de classe
    window._unsubGrupCentre = unsub;
  }).catch(()=>{});
}

function mostrarBannerActualitzacio(nCentre, nClasse, grupCentreId) {
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
      <button id="_btnTancarBanner" style="padding:8px 14px;background:rgba(255,255,255,0.3);
        color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">
        Ara no
      </button>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById('_btnTancarBanner').addEventListener('click', () => {
    // Marcar com ignorat per a aquesta sessió
    sessionStorage.setItem(`_bannerResolt_${window.currentClassId}_${grupCentreId}`, '1');
    banner.remove();
  });

  document.getElementById('_btnActualitzarClasse').addEventListener('click', async () => {
    banner.innerHTML = '<div style="padding:4px 20px;">⏳ Actualitzant alumnes...</div>';
    try {
      const grupDoc = await window.db.collection('grups_centre').doc(grupCentreId).get();
      const alumnesCentre = grupDoc.data()?.alumnes || [];
      const classId = window.currentClassId;

      // Crear alumnes nous a la col·lecció alumnes
      const classeDoc = await window.db.collection('classes').doc(classId).get();
      const alumnesActuals = classeDoc.data()?.alumnes || [];

      // Llegir RALCs i noms actuals
      const docsActuals = await Promise.all(
        alumnesActuals.map(id => window.db.collection('alumnes').doc(id).get())
      );
      const ralcsActuals = new Set(docsActuals.map(d=>d.data()?.ralc).filter(Boolean));
      const nomsActuals  = new Set(docsActuals.map(d=>`${d.data()?.nom}_${d.data()?.cognoms}`));

      const nousBatch = window.db.batch();
      const nousIds = [...alumnesActuals];
      const profUID = firebase.auth().currentUser?.uid;

      for (const a of alumnesCentre) {
        const key = `${a.nom}_${a.cognoms}`;
        if ((a.ralc && ralcsActuals.has(a.ralc)) || nomsActuals.has(key)) continue;
        const ref = window.db.collection('alumnes').doc();
        nousBatch.set(ref, {
          nom: a.nom, cognoms: a.cognoms, ralc: a.ralc||'',
          comentari:'', ownerUid: profUID, classId
        });
        nousIds.push(ref.id);
      }
      nousBatch.update(window.db.collection('classes').doc(classId), { alumnes: nousIds });
      await nousBatch.commit();

      // Marcar com resolt per a aquesta sessió
      sessionStorage.setItem(`_bannerResolt_${window.currentClassId}_${grupCentreId}`, '1');
      banner.remove();
      const nouCount = nousIds.length - alumnesActuals.length;
      window.mostrarToast?.(`✅ ${nouCount} alumnes nous afegits`);
      // Recarregar la classe completament
      if (typeof window.renderStudentsList === 'function') {
        // Actualitzar classStudents directament
        window.classStudents = nousIds;
        window.renderStudentsList();
      }
      // Forçar recàrrega completa de la classe si la funció és accessible
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
    #modalClassroomImport {
      display: none !important;
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
  const existents = Object.keys(window.currentPeriodes || {}).map(pid => {
    return window.currentPeriodes[pid].nom;
  });

  // Períodes tancats per secretaria
  let tancats = [];
  try {
    const doc = await window.db.collection('_sistema').doc('periodes_tancats').get();
    tancats = doc.data()?.tancats || [];
  } catch(e) {}

  // Períodes disponibles per afegir
  const disponibles = PERIODES_FIXES_PROF.filter(p => !existents.includes(p.nom));

  if (disponibles.length === 0) {
    window.mostrarToast('Ja tens tots els períodes creats', 3000);
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
        ${PERIODES_FIXES_PROF.map(p => {
          const jaExisteix = existents.includes(p.nom);
          const tancat     = tancats.includes(p.codi);
          const blocat     = jaExisteix || tancat;
          return `
            <button class="btn-sel-periode" data-nom="${p.nom}" data-codi="${p.codi}" data-ordre="${p.ordre}"
              ${blocat ? 'disabled' : ''}
              style="padding:10px 14px;border-radius:9px;text-align:left;font-family:inherit;
                     border:1.5px solid ${blocat ? '#f3f4f6' : '#e5e7eb'};
                     background:${tancat ? '#fef2f2' : jaExisteix ? '#f9fafb' : '#fff'};
                     cursor:${blocat ? 'default' : 'pointer'};
                     display:flex;justify-content:space-between;align-items:center;
                     font-size:13px;font-weight:600;
                     color:${tancat ? '#dc2626' : jaExisteix ? '#9ca3af' : '#1e1b4b'};">
              <span>${p.nom}</span>
              <span style="font-size:11px;font-weight:400;color:#9ca3af;">
                ${tancat ? '🔒 Tancat' : jaExisteix ? '✓ Ja creat' : ''}
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

