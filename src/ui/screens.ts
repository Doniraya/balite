import './screens.css';
import {
  BOSS_DEFINITIONS,
  DECK_IDS,
  canUseConsumable,
  evaluatePokerHand,
} from '../engine';
import type {
  BossId,
  CharterId,
  ConsumableId,
  DeckId,
  GameCommand,
  HandType,
  PackOffer,
  PlayingCard,
  RunState,
  ShopOffer,
} from '../engine/types';
import type { Translator } from '../i18n';
import {
  attachCardTilt,
  renderEntityCardFrame,
  renderPlayingCardFrame,
} from './cardFrame';

/**
 * Максимальный базовый Этап до входа в бесконечный режим.
 */
const MAX_STANDARD_ANTE = 8;

/**
 * Стоимость смены Босса Этапа при наличии грамоты v_directors_cut.
 */
const BOSS_REROLL_COST = 10;

/**
 * Порог горизонтального смещения указателя (в px), после которого жест считается перетаскиванием.
 */
const DRAG_THRESHOLD_PX = 10;

/**
 * Длительность удержания карты в руке (в мс) для открытия инспектора карты.
 */
const HAND_CARD_HOLD_MS = 285;

/**
 * Задержка (в мс) подавления нативного click сразу после завершения pointer-жеста.
 */
const CLICK_SUPPRESS_MS = 50;

/**
 * Модель представления всех экранов забега Balite.
 */
export interface ScreenViewModel {
  state: RunState;
  translator: Translator;
  selectedCardIds: readonly string[];
  playedCardIds: readonly string[];
  shatteredCardIds: readonly string[];
  highlightedCardId: string | null;
  highlightedHandCardId: string | null;
  highlightedRelicUid: string | null;
  liveScore?: {
    chips: number;
    mult: number;
    totalScore: number;
    targetScore: number;
    handType: HandType;
  } | null;
  liveDollars?: number | null;
  bannerMessage?: {
    text: string;
    tone: 'info' | 'boss' | 'win' | 'lose';
  } | null;
  isAnimating: boolean;
  unlockedDecks: readonly DeckId[];
  selectedDeckId: DeckId;
  seedInput: string;
  hasSavedRun: boolean;
  consumableTargetMode?: {
    readonly consumableUid: string;
    readonly consumableId: ConsumableId;
    readonly min: number;
    readonly max: number;
    readonly mode: 'none' | 'upTo' | 'exact' | 'single' | 'mirror';
  } | null;
}

/**
 * Колбэки действий пользователя для всех экранов Balite.
 */
export interface ScreenActionHandlers {
  onSelectDeck: (deckId: DeckId) => void;
  onSeedInput: (seed: string) => void;
  onRandomSeed: () => void;
  onStartRun: () => void;
  onResumeSavedRun: () => void;
  onCommand: (command: GameCommand) => void;
  onToggleCard: (cardId: string) => void;
  onConfirmConsumableTargets: () => void;
  onCancelConsumableTargets: () => void;
  onInspectRelic: (uid: string, index: number) => void;
  onInspectConsumable: (uid: string, index: number) => void;
  onInspectOffer: (offer: ShopOffer) => void;
  onInspectCharter: (charterId: CharterId, price: number) => void;
  onInspectPack: (pack: PackOffer) => void;
  onInspectPlayingCard: (card: PlayingCard) => void;
  onInspectBoss: (bossId: BossId, disabled: boolean) => void;
  onOpenHandReference: () => void;
  onOpenDeckModal: () => void;
  onOpenSettings: () => void;
  onSkipAnimation: () => void;
  onReturnToDeckSelect: () => void;
}

/**
 * Прямые ссылки на DOM-узлы HUD и слоя эффектов для точечного обновления из TracePlayer.
 */
export interface ScreenRefs {
  chipsEl: HTMLElement;
  multEl: HTMLElement;
  scoreEl: HTMLElement;
  dollarsEl: HTMLElement;
  handTypeEl: HTMLElement;
  popupLayerEl: HTMLElement;
  bannerEl: HTMLElement;
  arenaEl: HTMLElement;
}

/**
 * Вычисленный снимок расклада и параметров для блока живого калькулятора в HUD.
 */
interface LiveCalculatorSnapshot {
  handName: string;
  levelLabel: string;
  chips: number;
  mult: number;
  totalScore: number;
  targetScore: number;
}

/**
 * Контекст рендера с реестром очистки слушателей и таймеров на время жизни одного экрана.
 */
interface RenderContext {
  vm: ScreenViewModel;
  handlers: ScreenActionHandlers;
  cardById: Map<string, PlayingCard>;
  cleanups: Array<() => void>;
}

/**
 * Реестр функций очистки ресурсов предыдущего рендера для каждого корневого контейнера.
 */
const rootCleanups = new WeakMap<HTMLElement, () => void>();

/**
 * Ограничивает число заданным диапазоном [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Возвращает копию массива с элементом, перемещённым с индекса from на индекс to.
 */
function moveArrayItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) {
    next.splice(to, 0, moved);
  }
  return next;
}

/**
 * Создаёт HTML-элемент с заданным классом и текстовым содержимым.
 */
function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text !== undefined) {
    el.textContent = text;
  }
  return el;
}

/**
 * Создаёт кнопку действия с минимальным мобильным размером тап-зоны.
 */
function createButton(
  label: string,
  className: string,
  onClick: () => void,
  disabled = false,
): HTMLButtonElement {
  const btn = createEl('button', `ui-btn ${className}`.trim(), label);
  btn.type = 'button';
  btn.disabled = disabled;
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Подсчитывает доступный лимит слотов Реликвий с учётом Негативных изданий.
 */
function getEffectiveMaxRelics(state: RunState): number {
  const negativeBonus = state.relics.filter((r) => r.edition === 'negative').length;
  return state.maxRelics + negativeBonus;
}

/**
 * Подсчитывает доступный лимит слотов Расходников с учётом Негативных изданий.
 */
function getEffectiveMaxConsumables(state: RunState): number {
  const negativeBonus = state.consumables.filter((c) => c.edition === 'negative').length;
  return state.maxConsumables + negativeBonus;
}

/**
 * Возвращает активные флаги реликвий-модификаторов покерных комбинаций.
 */
function getHandEvalOptions(state: RunState): { fourFingers: boolean; shortcut: boolean } {
  return {
    fourFingers: state.relics.some((r) => r.id === 'j_four_fingers' && !r.debuffed),
    shortcut: state.relics.some((r) => r.id === 'j_shortcut' && !r.debuffed),
  };
}

/**
 * Возвращает активного Босса, если сейчас идёт бой именно с Боссом Этапа.
 */
function getActiveBossId(state: RunState): BossId | null {
  const activeSlot = state.anteBlinds[state.currentBlindIndex];
  if (activeSlot && activeSlot.kind === 'boss') {
    return activeSlot.bossId;
  }
  return null;
}

/**
 * Вычисляет данные для живого калькулятора расклада в HUD (Пояс 1).
 */
function computeLiveCalculator(
  vm: ScreenViewModel,
  cardById: Map<string, PlayingCard>,
): LiveCalculatorSnapshot {
  const { state, translator, liveScore, selectedCardIds, playedCardIds } = vm;
  const evalOptions = getHandEvalOptions(state);

  if (liveScore) {
    const level = state.handLevels[liveScore.handType]?.level ?? 1;
    let isRoyal = false;
    if (liveScore.handType === 'Straight Flush' && playedCardIds.length >= 4) {
      const playedCards = playedCardIds
        .map((id) => cardById.get(id))
        .filter((card): card is PlayingCard => card !== undefined);
      isRoyal = evaluatePokerHand(playedCards, evalOptions).isRoyal === true;
    }
    return {
      handName: isRoyal
        ? translator.t('ui.hud.royalFlush')
        : translator.getHandText(liveScore.handType).name,
      levelLabel: translator.t('ui.hud.levelShort', { level }),
      chips: liveScore.chips,
      mult: liveScore.mult,
      totalScore: liveScore.totalScore,
      targetScore: liveScore.targetScore,
    };
  }

  if (state.phase === 'playing' && selectedCardIds.length > 0) {
    const selectedCards = selectedCardIds
      .map((id) => cardById.get(id))
      .filter((card): card is PlayingCard => card !== undefined);

    if (selectedCards.length > 0) {
      const evalResult = evaluatePokerHand(selectedCards, evalOptions);
      const levelState = state.handLevels[evalResult.handType];
      let chips = levelState.chips;
      let mult = levelState.mult;

      // Босс «Кремень» (bl_flint) уполовинивает базовые Силу и Множитель расклада
      if (getActiveBossId(state) === 'bl_flint' && !state.activeBossDisabled) {
        chips = Math.max(Math.floor(chips * 0.5 + 0.5), 0);
        mult = Math.max(Math.floor(mult * 0.5 + 0.5), 1);
      }

      const handName = evalResult.isRoyal
        ? translator.t('ui.hud.royalFlush')
        : translator.getHandText(evalResult.handType).name;

      return {
        handName,
        levelLabel: translator.t('ui.hud.levelShort', { level: levelState.level }),
        chips,
        mult,
        totalScore: state.score,
        targetScore: state.targetScore,
      };
    }
  }

  return {
    handName: translator.t('ui.hud.previewHint'),
    levelLabel: '',
    chips: 0,
    mult: 0,
    totalScore: state.score,
    targetScore: state.targetScore,
  };
}

/**
 * Вычисляет целевой индекс перестановки элемента при завершении горизонтального перетаскивания.
 */
function resolveDropIndex(
  containerEl: HTMLElement,
  startIndex: number,
  total: number,
  dx: number,
  startRect: DOMRect,
): number {
  const children = Array.from(containerEl.children);
  const measured = children.map((child) => child.getBoundingClientRect());
  const hasRealLayout =
    startRect.width > 0 && measured.some((rect) => rect.width > 0);

  if (hasRealLayout) {
    const projectedCenterX = startRect.left + startRect.width / 2 + dx;
    let closestIndex = startIndex;
    let minDistance = Number.POSITIVE_INFINITY;
    measured.forEach((rect, idx) => {
      const center = rect.left + rect.width / 2;
      const dist = Math.abs(projectedCenterX - center);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = idx;
      }
    });
    return clamp(closestIndex, 0, total - 1);
  }

  // Запасной расчёт шага для сред без геометрического лейаута (например, jsdom)
  const step = Math.max(1, Math.round(Math.abs(dx) / 56));
  const delta = dx > 0 ? step : -step;
  return clamp(startIndex + delta, 0, total - 1);
}

/**
 * Опции единого контроллера жестов слота (тап, удержание и горизонтальное перетаскивание).
 */
interface SlotGestureOptions {
  el: HTMLElement;
  index: number;
  total: number;
  containerEl: HTMLElement;
  holdDelayMs?: number;
  enableDrag: boolean;
  onTap: () => void;
  onHold?: () => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  registerCleanup: (cleanup: () => void) => void;
}

/**
 * Подключает PointerEvents-обработчики тапа, удержания и перетаскивания к слоту карты/предмета.
 */
function attachSlotGestures(options: SlotGestureOptions): void {
  const {
    el,
    index,
    total,
    containerEl,
    holdDelayMs,
    enableDrag,
    onTap,
    onHold,
    onReorder,
    registerCleanup,
  } = options;

  let isTracking = false;
  let startX = 0;
  let lastX = 0;
  let moved = false;
  let holdFired = false;
  let suppressNextClick = false;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let suppressTimer: ReturnType<typeof setTimeout> | null = null;
  let startRect = new DOMRect();

  const clearTimersAndListeners = (): void => {
    if (holdTimer !== null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    window.removeEventListener('pointermove', onWindowMove);
    window.removeEventListener('pointerup', onWindowUp);
    window.removeEventListener('pointercancel', onWindowCancel);
  };

  const resetSuppression = (): void => {
    suppressNextClick = true;
    if (suppressTimer !== null) {
      clearTimeout(suppressTimer);
    }
    suppressTimer = setTimeout(() => {
      suppressNextClick = false;
      suppressTimer = null;
    }, CLICK_SUPPRESS_MS);
  };

  const onWindowMove = (ev: Event): void => {
    if (!isTracking) return;
    const clientX = (ev as PointerEvent).clientX ?? 0;
    lastX = clientX;
    const dx = clientX - startX;

    if (!moved && Math.abs(dx) > DRAG_THRESHOLD_PX) {
      moved = true;
      if (holdTimer !== null) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      if (enableDrag) {
        el.classList.add('is-dragging');
      }
    }

    if (moved && enableDrag) {
      el.style.setProperty('transform', `translateX(${dx}px) scale(1.06)`);
    }
  };

  const finishTracking = (cancelled: boolean): void => {
    if (!isTracking) return;
    isTracking = false;
    clearTimersAndListeners();
    el.classList.remove('is-dragging');
    el.style.removeProperty('transform');

    if (cancelled) {
      resetSuppression();
      return;
    }

    const dx = lastX - startX;
    if (moved && enableDrag && onReorder && total > 1) {
      const targetIndex = resolveDropIndex(containerEl, index, total, dx, startRect);
      resetSuppression();
      if (targetIndex !== index) {
        onReorder(index, targetIndex);
      }
      return;
    }

    if (holdFired) {
      resetSuppression();
      return;
    }

    resetSuppression();
    onTap();
  };

  const onWindowUp = (ev: Event): void => {
    if (typeof (ev as PointerEvent).clientX === 'number') {
      lastX = (ev as PointerEvent).clientX;
    }
    finishTracking(false);
  };

  const onWindowCancel = (): void => {
    finishTracking(true);
  };

  const onPointerDown = (ev: Event): void => {
    const pointerEv = ev as PointerEvent;
    if (typeof pointerEv.button === 'number' && pointerEv.button > 0) {
      return;
    }

    isTracking = true;
    moved = false;
    holdFired = false;
    startX = pointerEv.clientX ?? 0;
    lastX = startX;
    startRect = el.getBoundingClientRect();

    if (holdDelayMs !== undefined && onHold) {
      holdTimer = setTimeout(() => {
        if (!isTracking || moved) return;
        holdFired = true;
        holdTimer = null;
        onHold();
      }, holdDelayMs);
    }

    window.addEventListener('pointermove', onWindowMove);
    window.addEventListener('pointerup', onWindowUp);
    window.addEventListener('pointercancel', onWindowCancel);
  };

  const onClick = (): void => {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    onTap();
  };

  const onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onTap();
    }
  };

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('click', onClick);
  el.addEventListener('keydown', onKeyDown);

  registerCleanup(() => {
    clearTimersAndListeners();
    if (suppressTimer !== null) {
      clearTimeout(suppressTimer);
      suppressTimer = null;
    }
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('click', onClick);
    el.removeEventListener('keydown', onKeyDown);
  });
}

/**
 * Отрисовывает Пояс 1 (HUD) и возвращает ссылки на быстро обновляемые DOM-узлы.
 */
function renderHudBelt(
  ctx: RenderContext,
): {
  beltEl: HTMLElement;
  chipsEl: HTMLElement;
  multEl: HTMLElement;
  scoreEl: HTMLElement;
  dollarsEl: HTMLElement;
  handTypeEl: HTMLElement;
} {
  const { vm, handlers, cardById } = ctx;
  const { state, translator } = vm;
  const beltEl = createEl('section', 'belt belt--hud');
  beltEl.dataset.belt = 'hud';

  const calc = computeLiveCalculator(vm, cardById);
  const displayedDollars = vm.liveDollars ?? state.dollars;

  if (state.phase === 'deck_select') {
    const titleBar = createEl('div', 'hud-title-bar');
    const brand = createEl('div', 'hud-title-bar__brand');
    brand.append(
      createEl('h1', 'hud-title-bar__name', translator.t('ui.app.title')),
      createEl('p', 'hud-title-bar__sub', translator.t('ui.app.subtitle')),
    );
    const settingsBtn = createButton(
      translator.t('ui.actions.settings'),
      'ui-btn--compact',
      handlers.onOpenSettings,
    );
    titleBar.append(brand, settingsBtn);

    // Скрытые дежурные узлы для соблюдения контракта ScreenRefs на стартовом экране
    const standby = createEl('div', 'hud-refs-standby');
    standby.setAttribute('aria-hidden', 'true');
    const chipsEl = createEl('span', undefined, String(calc.chips));
    const multEl = createEl('span', undefined, String(calc.mult));
    const scoreEl = createEl('span', undefined, String(calc.totalScore));
    const dollarsEl = createEl(
      'span',
      undefined,
      translator.t('ui.hud.goldAmount', { dollars: displayedDollars }),
    );
    const handTypeEl = createEl('span', undefined, calc.handName);
    standby.append(chipsEl, multEl, scoreEl, dollarsEl, handTypeEl);

    beltEl.append(titleBar, standby);
    return { beltEl, chipsEl, multEl, scoreEl, dollarsEl, handTypeEl };
  }

  const grid = createEl('div', 'hud-grid');

  // Левая колонка: Этап/Раунд и кнопка Стража/Босса
  const guardianCol = createEl('div', 'hud-guardian-col');
  const stageRow = createEl('div', 'hud-stage-row');
  const stageText = state.endlessMode
    ? translator.t('ui.hud.endlessStage', { ante: state.ante })
    : translator.t('ui.hud.stageWithMax', {
        ante: state.ante,
        maxAnte: MAX_STANDARD_ANTE,
      });
  stageRow.append(
    createEl('span', 'hud-stage-label', stageText),
    createEl('span', 'hud-round-pill', translator.t('ui.hud.round', { round: state.round })),
  );

  const activeSlot = state.anteBlinds[state.currentBlindIndex] ?? state.anteBlinds[0];
  const bossSlot = state.anteBlinds[2];
  const inspectableBossId = activeSlot.bossId ?? bossSlot?.bossId ?? null;
  const isBossActive = activeSlot.kind === 'boss' && activeSlot.bossId !== null;
  const blindText = translator.getBlindText(activeSlot.kind, activeSlot.bossId);

  const bossBtn = createEl(
    'button',
    `hud-boss-btn ${isBossActive ? 'hud-boss-btn--boss' : ''}`.trim(),
  );
  bossBtn.type = 'button';
  if (inspectableBossId) {
    bossBtn.dataset.bossId = inspectableBossId;
    bossBtn.addEventListener('click', () =>
      handlers.onInspectBoss(
        inspectableBossId,
        isBossActive ? state.activeBossDisabled : false,
      ),
    );
  }
  bossBtn.append(
    createEl('span', 'hud-boss-btn__title', blindText.name),
    createEl('span', 'hud-boss-btn__desc', blindText.description),
  );
  if (isBossActive && state.activeBossDisabled) {
    bossBtn.append(
      createEl('span', 'hud-boss-btn__badge', translator.t('ui.hud.abilityDisabled')),
    );
  }

  guardianCol.append(stageRow, bossBtn);

  // Центральная колонка: Очки / Цель и живой калькулятор расклада
  const calcCol = createEl('div', 'hud-calc-col');
  const scoreBox = createEl('div', 'hud-score-box');
  const scoreNumbers = createEl('div', 'hud-score-box__numbers');
  const scoreEl = createEl('span', 'hud-score-box__value', String(calc.totalScore));
  scoreEl.dataset.ref = 'score';
  const targetEl = createEl(
    'span',
    'hud-score-box__target',
    `/ ${calc.targetScore}`,
  );
  scoreNumbers.append(scoreEl, targetEl);
  scoreBox.append(
    createEl('span', 'hud-score-box__label', translator.t('ui.hud.score')),
    scoreNumbers,
  );

  const handRow = createEl('div', 'hud-hand-row');
  const handTypeEl = createEl('span', 'hud-hand-row__name', calc.handName);
  handTypeEl.dataset.ref = 'handType';
  handRow.append(handTypeEl);
  if (calc.levelLabel) {
    handRow.append(createEl('span', 'hud-hand-row__level', calc.levelLabel));
  }

  const formula = createEl('div', 'hud-formula');
  const chipsPill = createEl('div', 'hud-pill hud-pill--chips');
  const chipsEl = createEl('span', 'hud-pill__val', String(calc.chips));
  chipsEl.dataset.ref = 'chips';
  chipsPill.append(
    createEl('span', 'hud-pill__label', translator.t('ui.hud.powerShort')),
    chipsEl,
  );

  const multPill = createEl('div', 'hud-pill hud-pill--mult');
  const multEl = createEl('span', 'hud-pill__val', String(calc.mult));
  multEl.dataset.ref = 'mult';
  multPill.append(
    createEl('span', 'hud-pill__label', translator.t('ui.hud.multShort')),
    multEl,
  );

  formula.append(chipsPill, createEl('span', 'hud-formula__x', '×'), multPill);
  calcCol.append(scoreBox, handRow, formula);

  // Правая колонка: Руки / Сбросы / Золото и кнопки Расклады / Настройки
  const metaCol = createEl('div', 'hud-meta-col');
  const statsRow = createEl('div', 'hud-stats-row');

  const handsStat = createEl('div', 'hud-stat');
  handsStat.append(
    createEl('span', 'hud-stat__label', translator.t('ui.hud.hands')),
    createEl('span', 'hud-stat__value', String(state.handsLeft)),
  );

  const discardsStat = createEl('div', 'hud-stat');
  discardsStat.append(
    createEl('span', 'hud-stat__label', translator.t('ui.hud.discards')),
    createEl('span', 'hud-stat__value', String(state.discardsLeft)),
  );

  const goldStat = createEl('div', 'hud-stat');
  const dollarsEl = createEl(
    'span',
    'hud-stat__value hud-stat__value--gold',
    translator.t('ui.hud.goldAmount', { dollars: displayedDollars }),
  );
  dollarsEl.dataset.ref = 'dollars';
  goldStat.append(
    createEl('span', 'hud-stat__label', translator.t('ui.hud.gold')),
    dollarsEl,
  );

  statsRow.append(handsStat, discardsStat, goldStat);

  const btnRow = createEl('div', 'hud-buttons-row');
  btnRow.append(
    createButton(
      translator.t('ui.actions.handReference'),
      'ui-btn--compact',
      handlers.onOpenHandReference,
    ),
    createButton(
      translator.t('ui.actions.settings'),
      'ui-btn--compact',
      handlers.onOpenSettings,
    ),
  );

  metaCol.append(statsRow, btnRow);
  grid.append(guardianCol, calcCol, metaCol);
  beltEl.append(grid);

  return { beltEl, chipsEl, multEl, scoreEl, dollarsEl, handTypeEl };
}

/**
 * Отрисовывает Пояс 2: ленты Реликвий, Расходников и активные Знаки.
 */
function renderInventoryBelt(ctx: RenderContext): HTMLElement {
  const { vm, handlers, cleanups } = ctx;
  const { state, translator } = vm;
  const beltEl = createEl('section', 'belt belt--inventory');
  beltEl.dataset.belt = 'inventory';

  if (state.phase === 'deck_select') {
    const deckText = translator.getDeckText(vm.selectedDeckId);
    const preview = createEl('div', 'inventory-deck-banner');
    preview.append(
      createEl('strong', undefined, `${deckText.name}:`),
      createEl('span', undefined, deckText.description),
    );
    beltEl.append(preview);
    return beltEl;
  }

  const strips = createEl('div', 'inventory-strips');

  // Лента Реликвий
  const relicStrip = createEl('div', 'inventory-strip');
  const relicHead = createEl('div', 'inventory-strip__head');
  relicHead.append(
    createEl('span', undefined, translator.t('ui.hud.relics')),
    createEl(
      'span',
      'inventory-strip__count',
      translator.t('ui.hud.slotsCount', {
        count: state.relics.length,
        max: getEffectiveMaxRelics(state),
      }),
    ),
  );
  const relicItemsEl = createEl('div', 'inventory-strip__items');

  state.relics.forEach((relic, index) => {
    const isHighlighted = vm.highlightedRelicUid === relic.uid;
    const slot = createEl('div', 'inventory-slot interactive-slot');
    slot.setAttribute('role', 'button');
    slot.tabIndex = 0;
    slot.dataset.relicUid = relic.uid;
    slot.dataset.index = String(index);
    if (isHighlighted) {
      slot.dataset.highlighted = 'true';
    }

    const frame = renderEntityCardFrame({
      kind: 'relic',
      relic,
      translator,
      compact: true,
      interactive: true,
      triggering: isHighlighted,
    });
    slot.append(frame);
    cleanups.push(attachCardTilt(frame));

    attachSlotGestures({
      el: slot,
      index,
      total: state.relics.length,
      containerEl: relicItemsEl,
      enableDrag: !vm.isAnimating,
      onTap: () => handlers.onInspectRelic(relic.uid, index),
      onReorder: (from, to) => {
        const reordered = moveArrayItem(
          state.relics.map((item) => item.uid),
          from,
          to,
        );
        handlers.onCommand({ type: 'REORDER_RELICS', relicUids: reordered });
      },
      registerCleanup: (fn) => cleanups.push(fn),
    });

    relicItemsEl.append(slot);
  });
  relicStrip.append(relicHead, relicItemsEl);

  // Лента Расходников
  const consStrip = createEl('div', 'inventory-strip');
  const consHead = createEl('div', 'inventory-strip__head');
  consHead.append(
    createEl('span', undefined, translator.t('ui.hud.consumables')),
    createEl(
      'span',
      'inventory-strip__count',
      translator.t('ui.hud.slotsCount', {
        count: state.consumables.length,
        max: getEffectiveMaxConsumables(state),
      }),
    ),
  );
  const consItemsEl = createEl('div', 'inventory-strip__items');

  state.consumables.forEach((consumable, index) => {
    const isTargeting = vm.consumableTargetMode?.consumableUid === consumable.uid;
    const slot = createEl('div', 'inventory-slot interactive-slot');
    slot.setAttribute('role', 'button');
    slot.tabIndex = 0;
    slot.dataset.consumableUid = consumable.uid;
    slot.dataset.index = String(index);

    const frame = renderEntityCardFrame({
      kind: 'consumable',
      consumable,
      translator,
      compact: true,
      interactive: true,
      selected: isTargeting,
    });
    slot.append(frame);
    cleanups.push(attachCardTilt(frame));

    attachSlotGestures({
      el: slot,
      index,
      total: state.consumables.length,
      containerEl: consItemsEl,
      enableDrag: !vm.isAnimating,
      onTap: () => handlers.onInspectConsumable(consumable.uid, index),
      onReorder: (from, to) => {
        const reordered = moveArrayItem(
          state.consumables.map((item) => item.uid),
          from,
          to,
        );
        handlers.onCommand({
          type: 'REORDER_CONSUMABLES',
          consumableUids: reordered,
        });
      },
      registerCleanup: (fn) => cleanups.push(fn),
    });

    consItemsEl.append(slot);
  });
  consStrip.append(consHead, consItemsEl);
  strips.append(relicStrip, consStrip);
  beltEl.append(strips);

  // Бейджи активных Знаков
  if (state.pendingTags.length > 0) {
    const tagsStrip = createEl('div', 'tags-strip');
    tagsStrip.append(
      createEl('span', 'tags-strip__label', `${translator.t('ui.hud.activeTags')}:`),
    );
    state.pendingTags.forEach((tagId) => {
      const tagText = translator.getTagText(tagId);
      const badge = createEl('span', 'tag-badge', tagText.name);
      badge.dataset.tagId = tagId;
      badge.title = tagText.description;
      tagsStrip.append(badge);
    });
    beltEl.append(tagsStrip);
  }

  return beltEl;
}

/**
 * Отрисовывает экран выбора колоды и сида (фаза `deck_select`).
 */
function renderDeckSelectArena(ctx: RenderContext, arenaEl: HTMLElement): void {
  const { vm, handlers } = ctx;
  const { translator } = vm;

  const header = createEl('div', 'arena-header');
  header.append(createEl('h2', 'arena-title', translator.t('ui.deckSelect.title')));

  const grid = createEl('div', 'deck-grid');
  for (const deckId of DECK_IDS) {
    const unlocked = vm.unlockedDecks.includes(deckId);
    const selected = vm.selectedDeckId === deckId;
    const deckText = translator.getDeckText(deckId);

    const btn = createEl(
      'button',
      `deck-option interactive-slot ${selected ? 'is-selected' : ''}`.trim(),
    );
    btn.type = 'button';
    btn.disabled = !unlocked;
    btn.dataset.deckId = deckId;
    btn.setAttribute('aria-pressed', String(selected));

    const top = createEl('div', 'deck-option__top');
    top.append(
      createEl('span', 'deck-option__name', deckText.name),
      createEl(
        'span',
        'deck-option__status',
        translator.t(unlocked ? 'ui.deckSelect.unlocked' : 'ui.deckSelect.locked'),
      ),
    );
    btn.append(top, createEl('span', 'deck-option__desc', deckText.description));

    btn.addEventListener('click', () => {
      if (unlocked) {
        handlers.onSelectDeck(deckId);
      }
    });
    grid.append(btn);
  }

  const seedBar = createEl('div', 'seed-bar');
  const seedLabel = createEl('label', 'seed-bar__label', translator.t('ui.deckSelect.seedLabel'));
  const seedInput = createEl('input', 'seed-bar__input');
  seedInput.type = 'text';
  seedInput.value = vm.seedInput;
  seedInput.placeholder = translator.t('ui.deckSelect.seedPlaceholder');
  seedInput.setAttribute('aria-label', translator.t('ui.deckSelect.seedLabel'));
  seedInput.addEventListener('input', () => handlers.onSeedInput(seedInput.value));

  const randomBtn = createButton(
    translator.t('ui.deckSelect.randomSeed'),
    'ui-btn--compact',
    handlers.onRandomSeed,
  );
  seedBar.append(seedLabel, seedInput, randomBtn);

  const actions = createEl('div', 'deck-start-actions');
  actions.append(
    createButton(
      translator.t('ui.actions.startRun'),
      'ui-btn--primary',
      handlers.onStartRun,
    ),
  );
  if (vm.hasSavedRun) {
    actions.append(
      createButton(
        translator.t('ui.actions.continueRun'),
        'ui-btn--accent',
        handlers.onResumeSavedRun,
      ),
    );
  }

  arenaEl.append(header, grid, seedBar, actions);
}

/**
 * Отрисовывает экран выбора Стражей Этапа (фаза `blind_select`).
 */
function renderBlindSelectArena(ctx: RenderContext, arenaEl: HTMLElement): void {
  const { vm, handlers } = ctx;
  const { state, translator } = vm;

  const header = createEl('div', 'arena-header');
  header.append(
    createEl('h2', 'arena-title', translator.t('ui.blindSelect.title', { ante: state.ante })),
  );

  // Кнопка смены Босса доступна при наличии грамоты Указа смены врага (v_directors_cut)
  const bossSlot = state.anteBlinds[2];
  if (state.charters.includes('v_directors_cut') && bossSlot.status === 'upcoming') {
    const canReroll = state.dollars >= BOSS_REROLL_COST && state.bossRerollsThisAnte < 1;
    header.append(
      createButton(
        translator.t('ui.actions.rerollBoss', { dollars: BOSS_REROLL_COST }),
        'ui-btn--accent ui-btn--compact',
        () => handlers.onCommand({ type: 'REROLL_BOSS' }),
        !canReroll,
      ),
    );
  }

  const grid = createEl('div', 'blinds-grid');
  for (const slot of state.anteBlinds) {
    const card = createEl('div', `blind-card blind-card--${slot.status}`);
    card.dataset.blindKind = slot.kind;

    const blindText = translator.getBlindText(slot.kind, slot.bossId);
    const statusText = translator.t(`ui.blindSelect.${slot.status}`);

    const infoBlock = createEl('div', 'blind-card__meta');
    infoBlock.append(
      createEl('span', 'blind-card__status', statusText),
      createEl('strong', 'blind-card__title', blindText.name),
      createEl('span', undefined, translator.t('ui.blindSelect.target', { score: slot.targetScore })),
      createEl('span', undefined, translator.t('ui.blindSelect.reward', { dollars: slot.reward })),
    );

    if (slot.kind === 'boss' && slot.bossId !== null) {
      const bossId = slot.bossId;
      if (BOSS_DEFINITIONS[bossId].showdown) {
        infoBlock.append(
          createEl('span', 'blind-card__badge', translator.t('ui.blindSelect.showdownBadge')),
        );
      }
      const inspectBossBtn = createEl('button', 'blind-card__boss-inspect interactive-slot');
      inspectBossBtn.type = 'button';
      inspectBossBtn.dataset.bossId = bossId;
      inspectBossBtn.textContent = blindText.description;
      inspectBossBtn.addEventListener('click', () => handlers.onInspectBoss(bossId, false));
      infoBlock.append(inspectBossBtn);
    }

    const actions = createEl('div', 'blind-card__actions');
    if (slot.status === 'current') {
      actions.append(
        createButton(
          translator.t('ui.actions.battle'),
          'ui-btn--primary',
          () => handlers.onCommand({ type: 'SELECT_BLIND' }),
        ),
      );
      if (slot.kind !== 'boss' && slot.skipTagId !== null) {
        const tagName = translator.getTagText(slot.skipTagId).name;
        actions.append(
          createButton(
            translator.t('ui.blindSelect.skipWithTag', { tag: tagName }),
            'ui-btn--compact',
            () => handlers.onCommand({ type: 'SKIP_BLIND' }),
          ),
        );
      } else if (slot.kind === 'boss') {
        actions.append(
          createEl('span', 'blind-card__badge', translator.t('ui.blindSelect.cannotSkipBoss')),
        );
      }
    }

    card.append(infoBlock, actions);
    grid.append(card);
  }

  arenaEl.append(header, grid);
}

/**
 * Отрисовывает игровую зону розыгрыша карт в фазе `playing`.
 */
function renderPlayingArena(ctx: RenderContext, arenaEl: HTMLElement): void {
  const { vm, handlers, cardById, cleanups } = ctx;
  const playZone = createEl('div', 'play-zone');

  for (const cardId of vm.playedCardIds) {
    const card = cardById.get(cardId);
    if (!card) continue;

    const shattered = vm.shatteredCardIds.includes(cardId);
    const highlighted = vm.highlightedCardId === cardId;

    const slot = createEl(
      'div',
      `play-zone__card interactive-slot ${highlighted ? 'is-highlighted' : ''} ${shattered ? 'is-shattered' : ''}`.trim(),
    );
    slot.dataset.cardId = card.id;
    slot.dataset.zone = 'play';
    if (highlighted) {
      slot.dataset.highlighted = 'true';
    }
    if (shattered) {
      slot.dataset.shattered = 'true';
    }

    const frame = renderPlayingCardFrame({
      card,
      translator: vm.translator,
      triggering: highlighted,
      disabled: shattered,
      interactive: !vm.isAnimating,
    });
    slot.append(frame);
    cleanups.push(attachCardTilt(frame));

    if (!vm.isAnimating) {
      slot.setAttribute('role', 'button');
      slot.tabIndex = 0;
      slot.addEventListener('click', () => handlers.onInspectPlayingCard(card));
    }

    playZone.append(slot);
  }

  arenaEl.append(playZone);
}

/**
 * Отрисовывает экран детализации награды за победу над Стражем (фаза `cashout`).
 */
function renderCashoutArena(ctx: RenderContext, arenaEl: HTMLElement): void {
  const { vm, handlers } = ctx;
  const { state, translator } = vm;
  const cashout = state.cashout;

  const header = createEl('div', 'arena-header');
  header.append(createEl('h2', 'arena-title', translator.t('ui.cashout.title')));
  arenaEl.append(header);

  if (!cashout) return;

  const rows: ReadonlyArray<{ label: string; amount: number; total?: boolean }> = [
    { label: translator.t('ui.cashout.guardianReward'), amount: cashout.blindReward },
    {
      label: translator.t('ui.cashout.unusedHands', { count: state.handsLeft }),
      amount: cashout.unusedHandsBonus,
    },
    { label: translator.t('ui.cashout.interest'), amount: cashout.interestBonus },
    { label: translator.t('ui.cashout.relicBonus'), amount: cashout.relicBonus },
    { label: translator.t('ui.cashout.tagBonus'), amount: cashout.tagBonus },
    { label: translator.t('ui.cashout.total'), amount: cashout.totalReward, total: true },
  ];

  const list = createEl('div', 'cashout-list');
  for (const row of rows) {
    const rowEl = createEl(
      'div',
      `cashout-row ${row.total ? 'cashout-row--total' : row.amount === 0 ? 'cashout-row--zero' : ''}`.trim(),
    );
    rowEl.append(
      createEl('span', undefined, row.label),
      createEl('strong', undefined, translator.t('ui.hud.goldAmount', { dollars: row.amount })),
    );
    list.append(rowEl);
  }

  const claimBtn = createButton(
    translator.t('ui.actions.claimCashout', { dollars: cashout.totalReward }),
    'ui-btn--accent',
    () => handlers.onCommand({ type: 'CLAIM_CASHOUT' }),
  );
  arenaEl.append(list, claimBtn);
}

/**
 * Отрисовывает экран лавки (фаза `shop`).
 */
function renderShopArena(ctx: RenderContext, arenaEl: HTMLElement): void {
  const { vm, handlers, cleanups } = ctx;
  const { state, translator } = vm;
  const shop = state.shop;

  const header = createEl('div', 'arena-header');
  header.append(createEl('h2', 'arena-title', translator.t('ui.shop.title')));

  const headerActions = createEl('div', 'shop-header-actions');
  if (shop) {
    const rerollCost = shop.tempRerollCost ?? shop.rerollCost;
    headerActions.append(
      createButton(
        translator.t('ui.actions.rerollShop', { dollars: rerollCost }),
        'ui-btn--compact',
        () => handlers.onCommand({ type: 'REROLL_SHOP' }),
        state.dollars < rerollCost,
      ),
    );
  }
  headerActions.append(
    createButton(
      translator.t('ui.actions.nextRound'),
      'ui-btn--primary ui-btn--compact',
      () => handlers.onCommand({ type: 'NEXT_ROUND' }),
    ),
  );
  header.append(headerActions);
  arenaEl.append(header);

  if (!shop) return;

  const sections = createEl('div', 'shop-sections');

  // Полка товаров
  const shelfRow = createEl('div', 'shop-row');
  shelfRow.append(createEl('span', 'shop-row__title', translator.t('ui.shop.shelfTitle')));
  const shelfItems = createEl('div', 'shop-items');

  for (const offer of shop.offers) {
    if (offer.sold) {
      const soldEl = createEl('div', 'shop-slot-btn--sold', translator.t('ui.shop.sold'));
      soldEl.dataset.offerUid = offer.uid;
      soldEl.dataset.sold = 'true';
      shelfItems.append(soldEl);
      continue;
    }

    const affordable = state.dollars >= offer.cost;
    const slotBtn = createEl('button', 'shop-slot-btn interactive-slot');
    slotBtn.type = 'button';
    slotBtn.dataset.offerUid = offer.uid;

    let frame: HTMLElement;
    if (offer.kind === 'relic') {
      frame = renderEntityCardFrame({
        kind: 'relic',
        relic: offer.relic,
        translator,
        price: offer.cost,
        compact: true,
        interactive: true,
        disabled: !affordable,
      });
    } else if (offer.kind === 'consumable') {
      frame = renderEntityCardFrame({
        kind: 'consumable',
        consumable: offer.consumable,
        translator,
        price: offer.cost,
        compact: true,
        interactive: true,
        disabled: !affordable,
      });
    } else {
      frame = renderPlayingCardFrame({
        card: offer.card,
        translator,
        compact: true,
        interactive: true,
        disabled: !affordable,
      });
    }
    cleanups.push(attachCardTilt(frame));
    slotBtn.append(
      frame,
      createEl(
        'span',
        'shop-slot-btn__price',
        offer.cost === 0
          ? translator.t('ui.shop.free')
          : translator.t('ui.hud.goldAmount', { dollars: offer.cost }),
      ),
    );
    if (!affordable) {
      slotBtn.append(
        createEl('span', 'shop-slot-btn__warn', translator.t('ui.shop.notEnoughGold')),
      );
    }
    slotBtn.addEventListener('click', () => handlers.onInspectOffer(offer));
    shelfItems.append(slotBtn);
  }
  shelfRow.append(shelfItems);

  // Нижний ряд: Грамота и бустер-наборы
  const bottomGrid = createEl('div', 'shop-bottom-grid');

  const charterRow = createEl('div', 'shop-row');
  charterRow.append(createEl('span', 'shop-row__title', translator.t('ui.shop.charterTitle')));
  if (shop.voucher && !shop.voucher.sold) {
    const voucher = shop.voucher;
    const affordable = state.dollars >= voucher.cost;
    const voucherBtn = createEl('button', 'shop-slot-btn interactive-slot');
    voucherBtn.type = 'button';
    voucherBtn.dataset.charterId = voucher.charterId;
    const frame = renderEntityCardFrame({
      kind: 'charter',
      charterId: voucher.charterId,
      translator,
      price: voucher.cost,
      compact: true,
      interactive: true,
      disabled: !affordable,
    });
    cleanups.push(attachCardTilt(frame));
    voucherBtn.append(
      frame,
      createEl(
        'span',
        'shop-slot-btn__price',
        translator.t('ui.hud.goldAmount', { dollars: voucher.cost }),
      ),
    );
    voucherBtn.addEventListener('click', () =>
      handlers.onInspectCharter(voucher.charterId, voucher.cost),
    );
    charterRow.append(voucherBtn);
  } else {
    const emptyLabel = shop.voucher?.sold
      ? translator.t('ui.shop.sold')
      : translator.t('ui.shop.charterEmpty');
    charterRow.append(createEl('div', 'shop-empty-slot', emptyLabel));
  }

  const packsRow = createEl('div', 'shop-row');
  packsRow.append(createEl('span', 'shop-row__title', translator.t('ui.shop.packsTitle')));
  const packsList = createEl('div', 'shop-items');
  for (const pack of shop.packs) {
    if (pack.purchased) {
      const soldPack = createEl('div', 'shop-slot-btn--sold', translator.t('ui.shop.sold'));
      soldPack.dataset.packUid = pack.uid;
      packsList.append(soldPack);
      continue;
    }

    const affordable = state.dollars >= pack.cost;
    const packBtn = createEl('button', 'shop-slot-btn interactive-slot');
    packBtn.type = 'button';
    packBtn.dataset.packUid = pack.uid;
    const frame = renderEntityCardFrame({
      kind: 'pack',
      packType: pack.type,
      packSize: pack.size,
      translator,
      price: pack.cost,
      compact: true,
      interactive: true,
      disabled: !affordable,
    });
    cleanups.push(attachCardTilt(frame));
    packBtn.append(
      frame,
      createEl(
        'span',
        'shop-slot-btn__price',
        translator.t('ui.hud.goldAmount', { dollars: pack.cost }),
      ),
    );
    packBtn.addEventListener('click', () => handlers.onInspectPack(pack));
    packsList.append(packBtn);
  }
  packsRow.append(packsList);

  bottomGrid.append(charterRow, packsRow);
  sections.append(shelfRow, bottomGrid);
  arenaEl.append(sections);
}

/**
 * Отрисовывает экран открытого бустер-набора (фаза `booster`).
 */
function renderBoosterArena(ctx: RenderContext, arenaEl: HTMLElement): void {
  const { vm, handlers, cleanups } = ctx;
  const { state, translator } = vm;
  const booster = state.booster;
  if (!booster) return;

  const header = createEl('div', 'arena-header');
  header.append(
    createEl(
      'h2',
      'arena-title',
      translator.getPackTitle(booster.packType, booster.packSize),
    ),
    createEl(
      'span',
      'hud-round-pill',
      translator.t('ui.booster.picksLeft', { count: booster.remainingPicks }),
    ),
  );

  const choicesRow = createEl('div', 'booster-choices');
  const maxRelics = getEffectiveMaxRelics(state);

  for (const choice of booster.choices) {
    const slot = createEl(
      'div',
      `booster-choice ${choice.picked ? 'is-picked' : ''}`.trim(),
    );
    slot.dataset.choiceUid = choice.uid;
    if (choice.picked) {
      slot.dataset.picked = 'true';
    }

    let frame: HTMLElement;
    let nameText = '';
    let canPick = !choice.picked && booster.remainingPicks > 0;
    let pickTargetIds: readonly string[] | undefined;
    let blockReason = '';

    if (choice.kind === 'relic') {
      frame = renderEntityCardFrame({
        kind: 'relic',
        relic: choice.relic,
        translator,
        compact: true,
        disabled: choice.picked,
      });
      nameText = translator.getRelicText(choice.relic.id).name;
      const hasSlot = choice.relic.edition === 'negative' || state.relics.length < maxRelics;
      if (!hasSlot) {
        canPick = false;
        blockReason = translator.t('ui.shop.noSlots');
      }
    } else if (choice.kind === 'consumable') {
      frame = renderEntityCardFrame({
        kind: 'consumable',
        consumable: choice.consumable,
        translator,
        compact: true,
        disabled: choice.picked,
      });
      nameText = translator.getConsumableText(choice.consumable.id).name;
      if (!canUseConsumable(state, choice.consumable, vm.selectedCardIds)) {
        canPick = false;
      } else if (vm.selectedCardIds.length > 0) {
        pickTargetIds = vm.selectedCardIds;
      }
    } else {
      frame = renderPlayingCardFrame({
        card: choice.card,
        translator,
        compact: true,
        disabled: choice.picked,
      });
      nameText = frame.getAttribute('aria-label') ?? '';
    }

    cleanups.push(attachCardTilt(frame));
    const pickBtn = createButton(
      blockReason || translator.t('ui.actions.pickItem'),
      'ui-btn--primary ui-btn--compact',
      () =>
        handlers.onCommand(
          pickTargetIds
            ? {
                type: 'PICK_BOOSTER_ITEM',
                choiceUid: choice.uid,
                targetCardIds: pickTargetIds,
              }
            : {
                type: 'PICK_BOOSTER_ITEM',
                choiceUid: choice.uid,
              },
        ),
      !canPick,
    );

    slot.append(frame, createEl('span', 'booster-choice__name', nameText), pickBtn);
    choicesRow.append(slot);
  }

  const skipBtn = createButton(
    translator.t('ui.actions.skipPack'),
    'ui-btn--compact',
    () => handlers.onCommand({ type: 'SKIP_BOOSTER' }),
  );

  arenaEl.append(header, choicesRow, skipBtn);
}

/**
 * Отрисовывает экраны окончания забега (фазы `victory` и `game_over`).
 */
function renderRunEndArena(
  ctx: RenderContext,
  arenaEl: HTMLElement,
  isVictory: boolean,
): void {
  const { vm, handlers } = ctx;
  const { state, translator } = vm;

  const card = createEl(
    'div',
    `run-end-card ${isVictory ? 'run-end-card--victory' : 'run-end-card--defeat'}`,
  );
  card.append(
    createEl(
      'h2',
      'arena-title',
      translator.t(isVictory ? 'ui.runEnd.victoryTitle' : 'ui.runEnd.defeatTitle'),
    ),
    createEl(
      'p',
      'hud-title-bar__sub',
      translator.t(isVictory ? 'ui.runEnd.victorySubtitle' : 'ui.runEnd.defeatSubtitle'),
    ),
  );

  const statRows: ReadonlyArray<readonly [string, string]> = [
    [translator.t('ui.runEnd.bestHandScore'), String(state.stats.bestHandScore)],
    [translator.t('ui.runEnd.handsPlayed'), String(state.stats.handsPlayed)],
    [translator.t('ui.runEnd.discardsUsed'), String(state.stats.discardsUsed)],
    [translator.t('ui.runEnd.cardsDestroyed'), String(state.stats.cardsDestroyed)],
    [
      translator.t('ui.runEnd.dollarsSpent'),
      translator.t('ui.hud.goldAmount', { dollars: state.stats.dollarsSpent }),
    ],
    [translator.t('ui.runEnd.finalStage'), String(state.ante)],
    [translator.t('ui.runEnd.finalRound'), String(state.round)],
    [translator.t('ui.runEnd.runSeed'), state.seed],
  ];

  const statsGrid = createEl('div', 'run-end-stats');
  for (const [label, value] of statRows) {
    const row = createEl('div', 'run-end-stat');
    row.append(createEl('span', undefined, label), createEl('strong', undefined, value));
    statsGrid.append(row);
  }

  const actions = createEl('div', 'run-end-actions');
  if (isVictory) {
    actions.append(
      createButton(
        translator.t('ui.actions.continueEndless'),
        'ui-btn--accent',
        () => handlers.onCommand({ type: 'CONTINUE_ENDLESS' }),
      ),
      createButton(
        translator.t('ui.actions.newRun'),
        'ui-btn--primary',
        handlers.onReturnToDeckSelect,
      ),
    );
  } else {
    actions.append(
      createButton(
        translator.t('ui.actions.playAgain'),
        'ui-btn--primary',
        handlers.onStartRun,
      ),
      createButton(
        translator.t('ui.actions.toDeckSelect'),
        '',
        handlers.onReturnToDeckSelect,
      ),
    );
  }

  card.append(statsGrid, actions);
  arenaEl.append(card);
}

/**
 * Отрисовывает Пояс 3 (Арена), слой всплывающих цифр и баннер уведомлений.
 */
function renderArenaBelt(
  ctx: RenderContext,
): {
  beltEl: HTMLElement;
  arenaEl: HTMLElement;
  popupLayerEl: HTMLElement;
  bannerEl: HTMLElement;
} {
  const { vm, handlers } = ctx;
  const { state, bannerMessage, isAnimating } = vm;

  const beltEl = createEl('section', 'belt belt--arena');
  beltEl.dataset.belt = 'arena';

  const arenaEl = createEl('div', 'arena-stage');
  arenaEl.dataset.phase = state.phase;
  if (isAnimating) {
    arenaEl.dataset.animating = 'true';
    arenaEl.addEventListener('click', handlers.onSkipAnimation);
  }

  switch (state.phase) {
    case 'deck_select':
      renderDeckSelectArena(ctx, arenaEl);
      break;
    case 'blind_select':
      renderBlindSelectArena(ctx, arenaEl);
      break;
    case 'playing':
      renderPlayingArena(ctx, arenaEl);
      break;
    case 'cashout':
      renderCashoutArena(ctx, arenaEl);
      break;
    case 'shop':
      renderShopArena(ctx, arenaEl);
      break;
    case 'booster':
      renderBoosterArena(ctx, arenaEl);
      break;
    case 'victory':
      renderRunEndArena(ctx, arenaEl, true);
      break;
    case 'game_over':
      renderRunEndArena(ctx, arenaEl, false);
      break;
  }

  const popupLayerEl = createEl('div', 'popup-layer');
  popupLayerEl.dataset.layer = 'popups';

  const bannerEl = createEl(
    'div',
    `arena-banner ${bannerMessage ? '' : 'is-hidden'}`.trim(),
    bannerMessage?.text ?? '',
  );
  if (bannerMessage) {
    bannerEl.dataset.tone = bannerMessage.tone;
  }

  beltEl.append(arenaEl, popupLayerEl, bannerEl);
  return { beltEl, arenaEl, popupLayerEl, bannerEl };
}

/**
 * Отрисовывает баннер выбора целей расходника в Поясе 4.
 */
function renderTargetModeBanner(ctx: RenderContext): HTMLElement | null {
  const { vm, handlers } = ctx;
  const targetMode = vm.consumableTargetMode;
  if (!targetMode || targetMode.mode === 'none') {
    return null;
  }

  const { translator, selectedCardIds, state } = vm;
  const count = selectedCardIds.length;
  let promptText = '';
  switch (targetMode.mode) {
    case 'upTo':
      promptText = translator.t('ui.selection.upToCards', { max: targetMode.max, count });
      break;
    case 'exact':
      promptText = translator.t('ui.selection.exactCards', { exact: targetMode.max, count });
      break;
    case 'single':
      promptText = translator.t('ui.selection.singleCard', { exact: targetMode.max, count });
      break;
    case 'mirror':
      promptText = translator.t('ui.selection.mirrorCards', { exact: targetMode.max, count });
      break;
  }

  const targetCons = state.consumables.find((c) => c.uid === targetMode.consumableUid);
  const countValid = count >= targetMode.min && count <= targetMode.max;
  const engineValid = targetCons
    ? canUseConsumable(state, targetCons, selectedCardIds)
    : true;

  const banner = createEl('div', 'target-banner');
  const actions = createEl('div', 'target-banner__actions');
  actions.append(
    createButton(
      translator.t('ui.actions.cancel'),
      'ui-btn--compact ui-btn--danger',
      handlers.onCancelConsumableTargets,
    ),
    createButton(
      translator.t('ui.actions.confirm'),
      'ui-btn--compact ui-btn--primary',
      handlers.onConfirmConsumableTargets,
      !(countValid && engineValid),
    ),
  );
  banner.append(createEl('span', 'target-banner__text', promptText), actions);
  return banner;
}

/**
 * Проверяет блокировку кнопки «Сыграть» в фазе `playing`.
 */
function isPlayHandBlocked(
  vm: ScreenViewModel,
  cardById: Map<string, PlayingCard>,
  missingForcedSelection: boolean,
): boolean {
  const { state, selectedCardIds, isAnimating, consumableTargetMode } = vm;
  if (isAnimating) return true;
  if (consumableTargetMode && consumableTargetMode.mode !== 'none') return true;
  if (state.handsLeft <= 0) return true;
  if (selectedCardIds.length === 0 || selectedCardIds.length > 5) return true;
  if (missingForcedSelection) return true;

  const activeBoss = getActiveBossId(state);
  if (activeBoss === 'bl_psychic' && !state.activeBossDisabled && selectedCardIds.length !== 5) {
    return true;
  }

  // Наличие хотя бы одной валидной карты из колоды
  return selectedCardIds.every((id) => !cardById.has(id));
}

/**
 * Отрисовывает Пояс 4: веер карт руки, режим выбора целей и кнопки действий под рукой.
 */
function renderHandBelt(ctx: RenderContext): HTMLElement {
  const { vm, handlers, cardById, cleanups } = ctx;
  const { state, translator } = vm;
  const beltEl = createEl('section', 'belt belt--hand');
  beltEl.dataset.belt = 'hand';

  const isBoosterHand =
    state.phase === 'booster' &&
    state.booster !== null &&
    state.booster.drawnHandCardIds.length > 0;
  const showHand = state.phase === 'playing' || isBoosterHand;

  if (!showHand) {
    if (
      state.phase === 'blind_select' ||
      state.phase === 'cashout' ||
      state.phase === 'shop' ||
      state.phase === 'booster'
    ) {
      const actions = createEl('div', 'hand-actions--deck-only');
      actions.append(
        createButton(
          translator.t('ui.actions.deckButton', {
            remaining: state.drawPileIds.length,
            total: state.deck.length,
          }),
          'ui-btn--compact',
          handlers.onOpenDeckModal,
        ),
      );
      beltEl.append(actions);
    }
    return beltEl;
  }

  const targetBanner = renderTargetModeBanner(ctx);
  if (targetBanner) {
    beltEl.append(targetBanner);
  } else if (isBoosterHand) {
    beltEl.append(
      createEl('div', 'hand-zone-title', translator.t('ui.booster.handCardsTitle')),
    );
  }

  const handIds = isBoosterHand ? state.booster!.drawnHandCardIds : state.handIds;
  const fanEl = createEl('div', 'hand-fan');
  const midIndex = (handIds.length - 1) / 2;

  handIds.forEach((cardId, index) => {
    const card = cardById.get(cardId);
    if (!card) return;

    const selected = vm.selectedCardIds.includes(cardId);
    const highlighted = vm.highlightedHandCardId === cardId;
    const offsetFromCenter = index - midIndex;
    const angleDeg = offsetFromCenter * 1.8;
    const arcY = Math.abs(offsetFromCenter) * Math.abs(offsetFromCenter) * 0.9;

    const slot = createEl(
      'div',
      `hand-card-slot interactive-slot ${selected ? 'is-selected' : ''}`.trim(),
    );
    slot.setAttribute('role', 'button');
    slot.tabIndex = 0;
    slot.dataset.cardId = cardId;
    slot.dataset.zone = 'hand';
    slot.dataset.index = String(index);
    if (highlighted) {
      slot.dataset.highlighted = 'true';
    }
    slot.style.setProperty('--fan-angle', `${angleDeg.toFixed(2)}deg`);
    slot.style.setProperty('--fan-offset-y', `${arcY.toFixed(1)}px`);

    const frame = renderPlayingCardFrame({
      card,
      translator,
      selected,
      triggering: highlighted,
      interactive: true,
    });
    slot.append(frame);
    cleanups.push(attachCardTilt(frame));

    attachSlotGestures({
      el: slot,
      index,
      total: handIds.length,
      containerEl: fanEl,
      holdDelayMs: HAND_CARD_HOLD_MS,
      enableDrag: state.phase === 'playing' && !vm.isAnimating,
      onTap: () => {
        if (!vm.isAnimating) {
          handlers.onToggleCard(cardId);
        }
      },
      onHold: () => handlers.onInspectPlayingCard(card),
      onReorder: (from, to) => {
        const reordered = moveArrayItem(handIds, from, to);
        handlers.onCommand({ type: 'REORDER_HAND', cardIds: reordered });
      },
      registerCleanup: (fn) => cleanups.push(fn),
    });

    fanEl.append(slot);
  });

  beltEl.append(fanEl);

  if (state.phase === 'playing') {
    const targetModeActive =
      vm.consumableTargetMode != null && vm.consumableTargetMode.mode !== 'none';
    const activeBoss = getActiveBossId(state);
    const missingForcedSelection =
      activeBoss === 'bl_final_bell' &&
      !state.activeBossDisabled &&
      state.handIds.some((id) => {
        const c = cardById.get(id);
        return c?.forcedSelection === true && !vm.selectedCardIds.includes(id);
      });

    const playDisabled = isPlayHandBlocked(vm, cardById, missingForcedSelection);
    const discardDisabled =
      vm.isAnimating ||
      targetModeActive ||
      state.discardsLeft <= 0 ||
      vm.selectedCardIds.length === 0 ||
      vm.selectedCardIds.length > 5 ||
      missingForcedSelection;

    const actionsBar = createEl('div', 'hand-actions');
    actionsBar.append(
      createButton(
        translator.t('ui.actions.sortByRank'),
        'ui-btn--compact',
        () => handlers.onCommand({ type: 'SORT_HAND', by: 'rank' }),
        vm.isAnimating || handIds.length === 0,
      ),
      createButton(
        translator.t('ui.actions.sortBySuit'),
        'ui-btn--compact',
        () => handlers.onCommand({ type: 'SORT_HAND', by: 'suit' }),
        vm.isAnimating || handIds.length === 0,
      ),
      createButton(
        translator.t('ui.actions.playHand'),
        'ui-btn--primary',
        () => handlers.onCommand({ type: 'PLAY_HAND', cardIds: vm.selectedCardIds }),
        playDisabled,
      ),
      createButton(
        translator.t('ui.actions.discard'),
        'ui-btn--danger',
        () => handlers.onCommand({ type: 'DISCARD_CARDS', cardIds: vm.selectedCardIds }),
        discardDisabled,
      ),
      createButton(
        translator.t('ui.actions.deckButton', {
          remaining: state.drawPileIds.length,
          total: state.deck.length,
        }),
        'ui-btn--compact',
        handlers.onOpenDeckModal,
      ),
    );
    beltEl.append(actionsBar);
  }

  return beltEl;
}

/**
 * Отрисовывает полный 4-поясной портретный интерфейс Balite в заданном корневом элементе.
 */
export function renderRunView(
  root: HTMLElement,
  vm: ScreenViewModel,
  handlers: ScreenActionHandlers,
): ScreenRefs {
  const prevCleanup = rootCleanups.get(root);
  if (prevCleanup) {
    prevCleanup();
    rootCleanups.delete(root);
  }

  const cardById = new Map<string, PlayingCard>(
    vm.state.deck.map((card) => [card.id, card]),
  );
  const ctx: RenderContext = {
    vm,
    handlers,
    cardById,
    cleanups: [],
  };

  root.replaceChildren();

  const shell = createEl('div', 'run-shell');
  shell.dataset.phase = vm.state.phase;

  const hud = renderHudBelt(ctx);
  const inventoryBelt = renderInventoryBelt(ctx);
  const arena = renderArenaBelt(ctx);
  const handBelt = renderHandBelt(ctx);

  shell.append(hud.beltEl, inventoryBelt, arena.beltEl, handBelt);
  root.append(shell);

  rootCleanups.set(root, () => {
    for (const cleanup of ctx.cleanups) {
      cleanup();
    }
  });

  return {
    chipsEl: hud.chipsEl,
    multEl: hud.multEl,
    scoreEl: hud.scoreEl,
    dollarsEl: hud.dollarsEl,
    handTypeEl: hud.handTypeEl,
    popupLayerEl: arena.popupLayerEl,
    bannerEl: arena.bannerEl,
    arenaEl: arena.arenaEl,
  };
}
