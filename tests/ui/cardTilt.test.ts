import { afterEach, describe, expect, it, vi } from 'vitest';
import { initCardTiltController } from '../../src/ui/cardTilt';

/**
 * Создаёт имитацию requestAnimationFrame с ручным управлением кадрами для детерминированных тестов.
 */
function createManualRafDriver() {
  let nextId = 1;
  let currentTimeMs = 1000;
  const callbacks = new Map<number, FrameRequestCallback>();

  return {
    now: () => currentTimeMs,
    requestFrame: (cb: FrameRequestCallback): number => {
      const id = nextId++;
      callbacks.set(id, cb);
      return id;
    },
    cancelFrame: (id: number): void => {
      callbacks.delete(id);
    },
    stepFrames: (count: number, dtMs = 16): void => {
      for (let i = 0; i < count; i += 1) {
        currentTimeMs += dtMs;
        const batch = Array.from(callbacks.entries());
        callbacks.clear();
        for (const [, cb] of batch) {
          cb(currentTimeMs);
        }
      }
    },
    pendingCount: (): number => callbacks.size,
  };
}

/**
 * Создаёт DOM-событие указателя с заданными координатами и типом устройства, совместимое с jsdom.
 */
function createPointerEvent(
  type: string,
  init: {
    clientX?: number;
    clientY?: number;
    pointerType?: string;
    pointerId?: number;
    relatedTarget?: EventTarget | null;
  } = {},
): Event {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    relatedTarget: init.relatedTarget ?? null,
  });
  Object.defineProperty(event, 'pointerType', {
    configurable: true,
    value: init.pointerType ?? 'mouse',
  });
  Object.defineProperty(event, 'pointerId', {
    configurable: true,
    value: init.pointerId ?? 1,
  });
  return event;
}

function createCardElement(id: string, left = 100, top = 200, width = 100, height = 140): HTMLDivElement {
  const slot = document.createElement('div');
  slot.className = 'hand-card-slot';
  slot.dataset.cardId = id;

  const card = document.createElement('div');
  card.className = 'card-frame';
  card.dataset.cardId = id;
  card.getBoundingClientRect = () =>
    ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;

  slot.appendChild(card);
  return slot;
}

describe('initCardTiltController (Story 2.2: 3D-наклон и фазовое парение)', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('вычисляет --tilt-x, --tilt-y, --glare-x, --glare-y по вектору курсора и пружинно возвращает в 0', () => {
    const container = document.createElement('div');
    const slot = createCardElement('card_1', 100, 100, 100, 100);
    const card = slot.querySelector('.card-frame') as HTMLElement;
    container.appendChild(slot);
    document.body.appendChild(container);

    const raf = createManualRafDriver();
    const controller = initCardTiltController({
      container,
      reducedMotion: false,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    // Наведение в правый нижний угол (200, 200) -> вектор (+1, +1), glare (100%, 100%)
    card.dispatchEvent(createPointerEvent('pointerover', { clientX: 200, clientY: 200 }));
    card.dispatchEvent(createPointerEvent('pointermove', { clientX: 200, clientY: 200 }));
    raf.stepFrames(30, 16);

    expect(Number(card.style.getPropertyValue('--tilt-x'))).toBeCloseTo(1, 1);
    expect(Number(card.style.getPropertyValue('--tilt-y'))).toBeCloseTo(1, 1);
    expect(parseFloat(card.style.getPropertyValue('--glare-x'))).toBeCloseTo(100, 0);
    expect(parseFloat(card.style.getPropertyValue('--glare-y'))).toBeCloseTo(100, 0);

    // Перемещение в левый верхний угол (100, 100) -> вектор (-1, -1), glare (0%, 0%)
    card.dispatchEvent(createPointerEvent('pointermove', { clientX: 100, clientY: 100 }));
    raf.stepFrames(30, 16);

    expect(Number(card.style.getPropertyValue('--tilt-x'))).toBeCloseTo(-1, 1);
    expect(Number(card.style.getPropertyValue('--tilt-y'))).toBeCloseTo(-1, 1);
    expect(parseFloat(card.style.getPropertyValue('--glare-x'))).toBeCloseTo(0, 0);
    expect(parseFloat(card.style.getPropertyValue('--glare-y'))).toBeCloseTo(0, 0);

    // Уход курсора -> пружинный возврат наклона к 0
    card.dispatchEvent(
      createPointerEvent('pointerout', {
        clientX: 0,
        clientY: 0,
        relatedTarget: container,
      }),
    );
    raf.stepFrames(5, 16);
    expect(Math.abs(Number(card.style.getPropertyValue('--tilt-x')))).toBeLessThan(1);

    raf.stepFrames(45, 16);
    expect(Number(card.style.getPropertyValue('--tilt-x'))).toBeCloseTo(0, 2);
    expect(Number(card.style.getPropertyValue('--tilt-y'))).toBeCloseTo(0, 2);

    controller.destroy();
  });

  it('игнорирует залипающий ховер на touch, но реагирует на удержание пальца со сбросом на pointerup/pointercancel', () => {
    const container = document.createElement('div');
    const slot = createCardElement('card_touch', 0, 0, 100, 100);
    const card = slot.querySelector('.card-frame') as HTMLElement;
    container.appendChild(slot);
    document.body.appendChild(container);

    const raf = createManualRafDriver();
    const controller = initCardTiltController({
      container,
      reducedMotion: false,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    // Синтетический hover от touch без pointerdown не наклоняет карту
    card.dispatchEvent(
      createPointerEvent('pointerover', { clientX: 100, clientY: 100, pointerType: 'touch' }),
    );
    card.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 100, clientY: 100, pointerType: 'touch' }),
    );
    raf.stepFrames(20, 16);

    expect(Number(card.style.getPropertyValue('--tilt-x'))).toBe(0);
    expect(Number(card.style.getPropertyValue('--tilt-y'))).toBe(0);

    // Активный touch-контакт (pointerdown -> pointermove -> pointerup)
    card.dispatchEvent(
      createPointerEvent('pointerdown', {
        clientX: 100,
        clientY: 0,
        pointerType: 'touch',
        pointerId: 7,
      }),
    );
    raf.stepFrames(25, 16);
    expect(Number(card.style.getPropertyValue('--tilt-x'))).toBeGreaterThan(0.5);
    expect(Number(card.style.getPropertyValue('--tilt-y'))).toBeLessThan(-0.5);

    card.dispatchEvent(
      createPointerEvent('pointerup', {
        clientX: 100,
        clientY: 0,
        pointerType: 'touch',
        pointerId: 7,
      }),
    );
    raf.stepFrames(45, 16);
    expect(Number(card.style.getPropertyValue('--tilt-x'))).toBeCloseTo(0, 2);
    expect(Number(card.style.getPropertyValue('--tilt-y'))).toBeCloseTo(0, 2);

    controller.destroy();
  });

  it('разводит фазы парения между картами и ставит парение на паузу при наведении, выделении или полёте', () => {
    const container = document.createElement('div');
    const slot1 = createCardElement('card_alpha', 0, 0, 100, 140);
    const slot2 = createCardElement('card_beta', 120, 0, 100, 140);
    const card1 = slot1.querySelector('.card-frame') as HTMLElement;
    const card2 = slot2.querySelector('.card-frame') as HTMLElement;
    container.append(slot1, slot2);
    document.body.appendChild(container);

    const raf = createManualRafDriver();
    const controller = initCardTiltController({
      container,
      reducedMotion: false,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    raf.stepFrames(15, 16);
    const swayR1 = parseFloat(card1.style.getPropertyValue('--sway-r'));
    const swayR2 = parseFloat(card2.style.getPropertyValue('--sway-r'));
    const swayY1 = parseFloat(card1.style.getPropertyValue('--sway-y'));
    const swayY2 = parseFloat(card2.style.getPropertyValue('--sway-y'));

    expect(Number.isFinite(swayR1)).toBe(true);
    expect(Number.isFinite(swayR2)).toBe(true);
    expect(Math.abs(swayR1) + Math.abs(swayR2)).toBeGreaterThan(0.05);
    expect(swayR1).not.toBeCloseTo(swayR2, 3);
    expect(swayY1).not.toBeCloseTo(swayY2, 3);

    // При выделении слота 1 и полёте слота 2 их парение затухает к 0
    slot1.classList.add('is-selected');
    slot2.dataset.flightActive = 'true';
    raf.stepFrames(35, 16);

    expect(parseFloat(card1.style.getPropertyValue('--sway-r'))).toBeCloseTo(0, 1);
    expect(parseFloat(card1.style.getPropertyValue('--sway-y'))).toBeCloseTo(0, 1);
    expect(parseFloat(card2.style.getPropertyValue('--sway-r'))).toBeCloseTo(0, 1);
    expect(parseFloat(card2.style.getPropertyValue('--sway-y'))).toBeCloseTo(0, 1);

    controller.destroy();
  });

  it('учитывает prefers-reduced-motion и полностью очищает переменные/rAF в refresh() и destroy()', () => {
    const container = document.createElement('div');
    const slot = createCardElement('card_rm', 50, 50, 100, 140);
    const card = slot.querySelector('.card-frame') as HTMLElement;
    container.appendChild(slot);
    document.body.appendChild(container);

    const raf = createManualRafDriver();
    const reducedController = initCardTiltController({
      container,
      reducedMotion: true,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    card.dispatchEvent(createPointerEvent('pointerover', { clientX: 150, clientY: 190 }));
    card.dispatchEvent(createPointerEvent('pointermove', { clientX: 150, clientY: 190 }));
    expect(raf.pendingCount()).toBe(0);
    expect(card.style.getPropertyValue('--tilt-x')).toBe('0');
    expect(card.style.getPropertyValue('--sway-r')).toBe('0deg');
    reducedController.destroy();

    // Проверка refresh() и destroy() в активном режиме
    const activeController = initCardTiltController({
      container,
      reducedMotion: false,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });
    expect(raf.pendingCount()).toBe(1);

    const slotNew = createCardElement('card_new', 200, 50, 100, 140);
    const cardNew = slotNew.querySelector('.card-frame') as HTMLElement;
    container.replaceChildren(slotNew);
    activeController.refresh();

    raf.stepFrames(10, 16);
    expect(cardNew.style.getPropertyValue('--sway-r')).not.toBe('');

    activeController.destroy();
    expect(raf.pendingCount()).toBe(0);
    expect(cardNew.style.getPropertyValue('--tilt-x')).toBe('');
    expect(cardNew.style.getPropertyValue('--sway-r')).toBe('');
    expect(cardNew.style.getPropertyValue('--glare-x')).toBe('');
  });

  it('различает амплитуду бегущей волны в обычной руке, бустере и расходниках (C3)', () => {
    const container = document.createElement('div');

    const handZone = document.createElement('div');
    handZone.className = 'hand-fan';
    const handSlot = createCardElement('hand_a', 100, 100, 80, 112);
    handSlot.dataset.zone = 'hand';
    const handCard = handSlot.querySelector('.card-frame') as HTMLElement;
    handZone.append(handSlot);

    const boosterZone = document.createElement('div');
    boosterZone.className = 'hand-fan hand-fan--booster';
    const boosterSlot = createCardElement('boost_a', 100, 100, 80, 112);
    boosterSlot.dataset.zone = 'hand';
    const boosterCard = boosterSlot.querySelector('.card-frame') as HTMLElement;
    boosterZone.append(boosterSlot);

    const consumableSlot = createCardElement('cons_a', 100, 100, 80, 112);
    consumableSlot.dataset.zone = 'consumable';
    const consumableCard = consumableSlot.querySelector('.card-frame') as HTMLElement;

    container.append(handZone, boosterZone, consumableSlot);
    document.body.append(container);

    const raf = createManualRafDriver();
    const controller = initCardTiltController({
      container,
      reducedMotion: false,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    raf.stepFrames(25, 40);

    const handSwayY = Math.abs(parseFloat(handCard.style.getPropertyValue('--sway-y')));
    const boosterSwayY = Math.abs(parseFloat(boosterCard.style.getPropertyValue('--sway-y')));
    expect(boosterSwayY).toBeGreaterThan(handSwayY * 2);
    expect(parseFloat(consumableCard.style.getPropertyValue('--sway-r'))).toBeCloseTo(0, 4);

    controller.destroy();
  });

  it('автоматически подхватывает новые карты через MutationObserver при переключении вкладок (replaceChildren без ручного refresh)', async () => {
    const container = document.createElement('div');
    const tabHost = document.createElement('div');
    const slotInitial = createCardElement('deck_rem_1', 80, 120, 64, 90);
    tabHost.appendChild(slotInitial);
    container.appendChild(tabHost);
    document.body.appendChild(container);

    const raf = createManualRafDriver();
    const controller = initCardTiltController({
      container,
      reducedMotion: false,
      now: raf.now,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    raf.stepFrames(5, 16);
    const cardInitial = slotInitial.querySelector('.card-frame') as HTMLElement;
    expect(cardInitial.style.getPropertyValue('--sway-r')).not.toBe('');

    // Имитируем переключение вкладки «Оставшаяся колода» -> «Полная колода» без вызова controller.refresh()
    const slotFull = createCardElement('deck_full_1', 140, 120, 64, 90);
    const cardFull = slotFull.querySelector('.card-frame') as HTMLElement;
    tabHost.replaceChildren(slotFull);

    // Даём отработать MutationObserver и микротаску scheduleRefresh
    await Promise.resolve();
    await Promise.resolve();

    raf.stepFrames(8, 16);
    expect(cardFull.style.getPropertyValue('--sway-r')).not.toBe('');
    expect(cardFull.style.getPropertyValue('--sway-y')).not.toBe('');

    controller.destroy();
  });
});
