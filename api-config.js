// api-config.js — ComentaIA
// Crida el backend /api/tutoria (Vercel serverless function)
// La clau d'Anthropic es configura a Vercel com a variable d'entorn: ANTHROPIC_API_KEY
// Mai exposar la clau al codi del client.

window.callTutoriaAPI = async function(prompt) {
  const response = await fetch('/api/tutoria', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Error API: ${response.status}`);
  }

  const data = await response.json();
  return { text: data.text || '' };
};
