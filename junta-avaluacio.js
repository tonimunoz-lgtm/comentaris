// junta-avaluacio.js — Injector "Junta d'Avaluació"
// Rol: juntaavaluacio (+ admin/superadmin per defecte)
// Vista: llista alumnes amb semàfor (esquerra) + detall editable (dreta)

console.log('📋 junta-avaluacio.js carregat');

const JA_ROL = 'juntaavaluacio';

/* ══════════════════════════════════════════════════════
   INJECTOR BOTÓ SIDEBAR
══════════════════════════════════════════════════════ */
window.injectarBotoJuntaAvaluacio = function() {
  if (document.getElementById('btnJuntaAvaluacioSidebar')) return;
  const rols = window._userRols || [];
  const teAcces = window._isSuperAdmin ||
    rols.includes(JA_ROL) || rols.includes('admin') || rols.includes('superadmin');
  if (!teAcces) return;

  const nav = document.querySelector('.sidebar-nav') || document.querySelector('#sidebar nav');
  if (!nav) return;

  const btn = document.createElement('button');
  btn.id = 'btnJuntaAvaluacioSidebar';
  btn.className = 'nav-item nav-item-rol';
  btn.innerHTML = `<span class="nav-icon">🏫</span><span>Junta Avaluació</span>`;
  btn.addEventListener('click', obrirJuntaAvaluacio);
  nav.appendChild(btn);
  console.log('✅ Botó Junta Avaluació injectat');
};

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */
const _jaEsH = s => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';
const _jaNorm = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f·]/g,'').trim();

function _jaColorAss(s) {
  const n = _jaNorm(s);
  if (n.includes('excel'))       return { bg:'#22c55e', text:'#fff', border:'#16a34a' };
  if (n.includes('notable'))     return { bg:'#84cc16', text:'#fff', border:'#65a30d' };
  if (n.includes('satisfactori'))return { bg:'#f59e0b', text:'#fff', border:'#d97706' };
  if (n.includes('no ass'))      return { bg:'#ef4444', text:'#fff', border:'#dc2626' };
  return                               { bg:'#9ca3af', text:'#fff', border:'#6b7280' };
}

const JA_ASSOLIMENTS = [
  'Assoliment Excel·lent',
  'Assoliment Notable',
  'Assoliment Satisfactori',
  'No Assoliment',
  'No avaluat',
];

/* ══════════════════════════════════════════════════════
   PANELL PRINCIPAL
══════════════════════════════════════════════════════ */
async function obrirJuntaAvaluacio() {
  document.getElementById('panellJuntaAvaluacio')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'panellJuntaAvaluacio';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:8888;background:rgba(15,23,42,0.7);
    display:flex;align-items:stretch;
  `;

  // Carregar dades inicials
  const db = window.db;
  const curs = window._cursActiu || await _jaCarregarCurs();
  const grups = window.fsCache ? await window.fsCache.grups() :
    (await db.collection('grups_centre').get()).docs.map(d => ({id:d.id,...d.data()}));
  const periodes = window.fsCache ? await window.fsCache.periodes() : {};

  const grupsClasse = grups.filter(g => g.tipus === 'classe').sort((a,b) => (a.ordre||99)-(b.ordre||99));
  const nivells = [...new Set(grupsClasse.map(g => g.nivellNom || g.nivellId).filter(Boolean))];

  // Períodes disponibles
  const BASE_PERIODES = [
    {codi:'preav',nom:'Pre-avaluació'},{codi:'T1',nom:'1r Trimestre'},
    {codi:'T2',nom:'2n Trimestre'},{codi:'T3',nom:'3r Trimestre'},
    {codi:'final',nom:'Final de curs'},
  ];
  const ordreP = periodes.ordre || BASE_PERIODES.map(p=>p.codi);
  const nomsP  = periodes.noms  || {};
  const llPerio = ordreP.map(c => { const b = BASE_PERIODES.find(p=>p.codi===c)||{nom:c}; return {codi:c, nom:nomsP[c]||b.nom}; });

  overlay.innerHTML = `
    <div style="width:100%;background:#fff;display:flex;flex-direction:column;overflow:hidden;">

      <!-- HEADER -->
      <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);color:#fff;padding:18px 24px;flex-shrink:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <div>
            <h2 style="font-size:20px;font-weight:800;margin:0;">🏫 Junta d'Avaluació</h2>
            <p style="font-size:12px;opacity:0.7;margin:4px 0 0;">Curs actiu: <strong>${_jaEsH(curs)}</strong></p>
          </div>
          <button id="jaClose" style="background:rgba(255,255,255,0.2);border:none;color:#fff;
            width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;">✕</button>
        </div>
        <!-- Filtres -->
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <select id="jaSelNivell" style="padding:7px 12px;border-radius:8px;border:none;
            font-size:13px;font-weight:600;background:rgba(255,255,255,0.15);color:#fff;
            outline:none;cursor:pointer;min-width:140px;">
            <option value="">— Nivell —</option>
            ${nivells.map(n => `<option value="${_jaEsH(n)}">${_jaEsH(n)}</option>`).join('')}
          </select>
          <select id="jaSelGrup" style="padding:7px 12px;border-radius:8px;border:none;
            font-size:13px;font-weight:600;background:rgba(255,255,255,0.15);color:#fff;
            outline:none;cursor:pointer;min-width:120px;" disabled>
            <option value="">— Grup —</option>
          </select>
          <select id="jaSelPeriode" style="padding:7px 12px;border-radius:8px;border:none;
            font-size:13px;font-weight:600;background:rgba(255,255,255,0.15);color:#fff;
            outline:none;cursor:pointer;min-width:150px;">
            <option value="">— Tots els períodes —</option>
            ${llPerio.map(p => `<option value="${_jaEsH(p.nom)}">${_jaEsH(p.nom)}</option>`).join('')}
          </select>
          <button id="jaCarregar" style="padding:7px 18px;background:#fff;color:#1e1b4b;
            border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;
            opacity:0.5;" disabled>
            ▶ Carregar
          </button>
        </div>
      </div>

      <!-- CONTINGUT: dues columnes -->
      <div style="flex:1;display:flex;overflow:hidden;">
        <!-- Columna esquerra: llista alumnes -->
        <div id="jaLlista" style="width:280px;flex-shrink:0;border-right:1px solid #e5e7eb;
          overflow-y:auto;background:#f9fafb;">
          <div style="padding:40px 20px;text-align:center;color:#9ca3af;font-size:13px;">
            Selecciona un grup i carrega les dades
          </div>
        </div>
        <!-- Columna dreta: detall editable -->
        <div id="jaDetall" style="flex:1;overflow-y:auto;padding:24px;background:#fff;">
          <div style="padding:60px;text-align:center;color:#9ca3af;">
            <div style="font-size:48px;margin-bottom:12px;">🏫</div>
            <div style="font-size:15px;font-weight:600;">Selecciona un alumne/a per veure el seu detall</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#jaClose').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Lògica filtres
  const selNivell  = overlay.querySelector('#jaSelNivell');
  const selGrup    = overlay.querySelector('#jaSelGrup');
  const selPeriode = overlay.querySelector('#jaSelPeriode');
  const btnCar     = overlay.querySelector('#jaCarregar');

  selNivell.addEventListener('change', () => {
    const nivell = selNivell.value;
    selGrup.innerHTML = '<option value="">— Grup —</option>' +
      grupsClasse
        .filter(g => (g.nivellNom || g.nivellId) === nivell)
        .map(g => `<option value="${g.id}">${_jaEsH(g.nom)}</option>`)
        .join('');
    selGrup.disabled = !nivell;
    btnCar.disabled = true;
    btnCar.style.opacity = '0.5';
  });

  selGrup.addEventListener('change', () => {
    const ok = !!selGrup.value;
    btnCar.disabled = !ok;
    btnCar.style.opacity = ok ? '1' : '0.5';
  });

  btnCar.addEventListener('click', async () => {
    const grupId  = selGrup.value;
    const periode = selPeriode.value;
    if (!grupId) return;
    await jaCarregarAlumnes(grupId, periode, curs, grups, overlay);
  });
}

/* ══════════════════════════════════════════════════════
   CARREGAR ALUMNES DEL GRUP
══════════════════════════════════════════════════════ */
async function jaCarregarAlumnes(grupId, periodeFiltre, curs, grups, overlay) {
  const llistaEl = overlay.querySelector('#jaLlista');
  const detallEl = overlay.querySelector('#jaDetall');
  llistaEl.innerHTML = `<div style="padding:30px;text-align:center;color:#9ca3af;">⏳ Carregant...</div>`;
  detallEl.innerHTML = '';

  try {
    const db = window.db;
    const grupDoc = await db.collection('grups_centre').doc(grupId).get();
    const grupData = grupDoc.exists ? grupDoc.data() : {};
    const grupClasId = grupData.parentGrupId || grupId;

    // Llegir alumnes del grup
    const alumnesCentre = grupData.alumnes || [];
    const resultat = {};
    alumnesCentre.forEach((a, idx) => {
      const id = a.ralc || `alumne_${idx}_${a.nom}`;
      resultat[id] = { id, nom: a.nom||'', cognoms: a.cognoms||'', ralc: a.ralc||'', materies: {} };
    });

    // Llegir matèries del grup
    const matSnap = await db.collection('grups_centre').where('parentGrupId','==', grupClasId).get();
    const materies = matSnap.docs.map(d => ({id:d.id,...d.data()})).filter(m => m.tipus !== 'tutoria');

    // Llegir avaluació per cada matèria
    for (const mat of materies) {
      try {
        let snap = await db.collection('avaluacio_centre').doc(curs).collection(mat.id)
          .where('grupClasseId','==', grupClasId).get();
        if (snap.empty) snap = await db.collection('avaluacio_centre').doc(curs).collection(mat.id)
          .where('grupId','==', grupClasId).get();
        snap.docs.forEach(d => {
          const data = d.data();
          if (periodeFiltre && data.periodeNom && data.periodeNom !== periodeFiltre) return;
          if (periodeFiltre && !data.periodeNom) return;
          const key = data.ralc || Object.keys(resultat).find(k =>
            resultat[k].nom === data.nom && resultat[k].cognoms === (data.cognoms||'')
          ) || data.ralc || `_${d.id}`;
          if (!resultat[key]) resultat[key] = { id: key, nom: data.nom||'', cognoms: data.cognoms||'', ralc: data.ralc||'', materies: {} };
          resultat[key].materies[mat.id] = { ...data, nom: mat.nom || mat.id, docId: d.id, docRef: d.ref };
        });
      } catch(e) {}
    }

    const alumnes = Object.values(resultat);
    if (alumnes.length === 0) {
      llistaEl.innerHTML = `<div style="padding:30px;text-align:center;color:#9ca3af;font-size:13px;">Cap alumne/a trobat/da en aquest grup.</div>`;
      return;
    }

    // Calcular semàfor simple (% d'ítems NA)
    function _semafor(alumne) {
      let total = 0, na = 0;
      Object.values(alumne.materies).forEach(mat => {
        (mat.items||[]).forEach(item => {
          total++;
          if (_jaNorm(item.assoliment||'').includes('no ass')) na++;
        });
      });
      if (total === 0) return { color:'#9ca3af', emoji:'⚪' };
      const pct = na / total;
      if (pct >= 0.5) return { color:'#ef4444', emoji:'🔴' };
      if (pct >= 0.25) return { color:'#f59e0b', emoji:'🟡' };
      return { color:'#22c55e', emoji:'🟢' };
    }

    // Renderitzar llista
    llistaEl.innerHTML = `
      <div style="padding:10px 12px;background:#1e1b4b;color:#fff;font-size:12px;font-weight:700;
                  position:sticky;top:0;z-index:1;">
        ${alumnes.length} alumnes/es · ${_jaEsH(grupData.nom||grupId)}
      </div>
    `;
    alumnes.sort((a,b) => (a.cognoms||a.nom).localeCompare(b.cognoms||b.nom,'ca')).forEach(alumne => {
      const sem = _semafor(alumne);
      const div = document.createElement('div');
      div.style.cssText = `padding:10px 14px;cursor:pointer;border-bottom:1px solid #f3f4f6;
        display:flex;align-items:center;gap:10px;transition:background .15s;`;
      div.innerHTML = `
        <span style="font-size:16px;">${sem.emoji}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:13px;color:#1e1b4b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${_jaEsH(alumne.cognoms ? `${alumne.cognoms}, ${alumne.nom}` : alumne.nom)}
          </div>
          ${alumne.ralc ? `<div style="font-size:11px;color:#9ca3af;">${_jaEsH(alumne.ralc)}</div>` : ''}
        </div>
      `;
      div.addEventListener('mouseenter', () => { if (!div.dataset.actiu) div.style.background = '#f0f0ff'; });
      div.addEventListener('mouseleave', () => { if (!div.dataset.actiu) div.style.background = ''; });
      div.addEventListener('click', () => {
        llistaEl.querySelectorAll('[data-actiu]').forEach(el => { delete el.dataset.actiu; el.style.background = ''; });
        div.dataset.actiu = '1';
        div.style.background = '#e0e7ff';
        jaMostrarDetall(alumne, materies, curs, periodeFiltre, detallEl);
      });
      llistaEl.appendChild(div);
    });

  } catch(e) {
    llistaEl.innerHTML = `<div style="padding:20px;color:#ef4444;font-size:13px;">Error: ${_jaEsH(e.message)}</div>`;
    console.error('jaCarregarAlumnes:', e);
  }
}

/* ══════════════════════════════════════════════════════
   DETALL ALUMNE EDITABLE
══════════════════════════════════════════════════════ */
async function jaMostrarDetall(alumne, materies, curs, periodeFiltre, detallEl) {
  detallEl.innerHTML = `<div style="padding:40px;text-align:center;color:#9ca3af;">⏳ Carregant detall...</div>`;

  const db = window.db;

  // Llegir comentari de tutoria (col·lecció alumnes)
  let comentariTutoria = '';
  let alumneDocId = null;
  let periodeIdTutoria = null;
  try {
    // Cercar l'alumne per RALC o nom a la col·lecció alumnes
    let snapAl = alumne.ralc
      ? await db.collection('alumnes').where('ralc','==', alumne.ralc).limit(5).get()
      : null;
    if (!snapAl || snapAl.empty) {
      snapAl = await db.collection('alumnes').where('nom','==', alumne.nom).limit(10).get();
    }
    if (snapAl && !snapAl.empty) {
      // Agafar el primer doc que tingui comentarisPerPeriode
      for (const d of snapAl.docs) {
        const data = d.data();
        const periodes = data.comentarisPerPeriode || {};
        // Triar el període que coincideixi amb el filtre, o el primer que existeixi
        const claus = Object.keys(periodes);
        let clauTriada = null;
        if (periodeFiltre) {
          // Buscar la clau on el nom del període coincideixi
          clauTriada = claus.find(k => periodes[k]?.periodeNom === periodeFiltre || k === periodeFiltre);
        }
        if (!clauTriada && claus.length > 0) clauTriada = claus[claus.length - 1]; // últim
        if (clauTriada) {
          comentariTutoria = periodes[clauTriada]?.comentari || '';
          alumneDocId = d.id;
          periodeIdTutoria = clauTriada;
          break;
        } else if (claus.length === 0 && !alumneDocId) {
          alumneDocId = d.id;
        }
      }
    }
  } catch(e) { console.warn('ja: comentari tutoria:', e.message); }

  // Llegir autoavaluació
  let autoavalData = null;
  let autoavalDocId = null;
  try {
    if (alumne.ralc) {
      const alumProfSnap = await db.collection('professors')
        .where('rols','array-contains','alumne')
        .where('ralc','==', alumne.ralc).limit(1).get();
      if (!alumProfSnap.empty) {
        const alumUID = alumProfSnap.docs[0].id;
        const respSnap = await db.collection('autoaval_respostes')
          .where('alumneUID','==', alumUID).get();
        if (!respSnap.empty) {
          // Agafar la més recent
          const docs = respSnap.docs.sort((a,b) => (b.data().enviatAt?.seconds||0)-(a.data().enviatAt?.seconds||0));
          autoavalData = docs[0].data();
          autoavalDocId = docs[0].id;
        }
      }
    }
  } catch(e) { console.warn('ja: autoavaluació:', e.message); }

  // Renderitzar detall
  const materiesTotals = Object.entries(alumne.materies).map(([id, data]) => ({
    ...data, id, nom: data.materiaNom || data.nom_materia || materies.find(m=>m.id===id)?.nom || id,
  }));

  detallEl.innerHTML = `
    <!-- CAPÇALERA -->
    <div style="background:linear-gradient(135deg,#1e1b4b,#4c1d95);color:#fff;border-radius:16px;
                padding:20px 24px;margin-bottom:20px;">
      <div style="font-size:22px;font-weight:800;margin-bottom:4px;">
        ${_jaEsH(alumne.cognoms ? `${alumne.cognoms}, ${alumne.nom}` : alumne.nom)}
      </div>
      <div style="font-size:13px;opacity:0.8;">
        ${alumne.ralc ? `RALC: <strong>${_jaEsH(alumne.ralc)}</strong> · ` : ''}
        ${materiesTotals.length} matèries · curs ${_jaEsH(curs)}
        ${periodeFiltre ? ` · ${_jaEsH(periodeFiltre)}` : ''}
      </div>
    </div>

    <!-- MATÈRIES EDITABLES -->
    <div id="jaMateries"></div>

    <!-- COMENTARI TUTORIA -->
    <div style="background:#f5f3ff;border:1.5px solid #a78bfa;border-radius:12px;
                padding:18px 20px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:700;color:#4c1d95;margin-bottom:8px;">
        💬 Comentari de tutoria
        ${periodeFiltre ? `<span style="font-size:11px;font-weight:500;color:#7c3aed;margin-left:6px;">(${_jaEsH(periodeFiltre)})</span>` : ''}
      </div>
      <textarea id="jaComentariTutoria" rows="4" placeholder="Sense comentari de tutoria..."
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #ddd6fe;
               border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;outline:none;
               background:#fff;"
      >${_jaEsH(comentariTutoria)}</textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:8px;">
        <button id="jaGuardarTutoria" style="padding:7px 16px;background:#7c3aed;color:#fff;
          border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;
          font-family:inherit;">
          💾 Guardar comentari tutoria
        </button>
      </div>
    </div>

    <!-- AUTOAVALUACIÓ -->
    <div id="jaAutoavalSection" style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;
                padding:18px 20px;margin-bottom:20px;${autoavalData ? '' : 'opacity:0.6;'}">
      <div style="font-size:13px;font-weight:700;color:#166534;margin-bottom:8px;">
        📝 Autoavaluació de l'alumne/a
        ${autoavalData ? `<span style="font-size:11px;font-weight:500;color:#16a34a;margin-left:6px;">${_jaEsH(autoavalData.periodeNom||'')}</span>` : ''}
      </div>
      ${autoavalData ? `
        <div style="margin-bottom:12px;background:#fff;border-radius:8px;padding:12px 14px;
                    font-size:12px;color:#374151;max-height:180px;overflow-y:auto;line-height:1.7;">
          ${(autoavalData.preguntes||[]).map((p,i) => `
            <div style="margin-bottom:8px;">
              <strong style="color:#166534;">${_jaEsH(p.text||`Pregunta ${i+1}`)}</strong><br>
              ${_jaEsH((autoavalData.respostes||[])[i]||'—')}
            </div>
          `).join('')}
        </div>
        <div style="font-size:13px;font-weight:700;color:#166534;margin-bottom:6px;">
          💬 Valoració del tutor/a
        </div>
        <textarea id="jaComentariAutoaval" rows="3" placeholder="Afegeix la valoració del tutor/a..."
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #86efac;
                 border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;outline:none;
                 background:#fff;"
        >${_jaEsH(autoavalData.comentariTutor||'')}</textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:8px;">
          <button id="jaGuardarAutoaval" style="padding:7px 16px;background:#059669;color:#fff;
            border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;
            font-family:inherit;">
            💾 Guardar valoració tutor/a
          </button>
        </div>
      ` : `<div style="font-size:12px;color:#6b7280;">Aquest alumne/a no té autoavaluació enviada.</div>`}
    </div>
  `;

  // Renderitzar matèries editables
  const materiesDiv = detallEl.querySelector('#jaMateries');
  materiesTotals.forEach(mat => {
    const items = mat.items || [];
    const div = document.createElement('div');
    div.style.cssText = 'margin-bottom:20px;border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;';
    div.innerHTML = `
      <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:12px 16px;
                  display:flex;justify-content:space-between;align-items:center;">
        <div style="font-weight:800;color:#fff;font-size:14px;">📚 ${_jaEsH(mat.nom)}</div>
        ${mat.periodeNom ? `<span style="background:rgba(255,255,255,0.2);color:#fff;padding:2px 8px;
          border-radius:5px;font-size:11px;font-weight:700;">${_jaEsH(mat.periodeNom)}</span>` : ''}
      </div>
      ${mat.descripcioComuna ? `
        <div style="background:#f9fafb;padding:8px 14px;font-size:12px;color:#6b7280;
                    border-bottom:1px solid #f3f4f6;font-style:italic;">
          ${_jaEsH(mat.descripcioComuna.substring(0,200))}
        </div>` : ''}
      <div class="jaItemsContainer" data-matid="${mat.id}" style="padding:12px;display:flex;flex-direction:column;gap:8px;"></div>
      <div style="padding:10px 14px;border-top:1px solid #f3f4f6;display:flex;gap:8px;justify-content:flex-end;
                  background:#fafafa;">
        <button class="jaGuardarMateria" data-matid="${mat.id}" data-docid="${mat.docId||''}"
          style="padding:7px 16px;background:#0891b2;color:#fff;border:none;border-radius:8px;
                 font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">
          💾 Guardar ${_jaEsH(mat.nom)}
        </button>
      </div>
    `;

    const itemsContainer = div.querySelector('.jaItemsContainer');
    if (items.length === 0) {
      itemsContainer.innerHTML = `<div style="padding:12px;color:#9ca3af;font-size:12px;text-align:center;">
        Sense ítems introduïts pel professor/a</div>`;
    } else {
      items.forEach((item, idx) => {
        const c = _jaColorAss(item.assoliment||'');
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = `background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;`;
        itemDiv.innerHTML = `
          <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;">
            ${_jaEsH(item.titol||`Ítem ${idx+1}`)}
          </div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start;">
            <textarea class="jaItemCom" data-idx="${idx}" rows="2"
              style="padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:12px;
                     font-family:inherit;resize:vertical;outline:none;width:100%;box-sizing:border-box;"
            >${_jaEsH(item.comentari||'')}</textarea>
            <select class="jaItemAss" data-idx="${idx}"
              style="padding:7px 10px;border:2px solid ${c.border};border-radius:8px;font-size:12px;
                     font-weight:700;color:${c.text};background:${c.bg};outline:none;cursor:pointer;
                     white-space:nowrap;min-width:170px;">
              ${JA_ASSOLIMENTS.map(a => `<option value="${a}" ${a===item.assoliment?'selected':''}>${a}</option>`).join('')}
            </select>
          </div>
        `;
        // Actualitzar color del select en canviar
        itemDiv.querySelector('.jaItemAss').addEventListener('change', function() {
          const nc = _jaColorAss(this.value);
          this.style.borderColor = nc.border;
          this.style.background  = nc.bg;
          this.style.color       = nc.text;
        });
        itemsContainer.appendChild(itemDiv);
      });
    }
    materiesDiv.appendChild(div);
  });

  // Listeners guardar matèria
  detallEl.querySelectorAll('.jaGuardarMateria').forEach(btn => {
    btn.addEventListener('click', async () => {
      const matId  = btn.dataset.matid;
      const mat    = alumne.materies[matId];
      if (!mat || !mat.docRef) { window.mostrarToast?.('⚠️ No es pot guardar: referència no trobada'); return; }

      const container = detallEl.querySelector(`.jaItemsContainer[data-matid="${matId}"]`);
      const nouItems = (mat.items||[]).map((item, idx) => ({
        ...item,
        comentari:  container.querySelector(`.jaItemCom[data-idx="${idx}"]`)?.value?.trim() || item.comentari||'',
        assoliment: container.querySelector(`.jaItemAss[data-idx="${idx}"]`)?.value || item.assoliment||'No avaluat',
      }));

      btn.textContent = '⏳ Guardant...';
      btn.disabled = true;
      try {
        await mat.docRef.update({ items: nouItems, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
        // Actualitzar dades en memòria
        alumne.materies[matId].items = nouItems;
        btn.textContent = '✅ Guardat!';
        setTimeout(() => { btn.textContent = `💾 Guardar ${mat.nom||matId}`; btn.disabled = false; }, 2000);
        window.mostrarToast?.(`✅ ${mat.nom||matId} guardat`);
      } catch(e) {
        btn.textContent = '❌ Error';
        btn.disabled = false;
        window.mostrarToast?.('❌ Error guardant: ' + e.message);
      }
    });
  });

  // Listener guardar comentari tutoria
  const btnTutoria = detallEl.querySelector('#jaGuardarTutoria');
  if (btnTutoria) {
    btnTutoria.addEventListener('click', async () => {
      const text = detallEl.querySelector('#jaComentariTutoria')?.value?.trim() || '';
      if (!alumneDocId) { window.mostrarToast?.('⚠️ No s\'ha pogut identificar l\'alumne/a a la classe del professor/a'); return; }
      if (!periodeIdTutoria) { window.mostrarToast?.('⚠️ No s\'ha trobat cap període de tutoria per a aquest alumne/a'); return; }
      btnTutoria.textContent = '⏳ Guardant...'; btnTutoria.disabled = true;
      try {
        await db.collection('alumnes').doc(alumneDocId).update({
          [`comentarisPerPeriode.${periodeIdTutoria}.comentari`]: text,
        });
        btnTutoria.textContent = '✅ Guardat!';
        setTimeout(() => { btnTutoria.textContent = '💾 Guardar comentari tutoria'; btnTutoria.disabled = false; }, 2000);
        window.mostrarToast?.('✅ Comentari de tutoria guardat');
      } catch(e) {
        btnTutoria.textContent = '❌ Error'; btnTutoria.disabled = false;
        window.mostrarToast?.('❌ Error: ' + e.message);
      }
    });
  }

  // Listener guardar valoració autoavaluació
  const btnAA = detallEl.querySelector('#jaGuardarAutoaval');
  if (btnAA && autoavalDocId) {
    btnAA.addEventListener('click', async () => {
      const comentari = detallEl.querySelector('#jaComentariAutoaval')?.value?.trim() || '';
      btnAA.textContent = '⏳ Guardant...'; btnAA.disabled = true;
      try {
        await db.collection('autoaval_respostes').doc(autoavalDocId).update({
          comentariTutor: comentari,
          estat: autoavalData.estat === 'enviatButlleti' ? 'enviatButlleti' : 'revisat',
          revisatAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        });
        autoavalData.comentariTutor = comentari;
        btnAA.textContent = '✅ Guardat!';
        setTimeout(() => { btnAA.textContent = '💾 Guardar valoració tutor/a'; btnAA.disabled = false; }, 2000);
        window.mostrarToast?.('✅ Valoració de l\'autoavaluació guardada');
      } catch(e) {
        btnAA.textContent = '❌ Error'; btnAA.disabled = false;
        window.mostrarToast?.('❌ Error: ' + e.message);
      }
    });
  }
}

/* ══════════════════════════════════════════════════════
   HELPERS ADDICIONALS
══════════════════════════════════════════════════════ */
async function _jaCarregarCurs() {
  if (window._cursActiu) return window._cursActiu;
  try {
    const doc = await window.db.collection('_sistema').doc('config').get();
    const c = doc.data()?.cursActiu;
    if (c) { window._cursActiu = c; return c; }
  } catch(e) {}
  const ara = new Date();
  const any = ara.getMonth() >= 8 ? ara.getFullYear() : ara.getFullYear()-1;
  return `${any}-${String(any+1).slice(-2)}`;
}

window.obrirJuntaAvaluacio = obrirJuntaAvaluacio;
