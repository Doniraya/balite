import {
  BOSS_IDS,
  CELESTIAL_IDS,
  CHARTER_IDS,
  DECK_IDS,
  EDITIONS,
  ENHANCEMENTS,
  RELIC_IDS,
  RUNE_IDS,
  SCROLL_IDS,
  SEALS,
  TAG_IDS,
  type BossId,
  type CharterId,
  type ConsumableId,
  type DeckId,
  type Edition,
  type Enhancement,
  type MetaSave,
  type PackSize,
  type PackType,
  type RelicId,
  type RunState,
  type Seal,
  type TagId,
} from './types';

/**
 * 11 основных категорий предметов и сущностей в каталоге Коллекции.
 */
export type CollectionCategory =
  | 'relics'
  | 'decks'
  | 'vouchers'
  | 'scrolls'
  | 'celestials'
  | 'runes'
  | 'enhancements'
  | 'seals'
  | 'editions'
  | 'packs'
  | 'tags'
  | 'blinds';

/**
 * Список всех доступных улучшений игральных карт (8 типов, без 'none').
 */
export const COLLECTION_ENHANCEMENTS: readonly Enhancement[] = ENHANCEMENTS.filter(
  (e): e is Enhancement => e !== 'none',
);

/**
 * Список всех доступных печатей (4 типа, без 'none').
 */
export const COLLECTION_SEALS: readonly Seal[] = SEALS.filter((s): s is Seal => s !== 'none');

/**
 * Список всех доступных изданий карт и реликвий (5 типов).
 */
export const COLLECTION_EDITIONS: readonly Edition[] = EDITIONS;

/**
 * Идентификаторы 12 бустерных сундуков (4 типа × 3 размера).
 */
export const COLLECTION_PACK_IDS: readonly string[] = [
  'pack_arcana_normal',
  'pack_arcana_jumbo',
  'pack_arcana_mega',
  'pack_celestial_normal',
  'pack_celestial_jumbo',
  'pack_celestial_mega',
  'pack_standard_normal',
  'pack_standard_jumbo',
  'pack_standard_mega',
  'pack_buffoon_normal',
  'pack_buffoon_jumbo',
  'pack_buffoon_mega',
] as const;

/**
 * 16 обычных монстров подземелья (по 2 на каждый из 8 этажей).
 */
export const REGULAR_MONSTER_IDS: readonly string[] = [
  'm_ante_1_small', // Слизняк
  'm_ante_1_big', // Гоблин
  'm_ante_2_small', // Мурлок
  'm_ante_2_big', // Кобольд
  'm_ante_3_small', // Драугр
  'm_ante_3_big', // Орк
  'm_ante_4_small', // Мимик
  'm_ante_4_big', // Гарпия
  'm_ante_5_small', // Каменный голем
  'm_ante_5_big', // Минотавр
  'm_ante_6_small', // Мантикора
  'm_ante_6_big', // Виверна
  'm_ante_7_small', // Драконид
  'm_ante_7_big', // Архидемон
  'm_ante_8_small', // Теневой рыцарь
  'm_ante_8_big', // Вестник погибели
] as const;

/**
 * Полный реестр идентификаторов 26 заказов и боссов (16 монстров + 10 боссов).
 */
export const COLLECTION_BLIND_IDS: readonly string[] = [
  ...REGULAR_MONSTER_IDS,
  ...BOSS_IDS,
] as const;

/**
 * Карта пар ваучеров (базовый Т1 -> улучшенный Т2) с условиями открытия Т2.
 */
export interface VoucherTierPair {
  readonly t1: CharterId;
  readonly t2: CharterId;
  readonly unlockConditionKey: string;
}

export const VOUCHER_PAIRS: readonly VoucherTierPair[] = [
  { t1: 'v_overstock_norm', t2: 'v_clearance_sale', unlockConditionKey: 'spend2500' },
  { t1: 'v_hone', t2: 'v_reroll_surplus', unlockConditionKey: 'reroll50' },
  { t1: 'v_crystal_ball', t2: 'v_telescope', unlockConditionKey: 'use50Celestials' },
  { t1: 'v_grabber', t2: 'v_wasteful', unlockConditionKey: 'play250Hands' },
  { t1: 'v_seed_money', t2: 'v_paint_brush', unlockConditionKey: 'earn400Dollars' },
  { t1: 'v_observatory', t2: 'v_directors_cut', unlockConditionKey: 'defeat10Bosses' },
];

/**
 * Возвращает полный упорядоченный список идентификаторов сущностей для выбранной категории.
 */
export function getCollectionCategoryItemIds(category: CollectionCategory): readonly string[] {
  switch (category) {
    case 'relics':
      return RELIC_IDS;
    case 'decks':
      return DECK_IDS;
    case 'vouchers':
      return CHARTER_IDS;
    case 'scrolls':
      return SCROLL_IDS;
    case 'celestials':
      return CELESTIAL_IDS;
    case 'runes':
      return RUNE_IDS;
    case 'enhancements':
      return COLLECTION_ENHANCEMENTS;
    case 'seals':
      return COLLECTION_SEALS;
    case 'editions':
      return COLLECTION_EDITIONS;
    case 'packs':
      return COLLECTION_PACK_IDS;
    case 'tags':
      return TAG_IDS;
    case 'blinds':
      return COLLECTION_BLIND_IDS;
  }
}

/**
 * Проверяет, открыт ли конкретный предмет в мета-прогрессе игрока.
 * Примечание: Улучшения, Печати и Издания в Balite доступны сразу для ознакомления правил,
 * либо открываются по мере обнаружения. По референсу Balatro Улучшения и Печати показываются полностью.
 */
export function isCollectionItemDiscovered(
  meta: MetaSave,
  category: CollectionCategory,
  itemId: string,
): boolean {
  switch (category) {
    case 'relics':
      return meta.discoveredRelics.includes(itemId as RelicId);
    case 'decks':
      return meta.unlockedDecks.includes(itemId as DeckId);
    case 'vouchers':
      return meta.discoveredCharters.includes(itemId as CharterId);
    case 'scrolls':
    case 'celestials':
    case 'runes':
      return meta.discoveredConsumables.includes(itemId as any);
    case 'enhancements':
      // Улучшения карт открыты всегда по умолчанию (справочник правил модификаций)
      return true;
    case 'seals':
      // Печати открыты всегда по умолчанию (справочник сургучных печатей)
      return true;
    case 'editions':
      // Базовое издание открыто всегда, остальные — по обнаружению или дефолту
      if (itemId === 'base') return true;
      return meta.discoveredEditions?.includes(itemId as Edition) ?? false;
    case 'packs':
      return meta.discoveredPacks?.includes(itemId) ?? false;
    case 'tags':
      return meta.discoveredTags?.includes(itemId as TagId) ?? false;
    case 'blinds':
      if (REGULAR_MONSTER_IDS.includes(itemId)) {
        // Обычные монстры 1 этапа открыты по умолчанию, остальные — по прогрессу
        if (itemId === 'm_ante_1_small' || itemId === 'm_ante_1_big') return true;
        return meta.discoveredMonsters?.includes(itemId) ?? false;
      }
      return meta.discoveredBosses.includes(itemId as BossId);
  }
}

/**
 * Проверяет, был ли предмет уже просмотрен игроком в коллекции.
 */
export function isCollectionItemSeen(meta: MetaSave, itemId: string): boolean {
  return meta.seenCollectionItems?.includes(itemId) ?? false;
}

/**
 * Подсчитывает количество открытых предметов, общий размер и наличие новых (!) в категории.
 */
export function getCollectionCategoryStats(
  meta: MetaSave,
  category: CollectionCategory,
): { discovered: number; total: number; hasUnseen: boolean } {
  const itemIds = getCollectionCategoryItemIds(category);
  const total = itemIds.length;
  let discovered = 0;
  let hasUnseen = false;

  for (const id of itemIds) {
    const isDiscovered = isCollectionItemDiscovered(meta, category, id);
    if (isDiscovered) {
      discovered += 1;
      if (!isCollectionItemSeen(meta, id)) {
        // Для базовых улучшений/печатей не зажигаем тревожные «!»
        if (category !== 'enhancements' && category !== 'seals' && id !== 'base') {
          hasUnseen = true;
        }
      }
    }
  }

  return { discovered, total, hasUnseen };
}

/**
 * Проверяет, есть ли хотя бы один новый неотсмотренный предмет в любой из категорий коллекции.
 */
export function hasAnyUnseenCollectionItems(meta: MetaSave): boolean {
  const categories: readonly CollectionCategory[] = [
    'relics',
    'decks',
    'vouchers',
    'scrolls',
    'celestials',
    'runes',
    'editions',
    'packs',
    'tags',
    'blinds',
  ];
  return categories.some((cat) => getCollectionCategoryStats(meta, cat).hasUnseen);
}

/**
 * Помечает элемент как просмотренный в коллекции, снимая индикатор «!».
 */
export function markCollectionItemSeen(meta: MetaSave, itemId: string): MetaSave {
  const existingSeen = meta.seenCollectionItems ?? [];
  if (existingSeen.includes(itemId)) {
    return meta;
  }
  return {
    ...meta,
    updatedAt: Date.now(),
    seenCollectionItems: [...existingSeen, itemId],
  };
}

/**
 * Помечает все открытые элементы заданной категории как просмотренные.
 */
export function markCollectionCategorySeen(
  meta: MetaSave,
  category: CollectionCategory,
): MetaSave {
  const itemIds = getCollectionCategoryItemIds(category);
  const existingSeen = new Set(meta.seenCollectionItems ?? []);
  let changed = false;

  for (const id of itemIds) {
    if (isCollectionItemDiscovered(meta, category, id) && !existingSeen.has(id)) {
      existingSeen.add(id);
      changed = true;
    }
  }

  if (!changed) return meta;

  return {
    ...meta,
    updatedAt: Date.now(),
    seenCollectionItems: Array.from(existingSeen),
  };
}

/**
 * Открывает абсолютно все сущности в коллекции игрока (для тестов и отладочной панели).
 */
export function unlockAllCollection(meta: MetaSave): MetaSave {
  return {
    ...meta,
    updatedAt: Date.now(),
    unlockedDecks: [...DECK_IDS],
    discoveredRelics: [...RELIC_IDS],
    discoveredConsumables: [...SCROLL_IDS, ...CELESTIAL_IDS, ...RUNE_IDS],
    discoveredCharters: [...CHARTER_IDS],
    discoveredBosses: [...BOSS_IDS],
    discoveredTags: [...TAG_IDS],
    discoveredMonsters: [...REGULAR_MONSTER_IDS],
    discoveredPacks: [...COLLECTION_PACK_IDS],
    discoveredEditions: [...COLLECTION_EDITIONS],
    seenCollectionItems: [
      ...RELIC_IDS,
      ...DECK_IDS,
      ...CHARTER_IDS,
      ...SCROLL_IDS,
      ...CELESTIAL_IDS,
      ...RUNE_IDS,
      ...TAG_IDS,
      ...REGULAR_MONSTER_IDS,
      ...COLLECTION_PACK_IDS,
      ...COLLECTION_EDITIONS,
      ...BOSS_IDS,
    ],
  };
}

/**
 * Сбрасывает открытия коллекции до стартового состояния новой игры.
 */
export function resetCollection(meta: MetaSave): MetaSave {
  return {
    ...meta,
    updatedAt: Date.now(),
    unlockedDecks: ['b_red'],
    discoveredRelics: [],
    discoveredConsumables: [],
    discoveredCharters: [],
    discoveredBosses: [],
    discoveredTags: [],
    discoveredMonsters: ['m_ante_1_small', 'm_ante_1_big'],
    discoveredPacks: [],
    discoveredEditions: ['base'],
    seenCollectionItems: [],
  };
}

const COLLECTION_PACK_ID_SET: ReadonlySet<string> = new Set(COLLECTION_PACK_IDS);
const RELIC_ID_SET: ReadonlySet<RelicId> = new Set(RELIC_IDS);
const CONSUMABLE_ID_SET: ReadonlySet<ConsumableId> = new Set([
  ...CELESTIAL_IDS,
  ...SCROLL_IDS,
  ...RUNE_IDS,
]);
const CHARTER_ID_SET: ReadonlySet<CharterId> = new Set(CHARTER_IDS);
const BOSS_ID_SET: ReadonlySet<BossId> = new Set(BOSS_IDS);
const TAG_ID_SET: ReadonlySet<TagId> = new Set(TAG_IDS);
const REGULAR_MONSTER_ID_SET: ReadonlySet<string> = new Set(REGULAR_MONSTER_IDS);
const EDITION_ID_SET: ReadonlySet<Edition> = new Set(EDITIONS);

/**
 * Дополнительные открытия, зафиксированные в рамках текущего действия/хода UI
 * вне мгновенного снимка RunState (использованные расходники, открытые бустеры и т.п.).
 */
export interface RunMetaDiscoveriesExtras {
  readonly extraConsumableIds?: readonly ConsumableId[];
  readonly extraTagIds?: readonly TagId[];
  readonly extraPackIds?: readonly string[];
  readonly extraEditions?: readonly Edition[];
}

/**
 * Набор открытых коллекционных идентификаторов, собранный из RunState.
 */
export interface RunMetaDiscoveries {
  readonly discoveredRelics: readonly RelicId[];
  readonly discoveredConsumables: readonly ConsumableId[];
  readonly discoveredCharters: readonly CharterId[];
  readonly discoveredBosses: readonly BossId[];
  readonly discoveredTags: readonly TagId[];
  readonly discoveredMonsters: readonly string[];
  readonly discoveredPacks: readonly string[];
  readonly discoveredEditions: readonly Edition[];
}

function pushUniqueValidId<T extends string>(
  target: T[],
  seen: Set<T>,
  id: T | null | undefined,
  allowed: ReadonlySet<T>,
): void {
  if (typeof id === 'string' && allowed.has(id) && !seen.has(id)) {
    seen.add(id);
    target.push(id);
  }
}

/**
 * Сопоставляет формат бустер-набора из shop.ts ('p_arcana_normal' или пара packType + packSize)
 * с каноническим идентификатором из COLLECTION_PACK_IDS ('pack_arcana_normal' и т.д.).
 * Для наборов вне каталога коллекции (например, 'spectral') возвращает null.
 */
export function normalizePackIdForCollection(
  packTypeOrId: PackType | string,
  packSize?: PackSize | string,
): string | null {
  if (packSize !== undefined) {
    const candidate = `pack_${packTypeOrId}_${packSize}`;
    return COLLECTION_PACK_ID_SET.has(candidate) ? candidate : null;
  }

  const trimmed = packTypeOrId.trim();
  if (COLLECTION_PACK_ID_SET.has(trimmed)) {
    return trimmed;
  }

  const shopMatch = /^p_([a-z]+)_([a-z]+)(?:_\d+)?$/i.exec(trimmed);
  if (shopMatch) {
    const candidate = `pack_${shopMatch[1]!.toLowerCase()}_${shopMatch[2]!.toLowerCase()}`;
    return COLLECTION_PACK_ID_SET.has(candidate) ? candidate : null;
  }

  return null;
}

/**
 * Чистая функция сбора всех коллекционных открытий из текущего состояния забега RunState
 * и опциональных событийных добавок (без мутаций, DOM и Math.random).
 */
export function collectRunMetaDiscoveries(
  state: RunState,
  extras: RunMetaDiscoveriesExtras = {},
): RunMetaDiscoveries {
  const discoveredRelics: RelicId[] = [];
  const seenRelics = new Set<RelicId>();
  const discoveredConsumables: ConsumableId[] = [];
  const seenConsumables = new Set<ConsumableId>();
  const discoveredCharters: CharterId[] = [];
  const seenCharters = new Set<CharterId>();
  const discoveredBosses: BossId[] = [];
  const seenBosses = new Set<BossId>();
  const discoveredTags: TagId[] = [];
  const seenTags = new Set<TagId>();
  const discoveredMonsters: string[] = [];
  const seenMonsters = new Set<string>();
  const discoveredPacks: string[] = [];
  const seenPacks = new Set<string>();
  const discoveredEditions: Edition[] = [];
  const seenEditions = new Set<Edition>();

  const pushEdition = (edition: Edition | undefined): void => {
    if (edition && edition !== 'base') {
      pushUniqueValidId(discoveredEditions, seenEditions, edition, EDITION_ID_SET);
    }
  };

  for (const relic of state.relics) {
    pushUniqueValidId(discoveredRelics, seenRelics, relic.id, RELIC_ID_SET);
    pushEdition(relic.edition);
  }

  for (const consumable of state.consumables) {
    pushUniqueValidId(discoveredConsumables, seenConsumables, consumable.id, CONSUMABLE_ID_SET);
    pushEdition(consumable.edition);
  }
  pushUniqueValidId(
    discoveredConsumables,
    seenConsumables,
    state.lastUsedConsumableId,
    CONSUMABLE_ID_SET,
  );
  if (extras.extraConsumableIds) {
    for (const id of extras.extraConsumableIds) {
      pushUniqueValidId(discoveredConsumables, seenConsumables, id, CONSUMABLE_ID_SET);
    }
  }

  for (const charterId of state.charters) {
    pushUniqueValidId(discoveredCharters, seenCharters, charterId, CHARTER_ID_SET);
  }

  for (const slot of state.anteBlinds) {
    pushUniqueValidId(discoveredBosses, seenBosses, slot.bossId, BOSS_ID_SET);
    if (slot.status === 'skipped') {
      pushUniqueValidId(discoveredTags, seenTags, slot.skipTagId, TAG_ID_SET);
    }
  }

  for (const tagId of state.pendingTags) {
    pushUniqueValidId(discoveredTags, seenTags, tagId, TAG_ID_SET);
  }
  if (extras.extraTagIds) {
    for (const tagId of extras.extraTagIds) {
      pushUniqueValidId(discoveredTags, seenTags, tagId, TAG_ID_SET);
    }
  }

  if (Number.isInteger(state.ante) && state.ante >= 2 && state.ante <= 8) {
    for (const slot of state.anteBlinds) {
      if (
        (slot.kind === 'small' || slot.kind === 'big') &&
        (slot.status === 'defeated' || (slot.status === 'current' && state.phase !== 'blind_select'))
      ) {
        const monsterId = `m_ante_${state.ante}_${slot.kind}`;
        pushUniqueValidId(discoveredMonsters, seenMonsters, monsterId, REGULAR_MONSTER_ID_SET);
      }
    }
  }

  if (state.booster) {
    const boosterPackId = normalizePackIdForCollection(
      state.booster.packType,
      state.booster.packSize,
    );
    pushUniqueValidId(discoveredPacks, seenPacks, boosterPackId, COLLECTION_PACK_ID_SET);
  }
  if (extras.extraPackIds) {
    for (const rawPackId of extras.extraPackIds) {
      const normalizedPackId = normalizePackIdForCollection(rawPackId);
      pushUniqueValidId(discoveredPacks, seenPacks, normalizedPackId, COLLECTION_PACK_ID_SET);
    }
  }

  for (const card of state.deck) {
    pushEdition(card.edition);
  }
  if (extras.extraEditions) {
    for (const edition of extras.extraEditions) {
      pushEdition(edition);
    }
  }

  return {
    discoveredRelics,
    discoveredConsumables,
    discoveredCharters,
    discoveredBosses,
    discoveredTags,
    discoveredMonsters,
    discoveredPacks,
    discoveredEditions,
  };
}
