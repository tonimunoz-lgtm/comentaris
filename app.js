// app.js — ComentaIA: Gestor de Comentaris
// Firebase: comentaris-1028e

/* ─── FIREBASE CONFIG ─── */
const firebaseConfig = {
  apiKey: "AIzaSyCmvYTICbPClYb1Ttk-OJYuNjIT52k3R1M",
  authDomain: "comentaris-1028e.firebaseapp.com",
  projectId: "comentaris-1028e",
  storageBucket: "comentaris-1028e.firebasestorage.app",
  messagingSenderId: "626077398455",
  appId: "1:626077398455:web:8eb557ea7793e6d9f5a432"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// Expose globals per als altres mòduls
window.firebase = firebase;
window.db       = db;
window.auth     = auth;

/* ─── GLOBALS ─── */
let professorUID   = null;
let currentClassId = null;
let classStudents  = [];
let deleteStudentsMode = false;
let deleteClassMode    = false;
let currentCommentStudent = null; // { id, nom }
let currentPeriodeId = null;      // periode actiu
let currentPeriodes  = {};        // { periodeId: { nom, ordre } }

window.currentClassId = null;

// Exportar variables de períodes per a app-patch.js
Object.defineProperty(window, 'currentPeriodes', {
  get: () => currentPeriodes,
  set: v  => { currentPeriodes = v; },
  configurable: true
});
Object.defineProperty(window, 'currentPeriodeId', {
  get: () => currentPeriodeId,
  set: v  => { currentPeriodeId = v; window._tcClassId = v; },
  configurable: true
});

/* ─── DOM REFS ─── */
const loginScreen  = document.getElementById('loginScreen');
const appRoot      = document.getElementById('appRoot');
const screenClasses = document.getElementById('screen-classes');
const screenClass   = document.getElementById('screen-class');
const classesGrid   = document.getElementById('classesGrid');
const studentsList  = document.getElementById('studentsList');
const studentsCount = document.getElementById('studentsCount');

/* ══════════════════════════════════════
   Dominis PErmesos
══════════════════════════════════════ */
const allowedDomains = ['institutmatadepera.cat']; // afegeix més dominis si cal

function isDomainAllowed(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  return allowedDomains.includes(domain);
}

/* ══════════════════════════════════════
   UTILS
══════════════════════════════════════ */
function showLogin() {
  loginScreen.classList.remove('hidden');
  loginScreen.style.display = 'flex';
  appRoot.classList.add('hidden');
}

function showApp() {
  loginScreen.classList.add('hidden');
  loginScreen.style.display = 'none';
  appRoot.classList.remove('hidden');
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('hidden'); }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('hidden'); }
}

window.openModal  = openModal;
window.closeModal = closeModal;

// Close modals on backdrop click / close buttons
document.addEventListener('click', e => {
  // Modal close buttons
  const closeBtn = e.target.closest('[data-modal-close]');
  if (closeBtn) { closeModal(closeBtn.dataset.modalClose); return; }

  // Click outside modal box
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
  }

  // Close all dropdowns on outside click
  if (!e.target.closest('.relative')) {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.add('hidden'));
    document.querySelectorAll('.card-menu-dropdown').forEach(m => m.classList.add('hidden'));
  }
});

function confirmAction(title, msg, cb) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent   = msg;
  openModal('modalConfirm');
  const btn = document.getElementById('confirmYes');
  const clone = btn.cloneNode(true);
  btn.parentNode.replaceChild(clone, btn);
  clone.addEventListener('click', () => { closeModal('modalConfirm'); cb(); });
}
window.confirmAction = confirmAction;

/* ══════════════════════════════════════
   MODAL ACCEPTACIÓ CONDICIONS D'ÚS
══════════════════════════════════════ */
function mostrarModalTermes(onAccept) {
  const old = document.getElementById('modalTermes');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'modalTermes';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);padding:20px;
  `;
  modal.innerHTML = `
    <div style="
      background:#fff;border-radius:20px;width:min(580px,95vw);max-height:90vh;
      display:flex;flex-direction:column;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      box-shadow:0 24px 80px rgba(0,0,0,0.3);
    ">
      <!-- Capçalera fixa -->
      <div style="background:linear-gradient(135deg,#1e1b4b,#4c1d95);padding:22px 28px;color:#fff;border-radius:20px 20px 0 0;flex-shrink:0;">
        <div style="font-size:11px;opacity:.7;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">⚡ Ultracomentator</div>
        <h2 style="margin:0;font-size:19px;font-weight:800;">Condicions d'ús i avís legal</h2>
        <p style="margin:6px 0 0;font-size:12px;opacity:.8;">Has de llegir i acceptar les condicions per crear un compte.</p>
      </div>

      <!-- Text lliscable — cal arribar al final per activar el botó -->
      <div id="termesScroll" style="flex:1;overflow-y:auto;padding:24px 28px;font-size:13px;color:#374151;line-height:1.8;display:flex;flex-direction:column;gap:14px;max-height:55vh;">

        <div>
          <strong style="color:#1a1a2e;font-size:14px;">1. Programari lliure i gratuït</strong><br>
          Ultracomentator és una aplicació de programari lliure distribuïda gratuïtament per a ús educatiu. Qualsevol docent o centre educatiu pot usar-la, copiar-la i adaptar-la sense restriccions comercials.
        </div>

        <div>
          <strong style="color:#1a1a2e;font-size:14px;">2. Responsabilitat sobre les dades introduïdes</strong><br>
          Cada usuari és l'únic i exclusiu responsable de tota la informació que introdueixi a l'aplicació, incloent noms d'alumnes, comentaris i qualsevol altra dada personal. El propietari (Institut Matadepera) i el desenvolupador (Toni Muñoz) <strong>no assumeixen cap responsabilitat</strong> pel contingut introduït pels usuaris ni per l'ús que en facin.
        </div>

        <div>
          <strong style="color:#1a1a2e;font-size:14px;">3. Dades de menors d'edat · RGPD (UE 2016/679)</strong><br>
          Aquesta aplicació pot utilitzar-se per emmagatzemar dades personals de menors d'edat. En crear un compte, l'usuari declara i accepta expressament que:
          <ul style="margin:8px 0 0 16px;display:flex;flex-direction:column;gap:4px;">
            <li>És responsable del tractament d'aquestes dades d'acord amb el RGPD i la normativa aplicable.</li>
            <li>Disposa de les autoritzacions necessàries del centre educatiu per tractar les dades dels alumnes.</li>
            <li>No emmagatzemarà informació sensible innecessària.</li>
            <li>Aplicarà les mesures de seguretat adequades per protegir les dades dels menors.</li>
          </ul>
        </div>

        <div>
          <strong style="color:#1a1a2e;font-size:14px;">4. Absència de garanties</strong><br>
          L'aplicació es proporciona "tal com és" (<em>as is</em>), sense garanties de cap tipus quant a disponibilitat, continuïtat o absència d'errors. El desenvolupador no es fa responsable de pèrdues de dades, interrupcions del servei ni danys de cap tipus derivats de l'ús de l'aplicació.
        </div>

        <div>
          <strong style="color:#1a1a2e;font-size:14px;">5. Infraestructura de tercers</strong><br>
          Les dades s'emmagatzemen a Google Firebase (Firestore). En usar aquesta aplicació, l'usuari accepta les condicions de servei de Google Cloud Platform. El propietari i el desenvolupador no controlen ni són responsables de la infraestructura de Google.
        </div>

        <div style="background:#fef3c7;border-radius:10px;padding:12px 14px;border-left:3px solid #f59e0b;">
          <strong style="color:#92400e;">⚠️ Important</strong><br>
          <span style="color:#78350f;">En crear un compte acceptes ser l'únic responsable de les dades que introdueixis, especialment les dades personals dels alumnes. Ni l'Institut Matadepera ni Toni Muñoz no podran ser considerats responsables del tractament incorrecte de dades per part teva.</span>
        </div>

        <!-- Sentinella per detectar scroll final -->
        <div id="termesBottom" style="height:1px;"></div>
      </div>

      <!-- Peu fix -->
      <div style="padding:16px 28px;border-top:1px solid #e5e7eb;flex-shrink:0;background:#f9fafb;border-radius:0 0 20px 20px;">
        <div id="termesScrollMsg" style="font-size:12px;color:#9ca3af;text-align:center;margin-bottom:10px;">
          📜 Desplaça't fins al final per poder acceptar
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="termesCancel" style="background:#f3f4f6;color:#374151;border:none;border-radius:8px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">Cancel·lar</button>
          <button id="termesAccept" disabled style="background:#e5e7eb;color:#9ca3af;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:not-allowed;font-family:inherit;transition:all .2s;">✓ Accepto les condicions</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Detectar quan s'arriba al final del scroll
  const scrollEl = document.getElementById('termesScroll');
  const acceptBtn = document.getElementById('termesAccept');
  const scrollMsg = document.getElementById('termesScrollMsg');

  function checkScroll() {
    const arribaFinal = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 10;
    if (arribaFinal) {
      acceptBtn.disabled = false;
      acceptBtn.style.background = '#4c1d95';
      acceptBtn.style.color = '#fff';
      acceptBtn.style.cursor = 'pointer';
      scrollMsg.textContent = '✅ Has llegit les condicions. Ara pots acceptar.';
      scrollMsg.style.color = '#059669';
    }
  }
  scrollEl.addEventListener('scroll', checkScroll);

  document.getElementById('termesCancel').addEventListener('click', () => modal.remove());
  acceptBtn.addEventListener('click', () => {
    if (acceptBtn.disabled) return;
    modal.remove();
    onAccept();
  });
}


document.getElementById('btnLogin').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const pw    = document.getElementById('loginPassword').value;
  if (!email || !pw) return alert('Introdueix email i contrasenya');
  try {
    const u = await auth.signInWithEmailAndPassword(email, pw);
    const userDoc = await db.collection('professors').doc(u.user.uid).get();
    if (!userDoc.exists) { await auth.signOut(); return alert("⚠️ Usuari no trobat. Contacta amb l'administrador."); }
    if (userDoc.data().deleted)   { await auth.signOut(); return alert("⚠️ El teu compte ha estat eliminat."); }
    if (userDoc.data().suspended) { await auth.signOut(); return alert("⚠️ El teu compte està suspès. Contacta amb l'administrador."); }
    professorUID = u.user.uid;
    setupAfterAuth(u.user);
  } catch (e) {
    alert('Error: ' + e.message);
  }
});

async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    const profRef = db.collection('professors').doc(user.uid);
    const docSnap = await profRef.get();

    if (!docSnap.exists) {

    // ✅ Afegit: només permet domini autoritzat
  if (!isDomainAllowed(user.email)) {
    await auth.signOut();
    return alert("Només es permet l'accés amb correu @institutmatadepera.cat");
  }
      
      // Usuari nou — cal acceptar les condicions primer
      mostrarModalTermes(async () => {
        try {
          await profRef.set({
            email: user.email,
            nom: user.displayName || user.email.split('@')[0],
            rols: [],          // sense rol fins que secretaria l'assigni
            google: true,
            isAdmin: false,
            suspended: false,
            deleted: false,
            classes: [],
            termsAcceptedAt: firebase.firestore.Timestamp.now(),
            createdAt: firebase.firestore.Timestamp.now()
          });
          professorUID = user.uid;
          setupAfterAuth(user);
        } catch (err) {
          await auth.signOut();
          alert("Error creant el compte: " + err.message);
        }
      });
      return;
    }

    // Usuari existent — login normal
    const d = docSnap.data();
    if (d.deleted)   { await auth.signOut(); return alert("⚠️ Compte eliminat."); }
    if (d.suspended) { await auth.signOut(); return alert("⚠️ Compte suspès. Contacta l'administrador."); }
    professorUID = user.uid;
    setupAfterAuth(user);
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      alert("Error amb Google: " + err.message);
    }
  }
}
document.getElementById('googleLoginBtn').addEventListener('click', signInWithGoogle);

document.getElementById('btnRegister').addEventListener('click', () => {
  const email = document.getElementById('loginEmail').value.trim();
  const pw    = document.getElementById('loginPassword').value;
  if (!email || !pw) return alert('Introdueix email i contrasenya');

  // ✅ Afegit: comprovació de domini
  if (!isDomainAllowed(email)) {
  return alert('Només els usuaris amb correu @institutmatadepera.cat poden registrar-se.');
  } 
 
  mostrarModalTermes(async () => {
    try {
      const u = await auth.createUserWithEmailAndPassword(email, pw);
      professorUID = u.user.uid;
      await db.collection('professors').doc(professorUID).set({
        email,
        nom: email.split('@')[0],
        rols: [],          // sense rol fins que secretaria l'assigni
        isAdmin: false,
        suspended: false,
        deleted: false,
        classes: [],
        termsAcceptedAt: firebase.firestore.Timestamp.now(),
        createdAt: firebase.firestore.Timestamp.now()
      });
      setupAfterAuth(u.user);
      alert("Compte creat! Contacta amb la secretaria perquè activin el teu accés.");
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') alert("Email ja registrat.");
      else if (e.code === 'auth/weak-password') alert("Contrasenya massa dèbil (mínim 6 caràcters).");
      else alert('Error: ' + e.message);
    }
  });
});

document.getElementById('btnRecover').addEventListener('click', () => {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) return alert('Introdueix el teu email');
  auth.sendPasswordResetEmail(email)
    .then(() => alert('Email de recuperació enviat!'))
    .catch(e => alert('Error: ' + e.message));
});

document.getElementById('btnLogout').addEventListener('click', () => {
  auth.signOut().then(() => {
    professorUID = null;
    currentClassId = null;
    showLogin();
  });
});

document.getElementById('changePasswordBtn').addEventListener('click', () => {
  const email = auth.currentUser?.email;
  if (!email) return;
  auth.sendPasswordResetEmail(email)
    .then(() => alert('Email de canvi de contrasenya enviat a ' + email))
    .catch(e => alert('Error: ' + e.message));
});

auth.onAuthStateChanged(user => {
  if (user) {
    professorUID = user.uid;
    // Registrar login
    db.collection('professors').doc(user.uid).collection('logins')
      .add({ timestamp: firebase.firestore.Timestamp.now() })
      .catch(() => {});
    setupAfterAuth(user);
  } else {
    professorUID = null;
    showLogin();
  }
});

async function setupAfterAuth(user) {
  showApp();

  // Avatar + nom
  const name = user.displayName || user.email || '';
  document.getElementById('usuariNom').textContent = name.split('@')[0] || name;
  document.getElementById('userAvatar').textContent = (name[0] || '?').toUpperCase();

  // Admin check
  const userDoc = await db.collection('professors').doc(user.uid).get();
  if (userDoc.exists && userDoc.data().isAdmin) {
    if (!document.getElementById('adminNavBtn')) {
      const adminBtn = document.createElement('button');
      adminBtn.id = 'adminNavBtn';
      adminBtn.className = 'nav-item';
      adminBtn.innerHTML = '<span class="nav-icon">⚙️</span><span>Administrar</span>';
      adminBtn.addEventListener('click', () => { window.location.href = 'admin.html'; });
      document.querySelector('.sidebar-nav').appendChild(adminBtn);
    }
  }

  loadClassesScreen();
}

/* ══════════════════════════════════════
   SIDEBAR MOBILE
══════════════════════════════════════ */
document.getElementById('btnMobileMenu').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('mobile-open');
  document.getElementById('mobileSidebarOverlay').classList.remove('hidden');
});

document.getElementById('mobileSidebarOverlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('mobileSidebarOverlay').classList.add('hidden');
});

/* ══════════════════════════════════════
   CLASSES SCREEN
══════════════════════════════════════ */
document.getElementById('btnCreateClass').addEventListener('click', () => openModal('modalCreateClass'));

document.getElementById('btnDeleteMode').addEventListener('click', () => {
  deleteClassMode = !deleteClassMode;
  document.getElementById('btnDeleteMode').textContent = deleteClassMode ? '❌' : '🗑️';
  loadClassesScreen();
});

document.getElementById('modalCreateClassBtn').addEventListener('click', async () => {
  const name = document.getElementById('modalClassName').value.trim();
  if (!name) return alert('Posa un nom al grup');
  const ref = db.collection('classes').doc();
  await ref.set({ nom: name, alumnes: [], ownerUid: professorUID });
  await db.collection('professors').doc(professorUID).update({
    classes: firebase.firestore.FieldValue.arrayUnion(ref.id)
  });
  closeModal('modalCreateClass');
  document.getElementById('modalClassName').value = '';
  loadClassesScreen();
});

function loadClassesScreen() {
  if (!professorUID) return;
  screenClass.classList.add('hidden');
  screenClasses.classList.remove('hidden');
  document.getElementById('btnMobileBack').classList.add('hidden');
  document.getElementById('btnMobileStudents').classList.add('hidden');
  classesGrid.innerHTML = '<div class="text-sm text-gray-400 col-span-full p-4">Carregant...</div>';

  db.collection('professors').doc(professorUID).get().then(doc => {
    if (!doc.exists) { classesGrid.innerHTML = '<div class="text-sm text-red-400">Professor no trobat</div>'; return; }
    const ids = doc.data().classes || [];
    if (ids.length === 0) {
      classesGrid.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-16 text-center">
          <div style="font-size:48px;margin-bottom:16px;">🏫</div>
          <h3 style="font-size:18px;font-weight:700;color:var(--ink);margin-bottom:8px;">Cap grup creat</h3>
          <p style="color:var(--ink-40);font-size:14px;margin-bottom:20px;">Crea el teu primer grup per començar a gestionar comentaris</p>
        </div>`;
      return;
    }

    Promise.all(ids.map(id => db.collection('classes').doc(id).get())).then(docs => {
      renderSidebarClasses(ids, docs);
      classesGrid.innerHTML = '';
      docs.forEach(d => {
        if (!d.exists) return;
        const data = d.data();
        const alumnes = data.alumnes || [];

        const card = document.createElement('div');
        card.className = 'class-card';
        card.dataset.id = d.id;
        card.innerHTML = `
          ${deleteClassMode ? '<input type="checkbox" class="delete-checkbox absolute top-14 left-4 z-10">' : ''}
          <div class="class-card-menu">
            ${!deleteClassMode ? `
              <button class="btn-icon card-menu-btn" style="color:var(--ink-40)">⋮</button>
              <div class="card-menu-dropdown hidden">
                <button class="card-edit-btn">✏️ Editar nom</button>
                <button class="card-delete-btn" style="color:#ef4444">🗑️ Eliminar grup</button>
              </div>
            ` : ''}
          </div>
          <h3>${data.nom || 'Sense nom'}</h3>
          <div class="class-card-meta">
            <span class="meta-badge">👥 ${alumnes.length} alumnes</span>
          </div>
        `;

        if (!deleteClassMode) {
          // Toggle menu
          const menuBtn = card.querySelector('.card-menu-btn');
          const menuDrop = card.querySelector('.card-menu-dropdown');
          menuBtn?.addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('.card-menu-dropdown').forEach(m => {
              if (m !== menuDrop) m.classList.add('hidden');
            });
            menuDrop.classList.toggle('hidden');
          });

          // Edit
          card.querySelector('.card-edit-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            const newName = prompt('Nou nom del grup:', data.nom || '');
            if (!newName || newName.trim() === data.nom) return;
            db.collection('classes').doc(d.id).update({ nom: newName.trim() }).then(() => loadClassesScreen());
          });

          // Delete
          card.querySelector('.card-delete-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            confirmAction('Eliminar grup', `Vols eliminar "${data.nom}"? Tots els alumnes i comentaris s'esborraran.`, async () => {
              await db.collection('professors').doc(professorUID).update({
                classes: firebase.firestore.FieldValue.arrayRemove(d.id)
              });
              // Esborrar alumnes i classe
              const batch = db.batch();
              alumnes.forEach(aid => batch.delete(db.collection('alumnes').doc(aid)));
              batch.delete(db.collection('classes').doc(d.id));
              await batch.commit();
              loadClassesScreen();
            });
          });

          card.addEventListener('click', e => {
            if (e.target.closest('.class-card-menu')) return;
            openClass(d.id);
          });
        }

        classesGrid.appendChild(card);
      });

      if (deleteClassMode) {
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-danger col-span-full mt-2';
        delBtn.textContent = 'Eliminar seleccionats';
        delBtn.onclick = confirmDeleteSelectedClasses;
        classesGrid.appendChild(delBtn);
      }
    });
  }).catch(e => {
    classesGrid.innerHTML = '<div class="text-sm text-red-400">Error carregant</div>';
    console.error(e);
  });
}

async function confirmDeleteSelectedClasses() {
  const checks = [...document.querySelectorAll('.delete-checkbox')].filter(c => c.checked);
  if (!checks.length) return alert('Selecciona almenys un grup');
  const cards = checks.map(c => c.closest('.class-card'));
  confirmAction('Eliminar grups', `Eliminar ${cards.length} grup(s)? No es pot desfer.`, async () => {
    for (const card of cards) {
      const id = card.dataset.id;
      const doc = await db.collection('classes').doc(id).get();
      const alumnes = doc.data()?.alumnes || [];
      const batch = db.batch();
      alumnes.forEach(aid => batch.delete(db.collection('alumnes').doc(aid)));
      batch.delete(db.collection('classes').doc(id));
      await batch.commit();
      await db.collection('professors').doc(professorUID).update({
        classes: firebase.firestore.FieldValue.arrayRemove(id)
      });
    }
    deleteClassMode = false;
    document.getElementById('btnDeleteMode').textContent = '🗑️';
    loadClassesScreen();
  });
}

/* ══════════════════════════════════════
   CLASS VIEW
══════════════════════════════════════ */
function openClass(id) {
  currentClassId = id;
  window.currentClassId = id;
  currentPeriodeId = null;
  screenClasses.classList.add('hidden');
  screenClass.classList.remove('hidden');
  document.getElementById('btnMobileBack').classList.remove('hidden');
  document.getElementById('btnMobileStudents').classList.remove('hidden');
  // Marcar actiu al sidebar
  document.querySelectorAll('.sidebar-class-item').forEach(b => {
    b.classList.toggle('active', b.dataset.classId === id);
  });
  loadClassData();
}

document.getElementById('btnBack').addEventListener('click', () => {
  currentClassId = null;
  window.currentClassId = null;
  currentPeriodeId = null;
  screenClass.classList.add('hidden');
  screenClasses.classList.remove('hidden');
  document.getElementById('btnMobileBack').classList.add('hidden');
  document.getElementById('btnMobileStudents').classList.add('hidden');
  document.querySelectorAll('.sidebar-class-item').forEach(b => b.classList.remove('active'));
  loadClassesScreen();
});

document.getElementById('btnMobileBack').addEventListener('click', () => {
  document.getElementById('btnBack').click();
});

document.getElementById('btnMobileStudents').addEventListener('click', () => {
  document.getElementById('studentsPanel').classList.add('mobile-open');
  document.getElementById('mobileSidebarOverlay').classList.remove('hidden');
});

document.getElementById('closeMobileStudents').addEventListener('click', () => {
  document.getElementById('studentsPanel').classList.remove('mobile-open');
  document.getElementById('mobileSidebarOverlay').classList.add('hidden');
});

// Also close students panel on overlay click
document.getElementById('mobileSidebarOverlay').addEventListener('click', () => {
  document.getElementById('studentsPanel').classList.remove('mobile-open');
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('mobileSidebarOverlay').classList.add('hidden');
});

function renderSidebarClasses(ids, docs) {
  const container = document.getElementById('sidebarClassesList');
  if (!container) return;
  container.innerHTML = '';
  if (!ids || !ids.length) {
    container.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,0.2);padding:4px 12px;">Cap grup creat</div>';
    return;
  }
  ids.forEach((id, i) => {
    const data = docs[i]?.data?.();
    if (!data) return;
    const btn = document.createElement('button');
    btn.className = 'sidebar-class-item' + (id === currentClassId ? ' active' : '');
    btn.dataset.classId = id;
    btn.innerHTML = `<span class="sidebar-class-dot"></span><span style="overflow:hidden;text-overflow:ellipsis;">${data.nom || 'Sense nom'}</span>`;
    btn.addEventListener('click', () => {
      // Si estem a la pantalla de classes, obrir directament
      screenClasses.classList.add('hidden');
      screenClass.classList.remove('hidden');
      document.getElementById('btnMobileBack').classList.remove('hidden');
      document.getElementById('btnMobileStudents').classList.remove('hidden');
      // Actualitzar actiu
      document.querySelectorAll('.sidebar-class-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentClassId = id;
      window.currentClassId = id;
      currentPeriodeId = null;
      loadClassData();
    });
    container.appendChild(btn);
  });
}

function loadClassData() {
  if (!currentClassId) return;
  db.collection('classes').doc(currentClassId).get().then(async doc => {
    if (!doc.exists) { alert('Classe no trobada'); return; }
    const data = doc.data();
    classStudents = data.alumnes || [];
    document.getElementById('classTitle').textContent = data.nom || 'Sense nom';
    document.getElementById('classSub').textContent   = `${classStudents.length} alumnes`;
    window._currentClassName = data.nom || '';

    // Carregar períodes
    currentPeriodes = data.periodes || {};

    // Si no hi ha cap període, crear "General" per defecte
    if (Object.keys(currentPeriodes).length === 0) {
      const pid = `p_${Date.now()}`;
      currentPeriodes[pid] = { nom: '1r Trimestre', ordre: 0 };
      await db.collection('classes').doc(currentClassId).update({ periodes: currentPeriodes });
    }

    // Si el periode actiu ja no existeix, agafar el primer
    if (!currentPeriodeId || !currentPeriodes[currentPeriodeId]) {
      const ids = Object.entries(currentPeriodes).sort((a,b) => (a[1].ordre||0)-(b[1].ordre||0));
      currentPeriodeId = ids[0]?.[0] || null;
    }

    // Sincronitzar period com a "classId" per als mòduls de tutoria
    window._tcClassId = currentPeriodeId;
    if (typeof window._tcSetStudent === 'function' && currentCommentStudent) {
      window._tcSetStudent(currentCommentStudent.id, currentCommentStudent.nom, currentPeriodeId);
    }

    renderPeriodesTabs();
    renderStudentsList();
    showCommentsEmpty();
  }).catch(e => console.error(e));
}

/* ══════════════════════════════════════
   STUDENTS
══════════════════════════════════════ */
// Add student
// Tutoria button — obrirà openTutoriaModal quan ultracomentator.js NO l'hagi transformat encara
// Quan ultracomentator.js el transforma, canvia id a btnTutoria_hidden i li afegeix el click
// Aquí assegurem que btnTutoria_hidden també cridi openTutoriaModal
const _setupBtnTutoria = () => {
  const btn = document.getElementById('btnTutoria');
  if (btn) {
    btn.addEventListener('click', () => {
      if (typeof window.openTutoriaModal === 'function') window.openTutoriaModal();
    });
  }
};
document.addEventListener('DOMContentLoaded', _setupBtnTutoria);

document.getElementById('btnAddStudent').addEventListener('click', () => {
  document.getElementById('modalStudentName').value = '';
  openModal('modalAddStudent');
});

document.getElementById('modalAddStudentBtn').addEventListener('click', async () => {
  const name = document.getElementById('modalStudentName').value.trim();
  if (!name) return alert('Escriu el nom de l\'alumne/a');
  const ref = db.collection('alumnes').doc();
  await ref.set({ nom: name, comentari: '', ownerUid: professorUID });
  await db.collection('classes').doc(currentClassId).update({
    alumnes: firebase.firestore.FieldValue.arrayUnion(ref.id)
  });
  closeModal('modalAddStudent');
  loadClassData();
});

// Export Excel
document.getElementById('btnExportExcel').addEventListener('click', () => {
  if (typeof window.exportarComentarisExcel === 'function') {
    window.exportarComentarisExcel();
  } else {
    exportarComentarisExcel();
  }
});

// Sort alpha — menú desplegable
const btnSort = document.getElementById('btnSortAlpha');
const sortMenu = document.createElement('div');
sortMenu.id = 'sortMenu';
sortMenu.style.cssText = `
  display:none;position:absolute;top:calc(100% + 4px);right:0;min-width:200px;
  background:#fff;border:1px solid #e5e7eb;border-radius:8px;
  box-shadow:0 8px 24px rgba(0,0,0,0.13);z-index:9999;overflow:hidden;
`;
sortMenu.innerHTML = `
  <div style="padding:4px 0;">
    <div style="padding:6px 14px 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Per nom</div>
    <button data-sort="nom-az"  style="width:100%;text-align:left;padding:8px 16px;background:none;border:none;cursor:pointer;font-size:13px;color:#374151;font-family:inherit;">🔤 Nom A → Z</button>
    <button data-sort="nom-za"  style="width:100%;text-align:left;padding:8px 16px;background:none;border:none;cursor:pointer;font-size:13px;color:#374151;font-family:inherit;">🔤 Nom Z → A</button>
    <div style="height:1px;background:#f3f4f6;margin:4px 0;"></div>
    <div style="padding:6px 14px 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Per cognom</div>
    <button data-sort="cog-az" style="width:100%;text-align:left;padding:8px 16px;background:none;border:none;cursor:pointer;font-size:13px;color:#374151;font-family:inherit;">🔤 Cognom A → Z</button>
    <button data-sort="cog-za" style="width:100%;text-align:left;padding:8px 16px;background:none;border:none;cursor:pointer;font-size:13px;color:#374151;font-family:inherit;">🔤 Cognom Z → A</button>
  </div>
`;
btnSort.style.position = 'relative';
btnSort.parentNode.appendChild(sortMenu);

btnSort.addEventListener('click', e => {
  e.stopPropagation();
  const open = sortMenu.style.display === 'block';
  sortMenu.style.display = open ? 'none' : 'block';
});
document.addEventListener('click', () => { sortMenu.style.display = 'none'; });

sortMenu.querySelectorAll('button[data-sort]').forEach(btn => {
  btn.addEventListener('click', async () => {
    sortMenu.style.display = 'none';
    const mode = btn.dataset.sort;
    const docs = await Promise.all(classStudents.map(id => db.collection('alumnes').doc(id).get()));
    const pairs = docs.map(d => {
      const nom = d.exists ? (d.data().nom || '') : '';
      const parts = nom.trim().split(/\s+/);
      return { id: d.id, nom, cognom: parts.slice(1).join(' ') || parts[0] || '' };
    });
    pairs.sort((a, b) => {
      const va = mode.startsWith('cog') ? a.cognom : a.nom;
      const vb = mode.startsWith('cog') ? b.cognom : b.nom;
      const cmp = va.localeCompare(vb, 'ca', { sensitivity: 'base' });
      return mode.endsWith('za') ? -cmp : cmp;
    });
    const newOrder = pairs.map(p => p.id);
    await db.collection('classes').doc(currentClassId).update({ alumnes: newOrder });
    loadClassData();
  });
});

// Students menu
const studentsMenuBtn = document.getElementById('studentsMenuBtn');
const studentsMenu    = document.getElementById('studentsMenu');
studentsMenuBtn.addEventListener('click', e => {
  e.stopPropagation();
  studentsMenu.classList.toggle('hidden');
});

document.getElementById('deleteStudentsModeBtn').addEventListener('click', () => {
  deleteStudentsMode = !deleteStudentsMode;
  studentsMenu.classList.add('hidden');
  renderStudentsList();
});

document.getElementById('btnCancelDeleteStudents').addEventListener('click', () => {
  deleteStudentsMode = false;
  renderStudentsList();
});

// Import alumnes
document.getElementById('btnImportAL').addEventListener('click', () => {
  document.getElementById('fileImport').value = '';
  openModal('modalImportAL');
});

document.getElementById('btnImportALConfirm').addEventListener('click', async () => {
  const file = document.getElementById('fileImport').files[0];
  if (!file) return alert('Selecciona un fitxer');
  const ext = file.name.split('.').pop().toLowerCase();
  let names = [];
  try {
    if (ext === 'csv') {
      const text = await file.text();
      names = text.split(/\r?\n/).map(l => l.split(',')[0].trim()).filter(Boolean);
    } else {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      names = rows.map(r => (r[0] || '').toString().trim()).filter(Boolean);
    }
  } catch (e) { return alert('Error llegint fitxer: ' + e.message); }

  if (!names.length) return alert('No s\'han trobat noms al fitxer');
  const batch = db.batch();
  const ids   = [];
  names.forEach(nom => {
    const ref = db.collection('alumnes').doc();
    batch.set(ref, { nom, comentari: '', ownerUid: professorUID });
    ids.push(ref.id);
  });
  await batch.commit();
  await db.collection('classes').doc(currentClassId).update({
    alumnes: firebase.firestore.FieldValue.arrayUnion(...ids)
  });
  closeModal('modalImportAL');
  loadClassData();
  alert(`✅ ${names.length} alumnes importats!`);
});

/* ══════════════════════════════════════
   PERÍODES (trimestres / projectes)
══════════════════════════════════════ */
function renderPeriodesTabs(progres) {
  const container = document.getElementById('periodesTabs');
  if (!container) return;
  container.innerHTML = '';

  const sorted = Object.entries(currentPeriodes)
    .sort((a, b) => (a[1].ordre || 0) - (b[1].ordre || 0));

  sorted.forEach(([pid, pdata]) => {
    const tab = document.createElement('button');
    tab.className = 'periode-tab' + (pid === currentPeriodeId ? ' active' : '');
    tab.dataset.pid = pid;
    tab.innerHTML = `
      <span class="periode-tab-label">${pdata.nom || 'Sense nom'}</span>
      <span class="periode-tab-menu" data-pid="${pid}" title="Opcions">⋮</span>
    `;
    tab.addEventListener('click', e => {
      if (e.target.classList.contains('periode-tab-menu')) return;
      if (pid === currentPeriodeId) return;
      currentPeriodeId = pid;
      window._tcClassId = pid;
      if (typeof window._tcSetStudent === 'function' && currentCommentStudent) {
        window._tcSetStudent(currentCommentStudent.id, currentCommentStudent.nom, pid);
      }
      renderPeriodesTabs();
      renderStudentsList();
      showCommentsEmpty();
    });
    tab.querySelector('.periode-tab-menu').addEventListener('click', e => {
      e.stopPropagation();
      showPeriodeMenu(pid, pdata.nom, e.target);
    });
    container.appendChild(tab);
  });

  // Barra de progrés
  const barContainer = document.getElementById('periodeProgresBar');
  if (barContainer && progres) {
    const pct = progres.total > 0 ? Math.round((progres.amb / progres.total) * 100) : 0;
    const color = pct === 100 ? '#059669' : pct >= 50 ? '#2563eb' : '#d97706';
    barContainer.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#6b7280;white-space:nowrap;">
        <div style="width:80px;height:6px;background:#f3f4f6;border-radius:99px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:99px;transition:width .4s;"></div>
        </div>
        <span style="font-weight:600;color:${color};">${progres.amb}/${progres.total}</span>
        <span>amb comentari</span>
      </div>`;
  }
}

function showPeriodeMenu(pid, nomActual, anchor) {
  // Tancar qualsevol menú obert
  document.getElementById('periodeCtxMenu')?.remove();

  const menu = document.createElement('div');
  menu.id = 'periodeCtxMenu';
  menu.style.cssText = `
    position:fixed;background:#fff;border:1px solid #e5e7eb;border-radius:8px;
    box-shadow:0 8px 24px rgba(0,0,0,0.14);z-index:9999;overflow:hidden;min-width:170px;
  `;
  menu.innerHTML = `
    <div style="padding:4px 0;">
      <button data-action="rename" style="width:100%;text-align:left;padding:9px 16px;background:none;border:none;cursor:pointer;font-size:13px;color:#374151;font-family:inherit;display:flex;align-items:center;gap:8px;">✏️ Canviar nom</button>
      <button data-action="duplicate" style="width:100%;text-align:left;padding:9px 16px;background:none;border:none;cursor:pointer;font-size:13px;color:#374151;font-family:inherit;display:flex;align-items:center;gap:8px;">📋 Duplicar (sense comentaris)</button>
      <div style="height:1px;background:#f3f4f6;"></div>
      <button data-action="delete" style="width:100%;text-align:left;padding:9px 16px;background:none;border:none;cursor:pointer;font-size:13px;color:#dc2626;font-family:inherit;display:flex;align-items:center;gap:8px;">🗑️ Eliminar</button>
    </div>
  `;

  // Posicionar el menú sota l'anchor
  const rect = anchor.getBoundingClientRect();
  menu.style.top  = (rect.bottom + 4) + 'px';
  menu.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
  document.body.appendChild(menu);

  const close = () => menu.remove();
  setTimeout(() => document.addEventListener('click', close, { once: true }), 10);

  menu.querySelector('[data-action="rename"]').addEventListener('click', async () => {
    close();
    const nou = prompt('Nou nom:', nomActual);
    if (!nou || !nou.trim() || nou.trim() === nomActual) return;
    currentPeriodes[pid].nom = nou.trim();
    await db.collection('classes').doc(currentClassId).update({ periodes: currentPeriodes });
    renderPeriodesTabs();
  });

  menu.querySelector('[data-action="duplicate"]').addEventListener('click', async () => {
    close();
    const base = nomActual.replace(/\s*\(còpia.*\)$/, '').trim();
    const nom = prompt('Nom del nou període:', base + ' (còpia)');
    if (!nom || !nom.trim()) return;
    const nouId = `p_${Date.now()}`;
    const maxOrdre = Math.max(...Object.values(currentPeriodes).map(p => p.ordre || 0));
    currentPeriodes[nouId] = { nom: nom.trim(), ordre: maxOrdre + 1 };
    await db.collection('classes').doc(currentClassId).update({ periodes: currentPeriodes });
    // Canviar a nou període (alumnes sense comentaris)
    currentPeriodeId = nouId;
    window._tcClassId = nouId;
    renderPeriodesTabs();
    renderStudentsList();
    showCommentsEmpty();
  });

  menu.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    close();
    if (Object.keys(currentPeriodes).length <= 1) {
      alert('Cal tenir almenys un període. Canvia el nom en lloc d\'eliminar-lo.');
      return;
    }
    if (!confirm(`Eliminar el període "${nomActual}"?\nEls comentaris d'aquest període s'esborraran de tots els alumnes.`)) return;

    // Esborrar comentaris d'aquest periode de tots els alumnes
    const batch = db.batch();
    classStudents.forEach(sid => {
      batch.update(db.collection('alumnes').doc(sid), {
        [`comentarisPerPeriode.${pid}`]: firebase.firestore.FieldValue.delete()
      });
    });
    await batch.commit();

    delete currentPeriodes[pid];
    // Recalcular ordres
    Object.values(currentPeriodes).forEach((p, i) => { p.ordre = i; });
    await db.collection('classes').doc(currentClassId).update({ periodes: currentPeriodes });

    // Canviar a primer periode disponible
    const primer = Object.entries(currentPeriodes).sort((a,b) => (a[1].ordre||0)-(b[1].ordre||0))[0];
    currentPeriodeId = primer?.[0] || null;
    window._tcClassId = currentPeriodeId;
    renderPeriodesTabs();
    renderStudentsList();
    showCommentsEmpty();
  });
}

// Botó + nou període
document.getElementById('btnAddPeriode').addEventListener('click', async () => {
  const sugerits = ['1r Trimestre','2n Trimestre','3r Trimestre','Final de curs','Projecte 1','Projecte 2'];
  const existents = Object.values(currentPeriodes).map(p => p.nom);
  const seguent = sugerits.find(s => !existents.includes(s)) || 'Nou període';
  const nom = prompt('Nom del nou període:', seguent);
  if (!nom || !nom.trim()) return;
  const nouId = `p_${Date.now()}`;
  const maxOrdre = Object.keys(currentPeriodes).length === 0 ? 0 :
    Math.max(...Object.values(currentPeriodes).map(p => p.ordre || 0)) + 1;
  currentPeriodes[nouId] = { nom: nom.trim(), ordre: maxOrdre };
  await db.collection('classes').doc(currentClassId).update({ periodes: currentPeriodes });
  currentPeriodeId = nouId;
  window._tcClassId = nouId;
  renderPeriodesTabs();
  renderStudentsList();
  showCommentsEmpty();
});

// Render students list
function renderStudentsList() {
  studentsList.innerHTML = '';
  studentsCount.textContent = classStudents.length;

  const searchInput = document.getElementById('studentSearch');
  if (searchInput && !searchInput._bound) {
    searchInput.addEventListener('input', filterStudents);
    searchInput._bound = true;
  }

  if (!classStudents.length) {
    studentsList.innerHTML = `<li style="color:var(--ink-20);font-size:13px;padding:8px;">Cap alumne. Afegeix-ne!</li>`;
    return;
  }

  // Show/hide cancel delete btn
  document.getElementById('btnCancelDeleteStudents').classList.toggle('hidden', !deleteStudentsMode);
  document.getElementById('deleteStudentsModeBtn').textContent = deleteStudentsMode ? 'Modo eliminar actiu' : 'Eliminar alumnes';

  Promise.all(classStudents.map(id => db.collection('alumnes').doc(id).get())).then(docs => {
    // Calcular progrés del periode actiu
    let ambComentari = 0;
    docs.forEach(doc => {
      if (!doc.exists) return;
      const data = doc.data();
      const periodeData = data.comentarisPerPeriode?.[currentPeriodeId] || {};
      if ((periodeData.comentari || data.comentari || '').trim()) ambComentari++;
    });
    renderPeriodesTabs({ amb: ambComentari, total: docs.filter(d => d.exists).length });

    docs.forEach((doc, idx) => {
      if (!doc.exists) return;
      const data = doc.data();
      const nom  = data.nom || 'Desconegut';
      // Llegir comentari del periode actiu
      const periodeData = data.comentarisPerPeriode?.[currentPeriodeId] || {};
      const hasComment = !!(periodeData.comentari || data.comentari || '').trim();

      const li = document.createElement('li');
      li.className = 'student-item';
      li.dataset.idx = idx;
      li.dataset.id  = doc.id;
      li.dataset.nom = nom.toLowerCase();

      if (!deleteStudentsMode) {
        li.draggable = true;
        li.innerHTML = `
          <span class="student-name">${nom}</span>
          ${hasComment ? '<span class="student-comment-dot" title="Té comentari"></span>' : ''}
          <div class="student-item-actions">
            <button class="student-item-btn edit" title="Editar comentari">✏️</button>
            <button class="student-item-btn delete" title="Eliminar alumne">🗑️</button>
          </div>
        `;

        li.querySelector('.edit').addEventListener('click', e => {
          e.stopPropagation();
          openCommentsModal(doc.id, nom, data.comentari || '');
        });
        li.querySelector('.delete').addEventListener('click', e => {
          e.stopPropagation();
          removeStudent(doc.id, nom);
        });
        li.addEventListener('click', () => {
          document.querySelectorAll('.student-item').forEach(s => s.classList.remove('active'));
          li.classList.add('active');
          const periodeData = data.comentarisPerPeriode?.[currentPeriodeId] || {};
          const comentariActual = periodeData.comentari || data.comentari || '';
          showStudentComment(doc.id, nom, comentariActual);
        });

        // Drag & drop
        li.addEventListener('dragstart', () => { li.style.opacity = '0.5'; window._dragIdx = idx; });
        li.addEventListener('dragend',   () => { li.style.opacity = '1'; });
        li.addEventListener('dragover',  e => { e.preventDefault(); li.classList.add('drag-over'); });
        li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
        li.addEventListener('drop', e => {
          e.preventDefault();
          li.classList.remove('drag-over');
          const from = window._dragIdx;
          const to   = idx;
          if (from === to) return;
          const arr  = [...classStudents];
          const item = arr.splice(from, 1)[0];
          arr.splice(to, 0, item);
          db.collection('classes').doc(currentClassId).update({ alumnes: arr }).then(() => {
            classStudents = arr;
            renderStudentsList();
          });
        });
      } else {
        // Delete mode
        li.innerHTML = `
          <input type="checkbox" class="delete-checkbox" />
          <span class="student-name">${nom}</span>
        `;
        if (idx === classStudents.length - 1) {
          // Add delete confirm btn after all items
          setTimeout(() => {
            const existing = document.getElementById('confirmDeleteStudentsBtn');
            if (!existing) {
              const btn = document.createElement('button');
              btn.id = 'confirmDeleteStudentsBtn';
              btn.className = 'btn-danger w-full mt-3';
              btn.textContent = 'Eliminar seleccionats';
              btn.addEventListener('click', deleteSelectedStudents);
              studentsList.after(btn);
            }
          }, 50);
        }
      }

      studentsList.appendChild(li);
    });
  });
}

function filterStudents() {
  const q = document.getElementById('studentSearch').value.toLowerCase();
  document.querySelectorAll('#studentsList .student-item').forEach(li => {
    li.style.display = li.dataset.nom?.includes(q) ? '' : 'none';
  });
}

async function deleteSelectedStudents() {
  const checks = [...document.querySelectorAll('#studentsList .delete-checkbox')].filter(c => c.checked);
  if (!checks.length) return alert('Selecciona almenys un alumne');
  const items = checks.map(c => c.closest('.student-item'));
  confirmAction('Eliminar alumnes', `Eliminar ${items.length} alumne(s)?`, async () => {
    const ids = items.map(li => li.dataset.id);
    const batch = db.batch();
    ids.forEach(id => batch.delete(db.collection('alumnes').doc(id)));
    await batch.commit();
    await db.collection('classes').doc(currentClassId).update({
      alumnes: classStudents.filter(id => !ids.includes(id))
    });
    document.getElementById('confirmDeleteStudentsBtn')?.remove();
    deleteStudentsMode = false;
    loadClassData();
  });
}

function removeStudent(studentId, nom) {
  confirmAction('Eliminar alumne', `Vols eliminar "${nom}"?`, async () => {
    await db.collection('classes').doc(currentClassId).update({
      alumnes: firebase.firestore.FieldValue.arrayRemove(studentId)
    });
    await db.collection('alumnes').doc(studentId).delete();
    if (currentCommentStudent?.id === studentId) { showCommentsEmpty(); }
    loadClassData();
  });
}

/* ══════════════════════════════════════
   COMMENTS PANEL (right side)
══════════════════════════════════════ */
function showCommentsEmpty() {
  document.getElementById('commentsEmptyState').classList.remove('hidden');
  document.getElementById('commentsGrid').classList.add('hidden');
  currentCommentStudent = null;
}

async function showStudentComment(studentId, nom, comentariLocal) {
  currentCommentStudent = { id: studentId, nom };
  window._tcStudentId   = studentId;
  window._tcStudentName = nom;
  window._tcClassId     = currentPeriodeId;

  if (typeof window._tcSetStudent === 'function') {
    window._tcSetStudent(studentId, nom, currentPeriodeId);
  }

  document.getElementById('commentsEmptyState').classList.add('hidden');
  const grid = document.getElementById('commentsGrid');
  grid.classList.remove('hidden');

  // Mostrar comentari local immediatament (sense esperar Firestore)
  _renderCommentPanel(nom, comentariLocal || '', '', studentId);

  // Llegir dades fresques de Firestore (assoliments + comentari real)
  try {
    const doc = await db.collection('alumnes').doc(studentId).get();
    if (!doc.exists) return;
    const data = doc.data();
    const periodeData    = data.comentarisPerPeriode?.[currentPeriodeId] || {};
    const comentariFresh = periodeData.comentari || data.comentari || '';
    const metadades      = periodeData.comentarisItems || data.comentarisItems?.[currentPeriodeId] || [];

    const ASSOLIMENTS_MAP = {
      'assoliment excel·lent':  { color: '#059669', bg: '#d1fae5' },
      'assoliment notable':     { color: '#2563eb', bg: '#dbeafe' },
      'assoliment satisfactori':{ color: '#d97706', bg: '#fef3c7' },
      'no assolit':             { color: '#dc2626', bg: '#fee2e2' },
      'no cursa':               { color: '#6b7280', bg: '#f3f4f6' },
      'no avaluat':             { color: '#9ca3af', bg: '#f9fafb' },
    };
    let assolamentsHTML = '';
    if (metadades.length > 0) {
      const badges = metadades.filter(m => m.assoliment).map(m => {
        const colors = ASSOLIMENTS_MAP[m.assoliment.toLowerCase()] || { color: '#6b7280', bg: '#f3f4f6' };
        return `<span style="display:inline-flex;align-items:center;gap:5px;background:${colors.bg};color:${colors.color};font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;border:1.5px solid ${colors.color}33;">${m.assoliment}${m.titol ? ` <span style="font-weight:400;opacity:.75;">· ${m.titol}</span>` : ''}</span>`;
      });
      if (badges.length > 0) {
        assolamentsHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">${badges.join('')}</div>`;
      }
    }

    const historial = periodeData.historial || [];

    _renderCommentPanel(nom, comentariFresh, assolamentsHTML, studentId, historial);

  } catch(e) { console.error('showStudentComment error:', e); }
}

function _renderCommentPanel(nom, comentari, assolamentsHTML, studentId, historial = []) {
  const grid = document.getElementById('commentsGrid');
  const teComentari = !!comentari.trim();

  // Historial HTML (últimes 3 versions anteriors)
  let historialHTML = '';
  if (historial.length > 0) {
    const items = historial.slice(0, 3).map((h, i) => {
      const data = h.timestamp ? new Date(h.timestamp).toLocaleString('ca', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
      const preview = (h.text || '').slice(0, 100) + ((h.text || '').length > 100 ? '…' : '');
      return `
        <div class="history-item" data-idx="${i}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="font-size:12px;color:#6b7280;line-height:1.5;flex:1;">${preview}</div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
              <span style="font-size:10px;color:#d1d5db;white-space:nowrap;">${data}</span>
              <button class="btn-restore-history" data-idx="${i}" style="font-size:11px;padding:2px 8px;border:1px solid #e5e7eb;border-radius:5px;background:#f9fafb;color:#6b7280;cursor:pointer;font-family:inherit;white-space:nowrap;">↩ Restaurar</button>
            </div>
          </div>
        </div>`;
    }).join('');
    historialHTML = `
      <details style="margin-top:12px;padding-top:10px;border-top:1px dashed #e5e7eb;">
        <summary style="font-size:12px;color:#9ca3af;cursor:pointer;user-select:none;list-style:none;display:flex;align-items:center;gap:5px;">
          <span style="font-size:11px;">🕓</span>
          <span style="font-weight:600;">Versions anteriors (${historial.length})</span>
        </summary>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">${items}</div>
      </details>`;
  }

  grid.innerHTML = `
    <div class="comment-card">
      <div class="comment-card-header">
        <span class="comment-card-name">💬 ${nom}</span>
        ${teComentari ? `<button id="btnCopyComment" class="btn-copy-comment" title="Copiar comentari">📋</button>` : ''}
      </div>
      ${assolamentsHTML}
      <div id="commentDisplayText" class="comment-text ${!teComentari ? 'empty' : ''}">
        ${comentari.trim() || 'Cap comentari. Fes clic a un botó per crear-ne un.'}
      </div>
      ${historialHTML}
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">
        <button id="btnEditComment" class="btn-outline btn-sm">✏️ Editar</button>
        <button id="btnGenCommentIA" class="btn-tutoria btn-sm">🤖 Comentari IA</button>
        <button id="btnOpenUltra" class="btn-sm" style="background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-weight:600;">⚡ Ultracomentator</button>
      </div>
    </div>
  `;

  // Copiar
  document.getElementById('btnCopyComment')?.addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(comentari.trim());
      e.target.textContent = '✅';
      setTimeout(() => { e.target.textContent = '📋'; }, 1500);
    } catch { alert('No s\'ha pogut copiar. Selecciona el text manualment.'); }
  });

  // Restaurar historial
  grid.querySelectorAll('.btn-restore-history').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx);
      const versio = historial[idx];
      if (!versio || !confirm(`Restaurar la versió anterior?\n\n"${(versio.text||'').slice(0,100)}..."`)) return;
      // Guardar l'actual a l'historial i restaurar l'antiga
      await _saveComentariWithHistory(studentId, versio.text);
      showStudentComment(studentId, nom, versio.text);
    });
  });

  document.getElementById('btnEditComment').addEventListener('click', () => {
    openCommentsModal(studentId, nom, comentari);
  });
  document.getElementById('btnGenCommentIA').addEventListener('click', async () => {
    // Context ja configurat: window._tcStudentId, _tcStudentName, _tcClassId
    // Cridem openTCFormulari directament (igual que el botó IA del modal de comentaris original)
    if (typeof window.openTCFormulari === 'function') {
      await window.openTCFormulari();
    } else {
      // Fallback: obrir via desplegable
      const optIA = document.getElementById('ucOptIA');
      if (optIA) optIA.click();
      else alert('El sistema de IA no ha carregat. Refresca la pàgina.');
    }
  });

  document.getElementById('btnOpenUltra').addEventListener('click', () => {
    // Context ja configurat: window._tcStudentId, _tcStudentName, _tcClassId
    // Cridem openMevesPlantillesModal directament (NO openUltracomentatorModal que neteja el context)
    if (typeof window.openMevesPlantillesModal === 'function') {
      window.openMevesPlantillesModal();
    } else {
      alert('Ultracomentator no disponible. Refresca la pàgina.');
    }
  });

  
}

// Guarda comentari preservant historial de les últimes 3 versions
// Exportar funcions de períodes per a app-patch.js
window.renderPeriodesTabs  = p  => renderPeriodesTabs(p);
window.renderStudentsList  = ()  => renderStudentsList();
window.showCommentsEmpty   = ()  => showCommentsEmpty();
window.loadClassesScreen   = ()  => loadClassesScreen();

window._saveComentariWithHistory =
async function _saveComentariWithHistory(studentId, nouText, metadades = null) {
  const docRef = db.collection('alumnes').doc(studentId);
  const doc = await docRef.get();
  const periodeData = doc.data()?.comentarisPerPeriode?.[currentPeriodeId] || {};
  const textAnterior = periodeData.comentari || '';
  const historialActual = periodeData.historial || [];

  // Afegir versió anterior a l'historial (si té contingut i és diferent del nou)
  const nouHistorial = textAnterior.trim() && textAnterior.trim() !== nouText.trim()
    ? [{ text: textAnterior.trim(), timestamp: Date.now() }, ...historialActual].slice(0, 3)
    : historialActual;

  const updateData = {
    [`comentarisPerPeriode.${currentPeriodeId}.comentari`]: nouText,
    [`comentarisPerPeriode.${currentPeriodeId}.historial`]: nouHistorial,
  };
  if (metadades && metadades.length > 0) {
    updateData[`comentarisPerPeriode.${currentPeriodeId}.comentarisItems`] = metadades;
  }
  await docRef.update(updateData);
  return nouHistorial;
}


window.openCommentsModal = function(studentId, nom, comentariActual) {
  currentCommentStudent = { id: studentId, nom };
  window._tcStudentId   = studentId;
  window._tcStudentName = nom;
  window._tcClassId     = currentClassId;

  document.getElementById('modalCommentsTitle').textContent = `Comentari: ${nom}`;
  const ta = document.getElementById('commentTextarea');
  ta.value = comentariActual || '';
  updateCommentChars();
  openModal('modalComments');
  ta.focus();
};

window.closeCommentsModal = function() { closeModal('modalComments'); };

function updateCommentChars() {
  const ta = document.getElementById('commentTextarea');
  document.getElementById('commentChars').textContent = ta.value.length;
}

document.getElementById('commentTextarea').addEventListener('input', updateCommentChars);
document.getElementById('closeCommentsModalBtn').addEventListener('click', () => closeModal('modalComments'));
document.getElementById('cancelCommentsBtn').addEventListener('click', () => closeModal('modalComments'));

document.getElementById('saveCommentBtn').addEventListener('click', async () => {
  if (!currentCommentStudent?.id) {
    alert('Error: no hi ha alumne seleccionat. Tanca el modal i torna a clicar l\'alumne.');
    return;
  }
  const nouText = document.getElementById('commentTextarea').value.trim();
  try {
    await _saveComentariWithHistory(currentCommentStudent.id, nouText);
    closeModal('modalComments');
    showStudentComment(currentCommentStudent.id, currentCommentStudent.nom, nouText);
    const li = document.querySelector(`#studentsList li[data-id="${currentCommentStudent.id}"]`);
    if (li) {
      const dot = li.querySelector('.student-comment-dot');
      if (nouText && !dot) {
        const nameSpan = li.querySelector('.student-name');
        const newDot = document.createElement('span');
        newDot.className = 'student-comment-dot';
        newDot.title = 'Té comentari';
        nameSpan?.after(newDot);
      } else if (!nouText && dot) dot.remove();
    }
  } catch(e) {
    console.error('Error guardant comentari:', e);
    alert('Error guardant: ' + e.message);
  }
});

window.saveComment = async function() {
  if (!currentCommentStudent?.id) return;
  const text = document.getElementById('commentTextarea').value.trim();
  try {
    await db.collection('alumnes').doc(currentCommentStudent.id).update({
      [`comentarisPerPeriode.${currentPeriodeId}.comentari`]: text
    });
    closeModal('modalComments');
    showStudentComment(currentCommentStudent.id, currentCommentStudent.nom, text);
    // Actualitzar dot a la llista
    const li = document.querySelector(`#studentsList li[data-id="${currentCommentStudent.id}"]`);
    if (li) {
      const dot = li.querySelector('.student-comment-dot');
      if (text && !dot) {
        const nameSpan = li.querySelector('.student-name');
        const newDot = document.createElement('span');
        newDot.className = 'student-comment-dot';
        newDot.title = 'Té comentari';
        nameSpan?.after(newDot);
      } else if (!text && dot) dot.remove();
    }
  } catch(e) {
    alert('Error guardant: ' + e.message);
  }
};

window.updateCommentChars = updateCommentChars;

/* ══════════════════════════════════════
   EXPORT COMENTARIS A EXCEL
   Format: Alumne | Títol 1 | Comentari 1 | Assoliment 1 | Títol 2 | ...
   (igual que el projecte original)
══════════════════════════════════════ */
function _parsarComentariItems(text) {
  if (!text) return [];
  return text.split(/\n\s*\n/).map(bloc => {
    const net = bloc.trim();
    if (!net) return null;
    const comaIdx = net.indexOf(',');
    const item = (comaIdx > 0 && comaIdx < 80) ? net.slice(0, comaIdx).trim() : '';
    return { item, comentari: net };
  }).filter(Boolean);
}

async function exportarComentarisExcel() {
  if (!currentClassId) return alert('Obre una classe primer');
  try {
    const classDoc = await db.collection('classes').doc(currentClassId).get();
    if (!classDoc.exists) return alert('Classe no trobada');
    const nomClasse = classDoc.data()?.nom || 'Classe';
    const alumneIds = classDoc.data()?.alumnes || [];
    if (!alumneIds.length) return alert('No hi ha alumnes en aquesta classe');

    if (!window.XLSX) return alert('La llibreria XLSX no està disponible');

    const docs = await Promise.all(alumneIds.map(id => db.collection('alumnes').doc(id).get()));

    const alumnes = docs.filter(d => d.exists).map(d => {
      const data = d.data();
      const periodeData   = data.comentarisPerPeriode?.[currentPeriodeId] || {};
      const comentariText = periodeData.comentari || data.comentari || data.comentarios?.[currentClassId] || '';
      const metadades     = periodeData.comentarisItems || data.comentarisItems?.[currentPeriodeId] || [];
      const blocs = _parsarComentariItems(comentariText);
      const items = blocs.map((bloc, i) => ({
        titol:      metadades[i]?.titol      || bloc.item || `Ítem ${i+1}`,
        comentari:  bloc.comentari,
        assoliment: metadades[i]?.assoliment || ''
      }));
      return { nom: data.nom || 'Desconegut', items, comentariText };
    });

    const maxItems = Math.max(1, ...alumnes.map(a => a.items.length));
    const tenItems = alumnes.some(a => a.items.length > 1);

    let ws;
    const wb = window.XLSX.utils.book_new();

    if (tenItems) {
      // Format complet amb ítems: Alumne | Títol 1 | Comentari 1 | Assoliment 1 | ...
      const capcalera = ['Alumne'];
      for (let i = 1; i <= maxItems; i++) {
        capcalera.push(`Títol ${i}`, `Comentari ${i}`, `Assoliment ${i}`);
      }
      const files = alumnes.map(a => {
        const fila = [a.nom];
        for (let i = 0; i < maxItems; i++) {
          const it = a.items[i];
          fila.push(it ? it.titol     : '');
          fila.push(it ? it.comentari : '');
          fila.push(it ? it.assoliment: '');
        }
        return fila;
      });
      ws = window.XLSX.utils.aoa_to_sheet([capcalera, ...files]);
      ws['!cols'] = [{ wch: 25 }];
      for (let i = 0; i < maxItems; i++) {
        ws['!cols'].push({ wch: 30 }, { wch: 90 }, { wch: 22 });
      }
    } else {
      // Format simple: Alumne | Comentari
      const files = alumnes.map(a => [a.nom, a.comentariText]);
      ws = window.XLSX.utils.aoa_to_sheet([['Alumne', 'Comentari'], ...files]);
      ws['!cols'] = [{ wch: 28 }, { wch: 100 }];
    }

    window.XLSX.utils.book_append_sheet(wb, ws, 'Comentaris');
    const avui = new Date();
    const dataStr = `${avui.getFullYear()}${String(avui.getMonth()+1).padStart(2,'0')}${String(avui.getDate()).padStart(2,'0')}`;
    window.XLSX.writeFile(wb, `comentaris_${nomClasse.replace(/\s+/g,'_')}_${dataStr}.xlsx`);
  } catch(e) {
    console.error('Error exportant:', e);
    alert('Error exportant: ' + e.message);
  }
}
window.exportarComentarisExcel = exportarComentarisExcel;

/* ══════════════════════════════════════
   EXPOSE FOR TUTORIA MODULES
══════════════════════════════════════ */
// tutoria.js i tutoria-comentaris.js necessiten accedir a:
// window._tcStudentId, window._tcStudentName, window._tcClassId
// i window.openCommentsModal — tot ja exposat a window

// Per compatibilitat amb tutoria-comentaris.js que busca db/auth via window.firebase
window.firebase = firebase;

window._refreshCommentDisplay = function(studentId, text) {
  // 1. Refrescar el panell dret complet (si l'alumne actiu és aquest)
  if (currentCommentStudent?.id === studentId) {
    showStudentComment(studentId, currentCommentStudent.nom, text);
  }

  // 2. Actualitzar dot verd a la llista
  const li = document.querySelector(`#studentsList li[data-id="${studentId}"]`);
  if (li) {
    const dot = li.querySelector('.student-comment-dot');
    if (text?.trim() && !dot) {
      const nameSpan = li.querySelector('.student-name');
      const newDot = document.createElement('span');
      newDot.className = 'student-comment-dot';
      newDot.title = 'Té comentari';
      nameSpan?.after(newDot);
    } else if (!text?.trim() && dot) {
      dot.remove();
    }
  }

  // 3. Recalcular barra de progrés
  const allLis = document.querySelectorAll('#studentsList li[data-id]');
  const total = allLis.length;
  const amb = [...allLis].filter(l => l.querySelector('.student-comment-dot')).length;
  renderPeriodesTabs({ amb, total });
};

/* ══════════════════════════════════════
   MODAL SOBRE L'APP
══════════════════════════════════════ */
document.getElementById('btnAbout')?.addEventListener('click', () => {
  const old = document.getElementById('modalAbout');
  if (old) { old.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'modalAbout';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);padding:20px;
  `;
  modal.innerHTML = `
    <div style="
      background:#fff;border-radius:20px;width:min(560px,95vw);max-height:90vh;overflow-y:auto;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      box-shadow:0 24px 80px rgba(0,0,0,0.25);
    ">
      <!-- Capçalera -->
      <div style="background:linear-gradient(135deg,#1e1b4b,#4c1d95);padding:28px 32px;color:#fff;border-radius:20px 20px 0 0;position:relative;">
        <div style="font-size:36px;margin-bottom:8px;">⚡</div>
        <h2 style="margin:0 0 4px;font-size:24px;font-weight:900;letter-spacing:-.5px;">Ultracomentator</h2>
        <div style="font-size:13px;opacity:.75;">Versió Beta · Institut Matadepera</div>
        <button id="btnAboutClose" style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,.15);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>

      <!-- Contingut -->
      <div style="padding:28px 32px;display:flex;flex-direction:column;gap:20px;">

        <!-- Autoria -->
        <div>
          <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Autoria</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:18px;">🏫</span>
              <div>
                <div style="font-weight:700;color:#1a1a2e;font-size:14px;">Institut Matadepera</div>
                <div style="font-size:12px;color:#6b7280;">Propietari de l'aplicació</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:18px;">👨‍💻</span>
              <div>
                <div style="font-weight:700;color:#1a1a2e;font-size:14px;">Toni Muñoz - Coordinador informàtic i professor d'economia de l'Institut Matadepera</div>
                <div style="font-size:12px;color:#6b7280;">Desenvolupador</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:18px;">💡</span>
              <div>
                <div style="font-weight:700;color:#1a1a2e;font-size:14px;">Claustre Institut Matadepera</div>
                <div style="font-size:12px;color:#6b7280;">Idea original</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Contacte -->
        <div style="background:#f8fafc;border-radius:12px;padding:14px 16px;">
          <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Contacte i suport</div>
          <a href="mailto:a8053169@xtec.cat" style="color:#4c1d95;font-weight:600;font-size:14px;text-decoration:none;">📧 a8053169@xtec.cat</a>
        </div>

        <!-- Avís legal -->
        <div style="border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <div style="background:#f9fafb;padding:12px 16px;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">⚖️ Avís legal i condicions d'ús</div>
          </div>
          <div style="padding:16px;font-size:12px;color:#374151;line-height:1.8;display:flex;flex-direction:column;gap:10px;">

            <div>
              <strong style="color:#1a1a2e;">Programari lliure i gratuït</strong><br>
              Ultracomentator és una aplicació de programari lliure, distribuïda de manera gratuïta per a ús educatiu. Qualsevol professor o centre educatiu pot fer-la servir, copiar-la i adaptar-la sense restriccions comercials.
            </div>

            <div>
              <strong style="color:#1a1a2e;">Responsabilitat sobre les dades introduïdes</strong><br>
              Cada usuari és l'únic responsable de la informació que introdueix a l'aplicació, incloent noms d'alumnes, comentaris i qualsevol altra dada personal. El propietari i el desenvolupador d'aquesta aplicació <strong>no assumeixen cap responsabilitat</strong> pel contingut introduït pels usuaris ni per l'ús que en facin.
            </div>

            <div>
              <strong style="color:#1a1a2e;">Dades de menors d'edat (RGPD)</strong><br>
              Aquesta aplicació pot contenir dades personals de menors d'edat. D'acord amb el Reglament General de Protecció de Dades (RGPD / UE 2016/679), el tractament d'aquestes dades és responsabilitat exclusiva del docent o centre educatiu que les introdueixi. L'usuari declara disposar de les autoritzacions necessàries per al tractament d'aquestes dades i s'obliga a no emmagatzemar informació sensible innecessària.
            </div>

            <div>
              <strong style="color:#1a1a2e;">Absència de garanties</strong><br>
              L'aplicació es proporciona "tal com és" (<em>as is</em>), sense garanties de cap tipus. El desenvolupador no es fa responsable de pèrdues de dades, interrupcions del servei ni danys derivats de l'ús de l'aplicació.
            </div>

            <div>
              <strong style="color:#1a1a2e;">Infraestructura de tercers</strong><br>
              Les dades s'emmagatzemen a Google Firebase (Firestore). L'usuari accepta les condicions de servei de Google Cloud en usar aquesta aplicació.
            </div>

          </div>
        </div>

        <!-- Versió -->
        <div style="text-align:center;font-size:11px;color:#d1d5db;">
          Ultracomentator · Versió Beta · ${new Date().getFullYear()}
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('btnAboutClose').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
});
