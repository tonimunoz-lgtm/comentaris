// autoavaluacio.js — Injector d'Autoavaluació d'Alumnes

// UltraComentator / INS Matadepera
//
// FUNCIONS:
//   - Mode tutor: crear plantilles, enviar a alumnes, revisar respostes, enviar al butlletí
//   - Mode alumne: detecta rol 'alumne', oculta tota la UI, mostra el formulari pendent
//   - Secretaria: afegeix el rol 'alumne' a la llista de rols disponibles quan crea usuaris
//
// COLLECTIONS FIREBASE:
//   autoaval_plantilles/{tutorUID}_{classId}   → plantilla de preguntes
//   autoaval_pendents/{alumneUID}              → formulari pendent per a l'alumne
//   autoaval_respostes/{docId}                 → respostes enviades (llegides pel tutor)
//
// INSTALACIÓ: afegir a index.html ABANS de </body>:
//   <script type="module" src="autoavaluacio.js"></script>

console.log('📝 autoavaluacio.js carregat');

// ─────────────────────────────────────────────
// ESTAT GLOBAL
// ─────────────────────────────────────────────
let _aaDB   = null;
let _aaUID  = null;
let _aaRol  = null;   // 'alumne' | 'tutor' | 'professor' | etc.
let _aaUser = null;   // doc de Firestore (professors/{uid})

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function esH(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function aaToast(msg, ms = 3500) {
  if (window.mostrarToast) { window.mostrarToast(msg, ms); return; }
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:#1e1b4b;color:#fff;padding:10px 20px;border-radius:99px;font-size:13px;font-weight:600;z-index:999999;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function aaOverlay(id) {
  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:16px;';
  return el;
}

function aaModal(contingut, maxW = '640px') {
  return `<div style="background:#fff;border-radius:20px;width:100%;max-width:${maxW};max-height:90vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,0.3);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${contingut}</div>`;
}

function aaHeader(icon, titol, subtitol, color = '#7c3aed') {
  return `<div style="background:${color};padding:20px 24px;border-radius:20px 20px 0 0;color:#fff;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:18px;font-weight:800;">${icon} ${esH(titol)}</div>
        ${subtitol ? `<div style="opacity:.8;font-size:12px;margin-top:2px;">${esH(subtitol)}</div>` : ''}
      </div>
      <button class="aa-close-btn" style="background:none;border:none;color:#fff;font-size:24px;cursor:pointer;line-height:1;opacity:.8;">✕</button>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
// INICIALITZACIÓ
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initAutoavaluacio, 1200);
});

async function initAutoavaluacio() {
  const tryInit = () => {
    if (!window.firebase?.auth || !window.db) { setTimeout(tryInit, 400); return; }

    _aaDB = window.db;

    window.firebase.auth().onAuthStateChanged(async user => {
      if (!user) return;
      _aaUID = user.uid;

      // Llegir perfil
      try {
        const doc = await _aaDB.collection('professors').doc(user.uid).get();
        _aaUser = doc.exists ? { id: doc.id, ...doc.data() } : null;
        const rols = _aaUser?.rols || [];
        _aaRol = rols.includes('alumne') ? 'alumne' : (rols[0] || 'professor');
      } catch(e) { console.warn('autoavaluacio: error carregant perfil', e); }

      if (_aaRol === 'alumne') {
        await activarModeAlumne();
      } else {
        // Mode professor/tutor: injectar botó al panell tutoria
        injectarBotoAutoavalTutor();
        // Patch secretaria: afegir rol alumne
        patchSecretariaRols();
      }
    });
  };
  tryInit();
}

// ═════════════════════════════════════════════════════════
//  MODE ALUMNE — oculta tota la UI i mostra el formulari
// ═════════════════════════════════════════════════════════
async function activarModeAlumne() {
  // Esperar que la UI estigui llesta
  await new Promise(r => setTimeout(r, 600));

  // Ocultar tota l'aplicació
  const appRoot = document.getElementById('appRoot');
  if (appRoot) appRoot.style.display = 'none';

  // Ocultar login per si de cas
  const loginScreen = document.getElementById('loginScreen');
  if (loginScreen) loginScreen.style.display = 'none';

  // Mostrar pantalla d'alumne
  mostrarPantallaAlumne();
}

async function mostrarPantallaAlumne() {
  document.getElementById('aaAlumneScreen')?.remove();

  const screen = document.createElement('div');
  screen.id = 'aaAlumneScreen';
  screen.style.cssText = 'position:fixed;inset:0;background:#f5f3ff;display:flex;flex-direction:column;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';

  screen.innerHTML = `
    <div style="background:linear-gradient(135deg,#7c3aed,#4c1d95);padding:20px 24px;color:#fff;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:20px;font-weight:800;">📝 Autoavaluació</div>
        <div style="font-size:13px;opacity:.8;">${esH(_aaUser?.nom || 'Alumne/a')}</div>
      </div>
      <button id="btnAlumneSortir" style="background:rgba(255,255,255,0.15);border:none;color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Tancar sessió</button>
    </div>
    <div id="aaAlumneContingut" style="flex:1;overflow-y:auto;padding:24px;max-width:720px;width:100%;margin:0 auto;">
      <div style="text-align:center;padding:40px;color:#6b7280;">⏳ Carregant...</div>
    </div>
  `;

  document.body.appendChild(screen);

  document.getElementById('btnAlumneSortir').addEventListener('click', async () => {
    if (!confirm('Vols tancar la sessió?')) return;
    await window.firebase.auth().signOut();
    window.location.reload();
  });

  await carregarFormulariAlumne();
}

async function carregarFormulariAlumne() {
  const cont = document.getElementById('aaAlumneContingut');

  try {
    // Buscar formulari pendent per a aquest alumne
    const pendentDoc = await _aaDB.collection('autoaval_pendents').doc(_aaUID).get();

    if (!pendentDoc.exists || pendentDoc.data().estat === 'enviat') {
      cont.innerHTML = `
        <div style="text-align:center;padding:60px 20px;">
          <div style="font-size:64px;margin-bottom:16px;">${pendentDoc.exists && pendentDoc.data().estat === 'enviat' ? '✅' : '📭'}</div>
          <h2 style="font-size:20px;font-weight:700;color:#1e1b4b;margin:0 0 8px;">
            ${pendentDoc.exists && pendentDoc.data().estat === 'enviat' ? 'Ja has enviat l\'autoavaluació' : 'Cap formulari pendent'}
          </h2>
          <p style="color:#6b7280;font-size:14px;">
            ${pendentDoc.exists && pendentDoc.data().estat === 'enviat'
              ? 'El teu tutor/a ja ha rebut les teves respostes. Gràcies!'
              : 'El teu tutor/a encara no t\'ha enviat cap formulari d\'autoavaluació.'}
          </p>
        </div>`;
      return;
    }

    const pendent = pendentDoc.data();

    // Carregar la plantilla
    const plantillaDoc = await _aaDB.collection('autoaval_plantilles').doc(pendent.plantillaId).get();
    if (!plantillaDoc.exists) {
      cont.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;">❌ Error: plantilla no trobada.</div>';
      return;
    }

    const plantilla = plantillaDoc.data();
    renderitzarFormulariAlumne(cont, plantilla, pendent);

  } catch(e) {
    console.error('autoavaluacio: error carregant formulari alumne', e);
    cont.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444;">❌ Error: ${e.message}</div>`;
  }
}

function renderitzarFormulariAlumne(cont, plantilla, pendent) {
  const preguntes = plantilla.preguntes || [];

  cont.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;box-shadow:0 4px 20px rgba(0,0,0,0.08);margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <div style="width:48px;height:48px;background:linear-gradient(135deg,#7c3aed,#4c1d95);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;">📝</div>
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:800;color:#1e1b4b;">${esH(plantilla.titol || 'Autoavaluació')}</h2>
          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Respon totes les preguntes amb sinceritat. Les respostes les veurà el teu tutor/a.</p>
        </div>
      </div>

      ${preguntes.length === 0
        ? '<p style="color:#9ca3af;font-style:italic;">Aquesta plantilla no té preguntes configurades.</p>'
        : preguntes.map((p, i) => `
          <div style="margin-bottom:24px;">
            <label style="display:block;font-size:14px;font-weight:700;color:#374151;margin-bottom:8px;">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background:#7c3aed;color:#fff;border-radius:50%;font-size:11px;font-weight:800;margin-right:8px;">${i+1}</span>
              ${esH(p.text)}
            </label>
            <textarea
              data-pregunta-id="${esH(p.id)}"
              placeholder="Escriu la teva resposta aquí..."
              rows="4"
              style="width:100%;box-sizing:border-box;padding:12px;border:2px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;resize:vertical;outline:none;transition:border-color .2s;"
              onfocus="this.style.borderColor='#7c3aed'"
              onblur="this.style.borderColor='#e5e7eb'"
            ></textarea>
          </div>
        `).join('')}

      <div id="aaAlumneErr" style="color:#ef4444;font-size:13px;min-height:18px;margin-bottom:10px;"></div>
      <button id="btnEnviarAutoaval" style="width:100%;padding:14px;background:linear-gradient(135deg,#7c3aed,#4c1d95);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;letter-spacing:.02em;">
        📤 Enviar autoavaluació
      </button>
    </div>
  `;

  document.getElementById('btnEnviarAutoaval').addEventListener('click', () =>
    enviarRespostesAlumne(pendent, plantilla)
  );
}

async function enviarRespostesAlumne(pendent, plantilla) {
  const btn = document.getElementById('btnEnviarAutoaval');
  const errEl = document.getElementById('aaAlumneErr');
  errEl.textContent = '';

  // Recollir respostes
  const respostes = {};
  let alguBuit = false;
  document.querySelectorAll('[data-pregunta-id]').forEach(ta => {
    const val = ta.value.trim();
    if (!val) alguBuit = true;
    respostes[ta.dataset.preguntaId] = val;
  });

  if (alguBuit) {
    errEl.textContent = '⚠️ Si us plau, respon totes les preguntes.';
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Enviant...';

  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const docId = `${_aaUID}_${pendent.plantillaId}`;

    // Guardar respostes
    await _aaDB.collection('autoaval_respostes').doc(docId).set({
      alumneUID:  _aaUID,
      alumneNom:  _aaUser?.nom || '',
      tutorUID:   pendent.tutorUID,
      classId:    pendent.classId,
      plantillaId: pendent.plantillaId,
      plantillaTitol: plantilla.titol || '',
      preguntes:  plantilla.preguntes || [],
      respostes,
      estat:      'rebut',   // rebut → revisat → enviatButlleti
      enviatAt:   now,
    });

    // Marcar pendent com a enviat
    await _aaDB.collection('autoaval_pendents').doc(_aaUID).update({
      estat: 'enviat',
      enviatAt: now,
    });

    // Refrescar pantalla
    await carregarFormulariAlumne();
    aaToast('✅ Autoavaluació enviada correctament!');

  } catch(e) {
    console.error('autoavaluacio: error enviant respostes', e);
    errEl.textContent = '❌ Error enviant: ' + e.message;
    btn.disabled = false;
    btn.textContent = '📤 Enviar autoavaluació';
  }
}

// ═════════════════════════════════════════════════════════
//  MODE TUTOR — botó i panell
// ═════════════════════════════════════════════════════════
function injectarBotoAutoavalTutor() {
  if (document.getElementById('btnAutoavalTutor')) return;

  // Esperar que el botó de tutoria existeixi
  const tryInject = () => {
    const btnTutoriaNova = document.getElementById('btnTutoriaNova') ||
                          document.querySelector('[id*="tutoria"]');

    // Injectar al sidebar si existeix el nav
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) { setTimeout(tryInject, 600); return; }

    // Injectar com a botó al sidebar (visible per tutors i admin)
    if (!window.teRol || !window.teRol('tutor')) {
      // Tornar a intentar quan els rols estiguin carregats
      setTimeout(tryInject, 1000);
      return;
    }

    const btn = document.createElement('button');
    btn.id = 'btnAutoavalTutor';
    btn.className = 'nav-item nav-item-rol';
    btn.innerHTML = '<span class="nav-icon">📝</span><span>Autoavaluació</span>';
    btn.title = 'Gestionar autoavaluacions d\'alumnes';
    btn.addEventListener('click', obrirPanellAutoaval);
    nav.appendChild(btn);
    console.log('✅ Botó Autoavaluació injectat al sidebar');
  };

  setTimeout(tryInject, 1500);
}

// ─────────────────────────────────────────────
// PANELL PRINCIPAL DEL TUTOR
// ─────────────────────────────────────────────
async function obrirPanellAutoaval() {
  document.getElementById('aaPanel')?.remove();

  const overlay = aaOverlay('aaPanel');
  overlay.innerHTML = aaModal(`
    ${aaHeader('📝', 'Autoavaluació d\'alumnes', 'Crea plantilles, envia als alumnes i revisa respostes', '#7c3aed')}
    <div style="padding:24px;">

      <!-- TABS -->
      <div style="display:flex;gap:4px;background:#f3f4f6;border-radius:12px;padding:4px;margin-bottom:24px;">
        <button class="aa-tab aa-tab-active" data-tab="plantilles" style="flex:1;padding:9px;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;background:#7c3aed;color:#fff;">
          🗂 Plantilles
        </button>
        <button class="aa-tab" data-tab="enviaments" style="flex:1;padding:9px;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;background:transparent;color:#6b7280;">
          📤 Enviaments
        </button>
        <button class="aa-tab" data-tab="respostes" style="flex:1;padding:9px;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;background:transparent;color:#6b7280;">
          📥 Respostes
        </button>
      </div>

      <!-- CONTINGUTS TABS -->
      <div id="aaTabPlantilles">
        <div style="text-align:center;padding:30px;color:#9ca3af;">⏳ Carregant...</div>
      </div>
      <div id="aaTabEnviaments" style="display:none;">
        <div style="text-align:center;padding:30px;color:#9ca3af;">⏳ Carregant...</div>
      </div>
      <div id="aaTabRespostes" style="display:none;">
        <div style="text-align:center;padding:30px;color:#9ca3af;">⏳ Carregant...</div>
      </div>

    </div>
  `, '760px');

  document.body.appendChild(overlay);

  // Tancar
  overlay.querySelector('.aa-close-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Tabs
  overlay.querySelectorAll('.aa-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.aa-tab').forEach(b => {
        b.style.background = 'transparent'; b.style.color = '#6b7280';
      });
      btn.style.background = '#7c3aed'; btn.style.color = '#fff';
      overlay.querySelectorAll('[id^="aaTab"]').forEach(t => t.style.display = 'none');
      document.getElementById('aaTab' + capitalitza(btn.dataset.tab)).style.display = 'block';
      if (btn.dataset.tab === 'plantilles')  carregarTabPlantilles();
      if (btn.dataset.tab === 'enviaments')  carregarTabEnviaments();
      if (btn.dataset.tab === 'respostes')   carregarTabRespostes();
    });
  });

  // Carregar tab inicial
  await carregarTabPlantilles();
}

function capitalitza(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ─────────────────────────────────────────────
// TAB: PLANTILLES
// ─────────────────────────────────────────────
async function carregarTabPlantilles() {
  const cont = document.getElementById('aaTabPlantilles');
  cont.innerHTML = '<div style="text-align:center;padding:30px;color:#9ca3af;">⏳ Carregant plantilles...</div>';

  try {
    const snap = await _aaDB.collection('autoaval_plantilles')
      .where('tutorUID', '==', _aaUID)

      .get();

    const plantilles = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

    cont.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-size:14px;color:#6b7280;">${plantilles.length} plantilla${plantilles.length !== 1 ? 'es' : ''}</div>
        <button id="btnNovaPlantilla" style="padding:9px 18px;background:#7c3aed;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">
          + Nova plantilla
        </button>
      </div>
      <div id="llistaPlantilles">
        ${plantilles.length === 0
          ? `<div style="text-align:center;padding:40px;background:#f9fafb;border-radius:12px;border:2px dashed #e5e7eb;">
              <div style="font-size:40px;margin-bottom:12px;">🗂</div>
              <p style="color:#9ca3af;font-size:14px;margin:0;">Encara no has creat cap plantilla.<br>Clica "Nova plantilla" per començar.</p>
            </div>`
          : plantilles.map(p => renderPlantillaCard(p)).join('')
        }
      </div>
    `;

    document.getElementById('btnNovaPlantilla').addEventListener('click', () => obrirEditorPlantilla());

    cont.querySelectorAll('.btn-editar-plantilla').forEach(btn => {
      btn.addEventListener('click', () => obrirEditorPlantilla(btn.dataset.id));
    });
    cont.querySelectorAll('.btn-enviar-plantilla').forEach(btn => {
      btn.addEventListener('click', () => obrirModalEnviarPlantilla(btn.dataset.id, btn.dataset.titol));
    });
    cont.querySelectorAll('.btn-eliminar-plantilla').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Eliminar la plantilla "${btn.dataset.titol}"?`)) return;
        await _aaDB.collection('autoaval_plantilles').doc(btn.dataset.id).delete();
        aaToast('🗑 Plantilla eliminada');
        carregarTabPlantilles();
      });
    });

  } catch(e) {
    cont.innerHTML = `<div style="color:#ef4444;padding:20px;">❌ ${e.message}</div>`;
  }
}

function renderPlantillaCard(p) {
  const preguntes = p.preguntes || [];
  const data = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('ca') : '—';
  return `
    <div style="border:2px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:15px;font-weight:700;color:#1e1b4b;margin-bottom:4px;">${esH(p.titol || '(sense títol)')}</div>
        <div style="font-size:12px;color:#9ca3af;">${preguntes.length} pregunta${preguntes.length !== 1 ? 'es' : ''} · Creada el ${data}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="btn-editar-plantilla" data-id="${p.id}" data-titol="${esH(p.titol)}"
          style="padding:7px 12px;background:#f3f4f6;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">✏️ Editar</button>
        <button class="btn-enviar-plantilla" data-id="${p.id}" data-titol="${esH(p.titol)}"
          style="padding:7px 12px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">📤 Enviar</button>
        <button class="btn-eliminar-plantilla" data-id="${p.id}" data-titol="${esH(p.titol)}"
          style="padding:7px 12px;background:#fef2f2;color:#ef4444;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">🗑</button>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────
// EDITOR DE PLANTILLA
// ─────────────────────────────────────────────
async function obrirEditorPlantilla(plantillaId = null) {
  let plantillaActual = { titol: '', preguntes: [] };

  if (plantillaId) {
    try {
      const doc = await _aaDB.collection('autoaval_plantilles').doc(plantillaId).get();
      if (doc.exists) plantillaActual = { id: doc.id, ...doc.data() };
    } catch(e) { console.warn(e); }
  }

  document.getElementById('aaEditorPlantilla')?.remove();

  const overlay = aaOverlay('aaEditorPlantilla');
  overlay.innerHTML = aaModal(`
    ${aaHeader('✏️', plantillaId ? 'Editar plantilla' : 'Nova plantilla', 'Configura el formulari d\'autoavaluació', '#4c1d95')}
    <div style="padding:24px;">
      <div style="margin-bottom:18px;">
        <label style="font-size:12px;font-weight:700;color:#6b7280;display:block;margin-bottom:6px;">TÍTOL DE LA PLANTILLA</label>
        <input id="aaTitolPlantilla" type="text" value="${esH(plantillaActual.titol)}"
          placeholder="Ex: Autoavaluació 1r trimestre"
          style="width:100%;box-sizing:border-box;padding:11px 14px;border:2px solid #e5e7eb;border-radius:10px;font-size:14px;font-weight:600;outline:none;transition:border-color .2s;"
          onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e5e7eb'">
      </div>

      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <label style="font-size:12px;font-weight:700;color:#6b7280;">PREGUNTES</label>
          <button id="btnAfegirPregunta"
            style="padding:7px 14px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
            + Afegir pregunta
          </button>
        </div>
        <div id="llista-preguntes-editor">
          <!-- Preguntes renderitzades dinàmicament -->
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:20px;">
        <button id="btnCancelEditorP" style="flex:1;padding:11px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Cancel·lar</button>
        <button id="btnGuardarPlantilla" style="flex:1;padding:11px;background:#7c3aed;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;">💾 Guardar plantilla</button>
      </div>
    </div>
  `, '640px');

  document.body.appendChild(overlay);

  let preguntes = (plantillaActual.preguntes || []).map(p => ({ ...p }));

  function renderPreguntes() {
    const cont = document.getElementById('llista-preguntes-editor');
    if (preguntes.length === 0) {
      cont.innerHTML = `<div style="text-align:center;padding:30px;background:#f9fafb;border-radius:10px;border:2px dashed #e5e7eb;color:#9ca3af;font-size:13px;">
        Clica "+ Afegir pregunta" per crear la primera pregunta.
      </div>`;
      return;
    }
    cont.innerHTML = preguntes.map((p, i) => `
      <div style="border:2px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:10px;background:#fafafa;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:700;color:#7c3aed;background:#ede9fe;padding:3px 8px;border-radius:6px;">Pregunta ${i+1}</span>
          <button class="btn-del-preg" data-idx="${i}"
            style="background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;line-height:1;">×</button>
        </div>
        <textarea class="editor-preg-text" data-idx="${i}" rows="3"
          placeholder="Escriu aquí el text de la pregunta..."
          style="width:100%;box-sizing:border-box;padding:10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;outline:none;">${esH(p.text || '')}</textarea>
      </div>
    `).join('');

    cont.querySelectorAll('.btn-del-preg').forEach(btn => {
      btn.addEventListener('click', () => {
        preguntes.splice(parseInt(btn.dataset.idx), 1);
        renderPreguntes();
      });
    });
    cont.querySelectorAll('.editor-preg-text').forEach(ta => {
      ta.addEventListener('input', () => {
        preguntes[parseInt(ta.dataset.idx)].text = ta.value;
      });
    });
  }

  renderPreguntes();

  document.getElementById('btnAfegirPregunta').addEventListener('click', () => {
    preguntes.push({ id: 'p_' + Date.now(), text: '', tipus: 'text_llarg' });
    renderPreguntes();
    // Scroll a la nova pregunta
    const cont = document.getElementById('llista-preguntes-editor');
    cont.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  document.getElementById('btnCancelEditorP').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.aa-close-btn').addEventListener('click', () => overlay.remove());

  document.getElementById('btnGuardarPlantilla').addEventListener('click', async () => {
    const titol = document.getElementById('aaTitolPlantilla').value.trim();
    if (!titol) { aaToast('⚠️ Cal un títol per a la plantilla'); return; }
    if (preguntes.length === 0) { aaToast('⚠️ Afegeix almenys una pregunta'); return; }

    // Llegir textos actuals dels textareas (per si no han disparat input)
    document.querySelectorAll('.editor-preg-text').forEach(ta => {
      preguntes[parseInt(ta.dataset.idx)].text = ta.value;
    });

    const buides = preguntes.filter(p => !p.text.trim());
    if (buides.length > 0) { aaToast('⚠️ Totes les preguntes han de tenir text'); return; }

    const btn = document.getElementById('btnGuardarPlantilla');
    btn.disabled = true; btn.textContent = '⏳ Guardant...';

    try {
      const dades = {
        titol,
        preguntes,
        tutorUID: _aaUID,
        tutorNom: _aaUser?.nom || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (plantillaId) {
        await _aaDB.collection('autoaval_plantilles').doc(plantillaId).update(dades);
        aaToast('✅ Plantilla actualitzada');
      } else {
        dades.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await _aaDB.collection('autoaval_plantilles').add(dades);
        aaToast('✅ Plantilla creada');
      }

      overlay.remove();
      carregarTabPlantilles();
    } catch(e) {
      aaToast('❌ Error guardant: ' + e.message);
      btn.disabled = false;
      btn.textContent = '💾 Guardar plantilla';
    }
  });
}

// ─────────────────────────────────────────────
// MODAL ENVIAR PLANTILLA A ALUMNES
// ─────────────────────────────────────────────
async function obrirModalEnviarPlantilla(plantillaId, plantillaTitol) {
  document.getElementById('aaModalEnviar')?.remove();

  const overlay = aaOverlay('aaModalEnviar');
  overlay.innerHTML = aaModal(`
    ${aaHeader('📤', 'Enviar als alumnes', `Plantilla: ${plantillaTitol}`, '#059669')}
    <div style="padding:24px;">
      <div style="margin-bottom:18px;">
        <label style="font-size:12px;font-weight:700;color:#6b7280;display:block;margin-bottom:8px;">SELECCIONA EL GRUP CLASSE DE TUTORIA</label>
        <select id="aaSelectGrup" style="width:100%;padding:11px 14px;border:2px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;background:#f9fafb;">
          <option value="">⏳ Carregant grups...</option>
        </select>
      </div>

      <div id="aaLlistaAlumnesEnviar" style="display:none;margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <label style="font-size:12px;font-weight:700;color:#6b7280;">SELECCIONA ELS ALUMNES</label>
          <div style="display:flex;gap:6px;">
            <button id="btnSelectTots" style="padding:5px 10px;background:#f3f4f6;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">Tots</button>
            <button id="btnDeselectTots" style="padding:5px 10px;background:#f3f4f6;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">Cap</button>
          </div>
        </div>
        <div id="aaCheckboxAlumnes" style="max-height:280px;overflow-y:auto;border:2px solid #e5e7eb;border-radius:10px;padding:8px;"></div>
      </div>

      <div id="aaEnviarInfo" style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:12px;margin-bottom:16px;font-size:13px;color:#166534;display:none;">
        📌 Els alumnes que ja han respost NO rebran el formulari de nou.
      </div>

      <div id="aaEnviarErr" style="color:#ef4444;font-size:13px;min-height:16px;margin-bottom:10px;"></div>
      <div style="display:flex;gap:10px;">
        <button id="btnCancelEnviar" style="flex:1;padding:11px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Cancel·lar</button>
        <button id="btnConfirmarEnviar" style="flex:1;padding:11px;background:#059669;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;" disabled>📤 Enviar</button>
      </div>
    </div>
  `, '560px');

  document.body.appendChild(overlay);

  overlay.querySelector('.aa-close-btn').addEventListener('click', () => overlay.remove());
  document.getElementById('btnCancelEnviar').addEventListener('click', () => overlay.remove());

  // Carregar grups de tutoria on el tutor és responsable
  try {
    const snap = await _aaDB.collection('grups_centre')
      .where('tipus', '==', 'classe')
      .orderBy('nom')
      .get();

    const grups = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const sel = document.getElementById('aaSelectGrup');
    sel.innerHTML = '<option value="">— Selecciona un grup —</option>' +
      grups.map(g => `<option value="${g.id}">${esH(g.nivellNom || '')} - ${esH(g.nom)} (${g.curs || ''})</option>`).join('');

    sel.addEventListener('change', () => carregarAlumnesGrup(sel.value));

  } catch(e) {
    document.getElementById('aaSelectGrup').innerHTML = `<option>Error: ${e.message}</option>`;
  }

  document.getElementById('btnSelectTots').addEventListener('click', () => {
    document.querySelectorAll('#aaCheckboxAlumnes input[type=checkbox]').forEach(c => c.checked = true);
  });
  document.getElementById('btnDeselectTots').addEventListener('click', () => {
    document.querySelectorAll('#aaCheckboxAlumnes input[type=checkbox]').forEach(c => c.checked = false);
  });

  document.getElementById('btnConfirmarEnviar').addEventListener('click', () =>
    confirmarEnviamentAlumnes(plantillaId, plantillaTitol)
  );

  async function carregarAlumnesGrup(grupId) {
    if (!grupId) {
      document.getElementById('aaLlistaAlumnesEnviar').style.display = 'none';
      document.getElementById('btnConfirmarEnviar').disabled = true;
      return;
    }

    const checkCont = document.getElementById('aaCheckboxAlumnes');
    checkCont.innerHTML = '<div style="padding:10px;color:#9ca3af;font-size:13px;">⏳ Carregant alumnes...</div>';
    document.getElementById('aaLlistaAlumnesEnviar').style.display = 'block';
    document.getElementById('aaEnviarInfo').style.display = 'block';

    try {
      // Llegir alumnes del grup des de grups_centre
      const grupDoc = await _aaDB.collection('grups_centre').doc(grupId).get();
      const alumnesGrup = grupDoc.data()?.alumnes || [];

      // Buscar els que tenen compte d'alumne a Firestore
      // (usuaris amb rol 'alumne' que tinguin el RALC al grup)
      const alumnesSnap = await _aaDB.collection('professors')
        .where('rols', 'array-contains', 'alumne')
        .get();

      const alumnesUsuaris = alumnesSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

      // Creuar: alumne de la llista del grup que té compte
      const alumnesMostrar = alumnesUsuaris.filter(u =>
        alumnesGrup.some(a =>
          (a.ralc && a.ralc === u.ralc) ||
          (a.email && a.email === u.email) ||
          (a.nom && (u.nom || '').toLowerCase().includes(a.nom.toLowerCase()))
        )
      );

      // Tots els alumnes del grup (tinguin o no compte)
      const totAlumnesGrup = alumnesGrup.map(a => {
        const compte = alumnesUsuaris.find(u =>
          (a.ralc && a.ralc === u.ralc) ||
          (a.email && a.email === u.email)
        );
        return { ...a, uid: compte?.uid || null, teCom: !!compte };
      });

      if (totAlumnesGrup.length === 0) {
        checkCont.innerHTML = '<div style="padding:16px;text-align:center;color:#9ca3af;font-size:13px;">Cap alumne trobat en aquest grup.</div>';
        document.getElementById('btnConfirmarEnviar').disabled = true;
        return;
      }

      const ambCompte = totAlumnesGrup.filter(a => a.teCom);
      document.getElementById('btnConfirmarEnviar').disabled = ambCompte.length === 0;

      checkCont.innerHTML = totAlumnesGrup.map(a => `
        <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:${a.teCom ? 'pointer' : 'default'};
          ${!a.teCom ? 'opacity:.4;' : ''}
          transition:background .15s;"
          ${a.teCom ? 'onmouseenter="this.style.background=\'#f5f3ff\'" onmouseleave="this.style.background=\'\'"' : ''}>
          <input type="checkbox" class="chk-alumne-enviar" data-uid="${a.uid || ''}"
            ${!a.teCom ? 'disabled' : 'checked'}
            style="width:16px;height:16px;accent-color:#7c3aed;">
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;color:#374151;">${esH((a.nom || '') + ' ' + (a.cognoms || ''))}</div>
            ${!a.teCom ? '<div style="font-size:11px;color:#9ca3af;">Sense compte d\'usuari</div>' : ''}
          </div>
        </label>
      `).join('');

    } catch(e) {
      checkCont.innerHTML = `<div style="color:#ef4444;padding:12px;font-size:13px;">❌ Error: ${e.message}</div>`;
    }
  }

  async function confirmarEnviamentAlumnes(plantillaId, plantillaTitol) {
    const grupId = document.getElementById('aaSelectGrup').value;
    const errEl = document.getElementById('aaEnviarErr');
    errEl.textContent = '';

    const alumnesSeleccionats = [...document.querySelectorAll('.chk-alumne-enviar:checked')]
      .map(c => c.dataset.uid).filter(Boolean);

    if (alumnesSeleccionats.length === 0) {
      errEl.textContent = '⚠️ Selecciona almenys un alumne.';
      return;
    }

    const btn = document.getElementById('btnConfirmarEnviar');
    btn.disabled = true;
    btn.textContent = '⏳ Enviant...';

    try {
      const batch = _aaDB.batch();
      const now = firebase.firestore.FieldValue.serverTimestamp();
      let enviats = 0;

      for (const uid of alumnesSeleccionats) {
        // Comprovar si ja té un pendent actiu (no enviat)
        const pendentRef = _aaDB.collection('autoaval_pendents').doc(uid);
        const pendentDoc = await pendentRef.get();

        if (pendentDoc.exists && pendentDoc.data().estat !== 'enviat') {
          // Ja té un formulari pendent, saltar
          continue;
        }

        batch.set(pendentRef, {
          alumneUID: uid,
          tutorUID:  _aaUID,
          tutorNom:  _aaUser?.nom || '',
          classId:   grupId,
          plantillaId,
          plantillaTitol,
          estat:     'pendent',
          enviatAt:  now,
        });
        enviats++;
      }

      await batch.commit();
      aaToast(`✅ Formulari enviat a ${enviats} alumne${enviats !== 1 ? 's' : ''}`);
      overlay.remove();
      carregarTabEnviaments();

    } catch(e) {
      errEl.textContent = '❌ Error: ' + e.message;
      btn.disabled = false;
      btn.textContent = '📤 Enviar';
    }
  }
}

// ─────────────────────────────────────────────
// TAB: ENVIAMENTS
// ─────────────────────────────────────────────
async function carregarTabEnviaments() {
  const cont = document.getElementById('aaTabEnviaments');
  cont.innerHTML = '<div style="text-align:center;padding:30px;color:#9ca3af;">⏳ Carregant enviaments...</div>';

  try {
    const snap = await _aaDB.collection('autoaval_pendents')
      .where('tutorUID', '==', _aaUID)

      .get();

    const pendents = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.enviatAt?.seconds||0) - (a.enviatAt?.seconds||0));

    if (pendents.length === 0) {
      cont.innerHTML = `<div style="text-align:center;padding:40px;background:#f9fafb;border-radius:12px;border:2px dashed #e5e7eb;">
        <div style="font-size:40px;margin-bottom:12px;">📤</div>
        <p style="color:#9ca3af;font-size:14px;margin:0;">Encara no has enviat cap formulari als alumnes.</p>
      </div>`;
      return;
    }

    // Carregar noms dels alumnes
    const uids = [...new Set(pendents.map(p => p.alumneUID))];
    const alumnesDocs = {};
    for (const uid of uids) {
      try {
        const d = await _aaDB.collection('professors').doc(uid).get();
        if (d.exists) alumnesDocs[uid] = d.data();
      } catch(e) {}
    }

    const estatBadge = {
      pendent: '<span style="background:#fef3c7;color:#92400e;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;">⏳ Pendent</span>',
      enviat:  '<span style="background:#dcfce7;color:#166534;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;">✅ Enviat</span>',
    };

    cont.innerHTML = `
      <div style="font-size:14px;color:#6b7280;margin-bottom:12px;">${pendents.length} formulari${pendents.length !== 1 ? 's' : ''} enviats</div>
      ${pendents.map(p => {
        const nomAlumne = alumnesDocs[p.alumneUID]?.nom || p.alumneUID;
        const data = p.enviatAt?.toDate ? p.enviatAt.toDate().toLocaleDateString('ca') : '—';
        return `
          <div style="border:2px solid #e5e7eb;border-radius:12px;padding:14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
            <div>
              <div style="font-size:14px;font-weight:700;color:#1e1b4b;">${esH(nomAlumne)}</div>
              <div style="font-size:12px;color:#9ca3af;margin-top:2px;">📋 ${esH(p.plantillaTitol || p.plantillaId)} · ${data}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              ${estatBadge[p.estat] || ''}
              ${p.estat === 'pendent' ? `
                <button class="btn-cancel-enviament" data-id="${p.id}" data-nom="${esH(nomAlumne)}"
                  style="padding:6px 10px;background:#fef2f2;color:#ef4444;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;">
                  Revocar
                </button>` : ''}
            </div>
          </div>`;
      }).join('')}
    `;

    cont.querySelectorAll('.btn-cancel-enviament').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Revocar el formulari de ${btn.dataset.nom}? L'alumne deixarà de veure'l.`)) return;
        await _aaDB.collection('autoaval_pendents').doc(btn.dataset.id).delete();
        aaToast('🗑 Formulari revocat');
        carregarTabEnviaments();
      });
    });

  } catch(e) {
    cont.innerHTML = `<div style="color:#ef4444;padding:20px;">❌ ${e.message}</div>`;
  }
}

// ─────────────────────────────────────────────
// TAB: RESPOSTES REBUDES
// ─────────────────────────────────────────────
async function carregarTabRespostes() {
  const cont = document.getElementById('aaTabRespostes');
  cont.innerHTML = '<div style="text-align:center;padding:30px;color:#9ca3af;">⏳ Carregant respostes...</div>';

  try {
    const snap = await _aaDB.collection('autoaval_respostes')
      .where('tutorUID', '==', _aaUID)

      .get();

    const respostes = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.enviatAt?.seconds||0) - (a.enviatAt?.seconds||0));

    if (respostes.length === 0) {
      cont.innerHTML = `<div style="text-align:center;padding:40px;background:#f9fafb;border-radius:12px;border:2px dashed #e5e7eb;">
        <div style="font-size:40px;margin-bottom:12px;">📥</div>
        <p style="color:#9ca3af;font-size:14px;margin:0;">Encara no has rebut cap resposta d'alumne.</p>
      </div>`;
      return;
    }

    const estatBadge = {
      rebut:          '<span style="background:#dbeafe;color:#1e40af;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;">📥 Rebut</span>',
      revisat:        '<span style="background:#fef9c3;color:#713f12;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;">👁 Revisat</span>',
      enviatButlleti: '<span style="background:#dcfce7;color:#166534;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;">✅ Al butlletí</span>',
    };

    cont.innerHTML = `
      <div style="font-size:14px;color:#6b7280;margin-bottom:12px;">${respostes.length} resposta${respostes.length !== 1 ? 'es' : ''} rebudes</div>
      ${respostes.map(r => {
        const data = r.enviatAt?.toDate ? r.enviatAt.toDate().toLocaleDateString('ca') : '—';
        return `
          <div style="border:2px solid #e5e7eb;border-radius:12px;padding:14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
            <div>
              <div style="font-size:14px;font-weight:700;color:#1e1b4b;">${esH(r.alumneNom || r.alumneUID)}</div>
              <div style="font-size:12px;color:#9ca3af;margin-top:2px;">📋 ${esH(r.plantillaTitol || '')} · ${data}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              ${estatBadge[r.estat] || ''}
              <button class="btn-veure-resposta" data-id="${r.id}"
                style="padding:7px 12px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
                👁 Revisar
              </button>
            </div>
          </div>`;
      }).join('')}
    `;

    cont.querySelectorAll('.btn-veure-resposta').forEach(btn => {
      btn.addEventListener('click', async () => {
        const resposta = respostes.find(r => r.id === btn.dataset.id);
        if (resposta) await obrirModalRespostaAlumne(resposta);
      });
    });

  } catch(e) {
    cont.innerHTML = `<div style="color:#ef4444;padding:20px;">❌ ${e.message}</div>`;
  }
}

// ─────────────────────────────────────────────
// MODAL REVISIÓ I EDICIÓ D'UNA RESPOSTA
// ─────────────────────────────────────────────
async function obrirModalRespostaAlumne(resposta) {
  document.getElementById('aaModalResposta')?.remove();

  const preguntes = resposta.preguntes || [];
  const respostesMap = resposta.respostes || {};

  const overlay = aaOverlay('aaModalResposta');
  overlay.innerHTML = aaModal(`
    ${aaHeader('📥', resposta.alumneNom || 'Resposta alumne', resposta.plantillaTitol || '', '#1e40af')}
    <div style="padding:24px;">

      <!-- Respostes de l'alumne -->
      <div style="margin-bottom:24px;">
        <div style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em;">Respostes de l'alumne</div>
        ${preguntes.length === 0
          ? '<p style="color:#9ca3af;font-style:italic;">Sense preguntes.</p>'
          : preguntes.map((p, i) => `
            <div style="margin-bottom:16px;background:#f9fafb;border-radius:10px;padding:14px;">
              <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:8px;">
                <span style="background:#7c3aed;color:#fff;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;margin-right:8px;">${i+1}</span>
                ${esH(p.text || '')}
              </div>
              <div style="font-size:14px;color:#1e1b4b;background:#fff;border:1.5px solid #e5e7eb;border-radius:8px;padding:10px 12px;white-space:pre-wrap;line-height:1.6;">
                ${esH(respostesMap[p.id] || '—')}
              </div>
            </div>
          `).join('')}
      </div>

      <!-- Comentari del tutor -->
      <div style="margin-bottom:20px;">
        <label style="font-size:12px;font-weight:700;color:#6b7280;display:block;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">
          El teu comentari (apareixerà al butlletí com a "Comentari alumne")
        </label>
        <textarea id="aaComentariTutor" rows="5"
          placeholder="Escriu aquí el teu comentari sobre l'autoavaluació d'aquest alumne/a..."
          style="width:100%;box-sizing:border-box;padding:12px;border:2px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;resize:vertical;outline:none;transition:border-color .2s;"
          onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e5e7eb'"
        >${esH(resposta.comentariTutor || '')}</textarea>
      </div>

      <div id="aaRespostaErr" style="color:#ef4444;font-size:13px;min-height:16px;margin-bottom:10px;"></div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button id="btnTancarResposta" style="flex:1;padding:11px;background:#f3f4f6;color:#374151;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;min-width:120px;">Tancar</button>
        <button id="btnGuardarComentari" style="flex:1;padding:11px;background:#4c1d95;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;min-width:120px;">💾 Guardar comentari</button>
        <button id="btnEnviarButlleti" style="flex:1;padding:11px;background:#059669;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;min-width:140px;"
          ${resposta.estat === 'enviatButlleti' ? 'disabled style="opacity:.5;"' : ''}>
          🏫 ${resposta.estat === 'enviatButlleti' ? 'Ja enviat' : 'Enviar al butlletí'}
        </button>
      </div>
      ${resposta.estat === 'enviatButlleti'
        ? `<div style="text-align:center;font-size:12px;color:#6b7280;margin-top:10px;">✅ Ja enviat a Avaluació Centre com a "Comentari alumne"</div>`
        : ''}
    </div>
  `, '680px');

  document.body.appendChild(overlay);

  overlay.querySelector('.aa-close-btn').addEventListener('click', () => overlay.remove());
  document.getElementById('btnTancarResposta').addEventListener('click', () => overlay.remove());

  // Marcar com a revisat si era 'rebut'
  if (resposta.estat === 'rebut') {
    await _aaDB.collection('autoaval_respostes').doc(resposta.id).update({ estat: 'revisat' });
    resposta.estat = 'revisat';
  }

  // Guardar comentari
  document.getElementById('btnGuardarComentari').addEventListener('click', async () => {
    const comentari = document.getElementById('aaComentariTutor').value.trim();
    const btn = document.getElementById('btnGuardarComentari');
    btn.disabled = true; btn.textContent = '⏳ Guardant...';

    try {
      await _aaDB.collection('autoaval_respostes').doc(resposta.id).update({
        comentariTutor: comentari,
        estat: resposta.estat === 'enviatButlleti' ? 'enviatButlleti' : 'revisat',
        revisatAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      resposta.comentariTutor = comentari;
      aaToast('✅ Comentari guardat');
    } catch(e) {
      document.getElementById('aaRespostaErr').textContent = '❌ Error: ' + e.message;
    } finally {
      btn.disabled = false; btn.textContent = '💾 Guardar comentari';
    }
  });

  // Enviar al butlletí
  document.getElementById('btnEnviarButlleti').addEventListener('click', async () => {
    await enviarRespostaAlButlleti(resposta, overlay);
  });
}

// ─────────────────────────────────────────────
// ENVIAR RESPOSTA AL BUTLLETÍ (avaluacio_centre)
// ─────────────────────────────────────────────
async function enviarRespostaAlButlleti(resposta, overlay) {
  const comentari = document.getElementById('aaComentariTutor').value.trim();
  const errEl = document.getElementById('aaRespostaErr');
  errEl.textContent = '';

  const btn = document.getElementById('btnEnviarButlleti');
  btn.disabled = true;
  btn.textContent = '⏳ Enviant al butlletí...';

  try {
    // Obtenir dades bàsiques de l'alumne des de la col·lecció professors
    const alumneDoc = await _aaDB.collection('professors').doc(resposta.alumneUID).get();
    const alumne = alumneDoc.exists ? alumneDoc.data() : {};

    // Buscar les dades del grup per obtenir curs i grup
    let curs = window._cursActiu || new Date().getFullYear() + '-' + String(new Date().getFullYear()+1).slice(-2);
    let grupNom = '';
    if (resposta.classId) {
      try {
        const grupDoc = await _aaDB.collection('grups_centre').doc(resposta.classId).get();
        if (grupDoc.exists) {
          grupNom = grupDoc.data().nom || '';
          curs = grupDoc.data().curs || curs;
        }
      } catch(e) {}
    }

    // Construir text complet de les respostes + comentari tutor
    const preguntes = resposta.preguntes || [];
    const respostesMap = resposta.respostes || {};
    const textRespostes = preguntes.map((p, i) =>
      `${i+1}. ${p.text}\nResposta: ${respostesMap[p.id] || '—'}`
    ).join('\n\n');

    const comentariGlobal = comentari
      ? `${comentari}\n\n───\nAutoavaluació de l'alumne:\n${textRespostes}`
      : textRespostes;

    // ID de matèria especial: "comentari_alumne"
    const materiaId  = 'comentari_alumne';
    const materiaNom = 'Comentari alumne';

    // Buscar el període actiu (per compatibilitat amb el sistema existent)
    const periodeId  = window.currentPeriodeId || 'general';
    const periodeNom = window.currentPeriodes?.[periodeId]?.nom || periodeId;

    // Guardar a avaluació centre
    const ref = _aaDB
      .collection('avaluacio_centre')
      .doc(curs)
      .collection(materiaId)
      .doc(resposta.alumneUID);

    await ref.set({
      nom:              alumne.nom || '',
      cognoms:          alumne.cognoms || '',
      nomComplet:       (alumne.nom || '') + ' ' + (alumne.cognoms || ''),
      ralc:             alumne.ralc || '',
      grup:             grupNom,
      grupId:           resposta.classId || '',
      grupClasseId:     resposta.classId || '',
      materiaNom,
      materiaId,
      curs,
      periodeId,
      periodeNom,
      descripcioComuna: 'Autoavaluació i reflexió de l\'alumne/a sobre el seu propi aprenentatge i actitud.',
      comentariGlobal,
      items: [{
        titol:      'Autoavaluació',
        assoliment: 'No avaluat',
        comentari:  comentariGlobal,
      }],
      professorUid:   _aaUID,
      professorEmail: window.firebase.auth().currentUser?.email || '',
      fontAutoavalId: resposta.id,
      updatedAt:      firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: false });

    // Marcar la resposta com enviada al butlletí
    await _aaDB.collection('autoaval_respostes').doc(resposta.id).update({
      estat: 'enviatButlleti',
      comentariTutor: comentari,
      enviatButlletiAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    aaToast('✅ Enviat al butlletí com a "Comentari alumne"');
    overlay.remove();
    carregarTabRespostes();

  } catch(e) {
    console.error('autoavaluacio: error enviant al butlletí', e);
    errEl.textContent = '❌ Error: ' + e.message;
    btn.disabled = false;
    btn.textContent = '🏫 Enviar al butlletí';
  }
}

// ═════════════════════════════════════════════════════════
//  PATCH SECRETARIA — afegir rol 'alumne' a les llistes de rols
//
//  El problema: secretaria.js hardcodeja la llista de rols
//  en dues funcions (modalNouUsuari i modalEditarRols) usant
//  arrays literals. No podem tocar secretaria.js, però sí
//  podem interceptar les funcions globals que exposa.
//
//  Estratègia:
//  1. Esperem que secretaria.js hagi carregat i exposi
//     window.obrirPanellSecretaria
//  2. Fem wrap de la funció nativa de crearModal perquè,
//     cada cop que es crida amb contingut que conté
//     '.chk-rol-nou', hi injectem l'opció alumne just després
//     de renderitzar el DOM.
//  3. Fem el mateix per a modalEditarRols via wrap de
//     window.modalEditarRols si existeix, o via MutationObserver
//     com a fallback.
// ═════════════════════════════════════════════════════════
function patchSecretariaRols() {
  const COLOR_ALUMNE = '#0891b2';

  // ── Helper: injectar checkbox alumne a un contenidor de rols ──
  function injectarRolAlumne(container, clsCheckbox) {
    if (!container) return;
    if (container.querySelector(`[value="alumne"]`)) return; // ja existeix

    const esEdit = clsCheckbox === 'chk-rol-edit';

    if (esEdit) {
      // Modal editar rols: format amb padding i border com la resta
      const label = document.createElement('label');
      label.style.cssText = `display:flex;align-items:center;gap:12px;cursor:pointer;
        padding:12px 14px;border-radius:10px;background:#f9fafb;
        border:2px solid ${COLOR_ALUMNE};transition:border-color 0.2s;`;
      label.id = 'row-rol-alumne';
      label.innerHTML = `
        <input type="checkbox" class="${clsCheckbox}" value="alumne"
          style="width:18px;height:18px;accent-color:${COLOR_ALUMNE};">
        <div style="flex:1;">
          <div style="font-weight:700;color:${COLOR_ALUMNE};">alumne</div>
          <div style="font-size:12px;color:#9ca3af;">Accés únic al formulari d'autoavaluació</div>
        </div>`;
      // Inserir al principi per diferenciar-lo visualment dels rols de professor
      container.insertBefore(label, container.firstChild);
    } else {
      // Modal nou usuari: format compacte inline
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;';
      label.innerHTML = `
        <input type="checkbox" class="${clsCheckbox}" value="alumne"
          style="width:16px;height:16px;accent-color:${COLOR_ALUMNE};">
        <span style="font-size:13px;font-weight:600;color:${COLOR_ALUMNE};">alumne</span>`;
      container.insertBefore(label, container.firstChild);
    }
  }

  // ── Estratègia principal: MutationObserver persistent ──
  // Cada vegada que apareix al DOM un contenidor amb checkboxes de rols,
  // hi injectem el rol alumne. Funciona per a tots dos modals.
  const obs = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType !== 1) continue;

        // Modal nou usuari: checkboxes amb classe 'chk-rol-nou'
        const nouCont = node.querySelector?.('.chk-rol-nou')
                          ?.closest('div[style*="flex-wrap"]');
        if (nouCont && !nouCont.querySelector('[value="alumne"]')) {
          injectarRolAlumne(nouCont, 'chk-rol-nou');
        }

        // Modal editar rols: checkboxes amb classe 'chk-rol-edit'
        // El contenidor és un div amb flex-direction:column i gap:10px
        const editCont = node.querySelector?.('.chk-rol-edit')
                           ?.closest('div[style*="flex-direction:column"]');
        if (editCont && !editCont.querySelector('[value="alumne"]')) {
          injectarRolAlumne(editCont, 'chk-rol-edit');
        }
      }
    }
  });

  obs.observe(document.body, { childList: true, subtree: true });

  // ── Patch de rolColor: afegir color per a 'alumne' ──
  // Esperem que secretaria.js s'hagi executat i llavors fem patch de
  // la funció global rolColor si existeix (és function declaration → és hoistable
  // però és dins del mòdul de secretaria.js, no és window.rolColor).
  // Per tant no podem fer wrap directe. En canvi, el color s'usa en línia
  // dins de templates literals → ja queda definit per l'observer anterior.

  console.log('✅ autoavaluacio: patch secretaria activat');
}

// ═════════════════════════════════════════════════════════
//  EXPORTS
// ═════════════════════════════════════════════════════════
window.obrirPanellAutoaval = obrirPanellAutoaval;

console.log('✅ autoavaluacio.js: inicialitzat');
