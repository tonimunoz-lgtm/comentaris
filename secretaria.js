// secretaria.js
// Panell de Secretaria — UltraComentator / INS Matadepera
// Funcions: crear grups, matèries, gestionar usuaris, generar butlletins PDF
// Visible únicament per als rols: secretaria, admin, superadmin

console.log('📁 secretaria.js carregat');

/* ══════════════════════════════════════════════════════
   INJECTAR BOTÓ SECRETARIA AL SIDEBAR
══════════════════════════════════════════════════════ */
window.injectarBotoSecretaria = function() {
  if (document.getElementById('btnSecretariaSidebar')) return;

  const nav = document.querySelector('.sidebar-nav') || document.querySelector('#sidebar nav');
  if (!nav) return;

  const btn = document.createElement('button');
  btn.id = 'btnSecretariaSidebar';
  btn.className = 'nav-item';
  btn.dataset.screen = 'secretaria';
  btn.innerHTML = `<span class="nav-icon">📋</span><span>Secretaria</span>`;
  btn.addEventListener('click', obrirPanellSecretaria);
  nav.appendChild(btn);
};

/* ══════════════════════════════════════════════════════
   PANELL PRINCIPAL DE SECRETARIA
══════════════════════════════════════════════════════ */
async function obrirPanellSecretaria() {
  document.getElementById('panellSecretaria')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'panellSecretaria';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:8888;background:rgba(15,23,42,0.7);
    display:flex;align-items:stretch;justify-content:flex-end;
  `;

  overlay.innerHTML = `
    <div style="
      width:min(900px,100%);background:#fff;
      display:flex;flex-direction:column;overflow:hidden;
      box-shadow:-20px 0 60px rgba(0,0,0,0.3);
    ">
      <!-- Header -->
      <div style="
        background:linear-gradient(135deg,#1e1b4b,#4c1d95);
        color:#fff;padding:24px 28px;flex-shrink:0;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h2 style="font-size:22px;font-weight:800;margin:0;">📋 Secretaria</h2>
            <p style="font-size:13px;opacity:0.75;margin:4px 0 0;">Gestió institucional del centre</p>
          </div>
          <button id="btnTancarSecretaria" style="
            background:rgba(255,255,255,0.2);border:none;color:#fff;
            width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer;
          ">✕</button>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-top:20px;">
          ${[
            { id: 'tab-grups',    icon: '🏫', label: 'Grups' },
            { id: 'tab-materies', icon: '📚', label: 'Matèries' },
            { id: 'tab-usuaris',  icon: '👥', label: 'Usuaris' },
            { id: 'tab-butlleti', icon: '📄', label: 'Butlletins' },
            { id: 'tab-quadre',   icon: '📊', label: 'Quadre dades' },
          ].map(t => `
            <button class="sec-tab" data-tab="${t.id}" style="
              padding:8px 16px;border-radius:8px 8px 0 0;border:none;cursor:pointer;
              font-size:13px;font-weight:600;
              background:rgba(255,255,255,0.15);color:#fff;transition:background 0.2s;
            ">
              ${t.icon} ${t.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Cos del panell -->
      <div id="secContent" style="flex:1;overflow-y:auto;padding:28px;"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Events
  overlay.querySelector('#btnTancarSecretaria').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Tabs
  overlay.querySelectorAll('.sec-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.sec-tab').forEach(t => {
        t.style.background = 'rgba(255,255,255,0.15)';
        t.style.color = '#fff';
      });
      tab.style.background = '#fff';
      tab.style.color = '#4c1d95';
      carregarTabSecretaria(tab.dataset.tab);
    });
  });

  // Carregar primera tab
  overlay.querySelector('.sec-tab').click();
}

/* ══════════════════════════════════════════════════════
   ROUTER DE TABS
══════════════════════════════════════════════════════ */
async function carregarTabSecretaria(tab) {
  const content = document.getElementById('secContent');
  if (!content) return;

  content.innerHTML = `<div style="text-align:center;padding:40px;color:#9ca3af;">⏳ Carregant...</div>`;

  switch (tab) {
    case 'tab-grups':    await renderGrups(content);    break;
    case 'tab-materies': await renderMateries(content); break;
    case 'tab-usuaris':  await renderUsuaris(content);  break;
    case 'tab-butlleti': await renderButlletins(content);break;
    case 'tab-quadre':   await renderQuadreDades(content);break;
  }
}

/* ══════════════════════════════════════════════════════
   TAB: GRUPS
══════════════════════════════════════════════════════ */
async function renderGrups(content) {
  const grups = await carregarGrupsCentre();

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin:0;">🏫 Grups del centre</h3>
      <button id="btnNouGrup" style="
        padding:8px 16px;background:#7c3aed;color:#fff;border:none;
        border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
        + Nou grup
      </button>
    </div>
    <div id="llistaGrups"></div>
  `;

  renderLlistaGrups(grups);

  document.getElementById('btnNouGrup').addEventListener('click', () => modalGrup());
}

function renderLlistaGrups(grups) {
  const container = document.getElementById('llistaGrups');
  if (!container) return;

  if (grups.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px;color:#9ca3af;background:#f9fafb;border-radius:12px;">
        <div style="font-size:32px;margin-bottom:8px;">🏫</div>
        No hi ha grups creats. Crea el primer grup!
      </div>
    `;
    return;
  }

  // Agrupar per curs
  const perCurs = {};
  grups.forEach(g => {
    const c = g.curs || 'sense curs';
    if (!perCurs[c]) perCurs[c] = [];
    perCurs[c].push(g);
  });

  container.innerHTML = Object.entries(perCurs).map(([curs, gs]) => `
    <div style="margin-bottom:20px;">
      <h4 style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;
                 letter-spacing:0.05em;margin-bottom:8px;">Curs ${curs}</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">
        ${gs.map(g => `
          <div style="
            background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;
            padding:14px;display:flex;justify-content:space-between;align-items:center;
          ">
            <div>
              <div style="font-weight:700;color:#1e1b4b;">${escapeHtml(g.nom)}</div>
              <div style="font-size:12px;color:#9ca3af;">${escapeHtml(g.curs || '')}</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn-editar-grup" data-id="${g.id}" style="
                background:none;border:none;font-size:18px;cursor:pointer;" title="Editar">✏️</button>
              <button class="btn-eliminar-grup" data-id="${g.id}" data-nom="${escapeHtml(g.nom)}" style="
                background:none;border:none;font-size:18px;cursor:pointer;" title="Eliminar">🗑️</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-editar-grup').forEach(btn => {
    btn.addEventListener('click', async () => {
      const grup = grups.find(g => g.id === btn.dataset.id);
      if (grup) modalGrup(grup);
    });
  });

  container.querySelectorAll('.btn-eliminar-grup').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Eliminar el grup "${btn.dataset.nom}"?`)) return;
      try {
        await window.db.collection('grups_centre').doc(btn.dataset.id).delete();
        window.mostrarToast('🗑️ Grup eliminat');
        const grups = await carregarGrupsCentre();
        renderLlistaGrups(grups);
      } catch (e) {
        window.mostrarToast('❌ Error eliminant: ' + e.message);
      }
    });
  });
}

function modalGrup(grupExistent) {
  document.getElementById('modalGrup')?.remove();
  const modal = document.createElement('div');
  modal.id = 'modalGrup';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;

  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;width:100%;max-width:440px;">
      <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin-bottom:20px;">
        ${grupExistent ? '✏️ Editar grup' : '+ Nou grup'}
      </h3>
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
          Nom del grup *</label>
        <input id="inpGrupNom" type="text" value="${escapeHtml(grupExistent?.nom || '')}"
          placeholder="Ex: 3A, 2B, 4C..."
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
                 border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
          Curs *</label>
        <input id="inpGrupCurs" type="text" value="${escapeHtml(grupExistent?.curs || '')}"
          placeholder="Ex: 2024-25"
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
                 border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
      </div>
      <div style="margin-bottom:20px;">
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
          Ordre (per ordenar)</label>
        <input id="inpGrupOrdre" type="number" value="${grupExistent?.ordre ?? 99}"
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
                 border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="btnCancelGrup" style="
          padding:10px 20px;background:#f3f4f6;border:none;border-radius:10px;
          font-weight:600;cursor:pointer;">Cancel·lar</button>
        <button id="btnGuardarGrup" style="
          padding:10px 20px;background:#7c3aed;color:#fff;border:none;
          border-radius:10px;font-weight:700;cursor:pointer;">
          ${grupExistent ? 'Actualitzar' : 'Crear grup'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#btnCancelGrup').addEventListener('click', () => modal.remove());

  modal.querySelector('#btnGuardarGrup').addEventListener('click', async () => {
    const nom   = modal.querySelector('#inpGrupNom').value.trim();
    const curs  = modal.querySelector('#inpGrupCurs').value.trim();
    const ordre = parseInt(modal.querySelector('#inpGrupOrdre').value) || 99;

    if (!nom || !curs) {
      window.mostrarToast('⚠️ Omple el nom i el curs');
      return;
    }

    try {
      const data = { nom, curs, ordre };
      if (grupExistent) {
        await window.db.collection('grups_centre').doc(grupExistent.id).update(data);
        window.mostrarToast('✅ Grup actualitzat');
      } else {
        await window.db.collection('grups_centre').add(data);
        window.mostrarToast('✅ Grup creat');
      }
      modal.remove();
      const grups = await carregarGrupsCentre();
      renderLlistaGrups(grups);
    } catch (e) {
      window.mostrarToast('❌ Error: ' + e.message);
    }
  });
}

/* ══════════════════════════════════════════════════════
   TAB: MATÈRIES
══════════════════════════════════════════════════════ */
async function renderMateries(content) {
  const materies = await carregarMateriesCentre();

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin:0;">📚 Matèries del centre</h3>
      <button id="btnNovaMateria" style="
        padding:8px 16px;background:#7c3aed;color:#fff;border:none;
        border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
        + Nova matèria
      </button>
    </div>
    <div id="llistaMateries"></div>
  `;

  renderLlistaMateries(materies);

  document.getElementById('btnNovaMateria').addEventListener('click', () => modalMateria());
}

function renderLlistaMateries(materies) {
  const container = document.getElementById('llistaMateries');
  if (!container) return;

  if (materies.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px;color:#9ca3af;background:#f9fafb;border-radius:12px;">
        <div style="font-size:32px;margin-bottom:8px;">📚</div>
        No hi ha matèries creades. Crea la primera!
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${materies.map((m, i) => `
        <div style="
          background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;
          padding:14px 18px;display:flex;justify-content:space-between;align-items:center;
        ">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="
              background:#e0e7ff;color:#4338ca;font-weight:700;font-size:12px;
              padding:4px 10px;border-radius:999px;">
              ${String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <div style="font-weight:700;color:#1e1b4b;">${escapeHtml(m.nom)}</div>
              ${m.descripcioComuna ? `
                <div style="font-size:12px;color:#9ca3af;max-width:400px;
                     white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${escapeHtml(m.descripcioComuna.substring(0, 80))}...
                </div>
              ` : ''}
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-editar-mat" data-id="${m.id}" style="
              background:none;border:none;font-size:18px;cursor:pointer;">✏️</button>
            <button class="btn-eliminar-mat" data-id="${m.id}" data-nom="${escapeHtml(m.nom)}" style="
              background:none;border:none;font-size:18px;cursor:pointer;">🗑️</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.btn-editar-mat').forEach(btn => {
    btn.addEventListener('click', async () => {
      const mat = materies.find(m => m.id === btn.dataset.id);
      if (mat) modalMateria(mat);
    });
  });

  container.querySelectorAll('.btn-eliminar-mat').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Eliminar la matèria "${btn.dataset.nom}"?`)) return;
      try {
        await window.db.collection('materies_centre').doc(btn.dataset.id).delete();
        window.mostrarToast('🗑️ Matèria eliminada');
        const mat = await carregarMateriesCentre();
        renderLlistaMateries(mat);
      } catch (e) {
        window.mostrarToast('❌ Error: ' + e.message);
      }
    });
  });
}

function modalMateria(materiaExistent) {
  document.getElementById('modalMateria')?.remove();
  const modal = document.createElement('div');
  modal.id = 'modalMateria';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;

  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;width:100%;max-width:500px;">
      <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin-bottom:20px;">
        ${materiaExistent ? '✏️ Editar matèria' : '+ Nova matèria'}
      </h3>
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
          Nom de la matèria *</label>
        <input id="inpMatNom" type="text" value="${escapeHtml(materiaExistent?.nom || '')}"
          placeholder="Ex: Matemàtiques, Llengua Catalana, STEM..."
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
                 border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
          Descripció comuna per defecte
          <span style="font-weight:400;color:#9ca3af;">(texto predefault del butlletí)</span>
        </label>
        <textarea id="inpMatDesc" rows="4"
          placeholder="Text introductori que apareixerà al butlletí per a aquesta matèria..."
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
                 border-radius:10px;font-size:13px;outline:none;resize:vertical;font-family:inherit;"
        >${escapeHtml(materiaExistent?.descripcioComuna || '')}</textarea>
      </div>
      <div style="margin-bottom:20px;">
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
          Ordre</label>
        <input id="inpMatOrdre" type="number" value="${materiaExistent?.ordre ?? 99}"
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
                 border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="btnCancelMat" style="
          padding:10px 20px;background:#f3f4f6;border:none;border-radius:10px;
          font-weight:600;cursor:pointer;">Cancel·lar</button>
        <button id="btnGuardarMat" style="
          padding:10px 20px;background:#7c3aed;color:#fff;border:none;
          border-radius:10px;font-weight:700;cursor:pointer;">
          ${materiaExistent ? 'Actualitzar' : 'Crear matèria'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('#btnCancelMat').addEventListener('click', () => modal.remove());

  modal.querySelector('#btnGuardarMat').addEventListener('click', async () => {
    const nom   = modal.querySelector('#inpMatNom').value.trim();
    const desc  = modal.querySelector('#inpMatDesc').value.trim();
    const ordre = parseInt(modal.querySelector('#inpMatOrdre').value) || 99;

    if (!nom) { window.mostrarToast('⚠️ El nom és obligatori'); return; }

    try {
      const data = { nom, descripcioComuna: desc, ordre };
      if (materiaExistent) {
        await window.db.collection('materies_centre').doc(materiaExistent.id).update(data);
        window.mostrarToast('✅ Matèria actualitzada');
      } else {
        await window.db.collection('materies_centre').add(data);
        window.mostrarToast('✅ Matèria creada');
      }
      modal.remove();
      const mat = await carregarMateriesCentre();
      renderLlistaMateries(mat);
    } catch (e) {
      window.mostrarToast('❌ Error: ' + e.message);
    }
  });
}

/* ══════════════════════════════════════════════════════
   TAB: USUARIS
══════════════════════════════════════════════════════ */
async function renderUsuaris(content) {
  let usuaris = [];
  try {
    const snap = await window.db.collection('professors').orderBy('email').get();
    usuaris = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {}

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin:0;">👥 Gestió d'usuaris</h3>
      <button id="btnNouUsuari" style="
        padding:8px 16px;background:#7c3aed;color:#fff;border:none;
        border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
        + Nou usuari
      </button>
    </div>

    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f3f4f6;text-align:left;">
            <th style="padding:10px 14px;font-weight:600;color:#374151;border-radius:8px 0 0 8px;">Usuari</th>
            <th style="padding:10px 14px;font-weight:600;color:#374151;">Rols</th>
            <th style="padding:10px 14px;font-weight:600;color:#374151;">Estat</th>
            <th style="padding:10px 14px;font-weight:600;color:#374151;border-radius:0 8px 8px 0;">Accions</th>
          </tr>
        </thead>
        <tbody id="taulaUsuaris">
          ${usuaris.map(u => `
            <tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:12px 14px;">
                <div style="font-weight:600;color:#1e1b4b;">${escapeHtml(u.nom || u.email)}</div>
                <div style="font-size:12px;color:#9ca3af;">${escapeHtml(u.email || '')}</div>
              </td>
              <td style="padding:12px 14px;">
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                  ${(u.rols || (u.isAdmin ? ['admin'] : ['professor'])).map(r => `
                    <span style="
                      padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;
                      background:${rolColor(r)};color:#fff;
                    ">${r}</span>
                  `).join('')}
                </div>
              </td>
              <td style="padding:12px 14px;">
                ${u.forcePasswordChange
                  ? '<span style="color:#f59e0b;font-size:12px;">🔑 Pendent canvi pw</span>'
                  : '<span style="color:#22c55e;font-size:12px;">✅ Actiu</span>'
                }
              </td>
              <td style="padding:12px 14px;">
                <div style="display:flex;gap:6px;">
                  <button class="btn-editar-user" data-id="${u.id}" style="
                    padding:5px 10px;background:#e0e7ff;color:#4338ca;border:none;
                    border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
                    Editar rols
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btnNouUsuari').addEventListener('click', () => modalNouUsuari());

  content.querySelectorAll('.btn-editar-user').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = usuaris.find(u => u.id === btn.dataset.id);
      if (u) modalEditarRols(u);
    });
  });
}

function rolColor(rol) {
  const colors = {
    superadmin: '#7c3aed',
    admin:      '#dc2626',
    secretaria: '#0891b2',
    tutor:      '#059669',
    professor:  '#2563eb',
    revisor:    '#d97706',
  };
  return colors[rol] || '#6b7280';
}

function modalNouUsuari() {
  document.getElementById('modalNouUsuari')?.remove();
  const modal = document.createElement('div');
  modal.id = 'modalNouUsuari';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;

  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;width:100%;max-width:480px;">
      <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin-bottom:20px;">+ Nou usuari</h3>

      <div style="margin-bottom:14px;">
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
          Nom complet *</label>
        <input id="inpNouNom" type="text" placeholder="Pere Garcia"
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
                 border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
          Email *</label>
        <input id="inpNouEmail" type="email" placeholder="professor@insmatadepera.cat"
          style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;
                 border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
          Contrasenya inicial *</label>
        <div style="display:flex;gap:8px;">
          <input id="inpNouPw" type="text" placeholder="Contrasenya temporal"
            style="flex:1;padding:10px 12px;border:1.5px solid #e5e7eb;
                   border-radius:10px;font-size:14px;outline:none;font-family:inherit;">
          <button id="btnGenPw" style="
            padding:10px 14px;background:#f3f4f6;border:none;border-radius:10px;
            font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">
            🎲 Generar
          </button>
        </div>
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:8px;">
          Rol</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${['professor','tutor','secretaria','revisor','admin'].map(r => `
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input type="checkbox" class="chk-rol-nou" value="${r}"
                ${r === 'professor' ? 'checked' : ''}
                style="width:16px;height:16px;">
              <span style="font-size:13px;font-weight:600;color:${rolColor(r)};">${r}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div style="margin-bottom:20px;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="chkEnviarMail" checked style="width:16px;height:16px;">
          <span style="font-size:13px;color:#374151;">Enviar mail de benvinguda amb les credencials</span>
        </label>
      </div>

      <div id="errNouUsuari" style="color:#ef4444;font-size:12px;margin-bottom:12px;min-height:16px;"></div>

      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="btnCancelNouUser" style="
          padding:10px 20px;background:#f3f4f6;border:none;border-radius:10px;
          font-weight:600;cursor:pointer;">Cancel·lar</button>
        <button id="btnCrearUsuari" style="
          padding:10px 20px;background:#7c3aed;color:#fff;border:none;
          border-radius:10px;font-weight:700;cursor:pointer;">
          Crear usuari</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#btnCancelNouUser').addEventListener('click', () => modal.remove());
  modal.querySelector('#btnGenPw').addEventListener('click', () => {
    modal.querySelector('#inpNouPw').value = generarPasswordAleatori();
  });

  modal.querySelector('#btnCrearUsuari').addEventListener('click', async () => {
    const nom   = modal.querySelector('#inpNouNom').value.trim();
    const email = modal.querySelector('#inpNouEmail').value.trim();
    const pw    = modal.querySelector('#inpNouPw').value.trim();
    const rols  = [...modal.querySelectorAll('.chk-rol-nou:checked')].map(c => c.value);
    const enviarMail = modal.querySelector('#chkEnviarMail').checked;
    const errEl = modal.querySelector('#errNouUsuari');

    if (!nom || !email || !pw) { errEl.textContent = 'Omple tots els camps obligatoris'; return; }
    if (pw.length < 6) { errEl.textContent = 'La contrasenya ha de tenir mínim 6 caràcters'; return; }

    const btnCrear = modal.querySelector('#btnCrearUsuari');
    btnCrear.disabled = true;
    btnCrear.textContent = '⏳ Creant...';

    try {
      // Cridar la Cloud Function o l'API per crear l'usuari
      // Com que Firebase no permet crear usuaris directament des del client
      // sense desconnectar la sessió actual, usem un workaround:
      // Guardem la "petició de creació" a Firestore i la processem amb una Cloud Function
      // Per ara, guardem a una col·lecció pendent
      await window.db.collection('_peticions_usuari').add({
        tipus: 'crear',
        nom,
        email,
        password: pw,  // En producció: xifrat o via Cloud Function
        rols: rols.length > 0 ? rols : ['professor'],
        enviarMail,
        creatPer: firebase.auth().currentUser?.uid || '',
        creatAt: firebase.firestore.FieldValue.serverTimestamp(),
        processat: false
      });

      window.mostrarToast(`✅ Sol·licitud de creació enviada per a ${email}`);
      if (enviarMail) {
        window.mostrarToast('📧 S\'enviarà un mail de benvinguda en breu', 3000);
      }
      modal.remove();
    } catch (e) {
      errEl.textContent = 'Error: ' + e.message;
      btnCrear.disabled = false;
      btnCrear.textContent = 'Crear usuari';
    }
  });
}

function modalEditarRols(usuari) {
  document.getElementById('modalEditarRols')?.remove();
  const rolsActuals = usuari.rols || (usuari.isAdmin ? ['admin'] : ['professor']);

  const modal = document.createElement('div');
  modal.id = 'modalEditarRols';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;

  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;width:100%;max-width:420px;">
      <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin-bottom:6px;">✏️ Editar rols</h3>
      <p style="font-size:13px;color:#9ca3af;margin-bottom:20px;">${escapeHtml(usuari.email)}</p>

      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
        ${['professor','tutor','secretaria','revisor','admin'].map(r => `
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;
                        padding:10px 14px;border-radius:10px;background:#f9fafb;
                        border:1.5px solid ${rolsActuals.includes(r) ? rolColor(r) : '#e5e7eb'};">
            <input type="checkbox" class="chk-rol-edit" value="${r}"
              ${rolsActuals.includes(r) ? 'checked' : ''}
              style="width:18px;height:18px;accent-color:${rolColor(r)};">
            <div>
              <div style="font-weight:700;color:${rolColor(r)};">${r}</div>
              <div style="font-size:12px;color:#9ca3af;">${descripcioRol(r)}</div>
            </div>
          </label>
        `).join('')}
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="btnCancelRols" style="
          padding:10px 20px;background:#f3f4f6;border:none;border-radius:10px;
          font-weight:600;cursor:pointer;">Cancel·lar</button>
        <button id="btnGuardarRols" style="
          padding:10px 20px;background:#7c3aed;color:#fff;border:none;
          border-radius:10px;font-weight:700;cursor:pointer;">
          Guardar rols</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('#btnCancelRols').addEventListener('click', () => modal.remove());

  modal.querySelector('#btnGuardarRols').addEventListener('click', async () => {
    const rols = [...modal.querySelectorAll('.chk-rol-edit:checked')].map(c => c.value);
    try {
      await window.db.collection('professors').doc(usuari.id).update({
        rols: rols.length > 0 ? rols : ['professor'],
        isAdmin: rols.includes('admin')
      });
      window.mostrarToast('✅ Rols actualitzats');
      modal.remove();
    } catch (e) {
      window.mostrarToast('❌ Error: ' + e.message);
    }
  });
}

function descripcioRol(rol) {
  const desc = {
    professor:  'Genera comentaris i els afegeix a l\'avaluació',
    tutor:      'Vista tutoria amb semàfor i resum d\'alumnes',
    secretaria: 'Gestió de grups, matèries, usuaris i butlletins',
    revisor:    'Lectura i edició de dades dels cursos assignats',
    admin:      'Accés total a tota la plataforma',
  };
  return desc[rol] || '';
}

/* ══════════════════════════════════════════════════════
   TAB: BUTLLETINS PDF
══════════════════════════════════════════════════════ */
async function renderButlletins(content) {
  const [grups, materies] = await Promise.all([
    carregarGrupsCentre(),
    carregarMateriesCentre()
  ]);

  // Agrupa grups per curs
  const cursos = [...new Set(grups.map(g => g.curs))].sort();

  content.innerHTML = `
    <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin-bottom:20px;">
      📄 Generació de butlletins de notes</h3>

    <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;
                padding:14px 18px;margin-bottom:20px;font-size:13px;color:#92400e;">
      ⚠️ Els butlletins es generen a partir de les dades introduïdes pels professors a l'Avaluació Centre.
      Assegura't que tots els professors hagin completat les seves aportacions.
    </div>

    <!-- Selector de curs i grup -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
      <div>
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
          Curs acadèmic</label>
        <select id="selCursButlleti" style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;
                border-radius:10px;font-size:14px;outline:none;background:#f9fafb;">
          ${cursos.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">
          Grup</label>
        <select id="selGrupButlleti" style="width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;
                border-radius:10px;font-size:14px;outline:none;background:#f9fafb;">
          <option value="">— Tots els grups —</option>
          ${grups.map(g => `<option value="${g.id}" data-nom="${g.nom}">${g.nom}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Llista d'alumnes per generar -->
    <div id="llistaAlumnesButlleti" style="margin-bottom:20px;"></div>

    <!-- Botons -->
    <div style="display:flex;gap:12px;">
      <button id="btnCarregarAlumnesButl" style="
        padding:10px 20px;background:#e0e7ff;color:#4338ca;border:none;
        border-radius:10px;font-weight:600;cursor:pointer;">
        🔍 Cercar alumnes
      </button>
      <button id="btnGenerarTots" style="
        padding:10px 20px;background:#7c3aed;color:#fff;border:none;
        border-radius:10px;font-weight:700;cursor:pointer;" disabled>
        📥 Generar tots els butlletins (ZIP)
      </button>
    </div>
  `;

  document.getElementById('btnCarregarAlumnesButl').addEventListener('click', async () => {
    const curs  = document.getElementById('selCursButlleti').value;
    const grupId= document.getElementById('selGrupButlleti').value;
    await carregarAlumnesPerButlleti(curs, grupId, grups, materies);
  });
}

async function carregarAlumnesPerButlleti(curs, grupId, grups, materies) {
  const container = document.getElementById('llistaAlumnesButlleti');
  if (!container) return;

  container.innerHTML = `<p style="color:#9ca3af;font-size:13px;">⏳ Cercant alumnes...</p>`;

  try {
    // Obtenir alumnes de la primera matèria (com a referència de la llista)
    const alumnes = await window.llegirTotsAlumnesCurs?.(curs) || [];
    const alumnesFiltrats = grupId
      ? alumnes.filter(a => a.grupId === grupId || a.grup === grups.find(g => g.id === grupId)?.nom)
      : alumnes;

    if (alumnesFiltrats.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:30px;color:#9ca3af;background:#f9fafb;border-radius:12px;">
          No s\'han trobat alumnes per a aquest curs/grup
        </div>
      `;
      document.getElementById('btnGenerarTots').disabled = true;
      return;
    }

    container.innerHTML = `
      <p style="font-size:13px;font-weight:600;color:#374151;margin-bottom:10px;">
        ${alumnesFiltrats.length} alumnes trobats:
      </p>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${alumnesFiltrats.map(a => `
          <div style="
            background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:10px;
            padding:12px 16px;display:flex;justify-content:space-between;align-items:center;
          ">
            <div>
              <div style="font-weight:600;color:#1e1b4b;">
                ${escapeHtml(a.cognoms ? `${a.cognoms}, ${a.nom}` : a.nom)}
              </div>
              <div style="font-size:12px;color:#9ca3af;">Grup: ${escapeHtml(a.grup || '-')}</div>
            </div>
            <button class="btn-gen-butlleti" data-id="${a.id}"
              data-curs="${curs}"
              style="
              padding:6px 14px;background:#7c3aed;color:#fff;border:none;
              border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
              📄 PDF
            </button>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('btnGenerarTots').disabled = false;

    container.querySelectorAll('.btn-gen-butlleti').forEach(btn => {
      btn.addEventListener('click', async () => {
        const alumne = alumnesFiltrats.find(a => a.id === btn.dataset.id);
        if (alumne) await generarButlletiPDF(alumne, curs, materies);
      });
    });

  } catch (e) {
    container.innerHTML = `<p style="color:#ef4444;">Error: ${e.message}</p>`;
  }
}

/* ══════════════════════════════════════════════════════
   GENERADOR PDF BUTLLETÍ
   Segueix el model del PDF de referència
══════════════════════════════════════════════════════ */
async function generarButlletiPDF(alumne, curs, materies) {
  window.mostrarToast('⏳ Generant butlletí...', 2000);

  try {
    // Usem l'API de Claude per generar el HTML del butlletí
    // i després l'obrim en una finestra per imprimir
    const materiesAlumne = alumne.materies || {};
    const dataHui = new Date().toLocaleDateString('ca-ES');

    const html = generarHTMLButlleti(alumne, curs, materies, materiesAlumne, dataHui);

    const finestra = window.open('', '_blank');
    finestra.document.write(html);
    finestra.document.close();
    finestra.focus();
    setTimeout(() => finestra.print(), 500);

    window.mostrarToast(`✅ Butlletí generat per ${alumne.nom}`, 3000);

  } catch (e) {
    window.mostrarToast('❌ Error generant butlletí: ' + e.message, 4000);
  }
}

function generarHTMLButlleti(alumne, curs, totesMat, materiesAlumne, data) {
  const materiesTotals = totesMat.filter(m => materiesAlumne[m.id]);

  const COLORS_ASSOLIMENT = {
    'Assoliment Excel·lent':   '#22c55e',
    'Assoliment Notable':      '#84cc16',
    'Assoliment Satisfactori': '#f59e0b',
    'No Assoliment':           '#ef4444',
    'No avaluat':              '#9ca3af'
  };

  return `<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<title>Butlletí - ${alumne.cognoms || ''} ${alumne.nom || ''}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 10pt; color: #111; background: #fff; }
  @page { size: A4; margin: 15mm 15mm 15mm 15mm; }

  .header-institucional {
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 2px solid #1e1b4b; padding-bottom: 10px; margin-bottom: 16px;
  }
  .header-logo-text { display: flex; flex-direction: column; }
  .header-logo-text .dpt { font-size: 9pt; color: #555; }
  .header-logo-text .centre { font-size: 11pt; font-weight: 700; }
  .header-titol { font-size: 11pt; font-weight: 700; }

  .seccio-taula { margin-bottom: 4px; }
  .seccio-taula table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .seccio-taula th { background: #f3f4f6; padding: 5px 8px; text-align: left; font-weight: 600; }
  .seccio-taula td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }

  h2.seccio { font-size: 10pt; font-weight: 700; margin: 14px 0 6px;
              color: #1e1b4b; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  .desc-comuna { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px;
                  padding: 8px 10px; font-size: 9pt; margin-bottom: 8px; }
  .taula-items { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 10px; }
  .taula-items th { background: #1e1b4b; color: #fff; padding: 5px 8px; text-align: left; }
  .taula-items td { padding: 6px 8px; border: 1px solid #e5e7eb; vertical-align: top; }
  .badge-assoliment {
    display: inline-block; padding: 3px 8px; border-radius: 4px;
    font-size: 8pt; font-weight: 700; color: #fff; white-space: nowrap;
  }
  .comentari-tutor {
    background: #f0f9ff; border: 1.5px solid #bfdbfe; border-radius: 6px;
    padding: 10px 12px; font-size: 9pt; margin: 10px 0;
  }
  .peu {
    margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb;
    display: flex; justify-content: space-between; font-size: 9pt;
  }
  .peu .signatura { text-align: center; }
  .peu .signatura strong { display: block; margin-top: 30px; }

  .aspectes { margin-top: 12px; }
  .aspectes table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .aspectes td { padding: 5px 8px; border: 1px solid #e5e7eb; }
  .aspectes td:first-child { font-weight: 600; background: #f3f4f6; width: 180px; }
</style>
</head>
<body>

<!-- CAPÇALERA INSTITUCIONAL -->
<div class="header-institucional">
  <div class="header-logo-text">
    <span class="dpt">Generalitat de Catalunya · Departament d'Educació</span>
    <span class="centre">INS Matadepera</span>
  </div>
  <div style="text-align:right;">
    <div class="header-titol">Butlletí informatiu · Curs ${escapeHtml(curs)}</div>
    <div style="font-size:9pt;color:#555;">Data: ${data}</div>
  </div>
</div>

<!-- DADES CENTRE -->
<div class="seccio-taula">
  <table>
    <tr>
      <th>Codi del centre</th><th>Nom del centre</th><th>Municipi</th>
    </tr>
    <tr>
      <td>08053169</td><td>Institut Matadepera</td><td>Matadepera</td>
    </tr>
  </table>
</div>

<!-- DADES ENSENYAMENT -->
<div class="seccio-taula" style="margin-top:8px;">
  <table>
    <tr><th>Ensenyament</th><th>Nivell</th><th>Grup</th></tr>
    <tr>
      <td>ESO LOEM — Educació Secundària Obligatòria</td>
      <td>—</td>
      <td>${escapeHtml(alumne.grup || '-')}</td>
    </tr>
  </table>
</div>

<!-- DADES ALUMNE -->
<div class="seccio-taula" style="margin-top:8px;">
  <table>
    <tr><th colspan="2">Dades de l'alumne/a</th></tr>
    <tr>
      <td><strong>Cognoms:</strong> ${escapeHtml(alumne.cognoms || '')}</td>
      <td><strong>Nom:</strong> ${escapeHtml(alumne.nom || '')}</td>
    </tr>
  </table>
</div>

<!-- INTRO RESULTATS -->
<div style="margin:14px 0;font-size:9pt;color:#333;border-top:1px solid #e5e7eb;padding-top:10px;">
  <strong>Resultats de l'avaluació</strong><br>
  Aquest butlletí informa dels aprenentatges del vostre fill/a des del principi de curs fins a la data indicada.
  Es detalla i s'explica amb un comentari els nivells d'assoliment dels aprenentatges més importants
  de cada matèria, àmbit o projecte.
</div>

<!-- MATÈRIES -->
${materiesTotals.map(mat => {
  const dadesMat = materiesAlumne[mat.id] || {};
  const items = dadesMat.items || [];
  return `
    <h2 class="seccio">${escapeHtml(mat.nom).toUpperCase()}</h2>

    ${dadesMat.descripcioComuna ? `
      <div class="desc-comuna">${escapeHtml(dadesMat.descripcioComuna)}</div>
    ` : ''}

    ${items.length > 0 ? `
      <table class="taula-items">
        <tr>
          <th style="width:25%;">APRENENTATGE</th>
          <th>COMENTARI</th>
          <th style="width:18%;">NIVELL ASSOLIMENT</th>
        </tr>
        ${items.map(item => `
          <tr>
            <td style="font-weight:600;">${escapeHtml(item.titol || '')}</td>
            <td>${escapeHtml(item.comentari || '')}</td>
            <td>
              <span class="badge-assoliment"
                style="background:${COLORS_ASSOLIMENT[item.assoliment] || '#9ca3af'};">
                ${escapeHtml(item.assoliment || 'No avaluat')}
              </span>
            </td>
          </tr>
        `).join('')}
      </table>
    ` : '<p style="font-size:9pt;color:#9ca3af;margin-bottom:10px;">Sense ítems introduïts</p>'}
  `;
}).join('')}

<!-- COMENTARI TUTOR -->
${alumne.comentariTutor ? `
  <h2 class="seccio">Comentari Tutor/a</h2>
  <div class="comentari-tutor">${escapeHtml(alumne.comentariTutor)}</div>
` : ''}

<!-- ASPECTES A TENIR EN COMPTE -->
<div class="aspectes">
  <h2 class="seccio">Aspectes a tenir en compte</h2>
  <table>
    <tr>
      <td>ORIENTACIONS (si escau):</td>
      <td>${escapeHtml(alumne.orientacions || '')}</td>
    </tr>
    <tr>
      <td>SUPORT EDUCATIU:</td>
      <td>${escapeHtml(alumne.suportEducatiu || '')}</td>
    </tr>
  </table>
  <p style="font-size:9pt;margin-top:10px;">
    <strong>Faltes d'assistència:</strong> podeu consultar-les a l'aplicació Acàcia.
  </p>
</div>

<!-- PEU DE PÀGINA / SIGNATURES -->
<div class="peu">
  <div class="signatura">
    Nom i cognom del tutor/a<br>
    <strong>${escapeHtml(alumne.tutor || '—')}</strong>
  </div>
  <div class="signatura">
    Vist-i-plau del director del centre<br>
    <strong>Xavi Ros Calsina</strong>
  </div>
</div>

</body>
</html>`;
}

/* ══════════════════════════════════════════════════════
   TAB: QUADRE DE DADES
══════════════════════════════════════════════════════ */
async function renderQuadreDades(content) {
  const [grups, materies] = await Promise.all([
    carregarGrupsCentre(),
    carregarMateriesCentre()
  ]);

  const cursos = [...new Set(grups.map(g => g.curs))].sort();

  content.innerHTML = `
    <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin-bottom:20px;">
      📊 Quadre de dades institucional</h3>

    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
      <select id="selCursQD" style="padding:10px 12px;border:1.5px solid #e5e7eb;
              border-radius:10px;font-size:14px;outline:none;background:#f9fafb;">
        ${cursos.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <select id="selMateriaQD" style="padding:10px 12px;border:1.5px solid #e5e7eb;
              border-radius:10px;font-size:14px;outline:none;background:#f9fafb;">
        <option value="">— Totes les matèries —</option>
        ${materies.map(m => `<option value="${m.id}">${m.nom}</option>`).join('')}
      </select>
      <select id="selGrupQD" style="padding:10px 12px;border:1.5px solid #e5e7eb;
              border-radius:10px;font-size:14px;outline:none;background:#f9fafb;">
        <option value="">— Tots els grups —</option>
        ${grups.map(g => `<option value="${g.id}" data-nom="${g.nom}">${g.nom}</option>`).join('')}
      </select>
      <button id="btnCarregarQD" style="
        padding:10px 20px;background:#7c3aed;color:#fff;border:none;
        border-radius:10px;font-weight:700;cursor:pointer;">
        🔍 Carregar dades
      </button>
      <button id="btnExportarQD" style="
        padding:10px 20px;background:#059669;color:#fff;border:none;
        border-radius:10px;font-weight:700;cursor:pointer;" disabled>
        📊 Exportar Excel
      </button>
    </div>

    <div id="taulesDades"></div>
  `;

  document.getElementById('btnCarregarQD').addEventListener('click', async () => {
    const curs    = document.getElementById('selCursQD').value;
    const matId   = document.getElementById('selMateriaQD').value;
    const grupId  = document.getElementById('selGrupQD').value;
    await carregarQuadreDades(curs, matId, grupId, materies, grups);
  });
}

async function carregarQuadreDades(curs, matId, grupId, materies, grups) {
  const container = document.getElementById('taulesDades');
  if (!container) return;
  container.innerHTML = `<p style="color:#9ca3af;">⏳ Carregant dades...</p>`;

  try {
    const materiesAMostrar = matId
      ? materies.filter(m => m.id === matId)
      : materies;

    let html = '';

    for (const mat of materiesAMostrar) {
      let dades = await window.llegirAvaluacioCentre(curs, mat.id, grupId || null);

      if (dades.length === 0) continue;

      // Agrupar per grup
      const perGrup = {};
      dades.forEach(a => {
        const g = a.grup || 'sense grup';
        if (!perGrup[g]) perGrup[g] = [];
        perGrup[g].push(a);
      });

      // Columnes d'ítems (màxim)
      const maxItems = Math.max(...dades.map(a => (a.items || []).length), 0);

      html += `
        <div style="margin-bottom:30px;">
          <h4 style="font-size:13px;font-weight:700;color:#1e1b4b;padding:8px 12px;
                     background:#e0e7ff;border-radius:8px;margin-bottom:12px;">
            📚 ${escapeHtml(mat.nom)}
          </h4>

          ${Object.entries(perGrup).sort(([a],[b]) => a.localeCompare(b)).map(([grup, alumnes]) => `
            <div style="margin-bottom:16px;">
              <h5 style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:8px;">
                🏫 ${escapeHtml(grup)}
              </h5>
              <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:11px;">
                  <thead>
                    <tr style="background:#f3f4f6;">
                      <th style="padding:6px 10px;text-align:left;font-weight:600;">Alumne/a</th>
                      ${Array.from({length:maxItems}, (_,i) => `
                        <th style="padding:6px 10px;text-align:center;font-weight:600;">
                          Ítem ${i+1}
                        </th>
                      `).join('')}
                      <th style="padding:6px 10px;text-align:left;font-weight:600;">Professor</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${alumnes.sort((a,b) => (a.cognoms||'').localeCompare(b.cognoms||'')).map(a => `
                      <tr style="border-bottom:1px solid #f3f4f6;">
                        <td style="padding:6px 10px;font-weight:600;">
                          ${escapeHtml(a.cognoms ? `${a.cognoms}, ${a.nom}` : a.nom)}
                        </td>
                        ${Array.from({length:maxItems}, (_,i) => {
                          const item = (a.items||[])[i];
                          return `<td style="padding:6px 10px;text-align:center;">
                            ${item ? `
                              <span title="${escapeHtml(item.titol||'')} — ${escapeHtml(item.comentari||'')}"
                                style="
                                  display:inline-block;padding:2px 6px;border-radius:4px;
                                  font-size:10px;font-weight:700;color:#fff;cursor:help;
                                  background:${window.avaluacioCentre?.ASSOLIMENT_COLORS?.[item.assoliment]?.bg || '#9ca3af'};
                                ">
                                ${window.avaluacioCentre?.ASSOLIMENT_COLORS?.[item.assoliment]?.short || '--'}
                              </span>
                            ` : '<span style="color:#e5e7eb;">—</span>'}
                          </td>`;
                        }).join('')}
                        <td style="padding:6px 10px;font-size:10px;color:#9ca3af;">
                          ${escapeHtml(a.professoremail||'—')}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    container.innerHTML = html || `
      <div style="text-align:center;padding:30px;color:#9ca3af;background:#f9fafb;border-radius:12px;">
        No hi ha dades per a la selecció feta
      </div>
    `;

    const btnExp = document.getElementById('btnExportarQD');
    if (btnExp) btnExp.disabled = false;

  } catch (e) {
    container.innerHTML = `<p style="color:#ef4444;">Error: ${e.message}</p>`;
  }
}

/* ══════════════════════════════════════════════════════
   UTILITATS
══════════════════════════════════════════════════════ */
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

function generarPasswordAleatori() {
  const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefghjkmnpqrstwxyz23456789!@#$';
  return Array.from({length: 10}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════════════
   CÒPIA DE SEGURETAT AUTOMÀTICA
══════════════════════════════════════════════════════ */
window.realitzarCopiaSeguretat = async function() {
  const db = window.db;
  try {
    window.mostrarToast('💾 Realitzant còpia de seguretat...', 2000);

    // Recollir totes les col·leccions principals
    const cols = ['professors', 'classes', 'alumnes', 'grups_centre', 'materies_centre'];
    const snapshot = {};

    for (const col of cols) {
      const snap = await db.collection(col).get();
      snapshot[col] = {};
      snap.docs.forEach(d => {
        snapshot[col][d.id] = d.data();
      });
    }

    // Avaluació centre (estructura anidada)
    const cursosSnap = await db.collection('avaluacio_centre').get();
    snapshot['avaluacio_centre'] = {};
    for (const cursDoc of cursosSnap.docs) {
      snapshot['avaluacio_centre'][cursDoc.id] = {};
      const mats = await cursDoc.ref.listCollections();
      for (const matCol of mats) {
        const matSnap = await matCol.get();
        snapshot['avaluacio_centre'][cursDoc.id][matCol.id] = {};
        matSnap.docs.forEach(d => {
          snapshot['avaluacio_centre'][cursDoc.id][matCol.id][d.id] = d.data();
        });
      }
    }

    // Guardar la còpia
    await db.collection('_backups').add({
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      data: JSON.stringify(snapshot),
      versio: '1.0',
      creador: firebase.auth().currentUser?.email || 'sistema'
    });

    window.mostrarToast('✅ Còpia de seguretat realitzada', 3000);
  } catch (e) {
    console.error('Error còpia seguretat:', e);
    window.mostrarToast('❌ Error en la còpia: ' + e.message, 5000);
  }
};

// Programar còpia setmanal
(function programarCopiaSetmanal() {
  const INTERVAL = 7 * 24 * 60 * 60 * 1000; // 1 setmana
  const CLAU = '_ultima_copia_seguretat';

  firebase.auth().onAuthStateChanged(user => {
    if (!user) return;
    const ultima = localStorage.getItem(CLAU);
    const ara = Date.now();
    if (!ultima || (ara - parseInt(ultima)) > INTERVAL) {
      // Si han passat 7 dies, fer còpia
      window.realitzarCopiaSeguretat?.().then(() => {
        localStorage.setItem(CLAU, String(ara));
      });
    }
  });
})();

console.log('✅ secretaria.js: inicialitzat');
