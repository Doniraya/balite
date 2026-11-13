import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearTooltipData,
  initHoverTooltip,
  setTooltipData,
  type HoverTooltipController,
  type TooltipData,
} from '../../src/ui/tooltip';

/**
 * Создаёт синтетическое pointer-событие с явным pointerType для среды jsdom.
 */
function dispatchPointer(
  target: EventTarget,
  type: 'pointerover' | 'pointerout' | 'pointerdown' | 'pointercancel',
  options: {
    readonly pointerType?: string;
    readonly relatedTarget?: EventTarget | null;
    readonly clientX?: number;
    readonly clientY?: number;
  } = {},
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    relatedTarget: options.relatedTarget ?? null,
    clientX: options.clientX ?? 0,
    clientY: options.clientY ?? 0,
  });

  if (options.pointerType !== undefined) {
    Object.defineProperty(event, 'pointerType', {
      configurable: true,
      value: options.pointerType,
    });
  }

  target.dispatchEvent(event);
}

/**
 * Подменяет window.matchMedia для эмуляции `(pointer: fine)` или `(pointer: coarse)`.
 */
function mockFinePointerMatch(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes('pointer: fine') ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

/**
 * Настраивает размеры viewport и мокает getBoundingClientRect для указанного элемента.
 */
function mockElementRect(
  el: HTMLElement,
  rect: { left: number; top: number; width: number; height: number },
): void {
  const domRect = {
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => ({}),
  } as DOMRect;

  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(domRect);
}

/**
 * Задаёт размеры viewport для проверки позиционирования тултипа.
 */
function setViewportSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: height,
  });
}

describe('Модуль мгновенных ховер-тултипов для ПК (Story 1.4)', () => {
  let root: HTMLDivElement;
  let controller: HoverTooltipController | null;

  beforeEach(() => {
    setViewportSize(1280, 800);
    mockFinePointerMatch(true);
    root = document.createElement('div');
    document.body.appendChild(root);
    controller = null;
  });

  afterEach(() => {
    controller?.destroy();
    controller = null;
    root.remove();
    vi.restoreAllMocks();
  });

  it('мгновенно показывает title, subtitle/rarity/price, description и бейджи при наведении мыши и не перехватывает клики', () => {
    controller = initHoverTooltip({ container: root });

    const relicSlot = document.createElement('div');
    relicSlot.className = 'inventory-slot';
    const childIcon = document.createElement('span');
    relicSlot.appendChild(childIcon);
    root.appendChild(relicSlot);

    const relicData: TooltipData = {
      kind: 'relic',
      title: 'Путевой камень',
      subtitle: 'Реликвия',
      rarity: 'Редкая',
      price: '8 з.',
      description: '+4 Множ при подсчёте',
      badges: [
        { label: 'Тиснёное (+50 Силы)', kind: 'edition', tone: 'blue' },
        { label: 'Золотая печать', kind: 'seal', tone: 'gold' },
      ],
    };
    setTooltipData(relicSlot, relicData);
    mockElementRect(relicSlot, { left: 400, top: 300, width: 100, height: 140 });
    mockElementRect(controller.getElement(), { left: 0, top: 0, width: 220, height: 110 });

    // Наведение даже на вложенный дочерний узел открывает тултип родительского слота
    dispatchPointer(childIcon, 'pointerover', { pointerType: 'mouse' });

    const tooltipEl = controller.getElement();
    expect(controller.isVisible()).toBe(true);
    expect(tooltipEl.hidden).toBe(false);
    expect(tooltipEl.style.pointerEvents).toBe('none');
    expect(tooltipEl.textContent).toContain('Путевой камень');
    expect(tooltipEl.textContent).toContain('Реликвия');
    expect(tooltipEl.textContent).toContain('Редкая');
    expect(tooltipEl.textContent).toContain('8 з.');
    expect(tooltipEl.textContent).toContain('+4 Множ при подсчёте');
    expect(tooltipEl.textContent).toContain('Тиснёное (+50 Силы)');
    expect(tooltipEl.textContent).toContain('Золотая печать');

    // Перемещение на другой дочерний узел внутри той же карточки не скрывает тултип
    const secondChild = document.createElement('span');
    relicSlot.appendChild(secondChild);
    dispatchPointer(childIcon, 'pointerout', {
      pointerType: 'mouse',
      relatedTarget: secondChild,
    });
    expect(controller.isVisible()).toBe(true);

    // Уход курсора за пределы слота мгновенно скрывает тултип
    dispatchPointer(relicSlot, 'pointerout', {
      pointerType: 'mouse',
      relatedTarget: root,
    });
    expect(controller.isVisible()).toBe(false);
    expect(tooltipEl.hidden).toBe(true);
  });

  it('поддерживает декларативный формат data-tooltip-* атрибутов на любых игровых сущностях', () => {
    controller = initHoverTooltip({ container: root });

    const tagBadge = document.createElement('span');
    tagBadge.dataset.tooltipKind = 'tag';
    tagBadge.dataset.tooltipTitle = 'Знак Величия';
    tagBadge.dataset.tooltipSubtitle = 'Знак';
    tagBadge.dataset.tooltipDescription = 'Следующая Редкая Реликвия в лавке станет бесплатной';
    tagBadge.dataset.tooltipPrice = 'Бесплатно';
    tagBadge.dataset.tooltipBadges = JSON.stringify([
      { label: 'Пылающая', kind: 'enhancement', tone: 'gold' },
    ]);
    root.appendChild(tagBadge);

    mockElementRect(tagBadge, { left: 200, top: 250, width: 90, height: 32 });
    mockElementRect(controller.getElement(), { left: 0, top: 0, width: 200, height: 90 });

    dispatchPointer(tagBadge, 'pointerover', { pointerType: 'mouse' });

    const tooltipEl = controller.getElement();
    expect(controller.isVisible()).toBe(true);
    expect(tooltipEl.dataset.kind).toBe('tag');
    expect(tooltipEl.textContent).toContain('Знак Величия');
    expect(tooltipEl.textContent).toContain('Знак');
    expect(tooltipEl.textContent).toContain('Следующая Редкая Реликвия в лавке станет бесплатной');
    expect(tooltipEl.textContent).toContain('Бесплатно');
    expect(tooltipEl.textContent).toContain('Пылающая');
  });

  it('срабатывает при (pointer: fine) даже если pointerType отсутствует, но игнорирует и скрывает на touch', () => {
    controller = initHoverTooltip({ container: root });

    const card = document.createElement('div');
    setTooltipData(card, {
      title: 'Туз Пик',
      description: '+11 Силы',
    });
    root.appendChild(card);

    mockElementRect(card, { left: 300, top: 500, width: 80, height: 112 });
    mockElementRect(controller.getElement(), { left: 0, top: 0, width: 180, height: 80 });

    // Если pointerType не указан, но matchMedia('(pointer: fine)').matches === true — показываем
    dispatchPointer(card, 'pointerover');
    expect(controller.isVisible()).toBe(true);

    // Тач-событие на гибридном устройстве (даже при pointer: fine) НЕ должно оставлять тултип открытым
    dispatchPointer(card, 'pointerdown', { pointerType: 'touch' });
    expect(controller.isVisible()).toBe(false);

    // Повторный pointerover с pointerType: 'touch' полностью игнорируется
    dispatchPointer(card, 'pointerover', { pointerType: 'touch' });
    expect(controller.isVisible()).toBe(false);

    // На чистом тач-устройстве без pointer: fine событие без pointerType не показывает тултип
    mockFinePointerMatch(false);
    dispatchPointer(card, 'pointerover');
    expect(controller.isVisible()).toBe(false);

    // При явной мыши (pointerType: 'mouse') тултип всё равно работает
    dispatchPointer(card, 'pointerover', { pointerType: 'mouse' });
    expect(controller.isVisible()).toBe(true);
  });

  it('обязательно скрывает ранг, масть и модификаторы карты при facing === "back" или флаге скрытия', () => {
    controller = initHoverTooltip({
      container: root,
      defaultHiddenTitle: 'Перевёрнута',
      defaultHiddenDescription: 'Скрыто способностью Босса',
    });

    // Кейс 1: facing: 'back' в реестре даже при наличии чувствительных полей
    const backCardSlot = document.createElement('div');
    setTooltipData(backCardSlot, {
      kind: 'playing',
      facing: 'back',
      title: 'Король Червы',
      subtitle: 'Игральная карта',
      rarity: 'Особая',
      price: '4 з.',
      description: 'Хрустальная: ×2 Множ',
      badges: [
        { label: 'Призматическое', kind: 'edition' },
        { label: 'Хрустальная', kind: 'enhancement' },
        { label: 'Алая печать', kind: 'seal' },
      ],
    });
    root.appendChild(backCardSlot);
    mockElementRect(backCardSlot, { left: 300, top: 450, width: 90, height: 126 });
    mockElementRect(controller.getElement(), { left: 0, top: 0, width: 200, height: 90 });

    dispatchPointer(backCardSlot, 'pointerover', { pointerType: 'mouse' });

    const tooltipEl = controller.getElement();
    expect(controller.isVisible()).toBe(true);
    expect(tooltipEl.dataset.hidden).toBe('true');
    expect(tooltipEl.textContent).toContain('Перевёрнута');
    expect(tooltipEl.textContent).toContain('Скрыто способностью Босса');
    expect(tooltipEl.textContent).not.toContain('Король');
    expect(tooltipEl.textContent).not.toContain('Червы');
    expect(tooltipEl.textContent).not.toContain('Призматическое');
    expect(tooltipEl.textContent).not.toContain('Хрустальная');
    expect(tooltipEl.textContent).not.toContain('Алая печать');
    expect(tooltipEl.textContent).not.toContain('4 з.');

    // Кейс 2: data-face-down="true" на вложенном card-frame + кастомный текст через data-атрибуты
    const domHiddenSlot = document.createElement('div');
    domHiddenSlot.dataset.tooltipTitle = 'Туз Бубны';
    domHiddenSlot.dataset.tooltipDescription = 'Золотая печать';
    domHiddenSlot.dataset.tooltipHiddenTitle = 'Скрытая карта';
    domHiddenSlot.dataset.tooltipHiddenText = 'Рубашкой вверх';
    const innerFrame = document.createElement('div');
    innerFrame.dataset.faceDown = 'true';
    domHiddenSlot.appendChild(innerFrame);
    root.appendChild(domHiddenSlot);
    mockElementRect(domHiddenSlot, { left: 420, top: 450, width: 90, height: 126 });

    dispatchPointer(domHiddenSlot, 'pointerover', { pointerType: 'mouse' });

    expect(controller.isVisible()).toBe(true);
    expect(tooltipEl.textContent).toContain('Скрытая карта');
    expect(tooltipEl.textContent).toContain('Рубашкой вверх');
    expect(tooltipEl.textContent).not.toContain('Туз');
    expect(tooltipEl.textContent).not.toContain('Бубны');
    expect(tooltipEl.textContent).not.toContain('Золотая печать');
  });

  it('позиционирует тултип рядом с картой с автопереворотом и удержанием внутри границ viewport', () => {
    setViewportSize(1000, 700);
    controller = initHoverTooltip({
      container: root,
      offset: 10,
      viewportPadding: 12,
    });
    const tooltipEl = controller.getElement();
    mockElementRect(tooltipEl, { left: 0, top: 0, width: 220, height: 120 });

    // 1. Карта у верхнего края — тултип не помещается сверху и переворачивается вниз (bottom)
    const topCard = document.createElement('div');
    setTooltipData(topCard, { title: 'Верхняя Реликвия' });
    root.appendChild(topCard);
    mockElementRect(topCard, { left: 400, top: 16, width: 80, height: 100 });

    dispatchPointer(topCard, 'pointerover', { pointerType: 'mouse' });
    expect(tooltipEl.dataset.placement).toBe('bottom');
    expect(Number.parseFloat(tooltipEl.style.top)).toBe(126);

    // 2. Карта внизу — тултип открывается сверху (top)
    const bottomCard = document.createElement('div');
    setTooltipData(bottomCard, { title: 'Карта в руке' });
    root.appendChild(bottomCard);
    mockElementRect(bottomCard, { left: 400, top: 540, width: 80, height: 120 });

    dispatchPointer(bottomCard, 'pointerover', { pointerType: 'mouse' });
    expect(tooltipEl.dataset.placement).toBe('top');
    expect(Number.parseFloat(tooltipEl.style.top)).toBe(410);

    // 3. Карта у правого края с placement: 'right' — переворачивается влево (left)
    const rightCard = document.createElement('div');
    setTooltipData(rightCard, { title: 'Правый товар', placement: 'right' });
    root.appendChild(rightCard);
    mockElementRect(rightCard, { left: 900, top: 300, width: 84, height: 110 });

    dispatchPointer(rightCard, 'pointerover', { pointerType: 'mouse' });
    expect(tooltipEl.dataset.placement).toBe('left');
    expect(Number.parseFloat(tooltipEl.style.left)).toBe(670);

    // 4. Карта у левого края с placement: 'left' — переворачивается вправо (right)
    const leftCard = document.createElement('div');
    setTooltipData(leftCard, { title: 'Левый элемент', placement: 'left' });
    root.appendChild(leftCard);
    mockElementRect(leftCard, { left: 12, top: 300, width: 84, height: 110 });

    dispatchPointer(leftCard, 'pointerover', { pointerType: 'mouse' });
    expect(tooltipEl.dataset.placement).toBe('right');
    expect(Number.parseFloat(tooltipEl.style.left)).toBe(106);

    // 5. Карта у самого правого угла при placement: 'top' — горизонтально зажимается в viewport
    const cornerCard = document.createElement('div');
    setTooltipData(cornerCard, { title: 'Крайняя карта' });
    root.appendChild(cornerCard);
    mockElementRect(cornerCard, { left: 910, top: 520, width: 80, height: 110 });

    dispatchPointer(cornerCard, 'pointerover', { pointerType: 'mouse' });
    const leftPos = Number.parseFloat(tooltipEl.style.left);
    expect(leftPos).toBeGreaterThanOrEqual(12);
    expect(leftPos + 220).toBeLessThanOrEqual(1000 - 12);
  });

  it('корректно работает hide(), автоскрытие при удалении цели из DOM, clearTooltipData() и destroy()', async () => {
    controller = initHoverTooltip({ container: root });

    const card = document.createElement('div');
    setTooltipData(card, { title: 'Алхимический свиток', description: 'Усиливает 2 карты' });
    root.appendChild(card);
    mockElementRect(card, { left: 300, top: 350, width: 90, height: 120 });
    mockElementRect(controller.getElement(), { left: 0, top: 0, width: 200, height: 90 });

    dispatchPointer(card, 'pointerover', { pointerType: 'mouse' });
    expect(controller.isVisible()).toBe(true);

    // Явный вызов hide() скрывает тултип
    controller.hide();
    expect(controller.isVisible()).toBe(false);

    // Повторный показ и симуляция перерисовки DOM (целевой элемент удалён из дерева)
    dispatchPointer(card, 'pointerover', { pointerType: 'mouse' });
    expect(controller.isVisible()).toBe(true);
    root.replaceChildren();
    await Promise.resolve();
    expect(controller.isVisible()).toBe(false);

    // clearTooltipData снимает данные с элемента
    const card2 = document.createElement('div');
    setTooltipData(card2, { title: 'Бустер' });
    clearTooltipData(card2);
    root.appendChild(card2);
    dispatchPointer(card2, 'pointerover', { pointerType: 'mouse' });
    expect(controller.isVisible()).toBe(false);

    // destroy() отключает обработчики и удаляет DOM-элемент тултипа
    const tooltipNode = controller.getElement();
    controller.destroy();
    expect(tooltipNode.isConnected).toBe(false);

    setTooltipData(card2, { title: 'После destroy' });
    dispatchPointer(card2, 'pointerover', { pointerType: 'mouse' });
    expect(controller.isVisible()).toBe(false);
  });

  it('поддерживает открытую карту (facing: "front") со всеми модификаторами и кастомный resolveTarget', () => {
    controller = initHoverTooltip({
      container: root,
      resolveTarget: (el) => {
        if (el.dataset.bossId === 'bl_flint') {
          return {
            kind: 'boss',
            title: 'Кремнёвый Страж',
            subtitle: 'Босс Этапа',
            description: 'Базовая Сила и Множитель расклада делятся пополам',
          };
        }
        return null;
      },
    });

    const openCard = document.createElement('div');
    setTooltipData(openCard, {
      kind: 'playing',
      facing: 'front',
      title: 'Туз Пик',
      subtitle: 'Игральная карта',
      description: '+11 Силы',
      badges: [
        { label: 'Хрустальная (×2 Множ)', kind: 'enhancement', tone: 'gold' },
        { label: 'Радужное (+10 Множ)', kind: 'edition', tone: 'blue' },
        { label: 'Алая печать', kind: 'seal', tone: 'purple' },
      ],
    });
    root.appendChild(openCard);
    mockElementRect(openCard, { left: 250, top: 450, width: 90, height: 126 });
    mockElementRect(controller.getElement(), { left: 0, top: 0, width: 220, height: 120 });

    dispatchPointer(openCard, 'pointerover', { pointerType: 'mouse' });
    const tooltipEl = controller.getElement();
    expect(controller.isVisible()).toBe(true);
    expect(tooltipEl.dataset.hidden).toBeUndefined();
    expect(tooltipEl.textContent).toContain('Туз Пик');
    expect(tooltipEl.textContent).toContain('Хрустальная (×2 Множ)');
    expect(tooltipEl.textContent).toContain('Радужное (+10 Множ)');
    expect(tooltipEl.textContent).toContain('Алая печать');

    const bossEl = document.createElement('button');
    bossEl.dataset.bossId = 'bl_flint';
    root.appendChild(bossEl);
    mockElementRect(bossEl, { left: 80, top: 180, width: 160, height: 60 });

    dispatchPointer(bossEl, 'pointerover', { pointerType: 'mouse' });
    expect(controller.isVisible()).toBe(true);
    expect(tooltipEl.dataset.kind).toBe('boss');
    expect(tooltipEl.textContent).toContain('Кремнёвый Страж');
    expect(tooltipEl.textContent).toContain('Босс Этапа');
    expect(tooltipEl.textContent).toContain('Базовая Сила и Множитель расклада делятся пополам');
  });
});
