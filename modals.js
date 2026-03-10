// modals.js — Compatibility shim
// tutoria.js i classroom-ui.js l'importen

export function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('hidden'); }
  else { window.openModal?.(id); }
}

export function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('hidden'); }
  else { window.closeModal?.(id); }
}

export function confirmAction(title, msg, cb) {
  if (window.confirmAction) { window.confirmAction(title, msg, cb); return; }
  if (confirm(msg)) cb();
}
