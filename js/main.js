// ─────────────────────────────────────────
// Constants & Configuration
// ─────────────────────────────────────────
const loaderStart = Date.now();
const LOADER_MIN_MS = 2400;              // Minimum time the loader stays visible (feels intentional, not a flash)
const scrollCooldown = 500;              // ms between accepted wheel/key scroll events

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
document.addEventListener('mousemove', function loaderMouseTrack(e) {
  loaderMouseX = e.clientX;
  loaderMouseY = e.clientY;
});

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
  loaderRings.style.left = loaderPosX + 'px';
  loaderRings.style.top = loaderPosY + 'px';
  requestAnimationFrame(animateLoaderRings);
}
animateLoaderRings();

window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  if (!loader) return;
  // Wait at least LOADER_MIN_MS so the animation doesn't feel cut short
  const elapsed = Date.now() - loaderStart;
  const remaining = Math.max(0, LOADER_MIN_MS - elapsed);
  setTimeout(() => {
    loaderDone = true;                    // Rings start chasing mouse
    loader.classList.add('done');          // Fade out rings via CSS
    setTimeout(() => {
      loader.classList.add('split');       // Halves shrink to letterbox bars
      // Title section animates in as the loader opens
      document.querySelector('.title-section').classList.add('title-visible');
      setTimeout(() => {
        loader.remove();                  // Clean up DOM after split animation (600ms)
      }, 600);
    }, 350);                              // 350ms ring fade before split begins
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
const reveals = document.querySelectorAll('.reveal');

// ─────────────────────────────────────────
// Scroll Engine — Targeting & Easing
// ─────────────────────────────────────────
// No native scroll — container is a flex row translated via transform.
// `targetX` is the destination (snapped to section boundaries).
// `currentX` lerps toward `targetX` each frame at 0.04 easing for
// a slow, cinematic glide.

let currentX = 0;
let targetX = 0;
let currentSection = 0;
let lastScrollTime = 0;

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
  const ease = 0.04;
  const diff = targetX - currentX;

  // Snap when close enough to avoid sub-pixel drift
  if (Math.abs(diff) > 0.5) {
    currentX += diff * ease;
  } else {
    currentX = targetX;
  }

  container.style.transform = `translateX(${-currentX}px)`;

  // ── Parallax ──
  // Each layer scrolls at a fraction of the content speed.
  // Rates: far 0.08, mid 0.2, near 0.4, front 0.65
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

  // Keep the path glow centered on the last section as we scroll
  if (pathGlowEl) {
    const lastSectionCenter = (totalSections - 1) * window.innerWidth + window.innerWidth / 2;
    const glowOffset = lastSectionCenter - currentX - window.innerWidth / 2;
    pathGlowEl.style.transform = `translateX(calc(-50% + ${glowOffset}px))`;
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
  const progress = targetX === 0 ? 1 : 1 - Math.abs(targetX - currentX) / window.innerWidth;
  if (progress < 0.6) return;
  reveals.forEach(el => {
    const section = el.closest('.section');
    if (!section) return;
    const sectionIndex = Array.from(sections).indexOf(section);
    if (sectionIndex === currentSection) {
      el.classList.add('visible');
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
// Star Field
// ─────────────────────────────────────────
// 80 tiny divs placed in the top 40% of the viewport with randomized
// CSS custom properties for twinkle duration, delay, and peak opacity.

function createStars() {
  const starsContainer = document.getElementById('stars');
  const count = 80;
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 40 + '%';       // Upper portion only — below the canopy line
    star.style.setProperty('--dur', (3 + Math.random() * 5) + 's');
    star.style.setProperty('--delay', (Math.random() * 5) + 's');
    star.style.setProperty('--max-opacity', (0.15 + Math.random() * 0.3).toFixed(2));
    const size = 1 + Math.random() * 1.5;
    star.style.width = size + 'px';
    star.style.height = size + 'px';
    starsContainer.appendChild(star);
  }
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
let lastCurrentX = currentX;             // Tracks previous frame's scroll position for delta

function resizeCanvas() {
  snowCanvas.width = window.innerWidth;
  snowCanvas.height = window.innerHeight;
}

function initSnow() {
  resizeCanvas();
  snowflakes = [];
  const count = 150;
  for (let i = 0; i < count; i++) {
    snowflakes.push({
      x: Math.random() * snowCanvas.width,
      y: Math.random() * snowCanvas.height,
      r: 0.5 + Math.random() * 2.2,          // Radius
      speed: 0.15 + Math.random() * 0.6,      // Fall speed
      wind: -0.2 + Math.random() * 0.15,      // Horizontal drift (slightly left-biased)
      opacity: 0.08 + Math.random() * 0.3,
      wobble: Math.random() * Math.PI * 2,    // Sine wobble phase
      wobbleSpeed: 0.004 + Math.random() * 0.012,
      jitterX: 0,
      jitterY: 0,
      jitterTimer: Math.random() * 1,
      jitterInterval: 0.15 + Math.random() * 0.25,  // How often the jitter "ticks"
      drawX: Math.random() * snowCanvas.width,       // Rendered position (lerps toward x)
      drawY: Math.random() * snowCanvas.height,
    });
  }
}

function drawSnow() {
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
    flake.jitterTimer -= 0.016;               // ~60fps frame budget
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
    ctx.fillStyle = `rgba(190, 200, 220, ${flake.opacity})`;
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
const fctx = flickerCanvas.getContext('2d');

function resizeFlicker() {
  flickerCanvas.width = window.innerWidth;
  flickerCanvas.height = window.innerHeight;
}
resizeFlicker();

function drawFlicker() {
  fctx.clearRect(0, 0, flickerCanvas.width, flickerCanvas.height);

  // ~2% of frames: draw 1–3 dust specks (dark or light, irregularly shaped)
  if (Math.random() < 0.02) {
    const count = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * flickerCanvas.width;
      const y = Math.random() * flickerCanvas.height;
      const size = 3 + Math.random() * 5;
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
    fctx.lineWidth = 0.5 + Math.random() * 0.5;
    fctx.beginPath();
    fctx.moveTo(x, 0);
    fctx.lineTo(x + (Math.random() - 0.5) * 8, flickerCanvas.height);  // Slight slant
    fctx.stroke();
  }

  flickerRAF = requestAnimationFrame(drawFlicker);
}
drawFlicker();

// ─────────────────────────────────────────
// Navigation — Wheel, Keyboard, Touch, Dots
// ─────────────────────────────────────────

// Wheel — snaps to next/previous section with cooldown
function handleWheel(e) {

  e.preventDefault();
  const now = Date.now();
  if (now - lastScrollTime < scrollCooldown) return;

  // Use whichever axis has more magnitude (handles trackpads and mice)
  const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
  if (delta > 20) {                       // Dead-zone threshold to ignore tiny gestures
    goToSection(currentSection + 1);
    lastScrollTime = now;
  } else if (delta < -20) {
    goToSection(currentSection - 1);
    lastScrollTime = now;
  }
}

window.addEventListener('wheel', handleWheel, { passive: false });

// Keyboard — arrow keys navigate sections (same cooldown as wheel)
window.addEventListener('keydown', (e) => {
  // Don't intercept keys when an interactive element is focused
  const active = document.activeElement;
  const tag = active ? active.tagName : '';
  if (active && active !== document.body && tag !== 'HTML') return;

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    const now = Date.now();
    if (now - lastScrollTime < scrollCooldown) return;
    lastScrollTime = now;
    goToSection(currentSection + 1);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    const now = Date.now();
    if (now - lastScrollTime < scrollCooldown) return;
    lastScrollTime = now;
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
    if (href) window.location.href = href;
  });
});
document.querySelectorAll('.project-img').forEach(img => {
  img.addEventListener('click', () => {
    const href = img.closest('.section')?.dataset.href;
    if (href) window.location.href = href;
  });
});

// Keyboard activation for project sections (Enter/Space on focused section)
document.querySelectorAll('[data-href]').forEach(section => {
  section.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement === section) {
      e.preventDefault();
      window.location.href = section.dataset.href;
    }
  });
});

// Gallery path: #path-trigger is a semantic <a>, no JS handler needed

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
    resizeCanvas();
    resizeFlicker();
  }, 150);                                // 150ms debounce
});

// ─────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────

splitTextIntoWords();
createStars();
initSnow();
drawSnow();
animate();

// Kick off reveals for the first section after a brief tick
setTimeout(() => revealElements(), 100);

// ─────────────────────────────────────────
// Path Glow Hover Effect
// ─────────────────────────────────────────
// When the mouse is within 250px of the path glow's center, add the
// `.glowing` class for a proximity-based brightness boost.

document.addEventListener('mousemove', (e) => {
  if (!pathGlowEl) return;
  const rect = pathGlowEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height * 0.35;  // Bias upward — glow emanates from upper portion
  const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
  pathGlowEl.classList.toggle('glowing', dist < 250);
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
    animateRAF = requestAnimationFrame(animate);
    snowRAF = requestAnimationFrame(drawSnow);
    flickerRAF = requestAnimationFrame(drawFlicker);
  }
});
