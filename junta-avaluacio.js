// junta-avaluacio.js — Injector "Junta d'Avaluació"
// Obre panell de tutoria + afegeix columna d'edició a la dreta
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
  const nav = document.querySelector('.sidebar-nav');
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
   OBRIR PANELL
══════════════════════════════════════════════════════ */
async function obrirJuntaAvaluacio() {
  let i = 0;
  while (typeof window.obrirPanellTutoria !== 'function' && i++ < 20)
    await new Promise(r => setTimeout(r, 200));
  if (typeof window.obrirPanellTutoria !== 'function') {
    window.mostrarToast?.('❌ Mòdul tutoria no disponible'); return;
  }

  // Interceptar ABANS d'obrir per capturar el render
  _jaActivarInterceptor();
  await window.obrirPanellTutoria();

  const overlay = document.getElementById('panellTutoria');
  if (!overlay) return;
  const h2 = overlay.querySelector('h2');
  if (h2) h2.textContent = '🏫 Junta d\'Avaluació';
  const p  = overlay.querySelector('p');
  if (p)  p.textContent  = 'Visualització i edició per a la junta';

  // Preparar detall per a layout de dues columnes
  const detall = document.getElementById('detallAlumneTutoria');
  if (detall) { detall.style.display='flex'; detall.style.padding='0'; detall.style.overflow='hidden'; }
}

/* ══════════════════════════════════════════════════════
   INTERCEPTOR: detecta quan tutoria renderitza el detall
   i divideix en dues columnes
══════════════════════════════════════════════════════ */
let _jaObs = null;
function _jaActivarInterceptor() {
  if (_jaObs) return;

  // Esperar que existeixi detallAlumneTutoria
  const waitDetall = () => {
    const detall = document.getElementById('detallAlumneTutoria');
    if (!detall) { setTimeout(waitDetall, 200); return; }
    _jaObs = new MutationObserver(() => _jaOnDetallCanviat());
    _jaObs.observe(detall, { childList: true });
  };
  waitDetall();

  // Capturar alumneId en clicar un item de la llista
  document.addEventListener('click', e => {
    const item = e.target.closest('.alumne-semafor-item');
    if (!item) return;
    document.querySelectorAll('.alumne-semafor-item').forEach(el => delete el.dataset.jaActiu);
    item.dataset.jaActiu = '1';
    window._jaAlumneActiu = { id: item.dataset.id, curs: item.dataset.curs };
  });
}

function _jaOnDetallCanviat() {
  const detall = document.getElementById('detallAlumneTutoria');
  if (!detall) return;
  // Ignorar si ja té les columnes o si és el placeholder buit
  if (detall.querySelector('#ja-col-esq')) return;
  const html = detall.innerHTML;
  if (!html.trim() || html.includes('Selecciona un alumne') || html.includes('👤')) return;

  // Agafar l'alumne actiu
  const info = window._jaAlumneActiu;
  if (!info?.id) return;

  // Construir dues columnes
  detall.style.display  = 'flex';
  detall.style.padding  = '0';
  detall.style.overflow = 'hidden';

  const colEsq = document.createElement('div');
  colEsq.id = 'ja-col-esq';
  colEsq.style.cssText = 'flex:1;overflow-y:auto;padding:24px;background:#fff;border-right:2px solid #e0e7ff;min-width:0;';
  colEsq.innerHTML = html;

  // Reutilitzar col·lumna dreta si ja existia (per preservar edició en curs)
  let colDre = document.getElementById('ja-col-dre');
  if (!colDre) {
    colDre = document.createElement('div');
    colDre.id = 'ja-col-dre';
    colDre.style.cssText = 'width:400px;flex-shrink:0;overflow-y:auto;background:#fafafa;border-left:3px solid #7c3aed;';
    colDre.innerHTML = `
      <div style="background:#7c3aed;color:#fff;padding:11px 16px;font-size:13px;font-weight:700;position:sticky;top:0;z-index:1;">
        ✏️ Mode edició — Junta d'Avaluació
      </div>
      <div id="ja-edit" style="padding:16px;">
        <div style="color:#9ca3af;text-align:center;padding:30px;font-size:12px;">⏳ Carregant...</div>
      </div>`;
  } else {
    colDre.remove(); // desacoblar per re-adjuntar
  }

  detall.innerHTML = '';
  detall.appendChild(colEsq);
  detall.appendChild(colDre);

  // Carregar dades editables
  _jaCarregarEdicio(info.id, info.curs);
}

/* ══════════════════════════════════════════════════════
   CARREGAR DADES EDITABLES
══════════════════════════════════════════════════════ */
async function _jaCarregarEdicio(alumneId, curs) {
  const edit = document.getElementById('ja-edit');
  if (!edit) return;
  if (edit.dataset.alumneId === alumneId) return; // ja carregat
  edit.dataset.alumneId = alumneId;
  edit.innerHTML = '<div style="color:#9ca3af;text-align:center;padding:30px;font-size:12px;">⏳ Carregant...</div>';

  const db      = window.db;
  const grupId  = document.querySelector('#selGrupTutoria')?.value;
  const periode = document.querySelector('#selPeriodeTutoria')?.value || '';
  const cursActual = document.querySelector('#selCursTutoria')?.value || curs;
  if (!grupId) return;

  try {
    // 1. Matèries del grup
    const grupDoc    = await db.collection('grups_centre').doc(grupId).get();
    const grupClasId = grupDoc.data()?.parentGrupId || grupId;
    const matSnap    = await db.collection('grups_centre').where('parentGrupId','==',grupClasId).get();
    const materies   = matSnap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>m.tipus!=='tutoria');

    // 2. Dades avaluació per matèria
    const dadesMateries = [];
    for (const mat of materies) {
      try {
        let doc = await db.collection('avaluacio_centre').doc(cursActual).collection(mat.id).doc(alumneId).get();
        if (!doc.exists) {
          const snap = await db.collection('avaluacio_centre').doc(cursActual).collection(mat.id)
            .where('grupClasseId','==',grupClasId).limit(30).get();
          const t = snap.docs.find(d=>d.id===alumneId||d.data().ralc===alumneId);
          if (t) doc = t;
        }
        if (doc?.exists !== false) {
          const data = doc.data?.()||doc;
          if (periode && data.periodeNom && data.periodeNom!==periode) continue;
          dadesMateries.push({ matId:mat.id, matNom:mat.nom||mat.id,
            docRef:doc.ref||doc, items:data.items||[], periodeNom:data.periodeNom||'',
            alumneNom:data.nom||'', alumneCognoms:data.cognoms||'', ralc:data.ralc||'' });
        }
      } catch(e) {}
    }

    // 3. Comentari tutor/a
    // És el camp comentariGlobal de avaluacio_centre/{curs}/{grupTutoriaId}/{doc}
    // El mateix que mostra pi.js a #comentariTutoriaSection i que edita el revisor
    const ralc = dadesMateries[0]?.ralc || (alumneId.includes('_')?null:alumneId);
    let comentariTutor = '', comentariTutorDocRef = null;
    try {
      if (ralc && grupId && cursActual) {
        const db2 = window.db;
        // Trobar el grup tutoria: pot ser el grup seleccionat o un fill de tipus tutoria
        const grupDoc2 = await db2.collection('grups_centre').doc(grupId).get();
        const grupData2 = grupDoc2.data() || {};
        let grupTutoriaId = grupId;
        let grupClasseId = grupId;

        if (grupData2.tipus !== 'tutoria') {
          // És un grup classe: buscar el fill tutoria
          const tutSnap = await db2.collection('grups_centre')
            .where('parentGrupId','==',grupId).where('tipus','==','tutoria').limit(1).get();
          if (!tutSnap.empty) grupTutoriaId = tutSnap.docs[0].id;
        } else {
          grupClasseId = grupData2.parentGrupId || grupId;
        }

        // Buscar el doc de tutoria per RALC
        let snapTut = await db2.collection('avaluacio_centre').doc(cursActual)
          .collection(grupTutoriaId).where('grupClasseId','==',grupClasseId).get();
        if (snapTut.empty) {
          snapTut = await db2.collection('avaluacio_centre').doc(cursActual)
            .collection(grupTutoriaId).get();
        }

        const docTut = snapTut.docs.find(d => {
          const data = d.data();
          return data.ralc === ralc && (!periode || data.periodeNom === periode);
        }) || snapTut.docs.find(d => d.data().ralc === ralc);

        if (docTut) {
          comentariTutor = docTut.data().comentariGlobal || '';
          comentariTutorDocRef = docTut.ref;
        }
      }
    } catch(e) { console.warn('ja: comentari tutor:', e.message); }

    // 4. Autoavaluació
    let autoavalData=null, autoavalDocId=null;
    try {
      if (ralc) {
        const ps = await db.collection('professors')
          .where('rols','array-contains','alumne').where('ralc','==',ralc).limit(1).get();
        if (!ps.empty) {
          const rs = await db.collection('autoaval_respostes').where('alumneUID','==',ps.docs[0].id).get();
          if (!rs.empty) {
            const s = rs.docs.sort((a,b)=>(b.data().enviatAt?.seconds||0)-(a.data().enviatAt?.seconds||0));
            autoavalData=s[0].data(); autoavalDocId=s[0].id;
          }
        }
      }
    } catch(e) {}

    _jaRenderEdicio(edit, dadesMateries, comentariTutor, comentariTutorDocRef, autoavalData, autoavalDocId);

  } catch(e) {
    edit.innerHTML = `<div style="color:#ef4444;padding:16px;font-size:12px;">Error: ${_esH(e.message)}</div>`;
  }
}

/* ══════════════════════════════════════════════════════
   RENDERITZAR EDICIÓ
══════════════════════════════════════════════════════ */
const JA_ASS = ['Assoliment Excel·lent','Assoliment Notable','Assoliment Satisfactori','No Assoliment','No avaluat'];

function _cAss(s) {
  const n=(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(n.includes('excel'))        return{bg:'#22c55e',tx:'#fff',br:'#16a34a'};
  if(n.includes('notable'))      return{bg:'#84cc16',tx:'#fff',br:'#65a30d'};
  if(n.includes('satisfactori')) return{bg:'#f59e0b',tx:'#fff',br:'#d97706'};
  if(n.includes('no ass'))       return{bg:'#ef4444',tx:'#fff',br:'#dc2626'};
  return                               {bg:'#9ca3af',tx:'#fff',br:'#6b7280'};
}
function _esH(s){ return s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'):''; }

function _jaRenderEdicio(edit, dadesMateries, comentariTutor, comentariTutorDocRef, autoavalData, autoavalDocId) {
  const db = window.db;
  edit.innerHTML = '';

  // ── Matèries editables ──
  dadesMateries.forEach(mat => {
    const div = document.createElement('div');
    div.style.cssText = 'margin-bottom:14px;border:1.5px solid #e5e7eb;border-radius:10px;overflow:hidden;';
    div.innerHTML = `
      <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:9px 12px;
                  display:flex;justify-content:space-between;align-items:center;">
        <div style="font-weight:700;color:#fff;font-size:12px;">📚 ${_esH(mat.matNom)}</div>
        ${mat.periodeNom?`<span style="background:rgba(255,255,255,.2);color:#fff;padding:1px 7px;border-radius:4px;font-size:10px;">${_esH(mat.periodeNom)}</span>`:''}
      </div>
      ${mat.items.length===0
        ? `<div style="padding:10px 12px;font-size:11px;color:#9ca3af;text-align:center;">Sense ítems</div>`
        : mat.items.map((item,idx)=>{
            const c=_cAss(item.assoliment||'');
            return `<div style="border-top:1px solid #f3f4f6;padding:10px 12px;background:#f9fafb;">
              <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:5px;">${_esH(item.titol||`Ítem ${idx+1}`)}</div>
              <textarea class="ja-com" data-idx="${idx}" rows="2"
                style="width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid #d1d5db;
                       border-radius:6px;font-size:11px;font-family:inherit;resize:vertical;outline:none;margin-bottom:4px;"
              >${_esH(item.comentari||'')}</textarea>
              <select class="ja-ass" data-idx="${idx}"
                style="width:100%;padding:5px 8px;border:2px solid ${c.br};border-radius:6px;
                       font-size:11px;font-weight:700;color:${c.tx};background:${c.bg};outline:none;cursor:pointer;">
                ${JA_ASS.map(a=>`<option value="${a}" ${a===item.assoliment?'selected':''}>${a}</option>`).join('')}
              </select>
            </div>`;
          }).join('')}
      <div style="padding:8px 12px;border-top:1px solid #f3f4f6;background:#fff;display:flex;justify-content:flex-end;">
        <button class="ja-btn-mat" style="padding:5px 12px;background:#0891b2;color:#fff;border:none;
          border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">💾 Guardar</button>
      </div>`;

    div.querySelectorAll('.ja-ass').forEach(sel=>{
      sel.addEventListener('change',function(){const c=_cAss(this.value);this.style.borderColor=c.br;this.style.background=c.bg;this.style.color=c.tx;});
    });

    div.querySelector('.ja-btn-mat').addEventListener('click', async function() {
      const nouItems = mat.items.map((item,idx)=>({...item,
        comentari: div.querySelector(`.ja-com[data-idx="${idx}"]`)?.value?.trim()||'',
        assoliment: div.querySelector(`.ja-ass[data-idx="${idx}"]`)?.value||'No avaluat',
      }));
      this.textContent='⏳'; this.disabled=true;
      try {
        await mat.docRef.update({items:nouItems, updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()});
        mat.items = nouItems;
        this.textContent='✅';
        setTimeout(()=>{this.textContent='💾 Guardar';this.disabled=false;},2000);
        window.mostrarToast?.(`✅ ${mat.matNom} guardat`);
      } catch(e){this.textContent='❌';this.disabled=false;window.mostrarToast?.('❌ '+e.message);}
    });
    edit.appendChild(div);
  });

  // ── Comentari tutor/a ──
  // És el comentariGlobal de avaluacio_centre/{curs}/{grupTutoria}/{doc}
  // El mateix que es veu a la fitxa de tutoria i que edita el revisor
  const divTut = document.createElement('div');
  divTut.style.cssText = 'background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:14px;margin-bottom:14px;';
  divTut.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:4px;">💬 Comentari tutor/a</div>
    <div style="font-size:10px;color:#059669;margin-bottom:8px;">
      El comentari que apareix a la fitxa de tutoria i al panell de revisió</div>
    <textarea id="ja-com-tut" rows="5" placeholder="${comentariTutorDocRef ? 'Sense comentari...' : 'No s\'ha trobat el document de tutoria per a aquest alumne/a'}"
      style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #86efac;
             border-radius:7px;font-size:12px;font-family:inherit;resize:vertical;outline:none;
             background:#fff;" ${!comentariTutorDocRef ? 'disabled' : ''}
    >${_esH(comentariTutor)}</textarea>
    <div style="display:flex;justify-content:flex-end;margin-top:7px;">
      <button id="ja-btn-tut" style="padding:5px 12px;background:#059669;color:#fff;border:none;
        border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;"
        ${!comentariTutorDocRef ? 'disabled' : ''}>💾 Guardar</button>
    </div>`;

  if (comentariTutorDocRef) {
    divTut.querySelector('#ja-btn-tut').addEventListener('click', async function() {
      const text = divTut.querySelector('#ja-com-tut').value.trim();
      this.textContent='⏳'; this.disabled=true;
      try {
        await comentariTutorDocRef.update({
          comentariGlobal: text,
          revisatPer: window.firebase.auth().currentUser?.email || '',
          revisatAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        this.textContent='✅';
        setTimeout(()=>{this.textContent='💾 Guardar';this.disabled=false;},2000);
        window.mostrarToast?.('✅ Comentari tutor/a guardat');
      } catch(e){this.textContent='❌';this.disabled=false;window.mostrarToast?.('❌ '+e.message);}
    });
  }
  edit.appendChild(divTut);

  // ── Autoavaluació ──
  const divAA = document.createElement('div');
  divAA.style.cssText = `background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:14px;margin-bottom:14px;${autoavalData?'':'opacity:0.55;'}`;
  divAA.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:6px;">📝 Autoavaluació</div>
    ${autoavalData ? `
      <div style="background:#fff;border-radius:7px;padding:8px 10px;font-size:11px;color:#374151;
                  max-height:120px;overflow-y:auto;line-height:1.6;margin-bottom:8px;">
        ${(autoavalData.preguntes||[]).map((p,i)=>`
          <div style="margin-bottom:5px;">
            <strong style="color:#166534;">${_esH(p.text||`P${i+1}`)}</strong><br>
            ${_esH((autoavalData.respostes||[])[i]||'—')}</div>`).join('')}
      </div>
      <div style="font-size:11px;font-weight:700;color:#166534;margin-bottom:5px;">💬 Valoració tutor/a</div>
      <textarea id="ja-com-aa" rows="3"
        style="width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #86efac;
               border-radius:7px;font-size:12px;font-family:inherit;resize:vertical;outline:none;background:#fff;"
      >${_esH(autoavalData.comentariTutor||'')}</textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:7px;">
        <button id="ja-btn-aa" style="padding:5px 12px;background:#059669;color:#fff;border:none;
          border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">💾 Guardar</button>
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
          revisatAt:window.firebase.firestore.FieldValue.serverTimestamp()});
        autoavalData.comentariTutor=comentari;
        this.textContent='✅';
        setTimeout(()=>{this.textContent='💾 Guardar';this.disabled=false;},2000);
        window.mostrarToast?.('✅ Valoració guardada');
      } catch(e){this.textContent='❌';this.disabled=false;window.mostrarToast?.('❌ '+e.message);}
    });
  }
  edit.appendChild(divAA);
}

/* ══════════════════════════════════════════════════════
   RE-RENDERITZAR COLUMNA ESQUERRA
   Llegir les dades actualitzades i reconstruir el detall
   de tutoria sense tancar el panell ni perdre l'edició
══════════════════════════════════════════════════════ */
async function _jaRecarregarColEsquerra() {
  const colEsq = document.getElementById('ja-col-esq');
  if (!colEsq) return;

  // Indicador visual
  const ind = document.createElement('div');
  ind.style.cssText = 'position:sticky;top:0;z-index:10;background:#0891b2;color:#fff;padding:5px 14px;font-size:11px;font-weight:700;text-align:center;';
  ind.textContent = '⏳ Actualitzant...';
  colEsq.prepend(ind);

  try {
    // Obtenir l'alumne actiu i simular clic — tutoria-nova re-renderitzarà el detall
    // però el nostre observer desactivat (per evitar loop) restaurarà la columna esquerra
    const info = window._jaAlumneActiu;
    if (!info) { ind.remove(); return; }

    // Desactivar temporalment l'observer per evitar que re-creï les columnes
    _jaObs?.disconnect();

    const itemActiu = document.querySelector(`.alumne-semafor-item[data-ja-actiu="1"]`);
    if (itemActiu) {
      // Clic directe — tutoria-nova cridarà mostrarDetallAlumne i actualitzarà el detall
      itemActiu.click();
      await new Promise(r => setTimeout(r, 700));
    }

    // El detall ara té el contingut nou però sense columnes (tutoria l'ha sobreescrit)
    // Re-aplicar les columnes
    const detall = document.getElementById('detallAlumneTutoria');
    if (detall && !detall.querySelector('#ja-col-esq')) {
      const contingut = detall.innerHTML;
      if (contingut && !contingut.includes('Selecciona un alumne')) {
        const colDre = document.getElementById('ja-col-dre');
        if (colDre) colDre.remove();

        const nouaColEsq = document.createElement('div');
        nouaColEsq.id = 'ja-col-esq';
        nouaColEsq.style.cssText = 'flex:1;overflow-y:auto;padding:24px;background:#fff;border-right:2px solid #e0e7ff;min-width:0;';
        nouaColEsq.innerHTML = contingut;

        detall.style.display='flex'; detall.style.padding='0'; detall.style.overflow='hidden';
        detall.innerHTML = '';
        detall.appendChild(nouaColEsq);
        if (colDre) detall.appendChild(colDre);
      }
    }

    // Re-activar l'observer
    const detall2 = document.getElementById('detallAlumneTutoria');
    if (detall2 && _jaObs) _jaObs.observe(detall2, { childList: true });

  } catch(e) {
    console.warn('ja recarregar:', e.message);
  } finally {
    ind.remove();
  }
}

window.obrirJuntaAvaluacio = obrirJuntaAvaluacio;
