/* Canvas nativo: anillo halftone, vuelo curvo sin resortes y letras
   muestreadas desde la geometría real del DOM. Coordenadas en píxeles CSS. */
import { CONFIG } from "./constants";
import { fitIntroText } from "./scenes";
const TAU = Math.PI * 2;
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const ease = (t) => t * t * (3 - 2 * t); // Monótono: nunca rebasa el destino.
  const lerp = (a, b, t) => a + (b - a) * t;

  class ParticleSystem {
    constructor(canvas, colors, cfg) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.cfg = cfg;
      this.colors = colors;
      this.mode = "ring";
      this.alpha = 1;
      this.time = 0;
      this.running = false;
      this.enabled = false;
      this.particles = [];
      this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
      if (!this.ctx) return;
      const count = Math.min(1400, Math.max(800, cfg.strands * cfg.dotsPerStrand));
      for (let i = 0; i < count; i++) {
        const strand = i % cfg.strands;
        this.particles.push({
          x: 0, y: 0, sx: 0, sy: 0, tx: 0, ty: 0, cx: 0, cy: 0,
          strand, depth: strand / Math.max(1, cfg.strands - 1),
          angle: Math.floor(i / cfg.strands) / Math.ceil(count / cfg.strands) * TAU + strand * 0.047,
          grain: 0.78 + Math.random() * 0.44, size: cfg.dotSize, opacity: 1,
          delay: 0, duration: 0, textVisible: true,
        });
      }
      this._resize();
      this._update();
      this._draw();
      window.addEventListener("resize", () => this._resize());
      document.fonts?.addEventListener("loadingdone", () => this._resize());
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this._stop();
        else if (this.enabled) this._start();
      });
      this._tick = (now) => {
        if (!this.running) return;
        this.time += Math.min(50, Math.max(0, now - this.lastFrame));
        this.lastFrame = now;
        this._update();
        this._draw();
        this.raf = requestAnimationFrame(this._tick);
      };
    }

    resume() {
      this.enabled = true;
      if (!document.hidden && this.ctx) this._start();
    }
    pause() { this.enabled = false; this._stop(); }
    _start() {
      if (this.running) return;
      this.running = true;
      this.lastFrame = performance.now();
      this.raf = requestAnimationFrame(this._tick);
    }
    _stop() { this.running = false; cancelAnimationFrame(this.raf); }

    _resize() {
      if (!this.ctx) return;
      this.width = innerWidth;
      this.height = innerHeight;
      const ratio = Math.min(devicePixelRatio || 1, this.cfg.maxPixelRatio);
      this.canvas.width = Math.round(this.width * ratio);
      this.canvas.height = Math.round(this.height * ratio);
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const stage = document.getElementById("intro-stage").getBoundingClientRect();
      this.centerX = stage.left + stage.width / 2;
      this.centerY = stage.top;
      this.scale = Math.min(1, this.width * 0.36 / this.cfg.ringMax, this.height * 0.29 / this.cfg.ringMax);
      // Cambios de orientación/fuente no dejan destinos de texto obsoletos.
      if (this.textElement && !["ring", "scatter", "reform"].includes(this.mode)) {
        fitIntroText();
        this._assignTargets();
        if (this.mode === "converge") {
          const remaining = Math.max(180, this.phaseEnd - this.time);
          this._prepareFlight(remaining, 0);
        } else {
          for (const p of this.particles) { p.x = p.tx; p.y = p.ty; }
        }
      }
      if (this.mode === "ring") this._update();
      this._draw();
    }

    _ring(p, time) {
      const c = this.cfg;
      const t = this.reducedMotion.matches ? 0 : time;
      const a = p.angle + t * 0.001 * c.rotateSpeed * (0.85 + p.depth * 0.22);
      const breathe = 1 + Math.sin(t * c.breathSpeed) * 0.032;
      const wave = Math.sin(a * c.waveCount + t * c.waveSpeed + p.depth * 1.6) * c.waveAmplitude
        + Math.sin(a * 5 - t * c.waveSpeed * 0.7 + p.depth * 2) * c.waveAmplitude * 0.36
        + Math.cos(a * 2 + t * c.waveSpeed * 0.4) * c.waveAmplitude * 0.25;
      const radius = (lerp(c.ringMin, c.ringMax, p.depth) * breathe + wave) * this.scale;
      p.rx = this.centerX + Math.cos(a) * radius;
      p.ry = this.centerY + Math.sin(a) * radius * (0.96 + 0.04 * Math.sin(t * 0.0002));
      const grainWave = 0.5 + 0.5 * Math.sin(a * 2 + p.depth * 4 - t * c.waveSpeed);
      const edge = Math.sin(Math.PI * (0.1 + p.depth * 0.8));
      p.ringSize = Math.max(0.35, c.dotSize * p.grain * (0.45 + grainWave * 0.7) * (0.65 + edge * 0.45) * Math.max(0.7, this.scale));
      p.ringOpacity = 0.25 + edge * 0.3 + grainWave * 0.4;
    }

    formText(element) {
      if (!this.ctx) return Promise.resolve();
      this.textElement = element;
      this._assignTargets();
      this._prepareFlight(this.cfg.convergeDuration, this.reducedMotion.matches ? 0 : this.cfg.convergeStagger);
      this.mode = "converge";
      this.alpha = 1;
      return new Promise((resolve) => { this.phaseDone = resolve; });
    }

    _assignTargets() {
      const points = this._sampleText();
      if (!points.length) points.push({ x: this.centerX, y: this.centerY });
      // Emparejar por ángulo conserva un flujo de hebras, sin una nube aleatoria.
      points.sort((a, b) => Math.atan2(a.y - this.centerY, a.x - this.centerX) - Math.atan2(b.y - this.centerY, b.x - this.centerX));
      const ordered = [...this.particles].sort((a, b) =>
        Math.atan2(a.y - this.centerY, a.x - this.centerX) - Math.atan2(b.y - this.centerY, b.x - this.centerX));
      ordered.forEach((p, i) => {
        const target = points[Math.floor(i * points.length / ordered.length)];
        p.tx = target.x; p.ty = target.y;
        p.textVisible = points.length >= ordered.length || Math.floor((i + 1) * points.length / ordered.length) !== Math.floor(i * points.length / ordered.length);
      });
    }

    _prepareFlight(duration, stagger) {
      this.phaseStart = this.time;
      this.phaseEnd = this.time + duration + stagger;
      for (const p of this.particles) {
        const angle = (Math.atan2(p.y - this.centerY, p.x - this.centerX) + TAU) % TAU;
        p.delay = angle / TAU * stagger;
        p.duration = duration;
        // Posición orbital en el instante de salida: sin salto al abandonar el anillo.
        if (this.mode === "ring") {
          this._ring(p, this.time + p.delay);
          p.sx = p.rx; p.sy = p.ry;
        } else { p.sx = p.x; p.sy = p.y; }
        const curve = this.reducedMotion.matches ? 0 : this.cfg.curve;
        p.cx = (p.sx + p.tx) / 2 - (p.ty - p.sy) * curve;
        p.cy = (p.sy + p.ty) / 2 + (p.tx - p.sx) * curve;
      }
    }

    merge() {
      if (!this.ctx) return Promise.resolve();
      this.mode = "merged";
      this.phaseStart = this.time;
      this.phaseEnd = this.time + this.cfg.mergeDuration;
      return new Promise((resolve) => { this.phaseDone = resolve; });
    }

    reform() {
      if (!this.ctx) return Promise.resolve();
      this.mode = "reform";
      this.phaseStart = this.time;
      this.phaseEnd = this.time + this.cfg.reformDuration;
      for (const p of this.particles) { p.sx = p.x; p.sy = p.y; }
      return new Promise((resolve) => { this.phaseDone = resolve; });
    }

    scatter() {
      if (!this.ctx) return;
      this.mode = "scatter";
      this.phaseStart = this.time;
      this.alpha = 0.65;
      for (const p of this.particles) {
        p.sx = p.x; p.sy = p.y;
        const angle = Math.atan2(p.y - this.centerY, p.x - this.centerX);
        const distance = this.reducedMotion.matches ? 0 : 100 + p.depth * 160;
        p.tx = p.x + Math.cos(angle) * distance;
        p.ty = p.y + Math.sin(angle) * distance;
      }
    }

    _sampleText() {
      const off = document.createElement("canvas");
      off.width = this.width; off.height = this.height;
      const ctx = off.getContext("2d", { willReadFrequently: true });
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "alphabetic";
      let left = this.width, top = this.height, right = 0, bottom = 0;
      for (const line of this.textElement.querySelectorAll(".intro-line")) {
        const style = getComputedStyle(line);
        const rect = line.getBoundingClientRect();
        ctx.font = style.fontWeight + " " + style.fontSize + " " + style.fontFamily;
        const metrics = ctx.measureText(line.textContent);
        const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * 0.8;
        const descent = metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize) * 0.2;
        const baseline = rect.top + (rect.height - ascent - descent) / 2 + ascent;
        // Range respeta el espaciado real, la fuente cargada y el ancho responsive.
        const range = document.createRange();
        let offset = 0;
        for (const char of line.textContent) {
          range.setStart(line.firstChild, offset);
          range.setEnd(line.firstChild, offset + char.length);
          ctx.fillText(char, range.getBoundingClientRect().left, baseline);
          offset += char.length;
        }
        left = Math.min(left, rect.left); top = Math.min(top, rect.top);
        right = Math.max(right, rect.right); bottom = Math.max(bottom, rect.bottom);
      }
      left = Math.max(0, Math.floor(left)); top = Math.max(0, Math.floor(top));
      const w = Math.min(this.width - left, Math.ceil(right - left));
      const h = Math.min(this.height - top, Math.ceil(bottom - top));
      if (w <= 0 || h <= 0) return [];
      const pixels = ctx.getImageData(left, top, w, h).data;
      const points = [];
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          if (pixels[(y * w + x) * 4 + 3] > 90) points.push({ x: left + x, y: top + y });
        }
      }
      return points;
    }

    _finish(mode) {
      if (mode) this.mode = mode;
      const resolve = this.phaseDone;
      this.phaseDone = null;
      resolve?.();
    }

    _update() {
      const c = this.cfg;
      const now = this.time;
      for (const p of this.particles) {
        if (this.mode === "ring") {
          this._ring(p, now);
          p.x = p.rx; p.y = p.ry; p.size = p.ringSize; p.opacity = p.ringOpacity;
        } else if (this.mode === "converge") {
          const t = clamp((now - this.phaseStart - p.delay) / p.duration);
          if (now < this.phaseStart + p.delay) {
            this._ring(p, now);
            p.x = p.rx; p.y = p.ry;
          } else {
            const e = ease(t), inv = 1 - e;
            p.x = inv * inv * p.sx + 2 * inv * e * p.cx + e * e * p.tx;
            p.y = inv * inv * p.sy + 2 * inv * e * p.cy + e * e * p.ty;
          }
          p.size = lerp(p.ringSize, Math.max(0.65, c.dotSize * 0.74), t);
          p.opacity = lerp(p.ringOpacity, p.textVisible ? 0.95 : 0, t);
        } else if (this.mode === "formed" || this.mode === "merged") {
          const shimmer = this.reducedMotion.matches ? 1 : 0.88 + 0.12 * Math.sin(p.x * 0.025 - now * 0.003);
          p.opacity = p.textVisible ? shimmer : 0;
        } else if (this.mode === "reform") {
          this._ring(p, now);
          const e = ease(clamp((now - this.phaseStart) / c.reformDuration));
          const curve = this.reducedMotion.matches ? 0 : Math.sin(e * Math.PI) * c.curve;
          p.x = lerp(p.sx, p.rx, e) + (p.ry - p.sy) * curve;
          p.y = lerp(p.sy, p.ry, e) - (p.rx - p.sx) * curve;
          p.size = lerp(c.dotSize * 0.74, p.ringSize, e);
          p.opacity = lerp(p.textVisible ? 1 : 0, p.ringOpacity, e);
        } else if (this.mode === "scatter") {
          const e = 1 - Math.pow(1 - clamp((now - this.phaseStart) / CONFIG.timings.sceneFade), 3);
          p.x = lerp(p.sx, p.tx, e); p.y = lerp(p.sy, p.ty, e);
        }
      }
      if (this.mode === "converge" && now >= this.phaseEnd) this._finish("formed");
      else if (this.mode === "merged") {
        this.alpha = 1 - clamp((now - this.phaseStart) / c.mergeDuration);
        if (now >= this.phaseEnd && this.phaseDone) this._finish();
      } else if (this.mode === "reform") {
        this.alpha = clamp((now - this.phaseStart) / (c.mergeDuration * 0.8));
        if (now >= this.phaseEnd) { this.alpha = 1; this._finish("ring"); }
      }
    }

    _draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      if (this.alpha < 0.005) return;
      ctx.fillStyle = this.colors.particle;
      for (const p of this.particles) {
        ctx.globalAlpha = this.alpha * p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

export { ParticleSystem };
