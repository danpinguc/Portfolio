// ─────────────────────────────────────────
// Lightbox — image zoom overlay for all pages
// ─────────────────────────────────────────

(function () {
  'use strict';

  // Track state
  window.lightboxOpen = false;
  var sourceEl = null;

  // Selectors for clickable images
  var IMG_SELECTOR = 'img.cs-img, img.cs-hero-img, .gallery-item img, img.project-img-inner';

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
    // Scale image to fill available space while preserving aspect ratio
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

    // Fix 2: recalculate image size if viewport changes while open
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

    // Fix 1: clear stale onload callback
    lbImg.onload = null;

    // Fix 2: stop listening for viewport resize
    window.removeEventListener('resize', onResize);

    if (sourceEl) {
      // Fix 4: <img> elements aren't natively focusable — add tabindex if missing
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

    // Prevent project section navigation on image click
    e.stopPropagation();
    e.preventDefault();
    open(img);
  }, true); // capture phase to beat data-href handlers

  // Close triggers
  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  document.addEventListener('keydown', function (e) {
    if (!window.lightboxOpen) return;

    if (e.key === 'Escape') {
      close();
      return;
    }

    // Fix 3: trap focus within the lightbox dialog
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

(function () {
  'use strict';

  var MAX_TILT = 6;             // degrees
  var SCALE_HOVER = 1.03;       // subtle lift
  var GLARE_MAX_OPACITY = 0.25;

  // Container selectors that get the tilt effect
  // .cs-hero-wrap excluded — full-width heroes have ~1:1 perspective ratio causing exaggerated tilt
  var TILT_SELECTOR = '.project-img, .cs-img-wrap, .gallery-item, .collage-img, .bio-photo';

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

  // Fix 5: cache rect on mouseenter to avoid layout thrashing on every mousemove
  function handleEnter(e) {
    var card = e.currentTarget;
    card._tiltRect = card.getBoundingClientRect();
  }

  function handleMove(e) {
    var card = e.currentTarget;
    var rect = card._tiltRect || card.getBoundingClientRect();

    // Normalised position -1 to 1 from center
    var nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    var ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

    // Rotate opposite to cursor direction for natural feel
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

    // Fix 5: clear cached rect
    delete card._tiltRect;

    // Fix 6: reset glare background + opacity to prevent stale gradient flash on next hover
    var glare = card._tiltGlare;
    if (glare) {
      glare.style.opacity = '0';
      glare.style.background = '';
    }
  }

  // Attach listeners via delegation would be complex with mousemove,
  // so bind directly to each card on init
  function setup() {
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
