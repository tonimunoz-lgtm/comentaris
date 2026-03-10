// ultracomentator.js — Injector: Gestor visual de plantilles de comentaris per ítems
// Transforma el botó "📋 Tutoria" en un desplegable amb "Comentari IA" i "Ultracomentator"

console.log('⚡ ultracomentator.js carregat');

// ============================================================
// ESPERAR QUE tutoria.js HAGI INJECTAT EL BOTÓ
// ============================================================
function initUltracomentator() {
  const btn = document.getElementById('btnTutoria');
  if (!btn) { setTimeout(initUltracomentator, 600); return; }
  transformarBotoTutoria(btn);
}

// ============================================================
// TRANSFORMAR BOTÓ SIMPLE → DESPLEGABLE (un clic = menú)
// Igual que el botó ⋮ verd de l'app
// ============================================================
function transformarBotoTutoria(originalBtn) {
  if (document.getElementById('btnTutoriaWrapper')) return;

  // Un sol botó — un clic obre el menú (com el ⋮ verd)
  const btnMain = document.createElement('button');
  btnMain.id = 'btnTutoriaMain';
  // Copiar classe exacta del botó original + position:relative per al menú
  btnMain.className = originalBtn.className;
  btnMain.style.cssText = 'position:relative;';
  btnMain.innerHTML = '📋 Tutoria ▾';
  btnMain.title = 'Opcions de tutoria';

  // Menú desplegable — posicionat relatiu al btnMain
  const menu = document.createElement('div');
  menu.id = 'tutoriaDropdownMenu';
  menu.className = 'hidden';
  menu.style.cssText = `
    position:absolute;top:calc(100% + 4px);left:0;min-width:210px;
    background:#fff;border:1px solid #e5e7eb;border-radius:8px;
    box-shadow:0 8px 24px rgba(0,0,0,0.13);z-index:9999;overflow:hidden;
  `;
  menu.innerHTML = `
    <div style="padding:4px 0;">
      <button id="ucOptIA" style="width:100%;text-align:left;padding:10px 16px;background:none;border:none;cursor:pointer;font-size:14px;display:flex;align-items:center;gap:10px;color:#374151;font-family:inherit;">
        <span style="font-size:16px;">🤖</span>
        <div>
          <div style="font-weight:600;">Comentari IA</div>
          <div style="font-size:12px;color:#6b7280;">Genera comentari de tutoria</div>
        </div>
      </button>
      <div style="height:1px;background:#f3f4f6;"></div>
      <button id="ucOptUltra" style="width:100%;text-align:left;padding:10px 16px;background:none;border:none;cursor:pointer;font-size:14px;display:flex;align-items:center;gap:10px;color:#374151;font-family:inherit;">
        <span style="font-size:16px;">⚡</span>
        <div>
          <div style="font-weight:600;color:#7c3aed;">Ultracomentator</div>
          <div style="font-size:12px;color:#6b7280;">Plantilles de comentaris per ítems</div>
        </div>
      </button>
    </div>
  `;

  // Amagar el botó original i inserir el nou al seu lloc
  originalBtn.id = 'btnTutoria_hidden';
  originalBtn.style.display = 'none';
  originalBtn.parentNode.insertBefore(btnMain, originalBtn);
  btnMain.appendChild(menu);

  // Hover effects
  menu.querySelectorAll('button').forEach(b => {
    b.addEventListener('mouseenter', () => { b.style.background = '#f5f3ff'; });
    b.addEventListener('mouseleave', () => { b.style.background = 'none'; });
  });

  // Un clic al botó → toggle menú (igual que el ⋮ verd)
  btnMain.addEventListener('click', (e) => {
    e.stopPropagation();
    // Tancar altres menús oberts a l'app
    document.querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
    menu.classList.toggle('hidden');
    if (!menu.classList.contains('hidden')) {
      // Ajustar posició si surt de pantalla per la dreta
      const rect = btnMain.getBoundingClientRect();
      if (rect.left + 210 > window.innerWidth) {
        menu.style.left = 'auto';
        menu.style.right = '0';
      } else {
        menu.style.left = '0';
        menu.style.right = 'auto';
      }
    }
  });

  // Tancar en clicar fora
  document.addEventListener('click', () => { menu.classList.add('hidden'); });

  // Opció 1: Comentari IA
  document.getElementById('ucOptIA').addEventListener('click', () => {
    menu.classList.add('hidden');
    document.getElementById('btnTutoria_hidden').click();
  });

  // Opció 2: Ultracomentator
  document.getElementById('ucOptUltra').addEventListener('click', () => {
    menu.classList.add('hidden');
    openUltracomentatorModal();
  });

  console.log('✅ Botó Tutoria transformat en desplegable (un clic)');
}

// ============================================================
// MODAL PRINCIPAL ULTRACOMENTATOR
// ============================================================
function openUltracomentatorModal() {
  const existing = document.getElementById('ucMainModal');
  if (existing) { existing.remove(); }

  // S'obre des del botó tutoria (no des del modal de comentaris):
  // netejar el context d'alumne per no arrossegar l'últim alumne vist
  window._tcStudentName = null;
  window._tcStudentId   = null;
  window._tcClassId     = null;

  const modal = document.createElement('div');
  modal.id = 'ucMainModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);
  `;
  modal.innerHTML = `
    <div style="
      background:#fff;border-radius:20px;padding:40px;max-width:500px;width:90%;
      box-shadow:0 24px 64px rgba(0,0,0,0.18);text-align:center;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    ">
      <div style="font-size:48px;margin-bottom:12px;">⚡</div>
      <h2 style="font-size:24px;font-weight:800;color:#1a1a2e;margin:0 0 8px;">Ultracomentator</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px;line-height:1.5;">
        Sistema de plantilles de comentaris per ítems.
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
        <button id="ucBtnCrear" style="
          background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:12px;
          padding:18px 12px;cursor:pointer;font-family:inherit;transition:all .2s;
        ">
          <div style="font-size:24px;margin-bottom:6px;">✨</div>
          <div style="font-weight:700;font-size:13px;">Crear nova</div>
          <div style="font-size:11px;opacity:.8;margin-top:3px;">Dissenya una plantilla</div>
        </button>
        <button id="ucBtnMeves" style="
          background:linear-gradient(135deg,#0369a1,#0ea5e9);color:#fff;border:none;border-radius:12px;
          padding:18px 12px;cursor:pointer;font-family:inherit;transition:all .2s;
        ">
          <div style="font-size:24px;margin-bottom:6px;">📁</div>
          <div style="font-weight:700;font-size:13px;">Les meves</div>
          <div style="font-size:11px;opacity:.8;margin-top:3px;">Gestiona les teves</div>
        </button>
        <button id="ucBtnCarregar" style="
          background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;border:none;border-radius:12px;
          padding:18px 12px;cursor:pointer;font-family:inherit;transition:all .2s;
        ">
          <div style="font-size:24px;margin-bottom:6px;">🔑</div>
          <div style="font-weight:700;font-size:13px;">Codi d'accés</div>
          <div style="font-size:11px;opacity:.8;margin-top:3px;">Accedeix per codi</div>
        </button>
      </div>
      <button id="ucBtnClose" style="
        margin-top:8px;background:none;border:none;cursor:pointer;color:#9ca3af;font-size:13px;font-family:inherit;
      ">✕ Tancar</button>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelectorAll('button[id^=ucBtn]:not(#ucBtnClose)').forEach(b => {
    b.addEventListener('mouseenter', () => { b.style.transform = 'translateY(-2px)'; b.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)'; });
    b.addEventListener('mouseleave', () => { b.style.transform = ''; b.style.boxShadow = ''; });
  });

  document.getElementById('ucBtnClose').addEventListener('click', () => { modal.remove(); });
  document.getElementById('ucBtnCrear').addEventListener('click', () => {
    modal.remove();
    openCrearPlantillaModal();
  });
  document.getElementById('ucBtnMeves').addEventListener('click', () => {
    modal.remove();
    openMevesPlantillesModal();
  });
  document.getElementById('ucBtnCarregar').addEventListener('click', () => {
    modal.remove();
    openCarregarPlantillaModal();
  });
}

// ============================================================
// MODAL CREAR PLANTILLA
// ============================================================
function openCrearPlantillaModal(plantillaExistent = null, codiEdicio = null) {
  window._ucCodiEdicio = codiEdicio; // null = nova, string = edició
  window._ucPlantilla = {
    nom: '',
    descripcio: '',
    items: []
  };

  const modal = document.createElement('div');
  modal.id = 'ucCrearModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10001;display:flex;align-items:flex-start;justify-content:center;
    background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);overflow-y:auto;padding:20px 0;
  `;

  modal.innerHTML = `
    <div style="
      background:#fafafa;border-radius:20px;width:min(820px,95vw);
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      box-shadow:0 24px 80px rgba(0,0,0,0.2);overflow:hidden;
    ">
      <!-- HEADER -->
      <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:24px 28px;color:#fff;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:13px;opacity:.8;margin-bottom:4px;">⚡ ULTRACOMENTATOR</div>
            <h2 style="margin:0;font-size:22px;font-weight:800;" id="ucCrearTitol">Crea una nova plantilla</h2>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button id="ucDescarregarPlantillaExcel" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.25);color:#fff;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;display:flex;align-items:center;gap:6px;" title="Descarregar plantilla Excel buida">
              📄 Descarregar plantilla .xlsx
            </button>
            <button id="ucImportarExcel" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:#fff;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;display:flex;align-items:center;gap:6px;">
              📊 Importar Excel
            </button>
            <button id="ucCrearClose" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;">✕</button>
          </div>
        </div>
      </div>

      <div style="padding:28px;">
        <!-- NOM I DESCRIPCIÓ -->
        <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid #e5e7eb;">
          <h3 style="margin:0 0 16px;font-size:14px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;">📝 Informació de la plantilla</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:6px;">Nom de la plantilla *</label>
              <input id="ucPlantillaNom" type="text" placeholder="Ex: Com es mouen les coses?" style="
                width:100%;box-sizing:border-box;border:1.5px solid #e5e7eb;border-radius:8px;
                padding:10px 12px;font-size:14px;font-family:inherit;outline:none;
                transition:border-color .2s;
              ">
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:#6b7280;display:block;margin-bottom:6px;">Descripció (opcional)</label>
              <input id="ucPlantillaDesc" type="text" placeholder="Ex: Física - 2n ESO" style="
                width:100%;box-sizing:border-box;border:1.5px solid #e5e7eb;border-radius:8px;
                padding:10px 12px;font-size:14px;font-family:inherit;outline:none;
                transition:border-color .2s;
              ">
            </div>
          </div>
        </div>

        <!-- ÍTEMS -->
        <div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <h3 style="margin:0;font-size:14px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;">🧩 Ítems d'avaluació</h3>
            <button id="ucAfegirItem" style="
              background:#7c3aed;color:#fff;border:none;border-radius:8px;
              padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;
              display:flex;align-items:center;gap:6px;transition:background .2s;
            ">+ Afegir ítem</button>
          </div>
          <div id="ucItemsContainer" style="display:flex;flex-direction:column;gap:12px;">
            <div id="ucItemsEmpty" style="text-align:center;padding:32px;color:#9ca3af;font-size:14px;">
              <div style="font-size:32px;margin-bottom:8px;">📭</div>
              Encara no hi ha ítems. Clica "Afegir ítem" per començar.
            </div>
          </div>
        </div>

        <!-- BOTONS FINALS -->
        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px;">
          <button id="ucCrearCancel" style="
            background:#f3f4f6;color:#374151;border:none;border-radius:8px;
            padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;
          ">Cancelar</button>
          <button id="ucGuardarPlantilla" style="
            background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:8px;
            padding:12px 24px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;
            display:flex;align-items:center;gap:8px;
          ">💾 Guardar plantilla</button>
          <button id="ucGuardarActualitzar" style="
            background:linear-gradient(135deg,#059669,#34d399);color:#fff;border:none;border-radius:8px;
            padding:12px 24px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;
            display:none;align-items:center;gap:8px;
          ">✅ Actualitzar plantilla</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('ucCrearClose').addEventListener('click', () => { modal.remove(); openUltracomentatorModal(); });
  document.getElementById('ucDescarregarPlantillaExcel').addEventListener('click', () => descarregarPlantillaExcel());
  document.getElementById('ucImportarExcel').addEventListener('click', () => importarExcelModal());
  document.getElementById('ucCrearCancel').addEventListener('click', () => { modal.remove(); openUltracomentatorModal(); });
  document.getElementById('ucAfegirItem').addEventListener('click', () => afegirItemUI());
  document.getElementById('ucGuardarPlantilla').addEventListener('click', guardarPlantilla);
  document.getElementById('ucGuardarActualitzar').addEventListener('click', actualitzarPlantilla);

  // Si és edició, omplir dades i canviar UI
  if (plantillaExistent) {
    document.getElementById('ucCrearTitol').textContent = 'Editar plantilla';
    document.getElementById('ucPlantillaNom').value = plantillaExistent.nom || '';
    document.getElementById('ucPlantillaDesc').value = plantillaExistent.descripcio || '';
    document.getElementById('ucGuardarPlantilla').style.display = 'none';
    document.getElementById('ucGuardarActualitzar').style.display = 'flex';
    if (plantillaExistent.items && plantillaExistent.items.length > 0) {
      document.getElementById('ucItemsEmpty').style.display = 'none';
      plantillaExistent.items.forEach(item => afegirItemUI(item));
    }
  }

  // Focus effect inputs
  modal.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('focus', () => { inp.style.borderColor = '#7c3aed'; });
    inp.addEventListener('blur', () => { inp.style.borderColor = '#e5e7eb'; });
  });
}

// ============================================================
// UI: AFEGIR ÍTEM
// ============================================================
function afegirItemUI(itemData = null) {
  const container = document.getElementById('ucItemsContainer');
  const empty = document.getElementById('ucItemsEmpty');
  if (empty) empty.style.display = 'none';

  const itemId = itemData ? itemData.id : 'item_' + Date.now();
  const titol = itemData ? itemData.titol : '';
  const capcelera = itemData ? (itemData.capcelera || '') : '';

  const itemDiv = document.createElement('div');
  itemDiv.id = 'ucItem_' + itemId;
  itemDiv.dataset.itemId = itemId;
  itemDiv.style.cssText = `
    border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;
    transition:border-color .2s;
  `;
  itemDiv.innerHTML = `
    <div style="
      background:linear-gradient(135deg,#f5f3ff,#ede9fe);
      padding:12px 16px;border-bottom:1px solid #e5e7eb;
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:10px;flex:1;">
          <span style="color:#7c3aed;font-size:14px;">🧩</span>
          <input 
            class="ucItemTitol"
            data-item-id="${itemId}"
            type="text" 
            placeholder="Títol de l'ítem (ex: Mètode científic)" 
            value="${titol}"
            style="
              flex:1;border:none;background:transparent;font-size:15px;font-weight:700;
              color:#374151;font-family:inherit;outline:none;
            "
          >
        </div>
        <div style="display:flex;gap:8px;">
          <button class="ucBtnAfegirCom" data-item-id="${itemId}" style="
            background:#7c3aed;color:#fff;border:none;border-radius:6px;
            padding:5px 10px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:600;
          ">+ Comentari</button>
          <button class="ucBtnEliminarItem" data-item-id="${itemId}" style="
            background:#fee2e2;color:#ef4444;border:none;border-radius:6px;
            padding:5px 10px;font-size:12px;cursor:pointer;font-family:inherit;
          ">🗑</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;font-weight:700;color:#7c3aed;white-space:nowrap;">Capçalera:</span>
        <input
          class="ucItemCapcelera"
          data-item-id="${itemId}"
          type="text"
          placeholder="Ex: Pel que fa al mètode científic:"
          value="${capcelera.replace(/"/g, '&quot;')}"
          style="
            flex:1;border:1px solid #ddd6fe;border-radius:6px;background:rgba(255,255,255,0.7);
            font-size:12px;font-style:italic;color:#5b21b6;font-family:inherit;
            padding:4px 8px;outline:none;
          "
        >
      </div>
    </div>
    <div id="ucComs_${itemId}" style="padding:12px;display:flex;flex-direction:column;gap:8px;background:#fff;">
      <div class="ucComsEmpty" style="text-align:center;padding:16px;color:#9ca3af;font-size:13px;">
        Sense comentaris. Clica "+ Comentari" per afegir.
      </div>
    </div>
  `;

  container.appendChild(itemDiv);

  // Events
  itemDiv.querySelector('.ucBtnAfegirCom').addEventListener('click', () => afegirComentariUI(itemId));
  itemDiv.querySelector('.ucBtnEliminarItem').addEventListener('click', () => {
    itemDiv.remove();
    if (!container.querySelector('[data-item-id]')) {
      document.getElementById('ucItemsEmpty').style.display = 'block';
    }
  });

  // Si té comentaris, renderitzar-los
  if (itemData && itemData.comentaris) {
    itemData.comentaris.forEach(com => afegirComentariUI(itemId, com));
  }
}

// ============================================================
// UI: AFEGIR COMENTARI A UN ÍTEM
// ============================================================
// Nivells d'assoliment (desplegable independent per ítem)
const UC_ASSOLIMENTS = [
  { val: 'ae',  label: 'Assoliment excel·lent', color: '#059669', bg: '#d1fae5' },
  { val: 'an',  label: 'Assoliment notable',    color: '#2563eb', bg: '#dbeafe' },
  { val: 'as',  label: 'Assoliment satisfactori',color: '#d97706', bg: '#fef3c7' },
  { val: 'na',  label: 'No assolit',             color: '#dc2626', bg: '#fee2e2' },
  { val: 'nc',  label: 'No cursa',               color: '#6b7280', bg: '#f3f4f6' },
  { val: 'nav', label: 'No avaluat',             color: '#9ca3af', bg: '#f9fafb' },
];

// Etiquetes de comentaris (al formulari de creació — lliure, sense vincle amb assoliment)
const UC_NIVELLS = [
  { val: 'general',    label: 'General',          color: '#6b7280', bg: '#f3f4f6' },
  { val: 'positiu',   label: 'Positiu',           color: '#059669', bg: '#d1fae5' },
  { val: 'parcial',   label: 'Amb dificultats',   color: '#d97706', bg: '#fef3c7' },
  { val: 'negatiu',  label: 'Negatiu',            color: '#dc2626', bg: '#fee2e2' },
];

function afegirComentariUI(itemId, comData = null) {
  const comsDiv = document.getElementById('ucComs_' + itemId);
  const empty = comsDiv.querySelector('.ucComsEmpty');
  if (empty) empty.style.display = 'none';

  const comId = comData ? comData.id : 'com_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
  const text = comData ? comData.text : '';
  const nivell = comData ? comData.nivell : 'general';

  const nivellInfo = UC_NIVELLS.find(n => n.val === nivell) || UC_NIVELLS[0];

  const comDiv = document.createElement('div');
  comDiv.id = 'ucCom_' + comId;
  comDiv.dataset.comId = comId;
  comDiv.dataset.itemId = itemId;
  comDiv.draggable = true;
  comDiv.style.cssText = `
    display:flex;align-items:flex-start;gap:8px;padding:10px;
    background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;
    transition:box-shadow .15s,opacity .15s;
  `;

  const nivellOptions = UC_NIVELLS.map(n =>
    `<option value="${n.val}" ${n.val === nivell ? 'selected' : ''}>${n.label}</option>`
  ).join('');

  comDiv.innerHTML = `
    <div class="ucDragHandle" title="Arrossega per canviar l'ordre" style="
      cursor:grab;color:#d1d5db;font-size:14px;padding:4px 2px;flex-shrink:0;
      display:flex;flex-direction:column;gap:2px;align-self:center;line-height:1;user-select:none;
    ">⠿</div>
    <select class="ucNivellSel" data-com-id="${comId}" style="
      border:1.5px solid ${nivellInfo.color}33;border-radius:6px;padding:4px 8px;
      font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;
      background:${nivellInfo.bg};color:${nivellInfo.color};outline:none;
      white-space:nowrap;min-width:130px;
    ">${nivellOptions}</select>
    <textarea class="ucComText" data-com-id="${comId}" data-item-id="${itemId}" 
      placeholder="Escriu el comentari per a aquest nivell..."
      rows="2"
      style="
        flex:1;border:1.5px solid #e5e7eb;border-radius:6px;padding:8px 10px;
        font-size:13px;font-family:inherit;resize:vertical;outline:none;
        transition:border-color .2s;line-height:1.5;
      "
    >${text}</textarea>
    <button class="ucBtnEliminarCom" data-com-id="${comId}" style="
      background:none;border:none;cursor:pointer;color:#d1d5db;font-size:16px;
      padding:4px;line-height:1;transition:color .2s;flex-shrink:0;
    ">✕</button>
  `;

  comsDiv.appendChild(comDiv);

  // Events NivellSel
  const sel = comDiv.querySelector('.ucNivellSel');
  sel.addEventListener('change', () => {
    const nInfo = UC_NIVELLS.find(n => n.val === sel.value) || UC_NIVELLS[0];
    sel.style.borderColor = nInfo.color + '33';
    sel.style.background = nInfo.bg;
    sel.style.color = nInfo.color;
  });

  // Events textarea
  const ta = comDiv.querySelector('.ucComText');
  ta.addEventListener('focus', () => { ta.style.borderColor = '#7c3aed'; });
  ta.addEventListener('blur', () => { ta.style.borderColor = '#e5e7eb'; });

  // Eliminar
  comDiv.querySelector('.ucBtnEliminarCom').addEventListener('click', () => {
    comDiv.remove();
    if (!comsDiv.querySelector('[data-com-id]')) {
      comsDiv.querySelector('.ucComsEmpty').style.display = 'block';
    }
  });
  comDiv.querySelector('.ucBtnEliminarCom').addEventListener('mouseenter', (e) => { e.target.style.color = '#ef4444'; });
  comDiv.querySelector('.ucBtnEliminarCom').addEventListener('mouseleave', (e) => { e.target.style.color = '#d1d5db'; });

  // ── DRAG & DROP per reordenar ──
  // Nota: _ucDragSrc és variable de mòdul (definida a sota) per compartir-la entre tots els comDiv
  comDiv.addEventListener('dragstart', (e) => {
    _ucDragSrc = comDiv;
    setTimeout(() => { comDiv.style.opacity = '0.4'; }, 0);
    e.dataTransfer.effectAllowed = 'move';
  });
  comDiv.addEventListener('dragend', () => {
    comDiv.style.opacity = '1';
    // Netejar highlights de tots els germans
    comsDiv.querySelectorAll('[data-com-id]').forEach(d => {
      d.style.borderColor = '#e5e7eb';
      d.style.boxShadow = '';
    });
    _ucDragSrc = null;
  });
  comDiv.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (_ucDragSrc && _ucDragSrc !== comDiv) {
      comDiv.style.borderColor = '#a78bfa';
      comDiv.style.boxShadow = '0 0 0 2px #a78bfa44';
    }
  });
  comDiv.addEventListener('dragleave', () => {
    comDiv.style.borderColor = '#e5e7eb';
    comDiv.style.boxShadow = '';
  });
  comDiv.addEventListener('drop', (e) => {
    e.preventDefault();
    comDiv.style.borderColor = '#e5e7eb';
    comDiv.style.boxShadow = '';
    if (!_ucDragSrc || _ucDragSrc === comDiv) return;
    const allComs = [...comsDiv.querySelectorAll('[data-com-id]')];
    const srcIdx = allComs.indexOf(_ucDragSrc);
    const dstIdx = allComs.indexOf(comDiv);
    if (srcIdx < dstIdx) {
      comsDiv.insertBefore(_ucDragSrc, comDiv.nextSibling);
    } else {
      comsDiv.insertBefore(_ucDragSrc, comDiv);
    }
  });

  // Prevent drag quan s'interacciona amb els controls interns
  [sel, ta].forEach(el => {
    el.addEventListener('mousedown', e => e.stopPropagation());
  });
}

// ============================================================
// RECOLLIR DADES DE LA PLANTILLA
// ============================================================
function recollirDadesPlantilla() {
  const nom = document.getElementById('ucPlantillaNom').value.trim();
  const desc = document.getElementById('ucPlantillaDesc').value.trim();

  if (!nom) {
    alert('Cal introduir un nom per a la plantilla!');
    return null;
  }

  const items = [];
  document.querySelectorAll('#ucItemsContainer > [data-item-id]').forEach(itemDiv => {
    const itemId = itemDiv.dataset.itemId;
    const titolEl = itemDiv.querySelector('.ucItemTitol');
    if (!titolEl) return;
    const titol = titolEl.value.trim();
    if (!titol) return;
    const capceleraEl = itemDiv.querySelector('.ucItemCapcelera');
    const capcelera = capceleraEl ? capceleraEl.value.trim() : '';

    const comentaris = [];
    itemDiv.querySelectorAll('[data-com-id]').forEach(comDiv => {
      const taEl = comDiv.querySelector('.ucComText');
      const selEl = comDiv.querySelector('.ucNivellSel');
      if (!taEl || !selEl) return; // saltar elements que no son divs de comentari del formulari
      const text = taEl.value.trim();
      const nivell = selEl.value;
      if (text) {
        comentaris.push({ id: comDiv.dataset.comId, text, nivell });
      }
    });

    items.push({ id: itemId, titol, capcelera, comentaris });
  });

  if (items.length === 0) {
    alert('Cal afegir almenys un ítem amb comentaris!');
    return null;
  }

  return { nom, descripcio: desc, items };
}

// ============================================================
// GUARDAR PLANTILLA A FIREBASE
// ============================================================
// ============================================================
// ACTUALITZAR PLANTILLA EXISTENT (EDICIÓ)
// ============================================================
async function actualitzarPlantilla() {
  const dades = recollirDadesPlantilla();
  if (!dades) return;
  const codi = window._ucCodiEdicio;
  if (!codi) { alert("Error: codi d'edició no trobat."); return; }

  const btn = document.getElementById('ucGuardarActualitzar');
  btn.innerHTML = '⏳ Actualitzant...';
  btn.disabled = true;

  try {
    const db = window._tutoriaDB;
    // Mantenir camps del document original (membres, codi, creatPer...)
    await db.collection('ultracomentator_plantilles').doc(codi).update({
      nom: dades.nom,
      descripcio: dades.descripcio,
      items: dades.items,
      actualitzatEn: new Date().toISOString()
    });

    btn.innerHTML = '✅ Actualitzat!';
    setTimeout(() => {
      document.getElementById('ucCrearModal').remove();
      openMevesPlantillesModal();
    }, 700);
  } catch (err) {
    alert('Error actualitzant: ' + err.message);
    btn.innerHTML = '✅ Actualitzar plantilla';
    btn.disabled = false;
  }
}


async function guardarPlantilla() {
  const dades = recollirDadesPlantilla();
  if (!dades) return;

  const btn = document.getElementById('ucGuardarPlantilla');
  btn.innerHTML = '⏳ Guardant...';
  btn.disabled = true;

  try {
    const db = window._tutoriaDB || (window.firebase && window.firebase.firestore && window.firebase.firestore());
    if (!db) throw new Error('Firebase no disponible');

    // Generar codi d'accés de 6 caràcters
    const codi = generarCodi();
    const uid = window._tutoriaUID || null;
    const email = (window.firebase && window.firebase.auth && window.firebase.auth().currentUser && window.firebase.auth().currentUser.email) || null;
    dades.codi = codi;
    dades.creatEn = new Date().toISOString();
    dades.creatPer = uid;
    dades.creatPerEmail = email;
    dades.membres = uid ? [uid] : [];   // propietari ja és membre
    dades.membresEmail = email ? [email] : [];

    await db.collection('ultracomentator_plantilles').doc(codi).set(dades);

    btn.innerHTML = '✅ Guardada!';
    setTimeout(() => {
      document.getElementById('ucCrearModal').remove();
      mostrarCodiModal(codi, dades.nom);
    }, 600);

  } catch (err) {
    console.error('Error guardant plantilla:', err);
    alert('Error guardant la plantilla: ' + err.message);
    btn.innerHTML = '💾 Guardar plantilla';
    btn.disabled = false;
  }
}

function generarCodi() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codi = '';
  for (let i = 0; i < 6; i++) codi += chars[Math.floor(Math.random() * chars.length)];
  return codi;
}

// ============================================================
// MODAL MOSTRAR CODI D'ACCÉS
// ============================================================
function mostrarCodiModal(codi, nomPlantilla) {
  const modal = document.createElement('div');
  modal.id = 'ucCodiModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10002;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);
  `;
  modal.innerHTML = `
    <div style="
      background:#fff;border-radius:20px;padding:40px;max-width:420px;width:90%;
      text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.2);
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    ">
      <div style="font-size:48px;margin-bottom:16px;">🎉</div>
      <h2 style="font-size:22px;font-weight:800;margin:0 0 8px;color:#1a1a2e;">Plantilla guardada!</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 28px;">${nomPlantilla}</p>

      <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:16px;padding:28px;margin-bottom:24px;">
        <div style="color:rgba(255,255,255,.7);font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">CODI D'ACCÉS</div>
        <div id="ucCodiText" style="
          font-size:42px;font-weight:900;color:#fff;letter-spacing:8px;
          font-family:'Courier New',monospace;cursor:pointer;
        ">${codi}</div>
        <div style="color:rgba(255,255,255,.6);font-size:12px;margin-top:8px;">Clica per copiar</div>
      </div>

      <div style="background:#fef3c7;border-radius:10px;padding:12px 16px;margin-bottom:24px;text-align:left;">
        <div style="font-size:13px;color:#92400e;font-weight:500;">
          💡 Comparteix aquest codi amb altres professors perquè puguin accedir a la plantilla amb "Carregar existent".
        </div>
      </div>

      <button id="ucCodiUsarAra" style="
        background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:10px;
        padding:14px 28px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;
        width:100%;margin-bottom:10px;
      ">⚡ Usar ara aquesta plantilla</button>
      <button id="ucCodiTancar" style="
        background:none;border:none;color:#9ca3af;font-size:13px;cursor:pointer;font-family:inherit;
      ">Tancar</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Copiar codi
  document.getElementById('ucCodiText').addEventListener('click', () => {
    navigator.clipboard.writeText(codi).then(() => {
      document.getElementById('ucCodiText').style.opacity = '.6';
      setTimeout(() => { document.getElementById('ucCodiText').style.opacity = '1'; }, 400);
    });
  });

  document.getElementById('ucCodiTancar').addEventListener('click', () => { modal.remove(); });
  document.getElementById('ucCodiUsarAra').addEventListener('click', () => {
    modal.remove();
    carregarIUsarPlantilla(codi);
  });
}

// ============================================================
// MODAL CARREGAR PLANTILLA AMB CODI
// ============================================================
function openCarregarPlantillaModal() {
  const modal = document.createElement('div');
  modal.id = 'ucCarregarModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);
  `;
  modal.innerHTML = `
    <div style="
      background:#fff;border-radius:20px;padding:40px;max-width:420px;width:90%;
      text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.2);
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    ">
      <div style="font-size:40px;margin-bottom:12px;">🔑</div>
      <h2 style="font-size:22px;font-weight:800;margin:0 0 8px;color:#1a1a2e;">Carregar plantilla</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 28px;">Introdueix el codi d'accés de 6 caràcters</p>

      <input id="ucCodiInput" type="text" maxlength="6"
        placeholder="Exemple: AB3X7K"
        style="
          width:100%;box-sizing:border-box;border:2px solid #e5e7eb;border-radius:12px;
          padding:16px;font-size:28px;font-weight:800;text-align:center;letter-spacing:6px;
          font-family:'Courier New',monospace;outline:none;text-transform:uppercase;
          transition:border-color .2s;margin-bottom:16px;
        "
      >
      <div id="ucCarregarError" style="color:#ef4444;font-size:13px;margin-bottom:12px;display:none;"></div>
      <button id="ucBtnCarregarOk" style="
        background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;border:none;border-radius:10px;
        padding:14px 28px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;
        width:100%;margin-bottom:10px;
      ">Accedir a la plantilla</button>
      <button id="ucCarregarCancel" style="
        background:none;border:none;color:#9ca3af;font-size:13px;cursor:pointer;font-family:inherit;
      ">← Tornar</button>
    </div>
  `;

  document.body.appendChild(modal);

  const input = document.getElementById('ucCodiInput');
  input.addEventListener('focus', () => { input.style.borderColor = '#7c3aed'; });
  input.addEventListener('blur', () => { input.style.borderColor = '#e5e7eb'; });
  input.addEventListener('input', () => { input.value = input.value.toUpperCase(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('ucBtnCarregarOk').click(); });

  document.getElementById('ucCarregarCancel').addEventListener('click', () => { modal.remove(); openUltracomentatorModal(); });
  document.getElementById('ucBtnCarregarOk').addEventListener('click', async () => {
    const codi = input.value.trim().toUpperCase();
    if (codi.length < 4) {
      document.getElementById('ucCarregarError').textContent = 'El codi ha de tenir com a mínim 4 caràcters.';
      document.getElementById('ucCarregarError').style.display = 'block';
      return;
    }
    const btn = document.getElementById('ucBtnCarregarOk');
    btn.innerHTML = '⏳ Cercant...';
    btn.disabled = true;
    document.getElementById('ucCarregarError').style.display = 'none';

    try {
      const db = window._tutoriaDB || (window.firebase && window.firebase.firestore && window.firebase.firestore());
      if (!db) throw new Error('Firebase no disponible');
      const doc = await db.collection('ultracomentator_plantilles').doc(codi).get();
      if (!doc.exists) {
        document.getElementById('ucCarregarError').textContent = '❌ No s\'ha trobat cap plantilla amb aquest codi.';
        document.getElementById('ucCarregarError').style.display = 'block';
        btn.innerHTML = 'Accedir a la plantilla';
        btn.disabled = false;
        return;
      }
      modal.remove();
      carregarIUsarPlantilla(codi, doc.data());
    } catch (err) {
      document.getElementById('ucCarregarError').textContent = 'Error: ' + err.message;
      document.getElementById('ucCarregarError').style.display = 'block';
      btn.innerHTML = 'Accedir a la plantilla';
      btn.disabled = false;
    }
  });
}

// ============================================================
// MODAL US DE PLANTILLA (selecció comentaris + generar amb IA)
// ============================================================
// Retorna el nom a mostrar al comentari segons preferències guardades
function _ucCap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function _ucNomDisplay(nomComplet) {
  if (!nomComplet || nomComplet === "l'alumne/a") return nomComplet || "l'alumne/a";
  const parts = nomComplet.trim().split(/\s+/);
  const nom     = _ucCap(parts[0] || '');
  const cognom1 = _ucCap(parts[1] || '');
  const cognom2 = _ucCap(parts[2] || '');
  const prefs = JSON.parse(localStorage.getItem('uc_nom_parts') || '{"nom":true,"cognom1":false,"cognom2":false}');
  const sel = [
    prefs.nom     ? nom     : '',
    prefs.cognom1 ? cognom1 : '',
    prefs.cognom2 ? cognom2 : '',
  ].filter(Boolean);
  return sel.join(' '); // pot ser buit si cap check actiu
}

async function carregarIUsarPlantilla(codi, plantillaData = null) {
  if (!plantillaData) {
    try {
      // Esperar que _tutoriaDB estigui disponible (max 5s)
      let intents = 0;
      while (!window._tutoriaDB && intents < 50) {
        await new Promise(r => setTimeout(r, 100));
        intents++;
      }
      const db = window._tutoriaDB || (window.firebase && window.firebase.firestore && window.firebase.firestore());
      if (!db) throw new Error('Firebase no disponible');
      const doc = await db.collection('ultracomentator_plantilles').doc(codi).get();
      if (doc.exists) plantillaData = doc.data();
    } catch (e) { console.error(e); }
  }
  if (!plantillaData) { alert("No s'ha pogut carregar la plantilla."); return; }

  window._ucPlantillaActiva = plantillaData;

  // HTML per cada ítem: desplegable assoliment + selecció comentaris independent
  const itemsHTML = plantillaData.items.map((item, idx) => {
    const assolimentOpts = UC_ASSOLIMENTS.map(a =>
      `<option value="${a.val}">${a.label}</option>`
    ).join('');

    // Mapa posició→assoliment (0=AE, 1=AN, 2=AS, 3=NA)
    const _posToAssol = ['ae','an','as','na'];
    const comsHTML = item.comentaris.map((com, posIdx) => {
      const nInfo = UC_NIVELLS.find(n => n.val === com.nivell) || UC_NIVELLS[0];
      const assocLabel = posIdx < _posToAssol.length ? UC_ASSOLIMENTS.find(a => a.val === _posToAssol[posIdx]) : null;
      return `
        <label class="ucComLabel" style="
          display:flex;align-items:flex-start;gap:10px;padding:10px 12px;
          border:1.5px solid #e5e7eb;border-radius:8px;cursor:pointer;
          background:#fff;transition:all .15s;
        ">
          <input type="checkbox" class="ucComCheck"
            data-item-id="${item.id}"
            data-item-titol="${item.titol.replace(/"/g,'&quot;')}"
            data-com-text="${com.text.replace(/"/g,'&quot;')}"
            data-assol-auto="${posIdx < _posToAssol.length ? _posToAssol[posIdx] : ''}"
            style="margin-top:3px;accent-color:#7c3aed;width:16px;height:16px;flex-shrink:0;">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">
              <span style="
                display:inline-block;font-size:11px;font-weight:600;padding:1px 7px;border-radius:10px;
                background:${nInfo.bg};color:${nInfo.color};
              ">${nInfo.label}</span>
              ${assocLabel ? `<span style="
                display:inline-block;font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;
                background:${assocLabel.bg};color:${assocLabel.color};opacity:.8;
              ">→ ${assocLabel.label}</span>` : ''}
            </div>
            <div style="font-size:13px;line-height:1.5;color:#374151;">${com.text}</div>
          </div>
        </label>
      `;
    }).join('');

    return `
      <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;margin-bottom:10px;">
        <!-- Capçalera ítem -->
        <div style="
          padding:12px 16px;background:linear-gradient(135deg,#f5f3ff,#ede9fe);
          border-bottom:1px solid #e5e7eb;
        ">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:${item.capcelera ? '6px' : '4px'};">
            <div style="font-weight:700;font-size:14px;color:#374151;">🧩 ${item.titol}</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <label style="font-size:11px;font-weight:700;color:#7c3aed;white-space:nowrap;">Assoliment:</label>
              <select class="ucAssolimentSel" data-item-id="${item.id}" style="
                border:1.5px solid #a78bfa;border-radius:8px;padding:5px 10px;
                font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;
                background:#faf5ff;color:#5b21b6;outline:none;
              ">
                <option value="">— Selecciona —</option>
                ${assolimentOpts}
              </select>
            </div>
          </div>
          ${item.capcelera ? `<div style="font-size:12px;font-style:italic;color:#5b21b6;padding:2px 0 0;">"${item.capcelera}"</div>` : ''}
        </div>

        <!-- Comentaris seleccionables -->
        <div style="padding:12px;">
          <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
            Selecciona els comentaris a incloure:
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${comsHTML}
          </div>
        </div>
      </div>
    `;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'ucUsarModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10001;display:flex;align-items:flex-start;justify-content:center;
    background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);overflow-y:auto;padding:20px 0;
  `;
  modal.innerHTML = `
    <div style="
      background:#fafafa;border-radius:20px;width:min(780px,95vw);
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      box-shadow:0 24px 80px rgba(0,0,0,0.2);overflow:hidden;
    ">
      <!-- HEADER -->
      <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:20px 28px;color:#fff;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:12px;opacity:.7;margin-bottom:2px;">⚡ ULTRACOMENTATOR · ${codi}</div>
            <h2 style="margin:0;font-size:20px;font-weight:800;">${plantillaData.nom}</h2>
            ${plantillaData.descripcio ? `<div style="font-size:13px;opacity:.75;margin-top:2px;">${plantillaData.descripcio}</div>` : ''}
          </div>
          <button id="ucUsarClose" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;">✕</button>
        </div>
      </div>

      <div style="padding:20px 24px;">
        <!-- INFO ALUMNE + IDIOMA -->
        <div id="ucInfoAlumneWrap" style="background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #e5e7eb;">
          <!-- Omplert per JS -->
        </div>

        <!-- ÍTEMS: ASSOLIMENT + COMENTARIS -->
        <div style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">
              Ítems d'avaluació
            </div>
            <div style="display:flex;gap:6px;">
              <button id="ucSelTots" style="background:#f3f4f6;color:#374151;border:none;border-radius:6px;padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">☑ Tot</button>
              <button id="ucDeselTots" style="background:#f3f4f6;color:#374151;border:none;border-radius:6px;padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">☐ Cap</button>
            </div>
          </div>
          ${itemsHTML}
        </div>

        <!-- RESULTAT IA -->
        <div id="ucResultatWrap" style="display:none;background:#fff;border-radius:12px;border:1.5px solid #7c3aed33;padding:16px;margin-bottom:16px;">
          <div style="font-size:12px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">✨ Comentari generat per IA</div>
          <div id="ucResultatText" style="font-size:14px;line-height:1.7;color:#374151;white-space:pre-wrap;"></div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button id="ucCopiarResultat" style="background:#f3f4f6;color:#374151;border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">📋 Copiar</button>
            <button id="ucGuardarAlumne" style="background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;display:none;">💾 Guardar a l'alumne</button>
            <button id="ucGuardarSeguent" style="background:linear-gradient(135deg,#059669,#10b981);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;display:none;">💾 Guardar i següent ▶</button>
          </div>
        </div>

        <!-- BOTÓ GENERAR -->
        <div style="display:flex;justify-content:flex-end;">
          <button id="ucGenerar" style="
            background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:8px;
            padding:12px 24px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;
            display:flex;align-items:center;gap:8px;
          ">✨ Generar comentari amb IA</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // ── Omplir bloc INFO ALUMNE per JS (sempre correcte, independentment del timing) ──
  const infoWrap = document.getElementById('ucInfoAlumneWrap');
  const nomActiu = window._tcStudentName || null;
  if (nomActiu && infoWrap) {
    // Mode "ve del modal de comentaris": badge + gènere + idioma
    infoWrap.style.cssText = 'background:#f5f3ff;border-radius:12px;padding:12px 16px;margin-bottom:16px;border:1.5px solid #a78bfa;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;';
    // Parts del nom — capitalitzades
    const _ucParts = nomActiu.trim().split(/\s+/);
    const _ucNom     = _ucCap(_ucParts[0] || '');
    const _ucCognom1 = _ucCap(_ucParts[1] || '');
    const _ucCognom2 = _ucCap(_ucParts[2] || '');
    const _ucPrefs = JSON.parse(localStorage.getItem('uc_nom_parts') || '{"nom":true,"cognom1":false,"cognom2":false}');
    const mkCheck = (key, label, val) => val ? `
      <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;padding:4px 9px;border:1.5px solid #e5e7eb;border-radius:8px;background:#fff;color:#374151;user-select:none;">
        <input type="checkbox" class="uc-nom-check" data-key="${key}"
          style="accent-color:#7c3aed;width:14px;height:14px;"
          ${_ucPrefs[key] ? 'checked' : ''}>
        <span style="font-weight:700;color:#4c1d95;">${val}</span>
        <span style="color:#9ca3af;font-size:11px;">${label}</span>
      </label>` : '';

    infoWrap.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;width:100%;flex-wrap:wrap;">
        <!-- Esquerra: nom + checkboxes -->
        <div style="display:flex;align-items:flex-start;gap:10px;flex:1;min-width:0;">
          <span style="font-size:20px;margin-top:2px;">👤</span>
          <div style="min-width:0;">
            <div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.5px;">Alumne/a actiu/va</div>
            <div id="ucNomDisplay" style="font-size:16px;font-weight:800;color:#4c1d95;margin-bottom:8px;">${_ucNomDisplay(nomActiu) || nomActiu}</div>
            <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Mostrar al comentari</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${mkCheck('nom', 'nom', _ucNom)}
              ${mkCheck('cognom1', '1r cog.', _ucCognom1)}
              ${mkCheck('cognom2', '2n cog.', _ucCognom2)}
            </div>
          </div>
        </div>
        <!-- Dreta: gènere + idioma -->
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
          <div style="display:flex;gap:6px;">
            <label id="ucLblNoi" style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:600;cursor:pointer;padding:6px 12px;border:2px solid #7c3aed;border-radius:8px;background:#7c3aed;color:#fff;transition:all .15s;">
              <input type="radio" name="ucGenere" value="noi" checked style="accent-color:#fff;"> 👦 Noi
            </label>
            <label id="ucLblNoia" style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:600;cursor:pointer;padding:6px 12px;border:2px solid #a78bfa;border-radius:8px;background:#fff;color:#374151;transition:all .15s;">
              <input type="radio" name="ucGenere" value="noia" style="accent-color:#7c3aed;"> 👧 Noia
            </label>
          </div>
          <select id="ucIdioma" style="border:1.5px solid #a78bfa;border-radius:8px;padding:7px 12px;font-size:13px;font-family:inherit;outline:none;background:#fff;color:#374151;">
            <option value="catala">Català</option>
            <option value="castella">Castellà</option>
          </select>
        </div>
      </div>
      <input id="ucAlumneNom" type="hidden" value="${nomActiu}">
    `;
    // Events gènere
    infoWrap.querySelectorAll('input[name="ucGenere"]').forEach(radio => {
      radio.addEventListener('change', () => {
        infoWrap.querySelectorAll('label[id^="ucLbl"]').forEach(lbl => {
          lbl.style.background = '#fff'; lbl.style.borderColor = '#a78bfa'; lbl.style.color = '#374151';
        });
        const lbl = radio.closest('label');
        if (lbl) { lbl.style.background = '#7c3aed'; lbl.style.borderColor = '#7c3aed'; lbl.style.color = '#fff'; }
      });
    });
    // Sincronitzar localStorage amb l'estat VISUAL dels checkboxes en el moment de renderitzar
    // (evita que el default {"nom":true} sobreescrigui l'estat real si l'usuari ha desmarcat tot)
    {
      const prefsActuals = {};
      infoWrap.querySelectorAll('input.uc-nom-check').forEach(c2 => { prefsActuals[c2.dataset.key] = c2.checked; });
      localStorage.setItem('uc_nom_parts', JSON.stringify(prefsActuals));
    }
    // Events checkboxes nom — guardar prefs i actualitzar nom visible
    infoWrap.querySelectorAll('input.uc-nom-check').forEach(chk => {
      chk.addEventListener('change', () => {
        const prefs = {};
        infoWrap.querySelectorAll('input.uc-nom-check').forEach(c2 => { prefs[c2.dataset.key] = c2.checked; });
        localStorage.setItem('uc_nom_parts', JSON.stringify(prefs));
        // Actualitzar nom visible al badge
        const nomDisp = document.getElementById('ucNomDisplay');
        if (nomDisp) nomDisp.textContent = _ucNomDisplay(nomActiu) || '—';
      });
    });
    // Mostrar botons guardar
    const btnG = document.getElementById('ucGuardarAlumne');
    const btnS = document.getElementById('ucGuardarSeguent');
    if (btnG) btnG.style.display = 'inline-flex';
    if (btnS) btnS.style.display = 'inline-flex';
  } else if (infoWrap) {
    // Mode normal: camp de text per escriure nom + idioma
    infoWrap.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="flex:1;min-width:150px;">
          <label style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">Nom de l'alumne/a</label>
          <input id="ucAlumneNom" type="text" placeholder="Ex: Júlia Martínez"
            style="width:100%;box-sizing:border-box;border:1.5px solid #e5e7eb;border-radius:8px;padding:8px 12px;font-size:14px;font-family:inherit;outline:none;">
        </div>
        <div style="min-width:120px;">
          <label style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">Idioma</label>
          <select id="ucIdioma" style="width:100%;border:1.5px solid #e5e7eb;border-radius:8px;padding:8px 12px;font-size:14px;font-family:inherit;outline:none;background:#fff;">
            <option value="catala">Català</option>
            <option value="castella">Castellà</option>
          </select>
        </div>
      </div>
    `;
    const nomEl2 = document.getElementById('ucAlumneNom');
    if (nomEl2) {
      nomEl2.addEventListener('focus', e => { e.target.style.borderColor = '#7c3aed'; });
      nomEl2.addEventListener('blur', e => { e.target.style.borderColor = '#e5e7eb'; });
    }
  }

  // Tancar
  document.getElementById('ucUsarClose').addEventListener('click', () => { modal.remove(); });

  // Funció helper: actualitzar color del select assoliment
  function _updateAssolColor(sel) {
    const a = UC_ASSOLIMENTS.find(x => x.val === sel.value);
    if (a) { sel.style.background = a.bg; sel.style.color = a.color; sel.style.borderColor = a.color + '88'; }
    else { sel.style.background = '#faf5ff'; sel.style.color = '#5b21b6'; sel.style.borderColor = '#a78bfa'; }
  }

  // Marcar si el select ha estat modificat MANUALMENT per l'usuari
  modal.querySelectorAll('.ucAssolimentSel').forEach(sel => {
    sel._manuallySet = false;
    sel.addEventListener('change', () => {
      sel._manuallySet = true;
      _updateAssolColor(sel);
    });
  });

  // Hover + check estil labels + auto-assoliment per posició
  modal.querySelectorAll('.ucComLabel').forEach(lbl => {
    lbl.addEventListener('mouseenter', () => { lbl.style.borderColor = '#a78bfa'; lbl.style.background = '#faf5ff'; });
    lbl.addEventListener('mouseleave', () => {
      const chk = lbl.querySelector('input');
      lbl.style.borderColor = chk.checked ? '#7c3aed' : '#e5e7eb';
      lbl.style.background = chk.checked ? '#faf5ff' : '#fff';
    });
    lbl.querySelector('input').addEventListener('change', (e) => {
      const chk = e.target;
      // Estil visual
      lbl.style.borderColor = chk.checked ? '#7c3aed' : '#e5e7eb';
      lbl.style.background = chk.checked ? '#faf5ff' : '#fff';

      // Auto-assoliment per posició
      const itemId = chk.dataset.itemId;
      const assolAuto = chk.dataset.assolAuto;  // data-assol-auto → dataset.assolAuto
      const sel = modal.querySelector(`.ucAssolimentSel[data-item-id="${itemId}"]`);
      if (!sel || !assolAuto) return;

      if (chk.checked) {
        // Posar assoliment automàtic NOMÉS si el sel no ha estat tocat manualment
        if (!sel._manuallySet && !sel.value) {
          sel.value = assolAuto;
          _updateAssolColor(sel);
        }
      } else {
        // Si es desmarca i el valor actual era l'automàtic, mirar si hi ha altres checks marcats per aquest ítem
        if (!sel._manuallySet && sel.value === assolAuto) {
          // Buscar si hi ha algun altre check marcat per aquest ítem
          const altresChecks = modal.querySelectorAll(`.ucComCheck[data-item-id="${itemId}"]`);
          let altreMarcat = false;
          altresChecks.forEach(c2 => { if (c2 !== chk && c2.checked && c2.dataset.assolAuto) altreMarcat = true; });
          if (!altreMarcat) {
            // Buscar el primer check marcat i agafar el seu assoliment auto
            let primerAuto = '';
            altresChecks.forEach(c2 => { if (!primerAuto && c2.checked && c2.dataset.assolAuto) primerAuto = c2.dataset.assolAuto; });
            sel.value = primerAuto;
            _updateAssolColor(sel);
          }
        }
      }
    });
  });

  // Color dinàmic del select d'assoliment (inicial)
  modal.querySelectorAll('.ucAssolimentSel').forEach(sel => {
    _updateAssolColor(sel);
  });

  // Seleccionar / Desseleccionar tots
  document.getElementById('ucSelTots').addEventListener('click', () => {
    modal.querySelectorAll('.ucComCheck').forEach(chk => {
      chk.checked = true;
      const lbl = chk.closest('label');
      if (lbl) { lbl.style.borderColor = '#7c3aed'; lbl.style.background = '#faf5ff'; }
    });
  });
  document.getElementById('ucDeselTots').addEventListener('click', () => {
    modal.querySelectorAll('.ucComCheck').forEach(chk => {
      chk.checked = false;
      const lbl = chk.closest('label');
      if (lbl) { lbl.style.borderColor = '#e5e7eb'; lbl.style.background = '#fff'; }
    });
  });

  // Focus alumne
  // Events nom/gènere: gestionats al bloc post-render superior

  // Copiar resultat
  document.getElementById('ucCopiarResultat').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('ucResultatText').textContent);
    document.getElementById('ucCopiarResultat').innerHTML = '✅ Copiat!';
    setTimeout(() => { document.getElementById('ucCopiarResultat').innerHTML = '📋 Copiar'; }, 1500);
  });

  // GENERAR AMB IA
  document.getElementById('ucGenerar').addEventListener('click', () => generarAmbIA(modal));
}


// ============================================================
// GENERAR COMENTARI AMB IA (Groq via /api/tutoria)
// ============================================================
async function generarAmbIA(modal) {
  // Nom: preferir window._tcStudentName si ve del modal de comentaris
  const nomEl = document.getElementById('ucAlumneNom');
  const nomFromEl = nomEl ? nomEl.value.trim() : '';
  const nomComplet = window._tcStudentName || nomFromEl || '';
  const alumne = _ucNomDisplay(nomComplet); // buit si cap checkbox actiu
  const idioma = document.getElementById('ucIdioma').value;
  const genereRadio = document.querySelector('input[name="ucGenere"]:checked');
  const genere = genereRadio ? genereRadio.value : 'noi';
  // Si no hi ha nom seleccionat -> mode neutre (sense nom ni article)
  const modeNeutre = !alumne || !alumne.trim();
  const esVocalOH = !modeNeutre && /^[aeiouàèéíïóòúüh]/i.test(alumne.trim());
  const articleBase = genere === 'noia' ? 'La' : 'El';
  const nomAmbArticle = modeNeutre ? '' : (esVocalOH ? `l'${alumne}` : `${articleBase} ${alumne}`);

  // Recollir assoliments per ítem (desplegable independent)
  const assoliments = {};
  modal.querySelectorAll('.ucAssolimentSel').forEach(sel => {
    if (sel.value) {
      const a = UC_ASSOLIMENTS.find(x => x.val === sel.value);
      assoliments[sel.dataset.itemId] = a ? a.label : sel.value;
    }
  });

  // Recollir comentaris seleccionats agrupats per ítem
  const seleccionats = {};
  modal.querySelectorAll('.ucComCheck:checked').forEach(chk => {
    const itemId = chk.dataset.itemId;
    const itemTitol = chk.dataset.itemTitol;
    if (!seleccionats[itemId]) seleccionats[itemId] = { titol: itemTitol, comentaris: [] };
    seleccionats[itemId].comentaris.push(chk.dataset.comText);
  });

  // Cal almenys un assoliment O un comentari
  if (Object.keys(assoliments).length === 0 && Object.keys(seleccionats).length === 0) {
    alert('Cal seleccionar almenys un assoliment o un comentari!');
    return;
  }
  // alumne buit = mode neutre (sense nom al comentari), es valid

  const btn = document.getElementById('ucGenerar');
  btn.innerHTML = '⏳ Generant...';
  btn.disabled = true;

  const resultWrap = document.getElementById('ucResultatWrap');
  const resultText = document.getElementById('ucResultatText');
  resultWrap.style.display = 'block';
  resultText.textContent = 'Generant comentari...';

  // Construir el prompt: un bloc per ítem, cadascun amb capçalera pròpia
  const idiomaStr = idioma === 'catala' ? 'català' : 'castellà';
  const plantilla = window._ucPlantillaActiva;

  // Construir llista d'ítems actius (amb assoliment o comentaris seleccionats)
  const itesMActius = [];
  if (plantilla && plantilla.items) {
    plantilla.items.forEach(item => {
      const ass = assoliments[item.id] || null;
      const coms = (seleccionats[item.id] || {}).comentaris || [];
      if (ass || coms.length > 0) {
        itesMActius.push({
          titol: item.titol,
          capcelera: item.capcelera || '',
          assoliment: ass,
          comentaris: coms
        });
      }
    });
  }

  // Construir instruccions per ítem
  let promptItems = '';
  itesMActius.forEach((item, idx) => {
    promptItems += `\nÍTEM ${idx + 1}: "${item.titol}"`;
    if (item.capcelera) promptItems += `\n  Capçalera (OBLIGATORIA, comença el bloc amb aquest text exacte): "${item.capcelera}"`;
    if (item.assoliment) promptItems += `\n  Nivell d'assoliment: ${item.assoliment}`;
    if (item.comentaris.length > 0) {
      promptItems += `\n  Contingut a integrar:`;
      item.comentaris.forEach(cm => { promptItems += `\n  · ${cm}`; });
    }
  });

  const instrNom = modeNeutre
    ? `- Cada bloc ha de COMENÇAR OBLIGATÒRIAMENT amb la capçalera indicada però SENSE els dos punts finals (ex: "Pel que fa al mètode científic,"). Immediatament després, SENSE nom ni article, continua directament amb el verb en tercera persona (ex: "Pel que fa al mètode científic, demostra un bon domini..."). NO escriguis cap nom ni article.`
    : `- Cada bloc ha de COMENÇAR OBLIGATÒRIAMENT amb la capçalera indicada però SENSE els dos punts finals (ex: "Pel que fa al mètode científic,"). Immediatament després, sense punt ni majúscula, continua amb "${nomAmbArticle}" en minúscules (ex: "Pel que fa al mètode científic, ${nomAmbArticle} ..."). Tot ha de ser una frase contínua i fluida.
- Usa sempre "${nomAmbArticle}" per referir-te a l'alumne/a (mai cap genèric).`;

  const prompt = `Ets un professor expert en redacció de comentaris per a butlletins de notes escolars.
${modeNeutre ? '' : `\nAlumne/a: ${nomAmbArticle} (gènere: ${genere === 'noia' ? 'femení' : 'masculí'})`}
Idioma: ${idiomaStr}

Ítems d'avaluació:
${promptItems}

INSTRUCCIONS ESTRICTES:
- Escriu UN BLOC DE TEXT per cada ítem, en el mateix ordre que apareixen.
${instrNom}
- Dins de cada bloc, integra el nivell d'assoliment i els comentaris en un text fluid i natural (com escriuria un professor), NO una llista.
- Separa els blocs amb un salt de línia.
- No afegeixes cap introducció, títol ni comentari final genèric.
- En català, omet el pronom subjecte "ell" o "ella" quan el subjecte és conegut pel context (pro-drop). Exemple: "serà capaç" en lloc de "ella serà capaç".
- Concordança de gènere correcta en tots els adjectius i participis.
- Idioma: ${idiomaStr}.
- No menciones notes numèriques.

Escriu ÚNICAMENT els blocs de comentari, res més.`;

  try {
    if (!window.callTutoriaAPI) throw new Error('API no configurada. Comprova api-config.js');
    const data = await window.callTutoriaAPI(prompt);
    const comentari = (data.text || '').trim();
    resultText.textContent = comentari;

    // Mostrar botó guardar si hi ha alumne actiu (modal comentaris obert)
    const btnGuardar = document.getElementById('ucGuardarAlumne');
    const btnSeguent = document.getElementById('ucGuardarSeguent');
    if (window._tcStudentId) {
      if (btnGuardar) {
        btnGuardar.style.display = 'inline-flex';
        btnGuardar.onclick = () => guardarComentariAlumne(comentari, modal, itesMActius, false);
      }
      if (btnSeguent) {
        btnSeguent.style.display = 'inline-flex';
        btnSeguent.onclick = () => guardarComentariAlumne(comentari, modal, itesMActius, true);
      }
    }

  } catch (err) {
    resultText.textContent = '❌ Error: ' + err.message;
    console.error('ucIA error:', err);
  }

  btn.innerHTML = '✨ Tornar a generar';
  btn.disabled = false;
}

// ============================================================
// GUARDAR COMENTARI A L'ALUMNE (integració tutoria-comentaris.js)
// ============================================================
// Actualitza la cel·la de comentari a la taula del DOM sense recarregar
function _ucActualitzarFilaComentari(studentId, classId, comentari) {
  try {
    const tr = document.querySelector(`tr[data-student-id="${studentId}"]`);
    if (!tr) return;
    // La cel·la de comentari és la que té cursor-pointer i hover:bg-yellow-100
    const td = tr.querySelector('td.cursor-pointer');
    if (!td) return;
    const displayComment = comentari
      ? comentari.split(' ')[0] + (comentari.split(' ').length > 1 ? '...' : '')
      : '(sense comentari)';
    td.innerHTML = `<span style="display:block;">${displayComment}</span>`;
    td.title = comentari || 'Fes clic per afegir comentari';
    // Actualitzar el listener de click per passar el nou comentari
    const tdClone = td.cloneNode(true);
    tdClone.addEventListener('click', () => {
      if (typeof window.openCommentsModal === 'function') {
        window.openCommentsModal(studentId, tr.querySelector('td:first-child')?.textContent?.trim() || '', comentari);
      }
    });
    td.parentNode.replaceChild(tdClone, td);
  } catch(e) { console.warn('[UC] Error actualitzant fila:', e); }
}

async function guardarComentariAlumne(comentari, modal, items = [], passarAlSeguent = false) {
  // Capturar IDs en el moment de cridar la funcio (no pas per referencia)
  const studentIdActual = window._tcStudentId;
  const classIdActual   = window._tcClassId;

  console.log('[UC guardar] studentId:', studentIdActual, 'classId:', classIdActual, 'seguent:', passarAlSeguent);

  if (!studentIdActual || !classIdActual) {
    alert('No hi ha cap alumne actiu. Obre primer el modal de comentaris d\'un alumne.');
    return;
  }

  const btnGuardar = document.getElementById('ucGuardarAlumne');
  const btnSeguent = document.getElementById('ucGuardarSeguent');
  const btnActiu = passarAlSeguent ? btnSeguent : btnGuardar;
  if (btnActiu) { btnActiu.innerHTML = '⏳ Guardant...'; btnActiu.disabled = true; }

  try {
    const db = window._tutoriaDB;
    if (!db) throw new Error('Firebase no disponible');

    // Guardar comentari + metadades ítems (títol + assoliment) per exportació Excel
    const metadades = items.map(it => ({
      titol: it.titol || '',
      assoliment: it.assoliment || ''
    }));

    const update = {
      comentari: comentari,
    };
    if (metadades.length > 0) {
      update[`comentarisItems.${classIdActual}`] = metadades;
    }

    await db.collection('alumnes').doc(studentIdActual).update(update);

    // Omplir textarea del modal de comentaris si esta obert
    const taComment = document.getElementById('commentTextarea');
    if (taComment) {
      taComment.value = comentari;
      taComment.dispatchEvent(new Event('input'));
    }

    _ucActualitzarFilaComentari(studentIdActual, classIdActual, comentari);

    if (passarAlSeguent) {
      // Trobar el seguent alumne a la classe
      if (btnActiu) btnActiu.innerHTML = '⏳ Buscant...';
      const classDoc = await db.collection('classes').doc(classIdActual).get();
      const alumnesIds = (classDoc.exists ? classDoc.data().alumnes : null) || [];
      const idxActual = alumnesIds.indexOf(studentIdActual);
      const idxSeguent = idxActual + 1;

      if (idxSeguent >= alumnesIds.length) {
        if (btnActiu) btnActiu.innerHTML = '✅ Ultim alumne!';
        setTimeout(() => { modal.remove(); }, 1000);
        return;
      }

      const idSeguent = alumnesIds[idxSeguent];
      const docSeguent = await db.collection('alumnes').doc(idSeguent).get();
      const nomSeguent = docSeguent.exists ? (docSeguent.data().nom || 'Alumne') : 'Alumne';

      // Tancar el modal de comentaris que hi ha per sota (si existeix)
      // CRÍTIC: cal fer-ho ABANS d'actualitzar _tcStudentId, altrament
      // el modal de comentaris guardaria amb l'ID del seguent alumne
      const modalComentaris = document.getElementById('modalComments');
      if (modalComentaris) modalComentaris.style.display = 'none';

      // Ara si, actualitzar variables globals al seguent alumne
      window._tcStudentId   = idSeguent;
      window._tcStudentName = nomSeguent;

      // Tancar el modal UC actual i obrir directament el formulari UC del seguent
      // (sense passar pel modal de comentaris)
      const plantillaActual = window._ucPlantillaActiva;
      modal.remove();
      setTimeout(() => {
        carregarIUsarPlantilla(null, plantillaActual);
      }, 150);

    } else {
      // Comportament normal: tanca el modal UC i refresca la taula
      if (btnActiu) btnActiu.innerHTML = '✅ Guardat!';
      setTimeout(() => { modal.remove(); }, 800);
    }

  } catch (err) {
    alert('Error guardant: ' + err.message);
    if (btnActiu) { btnActiu.innerHTML = passarAlSeguent ? '💾 Guardar i següent ▶' : '💾 Guardar a l\'alumne'; btnActiu.disabled = false; }
  }
}


// ============================================================
// LES MEVES PLANTILLES
// ============================================================
async function openMevesPlantillesModal() {
  const uid = window._tutoriaUID;
  if (!uid) { alert("Has d'iniciar sessió per veure les teves plantilles."); return; }

  const modal = document.createElement('div');
  modal.id = 'ucMevesModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10001;display:flex;align-items:flex-start;justify-content:center;
    background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);overflow-y:auto;padding:20px 0;
  `;
  modal.innerHTML = `
    <div style="
      background:#fafafa;border-radius:20px;width:min(640px,95vw);
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      box-shadow:0 24px 80px rgba(0,0,0,0.2);overflow:hidden;
    ">
      <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);padding:22px 28px;color:#fff;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:12px;opacity:.75;margin-bottom:3px;">⚡ ULTRACOMENTATOR</div>
          <h2 style="margin:0;font-size:20px;font-weight:800;">Les meves plantilles</h2>
        </div>
        <button id="ucMevesClose" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;">✕</button>
      </div>
      <div style="padding:24px;">
        <div id="ucMevesLlista" style="display:flex;flex-direction:column;gap:10px;">
          <div style="text-align:center;padding:32px;color:#9ca3af;">
            <div style="font-size:28px;margin-bottom:8px;">⏳</div>
            Carregant plantilles...
          </div>
        </div>
        <div style="margin-top:16px;text-align:center;">
          <button id="ucMevesBack" style="background:none;border:none;color:#6b7280;font-size:13px;cursor:pointer;font-family:inherit;">← Tornar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('ucMevesClose').addEventListener('click', () => { modal.remove(); });
  document.getElementById('ucMevesBack').addEventListener('click', () => { modal.remove(); openUltracomentatorModal(); });

  // Carregar plantilles on l'usuari és propietari o membre
  try {
    const db = window._tutoriaDB;
    const snap = await db.collection('ultracomentator_plantilles')
      .where('membres', 'array-contains', uid)
      .get();

    const llista = document.getElementById('ucMevesLlista');
    if (snap.empty) {
      llista.innerHTML = `
        <div style="text-align:center;padding:32px;color:#9ca3af;">
          <div style="font-size:32px;margin-bottom:8px;">📭</div>
          Encara no tens cap plantilla.<br>
          <button onclick="document.getElementById('ucMevesModal').remove();openCrearPlantillaModal();" style="margin-top:12px;background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-family:inherit;font-weight:600;">✨ Crear la primera</button>
        </div>`;
      return;
    }

    llista.innerHTML = '';
    snap.docs.forEach(doc => {
      const p = doc.data();
      const esPropi = p.creatPer === uid;
      const card = document.createElement('div');
      card.style.cssText = `
        background:#fff;border:1.5px solid ${esPropi ? '#a78bfa' : '#e5e7eb'};border-radius:12px;
        padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;
      `;
      card.innerHTML = `
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-weight:700;font-size:15px;color:#1a1a2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.nom}</span>
            <span style="background:${esPropi ? '#ede9fe' : '#f0f9ff'};color:${esPropi ? '#7c3aed' : '#0369a1'};font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;white-space:nowrap;">
              ${esPropi ? '👑 Propietari' : '👤 Membre'}
            </span>
          </div>
          <div style="font-size:12px;color:#6b7280;">
            ${p.descripcio ? p.descripcio + ' · ' : ''}
            Codi: <strong style="font-family:monospace;letter-spacing:1px;">${p.codi}</strong> · 
            ${p.items ? p.items.length : 0} ítems · 
            ${(p.membresEmail || []).length} membre${(p.membresEmail || []).length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="ucMevesUsar" data-codi="${p.codi}" style="background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">▶ Usar</button>
          <button class="ucMevesCodiBtn" data-codi="${p.codi}" data-nom="${p.nom.replace(/"/g,'&quot;')}" style="background:#f3f4f6;color:#374151;border:none;border-radius:8px;padding:7px 10px;font-size:12px;cursor:pointer;font-family:inherit;" title="Veure codi">🔑</button>
          ${esPropi ? `
            <button class="ucMevesConvidar" data-codi="${p.codi}" data-nom="${p.nom.replace(/"/g,'&quot;')}" style="background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd;border-radius:8px;padding:7px 10px;font-size:12px;cursor:pointer;font-family:inherit;" title="Convidar usuaris">👥</button>
            <button class="ucMevesEditar" data-codi="${p.codi}" style="background:#fef3c7;color:#92400e;border:none;border-radius:8px;padding:7px 10px;font-size:12px;cursor:pointer;font-family:inherit;" title="Editar">✏️</button>
            <button class="ucMevesEsborrar" data-codi="${p.codi}" data-nom="${p.nom.replace(/"/g,'&quot;')}" style="background:#fee2e2;color:#ef4444;border:none;border-radius:8px;padding:7px 10px;font-size:12px;cursor:pointer;font-family:inherit;" title="Esborrar">🗑</button>
          ` : ''}
        </div>
      `;
      llista.appendChild(card);
    });

    // Events
    llista.querySelectorAll('.ucMevesUsar').forEach(btn => {
      btn.addEventListener('click', () => { modal.remove(); carregarIUsarPlantilla(btn.dataset.codi); });
    });
    llista.querySelectorAll('.ucMevesCodiBtn').forEach(btn => {
      btn.addEventListener('click', () => mostrarCodiModal(btn.dataset.codi, btn.dataset.nom));
    });
    llista.querySelectorAll('.ucMevesConvidar').forEach(btn => {
      btn.addEventListener('click', () => openConvidarModal(btn.dataset.codi, btn.dataset.nom));
    });
    llista.querySelectorAll('.ucMevesEditar').forEach(btn => {
      btn.addEventListener('click', () => { modal.remove(); editarPlantilla(btn.dataset.codi); });
    });
    llista.querySelectorAll('.ucMevesEsborrar').forEach(btn => {
      btn.addEventListener('click', () => esborrarPlantilla(btn.dataset.codi, btn.dataset.nom, modal));
    });

  } catch (err) {
    document.getElementById('ucMevesLlista').innerHTML = `<div style="color:#ef4444;padding:16px;">Error: ${err.message}</div>`;
    console.error(err);
  }
}

// ============================================================
// MODAL CONVIDAR USUARIS
// ============================================================
function openConvidarModal(codi, nomPlantilla) {
  const modal = document.createElement('div');
  modal.id = 'ucConvidarModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10002;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);
  `;
  modal.innerHTML = `
    <div style="
      background:#fff;border-radius:20px;padding:36px;max-width:480px;width:90%;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      box-shadow:0 24px 64px rgba(0,0,0,0.2);
    ">
      <h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#1a1a2e;">👥 Convidar a la plantilla</h2>
      <p style="margin:0 0 6px;color:#6b7280;font-size:13px;">${nomPlantilla}</p>

      <!-- CODI PER COMPARTIR -->
      <div style="background:#f5f3ff;border-radius:10px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.5px;">Codi d'accés</div>
          <div style="font-size:22px;font-weight:900;font-family:monospace;letter-spacing:4px;color:#4c1d95;">${codi}</div>
        </div>
        <button id="ucCopiarCodi" style="background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">📋 Copiar</button>
      </div>

      <!-- INVITAR PER EMAIL -->
      <div style="margin-bottom:16px;">
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:8px;">Convidar per correu electrònic:</label>
        <div style="display:flex;gap:8px;">
          <input id="ucEmailConvidar" type="email" placeholder="professor@escola.cat"
            style="flex:1;border:1.5px solid #e5e7eb;border-radius:8px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;">
          <button id="ucBtnConvidar" style="background:#0369a1;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;">Convidar</button>
        </div>
        <div id="ucConvidarMsg" style="font-size:12px;margin-top:8px;display:none;"></div>
      </div>

      <!-- LLISTA MEMBRES -->
      <div>
        <div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Membres actuals:</div>
        <div id="ucMembresList" style="display:flex;flex-direction:column;gap:6px;max-height:150px;overflow-y:auto;">
          <div style="color:#9ca3af;font-size:13px;">Carregant...</div>
        </div>
      </div>

      <button id="ucConvidarClose" style="margin-top:20px;background:none;border:none;color:#9ca3af;font-size:13px;cursor:pointer;font-family:inherit;display:block;width:100%;text-align:center;">Tancar</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Copiar codi
  document.getElementById('ucCopiarCodi').addEventListener('click', () => {
    navigator.clipboard.writeText(codi);
    document.getElementById('ucCopiarCodi').innerHTML = '✅ Copiat!';
    setTimeout(() => { document.getElementById('ucCopiarCodi').innerHTML = '📋 Copiar'; }, 1500);
  });

  document.getElementById('ucEmailConvidar').addEventListener('focus', e => { e.target.style.borderColor = '#0369a1'; });
  document.getElementById('ucEmailConvidar').addEventListener('blur', e => { e.target.style.borderColor = '#e5e7eb'; });
  document.getElementById('ucEmailConvidar').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('ucBtnConvidar').click(); });

  document.getElementById('ucConvidarClose').addEventListener('click', () => { modal.remove(); });

  // Carregar membres
  carregarMembres(codi);

  // Convidar per email
  document.getElementById('ucBtnConvidar').addEventListener('click', async () => {
    const email = document.getElementById('ucEmailConvidar').value.trim().toLowerCase();
    const msgEl = document.getElementById('ucConvidarMsg');
    if (!email || !email.includes('@')) {
      msgEl.style.color = '#ef4444';
      msgEl.textContent = '❌ Introdueix un correu vàlid.';
      msgEl.style.display = 'block';
      return;
    }

    const btn = document.getElementById('ucBtnConvidar');
    btn.innerHTML = '⏳';
    btn.disabled = true;

    try {
      const db = window._tutoriaDB;
      // Buscar l'usuari per email a professors
      const profSnap = await db.collection('professors').where('email', '==', email).limit(1).get();

      if (profSnap.empty) {
        // No trobat → guardar invitació pendent per email
        await db.collection('ultracomentator_plantilles').doc(codi).update({
          invitacionsPendents: firebase.firestore.FieldValue.arrayUnion(email),
          membresEmail: firebase.firestore.FieldValue.arrayUnion(email)
        });
        msgEl.style.color = '#0369a1';
        msgEl.textContent = `✅ Invitació pendent enviada a ${email}. Podrà accedir quan entri a l'aplicació.`;
      } else {
        // Trobat → afegir directament com a membre
        const profUid = profSnap.docs[0].id;
        await db.collection('ultracomentator_plantilles').doc(codi).update({
          membres: firebase.firestore.FieldValue.arrayUnion(profUid),
          membresEmail: firebase.firestore.FieldValue.arrayUnion(email)
        });
        msgEl.style.color = '#059669';
        msgEl.textContent = `✅ ${email} afegit/da com a membre.`;
      }

      msgEl.style.display = 'block';
      document.getElementById('ucEmailConvidar').value = '';
      carregarMembres(codi);

    } catch (err) {
      msgEl.style.color = '#ef4444';
      msgEl.textContent = '❌ Error: ' + err.message;
      msgEl.style.display = 'block';
      console.error(err);
    }

    btn.innerHTML = 'Convidar';
    btn.disabled = false;
  });
}

async function carregarMembres(codi) {
  const el = document.getElementById('ucMembresList');
  if (!el) return;
  try {
    const db = window._tutoriaDB;
    const doc = await db.collection('ultracomentator_plantilles').doc(codi).get();
    if (!doc.exists) return;
    const p = doc.data();
    const emails = p.membresEmail || [];
    const propietariEmail = p.creatPerEmail || '';
    const invPendents = p.invitacionsPendents || [];

    if (emails.length === 0) {
      el.innerHTML = '<div style="color:#9ca3af;font-size:13px;">Sense membres afegits.</div>';
      return;
    }

    el.innerHTML = emails.map(email => {
      const esPropietari = email === propietariEmail;
      const esPendent = invPendents.includes(email) && !esPropietari;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
          <div>
            <span style="font-size:13px;font-weight:600;color:#374151;">${email}</span>
            <span style="margin-left:8px;font-size:11px;padding:2px 7px;border-radius:12px;font-weight:600;
              background:${esPropietari ? '#ede9fe' : esPendent ? '#fef3c7' : '#dcfce7'};
              color:${esPropietari ? '#7c3aed' : esPendent ? '#92400e' : '#166534'};">
              ${esPropietari ? '👑 Propietari' : esPendent ? '⏳ Pendent' : '✅ Membre'}
            </span>
          </div>
          ${!esPropietari ? `<button class="ucEliminarMembre" data-email="${email}" data-codi="${codi}"
            style="background:none;border:none;color:#d1d5db;cursor:pointer;font-size:14px;padding:2px 6px;"
            title="Eliminar membre">✕</button>` : ''}
        </div>
      `;
    }).join('');

    el.querySelectorAll('.ucEliminarMembre').forEach(btn => {
      btn.addEventListener('mouseenter', () => { btn.style.color = '#ef4444'; });
      btn.addEventListener('mouseleave', () => { btn.style.color = '#d1d5db'; });
      btn.addEventListener('click', async () => {
        if (!confirm(`Eliminar ${btn.dataset.email} de la plantilla?`)) return;
        try {
          const db = window._tutoriaDB;
          const docRef = db.collection('ultracomentator_plantilles').doc(btn.dataset.codi);
          const docSnap = await docRef.get();
          const pd = docSnap.data();
          // Buscar uid per email
          const profSnap = await db.collection('professors').where('email', '==', btn.dataset.email).limit(1).get();
          const updates = {
            membresEmail: firebase.firestore.FieldValue.arrayRemove(btn.dataset.email),
            invitacionsPendents: firebase.firestore.FieldValue.arrayRemove(btn.dataset.email)
          };
          if (!profSnap.empty) updates.membres = firebase.firestore.FieldValue.arrayRemove(profSnap.docs[0].id);
          await docRef.update(updates);
          carregarMembres(btn.dataset.codi);
        } catch (err) { alert('Error: ' + err.message); }
      });
    });

  } catch (err) {
    el.innerHTML = `<div style="color:#ef4444;font-size:13px;">Error carregant membres: ${err.message}</div>`;
  }
}

// ============================================================
// EDITAR PLANTILLA EXISTENT
// ============================================================
async function editarPlantilla(codi) {
  try {
    const db = window._tutoriaDB;
    const doc = await db.collection('ultracomentator_plantilles').doc(codi).get();
    if (!doc.exists) { alert('Plantilla no trobada.'); return; }
    const p = doc.data();

    // Obrir modal crear amb dades existents
    openCrearPlantillaModal(p, codi);
  } catch (err) {
    alert('Error carregant plantilla: ' + err.message);
  }
}

// ============================================================
// ESBORRAR PLANTILLA
// ============================================================
async function esborrarPlantilla(codi, nom, mevesModal) {
  if (!confirm(`Segur que vols esborrar la plantilla "${nom}"?
Aquesta acció no es pot desfer.`)) return;
  try {
    const db = window._tutoriaDB;
    await db.collection('ultracomentator_plantilles').doc(codi).delete();
    mevesModal.remove();
    openMevesPlantillesModal();
  } catch (err) {
    alert('Error esborrant: ' + err.message);
  }
}

// ============================================================
// COMPROVAR INVITACIONS PENDENTS EN INICIAR SESSIÓ
// ============================================================
async function comprovarInvitacionsPendents() {
  const uid = window._tutoriaUID;
  const auth = window.firebase && window.firebase.auth && window.firebase.auth();
  if (!uid || !auth || !auth.currentUser) return;
  const email = auth.currentUser.email;
  if (!email) return;

  try {
    const db = window._tutoriaDB;
    const snap = await db.collection('ultracomentator_plantilles')
      .where('invitacionsPendents', 'array-contains', email)
      .get();

    snap.docs.forEach(async doc => {
      await doc.ref.update({
        membres: firebase.firestore.FieldValue.arrayUnion(uid),
        invitacionsPendents: firebase.firestore.FieldValue.arrayRemove(email)
      });
    });

    if (!snap.empty) {
      console.log(`✅ Ultracomentator: ${snap.size} invitació(ns) acceptada(es) per ${email}`);
    }
  } catch (err) {
    console.warn('Ultracomentator invitacions:', err);
  }
}

// Cridar en carregar si ja hi ha usuari autenticat
setTimeout(() => { comprovarInvitacionsPendents(); }, 2000);

// ============================================================
// INICIALITZAR
// ============================================================
// Exposar funcions a window per poder usar-les en onclick inline
window.openCrearPlantillaModal = openCrearPlantillaModal;
window.openMevesPlantillesModal = openMevesPlantillesModal;
window.openUltracomentatorModal = openUltracomentatorModal;
window.carregarIUsarPlantilla = carregarIUsarPlantilla;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUltracomentator);
} else {
  initUltracomentator();
}

// ============================================================
// IMPORTACIÓ EXCEL
// ============================================================

function importarExcelModal() {
  // Necessitem SheetJS (XLSX) — carregar-lo si no està disponible
  if (!window.XLSX) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => { _mostrarModalImport(); };
    script.onerror = () => { alert('Error carregant la llibreria Excel. Comprova la connexió.'); };
    document.head.appendChild(script);
  } else {
    _mostrarModalImport();
  }
}

let _wbActual = null;
let _nomFitxerActual = '';
let _ucDragSrc = null; // element arrossegat en el formulari de comentaris (compartit)

function _mostrarModalImport() {
  // Eliminar si ja existeix
  const old = document.getElementById('ucImportModal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'ucImportModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10003;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);
  `;
  modal.innerHTML = `
    <div style="
      background:#fff;border-radius:20px;padding:36px;max-width:500px;width:90%;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      box-shadow:0 24px 64px rgba(0,0,0,0.2);
    ">
      <h2 style="margin:0 0 6px;font-size:20px;font-weight:800;color:#1a1a2e;">📊 Importar des d'Excel</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.5;">
        Importa una plantilla des d'un fitxer Excel amb el format Ultracomentator.<br>
        Qualsevol Excel amb columnes <strong>TÍTOL ÍTEM N</strong>, <strong>COMENTARI ÍTEM N</strong> i <strong>ASSOLIMENT ÍTEM N</strong> — els títols i comentaris es detecten automàticament.
      </p>

      <!-- ZONA DROP -->
      <div id="ucDropZone" style="
        border:2px dashed #a78bfa;border-radius:12px;padding:32px;text-align:center;
        background:#faf5ff;cursor:pointer;transition:all .2s;margin-bottom:16px;
      ">
        <div style="font-size:40px;margin-bottom:10px;">📂</div>
        <div style="font-weight:700;color:#7c3aed;font-size:15px;margin-bottom:6px;">Arrossega l'Excel aquí</div>
        <div style="color:#9ca3af;font-size:13px;">o clica per seleccionar fitxer</div>
        <input type="file" id="ucFileInput" accept=".xlsx,.xls" style="display:none;">
      </div>

      <!-- FORMAT INFO -->
      <div style="background:#f0fdf4;border-radius:10px;padding:12px 16px;margin-bottom:20px;">
        <div style="font-size:13px;color:#166534;font-weight:600;margin-bottom:6px;">📋 Format esperat:</div>
        <div style="font-size:12px;color:#15803d;line-height:1.7;">
          • <strong>Fila 2:</strong> Títols dels ítems (ex: "Mètode científic", "Velocitat"...)<br>
          • <strong>Fila 4:</strong> Comentaris de l'ítem en columnes seguides (s'importen tots com a seleccionables)<br>
          • Compatible amb el format EXPERIMENTA/Ultracomentator
        </div>
      </div>

      <div id="ucImportError" style="color:#ef4444;font-size:13px;margin-bottom:12px;display:none;padding:10px;background:#fef2f2;border-radius:8px;"></div>
      <div id="ucImportPreview" style="display:none;"></div>

      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="ucImportCancel" style="background:#f3f4f6;color:#374151;border:none;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Cancelar</button>
        <button id="ucImportOk" style="background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;display:none;">✅ Importar plantilla</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  let plantillaImportada = null;

  // Drag & Drop
  const dropZone = document.getElementById('ucDropZone');
  const fileInput = document.getElementById('ucFileInput');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.background = '#ede9fe';
    dropZone.style.borderColor = '#7c3aed';
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.style.background = '#faf5ff';
    dropZone.style.borderColor = '#a78bfa';
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.background = '#faf5ff';
    dropZone.style.borderColor = '#a78bfa';
    const file = e.dataTransfer.files[0];
    if (file) processarFitxer(file);
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) processarFitxer(e.target.files[0]);
  });

  function processarFitxer(file) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      mostrarError('El fitxer ha de ser .xlsx o .xls');
      return;
    }

    dropZone.innerHTML = `<div style="font-size:24px;margin-bottom:8px;">⏳</div><div style="color:#7c3aed;font-weight:600;">Llegint fitxer...</div>`;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        _wbActual = XLSX.read(data, { type: 'array' });
        _nomFitxerActual = file.name.replace(/\.(xlsx|xls)$/i, '');

        plantillaImportada = parsejarWorkbook(_wbActual, _nomFitxerActual);

        if (!plantillaImportada || plantillaImportada.items.length === 0) {
          // No s'ha pogut detectar automàticament → mode assistent
          _mostrarAssistentImport(_wbActual, _nomFitxerActual, dropZone, mostrarError,
            (plantilla) => {
              plantillaImportada = plantilla;
              mostrarPreview(plantillaImportada);
              document.getElementById('ucImportOk').style.display = 'inline-block';
              dropZone.innerHTML = `<div style="font-size:28px;margin-bottom:8px;">✅</div><div style="color:#059669;font-weight:700;">${file.name}</div><div style="color:#6b7280;font-size:12px;margin-top:4px;">${plantillaImportada.items.length} ítems detectats manualment</div>`;
              dropZone.style.borderColor = '#34d399';
              dropZone.style.background = '#f0fdf4';
            }
          );
          return;
        }

        mostrarPreview(plantillaImportada);
        document.getElementById('ucImportOk').style.display = 'inline-block';
        dropZone.innerHTML = `<div style="font-size:28px;margin-bottom:8px;">✅</div><div style="color:#059669;font-weight:700;">${file.name}</div><div style="color:#6b7280;font-size:12px;margin-top:4px;">${plantillaImportada.items.length} ítems trobats</div>`;
        dropZone.style.borderColor = '#34d399';
        dropZone.style.background = '#f0fdf4';

      } catch (err) {
        mostrarError('Error llegint el fitxer: ' + err.message);
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function mostrarError(msg) {
    const el = document.getElementById('ucImportError');
    el.textContent = '❌ ' + msg;
    el.style.display = 'block';
  }

  function mostrarPreview(plantilla) {
    const preview = document.getElementById('ucImportPreview');
    preview.style.display = 'block';
    preview.innerHTML = `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:16px;max-height:200px;overflow-y:auto;">
        <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Previsualització (${plantilla.items.length} ítems):</div>
        ${plantilla.items.map(item => `
          <div style="margin-bottom:8px;">
            <div style="font-weight:600;font-size:13px;color:#374151;">🧩 ${item.titol}</div>
            <div style="font-size:12px;color:#6b7280;margin-left:16px;">${item.comentaris.length} comentaris</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  document.getElementById('ucImportCancel').addEventListener('click', () => { modal.remove(); });
  document.getElementById('ucImportOk').addEventListener('click', () => {
    if (!plantillaImportada) return;
    modal.remove();

    // Omplir el formulari de crear amb les dades importades
    document.getElementById('ucPlantillaNom').value = plantillaImportada.nom;
    document.getElementById('ucPlantillaDesc').value = plantillaImportada.descripcio || '';

    // Netejar ítems existents
    const container = document.getElementById('ucItemsContainer');
    container.querySelectorAll('[data-item-id]').forEach(el => el.remove());
    const empty = document.getElementById('ucItemsEmpty');
    if (empty) empty.style.display = 'none';

    // Afegir ítems importats
    plantillaImportada.items.forEach(item => afegirItemUI(item));

    // Scroll cap amunt
    document.getElementById('ucCrearModal').scrollTop = 0;
  });
}


// ============================================================
// DESCARREGAR PLANTILLA EXCEL (replica l'Excel original)
// ============================================================
function descarregarPlantillaExcel() {
  if (typeof XLSX === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => _generarExcelPlantilla();
    script.onerror = () => alert('Error carregant la llibreria Excel.');
    document.head.appendChild(script);
  } else {
    _generarExcelPlantilla();
  }
}

function _generarExcelPlantilla() {
  // Dades extretes de la plantilla original
  const PLANTILLA = {"f1c3": "EXPERIMENTA", "f2c3": "COM ES MOUEN LES COSES?", "f4b": "EXPERIMENTA (alumnes)", "f4c": "Aquest trimestre a EXPERIMENTA, amb el projecte \"Com es mouen les coses?\", hem treballat el mètode científic i la física del moviment (cinemàtica i dinàmica) amb un producte final relacionat amb la seguretat viària.", "items": [{"titol": "Mètode científic", "capcelera": "Pel que fa al mètode científic:", "comentaris": ["Identifica les parts del mètode científic i es capç d'utilitzar-les en el disseny d'experimentació fent una pregunta investigable i identificant clarament les variables independents, dependents i a controlar.", "Identifica les parts del mètode científic però té algunes dificultats per utilitzar-les en el disseny d'experimentació i/o per fer una pregunta investigable i identificant clarament les variables independents, dependents i a controlar.", "Té dificultats per identificar les parts del mètode científic i per utilitzar-les en el disseny d'experimentació i/o per fer una pregunta investigable i identificant clarament les variables independents, dependents i a controlar.", "No és capaç d'identificar les parts del mètode científic i per tant d'utilitzar-les en el disseny d'experimentació ni de formular una pregunta investigable. No identifica les variables independents, dependents i a controlar."], "colTitol": 3, "colItem": 6}, {"titol": "Cinemàtica - Velocitat", "capcelera": "Pel que fa al concepte de velocitat:", "comentaris": ["Interpreta correctament el concepte de velocitat, realitza correctament els càlculs adients per interpretar el moviment uniforme i no uniforme , interpreta i genera correctament la irepresentació gràfica de la velocitat. Fa servir tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final.", "Interpreta correctament el concepte de velocitat, però presenta algunes dificultats en els càlculs adients per interpretar el moviment uniforme i no uniforme , interpreta i genera correctament la irepresentació gràfica de la velocitat. Fa servir tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final.", "Interpreta correctament el concepte de velocitat, realitza correctament els càlculs adients per interpretar el moviment uniforme i no uniforme , però presenta dificultats per interpretar i generar correctament la irepresentació gràfica de la velocitat. Fa servir tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final.", "Interpreta correctament el concepte de velocitat, realitza correctament els càlculs adients per interpretar el moviment uniforme i no uniforme ,  interpreta i genera correctament la irepresentació gràfica de la velocitat. Presenta algunes dificultats en fer servir tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final.", "Té algunes dificultats per interpretar correctament el concepte de velocitat, en els càlculs adients per interpretar el moviment uniforme i no uniforme , i per interpretar i generar correctament la representació gràfica de la velocitat. Té algunes dificultats per fer servir tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final.", "No interpreta correctament el concepte de velocitat, comet errors greus en els càlculs per interpretar el moviment uniforme i no uniforme  i per interpretar i generar correctament la representació gràfica de la velocitat. No fa servir, o ho fa de forma incorrecta, tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final."], "colTitol": 11, "colItem": 14}, {"titol": "Cinemàtica - Acceleració", "capcelera": "Pel que fa al concepte d'acceleració:", "comentaris": ["Interpreta correctament el concepte d'acceleració, realitza correctament els càlculs adients per interpretar el moviment no uniforme , interpreta correctament la representació vectorial de l'acceleració i velocitat. Fa servir tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final.", "Interpreta correctament el concepte d'acceleració, però presenta algunes dificultats en els càlculs adients per interpretar el moviment no uniforme , interpreta correctament la representació vectorial de l'acceleració i velocitat. Fa servir tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final.", "Interpreta correctament el concepte d'acceleració, realitza correctament els càlculs adients per interpretar el moviment no uniforme , però presenta dificultats en lairepresentació vectorial de l'acceleració i velocitat. Fa servir tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final.", "Interpreta correctament el concepte de velocitat, realitza correctament els càlculs adients per interpretar el moviment uniforme i no uniforme ,  interpreta  correctament la representació vectorial de l'acceleració ivelocitat. Presenta algunes dificultats en fer servir tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final.", "Té algunes dificultats per interpretar correctament el concepte d'acceleració, en els càlculs adients per interpretar el moviment no uniforme , i per interpretar i generar correctament la representació gràfica de l'acceleració. Té algunes dificultats per fer servir tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final.", "No interpreta correctament el concepte d'acceleració, comet errors greus en els càlculs per interpretar el moviment no uniforme  i per interpretar la representació vectorial de l'acceleració i la velocitat. No fa servir, o ho fa de forma incorrecta, tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final."], "colTitol": 21, "colItem": 24}, {"titol": "", "capcelera": "Pel que fa al concepte de força:", "comentaris": ["Interpreta correctament el concepte de força i realitza correctament els càlculs. Coneix, interpreta i aplica correctament les lleis de Newton. Fa servir tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final.", "Interpreta correctament el concepte de foça però comet algun error en els càlculs. Coneix, interpreta i aplica correctament les lleis de Newton. Fa servir tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final.", "Interpreta correctament el concepte de força i realitza correctament els càlculs. Presenta alguna dificultat en interpretar i aplicar correctament les lleis de Newton. Fa servir tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final.", "Interpreta correctament el concepte de força i realitza correctament els càlculs.  Coneix, interpreta i aplica correctament les lleis de Newton. Presenta alguna dificultat per fer servir tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final.", "Té algunes dificultats per Interpretar correctament el concepte de força i realitzar els càlculs.  Coneix, interpreta i aplica de forma parcial les lleis de Newton. Presenta alguna dificultat per fer servir tots aquests conceptes per relacionar-los amb la seguretat viària en el seu producte final.", "No Interpreta correctament el concepte de força i comet errors greus en els càlculs.  No coneix o té dificultats importants per  interpretar i aplicar les lleis de Newton. No relaciona tots aquests conceptes amb la seguretat viària en el seu producte final."], "colTitol": 31, "colItem": 34}]};

  const wb = XLSX.utils.book_new();
  const ws = {};

  const enc = (r, c) => XLSX.utils.encode_cell({ r, c });
  const setV = (r, c, v) => { ws[enc(r,c)] = { v, t: 's' }; };
  const setF = (r, c, f) => { ws[enc(r,c)] = { f, t: 's' }; };

  const MAX_FILES = 35;

  // Fila 1 (r=0)
  setV(0, 2, PLANTILLA.f1c3);

  // Fila 2 (r=1): nom projecte
  setV(1, 2, PLANTILLA.f2c3);

  // Fila 4 (r=3): etiqueta alumnes + descripció general
  setV(3, 1, PLANTILLA.f4b);
  setV(3, 2, PLANTILLA.f4c);

  // Processar cada ítem
  PLANTILLA.items.forEach((item, idx) => {
    const colTitol = item.colTitol;  // 0-based
    const colItem  = item.colItem;   // 0-based (capçalera)
    const CL = XLSX.utils.encode_col;

    // Fila 2: títol ítem
    if (item.titol) setV(1, colItem, item.titol);

    // Fila 3: marca x
    setV(2, colItem, 'x');

    // Fila 4: capçalera
    if (item.capcelera) setV(3, colItem, item.capcelera + '\n');

    // Fila 4: comentaris
    item.comentaris.forEach((com, ci) => {
      setV(3, colItem + 1 + ci, com);
    });

    // Fila 4: etiquetes columnes resultat
    setV(3, colTitol,     `TÍTOL ÍTEM ${idx + 1}`);
    setV(3, colTitol + 1, `COMENTARI ÍTEM ${idx + 1}`);
    setV(3, colTitol + 2, `ASSOLIMENT ÍTEM ${idx + 1}`);

    // Fórmula CONCATENATE: capçalera + cada comentari si no buit
    const capCol = CL(colItem);
    const comCols = item.comentaris.map((_, ci) => CL(colItem + 1 + ci));
    const firstCom = comCols.length > 0 ? comCols[0] : capCol;

    // Files alumnes (r=4 a r=4+MAX_FILES-1)
    for (let row = 4; row < 4 + MAX_FILES; row++) {
      const r1 = row + 1;

      // TÍTOL: =$[capCol]$2
      setF(row, colTitol, `$${capCol}$$2`);

      // COMENTARI: IF(ISBLANK(firstCom_row),,CONCATENATE(cap, com1, com2...))
      if (comCols.length > 0) {
        const parts = comCols.map(cl => `IF(ISBLANK(${cl}${r1}),"",$${cl}$$4)`).join(',');
        setF(row, colTitol + 1,
          `IF(ISBLANK(${firstCom}${r1}),,CONCATENATE($${capCol}$$4,${parts}))`
        );
      }

      // ASSOLIMENT: buit
    }
  });

  // Rang
  const lastItem = PLANTILLA.items[PLANTILLA.items.length - 1];
  const maxCol = lastItem.colTitol + 3 + lastItem.comentaris.length + 2;
  ws['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: 4 + MAX_FILES, c: maxCol });

  // Amplades columnes
  const colWidths = [];
  for (let i = 0; i < maxCol; i++) colWidths.push({ wch: i < 2 ? 8 : 24 });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'RECULL');
  XLSX.writeFile(wb, 'Plantilla_ULTRACOMENTATOR.xlsx');
}


// ============================================================
// ============================================================
// PARSEJAR EXCEL → ESTRUCTURA PLANTILLA (parser universal v2)
// Suporta: TÍTOL ÍTEM N estàndard, ítems sense marcador, tots
// els ítems amb el mateix número, fulls AP1/AP2... separats
// ============================================================
const _IS_HEADER = v => !!(v && /T[IÍ]TOL|COMENTAR|ASSOLIMENT/i.test(v));

function _getCellWs(ws, r, c) {
  const cell = ws[XLSX.utils.encode_cell({ r, c })];
  if (!cell || cell.v === undefined || cell.v === null) return null;
  const s = String(cell.v).trim();
  return (s && !s.startsWith('=') && s !== '#REF!') ? s : null;
}

function _capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// ──────────────────────────────────────────────────────────────
// MODE ASSISTENT: quan el parser automàtic falla, guia l'usuari
// perquè identifiqui manualment l'estructura del seu Excel
// ──────────────────────────────────────────────────────────────
function _mostrarAssistentImport(wb, nomFitxer, dropZone, mostrarError, onSuccess) {
  // Estat de l'assistent
  const estat = {
    pas: 0,           // 0=triar full, 1=triar fila, 2=confirmar ítems
    fullNom: wb.SheetNames[0],
    filaEst: 1,       // fila (1-indexed) on estan els títols/capçaleres
    ws: null,
    previewData: [],  // matriu de cel·les per mostrar
    items: []
  };

  // Renderitzar vista previsualització d'un full com a taula HTML
  function renderPreview(ws, maxRows = 8, maxCols = 12, highlightRow = -1) {
    if (!ws || !ws['!ref']) return '<em>Full buit</em>';
    const range = XLSX.utils.decode_range(ws['!ref']);
    const rows = Math.min(range.e.r + 1, maxRows);
    const cols = Math.min(range.e.c + 1, maxCols);
    const cel = (r, c) => _getCellWs(ws, r, c) || '';
    const colLetter = c => String.fromCharCode(65 + c);

    let html = `<div style="overflow-x:auto;max-height:260px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;">
      <table style="border-collapse:collapse;font-size:11px;min-width:100%;">
        <thead><tr style="background:#f3f4f6;position:sticky;top:0;">
          <th style="padding:4px 6px;border:1px solid #e5e7eb;color:#9ca3af;font-weight:500;">#</th>`;
    for (let c = 0; c < cols; c++)
      html += `<th style="padding:4px 8px;border:1px solid #e5e7eb;color:#9ca3af;font-weight:500;">${colLetter(c)}</th>`;
    html += `</tr></thead><tbody>`;
    for (let r = 0; r < rows; r++) {
      const isHL = r === highlightRow;
      html += `<tr style="background:${isHL ? '#fef9c3' : r % 2 === 0 ? '#fff' : '#f9fafb'};">`;
      html += `<td style="padding:3px 6px;border:1px solid #e5e7eb;color:#9ca3af;font-weight:600;text-align:center;">${r + 1}</td>`;
      for (let c = 0; c < cols; c++) {
        const v = cel(r, c);
        const short = v.length > 28 ? v.substring(0, 26) + '…' : v;
        const bg = isHL && v ? '#fde047' : '';
        html += `<td style="padding:3px 8px;border:1px solid #e5e7eb;max-width:180px;overflow:hidden;white-space:nowrap;${bg ? 'background:' + bg + ';font-weight:600;' : ''}" title="${v.replace(/"/g,"'")}">${short || '<span style="color:#e5e7eb;">·</span>'}</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    if (range.e.r + 1 > maxRows) html += `<div style="font-size:11px;color:#9ca3af;margin-top:4px;">… i ${range.e.r + 1 - maxRows} files més</div>`;
    return html;
  }

  // Contenidor de l'assistent (substitueix la drop zone)
  const cont = document.createElement('div');
  cont.id = 'ucAssistentImport';
  cont.style.cssText = 'margin-top:12px;padding:16px;background:#faf5ff;border:2px solid #a855f7;border-radius:12px;';
  dropZone.parentNode.insertBefore(cont, dropZone.nextSibling);
  dropZone.style.display = 'none';

  function renderPas() {
    cont.innerHTML = '';

    // ── PAS 0: triar quin full ──
    if (estat.pas === 0) {
      cont.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:20px;">🔍</span>
          <div>
            <div style="font-weight:700;color:#7c3aed;font-size:14px;">No he pogut detectar l'estructura automàticament</div>
            <div style="color:#6b7280;font-size:12px;">Et faré unes preguntes per identificar-la manualment.</div>
          </div>
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-weight:600;color:#374151;font-size:13px;display:block;margin-bottom:6px;">
            📋 Quin full conté les plantilles de comentaris?
          </label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${wb.SheetNames.map(s => `
              <button onclick="document.getElementById('ucAssistentImport')._selFull('${s.replace(/'/g,"\\'")}')"
                style="padding:6px 14px;border-radius:8px;border:2px solid ${s === estat.fullNom ? '#7c3aed' : '#e5e7eb'};
                background:${s === estat.fullNom ? '#7c3aed' : '#fff'};color:${s === estat.fullNom ? '#fff' : '#374151'};
                font-size:13px;cursor:pointer;font-weight:600;">${s}</button>
            `).join('')}
          </div>
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-weight:600;color:#374151;font-size:12px;display:block;margin-bottom:4px;">Previsualització del full <strong>${estat.fullNom}</strong>:</label>
          ${renderPreview(wb.Sheets[estat.fullNom])}
        </div>
        <button onclick="document.getElementById('ucAssistentImport')._next()"
          style="padding:8px 20px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">
          Continuar →
        </button>`;

      cont._selFull = (s) => { estat.fullNom = s; estat.ws = wb.Sheets[s]; renderPas(); };
      cont._next = () => { estat.ws = wb.Sheets[estat.fullNom]; estat.pas = 1; renderPas(); };
    }

    // ── PAS 1: triar fila on estan els títols/capçaleres ──
    else if (estat.pas === 1) {
      const ws = estat.ws;
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:Z10');
      const maxRows = Math.min(range.e.r + 1, 20);
      // Detectar suggeriment: fila amb el text més llarg o "COMENTARI"
      let sugFila = 0;
      for (let r = 0; r < Math.min(maxRows, 10); r++) {
        for (let c = 0; c < Math.min(range.e.c + 1, 20); c++) {
          const v = _getCellWs(ws, r, c) || '';
          if (/COMENTARI/i.test(v) || /ASSOLIMENT/i.test(v)) { sugFila = r; break; }
        }
        if (sugFila) break;
      }
      estat.filaEst = sugFila;

      cont.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:20px;">📍</span>
          <div>
            <div style="font-weight:700;color:#7c3aed;font-size:14px;">A quina fila estan els títols i comentaris?</div>
            <div style="color:#6b7280;font-size:12px;">Selecciona la fila que conté els títols dels ítems i els seus comentaris opcionals.</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <label style="font-weight:600;color:#374151;font-size:13px;">Fila número:</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${Array.from({length: Math.min(maxRows, 12)}, (_,i) => i).map(r => {
              // Resumir contingut de la fila
              let preview = '';
              for (let c = 0; c < Math.min(range.e.c + 1, 5); c++) {
                const v = _getCellWs(ws, r, c) || '';
                if (v && v.length > 1) { preview = v.substring(0, 25) + (v.length > 25 ? '…' : ''); break; }
              }
              const isS = r === estat.filaEst;
              return `<button onclick="document.getElementById('ucAssistentImport')._selFila(${r})"
                style="padding:5px 12px;border-radius:8px;border:2px solid ${isS ? '#7c3aed' : '#e5e7eb'};
                background:${isS ? '#7c3aed' : '#fff'};color:${isS ? '#fff' : '#374151'};
                font-size:12px;cursor:pointer;font-weight:600;text-align:left;max-width:160px;overflow:hidden;white-space:nowrap;">
                ${r + 1}${preview ? ': <span style="font-weight:400;font-size:11px;">' + preview + '</span>' : ''}
              </button>`;
            }).join('')}
          </div>
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-weight:600;color:#374151;font-size:12px;display:block;margin-bottom:4px;">
            Previsualització (fila ${estat.filaEst + 1} ressaltada):
          </label>
          ${renderPreview(ws, 10, 12, estat.filaEst)}
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="document.getElementById('ucAssistentImport')._back()"
            style="padding:8px 16px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;">
            ← Enrere
          </button>
          <button onclick="document.getElementById('ucAssistentImport')._next2()"
            style="padding:8px 20px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">
            Analitzar aquesta fila →
          </button>
        </div>`;

      cont._selFila = (r) => { estat.filaEst = r; renderPas(); };
      cont._back = () => { estat.pas = 0; renderPas(); };
      cont._next2 = () => { estat.pas = 2; _analitzarFila(); renderPas(); };
    }

    // ── PAS 2: mostrar ítems detectats i confirmar ──
    else if (estat.pas === 2) {
      const ok = estat.items.length > 0;
      cont.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:20px;">${ok ? '✅' : '⚠️'}</span>
          <div>
            <div style="font-weight:700;color:${ok ? '#059669' : '#d97706'};font-size:14px;">
              ${ok ? estat.items.length + ' ítems detectats a la fila ' + (estat.filaEst + 1) : 'No s\'he pogut detectar ítems en aquesta fila'}
            </div>
            <div style="color:#6b7280;font-size:12px;">
              ${ok ? 'Comprova que els ítems semblen correctes abans de continuar.' : 'Prova una altra fila o un altre full.'}
            </div>
          </div>
        </div>
        ${ok ? `
        <div style="margin-bottom:12px;max-height:200px;overflow-y:auto;">
          ${estat.items.map((it, i) => `
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:6px;">
              <div style="font-weight:700;color:#7c3aed;font-size:13px;margin-bottom:2px;">Ítem ${i+1}: ${it.titol}</div>
              <div style="font-size:11px;color:#6b7280;">${it.comentaris.length} comentari${it.comentaris.length !== 1 ? 's' : ''} detectat${it.comentaris.length !== 1 ? 's' : ''}</div>
              ${it.comentaris.slice(0,2).map(c => `<div style="font-size:11px;color:#374151;margin-top:2px;padding-left:8px;border-left:2px solid #e5e7eb;">• ${c.text.substring(0,80)}${c.text.length>80?'…':''}</div>`).join('')}
              ${it.comentaris.length > 2 ? `<div style="font-size:11px;color:#9ca3af;padding-left:8px;">… i ${it.comentaris.length - 2} més</div>` : ''}
            </div>
          `).join('')}
        </div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button onclick="document.getElementById('ucAssistentImport')._back2()"
            style="padding:8px 16px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;">
            ← Tornar a triar fila
          </button>
          ${ok ? `
          <button onclick="document.getElementById('ucAssistentImport')._confirmar()"
            style="padding:8px 20px;background:#059669;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">
            ✅ Usar aquests ítems
          </button>` : ''}
        </div>`;

      cont._back2 = () => { estat.pas = 1; renderPas(); };
      cont._confirmar = () => {
        cont.remove();
        dropZone.style.display = '';
        onSuccess({ nom: nomFitxer || 'Plantilla importada', descripcio: '', items: estat.items });
      };
    }
  }

  // Analitzar la fila seleccionada per trobar ítems
  function _analitzarFila() {
    const ws = estat.ws;
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:Z10');
    const maxCol = range.e.c + 1;
    const r = estat.filaEst;
    const cel = (c) => _getCellWs(ws, r, c) || '';
    const isHdr = v => !v || _IS_HEADER(v) || /^[xX]$/.test(v.trim()) || v.startsWith('=') || v.includes('#REF');

    estat.items = [];

    // Estratègia A: patró [títol][COMENTARI][ASSOLIMENT][coms...]
    for (let c = 0; c < maxCol - 2; c++) {
      const v = cel(c), v1 = cel(c+1), v2 = cel(c+2);
      if (!v || isHdr(v) || v.length < 3) continue;
      if (!/COMENTARI/i.test(v1)) continue;
      if (!/ASSOLIMENT/i.test(v2)) continue;
      const coms = [];
      for (let c2 = c+3; c2 < maxCol; c2++) {
        const t = cel(c2);
        if (!t || t.length < 5 || isHdr(t)) continue;
        coms.push({ id: 'com_' + Date.now() + '_' + c2, text: t, nivell: 'general' });
      }
      if (coms.length > 0) {
        estat.items.push({ id: 'item_' + Date.now() + '_' + c, titol: _capFirst(v),
          capcelera: `Pel que fa a ${v.toLowerCase()}:`, comentaris: coms });
      }
      break; // un ítem per full
    }

    // Estratègia B: múltiples ítems a la mateixa fila amb TÍTOL ÍTEM o text+COMENTARI+ASSOLIMENT
    if (estat.items.length === 0) {
      let c = 0;
      while (c < maxCol) {
        const v = cel(c);
        if (!v || isHdr(v) || v.length < 3) { c++; continue; }
        const v1 = cel(c+1), v2 = cel(c+2);
        if (/COMENTARI/i.test(v1) && /ASSOLIMENT/i.test(v2)) {
          const coms = [];
          for (let c2 = c+3; c2 < maxCol; c2++) {
            const t = cel(c2);
            if (!t) { c2++; continue; }
            if (/COMENTARI/i.test(t) && /ASSOLIMENT/i.test(cel(c2+1)||'')) break;
            if (!isHdr(t) && t.length >= 5)
              coms.push({ id: 'com_'+Date.now()+'_'+c2, text: t, nivell:'general' });
            c2++;
          }
          if (coms.length > 0)
            estat.items.push({ id:'item_'+Date.now()+'_'+c, titol:_capFirst(v),
              capcelera:`Pel que fa a ${v.toLowerCase()}:`, comentaris:coms });
          c += 3 + coms.length;
        } else { c++; }
      }
    }

    // Estratègia C: simplement recollir tots els textos llargs com a comentaris
    // d'un únic ítem (fallback final)
    if (estat.items.length === 0) {
      const coms = [];
      let titol = '';
      for (let c = 0; c < maxCol; c++) {
        const v = cel(c);
        if (!v || isHdr(v)) continue;
        if (!titol && v.length >= 3) { titol = _capFirst(v); continue; }
        if (v.length >= 5) coms.push({ id:'com_'+Date.now()+'_'+c, text:v, nivell:'general' });
      }
      if (titol && coms.length > 0)
        estat.items.push({ id:'item_0', titol, capcelera:`Pel que fa a ${titol.toLowerCase()}:`, comentaris:coms });
    }
  }

  // Iniciar
  estat.ws = wb.Sheets[estat.fullNom];
  // Si només hi ha un full, saltar directament al pas 1
  if (wb.SheetNames.length === 1) { estat.pas = 1; }
  renderPas();
}

function parsejarFullExcel(ws, nomFitxer) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:Z10');
  const maxRow = range.e.r + 1;
  const maxCol = range.e.c + 1;
  const cell = (r, c) => _getCellWs(ws, r, c);
  const isHdr = v => !v || _IS_HEADER(v) || /^[xX]$/.test(v.trim()) || v.startsWith('=') || v.includes('#REF');

  // ── 1. Trobar fila estructura: qualsevol TÍTOL ÍTEM o ASSOLIMENT ÍTEM ──
  let filaEst = -1;
  for (let r = 0; r < Math.min(maxRow, 20) && filaEst < 0; r++) {
    for (let c = 0; c < maxCol; c++) {
      const v = cell(r, c);
      if (v && (/T[IÍ]TOL\s+[IÍ]TEM/i.test(v) || /ASSOLIMENT\s+[IÍ]TEM\s*1\b/i.test(v))) {
        filaEst = r; break;
      }
    }
  }

  // ── 2. Si no hi ha fila d'estructura: full tipus AP (títol+COMENTARI+ASSOLIMENT) ──
  if (filaEst < 0) {
    for (let r = 0; r < Math.min(maxRow, 10); r++) {
      for (let c = 0; c < maxCol - 2; c++) {
        const v = cell(r, c), v1 = cell(r, c+1), v2 = cell(r, c+2);
        if (v && !isHdr(v) && v1 && /COMENTARI/i.test(v1) && v2 && /ASSOLIMENT/i.test(v2)) {
          const coms = [];
          for (let c2 = c+3; c2 < maxCol; c2++) {
            const t = cell(r, c2); if (!t || isHdr(t)) break; coms.push(t);
          }
          const titol = _capFirst(v);
          return { nom: nomFitxer || titol || 'Plantilla importada', descripcio: '',
            items: [{ id: 'item_0', titol, capcelera: titol,
              comentaris: coms.map((t,i) => ({ id:'com_'+i, text:t, nivell:'general' })) }] };
        }
      }
    }
    return null;
  }

  // ── 3. Escanejar la fila d'estructura col per col ──
  const items = [];
  let c = 0;
  while (c < maxCol) {
    const v = cell(filaEst, c);

    // Cas A: TÍTOL ÍTEM N  →  col+3=capçalera, col+4..=coms
    if (v && /T[IÍ]TOL\s+[IÍ]TEM/i.test(v)) {
      const colCap = c + 3, colCom1 = c + 4;
      let titol = '';
      for (let r = filaEst-1; r >= 0 && !titol; r--) {
        for (let tc = c; tc < Math.min(c+5, maxCol) && !titol; tc++) {
          const vt = cell(r, tc);
          if (vt && !isHdr(vt)) titol = _capFirst(vt);
        }
      }
      const capcelera = !isHdr(cell(filaEst, colCap)) ? (cell(filaEst, colCap)||'') : '';
      const comentaris = []; let c2 = colCom1;
      while (c2 < maxCol) {
        const v2 = cell(filaEst, c2);
        if (!v2) { c2++; continue; }
        if (/T[IÍ]TOL\s+[IÍ]TEM/i.test(v2)) break;
        // Detectar nou grup sense TÍTOL ÍTEM: text llarg seguit de COMENTARI
        const nxt = cell(filaEst, c2+1)||'';
        if (!isHdr(v2) && v2.length > 15 && /^COMENTARI$/i.test(nxt)) break;
        if (!isHdr(v2)) comentaris.push({ id:'com_'+Date.now()+'_'+c2, text:v2, nivell:'general' });
        c2++;
      }
      if (!titol && capcelera) titol = _capFirst(capcelera.replace(/:.*/, '').trim());
      if (capcelera || comentaris.length > 0)
        items.push({ id:'item_'+Date.now()+'_'+c, titol, capcelera, comentaris });
      c = c2;

    // Cas B: text llarg (títol) seguit de COMENTARI + ASSOLIMENT ÍTEM N
    } else if (v && !isHdr(v) && v.length > 10) {
      const nxt1 = cell(filaEst, c+1)||'', nxt2 = cell(filaEst, c+2)||'';
      if (/^COMENTARI$/i.test(nxt1) && /ASSOLIMENT\s+[IÍ]TEM/i.test(nxt2)) {
        const titol = _capFirst(v);
        // Capçalera: primer text llarg a col+3
        let capcelera = '', colCom1 = c+3;
        const vc3 = cell(filaEst, c+3)||'';
        if (!isHdr(vc3) && vc3.length > 20) { capcelera = vc3; colCom1 = c+4; }
        const comentaris = []; let c2 = colCom1;
        while (c2 < maxCol) {
          const v2 = cell(filaEst, c2);
          if (!v2) { c2++; continue; }
          if (/T[IÍ]TOL\s+[IÍ]TEM/i.test(v2)) break;
          const nxt = cell(filaEst, c2+1)||'';
          if (!isHdr(v2) && v2.length > 15 && /^COMENTARI$/i.test(nxt)) break;
          if (!isHdr(v2)) comentaris.push({ id:'com_'+Date.now()+'_'+c2, text:v2, nivell:'general' });
          c2++;
        }
        if (capcelera || comentaris.length > 0)
          items.push({ id:'item_'+Date.now()+'_'+c, titol, capcelera, comentaris });
        c = c2;
      } else { c++; }
    } else { c++; }
  }

  if (items.length === 0) return null;

  // Nom plantilla
  let nomPlantilla = nomFitxer || 'Plantilla importada';
  for (let r = 0; r < filaEst && nomPlantilla === (nomFitxer||'Plantilla importada'); r++) {
    for (let c2 = 0; c2 < Math.min(maxCol, 10); c2++) {
      const v = cell(r, c2);
      if (v && !v.startsWith('=') && v.length > 3) { nomPlantilla = v; break; }
    }
  }
  return { nom: nomPlantilla, descripcio: '', items };
}

// Gestiona el workbook sencer: RECULL, primer full, o fulls AP1/AP2...
function parsejarWorkbook(wb, nomFitxer) {
  // 1. Provar RECULL
  if (wb.SheetNames.includes('RECULL')) {
    const res = parsejarFullExcel(wb.Sheets['RECULL'], nomFitxer);
    if (res && res.items.length > 0) return res;
  }

  // 2. Provar cada full individualment (el primer que funcioni)
  for (const sname of wb.SheetNames) {
    const res = parsejarFullExcel(wb.Sheets[sname], nomFitxer);
    if (res && res.items.length > 0) return res;
  }

  // 3. Format multi-full: cada full = un ítem
  // Detecta: el full té F2C_titol="text del títol", F2C_seg="COMENTARI", i comentaris a les cols següents
  const items = [];
  for (const sname of wb.SheetNames) {
    const ws = wb.Sheets[sname];
    if (!ws['!ref']) continue;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const maxRow = range.e.r + 1;
    const maxCol = range.e.c + 1;
    const cel = (r, c) => _getCellWs(ws, r, c);

    // Escanejar files 1-5: buscar patró [títol][COMENTARI][ASSOLIMENT][com1][com2]...
    for (let r = 0; r < Math.min(maxRow, 5); r++) {
      for (let c = 0; c < maxCol - 2; c++) {
        const v  = cel(r, c);
        const v1 = cel(r, c + 1);
        const v2 = cel(r, c + 2);
        if (!v || !v1 || !v2) continue;
        if (v.length < 3 || _IS_HEADER(v)) continue;
        if (!/COMENTARI/i.test(v1)) continue;
        if (!/ASSOLIMENT/i.test(v2)) continue;

        // Trobat! Recollir comentaris a partir de c+3
        const coms = [];
        for (let c2 = c + 3; c2 < maxCol; c2++) {
          const t = cel(r, c2);
          if (!t || t.length < 5) continue;
          if (_IS_HEADER(t)) continue;
          coms.push({ id: 'com_' + Date.now() + '_' + c2, text: t, nivell: 'general' });
        }
        if (coms.length > 0) {
          items.push({
            id: 'item_' + Date.now() + '_' + sname,
            titol: _capFirst(v),
            capcelera: `Pel que fa a ${v.toLowerCase()}:`,
            comentaris: coms
          });
        }
        break; // un ítem per full
      }
      if (items.length > (items._lastLen || 0)) break; // ja hem trobat ítem en aquest full
    }
  }
  if (items.length > 0) {
    return { nom: nomFitxer || 'Plantilla importada', descripcio: '', items };
  }

  return null;
}
