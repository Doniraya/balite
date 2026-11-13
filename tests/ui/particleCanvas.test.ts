// Тесты Canvas-оверлея частиц (shatter, scroll, celestial, rune, confetti) (Story 2.4).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createParticleCanvas } from '../../src/ui/particleCanvas';

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
    flush(stepMs: number) {
      timeMs += stepMs;
      const callbacks = [...queue.entries()];
      queue.clear();
      for (const [, cb] of callbacks) {
        cb(timeMs);
      }
    },
    pendingCount: () => queue.size,
  };
}

function createMockContext(): {
  ctx: CanvasRenderingContext2D;
  clearRect: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
} {
  const clearRect = vi.fn();
  const fillRect = vi.fn();
  const fill = vi.fn();
  const ctx = {
    clearRect,
    fillRect,
    fill,
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    globalAlpha: 1,
    fillStyle: '#fff',
  } as unknown as CanvasRenderingContext2D;
  return { ctx, clearRect, fillRect, fill };
}

describe('createParticleCanvas', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('безопасно работает в jsdom без 2D-контекста (no-op без исключений и лишних циклов)', () => {
    const stage = document.createElement('div');
    const target = document.createElement('div');
    stage.append(target);
    document.body.append(stage);

    const raf = createFakeRaf();
    const particles = createParticleCanvas({
      container: stage,
      reducedMotion: false,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    expect(particles.element.tagName).toBe('CANVAS');
    expect(particles.element.className).toContain('fx-particle-canvas');
    expect(particles.element.getAttribute('aria-hidden')).toBe('true');
    expect(particles.element.style.pointerEvents).toBe('none');

    expect(() => {
      particles.emit('shatter', 100, 120);
      particles.emitAtElement('scroll', target);
      particles.emitAtElement('celestial', null);
      particles.emit('rune', 50, 50);
      particles.emitConfetti();
      particles.resize();
      particles.clear();
    }).not.toThrow();

    expect(particles.getActiveCount()).toBe(0);
    expect(raf.requestFrame).not.toHaveBeenCalled();

    particles.destroy();
    expect(particles.element.parentElement).toBeNull();
  });

  it('запускает ленивый rAF только при наличии живых частиц и останавливает после их затухания', () => {
    const { ctx, clearRect, fill, fillRect } = createMockContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);

    const stage = document.createElement('div');
    document.body.append(stage);
    const raf = createFakeRaf();

    const particles = createParticleCanvas({
      container: stage,
      speed: 1,
      reducedMotion: false,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    // В простое rAF не крутится
    expect(raf.requestFrame).not.toHaveBeenCalled();
    expect(particles.getActiveCount()).toBe(0);

    // Осколки хрустальной карты
    particles.emit('shatter', 200, 300);
    expect(particles.getActiveCount()).toBeGreaterThan(0);
    expect(raf.pendingCount()).toBe(1);

    raf.flush(16);
    expect(clearRect).toHaveBeenCalled();
    expect(fill).toHaveBeenCalled();

    // Проматываем до истечения времени жизни всех осколков
    for (let i = 0; i < 60; i++) {
      if (raf.pendingCount() === 0) break;
      raf.flush(40);
    }
    expect(particles.getActiveCount()).toBe(0);
    expect(raf.pendingCount()).toBe(0);

    // Победное конфетти также рисуется и само останавливается
    particles.emitConfetti({ count: 12 });
    expect(particles.getActiveCount()).toBe(12);
    raf.flush(16);
    expect(fillRect).toHaveBeenCalled();

    particles.clear();
    expect(particles.getActiveCount()).toBe(0);
    expect(raf.pendingCount()).toBe(0);

    particles.destroy();
  });

  it('привязанный к элементу emitAtElement и эффекты scroll/celestial/rune учитывают AnimationSpeed и reducedMotion', () => {
    const { ctx } = createMockContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);

    const stage = document.createElement('div');
    const card = document.createElement('div');
    stage.append(card);
    document.body.append(stage);

    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 720,
      height: 1280,
      right: 720,
      bottom: 1280,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 200,
      width: 80,
      height: 120,
      right: 180,
      bottom: 320,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    });

    let reduced = false;
    const raf = createFakeRaf();
    const particles = createParticleCanvas({
      container: stage,
      speed: 2,
      reducedMotion: () => reduced,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    particles.emitAtElement('scroll', card);
    particles.emitAtElement('celestial', card);
    particles.emitAtElement('rune', card);
    expect(particles.getActiveCount()).toBeGreaterThan(20);

    // При переключении в reduced-motion новые частицы не спавнятся, существующие сбрасываются при clear
    reduced = true;
    particles.clear();
    particles.emit('shatter', 100, 100);
    particles.emitConfetti();
    expect(particles.getActiveCount()).toBe(0);

    particles.destroy();
  });
});
