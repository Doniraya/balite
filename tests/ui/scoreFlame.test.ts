// Тесты модуля расчёта и визуализации эффекта пламени для блока Сила × Множ (Story 2.3).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  computeScoreFlameIntensity,
  createScoreFlame,
} from '../../src/ui/scoreFlame';

describe('computeScoreFlameIntensity', () => {
  it('возвращает 0, если прогнозируемый счёт руки меньше цели раунда (без суммирования с текущим счётом)', () => {
    expect(computeScoreFlameIntensity(0, 20, 2, 300)).toBe(0);
    expect(computeScoreFlameIntensity(250, 20, 2, 300)).toBe(0);
    expect(computeScoreFlameIntensity(290, 20, 1, 300)).toBe(0);
    // Масштаб Balatro: clamp01((log_5(300) - 2) / 10) ≈ 0.1544
    expect(computeScoreFlameIntensity(0, 100, 3, 300)).toBeCloseTo((Math.log(300) / Math.log(5) - 2) / 10, 4);
  });

  it('возвращает 0 при неактивном подсчёте (нулевые Сила, Множ или цель)', () => {
    expect(computeScoreFlameIntensity(500, 0, 2, 300)).toBe(0);
    expect(computeScoreFlameIntensity(500, 40, 0, 300)).toBe(0);
    expect(computeScoreFlameIntensity(500, 40, 2, 0)).toBe(0);
    expect(computeScoreFlameIntensity(Number.NaN, 40, 2, 300)).toBe(0);
  });

  it('возвращает положительную интенсивность в диапазоне (0..1] при пробитии порога и растёт монотонно с запасом', () => {
    const atThreshold = computeScoreFlameIntensity(0, 100, 3, 300);
    const doubleTarget = computeScoreFlameIntensity(0, 150, 4, 300);
    const hugeOverkill = computeScoreFlameIntensity(0, 1000, 30, 300);

    expect(atThreshold).toBeGreaterThan(0);
    expect(atThreshold).toBeLessThanOrEqual(1);
    expect(doubleTarget).toBeGreaterThan(atThreshold);
    expect(hugeOverkill).toBeGreaterThan(doubleTarget);
    expect(hugeOverkill).toBeLessThanOrEqual(1);
  });
});

describe('createScoreFlame', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function createFakeRaf() {
    let nextId = 1;
    let timeMs = 0;
    const queue = new Map<number, FrameRequestCallback>();
    return {
      now: () => timeMs,
      requestFrame: vi.fn((cb: FrameRequestCallback) => {
        const id = nextId++;
        queue.set(id, cb);
        return id;
      }),
      cancelFrame: vi.fn((id: number) => {
        queue.delete(id);
      }),
      flushFrame(dtMs = 16) {
        timeMs += dtMs;
        const callbacks = [...queue.entries()];
        queue.clear();
        for (const [, cb] of callbacks) {
          cb(timeMs);
        }
      },
      pendingCount: () => queue.size,
    };
  }

  function createHudFixture() {
    const formula = document.createElement('div');
    formula.className = 'hud-formula';
    const chips = document.createElement('div');
    chips.className = 'hud-pill hud-pill--chips';
    const mult = document.createElement('div');
    mult.className = 'hud-pill hud-pill--mult';
    formula.append(chips, mult);
    document.body.append(formula);
    return { formula, chips, mult };
  }

  it('безопасно монтируется в jsdom без 2D-контекста, ставит pointer-events: none и реагирует на setIntensity', () => {
    const { formula, chips, mult } = createHudFixture();
    const raf = createFakeRaf();

    const controller = createScoreFlame({
      container: formula,
      chipsAnchor: chips,
      multAnchor: mult,
      reducedMotion: false,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    expect(controller.element.parentElement).toBe(formula);
    expect(controller.element.style.pointerEvents).toBe('none');
    expect(controller.element.getAttribute('aria-hidden')).toBe('true');
    expect(controller.element.dataset.flameActive).toBe('false');
    expect(raf.requestFrame).not.toHaveBeenCalled();

    controller.setIntensity(0.75);
    expect(controller.element.dataset.flameActive).toBe('true');
    expect(raf.requestFrame).toHaveBeenCalledTimes(1);

    // За несколько кадров (с инерцией 2-го порядка Balatro) интенсивность превышает 0.5
    for (let i = 0; i < 36; i++) {
      raf.flushFrame(16);
    }
    expect(controller.getIntensity()).toBeGreaterThan(0.5);
    expect(
      Number(controller.element.style.getPropertyValue('--flame-intensity')),
    ).toBeGreaterThan(0.5);

    // Сброс в 0 плавно гасит пламя и останавливает цикл rAF
    controller.setIntensity(0);
    for (let i = 0; i < 180; i++) {
      raf.flushFrame(32);
    }
    expect(controller.getIntensity()).toBe(0);
    expect(controller.element.dataset.flameActive).toBe('false');
    expect(raf.pendingCount()).toBe(0);

    controller.destroy();
  });

  it('рисует в 2D-контекст синее пламя у Силы и красно-золотое у Множ при наличии canvas context', () => {
    const { formula, chips, mult } = createHudFixture();
    const raf = createFakeRaf();
    const fillRect = vi.fn();
    const clearRect = vi.fn();
    const beginPath = vi.fn();
    const rect = vi.fn();
    const arc = vi.fn();
    const fill = vi.fn();
    const createRadialGradient = vi.fn(() => ({
      addColorStop: vi.fn(),
    }));

    const fakeCtx = {
      clearRect,
      fillRect,
      beginPath,
      rect,
      arc,
      fill,
      createRadialGradient,
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      moveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      imageSmoothingEnabled: true,
      globalCompositeOperation: 'source-over',
      globalAlpha: 1,
      fillStyle: '#000',
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      fakeCtx,
    );

    const controller = createScoreFlame({
      container: formula,
      chipsAnchor: chips,
      multAnchor: mult,
      reducedMotion: false,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    const canvasEl = controller.element.querySelector('canvas')!;
    expect(canvasEl.style.imageRendering).toBe('pixelated');

    controller.resize();
    controller.setIntensity(0.9);
    raf.flushFrame(16);
    raf.flushFrame(16);

    expect(clearRect).toHaveBeenCalled();
    expect(rect).toHaveBeenCalled();
    expect(fill).toHaveBeenCalled();
    expect(fakeCtx.imageSmoothingEnabled).toBe(false);
    controller.destroy();
  });

  it('при минимальной интенсивности 0.15 ярко рисует пиксели огня над верхним краем обеих плиток', () => {
    const { formula, chips, mult } = createHudFixture();
    const raf = createFakeRaf();

    formula.getBoundingClientRect = () =>
      ({ left: 20, top: 100, width: 240, height: 64, right: 260, bottom: 164, x: 20, y: 100, toJSON: () => ({}) }) as DOMRect;
    chips.getBoundingClientRect = () =>
      ({ left: 20, top: 100, width: 106, height: 64, right: 126, bottom: 164, x: 20, y: 100, toJSON: () => ({}) }) as DOMRect;
    mult.getBoundingClientRect = () =>
      ({ left: 154, top: 100, width: 106, height: 64, right: 260, bottom: 164, x: 154, y: 100, toJSON: () => ({}) }) as DOMRect;

    const drawnRects: Array<{ x: number; y: number }> = [];
    const fakeCtx = {
      clearRect: vi.fn(),
      fillRect: vi.fn((rx: number, ry: number) => drawnRects.push({ x: rx, y: ry })),
      beginPath: vi.fn(),
      rect: vi.fn((rx: number, ry: number) => drawnRects.push({ x: rx, y: ry })),
      arc: vi.fn(),
      fill: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      imageSmoothingEnabled: true,
      globalAlpha: 1,
      fillStyle: '#000',
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx);

    const controller = createScoreFlame({
      container: formula,
      chipsAnchor: chips,
      multAnchor: mult,
      reducedMotion: false,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    controller.setIntensity(0.15);
    // Продвигаем на 10 кадров, чтобы пламя вышло на рабочую высоту при 0.15
    for (let i = 0; i < 10; i += 1) {
      raf.flushFrame(16);
    }

    const padTop = Math.abs(Number.parseFloat(controller.element.style.top));
    expect(padTop).toBeGreaterThanOrEqual(44);

    // В координатах canvas верхний край обеих плиток находится ровно на y = padTop
    const abovePillRects = drawnRects.filter((r) => r.y >= 0 && r.y < padTop);
    expect(abovePillRects.length).toBeGreaterThan(20);

    // Должны гореть обе стороны: левая плитка «Сила» и правая плитка «Множ»
    const midX = (240 + Math.abs(Number.parseFloat(controller.element.style.left)) * 2) * 0.5;
    expect(abovePillRects.some((r) => r.x < midX)).toBe(true);
    expect(abovePillRects.some((r) => r.x > midX)).toBe(true);

    // Высота видимых языков над верхним краем плиток не менее 15px даже на минимальном пороге 0.15
    const minY = Math.min(...abovePillRects.map((r) => r.y));
    expect(padTop - minY).toBeGreaterThanOrEqual(15);

    controller.destroy();
  });

  it('в режиме prefers-reduced-motion: reduce не запускает rAF и включает статичное свечение', () => {
    const { formula, chips, mult } = createHudFixture();
    const raf = createFakeRaf();

    const controller = createScoreFlame({
      container: formula,
      chipsAnchor: chips,
      multAnchor: mult,
      reducedMotion: true,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    controller.setIntensity(0.8);
    expect(raf.requestFrame).not.toHaveBeenCalled();
    expect(controller.getIntensity()).toBeCloseTo(0.8, 3);
    expect(controller.element.dataset.flameActive).toBe('true');
    expect(controller.element.dataset.reducedMotion).toBe('true');
    expect(
      Number(controller.element.style.getPropertyValue('--flame-intensity')),
    ).toBeCloseTo(0.8, 3);

    controller.setIntensity(0);
    expect(controller.getIntensity()).toBe(0);
    expect(controller.element.dataset.flameActive).toBe('false');

    controller.destroy();
  });

  it('корректно останавливает rAF и удаляет DOM при destroy()', () => {
    const { formula } = createHudFixture();
    const raf = createFakeRaf();

    const controller = createScoreFlame({
      container: formula,
      reducedMotion: false,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    controller.setIntensity(0.6);
    expect(raf.pendingCount()).toBe(1);

    controller.destroy();
    expect(raf.cancelFrame).toHaveBeenCalledTimes(1);
    expect(raf.pendingCount()).toBe(0);
    expect(controller.element.parentElement).toBeNull();

    // Повторные вызовы после destroy безопасны
    expect(() => {
      controller.setIntensity(1);
      controller.resize();
      controller.destroy();
    }).not.toThrow();
    expect(raf.pendingCount()).toBe(0);
  });
});
