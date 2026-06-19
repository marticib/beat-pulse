// storage.js - Gestio de l'emmagatzematge persistent
//
// Faig servir Capacitor Preferences quan corro en un dispositiu real.
// Si falla (per exemple, al navegador web), cau a localStorage com a pla B.

import { Preferences } from '@capacitor/preferences';

const CONFIG_KEY = 'beatpulse_config';
const ARTIST_KEY = 'beatpulse_artist';

// Valors que s'usen la primera vegada que s'obre l'app (sense config guardada)
const DEFAULTS = {
  bpm:               120,
  mode:              'visual',
  vibrationEnabled:  false,
  torchEnabled:      false,
  visualMode:        'neon',
  particleIntensity: 5,
};

// Guarda la configuracio actual. Rep un objecte amb els camps que volem desar.
export async function saveConfig(config) {
  const data = JSON.stringify(config);
  try {
    await Preferences.set({ key: CONFIG_KEY, value: data });
  } catch {
    try { localStorage.setItem(CONFIG_KEY, data); } catch { /* silent */ }
  }
}

// Carrega la configuracio guardada. Si no n'hi ha, retorna els valors per defecte.
export async function loadConfig() {
  try {
    const { value } = await Preferences.get({ key: CONFIG_KEY });
    if (value) return { ...DEFAULTS, ...JSON.parse(value) };
  } catch {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* silent */ }
  }
  return { ...DEFAULTS };
}

// Guarda les dades de l'ultim artista consultat per recuperar-les en obrir l'app.
export async function saveArtist(artistData) {
  const data = JSON.stringify(artistData);
  try {
    await Preferences.set({ key: ARTIST_KEY, value: data });
  } catch {
    try { localStorage.setItem(ARTIST_KEY, data); } catch { /* silent */ }
  }
}

// Carrega l'ultim artista consultat. Retorna null si no n'hi ha cap.
export async function loadArtist() {
  try {
    const { value } = await Preferences.get({ key: ARTIST_KEY });
    if (value) return JSON.parse(value);
  } catch {
    try {
      const raw = localStorage.getItem(ARTIST_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* silent */ }
  }
  return null;
}

// Esborra la configuracio guardada. Util per fer proves.
export async function clearConfig() {
  try {
    await Preferences.remove({ key: CONFIG_KEY });
  } catch {
    try { localStorage.removeItem(CONFIG_KEY); } catch { /* silent */ }
  }
}
