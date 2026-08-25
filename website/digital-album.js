(function () {
  'use strict';

  // ---- Resolve album code from /digital-album/:code ----
  var pathParts = location.pathname.split('/').filter(Boolean);
  var code = pathParts[pathParts.length - 1] || '';

  var els = {
    loading: document.getElementById('loadingScreen'),
    error: document.getElementById('errorScreen'),
    errorMessage: document.getElementById('errorMessage'),
    coverTitle: document.getElementById('coverTitle'),
    openBookBtn: document.getElementById('openBookBtn'),
    viewerRoot: document.getElementById('viewerRoot'),
    bookStage: document.getElementById('bookStage'),
    bookContainer: document.getElementById('bookContainer'),
    controls: document.getElementById('controls'),
    btnToggleControls: document.getElementById('btnToggleControls'),
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
    loadingCoverWrap: document.getElementById('loadingCoverWrap'),
    loadingCoverImg: document.getElementById('loadingCoverImg'),
    loadingTitle: document.getElementById('loadingTitle'),
    loadingTagline: document.getElementById('loadingTagline'),
    loadingProgressFill: document.getElementById('loadingProgressFill'),
    loadingPercent: document.getElementById('loadingPercent'),
  };

  var DEFAULT_TAGLINES = [
    'Every picture, a memory kept.',
    'Turning moments into pages.',
    'Crafted with care, page by page.',
    'A story worth flipping through.',
  ];

  var state = {
    album: null,
    digitalPages: [],     // flattened: one entry per rendered book page
    pageFlip: null,
    soundOn: true,
    audioMode: 'page-flip-sound-only',
    zoom: 1,
    panX: 0,
    panY: 0,
    userInteracted: false,
    baseW: 700,
    baseH: 990,
  };

  function setLoadingProgress(pct) {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    if (els.loadingProgressFill) els.loadingProgressFill.style.width = pct + '%';
    if (els.loadingPercent) els.loadingPercent.textContent = pct + '%';
  }

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
  setLoadingProgress(8);
  fetch('/api/public/digital-albums/' + encodeURIComponent(code))
    .then(function (res) {
      setLoadingProgress(25);
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.error || 'Album not found'); });
      return res.json();
    })
    .then(function (data) {
      state.album = data;
      state.soundOn = data.soundEnabled !== false;
      state.audioMode = data.audioMode || 'page-flip-sound-only';
      setLoadingProgress(35);

      if (els.loadingTitle) els.loadingTitle.textContent = data.title || '';
      if (els.loadingTagline) {
        els.loadingTagline.textContent = data.loadingTagline || DEFAULT_TAGLINES[Math.floor(Math.random() * DEFAULT_TAGLINES.length)];
      }

      buildDigitalPages(data);

      if (state.digitalPages.length === 0) {
        hide(els.loading);
        els.errorMessage.textContent = 'This album has no pages yet.';
        show(els.error);
        return;
      }

      loadCoverPreview().then(function () {
        setLoadingProgress(70);
        onReady();
      });
    })
    .catch(function (err) {
      hide(els.loading);
      els.errorMessage.textContent = err.message || 'This digital album is currently unavailable.';
      show(els.error);
    });

  // Warms the cover image in before the book is built, so the loading
  // screen's blur-to-sharp reveal has something real to show progress
  // against instead of a generic spinner.
  function loadCoverPreview() {
    return new Promise(function (resolve) {
      var first = state.digitalPages[0];
      var coverUrl = (first && first.isCover) ? first.src : null;
      if (!coverUrl || !els.loadingCoverImg) return resolve();
      show(els.loadingCoverWrap);
      var img = new Image();
      var done = function () {
        els.loadingCoverImg.src = coverUrl;
        requestAnimationFrame(function () { els.loadingCoverImg.classList.add('da-loading-sharp'); });
        setLoadingProgress(55);
        resolve();
      };
      img.onload = done;
      img.onerror = done;
      img.src = coverUrl;
    });
  }

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
    els.coverTitle.textContent = state.album.title || '';
    els.soundOnIcon.hidden = !state.soundOn;
    els.soundOffIcon.hidden = state.soundOn;
    show(els.viewerRoot);
    initPageFlip();
    setLoadingProgress(90);
    initBackgroundMusic();
    setLoadingProgress(100);

    setTimeout(function () {
      els.loading.classList.add('da-loading-out');
      setTimeout(function () { hide(els.loading); }, 650);
    }, 200);
  }

  // Works in both portrait and landscape - no forced rotation. PageFlip's
  // own usePortrait option switches between single-page (portrait) and
  // two-page-spread (landscape) layout automatically based on the
  // container's actual aspect ratio as it resizes/reorients.
  window.addEventListener('resize', function () {
    if (!state.album) return;
    resizeStage();
  });
  window.addEventListener('orientationchange', function () {
    setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 200);
  });

  // ---- Open book: a real physical flip from the cover, via PageFlip itself ----
  els.openBookBtn.addEventListener('click', function () {
    state.userInteracted = true;
    hide(els.openBookBtn);
    hide(els.coverTitle); // was colliding with the bottom controls once the book opened
    if (state.pageFlip && state.hasCover) state.pageFlip.flipNext();
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
    var spineEls = [];
    var coverSrc = null;
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
      // "resting closed" look at the end of the book as at the start. Both
      // are tinted from the same front-cover photo so they read as one book.
      if (entry.isCover || entry.isBackCover) {
        var spine = document.createElement('div');
        spine.className = 'da-spine' + (entry.isBackCover ? ' da-spine-right' : '');
        var spineLabel = 'DIGITAL PHOTO BOOK';
        spine.innerHTML =
          '<span class="da-spine-ornament da-spine-ornament-top">&#10085;</span>' +
          '<span class="da-spine-text">' + spineLabel + '</span>' +
          '<span class="da-spine-ornament da-spine-ornament-bottom">&#10085;</span>';
        page.appendChild(spine);
        spineEls.push(spine);
        if (entry.isCover) coverSrc = entry.src;
      }

      page.dataset.index = i;
      els.bookContainer.appendChild(page);
    });
    if (coverSrc && spineEls.length) tintSpinesFromCover(coverSrc, spineEls);
  }

  // Samples the cover photo's average color and turns it into a leather-
  // spine-style gradient (dark edges, lit highlight down the middle - same
  // shape as the original fixed maroon one), so the spine always matches
  // whatever photo was actually used as the cover instead of one hardcoded
  // color for every album.
  function tintSpinesFromCover(src, spineEls) {
    var img = new Image();
    img.onload = function () {
      var size = 24;
      var canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      var data;
      try {
        data = ctx.getImageData(0, 0, size, size).data;
      } catch (e) {
        return; // canvas got tainted somehow - keep the default spine color
      }
      var r = 0, g = 0, b = 0, n = 0;
      for (var i = 0; i < data.length; i += 4) {
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
      r /= n; g /= n; b /= n;

      var hsl = rgbToHsl(r, g, b);
      var h = hsl[0], s = Math.min(75, Math.max(35, hsl[1]));
      var edge = 'hsl(' + h + ',' + s + '%,' + Math.max(6, hsl[2] * 0.18) + '%)';
      var mid = 'hsl(' + h + ',' + s + '%,' + Math.min(30, Math.max(14, hsl[2] * 0.45)) + '%)';
      var light = 'hsl(' + h + ',' + s + '%,' + Math.min(45, Math.max(24, hsl[2] * 0.7)) + '%)';
      var gradient =
        'linear-gradient(to right,' +
        edge + ' 0%,' + mid + ' 22%,' + light + ' 42%,' + light + ' 50%,' +
        light + ' 58%,' + mid + ' 78%,' + edge + ' 100%)';

      spineEls.forEach(function (el) {
        el.style.background = gradient;
      });
    };
    img.src = src;
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h *= 60;
    }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
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
      usePortrait: true,
      mobileScrollSupport: false,
      swipeDistance: 20,
      drawShadow: true,
      flippingTime: 700,
      // PageFlip's own built-in touch/mouse handling flips on a plain tap
      // (any click/tap that isn't a real drag still calls its internal
      // flip()). That collides with tap-to-zoom on mobile. We disable it
      // and drive flips ourselves in setupFlipGestures() below, which only
      // starts a flip once the pointer has actually moved like a drag.
      useMouseEvents: false,
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

    setupFlipGestures();
    resizeStage();
  }

  // ---- Drag-to-flip (tap alone does nothing — only a real hold-and-move
  // gesture turns a page, so it never fights with tap/pinch-to-zoom). Once
  // a small movement confirms this is a real drag (not a tap), we hand off
  // to PageFlip's own low-level fold API so the page visually bends and
  // follows the finger the whole time it's held, exactly like turning a
  // real page — only actually completing the turn if released past the
  // halfway point, otherwise springing back. ----
  function setupFlipGestures() {
    // initPageFlip() can re-run (e.g. rotating the phone back from the
    // "turn sideways" prompt) and always makes a fresh PageFlip instance,
    // but the DOM element and its listeners persist — only attach once.
    if (state.flipGesturesReady) return;
    state.flipGesturesReady = true;

    var CONFIRM_THRESHOLD = 16; // px of movement before we treat this as a drag, not a tap
    var activePointers = 0;
    var startX = null, startY = null, pointerId = null, dragging = false;

    function bookPos(clientX, clientY) {
      var rect = els.bookContainer.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    els.bookContainer.addEventListener('pointerdown', function (e) {
      activePointers++;
      // A second finger landing means this is a pinch, not a page drag —
      // bail out so the pinch-zoom handler on bookStage owns it cleanly.
      if (activePointers > 1 || !state.pageFlip || state.zoom > 1) { startX = null; return; }
      startX = e.clientX; startY = e.clientY; pointerId = e.pointerId; dragging = false;
    });

    els.bookContainer.addEventListener('pointermove', function (e) {
      if (startX === null || activePointers > 1 || e.pointerId !== pointerId) return;
      var pos = bookPos(e.clientX, e.clientY);
      if (!dragging) {
        var dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.abs(dy) > Math.abs(dx)) { startX = null; return; } // vertical drag - let it scroll/pass through
        if (Math.sqrt(dx * dx + dy * dy) < CONFIRM_THRESHOLD) return;
        dragging = true;
        state.pageFlip.startUserTouch(bookPos(startX, startY));
      }
      state.pageFlip.userMove(pos, true);
    });

    function endGesture(e) {
      activePointers = Math.max(0, activePointers - 1);
      if (e.pointerId !== pointerId) return;
      if (dragging && state.pageFlip) state.pageFlip.userStop(bookPos(e.clientX, e.clientY));
      startX = null;
      pointerId = null;
      dragging = false;
    }
    els.bookContainer.addEventListener('pointerup', endGesture);
    els.bookContainer.addEventListener('pointercancel', endGesture);
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
  els.btnPrev.addEventListener('click', function () { state.pageFlip && state.pageFlip.flipPrev(); markInteracted(); });
  els.btnNext.addEventListener('click', function () { state.pageFlip && state.pageFlip.flipNext(); markInteracted(); });

  document.addEventListener('keydown', function (e) {
    if (els.viewerRoot.hidden) return;
    if (e.key === 'ArrowLeft') state.pageFlip && state.pageFlip.flipPrev();
    else if (e.key === 'ArrowRight' || e.key === ' ') { state.pageFlip && state.pageFlip.flipNext(); e.preventDefault(); }
    else if (e.key === 'Escape') { if (document.fullscreenElement) document.exitFullscreen(); else exitViewer(); }
    else if (e.key === '+' || e.key === '=') setZoom(state.zoom + 0.3);
    else if (e.key === '-') setZoom(state.zoom - 0.3);
    else if (e.key === '0') setZoom(1);
    markInteracted();
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
  els.btnZoomIn.addEventListener('click', function () { setZoom(state.zoom + 0.4); markInteracted(); });
  els.btnZoomOut.addEventListener('click', function () { setZoom(state.zoom - 0.4); markInteracted(); });

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
    if (state.audioMode === 'music-only' || state.audioMode === 'silent') return;
    var el = soundPool[soundPoolIdx];
    soundPoolIdx = (soundPoolIdx + 1) % soundPool.length;
    try {
      el.currentTime = 0;
      var p = el.play();
      if (p && p.catch) p.catch(function () { /* autoplay-restricted or file missing - fail silently */ });
    } catch (e) { /* ignore */ }
  }

  // ---- Background music: one dedicated looping instance, separate from the
  // one-shot page-turn pool above. Only created when the album actually has
  // a track and its audio_mode allows music. ----
  var bgMusic = null;
  function initBackgroundMusic() {
    var album = state.album;
    if (!album || !album.musicUrl) return;
    if (state.audioMode !== 'music-only' && state.audioMode !== 'both') return;
    bgMusic = new Audio(abs(album.musicUrl));
    bgMusic.loop = album.musicLoop !== false;
    bgMusic.volume = typeof album.musicVolume === 'number' ? album.musicVolume : 0.5;
    bgMusic.preload = 'auto';
    tryPlayBackgroundMusic();
  }
  function tryPlayBackgroundMusic() {
    if (!bgMusic || !state.soundOn || !state.userInteracted) return;
    if (state.audioMode !== 'music-only' && state.audioMode !== 'both') return;
    var p = bgMusic.play();
    if (p && p.catch) p.catch(function () { /* autoplay-restricted - retried on next interaction */ });
  }
  function stopBackgroundMusic() {
    if (bgMusic) bgMusic.pause();
  }

  els.btnSound.addEventListener('click', function () {
    state.soundOn = !state.soundOn;
    els.soundOnIcon.hidden = !state.soundOn;
    els.soundOffIcon.hidden = state.soundOn;
    if (state.soundOn) tryPlayBackgroundMusic();
    else stopBackgroundMusic();
    markInteracted();
  });

  // ---- Fullscreen ----
  els.btnFullscreen.addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
    markInteracted();
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
    markInteracted();
  });

  // ---- Controls visibility: fully manual, no auto-show/auto-hide timer.
  // Hidden by default; only the menu button toggles it, and it stays put
  // either way until tapped again. ----
  function showControls() {
    els.controls.classList.remove('da-hidden');
    els.btnToggleControls.classList.add('da-open');
  }
  function hideControls() {
    els.controls.classList.add('da-hidden');
    els.btnToggleControls.classList.remove('da-open');
  }
  function markInteracted() {
    var wasInteracted = state.userInteracted;
    state.userInteracted = true;
    if (!wasInteracted) tryPlayBackgroundMusic();
  }

  els.btnToggleControls.addEventListener('click', function () {
    markInteracted();
    if (els.controls.classList.contains('da-hidden')) showControls();
    else hideControls();
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
    markInteracted();
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
      show(els.coverTitle);
    }
    hideControls();
  }
})();
