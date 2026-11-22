/* ==========================================================================
   Peony for Abel — Interactive Procedural Moonlit Peony Garden
   Pure HTML5 Canvas + Mathematical Petal Generation + Cinematic Choreography
   ========================================================================== */

(() => {
  "use strict";

  /* ------------------------------------------------------------------------
     1. Configuration (easy to customize!)
     Tip: You can also test faster durations via URL param, e.g. ?duration=20
     ------------------------------------------------------------------------ */
  const urlParams = new URLSearchParams(window.location.search);
  const queryDuration = parseFloat(urlParams.get("duration"));

  const CONFIG = {
    // Full cinematic blooming duration in seconds (PRD: 60 - 120 seconds)
    durationSec:
      Number.isFinite(queryDuration) && queryDuration >= 8 && queryDuration <= 240
        ? queryDuration
        : 75,

    // Target music volume (0.0 to 1.0)
    musicVolume: 0.72,

    // Romantic peonies palette family (deep purple, midnight, blush pink, lavender, cream, gold)
    peonyPalettes: [
      {
        name: "Moonlit Blush",
        shadow: "#591839",
        deep: "#9c3363",
        mid: "#e57da3",
        light: "#f9c4d7",
        rim: "#fff0f5",
        vein: "rgba(130, 32, 78, 0.22)",
        glow: "pink",
        heart: "#ffe29a",
      },
      {
        name: "Starlight Cream",
        shadow: "#7c475c",
        deep: "#b87a8c",
        mid: "#edd0c8",
        light: "#faece1",
        rim: "#fffaf2",
        vein: "rgba(155, 102, 114, 0.19)",
        glow: "gold",
        heart: "#ffd980",
      },
      {
        name: "Velvet Lavender",
        shadow: "#371757",
        deep: "#6e3d9e",
        mid: "#b38be0",
        light: "#dcc5f7",
        rim: "#f6eeff",
        vein: "rgba(82, 42, 128, 0.22)",
        glow: "lavender",
        heart: "#f8dc96",
      },
      {
        name: "Dusk Rose Velvet",
        shadow: "#470f2e",
        deep: "#8c2453",
        mid: "#cf5783",
        light: "#f2a9c4",
        rim: "#ffe3ee",
        vein: "rgba(104, 22, 62, 0.24)",
        glow: "pink",
        heart: "#ffda82",
      },
      {
        name: "Champagne Dawn",
        shadow: "#72364a",
        deep: "#b76779",
        mid: "#ebaaa9",
        light: "#fbd9cf",
        rim: "#fff4e8",
        vein: "rgba(146, 76, 92, 0.20)",
        glow: "gold",
        heart: "#ffe394",
      },
    ],

    // Leaf & stem moonlit botanical colors
    foliage: {
      stemBase: "#16262a",
      stemMid: "#22413f",
      stemTip: "#356358",
      stemHighlight: "rgba(164, 218, 198, 0.28)",
      leafDark: "#122429",
      leafMid: "#1e4240",
      leafLight: "#36695f",
      leafRim: "rgba(182, 224, 214, 0.28)",
      leafVein: "rgba(196, 232, 218, 0.24)",
      calyxDark: "#1b3332",
      calyxMid: "#2e544c",
    },
  };

  /* ------------------------------------------------------------------------
     2. Math & Easing Utilities
     ------------------------------------------------------------------------ */
  const TAU = Math.PI * 2;
  const GOLDEN_ANGLE = 2.399963229728653;

  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => clamp((v - a) / (b - a || 1e-6), 0, 1);

  const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeInOutCubic = (t) => {
    const x = clamp(t, 0, 1);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };
  const easeOutQuint = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 5);
  const easeInOutSine = (t) => -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) / 2;

  // Deterministic PRNG (Mulberry32) so the garden layout is artistically balanced on every resize
  function createRng(seed) {
    let a = seed >>> 0;
    return function next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cubicBezierPoint(p0, p1, p2, p3, t) {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
    };
  }

  function cubicBezierTangent(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return {
      x:
        3 * u * u * (p1.x - p0.x) +
        6 * u * t * (p2.x - p1.x) +
        3 * t * t * (p3.x - p2.x),
      y:
        3 * u * u * (p1.y - p0.y) +
        6 * u * t * (p2.y - p1.y) +
        3 * t * t * (p3.y - p2.y),
    };
  }

  /* ------------------------------------------------------------------------
     3. Audio Controller (Local Music + Ethereal Harp Fallback)
     Strictly starts ONLY after user interaction.
     ------------------------------------------------------------------------ */
  class AudioController {
    constructor(audioEl, toggleBtn, labelEl) {
      this.audioEl = audioEl;
      this.toggleBtn = toggleBtn;
      this.labelEl = labelEl;
      this.isPlaying = false;
      this.usingFallback = false;
      this.fadeRaf = null;
      this.synthCtx = null;
      this.synthGain = null;
      this.synthTimer = null;
      this.synthStep = 0;

      if (this.audioEl) {
        this.audioEl.volume = 0;
        const markFallback = () => {
          this.usingFallback = true;
        };
        this.audioEl.addEventListener("error", markFallback);
        const sources = this.audioEl.querySelectorAll("source");
        sources.forEach((srcEl) => srcEl.addEventListener("error", markFallback));
      }

      if (this.toggleBtn) {
        this.toggleBtn.addEventListener("click", () => this.toggle());
      }
    }

    updateUI() {
      if (!this.toggleBtn || !this.labelEl) return;
      this.toggleBtn.classList.toggle("is-playing", this.isPlaying);
      this.toggleBtn.setAttribute("aria-pressed", String(this.isPlaying));
      this.toggleBtn.setAttribute("aria-label", this.isPlaying ? "Pause music" : "Play music");
      this.labelEl.textContent = this.isPlaying ? "Music On" : "Music Off";
    }

    async play() {
      if (this.isPlaying) return;
      this.isPlaying = true;
      this.updateUI();

      if (!this.usingFallback && this.audioEl) {
        try {
          await this.audioEl.play();
          this.fadeAudioTo(CONFIG.musicVolume, 2200);
          return;
        } catch {
          this.usingFallback = true;
        }
      }

      this.startFairyHarpFallback();
    }

    pause() {
      if (!this.isPlaying) return;
      this.isPlaying = false;
      this.updateUI();

      if (!this.usingFallback && this.audioEl) {
        this.fadeAudioTo(0, 650, () => {
          if (!this.isPlaying) this.audioEl.pause();
        });
      }
      this.stopFairyHarpFallback();
    }

    toggle() {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    }

    fadeAudioTo(targetVolume, durationMs, onDone) {
      if (this.fadeRaf) cancelAnimationFrame(this.fadeRaf);
      const startVolume = this.audioEl.volume;
      const startTime = performance.now();

      const step = (now) => {
        const p = clamp((now - startTime) / durationMs, 0, 1);
        this.audioEl.volume = clamp(lerp(startVolume, targetVolume, easeInOutSine(p)), 0, 1);
        if (p < 1) {
          this.fadeRaf = requestAnimationFrame(step);
        } else {
          this.fadeRaf = null;
          if (onDone) onDone();
        }
      };

      this.fadeRaf = requestAnimationFrame(step);
    }

    // Gentle ethereal harp arpeggio fallback ONLY if local audio cannot play
    startFairyHarpFallback() {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.synthCtx) {
        this.synthCtx = new AudioCtx();
        this.synthGain = this.synthCtx.createGain();
        this.synthGain.gain.value = 0.0001;
        this.synthGain.connect(this.synthCtx.destination);
      }

      if (this.synthCtx.state === "suspended") {
        this.synthCtx.resume();
      }

      const now = this.synthCtx.currentTime;
      this.synthGain.gain.cancelScheduledValues(now);
      this.synthGain.gain.setTargetAtTime(0.16, now, 0.8);

      // Dreamy descending harp chords reminiscent of a fairy fountain atmosphere
      const phrases = [
        [880, 783.99, 659.25, 587.33, 880, 783.99, 659.25, 523.25],
        [783.99, 698.46, 587.33, 523.25, 783.99, 698.46, 587.33, 493.88],
        [739.99, 659.25, 554.37, 493.88, 739.99, 659.25, 554.37, 440.0],
        [698.46, 622.25, 523.25, 466.16, 698.46, 622.25, 523.25, 440.0],
      ];

      const pluck = () => {
        if (!this.isPlaying || !this.synthCtx) return;
        const bar = Math.floor(this.synthStep / 8) % phrases.length;
        const note = phrases[bar][this.synthStep % 8];
        this.synthStep++;

        const t = this.synthCtx.currentTime;
        const osc = this.synthCtx.createOscillator();
        const overtone = this.synthCtx.createOscillator();
        const env = this.synthCtx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(note, t);
        overtone.type = "triangle";
        overtone.frequency.setValueAtTime(note * 2, t);

        const overGain = this.synthCtx.createGain();
        overGain.gain.value = 0.14;

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(0.32, t + 0.03);
        env.gain.exponentialRampToValueAtTime(0.0008, t + 2.6);

        osc.connect(env);
        overtone.connect(overGain);
        overGain.connect(env);
        env.connect(this.synthGain);

        osc.start(t);
        overtone.start(t);
        osc.stop(t + 2.7);
        overtone.stop(t + 2.7);
      };

      pluck();
      this.synthTimer = setInterval(pluck, 430);
    }

    stopFairyHarpFallback() {
      if (this.synthTimer) {
        clearInterval(this.synthTimer);
        this.synthTimer = null;
      }
      if (this.synthCtx && this.synthGain) {
        const now = this.synthCtx.currentTime;
        this.synthGain.gain.cancelScheduledValues(now);
        this.synthGain.gain.setTargetAtTime(0.0001, now, 0.2);
      }
    }
  }

  /* ------------------------------------------------------------------------
     4. Pre-Rendered Radial Glow Sprite Atlas (Ultra-Fast 60fps Bloom Glow)
     ------------------------------------------------------------------------ */
  function createGlowAtlas() {
    const specs = {
      gold: ["rgba(255, 248, 224, 1)", "rgba(244, 208, 140, 0.55)", "rgba(230, 165, 80, 0.14)"],
      pink: ["rgba(255, 242, 247, 1)", "rgba(247, 172, 202, 0.52)", "rgba(218, 108, 152, 0.14)"],
      lavender: ["rgba(248, 240, 255, 1)", "rgba(200, 168, 233, 0.52)", "rgba(138, 92, 202, 0.14)"],
      pearl: ["rgba(255, 253, 248, 1)", "rgba(232, 236, 255, 0.48)", "rgba(166, 180, 242, 0.12)"],
    };

    const sprites = {};
    const size = 96;
    const half = size / 2;

    for (const [key, stops] of Object.entries(specs)) {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const gctx = c.getContext("2d");
      const grad = gctx.createRadialGradient(half, half, 0, half, half, half);
      grad.addColorStop(0, stops[0]);
      grad.addColorStop(0.28, stops[1]);
      grad.addColorStop(0.65, stops[2]);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, size, size);
      sprites[key] = c;
    }

    return sprites;
  }

  /* ------------------------------------------------------------------------
     5. Mathematical Procedural Peony Bloom Head
     Generates multi-whorl ruffled Bezier peony petals, radial silk veins,
     3D cup foreshortening, glowing stamen center, and smart offscreen caching.
     ------------------------------------------------------------------------ */
  class PeonyHead {
    constructor(options) {
      this.radius = options.radius;
      this.palette = options.palette;
      this.depth = options.depth; // 0 = far background, 1 = foreground hero
      this.bloomStart = options.bloomStart;
      this.bloomDuration = options.bloomDuration;
      this.budStart = options.budStart;
      this.budDuration = options.budDuration;
      this.facingTilt = options.facingTilt; // Vertical perspective squash (0.68 - 0.94)
      this.tiltAngle = options.tiltAngle; // Natural resting angle
      this.tierScale = options.tierScale || 1; // Quality tier multiplier
      this.seed = options.seed;
      this.sparkleEmitted = false;

      // Offscreen cache baked once the flower finishes blooming for silky 60fps sway
      this.bakedCanvas = null;
      this.bakedHalfSize = 0;

      this.sepals = [];
      this.petals = [];
      this.stamens = [];

      this.generateGeometry();
    }

    generateGeometry() {
      const rng = createRng(this.seed);

      // 5 cupped botanical sepals beneath the bud
      for (let i = 0; i < 5; i++) {
        this.sepals.push({
          angle: (i / 5) * TAU + (rng() - 0.5) * 0.25,
          length: this.radius * (0.48 + rng() * 0.14),
          width: this.radius * (0.2 + rng() * 0.05),
          curl: 0.4 + rng() * 0.35,
        });
      }

      // Concentric whorls of lush ruffled peony petals (outermost -> innermost)
      // Scaled gracefully with device quality & depth
      const density = clamp(this.tierScale * (0.72 + this.depth * 0.35), 0.58, 1.12);
      const whorls = [
        {
          // Tier 0: Broad outer guard petals (unfurl first)
          count: Math.max(5, Math.round(7 * density)),
          lenMul: 1.02,
          widMul: 0.62,
          baseDist: 0.14,
          openOffset: 0.0,
          openSpan: 0.38,
          shadeLevel: 0,
          ruffleAmp: 0.085,
          cupFactor: 1.0,
        },
        {
          // Tier 1: Outer-mid silky petals
          count: Math.max(6, Math.round(9 * density)),
          lenMul: 0.9,
          widMul: 0.56,
          baseDist: 0.12,
          openOffset: 0.14,
          openSpan: 0.38,
          shadeLevel: 1,
          ruffleAmp: 0.1,
          cupFactor: 0.94,
        },
        {
          // Tier 2: Full ruffled middle petals
          count: Math.max(6, Math.round(10 * density)),
          lenMul: 0.76,
          widMul: 0.48,
          baseDist: 0.1,
          openOffset: 0.3,
          openSpan: 0.38,
          shadeLevel: 2,
          ruffleAmp: 0.115,
          cupFactor: 0.86,
        },
        {
          // Tier 3: Velvety inner-mid petals
          count: Math.max(5, Math.round(9 * density)),
          lenMul: 0.6,
          widMul: 0.4,
          baseDist: 0.08,
          openOffset: 0.48,
          openSpan: 0.36,
          shadeLevel: 3,
          ruffleAmp: 0.125,
          cupFactor: 0.78,
        },
        {
          // Tier 4: Luminous ruffled inner crown petals cradling the golden heart
          count: Math.max(5, Math.round(7 * density)),
          lenMul: 0.42,
          widMul: 0.31,
          baseDist: 0.05,
          openOffset: 0.64,
          openSpan: 0.34,
          shadeLevel: 4,
          ruffleAmp: 0.13,
          cupFactor: 0.68,
        },
      ];

      let globalIdx = 0;
      whorls.forEach((whorl, wIdx) => {
        const baseAngle = wIdx * GOLDEN_ANGLE + rng() * TAU;
        for (let i = 0; i < whorl.count; i++) {
          const frac = i / whorl.count;
          const angle = baseAngle + frac * TAU + (rng() - 0.5) * (TAU / whorl.count) * 0.34;
          const staggerWithinWhorl = (i / whorl.count) * 0.14 + rng() * 0.05;
          const openStart = clamp(whorl.openOffset + staggerWithinWhorl, 0, 0.84);
          const openDuration = clamp(whorl.openSpan * (0.86 + rng() * 0.28), 0.16, 1 - openStart);

          this.petals.push({
            id: globalIdx++,
            whorlIdx: wIdx,
            angle,
            length: this.radius * whorl.lenMul * (0.9 + rng() * 0.2),
            width: this.radius * whorl.widMul * (0.88 + rng() * 0.24),
            baseDist: this.radius * whorl.baseDist * (0.85 + rng() * 0.3),
            openStart,
            openDuration,
            shadeLevel: whorl.shadeLevel,
            ruffleAmp: whorl.ruffleAmp * (0.85 + rng() * 0.35),
            rufflePhase1: rng() * TAU,
            rufflePhase2: rng() * TAU,
            asymmetry: (rng() - 0.5) * 0.18,
            notchDepth: 0.04 + rng() * 0.08,
            cupFactor: whorl.cupFactor,
            twist: (rng() - 0.5) * 0.16,
            toneShift: (rng() - 0.5) * 0.16, // Individual petal silk sheen variation
          });
        }
      });

      // Warm golden stamens clustered inside the peony heart
      const stamenCount = Math.round(22 * density);
      for (let i = 0; i < stamenCount; i++) {
        const a = i * GOLDEN_ANGLE + (rng() - 0.5) * 0.3;
        const r = Math.sqrt((i + 0.5) / stamenCount) * this.radius * 0.22;
        this.stamens.push({
          angle: a,
          dist: r,
          tipSize: Math.max(1.1, this.radius * (0.025 + rng() * 0.022)),
          height: this.radius * (0.08 + rng() * 0.1),
        });
      }
    }

    // Draw a single mathematically ruffled silk peony petal in local coordinates
    drawSinglePetal(ctx, petal, openP) {
      if (openP <= 0.005) return;

      const eased = easeOutCubic(openP);
      const unfold = easeOutQuint(openP);

      // In Canvas 2D, a petal drawn along -Y rotated by `angle` points to (sin(angle), -cos(angle)):
      // cos(angle) = +1 => pointing UP (far back of cup); cos(angle) = -1 => pointing DOWN (front lip).
      const cosA = Math.cos(petal.angle);
      const sinA = Math.sin(petal.angle);
      const perspectiveLen = lerp(0.76, 1.07, (-cosA + 1) * 0.5);
      const tiltSquash = lerp(1, this.facingTilt, Math.abs(cosA));

      // Directional moonlight factor from the upper-right moon (azimuth ~ 0.65 rad)
      const moonCatch = clamp(0.5 + 0.5 * Math.cos(petal.angle - 0.65), 0, 1);

      const L = petal.length * lerp(0.24, 1.0, eased) * perspectiveLen * tiltSquash;
      const W = petal.width * lerp(0.32, 1.0, unfold);
      const radialOffset = petal.baseDist * eased;

      // Subtle opening outward curl
      const dynamicAngle = petal.angle + petal.twist * (1 - eased);

      ctx.save();
      ctx.rotate(dynamicAngle);
      ctx.translate(0, -radialOffset);

      // Construct ruffled peony petal silhouette with smooth flanks & harmonic ruffled crest
      const baseHalfW = W * 0.22;
      const shoulderY = -L * 0.62;
      const asym = petal.asymmetry * W;

      ctx.beginPath();
      ctx.moveTo(-baseHalfW, 0);

      // Left silky curved flank
      ctx.bezierCurveTo(
        -W * 0.72,
        -L * 0.16,
        -W * 1.08 + asym * 0.3,
        -L * 0.44,
        -W * 0.88 + asym * 0.4,
        shoulderY
      );

      // Mathematical harmonic ruffled outer lip (7 organic wave points along the silk crest)
      const crestSteps = 7;
      let prevX = -W * 0.88 + asym * 0.4;
      let prevY = shoulderY;

      for (let s = 1; s <= crestSteps; s++) {
        const u = s / crestSteps; // 0 (left) -> 1 (right)
        const theta = lerp(-Math.PI * 0.44, Math.PI * 0.44, u);
        // Classic peony central petal cleft + dual harmonic organic ruffle
        const cleft = -Math.exp(-Math.pow((u - 0.5) * 5.2, 2)) * petal.notchDepth * L * eased;
        const ruffle =
          (Math.sin(u * Math.PI * 3 + petal.rufflePhase1) * 0.65 +
            Math.sin(u * Math.PI * 5 + petal.rufflePhase2) * 0.35) *
          petal.ruffleAmp *
          L *
          eased;

        const targetX = Math.sin(theta) * W * 0.94 + asym * Math.cos(theta);
        const targetY =
          -L * (0.62 + 0.38 * Math.cos(theta)) - ruffle - cleft;

        const ctrlX = (prevX + targetX) * 0.5;
        const ctrlY = Math.min(prevY, targetY) - L * 0.035;
        ctx.quadraticCurveTo(ctrlX, ctrlY, targetX, targetY);

        prevX = targetX;
        prevY = targetY;
      }

      // Right silky curved flank back to claw base
      ctx.bezierCurveTo(
        W * 1.08 + asym * 0.3,
        -L * 0.44,
        W * 0.72,
        -L * 0.16,
        baseHalfW,
        0
      );
      ctx.closePath();

      // Painterly multi-stop silk gradient (ambient occlusion base -> translucent moonlit edge)
      const grad = ctx.createLinearGradient(0, 4, 0, -L * 1.06);
      const pal = this.palette;
      const lvl = petal.shadeLevel;

      if (lvl === 0) {
        // Outer guard petals: deeper shadows catching soft moonlight at rim
        grad.addColorStop(0, pal.shadow);
        grad.addColorStop(0.32, pal.deep);
        grad.addColorStop(0.76, pal.mid);
        grad.addColorStop(1, pal.light);
      } else if (lvl === 1) {
        grad.addColorStop(0, pal.shadow);
        grad.addColorStop(0.24, pal.deep);
        grad.addColorStop(0.68, pal.mid);
        grad.addColorStop(0.94, pal.light);
        grad.addColorStop(1, pal.rim);
      } else if (lvl === 2) {
        grad.addColorStop(0, pal.deep);
        grad.addColorStop(0.42, pal.mid);
        grad.addColorStop(0.84, pal.light);
        grad.addColorStop(1, pal.rim);
      } else if (lvl === 3) {
        grad.addColorStop(0, pal.deep);
        grad.addColorStop(0.28, pal.mid);
        grad.addColorStop(0.74, pal.light);
        grad.addColorStop(1, pal.rim);
      } else {
        // Inner crown: warm silky cream-blush glow
        grad.addColorStop(0, pal.mid);
        grad.addColorStop(0.45, pal.light);
        grad.addColorStop(1, pal.rim);
      }

      ctx.fillStyle = grad;
      ctx.fill();

      // Directional moonlight sheen / velvet shadow variation so adjacent petals never blend flat
      const lightBias = (moonCatch - 0.45) * 0.22 + petal.toneShift;
      if (lightBias > 0.02) {
        ctx.fillStyle = `rgba(255, 248, 238, ${clamp(lightBias, 0, 0.18)})`;
        ctx.fill();
      } else if (lightBias < -0.02) {
        ctx.fillStyle = `rgba(26, 8, 38, ${clamp(-lightBias, 0, 0.18)})`;
        ctx.fill();
      }

      // Subtle translucent silk veining radiating from the base
      if (this.radius > 18 && openP > 0.25) {
        ctx.save();
        ctx.strokeStyle = pal.vein;
        ctx.lineWidth = Math.max(0.45, this.radius * 0.011);
        ctx.beginPath();
        for (let v = -1; v <= 1; v++) {
          const vx = v * W * 0.34;
          const vy = -L * (v === 0 ? 0.74 : 0.62);
          ctx.moveTo(v * baseHalfW * 0.4, -L * 0.04);
          ctx.quadraticCurveTo(vx * 0.55, -L * 0.36, vx, vy);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Gossamer moonlit rim-light (brighter on petals facing the upper-right moon)
      const rimAlpha = lerp(0.14, lvl >= 3 ? 0.46 : 0.32, moonCatch);
      ctx.strokeStyle = `rgba(255, 248, 244, ${rimAlpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(0.55, this.radius * 0.014);
      ctx.stroke();

      ctx.restore();
    }

    // Draw the plump, silky wrapped peony bud prior to full blooming
    drawBud(ctx, budP, bloomP) {
      if (budP <= 0.01 || bloomP > 0.55) return;

      const swell = easeOutCubic(budP);
      const fadeOut = 1 - invLerp(0.18, 0.55, bloomP);
      const r = this.radius * 0.38 * swell;
      const pal = this.palette;

      ctx.save();
      ctx.globalAlpha = fadeOut;

      // Plump spherical peony bud body
      const budGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r * 1.15);
      budGrad.addColorStop(0, pal.rim);
      budGrad.addColorStop(0.4, pal.light);
      budGrad.addColorStop(0.78, pal.mid);
      budGrad.addColorStop(1, pal.shadow);

      ctx.beginPath();
      ctx.ellipse(0, -r * 0.12, r * 0.96, r * 1.08, 0, 0, TAU);
      ctx.fillStyle = budGrad;
      ctx.fill();

      // Wrapped overlapping bud petal seams
      ctx.strokeStyle = "rgba(75, 22, 52, 0.28)";
      ctx.lineWidth = Math.max(0.7, this.radius * 0.016);
      ctx.beginPath();
      ctx.arc(-r * 0.28, -r * 0.05, r * 0.72, -1.1, 0.9);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(r * 0.32, -r * 0.1, r * 0.68, 2.1, 4.1);
      ctx.stroke();

      ctx.restore();
    }

    // Draw cupped botanical sepals behind the bud/bloom
    drawSepals(ctx, budP, bloomP) {
      if (budP <= 0.01) return;
      const grow = easeOutCubic(budP);
      const openOut = easeOutCubic(bloomP);

      ctx.save();
      for (const s of this.sepals) {
        const len = s.length * grow * lerp(0.85, 1.08, openOut);
        const wid = s.width * grow;
        ctx.save();
        ctx.rotate(s.angle);
        ctx.translate(0, -this.radius * 0.08 * openOut);

        ctx.beginPath();
        ctx.moveTo(-wid * 0.45, 0);
        ctx.quadraticCurveTo(-wid * 0.72, -len * 0.52, 0, -len);
        ctx.quadraticCurveTo(wid * 0.72, -len * 0.52, wid * 0.45, 0);
        ctx.closePath();

        const g = ctx.createLinearGradient(0, 0, 0, -len);
        g.addColorStop(0, CONFIG.foliage.calyxDark);
        g.addColorStop(0.7, CONFIG.foliage.calyxMid);
        g.addColorStop(1, "#4e7c6d");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // Draw glowing golden stamen heart revealed as inner petals unfurl
    drawHeart(ctx, bloomP) {
      const heartP = invLerp(0.48, 0.96, bloomP);
      if (heartP <= 0.01) return;

      const eased = easeOutCubic(heartP);
      const r = this.radius * 0.28 * eased;

      ctx.save();
      // Soft golden inner warmth glow
      const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.9);
      glowGrad.addColorStop(0, "rgba(255, 245, 206, 0.92)");
      glowGrad.addColorStop(0.38, "rgba(244, 208, 140, 0.55)");
      glowGrad.addColorStop(0.75, "rgba(232, 168, 92, 0.16)");
      glowGrad.addColorStop(1, "rgba(232, 168, 92, 0)");

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.9, 0, TAU);
      ctx.fill();

      // Delicate filaments + golden anthers
      for (const st of this.stamens) {
        const sx = Math.cos(st.angle) * st.dist * eased;
        const sy = Math.sin(st.angle) * st.dist * this.facingTilt * eased;

        ctx.strokeStyle = "rgba(246, 204, 128, 0.55)";
        ctx.lineWidth = Math.max(0.55, this.radius * 0.012);
        ctx.beginPath();
        ctx.moveTo(sx * 0.25, sy * 0.25);
        ctx.lineTo(sx, sy - st.height * 0.22 * eased);
        ctx.stroke();

        ctx.fillStyle = this.palette.heart;
        ctx.beginPath();
        ctx.arc(sx, sy - st.height * 0.22 * eased, st.tipSize * eased, 0, TAU);
        ctx.fill();
      }

      ctx.restore();
    }

    // Render complete peony geometry at a given budProgress and bloomProgress
    renderLive(ctx, budP, bloomP) {
      ctx.save();
      ctx.rotate(this.tiltAngle);

      // 1. Calyx & sepals behind everything
      this.drawSepals(ctx, budP, bloomP);

      // 2. Draw petal whorls strictly from outer guard petals inward.
      //    Keep the plump wrapped bud core nestled between outer guard petals (whorls 0-1)
      //    and unfolding inner whorls (whorls 2-4) for a seamless, pop-free botanical bloom!
      let budDrawn = false;
      if (bloomP > 0.005) {
        let currentWhorl = -1;
        for (let i = 0; i < this.petals.length; i++) {
          const p = this.petals[i];

          // Render bud core right after outer whorls (0 & 1) before inner whorls unfurl out of it
          if (!budDrawn && p.whorlIdx >= 2) {
            this.drawBud(ctx, budP, bloomP);
            budDrawn = true;
          }

          const petalP = invLerp(p.openStart, p.openStart + p.openDuration, bloomP);
          if (petalP <= 0.005) continue;

          // Subtle soft core ambient shadow between whorls for genuine 3D cup depth
          if (p.whorlIdx !== currentWhorl && p.whorlIdx > 0) {
            currentWhorl = p.whorlIdx;
            const shadowR = this.radius * (0.76 - p.whorlIdx * 0.13) * easeOutCubic(bloomP);
            const ao = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, shadowR));
            ao.addColorStop(0, "rgba(22, 6, 30, 0.34)");
            ao.addColorStop(0.65, "rgba(38, 12, 42, 0.12)");
            ao.addColorStop(1, "rgba(38, 12, 42, 0)");
            ctx.fillStyle = ao;
            ctx.beginPath();
            ctx.ellipse(0, 0, shadowR, shadowR * this.facingTilt, 0, 0, TAU);
            ctx.fill();
          }

          this.drawSinglePetal(ctx, p, petalP);
        }
      }

      if (!budDrawn) {
        this.drawBud(ctx, budP, bloomP);
      }

      // 3. Luminous golden stamen heart
      if (bloomP > 0.005) {
        this.drawHeart(ctx, bloomP);
      }

      ctx.restore();
    }

    // Bake full bloom onto a crisp offscreen canvas so 45+ peonies sway at 60 FPS
    bakeFullBloom(dpr) {
      const pad = Math.ceil(this.radius * 1.48);
      const logicalSize = pad * 2;
      const scale = Math.min(dpr, 2);
      const off = document.createElement("canvas");
      off.width = Math.max(2, Math.ceil(logicalSize * scale));
      off.height = Math.max(2, Math.ceil(logicalSize * scale));
      const octx = off.getContext("2d");
      octx.scale(scale, scale);
      octx.translate(pad, pad);
      this.renderLive(octx, 1, 1);

      this.bakedCanvas = off;
      this.bakedHalfSize = pad;
    }

    draw(ctx, x, y, budP, bloomP, windRot, breatheScale, dpr, glowSprites) {
      if (budP <= 0.005) return;

      // Soft magical halo behind blooming peony
      if (glowSprites && bloomP > 0.06) {
        const sprite = glowSprites[this.palette.glow] || glowSprites.pink;
        const haloR = this.radius * lerp(1.15, 2.25, easeOutCubic(bloomP));
        const haloAlpha = lerp(0.05, 0.24 + this.depth * 0.14, easeOutCubic(bloomP));
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = haloAlpha;
        ctx.drawImage(sprite, x - haloR, y - haloR, haloR * 2, haloR * 2);
        ctx.restore();
      }

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(windRot);
      ctx.scale(breatheScale, breatheScale);

      // Subtle atmospheric perspective dimming for distant background peonies
      if (this.depth < 0.35) {
        ctx.globalAlpha = lerp(0.72, 0.94, this.depth / 0.35);
      }

      if (bloomP >= 0.999) {
        if (!this.bakedCanvas) {
          this.bakeFullBloom(dpr);
        }
        const half = this.bakedHalfSize;
        ctx.drawImage(this.bakedCanvas, -half, -half, half * 2, half * 2);
      } else {
        this.renderLive(ctx, budP, bloomP);
      }

      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------------
     6. Peony Plant (Stem, Compound Peony Foliage, Secondary Branch & Blooms)
     ------------------------------------------------------------------------ */
  class PeonyPlant {
    constructor(cfg) {
      this.id = cfg.id;
      this.depth = cfg.depth; // 0 (far) .. 1 (hero foreground)
      this.rootX = cfg.rootX;
      this.rootY = cfg.rootY;
      this.tipX = cfg.tipX;
      this.tipY = cfg.tipY;
      this.ctrl1X = cfg.ctrl1X;
      this.ctrl1Y = cfg.ctrl1Y;
      this.ctrl2X = cfg.ctrl2X;
      this.ctrl2Y = cfg.ctrl2Y;
      this.stemWidth = cfg.stemWidth;

      // Timeline normalized triggers [0..1]
      this.stemStart = cfg.stemStart;
      this.stemDuration = cfg.stemDuration;

      // Wind characteristics
      this.windPhase = cfg.windPhase;
      this.windAmp = cfg.windAmp;
      this.windFreq = cfg.windFreq;
      this.localImpulse = 0; // Interactive breeze nudge from pointer/touch

      // Botanical compound leaves along main stem
      this.leaves = cfg.leaves;

      // Primary peony bloom head at main stem tip
      this.primaryHead = cfg.primaryHead;

      // Optional secondary curving branch with companion bloom or plump bud
      this.branch = cfg.branch || null;

      // Glow spark color at root during gathering stage
      this.sparkColor = cfg.primaryHead.palette.glow;
      this.rootReached = false;
    }

    getStemControlPoints(windOffset) {
      const p0 = { x: this.rootX, y: this.rootY };
      const p1 = { x: this.ctrl1X + windOffset * 0.25, y: this.ctrl1Y };
      const p2 = { x: this.ctrl2X + windOffset * 0.65, y: this.ctrl2Y };
      const p3 = { x: this.tipX + windOffset, y: this.tipY + Math.abs(windOffset) * 0.08 };
      return [p0, p1, p2, p3];
    }

    drawTaperedStem(ctx, p0, p1, p2, p3, growP, baseWidth) {
      if (growP <= 0.005) return null;

      const steps = 16;
      const maxT = easeOutCubic(growP);
      const pts = [];

      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * maxT;
        pts.push(cubicBezierPoint(p0, p1, p2, p3, t));
      }

      // Draw botanical stem stroke with moonlit gradient
      const grad = ctx.createLinearGradient(p0.x, p0.y, p3.x, p3.y);
      grad.addColorStop(0, CONFIG.foliage.stemBase);
      grad.addColorStop(0.55, CONFIG.foliage.stemMid);
      grad.addColorStop(1, CONFIG.foliage.stemTip);

      ctx.save();
      ctx.lineCap = "round";

      // Segmented taper so stem is naturally thicker near earth and slender near flower neck
      for (let i = 0; i < pts.length - 1; i++) {
        const frac = i / steps;
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1.1, baseWidth * lerp(1.0, 0.44, frac));
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
        ctx.stroke();
      }

      // Faint moonlight rim highlight along stem
      ctx.strokeStyle = CONFIG.foliage.stemHighlight;
      ctx.lineWidth = Math.max(0.6, baseWidth * 0.24);
      ctx.beginPath();
      ctx.moveTo(pts[0].x - baseWidth * 0.18, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x - baseWidth * 0.16, pts[i].y);
      }
      ctx.stroke();

      ctx.restore();
      return pts[pts.length - 1];
    }

    // Draw authentic compound peony foliage (3-leaflet biternate fan on graceful petiole)
    drawCompoundLeaf(ctx, origin, stemAngle, leaf, leafP) {
      if (leafP <= 0.005) return;

      const grow = easeOutCubic(leafP);
      const spread = easeOutCubic(invLerp(0.12, 1.0, leafP));

      ctx.save();
      ctx.translate(origin.x, origin.y);
      const baseAngle = stemAngle + leaf.side * (0.62 + leaf.angleJitter) * lerp(0.45, 1.0, spread);
      ctx.rotate(baseAngle);

      // Slender petiole stem
      const petioleLen = leaf.size * 0.34 * grow;
      ctx.strokeStyle = CONFIG.foliage.stemMid;
      ctx.lineWidth = Math.max(0.9, this.stemWidth * 0.36);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(petioleLen * 0.5, -leaf.side * petioleLen * 0.14, petioleLen, 0);
      ctx.stroke();

      ctx.translate(petioleLen, 0);

      // 3 graceful pointed lance-ovate peony leaflets (center + two flanking lobes)
      const leaflets = [
        { ang: 0, len: leaf.size * 1.0, wid: leaf.size * 0.31 },
        { ang: -0.58 * spread, len: leaf.size * 0.78, wid: leaf.size * 0.25 },
        { ang: 0.58 * spread, len: leaf.size * 0.74, wid: leaf.size * 0.24 },
      ];

      for (const lf of leaflets) {
        const L = lf.len * grow;
        const W = lf.wid * grow;

        ctx.save();
        ctx.rotate(lf.ang);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(L * 0.26, -W * 0.85, L * 0.68, -W * 0.72, L, 0);
        ctx.bezierCurveTo(L * 0.68, W * 0.72, L * 0.26, W * 0.85, 0, 0);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, -W, L, W);
        grad.addColorStop(0, CONFIG.foliage.leafDark);
        grad.addColorStop(0.55, CONFIG.foliage.leafMid);
        grad.addColorStop(1, CONFIG.foliage.leafLight);
        ctx.fillStyle = grad;
        ctx.fill();

        // Delicate moonlight edge + central midrib vein
        ctx.strokeStyle = CONFIG.foliage.leafRim;
        ctx.lineWidth = 0.65;
        ctx.stroke();

        ctx.strokeStyle = CONFIG.foliage.leafVein;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(L * 0.06, 0);
        ctx.lineTo(L * 0.84, 0);
        ctx.stroke();

        ctx.restore();
      }

      ctx.restore();
    }

    draw(ctx, normTime, elapsedSec, dpr, glowSprites, onBloomSparkle) {
      // Decay interactive touch/cursor wind impulse smoothly
      this.localImpulse *= 0.94;

      const stemP = invLerp(this.stemStart, this.stemStart + this.stemDuration, normTime);
      if (stemP <= 0.002) return;

      // Organic layered night breeze sway
      const windWave =
        Math.sin(elapsedSec * this.windFreq + this.windPhase) * 0.65 +
        Math.sin(elapsedSec * (this.windFreq * 0.43) + this.windPhase * 1.7) * 0.35;
      const windOffset = (windWave * this.windAmp + this.localImpulse) * easeOutCubic(stemP);

      const [p0, p1, p2, p3] = this.getStemControlPoints(windOffset);

      ctx.save();
      if (this.depth < 0.32) {
        ctx.globalAlpha = lerp(0.68, 0.92, this.depth / 0.32);
      }

      // 1. Main botanical stem
      const currentTip = this.drawTaperedStem(ctx, p0, p1, p2, p3, stemP, this.stemWidth);

      // 2. Compound peony leaves unfurling as the stem grows past each node
      const maxT = easeOutCubic(stemP);
      for (const leaf of this.leaves) {
        if (maxT <= leaf.t) continue;
        const leafP = invLerp(leaf.leafStart, leaf.leafStart + leaf.leafDuration, normTime);
        if (leafP <= 0.005) continue;

        const pos = cubicBezierPoint(p0, p1, p2, p3, leaf.t);
        const tan = cubicBezierTangent(p0, p1, p2, p3, leaf.t);
        const stemAngle = Math.atan2(tan.y, tan.x);
        this.drawCompoundLeaf(ctx, pos, stemAngle, leaf, leafP);
      }

      // 3. Optional secondary branch + companion peony or bud
      if (this.branch && maxT > this.branch.attachT) {
        const br = this.branch;
        const brP = invLerp(br.start, br.start + br.duration, normTime);
        if (brP > 0.005) {
          const anchor = cubicBezierPoint(p0, p1, p2, p3, br.attachT);
          const brWind = windOffset * 1.12;
          const bp0 = anchor;
          const bp1 = {
            x: anchor.x + br.dx * 0.42 + brWind * 0.35,
            y: anchor.y + br.dy * 0.48,
          };
          const bp2 = {
            x: anchor.x + br.dx * 0.8 + brWind * 0.72,
            y: anchor.y + br.dy * 0.85,
          };
          const bp3 = {
            x: anchor.x + br.dx + brWind,
            y: anchor.y + br.dy,
          };

          const brTip = this.drawTaperedStem(
            ctx,
            bp0,
            bp1,
            bp2,
            bp3,
            brP,
            this.stemWidth * 0.64
          );

          // Draw secondary bloom/bud
          if (brTip && brP > 0.65) {
            const bHead = br.head;
            const budP = invLerp(bHead.budStart, bHead.budStart + bHead.budDuration, normTime);
            const bloomP = invLerp(
              bHead.bloomStart,
              bHead.bloomStart + bHead.bloomDuration,
              normTime
            );
            const breathe = 1 + Math.sin(elapsedSec * 1.3 + this.windPhase + 1.2) * 0.015;
            bHead.draw(
              ctx,
              brTip.x,
              brTip.y,
              budP,
              bloomP,
              windOffset * 0.0085,
              breathe,
              dpr,
              glowSprites
            );

            if (!bHead.sparkleEmitted && bloomP > 0.42) {
              bHead.sparkleEmitted = true;
              onBloomSparkle(brTip.x, brTip.y, bHead.palette.glow, 8);
            }
          }
        }
      }

      // 4. Primary peony head at stem tip
      if (currentTip && stemP > 0.72) {
        const head = this.primaryHead;
        const budP = invLerp(head.budStart, head.budStart + head.budDuration, normTime);
        const bloomP = invLerp(head.bloomStart, head.bloomStart + head.bloomDuration, normTime);
        const breathe = 1 + Math.sin(elapsedSec * 1.1 + this.windPhase) * 0.016;
        const headRot = windOffset * 0.0095;

        head.draw(
          ctx,
          currentTip.x,
          currentTip.y,
          budP,
          bloomP,
          headRot,
          breathe,
          dpr,
          glowSprites
        );

        if (!head.sparkleEmitted && bloomP > 0.38) {
          head.sparkleEmitted = true;
          onBloomSparkle(currentTip.x, currentTip.y, head.palette.glow, 14);
        }
      }

      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------------
     7. Main Garden Scene Engine
     Handles Fantasy Night Backdrop, Gathering Light Particles, Staggered
     Blooming Choreography, Cinematic Camera Zoom-Out, and Interactive Magic.
     ------------------------------------------------------------------------ */
  class PeonyGardenScene {
    constructor(canvas, callbacks) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.callbacks = callbacks;

      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      this.glowSprites = createGlowAtlas();
      this.backdropCanvas = null;

      // Scene state: 'landing' | 'blooming' | 'complete'
      this.mode = "landing";
      this.bloomElapsed = 0;
      this.totalElapsed = 0;
      this.lastFrameTime = 0;
      this.messageTriggered = false;

      // Scene entities
      this.stars = [];
      this.shootingStars = [];
      this.plants = [];
      this.gatheringLights = [];
      this.fireflies = [];
      this.sparkles = [];
      this.driftingPetals = [];

      // Pointer interactivity
      this.lastPointer = null;

      this.computeQualityProfile();
      this.resize(true);
      this.bindEvents();
      this.startLoop();
    }

    computeQualityProfile() {
      const w = window.innerWidth;
      const cores = navigator.hardwareConcurrency || 4;
      const isNarrow = w < 640;
      const isTablet = w >= 640 && w < 1024;

      if (isNarrow || cores <= 4) {
        this.quality = {
          dprMax: isNarrow ? 1.65 : 1.85,
          plantCount: isNarrow ? 28 : 42,
          tierScale: isNarrow ? 0.78 : 0.9,
          starCount: isNarrow ? 95 : 130,
          fireflyCount: isNarrow ? 44 : 64,
          gatheringPerPlant: isNarrow ? 4 : 5,
          maxDriftingPetals: isNarrow ? 14 : 22,
          initialZoom: isNarrow ? 1.18 : 1.24,
        };
      } else if (isTablet) {
        this.quality = {
          dprMax: 2,
          plantCount: 44,
          tierScale: 0.95,
          starCount: 145,
          fireflyCount: 72,
          gatheringPerPlant: 5,
          maxDriftingPetals: 24,
          initialZoom: 1.25,
        };
      } else {
        this.quality = {
          dprMax: 2,
          plantCount: 56,
          tierScale: 1.05,
          starCount: 185,
          fireflyCount: 92,
          gatheringPerPlant: 6,
          maxDriftingPetals: 30,
          initialZoom: 1.28,
        };
      }
    }

    resize(isInitial = false) {
      this.computeQualityProfile();
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, this.quality.dprMax);

      this.canvas.width = Math.max(1, Math.floor(this.width * this.dpr));
      this.canvas.height = Math.max(1, Math.floor(this.height * this.dpr));
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      this.buildBackdropCache();
      this.buildStars();
      this.buildGardenPlants();
      this.buildFireflies();

      const normTime =
        this.mode === "landing"
          ? 0
          : clamp(this.bloomElapsed / CONFIG.durationSec, 0, 1);

      if (isInitial || this.mode === "landing" || normTime < 0.35) {
        this.buildGatheringLights();
      }

      // Prevent simultaneous sparkle bursts if resized mid-bloom or after full bloom
      if (this.mode !== "landing") {
        for (const plant of this.plants) {
          const pHead = plant.primaryHead;
          if (invLerp(pHead.bloomStart, pHead.bloomStart + pHead.bloomDuration, normTime) > 0.38) {
            pHead.sparkleEmitted = true;
          }
          if (plant.branch) {
            const bHead = plant.branch.head;
            if (invLerp(bHead.bloomStart, bHead.bloomStart + bHead.bloomDuration, normTime) > 0.42) {
              bHead.sparkleEmitted = true;
            }
          }
        }
      }
    }

    // Pre-render the dreamy twilight-midnight fantasy sky, moon, & distant misty garden hills
    buildBackdropCache() {
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.floor(this.width * this.dpr));
      c.height = Math.max(1, Math.floor(this.height * this.dpr));
      const bctx = c.getContext("2d");
      bctx.scale(this.dpr, this.dpr);

      const W = this.width;
      const H = this.height;

      // 1. Deep midnight-blue to royal-purple night sky gradient
      const sky = bctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#050714");
      sky.addColorStop(0.28, "#0b112c");
      sky.addColorStop(0.58, "#1b1038");
      sky.addColorStop(0.8, "#2a174a");
      sky.addColorStop(1, "#120a24");
      bctx.fillStyle = sky;
      bctx.fillRect(0, 0, W, H);

      // 2. Soft dreamy nebula washes (deep purple, twilight lavender, faint rose glow)
      const nebulae = [
        { x: W * 0.24, y: H * 0.28, r: Math.max(W, H) * 0.45, color: "rgba(92, 46, 148, 0.22)" },
        { x: W * 0.78, y: H * 0.22, r: Math.max(W, H) * 0.42, color: "rgba(58, 72, 152, 0.2)" },
        { x: W * 0.52, y: H * 0.55, r: Math.max(W, H) * 0.46, color: "rgba(148, 66, 128, 0.16)" },
      ];
      for (const n of nebulae) {
        const g = bctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        g.addColorStop(0, n.color);
        g.addColorStop(1, "rgba(0, 0, 0, 0)");
        bctx.fillStyle = g;
        bctx.fillRect(0, 0, W, H);
      }

      // 3. Soft glowing moon in upper sky
      const moonX = W * (W < 640 ? 0.78 : 0.8);
      const moonY = H * (W < 640 ? 0.15 : 0.18);
      const moonR = clamp(Math.min(W, H) * 0.046, 22, 44);

      const moonHalo = bctx.createRadialGradient(moonX, moonY, moonR * 0.3, moonX, moonY, moonR * 6.4);
      moonHalo.addColorStop(0, "rgba(255, 245, 220, 0.34)");
      moonHalo.addColorStop(0.22, "rgba(218, 198, 250, 0.16)");
      moonHalo.addColorStop(0.55, "rgba(142, 118, 212, 0.06)");
      moonHalo.addColorStop(1, "rgba(0, 0, 0, 0)");
      bctx.fillStyle = moonHalo;
      bctx.beginPath();
      bctx.arc(moonX, moonY, moonR * 6.4, 0, TAU);
      bctx.fill();

      const moonDisc = bctx.createRadialGradient(
        moonX - moonR * 0.22,
        moonY - moonR * 0.22,
        moonR * 0.1,
        moonX,
        moonY,
        moonR
      );
      moonDisc.addColorStop(0, "#fffdf5");
      moonDisc.addColorStop(0.75, "#f8e8c8");
      moonDisc.addColorStop(1, "#e6cb9c");
      bctx.fillStyle = moonDisc;
      bctx.beginPath();
      bctx.arc(moonX, moonY, moonR, 0, TAU);
      bctx.fill();

      // 4. Distant misty enchanted garden silhouettes (layered rolling hills)
      const drawHill = (baseY, amp, freq, phase, color) => {
        bctx.beginPath();
        bctx.moveTo(0, H);
        for (let x = 0; x <= W + 20; x += 20) {
          const y =
            baseY +
            Math.sin((x / W) * Math.PI * freq + phase) * amp +
            Math.cos((x / W) * Math.PI * (freq * 1.8) + phase) * (amp * 0.35);
          bctx.lineTo(x, y);
        }
        bctx.lineTo(W, H);
        bctx.closePath();
        bctx.fillStyle = color;
        bctx.fill();
      };

      drawHill(H * 0.78, H * 0.032, 1.5, 0.4, "rgba(24, 15, 48, 0.65)");
      drawHill(H * 0.85, H * 0.028, 1.9, 2.2, "rgba(16, 12, 36, 0.82)");
      drawHill(H * 0.92, H * 0.02, 2.2, 4.0, "rgba(10, 9, 25, 0.96)");

      // 5. Soft ground horizon luminescence (where light particles pool)
      const mist = bctx.createLinearGradient(0, H * 0.72, 0, H);
      mist.addColorStop(0, "rgba(196, 152, 232, 0)");
      mist.addColorStop(0.55, "rgba(162, 112, 206, 0.1)");
      mist.addColorStop(0.85, "rgba(232, 166, 198, 0.11)");
      mist.addColorStop(1, "rgba(12, 8, 26, 0.45)");
      bctx.fillStyle = mist;
      bctx.fillRect(0, H * 0.72, W, H * 0.28);

      this.backdropCanvas = c;
    }

    buildStars() {
      const rng = createRng(40219);
      this.stars = [];
      for (let i = 0; i < this.quality.starCount; i++) {
        this.stars.push({
          x: rng() * this.width,
          y: rng() * this.height * 0.72,
          r: 0.55 + Math.pow(rng(), 2.4) * 1.9,
          baseAlpha: 0.22 + rng() * 0.68,
          phase: rng() * TAU,
          speed: 0.6 + rng() * 2.1,
          tint: rng() < 0.22 ? "#ffe8c2" : rng() < 0.45 ? "#e8d7ff" : "#ffffff",
        });
      }
    }

    // Generate an abundant, artistically composed layered garden of peonies
    buildGardenPlants() {
      const rng = createRng(884217);
      const W = this.width;
      const H = this.height;
      const count = this.quality.plantCount;
      const isPortrait = H > W * 1.1;
      const minDim = Math.min(W, H);
      const baseRadius = clamp(minDim * (isPortrait ? 0.088 : 0.072), 26, 62);

      const plants = [];
      const heroCount = Math.min(7, Math.round(count * 0.16));
      const nonHeroCount = Math.max(1, count - heroCount);

      // Create 3 lush depth bands evenly across the ENTIRE width (far-left to far-right)
      // plus a balanced hero cluster so both edges and center are overflowing with peonies.
      for (let i = 0; i < count; i++) {
        const isHero = i < heroCount;

        // Depth (0 = far background, 1 = close foreground)
        // Decoupled from horizontal X via golden-ratio low-discrepancy sequence so left, center,
        // and right all contain a balanced mix of foreground, midground, and background blooms!
        let depth;
        let xNorm;

        if (isHero) {
          depth = 0.76 + rng() * 0.22;
          const heroSlots = [0.5, 0.36, 0.64, 0.22, 0.78, 0.09, 0.91];
          xNorm = clamp(heroSlots[i % heroSlots.length] + (rng() - 0.5) * 0.04, 0.03, 0.97);
        } else {
          const j = i - heroCount;
          const slot = lerp(-0.015, 1.015, (j + 0.5) / nonHeroCount);
          xNorm = clamp(slot + (rng() - 0.5) * (0.85 / nonHeroCount), -0.02, 1.02);

          const depthSeq = (j * 0.6180339887498949 + 0.19) % 1;
          depth = clamp(0.08 + depthSeq * 0.9 + (rng() - 0.5) * 0.08, 0.06, 0.99);
        }

        const rootX = xNorm * W;
        const rootY = H + 12 + (1 - depth) * 18;

        // Height: lush rolling garden meadow contour with both tall back blooms & lower foreground blooms
        const edgeLift = Math.abs(xNorm - 0.5) * 0.07;
        const heightFrac = isHero
          ? lerp(0.36, 0.53, rng())
          : lerp(0.18, 0.57, 0.25 + (1 - depth) * 0.4 + rng() * 0.36 + edgeLift);

        // Keep top sky open (~36-42% clear) so moon, stars, and romantic messages shine clearly!
        const clampedHeightFrac = clamp(heightFrac, 0.17, isPortrait ? 0.52 : 0.58);
        const stemHeight = H * clampedHeightFrac;

        // Natural gentle lean (keep edge flowers hugging close to screen edges so no left/right gap forms)
        const maxLean = W * (isPortrait ? 0.11 : 0.075);
        const lean = (rng() - 0.5) * maxLean;
        const tipX = clamp(rootX + lean, -W * 0.01, W * 1.01);
        const tipY = H - stemHeight;

        const curveDir = (rng() - 0.5) * 2;
        const ctrl1X = lerp(rootX, tipX, 0.32) + curveDir * stemHeight * 0.12;
        const ctrl1Y = lerp(rootY, tipY, 0.35);
        const ctrl2X = lerp(rootX, tipX, 0.7) - curveDir * stemHeight * 0.08;
        const ctrl2Y = lerp(rootY, tipY, 0.72);

        // Pick peony palette with balanced romantic harmony
        const palIndex = isHero
          ? i % CONFIG.peonyPalettes.length
          : Math.floor(rng() * CONFIG.peonyPalettes.length);
        const palette = CONFIG.peonyPalettes[palIndex];

        // Bloom size scaled by depth & organic variation
        const radius =
          baseRadius *
          lerp(0.56, 1.18, depth) *
          (isHero ? 1.14 : 0.84 + rng() * 0.34);

        // Choreographed normalized timeline (0.0 -> 1.0 over CONFIG.durationSec)
        // Stage 1 (0.00-0.08): Background awakens
        // Stage 2 (0.06-0.20): Light particles gather into soil
        // Stage 3 (0.13-0.38): Stems grow from earth
        // Stage 4 (0.22-0.48): Leaves & branches unfurl
        // Stage 5 (0.33-0.55): Plump buds form
        // Stage 6 (0.43-0.88): Peonies bloom one by one (hero cluster opens first!)
        // Stage 7 & 8 (0.82-1.00): Full radiant garden + cinematic camera zoom-out
        const centerDist = Math.abs(xNorm - 0.5) * 2; // 0 at center, 1 at edges
        const waveDelay = isHero
          ? i * 0.022
          : 0.05 + centerDist * 0.14 + rng() * 0.14;

        const stemStart = clamp(0.13 + waveDelay * 0.45, 0.12, 0.3);
        const stemDuration = 0.14 + rng() * 0.07;

        const budStart = clamp(stemStart + stemDuration * 0.78, 0.25, 0.46);
        const budDuration = 0.08 + rng() * 0.04;

        const bloomStart = isHero
          ? clamp(0.4 + i * 0.042, 0.39, 0.62)
          : clamp(0.46 + centerDist * 0.15 + rng() * 0.19, 0.45, 0.74);
        const bloomDuration = clamp(0.15 + rng() * 0.08, 0.13, 0.91 - bloomStart);

        // Compound leaves along each stem (2 to 4 alternating leaf clusters)
        const leafCount = depth > 0.5 ? 3 + (rng() > 0.5 ? 1 : 0) : 2 + (rng() > 0.45 ? 1 : 0);
        const leaves = [];
        for (let l = 0; l < leafCount; l++) {
          const t = lerp(0.24, 0.76, (l + 0.35) / leafCount) + (rng() - 0.5) * 0.05;
          const side = l % 2 === 0 ? 1 : -1;
          leaves.push({
            t: clamp(t, 0.18, 0.8),
            side,
            size: radius * (0.58 + rng() * 0.32),
            angleJitter: (rng() - 0.5) * 0.24,
            leafStart: clamp(stemStart + stemDuration * t * 0.95, 0.18, 0.46),
            leafDuration: 0.09 + rng() * 0.05,
          });
        }

        const primaryHead = new PeonyHead({
          radius,
          palette,
          depth,
          budStart,
          budDuration,
          bloomStart,
          bloomDuration,
          facingTilt: 0.74 + rng() * 0.2,
          tiltAngle: (rng() - 0.5) * 0.52,
          tierScale: this.quality.tierScale,
          seed: Math.floor(rng() * 1e9),
        });

        // Add graceful secondary branch with smaller peony or delicate bud on ~52% of plants
        let branch = null;
        if (rng() < 0.54 && stemHeight > H * 0.26) {
          const side = rng() > 0.5 ? 1 : -1;
          const attachT = 0.44 + rng() * 0.2;
          const bLen = stemHeight * (0.24 + rng() * 0.14);
          const bRadius = radius * (0.54 + rng() * 0.22);
          const bStart = clamp(stemStart + stemDuration * 0.65, 0.22, 0.42);
          const bDur = 0.11 + rng() * 0.04;
          const isStayingHalfBud = rng() < 0.22; // Keep a few tender half-open buds for botanical realism!

          branch = {
            attachT,
            dx: side * bLen * (0.55 + rng() * 0.38),
            dy: -bLen * (0.68 + rng() * 0.32),
            start: bStart,
            duration: bDur,
            head: new PeonyHead({
              radius: bRadius,
              palette,
              depth: clamp(depth - 0.08, 0.05, 0.95),
              budStart: clamp(bStart + bDur * 0.75, 0.32, 0.54),
              budDuration: 0.08,
              bloomStart: isStayingHalfBud
                ? 0.78
                : clamp(bloomStart + 0.06 + rng() * 0.08, 0.52, 0.78),
              bloomDuration: isStayingHalfBud ? 0.45 : 0.14,
              facingTilt: 0.72 + rng() * 0.22,
              tiltAngle: side * (0.2 + rng() * 0.35),
              tierScale: this.quality.tierScale * 0.85,
              seed: Math.floor(rng() * 1e9),
            }),
          };
        }

        plants.push(
          new PeonyPlant({
            id: i,
            depth,
            rootX,
            rootY,
            tipX,
            tipY,
            ctrl1X,
            ctrl1Y,
            ctrl2X,
            ctrl2Y,
            stemWidth: clamp(radius * 0.095, 2.2, 5.4),
            stemStart,
            stemDuration,
            windPhase: rng() * TAU,
            windAmp: lerp(6, 17, depth) * (this.reducedMotion ? 0.25 : 1),
            windFreq: 0.55 + rng() * 0.45,
            leaves,
            primaryHead,
            branch,
          })
        );
      }

      // Painter's algorithm: sort strictly back-to-front by depth!
      plants.sort((a, b) => a.depth - b.depth);
      this.plants = plants;
    }

    // Build luminous light-particle streams that gather into the soil during Stage 2
    buildGatheringLights() {
      const rng = createRng(99371);
      this.gatheringLights = [];

      for (const plant of this.plants) {
        for (let k = 0; k < this.quality.gatheringPerPlant; k++) {
          const startX = plant.rootX + (rng() - 0.5) * this.width * 0.34;
          const startY = this.height * (0.08 + rng() * 0.54);
          const arriveTime = clamp(plant.stemStart + (rng() - 0.5) * 0.04, 0.09, 0.28);
          const departTime = clamp(arriveTime - (0.07 + rng() * 0.07), 0.03, 0.2);

          this.gatheringLights.push({
            startX,
            startY,
            targetX: plant.rootX + (rng() - 0.5) * 18,
            targetY: this.height - 6 - rng() * 18,
            swirlAmp: (rng() - 0.5) * 90,
            departTime,
            arriveTime,
            size: 5 + rng() * 9,
            color: rng() < 0.48 ? "gold" : plant.sparkColor,
          });
        }
      }
    }

    buildFireflies() {
      const rng = createRng(55129);
      this.fireflies = [];
      const colors = ["gold", "pink", "lavender", "pearl"];
      for (let i = 0; i < this.quality.fireflyCount; i++) {
        const depth = rng();
        this.fireflies.push({
          x: rng() * this.width,
          y: rng() * this.height,
          vx: (rng() - 0.5) * 14,
          vy: -(4 + rng() * 12),
          size: lerp(4.5, 16, Math.pow(depth, 1.4)),
          phase: rng() * TAU,
          pulseSpeed: 1.1 + rng() * 2.2,
          color: colors[Math.floor(rng() * colors.length)],
          depth,
        });
      }
    }

    spawnSparkleBurst(x, y, colorKey, count = 12) {
      if (this.sparkles.length > 220) return;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * TAU;
        const speed = 12 + Math.random() * 44;
        this.sparkles.push({
          x,
          y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 18,
          life: 0,
          maxLife: 1.4 + Math.random() * 1.6,
          size: 4 + Math.random() * 8,
          color: Math.random() < 0.5 ? "gold" : colorKey,
        });
      }
    }

    spawnDriftingPetal() {
      if (this.driftingPetals.length >= this.quality.maxDriftingPetals) return;
      const pal = CONFIG.peonyPalettes[Math.floor(Math.random() * CONFIG.peonyPalettes.length)];
      this.driftingPetals.push({
        x: Math.random() * this.width * 1.1 - this.width * 0.05,
        y: -18 - Math.random() * 40,
        vx: 10 + Math.random() * 18,
        vy: 14 + Math.random() * 20,
        rot: Math.random() * TAU,
        vRot: (Math.random() - 0.5) * 1.4,
        swayPhase: Math.random() * TAU,
        size: 5 + Math.random() * 6.5,
        color: Math.random() < 0.5 ? pal.light : pal.rim,
        alpha: 0.35 + Math.random() * 0.42,
      });
    }

    // Start blooming journey (from Landing Page button or Replay)
    startBlooming() {
      this.mode = "blooming";
      this.bloomElapsed = 0;
      this.messageTriggered = false;
      this.sparkles = [];
      this.driftingPetals = [];

      // Reset bloom sparkle flags & clear caches only if needed
      for (const plant of this.plants) {
        plant.primaryHead.sparkleEmitted = false;
        if (plant.branch) plant.branch.head.sparkleEmitted = false;
      }
      this.buildGatheringLights();
    }

    // Compute smooth cinematic virtual camera (starts zoomed in on hero peonies -> zooms out to reveal whole garden)
    getCameraTransform(normTime) {
      if (this.mode === "landing") {
        return { zoom: 1.04, focusX: 0.5, focusY: 0.5 };
      }

      const startZoom = this.quality.initialZoom;
      // Gently breathe & slowly pull back from intimate hero blooms to grand garden panorama
      // Stage 8 grand zoom-out happens smoothly across normTime 0.78 -> 0.99
      const subtleDrift = easeInOutSine(invLerp(0.15, 0.78, normTime));
      const grandZoomOut = easeInOutCubic(invLerp(0.76, 0.99, normTime));

      const zoom =
        lerp(startZoom, startZoom - 0.06, subtleDrift) * (1 - grandZoomOut) +
        1.0 * grandZoomOut;

      const focusY = lerp(0.64, 0.5, grandZoomOut);
      const focusX = 0.5 + Math.sin(this.totalElapsed * 0.14) * 0.012 * (1 - grandZoomOut);

      return { zoom, focusX, focusY };
    }

    // Draw slowly breathing volumetric moonlight beams & ethereal aurora ribbons
    drawAtmosphere(ctx, normTime) {
      const W = this.width;
      const H = this.height;
      const t = this.totalElapsed;

      // 1. Twinkling starfield
      const skyVisibility = this.mode === "landing" ? 0.75 : lerp(0.5, 1.0, invLerp(0, 0.09, normTime));
      ctx.save();
      for (const s of this.stars) {
        const twinkle = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        ctx.globalAlpha = s.baseAlpha * twinkle * skyVisibility;
        ctx.fillStyle = s.tint;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
      }
      ctx.restore();

      // 2. Soft vertically-feathered aurora veil across upper sky (no hard band edges)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const auroraAlpha = (this.mode === "landing" ? 0.05 : 0.085) * skyVisibility;
      for (let i = 0; i < 2; i++) {
        const driftX = Math.sin(t * (0.14 + i * 0.05) + i * 2) * W * 0.08;
        const cx = W * (i === 0 ? 0.35 : 0.66) + driftX;
        const cy = H * (0.24 + i * 0.12) + Math.cos(t * 0.18 + i) * 14;
        const rx = W * 0.52;
        const ry = H * 0.16;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(i === 0 ? -0.07 : 0.06);
        ctx.scale(1, ry / rx);
        const aGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        aGrad.addColorStop(
          0,
          i === 0
            ? `rgba(176, 132, 242, ${auroraAlpha})`
            : `rgba(242, 152, 196, ${auroraAlpha * 0.85})`
        );
        aGrad.addColorStop(
          0.55,
          i === 0
            ? `rgba(116, 146, 242, ${auroraAlpha * 0.38})`
            : `rgba(244, 208, 140, ${auroraAlpha * 0.28})`
        );
        aGrad.addColorStop(1, "rgba(120, 82, 210, 0)");
        ctx.fillStyle = aGrad;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      // 3. Soft feathered volumetric moonlight wash illuminating the peony garden
      const moonX = W * (W < 640 ? 0.78 : 0.8);
      const moonY = H * (W < 640 ? 0.15 : 0.18);
      const beamBreath = 0.82 + 0.18 * Math.sin(t * 0.35);
      const washR = Math.max(W, H) * 0.72;
      const washX = lerp(moonX, W * 0.45, 0.38);
      const washY = lerp(moonY, H * 0.62, 0.38);
      const beamGrad = ctx.createRadialGradient(moonX, moonY, 10, washX, washY, washR);
      beamGrad.addColorStop(0, `rgba(255, 246, 224, ${0.085 * beamBreath * skyVisibility})`);
      beamGrad.addColorStop(0.45, `rgba(224, 202, 250, ${0.036 * beamBreath * skyVisibility})`);
      beamGrad.addColorStop(1, "rgba(224, 202, 250, 0)");

      ctx.fillStyle = beamGrad;
      ctx.fillRect(0, 0, W, H);

      ctx.restore();

      // 4. Rare poetic shooting star
      if (!this.reducedMotion && Math.random() < 0.0022 && this.shootingStars.length < 1) {
        this.shootingStars.push({
          x: W * (0.15 + Math.random() * 0.65),
          y: H * (0.06 + Math.random() * 0.22),
          vx: (Math.random() > 0.5 ? 1 : -1) * (240 + Math.random() * 140),
          vy: 90 + Math.random() * 65,
          life: 0,
          maxLife: 0.95 + Math.random() * 0.45,
        });
      }
    }

    drawShootingStars(ctx, dt) {
      if (!this.shootingStars.length) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (let i = this.shootingStars.length - 1; i >= 0; i--) {
        const s = this.shootingStars[i];
        s.life += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        const p = s.life / s.maxLife;
        if (p >= 1) {
          this.shootingStars.splice(i, 1);
          continue;
        }

        const alpha = Math.sin(p * Math.PI) * 0.85;
        const tailX = s.x - s.vx * 0.14;
        const tailY = s.y - s.vy * 0.14;

        const g = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
        g.addColorStop(0, "rgba(255, 245, 224, 0)");
        g.addColorStop(1, `rgba(255, 248, 232, ${alpha})`);

        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        const spr = this.glowSprites.gold;
        ctx.globalAlpha = alpha;
        ctx.drawImage(spr, s.x - 9, s.y - 9, 18, 18);
      }

      ctx.restore();
    }

    // Stage 2: Magical light particles streaming & gathering into the dark soil to awaken seeds
    drawGatheringLights(ctx, normTime) {
      if (this.mode === "landing" || normTime > 0.34) return;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (const g of this.gatheringLights) {
        const p = invLerp(g.departTime, g.arriveTime, normTime);
        if (p <= 0 || p >= 1.15) continue;

        const clampedP = clamp(p, 0, 1);
        const eased = easeInOutCubic(clampedP);
        const swirl = Math.sin(clampedP * Math.PI) * g.swirlAmp;
        const x = lerp(g.startX, g.targetX, eased) + swirl;
        const y = lerp(g.startY, g.targetY, eased);

        const fadeIn = invLerp(0, 0.18, clampedP);
        const fadeOut = 1 - invLerp(0.84, 1.0, clampedP);
        const alpha = fadeIn * fadeOut * 0.88;

        if (alpha > 0.01) {
          const spr = this.glowSprites[g.color] || this.glowSprites.gold;
          const sz = g.size * lerp(0.8, 1.35, Math.sin(clampedP * Math.PI));
          ctx.globalAlpha = alpha;
          ctx.drawImage(spr, x - sz, y - sz, sz * 2, sz * 2);
        }
      }

      // Soft luminous ground-seed glow along earth while stems awaken
      const soilPulse = Math.sin(invLerp(0.06, 0.34, normTime) * Math.PI);
      if (soilPulse > 0.01) {
        const soilGrad = ctx.createLinearGradient(0, this.height - 90, 0, this.height);
        soilGrad.addColorStop(0, "rgba(244, 208, 140, 0)");
        soilGrad.addColorStop(0.65, `rgba(244, 192, 168, ${0.14 * soilPulse})`);
        soilGrad.addColorStop(1, `rgba(244, 208, 140, ${0.28 * soilPulse})`);
        ctx.fillStyle = soilGrad;
        ctx.fillRect(0, this.height - 90, this.width, 90);
      }

      ctx.restore();
    }

    // Floating fireflies & glowing bokeh motes
    updateAndDrawFireflies(ctx, dt, minDepth, maxDepth, alphaMul = 1) {
      const W = this.width;
      const H = this.height;
      const t = this.totalElapsed;
      const moveScale = this.reducedMotion ? 0.25 : 1;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (const f of this.fireflies) {
        if (f.depth < minDepth || f.depth >= maxDepth) continue;

        f.x += (f.vx + Math.sin(t * 0.6 + f.phase) * 10) * dt * moveScale;
        f.y += f.vy * dt * moveScale;

        if (f.y < -25) {
          f.y = H + 20;
          f.x = Math.random() * W;
        }
        if (f.x < -30) f.x = W + 25;
        if (f.x > W + 30) f.x = -25;

        const pulse = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(t * f.pulseSpeed + f.phase));
        const spr = this.glowSprites[f.color] || this.glowSprites.gold;
        ctx.globalAlpha = pulse * lerp(0.32, 0.78, f.depth) * alphaMul;
        ctx.drawImage(spr, f.x - f.size, f.y - f.size, f.size * 2, f.size * 2);
      }

      ctx.restore();
    }

    updateAndDrawSparkles(ctx, dt) {
      if (!this.sparkles.length) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (let i = this.sparkles.length - 1; i >= 0; i--) {
        const sp = this.sparkles[i];
        sp.life += dt;
        if (sp.life >= sp.maxLife) {
          this.sparkles.splice(i, 1);
          continue;
        }
        sp.vx *= 0.985;
        sp.vy = sp.vy * 0.985 - 4 * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;

        const p = sp.life / sp.maxLife;
        const alpha = Math.sin(p * Math.PI) * 0.9;
        const sz = sp.size * (1 - p * 0.45);
        const spr = this.glowSprites[sp.color] || this.glowSprites.gold;
        ctx.globalAlpha = alpha;
        ctx.drawImage(spr, sp.x - sz, sp.y - sz, sz * 2, sz * 2);
      }

      ctx.restore();
    }

    updateAndDrawDriftingPetals(ctx, dt, normTime) {
      if (this.mode === "landing" || normTime < 0.52) return;

      if (!this.reducedMotion && Math.random() < 0.045) {
        this.spawnDriftingPetal();
      }

      const t = this.totalElapsed;
      ctx.save();
      for (let i = this.driftingPetals.length - 1; i >= 0; i--) {
        const pt = this.driftingPetals[i];
        pt.x += (pt.vx + Math.sin(t * 1.1 + pt.swayPhase) * 14) * dt;
        pt.y += pt.vy * dt;
        pt.rot += pt.vRot * dt;

        if (pt.y > this.height + 30 || pt.x > this.width + 40) {
          this.driftingPetals.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        ctx.scale(1, 0.65 + 0.35 * Math.sin(t * 2.2 + pt.swayPhase));
        ctx.globalAlpha = pt.alpha;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.moveTo(0, -pt.size);
        ctx.bezierCurveTo(pt.size * 0.9, -pt.size * 0.6, pt.size * 0.85, pt.size * 0.7, 0, pt.size);
        ctx.bezierCurveTo(-pt.size * 0.85, pt.size * 0.7, -pt.size * 0.9, -pt.size * 0.6, 0, -pt.size);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // Interactive breeze & fairy sparkles when user touches or moves over the garden
    handlePointerInteraction(clientX, clientY, isTap = false) {
      if (this.mode === "landing") return;

      // Spawn delicate fairy sparkles
      if (isTap) {
        this.spawnSparkleBurst(clientX, clientY, "pink", 12);
      } else if (Math.random() < 0.28) {
        this.spawnSparkleBurst(clientX, clientY, "gold", 1);
      }

      // Send a whisper of breeze through nearby peonies
      const dx = this.lastPointer ? clientX - this.lastPointer.x : 0;
      const push = isTap ? (Math.random() > 0.5 ? 16 : -16) : clamp(dx * 0.45, -18, 18);

      for (const plant of this.plants) {
        const dist = Math.hypot(plant.tipX - clientX, plant.tipY - clientY);
        if (dist < 170) {
          const influence = 1 - dist / 170;
          plant.localImpulse = clamp(plant.localImpulse + push * influence * 0.55, -26, 26);
        }
      }

      this.lastPointer = { x: clientX, y: clientY };
    }

    bindEvents() {
      let resizeTimer = null;
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => this.resize(false), 180);
      });

      this.canvas.addEventListener(
        "pointermove",
        (e) => this.handlePointerInteraction(e.clientX, e.clientY, false),
        { passive: true }
      );

      this.canvas.addEventListener(
        "pointerdown",
        (e) => this.handlePointerInteraction(e.clientX, e.clientY, true),
        { passive: true }
      );
    }

    renderFrame(now) {
      if (!this.lastFrameTime) this.lastFrameTime = now;
      const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
      this.lastFrameTime = now;
      this.totalElapsed += dt;

      if (this.mode === "blooming") {
        this.bloomElapsed += dt;
      }

      const normTime =
        this.mode === "landing"
          ? 0
          : clamp(this.bloomElapsed / CONFIG.durationSec, 0, 1);

      // Trigger romantic message sequence right after grand zoom-out finishes!
      if (this.mode === "blooming" && normTime >= 1 && !this.messageTriggered) {
        this.messageTriggered = true;
        this.mode = "complete";
        if (this.callbacks && this.callbacks.onGardenComplete) {
          this.callbacks.onGardenComplete();
        }
      }

      const ctx = this.ctx;
      const W = this.width;
      const H = this.height;

      ctx.save();
      ctx.scale(this.dpr, this.dpr);

      // Apply cinematic virtual camera transform
      const cam = this.getCameraTransform(normTime);
      ctx.translate(W * 0.5, H * 0.5);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-W * cam.focusX, -H * cam.focusY);

      // 1. Cached night sky, glowing moon & misty garden horizon
      if (this.backdropCanvas) {
        ctx.drawImage(this.backdropCanvas, 0, 0, W, H);
      }

      // Stage 1 gentle fade-in veil as landing screen dissolves
      if (this.mode !== "landing" && normTime < 0.08) {
        const veilAlpha = lerp(0.45, 0, easeOutCubic(normTime / 0.08));
        ctx.fillStyle = `rgba(6, 9, 24, ${veilAlpha})`;
        ctx.fillRect(-100, -100, W + 200, H + 200);
      }

      // 2. Twinkling stars, aurora veils, moonbeams & shooting stars
      this.drawAtmosphere(ctx, normTime);
      this.drawShootingStars(ctx, dt);

      // 3. Distant background fireflies (behind garden)
      this.updateAndDrawFireflies(ctx, dt, 0, 0.52, this.mode === "landing" ? 0.65 : 0.9);

      // 4. Stage 2: Gathering magical light particles streaming down to awaken the stems
      this.drawGatheringLights(ctx, normTime);

      // 5. Layered procedural peony garden (stems, compound leaves, buds, ruffled peonies)
      if (this.mode !== "landing") {
        const sparkleCb = (x, y, col, n) => this.spawnSparkleBurst(x, y, col, n);
        for (let i = 0; i < this.plants.length; i++) {
          this.plants[i].draw(ctx, normTime, this.totalElapsed, this.dpr, this.glowSprites, sparkleCb);
        }
      }

      // 6. Soft drifting silk petals & bloom sparkles
      this.updateAndDrawDriftingPetals(ctx, dt, normTime);
      this.updateAndDrawSparkles(ctx, dt);

      // 7. Foreground luminous fireflies & bokeh light motes
      this.updateAndDrawFireflies(ctx, dt, 0.52, 1.01, this.mode === "landing" ? 0.85 : 1.0);

      // 8. Soft luminous mist hugging the lower edge of the garden
      const groundMist = ctx.createLinearGradient(0, H * 0.88, 0, H + 20);
      groundMist.addColorStop(0, "rgba(18, 10, 36, 0)");
      groundMist.addColorStop(1, "rgba(10, 7, 24, 0.65)");
      ctx.fillStyle = groundMist;
      ctx.fillRect(-60, H * 0.88, W + 120, H * 0.16);

      ctx.restore();
    }

    startLoop() {
      const tick = (now) => {
        this.renderFrame(now);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  /* ------------------------------------------------------------------------
     8. UI & Story Experience Orchestrator
     Connects Landing Page -> Blooming Garden -> Romantic Messages -> Envelope & Letter
     ------------------------------------------------------------------------ */
  function initApp() {
    const canvas = document.getElementById("garden-canvas");
    if (!canvas || !canvas.getContext) return;

    const landingScreen = document.getElementById("landing-screen");
    const enterGardenBtn = document.getElementById("enter-garden-btn");
    const musicToggleBtn = document.getElementById("music-toggle-btn");
    const musicLabel = document.getElementById("music-label");
    const bgMusic = document.getElementById("bg-music");
    const replayBtn = document.getElementById("replay-btn");

    const messageOverlay = document.getElementById("message-overlay");
    const msgLine1 = document.getElementById("msg-line-1");
    const msgLine2 = document.getElementById("msg-line-2");
    const msgLine3 = document.getElementById("msg-line-3");
    const letterCtaWrap = document.getElementById("letter-cta-wrap");
    const openLetterBtn = document.getElementById("open-letter-btn");

    const reopenBar = document.getElementById("reopen-bar");
    const reopenLetterBtn = document.getElementById("reopen-letter-btn");

    const letterModal = document.getElementById("letter-modal");
    const letterBackdrop = document.getElementById("letter-backdrop");
    const envelope = document.getElementById("envelope");
    const closeLetterX = document.getElementById("close-letter-x");
    const returnGardenBtn = document.getElementById("return-garden-btn");

    const audio = new AudioController(bgMusic, musicToggleBtn, musicLabel);
    let messageTimers = [];
    let envelopeTimers = [];

    function clearMessageTimers() {
      messageTimers.forEach((id) => clearTimeout(id));
      messageTimers = [];
    }

    function clearEnvelopeTimers() {
      envelopeTimers.forEach((id) => clearTimeout(id));
      envelopeTimers = [];
    }

    function resetMessages() {
      clearMessageTimers();
      messageOverlay.classList.add("is-hidden");
      messageOverlay.classList.remove("is-dimmed");
      msgLine1.classList.remove("is-visible");
      msgLine2.classList.remove("is-visible");
      msgLine3.classList.remove("is-visible");
      letterCtaWrap.classList.remove("is-visible");
      reopenBar.classList.add("is-hidden");
    }

    // Sequentially reveal the 3 romantic lines + "Open Your Letter" button
    function revealRomanticMessages() {
      resetMessages();
      messageOverlay.classList.remove("is-hidden");
      replayBtn.classList.remove("is-hidden");

      messageTimers.push(setTimeout(() => msgLine1.classList.add("is-visible"), 450));
      messageTimers.push(setTimeout(() => msgLine2.classList.add("is-visible"), 3400));
      messageTimers.push(setTimeout(() => msgLine3.classList.add("is-visible"), 6900));
      messageTimers.push(setTimeout(() => letterCtaWrap.classList.add("is-visible"), 9600));
    }

    // Choreographed 3D Envelope -> Unfolded Love Letter transition
    function openLoveLetter() {
      clearEnvelopeTimers();

      messageOverlay.classList.add("is-dimmed");
      reopenBar.classList.add("is-hidden");

      letterModal.classList.remove("is-hidden", "stage-letter");
      envelope.classList.remove("is-opening");

      // Step 1: Float sealed envelope into view
      requestAnimationFrame(() => {
        letterModal.classList.add("stage-envelope");
      });

      // Step 2: Wax seal gleams & breaks, flap lifts, parchment glides upward
      envelopeTimers.push(
        setTimeout(() => {
          envelope.classList.add("is-opening");
        }, 550)
      );

      // Step 3: Unfold full readable parchment letter while garden remains softly visible behind
      envelopeTimers.push(
        setTimeout(() => {
          letterModal.classList.remove("stage-envelope");
          letterModal.classList.add("stage-letter");
        }, 1950)
      );
    }

    function closeLoveLetter() {
      clearEnvelopeTimers();
      letterModal.classList.remove("stage-envelope", "stage-letter");
      letterModal.classList.add("is-hidden");
      envelope.classList.remove("is-opening");

      // Keep the glowing full garden open and provide a gentle pill to re-open the letter anytime
      reopenBar.classList.remove("is-hidden");
    }

    const scene = new PeonyGardenScene(canvas, {
      onGardenComplete: revealRomanticMessages,
    });

    // Landing CTA: Enter the Garden + start local background music softly
    enterGardenBtn.addEventListener("click", () => {
      landingScreen.classList.add("is-leaving");
      audio.play();
      scene.startBlooming();
    });

    openLetterBtn.addEventListener("click", openLoveLetter);
    reopenLetterBtn.addEventListener("click", openLoveLetter);

    closeLetterX.addEventListener("click", closeLoveLetter);
    returnGardenBtn.addEventListener("click", closeLoveLetter);
    letterBackdrop.addEventListener("click", () => {
      if (letterModal.classList.contains("stage-letter")) {
        closeLoveLetter();
      }
    });

    replayBtn.addEventListener("click", () => {
      closeLoveLetter();
      resetMessages();
      replayBtn.classList.add("is-hidden");
      scene.startBlooming();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !letterModal.classList.contains("is-hidden")) {
        closeLoveLetter();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
})();
