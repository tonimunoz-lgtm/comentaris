// app-cache.js — Cache en memòria per a dades estables de Firestore
// Redueix lectures repetides de col·leccions que canvien rarament
// (grups_centre, nivells_centre, _sistema/periodes_tancats)
//
// Ús:
//   const grups = await window.fsCache.grups();
//   const periodes = await window.fsCache.periodes();
//   window.fsCache.invalidar(); // cridar quan secretaria modifica dades

console.log('📦 app-cache.js carregat');

window.fsCache = (() => {
  // TTL en mil·lisegons: 10 minuts per a dades estructurals del centre
  const TTL = 10 * 60 * 1000;

  const _cache = {
    grups:    { data: null, ts: 0 },
    nivells:  { data: null, ts: 0 },
    periodes: { data: null, ts: 0 },
  };

  function _vàlid(entry) {
    return entry.data !== null && (Date.now() - entry.ts) < TTL;
  }

  // Tots els grups del centre (grups_centre complet)
  async function grups() {
    if (_vàlid(_cache.grups)) return _cache.grups.data;
    try {
      const snap = await window.db.collection('grups_centre').orderBy('ordre').get();
      _cache.grups.data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _cache.grups.ts   = Date.now();
      return _cache.grups.data;
    } catch (e) {
      // Si falla l'ordre, sense orderBy
      try {
        const snap = await window.db.collection('grups_centre').get();
        _cache.grups.data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _cache.grups.ts   = Date.now();
        return _cache.grups.data;
      } catch (e2) { return []; }
    }
  }

  // Nivells del centre (nivells_centre complet)
  async function nivells() {
    if (_vàlid(_cache.nivells)) return _cache.nivells.data;
    try {
      const snap = await window.db.collection('nivells_centre').orderBy('ordre').get();
      _cache.nivells.data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _cache.nivells.ts   = Date.now();
      return _cache.nivells.data;
    } catch (e) {
      try {
        const snap = await window.db.collection('nivells_centre').get();
        _cache.nivells.data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _cache.nivells.ts   = Date.now();
        return _cache.nivells.data;
      } catch (e2) { return []; }
    }
  }

  // Document _sistema/periodes_tancats
  async function periodes() {
    if (_vàlid(_cache.periodes)) return _cache.periodes.data;
    try {
      const doc = await window.db.collection('_sistema').doc('periodes_tancats').get();
      _cache.periodes.data = doc.exists ? doc.data() : {};
      _cache.periodes.ts   = Date.now();
      return _cache.periodes.data;
    } catch (e) {
      return {};
    }
  }

  // Invalidar el cache (cridar des de secretaria quan es modifiquen dades)
  function invalidar(clau = null) {
    if (clau) {
      if (_cache[clau]) { _cache[clau].data = null; _cache[clau].ts = 0; }
    } else {
      Object.keys(_cache).forEach(k => { _cache[k].data = null; _cache[k].ts = 0; });
    }
    console.log('📦 fsCache invalidat:', clau || 'tot');
  }

  return { grups, nivells, periodes, invalidar };
})();
