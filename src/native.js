// native.js - Funcions per accedir al hardware del dispositiu
//
// Vibració: @capacitor/haptics, ja instal·lat.
// Llanterna: faig servir l'API estandard MediaDevices.getUserMedia() amb
//            la constraint { torch: true }. Funciona al WebView d'Android
//            sense necessitat de cap plugin extern. A iOS esta limitada
//            per Apple i pot no funcionar.

import { Haptics, ImpactStyle } from '@capacitor/haptics';

// ---------------------------------------------------------------------------
// VIBRACIÓ
// ---------------------------------------------------------------------------

// Fa vibrar el dispositiu un moment. En el navegador fa servir navigator.vibrate().
export async function triggerVibration() {
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    if ('vibrate' in navigator) {
      navigator.vibrate(60);
    }
  }
}

// ---------------------------------------------------------------------------
// LLANTERNA via MediaDevices API
// ---------------------------------------------------------------------------
// Guardo el track de la camera obert per no obrir-ne un de nou a cada beat.
// Aixi evito el retard i el consum de reiniciar la camera continuament.

let torchTrack  = null;
let torchStream = null;
let flashTimer  = null;

// Demana acces a la camera trasera i comprova si te suport de torxa.
// Retorna el track si esta disponible, o null si no.
async function getTorchTrack() {
  if (torchTrack) return torchTrack;

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
  });

  const track = stream.getVideoTracks()[0];
  const caps  = track.getCapabilities?.() ?? {};

  if (!caps.torch) {
    // El dispositiu no suporta torch per aquesta via
    stream.getTracks().forEach(t => t.stop());
    return null;
  }

  torchStream = stream;
  torchTrack  = track;
  return track;
}

// Encen la llanterna durant durationMs i l'apaga.
// La primera crida demana permis de camera al dispositiu.
export async function triggerTorchFlash(durationMs = 150) {
  try {
    const track = await getTorchTrack();
    if (!track) return;

    // Cancel·lo el timer anterior per si el beat anterior no havia acabat
    clearTimeout(flashTimer);

    await track.applyConstraints({ advanced: [{ torch: true }] });

    flashTimer = setTimeout(async () => {
      try {
        await track.applyConstraints({ advanced: [{ torch: false }] });
      } catch { /* silent */ }
    }, durationMs);

  } catch (err) {
    console.warn('[BeatPulse] Llanterna no disponible:', err.message);
    // Resetejo l'estat per intentar-ho de nou la propera vegada
    torchTrack  = null;
    torchStream = null;
  }
}

// Allibera la camera quan l'app s'atura.
// Cal cridar-ho des de main.js al fer Stop.
export function releaseTorch() {
  clearTimeout(flashTimer);
  if (torchTrack) {
    try { torchTrack.applyConstraints({ advanced: [{ torch: false }] }); } catch {}
  }
  if (torchStream) {
    torchStream.getTracks().forEach(t => t.stop());
  }
  torchTrack  = null;
  torchStream = null;
  flashTimer  = null;
}
