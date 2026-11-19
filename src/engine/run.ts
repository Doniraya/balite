import { createStandardDeck, sortCardsByRank, sortCardsBySuit } from './cards';
import {
  applyBossDebuffsToDeck,
  applyBossOnBlindSelect,
  applyDeckStartingParams,
  applyFinalBellSelection,
  BOSS_DEFINITIONS,
  buildAnteBlinds,
  grantSkipTag,
  redeemCharter,
  restoreBossEffectsOnRoundEnd,
  selectBossForAnte,
} from './catalog';
import {
  applyConsumable,
  canUseConsumable,
  createConsumableInstance,
} from './consumables';
import { isDailyRunSeed } from './daily';
import { createInitialHandLevels, getBlindAmount } from './handEval';
import { createRngState, shuffleDeckIds } from './prng';
import { getRelicDefinition, resolveRelicTarget } from './relics';
import { SAVE_SCHEMA_VERSION } from './save';
import { evaluatePlay, evaluateRoundEnd } from './scoring';
import {
  appendShopTopShelfOffer,
  canAffordCost,
  createShopState,
  freeRerollShopState,
  generateBoosterState,
  pickPoolConsumable,
  rerollShopState,
} from './shop';
import type {
  BlindSlotState,
  BoosterChoice,
  DeckId,
  DispatchResult,
  DollarDeltaSource,
  GameCommand,
  HandSortMode,
  PackOffer,
  PlayingCard,
  RelicEffectResult,
  RelicHookContextFor,
  RunPhase,
  RunState,
  ShopState,
  TagId,
  TraceEvent,
} from './types';

/**
 * Обычный (нетерминальный) предел количества слотов Реликвий с учётом Теневого издания.
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
 * Эффективный предел слотов Расходников с учётом Теневого издания.
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
 * Проверяет, завершён ли забег победой или поражением.
 */
function isTerminalPhase(phase: RunPhase): boolean {
  return phase === 'victory' || phase === 'game_over';
}

/**
 * Проверяет, является ли candidate строгой перестановкой набора уникальных строк baseline.
 */
function isStrictPermutation(candidate: readonly string[], baseline: readonly string[]): boolean {
  if (candidate.length !== baseline.length) {
    return false;
  }
  const baseSet = new Set(baseline);
  const seen = new Set<string>();
  for (const id of candidate) {
    if (!baseSet.has(id) || seen.has(id)) {
      return false;
    }
    seen.add(id);
  }
  return seen.size === baseSet.size;
}

/**
 * Создаёт быструю таблицу поиска карт колоды по идентификатору.
 */
function buildCardLookup(deck: readonly PlayingCard[]): Map<string, PlayingCard> {
  const lookup = new Map<string, PlayingCard>();
  for (const card of deck) {
    lookup.set(card.id, card);
  }
  return lookup;
}

/**
 * Возвращает идентификатор активного в данный момент Босса или null.
 */
function getActiveBossId(state: RunState) {
  if (state.activeBossDisabled) return null;
  const slot = state.anteBlinds[state.currentBlindIndex];
  return slot.kind === 'boss' ? slot.bossId : null;
}

/**
 * Изменяет баланс золота игрока, обновляет статистику трат и записывает DOLLAR_DELTA.
 */
function applyDollarChange(
  state: RunState,
  delta: number,
  source: DollarDeltaSource,
  events: TraceEvent[],
): RunState {
  if (delta === 0) {
    return state;
  }

  const nextDollars = state.dollars + delta;
  const nextState: RunState = {
    ...state,
    dollars: nextDollars,
    stats:
      delta < 0
        ? {
            ...state.stats,
            dollarsSpent: state.stats.dollarsSpent + Math.abs(delta),
          }
        : state.stats,
  };

  events.push({
    type: 'DOLLAR_DELTA',
    delta,
    totalDollars: nextDollars,
    source,
  });

  return nextState;
}

/**
 * Снимает флаг forcedSelection со всех карт колоды, которых больше нет в руке.
 */
function clearStaleForcedSelections(state: RunState): RunState {
  const handSet = new Set(state.handIds);
  let changed = false;
  const nextDeck = state.deck.map((card) => {
    if (card.forcedSelection && !handSet.has(card.id)) {
      changed = true;
      return { ...card, forcedSelection: false };
    }
    return card;
  });

  return changed ? { ...state, deck: nextDeck } : state;
}

/**
 * Сортирует список идентификаторов карт в руке по выбранному режиму ('rank' | 'suit').
 */
function sortHandIdsByMode(
  deck: readonly PlayingCard[],
  ids: readonly string[],
  mode: HandSortMode = 'rank',
): string[] {
  if (ids.length <= 1) {
    return [...ids];
  }
  const cardMap = buildCardLookup(deck);
  const cards = ids
    .map((id) => cardMap.get(id))
    .filter((card): card is PlayingCard => card !== undefined);
  const sorted = mode === 'rank' ? sortCardsByRank(cards) : sortCardsBySuit(cards);
  return sorted.map((card) => card.id);
}

/**
 * Сортирует временную руку открытого бустера по текущему режиму сортировки.
 */
function sortBoosterHandIfPresent(state: RunState): RunState {
  if (!state.booster || state.booster.drawnHandCardIds.length === 0) {
    return state;
  }
  return {
    ...state,
    booster: {
      ...state.booster,
      drawnHandCardIds: sortHandIdsByMode(
        state.deck,
        state.booster.drawnHandCardIds,
        state.handSortMode ?? 'rank',
      ),
    },
  };
}

/**
 * Возвращает выжившие карты временной руки бустера в противоположный конец drawPileIds.
 */
function returnBoosterHandToDrawPile(state: RunState): RunState {
  const drawn = state.booster?.drawnHandCardIds;
  if (!drawn || drawn.length === 0 || state.previousPhase === 'playing') {
    return state;
  }

  const deckSet = new Set(state.deck.map((card) => card.id));
  const occupied = new Set([
    ...state.drawPileIds,
    ...state.handIds,
    ...state.discardPileIds,
  ]);
  const returningIds = drawn.filter((id) => deckSet.has(id) && !occupied.has(id));
  if (returningIds.length === 0) {
    return state;
  }

  return {
    ...state,
    drawPileIds: [...state.drawPileIds, ...returningIds],
  };
}

/**
 * Добирает карты из drawPileIds в handIds до текущего эффективного размера руки
 * и автоматически сортирует руку по текущему handSortMode.
 */
function replenishHandFromDrawPile(state: RunState): RunState {
  const effectiveHandSize = Math.max(0, state.handSize + state.tempHandSizeBonus);
  const missingCount = Math.max(0, effectiveHandSize - state.handIds.length);
  if (missingCount === 0 || state.drawPileIds.length === 0) {
    return state;
  }

  const drawCount = Math.min(missingCount, state.drawPileIds.length);
  const drawn = state.drawPileIds.slice(0, drawCount);
  const rest = state.drawPileIds.slice(drawCount);

  return {
    ...state,
    drawPileIds: rest,
    handIds: sortHandIdsByMode(
      state.deck,
      [...state.handIds, ...drawn],
      state.handSortMode ?? 'rank',
    ),
  };
}

/**
 * Применяет эффекты результата хука Реликвии вне фазы подсчёта очков.
 */
function applyNonScoringRelicEffects(
  state: RunState,
  resolved: NonNullable<ReturnType<typeof resolveRelicTarget>>,
  result: RelicEffectResult,
  events: TraceEvent[],
): RunState {
  let current = state;

  if (result.updatedEffectState) {
    current = {
      ...current,
      relics: current.relics.map((relic) =>
        relic.uid === resolved.effectRelic.uid
          ? { ...relic, state: result.updatedEffectState! }
          : relic,
      ),
    };
  }

  if (result.dollarsDelta) {
    current = applyDollarChange(current, result.dollarsDelta, 'relic', events);
  }

  if (result.destroyRightRelic && result.destroyedRelicUid) {
    const victim = current.relics.find((relic) => relic.uid === result.destroyedRelicUid);
    if (victim) {
      current = {
        ...current,
        relics: current.relics.filter((relic) => relic.uid !== victim.uid),
      };
      events.push({
        type: 'RELIC_DESTROYED',
        relicUid: victim.uid,
        relicId: victim.id,
        reason: 'ceremonial',
      });
    }
  }

  if (result.destroySelf && !resolved.isBlueprintCopy) {
    const victim = current.relics.find((relic) => relic.uid === resolved.effectRelic.uid);
    if (victim) {
      current = {
        ...current,
        relics: current.relics.filter((relic) => relic.uid !== victim.uid),
      };
      events.push({
        type: 'RELIC_DESTROYED',
        relicUid: victim.uid,
        relicId: victim.id,
        reason: victim.id === 'j_ramen' ? 'ramen' : 'ceremonial',
      });
    }
  }

  return current;
}

/**
 * Вызывает указанный внебоевой/сбросовый хук слева направо по всем слотам Реликвий.
 */
function runRelicHookSweep<
  H extends
    | 'onBlindSelect'
    | 'onPreDiscard'
    | 'onDiscard'
    | 'onCardAdded'
    | 'onRemovePlayingCards',
>(
  state: RunState,
  hook: H,
  buildContext: (
    resolved: NonNullable<ReturnType<typeof resolveRelicTarget>>,
    slotIndex: number,
    currentState: RunState,
  ) => RelicHookContextFor<H>,
  events: TraceEvent[],
  onResult?: (result: RelicEffectResult) => void,
): RunState {
  let current = state;
  const slotUids = current.relics.map((relic) => relic.uid);

  for (const slotUid of slotUids) {
    const slotIndex = current.relics.findIndex((relic) => relic.uid === slotUid);
    if (slotIndex === -1) continue;

    const resolved = resolveRelicTarget(current.relics, slotIndex, getRelicDefinition);
    if (!resolved) continue;

    const definition = getRelicDefinition(resolved.effectRelic.id);
    const handler = definition.hooks[hook];
    if (!handler) continue;

    const ctx = buildContext(resolved, slotIndex, current);
    const result = handler(ctx as never);
    if (!result) continue;

    onResult?.(result);
    current = applyNonScoringRelicEffects(current, resolved, result, events);

    if (
      result.updatedEffectState ||
      result.dollarsDelta ||
      result.locKey ||
      result.destroyRightRelic ||
      result.destroySelf
    ) {
      events.push({
        type: 'RELIC_TRIGGER',
        relicUid: resolved.effectRelic.uid,
        relicId: resolved.effectRelic.id,
        ...(resolved.isBlueprintCopy ? { copiedByUid: resolved.stateRelic.uid } : {}),
        hook,
        ...(result.dollarsDelta ? { dollarsDelta: result.dollarsDelta } : {}),
        ...(result.locKey ? { locKey: result.locKey } : {}),
        ...(result.locParams ? { locParams: result.locParams } : {}),
      });
    }
  }

  return current;
}

/**
 * Формирует бесплатный Мега-набор Свитков для Знака Прорицания (tag_charm).
 */
function createFreeArcanaMegaPack(uidNumber: number): PackOffer {
  return {
    uid: `tag_pack_${uidNumber}`,
    packId: 'p_arcana_mega',
    type: 'arcana',
    size: 'mega',
    cost: 0,
    baseCost: 8,
    totalCards: 5,
    chooseCount: 2,
    purchased: true,
  };
}

/**
 * Удаляет первое вхождение указанного Знака из очереди pendingTags.
 */
function removeFirstTag(tags: readonly TagId[], target: TagId): TagId[] {
  const index = tags.indexOf(target);
  if (index === -1) return [...tags];
  return [...tags.slice(0, index), ...tags.slice(index + 1)];
}

/**
 * Открывает серию бесплатных Мега-наборов Свитков от tag_charm с поддержкой дублей в pendingTags.
 */
function openTagCharmBoosters(
  state: RunState,
  count: number,
  returnPhase: RunPhase,
  events: TraceEvent[],
): RunState {
  const packOffer = createFreeArcanaMegaPack(state.nextCardUid);
  let work: RunState = {
    ...state,
    nextCardUid: state.nextCardUid + 1,
    previousPhase: returnPhase,
  };

  if (count > 1) {
    const queuedCharms = Array.from({ length: count - 1 }, (): TagId => 'tag_charm');
    work = {
      ...work,
      pendingTags: [...work.pendingTags, ...queuedCharms],
    };
  }

  const boosterRes = generateBoosterState(work, packOffer, true);
  events.push(...boosterRes.events);

  const nextState = sortBoosterHandIfPresent({
    ...boosterRes.nextState,
    phase: 'booster',
    previousPhase: returnPhase,
  });

  if (state.phase !== 'booster') {
    events.push({
      type: 'PHASE_CHANGED',
      from: state.phase,
      to: 'booster',
    });
  }

  return nextState;
}

/**
 * Закрывает текущий бустер или открывает следующий отложенный бесплатный набор tag_charm.
 */
function closeOrAdvanceBooster(state: RunState, events: TraceEvent[]): RunState {
  const withReturnedHand = returnBoosterHandToDrawPile(state);

  if (withReturnedHand.booster?.fromTag && withReturnedHand.pendingTags.includes('tag_charm')) {
    const returnPhase = withReturnedHand.previousPhase ?? 'blind_select';
    const withTagConsumed: RunState = {
      ...withReturnedHand,
      pendingTags: removeFirstTag(withReturnedHand.pendingTags, 'tag_charm'),
    };
    const packOffer = createFreeArcanaMegaPack(withTagConsumed.nextCardUid);
    const boosterRes = generateBoosterState(
      { ...withTagConsumed, nextCardUid: withTagConsumed.nextCardUid + 1 },
      packOffer,
      true,
    );
    events.push(...boosterRes.events);
    return sortBoosterHandIfPresent({
      ...boosterRes.nextState,
      phase: 'booster',
      previousPhase: returnPhase,
    });
  }

  const targetPhase = withReturnedHand.previousPhase ?? 'shop';
  events.push({
    type: 'PHASE_CHANGED',
    from: 'booster',
    to: targetPhase,
  });

  return {
    ...withReturnedHand,
    phase: targetPhase,
    previousPhase: null,
    booster: null,
  };
}

/**
 * Обновляет статус указанного слота Стража на карте текущего Этапа.
 */
function updateBlindSlotStatus(
  blinds: readonly [BlindSlotState, BlindSlotState, BlindSlotState],
  index: 0 | 1 | 2,
  status: BlindSlotState['status'],
): readonly [BlindSlotState, BlindSlotState, BlindSlotState] {
  return blinds.map((slot, idx) =>
    idx === index ? { ...slot, status } : slot,
  ) as unknown as readonly [BlindSlotState, BlindSlotState, BlindSlotState];
}

/**
 * Проверяет наличие невыбранной принудительной карты Босса Костяного колокола в руке.
 */
function violatesFinalBellConstraint(state: RunState, selectedCardIds: readonly string[]): boolean {
  if (getActiveBossId(state) !== 'bl_final_bell') {
    return false;
  }

  const handSet = new Set(state.handIds);
  const selectedSet = new Set(selectedCardIds);
  for (const card of state.deck) {
    if (handSet.has(card.id) && card.forcedSelection && !selectedSet.has(card.id)) {
      return true;
    }
  }
  return false;
}

/**
 * Выполняет безопасную очистку в конце победного раунда без двойного возврата размера руки для bl_manacle.
 */
function finalizeWonRoundState(stateBeforeRoundEnd: RunState, roundEndState: RunState): RunState {
  const slot = stateBeforeRoundEnd.anteBlinds[stateBeforeRoundEnd.currentBlindIndex];
  const wasManacleHandledByEval =
    slot.kind === 'boss' &&
    slot.bossId === 'bl_manacle' &&
    !stateBeforeRoundEnd.activeBossDisabled;

  // Передаём временный флаг activeBossDisabled, если evaluateRoundEnd уже вернул +1 к handSize
  const restored = restoreBossEffectsOnRoundEnd(
    {
      ...roundEndState,
      activeBossDisabled: wasManacleHandledByEval ? true : roundEndState.activeBossDisabled,
      savedBossDiscards: stateBeforeRoundEnd.savedBossDiscards,
    },
    true,
  );

  const allCardIds = restored.deck.map((card) => card.id);
  const defeatedSlot = restored.anteBlinds[restored.currentBlindIndex];
  // По правилам оригинала ease_ante(1) срабатывает сразу при победе над Боссом (кроме экрана победы Этапа 8)
  const shouldAdvanceAnte =
    defeatedSlot.kind === 'boss' && !(restored.ante === 8 && !restored.endlessMode);

  return {
    ...restored,
    ante: shouldAdvanceAnte ? restored.ante + 1 : restored.ante,
    anteBlinds: updateBlindSlotStatus(
      restored.anteBlinds,
      restored.currentBlindIndex,
      'defeated',
    ),
    drawPileIds: allCardIds,
    handIds: [],
    discardPileIds: [],
  };
}

/**
 * Переводит проигранный раунд в фазу game_over и восстанавливает временные эффекты Босса.
 */
function finalizeLostRoundState(state: RunState, events: TraceEvent[]): RunState {
  const slot = state.anteBlinds[state.currentBlindIndex];
  const cleaned = restoreBossEffectsOnRoundEnd(state, false);
  const lostState: RunState = {
    ...cleaned,
    phase: 'game_over',
    previousPhase: null,
  };
  events.push({
    type: 'RUN_LOST',
    ante: lostState.ante,
    blindKind: slot.kind,
    finalScore: lostState.score,
    targetScore: lostState.targetScore,
  });
  events.push({
    type: 'PHASE_CHANGED',
    from: 'playing',
    to: 'game_over',
  });
  return lostState;
}

/**
 * Сохраняет облегчённую оболочку магазина с текущей Грамотой этапа между раундами одного Этапа и переходом.
 */
function compactShopForNextRound(state: RunState): ShopState | null {
  if (!state.shop?.voucher) {
    return null;
  }
  return {
    offers: [],
    voucher: state.shop.voucher,
    packs: [],
    rerollCost: state.baseRerollCost,
    tempRerollCost: null,
    rerollsUsedThisShop: 0,
    adRerollUsed: false,
  };
}

/**
 * Переводит состояние на следующий узел текущего Этапа или генерирует новый Этап после Босса.
 */
function advanceToNextBlindOrAnte(state: RunState): RunState {
  const compactShop = compactShopForNextRound(state);

  if (state.currentBlindIndex < 2) {
    const nextIndex = (state.currentBlindIndex + 1) as 0 | 1 | 2;
    return {
      ...state,
      currentBlindIndex: nextIndex,
      anteBlinds: updateBlindSlotStatus(state.anteBlinds, nextIndex, 'current'),
      targetScore: state.anteBlinds[nextIndex].targetScore,
      score: 0,
      handsPlayedThisRound: {},
      cashout: null,
      shop: compactShop,
      phase: 'blind_select',
      previousPhase: null,
    };
  }

  // Анте уже увеличено при победе над Боссом (или при переходе в Бесконечный режим)
  const nextAnte = state.ante;
  const bossRes = selectBossForAnte(nextAnte, state.bossUseCounts, state.rngState);
  const blindsRes = buildAnteBlinds(
    nextAnte,
    bossRes.bossId,
    bossRes.nextRngState,
    state.anteScaling,
  );

  return {
    ...state,
    ante: nextAnte,
    currentBlindIndex: 0,
    anteBlinds: blindsRes.anteBlinds,
    bossUseCounts: bossRes.nextBossUseCounts,
    bossRerollsThisAnte: 0,
    rngState: blindsRes.nextRngState,
    targetScore: blindsRes.anteBlinds[0].targetScore,
    score: 0,
    handsPlayedThisRound: {},
    cashout: null,
    shop: compactShop,
    phase: 'blind_select',
    previousPhase: null,
  };
}

/**
 * Создаёт детерминированное начальное состояние нового забега в фазе выбора Стража Этапа 1.
 */
export function createInitialRunState(deckId: DeckId, seed: string): RunState {
  const starting = applyDeckStartingParams(deckId);
  const initialRng = createRngState(seed);
  const bossRes = selectBossForAnte(1, {}, initialRng);
  const blindsRes = buildAnteBlinds(1, bossRes.bossId, bossRes.nextRngState, 1);
  const deck = createStandardDeck(1);
  // Тасуем стартовую колоду, чтобы ранние бустеры (например, tag_charm) тянули случайные карты
  const initialShuffle = shuffleDeckIds(
    blindsRes.nextRngState,
    'shuffle',
    deck.map((card) => card.id),
  );

  return {
    version: SAVE_SCHEMA_VERSION,
    seed,
    rngState: initialShuffle.nextState,
    deckId: starting.deckId,
    phase: 'blind_select',
    previousPhase: null,
    ante: 1,
    round: 0,
    currentBlindIndex: 0,
    anteBlinds: blindsRes.anteBlinds,
    bossUseCounts: bossRes.nextBossUseCounts,
    bossRerollsThisAnte: 0,
    activeBossDisabled: false,
    savedBossDiscards: null,
    endlessMode: false,
    probabilitiesNormal: 1,
    anteScaling: 1,
    score: 0,
    targetScore: blindsRes.anteBlinds[0].targetScore,
    dollars: starting.dollars,
    handsLeft: starting.handsLeft,
    maxHands: starting.maxHands,
    discardsLeft: starting.discardsLeft,
    maxDiscards: starting.maxDiscards,
    handSize: starting.handSize,
    tempHandSizeBonus: 0,
    maxRelics: starting.maxRelics,
    maxConsumables: starting.maxConsumables,
    baseRerollCost: starting.baseRerollCost,
    interestCap: starting.interestCap,
    shopSlots: starting.shopSlots,
    discountPercent: starting.discountPercent,
    editionRate: starting.editionRate,
    deck,
    drawPileIds: initialShuffle.value,
    handIds: [],
    handSortMode: 'rank',
    discardPileIds: [],
    relics: [],
    consumables: [],
    charters: [],
    pendingTags: [],
    skipsCount: 0,
    handsPlayedThisRound: {},
    handLevels: createInitialHandLevels(),
    lastUsedConsumableId: null,
    lastPlayedHandType: null,
    shop: null,
    shopVisits: 0,
    booster: null,
    cashout: null,
    nextCardUid: deck.length + 1,
    reviveUsed: false,
    stats: {
      bestHandScore: 0,
      bestHandType: null,
      handsPlayed: 0,
      cardsPlayed: 0,
      discardsUsed: 0,
      cardsDiscarded: 0,
      cardsPurchased: 0,
      rerollsCount: 0,
      cardsDestroyed: 0,
      dollarsSpent: 0,
    },
  };
}

/**
 * Обрабатывает выбор текущего Стража и переход в фазу раунда ('playing').
 */
function handleSelectBlind(state: RunState): DispatchResult {
  if (state.phase !== 'blind_select') {
    return { nextState: state, events: [] };
  }

  const events: TraceEvent[] = [];
  const nextBlinds = updateBlindSlotStatus(
    state.anteBlinds,
    state.currentBlindIndex,
    'current',
  );

  let work: RunState = {
    ...state,
    phase: 'playing',
    previousPhase: null,
    round: state.round + 1,
    score: 0,
    handsLeft: state.maxHands,
    discardsLeft: state.maxDiscards,
    handsPlayedThisRound: {},
    cashout: null,
    activeBossDisabled: false,
    savedBossDiscards: null,
    anteBlinds: nextBlinds,
  };

  events.push({
    type: 'PHASE_CHANGED',
    from: 'blind_select',
    to: 'playing',
  });

  // Сначала активируется Босс (дебаффы, 0 сбросов, -1 размер руки), затем хук Реликвий onBlindSelect
  const bossRes = applyBossOnBlindSelect(work);
  work = bossRes.nextState;
  events.push(...bossRes.events);

  const activeSlot = work.anteBlinds[work.currentBlindIndex];
  work = runRelicHookSweep(
    work,
    'onBlindSelect',
    (resolved, slotIndex, currentState) => ({
      hook: 'onBlindSelect',
      state: currentState,
      effectRelic: resolved.effectRelic,
      stateRelic: resolved.stateRelic,
      relicIndex: slotIndex,
      isBlueprintCopy: resolved.isBlueprintCopy,
      blind: activeSlot,
    }),
    events,
  );

  // Применяем отложенные tag_juggle перед первой сдачей руки нового раунда (round_start_bonus)
  const juggleCount = work.pendingTags.filter((tag) => tag === 'tag_juggle').length;
  if (juggleCount > 0) {
    work = {
      ...work,
      pendingTags: work.pendingTags.filter((tag) => tag !== 'tag_juggle'),
      tempHandSizeBonus: work.tempHandSizeBonus + 3 * juggleCount,
    };
    for (let i = 0; i < juggleCount; i += 1) {
      events.push({
        type: 'TAG_TRIGGER',
        tagId: 'tag_juggle',
        locKey: 'tag_activated',
        locParams: { tagName: 'tag_juggle' },
      });
    }
  }

  const shuffled = shuffleDeckIds(
    work.rngState,
    `nr${work.ante}`,
    work.deck.map((card) => card.id),
  );
  work = {
    ...work,
    rngState: shuffled.nextState,
    drawPileIds: shuffled.value,
    handIds: [],
    discardPileIds: [],
  };

  work = replenishHandFromDrawPile(work);

  if (work.handIds.length === 0) {
    return { nextState: finalizeLostRoundState(work, events), events };
  }

  const bellRes = applyFinalBellSelection(work);
  work = bellRes.nextState;
  events.push(...bellRes.events);

  return { nextState: work, events };
}

/**
 * Обрабатывает пропуск Малого или Старшего Стража с выдачей Знака пропуска.
 */
function handleSkipBlind(state: RunState): DispatchResult {
  if (state.phase !== 'blind_select') {
    return { nextState: state, events: [] };
  }

  const slot = state.anteBlinds[state.currentBlindIndex];
  if (slot.kind === 'boss' || slot.skipTagId === null || state.currentBlindIndex >= 2) {
    return { nextState: state, events: [] };
  }

  const nextIndex = (state.currentBlindIndex + 1) as 0 | 1 | 2;
  const skippedBlinds = updateBlindSlotStatus(state.anteBlinds, state.currentBlindIndex, 'skipped');
  const nextBlinds = updateBlindSlotStatus(skippedBlinds, nextIndex, 'current');

  const prepared: RunState = {
    ...state,
    anteBlinds: nextBlinds,
    currentBlindIndex: nextIndex,
    targetScore: nextBlinds[nextIndex].targetScore,
    skipsCount: state.skipsCount + 1,
  };

  const tagResult = grantSkipTag(prepared, slot.skipTagId);
  const events: TraceEvent[] = [...tagResult.events];
  let nextState = tagResult.nextState;

  if (tagResult.openFreeArcanaMegaPackCount > 0) {
    nextState = openTagCharmBoosters(
      nextState,
      tagResult.openFreeArcanaMegaPackCount,
      'blind_select',
      events,
    );
  }

  return { nextState, events };
}

/**
 * Обрабатывает переброс Босса Этапа по Грамоте Указа смены врага (v_directors_cut, 10 з., 1 раз за Этап).
 */
function handleRerollBoss(state: RunState): DispatchResult {
  if (state.phase !== 'blind_select') {
    return { nextState: state, events: [] };
  }
  if (!state.charters.includes('v_directors_cut') || state.bossRerollsThisAnte >= 1) {
    return { nextState: state, events: [] };
  }
  if (!canAffordCost(state, 10)) {
    return { nextState: state, events: [] };
  }

  const bossSlot = state.anteBlinds[2];
  if (bossSlot.status !== 'upcoming' && bossSlot.status !== 'current') {
    return { nextState: state, events: [] };
  }

  const events: TraceEvent[] = [];
  let work = applyDollarChange(state, -10, 'reroll', events);

  const prevBossId = bossSlot.bossId;
  // Временно завышаем счётчик текущего Босса, чтобы исключить повтор при наличии альтернативы
  const adjustedCounts =
    prevBossId !== null
      ? { ...work.bossUseCounts, [prevBossId]: (work.bossUseCounts[prevBossId] ?? 0) + 1000 }
      : work.bossUseCounts;

  const bossPick = selectBossForAnte(work.ante, adjustedCounts, work.rngState);
  const newBossId = bossPick.bossId;
  const bossDef = BOSS_DEFINITIONS[newBossId];
  const baseAnteScore = getBlindAmount(work.ante, 1);
  const newBossTarget = Math.floor(baseAnteScore * bossDef.targetMultiplier * work.anteScaling);

  const updatedBossSlot: BlindSlotState = {
    ...bossSlot,
    bossId: newBossId,
    targetScore: newBossTarget,
    reward: bossDef.reward,
  };

  const nextBlinds: readonly [BlindSlotState, BlindSlotState, BlindSlotState] = [
    work.anteBlinds[0],
    work.anteBlinds[1],
    updatedBossSlot,
  ];

  work = {
    ...work,
    rngState: bossPick.nextRngState,
    bossUseCounts: {
      ...work.bossUseCounts,
      [newBossId]: (work.bossUseCounts[newBossId] ?? 0) + 1,
    },
    bossRerollsThisAnte: work.bossRerollsThisAnte + 1,
    anteBlinds: nextBlinds,
    targetScore: work.currentBlindIndex === 2 ? newBossTarget : work.targetScore,
  };

  return { nextState: work, events };
}

/**
 * Обрабатывает розыгрыш выбранных карт руки и переходы в cashout / victory / game_over.
 */
function handlePlayHand(state: RunState, cardIds: readonly string[]): DispatchResult {
  if (state.phase !== 'playing' || state.handsLeft <= 0) {
    return { nextState: state, events: [] };
  }
  if (cardIds.length < 1 || cardIds.length > 5) {
    return { nextState: state, events: [] };
  }

  const handSet = new Set(state.handIds);
  const seen = new Set<string>();
  for (const id of cardIds) {
    if (!handSet.has(id) || seen.has(id)) {
      return { nextState: state, events: [] };
    }
    seen.add(id);
  }

  if (violatesFinalBellConstraint(state, cardIds)) {
    return { nextState: state, events: [] };
  }

  const events: TraceEvent[] = [];
  const playRes = evaluatePlay(state, cardIds, {
    relicRegistry: getRelicDefinition,
    resolveRelicTarget,
  });
  events.push(...playRes.events);

  let work = clearStaleForcedSelections(playRes.nextState);

  if (work.score >= work.targetScore) {
    const stateBeforeRoundEnd = work;
    const roundEndRes = evaluateRoundEnd(stateBeforeRoundEnd, {
      relicRegistry: getRelicDefinition,
      resolveRelicTarget,
    });
    events.push(...roundEndRes.events);

    work = finalizeWonRoundState(stateBeforeRoundEnd, roundEndRes.nextState);
    const defeatedSlot = work.anteBlinds[work.currentBlindIndex];

    if (work.ante === 8 && defeatedSlot.kind === 'boss' && !work.endlessMode) {
      work = {
        ...work,
        phase: 'victory',
        previousPhase: null,
      };
      events.push({
        type: 'RUN_WON',
        ante: work.ante,
        finalScore: work.score,
      });
      events.push({
        type: 'PHASE_CHANGED',
        from: 'playing',
        to: 'victory',
      });
      return { nextState: work, events };
    }

    work = {
      ...work,
      phase: 'cashout',
      previousPhase: null,
    };
    events.push({
      type: 'PHASE_CHANGED',
      from: 'playing',
      to: 'cashout',
    });
    return { nextState: work, events };
  }

  if (work.handsLeft <= 0) {
    return { nextState: finalizeLostRoundState(work, events), events };
  }

  work = replenishHandFromDrawPile(work);

  if (work.handIds.length === 0) {
    return { nextState: finalizeLostRoundState(work, events), events };
  }

  const bellRes = applyFinalBellSelection(work);
  work = bellRes.nextState;
  events.push(...bellRes.events);

  return { nextState: work, events };
}

/**
 * Обрабатывает ручной сброс карт из руки с Лиловой печатью, хуками onDiscard и добором.
 */
function handleDiscardCards(state: RunState, cardIds: readonly string[]): DispatchResult {
  if (state.phase !== 'playing' || state.discardsLeft <= 0) {
    return { nextState: state, events: [] };
  }
  if (cardIds.length < 1 || cardIds.length > 5) {
    return { nextState: state, events: [] };
  }

  const handSet = new Set(state.handIds);
  const seen = new Set<string>();
  for (const id of cardIds) {
    if (!handSet.has(id) || seen.has(id)) {
      return { nextState: state, events: [] };
    }
    seen.add(id);
  }

  if (violatesFinalBellConstraint(state, cardIds)) {
    return { nextState: state, events: [] };
  }

  const events: TraceEvent[] = [];
  const discardedSet = new Set(cardIds);
  const cardMap = buildCardLookup(state.deck);
  const discardedCards = cardIds
    .map((id) => cardMap.get(id))
    .filter((card): card is PlayingCard => card !== undefined);

  let work: RunState = {
    ...state,
    discardsLeft: state.discardsLeft - 1,
    handIds: state.handIds.filter((id) => !discardedSet.has(id)),
    stats: {
      ...state.stats,
      discardsUsed: state.stats.discardsUsed + 1,
      cardsDiscarded: state.stats.cardsDiscarded + cardIds.length,
    },
  };
  work = clearStaleForcedSelections(work);

  // 1. Системный хук pre_discard до цикла по сбрасываемым картам
  work = runRelicHookSweep(
    work,
    'onPreDiscard',
    (resolved, slotIndex, currentState) => ({
      hook: 'onPreDiscard',
      state: currentState,
      effectRelic: resolved.effectRelic,
      stateRelic: resolved.stateRelic,
      relicIndex: slotIndex,
      isBlueprintCopy: resolved.isBlueprintCopy,
      fullHand: discardedCards,
      isHookDiscard: false,
    }),
    events,
  );

  // 2. В одном цикле для каждой карты: Лиловая печать -> onDiscard Реликвий -> перенос в сброс или удаление
  const removedCards: PlayingCard[] = [];
  const keptDiscardedIds: string[] = [];

  for (let cardIndex = 0; cardIndex < discardedCards.length; cardIndex += 1) {
    const card = discardedCards[cardIndex]!;
    const isLastDiscardedCard = cardIndex === discardedCards.length - 1;

    if (!card.debuffed && card.seal === 'purple') {
      if (work.consumables.length < getEffectiveMaxConsumables(work)) {
        const picked = pickPoolConsumable(work, 'scroll', { stream: `Tarot8ba${work.ante}` });
        const created = createConsumableInstance(
          picked.value,
          `cons_${work.nextCardUid}`,
          'base',
          work.discountPercent,
        );
        work = {
          ...work,
          rngState: picked.nextState,
          consumables: [...work.consumables, created],
          nextCardUid: work.nextCardUid + 1,
        };
        events.push({
          type: 'CARD_TRIGGER',
          cardId: card.id,
          retriggerIndex: 0,
          seal: 'purple',
          locKey: 'hand_card_purple_seal',
          locParams: { consumableId: created.id },
        });
      }
    }

    let removed = false;
    work = runRelicHookSweep(
      work,
      'onDiscard',
      (resolved, slotIndex, currentState) => ({
        hook: 'onDiscard',
        state: currentState,
        effectRelic: resolved.effectRelic,
        stateRelic: resolved.stateRelic,
        relicIndex: slotIndex,
        isBlueprintCopy: resolved.isBlueprintCopy,
        card,
        discardedCards,
        cardIndex,
        isLastDiscardedCard,
        isHookDiscard: false,
      }),
      events,
      (res) => {
        if (res.removeCard) {
          removed = true;
        }
      },
    );

    if (removed) {
      removedCards.push(card);
    } else {
      keptDiscardedIds.push(card.id);
    }
  }

  if (removedCards.length > 0) {
    const removedIdSet = new Set(removedCards.map((c) => c.id));
    work = {
      ...work,
      deck: work.deck.filter((c) => !removedIdSet.has(c.id)),
      discardPileIds: [...work.discardPileIds, ...keptDiscardedIds],
      stats: {
        ...work.stats,
        cardsDestroyed: work.stats.cardsDestroyed + removedCards.length,
      },
    };
    work = runRelicHookSweep(
      work,
      'onRemovePlayingCards',
      (resolved, slotIndex, currentState) => ({
        hook: 'onRemovePlayingCards',
        state: currentState,
        effectRelic: resolved.effectRelic,
        stateRelic: resolved.stateRelic,
        relicIndex: slotIndex,
        isBlueprintCopy: resolved.isBlueprintCopy,
        removedCards,
      }),
      events,
    );
  } else {
    work = {
      ...work,
      discardPileIds: [...work.discardPileIds, ...keptDiscardedIds],
    };
  }

  work = replenishHandFromDrawPile(work);

  if (work.handIds.length === 0 && work.score < work.targetScore) {
    return { nextState: finalizeLostRoundState(work, events), events };
  }

  const bellRes = applyFinalBellSelection(work);
  work = bellRes.nextState;
  events.push(...bellRes.events);

  return { nextState: work, events };
}

/**
 * Сортирует текущую руку (в бою или временную руку бустера) по рангу или по масти
 * и сохраняет выбранный режим сортировки в состоянии забега.
 */
function handleSortHand(state: RunState, by: 'rank' | 'suit'): DispatchResult {
  if (state.phase === 'playing') {
    return {
      nextState: {
        ...state,
        handSortMode: by,
        handIds: sortHandIdsByMode(state.deck, state.handIds, by),
      },
      events: [],
    };
  }

  if (state.phase === 'booster' && state.booster && state.booster.drawnHandCardIds.length > 0) {
    return {
      nextState: {
        ...state,
        handSortMode: by,
        booster: {
          ...state.booster,
          drawnHandCardIds: sortHandIdsByMode(state.deck, state.booster.drawnHandCardIds, by),
        },
      },
      events: [],
    };
  }

  return { nextState: state, events: [] };
}

/**
 * Меняет порядок карт в руке строго в рамках перестановки текущих карт.
 */
function handleReorderHand(state: RunState, cardIds: readonly string[]): DispatchResult {
  if (state.phase === 'playing' && isStrictPermutation(cardIds, state.handIds)) {
    return {
      nextState: { ...state, handIds: [...cardIds] },
      events: [],
    };
  }

  if (
    state.phase === 'booster' &&
    state.booster &&
    state.booster.drawnHandCardIds.length > 0 &&
    isStrictPermutation(cardIds, state.booster.drawnHandCardIds)
  ) {
    return {
      nextState: {
        ...state,
        booster: {
          ...state.booster,
          drawnHandCardIds: [...cardIds],
        },
      },
      events: [],
    };
  }

  return { nextState: state, events: [] };
}

/**
 * Меняет порядок Реликвий игрока слева направо (включая копирование Blueprint/Brainstorm).
 */
function handleReorderRelics(state: RunState, relicUids: readonly string[]): DispatchResult {
  if (state.phase === 'deck_select' || isTerminalPhase(state.phase)) {
    return { nextState: state, events: [] };
  }
  const currentUids = state.relics.map((relic) => relic.uid);
  if (!isStrictPermutation(relicUids, currentUids)) {
    return { nextState: state, events: [] };
  }

  const byUid = new Map(state.relics.map((relic) => [relic.uid, relic]));
  const reordered = relicUids.map((uid) => byUid.get(uid)!);
  return {
    nextState: { ...state, relics: reordered },
    events: [],
  };
}

/**
 * Меняет порядок Расходников в слотах игрока.
 */
function handleReorderConsumables(state: RunState, consumableUids: readonly string[]): DispatchResult {
  if (state.phase === 'deck_select' || isTerminalPhase(state.phase)) {
    return { nextState: state, events: [] };
  }
  const currentUids = state.consumables.map((item) => item.uid);
  if (!isStrictPermutation(consumableUids, currentUids)) {
    return { nextState: state, events: [] };
  }

  const byUid = new Map(state.consumables.map((item) => [item.uid, item]));
  const reordered = consumableUids.map((uid) => byUid.get(uid)!);
  return {
    nextState: { ...state, consumables: reordered },
    events: [],
  };
}

/**
 * Применяет имеющийся в слотах расходник на выбранные карты или глобально.
 */
function handleUseConsumable(
  state: RunState,
  consumableUid: string,
  targetCardIds: readonly string[] = [],
): DispatchResult {
  if (state.phase === 'deck_select' || isTerminalPhase(state.phase)) {
    return { nextState: state, events: [] };
  }
  const consumable = state.consumables.find((item) => item.uid === consumableUid);
  if (!consumable) {
    return { nextState: state, events: [] };
  }

  const applied = applyConsumable(state, consumable, targetCardIds, {
    relicRegistry: getRelicDefinition,
    resolveRelicTarget,
  });
  let nextState = applied.nextState;
  const events = [...applied.events];
  if (
    nextState.phase === 'playing' &&
    nextState.handIds.length === 0 &&
    nextState.drawPileIds.length === 0 &&
    nextState.score < nextState.targetScore
  ) {
    nextState = finalizeLostRoundState(nextState, events);
  }
  return {
    nextState,
    events,
  };
}

/**
 * Продает Реликвию из инвентаря за её sellValue.
 */
function handleSellRelic(state: RunState, relicUid: string): DispatchResult {
  if (state.phase === 'deck_select' || isTerminalPhase(state.phase)) {
    return { nextState: state, events: [] };
  }
  const target = state.relics.find((relic) => relic.uid === relicUid);
  if (!target || target.state.extra?.['eternal'] === true) {
    return { nextState: state, events: [] };
  }

  const events: TraceEvent[] = [];
  const nextRelics = state.relics.filter((relic) => relic.uid !== relicUid);
  let nextState: RunState = {
    ...state,
    relics: nextRelics,
  };

  events.push({
    type: 'RELIC_DESTROYED',
    relicUid: target.uid,
    relicId: target.id,
    reason: 'sold',
  });

  nextState = applyDollarChange(nextState, target.sellValue, 'shop', events);
  return { nextState, events };
}

/**
 * Продает Расходник из слота за его sellValue.
 */
function handleSellConsumable(state: RunState, consumableUid: string): DispatchResult {
  if (state.phase === 'deck_select' || isTerminalPhase(state.phase)) {
    return { nextState: state, events: [] };
  }
  const target = state.consumables.find((item) => item.uid === consumableUid);
  if (!target) {
    return { nextState: state, events: [] };
  }

  const events: TraceEvent[] = [];
  const nextState = applyDollarChange(
    {
      ...state,
      consumables: state.consumables.filter((item) => item.uid !== consumableUid),
    },
    target.sellValue,
    'shop',
    events,
  );
  return { nextState, events };
}

/**
 * Выплачивает итоговую награду раунда и открывает магазин с сохранением или ротацией Грамоты этапа.
 */
function handleClaimCashout(state: RunState): DispatchResult {
  if (state.phase !== 'cashout') {
    return { nextState: state, events: [] };
  }

  const events: TraceEvent[] = [];
  const reward = state.cashout?.totalReward ?? 0;
  let work = applyDollarChange(
    {
      ...state,
      cashout: null,
    },
    reward,
    'cashout',
    events,
  );

  // Тасуем колоду при выходе из награды (cash_out), чтобы бустеры магазина тянули без повторного шаффла
  const cashoutShuffle = shuffleDeckIds(work.rngState, `cashout${work.ante}`, work.drawPileIds);
  work = {
    ...work,
    rngState: cashoutShuffle.nextState,
    drawPileIds: cashoutShuffle.value,
  };

  // Грамота обновляется только после победы над Боссом Этапа (в остальных раундах Этапа сохраняется)
  const defeatedSlot = work.anteBlinds[work.currentBlindIndex];
  const preserveVoucher = defeatedSlot.kind !== 'boss' && Boolean(work.shop?.voucher);

  const shopResult = createShopState(work, {
    preserveVoucher,
    relicRegistry: getRelicDefinition,
    resolveRelicTarget,
  });
  events.push(...shopResult.events);

  work = {
    ...shopResult.nextState,
    phase: 'shop',
    previousPhase: null,
  };
  events.push({
    type: 'PHASE_CHANGED',
    from: 'cashout',
    to: 'shop',
  });

  return { nextState: work, events };
}

/**
 * Помечает товар верхней полки магазина как купленный.
 */
function markShopOfferSold(shop: ShopState, offerUid: string): ShopState {
  return {
    ...shop,
    offers: shop.offers.map((offer) =>
      offer.uid === offerUid ? { ...offer, sold: true } : offer,
    ),
  };
}

/**
 * Увеличивает счётчик купленных в магазине карт/предметов текущего забега.
 */
function incrementCardsPurchased(state: RunState): RunState {
  return {
    ...state,
    stats: {
      ...state.stats,
      cardsPurchased: state.stats.cardsPurchased + 1,
    },
  };
}

/**
 * Покупает товар на верхней полке магазина (Реликвия, Расходник или Карта).
 */
function handleBuyShopOffer(
  state: RunState,
  offerUid: string,
  useImmediately = false,
): DispatchResult {
  if (state.phase !== 'shop' || !state.shop) {
    return { nextState: state, events: [] };
  }

  const offer = state.shop.offers.find((item) => item.uid === offerUid && !item.sold);
  if (!offer || !canAffordCost(state, offer.cost)) {
    return { nextState: state, events: [] };
  }

  const events: TraceEvent[] = [];

  if (offer.kind === 'relic') {
    if (
      offer.relic.edition !== 'negative' &&
      state.relics.length >= getEffectiveMaxRelics(state)
    ) {
      return { nextState: state, events: [] };
    }

    let work = applyDollarChange(state, -offer.cost, 'shop', events);
    work = incrementCardsPurchased({
      ...work,
      shop: markShopOfferSold(work.shop!, offerUid),
      relics: [...work.relics, offer.relic],
    });
    return { nextState: work, events };
  }

  if (offer.kind === 'consumable') {
    if (useImmediately) {
      const paidState = applyDollarChange(
        {
          ...state,
          shop: markShopOfferSold(state.shop, offerUid),
        },
        -offer.cost,
        'shop',
        events,
      );
      if (!canUseConsumable(paidState, offer.consumable, [])) {
        return { nextState: state, events: [] };
      }

      const paidPurchased = incrementCardsPurchased(paidState);
      const applied = applyConsumable(paidPurchased, offer.consumable, [], {
        relicRegistry: getRelicDefinition,
        resolveRelicTarget,
      });
      events.push(...applied.events);
      return {
        nextState: applied.nextState,
        events,
      };
    }

    if (
      offer.consumable.edition !== 'negative' &&
      state.consumables.length >= getEffectiveMaxConsumables(state)
    ) {
      return { nextState: state, events: [] };
    }

    let work = applyDollarChange(state, -offer.cost, 'shop', events);
    work = incrementCardsPurchased({
      ...work,
      shop: markShopOfferSold(work.shop!, offerUid),
      consumables: [...work.consumables, offer.consumable],
    });
    return { nextState: work, events };
  }

  // Игральная карта добавляется в колоду и активирует хук onCardAdded (j_hologram)
  let work = applyDollarChange(state, -offer.cost, 'shop', events);
  work = incrementCardsPurchased({
    ...work,
    shop: markShopOfferSold(work.shop!, offerUid),
    deck: [...work.deck, offer.card],
    drawPileIds: [...work.drawPileIds, offer.card.id],
  });

  work = runRelicHookSweep(
    work,
    'onCardAdded',
    (resolved, slotIndex, currentState) => ({
      hook: 'onCardAdded',
      state: currentState,
      effectRelic: resolved.effectRelic,
      stateRelic: resolved.stateRelic,
      relicIndex: slotIndex,
      isBlueprintCopy: resolved.isBlueprintCopy,
      addedCards: [offer.card],
    }),
    events,
  );

  return { nextState: work, events };
}

/**
 * Покупает и немедленно активирует Гильдейскую грамоту на нижней левой полке магазина.
 */
function handleBuyCharter(state: RunState): DispatchResult {
  if (state.phase !== 'shop' || !state.shop?.voucher) {
    return { nextState: state, events: [] };
  }
  const voucher = state.shop.voucher;
  if (
    voucher.sold ||
    !canAffordCost(state, voucher.cost) ||
    state.charters.includes(voucher.charterId)
  ) {
    return { nextState: state, events: [] };
  }

  const events: TraceEvent[] = [];
  let work = applyDollarChange(state, -voucher.cost, 'shop', events);
  work = incrementCardsPurchased({
    ...work,
    shop: {
      ...work.shop!,
      voucher: { ...voucher, sold: true },
    },
  });
  work = redeemCharter(work, voucher.charterId);

  // Покупка v_overstock_norm немедленно добавляет +1 товар в текущий магазин
  if (voucher.charterId === 'v_overstock_norm') {
    const expanded = appendShopTopShelfOffer(work, {
      relicRegistry: getRelicDefinition,
      resolveRelicTarget,
    });
    work = expanded.nextState;
    events.push(...expanded.events);
  }

  return { nextState: work, events };
}

/**
 * Покупает и открывает бустер-набор из магазина, переводя игру в фазу 'booster'.
 */
function handleOpenPack(state: RunState, packUid: string): DispatchResult {
  if (state.phase !== 'shop' || !state.shop) {
    return { nextState: state, events: [] };
  }
  const pack = state.shop.packs.find((item) => item.uid === packUid && !item.purchased);
  if (!pack || !canAffordCost(state, pack.cost)) {
    return { nextState: state, events: [] };
  }

  const events: TraceEvent[] = [];
  let work = applyDollarChange(state, -pack.cost, 'shop', events);
  work = incrementCardsPurchased({
    ...work,
    shop: {
      ...work.shop!,
      packs: work.shop!.packs.map((item) =>
        item.uid === packUid ? { ...item, purchased: true } : item,
      ),
    },
  });

  const generated = generateBoosterState(work, pack, false);
  events.push(...generated.events);

  work = sortBoosterHandIfPresent({
    ...generated.nextState,
    phase: 'booster',
    previousPhase: 'shop',
  });
  events.push({
    type: 'PHASE_CHANGED',
    from: 'shop',
    to: 'booster',
  });

  return { nextState: work, events };
}

/**
 * Помечает выбранный элемент внутри бустера как забранный и уменьшает счётчик remainingPicks.
 */
function markBoosterChoicePicked(state: RunState, choiceUid: string): RunState {
  if (!state.booster) return state;
  const nextChoices: BoosterChoice[] = state.booster.choices.map((choice) =>
    choice.uid === choiceUid ? { ...choice, picked: true } : choice,
  );
  return {
    ...state,
    booster: {
      ...state.booster,
      choices: nextChoices,
      remainingPicks: Math.max(0, state.booster.remainingPicks - 1),
    },
  };
}

/**
 * Обрабатывает выбор одного элемента из открытого бустер-набора.
 */
function handlePickBoosterItem(
  state: RunState,
  choiceUid: string,
  targetCardIds: readonly string[] = [],
): DispatchResult {
  if (state.phase !== 'booster' || !state.booster || state.booster.remainingPicks <= 0) {
    return { nextState: state, events: [] };
  }

  const choice = state.booster.choices.find((item) => item.uid === choiceUid && !item.picked);
  if (!choice) {
    return { nextState: state, events: [] };
  }

  const events: TraceEvent[] = [];
  let work = state;

  if (choice.kind === 'relic') {
    if (
      choice.relic.edition !== 'negative' &&
      work.relics.length >= getEffectiveMaxRelics(work)
    ) {
      return { nextState: state, events: [] };
    }
    work = markBoosterChoicePicked(
      {
        ...work,
        relics: [...work.relics, choice.relic],
      },
      choiceUid,
    );
  } else if (choice.kind === 'card') {
    work = markBoosterChoicePicked(
      {
        ...work,
        deck: [...work.deck, choice.card],
        drawPileIds: [...work.drawPileIds, choice.card.id],
      },
      choiceUid,
    );
    work = runRelicHookSweep(
      work,
      'onCardAdded',
      (resolved, slotIndex, currentState) => ({
        hook: 'onCardAdded',
        state: currentState,
        effectRelic: resolved.effectRelic,
        stateRelic: resolved.stateRelic,
        relicIndex: slotIndex,
        isBlueprintCopy: resolved.isBlueprintCopy,
        addedCards: [choice.card],
      }),
      events,
    );
  } else {
    if (!canUseConsumable(work, choice.consumable, targetCardIds)) {
      return { nextState: state, events: [] };
    }
    const applied = applyConsumable(work, choice.consumable, targetCardIds, {
      relicRegistry: getRelicDefinition,
      resolveRelicTarget,
    });
    events.push(...applied.events);
    work = markBoosterChoicePicked(applied.nextState, choiceUid);
  }

  if (work.booster && work.booster.remainingPicks === 0) {
    work = closeOrAdvanceBooster(work, events);
  }

  return { nextState: work, events };
}

/**
 * Пропускает оставшиеся выборы в открытом бустер-наборе.
 */
function handleSkipBooster(state: RunState): DispatchResult {
  if (state.phase !== 'booster' || !state.booster) {
    return { nextState: state, events: [] };
  }
  const events: TraceEvent[] = [];
  const nextState = closeOrAdvanceBooster(state, events);
  return { nextState, events };
}

/**
 * Обновляет верхнюю полку магазина за текущую стоимость реролла.
 */
function handleRerollShop(state: RunState): DispatchResult {
  if (state.phase !== 'shop' || !state.shop) {
    return { nextState: state, events: [] };
  }
  return rerollShopState(state, {
    relicRegistry: getRelicDefinition,
    resolveRelicTarget,
  });
}

/**
 * Бесплатно обновляет верхнюю полку магазина 1 раз за визит за просмотр рекламы.
 */
function handleFreeRerollShop(state: RunState): DispatchResult {
  if (state.phase !== 'shop' || !state.shop) {
    return { nextState: state, events: [] };
  }
  return freeRerollShopState(state, {
    relicRegistry: getRelicDefinition,
    resolveRelicTarget,
  });
}

/**
 * «Второй шанс»: 1 раз за забег возвращает игрока из game_over в текущий бой с +1 рукой.
 */
function handleReviveRun(state: RunState): DispatchResult {
  if (state.phase !== 'game_over' || state.reviveUsed || isDailyRunSeed(state.seed)) {
    return { nextState: state, events: [] };
  }

  const events: TraceEvent[] = [];
  let work: RunState = {
    ...state,
    phase: 'playing',
    previousPhase: null,
    handsLeft: 1,
    reviveUsed: true,
  };

  const slot = work.anteBlinds[work.currentBlindIndex];
  const activeBoss = slot.kind === 'boss' && !work.activeBossDisabled ? slot.bossId : null;
  if (activeBoss) {
    // Повторно накладываем дебаффы Босса на колоду (при game_over они были сняты).
    // Для bl_manacle -1 handSize при game_over не возвращался, поэтому повторно не вычитаем.
    work = {
      ...work,
      deck: applyBossDebuffsToDeck(work.deck, activeBoss, false),
    };
    if (activeBoss === 'bl_water') {
      work = {
        ...work,
        savedBossDiscards: work.discardsLeft,
        discardsLeft: 0,
      };
    }
  }

  // Перетасовываем сброс в колоду добора, если карт для полной руки не хватает
  const effectiveHandSize = Math.max(0, work.handSize + work.tempHandSizeBonus);
  const missingCount = Math.max(0, effectiveHandSize - work.handIds.length);
  if (work.drawPileIds.length < missingCount && work.discardPileIds.length > 0) {
    const shuffledDiscard = shuffleDeckIds(work.rngState, 'shuffle', work.discardPileIds);
    work = {
      ...work,
      rngState: shuffledDiscard.nextState,
      drawPileIds: [...work.drawPileIds, ...shuffledDiscard.value],
      discardPileIds: [],
    };
  }

  work = replenishHandFromDrawPile(work);

  const bellRes = applyFinalBellSelection(work);
  work = bellRes.nextState;
  events.push(...bellRes.events);

  events.push({
    type: 'PHASE_CHANGED',
    from: 'game_over',
    to: 'playing',
  });

  return { nextState: work, events };
}

/**
 * Завершает фазу магазина и переводит игрока к следующему Стражу (или новому Этапу).
 */
function handleNextRound(state: RunState): DispatchResult {
  if (state.phase !== 'shop') {
    return { nextState: state, events: [] };
  }
  const nextState = advanceToNextBlindOrAnte(state);
  return {
    nextState,
    events: [
      {
        type: 'PHASE_CHANGED',
        from: 'shop',
        to: 'blind_select',
      },
    ],
  };
}

/**
 * Переключает завершённый на 8 Этапе забег в Бесконечный режим и возвращает к выплате/Этапу 9.
 */
function handleContinueEndless(state: RunState): DispatchResult {
  if (state.phase !== 'victory') {
    return { nextState: state, events: [] };
  }

  // На экране победы Этапа 8 сохраняется ante = 8; при переходе в Бесконечный режим повышаем до 9
  const advancedAnteState: RunState = {
    ...state,
    ante: state.ante + 1,
    endlessMode: true,
  };

  if (state.cashout !== null) {
    return {
      nextState: {
        ...advancedAnteState,
        phase: 'cashout',
        previousPhase: null,
      },
      events: [
        {
          type: 'PHASE_CHANGED',
          from: 'victory',
          to: 'cashout',
        },
      ],
    };
  }

  const nextState = advanceToNextBlindOrAnte(advancedAnteState);
  return {
    nextState,
    events: [
      {
        type: 'PHASE_CHANGED',
        from: 'victory',
        to: 'blind_select',
      },
    ],
  };
}

/**
 * Чистая детерминированная функция диспетчеризации всех игровых команд Balite.
 */
export function dispatch(state: RunState, command: GameCommand): DispatchResult {
  switch (command.type) {
    case 'START_RUN': {
      const nextState = createInitialRunState(command.deckId, command.seed);
      return {
        nextState,
        events: [
          {
            type: 'PHASE_CHANGED',
            from: state.phase,
            to: 'blind_select',
          },
        ],
      };
    }
    case 'SELECT_BLIND':
      return handleSelectBlind(state);
    case 'SKIP_BLIND':
      return handleSkipBlind(state);
    case 'REROLL_BOSS':
      return handleRerollBoss(state);
    case 'PLAY_HAND':
      return handlePlayHand(state, command.cardIds);
    case 'DISCARD_CARDS':
      return handleDiscardCards(state, command.cardIds);
    case 'SORT_HAND':
      return handleSortHand(state, command.by);
    case 'REORDER_HAND':
      return handleReorderHand(state, command.cardIds);
    case 'REORDER_RELICS':
      return handleReorderRelics(state, command.relicUids);
    case 'REORDER_CONSUMABLES':
      return handleReorderConsumables(state, command.consumableUids);
    case 'USE_CONSUMABLE':
      return handleUseConsumable(state, command.consumableUid, command.targetCardIds);
    case 'SELL_RELIC':
      return handleSellRelic(state, command.relicUid);
    case 'SELL_CONSUMABLE':
      return handleSellConsumable(state, command.consumableUid);
    case 'CLAIM_CASHOUT':
      return handleClaimCashout(state);
    case 'BUY_SHOP_OFFER':
      return handleBuyShopOffer(state, command.offerUid, command.useImmediately);
    case 'BUY_CHARTER':
      return handleBuyCharter(state);
    case 'OPEN_PACK':
      return handleOpenPack(state, command.packUid);
    case 'PICK_BOOSTER_ITEM':
      return handlePickBoosterItem(state, command.choiceUid, command.targetCardIds);
    case 'SKIP_BOOSTER':
      return handleSkipBooster(state);
    case 'REROLL_SHOP':
      return handleRerollShop(state);
    case 'FREE_REROLL_SHOP':
      return handleFreeRerollShop(state);
    case 'REVIVE_RUN':
      return handleReviveRun(state);
    case 'NEXT_ROUND':
      return handleNextRound(state);
    case 'CONTINUE_ENDLESS':
      return handleContinueEndless(state);
  }
}
