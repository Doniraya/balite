import { getCardEffectiveRank, isCardFace, isCardSuit } from './cards';
import type {
  Edition,
  HandType,
  RelicDefinition,
  RelicEffectResult,
  RelicHookContextBase,
  RelicHookContextFor,
  RelicHookHandler,
  RelicHookMap,
  RelicId,
  RelicInstance,
  RelicRarity,
  RelicRegistryLookup,
  RelicStateCounters,
  Suit,
} from './types';

/**
 * Надбавка к базовой стоимости покупки Реликвии в зависимости от её Издания.
 */
const EDITION_EXTRA_COST: Readonly<Record<Edition, number>> = {
  base: 0,
  foil: 2,
  holo: 3,
  polychrome: 5,
  negative: 5,
};

/**
 * Базовые нулевые счётчики состояния для Реликвий без индивидуального накопления.
 */
const BASE_INITIAL_STATE: RelicStateCounters = {
  chips: 0,
  mult: 0,
  xMult: 1,
};

/**
 * Результат разрешения цепочки копирования Реликвии с разделением источника эффекта и владельца слота.
 */
export interface ResolvedRelicTarget {
  readonly effectRelic: RelicInstance;
  readonly stateRelic: RelicInstance;
  readonly isBlueprintCopy: boolean;
}

/**
 * Параметры описания Реликвии при регистрации в каталоге движка.
 */
interface DefineRelicParams {
  readonly id: RelicId;
  readonly rarity: RelicRarity;
  readonly baseCost: number;
  readonly blueprintCompat?: boolean;
  readonly perishableCompat?: boolean;
  readonly eternalCompat?: boolean;
  readonly initialState?: RelicStateCounters;
  readonly hooks?: RelicHookMap;
}

/**
 * Собирает полное неизменяемое определение Реликвии со значениями совместимости по умолчанию.
 */
function defineRelic(params: DefineRelicParams): RelicDefinition {
  return {
    id: params.id,
    rarity: params.rarity,
    baseCost: params.baseCost,
    blueprintCompat: params.blueprintCompat ?? true,
    perishableCompat: params.perishableCompat ?? true,
    eternalCompat: params.eternalCompat ?? true,
    initialState: params.initialState ?? BASE_INITIAL_STATE,
    hooks: params.hooks ?? {},
  };
}

/**
 * Создаёт независимую копию счётчиков состояния Реликвии для нового экземпляра.
 */
function cloneRelicState(state: RelicStateCounters): RelicStateCounters {
  return state.extra
    ? {
        chips: state.chips,
        mult: state.mult,
        xMult: state.xMult,
        extra: { ...state.extra },
      }
    : {
        chips: state.chips,
        mult: state.mult,
        xMult: state.xMult,
      };
}

/**
 * Округляет накопительные множители до сотых для исключения погрешностей двоичной арифметики JS.
 */
function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Проверяет, подавлена ли активная Реликвия или владелец текущего слота.
 */
function isRelicDisabled(ctx: RelicHookContextBase): boolean {
  return ctx.effectRelic.debuffed || ctx.stateRelic.debuffed;
}

/**
 * Формирует стандартный результат добавления Силы от Реликвии.
 */
function chipsResult(chips: number): RelicEffectResult {
  return {
    chipsDelta: chips,
    locKey: 'relic_chips',
    locParams: { chips },
  };
}

/**
 * Формирует стандартный результат добавления Множителя от Реликвии.
 */
function multResult(mult: number): RelicEffectResult {
  return {
    multDelta: mult,
    locKey: 'relic_mult',
    locParams: { mult },
  };
}

/**
 * Формирует стандартный результат мультипликативного Множителя от Реликвии.
 */
function xMultResult(xMult: number): RelicEffectResult {
  return {
    xMult,
    locKey: 'relic_x_mult',
    locParams: { xMult },
  };
}

/**
 * Создаёт обработчик onScoreCard для мастных Реликвий (учитывает Хамелеон и игнорирует Камень/подавление).
 */
function createSuitMultHook(suit: Suit, mult: number): RelicHookHandler<'onScoreCard'> {
  return (ctx) => {
    if (isRelicDisabled(ctx) || ctx.card.debuffed) return null;
    if (!isCardSuit(ctx.card, suit, false, false)) return null;
    return multResult(mult);
  };
}

/**
 * Создаёт обработчик onScoreRelic, срабатывающий при наличии указанного расклада в матрице вложенности.
 */
function createHandContainmentHook(
  handType: HandType,
  bonus: { readonly chips?: number; readonly mult?: number; readonly xMult?: number },
): RelicHookHandler<'onScoreRelic'> {
  return (ctx) => {
    if (isRelicDisabled(ctx)) return null;
    if (!ctx.handEvaluation.containedHands[handType]) return null;
    if (bonus.chips !== undefined) return chipsResult(bonus.chips);
    if (bonus.mult !== undefined) return multResult(bonus.mult);
    if (bonus.xMult !== undefined) return xMultResult(bonus.xMult);
    return null;
  };
}

/**
 * Общий обработчик onScoreRelic для Реликвий с накопительным счётчиком +Множ (state.mult > 0).
 */
function scoreAccumulatedMult(ctx: RelicHookContextFor<'onScoreRelic'>): RelicEffectResult | null {
  if (isRelicDisabled(ctx)) return null;
  const { mult } = ctx.effectRelic.state;
  return mult > 0 ? multResult(mult) : null;
}

/**
 * Общий обработчик onScoreRelic для Реликвий с накопительным счётчиком ×Множ (state.xMult > 1).
 */
function scoreAccumulatedXMult(ctx: RelicHookContextFor<'onScoreRelic'>): RelicEffectResult | null {
  if (isRelicDisabled(ctx)) return null;
  const { xMult } = ctx.effectRelic.state;
  return xMult > 1 ? xMultResult(xMult) : null;
}

/**
 * Определяет, является ли текущая карта первой неподавленной картинкой среди scoringCards.
 */
function isFirstScoringFace(ctx: RelicHookContextFor<'onScoreCard'>): boolean {
  if (ctx.card.debuffed || !isCardFace(ctx.card)) return false;
  if (ctx.isFirstScoringFaceCard !== undefined) {
    return ctx.isFirstScoringFaceCard;
  }
  const firstFace = ctx.scoringCards.find((candidate) => isCardFace(candidate));
  return firstFace?.id === ctx.card.id;
}

/**
 * Полный канонический список определений всех 40 Реликвий Balite v1.0 (порядок соответствует RELIC_IDS).
 */
export const RELIC_DEFINITIONS: readonly RelicDefinition[] = [
  // Обычные Реликвии (R1, 18 шт.)
  defineRelic({
    id: 'j_joker',
    rarity: 1,
    baseCost: 2,
    hooks: {
      onScoreRelic: (ctx) => (isRelicDisabled(ctx) ? null : multResult(4)),
    },
  }),
  defineRelic({
    id: 'j_greedy_joker',
    rarity: 1,
    baseCost: 5,
    hooks: {
      onScoreCard: createSuitMultHook('diamonds', 3),
    },
  }),
  defineRelic({
    id: 'j_lusty_joker',
    rarity: 1,
    baseCost: 5,
    hooks: {
      onScoreCard: createSuitMultHook('hearts', 3),
    },
  }),
  defineRelic({
    id: 'j_wrathful_joker',
    rarity: 1,
    baseCost: 5,
    hooks: {
      onScoreCard: createSuitMultHook('spades', 3),
    },
  }),
  defineRelic({
    id: 'j_gluttenous_joker',
    rarity: 1,
    baseCost: 5,
    hooks: {
      onScoreCard: createSuitMultHook('clubs', 3),
    },
  }),
  defineRelic({
    id: 'j_jolly',
    rarity: 1,
    baseCost: 3,
    hooks: {
      onScoreRelic: createHandContainmentHook('Pair', { mult: 8 }),
    },
  }),
  defineRelic({
    id: 'j_sly',
    rarity: 1,
    baseCost: 3,
    hooks: {
      onScoreRelic: createHandContainmentHook('Pair', { chips: 50 }),
    },
  }),
  defineRelic({
    id: 'j_half',
    rarity: 1,
    baseCost: 5,
    hooks: {
      onScoreRelic: (ctx) => {
        if (isRelicDisabled(ctx)) return null;
        return ctx.playedCards.length <= 3 ? multResult(20) : null;
      },
    },
  }),
  defineRelic({
    id: 'j_abstract',
    rarity: 1,
    baseCost: 4,
    hooks: {
      onScoreRelic: (ctx) => {
        if (isRelicDisabled(ctx)) return null;
        const count = ctx.state.relics.length;
        return count > 0 ? multResult(3 * count) : null;
      },
    },
  }),
  defineRelic({
    id: 'j_banner',
    rarity: 1,
    baseCost: 5,
    hooks: {
      onScoreRelic: (ctx) => {
        if (isRelicDisabled(ctx)) return null;
        return ctx.state.discardsLeft > 0 ? chipsResult(30 * ctx.state.discardsLeft) : null;
      },
    },
  }),
  defineRelic({
    id: 'j_mystic_summit',
    rarity: 1,
    baseCost: 5,
    hooks: {
      onScoreRelic: (ctx) => {
        if (isRelicDisabled(ctx)) return null;
        return ctx.state.discardsLeft === 0 ? multResult(15) : null;
      },
    },
  }),
  defineRelic({
    id: 'j_scary_face',
    rarity: 1,
    baseCost: 4,
    hooks: {
      onScoreCard: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.card.debuffed) return null;
        return isCardFace(ctx.card) ? chipsResult(30) : null;
      },
    },
  }),
  defineRelic({
    id: 'j_even_steven',
    rarity: 1,
    baseCost: 4,
    hooks: {
      onScoreCard: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.card.debuffed) return null;
        const rank = getCardEffectiveRank(ctx.card);
        return rank !== null && rank <= 10 && rank % 2 === 0 ? multResult(4) : null;
      },
    },
  }),
  defineRelic({
    id: 'j_odd_todd',
    rarity: 1,
    baseCost: 4,
    hooks: {
      onScoreCard: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.card.debuffed) return null;
        const rank = getCardEffectiveRank(ctx.card);
        return rank !== null && (rank === 14 || (rank < 10 && rank % 2 === 1))
          ? chipsResult(31)
          : null;
      },
    },
  }),
  defineRelic({
    id: 'j_runner',
    rarity: 1,
    baseCost: 5,
    perishableCompat: false,
    hooks: {
      onBeforeScore: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.isBlueprintCopy) return null;
        if (!ctx.handEvaluation.containedHands['Straight']) return null;
        return {
          updatedEffectState: {
            ...ctx.effectRelic.state,
            chips: ctx.effectRelic.state.chips + 15,
          },
          locKey: 'relic_upgrade',
        };
      },
      onScoreRelic: (ctx) => {
        if (isRelicDisabled(ctx)) return null;
        const { chips } = ctx.effectRelic.state;
        return chips > 0 ? chipsResult(chips) : null;
      },
    },
  }),
  defineRelic({
    id: 'j_green_joker',
    rarity: 1,
    baseCost: 4,
    perishableCompat: false,
    hooks: {
      onBeforeScore: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.isBlueprintCopy) return null;
        return {
          updatedEffectState: {
            ...ctx.effectRelic.state,
            mult: ctx.effectRelic.state.mult + 1,
          },
          locKey: 'relic_upgrade',
        };
      },
      onDiscard: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.isBlueprintCopy) return null;
        // Списание -1 Множ происходит ровно 1 раз за действие сброса на последней карте
        if (ctx.isLastDiscardedCard !== true) return null;
        if (ctx.effectRelic.state.mult <= 0) return null;
        return {
          updatedEffectState: {
            ...ctx.effectRelic.state,
            mult: Math.max(0, ctx.effectRelic.state.mult - 1),
          },
        };
      },
      onScoreRelic: scoreAccumulatedMult,
    },
  }),
  defineRelic({
    id: 'j_photograph',
    rarity: 1,
    baseCost: 5,
    hooks: {
      onScoreCard: (ctx) => {
        if (isRelicDisabled(ctx)) return null;
        return isFirstScoringFace(ctx) ? xMultResult(2) : null;
      },
    },
  }),
  defineRelic({
    id: 'j_golden',
    rarity: 1,
    baseCost: 6,
    blueprintCompat: false,
    hooks: {
      onRoundEnd: (ctx) => {
        if (isRelicDisabled(ctx) || !ctx.won) return null;
        return {
          dollarsDelta: 4,
          locKey: 'relic_dollars',
          locParams: { dollars: 4 },
        };
      },
    },
  }),

  // Необычные Реликвии (R2, 16 шт.)
  defineRelic({
    id: 'j_flash',
    rarity: 2,
    baseCost: 5,
    perishableCompat: false,
    hooks: {
      onShopReroll: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.isBlueprintCopy) return null;
        return {
          updatedEffectState: {
            ...ctx.effectRelic.state,
            mult: ctx.effectRelic.state.mult + 2,
          },
          locKey: 'relic_upgrade',
        };
      },
      onScoreRelic: scoreAccumulatedMult,
    },
  }),
  defineRelic({
    id: 'j_trousers',
    rarity: 2,
    baseCost: 6,
    perishableCompat: false,
    hooks: {
      onBeforeScore: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.isBlueprintCopy) return null;
        const { containedHands } = ctx.handEvaluation;
        if (!containedHands['Two Pair'] && !containedHands['Full House']) return null;
        return {
          updatedEffectState: {
            ...ctx.effectRelic.state,
            mult: ctx.effectRelic.state.mult + 2,
          },
          locKey: 'relic_upgrade',
        };
      },
      onScoreRelic: scoreAccumulatedMult,
    },
  }),
  defineRelic({
    id: 'j_ceremonial',
    rarity: 2,
    baseCost: 6,
    perishableCompat: false,
    hooks: {
      onBlindSelect: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.isBlueprintCopy) return null;
        const target = ctx.state.relics[ctx.relicIndex + 1];
        if (!target || target.state.extra?.['eternal'] === true) return null;
        return {
          destroyRightRelic: true,
          destroyedRelicUid: target.uid,
          updatedEffectState: {
            ...ctx.effectRelic.state,
            mult: ctx.effectRelic.state.mult + target.sellValue * 2,
          },
          locKey: 'relic_upgrade',
        };
      },
      onScoreRelic: scoreAccumulatedMult,
    },
  }),
  defineRelic({
    id: 'j_blackboard',
    rarity: 2,
    baseCost: 6,
    hooks: {
      onScoreRelic: (ctx) => {
        if (isRelicDisabled(ctx)) return null;
        // При flushCalc=true: пустая рука даёт true, подавленные Пики/Трефы считаются, а подавленный Wild и Stone -> false
        const allBlack = ctx.handCards.every(
          (card) => isCardSuit(card, 'clubs', false, true) || isCardSuit(card, 'spades', false, true),
        );
        return allBlack ? xMultResult(3) : null;
      },
    },
  }),
  defineRelic({
    id: 'j_card_sharp',
    rarity: 2,
    baseCost: 6,
    hooks: {
      onScoreRelic: (ctx) => {
        if (isRelicDisabled(ctx)) return null;
        const playedThisRound = ctx.state.handsPlayedThisRound[ctx.handEvaluation.handType] ?? 0;
        return playedThisRound > 1 ? xMultResult(3) : null;
      },
    },
  }),
  defineRelic({
    id: 'j_acrobat',
    rarity: 2,
    baseCost: 6,
    hooks: {
      onScoreRelic: (ctx) => {
        if (isRelicDisabled(ctx)) return null;
        return ctx.state.handsLeft === 0 ? xMultResult(3) : null;
      },
    },
  }),
  defineRelic({
    id: 'j_constellation',
    rarity: 2,
    baseCost: 6,
    perishableCompat: false,
    hooks: {
      onUseConsumable: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.isBlueprintCopy) return null;
        if (ctx.consumable.kind !== 'celestial') return null;
        return {
          updatedEffectState: {
            ...ctx.effectRelic.state,
            xMult: roundToHundredths(ctx.effectRelic.state.xMult + 0.1),
          },
          locKey: 'relic_upgrade',
        };
      },
      onScoreRelic: scoreAccumulatedXMult,
    },
  }),
  defineRelic({
    id: 'j_hologram',
    rarity: 2,
    baseCost: 7,
    perishableCompat: false,
    hooks: {
      onCardAdded: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.isBlueprintCopy) return null;
        if (ctx.addedCards.length === 0) return null;
        return {
          updatedEffectState: {
            ...ctx.effectRelic.state,
            xMult: roundToHundredths(ctx.effectRelic.state.xMult + 0.25 * ctx.addedCards.length),
          },
          locKey: 'relic_upgrade',
        };
      },
      onScoreRelic: scoreAccumulatedXMult,
    },
  }),
  defineRelic({
    id: 'j_vampire',
    rarity: 2,
    baseCost: 7,
    perishableCompat: false,
    hooks: {
      onBeforeScore: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.isBlueprintCopy) return null;
        const strippedCardIds: string[] = [];
        for (const card of ctx.scoringCards) {
          if (!card.debuffed && card.enhancement !== 'none') {
            strippedCardIds.push(card.id);
          }
        }
        if (strippedCardIds.length === 0) return null;
        return {
          stripCardEnhancement: true,
          strippedCardIds,
          updatedEffectState: {
            ...ctx.effectRelic.state,
            xMult: roundToHundredths(ctx.effectRelic.state.xMult + 0.1 * strippedCardIds.length),
          },
          locKey: 'relic_upgrade',
        };
      },
      onScoreRelic: scoreAccumulatedXMult,
    },
  }),
  defineRelic({
    id: 'j_ramen',
    rarity: 2,
    baseCost: 6,
    eternalCompat: false,
    initialState: { chips: 0, mult: 0, xMult: 2 },
    hooks: {
      onDiscard: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.isBlueprintCopy) return null;
        // Поддержка как покарточного вызова конвейером, так и пакетного вызова на массив карт
        const isPerCardCall =
          ctx.card !== undefined ||
          ctx.cardIndex !== undefined ||
          ctx.isLastDiscardedCard !== undefined;
        const discardCount = isPerCardCall ? 1 : ctx.discardedCards.length;
        if (discardCount <= 0) return null;

        const nextXMult = roundToHundredths(ctx.effectRelic.state.xMult - 0.01 * discardCount);
        if (nextXMult <= 1) {
          return {
            destroySelf: true,
            destroyedRelicUid: ctx.effectRelic.uid,
            updatedEffectState: {
              ...ctx.effectRelic.state,
              xMult: 1,
            },
            locKey: 'relic_destroyed_ramen',
          };
        }

        return {
          updatedEffectState: {
            ...ctx.effectRelic.state,
            xMult: nextXMult,
          },
        };
      },
      onScoreRelic: scoreAccumulatedXMult,
    },
  }),
  defineRelic({
    id: 'j_stencil',
    rarity: 2,
    baseCost: 8,
    hooks: {
      onScoreRelic: (ctx) => {
        if (isRelicDisabled(ctx)) return null;
        let negativeCount = 0;
        let stencilCount = 0;
        for (const relic of ctx.state.relics) {
          if (relic.edition === 'negative') negativeCount += 1;
          if (relic.id === 'j_stencil') stencilCount += 1;
        }
        const relicSlotLimit = ctx.state.maxRelics + negativeCount;
        const emptySlots = Math.max(0, relicSlotLimit - ctx.state.relics.length);
        // Канонический порог оригинала: без реально свободных слотов (emptySlots <= 0) слепок не срабатывает
        if (emptySlots <= 0) return null;
        const xMult = emptySlots + stencilCount;
        return xMult > 1 ? xMultResult(xMult) : null;
      },
    },
  }),
  defineRelic({
    id: 'j_sock_and_buskin',
    rarity: 2,
    baseCost: 6,
    hooks: {
      onScoreCardRepetition: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.card.debuffed) return null;
        return isCardFace(ctx.card) ? { retriggerDelta: 1 } : null;
      },
    },
  }),
  defineRelic({
    id: 'j_mime',
    rarity: 2,
    baseCost: 5,
    hooks: {
      onHoldCardRepetition: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.card.debuffed) return null;
        if (ctx.phase !== 'scoring' && ctx.phase !== 'roundEnd') return null;
        return { retriggerDelta: 1 };
      },
    },
  }),
  defineRelic({
    id: 'j_four_fingers',
    rarity: 2,
    baseCost: 7,
    blueprintCompat: false,
  }),
  defineRelic({
    id: 'j_shortcut',
    rarity: 2,
    baseCost: 7,
    blueprintCompat: false,
  }),
  defineRelic({
    id: 'j_bull',
    rarity: 2,
    baseCost: 6,
    hooks: {
      onScoreRelic: (ctx) => {
        if (isRelicDisabled(ctx)) return null;
        return ctx.state.dollars > 0 ? chipsResult(2 * ctx.state.dollars) : null;
      },
    },
  }),

  // Редкие Реликвии (R3, 6 шт.)
  defineRelic({
    id: 'j_duo',
    rarity: 3,
    baseCost: 8,
    hooks: {
      onScoreRelic: createHandContainmentHook('Pair', { xMult: 2 }),
    },
  }),
  defineRelic({
    id: 'j_tribe',
    rarity: 3,
    baseCost: 8,
    hooks: {
      onScoreRelic: createHandContainmentHook('Flush', { xMult: 2 }),
    },
  }),
  defineRelic({
    id: 'j_baron',
    rarity: 3,
    baseCost: 8,
    hooks: {
      onHoldCard: (ctx) => {
        if (isRelicDisabled(ctx) || ctx.card.debuffed) return null;
        return getCardEffectiveRank(ctx.card) === 13 ? xMultResult(1.5) : null;
      },
    },
  }),
  defineRelic({
    id: 'j_blueprint',
    rarity: 3,
    baseCost: 10,
  }),
  defineRelic({
    id: 'j_brainstorm',
    rarity: 3,
    baseCost: 10,
  }),
  defineRelic({
    id: 'j_vagabond',
    rarity: 3,
    baseCost: 8,
    hooks: {
      onScoreRelic: (ctx) => {
        if (isRelicDisabled(ctx)) return null;
        if (ctx.state.dollars > 4) return null;
        const negativeConsumables = ctx.state.consumables.filter(
          (item) => item.edition === 'negative',
        ).length;
        const maxConsumableSlots = ctx.state.maxConsumables + negativeConsumables;
        if (ctx.state.consumables.length >= maxConsumableSlots) return null;
        return {
          createConsumableKind: 'scroll',
          locKey: 'relic_scroll_created',
        };
      },
    },
  }),
];

/**
 * Словарь определений всех 40 Реликвий для быстрого поиска по идентификатору.
 */
export const RELIC_REGISTRY: Readonly<Record<RelicId, RelicDefinition>> = Object.fromEntries(
  RELIC_DEFINITIONS.map((def) => [def.id, def]),
) as Record<RelicId, RelicDefinition>;

/**
 * Возвращает каноническое описание Реликвии по её идентификатору (совместимо с RelicRegistryLookup).
 */
export function getRelicDefinition(id: RelicId): RelicDefinition {
  const definition = RELIC_REGISTRY[id];
  if (!definition) {
    throw new RangeError(`UNKNOWN_RELIC_ID: ${String(id)}`);
  }
  return definition;
}

/**
 * Вычисляет цену покупки Реликвии с учётом Издания и процентной скидки магазина (минимум 1 з.).
 */
export function calculateRelicBuyCost(
  baseCost: number,
  edition: Edition = 'base',
  discountPercent = 0,
): number {
  const clampedDiscount = Math.min(100, Math.max(0, discountPercent));
  const editionExtra = EDITION_EXTRA_COST[edition];
  return Math.max(
    1,
    Math.floor(((baseCost + editionExtra + 0.5) * (100 - clampedDiscount)) / 100),
  );
}

/**
 * Вычисляет цену продажи Реликвии с учётом цены покупки (минимум 1 з.) и накопленной добавки extraValue.
 */
export function calculateRelicSellValue(buyCost: number, extraValue = 0): number {
  return Math.max(1, Math.floor(buyCost / 2)) + extraValue;
}

/**
 * Создаёт новый неизменяемый экземпляр Реликвии с независимым состоянием счётчиков.
 */
export function createRelicInstance(
  id: RelicId,
  uid: string,
  edition: Edition = 'base',
  discountPercent = 0,
): RelicInstance {
  const definition = getRelicDefinition(id);
  const buyCost = calculateRelicBuyCost(definition.baseCost, edition, discountPercent);

  return {
    uid,
    id,
    edition,
    baseCost: definition.baseCost,
    sellValue: calculateRelicSellValue(buyCost, 0),
    extraValue: 0,
    debuffed: false,
    state: cloneRelicState(definition.initialState),
  };
}

/**
 * Разрешает цель исполнения для слота панели Реликвий с поддержкой цепочек j_blueprint -> j_brainstorm и защитой от циклов.
 */
export function resolveRelicTarget(
  relics: readonly RelicInstance[],
  slotIndex: number,
  lookup: RelicRegistryLookup = getRelicDefinition,
): ResolvedRelicTarget | null {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= relics.length) {
    return null;
  }

  const stateRelic = relics[slotIndex];
  if (!stateRelic || stateRelic.debuffed) {
    return null;
  }

  const visited = new Set<number>();
  let currentIndex = slotIndex;
  let currentRelic = stateRelic;
  let isBlueprintCopy = false;

  while (currentRelic.id === 'j_blueprint' || currentRelic.id === 'j_brainstorm') {
    if (visited.has(currentIndex)) {
      return null;
    }
    visited.add(currentIndex);

    const nextIndex = currentRelic.id === 'j_blueprint' ? currentIndex + 1 : 0;
    if (nextIndex < 0 || nextIndex >= relics.length || visited.has(nextIndex)) {
      return null;
    }

    const nextRelic = relics[nextIndex];
    if (!nextRelic || nextRelic.debuffed) {
      return null;
    }

    const nextDefinition = lookup(nextRelic.id);
    if (!nextDefinition || !nextDefinition.blueprintCompat) {
      return null;
    }

    isBlueprintCopy = true;
    currentIndex = nextIndex;
    currentRelic = nextRelic;
  }

  return {
    effectRelic: currentRelic,
    stateRelic,
    isBlueprintCopy,
  };
}
