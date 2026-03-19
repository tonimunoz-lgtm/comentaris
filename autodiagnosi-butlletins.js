// autodiagnosi-butlletins.js
// Injector: afegeix la pestanya "Autodiagnosi" a Secretaria → Butlletins
// Genera PDFs amb el format oficial INS Matadepera (autodiagnosi + valoració tutor/a)
// Les dades provenen de autoaval_respostes (col·lecció de autoavaluacio.js)
//
// INSTAL·LACIÓ: afegir a index.html ABANS de </body>:
//   <script type="module" src="autodiagnosi-butlletins.js"></script>

console.log('📋 autodiagnosi-butlletins.js carregat');

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

  // Listeners dels tabs
  document.getElementById('tabButlletiNormal').addEventListener('click', () => {
    activarTab('normal');
  });
  document.getElementById('tabAutodiagnosi').addEventListener('click', () => {
    activarTab('autodiagnosi');
    renderAutodiagnosiPanel(contingutAuto);
  });
}

function activarTab(tab) {
  const btnNormal = document.getElementById('tabButlletiNormal');
  const btnAuto   = document.getElementById('tabAutodiagnosi');
  const contNormal = document.getElementById('adContingutNormal');
  const contAuto   = document.getElementById('adContingutAutodiagnosi');
  if (!btnNormal || !btnAuto) return;

  if (tab === 'normal') {
    btnNormal.style.background = '#7c3aed'; btnNormal.style.color = '#fff';
    btnAuto.style.background = 'transparent'; btnAuto.style.color = '#6b7280';
    if (contNormal) contNormal.style.display = 'block';
    if (contAuto)   contAuto.style.display   = 'none';
  } else {
    btnAuto.style.background = '#7c3aed'; btnAuto.style.color = '#fff';
    btnNormal.style.background = 'transparent'; btnNormal.style.color = '#6b7280';
    if (contNormal) contNormal.style.display = 'none';
    if (contAuto)   contAuto.style.display   = 'block';
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

    // Grups de tutoria (on hi ha alumnes del grup classe)
    const grupsTutoria = grups.filter(g =>
      g.tipus === 'tutoria' || (g.tipus === 'classe' && (g.alumnes||[]).length > 0)
    );
    const cursos = [...new Set(grups.map(g => g.curs).filter(Boolean))].sort().reverse();

    cont.innerHTML = `
      <h4 style="font-size:15px;font-weight:700;color:#1e1b4b;margin-bottom:16px;">
        🧠 Butlletins d'Autodiagnosi Alumne
      </h4>

      <!-- Filtres -->
      <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:12px;align-items:end;">
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Curs acadèmic</label>
            <select id="adCurs" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
              <option value="">— Tria curs —</option>
              ${cursos.map(c => `<option value="${c}" ${c === cursActiu ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Trimestre</label>
            <select id="adTrimestre" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
              <option value="">— Tots —</option>
              <option value="1r Trimestre" selected>1r Trimestre</option>
              <option value="2n Trimestre">2n Trimestre</option>
              <option value="3r Trimestre">3r Trimestre</option>
              <option value="Final de curs">Final de curs</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Grup de tutoria</label>
            <select id="adGrup" style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
              <option value="">— Tria grup —</option>
              ${grupsTutoria.map(g =>
                `<option value="${g.id}">${adEsH(g.nivellNom || '')} ${adEsH(g.nom)} (${adEsH(g.curs || '')})</option>`
              ).join('')}
            </select>
          </div>
          <button id="adCarregar" style="padding:8px 18px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap;">
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

    document.getElementById('adCarregar').addEventListener('click', () => {
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

    // Mapa de respostes per alumne (última per alumne si n'hi ha diverses)
    const respostesPerAlumne = {};
    respostes.forEach(r => {
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
    window._adLlistaAlumnes = llistaAlumnes;
    window._adGrupNom       = grupNom;
    window._adGrupNivell    = grupNivell;
    window._adCurs          = cursGrup;
    window._adTrimestre     = trimestre;

    // Listener botons PDF individuals
    resDiv.querySelectorAll('.ad-btn-pdf').forEach(btn => {
      btn.addEventListener('click', () => {
        const alumne = window._adLlistaAlumnes[parseInt(btn.dataset.idx)];
        if (alumne?.resposta) generarPDFAutodiagnosi(alumne, window._adGrupNom, window._adGrupNivell, window._adCurs, window._adTrimestre);
      });
    });

    // Listener botó generar tots
    document.getElementById('adGenTots')?.addEventListener('click', () => {
      window._adLlistaAlumnes
        .filter(a => a.resposta)
        .forEach(a => generarPDFAutodiagnosi(a, window._adGrupNom, window._adGrupNivell, window._adCurs, window._adTrimestre));
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
  const grupDisplay = `${grupNivell} ${grupNom}`.trim() || grupNom;

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
      align-items: flex-start;
      margin-bottom: 18px;
      padding-bottom: 10px;
      border-bottom: 2px solid #1e1b4b;
    }
    .cap-esquerra { font-size: 9.5pt; color: #333; line-height: 1.5; }
    .cap-esquerra strong { font-size: 10pt; }
    .cap-titol {
      text-align: center;
      font-size: 13pt;
      font-weight: bold;
      color: #1e1b4b;
      flex: 1;
      padding: 0 20px;
    }
    .cap-logo {
      width: 70px;
      text-align: right;
      font-size: 9pt;
      color: #555;
      font-style: italic;
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
      <div>Generalitat de Catalunya</div>
      <div>Departament d'ensenyament</div>
      <div><strong>INS Matadepera</strong></div>
    </div>
    <div class="cap-titol">
      ${adEsH(trimestreText)} · Curs ${adEsH(curs)}
    </div>
    <div class="cap-logo">
      INSTITUT<br>MATADEPERA
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

console.log('✅ autodiagnosi-butlletins.js: inicialitzat');
