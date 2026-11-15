import './screens.css';
import {
  BOSS_DEFINITIONS,
  DECK_IDS,
  canUseConsumable,
  evaluatePokerHand,
  getRelicDefinition,
  getRunEndSummary,
} from '../engine';
import type {
  BlindKind,
  BossId,
  CharterId,
  ConsumableId,
  ConsumableInstance,
  DeckId,
  Edition,
  GameCommand,
  HandType,
  MetaSave,
  PackOffer,
  PlayingCard,
  RelicInstance,
  RunState,
  ShopOffer,
  TagId,
} from '../engine/types';
import { getGuildRank, isDevOriginalTermsEnabled, type Translator } from '../i18n';
import {
  attachCardTilt,
  renderEntityCardFrame,
  renderPlayingCardFrame,
} from './cardFrame';
import { getRelicLocParams } from './inspector';
import { setTooltipData, type TooltipBadge, type TooltipData } from './tooltip';

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
  meta?: MetaSave;
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
  isDebug?: boolean;
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
  onOpenDebugPanel?: () => void;
  onSkipAnimation: () => void;
  onReturnToDeckSelect: () => void;
  onBackToMainMenu?: () => void;
}

/**
 * Ссылки на строки и итоговую кнопку экрана выплаты кэшаута для таймлайна накрутки.
 */
export interface CashoutScreenRefs {
  readonly key: string;
  readonly containerEl: HTMLElement;
  readonly claimBtnEl: HTMLButtonElement;
  readonly totalReward: number;
  readonly rows: ReadonlyArray<{
    readonly rowElement: HTMLElement;
    readonly valueElement: HTMLElement;
    readonly amount: number;
    readonly isTotal?: boolean;
  }>;
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
  formulaEl: HTMLElement;
  chipsPillEl: HTMLElement;
  multPillEl: HTMLElement;
  previewChips: number;
  previewMult: number;
  previewScore: number;
  previewTargetScore: number;
  cashout?: CashoutScreenRefs;
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
 * Возвращает краткую символьную метку медальона Стража.
 */
function getBlindEmblemLabel(kind: BlindKind): string {
  if (kind === 'small') return 'I';
  if (kind === 'big') return 'II';
  return '★';
}

/**
 * Возвращает относительный путь к спрайту жетона Стража (моба или босса).
 */
export function getBlindSpriteUrl(kind: BlindKind, bossId?: string | null, ante: number = 1): string | null {
  if (kind === 'boss') {
    if (bossId) {
      return `./sprites/blinds/${bossId}.webp`;
    }
    return null;
  }
  const safeAnte = Math.min(8, Math.max(1, ante));
  return `./sprites/blinds/ante_${safeAnte}_${kind}.webp`;
}

/**
 * Создаёт DOM-элемент жетона-эмблемы Стража со спрайтом или текстовым фоллбеком.
 */
export function createBlindEmblem(
  kind: BlindKind,
  bossId?: string | null,
  ante: number = 1,
  extraClass: string = '',
): HTMLElement {
  const emblem = createEl(
    'div',
    `blind-card__emblem blind-card__emblem--${kind} ${extraClass}`.trim(),
  );
  const spriteUrl = getBlindSpriteUrl(kind, bossId, ante);
  if (spriteUrl) {
    const img = createEl('img', 'blind-card__emblem-img') as HTMLImageElement;
    img.src = spriteUrl;
    img.alt = '';
    img.loading = 'eager';
    img.draggable = false;
    img.onerror = () => {
      img.remove();
      emblem.textContent = getBlindEmblemLabel(kind);
    };
    emblem.append(img);
  } else {
    emblem.textContent = getBlindEmblemLabel(kind);
  }
  return emblem;
}

/**
 * Добавляет бейдж Издания (Фольга, Голография, Призма, Теневой) в список бейджей тултипа.
 */
function appendEditionBadge(
  badges: TooltipBadge[],
  edition: Edition,
  translator: Translator,
): void {
  if (edition === 'base') return;
  const tone =
    edition === 'negative' ? 'purple' : edition === 'polychrome' ? 'gold' : 'blue';
  badges.push({
    label: translator.catalog.editions[edition].name,
    tone,
    kind: 'edition',
  });
}

/**
 * Формирует данные ховер-тултипа для игральной карты с жёсткой защитой при facing === 'back'.
 */
export function buildPlayingCardTooltip(
  card: PlayingCard,
  translator: Translator,
  price?: string,
): TooltipData {
  // Инвариант #1: для перевёрнутых карт ранг, масть и модификаторы строго скрываются
  if (card.facing === 'back') {
    return {
      title: '',
      kind: 'hidden',
      facing: 'back',
      hidden: true,
      hiddenTitle: translator.t('ui.tooltip.hiddenTitle'),
      hiddenDescription: translator.t('ui.tooltip.hiddenDescription'),
    };
  }

  const rankText = translator.getRankLabel(card.rank, false);
  const suitInfo = translator.catalog.suits[card.suit];
  const badges: TooltipBadge[] = [];
  const descParts: string[] = [];

  if (card.enhancement !== 'none') {
    const enhText = translator.catalog.enhancements[card.enhancement];
    badges.push({ label: enhText.name, tone: 'emerald', kind: 'enhancement' });
    descParts.push(enhText.description);
  }
  if (card.edition !== 'base') {
    appendEditionBadge(badges, card.edition, translator);
    descParts.push(translator.catalog.editions[card.edition].description);
  }
  if (card.seal !== 'none') {
    const sealText = translator.catalog.seals[card.seal];
    badges.push({ label: sealText.name, tone: 'gold', kind: 'seal' });
    descParts.push(sealText.description);
  }
  if (card.debuffed) {
    badges.push({
      label: translator.t('ui.hud.debuffedBadge'),
      tone: 'danger',
      kind: 'status',
    });
  }

  const baseChips = card.rank === 14 ? 11 : Math.min(10, card.rank);
  const totalBonus = card.bonusChips + card.permaBonus;
  const subtitle =
    totalBonus > 0
      ? `+${baseChips} (+${totalBonus}) ${translator.t('ui.hud.powerShort')}`
      : `+${baseChips} ${translator.t('ui.hud.powerShort')}`;

  return {
    title: `${rankText} (${suitInfo.symbol} ${suitInfo.name})`,
    subtitle,
    price,
    description: descParts.join(' • ') || undefined,
    badges,
    kind: 'playing',
    facing: 'front',
  };
}

/**
 * Формирует данные ховер-тултипа для Реликвии с текущими параметрами подстановки.
 */
function buildRelicTooltip(
  relic: RelicInstance,
  state: RunState,
  translator: Translator,
  price?: string,
): TooltipData {
  const def = getRelicDefinition(relic.id);
  const relicText = translator.getRelicText(relic.id, getRelicLocParams(relic, state));
  const badges: TooltipBadge[] = [];
  appendEditionBadge(badges, relic.edition, translator);
  if (relic.debuffed) {
    badges.push({
      label: translator.t('ui.hud.debuffedBadge'),
      tone: 'danger',
      kind: 'status',
    });
  }
  return {
    title: relicText.name,
    rarity: translator.t(`rarities.${def.rarity}`),
    price,
    description: relicText.description,
    badges,
    kind: 'relic',
  };
}

/**
 * Формирует данные ховер-тултипа для Расходника.
 */
function buildConsumableTooltip(
  consumable: ConsumableInstance,
  translator: Translator,
  price?: string,
): TooltipData {
  const consText = translator.getConsumableText(consumable.id);
  const badges: TooltipBadge[] = [];
  appendEditionBadge(badges, consumable.edition, translator);
  return {
    title: consText.name,
    subtitle: translator.catalog.consumableKinds[consumable.kind],
    price,
    description: consText.description,
    badges,
    kind: 'consumable',
  };
}

/**
 * Формирует данные ховер-тултипа для Грамоты Этапа.
 */
export function buildCharterTooltip(
  charterId: CharterId,
  translator: Translator,
  price?: string,
): TooltipData {
  const text = translator.getCharterText(charterId);
  return {
    title: text.name,
    subtitle: translator.t('ui.shop.charterTitle'),
    price,
    description: text.description,
    kind: 'charter',
  };
}

/**
 * Формирует данные ховер-тултипа для бустер-набора.
 */
function buildPackTooltip(pack: PackOffer, translator: Translator, price?: string): TooltipData {
  return {
    title: translator.getPackTitle(pack.type, pack.size),
    subtitle: translator.getPackSubtitle(pack.chooseCount, pack.totalCards),
    price,
    description: translator.catalog.packTypes[pack.type].description,
    kind: 'pack',
  };
}

/**
 * Формирует данные ховер-тултипа для Стража или Босса.
 */
export function buildBlindTooltip(
  kind: BlindKind,
  bossId: BossId | null,
  targetScore: number,
  reward: number,
  disabled: boolean,
  translator: Translator,
  ante?: number,
): TooltipData {
  const blindText = translator.getBlindText(kind, bossId, ante);
  const badges: TooltipBadge[] = [];
  if (disabled) {
    badges.push({
      label: translator.t('ui.hud.abilityDisabled'),
      tone: 'emerald',
      kind: 'status',
    });
  }
  return {
    title: blindText.name,
    subtitle: `${translator.t('ui.blindSelect.target', { score: targetScore })} • ${translator.t('ui.blindSelect.reward', { dollars: reward })}`,
    description: blindText.description,
    badges,
    kind: kind === 'boss' ? 'boss' : 'blind',
  };
}

/**
 * Формирует данные ховер-тултипа для Знака пропуска.
 */
export function buildTagTooltip(tagId: TagId, translator: Translator): TooltipData {
  const tagText = translator.getTagText(tagId);
  return {
    title: tagText.name,
    subtitle: translator.t('ui.hud.activeTags'),
    description: tagText.description,
    kind: 'tag',
  };
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
    handName: state.phase === 'playing' ? translator.t('ui.hud.previewHint') : '',
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
  const children = Array.from(containerEl.children).slice(0, total);
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
  formulaEl: HTMLElement;
  chipsPillEl: HTMLElement;
  multPillEl: HTMLElement;
  previewChips: number;
  previewMult: number;
  previewScore: number;
  previewTargetScore: number;
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
    const titleActions = createEl('div', 'hud-title-bar__actions');
    if (handlers.onBackToMainMenu) {
      const backBtn = createButton(
        translator.t('ui.actions.back'),
        'ui-btn--compact',
        handlers.onBackToMainMenu,
      );
      backBtn.dataset.action = 'back-to-menu';
      titleActions.append(backBtn);
    }
    const settingsBtn = createButton(
      translator.t('ui.actions.settings'),
      'ui-btn--compact',
      handlers.onOpenSettings,
    );
    titleActions.append(settingsBtn);
    if (vm.isDebug === true && handlers.onOpenDebugPanel) {
      const devBtn = createButton('DEV', 'ui-btn--compact hud-dev-btn', handlers.onOpenDebugPanel);
      devBtn.dataset.action = 'open-debug';
      titleActions.append(devBtn);
    }
    titleBar.append(brand, titleActions);

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
    const formulaEl = createEl('div');
    const chipsPillEl = createEl('div');
    const multPillEl = createEl('div');
    formulaEl.append(chipsPillEl, multPillEl);
    standby.append(chipsEl, multEl, scoreEl, dollarsEl, handTypeEl, formulaEl);

    beltEl.append(titleBar, standby);
    return {
      beltEl,
      chipsEl,
      multEl,
      scoreEl,
      dollarsEl,
      handTypeEl,
      formulaEl,
      chipsPillEl,
      multPillEl,
      previewChips: 0,
      previewMult: 0,
      previewScore: 0,
      previewTargetScore: 0,
    };
  }

  const grid = createEl('div', 'hud-grid');

  // Левая колонка: Ранг приключенца (или Анте в DEV) / Бой и карточка заказа
  const guardianCol = createEl('div', 'hud-guardian-col');
  const stageRow = createEl('div', 'hud-stage-row');
  const useOriginalAnte = isDevOriginalTermsEnabled();
  const stageText = useOriginalAnte
    ? state.endlessMode
      ? translator.t('ui.hud.endlessStage', { ante: state.ante })
      : translator.t('ui.hud.stageWithMax', {
          ante: state.ante,
          maxAnte: MAX_STANDARD_ANTE,
        })
    : state.endlessMode
      ? translator.t('ui.hud.endlessRank', { ante: state.ante })
      : translator.t('ui.hud.rankWithMax', {
          rank: getGuildRank(state.ante),
          ante: state.ante,
          maxAnte: MAX_STANDARD_ANTE,
        });
  stageRow.append(
    createEl('span', 'hud-stage-label', stageText),
    createEl('span', 'hud-round-pill', translator.t('ui.hud.round', { round: state.round })),
  );
  if (vm.isDebug === true && handlers.onOpenDebugPanel) {
    const devBtn = createButton('DEV', 'ui-btn--compact hud-dev-btn', handlers.onOpenDebugPanel);
    devBtn.dataset.action = 'open-debug';
    stageRow.append(devBtn);
  }

  const activeSlot = state.anteBlinds[state.currentBlindIndex] ?? state.anteBlinds[0];
  const bossSlot = state.anteBlinds[2];
  const inspectableBossId = activeSlot.bossId ?? bossSlot?.bossId ?? null;
  const isBossActive = activeSlot.kind === 'boss' && activeSlot.bossId !== null;
  const blindText = translator.getBlindText(activeSlot.kind, activeSlot.bossId, state.ante);

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
  const bossHeader = createEl('div', 'hud-boss-btn__header');
  bossHeader.append(
    createBlindEmblem(activeSlot.kind, activeSlot.bossId, state.ante, 'hud-boss-btn__emblem'),
    createEl('span', 'hud-boss-btn__title', blindText.name),
  );
  bossBtn.append(
    bossHeader,
    createEl('span', 'hud-boss-btn__desc', blindText.description),
  );
  if (isBossActive && state.activeBossDisabled) {
    bossBtn.append(
      createEl('span', 'hud-boss-btn__badge', translator.t('ui.hud.abilityDisabled')),
    );
  }
  setTooltipData(
    bossBtn,
    buildBlindTooltip(
      activeSlot.kind,
      activeSlot.bossId,
      activeSlot.targetScore,
      activeSlot.reward,
      isBossActive && state.activeBossDisabled,
      translator,
      state.ante,
    ),
  );

  // Заголовок-призыв выбора Стража для левой панели HUD в ПК-версии (phase === 'blind_select')
  const choosePrompt = createEl(
    'div',
    'hud-choose-prompt',
    translator.t('ui.blindSelect.chooseNextPrompt'),
  );

  // Вывеска МАГАЗИН для левой панели HUD в широком ПК-режиме (phase === 'shop')
  const shopSign = createEl('div', 'hud-shop-sign');
  shopSign.append(
    createEl('span', 'hud-shop-sign__title', translator.t('ui.hud.shopBannerTitle')),
    createEl('span', 'hud-shop-sign__sub', translator.t('ui.hud.shopBannerSubtitle')),
  );

  guardianCol.append(stageRow, choosePrompt, bossBtn, shopSign);

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

  const goldStat = createEl('div', 'hud-stat hud-stat--gold');
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

  const btnRow = createEl('div', 'hud-buttons-row hud-actions');
  const runInfoBtn = createButton(
    translator.t('ui.actions.runInfo'),
    'ui-btn--compact hud-run-info-btn',
    handlers.onOpenHandReference,
  );
  runInfoBtn.dataset.action = 'run-info';
  btnRow.append(
    runInfoBtn,
    createButton(
      translator.t('ui.actions.settings'),
      'ui-btn--compact',
      handlers.onOpenSettings,
    ),
  );

  metaCol.append(statsRow, btnRow);
  grid.append(guardianCol, calcCol, metaCol);
  beltEl.append(grid);

  return {
    beltEl,
    chipsEl,
    multEl,
    scoreEl,
    dollarsEl,
    handTypeEl,
    formulaEl: formula,
    chipsPillEl: chipsPill,
    multPillEl: multPill,
    previewChips: calc.chips,
    previewMult: calc.mult,
    previewScore: calc.totalScore,
    previewTargetScore: calc.targetScore,
  };
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
  const maxRelics = getEffectiveMaxRelics(state);
  const relicStrip = createEl('div', 'inventory-strip');
  const relicHead = createEl('div', 'inventory-strip__head');
  relicHead.append(
    createEl('span', undefined, translator.t('ui.hud.relics')),
    createEl(
      'span',
      'inventory-strip__count',
      translator.t('ui.hud.slotsCount', {
        count: state.relics.length,
        max: maxRelics,
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
    slot.dataset.zone = 'relic';
    slot.dataset.index = String(index);
    if (isHighlighted) {
      slot.dataset.highlighted = 'true';
    }

    // Передаём interactive: false, чтобы не вкладывать кнопку внутрь слота с role="button"
    const frame = renderEntityCardFrame({
      kind: 'relic',
      relic,
      translator,
      compact: true,
      interactive: false,
      triggering: isHighlighted,
    });
    slot.append(frame);
    setTooltipData(slot, buildRelicTooltip(relic, state, translator));
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

  // Контурные заглушки для свободных слотов Реликвий, чтобы игрок видел ёмкость панели
  const emptyRelicCount = Math.max(0, maxRelics - state.relics.length);
  for (let i = 0; i < emptyRelicCount; i += 1) {
    const placeholder = createEl('div', 'inventory-slot-placeholder');
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.dataset.emptySlot = 'relic';
    relicItemsEl.append(placeholder);
  }
  relicStrip.append(relicHead, relicItemsEl);

  // Лента Расходников
  const maxConsumables = getEffectiveMaxConsumables(state);
  const consStrip = createEl('div', 'inventory-strip');
  const consHead = createEl('div', 'inventory-strip__head');
  consHead.append(
    createEl('span', undefined, translator.t('ui.hud.consumables')),
    createEl(
      'span',
      'inventory-strip__count',
      translator.t('ui.hud.slotsCount', {
        count: state.consumables.length,
        max: maxConsumables,
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
    slot.dataset.zone = 'consumable';
    slot.dataset.index = String(index);

    // Передаём interactive: false, чтобы не вкладывать кнопку внутрь слота с role="button"
    const frame = renderEntityCardFrame({
      kind: 'consumable',
      consumable,
      translator,
      compact: true,
      interactive: false,
      selected: isTargeting,
    });
    slot.append(frame);
    setTooltipData(slot, buildConsumableTooltip(consumable, translator));
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

  // Контурные заглушки для свободных слотов Расходников
  const emptyConsumableCount = Math.max(0, maxConsumables - state.consumables.length);
  for (let i = 0; i < emptyConsumableCount; i += 1) {
    const placeholder = createEl('div', 'inventory-slot-placeholder');
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.dataset.emptySlot = 'consumable';
    consItemsEl.append(placeholder);
  }
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
      setTooltipData(badge, buildTagTooltip(tagId, translator));
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
  seedLabel.htmlFor = 'balite-seed-input';
  const seedInput = createEl('input', 'seed-bar__input');
  seedInput.id = 'balite-seed-input';
  seedInput.name = 'seed';
  seedInput.type = 'text';
  seedInput.autocomplete = 'off';
  seedInput.value = vm.seedInput;
  seedInput.placeholder = translator.t('ui.deckSelect.seedPlaceholder');
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

  const boardTitle = isDevOriginalTermsEnabled()
    ? translator.t('ui.blindSelect.title', { ante: state.ante })
    : translator.t('ui.blindSelect.rankTitle', {
        ante: state.ante,
        rank: getGuildRank(state.ante),
      });
  const header = createEl('div', 'arena-header');
  header.append(createEl('h2', 'arena-title', boardTitle));

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
    const card = createEl('div', `blind-card blind-card--${slot.status} blind-card--${slot.kind}`);
    card.dataset.blindKind = slot.kind;

    const blindText = translator.getBlindText(slot.kind, slot.bossId, state.ante);
    const statusText = translator.t(`ui.blindSelect.${slot.status}`);
    const isCurrent = slot.status === 'current';

    // Верхняя полоса карточки: кнопка «Сразиться» у текущего Стража или статус-пилюля
    const topBar = createEl('div', 'blind-card__top');
    if (isCurrent) {
      topBar.append(
        createButton(
          translator.t('ui.actions.battle'),
          'ui-btn--accent blind-card__battle-btn',
          () => handlers.onCommand({ type: 'SELECT_BLIND' }),
        ),
      );
    } else {
      topBar.append(createEl('div', 'blind-card__status-pill', statusText));
    }

    // Пилюля названия Стража
    const namePill = createEl('div', 'blind-card__name-pill', blindText.name);

    // Крупный круглый жетон-эмблема по центру
    const tokenWrap = createEl('div', 'blind-card__token');
    const emblem = createBlindEmblem(slot.kind, slot.bossId, state.ante);
    tokenWrap.append(emblem);
    const blindTooltip = buildBlindTooltip(
      slot.kind,
      slot.bossId,
      slot.targetScore,
      slot.reward,
      false,
      translator,
      state.ante,
    );
    setTooltipData(namePill, blindTooltip);
    setTooltipData(tokenWrap, blindTooltip);

    // Блок минимальных очков и награды
    const targetBox = createEl('div', 'blind-card__target-box');
    const targetRow = createEl('div', 'blind-card__target-value-row');
    targetRow.append(
      createEl('span', 'blind-card__score-gem', '◆'),
      createEl('strong', 'blind-card__target-number', String(slot.targetScore)),
    );
    targetBox.append(
      createEl('span', 'blind-card__target-caption', translator.t('ui.blindSelect.minScore')),
      targetRow,
      createEl(
        'span',
        'blind-card__reward',
        translator.t('ui.blindSelect.reward', { dollars: slot.reward }),
      ),
    );

    const bodyBlock = createEl('div', 'blind-card__body');
    bodyBlock.append(namePill, tokenWrap);

    if (slot.kind === 'boss' && slot.bossId !== null) {
      const bossId = slot.bossId;
      if (BOSS_DEFINITIONS[bossId].showdown) {
        bodyBlock.append(
          createEl('span', 'blind-card__badge', translator.t('ui.blindSelect.showdownBadge')),
        );
      }
      const inspectBossBtn = createEl('button', 'blind-card__boss-inspect interactive-slot');
      inspectBossBtn.type = 'button';
      inspectBossBtn.dataset.bossId = bossId;
      inspectBossBtn.textContent = blindText.description;
      inspectBossBtn.addEventListener('click', () => handlers.onInspectBoss(bossId, false));
      setTooltipData(inspectBossBtn, blindTooltip);
      bodyBlock.append(inspectBossBtn);
    }

    bodyBlock.append(targetBox);

    // Нижняя секция: у Малого/Старшего — разделитель ИЛИ + Знак + Пропустить; у Босса — повышение Этапа
    const footer = createEl('div', 'blind-card__footer');
    if (slot.kind !== 'boss' && slot.skipTagId !== null) {
      const tagId = slot.skipTagId;
      const tagTooltip = buildTagTooltip(tagId, translator);
      const tagText = translator.getTagText(tagId);

      footer.append(createEl('div', 'blind-card__or', translator.t('ui.blindSelect.orSeparator')));

      const skipRow = createEl('div', 'blind-card__skip-row');
      const tagIcon = createEl('div', 'blind-card__tag-icon');
      tagIcon.dataset.tagId = tagId;
      tagIcon.setAttribute('aria-label', tagText.name);
      tagIcon.append(createEl('span', 'blind-card__tag-glyph', '✦'));
      setTooltipData(tagIcon, tagTooltip);

      const skipBtn = createButton(
        translator.t('ui.blindSelect.skipButton'),
        'ui-btn--danger ui-btn--compact blind-card__skip-btn',
        () => handlers.onCommand({ type: 'SKIP_BLIND' }),
        !isCurrent,
      );
      skipBtn.dataset.action = 'skip-blind';
      setTooltipData(skipBtn, tagTooltip);

      skipRow.append(tagIcon, skipBtn);
      footer.append(skipRow);
    } else if (slot.kind === 'boss') {
      const stageAdvance = createEl('div', 'blind-card__stage-advance');
      stageAdvance.append(
        createEl(
          'strong',
          'blind-card__stage-advance-title',
          translator.t('ui.blindSelect.advanceStageTitle'),
        ),
        createEl(
          'span',
          'blind-card__stage-advance-desc',
          translator.t('ui.blindSelect.advanceStageDesc'),
        ),
      );
      footer.append(
        stageAdvance,
        createEl(
          'span',
          'blind-card__badge blind-card__boss-badge',
          translator.t('ui.blindSelect.cannotSkipBoss'),
        ),
      );
    }

    card.append(topBar, bodyBlock, footer);
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

    // Слот сам обрабатывает нажатие при !isAnimating, поэтому внутри card-frame кнопка не нужна
    const frame = renderPlayingCardFrame({
      card,
      translator: vm.translator,
      triggering: highlighted,
      disabled: shattered,
      interactive: false,
    });
    slot.append(frame);
    if (card.facing === 'back') {
      slot.dataset.tooltipFacing = 'back';
    }
    setTooltipData(slot, buildPlayingCardTooltip(card, vm.translator));
    cleanups.push(attachCardTilt(frame));

    if (!vm.isAnimating) {
      slot.setAttribute('role', 'button');
      slot.tabIndex = 0;
      slot.addEventListener('click', () => handlers.onInspectPlayingCard(card));
      slot.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          handlers.onInspectPlayingCard(card);
        }
      });
    }

    playZone.append(slot);
  }

  arenaEl.append(playZone);
}

/**
 * Отрисовывает экран детализации награды за победу над Стражем (фаза `cashout`).
 */
function renderCashoutArena(
  ctx: RenderContext,
  arenaEl: HTMLElement,
): CashoutScreenRefs | undefined {
  const { vm, handlers } = ctx;
  const { state, translator } = vm;
  const cashout = state.cashout;

  if (!cashout) return undefined;

  const container = createEl('div', 'cashout-container');

  const header = createEl('div', 'arena-header');
  header.append(createEl('h2', 'arena-title', translator.t('ui.cashout.title')));

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
  const rowRefs: Array<{
    readonly rowElement: HTMLElement;
    readonly valueElement: HTMLElement;
    readonly amount: number;
    readonly isTotal?: boolean;
  }> = [];

  for (const row of rows) {
    const rowEl = createEl(
      'div',
      `cashout-row ${row.total ? 'cashout-row--total' : row.amount === 0 ? 'cashout-row--zero' : ''}`.trim(),
    );
    const labelEl = createEl('span', 'cashout-row__label', row.label);
    const amountEl = createEl(
      'strong',
      'cashout-row__amount',
      translator.t('ui.hud.goldAmount', { dollars: row.amount }),
    );
    rowEl.append(labelEl, amountEl);
    list.append(rowEl);
    rowRefs.push({
      rowElement: rowEl,
      valueElement: amountEl,
      amount: row.amount,
      isTotal: row.total,
    });
  }

  const claimBtn = createButton(
    translator.t('ui.actions.claimCashout', { dollars: cashout.totalReward }),
    'ui-btn--accent claim-cashout-btn',
    () => handlers.onCommand({ type: 'CLAIM_CASHOUT' }),
  );
  container.append(header, list, claimBtn);
  arenaEl.append(container);

  const key = [
    state.ante,
    state.currentBlindIndex,
    cashout.blindReward,
    cashout.unusedHandsBonus,
    cashout.interestBonus,
    cashout.relicBonus,
    cashout.tagBonus,
    cashout.totalReward,
  ].join(':');

  return {
    key,
    containerEl: list,
    claimBtnEl: claimBtn,
    totalReward: cashout.totalReward,
    rows: rowRefs,
  };
}

/**
 * Форматирует ценник товара или бустера в лавке с поддержкой бесплатных позиций по купону.
 */
function formatShopPrice(cost: number, translator: Translator): string {
  return cost === 0
    ? translator.t('ui.shop.free')
    : translator.t('ui.hud.goldAmount', { dollars: cost });
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
  headerActions.append(
    createButton(
      translator.t('ui.actions.nextRound'),
      'ui-btn--primary ui-btn--compact shop-next-btn',
      () => handlers.onCommand({ type: 'NEXT_ROUND' }),
    ),
  );
  if (shop) {
    const rerollCost = shop.tempRerollCost ?? shop.rerollCost;
    headerActions.append(
      createButton(
        translator.t('ui.actions.rerollShop', { dollars: rerollCost }),
        'ui-btn--compact shop-reroll-btn',
        () => handlers.onCommand({ type: 'REROLL_SHOP' }),
        state.dollars < rerollCost,
      ),
    );
  }
  header.append(headerActions);
  arenaEl.append(header);

  if (!shop) return;

  const sections = createEl('div', 'shop-sections');

  // Полка товаров
  const shelfRow = createEl('div', 'shop-row shop-row--offers');
  shelfRow.append(createEl('span', 'shop-row__title', translator.t('ui.shop.shelfTitle')));
  const shelfItems = createEl('div', 'shop-items shop-offers-grid');

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

    // Не передаём price/free и interactive: кнопка-обёртка уже кликабельна и выводит цену снизу
    let frame: HTMLElement;
    let tooltip: TooltipData;
    const priceLabel = formatShopPrice(offer.cost, translator);
    if (offer.kind === 'relic') {
      frame = renderEntityCardFrame({
        kind: 'relic',
        relic: offer.relic,
        translator,
        compact: false,
        interactive: false,
        disabled: !affordable,
      });
      tooltip = buildRelicTooltip(offer.relic, state, translator, priceLabel);
    } else if (offer.kind === 'consumable') {
      frame = renderEntityCardFrame({
        kind: 'consumable',
        consumable: offer.consumable,
        translator,
        compact: false,
        interactive: false,
        disabled: !affordable,
      });
      tooltip = buildConsumableTooltip(offer.consumable, translator, priceLabel);
    } else {
      frame = renderPlayingCardFrame({
        card: offer.card,
        translator,
        compact: false,
        interactive: false,
        disabled: !affordable,
      });
      tooltip = buildPlayingCardTooltip(offer.card, translator, priceLabel);
    }
    setTooltipData(slotBtn, tooltip);
    cleanups.push(attachCardTilt(frame));
    slotBtn.append(
      frame,
      createEl(
        'span',
        'shop-slot-btn__price',
        priceLabel,
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
      compact: false,
      interactive: false,
      disabled: !affordable,
    });
    const charterPriceLabel = formatShopPrice(voucher.cost, translator);
    cleanups.push(attachCardTilt(frame));
    setTooltipData(voucherBtn, buildCharterTooltip(voucher.charterId, translator, charterPriceLabel));
    voucherBtn.append(
      frame,
      createEl(
        'span',
        'shop-slot-btn__price',
        charterPriceLabel,
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
  const packsList = createEl('div', 'shop-items shop-packs-grid');
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
      compact: false,
      interactive: false,
      disabled: !affordable,
    });
    const packPriceLabel = formatShopPrice(pack.cost, translator);
    cleanups.push(attachCardTilt(frame));
    setTooltipData(packBtn, buildPackTooltip(pack, translator, packPriceLabel));
    packBtn.append(
      frame,
      createEl(
        'span',
        'shop-slot-btn__price',
        packPriceLabel,
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

    let tooltip: TooltipData;

    if (choice.kind === 'relic') {
      frame = renderEntityCardFrame({
        kind: 'relic',
        relic: choice.relic,
        translator,
        compact: true,
        interactive: false,
        disabled: choice.picked,
      });
      nameText = translator.getRelicText(choice.relic.id).name;
      tooltip = buildRelicTooltip(choice.relic, state, translator);
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
        interactive: false,
        disabled: choice.picked,
      });
      nameText = translator.getConsumableText(choice.consumable.id).name;
      tooltip = buildConsumableTooltip(choice.consumable, translator);
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
        interactive: false,
        disabled: choice.picked,
      });
      nameText = choice.card.facing === 'back'
        ? translator.t('ui.tooltip.hiddenTitle')
        : frame.getAttribute('aria-label') ?? '';
      tooltip = buildPlayingCardTooltip(choice.card, translator);
      if (choice.card.facing === 'back') {
        slot.dataset.tooltipFacing = 'back';
      }
    }

    setTooltipData(slot, tooltip);
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
  const { vm, handlers, cleanups } = ctx;
  const { state, translator, meta } = vm;
  const summary = getRunEndSummary(state, meta);

  const card = createEl(
    'div',
    `run-end-card ${isVictory ? 'run-end-card--victory' : 'run-end-card--defeat'}`,
  );
  const cardHeader = createEl('div', 'run-end-card__header');
  cardHeader.append(
    createEl(
      'h2',
      'arena-title run-end-card__title',
      translator.t(isVictory ? 'ui.runEnd.victoryTitle' : 'ui.runEnd.defeatTitle'),
    ),
    createEl(
      'p',
      'hud-title-bar__sub run-end-card__subtitle',
      translator.t(isVictory ? 'ui.runEnd.victorySubtitle' : 'ui.runEnd.defeatSubtitle'),
    ),
  );
  card.append(cardHeader);

  const bestHandLabel = summary.bestHandType
    ? `${summary.bestHandScore} (${translator.getHandText(summary.bestHandType).name})`
    : String(summary.bestHandScore);
  const mostPlayedLabel = summary.mostPlayedHand
    ? `${translator.getHandText(summary.mostPlayedHand.handType).name} (${summary.mostPlayedHand.count})`
    : translator.t('ui.runEnd.none', { count: 0 });

  const statRows: ReadonlyArray<{
    readonly label: string;
    readonly value: string;
    readonly isRecord?: boolean;
  }> = [
    {
      label: translator.t('ui.runEnd.bestHandScore'),
      value: bestHandLabel,
      isRecord: summary.records.bestHandScore,
    },
    {
      label: translator.t('ui.runEnd.mostPlayedHand'),
      value: mostPlayedLabel,
    },
    {
      label: translator.t('ui.runEnd.cardsPlayed'),
      value: String(summary.cardsPlayed),
    },
    {
      label: translator.t('ui.runEnd.cardsDiscarded'),
      value: String(summary.cardsDiscarded),
    },
    {
      label: translator.t('ui.runEnd.cardsPurchased'),
      value: String(summary.cardsPurchased),
    },
    {
      label: translator.t('ui.runEnd.rerollsCount'),
      value: String(summary.rerollsCount),
    },
    {
      label: translator.t('ui.runEnd.newDiscoveries'),
      value: String(summary.newDiscoveries),
    },
    {
      label: translator.t('ui.runEnd.finalStage'),
      value: isDevOriginalTermsEnabled()
        ? String(summary.ante)
        : `${getGuildRank(summary.ante)} (${summary.ante}/${MAX_STANDARD_ANTE})`,
      isRecord: summary.records.highestAnte,
    },
    {
      label: translator.t('ui.runEnd.finalRound'),
      value: String(summary.round),
      isRecord: summary.records.highestRound,
    },
  ];

  const statsGrid = createEl('div', 'run-end-stats');
  for (const item of statRows) {
    const row = createEl('div', 'run-end-stat');
    const valueWrap = createEl('span', 'run-end-stat__value-wrap');
    valueWrap.append(createEl('strong', undefined, item.value));
    if (item.isRecord) {
      valueWrap.append(
        createEl('span', 'run-end-record-badge', translator.t('ui.runEnd.newRecordBadge')),
      );
    }
    row.append(createEl('span', undefined, item.label), valueWrap);
    statsGrid.append(row);
  }

  // Блок Стража (кем побеждён / кого одолел игрок) с иконкой
  const blindText = translator.getBlindText(summary.defeatedBy.kind, summary.defeatedBy.bossId, summary.ante);
  const victimBox = createEl('div', 'run-end-victim-box');
  const victimLeft = createEl('div', 'run-end-victim-box__left');
  victimLeft.append(
    createEl(
      'span',
      'run-end-victim-box__label',
      translator.t(isVictory ? 'ui.runEnd.clearedGuardian' : 'ui.runEnd.defeatedBy'),
    ),
    createEl('span', 'run-end-victim-box__name', blindText.name),
  );
  victimBox.append(
    victimLeft,
    createBlindEmblem(
      summary.defeatedBy.kind,
      summary.defeatedBy.bossId,
      summary.ante,
    ),
  );

  // Строка кода забега (Seed) с кнопкой Копия
  const seedRow = createEl('div', 'run-end-seed-row');
  const seedInfo = createEl('div', 'run-end-seed-row__info');
  seedInfo.append(
    createEl('span', undefined, translator.t('ui.runEnd.runSeed')),
    createEl('code', 'run-end-seed-row__code', summary.seed),
  );
  let copyTimer: ReturnType<typeof setTimeout> | null = null;
  const copyBtn = createButton(
    translator.t('ui.actions.copy'),
    'ui-btn--compact ui-btn--accent',
    () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(summary.seed).catch(() => undefined);
      }
      copyBtn.textContent = translator.t('ui.actions.copied');
      copyBtn.dataset.copied = 'true';
      if (copyTimer !== null) {
        clearTimeout(copyTimer);
      }
      copyTimer = setTimeout(() => {
        copyTimer = null;
        copyBtn.textContent = translator.t('ui.actions.copy');
        delete copyBtn.dataset.copied;
      }, 1500);
    },
  );
  copyBtn.dataset.action = 'copy-seed';
  cleanups.push(() => {
    if (copyTimer !== null) {
      clearTimeout(copyTimer);
      copyTimer = null;
    }
  });
  seedRow.append(seedInfo, copyBtn);

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
        translator.t('ui.actions.newRun'),
        'ui-btn--primary',
        handlers.onStartRun,
      ),
    );
  }
  if (handlers.onBackToMainMenu) {
    actions.append(
      createButton(
        translator.t('ui.actions.mainMenu'),
        '',
        handlers.onBackToMainMenu,
      ),
    );
  }

  card.append(statsGrid, victimBox, seedRow, actions);
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
  cashout?: CashoutScreenRefs;
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

  let cashoutRefs: CashoutScreenRefs | undefined;

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
      cashoutRefs = renderCashoutArena(ctx, arenaEl);
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
  return { beltEl, arenaEl, popupLayerEl, bannerEl, cashout: cashoutRefs };
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

  // Наличие хотя бы одной валидной карты из колоды
  return selectedCardIds.every((id) => !cardById.has(id));
}

/**
 * Создаёт визуальную стопку карт Колоды рубашкой вверх с количеством оставшихся/всех карт.
 */
function createDeckStackButton(
  state: RunState,
  translator: Translator,
  onOpenDeckModal: () => void,
): HTMLButtonElement {
  const remaining = state.drawPileIds.length;
  const total = state.deck.length;
  const label = translator.t('ui.actions.deckButton', { remaining, total });

  const btn = createEl('button', 'ui-btn ui-btn--compact hand-actions__deck deck-stack-btn');
  btn.type = 'button';
  btn.dataset.deckId = state.deckId;
  btn.dataset.deckStack = 'true';
  btn.dataset.action = 'open-deck';
  btn.setAttribute('aria-label', label);
  btn.addEventListener('click', onOpenDeckModal);

  const pile = createEl('span', 'deck-stack__pile');
  pile.setAttribute('aria-hidden', 'true');
  const layerBack = createEl('span', 'deck-stack__layer deck-stack__layer--back');
  const layerMid = createEl('span', 'deck-stack__layer deck-stack__layer--mid');
  const topCard = createEl('span', 'deck-stack__top');
  topCard.append(createEl('span', 'deck-stack__rune', '◆'));
  pile.append(layerBack, layerMid, topCard);

  const count = createEl('span', 'deck-stack__count', `${remaining}/${total}`);
  btn.append(pile, count);
  return btn;
}

/**
 * Отрисовывает Пояс 4: веер карт руки, режим выбора целей и кнопки действий под рукой.
 */
function renderHandBelt(ctx: RenderContext): HTMLElement {
  const { vm, handlers, cardById, cleanups } = ctx;
  const { state, translator } = vm;
  const beltEl = createEl('section', 'belt belt--hand hand-belt');
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
      actions.append(createDeckStackButton(state, translator, handlers.onOpenDeckModal));
      beltEl.append(actions);
    } else {
      beltEl.classList.add('belt--empty');
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
  const fanEl = createEl('div', 'hand-fan hand-cards');
  const midIndex = (handIds.length - 1) / 2;
  const isDenseHand = handIds.length > 8;
  const angleStep = isDenseHand ? 1.2 : 1.7;
  const arcFactor = isDenseHand ? 0.55 : 0.85;
  // Адаптивное перекрытие карт, чтобы 8–10+ карт веера помещались без горизонтального и вертикального скроллбаров
  const extraOverlapPx =
    handIds.length <= 6
      ? 0
      : Math.min(34, (handIds.length - 6) * 4 + Math.max(0, handIds.length - 10) * 2);
  fanEl.style.setProperty('--hand-extra-overlap', `${extraOverlapPx}px`);

  handIds.forEach((cardId, index) => {
    const card = cardById.get(cardId);
    if (!card) return;

    const selected = vm.selectedCardIds.includes(cardId);
    const highlighted = vm.highlightedHandCardId === cardId;
    const offsetFromCenter = index - midIndex;
    const angleDeg = offsetFromCenter * angleStep;
    const arcY = Math.abs(offsetFromCenter) * Math.abs(offsetFromCenter) * arcFactor;

    const slot = createEl(
      'div',
      `hand-card-slot interactive-slot ${selected ? 'is-selected' : ''}`.trim(),
    );
    slot.setAttribute('role', 'button');
    slot.tabIndex = 0;
    slot.setAttribute('aria-pressed', String(selected));
    slot.dataset.cardId = cardId;
    slot.dataset.zone = 'hand';
    slot.dataset.index = String(index);
    if (highlighted) {
      slot.dataset.highlighted = 'true';
    }
    slot.style.setProperty('--fan-angle', `${angleDeg.toFixed(2)}deg`);
    slot.style.setProperty('--fan-offset-y', `${arcY.toFixed(1)}px`);

    // Слот сам является интерактивной картой руки, поэтому card-frame рендерим с interactive: false
    const frame = renderPlayingCardFrame({
      card,
      translator,
      selected,
      triggering: highlighted,
      interactive: false,
    });
    slot.append(frame);
    if (card.facing === 'back') {
      slot.dataset.tooltipFacing = 'back';
    }
    setTooltipData(slot, buildPlayingCardTooltip(card, translator));
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

    // Подсвечиваем активный режим сортировки руки по состоянию забега (по умолчанию 'rank')
    const activeSortMode = state.handSortMode ?? 'rank';
    const sortRankBtn = createButton(
      translator.t('ui.actions.sortByRank'),
      `ui-btn--compact hand-actions__sort-rank ${activeSortMode === 'rank' ? 'is-active' : ''}`.trim(),
      () => handlers.onCommand({ type: 'SORT_HAND', by: 'rank' }),
      vm.isAnimating || handIds.length === 0,
    );
    sortRankBtn.setAttribute('aria-pressed', activeSortMode === 'rank' ? 'true' : 'false');

    const sortSuitBtn = createButton(
      translator.t('ui.actions.sortBySuit'),
      `ui-btn--compact hand-actions__sort-suit ${activeSortMode === 'suit' ? 'is-active' : ''}`.trim(),
      () => handlers.onCommand({ type: 'SORT_HAND', by: 'suit' }),
      vm.isAnimating || handIds.length === 0,
    );
    sortSuitBtn.setAttribute('aria-pressed', activeSortMode === 'suit' ? 'true' : 'false');

    const actionsBar = createEl('div', 'hand-actions');
    actionsBar.append(
      sortRankBtn,
      sortSuitBtn,
      createButton(
        translator.t('ui.actions.playHand'),
        'ui-btn--primary hand-actions__play',
        () => handlers.onCommand({ type: 'PLAY_HAND', cardIds: vm.selectedCardIds }),
        playDisabled,
      ),
      createButton(
        translator.t('ui.actions.discard'),
        'ui-btn--danger hand-actions__discard',
        () => handlers.onCommand({ type: 'DISCARD_CARDS', cardIds: vm.selectedCardIds }),
        discardDisabled,
      ),
      createDeckStackButton(state, translator, handlers.onOpenDeckModal),
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

  const isBoosterHand =
    vm.state.phase === 'booster' &&
    vm.state.booster !== null &&
    vm.state.booster.drawnHandCardIds.length > 0;
  const hasHandCards = vm.state.phase === 'playing' || isBoosterHand;

  const shell = createEl(
    'div',
    `run-shell ${hasHandCards ? '' : 'run-shell--compact-hand'}`.trim(),
  );
  shell.dataset.phase = vm.state.phase;
  shell.dataset.hasHand = hasHandCards ? 'true' : 'false';

  const hud = renderHudBelt(ctx);
  const inventoryBelt = renderInventoryBelt(ctx);
  const arena = renderArenaBelt(ctx);
  const handBelt = renderHandBelt(ctx);

  if (handBelt.childElementCount === 0) {
    shell.dataset.emptyHandBelt = 'true';
  }

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
    formulaEl: hud.formulaEl,
    chipsPillEl: hud.chipsPillEl,
    multPillEl: hud.multPillEl,
    previewChips: hud.previewChips,
    previewMult: hud.previewMult,
    previewScore: hud.previewScore,
    previewTargetScore: hud.previewTargetScore,
    cashout: arena.cashout,
  };
}
