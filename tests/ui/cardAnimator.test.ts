import { afterEach, describe, expect, it } from 'vitest';
import { createCardAnimator } from '../../src/ui/cardAnimator';

interface RectBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Создаёт детерминированный планировщик requestAnimationFrame для тестов CardAnimator.
 */
function createManualFrameScheduler() {
  let nowMs = 0;
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  const canceledIds: number[] = [];

  const requestFrame = (cb: FrameRequestCallback): number => {
    const id = nextId++;
    callbacks.set(id, cb);
    return id;
  };

  const cancelFrame = (id: number): void => {
    canceledIds.push(id);
    callbacks.delete(id);
  };

  const step = (dtMs = 16): void => {
    nowMs += dtMs;
    const batch = [...callbacks.entries()];
    callbacks.clear();
    for (const [, cb] of batch) {
      cb(nowMs);
    }
  };

  const runUntilIdle = (maxFrames = 240, dtMs = 16): number => {
    let frames = 0;
    while (callbacks.size > 0 && frames < maxFrames) {
      step(dtMs);
      frames += 1;
    }
    return frames;
  };

  return {
    now: () => nowMs,
    requestFrame,
    cancelFrame,
    step,
    runUntilIdle,
    getPendingCount: () => callbacks.size,
    canceledIds,
  };
}

/**
 * Привязывает мок getBoundingClientRect к DOM-элементу.
 */
function mockElementRect(el: HTMLElement, box: RectBox): void {
  const rect = {
    x: box.left,
    y: box.top,
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    right: box.left + box.width,
    bottom: box.top + box.height,
    toJSON: () => ({}),
  } as DOMRect;
  el.getBoundingClientRect = () => rect;
}

/**
 * Создаёт слот карты с внутренним card-frame (оба имеют data-card-id, как в screens.ts).
 */
function createCardSlot(options: {
  cardId: string;
  zone: 'hand' | 'play';
  rect: RectBox;
  fanAngleDeg?: number;
  fanOffsetY?: number;
  selected?: boolean;
  shattered?: boolean;
}): HTMLElement {
  const slot = document.createElement('div');
  slot.className = options.zone === 'hand' ? 'hand-card-slot' : 'play-zone__card';
  if (options.selected) slot.classList.add('is-selected');
  if (options.shattered) {
    slot.classList.add('is-shattered');
    slot.dataset.shattered = 'true';
  }
  slot.dataset.cardId = options.cardId;
  slot.dataset.zone = options.zone;
  if (options.fanAngleDeg !== undefined) {
    slot.style.setProperty('--fan-angle', `${options.fanAngleDeg.toFixed(2)}deg`);
  }
  if (options.fanOffsetY !== undefined) {
    slot.style.setProperty('--fan-offset-y', `${options.fanOffsetY.toFixed(1)}px`);
  }

  const innerFrame = document.createElement('div');
  innerFrame.className = 'card-frame';
  innerFrame.dataset.cardId = options.cardId;
  slot.append(innerFrame);

  mockElementRect(slot, options.rect);
  mockElementRect(innerFrame, options.rect);
  return slot;
}

function createStagePair() {
  const container = document.createElement('div');
  container.className = 'stage-screen-host';
  mockElementRect(container, { left: 0, top: 0, width: 720, height: 1280 });

  const flightLayer = document.createElement('div');
  flightLayer.className = 'card-flight-layer';
  mockElementRect(flightLayer, { left: 0, top: 0, width: 720, height: 1280 });

  document.body.append(container, flightLayer);
  return { container, flightLayer };
}

function createDeckBtn(rect: RectBox = { left: 600, top: 1120, width: 70, height: 96 }): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'deck-stack-btn';
  btn.dataset.deckStack = 'true';
  mockElementRect(btn, rect);
  return btn;
}

describe('CardAnimator (пружинные полёты карт поверх Moveable)', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('захватывает только слоты [data-zone][data-card-id] (не дублируя внутренний .card-frame) и rect стопки колоды', () => {
    const { container, flightLayer } = createStagePair();
    const deckBtn = createDeckBtn({ left: 610, top: 1100, width: 72, height: 100 });
    const c1 = createCardSlot({
      cardId: 'card_1',
      zone: 'hand',
      rect: { left: 100, top: 960, width: 80, height: 112 },
      fanAngleDeg: -6,
      fanOffsetY: 4,
      selected: true,
    });
    const c2 = createCardSlot({
      cardId: 'card_2',
      zone: 'play',
      rect: { left: 300, top: 520, width: 80, height: 112 },
    });
    container.append(c2, c1, deckBtn);

    const animator = createCardAnimator({ flightLayer });
    const snapshot = animator.captureSnapshot(container);

    expect(snapshot.cards.size).toBe(2);
    const snap1 = snapshot.cards.get('card_1');
    expect(snap1?.zone).toBe('hand');
    expect(snap1?.selected).toBe(true);
    expect(snap1?.fanOffsetY).toBe(4);
    expect(snap1?.fanAngleRad).toBeCloseTo((-6 * Math.PI) / 180, 5);
    expect(snapshot.deckRect?.left).toBe(610);
    expect(snapshot.cards.get('card_2')?.zone).toBe('play');
    animator.destroy();
  });

  it('анимирует добор новой карты из стопки колоды в руку и очищает inline transform после остановки', () => {
    const { container, flightLayer } = createStagePair();
    const scheduler = createManualFrameScheduler();
    const animator = createCardAnimator({
      flightLayer,
      requestFrame: scheduler.requestFrame,
      cancelFrame: scheduler.cancelFrame,
      now: scheduler.now,
      prefersReducedMotion: () => false,
    });

    const deckBefore = createDeckBtn({ left: 600, top: 1120, width: 70, height: 96 });
    const existing = createCardSlot({
      cardId: 'card_old',
      zone: 'hand',
      rect: { left: 180, top: 960, width: 80, height: 112 },
    });
    container.append(existing, deckBefore);

    const snapshot = animator.captureSnapshot(container);

    // Перерендер после добора card_new
    const deckAfter = createDeckBtn({ left: 600, top: 1120, width: 70, height: 96 });
    const existingAfter = createCardSlot({
      cardId: 'card_old',
      zone: 'hand',
      rect: { left: 140, top: 960, width: 80, height: 112 },
    });
    const dealtCard = createCardSlot({
      cardId: 'card_new',
      zone: 'hand',
      rect: { left: 260, top: 960, width: 80, height: 112 },
      fanAngleDeg: 5,
    });
    container.replaceChildren(existingAfter, dealtCard, deckAfter);

    const startedCount = animator.animateFromSnapshot(container, snapshot, { speed: 1 });
    expect(startedCount).toBe(2);
    expect(dealtCard.dataset.flightActive).toBe('true');
    expect(dealtCard.style.transform).toContain('translate3d(');
    expect(dealtCard.style.transform).not.toContain('translate3d(0.00px, 0.00px');

    const frames = scheduler.runUntilIdle();
    expect(frames).toBeGreaterThan(2);
    expect(frames).toBeLessThan(200);
    expect(animator.getActiveFlightCount()).toBe(0);
    expect(dealtCard.style.transform).toBe('');
    expect(dealtCard.dataset.flightActive).toBeUndefined();
    expect(existingAfter.style.transform).toBe('');
    expect(existingAfter.dataset.flightActive).toBeUndefined();

    animator.destroy();
  });

  it('анимирует перелёт разыгранной карты из руки в Play Zone и сортировку руки без скачка угла', () => {
    const { container, flightLayer } = createStagePair();
    const scheduler = createManualFrameScheduler();
    const animator = createCardAnimator({
      flightLayer,
      requestFrame: scheduler.requestFrame,
      cancelFrame: scheduler.cancelFrame,
      now: scheduler.now,
      prefersReducedMotion: () => false,
    });

    const handCard1 = createCardSlot({
      cardId: 'card_play',
      zone: 'hand',
      rect: { left: 160, top: 960, width: 80, height: 112 },
      fanAngleDeg: -4,
      fanOffsetY: 3,
    });
    const handCard2 = createCardSlot({
      cardId: 'card_stay',
      zone: 'hand',
      rect: { left: 320, top: 960, width: 80, height: 112 },
      fanAngleDeg: 4,
      fanOffsetY: 3,
    });
    container.append(handCard1, handCard2);

    const snapshot = animator.captureSnapshot(container);

    // card_play уходит в Play Zone, card_stay сдвигается к центру с углом 0deg
    const playedInArena = createCardSlot({
      cardId: 'card_play',
      zone: 'play',
      rect: { left: 310, top: 520, width: 88, height: 122 },
    });
    const stayAfter = createCardSlot({
      cardId: 'card_stay',
      zone: 'hand',
      rect: { left: 260, top: 956, width: 80, height: 112 },
      fanAngleDeg: 0,
      fanOffsetY: 0,
    });
    container.replaceChildren(playedInArena, stayAfter);

    const count = animator.animateFromSnapshot(container, snapshot, { speed: 1 });
    expect(count).toBe(2);
    expect(playedInArena.dataset.flightActive).toBe('true');
    expect(playedInArena.style.transform).toContain('translate3d(');
    expect(stayAfter.dataset.flightActive).toBe('true');

    // После одного кадра delta остаётся ненулевой и приближается к цели
    scheduler.step(16);
    expect(playedInArena.style.transform).toContain('translate3d(');

    scheduler.runUntilIdle();
    expect(playedInArena.style.transform).toBe('');
    expect(playedInArena.dataset.flightActive).toBeUndefined();
    expect(stayAfter.style.transform).toBe('');
    animator.destroy();
  });

  it('создаёт призрака в flightLayer для сброшенных/ушедших карт и удаляет его после завершения полёта', () => {
    const { container, flightLayer } = createStagePair();
    const scheduler = createManualFrameScheduler();
    const animator = createCardAnimator({
      flightLayer,
      requestFrame: scheduler.requestFrame,
      cancelFrame: scheduler.cancelFrame,
      now: scheduler.now,
      prefersReducedMotion: () => false,
    });

    const discardCard = createCardSlot({
      cardId: 'card_discard',
      zone: 'hand',
      rect: { left: 220, top: 960, width: 80, height: 112 },
    });
    const keptCard = createCardSlot({
      cardId: 'card_keep',
      zone: 'hand',
      rect: { left: 320, top: 960, width: 80, height: 112 },
    });
    container.append(discardCard, keptCard);

    const snapshot = animator.captureSnapshot(container);

    const keptAfter = createCardSlot({
      cardId: 'card_keep',
      zone: 'hand',
      rect: { left: 270, top: 960, width: 80, height: 112 },
    });
    container.replaceChildren(keptAfter);

    const started = animator.animateFromSnapshot(container, snapshot, { speed: 1 });
    expect(started).toBe(2);

    const ghosts = flightLayer.querySelectorAll('.card-flight-ghost');
    expect(ghosts.length).toBe(1);
    const ghost = ghosts[0] as HTMLElement;
    expect(ghost.getAttribute('role')).toBeNull();
    expect(ghost.getAttribute('tabindex')).toBeNull();

    scheduler.step(32);
    expect(ghost.style.transform).toContain('translate3d(');

    scheduler.runUntilIdle();
    expect(flightLayer.querySelectorAll('.card-flight-ghost').length).toBe(0);
    expect(animator.getActiveFlightCount()).toBe(0);
    animator.destroy();
  });

  it('ускоряет завершение полёта при speed = 4 по сравнению со speed = 0.5', () => {
    const runWithSpeed = (speed: 0.5 | 4): number => {
      const { container, flightLayer } = createStagePair();
      const scheduler = createManualFrameScheduler();
      const animator = createCardAnimator({
        flightLayer,
        requestFrame: scheduler.requestFrame,
        cancelFrame: scheduler.cancelFrame,
        now: scheduler.now,
        prefersReducedMotion: () => false,
      });

      const slotBefore = createCardSlot({
        cardId: 'card_speed',
        zone: 'hand',
        rect: { left: 80, top: 960, width: 80, height: 112 },
      });
      container.append(slotBefore);
      const snapshot = animator.captureSnapshot(container);

      const slotAfter = createCardSlot({
        cardId: 'card_speed',
        zone: 'play',
        rect: { left: 340, top: 480, width: 80, height: 112 },
      });
      container.replaceChildren(slotAfter);

      animator.animateFromSnapshot(container, snapshot, { speed });
      const frames = scheduler.runUntilIdle(400, 16);
      animator.destroy();
      return frames;
    };

    const framesSlow = runWithSpeed(0.5);
    const framesFast = runWithSpeed(4);
    expect(framesFast).toBeLessThan(framesSlow);
    expect(framesFast * 2).toBeLessThan(framesSlow);
  });

  it('мгновенно завершает без rAF и призраков при prefers-reduced-motion: reduce', () => {
    const { container, flightLayer } = createStagePair();
    const scheduler = createManualFrameScheduler();
    const animator = createCardAnimator({
      flightLayer,
      requestFrame: scheduler.requestFrame,
      cancelFrame: scheduler.cancelFrame,
      now: scheduler.now,
      prefersReducedMotion: () => true,
    });

    const card1 = createCardSlot({
      cardId: 'card_rm_1',
      zone: 'hand',
      rect: { left: 100, top: 960, width: 80, height: 112 },
    });
    const card2 = createCardSlot({
      cardId: 'card_rm_2',
      zone: 'hand',
      rect: { left: 220, top: 960, width: 80, height: 112 },
    });
    container.append(card1, card2);
    const snapshot = animator.captureSnapshot(container);

    const card1Play = createCardSlot({
      cardId: 'card_rm_1',
      zone: 'play',
      rect: { left: 300, top: 500, width: 80, height: 112 },
    });
    container.replaceChildren(card1Play);

    const started = animator.animateFromSnapshot(container, snapshot, { speed: 1 });
    expect(started).toBe(0);
    expect(scheduler.getPendingCount()).toBe(0);
    expect(flightLayer.children.length).toBe(0);
    expect(card1Play.style.transform).toBe('');
    expect(card1Play.dataset.flightActive).toBeUndefined();
    animator.destroy();
  });

  it('destroy() отменяет pending rAF, очищает style.transform у живых карт и удаляет незавершённых призраков', () => {
    const { container, flightLayer } = createStagePair();
    const scheduler = createManualFrameScheduler();
    const animator = createCardAnimator({
      flightLayer,
      requestFrame: scheduler.requestFrame,
      cancelFrame: scheduler.cancelFrame,
      now: scheduler.now,
      prefersReducedMotion: () => false,
    });

    const liveBefore = createCardSlot({
      cardId: 'card_live',
      zone: 'hand',
      rect: { left: 100, top: 960, width: 80, height: 112 },
    });
    const ghostBefore = createCardSlot({
      cardId: 'card_gone',
      zone: 'hand',
      rect: { left: 220, top: 960, width: 80, height: 112 },
    });
    container.append(liveBefore, ghostBefore);
    const snapshot = animator.captureSnapshot(container);

    const liveAfter = createCardSlot({
      cardId: 'card_live',
      zone: 'play',
      rect: { left: 300, top: 520, width: 80, height: 112 },
    });
    container.replaceChildren(liveAfter);

    animator.animateFromSnapshot(container, snapshot, { speed: 1 });
    expect(scheduler.getPendingCount()).toBe(1);
    expect(flightLayer.querySelectorAll('.card-flight-ghost').length).toBe(1);
    expect(liveAfter.dataset.flightActive).toBe('true');

    animator.destroy();
    expect(scheduler.canceledIds.length).toBe(1);
    expect(scheduler.getPendingCount()).toBe(0);
    expect(flightLayer.querySelectorAll('.card-flight-ghost').length).toBe(0);
    expect(liveAfter.style.transform).toBe('');
    expect(liveAfter.dataset.flightActive).toBeUndefined();
    expect(animator.getActiveFlightCount()).toBe(0);
  });

  describe('Story 2.3: пружинный импульс triggerJuice (Moveable juice_up)', () => {
    it('запускает пружинный рывок-поворот scale+r на слоте карты, реликвии и HUD-плитке и очищает transform после остановки', () => {
      const { container, flightLayer } = createStagePair();
      const scheduler = createManualFrameScheduler();
      const animator = createCardAnimator({
        flightLayer,
        requestFrame: scheduler.requestFrame,
        cancelFrame: scheduler.cancelFrame,
        now: scheduler.now,
        prefersReducedMotion: () => false,
      });

      const playSlot = createCardSlot({
        cardId: 'card_juice_play',
        zone: 'play',
        rect: { left: 260, top: 520, width: 88, height: 122 },
      });
      playSlot.classList.add('is-highlighted');

      const handSlot = createCardSlot({
        cardId: 'card_juice_hand',
        zone: 'hand',
        rect: { left: 160, top: 960, width: 80, height: 112 },
        fanAngleDeg: -8,
        fanOffsetY: 6,
      });

      const hudChipsPill = document.createElement('div');
      hudChipsPill.className = 'hud-pill hud-pill--chips';

      container.append(playSlot, handSlot, hudChipsPill);

      expect(animator.triggerJuice(playSlot, { scaleDelta: 0.28, rotDelta: 0.12 })).toBe(true);
      expect(animator.triggerJuice(handSlot, { scaleDelta: 0.22, rotDelta: -0.08 })).toBe(true);
      expect(animator.triggerJuice(hudChipsPill, { scaleDelta: 0.2, rotDelta: 0.05 })).toBe(true);

      expect(playSlot.dataset.flightActive).toBe('true');
      expect(playSlot.style.transform).toContain('scale(');
      expect(playSlot.style.transform).toMatch(/-6(?:\.00)?px/);
      expect(handSlot.style.transform).toMatch(/-8(?:\.00)?deg/);
      expect(hudChipsPill.dataset.flightActive).toBe('true');
      expect(scheduler.getPendingCount()).toBe(1);

      scheduler.step(16);
      scheduler.step(16);
      expect(playSlot.style.transform).toContain('rotate(');
      expect(hudChipsPill.style.transform).toContain('scale(');

      const frames = scheduler.runUntilIdle(180, 16);
      expect(frames).toBeGreaterThan(3);
      expect(animator.getActiveFlightCount()).toBe(0);
      expect(playSlot.style.transform).toBe('');
      expect(playSlot.dataset.flightActive).toBeUndefined();
      expect(handSlot.style.transform).toBe('');
      expect(hudChipsPill.style.transform).toBe('');

      animator.destroy();
    });

    it('не запускает rAF в triggerJuice при prefers-reduced-motion: reduce и корректно обрабатывает null', () => {
      const { container, flightLayer } = createStagePair();
      const scheduler = createManualFrameScheduler();
      const animator = createCardAnimator({
        flightLayer,
        requestFrame: scheduler.requestFrame,
        cancelFrame: scheduler.cancelFrame,
        now: scheduler.now,
        prefersReducedMotion: () => true,
      });

      const slot = createCardSlot({
        cardId: 'card_juice_rm',
        zone: 'play',
        rect: { left: 200, top: 500, width: 80, height: 112 },
      });
      container.append(slot);

      expect(animator.triggerJuice(null)).toBe(false);
      expect(animator.triggerJuice(slot, { scaleDelta: 0.3, rotDelta: 0.1 })).toBe(false);
      expect(scheduler.getPendingCount()).toBe(0);
      expect(slot.style.transform).toBe('');
      expect(slot.dataset.flightActive).toBeUndefined();

      animator.destroy();
    });
  });
});
