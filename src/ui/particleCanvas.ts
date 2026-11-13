// Лёгкий Canvas-оверлей эффектов частиц: осколки, искры и конфетти (Story 2.4).
import type { AnimationSpeed } from '../engine/types';

/** Поддерживаемые типы эффектов частиц. */
export type ParticleEffectKind =
  | 'shatter'
  | 'scroll'
  | 'celestial'
  | 'rune'
  | 'confetti';

/** Настройки единичного выброса частиц. */
export interface ParticleBurstOptions {
  /** Переопределение количества частиц. */
  count?: number;
  /** Множитель радиуса и скорости разлёта (по умолчанию 1). */
  intensity?: number;
}

/** Параметры инициализации Canvas-оверлея частиц. */
export interface ParticleCanvasOptions {
  /** Контейнер сцены, поверх которого накладывается слой частиц. */
  container: HTMLElement;
  /** Использовать position: fixed (на весь viewport) вместо absolute внутри контейнера. */
  fixed?: boolean;
  /** Скорость анимации (0.5 | 1 | 2 | 4) или её геттер. */
  speed?: AnimationSpeed | (() => AnimationSpeed);
  /** Переопределение reduced-motion (для тестов и настроек доступности). */
  reducedMotion?: boolean | (() => boolean);
  /** Инъекция часов (мс) для детерминированных тестов. */
  now?: () => number;
  /** Инъекция планировщика кадров. */
  requestFrame?: (cb: FrameRequestCallback) => number;
  /** Инъекция отмены кадра. */
  cancelFrame?: (id: number) => void;
}

/** Публичный интерфейс контроллера Canvas-частиц. */
export interface ParticleCanvasController {
  /** Запускает всплеск частиц в координатах (x, y) относительно контейнера. */
  emit(
    kind: ParticleEffectKind,
    x: number,
    y: number,
    opts?: ParticleBurstOptions,
  ): void;
  /** Запускает всплеск частиц из центра целевого DOM-элемента. */
  emitAtElement(
    kind: ParticleEffectKind,
    target: HTMLElement | null | undefined,
    opts?: ParticleBurstOptions,
  ): void;
  /** Запускает победное конфетти по области сцены. */
  emitConfetti(opts?: ParticleBurstOptions): void;
  /** Возвращает количество активных частиц в данный момент. */
  getActiveCount(): number;
  /** Пересчитывает размеры canvas с учётом DPR <= 2. */
  resize(): void;
  /** Немедленно очищает все частицы и останавливает rAF. */
  clear(): void;
  /** Останавливает цикл, снимает слушатели и удаляет canvas из DOM. */
  destroy(): void;
  /** Корневой элемент canvas. */
  readonly element: HTMLCanvasElement;
}

type ParticleShape = 'shard' | 'spark' | 'confetti';

interface Particle {
  shape: ParticleShape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  size: number;
  aspect: number;
  rotation: number;
  vr: number;
  age: number;
  life: number;
  color: string;
}

const PALETTES: Record<ParticleEffectKind, readonly string[]> = {
  shatter: ['#ffffff', '#e2f3ff', '#8ad4ff', '#4fa3e3'],
  scroll: ['#e0aaff', '#c77dff', '#9d4edd', '#f4c552'],
  celestial: ['#e7f5ff', '#5ce1e6', '#4dabf7', '#a5f3fc'],
  rune: ['#fff3bf', '#38d9a9', '#748ffc', '#63e6be'],
  confetti: ['#f4c552', '#ff595e', '#3b82f6', '#22c55e', '#c77dff', '#ffffff'],
};

const DEFAULT_COUNTS: Record<ParticleEffectKind, number> = {
  shatter: 22,
  scroll: 18,
  celestial: 20,
  rune: 22,
  confetti: 48,
};

function normalizeSpeed(speed: AnimationSpeed | number | undefined): AnimationSpeed {
  if (speed === 0.5 || speed === 1 || speed === 2 || speed === 4) {
    return speed;
  }
  return 1;
}

/**
 * Создаёт неинтерактивный Canvas-оверлей для частиц разрушения, магии и победы
 * с ленивым rAF-циклом, поддержкой HiDPI (DPR <= 2) и безопасным no-op в jsdom.
 */
export function createParticleCanvas(
  options: ParticleCanvasOptions,
): ParticleCanvasController {
  const { container, fixed = false } = options;

  const getNow =
    options.now ??
    (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const reqFrame =
    options.requestFrame ??
    ((cb: FrameRequestCallback) => window.requestAnimationFrame(cb));
  const cancelReqFrame =
    options.cancelFrame ??
    ((id: number) => window.cancelAnimationFrame(id));

  const getSpeed = (): AnimationSpeed => {
    const raw = typeof options.speed === 'function' ? options.speed() : options.speed;
    return normalizeSpeed(raw);
  };

  const mql =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  const isReducedMotion = (): boolean => {
    if (typeof options.reducedMotion === 'function') {
      return options.reducedMotion();
    }
    if (typeof options.reducedMotion === 'boolean') {
      return options.reducedMotion;
    }
    return Boolean(mql?.matches);
  };

  // Настраиваем position контейнера, если оверлей не fixed и контейнер static
  const hadInlinePosition = container.style.position;
  let adjustedContainerPosition = false;
  if (!fixed) {
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      const computedPos = window.getComputedStyle(container).position;
      if (!computedPos || computedPos === 'static') {
        container.style.position = 'relative';
        adjustedContainerPosition = true;
      }
    } else if (!container.style.position) {
      container.style.position = 'relative';
      adjustedContainerPosition = true;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'fx-particle-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.position = fixed ? 'fixed' : 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '40';

  container.append(canvas);

  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }

  let widthCss = 720;
  let heightCss = 1280;
  let dpr = 1;
  const particles: Particle[] = [];
  let rafId: number | null = null;
  let lastTs: number | null = null;
  let destroyed = false;
  let rngSeed = 1;

  // Лёгкий быстрый PRNG, чтобы частицы не зависели от внешнего состояния
  const nextRand = (): number => {
    rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0;
    return rngSeed / 4294967296;
  };

  const stopLoop = (): void => {
    if (rafId !== null) {
      cancelReqFrame(rafId);
      rafId = null;
    }
    lastTs = null;
  };

  const clearCanvasPixels = (): void => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const resize = (): void => {
    if (destroyed) return;
    if (fixed && typeof window !== 'undefined') {
      widthCss = Math.max(1, window.innerWidth || 720);
      heightCss = Math.max(1, window.innerHeight || 1280);
    } else {
      const rect = container.getBoundingClientRect();
      widthCss = rect.width > 1 ? rect.width : 720;
      heightCss = rect.height > 1 ? rect.height : 1280;
    }
    dpr =
      typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
        ? Math.min(2, Math.max(1, window.devicePixelRatio))
        : 1;
    canvas.width = Math.max(1, Math.round(widthCss * dpr));
    canvas.height = Math.max(1, Math.round(heightCss * dpr));
  };

  const drawParticle = (c: CanvasRenderingContext2D, p: Particle, alpha: number): void => {
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = p.color;
    c.translate(p.x, p.y);
    c.rotate(p.rotation);

    if (p.shape === 'confetti') {
      c.fillRect(-p.size * 0.5, -p.size * p.aspect * 0.5, p.size, p.size * p.aspect);
    } else if (p.shape === 'shard') {
      // Угловатый кристальный осколок
      c.beginPath();
      c.moveTo(0, -p.size);
      c.lineTo(p.size * 0.7, p.size * 0.2);
      c.lineTo(-p.size * 0.2, p.size * 0.9);
      c.lineTo(-p.size * 0.75, -p.size * 0.1);
      c.closePath();
      c.fill();
    } else {
      // Сияющая магическая искра
      c.beginPath();
      c.arc(0, 0, p.size * 0.55, 0, Math.PI * 2);
      c.fill();
    }

    c.restore();
  };

  const tick = (timestamp: number): void => {
    rafId = null;
    if (destroyed || !ctx) return;

    if (isReducedMotion()) {
      particles.length = 0;
      clearCanvasPixels();
      stopLoop();
      return;
    }

    const prev = lastTs ?? timestamp;
    lastTs = timestamp;
    const rawDt = Math.max(0, Math.min(0.05, (timestamp - prev) / 1000));
    const dt = (rawDt > 0 ? rawDt : 1 / 60) * Math.min(2.5, getSpeed());

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }

      const dragFactor = Math.exp(-p.drag * dt);
      p.vx *= dragFactor;
      p.vy = p.vy * dragFactor + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vr * dt;

      const t = p.age / p.life;
      const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      if (alpha > 0.01) {
        drawParticle(ctx, p, Math.max(0, Math.min(1, alpha)));
      }
    }

    ctx.restore();

    if (particles.length > 0) {
      rafId = reqFrame(tick);
    } else {
      clearCanvasPixels();
      lastTs = null;
    }
  };

  const ensureLoop = (): void => {
    if (destroyed || !ctx || rafId !== null || particles.length === 0) return;
    lastTs = getNow();
    rafId = reqFrame(tick);
  };

  const spawnBurst = (
    kind: ParticleEffectKind,
    originX: number,
    originY: number,
    opts?: ParticleBurstOptions,
  ): void => {
    // Без 2D-контекста или в reduced-motion — безопасный no-op
    if (destroyed || !ctx || isReducedMotion()) return;

    const palette = PALETTES[kind];
    const count = Math.max(1, Math.round(opts?.count ?? DEFAULT_COUNTS[kind]));
    const power = Math.max(0.2, opts?.intensity ?? 1);

    for (let i = 0; i < count; i++) {
      const angle =
        kind === 'confetti'
          ? Math.PI * 0.5 + (nextRand() - 0.5) * 1.15
          : nextRand() * Math.PI * 2;
      const color = palette[i % palette.length];

      if (kind === 'shatter') {
        const speedVal = (90 + nextRand() * 210) * power;
        particles.push({
          shape: 'shard',
          x: originX + (nextRand() - 0.5) * 32,
          y: originY + (nextRand() - 0.5) * 44,
          vx: Math.cos(angle) * speedVal,
          vy: Math.sin(angle) * speedVal - 95 * power,
          gravity: 540,
          drag: 1.6,
          size: 5 + nextRand() * 6,
          aspect: 1,
          rotation: nextRand() * Math.PI * 2,
          vr: (nextRand() - 0.5) * 12,
          age: 0,
          life: 0.45 + nextRand() * 0.35,
          color,
        });
      } else if (kind === 'confetti') {
        const speedVal = (110 + nextRand() * 220) * power;
        particles.push({
          shape: 'confetti',
          x: originX + (nextRand() - 0.5) * widthCss * 0.85,
          y: originY + (nextRand() - 0.5) * 36,
          vx: (nextRand() - 0.5) * 180 * power,
          vy: Math.sin(angle) * speedVal * 0.55 - 40,
          gravity: 240,
          drag: 1.4,
          size: 7 + nextRand() * 5,
          aspect: 0.45 + nextRand() * 0.35,
          rotation: nextRand() * Math.PI * 2,
          vr: (nextRand() - 0.5) * 9,
          age: 0,
          life: 1.3 + nextRand() * 0.9,
          color,
        });
      } else {
        // Магические искры Свитков, Сфер и Рун
        const speedVal = (65 + nextRand() * 175) * power;
        particles.push({
          shape: 'spark',
          x: originX + (nextRand() - 0.5) * 26,
          y: originY + (nextRand() - 0.5) * 26,
          vx: Math.cos(angle) * speedVal,
          vy: Math.sin(angle) * speedVal - 45 * power,
          gravity: kind === 'celestial' ? -25 : 40,
          drag: 2.2,
          size: 4.5 + nextRand() * 4.5,
          aspect: 1,
          rotation: 0,
          vr: 0,
          age: 0,
          life: 0.42 + nextRand() * 0.34,
          color,
        });
      }
    }

    ensureLoop();
  };

  const emit = (
    kind: ParticleEffectKind,
    x: number,
    y: number,
    opts?: ParticleBurstOptions,
  ): void => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (kind === 'confetti') {
      spawnBurst('confetti', x, y, opts);
      return;
    }
    spawnBurst(kind, x, y, opts);
  };

  const emitAtElement = (
    kind: ParticleEffectKind,
    target: HTMLElement | null | undefined,
    opts?: ParticleBurstOptions,
  ): void => {
    if (!target || destroyed) return;
    const baseRect = fixed
      ? { left: 0, top: 0, width: widthCss, height: heightCss }
      : container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const cx =
      targetRect.width > 0
        ? targetRect.left - baseRect.left + targetRect.width * 0.5
        : widthCss * 0.5;
    const cy =
      targetRect.height > 0
        ? targetRect.top - baseRect.top + targetRect.height * 0.5
        : heightCss * 0.5;

    emit(kind, cx, cy, opts);
  };

  const emitConfetti = (opts?: ParticleBurstOptions): void => {
    resize();
    spawnBurst('confetti', widthCss * 0.5, heightCss * 0.16, opts);
  };

  const clear = (): void => {
    particles.length = 0;
    stopLoop();
    clearCanvasPixels();
  };

  const handleResize = (): void => {
    resize();
  };

  const handleMotionChange = (): void => {
    if (isReducedMotion()) {
      clear();
    }
  };

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver === 'function' && !fixed) {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize);
  }
  mql?.addEventListener?.('change', handleMotionChange);

  resize();

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    clear();
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
    }
    mql?.removeEventListener?.('change', handleMotionChange);
    canvas.remove();
    if (adjustedContainerPosition) {
      container.style.position = hadInlinePosition;
    }
  };

  return {
    emit,
    emitAtElement,
    emitConfetti,
    getActiveCount: () => particles.length,
    resize,
    clear,
    destroy,
    element: canvas,
  };
}
