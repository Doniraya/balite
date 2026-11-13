import { getCardScoringChips, isCardFace, sortCardsByOrder } from './cards';
import { evaluatePokerHand } from './handEval';
import { pickElement, nextFloat } from './prng';
import {
  SCROLL_IDS,
  type BossId,
  type CashoutBreakdown,
  type CelestialId,
  type ConsumableId,
  type ConsumableInstance,
  type ConsumableKind,
  type DispatchResult,
  type HandEvaluationResult,
  type HandType,
  type PlayingCard,
  type RelicEffectResult,
  type RelicHookContext,
  type RelicHookContextFor,
  type RelicHookName,
  type RelicInstance,
  type RelicRegistryLookup,
  type RunState,
  type TraceEvent,
} from './types';

/**
 * Результат разрешения цели Реликвии (с учётом Blueprint/Brainstorm).
 */
export interface ResolvedRelicTarget {
  readonly effectRelic: RelicInstance;
  readonly stateRelic: RelicInstance;
  readonly isBlueprintCopy: boolean;
}

/**
 * Функция разрешения целевой Реликвии для указанного слота.
 */
export type ResolveRelicTargetFn = (
  relics: readonly RelicInstance[],
  slotIndex: number,
  lookup: RelicRegistryLookup,
) => ResolvedRelicTarget | null;

/**
 * Опции запуска конвейера подсчёта очков и расчёта конца раунда.
 */
export interface ScoringOptions {
  readonly relicRegistry: RelicRegistryLookup;
  readonly resolveRelicTarget?: ResolveRelicTargetFn;
}

/**
 * Отображение 12 Астральных сфер в соответствующие расклады (для Обсерватории и Лазурной печати).
 */
const CELESTIAL_HAND_MAP: Readonly<Record<CelestialId, HandType>> = {
  c_mercury: 'Pair',
  c_venus: 'Three of a Kind',
  c_earth: 'Full House',
  c_mars: 'Four of a Kind',
  c_jupiter: 'Flush',
  c_saturn: 'Straight',
  c_uranus: 'Two Pair',
  c_neptune: 'Straight Flush',
  c_pluto: 'High Card',
  c_planet_x: 'Five of a Kind',
  c_ceres: 'Flush House',
  c_eris: 'Flush Five',
};

const HAND_TO_CELESTIAL_MAP: Readonly<Record<HandType, CelestialId>> = {
  Pair: 'c_mercury',
  'Three of a Kind': 'c_venus',
  'Full House': 'c_earth',
  'Four of a Kind': 'c_mars',
  Flush: 'c_jupiter',
  Straight: 'c_saturn',
  'Two Pair': 'c_uranus',
  'Straight Flush': 'c_neptune',
  'High Card': 'c_pluto',
  'Five of a Kind': 'c_planet_x',
  'Flush House': 'c_ceres',
  'Flush Five': 'c_eris',
};

/**
 * Описание источника повтора триггера карты.
 */
type RepetitionSource =
  | { readonly kind: 'base' }
  | { readonly kind: 'seal' }
  | { readonly kind: 'relic'; readonly resolved: ResolvedRelicTarget };

/**
 * Внутреннее изменяемое состояние рабочего контекста одного прогона scoring/roundEnd.
 */
interface MutableWorkState {
  run: RunState;
  events: TraceEvent[];
}

/**
 * Стандартный резолвер Реликвии при отсутствии внешнего Blueprint/Brainstorm-резолвера.
 */
function defaultResolveRelicTarget(
  relics: readonly RelicInstance[],
  slotIndex: number,
  lookup: RelicRegistryLookup,
): ResolvedRelicTarget | null {
  const relic = relics[slotIndex];
  if (!relic || relic.debuffed) return null;
  if (relic.id === 'j_blueprint' || relic.id === 'j_brainstorm') return null;
  if (!lookup(relic.id)) return null;
  return {
    effectRelic: relic,
    stateRelic: relic,
    isBlueprintCopy: false,
  };
}

/**
 * Возвращает идентификатор активного Босса текущего раунда (или null, если Босс подавлен/не Босс).
 */
function getActiveBossId(state: RunState): BossId | null {
  if (state.activeBossDisabled) return null;
  const slot = state.anteBlinds[state.currentBlindIndex];
  if (slot.kind !== 'boss') return null;
  return slot.bossId;
}

/**
 * Проверяет наличие активной (неподавленной) Реликвии заданного ID в слотах игрока.
 */
function hasActiveRelic(relics: readonly RelicInstance[], id: RelicInstance['id']): boolean {
  return relics.some((relic) => relic.id === id && !relic.debuffed);
}

/**
 * Возвращает эффективный лимит слотов расходников с учётом Теневых изданий.
 */
function getEffectiveMaxConsumables(state: RunState): number {
  const negativeCount = state.consumables.filter((c) => c.edition === 'negative').length;
  return state.maxConsumables + negativeCount;
}

/**
 * Создаёт экземпляр случайного Свитка или указанной Сферы при наличии свободного слота.
 */
function tryGrantConsumable(
  work: MutableWorkState,
  kind: ConsumableKind,
  forcedId?: ConsumableId,
): ConsumableInstance | null {
  if (work.run.consumables.length >= getEffectiveMaxConsumables(work.run)) {
    return null;
  }

  let chosenId: ConsumableId | undefined = forcedId;
  let nextRng = work.run.rngState;

  if (!chosenId) {
    if (kind === 'scroll') {
      const pick = pickElement(nextRng, 'shop', SCROLL_IDS);
      chosenId = pick.value;
      nextRng = pick.nextState;
    } else {
      return null;
    }
  }

  const baseCost = kind === 'rune' ? 4 : 3;
  const uid = `cons_${work.run.nextCardUid}`;
  const instance: ConsumableInstance = {
    uid,
    id: chosenId,
    kind,
    edition: 'base',
    baseCost,
    sellValue: Math.max(1, Math.floor(baseCost / 2)),
  };

  work.run = {
    ...work.run,
    rngState: nextRng,
    consumables: [...work.run.consumables, instance],
    nextCardUid: work.run.nextCardUid + 1,
  };

  return instance;
}

/**
 * Обновляет счётчики конкретной Реликвии или удаляет её при destroySelf.
 */
function applyRelicStateEffects(
  work: MutableWorkState,
  resolved: ResolvedRelicTarget,
  result: RelicEffectResult,
): void {
  if (result.updatedEffectState) {
    work.run = {
      ...work.run,
      relics: work.run.relics.map((relic) =>
        relic.uid === resolved.effectRelic.uid
          ? { ...relic, state: result.updatedEffectState! }
          : relic,
      ),
    };
  }

  if (result.destroySelf && !resolved.isBlueprintCopy) {
    const removed = work.run.relics.find((r) => r.uid === resolved.effectRelic.uid);
    if (removed) {
      work.run = {
        ...work.run,
        relics: work.run.relics.filter((r) => r.uid !== removed.uid),
      };
      work.events.push({
        type: 'RELIC_DESTROYED',
        relicUid: removed.uid,
        relicId: removed.id,
        reason: removed.id === 'j_ramen' ? 'ramen' : 'ceremonial',
      });
    }
  }
}

/**
 * Вызывает указанный хук для Реликвии в слоте с учётом резолвера Blueprint/Brainstorm.
 */
function invokeRelicHook<H extends RelicHookName>(
  state: RunState,
  slotIndex: number,
  options: ScoringOptions,
  buildContext: (resolved: ResolvedRelicTarget) => RelicHookContextFor<H>,
): { readonly resolved: ResolvedRelicTarget; readonly result: RelicEffectResult } | null {
  const resolve = options.resolveRelicTarget ?? defaultResolveRelicTarget;
  const resolved = resolve(state.relics, slotIndex, options.relicRegistry);
  if (!resolved) return null;

  const ctx = buildContext(resolved);
  const def = options.relicRegistry(resolved.effectRelic.id);
  const handler = def?.hooks[ctx.hook] as
    | ((context: RelicHookContext) => RelicEffectResult | null | undefined)
    | undefined;
  if (!handler) return null;

  const result = handler(ctx);
  if (!result) return null;

  return { resolved, result };
}

/**
 * Добавляет запись о delta-золота в состояние и журнал событий.
 */
function addDollars(
  work: MutableWorkState,
  delta: number,
  source: 'card' | 'relic' | 'consumable',
): void {
  if (delta === 0) return;
  const totalDollars = work.run.dollars + delta;
  work.run = {
    ...work.run,
    dollars: totalDollars,
  };
  work.events.push({
    type: 'DOLLAR_DELTA',
    delta,
    totalDollars,
    source,
  });
}

/**
 * Находит карту в текущей колоде по идентификатору.
 */
function getCardMap(deck: readonly PlayingCard[]): Map<string, PlayingCard> {
  const map = new Map<string, PlayingCard>();
  for (const card of deck) {
    map.set(card.id, card);
  }
  return map;
}

/**
 * Обрабатывает сброс до 2 случайных карт боссом bl_hook (срабатывают onDiscard и Лиловая печать).
 */
function processBossHookDiscard(work: MutableWorkState, options: ScoringOptions): void {
  if (getActiveBossId(work.run) !== 'bl_hook' || work.run.handIds.length === 0) {
    return;
  }

  let remainingHandIds = [...work.run.handIds];
  const discardCount = Math.min(2, remainingHandIds.length);
  const hookDiscardedIds: string[] = [];

  for (let i = 0; i < discardCount; i += 1) {
    const pick = pickElement(work.run.rngState, 'shuffle', remainingHandIds);
    work.run = { ...work.run, rngState: pick.nextState };
    hookDiscardedIds.push(pick.value);
    remainingHandIds = remainingHandIds.filter((id) => id !== pick.value);
  }

  work.run = {
    ...work.run,
    handIds: remainingHandIds,
    discardPileIds: [...work.run.discardPileIds, ...hookDiscardedIds],
  };

  work.events.push({
    type: 'BOSS_TRIGGER',
    bossId: 'bl_hook',
    affectedCardIds: hookDiscardedIds,
    locKey: 'boss_hook_discard',
    locParams: { count: hookDiscardedIds.length },
  });

  const cardById = getCardMap(work.run.deck);
  const discardedCards = hookDiscardedIds
    .map((id) => cardById.get(id))
    .filter((card): card is PlayingCard => card !== undefined);

  // Лиловая печать на сброшенных картах создаёт Свиток
  for (const card of discardedCards) {
    if (!card.debuffed && card.seal === 'purple') {
      const created = tryGrantConsumable(work, 'scroll');
      if (created) {
        work.events.push({
          type: 'CARD_TRIGGER',
          cardId: card.id,
          retriggerIndex: 0,
          seal: 'purple',
          locKey: 'hand_card_purple_seal',
          locParams: { consumableId: created.id },
        });
      }
    }
  }

  // Хуки onDiscard вызываются слева направо для каждой сброшенной карты
  for (let cardIndex = 0; cardIndex < discardedCards.length; cardIndex += 1) {
    const card = discardedCards[cardIndex]!;
    const isLastDiscardedCard = cardIndex === discardedCards.length - 1;
    const slotUids = work.run.relics.map((r) => r.uid);

    for (const slotUid of slotUids) {
      const slotIndex = work.run.relics.findIndex((r) => r.uid === slotUid);
      if (slotIndex === -1) continue;

      const outcome = invokeRelicHook<'onDiscard'>(work.run, slotIndex, options, (resolved) => ({
        hook: 'onDiscard',
        state: work.run,
        effectRelic: resolved.effectRelic,
        stateRelic: resolved.stateRelic,
        relicIndex: slotIndex,
        isBlueprintCopy: resolved.isBlueprintCopy,
        discardedCards,
        card,
        cardIndex,
        isLastDiscardedCard,
      }));

      if (!outcome) continue;
      applyRelicStateEffects(work, outcome.resolved, outcome.result);
      if (outcome.result.updatedEffectState || outcome.result.locKey) {
        work.events.push({
          type: 'RELIC_TRIGGER',
          relicUid: outcome.resolved.effectRelic.uid,
          relicId: outcome.resolved.effectRelic.id,
          ...(outcome.resolved.isBlueprintCopy
            ? { copiedByUid: outcome.resolved.stateRelic.uid }
            : {}),
          hook: 'onDiscard',
          ...(outcome.result.locKey ? { locKey: outcome.result.locKey } : {}),
          ...(outcome.result.locParams ? { locParams: outcome.result.locParams } : {}),
        });
      }
    }
  }
}

/**
 * Собирает повторы для сыгранной карты на этапе 4 (база + Алая печать + ретриггеры Реликвий).
 */
function collectScoreCardRepetitions(
  state: RunState,
  card: PlayingCard,
  playedCards: readonly PlayingCard[],
  scoringCards: readonly PlayingCard[],
  handEvaluation: HandEvaluationResult,
  options: ScoringOptions,
): RepetitionSource[] {
  const reps: RepetitionSource[] = [{ kind: 'base' }];
  if (card.seal === 'red') {
    reps.push({ kind: 'seal' });
  }

  for (let slotIndex = 0; slotIndex < state.relics.length; slotIndex += 1) {
    const outcome = invokeRelicHook<'onScoreCardRepetition'>(
      state,
      slotIndex,
      options,
      (resolved) => ({
        hook: 'onScoreCardRepetition',
        state,
        effectRelic: resolved.effectRelic,
        stateRelic: resolved.stateRelic,
        relicIndex: slotIndex,
        isBlueprintCopy: resolved.isBlueprintCopy,
        card,
        playedCards,
        scoringCards,
        handEvaluation,
      }),
    );

    const delta = outcome?.result.retriggerDelta ?? 0;
    for (let k = 0; k < delta; k += 1) {
      reps.push({ kind: 'relic', resolved: outcome!.resolved });
    }
  }

  return reps;
}

/**
 * Собирает повторы для карты в руке (Этап 5 и конец раунда).
 */
function collectHoldCardRepetitions(
  state: RunState,
  card: PlayingCard,
  handCards: readonly PlayingCard[],
  phase: 'scoring' | 'roundEnd',
  options: ScoringOptions,
  handEvaluation?: HandEvaluationResult,
): RepetitionSource[] {
  const reps: RepetitionSource[] = [{ kind: 'base' }];
  if (!card.debuffed && card.seal === 'red') {
    reps.push({ kind: 'seal' });
  }

  for (let slotIndex = 0; slotIndex < state.relics.length; slotIndex += 1) {
    const outcome = invokeRelicHook<'onHoldCardRepetition'>(
      state,
      slotIndex,
      options,
      (resolved) => ({
        hook: 'onHoldCardRepetition',
        state,
        effectRelic: resolved.effectRelic,
        stateRelic: resolved.stateRelic,
        relicIndex: slotIndex,
        isBlueprintCopy: resolved.isBlueprintCopy,
        card,
        handCards,
        ...(handEvaluation ? { handEvaluation } : {}),
        phase,
      }),
    );

    const delta = outcome?.result.retriggerDelta ?? 0;
    for (let k = 0; k < delta; k += 1) {
      reps.push({ kind: 'relic', resolved: outcome!.resolved });
    }
  }

  return reps;
}

/**
 * Снимает улучшения с карт, указанных Реликвией (например, j_vampire), и обновляет колоду/карты.
 */
function stripCardEnhancements(
  work: MutableWorkState,
  cardIds: readonly string[],
  relicUid: string,
  scoringCards: PlayingCard[],
  playedCards: PlayingCard[],
): void {
  const targetSet = new Set(cardIds);
  const updatedDeck = work.run.deck.map((card) => {
    if (!targetSet.has(card.id) || card.enhancement === 'none') {
      return card;
    }
    work.events.push({
      type: 'CARD_ENHANCEMENT_STRIPPED',
      cardId: card.id,
      previousEnhancement: card.enhancement,
      relicUid,
    });
    return { ...card, enhancement: 'none' as const };
  });

  work.run = { ...work.run, deck: updatedDeck };

  const deckMap = getCardMap(updatedDeck);
  for (let i = 0; i < scoringCards.length; i += 1) {
    const refreshed = deckMap.get(scoringCards[i]!.id);
    if (refreshed) scoringCards[i] = refreshed;
  }
  for (let i = 0; i < playedCards.length; i += 1) {
    const refreshed = deckMap.get(playedCards[i]!.id);
    if (refreshed) playedCards[i] = refreshed;
  }
}

/**
 * Исполняет полный 7-этапный конвейер розыгрыша руки (evaluatePlay).
 * Не мутирует переданный RunState; возвращает следующее состояние и детерминированный TraceEvent[].
 */
export function evaluatePlay(
  state: RunState,
  playedCardIds: readonly string[],
  options: ScoringOptions,
): DispatchResult {
  const work: MutableWorkState = {
    run: state,
    events: [],
  };

  // Пред-подготовка: списание руки, отметка playedThisAnte и перенос карт из руки на стол
  const playedSet = new Set(playedCardIds);
  const cardByIdInitial = getCardMap(work.run.deck);
  const playedCards: PlayingCard[] = [];
  for (const id of playedCardIds) {
    const found = cardByIdInitial.get(id);
    if (found) playedCards.push({ ...found, playedThisAnte: true });
  }

  work.run = {
    ...work.run,
    handsLeft: Math.max(0, work.run.handsLeft - 1),
    handIds: work.run.handIds.filter((id) => !playedSet.has(id)),
    deck: work.run.deck.map((card) =>
      playedSet.has(card.id) ? { ...card, playedThisAnte: true } : card,
    ),
  };

  // Босс bl_hook сбрасывает до 2 случайных карт из оставшейся руки до оценки расклада
  processBossHookDiscard(work, options);

  // Этап 1: оценка расклада и добавление сыгранных Каменных карт в scoringCards
  const handEvaluation = evaluatePokerHand(playedCards, {
    fourFingers: hasActiveRelic(work.run.relics, 'j_four_fingers'),
    shortcut: hasActiveRelic(work.run.relics, 'j_shortcut'),
  });
  const topHand = handEvaluation.handType;

  const prevLevel = work.run.handLevels[topHand];
  work.run = {
    ...work.run,
    lastPlayedHandType: topHand,
    handsPlayedThisRound: {
      ...work.run.handsPlayedThisRound,
      [topHand]: (work.run.handsPlayedThisRound[topHand] ?? 0) + 1,
    },
    handLevels: {
      ...work.run.handLevels,
      [topHand]: {
        ...prevLevel,
        playedCount: prevLevel.playedCount + 1,
        visible: true,
      },
    },
  };

  const scoringIdSet = new Set(handEvaluation.scoringCardIds);
  const rawScoringCards = [...handEvaluation.scoringCards];
  for (const card of playedCards) {
    if (card.enhancement === 'stone' && !scoringIdSet.has(card.id)) {
      scoringIdSet.add(card.id);
      rawScoringCards.push(card);
    }
  }
  let scoringCards = sortCardsByOrder(rawScoringCards, playedCardIds);

  // Этап 2: проверка запрета всей руки Боссом (bl_psychic при < 5 карт)
  const activeBoss = getActiveBossId(work.run);
  if (activeBoss === 'bl_psychic' && playedCards.length < 5) {
    work.events.push({
      type: 'BOSS_TRIGGER',
      bossId: 'bl_psychic',
      locKey: 'boss_psychic',
      locParams: { count: 5 },
    });
    work.events.push({
      type: 'HAND_DEBUFFED',
      bossId: 'bl_psychic',
      handType: topHand,
      locKey: 'hand_debuffed',
    });
    work.run = {
      ...work.run,
      discardPileIds: [...work.run.discardPileIds, ...playedCardIds],
      stats: {
        ...work.run.stats,
        handsPlayed: work.run.stats.handsPlayed + 1,
        cardsPlayed: work.run.stats.cardsPlayed + playedCardIds.length,
      },
    };
    work.events.push({
      type: 'SCORE_UPDATE',
      chips: 0,
      mult: 0,
      handScore: 0,
      totalScore: work.run.score,
      targetScore: work.run.targetScore,
      handType: topHand,
    });
    return { nextState: work.run, events: work.events };
  }

  // Этап 3: вызов onBeforeScore слева направо -> чтение базы расклада -> модификация bl_flint
  const handCardMap = getCardMap(work.run.deck);
  const currentHandCards = work.run.handIds
    .map((id) => handCardMap.get(id))
    .filter((c): c is PlayingCard => c !== undefined);

  for (let slotIndex = 0; slotIndex < work.run.relics.length; slotIndex += 1) {
    const outcome = invokeRelicHook<'onBeforeScore'>(work.run, slotIndex, options, (resolved) => ({
      hook: 'onBeforeScore',
      state: work.run,
      effectRelic: resolved.effectRelic,
      stateRelic: resolved.stateRelic,
      relicIndex: slotIndex,
      isBlueprintCopy: resolved.isBlueprintCopy,
      playedCards,
      scoringCards,
      handCards: currentHandCards,
      handEvaluation,
    }));

    if (!outcome) continue;
    applyRelicStateEffects(work, outcome.resolved, outcome.result);
    if (outcome.result.strippedCardIds && outcome.result.strippedCardIds.length > 0) {
      stripCardEnhancements(
        work,
        outcome.result.strippedCardIds,
        outcome.resolved.effectRelic.uid,
        scoringCards,
        playedCards,
      );
    }
    if (
      outcome.result.updatedEffectState ||
      outcome.result.strippedCardIds?.length ||
      outcome.result.locKey
    ) {
      work.events.push({
        type: 'RELIC_TRIGGER',
        relicUid: outcome.resolved.effectRelic.uid,
        relicId: outcome.resolved.effectRelic.id,
        ...(outcome.resolved.isBlueprintCopy
          ? { copiedByUid: outcome.resolved.stateRelic.uid }
          : {}),
        hook: 'onBeforeScore',
        ...(outcome.result.locKey ? { locKey: outcome.result.locKey } : {}),
        ...(outcome.result.locParams ? { locParams: outcome.result.locParams } : {}),
      });
    }
  }

  let chips = work.run.handLevels[topHand].chips;
  let mult = work.run.handLevels[topHand].mult;

  if (activeBoss === 'bl_flint') {
    chips = Math.max(Math.floor(chips * 0.5 + 0.5), 0);
    mult = Math.max(Math.floor(mult * 0.5 + 0.5), 1);
    work.events.push({
      type: 'BOSS_TRIGGER',
      bossId: 'bl_flint',
      locKey: 'boss_flint',
      locParams: { chips, mult },
    });
  }

  // Этап 4: подсчёт сыгранных карт слева направо с повторами и хуками onScoreCard
  const firstFaceCard = scoringCards.find((card) => isCardFace(card));
  const firstScoringFaceCardId = firstFaceCard?.id ?? null;

  for (const card of scoringCards) {
    if (card.debuffed) {
      work.events.push({
        type: 'CARD_DEBUFFED',
        cardId: card.id,
        bossId: activeBoss,
      });
      continue;
    }

    const reps = collectScoreCardRepetitions(
      work.run,
      card,
      playedCards,
      scoringCards,
      handEvaluation,
      options,
    );

    for (let repIndex = 0; repIndex < reps.length; repIndex += 1) {
      const repSource = reps[repIndex]!;
      if (repIndex > 0 && repSource.kind === 'relic') {
        work.events.push({
          type: 'RELIC_TRIGGER',
          relicUid: repSource.resolved.effectRelic.uid,
          relicId: repSource.resolved.effectRelic.id,
          ...(repSource.resolved.isBlueprintCopy
            ? { copiedByUid: repSource.resolved.stateRelic.uid }
            : {}),
          hook: 'onScoreCardRepetition',
          locKey: 'card_retrigger',
        });
      }

      // 4.1 Сила -> +Множ -> Золото -> ×Множ -> Издание самой карты
      const cardChips = getCardScoringChips(card);
      let cardMult = 0;
      if (card.enhancement === 'mult') {
        cardMult = 4;
      } else if (card.enhancement === 'lucky') {
        const multRoll = nextFloat(work.run.rngState, 'lucky');
        work.run = { ...work.run, rngState: multRoll.nextState };
        if (multRoll.value < work.run.probabilitiesNormal / 5) {
          cardMult = 20;
        }
      }

      let cardDollars = card.seal === 'gold' ? 3 : 0;
      if (card.enhancement === 'lucky') {
        const moneyRoll = nextFloat(work.run.rngState, 'lucky');
        work.run = { ...work.run, rngState: moneyRoll.nextState };
        if (moneyRoll.value < work.run.probabilitiesNormal / 15) {
          cardDollars += 20;
        }
      }

      const cardXMult = card.enhancement === 'glass' ? 2 : undefined;

      chips += cardChips;
      mult += cardMult;
      if (cardDollars > 0) {
        addDollars(work, cardDollars, 'card');
      }
      if (cardXMult !== undefined) {
        mult *= cardXMult;
      }

      let edChips = 0;
      let edMult = 0;
      let edXMult = 1;
      if (card.edition === 'foil') edChips = 50;
      if (card.edition === 'holo') edMult = 10;
      if (card.edition === 'polychrome') edXMult = 1.5;

      chips += edChips;
      mult += edMult;
      mult *= edXMult;

      work.events.push({
        type: 'CARD_TRIGGER',
        cardId: card.id,
        retriggerIndex: repIndex,
        ...(cardChips + edChips !== 0 ? { chipsDelta: cardChips + edChips } : {}),
        ...(cardMult + edMult !== 0 ? { multDelta: cardMult + edMult } : {}),
        ...(cardXMult !== undefined || edXMult !== 1
          ? { xMult: (cardXMult ?? 1) * edXMult }
          : {}),
        ...(cardDollars !== 0 ? { dollarsDelta: cardDollars } : {}),
        ...(card.edition !== 'base' ? { edition: card.edition } : {}),
        ...(card.enhancement !== 'none' ? { enhancement: card.enhancement } : {}),
        ...(card.seal !== 'none' ? { seal: card.seal } : {}),
      });

      // 4.2 Эффекты Реликвий onScoreCard слева направо
      for (let slotIndex = 0; slotIndex < work.run.relics.length; slotIndex += 1) {
        const outcome = invokeRelicHook<'onScoreCard'>(
          work.run,
          slotIndex,
          options,
          (resolved) => ({
            hook: 'onScoreCard',
            state: work.run,
            effectRelic: resolved.effectRelic,
            stateRelic: resolved.stateRelic,
            relicIndex: slotIndex,
            isBlueprintCopy: resolved.isBlueprintCopy,
            card,
            playedCards,
            scoringCards,
            handEvaluation,
            isFirstScoringFaceCard: card.id === firstScoringFaceCardId,
          }),
        );

        if (!outcome) continue;
        const res = outcome.result;
        applyRelicStateEffects(work, outcome.resolved, res);

        if (res.chipsDelta) chips += res.chipsDelta;
        if (res.multDelta) mult += res.multDelta;
        if (res.dollarsDelta) addDollars(work, res.dollarsDelta, 'relic');
        if (res.xMult) mult *= res.xMult;
        if (res.createConsumableKind) {
          tryGrantConsumable(work, res.createConsumableKind);
        }

        work.events.push({
          type: 'RELIC_TRIGGER',
          relicUid: outcome.resolved.effectRelic.uid,
          relicId: outcome.resolved.effectRelic.id,
          ...(outcome.resolved.isBlueprintCopy
            ? { copiedByUid: outcome.resolved.stateRelic.uid }
            : {}),
          hook: 'onScoreCard',
          ...(res.chipsDelta ? { chipsDelta: res.chipsDelta } : {}),
          ...(res.multDelta ? { multDelta: res.multDelta } : {}),
          ...(res.xMult ? { xMult: res.xMult } : {}),
          ...(res.dollarsDelta ? { dollarsDelta: res.dollarsDelta } : {}),
          ...(res.locKey ? { locKey: res.locKey } : {}),
          ...(res.locParams ? { locParams: res.locParams } : {}),
        });
      }
    }
  }

  // Этап 5: эффекты оставшихся в руке карт слева направо (Стальная + onHoldCard; издания не работают)
  const freshDeckMap = getCardMap(work.run.deck);
  const heldCards = work.run.handIds
    .map((id) => freshDeckMap.get(id))
    .filter((c): c is PlayingCard => c !== undefined);

  for (const heldCard of heldCards) {
    const evaluateHoldPass = () => {
      const hasSteel = !heldCard.debuffed && heldCard.enhancement === 'steel';
      const relicHoldHits: Array<{
        readonly resolved: ResolvedRelicTarget;
        readonly result: RelicEffectResult;
      }> = [];

      for (let slotIndex = 0; slotIndex < work.run.relics.length; slotIndex += 1) {
        const outcome = invokeRelicHook<'onHoldCard'>(work.run, slotIndex, options, (resolved) => ({
          hook: 'onHoldCard',
          state: work.run,
          effectRelic: resolved.effectRelic,
          stateRelic: resolved.stateRelic,
          relicIndex: slotIndex,
          isBlueprintCopy: resolved.isBlueprintCopy,
          card: heldCard,
          handCards: heldCards,
          handEvaluation,
        }));
        if (outcome) {
          relicHoldHits.push(outcome);
        }
      }

      return { hasSteel, relicHoldHits };
    };

    const firstPass = evaluateHoldPass();
    if (!firstPass.hasSteel && firstPass.relicHoldHits.length === 0) {
      continue;
    }

    const holdReps = collectHoldCardRepetitions(
      work.run,
      heldCard,
      heldCards,
      'scoring',
      options,
      handEvaluation,
    );

    for (let repIndex = 0; repIndex < holdReps.length; repIndex += 1) {
      const repSource = holdReps[repIndex]!;
      if (repIndex > 0 && repSource.kind === 'relic') {
        work.events.push({
          type: 'RELIC_TRIGGER',
          relicUid: repSource.resolved.effectRelic.uid,
          relicId: repSource.resolved.effectRelic.id,
          ...(repSource.resolved.isBlueprintCopy
            ? { copiedByUid: repSource.resolved.stateRelic.uid }
            : {}),
          hook: 'onHoldCardRepetition',
          locKey: 'card_retrigger',
        });
      }

      const pass = repIndex === 0 ? firstPass : evaluateHoldPass();
      if (pass.hasSteel) {
        mult *= 1.5;
        work.events.push({
          type: 'HAND_CARD_TRIGGER',
          cardId: heldCard.id,
          retriggerIndex: repIndex,
          xMult: 1.5,
          locKey: 'hand_card_steel',
          locParams: { xMult: 1.5 },
        });
      }

      for (const hit of pass.relicHoldHits) {
        const res = hit.result;
        applyRelicStateEffects(work, hit.resolved, res);
        if (res.dollarsDelta) addDollars(work, res.dollarsDelta, 'relic');
        if (res.multDelta) mult += res.multDelta;
        if (res.xMult) mult *= res.xMult;

        work.events.push({
          type: 'RELIC_TRIGGER',
          relicUid: hit.resolved.effectRelic.uid,
          relicId: hit.resolved.effectRelic.id,
          ...(hit.resolved.isBlueprintCopy
            ? { copiedByUid: hit.resolved.stateRelic.uid }
            : {}),
          hook: 'onHoldCard',
          ...(res.multDelta ? { multDelta: res.multDelta } : {}),
          ...(res.xMult ? { xMult: res.xMult } : {}),
          ...(res.dollarsDelta ? { dollarsDelta: res.dollarsDelta } : {}),
          ...(res.locKey ? { locKey: res.locKey } : {}),
          ...(res.locParams ? { locParams: res.locParams } : {}),
        });
      }
    }
  }

  // Этап 6: Реликвии слева направо (foil/holo на stateRelic -> onScoreRelic -> polychrome на stateRelic), затем Расходники (Обсерватория)
  const relicSlotUids = work.run.relics.map((r) => r.uid);
  for (const slotUid of relicSlotUids) {
    const slotIndex = work.run.relics.findIndex((r) => r.uid === slotUid);
    if (slotIndex === -1) continue;
    const slotRelic = work.run.relics[slotIndex]!;
    if (slotRelic.debuffed) continue;

    if (slotRelic.edition === 'foil') {
      chips += 50;
      work.events.push({
        type: 'RELIC_TRIGGER',
        relicUid: slotRelic.uid,
        relicId: slotRelic.id,
        hook: 'onScoreRelic',
        chipsDelta: 50,
        locKey: 'relic_chips',
        locParams: { chips: 50 },
      });
    } else if (slotRelic.edition === 'holo') {
      mult += 10;
      work.events.push({
        type: 'RELIC_TRIGGER',
        relicUid: slotRelic.uid,
        relicId: slotRelic.id,
        hook: 'onScoreRelic',
        multDelta: 10,
        locKey: 'relic_mult',
        locParams: { mult: 10 },
      });
    }

    const outcome = invokeRelicHook<'onScoreRelic'>(work.run, slotIndex, options, (resolved) => ({
      hook: 'onScoreRelic',
      state: work.run,
      effectRelic: resolved.effectRelic,
      stateRelic: resolved.stateRelic,
      relicIndex: slotIndex,
      isBlueprintCopy: resolved.isBlueprintCopy,
      playedCards,
      scoringCards,
      handCards: heldCards,
      handEvaluation,
    }));

    if (outcome) {
      const res = outcome.result;
      applyRelicStateEffects(work, outcome.resolved, res);

      if (res.multDelta) mult += res.multDelta;
      if (res.chipsDelta) chips += res.chipsDelta;
      if (res.xMult) mult *= res.xMult;
      if (res.dollarsDelta) addDollars(work, res.dollarsDelta, 'relic');

      let createdScroll: ConsumableInstance | null = null;
      if (res.createConsumableKind) {
        createdScroll = tryGrantConsumable(work, res.createConsumableKind);
      }

      work.events.push({
        type: 'RELIC_TRIGGER',
        relicUid: outcome.resolved.effectRelic.uid,
        relicId: outcome.resolved.effectRelic.id,
        ...(outcome.resolved.isBlueprintCopy
          ? { copiedByUid: outcome.resolved.stateRelic.uid }
          : {}),
        hook: 'onScoreRelic',
        ...(res.chipsDelta ? { chipsDelta: res.chipsDelta } : {}),
        ...(res.multDelta ? { multDelta: res.multDelta } : {}),
        ...(res.xMult ? { xMult: res.xMult } : {}),
        ...(res.dollarsDelta ? { dollarsDelta: res.dollarsDelta } : {}),
        ...(res.locKey ? { locKey: res.locKey } : {}),
        ...(createdScroll
          ? { locParams: { ...res.locParams, consumableId: createdScroll.id } }
          : res.locParams
            ? { locParams: res.locParams }
            : {}),
      });
    }

    if (
      slotRelic.edition === 'polychrome' &&
      work.run.relics.some((r) => r.uid === slotRelic.uid)
    ) {
      mult *= 1.5;
      work.events.push({
        type: 'RELIC_TRIGGER',
        relicUid: slotRelic.uid,
        relicId: slotRelic.id,
        hook: 'onScoreRelic',
        xMult: 1.5,
        locKey: 'relic_x_mult',
        locParams: { xMult: 1.5 },
      });
    }
  }

  if (work.run.charters.includes('v_observatory')) {
    for (const consumable of work.run.consumables) {
      if (consumable.kind !== 'celestial') continue;
      if (CELESTIAL_HAND_MAP[consumable.id as CelestialId] === topHand) {
        mult *= 1.5;
        work.events.push({
          type: 'CONSUMABLE_TRIGGER',
          consumableUid: consumable.uid,
          consumableId: consumable.id,
          handType: topHand,
          xMult: 1.5,
          locKey: 'relic_x_mult',
          locParams: { xMult: 1.5 },
        });
      }
    }
  }

  // Этап 7: проверка поломки Хрустальных карт (ровно 1 раз на карту, независимо от ретриггеров) и финализация
  const shatteredIds = new Set<string>();
  for (const card of scoringCards) {
    if (card.enhancement === 'glass' && !card.debuffed) {
      const shatterRoll = nextFloat(work.run.rngState, 'glass');
      work.run = { ...work.run, rngState: shatterRoll.nextState };
      if (shatterRoll.value < work.run.probabilitiesNormal / 4) {
        shatteredIds.add(card.id);
        work.events.push({
          type: 'CARD_SHATTER',
          cardId: card.id,
          reason: 'glass',
        });
      }
    }
  }

  const survivingPlayedIds = playedCardIds.filter((id) => !shatteredIds.has(id));
  const handScore = Math.floor(chips * mult);
  const totalScore = work.run.score + handScore;
  const isNewBestHand =
    handScore > work.run.stats.bestHandScore || work.run.stats.bestHandType === null;

  work.run = {
    ...work.run,
    score: totalScore,
    deck:
      shatteredIds.size > 0
        ? work.run.deck.filter((card) => !shatteredIds.has(card.id))
        : work.run.deck,
    discardPileIds: [...work.run.discardPileIds, ...survivingPlayedIds],
    stats: {
      ...work.run.stats,
      handsPlayed: work.run.stats.handsPlayed + 1,
      cardsPlayed: work.run.stats.cardsPlayed + playedCardIds.length,
      bestHandScore: Math.max(work.run.stats.bestHandScore, handScore),
      bestHandType: isNewBestHand ? topHand : work.run.stats.bestHandType,
      cardsDestroyed: work.run.stats.cardsDestroyed + shatteredIds.size,
    },
  };

  work.events.push({
    type: 'SCORE_UPDATE',
    chips,
    mult,
    handScore,
    totalScore,
    targetScore: work.run.targetScore,
    handType: topHand,
  });

  if (totalScore >= work.run.targetScore) {
    const slot = work.run.anteBlinds[work.run.currentBlindIndex];
    work.events.push({
      type: 'BLIND_DEFEATED',
      ante: work.run.ante,
      blindKind: slot.kind,
      bossId: slot.bossId,
      finalScore: totalScore,
      targetScore: work.run.targetScore,
    });
  }

  return {
    nextState: work.run,
    events: work.events,
  };
}

/**
 * Рассчитывает эффекты конца раунда (Золотые карты, Лазурная печать в руке) и формирует CashoutBreakdown.
 * Итоговая сумма выплаты (totalReward) записывается в cashout без немедленного начисления (выплачивается в CLAIM_CASHOUT).
 */
export function evaluateRoundEnd(state: RunState, options: ScoringOptions): DispatchResult {
  const work: MutableWorkState = {
    run: state,
    events: [],
  };

  // 1. Эффекты карт, оставшихся в руке (слева направо) с ретриггером от Алой печати и Зеркального мима
  const deckMap = getCardMap(work.run.deck);
  const heldCards = work.run.handIds
    .map((id) => deckMap.get(id))
    .filter((c): c is PlayingCard => c !== undefined);

  for (const card of heldCards) {
    if (card.debuffed) continue;

    const hasGold = card.enhancement === 'gold';
    const hasBlueSeal = card.seal === 'blue';
    if (!hasGold && !hasBlueSeal) continue;

    const reps = collectHoldCardRepetitions(work.run, card, heldCards, 'roundEnd', options);
    for (let repIndex = 0; repIndex < reps.length; repIndex += 1) {
      const repSource = reps[repIndex]!;
      if (repIndex > 0 && repSource.kind === 'relic') {
        work.events.push({
          type: 'RELIC_TRIGGER',
          relicUid: repSource.resolved.effectRelic.uid,
          relicId: repSource.resolved.effectRelic.id,
          ...(repSource.resolved.isBlueprintCopy
            ? { copiedByUid: repSource.resolved.stateRelic.uid }
            : {}),
          hook: 'onHoldCardRepetition',
          locKey: 'card_retrigger',
        });
      }

      if (hasGold) {
        addDollars(work, 3, 'card');
        work.events.push({
          type: 'HAND_CARD_TRIGGER',
          cardId: card.id,
          retriggerIndex: repIndex,
          dollarsDelta: 3,
          locKey: 'hand_card_gold',
          locParams: { dollars: 3 },
        });
      }

      if (hasBlueSeal && work.run.lastPlayedHandType !== null) {
        const sphereId = HAND_TO_CELESTIAL_MAP[work.run.lastPlayedHandType];
        const created = tryGrantConsumable(work, 'celestial', sphereId);
        if (created) {
          work.events.push({
            type: 'HAND_CARD_TRIGGER',
            cardId: card.id,
            retriggerIndex: repIndex,
            createdConsumableId: created.id,
            locKey: 'hand_card_blue_seal',
          });
        }
      }
    }
  }

  // 2. Формирование CashoutBreakdown строго по порядку оригинала
  const blindSlot = work.run.anteBlinds[work.run.currentBlindIndex];
  const won = work.run.score >= work.run.targetScore;
  const blindReward = won ? blindSlot.reward : 0;
  const unusedHandsBonus = work.run.handsLeft;

  let relicBonus = 0;
  for (let slotIndex = 0; slotIndex < work.run.relics.length; slotIndex += 1) {
    const outcome = invokeRelicHook<'onRoundEnd'>(work.run, slotIndex, options, (resolved) => ({
      hook: 'onRoundEnd',
      state: work.run,
      effectRelic: resolved.effectRelic,
      stateRelic: resolved.stateRelic,
      relicIndex: slotIndex,
      isBlueprintCopy: resolved.isBlueprintCopy,
      blind: blindSlot,
      won,
    }));

    if (!outcome) continue;
    const res = outcome.result;
    applyRelicStateEffects(work, outcome.resolved, res);
    if (res.dollarsDelta) {
      relicBonus += res.dollarsDelta;
    }
    work.events.push({
      type: 'RELIC_TRIGGER',
      relicUid: outcome.resolved.effectRelic.uid,
      relicId: outcome.resolved.effectRelic.id,
      ...(outcome.resolved.isBlueprintCopy
        ? { copiedByUid: outcome.resolved.stateRelic.uid }
        : {}),
      hook: 'onRoundEnd',
      ...(res.dollarsDelta ? { dollarsDelta: res.dollarsDelta } : {}),
      ...(res.locKey ? { locKey: res.locKey } : {}),
      ...(res.locParams ? { locParams: res.locParams } : {}),
    });
  }

  let tagBonus = 0;
  let remainingTags = work.run.pendingTags;
  if (blindSlot.kind === 'boss' && won) {
    const nextTags: typeof remainingTags[number][] = [];
    for (const tagId of remainingTags) {
      if (tagId === 'tag_investment') {
        tagBonus += 25;
        work.events.push({
          type: 'TAG_TRIGGER',
          tagId: 'tag_investment',
          locKey: 'tag_activated',
          locParams: { tagName: 'tag_investment', dollars: 25 },
        });
      } else {
        nextTags.push(tagId);
      }
    }
    remainingTags = nextTags;
  }

  // Проценты начисляются на текущее золото (до прибавления наград кашаута)
  const interestBonus =
    work.run.dollars >= 5
      ? Math.min(Math.floor(work.run.dollars / 5), Math.floor(work.run.interestCap / 5))
      : 0;

  const totalReward = blindReward + unusedHandsBonus + interestBonus + relicBonus + tagBonus;
  const cashout: CashoutBreakdown = {
    blindReward,
    unusedHandsBonus,
    interestBonus,
    relicBonus,
    tagBonus,
    totalReward,
  };

  // Сброс временных эффектов раунда и восстановление размера руки при победе над bl_manacle
  const restoreManacleHandSize =
    blindSlot.kind === 'boss' &&
    blindSlot.bossId === 'bl_manacle' &&
    !work.run.activeBossDisabled &&
    won
      ? 1
      : 0;

  work.run = {
    ...work.run,
    handSize: work.run.handSize + restoreManacleHandSize,
    tempHandSizeBonus: 0,
    activeBossDisabled: false,
    savedBossDiscards: null,
    pendingTags: remainingTags,
    cashout,
  };

  return {
    nextState: work.run,
    events: work.events,
  };
}
