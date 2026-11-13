import type { AnimationSpeed, ConsumableId, HandType, TraceEvent } from '../engine/types';
import type { MessageParams, TraceLocKey, Translator } from '../i18n';

/**
 * Данные всплывающего поп-апа поверх карты, карты в руке, реликвии или арены.
 */
export interface TracePopupPayload {
  readonly kind:
    | 'chips'
    | 'mult'
    | 'xmult'
    | 'dollars'
    | 'shatter'
    | 'debuff'
    | 'level'
    | 'boss'
    | 'tag';
  readonly text: string;
  readonly targetCardId?: string;
  readonly targetRelicUid?: string;
  readonly targetHandCardId?: string;
}

/**
 * Целевой элемент для пружинного импульса juice_up во время шага TracePlayer.
 */
export type TraceJuiceTarget =
  | { readonly kind: 'card'; readonly cardId: string; readonly scaleDelta: number; readonly rotDelta: number }
  | { readonly kind: 'hand_card'; readonly cardId: string; readonly scaleDelta: number; readonly rotDelta: number }
  | { readonly kind: 'relic'; readonly relicUid: string; readonly scaleDelta: number; readonly rotDelta: number }
  | { readonly kind: 'chips'; readonly scaleDelta: number; readonly rotDelta: number }
  | { readonly kind: 'mult'; readonly scaleDelta: number; readonly rotDelta: number };

/**
 * Прирост формулы (Сила / Множитель) на одном шаге TraceEvent.
 */
export interface TraceFormulaDelta {
  readonly chipsDelta: number;
  readonly multDelta: number;
  readonly xMult: number;
}

/**
 * Данные о срабатывании расходника для визуальных частиц в TracePlayer.
 */
export interface TraceConsumableTriggerPayload {
  readonly consumableId: ConsumableId;
  readonly consumableUid?: string;
  readonly targetCardIds?: readonly string[];
}

/**
 * Колбэки UI и аудио для последовательного проигрывания очереди TraceEvent.
 */
export interface TracePlayerHandlers {
  translator: Translator;
  audio?: { playForTraceEvent(event: TraceEvent, comboIndex: number): void };
  onScore?(
    chips: number,
    mult: number,
    totalScore: number,
    targetScore: number,
    handType: HandType,
  ): void;
  onFormulaDelta?(delta: TraceFormulaDelta): void;
  onJuice?(target: TraceJuiceTarget): void;
  onConsumableTrigger?(payload: TraceConsumableTriggerPayload): void;
  onDollars?(totalDollars: number, delta: number): void;
  onHighlightCard?(cardId: string | null): void;
  onHighlightHandCard?(cardId: string | null): void;
  onHighlightRelic?(relicUid: string | null): void;
  onPopup?(popup: TracePopupPayload): void;
  onShatterCard?(cardId: string): void;
  onBanner?(text: string, tone: 'info' | 'boss' | 'win' | 'lose'): void;
}

/**
 * Дескриптор запущенной очереди воспроизведения событий.
 */
export interface TracePlayerHandle {
  readonly promise: Promise<void>;
  skip(): void;
  cancel(): void;
}

/**
 * Базовая длительность шага подсчёта на скорости 1x в миллисекундах.
 */
export const DEFAULT_BASE_STEP_MS = 640;

const SHATTER_LOC_KEYS: Readonly<Record<'glass' | 'scroll' | 'rune', TraceLocKey>> = {
  glass: 'card_shatter_glass',
  scroll: 'card_shatter_scroll',
  rune: 'card_shatter_rune',
};

const RELIC_DESTROY_LOC_KEYS: Readonly<
  Record<'ceremonial' | 'ramen' | 'hex' | 'sold', TraceLocKey>
> = {
  ceremonial: 'relic_destroyed_ceremonial',
  ramen: 'relic_destroyed_ramen',
  hex: 'relic_destroyed_hex',
  sold: 'relic_destroyed_sold',
};

/**
 * Нормализует множитель скорости анимации к допустимым значениям (по умолчанию 1).
 */
export function resolveSpeed(speed: AnimationSpeed | number | undefined): AnimationSpeed {
  if (speed === 0.5 || speed === 1 || speed === 2 || speed === 4) {
    return speed;
  }
  return 1;
}

/**
 * Возвращает длительность шага анимации в миллисекундах с учётом скорости 0.5x / 1x / 2x / 4x.
 */
export function getStepDelayMs(
  speed: AnimationSpeed = 1,
  baseMs: number = DEFAULT_BASE_STEP_MS,
): number {
  if (!Number.isFinite(baseMs) || baseMs <= 0) {
    return 0;
  }
  const resolvedSpeed = resolveSpeed(speed);
  return Math.max(1, Math.round(baseMs / resolvedSpeed));
}

/**
 * Преобразует внутренние идентификаторы в параметрах события в локализованные названия.
 */
function resolveLocParams(
  translator: Translator,
  rawParams?: Readonly<Record<string, string | number>>,
): MessageParams | undefined {
  if (!rawParams) {
    return undefined;
  }

  const resolved: Record<string, string | number> = { ...rawParams };

  if (typeof resolved.handName === 'string') {
    const handsMap = translator.catalog.hands as Readonly<Record<string, { readonly name: string }>>;
    const handEntry = handsMap[resolved.handName];
    if (handEntry) {
      resolved.handName = handEntry.name;
    }
  }

  if (typeof resolved.tagName === 'string') {
    const tagsMap = translator.catalog.tags as Readonly<Record<string, { readonly name: string }>>;
    const tagEntry = tagsMap[resolved.tagName];
    if (tagEntry) {
      resolved.tagName = tagEntry.name;
    }
  }

  return resolved;
}

/**
 * Формирует локализованный текст по ключу и параметрам события.
 */
function translateEventKey(
  translator: Translator,
  locKey: string,
  locParams?: Readonly<Record<string, string | number>>,
): string {
  return translator.t(locKey, resolveLocParams(translator, locParams));
}

/**
 * Форматирует строку дельты золота через словарь локализации без зашитых слов.
 */
function formatDollarsPopup(translator: Translator, delta: number): string {
  const formatted = translator.t('ui.hud.goldAmount', { dollars: Math.abs(delta) });
  if (delta > 0) {
    return `+${formatted}`;
  }
  if (delta < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

/**
 * Форматирует строку прибавки Множителя через сокращённую метку текущей локали.
 */
function formatMultPopup(translator: Translator, multDelta: number): string {
  const sign = multDelta > 0 ? '+' : '';
  return `${sign}${multDelta} ${translator.t('ui.hud.multShort')}`;
}

/**
 * Формирует строку прибавки Силы.
 */
function formatChipsPopup(chipsDelta: number): string {
  const sign = chipsDelta > 0 ? '+' : '';
  return `${sign}${chipsDelta}`;
}

/**
 * Проигрывает очередь TraceEvent последовательно с подсветками, поп-апами, баннерами и озвучиванием.
 */
export function playTraceEvents(
  events: readonly TraceEvent[],
  speed: AnimationSpeed = 1,
  handlers: TracePlayerHandlers,
): TracePlayerHandle {
  const resolvedSpeed = resolveSpeed(speed);
  const { translator } = handlers;

  let settled = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let index = 0;
  let comboIndex = 0;
  let lastHandLevelUpSignature: string | null = null;

  let activeCardId: string | null = null;
  let activeHandCardId: string | null = null;
  let activeRelicUid: string | null = null;

  let resolvePromise!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  const clearPendingTimer = (): void => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  const clearHighlights = (): void => {
    if (activeCardId !== null) {
      activeCardId = null;
      handlers.onHighlightCard?.(null);
    }
    if (activeHandCardId !== null) {
      activeHandCardId = null;
      handlers.onHighlightHandCard?.(null);
    }
    if (activeRelicUid !== null) {
      activeRelicUid = null;
      handlers.onHighlightRelic?.(null);
    }
  };

  const highlightCard = (cardId: string): void => {
    if (activeHandCardId !== null) {
      activeHandCardId = null;
      handlers.onHighlightHandCard?.(null);
    }
    if (activeRelicUid !== null) {
      activeRelicUid = null;
      handlers.onHighlightRelic?.(null);
    }
    activeCardId = cardId;
    handlers.onHighlightCard?.(cardId);
  };

  const highlightHandCard = (cardId: string): void => {
    if (activeCardId !== null) {
      activeCardId = null;
      handlers.onHighlightCard?.(null);
    }
    if (activeRelicUid !== null) {
      activeRelicUid = null;
      handlers.onHighlightRelic?.(null);
    }
    activeHandCardId = cardId;
    handlers.onHighlightHandCard?.(cardId);
  };

  const highlightRelic = (relicUid: string): void => {
    if (activeCardId !== null) {
      activeCardId = null;
      handlers.onHighlightCard?.(null);
    }
    if (activeHandCardId !== null) {
      activeHandCardId = null;
      handlers.onHighlightHandCard?.(null);
    }
    activeRelicUid = relicUid;
    handlers.onHighlightRelic?.(relicUid);
  };

  const finishPlayback = (): void => {
    if (settled) {
      return;
    }
    settled = true;
    clearPendingTimer();
    clearHighlights();
    resolvePromise();
  };

  const emitNumericPopups = (
    deltas: {
      readonly chipsDelta?: number;
      readonly multDelta?: number;
      readonly dollarsDelta?: number;
      readonly xMult?: number;
    },
    target: Pick<TracePopupPayload, 'targetCardId' | 'targetHandCardId' | 'targetRelicUid'>,
  ): boolean => {
    let emitted = false;

    if (deltas.chipsDelta !== undefined && deltas.chipsDelta !== 0) {
      handlers.onPopup?.({
        kind: 'chips',
        text: formatChipsPopup(deltas.chipsDelta),
        ...target,
      });
      emitted = true;
    }

    if (deltas.multDelta !== undefined && deltas.multDelta !== 0) {
      handlers.onPopup?.({
        kind: 'mult',
        text: formatMultPopup(translator, deltas.multDelta),
        ...target,
      });
      emitted = true;
    }

    if (deltas.dollarsDelta !== undefined && deltas.dollarsDelta !== 0) {
      handlers.onPopup?.({
        kind: 'dollars',
        text: formatDollarsPopup(translator, deltas.dollarsDelta),
        ...target,
      });
      emitted = true;
    }

    if (deltas.xMult !== undefined && deltas.xMult !== 1) {
      handlers.onPopup?.({
        kind: 'xmult',
        text: `×${deltas.xMult}`,
        ...target,
      });
      emitted = true;
    }

    return emitted;
  };

  /**
   * Уведомляет UI об изменении формулы (Сила / Множ) и запускает импульс juice_up на плитках HUD.
   */
  const emitFormulaJuice = (
    deltas: {
      readonly chipsDelta?: number;
      readonly multDelta?: number;
      readonly xMult?: number;
    },
    rotSign: number,
  ): void => {
    const chipsDelta = deltas.chipsDelta ?? 0;
    const multDelta = deltas.multDelta ?? 0;
    const xMult = deltas.xMult ?? 1;

    if (chipsDelta !== 0 || multDelta !== 0 || xMult !== 1) {
      handlers.onFormulaDelta?.({ chipsDelta, multDelta, xMult });
    }
    if (chipsDelta !== 0) {
      handlers.onJuice?.({ kind: 'chips', scaleDelta: 0.22, rotDelta: -0.05 * rotSign });
    }
    if (multDelta !== 0 || xMult !== 1) {
      handlers.onJuice?.({
        kind: 'mult',
        scaleDelta: xMult !== 1 ? 0.3 : 0.22,
        rotDelta: 0.06 * rotSign,
      });
    }
  };

  /**
   * Выполняет один шаг события в нормальном режиме и возвращает задержку перед следующим шагом.
   */
  const dispatchStep = (event: TraceEvent): number => {
    const rotSign = comboIndex % 2 === 0 ? 1 : -1;
    switch (event.type) {
      case 'CARD_TRIGGER': {
        highlightCard(event.cardId);
        handlers.onJuice?.({
          kind: 'card',
          cardId: event.cardId,
          scaleDelta: 0.26,
          rotDelta: 0.08 * rotSign,
        });
        emitFormulaJuice(event, rotSign);
        const emittedNumeric = emitNumericPopups(event, { targetCardId: event.cardId });
        if (!emittedNumeric && event.locKey) {
          handlers.onPopup?.({
            kind: 'tag',
            text: translateEventKey(translator, event.locKey, event.locParams),
            targetCardId: event.cardId,
          });
        }
        handlers.audio?.playForTraceEvent(event, comboIndex);
        comboIndex += 1;
        return getStepDelayMs(resolvedSpeed, DEFAULT_BASE_STEP_MS);
      }

      case 'HAND_CARD_TRIGGER': {
        highlightHandCard(event.cardId);
        handlers.onJuice?.({
          kind: 'hand_card',
          cardId: event.cardId,
          scaleDelta: 0.24,
          rotDelta: 0.07 * rotSign,
        });
        emitFormulaJuice(event, rotSign);
        const emittedNumeric = emitNumericPopups(event, { targetHandCardId: event.cardId });
        if (!emittedNumeric && event.locKey) {
          handlers.onPopup?.({
            kind: 'tag',
            text: translateEventKey(translator, event.locKey, event.locParams),
            targetHandCardId: event.cardId,
          });
        }
        handlers.audio?.playForTraceEvent(event, comboIndex);
        comboIndex += 1;
        return getStepDelayMs(resolvedSpeed, DEFAULT_BASE_STEP_MS);
      }

      case 'RELIC_TRIGGER': {
        const targetUid = event.copiedByUid ?? event.relicUid;
        highlightRelic(targetUid);
        handlers.onJuice?.({
          kind: 'relic',
          relicUid: targetUid,
          scaleDelta: 0.28,
          rotDelta: 0.1 * rotSign,
        });
        emitFormulaJuice(event, rotSign);
        const emittedNumeric = emitNumericPopups(event, { targetRelicUid: targetUid });
        if (!emittedNumeric && event.locKey) {
          handlers.onPopup?.({
            kind: 'tag',
            text: translateEventKey(translator, event.locKey, event.locParams),
            targetRelicUid: targetUid,
          });
        }
        handlers.audio?.playForTraceEvent(event, comboIndex);
        comboIndex += 1;
        return getStepDelayMs(resolvedSpeed, DEFAULT_BASE_STEP_MS);
      }

      case 'CONSUMABLE_TRIGGER': {
        clearHighlights();
        const isScoringXMult = event.xMult !== undefined && event.xMult !== 1;
        const levelSignature =
          event.locKey === 'hand_level_up' && event.handType
            ? `${event.handType}:${String(event.locParams?.level ?? '')}`
            : null;
        const alreadyAnnounced =
          levelSignature !== null && levelSignature === lastHandLevelUpSignature;
        lastHandLevelUpSignature = null;

        if (isScoringXMult) {
          emitFormulaJuice({ xMult: event.xMult }, rotSign);
          handlers.onPopup?.({
            kind: 'xmult',
            text: `×${event.xMult}`,
          });
        } else if (event.locKey && !alreadyAnnounced) {
          const text = translateEventKey(translator, event.locKey, event.locParams);
          handlers.onPopup?.({
            kind: event.locKey === 'hand_level_up' ? 'level' : 'tag',
            text,
          });
          handlers.onBanner?.(text, 'info');
        }
        if (!alreadyAnnounced) {
          handlers.onConsumableTrigger?.({
            consumableId: event.consumableId,
            consumableUid: event.consumableUid,
            targetCardIds: event.targetCardIds,
          });
        }
        handlers.audio?.playForTraceEvent(event, comboIndex);
        if (isScoringXMult) {
          comboIndex += 1;
        }
        if (alreadyAnnounced) {
          return 0;
        }
        return getStepDelayMs(resolvedSpeed, 680);
      }

      case 'SCORE_UPDATE': {
        clearHighlights();
        handlers.onScore?.(
          event.chips,
          event.mult,
          event.totalScore,
          event.targetScore,
          event.handType,
        );
        handlers.onJuice?.({ kind: 'chips', scaleDelta: 0.2, rotDelta: -0.05 });
        handlers.onJuice?.({ kind: 'mult', scaleDelta: 0.24, rotDelta: 0.05 });
        handlers.audio?.playForTraceEvent(event, comboIndex);
        comboIndex = 0;
        return getStepDelayMs(resolvedSpeed, 800);
      }

      case 'DOLLAR_DELTA': {
        handlers.onDollars?.(event.totalDollars, event.delta);
        if (event.source !== 'card' && event.source !== 'relic' && event.delta > 0) {
          handlers.onPopup?.({
            kind: 'dollars',
            text: formatDollarsPopup(translator, event.delta),
          });
        }
        handlers.audio?.playForTraceEvent(event, comboIndex);
        // Для карточных/реликвийных выплат пауза делается на самом CARD_TRIGGER/RELIC_TRIGGER
        if (event.source === 'card' || event.source === 'relic') {
          return 0;
        }
        return getStepDelayMs(resolvedSpeed, 500);
      }

      case 'CARD_SHATTER': {
        highlightCard(event.cardId);
        handlers.onJuice?.({
          kind: 'card',
          cardId: event.cardId,
          scaleDelta: 0.26,
          rotDelta: -0.2,
        });
        handlers.onShatterCard?.(event.cardId);
        handlers.onPopup?.({
          kind: 'shatter',
          text: translator.t(SHATTER_LOC_KEYS[event.reason]),
          targetCardId: event.cardId,
        });
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 720);
      }

      case 'CARD_ENHANCEMENT_STRIPPED': {
        highlightCard(event.cardId);
        handlers.onPopup?.({
          kind: 'debuff',
          text: translator.t('card_enhancement_stripped'),
          targetCardId: event.cardId,
        });
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 590);
      }

      case 'RELIC_DESTROYED': {
        highlightRelic(event.relicUid);
        handlers.onJuice?.({
          kind: 'relic',
          relicUid: event.relicUid,
          scaleDelta: 0.26,
          rotDelta: -0.2,
        });
        handlers.onPopup?.({
          kind: 'shatter',
          text: translator.t(RELIC_DESTROY_LOC_KEYS[event.reason]),
          targetRelicUid: event.relicUid,
        });
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, DEFAULT_BASE_STEP_MS);
      }

      case 'CARD_DEBUFFED': {
        highlightCard(event.cardId);
        handlers.onPopup?.({
          kind: 'debuff',
          text: translator.t(event.locKey ?? 'card_debuffed'),
          targetCardId: event.cardId,
        });
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 550);
      }

      case 'HAND_DEBUFFED': {
        clearHighlights();
        const text = translateEventKey(translator, event.locKey);
        handlers.onPopup?.({
          kind: 'debuff',
          text,
        });
        handlers.onBanner?.(text, 'boss');
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 760);
      }

      case 'BOSS_TRIGGER': {
        clearHighlights();
        const text = translateEventKey(translator, event.locKey, event.locParams);
        handlers.onPopup?.({
          kind: 'boss',
          text,
        });
        handlers.onBanner?.(text, 'boss');
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 760);
      }

      case 'TAG_TRIGGER': {
        clearHighlights();
        const rawParams = event.locParams ?? { tagName: event.tagId };
        const text = translateEventKey(translator, event.locKey, rawParams);
        handlers.onPopup?.({
          kind: 'tag',
          text,
        });
        handlers.onBanner?.(text, 'info');
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 680);
      }

      case 'HAND_LEVEL_UP': {
        clearHighlights();
        lastHandLevelUpSignature = `${event.handType}:${event.newLevel}`;
        const text = translateEventKey(translator, 'hand_level_up', {
          handName: event.handType,
          level: event.newLevel,
        });
        handlers.onPopup?.({
          kind: 'level',
          text,
        });
        handlers.onBanner?.(text, 'info');
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 680);
      }

      case 'BLIND_DEFEATED': {
        clearHighlights();
        handlers.onBanner?.(translator.t('blind_defeated'), 'win');
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 960);
      }

      case 'RUN_WON': {
        clearHighlights();
        handlers.onBanner?.(translator.t('run_won', { ante: event.ante }), 'win');
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 1040);
      }

      case 'RUN_LOST': {
        clearHighlights();
        handlers.onBanner?.(translator.t('run_lost', { ante: event.ante }), 'lose');
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 1040);
      }

      case 'PHASE_CHANGED': {
        clearHighlights();
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return 0;
      }
    }
  };

  /**
   * Применяет только обязательные эффекты состояния при мгновенном пропуске очереди через skip().
   */
  const applySkippedEvent = (event: TraceEvent): void => {
    switch (event.type) {
      case 'SCORE_UPDATE':
        handlers.onScore?.(
          event.chips,
          event.mult,
          event.totalScore,
          event.targetScore,
          event.handType,
        );
        break;
      case 'DOLLAR_DELTA':
        handlers.onDollars?.(event.totalDollars, event.delta);
        break;
      case 'CARD_SHATTER':
        handlers.onShatterCard?.(event.cardId);
        break;
      default:
        break;
    }
  };

  const processNext = (): void => {
    while (!settled) {
      if (index >= events.length) {
        finishPlayback();
        return;
      }

      const event = events[index]!;
      index += 1;

      const delayMs = dispatchStep(event);
      if (settled) {
        return;
      }

      if (delayMs > 0) {
        timerId = setTimeout(() => {
          timerId = null;
          processNext();
        }, delayMs);
        return;
      }
    }
  };

  processNext();

  return {
    promise,
    skip(): void {
      if (settled) {
        return;
      }
      clearPendingTimer();
      while (index < events.length) {
        const remainingEvent = events[index]!;
        index += 1;
        applySkippedEvent(remainingEvent);
      }
      finishPlayback();
    },
    cancel(): void {
      if (settled) {
        return;
      }
      finishPlayback();
    },
  };
}
