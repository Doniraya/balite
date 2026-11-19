import { describe, expect, it } from 'vitest';
import {
  createMoveableState,
  hardSetTarget,
  juiceUp,
  setMoveableZoom,
  setTarget,
  stepMoveable,
  type MoveableState,
} from '../../src/ui/moveable';

/**
 * Прогоняет указанное число кадров симуляции Moveable и возвращает траекторию состояний.
 */
function simulateFrames(
  initial: MoveableState,
  frames: number,
  dtSeconds = 1 / 60,
  speedMultiplier = 1,
  reducedMotion = false,
): MoveableState[] {
  const trace: MoveableState[] = [initial];
  let current = initial;
  for (let i = 0; i < frames; i += 1) {
    current = stepMoveable(current, dtSeconds, speedMultiplier, reducedMotion);
    trace.push(current);
  }
  return trace;
}

describe('Пружинный движок Moveable (T -> VT)', () => {
  it('создаёт начальное состояние с VT == T и мгновенно перемещает через hardSetTarget', () => {
    const initial = createMoveableState({ x: 100, y: 200 });
    expect(initial.t).toEqual({ x: 100, y: 200, scale: 1, r: 0 });
    expect(initial.vt).toEqual({ x: 100, y: 200, scale: 1, r: 0 });
    expect(initial.velocity).toEqual({ x: 0, y: 0, scale: 0, r: 0 });
    expect(initial.juice).toBeNull();
    expect(initial.settled).toBe(true);

    const moved = setTarget(initial, { x: 400, y: 500, scale: 1.2, r: 0.2 });
    const juiced = juiceUp(moved, 0.3, 0.25);
    expect(juiced.settled).toBe(false);

    const hard = hardSetTarget(juiced, { x: 25, y: 50, scale: 0.9, r: -0.1 });
    expect(hard.t).toEqual({ x: 25, y: 50, scale: 0.9, r: -0.1 });
    expect(hard.vt).toEqual({ x: 25, y: 50, scale: 0.9, r: -0.1 });
    expect(hard.velocity).toEqual({ x: 0, y: 0, scale: 0, r: 0 });
    expect(hard.juice).toBeNull();
    expect(hard.settled).toBe(true);
    // Исходные объекты не мутируются
    expect(initial.t.x).toBe(100);
  });

  it('плавно сближает VT -> T по x, y, scale, r, добавляет наклон в полёте и устанавливает settled=true', () => {
    const start = createMoveableState({ x: 0, y: 0, scale: 1, r: 0 });
    const targeted = setTarget(start, { x: 360, y: -180, scale: 1.15, r: 0.12 });
    expect(targeted.settled).toBe(false);

    const trace = simulateFrames(targeted, 90, 1 / 60, 1);
    const early = trace[4]!;
    const final = trace[trace.length - 1]!;

    // На раннем кадре карта в полёте и ещё не достигла цели
    expect(early.settled).toBe(false);
    expect(early.vt.x).toBeGreaterThan(0);
    expect(early.vt.x).toBeLessThan(360);
    expect(early.vt.y).toBeLessThan(0);
    expect(early.vt.y).toBeGreaterThan(-180);

    // Через 1.5 сек карта полностью остановилась в целевом трансформе
    expect(final.settled).toBe(true);
    expect(final.vt).toEqual({ x: 360, y: -180, scale: 1.15, r: 0.12 });
    expect(final.velocity).toEqual({ x: 0, y: 0, scale: 0, r: 0 });
  });

  it('работает строго по реальному времени независимо от speedMultiplier (C1)', () => {
    const base = setTarget(createMoveableState({ x: 0, y: 0 }), { x: 300, y: 0 });

    const step05 = stepMoveable(base, 1 / 60, 0.5);
    const step1 = stepMoveable(base, 1 / 60, 1);
    const step2 = stepMoveable(base, 1 / 60, 2);
    const step4 = stepMoveable(base, 1 / 60, 4);

    expect(step05.vt.x).toBeCloseTo(step1.vt.x, 6);
    expect(step1.vt.x).toBeCloseTo(step2.vt.x, 6);
    expect(step2.vt.x).toBeCloseTo(step4.vt.x, 6);

    const countFramesToSettle = (speed: number): number => {
      let cur = base;
      for (let f = 1; f <= 300; f += 1) {
        cur = stepMoveable(cur, 1 / 60, speed);
        if (cur.settled) return f;
      }
      return 301;
    };

    const settle05 = countFramesToSettle(0.5);
    const settle1 = countFramesToSettle(1);
    const settle2 = countFramesToSettle(2);
    const settle4 = countFramesToSettle(4);

    expect(settle05).toBe(settle1);
    expect(settle1).toBe(settle2);
    expect(settle2).toBe(settle4);
    expect(settle1).toBeLessThan(300);
  });

  it('защищается от больших, отрицательных и NaN значений dtSeconds (clamp)', () => {
    const base = setTarget(createMoveableState({ x: 0, y: 0 }), { x: 500, y: 200 });

    const huge = stepMoveable(base, 10, 1);
    const clamped = stepMoveable(base, 0.05, 1);
    expect(huge).toEqual(clamped);
    expect(Number.isFinite(huge.vt.x)).toBe(true);

    const zeroDt = stepMoveable(base, 0, 1);
    expect(zeroDt.vt).toEqual(base.vt);
    expect(zeroDt.settled).toBe(false);

    const badDt = stepMoveable(base, Number.NaN, 1);
    expect(badDt.vt).toEqual(base.vt);

    const negativeDt = stepMoveable(base, -1, 1);
    expect(negativeDt.vt).toEqual(base.vt);
  });

  it('реализует затухающий импульс juiceUp по scale и r с возвратом к T и settled=true', () => {
    const start = createMoveableState({ x: 50, y: 80, scale: 1, r: 0 });
    const juiced = juiceUp(start, 0.4, 0.3);

    expect(juiced.settled).toBe(false);
    expect(juiced.juice).not.toBeNull();
    // Начальный "присед" как в moveable.lua: VT.scale = t.scale - 0.6 * amount
    expect(juiced.vt.scale).toBeCloseTo(1 - 0.6 * 0.4, 5);

    const trace = simulateFrames(juiced, 60, 1 / 60, 1);
    const peakRot = Math.max(...trace.map((frame) => Math.abs(frame.vt.r)));
    const peakScaleDelta = Math.max(...trace.map((frame) => Math.abs(frame.vt.scale - 1)));

    expect(peakRot).toBeGreaterThan(0.05);
    expect(peakScaleDelta).toBeGreaterThan(0.1);

    const end = trace[trace.length - 1]!;
    expect(end.juice).toBeNull();
    expect(end.settled).toBe(true);
    expect(end.vt).toEqual({ x: 50, y: 80, scale: 1, r: 0 });
  });

  it('при reducedMotion=true мгновенно приравнивает VT = T и отключает juice', () => {
    const start = createMoveableState({ x: 10, y: 20, scale: 1, r: 0 });
    const moved = setTarget(start, { x: 400, y: 300, scale: 1.25, r: -0.3 });

    const juicedReduced = juiceUp(moved, 0.5, 0.4, true);
    expect(juicedReduced.juice).toBeNull();

    const stepped = stepMoveable(moved, 1 / 60, 1, true);
    expect(stepped.settled).toBe(true);
    expect(stepped.vt).toEqual(moved.t);
    expect(stepped.velocity).toEqual({ x: 0, y: 0, scale: 0, r: 0 });
    expect(stepped.juice).toBeNull();
  });

  it('не обрезает аэродинамический наклон полёта на 0.35 рад и поддерживает пружинный hover/drag zoom (C2)', () => {
    // Быстрый перелёт на большое расстояние даёт пиковый наклон больше прежнего ограничения 0.35 рад
    const fastFlight = setTarget(createMoveableState({ x: 0, y: 0 }), { x: 1600, y: 0 });
    const trace = simulateFrames(fastFlight, 25, 1 / 60, 1);
    const peakTilt = Math.max(...trace.map((frame) => Math.abs(frame.vt.r)));
    expect(peakTilt).toBeGreaterThan(0.5);

    // Пружинный зум (+0.05 при hover и +0.10 при drag, суммарно +0.15)
    let zoomed = setMoveableZoom(createMoveableState({ scale: 1 }), {
      enabled: true,
      hover: true,
      drag: false,
    });
    expect(zoomed.settled).toBe(false);
    zoomed = simulateFrames(zoomed, 90, 1 / 60, 1).at(-1)!;
    expect(zoomed.settled).toBe(true);
    expect(zoomed.vt.scale).toBeCloseTo(1.05, 4);

    zoomed = setMoveableZoom(zoomed, { drag: true });
    zoomed = simulateFrames(zoomed, 90, 1 / 60, 1).at(-1)!;
    expect(zoomed.settled).toBe(true);
    expect(zoomed.vt.scale).toBeCloseTo(1.15, 4);

    zoomed = setMoveableZoom(zoomed, { hover: false, drag: false });
    zoomed = simulateFrames(zoomed, 90, 1 / 60, 1).at(-1)!;
    expect(zoomed.settled).toBe(true);
    expect(zoomed.vt.scale).toBeCloseTo(1, 4);
  });
});
