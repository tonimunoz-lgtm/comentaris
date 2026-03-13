// tutoria-nova.js
// Panell de Tutoria — UltraComentator / INS Matadepera
// Visible únicament per al perfil tutor (i admin/superadmin)
// Funcions:
//   - Llista d'alumnes amb semàfor configurable
//   - Vista detallada estil butlletí per alumne seleccionat
//   - Configuració de regles de semàfor

console.log('🚦 tutoria-nova.js carregat');

/* ══════════════════════════════════════════════════════
   CONFIGURACIÓ PER DEFECTE
══════════════════════════════════════════════════════ */
const SEMAFORS_DEFAULT = [
  {
    id: 'sa1',
    color: '#ef4444',
    emoji: '🔴',
    etiqueta: 'Atenció urgent',
    regles: [
      { tipus: 'noAssoliments', operador: '>=', valor: 3 }
    ]
  },
  {
    id: 'sa2',
    color: '#f59e0b',
    emoji: '🟡',
    etiqueta: 'A seguir de prop',
    regles: [
      { tipus: 'noAssoliments', operador: '>=', valor: 1 }
    ]
  },
  {
    id: 'sa3',
    color: '#22c55e',
    emoji: '🟢',
    etiqueta: 'Al dia',
    regles: [
      { tipus: 'noAssoliments', operador: '==', valor: 0 }
    ]
  }
];

const TIPUS_REGLA = {
  noAssoliments: 'No Assoliments totals',
  noAssolimentMateria: 'No Assoliment en una matèria',
  assolamentsExcellents: 'Assoliments Excel·lents',
};

/* ══════════════════════════════════════════════════════
   INJECTAR BOTÓ TUTORIA AL SIDEBAR
══════════════════════════════════════════════════════ */
window.injectarBotoTutoria = function() {
  if (document.getElementById('btnTutoriaSidebar')) return;

  const nav = document.querySelector('.sidebar-nav') || document.querySelector('#sidebar nav');
  if (!nav) return;

  const btn = document.createElement('button');
  btn.id = 'btnTutoriaSidebar';
  btn.className = 'nav-item';
  btn.dataset.screen = 'tutoria';
  btn.innerHTML = `<span class="nav-icon">🧑‍🏫</span><span>Tutoria</span>`;
  btn.style.cssText = `
    background: linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,70,229,0.1));
    border-left: 3px solid #7c3aed;
  `;
  btn.addEventListener('click', obrirPanellTutoria);
  nav.appendChild(btn);
};

/* ══════════════════════════════════════════════════════
   PANELL PRINCIPAL TUTORIA
══════════════════════════════════════════════════════ */
async function obrirPanellTutoria() {
  document.getElementById('panellTutoria')?.remove();

  const uid = firebase.auth().currentUser?.uid;
  if (!uid) return;

  // Carregar config del tutor
  const config = await carregarConfigTutor(uid);
  const materies = await carregarMateriesCentre();
  const grups = await carregarGrupsCentre();

  const overlay = document.createElement('div');
  overlay.id = 'panellTutoria';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:8888;background:rgba(15,23,42,0.75);
    display:flex;align-items:stretch;
  `;

  overlay.innerHTML = `
    <div style="
      width:100%;display:flex;flex-direction:column;background:#fff;overflow:hidden;
    ">
      <!-- HEADER -->
      <div style="
        background:linear-gradient(135deg,#1e1b4b,#4c1d95);color:#fff;
        padding:18px 24px;flex-shrink:0;
        display:flex;justify-content:space-between;align-items:center;
      ">
        <div>
          <h2 style="font-size:20px;font-weight:800;margin:0;">🧑‍🏫 Panell de Tutoria</h2>
          <p style="font-size:12px;opacity:0.7;margin:3px 0 0;">Seguiment dels alumnes del grup</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <!-- Selector grup -->
          <select id="selGrupTutoria" style="
            padding:7px 12px;border-radius:8px;border:none;
            font-size:13px;background:rgba(255,255,255,0.2);color:#fff;
            cursor:pointer;outline:none;
          ">
            <option value="">— Tria un grup —</option>
            ${grups.map(g => `<option value="${g.id}" data-nom="${g.nom}">${g.nom}</option>`).join('')}
          </select>
          <button id="btnConfigSemafor" style="
            padding:7px 14px;background:rgba(255,255,255,0.2);
            border:1.5px solid rgba(255,255,255,0.4);color:#fff;
            border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
          ">⚙️ Semàfor</button>
          <button id="btnTancarTutoria" style="
            background:rgba(255,255,255,0.2);border:none;color:#fff;
            width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer;
          ">✕</button>
        </div>
      </div>

      <!-- SELECTOR CURS -->
      <div style="
        background:#f9fafb;border-bottom:1px solid #e5e7eb;
        padding:10px 24px;display:flex;gap:12px;align-items:center;flex-shrink:0;
      ">
        <label style="font-size:13px;font-weight:600;color:#374151;">Curs acadèmic:</label>
        <select id="selCursTutoria" style="
          padding:6px 12px;border:1.5px solid #e5e7eb;border-radius:8px;
          font-size:13px;outline:none;background:#fff;">
          <option value="">Selecciona curs</option>
          ${[...new Set(grups.map(g => g.curs))].sort().reverse().map(c =>
            `<option value="${c}">${c}</option>`
          ).join('')}
        </select>
        <button id="btnCarregarTutoria" style="
          padding:6px 16px;background:#7c3aed;color:#fff;border:none;
          border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
          🔍 Carregar
        </button>
      </div>

      <!-- BODY: llista esquerra + detall dreta -->
      <div style="flex:1;display:flex;overflow:hidden;">

        <!-- LLISTA ALUMNES (esquerra) -->
        <div id="llistaTutoria" style="
          width:280px;flex-shrink:0;border-right:1px solid #e5e7eb;
          overflow-y:auto;background:#fafafa;
        ">
          <div style="padding:16px;text-align:center;color:#9ca3af;font-size:13px;">
            Selecciona curs i grup per veure els alumnes
          </div>
        </div>

        <!-- DETALL ALUMNE (dreta) -->
        <div id="detallAlumneTutoria" style="flex:1;overflow-y:auto;padding:24px;background:#fff;">
          <div style="
            display:flex;align-items:center;justify-content:center;
            height:100%;color:#9ca3af;flex-direction:column;gap:12px;
          ">
            <div style="font-size:48px;">👤</div>
            <div>Selecciona un alumne per veure el seu resum</div>
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Events
  overlay.querySelector('#btnTancarTutoria').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#btnConfigSemafor').addEventListener('click', () =>
    obrirConfigSemafor(uid, config, materies, (nova) => {
      Object.assign(config, nova);
    })
  );

  overlay.querySelector('#btnCarregarTutoria').addEventListener('click', async () => {
    const curs  = overlay.querySelector('#selCursTutoria').value;
    const grupId= overlay.querySelector('#selGrupTutoria').value;
    if (!curs || !grupId) {
      window.mostrarToast('⚠️ Selecciona curs i grup', 3000);
      return;
    }
    await carregarAlumnesTutoria(curs, grupId, grups, materies, config);
  });

  // Preseleccionar si el tutor té grup assignat
  if (window._userProfile?.grupTutor) {
    const selGrup = overlay.querySelector('#selGrupTutoria');
    selGrup.value = window._userProfile.grupTutor;
  }
}

/* ══════════════════════════════════════════════════════
   CARREGAR I ORDENAR ALUMNES AMB SEMÀFOR
══════════════════════════════════════════════════════ */
async function carregarAlumnesTutoria(curs, grupId, grups, materies, config) {
  const llistaEl = document.getElementById('llistaTutoria');
  if (!llistaEl) return;

  llistaEl.innerHTML = `<div style="padding:16px;color:#9ca3af;font-size:13px;">⏳ Carregant...</div>`;

  try {
    // Llegir tots els alumnes del grup des d'avaluacio_centre
    const alumnes = await llegirAlumnesGrupCentre(curs, grupId, materies);

    if (alumnes.length === 0) {
      llistaEl.innerHTML = `
        <div style="padding:20px;text-align:center;color:#9ca3af;font-size:13px;">
          No hi ha dades per a aquest grup.<br>
          Els professors han d'afegir les seves avaluacions primer.
        </div>
      `;
      return;
    }

    // Calcular el semàfor per a cada alumne
    const semafors = config.semafors || SEMAFORS_DEFAULT;
    const alumnesAmbSemafor = alumnes.map(a => ({
      ...a,
      semafor: calcularSemafor(a, semafors, materies)
    }));

    // Ordenar per prioritat de semàfor (primer els més crítics)
    alumnesAmbSemafor.sort((a, b) => {
      const pA = semafors.findIndex(s => s.id === a.semafor?.id);
      const pB = semafors.findIndex(s => s.id === b.semafor?.id);
      if (pA !== pB) return pA - pB;
      return (a.cognoms || '').localeCompare(b.cognoms || '');
    });

    // Renderitzar llista
    renderLlistaAlumnesSemafor(alumnesAmbSemafor, semafors, materies, curs);

  } catch (e) {
    llistaEl.innerHTML = `<div style="padding:16px;color:#ef4444;font-size:13px;">Error: ${e.message}</div>`;
  }
}

function renderLlistaAlumnesSemafor(alumnes, semafors, materies, curs) {
  const llistaEl = document.getElementById('llistaTutoria');
  if (!llistaEl) return;

  // Agrupar per color de semàfor
  const perSemafor = {};
  semafors.forEach(s => { perSemafor[s.id] = []; });
  perSemafor['_sense'] = [];

  alumnes.forEach(a => {
    const semId = a.semafor?.id || '_sense';
    if (perSemafor[semId]) perSemafor[semId].push(a);
    else perSemafor['_sense'].push(a);
  });

  let html = `
    <div style="padding:12px;font-size:12px;font-weight:700;color:#9ca3af;
                text-transform:uppercase;letter-spacing:0.05em;">
      ${alumnes.length} alumnes
    </div>
  `;

  semafors.forEach(sem => {
    const llista = perSemafor[sem.id] || [];
    if (llista.length === 0) return;

    html += `
      <div style="
        padding:6px 12px;font-size:11px;font-weight:700;
        background:${sem.color}20;border-left:3px solid ${sem.color};
        color:${sem.color};display:flex;align-items:center;gap:6px;
      ">
        ${sem.emoji} ${sem.etiqueta.toUpperCase()} (${llista.length})
      </div>
    `;

    llista.forEach(a => {
      const noAss = compteNoAssoliments(a, materies);
      html += `
        <div class="alumne-semafor-item" data-id="${a.id}"
          data-curs="${curs}"
          style="
            padding:12px 14px;cursor:pointer;border-bottom:1px solid #f3f4f6;
            display:flex;align-items:center;gap:10px;transition:background 0.15s;
          "
          onmouseover="this.style.background='#f9fafb'"
          onmouseout="this.style.background='transparent'"
        >
          <div style="
            width:12px;height:12px;border-radius:50%;flex-shrink:0;
            background:${sem.color};box-shadow:0 0 0 3px ${sem.color}30;
          "></div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;color:#1e1b4b;font-size:13px;
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${escapeHtml(a.cognoms ? `${a.cognoms}, ${a.nom}` : a.nom)}
            </div>
            <div style="font-size:11px;color:#9ca3af;">
              ${noAss > 0
                ? `<span style="color:#ef4444;font-weight:600;">${noAss} NA</span>`
                : '<span style="color:#22c55e;">✓ Sense NA</span>'
              }
            </div>
          </div>
        </div>
      `;
    });
  });

  llistaEl.innerHTML = html;

  // Events de clic
  llistaEl.querySelectorAll('.alumne-semafor-item').forEach(el => {
    el.addEventListener('click', async () => {
      // Marcar actiu
      llistaEl.querySelectorAll('.alumne-semafor-item').forEach(e =>
        e.style.background = 'transparent'
      );
      el.style.background = '#e0e7ff';

      const alumne = alumnes.find(a => a.id === el.dataset.id);
      if (alumne) await mostrarDetallAlumne(alumne, materies);
    });
  });
}

/* ══════════════════════════════════════════════════════
   DETALL ALUMNE (estil butlletí)
══════════════════════════════════════════════════════ */
async function mostrarDetallAlumne(alumne, materies) {
  const detallEl = document.getElementById('detallAlumneTutoria');
  if (!detallEl) return;

  const noAss = compteNoAssoliments(alumne, materies);
  const totAss = compteTotalAssoliments(alumne);
  const materiesAlumne = alumne.materies || {};
  const materiesTotals = materies.filter(m => materiesAlumne[m.id]);

  const COLORS = {
    'Assoliment Excel·lent':   { bg: '#22c55e', text: '#fff' },
    'Assoliment Notable':      { bg: '#84cc16', text: '#fff' },
    'Assoliment Satisfactori': { bg: '#f59e0b', text: '#fff' },
    'No Assoliment':           { bg: '#ef4444', text: '#fff' },
    'No avaluat':              { bg: '#9ca3af', text: '#fff' }
  };

  detallEl.innerHTML = `
    <!-- CAPÇALERA ALUMNE -->
    <div style="
      background:linear-gradient(135deg,#1e1b4b,#4c1d95);color:#fff;
      border-radius:16px;padding:20px 24px;margin-bottom:20px;
      display:flex;justify-content:space-between;align-items:flex-start;
    ">
      <div>
        <div style="font-size:22px;font-weight:800;margin-bottom:4px;">
          ${escapeHtml(alumne.cognoms ? `${alumne.cognoms}, ${alumne.nom}` : alumne.nom)}
        </div>
        <div style="font-size:13px;opacity:0.8;">
          Grup: <strong>${escapeHtml(alumne.grup || '—')}</strong>
          ${alumne.tutor ? ` · Tutor/a: <strong>${escapeHtml(alumne.tutor)}</strong>` : ''}
          ${alumne.ralc ? ` · RALC: ${escapeHtml(alumne.ralc)}` : ''}
        </div>
      </div>
      <!-- Stats ràpids -->
      <div style="display:flex;gap:10px;">
        <div style="background:rgba(255,255,255,0.2);padding:10px 16px;border-radius:12px;text-align:center;">
          <div style="font-size:20px;font-weight:800;">${noAss}</div>
          <div style="font-size:10px;opacity:0.8;">No Assoliments</div>
        </div>
        <div style="background:rgba(255,255,255,0.2);padding:10px 16px;border-radius:12px;text-align:center;">
          <div style="font-size:20px;font-weight:800;">${totAss}</div>
          <div style="font-size:10px;opacity:0.8;">Total ítems</div>
        </div>
        <div style="background:rgba(255,255,255,0.2);padding:10px 16px;border-radius:12px;text-align:center;">
          <div style="font-size:20px;font-weight:800;">${materiesTotals.length}</div>
          <div style="font-size:10px;opacity:0.8;">Matèries</div>
        </div>
      </div>
    </div>

    <!-- RESUM GRÀFIC D'ASSOLIMENTS -->
    <div style="
      background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;
      padding:16px 20px;margin-bottom:20px;
    ">
      <h3 style="font-size:13px;font-weight:700;color:#374151;margin-bottom:12px;">
        📊 Resum d'assoliments per matèria
      </h3>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${materiesTotals.map(mat => {
          const dadesMat = materiesAlumne[mat.id] || {};
          const items = dadesMat.items || [];
          const naCount = items.filter(i => i.assoliment === 'No Assoliment').length;
          const total = items.length;

          return `
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:150px;font-size:12px;font-weight:600;color:#374151;
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${escapeHtml(mat.nom)}
              </div>
              <div style="flex:1;display:flex;gap:3px;">
                ${items.map(item => {
                  const c = COLORS[item.assoliment] || COLORS['No avaluat'];
                  return `
                    <div title="${escapeHtml(item.titol || '')} — ${escapeHtml(item.assoliment)}"
                      style="
                        height:20px;flex:1;border-radius:4px;cursor:help;
                        background:${c.bg};min-width:8px;max-width:30px;
                      "></div>
                  `;
                }).join('')}
                ${total === 0 ? '<span style="font-size:11px;color:#d1d5db;">Sense dades</span>' : ''}
              </div>
              ${naCount > 0 ? `
                <span style="
                  background:#fee2e2;color:#dc2626;font-size:11px;font-weight:700;
                  padding:2px 7px;border-radius:999px;white-space:nowrap;
                ">${naCount} NA</span>
              ` : `
                <span style="
                  background:#dcfce7;color:#16a34a;font-size:11px;font-weight:700;
                  padding:2px 7px;border-radius:999px;
                ">✓</span>
              `}
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- DETALL PER MATÈRIA -->
    ${materiesTotals.map(mat => {
      const dadesMat = materiesAlumne[mat.id] || {};
      const items = dadesMat.items || [];

      return `
        <div style="margin-bottom:20px;border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <!-- Capçalera matèria -->
          <div style="
            background:#f3f4f6;padding:10px 16px;
            display:flex;justify-content:space-between;align-items:center;
          ">
            <div style="font-weight:700;color:#1e1b4b;font-size:14px;">
              ${escapeHtml(mat.nom)}
            </div>
            <div style="font-size:12px;color:#9ca3af;">
              Prof: ${escapeHtml(dadesMat.professoremail || '—')}
            </div>
          </div>

          <!-- Descripció comuna -->
          ${dadesMat.descripcioComuna ? `
            <div style="
              background:#f9fafb;padding:10px 16px;font-size:12px;color:#6b7280;
              border-bottom:1px solid #f3f4f6;font-style:italic;
            ">
              ${escapeHtml(dadesMat.descripcioComuna.substring(0, 200))}${dadesMat.descripcioComuna.length > 200 ? '...' : ''}
            </div>
          ` : ''}

          <!-- Ítems -->
          ${items.length > 0 ? `
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#1e1b4b;">
                  <th style="padding:8px 14px;text-align:left;font-size:11px;color:#fff;font-weight:600;width:25%;">
                    APRENENTATGE</th>
                  <th style="padding:8px 14px;text-align:left;font-size:11px;color:#fff;font-weight:600;">
                    COMENTARI</th>
                  <th style="padding:8px 14px;text-align:center;font-size:11px;color:#fff;font-weight:600;width:18%;">
                    ASSOLIMENT</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item, idx) => {
                  const c = COLORS[item.assoliment] || COLORS['No avaluat'];
                  return `
                    <tr style="border-bottom:1px solid #f3f4f6;${idx % 2 === 1 ? 'background:#fafafa;' : ''}">
                      <td style="padding:10px 14px;font-weight:600;font-size:12px;color:#374151;vertical-align:top;">
                        ${escapeHtml(item.titol || '')}</td>
                      <td style="padding:10px 14px;font-size:12px;color:#6b7280;vertical-align:top;">
                        ${escapeHtml(item.comentari || '')}</td>
                      <td style="padding:10px 14px;text-align:center;vertical-align:top;">
                        <span style="
                          display:inline-block;padding:4px 10px;border-radius:6px;
                          font-size:11px;font-weight:700;color:${c.text};background:${c.bg};
                          white-space:nowrap;
                        ">${escapeHtml(item.assoliment || 'No avaluat')}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : `
            <div style="padding:14px 16px;font-size:12px;color:#9ca3af;text-align:center;">
              Sense ítems introduïts pel professor
            </div>
          `}
        </div>
      `;
    }).join('')}

    ${materiesTotals.length === 0 ? `
      <div style="
        text-align:center;padding:40px;color:#9ca3af;
        background:#f9fafb;border-radius:12px;
      ">
        <div style="font-size:32px;margin-bottom:8px;">📋</div>
        No hi ha dades d'avaluació per a aquest alumne
      </div>
    ` : ''}
  `;
}

/* ══════════════════════════════════════════════════════
   MODAL CONFIGURACIÓ SEMÀFOR
══════════════════════════════════════════════════════ */
function obrirConfigSemafor(uid, configActual, materies, onGuardar) {
  document.getElementById('modalConfigSemafor')?.remove();

  const semafors = JSON.parse(JSON.stringify(configActual.semafors || SEMAFORS_DEFAULT));

  const modal = document.createElement('div');
  modal.id = 'modalConfigSemafor';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;

  modal.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px;width:100%;max-width:600px;
                max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,0.3);">

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h2 style="font-size:18px;font-weight:800;color:#1e1b4b;margin:0;">
            ⚙️ Configuració del semàfor
          </h2>
          <p style="font-size:12px;color:#9ca3af;margin:4px 0 0;">
            Defineix les regles de colors per als alumnes
          </p>
        </div>
        <button id="btnTancarConfigSem" style="background:none;border:none;font-size:22px;cursor:pointer;">✕</button>
      </div>

      <div id="semaforsList"></div>

      <div style="
        background:#f0f9ff;border:1.5px solid #bfdbfe;border-radius:12px;
        padding:14px 16px;margin-bottom:20px;font-size:12px;color:#1d4ed8;
      ">
        💡 <strong>Com funciona:</strong> L'alumne rep el color del primer semàfor on es compleixi
        una de les seves regles. L'ordre importa: el primer de la llista té prioritat.
      </div>

      <!-- Preview de la llegenda -->
      <div style="margin-bottom:20px;">
        <p style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:8px;">Llegenda:</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;" id="llegendaPreview"></div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="btnResetSemafors" style="
          padding:10px 18px;background:#f3f4f6;border:none;
          border-radius:10px;font-weight:600;cursor:pointer;font-size:13px;">
          ↺ Valors per defecte
        </button>
        <button id="btnCancelSem" style="
          padding:10px 18px;background:#f3f4f6;border:none;
          border-radius:10px;font-weight:600;cursor:pointer;font-size:13px;">
          Cancel·lar
        </button>
        <button id="btnGuardarSem" style="
          padding:10px 22px;background:#7c3aed;color:#fff;border:none;
          border-radius:10px;font-weight:700;cursor:pointer;font-size:13px;">
          💾 Guardar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  renderConfigSemafors(semafors, materies);

  modal.querySelector('#btnTancarConfigSem').addEventListener('click', () => modal.remove());
  modal.querySelector('#btnCancelSem').addEventListener('click', () => modal.remove());

  modal.querySelector('#btnResetSemafors').addEventListener('click', () => {
    semafors.length = 0;
    SEMAFORS_DEFAULT.forEach(s => semafors.push(JSON.parse(JSON.stringify(s))));
    renderConfigSemafors(semafors, materies);
  });

  modal.querySelector('#btnGuardarSem').addEventListener('click', async () => {
    try {
      await window.db.collection('professors').doc(uid).update({
        configTutoria: { semafors }
      });
      onGuardar({ semafors });
      window.mostrarToast('✅ Configuració guardada');
      modal.remove();
    } catch (e) {
      window.mostrarToast('❌ Error guardant: ' + e.message);
    }
  });
}

function renderConfigSemafors(semafors, materies) {
  const list = document.getElementById('semaforsList');
  const llegenda = document.getElementById('llegendaPreview');
  if (!list) return;

  list.innerHTML = semafors.map((sem, idx) => `
    <div style="
      border:2px solid ${sem.color};border-radius:14px;padding:16px;margin-bottom:14px;
      background:${sem.color}08;
    ">
      <!-- Header semàfor -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <div style="
          width:28px;height:28px;border-radius:50%;background:${sem.color};
          display:flex;align-items:center;justify-content:center;
          font-size:14px;flex-shrink:0;
        ">${sem.emoji}</div>
        <input type="text" class="sem-etiqueta" data-idx="${idx}"
          value="${escapeHtml(sem.etiqueta)}"
          style="flex:1;padding:6px 10px;border:1.5px solid ${sem.color};border-radius:8px;
                 font-size:13px;font-weight:600;outline:none;font-family:inherit;">
        <input type="color" class="sem-color" data-idx="${idx}"
          value="${sem.color}"
          style="width:40px;height:32px;border:none;border-radius:8px;cursor:pointer;padding:2px;">
        <input type="text" class="sem-emoji" data-idx="${idx}"
          value="${sem.emoji}"
          style="width:50px;padding:6px;border:1.5px solid #e5e7eb;border-radius:8px;
                 font-size:18px;text-align:center;outline:none;font-family:inherit;">
      </div>

      <!-- Regles -->
      <div>
        <p style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:8px;">
          REGLES (s'aplica si es compleix ALGUNA):
        </p>
        <div class="regles-container" data-idx="${idx}" style="display:flex;flex-direction:column;gap:6px;">
          ${sem.regles.map((r, rIdx) => renderReglaHTML(idx, rIdx, r, materies)).join('')}
        </div>
        <button class="btn-nova-regla" data-idx="${idx}" style="
          margin-top:8px;padding:5px 12px;background:rgba(0,0,0,0.05);border:none;
          border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;
        ">+ Afegir regla</button>
      </div>
    </div>
  `).join('');

  // Llegenda preview
  if (llegenda) {
    llegenda.innerHTML = semafors.map(sem => `
      <span style="
        display:flex;align-items:center;gap:6px;
        background:${sem.color}20;border:1.5px solid ${sem.color};
        padding:5px 12px;border-radius:999px;font-size:12px;font-weight:600;color:${sem.color};
      ">${sem.emoji} ${escapeHtml(sem.etiqueta)}</span>
    `).join('');
  }

  // Sincronitzar canvis als inputs
  list.querySelectorAll('.sem-etiqueta').forEach(inp => {
    inp.addEventListener('input', () => {
      semafors[parseInt(inp.dataset.idx)].etiqueta = inp.value;
    });
  });
  list.querySelectorAll('.sem-color').forEach(inp => {
    inp.addEventListener('input', () => {
      semafors[parseInt(inp.dataset.idx)].color = inp.value;
      renderConfigSemafors(semafors, materies); // re-render per aplicar color
    });
  });
  list.querySelectorAll('.sem-emoji').forEach(inp => {
    inp.addEventListener('input', () => {
      semafors[parseInt(inp.dataset.idx)].emoji = inp.value;
    });
  });

  // Botó nova regla
  list.querySelectorAll('.btn-nova-regla').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      semafors[idx].regles.push({ tipus: 'noAssoliments', operador: '>=', valor: 1 });
      renderConfigSemafors(semafors, materies);
    });
  });

  // Eliminar regla
  list.querySelectorAll('.btn-eliminar-regla').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx  = parseInt(btn.dataset.idx);
      const rIdx = parseInt(btn.dataset.ridx);
      semafors[idx].regles.splice(rIdx, 1);
      renderConfigSemafors(semafors, materies);
    });
  });

  // Canvis a les regles
  list.querySelectorAll('.regla-tipus').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx  = parseInt(sel.dataset.idx);
      const rIdx = parseInt(sel.dataset.ridx);
      semafors[idx].regles[rIdx].tipus = sel.value;
      if (sel.value === 'noAssolimentMateria') {
        semafors[idx].regles[rIdx].materiaId = materies[0]?.id || '';
      } else {
        delete semafors[idx].regles[rIdx].materiaId;
      }
      renderConfigSemafors(semafors, materies);
    });
  });
  list.querySelectorAll('.regla-op').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx  = parseInt(sel.dataset.idx);
      const rIdx = parseInt(sel.dataset.ridx);
      semafors[idx].regles[rIdx].operador = sel.value;
    });
  });
  list.querySelectorAll('.regla-val').forEach(inp => {
    inp.addEventListener('change', () => {
      const idx  = parseInt(inp.dataset.idx);
      const rIdx = parseInt(inp.dataset.ridx);
      semafors[idx].regles[rIdx].valor = parseInt(inp.value) || 0;
    });
  });
  list.querySelectorAll('.regla-materia').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx  = parseInt(sel.dataset.idx);
      const rIdx = parseInt(sel.dataset.ridx);
      semafors[idx].regles[rIdx].materiaId = sel.value;
    });
  });
}

function renderReglaHTML(idx, rIdx, regla, materies) {
  const esMateria = regla.tipus === 'noAssolimentMateria';

  return `
    <div style="
      display:flex;align-items:center;gap:6px;flex-wrap:wrap;
      background:rgba(255,255,255,0.7);padding:8px 10px;border-radius:8px;
    ">
      <select class="regla-tipus" data-idx="${idx}" data-ridx="${rIdx}"
        style="padding:5px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;outline:none;">
        ${Object.entries(TIPUS_REGLA).map(([k, v]) =>
          `<option value="${k}" ${k === regla.tipus ? 'selected' : ''}>${v}</option>`
        ).join('')}
      </select>

      ${esMateria ? `
        <select class="regla-materia" data-idx="${idx}" data-ridx="${rIdx}"
          style="padding:5px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;outline:none;">
          ${materies.map(m =>
            `<option value="${m.id}" ${m.id === regla.materiaId ? 'selected' : ''}>${m.nom}</option>`
          ).join('')}
        </select>
      ` : `
        <select class="regla-op" data-idx="${idx}" data-ridx="${rIdx}"
          style="padding:5px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;outline:none;">
          <option value=">=" ${regla.operador === '>=' ? 'selected' : ''}>≥</option>
          <option value="==" ${regla.operador === '==' ? 'selected' : ''}>=</option>
          <option value="<=" ${regla.operador === '<=' ? 'selected' : ''}>≤</option>
          <option value=">"  ${regla.operador === '>'  ? 'selected' : ''}>></option>
          <option value="<"  ${regla.operador === '<'  ? 'selected' : ''}><</option>
        </select>
        <input type="number" class="regla-val" data-idx="${idx}" data-ridx="${rIdx}"
          value="${regla.valor ?? 1}" min="0" max="99"
          style="width:55px;padding:5px 8px;border:1px solid #e5e7eb;border-radius:6px;
                 font-size:12px;outline:none;text-align:center;">
      `}

      <button class="btn-eliminar-regla" data-idx="${idx}" data-ridx="${rIdx}"
        style="background:none;border:none;color:#ef4444;font-size:16px;cursor:pointer;padding:0 4px;">
        ✕
      </button>
    </div>
  `;
}

/* ══════════════════════════════════════════════════════
   LÒGICA DEL SEMÀFOR
══════════════════════════════════════════════════════ */
function calcularSemafor(alumne, semafors, materies) {
  for (const sem of semafors) {
    for (const regla of (sem.regles || [])) {
      if (avaluarRegla(alumne, regla, materies)) {
        return sem;
      }
    }
  }
  return semafors[semafors.length - 1] || null;
}

function avaluarRegla(alumne, regla, materies) {
  const { tipus, operador, valor, materiaId } = regla;

  switch (tipus) {
    case 'noAssoliments': {
      const n = compteNoAssoliments(alumne, materies);
      return comparar(n, operador, valor);
    }
    case 'noAssolimentMateria': {
      const mat = (alumne.materies || {})[materiaId];
      if (!mat) return false;
      return (mat.items || []).some(i => i.assoliment === 'No Assoliment');
    }
    case 'assolamentsExcellents': {
      let n = 0;
      Object.values(alumne.materies || {}).forEach(mat => {
        (mat.items || []).forEach(i => {
          if (i.assoliment === 'Assoliment Excel·lent') n++;
        });
      });
      return comparar(n, operador, valor);
    }
    default: return false;
  }
}

function comparar(a, op, b) {
  switch (op) {
    case '>=': return a >= b;
    case '==': return a === b;
    case '<=': return a <= b;
    case '>':  return a > b;
    case '<':  return a < b;
    default:   return false;
  }
}

function compteNoAssoliments(alumne, materies) {
  let n = 0;
  Object.values(alumne.materies || {}).forEach(mat => {
    (mat.items || []).forEach(i => {
      if (i.assoliment === 'No Assoliment') n++;
    });
  });
  return n;
}

function compteTotalAssoliments(alumne) {
  let n = 0;
  Object.values(alumne.materies || {}).forEach(mat => {
    n += (mat.items || []).length;
  });
  return n;
}

/* ══════════════════════════════════════════════════════
   LLEGIR ALUMNES DEL GRUP DES D'AVALUACIÓ CENTRE
══════════════════════════════════════════════════════ */
async function llegirAlumnesGrupCentre(curs, grupId, materies) {
  const db = window.db;
  const resultat = {};

  for (const mat of materies) {
    try {
      const snap = await db
        .collection('avaluacio_centre')
        .doc(curs)
        .collection(mat.id)
        .where('grupId', '==', grupId)
        .get();

      snap.docs.forEach(d => {
        const alumneId = d.id;
        const data = d.data();
        if (!resultat[alumneId]) {
          resultat[alumneId] = {
            id: alumneId,
            nom:    data.nom || '',
            cognoms: data.cognoms || '',
            grup:   data.grup || '',
            grupId: data.grupId || grupId,
            tutor:  data.tutor || '',
            ralc:   data.ralc || '',
            materies: {}
          };
        }
        resultat[alumneId].materies[mat.id] = {
          nom:  mat.nom,
          ...data
        };
      });
    } catch (e) {
      // Matèria sense dades per aquest grup — continuar
    }
  }

  return Object.values(resultat);
}

/* ══════════════════════════════════════════════════════
   CARREGAR CONFIG DEL TUTOR
══════════════════════════════════════════════════════ */
async function carregarConfigTutor(uid) {
  try {
    const doc = await window.db.collection('professors').doc(uid).get();
    return doc.exists ? (doc.data().configTutoria || { semafors: SEMAFORS_DEFAULT }) : { semafors: SEMAFORS_DEFAULT };
  } catch (e) {
    return { semafors: SEMAFORS_DEFAULT };
  }
}

async function carregarMateriesCentre() {
  try {
    const snap = await window.db.collection('materies_centre').orderBy('ordre').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
}

async function carregarGrupsCentre() {
  try {
    const snap = await window.db.collection('grups_centre').orderBy('ordre').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

console.log('✅ tutoria-nova.js: inicialitzat');
