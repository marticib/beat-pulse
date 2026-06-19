// native.js - Funcions per accedir al hardware del dispositiu
//
// Vibració: @capacitor/haptics
// Llanterna: @capgo/capacitor-flash (crida nativa Android/iOS via CameraManager)

import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { CapacitorFlash }       from '@capgo/capacitor-flash';

// ---------------------------------------------------------------------------
// VIBRACIÓ
// ---------------------------------------------------------------------------

export async function triggerVibration() {
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
    console.log('[Vibració] Haptics.impact OK');
  } catch (err) {
    console.warn('[Vibració] Haptics falla, fallback navigator.vibrate:', err.message);
    if ('vibrate' in navigator) {
      navigator.vibrate(60);
      console.log('[Vibració] navigator.vibrate(60) cridat');
    } else {
      console.warn('[Vibració] navigator.vibrate no disponible');
    }
  }
}

// ---------------------------------------------------------------------------
// LLANTERNA via @capgo/capacitor-flash
// ---------------------------------------------------------------------------

let flashTimer    = null;
let torchChecked  = false;
let torchOk       = false;

async function ensureTorchAvailable() {
  if (torchChecked) return torchOk;
  torchChecked = true;
  try {
    const { value } = await CapacitorFlash.isAvailable();
    torchOk = value;
    console.log(torchOk ? '[Llanterna] disponible OK' : '[Llanterna] no disponible en aquest dispositiu');
  } catch (err) {
    torchOk = false;
    console.warn('[Llanterna] error comprovant disponibilitat:', err.message);
  }
  return torchOk;
}

export async function triggerTorchFlash(durationMs = 150) {
  if (!(await ensureTorchAvailable())) return;

  try {
    clearTimeout(flashTimer);
    await CapacitorFlash.switchOn({ intensity: 1.0 });
    console.log(`[Llanterna] ON → OFF en ${durationMs}ms`);

    flashTimer = setTimeout(async () => {
      try { await CapacitorFlash.switchOff(); } catch { /* silent */ }
    }, durationMs);

  } catch (err) {
    console.warn('[Llanterna] error:', err.message);
  }
}

export async function releaseTorch() {
  clearTimeout(flashTimer);
  flashTimer = null;
  try { await CapacitorFlash.switchOff(); } catch { /* silent */ }
}
