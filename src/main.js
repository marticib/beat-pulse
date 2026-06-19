// main.js - Controlador principal de BeatPulse 2.0
// Flux: Pantalla 1 (cerca) → Pantalla 2 (artista + config + cançons) → Pantalla 3 (visualitzador)

import { createSketch }                                   from './sketch.js';
import { loadConfig, saveConfig, saveArtist, loadArtist } from './storage.js';
import { triggerVibration, triggerTorchFlash, releaseTorch } from './native.js';
import { searchArtist, searchTracks, detectVisualMode, truncateBio } from './api.js';
import { analyzeTrackBpm, BeatAnalyser }                  from './analyser.js';

// Estat de l'app
const app = {
  bpm:              120,
  visualMode:       'neon',
  vibrationEnabled: false,
  torchEnabled:     false,
  isRunning:        false,
  sketch:           null,
};

// Dades de l'artista actual
const artist = {
  name:     null,
  genre:    null,
  country:  null,
  bio:      null,
  thumb:    null,
  autoMode: null,
};


// Beat detection / scheduler
let audioCtx       = null;
let beatAnalyser     = null;   // BeatAnalyser actiu quan hi ha preview seleccionat
let currentTrack     = null;   // cançó seleccionada; null = mode scheduler manual
let pendingAnalysis  = null;   // Promise<{bpm,beatTimes}|null> arrencada en onTrackClick
let schedulerTimer = null;
let nextBeatTime   = 0;
const LOOKAHEAD_MS   = 25;
const SCHEDULE_AHEAD = 0.1;

// Pantalla actual
let currentScreen = 'screen-search';

// SVGs reutilitzables per als botons de play/pause
const ICON_PLAY = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;

// References DOM
const dom = {
  // Pantalla 1
  searchInput:       document.getElementById('search-input'),
  searchBtn:         document.getElementById('search-btn'),
  searchStatus:      document.getElementById('search-status'),
  // Pantalla 2 - artista
  backToSearchBtn:   document.getElementById('back-to-search-btn'),
  artistThumb:       document.getElementById('artist-thumb'),
  artistName:        document.getElementById('artist-name'),
  artistGenre:       document.getElementById('artist-genre'),
  artistCountry:     document.getElementById('artist-country'),
  artistBio:         document.getElementById('artist-bio'),
  goVisualizerBtn:   document.getElementById('go-visualizer-btn'),
  // Pantalla 3 - controls (ara aquí, no a pantalla 2)
  vibrationToggle:   document.getElementById('vibration-toggle'),
  torchToggle:       document.getElementById('torch-toggle'),
  // Pantalla 2 - cançons
  tracksList:        document.getElementById('tracks-list'),
  miniPlayer:        document.getElementById('mini-player'),
  playerArt:         document.getElementById('player-art'),
  playerTrackName:   document.getElementById('player-track-name'),
  playerProgressBar: document.getElementById('player-progress-bar'),
  previewAudio:      document.getElementById('preview-audio'),
  // Pantalla 3
  backToSettingsBtn: document.getElementById('back-to-settings-btn'),
  vizSidebarBtn:     document.getElementById('viz-sidebar-btn'),
  vizSidebar:        document.getElementById('viz-sidebar'),
  vizBackdrop:       document.getElementById('viz-backdrop'),
  startStopBtn:      document.getElementById('start-stop-btn'),
  vizBpm:            document.getElementById('viz-bpm'),
  bpmAutoBadge:      document.getElementById('bpm-auto-badge'),
  canvasContainer:   document.getElementById('canvas-container'),
};

// Punt d'entrada
async function init() {
  const config = await loadConfig();
  app.visualMode       = config.visualMode       || 'neon';
  app.vibrationEnabled = config.vibrationEnabled || false;
  app.torchEnabled     = config.torchEnabled     || false;

  dom.vibrationToggle.checked = app.vibrationEnabled;
  dom.torchToggle.checked     = app.torchEnabled;
  setVisualModeRadio(app.visualMode);
  applyTheme(app.visualMode);

  wireEvents();

  // Recupero l'ultim artista si n'hi havia un de guardat
  const savedArtist = await loadArtist();
  if (savedArtist) {
    Object.assign(artist, savedArtist);
    populateArtistScreen();
    if (artist.autoMode) {
      setVisualModeRadio(artist.autoMode);
      applyTheme(artist.autoMode);
      app.visualMode = artist.autoMode;
    }
    showScreen('screen-settings');
    loadArtistTracks(artist.name);
  }
}

// Connecta tots els events
function wireEvents() {
  // Pantalla 1
  dom.searchBtn.addEventListener('click', doSearch);
  dom.searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });
  dom.searchInput.addEventListener('input', () => setSearchStatus('', ''));

  // Pantalla 2 - navegació i config
  dom.backToSearchBtn.addEventListener('click', () => {
    stopPreview();
    showScreen('screen-search');
  });

  document.querySelectorAll('input[name="visual-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      artist.autoMode = null;
      applyTheme(radio.value);
      app.visualMode = radio.value;
      app.sketch?.setVisualMode(radio.value);
      saveCurrentConfig();
    });
  });

  dom.vibrationToggle.addEventListener('change', saveCurrentConfig);
  dom.torchToggle.addEventListener('change', saveCurrentConfig);

  dom.goVisualizerBtn.addEventListener('click', goVisualizer);

  // Barra de progrés del mini reproductor
  dom.previewAudio.addEventListener('timeupdate', updateProgress);
  dom.previewAudio.addEventListener('ended', () => {
    // La cançó ha acabat: la barra queda plena i el beat segueix
    dom.playerProgressBar.style.width = '100%';
  });

  // Pantalla 3 - sidebar de configuració
  dom.vizSidebarBtn.addEventListener('click', () => {
    const isOpen = dom.vizSidebar.classList.toggle('open');
    dom.vizBackdrop.classList.toggle('open', isOpen);
  });

  dom.vizBackdrop.addEventListener('click', closeSidebar);

  dom.backToSettingsBtn.addEventListener('click', () => {
    closeSidebar();
    if (app.isRunning) stopBeat();
    showScreen('screen-settings');
  });

  dom.startStopBtn.addEventListener('click', toggleStartStop);
}

function closeSidebar() {
  dom.vizSidebar.classList.remove('open');
  dom.vizBackdrop.classList.remove('open');
}

// Canvia la pantalla visible
function showScreen(id) {
  document.getElementById(currentScreen)?.classList.remove('screen--active');
  document.getElementById(id)?.classList.add('screen--active');
  currentScreen = id;
}

// Cerca l'artista i carrega les cançons
async function doSearch() {
  const query = dom.searchInput.value;
  if (!query.trim()) {
    setSearchStatus('Escriu el nom d\'un artista', 'error');
    return;
  }

  dom.searchBtn.disabled = true;
  setSearchStatus('Cercant...', 'loading');
  stopPreview();

  try {
    const data = await searchArtist(query);

    artist.name     = data.strArtist      || null;
    artist.genre    = data.strGenre       || null;
    artist.country  = data.strCountry     || null;
    artist.bio      = truncateBio(data.strBiography || data.strBiographyEN || '');
    artist.thumb    = data.strArtistThumb || null;
    artist.autoMode = detectVisualMode(artist.genre, data.strStyle);

    if (artist.autoMode) {
      setVisualModeRadio(artist.autoMode);
      applyTheme(artist.autoMode);
      app.visualMode = artist.autoMode;
    }

    populateArtistScreen();
    await saveArtist({ ...artist });

    setSearchStatus('', '');
    showScreen('screen-settings');

    // Carrego les cançons en paral·lel, sense bloquejar la navegació
    loadArtistTracks(artist.name);

  } catch (err) {
    setSearchStatus(err.message, 'error');
  } finally {
    dom.searchBtn.disabled = false;
  }
}

// Omple la pantalla 2 amb les dades de l'artista
function populateArtistScreen() {
  dom.artistName.textContent    = artist.name    || '';
  dom.artistGenre.textContent   = artist.genre   || '';
  dom.artistCountry.textContent = artist.country || '';
  dom.artistBio.textContent     = artist.bio     || '';

  if (artist.thumb) {
    dom.artistThumb.src = artist.thumb;
    dom.artistThumb.classList.remove('hidden');
    dom.artistThumb.onerror = () => dom.artistThumb.classList.add('hidden');
  } else {
    dom.artistThumb.classList.add('hidden');
  }
}

// Busca les cançons a iTunes i les renderitza a la llista
async function loadArtistTracks(name) {
  if (!name) return;

  dom.tracksList.innerHTML = '<p class="tracks-loading">Carregant cançons...</p>';

  try {
    const tracks = await searchTracks(name, 12);
    if (tracks.length === 0) {
      dom.tracksList.innerHTML = '<p class="tracks-loading">Cap resultat trobat.</p>';
      return;
    }
    renderTracks(tracks);
  } catch {
    dom.tracksList.innerHTML = '<p class="tracks-error">No s\'han pogut carregar les cançons.</p>';
  }
}

// Crea els elements DOM de cada cançó.
// Tap a l'ítem sencer → reprodueix + va al visualitzador.
function renderTracks(tracks) {
  dom.tracksList.innerHTML = '';

  tracks.forEach(track => {
    const item = document.createElement('div');
    item.className = 'track-item';

    const art = document.createElement('img');
    art.className = 'track-art';
    art.src       = track.artworkUrl60 || '';
    art.alt       = '';
    art.loading   = 'lazy';

    const textEl = document.createElement('div');
    textEl.className = 'track-text';

    const nameEl = document.createElement('span');
    nameEl.className   = 'track-name';
    nameEl.textContent = track.trackName || '';

    const albumEl = document.createElement('span');
    albumEl.className   = 'track-album';
    albumEl.textContent = track.collectionName || '';

    textEl.append(nameEl, albumEl);

    const playIcon = document.createElement('span');
    playIcon.className = 'track-play-icon';
    playIcon.innerHTML = ICON_PLAY;

    item.append(art, textEl, playIcon);

    // Tot l'ítem és clickable per facilitar el tap al mòbil
    item.addEventListener('click', () => onTrackClick(track));

    dom.tracksList.appendChild(item);
  });
}

// Tap a una cançó: prepara el preview i va al visualitzador.
// La reproduccio NO comença aqui — ho fa el boto START.
function onTrackClick(track) {
  currentTrack = track;
  // Arranquem l'anàlisi en background: quan l'usuari faci START ja estarà llesta
  pendingAnalysis = analyzeTrackBpm(track.previewUrl);
  dom.previewAudio.pause();
  dom.previewAudio.src = track.previewUrl;

  dom.playerArt.src               = track.artworkUrl100 || track.artworkUrl60 || '';
  dom.playerTrackName.textContent  = track.trackName || '';
  dom.playerProgressBar.style.width = '0%';
  dom.miniPlayer.classList.remove('hidden');

  goVisualizer();
}

// Atura el preview i oculta el mini reproductor (al canviar d'artista)
function stopPreview() {
  currentTrack    = null;
  pendingAnalysis = null;
  dom.previewAudio.pause();
  dom.previewAudio.src = '';
  dom.miniPlayer.classList.add('hidden');
}

// Actualitza la barra de progrés mentre sona la cançó
function updateProgress() {
  const audio = dom.previewAudio;
  if (!audio.duration) return;
  dom.playerProgressBar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
}

// Navega a la pantalla del visualitzador i inicialitza el canvas
function goVisualizer() {
  app.visualMode       = document.querySelector('input[name="visual-mode"]:checked')?.value || 'neon';
  app.vibrationEnabled = dom.vibrationToggle.checked;
  app.torchEnabled     = dom.torchToggle.checked;

  saveCurrentConfig();
  applyTheme(app.visualMode);
  // Si hi ha cançó seleccionada, el BPM es detectarà automàticament → mostrem '---'
  dom.vizBpm.textContent = currentTrack ? '---' : app.bpm;

  showScreen('screen-visualizer');

  if (!app.sketch) {
    requestAnimationFrame(() => {
      app.sketch = createSketch(dom.canvasContainer);
      app.sketch.setVisualMode(app.visualMode);
      app.sketch.setBpm(app.bpm);
      app.sketch.setParticleIntensity(5);
      app.sketch.setArtistName(artist.name || '');
    });
  } else {
    app.sketch.setVisualMode(app.visualMode);
    app.sketch.setBpm(app.bpm);
    app.sketch.setArtistName(artist.name || '');
  }
}

// Beat generator
function toggleStartStop() {
  if (app.isRunning) stopBeat(); else startBeat();
}

async function startBeat() {
  app.isRunning = true;
  dom.startStopBtn.textContent = 'STOP';
  dom.startStopBtn.classList.add('running');
  app.sketch?.setActive(true);

  if (currentTrack) {
    // Reproduïm natiu (sense Web Audio API → sense problemes de CORS)
    dom.previewAudio.play().catch(err => console.error('Audio:', err));
    dom.bpmAutoBadge.classList.remove('hidden');

    // Esperem l'anàlisi pre-computada (va arrencar en onTrackClick)
    const result = pendingAnalysis ? await pendingAnalysis.catch(() => null) : null;

    if (!app.isRunning) return; // l'usuari ha premut STOP durant l'espera

    if (result) {
      if (!beatAnalyser) {
        beatAnalyser = new BeatAnalyser(dom.previewAudio, onBeat, onBpmUpdate);
      }
      beatAnalyser.start(result.beatTimes, result.bpm);
    } else {
      // Fallback: CORS bloquejat o beats no detectats → scheduler manual
      dom.bpmAutoBadge.classList.add('hidden');
      dom.vizBpm.textContent = app.bpm;
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      nextBeatTime   = audioCtx.currentTime;
      schedulerTimer = setInterval(tickScheduler, LOOKAHEAD_MS);
    }
  } else {
    // Mode manual pur: sense cançó seleccionada
    dom.bpmAutoBadge.classList.add('hidden');
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    nextBeatTime   = audioCtx.currentTime;
    schedulerTimer = setInterval(tickScheduler, LOOKAHEAD_MS);
  }
}

function stopBeat() {
  app.isRunning = false;
  dom.startStopBtn.textContent = 'START';
  dom.startStopBtn.classList.remove('running');
  app.sketch?.setActive(false);

  beatAnalyser?.stop();
  dom.bpmAutoBadge.classList.add('hidden');

  clearInterval(schedulerTimer);
  schedulerTimer = null;

  releaseTorch();
  dom.previewAudio.pause();
}

function onBpmUpdate(bpm) {
  app.bpm = bpm;
  dom.vizBpm.textContent = bpm;
  app.sketch?.setBpm(bpm);
}

function tickScheduler() {
  const interval = 60 / app.bpm;
  while (nextBeatTime < audioCtx.currentTime + SCHEDULE_AHEAD) {
    const delay = Math.max(0, (nextBeatTime - audioCtx.currentTime) * 1000);
    setTimeout(onBeat, delay);
    nextBeatTime += interval;
  }
}

function onBeat() {
  if (!app.isRunning) return;
  app.sketch?.triggerBeat();
  const ts = dom.previewAudio.currentTime.toFixed(3);
  if (app.vibrationEnabled) {
    console.log(`[Beat] vibració @ ${ts}s`);
    triggerVibration();
  }
  if (app.torchEnabled) {
    console.log(`[Beat] llanterna @ ${ts}s`);
    triggerTorchFlash(140);
  }
  if (!app.vibrationEnabled && !app.torchEnabled) {
    console.log(`[Beat] @ ${ts}s (vibració i llanterna desactivades)`);
  }
}

// Utilitats
function setVisualModeRadio(mode) {
  const radio = document.querySelector(`input[name="visual-mode"][value="${mode}"]`);
  if (radio) radio.checked = true;
}

function applyTheme(mode) {
  document.documentElement.dataset.visualMode = mode;
}

function setSearchStatus(msg, type) {
  dom.searchStatus.textContent = msg;
  dom.searchStatus.className   = 'search-status';
  if (type) dom.searchStatus.classList.add(type);
}

function saveCurrentConfig() {
  saveConfig({
    visualMode:       app.visualMode,
    vibrationEnabled: app.vibrationEnabled,
    torchEnabled:     app.torchEnabled,
  });
}

init();
