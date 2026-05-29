/**
 * storage.js — Capa d'emmagatzematge persistent
 *
 * Utilitza @capacitor/preferences quan s'executa en dispositiu Android.
 * En navegador web fa servir localStorage com a fallback automàtic
 * (Capacitor ja ho gestiona internament, però afegim el try/catch
 * per robustesa en entorns sense Capacitor inicialitzat).
 */

import { Preferences } from '@capacitor/preferences';

const KEY = 'beatpulse_config';

/** Configuració per defecte de l'app */
const DEFAULTS = {
  bpm:               120,
  mode:              'visual',
  vibrationEnabled:  false,
  torchEnabled:      false,
  visualMode:        'neon',
  particleIntensity: 5,
};

/**
 * Desa la configuració de l'app.
 * @param {object} config — Objecte de configuració parcial o total
 */
export async function saveConfig(config) {
  const data = JSON.stringify(config);
  try {
    await Preferences.set({ key: KEY, value: data });
  } catch {
    // Fallback: localStorage per entorn web sense Capacitor
    try { localStorage.setItem(KEY, data); } catch { /* silent */ }
  }
}

/**
 * Carrega la configuració desada.
 * Retorna els valors per defecte si no hi ha res desat.
 * @returns {Promise<object>}
 */
export async function loadConfig() {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) return { ...DEFAULTS, ...JSON.parse(value) };
  } catch {
    // Fallback: localStorage
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* silent */ }
  }
  return { ...DEFAULTS };
}

/**
 * Esborra tota la configuració desada (útil per depurar).
 */
export async function clearConfig() {
  try {
    await Preferences.remove({ key: KEY });
  } catch {
    try { localStorage.removeItem(KEY); } catch { /* silent */ }
  }
}
