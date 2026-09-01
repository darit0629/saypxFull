// Preloader - wait for the page to actually finish loading before revealing it
(function () {
  const preloader = document.getElementById('preloader');
  const barFill = document.getElementById('preloaderBarFill');
  if (!preloader) return;

  const MIN_DISPLAY_MS = 900;
  const SAFETY_TIMEOUT_MS = 6000;
  const startTime = Date.now();
  let finished = false;

  function hidePreloader() {
    if (finished) return;
    finished = true;

    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

    setTimeout(() => {
      if (barFill) barFill.classList.add('preloader-complete');

      setTimeout(() => {
        preloader.classList.add('preloader-hidden');
        document.body.classList.remove('is-loading');
        setTimeout(() => {
          preloader.style.display = 'none';
        }, 650);
      }, 250);
    }, remaining);
  }

  // Wait for every eager-loaded resource (images, styles, scripts) plus the hero video
  const heroVideo = document.querySelector('.hero-video');
  const loadPromises = [
    new Promise((resolve) => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve, { once: true });
    }),
  ];

  if (heroVideo) {
    loadPromises.push(
      new Promise((resolve) => {
        if (heroVideo.readyState >= 2) resolve();
        else {
          heroVideo.addEventListener('loadeddata', resolve, { once: true });
          heroVideo.addEventListener('error', resolve, { once: true });
        }
      })
    );
  }

  Promise.all(loadPromises).then(hidePreloader);

  // Never let a stalled resource trap the user behind the preloader
  setTimeout(hidePreloader, SAFETY_TIMEOUT_MS);
})();

// Hero Video Autoplay
document.addEventListener('DOMContentLoaded', () => {
  const heroVideo = document.querySelector('.hero-video');
  if (heroVideo) {
    heroVideo.play().catch(error => {
      console.log('Video autoplay failed:', error);
    });
  }

  // Services Auto-Scroll (mobile only)
  const servicesGrid = document.querySelector('.services-grid');
  if (servicesGrid && window.innerWidth <= 768) {
    let scrollPosition = 0;
    let scrollDirection = 1;
    let isUserScrolling = false;
    let userScrollTimeout;

    // Pause auto-scroll when user touches
    servicesGrid.addEventListener('touchstart', () => {
      isUserScrolling = true;
      clearTimeout(userScrollTimeout);
    });

    servicesGrid.addEventListener('touchend', () => {
      userScrollTimeout = setTimeout(() => {
        isUserScrolling = false;
        scrollPosition = servicesGrid.scrollLeft;
      }, 3000);
    });

    // Auto-scroll function
    setInterval(() => {
      if (!isUserScrolling) {
        const maxScroll = servicesGrid.scrollWidth - servicesGrid.clientWidth;
        
        if (scrollPosition >= maxScroll) {
          scrollDirection = -1;
        } else if (scrollPosition <= 0) {
          scrollDirection = 1;
        }
        
        scrollPosition += scrollDirection * 2;
        servicesGrid.scrollTo({
          left: scrollPosition,
          behavior: 'smooth'
        });
      }
    }, 50);
  }

  // Testimonials Auto-Scroll (mobile only)
  const testimonialsGrid = document.querySelector('.testimonials-grid');
  if (testimonialsGrid && window.innerWidth <= 768) {
    let testimonialsScrollPos = 0;
    let testimonialsScrollDir = 1;
    let isUserScrollingTestimonials = false;
    let testimonialScrollTimeout;

    // Pause auto-scroll when user touches
    testimonialsGrid.addEventListener('touchstart', () => {
      isUserScrollingTestimonials = true;
      clearTimeout(testimonialScrollTimeout);
    });

    testimonialsGrid.addEventListener('touchend', () => {
      testimonialScrollTimeout = setTimeout(() => {
        isUserScrollingTestimonials = false;
        testimonialsScrollPos = testimonialsGrid.scrollLeft;
      }, 3000);
    });

    // Auto-scroll function for testimonials
    setInterval(() => {
      if (!isUserScrollingTestimonials) {
        const maxScroll = testimonialsGrid.scrollWidth - testimonialsGrid.clientWidth;
        
        if (testimonialsScrollPos >= maxScroll) {
          testimonialsScrollDir = -1;
        } else if (testimonialsScrollPos <= 0) {
          testimonialsScrollDir = 1;
        }
        
        testimonialsScrollPos += testimonialsScrollDir * 2;
        testimonialsGrid.scrollTo({
          left: testimonialsScrollPos,
          behavior: 'smooth'
        });
      }
    }, 50);
  }
});

// Navigation Scroll Effect
const navbar = document.getElementById('navbar');
const navLinks = document.querySelectorAll('.nav-link');
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// Mobile Navigation Toggle
navToggle.addEventListener('click', () => {
  navToggle.classList.toggle('active');
  navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    navToggle.classList.remove('active');
    navMenu.classList.remove('active');
  });
});

// Active Navigation Link on Scroll
const sections = document.querySelectorAll('section');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(section => {
    const sectionTop = section.offsetTop;
    const sectionHeight = section.clientHeight;
    if (window.scrollY >= sectionTop - 200) {
      current = section.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#${current}`) {
      link.classList.add('active');
    }
  });
});

// Counter Animation for Statistics
const statNumbers = document.querySelectorAll('.stat-number');

const animateCounter = (element) => {
  const target = parseInt(element.getAttribute('data-target'));
  const duration = 2000;
  const increment = target / (duration / 16);
  let current = 0;

  const updateCounter = () => {
    current += increment;
    if (current < target) {
      element.textContent = Math.floor(current);
      requestAnimationFrame(updateCounter);
    } else {
      element.textContent = target;
    }
  };

  updateCounter();
};

const observerOptions = {
  threshold: 0.5,
  rootMargin: '0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
      animateCounter(entry.target);
      entry.target.classList.add('counted');
    }
  });
}, observerOptions);

statNumbers.forEach(stat => observer.observe(stat));

// Contact Form Handling
const contactForm = document.getElementById('contactForm');
const formMessage = document.getElementById('formMessage');

contactForm.addEventListener('submit', (e) => {
  e.preventDefault();

  // Get form values
  const formData = {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    service: document.getElementById('service').value,
    message: document.getElementById('message').value
  };

  // Simulate form submission (since we can't actually send emails)
  formMessage.className = 'form-message success';
  formMessage.textContent = `Thank you, ${formData.name}! Your message has been received. We'll get back to you soon.`;

  // Reset form
  contactForm.reset();

  // Hide message after 5 seconds
  setTimeout(() => {
    formMessage.className = 'form-message';
    formMessage.textContent = '';
  }, 5000);
});

// Back to Top Button
const backToTopBtn = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
  if (window.scrollY > 500) {
    backToTopBtn.classList.add('visible');
  } else {
    backToTopBtn.classList.remove('visible');
  }
});

backToTopBtn.addEventListener('click', () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
});

// Smooth Scroll for all anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      const offsetTop = target.offsetTop - 80;
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
    }
  });
});

// Intersection Observer for scroll animations
const animateOnScroll = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
});

// Add animation to cards and sections
const animatedElements = document.querySelectorAll('.service-card, .why-card, .testimonial-card, .skills-category, .webdev-features li, .webdev-visual, .webdev-step');
animatedElements.forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(30px)';
  el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
  animateOnScroll.observe(el);
});

// About photo - grows up from behind the bar as the About section scrolls
// into view, stays fully revealed for as long as any part of the section is
// still on screen, and only retreats once the whole section has scrolled
// past (reversible either direction).
(function () {
  const section = document.getElementById('about');
  const frame = document.querySelector('.about-photo-frame');
  const signature = document.querySelector('.about-signature');
  if (!section || !frame || !signature) return;

  let ticking = false;

  function update() {
    ticking = false;
    const rect = section.getBoundingClientRect();
    const vh = window.innerHeight;

    // Ramp 0 -> 1 as the section's top enters the lower half of the viewport.
    const enterProgress = Math.max(0, Math.min(1, (vh - rect.top) / (vh * 0.5)));

    // Ramp back 1 -> 0 only once the section's bottom edge is nearing/above
    // the top of the viewport, i.e. the whole section is exiting.
    const exitProgress = Math.max(0, Math.min(1, rect.bottom / (vh * 0.3)));

    const progress = Math.min(enterProgress, exitProgress);

    frame.style.clipPath = `inset(${(1 - progress) * 100}% 0 0 0)`;

    const sigProgress = Math.max(0, Math.min(1, (progress - 0.55) / 0.45));
    signature.style.opacity = String(sigProgress);
    signature.style.transform = `translateY(${(1 - sigProgress) * 10}px)`;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();

// 3D mouse-tilt for glass cards (desktop only, respects reduced motion)
(function () {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;
  if (prefersReducedMotion || isTouch) return;

  const tiltSelectors = '.service-card, .why-card, .testimonial-card, .browser-mockup-front';
  const maxTilt = 10;

  document.querySelectorAll(tiltSelectors).forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      const rotateX = (-y * maxTilt).toFixed(2);
      const rotateY = (x * maxTilt).toFixed(2);
      card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(6px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
})();

// Hero orbs & diamond parallax follow the cursor
(function () {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = document.querySelector('.hero');
  const orbs = document.querySelectorAll('.hero-orb');
  const diamonds = document.querySelectorAll('.hero-diamond');
  if (!hero || prefersReducedMotion) return;

  hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    orbs.forEach((orb, i) => {
      const depth = (i + 1) * 14;
      orb.style.transform = `translate3d(${x * depth}px, ${y * depth}px, 0)`;
    });

    diamonds.forEach((diamond, i) => {
      const depth = (i + 1) * 6;
      diamond.style.transform = `translate(calc(-50% + ${x * depth}px), calc(-50% + ${y * depth}px)) rotate(45deg)`;
    });
  });

  hero.addEventListener('mouseleave', () => {
    orbs.forEach(orb => { orb.style.transform = ''; });
    diamonds.forEach(diamond => { diamond.style.transform = ''; });
  });
})();

// Add parallax effect to hero background
window.addEventListener('scroll', () => {
  const scrolled = window.scrollY;
  const heroBackground = document.querySelector('.hero-background');
  if (heroBackground) {
    heroBackground.style.transform = `translateY(${scrolled * 0.5}px)`;
  }
});

// Portfolio Marquee + Filter + Lightbox
(function () {
  if (typeof PORTFOLIO_ITEMS === 'undefined') return;

  const rows = [
    document.getElementById('portfolioTrack0')?.parentElement,
    document.getElementById('portfolioTrack1')?.parentElement,
    document.getElementById('portfolioTrack2')?.parentElement,
  ];
  const tracks = [
    document.getElementById('portfolioTrack0'),
    document.getElementById('portfolioTrack1'),
    document.getElementById('portfolioTrack2'),
  ];
  if (tracks.some(t => !t)) return;

  const rowSpeedsPxPerSec = [24, 20, 27]; // px/sec - slow premium drift, still hand/touch scrollable
  const rowDirections = ['normal', 'reverse', 'normal'];
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let currentFilteredItems = [];
  let lightboxIndex = -1;
  let globalPaused = false;
  let suppressNextClick = false;
  const rowControllers = [];

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function buildTileHTML(item, globalIndex) {
    const title = escapeHTML(item.title);
    const subtitle = escapeHTML(item.subtitle);
    if (item.placeholderClass) {
      return `<div class="portfolio-tile portfolio-tile-placeholder ${item.placeholderClass}" data-index="${globalIndex}">
        <div class="portfolio-tile-caption">
          <h4>${title}</h4>
          <p>${subtitle}</p>
        </div>
      </div>`;
    }
    if (item.type === 'video') {
      return `<div class="portfolio-tile portfolio-tile-video" data-index="${globalIndex}">
        <video src="${item.video}" poster="${item.poster}" muted loop playsinline preload="none" aria-label="${escapeHTML(item.alt)}"></video>
        <span class="portfolio-tile-play"><i class="fas fa-play"></i></span>
      </div>`;
    }
    // item.thumb only exists on items uploaded after the thumbnail pipeline
    // was added - older items fall back to the full-size src exactly as
    // before, so nothing already live changes.
    const gridSrc = item.thumb || item.src;
    const dims = (item.width && item.height) ? ` width="${item.width}" height="${item.height}"` : '';
    return `<div class="portfolio-tile" data-index="${globalIndex}">
      <img src="${gridSrc}" alt="${escapeHTML(item.alt)}" loading="lazy" draggable="false"${dims}>
    </div>`;
  }

  // Only decode/play grid video tiles that are actually on screen, otherwise
  // 25 simultaneously-playing videos would be needlessly heavy.
  const tileVideoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting) {
        if (!video.src) video.src = video.dataset.src;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, { threshold: 0.15 });

  function attachTileVideoObservers() {
    document.querySelectorAll('.portfolio-tile-video video').forEach(video => {
      if (!video.dataset.src) {
        video.dataset.src = video.getAttribute('src') || '';
        video.removeAttribute('src');
      }
      tileVideoObserver.observe(video);
    });
  }

  function attachTileClickHandlers() {
    document.querySelectorAll('.portfolio-tile:not(.portfolio-tile-placeholder)').forEach(tile => {
      tile.addEventListener('click', () => {
        if (suppressNextClick) { suppressNextClick = false; return; }
        openLightbox(parseInt(tile.getAttribute('data-index'), 10));
      });
    });
  }

  // Makes a row scrollable by hand (touch swipe natively, mouse click-drag manually)
  // and auto-advances scrollLeft when idle. Content is duplicated x2 so the loop
  // point (half the scrollWidth) can be wrapped around seamlessly either direction.
  function setupRowScroll(row, track, rowIdx) {
    let rafId = null;
    let lastTime = null;
    let userInteracting = false;
    let resumeTimer = null;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartScroll = 0;
    let dragMoved = 0;

    function loopWidth() {
      return track.scrollWidth / 2;
    }

    function markInteracting() {
      userInteracting = true;
      clearTimeout(resumeTimer);
    }

    function scheduleResume(delay) {
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { userInteracting = false; }, delay);
    }

    // Start each row at its loop midpoint so users can drag either direction
    // right away without immediately hitting the start/end of scrollWidth.
    row.scrollLeft = loopWidth() / 2;

    function step(timestamp) {
      if (!lastTime) lastTime = timestamp;
      const delta = (timestamp - lastTime) / 1000;
      lastTime = timestamp;

      if (!prefersReducedMotion && !globalPaused && !userInteracting) {
        const lw = loopWidth();
        const speed = rowSpeedsPxPerSec[rowIdx];
        if (rowDirections[rowIdx] === 'reverse') {
          row.scrollLeft -= speed * delta;
          if (row.scrollLeft <= 0) row.scrollLeft += lw;
        } else {
          row.scrollLeft += speed * delta;
          if (row.scrollLeft >= lw) row.scrollLeft -= lw;
        }
      } else {
        // keep any manual/native scrolling wrapped within the loop bounds
        const lw = loopWidth();
        if (row.scrollLeft >= lw * 1.5) row.scrollLeft -= lw;
        else if (row.scrollLeft <= lw * 0.001) row.scrollLeft += lw;
      }
      rafId = requestAnimationFrame(step);
    }
    rafId = requestAnimationFrame(step);

    row.addEventListener('mouseenter', () => { userInteracting = true; });
    row.addEventListener('mouseleave', () => {
      if (!isDragging) scheduleResume(0);
    });

    row.addEventListener('touchstart', markInteracting, { passive: true });
    row.addEventListener('touchend', () => scheduleResume(2000), { passive: true });

    row.addEventListener('wheel', () => { markInteracting(); scheduleResume(2000); }, { passive: true });

    // Click-and-drag scrolling for mouse/trackpad users
    row.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragMoved = 0;
      row.classList.add('dragging');
      dragStartX = e.pageX;
      dragStartScroll = row.scrollLeft;
      markInteracting();
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.pageX - dragStartX;
      dragMoved = Math.max(dragMoved, Math.abs(dx));
      row.scrollLeft = dragStartScroll - dx;
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      row.classList.remove('dragging');
      if (dragMoved > 5) suppressNextClick = true;
      scheduleResume(1500);
    });

    return {
      destroy() {
        if (rafId) cancelAnimationFrame(rafId);
        clearTimeout(resumeTimer);
      },
    };
  }

  // Videos all live at the end of PORTFOLIO_ITEMS (appended after the photos),
  // so on the "all" view we spread them evenly through the photos instead of
  // letting them clump together at the tail.
  function interleaveVideos(items) {
    const videos = items.filter(i => i.type === 'video');
    const others = items.filter(i => i.type !== 'video');
    if (videos.length === 0) return items;
    const step = Math.max(1, Math.floor(others.length / videos.length));
    const result = [];
    let videoIdx = 0;
    others.forEach((item, i) => {
      result.push(item);
      if ((i + 1) % step === 0 && videoIdx < videos.length) {
        result.push(videos[videoIdx++]);
      }
    });
    while (videoIdx < videos.length) result.push(videos[videoIdx++]);
    return result;
  }

  function renderPortfolio(filterValue) {
    const filtered = filterValue === 'all'
      ? interleaveVideos(PORTFOLIO_ITEMS)
      : PORTFOLIO_ITEMS.filter(i => i.category === filterValue);

    currentFilteredItems = filtered;

    const buckets = [[], [], []];
    filtered.forEach((item, i) => buckets[i % 3].push({ item, index: i }));

    // tear down any previous per-row scroll loops and video observers before rebuilding
    rowControllers.forEach(c => c && c.destroy());
    rowControllers.length = 0;
    tileVideoObserver.disconnect();

    tracks.forEach((track, rowIdx) => {
      const rowItems = buckets[rowIdx];
      if (rowItems.length === 0) {
        track.innerHTML = '';
        return;
      }
      const tilesHTML = rowItems.map(({ item, index }) => buildTileHTML(item, index)).join('');
      track.innerHTML = tilesHTML + tilesHTML;
      rowControllers.push(setupRowScroll(rows[rowIdx], track, rowIdx));
    });

    attachTileClickHandlers();
    attachTileVideoObservers();
  }

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPortfolio(btn.getAttribute('data-filter'));
    });
  });

  // Lightbox
  const lightbox = document.getElementById('portfolioLightbox');
  const lightboxImg = document.getElementById('portfolioLightboxImg');
  const lightboxVideo = document.getElementById('portfolioLightboxVideo');
  const lightboxTitle = document.getElementById('portfolioLightboxTitle');
  const lightboxSubtitle = document.getElementById('portfolioLightboxSubtitle');
  const lightboxClose = document.getElementById('portfolioLightboxClose');
  const lightboxBackdrop = document.getElementById('portfolioLightboxBackdrop');
  const lightboxPrev = document.getElementById('portfolioLightboxPrev');
  const lightboxNext = document.getElementById('portfolioLightboxNext');

  function showLightboxItem(item) {
    lightboxVideo.pause();
    if (item.type === 'video') {
      lightboxImg.style.display = 'none';
      lightboxVideo.style.display = 'block';
      lightboxVideo.src = item.video;
      lightboxVideo.poster = item.poster;
      lightboxVideo.play().catch(() => {});
    } else {
      lightboxVideo.removeAttribute('src');
      lightboxVideo.style.display = 'none';
      lightboxImg.style.display = 'block';
      lightboxImg.style.opacity = '0';
      const tempImg = new Image();
      tempImg.onload = () => {
        lightboxImg.src = item.src;
        lightboxImg.alt = item.alt;
        requestAnimationFrame(() => { lightboxImg.style.opacity = '1'; });
      };
      tempImg.src = item.src;
    }
    lightboxTitle.textContent = item.title;
    lightboxSubtitle.textContent = item.subtitle;
  }

  function openLightbox(index) {
    const item = currentFilteredItems[index];
    if (!item || item.placeholderClass) return;
    lightboxIndex = index;
    showLightboxItem(item);
    lightbox.classList.add('active');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    globalPaused = true;
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    lightboxVideo.pause();
    globalPaused = false;
    lightboxIndex = -1;
  }

  function showRelative(delta) {
    if (lightboxIndex === -1 || currentFilteredItems.length === 0) return;
    let next = lightboxIndex;
    for (let i = 0; i < currentFilteredItems.length; i++) {
      next = (next + delta + currentFilteredItems.length) % currentFilteredItems.length;
      if (!currentFilteredItems[next].placeholderClass) break;
    }
    lightboxIndex = next;
    showLightboxItem(currentFilteredItems[lightboxIndex]);
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxBackdrop.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click', () => showRelative(-1));
  lightboxNext.addEventListener('click', () => showRelative(1));

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showRelative(-1);
    if (e.key === 'ArrowRight') showRelative(1);
  });

  renderPortfolio('all');
})();

// Instagram section - background videos lazy-load and fade in once the
// section scrolls into view, and pause again once it's out of view.
(function () {
  const bg = document.getElementById('instagramVideoBg');
  if (!bg) return;
  const videos = Array.from(bg.querySelectorAll('video'));
  let loaded = false;

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (!loaded) {
          loaded = true;
          videos.forEach(v => { v.src = v.dataset.src; });
        }
        bg.classList.add('revealed');
        videos.forEach(v => v.play().catch(() => {}));
      } else {
        videos.forEach(v => v.pause());
      }
    });
  }, { threshold: 0.15 });

  sectionObserver.observe(document.getElementById('instagram'));
})();
