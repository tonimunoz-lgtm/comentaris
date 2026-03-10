// api-config.js — ComentaIA
// Substitueix les crides a /api/tutoria per crides directes a Anthropic
// Inclou la clau API aquí (app privada/interna) o usa una variable d'entorn
//
// ⚠️  IMPORTANT: Si fas servir Firebase Hosting o Vercel, posa la clau
//     a les variables d'entorn i canvia ANTHROPIC_API_KEY per:
//     window.ANTHROPIC_API_KEY = "la-teva-clau"
//     des del teu sistema de desplegament.
//
// Per ara: posa la clau directament aquí per fer-ho funcionar.
// La clau es pot trobar a: https://console.anthropic.com/settings/keys

window.ANTHROPIC_API_KEY = ""; // ← POSA AQUÍ LA TEVA CLAU API D'ANTHROPIC

// Funció global per cridar la IA — usada per tutoria.js, tutoria-comentaris.js i ultracomentator.js
window.callTutoriaAPI = async function(prompt) {
  const apiKey = window.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('No hi ha clau API configurada. Edita api-config.js i afegeix la teva clau d\'Anthropic.');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error API: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  return { text };
};
