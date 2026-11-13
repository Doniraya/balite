// Тесты контроллера плавной накрутки цифр и таймлайна кэшаута (Story 2.4).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCashoutTimeline,
  createNumberRoller,
} from '../../src/ui/numberRoller';

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

describe('createNumberRoller', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('плавно накручивает целое число от initialValue к target и останавливает rAF по завершении', () => {
    const el = document.createElement('span');
    const raf = createFakeRaf();
    const updates: number[] = [];

    const roller = createNumberRoller({
      element: el,
      initialValue: 0,
      durationMs: 200,
      speed: 1,
      reducedMotion: false,
      onUpdate: (v) => updates.push(v),
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    expect(roller.getCurrent()).toBe(0);
    expect(el.textContent).toBe('0');

    roller.setTarget(100);
    expect(roller.isAnimating()).toBe(true);
    expect(raf.pendingCount()).toBe(1);

    // Половина длительности — промежуточное значение строго между 0 и 100
    raf.flush(100);
    expect(roller.getCurrent()).toBeGreaterThan(0);
    expect(roller.getCurrent()).toBeLessThan(100);
    expect(el.textContent).toBe(String(roller.getCurrent()));

    // Финал длительности — достигли цели, цикл остановлен
    raf.flush(120);
    expect(roller.getCurrent()).toBe(100);
    expect(el.textContent).toBe('100');
    expect(roller.isAnimating()).toBe(false);
    expect(raf.pendingCount()).toBe(0);
    expect(updates[updates.length - 1]).toBe(100);

    roller.destroy();
  });

  it('учитывает AnimationSpeed (0.5x медленнее, 4x быстрее)', () => {
    const rafSlow = createFakeRaf();
    const slow = createNumberRoller({
      initialValue: 0,
      durationMs: 200,
      speed: 0.5,
      reducedMotion: false,
      now: rafSlow.now,
      requestFrame: rafSlow.requestFrame,
      cancelFrame: rafSlow.cancelFrame,
    });
    slow.setTarget(100);
    // При 0.5x длительность 400ms -> на 200ms ещё не дошло до 100
    rafSlow.flush(200);
    expect(slow.isAnimating()).toBe(true);
    expect(slow.getCurrent()).toBeLessThan(100);
    rafSlow.flush(220);
    expect(slow.getCurrent()).toBe(100);
    expect(slow.isAnimating()).toBe(false);

    const rafFast = createFakeRaf();
    const fast = createNumberRoller({
      initialValue: 0,
      durationMs: 200,
      speed: 4,
      reducedMotion: false,
      now: rafFast.now,
      requestFrame: rafFast.requestFrame,
      cancelFrame: rafFast.cancelFrame,
    });
    fast.setTarget(100);
    // При 4x длительность 50ms -> уже к 60ms дошло до 100
    rafFast.flush(60);
    expect(fast.getCurrent()).toBe(100);
    expect(fast.isAnimating()).toBe(false);

    slow.destroy();
    fast.destroy();
  });

  it('в режиме prefers-reduced-motion и при skip()/snap() устанавливает значение мгновенно', () => {
    const rafReduced = createFakeRaf();
    const el = document.createElement('span');
    const reduced = createNumberRoller({
      element: el,
      initialValue: 10,
      reducedMotion: true,
      format: (v) => `$${v}`,
      now: rafReduced.now,
      requestFrame: rafReduced.requestFrame,
      cancelFrame: rafReduced.cancelFrame,
    });

    reduced.setTarget(250);
    expect(rafReduced.requestFrame).not.toHaveBeenCalled();
    expect(reduced.getCurrent()).toBe(250);
    expect(el.textContent).toBe('$250');

    const rafNormal = createFakeRaf();
    const normal = createNumberRoller({
      initialValue: 0,
      durationMs: 300,
      reducedMotion: false,
      now: rafNormal.now,
      requestFrame: rafNormal.requestFrame,
      cancelFrame: rafNormal.cancelFrame,
    });
    normal.setTarget(500);
    rafNormal.flush(50);
    expect(normal.getCurrent()).toBeLessThan(500);

    normal.skip();
    expect(normal.getCurrent()).toBe(500);
    expect(normal.isAnimating()).toBe(false);
    expect(rafNormal.pendingCount()).toBe(0);

    normal.snap(42);
    expect(normal.getCurrent()).toBe(42);
    expect(normal.getTarget()).toBe(42);

    reduced.destroy();
    normal.destroy();
  });

  it('корректно работает на Vitest fake timers через глобальный requestAnimationFrame и очищается в destroy()', () => {
    vi.useFakeTimers();
    const el = document.createElement('span');
    const roller = createNumberRoller({
      element: el,
      initialValue: 0,
      durationMs: 120,
      speed: 1,
      reducedMotion: false,
    });

    roller.setTarget(300);
    vi.advanceTimersByTime(180);
    expect(roller.getCurrent()).toBe(300);
    expect(el.textContent).toBe('300');

    roller.setTarget(600);
    roller.destroy();
    vi.advanceTimersByTime(300);
    expect(roller.getCurrent()).toBe(300);
  });
});

describe('createCashoutTimeline', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('последовательно раскрывает строки кэшаута, накручивает итого и мгновенно завершается по skip()', () => {
    const raf = createFakeRaf();
    const row1 = document.createElement('div');
    const val1 = document.createElement('strong');
    const row2 = document.createElement('div');
    const val2 = document.createElement('strong');
    const rowTotal = document.createElement('div');
    const valTotal = document.createElement('strong');
    const buttonTotal = document.createElement('button');

    const revealed: number[] = [];
    const onComplete = vi.fn();

    const timeline = createCashoutTimeline({
      rows: [
        { rowElement: row1, valueElement: val1, amount: 4, formatAmount: (v) => `$${v}` },
        { rowElement: row2, valueElement: val2, amount: 6, formatAmount: (v) => `$${v}` },
        {
          rowElement: rowTotal,
          valueElement: valTotal,
          amount: 10,
          formatAmount: (v) => `$${v}`,
          isTotal: true,
        },
      ],
      totalElement: buttonTotal,
      formatTotal: (v) => `Забрать $${v}`,
      rowStepMs: 100,
      rollDurationMs: 100,
      speed: 1,
      reducedMotion: false,
      onRowReveal: (idx) => revealed.push(idx),
      onComplete,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    expect(row1.dataset.cashoutRevealed).toBe('false');
    expect(row2.dataset.cashoutRevealed).toBe('false');

    timeline.start();
    // На первом шаге раскрывается первая строка
    raf.flush(20);
    expect(revealed).toContain(0);
    expect(row1.dataset.cashoutRevealed).toBe('true');
    expect(row2.dataset.cashoutRevealed).toBe('false');

    // После 120мс раскрывается вторая строка
    raf.flush(100);
    expect(revealed).toContain(1);
    expect(row2.dataset.cashoutRevealed).toBe('true');

    // skip() мгновенно раскрывает всё и фиксирует итоговые суммы
    timeline.skip();
    expect(timeline.isFinished()).toBe(true);
    expect(rowTotal.dataset.cashoutRevealed).toBe('true');
    expect(val1.textContent).toBe('$4');
    expect(val2.textContent).toBe('$6');
    expect(valTotal.textContent).toBe('$10');
    expect(buttonTotal.textContent).toBe('Забрать $10');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(raf.pendingCount()).toBe(0);

    timeline.destroy();
  });

  it('в режиме prefers-reduced-motion мгновенно показывает все строки при start()', () => {
    const raf = createFakeRaf();
    const row1 = document.createElement('div');
    const val1 = document.createElement('strong');
    const onComplete = vi.fn();

    const timeline = createCashoutTimeline({
      rows: [{ rowElement: row1, valueElement: val1, amount: 8, formatAmount: (v) => `$${v}` }],
      reducedMotion: true,
      onComplete,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    timeline.start();
    expect(raf.requestFrame).not.toHaveBeenCalled();
    expect(timeline.isFinished()).toBe(true);
    expect(row1.dataset.cashoutRevealed).toBe('true');
    expect(val1.textContent).toBe('$8');
    expect(onComplete).toHaveBeenCalledTimes(1);

    timeline.destroy();
  });
});
