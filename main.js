(() => {
  const img = document.querySelector('.poster__img');
  const frame = document.querySelector('.poster__frame');
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

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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
    if (!iw || !ih) return;

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
    reserveTopPx = clamp(reserveTopPx + 6, 0, Math.max(0, ch - 10));

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
    const desiredCopSpacePx =
      window.innerWidth <= 520 ? 220 :
      window.innerWidth <= 820 ? 200 :
      260;
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
    const cop = document.querySelector('.cop');
    if (cop && cop instanceof HTMLImageElement) {
      const margin = 10;

      // Find the lowest (visually) hotspot on screen.
      let lowestHotspotBottom = 0;
      document.querySelectorAll('.hotspot[data-bbox]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          lowestHotspotBottom = Math.max(lowestHotspotBottom, r.bottom);
        }
      });

      // Align the cop's bottom to the bottom edge of the news banner.
      const news = document.querySelector('.caution-tape--news');
      const anchorY = news ? news.getBoundingClientRect().bottom : window.innerHeight;
      const bottomOffset = Math.max(0, window.innerHeight - anchorY);
      cop.style.bottom = `${Math.round(bottomOffset)}px`;

      // Constrain the cop so it doesn't touch the lowest clickable marker.
      const maxH = Math.max(0, anchorY - lowestHotspotBottom - margin);

      // Apply the max height; let the image keep its aspect ratio.
      cop.style.maxHeight = `${Math.floor(maxH)}px`;
    }
  };

  if (img.complete) update();
  img.addEventListener('load', update);
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

