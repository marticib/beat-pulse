// native.js - Funcions per accedir al hardware del dispositiu
//
// Vibració: faig servir @capacitor/haptics, que ja esta instal·lat.
// Llanterna: el codi esta preparat pero comentat perque no he trobat
//            un plugin de Capacitor prou estable per incloure'l per defecte.
//            Quan en tingui un, nomes cal descomentar les linies marcades.

import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Fa vibrar el dispositiu un moment. En el navegador fa servir navigator.vibrate() com a alternativa.
export async function triggerVibration() {
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    if ('vibrate' in navigator) {
      navigator.vibrate(60);
    }
  }
}

// Fa un flash de llanterna de la durada indicada (en ms).
//
// Per activar-ho amb un plugin real cal:
//   1. Trobar un plugin de Capacitor per a la llanterna i instal·lar-lo
//      (per exemple: npm install @capawesome/capacitor-flashlight)
//   2. Fer npx cap sync android (o ios)
//   3. A android/app/src/main/AndroidManifest.xml afegir:
//         <uses-permission android:name="android.permission.FLASHLIGHT"/>
//   4. Descomentar l'import de sota i el cos de la funcio
//
// import { Flashlight } from '@capawesome/capacitor-flashlight';

export async function triggerTorchFlash(durationMs = 150) {
  // Quan el plugin estigui instal·lat, substituir per:
  //
  // try {
  //   await Flashlight.enable();
  //   setTimeout(async () => {
  //     try { await Flashlight.disable(); } catch { /* silent */ }
  //   }, durationMs);
  // } catch (err) {
  //   console.warn('Llanterna no disponible:', err.message);
  // }

  console.debug(`[BeatPulse] Torch flash ${durationMs}ms (plugin pendent d'integrar)`);
}
