// storage.js - Gestio de l'emmagatzematge persistent
//
// Faig servir Capacitor Preferences quan corro en un dispositiu real.
// Si falla (per exemple, al navegador web), cau a localStorage com a pla B.

import { Preferences } from '@capacitor/preferences';

const KEY = 'beatpulse_config';

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
    await Preferences.set({ key: KEY, value: data });
  } catch {
    // Si Capacitor no esta disponible, guardo a localStorage
    try { localStorage.setItem(KEY, data); } catch { /* silent */ }
  }
}

// Carrega la configuracio guardada. Si no n'hi ha, retorna els valors per defecte.
export async function loadConfig() {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) return { ...DEFAULTS, ...JSON.parse(value) };
  } catch {
    // Intento amb localStorage si Capacitor falla
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* silent */ }
  }
  return { ...DEFAULTS };
}

// Esborra la configuracio guardada. Util per fer proves.
export async function clearConfig() {
  try {
    await Preferences.remove({ key: KEY });
  } catch {
    try { localStorage.removeItem(KEY); } catch { /* silent */ }
  }
}
