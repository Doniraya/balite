// Расчёт интенсивности и контроллер эффекта пламени для блока Сила × Множ (Story 2.3).

/** Параметры инициализации контроллера пламени. */
export interface ScoreFlameOptions {
  /** Контейнер блока Сила × Множ (например, .hud-formula). */
  container: HTMLElement;
  /** Опциональный элемент плитки «Сила» для привязки синего пламени. */
  chipsAnchor?: HTMLElement | null;
  /** Опциональный элемент плитки «Множ» для привязки красно-золотого пламени. */
  multAnchor?: HTMLElement | null;
  /** Переопределение reduced-motion (для тестов и настроек доступности). */
  reducedMotion?: boolean | (() => boolean);
  /** Инъекция часов (мс) для детерминированных тестов. */
  now?: () => number;
  /** Инъекция планировщика кадров для детерминированных тестов. */
  requestFrame?: (cb: FrameRequestCallback) => number;
  /** Инъекция отмены кадра для детерминированных тестов. */
  cancelFrame?: (id: number) => void;
}

/** Публичный интерфейс управления эффектом пламени. */
export interface ScoreFlameController {
  /** Задаёт целевую интенсивность пламени в диапазоне [0..1]. */
  setIntensity(intensity: number): void;
  /** Возвращает текущую отображаемую интенсивность в диапазоне [0..1]. */
  getIntensity(): number;
  /** Пересчитывает геометрию canvas и зон Сила / Множ. */
  resize(): void;
  /** Останавливает анимацию, отписывается от слушателей и удаляет DOM-слой. */
  destroy(): void;
  /** Корневой неинтерактивный элемент оверлея пламени. */
  readonly element: HTMLElement;
}

type FlameSide = 'chips' | 'mult';

interface FlamePalette {
  outer: string;
  inner: string;
  core: string;
}

interface FlameZone {
  side: FlameSide;
  xCenter: number;
  width: number;
  palette: FlamePalette;
}

interface FlameParticle {
  side: FlameSide;
  /** Нормализованное смещение по ширине зоны [-0.5..0.5]. */
  xOffset: number;
  /** Фаза подъёма [0..1), 0 — у основания плитки, 1 — растворение сверху. */
  progress: number;
  /** Скорость подъёма (фаза/сек). */
  speed: number;
  /** Базовый радиус язычка (CSS px). */
  radius: number;
  /** Фаза горизонтального колыхания (рад). */
  swayPhase: number;
  /** Амплитуда колыхания (CSS px). */
  swayAmp: number;
}

const PALETTES: Record<FlameSide, FlamePalette> = {
  chips: {
    outer: 'rgba(47, 125, 255, 0.72)',
    inner: 'rgba(121, 200, 255, 0.85)',
    core: 'rgba(255, 232, 158, 0.78)',
  },
  mult: {
    outer: 'rgba(255, 69, 58, 0.76)',
    inner: 'rgba(255, 146, 60, 0.88)',
    core: 'rgba(255, 224, 120, 0.84)',
  },
};

const OVERLAY_PAD_TOP = 22;
const OVERLAY_PAD_X = 8;
const OVERLAY_PAD_BOTTOM = 4;
const PARTICLES_PER_SIDE = 16;
const STOP_THRESHOLD = 0.005;

/**
 * Вычисляет целевую интенсивность пламени [0..1] при приближении или пробитии порога раунда.
 * При неактивном подсчёте (handChips <= 0 или handMult <= 0) либо недоборе порога возвращает 0.
 */
export function computeScoreFlameIntensity(
  currentScore: number,
  handChips: number,
  handMult: number,
  targetScore: number,
): number {
  if (
    !Number.isFinite(currentScore) ||
    !Number.isFinite(handChips) ||
    !Number.isFinite(handMult) ||
    !Number.isFinite(targetScore)
  ) {
    return 0;
  }

  if (handChips <= 0 || handMult <= 0 || targetScore <= 0) {
    return 0;
  }

  const projectedScore = Math.max(0, currentScore) + handChips * handMult;
  if (projectedScore < targetScore) {
    return 0;
  }

  // На границе порога пламя заметно зажигается (0.25) и плавно насыщается к 1 с ростом запаса
  const ratio = projectedScore / targetScore;
  const excess = Math.log10(Math.max(1, ratio));
  const raw = 0.25 + 0.75 * (1 - Math.exp(-excess * 1.4));
  return Math.max(0.25, Math.min(1, raw));
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function createParticlePool(): FlameParticle[] {
  const pool: FlameParticle[] = [];
  const sides: FlameSide[] = ['chips', 'mult'];

  for (const side of sides) {
    for (let i = 0; i < PARTICLES_PER_SIDE; i++) {
      // Детерминированное распределение параметров по индексу без скачков при старте
      const t = i / PARTICLES_PER_SIDE;
      const spread = ((i * 7) % PARTICLES_PER_SIDE) / (PARTICLES_PER_SIDE - 1) - 0.5;
      pool.push({
        side,
        xOffset: spread * 0.86,
        progress: t,
        speed: 0.95 + ((i * 3) % 5) * 0.16,
        radius: 7 + ((i * 5) % 7),
        swayPhase: i * 1.37,
        swayAmp: 2.6 + (i % 3) * 1.3,
      });
    }
  }

  return pool;
}

/**
 * Создаёт неинтерактивный слой пламени для блока Сила × Множ с плавным rAF-циклом
 * и статичным мягким свечением в режиме prefers-reduced-motion: reduce.
 */
export function createScoreFlame(options: ScoreFlameOptions): ScoreFlameController {
  const { container, chipsAnchor = null, multAnchor = null } = options;

  const getNow =
    options.now ??
    (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const reqFrame =
    options.requestFrame ??
    ((cb: FrameRequestCallback) => window.requestAnimationFrame(cb));
  const cancelReqFrame =
    options.cancelFrame ??
    ((id: number) => window.cancelAnimationFrame(id));

  // Запоминаем исходный inline position контейнера, чтобы восстановить его при destroy()
  const hadInlinePosition = container.style.position;
  let adjustedContainerPosition = false;
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

  // Корневой оверлей пламени поверх фона контейнера, не перехватывающий клики
  const element = document.createElement('div');
  element.className = 'hud-score-flame';
  element.setAttribute('aria-hidden', 'true');
  element.dataset.flameActive = 'false';
  element.dataset.reducedMotion = 'false';
  element.style.position = 'absolute';
  element.style.left = `${-OVERLAY_PAD_X}px`;
  element.style.right = `${-OVERLAY_PAD_X}px`;
  element.style.top = `${-OVERLAY_PAD_TOP}px`;
  element.style.bottom = `${-OVERLAY_PAD_BOTTOM}px`;
  element.style.pointerEvents = 'none';
  element.style.overflow = 'visible';
  element.style.borderRadius = '10px';
  element.style.zIndex = '1';
  element.style.setProperty('--flame-intensity', '0');

  const chipsGlow = document.createElement('div');
  chipsGlow.className = 'hud-score-flame__glow hud-score-flame__glow--chips';
  chipsGlow.style.position = 'absolute';
  chipsGlow.style.left = '0';
  chipsGlow.style.top = '0';
  chipsGlow.style.width = '48%';
  chipsGlow.style.height = '100%';
  chipsGlow.style.pointerEvents = 'none';
  chipsGlow.style.borderRadius = '10px';
  chipsGlow.style.opacity = '0';
  chipsGlow.style.background =
    'radial-gradient(ellipse at 50% 65%, rgba(102, 185, 255, 0.55) 0%, rgba(47, 125, 255, 0.28) 52%, rgba(47, 125, 255, 0) 78%)';

  const multGlow = document.createElement('div');
  multGlow.className = 'hud-score-flame__glow hud-score-flame__glow--mult';
  multGlow.style.position = 'absolute';
  multGlow.style.right = '0';
  multGlow.style.top = '0';
  multGlow.style.width = '48%';
  multGlow.style.height = '100%';
  multGlow.style.pointerEvents = 'none';
  multGlow.style.borderRadius = '10px';
  multGlow.style.opacity = '0';
  multGlow.style.background =
    'radial-gradient(ellipse at 50% 65%, rgba(255, 198, 92, 0.58) 0%, rgba(255, 69, 58, 0.34) 52%, rgba(255, 69, 58, 0) 78%)';

  const canvas = document.createElement('canvas');
  canvas.className = 'hud-score-flame__canvas';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';

  element.append(chipsGlow, multGlow, canvas);
  container.append(element);

  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }

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

  const particles = createParticlePool();
  let targetIntensity = 0;
  let realIntensity = 0;
  let flameTimer = 0;
  let widthCss = 180;
  let heightCss = 56;
  let zones: Record<FlameSide, FlameZone> = {
    chips: { side: 'chips', xCenter: widthCss * 0.25, width: widthCss * 0.42, palette: PALETTES.chips },
    mult: { side: 'mult', xCenter: widthCss * 0.75, width: widthCss * 0.42, palette: PALETTES.mult },
  };

  let rafId: number | null = null;
  let lastTimestamp: number | null = null;
  let destroyed = false;

  const updateDomState = (intensity: number, reduced: boolean): void => {
    const active = intensity > STOP_THRESHOLD;
    element.dataset.flameActive = active ? 'true' : 'false';
    element.dataset.reducedMotion = reduced ? 'true' : 'false';
    element.style.setProperty('--flame-intensity', intensity.toFixed(4));

    const glowOpacity = active ? (reduced ? 0.25 + intensity * 0.45 : 0.14 + intensity * 0.36) : 0;
    chipsGlow.style.opacity = glowOpacity.toFixed(3);
    multGlow.style.opacity = glowOpacity.toFixed(3);
    canvas.style.display = reduced ? 'none' : 'block';
  };

  const computeZones = (): void => {
    const contRect = container.getBoundingClientRect();
    const hasContainerLayout = contRect.width > 1 && contRect.height > 1;
    widthCss = (hasContainerLayout ? contRect.width : 164) + OVERLAY_PAD_X * 2;
    heightCss = (hasContainerLayout ? contRect.height : 36) + OVERLAY_PAD_TOP + OVERLAY_PAD_BOTTOM;

    const resolveZone = (
      side: FlameSide,
      anchor: HTMLElement | null,
      fallbackRatio: number,
    ): FlameZone => {
      if (hasContainerLayout && anchor) {
        const rect = anchor.getBoundingClientRect();
        if (rect.width > 1) {
          const xCenter = rect.left - contRect.left + OVERLAY_PAD_X + rect.width * 0.5;
          return {
            side,
            xCenter,
            width: Math.max(24, rect.width * 0.92),
            palette: PALETTES[side],
          };
        }
      }
      return {
        side,
        xCenter: widthCss * fallbackRatio,
        width: widthCss * 0.4,
        palette: PALETTES[side],
      };
    };

    zones = {
      chips: resolveZone('chips', chipsAnchor, 0.25),
      mult: resolveZone('mult', multAnchor, 0.75),
    };
  };

  const clearCanvas = (): void => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawFrame = (intensity: number): void => {
    if (!ctx || intensity <= STOP_THRESHOLD) {
      clearCanvas();
      return;
    }

    const dpr = canvas.width > 0 && widthCss > 0 ? canvas.width / widthCss : 1;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.globalCompositeOperation = 'lighter';

    const baseLineY = heightCss - OVERLAY_PAD_BOTTOM - 2;
    const travelHeight = 18 + intensity * 28;

    for (const particle of particles) {
      const zone = zones[particle.side];
      const life = particle.progress;
      // Язычок максимально ярок на 20-35% пути и плавно затухает к вершине
      const fade = life < 0.2 ? life / 0.2 : 1 - (life - 0.2) / 0.8;
      const alpha = Math.max(0, Math.min(1, fade * (0.35 + intensity * 0.65)));
      if (alpha <= 0.01) continue;

      const sway = Math.sin(flameTimer * 3.4 + particle.swayPhase + life * 4) * particle.swayAmp;
      const x = zone.xCenter + particle.xOffset * zone.width * (1 - life * 0.35) + sway;
      const y = baseLineY - life * travelHeight;
      const r = particle.radius * (0.62 + intensity * 0.72) * (1 - life * 0.52);
      if (r <= 0.5) continue;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, zone.palette.core);
      grad.addColorStop(0.45, zone.palette.inner);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.globalAlpha = alpha;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const stopLoop = (): void => {
    if (rafId !== null) {
      cancelReqFrame(rafId);
      rafId = null;
    }
    lastTimestamp = null;
  };

  const stepFrame = (timestamp: number): void => {
    rafId = null;
    if (destroyed) return;

    if (isReducedMotion()) {
      realIntensity = targetIntensity;
      updateDomState(realIntensity, true);
      clearCanvas();
      stopLoop();
      return;
    }

    const prev = lastTimestamp ?? timestamp;
    lastTimestamp = timestamp;
    const dt = Math.max(0, Math.min(0.05, (timestamp - prev) / 1000));

    // Плавное экспоненциальное сглаживание по аналогии с real_intensity в Balatro
    const smoothRate = targetIntensity > realIntensity ? 10 : 7;
    const blend = 1 - Math.exp(-smoothRate * (dt > 0 ? dt : 1 / 60));
    realIntensity += (targetIntensity - realIntensity) * blend;

    if (targetIntensity <= 0 && realIntensity <= STOP_THRESHOLD) {
      realIntensity = 0;
      updateDomState(0, false);
      clearCanvas();
      stopLoop();
      return;
    }

    const stepDt = dt > 0 ? dt : 1 / 60;
    flameTimer += stepDt * (1 + realIntensity * 0.35);

    for (const particle of particles) {
      particle.progress = (particle.progress + stepDt * particle.speed * (0.8 + realIntensity * 0.6)) % 1;
    }

    updateDomState(realIntensity, false);
    drawFrame(realIntensity);

    rafId = reqFrame(stepFrame);
  };

  const ensureLoop = (): void => {
    if (destroyed || rafId !== null) return;
    lastTimestamp = getNow();
    rafId = reqFrame(stepFrame);
  };

  const resize = (): void => {
    if (destroyed) return;
    computeZones();
    const dpr =
      typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
        ? Math.min(2, Math.max(1, window.devicePixelRatio))
        : 1;
    canvas.width = Math.max(1, Math.round(widthCss * dpr));
    canvas.height = Math.max(1, Math.round(heightCss * dpr));

    if (!isReducedMotion() && realIntensity > STOP_THRESHOLD) {
      drawFrame(realIntensity);
    }
  };

  const setIntensity = (intensity: number): void => {
    if (destroyed) return;
    targetIntensity = clampUnit(intensity);
    const reduced = isReducedMotion();

    if (reduced) {
      stopLoop();
      realIntensity = targetIntensity;
      updateDomState(realIntensity, true);
      clearCanvas();
      return;
    }

    if (targetIntensity > STOP_THRESHOLD) {
      // Отмечаем активность сразу на входе, чтобы оверлей был видим с первого кадра
      element.dataset.flameActive = 'true';
      ensureLoop();
    } else if (realIntensity <= STOP_THRESHOLD) {
      realIntensity = 0;
      updateDomState(0, false);
      clearCanvas();
      stopLoop();
    } else {
      ensureLoop();
    }
  };

  const handleMotionChange = (): void => {
    if (destroyed) return;
    setIntensity(targetIntensity);
  };

  const handleWindowResize = (): void => {
    resize();
  };

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleWindowResize);
  }
  mql?.addEventListener?.('change', handleMotionChange);

  // Первичная настройка размеров и состояния покоя
  resize();
  updateDomState(0, isReducedMotion());

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    stopLoop();
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleWindowResize);
    }
    mql?.removeEventListener?.('change', handleMotionChange);
    clearCanvas();
    element.remove();
    if (adjustedContainerPosition) {
      container.style.position = hadInlinePosition;
    }
  };

  return {
    setIntensity,
    getIntensity: () => realIntensity,
    resize,
    destroy,
    element,
  };
}
