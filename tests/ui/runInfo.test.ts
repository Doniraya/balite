import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialRunState, HAND_TYPES, type RunState } from '../../src/engine';
import {
  createTranslator,
  setDevOriginalTermsEnabled,
} from '../../src/i18n';
import { renderRunInfoModal } from '../../src/ui/modals';

function createTestState(overrides: Partial<RunState> = {}): RunState {
  const base = createInitialRunState('b_red', 'RUN_INFO_TEST_SEED');
  return {
    ...base,
    ...overrides,
  };
}

const FORBIDDEN_TEXT_PATTERNS: readonly RegExp[] = [
  /\bpokers?\b/i,
  /\bcasinos?\b/i,
  /\bbets?\b/i,
  /\bblinds?\b/i,
  /\bchips?\b/i,
  /\btarots?\b/i,
  /\bdevils?\b/i,
  /\bhanged\b/i,
  /\bjokers?\b/i,
  /\bvampires?\b/i,
  /(?<![а-яё])покер/iu,
  /(?<![а-яё])казино/iu,
  /(?<![а-яё])ставк[аиуео]?[ймх]?/iu,
  /(?<![а-яё])блайнд/iu,
  /(?<![а-яё])фишк/iu,
  /(?<![а-яё])таро(?![а-яё])/iu,
  /(?<![а-яё])джокер/iu,
  /(?<![а-яё])анте(?![а-яё])/iu,
  /(?<![а-яё])ваучер/iu,
];

function assertCleanLocalizedElement(root: HTMLElement): void {
  const text = root.textContent ?? '';
  for (const pattern of FORBIDDEN_TEXT_PATTERNS) {
    expect(text).not.toMatch(pattern);
  }
}

describe('Модальное окно Run Info («Детали партии»)', () => {
  afterEach(async () => {
    await setDevOriginalTermsEnabled(false, false);
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('открывает модалку с 3 вкладками и по умолчанию показывает вкладку «Комбинации»', () => {
    const translator = createTranslator('ru');
    const state = createTestState();
    const onClose = vi.fn();

    const modal = renderRunInfoModal(state, translator, onClose, 'hands');
    assertCleanLocalizedElement(modal);

    const tabs = modal.querySelectorAll<HTMLButtonElement>('.run-info-tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0].textContent).toContain('Комбинации');
    expect(tabs[1].textContent).toContain('Заказы');
    expect(tabs[2].textContent).toContain('Привилегии');

    expect(tabs[0].classList.contains('run-info-tab--active')).toBe(true);
    expect(modal.querySelector('.run-info-hands-list')).not.toBeNull();

    // Вкладка содержит все 12 комбинаций
    const rows = modal.querySelectorAll<HTMLElement>('.run-info-hand-row');
    expect(rows).toHaveLength(HAND_TYPES.length);

    // Кнопка «Назад»
    const backBtn = modal.querySelector<HTMLButtonElement>('.run-info-back-btn');
    expect(backBtn).not.toBeNull();
    expect(backBtn?.textContent).toBe('Назад');
    backBtn?.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('переключает вкладки на «Заказы» и отображает 3 карточки с порогами очков и жетонами', () => {
    const translator = createTranslator('ru');
    const state = createTestState();
    const onClose = vi.fn();

    const modal = renderRunInfoModal(state, translator, onClose, 'blinds');
    assertCleanLocalizedElement(modal);

    const activeTab = modal.querySelector<HTMLButtonElement>('.run-info-tab--active');
    expect(activeTab?.textContent).toContain('Заказы');

    const blindCards = modal.querySelectorAll<HTMLElement>('.run-info-blind-card');
    expect(blindCards).toHaveLength(3);

    // Первая карточка (Младший заказ) имеет статус и порог очков
    const firstCard = blindCards[0];
    expect(firstCard.dataset.blindKind).toBe('small');
    expect(firstCard.querySelector('.run-info-blind-token')).not.toBeNull();
    expect(firstCard.querySelector('.run-info-blind-target')).not.toBeNull();
    const tagCard = firstCard.querySelector<HTMLElement>('.run-info-tag-card');
    expect(tagCard).not.toBeNull();
    // Талон пропуска является чисто информационным и не имеет класса кликабельной кнопки
    expect(tagCard?.classList.contains('interactive-slot')).toBe(false);

    // Босс имеет описание свойства
    const bossCard = blindCards[2];
    expect(bossCard.dataset.blindKind).toBe('boss');
    expect(bossCard.querySelector('.run-info-blind-boss-desc')).not.toBeNull();
  });

  it('показывает заглушку при отсутствии ваучеров и карточки при их наличии', () => {
    const translator = createTranslator('ru');
    const stateWithoutVouchers = createTestState();
    const onClose = vi.fn();

    // Без ваучеров
    const modalEmpty = renderRunInfoModal(stateWithoutVouchers, translator, onClose, 'vouchers');
    assertCleanLocalizedElement(modalEmpty);
    const emptyMsg = modalEmpty.querySelector('.run-info-vouchers-empty');
    expect(emptyMsg?.textContent).toContain('В этой экспедиции не были получены привилегии');

    // С купленным ваучером
    const stateWithVouchers: RunState = {
      ...stateWithoutVouchers,
      charters: ['v_grabber'],
    };
    const modalWithVouchers = renderRunInfoModal(stateWithVouchers, translator, onClose, 'vouchers');
    assertCleanLocalizedElement(modalWithVouchers);

    const titleEl = modalWithVouchers.querySelector('.run-info-vouchers-title');
    expect(titleEl?.textContent).toContain('Привилегии, полученные в этой экспедиции');
    const voucherSlots = modalWithVouchers.querySelectorAll('.run-info-voucher-slot');
    expect(voucherSlots).toHaveLength(1);
  });

  it('при наведении или клике на комбинацию показывает интерактивную плашку с 5 мини-картами', () => {
    const translator = createTranslator('ru');
    const state = createTestState();
    const onClose = vi.fn();

    const modal = renderRunInfoModal(state, translator, onClose, 'hands');

    // Ищем строку «Пара»
    const pairRow = modal.querySelector<HTMLElement>('[data-hand-type="Pair"]');
    expect(pairRow).not.toBeNull();

    // Наведение мыши
    pairRow?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    const popup = modal.querySelector<HTMLElement>('.hand-preview-popup');
    expect(popup).not.toBeNull();
    expect(popup?.textContent).toContain('2 карты одного ранга');
    // Для нижних комбинаций (Пара, Старшая карта, Две пары, Тройка) плашка всплывает сверху над строкой
    expect(popup?.classList.contains('hand-preview-popup--top')).toBe(true);

    const miniCards = popup?.querySelectorAll<HTMLElement>('.run-info-mini-card');
    expect(miniCards).toHaveLength(5);

    // Зачётные карты приподняты (.run-info-mini-card--scored)
    const scoredCards = popup?.querySelectorAll<HTMLElement>('.run-info-mini-card--scored');
    expect(scoredCards?.length).toBe(2);

    const unscoredCards = popup?.querySelectorAll<HTMLElement>('.run-info-mini-card--unscored');
    expect(unscoredCards?.length).toBe(3);

    // Увод мыши закрывает плашку
    pairRow?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(modal.querySelector('.hand-preview-popup')).toBeNull();

    // Для верхних комбинаций (Каре, Стрит-флеш, Фулл-хаус и т.д.) плашка всплывает снизу под строкой
    const fourRow = modal.querySelector<HTMLElement>('[data-hand-type="Four of a Kind"]');
    expect(fourRow).not.toBeNull();
    fourRow?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    const fourPopup = modal.querySelector<HTMLElement>('.hand-preview-popup');
    expect(fourPopup).not.toBeNull();
    expect(fourPopup?.classList.contains('hand-preview-popup--bottom')).toBe(true);
    fourRow?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(modal.querySelector('.hand-preview-popup')).toBeNull();
  });

  it('в DEV-режиме использует оригинальную терминологию Balatro', async () => {
    await setDevOriginalTermsEnabled(true, false);
    const translator = createTranslator('ru');
    const state = createTestState();
    const onClose = vi.fn();

    const modal = renderRunInfoModal(state, translator, onClose, 'hands');
    const tabs = modal.querySelectorAll<HTMLButtonElement>('.run-info-tab');
    expect(tabs[0].textContent).toContain('Покерные руки');
    expect(tabs[1].textContent).toContain('Блайнды');
    expect(tabs[2].textContent).toContain('Ваучеры');

    // Переключаемся на ваучеры
    tabs[2].click();
    const emptyMsg = modal.querySelector('.run-info-vouchers-empty');
    expect(emptyMsg?.textContent).toContain('В этой партии не были выкуплены ваучеры');
  });
});
