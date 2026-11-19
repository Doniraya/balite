import { createPlayingCard } from './cards';
import {
  CELESTIAL_HAND_MAP,
  HAND_TO_CELESTIAL_MAP,
  calculateConsumableBuyCost,
  createConsumableInstance,
} from './consumables';
import { nextFloat, pickElement, shuffleDeckIds } from './prng';
import type { RngResult, RngState, RngStreamName } from './prng';
import {
  RELIC_DEFINITIONS,
  calculateRelicBuyCost,
  createRelicInstance,
  getRelicDefinition,
  resolveRelicTarget,
} from './relics';
import {
  CELESTIAL_IDS,
  CHARTER_IDS,
  ENHANCEMENTS,
  HAND_TYPES,
  RANKS,
  RUNE_IDS,
  SCROLL_IDS,
  SUITS,
  type BoosterChoice,
  type BoosterState,
  type CharterId,
  type ConsumableId,
  type ConsumableKind,
  type DispatchResult,
  type Edition,
  type Enhancement,
  type HandType,
  type PackOffer,
  type PackSize,
  type PackType,
  type RelicEffectResult,
  type RelicHookContext,
  type RelicId,
  type RelicInstance,
  type RelicRarity,
  type RelicRegistryLookup,
  type RunState,
  type Seal,
  type ShopOffer,
  type ShopVoucherOffer,
  type TagId,
  type TraceEvent,
} from './types';

/**
 * Проверяет платёжеспособность игрока с учётом бесплатных ($0) предложений и порога банкротства.
 */
export function canAffordCost(
  state: Pick<RunState, 'dollars' | 'bankruptAt'>,
  cost: number,
): boolean {
  if (cost <= 0) return true;
  return state.dollars - (state.bankruptAt ?? 0) >= cost;
}

/**
 * Функция разрешения цели Реликвии с учётом Blueprint/Brainstorm.
 */
export type ResolveShopRelicTargetFn = (
  relics: readonly RelicInstance[],
  slotIndex: number,
  lookup: RelicRegistryLookup,
) => {
  readonly effectRelic: RelicInstance;
  readonly stateRelic: RelicInstance;
  readonly isBlueprintCopy: boolean;
} | null;

/**
 * Опции генерации Издания в магазине, бустерах и расходниках.
 */
export interface PollEditionOptions {
  readonly allowNegative?: boolean;
  readonly noNegative?: boolean;
  readonly guaranteed?: boolean;
  readonly mod?: number;
}

/**
 * Опции выбора Реликвии из пула с учётом защиты от дублей.
 */
export interface PickPoolRelicOptions {
  readonly stream?: RngStreamName;
  readonly rarityStream?: RngStreamName;
  readonly keyAppend?: string;
  readonly rarity?: RelicRarity;
  readonly excludedIds?: readonly RelicId[];
  readonly allowDuplicates?: boolean;
  readonly relicRegistry?: RelicRegistryLookup;
}

/**
 * Опции выбора расходника из пула с учётом скрытых Сфер и защиты от дублей.
 */
export interface PickPoolConsumableOptions {
  readonly stream?: RngStreamName;
  readonly excludedIds?: readonly ConsumableId[];
  readonly allowDuplicates?: boolean;
}

/**
 * Опции генерации и реролла магазина.
 */
export interface ShopOptions {
  readonly relicRegistry?: RelicRegistryLookup;
  readonly resolveRelicTarget?: ResolveShopRelicTargetFn;
  readonly preserveVoucher?: boolean;
}

/**
 * Описание варианта бустер-набора с каноническим весом и размерами.
 */
interface PackPoolEntry {
  readonly packId: string;
  readonly type: PackType;
  readonly size: PackSize;
  readonly weight: number;
  readonly baseCost: number;
  readonly totalCards: number;
  readonly chooseCount: number;
}

/**
 * Полный пул бустер-наборов с суммарными весами семейств: 6.5 / 6.5 / 6.5 / 1.95 / 0.97.
 */
const BOOSTER_POOL: readonly PackPoolEntry[] = [
  { packId: 'p_arcana_normal', type: 'arcana', size: 'normal', weight: 4.0, baseCost: 4, totalCards: 3, chooseCount: 1 },
  { packId: 'p_arcana_jumbo', type: 'arcana', size: 'jumbo', weight: 2.0, baseCost: 6, totalCards: 5, chooseCount: 1 },
  { packId: 'p_arcana_mega', type: 'arcana', size: 'mega', weight: 0.5, baseCost: 8, totalCards: 5, chooseCount: 2 },
  { packId: 'p_celestial_normal', type: 'celestial', size: 'normal', weight: 4.0, baseCost: 4, totalCards: 3, chooseCount: 1 },
  { packId: 'p_celestial_jumbo', type: 'celestial', size: 'jumbo', weight: 2.0, baseCost: 6, totalCards: 5, chooseCount: 1 },
  { packId: 'p_celestial_mega', type: 'celestial', size: 'mega', weight: 0.5, baseCost: 8, totalCards: 5, chooseCount: 2 },
  { packId: 'p_standard_normal', type: 'standard', size: 'normal', weight: 4.0, baseCost: 4, totalCards: 3, chooseCount: 1 },
  { packId: 'p_standard_jumbo', type: 'standard', size: 'jumbo', weight: 2.0, baseCost: 6, totalCards: 5, chooseCount: 1 },
  { packId: 'p_standard_mega', type: 'standard', size: 'mega', weight: 0.5, baseCost: 8, totalCards: 5, chooseCount: 2 },
  { packId: 'p_buffoon_normal', type: 'buffoon', size: 'normal', weight: 1.2, baseCost: 4, totalCards: 2, chooseCount: 1 },
  { packId: 'p_buffoon_jumbo', type: 'buffoon', size: 'jumbo', weight: 0.6, baseCost: 6, totalCards: 4, chooseCount: 1 },
  { packId: 'p_buffoon_mega', type: 'buffoon', size: 'mega', weight: 0.15, baseCost: 8, totalCards: 4, chooseCount: 2 },
  { packId: 'p_spectral_normal', type: 'spectral', size: 'normal', weight: 0.6, baseCost: 4, totalCards: 2, chooseCount: 1 },
  { packId: 'p_spectral_jumbo', type: 'spectral', size: 'jumbo', weight: 0.3, baseCost: 6, totalCards: 4, chooseCount: 1 },
  { packId: 'p_spectral_mega', type: 'spectral', size: 'mega', weight: 0.07, baseCost: 8, totalCards: 4, chooseCount: 2 },
];

const BOOSTER_TOTAL_WEIGHT = BOOSTER_POOL.reduce((sum, entry) => sum + entry.weight, 0);
const NON_NONE_ENHANCEMENTS: readonly Enhancement[] = ENHANCEMENTS.filter((e) => e !== 'none');
const RUNE_POOL_IDS: readonly ConsumableId[] = RUNE_IDS.filter((id) => id !== 'c_black_hole');
const VOUCHER_BASE_COST = 10;
const SHOP_RELIC_WEIGHT = 20;
const SHOP_SCROLL_WEIGHT = 4;
const SHOP_CELESTIAL_WEIGHT = 4;
const SHOP_TOTAL_WEIGHT = SHOP_RELIC_WEIGHT + SHOP_SCROLL_WEIGHT + SHOP_CELESTIAL_WEIGHT;

/**
 * Удаляет первое вхождение указанного Знака пропуска из списка ожидающих знаков.
 */
function consumeFirstTag(pendingTags: readonly TagId[], tagId: TagId): TagId[] {
  const index = pendingTags.indexOf(tagId);
  if (index === -1) return [...pendingTags];
  return [...pendingTags.slice(0, index), ...pendingTags.slice(index + 1)];
}

/**
 * Проверяет, доступна ли Гильдейская грамота для появления в магазине (с учётом v_observatory -> v_telescope).
 */
function isCharterEligible(charterId: CharterId, ownedCharters: readonly CharterId[]): boolean {
  if (ownedCharters.includes(charterId)) return false;
  if (charterId === 'v_observatory' && !ownedCharters.includes('v_telescope')) {
    return false;
  }
  return true;
}

/**
 * Генерирует Издание с учётом обычных вероятностей (0.3% Теневое не масштабируется от v_hone) или гарантированного не-теневого пула (50/35/15).
 */
export function pollEdition(
  rngState: RngState,
  stream: RngStreamName,
  editionRate: number,
  options: PollEditionOptions = {},
): RngResult<Edition> {
  const guaranteed = options.guaranteed ?? false;
  const mod = options.mod ?? 1;
  // При гарантированном ролле Теневое издание отключено по умолчанию, если не разрешено явно
  const allowNegative =
    options.allowNegative !== undefined
      ? options.allowNegative
      : options.noNegative !== undefined
        ? !options.noNegative
        : !guaranteed;

  const roll = nextFloat(rngState, stream);
  const p = roll.value;

  let edition: Edition = 'base';
  if (guaranteed) {
    if (allowNegative && p > 1 - 0.003 * 25) {
      edition = 'negative';
    } else if (p > 1 - 0.006 * 25) {
      edition = 'polychrome';
    } else if (p > 1 - 0.02 * 25) {
      edition = 'holo';
    } else {
      edition = 'foil';
    }
  } else {
    if (allowNegative && p > 1 - 0.003 * mod) {
      edition = 'negative';
    } else if (p > 1 - 0.006 * editionRate * mod) {
      edition = 'polychrome';
    } else if (p > 1 - 0.02 * editionRate * mod) {
      edition = 'holo';
    } else if (p > 1 - 0.04 * editionRate * mod) {
      edition = 'foil';
    }
  }

  return {
    value: edition,
    nextState: roll.nextState,
  };
}

/**
 * Определяет редкость Реликвии: >0.95 -> R3 (5%), >0.70 -> R2 (25%), иначе R1 (70%).
 */
export function rollRelicRarity(rngState: RngState, stream: RngStreamName): RngResult<RelicRarity> {
  const roll = nextFloat(rngState, stream);
  const rarity: RelicRarity = roll.value > 0.95 ? 3 : roll.value > 0.7 ? 2 : 1;
  return {
    value: rarity,
    nextState: roll.nextState,
  };
}

/**
 * Выбирает Реликвию из пула указанной или случайной редкости, исключая уже имеющиеся и текущие дубли.
 */
export function pickPoolRelic(
  state: RunState,
  options: PickPoolRelicOptions = {},
): RngResult<RelicId> {
  const fallbackStream = options.stream ?? 'shop';
  const allowDuplicates = options.allowDuplicates ?? false;
  let rng = state.rngState;

  let targetRarity = options.rarity;
  if (targetRarity === undefined) {
    const rarityRoll = rollRelicRarity(rng, options.rarityStream ?? fallbackStream);
    targetRarity = rarityRoll.value;
    rng = rarityRoll.nextState;
  }

  const poolKey =
    options.keyAppend !== undefined
      ? `Joker${targetRarity}${options.keyAppend}${state.ante}`
      : fallbackStream;

  const blockedIds = new Set<RelicId>();
  if (!allowDuplicates) {
    for (const owned of state.relics) {
      blockedIds.add(owned.id);
    }
    if (options.excludedIds) {
      for (const excluded of options.excludedIds) {
        blockedIds.add(excluded);
      }
    }
  }

  const candidates = RELIC_DEFINITIONS.filter(
    (def) => def.rarity === targetRarity && !blockedIds.has(def.id),
  );

  // При исчерпании пула выбранной редкости оригинал Balatro (get_current_pool) возвращает j_joker
  if (candidates.length === 0) {
    return {
      value: 'j_joker',
      nextState: rng,
    };
  }

  const pick = pickElement(
    rng,
    poolKey,
    candidates.map((def) => def.id),
  );
  return {
    value: pick.value,
    nextState: pick.nextState,
  };
}

/**
 * Выбирает расходник из пула категории, скрывая неразблокированные Астральные сферы и защищая от дублей.
 */
export function pickPoolConsumable(
  state: RunState,
  kind: ConsumableKind,
  options: PickPoolConsumableOptions = {},
): RngResult<ConsumableId> {
  const stream = options.stream ?? 'shop';
  const allowDuplicates = options.allowDuplicates ?? false;

  const blockedIds = new Set<ConsumableId>();
  if (!allowDuplicates) {
    for (const owned of state.consumables) {
      blockedIds.add(owned.id);
    }
    if (options.excludedIds) {
      for (const excluded of options.excludedIds) {
        blockedIds.add(excluded);
      }
    }
  }

  let candidates: ConsumableId[] = [];
  if (kind === 'celestial') {
    candidates = CELESTIAL_IDS.filter((id) => {
      const handLevel = state.handLevels[CELESTIAL_HAND_MAP[id]];
      const unlocked = handLevel.visible || handLevel.playedCount > 0;
      return unlocked && !blockedIds.has(id);
    });
    if (candidates.length === 0) {
      candidates = ['c_pluto'];
    }
  } else if (kind === 'scroll') {
    candidates = SCROLL_IDS.filter((id) => !blockedIds.has(id));
    if (candidates.length === 0) {
      candidates = ['c_strength'];
    }
  } else {
    candidates = RUNE_POOL_IDS.filter((id) => !blockedIds.has(id));
    if (candidates.length === 0) {
      candidates = [...RUNE_POOL_IDS];
    }
  }

  return pickElement(state.rngState, stream, candidates);
}

/**
 * Проверяет наличие хотя бы одной несобранной R3 Реликвии для срабатывания Знака Величия (tag_rare).
 */
function hasAvailableRareRelic(state: RunState, excludedIds: readonly RelicId[]): boolean {
  const blocked = new Set<RelicId>(excludedIds);
  for (const relic of state.relics) {
    blocked.add(relic.id);
  }
  return RELIC_DEFINITIONS.some((def) => def.rarity === 3 && !blocked.has(def.id));
}

/**
 * Генерирует одно предложение для верхней полки магазина с учётом Знаков и исключённых дублей.
 */
function generateSingleTopShelfOffer(
  state: RunState,
  options: ShopOptions,
  excludedRelics: RelicId[],
  excludedConsumables: ConsumableId[],
  events: TraceEvent[],
): { readonly nextState: RunState; readonly offer: ShopOffer } {
  let current = state;
  let forcedRarity: RelicRarity | null = null;

  // Проверяем ожидающие Знаки пропуска создания Реликвии в порядке добавления
  while (forcedRarity === null) {
    const nextStoreTag = current.pendingTags.find(
      (tag) => tag === 'tag_uncommon' || tag === 'tag_rare',
    );
    if (!nextStoreTag) break;

    current = {
      ...current,
      pendingTags: consumeFirstTag(current.pendingTags, nextStoreTag),
    };

    if (nextStoreTag === 'tag_uncommon') {
      forcedRarity = 2;
      events.push({
        type: 'TAG_TRIGGER',
        tagId: 'tag_uncommon',
        locKey: 'tag_activated',
        locParams: { tagName: 'tag_uncommon' },
      });
    } else if (hasAvailableRareRelic(current, excludedRelics)) {
      forcedRarity = 3;
      events.push({
        type: 'TAG_TRIGGER',
        tagId: 'tag_rare',
        locKey: 'tag_activated',
        locParams: { tagName: 'tag_rare' },
      });
    } else {
      events.push({
        type: 'TAG_TRIGGER',
        tagId: 'tag_rare',
        locKey: 'tag_fizzled',
      });
    }
  }

  if (forcedRarity !== null) {
    const tagAppend = forcedRarity === 3 ? 'rta' : 'uta';
    const relicPick = pickPoolRelic(current, {
      keyAppend: tagAppend,
      rarity: forcedRarity,
      excludedIds: excludedRelics,
      ...(options.relicRegistry ? { relicRegistry: options.relicRegistry } : {}),
    });
    const edPick = pollEdition(relicPick.nextState, `edi${tagAppend}${current.ante}`, current.editionRate, {
      allowNegative: true,
    });
    const uid = current.nextCardUid;
    const relic = createRelicInstance(
      relicPick.value,
      `relic_${uid}`,
      edPick.value,
      current.discountPercent,
    );
    const normalBaseCost = calculateRelicBuyCost(relic.baseCost, edPick.value, 0);
    excludedRelics.push(relic.id);
    return {
      nextState: {
        ...current,
        rngState: edPick.nextState,
        nextCardUid: uid + 1,
      },
      offer: {
        uid: `offer_${uid}`,
        kind: 'relic',
        relic,
        cost: 0,
        baseCost: normalBaseCost,
        sold: false,
      },
    };
  }

  const kindRoll = nextFloat(current.rngState, `cdt${current.ante}`);
  const weighted = kindRoll.value * SHOP_TOTAL_WEIGHT;
  current = { ...current, rngState: kindRoll.nextState };

  if (weighted < SHOP_RELIC_WEIGHT) {
    const relicPick = pickPoolRelic(current, {
      rarityStream: `rarity${current.ante}sho`,
      keyAppend: 'sho',
      excludedIds: excludedRelics,
      ...(options.relicRegistry ? { relicRegistry: options.relicRegistry } : {}),
    });
    const edPick = pollEdition(relicPick.nextState, `edisho${current.ante}`, current.editionRate, {
      allowNegative: true,
    });
    const uid = current.nextCardUid;
    const relic = createRelicInstance(
      relicPick.value,
      `relic_${uid}`,
      edPick.value,
      current.discountPercent,
    );
    const normalBaseCost = calculateRelicBuyCost(relic.baseCost, edPick.value, 0);
    const buyCost = calculateRelicBuyCost(relic.baseCost, edPick.value, current.discountPercent);
    excludedRelics.push(relic.id);
    return {
      nextState: {
        ...current,
        rngState: edPick.nextState,
        nextCardUid: uid + 1,
      },
      offer: {
        uid: `offer_${uid}`,
        kind: 'relic',
        relic,
        cost: buyCost,
        baseCost: normalBaseCost,
        sold: false,
      },
    };
  }

  const kind: ConsumableKind =
    weighted < SHOP_RELIC_WEIGHT + SHOP_SCROLL_WEIGHT ? 'scroll' : 'celestial';
  const consPick = pickPoolConsumable(current, kind, {
    stream: `${kind === 'scroll' ? 'Tarot' : 'Planet'}sho${current.ante}`,
    excludedIds: excludedConsumables,
  });
  const uid = current.nextCardUid;
  // Расходники на полке магазина всегда базового издания (Издания роллят только Реликвии)
  const consumable = createConsumableInstance(
    consPick.value,
    `cons_${uid}`,
    'base',
    current.discountPercent,
  );
  const buyCost = calculateConsumableBuyCost(
    consumable.baseCost,
    'base',
    current.discountPercent,
  );
  excludedConsumables.push(consumable.id);
  return {
    nextState: {
      ...current,
      rngState: consPick.nextState,
      nextCardUid: uid + 1,
    },
    offer: {
      uid: `offer_${uid}`,
      kind: 'consumable',
      consumable,
      cost: buyCost,
      baseCost: consumable.baseCost,
      sold: false,
    },
  };
}

/**
 * Генерирует верхнюю полку предложений магазина с учётом ожидающих Знаков редкости/величия.
 */
function generateTopShelfOffers(
  state: RunState,
  options: ShopOptions,
  events: TraceEvent[],
): { readonly nextState: RunState; readonly offers: ShopOffer[] } {
  let current = state;
  const offers: ShopOffer[] = [];
  const excludedRelics: RelicId[] = [];
  const excludedConsumables: ConsumableId[] = [];
  const slotsCount = Math.max(1, current.shopSlots);

  for (let slotIndex = 0; slotIndex < slotsCount; slotIndex += 1) {
    const generated = generateSingleTopShelfOffer(
      current,
      options,
      excludedRelics,
      excludedConsumables,
      events,
    );
    current = generated.nextState;
    offers.push(generated.offer);
  }

  return { nextState: current, offers };
}

/**
 * Собирает идентификаторы непроданных Реликвий и Расходников верхней полки магазина для защиты от дублей.
 */
function collectExcludedFromShopOffers(
  offers: readonly ShopOffer[],
  excludedRelics: RelicId[],
  excludedConsumables: ConsumableId[],
): void {
  for (const offer of offers) {
    if (offer.sold) continue;
    if (offer.kind === 'relic') {
      excludedRelics.push(offer.relic.id);
    } else if (offer.kind === 'consumable') {
      excludedConsumables.push(offer.consumable.id);
    }
  }
}

/**
 * Дополняет текущую верхнюю полку открытого магазина новыми товарами до актуального shopSlots
 * (используется сразу после покупки Устава v_overstock_norm).
 */
export function appendShopTopShelfOffer(
  state: RunState,
  optionsOrRegistry: RelicRegistryLookup | ShopOptions = {},
): DispatchResult {
  if (!state.shop) {
    return { nextState: state, events: [] };
  }

  const targetSlots = Math.max(1, state.shopSlots);
  if (state.shop.offers.length >= targetSlots) {
    return { nextState: state, events: [] };
  }

  const options: ShopOptions =
    typeof optionsOrRegistry === 'function'
      ? { relicRegistry: optionsOrRegistry }
      : optionsOrRegistry;

  const events: TraceEvent[] = [];
  let current = state;
  const offers = [...state.shop.offers];
  const excludedRelics: RelicId[] = [];
  const excludedConsumables: ConsumableId[] = [];
  collectExcludedFromShopOffers(offers, excludedRelics, excludedConsumables);

  while (offers.length < targetSlots) {
    const generated = generateSingleTopShelfOffer(
      current,
      options,
      excludedRelics,
      excludedConsumables,
      events,
    );
    current = generated.nextState;
    offers.push(generated.offer);
  }

  return {
    nextState: {
      ...current,
      shop: {
        ...state.shop,
        offers,
      },
    },
    events,
  };
}

/**
 * Выбирает бустер-набор из взвешенного пула всех 5 семейств.
 */
function rollPackEntry(rngState: RngState, ante: number): RngResult<PackPoolEntry> {
  const roll = nextFloat(rngState, `shop_pack${ante}`);
  const threshold = roll.value * BOOSTER_TOTAL_WEIGHT;
  let cumulative = 0;

  for (const entry of BOOSTER_POOL) {
    cumulative += entry.weight;
    if (threshold <= cumulative) {
      return { value: entry, nextState: roll.nextState };
    }
  }

  return {
    value: BOOSTER_POOL[BOOSTER_POOL.length - 1]!,
    nextState: roll.nextState,
  };
}

/**
 * Создаёт состояние открытого магазина со всеми 3 полками, правилом 1-го магазина и знаками пропуска.
 */
export function createShopState(state: RunState, options: ShopOptions = {}): DispatchResult {
  const events: TraceEvent[] = [];
  let current = state;

  // Знак Обновления (tag_d_six): стартовая цена реролла в новом магазине становится 0 з.
  let tempRerollCost: number | null = null;
  if (current.pendingTags.includes('tag_d_six')) {
    tempRerollCost = 0;
    current = {
      ...current,
      pendingTags: consumeFirstTag(current.pendingTags, 'tag_d_six'),
    };
    events.push({
      type: 'TAG_TRIGGER',
      tagId: 'tag_d_six',
      locKey: 'tag_activated',
      locParams: { tagName: 'tag_d_six' },
    });
  }

  const shelfResult = generateTopShelfOffers(current, options, events);
  current = shelfResult.nextState;
  let offers = shelfResult.offers;

  // Нижняя левая полка: Гильдейская грамота (с учётом требования v_telescope -> v_observatory)
  let voucher: ShopVoucherOffer | null = null;
  if (options.preserveVoucher && current.shop?.voucher) {
    const prev = current.shop.voucher;
    voucher = {
      ...prev,
      cost: calculateRelicBuyCost(prev.baseCost, 'base', current.discountPercent),
    };
  } else {
    const eligibleCharters = CHARTER_IDS.filter((id) => isCharterEligible(id, current.charters));
    if (eligibleCharters.length > 0) {
      const picked = pickElement(current.rngState, `Voucher${current.ante}`, eligibleCharters);
      const uid = current.nextCardUid;
      voucher = {
        uid: `voucher_${uid}`,
        charterId: picked.value,
        cost: calculateRelicBuyCost(VOUCHER_BASE_COST, 'base', current.discountPercent),
        baseCost: VOUCHER_BASE_COST,
        sold: false,
      };
      current = {
        ...current,
        rngState: picked.nextState,
        nextCardUid: uid + 1,
      };
    }
  }

  // Нижняя правая полка: 2 бустер-набора (в самом первом магазине слот 0 гарантированно p_buffoon_normal)
  const isFirstShop = current.shopVisits === 0;
  let packs: PackOffer[] = [];
  for (let slot = 0; slot < 2; slot += 1) {
    let entry: PackPoolEntry;
    if (isFirstShop && slot === 0) {
      entry = BOOSTER_POOL.find((p) => p.packId === 'p_buffoon_normal')!;
    } else {
      const rolled = rollPackEntry(current.rngState, current.ante);
      entry = rolled.value;
      current = { ...current, rngState: rolled.nextState };
    }

    const uid = current.nextCardUid;
    packs.push({
      uid: `pack_${uid}`,
      packId: entry.packId,
      type: entry.type,
      size: entry.size,
      cost: calculateRelicBuyCost(entry.baseCost, 'base', current.discountPercent),
      baseCost: entry.baseCost,
      totalCards: entry.totalCards,
      chooseCount: entry.chooseCount,
      purchased: false,
    });
    current = { ...current, nextCardUid: uid + 1 };
  }

  // Знак Ярмарки (tag_coupon): обнуляет цену только на верхнюю полку и бустер-наборы (однократно при входе)
  if (current.pendingTags.includes('tag_coupon')) {
    current = {
      ...current,
      pendingTags: consumeFirstTag(current.pendingTags, 'tag_coupon'),
    };
    offers = offers.map((offer) => ({ ...offer, cost: 0 }));
    packs = packs.map((pack) => ({ ...pack, cost: 0 }));
    events.push({
      type: 'TAG_TRIGGER',
      tagId: 'tag_coupon',
      locKey: 'tag_activated',
      locParams: { tagName: 'tag_coupon' },
    });
  }

  const rerollCost = tempRerollCost ?? current.baseRerollCost;

  return {
    nextState: {
      ...current,
      shopVisits: current.shopVisits + 1,
      shop: {
        offers,
        voucher,
        packs,
        rerollCost,
        tempRerollCost,
        rerollsUsedThisShop: 0,
        adRerollUsed: false,
      },
    },
    events,
  };
}

/**
 * Запускает хук onShopReroll на всех активных Реликвиях (например, Торговая жилка j_flash).
 */
function runShopRerollRelicHooks(
  state: RunState,
  paidCost: number,
  registry: RelicRegistryLookup,
  resolve: ResolveShopRelicTargetFn,
  events: TraceEvent[],
): RunState {
  let current = state;

  for (let slotIndex = 0; slotIndex < current.relics.length; slotIndex += 1) {
    const resolved = resolve(current.relics, slotIndex, registry);
    if (!resolved) continue;

    const def = registry(resolved.effectRelic.id);
    const handler = def?.hooks.onShopReroll as
      | ((ctx: RelicHookContext) => RelicEffectResult | null | undefined)
      | undefined;
    if (!handler) continue;

    const result = handler({
      hook: 'onShopReroll',
      state: current,
      effectRelic: resolved.effectRelic,
      stateRelic: resolved.stateRelic,
      relicIndex: slotIndex,
      isBlueprintCopy: resolved.isBlueprintCopy,
      rerollCost: paidCost,
    });
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
        hook: 'onShopReroll',
        ...(result.locKey ? { locKey: result.locKey } : {}),
        ...(result.locParams ? { locParams: result.locParams } : {}),
      });
    }
  }

  return current;
}

/**
 * Обновляет верхнюю полку магазина за текущую цену реролла и вызывает хук onShopReroll (j_flash).
 */
export function rerollShopState(
  state: RunState,
  optionsOrRegistry: RelicRegistryLookup | ShopOptions = {},
): DispatchResult {
  if (!state.shop) {
    return { nextState: state, events: [] };
  }

  const paidCost = state.shop.rerollCost;
  if (!canAffordCost(state, paidCost)) {
    return { nextState: state, events: [] };
  }

  const options: ShopOptions =
    typeof optionsOrRegistry === 'function'
      ? { relicRegistry: optionsOrRegistry }
      : optionsOrRegistry;
  const registry = options.relicRegistry ?? getRelicDefinition;
  const resolve = options.resolveRelicTarget ?? resolveRelicTarget;

  const events: TraceEvent[] = [];
  let current = state;

  if (paidCost > 0) {
    const totalDollars = current.dollars - paidCost;
    current = {
      ...current,
      dollars: totalDollars,
      stats: {
        ...current.stats,
        dollarsSpent: current.stats.dollarsSpent + paidCost,
      },
    };
    events.push({
      type: 'DOLLAR_DELTA',
      delta: -paidCost,
      totalDollars,
      source: 'reroll',
    });
  }

  const shelfResult = generateTopShelfOffers(current, options, events);
  current = shelfResult.nextState;

  const nextRerollsUsed = state.shop.rerollsUsedThisShop + 1;
  const baseForReroll = state.shop.tempRerollCost ?? current.baseRerollCost;
  const nextRerollCost = Math.max(0, baseForReroll + nextRerollsUsed);

  current = {
    ...current,
    stats: {
      ...current.stats,
      rerollsCount: current.stats.rerollsCount + 1,
    },
    shop: {
      ...state.shop,
      offers: shelfResult.offers,
      rerollsUsedThisShop: nextRerollsUsed,
      rerollCost: nextRerollCost,
    },
  };

  current = runShopRerollRelicHooks(current, paidCost, registry, resolve, events);

  return {
    nextState: current,
    events,
  };
}

/**
 * Бесплатно обновляет верхнюю полку магазина 1 раз за визит (за просмотр рекламы),
 * не расходуя золото и не повышая цену платного реролла; вызывает хук onShopReroll (rerollCost = 0).
 */
export function freeRerollShopState(
  state: RunState,
  optionsOrRegistry: RelicRegistryLookup | ShopOptions = {},
): DispatchResult {
  if (!state.shop || state.shop.adRerollUsed) {
    return { nextState: state, events: [] };
  }

  const options: ShopOptions =
    typeof optionsOrRegistry === 'function'
      ? { relicRegistry: optionsOrRegistry }
      : optionsOrRegistry;
  const registry = options.relicRegistry ?? getRelicDefinition;
  const resolve = options.resolveRelicTarget ?? resolveRelicTarget;

  const events: TraceEvent[] = [];
  const shelfResult = generateTopShelfOffers(state, options, events);
  let current: RunState = {
    ...shelfResult.nextState,
    stats: {
      ...shelfResult.nextState.stats,
      rerollsCount: shelfResult.nextState.stats.rerollsCount + 1,
    },
    shop: {
      ...state.shop,
      offers: shelfResult.offers,
      adRerollUsed: true,
    },
  };

  current = runShopRerollRelicHooks(current, 0, registry, resolve, events);

  return {
    nextState: current,
    events,
  };
}

/**
 * Определяет самую часто разыгрываемую видимую комбинацию для Грамоты v_telescope (при ничьей — старшую в HAND_TYPES).
 */
function findTelescopePreferredHand(state: RunState): HandType | null {
  let bestHand: HandType | null = null;
  let bestPlayed = 0;

  for (const handType of HAND_TYPES) {
    const entry = state.handLevels[handType];
    if (entry.visible && entry.playedCount > bestPlayed) {
      bestPlayed = entry.playedCount;
      bestHand = handType;
    }
  }

  return bestHand;
}

/**
 * Генерирует содержимое открытого бустер-набора (все 5 семейств, v_telescope, 0.3% c_black_hole и временная рука).
 */
export function generateBoosterState(
  state: RunState,
  packOffer: PackOffer,
  fromTag = false,
): DispatchResult {
  let current = state;
  const choices: BoosterChoice[] = [];
  const excludedRelics: RelicId[] = [];
  const excludedConsumables: ConsumableId[] = [];
  // В оригинале непроданные карты на верхней полке магазина входят в общий пул used_jokers
  if (current.shop) {
    collectExcludedFromShopOffers(
      current.shop.offers,
      excludedRelics,
      excludedConsumables,
    );
  }
  const hasTelescope = current.charters.includes('v_telescope');

  for (let i = 0; i < packOffer.totalCards; i += 1) {
    const uid = current.nextCardUid;
    const choiceUid = `choice_${uid}`;

    if (packOffer.type === 'arcana') {
      const picked = pickPoolConsumable(current, 'scroll', {
        stream: `Tarotar${current.ante}`,
        excludedIds: excludedConsumables,
      });
      const consumable = createConsumableInstance(
        picked.value,
        `cons_${uid}`,
        'base',
        current.discountPercent,
      );
      excludedConsumables.push(consumable.id);
      choices.push({ uid: choiceUid, kind: 'consumable', consumable, picked: false });
      current = { ...current, rngState: picked.nextState, nextCardUid: uid + 1 };
    } else if (packOffer.type === 'celestial') {
      let chosenId: ConsumableId | null = null;
      let nextRng = current.rngState;

      if (hasTelescope && i === 0) {
        const preferredHand = findTelescopePreferredHand(current);
        if (preferredHand) {
          chosenId = HAND_TO_CELESTIAL_MAP[preferredHand];
        }
      }

      if (!chosenId) {
        const blackHoleBlocked =
          current.consumables.some((item) => item.id === 'c_black_hole') ||
          excludedConsumables.includes('c_black_hole');
        if (!blackHoleBlocked) {
          const bhRoll = nextFloat(nextRng, `soul_Planet${current.ante}`);
          nextRng = bhRoll.nextState;
          if (bhRoll.value > 0.997) {
            chosenId = 'c_black_hole';
          }
        }
      }

      if (!chosenId) {
        const picked = pickPoolConsumable(
          { ...current, rngState: nextRng },
          'celestial',
          { stream: `Planetpl${current.ante}`, excludedIds: excludedConsumables },
        );
        chosenId = picked.value;
        nextRng = picked.nextState;
      }

      const consumable = createConsumableInstance(
        chosenId,
        `cons_${uid}`,
        'base',
        current.discountPercent,
      );
      excludedConsumables.push(consumable.id);
      choices.push({ uid: choiceUid, kind: 'consumable', consumable, picked: false });
      current = { ...current, rngState: nextRng, nextCardUid: uid + 1 };
    } else if (packOffer.type === 'spectral') {
      let chosenId: ConsumableId | null = null;
      let nextRng = current.rngState;

      const blackHoleBlocked =
        current.consumables.some((item) => item.id === 'c_black_hole') ||
        excludedConsumables.includes('c_black_hole');
      if (!blackHoleBlocked) {
        const bhRoll = nextFloat(nextRng, `soul_Spectral${current.ante}`);
        nextRng = bhRoll.nextState;
        if (bhRoll.value > 0.997) {
          chosenId = 'c_black_hole';
        }
      }

      if (!chosenId) {
        const picked = pickPoolConsumable(
          { ...current, rngState: nextRng },
          'rune',
          { stream: `Spectralspe${current.ante}`, excludedIds: excludedConsumables },
        );
        chosenId = picked.value;
        nextRng = picked.nextState;
      }

      const consumable = createConsumableInstance(
        chosenId,
        `cons_${uid}`,
        'base',
        current.discountPercent,
      );
      excludedConsumables.push(consumable.id);
      choices.push({ uid: choiceUid, kind: 'consumable', consumable, picked: false });
      current = { ...current, rngState: nextRng, nextCardUid: uid + 1 };
    } else if (packOffer.type === 'buffoon') {
      const relicPick = pickPoolRelic(current, {
        rarityStream: `rarity${current.ante}buf`,
        keyAppend: 'buf',
        excludedIds: excludedRelics,
      });
      const edPick = pollEdition(relicPick.nextState, `edibuf${current.ante}`, current.editionRate, {
        allowNegative: true,
      });
      const relic = createRelicInstance(
        relicPick.value,
        `relic_${uid}`,
        edPick.value,
        current.discountPercent,
      );
      excludedRelics.push(relic.id);
      choices.push({ uid: choiceUid, kind: 'relic', relic, picked: false });
      current = { ...current, rngState: edPick.nextState, nextCardUid: uid + 1 };
    } else {
      // Стандартный набор игральных карт: 40% Улучшение, Издание с mod=2 без Теневого, 20% Печать
      const enhChanceRoll = nextFloat(current.rngState, `stdset${current.ante}`);
      let nextRng = enhChanceRoll.nextState;
      let enhancement: Enhancement = 'none';
      if (enhChanceRoll.value > 0.6) {
        const enhPick = pickElement(nextRng, `Enhancedsta${current.ante}`, NON_NONE_ENHANCEMENTS);
        enhancement = enhPick.value;
        nextRng = enhPick.nextState;
      }

      const suitPick = pickElement(nextRng, `frontsta${current.ante}`, SUITS);
      const rankPick = pickElement(suitPick.nextState, `frontsta${current.ante}`, RANKS);
      const edPick = pollEdition(rankPick.nextState, `edista${current.ante}`, current.editionRate, {
        mod: 2,
        allowNegative: false,
      });
      nextRng = edPick.nextState;

      let seal: Seal = 'none';
      const sealChanceRoll = nextFloat(nextRng, `stdseal${current.ante}`);
      nextRng = sealChanceRoll.nextState;
      if (sealChanceRoll.value > 0.8) {
        const sealTypeRoll = nextFloat(nextRng, `stdsealtype${current.ante}`);
        nextRng = sealTypeRoll.nextState;
        if (sealTypeRoll.value > 0.75) {
          seal = 'red';
        } else if (sealTypeRoll.value > 0.5) {
          seal = 'blue';
        } else if (sealTypeRoll.value > 0.25) {
          seal = 'gold';
        } else {
          seal = 'purple';
        }
      }

      const card = createPlayingCard({
        id: `card_${uid}`,
        suit: suitPick.value,
        rank: rankPick.value,
        enhancement,
        edition: edPick.value,
        seal,
      });
      choices.push({ uid: choiceUid, kind: 'card', card, picked: false });
      current = { ...current, rngState: nextRng, nextCardUid: uid + 1 };
    }
  }

  // Наборы Свитков и Рун набирают временную руку из drawPileIds без перетасовки всей колоды
  let drawnHandCardIds: readonly string[] = [];
  if (packOffer.type === 'arcana' || packOffer.type === 'spectral') {
    if (current.phase === 'playing' && current.handIds.length > 0) {
      drawnHandCardIds = [...current.handIds];
    } else {
      const targetCount = Math.min(current.deck.length, Math.max(0, current.handSize));
      if (
        current.drawPileIds.length === 0 &&
        current.discardPileIds.length === 0 &&
        current.deck.length > 0
      ) {
        // Резерв для синтетических тестовых состояний с незаполненными стопками
        const shuffled = shuffleDeckIds(
          current.rngState,
          'shuffle',
          current.deck.map((card) => card.id),
        );
        drawnHandCardIds = shuffled.value.slice(0, targetCount);
        current = {
          ...current,
          rngState: shuffled.nextState,
          drawPileIds: shuffled.value.slice(targetCount),
        };
      } else {
        let pool = [...current.drawPileIds];
        let discard = [...current.discardPileIds];
        if (pool.length < targetCount && discard.length > 0) {
          const reshuffled = shuffleDeckIds(current.rngState, 'shuffle', discard);
          pool = [...pool, ...reshuffled.value];
          discard = [];
          current = { ...current, rngState: reshuffled.nextState };
        }
        const takeCount = Math.min(pool.length, targetCount);
        drawnHandCardIds = pool.slice(0, takeCount);
        current = {
          ...current,
          drawPileIds: pool.slice(takeCount),
          discardPileIds: discard,
        };
      }
    }
  }

  const booster: BoosterState = {
    packId: packOffer.packId,
    packType: packOffer.type,
    packSize: packOffer.size,
    choices,
    remainingPicks: packOffer.chooseCount,
    drawnHandCardIds,
    fromTag,
  };

  return {
    nextState: {
      ...current,
      booster,
    },
    events: [],
  };
}
