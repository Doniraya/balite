import { createBaliteAudio, type BaliteAudioController } from '../audio/synth';
import {
  DECK_IDS,
  canUseConsumable,
  createInitialMetaSave,
  createInitialRunState,
  createPlayerSaveData,
  dispatch,
  restoreRunStateFromSnapshot,
  serializeRunStateToSnapshot,
} from '../engine';
import type {
  BossId,
  CharterId,
  ConsumableId,
  DeckId,
  GameCommand,
  GameSettings,
  MetaSave,
  PackOffer,
  PlayerSaveData,
  PlayingCard,
  RelicId,
  RunPhase,
  RunSnapshot,
  RunState,
  ShopOffer,
  TraceEvent,
} from '../engine/types';
import { createTranslator, syncDocumentLanguage, type Translator } from '../i18n';
import {
  createBalitePlatformBridge,
  loadBaliteSave,
  persistBaliteSave,
} from '../platform/baliteSave';
import type { PlatformBridge } from '../platform/types';
import { createBackdropCanvas, type BackdropController, type BackdropMood } from './backdropCanvas';
import {
  getConsumableTargetRequirement,
  renderInspectorOverlay,
  type InspectTarget,
} from './inspector';
import {
  renderDeckModal,
  renderHandReferenceModal,
  renderSettingsModal,
} from './modals';
import {
  renderRunView,
  type ScreenActionHandlers,
  type ScreenRefs,
  type ScreenViewModel,
} from './screens';
import { playTraceEvents, type TracePlayerHandle, type TracePopupPayload } from './tracePlayer';

/**
 * Стандартный интервал между показами межстраничной рекламы (3 минуты).
 */
const DEFAULT_AD_COOLDOWN_MS = 180_000;

/**
 * Алфавит для генерации читаемых случайных кодов забега без похожих символов.
 */
const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Публичный дескриптор смонтированного приложения Balite.
 */
export interface BaliteAppHandle {
  readonly readyPromise: Promise<void>;
  getState(): RunState;
  getSaveData(): PlayerSaveData;
  destroy(): void;
}

/**
 * Опции инъекции зависимостей для детерминированного запуска и тестирования приложения.
 */
export interface MountBaliteAppOptions {
  bridge?: PlatformBridge<PlayerSaveData>;
  scheduleTimeout?: typeof setTimeout;
  clearScheduledTimeout?: typeof clearTimeout;
  initialNowMs?: () => number;
  adCooldownMs?: number;
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
type ActiveModalKind = 'hand_reference' | 'deck' | 'settings';

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
    settingsPatch?: Partial<GameSettings>;
    revision: number;
    updatedAt: number;
  },
): MetaSave {
  const relicIds: RelicId[] = state.relics.map((relic) => relic.id);
  const consumableIds: ConsumableId[] = state.consumables.map((item) => item.id);
  const charterIds: CharterId[] = [...state.charters];
  const bossIds: BossId[] = state.anteBlinds
    .map((slot) => slot.bossId)
    .filter((id): id is BossId => id !== null);

  let unlockedDecks = [...meta.unlockedDecks];
  if (flags.runWon) {
    for (const deckId of DECK_IDS) {
      if (!unlockedDecks.includes(deckId)) {
        unlockedDecks = [...unlockedDecks, deckId];
        break;
      }
    }
  }

  return {
    ...meta,
    revision: flags.revision,
    updatedAt: flags.updatedAt,
    settings: flags.settingsPatch
      ? { ...meta.settings, ...flags.settingsPatch }
      : meta.settings,
    unlockedDecks,
    discoveredRelics: appendUniqueIds(meta.discoveredRelics, relicIds),
    discoveredConsumables: appendUniqueIds(meta.discoveredConsumables, consumableIds),
    discoveredCharters: appendUniqueIds(meta.discoveredCharters, charterIds),
    discoveredBosses: appendUniqueIds(meta.discoveredBosses, bossIds),
    stats: {
      runsStarted: meta.stats.runsStarted + (flags.runStarted ? 1 : 0),
      runsWon: meta.stats.runsWon + (flags.runWon ? 1 : 0),
      highestAnte: Math.max(meta.stats.highestAnte, state.ante),
      bestHandScore: Math.max(meta.stats.bestHandScore, state.stats.bestHandScore),
      totalHandsPlayed: meta.stats.totalHandsPlayed + (flags.handPlayed ? 1 : 0),
    },
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

  const screenHostEl = document.createElement('div');
  screenHostEl.className = 'stage-screen-host';

  const overlayHostEl = document.createElement('div');
  overlayHostEl.className = 'stage-overlay-host';

  stageEl.append(screenHostEl, overlayHostEl);
  root.append(canvasEl, stageEl);

  const backdrop: BackdropController = createBackdropCanvas(canvasEl);

  // Начальное синхронное состояние до завершения асинхронной загрузки сохранения
  const initialLang = bridge.getLanguage();
  const initialNow = Math.max(0, Math.floor(now()));
  const initialMeta = createInitialMetaSave(initialNow, { lang: initialLang });
  let saveData: PlayerSaveData = createPlayerSaveData(initialMeta, null, 0, initialNow);
  let seedInput = createRandomSeed();
  let selectedDeckId: DeckId = saveData.meta.unlockedDecks[0] ?? 'b_red';
  let runState: RunState = createDeckSelectState(selectedDeckId, seedInput);
  let savedRunSnapshot: RunSnapshot | null = null;

  let translator: Translator = createTranslator(saveData.meta.settings.lang);
  syncDocumentLanguage(saveData.meta.settings.lang);
  const audio: BaliteAudioController = createBaliteAudio(bridge.audio, saveData.meta.settings);

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
  let activeInspectTarget: InspectTarget | null = null;
  let activeModal: ActiveModalKind | null = null;

  let isAnimating = false;
  let animationDisplayState: RunState | null = null;
  let playedCardIds: string[] = [];
  let shatteredCardIds: string[] = [];
  let activeTraceHandle: TracePlayerHandle | null = null;
  let animationRunToken = 0;
  let screenRefs: ScreenRefs | null = null;
  let popupOffsetStep = 0;

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
    playedCardIds = [];
    shatteredCardIds = [];
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
    overlayHostEl.replaceChildren();
    syncGameplayState();
  };

  const persistSnapshotAndMeta = (
    nextState: RunState,
    flags: {
      runStarted?: boolean;
      handPlayed?: boolean;
      settingsPatch?: Partial<GameSettings>;
      keepActiveSnapshot?: boolean;
      flush?: boolean;
    } = {},
  ): void => {
    const { revision, updatedAt } = nextMonotonicRevisionAndTime();
    const isTerminal = isTerminalRunPhase(nextState.phase);
    const shouldMarkWon =
      nextState.phase === 'victory' && !completionRecordedForCurrentRun;
    if (isTerminal) {
      completionRecordedForCurrentRun = true;
    }

    const nextMeta = updateMetaFromRunState(saveData.meta, nextState, {
      runStarted: flags.runStarted,
      handPlayed: flags.handPlayed,
      runWon: shouldMarkWon,
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

    const lifeMs = Math.max(350, Math.round(900 / saveData.meta.settings.animationSpeed));
    registerTimeout(() => {
      el.remove();
    }, lifeMs);
  };

  const renderOverlay = (): void => {
    overlayHostEl.replaceChildren();
    if (destroyed) return;

    if (activeModal === 'hand_reference') {
      overlayHostEl.append(renderHandReferenceModal(runState, translator, closeOverlays));
      return;
    }

    if (activeModal === 'deck') {
      overlayHostEl.append(renderDeckModal(runState, translator, closeOverlays));
      return;
    }

    if (activeModal === 'settings') {
      const isDebug = bridge.isDebugMode();
      overlayHostEl.append(
        renderSettingsModal({
          settings: saveData.meta.settings,
          translator,
          platformId: bridge.getPlatformId(),
          isDebug,
          onChangeSettings: handleSettingsPatch,
          onClose: closeOverlays,
          onDebugAction: isDebug ? handleDebugAction : undefined,
        }),
      );
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
  };

  const render = (): void => {
    if (destroyed) return;
    const viewState = isAnimating && animationDisplayState ? animationDisplayState : runState;
    backdrop.setMood(resolveBackdropMood(viewState));

    const vm: ScreenViewModel = {
      state: viewState,
      translator,
      selectedCardIds,
      playedCardIds: isAnimating ? playedCardIds : [],
      shatteredCardIds: isAnimating ? shatteredCardIds : [],
      highlightedCardId: null,
      highlightedHandCardId: null,
      highlightedRelicUid: null,
      isAnimating,
      unlockedDecks: saveData.meta.unlockedDecks,
      selectedDeckId,
      seedInput,
      hasSavedRun: savedRunSnapshot !== null,
      consumableTargetMode,
    };

    screenRefs = renderRunView(screenHostEl, vm, screenHandlers);
    syncGameplayState();
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
    playedCardIds = [...playedIds];
    shatteredCardIds = [];
    animationDisplayState = {
      ...prevState,
      handIds: prevState.handIds.filter((id) => !playedIds.includes(id)),
      handsLeft: Math.max(0, prevState.handsLeft - 1),
    };
    selectedCardIds = [];

    render();

    const handle = playTraceEvents(events, saveData.meta.settings.animationSpeed, {
      translator,
      audio,
      onScore: (chips, mult, totalScore, _targetScore, handType) => {
        if (!screenRefs || destroyed || animationRunToken !== currentToken) return;
        screenRefs.chipsEl.textContent = String(chips);
        screenRefs.multEl.textContent = String(mult);
        screenRefs.scoreEl.textContent = String(totalScore);
        screenRefs.handTypeEl.textContent = translator.getHandText(handType).name;
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
        const cardSlot = screenHostEl.querySelector(`[data-card-id="${cardId}"]`);
        if (cardSlot) {
          cardSlot.classList.add('is-shattered');
          cardSlot.setAttribute('data-shattered', 'true');
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

    const handPlayed = command.type === 'PLAY_HAND';
    persistSnapshotAndMeta(runState, {
      runStarted: command.type === 'START_RUN',
      handPlayed,
      flush: command.type === 'CLAIM_CASHOUT' || command.type === 'NEXT_ROUND',
    });

    if (handPlayed) {
      startPlayHandAnimation(prevState, command.cardIds, result.events);
      return;
    }

    if (command.type === 'BUY_SHOP_OFFER' || command.type === 'BUY_CHARTER' || command.type === 'OPEN_PACK') {
      audio.playBuy();
    } else if (command.type === 'REROLL_SHOP' || command.type === 'REROLL_BOSS') {
      audio.playReroll();
    } else {
      audio.playButton();
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
    const cleanSeed = seedInput.trim() || createRandomSeed();
    seedInput = cleanSeed;
    completionRecordedForCurrentRun = false;
    consumableTargetMode = null;
    selectedCardIds = [];
    closeOverlays();
    applyGameCommand({ type: 'START_RUN', deckId: selectedDeckId, seed: cleanSeed });
  }

  function returnToDeckSelectInternal(): void {
    cancelActiveAnimation();
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

  function handleSettingsPatch(patch: Partial<GameSettings>): void {
    const langChanged = Boolean(patch.lang && patch.lang !== saveData.meta.settings.lang);
    const nextSettings: GameSettings = {
      ...saveData.meta.settings,
      ...patch,
    };

    if (langChanged && patch.lang) {
      translator = createTranslator(patch.lang);
      syncDocumentLanguage(patch.lang);
    }

    audio.setSettings(nextSettings);

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

  async function handleDebugAction(
    action: 'interstitial' | 'rewarded' | 'flush' | 'resetRun',
  ): Promise<string> {
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
    onResumeSavedRun: () => {
      if (!savedRunSnapshot) return;
      audio.playButton();
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
      syncGameplayState();
      renderOverlay();
    },
    onSkipAnimation: () => {
      if (isAnimating && activeTraceHandle) {
        activeTraceHandle.skip();
      }
    },
    onReturnToDeckSelect: () => {
      if (isTerminalRunPhase(runState.phase)) {
        runWithLogicalPauseAd(returnToDeckSelectInternal);
        return;
      }
      returnToDeckSelectInternal();
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
    if (event.key === 'Escape' && (activeModal !== null || activeInspectTarget !== null)) {
      closeOverlays();
    }
  };

  const handleWindowResize = (): void => {
    if (!destroyed) {
      backdrop.resize();
    }
  };

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
    translator = createTranslator(saveData.meta.settings.lang);
    syncDocumentLanguage(saveData.meta.settings.lang);
    audio.setSettings(saveData.meta.settings);

    selectedDeckId = saveData.meta.unlockedDecks[0] ?? 'b_red';
    savedRunSnapshot = saveData.activeRun;

    if (saveData.activeRun && saveData.activeRun.phase !== 'deck_select') {
      runState = restoreRunStateFromSnapshot(saveData.activeRun);
      selectedDeckId = runState.deckId;
      completionRecordedForCurrentRun = isTerminalRunPhase(runState.phase);
    } else {
      runState = createDeckSelectState(selectedDeckId, seedInput);
    }

    selectedCardIds = normalizeSelectedCardIds(runState, [], null);
    initialized = true;
    render();
    bridge.ready();
  })();

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;

    activeTraceHandle?.cancel();
    activeTraceHandle = null;
    clearAllTimeouts();

    if (gameplayStarted) {
      gameplayStarted = false;
      bridge.gameplayStop();
    }

    for (const eventName of gestureEvents) {
      root.removeEventListener(eventName, handleFirstGesture, { capture: true });
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowResize);
    }
    unsubscribeBridge();

    audio.dispose();
    backdrop.destroy();
    root.replaceChildren();

    if (ownsBridge) {
      bridge.audio.dispose();
    }
  };

  return {
    readyPromise,
    getState: () => runState,
    getSaveData: () => saveData,
    destroy,
  };
}
