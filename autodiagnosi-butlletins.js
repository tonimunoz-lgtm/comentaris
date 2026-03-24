// autodiagnosi-butlletins.js
// Injector: afegeix la pestanya "Autodiagnosi" a Secretaria → Butlletins
// Genera PDFs amb el format oficial INS Matadepera (autodiagnosi + valoració tutor/a)
// Les dades provenen de autoaval_respostes (col·lecció de autoavaluacio.js)
//
// INSTAL·LACIÓ: afegir a index.html ABANS de </body>:
//   <script type="module" src="autodiagnosi-butlletins.js"></script>

console.log('📋 autodiagnosi-butlletins.js carregat');

// ─────────────────────────────────────────────
// CARREGAR PERÍODES DES DE FIRESTORE
// Llegeix _sistema/periodes_tancats igual que fa secretaria.js
// Retorna [{codi, nom}] en l'ordre configurat per secretaria
// ─────────────────────────────────────────────
async function carregarPeriodesAD() {
  const PERIODES_BASE = [
    { codi: 'preav', nom: 'Pre-avaluació' },
    { codi: 'T1',    nom: '1r Trimestre'  },
    { codi: 'T2',    nom: '2n Trimestre'  },
    { codi: 'T3',    nom: '3r Trimestre'  },
    { codi: 'final', nom: 'Final de curs' },
  ];
  try {
    const doc = await window.db.collection('_sistema').doc('periodes_tancats').get();
    if (!doc.exists) return PERIODES_BASE;
    const data = doc.data();
    const noms  = data.noms  || {};
    const ordre = data.ordre || PERIODES_BASE.map(p => p.codi);
    return ordre.map(codi => {
      const base = PERIODES_BASE.find(p => p.codi === codi) || { codi, nom: codi };
      return { codi, nom: noms[codi] || base.nom };
    });
  } catch(e) {
    return PERIODES_BASE;
  }
}

function opcionsPeriodesHTML(periodes, seleccionat = '') {
  return '<option value="">— Tots els períodes —</option>' +
    periodes.map(p =>
      `<option value="${p.nom}" ${p.nom === seleccionat ? 'selected' : ''}>${p.nom}</option>`
    ).join('');
}



// ─────────────────────────────────────────────
// INICIALITZACIÓ
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initAutodiagnosiBulletins, 1500);
});

function initAutodiagnosiBulletins() {
  if (!window.firebase?.auth) { setTimeout(initAutodiagnosiBulletins, 500); return; }
  window.firebase.auth().onAuthStateChanged(user => {
    if (!user) return;
    // Interceptar l'obertura de la pestanya Butlletins via MutationObserver
    observarPestanyaButlletins();
  });
}

// ─────────────────────────────────────────────
// OBSERVER: detectar quan es renderitza la pestanya Butlletins
// ─────────────────────────────────────────────
function observarPestanyaButlletins() {
  const obs = new MutationObserver(() => {
    // Detectar el títol "📄 Butlletins" al body de secretaria
    const h3 = document.querySelector('#secBody h3');
    if (h3 && h3.textContent.includes('Butlletins')) {
      if (!document.getElementById('tabAutodiagnosi')) {
        injectarTabuladorAutodiagnosi();
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

// ─────────────────────────────────────────────
// INJECTAR TABULADOR
// ─────────────────────────────────────────────
function injectarTabuladorAutodiagnosi() {
  const secBody = document.getElementById('secBody');
  if (!secBody) return;

  // Trobar el h3 de Butlletins per inserir les tabs just sota
  const h3 = secBody.querySelector('h3');
  if (!h3) return;
  if (document.getElementById('tabAutodiagnosi')) return;

  // Crear contenidor de tabs
  const tabsBar = document.createElement('div');
  tabsBar.id = 'adTabsBar';
  tabsBar.style.cssText = `
    display:flex;gap:4px;background:#f3f4f6;border-radius:10px;
    padding:4px;margin-bottom:20px;width:fit-content;
  `;
  tabsBar.innerHTML = `
    <button id="tabButlletiNormal" style="
      padding:8px 18px;border:none;border-radius:7px;font-size:13px;font-weight:700;
      cursor:pointer;background:#7c3aed;color:#fff;transition:all .15s;">
      📄 Butlletins matèries
    </button>
    <button id="tabAutodiagnosi" style="
      padding:8px 18px;border:none;border-radius:7px;font-size:13px;font-weight:700;
      cursor:pointer;background:transparent;color:#6b7280;transition:all .15s;">
      🧠 Autodiagnosi alumne
    </button>
    <button id="tabInfoButlletins" style="
      padding:8px 18px;border:none;border-radius:7px;font-size:13px;font-weight:700;
      cursor:pointer;background:transparent;color:#6b7280;transition:all .15s;">
      📝 Informació butlletins
    </button>
  `;

  // Inserir just després del h3
  h3.insertAdjacentElement('afterend', tabsBar);

  // Guardar el contingut original de butlletins
  const contingutOriginal = document.createElement('div');
  contingutOriginal.id = 'adContingutNormal';
  // Moure tots els elements posteriors al tabsBar al contenidor original
  while (tabsBar.nextSibling) {
    contingutOriginal.appendChild(tabsBar.nextSibling);
  }
  secBody.appendChild(contingutOriginal);

  // Contenidor per a autodiagnosi (inicialment ocult)
  const contingutAuto = document.createElement('div');
  contingutAuto.id = 'adContingutAutodiagnosi';
  contingutAuto.style.display = 'none';
  secBody.appendChild(contingutAuto);

  // Contenidor per a informació butlletins (inicialment ocult)
  const contingutInfo = document.createElement('div');
  contingutInfo.id = 'adContingutInfoButlletins';
  contingutInfo.style.display = 'none';
  secBody.appendChild(contingutInfo);

  // Listeners dels tabs
  document.getElementById('tabButlletiNormal').addEventListener('click', () => {
    activarTab('normal');
  });
  document.getElementById('tabAutodiagnosi').addEventListener('click', () => {
    activarTab('autodiagnosi');
    renderAutodiagnosiPanel(contingutAuto);
  });
  document.getElementById('tabInfoButlletins').addEventListener('click', () => {
    activarTab('info');
    renderInfoButlletinsPanel(contingutInfo);
  });
}

function activarTab(tab) {
  const btnNormal = document.getElementById('tabButlletiNormal');
  const btnAuto   = document.getElementById('tabAutodiagnosi');
  const btnInfo   = document.getElementById('tabInfoButlletins');
  const contNormal = document.getElementById('adContingutNormal');
  const contAuto   = document.getElementById('adContingutAutodiagnosi');
  const contInfo   = document.getElementById('adContingutInfoButlletins');
  if (!btnNormal || !btnAuto) return;

  // Reset tots
  [btnNormal, btnAuto, btnInfo].forEach(b => { if(b) { b.style.background = 'transparent'; b.style.color = '#6b7280'; } });
  [contNormal, contAuto, contInfo].forEach(c => { if(c) c.style.display = 'none'; });

  if (tab === 'normal') {
    btnNormal.style.background = '#7c3aed'; btnNormal.style.color = '#fff';
    if (contNormal) contNormal.style.display = 'block';
  } else if (tab === 'autodiagnosi') {
    btnAuto.style.background = '#7c3aed'; btnAuto.style.color = '#fff';
    if (contAuto) contAuto.style.display = 'block';
  } else if (tab === 'info') {
    btnInfo.style.background = '#7c3aed'; btnInfo.style.color = '#fff';
    if (contInfo) contInfo.style.display = 'block';
  }
}

// ─────────────────────────────────────────────
// PANELL AUTODIAGNOSI
// ─────────────────────────────────────────────
async function renderAutodiagnosiPanel(cont) {
  const db = window.db;
  if (!db) return;

  cont.innerHTML = '<div style="padding:30px;text-align:center;color:#9ca3af;">⏳ Carregant...</div>';

  try {
    const [nivells, grups, cursActiu] = await Promise.all([
      carregarNivellsAD(), carregarGrupsAD(), carregarCursActiuAD()
    ]);

    // Mapa id → grup per resoldre parentGrupId
    const grupsPerId = {};
    grups.forEach(g => { grupsPerId[g.id] = g; });

    // Grups de tutoria (on hi ha alumnes del grup classe)
    const grupsTutoria = grups.filter(g => g.tipus === 'tutoria');
    // Fallback: si no hi ha grups tutoria, usar grups classe amb alumnes
    if (grupsTutoria.length === 0) {
      grupsTutoria.push(...grups.filter(g => g.tipus === 'classe' && (g.alumnes||[]).length > 0));
    }
    const cursos = [...new Set(grups.map(g => g.curs).filter(Boolean))].sort().reverse();

    // Etiqueta llegible: "1r ESO A", "3r ESO C", etc.
    function adEtiquetaGrup(g) {
      const nivell = g.nivellNom || '';
      if (g.tipus === 'tutoria' && g.parentGrupId) {
        const pare = grupsPerId[g.parentGrupId];
        const nomClasse = pare?.nom || g.nom;
        return `${nivell} ${nomClasse}`.trim();
      }
      return `${nivell} ${g.nom || ''}`.trim();
    }

    // Ordenar per etiqueta
    grupsTutoria.sort((a, b) => adEtiquetaGrup(a).localeCompare(adEtiquetaGrup(b), 'ca'));

    // Construir opcions del nivell
    const nivellsUnics = [...new Map(grups.filter(g => g.nivellNom)
      .map(g => [g.nivellNom, g.nivellNom])).values()].sort();

    cont.innerHTML = `
      <h4 style="font-size:15px;font-weight:700;color:#1e1b4b;margin-bottom:16px;">
        🧠 Butlletins d'Autodiagnosi Alumne
      </h4>

      <!-- Filtres -->
      <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:12px;align-items:end;flex-wrap:wrap;">
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Curs acadèmic</label>
            <select id="adCurs" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
              <option value="">— Tria curs —</option>
              ${cursos.map(c => `<option value="${c}" ${c === cursActiu ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Període</label>
            <select id="adTrimestre" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
              <option value="">⏳ Carregant...</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Nivell</label>
            <select id="adNivell" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
              <option value="">— Tots —</option>
              ${nivellsUnics.map(n => `<option value="${n}">${adEsH(n)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Grup de tutoria</label>
            <select id="adGrup" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
              <option value="">— Tria grup —</option>
              ${grupsTutoria.map(g =>
                `<option value="${g.id}">${adEsH(adEtiquetaGrup(g))}</option>`
              ).join('')}
            </select>
          </div>
          <button id="adCarregar" style="padding:8px 18px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap;align-self:flex-end;">
            🔍 Carregar
          </button>
        </div>
      </div>

      <div id="adResultats">
        <div style="text-align:center;padding:40px;color:#9ca3af;font-size:13px;">
          Selecciona el grup i clica "Carregar" per veure les autodiagnosis.
        </div>
      </div>
    `;

    // Carregar períodes reals de Firestore
    carregarPeriodesAD().then(periodes => {
      const sel = document.getElementById('adTrimestre');
      if (sel) sel.innerHTML = '<option value="">— Tots els períodes —</option>' +
        periodes.map(p => `<option value="${p.nom}">${p.nom}</option>`).join('');
    });

    // Filtrar grups per nivell
    document.getElementById('adNivell')?.addEventListener('change', () => {
      const nivell = document.getElementById('adNivell').value;
      const selGrup = document.getElementById('adGrup');
      selGrup.innerHTML = '<option value="">— Tria grup —</option>' +
        grupsTutoria
          .filter(g => !nivell || (g.nivellNom || '') === nivell)
          .map(g => `<option value="${g.id}">${adEsH(adEtiquetaGrup(g))}</option>`)
          .join('');
    });

    document.getElementById('adCarregar').addEventListener('click', () => {
      const grupId = document.getElementById('adGrup').value;
      if (!grupId) { window.mostrarToast?.('⚠️ Tria el grup de tutoria', 3000); return; }
      carregarAutodiagnosis();
    });

  } catch(e) {
    cont.innerHTML = `<div style="color:#ef4444;padding:20px;">❌ Error: ${e.message}</div>`;
  }
}

// ─────────────────────────────────────────────
// CARREGAR AUTODIAGNOSIS DEL GRUP
// ─────────────────────────────────────────────
async function carregarAutodiagnosis() {
  const grupId    = document.getElementById('adGrup')?.value;
  const curs      = document.getElementById('adCurs')?.value;
  const trimestre = document.getElementById('adTrimestre')?.value || '';
  const resDiv    = document.getElementById('adResultats');

  if (!grupId) {
    window.mostrarToast?.('⚠️ Tria el grup de tutoria', 3000);
    return;
  }

  resDiv.innerHTML = '<div style="padding:20px;text-align:center;color:#9ca3af;">⏳ Carregant autodiagnosis...</div>';

  try {
    const db = window.db;

    // Llegir alumnes del grup
    const grupDoc = await db.collection('grups_centre').doc(grupId).get();
    const alumnesGrup = grupDoc.data()?.alumnes || [];
    const grupNom = grupDoc.data()?.nom || '';
    const grupNivell = grupDoc.data()?.nivellNom || '';
    const cursGrup = curs || grupDoc.data()?.curs || '';

    // Llegir tots els usuaris amb rol alumne
    const alumnesSnap = await db.collection('professors')
      .where('rols', 'array-contains', 'alumne')
      .get();
    const alumnesUsuaris = alumnesSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

    // Creuar alumnes del grup amb usuaris
    const alumnesAmbUID = alumnesGrup.map(a => {
      const compte = alumnesUsuaris.find(u =>
        (a.ralc && u.ralc && String(a.ralc) === String(u.ralc)) ||
        (a.email && u.email && a.email === u.email)
      );
      return { ...a, uid: compte?.uid || null };
    });

    const uidsAlumnes = alumnesAmbUID.filter(a => a.uid).map(a => a.uid);

    // Llegir respostes de autoaval_respostes per a aquests alumnes
    let respostes = [];
    if (uidsAlumnes.length > 0) {
      // Firestore limita 'in' a 30 elements, fer chunks
      for (let i = 0; i < uidsAlumnes.length; i += 30) {
        const chunk = uidsAlumnes.slice(i, i + 30);
        const snap = await db.collection('autoaval_respostes')
          .where('alumneUID', 'in', chunk)
          .get();
        respostes.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    }

    // Filtrar per periode si s'ha seleccionat
    const periodeFiltre = document.getElementById('adTrimestre')?.value || '';
    const respostesFiltrades = periodeFiltre
      ? respostes.filter(r => (r.periodeNom || '') === periodeFiltre)
      : respostes;

    // Mapa de respostes per alumne (última per alumne si n'hi ha diverses)
    const respostesPerAlumne = {};
    respostesFiltrades.forEach(r => {
      const existent = respostesPerAlumne[r.alumneUID];
      if (!existent || (r.enviatAt?.seconds || 0) > (existent.enviatAt?.seconds || 0)) {
        respostesPerAlumne[r.alumneUID] = r;
      }
    });

    // Construir llista d'alumnes amb estat
    const llistaAlumnes = alumnesGrup.map(a => {
      const alumneU = alumnesAmbUID.find(u => u.ralc === a.ralc || u.nom === a.nom);
      const resposta = alumneU?.uid ? respostesPerAlumne[alumneU.uid] : null;
      return {
        nom: a.nom || '',
        cognoms: a.cognoms || '',
        ralc: a.ralc || '',
        uid: alumneU?.uid || null,
        resposta: resposta || null,
        teCom: !!alumneU?.uid,
      };
    }).sort((a, b) => (a.cognoms || a.nom).localeCompare(b.cognoms || b.nom, 'ca'));

    const ambResposta = llistaAlumnes.filter(a => a.resposta);
    const senseResposta = llistaAlumnes.filter(a => !a.resposta);

    if (llistaAlumnes.length === 0) {
      resDiv.innerHTML = '<div style="padding:30px;text-align:center;color:#9ca3af;">Cap alumne trobat en aquest grup.</div>';
      return;
    }

    resDiv.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:13px;color:#6b7280;">
          <strong style="color:#1e1b4b;">${llistaAlumnes.length}</strong> alumnes ·
          <strong style="color:#059669;">${ambResposta.length}</strong> amb autodiagnosi ·
          <strong style="color:#dc2626;">${senseResposta.length}</strong> sense
        </div>
        ${ambResposta.length > 0 ? `
        <button id="adGenTots" style="padding:7px 16px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:12px;">
          📄 Generar tots (${ambResposta.length})
        </button>` : ''}
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:9px 12px;text-align:left;font-weight:600;color:#374151;">Alumne/a</th>
            <th style="padding:9px 12px;text-align:center;font-weight:600;color:#374151;">Estat</th>
            <th style="padding:9px 12px;text-align:center;font-weight:600;color:#374151;">Valoració tutor/a</th>
            <th style="padding:9px 12px;text-align:center;font-weight:600;color:#374151;">Accions</th>
          </tr>
        </thead>
        <tbody>
          ${llistaAlumnes.map((a, idx) => {
            const nomComplet = a.cognoms ? `${a.cognoms}, ${a.nom}` : a.nom;
            const estat = a.resposta
              ? a.resposta.estat === 'enviatButlleti'
                ? '<span style="background:#dcfce7;color:#166534;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;">✅ Al butlletí</span>'
                : a.resposta.estat === 'revisat'
                  ? '<span style="background:#fef9c3;color:#713f12;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;">👁 Revisat</span>'
                  : '<span style="background:#dbeafe;color:#1e40af;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;">📥 Rebut</span>'
              : !a.teCom
                ? '<span style="background:#f3f4f6;color:#9ca3af;padding:3px 9px;border-radius:99px;font-size:11px;">Sense compte</span>'
                : '<span style="background:#fef2f2;color:#dc2626;padding:3px 9px;border-radius:99px;font-size:11px;">⏳ Pendent</span>';

            const teValoracio = !!(a.resposta?.comentariTutor);

            return `
              <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:8px 12px;font-weight:600;color:#1e1b4b;">${adEsH(nomComplet)}</td>
                <td style="padding:8px 12px;text-align:center;">${estat}</td>
                <td style="padding:8px 12px;text-align:center;">
                  ${a.resposta
                    ? teValoracio
                      ? '<span style="color:#059669;font-size:12px;">✅ Sí</span>'
                      : '<span style="color:#9ca3af;font-size:12px;">— No</span>'
                    : '—'}
                </td>
                <td style="padding:8px 12px;text-align:center;">
                  ${a.resposta ? `
                    <button class="ad-btn-pdf" data-idx="${idx}"
                      style="padding:5px 12px;background:#4f46e5;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;margin-right:4px;">
                      📄 PDF
                    </button>` : '—'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    // Guardar dades per als botons
    // Recuperar l'etiqueta llegible del grup (si és tutoria, usar el nom del grup classe pare)
    const grupDocData = grupDoc.data() || {};
    let etiquetaGrupFinal = `${grupNivell} ${grupNom}`.trim();
    if (grupDocData.tipus === 'tutoria' && grupDocData.parentGrupId) {
      try {
        const pareDoc = await db.collection('grups_centre').doc(grupDocData.parentGrupId).get();
        if (pareDoc.exists) {
          etiquetaGrupFinal = `${grupNivell} ${pareDoc.data().nom || grupNom}`.trim();
        }
      } catch(e) {}
    }

    window._adLlistaAlumnes  = llistaAlumnes;
    window._adGrupNom        = grupNom;
    window._adGrupNivell     = grupNivell;
    window._adGrupEtiqueta   = etiquetaGrupFinal;
    window._adCurs           = cursGrup;
    window._adTrimestre      = trimestre;

    // Listener botons PDF individuals
    resDiv.querySelectorAll('.ad-btn-pdf').forEach(btn => {
      btn.addEventListener('click', () => {
        const alumne = window._adLlistaAlumnes[parseInt(btn.dataset.idx)];
        if (alumne?.resposta) generarPDFAutodiagnosi(alumne, window._adGrupEtiqueta || window._adGrupNom, '', window._adCurs, window._adTrimestre);
      });
    });

    // Listener botó generar tots
    document.getElementById('adGenTots')?.addEventListener('click', () => {
      window._adLlistaAlumnes
        .filter(a => a.resposta)
        .forEach(a => generarPDFAutodiagnosi(a, window._adGrupEtiqueta || window._adGrupNom, '', window._adCurs, window._adTrimestre));
    });

  } catch(e) {
    resDiv.innerHTML = `<div style="color:#ef4444;padding:20px;">❌ Error: ${e.message}</div>`;
    console.error('autodiagnosi-butlletins:', e);
  }
}

// ─────────────────────────────────────────────
// GENERAR PDF — FORMAT OFICIAL INS MATADEPERA
// ─────────────────────────────────────────────
function generarPDFAutodiagnosi(alumne, grupNom, grupNivell, curs, trimestre) {
  const r = alumne.resposta;
  const nomComplet = alumne.cognoms
    ? `${alumne.cognoms}, ${alumne.nom}`
    : alumne.nom;

  // Construir text d'autodiagnosi de les respostes
  const preguntes = r.preguntes || [];
  const respostesMap = r.respostes || {};
  const textAutodiagnosi = preguntes.length > 0
    ? preguntes.map(p => respostesMap[p.id] || '').filter(Boolean).join('\n\n')
    : r.respostesText || Object.values(respostesMap).join('\n\n') || '—';

  const comentariTutor = r.comentariTutor || '';
  const dataAvui = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const trimestreText = trimestre || r.periodeNom || '1r butlletí d\'avaluació';
  const grupDisplay = grupNom || '';  // grupNom ja porta l'etiqueta completa (ex: "1r ESO A")

  const html = `<!DOCTYPE html>
<html lang="ca">
<head>
  <meta charset="UTF-8">
  <title>Autodiagnosi — ${nomComplet}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      color: #111;
      padding: 15mm 20mm;
    }

    /* CAPÇALERA */
    .cap {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
      padding-bottom: 10px;
      border-bottom: 2px solid #1e1b4b;
    }
    .cap-esquerra {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 180px;
    }
    .cap-titol {
      text-align: center;
      font-size: 13pt;
      font-weight: bold;
      color: #1e1b4b;
      flex: 1;
      padding: 0 20px;
    }
    .cap-logo {
      min-width: 80px;
      text-align: right;
    }

    /* INTRO */
    .intro {
      font-size: 10pt;
      color: #333;
      line-height: 1.6;
      margin-bottom: 16px;
    }

    /* TAULA PRINCIPAL */
    .taula-principal {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #111;
      margin-bottom: 20px;
    }
    .taula-principal td {
      border: 1.5px solid #111;
      padding: 8px 12px;
      vertical-align: top;
      font-size: 10.5pt;
    }
    .taula-principal .cap-fila {
      background: #f3f4f6;
      font-weight: bold;
      font-size: 10.5pt;
      width: 180px;
      vertical-align: top;
    }
    .taula-caps td {
      font-weight: bold;
      font-size: 10.5pt;
      background: #fff;
      padding: 6px 12px;
    }
    .text-autodiag {
      font-size: 10pt;
      line-height: 1.6;
      white-space: pre-wrap;
      color: #222;
    }
    .text-valoracio {
      font-size: 10pt;
      line-height: 1.7;
      white-space: pre-wrap;
      color: #222;
    }
    .text-buit {
      color: #9ca3af;
      font-style: italic;
      font-size: 10pt;
    }

    /* PEU */
    .peu {
      margin-top: 24px;
      font-size: 9.5pt;
      color: #555;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .peu a { color: #1e1b4b; }
    .data-lloc { font-size: 10pt; color: #333; }

    /* NOTA A PEU */
    .nota-peu {
      margin-top: 30px;
      border-top: 1px solid #ccc;
      padding-top: 8px;
      font-size: 8.5pt;
      color: #555;
      line-height: 1.5;
    }

    @media print {
      body { padding: 12mm 15mm; }
    }
  </style>
</head>
<body>

  <!-- CAPÇALERA -->
  <div class="cap">
    <div class="cap-esquerra">
      <img src="data:image/png;base64,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" alt="Generalitat de Catalunya" style="height:52px;width:auto;display:block;margin-bottom:4px;">
      <div style="font-size:9pt;color:#333;line-height:1.4;">
        <div>Generalitat de Catalunya</div>
        <div>Departament d'ensenyament</div>
        <div><strong>INS Matadepera</strong></div>
      </div>
    </div>
    <div class="cap-titol">
      ${adEsH(trimestreText)} · Curs ${adEsH(curs)}
    </div>
    <div class="cap-logo">
      <img src="data:image/png;base64,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" alt="Institut Matadepera" style="height:52px;width:auto;display:block;margin-left:auto;">
    </div>
  </div>

  <!-- INTRODUCCIÓ -->
  <p class="intro">
    En aquest butlletí es presenta una autodiagnosi de l'alumne/a. En aquesta valora
    com està afrontant i assolint els aprenentatges fins al dia d'avui en base als ítems<sup>1</sup>
    descrits a la part final d'aquest document. El comentari del tutor/a, que fa en nom
    de l'equip docent, és una valoració dels mateixos aspectes basada en la lectura de
    l'autodiagnosi.
  </p>

  <!-- TAULA PRINCIPAL -->
  <table class="taula-principal">
    <!-- Fila capçalera: Nom i Grup -->
    <tr class="taula-caps">
      <td style="width:55%;border-right:1.5px solid #111;">
        <strong>Nom i cognoms:</strong> ${adEsH(nomComplet)}
      </td>
      <td>
        <strong>Grup classe:</strong> ${adEsH(grupDisplay)}
      </td>
    </tr>
    <!-- Fila tutor -->
    <tr class="taula-caps">
      <td colspan="2">
        <strong>Tutor/a:</strong>
      </td>
    </tr>
    <!-- Fila autodiagnosi -->
    <tr>
      <td class="cap-fila">Autodiagnosi alumne/a</td>
      <td>
        ${textAutodiagnosi
          ? `<div class="text-autodiag">${adEsH(textAutodiagnosi)}</div>`
          : '<div class="text-buit">L\'alumne/a no ha completat l\'autodiagnosi.</div>'}
      </td>
    </tr>
    <!-- Fila valoració tutor/a -->
    <tr>
      <td class="cap-fila">Valoració tutor/a</td>
      <td>
        ${comentariTutor
          ? `<div class="text-valoracio">${adEsH(comentariTutor)}</div>`
          : '<div class="text-buit">El/la tutor/a encara no ha afegit la valoració.</div>'}
      </td>
    </tr>
  </table>

  <!-- PEU DE PÀGINA -->
  <div class="peu">
    <div>
      Cliqueu el següent
      <a href="#">enllaç</a>
      per respondre la part del butlletí d'avaluació corresponent a
      les famílies i confirmar la visualització del butlletí.
    </div>
  </div>

  <div class="data-lloc" style="margin-top:12px;">
    Matadepera, ${dataAvui}
  </div>

  <!-- NOTA A PEU -->
  <div class="nota-peu">
    <sup>1</sup> <em>Descripció dels ítems avaluables:</em><br>
    <em>a. <u>Treball a classe.</u> Entenem per això: atenció, escolta activa, fa les tasques de classe, és responsable amb el treball del seu grup, etc.</em><br>
    <em>b. <u>Organització i autonomia.</u> Entenem per això: apuntar-se les tasques, portar el material, portar les tasques fetes, posar-se a treballar a classe sense que se li hagi d'insistir molt, etc.</em><br>
    <em>c. <u>Interès per aprendre.</u> Entenem per això: participar a classe, fer el màxim perquè el grup compleixi els encàrrecs, fa preguntes (si són interessants, millor), intentar fer les feines ben fetes (i no per sortir del pas), explica el que fa a la família.</em><br>
    <em>d. <u>Assoliment d'objectius d'aprenentatge.</u> Entenem per això: què està aprenent en les diferents matèries.</em>
  </div>

</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    window.mostrarToast?.('⚠️ Permet les finestres emergents al navegador', 4000);
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function adEsH(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function carregarNivellsAD() {
  try {
    const snap = await window.db.collection('nivells_centre').orderBy('ordre').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { return []; }
}

async function carregarGrupsAD() {
  try {
    const snap = await window.db.collection('grups_centre').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { return []; }
}

async function carregarCursActiuAD() {
  if (window._cursActiu) return window._cursActiu;
  try {
    const doc = await window.db.collection('_sistema').doc('config').get();
    return doc.data()?.cursActiu || '';
  } catch(e) { return ''; }
}

// ─────────────────────────────────────────────
// PANELL INFORMACIÓ BUTLLETINS
// Permet a secretaria escriure un text per període
// que apareixerà als butlletins com a "Resultats de l'avaluació"
// Guardat a: _sistema/info_butlletins → { [nomPeriode]: text }
// ─────────────────────────────────────────────
async function renderInfoButlletinsPanel(cont) {
  cont.innerHTML = '<div style="padding:30px;text-align:center;color:#9ca3af;">⏳ Carregant...</div>';

  try {
    const periodes = await carregarPeriodesAD();
    const doc = await window.db.collection('_sistema').doc('info_butlletins').get();
    const infoActual = doc.exists ? (doc.data() || {}) : {};

    // Render del panell
    cont.innerHTML = `
      <div style="max-width:700px;">
        <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;
                    padding:14px 18px;margin-bottom:20px;font-size:13px;color:#166534;">
          <strong>📝 Informació dels butlletins per període</strong><br>
          <span style="font-size:12px;">El text que escriguis aquí apareixerà a l'apartat
          <em>"Resultats de l'avaluació"</em> dels butlletins del període seleccionat.</span>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">
            Període
          </label>
          <select id="infoBPeriode" style="width:100%;max-width:320px;padding:9px 12px;
            border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
            ${periodes.map(p => `<option value="${adEsH(p.nom)}">${adEsH(p.nom)}</option>`).join('')}
          </select>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px;">
            Text per als butlletins d'aquest període
          </label>
          <textarea id="infoBText" rows="8"
            placeholder="Escriu aquí la informació que apareixerà als butlletins d'aquest període..."
            style="width:100%;box-sizing:border-box;padding:10px 12px;
                   border:1.5px solid #e5e7eb;border-radius:10px;font-size:13px;
                   outline:none;resize:vertical;font-family:inherit;line-height:1.6;">
          </textarea>
        </div>

        <div style="display:flex;align-items:center;gap:12px;">
          <button id="infoBDesar" style="padding:9px 22px;background:#7c3aed;color:#fff;
            border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">
            💾 Desar
          </button>
          <span id="infoBMsg" style="font-size:12px;color:#059669;"></span>
        </div>
      </div>
    `;

    // Funció per carregar el text del període seleccionat
    const carregarText = () => {
      const periode = document.getElementById('infoBPeriode')?.value;
      const textarea = document.getElementById('infoBText');
      if (textarea) textarea.value = infoActual[periode] || '';
      document.getElementById('infoBMsg').textContent = '';
    };

    // Carregar text inicial
    carregarText();

    // Canvi de període → carregar el seu text
    document.getElementById('infoBPeriode')?.addEventListener('change', carregarText);

    // Desar
    document.getElementById('infoBDesar')?.addEventListener('click', async () => {
      const periode = document.getElementById('infoBPeriode')?.value;
      const text    = document.getElementById('infoBText')?.value?.trim() || '';
      const btnD    = document.getElementById('infoBDesar');
      const msgEl   = document.getElementById('infoBMsg');
      if (!periode) return;

      btnD.disabled = true; btnD.textContent = '⏳ Desant...';
      try {
        await window.db.collection('_sistema').doc('info_butlletins').set(
          { [periode]: text },
          { merge: true }
        );
        infoActual[periode] = text; // actualitzar cache local
        msgEl.textContent = '✅ Desat correctament';
        msgEl.style.color = '#059669';
        setTimeout(() => { if(msgEl) msgEl.textContent = ''; }, 3000);
      } catch(e) {
        msgEl.textContent = '❌ Error: ' + e.message;
        msgEl.style.color = '#dc2626';
      }
      btnD.disabled = false; btnD.textContent = '💾 Desar';
    });

  } catch(e) {
    cont.innerHTML = `<div style="color:#ef4444;padding:16px;">Error: ${e.message}</div>`;
  }
}

console.log('✅ autodiagnosi-butlletins.js: inicialitzat');
