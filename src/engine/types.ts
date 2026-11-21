import type { RngState } from './prng';

/**
 * Четыре канонические масти игральных карт.
 */
export const SUITS = ['spades', 'hearts', 'clubs', 'diamonds'] as const;

/**
 * Масть игральной карты.
 */
export type Suit = (typeof SUITS)[number];

/**
 * Числовые ранги карт от 2 до 14 (11 = Валет, 12 = Дама, 13 = Король, 14 = Туз).
 */
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

/**
 * Ранг игральной карты.
 */
export type Rank = (typeof RANKS)[number];

/**
 * Доступные улучшения игральных карт (8 типов + отсутствие улучшения).
 */
export const ENHANCEMENTS = [
  'none',
  'bonus',
  'mult',
  'wild',
  'glass',
  'steel',
  'stone',
  'gold',
  'lucky',
] as const;

/**
 * Тип улучшения игральной карты.
 */
export type Enhancement = (typeof ENHANCEMENTS)[number];

/**
 * Издания игральных карт, реликвий и расходников.
 */
export const EDITIONS = ['base', 'foil', 'holo', 'polychrome', 'negative'] as const;

/**
 * Тип издания карты или реликвии.
 */
export type Edition = (typeof EDITIONS)[number];

/**
 * Печати на игральных картах (4 вида + отсутствие печати).
 */
export const SEALS = ['none', 'gold', 'red', 'blue', 'purple'] as const;

/**
 * Тип печати на игральной карте.
 */
export type Seal = (typeof SEALS)[number];

/**
 * Ориентация лицевой или обратной стороны карты.
 */
export type CardFacing = 'front' | 'back';

/**
 * Экземпляр игральной карты в колоде забега.
 */
export interface PlayingCard {
  readonly id: string;
  readonly suit: Suit;
  readonly rank: Rank;
  readonly enhancement: Enhancement;
  readonly edition: Edition;
  readonly seal: Seal;
  readonly bonusChips: number;
  readonly permaBonus: number;
  readonly debuffed: boolean;
  readonly playedThisAnte: boolean;
  readonly facing: CardFacing;
  readonly forcedSelection: boolean;
}

/**
 * Канонические внутренние ключи 12 раскладов от старшего к младшему (не являются строками UI).
 */
export const HAND_TYPES = [
  'Flush Five',
  'Flush House',
  'Five of a Kind',
  'Straight Flush',
  'Four of a Kind',
  'Full House',
  'Flush',
  'Straight',
  'Three of a Kind',
  'Two Pair',
  'Pair',
  'High Card',
] as const;

/**
 * Идентификатор расклада (покерной комбинации в движке).
 */
export type HandType = (typeof HAND_TYPES)[number];

/**
 * Текущее состояние прокачки конкретного расклада в рамках забега.
 */
export interface HandLevelState {
  readonly level: number;
  readonly chips: number;
  readonly mult: number;
  readonly playedCount: number;
  readonly visible: boolean;
}

/**
 * Результат оценки выбранной/сыгранной комбинации карт.
 */
export interface HandEvaluationResult {
  readonly handType: HandType;
  readonly scoringCards: readonly PlayingCard[];
  readonly scoringCardIds: readonly string[];
  readonly containedHands: Readonly<Record<HandType, boolean>>;
  readonly isRoyal?: boolean;
}

/**
 * Редкость Реликвии: 1 (Обычная R1), 2 (Необычная R2), 3 (Редкая R3).
 */
export type RelicRarity = 1 | 2 | 3;

/**
 * Полный список из 40 идентификаторов Реликвий версии v1.0.
 */
export const RELIC_IDS = [
  // R1 (18)
  'j_joker',
  'j_greedy_joker',
  'j_lusty_joker',
  'j_wrathful_joker',
  'j_gluttenous_joker',
  'j_jolly',
  'j_sly',
  'j_half',
  'j_abstract',
  'j_banner',
  'j_mystic_summit',
  'j_scary_face',
  'j_even_steven',
  'j_odd_todd',
  'j_runner',
  'j_green_joker',
  'j_photograph',
  'j_golden',
  // R2 (16)
  'j_flash',
  'j_trousers',
  'j_ceremonial',
  'j_blackboard',
  'j_card_sharp',
  'j_acrobat',
  'j_constellation',
  'j_hologram',
  'j_vampire',
  'j_ramen',
  'j_stencil',
  'j_sock_and_buskin',
  'j_mime',
  'j_four_fingers',
  'j_shortcut',
  'j_bull',
  // R3 (6)
  'j_duo',
  'j_tribe',
  'j_baron',
  'j_blueprint',
  'j_brainstorm',
  'j_vagabond',
] as const;

/**
 * Идентификатор Реликвии.
 */
export type RelicId = (typeof RELIC_IDS)[number];

/**
 * Накопительные числовые счётчики экземпляра Реликвии.
 */
export interface RelicStateCounters {
  readonly chips: number;
  readonly mult: number;
  readonly xMult: number;
  readonly extra?: Readonly<Record<string, number | string | boolean>>;
}

/**
 * Экземпляр Реликвии в инвентаре игрока или в предложении магазина/бустера.
 */
export interface RelicInstance {
  readonly uid: string;
  readonly id: RelicId;
  readonly edition: Edition;
  readonly baseCost: number;
  readonly sellValue: number;
  readonly extraValue: number;
  readonly debuffed: boolean;
  readonly state: RelicStateCounters;
}

/**
 * Декларативные точки перехвата (хуки) жизненного цикла Реликвий.
 */
export const RELIC_HOOK_NAMES = [
  'onBlindSelect',
  'onPreDiscard',
  'onDiscard',
  'onBeforeScore',
  'onDebuffedHand',
  'onScoreCard',
  'onScoreCardRepetition',
  'onHoldCard',
  'onHoldCardRepetition',
  'onScoreRelic',
  'onAfterScore',
  'onRoundEnd',
  'onShopReroll',
  'onCardAdded',
  'onRemovePlayingCards',
  'onUseConsumable',
] as const;

/**
 * Имя хука Реликвии.
 */
export type RelicHookName = (typeof RELIC_HOOK_NAMES)[number];

/**
 * Общая часть контекста вызова хука Реликвии с явным разделением источника способности и владельца слота.
 */
export interface RelicHookContextBase {
  readonly state: RunState;
  /** Реликвия, чей эффект выполняется в данный момент (цель копирования для Blueprint/Brainstorm). */
  readonly effectRelic: RelicInstance;
  /** Реликвия-владелец текущего слота (сами Blueprint/Brainstorm или сама Реликвия при прямом вызове). */
  readonly stateRelic: RelicInstance;
  readonly relicIndex: number;
  readonly isBlueprintCopy: boolean;
}

/**
 * Размеченное объединение декларативных контекстов всех 12 хуков Реликвий.
 */
export type RelicHookContext =
  | (RelicHookContextBase & {
      readonly hook: 'onBlindSelect';
      readonly blind: BlindSlotState;
    })
  | (RelicHookContextBase & {
      readonly hook: 'onPreDiscard';
      readonly fullHand: readonly PlayingCard[];
      readonly isHookDiscard: boolean;
    })
  | (RelicHookContextBase & {
      readonly hook: 'onDiscard';
      readonly discardedCards: readonly PlayingCard[];
      readonly card?: PlayingCard;
      readonly cardIndex?: number;
      readonly isLastDiscardedCard?: boolean;
      readonly isHookDiscard?: boolean;
    })
  | (RelicHookContextBase & {
      readonly hook: 'onBeforeScore';
      readonly playedCards: readonly PlayingCard[];
      readonly scoringCards: readonly PlayingCard[];
      readonly handCards: readonly PlayingCard[];
      readonly handEvaluation: HandEvaluationResult;
    })
  | (RelicHookContextBase & {
      readonly hook: 'onDebuffedHand';
      readonly playedCards: readonly PlayingCard[];
      readonly scoringCards: readonly PlayingCard[];
      readonly handEvaluation: HandEvaluationResult;
    })
  | (RelicHookContextBase & {
      readonly hook: 'onScoreCard';
      readonly card: PlayingCard;
      readonly playedCards: readonly PlayingCard[];
      readonly scoringCards: readonly PlayingCard[];
      readonly handEvaluation: HandEvaluationResult;
      readonly isFirstScoringFaceCard?: boolean;
    })
  | (RelicHookContextBase & {
      readonly hook: 'onScoreCardRepetition';
      readonly card: PlayingCard;
      readonly playedCards: readonly PlayingCard[];
      readonly scoringCards: readonly PlayingCard[];
      readonly handEvaluation: HandEvaluationResult;
    })
  | (RelicHookContextBase & {
      readonly hook: 'onHoldCard';
      readonly card: PlayingCard;
      readonly handCards: readonly PlayingCard[];
      readonly handEvaluation: HandEvaluationResult;
    })
  | (RelicHookContextBase & {
      readonly hook: 'onHoldCardRepetition';
      readonly card: PlayingCard;
      readonly handCards: readonly PlayingCard[];
      readonly handEvaluation?: HandEvaluationResult;
      readonly phase: 'scoring' | 'roundEnd';
    })
  | (RelicHookContextBase & {
      readonly hook: 'onScoreRelic';
      readonly playedCards: readonly PlayingCard[];
      readonly scoringCards: readonly PlayingCard[];
      readonly handCards: readonly PlayingCard[];
      readonly handEvaluation: HandEvaluationResult;
      /** Золото игрока до зачисления буфера текущей руки (для проверки `j_vagabond`). */
      readonly dollarsBeforeBuffer?: number;
      /** Золото, накопленное в текущем розыгрыше руки до финального зачисления (для `j_bull`). */
      readonly dollarBuffer?: number;
    })
  | (RelicHookContextBase & {
      readonly hook: 'onAfterScore';
      readonly playedCards: readonly PlayingCard[];
      readonly scoringCards: readonly PlayingCard[];
      readonly handEvaluation: HandEvaluationResult;
    })
  | (RelicHookContextBase & {
      readonly hook: 'onRoundEnd';
      readonly blind: BlindSlotState;
      readonly won: boolean;
    })
  | (RelicHookContextBase & {
      readonly hook: 'onShopReroll';
      readonly rerollCost: number;
    })
  | (RelicHookContextBase & {
      readonly hook: 'onCardAdded';
      readonly addedCards: readonly PlayingCard[];
    })
  | (RelicHookContextBase & {
      readonly hook: 'onRemovePlayingCards';
      readonly removedCards: readonly PlayingCard[];
    })
  | (RelicHookContextBase & {
      readonly hook: 'onUseConsumable';
      readonly consumable: ConsumableInstance;
    });

/**
 * Вспомогательный тип для извлечения точного контекста конкретного хука по его имени.
 */
export type RelicHookContextFor<H extends RelicHookName> = Extract<RelicHookContext, { hook: H }>;

/**
 * Декларативный результат выполнения хука Реликвии.
 */
export interface RelicEffectResult {
  readonly chipsDelta?: number;
  readonly multDelta?: number;
  readonly xMult?: number;
  readonly dollarsDelta?: number;
  readonly retriggerDelta?: number;
  readonly updatedEffectState?: RelicStateCounters;
  readonly destroySelf?: boolean;
  readonly destroyRightRelic?: boolean;
  readonly destroyedRelicUid?: string;
  readonly stripCardEnhancement?: boolean;
  readonly strippedCardIds?: readonly string[];
  readonly removeCard?: boolean;
  readonly createConsumableKind?: ConsumableKind;
  readonly locKey?: string;
  readonly locParams?: Readonly<Record<string, string | number>>;
}

/**
 * Чистый обработчик конкретного хука Реликвии.
 */
export type RelicHookHandler<H extends RelicHookName = RelicHookName> = (
  ctx: RelicHookContextFor<H>,
) => RelicEffectResult | null | undefined;

/**
 * Набор обработчиков хуков, привязанных к конкретной Реликвии.
 */
export type RelicHookMap = {
  readonly [H in RelicHookName]?: RelicHookHandler<H>;
};

/**
 * Декларативное описание Реликвии в реестре движка (конфиг, совместимость и хуки).
 */
export interface RelicDefinition {
  readonly id: RelicId;
  readonly rarity: RelicRarity;
  readonly baseCost: number;
  readonly blueprintCompat: boolean;
  readonly perishableCompat: boolean;
  readonly eternalCompat: boolean;
  readonly initialState: RelicStateCounters;
  readonly hooks: RelicHookMap;
}

/**
 * Функция поиска описания Реликвии по её идентификатору (для развязки модулей scoring и relics).
 */
export type RelicRegistryLookup = (id: RelicId) => RelicDefinition | undefined;

/**
 * Категории расходников: Астральные сферы, Алхимические свитки, Эфирные руны.
 */
export const CONSUMABLE_KINDS = ['celestial', 'scroll', 'rune'] as const;

/**
 * Категория расходника.
 */
export type ConsumableKind = (typeof CONSUMABLE_KINDS)[number];

/**
 * Идентификаторы 12 Астральных сфер (включая 3 скрытых расклада).
 */
export const CELESTIAL_IDS = [
  'c_mercury',
  'c_venus',
  'c_earth',
  'c_mars',
  'c_jupiter',
  'c_saturn',
  'c_uranus',
  'c_neptune',
  'c_pluto',
  'c_planet_x',
  'c_ceres',
  'c_eris',
] as const;

/**
 * Идентификатор Астральной сферы.
 */
export type CelestialId = (typeof CELESTIAL_IDS)[number];

/**
 * Идентификаторы 16 Алхимических свитков.
 */
export const SCROLL_IDS = [
  'c_fool',
  'c_magician',
  'c_empress',
  'c_heirophant',
  'c_lovers',
  'c_chariot',
  'c_justice',
  'c_devil',
  'c_tower',
  'c_hermit',
  'c_temperance',
  'c_wheel_of_fortune',
  'c_strength',
  'c_hanged_man',
  'c_death',
  'c_judgement',
] as const;

/**
 * Идентификатор Алхимического свитка.
 */
export type ScrollId = (typeof SCROLL_IDS)[number];

/**
 * Идентификаторы 8 Эфирных рун и ультра-редкой скрытой руны c_black_hole.
 */
export const RUNE_IDS = [
  'c_talisman',
  'c_deja_vu',
  'c_trance',
  'c_medium',
  'c_aura',
  'c_cryptid',
  'c_immolate',
  'c_hex',
  'c_black_hole',
] as const;

/**
 * Идентификатор Эфирной руны.
 */
export type RuneId = (typeof RUNE_IDS)[number];

/**
 * Объединённый идентификатор любого расходника.
 */
export type ConsumableId = CelestialId | ScrollId | RuneId;

/**
 * Экземпляр расходника в слотах игрока, магазине или бустере.
 */
export interface ConsumableInstance {
  readonly uid: string;
  readonly id: ConsumableId;
  readonly kind: ConsumableKind;
  readonly edition: Edition;
  readonly baseCost: number;
  readonly sellValue: number;
}

/**
 * Идентификаторы 12 Гильдейских грамот версии v1.0.
 */
export const CHARTER_IDS = [
  'v_overstock_norm',
  'v_clearance_sale',
  'v_hone',
  'v_reroll_surplus',
  'v_crystal_ball',
  'v_grabber',
  'v_wasteful',
  'v_seed_money',
  'v_paint_brush',
  'v_telescope',
  'v_observatory',
  'v_directors_cut',
] as const;

/**
 * Идентификатор Гильдейской грамоты.
 */
export type CharterId = (typeof CHARTER_IDS)[number];

/**
 * Идентификаторы 10 Знаков пропуска версии v1.0.
 */
export const TAG_IDS = [
  'tag_uncommon',
  'tag_rare',
  'tag_investment',
  'tag_economy',
  'tag_coupon',
  'tag_d_six',
  'tag_double',
  'tag_juggle',
  'tag_charm',
  'tag_skip',
] as const;

/**
 * Идентификатор Знака пропуска.
 */
export type TagId = (typeof TAG_IDS)[number];

/**
 * Идентификаторы 10 Боссов (8 обычных и 2 финальных Showdown-босса).
 */
export const BOSS_IDS = [
  'bl_hook',
  'bl_manacle',
  'bl_psychic',
  'bl_pillar',
  'bl_club',
  'bl_water',
  'bl_wall',
  'bl_flint',
  'bl_final_vessel',
  'bl_final_bell',
] as const;

/**
 * Идентификатор Босса Этапа.
 */
export type BossId = (typeof BOSS_IDS)[number];

/**
 * Идентификаторы 4 стартовых колод версии v1.0.
 */
export const DECK_IDS = ['b_red', 'b_blue', 'b_yellow', 'b_black'] as const;

/**
 * Идентификатор стартовой колоды.
 */
export type DeckId = (typeof DECK_IDS)[number];

/**
 * Категории бустер-наборов.
 */
export const PACK_TYPES = ['arcana', 'celestial', 'standard', 'buffoon', 'spectral'] as const;

/**
 * Тип бустер-набора.
 */
export type PackType = (typeof PACK_TYPES)[number];

/**
 * Размеры бустер-наборов.
 */
export const PACK_SIZES = ['normal', 'jumbo', 'mega'] as const;

/**
 * Размер бустер-набора.
 */
export type PackSize = (typeof PACK_SIZES)[number];

/**
 * Предложение бустер-набора на нижней правой полке магазина.
 */
export interface PackOffer {
  readonly uid: string;
  readonly packId: string;
  readonly type: PackType;
  readonly size: PackSize;
  readonly cost: number;
  readonly baseCost: number;
  readonly totalCards: number;
  readonly chooseCount: number;
  readonly purchased: boolean;
}

/**
 * Типы узлов Этапа: Малый Страж, Старший Страж, Босс Этапа.
 */
export const BLIND_KINDS = ['small', 'big', 'boss'] as const;

/**
 * Разновидность Стража.
 */
export type BlindKind = (typeof BLIND_KINDS)[number];

/**
 * Статус слота Стража на карте текущего Этапа.
 */
export type BlindSlotStatus = 'upcoming' | 'current' | 'defeated' | 'skipped';

/**
 * Состояние одного из 3 Стражей на текущем Этапе.
 */
export interface BlindSlotState {
  readonly kind: BlindKind;
  readonly bossId: BossId | null;
  readonly targetScore: number;
  readonly reward: number;
  readonly status: BlindSlotStatus;
  readonly skipTagId: TagId | null;
}

/**
 * Товар на верхней полке магазина.
 */
export type ShopOffer =
  | {
      readonly uid: string;
      readonly kind: 'relic';
      readonly relic: RelicInstance;
      readonly cost: number;
      readonly baseCost: number;
      readonly sold: boolean;
    }
  | {
      readonly uid: string;
      readonly kind: 'consumable';
      readonly consumable: ConsumableInstance;
      readonly cost: number;
      readonly baseCost: number;
      readonly sold: boolean;
    }
  | {
      readonly uid: string;
      readonly kind: 'card';
      readonly card: PlayingCard;
      readonly cost: number;
      readonly baseCost: number;
      readonly sold: boolean;
    };

/**
 * Предложение Гильдейской грамоты на нижней левой полке магазина.
 */
export interface ShopVoucherOffer {
  readonly uid: string;
  readonly charterId: CharterId;
  readonly cost: number;
  readonly baseCost: number;
  readonly sold: boolean;
}

/**
 * Состояние открытого магазина между раундами.
 */
export interface ShopState {
  readonly offers: readonly ShopOffer[];
  readonly voucher: ShopVoucherOffer | null;
  readonly packs: readonly PackOffer[];
  readonly rerollCost: number;
  readonly tempRerollCost: number | null;
  readonly rerollsUsedThisShop: number;
  /** Использовано ли бесплатное обновление прилавка за просмотр рекламы в этом визите. */
  readonly adRerollUsed?: boolean;
}

/**
 * Один вариант выбора внутри открытого бустер-набора.
 */
export type BoosterChoice =
  | {
      readonly uid: string;
      readonly kind: 'relic';
      readonly relic: RelicInstance;
      readonly picked: boolean;
    }
  | {
      readonly uid: string;
      readonly kind: 'consumable';
      readonly consumable: ConsumableInstance;
      readonly picked: boolean;
    }
  | {
      readonly uid: string;
      readonly kind: 'card';
      readonly card: PlayingCard;
      readonly picked: boolean;
    };

/**
 * Состояние открытого бустер-набора (включая временную руку для Свитков и Рун).
 */
export interface BoosterState {
  readonly packId: string;
  readonly packType: PackType;
  readonly packSize: PackSize;
  readonly choices: readonly BoosterChoice[];
  readonly remainingPicks: number;
  readonly drawnHandCardIds: readonly string[];
  readonly fromTag: boolean;
}

/**
 * Детализация награды за победу над Стражем.
 */
export interface CashoutBreakdown {
  readonly blindReward: number;
  readonly unusedHandsBonus: number;
  readonly interestBonus: number;
  readonly relicBonus: number;
  readonly tagBonus: number;
  readonly totalReward: number;
}

/**
 * Фаза конечного автомата забега.
 */
export type RunPhase =
  | 'deck_select'
  | 'blind_select'
  | 'playing'
  | 'cashout'
  | 'shop'
  | 'booster'
  | 'victory'
  | 'game_over';

/**
 * Накопленная статистика текущего забега.
 */
export interface RunStats {
  readonly bestHandScore: number;
  readonly bestHandType: HandType | null;
  readonly handsPlayed: number;
  readonly cardsPlayed: number;
  readonly discardsUsed: number;
  readonly cardsDiscarded: number;
  readonly cardsPurchased: number;
  readonly rerollsCount: number;
  readonly cardsDestroyed: number;
  readonly dollarsSpent: number;
}

/** Режим автоматической и ручной сортировки карт в руке. */
export type HandSortMode = 'rank' | 'suit';

/**
 * Полное детерминированное состояние активного забега.
 */
export interface RunState {
  readonly version: number;
  readonly seed: string;
  readonly rngState: RngState;
  readonly deckId: DeckId;
  readonly phase: RunPhase;
  readonly previousPhase: RunPhase | null;
  readonly ante: number;
  readonly round: number;
  readonly currentBlindIndex: 0 | 1 | 2;
  readonly anteBlinds: readonly [BlindSlotState, BlindSlotState, BlindSlotState];
  readonly bossUseCounts: Readonly<Partial<Record<BossId, number>>>;
  readonly bossRerollsThisAnte: number;
  readonly activeBossDisabled: boolean;
  readonly savedBossDiscards: number | null;
  readonly endlessMode: boolean;
  readonly probabilitiesNormal: number;
  readonly anteScaling: number;
  readonly score: number;
  readonly targetScore: number;
  readonly dollars: number;
  /** Нижний кредитный порог баланса (по умолчанию 0, может быть отрицательным). */
  readonly bankruptAt?: number;
  readonly handsLeft: number;
  readonly maxHands: number;
  readonly discardsLeft: number;
  readonly maxDiscards: number;
  readonly handSize: number;
  readonly tempHandSizeBonus: number;
  readonly maxRelics: number;
  readonly maxConsumables: number;
  readonly baseRerollCost: number;
  readonly interestCap: number;
  readonly shopSlots: number;
  readonly discountPercent: number;
  readonly editionRate: number;
  readonly deck: readonly PlayingCard[];
  readonly drawPileIds: readonly string[];
  readonly handIds: readonly string[];
  /** Текущий активный режим сортировки карт в руке. */
  readonly handSortMode?: HandSortMode;
  readonly discardPileIds: readonly string[];
  readonly relics: readonly RelicInstance[];
  readonly consumables: readonly ConsumableInstance[];
  readonly charters: readonly CharterId[];
  readonly pendingTags: readonly TagId[];
  readonly skipsCount: number;
  readonly handsPlayedThisRound: Readonly<Partial<Record<HandType, number>>>;
  readonly handLevels: Readonly<Record<HandType, HandLevelState>>;
  readonly lastUsedConsumableId: ScrollId | CelestialId | null;
  readonly lastPlayedHandType: HandType | null;
  readonly shop: ShopState | null;
  readonly shopVisits: number;
  readonly booster: BoosterState | null;
  readonly cashout: CashoutBreakdown | null;
  readonly nextCardUid: number;
  readonly stats: RunStats;
  /** Использован ли «Второй шанс» (+1 рука за рекламу при поражении) в текущем забеге. */
  readonly reviveUsed?: boolean;
}

/**
 * Входные команды пользователя, обрабатываемые чистой функцией диспетчеризации движка.
 */
export type GameCommand =
  | { readonly type: 'START_RUN'; readonly deckId: DeckId; readonly seed: string }
  | { readonly type: 'SELECT_BLIND' }
  | { readonly type: 'SKIP_BLIND' }
  | { readonly type: 'REROLL_BOSS' }
  | { readonly type: 'PLAY_HAND'; readonly cardIds: readonly string[] }
  | { readonly type: 'DISCARD_CARDS'; readonly cardIds: readonly string[] }
  | { readonly type: 'SORT_HAND'; readonly by: 'rank' | 'suit' }
  | { readonly type: 'REORDER_HAND'; readonly cardIds: readonly string[] }
  | { readonly type: 'REORDER_RELICS'; readonly relicUids: readonly string[] }
  | { readonly type: 'REORDER_CONSUMABLES'; readonly consumableUids: readonly string[] }
  | {
      readonly type: 'USE_CONSUMABLE';
      readonly consumableUid: string;
      readonly targetCardIds?: readonly string[];
    }
  | { readonly type: 'SELL_RELIC'; readonly relicUid: string }
  | { readonly type: 'SELL_CONSUMABLE'; readonly consumableUid: string }
  | { readonly type: 'CLAIM_CASHOUT' }
  | {
      readonly type: 'BUY_SHOP_OFFER';
      readonly offerUid: string;
      readonly useImmediately?: boolean;
    }
  | { readonly type: 'BUY_CHARTER' }
  | { readonly type: 'OPEN_PACK'; readonly packUid: string }
  | {
      readonly type: 'PICK_BOOSTER_ITEM';
      readonly choiceUid: string;
      readonly targetCardIds?: readonly string[];
    }
  | { readonly type: 'SKIP_BOOSTER' }
  | { readonly type: 'REROLL_SHOP' }
  | { readonly type: 'FREE_REROLL_SHOP' }
  | { readonly type: 'NEXT_ROUND' }
  | { readonly type: 'CONTINUE_ENDLESS' }
  | { readonly type: 'REVIVE_RUN' };

/**
 * Источник изменения баланса золота для журнала событий.
 */
export type DollarDeltaSource =
  | 'card'
  | 'relic'
  | 'consumable'
  | 'cashout'
  | 'shop'
  | 'tag'
  | 'reroll';

/**
 * События пошагового журнала анимаций и озвучивания (содержат только идентификаторы, числа и locKey).
 */
export type TraceEvent =
  | {
      readonly type: 'CARD_TRIGGER';
      readonly cardId: string;
      readonly retriggerIndex: number;
      readonly chipsDelta?: number;
      readonly multDelta?: number;
      readonly xMult?: number;
      readonly dollarsDelta?: number;
      readonly edition?: Edition;
      readonly enhancement?: Enhancement;
      readonly seal?: Seal;
      readonly isEditionStep?: boolean;
      readonly locKey?: string;
      readonly locParams?: Readonly<Record<string, string | number>>;
    }
  | {
      readonly type: 'HAND_CARD_TRIGGER';
      readonly cardId: string;
      readonly retriggerIndex: number;
      readonly multDelta?: number;
      readonly xMult?: number;
      readonly dollarsDelta?: number;
      readonly createdConsumableId?: ConsumableId;
      readonly locKey?: string;
      readonly locParams?: Readonly<Record<string, string | number>>;
    }
  | {
      readonly type: 'RELIC_TRIGGER';
      readonly relicUid: string;
      readonly relicId: RelicId;
      readonly copiedByUid?: string;
      readonly hook: RelicHookName;
      readonly chipsDelta?: number;
      readonly multDelta?: number;
      readonly xMult?: number;
      readonly dollarsDelta?: number;
      readonly locKey?: string;
      readonly locParams?: Readonly<Record<string, string | number>>;
    }
  | {
      readonly type: 'CONSUMABLE_TRIGGER';
      readonly consumableUid?: string;
      readonly consumableId: ConsumableId;
      readonly handType?: HandType;
      readonly targetCardIds?: readonly string[];
      readonly xMult?: number;
      readonly locKey?: string;
      readonly locParams?: Readonly<Record<string, string | number>>;
    }
  | {
      readonly type: 'SCORE_UPDATE';
      readonly chips: number;
      readonly mult: number;
      readonly handScore: number;
      readonly totalScore: number;
      readonly targetScore: number;
      readonly handType: HandType;
    }
  | {
      readonly type: 'DOLLAR_DELTA';
      readonly delta: number;
      readonly totalDollars: number;
      readonly source: DollarDeltaSource;
    }
  | {
      readonly type: 'CARD_SHATTER';
      readonly cardId: string;
      readonly reason: 'glass' | 'scroll' | 'rune';
    }
  | {
      readonly type: 'CARD_ENHANCEMENT_STRIPPED';
      readonly cardId: string;
      readonly previousEnhancement: Enhancement;
      readonly relicUid: string;
    }
  | {
      readonly type: 'RELIC_DESTROYED';
      readonly relicUid: string;
      readonly relicId: RelicId;
      readonly reason: 'ceremonial' | 'ramen' | 'hex' | 'sold';
    }
  | {
      readonly type: 'CARD_DEBUFFED';
      readonly cardId: string;
      readonly bossId: BossId | null;
      readonly locKey?: string;
    }
  | {
      readonly type: 'HAND_DEBUFFED';
      readonly bossId: BossId;
      readonly handType: HandType;
      readonly locKey: string;
    }
  | {
      readonly type: 'BOSS_TRIGGER';
      readonly bossId: BossId;
      readonly affectedCardIds?: readonly string[];
      readonly locKey: string;
      readonly locParams?: Readonly<Record<string, string | number>>;
    }
  | {
      readonly type: 'TAG_TRIGGER';
      readonly tagId: TagId;
      readonly copiedFromDouble?: boolean;
      readonly locKey: string;
      readonly locParams?: Readonly<Record<string, string | number>>;
    }
  | {
      readonly type: 'HAND_LEVEL_UP';
      readonly handType: HandType;
      readonly newLevel: number;
      readonly chips: number;
      readonly mult: number;
    }
  | {
      readonly type: 'BLIND_DEFEATED';
      readonly ante: number;
      readonly blindKind: BlindKind;
      readonly bossId: BossId | null;
      readonly finalScore: number;
      readonly targetScore: number;
    }
  | {
      readonly type: 'RUN_WON';
      readonly ante: number;
      readonly finalScore: number;
    }
  | {
      readonly type: 'RUN_LOST';
      readonly ante: number;
      readonly blindKind: BlindKind;
      readonly finalScore: number;
      readonly targetScore: number;
    }
  | {
      readonly type: 'PHASE_CHANGED';
      readonly from: RunPhase;
      readonly to: RunPhase;
    };

/**
 * Результат обработки команды движком: новое состояние и очередь событий для визуализации.
 */
export interface DispatchResult {
  readonly nextState: RunState;
  readonly events: readonly TraceEvent[];
}

/**
 * Допустимые множители скорости анимаций очереди событий.
 */
export type AnimationSpeed = 0.5 | 1 | 2 | 4;

/**
 * Режим ретро-CRT эффекта экрана.
 */
export type CrtMode = 'off' | 'light' | 'original';

/**
 * Допустимые режимы цветовой палитры мастей игральных карт.
 */
export const SUIT_PALETTES = ['standard', 'high_contrast'] as const;
export type SuitPalette = (typeof SUIT_PALETTES)[number];
export const DEFAULT_SUIT_PALETTE: SuitPalette = 'standard';

/**
 * Допустимые стили оформления рубашки колоды.
 */
export const CARD_BACK_STYLES = ['default', 'b_red', 'b_blue', 'b_yellow', 'b_black'] as const;
export type CardBackStyle = (typeof CARD_BACK_STYLES)[number];
export const DEFAULT_CARD_BACK_STYLE: CardBackStyle = 'default';

/**
 * Поддерживаемые языки локализации (согласованы с SupportedLang платформенного слоя без прямой зависимости).
 */
export type EngineLang = 'ru' | 'en';

/**
 * Пользовательские настройки игры, хранимые в мета-прогрессе.
 */
export interface GameSettings {
  readonly animationSpeed: AnimationSpeed;
  readonly lang: EngineLang;
  readonly soundEnabled: boolean;
  readonly crtMode: CrtMode;
  readonly musicVolume?: number;
  readonly sfxVolume?: number;
  readonly settingsVersion?: number;
  readonly tutorialCompleted?: boolean;
  readonly tutorialStep?: number;
  /** Был ли уже показан запрос оценки игры (feedback.requestReview). */
  readonly reviewPrompted?: boolean;
  /** Было ли уже показано авто-предложение ярлыка на рабочий стол (shortcut.showPrompt). */
  readonly shortcutPrompted?: boolean;
  /** Цветовая палитра мастей карт (standard | high_contrast). */
  readonly suitPalette?: SuitPalette;
  /** Выбранное оформление рубашки колоды (default | b_red | b_blue | b_yellow | b_black). */
  readonly cardBack?: CardBackStyle;
  /** Включена ли лёгкая тряска сцены при ударах и событиях (по умолчанию true). */
  readonly screenShake?: boolean;
  /** Включён ли ручной режим уменьшения анимаций (по умолчанию false). */
  readonly reducedMotion?: boolean;
}

/**
 * Накопительная статистика аккаунта игрока.
 */
export interface MetaStats {
  readonly runsStarted: number;
  readonly runsWon: number;
  readonly highestAnte: number;
  readonly highestRound: number;
  readonly bestHandScore: number;
  readonly maxDollars: number;
  readonly bestWinStreak: number;
  readonly currentWinStreak: number;
  readonly totalHandsPlayed: number;
  readonly handPlayCounts: Readonly<Partial<Record<HandType, number>>>;
  /** Накопительная сумма потраченного золота за все забеги. */
  readonly totalMoneySpent?: number;
  /** Накопительное число реролов магазина за все забеги. */
  readonly totalShopRerolls?: number;
  /** Накопительное число использованных Астральных сфер за все забеги. */
  readonly totalCelestialsUsed?: number;
  /** Дата (YYYY-MM-DD в UTC) последнего лучшего результата в «Ежедневном заказе». */
  readonly dailyBestDate?: string;
  /** Лучший счёт за день в «Ежедневном заказе». */
  readonly dailyBestScore?: number;
}

/**
 * Компактное битовое представление открытий и просмотренных элементов коллекции для облачного fallback.
 */
export interface CompactCollectionSave {
  readonly d?: string;
  readonly r?: string;
  readonly c?: string;
  readonly v?: string;
  readonly b?: string;
  readonly t?: string;
  readonly m?: string;
  readonly mx?: readonly string[];
  readonly p?: string;
  readonly px?: readonly string[];
  readonly e?: string;
  readonly s?: string;
  readonly sx?: readonly string[];
}

/**
 * Снимок базовых рекордов и счётчик новых открытий на время активного забега.
 */
export interface ActiveRunTracker {
  readonly baselineBestHandScore: number;
  readonly baselineHighestAnte: number;
  readonly baselineHighestRound: number;
  readonly newDiscoveries: number;
}

/**
 * Компактный профиль мета-прогресса игрока (подходит как compactFallback под лимит 4000 байт VK/OK).
 */
export interface MetaSave {
  readonly version: number;
  readonly revision: number;
  readonly updatedAt: number;
  readonly settings: GameSettings;
  readonly unlockedDecks: readonly DeckId[];
  readonly discoveredRelics: readonly RelicId[];
  readonly discoveredConsumables: readonly ConsumableId[];
  readonly discoveredCharters: readonly CharterId[];
  readonly discoveredBosses: readonly BossId[];
  readonly discoveredTags?: readonly TagId[];
  readonly discoveredMonsters?: readonly string[];
  readonly discoveredPacks?: readonly string[];
  readonly discoveredEditions?: readonly Edition[];
  readonly seenCollectionItems?: readonly string[];
  /** Компактное битовое представление коллекции для укладывания в лимит 4000 байт. */
  readonly compactCollection?: CompactCollectionSave;
  readonly stats: MetaStats;
  readonly activeRunTracker?: ActiveRunTracker;
  readonly tutorialCompleted?: boolean;
  readonly tutorialStep?: number;
}

/**
 * Компактный кортеж игральной карты для сериализации RunSnapshot в рамках жёсткого лимита хранилища:
 * [id, suitIndex(0..3), rank(2..14), enhancementIndex(0..8), editionIndex(0..4), sealIndex(0..4), bonusChips, permaBonus, flagsBitmask]
 * где flagsBitmask: бит 0 = debuffed, бит 1 = playedThisAnte, бит 2 = facing === 'back', бит 3 = forcedSelection.
 */
export type CompactCardTuple = readonly [
  id: string,
  suitIndex: 0 | 1 | 2 | 3,
  rank: Rank,
  enhancementIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
  editionIndex: 0 | 1 | 2 | 3 | 4,
  sealIndex: 0 | 1 | 2 | 3 | 4,
  bonusChips: number,
  permaBonus: number,
  flags: number,
];

/**
 * Компактное представление уровня расклада в снимке забега: [level, playedCount, visibleFlag].
 */
export type CompactHandLevelTuple = readonly [level: number, playedCount: number, visible: 0 | 1];

/**
 * Сериализуемый снимок активного забега с компактным кодированием колоды.
 */
export interface RunSnapshot {
  readonly version: number;
  readonly revision: number;
  readonly updatedAt: number;
  readonly seed: string;
  readonly rngState: RngState;
  readonly deckId: DeckId;
  readonly phase: RunPhase;
  readonly previousPhase: RunPhase | null;
  readonly ante: number;
  readonly round: number;
  readonly currentBlindIndex: 0 | 1 | 2;
  readonly anteBlinds: readonly [BlindSlotState, BlindSlotState, BlindSlotState];
  readonly bossUseCounts: Readonly<Partial<Record<BossId, number>>>;
  readonly bossRerollsThisAnte: number;
  readonly activeBossDisabled: boolean;
  readonly savedBossDiscards: number | null;
  readonly endlessMode: boolean;
  readonly probabilitiesNormal: number;
  readonly anteScaling: number;
  readonly score: number;
  readonly targetScore: number;
  readonly dollars: number;
  /** Нижний кредитный порог баланса (по умолчанию 0, может быть отрицательным). */
  readonly bankruptAt?: number;
  readonly handsLeft: number;
  readonly maxHands: number;
  readonly discardsLeft: number;
  readonly maxDiscards: number;
  readonly handSize: number;
  readonly tempHandSizeBonus: number;
  readonly maxRelics: number;
  readonly maxConsumables: number;
  readonly baseRerollCost: number;
  readonly interestCap: number;
  readonly shopSlots: number;
  readonly discountPercent: number;
  readonly editionRate: number;
  readonly compactDeck: readonly CompactCardTuple[];
  readonly drawPileIds: readonly string[];
  readonly handIds: readonly string[];
  readonly handSortMode?: HandSortMode;
  readonly discardPileIds: readonly string[];
  readonly relics: readonly RelicInstance[];
  readonly consumables: readonly ConsumableInstance[];
  readonly charters: readonly CharterId[];
  readonly pendingTags: readonly TagId[];
  readonly skipsCount: number;
  readonly handsPlayedThisRound: Readonly<Partial<Record<HandType, number>>>;
  readonly handLevels: Readonly<Record<HandType, CompactHandLevelTuple>>;
  readonly lastUsedConsumableId: ScrollId | CelestialId | null;
  readonly lastPlayedHandType: HandType | null;
  readonly shop: ShopState | null;
  readonly shopVisits: number;
  readonly booster: BoosterState | null;
  readonly cashout: CashoutBreakdown | null;
  readonly nextCardUid: number;
  readonly stats: RunStats;
  readonly reviveUsed?: boolean;
}

/**
 * Объединённый объект сохранения игры (верхнеуровневые поля revision/updatedAt совместимы с defaultMergeSave и PlatformBridge).
 */
export type PlayerSaveData = {
  readonly revision: number;
  readonly updatedAt: number;
  readonly meta: MetaSave;
  readonly activeRun: RunSnapshot | null;
};
