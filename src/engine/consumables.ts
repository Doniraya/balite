import { HAND_BASE_CONFIG, getHandLevelStats } from './handEval';
import { nextFloat, pickElement, shuffleArray } from './prng';
import {
  calculateRelicBuyCost,
  calculateRelicSellValue,
  createRelicInstance,
  getRelicDefinition,
  resolveRelicTarget,
} from './relics';
import { pickPoolRelic, pollEdition } from './shop';
import {
  CELESTIAL_IDS,
  HAND_TYPES,
  RUNE_IDS,
  SCROLL_IDS,
  type CelestialId,
  type ConsumableId,
  type ConsumableInstance,
  type ConsumableKind,
  type DispatchResult,
  type Edition,
  type Enhancement,
  type HandType,
  type PlayingCard,
  type Rank,
  type RelicEffectResult,
  type RelicHookContext,
  type RelicHookContextFor,
  type RelicHookName,
  type RelicInstance,
  type RelicRegistryLookup,
  type RunState,
  type RuneId,
  type ScrollId,
  type Seal,
  type TraceEvent,
} from './types';

/**
 * Функция разрешения цели Реликвии с учётом Blueprint/Brainstorm.
 */
export type ResolveConsumableRelicTargetFn = (
  relics: readonly RelicInstance[],
  slotIndex: number,
  lookup: RelicRegistryLookup,
) => {
  readonly effectRelic: RelicInstance;
  readonly stateRelic: RelicInstance;
  readonly isBlueprintCopy: boolean;
} | null;

/**
 * Опции применения расходника с возможностью подмены реестра и резолвера Реликвий.
 */
export interface ConsumableApplyOptions {
  readonly relicRegistry?: RelicRegistryLookup;
  readonly resolveRelicTarget?: ResolveConsumableRelicTargetFn;
}

/**
 * Прямое отображение всех 12 Астральных сфер в соответствующие расклады.
 */
export const CELESTIAL_HAND_MAP: Readonly<Record<CelestialId, HandType>> = {
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

/**
 * Обратное отображение всех 12 раскладов в соответствующие Астральные сферы.
 */
export const HAND_TO_CELESTIAL_MAP: Readonly<Record<HandType, CelestialId>> = {
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

const CELESTIAL_SET = new Set<string>(CELESTIAL_IDS);
const SCROLL_SET = new Set<string>(SCROLL_IDS);
const RUNE_SET = new Set<string>(RUNE_IDS);

/**
 * Правила применения Алхимических свитков, накладывающих Улучшения на карты в руке.
 */
const ENHANCEMENT_SCROLL_RULES: Readonly<
  Partial<Record<ScrollId, { readonly max: number; readonly enhancement: Enhancement }>>
> = {
  c_magician: { max: 2, enhancement: 'lucky' },
  c_empress: { max: 2, enhancement: 'mult' },
  c_heirophant: { max: 2, enhancement: 'bonus' },
  c_lovers: { max: 1, enhancement: 'wild' },
  c_chariot: { max: 1, enhancement: 'steel' },
  c_justice: { max: 1, enhancement: 'glass' },
  c_devil: { max: 1, enhancement: 'gold' },
  c_tower: { max: 1, enhancement: 'stone' },
};

/**
 * Правила применения Эфирных рун, ставящих Печати на одну карту в руке.
 */
const SEAL_RUNE_RULES: Readonly<Partial<Record<RuneId, Seal>>> = {
  c_talisman: 'gold',
  c_deja_vu: 'red',
  c_trance: 'blue',
  c_medium: 'purple',
};

/**
 * Определяет категорию расходника по его каноническому идентификатору.
 */
function getConsumableKind(id: ConsumableId): ConsumableKind {
  if (CELESTIAL_SET.has(id)) return 'celestial';
  if (SCROLL_SET.has(id)) return 'scroll';
  if (RUNE_SET.has(id)) return 'rune';
  throw new RangeError(`UNKNOWN_CONSUMABLE_ID: ${String(id)}`);
}

/**
 * Возвращает базовую стоимость расходника: 3 з. для Сфер/Свитков и 4 з. для Эфирных рун.
 */
function getConsumableBaseCost(kind: ConsumableKind): number {
  return kind === 'rune' ? 4 : 3;
}

/**
 * Вычисляет цену покупки расходника с учётом Издания и процентной скидки магазина (минимум 1 з.).
 */
export function calculateConsumableBuyCost(
  baseCost: number,
  edition: Edition = 'base',
  discountPercent = 0,
): number {
  return calculateRelicBuyCost(baseCost, edition, discountPercent);
}

/**
 * Вычисляет цену продажи расходника от цены его покупки (минимум 1 з.).
 */
export function calculateConsumableSellValue(buyCost: number): number {
  return calculateRelicSellValue(buyCost, 0);
}

/**
 * Создаёт неизменяемый экземпляр расходника с расчётом категории, базовой цены и цены продажи.
 */
export function createConsumableInstance(
  id: ConsumableId,
  uid: string,
  edition: Edition = 'base',
  discountPercent = 0,
): ConsumableInstance {
  const kind = getConsumableKind(id);
  const baseCost = getConsumableBaseCost(kind);
  const buyCost = calculateConsumableBuyCost(baseCost, edition, discountPercent);

  return {
    uid,
    id,
    kind,
    edition,
    baseCost,
    sellValue: calculateConsumableSellValue(buyCost),
  };
}

/**
 * Возвращает эффективный лимит слотов Реликвий с учётом Теневых изданий.
 */
function getEffectiveMaxRelics(state: RunState): number {
  const negativeCount = state.relics.filter((r) => r.edition === 'negative').length;
  return state.maxRelics + negativeCount;
}

/**
 * Проверяет наличие свободного места под новый расходник после возможного освобождения слота самим расходником.
 */
function hasConsumableSlotForSpawn(state: RunState, consumable: ConsumableInstance): boolean {
  const remaining = state.consumables.filter((item) => item.uid !== consumable.uid);
  const negativeRemaining = remaining.filter((item) => item.edition === 'negative').length;
  const effectiveLimit = state.maxConsumables + negativeRemaining;
  return remaining.length < effectiveLimit;
}

/**
 * Возвращает активный список ID карт руки, доступных для выбора эффектами Свитков и Рун, или null.
 */
function getAccessibleHandIds(state: RunState): readonly string[] | null {
  if (state.phase === 'playing') {
    return state.handIds;
  }
  if (state.phase === 'booster') {
    if (state.booster && state.booster.drawnHandCardIds.length > 0) {
      return state.booster.drawnHandCardIds;
    }
    return state.handIds;
  }
  return null;
}

/**
 * Проверяет корректность и уникальность выбранных карт в активной руке.
 */
function areValidTargetCards(
  state: RunState,
  targetCardIds: readonly string[],
  min: number,
  max: number,
): boolean {
  const activeHandIds = getAccessibleHandIds(state);
  if (!activeHandIds) return false;
  if (targetCardIds.length < min || targetCardIds.length > max) return false;
  if (new Set(targetCardIds).size !== targetCardIds.length) return false;

  const activeSet = new Set(activeHandIds);
  const deckSet = new Set(state.deck.map((card) => card.id));
  return targetCardIds.every((id) => activeSet.has(id) && deckSet.has(id));
}

/**
 * Проверяет, допустимо ли применение данного расходника в текущем состоянии забега и с выбранными картами.
 */
export function canUseConsumable(
  state: RunState,
  consumable: ConsumableInstance,
  targetCardIds: readonly string[] = [],
): boolean {
  if (state.phase === 'victory' || state.phase === 'game_over') {
    return false;
  }

  if (consumable.kind === 'celestial' || consumable.id === 'c_black_hole') {
    return true;
  }

  const enhancementRule = ENHANCEMENT_SCROLL_RULES[consumable.id as ScrollId];
  if (enhancementRule) {
    return areValidTargetCards(state, targetCardIds, 1, enhancementRule.max);
  }

  const targetSeal = SEAL_RUNE_RULES[consumable.id as RuneId];
  if (targetSeal) {
    return areValidTargetCards(state, targetCardIds, 1, 1);
  }

  switch (consumable.id) {
    case 'c_strength':
    case 'c_hanged_man':
      return areValidTargetCards(state, targetCardIds, 1, 2);
    case 'c_death':
      return areValidTargetCards(state, targetCardIds, 2, 2);
    case 'c_fool':
      return (
        state.lastUsedConsumableId !== null &&
        state.lastUsedConsumableId !== 'c_fool' &&
        hasConsumableSlotForSpawn(state, consumable)
      );
    case 'c_hermit':
    case 'c_temperance':
      return true;
    case 'c_wheel_of_fortune':
    case 'c_hex':
      return state.relics.some((relic) => relic.edition === 'base');
    case 'c_judgement':
      return state.relics.length < getEffectiveMaxRelics(state);
    case 'c_aura': {
      if (!areValidTargetCards(state, targetCardIds, 1, 1)) return false;
      const target = state.deck.find((card) => card.id === targetCardIds[0]);
      return target?.edition === 'base';
    }
    case 'c_cryptid':
      return areValidTargetCards(state, targetCardIds, 1, 1);
    case 'c_immolate': {
      const activeHandIds = getAccessibleHandIds(state);
      return activeHandIds !== null && activeHandIds.length > 1;
    }
    default:
      return false;
  }
}

/**
 * Обновляет одну карту в колоде с помощью чистой функции трансформации.
 */
function mapDeckCards(
  deck: readonly PlayingCard[],
  targetSet: ReadonlySet<string>,
  transform: (card: PlayingCard) => PlayingCard,
): PlayingCard[] {
  return deck.map((card) => (targetSet.has(card.id) ? transform(card) : card));
}

/**
 * Удаляет уничтоженные карты из колоды и всех активных стопок забега и обновляет счётчик статистики.
 */
function destroyCardsFromState(
  state: RunState,
  destroyedIds: readonly string[],
  reason: 'scroll' | 'rune',
  events: TraceEvent[],
): RunState {
  const removedSet = new Set(destroyedIds);
  for (const cardId of destroyedIds) {
    events.push({
      type: 'CARD_SHATTER',
      cardId,
      reason,
    });
  }

  return {
    ...state,
    deck: state.deck.filter((card) => !removedSet.has(card.id)),
    handIds: state.handIds.filter((id) => !removedSet.has(id)),
    drawPileIds: state.drawPileIds.filter((id) => !removedSet.has(id)),
    discardPileIds: state.discardPileIds.filter((id) => !removedSet.has(id)),
    booster: state.booster
      ? {
          ...state.booster,
          drawnHandCardIds: state.booster.drawnHandCardIds.filter((id) => !removedSet.has(id)),
        }
      : null,
    stats: {
      ...state.stats,
      cardsDestroyed: state.stats.cardsDestroyed + destroyedIds.length,
    },
  };
}

/**
 * Пересчитывает цену продажи Реликвии после наложения нового Издания.
 */
function applyEditionToRelic(
  relic: RelicInstance,
  edition: Edition,
  discountPercent: number,
): RelicInstance {
  const buyCost = calculateRelicBuyCost(relic.baseCost, edition, discountPercent);
  return {
    ...relic,
    edition,
    sellValue: calculateRelicSellValue(buyCost, relic.extraValue),
  };
}

/**
 * Повышает уровень конкретного расклада на указанную величину и возвращает новое состояние и события.
 */
function applyHandLevelUp(
  state: RunState,
  handType: HandType,
  amount: number,
): { readonly nextState: RunState; readonly newLevel: number; readonly chips: number; readonly mult: number } {
  const current = state.handLevels[handType] ?? {
    level: 1,
    chips: HAND_BASE_CONFIG[handType].baseChips,
    mult: HAND_BASE_CONFIG[handType].baseMult,
    playedCount: 0,
    visible: !HAND_BASE_CONFIG[handType].hidden,
  };
  const newLevel = Math.max(0, current.level + amount);
  const stats = getHandLevelStats(handType, newLevel);

  return {
    nextState: {
      ...state,
      handLevels: {
        ...state.handLevels,
        [handType]: {
          ...current,
          level: newLevel,
          chips: stats.chips,
          mult: stats.mult,
        },
      },
    },
    newLevel,
    chips: stats.chips,
    mult: stats.mult,
  };
}

/**
 * Вызывает указанный хук по всем слотам Реликвий и фиксирует обновления счётчиков в состоянии.
 */
function invokeConsumableRelicHooks<H extends RelicHookName>(
  state: RunState,
  options: ConsumableApplyOptions,
  events: TraceEvent[],
  buildContext: (
    resolved: NonNullable<ReturnType<ResolveConsumableRelicTargetFn>>,
    slotIndex: number,
    currentState: RunState,
  ) => RelicHookContextFor<H>,
): RunState {
  const registry = options.relicRegistry ?? getRelicDefinition;
  const resolve = options.resolveRelicTarget ?? resolveRelicTarget;
  let current = state;

  for (let slotIndex = 0; slotIndex < current.relics.length; slotIndex += 1) {
    const resolved = resolve(current.relics, slotIndex, registry);
    if (!resolved) continue;

    const ctx = buildContext(resolved, slotIndex, current);
    const def = registry(resolved.effectRelic.id);
    const handler = def?.hooks[ctx.hook] as
      | ((context: RelicHookContext) => RelicEffectResult | null | undefined)
      | undefined;
    if (!handler) continue;

    const result = handler(ctx);
    if (!result) continue;

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

    if (result.updatedEffectState || result.locKey) {
      events.push({
        type: 'RELIC_TRIGGER',
        relicUid: resolved.effectRelic.uid,
        relicId: resolved.effectRelic.id,
        ...(resolved.isBlueprintCopy ? { copiedByUid: resolved.stateRelic.uid } : {}),
        hook: ctx.hook,
        ...(result.locKey ? { locKey: result.locKey } : {}),
        ...(result.locParams ? { locParams: result.locParams } : {}),
      });
    }
  }

  return current;
}

/**
 * Применяет эффект расходника (Сферы, Свитка или Руны) без мутации входного RunState.
 */
export function applyConsumable(
  state: RunState,
  consumable: ConsumableInstance,
  targetCardIds: readonly string[] = [],
  options: ConsumableApplyOptions = {},
): DispatchResult {
  if (!canUseConsumable(state, consumable, targetCardIds)) {
    return { nextState: state, events: [] };
  }

  const events: TraceEvent[] = [];
  // Если расходник использовался из собственного слота игрока — освобождаем слот перед созданием копий
  let workState: RunState = {
    ...state,
    consumables: state.consumables.filter((item) => item.uid !== consumable.uid),
  };
  let addedCardsForHook: PlayingCard[] = [];

  if (consumable.kind === 'celestial') {
    const handType = CELESTIAL_HAND_MAP[consumable.id as CelestialId];
    const leveled = applyHandLevelUp(workState, handType, 1);
    workState = leveled.nextState;
    events.push({
      type: 'HAND_LEVEL_UP',
      handType,
      newLevel: leveled.newLevel,
      chips: leveled.chips,
      mult: leveled.mult,
    });
    events.push({
      type: 'CONSUMABLE_TRIGGER',
      consumableUid: consumable.uid,
      consumableId: consumable.id,
      handType,
      locKey: 'hand_level_up',
      locParams: { handName: handType, level: leveled.newLevel },
    });
  } else {
    const enhancementRule = ENHANCEMENT_SCROLL_RULES[consumable.id as ScrollId];
    const targetSeal = SEAL_RUNE_RULES[consumable.id as RuneId];

    if (enhancementRule) {
      const targetSet = new Set(targetCardIds);
      workState = {
        ...workState,
        deck: mapDeckCards(workState.deck, targetSet, (card) => ({
          ...card,
          enhancement: enhancementRule.enhancement,
        })),
      };
      events.push({
        type: 'CONSUMABLE_TRIGGER',
        consumableUid: consumable.uid,
        consumableId: consumable.id,
        targetCardIds: [...targetCardIds],
        locKey: 'consumable_used',
      });
    } else if (targetSeal) {
      const targetSet = new Set(targetCardIds);
      workState = {
        ...workState,
        deck: mapDeckCards(workState.deck, targetSet, (card) => ({
          ...card,
          seal: targetSeal,
        })),
      };
      events.push({
        type: 'CONSUMABLE_TRIGGER',
        consumableUid: consumable.uid,
        consumableId: consumable.id,
        targetCardIds: [...targetCardIds],
        locKey: 'consumable_used',
      });
    } else {
      switch (consumable.id) {
        case 'c_strength': {
          const targetSet = new Set(targetCardIds);
          workState = {
            ...workState,
            deck: mapDeckCards(workState.deck, targetSet, (card) => ({
              ...card,
              rank: card.rank === 14 ? 2 : ((card.rank + 1) as Rank),
            })),
          };
          events.push({
            type: 'CONSUMABLE_TRIGGER',
            consumableUid: consumable.uid,
            consumableId: consumable.id,
            targetCardIds: [...targetCardIds],
            locKey: 'consumable_used',
          });
          break;
        }
        case 'c_hanged_man': {
          workState = destroyCardsFromState(workState, targetCardIds, 'scroll', events);
          events.push({
            type: 'CONSUMABLE_TRIGGER',
            consumableUid: consumable.uid,
            consumableId: consumable.id,
            targetCardIds: [...targetCardIds],
            locKey: 'consumable_used',
          });
          break;
        }
        case 'c_death': {
          const activeHandIds = getAccessibleHandIds(workState) ?? [];
          const idx0 = activeHandIds.indexOf(targetCardIds[0]!);
          const idx1 = activeHandIds.indexOf(targetCardIds[1]!);
          // Левая карта в руке превращается в копию правой с сохранением собственного ID
          const leftmostId = idx0 <= idx1 ? targetCardIds[0]! : targetCardIds[1]!;
          const rightmostId = idx0 <= idx1 ? targetCardIds[1]! : targetCardIds[0]!;
          const source = workState.deck.find((card) => card.id === rightmostId)!;
          workState = {
            ...workState,
            deck: workState.deck.map((card) =>
              card.id === leftmostId
                ? {
                    ...card,
                    suit: source.suit,
                    rank: source.rank,
                    enhancement: source.enhancement,
                    edition: source.edition,
                    seal: source.seal,
                    bonusChips: source.bonusChips,
                    permaBonus: source.permaBonus,
                    debuffed: source.debuffed,
                  }
                : card,
            ),
          };
          events.push({
            type: 'CONSUMABLE_TRIGGER',
            consumableUid: consumable.uid,
            consumableId: consumable.id,
            targetCardIds: [leftmostId, rightmostId],
            locKey: 'consumable_used',
          });
          break;
        }
        case 'c_fool': {
          const copyId = workState.lastUsedConsumableId!;
          const uid = `cons_${workState.nextCardUid}`;
          const copy = createConsumableInstance(copyId, uid, 'base', workState.discountPercent);
          workState = {
            ...workState,
            consumables: [...workState.consumables, copy],
            nextCardUid: workState.nextCardUid + 1,
          };
          events.push({
            type: 'CONSUMABLE_TRIGGER',
            consumableUid: consumable.uid,
            consumableId: consumable.id,
            locKey: 'consumable_used',
          });
          break;
        }
        case 'c_hermit': {
          const delta = Math.min(20, Math.max(0, workState.dollars));
          const totalDollars = workState.dollars + delta;
          if (delta > 0) {
            workState = { ...workState, dollars: totalDollars };
            events.push({
              type: 'DOLLAR_DELTA',
              delta,
              totalDollars,
              source: 'consumable',
            });
          }
          events.push({
            type: 'CONSUMABLE_TRIGGER',
            consumableUid: consumable.uid,
            consumableId: consumable.id,
            locKey: 'consumable_used',
          });
          break;
        }
        case 'c_temperance': {
          const totalSell = workState.relics.reduce((sum, relic) => sum + relic.sellValue, 0);
          const delta = Math.min(50, Math.max(0, totalSell));
          const totalDollars = workState.dollars + delta;
          if (delta > 0) {
            workState = { ...workState, dollars: totalDollars };
            events.push({
              type: 'DOLLAR_DELTA',
              delta,
              totalDollars,
              source: 'consumable',
            });
          }
          events.push({
            type: 'CONSUMABLE_TRIGGER',
            consumableUid: consumable.uid,
            consumableId: consumable.id,
            locKey: 'consumable_used',
          });
          break;
        }
        case 'c_wheel_of_fortune': {
          const roll = nextFloat(workState.rngState, 'shop');
          let nextRng = roll.nextState;
          if (roll.value < workState.probabilitiesNormal / 4) {
            const eligible = workState.relics.filter((relic) => relic.edition === 'base');
            const targetPick = pickElement(nextRng, 'shop', eligible);
            nextRng = targetPick.nextState;
            const edPick = pollEdition(nextRng, 'shop', workState.editionRate, {
              guaranteed: true,
              allowNegative: false,
            });
            nextRng = edPick.nextState;
            workState = {
              ...workState,
              rngState: nextRng,
              relics: workState.relics.map((relic) =>
                relic.uid === targetPick.value.uid
                  ? applyEditionToRelic(relic, edPick.value, workState.discountPercent)
                  : relic,
              ),
            };
            events.push({
              type: 'CONSUMABLE_TRIGGER',
              consumableUid: consumable.uid,
              consumableId: consumable.id,
              locKey: 'consumable_used',
            });
          } else {
            workState = { ...workState, rngState: nextRng };
            events.push({
              type: 'CONSUMABLE_TRIGGER',
              consumableUid: consumable.uid,
              consumableId: consumable.id,
              locKey: 'consumable_nope',
            });
          }
          break;
        }
        case 'c_judgement': {
          const relicPick = pickPoolRelic(workState, {
            stream: 'shop',
            ...(options.relicRegistry ? { relicRegistry: options.relicRegistry } : {}),
          });
          const edPick = pollEdition(relicPick.nextState, 'shop', workState.editionRate, {
            allowNegative: true,
          });
          const uid = `relic_${workState.nextCardUid}`;
          const newRelic = createRelicInstance(
            relicPick.value,
            uid,
            edPick.value,
            workState.discountPercent,
          );
          workState = {
            ...workState,
            rngState: edPick.nextState,
            relics: [...workState.relics, newRelic],
            nextCardUid: workState.nextCardUid + 1,
          };
          events.push({
            type: 'CONSUMABLE_TRIGGER',
            consumableUid: consumable.uid,
            consumableId: consumable.id,
            locKey: 'consumable_used',
          });
          break;
        }
        case 'c_aura': {
          const edPick = pollEdition(workState.rngState, 'shop', workState.editionRate, {
            guaranteed: true,
            allowNegative: false,
          });
          const targetId = targetCardIds[0]!;
          workState = {
            ...workState,
            rngState: edPick.nextState,
            deck: workState.deck.map((card) =>
              card.id === targetId ? { ...card, edition: edPick.value } : card,
            ),
          };
          events.push({
            type: 'CONSUMABLE_TRIGGER',
            consumableUid: consumable.uid,
            consumableId: consumable.id,
            targetCardIds: [targetId],
            locKey: 'consumable_used',
          });
          break;
        }
        case 'c_cryptid': {
          const source = workState.deck.find((card) => card.id === targetCardIds[0]!)!;
          let uidCounter = workState.nextCardUid;
          const copies: PlayingCard[] = [];
          for (let i = 0; i < 2; i += 1) {
            copies.push({
              ...source,
              id: `card_${uidCounter}`,
              playedThisAnte: false,
              facing: 'front',
              forcedSelection: false,
            });
            uidCounter += 1;
          }
          const copyIds = copies.map((card) => card.id);
          const putInBoosterHand =
            workState.phase === 'booster' &&
            workState.booster !== null &&
            workState.booster.drawnHandCardIds.length > 0;

          workState = {
            ...workState,
            deck: [...workState.deck, ...copies],
            handIds: putInBoosterHand ? workState.handIds : [...workState.handIds, ...copyIds],
            booster:
              putInBoosterHand && workState.booster
                ? {
                    ...workState.booster,
                    drawnHandCardIds: [...workState.booster.drawnHandCardIds, ...copyIds],
                  }
                : workState.booster,
            nextCardUid: uidCounter,
          };
          addedCardsForHook = copies;
          events.push({
            type: 'CONSUMABLE_TRIGGER',
            consumableUid: consumable.uid,
            consumableId: consumable.id,
            targetCardIds: [...targetCardIds],
            locKey: 'consumable_used',
          });
          break;
        }
        case 'c_immolate': {
          const activeHandIds = getAccessibleHandIds(workState) ?? [];
          const shuffled = shuffleArray(workState.rngState, 'shuffle', activeHandIds);
          const destroyedIds = shuffled.value.slice(0, Math.min(5, shuffled.value.length));
          workState = { ...workState, rngState: shuffled.nextState };
          workState = destroyCardsFromState(workState, destroyedIds, 'rune', events);
          const totalDollars = workState.dollars + 20;
          workState = { ...workState, dollars: totalDollars };
          events.push({
            type: 'DOLLAR_DELTA',
            delta: 20,
            totalDollars,
            source: 'consumable',
          });
          events.push({
            type: 'CONSUMABLE_TRIGGER',
            consumableUid: consumable.uid,
            consumableId: consumable.id,
            targetCardIds: destroyedIds,
            locKey: 'consumable_used',
          });
          break;
        }
        case 'c_hex': {
          const eligible = workState.relics.filter((relic) => relic.edition === 'base');
          const picked = pickElement(workState.rngState, 'shop', eligible);
          const chosenUid = picked.value.uid;
          const survivingRelics: RelicInstance[] = [];

          for (const relic of workState.relics) {
            if (relic.uid === chosenUid) {
              survivingRelics.push(
                applyEditionToRelic(relic, 'polychrome', workState.discountPercent),
              );
            } else if (relic.state.extra?.['eternal'] === true) {
              survivingRelics.push(relic);
            } else {
              events.push({
                type: 'RELIC_DESTROYED',
                relicUid: relic.uid,
                relicId: relic.id,
                reason: 'hex',
              });
            }
          }

          workState = {
            ...workState,
            rngState: picked.nextState,
            relics: survivingRelics,
          };
          events.push({
            type: 'CONSUMABLE_TRIGGER',
            consumableUid: consumable.uid,
            consumableId: consumable.id,
            locKey: 'consumable_used',
          });
          break;
        }
        case 'c_black_hole': {
          for (const handType of HAND_TYPES) {
            const leveled = applyHandLevelUp(workState, handType, 1);
            workState = leveled.nextState;
            events.push({
              type: 'HAND_LEVEL_UP',
              handType,
              newLevel: leveled.newLevel,
              chips: leveled.chips,
              mult: leveled.mult,
            });
          }
          events.push({
            type: 'CONSUMABLE_TRIGGER',
            consumableUid: consumable.uid,
            consumableId: consumable.id,
            locKey: 'consumable_all_hands_up',
            locParams: { levels: 1 },
          });
          break;
        }
        default:
          return { nextState: state, events: [] };
      }
    }
  }

  // Только Сферы и Свитки запоминаются для Свитка Эха (c_fool), Руны не перезаписывают память
  if (consumable.kind === 'celestial' || consumable.kind === 'scroll') {
    workState = {
      ...workState,
      lastUsedConsumableId: consumable.id as CelestialId | ScrollId,
    };
  }

  // После c_cryptid вызываем onCardAdded для масштабирования j_hologram
  if (addedCardsForHook.length > 0) {
    const added = addedCardsForHook;
    workState = invokeConsumableRelicHooks(workState, options, events, (resolved, slotIndex, cur) => ({
      hook: 'onCardAdded',
      state: cur,
      effectRelic: resolved.effectRelic,
      stateRelic: resolved.stateRelic,
      relicIndex: slotIndex,
      isBlueprintCopy: resolved.isBlueprintCopy,
      addedCards: added,
    }));
  }

  // Уведомляем Реликвии о применении расходника (например, j_constellation)
  workState = invokeConsumableRelicHooks(workState, options, events, (resolved, slotIndex, cur) => ({
    hook: 'onUseConsumable',
    state: cur,
    effectRelic: resolved.effectRelic,
    stateRelic: resolved.stateRelic,
    relicIndex: slotIndex,
    isBlueprintCopy: resolved.isBlueprintCopy,
    consumable,
  }));

  return {
    nextState: workState,
    events,
  };
}
