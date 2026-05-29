// main.js - Controlador principal de BeatPulse
// Aqui es gestiona tot: la UI, el ritme dels beats i les funcions natives.

import { createSketch }                        from './sketch.js';
import { loadConfig, saveConfig }              from './storage.js';
import { triggerVibration, triggerTorchFlash } from './native.js';

// Dades principals de l'app, les guardo totes juntes per tenir-ho clar
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

// Variables pel scheduler de beats (Web Audio API)
let audioCtx        = null;
let schedulerTimer  = null;
let nextBeatTime    = 0;
const LOOKAHEAD_MS   = 25;   // cada quants ms comprovo si cal llançar un beat
const SCHEDULE_AHEAD = 0.1;  // quants segons d'avantatge preparo

// Totes les referències als elements del DOM
const dom = {
  bpmNumber:         document.getElementById('bpm-number'),
  bpmSlider:         document.getElementById('bpm-slider'),
  bpmDown:           document.getElementById('bpm-down'),
  bpmUp:             document.getElementById('bpm-up'),
  startStopBtn:      document.getElementById('start-stop-btn'),
  modeButtons:       document.querySelectorAll('.mode-btn'),
  settingsBtn:       document.getElementById('settings-btn'),
  settingsPanel:     document.getElementById('settings-panel'),
  settingsClose:     document.getElementById('settings-close'),
  settingsBpm:       document.getElementById('settings-bpm'),
  visualModeSelect:  document.getElementById('visual-mode-select'),
  vibrationToggle:   document.getElementById('vibration-toggle'),
  torchToggle:       document.getElementById('torch-toggle'),
  particleIntensity: document.getElementById('particle-intensity'),
  particleValue:     document.getElementById('particle-value'),
  canvasContainer:   document.getElementById('canvas-container'),
};

// Punt d'entrada: carrega la config guardada i arrenca l'app
async function init() {
  const config = await loadConfig();
  applyConfig(config);

  // Espero un frame per assegurar-me que el layout ja esta calculat
  // abans de crear el canvas de p5.js
  requestAnimationFrame(() => {
    app.sketch = createSketch(dom.canvasContainer);
    app.sketch.setVisualMode(app.visualMode);
    app.sketch.setParticleIntensity(app.particleIntensity);
    app.sketch.setBpm(app.bpm);
  });

  wireEvents();
  syncUI();
}

// Passa els valors de la config carregada a l'objecte app
function applyConfig(config) {
  app.bpm               = clampBpm(config.bpm);
  app.mode              = config.mode;
  app.vibrationEnabled  = config.vibrationEnabled;
  app.torchEnabled      = config.torchEnabled;
  app.visualMode        = config.visualMode;
  app.particleIntensity = config.particleIntensity;
}

// Actualitza tots els elements visuals per reflectir l'estat actual
function syncUI() {
  dom.bpmNumber.textContent     = app.bpm;
  dom.bpmSlider.value           = app.bpm;
  dom.settingsBpm.value         = app.bpm;
  dom.visualModeSelect.value    = app.visualMode;
  dom.vibrationToggle.checked   = app.vibrationEnabled;
  dom.torchToggle.checked       = app.torchEnabled;
  dom.particleIntensity.value   = app.particleIntensity;
  dom.particleValue.textContent = app.particleIntensity;

  dom.modeButtons.forEach(btn =>
    btn.classList.toggle('active', btn.dataset.mode === app.mode)
  );

  document.documentElement.dataset.visualMode = app.visualMode;
}

// Connecta tots els events de la interficie
function wireEvents() {
  dom.bpmSlider.addEventListener('input', e => setBpm(parseInt(e.target.value)));

  dom.bpmDown.addEventListener('click', () => setBpm(app.bpm - 1));
  dom.bpmUp.addEventListener('click',   () => setBpm(app.bpm + 1));

  // El camp numeric del panell de configuracio
  dom.settingsBpm.addEventListener('change', e => {
    const v = parseInt(e.target.value);
    if (!isNaN(v)) setBpm(v);
  });

  dom.modeButtons.forEach(btn =>
    btn.addEventListener('click', () => setMode(btn.dataset.mode))
  );

  dom.startStopBtn.addEventListener('click', toggleStartStop);

  // Obrir i tancar el panell de configuracio
  dom.settingsBtn.addEventListener('click', () => setSettingsOpen(true));
  dom.settingsClose.addEventListener('click', () => setSettingsOpen(false));
  // Clicar fora del panell tambe el tanca
  dom.settingsPanel.addEventListener('click', e => {
    if (e.target === dom.settingsPanel) setSettingsOpen(false);
  });

  dom.visualModeSelect.addEventListener('change', e => {
    app.visualMode = e.target.value;
    document.documentElement.dataset.visualMode = app.visualMode;
    app.sketch?.setVisualMode(app.visualMode);
    saveCurrentConfig();
  });

  dom.vibrationToggle.addEventListener('change', e => {
    app.vibrationEnabled = e.target.checked;
    updateModeFromToggles();
    saveCurrentConfig();
  });

  dom.torchToggle.addEventListener('change', e => {
    app.torchEnabled = e.target.checked;
    updateModeFromToggles();
    saveCurrentConfig();
  });

  dom.particleIntensity.addEventListener('input', e => {
    app.particleIntensity = parseInt(e.target.value);
    dom.particleValue.textContent = app.particleIntensity;
    app.sketch?.setParticleIntensity(app.particleIntensity);
    saveCurrentConfig();
  });
}

// Canvia el BPM i reinicia el scheduler si l'app esta en marxa
function setBpm(value) {
  app.bpm = clampBpm(value);
  dom.bpmNumber.textContent = app.bpm;
  dom.bpmSlider.value       = app.bpm;
  dom.settingsBpm.value     = app.bpm;
  app.sketch?.setBpm(app.bpm);

  if (app.isRunning) {
    stopScheduler();
    startScheduler();
  }
  saveCurrentConfig();
}

// Canvia el mode i actualitza els toggles del panell perque estiguin sincronitzats
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

// Si l'usuari canvia els toggles manualment, actualitzo el mode
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
  // L'AudioContext nomes es pot crear despres d'un gest de l'usuari,
  // per aixo l'inicialitzo aqui i no a dalt de tot
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

// Scheduler de beats amb el clock de la Web Audio API
// Funciona millor que setInterval sol perque el clock d'audio no te jitter
function startScheduler() {
  nextBeatTime   = audioCtx.currentTime;
  schedulerTimer = setInterval(tickScheduler, LOOKAHEAD_MS);
}

function stopScheduler() {
  clearInterval(schedulerTimer);
  schedulerTimer = null;
}

// S'executa cada 25ms i programa els beats que toquen dins de la finestra d'avantatge
function tickScheduler() {
  const interval = 60 / app.bpm;
  while (nextBeatTime < audioCtx.currentTime + SCHEDULE_AHEAD) {
    scheduleOneBeat(nextBeatTime);
    nextBeatTime += interval;
  }
}

function scheduleOneBeat(beatTime) {
  const delayMs = Math.max(0, (beatTime - audioCtx.currentTime) * 1000);
  setTimeout(onBeat, delayMs);
}

// Aixo s'executa a cada beat: activa el canvas, la vibracio i la llanterna
function onBeat() {
  if (!app.isRunning) return;

  app.sketch?.triggerBeat();
  flashBpmNumber();

  if (app.vibrationEnabled) triggerVibration();
  if (app.torchEnabled)     triggerTorchFlash(140);
}

// Afegeix la classe d'animacio CSS al numero de BPM a cada beat
function flashBpmNumber() {
  dom.bpmNumber.classList.remove('bpm-number--running');
  void dom.bpmNumber.offsetWidth; // truc per forcar el reflow i reiniciar l'animacio
  dom.bpmNumber.classList.add('bpm-number--running');
}

function setSettingsOpen(open) {
  dom.settingsPanel.classList.toggle('hidden', !open);
}

// Guarda l'estat actual a Capacitor Preferences (o localStorage si no hi ha Capacitor)
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

// Assegura que el BPM sempre quedi entre 40 i 240
function clampBpm(v) {
  return Math.max(40, Math.min(240, Math.round(v) || 120));
}

init();
