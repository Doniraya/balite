import { createHybridBaliteAudio } from '../audio/hybridAudio';
import type { BaliteAudioController } from '../audio/synth';
import {
  CELESTIAL_IDS,
  DECK_IDS,
  RUNE_IDS,
  SCROLL_IDS,
  advanceActiveRunTracker,
  applyDebugCardMods,
  applyDebugVoucher,
  canUseConsumable,
  collectRunMetaDiscoveries,
  createInitialMetaSave,
  createInitialRunState,
  createPlayerSaveData,
  dispatch,
  forceDebugBlindWin,
  forceDebugRunEnd,
  giveDebugConsumable,
  giveDebugRelic,
  hasAnyUnseenCollectionItems,
  normalizePackIdForCollection,
  resetCollection,
  restoreRunStateFromSnapshot,
  serializeRunStateToSnapshot,
  setDebugResources,
  unlockAllCollection,
  updateMetaStatsFromRunState,
  type CollectionCategory,
  type RunMetaDiscoveriesExtras,
} from '../engine';
import type {
  AnimationSpeed,
  BossId,
  CharterId,
  ConsumableId,
  ConsumableKind,
  CrtMode,
  DeckId,
  Edition,
  GameCommand,
  GameSettings,
  HandType,
  MetaSave,
  PackOffer,
  PlayerSaveData,
  PlayingCard,
  RunPhase,
  RunSnapshot,
  RunState,
  ShopOffer,
  TagId,
  TraceEvent,
} from '../engine/types';
import {
  createTranslator,
  isDevOriginalTermsEnabled,
  readStoredDevOriginalTermsFlag,
  setDevOriginalTermsEnabled,
  syncDocumentLanguage,
  type Translator,
} from '../i18n';
import {
  createBalitePlatformBridge,
  loadBaliteSave,
  persistBaliteSave,
} from '../platform/baliteSave';
import type { PlatformBridge } from '../platform/types';
import { createBackdropCanvas, type BackdropController, type BackdropMood } from './backdropCanvas';
import { createCardAnimator, type CardAnimatorOptions } from './cardAnimator';
import { initCardTiltController, type CardTiltController, type CardTiltOptions } from './cardTilt';
import {
  getConsumableTargetRequirement,
  renderInspectorOverlay,
  type InspectTarget,
} from './inspector';
import {
  renderDebugPanel,
  type DebugPanelTab,
  type DebugSpawnFilter,
  type DebugSystemAction,
} from './debugPanel';
import {
  renderDeckModal,
  renderHandReferenceModal,
  renderSettingsModal,
  type SettingsModalTab,
} from './modals';
import { renderCollectionModal } from './collection';
import { APP_VERSION, renderMainMenu } from './mainMenu';
import {
  createCashoutTimeline,
  createNumberRoller,
  type CashoutTimelineController,
  type NumberRollerController,
  type NumberRollerOptions,
} from './numberRoller';
import {
  createParticleCanvas,
  type ParticleCanvasController,
  type ParticleCanvasOptions,
} from './particleCanvas';
import {
  renderRunView,
  type ScreenActionHandlers,
  type ScreenRefs,
  type ScreenViewModel,
} from './screens';
import { initHoverTooltip, type HoverTooltipController } from './tooltip';
import {
  computeScoreFlameIntensity,
  createScoreFlame,
  type ScoreFlameController,
  type ScoreFlameOptions,
} from './scoreFlame';
import {
  createTutorialOverlay,
  type TutorialOverlayController,
} from './tutorialOverlay';
import {
  getTutorialSteps,
} from './tutorialSteps';
import {
  playTraceEvents,
  type TraceJuiceTarget,
  type TracePlayerHandle,
  type TracePopupPayload,
} from './tracePlayer';

/**
 * Стандартный интервал между показами межстраничной рекламы (3 минуты).
 */
const DEFAULT_AD_COOLDOWN_MS = 180_000;

/**
 * Алфавит для генерации читаемых случайных кодов забега без похожих символов.
 */
const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const CELESTIAL_ID_SET = new Set<string>(CELESTIAL_IDS);
const SCROLL_ID_SET = new Set<string>(SCROLL_IDS);
const RUNE_ID_SET = new Set<string>(RUNE_IDS);

function resolveConsumableKind(consumableId: ConsumableId): ConsumableKind {
  if (CELESTIAL_ID_SET.has(consumableId)) return 'celestial';
  if (RUNE_ID_SET.has(consumableId)) return 'rune';
  if (SCROLL_ID_SET.has(consumableId)) return 'scroll';
  return 'scroll';
}

/**
 * Публичный дескриптор смонтированного приложения Balite.
 */
export interface BaliteAppHandle {
  readonly readyPromise: Promise<void>;
  getState(): RunState;
  getSaveData(): PlayerSaveData;
  getTutorialController?(): TutorialOverlayController;
  destroy(): void;
}

/**
 * Опции инъекции зависимостей для детерминированного запуска и тестирования приложения.
 */
export interface MountBaliteAppOptions {
  bridge?: PlatformBridge<PlayerSaveData>;
  audio?: BaliteAudioController;
  scheduleTimeout?: typeof setTimeout;
  clearScheduledTimeout?: typeof clearTimeout;
  initialNowMs?: () => number;
  adCooldownMs?: number;
  cardAnimatorOptions?: Omit<CardAnimatorOptions, 'flightLayer' | 'getSpeed'>;
  cardTiltOptions?: Omit<CardTiltOptions, 'container'>;
  scoreFlameOptions?: Omit<ScoreFlameOptions, 'container' | 'chipsAnchor' | 'multAnchor'>;
  numberRollerOptions?: Partial<
    Pick<NumberRollerOptions, 'now' | 'requestFrame' | 'cancelFrame' | 'reducedMotion' | 'durationMs'>
  >;
  particleCanvasOptions?: Partial<Omit<ParticleCanvasOptions, 'container' | 'speed'>>;
  tutorialOverlay?: TutorialOverlayController;
}

/**
 * Активный режим выбора целевых карт в руке для Свитка или Руны.
 */
interface ConsumableTargetModeState {
  readonly consumableUid: string;
  readonly consumableId: ConsumableId;
  readonly min: number;
  readonly max: number;
  readonly mode: 'none' | 'upTo' | 'exact' | 'single' | 'mirror';
}

/**
 * Тип открытого полноэкранного модального окна поверх сцены.
 */
type ActiveModalKind = 'hand_reference' | 'deck' | 'settings' | 'debug' | 'collection';

/**
 * Цветовая карта импульсов фона по типам всплывающих событий TracePlayer.
 */
const POPUP_COLORS: Readonly<Record<TracePopupPayload['kind'], string>> = {
  chips: '#60a5fa',
  mult: '#f87171',
  xmult: '#e879f9',
  dollars: '#f5b942',
  shatter: '#93c5fd',
  debuff: '#fb7185',
  level: '#4ade80',
  boss: '#ef4444',
  tag: '#34d399',
};

/**
 * Генерирует случайный 8-символьный код нового забега.
 */
function createRandomSeed(): string {
  let result = '';
  for (let i = 0; i < 8; i += 1) {
    const idx = Math.floor(Math.random() * SEED_ALPHABET.length);
    result += SEED_ALPHABET[idx] ?? 'A';
  }
  return result;
}

/**
 * Создаёт начальное состояние стартового экрана выбора колоды.
 */
function createDeckSelectState(deckId: DeckId, seed: string): RunState {
  return {
    ...createInitialRunState(deckId, seed),
    phase: 'deck_select',
  };
}

/**
 * Проверяет, находится ли забег в активной игровой фазе (не меню и не итог забега).
 */
function isActiveRunPhase(phase: RunPhase): boolean {
  return (
    phase === 'blind_select' ||
    phase === 'playing' ||
    phase === 'cashout' ||
    phase === 'shop' ||
    phase === 'booster'
  );
}

/**
 * Проверяет, завершён ли забег победой или поражением.
 */
function isTerminalRunPhase(phase: RunPhase): boolean {
  return phase === 'victory' || phase === 'game_over';
}

/**
 * Возвращает настроение процедурного фона для текущего состояния забега.
 */
function resolveBackdropMood(state: RunState): BackdropMood {
  switch (state.phase) {
    case 'deck_select':
      return 'menu';
    case 'shop':
    case 'booster':
    case 'cashout':
      return 'shop';
    case 'victory':
      return 'victory';
    case 'game_over':
      return 'defeat';
    case 'blind_select':
    case 'playing': {
      const slot = state.anteBlinds[state.currentBlindIndex];
      return slot?.kind === 'boss' ? 'boss' : 'battle';
    }
  }
}

/**
 * Вычисляет максимальное число слотов Реликвий с учётом Негативных экземпляров.
 */
function getEffectiveMaxRelics(state: RunState): number {
  let negativeCount = 0;
  for (const relic of state.relics) {
    if (relic.edition === 'negative') {
      negativeCount += 1;
    }
  }
  return state.maxRelics + negativeCount;
}

/**
 * Вычисляет максимальное число слотов расходников с учётом Негативных экземпляров.
 */
function getEffectiveMaxConsumables(state: RunState): number {
  let negativeCount = 0;
  for (const item of state.consumables) {
    if (item.edition === 'negative') {
      negativeCount += 1;
    }
  }
  return state.maxConsumables + negativeCount;
}

/**
 * Объединяет существующий список открытых идентификаторов с новыми без дубликатов.
 */
function appendUniqueIds<T extends string>(base: readonly T[], extra: readonly T[]): T[] {
  const seen = new Set<T>(base);
  const next = [...base];
  for (const item of extra) {
    if (!seen.has(item)) {
      seen.add(item);
      next.push(item);
    }
  }
  return next;
}

/**
 * Обновляет мета-прогресс игрока по итогам команды или завершения забега.
 */
function updateMetaFromRunState(
  meta: MetaSave,
  state: RunState,
  flags: {
    runStarted?: boolean;
    handPlayed?: boolean;
    runWon?: boolean;
    runLost?: boolean;
    dollarsSpentDelta?: number;
    shopRerollsDelta?: number;
    celestialsUsedDelta?: number;
    extras?: RunMetaDiscoveriesExtras;
    settingsPatch?: Partial<GameSettings>;
    revision: number;
    updatedAt: number;
  },
): MetaSave {
  // Собираем все 8 категорий открытий коллекции из состояния забега и событийных дополнений
  const discoveries = collectRunMetaDiscoveries(state, flags.extras);

  let unlockedDecks = [...meta.unlockedDecks];
  if (flags.runWon) {
    for (const deckId of DECK_IDS) {
      if (!unlockedDecks.includes(deckId)) {
        unlockedDecks = [...unlockedDecks, deckId];
        break;
      }
    }
  }

  const nextMetaWithoutTracker: MetaSave = {
    ...meta,
    revision: flags.revision,
    updatedAt: flags.updatedAt,
    settings: flags.settingsPatch
      ? { ...meta.settings, ...flags.settingsPatch }
      : meta.settings,
    unlockedDecks,
    discoveredRelics: appendUniqueIds(meta.discoveredRelics, discoveries.discoveredRelics),
    discoveredConsumables: appendUniqueIds(
      meta.discoveredConsumables,
      discoveries.discoveredConsumables,
    ),
    discoveredCharters: appendUniqueIds(meta.discoveredCharters, discoveries.discoveredCharters),
    discoveredBosses: appendUniqueIds(meta.discoveredBosses, discoveries.discoveredBosses),
    discoveredTags: appendUniqueIds(meta.discoveredTags ?? [], discoveries.discoveredTags),
    discoveredMonsters: appendUniqueIds(
      meta.discoveredMonsters ?? [],
      discoveries.discoveredMonsters,
    ),
    discoveredPacks: appendUniqueIds(meta.discoveredPacks ?? [], discoveries.discoveredPacks),
    discoveredEditions: appendUniqueIds(
      meta.discoveredEditions ?? [],
      discoveries.discoveredEditions,
    ),
    stats: updateMetaStatsFromRunState(meta.stats, state, {
      runStarted: flags.runStarted,
      handPlayed: flags.handPlayed,
      runWon: flags.runWon,
      runLost: flags.runLost,
      dollarsSpentDelta: flags.dollarsSpentDelta,
      shopRerollsDelta: flags.shopRerollsDelta,
      celestialsUsedDelta: flags.celestialsUsedDelta,
    }),
    ...(flags.settingsPatch?.tutorialCompleted !== undefined
      ? { tutorialCompleted: flags.settingsPatch.tutorialCompleted }
      : {}),
    ...(flags.settingsPatch?.tutorialStep !== undefined
      ? { tutorialStep: flags.settingsPatch.tutorialStep }
      : {}),
  };

  return {
    ...nextMetaWithoutTracker,
    activeRunTracker: advanceActiveRunTracker(
      meta,
      nextMetaWithoutTracker,
      Boolean(flags.runStarted),
    ),
  };
}

/**
 * Вычисляет дельты накопительной статистики и событийные дополнения коллекции по выполненной команде.
 */
function extractCommandMetaTracking(
  prevState: RunState,
  command: GameCommand,
  nextState: RunState,
): {
  dollarsSpentDelta: number;
  shopRerollsDelta: number;
  celestialsUsedDelta: number;
  extras?: RunMetaDiscoveriesExtras;
} {
  const dollarsSpentDelta =
    command.type === 'BUY_SHOP_OFFER' ||
    command.type === 'REROLL_SHOP' ||
    command.type === 'BUY_CHARTER' ||
    command.type === 'OPEN_PACK'
      ? Math.max(0, prevState.dollars - nextState.dollars)
      : 0;

  const shopRerollsDelta =
    command.type === 'REROLL_SHOP'
      ? Math.max(0, nextState.stats.rerollsCount - prevState.stats.rerollsCount)
      : 0;

  const extraConsumableIds: ConsumableId[] = [];
  const extraPackIds: string[] = [];
  const extraTagIds: TagId[] = [];
  let celestialsUsedDelta = 0;

  let appliedConsumableId: ConsumableId | null = null;
  if (command.type === 'USE_CONSUMABLE') {
    const used = prevState.consumables.find((item) => item.uid === command.consumableUid);
    if (used && !nextState.consumables.some((item) => item.uid === used.uid)) {
      appliedConsumableId = used.id;
    }
  } else if (command.type === 'BUY_SHOP_OFFER' && command.useImmediately) {
    const offer = prevState.shop?.offers.find((item) => item.uid === command.offerUid);
    if (
      offer?.kind === 'consumable' &&
      !offer.sold &&
      nextState.shop?.offers.find((item) => item.uid === offer.uid)?.sold === true
    ) {
      appliedConsumableId = offer.consumable.id;
    }
  } else if (command.type === 'PICK_BOOSTER_ITEM') {
    const choice = prevState.booster?.choices.find((item) => item.uid === command.choiceUid);
    if (choice?.kind === 'consumable' && !choice.picked) {
      const nextChoice = nextState.booster?.choices.find((item) => item.uid === choice.uid);
      if (
        nextState.booster !== prevState.booster &&
        (!nextChoice || nextChoice.picked === true)
      ) {
        appliedConsumableId = choice.consumable.id;
      }
    }
  }

  if (appliedConsumableId !== null) {
    extraConsumableIds.push(appliedConsumableId);
    if (resolveConsumableKind(appliedConsumableId) === 'celestial') {
      celestialsUsedDelta = 1;
    }
  }

  if (command.type === 'OPEN_PACK') {
    const pack = prevState.shop?.packs.find(
      (item) => item.uid === command.packUid && !item.purchased,
    );
    if (
      pack &&
      (nextState.phase === 'booster' ||
        nextState.shop?.packs.find((item) => item.uid === pack.uid)?.purchased === true)
    ) {
      // Передаём пару (type, size) с приоритетом над сырым packId (в тестах встречается формат без префикса)
      const normalizedPackId =
        normalizePackIdForCollection(pack.type, pack.size) ??
        normalizePackIdForCollection(pack.packId);
      if (normalizedPackId !== null) {
        extraPackIds.push(normalizedPackId);
      }
    }
  } else if (
    (command.type === 'PICK_BOOSTER_ITEM' || command.type === 'SKIP_BOOSTER') &&
    prevState.booster &&
    nextState !== prevState
  ) {
    // На случай закрытия бустера с последнего выбора фиксируем тип текущего набора из prevState.booster
    const normalizedPackId =
      normalizePackIdForCollection(prevState.booster.packType, prevState.booster.packSize) ??
      normalizePackIdForCollection(prevState.booster.packId);
    if (normalizedPackId !== null) {
      extraPackIds.push(normalizedPackId);
    }
  }

  if (command.type === 'SKIP_BLIND') {
    const slot = prevState.anteBlinds[prevState.currentBlindIndex];
    if (slot?.skipTagId && nextState.skipsCount > prevState.skipsCount) {
      extraTagIds.push(slot.skipTagId);
    }
  }

  const extras: RunMetaDiscoveriesExtras | undefined =
    extraConsumableIds.length > 0 || extraPackIds.length > 0 || extraTagIds.length > 0
      ? {
          ...(extraConsumableIds.length > 0 ? { extraConsumableIds } : {}),
          ...(extraPackIds.length > 0 ? { extraPackIds } : {}),
          ...(extraTagIds.length > 0 ? { extraTagIds } : {}),
        }
      : undefined;

  return {
    dollarsSpentDelta,
    shopRerollsDelta,
    celestialsUsedDelta,
    extras,
  };
}

/**
 * Проверяет, можно ли активировать расходник прямо сейчас (напрямую или в режиме выбора целей).
 */
function isConsumableUsableInUi(state: RunState, consumableUid: string): boolean {
  const consumable = state.consumables.find((item) => item.uid === consumableUid);
  if (!consumable || state.phase === 'deck_select' || isTerminalRunPhase(state.phase)) {
    return false;
  }

  const req = getConsumableTargetRequirement(consumable.id);
  if (req.mode === 'none') {
    return canUseConsumable(state, consumable, []);
  }

  const handIds =
    state.phase === 'booster'
      ? (state.booster?.drawnHandCardIds ?? [])
      : state.phase === 'playing'
        ? state.handIds
        : [];
  if (handIds.length < req.min) {
    return false;
  }

  // Для c_aura дополнительно проверяем наличие хотя бы одной карты без издания
  if (consumable.id === 'c_aura') {
    return handIds.some((id) => {
      const card = state.deck.find((item) => item.id === id);
      return card !== undefined && card.edition === 'base';
    });
  }

  return true;
}

/**
 * Очищает и актуализирует выбранные карты в руке (включая принудительно выделенную карту Босса).
 */
function normalizeSelectedCardIds(
  state: RunState,
  currentSelected: readonly string[],
  targetMode: ConsumableTargetModeState | null,
): string[] {
  const accessible =
    state.phase === 'booster'
      ? (state.booster?.drawnHandCardIds ?? [])
      : state.phase === 'playing'
        ? state.handIds
        : [];
  const accessibleSet = new Set(accessible);
  const filtered = currentSelected.filter((id) => accessibleSet.has(id));

  if (targetMode !== null) {
    return filtered.slice(0, targetMode.max);
  }

  if (state.phase === 'playing') {
    const forcedCard = state.deck.find(
      (card) => accessibleSet.has(card.id) && card.forcedSelection === true,
    );
    if (forcedCard && !filtered.includes(forcedCard.id)) {
      return [forcedCard.id, ...filtered].slice(0, 5);
    }
  }

  return filtered.slice(0, 5);
}

/**
 * Переключает или выставляет подсветку триггера в DOM во время проигрывания TracePlayer.
 */
function applyTriggerHighlight(
  container: HTMLElement,
  selectorAll: string,
  targetSelector: string | null,
): void {
  for (const prev of container.querySelectorAll(selectorAll)) {
    prev.classList.remove('is-highlighted');
    prev.removeAttribute('data-highlighted');
    prev.querySelector('.card-frame')?.classList.remove('is-triggering');
  }
  if (!targetSelector) return;

  const target = container.querySelector(targetSelector);
  if (!target) return;
  target.classList.add('is-highlighted');
  target.setAttribute('data-highlighted', 'true');
  target.querySelector('.card-frame')?.classList.add('is-triggering');
}

/**
 * Монтирует приложение Balite в корневой DOM-элемент и связывает движок, UI, аудио, фон и SDK-мост.
 */
export function mountBaliteApp(
  root: HTMLElement,
  options: MountBaliteAppOptions = {},
): BaliteAppHandle {
  const ownsBridge = !options.bridge;
  const bridge = options.bridge ?? createBalitePlatformBridge();
  const now = options.initialNowMs ?? (() => Date.now());
  const scheduleTimeout =
    options.scheduleTimeout ??
    ((cb: (...args: unknown[]) => void, ms?: number) => globalThis.setTimeout(cb, ms));
  const clearScheduledTimeout =
    options.clearScheduledTimeout ??
    ((id: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(id));
  const adCooldownMs = options.adCooldownMs ?? DEFAULT_AD_COOLDOWN_MS;

  // Строим корневую раскладку: живой фон на весь вьюпорт + портретная сцена 9:16
  root.replaceChildren();
  const canvasEl = document.createElement('canvas');
  canvasEl.className = 'backdrop-canvas';
  canvasEl.setAttribute('aria-hidden', 'true');

  const stageEl = document.createElement('div');
  stageEl.className = 'stage-portrait';
  stageEl.dataset.cardTiltManaged = 'true';

  const syncAnimationSpeedCss = (speed: AnimationSpeed): void => {
    stageEl.style.setProperty('--anim-speed', String(speed));
  };

  const syncCrtModeCss = (crtMode: CrtMode): void => {
    root.dataset.crt = crtMode;
  };

  const screenHostEl = document.createElement('div');
  screenHostEl.className = 'stage-screen-host';

  // Слой призрачных перелётов карт поверх сцены (не перехватывает пользовательский ввод)
  const flightLayerEl = document.createElement('div');
  flightLayerEl.className = 'card-flight-layer';
  flightLayerEl.setAttribute('aria-hidden', 'true');

  const overlayHostEl = document.createElement('div');
  overlayHostEl.className = 'stage-overlay-host';

  // Декоративный ретро-оверлей CRT поверх всей сцены (не перехватывает ввод)
  const crtOverlayEl = document.createElement('div');
  crtOverlayEl.className = 'crt-overlay';
  crtOverlayEl.setAttribute('aria-hidden', 'true');

  stageEl.append(screenHostEl, flightLayerEl, overlayHostEl);
  root.append(canvasEl, stageEl, crtOverlayEl);

  const backdrop: BackdropController = createBackdropCanvas(canvasEl);

  // Начальное синхронное состояние до завершения асинхронной загрузки сохранения
  const initialLang = bridge.getLanguage();
  const initialNow = Math.max(0, Math.floor(now()));
  const initialMeta = createInitialMetaSave(initialNow, { lang: initialLang });
  let saveData: PlayerSaveData = createPlayerSaveData(initialMeta, null, 0, initialNow);
  const isInitialTutorial =
    saveData.meta.settings.tutorialCompleted !== true &&
    saveData.meta.tutorialCompleted !== true;
  let seedInput = isInitialTutorial ? 'TUTORIAL' : createRandomSeed();
  let selectedDeckId: DeckId = saveData.meta.unlockedDecks[0] ?? 'b_red';
  let runState: RunState = createDeckSelectState(selectedDeckId, seedInput);
  let savedRunSnapshot: RunSnapshot | null = null;

  let translator: Translator = createTranslator(saveData.meta.settings.lang);
  syncDocumentLanguage(saveData.meta.settings.lang);
  syncAnimationSpeedCss(saveData.meta.settings.animationSpeed);
  syncCrtModeCss(saveData.meta.settings.crtMode);
  const audio: BaliteAudioController =
    options.audio ?? createHybridBaliteAudio(bridge.audio, saveData.meta.settings);
  const cardAnimator = createCardAnimator({
    ...options.cardAnimatorOptions,
    flightLayer: flightLayerEl,
    getSpeed: () => saveData.meta.settings.animationSpeed,
  });
  const cardTiltController: CardTiltController = initCardTiltController({
    ...options.cardTiltOptions,
    container: stageEl,
  });
  const particleCanvas: ParticleCanvasController = createParticleCanvas({
    ...options.particleCanvasOptions,
    container: stageEl,
    speed: () => saveData.meta.settings.animationSpeed,
  });

  // Плавающий hover-тултип для десктопного курсора на всём стейдже (включая модалку Колоды)
  let hoverTooltip: HoverTooltipController | null = null;
  const mountHoverTooltip = (): void => {
    hoverTooltip?.destroy();
    hoverTooltip = initHoverTooltip({
      container: stageEl,
      mountParent: root,
      defaultHiddenTitle: translator.t('ui.tooltip.hiddenTitle'),
      defaultHiddenDescription: translator.t('ui.tooltip.hiddenDescription'),
    });
  };
  mountHoverTooltip();

  // Слушатели первого пользовательского жеста для разблокировки Web Audio
  let destroyed = false;
  let initialized = false;
  let gameplayStarted = false;
  let platformPaused = false;
  let adShowing = false;
  let isTransitioningAd = false;
  let lastInterstitialAtMs: number | null = null;
  let completionRecordedForCurrentRun = false;

  let selectedCardIds: string[] = [];
  let consumableTargetMode: ConsumableTargetModeState | null = null;

  let currentTutorialIndex: number =
    saveData.meta.settings.tutorialCompleted === true || saveData.meta.tutorialCompleted === true
      ? 21
      : (saveData.meta.settings.tutorialStep ?? saveData.meta.tutorialStep ?? 0);

  const tutorialOverlay: TutorialOverlayController =
    options.tutorialOverlay ??
    createTutorialOverlay({
      container: root,
      audio,
      onNext: () => {
        advanceTutorialStep();
      },
      onSkip: () => {
        completeTutorial();
      },
      onAction: (_action) => {
        // Клик вне целевого элемента при ожидании действия
      },
    });
  let activeInspectTarget: InspectTarget | null = null;
  let activeModal: ActiveModalKind | null = null;
  let activeCollectionCategory: CollectionCategory | null = null;
  let activeSettingsTab: SettingsModalTab = 'hub';
  let activeDebugTab: DebugPanelTab = 'combat';
  let activeDebugSpawnFilter: DebugSpawnFilter = 'relics';
  let debugSearchQuery = '';
  let debugSpawnEdition: Edition = 'base';
  let debugCardScope: 'selected' | 'all' = 'selected';
  const debugPanelLogs: string[] = ['ready'];
  let showMainMenu = true;

  let isAnimating = false;
  let animationDisplayState: RunState | null = null;
  let animationLiveScore: ScreenViewModel['liveScore'] = null;
  let playedCardIds: string[] = [];
  let shatteredCardIds: string[] = [];
  let activeTraceHandle: TracePlayerHandle | null = null;
  let animationRunToken = 0;
  let screenRefs: ScreenRefs | null = null;
  let popupOffsetStep = 0;
  let scoreFlame: ScoreFlameController | null = null;
  let scoreFlameContainer: HTMLElement | null = null;
  let lastHudPhase: RunState['phase'] | null = null;
  let exactMultOverride: number | null = null;
  let activeCashoutTimeline: CashoutTimelineController | null = null;
  let cashoutStartedKey: string | null = null;
  let cashoutFinishedKey: string | null = null;
  let victoryConfettiKey: string | null = null;
  let isSkippingTrace = false;

  const scoreRoller: NumberRollerController = createNumberRoller({
    initialValue: 0,
    durationMs: 260,
    ...options.numberRollerOptions,
    speed: () => saveData.meta.settings.animationSpeed,
    onUpdate: (_val, formatted) => {
      if (screenRefs && !destroyed) {
        screenRefs.scoreEl.textContent = formatted;
      }
    },
  });

  const chipsRoller: NumberRollerController = createNumberRoller({
    initialValue: 0,
    durationMs: 200,
    ...options.numberRollerOptions,
    speed: () => saveData.meta.settings.animationSpeed,
    onUpdate: (_val, formatted) => {
      if (screenRefs && !destroyed) {
        screenRefs.chipsEl.textContent = formatted;
      }
    },
  });

  const multRoller: NumberRollerController = createNumberRoller({
    initialValue: 0,
    durationMs: 200,
    ...options.numberRollerOptions,
    speed: () => saveData.meta.settings.animationSpeed,
    onUpdate: (_val, formatted) => {
      if (screenRefs && !destroyed && exactMultOverride === null) {
        screenRefs.multEl.textContent = formatted;
      }
    },
  });

  const setMultDisplay = (value: number, immediate = false): void => {
    if (Number.isInteger(value)) {
      exactMultOverride = null;
      if (immediate) {
        multRoller.snap(value);
        if (screenRefs && !destroyed) {
          screenRefs.multEl.textContent = String(value);
        }
      } else {
        multRoller.setTarget(value);
      }
      return;
    }

    exactMultOverride = value;
    multRoller.snap(Math.round(value));
    if (screenRefs && !destroyed) {
      screenRefs.multEl.textContent = String(value);
    }
  };

  const destroyCashoutTimeline = (): void => {
    activeCashoutTimeline?.destroy();
    activeCashoutTimeline = null;
  };

  const emitConsumableParticles = (
    kind: ConsumableKind,
    preferredEl?: HTMLElement | null,
    targetCardIds?: readonly string[],
  ): void => {
    if (destroyed) return;
    if (preferredEl) {
      particleCanvas.emitAtElement(kind, preferredEl);
      return;
    }
    if (targetCardIds && targetCardIds.length > 0) {
      let emitted = false;
      for (const cardId of targetCardIds) {
        const cardEl =
          screenHostEl.querySelector<HTMLElement>(`[data-zone="play"][data-card-id="${cardId}"]`) ??
          screenHostEl.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`);
        if (cardEl) {
          particleCanvas.emitAtElement(kind, cardEl);
          emitted = true;
        }
      }
      if (emitted) return;
    }
    if (screenRefs?.arenaEl) {
      particleCanvas.emitAtElement(kind, screenRefs.arenaEl);
    }
  };

  const syncHudRollers = (state: RunState, refs: ScreenRefs): void => {
    if (isAnimating) {
      lastHudPhase = state.phase;
      return;
    }

    const phaseChanged = state.phase !== lastHudPhase;
    lastHudPhase = state.phase;

    const targetScore = Number(refs.scoreEl.textContent) || 0;
    const targetChips = refs.previewChips;
    const targetMult = refs.previewMult;

    if (phaseChanged || state.phase !== 'playing') {
      exactMultOverride = null;
      scoreRoller.snap(targetScore);
      chipsRoller.snap(targetChips);
      setMultDisplay(targetMult, true);
      return;
    }

    scoreRoller.setTarget(targetScore);
    chipsRoller.setTarget(targetChips);
    setMultDisplay(targetMult, false);

    // Синхронизируем свежесозданный DOM с текущим значением роллеров без визуального скачка
    refs.scoreEl.textContent = String(scoreRoller.getCurrent());
    refs.chipsEl.textContent = String(chipsRoller.getCurrent());
    refs.multEl.textContent =
      exactMultOverride !== null ? String(exactMultOverride) : String(multRoller.getCurrent());
  };

  const syncCashoutTimeline = (state: RunState, refs: ScreenRefs): void => {
    if (isAnimating || !refs.cashout) {
      destroyCashoutTimeline();
      if (!isAnimating && state.phase !== 'cashout') {
        cashoutStartedKey = null;
        cashoutFinishedKey = null;
      }
      return;
    }

    const cashoutRefs = refs.cashout;
    if (cashoutFinishedKey === cashoutRefs.key || cashoutStartedKey === cashoutRefs.key) {
      // Повторная перерисовка того же экрана кэшаута не перезапускает таймлайн
      cashoutFinishedKey = cashoutRefs.key;
      destroyCashoutTimeline();
      for (const row of cashoutRefs.rows) {
        row.rowElement.dataset.cashoutRevealed = 'true';
        row.rowElement.style.opacity = '1';
      }
      return;
    }

    cashoutStartedKey = cashoutRefs.key;
    destroyCashoutTimeline();

    activeCashoutTimeline = createCashoutTimeline({
      ...options.numberRollerOptions,
      speed: () => saveData.meta.settings.animationSpeed,
      rows: cashoutRefs.rows.map((row) => ({
        rowElement: row.rowElement,
        valueElement: row.valueElement,
        amount: row.amount,
        isTotal: row.isTotal,
        formatAmount: (v) => translator.t('ui.hud.goldAmount', { dollars: v }),
      })),
      totalElement: cashoutRefs.claimBtnEl,
      formatTotal: (v) => translator.t('ui.actions.claimCashout', { dollars: v }),
      onComplete: () => {
        cashoutFinishedKey = cashoutRefs.key;
      },
    });

    refs.arenaEl.addEventListener('click', (event) => {
      const target = event.target as Element | null;
      if (target?.closest('button') === cashoutRefs.claimBtnEl) return;
      if (activeCashoutTimeline && !activeCashoutTimeline.isFinished()) {
        activeCashoutTimeline.skip();
        cashoutFinishedKey = cashoutRefs.key;
      }
    });

    activeCashoutTimeline.start();
  };

  let lastScoreFlameIntensity = 0;

  const destroyScoreFlame = (): void => {
    scoreFlame?.destroy();
    scoreFlame = null;
    scoreFlameContainer = null;
  };

  /** Обновляет интенсивность пламени и проигрывает звук порога один раз при переходе 0 -> >0. */
  const setScoreFlameIntensityWithSound = (intensity: number): void => {
    const normalized = Number.isFinite(intensity) && intensity > 0 ? intensity : 0;
    if (lastScoreFlameIntensity <= 0 && normalized > 0) {
      audio.playFlameThreshold();
    }
    lastScoreFlameIntensity = normalized;
    scoreFlame?.setIntensity(normalized);
  };

  const syncScoreFlame = (state: RunState, refs: ScreenRefs): void => {
    if (state.phase === 'deck_select' || refs.formulaEl.closest('.hud-refs-standby') !== null) {
      lastScoreFlameIntensity = 0;
      destroyScoreFlame();
      return;
    }

    if (scoreFlameContainer !== refs.formulaEl) {
      destroyScoreFlame();
      scoreFlameContainer = refs.formulaEl;
      scoreFlame = createScoreFlame({
        ...options.scoreFlameOptions,
        container: refs.formulaEl,
        chipsAnchor: refs.chipsPillEl,
        multAnchor: refs.multPillEl,
      });
    }

    const intensity =
      state.phase === 'playing'
        ? computeScoreFlameIntensity(
            refs.previewScore,
            refs.previewChips,
            refs.previewMult,
            refs.previewTargetScore,
          )
        : 0;
    setScoreFlameIntensityWithSound(intensity);
  };

  const activeTimers = new Set<ReturnType<typeof setTimeout>>();

  const registerTimeout = (cb: () => void, ms: number): ReturnType<typeof setTimeout> => {
    const id = scheduleTimeout(() => {
      activeTimers.delete(id);
      if (!destroyed) {
        cb();
      }
    }, ms);
    activeTimers.add(id);
    return id;
  };

  const clearAllTimeouts = (): void => {
    for (const id of activeTimers) {
      clearScheduledTimeout(id);
    }
    activeTimers.clear();
  };

  const cancelActiveAnimation = (): void => {
    animationRunToken += 1;
    activeTraceHandle?.cancel();
    activeTraceHandle = null;
    isAnimating = false;
    animationDisplayState = null;
    animationLiveScore = null;
    playedCardIds = [];
    shatteredCardIds = [];
    cardAnimator.cancelAll();
    destroyCashoutTimeline();
    particleCanvas.clear();
  };

  const nextMonotonicRevisionAndTime = (): { revision: number; updatedAt: number } => {
    const revision = saveData.revision + 1;
    const rawNow = Math.max(0, Math.floor(now()));
    const updatedAt = Math.max(rawNow, saveData.updatedAt);
    return { revision, updatedAt };
  };

  const syncGameplayState = (): void => {
    if (destroyed || !initialized) {
      if (gameplayStarted) {
        gameplayStarted = false;
        bridge.gameplayStop();
      }
      return;
    }

    const shouldPlay =
      !showMainMenu &&
      isActiveRunPhase(runState.phase) &&
      activeModal === null &&
      !platformPaused &&
      !adShowing;

    if (shouldPlay && !gameplayStarted) {
      gameplayStarted = true;
      bridge.gameplayStart();
    } else if (!shouldPlay && gameplayStarted) {
      gameplayStarted = false;
      bridge.gameplayStop();
    }
  };

  const closeOverlays = (): void => {
    activeInspectTarget = null;
    activeModal = null;
    activeCollectionCategory = null;
    activeSettingsTab = 'hub';
    overlayHostEl.replaceChildren();
    syncGameplayState();
    syncTutorialStep();
  };

  function isTutorialActive(): boolean {
    if (destroyed || isAnimating || isTransitioningAd || platformPaused || adShowing) {
      return false;
    }
    if (showMainMenu) return false;
    if (activeModal !== null) return false;
    if (runState.phase === 'deck_select' || isTerminalRunPhase(runState.phase)) return false;
    if (saveData.meta.settings.tutorialCompleted === true) return false;
    if (saveData.meta.tutorialCompleted === true) return false;
    return true;
  }

  function syncTutorialStep(): void {
    if (!isTutorialActive()) {
      tutorialOverlay.hide();
      return;
    }

    const devOriginal = isDevOriginalTermsEnabled();
    const steps = getTutorialSteps(devOriginal);
    const totalSteps = steps.length;

    if (currentTutorialIndex >= totalSteps) {
      completeTutorial();
      return;
    }

    let step = steps[currentTutorialIndex];
    if (!step) {
      completeTutorial();
      return;
    }

    // Если фаза текущего шага не совпадает с фазой забега, ищем следующий подходящий шаг
    if (step.phase !== runState.phase) {
      const candidateIndex = steps.findIndex(
        (s, idx) => idx >= currentTutorialIndex && s.phase === runState.phase,
      );
      if (candidateIndex !== -1) {
        currentTutorialIndex = candidateIndex;
        step = steps[currentTutorialIndex];
        saveData = {
          ...saveData,
          meta: {
            ...saveData.meta,
            tutorialStep: currentTutorialIndex,
            settings: {
              ...saveData.meta.settings,
              tutorialStep: currentTutorialIndex,
            },
          },
        };
      } else {
        tutorialOverlay.hide();
        return;
      }
    }

    tutorialOverlay.showStep({
      ...step,
      stepIndex: currentTutorialIndex + 1,
      totalSteps,
    });
  }

  function advanceTutorialStep(): void {
    const devOriginal = isDevOriginalTermsEnabled();
    const steps = getTutorialSteps(devOriginal);
    currentTutorialIndex++;

    if (currentTutorialIndex >= steps.length) {
      completeTutorial();
      return;
    }

    // В памяти фиксируем текущий шаг без преждевременного инкремента ревизии на диск
    saveData = {
      ...saveData,
      meta: {
        ...saveData.meta,
        tutorialStep: currentTutorialIndex,
        settings: {
          ...saveData.meta.settings,
          tutorialStep: currentTutorialIndex,
        },
      },
    };
    syncTutorialStep();
  }

  function completeTutorial(): void {
    tutorialOverlay.hide();
    const steps = getTutorialSteps(isDevOriginalTermsEnabled());
    currentTutorialIndex = steps.length;
    saveTutorialProgress(true, steps.length);
  }

  function saveTutorialProgress(completed: boolean, stepIndex: number): void {
    const { revision, updatedAt } = nextMonotonicRevisionAndTime();
    const nextMeta = updateMetaFromRunState(saveData.meta, runState, {
      settingsPatch: {
        tutorialCompleted: completed,
        tutorialStep: stepIndex,
      },
      revision,
      updatedAt,
    });
    saveData = createPlayerSaveData(nextMeta, saveData.activeRun, revision, updatedAt);
    void persistBaliteSave(bridge, saveData, { flush: true }).catch(() => false);
  }

  function handleTutorialAction(action: string): void {
    if (!isTutorialActive()) return;
    const devOriginal = isDevOriginalTermsEnabled();
    const steps = getTutorialSteps(devOriginal);
    const step = steps[currentTutorialIndex];
    if (step && step.requireAction === action) {
      advanceTutorialStep();
    }
  }

  const persistSnapshotAndMeta = (
    nextState: RunState,
    flags: {
      runStarted?: boolean;
      handPlayed?: boolean;
      dollarsSpentDelta?: number;
      shopRerollsDelta?: number;
      celestialsUsedDelta?: number;
      extras?: RunMetaDiscoveriesExtras;
      settingsPatch?: Partial<GameSettings>;
      keepActiveSnapshot?: boolean;
      flush?: boolean;
    } = {},
  ): void => {
    const { revision, updatedAt } = nextMonotonicRevisionAndTime();
    const isTerminal = isTerminalRunPhase(nextState.phase);
    const shouldMarkWon =
      nextState.phase === 'victory' && !completionRecordedForCurrentRun;
    const shouldMarkLost =
      nextState.phase === 'game_over' && !completionRecordedForCurrentRun;
    if (isTerminal) {
      completionRecordedForCurrentRun = true;
    }

    const nextMeta = updateMetaFromRunState(saveData.meta, nextState, {
      runStarted: flags.runStarted,
      handPlayed: flags.handPlayed,
      runWon: shouldMarkWon,
      runLost: shouldMarkLost,
      dollarsSpentDelta: flags.dollarsSpentDelta,
      shopRerollsDelta: flags.shopRerollsDelta,
      celestialsUsedDelta: flags.celestialsUsedDelta,
      extras: flags.extras,
      settingsPatch: flags.settingsPatch,
      revision,
      updatedAt,
    });

    let nextActiveRun: RunSnapshot | null = null;
    if (nextState.phase === 'deck_select') {
      nextActiveRun = flags.keepActiveSnapshot ? savedRunSnapshot : null;
    } else if (!isTerminal) {
      nextActiveRun = serializeRunStateToSnapshot(nextState, revision, updatedAt);
      savedRunSnapshot = nextActiveRun;
    } else {
      savedRunSnapshot = null;
    }

    saveData = createPlayerSaveData(nextMeta, nextActiveRun, revision, updatedAt);

    if (isTerminal) {
      const scoreToSend = Math.max(nextMeta.stats.bestHandScore, nextState.stats.bestHandScore);
      void bridge.setLeaderboardScore('best_hand', scoreToSend).catch(() => false);
      void persistBaliteSave(bridge, saveData, { flush: true }).catch(() => false);
    } else {
      void persistBaliteSave(bridge, saveData, { flush: flags.flush }).catch(() => false);
    }
  };

  const showPopupInLayer = (popup: TracePopupPayload): void => {
    if (!screenRefs || destroyed) return;
    const { popupLayerEl } = screenRefs;

    const el = document.createElement('div');
    el.className = `trace-popup trace-popup--${popup.kind}`;
    el.dataset.popupKind = popup.kind;
    el.textContent = popup.text;

    let targetEl: Element | null = null;
    if (popup.targetCardId) {
      targetEl =
        screenHostEl.querySelector(`[data-zone="play"][data-card-id="${popup.targetCardId}"]`) ??
        screenHostEl.querySelector(`[data-card-id="${popup.targetCardId}"]`);
    } else if (popup.targetHandCardId) {
      targetEl = screenHostEl.querySelector(
        `[data-zone="hand"][data-card-id="${popup.targetHandCardId}"]`,
      );
    } else if (popup.targetRelicUid) {
      targetEl = screenHostEl.querySelector(`[data-relic-uid="${popup.targetRelicUid}"]`);
    }

    const layerRect = popupLayerEl.getBoundingClientRect();
    const targetRect = targetEl?.getBoundingClientRect();
    if (
      targetRect &&
      layerRect.width > 0 &&
      layerRect.height > 0 &&
      targetRect.width > 0 &&
      targetRect.height > 0
    ) {
      const leftPct = Math.max(
        10,
        Math.min(90, ((targetRect.left + targetRect.width / 2 - layerRect.left) / layerRect.width) * 100),
      );
      const topPct = Math.max(
        12,
        Math.min(88, ((targetRect.top + targetRect.height * 0.25 - layerRect.top) / layerRect.height) * 100),
      );
      el.style.left = `${leftPct.toFixed(1)}%`;
      el.style.top = `${topPct.toFixed(1)}%`;
    } else {
      const offsetX = ((popupOffsetStep % 5) - 2) * 10;
      const offsetY = (popupOffsetStep % 3) * 8;
      popupOffsetStep += 1;
      el.style.left = `${50 + offsetX}%`;
      el.style.top = `${42 + offsetY}%`;
    }

    popupLayerEl.append(el);
    backdrop.triggerPulse(POPUP_COLORS[popup.kind]);
    if (popup.kind === 'xmult' || popup.kind === 'shatter' || popup.kind === 'dollars') {
      backdrop.spawnParticles(0.5, 0.45, POPUP_COLORS[popup.kind], 14);
    }

    const lifeMs = Math.max(350, Math.round(780 / saveData.meta.settings.animationSpeed));
    registerTimeout(() => {
      el.remove();
    }, lifeMs);
  };

  const renderOverlay = (): void => {
    hoverTooltip?.hide();
    overlayHostEl.replaceChildren();
    if (destroyed) return;
    if (activeModal !== null || activeInspectTarget !== null) {
      tutorialOverlay.hide();
    }

    if (activeModal === 'hand_reference') {
      overlayHostEl.append(renderHandReferenceModal(runState, translator, closeOverlays));
      cardTiltController.refresh();
      return;
    }

    if (activeModal === 'deck') {
      overlayHostEl.append(renderDeckModal(runState, translator, closeOverlays));
      cardTiltController.refresh();
      return;
    }

    if (activeModal === 'settings') {
      const isDebug = bridge.isDebugMode();
      overlayHostEl.append(
        renderSettingsModal({
          settings: saveData.meta.settings,
          translator,
          meta: saveData.meta,
          version: APP_VERSION,
          initialTab: activeSettingsTab,
          canReturnToMainMenu: !showMainMenu && isActiveRunPhase(runState.phase),
          platformId: bridge.getPlatformId(),
          isDebug,
          ...(import.meta.env.DEV && isDebug
            ? {
                devOriginalTermsEnabled: isDevOriginalTermsEnabled(),
                onToggleDevOriginalTerms: (enabled: boolean) => {
                  void setDevOriginalTermsEnabled(enabled, true).then(() => {
                    if (destroyed) return;
                    translator = createTranslator(saveData.meta.settings.lang);
                    mountHoverTooltip();
                    render();
                    renderOverlay();
                  });
                },
              }
            : {}),
          onChangeSettings: handleSettingsPatch,
          onResetTutorial: () => {
            audio.playButton();
            closeOverlays();
            currentTutorialIndex = 0;
            seedInput = 'TUTORIAL';
            saveTutorialProgress(false, 0);
            syncTutorialStep();
          },
          onClose: closeOverlays,
          onTabChange: (tab) => {
            activeSettingsTab = tab;
          },
          onReturnToMainMenu: () => {
            audio.playButton();
            exitRunToMenu(true);
          },
          onOpenDebugPanel: isDebug
            ? () => {
                audio.playButton();
                activeInspectTarget = null;
                activeModal = 'debug';
                syncGameplayState();
                renderOverlay();
              }
            : undefined,
          onDebugAction: isDebug ? handleDebugAction : undefined,
        }),
      );
      cardTiltController.refresh();
      return;
    }

    if (activeModal === 'debug') {
      if (!bridge.isDebugMode()) {
        activeModal = null;
        return;
      }
      overlayHostEl.append(
        renderDebugPanel({
          state: runState,
          selectedCardIds,
          translator,
          platformId: bridge.getPlatformId(),
          initialTab: activeDebugTab,
          initialSpawnFilter: activeDebugSpawnFilter,
          initialSearchQuery: debugSearchQuery,
          initialSpawnEdition: debugSpawnEdition,
          initialCardScope: debugCardScope,
          initialLogs: debugPanelLogs,
          ...(import.meta.env.DEV
            ? {
                devOriginalTermsEnabled: isDevOriginalTermsEnabled(),
                onToggleDevOriginalTerms: (enabled: boolean) => {
                  void setDevOriginalTermsEnabled(enabled, true).then(() => {
                    if (destroyed) return;
                    translator = createTranslator(saveData.meta.settings.lang);
                    mountHoverTooltip();
                    render();
                    renderOverlay();
                  });
                },
              }
            : {}),
          onTabChange: (tab) => {
            activeDebugTab = tab;
          },
          onSpawnFilterChange: (filter) => {
            activeDebugSpawnFilter = filter;
          },
          onSearchQueryChange: (query) => {
            debugSearchQuery = query;
          },
          onSpawnEditionChange: (edition) => {
            debugSpawnEdition = edition;
          },
          onCardScopeChange: (scope) => {
            debugCardScope = scope;
          },
          onUpdateResources: (opts) => {
            applyDebugRunState(setDebugResources(runState, opts), 'setDebugResources');
          },
          onForceBlindWin: () => {
            applyDebugRunState(forceDebugBlindWin(runState), 'forceDebugBlindWin', true);
          },
          onForceRunEnd: (outcome) => {
            applyDebugRunState(
              forceDebugRunEnd(runState, outcome),
              `forceDebugRunEnd:${outcome}`,
              true,
            );
          },
          onApplyCardMods: (opts) => {
            applyDebugRunState(applyDebugCardMods(runState, opts), 'applyDebugCardMods');
          },
          onTestGlassShatter: () => {
            const targetId = selectedCardIds[0] ?? runState.handIds[0];
            closeOverlays();
            if (!targetId) return;
            const next = applyDebugCardMods(runState, {
              cardIds: [targetId],
              enhancement: 'glass',
            });
            if (next !== runState) {
              runState = next;
              persistSnapshotAndMeta(runState);
              render();
            }
            const cardEl =
              screenHostEl.querySelector<HTMLElement>(`[data-zone="hand"][data-card-id="${targetId}"]`) ??
              screenHostEl.querySelector<HTMLElement>(`[data-card-id="${targetId}"]`);
            particleCanvas.emitAtElement('shatter', cardEl);
            cardAnimator.triggerJuice(cardEl, {
              scaleDelta: 0.28,
              rotDelta: -0.22,
              speed: saveData.meta.settings.animationSpeed,
            });
            audio.playForTraceEvent({ type: 'CARD_SHATTER', cardId: targetId, reason: 'glass' }, 0);
          },
          onGiveRelic: (relicId, edition) => {
            applyDebugRunState(giveDebugRelic(runState, relicId, edition), `giveRelic:${relicId}`);
          },
          onGiveConsumable: (consumableId, edition) => {
            applyDebugRunState(
              giveDebugConsumable(runState, consumableId, edition),
              `giveConsumable:${consumableId}`,
            );
          },
          onApplyVoucher: (charterId) => {
            applyDebugRunState(applyDebugVoucher(runState, charterId), `applyVoucher:${charterId}`);
          },
          onDebugAction: async (action) => {
            const res = await handleDebugAction(action);
            debugPanelLogs.unshift(res);
            if (debugPanelLogs.length > 20) debugPanelLogs.length = 20;
            return res;
          },
          onClose: closeOverlays,
        }),
      );
      cardTiltController.refresh();
      syncGameplayState();
      tutorialOverlay.hide();
      return;
    }

    if (activeModal === 'collection') {
      overlayHostEl.append(
        renderCollectionModal({
          meta: saveData.meta,
          translator,
          initialCategory: activeCollectionCategory,
          onClose: closeOverlays,
          onUpdateMeta: (nextMeta) => {
            const { revision, updatedAt } = nextMonotonicRevisionAndTime();
            saveData = createPlayerSaveData(nextMeta, saveData.activeRun, revision, updatedAt);
            void persistBaliteSave(bridge, saveData).catch(() => false);
            if (showMainMenu) {
              render();
            }
          },
          audio: {
            playButton: () => audio.playButton(),
          },
        }),
      );
      cardTiltController.refresh();
      syncGameplayState();
      tutorialOverlay.hide();
      return;
    }

    if (activeInspectTarget) {
      overlayHostEl.append(
        renderInspectorOverlay(activeInspectTarget, runState, translator, {
          onClose: closeOverlays,
          onMoveRelic: (uid, delta) => {
            const idx = runState.relics.findIndex((item) => item.uid === uid);
            const targetIdx = idx + delta;
            if (idx < 0 || targetIdx < 0 || targetIdx >= runState.relics.length) return;
            const nextUids = runState.relics.map((item) => item.uid);
            const [moved] = nextUids.splice(idx, 1);
            if (!moved) return;
            nextUids.splice(targetIdx, 0, moved);
            closeOverlays();
            applyGameCommand({ type: 'REORDER_RELICS', relicUids: nextUids });
          },
          onSellRelic: (uid) => {
            closeOverlays();
            applyGameCommand({ type: 'SELL_RELIC', relicUid: uid });
          },
          onMoveConsumable: (uid, delta) => {
            const idx = runState.consumables.findIndex((item) => item.uid === uid);
            const targetIdx = idx + delta;
            if (idx < 0 || targetIdx < 0 || targetIdx >= runState.consumables.length) return;
            const nextUids = runState.consumables.map((item) => item.uid);
            const [moved] = nextUids.splice(idx, 1);
            if (!moved) return;
            nextUids.splice(targetIdx, 0, moved);
            closeOverlays();
            applyGameCommand({ type: 'REORDER_CONSUMABLES', consumableUids: nextUids });
          },
          onUseConsumable: (uid) => {
            const item = runState.consumables.find((entry) => entry.uid === uid);
            if (!item) return;
            const req = getConsumableTargetRequirement(item.id);
            closeOverlays();
            if (req.mode === 'none') {
              applyGameCommand({ type: 'USE_CONSUMABLE', consumableUid: uid });
              return;
            }
            consumableTargetMode = {
              consumableUid: item.uid,
              consumableId: item.id,
              ...req,
            };
            selectedCardIds = [];
            render();
          },
          onSellConsumable: (uid) => {
            closeOverlays();
            applyGameCommand({ type: 'SELL_CONSUMABLE', consumableUid: uid });
          },
          onBuyOffer: (offerUid, useImmediately) => {
            closeOverlays();
            applyGameCommand({
              type: 'BUY_SHOP_OFFER',
              offerUid,
              useImmediately: Boolean(useImmediately),
            });
          },
          onBuyCharter: () => {
            closeOverlays();
            applyGameCommand({ type: 'BUY_CHARTER' });
          },
          onOpenPack: (packUid) => {
            closeOverlays();
            applyGameCommand({ type: 'OPEN_PACK', packUid });
          },
        }),
      );
    }
    cardTiltController.refresh();
  };

  const render = (): void => {
    if (destroyed) return;
    hoverTooltip?.hide();

    if (showMainMenu && !isAnimating) {
      cardAnimator.cancelAll();
      destroyScoreFlame();
      destroyCashoutTimeline();
      particleCanvas.clear();
      lastHudPhase = null;
      exactMultOverride = null;
      scoreRoller.snap(0);
      chipsRoller.snap(0);
      multRoller.snap(0);
      stageEl.classList.add('stage-portrait--menu');
      backdrop.setMood('menu');
      screenRefs = null;
      renderMainMenu(
        screenHostEl,
        {
          translator,
          lang: saveData.meta.settings.lang,
          version: APP_VERSION,
          hasSavedRun: savedRunSnapshot !== null,
          hasUnseenCollection: hasAnyUnseenCollectionItems(saveData.meta),
        },
        {
          onPlay: () => {
            audio.playButton();
            showMainMenu = false;
            render();
          },
          onOpenSettings: () => {
            audio.playButton();
            activeInspectTarget = null;
            activeModal = 'settings';
            activeSettingsTab = 'hub';
            syncGameplayState();
            renderOverlay();
          },
          onToggleLanguage: () => {
            audio.playButton();
            const nextLang = saveData.meta.settings.lang === 'ru' ? 'en' : 'ru';
            handleSettingsPatch({ lang: nextLang });
          },
          onOpenCollection: () => {
            audio.playButton();
            activeInspectTarget = null;
            activeModal = 'collection';
            activeCollectionCategory = null;
            syncGameplayState();
            renderOverlay();
          },
        },
      );
      cardTiltController.refresh();
      syncGameplayState();
      tutorialOverlay.hide();
      return;
    }

    stageEl.classList.remove('stage-portrait--menu');
    const viewState = isAnimating && animationDisplayState ? animationDisplayState : runState;
    backdrop.setMood(resolveBackdropMood(viewState));

    const vm: ScreenViewModel = {
      state: viewState,
      meta: saveData.meta,
      translator,
      selectedCardIds,
      playedCardIds: isAnimating ? playedCardIds : [],
      shatteredCardIds: isAnimating ? shatteredCardIds : [],
      highlightedCardId: null,
      highlightedHandCardId: null,
      highlightedRelicUid: null,
      liveScore: isAnimating ? animationLiveScore : null,
      isAnimating,
      isDebug: bridge.isDebugMode(),
      unlockedDecks: saveData.meta.unlockedDecks,
      selectedDeckId,
      seedInput,
      hasSavedRun: savedRunSnapshot !== null,
      consumableTargetMode,
    };

    const hasExistingRunShell = screenHostEl.querySelector('.run-shell') !== null;
    const layoutSnapshot = hasExistingRunShell ? cardAnimator.captureSnapshot(screenHostEl) : null;

    screenRefs = renderRunView(screenHostEl, vm, screenHandlers);
    syncScoreFlame(viewState, screenRefs);
    syncHudRollers(viewState, screenRefs);
    syncCashoutTimeline(viewState, screenRefs);

    if (!isAnimating && viewState.phase === 'victory') {
      const winKey = `${viewState.seed}:${viewState.ante}:${viewState.score}`;
      if (victoryConfettiKey !== winKey) {
        victoryConfettiKey = winKey;
        particleCanvas.emitConfetti();
      }
    } else if (viewState.phase === 'deck_select') {
      victoryConfettiKey = null;
    }

    if (layoutSnapshot) {
      cardAnimator.animateFromSnapshot(screenHostEl, layoutSnapshot, {
        speed: saveData.meta.settings.animationSpeed,
      });
    }
    cardTiltController.refresh();
    syncGameplayState();
    syncTutorialStep();
  };

  const runWithLogicalPauseAd = (action: () => void): void => {
    if (destroyed || isTransitioningAd) return;
    const currentNow = now();
    const cooldownReady =
      lastInterstitialAtMs === null || currentNow - lastInterstitialAtMs >= adCooldownMs;

    if (!cooldownReady) {
      action();
      return;
    }

    isTransitioningAd = true;
    lastInterstitialAtMs = currentNow;
    adShowing = true;
    syncGameplayState();

    void bridge
      .showInterstitial()
      .catch(() => ({ shown: false }))
      .finally(() => {
        adShowing = false;
        isTransitioningAd = false;
        if (!destroyed) {
          action();
        }
      });
  };

  const playNonBlockingAudioAndBanner = (events: readonly TraceEvent[]): void => {
    events.forEach((event, index) => {
      audio.playForTraceEvent(event, index);
    });
  };

  const startPlayHandAnimation = (
    prevState: RunState,
    playedIds: readonly string[],
    events: readonly TraceEvent[],
  ): void => {
    activeTraceHandle?.cancel();
    animationRunToken += 1;
    const currentToken = animationRunToken;

    isAnimating = true;
    tutorialOverlay.hide();
    playedCardIds = [...playedIds];
    shatteredCardIds = [];

    const scoreEvent = events.find(
      (ev): ev is Extract<TraceEvent, { readonly type: 'SCORE_UPDATE' }> =>
        ev.type === 'SCORE_UPDATE',
    );
    const initialHandType: HandType = scoreEvent?.handType ?? 'High Card';
    const baseLevel = prevState.handLevels[initialHandType];
    let runningChips = baseLevel.chips;
    let runningMult = baseLevel.mult;
    const activeSlot = prevState.anteBlinds[prevState.currentBlindIndex];
    if (
      activeSlot?.kind === 'boss' &&
      activeSlot.bossId === 'bl_flint' &&
      !prevState.activeBossDisabled
    ) {
      runningChips = Math.max(Math.floor(runningChips * 0.5 + 0.5), 0);
      runningMult = Math.max(Math.floor(runningMult * 0.5 + 0.5), 1);
    }

    animationLiveScore = {
      chips: runningChips,
      mult: runningMult,
      totalScore: prevState.score,
      targetScore: prevState.targetScore,
      handType: initialHandType,
    };
    animationDisplayState = {
      ...prevState,
      handIds: prevState.handIds.filter((id) => !playedIds.includes(id)),
      handsLeft: Math.max(0, prevState.handsLeft - 1),
    };
    selectedCardIds = [];

    render();

    exactMultOverride = null;
    scoreRoller.snap(prevState.score);
    chipsRoller.snap(runningChips);
    setMultDisplay(runningMult, true);

    const triggerTraceJuice = (target: TraceJuiceTarget): void => {
      let targetEl: HTMLElement | null = null;
      switch (target.kind) {
        case 'card':
          targetEl = screenHostEl.querySelector<HTMLElement>(
            `[data-zone="play"][data-card-id="${target.cardId}"]`,
          );
          break;
        case 'hand_card':
          targetEl = screenHostEl.querySelector<HTMLElement>(
            `[data-zone="hand"][data-card-id="${target.cardId}"]`,
          );
          break;
        case 'relic':
          targetEl = screenHostEl.querySelector<HTMLElement>(
            `[data-relic-uid="${target.relicUid}"]`,
          );
          break;
        case 'chips':
          targetEl = screenRefs?.chipsPillEl ?? null;
          break;
        case 'mult':
          targetEl = screenRefs?.multPillEl ?? null;
          break;
      }
      cardAnimator.triggerJuice(targetEl, {
        scaleDelta: target.scaleDelta,
        rotDelta: target.rotDelta,
        speed: saveData.meta.settings.animationSpeed,
      });
    };

    const handle = playTraceEvents(events, saveData.meta.settings.animationSpeed, {
      translator,
      audio,
      onScore: (chips, mult, totalScore, targetScore, handType) => {
        if (!screenRefs || destroyed || animationRunToken !== currentToken) return;
        runningChips = chips;
        runningMult = mult;
        animationLiveScore = { chips, mult, totalScore, targetScore, handType };
        chipsRoller.setTarget(chips);
        setMultDisplay(mult, false);
        scoreRoller.setTarget(totalScore);
        screenRefs.handTypeEl.textContent = translator.getHandText(handType).name;
        setScoreFlameIntensityWithSound(
          computeScoreFlameIntensity(totalScore, chips, mult, targetScore),
        );
      },
      onFormulaDelta: ({ chipsDelta, multDelta, xMult }) => {
        if (!screenRefs || destroyed || animationRunToken !== currentToken) return;
        runningChips = Math.max(0, runningChips + chipsDelta);
        runningMult = Math.max(1, Math.round((runningMult + multDelta) * xMult * 100) / 100);
        animationLiveScore = {
          chips: runningChips,
          mult: runningMult,
          totalScore: prevState.score,
          targetScore: prevState.targetScore,
          handType: initialHandType,
        };
        chipsRoller.setTarget(runningChips);
        setMultDisplay(runningMult, false);
        setScoreFlameIntensityWithSound(
          computeScoreFlameIntensity(
            prevState.score,
            runningChips,
            runningMult,
            prevState.targetScore,
          ),
        );
      },
      onJuice: (target) => {
        if (destroyed || animationRunToken !== currentToken) return;
        triggerTraceJuice(target);
      },
      onConsumableTrigger: ({ consumableId, consumableUid, targetCardIds }) => {
        if (destroyed || animationRunToken !== currentToken) return;
        const sourceEl = consumableUid
          ? screenHostEl.querySelector<HTMLElement>(`[data-consumable-uid="${consumableUid}"]`)
          : null;
        emitConsumableParticles(resolveConsumableKind(consumableId), sourceEl, targetCardIds);
      },
      onDollars: (totalDollars) => {
        if (!screenRefs || destroyed || animationRunToken !== currentToken) return;
        screenRefs.dollarsEl.textContent = translator.t('ui.hud.goldAmount', {
          dollars: totalDollars,
        });
      },
      onHighlightCard: (cardId) => {
        if (destroyed || animationRunToken !== currentToken) return;
        applyTriggerHighlight(
          screenHostEl,
          '.play-zone__card',
          cardId ? `[data-zone="play"][data-card-id="${cardId}"]` : null,
        );
      },
      onHighlightHandCard: (cardId) => {
        if (destroyed || animationRunToken !== currentToken) return;
        applyTriggerHighlight(
          screenHostEl,
          '.hand-card-slot',
          cardId ? `[data-zone="hand"][data-card-id="${cardId}"]` : null,
        );
      },
      onHighlightRelic: (relicUid) => {
        if (destroyed || animationRunToken !== currentToken) return;
        applyTriggerHighlight(
          screenHostEl,
          '[data-relic-uid]',
          relicUid ? `[data-relic-uid="${relicUid}"]` : null,
        );
      },
      onPopup: (popup) => {
        if (destroyed || animationRunToken !== currentToken) return;
        showPopupInLayer(popup);
      },
      onShatterCard: (cardId) => {
        if (destroyed || animationRunToken !== currentToken) return;
        if (!shatteredCardIds.includes(cardId)) {
          shatteredCardIds = [...shatteredCardIds, cardId];
        }
        const cardSlot =
          screenHostEl.querySelector<HTMLElement>(`[data-zone="play"][data-card-id="${cardId}"]`) ??
          screenHostEl.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`);
        if (cardSlot) {
          cardSlot.classList.add('is-shattered');
          cardSlot.setAttribute('data-shattered', 'true');
        }
        if (!isSkippingTrace) {
          particleCanvas.emitAtElement('shatter', cardSlot);
        }
        backdrop.spawnParticles(0.5, 0.5, POPUP_COLORS.shatter, 18);
      },
      onBanner: (text, tone) => {
        if (!screenRefs || destroyed || animationRunToken !== currentToken) return;
        screenRefs.bannerEl.textContent = text;
        screenRefs.bannerEl.dataset.tone = tone;
        screenRefs.bannerEl.classList.remove('is-hidden');
        if (tone === 'win') {
          backdrop.setMood('victory');
        } else if (tone === 'lose') {
          backdrop.setMood('defeat');
        }
      },
    });

    activeTraceHandle = handle;
    void handle.promise.finally(() => {
      if (destroyed || animationRunToken !== currentToken) return;
      activeTraceHandle = null;
      isAnimating = false;
      animationDisplayState = null;
      animationLiveScore = null;
      playedCardIds = [];
      shatteredCardIds = [];
      selectedCardIds = normalizeSelectedCardIds(runState, [], consumableTargetMode);
      render();
    });
  };

  function applyGameCommand(command: GameCommand): void {
    if (destroyed || isAnimating || isTransitioningAd) return;

    const prevState = runState;
    const result = dispatch(prevState, command);
    if (result.nextState === prevState && result.events.length === 0) {
      return;
    }

    runState = result.nextState;
    consumableTargetMode = null;

    if (command.type === 'CONTINUE_ENDLESS') {
      completionRecordedForCurrentRun = false;
    }

    if (command.type === 'SELECT_BLIND' || command.type === 'SKIP_BLIND') {
      handleTutorialAction('select_blind');
    } else if (command.type === 'PLAY_HAND') {
      handleTutorialAction('play_hand');
    } else if (command.type === 'DISCARD_CARDS') {
      handleTutorialAction('discard');
    } else if (command.type === 'BUY_SHOP_OFFER' || command.type === 'BUY_CHARTER') {
      handleTutorialAction('buy_relic');
    } else if (command.type === 'USE_CONSUMABLE') {
      handleTutorialAction('use_consumable');
    } else if (command.type === 'NEXT_ROUND') {
      handleTutorialAction('leave_shop');
    }

    const handPlayed = command.type === 'PLAY_HAND';
    const metaTracking = extractCommandMetaTracking(prevState, command, runState);
    persistSnapshotAndMeta(runState, {
      runStarted: command.type === 'START_RUN',
      handPlayed,
      dollarsSpentDelta: metaTracking.dollarsSpentDelta,
      shopRerollsDelta: metaTracking.shopRerollsDelta,
      celestialsUsedDelta: metaTracking.celestialsUsedDelta,
      extras: metaTracking.extras,
      flush: command.type === 'CLAIM_CASHOUT' || command.type === 'NEXT_ROUND',
    });

    if (handPlayed) {
      startPlayHandAnimation(prevState, command.cardIds, result.events);
      return;
    }

    let usedConsumableKind: ConsumableKind | null = null;
    if (command.type === 'USE_CONSUMABLE') {
      const used = prevState.consumables.find((item) => item.uid === command.consumableUid);
      if (used) {
        usedConsumableKind = resolveConsumableKind(used.id);
        const sourceEl = screenHostEl.querySelector<HTMLElement>(
          `[data-consumable-uid="${used.uid}"]`,
        );
        emitConsumableParticles(
          usedConsumableKind,
          sourceEl,
          command.targetCardIds,
        );
      }
    } else if (command.type === 'BUY_SHOP_OFFER' && command.useImmediately) {
      const offer = prevState.shop?.offers.find((item) => item.uid === command.offerUid);
      if (offer?.kind === 'consumable') {
        usedConsumableKind = resolveConsumableKind(offer.consumable.id);
        const sourceEl = screenHostEl.querySelector<HTMLElement>(
          `[data-offer-uid="${offer.uid}"]`,
        );
        emitConsumableParticles(usedConsumableKind, sourceEl);
      }
    } else if (command.type === 'PICK_BOOSTER_ITEM') {
      const choice = prevState.booster?.choices.find((item) => item.uid === command.choiceUid);
      if (choice?.kind === 'consumable') {
        usedConsumableKind = resolveConsumableKind(choice.consumable.id);
        const sourceEl = screenHostEl.querySelector<HTMLElement>(
          `[data-choice-uid="${choice.uid}"]`,
        );
        emitConsumableParticles(
          usedConsumableKind,
          sourceEl,
          command.targetCardIds,
        );
      }
    }

    if (command.type === 'START_RUN') {
      victoryConfettiKey = null;
      cashoutStartedKey = null;
      cashoutFinishedKey = null;
      particleCanvas.clear();
    }

    const hasConsumableTrace = result.events.some((ev) => ev.type === 'CONSUMABLE_TRIGGER');
    const stateChanged = runState !== prevState || result.events.length > 0;

    if (command.type === 'OPEN_PACK') {
      if (stateChanged) {
        audio.playBoosterOpen();
      }
    } else if (command.type === 'BUY_SHOP_OFFER' || command.type === 'BUY_CHARTER') {
      audio.playBuy();
    } else if (command.type === 'REROLL_SHOP' || command.type === 'REROLL_BOSS') {
      audio.playReroll();
    } else if (usedConsumableKind === null) {
      audio.playButton();
    }
    // Если расходник применён без CONSUMABLE_TRIGGER в событиях — озвучиваем его явно без дубля с playForTraceEvent
    if (usedConsumableKind !== null && stateChanged && !hasConsumableTrace) {
      audio.playConsumable(usedConsumableKind);
    }
    playNonBlockingAudioAndBanner(result.events);

    selectedCardIds = normalizeSelectedCardIds(
      runState,
      command.type === 'DISCARD_CARDS' || command.type === 'SELECT_BLIND' || command.type === 'PICK_BOOSTER_ITEM'
        ? []
        : selectedCardIds,
      consumableTargetMode,
    );
    render();
  }

  function startNewRunInternal(): void {
    cancelActiveAnimation();
    showMainMenu = false;
    const isTutorialRun =
      saveData.meta.settings.tutorialCompleted !== true &&
      saveData.meta.tutorialCompleted !== true;
    const fallbackSeed = isTutorialRun ? 'TUTORIAL' : createRandomSeed();
    const cleanSeed = seedInput.trim() || fallbackSeed;
    seedInput = cleanSeed;
    completionRecordedForCurrentRun = false;
    consumableTargetMode = null;
    selectedCardIds = [];
    closeOverlays();
    applyGameCommand({ type: 'START_RUN', deckId: selectedDeckId, seed: cleanSeed });
  }

  function exitRunToMenu(targetShowMainMenu: boolean): void {
    cancelActiveAnimation();
    showMainMenu = targetShowMainMenu;
    consumableTargetMode = null;
    selectedCardIds = [];
    closeOverlays();

    if (isActiveRunPhase(runState.phase)) {
      const { revision, updatedAt } = nextMonotonicRevisionAndTime();
      savedRunSnapshot = serializeRunStateToSnapshot(runState, revision, updatedAt);
    } else {
      savedRunSnapshot = null;
    }

    runState = createDeckSelectState(selectedDeckId, seedInput.trim() || createRandomSeed());
    persistSnapshotAndMeta(runState, {
      keepActiveSnapshot: savedRunSnapshot !== null,
      flush: true,
    });
    render();
  }

  function returnToDeckSelectInternal(): void {
    exitRunToMenu(false);
  }

  function handleSettingsPatch(patch: Partial<GameSettings>): void {
    const langChanged = Boolean(patch.lang && patch.lang !== saveData.meta.settings.lang);
    const nextSettings: GameSettings = {
      ...saveData.meta.settings,
      ...patch,
    };

    if (langChanged && patch.lang) {
      translator = createTranslator(patch.lang);
      syncDocumentLanguage(patch.lang);
      mountHoverTooltip();
    }

    if (patch.animationSpeed !== undefined) {
      syncAnimationSpeedCss(nextSettings.animationSpeed);
    }

    if (patch.crtMode !== undefined) {
      syncCrtModeCss(nextSettings.crtMode);
    }

    audio.setSettings(nextSettings);

    if (patch.tutorialCompleted !== undefined || patch.tutorialStep !== undefined) {
      if (patch.tutorialStep !== undefined) {
        currentTutorialIndex = patch.tutorialStep;
      }
      if (patch.tutorialCompleted === false) {
        currentTutorialIndex = patch.tutorialStep ?? 0;
        syncTutorialStep();
      } else if (patch.tutorialCompleted === true) {
        tutorialOverlay.hide();
      }
    }

    const { revision, updatedAt } = nextMonotonicRevisionAndTime();
    const nextMeta = updateMetaFromRunState(saveData.meta, runState, {
      settingsPatch: patch,
      revision,
      updatedAt,
    });
    saveData = createPlayerSaveData(nextMeta, saveData.activeRun, revision, updatedAt);
    void persistBaliteSave(bridge, saveData).catch(() => false);

    // При смене громкости/скорости не пересоздаём DOM модалки, чтобы не срывать ползунок
    if (langChanged) {
      render();
      renderOverlay();
    }
  }

  function applyDebugRunState(
    nextState: RunState,
    actionLabel: string,
    closeAfter = false,
  ): void {
    if (destroyed || !bridge.isDebugMode() || nextState === runState) return;
    cancelActiveAnimation();
    runState = nextState;
    consumableTargetMode = null;
    selectedCardIds = normalizeSelectedCardIds(runState, selectedCardIds, null);
    if (!isTerminalRunPhase(runState.phase)) {
      completionRecordedForCurrentRun = false;
    }
    if (runState.phase === 'deck_select') {
      victoryConfettiKey = null;
    }
    persistSnapshotAndMeta(runState, {
      flush: isTerminalRunPhase(runState.phase) || runState.phase === 'cashout',
    });
    debugPanelLogs.unshift(actionLabel);
    if (debugPanelLogs.length > 20) debugPanelLogs.length = 20;
    if (closeAfter) {
      closeOverlays();
    }
    render();
    if (!closeAfter) {
      renderOverlay();
    }
  }

  async function handleDebugAction(action: DebugSystemAction): Promise<string> {
    switch (action) {
      case 'interstitial': {
        const res = await bridge.showInterstitial();
        const detail = res.error ? ` (${res.error})` : res.busy ? ' (busy)' : '';
        return `interstitial: shown=${res.shown}${detail}`;
      }
      case 'rewarded': {
        const res = await bridge.showRewarded();
        const detail = res.error ? ` (${res.error})` : res.busy ? ' (busy)' : '';
        return `rewarded: rewarded=${res.rewarded}${detail}`;
      }
      case 'flush': {
        const ok = await bridge.flushCloudSave();
        return `flushCloudSave: ${ok ? 'ok' : 'failed'}`;
      }
      case 'resetRun': {
        cancelActiveAnimation();
        savedRunSnapshot = null;
        completionRecordedForCurrentRun = false;
        consumableTargetMode = null;
        selectedCardIds = [];
        runState = createDeckSelectState(selectedDeckId, createRandomSeed());
        persistSnapshotAndMeta(runState, { keepActiveSnapshot: false, flush: true });
        closeOverlays();
        render();
        return 'resetRun: ok';
      }
      case 'unlockCollection': {
        const nextMeta = unlockAllCollection(saveData.meta);
        const { revision, updatedAt } = nextMonotonicRevisionAndTime();
        saveData = createPlayerSaveData(nextMeta, saveData.activeRun, revision, updatedAt);
        void persistBaliteSave(bridge, saveData).catch(() => false);
        renderOverlay();
        render();
        return 'unlockCollection: all items unlocked';
      }
      case 'resetCollection': {
        const nextMeta = resetCollection(saveData.meta);
        const { revision, updatedAt } = nextMonotonicRevisionAndTime();
        saveData = createPlayerSaveData(nextMeta, saveData.activeRun, revision, updatedAt);
        void persistBaliteSave(bridge, saveData).catch(() => false);
        renderOverlay();
        render();
        return 'resetCollection: collection reset to default';
      }
    }
  }

  const openInspector = (target: InspectTarget): void => {
    if (isAnimating) return;
    audio.playButton();
    activeModal = null;
    activeInspectTarget = target;
    renderOverlay();
  };

  const screenHandlers: ScreenActionHandlers = {
    onSelectDeck: (deckId) => {
      if (!saveData.meta.unlockedDecks.includes(deckId)) return;
      audio.playCardSelect();
      selectedDeckId = deckId;
      render();
    },
    onSeedInput: (seed) => {
      seedInput = seed;
    },
    onRandomSeed: () => {
      audio.playButton();
      seedInput = createRandomSeed();
      render();
    },
    onStartRun: () => {
      if (runState.phase === 'game_over') {
        runWithLogicalPauseAd(startNewRunInternal);
        return;
      }
      startNewRunInternal();
    },
    onReplaySeed: (seed, deckId) => {
      const startReplayRun = (): void => {
        selectedDeckId = deckId;
        seedInput = seed;
        startNewRunInternal();
      };
      if (runState.phase === 'game_over') {
        runWithLogicalPauseAd(startReplayRun);
        return;
      }
      startReplayRun();
    },
    onResumeSavedRun: () => {
      if (!savedRunSnapshot) return;
      audio.playButton();
      showMainMenu = false;
      const restored = restoreRunStateFromSnapshot(savedRunSnapshot);
      runState =
        restored.phase === 'deck_select'
          ? {
              ...restored,
              phase:
                restored.previousPhase && restored.previousPhase !== 'deck_select'
                  ? restored.previousPhase
                  : 'blind_select',
            }
          : restored;
      selectedDeckId = runState.deckId;
      completionRecordedForCurrentRun = isTerminalRunPhase(runState.phase);
      selectedCardIds = normalizeSelectedCardIds(runState, [], null);
      render();
    },
    onCommand: (command) => {
      if (command.type === 'CLAIM_CASHOUT') {
        if (activeCashoutTimeline && !activeCashoutTimeline.isFinished()) {
          activeCashoutTimeline.skip();
        }
        cashoutFinishedKey = cashoutStartedKey;
      }
      if (command.type === 'NEXT_ROUND' && runState.phase === 'shop') {
        runWithLogicalPauseAd(() => applyGameCommand(command));
        return;
      }
      applyGameCommand(command);
    },
    onToggleCard: (cardId) => {
      if (isAnimating) return;

      if (consumableTargetMode) {
        if (selectedCardIds.includes(cardId)) {
          audio.playCardDeselect();
          selectedCardIds = selectedCardIds.filter((id) => id !== cardId);
        } else if (consumableTargetMode.max === 1) {
          audio.playCardSelect();
          selectedCardIds = [cardId];
        } else if (selectedCardIds.length < consumableTargetMode.max) {
          audio.playCardSelect();
          selectedCardIds = [...selectedCardIds, cardId];
        }
        render();
        return;
      }

      const card = runState.deck.find((item) => item.id === cardId);
      if (selectedCardIds.includes(cardId)) {
        if (runState.phase === 'playing' && card?.forcedSelection === true) {
          audio.playDebuff();
          return;
        }
        audio.playCardDeselect();
        selectedCardIds = selectedCardIds.filter((id) => id !== cardId);
      } else if (selectedCardIds.length < 5) {
        audio.playCardSelect();
        selectedCardIds = [...selectedCardIds, cardId];
        handleTutorialAction('select_card');
      }
      render();
    },
    onConfirmConsumableTargets: () => {
      if (!consumableTargetMode) return;
      const mode = consumableTargetMode;
      const targets = [...selectedCardIds];
      consumableTargetMode = null;
      selectedCardIds = [];
      applyGameCommand({
        type: 'USE_CONSUMABLE',
        consumableUid: mode.consumableUid,
        targetCardIds: targets,
      });
    },
    onCancelConsumableTargets: () => {
      audio.playCardDeselect();
      consumableTargetMode = null;
      selectedCardIds = normalizeSelectedCardIds(runState, [], null);
      render();
    },
    onInspectRelic: (uid, index) => {
      const relic = runState.relics.find((item) => item.uid === uid);
      if (!relic) return;
      openInspector({
        kind: 'relic',
        relic,
        index,
        total: runState.relics.length,
      });
    },
    onInspectConsumable: (uid, index) => {
      const consumable = runState.consumables.find((item) => item.uid === uid);
      if (!consumable) return;
      openInspector({
        kind: 'consumable',
        consumable,
        index,
        total: runState.consumables.length,
        canUse: isConsumableUsableInUi(runState, uid),
      });
    },
    onInspectOffer: (offer: ShopOffer) => {
      const canAfford = runState.dollars >= offer.cost;
      let hasSlot = true;
      let slotFreeForImmediateUse = false;

      if (offer.kind === 'relic') {
        hasSlot =
          offer.relic.edition === 'negative' ||
          runState.relics.length < getEffectiveMaxRelics(runState);
      } else if (offer.kind === 'consumable') {
        hasSlot =
          offer.consumable.edition === 'negative' ||
          runState.consumables.length < getEffectiveMaxConsumables(runState);
        const simulatedState: RunState = {
          ...runState,
          dollars: Math.max(0, runState.dollars - offer.cost),
        };
        slotFreeForImmediateUse = canUseConsumable(simulatedState, offer.consumable, []);
      }

      openInspector({
        kind: 'shop_offer',
        offer,
        canAfford,
        hasSlot,
        slotFreeForImmediateUse,
      });
    },
    onInspectCharter: (charterId: CharterId, price: number) => {
      openInspector({
        kind: 'shop_charter',
        charterId,
        price,
        canAfford: runState.dollars >= price,
      });
    },
    onInspectPack: (pack: PackOffer) => {
      openInspector({
        kind: 'shop_pack',
        pack,
        canAfford: runState.dollars >= pack.cost,
      });
    },
    onInspectPlayingCard: (card: PlayingCard) => {
      openInspector({
        kind: 'playing_card',
        card,
      });
    },
    onInspectBoss: (bossId: BossId, disabled: boolean) => {
      openInspector({
        kind: 'boss',
        bossId,
        disabled,
      });
    },
    onOpenHandReference: () => {
      audio.playButton();
      activeInspectTarget = null;
      activeModal = 'hand_reference';
      syncGameplayState();
      renderOverlay();
    },
    onOpenDeckModal: () => {
      audio.playButton();
      activeInspectTarget = null;
      activeModal = 'deck';
      syncGameplayState();
      renderOverlay();
    },
    onOpenSettings: () => {
      audio.playButton();
      activeInspectTarget = null;
      activeModal = 'settings';
      activeSettingsTab = 'hub';
      syncGameplayState();
      renderOverlay();
    },
    onOpenDebugPanel: bridge.isDebugMode()
      ? () => {
          audio.playButton();
          activeInspectTarget = null;
          activeModal = 'debug';
          syncGameplayState();
          renderOverlay();
        }
      : undefined,
    onSkipAnimation: () => {
      if (isAnimating && activeTraceHandle) {
        isSkippingTrace = true;
        try {
          activeTraceHandle.skip();
        } finally {
          isSkippingTrace = false;
        }
      }
    },
    onReturnToDeckSelect: () => {
      if (isTerminalRunPhase(runState.phase)) {
        runWithLogicalPauseAd(returnToDeckSelectInternal);
        return;
      }
      returnToDeckSelectInternal();
    },
    onBackToMainMenu: () => {
      audio.playButton();
      if (isTerminalRunPhase(runState.phase)) {
        runWithLogicalPauseAd(() => exitRunToMenu(true));
        return;
      }
      showMainMenu = true;
      render();
    },
  };

  // Обработка первого жеста пользователя для разблокировки звука
  let gestureUnlocked = false;
  const handleFirstGesture = (): void => {
    if (destroyed || gestureUnlocked) return;
    gestureUnlocked = true;
    audio.unlock();
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (destroyed) return;
    handleFirstGesture();
    if (event.key === 'F9' && bridge.isDebugMode()) {
      event.preventDefault();
      activeInspectTarget = null;
      activeModal = activeModal === 'debug' ? null : 'debug';
      syncGameplayState();
      renderOverlay();
      return;
    }
    if (event.key === 'Escape' && (activeModal !== null || activeInspectTarget !== null)) {
      closeOverlays();
    }
  };

  const handleWindowResize = (): void => {
    if (!destroyed) {
      backdrop.resize();
      scoreFlame?.resize();
      particleCanvas.resize();
    }
  };

  // Озвучка наведения мышью (pointer: fine) на открытую активную карту в руке с троттлингом >= 60 мс
  const CARD_HOVER_THROTTLE_MS = 60;
  let lastCardHoverAudioAtMs: number | null = null;
  const handleHandCardPointerOver = (event: Event): void => {
    if (destroyed || isAnimating || activeModal !== null || activeInspectTarget !== null) {
      return;
    }
    if (runState.phase !== 'playing' && runState.phase !== 'booster') {
      return;
    }
    const pointerType = (event as Partial<PointerEvent>).pointerType;
    if (pointerType === 'touch' || pointerType === 'pen') {
      return;
    }
    const isFinePointer =
      pointerType === 'mouse' ||
      (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: fine)').matches);
    if (!isFinePointer) {
      return;
    }

    const targetEl = event.target instanceof Element ? event.target : null;
    const slot = targetEl?.closest<HTMLElement>('.hand-card-slot[data-zone="hand"][data-card-id]');
    if (!slot) {
      return;
    }

    const related = (event as Partial<MouseEvent>).relatedTarget;
    if (related && typeof Node !== 'undefined' && related instanceof Node && slot.contains(related)) {
      return;
    }

    if (slot.getAttribute('aria-disabled') === 'true' || slot.classList.contains('is-disabled')) {
      return;
    }

    const isFaceDown =
      slot.dataset.tooltipFacing === 'back' ||
      slot.dataset.faceDown === 'true' ||
      slot.classList.contains('is-face-down') ||
      slot.querySelector('[data-face-down="true"], .is-face-down') !== null;
    if (isFaceDown) {
      return;
    }

    const currentMs = now();
    if (
      lastCardHoverAudioAtMs !== null &&
      currentMs - lastCardHoverAudioAtMs < CARD_HOVER_THROTTLE_MS
    ) {
      return;
    }
    lastCardHoverAudioAtMs = currentMs;
    audio.playCardHover();
  };
  screenHostEl.addEventListener('pointerover', handleHandCardPointerOver);

  const gestureEvents = ['pointerdown', 'touchstart', 'click'] as const;
  for (const eventName of gestureEvents) {
    root.addEventListener(eventName, handleFirstGesture, { capture: true });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowResize);
  }

  const unsubscribeBridge = bridge.subscribe((eventName) => {
    if (destroyed) return;
    if (eventName === 'game_api_pause') {
      platformPaused = true;
      syncGameplayState();
    } else if (eventName === 'game_api_resume') {
      platformPaused = false;
      syncGameplayState();
    }
  });

  // Асинхронная инициализация платформы, загрузка сохранения и первый рендер
  const readyPromise = (async () => {
    bridge.audio.install();
    await bridge.init();
    if (destroyed) return;

    const loaded = await loadBaliteSave(bridge, {
      defaultLang: bridge.getLanguage(),
      nowMs: now(),
    });
    if (destroyed) return;

    saveData = loaded;
    currentTutorialIndex =
      saveData.meta.settings.tutorialCompleted === true || saveData.meta.tutorialCompleted === true
        ? 21
        : (saveData.meta.settings.tutorialStep ?? saveData.meta.tutorialStep ?? 0);
    if (import.meta.env.DEV && readStoredDevOriginalTermsFlag()) {
      await setDevOriginalTermsEnabled(true, false);
      if (destroyed) return;
    }
    translator = createTranslator(saveData.meta.settings.lang);
    syncDocumentLanguage(saveData.meta.settings.lang);
    syncAnimationSpeedCss(saveData.meta.settings.animationSpeed);
    syncCrtModeCss(saveData.meta.settings.crtMode);
    mountHoverTooltip();
    audio.setSettings(saveData.meta.settings);

    selectedDeckId = saveData.meta.unlockedDecks[0] ?? 'b_red';
    savedRunSnapshot = saveData.activeRun;

    if (saveData.activeRun && saveData.activeRun.phase !== 'deck_select') {
      showMainMenu = false;
      runState = restoreRunStateFromSnapshot(saveData.activeRun);
      selectedDeckId = runState.deckId;
      completionRecordedForCurrentRun = isTerminalRunPhase(runState.phase);
    } else {
      showMainMenu = true;
      runState = createDeckSelectState(selectedDeckId, seedInput);
    }

    selectedCardIds = normalizeSelectedCardIds(runState, [], null);
    render();
    // Сигнал готовности должен уйти строго до первого вызова gameplayStart()
    bridge.ready();
    initialized = true;
    syncGameplayState();
  })();

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;

    activeTraceHandle?.cancel();
    activeTraceHandle = null;
    cardTiltController.destroy();
    delete stageEl.dataset.cardTiltManaged;
    lastScoreFlameIntensity = 0;
    destroyScoreFlame();
    destroyCashoutTimeline();
    scoreRoller.destroy();
    chipsRoller.destroy();
    multRoller.destroy();
    particleCanvas.destroy();
    cardAnimator.destroy();
    clearAllTimeouts();

    if (gameplayStarted) {
      gameplayStarted = false;
      bridge.gameplayStop();
    }

    for (const eventName of gestureEvents) {
      root.removeEventListener(eventName, handleFirstGesture, { capture: true });
    }
    screenHostEl.removeEventListener('pointerover', handleHandCardPointerOver);
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowResize);
    }
    unsubscribeBridge();

    hoverTooltip?.destroy();
    hoverTooltip = null;
    tutorialOverlay.destroy();
    audio.dispose();
    backdrop.destroy();
    delete root.dataset.crt;
    root.replaceChildren();

    if (ownsBridge) {
      bridge.audio.dispose();
    }
  };

  return {
    readyPromise,
    getState: () => runState,
    getSaveData: () => saveData,
    getTutorialController: () => tutorialOverlay,
    destroy,
  };
}
