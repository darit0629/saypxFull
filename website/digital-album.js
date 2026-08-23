(function () {
  'use strict';

  // ---- Resolve album code from /digital-album/:code ----
  var pathParts = location.pathname.split('/').filter(Boolean);
  var code = pathParts[pathParts.length - 1] || '';

  var els = {
    loading: document.getElementById('loadingScreen'),
    error: document.getElementById('errorScreen'),
    errorMessage: document.getElementById('errorMessage'),
    rotatePrompt: document.getElementById('rotatePrompt'),
    coverTitle: document.getElementById('coverTitle'),
    openBookBtn: document.getElementById('openBookBtn'),
    viewerRoot: document.getElementById('viewerRoot'),
    bookStage: document.getElementById('bookStage'),
    bookContainer: document.getElementById('bookContainer'),
    controls: document.getElementById('controls'),
    btnPrev: document.getElementById('btnPrev'),
    btnNext: document.getElementById('btnNext'),
    pageCounter: document.getElementById('pageCounter'),
    btnZoomIn: document.getElementById('btnZoomIn'),
    btnZoomOut: document.getElementById('btnZoomOut'),
    btnSound: document.getElementById('btnSound'),
    soundOnIcon: document.getElementById('soundOnIcon'),
    soundOffIcon: document.getElementById('soundOffIcon'),
    btnFullscreen: document.getElementById('btnFullscreen'),
    btnTheme: document.getElementById('btnTheme'),
    themeDarkIcon: document.getElementById('themeDarkIcon'),
    themeLightIcon: document.getElementById('themeLightIcon'),
    btnShare: document.getElementById('btnShare'),
    btnExit: document.getElementById('btnExit'),
    shareSheet: document.getElementById('shareSheet'),
  };

  var state = {
    album: null,
    digitalPages: [],     // flattened: one entry per rendered book page
    pageFlip: null,
    soundOn: true,
    zoom: 1,
    panX: 0,
    panY: 0,
    userInteracted: false,
    controlsHideTimer: null,
    baseW: 700,
    baseH: 990,
  };

  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }

  // API returns paths relative to the site root (e.g. "albums/8/display/x.jpg");
  // this page is served at /digital-album/:code, so they must be forced
  // absolute or the browser resolves them against the wrong "directory".
  function abs(relPath) {
    if (!relPath) return relPath;
    return relPath.charAt(0) === '/' ? relPath : '/' + relPath;
  }

  // ---- Fetch album ----
  fetch('/api/public/digital-albums/' + encodeURIComponent(code))
    .then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.error || 'Album not found'); });
      return res.json();
    })
    .then(function (data) {
      state.album = data;
      buildDigitalPages(data);
      setTimeout(function () { onReady(); }, 500); // small min display time for the loading screen
    })
    .catch(function (err) {
      hide(els.loading);
      els.errorMessage.textContent = err.message || 'This digital album is currently unavailable.';
      show(els.error);
    });

  // Flattens the API's pages[] (one entry per uploaded file) into one entry
  // per RENDERED digital page - a FULL_SPREAD upload becomes two entries
  // (left/right) that share the same source image + a crop half. The cover
  // and back cover (when set) become real hard-density pages at the very
  // start/end so PageFlip can physically flip the cover open itself.
  function buildDigitalPages(album) {
    var out = [];
    if (album.coverImage) {
      out.push({ src: abs(album.coverImage.displayUrl), width: album.coverImage.width, height: album.coverImage.height, half: null, hard: true, isCover: true });
    }
    album.pages.forEach(function (p) {
      if (album.pageMode === 'FULL_SPREAD') {
        out.push({ src: abs(p.displayUrl), thumb: abs(p.thumbnailUrl), width: p.width, height: p.height, centerXPct: p.centerXPct, half: 'left' });
        out.push({ src: abs(p.displayUrl), thumb: abs(p.thumbnailUrl), width: p.width, height: p.height, centerXPct: p.centerXPct, half: 'right' });
      } else {
        out.push({ src: abs(p.displayUrl), thumb: abs(p.thumbnailUrl), width: p.width, height: p.height, half: null });
      }
    });
    if (album.backCoverImage) {
      out.push({ src: abs(album.backCoverImage.displayUrl), width: album.backCoverImage.width, height: album.backCoverImage.height, half: null, hard: true, isBackCover: true });
    }
    state.digitalPages = out;
  }

  function onReady() {
    hide(els.loading);

    if (state.digitalPages.length === 0) {
      els.errorMessage.textContent = 'This album has no pages yet.';
      show(els.error);
      return;
    }

    els.coverTitle.textContent = state.album.title || '';

    if (needsRotatePrompt()) { show(els.rotatePrompt); return; }
    show(els.viewerRoot);
    initPageFlip();
  }

  function needsRotatePrompt() {
    return window.innerWidth < window.innerHeight && window.innerWidth < 900;
  }
  window.addEventListener('resize', function () {
    if (!state.album) return;
    if (needsRotatePrompt()) { show(els.rotatePrompt); hide(els.viewerRoot); }
    else {
      hide(els.rotatePrompt);
      if (els.viewerRoot.hidden) { show(els.viewerRoot); initPageFlip(); }
      else resizeStage();
    }
  });
  window.addEventListener('orientationchange', function () {
    setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 200);
  });

  // ---- Open book: a real physical flip from the cover, via PageFlip itself ----
  els.openBookBtn.addEventListener('click', function () {
    state.userInteracted = true;
    hide(els.openBookBtn);
    if (state.pageFlip && state.hasCover) state.pageFlip.flipNext();
    scheduleHideControls();
  });

  // ---- Build page DOM + init PageFlip ----
  function computeBaseSize() {
    var first = state.digitalPages[state.hasCover ? 1 : 0] || state.digitalPages[0];
    var singleW = first.half ? first.width / 2 : first.width;
    var singleH = first.height;
    var ratio = singleW / singleH;
    var h = 990;
    var w = Math.round(h * ratio);
    state.baseW = w;
    state.baseH = h;
  }

  function pageStyleFor(entry) {
    // Percentage-based sizing on purpose: PageFlip resizes .page elements
    // dynamically (size:'stretch'), so this must scale correctly no matter
    // what pixel size it actually ends up rendered at - hardcoding a base
    // pixel size here caused severe cropping once PageFlip shrank the page.
    var bg = 'background-image:url(' + JSON.stringify(entry.src) + ');background-repeat:no-repeat;';
    if (!entry.half) {
      return bg + 'background-size:cover;background-position:center;';
    }
    // Both halves share one uniformly-scaled 200%-wide render of the same
    // spread image so the crop point can slide a few points either way
    // (manual center-fold correction) without ever distorting or
    // rescaling either half independently.
    var x = entry.half === 'left' ? 2 * entry.centerXPct - 100 : 2 * entry.centerXPct;
    return bg + 'background-size:200% 100%;background-position:' + x + '% center;';
  }

  function buildPageElements() {
    els.bookContainer.innerHTML = '';
    state.digitalPages.forEach(function (entry, i) {
      var page = document.createElement('div');
      page.className = 'page';
      page.setAttribute('data-density', entry.hard ? 'hard' : 'soft');

      var img = document.createElement('div');
      img.className = 'da-page-image';
      img.style.cssText = 'width:100%;height:100%;' + pageStyleFor(entry);
      page.appendChild(img);

      if (entry.half === 'left') {
        var shadowL = document.createElement('div');
        shadowL.className = 'da-page-shadow-edge left';
        page.appendChild(shadowL);
      } else if (entry.half === 'right') {
        var shadowR = document.createElement('div');
        shadowR.className = 'da-page-shadow-edge right';
        page.appendChild(shadowR);
      }

      // The front cover gets a real book spine along its left edge - lives
      // inside the cover page's own DOM so it tracks PageFlip's sizing/
      // positioning for free instead of needing separate layout math. Back
      // cover gets the mirror image on its right edge, for the same
      // "resting closed" look at the end of the book as at the start.
      if (entry.isCover || entry.isBackCover) {
        var spine = document.createElement('div');
        spine.className = 'da-spine' + (entry.isBackCover ? ' da-spine-right' : '');
        var spineLabel = ((state.album.eventType || 'Photo') + ' Album').toUpperCase();
        spine.innerHTML =
          '<span class="da-spine-ornament da-spine-ornament-top">&#10085;</span>' +
          '<span class="da-spine-text">' + spineLabel.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</span>' +
          '<span class="da-spine-ornament da-spine-ornament-bottom">&#10085;</span>';
        page.appendChild(spine);
      }

      page.dataset.index = i;
      els.bookContainer.appendChild(page);
    });
  }

  function initPageFlip() {
    state.hasCover = !!(state.digitalPages[0] && state.digitalPages[0].isCover);
    computeBaseSize();
    buildPageElements();

    state.pageFlip = new St.PageFlip(els.bookContainer, {
      width: state.baseW,
      height: state.baseH,
      size: 'stretch',
      minWidth: 240,
      maxWidth: 1400,
      minHeight: 340,
      maxHeight: 1980,
      maxShadowOpacity: 0.45,
      showCover: state.hasCover,
      usePortrait: false,
      mobileScrollSupport: false,
      swipeDistance: 20,
      drawShadow: true,
      flippingTime: 700,
    });

    state.pageFlip.loadFromHTML(document.querySelectorAll('.page'));
    updatePageCounter();
    preloadNeighbors(0);

    if (state.hasCover) show(els.openBookBtn);
    else hide(els.openBookBtn);

    state.pageFlip.on('flip', function (e) {
      playPageTurnSound();
      updatePageCounter();
      preloadNeighbors(e.data);
      if (e.data > 0) hide(els.openBookBtn);
    });

    resizeStage();
  }

  function resizeStage() {
    if (!state.pageFlip) return;
    try { state.pageFlip.update(); } catch (e) { /* ignore */ }
  }

  // ---- Progressive image quality: everything starts on the thumbnail
  // (fast even for hundreds of pages); the current spread ±1 gets upgraded
  // to the full-quality display image. ----
  var upgraded = {};
  function preloadNeighbors(centerIndex) {
    [-1, 0, 1, 2].forEach(function (d) {
      var idx = centerIndex + d;
      if (idx < 0 || idx >= state.digitalPages.length || upgraded[idx]) return;
      upgraded[idx] = true;
      var entry = state.digitalPages[idx];
      var el = els.bookContainer.querySelector('.page[data-index="' + idx + '"] .da-page-image');
      if (el) {
        var img = new Image();
        img.onload = function () { /* already correct URL, this just warms cache */ };
        img.src = entry.src;
      }
    });
  }

  function updatePageCounter() {
    if (!state.pageFlip) return;
    var current = state.pageFlip.getCurrentPageIndex() + 1;
    var total = state.digitalPages.length;
    els.pageCounter.textContent = current + ' / ' + total;
  }

  // ---- Navigation ----
  els.btnPrev.addEventListener('click', function () { state.pageFlip && state.pageFlip.flipPrev(); wake(); });
  els.btnNext.addEventListener('click', function () { state.pageFlip && state.pageFlip.flipNext(); wake(); });

  document.addEventListener('keydown', function (e) {
    if (els.viewerRoot.hidden) return;
    if (e.key === 'ArrowLeft') state.pageFlip && state.pageFlip.flipPrev();
    else if (e.key === 'ArrowRight' || e.key === ' ') { state.pageFlip && state.pageFlip.flipNext(); e.preventDefault(); }
    else if (e.key === 'Escape') { if (document.fullscreenElement) document.exitFullscreen(); else exitViewer(); }
    else if (e.key === '+' || e.key === '=') setZoom(state.zoom + 0.3);
    else if (e.key === '-') setZoom(state.zoom - 0.3);
    else if (e.key === '0') setZoom(1);
    wake();
  });

  // ---- Zoom / pan ----
  function setZoom(z) {
    state.zoom = Math.min(3, Math.max(1, z));
    if (state.zoom === 1) { state.panX = 0; state.panY = 0; }
    applyZoomTransform();
  }
  function applyZoomTransform() {
    els.bookContainer.style.transform = 'translate(' + state.panX + 'px,' + state.panY + 'px) scale(' + state.zoom + ')';
    els.bookStage.classList.toggle('da-zoomed', state.zoom > 1);
  }
  els.btnZoomIn.addEventListener('click', function () { setZoom(state.zoom + 0.4); wake(); });
  els.btnZoomOut.addEventListener('click', function () { setZoom(state.zoom - 0.4); wake(); });

  (function setupPan() {
    var dragging = false, lastX = 0, lastY = 0;
    els.bookStage.addEventListener('pointerdown', function (e) {
      if (state.zoom <= 1) return;
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      els.bookStage.setPointerCapture(e.pointerId);
    });
    els.bookStage.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      state.panX += e.clientX - lastX;
      state.panY += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      applyZoomTransform();
    });
    els.bookStage.addEventListener('pointerup', function () { dragging = false; });
    els.bookStage.addEventListener('pointercancel', function () { dragging = false; });

    // Double-tap / double-click to toggle zoom
    var lastTap = 0;
    els.bookStage.addEventListener('pointerup', function () {
      var now = Date.now();
      if (now - lastTap < 300) setZoom(state.zoom > 1 ? 1 : 2);
      lastTap = now;
    });

    // Pinch zoom
    var pinchStartDist = null, pinchStartZoom = 1;
    els.bookStage.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pinchStartDist = touchDist(e.touches);
        pinchStartZoom = state.zoom;
      }
    }, { passive: true });
    els.bookStage.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && pinchStartDist) {
        var d = touchDist(e.touches);
        setZoom(pinchStartZoom * (d / pinchStartDist));
      }
    }, { passive: true });
    els.bookStage.addEventListener('touchend', function () { pinchStartDist = null; });
    function touchDist(t) {
      var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
  })();

  // ---- Sound ----
  // A pool of a few pre-created Audio elements (not one shared instance) so
  // rapid consecutive flips can overlap instead of cutting each other off.
  var soundPool = [];
  var soundPoolIdx = 0;
  for (var sp = 0; sp < 4; sp++) {
    var a = new Audio('/vendor/page-turn.mp3');
    a.preload = 'auto';
    a.volume = 0.55;
    soundPool.push(a);
  }
  function playPageTurnSound() {
    if (!state.soundOn || !state.userInteracted) return;
    var el = soundPool[soundPoolIdx];
    soundPoolIdx = (soundPoolIdx + 1) % soundPool.length;
    try {
      el.currentTime = 0;
      var p = el.play();
      if (p && p.catch) p.catch(function () { /* autoplay-restricted or file missing - fail silently */ });
    } catch (e) { /* ignore */ }
  }
  els.btnSound.addEventListener('click', function () {
    state.soundOn = !state.soundOn;
    els.soundOnIcon.hidden = !state.soundOn;
    els.soundOffIcon.hidden = state.soundOn;
    wake();
  });

  // ---- Fullscreen ----
  els.btnFullscreen.addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
    wake();
  });

  // ---- Light / dark theme ----
  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      els.themeDarkIcon.hidden = true;
      els.themeLightIcon.hidden = false;
    } else {
      document.documentElement.removeAttribute('data-theme');
      els.themeDarkIcon.hidden = false;
      els.themeLightIcon.hidden = true;
    }
    try { localStorage.setItem('da-theme', theme); } catch (e) { /* ignore */ }
  }
  (function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('da-theme'); } catch (e) { /* ignore */ }
    applyTheme(saved === 'light' ? 'light' : 'dark');
  })();
  els.btnTheme.addEventListener('click', function () {
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    applyTheme(isLight ? 'dark' : 'light');
    wake();
  });

  // ---- Auto-hide controls ----
  function scheduleHideControls() {
    clearTimeout(state.controlsHideTimer);
    els.controls.classList.remove('da-hidden');
    state.controlsHideTimer = setTimeout(function () {
      els.controls.classList.add('da-hidden');
    }, 3200);
  }
  function wake() { state.userInteracted = true; scheduleHideControls(); }
  ['pointerdown', 'pointermove', 'keydown'].forEach(function (ev) {
    // Capture phase: PageFlip's own drag handlers stop propagation on the
    // book element during bubbling, so a bubble-phase listener here would
    // never fire while the user is interacting with the pages themselves.
    els.viewerRoot.addEventListener(ev, wake, { passive: true, capture: true });
  });

  // ---- Share ----
  els.btnShare.addEventListener('click', function () {
    var url = location.href;
    var title = (state.album && state.album.title) || 'Digital Photo Book';
    if (navigator.share) {
      navigator.share({ title: title, text: 'View this digital photo book', url: url }).catch(function () {});
    } else {
      show(els.shareSheet);
    }
    wake();
  });
  els.shareSheet.addEventListener('click', function (e) {
    var action = e.target.getAttribute('data-action');
    if (!action) return;
    var url = location.href;
    var code = state.album ? state.album.publicCode : '';
    if (action === 'copy-link') navigator.clipboard && navigator.clipboard.writeText(url);
    else if (action === 'copy-code') navigator.clipboard && navigator.clipboard.writeText(code);
    else if (action === 'whatsapp') window.open('https://wa.me/?text=' + encodeURIComponent('View this digital photo book: ' + url), '_blank');
    else if (action === 'email') window.location.href = 'mailto:?subject=' + encodeURIComponent('Digital Photo Book') + '&body=' + encodeURIComponent(url);
    hide(els.shareSheet);
  });

  // ---- Exit: close the book back to its cover, same as the physical object ----
  els.btnExit.addEventListener('click', exitViewer);
  function exitViewer() {
    if (document.fullscreenElement) document.exitFullscreen();
    setZoom(1);
    if (state.pageFlip && state.hasCover) {
      state.pageFlip.turnToPage(0);
      show(els.openBookBtn);
    }
    scheduleHideControls();
  }
})();
