import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOSS_DEFINITIONS,
  DECK_IDS,
  createConsumableInstance,
  createInitialMetaSave,
  createInitialRunState,
  createPlayingCard,
  createRelicInstance,
  dispatch,
} from '../../src/engine';
import type {
  GameCommand,
  PlayingCard,
  RunState,
} from '../../src/engine/types';
import { createTranslator } from '../../src/i18n';
import {
  type ScreenActionHandlers,
  type ScreenViewModel,
  getBlindSpriteUrl,
  renderRunView,
} from '../../src/ui/screens';
import { getTooltipData } from '../../src/ui/tooltip';

/**
 * Запрещённые слова для возрастного рейтинга 6+/12+ (модерация площадок).
 */
const FORBIDDEN_EN_PATTERNS: readonly RegExp[] = [
  /\bpokers?\b/i,
  /\bcasinos?\b/i,
  /\bbets?\b/i,
  /\bbetting\b/i,
  /\bstakes?\b/i,
  /\bblinds?\b/i,
  /\bchips?\b/i,
  /\btarots?\b/i,
  /\bdevils?\b/i,
  /\bhanged\s*man\b/i,
  /\bhanged\b/i,
  /\bouija\b/i,
  /\bdrunkards?\b/i,
  /\bjokers?\b/i,
  /\bvampires?\b/i,
  /\bgambl(?:e|ing)\b/i,
  /\bjackpots?\b/i,
  /\broulette\b/i,
];

const FORBIDDEN_RU_PATTERNS: readonly RegExp[] = [
  /(?<![а-яё])покер/iu,
  /(?<![а-яё])казино/iu,
  /(?<![а-яё])ставк[аиуео]?[ймх]?/iu,
  /(?<![а-яё])блайнд/iu,
  /(?<![а-яё])фишк/iu,
  /(?<![а-яё])фишек/iu,
  /(?<![а-яё])таро(?![а-яё])/iu,
  /(?<![а-яё])дьявол/iu,
  /(?<![а-яё])повешен/iu,
  /(?<![а-яё])шулер/iu,
  /(?<![а-яё])жертв/iu,
  /(?<![а-яё])вампир/iu,
  /(?<![а-яё])джокер/iu,
  /(?<![а-яё])рулетк/iu,
  /(?<![а-яё])азарт/iu,
];

/**
 * Создаёт набор отслеживаемых обработчиков действий экранов.
 */
function createMockHandlers(): ScreenActionHandlers {
  return {
    onSelectDeck: vi.fn(),
    onSeedInput: vi.fn(),
    onRandomSeed: vi.fn(),
    onStartRun: vi.fn(),
    onResumeSavedRun: vi.fn(),
    onCommand: vi.fn(),
    onToggleCard: vi.fn(),
    onConfirmConsumableTargets: vi.fn(),
    onCancelConsumableTargets: vi.fn(),
    onInspectRelic: vi.fn(),
    onInspectConsumable: vi.fn(),
    onInspectOffer: vi.fn(),
    onInspectCharter: vi.fn(),
    onInspectPack: vi.fn(),
    onInspectPlayingCard: vi.fn(),
    onInspectBoss: vi.fn(),
    onOpenHandReference: vi.fn(),
    onOpenDeckModal: vi.fn(),
    onOpenSettings: vi.fn(),
    onSkipAnimation: vi.fn(),
    onReturnToDeckSelect: vi.fn(),
    onBackToMainMenu: vi.fn(),
  };
}

/**
 * Прогоняет последовательность команд через движок игры и возвращает итоговое состояние.
 */
function advanceRun(initial: RunState, commands: readonly GameCommand[]): RunState {
  let current = initial;
  for (const cmd of commands) {
    current = dispatch(current, cmd).nextState;
  }
  return current;
}

/**
 * Создаёт состояние фазы `playing` из реального движка с детерминированным сидом.
 */
function createPlayingState(seed = 'TEST_SEED_1'): RunState {
  const base = createInitialRunState('b_red', seed);
  return advanceRun(base, [
    { type: 'START_RUN', deckId: 'b_red', seed },
    { type: 'SELECT_BLIND' },
  ]);
}

/**
 * Собирает модель представления экранов с безопасными значениями по умолчанию.
 */
function createViewModel(
  state: RunState,
  overrides: Partial<ScreenViewModel> = {},
): ScreenViewModel {
  return {
    state,
    translator: createTranslator('ru'),
    selectedCardIds: [],
    playedCardIds: [],
    shatteredCardIds: [],
    highlightedCardId: null,
    highlightedHandCardId: null,
    highlightedRelicUid: null,
    liveScore: null,
    liveDollars: null,
    bannerMessage: null,
    isAnimating: false,
    unlockedDecks: DECK_IDS,
    selectedDeckId: state.deckId,
    seedInput: state.seed,
    hasSavedRun: false,
    consumableTargetMode: null,
    ...overrides,
  };
}

/**
 * Эмулирует pointer-событие в jsdom с гарантированными координатами.
 */
function emitPointer(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  clientX: number,
  clientY = 100,
): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: 1 },
    button: { value: 0 },
  });
  target.dispatchEvent(event);
}

/**
 * Находит кнопку по тексту её подписи.
 */
function findButtonByText(root: HTMLElement, textSnippet: string): HTMLButtonElement | null {
  const buttons = Array.from(root.querySelectorAll('button'));
  return (
    buttons.find((btn) => (btn.textContent ?? '').includes(textSnippet)) ?? null
  );
}

describe('4-поясной рендер экранов Balite (screens.ts)', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(() => {
    vi.useRealTimers();
    root.remove();
  });

  describe('Контракт ScreenRefs, быстрые обновления и баннеры', () => {
    it('возвращает все 8 обязательных ссылок ScreenRefs даже на экране выбора колоды', () => {
      const state = createInitialRunState('b_red', 'SEED');
      const handlers = createMockHandlers();
      const refs = renderRunView(root, createViewModel(state), handlers);

      expect(refs.chipsEl).toBeInstanceOf(HTMLElement);
      expect(refs.multEl).toBeInstanceOf(HTMLElement);
      expect(refs.scoreEl).toBeInstanceOf(HTMLElement);
      expect(refs.dollarsEl).toBeInstanceOf(HTMLElement);
      expect(refs.handTypeEl).toBeInstanceOf(HTMLElement);
      expect(refs.popupLayerEl).toBeInstanceOf(HTMLElement);
      expect(refs.bannerEl).toBeInstanceOf(HTMLElement);
      expect(refs.arenaEl).toBeInstanceOf(HTMLElement);
    });

    it('отображает liveScore, liveDollars и допускает точечную мутацию ScreenRefs без полного перерендера', () => {
      const state = createPlayingState('LIVE_REFS');
      const handlers = createMockHandlers();
      const vm = createViewModel(state, {
        liveScore: {
          chips: 120,
          mult: 8,
          totalScore: 960,
          targetScore: 450,
          handType: 'Flush',
        },
        liveDollars: 42,
        bannerMessage: { text: 'Оглушительная победа!', tone: 'win' },
      });

      const refs = renderRunView(root, vm, handlers);
      expect(refs.chipsEl.textContent).toBe('120');
      expect(refs.multEl.textContent).toBe('8');
      expect(refs.scoreEl.textContent).toBe('960');
      expect(refs.dollarsEl.textContent).toContain('42');
      expect(refs.handTypeEl.textContent).toContain('Масть');
      expect(refs.bannerEl.textContent).toContain('Оглушительная победа!');
      expect(refs.bannerEl.dataset.tone).toBe('win');

      // Имитация прямого тикового обновления из TracePlayer
      refs.chipsEl.textContent = '155';
      refs.multEl.textContent = '12';
      refs.scoreEl.textContent = '1860';
      expect(refs.chipsEl.textContent).toBe('155');
      expect(refs.multEl.textContent).toBe('12');
      expect(refs.scoreEl.textContent).toBe('1860');
    });

    it('рендерит 4 пояса с семантическими атрибутами data-belt', () => {
      const state = createPlayingState('BELTS');
      renderRunView(root, createViewModel(state), createMockHandlers());

      expect(root.querySelector('[data-belt="hud"]')).not.toBeNull();
      expect(root.querySelector('[data-belt="inventory"]')).not.toBeNull();
      expect(root.querySelector('[data-belt="arena"]')).not.toBeNull();
      expect(root.querySelector('[data-belt="hand"]')).not.toBeNull();
    });
  });

  describe('Пояс 1: HUD и живой калькулятор расклада', () => {
    it('показывает Этап X/8 в обычном забеге и Бесконечный этап X в бесконечном режиме', () => {
      const state = createPlayingState('HUD_ANTE');
      const handlers = createMockHandlers();
      renderRunView(root, createViewModel(state), handlers);
      const hud = root.querySelector('[data-belt="hud"]') as HTMLElement;
      expect(hud.textContent).toContain('Этаж 1 (1/8)');
      expect(hud.textContent).toContain('Бой 1');

      const endlessState: RunState = {
        ...state,
        ante: 10,
        endlessMode: true,
      };
      renderRunView(root, createViewModel(endlessState), handlers);
      const hudEndless = root.querySelector('[data-belt="hud"]') as HTMLElement;
      expect(hudEndless.textContent).toContain('Этаж 10 (Бесконечный)');
    });

    it('вызывает onOpenHandReference, onOpenSettings и onInspectBoss по тапу в HUD', () => {
      const base = createInitialRunState('b_red', 'BOSS_HUD');
      const state = advanceRun(base, [
        { type: 'START_RUN', deckId: 'b_red', seed: 'BOSS_HUD' },
        { type: 'SKIP_BLIND' },
        { type: 'SKIP_BLIND' },
        { type: 'SELECT_BLIND' },
      ]);
      const bossId = state.anteBlinds[2].bossId!;
      const bossState: RunState = { ...state, activeBossDisabled: true };
      const handlers = createMockHandlers();

      renderRunView(root, createViewModel(bossState), handlers);
      const hud = root.querySelector('[data-belt="hud"]') as HTMLElement;

      findButtonByText(hud, 'Комбинации')?.click();
      expect(handlers.onOpenHandReference).toHaveBeenCalledTimes(1);

      findButtonByText(hud, 'Настройки')?.click();
      expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);

      const bossTrigger = hud.querySelector('[data-boss-id]') as HTMLElement;
      expect(bossTrigger).not.toBeNull();
      bossTrigger.click();
      expect(handlers.onInspectBoss).toHaveBeenCalledWith(bossId, true);
    });

    it('живой калькулятор оценивает Пару, Высший ряд (Royal Flush), модификаторы Реликвий и уполовинивание bl_flint', () => {
      const baseState = createPlayingState('CALC');
      const customDeck: PlayingCard[] = [
        createPlayingCard({ id: 'c_as', suit: 'spades', rank: 14 }),
        createPlayingCard({ id: 'c_ks', suit: 'spades', rank: 13 }),
        createPlayingCard({ id: 'c_qs', suit: 'spades', rank: 12 }),
        createPlayingCard({ id: 'c_js', suit: 'spades', rank: 11 }),
        createPlayingCard({ id: 'c_10s', suit: 'spades', rank: 10 }),
        createPlayingCard({ id: 'c_9s', suit: 'spades', rank: 9 }),
        createPlayingCard({ id: 'c_ah', suit: 'hearts', rank: 14 }),
        createPlayingCard({ id: 'c_8c', suit: 'clubs', rank: 8 }),
        createPlayingCard({ id: 'c_6d', suit: 'diamonds', rank: 6 }),
      ];

      // 1. Пара тузов (Базово 10 × 2)
      const pairState: RunState = {
        ...baseState,
        deck: customDeck,
        handIds: customDeck.map((c) => c.id),
      };
      const pairRefs = renderRunView(
        root,
        createViewModel(pairState, { selectedCardIds: ['c_as', 'c_ah'] }),
        createMockHandlers(),
      );
      expect(pairRefs.handTypeEl.textContent).toContain('Пара');
      expect(pairRefs.chipsEl.textContent).toBe('10');
      expect(pairRefs.multEl.textContent).toBe('2');

      // 2. Высший ряд (A-K-Q-J-10 одной масти -> ui.hud.royalFlush)
      const royalRefs = renderRunView(
        root,
        createViewModel(pairState, {
          selectedCardIds: ['c_as', 'c_ks', 'c_qs', 'c_js', 'c_10s'],
        }),
        createMockHandlers(),
      );
      expect(royalRefs.handTypeEl.textContent).toContain('Высший ряд');
      expect(royalRefs.chipsEl.textContent).toBe('100');
      expect(royalRefs.multEl.textContent).toBe('8');

      // 3. Реликвия Четыре пальца (j_four_fingers) позволяет собрать Мастный ряд из 4 карт
      const fourFingersState: RunState = {
        ...pairState,
        relics: [createRelicInstance('j_four_fingers', 'r_ff')],
      };
      const ffRefs = renderRunView(
        root,
        createViewModel(fourFingersState, {
          selectedCardIds: ['c_qs', 'c_js', 'c_10s', 'c_9s'],
        }),
        createMockHandlers(),
      );
      expect(ffRefs.handTypeEl.textContent).toContain('Мастный ряд');

      // 4. Реликвия Срез (j_shortcut) позволяет собирать Ряд с пропуском ранга (Q-10-8-6-4)
      const shortcutDeck: PlayingCard[] = [
        ...customDeck,
        createPlayingCard({ id: 'c_4s', suit: 'spades', rank: 4 }),
      ];
      const shortcutState: RunState = {
        ...pairState,
        deck: shortcutDeck,
        handIds: shortcutDeck.map((c) => c.id),
        relics: [createRelicInstance('j_shortcut', 'r_sc')],
      };
      const scRefs = renderRunView(
        root,
        createViewModel(shortcutState, {
          selectedCardIds: ['c_qs', 'c_10s', 'c_8c', 'c_6d', 'c_4s'],
        }),
        createMockHandlers(),
      );
      expect(scRefs.handTypeEl.textContent).toContain('Ряд');

      // 5. Босс Кремень (bl_flint) уполовинивает базовые Силу и Множитель расклада
      const flintBlinds = [...pairState.anteBlinds] as [
        (typeof pairState.anteBlinds)[0],
        (typeof pairState.anteBlinds)[1],
        (typeof pairState.anteBlinds)[2],
      ];
      flintBlinds[2] = {
        ...flintBlinds[2],
        bossId: 'bl_flint',
        status: 'current',
      };
      const flintState: RunState = {
        ...pairState,
        currentBlindIndex: 2,
        anteBlinds: flintBlinds,
        activeBossDisabled: false,
      };
      // Для Высшего ряда: 100 / 2 = 50, 8 / 2 = 4
      const flintRefs = renderRunView(
        root,
        createViewModel(flintState, {
          selectedCardIds: ['c_as', 'c_ks', 'c_qs', 'c_js', 'c_10s'],
        }),
        createMockHandlers(),
      );
      expect(flintRefs.chipsEl.textContent).toBe('50');
      expect(flintRefs.multEl.textContent).toBe('4');
    });
  });

  describe('Пояс 2: Реликвии, Расходники, Знаки и Drag-and-Drop перестановка', () => {
    it('показывает счётчики с учётом negative-издания, активные Знаки и вызывает инспекторы по тапу', () => {
      const base = createPlayingState('INV');
      const r1 = createRelicInstance('j_joker', 'ruid_1');
      const r2 = createRelicInstance('j_greedy_joker', 'ruid_2', 'negative');
      const c1 = createConsumableInstance('c_mercury', 'cuid_1');
      const c2 = createConsumableInstance('c_jupiter', 'cuid_2', 'negative');
      const state: RunState = {
        ...base,
        relics: [r1, r2],
        consumables: [c1, c2],
        pendingTags: ['tag_double', 'tag_d_six'],
      };
      const handlers = createMockHandlers();

      renderRunView(
        root,
        createViewModel(state, { highlightedRelicUid: 'ruid_1' }),
        handlers,
      );

      const inv = root.querySelector('[data-belt="inventory"]') as HTMLElement;
      expect(inv.textContent).toContain('2/6');
      expect(inv.textContent).toContain('2/3');
      expect(inv.querySelector('[data-tag-id="tag_double"]')).not.toBeNull();
      expect(inv.querySelector('[data-tag-id="tag_d_six"]')).not.toBeNull();
      expect(inv.querySelectorAll('[data-empty-slot="relic"]').length).toBe(4);
      expect(inv.querySelectorAll('[data-empty-slot="consumable"]').length).toBe(1);
      expect(inv.querySelectorAll('button button, [role="button"] button').length).toBe(0);

      const relicEl = inv.querySelector('[data-relic-uid="ruid_1"]') as HTMLElement;
      expect(relicEl.classList.contains('card-frame--triggering') || relicEl.dataset.highlighted === 'true').toBe(true);
      relicEl.click();
      expect(handlers.onInspectRelic).toHaveBeenCalledWith('ruid_1', 0);

      const consEl = inv.querySelector('[data-consumable-uid="cuid_2"]') as HTMLElement;
      consEl.click();
      expect(handlers.onInspectConsumable).toHaveBeenCalledWith('cuid_2', 1);

      // При пустом инвентаре рендерятся все 5 рамок Реликвий и 2 рамки Расходников
      renderRunView(root, createViewModel(base), handlers);
      const emptyInv = root.querySelector('[data-belt="inventory"]') as HTMLElement;
      expect(emptyInv.textContent).toContain('0/5');
      expect(emptyInv.textContent).toContain('0/2');
      expect(emptyInv.querySelectorAll('[data-empty-slot="relic"]').length).toBe(5);
      expect(emptyInv.querySelectorAll('[data-empty-slot="consumable"]').length).toBe(2);
    });

    it('поддерживает горизонтальный PointerEvents drag (>10px) для REORDER_RELICS и REORDER_CONSUMABLES без вызова инспектора', () => {
      const base = createPlayingState('DRAG_INV');
      const state: RunState = {
        ...base,
        relics: [
          createRelicInstance('j_joker', 'ruid_a'),
          createRelicInstance('j_lusty_joker', 'ruid_b'),
          createRelicInstance('j_wrathful_joker', 'ruid_c'),
        ],
        consumables: [
          createConsumableInstance('c_mercury', 'cuid_a'),
          createConsumableInstance('c_venus', 'cuid_b'),
        ],
      };
      const handlers = createMockHandlers();

      renderRunView(root, createViewModel(state), handlers);
      const inv = root.querySelector('[data-belt="inventory"]') as HTMLElement;

      const relicA = inv.querySelector('[data-relic-uid="ruid_a"]') as HTMLElement;
      emitPointer(relicA, 'pointerdown', 100);
      emitPointer(window, 'pointermove', 175);
      emitPointer(window, 'pointerup', 175);

      expect(handlers.onInspectRelic).not.toHaveBeenCalled();
      expect(handlers.onCommand).toHaveBeenCalledWith({
        type: 'REORDER_RELICS',
        relicUids: ['ruid_b', 'ruid_a', 'ruid_c'],
      });

      const consA = inv.querySelector('[data-consumable-uid="cuid_a"]') as HTMLElement;
      emitPointer(consA, 'pointerdown', 80);
      emitPointer(window, 'pointermove', 150);
      emitPointer(window, 'pointerup', 150);

      expect(handlers.onInspectConsumable).not.toHaveBeenCalled();
      expect(handlers.onCommand).toHaveBeenCalledWith({
        type: 'REORDER_CONSUMABLES',
        consumableUids: ['cuid_b', 'cuid_a'],
      });
    });
  });

  describe('Пояс 3 и Пояс 4: Все 8 экранов забега', () => {
    it('экран deck_select: разблокированные/заблокированные колоды, ввод сида, старт и продолжение забега', () => {
      const state: RunState = {
        ...createInitialRunState('b_red', 'INIT_SEED'),
        phase: 'deck_select',
      };
      const handlers = createMockHandlers();

      renderRunView(
        root,
        createViewModel(state, {
          unlockedDecks: ['b_red', 'b_blue'],
          selectedDeckId: 'b_red',
          seedInput: 'MY_SEED',
          hasSavedRun: true,
        }),
        handlers,
      );

      const arena = root.querySelector('[data-belt="arena"]') as HTMLElement;
      const blueDeck = arena.querySelector('[data-deck-id="b_blue"]') as HTMLElement;
      const blackDeck = arena.querySelector('[data-deck-id="b_black"]') as HTMLElement;
      expect(blueDeck).not.toBeNull();
      expect(blackDeck).not.toBeNull();

      blueDeck.click();
      expect(handlers.onSelectDeck).toHaveBeenCalledWith('b_blue');

      blackDeck.click();
      expect(handlers.onSelectDeck).not.toHaveBeenCalledWith('b_black');

      const seedLabel = arena.querySelector('label[for="balite-seed-input"]') as HTMLLabelElement;
      expect(seedLabel).not.toBeNull();
      const seedInput = arena.querySelector('input#balite-seed-input') as HTMLInputElement;
      expect(seedInput).not.toBeNull();
      expect(seedInput.name).toBe('seed');
      expect(seedInput.value).toBe('MY_SEED');
      seedInput.value = 'NEW_SEED';
      seedInput.dispatchEvent(new Event('input', { bubbles: true }));
      expect(handlers.onSeedInput).toHaveBeenCalledWith('NEW_SEED');
      expect(arena.querySelectorAll('button button, [role="button"] button').length).toBe(0);

      findButtonByText(arena, 'Случайный')?.click();
      expect(handlers.onRandomSeed).toHaveBeenCalledTimes(1);

      findButtonByText(arena, 'Начать забег')?.click();
      expect(handlers.onStartRun).toHaveBeenCalledTimes(1);

      findButtonByText(arena, 'Продолжить')?.click();
      expect(handlers.onResumeSavedRun).toHaveBeenCalledTimes(1);

      root.querySelector<HTMLButtonElement>('[data-action="back-to-menu"]')?.click();
      expect(handlers.onBackToMainMenu).toHaveBeenCalledTimes(1);

      // Если сохранения нет — кнопка Продолжить не показывается
      renderRunView(root, createViewModel(state, { hasSavedRun: false }), handlers);
      expect(findButtonByText(root, 'Продолжить')).toBeNull();
    });

    it('экран blind_select: 3 Стража, выбор/пропуск, запрет пропуска босса и кнопка Сменить Босса при грамоте v_directors_cut', () => {
      const base = createInitialRunState('b_red', 'BLIND_SEL');
      const startState = advanceRun(base, [
        { type: 'START_RUN', deckId: 'b_red', seed: 'BLIND_SEL' },
      ]);
      const withCharter: RunState = {
        ...startState,
        dollars: 25,
        charters: ['v_directors_cut'],
      };
      const handlers = createMockHandlers();

      renderRunView(root, createViewModel(withCharter), handlers);
      const hud = root.querySelector('[data-belt="hud"]') as HTMLElement;
      const arena = root.querySelector('[data-belt="arena"]') as HTMLElement;
      const hand = root.querySelector('[data-belt="hand"]') as HTMLElement;

      expect(hud.querySelector('.hud-choose-prompt')?.textContent).toContain(
        'Выберите заказ на доске гильдии',
      );
      expect(arena.querySelector('[data-blind-kind="small"]')).not.toBeNull();
      expect(arena.querySelector('[data-blind-kind="big"]')).not.toBeNull();
      expect(arena.querySelector('[data-blind-kind="boss"]')).not.toBeNull();
      expect(arena.querySelector('[data-blind-kind="small"] .blind-card__emblem')).not.toBeNull();
      expect(arena.querySelector('[data-blind-kind="small"] .blind-card__name-pill')).not.toBeNull();
      expect(arena.querySelector('[data-blind-kind="small"] .blind-card__target-box')?.textContent).toContain(
        'Минимум очков',
      );
      expect(arena.querySelector('[data-blind-kind="small"] .blind-card__tag-icon')).not.toBeNull();
      expect(arena.querySelector('[data-blind-kind="boss"] .blind-card__stage-advance')?.textContent).toContain(
        'Повышение ранга',
      );
      expect(arena.querySelector('[data-blind-kind="small"] .blind-card__battle-btn')).not.toBeNull();

      findButtonByText(arena, 'Принять заказ')?.click();
      expect(handlers.onCommand).toHaveBeenCalledWith({ type: 'SELECT_BLIND' });

      findButtonByText(arena, 'Пропустить заказ')?.click();
      expect(handlers.onCommand).toHaveBeenCalledWith({ type: 'SKIP_BLIND' });

      // Стопка карт Колоды в правом нижнем углу стола
      const deckStackBtn = hand.querySelector<HTMLButtonElement>('.deck-stack-btn.hand-actions__deck');
      expect(deckStackBtn).not.toBeNull();
      expect(deckStackBtn?.dataset.deckId).toBe('b_red');
      expect(deckStackBtn?.querySelector('.deck-stack__count')?.textContent?.trim()).toBe('52/52');
      deckStackBtn?.click();
      expect(handlers.onOpenDeckModal).toHaveBeenCalledTimes(1);

      const rerollBtn = findButtonByText(arena, 'Сменить Босса');
      expect(rerollBtn).not.toBeNull();
      expect(rerollBtn?.disabled).toBe(false);
      rerollBtn?.click();
      expect(handlers.onCommand).toHaveBeenCalledWith({ type: 'REROLL_BOSS' });

      const bossEl = arena.querySelector('[data-blind-kind="boss"] [data-boss-id]') as HTMLElement;
      bossEl.click();
      expect(handlers.onInspectBoss).toHaveBeenCalledWith(withCharter.anteBlinds[2].bossId, false);
    });

    it('экран playing: Play Zone (shattered/highlighted), кнопки руки, bl_final_bell защита, isAnimating skip и жесты карты в руке', () => {
      vi.useFakeTimers();
      const base = createPlayingState('PLAY_PHASE');
      const c1 = createPlayingCard({ id: 'hc_1', suit: 'hearts', rank: 14, forcedSelection: false });
      const c2 = createPlayingCard({ id: 'hc_2', suit: 'spades', rank: 13, forcedSelection: true });
      const pc1 = createPlayingCard({ id: 'pc_1', suit: 'diamonds', rank: 12 });
      const pc2 = createPlayingCard({ id: 'pc_2', suit: 'clubs', rank: 11, enhancement: 'glass' });

      const blindsBell = [...base.anteBlinds] as [
        (typeof base.anteBlinds)[0],
        (typeof base.anteBlinds)[1],
        (typeof base.anteBlinds)[2],
      ];
      blindsBell[2] = { ...blindsBell[2], bossId: 'bl_final_bell', status: 'current' };

      const state: RunState = {
        ...base,
        currentBlindIndex: 2,
        anteBlinds: blindsBell,
        activeBossDisabled: false,
        deck: [c1, c2, pc1, pc2],
        handIds: ['hc_1', 'hc_2'],
        drawPileIds: ['pc_1'],
      };
      const handlers = createMockHandlers();

      // Когда принудительная карта hc_2 НЕ выбрана — Сыграть/Сбросить заблокированы
      const refs = renderRunView(
        root,
        createViewModel(state, {
          selectedCardIds: ['hc_1'],
          playedCardIds: ['pc_1', 'pc_2'],
          shatteredCardIds: ['pc_2'],
          highlightedCardId: 'pc_1',
          highlightedHandCardId: 'hc_1',
        }),
        handlers,
      );

      const playZoneCard1 = refs.arenaEl.querySelector('[data-card-id="pc_1"]') as HTMLElement;
      const playZoneCard2 = refs.arenaEl.querySelector('[data-card-id="pc_2"]') as HTMLElement;
      expect(playZoneCard1.dataset.highlighted).toBe('true');
      expect(playZoneCard2.dataset.shattered).toBe('true');

      const handZone = root.querySelector('[data-belt="hand"]') as HTMLElement;
      const handCard1 = handZone.querySelector('[data-card-id="hc_1"]') as HTMLElement;
      expect(handCard1.dataset.highlighted).toBe('true');
      expect(root.querySelectorAll('button button, [role="button"] button').length).toBe(0);
      expect(handZone.querySelectorAll('.hand-card-slot button').length).toBe(0);
      expect(refs.arenaEl.querySelectorAll('.play-zone__card button').length).toBe(0);

      expect(findButtonByText(handZone, 'Сыграть')?.disabled).toBe(true);
      expect(findButtonByText(handZone, 'Сбросить')?.disabled).toBe(true);

      // Когда выбрана hc_2 — Сыграть/Сбросить активны
      renderRunView(
        root,
        createViewModel(state, { selectedCardIds: ['hc_1', 'hc_2'] }),
        handlers,
      );
      const handZoneReady = root.querySelector('[data-belt="hand"]') as HTMLElement;

      const playBtn = findButtonByText(handZoneReady, 'Сыграть')!;
      expect(playBtn.disabled).toBe(false);
      playBtn.click();
      expect(handlers.onCommand).toHaveBeenCalledWith({
        type: 'PLAY_HAND',
        cardIds: ['hc_1', 'hc_2'],
      });

      findButtonByText(handZoneReady, 'Сбросить')?.click();
      expect(handlers.onCommand).toHaveBeenCalledWith({
        type: 'DISCARD_CARDS',
        cardIds: ['hc_1', 'hc_2'],
      });

      findButtonByText(handZoneReady, 'По рангу')?.click();
      expect(handlers.onCommand).toHaveBeenCalledWith({ type: 'SORT_HAND', by: 'rank' });

      findButtonByText(handZoneReady, 'По масти')?.click();
      expect(handlers.onCommand).toHaveBeenCalledWith({ type: 'SORT_HAND', by: 'suit' });

      const deckBtn = handZoneReady.querySelector<HTMLButtonElement>('[data-action="open-deck"]');
      expect(deckBtn).not.toBeNull();
      expect(deckBtn?.getAttribute('aria-label')).toBe('Колода (1/4)');
      expect(deckBtn?.querySelector('.deck-stack__count')?.textContent).toBe('1/4');
      deckBtn?.click();
      expect(handlers.onOpenDeckModal).toHaveBeenCalledTimes(1);

      // Тап по карте в руке -> onToggleCard
      const currentHandCard1 = handZoneReady.querySelector('[data-card-id="hc_1"]') as HTMLElement;
      currentHandCard1.click();
      expect(handlers.onToggleCard).toHaveBeenCalledWith('hc_1');

      // Удержание > 280мс -> onInspectPlayingCard
      emitPointer(currentHandCard1, 'pointerdown', 100);
      vi.advanceTimersByTime(300);
      emitPointer(window, 'pointerup', 100);
      expect(handlers.onInspectPlayingCard).toHaveBeenCalledWith(c1);

      // Перетаскивание в руке > 10px -> REORDER_HAND
      const currentHandCard2 = handZoneReady.querySelector('[data-card-id="hc_2"]') as HTMLElement;
      emitPointer(currentHandCard2, 'pointerdown', 180);
      emitPointer(window, 'pointermove', 110);
      emitPointer(window, 'pointerup', 110);
      expect(handlers.onCommand).toHaveBeenCalledWith({
        type: 'REORDER_HAND',
        cardIds: ['hc_2', 'hc_1'],
      });

      // При активном bl_psychic и < 5 выбранных картах кнопка «Сыграть» остаётся активной (во избежание софтлока)
      const psychicBlinds = [...base.anteBlinds] as [
        (typeof base.anteBlinds)[0],
        (typeof base.anteBlinds)[1],
        (typeof base.anteBlinds)[2],
      ];
      psychicBlinds[2] = { ...psychicBlinds[2], bossId: 'bl_psychic', status: 'current' };
      const psychicState: RunState = {
        ...state,
        anteBlinds: psychicBlinds,
        activeBossDisabled: false,
      };
      renderRunView(
        root,
        createViewModel(psychicState, { selectedCardIds: ['hc_1', 'hc_2'] }),
        handlers,
      );
      const psychicPlayBtn = findButtonByText(
        root.querySelector('[data-belt="hand"]') as HTMLElement,
        'Сыграть',
      )!;
      expect(psychicPlayBtn.disabled).toBe(false);
      psychicPlayBtn.click();
      expect(handlers.onCommand).toHaveBeenLastCalledWith({
        type: 'PLAY_HAND',
        cardIds: ['hc_1', 'hc_2'],
      });

      // Во время isAnimating тап по арене вызывает onSkipAnimation
      const animRefs = renderRunView(
        root,
        createViewModel(state, { isAnimating: true }),
        handlers,
      );
      animRefs.arenaEl.click();
      expect(handlers.onSkipAnimation).toHaveBeenCalledTimes(1);
    });

    it('режим выбора целей consumableTargetMode в Поясе 4: баннер, валидация Подтвердить и Отмена', () => {
      const base = createPlayingState('TARGET_MODE');
      const emp = createConsumableInstance('c_empress', 'c_emp');
      const state: RunState = {
        ...base,
        consumables: [emp],
      };
      const targetIds = state.handIds.slice(0, 2);
      const handlers = createMockHandlers();

      // 0 выбрано (min: 1, max: 2) -> Подтвердить disabled
      renderRunView(
        root,
        createViewModel(state, {
          selectedCardIds: [],
          consumableTargetMode: {
            consumableUid: 'c_emp',
            consumableId: 'c_empress',
            min: 1,
            max: 2,
            mode: 'upTo',
          },
        }),
        handlers,
      );
      const handZone = root.querySelector('[data-belt="hand"]') as HTMLElement;
      expect(handZone.textContent).toContain('Выберите до 2 карт');
      expect(findButtonByText(handZone, 'Подтвердить')?.disabled).toBe(true);

      // 2 выбрано -> Подтвердить и Отмена работают
      renderRunView(
        root,
        createViewModel(state, {
          selectedCardIds: targetIds,
          consumableTargetMode: {
            consumableUid: 'c_emp',
            consumableId: 'c_empress',
            min: 1,
            max: 2,
            mode: 'upTo',
          },
        }),
        handlers,
      );
      const handZoneReady = root.querySelector('[data-belt="hand"]') as HTMLElement;
      const confirmBtn = findButtonByText(handZoneReady, 'Подтвердить')!;
      expect(confirmBtn.disabled).toBe(false);
      confirmBtn.click();
      expect(handlers.onConfirmConsumableTargets).toHaveBeenCalledTimes(1);

      findButtonByText(handZoneReady, 'Отмена')?.click();
      expect(handlers.onCancelConsumableTargets).toHaveBeenCalledTimes(1);
    });

    it('экран cashout: показывает строки детализации и кнопку CLAIM_CASHOUT', () => {
      const base = createPlayingState('CASHOUT');
      const state: RunState = {
        ...base,
        phase: 'cashout',
        handsLeft: 2,
        cashout: {
          blindReward: 4,
          unusedHandsBonus: 2,
          interestBonus: 3,
          relicBonus: 4,
          tagBonus: 5,
          totalReward: 18,
        },
      };
      const handlers = createMockHandlers();
      renderRunView(root, createViewModel(state), handlers);

      const arena = root.querySelector('[data-belt="arena"]') as HTMLElement;
      expect(arena.querySelector('.cashout-container')).not.toBeNull();
      expect(arena.querySelectorAll('.cashout-row__label')).toHaveLength(6);
      expect(arena.querySelectorAll('.cashout-row__amount')).toHaveLength(6);
      expect(arena.querySelector('.claim-cashout-btn')).not.toBeNull();
      expect(arena.textContent).toContain('Награда за заказ');
      expect(arena.textContent).toContain('Оставшиеся руки (2)');
      expect(arena.textContent).toContain('Проценты');
      expect(arena.textContent).toContain('Бонус Навыков');
      expect(arena.textContent).toContain('Бонус Талонов');
      expect(arena.textContent).toContain('18 з.');

      findButtonByText(arena, 'Забрать 18 з.')?.click();
      expect(handlers.onCommand).toHaveBeenCalledWith({ type: 'CLAIM_CASHOUT' });
    });

    it('экран shop: товары, грамота, бустеры, Обновить и Далее', () => {
      const base = createPlayingState('SHOP');
      const state: RunState = {
        ...base,
        phase: 'shop',
        dollars: 30,
        shop: {
          offers: [
            {
              uid: 'off_1',
              kind: 'relic',
              relic: createRelicInstance('j_joker', 'shop_r1'),
              cost: 4,
              baseCost: 4,
              sold: false,
            },
            {
              uid: 'off_2',
              kind: 'card',
              card: createPlayingCard({ id: 'shop_c1', suit: 'hearts', rank: 13 }),
              cost: 3,
              baseCost: 3,
              sold: true,
            },
          ],
          voucher: {
            uid: 'v_1',
            charterId: 'v_clearance_sale',
            cost: 10,
            baseCost: 10,
            sold: false,
          },
          packs: [
            {
              uid: 'pack_1',
              packId: 'arcana_normal',
              type: 'arcana',
              size: 'normal',
              cost: 4,
              baseCost: 4,
              totalCards: 3,
              chooseCount: 1,
              purchased: false,
            },
            {
              uid: 'pack_free',
              packId: 'celestial_normal',
              type: 'celestial',
              size: 'normal',
              cost: 0,
              baseCost: 4,
              totalCards: 3,
              chooseCount: 1,
              purchased: false,
            },
          ],
          rerollCost: 5,
          tempRerollCost: 2,
          rerollsUsedThisShop: 0,
        },
      };
      const handlers = createMockHandlers();
      renderRunView(root, createViewModel(state), handlers);

      const arena = root.querySelector('[data-belt="arena"]') as HTMLElement;
      const hud = root.querySelector('[data-belt="hud"]') as HTMLElement;
      expect(hud.querySelector('.hud-shop-sign')?.textContent).toContain('ГИЛЬДИЯ');
      expect(arena.querySelectorAll('button button, [role="button"] button').length).toBe(0);
      expect(arena.querySelectorAll('.card-frame__price-badge').length).toBe(0);

      const offer1 = arena.querySelector('[data-offer-uid="off_1"]') as HTMLElement;
      expect(offer1.querySelectorAll('button').length).toBe(0);
      expect(offer1.textContent?.match(/4 з\./g)?.length).toBe(1);
      offer1.click();
      expect(handlers.onInspectOffer).toHaveBeenCalledWith(state.shop!.offers[0]);

      const offer2 = arena.querySelector('[data-offer-uid="off_2"]') as HTMLElement;
      expect(offer2.textContent).toContain('Продано');

      const voucherEl = arena.querySelector('[data-charter-id="v_clearance_sale"]') as HTMLElement;
      expect(voucherEl.textContent?.match(/10 з\./g)?.length).toBe(1);
      voucherEl.click();
      expect(handlers.onInspectCharter).toHaveBeenCalledWith('v_clearance_sale', 10);

      const packEl = arena.querySelector('[data-pack-uid="pack_1"]') as HTMLElement;
      expect(packEl.textContent?.match(/4 з\./g)?.length).toBe(1);
      packEl.click();
      expect(handlers.onInspectPack).toHaveBeenCalledWith(state.shop!.packs[0]);

      const freePackEl = arena.querySelector('[data-pack-uid="pack_free"]') as HTMLElement;
      expect(freePackEl.textContent?.match(/Бесплатно/g)?.length).toBe(1);
      expect(freePackEl.textContent).not.toContain('0 з.');

      findButtonByText(arena, 'Обновить (2 з.)')?.click();
      expect(handlers.onCommand).toHaveBeenCalledWith({ type: 'REROLL_SHOP' });

      findButtonByText(arena, 'Далее')?.click();
      expect(handlers.onCommand).toHaveBeenCalledWith({ type: 'NEXT_ROUND' });
    });

    it('экран booster: выбор карты/расходника с целями в drawnHandCardIds и Пропустить набор', () => {
      const base = createPlayingState('BOOSTER');
      const cardA = createPlayingCard({ id: 'bh_1', suit: 'hearts', rank: 7 });
      const cardB = createPlayingCard({ id: 'bh_2', suit: 'spades', rank: 9 });
      const choiceCard = createPlayingCard({ id: 'bc_1', suit: 'diamonds', rank: 14 });
      const state: RunState = {
        ...base,
        phase: 'booster',
        deck: [...base.deck, cardA, cardB, choiceCard],
        booster: {
          packId: 'arcana_normal',
          packType: 'arcana',
          packSize: 'normal',
          remainingPicks: 1,
          drawnHandCardIds: ['bh_1', 'bh_2'],
          fromTag: false,
          choices: [
            {
              uid: 'ch_scroll',
              kind: 'consumable',
              consumable: createConsumableInstance('c_lovers', 'b_lovers'),
              picked: false,
            },
            {
              uid: 'ch_card',
              kind: 'card',
              card: choiceCard,
              picked: false,
            },
          ],
        },
      };
      const handlers = createMockHandlers();

      // Без выбранных карт в руке c_lovers нельзя применить
      renderRunView(root, createViewModel(state, { selectedCardIds: [] }), handlers);
      const arena = root.querySelector('[data-belt="arena"]') as HTMLElement;
      const scrollSlot = arena.querySelector('[data-choice-uid="ch_scroll"]') as HTMLElement;
      expect(findButtonByText(scrollSlot, 'Взять')?.disabled).toBe(true);

      // В Поясе 4 показана временная рука набора
      const handZone = root.querySelector('[data-belt="hand"]') as HTMLElement;
      expect(handZone.querySelector('[data-card-id="bh_1"]')).not.toBeNull();

      // С выбранной картой bh_1 c_lovers можно применить
      renderRunView(root, createViewModel(state, { selectedCardIds: ['bh_1'] }), handlers);
      const arenaReady = root.querySelector('[data-belt="arena"]') as HTMLElement;
      const scrollBtnActive = findButtonByText(
        arenaReady.querySelector('[data-choice-uid="ch_scroll"]') as HTMLElement,
        'Взять',
      )!;
      expect(scrollBtnActive.disabled).toBe(false);
      scrollBtnActive.click();
      expect(handlers.onCommand).toHaveBeenCalledWith({
        type: 'PICK_BOOSTER_ITEM',
        choiceUid: 'ch_scroll',
        targetCardIds: ['bh_1'],
      });

      findButtonByText(
        arenaReady.querySelector('[data-choice-uid="ch_card"]') as HTMLElement,
        'Взять',
      )?.click();
      expect(handlers.onCommand).toHaveBeenCalledWith({
        type: 'PICK_BOOSTER_ITEM',
        choiceUid: 'ch_card',
      });

      findButtonByText(arenaReady, 'Закрыть сундук')?.click();
      expect(handlers.onCommand).toHaveBeenCalledWith({ type: 'SKIP_BOOSTER' });
    });

    it('экраны victory и game_over: статистика, копирование кода забега и кнопки продолжения/выхода', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      const base = createPlayingState('RUN_END');
      const victoryState: RunState = {
        ...base,
        phase: 'victory',
        relics: [createRelicInstance('j_joker', 'r1')],
        stats: {
          bestHandScore: 12345,
          bestHandType: 'Straight Flush',
          handsPlayed: 14,
          cardsPlayed: 52,
          discardsUsed: 5,
          cardsDiscarded: 18,
          cardsPurchased: 7,
          rerollsCount: 3,
          cardsDestroyed: 2,
          dollarsSpent: 64,
        },
      };
      const baseMeta = createInitialMetaSave(1_000, { lang: 'ru' });
      const meta = {
        ...baseMeta,
        discoveredRelics: ['j_joker' as const, 'j_blueprint' as const],
        stats: {
          ...baseMeta.stats,
          bestHandScore: 5000,
          highestAnte: 4,
          highestRound: 10,
          maxDollars: 10,
        },
        activeRunTracker: {
          baselineBestHandScore: 5000,
          baselineHighestAnte: 4,
          baselineHighestRound: 10,
          newDiscoveries: 2,
        },
      };
      const handlers = createMockHandlers();
      renderRunView(root, createViewModel(victoryState, { meta }), handlers);

      const arena = root.querySelector('[data-belt="arena"]') as HTMLElement;
      expect(arena.querySelector('.run-end-card__title')).not.toBeNull();
      expect(arena.querySelector('.run-end-card__subtitle')).not.toBeNull();
      expect(arena.textContent).toContain('Победа');
      expect(arena.textContent).toContain('12345');
      expect(arena.textContent).toContain('52');
      expect(arena.textContent).toContain('18');
      expect(arena.textContent).toContain('7');
      expect(arena.textContent).toContain('3');
      expect(arena.textContent).toContain('Новый рекорд!');
      expect(arena.querySelector('.run-end-victim-box .blind-card__emblem')).not.toBeNull();

      const copySeedBtn = arena.querySelector<HTMLButtonElement>('[data-action="copy-seed"]');
      expect(copySeedBtn).not.toBeNull();
      copySeedBtn!.click();
      expect(writeText).toHaveBeenCalledWith('RUN_END');

      findButtonByText(arena, 'Бесконечный режим')?.click();
      expect(handlers.onCommand).toHaveBeenCalledWith({ type: 'CONTINUE_ENDLESS' });

      findButtonByText(arena, 'Новый забег')?.click();
      expect(handlers.onReturnToDeckSelect).toHaveBeenCalledTimes(1);

      findButtonByText(arena, 'Главное меню')?.click();
      expect(handlers.onBackToMainMenu).toHaveBeenCalledTimes(1);

      const defeatState: RunState = { ...victoryState, phase: 'game_over' };
      renderRunView(root, createViewModel(defeatState, { meta }), handlers);
      const arenaDefeat = root.querySelector('[data-belt="arena"]') as HTMLElement;
      expect(arenaDefeat.textContent).toContain('Заказ провален');
      expect(arenaDefeat.querySelector('.run-end-victim-box .blind-card__emblem')).not.toBeNull();

      findButtonByText(arenaDefeat, 'Новый забег')?.click();
      expect(handlers.onStartRun).toHaveBeenCalledTimes(1);

      findButtonByText(arenaDefeat, 'Главное меню')?.click();
      expect(handlers.onBackToMainMenu).toHaveBeenCalledTimes(2);
    });

    it('привязывает tooltip-данные к картам, реликвиям и скрывает ранг/масть у карт рубашкой вверх', () => {
      const base = createPlayingState('TOOLTIP_TEST');
      const openId = base.handIds[0]!;
      const hiddenId = base.handIds[1]!;
      const state: RunState = {
        ...base,
        relics: [createRelicInstance('j_joker', 'r1')],
        deck: base.deck.map((card): PlayingCard => {
          if (card.id === openId) {
            return { ...card, rank: 13, suit: 'hearts', facing: 'front' };
          }
          if (card.id === hiddenId) {
            return {
              ...card,
              rank: 14,
              suit: 'spades',
              enhancement: 'bonus',
              edition: 'foil',
              seal: 'gold',
              facing: 'back',
            };
          }
          return card;
        }),
      };

      renderRunView(root, createViewModel(state), createMockHandlers());

      const handCards = root.querySelectorAll<HTMLElement>('.hand-card-slot');
      expect(handCards.length).toBeGreaterThanOrEqual(2);

      const openEl = Array.from(handCards).find((el) => el.dataset.cardId === openId)!;
      const hiddenEl = Array.from(handCards).find((el) => el.dataset.cardId === hiddenId)!;

      const openTooltip = getTooltipData(openEl);
      expect(openTooltip).not.toBeNull();
      expect(openTooltip!.title).toContain('Червы');

      expect(hiddenEl.dataset.tooltipFacing).toBe('back');
      const hiddenTooltip = getTooltipData(hiddenEl);
      expect(hiddenTooltip).not.toBeNull();
      expect(hiddenTooltip!.hidden).toBe(true);
      expect(hiddenTooltip!.hiddenTitle).toBe('Скрытая карта');
      expect(hiddenTooltip!.hiddenDescription).toContain('Скрыто способностью Босса');
      expect(hiddenTooltip!.title).toBe('');
      expect(hiddenTooltip!.hiddenDescription ?? '').not.toContain('Пики');
      expect(hiddenTooltip!.description ?? '').not.toContain('Тисн');

      const relicEl = root.querySelector<HTMLElement>('.inventory-slot[data-relic-uid]');
      expect(relicEl).not.toBeNull();
      expect(getTooltipData(relicEl!)).not.toBeNull();
    });
  });

  describe('Модерация 6+/12+, отсутствие hover, внешних ссылок и размер тап-зон >= 44px', () => {
    it('не содержит запрещённых слов, внешних ссылок и нераскрытых плейсхолдеров на ru и en во всех фазах', () => {
      const base = createPlayingState('MODERATION');
      const richState: RunState = {
        ...base,
        relics: [createRelicInstance('j_joker', 'r1')],
        consumables: [createConsumableInstance('c_mercury', 'c1')],
        pendingTags: ['tag_investment'],
        cashout: {
          blindReward: 5,
          unusedHandsBonus: 1,
          interestBonus: 2,
          relicBonus: 0,
          tagBonus: 0,
          totalReward: 8,
        },
        shop: {
          offers: [
            {
              uid: 'o1',
              kind: 'relic',
              relic: createRelicInstance('j_blueprint', 'r2'),
              cost: 8,
              baseCost: 8,
              sold: false,
            },
          ],
          voucher: {
            uid: 'v1',
            charterId: 'v_grabber',
            cost: 10,
            baseCost: 10,
            sold: false,
          },
          packs: [
            {
              uid: 'p1',
              packId: 'celestial_normal',
              type: 'celestial',
              size: 'normal',
              cost: 4,
              baseCost: 4,
              totalCards: 3,
              chooseCount: 1,
              purchased: false,
            },
          ],
          rerollCost: 5,
          tempRerollCost: null,
          rerollsUsedThisShop: 0,
        },
        booster: {
          packId: 'celestial_normal',
          packType: 'celestial',
          packSize: 'normal',
          remainingPicks: 1,
          drawnHandCardIds: [],
          fromTag: false,
          choices: [
            {
              uid: 'ch1',
              kind: 'consumable',
              consumable: createConsumableInstance('c_jupiter', 'c2'),
              picked: false,
            },
          ],
        },
      };

      const phases: RunState['phase'][] = [
        'deck_select',
        'blind_select',
        'playing',
        'cashout',
        'shop',
        'booster',
        'victory',
        'game_over',
      ];

      for (const lang of ['ru', 'en'] as const) {
        const translator = createTranslator(lang);
        const patterns = lang === 'ru' ? FORBIDDEN_RU_PATTERNS : FORBIDDEN_EN_PATTERNS;

        for (const phase of phases) {
          const state: RunState = { ...richState, phase };
          renderRunView(
            root,
            createViewModel(state, {
              translator,
              selectedCardIds: phase === 'playing' ? state.handIds.slice(0, 2) : [],
            }),
            createMockHandlers(),
          );

          const html = root.innerHTML;
          const visibleText = root.textContent ?? '';

          expect(root.querySelectorAll('button button, [role="button"] button').length).toBe(0);
          expect(html).not.toMatch(/<a\b|href=|https?:\/\//i);
          expect(visibleText).not.toMatch(/\{[a-zA-Z0-9_]+\}/);

          const shell = root.querySelector('.run-shell') as HTMLElement;
          const expectedHasHand = phase === 'playing';
          expect(shell.dataset.hasHand).toBe(expectedHasHand ? 'true' : 'false');

          for (const pattern of patterns) {
            expect(visibleText, `Найдено запрещённое слово (${lang}, ${phase}): ${pattern}`).not.toMatch(
              pattern,
            );
          }
        }
      }

      expect(BOSS_DEFINITIONS.bl_hook.reward).toBeGreaterThan(0);
    });

    it('screens.css и style.css допускают :hover только под @media (hover: hover) and (pointer: fine), сжимают Пояс 4 без руки и гарантируют тап-зоны >= 44px', async () => {
      const fsModule = 'node:fs';
      const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as {
        readFileSync: (file: string, encoding: 'utf8') => string;
      };
      const stripFineHoverMedia = (cssText: string): string => {
        const marker = '@media (hover: hover) and (pointer: fine)';
        let result = cssText;
        let idx = result.indexOf(marker);
        while (idx !== -1) {
          const openBrace = result.indexOf('{', idx);
          if (openBrace === -1) break;
          let depth = 0;
          let end = openBrace;
          for (let i = openBrace; i < result.length; i += 1) {
            if (result[i] === '{') depth += 1;
            else if (result[i] === '}') {
              depth -= 1;
              if (depth === 0) {
                end = i + 1;
                break;
              }
            }
          }
          result = result.slice(0, idx) + result.slice(end);
          idx = result.indexOf(marker);
        }
        return result;
      };
      const screensCss = readFileSync('src/ui/screens.css', 'utf8');
      const styleCss = readFileSync('src/style.css', 'utf8');
      expect(screensCss.length).toBeGreaterThan(100);
      expect(screensCss).toContain('18fr 18fr 32fr 32fr');
      expect(screensCss).toContain('auto auto minmax(0, 1fr) auto');
      expect(screensCss).toContain('@media (min-width: 960px) and (orientation: landscape)');
      expect(screensCss).toContain('@media (hover: hover) and (pointer: fine)');
      expect(screensCss).toContain('brightness(0.86)');
      expect(screensCss).toContain('.deck-stack-btn');
      expect(styleCss).toContain('@media (min-width: 960px) and (orientation: landscape)');
      expect(stripFineHoverMedia(screensCss)).not.toMatch(/:hover\b/);
      expect(screensCss).toMatch(/min-height:\s*(?:44|4[5-9]|[5-9]\d)px/);
      expect(screensCss).toMatch(/min-width:\s*(?:44|4[5-9]|[5-9]\d)px/);
      expect(stripFineHoverMedia(styleCss)).not.toMatch(/:hover\b/);
      expect(styleCss).toMatch(/\.stage-portrait[\s\S]*rgba\(\s*16\s*,\s*40\s*,\s*34\s*,\s*0\.\d+\s*\)/);
    });

    it('присваивает стабильные DOM-ключи слотам карт руки, Play Zone, стопке колоды, реликвиям и расходникам', () => {
      const root = document.createElement('div');
      let state = createInitialRunState('b_red', 'STORY21KEYS');
      const selectSmall = dispatch(state, { type: 'SELECT_BLIND' });
      state = selectSmall.nextState;
      const relic = createRelicInstance('j_joker', 'relic_story21');
      const consumable = createConsumableInstance('c_pluto', 'cons_story21');
      state = {
        ...state,
        relics: [relic],
        consumables: [consumable],
      };

      const playedCardIds = state.handIds.slice(0, 2);
      const handCardIds = state.handIds.slice(2);
      const viewState: RunState = {
        ...state,
        handIds: handCardIds,
      };

      renderRunView(
        root,
        createViewModel(viewState, {
          playedCardIds,
          isAnimating: true,
        }),
        createMockHandlers(),
      );

      for (const cardId of handCardIds) {
        const slot = root.querySelector(`.hand-card-slot[data-zone="hand"][data-card-id="${cardId}"]`);
        expect(slot, `Слот карты руки ${cardId} должен иметь data-zone="hand"`).not.toBeNull();
      }
      for (const cardId of playedCardIds) {
        const slot = root.querySelector(`.play-zone__card[data-zone="play"][data-card-id="${cardId}"]`);
        expect(slot, `Слот сыгранной карты ${cardId} должен иметь data-zone="play"`).not.toBeNull();
      }

      const deckBtn = root.querySelector('.deck-stack-btn[data-deck-stack="true"]');
      expect(deckBtn).not.toBeNull();

      const relicSlot = root.querySelector(`[data-zone="relic"][data-relic-uid="${relic.uid}"]`);
      expect(relicSlot).not.toBeNull();

      const consumableSlot = root.querySelector(`[data-zone="consumable"][data-consumable-uid="${consumable.uid}"]`);
      expect(consumableSlot).not.toBeNull();
    });

    it('возвращает formulaEl, chipsPillEl, multPillEl и значения предпросмотра в ScreenRefs для scoreFlame', () => {
      const root = document.createElement('div');
      const state = createPlayingState('FLAME_REFS');
      const card = state.handIds[0]!;

      const emptyRefs = renderRunView(root, createViewModel(state), createMockHandlers());
      expect(emptyRefs.formulaEl).toBeInstanceOf(HTMLElement);
      expect(emptyRefs.chipsPillEl).toBeInstanceOf(HTMLElement);
      expect(emptyRefs.multPillEl).toBeInstanceOf(HTMLElement);
      expect(emptyRefs.previewChips).toBe(0);
      expect(emptyRefs.previewMult).toBe(0);
      expect(emptyRefs.previewTargetScore).toBe(state.targetScore);

      const selectedRefs = renderRunView(
        root,
        createViewModel(state, { selectedCardIds: [card] }),
        createMockHandlers(),
      );
      expect(selectedRefs.previewChips).toBeGreaterThan(0);
      expect(selectedRefs.previewMult).toBeGreaterThan(0);
    });

    it('возвращает cashout в ScreenRefs с строками детализации, итогом и кнопкой CLAIM_CASHOUT', () => {
      const root = document.createElement('div');
      const base = createPlayingState('CASHOUT_REFS');
      const state: RunState = {
        ...base,
        phase: 'cashout',
        handsLeft: 2,
        cashout: {
          blindReward: 4,
          unusedHandsBonus: 2,
          interestBonus: 3,
          relicBonus: 0,
          tagBonus: 1,
          totalReward: 10,
        },
      };

      const refs = renderRunView(root, createViewModel(state), createMockHandlers());
      expect(refs.cashout).toBeDefined();
      expect(refs.cashout?.totalReward).toBe(10);
      expect(refs.cashout?.rows).toHaveLength(6);
      expect(refs.cashout?.rows[0]?.amount).toBe(4);
      expect(refs.cashout?.rows[5]?.isTotal).toBe(true);
      expect(refs.cashout?.rows[5]?.amount).toBe(10);
      expect(refs.cashout?.claimBtnEl).toBeInstanceOf(HTMLButtonElement);
    });

    it('отображает кнопку DEV в HUD строго только при vm.isDebug=true', () => {
      const root = document.createElement('div');
      const state = createPlayingState('HUD_DEV_BTN');
      const onOpenDebugPanel = vi.fn();

      renderRunView(root, createViewModel(state, { isDebug: false }), {
        ...createMockHandlers(),
        onOpenDebugPanel,
      });
      expect(root.querySelector('[data-action="open-debug"]')).toBeNull();

      renderRunView(root, createViewModel(state, { isDebug: true }), {
        ...createMockHandlers(),
        onOpenDebugPanel,
      });
      const devBtn = root.querySelector<HTMLButtonElement>('[data-action="open-debug"]');
      expect(devBtn).not.toBeNull();
      devBtn?.click();
      expect(onOpenDebugPanel).toHaveBeenCalledTimes(1);
    });

    it('показывает подсказку «Выберите до 5 карт» строго в фазе playing и задаёт min-height у .hud-hand-row', async () => {
      const root = document.createElement('div');
      const base = createPlayingState('PREVIEW_HINT_PHASES');

      // В фазе playing без выбранных карт подсказка присутствует
      const playingRefs = renderRunView(root, createViewModel(base), createMockHandlers());
      expect(playingRefs.handTypeEl.textContent).toBe('Выберите до 5 карт');

      // В остальных фазах (без выбранной/разыгрываемой руки) подсказка отсутствует
      const nonPlayingPhases: ReadonlyArray<RunState['phase']> = [
        'blind_select',
        'shop',
        'cashout',
        'booster',
        'victory',
        'game_over',
      ];
      for (const phase of nonPlayingPhases) {
        const phaseState: RunState =
          phase === 'cashout'
            ? {
                ...base,
                phase,
                cashout: {
                  blindReward: 4,
                  unusedHandsBonus: 1,
                  interestBonus: 0,
                  relicBonus: 0,
                  tagBonus: 0,
                  totalReward: 5,
                },
              }
            : { ...base, phase };
        const refs = renderRunView(root, createViewModel(phaseState), createMockHandlers());
        expect(refs.handTypeEl.textContent, `В фазе ${phase} не должно быть подсказки`).toBe('');
        expect(root.querySelector('[data-belt="hud"]')?.textContent ?? '').not.toContain(
          'Выберите до 5 карт',
        );
      }

      // В screens.css у .hud-hand-row задан min-height, чтобы левый HUD не скакал по высоте
      const fsModule = 'node:fs';
      const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as {
        readFileSync: (file: string, encoding: 'utf8') => string;
      };
      const screensCss = readFileSync('src/ui/screens.css', 'utf8');
      expect(screensCss).toMatch(/\.hud-hand-row\s*\{[^}]*min-height\s*:/);
    });

    it('подсвечивает активный режим сортировки (is-active и aria-pressed) по state.handSortMode ?? rank', () => {
      const root = document.createElement('div');
      const base = createPlayingState('SORT_ACTIVE_MODE');

      // 1. По умолчанию (или при undefined / 'rank') активна кнопка «По рангу»
      const defaultState: RunState = { ...base, handSortMode: undefined };
      renderRunView(root, createViewModel(defaultState), createMockHandlers());
      const rankDefaultBtn = root.querySelector<HTMLButtonElement>('.hand-actions__sort-rank');
      const suitDefaultBtn = root.querySelector<HTMLButtonElement>('.hand-actions__sort-suit');
      expect(rankDefaultBtn?.classList.contains('is-active')).toBe(true);
      expect(rankDefaultBtn?.getAttribute('aria-pressed')).toBe('true');
      expect(suitDefaultBtn?.classList.contains('is-active')).toBe(false);
      expect(suitDefaultBtn?.getAttribute('aria-pressed')).toBe('false');

      // 2. При handSortMode === 'suit' активна кнопка «По масти»
      const suitState: RunState = { ...base, handSortMode: 'suit' };
      renderRunView(root, createViewModel(suitState), createMockHandlers());
      const rankSuitModeBtn = root.querySelector<HTMLButtonElement>('.hand-actions__sort-rank');
      const suitSuitModeBtn = root.querySelector<HTMLButtonElement>('.hand-actions__sort-suit');
      expect(rankSuitModeBtn?.classList.contains('is-active')).toBe(false);
      expect(rankSuitModeBtn?.getAttribute('aria-pressed')).toBe('false');
      expect(suitSuitModeBtn?.classList.contains('is-active')).toBe(true);
      expect(suitSuitModeBtn?.getAttribute('aria-pressed')).toBe('true');
    });

    it('корректно формирует пути к спрайтам жетонов для всех 10 боссов и 8 этапов мобов', () => {
      const bossIds = [
        'bl_hook',
        'bl_wall',
        'bl_psychic',
        'bl_flint',
        'bl_water',
        'bl_pillar',
        'bl_manacle',
        'bl_club',
        'bl_final_vessel',
        'bl_final_bell',
      ];
      for (const bossId of bossIds) {
        expect(getBlindSpriteUrl('boss', bossId)).toBe(`./sprites/blinds/${bossId}.webp`);
      }

      for (let ante = 1; ante <= 8; ante++) {
        expect(getBlindSpriteUrl('small', null, ante)).toBe(`./sprites/blinds/ante_${ante}_small.webp`);
        expect(getBlindSpriteUrl('big', null, ante)).toBe(`./sprites/blinds/ante_${ante}_big.webp`);
      }
    });

    it('screens.css содержит дизайн-токены средневековой таверны (мореный дуб, латунь, пергамент)', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const cssPath = path.resolve(__dirname, '../../src/ui/screens.css');
      const css = fs.readFileSync(cssPath, 'utf-8');

      // Проверяем наличие токенов дубовой палитры в :root
      expect(css).toContain('--screen-bg-top: #2a160c');
      expect(css).toContain('--screen-bg-bottom: #120905');
      expect(css).toContain('--screen-panel: rgba(26, 15, 9, 0.94)');
      expect(css).toContain('--screen-brass: #b8860b');
      expect(css).toContain('--parchment-card-bg:');

      // Устаревшие кислотно-зеленые токены сукна не должны быть в :root
      expect(css).not.toContain('--screen-bg-top: #173429');
    });

    it('screens.css стилизует доску заказов гильдии под пергамент и задаёт крупные жетоны мобов', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const cssPath = path.resolve(__dirname, '../../src/ui/screens.css');
      const css = fs.readFileSync(cssPath, 'utf-8');

      // Пергаментные карточки заказов гильдии
      expect(css).toContain('var(--parchment-card-bg)');
      // Крупные жетоны на мобильных и десктопе
      expect(css).toMatch(/\.blind-card__token\s+\.blind-card__emblem\s*\{[^}]*clamp\(96px/);
      expect(css).toMatch(/\.blind-card__token\s+\.blind-card__emblem\s*\{[^}]*clamp\(140px/);
    });
  });
});
