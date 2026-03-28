// junta-avaluacio.js — Injector "Junta d'Avaluació"
// Estratègia: obre panellTutoria, intercepta mostrarDetallAlumne,
// divideix detallAlumneTutoria en dues columnes: esquerra=tutoria (intacta) | dreta=edició
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
   OBRIR JUNTA AVALUACIÓ
══════════════════════════════════════════════════════ */
async function obrirJuntaAvaluacio() {
  let intents = 0;
  while (typeof window.obrirPanellTutoria !== 'function' && intents++ < 20)
    await new Promise(r => setTimeout(r, 200));
  if (typeof window.obrirPanellTutoria !== 'function') {
    window.mostrarToast?.('❌ El mòdul de tutoria no està disponible'); return;
  }

  // Interceptar mostrarDetallAlumne ABANS d'obrir el panell
  _jaInterceptarMostrarDetall();

  await window.obrirPanellTutoria();

  const overlay = document.getElementById('panellTutoria');
  if (!overlay) return;

  // Canviar títol
  const h2 = overlay.querySelector('h2');
  if (h2) h2.textContent = '🏫 Junta d\'Avaluació';
  const p = overlay.querySelector('p');
  if (p) p.textContent = 'Visualització i edició per a junta d\'avaluació';

  // Preparar detallAlumneTutoria per a dues columnes
  const detallEl = document.getElementById('detallAlumneTutoria');
  if (detallEl) {
    detallEl.style.display = 'flex';
    detallEl.style.padding = '0';
    detallEl.style.overflow = 'hidden';
  }
}

/* ══════════════════════════════════════════════════════
   INTERCEPTAR mostrarDetallAlumne de tutoria-nova.js
   Quan tutoria escriu al detall, ho posem a la columna
   esquerra i afegim la columna dreta d'edició
══════════════════════════════════════════════════════ */
let _jaInterceptat = false;
function _jaInterceptarMostrarDetall() {
  if (_jaInterceptat) return;
  _jaInterceptat = true;

  // Esperar que tutoria-nova hagi definit la funció interna
  // No podem accedir a mostrarDetallAlumne directament (és privada)
  // Per tant observem quan canvia el contingut de detallAlumneTutoria
  const obs = new MutationObserver(() => {
    const detallEl = document.getElementById('detallAlumneTutoria');
    if (!detallEl) return;

    // Si ja té les dues columnes, no fer res
    if (detallEl.querySelector('#ja-col-tutoria')) return;

    // Si tutoria ha posat contingut directament (sense columnes), re-estructurar
    const contingutOriginal = detallEl.innerHTML;
    if (!contingutOriginal.trim() || contingutOriginal.includes('Selecciona un alumne')) return;
    if (contingutOriginal.includes('ja-col-tutoria')) return;

    // Agafar l'alumneId del item actiu
    const itemActiu = document.querySelector('.alumne-semafor-item[style*="e0e7ff"]') ||
                      document.querySelector('.alumne-semafor-item[data-ja-actiu]');
    const alumneId  = itemActiu?.dataset?.id;
    const cursActual = document.querySelector('#selCursTutoria')?.value;
    const periode    = document.querySelector('#selPeriodeTutoria')?.value || '';

    // Crear estructura de dues columnes
    detallEl.style.display  = 'flex';
    detallEl.style.padding  = '0';
    detallEl.style.overflow = 'hidden';

    // Columna esquerra: contingut original de tutoria
    const colEsquerra = document.createElement('div');
    colEsquerra.id = 'ja-col-tutoria';
    colEsquerra.style.cssText = `
      flex:1;overflow-y:auto;padding:24px;background:#fff;
      border-right:2px solid #e0e7ff;min-width:0;
    `;
    colEsquerra.innerHTML = contingutOriginal;

    // Columna dreta: reutilitzar si ja existia (re-render), crear si és nova
    const colDretaExistent = document.getElementById('ja-col-edicio');
    const estaRecarregant  = detallEl.dataset.jaRecarregant === '1';
    let colDreta;

    if (colDretaExistent && estaRecarregant) {
      // Re-render: desacoblar la columna dreta per re-adjuntar-la
      colDreta = colDretaExistent;
      colDreta.remove();
    } else {
      // Primera vegada: crear la columna dreta
      colDreta = document.createElement('div');
      colDreta.id = 'ja-col-edicio';
      colDreta.style.cssText = `
        width:420px;flex-shrink:0;overflow-y:auto;
        background:#fafafa;border-left:3px solid #7c3aed;
      `;
      colDreta.innerHTML = `
        <div style="background:#7c3aed;color:#fff;padding:12px 18px;
                    font-size:13px;font-weight:700;position:sticky;top:0;z-index:1;">
          ✏️ Mode edició — Junta d'Avaluació
        </div>
        <div id="ja-edicio-contingut" style="padding:18px;">
          <div style="color:#9ca3af;text-align:center;padding:30px 10px;font-size:13px;">
            ⏳ Carregant dades editables...
          </div>
        </div>
      `;
    }

    detallEl.innerHTML = '';
    detallEl.appendChild(colEsquerra);
    detallEl.appendChild(colDreta);

    // Marcar item actiu per futures referències
    if (itemActiu) itemActiu.dataset.jaActiu = '1';

    // Carregar dades d'edició
    if (alumneId && cursActual) {
      _jaCarregarEdicio(alumneId, cursActual, periode);
    }
  });

  // Observar canvis al detallAlumneTutoria quan aparegui
  const waitForDetall = () => {
    const detallEl = document.getElementById('detallAlumneTutoria');
    if (detallEl) {
      obs.observe(detallEl, { childList: true, subtree: false, characterData: false });
    } else {
      setTimeout(waitForDetall, 300);
    }
  };
  waitForDetall();

  // També interceptar els clics als items de la llista per saber l'alumneId
  document.addEventListener('click', e => {
    const item = e.target.closest('.alumne-semafor-item');
    if (!item) return;
    document.querySelectorAll('.alumne-semafor-item').forEach(el => delete el.dataset.jaActiu);
    item.dataset.jaActiu = '1';
    // Quan tutoria acabi de renderitzar, carregar l'edició
    const alumneId   = item.dataset.id;
    const cursActual = document.querySelector('#selCursTutoria')?.value;
    const periode    = document.querySelector('#selPeriodeTutoria')?.value || '';
    if (alumneId && cursActual) {
      setTimeout(() => _jaCarregarEdicio(alumneId, cursActual, periode), 600);
      setTimeout(() => _jaCarregarEdicio(alumneId, cursActual, periode), 1400);
    }
  });
}

/* ══════════════════════════════════════════════════════
   CARREGAR DADES D'EDICIÓ PER A UN ALUMNE
══════════════════════════════════════════════════════ */
async function _jaCarregarEdicio(alumneId, curs, periode) {
  const contenidor = document.getElementById('ja-edicio-contingut');
  if (!contenidor) return;

  // Evitar recàrrega si ja estem mostrant el mateix alumne
  if (contenidor.dataset.alumneId === alumneId) return;
  contenidor.dataset.alumneId = alumneId;
  contenidor.innerHTML = `<div style="color:#9ca3af;text-align:center;padding:30px;font-size:13px;">⏳ Carregant...</div>`;

  const db      = window.db;
  const grupId  = document.querySelector('#selGrupTutoria')?.value;
  if (!grupId) return;

  try {
    // Matèries del grup
    const grupDoc    = await db.collection('grups_centre').doc(grupId).get();
    const grupClasId = grupDoc.data()?.parentGrupId || grupId;
    const matSnap    = await db.collection('grups_centre').where('parentGrupId','==',grupClasId).get();
    const materies   = matSnap.docs.map(d => ({id:d.id,...d.data()})).filter(m => m.tipus !== 'tutoria');

    // Dades avaluació per matèria
    const dadesMateries = [];
    for (const mat of materies) {
      try {
        let docAv = await db.collection('avaluacio_centre').doc(curs).collection(mat.id).doc(alumneId).get();
        if (!docAv.exists) {
          const snap = await db.collection('avaluacio_centre').doc(curs).collection(mat.id)
            .where('grupClasseId','==',grupClasId).limit(30).get();
          const trobat = snap.docs.find(d => d.id===alumneId || d.data().ralc===alumneId);
          if (trobat) docAv = trobat;
        }
        if (docAv?.exists !== false) {
          const data = docAv.data ? docAv.data() : docAv;
          if (periode && data.periodeNom && data.periodeNom !== periode) continue;
          dadesMateries.push({ matId:mat.id, matNom:mat.nom||mat.id,
            docRef:docAv.ref||docAv, items:data.items||[], periodeNom:data.periodeNom||'',
            alumneNom:data.nom||'', alumneCognoms:data.cognoms||'' });
        }
      } catch(e) {}
    }

    // Comentari tutoria
    // El comentari de tutoria està a: alumnes/{docId}.comentarisPerPeriode.{periodeId}.comentari
    // On el doc d'alumne pertany a la CLASSE del tutor (classId = classe del tutor)
    // i el periodeId és l'ID intern del període (p_123...)
    let comentariTutoria='', alumneDocId=null, periodeIdTutoria=null;
    try {
      const ralc = (alumneId||'').includes('_') ? null : alumneId;
      const alumneNom = dadesMateries[0]?.alumneNom || '';
      const alumneCognoms = dadesMateries[0]?.alumneCognoms || '';

      // Buscar el doc d'alumne que tingui comentarisPerPeriode
      // Primer per RALC, si no per nom+cognoms
      let snapAl = null;
      if (ralc) {
        snapAl = await db.collection('alumnes').where('ralc','==',ralc).get();
      }
      if (!snapAl || snapAl.empty) {
        // Fallback: buscar per nom complet
        const nomComplet = alumneCognoms
          ? `${alumneNom} ${alumneCognoms}`.trim()
          : alumneNom;
        if (alumneNom) {
          snapAl = await db.collection('alumnes').where('nom','==',alumneNom).get();
        }
      }

      if (snapAl && !snapAl.empty) {
        // Agafar el doc que tingui comentarisPerPeriode (pot haver-ne diversos de classes diferents)
        // Prioritzar el que coincideixi amb el periode seleccionat
        let millorDoc = null, millorClau = null, millorComentari = '';

        for (const d of snapAl.docs) {
          const data = d.data();
          const periodes = data.comentarisPerPeriode || {};
          const claus = Object.keys(periodes);
          if (!claus.length) continue;

          // Buscar la clau que coincideixi amb el periode filtrat (per nom)
          let clauTriada = null;
          if (periode) {
            // El periodeNom pot estar desat dins el periode o podem identificar-lo
            // per l'índex de claus si l'ordre coincideix
            clauTriada = claus.find(k => {
              const pd = periodes[k];
              return pd?.periodeNom === periode || pd?.nom === periode;
            });
          }
          // Si no trobem per nom, agafar l'última clau (el més recent)
          if (!clauTriada) clauTriada = claus[claus.length - 1];

          const comentari = periodes[clauTriada]?.comentari || '';
          // Prioritzar docs que tinguin comentari real
          if (!millorDoc || (comentari && !millorComentari)) {
            millorDoc = d.id;
            millorClau = clauTriada;
            millorComentari = comentari;
          }
        }

        if (millorDoc) {
          alumneDocId      = millorDoc;
          periodeIdTutoria = millorClau;
          comentariTutoria = millorComentari;
        }
      }
    } catch(e) { console.warn('ja: comentari tutoria:', e.message); }

    // Autoavaluació
    let autoavalData=null, autoavalDocId=null;
    try {
      const ralc = (alumneId||'').includes('_') ? null : alumneId;
      if (ralc) {
        const ps = await db.collection('professors').where('rols','array-contains','alumne').where('ralc','==',ralc).limit(1).get();
        if (!ps.empty) {
          const rs = await db.collection('autoaval_respostes').where('alumneUID','==',ps.docs[0].id).get();
          if (!rs.empty) {
            const sorted = rs.docs.sort((a,b)=>(b.data().enviatAt?.seconds||0)-(a.data().enviatAt?.seconds||0));
            autoavalData=sorted[0].data(); autoavalDocId=sorted[0].id;
          }
        }
      }
    } catch(e) {}

    _jaRenderEdicio(contenidor, dadesMateries, comentariTutoria, alumneDocId, periodeIdTutoria, autoavalData, autoavalDocId);

  } catch(e) {
    contenidor.innerHTML = `<div style="color:#ef4444;font-size:13px;padding:16px;">Error: ${_jaEsH(e.message)}</div>`;
  }
}

/* ══════════════════════════════════════════════════════
   RENDERITZAR EDICIÓ
══════════════════════════════════════════════════════ */
const JA_ASSOLIMENTS = ['Assoliment Excel·lent','Assoliment Notable','Assoliment Satisfactori','No Assoliment','No avaluat'];

function _jaColorAss(s) {
  const n = (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  if (n.includes('excel'))        return {bg:'#22c55e',text:'#fff',border:'#16a34a'};
  if (n.includes('notable'))      return {bg:'#84cc16',text:'#fff',border:'#65a30d'};
  if (n.includes('satisfactori')) return {bg:'#f59e0b',text:'#fff',border:'#d97706'};
  if (n.includes('no ass'))       return {bg:'#ef4444',text:'#fff',border:'#dc2626'};
  return                                 {bg:'#9ca3af',text:'#fff',border:'#6b7280'};
}
function _jaEsH(s) {
  return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';
}

function _jaRenderEdicio(contenidor, dadesMateries, comentariTutoria,
                          alumneDocId, periodeIdTutoria, autoavalData, autoavalDocId) {
  const db = window.db;
  contenidor.innerHTML = '';

  if (!dadesMateries.length && !alumneDocId && !autoavalData) {
    contenidor.innerHTML = `<div style="color:#9ca3af;text-align:center;padding:30px;font-size:12px;">
      No s'han trobat dades editables per a aquest alumne/a.</div>`; return;
  }

  // ── Matèries ──
  dadesMateries.forEach(mat => {
    const div = document.createElement('div');
    div.style.cssText = 'margin-bottom:16px;border:1.5px solid #e5e7eb;border-radius:10px;overflow:hidden;';

    div.innerHTML = `
      <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:9px 12px;
                  display:flex;justify-content:space-between;align-items:center;">
        <div style="font-weight:700;color:#fff;font-size:12px;">📚 ${_jaEsH(mat.matNom)}</div>
        ${mat.periodeNom?`<span style="background:rgba(255,255,255,.2);color:#fff;padding:1px 7px;border-radius:4px;font-size:10px;">${_jaEsH(mat.periodeNom)}</span>`:''}
      </div>
      ${mat.items.length===0
        ? `<div style="padding:10px 12px;font-size:11px;color:#9ca3af;text-align:center;">Sense ítems</div>`
        : mat.items.map((item,idx) => {
            const c = _jaColorAss(item.assoliment||'');
            return `
              <div style="border-top:1px solid #f3f4f6;padding:10px 12px;background:#f9fafb;">
                <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:6px;">
                  ${_jaEsH(item.titol||`Ítem ${idx+1}`)}</div>
                <textarea class="ja-item-com" data-idx="${idx}" rows="2"
                  style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #d1d5db;
                         border-radius:6px;font-size:11px;font-family:inherit;resize:vertical;
                         outline:none;margin-bottom:5px;"
                >${_jaEsH(item.comentari||'')}</textarea>
                <select class="ja-item-ass" data-idx="${idx}"
                  style="width:100%;padding:6px 8px;border:2px solid ${c.border};border-radius:6px;
                         font-size:11px;font-weight:700;color:${c.text};background:${c.bg};
                         outline:none;cursor:pointer;">
                  ${JA_ASSOLIMENTS.map(a=>`<option value="${a}" ${a===item.assoliment?'selected':''}>${a}</option>`).join('')}
                </select>
              </div>`;
          }).join('')}
      <div style="padding:8px 12px;border-top:1px solid #f3f4f6;background:#fff;
                  display:flex;justify-content:flex-end;">
        <button class="ja-btn-mat" style="padding:5px 12px;background:#0891b2;color:#fff;
          border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;
          font-family:inherit;">💾 Guardar</button>
      </div>`;

    div.querySelectorAll('.ja-item-ass').forEach(sel => {
      sel.addEventListener('change', function() {
        const nc = _jaColorAss(this.value);
        Object.assign(this.style, {borderColor:nc.border, background:nc.bg, color:nc.text});
      });
    });
    div.querySelector('.ja-btn-mat').addEventListener('click', async function() {
      const nouItems = mat.items.map((item,idx) => ({...item,
        comentari: div.querySelector(`.ja-item-com[data-idx="${idx}"]`)?.value?.trim()||item.comentari||'',
        assoliment: div.querySelector(`.ja-item-ass[data-idx="${idx}"]`)?.value||item.assoliment||'No avaluat',
      }));
      this.textContent='⏳'; this.disabled=true;
      try {
        await mat.docRef.update({items:nouItems, updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()});
        mat.items=nouItems; this.textContent='✅';
        setTimeout(()=>{this.textContent='💾 Guardar';this.disabled=false;},2000);
        window.mostrarToast?.(`✅ ${mat.matNom} guardat`);
        // ── Bug 1 fix: re-renderitzar la columna esquerra de tutoria ──
        _jaRecarregarDetallTutoria();
      } catch(e) { this.textContent='❌';this.disabled=false; window.mostrarToast?.('❌ '+e.message); }
    });
    contenidor.appendChild(div);
  });

  // ── Comentari butlletí principal (generat per IA / tutor) ──
  const divTut = document.createElement('div');
  divTut.style.cssText = 'background:#f5f3ff;border:1.5px solid #a78bfa;border-radius:10px;padding:14px;margin-bottom:14px;';
  divTut.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:#4c1d95;margin-bottom:4px;">
      💬 Comentari del butlletí principal</div>
    <div style="font-size:10px;color:#7c3aed;margin-bottom:7px;">
      El text que genera la IA i que apareix al butlletí com a comentari del tutor/a</div>
    <textarea id="ja-com-tut" rows="4" placeholder="Sense comentari al butlletí..."
      style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #ddd6fe;
             border-radius:7px;font-size:12px;font-family:inherit;resize:vertical;outline:none;
             background:#fff;">${_jaEsH(comentariTutoria)}</textarea>
    <div style="display:flex;justify-content:flex-end;margin-top:7px;">
      <button id="ja-btn-tut" style="padding:5px 12px;background:#7c3aed;color:#fff;border:none;
        border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;"
        ${!alumneDocId||!periodeIdTutoria?'disabled':''}>💾 Guardar</button>
    </div>`;
  divTut.querySelector('#ja-btn-tut').addEventListener('click', async function() {
    if (!alumneDocId||!periodeIdTutoria) { window.mostrarToast?.('⚠️ Alumne/a no identificat'); return; }
    const text = divTut.querySelector('#ja-com-tut').value.trim();
    this.textContent='⏳'; this.disabled=true;
    try {
      await db.collection('alumnes').doc(alumneDocId).update({
        [`comentarisPerPeriode.${periodeIdTutoria}.comentari`]: text });
      this.textContent='✅'; setTimeout(()=>{this.textContent='💾 Guardar';this.disabled=false;},2000);
      window.mostrarToast?.('✅ Comentari del butlletí guardat');
    } catch(e) { this.textContent='❌';this.disabled=false; window.mostrarToast?.('❌ '+e.message); }
  });
  contenidor.appendChild(divTut);

  // ── Autoavaluació ──
  const divAA = document.createElement('div');
  divAA.style.cssText = `background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:14px;margin-bottom:14px;${autoavalData?'':'opacity:0.55;'}`;
  divAA.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:7px;">📝 Autoavaluació</div>
    ${autoavalData ? `
      <div style="background:#fff;border-radius:7px;padding:8px 10px;font-size:11px;color:#374151;
                  max-height:130px;overflow-y:auto;line-height:1.6;margin-bottom:8px;">
        ${(autoavalData.preguntes||[]).map((p,i)=>`
          <div style="margin-bottom:5px;">
            <strong style="color:#166534;">${_jaEsH(p.text||`P${i+1}`)}</strong><br>
            ${_jaEsH((autoavalData.respostes||[])[i]||'—')}</div>`).join('')}
      </div>
      <div style="font-size:11px;font-weight:700;color:#166534;margin-bottom:5px;">💬 Valoració tutor/a</div>
      <textarea id="ja-com-aa" rows="3" placeholder="Valoració del tutor/a..."
        style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #86efac;
               border-radius:7px;font-size:12px;font-family:inherit;resize:vertical;outline:none;
               background:#fff;">${_jaEsH(autoavalData.comentariTutor||'')}</textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:7px;">
        <button id="ja-btn-aa" style="padding:5px 12px;background:#059669;color:#fff;border:none;
          border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">
          💾 Guardar</button>
      </div>` :
    `<div style="font-size:11px;color:#6b7280;">Sense autoavaluació enviada.</div>`}`;

  if (autoavalData && autoavalDocId) {
    divAA.querySelector('#ja-btn-aa').addEventListener('click', async function() {
      const comentari = divAA.querySelector('#ja-com-aa').value.trim();
      this.textContent='⏳'; this.disabled=true;
      try {
        await db.collection('autoaval_respostes').doc(autoavalDocId).update({
          comentariTutor:comentari,
          estat:autoavalData.estat==='enviatButlleti'?'enviatButlleti':'revisat',
          revisatAt:window.firebase.firestore.FieldValue.serverTimestamp() });
        autoavalData.comentariTutor=comentari;
        this.textContent='✅'; setTimeout(()=>{this.textContent='💾 Guardar';this.disabled=false;},2000);
        window.mostrarToast?.('✅ Valoració guardada');
      } catch(e) { this.textContent='❌';this.disabled=false; window.mostrarToast?.('❌ '+e.message); }
    });
  }
  contenidor.appendChild(divAA);
}

window.obrirJuntaAvaluacio = obrirJuntaAvaluacio;

/* ══════════════════════════════════════════════════════
   RE-RENDERITZAR DETALL TUTORIA (columna esquerra)
   Quan es guarda un canvi, refrescar el detall de tutoria
   sense tancar el panell ni perdre la columna d'edició
══════════════════════════════════════════════════════ */
async function _jaRecarregarDetallTutoria() {
  const itemActiu = document.querySelector('.alumne-semafor-item[data-ja-actiu="1"]');
  if (!itemActiu) return;

  const colEsquerra = document.getElementById('ja-col-tutoria');
  if (!colEsquerra) return;

  // Mostrar indicador de recàrrega
  const indicador = document.createElement('div');
  indicador.style.cssText = `
    position:sticky;top:0;z-index:10;background:#7c3aed;color:#fff;
    padding:6px 14px;font-size:11px;font-weight:700;text-align:center;
  `;
  indicador.textContent = '⏳ Actualitzant vista...';
  colEsquerra.prepend(indicador);

  try {
    // Simular el clic a l'alumne actiu per que tutoria-nova re-renderitzi el detall
    // Però primer cal desactivar temporalment el nostre observer per evitar loop
    const detallEl = document.getElementById('detallAlumneTutoria');
    if (detallEl) detallEl.dataset.jaRecarregant = '1';

    // Clicar l'alumne actiu — tutoria-nova renderitzarà el detall sencer
    itemActiu.click();

    // Esperar que tutoria renderitzi
    await new Promise(r => setTimeout(r, 800));

    // El MutationObserver haurà detectat el canvi i re-estructurat les columnes
    if (detallEl) delete detallEl.dataset.jaRecarregant;

  } catch(e) {
    console.warn('ja recarregar:', e.message);
  } finally {
    indicador.remove();
  }
}
