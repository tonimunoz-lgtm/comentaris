// classroom-ui.js — ComentaIA
// Gestió importació Google Classroom (adaptat)

import { initClassroomAPI, getClassroomCourses, importClassroomCourse } from './classroom.js';

let selectedCourses = [];
let currentProfessorUID = null;
let currentDB = null;

const CLASSROOM_CLIENT_ID = "324570393360-2ib4925pbobfbggu8t0nnj14q5n414nv.apps.googleusercontent.com";

console.log('✅ classroom-ui.js carregat');

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  monitorAuthState();
  setupImportListener();
  setupClassroomButton();
});

function monitorAuthState() {
  const checkAuth = () => {
    const auth = window.firebase?.auth?.();
    if (auth) {
      auth.onAuthStateChanged(user => {
        if (user) {
          currentProfessorUID = user.uid;
          currentDB = window.firebase.firestore();
        } else {
          currentProfessorUID = null;
          currentDB = null;
        }
      });
    } else { setTimeout(checkAuth, 500); }
  };
  checkAuth();
}

function setupClassroomButton() {
  const btn = document.getElementById('btnImportClassroom');
  if (!btn) { setTimeout(setupClassroomButton, 400); return; }
  btn.addEventListener('click', async () => {
    if (!currentProfessorUID) return alert('Necessites iniciar sessió primer');
    await openClassroomImportModal();
  });
}

async function openClassroomImportModal() {
  if (!currentDB || !currentProfessorUID) return alert('Inicia sessió primer');
  window.openModal('modalClassroomImport');
  try {
    await initClassroomAPI();
    await loadClassroomCourses();
  } catch (err) {
    showClassroomError('Error inicialitzant Google Classroom: ' + (err.message || err));
  }
}

async function loadClassroomCourses() {
  const loading  = document.getElementById('classroomLoadingState');
  const list     = document.getElementById('classroomCoursesList');
  const errDiv   = document.getElementById('classroomErrorState');
  const importBtn = document.getElementById('btnImportSelectedCourse');

  loading.classList.remove('hidden');
  list.classList.add('hidden');
  errDiv.classList.add('hidden');
  selectedCourses = [];
  importBtn.disabled = true;

  try {
    const courses = await getClassroomCourses();
    if (!courses.length) { showClassroomError('No s\'han trobat cursos actius a Google Classroom.'); return; }

    list.innerHTML = '';
    courses.forEach(course => {
      const item = document.createElement('div');
      item.className = 'classroom-course-item';
      item.innerHTML = `
        <input type="checkbox" class="delete-checkbox" value="${course.id}" />
        <div>
          <div class="classroom-course-name">${escapeHtml(course.name)}</div>
          <div class="classroom-course-section">${escapeHtml(course.section || course.descriptionHeading || '')}</div>
        </div>
      `;
      const chk = item.querySelector('input');
      chk.addEventListener('change', () => {
        if (chk.checked) selectedCourses.push(course);
        else selectedCourses = selectedCourses.filter(c => c.id !== course.id);
        importBtn.disabled = !selectedCourses.length;
        item.classList.toggle('selected', chk.checked);
      });
      item.addEventListener('click', e => { if (e.target !== chk) { chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); } });
      list.appendChild(item);
    });

    loading.classList.add('hidden');
    list.classList.remove('hidden');
  } catch (err) {
    showClassroomError(err.message);
  }
}

function showClassroomError(msg) {
  document.getElementById('classroomErrorState').innerHTML = `❌ ${escapeHtml(msg)}`;
  document.getElementById('classroomErrorState').classList.remove('hidden');
  document.getElementById('classroomLoadingState').classList.add('hidden');
  document.getElementById('classroomCoursesList').classList.add('hidden');
}

function setupImportListener() {
  const btn = document.getElementById('btnImportSelectedCourse');
  if (!btn || btn._ready) { if (!btn) setTimeout(setupImportListener, 500); return; }
  btn._ready = true;

  btn.addEventListener('click', async () => {
    if (!selectedCourses.length) return alert('Selecciona almenys un curs');
    if (!currentDB || !currentProfessorUID) return alert('Inicia sessió primer');

    btn.disabled = true;
    btn.textContent = '⏳ Important...';

    const prog = document.createElement('div');
    prog.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    prog.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:40px;text-align:center;max-width:360px;width:90%;">
        <div class="spinner" style="margin:0 auto 16px;"></div>
        <div style="font-weight:700;font-size:16px;margin-bottom:8px;" id="progTitle">Important...</div>
        <div style="font-size:13px;color:#6b7280;" id="progSub">Carregant alumnes...</div>
        <div style="background:#f3f4f6;border-radius:99px;height:6px;margin-top:16px;overflow:hidden;">
          <div id="progBar" style="background:var(--accent);height:100%;width:0%;transition:width .3s;"></div>
        </div>
      </div>`;
    document.body.appendChild(prog);

    try {
      for (let i = 0; i < selectedCourses.length; i++) {
        const course = selectedCourses[i];
        prog.querySelector('#progSub').textContent = course.name;
        prog.querySelector('#progBar').style.width = ((i + 1) / selectedCourses.length * 100) + '%';
        await importClassroomCourse(course, currentDB, currentProfessorUID);
      }
      prog.querySelector('#progTitle').textContent = '✅ Completat!';
      setTimeout(() => {
        prog.remove();
        alert('✅ Cursos importats correctament!');
        window.closeModal('modalClassroomImport');
        setTimeout(() => location.reload(), 300);
      }, 800);
    } catch (err) {
      prog.remove();
      alert('Error: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Importar seleccionats';
    }
  });
}
