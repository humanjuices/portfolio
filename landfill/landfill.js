(() => {
  const logo = document.getElementById('dvd-logo');
  const stage = document.querySelector('.landfill');
  if (!(logo instanceof HTMLImageElement) || !(stage instanceof HTMLElement)) return;

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Random initial velocity (px/sec)
  const randSign = () => (Math.random() < 0.5 ? -1 : 1);
  const randRange = (min, max) => min + Math.random() * (max - min);

  const state = {
    x: 0,
    y: 0,
    vx: randSign() * randRange(120, 190),
    vy: randSign() * randRange(120, 190),
    w: 0,
    h: 0,
    raf: 0,
    lastT: performance.now(),
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const measure = () => {
    const r = logo.getBoundingClientRect();
    state.w = r.width;
    state.h = r.height;

    const bounds = stage.getBoundingClientRect();
    const maxX = Math.max(0, bounds.width - state.w);
    const maxY = Math.max(0, bounds.height - state.h);
    state.x = clamp(state.x, 0, maxX);
    state.y = clamp(state.y, 0, maxY);
  };

  const tick = (t) => {
    const dt = Math.min(0.05, Math.max(0, (t - state.lastT) / 1000));
    state.lastT = t;

    const bounds = stage.getBoundingClientRect();
    const maxX = Math.max(0, bounds.width - state.w);
    const maxY = Math.max(0, bounds.height - state.h);

    state.x += state.vx * dt;
    state.y += state.vy * dt;

    // Bounce on edges
    if (state.x <= 0) {
      state.x = 0;
      state.vx = Math.abs(state.vx);
    } else if (state.x >= maxX) {
      state.x = maxX;
      state.vx = -Math.abs(state.vx);
    }

    if (state.y <= 0) {
      state.y = 0;
      state.vy = Math.abs(state.vy);
    } else if (state.y >= maxY) {
      state.y = maxY;
      state.vy = -Math.abs(state.vy);
    }

    logo.style.transform = `translate(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px)`;
    state.raf = requestAnimationFrame(tick);
  };

  const start = () => {
    measure();

    // Start somewhere random inside bounds
    const bounds = stage.getBoundingClientRect();
    const maxX = Math.max(0, bounds.width - state.w);
    const maxY = Math.max(0, bounds.height - state.h);
    state.x = Math.random() * maxX;
    state.y = Math.random() * maxY;
    logo.style.transform = `translate(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px)`;

    state.lastT = performance.now();
    state.raf = requestAnimationFrame(tick);
  };

  const onResize = () => {
    measure();
  };

  window.addEventListener('resize', onResize);

  if (logo.complete) {
    // Wait one frame so layout settles with the chosen responsive width.
    requestAnimationFrame(start);
  } else {
    logo.addEventListener('load', () => requestAnimationFrame(start), { once: true });
  }
})();

