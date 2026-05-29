/**
 * native.js — Funcionalitats natives del dispositiu
 *
 * Vibració:  @capacitor/haptics  (inclòs en les dependències)
 * Llanterna: @capawesome/capacitor-flashlight (instal·lació opcional)
 *            → Llegeix la secció TORCH PLUGIN INTEGRATION si vols activar-la
 */

import { Haptics, ImpactStyle } from '@capacitor/haptics';

// ============================================================
// VIBRACIÓ
// ============================================================

/**
 * Dispara una vibració curta amb el ritme del beat.
 * Fa servir Haptics.impact() de Capacitor.
 * En navegador web, fa fallback a l'API navigator.vibrate().
 */
export async function triggerVibration() {
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // Fallback web per a testing al navegador
    if ('vibrate' in navigator) {
      navigator.vibrate(60);
    }
  }
}

// ============================================================
// LLANTERNA (TORCH)
// ============================================================
//
// TORCH PLUGIN INTEGRATION
// ─────────────────────────────────────────────────────────────
// Plugin recomanat: @capawesome/capacitor-flashlight
//
// Per activar-lo completament cal:
//
//   1. npm install @capawesome/capacitor-flashlight
//   2. npx cap sync android
//   3. A android/app/src/main/AndroidManifest.xml, afegir dins <manifest>:
//        <uses-permission android:name="android.permission.FLASHLIGHT"/>
//   4. Descomenta l'import i la implementació a la funció triggerTorchFlash()
//
// Referència: https://capawesome.io/plugins/flashlight/
// ─────────────────────────────────────────────────────────────

// import { Flashlight } from '@capawesome/capacitor-flashlight'; // ← DESCOMENTA AQUÍ

/**
 * Activa la llanterna durant durationMs mil·lisegons i l'apaga.
 * @param {number} durationMs — Durada del flash en ms (per defecte 150ms)
 */
export async function triggerTorchFlash(durationMs = 150) {
  // ── IMPLEMENTACIÓ AMB PLUGIN (descomentar quan estigui instal·lat) ──
  //
  // try {
  //   await Flashlight.enable();
  //   setTimeout(async () => {
  //     try { await Flashlight.disable(); } catch { /* silent */ }
  //   }, durationMs);
  // } catch (err) {
  //   console.warn('[BeatPulse] Llanterna no disponible:', err.message);
  // }
  //
  // ── FI IMPLEMENTACIÓ PLUGIN ──

  // Stub actiu mentre el plugin no està integrat:
  console.debug(`[BeatPulse] Torch flash ${durationMs}ms (plugin pendent d'integrar)`);
}
