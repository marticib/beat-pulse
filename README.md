# BeatPulse

App musical interactiva que genera pulsacions visuals, vibració i llanternes en sincronització amb un tempo (BPM) configurat per l'usuari. Desenvolupada com a PR1 de l'assignatura **Desenvolupament d'Aplicacions Interactives** (UOC).

---

## Descripció

BeatPulse és un metrònomo visual i hàptic. L'usuari introdueix un BPM i l'app dispara, a cada beat:

- Una **animació generativa** al canvas (p5.js): cercle pulsant, partícules i ones expansives.
- **Vibració** del dispositiu (@capacitor/haptics).
- **Flash de llanterna** (@capacitor-community/torch).

Té tres modes visuals (**Neon**, **Foc**, **Minimal**), un panel de configuració ⚙️ i desa automàticament totes les preferències amb Capacitor Preferences.

---

## Funcionalitats

| Funcionalitat | Detalls |
|---|---|
| Control de BPM | Slider + botons ± (rang 40–240 BPM) |
| Modes de pulsació | Visualització / Vibració / Llanterna / Tot |
| Canvas generatiu | Cercle pulsant, partícules, ones circulars (p5.js) |
| Modes visuals | Neon (violeta), Foc (taronja), Minimal (blau clar) |
| Vibració | @capacitor/haptics — ImpactStyle.Medium |
| Llanterna | @capacitor-community/torch (codi preparat, veure abaixo) |
| Configuració ⚙️ | Panell bottom-sheet amb desat automàtic |
| Emmagatzematge | Capacitor Preferences + LocalStorage (fallback web) |
| Scheduler precís | Web Audio API clock amb lookahead (tècnica Chris Wilson) |

---

## Tecnologies

- **Vite 5** — bundler i servidor de dev
- **Vanilla JavaScript** (ES modules) — sense cap framework
- **p5.js 1.9** — canvas generatiu
- **Capacitor 6** — empaquetament Android i accés a APIs natives
- **Android Studio** — compilació i desplegament a dispositiu

---

## Plugins Capacitor

| Plugin | Ús |
|---|---|
| `@capacitor/haptics` | Vibració curta a cada beat |
| `@capacitor/preferences` | Desar/carregar configuració de l'usuari |
| `@capacitor-community/torch` | Llanterna (codi preparat; veure instruccions) |

---

## Instal·lació

### Prerequisits

- Node.js ≥ 18
- **Android:** Android Studio (amb SDK Android 14 / API 34 recomanat) + JDK 17+
- **iOS:** Xcode ≥ 15 (Mac App Store) + compte Apple ID gratuït

### Passos

```bash
# 1. Clonar/obrir el projecte
cd "Desenvolupament aplicacions interactives/PR1"

# 2. Instal·lar dependències
npm install

# 3. Afegir les plataformes (primera vegada)
npx cap add android
npx cap add ios
```

---

## Execució en navegador (dev)

```bash
npm run dev
```

Obre `http://localhost:5173` al navegador. La vibració farà fallback a `navigator.vibrate()`.  
Des d'un iPhone a la mateixa xarxa Wi-Fi, accedeix a `http://<IP-del-mac>:5173`.

---

## Compilació i sincronització amb Capacitor

```bash
# Compilar l'app web
npm run build

# Sincronitzar els canvis web → Android i iOS
npx cap sync android
npx cap sync ios
```

---

## Obrir amb Android Studio

```bash
npx cap open android
```

Un cop obert Android Studio:

1. Espera que Gradle acabi de sincronitzar (pot trigar 1-2 minuts la primera vegada).
2. Selecciona el teu dispositiu a la barra superior.
3. Prem ▶ **Run** (o `Shift+F10`).

---

## Obrir amb Xcode (iPhone)

```bash
npx cap open ios
```

Un cop obert Xcode:

1. Selecciona el projecte **App** a l'arbre de l'esquerra.
2. Ves a **Signing & Capabilities** → tria el teu equip (Apple ID personal).
3. Connecta l'iPhone per USB i selecciona'l a la barra superior.
4. Prem ▶ **Run** (o `Cmd+R`).

> Amb compte gratuït l'app caduca als **7 dies** al dispositiu; torna a compilar per renovar-la.

---

## Activar la llanterna (opcional)

El codi de la llanterna està preparat però comentat (per evitar errors de compilació si el plugin no s'ha sincronitzat). Per activar-la:

1. Instal·la el plugin:
   ```bash
   npm install
   npx cap sync android
   ```

2. A `android/app/src/main/AndroidManifest.xml`, afegeix dins de `<manifest>`:
   ```xml
   <uses-permission android:name="android.permission.FLASHLIGHT"/>
   ```

3. A `src/native.js`, descomenta la línia de l'import i el bloc de codi marcats com `TORCH PLUGIN INTEGRATION`.

---

## Notes sobre dispositiu real

> La vibració i la llanterna **requereixen un dispositiu Android físic**.
> En emulador, la vibració pot no funcionar i la llanterna no existeix.
> Es recomana fer la prova final en un telèfon real connectat per USB amb depuració activada.

---

## Estructura del projecte

```
PR1/
├── index.html              # Entrada de l'app
├── package.json            # Dependències i scripts
├── capacitor.config.json   # Configuració de Capacitor
├── vite.config.js          # Configuració de Vite
├── README.md
└── src/
    ├── main.js             # Controlador principal (UI + scheduler + natives)
    ├── sketch.js           # Canvas generatiu amb p5.js
    ├── storage.js          # Capa d'emmagatzematge (Preferences / localStorage)
    ├── native.js           # Vibració i llanterna (abstracció natives)
    └── style.css           # Estils (tema fosc, mobile-first, 3 modes de color)
```

---

## Possibles millores per a PR2

- **Càrrega d'una cançó**: selecció d'àudio des del dispositiu amb `@capacitor/filesystem` o la File API del navegador.
- **Detecció automàtica de BPM**: anàlisi de l'àudio en temps real amb la Web Audio API (BeatDetectJS o algorisme propi basat en energia d'onset).
- **API externa de música**: integració amb l'API de MusicBrainz (gratuïta, sense API key) per cercar informació d'àlbums, artistes i portades a partir del títol detectat.
- **Patrons de ritme personalitzats**: editor de compassos per a 4/4, 3/4, 6/8, etc.
- **Exportar sessió**: desar les configuracions de sessions com a preset reutilitzable.
