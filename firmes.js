// firmes.js — Injector per a Secretaria
// Afegeix la pestanya "✍️ Firmes" al panell de Secretaria
// Permet:
//   1. Assignar nom i cognoms del tutor/a a cada grup (manual o via Excel)
//   2. Pujar imatge de firma + segell del director/a
//   3. Els butlletins llegiran aquestes dades automàticament

console.log('✍️ firmes.js carregat');

/* ══════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════ */
const FIRMES_CONFIG_DOC = '_sistema/firmes_config';   // doc Firestore on es desa tot
const COL_TUTORS        = '_tutors_grup';              // subcol (no s'usa, tot va al doc)

/* ══════════════════════════════════════════════════════
   INICIALITZACIÓ: espera que secretaria obri la pestanya
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initFirmesInjector, 1600);
});

function initFirmesInjector() {
  if (!window.firebase?.auth) { setTimeout(initFirmesInjector, 500); return; }
  window.firebase.auth().onAuthStateChanged(user => {
    if (!user) return;
    observarPanellSecretariaFirmes();
  });
}

let _firmesObserver = null;

function observarPanellSecretariaFirmes() {
  if (_firmesObserver) return;
  _firmesObserver = new MutationObserver(() => {
    const overlay = document.getElementById('panellSecretaria');
    if (!overlay) return;
    const tabsBar = overlay.querySelector('.sec-tab[data-tab="butlletins"]')?.parentElement;
    if (!tabsBar) return;
    if (tabsBar.querySelector('.sec-tab[data-tab="firmes"]')) return;

    // Injectar la nova tab
    const btn = document.createElement('button');
    btn.className = 'sec-tab';
    btn.dataset.tab = 'firmes';
    btn.style.cssText = `
      padding:7px 14px;border-radius:8px 8px 0 0;border:none;cursor:pointer;
      font-size:13px;font-weight:600;
      background:rgba(255,255,255,0.15);color:#fff;white-space:nowrap;`;
    btn.textContent = '✍️ Firmes';
    tabsBar.appendChild(btn);

    // Enganxar l'event al nou botó (els altres ja estan registrats a secretaria.js)
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.sec-tab').forEach(t => {
        t.style.background = 'rgba(255,255,255,0.15)'; t.style.color = '#fff';
      });
      btn.style.background = '#fff'; btn.style.color = '#4c1d95';
      renderFirmes(document.getElementById('secBody'));
    });
  });
  _firmesObserver.observe(document.body, { childList: true, subtree: true });
}

/* ══════════════════════════════════════════════════════
   RENDER PRINCIPAL
══════════════════════════════════════════════════════ */
async function renderFirmes(body) {
  if (!body) return;
  body.innerHTML = `<div style="padding:40px;text-align:center;color:#9ca3af;">⏳ Carregant firmes...</div>`;

  try {
    // Carregar config actual + grups
    const [cfgSnap, grupsSnap] = await Promise.all([
      window.db.doc(FIRMES_CONFIG_DOC).get().catch(() => null),
      window.db.collection('grups_centre').where('tipus','==','classe').get()
    ]);

    const cfg = cfgSnap?.data() || {};
    const tutorsMap   = cfg.tutors   || {};   // { grupId: { nom, cognom1, cognom2, firmaBase64 } }
    const directorData = cfg.director || {};  // { nom, cognom1, cognom2, firmaBase64, segellBase64 }
    const logosData    = cfg.logos    || {};  // { generalitat: base64, institut: base64 }
    const textosData   = cfg.textos   || {};  // { linia1, linia2, linia3, faltesAssistencia }

    const grups = grupsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) =>
        (a.curs||'').localeCompare(b.curs||'') ||
        (a.nivellNom||'').localeCompare(b.nivellNom||'', 'ca') ||
        (a.nom||'').localeCompare(b.nom||'', 'ca')
      );

    // Agrupar per curs
    const cursos = [...new Set(grups.map(g => g.curs).filter(Boolean))].sort().reverse();

    body.innerHTML = `
      <h3 style="font-size:16px;font-weight:700;color:#1e1b4b;margin-bottom:4px;">✍️ Firmes per als butlletins</h3>
      <p style="font-size:12px;color:#6b7280;margin-bottom:20px;">
        Assigna el nom del tutor/a a cada grup i configura la firma del director/a.
        Aquesta informació s'afegirà automàticament als butlletins impresos.
      </p>

      <!-- ─── SECCIÓ DIRECTOR ─── -->
      <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:14px;padding:20px;margin-bottom:24px;">
        <div style="font-size:14px;font-weight:700;color:#1e1b4b;margin-bottom:14px;">🏛️ Director/a i segell del centre</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Nom</label>
            <input id="dirNom" type="text" placeholder="Nom del director/a"
              value="${esHF(directorData.nom||'')}"
              style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Primer cognom</label>
            <input id="dirCog1" type="text" placeholder="Primer cognom"
              value="${esHF(directorData.cognom1||'')}"
              style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Segon cognom</label>
            <input id="dirCog2" type="text" placeholder="Segon cognom (opcional)"
              value="${esHF(directorData.cognom2||'')}"
              style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;">
          </div>
        </div>

        <!-- Imatges firma + segell -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
          <!-- Firma director -->
          <div style="border:1.5px dashed #c4b5fd;border-radius:10px;padding:14px;text-align:center;background:#faf5ff;">
            <div style="font-size:12px;font-weight:600;color:#4c1d95;margin-bottom:8px;">✏️ Imatge de la firma</div>
            ${directorData.firmaBase64
              ? `<img id="prevFirma" src="${directorData.firmaBase64}"
                   style="max-height:70px;max-width:100%;object-fit:contain;display:block;margin:0 auto 8px;">`
              : `<div id="prevFirma" style="height:60px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;">
                   Cap imatge
                 </div>`
            }
            <label style="display:inline-block;padding:6px 14px;background:#7c3aed;color:#fff;border-radius:7px;
                          font-size:12px;font-weight:600;cursor:pointer;margin-top:4px;">
              📂 Triar imatge
              <input id="inpFirma" type="file" accept="image/*" style="display:none;">
            </label>
            ${directorData.firmaBase64
              ? `<button id="btnEsborrarFirma" style="display:block;margin:6px auto 0;padding:4px 12px;background:#fee2e2;
                   color:#dc2626;border:none;border-radius:6px;font-size:11px;cursor:pointer;">🗑 Esborrar</button>`
              : ''}
          </div>

          <!-- Segell centre -->
          <div style="border:1.5px dashed #c4b5fd;border-radius:10px;padding:14px;text-align:center;background:#faf5ff;">
            <div style="font-size:12px;font-weight:600;color:#4c1d95;margin-bottom:8px;">🔵 Segell del centre</div>
            ${directorData.segellBase64
              ? `<img id="prevSegell" src="${directorData.segellBase64}"
                   style="max-height:70px;max-width:100%;object-fit:contain;display:block;margin:0 auto 8px;">`
              : `<div id="prevSegell" style="height:60px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;">
                   Cap imatge
                 </div>`
            }
            <label style="display:inline-block;padding:6px 14px;background:#7c3aed;color:#fff;border-radius:7px;
                          font-size:12px;font-weight:600;cursor:pointer;margin-top:4px;">
              📂 Triar imatge
              <input id="inpSegell" type="file" accept="image/*" style="display:none;">
            </label>
            ${directorData.segellBase64
              ? `<button id="btnEsborrarSegell" style="display:block;margin:6px auto 0;padding:4px 12px;background:#fee2e2;
                   color:#dc2626;border:none;border-radius:6px;font-size:11px;cursor:pointer;">🗑 Esborrar</button>`
              : ''}
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;">
          <button id="btnGuardarDirector"
            style="padding:9px 20px;background:#4c1d95;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">
            💾 Guardar director/a
          </button>
        </div>
      </div>

      <!-- ─── SECCIÓ TUTORS ─── -->
      <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:14px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
          <div style="font-size:14px;font-weight:700;color:#1e1b4b;">👩‍🏫 Tutors/es per grup</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button id="btnGuardarTutors"
              style="padding:7px 16px;background:#4c1d95;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
              💾 Guardar tots
            </button>
            <label style="padding:7px 14px;background:#0f766e;color:#fff;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">
              📊 Importar Excel
              <input id="inpExcelTutors" type="file" accept=".xlsx,.xls,.csv" style="display:none;">
            </label>
          </div>
        </div>

        <!-- Info import Excel -->
        <div id="excelTutorsInfo" style="display:none;background:#ede9fe;border:1.5px solid #c4b5fd;border-radius:10px;padding:14px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:700;color:#4c1d95;margin-bottom:10px;">📊 Importació Excel</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:12px;">
            <div>
              <label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:3px;">Columna NOM</label>
              <select id="exColNom" style="width:100%;padding:6px 8px;border:1.5px solid #c4b5fd;border-radius:7px;font-size:12px;"></select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:3px;">Columna PRIMER COGNOM</label>
              <select id="exColCog1" style="width:100%;padding:6px 8px;border:1.5px solid #c4b5fd;border-radius:7px;font-size:12px;"></select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:3px;">Columna SEGON COGNOM</label>
              <select id="exColCog2" style="width:100%;padding:6px 8px;border:1.5px solid #c4b5fd;border-radius:7px;font-size:12px;"></select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:3px;">Columna GRUP (codi o nom)</label>
              <select id="exColGrup" style="width:100%;padding:6px 8px;border:1.5px solid #c4b5fd;border-radius:7px;font-size:12px;"></select>
            </div>
          </div>
          <div id="excelTutorsPreview" style="font-size:11px;color:#6b7280;margin-bottom:10px;"></div>
          <button id="btnAplicarExcel" style="padding:7px 16px;background:#0f766e;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
            ✅ Aplicar importació
          </button>
          <button id="btnCancelExcel" style="padding:7px 14px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;margin-left:8px;">
            Cancel·lar
          </button>
        </div>

        <!-- Llista de grups -->
        ${cursos.length === 0
          ? '<p style="color:#9ca3af;text-align:center;padding:20px;">No hi ha grups classe definits.</p>'
          : cursos.map(curs => {
              const grupsDelCurs = grups.filter(g => g.curs === curs);
              return `
                <div style="margin-bottom:16px;">
                  <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
                              letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;
                              border-bottom:1px solid #e5e7eb;">
                    Curs ${esHF(curs)}
                  </div>
                  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px;">
                    ${grupsDelCurs.map(g => {
                      const t = tutorsMap[g.id] || {};
                      const teFirma = !!t.firmaBase64;
                      return `
                        <div class="fila-tutor" data-grup-id="${g.id}"
                          style="background:#fff;border:1.5px solid #e5e7eb;border-radius:10px;padding:12px 14px;">
                          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:6px;flex-wrap:wrap;">
                            <div style="font-size:12px;font-weight:700;color:#1e1b4b;">
                              🏫 ${esHF(g.nom)} <span style="font-weight:400;color:#9ca3af;">${esHF(g.nivellNom||'')}</span>
                            </div>
                            <button class="btn-firma-tutor" data-grup-id="${g.id}"
                              style="padding:4px 10px;background:${teFirma ? '#d1fae5' : '#ede9fe'};
                                     color:${teFirma ? '#065f46' : '#4c1d95'};
                                     border:1.5px solid ${teFirma ? '#6ee7b7' : '#c4b5fd'};
                                     border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">
                              ${teFirma ? '✅ Firma inclosa' : '✏️ Incloure firma'}
                            </button>
                          </div>
                          <!-- Zona firma tutor (oculta per defecte) -->
                          <div class="zona-firma-tutor" data-grup-id="${g.id}"
                            style="display:none;border:1.5px dashed #c4b5fd;border-radius:9px;padding:10px;
                                   background:#faf5ff;text-align:center;margin-bottom:8px;">
                            <div style="font-size:11px;font-weight:600;color:#4c1d95;margin-bottom:6px;">✏️ Firma del tutor/a</div>
                            ${teFirma
                              ? `<img class="prev-firma-tutor" src="${t.firmaBase64}"
                                   style="max-height:60px;max-width:100%;object-fit:contain;display:block;margin:0 auto 6px;">`
                              : `<div class="prev-firma-tutor" style="height:50px;display:flex;align-items:center;
                                   justify-content:center;color:#9ca3af;font-size:11px;">Cap imatge</div>`
                            }
                            <label style="display:inline-block;padding:5px 12px;background:#7c3aed;color:#fff;
                                          border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;margin-top:4px;">
                              📂 Triar imatge
                              <input type="file" accept="image/*" class="inp-firma-tutor" style="display:none;">
                            </label>
                            ${teFirma
                              ? `<button class="btn-esborrar-firma-tutor"
                                   style="display:block;margin:5px auto 0;padding:3px 10px;background:#fee2e2;
                                          color:#dc2626;border:none;border-radius:6px;font-size:10px;cursor:pointer;">
                                   🗑 Esborrar firma
                                 </button>`
                              : ''
                            }
                          </div>
                          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
                            <input type="text" class="inp-tutor-nom" placeholder="Nom"
                              value="${esHF(t.nom||'')}"
                              style="padding:6px 8px;border:1.5px solid #e5e7eb;border-radius:7px;font-size:12px;outline:none;min-width:0;">
                            <input type="text" class="inp-tutor-cog1" placeholder="1r cognom"
                              value="${esHF(t.cognom1||'')}"
                              style="padding:6px 8px;border:1.5px solid #e5e7eb;border-radius:7px;font-size:12px;outline:none;min-width:0;">
                            <input type="text" class="inp-tutor-cog2" placeholder="2n cognom"
                              value="${esHF(t.cognom2||'')}"
                              style="padding:6px 8px;border:1.5px solid #e5e7eb;border-radius:7px;font-size:12px;outline:none;min-width:0;">
                          </div>
                        </div>`;
                    }).join('')}
                  </div>
                </div>`;
            }).join('')
        }
      </div>

      <!-- ─── SECCIÓ LOGOS ─── -->
      <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:14px;padding:20px;margin-bottom:24px;">
        <div style="font-size:14px;font-weight:700;color:#1e1b4b;margin-bottom:4px;">🖼️ Logos de l'encapçalament</div>
        <p style="font-size:12px;color:#6b7280;margin-bottom:16px;">
          Aquests logos apareixeran a l'encapçalament dels butlletins i de l'autodiagnosi de l'alumne.
          Recomanem imatges en format PNG amb fons transparent o blanc net.
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">

          <!-- Logo Generalitat (esquerra) -->
          <div style="border:1.5px dashed #c4b5fd;border-radius:10px;padding:14px;text-align:center;background:#faf5ff;">
            <div style="font-size:12px;font-weight:600;color:#4c1d95;margin-bottom:8px;">🏛️ Logo Generalitat <span style="font-weight:400;color:#9ca3af;">(esquerra)</span></div>
            ${logosData.generalitat
              ? `<img id="prevLogoGen" src="${logosData.generalitat}"
                   style="max-height:60px;max-width:100%;object-fit:contain;display:block;margin:0 auto 8px;">`
              : `<div id="prevLogoGen" style="height:55px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;">Cap imatge</div>`
            }
            <label style="display:inline-block;padding:6px 14px;background:#7c3aed;color:#fff;border-radius:7px;
                          font-size:12px;font-weight:600;cursor:pointer;margin-top:4px;">
              📂 Triar imatge
              <input id="inpLogoGen" type="file" accept="image/*" style="display:none;">
            </label>
            ${logosData.generalitat
              ? `<button id="btnEsborrarLogoGen" style="display:block;margin:6px auto 0;padding:4px 12px;background:#fee2e2;
                   color:#dc2626;border:none;border-radius:6px;font-size:11px;cursor:pointer;">🗑 Esborrar</button>`
              : ''}
          </div>

          <!-- Logo Institut (dreta) -->
          <div style="border:1.5px dashed #c4b5fd;border-radius:10px;padding:14px;text-align:center;background:#faf5ff;">
            <div style="font-size:12px;font-weight:600;color:#4c1d95;margin-bottom:8px;">🏫 Logo Institut <span style="font-weight:400;color:#9ca3af;">(dreta)</span></div>
            ${logosData.institut
              ? `<img id="prevLogoIns" src="${logosData.institut}"
                   style="max-height:60px;max-width:100%;object-fit:contain;display:block;margin:0 auto 8px;">`
              : `<div id="prevLogoIns" style="height:55px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;">Cap imatge</div>`
            }
            <label style="display:inline-block;padding:6px 14px;background:#7c3aed;color:#fff;border-radius:7px;
                          font-size:12px;font-weight:600;cursor:pointer;margin-top:4px;">
              📂 Triar imatge
              <input id="inpLogoIns" type="file" accept="image/*" style="display:none;">
            </label>
            ${logosData.institut
              ? `<button id="btnEsborrarLogoIns" style="display:block;margin:6px auto 0;padding:4px 12px;background:#fee2e2;
                   color:#dc2626;border:none;border-radius:6px;font-size:11px;cursor:pointer;">🗑 Esborrar</button>`
              : ''}
          </div>
        </div>

        <!-- Textos encapçalament i peu -->
        <div style="border-top:1px solid #e5e7eb;margin-top:8px;padding-top:16px;">
          <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:10px;">📝 Textos de l'encapçalament i peu de pàgina</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div>
              <label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:3px;">Línia 1 (ex: Generalitat de Catalunya)</label>
              <input id="txtLinia1" type="text" value="${esHF(textosData.linia1||'Generalitat de Catalunya')}"
                style="width:100%;padding:7px 10px;border:1.5px solid #e5e7eb;border-radius:7px;font-size:12px;outline:none;">
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:3px;">Línia 2 (ex: Departament d'Educació)</label>
              <input id="txtLinia2" type="text" value="${esHF(textosData.linia2||"Departament d'Educació")}"
                style="width:100%;padding:7px 10px;border:1.5px solid #e5e7eb;border-radius:7px;font-size:12px;outline:none;">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div>
              <label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:3px;">Línia 3 — negreta (ex: INS Matadepera)</label>
              <input id="txtLinia3" type="text" value="${esHF(textosData.linia3||'INS Matadepera')}"
                style="width:100%;padding:7px 10px;border:1.5px solid #e5e7eb;border-radius:7px;font-size:12px;outline:none;">
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:3px;">Text "Faltes d'assistència" (peu del butlletí)</label>
              <input id="txtFaltes" type="text" value="${esHF(textosData.faltesAssistencia||"podeu consultar-les a l'aplicació Acàcia.")}"
                style="width:100%;padding:7px 10px;border:1.5px solid #e5e7eb;border-radius:7px;font-size:12px;outline:none;">
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;margin-top:12px;">
          <button id="btnGuardarLogos"
            style="padding:9px 20px;background:#4c1d95;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">
            💾 Guardar logos i textos
          </button>
        </div>
      </div>
    `;

    // ── Events director ──
    setupEventsDirectorFirmes(directorData);

    // ── Events tutors ──
    document.getElementById('btnGuardarTutors')?.addEventListener('click', () => guardarTutors(grups));
    document.getElementById('inpExcelTutors')?.addEventListener('change', e => processarExcelTutors(e.target.files[0], grups));
    document.getElementById('btnCancelExcel')?.addEventListener('click', () => {
      document.getElementById('excelTutorsInfo').style.display = 'none';
    });

    // ── Events firmes de tutors ──
    setupEventsFirmesTutors();

    // ── Events logos i textos ──
    setupEventsLogos(logosData, textosData);

  } catch(e) {
    body.innerHTML = `<div style="color:#ef4444;padding:20px;">❌ Error: ${e.message}</div>`;
    console.error('firmes.js renderFirmes:', e);
  }
}

/* ══════════════════════════════════════════════════════
   EVENTS SECCIÓ DIRECTOR
══════════════════════════════════════════════════════ */
function setupEventsDirectorFirmes(directorData) {
  // Preview i captura d'imatge firma
  document.getElementById('inpFirma')?.addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    imgToBase64(f, b64 => {
      window._firmes_firmaB64 = b64;
      const prev = document.getElementById('prevFirma');
      if (prev) {
        prev.outerHTML = `<img id="prevFirma" src="${b64}"
          style="max-height:70px;max-width:100%;object-fit:contain;display:block;margin:0 auto 8px;">`;
      }
    });
  });

  // Preview i captura d'imatge segell
  document.getElementById('inpSegell')?.addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    imgToBase64(f, b64 => {
      window._firmes_segellB64 = b64;
      const prev = document.getElementById('prevSegell');
      if (prev) {
        prev.outerHTML = `<img id="prevSegell" src="${b64}"
          style="max-height:70px;max-width:100%;object-fit:contain;display:block;margin:0 auto 8px;">`;
      }
    });
  });

  // Esborrar firma
  document.getElementById('btnEsborrarFirma')?.addEventListener('click', () => {
    window._firmes_firmaB64 = '__ESBORRAR__';
    const prev = document.getElementById('prevFirma');
    if (prev) {
      prev.outerHTML = `<div id="prevFirma" style="height:60px;display:flex;align-items:center;
        justify-content:center;color:#9ca3af;font-size:12px;">Cap imatge</div>`;
    }
    document.getElementById('btnEsborrarFirma')?.remove();
  });

  // Esborrar segell
  document.getElementById('btnEsborrarSegell')?.addEventListener('click', () => {
    window._firmes_segellB64 = '__ESBORRAR__';
    const prev = document.getElementById('prevSegell');
    if (prev) {
      prev.outerHTML = `<div id="prevSegell" style="height:60px;display:flex;align-items:center;
        justify-content:center;color:#9ca3af;font-size:12px;">Cap imatge</div>`;
    }
    document.getElementById('btnEsborrarSegell')?.remove();
  });

  // Guardar director
  document.getElementById('btnGuardarDirector')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnGuardarDirector');
    btn.disabled = true; btn.textContent = '⏳ Guardant...';
    try {
      const cfgSnap = await window.db.doc(FIRMES_CONFIG_DOC).get().catch(() => null);
      const cfg = cfgSnap?.data() || {};

      const firmaB64 = window._firmes_firmaB64;
      const segellB64 = window._firmes_segellB64;

      const director = {
        nom:     document.getElementById('dirNom')?.value?.trim()  || '',
        cognom1: document.getElementById('dirCog1')?.value?.trim() || '',
        cognom2: document.getElementById('dirCog2')?.value?.trim() || '',
        firmaBase64:  firmaB64  === '__ESBORRAR__' ? '' : (firmaB64  || cfg.director?.firmaBase64  || ''),
        segellBase64: segellB64 === '__ESBORRAR__' ? '' : (segellB64 || cfg.director?.segellBase64 || ''),
      };

      await window.db.doc(FIRMES_CONFIG_DOC).set({ director }, { merge: true });
      window._firmes_firmaB64  = null;
      window._firmes_segellB64 = null;
      // Invalidar cache
      _firmesCache   = null;
      _firmesCacheTs = 0;
      window.mostrarToast('✅ Director/a guardat correctament', 3000);
    } catch(e) {
      window.mostrarToast('❌ Error guardant: ' + e.message, 4000);
    }
    btn.disabled = false; btn.textContent = '💾 Guardar director/a';
  });
}

/* ══════════════════════════════════════════════════════
   EVENTS FIRMES DE TUTORS
══════════════════════════════════════════════════════ */
function setupEventsFirmesTutors() {
  // Mapa en memòria per les imatges pendents de guardar: { grupId: base64|'__ESBORRAR__' }
  window._firmesTutorsPendents = window._firmesTutorsPendents || {};

  // Botó "Incloure firma" de cada grup: mostra/amaga la zona de firma
  document.querySelectorAll('.btn-firma-tutor').forEach(btn => {
    btn.addEventListener('click', () => {
      const gid = btn.dataset.grupId;
      const zona = document.querySelector(`.zona-firma-tutor[data-grup-id="${gid}"]`);
      if (!zona) return;
      const visible = zona.style.display !== 'none';
      zona.style.display = visible ? 'none' : 'block';
    });
  });

  // Input file de cada grup: previsualitzar i guardar en memòria
  document.querySelectorAll('.inp-firma-tutor').forEach(inp => {
    inp.addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      const fila = inp.closest('.fila-tutor');
      const gid  = fila?.dataset.grupId;
      if (!gid) return;

      imgToBase64(f, b64 => {
        window._firmesTutorsPendents[gid] = b64;

        // Actualitzar previsualització
        const zona = fila.querySelector('.zona-firma-tutor');
        const prev = zona?.querySelector('.prev-firma-tutor');
        if (prev) {
          prev.outerHTML = `<img class="prev-firma-tutor" src="${b64}"
            style="max-height:60px;max-width:100%;object-fit:contain;display:block;margin:0 auto 6px;">`;
        }

        // Afegir botó esborrar si no existia
        if (!zona?.querySelector('.btn-esborrar-firma-tutor')) {
          const btnEsb = document.createElement('button');
          btnEsb.className = 'btn-esborrar-firma-tutor';
          btnEsb.style.cssText = 'display:block;margin:5px auto 0;padding:3px 10px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:10px;cursor:pointer;';
          btnEsb.textContent = '🗑 Esborrar firma';
          zona?.appendChild(btnEsb);
          _setupEsborrarFirmaTutor(btnEsb, gid, zona, fila);
        }

        // Actualitzar estil del botó principal
        const btnPrincipal = document.querySelector(`.btn-firma-tutor[data-grup-id="${gid}"]`);
        if (btnPrincipal) {
          btnPrincipal.style.background = '#d1fae5';
          btnPrincipal.style.color = '#065f46';
          btnPrincipal.style.borderColor = '#6ee7b7';
          btnPrincipal.textContent = '✅ Firma inclosa';
        }
      });
    });
  });

  // Botó esborrar firma dels grups que ja en tenien
  document.querySelectorAll('.btn-esborrar-firma-tutor').forEach(btnEsb => {
    const fila = btnEsb.closest('.fila-tutor');
    const gid  = fila?.dataset.grupId;
    const zona = btnEsb.closest('.zona-firma-tutor');
    if (gid && zona) _setupEsborrarFirmaTutor(btnEsb, gid, zona, fila);
  });
}

function _setupEsborrarFirmaTutor(btnEsb, gid, zona, fila) {
  btnEsb.addEventListener('click', () => {
    window._firmesTutorsPendents[gid] = '__ESBORRAR__';

    // Substituir la imatge per el text "Cap imatge"
    const prev = zona?.querySelector('.prev-firma-tutor');
    if (prev) {
      prev.outerHTML = `<div class="prev-firma-tutor" style="height:50px;display:flex;align-items:center;
        justify-content:center;color:#9ca3af;font-size:11px;">Cap imatge</div>`;
    }
    btnEsb.remove();

    // Actualitzar estil del botó principal
    const btnPrincipal = fila?.querySelector(`.btn-firma-tutor`);
    if (btnPrincipal) {
      btnPrincipal.style.background = '#ede9fe';
      btnPrincipal.style.color = '#4c1d95';
      btnPrincipal.style.borderColor = '#c4b5fd';
      btnPrincipal.textContent = '✏️ Incloure firma';
    }
  }, { once: true });
}


async function guardarTutors(grups) {
  const btn = document.getElementById('btnGuardarTutors');
  if (btn) { btn.disabled = true; btn.textContent = '\u23f3 Guardant...'; }

  try {
    // Llegir config actual per preservar firmaBase64 existents
    const cfgSnap = await window.db.doc(FIRMES_CONFIG_DOC).get().catch(() => null);
    const cfgActual = cfgSnap?.data() || {};
    const tutorsActuals = cfgActual.tutors || {};

    const pendents = window._firmesTutorsPendents || {};
    const updatePayload = {};

    document.querySelectorAll('.fila-tutor').forEach(fila => {
      const gid = fila.dataset.grupId;
      if (!gid) return;

      const firmaB64Pendent = pendents[gid];
      const firmaB64Actual  = tutorsActuals[gid]?.firmaBase64 || '';

      let firmaFinal;
      if (firmaB64Pendent === '__ESBORRAR__') {
        firmaFinal = '';
      } else if (firmaB64Pendent) {
        firmaFinal = firmaB64Pendent;
      } else {
        firmaFinal = firmaB64Actual;
      }

      updatePayload['tutors.' + gid] = {
        nom:         fila.querySelector('.inp-tutor-nom')?.value?.trim()  || '',
        cognom1:     fila.querySelector('.inp-tutor-cog1')?.value?.trim() || '',
        cognom2:     fila.querySelector('.inp-tutor-cog2')?.value?.trim() || '',
        firmaBase64: firmaFinal,
      };
    });

    if (Object.keys(updatePayload).length === 0) {
      window.mostrarToast('\u26a0\ufe0f Cap grup per guardar', 3000);
      if (btn) { btn.disabled = false; btn.textContent = '\ud83d\udcbe Guardar tots'; }
      return;
    }

    await window.db.doc(FIRMES_CONFIG_DOC).set({}, { merge: true });
    await window.db.doc(FIRMES_CONFIG_DOC).update(updatePayload);

    // Netejar pendents i invalidar cache
    window._firmesTutorsPendents = {};
    _firmesCache   = null;
    _firmesCacheTs = 0;

    window.mostrarToast('\u2705 Tutors/es guardats correctament', 3000);
  } catch(e) {
    window.mostrarToast('\u274c Error guardant: ' + e.message, 4000);
    console.error('guardarTutors:', e);
  }
  if (btn) { btn.disabled = false; btn.textContent = '\ud83d\udcbe Guardar tots'; }
}

/* ══════════════════════════════════════════════════════
   IMPORTACIÓ EXCEL DE TUTORS
══════════════════════════════════════════════════════ */
async function processarExcelTutors(file, grups) {
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    window.mostrarToast('⚠️ Llibreria XLSX no disponible', 3000);
    return;
  }

  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (!rows.length) { window.mostrarToast('⚠️ El fitxer és buit', 3000); return; }

    const headers = rows[0].map((h, i) => ({
      label: h ? String(h) : `Columna ${String.fromCharCode(65 + i)}`,
      idx: i
    }));

    const optsHTML = headers.map(h =>
      `<option value="${h.idx}">${h.label}</option>`
    ).join('');

    const infoDiv = document.getElementById('excelTutorsInfo');
    document.getElementById('exColNom').innerHTML  = optsHTML;
    document.getElementById('exColCog1').innerHTML = optsHTML;
    document.getElementById('exColCog2').innerHTML = optsHTML;
    document.getElementById('exColGrup').innerHTML = optsHTML;

    // Intentar preseleccionar columnes per nom
    autoseleccionarColumna('exColNom',  headers, ['nom','name','nombre']);
    autoseleccionarColumna('exColCog1', headers, ['cognom1','cognom','primer cognom','apellido1','apellido','surname']);
    autoseleccionarColumna('exColCog2', headers, ['cognom2','segon cognom','apellido2']);
    autoseleccionarColumna('exColGrup', headers, ['grup','grupo','group','classe','clase','class']);

    // Preview primeres 3 files de dades
    const preview = rows.slice(1, 4).map(r =>
      headers.map(h => r[h.idx] || '').join(' | ')
    ).join('<br>');
    document.getElementById('excelTutorsPreview').innerHTML =
      `<strong>Previsualització (primeres files):</strong><br>${preview || '—'}`;

    infoDiv.style.display = 'block';

    // Guardar rows per quan s'apliqui
    window._excelTutorsRows = rows;

    // Botó aplicar
    document.getElementById('btnAplicarExcel')?.addEventListener('click', () => {
      aplicarExcelTutors(rows, grups);
    }, { once: true });

  } catch(e) {
    window.mostrarToast('❌ Error llegint Excel: ' + e.message, 4000);
    console.error('processarExcelTutors:', e);
  }

  // Reset input per permetre re-seleccionar el mateix fitxer
  document.getElementById('inpExcelTutors').value = '';
}

function autoseleccionarColumna(selectId, headers, keywords) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const found = headers.find(h =>
    keywords.some(kw => h.label.toLowerCase().includes(kw))
  );
  if (found) sel.value = String(found.idx);
}

function aplicarExcelTutors(rows, grups) {
  const iNom  = parseInt(document.getElementById('exColNom')?.value  ?? 0);
  const iCog1 = parseInt(document.getElementById('exColCog1')?.value ?? 1);
  const iCog2 = parseInt(document.getElementById('exColCog2')?.value ?? 2);
  const iGrup = parseInt(document.getElementById('exColGrup')?.value ?? 3);

  let aplicats = 0;
  rows.slice(1).forEach(row => {
    const nomTutor  = String(row[iNom]  || '').trim();
    const cog1      = String(row[iCog1] || '').trim();
    const cog2      = String(row[iCog2] || '').trim();
    const grupNom   = String(row[iGrup] || '').trim().toLowerCase();

    if (!grupNom || !nomTutor) return;

    // Buscar el grup per nom — accepta formats variats:
    //   "A", "B"  →  coincidència directa amb g.nom
    //   "1r ESO A", "2n ESO B"  →  coincidència amb nivellNom + " " + nom
    //   "1ESO-A", "1ESOA"  →  coincidència flexible
    const grupNomNorm = grupNom.replace(/[\s\-_]+/g, '').toLowerCase();
    const grupTrobat = grups.find(g => {
      const solNom     = (g.nom || '').toLowerCase();
      const complet    = `${g.nivellNom || ''} ${g.nom || ''}`.toLowerCase();
      const compNorm   = complet.replace(/[\s\-_]+/g, '');
      return (
        solNom === grupNom ||
        solNom.includes(grupNom) ||
        grupNom.includes(solNom) ||
        complet === grupNom ||
        complet.includes(grupNom) ||
        grupNom.includes(complet.trim()) ||
        compNorm === grupNomNorm
      );
    });

    if (!grupTrobat) return;

    // Actualitzar els inputs de la fila corresponent
    const fila = document.querySelector(`.fila-tutor[data-grup-id="${grupTrobat.id}"]`);
    if (!fila) return;

    const inpNom  = fila.querySelector('.inp-tutor-nom');
    const inpCog1 = fila.querySelector('.inp-tutor-cog1');
    const inpCog2 = fila.querySelector('.inp-tutor-cog2');

    if (inpNom)  inpNom.value  = nomTutor;
    if (inpCog1) inpCog1.value = cog1;
    if (inpCog2) inpCog2.value = cog2;

    // Feedback visual
    fila.style.border = '1.5px solid #059669';
    setTimeout(() => { fila.style.border = '1.5px solid #e5e7eb'; }, 2000);
    aplicats++;
  });

  document.getElementById('excelTutorsInfo').style.display = 'none';
  window.mostrarToast(
    aplicats > 0
      ? `✅ ${aplicats} tutor${aplicats !== 1 ? 's' : ''} importat${aplicats !== 1 ? 's' : ''}. Recorda guardar!`
      : '⚠️ Cap grup coincident trobat. Revisa la columna de grup.',
    4000
  );
}

/* ══════════════════════════════════════════════════════
   EVENTS I GUARDAT LOGOS
══════════════════════════════════════════════════════ */
function setupEventsLogos(logosData, textosData) {
  // Logo Generalitat — triar imatge
  document.getElementById('inpLogoGen')?.addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    imgToBase64(f, b64 => {
      window._firmes_logoGenB64 = b64;
      const prev = document.getElementById('prevLogoGen');
      if (prev) {
        prev.outerHTML = `<img id="prevLogoGen" src="${b64}"
          style="max-height:60px;max-width:100%;object-fit:contain;display:block;margin:0 auto 8px;">`;
      }
      if (!document.getElementById('btnEsborrarLogoGen')) {
        const btn = document.createElement('button');
        btn.id = 'btnEsborrarLogoGen';
        btn.style.cssText = 'display:block;margin:6px auto 0;padding:4px 12px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:11px;cursor:pointer;';
        btn.textContent = '🗑 Esborrar';
        document.getElementById('inpLogoGen')?.closest('div[style]')?.appendChild(btn);
        _setupEsborrarLogo('btnEsborrarLogoGen', 'prevLogoGen', '_firmes_logoGenB64');
      }
    });
  });

  // Logo Institut — triar imatge
  document.getElementById('inpLogoIns')?.addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    imgToBase64(f, b64 => {
      window._firmes_logoInsB64 = b64;
      const prev = document.getElementById('prevLogoIns');
      if (prev) {
        prev.outerHTML = `<img id="prevLogoIns" src="${b64}"
          style="max-height:60px;max-width:100%;object-fit:contain;display:block;margin:0 auto 8px;">`;
      }
      if (!document.getElementById('btnEsborrarLogoIns')) {
        const btn = document.createElement('button');
        btn.id = 'btnEsborrarLogoIns';
        btn.style.cssText = 'display:block;margin:6px auto 0;padding:4px 12px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:11px;cursor:pointer;';
        btn.textContent = '🗑 Esborrar';
        document.getElementById('inpLogoIns')?.closest('div[style]')?.appendChild(btn);
        _setupEsborrarLogo('btnEsborrarLogoIns', 'prevLogoIns', '_firmes_logoInsB64');
      }
    });
  });

  // Botons esborrar existents (si ja hi havia logos guardats)
  if (document.getElementById('btnEsborrarLogoGen')) {
    _setupEsborrarLogo('btnEsborrarLogoGen', 'prevLogoGen', '_firmes_logoGenB64');
  }
  if (document.getElementById('btnEsborrarLogoIns')) {
    _setupEsborrarLogo('btnEsborrarLogoIns', 'prevLogoIns', '_firmes_logoInsB64');
  }

  // Guardar logos i textos
  document.getElementById('btnGuardarLogos')?.addEventListener('click', () => guardarLogos(logosData, textosData));
}

function _setupEsborrarLogo(btnId, prevId, varName) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener('click', () => {
    window[varName] = '__ESBORRAR__';
    const prev = document.getElementById(prevId);
    if (prev) {
      prev.outerHTML = `<div id="${prevId}" style="height:55px;display:flex;align-items:center;
        justify-content:center;color:#9ca3af;font-size:12px;">Cap imatge</div>`;
    }
    btn.remove();
  }, { once: true });
}

async function guardarLogos(logosData, textosData) {
  const btn = document.getElementById('btnGuardarLogos');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardant...'; }

  try {
    const cfgSnap = await window.db.doc(FIRMES_CONFIG_DOC).get().catch(() => null);
    const cfg = cfgSnap?.data() || {};
    const logosActuals = cfg.logos || {};

    const genB64 = window._firmes_logoGenB64;
    const insB64 = window._firmes_logoInsB64;

    const logos = {
      generalitat: genB64 === '__ESBORRAR__' ? '' : (genB64 || logosActuals.generalitat || ''),
      institut:    insB64 === '__ESBORRAR__' ? '' : (insB64 || logosActuals.institut    || ''),
    };

    const textos = {
      linia1:            document.getElementById('txtLinia1')?.value?.trim() || textosData?.linia1 || 'Generalitat de Catalunya',
      linia2:            document.getElementById('txtLinia2')?.value?.trim() || textosData?.linia2 || "Departament d'Educació",
      linia3:            document.getElementById('txtLinia3')?.value?.trim() || textosData?.linia3 || 'INS Matadepera',
      faltesAssistencia: document.getElementById('txtFaltes')?.value?.trim() || textosData?.faltesAssistencia || "podeu consultar-les a l'aplicació Acàcia.",
    };

    await window.db.doc(FIRMES_CONFIG_DOC).set({ logos, textos }, { merge: true });

    window._firmes_logoGenB64 = null;
    window._firmes_logoInsB64 = null;
    _firmesCache   = null;
    _firmesCacheTs = 0;

    window.mostrarToast('✅ Logos guardats correctament', 3000);
  } catch(e) {
    window.mostrarToast('❌ Error guardant logos: ' + e.message, 4000);
    console.error('guardarLogos:', e);
  }
  if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar logos'; }
}

/* ══════════════════════════════════════════════════════
   UTILITATS
══════════════════════════════════════════════════════ */
function esHF(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function imgToBase64(file, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      // Processar via canvas per eliminar el fons blanc/quasi-blanc
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Pixels molt clars (>220 R+G+B mig) es tornen transparents
      // Zona de transicio suau entre 180-220 per evitar vores tallades
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const llum = (r + g + b) / 3;
        if (llum > 220) {
          // Blanc pur -> totalment transparent
          data[i + 3] = 0;
        } else if (llum > 180) {
          // Zona de transicio -> semi-transparent (suavitza les vores)
          data[i + 3] = Math.round((220 - llum) / 40 * 255);
        }
        // Pixels foscos (la firma en si) -> es mantenen intactes
      }

      ctx.putImageData(imageData, 0, 0);
      callback(canvas.toDataURL('image/png'));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* ══════════════════════════════════════════════════════
   API PÚBLICA — llegida des de secretaria.js (generarButlleti)
   Retorna les dades de firma per a un grup concret
══════════════════════════════════════════════════════ */

// Cache en memòria per no llegir Firestore a cada butlletí
let _firmesCache = null;
let _firmesCacheTs = 0;

window.carregarFirmesConfig = async function() {
  const ara = Date.now();
  if (_firmesCache && (ara - _firmesCacheTs) < 5 * 60 * 1000) return _firmesCache;
  try {
    const snap = await window.db.doc(FIRMES_CONFIG_DOC).get();
    _firmesCache  = snap.exists ? snap.data() : {};
    _firmesCacheTs = ara;
    return _firmesCache;
  } catch(e) {
    console.warn('firmes.js: no s\'ha pogut llegir la config', e);
    return {};
  }
};

window.getTutorPerGrup = async function(grupId) {
  const cfg = await window.carregarFirmesConfig();
  return (cfg.tutors || {})[grupId] || null;
};

window.getDirectorData = async function() {
  const cfg = await window.carregarFirmesConfig();
  return cfg.director || null;
};

// Invalidar cache manualment des de fora si cal
window._invalidarFirmesCache = function() { _firmesCache = null; _firmesCacheTs = 0; };

console.log('✅ firmes.js inicialitzat');
