# BeatPulse

App musical interactiva que detecta automàticament el BPM d'una cançó i sincronitza un visualitzador de partícules, la vibració i la llanterna del dispositiu a cada beat. Desenvolupada com a PR1 de l'assignatura **Desenvolupament d'Aplicacions Interactives** (UOC).

---

## Descripció del projecte

BeatPulse permet cercar un artista, seleccionar una cançó del seu catàleg i veure (i sentir) la música en temps real: el canvas reacciona a cada beat, el mòbil vibra i la llanterna fa flaixos sincronitzats amb el ritme detectat automàticament.

Parteix del tutorial base **Pomodoro Timer amb Capacitor + p5.js + ViteJS** i el transforma en una aplicació musical completa. Les principals diferències respecte al tutorial són:

| Aspecte | Tutorial Pomodoro | BeatPulse |
|---|---|---|
| Importació p5.js | Fitxer copiat a `/public`, carregat com a `<script>` global | Importat via npm (`import p5 from 'p5'`) |
| Arquitectura del sketch | Una instància exportada directament | Funció `createSketch()` que retorna una API externa |
| On es crida Haptics | Dins `p.mousePressed` al sketch | Centralitzat a `native.js`, cridat des del beat scheduler |
| BPM | Manual (slider) | **Detecció automàtica** offline via Web Audio API |
| Temporitzador | Interval fix del Pomodoro (25 min) | `BeatAnalyser` amb `requestAnimationFrame` sincronitzat als timestamps de beat |
| Emmagatzematge | No n'hi ha | `storage.js` amb Capacitor Preferences + fallback localStorage |
| Llanterna | No contemplada | `@capgo/capacitor-flash` (API nativa Android/iOS) |
| Dades musicals | Cap | TheAudioDB (artista) + iTunes Search API (previews de 30s) |
| Visuals del canvas | Text estàtic | Partícules generatives, ones i puls central reactius al beat |
| Plataforma | Android | Android + iOS |

---

## Tecnologies

- **Vite 5** — bundler i servidor de dev
- **Vanilla JavaScript** (ES modules) — sense cap framework
- **p5.js 1.9** — canvas generatiu en instance mode
- **Capacitor 6** — empaquetament natiu i accés a APIs del dispositiu

---

## Plugins Capacitor

| Plugin | Ús |
|---|---|
| `@capacitor/haptics` | Vibració hàptica a cada beat |
| `@capacitor/preferences` | Desar configuració de l'usuari entre sessions |
| `@capgo/capacitor-flash` | Control natiu de la llanterna (torch) via CameraManager |
| `@capacitor/android` | Empaquetament per a Android |
| `@capacitor/ios` | Empaquetament per a iOS |

---

## Estructura del projecte

```
PR1/
├── index.html              — 3 pantalles (cerca / artista / visualitzador)
├── package.json
├── capacitor.config.json
├── vite.config.js
├── MEMORIA_BEATPULSE.txt   — memòria de la pràctica
└── src/
    ├── main.js             — controlador principal: navegació, events, beat scheduler
    ├── sketch.js           — canvas generatiu amb p5.js (3 modes visuals)
    ├── analyser.js         — detecció offline de BPM + classe BeatAnalyser
    ├── api.js              — TheAudioDB i iTunes Search API
    ├── storage.js          — emmagatzematge persistent
    ├── native.js           — vibració (Haptics) i llanterna (capacitor-flash)
    └── style.css           — tema fosc, mobile-first, 3 modes de color
```

---

## Flux de l'aplicació

```
Pantalla 1 — Cerca
  └─► Pantalla 2 — Artista + llista de cançons
        └─► Pantalla 3 — Visualitzador
              ├── Sidebar (icona faders) → tria mode visual (Neon / Fire / Minimal)
              ├── Botons Vibració i Llanterna (toggle a/off)
              └── Botó START / STOP
```

Quan l'usuari toca una cançó, l'anàlisi de BPM comença en segon pla. Quan prem START, la promesa ja és resolta i la sincronització és immediata.

---

## Funcionalitats

| Funcionalitat | Detalls |
|---|---|
| Cerca d'artista | TheAudioDB API — nom, gènere, país, biografia, imatge |
| Llista de cançons | iTunes Search API — fins a 12 cançons amb preview de 30s |
| BPM automàtic | Fetch independent + filtre IIR 200 Hz + detecció RMS amb threshold adaptatiu |
| Sincronització beat | `requestAnimationFrame` + 25ms lookahead sobre timestamps pre-calculats |
| Mode visual automàtic | Assignació per gènere: rock→Fire, electrònica→Neon, jazz→Minimal |
| Canvas generatiu | Puls central, partícules i ones circulars reactives al beat (p5.js) |
| Vibració | `@capacitor/haptics` — `ImpactStyle.Medium` + fallback `navigator.vibrate()` |
| Llanterna | `@capgo/capacitor-flash` — flash de 140ms per beat (Android + iOS) |
| Sidebar de configuració | Panell lateral amb 3 modes visuals, s'obre/tanca amb botó al header |
| Persistència | Capacitor Preferences — desa mode visual i estat dels toggles |

---

## Instal·lació

### Requisits previs

- Node.js ≥ 18
- **Android:** Android Studio + SDK Android 14 (API 34) + JDK 17
- **iOS:** Xcode ≥ 15 + Apple ID (compte gratuït suficient per a proves)

### Passos

```bash
# Instal·lar dependències
npm install

# Afegir les plataformes natives (només la primera vegada)
npx cap add android
npx cap add ios
```

---

## Execució

### Navegador (development)

```bash
npm run dev
```

Obre `http://localhost:5173`. La vibració fa fallback a `navigator.vibrate()` i la llanterna no estarà disponible (requereix dispositiu físic i plugin natiu).

### Android

```bash
npm run build
npx cap sync android
npx cap open android
```

A Android Studio:
1. Espera que Gradle sincronitzi.
2. Connecta el dispositiu per USB amb **depuració USB activada**.
3. Selecciona el dispositiu a la barra superior i prem ▶ Run.

> La primera vegada que s'activi la llanterna, el dispositiu demanarà permís de càmera.

### iOS

```bash
npm run build
npx cap sync ios
npx cap open ios
```

A Xcode:
1. Selecciona el projecte **App** a l'esquerra.
2. A **Signing & Capabilities** tria el teu Apple ID com a equip.
3. Connecta l'iPhone per USB, selecciona'l a la barra i prem ▶ Run.

> Amb compte gratuït l'app caduca als 7 dies al dispositiu; torna a compilar per renovar-la.

---

## Notes tècniques rellevants

**Per què `fetch()` independent per a l'anàlisi de BPM?**
Les APIs `createMediaElementSource()` i `captureStream()` apliquen polítiques CORS estrictes que bloquegen URLs cross-origin (com les d'iTunes). Fer un `fetch(url, { mode: 'cors' })` independent i analitzar l'àudio amb `OfflineAudioContext` evita el problema completament, deixant l'element `<audio>` reproduir de forma nativa sense interferències.

**Per què `@capgo/capacitor-flash` i no `getUserMedia + torch`?**
El WebView d'Android no exposa la capacitat `torch` a través de `MediaStreamTrack.getCapabilities()`. El plugin usa `CameraManager.setTorchMode()` de l'API nativa d'Android directament.

**Filtre IIR passa-baixos a 200 Hz:**
Sense filtrar, els instruments de percussió aguda (snare, hi-hat) generen falsos positius que doblen el BPM detectat. El filtre aïlla el rang del bombo (kick drum, 20-200 Hz) i elimina la resta.
