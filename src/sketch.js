// sketch.js - Tot el que es veu al canvas: cercle central, ones i particules
// Faig servir p5.js en mode instancia per no contaminar el scope global.
//
// Des de main.js es pot cridar:
//   triggerBeat()          - dispara una pulsacio visual
//   setVisualMode(mode)    - canvia el tema: 'neon', 'fire' o 'minimal'
//   setActive(bool)        - indica si el metronom esta en marxa
//   setBpm(value)          - actualitza el BPM intern
//   setParticleIntensity() - quantes particules surten per beat
//   destroy()              - elimina la instancia de p5

import p5 from 'p5';

// Colors de cada mode en format HSB (matís, saturació, brillantor)
const THEMES = {
  neon:    { h: 285, s: 90, b: 100, h2: 195, name: 'neon' },
  fire:    { h: 20,  s: 95, b: 100, h2: 45,  name: 'fire' },
  minimal: { h: 205, s: 35, b: 88,  h2: 220, name: 'minimal' },
};

export function createSketch(container) {
  // Estat intern que comparteixo entre el sketch i l'API publica
  const state = {
    beatTriggered:     false,
    visualMode:        'neon',
    particleIntensity: 5,
    isActive:          false,
    bpm:               120,
    pulseScale:        1.0,
    beatCount:         0,
  };

  const particles = [];
  const waves     = [];

  const sketch = (p) => {

    p.setup = () => {
      // Faig servir les dimensions del contenidor, amb fallback per si no esta renderitzat
      const w = container.offsetWidth  || window.innerWidth;
      const h = container.offsetHeight || Math.floor(window.innerHeight * 0.45);
      const cnv = p.createCanvas(w, h);
      cnv.parent(container);
      p.colorMode(p.HSB, 360, 100, 100, 100);
      p.noStroke();
    };

    p.draw = () => {
      const theme = THEMES[state.visualMode] || THEMES.neon;
      const cx    = p.width  / 2;
      const cy    = p.height / 2;

      // Fons semitransparent: aixi el fons no s'esborra del tot i crea rastre
      p.background(0, 0, 5, state.isActive ? 22 : 40);

      // Quan arriba un beat des de main.js, disparo tot
      if (state.beatTriggered) {
        state.beatTriggered = false;
        state.beatCount++;
        state.pulseScale = 1.65;
        spawnParticles(p, cx, cy, theme);
        spawnWave(cx, cy);
      }

      // El cercle torna a la mida normal suaument amb lerp
      state.pulseScale = p.lerp(state.pulseScale, 1.0, 0.13);

      drawWaves(p, theme);
      drawParticles(p, theme);
      drawCenter(p, cx, cy, theme);
    };

    p.windowResized = () => {
      const w = container.offsetWidth  || window.innerWidth;
      const h = container.offsetHeight || Math.floor(window.innerHeight * 0.45);
      p.resizeCanvas(w, h);
    };

    function spawnWave(cx, cy) {
      waves.push({ x: cx, y: cy, radius: 8, life: 100 });
    }

    function drawWaves(p, theme) {
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        // En mode minimal les ones s'expandeixen i desapareixen mes lentament
        w.radius += state.visualMode === 'minimal' ? 3 : 4.5;
        w.life   -= state.visualMode === 'minimal' ? 1.5 : 2;

        if (w.life <= 0) { waves.splice(i, 1); continue; }

        const alpha = p.map(w.life, 0, 100, 0, 50);
        p.stroke(theme.h, theme.s * 0.8, theme.b, alpha);
        p.strokeWeight(state.visualMode === 'minimal' ? 1 : 1.5);
        p.noFill();
        p.ellipse(w.x, w.y, w.radius * 2);
        p.noStroke();
      }
    }

    function spawnParticles(p, cx, cy, theme) {
      const count = state.particleIntensity * 3;

      for (let i = 0; i < count; i++) {
        const angle = p.random(p.TWO_PI);
        // El foc va una mica mes lent per semblar mes pesant
        const speed = state.visualMode === 'fire'
          ? p.random(1.5, 5)
          : p.random(2.5, 9);

        const vx = p.cos(angle) * speed;
        // En mode foc resto velocitat vertical perque les particules pugin
        const vy = state.visualMode === 'fire'
          ? p.sin(angle) * speed - p.random(1, 3)
          : p.sin(angle) * speed;

        particles.push({
          x:    cx,
          y:    cy,
          vx,
          vy,
          size:  p.random(3, 9),
          life:  255,
          hOff:  p.random(-40, 40), // petit desfasament de color per variacio
          decay: state.visualMode === 'minimal' ? 5 : p.random(2.5, 5),
        });
      }
    }

    function drawParticles(p, theme) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];

        pt.x    += pt.vx;
        pt.y    += pt.vy;
        pt.vx   *= 0.955; // frenada progressiva
        pt.vy   *= 0.955;
        pt.life -= pt.decay;
        pt.size *= 0.975;

        if (pt.life <= 0) { particles.splice(i, 1); continue; }

        const alpha = p.map(pt.life, 0, 255, 0, 72);
        const hue   = (theme.h + pt.hOff + 360) % 360;

        if (state.visualMode === 'fire') {
          // Interpolo entre taronja i groc a mesura que la particula es mor
          const t = p.map(pt.life, 0, 255, 0, 1);
          p.fill(p.lerp(theme.h2, theme.h, t), theme.s, theme.b, alpha);
        } else {
          p.fill(hue, theme.s, theme.b, alpha);
        }

        p.ellipse(pt.x, pt.y, pt.size);
      }
    }

    function drawCenter(p, cx, cy, theme) {
      const base = p.min(p.width, p.height) * 0.21;
      const sz   = base * state.pulseScale;
      const act  = state.isActive;

      if (state.visualMode === 'minimal') {
        // En minimal nomes dibuixo el contorn, sense glow
        p.noFill();
        p.stroke(theme.h, theme.s, theme.b, act ? 80 : 28);
        p.strokeWeight(2);
        p.ellipse(cx, cy, sz);
        p.noStroke();
        p.fill(theme.h, theme.s, theme.b, act ? 55 : 18);
        p.ellipse(cx, cy, sz * 0.18);
        return;
      }

      // Capes concentriques per simular el glow
      const glowLayers = 5;
      for (let i = glowLayers; i > 0; i--) {
        const alpha = act ? i * 9 : i * 3;
        p.fill(theme.h, theme.s, theme.b, alpha);
        p.ellipse(cx, cy, sz + i * 20);
      }

      // Cercle principal
      p.fill(theme.h, theme.s - 10, theme.b - 5, act ? 70 : 22);
      p.ellipse(cx, cy, sz);

      // Brillantor interior d'un color lleugerament diferent
      p.fill(theme.h2, theme.s - 25, 100, act ? 52 : 14);
      p.ellipse(cx, cy, sz * 0.48);

      // Punt blanc al centre
      p.fill(0, 0, 100, act ? 60 : 20);
      p.ellipse(cx, cy, sz * 0.12);
    }
  };

  // Creo la instancia en mode instancia (la fungo com a argument, no s'executa globalment)
  const p5Instance = new p5(sketch);

  // API publica que exposo a main.js
  return {
    triggerBeat() {
      state.beatTriggered = true;
    },
    setVisualMode(mode) {
      if (THEMES[mode]) state.visualMode = mode;
    },
    setActive(active) {
      state.isActive = active;
      if (!active) {
        // Netejo tot quan s'atura perque el canvas quedi net
        particles.length = 0;
        waves.length     = 0;
        state.pulseScale = 1.0;
        state.beatCount  = 0;
      }
    },
    setBpm(value) {
      state.bpm = value;
    },
    setParticleIntensity(value) {
      state.particleIntensity = Math.max(1, Math.min(10, value));
    },
    destroy() {
      p5Instance.remove();
    },
  };
}
