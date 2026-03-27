// rols.js — Sistema de rols i permisos per UltraComentator
// Rols: superadmin > admin > secretaria > pedagog > tutor > professor > revisor
// Porta trasera: escriure "abracadabra" des de qualsevol lloc → accés superadmin

console.log('🔐 rols.js carregat');

/* ══════════════════════════════════════════════════════
   CONSTANTS DE ROLS
══════════════════════════════════════════════════════ */
window.ROLS = {
  SUPERADMIN: 'superadmin',
  ADMIN:      'admin',
  SECRETARIA: 'secretaria',
  TUTOR:      'tutor',
  PEDAGOG:    'pedagog',
  PROFESSOR:  'professor',
  REVISOR:    'revisor'
};

// Jerarquia: cada rol inclou els permisos dels inferiors
const ROL_JERARQUIA = [
  'superadmin', 'admin', 'secretaria', 'pedagog', 'tutor', 'professor', 'revisor'
];

// Perfil de l'usuari actual
window._userRol       = null;   // rol principal
window._userRols      = [];     // tots els rols (pot tenir múltiples)
window._isSuperAdmin  = false;  // flag especial superadmin
window._userProfile   = null;   // document complet de professors

/* ══════════════════════════════════════════════════════
   CÀRREGA DEL PERFIL D'USUARI
══════════════════════════════════════════════════════ */
async function carregarPerfilUsuari(uid) {
  try {
    const doc = await window.db.collection('professors').doc(uid).get();
    if (!doc.exists) return null;
    const data = doc.data();

    // Rols: pot ser un string (llegat) o un array
    let rols = data.rols || [];
    if (typeof rols === 'string') rols = [rols];

    // Compatibilitat amb el camp isAdmin antic
    if (data.isAdmin && !rols.includes('admin')) rols.push('admin');

    // Rol principal (el més alt de la jerarquia)
    const rolPrincipal = ROL_JERARQUIA.find(r => rols.includes(r)) || 'professor';

    window._userRol     = rolPrincipal;
    window._userRols    = rols;
    window._userProfile = { ...data, uid };

    console.log(`🔐 Rol carregat: ${rolPrincipal}`, rols);
    return { rol: rolPrincipal, rols, data };
  } catch (e) {
    console.error('Error carregant perfil:', e);
    return null;
  }
}

/* ══════════════════════════════════════════════════════
   COMPROVACIONS DE PERMISOS
══════════════════════════════════════════════════════ */
window.teRol = function(rolRequerit) {
  if (window._isSuperAdmin) return true;
  if (!window._userRols?.length) return false;

  const idxRequerit = ROL_JERARQUIA.indexOf(rolRequerit);
  return window._userRols.some(r => {
    const idx = ROL_JERARQUIA.indexOf(r);
    return idx !== -1 && idx <= idxRequerit;
  });
};

window.esAdmin     = () => window.teRol('admin');
window.esSecretaria= () => window.teRol('secretaria');
window.esTutor     = () => window.teRol('tutor');
window.esPedagog   = () => window.teRol('pedagog');
window.esProfessor = () => true; // tots poden ser professors
window.esRevisor   = () => window._userRols?.includes('revisor');

/* ══════════════════════════════════════════════════════
   ACTUALITZAR UI SEGONS ROLS
══════════════════════════════════════════════════════ */
function actualitzarUIRols() {
  // Botons de navegació al sidebar
  const nav = document.querySelector('.sidebar-nav');
  if (!nav) return;

  // Eliminar botons anteriors injectats per rols
  nav.querySelectorAll('.nav-item-rol').forEach(b => b.remove());

  // Botó Admin (si és admin o superior)
  if (window.teRol('admin') && !document.getElementById('adminNavBtn')) {
    const adminBtn = document.createElement('button');
    adminBtn.id = 'adminNavBtn';
    adminBtn.className = 'nav-item nav-item-rol';
    adminBtn.innerHTML = '<span class="nav-icon">⚙️</span><span>Administrar</span>';
    adminBtn.addEventListener('click', () => { window.location.href = 'admin.html'; });
    nav.appendChild(adminBtn);
  }

  // Botó Secretaria — injectat per secretaria.js via injectarBotoSecretaria() (cridat des d'app-patch.js)
  // NO creem aquí el botó per evitar duplicats.


  // Botó Tutoria — injectat per tutoria-nova.js via injectarBotoTutoria() (cridat des d'app-patch.js)
  // NO creem aquí el botó per evitar duplicats.

  // Botó Revisor — injectat per revisor.js via injectarBotoRevisor() (cridat des d'app-patch.js)
  // NO creem aquí el botó per evitar duplicats. revisor.js usa id="btnRevisorSidebar"
  // i crida obrirPanellRevisio() que és la funció correcta amb suport de nivells/grups.
}

/* ══════════════════════════════════════════════════════
   INJECTAR BOTONS SUPERADMIN
══════════════════════════════════════════════════════ */
function injectarBotsSuperAdmin() {
  actualitzarUIRols();

  // Botó superadmin directe
  const nav = document.querySelector('.sidebar-nav');
  if (nav && !document.getElementById('superAdminNavBtn')) {
    const btn = document.createElement('button');
    btn.id = 'superAdminNavBtn';
    btn.className = 'nav-item nav-item-rol';
    btn.style.cssText = 'background:linear-gradient(135deg,rgba(124,58,237,0.2),rgba(76,29,149,0.2));';
    btn.innerHTML = '<span class="nav-icon">👑</span><span>Super Admin</span>';
    btn.addEventListener('click', () => {
      window.location.href = 'admin.html?superadmin=1';
    });
    nav.appendChild(btn);
  }
}

/* ══════════════════════════════════════════════════════
   TOAST HELPER
══════════════════════════════════════════════════════ */
window.mostrarToast = function(msg, durada = 3000) {
  const old = document.getElementById('ultraToast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.id = 'ultraToast';
  toast.style.cssText = `
    position:fixed;bottom:60px;left:50%;transform:translateX(-50%);
    background:#1e1b4b;color:#fff;padding:10px 20px;border-radius:99px;
    font-size:13px;font-weight:600;z-index:999998;
    box-shadow:0 4px 16px rgba(0,0,0,0.3);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    animation:fadeInUp .2s ease;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), durada);
};

/* ══════════════════════════════════════════════════════
   INICIALITZACIÓ — Esperar auth
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Amagar el nav fins que els rols estiguin carregats
  const nav = document.querySelector('.sidebar-nav');
  if (nav) nav.style.visibility = 'hidden';

  // Esperar que Firebase estigui disponible
  const waitForFirebase = setInterval(() => {
    if (!window.firebase || !window.db) return;
    clearInterval(waitForFirebase);

    firebase.auth().onAuthStateChanged(async user => {
      if (!user) {
        window._userRol  = null;
        window._userRols = [];
        // visibilitat gestionada per app-patch.js
        return;
      }

      const perfil = await carregarPerfilUsuari(user.uid);
      if (perfil) {
        // Comprovar si cal canviar contrasenya (primer accés)
        if (perfil.data?.forcePasswordChange && !sessionStorage.getItem('pwChangeDone')) {
          mostrarModalCambioPassword();
        }
        // Sense setTimeout: els rols ja estan carregats aquí
        actualitzarUIRols();
        // visibilitat gestionada per app-patch.js
      }
    });
  }, 200);
});

/* ══════════════════════════════════════════════════════
   MODAL CANVI DE CONTRASENYA (primer accés)
══════════════════════════════════════════════════════ */
function mostrarModalCambioPassword() {
  document.getElementById('modalCambioPassword')?.remove();

  const modal = document.createElement('div');
  modal.id = 'modalCambioPassword';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);
  `;
  modal.innerHTML = `
    <div style="
      background:#fff;border-radius:20px;padding:32px;width:400px;
      box-shadow:0 24px 60px rgba(0,0,0,0.3);
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    ">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:40px;margin-bottom:8px;">🔑</div>
        <h2 style="font-size:20px;font-weight:800;color:#1e1b4b;margin:0;">Canvia la teva contrasenya</h2>
        <p style="color:#6b7280;font-size:13px;margin:6px 0 0;">
          Per seguretat, has de canviar la contrasenya inicial.
        </p>
      </div>
      <input type="password" id="nouPw1" placeholder="Nova contrasenya" style="
        width:100%;box-sizing:border-box;padding:12px;border:1px solid #e5e7eb;
        border-radius:10px;font-size:14px;margin-bottom:10px;font-family:inherit;outline:none;
      "/>
      <input type="password" id="nouPw2" placeholder="Repeteix la nova contrasenya" style="
        width:100%;box-sizing:border-box;padding:12px;border:1px solid #e5e7eb;
        border-radius:10px;font-size:14px;margin-bottom:16px;font-family:inherit;outline:none;
      "/>
      <p id="pwError" style="color:#ef4444;font-size:12px;min-height:16px;margin:0 0 12px;"></p>
      <button id="btnGuardarNouPw" style="
        width:100%;padding:12px;border-radius:10px;border:none;
        background:#4c1d95;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;
      ">Guardar nova contrasenya</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btnGuardarNouPw').addEventListener('click', async () => {
    const pw1 = document.getElementById('nouPw1').value;
    const pw2 = document.getElementById('nouPw2').value;
    const errEl = document.getElementById('pwError');

    if (!pw1 || !pw2) { errEl.textContent = 'Omple tots els camps'; return; }
    if (pw1.length < 6) { errEl.textContent = 'Mínim 6 caràcters'; return; }
    if (pw1 !== pw2) { errEl.textContent = 'Les contrasenyes no coincideixen'; return; }

    try {
      await firebase.auth().currentUser.updatePassword(pw1);
      await window.db.collection('professors').doc(firebase.auth().currentUser.uid).update({
        forcePasswordChange: false
      });
      sessionStorage.setItem('pwChangeDone', '1');
      modal.remove();
      window.mostrarToast('✅ Contrasenya canviada correctament');
    } catch (e) {
      errEl.textContent = 'Error: ' + e.message;
    }
  });
}

/* ══════════════════════════════════════════════════════
   EXPORTAR
══════════════════════════════════════════════════════ */
window.carregarPerfilUsuari       = carregarPerfilUsuari;
window.actualitzarUIRols           = actualitzarUIRols;
window.mostrarModalCambioPassword  = mostrarModalCambioPassword;

console.log('✅ rols.js: sistema de rols inicialitzat');
