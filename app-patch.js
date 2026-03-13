// app-patch.js
// Patch d'integració: connecta el sistema de rols amb app.js
// S'ha de carregar DESPRÉS de app.js i DESPRÉS de rols.js
// NO modifica app.js — simplement intercepta i estén el seu comportament

console.log('🔧 app-patch.js carregat');

/* ══════════════════════════════════════════════════════
   1. INTERCEPTAR setupAfterAuth per injectar rols
══════════════════════════════════════════════════════ */
// app.js exporta setupAfterAuth com a funció local però crida auth.onAuthStateChanged
// Interceptem via onAuthStateChanged un cop l'usuari és autenticat

firebase.auth().onAuthStateChanged(async user => {
  if (!user) return;

  // Esperar que app.js hagi fet el seu setup (loadClassesScreen etc.)
  await esperarFuncions(['mostrarToast'], 5000);

  // Carregar perfil i actualitzar UI de rols
  try {
    const perfil = await window.carregarPerfilUsuari(user.uid);
    if (perfil) {
      window.actualitzarUIRols();
      await window.mostrarPasswordChangeModalSiCal(user);
    }
  } catch (e) {
    console.error('app-patch: error carregant perfil', e);
  }

  // Patchejar el botó de Professor (nou nom de l'antic btnTutoria)
  patchBotoProfesor();
});

/* ══════════════════════════════════════════════════════
   2. ESPERAR FUNCIONS GLOBALS
══════════════════════════════════════════════════════ */
function esperarFuncions(noms, timeout = 5000) {
  return new Promise(resolve => {
    const ini = Date.now();
    const check = () => {
      if (noms.every(n => typeof window[n] === 'function')) {
        resolve(true);
      } else if (Date.now() - ini > timeout) {
        resolve(false);
      } else {
        setTimeout(check, 200);
      }
    };
    check();
  });
}

/* ══════════════════════════════════════════════════════
   3. PATCH BOTÓ PROFESSOR
   app.js té un listener sobre btnTutoria; com que ara és btnProfessor
   hem d'assegurar que ultracomentator el troba i que app.js no falli
══════════════════════════════════════════════════════ */
function patchBotoProfesor() {
  // Si app.js busca btnTutoria i no el troba, no fa res
  // ultracomentator.js ja l'hem modificat per cercar btnProfessor
  // Però app.js té _setupBtnTutoria que busca 'btnTutoria' — creem un alias
  const btnProf = document.getElementById('btnProfessor');
  if (btnProf && !document.getElementById('btnTutoria')) {
    // Crear element fantasma perquè l'antic codi no falli
    const ghost = document.createElement('button');
    ghost.id = 'btnTutoria';
    ghost.style.display = 'none';
    ghost.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ghost);

    // Redirigir clics del ghost al btnProfessorMain (creat per ultracomentator.js)
    ghost.addEventListener('click', () => {
      document.getElementById('btnProfessorMain')?.click();
    });
  }
}

/* ══════════════════════════════════════════════════════
   4. ACTUALITZARUIROLS — estén la funció de rols.js per
      cridar els injectadors específics
══════════════════════════════════════════════════════ */
const _origActualitzarUIRols = window.actualitzarUIRols;
window.actualitzarUIRols = function() {
  if (_origActualitzarUIRols) _origActualitzarUIRols();

  // Injectar botons específics de cada mòdul
  const rols = window._userRols || [];

  // Botó Admin ja el gestiona app.js (adminNavBtn)
  // Botó Secretaria
  if (rols.some(r => ['secretaria','admin','superadmin'].includes(r))) {
    window.injectarBotoSecretaria?.();
  }

  // Botó Tutoria (nou, per a tutors i admins)
  if (rols.some(r => ['tutor','admin','superadmin'].includes(r))) {
    window.injectarBotoTutoria?.();
  }

  // Botó Revisió
  if (rols.some(r => ['revisor','admin','superadmin'].includes(r))) {
    window.injectarBotoRevisor?.();
  }

  // Ocultar/mostrar botó Professor (ultracomentator) si no és professor ni admin
  setTimeout(() => {
    const btnProf = document.getElementById('btnProfessorMain') ||
                    document.getElementById('btnProfessor');
    if (btnProf) {
      const potVeureProfessor = rols.some(r =>
        ['professor','tutor','secretaria','admin','superadmin'].includes(r)
      );
      btnProf.style.display = potVeureProfessor ? '' : 'none';
    }
  }, 800);
};

/* ══════════════════════════════════════════════════════
   5. MODALPASSWORD — wrapper per cridar-lo si cal
══════════════════════════════════════════════════════ */
window.mostrarPasswordChangeModalSiCal = async function(user) {
  if (sessionStorage.getItem('pwChangeDone')) return;
  try {
    const doc = await window.db.collection('professors').doc(user.uid).get();
    if (doc.exists && doc.data().forcePasswordChange) {
      setTimeout(() => window.mostrarModalCambioPassword?.(), 1500);
    }
  } catch (e) {}
};

/* ══════════════════════════════════════════════════════
   6. CREAR COL·LECCIONS CENTRE SI NO EXISTEIXEN
   Primera vegada que un admin entra, crea les col·leccions
   amb documents de configuració base
══════════════════════════════════════════════════════ */
async function inicialitzarColeccionsBase() {
  if (!window.db || !firebase.auth().currentUser) return;

  const rols = window._userRols || [];
  if (!rols.some(r => ['admin','superadmin','secretaria'].includes(r))) return;

  try {
    // Verificar si ja existeix configuració
    const cfgDoc = await window.db.collection('_sistema').doc('config').get();
    if (cfgDoc.exists) return; // Ja inicialitzat

    // Crear doc de configuració
    await window.db.collection('_sistema').doc('config').set({
      inicialitzat: true,
      versio: '1.0',
      centre: 'INS Matadepera',
      creatAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Crear el doc de superadmin (password hash buit — l'admin haurà de configurar-lo)
    const cfgSuperAdmin = await window.db.collection('_sistema').doc('superadmin').get();
    if (!cfgSuperAdmin.exists) {
      await window.db.collection('_sistema').doc('superadmin').set({
        passwordHash: '',
        nota: 'Configura el hash SHA-256 de la contrasenya mestra des de la consola Firebase'
      });
    }

    console.log('✅ Col·leccions base inicialitzades');
  } catch (e) {
    // Normal si no hi ha permisos d'escriptura — no és crític
    console.warn('app-patch: no s\'han pogut inicialitzar col·leccions base:', e.message);
  }
}

// Cridar inicialització quan el perfil estigui carregat
const _origCarregarPerfil = window.carregarPerfilUsuari;
window.carregarPerfilUsuari = async function(uid) {
  const result = await _origCarregarPerfil(uid);
  if (result) {
    setTimeout(inicialitzarColeccionsBase, 2000);
  }
  return result;
};

/* ══════════════════════════════════════════════════════
   7. FIX QUERY ALUMNES — eliminar orderBy que necessita índex
   avaluacio-centre.js fa .where('classId').orderBy('nom')
   Patchegem per ordenar en memòria i evitar l'índex compost
══════════════════════════════════════════════════════ */
// El fix real és a la query de avaluacio-centre.js — s'ha eliminat el orderBy
// (no cal patchejar aquí ja que el fitxer generat no usa orderBy)

console.log('✅ app-patch.js: integració completada');
