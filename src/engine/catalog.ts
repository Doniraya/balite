import { isCardSuit } from './cards';
import { getBlindAmount } from './handEval';
import { pickElement, type RngState } from './prng';
import { calculateRelicBuyCost, calculateRelicSellValue } from './relics';
import {
  BOSS_IDS,
  CHARTER_IDS,
  TAG_IDS,
  type BlindSlotState,
  type BossId,
  type CharterId,
  type DeckId,
  type DispatchResult,
  type PlayingCard,
  type RunState,
  type ShopOffer,
  type ShopState,
  type TagId,
  type TraceEvent,
} from './types';

/**
 * Описание модификаторов стартовой колоды забега.
 */
export interface DeckDefinition {
  readonly id: DeckId;
  readonly discardsDelta: number;
  readonly handsDelta: number;
  readonly dollarsDelta: number;
  readonly relicSlotsDelta: number;
  readonly consumableSlotsDelta: number;
  readonly handSizeDelta: number;
}

/**
 * Базовые стартовые параметры забега после выбора колоды.
 */
export interface DeckStartingParams {
  readonly deckId: DeckId;
  readonly dollars: number;
  readonly handSize: number;
  readonly maxHands: number;
  readonly handsLeft: number;
  readonly maxDiscards: number;
  readonly discardsLeft: number;
  readonly maxRelics: number;
  readonly maxConsumables: number;
  readonly baseRerollCost: number;
  readonly interestCap: number;
  readonly shopSlots: number;
  readonly discountPercent: number;
  readonly editionRate: number;
}

/**
 * Конфигурация Босса Этапа (допустимый Этап, Showdown-статус, множитель цели и награда).
 */
export interface BossDefinition {
  readonly id: BossId;
  readonly minAnte: number;
  readonly showdown: boolean;
  readonly targetMultiplier: number;
  readonly reward: number;
}

/**
 * Описание Гильдейской грамоты и её обязательных пререквизитов.
 */
export interface CharterDefinition {
  readonly id: CharterId;
  readonly baseCost: number;
  readonly requires: readonly CharterId[];
}

/**
 * Описание Знака пропуска Стража.
 */
export interface TagDefinition {
  readonly id: TagId;
  readonly minAnte: number;
  readonly immediate: boolean;
}

/**
 * Результат выбора Босса на новый Этап с обновлённым PRNG и счётчиком появлений.
 */
export interface SelectBossResult {
  readonly bossId: BossId;
  readonly nextRngState: RngState;
  readonly nextBossUseCounts: Readonly<Partial<Record<BossId, number>>>;
}

/**
 * Результат генерации трёх Стражей нового Этапа.
 */
export interface BuildAnteBlindsResult {
  readonly anteBlinds: readonly [BlindSlotState, BlindSlotState, BlindSlotState];
  readonly nextRngState: RngState;
}

/**
 * Результат случайного ролла Знака пропуска.
 */
export interface RollSkipTagResult {
  readonly tagId: TagId;
  readonly nextRngState: RngState;
}

/**
 * Результат выдачи Знака пропуска с учётом отложенного tag_double и триггера tag_charm.
 */
export interface GrantSkipTagResult {
  readonly nextState: RunState;
  readonly events: readonly TraceEvent[];
  readonly openFreeArcanaMegaPackCount: number;
  readonly shouldOpenArcanaMegaPack: boolean;
}

/**
 * Справочник 4 стартовых колод версии Balite v1.0.
 */
export const DECK_DEFINITIONS: Readonly<Record<DeckId, DeckDefinition>> = {
  b_red: {
    id: 'b_red',
    discardsDelta: 1,
    handsDelta: 0,
    dollarsDelta: 0,
    relicSlotsDelta: 0,
    consumableSlotsDelta: 0,
    handSizeDelta: 0,
  },
  b_blue: {
    id: 'b_blue',
    discardsDelta: 0,
    handsDelta: 1,
    dollarsDelta: 0,
    relicSlotsDelta: 0,
    consumableSlotsDelta: 0,
    handSizeDelta: 0,
  },
  b_yellow: {
    id: 'b_yellow',
    discardsDelta: 0,
    handsDelta: 0,
    dollarsDelta: 10,
    relicSlotsDelta: 0,
    consumableSlotsDelta: 0,
    handSizeDelta: 0,
  },
  b_black: {
    id: 'b_black',
    discardsDelta: 0,
    handsDelta: -1,
    dollarsDelta: 0,
    relicSlotsDelta: 1,
    consumableSlotsDelta: 0,
    handSizeDelta: 0,
  },
};

/**
 * Справочник 10 Боссов (8 обычных и 2 финальных Showdown для Этапов, кратных 8).
 */
export const BOSS_DEFINITIONS: Readonly<Record<BossId, BossDefinition>> = {
  bl_hook: { id: 'bl_hook', minAnte: 1, showdown: false, targetMultiplier: 2, reward: 5 },
  bl_manacle: { id: 'bl_manacle', minAnte: 1, showdown: false, targetMultiplier: 2, reward: 5 },
  bl_psychic: { id: 'bl_psychic', minAnte: 1, showdown: false, targetMultiplier: 2, reward: 5 },
  bl_pillar: { id: 'bl_pillar', minAnte: 1, showdown: false, targetMultiplier: 2, reward: 5 },
  bl_club: { id: 'bl_club', minAnte: 1, showdown: false, targetMultiplier: 2, reward: 5 },
  bl_water: { id: 'bl_water', minAnte: 2, showdown: false, targetMultiplier: 2, reward: 5 },
  bl_wall: { id: 'bl_wall', minAnte: 2, showdown: false, targetMultiplier: 4, reward: 5 },
  bl_flint: { id: 'bl_flint', minAnte: 2, showdown: false, targetMultiplier: 2, reward: 5 },
  bl_final_vessel: {
    id: 'bl_final_vessel',
    minAnte: 8,
    showdown: true,
    targetMultiplier: 6,
    reward: 8,
  },
  bl_final_bell: {
    id: 'bl_final_bell',
    minAnte: 8,
    showdown: true,
    targetMultiplier: 2,
    reward: 8,
  },
};

/**
 * Справочник 12 Гильдейских грамот (все по базовой цене 10 з.).
 */
export const CHARTER_DEFINITIONS: Readonly<Record<CharterId, CharterDefinition>> = {
  v_overstock_norm: { id: 'v_overstock_norm', baseCost: 10, requires: [] },
  v_clearance_sale: { id: 'v_clearance_sale', baseCost: 10, requires: [] },
  v_hone: { id: 'v_hone', baseCost: 10, requires: [] },
  v_reroll_surplus: { id: 'v_reroll_surplus', baseCost: 10, requires: [] },
  v_crystal_ball: { id: 'v_crystal_ball', baseCost: 10, requires: [] },
  v_grabber: { id: 'v_grabber', baseCost: 10, requires: [] },
  v_wasteful: { id: 'v_wasteful', baseCost: 10, requires: [] },
  v_seed_money: { id: 'v_seed_money', baseCost: 10, requires: [] },
  v_paint_brush: { id: 'v_paint_brush', baseCost: 10, requires: [] },
  v_telescope: { id: 'v_telescope', baseCost: 10, requires: [] },
  v_observatory: { id: 'v_observatory', baseCost: 10, requires: ['v_telescope'] },
  v_directors_cut: { id: 'v_directors_cut', baseCost: 10, requires: [] },
};

/**
 * Справочник 10 Знаков пропуска Стражей (в Balite v1.0 все доступны с Этапа 1).
 */
export const TAG_DEFINITIONS: Readonly<Record<TagId, TagDefinition>> = {
  tag_uncommon: { id: 'tag_uncommon', minAnte: 1, immediate: false },
  tag_rare: { id: 'tag_rare', minAnte: 1, immediate: false },
  tag_investment: { id: 'tag_investment', minAnte: 1, immediate: false },
  tag_economy: { id: 'tag_economy', minAnte: 1, immediate: true },
  tag_coupon: { id: 'tag_coupon', minAnte: 1, immediate: false },
  tag_d_six: { id: 'tag_d_six', minAnte: 1, immediate: false },
  tag_double: { id: 'tag_double', minAnte: 1, immediate: false },
  tag_juggle: { id: 'tag_juggle', minAnte: 1, immediate: false },
  tag_charm: { id: 'tag_charm', minAnte: 1, immediate: true },
  tag_skip: { id: 'tag_skip', minAnte: 1, immediate: true },
};

/**
 * Вычисляет стартовые числовые параметры нового забега для выбранной колоды.
 */
export function applyDeckStartingParams(deckId: DeckId): DeckStartingParams {
  const def = DECK_DEFINITIONS[deckId];
  const maxHands = Math.max(1, 4 + def.handsDelta);
  const maxDiscards = Math.max(0, 3 + def.discardsDelta);

  return {
    deckId,
    dollars: 4 + def.dollarsDelta,
    handSize: 8 + def.handSizeDelta,
    maxHands,
    handsLeft: maxHands,
    maxDiscards,
    discardsLeft: maxDiscards,
    maxRelics: 5 + def.relicSlotsDelta,
    maxConsumables: 2 + def.consumableSlotsDelta,
    baseRerollCost: 5,
    interestCap: 25,
    shopSlots: 2,
    discountPercent: 0,
    editionRate: 1,
  };
}

/**
 * Выбирает Босса для указанного Этапа по правилу минимальной частоты повторов (Showdown на Этапах 8, 16, ...).
 */
export function selectBossForAnte(
  ante: number,
  bossUseCounts: Readonly<Partial<Record<BossId, number>>>,
  rngState: RngState,
): SelectBossResult {
  const isShowdownAnte = ante >= 2 && ante % 8 === 0;
  const effectiveAnte = Math.max(1, ante);

  const eligible = BOSS_IDS.map((id) => BOSS_DEFINITIONS[id]).filter((def) =>
    isShowdownAnte ? def.showdown : !def.showdown && def.minAnte <= effectiveAnte,
  );

  let minUseCount = Number.POSITIVE_INFINITY;
  for (const def of eligible) {
    const count = bossUseCounts[def.id] ?? 0;
    if (count < minUseCount) {
      minUseCount = count;
    }
  }

  const leastUsedPool = eligible.filter((def) => (bossUseCounts[def.id] ?? 0) === minUseCount);
  const picked = pickElement(rngState, 'boss', leastUsedPool);

  return {
    bossId: picked.value.id,
    nextRngState: picked.nextState,
    nextBossUseCounts: {
      ...bossUseCounts,
      [picked.value.id]: (bossUseCounts[picked.value.id] ?? 0) + 1,
    },
  };
}

/**
 * Случайно выбирает один из 10 Знаков пропуска из изолированного потока 'tag'.
 */
export function rollSkipTag(rngState: RngState, ante?: number): RollSkipTagResult {
  const key = ante !== undefined ? `Tag${ante}` : 'tag';
  const picked = pickElement(rngState, key, TAG_IDS);
  return {
    tagId: picked.value,
    nextRngState: picked.nextState,
  };
}

/**
 * Генерирует 3 узла Стражей Этапа (Малый, Старший, Босс) с точными порогами и Знаками пропуска.
 */
export function buildAnteBlinds(
  ante: number,
  bossId: BossId,
  rngState: RngState,
  anteScaling = 1,
): BuildAnteBlindsResult {
  const baseAnteScore = getBlindAmount(ante, 1);
  const smallTagRoll = rollSkipTag(rngState, ante);
  const bigTagRoll = rollSkipTag(smallTagRoll.nextRngState, ante);
  const bossDef = BOSS_DEFINITIONS[bossId];

  const smallBlind: BlindSlotState = {
    kind: 'small',
    bossId: null,
    targetScore: Math.floor(baseAnteScore * 1 * anteScaling),
    reward: 3,
    status: 'current',
    skipTagId: smallTagRoll.tagId,
  };

  const bigBlind: BlindSlotState = {
    kind: 'big',
    bossId: null,
    targetScore: Math.floor(baseAnteScore * 1.5 * anteScaling),
    reward: 4,
    status: 'upcoming',
    skipTagId: bigTagRoll.tagId,
  };

  const bossBlind: BlindSlotState = {
    kind: 'boss',
    bossId,
    targetScore: Math.floor(baseAnteScore * bossDef.targetMultiplier * anteScaling),
    reward: bossDef.reward,
    status: 'upcoming',
    skipTagId: null,
  };

  return {
    anteBlinds: [smallBlind, bigBlind, bossBlind],
    nextRngState: bigTagRoll.nextRngState,
  };
}

/**
 * Проверяет, подавляется ли игральная карта способностью активного Босса (bl_pillar / bl_club).
 */
export function isCardDebuffedByBoss(
  card: PlayingCard,
  bossId: BossId | null,
  activeBossDisabled = false,
): boolean {
  if (!bossId || activeBossDisabled) return false;
  if (bossId === 'bl_pillar') return card.playedThisAnte;
  if (bossId === 'bl_club') return isCardSuit(card, 'clubs', true, false);
  return false;
}

/**
 * Пересчитывает флаг debuffed для всех карт колоды под правило текущего Босса.
 */
export function applyBossDebuffsToDeck(
  deck: readonly PlayingCard[],
  bossId: BossId | null,
  activeBossDisabled = false,
): PlayingCard[] {
  return deck.map((card) => {
    const debuffed = isCardDebuffedByBoss(card, bossId, activeBossDisabled);
    return card.debuffed === debuffed ? card : { ...card, debuffed };
  });
}

/**
 * Возвращает активного Босса текущего слота Стража (если он есть и не отключён).
 */
function getCurrentActiveBoss(state: RunState): BossId | null {
  if (state.activeBossDisabled) return null;
  const slot = state.anteBlinds[state.currentBlindIndex];
  return slot.kind === 'boss' ? slot.bossId : null;
}

/**
 * Применяет эффекты выбора Стража (дебафф колоды, bl_manacle -1 рука, bl_water 0 сбросов, цель раунда).
 */
export function applyBossOnBlindSelect(state: RunState): DispatchResult {
  const slot = state.anteBlinds[state.currentBlindIndex];
  const activeBoss = getCurrentActiveBoss(state);
  const nextDeck = applyBossDebuffsToDeck(state.deck, activeBoss, state.activeBossDisabled);
  const events: TraceEvent[] = [];

  let nextState: RunState = {
    ...state,
    deck: nextDeck,
    targetScore: slot.targetScore,
  };

  if (activeBoss === 'bl_manacle') {
    nextState = {
      ...nextState,
      handSize: Math.max(0, nextState.handSize - 1),
    };
    events.push({
      type: 'BOSS_TRIGGER',
      bossId: 'bl_manacle',
      locKey: 'boss_manacle',
      locParams: { count: 1 },
    });
  } else if (activeBoss === 'bl_water') {
    nextState = {
      ...nextState,
      savedBossDiscards: nextState.discardsLeft,
      discardsLeft: 0,
    };
    events.push({
      type: 'BOSS_TRIGGER',
      bossId: 'bl_water',
      locKey: 'boss_water',
    });
  }

  return { nextState, events };
}

/**
 * Восстанавливает модификаторы после окончания раунда и очищает временные флаги карт колоды.
 */
export function restoreBossEffectsOnRoundEnd(state: RunState, won: boolean): RunState {
  const slot = state.anteBlinds[state.currentBlindIndex];
  const isBossWin = slot.kind === 'boss' && won;
  const restoreManacle =
    slot.kind === 'boss' && slot.bossId === 'bl_manacle' && !state.activeBossDisabled && won
      ? 1
      : 0;

  const nextDeck = state.deck.map((card) => ({
    ...card,
    debuffed: false,
    forcedSelection: false,
    ...(isBossWin ? { playedThisAnte: false } : {}),
  }));

  return {
    ...state,
    deck: nextDeck,
    handSize: state.handSize + restoreManacle,
    tempHandSizeBonus: 0,
    discardsLeft: state.savedBossDiscards ?? state.discardsLeft,
    savedBossDiscards: null,
    activeBossDisabled: false,
  };
}

/**
 * Обновляет целевой порог очков у текущего активного слота Стража и самого забега.
 */
function updateCurrentTargetScore(state: RunState, nextTargetScore: number): RunState {
  const updatedBlinds = state.anteBlinds.map((slot, index) =>
    index === state.currentBlindIndex ? { ...slot, targetScore: nextTargetScore } : slot,
  ) as unknown as readonly [BlindSlotState, BlindSlotState, BlindSlotState];

  return {
    ...state,
    targetScore: nextTargetScore,
    anteBlinds: updatedBlinds,
  };
}

/**
 * Отключает способность активного Босса (bl_manacle +добор, bl_water, bl_wall /2, bl_final_vessel /3, дебаффы).
 */
export function disableActiveBoss(state: RunState): DispatchResult {
  const bossId = getCurrentActiveBoss(state);
  if (!bossId) {
    return { nextState: state, events: [] };
  }

  let nextState: RunState = {
    ...state,
    activeBossDisabled: true,
    deck: state.deck.map((card) => ({
      ...card,
      debuffed: false,
      ...(bossId === 'bl_final_bell' ? { forcedSelection: false } : {}),
    })),
  };

  if (bossId === 'bl_manacle') {
    nextState = {
      ...nextState,
      handSize: nextState.handSize + 1,
    };
    if (nextState.phase === 'playing' && nextState.drawPileIds.length > 0) {
      const [drawnCardId, ...restDrawPile] = nextState.drawPileIds;
      nextState = {
        ...nextState,
        drawPileIds: restDrawPile,
        handIds: [...nextState.handIds, drawnCardId!],
      };
    }
  } else if (bossId === 'bl_water' && nextState.savedBossDiscards !== null) {
    nextState = {
      ...nextState,
      discardsLeft: nextState.savedBossDiscards,
      savedBossDiscards: null,
    };
  } else if (bossId === 'bl_wall') {
    nextState = updateCurrentTargetScore(nextState, Math.floor(nextState.targetScore / 2));
  } else if (bossId === 'bl_final_vessel') {
    nextState = updateCurrentTargetScore(nextState, Math.floor(nextState.targetScore / 3));
  }

  const events: TraceEvent[] = [
    {
      type: 'BOSS_TRIGGER',
      bossId,
      locKey: 'boss_disabled',
    },
  ];

  // Как в blind.lua:377-400: снижение порога bl_wall (/2) и bl_final_vessel (/3) проверяет мгновенную победу
  if (
    (bossId === 'bl_wall' || bossId === 'bl_final_vessel') &&
    nextState.phase === 'playing' &&
    nextState.score >= nextState.targetScore
  ) {
    const slot = nextState.anteBlinds[nextState.currentBlindIndex];
    events.push({
      type: 'BLIND_DEFEATED',
      ante: nextState.ante,
      blindKind: slot.kind,
      bossId: slot.bossId,
      finalScore: nextState.score,
      targetScore: nextState.targetScore,
    });
  }

  return {
    nextState,
    events,
  };
}

/**
 * Принудительно выделяет 1 случайную карту в руке для Босса bl_final_bell (если в руке ещё нет такой карты).
 */
export function applyFinalBellSelection(state: RunState): DispatchResult {
  if (getCurrentActiveBoss(state) !== 'bl_final_bell' || state.handIds.length === 0) {
    return { nextState: state, events: [] };
  }

  const handSet = new Set(state.handIds);
  const alreadyForced = state.deck.some((card) => handSet.has(card.id) && card.forcedSelection);
  if (alreadyForced) {
    return { nextState: state, events: [] };
  }

  const pick = pickElement(state.rngState, 'cerulean_bell', state.handIds);
  const forcedId = pick.value;

  const nextState: RunState = {
    ...state,
    rngState: pick.nextState,
    deck: state.deck.map((card) =>
      card.id === forcedId ? { ...card, forcedSelection: true } : card,
    ),
  };

  return {
    nextState,
    events: [
      {
        type: 'BOSS_TRIGGER',
        bossId: 'bl_final_bell',
        affectedCardIds: [forcedId],
        locKey: 'boss_final_bell',
      },
    ],
  };
}

/**
 * Возвращает список доступных к покупке Гильдейских грамот с учётом купленных и пререквизитов.
 */
export function getEligibleCharters(ownedCharters: readonly CharterId[]): CharterId[] {
  const owned = new Set(ownedCharters);
  return CHARTER_IDS.filter((id) => {
    if (owned.has(id)) return false;
    return CHARTER_DEFINITIONS[id].requires.every((req) => owned.has(req));
  });
}

/**
 * Вычисляет цену со скидкой по стандартной формуле магазина Balite (минимум 1 з.).
 */
function calculateDiscountedPrice(baseCost: number, discountPercent: number): number {
  const clamped = Math.min(100, Math.max(0, discountPercent));
  return Math.max(1, Math.floor(((baseCost + 0.5) * (100 - clamped)) / 100));
}

/**
 * Пересчитывает текущие цены непроданных и небесплатных позиций магазина после смены скидки.
 */
function recalculateShopPrices(shop: ShopState, discountPercent: number): ShopState {
  const offers: ShopOffer[] = shop.offers.map((offer) => {
    if (offer.sold || offer.cost === 0) return offer;

    if (offer.kind === 'relic') {
      const nextCost =
        offer.baseCost === offer.relic.baseCost
          ? calculateRelicBuyCost(offer.relic.baseCost, offer.relic.edition, discountPercent)
          : calculateDiscountedPrice(offer.baseCost, discountPercent);
      return {
        ...offer,
        cost: nextCost,
        relic: {
          ...offer.relic,
          sellValue: calculateRelicSellValue(nextCost, offer.relic.extraValue),
        },
      };
    }

    if (offer.kind === 'consumable') {
      const nextCost = calculateDiscountedPrice(offer.baseCost, discountPercent);
      return {
        ...offer,
        cost: nextCost,
        consumable: {
          ...offer.consumable,
          sellValue: Math.max(1, Math.floor(nextCost / 2)),
        },
      };
    }

    const nextCost =
      offer.card.edition !== 'base' && offer.baseCost === 1
        ? calculateRelicBuyCost(1, offer.card.edition, discountPercent)
        : calculateDiscountedPrice(offer.baseCost, discountPercent);
    return {
      ...offer,
      cost: nextCost,
    };
  });

  const packs = shop.packs.map((pack) =>
    pack.purchased || pack.cost === 0
      ? pack
      : { ...pack, cost: calculateDiscountedPrice(pack.baseCost, discountPercent) },
  );

  const voucher =
    shop.voucher &&
    !shop.voucher.sold &&
    shop.voucher.charterId !== 'v_clearance_sale' &&
    shop.voucher.cost > 0
      ? {
          ...shop.voucher,
          cost: calculateDiscountedPrice(shop.voucher.baseCost, discountPercent),
        }
      : shop.voucher;

  return {
    ...shop,
    offers,
    packs,
    voucher,
  };
}

/**
 * Применяет купленную Гильдейскую грамоту к состоянию забега (и текущим ценам магазина).
 */
export function redeemCharter(state: RunState, charterId: CharterId): RunState {
  if (state.charters.includes(charterId)) {
    return state;
  }

  const withCharter: RunState = {
    ...state,
    charters: [...state.charters, charterId],
  };

  switch (charterId) {
    case 'v_overstock_norm':
      return { ...withCharter, shopSlots: withCharter.shopSlots + 1 };
    case 'v_clearance_sale': {
      // По card.lua:1917-1924 пересчитываем set_cost() для витрины магазина и всех карт у игрока (с сохранением extraValue)
      const nextRelics = withCharter.relics.map((relic) => {
        const discountedCost = calculateRelicBuyCost(relic.baseCost, relic.edition, 25);
        return {
          ...relic,
          sellValue: calculateRelicSellValue(discountedCost, relic.extraValue),
        };
      });
      const nextConsumables = withCharter.consumables.map((item) => {
        const discountedCost = calculateRelicBuyCost(item.baseCost, item.edition, 25);
        return {
          ...item,
          sellValue: calculateRelicSellValue(discountedCost, 0),
        };
      });
      return {
        ...withCharter,
        discountPercent: 25,
        relics: nextRelics,
        consumables: nextConsumables,
        shop: withCharter.shop ? recalculateShopPrices(withCharter.shop, 25) : null,
      };
    }
    case 'v_hone':
      return { ...withCharter, editionRate: Math.max(withCharter.editionRate, 2) };
    case 'v_reroll_surplus':
      return {
        ...withCharter,
        baseRerollCost: Math.max(0, withCharter.baseRerollCost - 2),
        shop: withCharter.shop
          ? {
              ...withCharter.shop,
              rerollCost: Math.max(0, withCharter.shop.rerollCost - 2),
              tempRerollCost:
                withCharter.shop.tempRerollCost !== null
                  ? Math.max(0, withCharter.shop.tempRerollCost - 2)
                  : null,
            }
          : null,
      };
    case 'v_crystal_ball':
      return { ...withCharter, maxConsumables: withCharter.maxConsumables + 1 };
    case 'v_grabber':
      return {
        ...withCharter,
        maxHands: withCharter.maxHands + 1,
        handsLeft: withCharter.handsLeft + 1,
      };
    case 'v_wasteful':
      return {
        ...withCharter,
        maxDiscards: withCharter.maxDiscards + 1,
        discardsLeft: withCharter.discardsLeft + 1,
      };
    case 'v_seed_money':
      return { ...withCharter, interestCap: Math.max(withCharter.interestCap, 50) };
    case 'v_paint_brush':
      return { ...withCharter, handSize: withCharter.handSize + 1 };
    case 'v_telescope':
    case 'v_observatory':
    case 'v_directors_cut':
      return withCharter;
  }
}

/**
 * Применяет одно срабатывание Знака пропуска (кроме tag_double) и возвращает обновлённый результат.
 */
function applySingleSkipTag(
  state: RunState,
  tagId: Exclude<TagId, 'tag_double'>,
  copiedFromDouble: boolean,
  events: TraceEvent[],
): { readonly nextState: RunState; readonly openedArcanaMega: number } {
  events.push({
    type: 'TAG_TRIGGER',
    tagId,
    ...(copiedFromDouble ? { copiedFromDouble: true } : {}),
    locKey: copiedFromDouble ? 'tag_copied' : 'tag_activated',
    locParams: { tagName: tagId },
  });

  if (tagId === 'tag_skip' || tagId === 'tag_economy') {
    const delta =
      tagId === 'tag_skip'
        ? 5 * Math.max(0, state.skipsCount)
        : Math.min(40, Math.max(0, state.dollars));

    if (delta <= 0) {
      return { nextState: state, openedArcanaMega: 0 };
    }

    const totalDollars = state.dollars + delta;
    events.push({
      type: 'DOLLAR_DELTA',
      delta,
      totalDollars,
      source: 'tag',
    });

    return {
      nextState: { ...state, dollars: totalDollars },
      openedArcanaMega: 0,
    };
  }

  if (tagId === 'tag_charm') {
    return {
      nextState: state,
      openedArcanaMega: 1,
    };
  }

  // Отложенные знаки (в т.ч. tag_juggle — round_start_bonus в начале следующего боя) помещаются в pendingTags
  return {
    nextState: {
      ...state,
      pendingTags: [...state.pendingTags, tagId],
    },
    openedArcanaMega: 0,
  };
}

/**
 * Выдаёт Знак пропуска с обработкой немедленных эффектов, отложенной очереди и дублирования tag_double.
 */
export function grantSkipTag(state: RunState, tagId: TagId): GrantSkipTagResult {
  const events: TraceEvent[] = [];

  if (tagId === 'tag_double') {
    events.push({
      type: 'TAG_TRIGGER',
      tagId: 'tag_double',
      locKey: 'tag_activated',
      locParams: { tagName: 'tag_double' },
    });
    return {
      nextState: {
        ...state,
        pendingTags: [...state.pendingTags, 'tag_double'],
      },
      events,
      openFreeArcanaMegaPackCount: 0,
      shouldOpenArcanaMegaPack: false,
    };
  }

  // Все накопленные tag_double срабатывают на новый знак (и удаляются из очереди) до его применения
  let doubleCount = 0;
  const remainingTags: TagId[] = [];
  for (const existing of state.pendingTags) {
    if (existing === 'tag_double') {
      doubleCount += 1;
    } else {
      remainingTags.push(existing);
    }
  }

  let currentState: RunState =
    doubleCount > 0 ? { ...state, pendingTags: remainingTags } : state;
  let openFreeArcanaMegaPackCount = 0;

  const totalApplications = 1 + doubleCount;
  for (let i = 0; i < totalApplications; i += 1) {
    const step = applySingleSkipTag(currentState, tagId, i > 0, events);
    currentState = step.nextState;
    openFreeArcanaMegaPackCount += step.openedArcanaMega;
  }

  return {
    nextState: currentState,
    events,
    openFreeArcanaMegaPackCount,
    shouldOpenArcanaMegaPack: openFreeArcanaMegaPackCount > 0,
  };
}
