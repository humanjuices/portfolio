(() => {
  const logo = document.getElementById('dvd-logo');
  const stage = document.querySelector('.landfill');
  if (!(stage instanceof HTMLElement)) return;
  if (!(logo instanceof HTMLImageElement)) return;

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Random initial velocity (px/sec)
  const randSign = () => (Math.random() < 0.5 ? -1 : 1);
  const randRange = (min, max) => min + Math.random() * (max - min);

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const sprite = {
    el: logo,
    x: 0,
    y: 0,
    vx: randSign() * randRange(120, 190),
    vy: randSign() * randRange(120, 190),
    w: 0,
    h: 0,
  };

  const measure = () => {
    const bounds = stage.getBoundingClientRect();
    const r = sprite.el.getBoundingClientRect();
    sprite.w = r.width;
    sprite.h = r.height;
    const maxX = Math.max(0, bounds.width - sprite.w);
    const maxY = Math.max(0, bounds.height - sprite.h);
    sprite.x = clamp(sprite.x, 0, maxX);
    sprite.y = clamp(sprite.y, 0, maxY);
  };

  let raf = 0;
  let lastT = performance.now();

  const tick = (t) => {
    const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
    lastT = t;

    const bounds = stage.getBoundingClientRect();
    const maxX = Math.max(0, bounds.width - sprite.w);
    const maxY = Math.max(0, bounds.height - sprite.h);

    sprite.x += sprite.vx * dt;
    sprite.y += sprite.vy * dt;

    // Bounce on edges
    if (sprite.x <= 0) {
      sprite.x = 0;
      sprite.vx = Math.abs(sprite.vx);
    } else if (sprite.x >= maxX) {
      sprite.x = maxX;
      sprite.vx = -Math.abs(sprite.vx);
    }

    if (sprite.y <= 0) {
      sprite.y = 0;
      sprite.vy = Math.abs(sprite.vy);
    } else if (sprite.y >= maxY) {
      sprite.y = maxY;
      sprite.vy = -Math.abs(sprite.vy);
    }

    sprite.el.style.transform = `translate(${sprite.x.toFixed(2)}px, ${sprite.y.toFixed(2)}px)`;

    raf = requestAnimationFrame(tick);
  };

  const start = () => {
    measure();

    const bounds = stage.getBoundingClientRect();
    // Start somewhere random inside bounds
    const maxX = Math.max(0, bounds.width - sprite.w);
    const maxY = Math.max(0, bounds.height - sprite.h);
    sprite.x = Math.random() * maxX;
    sprite.y = Math.random() * maxY;
    sprite.el.style.transform = `translate(${sprite.x.toFixed(2)}px, ${sprite.y.toFixed(2)}px)`;

    lastT = performance.now();
    raf = requestAnimationFrame(tick);
  };

  const onResize = () => {
    measure();
  };

  window.addEventListener('resize', onResize);

  const whenReady = () => requestAnimationFrame(start);
  if (logo.complete) {
    // Wait one frame so layout settles with the chosen responsive width.
    whenReady();
  } else {
    logo.addEventListener('load', whenReady, { once: true });
  }
})();

