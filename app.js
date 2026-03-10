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

window.currentClassId = null;

/* ─── DOM REFS ─── */
const loginScreen  = document.getElementById('loginScreen');
const appRoot      = document.getElementById('appRoot');
const screenClasses = document.getElementById('screen-classes');
const screenClass   = document.getElementById('screen-class');
const classesGrid   = document.getElementById('classesGrid');
const studentsList  = document.getElementById('studentsList');
const studentsCount = document.getElementById('studentsCount');

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
   AUTH
══════════════════════════════════════ */
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
      await profRef.set({
        email: user.email,
        nom: user.displayName || user.email.split('@')[0],
        google: true,
        isAdmin: false,
        suspended: false,
        deleted: false,
        classes: [],
        createdAt: firebase.firestore.Timestamp.now()
      });
    }
    const profDoc = await profRef.get();
    const d = profDoc.data();
    if (d.deleted)   { await auth.signOut(); return alert("⚠️ Compte eliminat."); }
    if (d.suspended) { await auth.signOut(); return alert("⚠️ Compte suspès. Contacta l'administrador."); }
    professorUID = user.uid;
    setupAfterAuth(user);
  } catch (err) {
    alert("Error amb Google: " + err.message);
  }
}
document.getElementById('googleLoginBtn').addEventListener('click', signInWithGoogle);

document.getElementById('btnRegister').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const pw    = document.getElementById('loginPassword').value;
  if (!email || !pw) return alert('Introdueix email i contrasenya');
  try {
    const u = await auth.createUserWithEmailAndPassword(email, pw);
    professorUID = u.user.uid;
    await db.collection('professors').doc(professorUID).set({
      email,
      nom: email.split('@')[0],
      isAdmin: false,
      suspended: false,
      deleted: false,
      classes: [],
      createdAt: firebase.firestore.Timestamp.now()
    });
    setupAfterAuth(u.user);
    alert("Compte creat!");
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') alert("Email ja registrat.");
    else if (e.code === 'auth/weak-password') alert("Contrasenya massa dèbil (mínim 6 caràcters).");
    else alert('Error: ' + e.message);
  }
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
    const adminBtn = document.createElement('button');
    adminBtn.className = 'nav-item';
    adminBtn.innerHTML = '<span class="nav-icon">⚙️</span><span>Administrar</span>';
    adminBtn.addEventListener('click', () => { window.location.href = 'admin.html'; });
    document.querySelector('.sidebar-nav').appendChild(adminBtn);
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
  await ref.set({ nom: name, alumnes: [] });
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
            document.querySelectorAll('.card-menu-dropdown').forEach(m => m.classList.add('hidden'));
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
  screenClasses.classList.add('hidden');
  screenClass.classList.remove('hidden');
  document.getElementById('btnMobileBack').classList.remove('hidden');
  document.getElementById('btnMobileStudents').classList.remove('hidden');
  loadClassData();
}

document.getElementById('btnBack').addEventListener('click', () => {
  currentClassId = null;
  window.currentClassId = null;
  screenClass.classList.add('hidden');
  screenClasses.classList.remove('hidden');
  document.getElementById('btnMobileBack').classList.add('hidden');
  document.getElementById('btnMobileStudents').classList.add('hidden');
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

function loadClassData() {
  if (!currentClassId) return;
  db.collection('classes').doc(currentClassId).get().then(doc => {
    if (!doc.exists) { alert('Classe no trobada'); return; }
    const data = doc.data();
    classStudents = data.alumnes || [];
    document.getElementById('classTitle').textContent = data.nom || 'Sense nom';
    document.getElementById('classSub').textContent   = `${classStudents.length} alumnes`;
    window._currentClassName = data.nom || '';
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
  await ref.set({ nom: name, comentari: '' });
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

// Sort alpha
document.getElementById('btnSortAlpha').addEventListener('click', async () => {
  const docs = await Promise.all(classStudents.map(id => db.collection('alumnes').doc(id).get()));
  const pairs = docs.map(d => ({ id: d.id, nom: d.exists ? (d.data().nom || '') : '' }));
  pairs.sort((a, b) => a.nom.localeCompare(b.nom, 'ca'));
  const newOrder = pairs.map(p => p.id);
  await db.collection('classes').doc(currentClassId).update({ alumnes: newOrder });
  loadClassData();
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
    batch.set(ref, { nom, comentari: '' });
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
    docs.forEach((doc, idx) => {
      if (!doc.exists) return;
      const data = doc.data();
      const nom  = data.nom || 'Desconegut';
      const hasComment = !!(data.comentari || '').trim();

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
          showStudentComment(doc.id, nom, data.comentari || '');
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

async function showStudentComment(studentId, nom, comentari) {
  currentCommentStudent = { id: studentId, nom };
  window._tcStudentId   = studentId;
  window._tcStudentName = nom;
  window._tcClassId     = currentClassId;

  // Sincronitzar variables locals de tutoria-comentaris.js
  if (typeof window._tcSetStudent === 'function') {
    window._tcSetStudent(studentId, nom, currentClassId);
  }

  document.getElementById('commentsEmptyState').classList.add('hidden');
  const grid = document.getElementById('commentsGrid');
  grid.classList.remove('hidden');

  // Mapa d'assoliments per color i badge
  const ASSOLIMENTS_MAP = {
    'assoliment excel·lent':  { color: '#059669', bg: '#d1fae5' },
    'assoliment notable':     { color: '#2563eb', bg: '#dbeafe' },
    'assoliment satisfactori':{ color: '#d97706', bg: '#fef3c7' },
    'no assolit':             { color: '#dc2626', bg: '#fee2e2' },
    'no cursa':               { color: '#6b7280', bg: '#f3f4f6' },
    'no avaluat':             { color: '#9ca3af', bg: '#f9fafb' },
  };

  // Llegir metadades d'assoliments de Firestore
  let assolamentsHTML = '';
  try {
    const doc = await db.collection('alumnes').doc(studentId).get();
    if (doc.exists) {
      const metadades = doc.data().comentarisItems?.[currentClassId] || [];
      if (metadades.length > 0) {
        const badges = metadades
          .filter(m => m.assoliment)
          .map(m => {
            const key = m.assoliment.toLowerCase();
            const colors = ASSOLIMENTS_MAP[key] || { color: '#6b7280', bg: '#f3f4f6' };
            return `<span style="
              display:inline-flex;align-items:center;gap:5px;
              background:${colors.bg};color:${colors.color};
              font-size:12px;font-weight:700;padding:3px 10px;
              border-radius:20px;border:1.5px solid ${colors.color}33;
            ">${m.assoliment}${m.titol ? ` <span style="font-weight:400;opacity:.75;">· ${m.titol}</span>` : ''}</span>`;
          });
        if (badges.length > 0) {
          assolamentsHTML = `
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">
              ${badges.join('')}
            </div>`;
        }
      }
    }
  } catch(e) { /* silenci si no hi ha metadades */ }

  grid.innerHTML = `
    <div class="comment-card">
      <div class="comment-card-header">
        <span class="comment-card-name">💬 ${nom}</span>
      </div>
      ${assolamentsHTML}
      <div id="commentDisplayText" class="comment-text ${!comentari.trim() ? 'empty' : ''}">
        ${comentari.trim() || 'Cap comentari. Fes clic a un botó per crear-ne un.'}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">
        <button id="btnEditComment" class="btn-outline btn-sm">✏️ Editar</button>
        <button id="btnGenCommentIA" class="btn-tutoria btn-sm">🤖 Comentari IA</button>
        <button id="btnOpenUltra" class="btn-sm" style="background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-weight:600;">⚡ Ultracomentator</button>
      </div>
    </div>
  `;

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

/* ══════════════════════════════════════
   COMMENTS MODAL
══════════════════════════════════════ */
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
  const text = document.getElementById('commentTextarea').value.trim();
  try {
    await db.collection('alumnes').doc(currentCommentStudent.id).update({ comentari: text });
    closeModal('modalComments');
    // Refresc immediat del panell dret sense recàrrega completa
    showStudentComment(currentCommentStudent.id, currentCommentStudent.nom, text);
    // Actualitzar el punt verd de l'alumne a la llista sense reload complet
    const li = document.querySelector(`#studentsList li[data-id="${currentCommentStudent.id}"]`);
    if (li) {
      const dot = li.querySelector('.student-comment-dot');
      if (text && !dot) {
        const nameSpan = li.querySelector('.student-name');
        const newDot = document.createElement('span');
        newDot.className = 'student-comment-dot';
        newDot.title = 'Té comentari';
        nameSpan?.after(newDot);
      } else if (!text && dot) {
        dot.remove();
      }
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
    await db.collection('alumnes').doc(currentCommentStudent.id).update({ comentari: text });
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
      // Compatibilitat: camp nou (comentari) o camp antic per classe (comentarios.classId)
      const comentariText = data.comentari || data.comentarios?.[currentClassId] || '';
      const metadades = data.comentarisItems?.[currentClassId] || [];
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
  // Refresc immediat del panell dret
  if (currentCommentStudent?.id === studentId) {
    showStudentComment(studentId, currentCommentStudent.nom, text);
  }
  // Actualitzar dot a la llista sense recarregar tot
  const li = document.querySelector(`#studentsList li[data-id="${studentId}"]`);
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
};
