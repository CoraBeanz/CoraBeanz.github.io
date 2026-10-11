/* Shared behaviour for every page: theme toggle, figure zoom (images and
   videos), looping videos that pause off-screen, lazily mounted interactive
   viewers, and copy buttons. No dependencies. */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (e) { return null; }
    return null;
  }

  /* ---------- theme ---------- */
  var saved = store("rv-theme");
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

  function currentTheme() {
    var t = root.getAttribute("data-theme");
    if (t === "light" || t === "dark") return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-theme-toggle]");
    if (!btn) return;
    var next = currentTheme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store("rv-theme", next);
    btn.setAttribute("aria-label", next === "dark" ? "Switch to light theme" : "Switch to dark theme");
  });

  /* ---------- lightbox: <img data-zoom> or <video data-zoom> ----------
     The caption is the figure's figcaption, then its data-note if it has one.
     data-zoom-src swaps in a larger file; data-zoom-mobile a phone layout. */
  var box = null, boxStage = null, boxCap = null, lastFocus = null;
  var phone = window.matchMedia ? window.matchMedia("(max-width: 640px)") : null;
  function ensureBox() {
    if (box) return;
    box = document.createElement("div");
    box.className = "lightbox";
    box.hidden = true;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Enlarged figure");
    box.innerHTML =
      '<button class="lightbox__close" type="button" aria-label="Close">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="lightbox__stage"></div><p class="lightbox__cap"></p>';
    document.body.appendChild(box);
    boxStage = box.querySelector(".lightbox__stage");
    boxCap = box.querySelector(".lightbox__cap");
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target === boxStage || e.target.closest(".lightbox__media") || e.target.closest(".lightbox__close")) closeBox();
    });
  }
  function captionFor(el) {
    var fig = el.closest("figure");
    if (!fig) return "";
    var cap = fig.querySelector("figcaption");
    var text = "";
    if (cap) {
      var c = cap.cloneNode(true);
      c.querySelectorAll(".tag").forEach(function (t) { t.textContent = t.textContent.trim() + " · "; });
      c.querySelectorAll(".visually-hidden").forEach(function (t) { t.remove(); });
      text = c.textContent.replace(/\s+/g, " ").trim();
    }
    var note = fig.getAttribute("data-note");
    if (note) text = text ? (/[.?!:]$/.test(text) ? text + " " : text + ". ") + note : note;
    return text;
  }
  function openBox(el) {
    ensureBox();
    lastFocus = document.activeElement;
    var src = (phone && phone.matches && el.getAttribute("data-zoom-mobile")) || el.getAttribute("data-zoom-src") || el.currentSrc || el.src;
    var media;
    if (el.tagName === "VIDEO") {
      media = document.createElement("video");
      media.muted = true; media.loop = true; media.playsInline = true; media.autoplay = !reduceMotion;
      media.setAttribute("muted", ""); media.setAttribute("playsinline", "");
      if (el.poster) media.poster = el.poster;
      if (!src) { var s0 = el.querySelector("source"); src = s0 && s0.src; }
      media.src = src;
      media.setAttribute("aria-label", el.getAttribute("aria-label") || "");
      if (reduceMotion) media.controls = true;
    } else {
      media = document.createElement("img");
      media.src = src;
      media.alt = el.alt || "";
    }
    media.className = "lightbox__media" + (/\.svg($|[?#])/.test(src || "") ? " lightbox__media--fill" : "");
    boxStage.innerHTML = "";
    boxStage.appendChild(media);
    if (media.play && !reduceMotion) { var p = media.play(); if (p && p.catch) p.catch(function () {}); }
    boxCap.textContent = captionFor(el);
    boxCap.hidden = !boxCap.textContent;
    box.hidden = false;
    document.body.style.overflow = "hidden";
    box.querySelector(".lightbox__close").focus();
  }
  function closeBox() {
    if (!box || box.hidden) return;
    box.hidden = true;
    boxStage.innerHTML = "";
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("img[data-zoom], video[data-zoom]");
    if (el) { e.preventDefault(); openBox(el); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeBox();
    // the close button is the only control in the open dialog, so keep focus there
    if (e.key === "Tab" && box && !box.hidden) { e.preventDefault(); box.querySelector(".lightbox__close").focus(); }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("img[data-zoom], video[data-zoom]")) { e.preventDefault(); openBox(e.target); }
  });
  document.querySelectorAll("img[data-zoom], video[data-zoom]").forEach(function (el) {
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
  });

  /* ---------- looping videos ---------- */
  var PLAY = '<svg viewBox="0 0 12 12" fill="currentColor"><path d="M3 1.5v9l7.5-4.5z"/></svg>';
  var PAUSE = '<svg viewBox="0 0 12 12" fill="currentColor"><path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z"/></svg>';
  var loops = Array.prototype.slice.call(document.querySelectorAll("video[data-loop]"));
  loops.forEach(function (v) {
    v.muted = true; v.loop = true; v.playsInline = true;
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    var holder = v.parentElement;
    holder.classList.add("loop");
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "loop__btn";
    var spot = v.getAttribute("data-loop-btn");
    if (spot) btn.classList.add("loop__btn--" + spot);
    holder.appendChild(btn);
    v._userPaused = reduceMotion;
    function sync() {
      var playing = !v.paused;
      holder.classList.toggle("is-paused", !playing && v._userPaused);
      btn.innerHTML = playing ? PAUSE : PLAY;
      btn.setAttribute("aria-label", playing ? "Pause video" : "Play video");
    }
    btn.addEventListener("click", function () {
      if (v.paused) { v._userPaused = false; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      else { v._userPaused = true; v.pause(); }
    });
    v.addEventListener("play", sync);
    v.addEventListener("pause", sync);
    sync();
  });
  if ("IntersectionObserver" in window && loops.length) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting && !v._userPaused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else if (!en.isIntersecting && !v.paused) v.pause();
      });
    }, { threshold: 0.25 });
    loops.forEach(function (v) { vio.observe(v); });
  } else if (!reduceMotion) {
    loops.forEach(function (v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); });
  }

  /* ---------- interactive viewers: <div class="viewer" data-module="assets/js/x.js"> ---------- */
  var viewers = Array.prototype.slice.call(document.querySelectorAll("[data-module]"));
  function mountViewer(el) {
    if (el._mounted) return;
    el._mounted = true;
    var url = new URL(el.getAttribute("data-module"), document.baseURI).href;
    var opts = {};
    try { opts = JSON.parse(el.getAttribute("data-options") || "{}"); } catch (e) { opts = {}; }
    opts.reducedMotion = reduceMotion;
    import(url).then(function (mod) {
      var fn = mod && (mod.default || mod.mount);
      if (typeof fn !== "function") return;
      return Promise.resolve(fn(el, opts)).then(function () { el.classList.add("is-live"); });
    }).catch(function (err) {
      el.classList.add("is-failed");
      if (window.console) console.warn("Viewer failed to load; showing the still image instead.", err);
    });
  }
  if ("IntersectionObserver" in window) {
    var mio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { mio.unobserve(en.target); mountViewer(en.target); } });
    }, { rootMargin: "200px 0px" });
    viewers.forEach(function (el) { mio.observe(el); });
  } else {
    viewers.forEach(mountViewer);
  }

  /* ---------- copy buttons: <button data-copy="text"> ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-copy]");
    if (!btn) return;
    var text = btn.getAttribute("data-copy");
    var label = btn.querySelector("[data-copy-label]") || btn;
    var original = label.textContent;
    function done(msg) { label.textContent = msg; setTimeout(function () { label.textContent = original; }, 1600); }
    function fallback() {
      var target = btn.parentElement && btn.parentElement.querySelector(".copy__text");
      if (target && window.getSelection) {
        var r = document.createRange(); r.selectNodeContents(target);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        done("Selected");
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done("Copied"); }, fallback);
    } else fallback();
  });

  /* ---------- footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* ---------- skip link ---------- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a.skip-link");
    var m = a && document.getElementById("main");
    if (!m) return;
    e.preventDefault();
    m.setAttribute("tabindex", "-1");
    m.focus();
  });
})();
