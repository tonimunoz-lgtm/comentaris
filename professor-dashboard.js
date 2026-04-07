// professor-dashboard.js
// Injector: dona vida al botó "👨‍🏫 Professor" de cada classe
// Mostra un panell amb:
//   A) Progrés personal: quants alumnes tenen comentari, quants falten, si s'ha enviat a secretaria
//   D) Estadístiques: distribució d'assoliments per ítem, alumnes sense comentari, alumnes amb PI

console.log('📊 professor-dashboard.js carregat');

// ─── Mapa de colors i etiquetes dels assoliments ────────────────────────────
const _ASSOL = [
  { key: 'assoliment excel·lent',  curt: 'AE', color: '#059669', bg: '#d1fae5' },
  { key: 'assoliment notable',     curt: 'AN', color: '#2563eb', bg: '#dbeafe' },
  { key: 'assoliment satisfactori',curt: 'AS', color: '#d97706', bg: '#fef3c7' },
  { key: 'no assoliment',          curt: 'NA', color: '#dc2626', bg: '#fee2e2' },
];

// ─── Inicialització ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(_initProfessorDashboard, 1200);
});

function _initProfessorDashboard() {
  const btn = document.getElementById('btnProfessor');
  if (!btn) { setTimeout(_initProfessorDashboard, 500); return; }

  // Eliminar listeners anteriors clonant el botó
  const nouBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(nouBtn, btn);

  nouBtn.addEventListener('click', () => {
    if (!window.currentClassId) {
      window.mostrarToast?.('⚠️ Obre una classe primer', 2000);
      return;
    }
    _obrirDashboard();
  });
}

// ─── Obrir el panell ─────────────────────────────────────────────────────────
async function _obrirDashboard() {
  document.getElementById('_profDashboard')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_profDashboard';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9500;background:rgba(15,23,42,0.65);
    display:flex;align-items:center;justify-content:center;padding:16px;
    backdrop-filter:blur(3px);
  `;

  const nomClasse = document.getElementById('classTitle')?.textContent || 'Classe';
  const nomPeriode = document.querySelector('.periode-tab.active')?.textContent?.trim()
    || Object.values(window.currentPeriodes || {})[0]?.nom || 'Període actual';

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;width:100%;max-width:700px;
                max-height:90vh;overflow:hidden;display:flex;flex-direction:column;
                box-shadow:0 24px 64px rgba(0,0,0,0.25);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1e1b4b,#4c1d95);color:#fff;padding:20px 24px;flex-shrink:0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-size:11px;opacity:0.7;font-weight:600;letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px;">
              👨‍🏫 Panell del professor
            </div>
            <h2 style="font-size:18px;font-weight:800;margin:0 0 2px;">${_esc(nomClasse)}</h2>
            <div style="font-size:13px;opacity:0.8;">${_esc(nomPeriode)}</div>
          </div>
          <button id="_profDashClose" style="background:rgba(255,255,255,0.2);border:none;color:#fff;
            width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer;flex-shrink:0;">✕</button>
        </div>
      </div>

      <!-- Contingut amb scroll -->
      <div id="_profDashBody" style="flex:1;overflow-y:auto;padding:24px;">
        <div style="text-align:center;padding:32px;color:#9ca3af;">
          <div style="font-size:28px;margin-bottom:8px;">⏳</div>
          Carregant dades...
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('#_profDashClose').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  await _carregarDashboard(document.getElementById('_profDashBody'), nomPeriode);
}

// ─── Càrrega de dades i renderitzat ─────────────────────────────────────────
async function _carregarDashboard(body, nomPeriode) {
  try {
    const db = window.db;
    const classId  = window.currentClassId;
    const periodeId = window.currentPeriodeId;

    // 1. Llegir doc de la classe per saber si s'ha enviat a secretaria
    const classeDoc = await db.collection('classes').doc(classId).get();
    const classeData = classeDoc.data() || {};
    const grupCentreId = classeData.grupCentreId || null;
    const cursActiu = window._cursActiu || '';

    // 2. Llegir tots els alumnes de la classe
    const alumnesIds = classeData.alumnes || [];
    if (!alumnesIds.length) {
      body.innerHTML = `<div style="text-align:center;padding:40px;color:#9ca3af;">
        <div style="font-size:32px;margin-bottom:8px;">👤</div>
        Aquesta classe no té alumnes.
      </div>`;
      return;
    }

    // Llegir en lots de 10 (límit Firestore)
    const alumnesDocs = [];
    for (let i = 0; i < alumnesIds.length; i += 10) {
      const chunk = alumnesIds.slice(i, i + 10);
      const docs = await Promise.all(chunk.map(id => db.collection('alumnes').doc(id).get()));
      alumnesDocs.push(...docs);
    }

    // 3. Processar dades per alumne
    const alumnes = alumnesDocs.map(doc => {
      const d = doc.data() || {};
      const periodeData = (d.comentarisPerPeriode || {})[periodeId] || {};
      const comentari = (periodeData.comentari || d.comentari || '').trim();
      const items = periodeData.comentarisItems || (d.comentarisItems || {})[periodeId] || [];
      return {
        id: doc.id,
        nom: d.nom || '—',
        comentari,
        items,
        teComentari: comentari.length > 0,
        tePI: !!(d.pi || d.pla_individualitzat),
      };
    }).sort((a, b) => a.nom.localeCompare(b.nom, 'ca'));

    const total = alumnes.length;
    const ambComentari = alumnes.filter(a => a.teComentari).length;
    const senseComentari = total - ambComentari;
    const pct = total ? Math.round((ambComentari / total) * 100) : 0;
    const pctColor = pct === 100 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626';

    // 4. Comprovar si s'ha enviat a secretaria (avaluacio_centre)
    let enviamentInfo = null;
    if (grupCentreId && cursActiu) {
      try {
        const snap = await db.collection('avaluacio_centre').doc(cursActiu)
          .collection(grupCentreId)
          .where('periodeNom', '==', nomPeriode)
          .limit(1).get();
        enviamentInfo = { enviat: !snap.empty };
      } catch(e) { enviamentInfo = { enviat: false }; }
    }

    // 5. Distribució d'assoliments per ítem
    const itemsMap = {}; // titol → { AE, AN, AS, NA, total }
    alumnes.forEach(a => {
      (a.items || []).forEach(item => {
        if (!item.titol || !item.assoliment) return;
        if (!itemsMap[item.titol]) {
          itemsMap[item.titol] = { titol: item.titol, AE: 0, AN: 0, AS: 0, NA: 0, total: 0 };
        }
        const assol = item.assoliment.toLowerCase();
        const found = _ASSOL.find(a => assol.includes(a.curt.toLowerCase()) || a.key === assol);
        if (found) itemsMap[item.titol][found.curt]++;
        itemsMap[item.titol].total++;
      });
    });
    const itemsLlista = Object.values(itemsMap);

    // ── Renderitzar ──────────────────────────────────────────────────────────
    body.innerHTML = `

      <!-- ══ SECCIÓ A: PROGRÉS ══ -->
      <div style="margin-bottom:24px;">
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:12px;">📈 El meu progrés · ${_esc(nomPeriode)}</div>

        <!-- Targetes resum -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
          ${_targeta('👥', total, 'Alumnes totals', '#e0e7ff', '#4338ca')}
          ${_targeta('✅', ambComentari, 'Amb comentari', '#d1fae5', '#059669')}
          ${_targeta('⚠️', senseComentari, 'Sense comentari', senseComentari ? '#fee2e2' : '#f3f4f6', senseComentari ? '#dc2626' : '#9ca3af')}
        </div>

        <!-- Barra de progrés -->
        <div style="background:#f3f4f6;border-radius:12px;padding:14px 16px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:13px;font-weight:600;color:#374151;">Completat</span>
            <span style="font-size:18px;font-weight:800;color:${pctColor};">${pct}%</span>
          </div>
          <div style="background:#e5e7eb;border-radius:99px;height:10px;overflow:hidden;">
            <div style="background:${pctColor};height:100%;width:${pct}%;border-radius:99px;transition:width .4s;"></div>
          </div>
        </div>

        <!-- Estat enviament a secretaria -->
        ${enviamentInfo !== null ? `
        <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
          border-radius:10px;background:${enviamentInfo.enviat ? '#f0fdf4' : '#fef2f2'};
          border:1.5px solid ${enviamentInfo.enviat ? '#86efac' : '#fca5a5'};">
          <span style="font-size:20px;">${enviamentInfo.enviat ? '✅' : '📤'}</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:${enviamentInfo.enviat ? '#166534' : '#991b1b'};">
              ${enviamentInfo.enviat ? 'Avaluació enviada a secretaria' : 'Avaluació pendent d\'enviar a secretaria'}
            </div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px;">
              ${enviamentInfo.enviat ? `S'ha registrat l'enviament per al període "${_esc(nomPeriode)}"` : 'Recorda enviar les dades d\'avaluació des del panell d\'enviament'}
            </div>
          </div>
        </div>` : ''}
      </div>

      <!-- Alumnes sense comentari -->
      ${senseComentari > 0 ? `
      <div style="margin-bottom:24px;">
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:10px;">⚠️ Alumnes sense comentari</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${alumnes.filter(a => !a.teComentari).map(a => `
            <span style="padding:5px 12px;background:#fef2f2;border:1.5px solid #fca5a5;
                          border-radius:99px;font-size:12px;font-weight:600;color:#dc2626;">
              ${_esc(a.nom)}
            </span>`).join('')}
        </div>
      </div>` : `
      <div style="margin-bottom:24px;background:#f0fdf4;border:1.5px solid #86efac;
                  border-radius:10px;padding:12px 16px;font-size:13px;font-weight:600;color:#166534;">
        🎉 Tots els alumnes tenen comentari per a aquest període!
      </div>`}

      <!-- ══ SECCIÓ D: ESTADÍSTIQUES ══ -->
      <div>
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:12px;">📊 Distribució d'assoliments per ítem</div>

        ${itemsLlista.length === 0 ? `
          <div style="background:#f9fafb;border-radius:10px;padding:20px;text-align:center;
                      color:#9ca3af;font-size:13px;">
            Cap dada d'assoliment disponible per a aquest període.<br>
            <span style="font-size:11px;">Els assoliments es generen automàticament quan uses l'Ultracomentator.</span>
          </div>` :
          itemsLlista.map(item => _renderItem(item, total)).join('')
        }

        <!-- Distribució global -->
        ${itemsLlista.length > 1 ? _renderDistribucioGlobal(alumnes, total) : ''}
      </div>
    `;

  } catch(e) {
    body.innerHTML = `<div style="padding:24px;color:#dc2626;text-align:center;">
      ❌ Error carregant dades: ${e.message}
    </div>`;
    console.error('professor-dashboard:', e);
  }
}

// ─── Helpers de renderitzat ───────────────────────────────────────────────────

function _targeta(icon, valor, label, bg, color) {
  return `<div style="background:${bg};border-radius:12px;padding:14px;text-align:center;">
    <div style="font-size:22px;margin-bottom:4px;">${icon}</div>
    <div style="font-size:26px;font-weight:800;color:${color};">${valor}</div>
    <div style="font-size:11px;font-weight:600;color:${color};opacity:.8;">${label}</div>
  </div>`;
}

function _renderItem(item, totalAlumnes) {
  const barres = _ASSOL.map(a => {
    const n = item[a.curt] || 0;
    const pct = totalAlumnes ? Math.round((n / totalAlumnes) * 100) : 0;
    if (!n) return '';
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <span style="width:28px;text-align:center;padding:2px 0;border-radius:6px;font-size:11px;
                   font-weight:700;background:${a.bg};color:${a.color};flex-shrink:0;">${a.curt}</span>
      <div style="flex:1;background:#f3f4f6;border-radius:99px;height:8px;overflow:hidden;">
        <div style="background:${a.color};height:100%;width:${pct}%;border-radius:99px;"></div>
      </div>
      <span style="font-size:12px;font-weight:600;color:${a.color};width:28px;text-align:right;">${n}</span>
      <span style="font-size:11px;color:#9ca3af;width:30px;">${pct}%</span>
    </div>`;
  }).join('');

  // Alumnes sense dada d'aquest ítem
  const senseItem = totalAlumnes - item.total;

  return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;
                      padding:14px 16px;margin-bottom:8px;">
    <div style="font-size:13px;font-weight:700;color:#1e1b4b;margin-bottom:10px;">
      🧩 ${_esc(item.titol)}
      ${senseItem > 0 ? `<span style="font-size:11px;font-weight:400;color:#9ca3af;margin-left:8px;">(${senseItem} sense dada)</span>` : ''}
    </div>
    ${barres || '<div style="font-size:12px;color:#9ca3af;">Sense assoliments registrats</div>'}
  </div>`;
}

function _renderDistribucioGlobal(alumnes, total) {
  // Comptar quants alumnes tenen majoritàriament cada assoliment
  const comptador = { AE: 0, AN: 0, AS: 0, NA: 0, mixte: 0 };
  alumnes.forEach(a => {
    if (!a.items?.length) return;
    const compteAssol = { AE: 0, AN: 0, AS: 0, NA: 0 };
    a.items.forEach(item => {
      const found = _ASSOL.find(x => x.key === (item.assoliment || '').toLowerCase());
      if (found) compteAssol[found.curt]++;
    });
    const max = Math.max(...Object.values(compteAssol));
    const dominant = Object.entries(compteAssol).filter(([,v]) => v === max).map(([k]) => k);
    if (dominant.length === 1) comptador[dominant[0]]++;
    else comptador.mixte++;
  });

  const ambDades = Object.values(comptador).reduce((s, v) => s + v, 0);
  if (!ambDades) return '';

  return `<div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:10px;
                      padding:14px 16px;margin-top:4px;">
    <div style="font-size:12px;font-weight:700;color:#0369a1;margin-bottom:10px;">
      👥 Perfil dominant per alumne (sobre ${ambDades} amb dades)
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      ${_ASSOL.map(a => {
        const n = comptador[a.curt] || 0;
        if (!n) return '';
        return `<div style="text-align:center;background:${a.bg};border-radius:8px;padding:8px 14px;">
          <div style="font-size:18px;font-weight:800;color:${a.color};">${n}</div>
          <div style="font-size:10px;font-weight:700;color:${a.color};">${a.curt}</div>
        </div>`;
      }).join('')}
      ${comptador.mixte ? `<div style="text-align:center;background:#f3f4f6;border-radius:8px;padding:8px 14px;">
        <div style="font-size:18px;font-weight:800;color:#6b7280;">${comptador.mixte}</div>
        <div style="font-size:10px;font-weight:700;color:#6b7280;">Mixte</div>
      </div>` : ''}
    </div>
  </div>`;
}

function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
