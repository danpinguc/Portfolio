import { WheelGestures } from './vendor/wheel-gestures.js';

// ─────────────────────────────────────────
// Reduced Motion Detection
// ─────────────────────────────────────────
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─────────────────────────────────────────
// Low-End Device Detection
// ─────────────────────────────────────────
// Decides whether to disable heavy visual effects (snow, film grain, parallax,
// 3D tilt) for devices that can't run them smoothly. Three-step check:
//   1. localStorage — honours a user's explicit toggle from a previous visit.
//   2. Hardware hints — flags devices with ≤ 2 CPU cores or ≤ 2 GB RAM.
//   3. Frame-rate sampling — runs for ~2 seconds; if the average frame takes
//      longer than 25 ms (~40 fps), the device is considered too slow.
// When flagged, the `html.low-end` class is added so CSS can hide canvases
// and disable transforms, and JS loops are cancelled.

const LOW_END_KEY = 'portfolio-reduced-fx';

// Check if user has explicitly set a preference
let storedLowEnd = null;
try { storedLowEnd = localStorage.getItem(LOW_END_KEY); } catch (e) { /* private browsing */ }
let isLowEnd = false;

if (storedLowEnd === 'on') {
  // User explicitly enabled reduced effects
  isLowEnd = true;
  document.documentElement.classList.add('low-end');
} else if (storedLowEnd === 'off') {
  // User explicitly disabled reduced effects — skip auto-detection
  isLowEnd = false;
} else {
  // No stored preference — auto-detect

  // Hardware signals: low core count or low memory
  const lowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 2;

  if (lowCores || lowMemory) {
    // Hardware signals alone are enough to flag as low-end
    isLowEnd = true;
    document.documentElement.classList.add('low-end');
  } else {
    // Sample frame rate after the page has settled (3 s delay) to avoid
    // measuring during initial load when the browser is busy parsing,
    // painting, and decoding images — which would give a falsely low FPS.
    // Samples for ~2 seconds; if the average frame takes longer than 20 ms
    // (~50 fps), the device is flagged as low-end.
    setTimeout(() => {
      let fpsFrames = 0;
      let fpsStartTime = 0;

      function sampleFPS(timestamp) {
        if (!fpsStartTime) fpsStartTime = timestamp;
        fpsFrames++;

        const elapsed = timestamp - fpsStartTime;
        if (elapsed >= 2000) {
          const avgFrameTime = elapsed / fpsFrames;

          if (avgFrameTime > 20) {
            isLowEnd = true;
            document.documentElement.classList.add('low-end');
            if (snowRAF) cancelAnimationFrame(snowRAF);
            if (flickerRAF) cancelAnimationFrame(flickerRAF);
          }
          return;
        }

        requestAnimationFrame(sampleFPS);
      }

      requestAnimationFrame(sampleFPS);
    }, 3000);
  }
}

// ─────────────────────────────────────────
// Low-End Toggle (called from the UI button in index.html)
// ─────────────────────────────────────────
// Exposed on window so the inline toggle button can call it.
window.toggleReducedFX = function () {
  isLowEnd = !isLowEnd;
  document.documentElement.classList.toggle('low-end', isLowEnd);
  try { localStorage.setItem(LOW_END_KEY, isLowEnd ? 'on' : 'off'); } catch (e) { /* private browsing */ }

  // Update toggle button icon state
  const btn = document.getElementById('fx-toggle');
  if (btn) btn.setAttribute('aria-pressed', String(isLowEnd));

  if (isLowEnd) {
    // Stop heavy animation loops
    if (snowRAF) cancelAnimationFrame(snowRAF);
    if (flickerRAF) cancelAnimationFrame(flickerRAF);
  } else {
    // Restart animation loops
    lastSnowTime = 0;
    snowRAF = requestAnimationFrame(drawSnow);
    flickerRAF = requestAnimationFrame(drawFlicker);
  }
};

// ─────────────────────────────────────────
// Constants & Configuration
// ─────────────────────────────────────────
const loaderStart = Date.now();
const storedSection = sessionStorage.getItem('portfolio-return-section');
sessionStorage.removeItem('portfolio-return-section');  // Clear immediately so refresh = fresh load
const returnSection = storedSection !== null ? parseInt(storedSection, 10) : null;
const isReturning = returnSection !== null;
const LOADER_MIN_MS = isReturning ? 0 : 2400;  // Skip loader delay on return visits
const keyScrollCooldown = 500;           // ms between accepted keyboard scroll events

// ─────────────────────────────────────────
// Loading Screen
// ─────────────────────────────────────────
// The loader has two halves that start full-screen, then shrink to the
// letterbox bar height (--letterbox-h) so the transition is seamless.
// While loading, concentric rings sit centered; once done they lerp
// toward the mouse before fading out.

const loaderRings = document.getElementById('loader-rings');
let loaderDone = false;
let loaderMouseX = window.innerWidth / 2;
let loaderMouseY = window.innerHeight / 2;
let loaderPosX = window.innerWidth / 2;
let loaderPosY = window.innerHeight / 2;

// Capture mouse position continuously so rings can chase it once loading finishes
function loaderMouseTrack(e) {
  loaderMouseX = e.clientX;
  loaderMouseY = e.clientY;
}
document.addEventListener('mousemove', loaderMouseTrack);

function animateLoaderRings() {
  if (!loaderRings || !loaderRings.parentElement) return;
  if (loaderDone) {
    // Ease rings toward cursor once load is complete
    loaderPosX += (loaderMouseX - loaderPosX) * 0.03;
    loaderPosY += (loaderMouseY - loaderPosY) * 0.03;
  } else {
    loaderPosX = window.innerWidth / 2;
    loaderPosY = window.innerHeight / 2;
  }
  loaderRings.style.transform = 'translate(' + loaderPosX + 'px, ' + loaderPosY + 'px)';
  requestAnimationFrame(animateLoaderRings);
}
animateLoaderRings();


window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  if (!loader) return;

  if (isReturning) {
    // Fade out loader text before rings chase cursor
    const loaderText = document.querySelector('.loader-text');
    if (loaderText) {
      setTimeout(() => loaderText.classList.add('fade-out'), 1100);
    }
    setTimeout(() => {
      loaderDone = true;                    // Rings start chasing mouse immediately
      loader.classList.add('done');          // Fade out rings via CSS
      setTimeout(() => {
        loader.classList.add('split');       // Bars split open (0.6s transition)
        document.querySelector('.title-section').classList.add('title-visible');
        setTimeout(() => {
          loader.remove();
          document.removeEventListener('mousemove', loaderMouseTrack);
        }, 600);
      }, 350);                              // Ring fade before split
    }, 1400);                               // Rings pulse for 1.4s
    return;
  }

  // Normal first-visit loader
  const elapsed = Date.now() - loaderStart;
  const remaining = Math.max(0, LOADER_MIN_MS - elapsed);
  setTimeout(() => {
    // Fade out loader text before rings start chasing cursor
    const loaderText = document.querySelector('.loader-text');
    if (loaderText) loaderText.classList.add('fade-out');
    setTimeout(() => {
      loaderDone = true;                    // Rings start chasing mouse
      loader.classList.add('done');          // Fade out rings via CSS
      setTimeout(() => {
        loader.classList.add('split');       // Halves shrink to letterbox bars
        // Title section animates in as the loader opens
        document.querySelector('.title-section').classList.add('title-visible');
        setTimeout(() => {
          loader.remove();                  // Clean up DOM after split animation (600ms)
          document.removeEventListener('mousemove', loaderMouseTrack);
        }, 600);
      }, 350);                              // 350ms ring fade before split begins
    }, 120);                                // 300ms text fade before rings chase cursor
  }, remaining);
});

// ─────────────────────────────────────────
// DOM Element Cache
// ─────────────────────────────────────────
// Grabbed once at startup and reused in hot loops (animate, reveal, parallax).

const container = document.getElementById('scroll-container');
const sections = document.querySelectorAll('.section');
const totalSections = sections.length;
const dots = document.querySelectorAll('.progress-dot');

// Parallax layers — forest trunks (4 depth planes)
const trunksFar = document.getElementById('trunks-far');
const trunksMid = document.getElementById('trunks-mid');
const trunksNear = document.getElementById('trunks-near');
const trunksFront = document.getElementById('trunks-front');

// Parallax layers — snow ground (3 planes, synced with first 3 trunk rates)
const snowFar = document.getElementById('snow-ground-far');
const snowMid = document.getElementById('snow-ground-mid');
const snowNear = document.getElementById('snow-ground-near');

const pathGlowEl = document.getElementById('path-glow');
const pathTriggerEl = document.getElementById('path-trigger');
const reveals = document.querySelectorAll('.reveal');
const sectionsArray = Array.from(sections);

// ─────────────────────────────────────────
// Scroll Engine — Targeting & Easing
// ─────────────────────────────────────────
// There is no native browser scrollbar — the page is a flex row of
// full-width sections, moved left/right by changing `transform: translateX`.
// `targetX` snaps instantly to the next section boundary when the user
// scrolls, while `currentX` eases toward it each frame using "lerp"
// (linear interpolation): currentX += (targetX - currentX) * 0.04.
// The small 0.04 factor means it covers 4% of the remaining distance
// per frame, producing a slow, cinematic glide that decelerates naturally.

let currentX = 0;
let targetX = 0;
let currentSection = 0;
let lastKeyScrollTime = 0;
let mouseX = 0;                           // Tracked for path glow proximity check in animate()
let mouseY = 0;

// rAF handles — stored so loops can be cancelled when the tab is backgrounded
let animateRAF = null;
let snowRAF = null;
let flickerRAF = null;

function getMaxScroll() {
  return (totalSections - 1) * window.innerWidth;
}

function goToSection(index) {
  if (index < 0 || index >= totalSections) return;
  currentSection = index;
  targetX = index * window.innerWidth;
  updateDots();
  // Show the path glow only on the final (gallery-path) section
  if (pathGlowEl) pathGlowEl.classList.toggle('visible', index === totalSections - 1);
}

function updateDots() {
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === currentSection);
  });
}

// ─────────────────────────────────────────
// Main Animation Loop (rAF)
// ─────────────────────────────────────────
// Runs every frame: lerps scroll position, updates parallax transforms,
// positions the path glow, and triggers reveal checks.

function animate() {
  const ease = 0.04;                       // lerp factor — fraction of remaining distance moved per frame
  const diff = targetX - currentX;

  // Lerp toward target; snap when within half a pixel to prevent endless tiny movements
  if (Math.abs(diff) > 0.5) {
    currentX += diff * ease;
  } else {
    currentX = targetX;
  }

  container.style.transform = `translateX(${-currentX}px)`;

  // ── Parallax ──
  // Each layer scrolls at a fraction of the content speed.
  // Rates: far 0.08, mid 0.2, near 0.4, front 0.65
  // Skipped when user prefers reduced motion or device is low-end
  // (CSS also forces transform: none for both cases)
  if (!prefersReducedMotion && !isLowEnd) {
    const farOffset = currentX * 0.08;
    const midOffset = currentX * 0.2;
    const nearOffset = currentX * 0.4;
    const frontOffset = currentX * 0.65;

    trunksFar.style.transform = `translateX(${-farOffset}px)`;
    trunksMid.style.transform = `translateX(${-midOffset}px)`;
    trunksNear.style.transform = `translateX(${-nearOffset}px)`;
    trunksFront.style.transform = `translateX(${-frontOffset}px)`;

    // Snow ground layers mirror the first 3 trunk rates
    snowFar.style.transform = `translateX(${-farOffset}px)`;
    snowMid.style.transform = `translateX(${-midOffset}px)`;
    snowNear.style.transform = `translateX(${-nearOffset}px)`;
  }

  // Path glow tracks at the slowest parallax rate (0.08) so it drifts in gently
  if (pathGlowEl) {
    const lastSectionCenter = (totalSections - 1) * window.innerWidth + window.innerWidth / 2;
    const glowBase = lastSectionCenter - currentX - window.innerWidth / 2;
    // Dampen movement to match far trunk layer — drifts in slowly
    const glowOffset = glowBase * 0.5;
    pathGlowEl.style.transform = `translateX(calc(-50% + ${glowOffset}px))`;

    // Make the forest-path (text + feet) track the same parallax as the glow.
    // The glow is position:fixed, translated by glowOffset from viewport center.
    // The forest-path is inside the scroll container, so it moves 1:1 with scroll.
    // To visually align with the glow we need: transformX = glowOffset - glowBase
    if (pathTriggerEl) {
      var compensate = glowOffset - glowBase;
      pathTriggerEl.style.transform = `translateX(calc(-50% + ${compensate}px))`;
    }

    // Skip proximity glow effect on low-end devices (saves per-frame Math.hypot)
    if (!isLowEnd) {
      const glowCX = window.innerWidth / 2 + glowOffset;
      const glowCY = window.innerHeight * 0.6;
      const dist = Math.hypot(mouseX - glowCX, mouseY - glowCY);
      pathGlowEl.classList.toggle('glowing', dist < 350);
    }
  }

  revealElements();

  animateRAF = requestAnimationFrame(animate);
}

// ─────────────────────────────────────────
// Reveal Animations
// ─────────────────────────────────────────
// `.reveal` elements get `.visible` only after the scroll has reached
// 60% progress toward the target section. This keeps content from
// animating in while the section is still mostly off-screen.

function revealElements() {
  // progress = 1 when fully arrived, < 1 while still scrolling
  const progress = 1 - Math.abs(targetX - currentX) / window.innerWidth;
  if (progress < 0.6) return;
  reveals.forEach(el => {
    const section = el.closest('.section');
    if (!section) return;
    const sectionIndex = sectionsArray.indexOf(section);
    if (sectionIndex === currentSection) {
      el.classList.add('visible');
    } else if (el.id === 'path-trigger') {
      // Reset forest-path so foot animation replays on return
      el.classList.remove('visible');
    }
  });
}

// ─────────────────────────────────────────
// Text Split / Stagger
// ─────────────────────────────────────────
// Wraps each word in `.stagger-text` elements with
// `.word > .word-inner` spans so CSS can stagger their reveal.
// Each word gets a 0.07s incremental transition-delay.

function splitTextIntoWords() {
  document.querySelectorAll('.stagger-text').forEach(el => {
    const nodes = Array.from(el.childNodes);
    const fragment = document.createDocumentFragment();
    let wordIndex = 0;

    nodes.forEach(node => {
      if (node.nodeType === 3) {           // Text node — split on whitespace
        const words = node.textContent.split(/(\s+)/);
        words.forEach(part => {
          if (part.match(/^\s+$/)) {
            fragment.appendChild(document.createTextNode(part));
          } else if (part) {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'word';
            const inner = document.createElement('span');
            inner.className = 'word-inner';
            inner.textContent = part;
            inner.style.transitionDelay = (wordIndex * 0.07) + 's';
            wordSpan.appendChild(inner);
            fragment.appendChild(wordSpan);
            wordIndex++;
          }
        });
      } else if (node.nodeName === 'BR') {
        fragment.appendChild(document.createElement('br'));
      } else {
        fragment.appendChild(node.cloneNode(true));
      }
    });

    el.innerHTML = '';
    el.appendChild(fragment);
  });
}

// ─────────────────────────────────────────
// Snow Canvas
// ─────────────────────────────────────────
// 150 particles drawn on a full-viewport canvas. Each flake has its own
// speed, wind, wobble, and opacity. A jitter timer gives them a subtle
// stop-motion feel — positions jump slightly on a short interval rather
// than moving perfectly smoothly.

const snowCanvas = document.getElementById('snow-canvas');
const ctx = snowCanvas.getContext('2d');
let snowflakes = [];
let lastCurrentX = currentX;             // Previous frame's scroll position — used to compute how far we scrolled since last frame

// Scale factor for wide screens (1600px+) — matches the CSS 1.5× scaling
function getWideScale() { return window.innerWidth >= 1600 ? 1.5 : 1; }

function resizeCanvas() {
  snowCanvas.width = window.innerWidth;
  snowCanvas.height = window.innerHeight;
}

function initSnow() {
  resizeCanvas();
  snowflakes = [];
  const count = 150;
  const s = getWideScale();               // Scale up particle size on wide screens
  for (let i = 0; i < count; i++) {
    const opacity = 0.08 + Math.random() * 0.3;
    snowflakes.push({
      x: Math.random() * snowCanvas.width,
      y: Math.random() * snowCanvas.height,
      r: (0.5 + Math.random() * 2.2) * s,          // Radius
      speed: (0.15 + Math.random() * 0.6) * s,      // Fall speed
      wind: (-0.2 + Math.random() * 0.15) * s,      // Horizontal drift (slightly left-biased)
      opacity,
      wobble: Math.random() * Math.PI * 2,    // Sine wobble phase
      wobbleSpeed: 0.004 + Math.random() * 0.012,
      jitterX: 0,
      jitterY: 0,
      jitterTimer: Math.random() * 1,
      jitterInterval: 0.15 + Math.random() * 0.25,  // How often the jitter "ticks"
      drawX: Math.random() * snowCanvas.width,       // Rendered position (lerps toward x)
      drawY: Math.random() * snowCanvas.height,
      fillStyle: `rgba(190, 200, 220, ${opacity})`,
    });
  }
}

let lastSnowTime = 0;

function drawSnow(timestamp) {
  if (prefersReducedMotion || isLowEnd) return;  // Skip snow animation for reduced motion / low-end
  // dt = "delta time" — seconds elapsed since the last frame (e.g. ~0.016 s at 60 fps).
  // Used to keep jitter timing frame-rate-independent. Falls back to 16 ms on the first frame.
  const dt = lastSnowTime ? (timestamp - lastSnowTime) / 1000 : 0.016;
  lastSnowTime = timestamp;

  ctx.clearRect(0, 0, snowCanvas.width, snowCanvas.height);

  // How far the scroll moved since last frame — used to push all flakes
  // in the opposite direction so they feel anchored to the world
  const rawScrollDelta = currentX - lastCurrentX;
  lastCurrentX = currentX;
  const scrollShift = -rawScrollDelta * 0.3;  // Negative so snow drifts left with the background

  snowflakes.forEach(flake => {
    // ── Physics (true position, updated every frame) ──
    flake.wobble += flake.wobbleSpeed;
    flake.x += flake.wind + Math.sin(flake.wobble) * 0.25;
    flake.y += flake.speed;

    // Wrap around edges
    if (flake.y > snowCanvas.height + 10) {
      flake.y = -10;
      flake.x = Math.random() * snowCanvas.width;
    }
    if (flake.x < -10) flake.x = snowCanvas.width + 10;
    if (flake.x > snowCanvas.width + 10) flake.x = -10;

    // ── Subtle stop-motion jitter ──
    // Small random offset applied on a slow timer, smoothed by a gentle lerp
    flake.jitterTimer -= dt;
    if (flake.jitterTimer <= 0) {
      flake.jitterX = (Math.random() - 0.5) * 1.2;
      flake.jitterY = (Math.random() - 0.5) * 0.8;
      flake.jitterTimer = flake.jitterInterval;
    }

    // Scroll shifts the target position so the lerp smooths it naturally
    flake.x += scrollShift;
    flake.drawX += (flake.x + flake.jitterX - flake.drawX) * 0.2;
    flake.drawY += (flake.y + flake.jitterY - flake.drawY) * 0.2;

    ctx.beginPath();
    ctx.arc(flake.drawX, flake.drawY, flake.r, 0, Math.PI * 2);
    ctx.fillStyle = flake.fillStyle;
    ctx.fill();
  });

  snowRAF = requestAnimationFrame(drawSnow);
}

// ─────────────────────────────────────────
// Film Flicker Canvas
// ─────────────────────────────────────────
// Simulates old-film dust specks and hair/scratch lines. Each frame
// has a small chance of drawing artifacts — most frames are blank,
// keeping the effect subtle and random.

const flickerCanvas = document.getElementById('film-flicker');
const fctx = flickerCanvas.getContext('2d');  // fctx = flicker canvas 2D drawing context

function resizeFlicker() {
  flickerCanvas.width = window.innerWidth;
  flickerCanvas.height = window.innerHeight;
}
resizeFlicker();

function drawFlicker() {
  if (prefersReducedMotion || isLowEnd) return;  // Skip flicker animation for reduced motion / low-end
  fctx.clearRect(0, 0, flickerCanvas.width, flickerCanvas.height);

  const s = getWideScale();

  // ~2% of frames: draw 1–3 dust specks (dark or light, irregularly shaped)
  if (Math.random() < 0.02) {
    const count = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * flickerCanvas.width;
      const y = Math.random() * flickerCanvas.height;
      const size = (3 + Math.random() * 5) * s;
      const isDark = Math.random() < 0.4;

      fctx.save();
      fctx.translate(x, y);
      fctx.rotate(Math.random() * Math.PI);

      if (isDark) {
        fctx.fillStyle = `rgba(0, 0, 0, ${0.35 + Math.random() * 0.3})`;
      } else {
        fctx.fillStyle = `rgba(255, 255, 255, ${0.2 + Math.random() * 0.25})`;
      }

      // Non-circular shapes mimic real film dust
      const w = size * (0.6 + Math.random() * 0.8);
      const h = size * (0.3 + Math.random() * 0.5);
      fctx.fillRect(-w / 2, -h / 2, w, h);

      fctx.restore();
    }
  }

  // ~3% of frames: a thin vertical hair/scratch line spanning the full height
  if (Math.random() < 0.03) {
    const x = Math.random() * flickerCanvas.width;
    fctx.strokeStyle = `rgba(255, 255, 255, ${0.04 + Math.random() * 0.06})`;
    fctx.lineWidth = (0.5 + Math.random() * 0.5) * s;
    fctx.beginPath();
    fctx.moveTo(x, 0);
    fctx.lineTo(x + (Math.random() - 0.5) * 8 * s, flickerCanvas.height);  // Slight slant
    fctx.stroke();
  }

  flickerRAF = requestAnimationFrame(drawFlicker);
}
// Only start flicker loop if not in low-end or reduced-motion mode
if (!prefersReducedMotion && !isLowEnd) {
  drawFlicker();
}

// ─────────────────────────────────────────
// Navigation — Wheel, Keyboard, Touch, Dots
// ─────────────────────────────────────────

// Wheel — uses the wheel-gestures library to distinguish a real scroll
// gesture from trackpad momentum (inertia). Without this, one swipe on a
// Mac trackpad would fire dozens of wheel events and skip multiple sections.
// We only act on `isStart` (the first event of a new physical gesture).
const wheelGestures = WheelGestures();
wheelGestures.observe(document.documentElement);
wheelGestures.on('wheel', (state) => {
  if (window.lightboxOpen) {
    state.event.preventDefault();
    return;
  }
  state.event.preventDefault();

  // Only act on the start of a new gesture, ignore momentum
  if (!state.isStart) return;

  // Pick whichever axis has more movement (supports both vertical
  // scroll wheels and horizontal trackpad swipes)
  const e = state.event;
  const dy = e.deltaY;
  const dx = e.deltaX;
  const delta = Math.abs(dy) > Math.abs(dx) ? dy : dx;
  if (Math.abs(delta) < 3) return;         // ignore tiny accidental movements

  if (delta > 0) goToSection(currentSection + 1);
  else goToSection(currentSection - 1);
});

// Keyboard — arrow keys navigate sections (same cooldown as wheel)
window.addEventListener('keydown', (e) => {
  if (window.lightboxOpen) return;
  // Don't intercept keys when a text-input element is focused
  const active = document.activeElement;
  const tag = active ? active.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    const now = Date.now();
    if (now - lastKeyScrollTime < keyScrollCooldown) return;
    lastKeyScrollTime = now;
    goToSection(currentSection + 1);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    const now = Date.now();
    if (now - lastKeyScrollTime < keyScrollCooldown) return;
    lastKeyScrollTime = now;
    goToSection(currentSection - 1);
  }
});

// Touch — swipe left/right to navigate (50px minimum swipe distance)
let touchStartX = 0;
let touchStartY = 0;

window.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;

  // Only count horizontal swipes that exceed the dead zone
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
    if (dx < 0) goToSection(currentSection + 1);
    else goToSection(currentSection - 1);
  }
}, { passive: true });

// Progress dots — click to jump to a section
dots.forEach(dot => {
  dot.addEventListener('click', () => {
    goToSection(Array.from(dots).indexOf(dot));
  });
});

// ─────────────────────────────────────────
// Navigation — Project & Gallery Links
// ─────────────────────────────────────────
// Project titles and images navigate to their case study page.
// The href is read from the closest section's data-href attribute.

document.querySelectorAll('.project-title').forEach(title => {
  title.addEventListener('click', () => {
    const href = title.closest('.section')?.dataset.href;
    if (href) {
      sessionStorage.setItem('portfolio-return-section', currentSection);
      window.location.href = href;
    }
  });
});
// Project image clicks handled by lightbox.js (zoom instead of navigate)

// Keyboard activation for project sections (Enter/Space on focused section)
document.querySelectorAll('[data-href]').forEach(section => {
  section.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement === section) {
      e.preventDefault();
      sessionStorage.setItem('portfolio-return-section', currentSection);
      window.location.href = section.dataset.href;
    }
  });
});

// Gallery path: store section before navigating
const pathTrigger = document.getElementById('path-trigger');
if (pathTrigger) {
  pathTrigger.addEventListener('click', () => {
    sessionStorage.setItem('portfolio-return-section', currentSection);
  });
}

// ─────────────────────────────────────────
// Event Listeners — Resize
// ─────────────────────────────────────────

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    // Snap scroll position to current section at new viewport width
    targetX = currentSection * window.innerWidth;
    currentX = targetX;
    lastCurrentX = currentX;              // Prevent snow delta spike after resize snap
    // Reinit snow so particle sizes match the new scale factor
    initSnow();
    resizeFlicker();
    alignBioPhoto();
  }, 150);                                // 150ms debounce
});

// ─────────────────────────────────────────
// Bio photo alignment — top of photo matches top of text block
// ─────────────────────────────────────────
function alignBioPhoto() {
  const textBlock = document.querySelector('.about-text-block');
  const photo = document.querySelector('.bio-photo');
  if (!textBlock || !photo) return;
  // Both are flex-centered; offset = half the height difference
  const diff = photo.offsetHeight - textBlock.offsetHeight;
  if (diff > 0) {
    photo.style.marginTop = diff + 'px';
  } else {
    photo.style.marginTop = '';
  }
}

// ─────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────

splitTextIntoWords();
alignBioPhoto();
initSnow();

// Only start heavy animation loops if not in low-end or reduced-motion mode
if (!prefersReducedMotion && !isLowEnd) {
  snowRAF = requestAnimationFrame(drawSnow);
}

// Initialize FX toggle button state
const fxToggle = document.getElementById('fx-toggle');
if (fxToggle && isLowEnd) {
  fxToggle.setAttribute('aria-pressed', 'true');
}

// If returning to a specific section, defer the snap until the loader is about to split.
// Setting currentX/targetX immediately can cause layout scaling issues while the loader covers the screen.
if (isReturning && returnSection >= 0 && returnSection < totalSections) {
  currentSection = returnSection;
  updateDots();
  if (pathGlowEl) pathGlowEl.classList.toggle('visible', returnSection === totalSections - 1);
  // Pre-trigger reveals for all sections up to and including the return section
  reveals.forEach(el => {
    const section = el.closest('.section');
    if (!section) return;
    const sectionIndex = sectionsArray.indexOf(section);
    if (sectionIndex <= returnSection) el.classList.add('visible');
  });
  // Snap the scroll position right before the loader splits (after rings finish)
  setTimeout(() => {
    targetX = returnSection * window.innerWidth;
    currentX = targetX;
    lastCurrentX = currentX;              // Prevent snow delta spike from the instant scroll snap
  }, 1400);
}

animate();

// Kick off reveals for the first section after a brief tick
setTimeout(() => revealElements(), 100);

// ─────────────────────────────────────────
// Mouse Position Tracking
// ─────────────────────────────────────────
// Lightweight listener that stores coordinates for use in the animate() loop
// (path glow proximity check). No layout-triggering calls here.

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

// ─────────────────────────────────────────
// Visibility / Lifecycle
// ─────────────────────────────────────────
// Pause all rAF loops when the tab is backgrounded to save CPU,
// and resume them when the user returns.

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(animateRAF);
    cancelAnimationFrame(snowRAF);
    cancelAnimationFrame(flickerRAF);
  } else {
    lastCurrentX = currentX;  // Reset so drawSnow doesn't see a huge delta on first frame back
    lastSnowTime = 0;         // Reset so drawSnow uses fallback dt on first frame back (avoids huge dt from tab gap)
    animateRAF = requestAnimationFrame(animate);
    // Only restart heavy loops if not in low-end or reduced-motion mode
    if (!prefersReducedMotion && !isLowEnd) {
      snowRAF = requestAnimationFrame(drawSnow);
      flickerRAF = requestAnimationFrame(drawFlicker);
    }
  }
});
