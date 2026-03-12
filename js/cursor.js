/* ===================================================
   CUSTOM CURSOR + MOUSE GLOW (shared across all pages)
   =================================================== */

// ─────────────────────────────────────────
// Constants & Configuration
// ─────────────────────────────────────────
// Selector string for all elements that trigger the hover-expand cursor state.
// Add new interactive element types here — one place to maintain.
const INTERACTIVE_SELECTOR = 'a, button, [data-href], .project-title, .project-img, .forest-path, .tag';

// ─────────────────────────────────────────
// DOM Elements
// ─────────────────────────────────────────
const mouseGlow = document.getElementById('mouse-glow');
const customCursor = document.getElementById('custom-cursor');

// Guard: if cursor markup is missing or device is touch-only, skip all cursor setup
const isTouchDevice = 'ontouchstart' in window && matchMedia('(pointer: coarse)').matches;
if (isTouchDevice && mouseGlow) mouseGlow.style.display = 'none';
if (customCursor && !isTouchDevice) {

const cursorDot = customCursor.querySelector('.cursor-dot');
const cursorRing1 = customCursor.querySelector('.cursor-ring-1');
const cursorRing2 = customCursor.querySelector('.cursor-ring-2');
const cursorRing3 = customCursor.querySelector('.cursor-ring-3');

// Hide cursor elements until first mousemove (prevents flash at 0,0)
customCursor.style.opacity = '0';
if (mouseGlow) mouseGlow.style.opacity = '0';

// ─────────────────────────────────────────
// Mouse Tracking & Interpolation
// ─────────────────────────────────────────
// Current mouse position, updated on every mousemove.
const mousePos = { x: 0, y: 0 };
let cursorVisible = false;
// Track whether the current interaction is touch — suppress cursor for touch input
let isTouching = false;

// Previous-frame position for velocity calculation (squeeze effect).
let prevMouseX = 0, prevMouseY = 0;

// Smoothed velocity — lerped each frame to avoid jitter in the oval deformation.
let smoothVx = 0, smoothVy = 0;

// ─────────────────────────────────────────
// Event Listeners — Mouse Movement
// ─────────────────────────────────────────
// Tracks raw mouse position and positions the radial glow div directly.
// Also reveals the cursor on first movement (hidden until mouse enters viewport).
// Suppress cursor for touch — touchstart sets flag, touchend clears it after
// a short delay so the synthetic mousemove that follows a tap is ignored.
document.addEventListener('touchstart', () => { isTouching = true; }, { passive: true });
document.addEventListener('touchend', () => {
  setTimeout(() => { isTouching = false; }, 400);
}, { passive: true });

document.addEventListener('mousemove', (e) => {
  if (isTouching) return;
  mousePos.x = e.clientX;
  mousePos.y = e.clientY;
  mouseGlow.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
  if (!cursorVisible) {
    cursorVisible = true;
    // Position rings immediately before showing, so they don't flash at 0,0
    const initT = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    cursorDot.style.transform = initT;
    cursorRing1.style.transform = initT;
    cursorRing2.style.transform = initT;
    cursorRing3.style.transform = initT;
    customCursor.style.opacity = '1';
    mouseGlow.style.opacity = '1';
  }
});

// Hide cursor and glow when mouse leaves the window
document.documentElement.addEventListener('mouseleave', () => {
  cursorVisible = false;
  customCursor.style.opacity = '0';
  mouseGlow.style.opacity = '0';
});

// Show cursor and glow when mouse re-enters the window
document.documentElement.addEventListener('mouseenter', () => {
  if (isTouching) return;
  cursorVisible = true;
  customCursor.style.opacity = '1';
  mouseGlow.style.opacity = '1';
});

// ─────────────────────────────────────────
// Animation Loop
// ─────────────────────────────────────────
// Runs every frame via requestAnimationFrame to position the cursor elements.
//
// The dot follows the mouse exactly, but gets an oval "squeeze" effect based
// on how fast the mouse is moving — fast horizontal movement compresses it
// horizontally (scaleX < 1), and vice versa for vertical.
//
// The three rings trail the mouse with slow organic jitter: each ring uses
// sin/cos waves at slightly different speeds to drift a few pixels around
// the mouse, creating a "breathing" feel.
//
// All positioning uses CSS `transform` (not left/top) so the browser can
// composite on the GPU without triggering layout recalculations.
//
// When prefers-reduced-motion is active, everything snaps directly to the
// mouse position with no squeeze or jitter.
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Check for low-end device mode (set by main.js detection or user toggle).
// Re-read the class each frame so toggling takes effect immediately.
function isLowEndDevice() {
  return document.documentElement.classList.contains('low-end');
}

let time = 0;              // monotonically increasing counter fed into sin/cos for ring jitter
let cursorRAF;
function animateCursor() {
  if (prefersReducedMotion || isLowEndDevice()) {
    // Simplified: all elements snap to mouse position, no squeeze or jitter
    const t = `translate(${mousePos.x}px, ${mousePos.y}px) translate(-50%, -50%)`;
    cursorDot.style.transform = t;
    cursorRing1.style.transform = t;
    cursorRing2.style.transform = t;
    cursorRing3.style.transform = t;
    cursorRAF = requestAnimationFrame(animateCursor);
    return;
  }

  time += 0.02;

  // Calculate mouse velocity for squeeze effect
  const rawVx = mousePos.x - prevMouseX;
  const rawVy = mousePos.y - prevMouseY;
  prevMouseX = mousePos.x;
  prevMouseY = mousePos.y;

    // Smooth velocity with lerp so the oval deformation eases in/out
  // instead of snapping on sudden mouse stops
  smoothVx += (rawVx - smoothVx) * 0.15;
  smoothVy += (rawVy - smoothVy) * 0.15;

  // Squeeze: compress the dot along the axis of movement.
  // maxSqueeze caps the effect at 22%; sensitivity controls how much
  // velocity is needed to reach that cap.
  const maxSqueeze = 0.22;
  const sensitivity = 0.018;
  const sx = 1 - Math.min(Math.abs(smoothVx) * sensitivity, maxSqueeze);
  const sy = 1 - Math.min(Math.abs(smoothVy) * sensitivity, maxSqueeze);

  // All elements follow mouse directly — use transform for GPU-composited positioning
  cursorDot.style.transform = `translate(${mousePos.x}px, ${mousePos.y}px) translate(-50%, -50%) scaleX(${sx}) scaleY(${sy})`;
  // Rings get slow organic jitter using sin waves
  cursorRing1.style.transform = `translate(${mousePos.x + Math.sin(time * 1.1) * 0.4}px, ${mousePos.y + Math.cos(time * 1.3) * 0.4}px) translate(-50%, -50%) scaleX(${sx}) scaleY(${sy})`;
  cursorRing2.style.transform = `translate(${mousePos.x + Math.sin(time * 0.9 + 2) * 0.6}px, ${mousePos.y + Math.cos(time * 1.1 + 2) * 0.6}px) translate(-50%, -50%) scaleX(${sx}) scaleY(${sy})`;
  cursorRing3.style.transform = `translate(${mousePos.x + Math.sin(time * 0.7 + 4) * 0.8}px, ${mousePos.y + Math.cos(time * 0.8 + 4) * 0.8}px) translate(-50%, -50%) scaleX(${sx}) scaleY(${sy})`;

  cursorRAF = requestAnimationFrame(animateCursor);
}
cursorRAF = requestAnimationFrame(animateCursor);

// ─────────────────────────────────────────
// Visibility / Lifecycle
// ─────────────────────────────────────────
// Pause the cursor rAF loop when the tab is backgrounded to save CPU,
// and resume it when the user returns.

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(cursorRAF);
  } else {
    cursorRAF = requestAnimationFrame(animateCursor);
  }
});

// ─────────────────────────────────────────
// Hover Detection
// ─────────────────────────────────────────
// Event delegation: when mouse enters/leaves any interactive element
// (or its child), toggle the .hovering class on the cursor.
document.addEventListener('mouseover', (e) => {
  const isInteractive = !!e.target.closest(INTERACTIVE_SELECTOR);
  customCursor.classList.toggle('hovering', isInteractive);
});

} // end customCursor guard
