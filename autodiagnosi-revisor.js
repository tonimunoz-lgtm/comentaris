// autodiagnosi-revisor.js
// Injector: afegeix accés a les autodiagnosis d'alumnes al Revisor i a Tutoria

console.log('🧠 autodiagnosi-revisor.js carregat');

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

// ── FIX PRINCIPAL: llegir curs actiu de Firestore si window._cursActiu és buit ──
async function getCursActiu() {
  if (window._cursActiu) return window._cursActiu;
  try {
    const doc = await window.db.collection('_sistema').doc('config').get();
    const curs = doc.data()?.cursActiu || '';
    if (curs) window._cursActiu = curs;
    return curs;
  } catch(e) { return ''; }
}

function adRH(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initADRevisor, 1800);
});

let _adObserver = null;

function initADRevisor() {
  if (!window.firebase?.auth) { setTimeout(initADRevisor, 500); return; }
  window.firebase.auth().onAuthStateChanged(user => {
    if (!user) return;
    if (!_adObserver) observarPanells();
  });
}

function observarPanells() {
  if (_adObserver) return;

  let _adInjectTimer = null;

  _adObserver = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.id === 'panellRevisio' || node.querySelector?.('#panellRevisio')) {
          const panell = node.id === 'panellRevisio' ? node : node.querySelector('#panellRevisio');
          if (panell) {
            if (_adInjectTimer) clearTimeout(_adInjectTimer);
            _adInjectTimer = setTimeout(() => {
              _adInjectTimer = null;
              injectarTabRevisor(panell);
            }, 300);
          }
        }
      }
    }
  });
  _adObserver.observe(document.body, { childList: true });
  patchTutoriaDetall();
}

function injectarTabRevisor(panell) {
  if (panell.querySelector('#adRevTabBar')) return;

  const header = panell.querySelector('div[style*="164e63"]') ||
                 panell.querySelector('div[style*="0891b2"]');
  if (!header) return;

  const btnTab = document.createElement('button');
  btnTab.id = 'btnTabAutodiagnosiRevisor';
  btnTab.style.cssText = `padding:7px 16px;background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.4);color:#fff;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;margin-left:8px;transition:all .15s;`;
  btnTab.innerHTML = '🧠 Autodiagnosi';

  const btnTabCT = document.createElement('button');
  btnTabCT.id = 'btnTabComentariTutorRevisor';
  btnTabCT.style.cssText = `padding:7px 16px;background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.4);color:#fff;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;margin-left:8px;transition:all .15s;`;
  btnTabCT.innerHTML = '💬 Comentari Tutor';

  const btnCarregar = header.querySelector('#btnCarregarRevisio');
  if (btnCarregar) {
    btnCarregar.insertAdjacentElement('afterend', btnTabCT);
    btnCarregar.insertAdjacentElement('afterend', btnTab);
  } else {
    header.appendChild(btnTab);
    header.appendChild(btnTabCT);
  }

  const revisioContent = panell.querySelector('#revisioContent');
  if (!revisioContent) return;

  const adContent = document.createElement('div');
  adContent.id = 'adRevContent';
  adContent.style.cssText = 'flex:1;overflow-y:auto;padding:24px;min-height:0;display:none;';
  revisioContent.parentElement.insertBefore(adContent, revisioContent);

  const ctContent = document.createElement('div');
  ctContent.id = 'ctRevContent';
  ctContent.style.cssText = 'flex:1;overflow-y:auto;padding:24px;min-height:0;display:none;';
  revisioContent.parentElement.insertBefore(ctContent, revisioContent);

  let modeActiu = null;

  const desactivarTots = () => {
    revisioContent.style.display = 'block';
    adContent.style.display = 'none';
    ctContent.style.display = 'none';
    btnTab.style.background = 'rgba(255,255,255,0.15)'; btnTab.style.color = '#fff';
    btnTabCT.style.background = 'rgba(255,255,255,0.15)'; btnTabCT.style.color = '#fff';
    modeActiu = null;
  };

  btnTab.addEventListener('click', () => {
    if (modeActiu === 'autodiag') { desactivarTots(); return; }
    modeActiu = 'autodiag';
    btnTab.style.background = '#fff'; btnTab.style.color = '#0891b2';
    btnTabCT.style.background = 'rgba(255,255,255,0.15)'; btnTabCT.style.color = '#fff';
    revisioContent.style.display = 'none';
    adContent.style.display = 'block'; ctContent.style.display = 'none';
    renderPanellAutodiagRevisor(adContent, panell);
  });

  btnTabCT.addEventListener('click', () => {
    if (modeActiu === 'comentaritutor') { desactivarTots(); return; }
    modeActiu = 'comentaritutor';
    btnTabCT.style.background = '#fff'; btnTabCT.style.color = '#059669';
    btnTab.style.background = 'rgba(255,255,255,0.15)'; btnTab.style.color = '#fff';
    revisioContent.style.display = 'none';
    ctContent.style.display = 'block'; adContent.style.display = 'none';
    renderPanellComentariTutorRevisor(ctContent);
  });
}

async function llegirPermisosRevisorAD() {
  const uid = window.firebase?.auth().currentUser?.uid;
  if (!uid) return { nivells: [], cursos: [], grups: [], totsNivells: false };
  try {
    const doc = await window.db.collection('professors').doc(uid).get();
    const data = doc.data() || {};
    const nivells = data.revisio_nivells || [];
    const totsNivells = data.revisio_tot || nivells.includes('_tot') ||
                        window.teRol?.('admin') || window.teRol?.('superadmin') || false;
    return { nivells: nivells.filter(n => n !== '_tot'), cursos: data.revisio_cursos || [], grups: data.revisio_grups || [], totsNivells };
  } catch(e) { return { nivells: [], cursos: [], grups: [], totsNivells: false }; }
}

async function renderPanellAutodiagRevisor(cont, panell) {
  cont.innerHTML = '<div style="padding:30px;text-align:center;color:#9ca3af;">⏳ Carregant...</div>';
  try {
    const db = window.db;
    const permisos = await llegirPermisosRevisorAD();
    const snap = await db.collection('grups_centre').get();
    const totsGrups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const grupsPerId = {};
    totsGrups.forEach(g => { grupsPerId[g.id] = g; });

    const grupsPermesos = permisos.totsNivells ? totsGrups : totsGrups.filter(g =>
      permisos.grups.includes(g.id) || permisos.cursos.some(c => g.curs === c) || permisos.nivells.some(nId => g.nivellId === nId));

    let grupsTutoria = grupsPermesos.filter(g => g.tipus === 'tutoria');
    if (grupsTutoria.length === 0) grupsTutoria = grupsPermesos.filter(g => g.tipus === 'classe' && (g.alumnes||[]).length > 0);

    function etiqueta(g) {
      const nivell = g.nivellNom || '';
      if (g.tipus === 'tutoria' && g.parentGrupId) { const pare = grupsPerId[g.parentGrupId]; return `${nivell} ${pare?.nom || g.nom}`.trim(); }
      return `${nivell} ${g.nom || ''}`.trim();
    }
    grupsTutoria.sort((a, b) => etiqueta(a).localeCompare(etiqueta(b), 'ca'));

    if (grupsTutoria.length === 0 && !permisos.totsNivells) {
      cont.innerHTML = `<div style="background:#fef9c3;border:1.5px solid #fde68a;border-radius:12px;padding:20px 24px;color:#713f12;font-size:13px;">⚠️ No tens cap grup assignat per revisar autodiagnosis.</div>`;
      return;
    }

    cont.innerHTML = `
      <h4 style="font-size:15px;font-weight:700;color:#1e1b4b;margin-bottom:16px;">🧠 Autodiagnosi alumnes — Revisió</h4>
      <div style="background:#f0f9ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:14px 18px;margin-bottom:18px;font-size:12px;color:#1d4ed8;">
        💡 Pots veure les respostes dels alumnes, editar el comentari del tutor/a i enviar-les al butlletí.
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end;">
        <div><label style="font-size:11px;font-weight:700;color:#6b7280;display:block;margin-bottom:4px;">NIVELL</label>
          <select id="adRevNivell" style="padding:7px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;min-width:130px;">
            <option value="">— Tots —</option>
            ${[...new Set(grupsTutoria.map(g => g.nivellNom).filter(Boolean))].sort().map(n => `<option value="${n}">${adRH(n)}</option>`).join('')}
          </select></div>
        <div><label style="font-size:11px;font-weight:700;color:#6b7280;display:block;margin-bottom:4px;">GRUP</label>
          <select id="adRevGrup" style="padding:7px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;min-width:160px;">
            <option value="">— Tria grup —</option>
            ${grupsTutoria.map(g => `<option value="${g.id}">${adRH(etiqueta(g))}</option>`).join('')}
          </select></div>
        <div><label style="font-size:11px;font-weight:700;color:#6b7280;display:block;margin-bottom:4px;">PERÍODE</label>
          <select id="adRevPeriode" style="padding:7px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;min-width:150px;">
            <option value="">⏳ Carregant...</option>
          </select></div>
        <button id="adRevCarregar" style="padding:8px 18px;background:#0891b2;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;align-self:flex-end;">🔍 Carregar</button>
      </div>
      <div id="adRevResultats"><div style="text-align:center;padding:40px;color:#9ca3af;font-size:13px;">Selecciona un grup per veure les autodiagnosis.</div></div>`;

    carregarPeriodesADR().then(periodes => {
      const sel = document.getElementById('adRevPeriode');
      if (sel) sel.innerHTML = '<option value="">— Tots els períodes —</option>' + periodes.map(p => `<option value="${p.nom}">${p.nom}</option>`).join('');
    });

    document.getElementById('adRevNivell')?.addEventListener('change', () => {
      const nivell = document.getElementById('adRevNivell').value;
      document.getElementById('adRevGrup').innerHTML = '<option value="">— Tria grup —</option>' +
        grupsTutoria.filter(g => !nivell || (g.nivellNom||'') === nivell).map(g => `<option value="${g.id}">${adRH(etiqueta(g))}</option>`).join('');
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
    const alumnesSnap = await db.collection('professors').where('rols', 'array-contains', 'alumne').get();
    const alumnesUsuaris = alumnesSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
    const alumnesAmbUID = alumnesGrup.map(a => {
      const u = alumnesUsuaris.find(u => (a.ralc && u.ralc && String(a.ralc) === String(u.ralc)) || (a.email && u.email && a.email === u.email));
      return { ...a, uid: u?.uid || null };
    });
    const uids = alumnesAmbUID.filter(a => a.uid).map(a => a.uid);
    let respostes = [];
    for (let i = 0; i < uids.length; i += 30) {
      const chunk = uids.slice(i, i + 30);
      const snap = await db.collection('autoaval_respostes').where('alumneUID', 'in', chunk).get();
      respostes.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    const resPerAlumne = {};
    respostes.forEach(r => { const ex = resPerAlumne[r.alumneUID]; if (!ex || (r.enviatAt?.seconds||0) > (ex.enviatAt?.seconds||0)) resPerAlumne[r.alumneUID] = r; });
    const llista = alumnesGrup.map(a => { const au = alumnesAmbUID.find(u => u.ralc === a.ralc || u.nom === a.nom); return { ...a, uid: au?.uid||null, resposta: au?.uid ? resPerAlumne[au.uid] : null }; }).sort((a,b) => (a.cognoms||a.nom).localeCompare(b.cognoms||b.nom,'ca'));
    const llistaFiltrada = periodeFiltre ? llista.map(a => { if (!a.resposta) return a; if ((a.resposta.periodeNom||'') !== periodeFiltre) return {...a, resposta:null}; return a; }) : llista;
    const ambResp = llistaFiltrada.filter(a => a.resposta);
    const estatBadge = r => {
      if (!r) return '<span style="background:#f3f4f6;color:#9ca3af;padding:3px 8px;border-radius:99px;font-size:11px;">⏳ Pendent</span>';
      if (r.estat === 'enviatButlleti') return '<span style="background:#dcfce7;color:#166534;padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700;">✅ Al butlletí</span>';
      if (r.estat === 'revisat') return '<span style="background:#fef9c3;color:#713f12;padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700;">👁 Revisat</span>';
      return '<span style="background:#dbeafe;color:#1e40af;padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700;">📥 Rebut</span>';
    };
    resDiv.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-size:13px;color:#6b7280;"><strong style="color:#1e1b4b;">${grupEtiqueta}</strong> · <strong style="color:#059669;">${ambResp.length}</strong> amb resposta · <strong style="color:#dc2626;">${llista.length - ambResp.length}</strong> sense</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f3f4f6;">
          <th style="padding:9px 12px;text-align:left;font-weight:600;color:#374151;">Alumne/a</th>
          <th style="padding:9px 12px;text-align:center;font-weight:600;color:#374151;">Estat</th>
          <th style="padding:9px 12px;text-align:center;font-weight:600;color:#374151;">Comentari tutor</th>
          <th style="padding:9px 12px;text-align:center;font-weight:600;color:#374151;">Accions</th>
        </tr></thead>
        <tbody>${llistaFiltrada.map((a,idx) => {
          const nom = a.cognoms ? `${a.cognoms}, ${a.nom}` : a.nom;
          const teComent = !!(a.resposta?.comentariTutor);
          return `<tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:8px 12px;font-weight:600;color:#1e1b4b;">${adRH(nom)}</td>
            <td style="padding:8px 12px;text-align:center;">${estatBadge(a.resposta)}</td>
            <td style="padding:8px 12px;text-align:center;">${a.resposta ? (teComent ? '<span style="color:#059669;font-size:12px;">✅ Sí</span>' : '<span style="color:#9ca3af;font-size:12px;">— No</span>') : '—'}</td>
            <td style="padding:8px 12px;text-align:center;">${a.resposta ? `<button class="btn-ad-rev-editar" data-idx="${idx}" style="padding:5px 12px;background:#0891b2;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">✏️ Revisar / Editar</button>` : '<span style="color:#d1d5db;font-size:11px;">sense resposta</span>'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
    window._adRevLlista = llista; window._adRevGrupEtiqueta = grupEtiqueta;
    resDiv.querySelectorAll('.btn-ad-rev-editar').forEach(btn => {
      btn.addEventListener('click', () => { const alumne = window._adRevLlista[parseInt(btn.dataset.idx)]; if (alumne?.resposta) obrirEditorAutodiagRevisor(alumne, window._adRevGrupEtiqueta); });
    });
  } catch(e) { resDiv.innerHTML = `<div style="color:#ef4444;padding:20px;">❌ ${e.message}</div>`; console.error('autodiagnosi-revisor:', e); }
}

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
    <div style="background:#fff;border-radius:20px;width:100%;max-width:700px;max-height:92vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,0.3);">
      <div style="background:linear-gradient(135deg,#164e63,#0891b2);padding:20px 24px;border-radius:20px 20px 0 0;color:#fff;display:flex;justify-content:space-between;align-items:flex-start;">
        <div><div style="font-size:17px;font-weight:800;">🧠 ${adRH(nomComplet)}</div><div style="font-size:12px;opacity:.8;margin-top:3px;">${adRH(grupEtiqueta)} · ${adRH(r.plantillaTitol||'Autodiagnosi')}</div></div>
        <button class="ad-rev-close" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;">✕</button>
      </div>
      <div style="padding:24px;">
        <div style="margin-bottom:24px;">
          <div style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em;">📝 Respostes de l'alumne</div>
          ${preguntes.length === 0 ? '<p style="color:#9ca3af;font-style:italic;font-size:13px;">Sense preguntes.</p>' : preguntes.map((p,i) => `
            <div style="margin-bottom:14px;background:#f9fafb;border-radius:10px;padding:14px;">
              <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;"><span style="background:#0891b2;color:#fff;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;margin-right:8px;">${i+1}</span>${adRH(p.text||'')}</div>
              <div style="font-size:13px;color:#1e1b4b;background:#fff;border:1.5px solid #e5e7eb;border-radius:8px;padding:10px 12px;white-space:pre-wrap;line-height:1.6;">${adRH(respostesMap[p.id]||'—')}</div>
            </div>`).join('')}
        </div>
        <div style="margin-bottom:20px;">
          <label style="font-size:12px;font-weight:700;color:#6b7280;display:block;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">💬 Comentari del tutor/a (editable)</label>
          <textarea id="adRevComentari" rows="5" placeholder="Escriu aquí la valoració del tutor/a..." style="width:100%;box-sizing:border-box;padding:12px;border:2px solid #e5e7eb;border-radius:10px;font-size:13px;font-family:inherit;resize:vertical;outline:none;" onfocus="this.style.borderColor='#0891b2'" onblur="this.style.borderColor='#e5e7eb'">${adRH(r.comentariTutor||'')}</textarea>
        </div>
        <div id="adRevModalErr" style="color:#ef4444;font-size:13px;min-height:16px;margin-bottom:10px;"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="ad-rev-close" style="flex:1;padding:11px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;min-width:100px;">Tancar</button>
          <button id="adRevGuardar" style="flex:1;padding:11px;background:#4c1d95;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;min-width:120px;">💾 Guardar</button>
          <button id="adRevButlleti" style="flex:1;padding:11px;background:#059669;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;min-width:140px;" ${r.estat==='enviatButlleti'?'disabled style="opacity:.5;"':''}>🏫 ${r.estat==='enviatButlleti'?'Ja enviat':'Enviar al butlletí'}</button>
        </div>
        ${r.estat==='enviatButlleti'?'<div style="text-align:center;font-size:11px;color:#6b7280;margin-top:8px;">✅ Ja enviat a Avaluació Centre</div>':''}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.ad-rev-close').forEach(b => b.addEventListener('click', () => overlay.remove()));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  if (r.estat === 'rebut') { window.db.collection('autoaval_respostes').doc(r.id).update({ estat: 'revisat' }).catch(()=>{}); r.estat = 'revisat'; }
  document.getElementById('adRevGuardar').addEventListener('click', async () => {
    const comentari = document.getElementById('adRevComentari').value.trim();
    const btn = document.getElementById('adRevGuardar');
    btn.disabled = true; btn.textContent = '⏳ Guardant...';
    try {
      await window.db.collection('autoaval_respostes').doc(r.id).update({ comentariTutor: comentari, estat: r.estat==='enviatButlleti'?'enviatButlleti':'revisat', revisatAt: window.firebase.firestore.FieldValue.serverTimestamp() });
      r.comentariTutor = comentari;
      window.mostrarToast?.('✅ Comentari guardat');
    } catch(e) { document.getElementById('adRevModalErr').textContent = '❌ ' + e.message; }
    finally { btn.disabled = false; btn.textContent = '💾 Guardar'; }
  });
  document.getElementById('adRevButlleti').addEventListener('click', async () => {
    if (window.enviarAutodiagAlButlleti) {
      await window.enviarAutodiagAlButlleti(r, alumne, overlay, () => { const gId = document.getElementById('adRevGrup')?.value; if (gId) carregarAutodiagRevisor(gId, window._adRevGrupEtiqueta, {}); });
    } else { await enviarAutodiagAlButlletiLocal(r, alumne, overlay); }
  });
}

async function enviarAutodiagAlButlletiLocal(r, alumne, overlay) {
  const comentari = document.getElementById('adRevComentari').value.trim();
  const errEl = document.getElementById('adRevModalErr');
  const btn = document.getElementById('adRevButlleti');
  btn.disabled = true; btn.textContent = '⏳ Enviant...';
  try {
    const db = window.db;
    const alumneDoc = await db.collection('professors').doc(r.alumneUID).get();
    const alumneData = alumneDoc.exists ? alumneDoc.data() : {};
    let curs = await getCursActiu();
    let grupNom = '';
    if (r.classId) { const gDoc = await db.collection('grups_centre').doc(r.classId).get(); if (gDoc.exists) { grupNom = gDoc.data().nom||''; curs = gDoc.data().curs||curs; } }
    const preguntes = r.preguntes || [];
    const respostesMap = r.respostes || {};
    const textRespostes = preguntes.map((p,i) => `${i+1}. ${p.text}\nResposta: ${respostesMap[p.id]||'—'}`).join('\n\n');
    const comentariGlobal = comentari ? `${comentari}\n\n───\nAutoavaluació de l'alumne:\n${textRespostes}` : textRespostes;
    await db.collection('avaluacio_centre').doc(curs).collection('comentari_alumne').doc(r.alumneUID).set({ nom: alumneData.nom||alumne.nom||'', cognoms: alumneData.cognoms||alumne.cognoms||'', nomComplet: `${alumne.nom||''} ${alumne.cognoms||''}`.trim(), ralc: alumneData.ralc||alumne.ralc||'', grup: grupNom, grupId: r.classId||'', grupClasseId: r.classId||'', materiaNom: 'Comentari alumne', materiaId: 'comentari_alumne', curs, periodeId: window.currentPeriodeId||'general', periodeNom: window.currentPeriodes?.[window.currentPeriodeId]?.nom||'General', descripcioComuna: 'Autoavaluació i reflexió de l\'alumne/a sobre el seu propi aprenentatge i actitud.', comentariGlobal, items: [{ titol: 'Autoavaluació', assoliment: 'No avaluat', comentari: comentariGlobal }], professorUid: window.firebase.auth().currentUser?.uid||'', professorEmail: window.firebase.auth().currentUser?.email||'', fontAutoavalId: r.id, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() }, { merge: false });
    await db.collection('autoaval_respostes').doc(r.id).update({ estat: 'enviatButlleti', comentariTutor: comentari, enviatButlletiAt: window.firebase.firestore.FieldValue.serverTimestamp() });
    window.mostrarToast?.('✅ Enviat al butlletí'); overlay.remove();
    const gId = document.getElementById('adRevGrup')?.value;
    if (gId) carregarAutodiagRevisor(gId, window._adRevGrupEtiqueta, {});
  } catch(e) { errEl.textContent = '❌ Error: ' + e.message; btn.disabled = false; btn.textContent = '🏫 Enviar al butlletí'; }
}

function patchTutoriaDetall() {
  const obsDetall = new MutationObserver(async (mutations) => {
    for (const mut of mutations) {
      const detall = document.getElementById('detallAlumneTutoria');
      if (!detall) continue;
      if (detall.children.length > 0 && !detall.querySelector('#adTutoriaSection')) await injectarSeccioAutodiagTutoria(detall);
    }
  });
  function waitForDetall() {
    const detall = document.getElementById('detallAlumneTutoria');
    if (detall) { obsDetall.observe(detall, { childList: true }); } else { setTimeout(waitForDetall, 800); }
  }
  waitForDetall();
  const obsPanel = new MutationObserver((mutations) => {
    for (const mut of mutations) for (const node of mut.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.id === 'panellTutoria' || node.querySelector?.('#panellTutoria')) {
        setTimeout(() => { const d = document.getElementById('detallAlumneTutoria'); if (d && !d.dataset.adObserved) { obsDetall.observe(d, { childList: true }); d.dataset.adObserved = '1'; } }, 400);
      }
    }
  });
  obsPanel.observe(document.body, { childList: true });
}

async function injectarSeccioAutodiagTutoria(detallEl) {
  const textRALC = detallEl.innerHTML.match(/RALC:\s*([^\s<&"]+)/);
  const ralc = textRALC?.[1];
  if (!ralc) return;
  const sec = document.createElement('div');
  sec.id = 'adTutoriaSection'; sec.style.cssText = 'margin-top:20px;';
  sec.innerHTML = `<div style="border:1.5px solid #e0f2fe;border-radius:12px;overflow:hidden;"><div style="background:linear-gradient(135deg,#0891b2,#0e7490);padding:10px 16px;"><span style="font-weight:800;color:#fff;font-size:14px;">🧠 Autodiagnosi alumne/a</span></div><div id="adTutoriaContingut" style="padding:16px;"><div style="text-align:center;color:#9ca3af;font-size:13px;">⏳ Carregant...</div></div></div>`;
  detallEl.appendChild(sec);
  try {
    const db = window.db;
    const alumnesSnap = await db.collection('professors').where('rols','array-contains','alumne').where('ralc','==',ralc).limit(1).get();
    const cont = document.getElementById('adTutoriaContingut');
    if (!cont) return;
    if (alumnesSnap.empty) { cont.innerHTML = '<div style="color:#9ca3af;font-size:13px;font-style:italic;">Aquest alumne no té compte d\'usuari.</div>'; return; }
    const alumneUID = alumnesSnap.docs[0].id;
    const respSnap = await db.collection('autoaval_respostes').where('alumneUID','==',alumneUID).get();
    if (respSnap.empty) { cont.innerHTML = '<div style="color:#9ca3af;font-size:13px;font-style:italic;">L\'alumne encara no ha enviat cap autodiagnosi.</div>'; return; }
    const respostes = respSnap.docs.map(d => ({id:d.id,...d.data()})).sort((a,b) => (b.enviatAt?.seconds||0)-(a.enviatAt?.seconds||0));
    const r = respostes[0];
    const preguntes = r.preguntes||[]; const respostesMap = r.respostes||{};
    const dataEnviat = r.enviatAt?.toDate ? r.enviatAt.toDate().toLocaleDateString('ca') : '—';
    const estatColors = { rebut:{bg:'#dbeafe',color:'#1e40af',text:'📥 Rebut'}, revisat:{bg:'#fef9c3',color:'#713f12',text:'👁 Revisat'}, enviatButlleti:{bg:'#dcfce7',color:'#166534',text:'✅ Al butlletí'} };
    const est = estatColors[r.estat] || {bg:'#f3f4f6',color:'#6b7280',text:r.estat};
    cont.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:12px;color:#6b7280;">📋 ${adRH(r.plantillaTitol||'Autodiagnosi')} · ${dataEnviat}</div>
        <span style="background:${est.bg};color:${est.color};padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;">${est.text}</span>
      </div>
      ${preguntes.map((p,i) => `<div style="margin-bottom:14px;"><div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;"><span style="background:#0891b2;color:#fff;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;margin-right:6px;">${i+1}</span>${adRH(p.text||'')}</div><div style="font-size:13px;color:#1e1b4b;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:8px;padding:10px 12px;white-space:pre-wrap;line-height:1.6;">${adRH(respostesMap[p.id]||'—')}</div></div>`).join('')}
      ${r.comentariTutor ? `<div style="margin-top:16px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:14px;"><div style="font-size:11px;font-weight:700;color:#059669;margin-bottom:8px;text-transform:uppercase;">💬 Valoració tutor/a</div><div style="font-size:13px;color:#1e1b4b;white-space:pre-wrap;line-height:1.6;">${adRH(r.comentariTutor)}</div></div>` : `<div style="background:#fef9c3;border:1.5px solid #fde68a;border-radius:10px;padding:12px;font-size:12px;color:#713f12;margin-top:12px;">⚠️ El tutor/a encara no ha afegit la valoració.</div>`}`;
  } catch(e) { const cont = document.getElementById('adTutoriaContingut'); if (cont) cont.innerHTML = `<div style="color:#ef4444;font-size:13px;">❌ Error: ${e.message}</div>`; }
}

console.log('✅ autodiagnosi-revisor.js: inicialitzat');

// ═════════════════════════════════════════════════════════
//  PANELL COMENTARI TUTOR/A
// ═════════════════════════════════════════════════════════
async function renderPanellComentariTutorRevisor(cont) {
  cont.innerHTML = '<div style="padding:30px;text-align:center;color:#9ca3af;">⏳ Carregant...</div>';
  try {
    const db = window.db;
    const permisos = await llegirPermisosRevisorAD();
    const snap = await db.collection('grups_centre').get();
    const totsGrups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const grupsPerId = {};
    totsGrups.forEach(g => { grupsPerId[g.id] = g; });
    const grupsPermesos = permisos.totsNivells ? totsGrups : totsGrups.filter(g => permisos.grups.includes(g.id) || permisos.cursos.some(c => g.curs===c) || permisos.nivells.some(nId => g.nivellId===nId));
    const grupsTutoria = grupsPermesos.filter(g => g.tipus === 'tutoria');

    function etiquetaGrup(g) {
      const nivell = g.nivellNom || '';
      if (g.parentGrupId) { const pare = grupsPerId[g.parentGrupId]; return `${nivell} ${pare?.nom||g.nom}`.trim(); }
      return `${nivell} ${g.nom||''}`.trim();
    }
    grupsTutoria.sort((a,b) => etiquetaGrup(a).localeCompare(etiquetaGrup(b),'ca'));

    if (grupsTutoria.length === 0) {
      cont.innerHTML = `<div style="background:#fef9c3;border:1.5px solid #fde68a;border-radius:12px;padding:20px 24px;color:#713f12;font-size:13px;">⚠️ No tens cap grup de tutoria assignat.</div>`;
      return;
    }

    const nivells = [...new Set(grupsTutoria.map(g => g.nivellNom).filter(Boolean))].sort();
    cont.innerHTML = `
      <h4 style="font-size:15px;font-weight:700;color:#1e1b4b;margin-bottom:16px;">💬 Comentaris Tutor/a — Revisió i edició</h4>
      <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:14px 18px;margin-bottom:18px;font-size:12px;color:#166534;">
        💡 Pots veure i editar els comentaris de tutoria enviats per cada alumne.
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end;">
        <div><label style="font-size:11px;font-weight:700;color:#6b7280;display:block;margin-bottom:4px;">NIVELL</label>
          <select id="ctRevNivell" style="padding:7px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;min-width:130px;">
            <option value="">— Tots —</option>${nivells.map(n=>`<option value="${adRH(n)}">${adRH(n)}</option>`).join('')}
          </select></div>
        <div><label style="font-size:11px;font-weight:700;color:#6b7280;display:block;margin-bottom:4px;">GRUP</label>
          <select id="ctRevGrup" style="padding:7px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;min-width:160px;">
            <option value="">— Tria grup —</option>${grupsTutoria.map(g=>`<option value="${g.id}">${adRH(etiquetaGrup(g))}</option>`).join('')}
          </select></div>
        <div><label style="font-size:11px;font-weight:700;color:#6b7280;display:block;margin-bottom:4px;">PERÍODE</label>
          <select id="ctRevPeriode" style="padding:7px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;min-width:150px;">
            <option value="">⏳ Carregant...</option>
          </select></div>
        <button id="ctRevCarregar" style="padding:8px 18px;background:#059669;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;align-self:flex-end;">🔍 Carregar</button>
      </div>
      <div id="ctRevResultats"><div style="text-align:center;padding:40px;color:#9ca3af;font-size:13px;">Selecciona un grup de tutoria per veure els comentaris.</div></div>`;

    carregarPeriodesADR().then(periodes => {
      const sel = document.getElementById('ctRevPeriode');
      if (sel) sel.innerHTML = '<option value="">— Tots els períodes —</option>' + periodes.map(p=>`<option value="${adRH(p.nom)}">${adRH(p.nom)}</option>`).join('');
    });
    document.getElementById('ctRevNivell')?.addEventListener('change', () => {
      const nivell = document.getElementById('ctRevNivell').value;
      document.getElementById('ctRevGrup').innerHTML = '<option value="">— Tria grup —</option>' +
        grupsTutoria.filter(g => !nivell || (g.nivellNom||'')===nivell).map(g=>`<option value="${g.id}">${adRH(etiquetaGrup(g))}</option>`).join('');
    });
    document.getElementById('ctRevCarregar')?.addEventListener('click', () => {
      const grupId = document.getElementById('ctRevGrup').value;
      const periode = document.getElementById('ctRevPeriode')?.value || '';
      if (!grupId) { window.mostrarToast?.('⚠️ Tria un grup', 3000); return; }
      const g = grupsTutoria.find(x => x.id === grupId);
      carregarComentarisTutorRevisor(grupId, etiquetaGrup(g||{}), grupsPerId, periode);
    });
  } catch(e) { cont.innerHTML = `<div style="color:#ef4444;padding:20px;">❌ ${e.message}</div>`; }
}

async function carregarComentarisTutorRevisor(grupTutoriaId, grupEtiqueta, grupsPerId, periodeFiltre = '') {
  const resDiv = document.getElementById('ctRevResultats');
  resDiv.innerHTML = '<div style="padding:20px;text-align:center;color:#9ca3af;">⏳ Carregant...</div>';
  try {
    const db = window.db;

    // ── FIX: llegir curs actiu de Firestore si cal ──
    const cursActiu = await getCursActiu();
    if (!cursActiu) {
      resDiv.innerHTML = '<div style="color:#ef4444;padding:20px;">❌ No s\'ha pogut determinar el curs actiu. Comprova la configuració del sistema.</div>';
      return;
    }

    const grupTutoriaDoc = await db.collection('grups_centre').doc(grupTutoriaId).get();
    const grupTutoriaData = grupTutoriaDoc.data() || {};
    const grupClasseId = grupTutoriaData.parentGrupId || grupTutoriaId;

    const grupClasseDoc = await db.collection('grups_centre').doc(grupClasseId).get();
    const alumnesGrup = (grupClasseDoc.data()?.alumnes || []).sort((a,b) => (a.cognoms||a.nom||'').localeCompare(b.cognoms||b.nom||'','ca'));

    let snap = await db.collection('avaluacio_centre').doc(cursActiu).collection(grupTutoriaId).where('grupClasseId','==',grupClasseId).get();
    if (snap.empty) snap = await db.collection('avaluacio_centre').doc(cursActiu).collection(grupTutoriaId).where('grupId','==',grupClasseId).get();
    if (snap.empty) snap = await db.collection('avaluacio_centre').doc(cursActiu).collection(grupTutoriaId).get();

    const comentarisMap = {};
    snap.docs.forEach(d => {
      const data = d.data();
      if (periodeFiltre && data.periodeNom !== periodeFiltre) return;
      if (data.ralc) comentarisMap[data.ralc] = { comentari: data.comentariGlobal||'', docId: d.id, periodeNom: data.periodeNom||'' };
    });

    const ambComentari = alumnesGrup.filter(a => comentarisMap[a.ralc]?.comentari);
    const senseComentari = alumnesGrup.filter(a => !comentarisMap[a.ralc]?.comentari);

    resDiv.innerHTML = `
      <div style="margin-bottom:12px;font-size:13px;color:#6b7280;">
        <strong style="color:#1e1b4b;">${adRH(grupEtiqueta)}</strong> ·
        <strong style="color:#059669;">${ambComentari.length}</strong> amb comentari ·
        <strong style="color:#dc2626;">${senseComentari.length}</strong> sense
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f3f4f6;">
          <th style="padding:9px 12px;text-align:left;font-weight:600;color:#374151;">Alumne/a</th>
          <th style="padding:9px 12px;text-align:center;font-weight:600;color:#374151;">Període</th>
          <th style="padding:9px 12px;text-align:center;font-weight:600;color:#374151;">Comentari</th>
          <th style="padding:9px 12px;text-align:center;font-weight:600;color:#374151;">Accions</th>
        </tr></thead>
        <tbody>${alumnesGrup.map((a,idx) => {
          const nom = a.cognoms ? `${a.cognoms}, ${a.nom}` : a.nom;
          const entrada = comentarisMap[a.ralc];
          const teComent = !!(entrada?.comentari);
          return `<tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:8px 12px;font-weight:600;color:#1e1b4b;">${adRH(nom)}</td>
            <td style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;">${adRH(entrada?.periodeNom||'—')}</td>
            <td style="padding:8px 12px;text-align:center;">${teComent?'<span style="color:#059669;font-size:12px;">✅ Sí</span>':'<span style="color:#9ca3af;font-size:12px;">— No</span>'}</td>
            <td style="padding:8px 12px;text-align:center;"><button class="btn-ct-rev-editar" data-ralc="${adRH(a.ralc||'')}" data-idx="${idx}" style="padding:5px 12px;background:#059669;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">✏️ ${teComent?'Editar':'Crear'}</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;

    window._ctRevAlumnes = alumnesGrup;
    window._ctRevComentarisMap = comentarisMap;
    window._ctRevGrupTutoriaId = grupTutoriaId;
    window._ctRevGrupClasseId = grupClasseId;
    window._ctRevCursActiu = cursActiu;
    window._ctRevPeriode = periodeFiltre;

    resDiv.querySelectorAll('.btn-ct-rev-editar').forEach(btn => {
      btn.addEventListener('click', () => {
        const ralc = btn.dataset.ralc;
        const alumne = window._ctRevAlumnes[parseInt(btn.dataset.idx)];
        obrirEditorComentariTutor(alumne, window._ctRevComentarisMap[ralc]||null);
      });
    });
  } catch(e) { resDiv.innerHTML = `<div style="color:#ef4444;padding:20px;">❌ ${e.message}</div>`; console.error('ctRevisor:', e); }
}

function obrirEditorComentariTutor(alumne, entrada) {
  document.getElementById('ctRevModal')?.remove();
  const nomComplet = alumne.cognoms ? `${alumne.cognoms}, ${alumne.nom}` : alumne.nom;
  const comentariActual = entrada?.comentari || '';
  const periodeNom = window._ctRevPeriode || entrada?.periodeNom || '';
  const modal = document.createElement('div');
  modal.id = 'ctRevModal';
  modal.style.cssText = `position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,0.75);display:flex;align-items:center;justify-content:center;padding:20px;`;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:18px;width:100%;max-width:620px;max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,0.3);">
      <div style="background:linear-gradient(135deg,#059669,#047857);padding:20px 24px;border-radius:18px 18px 0 0;display:flex;justify-content:space-between;align-items:center;">
        <div><div style="font-size:16px;font-weight:800;color:#fff;">💬 Comentari Tutor/a</div><div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:3px;">${adRH(nomComplet)}${periodeNom?' · '+adRH(periodeNom):''}</div></div>
        <button id="ctRevModalTancar" style="background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:18px;width:34px;height:34px;border-radius:50%;cursor:pointer;font-weight:700;">✕</button>
      </div>
      <div style="padding:24px;">
        <div style="margin-bottom:16px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">Comentari del tutor/a:</label>
          <textarea id="ctRevTextarea" rows="8" style="width:100%;padding:12px;border:1.5px solid #d1d5db;border-radius:10px;font-size:13px;font-family:inherit;line-height:1.6;outline:none;resize:vertical;box-sizing:border-box;">${adRH(comentariActual)}</textarea>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="ctRevModalCancelar" style="padding:9px 20px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Cancel·lar</button>
          <button id="ctRevModalGuardar" style="padding:9px 22px;background:#059669;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">💾 Guardar</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const tancar = () => modal.remove();
  document.getElementById('ctRevModalTancar')?.addEventListener('click', tancar);
  document.getElementById('ctRevModalCancelar')?.addEventListener('click', tancar);
  modal.addEventListener('click', e => { if (e.target === modal) tancar(); });

  document.getElementById('ctRevModalGuardar')?.addEventListener('click', async () => {
    const btn = document.getElementById('ctRevModalGuardar');
    const nouComentari = document.getElementById('ctRevTextarea')?.value?.trim() || '';
    btn.disabled = true; btn.textContent = '⏳ Guardant...';
    try {
      const db = window.db;
      const cursActiu = window._ctRevCursActiu || await getCursActiu();
      const grupTutoriaId = window._ctRevGrupTutoriaId;
      const grupClasseId = window._ctRevGrupClasseId;
      const ralc = alumne.ralc || '';
      const periode = periodeNom;

      if (!cursActiu || !grupTutoriaId) throw new Error('Falten dades del context. Tanca i torna a obrir el panell.');

      let snapExist = await db.collection('avaluacio_centre').doc(cursActiu).collection(grupTutoriaId).where('grupClasseId','==',grupClasseId).where('ralc','==',ralc).get();
      if (snapExist.empty) snapExist = await db.collection('avaluacio_centre').doc(cursActiu).collection(grupTutoriaId).where('grupId','==',grupClasseId).where('ralc','==',ralc).get();
      const docsFiltrats = periode ? snapExist.docs.filter(d => d.data().periodeNom === periode) : snapExist.docs;

      if (docsFiltrats.length > 0) {
        await docsFiltrats[0].ref.update({ comentariGlobal: nouComentari });
      } else {
        await db.collection('avaluacio_centre').doc(cursActiu).collection(grupTutoriaId).add({
          ralc, nom: alumne.nom||'', cognoms: alumne.cognoms||'', grupClasseId, grupId: grupClasseId,
          periodeNom: periode, comentariGlobal: nouComentari, items: [],
          creatAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        });
      }

      window.mostrarToast?.('✅ Comentari guardat correctament', 3000);
      tancar();

      // Recarregar llista amb etiqueta correcta
      const gDoc = await db.collection('grups_centre').doc(grupTutoriaId).get();
      const gData = gDoc.data() || {};
      let pareNom = gData.nom || grupTutoriaId;
      if (gData.parentGrupId) { try { const pDoc = await db.collection('grups_centre').doc(gData.parentGrupId).get(); pareNom = pDoc.data()?.nom || pareNom; } catch(e){} }
      const grupEtiq = `${gData.nivellNom||''} ${pareNom}`.trim();
      carregarComentarisTutorRevisor(grupTutoriaId, grupEtiq, {}, periode);
    } catch(e) {
      window.mostrarToast?.('❌ Error guardant: ' + e.message, 4000);
      btn.disabled = false; btn.textContent = '💾 Guardar';
    }
  });
}
