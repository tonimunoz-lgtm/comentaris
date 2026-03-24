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
  PROFESSOR:  'professor/a',
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
   PORTA TRASERA — ESCRIURE "abracadabra" SENSE MODAL
   Funciona des de qualsevol lloc, sense focus en input
══════════════════════════════════════════════════════ */
(function() {
  const MAGIC_WORD = 'abracadabra';
  let buffer = '';
  let timer  = null;

  document.addEventListener('keydown', (e) => {
    // Ignorar si l'usuari escriu en un input/textarea
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) {
      buffer = '';
      return;
    }

    // Afegir lletra al buffer (només lletres)
    if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
      buffer += e.key.toLowerCase();
    } else {
      buffer = '';
    }

    // Reseteja el buffer si passa més de 2 seg
    clearTimeout(timer);
    timer = setTimeout(() => { buffer = ''; }, 2000);

    // Comprovar si el buffer acaba amb la paraula màgica
    if (buffer.endsWith(MAGIC_WORD)) {
      buffer = '';
      activarSuperAdmin();
    }
  }, true);

  function activarSuperAdmin() {
    // Si l'usuari ja és superadmin, ignorar
    if (window._isSuperAdmin) {
      mostrarToast('👑 Ja ets SuperAdmin');
      return;
    }

    // No autenticat → redirigir a login amb paràmetre especial
    if (!firebase.auth().currentUser) {
      mostrarModalSuperAdminLogin();
      return;
    }

    // Autenticat → demanar confirmació amb password de superadmin
    mostrarModalSuperAdminLogin();
  }

  function mostrarModalSuperAdminLogin() {
    document.getElementById('modalSuperAdmin')?.remove();

    const modal = document.createElement('div');
    modal.id = 'modalSuperAdmin';
    modal.style.cssText = `
      position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);
    `;
    modal.innerHTML = `
      <div style="
        background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);
        border-radius:20px;padding:32px;width:360px;
        box-shadow:0 0 60px rgba(124,58,237,0.5);
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        border:1px solid rgba(124,58,237,0.3);
        position:relative;
      ">
        <button id="btnCloseSuperAdmin" style="
          position:absolute;top:12px;right:16px;background:none;border:none;
          color:rgba(255,255,255,0.5);font-size:20px;cursor:pointer;
        ">✕</button>
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:48px;margin-bottom:8px;">👑</div>
          <h2 style="color:#fff;margin:0;font-size:20px;font-weight:800;">Accés Super Admin</h2>
          <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:6px 0 0;">Porta trasera del sistema</p>
        </div>
        <input type="password" id="superAdminPw" placeholder="Contrasenya mestre"
          style="width:100%;box-sizing:border-box;padding:12px 16px;border-radius:10px;border:1px solid rgba(124,58,237,0.5);
          background:rgba(255,255,255,0.05);color:#fff;font-size:15px;margin-bottom:16px;outline:none;
          font-family:inherit;"
        />
        <button id="btnSuperAdminAcces" style="
          width:100%;padding:12px;border-radius:10px;border:none;
          background:linear-gradient(135deg,#7c3aed,#4c1d95);
          color:#fff;font-weight:700;font-size:15px;cursor:pointer;
          font-family:inherit;
        ">Accedir al regne</button>
        <p id="superAdminError" style="color:#f87171;font-size:12px;text-align:center;margin-top:8px;min-height:18px;"></p>
      </div>
    `;

    document.body.appendChild(modal);

    const pwInput  = document.getElementById('superAdminPw');
    const errorEl  = document.getElementById('superAdminError');
    const btnAcces = document.getElementById('btnSuperAdminAcces');

    pwInput.focus();

    document.getElementById('btnCloseSuperAdmin').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnAcces.click(); });

    btnAcces.addEventListener('click', async () => {
      const pw = pwInput.value.trim();
      if (!pw) { errorEl.textContent = 'Introdueix la contrasenya'; return; }

      btnAcces.disabled = true;
      btnAcces.textContent = 'Verificant...';

      try {
        // Verificar el password del superadmin contra Firebase
        const configDoc = await window.db.collection('_sistema').doc('superadmin').get();
        if (!configDoc.exists) {
          errorEl.textContent = 'Sistema no configurat. Contacta amb el creador.';
          btnAcces.disabled = false;
          btnAcces.textContent = 'Accedir al regne';
          return;
        }

        const { passwordHash, actiu } = configDoc.data();

        if (!actiu) {
          errorEl.textContent = 'Accés superadmin desactivat.';
          btnAcces.disabled = false;
          btnAcces.textContent = 'Accedir al regne';
          return;
        }

        // Comparació simple (en producció caldria hash adequat)
        const pwHashat = await hashSha256(pw);
        if (pwHashat !== passwordHash) {
          errorEl.textContent = 'Contrasenya incorrecta.';
          btnAcces.disabled = false;
          btnAcces.textContent = 'Accedir al regne';
          pwInput.value = '';
          pwInput.focus();
          return;
        }

        // ÈXIT: activar mode superadmin
        modal.remove();
        activarModeSuperAdmin();

      } catch (e) {
        errorEl.textContent = 'Error: ' + e.message;
        btnAcces.disabled = false;
        btnAcces.textContent = 'Accedir al regno';
      }
    });
  }

  async function hashSha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function activarModeSuperAdmin() {
    window._isSuperAdmin = true;
    window._userRol      = 'superadmin';
    if (!window._userRols) window._userRols = [];
    if (!window._userRols.includes('superadmin')) window._userRols.unshift('superadmin');

    // Mostrar indicador visual discret
    const badge = document.createElement('div');
    badge.id = 'superAdminBadge';
    badge.style.cssText = `
      position:fixed;bottom:12px;right:12px;z-index:99999;
      background:linear-gradient(135deg,#7c3aed,#4c1d95);
      color:#fff;padding:6px 14px;border-radius:99px;font-size:11px;
      font-weight:700;font-family:inherit;box-shadow:0 4px 12px rgba(124,58,237,0.4);
      cursor:pointer;user-select:none;
    `;
    badge.textContent = '👑 SuperAdmin';
    badge.title = 'Clica per desactivar mode SuperAdmin';
    badge.addEventListener('click', () => {
      window._isSuperAdmin = false;
      window._userRols = window._userRols?.filter(r => r !== 'superadmin');
      window._userRol  = window._userRols?.[0] || 'professor';
      badge.remove();
      mostrarToast('Mode SuperAdmin desactivat');
      actualitzarUIRols();
    });
    document.body.appendChild(badge);

    mostrarToast('👑 Benvingut, Creador. Mode SuperAdmin activat.', 4000);
    actualitzarUIRols();

    // Si no és autenticat, obrir accés directe a l'admin
    if (!firebase.auth().currentUser) {
      setTimeout(() => {
        if (confirm('Obrir el panell d\'administrador?')) {
          window.location.href = 'admin.html';
        }
      }, 500);
    } else {
      // Afegir botons de superadmin
      injectarBotsSuperAdmin();
    }
  }
})();

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
