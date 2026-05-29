# BeatPulse

App musical interactiva que genera pulsacions visuals, vibració i llanterna sincronitzades amb un BPM configurat per l'usuari. Desenvolupada com a PR1 de l'assignatura **Desenvolupament d'Aplicacions Interactives** (UOC).

---

## Descripció del projecte

BeatPulse és un metrònomo visual i hàptic. L'usuari configura un BPM i l'app dispara, a cada beat, una animació generativa al canvas, vibració i/o un flash de llanterna.

Parteix del tutorial base **Pomodoro Timer amb Capacitor + p5.js + ViteJS** i el transforma en una aplicació musical. Les principals diferències respecte al tutorial són:

| Aspecte | Tutorial Pomodoro | BeatPulse |
|---|---|---|
| Importació p5.js | Fitxer copiat a `/public`, carregat com a `<script>` global | Importat via npm (`import p5 from 'p5'`) |
| Arquitectura del sketch | Una instància exportada directament | Funció `createSketch()` que retorna una API externa |
| On es crida Haptics | Dins `p.mousePressed` al sketch | Centralitzat a `native.js`, cridat des del scheduler |
| Temporitzador | Interval fix del Pomodoro (25 min) | Scheduler de beats amb Web Audio API clock |
| Emmagatzematge | No n'hi ha | `storage.js` amb Capacitor Preferences + fallback localStorage |
| Llanterna | No contemplada | `triggerTorchFlash()` via `MediaDevices` API |
| Visuals del canvas | Text estàtic | Cercle pulsant + partícules generatives + ones expansives |
| Plataforma | Android | Android + iOS |

La decisió d'importar p5.js via npm (en lloc de copiar-lo a `/public`) és possible perquè BeatPulse no fa servir `p5.sound`, que era el motiu del problema al tutorial original.

### Tecnologies

- **Vite 5** — bundler i servidor de dev
- **Vanilla JavaScript** (ES modules) — sense cap framework
- **p5.js 1.9** — canvas generatiu
- **Capacitor 6** — empaquetament natiu i accés a APIs del dispositiu

### Plugins Capacitor

| Plugin | Ús |
|---|---|
| `@capacitor/haptics` | Vibració curta a cada beat |
| `@capacitor/preferences` | Desar i carregar la configuració de l'usuari |
| `@capacitor/ios` | Empaquetament per a iPhone |

### Estructura del projecte

```
PR1/
├── index.html
├── package.json
├── capacitor.config.json
├── vite.config.js
└── src/
    ├── main.js       — controlador principal: UI, scheduler, natives
    ├── sketch.js     — canvas generatiu amb p5.js
    ├── storage.js    — emmagatzematge persistent
    ├── native.js     — vibració i llanterna
    └── style.css     — estils (tema fosc, mobile-first, 3 modes de color)
```

---

## Instal·lació

### Requisits previs

- Node.js ≥ 18
- **Android:** Android Studio + SDK Android 14 (API 34) + JDK 17
- **iOS:** Xcode ≥ 15 + compte Apple ID (gratuït)

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

Obre `http://localhost:5173`. La vibració fa fallback a `navigator.vibrate()` i la llanterna no estarà disponible.

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
> La llanterna no està disponible a iOS per restriccions d'Apple sobre WKWebView.

---

## Funcionalitats

| Funcionalitat | Detalls |
|---|---|
| Control de BPM | Slider + botons ± (rang 40–240 BPM) |
| Modes de pulsació | Visualització / Vibració / Llanterna / Tot |
| Canvas generatiu | Cercle pulsant, partícules, ones circulars (p5.js) |
| Modes visuals | Neon (violeta), Foc (taronja), Minimal (blau clar) |
| Vibració | `@capacitor/haptics` — `ImpactStyle.Medium` a cada beat |
| Llanterna | `MediaDevices` API amb constraint `torch` (Android) |
| Panell de configuració | Bottom-sheet amb desat automàtic |
| Emmagatzematge | Capacitor Preferences + LocalStorage (fallback web) |
| Scheduler precís | Web Audio API clock amb lookahead de 100ms |

### Possibles millores per a PR2

- Càrrega d'una cançó des del dispositiu
- Detecció automàtica de BPM amb la Web Audio API
- Cerca d'informació musical amb l'API de MusicBrainz (gratuïta, sense API key)
- Editor de patrons de ritme per a 4/4, 3/4, 6/8, etc.
