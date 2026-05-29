/**
 * main.js — Controlador principal de BeatPulse
 *
 * Responsabilitats:
 *  - Càrrega i desat de configuració (storage.js)
 *  - Gestió del loop de beat amb precisió (Web Audio API clock)
 *  - Sincronització entre UI, sketch p5.js i funcionalitats natives
 *  - Panel de configuració ⚙️
 */

import { createSketch }                    from './sketch.js';
import { loadConfig, saveConfig }          from './storage.js';
import { triggerVibration, triggerTorchFlash } from './native.js';

// ============================================================
// ESTAT DE L'APP
// ============================================================

const app = {
  bpm:               120,
  mode:              'visual',   // visual | vibration | torch | all
  vibrationEnabled:  false,
  torchEnabled:      false,
  visualMode:        'neon',
  particleIntensity: 5,
  isRunning:         false,
  sketch:            null,
};

// Web Audio context per al scheduler precís
let audioCtx        = null;
let schedulerTimer  = null;
let nextBeatTime    = 0;
const LOOKAHEAD_MS  = 25;   // interval del scheduler en ms
const SCHEDULE_AHEAD = 0.1; // finestra d'anticipació en segons

// ============================================================
// REFERÈNCIES DOM
// ============================================================

const dom = {
  bpmNumber:        document.getElementById('bpm-number'),
  bpmSlider:        document.getElementById('bpm-slider'),
  bpmDown:          document.getElementById('bpm-down'),
  bpmUp:            document.getElementById('bpm-up'),
  startStopBtn:     document.getElementById('start-stop-btn'),
  modeButtons:      document.querySelectorAll('.mode-btn'),
  settingsBtn:      document.getElementById('settings-btn'),
  settingsPanel:    document.getElementById('settings-panel'),
  settingsClose:    document.getElementById('settings-close'),
  settingsBpm:      document.getElementById('settings-bpm'),
  visualModeSelect: document.getElementById('visual-mode-select'),
  vibrationToggle:  document.getElementById('vibration-toggle'),
  torchToggle:      document.getElementById('torch-toggle'),
  particleIntensity:document.getElementById('particle-intensity'),
  particleValue:    document.getElementById('particle-value'),
  canvasContainer:  document.getElementById('canvas-container'),
};

// ============================================================
// INICIALITZACIÓ
// ============================================================

async function init() {
  // 1. Carregar configuració desada
  const config = await loadConfig();
  applyConfig(config);

  // 2. Crear el sketch p5.js (ho diferim un frame per tenir layout calculat)
  requestAnimationFrame(() => {
    app.sketch = createSketch(dom.canvasContainer);
    app.sketch.setVisualMode(app.visualMode);
    app.sketch.setParticleIntensity(app.particleIntensity);
    app.sketch.setBpm(app.bpm);
  });

  // 3. Connectar tots els events de la UI
  wireEvents();

  // 4. Sincronitzar la UI amb l'estat carregat
  syncUI();
}

function applyConfig(config) {
  app.bpm               = clampBpm(config.bpm);
  app.mode              = config.mode;
  app.vibrationEnabled  = config.vibrationEnabled;
  app.torchEnabled      = config.torchEnabled;
  app.visualMode        = config.visualMode;
  app.particleIntensity = config.particleIntensity;
}

function syncUI() {
  dom.bpmNumber.textContent         = app.bpm;
  dom.bpmSlider.value               = app.bpm;
  dom.settingsBpm.value             = app.bpm;
  dom.visualModeSelect.value        = app.visualMode;
  dom.vibrationToggle.checked       = app.vibrationEnabled;
  dom.torchToggle.checked           = app.torchEnabled;
  dom.particleIntensity.value       = app.particleIntensity;
  dom.particleValue.textContent     = app.particleIntensity;

  dom.modeButtons.forEach(btn =>
    btn.classList.toggle('active', btn.dataset.mode === app.mode)
  );

  document.documentElement.dataset.visualMode = app.visualMode;
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function wireEvents() {
  // BPM: slider principal
  dom.bpmSlider.addEventListener('input', e => setBpm(parseInt(e.target.value)));

  // BPM: botons +/-
  dom.bpmDown.addEventListener('click', () => setBpm(app.bpm - 1));
  dom.bpmUp.addEventListener('click',   () => setBpm(app.bpm + 1));

  // BPM: input numèric al panell
  dom.settingsBpm.addEventListener('change', e => {
    const v = parseInt(e.target.value);
    if (!isNaN(v)) setBpm(v);
  });

  // Botons de mode
  dom.modeButtons.forEach(btn =>
    btn.addEventListener('click', () => setMode(btn.dataset.mode))
  );

  // Start / Stop
  dom.startStopBtn.addEventListener('click', toggleStartStop);

  // Panell de configuració
  dom.settingsBtn.addEventListener('click', () => setSettingsOpen(true));
  dom.settingsClose.addEventListener('click', () => setSettingsOpen(false));
  dom.settingsPanel.addEventListener('click', e => {
    if (e.target === dom.settingsPanel) setSettingsOpen(false);
  });

  // Mode visual
  dom.visualModeSelect.addEventListener('change', e => {
    app.visualMode = e.target.value;
    document.documentElement.dataset.visualMode = app.visualMode;
    app.sketch?.setVisualMode(app.visualMode);
    saveCurrentConfig();
  });

  // Vibració
  dom.vibrationToggle.addEventListener('change', e => {
    app.vibrationEnabled = e.target.checked;
    updateModeFromToggles();
    saveCurrentConfig();
  });

  // Llanterna
  dom.torchToggle.addEventListener('change', e => {
    app.torchEnabled = e.target.checked;
    updateModeFromToggles();
    saveCurrentConfig();
  });

  // Intensitat de partícules
  dom.particleIntensity.addEventListener('input', e => {
    app.particleIntensity = parseInt(e.target.value);
    dom.particleValue.textContent = app.particleIntensity;
    app.sketch?.setParticleIntensity(app.particleIntensity);
    saveCurrentConfig();
  });
}

// ============================================================
// LÒGICA DE CONTROLS
// ============================================================

function setBpm(value) {
  app.bpm = clampBpm(value);
  dom.bpmNumber.textContent = app.bpm;
  dom.bpmSlider.value       = app.bpm;
  dom.settingsBpm.value     = app.bpm;
  app.sketch?.setBpm(app.bpm);

  // Si el metrònomo corre, reinicia el scheduler amb el nou tempo
  if (app.isRunning) {
    stopScheduler();
    startScheduler();
  }
  saveCurrentConfig();
}

function setMode(mode) {
  app.mode = mode;

  switch (mode) {
    case 'visual':
      app.vibrationEnabled = false;
      app.torchEnabled     = false;
      break;
    case 'vibration':
      app.vibrationEnabled = true;
      app.torchEnabled     = false;
      break;
    case 'torch':
      app.vibrationEnabled = false;
      app.torchEnabled     = true;
      break;
    case 'all':
      app.vibrationEnabled = true;
      app.torchEnabled     = true;
      break;
  }

  dom.modeButtons.forEach(btn =>
    btn.classList.toggle('active', btn.dataset.mode === mode)
  );
  dom.vibrationToggle.checked = app.vibrationEnabled;
  dom.torchToggle.checked     = app.torchEnabled;
  saveCurrentConfig();
}

/** Sincronitza el mode quan l'usuari canvia els toggles manualment */
function updateModeFromToggles() {
  if (app.vibrationEnabled && app.torchEnabled) {
    app.mode = 'all';
  } else if (app.vibrationEnabled) {
    app.mode = 'vibration';
  } else if (app.torchEnabled) {
    app.mode = 'torch';
  } else {
    app.mode = 'visual';
  }
  dom.modeButtons.forEach(btn =>
    btn.classList.toggle('active', btn.dataset.mode === app.mode)
  );
}

function toggleStartStop() {
  if (app.isRunning) {
    stopApp();
  } else {
    startApp();
  }
}

function startApp() {
  // AudioContext ha d'iniciar-se dins d'un gest d'usuari (requisit dels navegadors)
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();

  app.isRunning = true;
  dom.startStopBtn.textContent = 'STOP';
  dom.startStopBtn.classList.add('running');
  app.sketch?.setActive(true);
  startScheduler();
}

function stopApp() {
  app.isRunning = false;
  dom.startStopBtn.textContent = 'START';
  dom.startStopBtn.classList.remove('running');
  app.sketch?.setActive(false);
  stopScheduler();
}

// ============================================================
// SCHEDULER PRECÍS (Web Audio Clock + setTimeout lookahead)
// ============================================================
// Aquesta tècnica (Chris Wilson, 2013) combina la precisió del clock
// d'àudio amb la flexibilitat de setTimeout per evitar jitter.

function startScheduler() {
  nextBeatTime   = audioCtx.currentTime;
  schedulerTimer = setInterval(tickScheduler, LOOKAHEAD_MS);
}

function stopScheduler() {
  clearInterval(schedulerTimer);
  schedulerTimer = null;
}

function tickScheduler() {
  const interval = 60 / app.bpm; // temps en segons entre beats
  while (nextBeatTime < audioCtx.currentTime + SCHEDULE_AHEAD) {
    scheduleOneBeat(nextBeatTime);
    nextBeatTime += interval;
  }
}

function scheduleOneBeat(beatTime) {
  const delayMs = Math.max(0, (beatTime - audioCtx.currentTime) * 1000);
  setTimeout(onBeat, delayMs);
}

/** S'executa a cada beat amb precisió de clock d'àudio */
function onBeat() {
  if (!app.isRunning) return;

  // Visual
  app.sketch?.triggerBeat();

  // Flash visual al número BPM
  flashBpmNumber();

  // Natives
  if (app.vibrationEnabled) triggerVibration();
  if (app.torchEnabled)     triggerTorchFlash(140);
}

function flashBpmNumber() {
  dom.bpmNumber.classList.remove('bpm-number--running');
  // Forçar reflow per reiniciar l'animació CSS
  void dom.bpmNumber.offsetWidth;
  dom.bpmNumber.classList.add('bpm-number--running');
}

// ============================================================
// PANELL DE CONFIGURACIÓ
// ============================================================

function setSettingsOpen(open) {
  dom.settingsPanel.classList.toggle('hidden', !open);
}

// ============================================================
// DESAT DE CONFIGURACIÓ
// ============================================================

function saveCurrentConfig() {
  saveConfig({
    bpm:               app.bpm,
    mode:              app.mode,
    vibrationEnabled:  app.vibrationEnabled,
    torchEnabled:      app.torchEnabled,
    visualMode:        app.visualMode,
    particleIntensity: app.particleIntensity,
  });
}

// ============================================================
// UTILITATS
// ============================================================

function clampBpm(v) {
  return Math.max(40, Math.min(240, Math.round(v) || 120));
}

// ============================================================
// ARRENCADA
// ============================================================

init();
