/**
 * aurora-bg.js
 * ============
 * Animated Canvas 2D aurora-style background.
 * Slow-moving, organic blurred color blobs that morph and drift,
 * using a dark desaturated palette derived from the project's own color tokens.
 *
 * All colors were programmatically derived by darkening/desaturating the
 * project palette found in tailwind.config.js and assets/css/input.css:
 *   bg:       #07111f  → base
 *   accent:   #ff7a59  → dark coral   hsl(15,  45%, 8%)
 *   accent-2: #ffb36b  → dark amber   hsl(30,  40%, 8%)
 *   accent-3: #7ce7d5  → dark teal    hsl(174, 55%, 9%)
 *   muted:    #a9b7d0  → dark slate   hsl(213, 35%, 8%)
 *   surface:  #0d182a  → dark indigo  hsl(220, 58%, 9%)
 *
 * ── TUNABLES ────────────────────────────────────────────────────────────────
 */
const BLOB_COUNT      = 7;        // Number of aurora blobs
const SPEED_SCALE     = 0.005;    // Overall drift speed (px/frame at reference res)
const CANVAS_BLUR_PX  = 72;       // CSS blur applied to the canvas element (px)
const LOW_RES_W       = 320;      // Offscreen canvas width  (upscaled for perf)
const LOW_RES_H       = 180;      // Offscreen canvas height
const SIZE_OSC_SPEED  = 0.0008;   // Speed of radial size oscillation
const SIZE_OSC_AMP    = 0.22;     // Amplitude of size oscillation (fraction of base)
const ALPHA           = 0.18;     // Peak alpha of each blob's radial gradient center
const VELOCITY_JITTER = 0.0004;   // Per-frame random nudge to velocity (keeps motion organic)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derived aurora colors — dark, desaturated, max luminance ≤ 12%.
 * Format: [r, g, b] in 0-255.
 * Derived from: hsl(h, s%, l%) with l capped at 9-11%.
 */
const AURORA_COLORS = [
  // Original palette
  [255, 122, 89],   // accent (#ff7a59)
  [124, 231, 213],  // accent-3 (#7ce7d5)
  [255, 179, 107],  // accent-2 (#ffb36b)
  [169, 183, 208],  // muted (#a9b7d0)
  // Additional colors
  [168, 85, 247],   // purple
  [34, 197, 94],    // green
  [236, 72, 153],   // pink
  [59, 130, 246],   // bright blue
];

/** Base fill color (darkest navy). */
const BASE_COLOR = hsl(215, 68, 5);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert HSL (h: 0-360, s/l: 0-100) to [r,g,b] 0-255. */
function hsl(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Format [r,g,b] + alpha to rgba() string. */
function rgba(rgb, a) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

/** Clamp a value between min and max. */
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/** Linear interpolate between a and b by t (0-1). */
function lerp(a, b, t) { return a + (b - a) * t; }

// ─── Blob state ──────────────────────────────────────────────────────────────

function createBlob(index, totalBlobs) {
  const angle = (index / totalBlobs) * Math.PI * 2 + Math.random() * 0.8;
  const speed = (0.6 + Math.random() * 0.8) * SPEED_SCALE;
  return {
    // Normalised position (0-1) on the low-res canvas
    x: 0.1 + Math.random() * 0.8,
    y: 0.1 + Math.random() * 0.8,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    // Elliptical radii as fraction of canvas dimension
    rx: 0.25 + Math.random() * 0.20,
    ry: 0.20 + Math.random() * 0.20,
    // Phase for size oscillation
    phase: Math.random() * Math.PI * 2,
    // Start with the original colors (first 4 indices in the array)
    colorIndex: index % 4,
    // Target any color in the array for cross-fading
    targetColorIndex: (index + 4) % AURORA_COLORS.length,
    // Progress of color cross-fade (0 → 1)
    colorT: Math.random(),
    // Speed of color cross-fade
    colorSpeed: 0.0015 + Math.random() * 0.001,
  };
}

// ─── Canvas setup ────────────────────────────────────────────────────────────

/** Create and insert the main (display) canvas. */
function createDisplayCanvas() {
  const canvas = document.createElement('canvas');
  canvas.id = 'aurora-bg';
  Object.assign(canvas.style, {
    position:   'fixed',
    inset:      '0',
    width:      '100%',
    height:     '100%',
    zIndex:     '-1',
    pointerEvents: 'none',
    filter:     `blur(${CANVAS_BLUR_PX}px)`,
    // Scale up beyond viewport to hide hard blurred edges
    transform:  'scale(1.18)',
    transformOrigin: 'center center',
    willChange: 'transform',
  });
  // Insert as first child of body so it sits behind everything
  document.body.insertBefore(canvas, document.body.firstChild);
  return canvas;
}

/** Create the offscreen low-res canvas used for drawing. */
function createOffscreenCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width  = LOW_RES_W;
  canvas.height = LOW_RES_H;
  return canvas;
}

// ─── Drawing ─────────────────────────────────────────────────────────────────

function drawFrame(ctx, blobs, timestamp) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // Fill background
  ctx.fillStyle = rgba(BASE_COLOR, 1);
  ctx.fillRect(0, 0, w, h);

  // Draw each blob
  for (const blob of blobs) {
    // Oscillating radii
    const osc = 1 + Math.sin(timestamp * SIZE_OSC_SPEED + blob.phase) * SIZE_OSC_AMP;
    const rx = blob.rx * w * osc;
    const ry = blob.ry * h * osc;
    const cx = blob.x * w;
    const cy = blob.y * h;

    // Interpolated color
    const colorA = AURORA_COLORS[blob.colorIndex];
    const colorB = AURORA_COLORS[blob.targetColorIndex];
    const r = Math.round(lerp(colorA[0], colorB[0], blob.colorT));
    const g = Math.round(lerp(colorA[1], colorB[1], blob.colorT));
    const b = Math.round(lerp(colorA[2], colorB[2], blob.colorT));

    // Radial gradient — use ellipse via save/restore + scale trick
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
    const radius = Math.max(rx, ry);

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    grad.addColorStop(0,   rgba([r, g, b], ALPHA));
    grad.addColorStop(0.4, rgba([r, g, b], ALPHA * 0.55));
    grad.addColorStop(1,   rgba([r, g, b], 0));

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.globalCompositeOperation = 'source-over';
  }
}

// ─── Physics update ──────────────────────────────────────────────────────────

function updateBlobs(blobs) {
  for (const blob of blobs) {
    // Organic velocity jitter
    blob.vx += (Math.random() - 0.5) * VELOCITY_JITTER;
    blob.vy += (Math.random() - 0.5) * VELOCITY_JITTER;

    // Cap speed
    const maxV = SPEED_SCALE * 2;
    blob.vx = clamp(blob.vx, -maxV, maxV);
    blob.vy = clamp(blob.vy, -maxV, maxV);

    // Move
    blob.x += blob.vx;
    blob.y += blob.vy;

    // Soft bounce at normalised edges (adds a bit of margin)
    const margin = 0.05;
    if (blob.x < -margin) { blob.x = -margin; blob.vx = Math.abs(blob.vx); }
    if (blob.x >  1 + margin) { blob.x = 1 + margin; blob.vx = -Math.abs(blob.vx); }
    if (blob.y < -margin) { blob.y = -margin; blob.vy = Math.abs(blob.vy); }
    if (blob.y >  1 + margin) { blob.y = 1 + margin; blob.vy = -Math.abs(blob.vy); }

    // Cross-fade color
    blob.colorT += blob.colorSpeed;
    if (blob.colorT >= 1) {
      blob.colorT = 0;
      blob.colorIndex = blob.targetColorIndex;
      // Pick a new target color that's different from current
      let next;
      do { next = Math.floor(Math.random() * AURORA_COLORS.length); }
      while (next === blob.colorIndex);
      blob.targetColorIndex = next;
    }
  }
}

// ─── Main init ───────────────────────────────────────────────────────────────

(function initAurora() {
  const displayCanvas  = createDisplayCanvas();
  const offscreen      = createOffscreenCanvas();
  const offCtx         = offscreen.getContext('2d');
  const displayCtx     = displayCanvas.getContext('2d');

  // Size the display canvas to match the viewport
  function resizeCanvas() {
    displayCanvas.width  = window.innerWidth;
    displayCanvas.height = window.innerHeight;
  }
  resizeCanvas();

  // Debounced resize handler
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCanvas, 80);
  });

  // Initialise blobs
  const blobs = Array.from({ length: BLOB_COUNT }, (_, i) => createBlob(i, BLOB_COUNT));

  // Animation loop state
  let rafId     = null;
  let paused    = false;

  function tick(timestamp) {
    if (paused) return;

    // 1. Update physics on normalised coordinates
    updateBlobs(blobs);

    // 2. Draw to small offscreen canvas
    drawFrame(offCtx, blobs, timestamp);

    // 3. Upscale to display canvas (browser bilinear upscale = free soft blur)
    displayCtx.drawImage(offscreen, 0, 0, displayCanvas.width, displayCanvas.height);

    rafId = requestAnimationFrame(tick);
  }

  // Tab visibility — pause when hidden to save CPU
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      paused = true;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    } else {
      paused = false;
      rafId = requestAnimationFrame(tick);
    }
  });

  // Kick off
  rafId = requestAnimationFrame(tick);
})();
