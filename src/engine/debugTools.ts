// Чистые отладочные функции-мутации состояния забега RunState для Админ-панели (?debug) (Эпик 3).
import {
  buildAnteBlinds,
  redeemCharter,
  restoreBossEffectsOnRoundEnd,
  selectBossForAnte,
} from './catalog';
import { createConsumableInstance } from './consumables';
import {
  createRelicInstance,
  getRelicDefinition,
  resolveRelicTarget,
} from './relics';
import { evaluateRoundEnd } from './scoring';
import { appendShopTopShelfOffer } from './shop';
import type {
  CharterId,
  ConsumableId,
  Edition,
  Enhancement,
  RelicId,
  RunState,
  Seal,
} from './types';

/** Псевдоним типа идентификатора Грамоты для совместимости отладочного API. */
export type VoucherId = CharterId;

/** Параметры модификации карт в текущей руке. */
export interface DebugCardModsOptions {
  /** Идентификаторы карт в руке, 'all' для всей руки или пусто/undefined для первой карты. */
  readonly cardIds?: readonly string[] | 'all';
  /** Новое издание карты. */
  readonly edition?: Edition;
  /** Новое улучшение карты. */
  readonly enhancement?: Enhancement;
  /** Новая печать карты. */
  readonly seal?: Seal;
}

/** Параметры быстрого изменения ресурсов, Этапа и очков раунда. */
export interface DebugResourcesOptions {
  /** Прибавка к золоту. */
  readonly addDollars?: number;
  /** Прибавка к оставшимся рукам в раунде. */
  readonly addHands?: number;
  /** Прибавка к оставшимся сбросам в раунде. */
  readonly addDiscards?: number;
  /** Переключение текущего Этапа в диапазоне [1..8] с пересчётом Стражей. */
  readonly setAnte?: number;
  /** Прибавка к текущим очкам раунда. */
  readonly addScore?: number;
  /** Установка очков раунда как процента от целевого порога текущего Стража. */
  readonly targetPercent?: number;
}

/**
 * Изменяет издание, улучшение и/или печать у выбранных карт в руке.
 * Если cardIds не задан или пуст и не равен 'all', модифицирует первую карту в руке.
 */
export function applyDebugCardMods(
  state: RunState,
  options: DebugCardModsOptions,
): RunState {
  const { cardIds, edition, enhancement, seal } = options;
  if (
    edition === undefined &&
    enhancement === undefined &&
    seal === undefined
  ) {
    return state;
  }
  if (state.handIds.length === 0) {
    return state;
  }

  let targetIds: Set<string>;
  if (cardIds === 'all') {
    targetIds = new Set(state.handIds);
  } else if (Array.isArray(cardIds) && cardIds.length > 0) {
    const handSet = new Set(state.handIds);
    targetIds = new Set(cardIds.filter((id) => handSet.has(id)));
  } else {
    targetIds = new Set([state.handIds[0]]);
  }

  if (targetIds.size === 0) {
    return state;
  }

  let changed = false;
  const nextDeck = state.deck.map((card) => {
    if (!targetIds.has(card.id)) {
      return card;
    }
    changed = true;
    return {
      ...card,
      ...(edition !== undefined ? { edition } : {}),
      ...(enhancement !== undefined ? { enhancement } : {}),
      ...(seal !== undefined ? { seal } : {}),
    };
  });

  return changed ? { ...state, deck: nextDeck } : state;
}

/**
 * Выдаёт Реликвию с указанным изданием и безопасно расширяет лимит слотов при переполнении.
 * Для Теневого (negative) издания учитывает бонусный +1 слот без лишнего роста maxRelics.
 */
export function giveDebugRelic(
  state: RunState,
  relicId: RelicId,
  edition: Edition = 'base',
): RunState {
  const uid = `debug_relic_${state.nextCardUid}`;
  const relic = createRelicInstance(relicId, uid, edition, state.discountPercent);
  const nextRelics = [...state.relics, relic];
  const negativeCount = nextRelics.filter((r) => r.edition === 'negative').length;
  const nextMaxRelics = Math.max(state.maxRelics, nextRelics.length - negativeCount);

  return {
    ...state,
    relics: nextRelics,
    maxRelics: nextMaxRelics,
    nextCardUid: state.nextCardUid + 1,
  };
}

/**
 * Выдаёт расходник (Сферу, Свиток или Руну) с безопасным расширением слотов при нехватке места.
 */
export function giveDebugConsumable(
  state: RunState,
  consumableId: ConsumableId,
  edition: Edition = 'base',
): RunState {
  const uid = `debug_cons_${state.nextCardUid}`;
  const consumable = createConsumableInstance(
    consumableId,
    uid,
    edition,
    state.discountPercent,
  );
  const nextConsumables = [...state.consumables, consumable];
  const nextMaxConsumables = Math.max(
    state.maxConsumables,
    nextConsumables.length,
  );

  return {
    ...state,
    consumables: nextConsumables,
    maxConsumables: nextMaxConsumables,
    nextCardUid: state.nextCardUid + 1,
  };
}

/**
 * Активирует Гильдейскую грамоту в текущем забеге через штатную механику каталога.
 */
export function applyDebugVoucher(
  state: RunState,
  voucherId: VoucherId,
): RunState {
  const next = redeemCharter(state, voucherId);
  if (voucherId === 'v_overstock_norm' && next.shop) {
    return appendShopTopShelfOffer(next, {
      relicRegistry: getRelicDefinition,
      resolveRelicTarget,
    }).nextState;
  }
  return next;
}

/**
 * Изменяет деньги, руки, сбросы, Этап (1..8), очки раунда или процент от порога Стража.
 */
export function setDebugResources(
  state: RunState,
  options: DebugResourcesOptions,
): RunState {
  let work = state;

  if (options.setAnte !== undefined && Number.isFinite(options.setAnte)) {
    const clampedAnte = Math.max(1, Math.min(8, Math.trunc(options.setAnte)));
    const bossRes = selectBossForAnte(
      clampedAnte,
      work.bossUseCounts,
      work.rngState,
    );
    const blindsRes = buildAnteBlinds(
      clampedAnte,
      bossRes.bossId,
      bossRes.nextRngState,
      work.anteScaling,
    );
    work = {
      ...work,
      ante: clampedAnte,
      currentBlindIndex: 0,
      anteBlinds: blindsRes.anteBlinds,
      bossUseCounts: bossRes.nextBossUseCounts,
      bossRerollsThisAnte: 0,
      rngState: blindsRes.nextRngState,
      targetScore: blindsRes.anteBlinds[0].targetScore,
    };
  }

  if (options.addDollars !== undefined && Number.isFinite(options.addDollars)) {
    work = {
      ...work,
      dollars: Math.max(0, work.dollars + Math.trunc(options.addDollars)),
    };
  }

  if (options.addHands !== undefined && Number.isFinite(options.addHands)) {
    work = {
      ...work,
      handsLeft: Math.max(0, work.handsLeft + Math.trunc(options.addHands)),
    };
  }

  if (options.addDiscards !== undefined && Number.isFinite(options.addDiscards)) {
    work = {
      ...work,
      discardsLeft: Math.max(0, work.discardsLeft + Math.trunc(options.addDiscards)),
    };
  }

  if (options.targetPercent !== undefined && Number.isFinite(options.targetPercent)) {
    const pct = Math.max(0, options.targetPercent) / 100;
    const nextScore =
      options.targetPercent >= 100
        ? Math.ceil(work.targetScore * pct)
        : Math.round(work.targetScore * pct);
    work = {
      ...work,
      score: Math.max(0, nextScore),
    };
  }

  if (options.addScore !== undefined && Number.isFinite(options.addScore)) {
    work = {
      ...work,
      score: Math.max(0, work.score + Math.trunc(options.addScore)),
    };
  }

  return work;
}

/**
 * Мгновенно добирает порог текущего Стража и переводит забег на экран награды (cashout).
 */
export function forceDebugBlindWin(state: RunState): RunState {
  const prepared: RunState = {
    ...state,
    score: Math.max(state.score, state.targetScore),
    previousPhase: null,
  };

  const roundEndRes = evaluateRoundEnd(prepared, {
    relicRegistry: getRelicDefinition,
    resolveRelicTarget,
  });

  const slot = prepared.anteBlinds[prepared.currentBlindIndex];
  const wasManacleHandledByEval =
    slot.kind === 'boss' &&
    slot.bossId === 'bl_manacle' &&
    !prepared.activeBossDisabled;

  const restored = restoreBossEffectsOnRoundEnd(
    {
      ...roundEndRes.nextState,
      activeBossDisabled: wasManacleHandledByEval
        ? true
        : roundEndRes.nextState.activeBossDisabled,
      savedBossDiscards: prepared.savedBossDiscards,
    },
    true,
  );

  const idx = restored.currentBlindIndex;
  const shouldAdvanceAnte =
    idx === 2 && !(restored.ante === 8 && !restored.endlessMode);
  const nextBlinds: RunState['anteBlinds'] = [
    idx === 0
      ? { ...restored.anteBlinds[0], status: 'defeated' }
      : restored.anteBlinds[0],
    idx === 1
      ? { ...restored.anteBlinds[1], status: 'defeated' }
      : restored.anteBlinds[1],
    idx === 2
      ? { ...restored.anteBlinds[2], status: 'defeated' }
      : restored.anteBlinds[2],
  ];

  return {
    ...restored,
    ante: shouldAdvanceAnte ? restored.ante + 1 : restored.ante,
    anteBlinds: nextBlinds,
    drawPileIds: restored.deck.map((card) => card.id),
    handIds: [],
    discardPileIds: [],
    booster: null,
    phase: 'cashout',
    previousPhase: null,
  };
}

/**
 * Переводит забег напрямую в финальный экран победы или поражения.
 */
export function forceDebugRunEnd(
  state: RunState,
  outcome: 'victory' | 'game_over',
): RunState {
  const cleaned = restoreBossEffectsOnRoundEnd(state, outcome === 'victory');
  return {
    ...cleaned,
    score:
      outcome === 'victory'
        ? Math.max(cleaned.score, cleaned.targetScore)
        : cleaned.score,
    cashout: null,
    booster: null,
    phase: outcome,
    previousPhase: null,
  };
}
