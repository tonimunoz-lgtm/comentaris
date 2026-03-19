// autodiagnosi-revisor.js
// Injector: afegeix accés a les autodiagnosis d'alumnes al Revisor i a Tutoria
//
// REVISOR: afegeix una pestanya "🧠 Autodiagnosi" al panell de revisió
//   - Filtres: curs, grup tutoria
//   - Llista d'alumnes amb estat de les respostes
//   - Editor: veure respostes, editar comentari tutor, enviar al butlletí
//
// TUTORIA: afegeix una secció "Autodiagnosi" al detall de cada alumne
//   - Mostra la resposta de l'alumne en mode lectura
//   - Mostra el comentari del tutor si existeix
//
// INSTAL·LACIÓ: afegir a index.html ABANS de </body>:
//   <script type="module" src="autodiagnosi-revisor.js"></script>

console.log('🧠 autodiagnosi-revisor.js carregat');

// Carregar períodes des de Firestore (compartit amb autodiagnosi-butlletins.js)
async function carregarPeriodesADR() {
  const BASE = [
    { codi:'preav', nom:'Pre-avaluació' },
    { codi:'T1',    nom:'1r Trimestre'  },
    { codi:'T2',    nom:'2n Trimestre'  },
    { codi:'T3',    nom:'3r Trimestre'  },
    { codi:'final', nom:'Final de curs' },
  ];
  try {
    const doc = await window.db.collection('_sistema').doc('periodes_tancats').get();
    if (!doc.exists) return BASE;
    const data = doc.data();
    const noms = data.noms || {};
    const ordre = data.ordre || BASE.map(p => p.codi);
    return ordre.map(codi => {
      const base = BASE.find(p => p.codi === codi) || { codi, nom: codi };
      return { codi, nom: noms[codi] || base.nom };
    });
  } catch(e) { return BASE; }
}



// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function adRH(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────
// INICIALITZACIÓ
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initADRevisor, 1800);
});

function initADRevisor() {
  if (!window.firebase?.auth) { setTimeout(initADRevisor, 500); return; }
  window.firebase.auth().onAuthStateChanged(user => {
    if (!user) return;
    observarPanells();
  });
}

// ─────────────────────────────────────────────
// OBSERVER: detectar obertura de panells
// ─────────────────────────────────────────────
function observarPanells() {
  const obs = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType !== 1) continue;

        // Panell Revisor
        if (node.id === 'panellRevisio' || node.querySelector?.('#panellRevisio')) {
          const panell = node.id === 'panellRevisio' ? node : node.querySelector('#panellRevisio');
          if (panell) setTimeout(() => injectarTabRevisor(panell), 300);
        }
      }
    }
  });
  obs.observe(document.body, { childList: true });

  // Tutoria: interceptar mostrarDetallAlumne via patch
  patchTutoriaDetall();
}

// ═════════════════════════════════════════════════════════
//  REVISOR — injectar pestanya Autodiagnosi
// ═════════════════════════════════════════════════════════
function injectarTabRevisor(panell) {
  if (panell.querySelector('#adRevTabBar')) return;

  // Trobar el header del revisor per afegir-hi el tab
  const header = panell.querySelector('div[style*="164e63"]') ||
                 panell.querySelector('div[style*="0891b2"]');
  if (!header) return;

  // Afegir botó de tab al header (com a toggle)
  const btnTab = document.createElement('button');
  btnTab.id = 'btnTabAutodiagnosiRevisor';
  btnTab.style.cssText = `
    padding:7px 16px;background:rgba(255,255,255,0.15);
    border:1.5px solid rgba(255,255,255,0.4);color:#fff;
    border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;
    margin-left:8px;transition:all .15s;
  `;
  btnTab.innerHTML = '🧠 Autodiagnosi';
  btnTab.title = 'Veure autodiagnosis d\'alumnes';

  // Afegir al costat del botó Carregar
  const btnCarregar = header.querySelector('#btnCarregarRevisio');
  if (btnCarregar) {
    btnCarregar.insertAdjacentElement('afterend', btnTab);
  } else {
    header.appendChild(btnTab);
  }

  // Contenidor per al contingut d'autodiagnosi (sobre revisioContent)
  const revisioContent = panell.querySelector('#revisioContent');
  if (!revisioContent) return;

  const adContent = document.createElement('div');
  adContent.id = 'adRevContent';
  adContent.style.cssText = 'flex:1;overflow-y:auto;padding:24px;min-height:0;display:none;';
  revisioContent.parentElement.insertBefore(adContent, revisioContent);

  let modeAutodiag = false;

  btnTab.addEventListener('click', () => {
    modeAutodiag = !modeAutodiag;
    if (modeAutodiag) {
      btnTab.style.background = '#fff';
      btnTab.style.color = '#0891b2';
      revisioContent.style.display = 'none';
      adContent.style.display = 'block';
      renderPanellAutodiagRevisor(adContent, panell);
    } else {
      btnTab.style.background = 'rgba(255,255,255,0.15)';
      btnTab.style.color = '#fff';
      revisioContent.style.display = 'block';
      adContent.style.display = 'none';
    }
  });
}

// ─────────────────────────────────────────────
// PANELL AUTODIAGNOSI al REVISOR
// ─────────────────────────────────────────────
async function renderPanellAutodiagRevisor(cont, panell) {
  cont.innerHTML = '<div style="padding:30px;text-align:center;color:#9ca3af;">⏳ Carregant...</div>';

  try {
    const db = window.db;
    const snap = await db.collection('grups_centre').get();
    const totsGrups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const grupsPerId = {};
    totsGrups.forEach(g => { grupsPerId[g.id] = g; });

    // Grups tutoria
    let grupsTutoria = totsGrups.filter(g => g.tipus === 'tutoria');
    if (grupsTutoria.length === 0) {
      grupsTutoria = totsGrups.filter(g => g.tipus === 'classe' && (g.alumnes||[]).length > 0);
    }

    // Etiqueta llegible
    function etiqueta(g) {
      const nivell = g.nivellNom || '';
      if (g.tipus === 'tutoria' && g.parentGrupId) {
        const pare = grupsPerId[g.parentGrupId];
        return `${nivell} ${pare?.nom || g.nom}`.trim();
      }
      return `${nivell} ${g.nom || ''}`.trim();
    }

    grupsTutoria.sort((a, b) => etiqueta(a).localeCompare(etiqueta(b), 'ca'));

    const cursActiu = window._cursActiu || '';
    const cursos = [...new Set(totsGrups.map(g => g.curs).filter(Boolean))].sort().reverse();

    cont.innerHTML = `
      <h4 style="font-size:15px;font-weight:700;color:#1e1b4b;margin-bottom:16px;">
        🧠 Autodiagnosi alumnes — Revisió
      </h4>
      <div style="background:#f0f9ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:14px 18px;margin-bottom:18px;font-size:12px;color:#1d4ed8;">
        💡 Pots veure les respostes dels alumnes, editar el comentari del tutor/a i enviar-les al butlletí.
      </div>
      <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
        <select id="adRevGrup" style="padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;min-width:200px;">
          <option value="">— Tria grup tutoria —</option>
          ${grupsTutoria.map(g => `<option value="${g.id}">${adRH(etiqueta(g))}</option>`).join('')}
        </select>
        <select id="adRevPeriode" style="padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;min-width:160px;">
          <option value="">⏳ Carregant períodes...</option>
        </select>
        <button id="adRevCarregar" style="padding:8px 18px;background:#0891b2;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;">
          🔍 Carregar
        </button>
      </div>
      <div id="adRevResultats">
        <div style="text-align:center;padding:40px;color:#9ca3af;font-size:13px;">
          Selecciona un grup per veure les autodiagnosis.
        </div>
      </div>
    `;

    // Carregar períodes reals
    carregarPeriodesADR().then(periodes => {
      const sel = document.getElementById('adRevPeriode');
      if (sel) {
        sel.innerHTML = '<option value="">— Tots els períodes —</option>' +
          periodes.map(p => `<option value="${p.nom}">${p.nom}</option>`).join('');
      }
    });

    document.getElementById('adRevCarregar').addEventListener('click', () => {
      const grupId = document.getElementById('adRevGrup').value;
      const periodeSelec = document.getElementById('adRevPeriode')?.value || '';
      if (!grupId) { window.mostrarToast?.('⚠️ Tria un grup', 3000); return; }
      const g = totsGrups.find(x => x.id === grupId);
      carregarAutodiagRevisor(grupId, etiqueta(g || {}), grupsPerId, periodeSelec);
    });

  } catch(e) {
    cont.innerHTML = `<div style="color:#ef4444;padding:20px;">❌ ${e.message}</div>`;
  }
}

async function carregarAutodiagRevisor(grupId, grupEtiqueta, grupsPerId, periodeFiltre = '') {
  const resDiv = document.getElementById('adRevResultats');
  resDiv.innerHTML = '<div style="padding:20px;text-align:center;color:#9ca3af;">⏳ Carregant...</div>';

  try {
    const db = window.db;
    const grupDoc = await db.collection('grups_centre').doc(grupId).get();
    const alumnesGrup = grupDoc.data()?.alumnes || [];

    // Alumnes usuaris amb rol alumne
    const alumnesSnap = await db.collection('professors')
      .where('rols', 'array-contains', 'alumne').get();
    const alumnesUsuaris = alumnesSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

    // Creuar per RALC
    const alumnesAmbUID = alumnesGrup.map(a => {
      const u = alumnesUsuaris.find(u =>
        (a.ralc && u.ralc && String(a.ralc) === String(u.ralc)) ||
        (a.email && u.email && a.email === u.email)
      );
      return { ...a, uid: u?.uid || null };
    });

    const uids = alumnesAmbUID.filter(a => a.uid).map(a => a.uid);

    // Llegir respostes
    let respostes = [];
    for (let i = 0; i < uids.length; i += 30) {
      const chunk = uids.slice(i, i + 30);
      const snap = await db.collection('autoaval_respostes')
        .where('alumneUID', 'in', chunk).get();
      respostes.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }

    // Última resposta per alumne
    const resPerAlumne = {};
    respostes.forEach(r => {
      const ex = resPerAlumne[r.alumneUID];
      if (!ex || (r.enviatAt?.seconds||0) > (ex.enviatAt?.seconds||0)) resPerAlumne[r.alumneUID] = r;
    });

    const llista = alumnesGrup.map(a => {
      const au = alumnesAmbUID.find(u => u.ralc === a.ralc || u.nom === a.nom);
      return { ...a, uid: au?.uid || null, resposta: au?.uid ? resPerAlumne[au.uid] : null };
    }).sort((a, b) => (a.cognoms||a.nom).localeCompare(b.cognoms||b.nom, 'ca'));

    // Filtrar per periode si s'ha seleccionat
    const llistaFiltrada = periodeFiltre
      ? llista.map(a => {
          if (!a.resposta) return a;
          const periodeResp = a.resposta.periodeNom || a.resposta.plantillaTitol || '';
          if (periodeFiltre && periodeResp && !periodeResp.includes(periodeFiltre) && periodeResp !== periodeFiltre) {
            return { ...a, resposta: null };
          }
          return a;
        })
      : llista;

    const ambResp = llistaFiltrada.filter(a => a.resposta);

    const estatBadge = r => {
      if (!r) return '<span style="background:#f3f4f6;color:#9ca3af;padding:3px 8px;border-radius:99px;font-size:11px;">⏳ Pendent</span>';
      if (r.estat === 'enviatButlleti') return '<span style="background:#dcfce7;color:#166534;padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700;">✅ Al butlletí</span>';
      if (r.estat === 'revisat') return '<span style="background:#fef9c3;color:#713f12;padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700;">👁 Revisat</span>';
      return '<span style="background:#dbeafe;color:#1e40af;padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700;">📥 Rebut</span>';
    };

    resDiv.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-size:13px;color:#6b7280;">
          <strong style="color:#1e1b4b;">${grupEtiqueta}</strong> ·
          <strong style="color:#059669;">${ambResp.length}</strong> amb resposta ·
          <strong style="color:#dc2626;">${llista.length - ambResp.length}</strong> sense
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:9px 12px;text-align:left;font-weight:600;color:#374151;">Alumne/a</th>
            <th style="padding:9px 12px;text-align:center;font-weight:600;color:#374151;">Estat</th>
            <th style="padding:9px 12px;text-align:center;font-weight:600;color:#374151;">Comentari tutor</th>
            <th style="padding:9px 12px;text-align:center;font-weight:600;color:#374151;">Accions</th>
          </tr>
        </thead>
        <tbody>
          ${llistaFiltrada.map((a, idx) => {
            const nom = a.cognoms ? `${a.cognoms}, ${a.nom}` : a.nom;
            const teComent = !!(a.resposta?.comentariTutor);
            return `
              <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:8px 12px;font-weight:600;color:#1e1b4b;">${adRH(nom)}</td>
                <td style="padding:8px 12px;text-align:center;">${estatBadge(a.resposta)}</td>
                <td style="padding:8px 12px;text-align:center;">
                  ${a.resposta ? (teComent ? '<span style="color:#059669;font-size:12px;">✅ Sí</span>' : '<span style="color:#9ca3af;font-size:12px;">— No</span>') : '—'}
                </td>
                <td style="padding:8px 12px;text-align:center;">
                  ${a.resposta
                    ? `<button class="btn-ad-rev-editar" data-idx="${idx}"
                        style="padding:5px 12px;background:#0891b2;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">
                        ✏️ Revisar / Editar
                      </button>`
                    : '<span style="color:#d1d5db;font-size:11px;">sense resposta</span>'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    // Guardar per als botons
    window._adRevLlista = llista;
    window._adRevGrupEtiqueta = grupEtiqueta;

    resDiv.querySelectorAll('.btn-ad-rev-editar').forEach(btn => {
      btn.addEventListener('click', () => {
        const alumne = window._adRevLlista[parseInt(btn.dataset.idx)];
        if (alumne?.resposta) obrirEditorAutodiagRevisor(alumne, window._adRevGrupEtiqueta);
      });
    });

  } catch(e) {
    resDiv.innerHTML = `<div style="color:#ef4444;padding:20px;">❌ ${e.message}</div>`;
    console.error('autodiagnosi-revisor:', e);
  }
}

// ─────────────────────────────────────────────
// EDITOR AUTODIAGNOSI — Revisor
// ─────────────────────────────────────────────
function obrirEditorAutodiagRevisor(alumne, grupEtiqueta) {
  document.getElementById('adRevModal')?.remove();

  const r = alumne.resposta;
  const preguntes = r.preguntes || [];
  const respostesMap = r.respostes || {};
  const nomComplet = alumne.cognoms ? `${alumne.cognoms}, ${alumne.nom}` : alumne.nom;

  const overlay = document.createElement('div');
  overlay.id = 'adRevModal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;padding:16px;';

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;width:100%;max-width:700px;max-height:92vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,0.3);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#164e63,#0891b2);padding:20px 24px;border-radius:20px 20px 0 0;color:#fff;display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:17px;font-weight:800;">🧠 ${adRH(nomComplet)}</div>
          <div style="font-size:12px;opacity:.8;margin-top:3px;">${adRH(grupEtiqueta)} · ${adRH(r.plantillaTitol || 'Autodiagnosi')}</div>
        </div>
        <button class="ad-rev-close" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;">✕</button>
      </div>

      <div style="padding:24px;">

        <!-- Respostes alumne -->
        <div style="margin-bottom:24px;">
          <div style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em;">📝 Respostes de l'alumne</div>
          ${preguntes.length === 0
            ? '<p style="color:#9ca3af;font-style:italic;font-size:13px;">Sense preguntes.</p>'
            : preguntes.map((p, i) => `
              <div style="margin-bottom:14px;background:#f9fafb;border-radius:10px;padding:14px;">
                <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;">
                  <span style="background:#0891b2;color:#fff;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;margin-right:8px;">${i+1}</span>
                  ${adRH(p.text || '')}
                </div>
                <div style="font-size:13px;color:#1e1b4b;background:#fff;border:1.5px solid #e5e7eb;border-radius:8px;padding:10px 12px;white-space:pre-wrap;line-height:1.6;">
                  ${adRH(respostesMap[p.id] || '—')}
                </div>
              </div>
            `).join('')}
        </div>

        <!-- Comentari tutor editable -->
        <div style="margin-bottom:20px;">
          <label style="font-size:12px;font-weight:700;color:#6b7280;display:block;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">
            💬 Comentari del tutor/a (editable)
          </label>
          <textarea id="adRevComentari" rows="5"
            placeholder="Escriu aquí la valoració del tutor/a..."
            style="width:100%;box-sizing:border-box;padding:12px;border:2px solid #e5e7eb;border-radius:10px;font-size:13px;font-family:inherit;resize:vertical;outline:none;transition:border-color .2s;"
            onfocus="this.style.borderColor='#0891b2'" onblur="this.style.borderColor='#e5e7eb'"
          >${adRH(r.comentariTutor || '')}</textarea>
        </div>

        <div id="adRevModalErr" style="color:#ef4444;font-size:13px;min-height:16px;margin-bottom:10px;"></div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="ad-rev-close" style="flex:1;padding:11px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;min-width:100px;">Tancar</button>
          <button id="adRevGuardar" style="flex:1;padding:11px;background:#4c1d95;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;min-width:120px;">💾 Guardar</button>
          <button id="adRevButlleti" style="flex:1;padding:11px;background:#059669;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;min-width:140px;"
            ${r.estat === 'enviatButlleti' ? 'disabled style="opacity:.5;"' : ''}>
            🏫 ${r.estat === 'enviatButlleti' ? 'Ja enviat' : 'Enviar al butlletí'}
          </button>
        </div>
        ${r.estat === 'enviatButlleti' ? '<div style="text-align:center;font-size:11px;color:#6b7280;margin-top:8px;">✅ Ja enviat a Avaluació Centre</div>' : ''}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelectorAll('.ad-rev-close').forEach(b => b.addEventListener('click', () => overlay.remove()));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Marcar com a revisat si era rebut
  if (r.estat === 'rebut') {
    window.db.collection('autoaval_respostes').doc(r.id).update({ estat: 'revisat' }).catch(() => {});
    r.estat = 'revisat';
  }

  // Guardar comentari
  document.getElementById('adRevGuardar').addEventListener('click', async () => {
    const comentari = document.getElementById('adRevComentari').value.trim();
    const btn = document.getElementById('adRevGuardar');
    btn.disabled = true; btn.textContent = '⏳ Guardant...';
    try {
      await window.db.collection('autoaval_respostes').doc(r.id).update({
        comentariTutor: comentari,
        estat: r.estat === 'enviatButlleti' ? 'enviatButlleti' : 'revisat',
        revisatAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      });
      r.comentariTutor = comentari;
      window.mostrarToast?.('✅ Comentari guardat');
    } catch(e) {
      document.getElementById('adRevModalErr').textContent = '❌ ' + e.message;
    } finally {
      btn.disabled = false; btn.textContent = '💾 Guardar';
    }
  });

  // Enviar al butlletí (reutilitza la lògica d'autoavaluacio.js via window)
  document.getElementById('adRevButlleti').addEventListener('click', async () => {
    if (window.enviarAutodiagAlButlleti) {
      await window.enviarAutodiagAlButlleti(r, alumne, overlay, () => {
        // Refrescar la llista del revisor
        const grupId = document.getElementById('adRevGrup')?.value;
        if (grupId) carregarAutodiagRevisor(grupId, window._adRevGrupEtiqueta, {});
      });
    } else {
      // Fallback: cridar directament
      await enviarAutodiagAlButlletiLocal(r, alumne, overlay);
    }
  });
}

// Enviar al butlletí (lògica independent per si autoavaluacio.js no l'exposa)
async function enviarAutodiagAlButlletiLocal(r, alumne, overlay) {
  const comentari = document.getElementById('adRevComentari').value.trim();
  const errEl = document.getElementById('adRevModalErr');
  const btn = document.getElementById('adRevButlleti');
  btn.disabled = true; btn.textContent = '⏳ Enviant...';

  try {
    const db = window.db;
    const alumneDoc = await db.collection('professors').doc(r.alumneUID).get();
    const alumneData = alumneDoc.exists ? alumneDoc.data() : {};

    let curs = window._cursActiu || '';
    let grupNom = '';
    if (r.classId) {
      const grupDoc = await db.collection('grups_centre').doc(r.classId).get();
      if (grupDoc.exists) { grupNom = grupDoc.data().nom || ''; curs = grupDoc.data().curs || curs; }
    }

    const preguntes = r.preguntes || [];
    const respostesMap = r.respostes || {};
    const textRespostes = preguntes.map((p, i) =>
      `${i+1}. ${p.text}\nResposta: ${respostesMap[p.id] || '—'}`
    ).join('\n\n');
    const comentariGlobal = comentari
      ? `${comentari}\n\n───\nAutoavaluació de l'alumne:\n${textRespostes}`
      : textRespostes;

    const ref = db.collection('avaluacio_centre').doc(curs)
      .collection('comentari_alumne').doc(r.alumneUID);

    await ref.set({
      nom: alumneData.nom || alumne.nom || '',
      cognoms: alumneData.cognoms || alumne.cognoms || '',
      nomComplet: `${alumne.nom || ''} ${alumne.cognoms || ''}`.trim(),
      ralc: alumneData.ralc || alumne.ralc || '',
      grup: grupNom,
      grupId: r.classId || '',
      grupClasseId: r.classId || '',
      materiaNom: 'Comentari alumne',
      materiaId: 'comentari_alumne',
      curs,
      periodeId: window.currentPeriodeId || 'general',
      periodeNom: window.currentPeriodes?.[window.currentPeriodeId]?.nom || 'General',
      descripcioComuna: 'Autoavaluació i reflexió de l\'alumne/a sobre el seu propi aprenentatge i actitud.',
      comentariGlobal,
      items: [{ titol: 'Autoavaluació', assoliment: 'No avaluat', comentari: comentariGlobal }],
      professorUid: window.firebase.auth().currentUser?.uid || '',
      professorEmail: window.firebase.auth().currentUser?.email || '',
      fontAutoavalId: r.id,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: false });

    await db.collection('autoaval_respostes').doc(r.id).update({
      estat: 'enviatButlleti',
      comentariTutor: comentari,
      enviatButlletiAt: window.firebase.firestore.FieldValue.serverTimestamp(),
    });

    window.mostrarToast?.('✅ Enviat al butlletí com a "Comentari alumne"');
    overlay.remove();

    // Refrescar llista
    const grupId = document.getElementById('adRevGrup')?.value;
    if (grupId) carregarAutodiagRevisor(grupId, window._adRevGrupEtiqueta, {});

  } catch(e) {
    errEl.textContent = '❌ Error: ' + e.message;
    btn.disabled = false;
    btn.textContent = '🏫 Enviar al butlletí';
  }
}

// ═════════════════════════════════════════════════════════
//  TUTORIA — patch mostrarDetallAlumne per afegir secció autodiagnosi
// ═════════════════════════════════════════════════════════
function patchTutoriaDetall() {
  // Esperem que tutoria-nova.js hagi carregat i exposat la funció
  // No podem fer wrap directe (és un mòdul), usem MutationObserver
  // per detectar quan es renderitza el detall i hi afegim la secció

  const obsDetall = new MutationObserver(async (mutations) => {
    for (const mut of mutations) {
      const detall = document.getElementById('detallAlumneTutoria');
      if (!detall) continue;

      // Comprovar si el detall té contingut nou i no té ja la secció autodiagnosi
      if (detall.children.length > 0 && !detall.querySelector('#adTutoriaSection')) {
        // Intentar obtenir l'alumne actiu des del selector del grup tutoria
        await injectarSeccioAutodiagTutoria(detall);
      }
    }
  });

  // Observer sobre el detall (quan existeixi)
  function waitForDetall() {
    const detall = document.getElementById('detallAlumneTutoria');
    if (detall) {
      obsDetall.observe(detall, { childList: true });
    } else {
      setTimeout(waitForDetall, 800);
    }
  }
  waitForDetall();

  // Re-bind quan s'obre el panell de tutoria
  const obsPanel = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.id === 'panellTutoria' || node.querySelector?.('#panellTutoria')) {
          setTimeout(() => {
            const detall = document.getElementById('detallAlumneTutoria');
            if (detall && !detall.dataset.adObserved) {
              obsDetall.observe(detall, { childList: true });
              detall.dataset.adObserved = '1';
            }
          }, 400);
        }
      }
    }
  });
  obsPanel.observe(document.body, { childList: true });
}

async function injectarSeccioAutodiagTutoria(detallEl) {
  // Trobar el RALC de l'alumne actiu des del detall renderitzat
  // tutoria-nova.js posa el RALC com a text: "RALC: XXXX"
  const textRALC = detallEl.innerHTML.match(/RALC:\s*([^\s<&"]+)/);
  const ralc = textRALC?.[1];

  if (!ralc) {
    // Intentar treure el nom per buscar a Firestore
    // Si no hi ha RALC no podem fer res fiable
    return;
  }

  // Crear secció
  const sec = document.createElement('div');
  sec.id = 'adTutoriaSection';
  sec.style.cssText = 'margin-top:20px;';
  sec.innerHTML = `
    <div style="border:1.5px solid #e0f2fe;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#0891b2,#0e7490);padding:10px 16px;display:flex;align-items:center;gap:8px;">
        <span style="font-weight:800;color:#fff;font-size:14px;">🧠 Autodiagnosi alumne/a</span>
      </div>
      <div id="adTutoriaContingut" style="padding:16px;">
        <div style="text-align:center;color:#9ca3af;font-size:13px;">⏳ Carregant...</div>
      </div>
    </div>
  `;
  detallEl.appendChild(sec);

  try {
    const db = window.db;

    // Buscar l'usuari alumne per RALC
    const alumnesSnap = await db.collection('professors')
      .where('rols', 'array-contains', 'alumne')
      .where('ralc', '==', ralc)
      .limit(1)
      .get();

    const cont = document.getElementById('adTutoriaContingut');
    if (!cont) return;

    if (alumnesSnap.empty) {
      cont.innerHTML = '<div style="color:#9ca3af;font-size:13px;font-style:italic;">Aquest alumne no té compte d\'usuari o no ha rebut cap formulari.</div>';
      return;
    }

    const alumneUID = alumnesSnap.docs[0].id;

    // Buscar la resposta més recent
    const respSnap = await db.collection('autoaval_respostes')
      .where('alumneUID', '==', alumneUID)
      .get();

    if (respSnap.empty) {
      cont.innerHTML = '<div style="color:#9ca3af;font-size:13px;font-style:italic;">L\'alumne encara no ha enviat cap autodiagnosi.</div>';
      return;
    }

    // Agafar la més recent
    const respostes = respSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.enviatAt?.seconds||0) - (a.enviatAt?.seconds||0));
    const r = respostes[0];

    const preguntes = r.preguntes || [];
    const respostesMap = r.respostes || {};
    const dataEnviat = r.enviatAt?.toDate ? r.enviatAt.toDate().toLocaleDateString('ca') : '—';

    const estatColors = {
      rebut:          { bg:'#dbeafe', color:'#1e40af', text:'📥 Rebut' },
      revisat:        { bg:'#fef9c3', color:'#713f12', text:'👁 Revisat' },
      enviatButlleti: { bg:'#dcfce7', color:'#166534', text:'✅ Al butlletí' },
    };
    const est = estatColors[r.estat] || { bg:'#f3f4f6', color:'#6b7280', text: r.estat };

    cont.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:12px;color:#6b7280;">
          📋 ${adRH(r.plantillaTitol || 'Autodiagnosi')} · ${dataEnviat}
        </div>
        <span style="background:${est.bg};color:${est.color};padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;">${est.text}</span>
      </div>

      ${preguntes.map((p, i) => `
        <div style="margin-bottom:14px;">
          <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;">
            <span style="background:#0891b2;color:#fff;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;margin-right:6px;">${i+1}</span>
            ${adRH(p.text||'')}
          </div>
          <div style="font-size:13px;color:#1e1b4b;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:8px;padding:10px 12px;white-space:pre-wrap;line-height:1.6;">
            ${adRH(respostesMap[p.id] || '—')}
          </div>
        </div>
      `).join('')}

      ${r.comentariTutor ? `
        <div style="margin-top:16px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:14px;">
          <div style="font-size:11px;font-weight:700;color:#059669;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">💬 Valoració tutor/a</div>
          <div style="font-size:13px;color:#1e1b4b;white-space:pre-wrap;line-height:1.6;">${adRH(r.comentariTutor)}</div>
        </div>
      ` : `
        <div style="background:#fef9c3;border:1.5px solid #fde68a;border-radius:10px;padding:12px;font-size:12px;color:#713f12;margin-top:12px;">
          ⚠️ El tutor/a encara no ha afegit la valoració.
        </div>
      `}
    `;

  } catch(e) {
    const cont = document.getElementById('adTutoriaContingut');
    if (cont) cont.innerHTML = `<div style="color:#ef4444;font-size:13px;">❌ Error: ${e.message}</div>`;
  }
}

console.log('✅ autodiagnosi-revisor.js: inicialitzat');
