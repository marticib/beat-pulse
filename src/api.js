// api.js - Connexio amb TheAudioDB
// API publica, gratuita i sense API key. Te CORS habilitat.
// Endpoint: https://www.theaudiodb.com/api/v1/json/2/search.php?s=NOM_ARTISTA

const BASE_URL = 'https://www.theaudiodb.com/api/v1/json/2/search.php';

// Busca un artista per nom i retorna l'objecte del primer resultat.
// Llança un Error amb missatge llegible si algo va malament.
export async function searchArtist(name) {
  const trimmed = name?.trim();
  if (!trimmed) throw new Error('Escriu el nom d\'un artista');

  const url = `${BASE_URL}?s=${encodeURIComponent(trimmed)}`;

  let res;
  try {
    res = await fetch(url);
  } catch {
    // Aixo passa quan no hi ha xarxa o la URL es inaccessible
    throw new Error('Error de connexio. Comprova la xarxa.');
  }

  if (!res.ok) throw new Error(`Error del servidor (${res.status})`);

  const data = await res.json();

  // L'API retorna { artists: null } quan no troba res
  if (!data.artists || data.artists.length === 0) {
    throw new Error('Artista no trobat. Prova amb un altre nom.');
  }

  return data.artists[0];
}

// Analitza el genere i estil de l'artista i suggereix un mode visual.
// Retorna 'fire', 'neon', 'minimal' o null si no es pot determinar.
export function detectVisualMode(genre, style) {
  const text = `${genre || ''} ${style || ''}`.toLowerCase();

  if (/rock|metal|punk|grunge|hard rock|alternative|indie|hardcore/.test(text)) return 'fire';
  if (/electronic|dance|house|techno|edm|synth|pop|disco|electro/.test(text))   return 'neon';
  if (/jazz|soul|blues|classical|ambient|folk|acoustic|bossa|r&b/.test(text))   return 'minimal';

  return null;
}

// Retalla la biografia a maxChars caracters sense tallar paraules
export function truncateBio(bio, maxChars = 300) {
  if (!bio || bio.length <= maxChars) return bio || '';
  const cut = bio.substring(0, maxChars);
  return cut.substring(0, cut.lastIndexOf(' ')) + '...';
}

// Normalitza la URL del web de l'artista afegint https:// si no en te
export function normalizeUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

// Busca les cancons d'un artista a iTunes i retorna un array de resultats.
// Cada resultat te: trackName, collectionName, artworkUrl60, previewUrl
// Les previews son de 30 segons i no requereixen autenticacio.
export async function searchTracks(artistName, limit = 10) {
  if (!artistName) return [];

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=song&limit=${limit}`;

  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('No s\'han pogut carregar les cançons.');
  }

  if (!res.ok) throw new Error(`Error iTunes (${res.status})`);

  const data = await res.json();
  // Filtro els que no tenen preview perque no els podem reproduir
  return (data.results || []).filter(t => t.previewUrl);
}
