/**
 * Палитра настроений процедурного алхимического фона.
 */
export type BackdropMood = 'menu' | 'battle' | 'boss' | 'shop' | 'victory' | 'defeat';

/**
 * Контроллер управления процедурным Canvas-фоном.
 */
export interface BackdropController {
  setMood(mood: BackdropMood): void;
  triggerPulse(color?: string): void;
  spawnParticles(xNorm: number, yNorm: number, color: string, count?: number): void;
  resize(): void;
  destroy(): void;
}

type RgbColor = readonly [number, number, number];

interface MoodPalette {
  readonly inner: RgbColor;
  readonly outer: RgbColor;
  readonly swirlA: RgbColor;
  readonly swirlB: RgbColor;
  readonly accent: string;
}

interface ActivePulse {
  readonly color: string;
  age: number;
  readonly duration: number;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  phase: number;
  speed: number;
  color: string;
  life: number;
  maxLife: number;
  ambient: boolean;
}

const MOOD_PALETTES: Readonly<Record<BackdropMood, MoodPalette>> = {
  menu: {
    inner: [26, 78, 66],
    outer: [12, 32, 34],
    swirlA: [42, 168, 132],
    swirlB: [212, 162, 68],
    accent: '#f5b942',
  },
  battle: {
    inner: [24, 92, 74],
    outer: [11, 38, 33],
    swirlA: [48, 192, 146],
    swirlB: [58, 134, 255],
    accent: '#f5b942',
  },
  boss: {
    inner: [98, 24, 46],
    outer: [38, 10, 24],
    swirlA: [232, 74, 95],
    swirlB: [168, 85, 247],
    accent: '#ff7a66',
  },
  shop: {
    inner: [94, 58, 22],
    outer: [38, 22, 11],
    swirlA: [245, 165, 52],
    swirlB: [217, 119, 6],
    accent: '#fde68a',
  },
  victory: {
    inner: [64, 96, 36],
    outer: [22, 42, 22],
    swirlA: [245, 198, 66],
    swirlB: [74, 222, 128],
    accent: '#ffe882',
  },
  defeat: {
    inner: [46, 52, 86],
    outer: [18, 22, 40],
    swirlA: [112, 130, 178],
    swirlB: [164, 72, 92],
    accent: '#ba98aa',
  },
};

const AMBIENT_SPARK_COUNT = 24;
const MAX_PULSES = 8;
const MAX_BURST_PARTICLES = 160;
const SPIRAL_ARM_COUNT = 4;
const SPIRAL_SEGMENT_COUNT = 26;

const NOOP_CONTROLLER: BackdropController = {
  setMood: () => {},
  triggerPulse: () => {},
  spawnParticles: () => {},
  resize: () => {},
  destroy: () => {},
};

/**
 * Проверяет, скрыта ли текущая вкладка браузера.
 */
function isDocumentHidden(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return Boolean(document.hidden || document.visibilityState === 'hidden');
}

/**
 * Линейно интерполирует две RGB-тройки с коэффициентом t in [0, 1].
 */
function lerpRgb(from: RgbColor, to: RgbColor, t: number): [number, number, number] {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ];
}

/**
 * Форматирует RGB-тройку в CSS rgba-строку.
 */
function toRgba(rgb: readonly [number, number, number], alpha: number): string {
  const r = Math.max(0, Math.min(255, Math.round(rgb[0])));
  const g = Math.max(0, Math.min(255, Math.round(rgb[1])));
  const b = Math.max(0, Math.min(255, Math.round(rgb[2])));
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

/**
 * Ограничивает число заданным диапазоном.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Безопасно читает CSS-размеры родительского контейнера или самого canvas.
 */
function measureCanvasDimensions(canvas: HTMLCanvasElement): { width: number; height: number } {
  const parent = canvas.parentElement;
  const parentRect = parent ? parent.getBoundingClientRect() : null;
  const canvasRect = canvas.getBoundingClientRect();

  const fallbackWidth =
    typeof window !== 'undefined' && Number.isFinite(window.innerWidth) && window.innerWidth > 0
      ? window.innerWidth
      : 720;
  const fallbackHeight =
    typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && window.innerHeight > 0
      ? window.innerHeight
      : 1280;

  const rawWidth =
    (parentRect && parentRect.width > 0 ? parentRect.width : 0) ||
    (parent && parent.clientWidth > 0 ? parent.clientWidth : 0) ||
    (canvasRect.width > 0 ? canvasRect.width : 0) ||
    (canvas.clientWidth > 0 ? canvas.clientWidth : 0) ||
    fallbackWidth;

  const rawHeight =
    (parentRect && parentRect.height > 0 ? parentRect.height : 0) ||
    (parent && parent.clientHeight > 0 ? parent.clientHeight : 0) ||
    (canvasRect.height > 0 ? canvasRect.height : 0) ||
    (canvas.clientHeight > 0 ? canvas.clientHeight : 0) ||
    fallbackHeight;

  return {
    width: Math.max(1, Math.round(rawWidth)),
    height: Math.max(1, Math.round(rawHeight)),
  };
}

/**
 * Создаёт процедурный алхимический фон на Canvas 2D с закруткой, искрами и сменой палитры по mood.
 * При отсутствии 2D-контекста (например, в jsdom) безопасно возвращает no-op контроллер.
 */
export function createBackdropCanvas(canvas: HTMLCanvasElement): BackdropController {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }

  if (!ctx) {
    return NOOP_CONTROLLER;
  }

  // Растягиваем canvas на всю доступную область родителя (поддержка десктопного поля 1.6.2.1)
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';

  let destroyed = false;
  let rafId: number | null = null;
  let lastTimestamp: number | null = null;
  let elapsed = 0;

  let cssWidth = 720;
  let cssHeight = 1280;
  let dpr = 1;

  let targetMood: BackdropMood = 'menu';
  let currentInner: [number, number, number] = [...MOOD_PALETTES.menu.inner];
  let currentOuter: [number, number, number] = [...MOOD_PALETTES.menu.outer];
  let currentSwirlA: [number, number, number] = [...MOOD_PALETTES.menu.swirlA];
  let currentSwirlB: [number, number, number] = [...MOOD_PALETTES.menu.swirlB];

  // Лёгкий локальный генератор псевдослучайных чисел только для визуальных искр
  let visualSeed = 0x9e3779b9;
  const nextVisualFloat = (): number => {
    visualSeed = (visualSeed * 1664525 + 1013904223) >>> 0;
    return visualSeed / 4294967296;
  };

  const pulses: ActivePulse[] = [];
  const ambientSparks: SparkParticle[] = [];
  const burstParticles: SparkParticle[] = [];

  const initAmbientSparks = (): void => {
    ambientSparks.length = 0;
    for (let i = 0; i < AMBIENT_SPARK_COUNT; i += 1) {
      ambientSparks.push({
        x: nextVisualFloat() * cssWidth,
        y: nextVisualFloat() * cssHeight,
        vx: (nextVisualFloat() - 0.5) * 14,
        vy: -8 - nextVisualFloat() * 18,
        radius: 1.2 + nextVisualFloat() * 2.4,
        alpha: 0.25 + nextVisualFloat() * 0.45,
        phase: nextVisualFloat() * Math.PI * 2,
        speed: 1.1 + nextVisualFloat() * 1.8,
        color: MOOD_PALETTES[targetMood].accent,
        life: 0,
        maxLife: 1,
        ambient: true,
      });
    }
  };

  const updateCanvasSize = (): void => {
    const measured = measureCanvasDimensions(canvas);
    const rawDpr =
      typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
        ? window.devicePixelRatio
        : 1;
    dpr = clamp(rawDpr, 1, 2);
    cssWidth = measured.width;
    cssHeight = measured.height;
    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  };

  const renderFrame = (dtSec: number): void => {
    if (destroyed || !ctx) {
      return;
    }

    const targetPalette = MOOD_PALETTES[targetMood];
    const blend = Math.min(1, dtSec * 3.5);
    currentInner = lerpRgb(currentInner, targetPalette.inner, blend);
    currentOuter = lerpRgb(currentOuter, targetPalette.outer, blend);
    currentSwirlA = lerpRgb(currentSwirlA, targetPalette.swirlA, blend);
    currentSwirlB = lerpRgb(currentSwirlB, targetPalette.swirlB, blend);

    elapsed += dtSec;

    if (typeof ctx.setTransform === 'function') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const cx = cssWidth * 0.5;
    const cy = cssHeight * 0.44;
    const minDim = Math.min(cssWidth, cssHeight);
    const maxRadius = Math.hypot(cssWidth, cssHeight) * 0.68;

    // 1. Основная цветная алхимическая подложка без чёрных или белых краёв
    const bgGrad = ctx.createRadialGradient(cx, cy, maxRadius * 0.04, cx, cy, maxRadius);
    bgGrad.addColorStop(0, toRgba(currentInner, 1));
    bgGrad.addColorStop(0.55, toRgba(lerpRgb(currentInner, currentOuter, 0.55), 1));
    bgGrad.addColorStop(1, toRgba(currentOuter, 1));
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // 2. Плавная процедурная спираль с гармоническими завихрениями
    ctx.save();
    for (let arm = 0; arm < SPIRAL_ARM_COUNT; arm += 1) {
      const armOffset = (arm / SPIRAL_ARM_COUNT) * Math.PI * 2;
      const isPrimary = arm % 2 === 0;
      const armColor = isPrimary ? currentSwirlA : currentSwirlB;
      ctx.beginPath();

      for (let seg = 0; seg <= SPIRAL_SEGMENT_COUNT; seg += 1) {
        const frac = seg / SPIRAL_SEGMENT_COUNT;
        const radius = frac * maxRadius * 0.96;
        const twist = frac * 3.8 + elapsed * (isPrimary ? 0.32 : -0.24);
        const ripple = Math.sin(elapsed * 1.4 + frac * 6.5 + armOffset) * 0.14;
        const angle = armOffset + twist + ripple;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;

        if (seg === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }

      ctx.strokeStyle = toRgba(armColor, isPrimary ? 0.19 : 0.15);
      ctx.lineWidth = Math.max(8, minDim * (isPrimary ? 0.085 : 0.06));
      ctx.stroke();
    }

    // 3. Деликатные астрологические дуги вокруг центра
    const ringRadiusA = minDim * 0.28;
    const ringRadiusB = minDim * 0.41;
    ctx.lineWidth = Math.max(1.2, minDim * 0.004);
    ctx.strokeStyle = toRgba(currentSwirlB, 0.18);
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadiusA, elapsed * 0.22, elapsed * 0.22 + Math.PI * 1.35);
    ctx.stroke();

    ctx.strokeStyle = toRgba(currentSwirlA, 0.14);
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadiusB, -elapsed * 0.17, -elapsed * 0.17 + Math.PI * 1.2);
    ctx.stroke();
    ctx.restore();

    // 4. Активные импульсы от триггеров подсчёта/босса
    for (let i = pulses.length - 1; i >= 0; i -= 1) {
      const pulse = pulses[i]!;
      pulse.age += dtSec;
      if (pulse.age >= pulse.duration) {
        pulses.splice(i, 1);
        continue;
      }

      const progress = pulse.age / pulse.duration;
      const eased = 1 - Math.pow(1 - progress, 3);
      const radius = maxRadius * 0.08 + maxRadius * 0.78 * eased;
      const alpha = (1 - progress) * 0.38;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = pulse.color;
      ctx.lineWidth = Math.max(2, minDim * 0.015 * (1 - progress * 0.5));
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Мягкие фоновые искры
    for (const spark of ambientSparks) {
      spark.x += spark.vx * dtSec;
      spark.y += spark.vy * dtSec;

      if (spark.y < -10) {
        spark.y = cssHeight + 10;
        spark.x = nextVisualFloat() * cssWidth;
      } else if (spark.y > cssHeight + 10) {
        spark.y = -10;
      }
      if (spark.x < -10) {
        spark.x = cssWidth + 10;
      } else if (spark.x > cssWidth + 10) {
        spark.x = -10;
      }

      const twinkle = 0.55 + 0.45 * Math.sin(elapsed * spark.speed + spark.phase);
      ctx.save();
      ctx.globalAlpha = spark.alpha * twinkle;
      ctx.fillStyle = targetPalette.accent;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. Всплески частиц от событий карт/реликвий
    const damping = Math.pow(0.28, dtSec);
    for (let i = burstParticles.length - 1; i >= 0; i -= 1) {
      const particle = burstParticles[i]!;
      particle.life += dtSec;
      if (particle.life >= particle.maxLife) {
        burstParticles.splice(i, 1);
        continue;
      }

      particle.vx *= damping;
      particle.vy *= damping;
      particle.x += particle.vx * dtSec;
      particle.y += particle.vy * dtSec;

      const lifeRatio = 1 - particle.life / particle.maxLife;
      ctx.save();
      ctx.globalAlpha = particle.alpha * lifeRatio;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius * (0.45 + 0.55 * lifeRatio), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  const stopLoop = (): void => {
    if (rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafId);
    }
    rafId = null;
    lastTimestamp = null;
  };

  const tick = (timestamp: number): void => {
    rafId = null;
    if (destroyed || isDocumentHidden()) {
      lastTimestamp = null;
      return;
    }

    const rawDt = lastTimestamp === null ? 0.016 : (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    const dtSec = clamp(Number.isFinite(rawDt) ? rawDt : 0.016, 0.001, 0.1);

    renderFrame(dtSec);

    if (!destroyed && !isDocumentHidden() && typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(tick);
    }
  };

  const startLoopIfVisible = (): void => {
    if (destroyed || rafId !== null || isDocumentHidden()) {
      return;
    }
    if (typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(tick);
    }
  };

  const handleVisibilityChange = (): void => {
    if (destroyed) {
      return;
    }
    if (isDocumentHidden()) {
      stopLoop();
    } else {
      startLoopIfVisible();
    }
  };

  const handleResize = (): void => {
    if (destroyed) {
      return;
    }
    updateCanvasSize();
    if (!isDocumentHidden() && rafId === null) {
      renderFrame(0);
    }
  };

  updateCanvasSize();
  initAmbientSparks();

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(canvas.parentElement ?? canvas);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  // Запускаем цикл отрисовки только при видимой вкладке
  startLoopIfVisible();

  return {
    setMood(mood: BackdropMood): void {
      if (destroyed) {
        return;
      }
      targetMood = mood;
      // До первого кадра применяем новую палитру сразу, чтобы избежать вспышки стартового цвета
      if (elapsed === 0) {
        const palette = MOOD_PALETTES[mood];
        currentInner = [...palette.inner];
        currentOuter = [...palette.outer];
        currentSwirlA = [...palette.swirlA];
        currentSwirlB = [...palette.swirlB];
      }
    },

    triggerPulse(color?: string): void {
      if (destroyed) {
        return;
      }
      if (pulses.length >= MAX_PULSES) {
        pulses.shift();
      }
      pulses.push({
        color: color || MOOD_PALETTES[targetMood].accent,
        age: 0,
        duration: 0.75,
      });
    },

    spawnParticles(xNorm: number, yNorm: number, color: string, count = 16): void {
      if (destroyed) {
        return;
      }
      const safeCount = Math.max(0, Math.min(80, Math.round(count)));
      const originX = clamp(xNorm, -0.1, 1.1) * cssWidth;
      const originY = clamp(yNorm, -0.1, 1.1) * cssHeight;

      for (let i = 0; i < safeCount; i += 1) {
        if (burstParticles.length >= MAX_BURST_PARTICLES) {
          burstParticles.shift();
        }
        const angle = nextVisualFloat() * Math.PI * 2;
        const speed = 55 + nextVisualFloat() * 190;
        burstParticles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 1.8 + nextVisualFloat() * 3.2,
          alpha: 0.7 + nextVisualFloat() * 0.3,
          phase: 0,
          speed: 1,
          color: color || MOOD_PALETTES[targetMood].accent,
          life: 0,
          maxLife: 0.45 + nextVisualFloat() * 0.45,
          ambient: false,
        });
      }
    },

    resize(): void {
      handleResize();
    },

    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      stopLoop();
      pulses.length = 0;
      ambientSparks.length = 0;
      burstParticles.length = 0;

      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    },
  };
}
