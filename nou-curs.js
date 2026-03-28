// nou-curs.js — Injector "Nou curs acadèmic" al panell de Secretaria
// No modifica secretaria.js. Observa el DOM i afegeix el tab quan el panell s'obre.

console.log('🎓 nou-curs.js carregat');

/* ══════════════════════════════════════════════════════
   INJECTOR: observa l'aparició del panell de secretaria
══════════════════════════════════════════════════════ */
(function injectarTabNouCurs() {
  const observer = new MutationObserver(() => {
    const overlay = document.getElementById('panellSecretaria');
    if (!overlay || overlay.dataset.nouCursInjectat) return;
    overlay.dataset.nouCursInjectat = '1';

    // Trobar el contenidor dels tabs
    const tabsContainer = overlay.querySelector('.sec-tab')?.parentElement;
    if (!tabsContainer) return;

    // Crear el nou tab
    const tab = document.createElement('button');
    tab.className = 'sec-tab';
    tab.dataset.tab = 'noucurs';
    tab.style.cssText = `
      padding:7px 14px;border-radius:8px 8px 0 0;border:none;cursor:pointer;
      font-size:13px;font-weight:600;
      background:rgba(255,255,255,0.15);color:#fff;white-space:nowrap;
    `;
    tab.textContent = '🎓 Nou curs';
    tabsContainer.appendChild(tab);

    // Listener del nou tab — replica exactament el comportament dels tabs originals
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.sec-tab').forEach(t => {
        t.style.background = 'rgba(255,255,255,0.15)';
        t.style.color = '#fff';
      });
      tab.style.background = '#fff';
      tab.style.color = '#4c1d95';

      const body = document.getElementById('secBody');
      if (body) renderNouCurs(body);
    });
  });

  observer.observe(document.body, { childList: true });
})();

/* ══════════════════════════════════════════════════════
   TAB NOU CURS — Renderitzat
══════════════════════════════════════════════════════ */
async function renderNouCurs(body) {
  const cursActiu = await _ncCarregarCursActiu();

  // Suggerir el curs següent automàticament
  const parts = (cursActiu || '').match(/^(\d{4})-(\d{2,4})$/);
  let cursNouSuggeriment = '';
  if (parts) {
    const any1 = parseInt(parts[1]);
    const any2 = any1 + 1;
    cursNouSuggeriment = `${any2}-${String(any2 + 1).slice(-2)}`;
  }

  body.innerHTML = `
    <div style="max-width:680px;margin:0 auto;font-family:inherit;">

      <div style="margin-bottom:28px;">
        <h2 style="font-size:20px;font-weight:800;color:#1e1b4b;margin:0 0 6px;">🎓 Inici de nou curs acadèmic</h2>
        <p style="font-size:14px;color:#6b7280;margin:0;line-height:1.6;">
          Prepara el sistema per al nou curs. Aquesta acció és <strong>irreversible</strong> —
          assegura't de descarregar la còpia de seguretat.
        </p>
      </div>

      <!-- Curs actual → nou curs -->
      <div style="background:#f5f3ff;border:1.5px solid #a78bfa;border-radius:12px;
                  padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:16px;">
        <div>
          <div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;
                      letter-spacing:.05em;">Curs actiu actual</div>
          <div style="font-size:24px;font-weight:800;color:#4c1d95;font-family:monospace;">
            ${_ncEsH(cursActiu || '—')}
          </div>
        </div>
        <div style="font-size:24px;color:#a78bfa;">→</div>
        <div style="flex:1;">
          <div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;
                      letter-spacing:.05em;margin-bottom:6px;">Nou curs</div>
          <input id="ncInputNouCurs" type="text" value="${_ncEsH(cursNouSuggeriment)}"
            placeholder="Ex: 2025-26"
            style="border:2px solid #7c3aed;border-radius:8px;padding:8px 14px;
                   font-size:18px;font-weight:800;font-family:monospace;outline:none;
                   background:#fff;color:#4c1d95;width:140px;">
        </div>
      </div>

      <!-- Resum d'accions -->
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;
                  overflow:hidden;margin-bottom:20px;">
        <div style="padding:14px 18px;border-bottom:1px solid #e5e7eb;
                    font-size:13px;font-weight:700;color:#374151;">
          Què farà aquest procés:
        </div>
        <div style="padding:14px 18px;display:flex;flex-direction:column;gap:10px;">
          ${[
            { color:'#059669', bg:'#d1fae5', icon:'💾',
              text:'Genera i descarrega una còpia de seguretat completa del curs actual (JSON).' },
            { color:'#7c3aed', bg:'#ede9fe', icon:'🔄',
              text:'Actualitza el curs actiu a tot el sistema.' },
            { color:'#dc2626', bg:'#fee2e2', icon:'🗑️',
              text:'Esborra totes les classes i alumnes privats creats pels professors.' },
            { color:'#dc2626', bg:'#fee2e2', icon:'🗑️',
              text:'Esborra totes les avaluacions de centre (<code>avaluacio_centre</code>) del curs anterior.' },
            { color:'#d97706', bg:'#fef3c7', icon:'🔁',
              text:'Reseteja rols de tots els professors a buit (excepte admin, superadmin i secretaria).' },
            { color:'#d97706', bg:'#fef3c7', icon:'🔁',
              text:'Neteja camps de revisió (<code>revisio_nivells</code>, <code>revisio_tot</code>) de tots els professors.' },
            { color:'#059669', bg:'#d1fae5', icon:'✅',
              text:'<strong>Conserva</strong>: grups_centre, nivells_centre, plantilles Ultracomentator, configuració tutoria, plans individualitzats.' },
          ].map(a => `
            <div style="display:flex;align-items:flex-start;gap:10px;">
              <span style="background:${a.bg};color:${a.color};font-size:14px;width:28px;height:28px;
                           border-radius:50%;display:flex;align-items:center;justify-content:center;
                           flex-shrink:0;">${a.icon}</span>
              <span style="font-size:13px;color:#374151;line-height:1.5;padding-top:5px;">${a.text}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Progrés (ocult fins que s'executa) -->
      <div id="ncProgresDiv" style="display:none;background:#f9fafb;border:1px solid #e5e7eb;
                border-radius:12px;padding:16px 18px;margin-bottom:20px;">
        <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:10px;">Progrés:</div>
        <div id="ncLogEl" style="font-size:12px;color:#6b7280;line-height:2;
                                  font-family:monospace;max-height:200px;overflow-y:auto;"></div>
        <div style="margin-top:10px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;">
          <div id="ncBarEl" style="height:100%;background:#7c3aed;border-radius:3px;
                                    width:0%;transition:width .3s;"></div>
        </div>
      </div>

      <!-- Confirmació -->
      <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;
                  padding:16px 20px;margin-bottom:20px;">
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
          <input type="checkbox" id="ncChkConfirma"
            style="margin-top:3px;width:16px;height:16px;accent-color:#dc2626;flex-shrink:0;">
          <span style="font-size:13px;color:#991b1b;line-height:1.6;">
            Entenc que aquesta acció <strong>no es pot desfer</strong>. He comprovat el nou curs
            i sé que es descarregarà una còpia de seguretat automàticament abans de fer cap canvi.
          </span>
        </label>
      </div>

      <button id="ncBtnIniciar" disabled style="
        width:100%;padding:14px;background:#e5e7eb;color:#9ca3af;border:none;
        border-radius:10px;font-size:15px;font-weight:700;cursor:not-allowed;
        font-family:inherit;transition:all .2s;
      ">🎓 Iniciar nou curs acadèmic</button>

      <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:12px;">
        Temps estimat: 1–3 minuts depenent del nombre de professors i dades.
      </p>
    </div>
  `;

  // Habilitar botó quan es marca el checkbox
  const chk = body.querySelector('#ncChkConfirma');
  const btn = body.querySelector('#ncBtnIniciar');
  chk.addEventListener('change', () => {
    if (chk.checked) {
      btn.disabled = false;
      btn.style.cssText = `
        width:100%;padding:14px;background:#dc2626;color:#fff;border:none;
        border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;
        font-family:inherit;transition:all .2s;
      `;
    } else {
      btn.disabled = true;
      btn.style.cssText = `
        width:100%;padding:14px;background:#e5e7eb;color:#9ca3af;border:none;
        border-radius:10px;font-size:15px;font-weight:700;cursor:not-allowed;
        font-family:inherit;transition:all .2s;
      `;
    }
  });

  btn.addEventListener('click', async () => {
    const nouCurs = body.querySelector('#ncInputNouCurs').value.trim();
    if (!nouCurs) { window.mostrarToast('⚠️ Introdueix el nom del nou curs'); return; }
    if (!/^\d{4}-\d{2,4}$/.test(nouCurs)) {
      window.mostrarToast('⚠️ Format incorrecte. Exemple: 2025-26'); return;
    }
    if (nouCurs === cursActiu) {
      window.mostrarToast('⚠️ El nou curs ha de ser diferent de l\'actual'); return;
    }
    await _ncIniciarNouCurs(cursActiu, nouCurs, body);
  });
}

/* ══════════════════════════════════════════════════════
   LÒGICA PRINCIPAL: INICIAR NOU CURS (OPCIÓ A)
══════════════════════════════════════════════════════ */
async function _ncIniciarNouCurs(cursAntic, cursNou, body) {
  const db = window.db;

  // Bloquejar UI i mostrar progrés
  body.querySelector('#ncBtnIniciar').disabled = true;
  body.querySelector('#ncBtnIniciar').textContent = '⏳ Processant...';
  body.querySelector('#ncChkConfirma').disabled = true;
  body.querySelector('#ncInputNouCurs').disabled = true;

  const progresDiv = body.querySelector('#ncProgresDiv');
  const logEl      = body.querySelector('#ncLogEl');
  const barEl      = body.querySelector('#ncBarEl');
  progresDiv.style.display = 'block';
  progresDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const log = (msg, ok = null) => {
    const icon = ok === true ? '✅' : ok === false ? '❌' : '⏳';
    logEl.innerHTML += `<div>${icon} ${msg}</div>`;
    logEl.scrollTop = logEl.scrollHeight;
  };
  const setBar = (pct) => { barEl.style.width = pct + '%'; };

  try {
    // ── PAS 1: Còpia de seguretat ──────────────────────────
    log('Generant còpia de seguretat del curs actual...');
    setBar(5);
    try {
      if (typeof window.generarBackupJSON !== 'function') throw new Error('Funció backup no disponible');
      const snapshot = await window.generarBackupJSON();
      snapshot._meta.nouCursInici = cursNou;
      snapshot._meta.cursArxivat  = cursAntic;
      window.descarregarBackup(snapshot);
      log(`Còpia de seguretat descarregada (${cursAntic})`, true);
    } catch(e) {
      log(`Error generant backup: ${e.message}`, false);
      window.mostrarToast('❌ Error al backup. El procés s\'ha aturat.', 5000);
      _ncReactivar(body);
      return;
    }
    setBar(25);

    // ── PAS 2: Actualitzar curs actiu ──────────────────────
    log(`Actualitzant curs actiu a ${cursNou}...`);
    await db.collection('_sistema').doc('config').set({ cursActiu: cursNou }, { merge: true });
    window._cursActiu = cursNou;
    window.fsCache?.invalidar();
    log(`Curs actiu → ${cursNou}`, true);
    setBar(30);

    // ── PAS 3: Esborrar classes i alumnes privats ──────────
    log('Esborrant classes i alumnes privats dels professors...');
    try {
      const classesSnap = await db.collection('classes').get();
      const alumneIds = [];
      const bClasses = db.batch();
      classesSnap.docs.forEach(d => {
        (d.data().alumnes || []).forEach(aid => alumneIds.push(aid));
        bClasses.delete(d.ref);
      });
      for (let i = 0; i < alumneIds.length; i += 400) {
        const bAl = db.batch();
        alumneIds.slice(i, i + 400).forEach(id => bAl.delete(db.collection('alumnes').doc(id)));
        await bAl.commit();
      }
      await bClasses.commit();
      log(`${classesSnap.size} classes i ${alumneIds.length} alumnes privats esborrats`, true);
    } catch(e) {
      log(`Advertència esborrant classes: ${e.message}`, false);
    }
    setBar(45);

    // ── PAS 4: Netejar camp classes[] dels professors ──────
    log('Netejant classes dels professors...');
    try {
      const profsSnap = await db.collection('professors').get();
      const bProfs = db.batch();
      profsSnap.docs.forEach(d => {
        if ((d.data().classes || []).length > 0) bProfs.update(d.ref, { classes: [] });
      });
      await bProfs.commit();
      log(`Camp classes[] netejat a ${profsSnap.size} professors`, true);
    } catch(e) {
      log(`Advertència netejant classes: ${e.message}`, false);
    }
    setBar(55);

    // ── PAS 5: Esborrar avaluacio_centre del curs antic ────
    log(`Esborrant avaluació de centre del curs ${cursAntic}...`);
    try {
      const grups = await db.collection('grups_centre').get();
      const cursDocRef = db.collection('avaluacio_centre').doc(cursAntic);
      let totalEsborrats = 0;
      for (const g of grups.docs) {
        try {
          const subSnap = await cursDocRef.collection(g.id).get();
          if (!subSnap.empty) {
            const bAv = db.batch();
            subSnap.docs.forEach(d => bAv.delete(d.ref));
            await bAv.commit();
            totalEsborrats += subSnap.size;
          }
        } catch(e) {}
      }
      try { await cursDocRef.delete(); } catch(e) {}
      log(`${totalEsborrats} registres d'avaluació esborrats`, true);
    } catch(e) {
      log(`Advertència esborrant avaluació: ${e.message}`, false);
    }
    setBar(70);

    // ── PAS 6: Resetjar rols dels professors ───────────────
    log('Resetejant rols dels professors...');
    const ROLS_PROTEGITS = ['admin', 'superadmin', 'secretaria'];
    try {
      const profsSnap = await db.collection('professors').get();
      const bRols = db.batch();
      let resetats = 0;
      profsSnap.docs.forEach(d => {
        const data = d.data();
        const rols = data.rols || [];
        const esProtegit = rols.some(r => ROLS_PROTEGITS.includes(r)) || data.isAdmin;
        if (!esProtegit) {
          bRols.update(d.ref, {
            rols: [],
            isAdmin: false,
            revisio_nivells: [],
            revisio_tot: false,
          });
          resetats++;
        }
      });
      await bRols.commit();
      log(`${resetats} professors resetejats (rols i revisió)`, true);
    } catch(e) {
      log(`Advertència resetejant rols: ${e.message}`, false);
    }
    setBar(100);

    // ── FI ─────────────────────────────────────────────────
    log(`Nou curs ${cursNou} iniciat correctament`, true);
    const btn = body.querySelector('#ncBtnIniciar');
    if (btn) {
      btn.style.background = '#059669';
      btn.style.color = '#fff';
      btn.textContent = '✅ Procés completat';
    }
    window.mostrarToast(`🎓 Nou curs ${cursNou} iniciat correctament!`, 5000);
    setTimeout(() => renderNouCurs(body), 2500);

  } catch(e) {
    log(`Error inesperat: ${e.message}`, false);
    window.mostrarToast('❌ Error inesperat. Revisa la consola.', 5000);
    console.error('nou-curs.js iniciarNouCurs:', e);
    _ncReactivar(body);
  }
}

function _ncReactivar(body) {
  const btn = body.querySelector('#ncBtnIniciar');
  if (btn) {
    btn.disabled = false;
    btn.style.cssText = `
      width:100%;padding:14px;background:#dc2626;color:#fff;border:none;
      border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;
      font-family:inherit;transition:all .2s;
    `;
    btn.textContent = '🎓 Iniciar nou curs acadèmic';
  }
  const chk = body.querySelector('#ncChkConfirma');
  if (chk) chk.disabled = false;
  const inp = body.querySelector('#ncInputNouCurs');
  if (inp) inp.disabled = false;
}

/* ══════════════════════════════════════════════════════
   HELPERS LOCALS (prefixats _nc per evitar col·lisions)
══════════════════════════════════════════════════════ */
async function _ncCarregarCursActiu() {
  if (window._cursActiu) return window._cursActiu;
  try {
    const doc = await window.db.collection('_sistema').doc('config').get();
    const curs = doc.data()?.cursActiu;
    if (curs) { window._cursActiu = curs; return curs; }
  } catch(e) {}
  const ara = new Date();
  const any = ara.getMonth() >= 8 ? ara.getFullYear() : ara.getFullYear() - 1;
  return `${any}-${String(any + 1).slice(-2)}`;
}

function _ncEsH(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
