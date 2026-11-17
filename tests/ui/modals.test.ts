import { describe, expect, it, vi } from 'vitest';
import {
  CELESTIAL_IDS,
  HAND_TYPES,
  RELIC_IDS,
  RUNE_IDS,
  SCROLL_IDS,
  createInitialMetaSave,
  createInitialRunState,
  createPlayingCard,
  unlockAllCollection,
  type BossId,
  type CharterId,
  type ConsumableId,
  type ConsumableInstance,
  type GameSettings,
  type MetaSave,
  type PackOffer,
  type PlayingCard,
  type RelicId,
  type RelicInstance,
  type RunState,
  type ShopOffer,
} from '../../src/engine';
import { createTranslator } from '../../src/i18n';
import {
  getConsumableTargetRequirement,
  getRelicLocParams,
  renderInspectorOverlay,
  type InspectorCallbacks,
} from '../../src/ui/inspector';
import {
  computeMetaStatsSummary,
  renderDeckModal,
  renderHandReferenceModal,
  renderSettingsModal,
  type SettingsModalOptions,
} from '../../src/ui/modals';
import { getTooltipData } from '../../src/ui/tooltip';

/**
 * Запрещённые слова и корни для рейтинга 6+/12+ (без казино/покера/оккультизма).
 */
const FORBIDDEN_TEXT_PATTERNS: readonly RegExp[] = [
  /\bpokers?\b/i,
  /\bcasinos?\b/i,
  /\bbets?\b/i,
  /\bblinds?\b/i,
  /\bchips?\b/i,
  /\btarots?\b/i,
  /\bdevils?\b/i,
  /\bhanged\b/i,
  /\bouija\b/i,
  /\bjokers?\b/i,
  /\bvampires?\b/i,
  /\bgambl(?:e|ing)\b/i,
  /\bjackpots?\b/i,
  /(?<![а-яё])покер/iu,
  /(?<![а-яё])казино/iu,
  /(?<![а-яё])ставк[аиуео]?[ймх]?/iu,
  /(?<![а-яё])блайнд/iu,
  /(?<![а-яё])фишк/iu,
  /(?<![а-яё])фишек/iu,
  /(?<![а-яё])таро(?![а-яё])/iu,
  /(?<![а-яё])дьявол/iu,
  /(?<![а-яё])висельник/iu,
  /(?<![а-яё])джокер/iu,
  /(?<![а-яё])вампир/iu,
];

/**
 * Создаёт тестовый экземпляр Реликвии с настраиваемым состоянием.
 */
function makeRelic(
  id: RelicId,
  overrides: Partial<RelicInstance> = {},
): RelicInstance {
  return {
    uid: overrides.uid ?? `rel_${id}`,
    id,
    edition: overrides.edition ?? 'base',
    baseCost: overrides.baseCost ?? 5,
    sellValue: overrides.sellValue ?? 2,
    extraValue: overrides.extraValue ?? 0,
    debuffed: overrides.debuffed ?? false,
    state: overrides.state ?? { chips: 0, mult: 0, xMult: 1 },
  };
}

/**
 * Создаёт тестовый экземпляр Расходника.
 */
function makeConsumable(
  id: ConsumableId,
  overrides: Partial<ConsumableInstance> = {},
): ConsumableInstance {
  const kind = (CELESTIAL_IDS as readonly string[]).includes(id)
    ? 'celestial'
    : (SCROLL_IDS as readonly string[]).includes(id)
      ? 'scroll'
      : 'rune';
  return {
    uid: overrides.uid ?? `con_${id}`,
    id,
    kind,
    edition: overrides.edition ?? 'base',
    baseCost: overrides.baseCost ?? 3,
    sellValue: overrides.sellValue ?? 1,
  };
}

/**
 * Создаёт базовое состояние забега для UI-тестов.
 */
function createTestState(overrides: Partial<RunState> = {}): RunState {
  const base = createInitialRunState('b_red', 'MODALS_TEST_SEED');
  return {
    ...base,
    ...overrides,
  };
}

/**
 * Проверяет, что в тексте DOM-элемента нет нераскрытых шаблонов вида {param} и запрещённых слов.
 */
function assertCleanLocalizedElement(root: HTMLElement): void {
  const text = root.textContent ?? '';
  expect(text).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
  expect(root.querySelectorAll('a[href]')).toHaveLength(0);
  expect(text).not.toMatch(/https?:\/\//i);
  for (const pattern of FORBIDDEN_TEXT_PATTERNS) {
    expect(text).not.toMatch(pattern);
  }
}

describe('UI инспектор (src/ui/inspector.ts)', () => {
  it('возвращает точные правила выбора карт для всех 37 расходников', () => {
    for (const celestialId of CELESTIAL_IDS) {
      expect(getConsumableTargetRequirement(celestialId)).toEqual({
        min: 0,
        max: 0,
        mode: 'none',
      });
    }

    const upToTwo: readonly ConsumableId[] = [
      'c_magician',
      'c_empress',
      'c_heirophant',
      'c_strength',
      'c_hanged_man',
    ];
    for (const id of upToTwo) {
      expect(getConsumableTargetRequirement(id)).toEqual({
        min: 1,
        max: 2,
        mode: 'upTo',
      });
    }

    const singleOne: readonly ConsumableId[] = [
      'c_lovers',
      'c_chariot',
      'c_justice',
      'c_devil',
      'c_tower',
      'c_talisman',
      'c_deja_vu',
      'c_trance',
      'c_medium',
      'c_aura',
      'c_cryptid',
    ];
    for (const id of singleOne) {
      expect(getConsumableTargetRequirement(id)).toEqual({
        min: 1,
        max: 1,
        mode: 'single',
      });
    }

    expect(getConsumableTargetRequirement('c_death')).toEqual({
      min: 2,
      max: 2,
      mode: 'mirror',
    });

    const noneScrollsAndRunes: readonly ConsumableId[] = [
      'c_fool',
      'c_hermit',
      'c_temperance',
      'c_wheel_of_fortune',
      'c_judgement',
      'c_immolate',
      'c_hex',
      'c_black_hole',
    ];
    for (const id of noneScrollsAndRunes) {
      expect(getConsumableTargetRequirement(id)).toEqual({
        min: 0,
        max: 0,
        mode: 'none',
      });
    }

    // Убеждаемся, что покрыты абсолютно все 37 расходников движка
    expect(
      CELESTIAL_IDS.length + SCROLL_IDS.length + RUNE_IDS.length,
    ).toBe(37);
  });

  it('вычисляет параметры подстановки реликвий с учётом счётчиков и состояния забега', () => {
    const ru = createTranslator('ru');
    const en = createTranslator('en');

    // Статические реликвии не затирают значения из DEFAULT_RELIC_PARAMS нулями из relic.state
    const simpleJoker = makeRelic('j_joker');
    expect(getRelicLocParams(simpleJoker)).toMatchObject({ mult: 4 });
    expect(ru.getRelicText('j_joker', getRelicLocParams(simpleJoker)).description).toContain('+4');

    const sly = makeRelic('j_sly');
    expect(getRelicLocParams(sly)).toMatchObject({ chips: 50 });

    const photo = makeRelic('j_photograph');
    expect(getRelicLocParams(photo)).toMatchObject({ xMult: 2 });

    // Накопительные реликвии берут живые значения из relic.state
    const runner = makeRelic('j_runner', { state: { chips: 45, mult: 0, xMult: 1 } });
    expect(getRelicLocParams(runner)).toMatchObject({ chipsStep: 15, chips: 45 });

    const green = makeRelic('j_green_joker', { state: { chips: 0, mult: 9, xMult: 1 } });
    expect(getRelicLocParams(green)).toMatchObject({ multGain: 1, multLoss: 1, mult: 9 });

    const flash = makeRelic('j_flash', { state: { chips: 0, mult: 6, xMult: 1 } });
    expect(getRelicLocParams(flash)).toMatchObject({ multStep: 2, mult: 6 });

    const trousers = makeRelic('j_trousers', { state: { chips: 0, mult: 8, xMult: 1 } });
    expect(getRelicLocParams(trousers)).toMatchObject({ multStep: 2, mult: 8 });

    const ceremonial = makeRelic('j_ceremonial', { state: { chips: 0, mult: 14, xMult: 1 } });
    expect(getRelicLocParams(ceremonial)).toMatchObject({ mult: 14 });

    const constellation = makeRelic('j_constellation', {
      state: { chips: 0, mult: 0, xMult: 1.3000000000000003 },
    });
    expect(getRelicLocParams(constellation)).toMatchObject({ xMultStep: 0.1, xMult: 1.3 });

    const hologram = makeRelic('j_hologram', { state: { chips: 0, mult: 0, xMult: 2.25 } });
    expect(getRelicLocParams(hologram)).toMatchObject({ xMultStep: 0.25, xMult: 2.25 });

    const vampire = makeRelic('j_vampire', { state: { chips: 0, mult: 0, xMult: 1.6 } });
    expect(getRelicLocParams(vampire)).toMatchObject({ xMultStep: 0.1, xMult: 1.6 });

    const ramen = makeRelic('j_ramen', { state: { chips: 0, mult: 0, xMult: 1.74 } });
    expect(getRelicLocParams(ramen)).toMatchObject({ xMult: 1.74, xMultLoss: 0.01 });

    // Контекстные реликвии: j_abstract, j_stencil, j_bull
    const abstractRelic = makeRelic('j_abstract');
    const stencilRelic = makeRelic('j_stencil', { uid: 'rel_stencil_1' });
    const negativeRelic = makeRelic('j_joker', { uid: 'rel_neg', edition: 'negative' });
    const bullRelic = makeRelic('j_bull');
    const state = createTestState({
      dollars: 15,
      maxRelics: 5,
      relics: [abstractRelic, stencilRelic, negativeRelic],
    });

    expect(getRelicLocParams(abstractRelic, state)).toMatchObject({
      multPerRelic: 3,
      mult: 9,
    });

    // maxRelics (5) + 1 negative = 6 слотов; занято 3 => 3 свободных; emptySlots (3) + stencilCount (1) = 4
    expect(getRelicLocParams(stencilRelic, state)).toMatchObject({ xMult: 4 });

    // Когда слоты забиты полностью, j_stencil даёт ×1
    const fullState = createTestState({
      maxRelics: 2,
      relics: [stencilRelic, abstractRelic],
    });
    expect(getRelicLocParams(stencilRelic, fullState)).toMatchObject({ xMult: 1 });

    expect(getRelicLocParams(bullRelic, state)).toMatchObject({
      chipsPerDollar: 2,
      chips: 30,
    });

    // Минимальный срез состояния (Pick без maxRelics и dollars) также валиден и безопасен
    const minimalState: Pick<
      RunState,
      'relics' | 'deck' | 'discardsLeft' | 'handsLeft' | 'handLevels' | 'charters'
    > = {
      relics: [abstractRelic, stencilRelic],
      deck: state.deck,
      discardsLeft: state.discardsLeft,
      handsLeft: state.handsLeft,
      handLevels: state.handLevels,
      charters: state.charters,
    };
    expect(getRelicLocParams(abstractRelic, minimalState)).toMatchObject({ mult: 6 });
    expect(getRelicLocParams(stencilRelic, minimalState)).toMatchObject({ xMult: 4 });

    // Все 40 реликвий форматируются в RU и EN без нераскрытых плейсхолдеров
    for (const relicId of RELIC_IDS) {
      const instance = makeRelic(relicId);
      const params = getRelicLocParams(instance, state);
      expect(ru.getRelicText(relicId, params).description).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
      expect(en.getRelicText(relicId, params).description).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
    }
  });

  it('отрисовывает инспектор реликвии, обрабатывает перемещение, продажу и запрет продажи Вечной реликвии', () => {
    const ru = createTranslator('ru');
    const relic = makeRelic('j_flash', {
      uid: 'r_flash',
      edition: 'foil',
      sellValue: 4,
      debuffed: true,
      state: { chips: 0, mult: 10, xMult: 1 },
    });
    const state = createTestState({ relics: [relic] });
    const callbacks: InspectorCallbacks = {
      onClose: vi.fn(),
      onMoveRelic: vi.fn(),
      onSellRelic: vi.fn(),
    };

    const overlay = renderInspectorOverlay(
      { kind: 'relic', relic, index: 1, total: 3 },
      state,
      ru,
      callbacks,
    );

    assertCleanLocalizedElement(overlay);
    expect(overlay.textContent).toContain('+10');
    expect(overlay.textContent).toContain(ru.t('ui.hud.debuffedBadge'));
    expect(overlay.textContent).toContain(ru.catalog.editions.foil.name);

    const moveLeft = overlay.querySelector<HTMLButtonElement>('[data-action="move-left"]');
    const moveRight = overlay.querySelector<HTMLButtonElement>('[data-action="move-right"]');
    const sellBtn = overlay.querySelector<HTMLButtonElement>('[data-action="sell"]');
    const closeBtn = overlay.querySelector<HTMLButtonElement>('[data-action="close"]');

    expect(moveLeft?.disabled).toBe(false);
    expect(moveRight?.disabled).toBe(false);
    expect(sellBtn?.disabled).toBe(false);

    moveLeft?.click();
    moveRight?.click();
    sellBtn?.click();
    closeBtn?.click();

    expect(callbacks.onMoveRelic).toHaveBeenNthCalledWith(1, 'r_flash', -1);
    expect(callbacks.onMoveRelic).toHaveBeenNthCalledWith(2, 'r_flash', 1);
    expect(callbacks.onSellRelic).toHaveBeenCalledWith('r_flash');
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);

    // Границы и Вечная реликвия
    const eternalRelic = makeRelic('j_joker', {
      uid: 'r_eternal',
      state: { chips: 0, mult: 0, xMult: 1, extra: { eternal: true } },
    });
    const boundaryOverlay = renderInspectorOverlay(
      { kind: 'relic', relic: eternalRelic, index: 0, total: 1 },
      state,
      ru,
      callbacks,
    );
    expect(
      boundaryOverlay.querySelector<HTMLButtonElement>('[data-action="move-left"]')?.disabled,
    ).toBe(true);
    expect(
      boundaryOverlay.querySelector<HTMLButtonElement>('[data-action="move-right"]')?.disabled,
    ).toBe(true);
    expect(
      boundaryOverlay.querySelector<HTMLButtonElement>('[data-action="sell"]')?.disabled,
    ).toBe(true);
  });

  it('отрисовывает инспектор расходника и закрывается только по тапу на затемнённый фон', () => {
    const en = createTranslator('en');
    const consumable = makeConsumable('c_mercury', { uid: 'con_1', sellValue: 2 });
    const state = createTestState({ consumables: [consumable] });
    const callbacks: InspectorCallbacks = {
      onClose: vi.fn(),
      onMoveConsumable: vi.fn(),
      onUseConsumable: vi.fn(),
      onSellConsumable: vi.fn(),
    };

    const overlay = renderInspectorOverlay(
      { kind: 'consumable', consumable, index: 0, total: 2, canUse: true },
      state,
      en,
      callbacks,
    );

    assertCleanLocalizedElement(overlay);
    expect(overlay.textContent).toContain(en.catalog.consumableKinds.celestial);

    const card = overlay.querySelector<HTMLElement>('.inspector-card');
    card?.click();
    expect(callbacks.onClose).not.toHaveBeenCalled();

    overlay.querySelector<HTMLButtonElement>('[data-action="use"]')?.click();
    overlay.querySelector<HTMLButtonElement>('[data-action="move-right"]')?.click();
    overlay.querySelector<HTMLButtonElement>('[data-action="sell"]')?.click();
    expect(callbacks.onUseConsumable).toHaveBeenCalledWith('con_1');
    expect(callbacks.onMoveConsumable).toHaveBeenCalledWith('con_1', 1);
    expect(callbacks.onSellConsumable).toHaveBeenCalledWith('con_1');

    // Тап непосредственно на фон закрывает инспектор
    overlay.click();
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);

    // Когда canUse === false, кнопка использования отключена
    const disabledOverlay = renderInspectorOverlay(
      { kind: 'consumable', consumable, index: 1, total: 2, canUse: false },
      state,
      en,
      callbacks,
    );
    expect(
      disabledOverlay.querySelector<HTMLButtonElement>('[data-action="use"]')?.disabled,
    ).toBe(true);
  });

  it('отрисовывает инспектор товаров магазина (реликвия, расходник, карта, грамота, набор)', () => {
    const ru = createTranslator('ru');
    const state = createTestState({ dollars: 20 });
    const callbacks: InspectorCallbacks = {
      onClose: vi.fn(),
      onBuyOffer: vi.fn(),
      onBuyCharter: vi.fn(),
      onOpenPack: vi.fn(),
    };

    // 1. Расходник в магазине: кнопки Купить и Купить и применить
    const consumableOffer: ShopOffer = {
      uid: 'offer_con',
      kind: 'consumable',
      consumable: makeConsumable('c_hermit'),
      cost: 3,
      baseCost: 3,
      sold: false,
    };
    const conOfferOverlay = renderInspectorOverlay(
      {
        kind: 'shop_offer',
        offer: consumableOffer,
        canAfford: true,
        hasSlot: false,
        slotFreeForImmediateUse: true,
      },
      state,
      ru,
      callbacks,
    );
    assertCleanLocalizedElement(conOfferOverlay);
    const buyBtn = conOfferOverlay.querySelector<HTMLButtonElement>('[data-action="buy"]');
    const buyAndUseBtn = conOfferOverlay.querySelector<HTMLButtonElement>('[data-action="buy-and-use"]');
    expect(buyBtn?.disabled).toBe(true);
    expect(buyAndUseBtn?.disabled).toBe(false);
    buyAndUseBtn?.click();
    expect(callbacks.onBuyOffer).toHaveBeenCalledWith('offer_con', true);

    // 2. Реликвия в магазине при наличии средств и слота
    const relicOffer: ShopOffer = {
      uid: 'offer_rel',
      kind: 'relic',
      relic: makeRelic('j_joker'),
      cost: 5,
      baseCost: 5,
      sold: false,
    };
    const relOfferOverlay = renderInspectorOverlay(
      {
        kind: 'shop_offer',
        offer: relicOffer,
        canAfford: true,
        hasSlot: true,
        slotFreeForImmediateUse: false,
      },
      state,
      ru,
      callbacks,
    );
    assertCleanLocalizedElement(relOfferOverlay);
    relOfferOverlay.querySelector<HTMLButtonElement>('[data-action="buy"]')?.click();
    expect(callbacks.onBuyOffer).toHaveBeenCalledWith('offer_rel', false);

    // 3. Игральная карта в магазине
    const cardOffer: ShopOffer = {
      uid: 'offer_card',
      kind: 'card',
      card: createPlayingCard({
        id: 'shop_c1',
        suit: 'hearts',
        rank: 14,
        enhancement: 'lucky',
      }),
      cost: 2,
      baseCost: 2,
      sold: false,
    };
    const cardOfferOverlay = renderInspectorOverlay(
      {
        kind: 'shop_offer',
        offer: cardOffer,
        canAfford: true,
        hasSlot: true,
        slotFreeForImmediateUse: false,
      },
      state,
      ru,
      callbacks,
    );
    assertCleanLocalizedElement(cardOfferOverlay);
    expect(cardOfferOverlay.querySelector('.card-frame')).not.toBeNull();

    // 4. Гильдейская грамота
    const charterId: CharterId = 'v_grabber';
    const charterOverlay = renderInspectorOverlay(
      { kind: 'shop_charter', charterId, price: 10, canAfford: true },
      state,
      ru,
      callbacks,
    );
    assertCleanLocalizedElement(charterOverlay);
    charterOverlay.querySelector<HTMLButtonElement>('[data-action="buy-charter"]')?.click();
    expect(callbacks.onBuyCharter).toHaveBeenCalledTimes(1);

    // 5. Бустер-набор
    const pack: PackOffer = {
      uid: 'pack_1',
      packId: 'p_arcana_normal',
      type: 'arcana',
      size: 'normal',
      cost: 4,
      baseCost: 4,
      totalCards: 3,
      chooseCount: 1,
      purchased: false,
    };
    const packOverlay = renderInspectorOverlay(
      { kind: 'shop_pack', pack, canAfford: false },
      state,
      ru,
      callbacks,
    );
    assertCleanLocalizedElement(packOverlay);
    const openBtn = packOverlay.querySelector<HTMLButtonElement>('[data-action="open-pack"]');
    expect(openBtn?.disabled).toBe(true);
    expect(packOverlay.textContent).toContain(ru.t('ui.shop.notEnoughGold'));
  });

  it('отрисовывает инспектор игральной карты и босса', () => {
    const ru = createTranslator('ru');
    const state = createTestState();
    const callbacks: InspectorCallbacks = { onClose: vi.fn() };

    const specialCard: PlayingCard = createPlayingCard({
      id: 'c_inspect',
      suit: 'spades',
      rank: 13,
      enhancement: 'glass',
      edition: 'holo',
      seal: 'red',
      bonusChips: 20,
      permaBonus: 15,
      debuffed: true,
    });
    const cardOverlay = renderInspectorOverlay(
      { kind: 'playing_card', card: specialCard },
      state,
      ru,
      callbacks,
    );
    assertCleanLocalizedElement(cardOverlay);
    expect(cardOverlay.querySelector('.card-frame')).not.toBeNull();
    expect(cardOverlay.textContent).toContain(ru.catalog.enhancements.glass.name);
    expect(cardOverlay.textContent).toContain(ru.catalog.editions.holo.name);
    expect(cardOverlay.textContent).toContain(ru.catalog.seals.red.name);
    expect(cardOverlay.textContent).toContain(ru.t('ui.hud.debuffedBadge'));
    expect(cardOverlay.textContent).toContain('+35');

    const bossId: BossId = 'bl_hook';
    const bossOverlay = renderInspectorOverlay(
      { kind: 'boss', bossId, disabled: true },
      state,
      ru,
      callbacks,
    );
    assertCleanLocalizedElement(bossOverlay);
    expect(bossOverlay.textContent).toContain(ru.getBossText(bossId).name);
    expect(bossOverlay.textContent).toContain(ru.t('ui.hud.abilityDisabled'));
  });
});

describe('Модальные окна (src/ui/modals.ts)', () => {
  it('renderHandReferenceModal показывает все 12 раскладов и маскирует скрытые при visible === false', () => {
    const ru = createTranslator('ru');
    const en = createTranslator('en');
    const baseState = createTestState();

    // Делаем пару раскладов прокачанными/сыгранными, а Flush House открытым для проверки обоих состояний
    const customLevels = {
      ...baseState.handLevels,
      Pair: {
        ...baseState.handLevels.Pair,
        level: 3,
        chips: 40,
        mult: 4,
        playedCount: 7,
      },
      'Flush House': {
        ...baseState.handLevels['Flush House'],
        visible: true,
        playedCount: 1,
      },
    };
    const state = { ...baseState, handLevels: customLevels };
    const onClose = vi.fn();

    const modalRu = renderHandReferenceModal(state, ru, onClose);
    assertCleanLocalizedElement(modalRu);

    const rows = modalRu.querySelectorAll<HTMLElement>('[data-hand-type]');
    expect(rows).toHaveLength(HAND_TYPES.length);

    const pairRow = modalRu.querySelector<HTMLElement>('[data-hand-type="Pair"]');
    expect(pairRow?.textContent).toContain(ru.getHandText('Pair').name);
    expect(pairRow?.textContent).toContain(ru.t('ui.handReference.level', { level: 3 }));
    expect(pairRow?.textContent).toContain(ru.t('ui.handReference.played', { count: 7 }));
    expect(pairRow?.textContent).toContain(
      ru.t('ui.handReference.baseFormula', { chips: 40, mult: 4 }),
    );

    // Скрытые на старте Flush Five и Five of a Kind не должны утекать названием
    const hiddenRow = modalRu.querySelector<HTMLElement>('[data-hand-type="Flush Five"]');
    expect(hiddenRow?.dataset.visible).toBe('false');
    expect(hiddenRow?.textContent).toContain(ru.t('ui.handReference.hiddenLayout'));
    expect(hiddenRow?.textContent).not.toContain(ru.getHandText('Flush Five').name);

    // Открытый Flush House отображает своё название
    const openedRow = modalRu.querySelector<HTMLElement>('[data-hand-type="Flush House"]');
    expect(openedRow?.dataset.visible).toBe('true');
    expect(openedRow?.textContent).toContain(ru.getHandText('Flush House').name);

    // Проверка EN локали и закрытия по кнопке / фону
    const modalEn = renderHandReferenceModal(state, en, onClose);
    assertCleanLocalizedElement(modalEn);
    const hiddenRowEn = modalEn.querySelector<HTMLElement>('[data-hand-type="Five of a Kind"]');
    expect(hiddenRowEn?.textContent).toContain(en.t('ui.handReference.hiddenLayout'));

    modalRu.querySelector<HTMLElement>('.modal-sheet')?.click();
    expect(onClose).not.toHaveBeenCalled();
    modalRu.querySelector<HTMLButtonElement>('[data-action="close"]')?.click();
    modalRu.click();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renderDeckModal отображает вкладки Оставшаяся/Полная колода, левую сводку и 4 ряда мастей от Туза к 2 с тултипами', () => {
    const ru = createTranslator('ru');
    const baseState = createTestState();

    // Превращаем одну карту в Каменную, чтобы проверить исключение Каменных из сводки мастей и рангов
    const firstCard = baseState.deck[0]!;
    const secondCard = baseState.deck[1]!;
    const thirdCard = baseState.deck[2]!;
    const fourthCard = baseState.deck[3]!;
    const modifiedDeck = baseState.deck.map((c) =>
      c.id === firstCard.id ? { ...c, enhancement: 'stone' as const } : c,
    );

    const unsortedDrawIds = modifiedDeck
      .map((c) => c.id)
      .filter((id) => id !== firstCard.id && id !== secondCard.id && id !== thirdCard.id && id !== fourthCard.id)
      .reverse();

    const state: RunState = {
      ...baseState,
      deck: modifiedDeck,
      handIds: [firstCard.id, secondCard.id],
      discardPileIds: [thirdCard.id],
      drawPileIds: unsortedDrawIds,
    };

    const onClose = vi.fn();
    const modal = renderDeckModal(state, ru, onClose);
    assertCleanLocalizedElement(modal);

    // По умолчанию открыта вкладка «Оставшаяся колода»
    const remainingTab = modal.querySelector<HTMLButtonElement>('[data-deck-tab="remaining"]');
    const fullTab = modal.querySelector<HTMLButtonElement>('[data-deck-tab="full"]');
    expect(remainingTab?.getAttribute('aria-pressed')).toBe('true');
    expect(fullTab?.getAttribute('aria-pressed')).toBe('false');
    expect(modal.querySelectorAll('.card-frame')).toHaveLength(unsortedDrawIds.length);

    // Карточка стартовой колоды слева
    expect(modal.querySelector('.deck-info-card')?.textContent).toContain(
      ru.getDeckText(state.deckId).name,
    );

    // Переключаемся на вкладку «Полная колода»
    fullTab?.click();
    expect(fullTab?.getAttribute('aria-pressed')).toBe('true');
    expect(remainingTab?.getAttribute('aria-pressed')).toBe('false');

    // В полной колоде (52 карты, из них 1 Каменная) 4 ряда мастей содержат 51 обычную карту, а каменная идёт отдельно
    const suitRows = Array.from(modal.querySelectorAll<HTMLElement>('[data-suit-row]'));
    expect(suitRows.map((row) => row.dataset.suitRow)).toEqual([
      'spades',
      'hearts',
      'clubs',
      'diamonds',
    ]);

    const rankById = new Map(modifiedDeck.map((c) => [c.id, c.rank]));
    for (const row of suitRows) {
      const rowFrames = Array.from(row.querySelectorAll<HTMLElement>('.card-frame'));
      const ranks = rowFrames.map((el) => rankById.get(el.dataset.cardId ?? '') ?? 0);
      for (let i = 1; i < ranks.length; i += 1) {
        expect(ranks[i - 1]!).toBeGreaterThanOrEqual(ranks[i]!);
      }
    }

    // Проверка сводки по мастям и рангам (Каменная карта не считается в свою исходную масть)
    const stoneSuitEl = modal.querySelector<HTMLElement>(
      `[data-suit-summary="${firstCard.suit}"]`,
    );
    expect(stoneSuitEl?.dataset.count).toBe('12');
    expect(modal.querySelectorAll('[data-rank-summary]')).toHaveLength(13);
    expect(modal.querySelector('[data-base-category="aces"]')?.textContent).toContain('4');
    expect(modal.querySelector('[data-base-category="faces"]')?.textContent).toContain('12');

    // Ховер-тултип привязан к каждой мини-карте
    const sampleFrame = modal.querySelector<HTMLElement>('[data-suit-row] .card-frame');
    expect(sampleFrame).not.toBeNull();
    expect(getTooltipData(sampleFrame!)?.title.length).toBeGreaterThan(0);
    for (const frame of Array.from(modal.querySelectorAll<HTMLElement>('.card-frame'))) {
      expect(frame.classList.contains('is-compact')).toBe(true);
      expect(frame.classList.contains('is-interactive')).toBe(false);
    }

    const closeBtn = modal.querySelector<HTMLButtonElement>('[data-action="close"]');
    expect(closeBtn?.textContent).toBe(ru.t('ui.deckModal.backButton'));
    closeBtn?.click();
    modal.click();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renderSettingsModal управляет скоростью, звуком, громкостью, языком и отладкой', async () => {
    const ru = createTranslator('ru');
    const settings: GameSettings = {
      animationSpeed: 2,
      lang: 'ru',
      soundEnabled: true,
      musicVolume: 0.4,
      sfxVolume: 0.8,
      crtMode: 'light',
    };
    const onChangeSettings = vi.fn();
    const onClose = vi.fn();
    const onDebugAction = vi.fn().mockResolvedValue('ok:done');

    const baseOptions: SettingsModalOptions = {
      settings,
      translator: ru,
      platformId: 'mock',
      isDebug: false,
      onChangeSettings,
      onClose,
      onDebugAction,
    };

    const modalNoDebug = renderSettingsModal({
      ...baseOptions,
      initialTab: 'settings',
    });
    assertCleanLocalizedElement(modalNoDebug);
    expect(modalNoDebug.querySelector('[data-debug-panel]')).toBeNull();
    expect(modalNoDebug.querySelector('[data-debug-action]')).toBeNull();

    // 4 опции скорости: 0.5x, 1x, 2x, 4x
    const speedButtons = Array.from(modalNoDebug.querySelectorAll<HTMLButtonElement>('[data-speed]'));
    expect(speedButtons.map((btn) => btn.dataset.speed)).toEqual(['0.5', '1', '2', '4']);
    expect(speedButtons.map((btn) => btn.textContent?.trim())).toEqual(['0.5x', '1x', '2x', '4x']);

    // Скорость 0.5x и 4x
    modalNoDebug.querySelector<HTMLButtonElement>('[data-speed="0.5"]')?.click();
    expect(onChangeSettings).toHaveBeenLastCalledWith({ animationSpeed: 0.5 });

    modalNoDebug.querySelector<HTMLButtonElement>('[data-speed="4"]')?.click();
    expect(onChangeSettings).toHaveBeenLastCalledWith({ animationSpeed: 4 });

    // Выключение звука
    modalNoDebug.querySelector<HTMLButtonElement>('[data-sound="off"]')?.click();
    expect(onChangeSettings).toHaveBeenLastCalledWith({ soundEnabled: false });

    // Ползунки громкости
    const sfxInput = modalNoDebug.querySelector<HTMLInputElement>('input[data-volume="sfx"]');
    const musicInput = modalNoDebug.querySelector<HTMLInputElement>('input[data-volume="music"]');
    expect(sfxInput?.value).toBe('0.8');
    expect(musicInput?.value).toBe('0.4');
    if (sfxInput && musicInput) {
      sfxInput.value = '0.55';
      sfxInput.dispatchEvent(new Event('input', { bubbles: true }));
      expect(onChangeSettings).toHaveBeenLastCalledWith({ sfxVolume: 0.55 });

      musicInput.value = '0.25';
      musicInput.dispatchEvent(new Event('change', { bubbles: true }));
      expect(onChangeSettings).toHaveBeenLastCalledWith({ musicVolume: 0.25 });
    }

    // Переключение языка на EN
    modalNoDebug.querySelector<HTMLButtonElement>('[data-lang="en"]')?.click();
    expect(onChangeSettings).toHaveBeenLastCalledWith({ lang: 'en' });

    // Переключение режима CRT-эффекта: Выкл / Лёгкий / Оригинал
    const crtButtons = Array.from(
      modalNoDebug.querySelectorAll<HTMLButtonElement>('[data-crt-mode]'),
    );
    expect(crtButtons.map((btn) => btn.dataset.crtMode)).toEqual(['off', 'light', 'original']);
    expect(
      modalNoDebug
        .querySelector<HTMLButtonElement>('[data-crt-mode="light"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');

    modalNoDebug.querySelector<HTMLButtonElement>('[data-crt-mode="original"]')?.click();
    expect(onChangeSettings).toHaveBeenLastCalledWith({ crtMode: 'original' });

    modalNoDebug.querySelector<HTMLButtonElement>('[data-crt-mode="off"]')?.click();
    expect(onChangeSettings).toHaveBeenLastCalledWith({ crtMode: 'off' });

    // Закрытие по фону (и возврат в хаб по кнопке Назад)
    modalNoDebug.click();
    expect(onClose).toHaveBeenCalledTimes(1);

    // Режим отладки (?debug)
    const modalDebug = renderSettingsModal({
      ...baseOptions,
      initialTab: 'settings',
      isDebug: true,
      platformId: 'yandex',
    });
    const debugPanel = modalDebug.querySelector<HTMLElement>('[data-debug-panel]');
    expect(debugPanel).not.toBeNull();
    expect(debugPanel?.textContent).toContain('yandex');

    const debugActions = ['interstitial', 'rewarded', 'flush', 'resetRun'] as const;
    for (const action of debugActions) {
      const btn = modalDebug.querySelector<HTMLButtonElement>(`[data-debug-action="${action}"]`);
      expect(btn).not.toBeNull();
      btn?.click();
      await Promise.resolve();
      expect(onDebugAction).toHaveBeenCalledWith(action);
    }

    const logEl = modalDebug.querySelector<HTMLElement>('[data-debug-log]');
    expect(logEl?.textContent).toContain('ok:done');
    // Проверяем, что все кнопки инспектора и модалок оформлены как сенсорные кнопки .modal-btn
    const buttons = modalDebug.querySelectorAll<HTMLButtonElement>('button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of Array.from(buttons)) {
      expect(button.type).toBe('button');
      expect(button.classList.contains('modal-btn')).toBe(true);
    }
  });

  it('renderSettingsModal открывает хаб Параметры с переходами в Настройки, Статистику, Титры и В главное меню', () => {
    const ru = createTranslator('ru');
    const baseMeta = createInitialMetaSave(1000, { lang: 'ru', animationSpeed: 1 });
    const meta = {
      ...baseMeta,
      discoveredRelics: ['j_joker', 'j_banner'],
      discoveredConsumables: ['c_mercury'],
      stats: {
        ...baseMeta.stats,
        runsStarted: 7,
        runsWon: 3,
        highestAnte: 6,
        bestHandScore: 14500,
        totalHandsPlayed: 42,
        highestRound: 17,
        maxDollars: 84,
        bestWinStreak: 2,
        currentWinStreak: 1,
        handPlayCounts: {
          Pair: 18,
          Flush: 9,
        },
      },
    } as unknown as MetaSave;

    const onClose = vi.fn();
    const onReturnToMainMenu = vi.fn();
    const onTabChange = vi.fn();

    // Вне активного забега кнопка «В главное меню» скрыта
    const hubFromMenu = renderSettingsModal({
      settings: meta.settings,
      meta,
      version: '0.1.0',
      translator: ru,
      canReturnToMainMenu: false,
      onChangeSettings: vi.fn(),
      onClose,
      onReturnToMainMenu,
      onTabChange,
    });
    assertCleanLocalizedElement(hubFromMenu);
    expect(hubFromMenu.querySelector('[data-hub-action="settings"]')).not.toBeNull();
    expect(hubFromMenu.querySelector('[data-hub-action="stats"]')).not.toBeNull();
    expect(hubFromMenu.querySelector('[data-hub-action="credits"]')).not.toBeNull();
    expect(hubFromMenu.querySelector('[data-hub-action="main-menu"]')).toBeNull();

    // Вкладка «Статистика» отображает все показатели из MetaSave
    hubFromMenu.querySelector<HTMLButtonElement>('[data-hub-action="stats"]')?.click();
    expect(onTabChange).toHaveBeenLastCalledWith('stats');
    assertCleanLocalizedElement(hubFromMenu);
    const statsPanel = hubFromMenu.querySelector<HTMLElement>('[data-stats-panel]');
    expect(statsPanel).not.toBeNull();
    expect(statsPanel?.textContent).toContain('14500');
    expect(statsPanel?.textContent).toContain('17');
    expect(statsPanel?.textContent).toContain('6');
    expect(statsPanel?.textContent).toContain('84');
    expect(statsPanel?.textContent).toContain('2 (1)');
    expect(statsPanel?.textContent).toContain('7 / 3');
    expect(statsPanel?.textContent).toContain(`${ru.getHandText('Pair').name} (18)`);
    expect(statsPanel?.textContent).toMatch(/% \(\d+\/\d+\)/);

    // Назад из Статистики возвращает в хаб
    hubFromMenu.querySelector<HTMLButtonElement>('[data-action="hub-back"]')?.click();
    expect(onTabChange).toHaveBeenLastCalledWith('hub');
    expect(hubFromMenu.querySelector('[data-hub-action="stats"]')).not.toBeNull();

    // Вкладка «Титры» содержит версию и не содержит кликабельных ссылок
    hubFromMenu.querySelector<HTMLButtonElement>('[data-hub-action="credits"]')?.click();
    expect(onTabChange).toHaveBeenLastCalledWith('credits');
    assertCleanLocalizedElement(hubFromMenu);
    const creditsPanel = hubFromMenu.querySelector<HTMLElement>('[data-credits-panel]');
    expect(creditsPanel).not.toBeNull();
    expect(creditsPanel?.textContent).toContain('0.1.0');
    expect(creditsPanel?.querySelectorAll('a').length).toBe(0);
    expect(creditsPanel?.innerHTML).not.toMatch(/https?:/i);

    // Назад из Титров -> хаб, затем Назад/Закрыть в хабе -> onClose
    hubFromMenu.querySelector<HTMLButtonElement>('[data-action="hub-back"]')?.click();
    hubFromMenu.querySelector<HTMLButtonElement>('[data-action="close"]')?.click();
    expect(onClose).toHaveBeenCalledTimes(1);

    // Из активного забега кнопка «В главное меню» отображается и вызывает onReturnToMainMenu
    const hubFromRun = renderSettingsModal({
      settings: meta.settings,
      meta,
      translator: ru,
      canReturnToMainMenu: true,
      onChangeSettings: vi.fn(),
      onClose,
      onReturnToMainMenu,
    });
    const toMenuBtn = hubFromRun.querySelector<HTMLButtonElement>('[data-hub-action="main-menu"]');
    expect(toMenuBtn).not.toBeNull();
    toMenuBtn?.click();
    expect(onReturnToMainMenu).toHaveBeenCalledTimes(1);

    // Пустая статистика показывает «Нет (0)» для самой частой руки
    const emptyMeta = createInitialMetaSave(1000, { lang: 'ru' });
    const emptyStatsModal = renderSettingsModal({
      settings: emptyMeta.settings,
      meta: emptyMeta,
      initialTab: 'stats',
      translator: ru,
      onChangeSettings: vi.fn(),
      onClose,
    });
    expect(emptyStatsModal.querySelector('[data-stats-panel]')?.textContent).toContain('Нет (0)');
  });

  it('показывает тумблер DEV-словаря строго при isDebug=true и передаёт переключение в колбэк', () => {
    const ru = createTranslator('ru');
    const meta = createInitialMetaSave(1000, { lang: 'ru' });
    const onToggleDevOriginalTerms = vi.fn();

    const normalModal = renderSettingsModal({
      settings: meta.settings,
      meta,
      initialTab: 'settings',
      isDebug: false,
      devOriginalTermsEnabled: false,
      onToggleDevOriginalTerms,
      translator: ru,
      onChangeSettings: vi.fn(),
      onClose: vi.fn(),
    });
    expect(normalModal.querySelector('[data-dev-terms]')).toBeNull();

    const debugModal = renderSettingsModal({
      settings: meta.settings,
      meta,
      initialTab: 'settings',
      isDebug: true,
      devOriginalTermsEnabled: false,
      onToggleDevOriginalTerms,
      translator: ru,
      onChangeSettings: vi.fn(),
      onClose: vi.fn(),
    });

    const offBtn = debugModal.querySelector<HTMLButtonElement>('[data-dev-terms="off"]');
    const onBtn = debugModal.querySelector<HTMLButtonElement>('[data-dev-terms="on"]');
    expect(offBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(onBtn?.getAttribute('aria-pressed')).toBe('false');

    onBtn?.click();
    expect(onToggleDevOriginalTerms).toHaveBeenCalledWith(true);

    offBtn?.click();
    expect(onToggleDevOriginalTerms).toHaveBeenCalledWith(false);
  });

  it('показывает кнопку открытия Админ-панели в Настройках только при isDebug=true', () => {
    const ru = createTranslator('ru');
    const meta = createInitialMetaSave(1000, { lang: 'ru' });
    const onOpenDebugPanel = vi.fn();

    const normalModal = renderSettingsModal({
      settings: meta.settings,
      meta,
      initialTab: 'settings',
      isDebug: false,
      onOpenDebugPanel,
      translator: ru,
      onChangeSettings: vi.fn(),
      onClose: vi.fn(),
    });
    expect(normalModal.querySelector('[data-debug-open-panel]')).toBeNull();

    const debugModal = renderSettingsModal({
      settings: meta.settings,
      meta,
      initialTab: 'settings',
      isDebug: true,
      onOpenDebugPanel,
      translator: ru,
      onChangeSettings: vi.fn(),
      onClose: vi.fn(),
    });
    const openBtn = debugModal.querySelector<HTMLButtonElement>('[data-debug-open-panel]');
    expect(openBtn).not.toBeNull();
    openBtn?.click();
    expect(onOpenDebugPanel).toHaveBeenCalledTimes(1);
  });

  it('синхронизирует сводку открытий в Статистике (computeMetaStatsSummary) со всеми категориями Коллекции (1..143, до 100%)', () => {
    const ru = createTranslator('ru');

    // Новый профиль: открыта 1 стартовая колода из 143 всех открываемых сущностей
    const freshMeta = createInitialMetaSave(1000, { lang: 'ru' });
    const freshSummary = computeMetaStatsSummary(freshMeta);
    expect(freshSummary.discoveredCount).toBe(1);
    expect(freshSummary.totalDiscoverable).toBe(143);
    expect(freshSummary.discoveryPercent).toBe(1);

    const freshModal = renderSettingsModal({
      settings: freshMeta.settings,
      meta: freshMeta,
      initialTab: 'stats',
      translator: ru,
      onChangeSettings: vi.fn(),
      onClose: vi.fn(),
    });
    assertCleanLocalizedElement(freshModal);
    expect(freshModal.querySelector('[data-stats-panel]')?.textContent).toContain('1% (1/143)');

    // Учитываются новые категории Коллекции (талоны, монстры кроме 2 стартовых, сундуки, издания кроме base)
    const partialMeta: MetaSave = {
      ...freshMeta,
      discoveredTags: ['tag_uncommon', 'tag_rare'],
      discoveredMonsters: ['m_ante_1_small', 'm_ante_1_big', 'm_ante_2_small'],
      discoveredPacks: ['pack_arcana_normal', 'pack_celestial_normal'],
      discoveredEditions: ['base', 'foil', 'holo'],
      stats: {
        ...freshMeta.stats,
        totalMoneySpent: 350,
        totalShopRerolls: 12,
        totalCelestialsUsed: 7,
      },
    };
    const partialSummary = computeMetaStatsSummary(partialMeta);
    // 1 (колода) + 2 (талона) + 1 (монстр поверх 2 базовых) + 2 (сундука) + 2 (издания поверх base) = 8
    expect(partialSummary.discoveredCount).toBe(8);
    expect(partialSummary.totalDiscoverable).toBe(143);
    expect(partialSummary.totalMoneySpent).toBe(350);
    expect(partialSummary.totalShopRerolls).toBe(12);
    expect(partialSummary.totalCelestialsUsed).toBe(7);

    // Полное открытие всех сущностей не превышает 100% (143/143)
    const fullMeta = unlockAllCollection(freshMeta);
    const fullSummary = computeMetaStatsSummary(fullMeta);
    expect(fullSummary.discoveredCount).toBe(143);
    expect(fullSummary.totalDiscoverable).toBe(143);
    expect(fullSummary.discoveryPercent).toBe(100);

    const fullModal = renderSettingsModal({
      settings: fullMeta.settings,
      meta: fullMeta,
      initialTab: 'stats',
      translator: ru,
      onChangeSettings: vi.fn(),
      onClose: vi.fn(),
    });
    assertCleanLocalizedElement(fullModal);
    expect(fullModal.querySelector('[data-stats-panel]')?.textContent).toContain('100% (143/143)');
  });

  it('помечает сыгранные на этаже (playedThisAnte) и ослабленные (debuffed) карты в окне «Состав колоды» (вкл. каменные карты и тултипы) без запрещённых слов', () => {
    for (const lang of ['ru', 'en'] as const) {
      const translator = createTranslator(lang);
      const baseRun = createTestState();
      const stoneCardId = baseRun.deck[3]!.id;
      const modifiedDeck: PlayingCard[] = baseRun.deck.map((c, idx) => {
        if (idx === 0) return { ...c, playedThisAnte: true };
        if (idx === 1) return { ...c, debuffed: true };
        if (idx === 2) return { ...c, playedThisAnte: true, debuffed: true };
        if (idx === 3) {
          return { ...c, enhancement: 'stone', playedThisAnte: true, debuffed: true };
        }
        return c;
      });
      const run: RunState = {
        ...baseRun,
        deck: modifiedDeck,
      };

      const modal = renderDeckModal(run, translator, vi.fn());
      // Переключаемся на вкладку «Полная колода», чтобы проверить все карты колоды
      modal.querySelector<HTMLButtonElement>('[data-deck-tab="full"]')?.click();

      assertCleanLocalizedElement(modal);

      const playedCards = modal.querySelectorAll<HTMLElement>(
        '.card-frame.is-played-this-ante[data-played-this-ante="true"]',
      );
      // playedSuitCard + bothSuitCard + stoneCard = 3
      expect(playedCards.length).toBe(3);

      const debuffedCards = modal.querySelectorAll<HTMLElement>(
        '.card-frame.is-debuffed[data-debuffed="true"]',
      );
      // debuffedSuitCard + bothSuitCard + stoneCard = 3
      expect(debuffedCards.length).toBe(3);

      const playedBadges = modal.querySelectorAll<HTMLElement>(
        '[data-deck-badge="played-this-ante"]',
      );
      expect(playedBadges.length).toBe(3);
      for (const badge of playedBadges) {
        expect(badge.textContent).toBe(translator.t('ui.deckModal.playedThisAnteBadge'));
      }

      const debuffBadges = modal.querySelectorAll<HTMLElement>('[data-deck-badge="debuffed"]');
      expect(debuffBadges.length).toBe(3);
      for (const badge of debuffBadges) {
        expect(badge.textContent).toBe(translator.t('ui.hud.debuffedBadge'));
      }

      // Проверяем каменную карту в секции stoneCards
      const stoneCardEl = modal.querySelector<HTMLElement>(
        `.deck-stone-row [data-card-id="${stoneCardId}"]`,
      );
      expect(stoneCardEl).not.toBeNull();
      expect(stoneCardEl?.classList.contains('is-played-this-ante')).toBe(true);
      expect(stoneCardEl?.classList.contains('is-debuffed')).toBe(true);
      expect(
        stoneCardEl?.querySelector('[data-deck-badge="played-this-ante"]')?.textContent,
      ).toBe(translator.t('ui.deckModal.playedThisAnteBadge'));
      expect(stoneCardEl?.querySelector('[data-deck-badge="debuffed"]')?.textContent).toBe(
        translator.t('ui.hud.debuffedBadge'),
      );

      // Проверяем тултипы сыгранной и каменной карт (подсказка playedThisAnteHint + отсутствие запрещённых слов)
      for (const cardEl of Array.from(playedCards)) {
        const tooltip = getTooltipData(cardEl);
        expect(tooltip).toBeDefined();
        expect(tooltip?.description).toContain(translator.t('ui.deckModal.playedThisAnteHint'));
        expect(
          tooltip?.badges?.some(
            (b) => b.label === translator.t('ui.deckModal.playedThisAnteBadge'),
          ),
        ).toBe(true);
        const tooltipText = `${tooltip?.title ?? ''} ${tooltip?.subtitle ?? ''} ${tooltip?.description ?? ''} ${(tooltip?.badges ?? []).map((b) => b.label).join(' ')}`;
        for (const pattern of FORBIDDEN_TEXT_PATTERNS) {
          expect(tooltipText).not.toMatch(pattern);
        }
      }

      for (const cardEl of Array.from(debuffedCards)) {
        const tooltip = getTooltipData(cardEl);
        expect(tooltip).toBeDefined();
        expect(
          tooltip?.badges?.some((b) => b.label === translator.t('ui.hud.debuffedBadge')),
        ).toBe(true);
      }
    }
  });

  it('modals.css допускает :hover только под @media (hover: hover) and (pointer: fine)', async () => {
    const fsModule = 'node:fs';
    const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as {
      readFileSync: (file: string, encoding: 'utf8') => string;
    };
    const css = readFileSync('src/ui/modals.css', 'utf8');
    const withoutFineHover = css.replace(
      /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*\{[\s\S]*?\}\s*\}/g,
      '',
    );
    expect(withoutFineHover).not.toMatch(/:hover\b/);
  });
});
