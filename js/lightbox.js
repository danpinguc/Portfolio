// ─────────────────────────────────────────
// Lightbox — image zoom overlay for all pages
// ─────────────────────────────────────────
// Clicking any portfolio image opens a full-screen overlay showing the
// image at its natural resolution (up to 90% of the viewport). The overlay
// includes a dark backdrop, a close button, and an optional caption pulled
// from `data-caption` or `data-title`/`data-description` attributes.
// While open, page scroll and keyboard navigation are suppressed.

(function () {
  'use strict';

  // Global flag checked by main.js to suppress scroll while the lightbox is open
  window.lightboxOpen = false;
  var sourceEl = null;            // the <img> that was clicked, so we can return focus on close

  // All image selectors that are clickable to open the lightbox
  var IMG_SELECTOR = 'img.cs-img, img.cs-hero-img, .gallery-item img, img.project-img-inner, .bio-photo img';

  // ── Build DOM ──────────────────────────
  var overlay = document.createElement('div');
  overlay.id = 'lightbox-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Image preview');

  overlay.innerHTML =
    '<div id="lightbox-backdrop"></div>' +
    '<button id="lightbox-close" aria-label="Close">&times;</button>' +
    '<div id="lightbox-container">' +
      '<img src="" alt="">' +
      '<div id="lightbox-caption"></div>' +
    '</div>';

  document.body.appendChild(overlay);

  var backdrop = document.getElementById('lightbox-backdrop');
  var closeBtn = document.getElementById('lightbox-close');
  var container = document.getElementById('lightbox-container');
  var lbImg = container.querySelector('img');
  var caption = document.getElementById('lightbox-caption');

  // ── Open ───────────────────────────────
  function sizeImage() {
    // Scale the image to be as large as possible within 90% width / 85% height
    // of the viewport, without stretching or cropping it.
    var natW = lbImg.naturalWidth;
    var natH = lbImg.naturalHeight;
    if (!natW || !natH) return;

    var maxW = window.innerWidth * 0.9;
    var maxH = window.innerHeight * 0.85;
    var scale = Math.min(maxW / natW, maxH / natH);
    // Allow upscaling small images (capped at 3x to avoid blur)
    if (scale > 3) scale = 3;
    lbImg.style.width = Math.round(natW * scale) + 'px';
    lbImg.style.height = Math.round(natH * scale) + 'px';
  }

  function open(imgEl) {
    sourceEl = imgEl;
    lbImg.src = imgEl.src;
    lbImg.alt = imgEl.alt || '';

    // Size once loaded (or immediately if cached)
    if (lbImg.complete && lbImg.naturalWidth) {
      sizeImage();
    } else {
      lbImg.onload = sizeImage;
    }

    var cap = imgEl.getAttribute('data-caption');
    if (!cap) {
      var title = imgEl.getAttribute('data-title');
      var desc = imgEl.getAttribute('data-description');
      if (title) cap = desc ? title + ' \u2014 ' + desc : title;
    }
    if (cap) {
      caption.textContent = cap;
      caption.classList.add('visible');
    } else {
      caption.textContent = '';
      caption.classList.remove('visible');
    }

    overlay.classList.add('active');
    document.documentElement.classList.add('lightbox-body-lock');
    window.lightboxOpen = true;

    // Recalculate image size if the viewport changes while the lightbox is open
    window.addEventListener('resize', onResize);

    closeBtn.focus();
  }

  // ── Resize handler (added/removed with open/close) ──
  function onResize() {
    if (window.lightboxOpen) sizeImage();
  }

  // ── Close ──────────────────────────────
  function close() {
    overlay.classList.remove('active');
    document.documentElement.classList.remove('lightbox-body-lock');
    window.lightboxOpen = false;

    // Clear the onload handler so it doesn't fire for a previous image
    lbImg.onload = null;

    // Stop resizing now that the lightbox is closed
    window.removeEventListener('resize', onResize);

    if (sourceEl) {
      // <img> elements aren't natively focusable — temporarily add tabindex so
      // focus can return to the image that opened the lightbox (accessibility)
      var hadTabindex = sourceEl.hasAttribute('tabindex');
      if (!hadTabindex) sourceEl.setAttribute('tabindex', '-1');
      sourceEl.focus();
      if (!hadTabindex) sourceEl.removeAttribute('tabindex');
      sourceEl = null;
    }
  }

  // ── Event listeners ────────────────────

  // Click delegation for images
  document.addEventListener('click', function (e) {
    var img = e.target.closest(IMG_SELECTOR);
    if (!img) return;

    // Stop the click from bubbling up to the parent section's data-href
    // navigation handler — we want to open the lightbox, not navigate away
    e.stopPropagation();
    e.preventDefault();
    open(img);
  }, true); // capture phase fires before the section's click handler

  // Close triggers
  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  document.addEventListener('keydown', function (e) {


    if (!window.lightboxOpen) return;

    if (e.key === 'Escape') {
      close();
      return;
    }

    // Trap focus within the lightbox so Tab/Shift+Tab cycles between the
    // close button and the image instead of reaching elements behind the overlay
    if (e.key === 'Tab') {
      var focusable = [closeBtn, lbImg];
      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      // Make lbImg temporarily focusable if it isn't
      if (!lbImg.hasAttribute('tabindex')) lbImg.setAttribute('tabindex', '-1');

      if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });
})();

// ─────────────────────────────────────────
// Apple TV–style 3D tilt on image containers
// ─────────────────────────────────────────
// When hovering an image card, it tilts toward the cursor in 3D (using CSS
// rotateX/rotateY) and a radial glare overlay follows the mouse, mimicking
// a glossy surface catching light. On mouse leave, the card eases back flat.

(function () {
  'use strict';

  var MAX_TILT = 6;             // maximum rotation in degrees
  var SCALE_HOVER = 1.03;       // slight zoom-up on hover for a "lift" feel
  var GLARE_MAX_OPACITY = 0.25; // peak opacity of the radial glare highlight

  // Which containers get the tilt effect.
  // .cs-hero-wrap is excluded because full-width heroes have a nearly 1:1
  // width-to-perspective ratio that makes the tilt look exaggerated.
  var TILT_SELECTOR = '.project-img, .cs-img-wrap, .gallery-item, .bio-photo';

  // Inject glare div + add classes once per card
  function initCard(card) {
    if (card.dataset.tiltInit) return;
    card.dataset.tiltInit = '1';

    card.classList.add('tilt-card');

    // Wrap parent with perspective if not already set
    var parent = card.parentElement;
    if (parent && !parent.classList.contains('tilt-parent')) {
      parent.classList.add('tilt-parent');
    }

    // Create glare overlay
    var glare = document.createElement('div');
    glare.className = 'tilt-glare';
    card.appendChild(glare);
    card._tiltGlare = glare;
  }

  // Cache the card's bounding rectangle on mouseenter so we don't force the
  // browser to recalculate layout on every mousemove (expensive)
  function handleEnter(e) {
    var card = e.currentTarget;
    card._tiltRect = card.getBoundingClientRect();
  }

  function handleMove(e) {
    var card = e.currentTarget;
    var rect = card._tiltRect || card.getBoundingClientRect();

    // Map cursor position to -1..+1 range relative to the card's center.
    // -1 = left/top edge, 0 = center, +1 = right/bottom edge.
    var nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    var ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

    // Tilt the card away from the cursor — feels like pushing down one edge
    var rotateY = nx * MAX_TILT;
    var rotateX = -ny * MAX_TILT;

    card.style.transition = 'none';
    card.style.transform =
      'scale(' + SCALE_HOVER + ') rotateX(' + rotateX.toFixed(2) + 'deg) rotateY(' + rotateY.toFixed(2) + 'deg)';

    // Move glare to follow cursor
    var glare = card._tiltGlare;
    if (glare) {
      var glareX = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
      var glareY = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
      glare.style.background =
        'radial-gradient(circle at ' + glareX + '% ' + glareY + '%, rgba(255,255,255,0.18) 0%, transparent 60%)';
      glare.style.opacity = GLARE_MAX_OPACITY;
    }
  }

  function handleLeave(e) {
    var card = e.currentTarget;
    card.style.transition = '';
    card.style.transform = '';

    // Clear cached rectangle (it may be stale on next hover if the page scrolled)
    delete card._tiltRect;

    // Reset glare so it doesn't briefly flash the old gradient on next hover
    var glare = card._tiltGlare;
    if (glare) {
      glare.style.opacity = '0';
      glare.style.background = '';
    }
  }

  // Bind listeners directly to each card (event delegation doesn't work well
  // with mousemove since we need per-card state).
  // Skip entirely when user prefers reduced motion or device is low-end.
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isLowEnd = document.documentElement.classList.contains('low-end');

  function setup() {
    if (prefersReducedMotion || isLowEnd) return;
    var cards = document.querySelectorAll(TILT_SELECTOR);
    cards.forEach(function (card) {
      initCard(card);
      card.addEventListener('mouseenter', handleEnter);
      card.addEventListener('mousemove', handleMove);
      card.addEventListener('mouseleave', handleLeave);
    });
  }

  // Run on DOMContentLoaded if not already fired
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
