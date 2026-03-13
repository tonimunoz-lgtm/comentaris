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
  // Evitar múltiples injeccions
  if (document.getElementById('btnAvaluacioCentre')) return;

  const doInject = () => {
    // Doble-check per evitar race conditions
    if (document.getElementById('btnAvaluacioCentre')) return;
    const btnExcel = document.getElementById('btnExportExcel');
    if (!btnExcel) return;

    const btn = document.createElement('button');
    btn.id = 'btnAvaluacioCentre';
    btn.className = 'btn-outline btn-sm';
    btn.style.cssText = `
      background: linear-gradient(135deg, #7c3aed, #4f46e5);
      color: #fff; border: none; font-weight: 600;
    `;
    btn.innerHTML = '🏫 Avaluació Centre';
    btn.title = 'Envia els comentaris i assoliments al quadre institucional';
    btn.addEventListener('click', obrirModalAvaluacioCentre);
    btnExcel.insertAdjacentElement('afterend', btn);
    console.log('✅ Botó Avaluació Centre injectat');
  };

  // Un sol MutationObserver que es desconnecta immediatament un cop injectat
  let _obs = null;
  const tryInject = () => {
    if (document.getElementById('btnAvaluacioCentre')) { _obs?.disconnect(); return; }
    if (document.getElementById('btnExportExcel')) {
      _obs?.disconnect();
      doInject();
      return;
    }
    if (!_obs) {
      _obs = new MutationObserver(() => {
        if (document.getElementById('btnExportExcel') && !document.getElementById('btnAvaluacioCentre')) {
          _obs.disconnect(); _obs = null;
          doInject();
        }
      });
      _obs.observe(document.body, { childList: true, subtree: true });
    }
  };
  tryInject();
}

/* ══════════════════════════════════════════════════════
   MODAL PRINCIPAL — nou flux
   
   FLUX:
   1. Professor li dona al botó
   2. Selecciona matèria centre + grup + descripció comuna
   3. Clica "⚡ Carregar comentaris de la classe"
   4. El sistema llegeix TOTS els alumnes de la classe,
      agafa els seus comentarisItems de l'UC del periode actiu,
      i mostra un resum per alumne amb estat
   5. Professor revisa i envia amb "🏫 Enviar al centre"
══════════════════════════════════════════════════════ */
async function obrirModalAvaluacioCentre() {
  document.getElementById('modalAvaluacioCentre')?.remove();

  const [materies, grups] = await Promise.all([
    carregarMateriesCentre(),
    carregarGrupsCentre()
  ]);

  // Preseleccionar a partir del nom de la classe actual
  const classTitle = document.getElementById('classTitle')?.textContent || '';

  const modal = document.createElement('div');
  modal.id = 'modalAvaluacioCentre';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);
    display:flex;align-items:flex-start;justify-content:center;
    padding:16px;overflow-y:auto;
  `;

  // Grups agrupats per curs
  const cursos = [...new Set(grups.map(g=>g.curs).filter(Boolean))].sort().reverse();
  const grupsOpts = cursos.map(c =>
    `<optgroup label="${c}">` +
    grups.filter(g=>g.curs===c).map(g =>
      `<option value="${g.id}" data-nom="${escapeHtml(g.nom)}" data-curs="${c}">
        ${escapeHtml(g.nom)}
       </option>`
    ).join('') +
    `</optgroup>`
  ).join('');

  modal.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px;width:100%;max-width:800px;
                box-shadow:0 25px 60px rgba(0,0,0,0.3);margin:auto;">

      <!-- HEADER -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div>
          <h2 style="font-size:19px;font-weight:800;color:#1e1b4b;margin:0;">
            🏫 Avaluació Centre
          </h2>
          <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">
            Envia els comentaris i assoliments generats amb l'UltraComentator
          </p>
        </div>
        <button id="btnTancarAvCentre" style="background:none;border:none;font-size:24px;cursor:pointer;color:#9ca3af;line-height:1;">✕</button>
      </div>

      <!-- PAS 1: CONFIGURACIÓ -->
      <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:14px;padding:18px;margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;color:#7c3aed;letter-spacing:0.05em;margin-bottom:14px;">
          PAS 1 — CONFIGURACIÓ
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Matèria del centre *</label>
            <select id="selMateriaAC" style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;
                    border-radius:9px;font-size:13px;outline:none;background:#fff;">
              <option value="">— Tria la matèria —</option>
              ${materies.map(m => `<option value="${m.id}" data-nom="${escapeHtml(m.nom)}">${escapeHtml(m.nom)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Grup del centre *</label>
            <select id="selGrupAC" style="width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;
                    border-radius:9px;font-size:13px;outline:none;background:#fff;">
              <option value="">— Tria el grup —</option>
              ${grupsOpts}
            </select>
          </div>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">
            Descripció comuna
            <span style="font-weight:400;color:#9ca3af;">(context de la matèria per al butlletí)</span>
          </label>
          <textarea id="descComunaAC" rows="2"
            placeholder="Ex: Durant aquest trimestre hem treballat les competències bàsiques de..."
            style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #e5e7eb;
                   border-radius:9px;font-size:13px;outline:none;resize:vertical;font-family:inherit;"></textarea>
        </div>
      </div>

      <!-- PAS 2: CARREGAR COMENTARIS -->
      <div style="margin-bottom:16px;">
        <button id="btnCarregarComentarisAC" style="
          width:100%;padding:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);
          color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;
          cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
          ⚡ Carregar comentaris de la classe actual
        </button>
        <p style="font-size:11px;color:#9ca3af;text-align:center;margin:6px 0 0;">
          Llegeix els comentaris i assoliments guardats per l'UltraComentator del període actiu
        </p>
      </div>

      <!-- PAS 3: RESUM PER ALUMNE (s'omple dinàmicament) -->
      <div id="resümAlumnesAC" style="display:none;">
        <div style="font-size:12px;font-weight:700;color:#7c3aed;letter-spacing:0.05em;margin-bottom:12px;">
          PAS 2 — REVISIÓ
        </div>
        <div id="statsAC" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;"></div>
        <div id="taulaAlumnesAC" style="max-height:350px;overflow-y:auto;border:1.5px solid #e5e7eb;border-radius:10px;"></div>
      </div>

      <!-- BOTONS FINALS -->
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
        <button id="btnCancelAvCentre" style="
          padding:10px 20px;background:#f3f4f6;border:none;border-radius:10px;
          font-weight:600;cursor:pointer;font-size:13px;">Cancel·lar</button>
        <button id="btnEnviarAC" style="
          padding:10px 24px;background:linear-gradient(135deg,#7c3aed,#4f46e5);
          color:#fff;border:none;border-radius:10px;font-weight:700;
          cursor:pointer;font-size:13px;display:none;">
          🏫 Enviar al centre (<span id="cntEnviarAC">0</span> alumnes)
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Preseleccionar si el nom de la classe coincideix amb algun grup
  if (classTitle) {
    const opt = [...modal.querySelectorAll('#selGrupAC option')].find(o =>
      o.textContent.trim().toLowerCase().includes(classTitle.toLowerCase().split('—')[0].trim().toLowerCase())
    );
    if (opt) opt.selected = true;
  }

  // Events
  modal.querySelector('#btnTancarAvCentre').addEventListener('click', () => modal.remove());
  modal.querySelector('#btnCancelAvCentre').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#btnCarregarComentarisAC').addEventListener('click', carregarComentarisClasse);
  modal.querySelector('#btnEnviarAC').addEventListener('click', enviarAvaluacioCentre);
}

/* ══════════════════════════════════════════════════════
   LLEGIR TOTS ELS COMENTARIS DE LA CLASSE ACTUAL
   Agafa comentarisItems de l'UC per a cada alumne
══════════════════════════════════════════════════════ */
async function carregarComentarisClasse() {
  const classId   = window.currentClassId;
  const periodeId = window.currentPeriodeId;

  if (!classId) {
    window.mostrarToast('⚠️ Primer obre una classe', 3000);
    return;
  }

  const btn = document.getElementById('btnCarregarComentarisAC');
  btn.innerHTML = '⏳ Carregant...';
  btn.disabled = true;

  try {
    // Llegir tots els alumnes via IDs de la classe (com fa app.js)
    const classeDoc = await window.db.collection('classes').doc(classId).get();
    if (!classeDoc.exists) throw new Error('Classe no trobada');

    const alumneIds = classeDoc.data().alumnes || [];
    if (alumneIds.length === 0) {
      window.mostrarToast('⚠️ La classe no té alumnes', 3000);
      btn.innerHTML = '⚡ Carregar comentaris de la classe actual';
      btn.disabled = false;
      return;
    }

    // Llegir tots els alumnes en parallel (en blocs de 10)
    const alumnesDocs = [];
    for (let i = 0; i < alumneIds.length; i += 10) {
      const chunk = alumneIds.slice(i, i + 10);
      const docs = await Promise.all(
        chunk.map(id => window.db.collection('alumnes').doc(id).get())
      );
      alumnesDocs.push(...docs);
    }

    // Processar cada alumne
    const alumnes = alumnesDocs
      .filter(d => d.exists)
      .map(d => {
        const data = d.data();
        const periodeData = periodeId
          ? data.comentarisPerPeriode?.[periodeId]
          : null;

        // Buscar en tots els períodes si el període actiu no té dades
        let comentarisItems = periodeData?.comentarisItems || periodeData?.items || null;
        let comentariText   = periodeData?.comentari || '';
        let periodeUsatNom  = periodeId ? 'actiu' : '—';

        // Si no hi ha dades al periode actiu, buscar en altres períodes
        if (!comentarisItems && !comentariText) {
          const tots = data.comentarisPerPeriode || {};
          for (const [pId, pData] of Object.entries(tots)) {
            if (pData?.comentarisItems?.length || pData?.comentari) {
              comentarisItems = pData.comentarisItems || pData.items || null;
              comentariText   = pData.comentari || '';
              periodeUsatNom  = pId;
              break;
            }
          }
          // Llegat: comentari directe a l'alumne
          if (!comentariText && data.comentari) {
            comentariText = data.comentari;
          }
        }

        const nom     = data.nom || '';
        const cognoms = data.cognoms || '';
        const nomComplet = cognoms ? `${cognoms}, ${nom}` : nom;

        return {
          id: d.id,
          nom, cognoms, nomComplet,
          ralc: data.ralc || '',
          comentarisItems,
          comentariText,
          periodeUsatNom,
          teItems: !!(comentarisItems?.length),
          teComentari: !!comentariText,
        };
      })
      .sort((a, b) => (a.cognoms || a.nom).localeCompare(b.cognoms || b.nom, 'ca'));

    // Guardar per usar a enviarAvaluacioCentre
    window._acAlumnesCarregats = alumnes;

    // Mostrar resum
    mostrarResumAlumnes(alumnes);

    btn.innerHTML = '✅ Comentaris carregats — clica Enviar per confirmar';
    btn.style.background = 'linear-gradient(135deg,#059669,#10b981)';

  } catch (e) {
    console.error('carregarComentarisClasse:', e);
    window.mostrarToast('❌ Error: ' + e.message, 5000);
    btn.innerHTML = '⚡ Carregar comentaris de la classe actual';
    btn.disabled = false;
  }
}

/* ══════════════════════════════════════════════════════
   MOSTRAR RESUM PER ALUMNE
══════════════════════════════════════════════════════ */
function mostrarResumAlumnes(alumnes) {
  const resum = document.getElementById('resümAlumnesAC');
  const stats = document.getElementById('statsAC');
  const taula = document.getElementById('taulaAlumnesAC');
  const btnEnviar = document.getElementById('btnEnviarAC');
  if (!resum || !taula) return;

  const ambItems    = alumnes.filter(a => a.teItems).length;
  const ambComent   = alumnes.filter(a => !a.teItems && a.teComentari).length;
  const senseDades  = alumnes.filter(a => !a.teItems && !a.teComentari).length;

  stats.innerHTML = [
    { n: ambItems,   label: 'amb ítems UC',      c: '#059669', bg: '#f0fdf4' },
    { n: ambComent,  label: 'només comentari',   c: '#d97706', bg: '#fffbeb' },
    { n: senseDades, label: 'sense dades',        c: '#dc2626', bg: '#fef2f2' },
  ].map(s => `
    <div style="padding:8px 14px;background:${s.bg};border-radius:8px;font-size:12px;">
      <strong style="font-size:18px;color:${s.c};">${s.n}</strong>
      <span style="color:#6b7280;margin-left:5px;">${s.label}</span>
    </div>
  `).join('');

  // Taula d'alumnes
  taula.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#f3f4f6;position:sticky;top:0;">
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#374151;">Alumne/a</th>
          <th style="padding:8px 12px;text-align:center;font-weight:600;color:#374151;">Ítems UC</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#374151;">Assoliments</th>
          <th style="padding:8px 12px;text-align:center;font-weight:600;color:#374151;">Estat</th>
        </tr>
      </thead>
      <tbody>
        ${alumnes.map(a => {
          const COLORS = {
            'Assoliment Excel·lent': '#7c3aed',
            'Assoliment Notable':    '#2563eb',
            'Assoliment Satisfactori':'#d97706',
            'No Assoliment':         '#dc2626',
            'No avaluat':            '#9ca3af',
          };
          const itemsHtml = a.comentarisItems?.map(it => {
            const c = COLORS[it.assoliment] || '#9ca3af';
            return `<span style="background:${c};color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;margin:1px;display:inline-block;">${escapeHtml(it.assoliment||'?')}</span>`;
          }).join('') || '';

          const estat = a.teItems
            ? `<span style="color:#059669;font-weight:700;">✅ ${a.comentarisItems.length} ítems</span>`
            : a.teComentari
            ? `<span style="color:#d97706;font-weight:700;">💬 comentari</span>`
            : `<span style="color:#dc2626;font-weight:700;">⚠️ buit</span>`;

          return `
            <tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:7px 12px;font-weight:600;color:#1e1b4b;">${escapeHtml(a.nomComplet)}</td>
              <td style="padding:7px 12px;text-align:center;color:#6b7280;">${a.comentarisItems?.length || '—'}</td>
              <td style="padding:7px 12px;">${itemsHtml || (a.teComentari ? '<span style="color:#9ca3af;font-style:italic;">text lliure</span>' : '—')}</td>
              <td style="padding:7px 12px;text-align:center;">${estat}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  resum.style.display = 'block';

  // Mostrar botó enviar
  const total = alumnes.filter(a => a.teItems || a.teComentari).length;
  document.getElementById('cntEnviarAC').textContent = total;
  btnEnviar.style.display = total > 0 ? 'block' : 'none';
}

/* ══════════════════════════════════════════════════════
   ENVIAR A FIREBASE
   Cada alumne té els seus propis ítems i comentari
══════════════════════════════════════════════════════ */
async function enviarAvaluacioCentre() {
  const materiaEl  = document.getElementById('selMateriaAC');
  const grupEl     = document.getElementById('selGrupAC');
  const descComuna = document.getElementById('descComunaAC')?.value?.trim() || '';

  if (!materiaEl?.value || !grupEl?.value) {
    window.mostrarToast('⚠️ Selecciona matèria i grup', 3000);
    return;
  }

  const alumnes = window._acAlumnesCarregats;
  if (!alumnes?.length) {
    window.mostrarToast('⚠️ Primer carrega els comentaris de la classe', 3000);
    return;
  }

  const materiaId  = materiaEl.value;
  const materiaNom = materiaEl.options[materiaEl.selectedIndex]?.dataset.nom || materiaEl.value;
  const grupId     = grupEl.value;
  const grupNom    = grupEl.options[grupEl.selectedIndex]?.dataset.nom || grupEl.value;
  const curs       = grupEl.options[grupEl.selectedIndex]?.dataset.curs || '2024-25';
  const periodeId  = window.currentPeriodeId || 'general';
  const profUid    = firebase.auth().currentUser?.uid || '';
  const profEmail  = firebase.auth().currentUser?.email || '';

  const btnEnviar = document.getElementById('btnEnviarAC');
  btnEnviar.disabled = true;
  btnEnviar.innerHTML = '⏳ Enviant...';

  try {
    const db = window.db;
    // Dividir en blocs de 400 per límit de Firestore batch (500 max)
    const alumnesAEnviar = alumnes.filter(a => a.teItems || a.teComentari);
    let count = 0;

    for (let i = 0; i < alumnesAEnviar.length; i += 400) {
      const chunk = alumnesAEnviar.slice(i, i + 400);
      const batch = db.batch();

      chunk.forEach(alumne => {
        // Items: prioritat als ítems UC; si no, crear un ítem amb el comentari
        const items = alumne.teItems
          ? alumne.comentarisItems.map(it => ({
              titol:      it.titol      || '',
              assoliment: it.assoliment || 'No avaluat',
              comentari:  it.comentari  || alumne.comentariText || '',
            }))
          : [{ titol: 'Comentari', comentari: alumne.comentariText, assoliment: 'No avaluat' }];

        const ref = db
          .collection('avaluacio_centre')
          .doc(curs)
          .collection(materiaId)
          .doc(alumne.id);

        batch.set(ref, {
          nom:             alumne.nom,
          cognoms:         alumne.cognoms,
          nomComplet:      alumne.nomComplet,
          ralc:            alumne.ralc,
          grup:            grupNom,
          grupId,
          materiaNom,
          materiaId,
          curs,
          periodeId,
          descripcioComuna: descComuna,
          items,
          professorUid:    profUid,
          professorEmail:  profEmail,
          updatedAt:       firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        count++;
      });

      await batch.commit();
    }

    window.mostrarToast(`✅ ${count} alumnes enviats a Avaluació Centre`, 3000);
    window._acAlumnesCarregats = null;
    document.getElementById('modalAvaluacioCentre')?.remove();

  } catch (e) {
    console.error('enviarAvaluacioCentre:', e);
    window.mostrarToast('❌ Error: ' + e.message, 5000);
    btnEnviar.disabled = false;
    btnEnviar.innerHTML = '🏫 Enviar al centre (<span id="cntEnviarAC">...</span> alumnes)';
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
