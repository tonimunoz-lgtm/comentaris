// pi.js — Injector per a Plans Individualitzats (PI)
// Visible únicament per al perfil pedagog (i admin/superadmin)
//
// Funcions:
//   1. Botó "📋 PI" dins del panell de Tutoria (sol visible per pedagog/admin)
//   2. Formulari: seleccionar nivell/grup → llista alumnes tutoria → crear/editar PI per alumne
//   3. Icona "PI" visible a la llista tutoria i a la llista de professors (studentsList)
//   4. Secció PI al detall de tutoria (sota Autodiagnosi)
//
// Col·lecció Firestore: plans_individualitzats/{ralc}
//   ralc: string (identificador de l'alumne)
//   motiu: string
//   tipus: 'metodologica' | 'curricular'
//   adaptacio: string
//   creatPer: uid
//   creatAt: timestamp
//   updatedAt: timestamp
//   actiu: boolean
//
// INSTAL·LACIÓ: afegir a index.html ABANS de </body>:
//   <script type="module" src="pi.js"></script>

console.log('📋 pi.js carregat');

const PI_COL = 'plans_individualitzats';

/* ══════════════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════════════ */
function piEsH(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function esPedagogPI() {
  const rols = window._userRols || [];
  return rols.includes('pedagog') || rols.includes('admin') ||
         rols.includes('superadmin') || window._isSuperAdmin === true;
}

/* ══════════════════════════════════════════════════════
   CACHE de PIs en memòria (per als badges)
══════════════════════════════════════════════════════ */
let _piCache = null;       // Map: ralc → docData
let _piCacheTs = 0;
let _piListener = null;    // onSnapshot unsub

function iniciarListenerPI() {
  if (_piListener) return;
  try {
    _piListener = window.db.collection(PI_COL)
      .where('actiu', '==', true)
      .onSnapshot(snap => {
        _piCache = new Map();
        snap.docs.forEach(d => _piCache.set(d.id, d.data()));
        _piCacheTs = Date.now();
        // Actualitzar badges a les llistes visibles
        actualitzarBadgesPI();
      }, err => {
        console.warn('pi.js: error listener', err);
        _piCache = null;
      });
  } catch(e) {
    console.warn('pi.js: no s\'ha pogut iniciar el listener', e);
  }
}

async function getPICache() {
  if (_piCache) return _piCache;
  // Càrrega inicial si el listener no ha disparat encara
  try {
    const snap = await window.db.collection(PI_COL).where('actiu','==',true).get();
    _piCache = new Map();
    snap.docs.forEach(d => _piCache.set(d.id, d.data()));
    _piCacheTs = Date.now();
    return _piCache;
  } catch(e) {
    return new Map();
  }
}

function tePI(ralc) {
  if (!ralc || !_piCache) return false;
  return _piCache.has(String(ralc));
}

/* ══════════════════════════════════════════════════════
   INICIALITZACIÓ
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initPI, 2000);
});

function initPI() {
  if (!window.firebase?.auth) { setTimeout(initPI, 500); return; }
  window.firebase.auth().onAuthStateChanged(user => {
    if (!user) return;
    iniciarListenerPI();
    observarPanellTutoriaPI();
    observarStudentsListPI();
    observarDetallTutoriaPI();
  });
}

/* ══════════════════════════════════════════════════════
   OBSERVER 1: Injectar botó PI dins del panell Tutoria
   (sol per pedagog/admin)
══════════════════════════════════════════════════════ */
let _piTutoriaObserver = null;

function observarPanellTutoriaPI() {
  if (_piTutoriaObserver) return;
  _piTutoriaObserver = new MutationObserver(() => {
    const header = document.querySelector('#panellTutoria [id="btnTancarTutoria"]')?.parentElement;
    if (!header) return;
    if (document.getElementById('btnPITutoria')) return;
    if (!esPedagogPI()) return;

    const btn = document.createElement('button');
    btn.id = 'btnPITutoria';
    btn.title = 'Plans Individualitzats';
    btn.style.cssText = `
      padding:7px 14px;background:rgba(255,255,255,0.2);color:#fff;
      border:1.5px solid rgba(255,255,255,0.4);border-radius:8px;
      font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;
      transition:background .15s;
    `;
    btn.textContent = '📋 PI';
    btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.35)';
    btn.onmouseout  = () => btn.style.background = 'rgba(255,255,255,0.2)';
    btn.addEventListener('click', obrirPanellPI);

    // Inserir just abans del botó de tancar
    const btnTancar = document.getElementById('btnTancarTutoria');
    if (btnTancar) {
      // Buscar el div de botons (pare del botó tancar)
      const containerBotons = btnTancar.parentElement;
      containerBotons.insertBefore(btn, btnTancar);
    } else {
      header.appendChild(btn);
    }
  });
  _piTutoriaObserver.observe(document.body, { childList: true, subtree: true });
}

/* ══════════════════════════════════════════════════════
   OBSERVER 2: Badge PI a la llista d'alumnes del professor
   (#studentsList li[data-id])
══════════════════════════════════════════════════════ */
let _piStudentsObserver = null;
let _piActualitzant = false; // flag per evitar que l'observer es dispari per les seves pròpies mutacions

function observarStudentsListPI() {
  if (_piStudentsObserver) return;

  const afegirBadgesStudentsList = async () => {
    if (_piActualitzant) return; // ignorar mutacions provocades per nosaltres mateixos
    const llista = document.getElementById('studentsList');
    if (!llista) return;
    const cache = await getPICache();
    llista.querySelectorAll('li[data-id]').forEach(li => {
      afegirBadgePIaLI(li, cache);
    });
  };

  _piStudentsObserver = new MutationObserver(() => {
    afegirBadgesStudentsList();
  });

  const tryObserve = () => {
    const llista = document.getElementById('studentsList');
    if (llista) {
      _piStudentsObserver.observe(llista, { childList: true, subtree: true });
      afegirBadgesStudentsList();
    } else {
      setTimeout(tryObserve, 600);
    }
  };
  tryObserve();
}

async function afegirBadgePIaLI(li, cache) {
  if (li.querySelector('.badge-pi')) return; // ja té badge
  if (li.dataset.piFetching) return; // evitar crides concurrent
  // Obtenir RALC de l'alumne: des de data-ralc o des de Firestore
  let ralc = li.dataset.ralc;
  if (!ralc) {
    li.dataset.piFetching = '1';
    const alumneId = li.dataset.id;
    if (!alumneId) { delete li.dataset.piFetching; return; }
    try {
      const doc = await window.db.collection('alumnes').doc(alumneId).get();
      if (!doc.exists) { delete li.dataset.piFetching; return; }
      ralc = doc.data().ralc || '';
      if (ralc) li.dataset.ralc = ralc; // cache al DOM
    } catch(e) { delete li.dataset.piFetching; return; }
    delete li.dataset.piFetching;
  }
  if (!ralc) return;
  const c = cache || _piCache;
  if (!c?.has(String(ralc))) return;

  // Afegir badge PI
  const badge = document.createElement('span');
  badge.className = 'badge-pi';
  badge.title = 'Aquest alumne té un Pla Individualitzat actiu';
  badge.style.cssText = `
    display:inline-flex;align-items:center;justify-content:center;
    background:#7c3aed;color:#fff;border-radius:5px;
    font-size:9px;font-weight:800;padding:1px 5px;margin-left:5px;
    vertical-align:middle;line-height:1.4;letter-spacing:.02em;
  `;
  badge.textContent = 'PI';

  // Inserir al costat del nom
  const nomSpan = li.querySelector('.student-name');
  if (nomSpan) {
    nomSpan.parentElement.insertBefore(badge, nomSpan.nextSibling);
  } else {
    li.appendChild(badge);
  }
}

function actualitzarBadgesPI() {
  _piActualitzant = true;
  // Actualitzar studentsList
  const llista = document.getElementById('studentsList');
  if (llista) {
    // Eliminar badges obsolets i re-afegir (sense esborrar dataset.ralc!)
    llista.querySelectorAll('.badge-pi').forEach(b => b.remove());
    llista.querySelectorAll('li[data-id]').forEach(li => {
      afegirBadgePIaLI(li, _piCache);
    });
  }

  // Actualitzar llista tutoria
  actualitzarBadgesPITutoria();
  setTimeout(() => { _piActualitzant = false; }, 500);
}

/* ══════════════════════════════════════════════════════
   OBSERVER 3: Badge PI a la llista del panell Tutoria
   (.alumne-semafor-item)
══════════════════════════════════════════════════════ */
let _piLlistaTutoriaObserver = null;

function actualitzarBadgesPITutoria() {
  const llistaTutoria = document.getElementById('llistaTutoria');
  if (!llistaTutoria) return;
  llistaTutoria.querySelectorAll('.alumne-semafor-item').forEach(el => {
    afegirBadgePIaTutoriaItem(el);
  });
}

// Mapa nom complet → ralc per als badges de la llista tutoria
// Es construeix quan la llista carrega alumnes d'un grup
let _piNomARalcMap = new Map();

window._piRegistrarAlumnesTutoria = function(alumnes) {
  // Cridat des de tutoria-nova.js o des de l'observer quan detectem alumnes carregats
  // alumnes: [{ nom, cognoms, ralc, ... }]
  _piNomARalcMap = new Map();
  (alumnes || []).forEach(a => {
    const nomComplet = a.cognoms ? `${a.cognoms}, ${a.nom}` : (a.nom || '');
    if (a.ralc && nomComplet) _piNomARalcMap.set(nomComplet.trim(), String(a.ralc));
  });
  // Aplicar badges immediatament ara que tenim el mapa
  setTimeout(actualitzarBadgesPITutoria, 50);
};

function afegirBadgePIaTutoriaItem(el) {
  if (el.querySelector('.badge-pi-tutoria')) return;
  if (!_piCache) return;

  // Intent 1: data-ralc directe (ara sempre disponible gràcies a tutoria-nova.js)
  let ralc = el.dataset.ralc;

  // Intent 2: buscar per nom en el mapa nom→ralc (fallback)
  if (!ralc) {
    const nomDiv = el.querySelector('div[style*="font-weight:600"]');
    const nom = nomDiv?.textContent?.trim();
    if (nom) ralc = _piNomARalcMap.get(nom);
  }

  if (!ralc || !_piCache.has(String(ralc))) return;

  const nomDiv = el.querySelector('div[style*="font-weight:600"]');
  if (!nomDiv) return;

  const badge = document.createElement('span');
  badge.className = 'badge-pi-tutoria';
  badge.title = 'Pla Individualitzat actiu';
  badge.style.cssText = `
    display:inline-flex;align-items:center;
    background:#7c3aed;color:#fff;border-radius:5px;
    font-size:9px;font-weight:800;padding:1px 5px;margin-left:6px;
    vertical-align:middle;letter-spacing:.02em;
  `;
  badge.textContent = 'PI';
  nomDiv.appendChild(badge);
}

// Observer per quan es renderitza la llistaTutoria
function observarLlistaTutoriaPI() {
  if (_piLlistaTutoriaObserver) return;
  const tryObs = () => {
    const llista = document.getElementById('llistaTutoria');
    if (!llista) { setTimeout(tryObs, 700); return; }
    _piLlistaTutoriaObserver = new MutationObserver(() => {
      setTimeout(actualitzarBadgesPITutoria, 100);
    });
    _piLlistaTutoriaObserver.observe(llista, { childList: true, subtree: true });
  };
  tryObs();
}

// Iniciar observer de llista tutoria quan s'obre el panell
new MutationObserver(() => {
  if (document.getElementById('llistaTutoria')) {
    observarLlistaTutoriaPI();
    actualitzarBadgesPITutoria();
  }
}).observe(document.body, { childList: true, subtree: true });

// Observer que, quan llistaTutoria rep contingut nou,
// carrega el mapa nom→ralc des del grup seleccionat
async function carregarMapaNomRalcTutoria() {
  const grupId = document.querySelector('#selGrupTutoria')?.value;
  if (!grupId) return;
  try {
    const grupDoc = await window.db.collection('grups_centre').doc(grupId).get();
    const alumnes = grupDoc.data()?.alumnes || [];
    // Si és grup tutoria, llegir alumnes del pare
    if (grupDoc.data()?.tipus === 'tutoria' && grupDoc.data()?.parentGrupId) {
      const pareDoc = await window.db.collection('grups_centre').doc(grupDoc.data().parentGrupId).get();
      window._piRegistrarAlumnesTutoria(pareDoc.data()?.alumnes || alumnes);
    } else {
      window._piRegistrarAlumnesTutoria(alumnes);
    }
    // Re-aplicar badges ara que tenim el mapa
    setTimeout(actualitzarBadgesPITutoria, 50);
  } catch(e) {}
}

// Detectar quan llistaTutoria rep nous items (carrega d'alumnes)
let _piMapaTimer = null;
new MutationObserver(() => {
  const llista = document.getElementById('llistaTutoria');
  if (!llista) return;
  if (llista.querySelector('.alumne-semafor-item')) {
    clearTimeout(_piMapaTimer);
    _piMapaTimer = setTimeout(carregarMapaNomRalcTutoria, 200);
  }
}).observe(document.body, { childList: true, subtree: true });


/* ══════════════════════════════════════════════════════
   OBSERVER 4: Injectar secció PI al detall d'alumne de Tutoria
   (sota la secció Autodiagnosi)
══════════════════════════════════════════════════════ */
function observarDetallTutoriaPI() {
  const obsDetall = new MutationObserver(async () => {
    const detall = document.getElementById('detallAlumneTutoria');
    if (!detall || detall.children.length === 0) return;
    if (detall.querySelector('#piTutoriaSection')) return;
    if (detall.dataset.piInjectant) return;
    // Netejar comentari anterior si n'hi ha (alumne nou)
    detall.querySelector('#comentariTutoriaSection')?.remove();
    // Desconnectar l'observer mentre injectem per evitar bucles
    obsDetall.disconnect();
    await injectarSeccioPI(detall);
    // Reconnectar
    obsDetall.observe(detall, { childList: true });
  });

  const tryObs = () => {
    const detall = document.getElementById('detallAlumneTutoria');
    if (detall) {
      obsDetall.observe(detall, { childList: true });
    } else {
      setTimeout(tryObs, 800);
    }
  };
  tryObs();

  // Re-bind quan s'obre el panell tutoria
  new MutationObserver(() => {
    const detall = document.getElementById('detallAlumneTutoria');
    if (detall && !detall.dataset.piObserved) {
      obsDetall.observe(detall, { childList: true });
      detall.dataset.piObserved = '1';
    }
  }).observe(document.body, { childList: true });
}

async function injectarSeccioPI(detallEl) {
  // Guard addicional per si l'observer es reconnecta abans que acabem
  if (detallEl.dataset.piInjectant) return;
  detallEl.dataset.piInjectant = '1';

  // Extreure RALC del contingut del detall (tutoria-nova.js el posa com "RALC: XXXX")
  const matchRalc = detallEl.innerHTML.match(/RALC[:\s]+([A-Za-z0-9]+)/);
  const ralc = matchRalc?.[1]?.trim();
  if (!ralc) { delete detallEl.dataset.piInjectant; return; }

  let piData = null;
  try {
    const doc = await window.db.collection(PI_COL).doc(String(ralc)).get();
    if (doc.exists && doc.data().actiu) piData = doc.data();
  } catch(e) { delete detallEl.dataset.piInjectant; return; }

  const seccio = document.createElement('div');
  seccio.id = 'piTutoriaSection';
  seccio.style.cssText = 'margin-top:20px;';

  if (!piData) {
    // No té PI — si és pedagog, mostrar botó per crear-ne un
    if (!esPedagogPI()) { delete detallEl.dataset.piInjectant; return; } // no pedagog, no mostrar res
    seccio.innerHTML = `
      <div style="background:#f5f3ff;border:1.5px solid #c4b5fd;border-radius:14px;padding:16px 20px;">
        <div style="font-size:13px;font-weight:700;color:#4c1d95;margin-bottom:8px;">📋 Pla Individualitzat</div>
        <p style="font-size:12px;color:#6b7280;margin-bottom:12px;">Aquest alumne no té cap PI actiu.</p>
        <button class="btn-crear-pi-detall" data-ralc="${piEsH(ralc)}"
          style="padding:7px 16px;background:#7c3aed;color:#fff;border:none;border-radius:8px;
                 font-size:12px;font-weight:700;cursor:pointer;">
          ➕ Crear PI
        </button>
      </div>`;
    seccio.querySelector('.btn-crear-pi-detall')?.addEventListener('click', () => {
      obrirFormulariPI(ralc, null, () => {
        detallEl.querySelector('#piTutoriaSection')?.remove();
        injectarSeccioPI(detallEl);
      });
    });
  } else {
    const tipusLabel = piData.tipus === 'curricular' ? '📚 Curricular' : '🔧 Metodològica';
    const data = piData.updatedAt?.toDate?.()?.toLocaleDateString('ca-ES') ||
                 piData.creatAt?.toDate?.()?.toLocaleDateString('ca-ES') || '—';
    seccio.innerHTML = `
      <div style="background:#f5f3ff;border:1.5px solid #7c3aed;border-radius:14px;padding:16px 20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-size:13px;font-weight:700;color:#4c1d95;">
            📋 Pla Individualitzat
            <span style="background:#7c3aed;color:#fff;border-radius:5px;
                         font-size:10px;padding:1px 7px;margin-left:6px;">${tipusLabel}</span>
          </div>
          <div style="font-size:11px;color:#9ca3af;">Actualitzat: ${data}</div>
        </div>
        <div style="margin-bottom:10px;">
          <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:3px;">Motiu de l'adaptació:</div>
          <div style="font-size:12px;color:#374151;line-height:1.6;white-space:pre-wrap;">${piEsH(piData.motiu)}</div>
        </div>
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:3px;">Adaptació:</div>
          <div style="font-size:12px;color:#374151;line-height:1.6;white-space:pre-wrap;">${piEsH(piData.adaptacio)}</div>
        </div>
        ${esPedagogPI() ? `
        <button class="btn-editar-pi-detall" data-ralc="${piEsH(ralc)}"
          style="padding:6px 14px;background:rgba(124,58,237,0.1);color:#4c1d95;
                 border:1.5px solid #c4b5fd;border-radius:8px;font-size:12px;
                 font-weight:700;cursor:pointer;">
          ✏️ Editar PI
        </button>` : ''}
      </div>
      ${piData.documentURL ? `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #ede9fe;">
        <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:6px;">📎 Document adjunt:</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <a href="${piEsH(piData.documentURL)}" target="_blank"
            style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;
                   background:#7c3aed;color:#fff;border-radius:8px;font-size:12px;
                   font-weight:700;text-decoration:none;">
            👁 ${piEsH(piData.documentNom || 'Veure document')}
          </a>
          ${esPedagogPI() ? `
          <button class="btn-eliminar-doc-pi" data-ralc="${piEsH(ralc)}" data-nom="${piEsH(piData.documentNom||'')}"
            style="padding:6px 12px;background:#fee2e2;color:#dc2626;border:1.5px solid #fca5a5;
                   border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
            🗑 Eliminar
          </button>` : ''}
        </div>
      </div>` : ''}
    </div>`;
    seccio.querySelector('.btn-editar-pi-detall')?.addEventListener('click', () => {
      obrirFormulariPI(ralc, piData, () => {
        detallEl.querySelector('#piTutoriaSection')?.remove();
        injectarSeccioPI(detallEl);
      });
    });

    seccio.querySelector('.btn-eliminar-doc-pi')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const nomFitxer = btn.dataset.nom;
      if (!confirm('Segur que vols eliminar el document adjunt?')) return;
      btn.disabled = true; btn.textContent = '⏳...';
      try {
        if (nomFitxer) {
          await firebase.storage().ref(`plans_individualitzats/${ralc}/${nomFitxer}`).delete();
        }
        await window.db.collection(PI_COL).doc(String(ralc)).update({
          documentURL: null,
          documentNom: null,
        });
        window.mostrarToast('🗑 Document eliminat', 3000);
        detallEl.querySelector('#piTutoriaSection')?.remove();
        injectarSeccioPI(detallEl);
      } catch(err) {
        window.mostrarToast('❌ Error: ' + err.message, 4000);
        btn.disabled = false; btn.textContent = '🗑 Eliminar';
      }
    });
  }

  // Inserir: Autodiagnosi → Comentari Tutor/a → PI
  // Primer injectar el comentari de tutoria (si no existeix ja)
  if (!detallEl.querySelector('#comentariTutoriaSection')) {
    await injectarComentariTutoria(detallEl);
  }

  const comentariSec = detallEl.querySelector('#comentariTutoriaSection');
  const adSection    = detallEl.querySelector('#adTutoriaSection');
  if (comentariSec) {
    comentariSec.after(seccio);
  } else if (adSection) {
    adSection.after(seccio);
  } else {
    detallEl.appendChild(seccio);
  }

  delete detallEl.dataset.piInjectant;
}

async function injectarComentariTutoria(detallEl) {
  const matchRalc = detallEl.innerHTML.match(/RALC[:\s]+([A-Za-z0-9]+)/);
  const ralc = matchRalc?.[1]?.trim();
  if (!ralc) return;

  let comentari = '';
  try {
    const db = window.db;

    const grupId = document.getElementById('selGrupTutoria')?.value || '';
    const curs   = document.getElementById('selCursTutoria')?.value
                || document.getElementById('selCurs')?.value
                || window._cursActiu || '';
    const periodeEl = document.getElementById('selPeriodeTutoria')
                   || document.getElementById('selPeriode');
    const periode = periodeEl?.options?.[periodeEl?.selectedIndex]?.text?.trim() || '';

    if (!grupId || !curs) return;

    // Determinar quin és el grup tutoria: pot ser que selGrupTutoria ja sigui
    // el grup tutoria directament, o pot ser el grup classe (i cal buscar el fill tutoria)
    let grupTutoriaId = grupId;

    const grupDoc = await db.collection('grups_centre').doc(grupId).get();
    const grupData = grupDoc.data() || {};

    if (grupData.tipus !== 'tutoria') {
      // És un grup classe: buscar el fill de tipus tutoria
      const grupsSnap = await db.collection('grups_centre')
        .where('parentGrupId', '==', grupId)
        .where('tipus', '==', 'tutoria')
        .limit(1).get();
      if (grupsSnap.empty) return;
      grupTutoriaId = grupsSnap.docs[0].id;
    }

    // El grup classe pare (per filtrar els docs)
    const grupClasseId = grupData.tipus === 'tutoria'
      ? (grupData.parentGrupId || grupId)
      : grupId;

    // Buscar avaluació de tutoria per a aquest alumne
    let snap = await db.collection('avaluacio_centre')
      .doc(curs).collection(grupTutoriaId)
      .where('grupClasseId', '==', grupClasseId).get();
    if (snap.empty) {
      snap = await db.collection('avaluacio_centre')
        .doc(curs).collection(grupTutoriaId)
        .where('grupId', '==', grupClasseId).get();
    }
    // Fallback sense filtre de grup (per si les dades no tenen grupClasseId)
    if (snap.empty) {
      snap = await db.collection('avaluacio_centre')
        .doc(curs).collection(grupTutoriaId).get();
    }

    // Filtrar per RALC i període
    const docs = snap.docs.filter(d => {
      const data = d.data();
      return data.ralc === ralc && (!periode || data.periodeNom === periode);
    });

    if (docs.length > 0) {
      comentari = docs[0].data().comentariGlobal || '';
    }
  } catch(e) {
    console.warn('pi.js injectarComentariTutoria error:', e);
    return;
  }

  if (!comentari) return;

  const sec = document.createElement('div');
  sec.id = 'comentariTutoriaSection';
  sec.style.cssText = 'margin-top:20px;';
  sec.innerHTML = `
    <div style="border:1.5px solid #d1fae5;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#059669,#047857);padding:10px 16px;display:flex;align-items:center;gap:8px;">
        <span style="font-weight:800;color:#fff;font-size:14px;">💬 Comentari Tutor/a</span>
      </div>
      <div style="padding:14px 16px;font-size:13px;color:#1e1b4b;white-space:pre-wrap;line-height:1.6;background:#fff;">
        ${piEsH(comentari)}
      </div>
    </div>
  `;

  const adSection = detallEl.querySelector('#adTutoriaSection');
  if (adSection) {
    adSection.after(sec);
  } else {
    detallEl.appendChild(sec);
  }
}

/* ══════════════════════════════════════════════════════
   PANELL PRINCIPAL PI (des del botó al header de Tutoria)
══════════════════════════════════════════════════════ */
async function obrirPanellPI() {
  document.getElementById('panellPI')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'panellPI';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.8);
    display:flex;align-items:center;justify-content:center;padding:20px;
  `;

  overlay.innerHTML = `
    <div style="
      background:#fff;border-radius:20px;width:100%;max-width:960px;
      max-height:90vh;display:flex;flex-direction:column;overflow:hidden;
      box-shadow:0 25px 60px rgba(0,0,0,0.3);
    ">
      <!-- HEADER -->
      <div style="background:linear-gradient(135deg,#4c1d95,#7c3aed);color:#fff;
                  padding:18px 24px;flex-shrink:0;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h2 style="font-size:18px;font-weight:800;margin:0;">📋 Plans Individualitzats (PI)</h2>
          <p style="font-size:12px;opacity:0.7;margin:3px 0 0;">Gestió de plans d'adaptació per alumne</p>
        </div>
        <button id="btnTancarPI" style="background:rgba(255,255,255,0.2);border:none;
          color:#fff;width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer;">✕</button>
      </div>

      <!-- FILTRES -->
      <div style="padding:16px 24px;border-bottom:1px solid #e5e7eb;flex-shrink:0;background:#faf5ff;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end;">
          <div>
            <label style="font-size:11px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">CURS</label>
            <select id="piSelCurs" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
              <option value="">— Curs —</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">NIVELL</label>
            <select id="piSelNivell" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;" disabled>
              <option value="">— Nivell —</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">GRUP</label>
            <select id="piSelGrup" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;" disabled>
              <option value="">— Grup —</option>
            </select>
          </div>
          <button id="btnCarregarPI" style="padding:8px 18px;background:#7c3aed;color:#fff;
            border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">
            🔍 Carregar
          </button>
        </div>
      </div>

      <!-- COS: llista alumnes -->
      <div id="piCos" style="flex:1;overflow-y:auto;padding:20px 24px;">
        <div style="text-align:center;color:#9ca3af;padding:40px;">
          Selecciona curs, nivell i grup per veure els alumnes
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('#btnTancarPI').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Carregar cursos i grups
  await inicialitzarFiltresPI(overlay);
}

async function inicialitzarFiltresPI(overlay) {
  try {
    const snap = await window.db.collection('grups_centre').get();
    const totsGrups = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Mapa per resoldre parentGrupId
    const grupsPerId = {};
    totsGrups.forEach(g => { grupsPerId[g.id] = g; });

    // Grups útils: tutoria (tenen alumnes del grup classe) + fallback classe amb alumnes
    let grupsUtils = totsGrups.filter(g => g.tipus === 'tutoria');
    if (grupsUtils.length === 0) {
      grupsUtils = totsGrups.filter(g => g.tipus === 'classe' && (g.alumnes||[]).length > 0);
    }

    // Enriquir cada grup de tutoria amb el nom i dades del grup classe pare
    grupsUtils = grupsUtils.map(g => {
      if (g.tipus === 'tutoria' && g.parentGrupId) {
        const pare = grupsPerId[g.parentGrupId];
        return {
          ...g,
          nomMostrat: pare?.nom || g.nom,
          nivellNom:  g.nivellNom  || pare?.nivellNom  || '',
          curs:       g.curs       || pare?.curs        || '',
        };
      }
      return { ...g, nomMostrat: g.nom };
    });

    // Si cap grup tutoria té curs, intentar-lo llegir del grup pare
    // (fallback per dades antigues on el grup tutoria no tenia el camp curs)
    grupsUtils = grupsUtils.map(g => {
      if (!g.curs && g.parentGrupId) {
        const pare = grupsPerId[g.parentGrupId];
        return { ...g, curs: pare?.curs || '' };
      }
      return g;
    });

    const cursos = [...new Set(grupsUtils.map(g => g.curs).filter(Boolean))].sort().reverse();

    const selCurs   = overlay.querySelector('#piSelCurs');
    const selNivell = overlay.querySelector('#piSelNivell');
    const selGrup   = overlay.querySelector('#piSelGrup');
    const btnCar    = overlay.querySelector('#btnCarregarPI');

    selCurs.innerHTML = '<option value="">— Curs —</option>' +
      cursos.map(c => `<option value="${piEsH(c)}">${piEsH(c)}</option>`).join('');

    selCurs.addEventListener('change', () => {
      const curs = selCurs.value;
      const nivells = [...new Set(
        grupsUtils.filter(g => !curs || g.curs === curs).map(g => g.nivellNom).filter(Boolean)
      )].sort();
      selNivell.innerHTML = '<option value="">— Tots els nivells —</option>' +
        nivells.map(n => `<option value="${piEsH(n)}">${piEsH(n)}</option>`).join('');
      selNivell.disabled = false;
      actualitzarGrupsPI(curs, '', grupsUtils, selGrup);
    });

    selNivell.addEventListener('change', () => {
      actualitzarGrupsPI(selCurs.value, selNivell.value, grupsUtils, selGrup);
    });

    btnCar.addEventListener('click', async () => {
      const grupId = selGrup.value;
      if (!selCurs.value || !grupId) {
        window.mostrarToast('⚠️ Selecciona curs i grup', 3000);
        return;
      }
      await carregarAlumnesPI(grupId, grupsUtils, grupsPerId, overlay);
    });

  } catch(e) {
    console.error('pi.js inicialitzarFiltresPI:', e);
  }
}

function actualitzarGrupsPI(curs, nivell, grupsUtils, selGrup) {
  const filtrats = grupsUtils.filter(g =>
    (!curs   || g.curs === curs) &&
    (!nivell || g.nivellNom === nivell)
  ).sort((a,b) => (a.nivellNom||'').localeCompare(b.nivellNom||'','ca') ||
                  (a.nomMostrat||'').localeCompare(b.nomMostrat||'','ca'));

  selGrup.innerHTML = '<option value="">— Grup —</option>' +
    filtrats.map(g =>
      `<option value="${piEsH(g.id)}">${piEsH(g.nivellNom ? g.nivellNom + ' ' + g.nomMostrat : g.nomMostrat)}</option>`
    ).join('');
  selGrup.disabled = filtrats.length === 0;
}

async function carregarAlumnesPI(grupId, grupsUtils, grupsPerId, overlay) {
  const cos = overlay.querySelector('#piCos');
  cos.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:30px;">⏳ Carregant alumnes...</div>';

  try {
    // Llegir alumnes del grup
    const grupDoc = await window.db.collection('grups_centre').doc(grupId).get();
    const grupData = grupDoc.data() || {};
    let alumnes = grupData.alumnes || [];

    // Si és grup tutoria, llegir alumnes del grup pare
    if (grupData.tipus === 'tutoria' && grupData.parentGrupId) {
      const pareDoc = await window.db.collection('grups_centre').doc(grupData.parentGrupId).get();
      const alumnesPare = pareDoc.data()?.alumnes || [];
      // Usar els del pare si en té, sinó els del propi grup tutoria
      if (alumnesPare.length > 0) alumnes = alumnesPare;
    }

    // Fallback: si el grup classe és el seleccionat (no tutoria), llegir igualment
    // (ja cobert per alumnes = grupData.alumnes || [] anterior)

    if (alumnes.length === 0) {
      cos.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:30px;">Cap alumne en aquest grup.</div>';
      return;
    }

    // Llegir PIs existents
    const pisSnap = await window.db.collection(PI_COL).get();
    const pisMap = new Map();
    pisSnap.docs.forEach(d => { if (d.data().actiu) pisMap.set(d.id, d.data()); });

    alumnes.sort((a,b) => (a.cognoms||a.nom||'').localeCompare(b.cognoms||b.nom||'','ca'));

    const tipusLabel = t => t === 'curricular' ? '📚 Curricular' : '🔧 Metodològica';

    cos.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${alumnes.map(a => {
          const ralc   = a.ralc || '';
          const nom    = a.cognoms ? `${a.cognoms}, ${a.nom}` : (a.nom || '—');
          const piData = ralc ? pisMap.get(String(ralc)) : null;
          return `
            <div class="pi-alumne-row" data-ralc="${piEsH(ralc)}"
              style="display:flex;align-items:center;gap:12px;padding:12px 16px;
                     background:#fff;border:1.5px solid ${piData?'#7c3aed':'#e5e7eb'};
                     border-radius:12px;">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:700;color:#1e1b4b;font-size:13px;display:flex;align-items:center;gap:8px;">
                  ${piEsH(nom)}
                  ${piData
                    ? `<span style="background:#7c3aed;color:#fff;border-radius:5px;
                                   font-size:9px;font-weight:800;padding:1px 6px;">PI</span>
                       <span style="font-size:11px;color:#7c3aed;font-weight:600;">${tipusLabel(piData.tipus)}</span>`
                    : ''}
                </div>
                ${ralc ? `<div style="font-size:11px;color:#9ca3af;">RALC: ${piEsH(ralc)}</div>` : '<div style="font-size:11px;color:#dc2626;">⚠️ Sense RALC</div>'}
                ${piData
                  ? `<div style="font-size:11px;color:#374151;margin-top:4px;
                                 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:500px;">
                       ${piEsH((piData.motiu||'').substring(0,100))}${(piData.motiu||'').length>100?'...':''}
                     </div>`
                  : ''}
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0;">
                ${ralc
                  ? `<button class="btn-pi-acció"
                       data-ralc="${piEsH(ralc)}" data-nom="${piEsH(nom)}"
                       style="padding:6px 14px;background:${piData?'rgba(124,58,237,0.1)':'#7c3aed'};
                              color:${piData?'#4c1d95':'#fff'};
                              border:1.5px solid ${piData?'#c4b5fd':'#7c3aed'};
                              border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
                       ${piData ? '✏️ Editar' : '➕ Crear PI'}
                     </button>`
                  : `<span style="font-size:11px;color:#9ca3af;font-style:italic;">Sense RALC — no es pot crear PI</span>`
                }
              </div>
            </div>`;
        }).join('')}
      </div>
    `;

    // Events botons
    cos.querySelectorAll('.btn-pi-acció').forEach(btn => {
      btn.addEventListener('click', () => {
        const ralc   = btn.dataset.ralc;
        const nom    = btn.dataset.nom;
        const piData = pisMap.get(String(ralc)) || null;
        obrirFormulariPI(ralc, piData, () => {
          // Recarregar la llista
          carregarAlumnesPI(grupId, grupsUtils, grupsPerId, overlay);
        }, nom);
      });
    });

  } catch(e) {
    cos.innerHTML = `<div style="color:#ef4444;padding:20px;">❌ Error: ${e.message}</div>`;
    console.error('pi.js carregarAlumnesPI:', e);
  }
}

/* ══════════════════════════════════════════════════════
   FORMULARI PI (crear / editar)
══════════════════════════════════════════════════════ */
function obrirFormulariPI(ralc, piData, onDesat, nomAlumne) {
  document.getElementById('modalPI')?.remove();

  const modal = document.createElement('div');
  modal.id = 'modalPI';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,0.85);
    display:flex;align-items:center;justify-content:center;padding:20px;
  `;

  const tipusOpts = [
    { val: 'metodologica', label: '🔧 Adaptació Metodològica', desc: 'Canvis en la manera d\'ensenyar, materials o metodologia sense modificar els objectius curriculars.' },
    { val: 'curricular',   label: '📚 Adaptació Curricular',   desc: 'Modificació dels objectius, continguts o criteris d\'avaluació del currículum ordinari.' },
  ];

  modal.innerHTML = `
    <div style="
      background:#fff;border-radius:20px;width:100%;max-width:600px;
      max-height:90vh;overflow-y:auto;
      box-shadow:0 25px 60px rgba(0,0,0,0.35);
    ">
      <!-- HEADER -->
      <div style="background:linear-gradient(135deg,#4c1d95,#7c3aed);color:#fff;
                  padding:16px 22px;border-radius:20px 20px 0 0;
                  display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:1;">
        <div>
          <div style="font-size:16px;font-weight:800;">📋 Pla Individualitzat</div>
          ${nomAlumne ? `<div style="font-size:12px;opacity:0.8;">${piEsH(nomAlumne)}</div>` : ''}
        </div>
        <button id="btnTancarModalPI" style="background:rgba(255,255,255,0.2);border:none;
          color:#fff;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;">✕</button>
      </div>

      <!-- FORMULARI -->
      <div style="padding:22px;">

        <!-- Motiu -->
        <div style="margin-bottom:18px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">
            Motiu de l'adaptació <span style="color:#ef4444;">*</span>
          </label>
          <textarea id="piMotiu" rows="4" placeholder="Descriu el motiu que justifica l'elaboració del pla individualitzat..."
            style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
                   border-radius:10px;font-size:13px;outline:none;resize:vertical;
                   font-family:inherit;line-height:1.6;">${piEsH(piData?.motiu || '')}</textarea>
        </div>

        <!-- Tipus -->
        <div style="margin-bottom:18px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:8px;">
            Tipus d'adaptació <span style="color:#ef4444;">*</span>
          </label>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${tipusOpts.map(t => `
              <label style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;
                             border:1.5px solid #e5e7eb;border-radius:10px;cursor:pointer;
                             background:${(piData?.tipus||'metodologica')===t.val?'#f5f3ff':'#fff'};"
                     id="labelTipus_${t.val}">
                <input type="radio" name="piTipus" value="${t.val}"
                  ${(piData?.tipus||'metodologica')===t.val?'checked':''}
                  style="margin-top:2px;accent-color:#7c3aed;flex-shrink:0;">
                <div>
                  <div style="font-size:13px;font-weight:700;color:#1e1b4b;">${t.label}</div>
                  <div style="font-size:11px;color:#6b7280;margin-top:2px;">${t.desc}</div>
                </div>
              </label>`).join('')}
          </div>
        </div>

        <!-- Adaptació -->
        <div style="margin-bottom:22px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">
            Descripció de l'adaptació <span style="color:#ef4444;">*</span>
          </label>
          <textarea id="piAdaptacio" rows="5"
            placeholder="Descriu detalladament les mesures d'adaptació que s'aplicaran a l'alumne..."
            style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
                   border-radius:10px;font-size:13px;outline:none;resize:vertical;
                   font-family:inherit;line-height:1.6;">${piEsH(piData?.adaptacio || '')}</textarea>
        </div>

        <!-- Document adjunt -->
        <div style="margin-bottom:22px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">
            📎 Document adjunt <span style="font-size:11px;font-weight:400;color:#9ca3af;">(PDF, Word, etc. — opcional)</span>
          </label>
          ${piData?.documentURL ? `
            <div id="piDocActual" style="display:flex;align-items:center;gap:10px;padding:10px 14px;
              background:#f5f3ff;border:1.5px solid #c4b5fd;border-radius:10px;margin-bottom:8px;">
              <span style="font-size:18px;">📄</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:700;color:#4c1d95;
                     white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${piEsH(piData.documentNom || 'Document adjunt')}</div>
                <div style="font-size:11px;color:#7c3aed;">Document actual</div>
              </div>
              <a href="${piEsH(piData.documentURL)}" target="_blank"
                style="padding:5px 10px;background:#7c3aed;color:#fff;border-radius:7px;
                       font-size:11px;font-weight:700;text-decoration:none;white-space:nowrap;">
                👁 Veure
              </a>
              <button id="btnEliminarDocPI"
                style="padding:5px 10px;background:#fee2e2;color:#dc2626;border:1.5px solid #fca5a5;
                       border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">
                🗑
              </button>
            </div>
          ` : ''}
          <div id="piDocPreview" style="display:none;align-items:center;gap:10px;padding:10px 14px;
            background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;margin-bottom:8px;">
            <span style="font-size:18px;">📄</span>
            <div style="flex:1;min-width:0;">
              <div id="piDocNom" style="font-size:12px;font-weight:700;color:#166534;
                   white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
              <div style="font-size:11px;color:#22c55e;">Llest per pujar</div>
            </div>
            <button id="btnCancelDocPI"
              style="padding:5px 10px;background:#fee2e2;color:#dc2626;border:1.5px solid #fca5a5;
                     border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;">
              ✕
            </button>
          </div>
          <input type="file" id="piDocInput" accept=".pdf,.doc,.docx,.odt,.xls,.xlsx,.ppt,.pptx,.txt"
            style="display:none;">
          <button id="btnTrlarDocPI"
            style="padding:8px 16px;background:#f5f3ff;color:#4c1d95;
                   border:1.5px solid #c4b5fd;border-radius:8px;font-size:12px;
                   font-weight:700;cursor:pointer;width:100%;">
            📎 ${piData?.documentURL ? 'Substituir document' : 'Adjuntar document'}
          </button>
        </div>

        <!-- Peu: error + botons -->
        <div id="piErrMsg" style="color:#ef4444;font-size:12px;min-height:16px;margin-bottom:10px;"></div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          ${piData
            ? `<button id="btnDesactivarPI"
                style="padding:8px 16px;background:#fee2e2;color:#dc2626;
                       border:1.5px solid #fca5a5;border-radius:8px;font-size:12px;
                       font-weight:700;cursor:pointer;">
                 🗑 Desactivar PI
               </button>`
            : '<div></div>'}
          <div style="display:flex;gap:8px;">
            <button id="btnCancelModalPI"
              style="padding:9px 18px;background:#f3f4f6;color:#374151;border:none;
                     border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
              Cancel·lar
            </button>
            <button id="btnDesarPI"
              style="padding:9px 20px;background:#7c3aed;color:#fff;border:none;
                     border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">
              💾 ${piData ? 'Actualitzar' : 'Crear PI'}
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Feedback visual en canviar tipus
  modal.querySelectorAll('input[name="piTipus"]').forEach(radio => {
    radio.addEventListener('change', () => {
      tipusOpts.forEach(t => {
        const lbl = modal.querySelector(`#labelTipus_${t.val}`);
        if (lbl) lbl.style.background = radio.value === t.val ? '#f5f3ff' : '#fff';
      });
    });
  });

  // Tancar
  const tancar = () => modal.remove();
  modal.querySelector('#btnTancarModalPI').addEventListener('click', tancar);
  modal.querySelector('#btnCancelModalPI').addEventListener('click', tancar);
  modal.addEventListener('click', e => { if (e.target === modal) tancar(); });

  // Desactivar
  modal.querySelector('#btnDesactivarPI')?.addEventListener('click', async () => {
    if (!confirm(`Segur que vols desactivar el PI d'aquest alumne?`)) return;
    try {
      await window.db.collection(PI_COL).doc(String(ralc)).update({
        actiu: false,
        desactivatAt: firebase.firestore.FieldValue.serverTimestamp(),
        desactivatPer: window.auth?.currentUser?.uid || '',
      });
      _piCache?.delete(String(ralc));
      window.mostrarToast('🗑 PI desactivat', 3000);
      tancar();
      onDesat?.();
      actualitzarBadgesPI();
    } catch(e) {
      window.mostrarToast('❌ Error: ' + e.message, 4000);
    }
  });

  // --- Document adjunt ---
  let _fitxerSeleccionat = null;
  let _eliminarDocExistent = false;

  const inputDoc    = modal.querySelector('#piDocInput');
  const btnTrlar    = modal.querySelector('#btnTrlarDocPI');
  const preview     = modal.querySelector('#piDocPreview');
  const previewNom  = modal.querySelector('#piDocNom');
  const btnCancel   = modal.querySelector('#btnCancelDocPI');
  const btnEliminar = modal.querySelector('#btnEliminarDocPI');

  btnTrlar?.addEventListener('click', () => inputDoc?.click());

  inputDoc?.addEventListener('change', () => {
    const fitxer = inputDoc.files?.[0];
    if (!fitxer) return;
    const MAX_MB = 10;
    if (fitxer.size > MAX_MB * 1024 * 1024) {
      modal.querySelector('#piErrMsg').textContent = `⚠️ El fitxer no pot superar ${MAX_MB} MB`;
      inputDoc.value = '';
      return;
    }
    _fitxerSeleccionat = fitxer;
    previewNom.textContent = fitxer.name;
    preview.style.display = 'flex';
    modal.querySelector('#piErrMsg').textContent = '';
  });

  btnCancel?.addEventListener('click', () => {
    _fitxerSeleccionat = null;
    inputDoc.value = '';
    preview.style.display = 'none';
  });

  btnEliminar?.addEventListener('click', () => {
    _eliminarDocExistent = true;
    modal.querySelector('#piDocActual')?.remove();
    btnTrlar.textContent = '📎 Adjuntar document';
  });

  // Desar
  modal.querySelector('#btnDesarPI').addEventListener('click', async () => {
    const motiu     = modal.querySelector('#piMotiu')?.value?.trim();
    const tipus     = modal.querySelector('input[name="piTipus"]:checked')?.value;
    const adaptacio = modal.querySelector('#piAdaptacio')?.value?.trim();
    const errEl     = modal.querySelector('#piErrMsg');

    if (!motiu)     { errEl.textContent = '⚠️ El motiu és obligatori'; return; }
    if (!adaptacio) { errEl.textContent = '⚠️ La descripció de l\'adaptació és obligatòria'; return; }

    const btn = modal.querySelector('#btnDesarPI');
    btn.disabled = true; btn.textContent = '⏳ Desant...';

    try {
      const uid = window.auth?.currentUser?.uid || '';
      const ara = firebase.firestore.FieldValue.serverTimestamp();

      // --- Gestió document Storage ---
      let documentURL = piData?.documentURL || null;
      let documentNom = piData?.documentNom || null;
      const storageRef = firebase.storage().ref(`plans_individualitzats/${ralc}`);

      // Eliminar document existent si s'ha demanat
      if (_eliminarDocExistent && piData?.documentURL) {
        try { await storageRef.child(piData.documentNom).delete(); } catch(e) {}
        documentURL = null;
        documentNom = null;
      }

      // Pujar nou fitxer si n'hi ha
      if (_fitxerSeleccionat) {
        btn.textContent = '⏳ Pujant document...';
        // Eliminar document anterior si existia (substituir)
        if (piData?.documentNom && !_eliminarDocExistent) {
          try { await storageRef.child(piData.documentNom).delete(); } catch(e) {}
        }
        const fileRef = storageRef.child(_fitxerSeleccionat.name);
        const snapshot = await fileRef.put(_fitxerSeleccionat);
        documentURL = await snapshot.ref.getDownloadURL();
        documentNom = _fitxerSeleccionat.name;
        btn.textContent = '⏳ Desant...';
      }

      const payload = {
        ralc: String(ralc),
        motiu,
        tipus: tipus || 'metodologica',
        adaptacio,
        actiu: true,
        updatedAt: ara,
        updatedPer: uid,
        documentURL:  documentURL  ?? null,
        documentNom:  documentNom  ?? null,
      };
      if (!piData) {
        payload.creatAt  = ara;
        payload.creatPer = uid;
      }

      await window.db.collection(PI_COL).doc(String(ralc)).set(payload, { merge: true });

      // Actualitzar cache
      if (!_piCache) _piCache = new Map();
      _piCache.set(String(ralc), { ...payload });
      actualitzarBadgesPI();

      window.mostrarToast(`✅ PI ${piData ? 'actualitzat' : 'creat'} correctament`, 3000);
      tancar();
      onDesat?.();
    } catch(e) {
      errEl.textContent = '❌ Error: ' + e.message;
      console.error('pi.js desar:', e);
      btn.disabled = false;
      btn.textContent = `💾 ${piData ? 'Actualitzar' : 'Crear PI'}`;
    }
  });
}

/* ══════════════════════════════════════════════════════
   API PÚBLICA
══════════════════════════════════════════════════════ */
window.tePI          = tePI;
window.getPICache    = getPICache;
window.obrirFormulariPI = obrirFormulariPI;

console.log('✅ pi.js inicialitzat');
