// avaluacio-centre.js
// Sistema d'Avaluació Centre — UltraComentator / INS Matadepera
// Permet als professors afegir comentaris i assoliments a Firebase
// amb l'estructura que reflecteix l'Excel institucional.
//
// Estructura Firebase:
//   avaluacio_centre/{curs}/{materia}/{alumneId} → {
//     nom, cognoms, grup, tutor, ralc,
//     descripcioComuna,
//     items: [{titol, comentari, assoliment}]
//   }
//   grups_centre/{id}    → {nom, curs, ordre}
//   materies_centre/{id} → {nom, ordre, descripcioComuna}

console.log('📋 avaluacio-centre.js carregat');

/* ══════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════ */
const ASSOLIMENTS = [
  'Assoliment Excel·lent',
  'Assoliment Notable',
  'Assoliment Satisfactori',
  'No Assoliment',
  'No avaluat'
];

const ASSOLIMENT_COLORS = {
  'Assoliment Excel·lent':  { bg: '#22c55e', text: '#fff', short: 'AE' },
  'Assoliment Notable':     { bg: '#84cc16', text: '#fff', short: 'AN' },
  'Assoliment Satisfactori':{ bg: '#f59e0b', text: '#fff', short: 'AS' },
  'No Assoliment':          { bg: '#ef4444', text: '#fff', short: 'NA' },
  'No avaluat':             { bg: '#9ca3af', text: '#fff', short: '--' }
};

/* ══════════════════════════════════════════════════════
   INJECTAR BOTÓ "AFEGIR A AVALUACIÓ CENTRE"
   S'injecta al costat del botó Excel existent
══════════════════════════════════════════════════════ */
function injectarBotoAvaluacioCentre() {
  if (document.getElementById('btnAvaluacioCentre')) return;

  const tryInject = () => {
    const btnExcel = document.getElementById('btnExportExcel');
    if (!btnExcel) { setTimeout(tryInject, 600); return; }

    const btn = document.createElement('button');
    btn.id = 'btnAvaluacioCentre';
    btn.className = 'btn-outline btn-sm';
    btn.style.cssText = `
      background: linear-gradient(135deg, #7c3aed, #4f46e5);
      color: #fff;
      border: none;
      font-weight: 600;
    `;
    btn.innerHTML = '🏫 Afegir a Avaluació Centre';
    btn.title = 'Envia els comentaris d\'aquesta pàgina a l\'avaluació del centre';
    btn.addEventListener('click', obrirModalAvaluacioCentre);

    btnExcel.insertAdjacentElement('afterend', btn);
    console.log('✅ Botó Avaluació Centre injectat');
  };

  // Esperar que el botó Excel existeixi (es crea quan es carrega una classe)
  const observer = new MutationObserver(() => {
    if (document.getElementById('btnExportExcel')) {
      observer.disconnect();
      tryInject();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  tryInject();
}

/* ══════════════════════════════════════════════════════
   MODAL PRINCIPAL
══════════════════════════════════════════════════════ */
async function obrirModalAvaluacioCentre() {
  document.getElementById('modalAvaluacioCentre')?.remove();

  // Verificar rol
  if (!window.teRol || (!window.teRol('professor') && !window.teRol('admin'))) {
    window.mostrarToast?.('❌ No tens permisos per a aquesta acció', 3000);
    return;
  }

  // Carregar matèries i grups del centre
  const [materies, grups] = await Promise.all([
    carregarMateriesCentre(),
    carregarGrupsCentre()
  ]);

  // Intentar preseleccionar a partir del nom de la classe actual
  const classTitle = document.getElementById('classTitle')?.textContent || '';
  const classSub   = document.getElementById('classSub')?.textContent || '';

  const modal = document.createElement('div');
  modal.id = 'modalAvaluacioCentre';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;

  modal.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:32px;width:100%;max-width:680px;
                max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,0.3);">

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h2 style="font-size:20px;font-weight:800;color:#1e1b4b;margin:0;">
            🏫 Afegir a Avaluació Centre
          </h2>
          <p style="font-size:13px;color:#6b7280;margin:4px 0 0;">
            Envia els comentaris i assoliments al quadre institucional
          </p>
        </div>
        <button id="btnTancarAvCentre" style="background:none;border:none;font-size:24px;cursor:pointer;color:#9ca3af;">✕</button>
      </div>

      <!-- SELECTOR MATÈRIA -->
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">
          Matèria del centre *
        </label>
        <select id="selMateriaAC" style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;
                border-radius:10px;font-size:14px;outline:none;background:#f9fafb;">
          <option value="">— Tria la matèria —</option>
          ${materies.map(m => `<option value="${m.id}" data-nom="${m.nom}">${m.nom}</option>`).join('')}
        </select>
      </div>

      <!-- SELECTOR GRUP -->
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">
          Grup *
        </label>
        <select id="selGrupAC" style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;
                border-radius:10px;font-size:14px;outline:none;background:#f9fafb;">
          <option value="">— Tria el grup —</option>
          ${grups.map(g => `<option value="${g.id}" data-nom="${g.nom}" data-curs="${g.curs}">${g.nom} (${g.curs})</option>`).join('')}
        </select>
      </div>

      <!-- DESCRIPCIÓ COMUNA (text lliure de la matèria) -->
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">
          Descripció comuna de la matèria
          <span style="font-weight:400;color:#9ca3af;"> (text introductori que apareix al butlletí)</span>
        </label>
        <textarea id="descComunaAC" rows="4" placeholder="Descripció del projecte, context de la matèria, etc."
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
                 border-radius:10px;font-size:13px;outline:none;resize:vertical;font-family:inherit;">
        </textarea>
      </div>

      <!-- ÍTEMS -->
      <div id="itemsContainerAC" style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <label style="font-size:13px;font-weight:600;color:#374151;">Ítems d'avaluació</label>
          <button id="btnAfegirItemAC" style="
            padding:6px 14px;background:#7c3aed;color:#fff;border:none;
            border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
            + Afegir ítem
          </button>
        </div>
        <div id="llistaItemsAC"></div>
      </div>

      <!-- PREVISUALITZACIÓ D'ALUMNES -->
      <div id="previewAlumnesAC" style="margin-bottom:20px;display:none;">
        <p style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px;">
          Alumnes que s'enviaran (<span id="numAlumnesAC">0</span>):
        </p>
        <div id="llista-preview-alumnes" style="
          max-height:120px;overflow-y:auto;background:#f9fafb;
          border:1px solid #e5e7eb;border-radius:10px;padding:10px;
          font-size:12px;color:#374151;
        "></div>
      </div>

      <!-- BOTONS -->
      <div style="display:flex;gap:12px;justify-content:flex-end;">
        <button id="btnCancelAvCentre" style="
          padding:10px 20px;background:#f3f4f6;border:none;border-radius:10px;
          font-weight:600;cursor:pointer;font-size:14px;">
          Cancel·lar
        </button>
        <button id="btnCarregarComentarisAC" style="
          padding:10px 20px;background:#e0e7ff;color:#4338ca;border:none;border-radius:10px;
          font-weight:600;cursor:pointer;font-size:14px;">
          ⚡ Carregar des de la classe actual
        </button>
        <button id="btnEnviarAC" style="
          padding:10px 24px;background:linear-gradient(135deg,#7c3aed,#4f46e5);
          color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">
          🏫 Enviar al centre
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  // Intentar preseleccionar
  preseleccionarValors(modal, classTitle, classSub, materies, grups);

  // Afegir primer ítem buit
  afegirItemUI();

  // Events
  document.getElementById('btnTancarAvCentre').addEventListener('click', () => modal.remove());
  document.getElementById('btnCancelAvCentre').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  document.getElementById('btnAfegirItemAC').addEventListener('click', afegirItemUI);

  document.getElementById('btnCarregarComentarisAC').addEventListener('click', carregarDesDeClasseActual);

  document.getElementById('btnEnviarAC').addEventListener('click', enviarAvaluacioCentre);

  // Preview alumnes quan canvia el grup
  document.getElementById('selGrupAC').addEventListener('change', actualitzarPreviewAlumnes);
}

/* ══════════════════════════════════════════════════════
   ÍTEMS UI
══════════════════════════════════════════════════════ */
let _itemCounter = 0;

function afegirItemUI(titol = '', comentari = '', assoliment = '') {
  const container = document.getElementById('llistaItemsAC');
  if (!container) return;

  const id = ++_itemCounter;
  const div = document.createElement('div');
  div.id = `item-ac-${id}`;
  div.style.cssText = `
    background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;
    padding:16px;margin-bottom:12px;position:relative;
  `;

  div.innerHTML = `
    <button class="btn-eliminar-item" data-id="${id}" style="
      position:absolute;top:10px;right:10px;background:none;border:none;
      color:#ef4444;font-size:18px;cursor:pointer;line-height:1;" title="Eliminar ítem">✕
    </button>
    <div style="margin-bottom:10px;">
      <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px;">
        Títol de l'aprenentatge
      </label>
      <input type="text" class="item-titol" data-id="${id}"
        value="${escapeHtml(titol)}"
        placeholder="Ex: CE1: Diversitat lingüística"
        style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #d1d5db;
               border-radius:8px;font-size:13px;outline:none;font-family:inherit;">
    </div>
    <div style="margin-bottom:10px;">
      <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px;">
        Comentari
      </label>
      <textarea class="item-comentari" data-id="${id}" rows="3"
        placeholder="Comentari d'avaluació d'aquest aprenentatge..."
        style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #d1d5db;
               border-radius:8px;font-size:13px;outline:none;resize:vertical;font-family:inherit;"
      >${escapeHtml(comentari)}</textarea>
    </div>
    <div>
      <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:4px;">
        Nivell d'assoliment
      </label>
      <select class="item-assoliment" data-id="${id}" style="
        width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;
        font-size:13px;outline:none;background:#fff;">
        ${ASSOLIMENTS.map(a => `
          <option value="${a}" ${a === assoliment ? 'selected' : ''}>${a}</option>
        `).join('')}
      </select>
    </div>
  `;

  container.appendChild(div);

  div.querySelector('.btn-eliminar-item').addEventListener('click', () => div.remove());
}

/* ══════════════════════════════════════════════════════
   CARREGAR DES DE LA CLASSE ACTUAL
══════════════════════════════════════════════════════ */
async function carregarDesDeClasseActual() {
  // Obtenir alumnes de la classe actual via DOM/variables globals
  const classId = window.currentClassId;
  if (!classId) {
    window.mostrarToast('⚠️ Cap classe seleccionada', 3000);
    return;
  }

  try {
    // Llegir els comentaris de l'alumne seleccionat o de tots
    // Buscar el periode actual
    const periodeActiu = window.currentPeriodeId;
    const alumnesSnap = await window.db.collection('alumnes')
      .where('classId', '==', classId)
      .orderBy('nom')
      .get();

    if (alumnesSnap.empty) {
      window.mostrarToast('⚠️ No hi ha alumnes en aquesta classe', 3000);
      return;
    }

    // Netejar ítems existents
    document.getElementById('llistaItemsAC').innerHTML = '';
    _itemCounter = 0;

    // Per a cada alumne, mirar els seus comentaris del periode actiu
    // i extreure els ítems (competències) si existeixen
    const primerAlumne = alumnesSnap.docs[0];
    const data = primerAlumne.data();
    const comentariData = periodeActiu
      ? data.comentarisPerPeriode?.[periodeActiu]
      : data.comentari;

    // Si té estructura d'ítems (ultracomentator), carregar
    if (comentariData?.items && Array.isArray(comentariData.items)) {
      comentariData.items.forEach(item => {
        afegirItemUI(item.titol || '', item.comentari || '', item.assoliment || '');
      });
      window.mostrarToast(`✅ ${comentariData.items.length} ítems carregats`, 2000);
    } else {
      // Afegir un ítem buit
      afegirItemUI();
      window.mostrarToast('ℹ️ No s\'han trobat ítems estructurats. Afegeix-los manualment.', 3500);
    }

    // Actualitzar preview alumnes
    actualitzarPreviewAlumnes(alumnesSnap.docs.map(d => ({
      id: d.id,
      nom: d.data().nom
    })));

  } catch (e) {
    console.error('Error carregant classe:', e);
    window.mostrarToast('❌ Error carregant la classe: ' + e.message, 4000);
  }
}

/* ══════════════════════════════════════════════════════
   PREVIEW ALUMNES
══════════════════════════════════════════════════════ */
async function actualitzarPreviewAlumnes(alumnesManuals) {
  const grupId = document.getElementById('selGrupAC')?.value;
  const previewDiv = document.getElementById('previewAlumnesAC');
  const llistaDiv = document.getElementById('llista-preview-alumnes');
  const numSpan = document.getElementById('numAlumnesAC');

  if (!previewDiv || !llistaDiv) return;

  let alumnes = [];

  if (Array.isArray(alumnesManuals)) {
    alumnes = alumnesManuals;
  } else if (window.currentClassId) {
    try {
      const snap = await window.db.collection('alumnes')
        .where('classId', '==', window.currentClassId)
        .orderBy('nom')
        .get();
      alumnes = snap.docs.map(d => ({ id: d.id, nom: d.data().nom }));
    } catch (e) {}
  }

  if (alumnes.length === 0) {
    previewDiv.style.display = 'none';
    return;
  }

  numSpan.textContent = alumnes.length;
  llistaDiv.innerHTML = alumnes.map(a =>
    `<span style="display:inline-block;background:#e0e7ff;color:#4338ca;padding:3px 8px;
                  border-radius:6px;margin:2px;font-size:12px;">${escapeHtml(a.nom)}</span>`
  ).join('');
  previewDiv.style.display = 'block';
}

/* ══════════════════════════════════════════════════════
   ENVIAR A FIREBASE
══════════════════════════════════════════════════════ */
async function enviarAvaluacioCentre() {
  const materiaEl  = document.getElementById('selMateriaAC');
  const grupEl     = document.getElementById('selGrupAC');
  const descComuna = document.getElementById('descComunaAC')?.value?.trim() || '';

  if (!materiaEl?.value || !grupEl?.value) {
    window.mostrarToast('⚠️ Has de seleccionar matèria i grup', 3000);
    return;
  }

  const materiaNom = materiaEl.options[materiaEl.selectedIndex]?.dataset.nom || materiaEl.value;
  const grupNom    = grupEl.options[grupEl.selectedIndex]?.dataset.nom || grupEl.value;
  const curs       = grupEl.options[grupEl.selectedIndex]?.dataset.curs || '2024-25';

  // Llegir ítems
  const items = [];
  document.querySelectorAll('#llistaItemsAC [data-id]').forEach(el => {
    if (el.classList.contains('item-titol')) {
      const id = el.dataset.id;
      const titol     = el.value.trim();
      const comentari = document.querySelector(`.item-comentari[data-id="${id}"]`)?.value?.trim() || '';
      const assoliment= document.querySelector(`.item-assoliment[data-id="${id}"]`)?.value || 'No avaluat';
      if (titol || comentari) {
        items.push({ titol, comentari, assoliment });
      }
    }
  });

  if (items.length === 0) {
    window.mostrarToast('⚠️ Afegeix almenys un ítem d\'avaluació', 3000);
    return;
  }

  // Obtenir alumnes de la classe
  const classId = window.currentClassId;
  if (!classId) {
    window.mostrarToast('⚠️ Cap classe oberta', 3000);
    return;
  }

  const btnEnviar = document.getElementById('btnEnviarAC');
  btnEnviar.disabled = true;
  btnEnviar.textContent = '⏳ Enviant...';

  try {
    const alumnesSnap = await window.db.collection('alumnes')
      .where('classId', '==', classId)
      .get();

    if (alumnesSnap.empty) {
      window.mostrarToast('⚠️ No hi ha alumnes per enviar', 3000);
      btnEnviar.disabled = false;
      btnEnviar.textContent = '🏫 Enviar al centre';
      return;
    }

    const db = window.db;
    const batch = db.batch();
    let count = 0;

    // Referència de la col·lecció principal
    // Clau: avaluacio_centre/{curs}/{materiaId}/{alumneId}
    const materiaId = materiaEl.value;
    const periodeId = window.currentPeriodeId || 'general';

    for (const doc of alumnesSnap.docs) {
      const alumne = doc.data();
      const alumneId = doc.id;

      // RALC com a identificador secundari (si existeix)
      const ralc = alumne.ralc || alumne.numeroRALC || '';

      // Obtenir comentari específic d'aquest alumne si existeix
      const comentariAlumne = window.currentPeriodeId
        ? alumne.comentarisPerPeriode?.[window.currentPeriodeId]
        : alumne.comentari;

      // Si l'alumne té ítems propis, usar-los; sinó, usar els ítems comuns del modal
      const itemsAlumne = comentariAlumne?.items?.length
        ? comentariAlumne.items
        : items;

      const refDoc = db
        .collection('avaluacio_centre')
        .doc(curs)
        .collection(materiaId)
        .doc(alumneId);

      batch.set(refDoc, {
        // Dades de l'alumne
        nom:     alumne.nom || '',
        cognoms: alumne.cognoms || '',
        grup:    grupNom,
        grupId:  grupEl.value,
        tutor:   alumne.tutor || '',
        ralc,
        // Dades de la matèria
        materiaNom,
        materiaId,
        curs,
        periodeId,
        // Contingut
        descripcioComuna: descComuna,
        items: itemsAlumne,
        // Metadades
        professorUid:   firebase.auth().currentUser?.uid || '',
        professoremail: firebase.auth().currentUser?.email || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      count++;
    }

    await batch.commit();

    window.mostrarToast(`✅ ${count} alumnes enviats a Avaluació Centre`, 3000);
    document.getElementById('modalAvaluacioCentre')?.remove();

  } catch (e) {
    console.error('Error enviant avaluació:', e);
    window.mostrarToast('❌ Error: ' + e.message, 5000);
    btnEnviar.disabled = false;
    btnEnviar.textContent = '🏫 Enviar al centre';
  }
}

/* ══════════════════════════════════════════════════════
   CARREGAR MATÈRIES I GRUPS
══════════════════════════════════════════════════════ */
async function carregarMateriesCentre() {
  try {
    const snap = await window.db.collection('materies_centre')
      .orderBy('ordre')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Error carregant matèries:', e);
    return [];
  }
}

async function carregarGrupsCentre() {
  try {
    const snap = await window.db.collection('grups_centre')
      .orderBy('ordre')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Error carregant grups:', e);
    return [];
  }
}

/* ══════════════════════════════════════════════════════
   PRESELECCIÓ INTEL·LIGENT
══════════════════════════════════════════════════════ */
function preseleccionarValors(modal, classTitle, classSub, materies, grups) {
  // Intentar trobar la matèria pel nom de la classe
  // Ex: "Matemàtiques 2B" → buscar matèria amb "Matemàtiques" i grup "2B"
  const titleLower = classTitle.toLowerCase();

  const materiaTrobada = materies.find(m =>
    titleLower.includes(m.nom.toLowerCase())
  );
  if (materiaTrobada) {
    const selMateria = modal.querySelector('#selMateriaAC');
    if (selMateria) selMateria.value = materiaTrobada.id;
  }

  const grupTrobat = grups.find(g =>
    titleLower.includes(g.nom.toLowerCase()) ||
    classSub.toLowerCase().includes(g.nom.toLowerCase())
  );
  if (grupTrobat) {
    const selGrup = modal.querySelector('#selGrupAC');
    if (selGrup) selGrup.value = grupTrobat.id;
  }
}

/* ══════════════════════════════════════════════════════
   UTILITATS
══════════════════════════════════════════════════════ */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════════════
   LECTURA DEL QUADRE CENTRE (per secretaria/revisor)
══════════════════════════════════════════════════════ */
window.llegirAvaluacioCentre = async function(curs, materiaId, grupId) {
  try {
    let query = window.db
      .collection('avaluacio_centre')
      .doc(curs)
      .collection(materiaId);

    if (grupId) {
      query = query.where('grupId', '==', grupId);
    }

    const snap = await query.orderBy('cognoms').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Error llegint avaluació centre:', e);
    return [];
  }
};

window.llegirTotsAlumnesCurs = async function(curs) {
  // Retorna tots els alumnes de totes les matèries d'un curs
  // Útil per generar el butlletí
  try {
    const db = window.db;
    const materies = await carregarMateriesCentre();
    const resultat = {};

    for (const mat of materies) {
      const snap = await db
        .collection('avaluacio_centre')
        .doc(curs)
        .collection(mat.id)
        .get();

      snap.docs.forEach(d => {
        const alumneId = d.id;
        if (!resultat[alumneId]) {
          resultat[alumneId] = { id: alumneId, ...d.data(), materies: {} };
        }
        resultat[alumneId].materies[mat.id] = {
          nom: mat.nom,
          ...d.data()
        };
      });
    }

    return Object.values(resultat);
  } catch (e) {
    console.error('Error llegint tots els alumnes:', e);
    return [];
  }
};

/* ══════════════════════════════════════════════════════
   INICIALITZACIÓ
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Esperar que la UI estigui llesta i els rols carregats
  const tryInit = () => {
    if (!window.db || !firebase.auth().currentUser) {
      setTimeout(tryInit, 800);
      return;
    }
    // Injectar botó si el rol permet
    if (window.teRol?.('professor') || window.teRol?.('admin')) {
      injectarBotoAvaluacioCentre();
    }
  };

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      setTimeout(() => {
        injectarBotoAvaluacioCentre();
      }, 1500);
    }
  });
});

// Exportar per ús extern
window.avaluacioCentre = {
  obrirModal: obrirModalAvaluacioCentre,
  carregarMateries: carregarMateriesCentre,
  carregarGrups: carregarGrupsCentre,
  ASSOLIMENTS,
  ASSOLIMENT_COLORS
};

console.log('✅ avaluacio-centre.js: inicialitzat');
