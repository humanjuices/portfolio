// Stage-scaled drag & drop for the dress-up game
// - Model (me.png) and clothing items scale together
// - Items are positioned inside a logical stage sized to the model's natural resolution
// - Drag math accounts for the stage's CSS transform scale so positions remain accurate

(() => {
  let zIndexCounter = 100;
  let isDragging = false;
  let cleanupConveyors = null;
  let cleanupDrawerScrollbar = null;
  let audioState = null;

  const stage = document.getElementById('stage');
  const model = document.getElementById('model');
  const itemsLeft = document.getElementById('items-left');
  const itemsRight = document.getElementById('items-right');
  const header = document.querySelector('header');
  const trashcan = document.getElementById('trashcan');
  const closetDrawer = document.getElementById('closet-drawer');
  const closetDrawerContent = document.getElementById('closet-drawer-content');
  const mqMobile = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null;
  const infoButton = document.getElementById('info-button');
  const infoModal = document.getElementById('info-modal');
  const infoModalClose = document.getElementById('info-modal-close');
  const drawerScrollbar = document.getElementById('drawer-scrollbar');
  const drawerScrollbarThumb = document.getElementById('drawer-scrollbar-thumb');

  // Base logical (design) size of the stage equals the model's natural size
  // so clothes align 1:1 with the model in that coordinate system.
  let baseW = 800; // fallback until model loads
  let baseH = 1200; // fallback until model loads

  function computeScale() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Fit the stage between the sidebars (desktop) and above the drawer (mobile)
    const drawerH = (isMobileLayout() && closetDrawer) ? (closetDrawer.getBoundingClientRect().height ?? 0) : 0;
    const headerH = header?.getBoundingClientRect().height ?? 0;

    // Fit the stage between the sidebars so items never obstruct the model.
    const leftW = itemsLeft?.getBoundingClientRect().width ?? 0;
    const rightW = itemsRight?.getBoundingClientRect().width ?? 0;
    const trashW = trashcan?.getBoundingClientRect().width ?? 0;
    const rootStyles = getComputedStyle(document.documentElement);
    const stageBottomOffsetRaw = parseFloat(rootStyles.getPropertyValue('--stage-bottom-offset'));
    const stageBottomOffset = Number.isFinite(stageBottomOffsetRaw) ? stageBottomOffsetRaw : 0;
    const gutterR = 24;
    const trashGap = 6; // gap between the left sidebar and the trash can
    const trashToStagePad = 10; // breathing room between trash can and the stage
    const gutterL = isMobileLayout() ? 24 : Math.max(24, trashW + trashGap + trashToStagePad); // room for trash can (desktop)
    const maxW = Math.max(240, vw - leftW - rightW - gutterL - gutterR);
    // Mobile needs a little less padding to keep the model from shrinking too much
    const topPad = isMobileLayout() ? 12 : 24;
    const bottomPad = isMobileLayout() ? 12 : stageBottomOffset;
    const maxH = Math.max(240, vh - headerH - drawerH - topPad - bottomPad);
    const scale = Math.min(maxW / baseW, maxH / baseH);
    stage.style.transform = isMobileLayout()
      ? `translate(-50%, -50%) scale(${scale})`
      : `translateX(-50%) scale(${scale})`;
    stage.dataset.scale = String(scale);
  }

  function positionTrashcan() {
    if (!trashcan) return;

    const tRect = trashcan.getBoundingClientRect();

    // Mobile: put it above the drawer, near the bottom-right of the stage area.
    if (isMobileLayout()) {
      const drawerH = closetDrawer ? (closetDrawer.getBoundingClientRect().height ?? 0) : 0;
      const stageRect = stage.getBoundingClientRect();
      const pad = 10;
      const drawerTop = window.innerHeight - drawerH;
      // Keep the trashcan above the drawer, but align it closely to the bottom of the model/stage.
      const maxTop = Math.max(pad, drawerTop - tRect.height - pad);
      // Place on the left side (requested)
      const preferredLeft = stageRect.left - tRect.width - 8;
      const left = Math.round(Math.max(pad, Math.min(window.innerWidth - tRect.width - pad, preferredLeft)));
      const desiredTop = stageRect.bottom - tRect.height - 2; // small breathing room
      const top = Math.round(Math.min(maxTop, Math.max(pad, desiredTop)));
      trashcan.style.left = left + 'px';
      trashcan.style.top = top + 'px';
      return;
    }

    // Desktop: place just to the right of the left column, near the bottom.
    if (!itemsLeft) return;
    const leftRect = itemsLeft.getBoundingClientRect();
    const gap = 6;
    const bottomPad = 22;
    const left = Math.round(leftRect.right + gap);
    const top = Math.round(window.innerHeight - tRect.height - bottomPad);
    trashcan.style.left = left + 'px';
    trashcan.style.top = top + 'px';
  }

  function pointInRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function returnToHome(el) {
    const homeId = el.dataset.homeGroup;
    const home = homeId ? document.getElementById(homeId) : null;
    if (home) {
      home.appendChild(el);
    }
    // Restore tray styling (thumbnail sizing controlled by CSS).
    el.style.position = '';
    el.style.left = '';
    el.style.top = '';
    el.style.right = '';
    el.style.bottom = '';
    el.style.margin = '';
    el.style.width = '';
    el.style.height = '';
    el.style.zIndex = '';
  }

  function initModelBaseSize() {
    if (model.complete && model.naturalWidth) {
      baseW = model.naturalWidth;
      baseH = model.naturalHeight;
      // Fix the stage's logical size to the model's natural size.
      stage.style.width = baseW + 'px';
      stage.style.height = baseH + 'px';
      // Make the model fill the stage box.
      model.style.width = '100%';
      model.style.height = '100%';
      computeScale();
    }
  }

  function isMobileLayout() {
    return mqMobile ? mqMobile.matches : window.innerWidth <= 768;
  }

  function layoutCloset() {
    if (!closetDrawerContent) return;

    const groups = [
      document.getElementById('group-hats'),
      document.getElementById('group-tops'),
      document.getElementById('group-socks'),
      document.getElementById('group-fullbody'),
      document.getElementById('group-bottoms'),
    ].filter(Boolean);

    if (isMobileLayout()) {
      // Move all groups into the drawer (so they scroll together).
      groups.forEach((g) => closetDrawerContent.appendChild(g));
    } else {
      // Restore groups back to their sidebars in a deterministic order.
      const hats = document.getElementById('group-hats');
      const tops = document.getElementById('group-tops');
      const socks = document.getElementById('group-socks');
      const fullbody = document.getElementById('group-fullbody');
      const bottoms = document.getElementById('group-bottoms');

      if (itemsLeft) {
        if (hats) itemsLeft.appendChild(hats);
        if (tops) itemsLeft.appendChild(tops);
        if (socks) itemsLeft.appendChild(socks);
      }
      if (itemsRight) {
        if (fullbody) itemsRight.appendChild(fullbody);
        if (bottoms) itemsRight.appendChild(bottoms);
      }
    }
  }

  // --- Mobile drawer scrollbar (XP style) ---
  function setupDrawerScrollbar() {
    if (!drawerScrollbar || !drawerScrollbarThumb || !closetDrawer || !closetDrawerContent) return;
    if (cleanupDrawerScrollbar) cleanupDrawerScrollbar();

    const state = {
      dragging: false,
      startX: 0,
      startScrollLeft: 0,
      pointerId: null,
      trackRect: null,
      thumbW: 0,
    };

    const listeners = [];
    const addListener = (el, evt, fn, opts) => {
      if (!el) return;
      el.addEventListener(evt, fn, opts);
      listeners.push(() => el.removeEventListener(evt, fn, opts));
    };

    const minThumb = 56;

    const update = () => {
      const isMobile = isMobileLayout();
      if (!isMobile) {
        drawerScrollbar.style.display = 'none';
        return;
      }

      // Ensure we measure the real scrollable width on iOS
      const scrollW = Math.max(closetDrawer.scrollWidth, closetDrawerContent.scrollWidth);
      const clientW = closetDrawer.clientWidth;

      if (scrollW <= clientW + 1) {
        drawerScrollbar.style.display = 'none';
        return;
      }

      drawerScrollbar.style.display = 'block';

      const trackW = drawerScrollbar.clientWidth;
      const thumbW = Math.max(minThumb, Math.floor(trackW * (clientW / scrollW)));
      state.thumbW = thumbW;
      drawerScrollbarThumb.style.width = thumbW + 'px';

      const maxScroll = scrollW - clientW;
      const maxThumbX = Math.max(1, trackW - thumbW);
      const x = Math.round((closetDrawer.scrollLeft / maxScroll) * maxThumbX);
      drawerScrollbarThumb.style.left = x + 'px';
    };

    const jumpToClientX = (clientX) => {
      const scrollW = Math.max(closetDrawer.scrollWidth, closetDrawerContent.scrollWidth);
      const clientW = closetDrawer.clientWidth;
      const maxScroll = Math.max(1, scrollW - clientW);
      const trackW = drawerScrollbar.clientWidth;
      const maxThumbX = Math.max(1, trackW - state.thumbW);

      const trackRect = drawerScrollbar.getBoundingClientRect();
      const xOnTrack = clientX - trackRect.left;
      const desiredThumbLeft = xOnTrack - state.thumbW / 2;
      const thumbLeft = Math.max(0, Math.min(maxThumbX, desiredThumbLeft));
      const ratio = thumbLeft / maxThumbX;
      closetDrawer.scrollLeft = ratio * maxScroll;
    };

    // Keep thumb in sync with auto-scroll and manual scroll
    addListener(closetDrawer, 'scroll', update, { passive: true });
    addListener(window, 'resize', update);
    // Also run once after images/layout settle (fixes "scrollbar shows late" on mobile)
    addListener(window, 'load', update);
    requestAnimationFrame(() => requestAnimationFrame(update));

    const onThumbDown = (e) => {
      if (!isMobileLayout()) return;
      if (e.isPrimary === false) return;
      e.preventDefault();
      e.stopPropagation();
      state.dragging = true;
      state.pointerId = e.pointerId;
      state.startX = e.clientX;
      state.startScrollLeft = closetDrawer.scrollLeft;
      state.trackRect = drawerScrollbar.getBoundingClientRect();
      try {
        drawerScrollbarThumb.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    const onTrackDown = (e) => {
      if (!isMobileLayout()) return;
      if (e.isPrimary === false) return;
      e.preventDefault();
      e.stopPropagation();

      // Jump immediately to where the user tapped, then allow scrubbing by dragging.
      jumpToClientX(e.clientX);

      state.dragging = true;
      state.pointerId = e.pointerId;
      state.startX = e.clientX;
      state.startScrollLeft = closetDrawer.scrollLeft;
      state.trackRect = drawerScrollbar.getBoundingClientRect();
      try {
        drawerScrollbar.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    const onThumbMove = (e) => {
      if (!state.dragging) return;
      if (e.pointerId !== state.pointerId) return;
      e.preventDefault();

      const scrollW = Math.max(closetDrawer.scrollWidth, closetDrawerContent.scrollWidth);
      const clientW = closetDrawer.clientWidth;
      const maxScroll = Math.max(1, scrollW - clientW);
      const trackW = drawerScrollbar.clientWidth;
      const maxThumbX = Math.max(1, trackW - state.thumbW);

      const dx = e.clientX - state.startX;
      const scrollDx = (dx / maxThumbX) * maxScroll;
      closetDrawer.scrollLeft = state.startScrollLeft + scrollDx;
    };

    const endThumbDrag = (e) => {
      if (!state.dragging) return;
      if (e && e.pointerId !== state.pointerId) return;
      state.dragging = false;
      try {
        drawerScrollbarThumb.releasePointerCapture(state.pointerId);
        drawerScrollbar.releasePointerCapture(state.pointerId);
      } catch {
        // ignore
      }
      state.pointerId = null;
      update();
    };

    drawerScrollbarThumb.addEventListener('pointerdown', onThumbDown);
    drawerScrollbar.addEventListener('pointerdown', onTrackDown);
    drawerScrollbarThumb.addEventListener('pointermove', onThumbMove);
    drawerScrollbarThumb.addEventListener('pointerup', endThumbDrag);
    drawerScrollbarThumb.addEventListener('pointercancel', endThumbDrag);
    drawerScrollbar.addEventListener('pointermove', onThumbMove);
    drawerScrollbar.addEventListener('pointerup', endThumbDrag);
    drawerScrollbar.addEventListener('pointercancel', endThumbDrag);

    // Observe content changes so we can show the scrollbar as soon as overflow exists.
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => update());
      try {
        ro.observe(closetDrawer);
        ro.observe(closetDrawerContent);
        ro.observe(drawerScrollbar);
      } catch {
        // ignore
      }
    }

    let mo = null;
    const bindImgLoads = () => {
      closetDrawerContent.querySelectorAll('img').forEach((im) => {
        // Only bind once per element
        if (im.dataset && im.dataset.sbBound === '1') return;
        if (im.dataset) im.dataset.sbBound = '1';
        addListener(im, 'load', update, { passive: true });
        addListener(im, 'error', update, { passive: true });
      });
    };
    bindImgLoads();
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(() => {
        bindImgLoads();
        update();
      });
      try {
        mo.observe(closetDrawerContent, { childList: true, subtree: true });
      } catch {
        // ignore
      }
    }

    // Initial paint
    update();

    cleanupDrawerScrollbar = () => {
      try { ro?.disconnect(); } catch { /* ignore */ }
      try { mo?.disconnect(); } catch { /* ignore */ }
      listeners.forEach((fn) => fn());
      cleanupDrawerScrollbar = null;
    };
  }

  // --- Conveyor belt auto-scroll (infinite loop) ---
  function setupConveyors() {
    if (cleanupConveyors) cleanupConveyors();

    const prefersReducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Don't disable completely (some iPhones have Reduce Motion enabled).
    // Instead, just slow the conveyor down.
    const motionFactor = prefersReducedMotion ? 0.55 : 1;

    const pauseState = {
      leftHover: false,
      rightHover: false,
      drawerHold: false,
    };

    const listeners = [];
    const addListener = (el, evt, fn, opts) => {
      if (!el) return;
      el.addEventListener(evt, fn, opts);
      listeners.push(() => el.removeEventListener(evt, fn, opts));
    };

    const getGapPx = (el, axis) => {
      if (!el) return 0;
      const cs = getComputedStyle(el);
      if (axis === 'y') {
        const rg = parseFloat(cs.rowGap || cs.gap || '0');
        return Number.isFinite(rg) ? rg : 0;
      }
      const cg = parseFloat(cs.columnGap || cs.gap || '0');
      return Number.isFinite(cg) ? cg : 0;
    };

    // Desktop: pause on hover over each scroll column
    addListener(itemsLeft, 'mouseenter', () => (pauseState.leftHover = true));
    addListener(itemsLeft, 'mouseleave', () => (pauseState.leftHover = false));
    addListener(itemsRight, 'mouseenter', () => (pauseState.rightHover = true));
    addListener(itemsRight, 'mouseleave', () => (pauseState.rightHover = false));

    // Mobile: pause while user is touching/holding inside the drawer
    addListener(closetDrawer, 'pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.isPrimary === false) return;
      pauseState.drawerHold = true;
    });
    // Also pause while dragging the XP scrollbar thumb (it's outside the drawer to keep it static).
    addListener(drawerScrollbarThumb, 'pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.isPrimary === false) return;
      pauseState.drawerHold = true;
    });
    addListener(window, 'pointerup', () => (pauseState.drawerHold = false));
    addListener(window, 'pointercancel', () => (pauseState.drawerHold = false));

    // Speeds (px/sec): tuned to be visible but still slow
    const SPEED_DESKTOP = 30 * motionFactor; // vertical
    const SPEED_MOBILE = 22 * motionFactor; // horizontal

    let raf = 0;
    let lastT = performance.now();

    const stepVertical = (container, dir, px) => {
      if (!container) return;
      if (container.scrollHeight <= container.clientHeight + 1) return;

      const gap = getGapPx(container, 'y');

      if (dir > 0) {
        // Scroll down (content moves up visually)
        container.scrollTop += px;
        // move first -> last when it fully scrolls out
        while (container.firstElementChild) {
          const first = container.firstElementChild;
          const h = first.getBoundingClientRect().height;
          const step = h + gap;
          if (container.scrollTop < step) break;
          container.appendChild(first);
          container.scrollTop -= step;
        }
      } else {
        // Scroll up (content moves down visually) and loop by prepending last -> first.
        // Ensure there is room to scroll up by prepending last item when near the top.
        while (container.lastElementChild && container.scrollTop <= px + 1) {
          const last = container.lastElementChild;
          const h = last.getBoundingClientRect().height;
          const step = h + gap;
          container.insertBefore(last, container.firstElementChild);
          container.scrollTop += step;
        }
        container.scrollTop -= px;
      }
    };

    const stepHorizontal = (scrollEl, contentEl, px) => {
      if (!scrollEl || !contentEl) return;
      const scrollableW = Math.max(scrollEl.scrollWidth, contentEl.scrollWidth);
      if (scrollableW <= scrollEl.clientWidth + 1) return;

      const gap = getGapPx(contentEl, 'x');
      scrollEl.scrollLeft += px;

      while (contentEl.firstElementChild) {
        const first = contentEl.firstElementChild;
        const w = first.getBoundingClientRect().width;
        const step = w + gap;
        if (scrollEl.scrollLeft < step) break;
        contentEl.appendChild(first);
        scrollEl.scrollLeft -= step;
      }
    };

    const tick = (t) => {
      const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
      lastT = t;

      const desktopPaused =
        isDragging || pauseState.leftHover || pauseState.rightHover;
      const mobilePaused = isDragging || pauseState.drawerHold;

      if (!isMobileLayout()) {
        if (!desktopPaused) {
          // Desktop requirement:
          // - left column items move top -> bottom (use scroll-up loop)
          // - right column items move bottom -> top (use scroll-down loop)
          stepVertical(itemsLeft, -1, SPEED_DESKTOP * dt);
          stepVertical(itemsRight, +1, SPEED_DESKTOP * dt);
        }
      } else {
        if (!mobilePaused) {
          // mobile drawer: right-to-left (increase scrollLeft)
          stepHorizontal(closetDrawer, closetDrawerContent, SPEED_MOBILE * dt);
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame((t) => {
      lastT = t;
      tick(t);
    });

    cleanupConveyors = () => {
      if (raf) cancelAnimationFrame(raf);
      listeners.forEach((fn) => fn());
      cleanupConveyors = null;
    };
  }

  // --- Drag logic (stage-aware, scale-aware) ---
  function makeDraggable(el) {
    el.addEventListener('pointerdown', (event) => {
      // left-click only for mouse, primary touch only
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.isPrimary === false) return;

      event.preventDefault();
      isDragging = true;
      el.ondragstart = () => false; // disable native drag ghost

      // Record where this item should go back to when "trashed".
      if (!el.dataset.homeGroup && el.parentElement && el.parentElement.id) {
        el.dataset.homeGroup = el.parentElement.id;
      }

      const rect = el.getBoundingClientRect();
      // Use fractional offset so it stays consistent when the element's size changes
      const fx = (event.clientX - rect.left) / rect.width;
      const fy = (event.clientY - rect.top) / rect.height;

      // Ensure we know the intrinsic display size to use inside the stage
      const naturalW = el.naturalWidth || rect.width;
      const naturalH = el.naturalHeight || rect.height;
      const scaleMultRaw = parseFloat(el.dataset.scale || '1');
      const scaleMult = Number.isFinite(scaleMultRaw) && scaleMultRaw > 0 ? scaleMultRaw : 1;

      // Persist the scaled base size so repeated drags don't jitter.
      if (!el.dataset.baseW) {
        el.dataset.baseW = String(naturalW * scaleMult);
        el.dataset.baseH = String(naturalH * scaleMult);
      }
      const baseElW = parseFloat(el.dataset.baseW);
      const baseElH = parseFloat(el.dataset.baseH);

      // If the element isn't yet in the stage, move it there after measurement
      if (!stage.contains(el)) {
        // Preserve pixel clarity inside the stage by using intrinsic size
        el.style.width = baseElW + 'px';
        el.style.height = baseElH + 'px';
        stage.appendChild(el);
      }

      el.style.position = 'absolute';
      el.style.margin = '0';
      el.style.bottom = '';
      el.style.right = '';
      el.style.zIndex = (++zIndexCounter).toString();

      const moveAt = (clientX, clientY) => {
        const stageRect = stage.getBoundingClientRect();
        const s = parseFloat(stage.dataset.scale || '1');
        // pointer position in stage's logical coordinate system
        const xStage = (clientX - stageRect.left) / s;
        const yStage = (clientY - stageRect.top) / s;
        el.style.left = (xStage - fx * baseElW) + 'px';
        el.style.top  = (yStage - fy * baseElH) + 'px';
      };

      moveAt(event.clientX, event.clientY);

      let lastX = event.clientX;
      let lastY = event.clientY;

      // Desktop mouse: keep the old feel (document-level listeners).
      if (event.pointerType === 'mouse') {
        const pointerId = event.pointerId;
        const onPointerMoveWin = (e) => {
          if (e.pointerId !== pointerId) return;
          lastX = e.clientX;
          lastY = e.clientY;
          moveAt(e.clientX, e.clientY);
          if (trashcan) {
            const over = pointInRect(e.clientX, e.clientY, trashcan.getBoundingClientRect());
            trashcan.classList.toggle('is-active', over);
          }
        };
        const endDragWin = (e) => {
          if (e && e.pointerId !== pointerId) return;
          window.removeEventListener('pointermove', onPointerMoveWin);
          window.removeEventListener('pointerup', endDragWin);
          window.removeEventListener('pointercancel', endDragWin);
          isDragging = false;
          if (trashcan) {
            const over = pointInRect(lastX, lastY, trashcan.getBoundingClientRect());
            trashcan.classList.remove('is-active');
            if (over && stage.contains(el)) {
              returnToHome(el);
            }
          }
        };

        window.addEventListener('pointermove', onPointerMoveWin);
        window.addEventListener('pointerup', endDragWin);
        window.addEventListener('pointercancel', endDragWin);
        return;
      }

      // Touch/pen: Pointer Events + capture so drag continues even if finger leaves the element.
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        // ignore if unsupported
      }

      const onPointerMove = (e) => {
        if (e.pointerId !== event.pointerId) return;
        lastX = e.clientX;
        lastY = e.clientY;
        moveAt(e.clientX, e.clientY);
        if (trashcan) {
          const over = pointInRect(e.clientX, e.clientY, trashcan.getBoundingClientRect());
          trashcan.classList.toggle('is-active', over);
        }
      };
      const endDrag = (e) => {
        if (e && e.pointerId !== event.pointerId) return;
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerup', endDrag);
        el.removeEventListener('pointercancel', endDrag);
        isDragging = false;
        if (trashcan) {
          const over = pointInRect(lastX, lastY, trashcan.getBoundingClientRect());
          trashcan.classList.remove('is-active');
          if (over && stage.contains(el)) {
            returnToHome(el);
            // Play "trash" sound on successful removal (release over trashcan)
            try {
              const a = new Audio('audio/trashsound.mp3');
              a.preload = 'auto';
              a.volume = 0.9;
              const p = a.play();
              if (p && typeof p.catch === 'function') p.catch(() => {});
            } catch {
              // ignore
            }
          }
        }
        try {
          el.releasePointerCapture(event.pointerId);
        } catch {
          // ignore
        }
      };

      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', endDrag);
      el.addEventListener('pointercancel', endDrag);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    // ---- Global click/tap SFX ----
    // Use Web Audio when possible (more reliable for "play on release" on mobile Safari).
    const makeAudioState = () => {
      const html = {
        click: new Audio('audio/mouseclick.mp3'),
        trash: new Audio('audio/trashsound.mp3'),
      };
      html.click.preload = 'auto';
      html.trash.preload = 'auto';
      html.click.volume = 0.85;
      html.trash.volume = 0.9;

      const st = {
        ctx: null,
        buffers: {},
        loading: false,
        ensured: false,
        primed: false,
      };

      // Prime individual HTMLAudio elements so later play() calls work reliably on iOS/Safari.
      // Do this during a user gesture (pointerdown).
      const primeHtml = () => {
        if (st.primed) return;
        st.primed = true;
        ['click', 'trash'].forEach((k) => {
          const a = html[k];
          if (!a) return;
          const prevMuted = a.muted;
          const prevVol = a.volume;
          try {
            a.muted = true;
            a.volume = 0;
            const p = a.play();
            // Stop immediately; the goal is just to satisfy gesture gating.
            try { a.pause(); } catch { /* ignore */ }
            try { a.currentTime = 0; } catch { /* ignore */ }
            if (p && typeof p.catch === 'function') p.catch(() => {});
          } catch {
            // ignore
          } finally {
            a.muted = prevMuted;
            a.volume = prevVol;
          }
        });
      };

      const ensure = async () => {
        if (st.ensured) return;
        st.ensured = true;
        // Prime HTML audio immediately (gesture safe)
        primeHtml();

        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          st.ctx = new Ctx();
          // Some browsers require resume() from a gesture
          if (st.ctx.state === 'suspended') {
            try { await st.ctx.resume(); } catch { /* ignore */ }
          }

          if (st.loading) return;
          st.loading = true;

          const loadBuffer = async (name, url) => {
            const res = await fetch(url);
            const ab = await res.arrayBuffer();
            const buf = await st.ctx.decodeAudioData(ab);
            st.buffers[name] = buf;
          };

          await Promise.allSettled([
            loadBuffer('click', 'audio/mouseclick.mp3'),
            loadBuffer('trash', 'audio/trashsound.mp3'),
          ]);
        } catch {
          // fall back to HTMLAudioElement
        }
      };

      const play = (name) => {
        const buf = st.buffers[name];
        if (st.ctx && buf) {
          try {
            const src = st.ctx.createBufferSource();
            src.buffer = buf;
            const gain = st.ctx.createGain();
            gain.gain.value = name === 'trash' ? 0.9 : 0.85;
            src.connect(gain);
            gain.connect(st.ctx.destination);
            src.start(0);
            return;
          } catch {
            // fall back
          }
        }

        const a = html[name];
        if (!a) return;
        try { a.currentTime = 0; } catch { /* ignore */ }
        const p = a.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      };

      return { ensure, play };
    };

    audioState = makeAudioState();

    document.addEventListener(
      'pointerdown',
      (e) => {
        // left click for mouse; primary touch only
        if (e.isPrimary === false) return;
        if (e.pointerType === 'mouse' && typeof e.button === 'number' && e.button !== 0) return;
        audioState?.ensure?.();
        audioState?.play?.('click');
      },
      { capture: true },
    );

    // ---- Info modal wiring ----
    let lastFocusedEl = null;
    const openInfo = () => {
      if (!infoModal) return;
      lastFocusedEl = document.activeElement;
      infoModal.hidden = false;
      // focus close button for accessibility
      setTimeout(() => infoModalClose?.focus(), 0);
    };
    const closeInfo = () => {
      if (!infoModal) return;
      infoModal.hidden = true;
      if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
        lastFocusedEl.focus();
      }
    };

    infoButton?.addEventListener('click', openInfo);
    infoModalClose?.addEventListener('click', closeInfo);
    infoModal?.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t instanceof HTMLElement && t.dataset.close === 'true') {
        closeInfo();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && infoModal && infoModal.hidden === false) {
        closeInfo();
      }
    });

    const refreshLayout = () => {
      layoutCloset();
      computeScale();
      positionTrashcan();
      setupConveyors();
      setupDrawerScrollbar();
    };

    refreshLayout();
    window.addEventListener('resize', refreshLayout);
    // Handle bfcache restores (common on iOS): recalc positions + scrollbar immediately.
    window.addEventListener('pageshow', () => {
      requestAnimationFrame(() => requestAnimationFrame(refreshLayout));
    });

    if (!model.complete) {
      model.addEventListener('load', () => {
        initModelBaseSize();
        computeScale();
        positionTrashcan();
      });
    } else {
      initModelBaseSize();
      // When cached, initModelBaseSize runs immediately; ensure trashcan repositions too.
      positionTrashcan();
    }

    // Ensure every item knows its "home" group (for returning from the stage).
    document.querySelectorAll('.draggable').forEach((img) => {
      if (!img.dataset.homeGroup && img.parentElement && img.parentElement.id) {
        img.dataset.homeGroup = img.parentElement.id;
      }
    });

    document.querySelectorAll('.draggable').forEach(makeDraggable);
  });
})();
