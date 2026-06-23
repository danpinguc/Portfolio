/* ============================================================
   site.js — shared behaviour for all pages
   reveal-on-scroll · reading progress · mobile nav · lightbox
   Dependency-free. Each behaviour is feature-detected, so the
   same file is safe to load on the landing page and case studies.
   ============================================================ */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* respect reduced-motion for autoplaying gallery videos → freeze on poster */
  if (reduce) {
    document.querySelectorAll("video[autoplay]").forEach(function (v) {
      v.removeAttribute("autoplay"); v.pause();
    });
  }

  /* ---- gallery clips: on-brand pause/play chip (no native controls) ----
     Keeps the framed-tile caption intact while still giving a pause
     mechanism (WCAG 2.2.2) for the looping animations. */
  document.querySelectorAll(".masonry .tile video").forEach(function (v) {
    var name = (v.getAttribute("aria-label") || "animation").split("—")[0].trim();
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "clipctl";
    var sync = function () {
      var paused = v.paused;
      btn.innerHTML = '<span class="g" aria-hidden="true">' + (paused ? "▶" : "❚❚") + "</span>" +
        (paused ? "play" : "pause");
      btn.setAttribute("aria-label", (paused ? "Play " : "Pause ") + name);
    };
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (v.paused) { v.play(); } else { v.pause(); }
    });
    v.addEventListener("click", function () { if (v.paused) { v.play(); } else { v.pause(); } });
    v.addEventListener("play", sync);
    v.addEventListener("pause", sync);
    (v.closest(".tile") || v.parentNode).appendChild(btn);
    sync();
  });

  /* ---- reveal on scroll ---- */
  var reveals = document.querySelectorAll(".reveal");
  if (reveals.length) {
    if (reduce || !("IntersectionObserver" in window)) {
      reveals.forEach(function (el) { el.classList.add("in"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { io.unobserve(e.target); e.target.classList.add("in"); }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -7% 0px" });
      reveals.forEach(function (el) { io.observe(el); });
    }
  }

  /* ---- reading progress bar (only if present) ---- */
  var bar = document.getElementById("progress");
  if (bar) {
    var onScroll = function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? h.scrollTop / max : 0) + ")";
    };
    document.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
  }

  /* ---- mobile nav toggle (only if a .navtoggle exists) ---- */
  var toggle = document.querySelector(".navtoggle");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    var setOpen = function (open) {
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
    toggle.addEventListener("click", function () {
      setOpen(nav.classList.contains("open") === false);
    });
    /* close after choosing a destination */
    nav.querySelectorAll(".navlinks a").forEach(function (a) {
      a.addEventListener("click", function () { setOpen(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  /* ---- lightbox for content images ----
     Every content image opens a preview EXCEPT images that are links
     (e.g. the case-study cards / next-project card), which navigate.
     We target the known content images and additionally skip any <img>
     nested inside an <a>. */
  var zoomables = Array.prototype.filter.call(
    document.querySelectorAll(".plate img, .masonry .tile img, .photo img"),
    function (img) { return !img.closest("a"); }
  );
  if (zoomables.length) {
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("aria-hidden", "true");
    box.innerHTML =
      '<button class="lb-close" type="button" aria-label="Close image">close ✕</button>' +
      '<figure class="lb-figure"><img alt=""><figcaption class="lb-cap"></figcaption></figure>';
    document.body.appendChild(box);
    var lbImg = box.querySelector("img");
    var lbCap = box.querySelector(".lb-cap");
    var lbClose = box.querySelector(".lb-close");
    var lastFocus = null;

    var open = function (img) {
      lastFocus = document.activeElement;
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt || "";
      lbCap.textContent = img.alt || "";
      box.classList.add("on");
      box.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      lbClose.focus();
    };
    var close = function () {
      box.classList.remove("on");
      box.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };

    zoomables.forEach(function (img) {
      img.classList.add("zoomable");
      img.setAttribute("tabindex", "0");
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", "Enlarge image: " + (img.alt || "artifact"));
      img.addEventListener("click", function () { open(img); });
      img.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(img); }
      });
    });
    lbClose.addEventListener("click", close);
    box.addEventListener("click", function (e) { if (e.target === box || e.target.closest(".lb-figure") === null) close(); });
    box.querySelector(".lb-figure").addEventListener("click", function (e) { if (e.target.tagName !== "IMG") close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && box.classList.contains("on")) close(); });
  }

  /* ---- back-to-top button (case studies / long pages) ---- */
  var toTop = document.querySelector(".to-top");
  if (toTop) {
    var showTop = function () {
      toTop.classList.toggle("show", window.scrollY > window.innerHeight);
    };
    document.addEventListener("scroll", showTop, { passive: true });
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
    showTop();
  }

  /* ---- gallery marquee: click a name to jump to its piece ---- */
  var marq = document.querySelector(".gmarq");
  if (marq) {
    marq.addEventListener("click", function (e) {
      var hit = e.target.closest("[data-jump]");
      if (!hit) return;
      var target = document.getElementById(hit.getAttribute("data-jump"));
      if (!target) return;
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      target.classList.add("flash");
      setTimeout(function () { target.classList.remove("flash"); }, 1300);
    });
  }
})();
