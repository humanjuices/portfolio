(() => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const copBtn = document.getElementById('cop-btn');
  let __copBubble = null;
  let __copBubbleTail = null;
  let __bubbleOpen = false;

  const getCopBubbleEl = () => {
    if (__copBubble instanceof HTMLElement) return __copBubble;
    if (!(copBtn instanceof HTMLElement)) return null;
    const bubble = copBtn.querySelector?.('.cop-bubble');
    return bubble instanceof HTMLElement ? bubble : null;
  };

  const ensureBubbleDetached = () => {
    const bubble = getCopBubbleEl();
    if (!bubble) return null;
    // Detach bubble from the cop button so it isn't affected by containing-block quirks
    // (e.g. filter can create a containing block for fixed-position descendants on some browsers).
    if (bubble.parentElement !== document.body) {
      document.body.appendChild(bubble);
    }
    __copBubble = bubble;
    return bubble;
  };

  const ensureBubbleTail = () => {
    if (__copBubbleTail instanceof HTMLImageElement) return __copBubbleTail;

    const tail = document.createElement('img');
    tail.className = 'cop-bubble-tail';
    tail.src = 'img/bubbletail.png';
    tail.alt = '';
    tail.setAttribute('aria-hidden', 'true');
    tail.decoding = 'async';
    tail.loading = 'eager';
    tail.style.opacity = '0';
    document.body.appendChild(tail);

    __copBubbleTail = tail;
    return tail;
  };

  const setTailVisible = (isVisible) => {
    const tail = ensureBubbleTail();
    if (!tail) return;
    tail.style.opacity = isVisible ? '1' : '0';
  };

  const setBubbleText = () => {
    const bubble = ensureBubbleDetached();
    if (!bubble) return;
    bubble.innerHTML =
      "<strong>HELLO CITIZEN.</strong>\n\n" +
      "You’ve entered humanjuices.com, the digital residence of <span class=\"cop-bubble__name\">Gigi Gomez</span> (humanjuices), a New York–based artist, designer, and performer.\n\n" +
      "This website functions as an archive, studio, and ongoing case file. Evidence includes clothing, games, publications, and unfinished business.\n\n" +
      "Click carefully.\n\n" +
      "<div class=\"cop-bubble__credit\">Website made by <a class=\"cop-bubble__credit-link\" href=\"https://ting.directory\" target=\"_blank\" rel=\"noopener noreferrer\">Wun Ting Chan</a> © 2026</div>";
  };

  const setBubbleVisible = (isVisible) => {
    const bubble = ensureBubbleDetached();
    if (!bubble) return;
    // Force visibility via inline styles (don’t rely on hover media queries / attribute selectors).
    bubble.style.opacity = isVisible ? '1' : '0';
    bubble.style.transform = isVisible ? 'scale(1)' : 'scale(0.98)';
  };

  const openBubble = () => {
    __bubbleOpen = true;
    positionCopBubble();
    setBubbleVisible(true);
    setTailVisible(true);
  };

  const closeBubble = () => {
    __bubbleOpen = false;
    setBubbleVisible(false);
    setTailVisible(false);
  };

  const bindCopBubble = () => {
    if (!(copBtn instanceof HTMLButtonElement)) return;
    if (copBtn.dataset.bound === '1') return;
    copBtn.dataset.bound = '1';

    ensureBubbleDetached();
    ensureBubbleTail();
    setBubbleText();

    const isCoarsePointer =
      window.matchMedia &&
      (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches);

    // Default hidden
    copBtn.setAttribute('aria-expanded', 'false');
    closeBubble();

    if (isCoarsePointer) {
      // Mobile/tablet: tap to toggle bubble
      copBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (__bubbleOpen) {
          copBtn.setAttribute('aria-expanded', 'false');
          closeBubble();
        } else {
          copBtn.setAttribute('aria-expanded', 'true');
          openBubble();
        }
      });

      // Tap anywhere else closes
      window.addEventListener(
        'click',
        (e) => {
          if (!(e.target instanceof Node)) return;
          if (copBtn.contains(e.target)) return;
          copBtn.setAttribute('aria-expanded', 'false');
          closeBubble();
        },
        { capture: true },
      );
    } else {
      // Desktop: hover-only
      copBtn.addEventListener('mouseenter', () => {
        openBubble();
      });
      copBtn.addEventListener('mouseleave', () => {
        closeBubble();
      });

      // Keyboard accessibility: show on focus, hide on blur
      copBtn.addEventListener('focusin', openBubble);
      copBtn.addEventListener('focusout', closeBubble);
    }

    // Close on escape (both modes)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        copBtn.setAttribute('aria-expanded', 'false');
        closeBubble();
      }
    });
  };

  const positionCopBubble = () => {
    if (!(copBtn instanceof HTMLElement)) return;
    const bubble = ensureBubbleDetached();
    if (!(bubble instanceof HTMLElement)) return;
    const tail = ensureBubbleTail();

    const copRect = copBtn.getBoundingClientRect();
    if (copRect.width <= 0 || copRect.height <= 0) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Measure bubble (works even when opacity is 0)
    const bRect = bubble.getBoundingClientRect();
    const bw = Math.max(1, bRect.width || 0);
    const bh = Math.max(1, bRect.height || 0);

    const pad = 8;
    // Place the bubble ABOVE the cop and slightly LEFT (clamped to screen).
    // Since the cop is already near the left edge, "left" here means aligned closer
    // to the cop's left side (not necessarily outside the viewport).
    const xOffset = -32; // nudge left
    const yOffset = -22; // nudge up

    const leftTarget = copRect.left + copRect.width * 0.06 + xOffset;
    const topTarget = copRect.top - bh + yOffset;

    let left = leftTarget;
    let top = topTarget;

    left = clamp(left, pad, vw - bw - pad);
    top = clamp(top, pad, vh - bh - pad);

    // Used by CSS to render the speech-bubble arrow on the correct side.
    const side =
      left + bw / 2 < copRect.left + copRect.width / 2 ? 'left' : 'right';
    bubble.dataset.side = side;

    bubble.style.left = `${Math.round(left)}px`;
    bubble.style.top = `${Math.round(top)}px`;

    // ---- Tail positioning (connect bubble -> cop) ----
    if (tail instanceof HTMLImageElement) {
      // Tail top should touch bubble bottom
      const overlap = 4;
      const tailTop = top + bh - overlap;
      const isMobileView =
        window.innerWidth <= 768 ||
        (window.matchMedia &&
          (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches));

      // Where the tail attaches on the bubble:
      // - mobile: closer to the center so it reaches the cop head more naturally
      // - desktop: slightly left-biased
      // Mobile: nudge a touch left (user feedback: slightly too centered/right)
      const anchorFrac = isMobileView ? 0.50 : 0.18;
      const tailAnchorX = left + bw * anchorFrac;

      // Aim the tail tip near the cop's head/upper chest.
      const copX = copRect.left + copRect.width * 0.22;
      // Aim a bit higher so the tail doesn't run too long / too low.
      const copY = copRect.top + copRect.height * 0.18;

      const dx = copX - tailAnchorX;
      const dy = copY - tailTop;
      const length = Math.hypot(dx, dy);

      // Scale with both distance-to-cop and bubble size, but keep it shorter.
      // (User feedback: the tail was too long across viewports.)
      const base = bw * 0.26;
      const tailLen = clamp(Math.max(length * 0.55, base), 40, 170);

      // Angle: tail image is "downwards" by default; rotate toward the cop.
      const angleRad = Math.atan2(dx, Math.max(1, dy)); // 0 = down
      const angleDeg = (angleRad * 180) / Math.PI;

      tail.style.left = `${Math.round(tailAnchorX)}px`;
      tail.style.top = `${Math.round(tailTop)}px`;
      tail.style.height = `${Math.round(tailLen)}px`;
      tail.style.width = 'auto';
      // Mobile: don't rotate the PNG (user feedback: rotation looked wrong).
      // Desktop: rotate to "aim" toward the cop.
      const rot = isMobileView ? 0 : angleDeg;
      tail.style.transform = `translateX(-50%) rotate(${rot.toFixed(2)}deg)`;
      tail.style.transformOrigin = 'top center';

      // Match visibility with bubble state.
      setTailVisible(__bubbleOpen);
    }
  };

  // Bind + position ASAP (don’t depend on the background image load).
  bindCopBubble();
  requestAnimationFrame(() => {
    setBubbleText();
    positionCopBubble();
    // Keep hidden unless user interaction opens it.
    setBubbleVisible(__bubbleOpen);
  });
  window.addEventListener('resize', () => {
    requestAnimationFrame(() => {
      positionCopBubble();
      setBubbleVisible(__bubbleOpen);
    });
  });

  const img = document.querySelector('.poster__img');
  const frame = document.querySelector('.poster__frame');
  // If the background image isn’t present, we still keep the cop bubble behavior.
  if (!img || !frame) return;

  // Key areas in ORIGINAL image pixels (x1,y1,x2,y2)
  // We keep these visible (and above the bottom news banner) while using object-fit: cover.
  const hotspots = [
    // overall flashing bbox_px: (1051, 542) – (2221, 2289)
    { x1: 1051, y1: 542, x2: 2221, y2: 2289 },
    // evidence marker bboxes
    { x1: 1744, y1: 1944, x2: 1968, y2: 2296 }, // #1
    { x1: 1040, y1: 768, x2: 1240, y2: 1008 },  // #2
    { x1: 2048, y1: 968, x2: 2232, y2: 1232 },  // #3
    { x1: 1744, y1: 536, x2: 1880, y2: 728 },   // #4
  ];

  const unionBox = (boxes) => {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const b of boxes) {
      x1 = Math.min(x1, b.x1);
      y1 = Math.min(y1, b.y1);
      x2 = Math.max(x2, b.x2);
      y2 = Math.max(y2, b.y2);
    }
    return { x1, y1, x2, y2 };
  };

  const update = () => {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) {
      // Still position the cop bubble even if the background image isn’t ready yet.
      positionCopBubble();
      return;
    }

    const rect = img.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    if (cw <= 0 || ch <= 0) return;

    // We use object-fit: cover. This is the scale factor the browser will apply.
    const scale = Math.max(cw / iw, ch / ih);
    const visibleW = cw / scale;
    const visibleH = ch / scale;

    // Reserve vertical space for the top banners and bottom news banner so they don't cover marker regions.
    let reserveTopPx = 0;
    const topTapes = document.querySelectorAll('.caution-tape--red, .caution-tape--secondary');
    topTapes.forEach((t) => {
      const r = t.getBoundingClientRect();
      reserveTopPx = Math.max(reserveTopPx, r.bottom - rect.top);
    });
    // Mobile: add extra breathing room so the top-most marker doesn't sit too close to the top banners.
    // This effectively shifts the visible crop window upward, pushing markers/background content down.
    const extraMobileTopPadPx = window.innerWidth <= 520 ? 80 : 0;
    reserveTopPx = clamp(reserveTopPx + 6 + extraMobileTopPadPx, 0, Math.max(0, ch - 10));

    const news = document.querySelector('.caution-tape--news');
    let reserveBottomPx = 0;
    if (news) {
      const n = news.getBoundingClientRect();
      reserveBottomPx = Math.max(0, rect.bottom - n.top);
      reserveBottomPx = clamp(reserveBottomPx, 0, Math.max(0, ch - 10));
    }

    // Reserve extra bottom space so the cop can be big without touching the lowest clickable marker.
    // We need this on desktop too; otherwise on very wide viewports the crop can push markers
    // so low that the cop has almost no room.
    // On ultra-wide viewports, the "cover" crop can push markers low, which then forces
    // the cop to shrink (we clamp cop height to stay above the lowest marker).
    // Reserve *more* bottom space as the viewport gets wider to keep markers higher.
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const desiredCopSpacePx = (() => {
      if (window.innerWidth <= 520) return 220;
      if (window.innerWidth <= 820) return 200;
      let v = 260;
      if (window.innerWidth >= 1200) v += 60;
      if (window.innerWidth >= 1600) v += 70;
      if (aspect >= 1.9) v += 60;
      if (aspect >= 2.3) v += 60;
      return v;
    })();
    reserveBottomPx = clamp(
      Math.max(reserveBottomPx, desiredCopSpacePx),
      0,
      Math.max(0, ch - 10),
    );
    const safeTop = reserveTopPx / scale;
    const safeBottom = Math.max(1, (ch - reserveBottomPx) / scale);

    const bbox = unionBox(hotspots);

    // Choose a crop window [x0, y0] in image coords such that the flashing bbox stays visible.
    // Valid x0 range that fully contains bbox: [bbox.x2 - visibleW, bbox.x1]
    // Valid y0 range that fully contains bbox INSIDE the safe area: [bbox.y2 - safeBottom, bbox.y1 - safeTop]
    const xMin = bbox.x2 - visibleW;
    const xMax = bbox.x1;
    const yMin = bbox.y2 - safeBottom;
    const yMax = bbox.y1 - safeTop;

    // Clamp to the image bounds.
    const x0 = clamp((xMin + xMax) / 2, 0, Math.max(0, iw - visibleW));
    // If the safe area is smaller than the bbox height, yMin > yMax; clamping still gives a best-effort.
    const y0 = clamp((yMin + yMax) / 2, 0, Math.max(0, ih - visibleH));

    // Convert desired crop origin (x0,y0) into object-position percents.
    const scaledW = iw * scale;
    const scaledH = ih * scale;
    const maxLeftShift = cw - scaledW; // <= 0
    const maxTopShift = ch - scaledH;  // <= 0

    const leftOffset = -x0 * scale; // <= 0
    const topOffset = -y0 * scale;  // <= 0

    const px = maxLeftShift === 0 ? 50 : clamp((leftOffset / maxLeftShift) * 100, 0, 100);
    const py = maxTopShift === 0 ? 50 : clamp((topOffset / maxTopShift) * 100, 0, 100);

    img.style.objectPosition = `${px.toFixed(2)}% ${py.toFixed(2)}%`;

    // ---- Position clickable hotspots (image pixel coords -> viewport coords) ----
    document.querySelectorAll('.hotspot[data-bbox]').forEach((el) => {
      const raw = el.getAttribute('data-bbox') || '';
      const parts = raw.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return;
      const [x1, y1, x2, y2] = parts;

      // Since we know the crop origin (x0,y0), map directly into viewport space.
      const left = rect.left + (x1 - x0) * scale;
      const top = rect.top + (y1 - y0) * scale;
      const width = Math.max(0, (x2 - x1) * scale);
      const height = Math.max(0, (y2 - y1) * scale);

      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;

      // Hover ring should be a CIRCLE, not an ellipse. Use the larger dimension as diameter.
      const ringSize = Math.max(width, height) * 1.45;
      el.style.setProperty('--ring-size', `${ringSize.toFixed(2)}px`);
    });

    // ---- Size/position the cop image (bottom-left) ----
    const cop = document.querySelector('.cop-btn');
    const copImg = cop?.querySelector?.('.cop-img');
    if (cop && cop instanceof HTMLElement && copImg instanceof HTMLImageElement) {
      const margin = 10;

      // Find the lowest (visually) hotspot that could actually collide with the cop.
      // On very wide viewports, the cop is far left while markers are far right, so we
      // should not shrink the cop based on markers that don't overlap horizontally.
      const copRectNow = cop.getBoundingClientRect();
      const overlapPadX = 18;
      let lowestRelevantHotspotBottom = 0;
      let sawAnyRelevant = false;
      document.querySelectorAll('.hotspot[data-bbox]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        const overlapsX =
          r.right >= (copRectNow.left - overlapPadX) &&
          r.left <= (copRectNow.right + overlapPadX);
        if (!overlapsX) return;
        sawAnyRelevant = true;
        lowestRelevantHotspotBottom = Math.max(lowestRelevantHotspotBottom, r.bottom);
      });

      // Align the cop's bottom to the bottom edge of the news banner.
      const news = document.querySelector('.caution-tape--news');
      const anchorY = news ? news.getBoundingClientRect().bottom : window.innerHeight;
      const bottomOffset = Math.max(0, window.innerHeight - anchorY);
      cop.style.bottom = `${Math.round(bottomOffset)}px`;

      // Constrain the cop so it doesn't touch the lowest clickable marker.
      // If no relevant hotspots overlap with the cop horizontally, allow the cop to be taller.
      const blockerBottom = sawAnyRelevant ? lowestRelevantHotspotBottom : 0;
      let maxH = Math.max(0, anchorY - blockerBottom - margin);

      // Ultra-wide viewports: the cop can get a bit too dominant visually. Nudge it smaller.
      const aspect = window.innerWidth / Math.max(1, window.innerHeight);
      const wideFactor =
        window.innerWidth >= 1800 || aspect >= 2.4 ? 0.88 :
        window.innerWidth >= 1400 || aspect >= 2.0 ? 0.93 :
        1;
      maxH *= wideFactor;

      // Apply the max height; let the image keep its aspect ratio.
      copImg.style.maxHeight = `${Math.floor(maxH)}px`;

      // ---- Keep the speech bubble fully on-screen ----
      positionCopBubble();
    }
  };

  // Some browsers can report complete=true while naturalWidth is still 0 for a moment (esp. cached GIFs).
  // Keep trying for a short window so hotspots + cop bubble positioning always initialize.
  let tries = 0;
  const tryInit = () => {
    tries += 1;
    update();
    if (img.naturalWidth > 0 && img.naturalHeight > 0) return;
    if (tries < 60) requestAnimationFrame(tryInit);
  };

  if (img.complete) {
    requestAnimationFrame(tryInit);
  } else {
    img.addEventListener('load', () => requestAnimationFrame(tryInit), { once: true });
  }
  window.addEventListener('resize', update);

  // ---- Caution tape: ensure the marquee is "full" at page load (no empty tape) ----
  const fillTape = () => {
    // Keep marquee speed consistent across viewport sizes (px/sec), regardless of how wide the track is.
    const PX_PER_SEC = 45; // slower, still consistent across mobile + desktop

    document.querySelectorAll('.caution-tape').forEach((tape) => {
      const track = tape.querySelector('.caution-tape__track');
      const group = tape.querySelector('.caution-tape__group');
      if (!track || !group) return;

      // Remove any previously created clones so we don't grow forever on resize.
      track.querySelectorAll('[data-clone="true"]').forEach((n) => n.remove());

      const tapeW = tape.getBoundingClientRect().width;
      // Ensure the track is comfortably wider than the tape so any animation offset still shows text.
      const targetW = tapeW * 2.6;

      // Measure the base group's width (this is the distance we animate by for a seamless loop).
      const groupW = group.getBoundingClientRect().width;
      if (groupW > 0) {
        tape.style.setProperty('--marquee-shift', `${-groupW}px`);
        const duration = Math.max(14, groupW / PX_PER_SEC);
        track.style.animationDuration = `${duration.toFixed(3)}s`;
        // Start mid-stream so the tape is already filled on first paint.
        track.style.animationDelay = `${(-duration / 2).toFixed(3)}s`;
      }

      // Start with the existing groups, then clone the first group until we exceed target width.
      let safety = 0;
      while (track.scrollWidth < targetW && safety < 30) {
        const clone = group.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        clone.setAttribute('data-clone', 'true');
        track.appendChild(clone);
        safety += 1;
      }
    });
  };

  // Run once after layout, and again on resize.
  requestAnimationFrame(fillTape);
  window.addEventListener('resize', () => requestAnimationFrame(fillTape));
})();

