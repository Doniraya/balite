import type { AnimationSpeed, HandType, TraceEvent } from '../engine/types';
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

const DEFAULT_BASE_STEP_MS = 280;

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
 * Нормализует множитель скорости анимации к допустимым значениям (по умолчанию 2).
 */
function resolveSpeed(speed: AnimationSpeed | number | undefined): AnimationSpeed {
  if (speed === 1 || speed === 2 || speed === 4) {
    return speed;
  }
  return 2;
}

/**
 * Возвращает длительность шага анимации в миллисекундах с учётом скорости 1x / 2x / 4x.
 */
export function getStepDelayMs(
  speed: AnimationSpeed = 2,
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
  speed: AnimationSpeed = 2,
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
   * Выполняет один шаг события в нормальном режиме и возвращает задержку перед следующим шагом.
   */
  const dispatchStep = (event: TraceEvent): number => {
    switch (event.type) {
      case 'CARD_TRIGGER': {
        highlightCard(event.cardId);
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
        return getStepDelayMs(resolvedSpeed, 280);
      }

      case 'HAND_CARD_TRIGGER': {
        highlightHandCard(event.cardId);
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
        return getStepDelayMs(resolvedSpeed, 280);
      }

      case 'RELIC_TRIGGER': {
        const targetUid = event.copiedByUid ?? event.relicUid;
        highlightRelic(targetUid);
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
        return getStepDelayMs(resolvedSpeed, 280);
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
        handlers.audio?.playForTraceEvent(event, comboIndex);
        if (isScoringXMult) {
          comboIndex += 1;
        }
        if (alreadyAnnounced) {
          return 0;
        }
        return getStepDelayMs(resolvedSpeed, 300);
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
        handlers.audio?.playForTraceEvent(event, comboIndex);
        comboIndex = 0;
        return getStepDelayMs(resolvedSpeed, 360);
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
        return getStepDelayMs(resolvedSpeed, 220);
      }

      case 'CARD_SHATTER': {
        highlightCard(event.cardId);
        handlers.onShatterCard?.(event.cardId);
        handlers.onPopup?.({
          kind: 'shatter',
          text: translator.t(SHATTER_LOC_KEYS[event.reason]),
          targetCardId: event.cardId,
        });
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 320);
      }

      case 'CARD_ENHANCEMENT_STRIPPED': {
        highlightCard(event.cardId);
        handlers.onPopup?.({
          kind: 'debuff',
          text: translator.t('card_enhancement_stripped'),
          targetCardId: event.cardId,
        });
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 260);
      }

      case 'RELIC_DESTROYED': {
        highlightRelic(event.relicUid);
        handlers.onPopup?.({
          kind: 'shatter',
          text: translator.t(RELIC_DESTROY_LOC_KEYS[event.reason]),
          targetRelicUid: event.relicUid,
        });
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 280);
      }

      case 'CARD_DEBUFFED': {
        highlightCard(event.cardId);
        handlers.onPopup?.({
          kind: 'debuff',
          text: translator.t(event.locKey ?? 'card_debuffed'),
          targetCardId: event.cardId,
        });
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 240);
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
        return getStepDelayMs(resolvedSpeed, 340);
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
        return getStepDelayMs(resolvedSpeed, 340);
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
        return getStepDelayMs(resolvedSpeed, 300);
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
        return getStepDelayMs(resolvedSpeed, 300);
      }

      case 'BLIND_DEFEATED': {
        clearHighlights();
        handlers.onBanner?.(translator.t('blind_defeated'), 'win');
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 420);
      }

      case 'RUN_WON': {
        clearHighlights();
        handlers.onBanner?.(translator.t('run_won', { ante: event.ante }), 'win');
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 460);
      }

      case 'RUN_LOST': {
        clearHighlights();
        handlers.onBanner?.(translator.t('run_lost', { ante: event.ante }), 'lose');
        handlers.audio?.playForTraceEvent(event, comboIndex);
        return getStepDelayMs(resolvedSpeed, 460);
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
