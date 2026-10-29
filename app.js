/**
 * هَمْس (HAMS) - Interactive Acoustic Showcase
 * Pure Vanilla JavaScript with GSAP, ScrollTrigger & Lenis
 */

(() => {
  'use strict';

  // --- Configuration ---
  const TOTAL_FRAMES = 144;
  const FRAMES_DIR = 'frames/';
  const FRAME_PREFIX = 'frame_';
  const FRAME_EXT = '.webp';

  // --- DOM Elements ---
  const preloader = document.getElementById('preloader');
  const loaderBar = document.getElementById('loader-bar');
  const loaderPercentage = document.getElementById('loader-percentage');
  const canvas = document.getElementById('canvas-frames');
  const ctx = canvas.getContext('2d', { alpha: false });
  const scrollHint = document.getElementById('scrollHint');
  const header = document.getElementById('header');

  // Stage Elements
  const stage1 = document.getElementById('stage-1');
  const stage2 = document.getElementById('stage-2');
  const stage3 = document.getElementById('stage-3');
  const stage4 = document.getElementById('stage-4');
  const featNoise = document.getElementById('feat-noise');
  const featBattery = document.getElementById('feat-battery');
  const featSound = document.getElementById('feat-sound');

  // Preorder & Interactive Elements
  const btnOrder = document.getElementById('btnOrder');
  const orderModal = document.getElementById('orderModal');
  const modalClose = document.getElementById('modalClose');
  const preorderForm = document.getElementById('preorderForm');
  const modalFormContainer = document.getElementById('modalFormContainer');
  const modalSuccess = document.getElementById('modalSuccess');
  const soundToggle = document.getElementById('soundToggle');
  const soundLabel = document.getElementById('soundLabel');

  // --- State Variables ---
  const images = [];
  const playhead = { frame: 0 };
  let extractedBgColor = '#cbcdcf';
  let isMobile = window.innerWidth <= 768;
  let audioCtx = null;
  let isAudioPlaying = false;
  let audioOscillators = [];
  let audioGain = null;

  // --- 1. Generate Frame File Paths ---
  const getFramePath = (index) => {
    const num = String(index + 1).padStart(4, '0');
    return `${FRAMES_DIR}${FRAME_PREFIX}${num}${FRAME_EXT}`;
  };

  // --- 2. Extract Background Color from First Frame ---
  const extractAndApplyBackgroundColor = (firstImage) => {
    try {
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 16;
      sampleCanvas.height = 16;
      const sCtx = sampleCanvas.getContext('2d');
      // Draw top-left region of the first frame
      sCtx.drawImage(firstImage, 0, 0, 16, 16, 0, 0, 16, 16);
      const pixel = sCtx.getImageData(0, 0, 1, 1).data;
      extractedBgColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;

      // Apply dynamically to CSS variable and body
      document.documentElement.style.setProperty('--bg-base', extractedBgColor);
      document.body.style.backgroundColor = extractedBgColor;
      if (preloader) {
        preloader.style.backgroundColor = extractedBgColor;
      }
      console.log('Sampled Background Color from Frame 1:', extractedBgColor);
    } catch (err) {
      console.warn('Could not extract pixel color, using fallback:', err);
    }
  };

  // --- 3. Preload All Images with Percentage Loader ---
  const preloadImages = () => {
    return new Promise((resolve) => {
      let loadedCount = 0;

      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const img = new Image();
        img.src = getFramePath(i);

        img.onload = () => {
          loadedCount++;
          // When first frame is loaded, immediately extract background color
          if (i === 0) {
            extractAndApplyBackgroundColor(img);
          }

          const progress = Math.min(100, Math.floor((loadedCount / TOTAL_FRAMES) * 100));
          if (loaderBar) loaderBar.style.width = `${progress}%`;
          if (loaderPercentage) loaderPercentage.textContent = `${progress}%`;

          if (loadedCount === TOTAL_FRAMES) {
            setTimeout(resolve, 300); // brief aesthetic pause at 100%
          }
        };

        img.onerror = () => {
          loadedCount++;
          console.error(`Failed to load frame ${i}`);
          if (loadedCount === TOTAL_FRAMES) {
            resolve();
          }
        };

        images.push(img);
      }
    });
  };

  // Setup responsive canvas & mobile downscaling
  const resizeCanvas = () => {
    isMobile = window.innerWidth <= 768;
    const rect = canvas.getBoundingClientRect();
    
    // On mobile: downscale render resolution for light memory & 60fps performance
    const dpr = isMobile ? 1.0 : Math.min(window.devicePixelRatio || 1, 2);
    const renderScale = isMobile ? 0.8 : 1.0;

    canvas.width = Math.round(rect.width * dpr * renderScale);
    canvas.height = Math.round(rect.height * dpr * renderScale);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = isMobile ? 'medium' : 'high';

    renderCurrentFrame();
  };

  // Draw current frame centered with seamless full-bleed coverage
  const renderCurrentFrame = () => {
    const frameIndex = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.floor(playhead.frame)));
    const img = images[frameIndex];
    if (!img || !img.complete) return;

    // Fill canvas with extracted base color
    ctx.fillStyle = extractedBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cover scale to eliminate any borders while keeping the centered headphone prominent
    const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const renderW = img.naturalWidth * scale;
    const renderH = img.naturalHeight * scale;

    const offsetX = (canvas.width - renderW) / 2;
    const offsetY = (canvas.height - renderH) / 2;

    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
  };

  // --- 5. Initialize Lenis Smooth Scroll ---
  const initLenis = () => {
    if (typeof Lenis === 'undefined') {
      console.warn('Lenis CDN not loaded, falling back to native scroll.');
      return null;
    }

    const lenis = new Lenis({
      duration: 1.25,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    return lenis;
  };

  // --- 6. Initialize GSAP & ScrollTrigger Animations ---
  const initScrollAnimations = () => {
    gsap.registerPlugin(ScrollTrigger);

    // Timeline for the 500vh pinned sequence
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#hero-scroll',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6,
      }
    });

    // 1) Scrub image sequence from frame 0 to 143
    tl.to(playhead, {
      frame: TOTAL_FRAMES - 1,
      ease: 'none',
      duration: 100,
      onUpdate: renderCurrentFrame,
    }, 0);

    // 2) Scroll Hint fade out quickly
    tl.to(scrollHint, {
      opacity: 0,
      y: 20,
      ease: 'power2.out',
      duration: 5,
    }, 1);

    // --- المرحلة الأولى: "همس، الصوت الذي يصلك فقط" ---
    // Visible by default at start (0-12), then fades out (12-18)
    gsap.set(stage1, { autoAlpha: 1, y: 0 });
    tl.to(stage1, 
      { autoAlpha: 0, y: -30, duration: 6, ease: 'power1.in' }, 
      12
    );

    // --- المرحلة الثانية: "شكل عصري، يتناسب مع أي مكان" ---
    // Enters (22-28), stays (28-42), fades out (42-48)
    tl.fromTo(stage2, 
      { autoAlpha: 0, y: 30 }, 
      { autoAlpha: 1, y: 0, duration: 6, ease: 'power2.out' }, 
      22
    );
    tl.to(stage2, 
      { autoAlpha: 0, y: -25, duration: 6, ease: 'power1.in' }, 
      42
    );

    // --- المرحلة الثالثة: "خفيفة لدرجة إنك قد تنساها" ---
    // Enters (52-58), stays (58-70), fades out (70-76)
    tl.fromTo(stage3, 
      { autoAlpha: 0, y: 30 }, 
      { autoAlpha: 1, y: 0, duration: 6, ease: 'power2.out' }, 
      52
    );
    tl.to(stage3, 
      { autoAlpha: 0, y: -25, duration: 6, ease: 'power1.in' }, 
      70
    );

    // --- المرحلة الرابعة: تلات مميزات بيظهروا ورا بعض ---
    // 1. عزل الضوضاء
    // 2. البطارية
    // 3. جودة الصوت
    tl.set(stage4, { autoAlpha: 1 }, 78);

    tl.fromTo(featNoise,
      { autoAlpha: 0, y: 25 },
      { autoAlpha: 1, y: 0, duration: 5, ease: 'back.out(1.1)' },
      79
    );

    tl.fromTo(featBattery,
      { autoAlpha: 0, y: 25 },
      { autoAlpha: 1, y: 0, duration: 5, ease: 'back.out(1.1)' },
      84
    );

    tl.fromTo(featSound,
      { autoAlpha: 0, y: 25 },
      { autoAlpha: 1, y: 0, duration: 5, ease: 'back.out(1.1)' },
      89
    );

    // Fade out stage 4 smoothly before order section
    tl.to(stage4, {
      autoAlpha: 0,
      y: -20,
      duration: 4,
      ease: 'power1.in'
    }, 96);

    // Header scroll background toggle
    ScrollTrigger.create({
      start: 'top -80',
      onUpdate: (self) => {
        if (self.direction === 1) {
          header.classList.add('scrolled');
        } else if (window.scrollY < 80) {
          header.classList.remove('scrolled');
        }
      }
    });
  };

  // --- 7. Modal & Preorder Interactions ---
  const initInteractions = () => {
    // Open Modal
    if (btnOrder) {
      btnOrder.addEventListener('click', () => {
        orderModal.classList.add('open');
        orderModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      });
    }

    // Close Modal
    const closeModal = () => {
      orderModal.classList.remove('open');
      orderModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      setTimeout(() => {
        if (modalFormContainer) modalFormContainer.style.display = 'block';
        if (modalSuccess) modalSuccess.style.display = 'none';
        if (preorderForm) preorderForm.reset();
      }, 400);
    };

    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (orderModal) {
      orderModal.addEventListener('click', (e) => {
        if (e.target === orderModal) closeModal();
      });
    }

    // Submit Pre-order Form
    if (preorderForm) {
      preorderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const submitBtn = preorderForm.querySelector('.btn-submit-order');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'جارٍ تسجيل الحجز...';
        }

        setTimeout(() => {
          if (modalFormContainer) modalFormContainer.style.display = 'none';
          if (modalSuccess) modalSuccess.style.display = 'block';
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'تأكيد حجز الدفعة التجريبية';
          }
        }, 800);
      });
    }

    // Color Selector
    const colorBtns = document.querySelectorAll('.color-option');
    colorBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        colorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Sound Modes Selector
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Ambient Web Audio Chords
    if (soundToggle) {
      soundToggle.addEventListener('click', toggleAudioAmbience);
    }
  };

  // --- 8. Web Audio API Ambient Experience ---
  const toggleAudioAmbience = () => {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (!isAudioPlaying) {
      // Start calm binaural ambient drone
      audioGain = audioCtx.createGain();
      audioGain.gain.setValueAtTime(0.01, audioCtx.currentTime);
      audioGain.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 2);
      audioGain.connect(audioCtx.destination);

      // Warm calming acoustic frequencies (432Hz harmonic triad)
      const freqs = [216, 324, 432];
      audioOscillators = freqs.map((f) => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, audioCtx.currentTime);
        osc.connect(audioGain);
        osc.start();
        return osc;
      });

      isAudioPlaying = true;
      soundToggle.classList.add('playing');
      soundLabel.textContent = 'إيقاف الصوت';
    } else {
      // Stop ambient drone
      if (audioGain) {
        audioGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1);
        setTimeout(() => {
          audioOscillators.forEach(osc => osc.stop());
          audioOscillators = [];
          isAudioPlaying = false;
          soundToggle.classList.remove('playing');
          soundLabel.textContent = 'صوت التجربة';
        }, 1000);
      }
    }
  };

  // --- 9. Window Resize Listener ---
  window.addEventListener('resize', () => {
    resizeCanvas();
    ScrollTrigger.refresh();
  });

  // --- 10. Bootstrap Application ---
  window.addEventListener('DOMContentLoaded', async () => {
    initLenis();
    initInteractions();

    try {
      await preloadImages();

      // Hide Preloader smoothly
      if (preloader) {
        preloader.classList.add('loaded');
        setTimeout(() => {
          preloader.style.display = 'none';
        }, 600);
      }

      // Initial Canvas Render & Animations
      resizeCanvas();
      initScrollAnimations();

      console.log('هَمْس landing page initialized successfully with 144 frames.');
    } catch (error) {
      console.error('Initialization error:', error);
      if (preloader) {
        preloader.classList.add('loaded');
      }
    }
  });

})();
