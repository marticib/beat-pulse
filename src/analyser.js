// analyser.js - Detecció offline de BPM + sincronització de beats
//
// Estratègia en dos passos (evita tots els problemes de CORS):
//  1. analyzeTrackBpm(url) → fetch independent, aplica filtre passa-baixos per aïllar
//     el bombo/baix (0-200 Hz), detecta timestamps de beats offline
//  2. BeatAnalyser.start(beatTimes, bpm) → loop rAF compara audio.currentTime amb cada
//     timestamp i dispara l'efecte visual/vibració/llanterna en el moment exacte

export async function analyzeTrackBpm(url) {
  let arrayBuf;
  try {
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) return null;
    arrayBuf = await resp.arrayBuffer();
  } catch {
    return null;
  }

  const tempCtx = new AudioContext();
  let decoded;
  try {
    decoded = await tempCtx.decodeAudioData(arrayBuf);
  } catch {
    return null;
  } finally {
    tempCtx.close();
  }

  return detectBeats(decoded);
}

// Filtre IIR passa-baixos de primer ordre (equivalent a un circuit RC).
// Conserva freqüències < cutoffHz i atenua la resta.
// Necessari per centrar la detecció en el bombo (20-200 Hz) i ignorar
// snare/hi-hat que causarien falsos positius al doble del tempo real.
function lowPassFilter(data, cutoffHz, sampleRate) {
  const alpha = 1 / (1 + sampleRate / (2 * Math.PI * cutoffHz));
  const out   = new Float32Array(data.length);
  out[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    out[i] = out[i - 1] + alpha * (data[i] - out[i - 1]);
  }
  return out;
}

// Detecció d'energia RMS sobre la senyal filtrada, amb threshold adaptatiu
function detectBeats(buffer) {
  const raw = buffer.getChannelData(0);
  const sr  = buffer.sampleRate;

  // Filtrem a 200 Hz per quedar-nos amb el bombo/baix
  const ch  = lowPassFilter(raw, 200, sr);
  const hop = Math.floor(sr * 0.05);  // salt de 50 ms entre mesures
  const win = Math.floor(sr * 0.10);  // finestra de 100 ms per a cada mesura

  const energies = [];
  for (let i = 0; i + win < ch.length; i += hop) {
    let e = 0;
    for (let j = 0; j < win; j++) e += ch[i + j] ** 2;
    energies.push({ time: i / sr, rms: Math.sqrt(e / win) });
  }

  const history   = [];
  const beatTimes = [];
  let lastBeat    = -1;

  for (const { time, rms } of energies) {
    history.push(rms);
    if (history.length > 43) history.shift(); // finestra de ~2 s

    const avg = history.reduce((a, b) => a + b, 0) / history.length;

    // Beat: energia ≥ 1.5× la mitja local, llindar mínim, debounce 300 ms
    if (rms > avg * 1.5 && rms > 0.0008 && time - lastBeat > 0.3) {
      beatTimes.push(time);
      lastBeat = time;
    }
  }

  if (beatTimes.length < 3) return null;

  let totalInterval = 0;
  for (let i = 1; i < beatTimes.length; i++) totalInterval += beatTimes[i] - beatTimes[i - 1];
  const bpm = Math.round(60 / (totalInterval / (beatTimes.length - 1)));

  return { bpm: Math.max(40, Math.min(240, bpm)), beatTimes };
}

export class BeatAnalyser {
  #audioEl;
  #onBeat;
  #onBpmUpdate;
  #rafId     = null;
  #beatTimes = [];
  #nextIdx   = 0;

  constructor(audioEl, onBeat, onBpmUpdate) {
    this.#audioEl     = audioEl;
    this.#onBeat      = onBeat;
    this.#onBpmUpdate = onBpmUpdate;
  }

  start(beatTimes, bpm) {
    this.#beatTimes = beatTimes;
    // Saltem els beats que ja han passat (l'àudio pot portar uns instants reproduint-se
    // mentre esperàvem que l'anàlisi acabés) per evitar un burst de beats simultanis
    const t = this.#audioEl.currentTime;
    const firstUpcoming = beatTimes.findIndex(bt => bt > t);
    this.#nextIdx = firstUpcoming >= 0 ? firstUpcoming : beatTimes.length;
    this.#onBpmUpdate(bpm);
    this.#loop();
  }

  stop() {
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }

  #loop() {
    this.#rafId = requestAnimationFrame(() => {
      if (!this.#audioEl.paused) {
        const t = this.#audioEl.currentTime;
        // 25 ms de lookahead per compensar el lag de requestAnimationFrame
        while (
          this.#nextIdx < this.#beatTimes.length &&
          t >= this.#beatTimes[this.#nextIdx] - 0.025
        ) {
          this.#onBeat();
          this.#nextIdx++;
        }
      }
      if (this.#nextIdx < this.#beatTimes.length) this.#loop();
    });
  }
}
