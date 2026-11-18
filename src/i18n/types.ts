import type {
  BlindKind,
  BossId,
  CelestialId,
  CharterId,
  ConsumableId,
  ConsumableKind,
  DeckId,
  Edition,
  EngineLang,
  Enhancement,
  HandType,
  PackSize,
  PackType,
  Rank,
  RelicId,
  RelicRarity,
  RuneId,
  ScrollId,
  Seal,
  Suit,
  TagId,
} from '../engine/types';

/**
 * Поддерживаемые языки интерфейса Balite (согласованы с EngineLang и SupportedLang).
 */
export type I18nLang = EngineLang;

/**
 * Допустимые значения параметров подстановки в строковые шаблоны.
 */
export type MessageParamValue = string | number;

/**
 * Словарь параметров для подстановки в шаблон локализации.
 */
export type MessageParams = Readonly<Record<string, MessageParamValue>>;

/**
 * Базовая запись каталога (название и описание).
 */
export interface CatalogTextEntry {
  readonly name: string;
  readonly description: string;
}

/**
 * Расширенная запись каталога для сущностей с параметрическим описанием.
 */
export interface ParameterizedCatalogEntry extends CatalogTextEntry {
  readonly descriptionTemplate: string;
}

/**
 * Локализованное представление масти игральной карты.
 */
export interface SuitTextEntry {
  readonly name: string;
  readonly short: string;
  readonly symbol: string;
}

/**
 * Локализованное представление ранга игральной карты.
 */
export interface RankTextEntry {
  readonly name: string;
  readonly short: string;
}

/**
 * Строковый ключ числового ранга от 2 до 14.
 */
export type RankKey = `${Rank}`;

/**
 * Строковый ключ редкости Реликвии (1, 2 или 3).
 */
export type RarityKey = `${RelicRarity}`;

/**
 * Комбинированный ключ бустер-набора (тип и размер).
 */
export type PackCombinationKey = `${PackType}_${PackSize}`;

/**
 * Ключи локализации событий журнала TraceEvent.
 */
export type TraceLocKey =
  | 'card_chips'
  | 'card_mult'
  | 'card_x_mult'
  | 'card_dollars'
  | 'card_retrigger'
  | 'card_debuffed'
  | 'card_shatter_glass'
  | 'card_shatter_scroll'
  | 'card_shatter_rune'
  | 'card_enhancement_stripped'
  | 'hand_card_steel'
  | 'hand_card_gold'
  | 'hand_card_blue_seal'
  | 'hand_card_purple_seal'
  | 'relic_chips'
  | 'relic_mult'
  | 'relic_x_mult'
  | 'relic_dollars'
  | 'relic_upgrade'
  | 'relic_reset'
  | 'relic_destroyed_ceremonial'
  | 'relic_destroyed_ramen'
  | 'relic_destroyed_hex'
  | 'relic_destroyed_sold'
  | 'relic_scroll_created'
  | 'consumable_used'
  | 'consumable_nope'
  | 'consumable_all_hands_up'
  | 'hand_level_up'
  | 'hand_debuffed'
  | 'boss_disabled'
  | 'boss_hook_discard'
  | 'boss_manacle'
  | 'boss_psychic'
  | 'boss_water'
  | 'boss_flint'
  | 'boss_final_bell'
  | 'tag_activated'
  | 'tag_copied'
  | 'tag_fizzled'
  | 'blind_defeated'
  | 'run_won'
  | 'run_lost';

/**
 * Разделы текстов пользовательского интерфейса.
 */
export interface UiDictionary {
  readonly app: {
    readonly title: string;
    readonly subtitle: string;
    readonly portraitHint: string;
  };
  readonly boot: {
    readonly loading: string;
    readonly errorTitle: string;
    readonly errorDesc: string;
    readonly retry: string;
  };
  readonly mainMenu: {
    readonly play: string;
    readonly options: string;
    readonly collection: string;
    readonly comingSoon: string;
    readonly version: string;
  };
  readonly collection: {
    readonly title: string;
    readonly relics: string;
    readonly decks: string;
    readonly vouchers: string;
    readonly consumablesGroup: string;
    readonly scrolls: string;
    readonly celestials: string;
    readonly runes: string;
    readonly enhancements: string;
    readonly seals: string;
    readonly editions: string;
    readonly packs: string;
    readonly tags: string;
    readonly blinds: string;
    readonly back: string;
    readonly pageInfo: string;
    readonly notDiscoveredTitle: string;
    readonly notDiscoveredDesc: string;
    readonly lockedTitle: string;
    readonly enhancementRuleNotice: string;
    readonly anteBaseTitle: string;
    readonly baseScoreTitle: string;
    readonly voucherConditions: {
      readonly spend2500: string;
      readonly reroll50: string;
      readonly use50Celestials: string;
      readonly play250Hands: string;
      readonly earn400Dollars: string;
      readonly defeat10Bosses: string;
    };
  };
  readonly hud: {
    readonly stage: string;
    readonly stageWithMax: string;
    readonly endlessStage: string;
    readonly rankWithMax: string;
    readonly endlessRank: string;
    readonly round: string;
    readonly score: string;
    readonly target: string;
    readonly scoreProgress: string;
    readonly layout: string;
    readonly levelShort: string;
    readonly power: string;
    readonly powerShort: string;
    readonly mult: string;
    readonly multShort: string;
    readonly hands: string;
    readonly discards: string;
    readonly gold: string;
    readonly goldAmount: string;
    readonly relics: string;
    readonly consumables: string;
    readonly slotsCount: string;
    readonly deck: string;
    readonly activeTags: string;
    readonly abilityDisabled: string;
    readonly debuffedBadge: string;
    readonly royalFlush: string;
    readonly previewHint: string;
    readonly shopBannerTitle: string;
    readonly shopBannerSubtitle: string;
    readonly blindSelectBadge: string;
  };
  readonly actions: {
    readonly playHand: string;
    readonly discard: string;
    readonly sort: string;
    readonly sortByRank: string;
    readonly sortBySuit: string;
    readonly deckButton: string;
    readonly handReference: string;
    readonly runInfo: string;
    readonly settings: string;
    readonly info: string;
    readonly sell: string;
    readonly use: string;
    readonly buy: string;
    readonly buyAndUse: string;
    readonly openPack: string;
    readonly moveLeft: string;
    readonly moveRight: string;
    readonly close: string;
    readonly cancel: string;
    readonly confirm: string;
    readonly back: string;
    readonly skip: string;
    readonly battle: string;
    readonly rerollBoss: string;
    readonly claimCashout: string;
    readonly rerollShop: string;
    readonly adRerollShop: string;
    readonly reviveRun: string;
    readonly openLeaderboard: string;
    readonly addShortcut: string;
    readonly shortcutAdded: string;
    readonly nextRound: string;
    readonly skipPack: string;
    readonly pickItem: string;
    readonly startRun: string;
    readonly continueRun: string;
    readonly newRun: string;
    readonly continueEndless: string;
    readonly replaySeed: string;
    readonly playAgain: string;
    readonly toDeckSelect: string;
    readonly copy: string;
    readonly copied: string;
    readonly mainMenu: string;
  };
  readonly selection: {
    readonly upToCards: string;
    readonly exactCards: string;
    readonly singleCard: string;
    readonly mirrorCards: string;
  };
  readonly deckSelect: {
    readonly title: string;
    readonly seedLabel: string;
    readonly randomSeed: string;
    readonly seedPlaceholder: string;
    readonly unlocked: string;
    readonly locked: string;
    readonly unlockHintNext: string;
    readonly unlockHintRemaining: string;
    readonly dailyTitle: string;
    readonly dailyDate: string;
    readonly dailyDeck: string;
    readonly dailyBest: string;
    readonly startDaily: string;
  };
  readonly blindSelect: {
    readonly title: string;
    readonly rankTitle: string;
    readonly chooseNextPrompt: string;
    readonly current: string;
    readonly defeated: string;
    readonly skipped: string;
    readonly upcoming: string;
    readonly minScore: string;
    readonly reward: string;
    readonly target: string;
    readonly orSeparator: string;
    readonly skipButton: string;
    readonly skipWithTag: string;
    readonly showdownBadge: string;
    readonly cannotSkipBoss: string;
    readonly advanceStageTitle: string;
    readonly advanceStageDesc: string;
  };
  readonly cashout: {
    readonly title: string;
    readonly guardianReward: string;
    readonly unusedHands: string;
    readonly interest: string;
    readonly relicBonus: string;
    readonly tagBonus: string;
    readonly total: string;
  };
  readonly shop: {
    readonly title: string;
    readonly shelfTitle: string;
    readonly charterTitle: string;
    readonly packsTitle: string;
    readonly sold: string;
    readonly noSlots: string;
    readonly notEnoughGold: string;
    readonly free: string;
    readonly charterEmpty: string;
    readonly newBadge: string;
  };
  readonly booster: {
    readonly picksLeft: string;
    readonly choosePattern: string;
    readonly handCardsTitle: string;
  };
  readonly settings: {
    readonly title: string;
    readonly hubTitle: string;
    readonly hubSettings: string;
    readonly hubStats: string;
    readonly hubCustomizeDeck: string;
    readonly hubCredits: string;
    readonly hubMainMenu: string;
    readonly animationSpeed: string;
    readonly speed05x: string;
    readonly speed1x: string;
    readonly speed2x: string;
    readonly speed4x: string;
    readonly sound: string;
    readonly soundOn: string;
    readonly soundOff: string;
    readonly musicVolume: string;
    readonly sfxVolume: string;
    readonly language: string;
    readonly langRu: string;
    readonly langEn: string;
    readonly crtMode: string;
    readonly crtOff: string;
    readonly crtLight: string;
    readonly crtOriginal: string;
    readonly resetTutorial: string;
    readonly suitPalette: string;
    readonly suitPaletteStandard: string;
    readonly suitPaletteHighContrast: string;
    readonly suitPaletteDescStandard: string;
    readonly suitPaletteDescHighContrast: string;
    readonly cardBack: string;
    readonly cardBackDefault: string;
    readonly cardBackRed: string;
    readonly cardBackBlue: string;
    readonly cardBackYellow: string;
    readonly cardBackBlack: string;
    readonly customizePreviewTitle: string;
  };
  readonly stats: {
    readonly title: string;
    readonly bestHand: string;
    readonly highestRound: string;
    readonly highestStage: string;
    readonly mostPlayedHand: string;
    readonly noneHand: string;
    readonly maxGold: string;
    readonly bestWinStreak: string;
    readonly runsStartedWon: string;
    readonly discoveryProgress: string;
    readonly dailyBest: string;
  };
  readonly credits: {
    readonly title: string;
    readonly version: string;
    readonly settingLine: string;
    readonly engineLine: string;
    readonly audioLine: string;
    readonly fontLine: string;
    readonly complianceLine: string;
    readonly supportLabel: string;
    readonly supportText: string;
  };
  readonly handReference: {
    readonly title: string;
    readonly level: string;
    readonly played: string;
    readonly baseFormula: string;
    readonly hiddenLayout: string;
  };
  readonly runInfo: {
    readonly title: string;
    readonly tabs: {
      readonly hands: string;
      readonly blinds: string;
      readonly vouchers: string;
    };
    readonly blinds: {
      readonly defeated: string;
      readonly current: string;
      readonly upcoming: string;
      readonly skipped: string;
      readonly minScore: string;
      readonly reward: string;
      readonly skipReward: string;
      readonly bossCannotSkip: string;
    };
    readonly vouchers: {
      readonly empty: string;
      readonly title: string;
    };
    readonly backButton: string;
    readonly handRules: Readonly<Record<HandType, string>>;
  };
  readonly deckModal: {
    readonly title: string;
    readonly remainingTab: string;
    readonly fullTab: string;
    readonly baseCardsTitle: string;
    readonly aces: string;
    readonly faces: string;
    readonly numbers: string;
    readonly rankAce: string;
    readonly rankKing: string;
    readonly rankQueen: string;
    readonly rankJack: string;
    readonly backButton: string;
    readonly drawPile: string;
    readonly discardPile: string;
    readonly inHand: string;
    readonly totalCards: string;
    readonly playedThisAnteBadge: string;
    readonly playedThisAnteHint: string;
  };
  readonly runEnd: {
    readonly victoryTitle: string;
    readonly victorySubtitle: string;
    readonly defeatTitle: string;
    readonly defeatSubtitle: string;
    readonly bestHandScore: string;
    readonly handsPlayed: string;
    readonly discardsUsed: string;
    readonly cardsDestroyed: string;
    readonly dollarsSpent: string;
    readonly finalStage: string;
    readonly finalRound: string;
    readonly runSeed: string;
    readonly mostPlayedHand: string;
    readonly cardsPlayed: string;
    readonly cardsDiscarded: string;
    readonly cardsPurchased: string;
    readonly rerollsCount: string;
    readonly newDiscoveries: string;
    readonly defeatedBy: string;
    readonly clearedGuardian: string;
    readonly newRecordBadge: string;
    readonly revivedBadge: string;
    readonly dailyRunBadge: string;
    readonly none: string;
  };
  readonly tooltip: {
    readonly hiddenTitle: string;
    readonly hiddenSubtitle: string;
    readonly hiddenDescription: string;
  };
}

export interface AnteMonsterEntry {
  readonly small: CatalogTextEntry;
  readonly big: CatalogTextEntry;
}

/**
 * Полный словарь локализации для одного языка (1:1 между ru и en).
 */
export interface LocaleDictionary {
  readonly ui: UiDictionary;
  readonly hands: Readonly<Record<HandType, CatalogTextEntry>>;
  readonly relics: Readonly<Record<RelicId, CatalogTextEntry>>;
  readonly celestials: Readonly<Record<CelestialId, CatalogTextEntry>>;
  readonly scrolls: Readonly<Record<ScrollId, CatalogTextEntry>>;
  readonly runes: Readonly<Record<RuneId, CatalogTextEntry>>;
  readonly charters: Readonly<Record<CharterId, CatalogTextEntry>>;
  readonly tags: Readonly<Record<TagId, CatalogTextEntry>>;
  readonly bosses: Readonly<Record<BossId, CatalogTextEntry>>;
  readonly blinds: Readonly<Record<BlindKind, CatalogTextEntry>>;
  readonly anteMonsters?: Readonly<Record<number, AnteMonsterEntry>>;
  readonly decks: Readonly<Record<DeckId, CatalogTextEntry>>;
  readonly enhancements: Readonly<Record<Enhancement, CatalogTextEntry>>;
  readonly editions: Readonly<Record<Edition, CatalogTextEntry>>;
  readonly seals: Readonly<Record<Seal, CatalogTextEntry>>;
  readonly packTypes: Readonly<Record<PackType, CatalogTextEntry>>;
  readonly packSizes: Readonly<Record<PackSize, CatalogTextEntry>>;
  readonly packs: Readonly<Record<PackCombinationKey, string>>;
  readonly suits: Readonly<Record<Suit, SuitTextEntry>>;
  readonly ranks: Readonly<Record<RankKey, RankTextEntry>>;
  readonly rarities: Readonly<Record<RarityKey, string>>;
  readonly consumableKinds: Readonly<Record<ConsumableKind, string>>;
  readonly trace: Readonly<Record<TraceLocKey, string>>;
}

/**
 * Вычисляет все точечные пути к строковым листьям словаря.
 */
type LeafDotPath<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string
        ? K
        : `${K}.${LeafDotPath<T[K]>}`;
    }[keyof T & string];

/**
 * Типизированный ключ локализации формата 'раздел.подраздел.ключ'.
 */
export type MessageKey = LeafDotPath<LocaleDictionary>;

/**
 * Итоговый каталог локализованных игровых сущностей, возвращаемый getCatalogTexts.
 */
export interface CatalogTexts {
  readonly hands: Readonly<Record<HandType, CatalogTextEntry>>;
  readonly relics: Readonly<Record<RelicId, ParameterizedCatalogEntry>>;
  readonly celestials: Readonly<Record<CelestialId, ParameterizedCatalogEntry>>;
  readonly scrolls: Readonly<Record<ScrollId, ParameterizedCatalogEntry>>;
  readonly runes: Readonly<Record<RuneId, ParameterizedCatalogEntry>>;
  readonly charters: Readonly<Record<CharterId, ParameterizedCatalogEntry>>;
  readonly tags: Readonly<Record<TagId, ParameterizedCatalogEntry>>;
  readonly bosses: Readonly<Record<BossId, ParameterizedCatalogEntry>>;
  readonly blinds: Readonly<Record<BlindKind, CatalogTextEntry>>;
  readonly anteMonsters?: Readonly<Record<number, AnteMonsterEntry>>;
  readonly decks: Readonly<Record<DeckId, ParameterizedCatalogEntry>>;
  readonly enhancements: Readonly<Record<Enhancement, CatalogTextEntry>>;
  readonly editions: Readonly<Record<Edition, CatalogTextEntry>>;
  readonly seals: Readonly<Record<Seal, CatalogTextEntry>>;
  readonly packTypes: Readonly<Record<PackType, CatalogTextEntry>>;
  readonly packSizes: Readonly<Record<PackSize, CatalogTextEntry>>;
  readonly packs: Readonly<Record<PackCombinationKey, string>>;
  readonly suits: Readonly<Record<Suit, SuitTextEntry>>;
  readonly ranks: Readonly<Record<RankKey, RankTextEntry>>;
  readonly rarities: Readonly<Record<RarityKey, string>>;
  readonly consumableKinds: Readonly<Record<ConsumableKind, string>>;
}

/**
 * Экземпляр переводчика, привязанный к выбранному языку.
 */
export interface Translator {
  readonly lang: I18nLang;
  readonly catalog: CatalogTexts;
  t(key: MessageKey | (string & {}), params?: MessageParams): string;
  getHandText(handType: HandType): CatalogTextEntry;
  getRelicText(relicId: RelicId, params?: MessageParams): ParameterizedCatalogEntry;
  getConsumableText(id: ConsumableId, params?: MessageParams): ParameterizedCatalogEntry;
  getCharterText(id: CharterId, params?: MessageParams): ParameterizedCatalogEntry;
  getTagText(id: TagId, params?: MessageParams): ParameterizedCatalogEntry;
  getBossText(id: BossId, params?: MessageParams): ParameterizedCatalogEntry;
  getDeckText(id: DeckId, params?: MessageParams): ParameterizedCatalogEntry;
  getBlindText(kind: BlindKind, bossId?: BossId | null, ante?: number): CatalogTextEntry;
  getPackTitle(type: PackType, size: PackSize): string;
  getPackSubtitle(chooseCount: number, totalCards: number): string;
  getRankLabel(rank: Rank, short?: boolean): string;
  getSuitLabel(suit: Suit, short?: boolean): string;
}
