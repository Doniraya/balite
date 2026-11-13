import { getHandLevelStats } from './handEval';
import { RNG_STREAM_NAMES, type RngState, type RngStreamName } from './prng';
import {
  BLIND_KINDS,
  BOSS_IDS,
  CELESTIAL_IDS,
  CHARTER_IDS,
  CONSUMABLE_KINDS,
  DECK_IDS,
  EDITIONS,
  ENHANCEMENTS,
  HAND_TYPES,
  PACK_SIZES,
  PACK_TYPES,
  RANKS,
  RELIC_IDS,
  RUNE_IDS,
  SCROLL_IDS,
  SEALS,
  SUITS,
  TAG_IDS,
  type ActiveRunTracker,
  type AnimationSpeed,
  type BlindKind,
  type BlindSlotState,
  type BlindSlotStatus,
  type BoosterChoice,
  type BoosterState,
  type BossId,
  type CardFacing,
  type CashoutBreakdown,
  type CelestialId,
  type CharterId,
  type CompactCardTuple,
  type CompactHandLevelTuple,
  type ConsumableId,
  type ConsumableInstance,
  type ConsumableKind,
  type CrtMode,
  type DeckId,
  type Edition,
  type EngineLang,
  type Enhancement,
  type GameSettings,
  type HandLevelState,
  type HandType,
  type MetaSave,
  type MetaStats,
  type PackOffer,
  type PackSize,
  type PackType,
  type PlayerSaveData,
  type PlayingCard,
  type Rank,
  type RelicId,
  type RelicInstance,
  type RelicStateCounters,
  type RunPhase,
  type RunSnapshot,
  type RunState,
  type RunStats,
  type RuneId,
  type ScrollId,
  type Seal,
  type ShopOffer,
  type ShopState,
  type ShopVoucherOffer,
  type Suit,
  type TagId,
} from './types';

/**
 * Текущая версия схемы сериализации сохранений Balite.
 */
export const SAVE_SCHEMA_VERSION = 1;

/**
 * Текущая версия схемы пользовательских настроек (v2 — скорость по умолчанию 1x).
 */
export const SETTINGS_SCHEMA_VERSION = 2;

/**
 * Скорость анимаций по умолчанию.
 */
export const DEFAULT_ANIMATION_SPEED: AnimationSpeed = 1;

/**
 * Режим CRT-эффекта по умолчанию (лёгкий комфортный режим).
 */
export const DEFAULT_CRT_MODE: CrtMode = 'light';

const CARD_FLAG_DEBUFFED = 1 << 0;
const CARD_FLAG_PLAYED_THIS_ANTE = 1 << 1;
const CARD_FLAG_FACING_BACK = 1 << 2;
const CARD_FLAG_FORCED_SELECTION = 1 << 3;

const SUIT_SET: ReadonlySet<Suit> = new Set(SUITS);
const RANK_SET: ReadonlySet<Rank> = new Set(RANKS);
const ENHANCEMENT_SET: ReadonlySet<Enhancement> = new Set(ENHANCEMENTS);
const EDITION_SET: ReadonlySet<Edition> = new Set(EDITIONS);
const SEAL_SET: ReadonlySet<Seal> = new Set(SEALS);
const DECK_SET: ReadonlySet<DeckId> = new Set(DECK_IDS);
const RELIC_SET: ReadonlySet<RelicId> = new Set(RELIC_IDS);
const CELESTIAL_SET: ReadonlySet<CelestialId> = new Set(CELESTIAL_IDS);
const SCROLL_SET: ReadonlySet<ScrollId> = new Set(SCROLL_IDS);
const RUNE_SET: ReadonlySet<RuneId> = new Set(RUNE_IDS);
const CHARTER_SET: ReadonlySet<CharterId> = new Set(CHARTER_IDS);
const TAG_SET: ReadonlySet<TagId> = new Set(TAG_IDS);
const BOSS_SET: ReadonlySet<BossId> = new Set(BOSS_IDS);
const HAND_TYPE_SET: ReadonlySet<HandType> = new Set(HAND_TYPES);
const BLIND_KIND_SET: ReadonlySet<BlindKind> = new Set(BLIND_KINDS);
const CONSUMABLE_KIND_SET: ReadonlySet<ConsumableKind> = new Set(CONSUMABLE_KINDS);
const PACK_TYPE_SET: ReadonlySet<PackType> = new Set(PACK_TYPES);
const PACK_SIZE_SET: ReadonlySet<PackSize> = new Set(PACK_SIZES);
const RUN_PHASE_SET: ReadonlySet<RunPhase> = new Set([
  'deck_select',
  'blind_select',
  'playing',
  'cashout',
  'shop',
  'booster',
  'victory',
  'game_over',
]);
const BLIND_STATUS_SET: ReadonlySet<BlindSlotStatus> = new Set([
  'upcoming',
  'current',
  'defeated',
  'skipped',
]);

const SUIT_INDEX = new Map<Suit, 0 | 1 | 2 | 3>(
  SUITS.map((suit, idx) => [suit, idx as 0 | 1 | 2 | 3]),
);
const ENHANCEMENT_INDEX = new Map<Enhancement, 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(
  ENHANCEMENTS.map((enhancement, idx) => [enhancement, idx as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8]),
);
const EDITION_INDEX = new Map<Edition, 0 | 1 | 2 | 3 | 4>(
  EDITIONS.map((edition, idx) => [edition, idx as 0 | 1 | 2 | 3 | 4]),
);
const SEAL_INDEX = new Map<Seal, 0 | 1 | 2 | 3 | 4>(
  SEALS.map((seal, idx) => [seal, idx as 0 | 1 | 2 | 3 | 4]),
);

/**
 * Опции создания начального профиля мета-прогресса.
 */
export interface CreateInitialMetaSaveOptions {
  readonly lang?: EngineLang;
  readonly animationSpeed?: AnimationSpeed;
  readonly soundEnabled?: boolean;
  readonly crtMode?: CrtMode;
  readonly musicVolume?: number;
  readonly sfxVolume?: number;
  readonly revision?: number;
  readonly unlockedDecks?: readonly DeckId[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeNonNegInt(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function clampUnit(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function sanitizeIdList<T extends string>(raw: unknown, allowed: ReadonlySet<T>): T[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<T>();
  const result: T[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && allowed.has(item as T) && !seen.has(item as T)) {
      seen.add(item as T);
      result.push(item as T);
    }
  }
  return result;
}

function mergeUniqueIds<T extends string>(primary: readonly T[], secondary: readonly T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const item of primary) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  for (const item of secondary) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

function isValidAnimationSpeed(value: unknown): value is AnimationSpeed {
  return value === 0.5 || value === 1 || value === 2 || value === 4;
}

function isValidCrtMode(value: unknown): value is CrtMode {
  return value === 'off' || value === 'light' || value === 'original';
}

function sanitizeSettings(
  raw: unknown,
  options: { readonly preserveLegacyDoubleSpeed?: boolean } = {},
): GameSettings {
  const rec = isRecord(raw) ? raw : {};
  const rawSettingsVersion =
    typeof rec.settingsVersion === 'number' &&
    Number.isFinite(rec.settingsVersion) &&
    rec.settingsVersion >= 1
      ? Math.floor(rec.settingsVersion)
      : 1;
  const isLegacySettings =
    !options.preserveLegacyDoubleSpeed && rawSettingsVersion < SETTINGS_SCHEMA_VERSION;

  // При миграции старых сохранений v1 дефолтная скорость 2x переводится на 1x,
  // а явный выбор игрока (0.5x / 1x / 4x) и новые сохранения (v2+) сохраняются.
  let animationSpeed: AnimationSpeed = DEFAULT_ANIMATION_SPEED;
  if (isValidAnimationSpeed(rec.animationSpeed)) {
    animationSpeed =
      isLegacySettings && rec.animationSpeed === 2
        ? DEFAULT_ANIMATION_SPEED
        : rec.animationSpeed;
  }

  const lang: EngineLang = rec.lang === 'en' ? 'en' : 'ru';
  const soundEnabled = typeof rec.soundEnabled === 'boolean' ? rec.soundEnabled : true;
  const crtMode: CrtMode = isValidCrtMode(rec.crtMode) ? rec.crtMode : DEFAULT_CRT_MODE;

  const musicVolume =
    typeof rec.musicVolume === 'number' && Number.isFinite(rec.musicVolume)
      ? clampUnit(rec.musicVolume)
      : undefined;
  const sfxVolume =
    typeof rec.sfxVolume === 'number' && Number.isFinite(rec.sfxVolume)
      ? clampUnit(rec.sfxVolume)
      : undefined;

  return {
    animationSpeed,
    lang,
    soundEnabled,
    crtMode,
    ...(musicVolume !== undefined ? { musicVolume } : {}),
    ...(sfxVolume !== undefined ? { sfxVolume } : {}),
    settingsVersion: SETTINGS_SCHEMA_VERSION,
  };
}

function sanitizeHandPlayCounts(raw: unknown): Partial<Record<HandType, number>> {
  if (!isRecord(raw)) return {};
  const counts: Partial<Record<HandType, number>> = {};
  for (const handType of HAND_TYPES) {
    const val = raw[handType];
    if (typeof val === 'number' && Number.isFinite(val) && val >= 1) {
      counts[handType] = Math.floor(val);
    }
  }
  return counts;
}

function mergeHandPlayCounts(
  primary: Readonly<Partial<Record<HandType, number>>>,
  secondary: Readonly<Partial<Record<HandType, number>>>,
): Partial<Record<HandType, number>> {
  const merged: Partial<Record<HandType, number>> = {};
  for (const handType of HAND_TYPES) {
    const a = sanitizeNonNegInt(primary[handType], 0);
    const b = sanitizeNonNegInt(secondary[handType], 0);
    const maxCount = Math.max(a, b);
    if (maxCount > 0) {
      merged[handType] = maxCount;
    }
  }
  return merged;
}

function sanitizeMetaStats(raw: unknown): MetaStats {
  const rec = isRecord(raw) ? raw : {};
  const currentWinStreak = sanitizeNonNegInt(rec.currentWinStreak, 0);
  const bestWinStreak = Math.max(sanitizeNonNegInt(rec.bestWinStreak, 0), currentWinStreak);

  return {
    runsStarted: sanitizeNonNegInt(rec.runsStarted, 0),
    runsWon: sanitizeNonNegInt(rec.runsWon, 0),
    highestAnte: sanitizeNonNegInt(rec.highestAnte, 0),
    highestRound: sanitizeNonNegInt(rec.highestRound, 0),
    bestHandScore:
      typeof rec.bestHandScore === 'number' &&
      Number.isFinite(rec.bestHandScore) &&
      rec.bestHandScore >= 0
        ? rec.bestHandScore
        : 0,
    maxDollars: sanitizeNonNegInt(rec.maxDollars, 0),
    bestWinStreak,
    currentWinStreak,
    totalHandsPlayed: sanitizeNonNegInt(rec.totalHandsPlayed, 0),
    handPlayCounts: sanitizeHandPlayCounts(rec.handPlayCounts),
  };
}

/**
 * Флаги дискретных событий для обновления накопительной статистики игрока.
 */
export interface UpdateMetaStatsFlags {
  readonly runStarted?: boolean;
  readonly handPlayed?: boolean;
  readonly playedHandType?: HandType | null;
  readonly runWon?: boolean;
  readonly runLost?: boolean;
}

/**
 * Обновляет накопительную мета-статистику игрока по состоянию забега и флагам события.
 */
export function updateMetaStatsFromRunState(
  prevStats: MetaStats,
  state: RunState,
  flags: UpdateMetaStatsFlags = {},
): MetaStats {
  const base = sanitizeMetaStats(prevStats);
  const nextCounts = { ...base.handPlayCounts };

  const handType =
    flags.playedHandType !== undefined
      ? flags.playedHandType
      : flags.handPlayed
        ? state.lastPlayedHandType
        : null;
  if (handType && HAND_TYPE_SET.has(handType)) {
    nextCounts[handType] = (nextCounts[handType] ?? 0) + 1;
  }

  let currentWinStreak = base.currentWinStreak;
  if (flags.runWon) {
    currentWinStreak += 1;
  } else if (flags.runLost && !state.endlessMode) {
    // Проигрыш в бесконечном режиме после победы на 8-м Этапе не прерывает серию побед
    currentWinStreak = 0;
  }
  const bestWinStreak = Math.max(base.bestWinStreak, currentWinStreak);

  const runBestHandScore =
    typeof state.stats.bestHandScore === 'number' &&
    Number.isFinite(state.stats.bestHandScore) &&
    state.stats.bestHandScore >= 0
      ? state.stats.bestHandScore
      : 0;

  return {
    runsStarted: base.runsStarted + (flags.runStarted ? 1 : 0),
    runsWon: base.runsWon + (flags.runWon ? 1 : 0),
    highestAnte: Math.max(base.highestAnte, sanitizeNonNegInt(state.ante, 0)),
    highestRound: Math.max(base.highestRound, sanitizeNonNegInt(state.round, 0)),
    bestHandScore: Math.max(base.bestHandScore, runBestHandScore),
    maxDollars: Math.max(base.maxDollars, sanitizeNonNegInt(state.dollars, 0)),
    bestWinStreak,
    currentWinStreak,
    totalHandsPlayed: base.totalHandsPlayed + (flags.handPlayed ? 1 : 0),
    handPlayCounts: nextCounts,
  };
}

function pickMostFrequentHand(
  readCount: (handType: HandType) => number,
): { readonly handType: HandType; readonly count: number } | null {
  let bestHand: HandType | null = null;
  let bestCount = 0;

  for (const handType of HAND_TYPES) {
    const rawCount = readCount(handType);
    const count =
      typeof rawCount === 'number' && Number.isFinite(rawCount) && rawCount > 0
        ? Math.floor(rawCount)
        : 0;
    if (count > bestCount) {
      bestCount = count;
      bestHand = handType;
    }
  }

  return bestHand !== null ? { handType: bestHand, count: bestCount } : null;
}

/**
 * Возвращает наиболее часто сыгранный расклад из накопительной статистики (или null, если рук ещё не было).
 */
export function getMostPlayedHand(
  stats: MetaStats,
): { readonly handType: HandType; readonly count: number } | null {
  return pickMostFrequentHand((handType) => stats.handPlayCounts?.[handType] ?? 0);
}

/**
 * Возвращает наиболее часто сыгранный расклад в текущем забеге (или null, если рук ещё не было).
 */
export function getMostPlayedHandInRun(
  state: RunState,
): { readonly handType: HandType; readonly count: number } | null {
  return pickMostFrequentHand((handType) => state.handLevels[handType]?.playedCount ?? 0);
}

/**
 * Подсчитывает общее количество открытых записей коллекции в мета-прогрессе.
 */
export function countMetaDiscoveries(
  meta: Pick<
    MetaSave,
    'discoveredRelics' | 'discoveredConsumables' | 'discoveredCharters' | 'discoveredBosses'
  >,
): number {
  return (
    meta.discoveredRelics.length +
    meta.discoveredConsumables.length +
    meta.discoveredCharters.length +
    meta.discoveredBosses.length
  );
}

/**
 * Создаёт снимок базовых рекордов игрока на момент старта нового забега.
 */
export function createActiveRunTracker(meta: MetaSave): ActiveRunTracker {
  return {
    baselineBestHandScore:
      typeof meta.stats.bestHandScore === 'number' &&
      Number.isFinite(meta.stats.bestHandScore) &&
      meta.stats.bestHandScore >= 0
        ? meta.stats.bestHandScore
        : 0,
    baselineHighestAnte: sanitizeNonNegInt(meta.stats.highestAnte, 0),
    baselineHighestRound: sanitizeNonNegInt(meta.stats.highestRound, 0),
    newDiscoveries: 0,
  };
}

/**
 * Обновляет счётчик новых открытий и базовые пороги рекордов при сохранении хода/события.
 */
export function advanceActiveRunTracker(
  prevMeta: MetaSave,
  nextMeta: MetaSave,
  runStarted = false,
): ActiveRunTracker {
  const discoveryDelta = Math.max(0, countMetaDiscoveries(nextMeta) - countMetaDiscoveries(prevMeta));
  if (runStarted) {
    const baseTracker = createActiveRunTracker(prevMeta);
    return {
      ...baseTracker,
      newDiscoveries: discoveryDelta,
    };
  }

  const baseTracker = prevMeta.activeRunTracker ?? createActiveRunTracker(prevMeta);
  return {
    ...baseTracker,
    newDiscoveries: baseTracker.newDiscoveries + discoveryDelta,
  };
}

/**
 * Сводка итогов завершённого забега для экрана окончания партии.
 */
export interface RunEndSummary {
  readonly outcome: 'victory' | 'game_over';
  readonly seed: string;
  readonly ante: number;
  readonly round: number;
  readonly bestHandScore: number;
  readonly bestHandType: HandType | null;
  readonly mostPlayedHand: { readonly handType: HandType; readonly count: number } | null;
  readonly cardsPlayed: number;
  readonly cardsDiscarded: number;
  readonly cardsPurchased: number;
  readonly rerollsCount: number;
  readonly newDiscoveries: number;
  readonly defeatedBy: {
    readonly kind: BlindKind;
    readonly bossId: BossId | null;
  };
  readonly records: {
    readonly bestHandScore: boolean;
    readonly highestAnte: boolean;
    readonly highestRound: boolean;
  };
}

/**
 * Формирует сводную статистику экрана окончания забега с флагами новых рекордов.
 */
export function getRunEndSummary(
  state: RunState,
  meta?: MetaSave,
  baseline?: Partial<ActiveRunTracker>,
): RunEndSummary {
  const tracker = baseline ?? meta?.activeRunTracker;
  const activeSlot = state.anteBlinds[state.currentBlindIndex] ?? state.anteBlinds[0];

  const baselineBestHandScore =
    tracker && typeof tracker.baselineBestHandScore === 'number' && Number.isFinite(tracker.baselineBestHandScore)
      ? Math.max(0, tracker.baselineBestHandScore)
      : null;
  const baselineHighestAnte =
    tracker && typeof tracker.baselineHighestAnte === 'number' && Number.isFinite(tracker.baselineHighestAnte)
      ? Math.max(0, Math.floor(tracker.baselineHighestAnte))
      : null;
  const baselineHighestRound =
    tracker && typeof tracker.baselineHighestRound === 'number' && Number.isFinite(tracker.baselineHighestRound)
      ? Math.max(0, Math.floor(tracker.baselineHighestRound))
      : null;

  return {
    outcome: state.phase === 'victory' ? 'victory' : 'game_over',
    seed: state.seed,
    ante: state.ante,
    round: state.round,
    bestHandScore: state.stats.bestHandScore,
    bestHandType: state.stats.bestHandType,
    mostPlayedHand: getMostPlayedHandInRun(state),
    cardsPlayed: state.stats.cardsPlayed,
    cardsDiscarded: state.stats.cardsDiscarded,
    cardsPurchased: state.stats.cardsPurchased,
    rerollsCount: state.stats.rerollsCount,
    newDiscoveries: sanitizeNonNegInt(tracker?.newDiscoveries, 0),
    defeatedBy: {
      kind: activeSlot.kind,
      bossId: activeSlot.bossId,
    },
    records: {
      bestHandScore:
        baselineBestHandScore !== null &&
        state.stats.bestHandScore > 0 &&
        state.stats.bestHandScore > baselineBestHandScore,
      highestAnte: baselineHighestAnte !== null && state.ante > baselineHighestAnte,
      highestRound: baselineHighestRound !== null && state.round > baselineHighestRound,
    },
  };
}

function sanitizeActiveRunTracker(raw: unknown): ActiveRunTracker | undefined {
  if (!isRecord(raw)) return undefined;
  const baselineBestHandScore =
    typeof raw.baselineBestHandScore === 'number' &&
    Number.isFinite(raw.baselineBestHandScore) &&
    raw.baselineBestHandScore >= 0
      ? raw.baselineBestHandScore
      : 0;
  return {
    baselineBestHandScore,
    baselineHighestAnte: sanitizeNonNegInt(raw.baselineHighestAnte, 0),
    baselineHighestRound: sanitizeNonNegInt(raw.baselineHighestRound, 0),
    newDiscoveries: sanitizeNonNegInt(raw.newDiscoveries, 0),
  };
}

function cloneMetaSave(meta: MetaSave): MetaSave {
  const activeRunTracker = meta.activeRunTracker
    ? sanitizeActiveRunTracker(meta.activeRunTracker)
    : undefined;
  return {
    version: meta.version,
    revision: meta.revision,
    updatedAt: meta.updatedAt,
    settings: sanitizeSettings(meta.settings, { preserveLegacyDoubleSpeed: true }),
    unlockedDecks: [...meta.unlockedDecks],
    discoveredRelics: [...meta.discoveredRelics],
    discoveredConsumables: [...meta.discoveredConsumables],
    discoveredCharters: [...meta.discoveredCharters],
    discoveredBosses: [...meta.discoveredBosses],
    stats: sanitizeMetaStats(meta.stats),
    ...(activeRunTracker !== undefined ? { activeRunTracker } : {}),
  };
}

function cloneRngState(rngState: RngState): RngState {
  return {
    seed: rngState.seed,
    streams: { ...rngState.streams },
  };
}

function cloneRelic(relic: RelicInstance): RelicInstance {
  const extra = relic.state.extra ? { ...relic.state.extra } : undefined;
  return {
    uid: relic.uid,
    id: relic.id,
    edition: relic.edition,
    baseCost: relic.baseCost,
    sellValue: relic.sellValue,
    extraValue: relic.extraValue,
    debuffed: relic.debuffed,
    state: {
      chips: relic.state.chips,
      mult: relic.state.mult,
      xMult: relic.state.xMult,
      ...(extra !== undefined ? { extra } : {}),
    },
  };
}

function cloneConsumable(consumable: ConsumableInstance): ConsumableInstance {
  return { ...consumable };
}

function clonePlayingCard(card: PlayingCard): PlayingCard {
  return { ...card };
}

type TaggedCatalogPayload =
  | { readonly kind: 'relic'; readonly relic: RelicInstance }
  | { readonly kind: 'consumable'; readonly consumable: ConsumableInstance }
  | { readonly kind: 'card'; readonly card: PlayingCard };

function cloneCatalogPayload(item: TaggedCatalogPayload): TaggedCatalogPayload {
  if (item.kind === 'relic') {
    return { kind: 'relic', relic: cloneRelic(item.relic) };
  }
  if (item.kind === 'consumable') {
    return { kind: 'consumable', consumable: cloneConsumable(item.consumable) };
  }
  return { kind: 'card', card: clonePlayingCard(item.card) };
}

function cloneShopOffer(offer: ShopOffer): ShopOffer {
  return {
    uid: offer.uid,
    cost: offer.cost,
    baseCost: offer.baseCost,
    sold: offer.sold,
    ...cloneCatalogPayload(offer),
  };
}

function cloneShopState(shop: ShopState | null): ShopState | null {
  if (!shop) return null;
  return {
    offers: shop.offers.map(cloneShopOffer),
    voucher: shop.voucher ? { ...shop.voucher } : null,
    packs: shop.packs.map((pack) => ({ ...pack })),
    rerollCost: shop.rerollCost,
    tempRerollCost: shop.tempRerollCost,
    rerollsUsedThisShop: shop.rerollsUsedThisShop,
  };
}

function cloneBoosterChoice(choice: BoosterChoice): BoosterChoice {
  return {
    uid: choice.uid,
    picked: choice.picked,
    ...cloneCatalogPayload(choice),
  };
}

function cloneBoosterState(booster: BoosterState | null): BoosterState | null {
  if (!booster) return null;
  return {
    packId: booster.packId,
    packType: booster.packType,
    packSize: booster.packSize,
    choices: booster.choices.map(cloneBoosterChoice),
    remainingPicks: booster.remainingPicks,
    drawnHandCardIds: [...booster.drawnHandCardIds],
    fromTag: booster.fromTag,
  };
}

function cloneRunSnapshot(snapshot: RunSnapshot): RunSnapshot {
  const handLevels = {} as Record<HandType, CompactHandLevelTuple>;
  for (const handType of HAND_TYPES) {
    const tuple = snapshot.handLevels[handType];
    handLevels[handType] = [tuple[0], tuple[1], tuple[2]];
  }

  return {
    ...snapshot,
    rngState: cloneRngState(snapshot.rngState),
    anteBlinds: [
      { ...snapshot.anteBlinds[0] },
      { ...snapshot.anteBlinds[1] },
      { ...snapshot.anteBlinds[2] },
    ],
    bossUseCounts: { ...snapshot.bossUseCounts },
    compactDeck: snapshot.compactDeck.map((tuple) => [...tuple] as CompactCardTuple),
    drawPileIds: [...snapshot.drawPileIds],
    handIds: [...snapshot.handIds],
    handSortMode: snapshot.handSortMode === 'suit' ? 'suit' : 'rank',
    discardPileIds: [...snapshot.discardPileIds],
    relics: snapshot.relics.map(cloneRelic),
    consumables: snapshot.consumables.map(cloneConsumable),
    charters: [...snapshot.charters],
    pendingTags: [...snapshot.pendingTags],
    handsPlayedThisRound: { ...snapshot.handsPlayedThisRound },
    handLevels,
    shop: cloneShopState(snapshot.shop),
    booster: cloneBoosterState(snapshot.booster),
    cashout: snapshot.cashout ? { ...snapshot.cashout } : null,
    stats: { ...snapshot.stats },
  };
}

/**
 * Создаёт начальный профиль мета-прогресса игрока со значениями по умолчанию для Balite v1.0.
 */
export function createInitialMetaSave(
  nowMs = 0,
  options: CreateInitialMetaSaveOptions = {},
): MetaSave {
  const safeNow = sanitizeNonNegInt(nowMs, 0);
  const safeRevision = sanitizeNonNegInt(options.revision, 0);
  const rawDecks = sanitizeIdList(options.unlockedDecks, DECK_SET);
  const unlockedDecks: DeckId[] = rawDecks.length > 0 ? rawDecks : ['b_red'];

  return {
    version: SAVE_SCHEMA_VERSION,
    revision: safeRevision,
    updatedAt: safeNow,
    settings: sanitizeSettings(
      {
        lang: options.lang,
        animationSpeed: options.animationSpeed,
        soundEnabled: options.soundEnabled,
        crtMode: options.crtMode,
        musicVolume: options.musicVolume,
        sfxVolume: options.sfxVolume,
        settingsVersion: SETTINGS_SCHEMA_VERSION,
      },
      { preserveLegacyDoubleSpeed: true },
    ),
    unlockedDecks,
    discoveredRelics: [],
    discoveredConsumables: [],
    discoveredCharters: [],
    discoveredBosses: [],
    stats: {
      runsStarted: 0,
      runsWon: 0,
      highestAnte: 0,
      highestRound: 0,
      bestHandScore: 0,
      maxDollars: 0,
      bestWinStreak: 0,
      currentWinStreak: 0,
      totalHandsPlayed: 0,
      handPlayCounts: {},
    },
  };
}

/**
 * Кодирует игральную карту в компактный 9-элементный кортеж для сериализации RunSnapshot.
 */
export function encodeCompactCard(card: PlayingCard): CompactCardTuple {
  const suitIndex = SUIT_INDEX.get(card.suit);
  const enhancementIndex = ENHANCEMENT_INDEX.get(card.enhancement);
  const editionIndex = EDITION_INDEX.get(card.edition);
  const sealIndex = SEAL_INDEX.get(card.seal);

  if (
    suitIndex === undefined ||
    !RANK_SET.has(card.rank) ||
    enhancementIndex === undefined ||
    editionIndex === undefined ||
    sealIndex === undefined
  ) {
    throw new RangeError('INVALID_PLAYING_CARD');
  }

  let flags = 0;
  if (card.debuffed) flags |= CARD_FLAG_DEBUFFED;
  if (card.playedThisAnte) flags |= CARD_FLAG_PLAYED_THIS_ANTE;
  if (card.facing === 'back') flags |= CARD_FLAG_FACING_BACK;
  if (card.forcedSelection) flags |= CARD_FLAG_FORCED_SELECTION;

  return [
    card.id,
    suitIndex,
    card.rank,
    enhancementIndex,
    editionIndex,
    sealIndex,
    card.bonusChips,
    card.permaBonus,
    flags,
  ];
}

/**
 * Декодирует компактный 9-элементный кортеж обратно в полный экземпляр игральной карты.
 */
export function decodeCompactCard(tuple: CompactCardTuple): PlayingCard {
  const [
    id,
    suitIndex,
    rank,
    enhancementIndex,
    editionIndex,
    sealIndex,
    bonusChips,
    permaBonus,
    flags,
  ] = tuple;

  const suit = SUITS[suitIndex];
  const enhancement = ENHANCEMENTS[enhancementIndex];
  const edition = EDITIONS[editionIndex];
  const seal = SEALS[sealIndex];

  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    !suit ||
    !RANK_SET.has(rank) ||
    !enhancement ||
    !edition ||
    !seal
  ) {
    throw new RangeError('INVALID_COMPACT_CARD_TUPLE');
  }

  const facing: CardFacing = (flags & CARD_FLAG_FACING_BACK) !== 0 ? 'back' : 'front';

  return {
    id,
    suit,
    rank,
    enhancement,
    edition,
    seal,
    bonusChips,
    permaBonus,
    debuffed: (flags & CARD_FLAG_DEBUFFED) !== 0,
    playedThisAnte: (flags & CARD_FLAG_PLAYED_THIS_ANTE) !== 0,
    facing,
    forcedSelection: (flags & CARD_FLAG_FORCED_SELECTION) !== 0,
  };
}

/**
 * Сериализует полное состояние забега RunState в компактный снимок RunSnapshot без потери данных.
 */
export function serializeRunStateToSnapshot(
  state: RunState,
  revision: number,
  updatedAt: number,
): RunSnapshot {
  const handLevels = {} as Record<HandType, CompactHandLevelTuple>;
  for (const handType of HAND_TYPES) {
    const levelState = state.handLevels[handType];
    handLevels[handType] = [levelState.level, levelState.playedCount, levelState.visible ? 1 : 0];
  }

  return {
    version: state.version,
    revision: sanitizeNonNegInt(revision, 0),
    updatedAt: sanitizeNonNegInt(updatedAt, 0),
    seed: state.seed,
    rngState: cloneRngState(state.rngState),
    deckId: state.deckId,
    phase: state.phase,
    previousPhase: state.previousPhase,
    ante: state.ante,
    round: state.round,
    currentBlindIndex: state.currentBlindIndex,
    anteBlinds: [
      { ...state.anteBlinds[0] },
      { ...state.anteBlinds[1] },
      { ...state.anteBlinds[2] },
    ],
    bossUseCounts: { ...state.bossUseCounts },
    bossRerollsThisAnte: state.bossRerollsThisAnte,
    activeBossDisabled: state.activeBossDisabled,
    savedBossDiscards: state.savedBossDiscards,
    endlessMode: state.endlessMode,
    probabilitiesNormal: state.probabilitiesNormal,
    anteScaling: state.anteScaling,
    score: state.score,
    targetScore: state.targetScore,
    dollars: state.dollars,
    handsLeft: state.handsLeft,
    maxHands: state.maxHands,
    discardsLeft: state.discardsLeft,
    maxDiscards: state.maxDiscards,
    handSize: state.handSize,
    tempHandSizeBonus: state.tempHandSizeBonus,
    maxRelics: state.maxRelics,
    maxConsumables: state.maxConsumables,
    baseRerollCost: state.baseRerollCost,
    interestCap: state.interestCap,
    shopSlots: state.shopSlots,
    discountPercent: state.discountPercent,
    editionRate: state.editionRate,
    compactDeck: state.deck.map(encodeCompactCard),
    drawPileIds: [...state.drawPileIds],
    handIds: [...state.handIds],
    handSortMode: state.handSortMode === 'suit' ? 'suit' : 'rank',
    discardPileIds: [...state.discardPileIds],
    relics: state.relics.map(cloneRelic),
    consumables: state.consumables.map(cloneConsumable),
    charters: [...state.charters],
    pendingTags: [...state.pendingTags],
    skipsCount: state.skipsCount,
    handsPlayedThisRound: { ...state.handsPlayedThisRound },
    handLevels,
    lastUsedConsumableId: state.lastUsedConsumableId,
    lastPlayedHandType: state.lastPlayedHandType,
    shop: cloneShopState(state.shop),
    shopVisits: state.shopVisits,
    booster: cloneBoosterState(state.booster),
    cashout: state.cashout ? { ...state.cashout } : null,
    nextCardUid: state.nextCardUid,
    stats: { ...state.stats },
  };
}

/**
 * Восстанавливает детерминированное состояние забега RunState из компактного снимка RunSnapshot.
 */
export function restoreRunStateFromSnapshot(snapshot: RunSnapshot): RunState {
  const handLevels = {} as Record<HandType, HandLevelState>;
  for (const handType of HAND_TYPES) {
    const [level, playedCount, visibleFlag] = snapshot.handLevels[handType];
    const stats = getHandLevelStats(handType, level);
    handLevels[handType] = {
      level,
      chips: stats.chips,
      mult: stats.mult,
      playedCount,
      visible: visibleFlag === 1,
    };
  }

  const anteBlinds: [BlindSlotState, BlindSlotState, BlindSlotState] = [
    { ...snapshot.anteBlinds[0] },
    { ...snapshot.anteBlinds[1] },
    { ...snapshot.anteBlinds[2] },
  ];
  // Миграция сохранений: в фазе выбора Стража текущий узел не может оставаться upcoming
  if (
    snapshot.phase === 'blind_select' &&
    anteBlinds[snapshot.currentBlindIndex].status === 'upcoming'
  ) {
    anteBlinds[snapshot.currentBlindIndex] = {
      ...anteBlinds[snapshot.currentBlindIndex],
      status: 'current',
    };
  }

  return {
    version: snapshot.version,
    seed: snapshot.seed,
    rngState: cloneRngState(snapshot.rngState),
    deckId: snapshot.deckId,
    phase: snapshot.phase,
    previousPhase: snapshot.previousPhase,
    ante: snapshot.ante,
    round: snapshot.round,
    currentBlindIndex: snapshot.currentBlindIndex,
    anteBlinds,
    bossUseCounts: { ...snapshot.bossUseCounts },
    bossRerollsThisAnte: snapshot.bossRerollsThisAnte,
    activeBossDisabled: snapshot.activeBossDisabled,
    savedBossDiscards: snapshot.savedBossDiscards,
    endlessMode: snapshot.endlessMode,
    probabilitiesNormal: snapshot.probabilitiesNormal,
    anteScaling: snapshot.anteScaling,
    score: snapshot.score,
    targetScore: snapshot.targetScore,
    dollars: snapshot.dollars,
    handsLeft: snapshot.handsLeft,
    maxHands: snapshot.maxHands,
    discardsLeft: snapshot.discardsLeft,
    maxDiscards: snapshot.maxDiscards,
    handSize: snapshot.handSize,
    tempHandSizeBonus: snapshot.tempHandSizeBonus,
    maxRelics: snapshot.maxRelics,
    maxConsumables: snapshot.maxConsumables,
    baseRerollCost: snapshot.baseRerollCost,
    interestCap: snapshot.interestCap,
    shopSlots: snapshot.shopSlots,
    discountPercent: snapshot.discountPercent,
    editionRate: snapshot.editionRate,
    deck: snapshot.compactDeck.map(decodeCompactCard),
    drawPileIds: [...snapshot.drawPileIds],
    handIds: [...snapshot.handIds],
    handSortMode: snapshot.handSortMode === 'suit' ? 'suit' : 'rank',
    discardPileIds: [...snapshot.discardPileIds],
    relics: snapshot.relics.map(cloneRelic),
    consumables: snapshot.consumables.map(cloneConsumable),
    charters: [...snapshot.charters],
    pendingTags: [...snapshot.pendingTags],
    skipsCount: snapshot.skipsCount,
    handsPlayedThisRound: { ...snapshot.handsPlayedThisRound },
    handLevels,
    lastUsedConsumableId: snapshot.lastUsedConsumableId,
    lastPlayedHandType: snapshot.lastPlayedHandType,
    shop: cloneShopState(snapshot.shop),
    shopVisits: snapshot.shopVisits,
    booster: cloneBoosterState(snapshot.booster),
    cashout: snapshot.cashout ? { ...snapshot.cashout } : null,
    nextCardUid: snapshot.nextCardUid,
    stats: { ...snapshot.stats },
  };
}

/**
 * Собирает единый объект сохранения PlayerSaveData с согласованными revision и updatedAt.
 */
export function createPlayerSaveData(
  meta: MetaSave,
  activeRun: RunSnapshot | null,
  revision = meta.revision,
  updatedAt = meta.updatedAt,
): PlayerSaveData {
  const safeRevision = sanitizeNonNegInt(revision, 0);
  const safeUpdatedAt = sanitizeNonNegInt(updatedAt, 0);
  const clonedMeta = cloneMetaSave(meta);

  return {
    revision: safeRevision,
    updatedAt: safeUpdatedAt,
    meta: {
      ...clonedMeta,
      version: clonedMeta.version === SAVE_SCHEMA_VERSION ? clonedMeta.version : SAVE_SCHEMA_VERSION,
      revision: safeRevision,
      updatedAt: safeUpdatedAt,
    },
    activeRun: activeRun
      ? {
          ...cloneRunSnapshot(activeRun),
          revision: safeRevision,
          updatedAt: safeUpdatedAt,
        }
      : null,
  };
}

/**
 * Формирует компактный резервный сейв для облачных хранилищ с лимитом 4000 байт (VK/OK),
 * отбрасывая activeRun и сохраняя мета-прогресс, версию, revision и updatedAt.
 */
export function createCompactFallbackSave(saveData: PlayerSaveData): PlayerSaveData {
  const sanitized = sanitizePlayerSaveData(saveData);
  const revision = sanitized.revision ?? sanitizeNonNegInt(saveData?.revision, 0);
  const updatedAt = sanitized.updatedAt ?? sanitizeNonNegInt(saveData?.updatedAt, 0);
  const meta = sanitized.meta ?? createInitialMetaSave(updatedAt, { revision });

  return {
    revision,
    updatedAt,
    meta: {
      ...cloneMetaSave(meta),
      version: SAVE_SCHEMA_VERSION,
      revision,
      updatedAt,
    },
    activeRun: null,
  };
}

function isValidConsumableIdForKind(id: string, kind: ConsumableKind): id is ConsumableId {
  if (kind === 'celestial') return CELESTIAL_SET.has(id as CelestialId);
  if (kind === 'scroll') return SCROLL_SET.has(id as ScrollId);
  return RUNE_SET.has(id as RuneId);
}

function sanitizeConsumableId(raw: unknown): ConsumableId | null {
  if (typeof raw !== 'string') return null;
  if (
    CELESTIAL_SET.has(raw as CelestialId) ||
    SCROLL_SET.has(raw as ScrollId) ||
    RUNE_SET.has(raw as RuneId)
  ) {
    return raw as ConsumableId;
  }
  return null;
}

function sanitizeMetaSave(
  raw: unknown,
  fallbackRevision: number,
  fallbackUpdatedAt: number,
): MetaSave | undefined {
  if (!isRecord(raw)) return undefined;

  if ('version' in raw && raw.version !== SAVE_SCHEMA_VERSION) {
    return undefined;
  }

  const hasRecognizedField =
    'version' in raw ||
    'settings' in raw ||
    'unlockedDecks' in raw ||
    'discoveredRelics' in raw ||
    'discoveredConsumables' in raw ||
    'discoveredCharters' in raw ||
    'discoveredBosses' in raw ||
    'stats' in raw;

  if (!hasRecognizedField) return undefined;

  const unlocked = sanitizeIdList(raw.unlockedDecks, DECK_SET);
  const rawDiscoveredConsumables = Array.isArray(raw.discoveredConsumables)
    ? raw.discoveredConsumables
        .map(sanitizeConsumableId)
        .filter((item): item is ConsumableId => item !== null)
    : [];
  const discoveredConsumables = mergeUniqueIds(rawDiscoveredConsumables, []);

  const activeRunTracker =
    'activeRunTracker' in raw && raw.activeRunTracker !== undefined
      ? sanitizeActiveRunTracker(raw.activeRunTracker)
      : undefined;

  return {
    version: SAVE_SCHEMA_VERSION,
    revision: sanitizeNonNegInt(raw.revision, fallbackRevision),
    updatedAt: sanitizeNonNegInt(raw.updatedAt, fallbackUpdatedAt),
    settings: sanitizeSettings(raw.settings),
    unlockedDecks: unlocked.length > 0 ? unlocked : ['b_red'],
    discoveredRelics: sanitizeIdList(raw.discoveredRelics, RELIC_SET),
    discoveredConsumables,
    discoveredCharters: sanitizeIdList(raw.discoveredCharters, CHARTER_SET),
    discoveredBosses: sanitizeIdList(raw.discoveredBosses, BOSS_SET),
    stats: sanitizeMetaStats(raw.stats),
    ...(activeRunTracker !== undefined ? { activeRunTracker } : {}),
  };
}

function sanitizePlayingCardObject(raw: unknown): PlayingCard | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;
  if (typeof raw.suit !== 'string' || !SUIT_SET.has(raw.suit as Suit)) return null;
  if (typeof raw.rank !== 'number' || !RANK_SET.has(raw.rank as Rank)) return null;
  if (typeof raw.enhancement !== 'string' || !ENHANCEMENT_SET.has(raw.enhancement as Enhancement)) {
    return null;
  }
  if (typeof raw.edition !== 'string' || !EDITION_SET.has(raw.edition as Edition)) return null;
  if (typeof raw.seal !== 'string' || !SEAL_SET.has(raw.seal as Seal)) return null;
  if (typeof raw.bonusChips !== 'number' || !Number.isFinite(raw.bonusChips)) return null;
  if (typeof raw.permaBonus !== 'number' || !Number.isFinite(raw.permaBonus)) return null;
  if (typeof raw.debuffed !== 'boolean') return null;
  if (typeof raw.playedThisAnte !== 'boolean') return null;
  if (raw.facing !== 'front' && raw.facing !== 'back') return null;
  if (typeof raw.forcedSelection !== 'boolean') return null;

  return {
    id: raw.id,
    suit: raw.suit as Suit,
    rank: raw.rank as Rank,
    enhancement: raw.enhancement as Enhancement,
    edition: raw.edition as Edition,
    seal: raw.seal as Seal,
    bonusChips: raw.bonusChips,
    permaBonus: raw.permaBonus,
    debuffed: raw.debuffed,
    playedThisAnte: raw.playedThisAnte,
    facing: raw.facing,
    forcedSelection: raw.forcedSelection,
  };
}

function sanitizeRelicStateCounters(raw: unknown): RelicStateCounters | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.chips !== 'number' || !Number.isFinite(raw.chips)) return null;
  if (typeof raw.mult !== 'number' || !Number.isFinite(raw.mult)) return null;
  if (typeof raw.xMult !== 'number' || !Number.isFinite(raw.xMult)) return null;

  let extra: Record<string, number | string | boolean> | undefined;
  if ('extra' in raw && raw.extra !== undefined) {
    if (!isRecord(raw.extra)) return null;
    extra = {};
    for (const [key, val] of Object.entries(raw.extra)) {
      if (
        typeof val === 'string' ||
        typeof val === 'boolean' ||
        (typeof val === 'number' && Number.isFinite(val))
      ) {
        extra[key] = val;
      } else {
        return null;
      }
    }
  }

  return {
    chips: raw.chips,
    mult: raw.mult,
    xMult: raw.xMult,
    ...(extra !== undefined ? { extra } : {}),
  };
}

function sanitizeRelicInstance(raw: unknown): RelicInstance | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.uid !== 'string' || raw.uid.length === 0) return null;
  if (typeof raw.id !== 'string' || !RELIC_SET.has(raw.id as RelicId)) return null;
  if (typeof raw.edition !== 'string' || !EDITION_SET.has(raw.edition as Edition)) return null;
  if (typeof raw.baseCost !== 'number' || !Number.isFinite(raw.baseCost)) return null;
  if (typeof raw.sellValue !== 'number' || !Number.isFinite(raw.sellValue)) return null;
  if (typeof raw.extraValue !== 'number' || !Number.isFinite(raw.extraValue)) return null;
  if (typeof raw.debuffed !== 'boolean') return null;

  const state = sanitizeRelicStateCounters(raw.state);
  if (!state) return null;

  return {
    uid: raw.uid,
    id: raw.id as RelicId,
    edition: raw.edition as Edition,
    baseCost: raw.baseCost,
    sellValue: raw.sellValue,
    extraValue: raw.extraValue,
    debuffed: raw.debuffed,
    state,
  };
}

function sanitizeConsumableInstance(raw: unknown): ConsumableInstance | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.uid !== 'string' || raw.uid.length === 0) return null;
  if (typeof raw.kind !== 'string' || !CONSUMABLE_KIND_SET.has(raw.kind as ConsumableKind)) {
    return null;
  }
  const kind = raw.kind as ConsumableKind;
  if (typeof raw.id !== 'string' || !isValidConsumableIdForKind(raw.id, kind)) return null;
  if (typeof raw.edition !== 'string' || !EDITION_SET.has(raw.edition as Edition)) return null;
  if (typeof raw.baseCost !== 'number' || !Number.isFinite(raw.baseCost)) return null;
  if (typeof raw.sellValue !== 'number' || !Number.isFinite(raw.sellValue)) return null;

  return {
    uid: raw.uid,
    id: raw.id,
    kind,
    edition: raw.edition as Edition,
    baseCost: raw.baseCost,
    sellValue: raw.sellValue,
  };
}

function sanitizeCompactTuple(raw: unknown): CompactCardTuple | null {
  if (!Array.isArray(raw) || raw.length !== 9) return null;
  const [id, suitIdx, rank, enhIdx, edIdx, sealIdx, bonusChips, permaBonus, flags] = raw;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!Number.isInteger(suitIdx) || suitIdx < 0 || suitIdx >= SUITS.length) return null;
  if (typeof rank !== 'number' || !RANK_SET.has(rank as Rank)) return null;
  if (!Number.isInteger(enhIdx) || enhIdx < 0 || enhIdx >= ENHANCEMENTS.length) return null;
  if (!Number.isInteger(edIdx) || edIdx < 0 || edIdx >= EDITIONS.length) return null;
  if (!Number.isInteger(sealIdx) || sealIdx < 0 || sealIdx >= SEALS.length) return null;
  if (typeof bonusChips !== 'number' || !Number.isFinite(bonusChips)) return null;
  if (typeof permaBonus !== 'number' || !Number.isFinite(permaBonus)) return null;
  if (typeof flags !== 'number' || !Number.isInteger(flags) || flags < 0) return null;

  return [
    id,
    suitIdx as 0 | 1 | 2 | 3,
    rank as Rank,
    enhIdx as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
    edIdx as 0 | 1 | 2 | 3 | 4,
    sealIdx as 0 | 1 | 2 | 3 | 4,
    bonusChips,
    permaBonus,
    flags,
  ];
}

function sanitizeStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') return null;
    result.push(item);
  }
  return result;
}

function sanitizeBlindSlot(raw: unknown): BlindSlotState | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.kind !== 'string' || !BLIND_KIND_SET.has(raw.kind as BlindKind)) return null;
  if (
    raw.bossId !== null &&
    (typeof raw.bossId !== 'string' || !BOSS_SET.has(raw.bossId as BossId))
  ) {
    return null;
  }
  if (typeof raw.targetScore !== 'number' || !Number.isFinite(raw.targetScore)) return null;
  if (typeof raw.reward !== 'number' || !Number.isFinite(raw.reward)) return null;
  if (typeof raw.status !== 'string' || !BLIND_STATUS_SET.has(raw.status as BlindSlotStatus)) {
    return null;
  }
  if (
    raw.skipTagId !== null &&
    (typeof raw.skipTagId !== 'string' || !TAG_SET.has(raw.skipTagId as TagId))
  ) {
    return null;
  }

  return {
    kind: raw.kind as BlindKind,
    bossId: raw.bossId as BossId | null,
    targetScore: raw.targetScore,
    reward: raw.reward,
    status: raw.status as BlindSlotStatus,
    skipTagId: raw.skipTagId as TagId | null,
  };
}

function sanitizeRngState(raw: unknown): RngState | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.seed !== 'string') return null;
  if (!isRecord(raw.streams)) return null;

  const streams = {} as Record<RngStreamName, number>;
  for (const streamName of RNG_STREAM_NAMES) {
    const val = raw.streams[streamName];
    if (typeof val !== 'number' || !Number.isFinite(val)) return null;
    streams[streamName] = val >>> 0;
  }

  return {
    seed: raw.seed,
    streams,
  };
}

function sanitizeCatalogPayload(raw: Record<string, unknown>): TaggedCatalogPayload | null {
  if (raw.kind === 'relic') {
    const relic = sanitizeRelicInstance(raw.relic);
    return relic ? { kind: 'relic', relic } : null;
  }
  if (raw.kind === 'consumable') {
    const consumable = sanitizeConsumableInstance(raw.consumable);
    return consumable ? { kind: 'consumable', consumable } : null;
  }
  if (raw.kind === 'card') {
    const card = sanitizePlayingCardObject(raw.card);
    return card ? { kind: 'card', card } : null;
  }
  return null;
}

function sanitizeCountMap<T extends string>(
  raw: unknown,
  allowed: ReadonlySet<T>,
): Partial<Record<T, number>> | null {
  if (!isRecord(raw)) return null;
  const result: Partial<Record<T, number>> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (allowed.has(key as T) && typeof val === 'number' && Number.isFinite(val) && val >= 0) {
      result[key as T] = Math.floor(val);
    }
  }
  return result;
}

function sanitizeStrictIdArray<T extends string>(
  raw: unknown,
  allowed: ReadonlySet<T>,
): T[] | null {
  if (!Array.isArray(raw)) return null;
  const result: T[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !allowed.has(item as T)) return null;
    result.push(item as T);
  }
  return result;
}

function sanitizeHandLevelTuples(
  raw: unknown,
): Record<HandType, CompactHandLevelTuple> | null {
  if (!isRecord(raw)) return null;
  const handLevels = {} as Record<HandType, CompactHandLevelTuple>;
  for (const handType of HAND_TYPES) {
    const tuple = raw[handType];
    if (
      !Array.isArray(tuple) ||
      tuple.length !== 3 ||
      typeof tuple[0] !== 'number' ||
      !Number.isInteger(tuple[0]) ||
      tuple[0] < 0 ||
      typeof tuple[1] !== 'number' ||
      !Number.isInteger(tuple[1]) ||
      tuple[1] < 0 ||
      (tuple[2] !== 0 && tuple[2] !== 1)
    ) {
      return null;
    }
    handLevels[handType] = [tuple[0], tuple[1], tuple[2]];
  }
  return handLevels;
}

function sanitizeShopState(raw: unknown): ShopState | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw)) return undefined;
  if (!Array.isArray(raw.offers) || !Array.isArray(raw.packs)) return undefined;
  if (typeof raw.rerollCost !== 'number' || !Number.isFinite(raw.rerollCost)) return undefined;
  if (
    raw.tempRerollCost !== null &&
    (typeof raw.tempRerollCost !== 'number' || !Number.isFinite(raw.tempRerollCost))
  ) {
    return undefined;
  }
  if (typeof raw.rerollsUsedThisShop !== 'number' || !Number.isFinite(raw.rerollsUsedThisShop)) {
    return undefined;
  }

  const offers: ShopOffer[] = [];
  for (const item of raw.offers) {
    if (!isRecord(item) || typeof item.uid !== 'string' || typeof item.sold !== 'boolean') {
      return undefined;
    }
    if (typeof item.cost !== 'number' || !Number.isFinite(item.cost)) return undefined;
    if (typeof item.baseCost !== 'number' || !Number.isFinite(item.baseCost)) return undefined;

    const payload = sanitizeCatalogPayload(item);
    if (!payload) return undefined;
    offers.push({
      uid: item.uid,
      cost: item.cost,
      baseCost: item.baseCost,
      sold: item.sold,
      ...payload,
    });
  }

  let voucher: ShopVoucherOffer | null = null;
  if (raw.voucher !== null) {
    if (!isRecord(raw.voucher)) return undefined;
    if (
      typeof raw.voucher.uid !== 'string' ||
      typeof raw.voucher.charterId !== 'string' ||
      !CHARTER_SET.has(raw.voucher.charterId as CharterId) ||
      typeof raw.voucher.cost !== 'number' ||
      !Number.isFinite(raw.voucher.cost) ||
      typeof raw.voucher.baseCost !== 'number' ||
      !Number.isFinite(raw.voucher.baseCost) ||
      typeof raw.voucher.sold !== 'boolean'
    ) {
      return undefined;
    }
    voucher = {
      uid: raw.voucher.uid,
      charterId: raw.voucher.charterId as CharterId,
      cost: raw.voucher.cost,
      baseCost: raw.voucher.baseCost,
      sold: raw.voucher.sold,
    };
  }

  const packs: PackOffer[] = [];
  for (const pack of raw.packs) {
    if (
      !isRecord(pack) ||
      typeof pack.uid !== 'string' ||
      typeof pack.packId !== 'string' ||
      typeof pack.type !== 'string' ||
      !PACK_TYPE_SET.has(pack.type as PackType) ||
      typeof pack.size !== 'string' ||
      !PACK_SIZE_SET.has(pack.size as PackSize) ||
      typeof pack.cost !== 'number' ||
      !Number.isFinite(pack.cost) ||
      typeof pack.baseCost !== 'number' ||
      !Number.isFinite(pack.baseCost) ||
      typeof pack.totalCards !== 'number' ||
      !Number.isFinite(pack.totalCards) ||
      typeof pack.chooseCount !== 'number' ||
      !Number.isFinite(pack.chooseCount) ||
      typeof pack.purchased !== 'boolean'
    ) {
      return undefined;
    }
    packs.push({
      uid: pack.uid,
      packId: pack.packId,
      type: pack.type as PackType,
      size: pack.size as PackSize,
      cost: pack.cost,
      baseCost: pack.baseCost,
      totalCards: pack.totalCards,
      chooseCount: pack.chooseCount,
      purchased: pack.purchased,
    });
  }

  return {
    offers,
    voucher,
    packs,
    rerollCost: raw.rerollCost,
    tempRerollCost: raw.tempRerollCost as number | null,
    rerollsUsedThisShop: raw.rerollsUsedThisShop,
  };
}

function sanitizeBoosterState(raw: unknown): BoosterState | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw)) return undefined;
  if (
    typeof raw.packId !== 'string' ||
    typeof raw.packType !== 'string' ||
    !PACK_TYPE_SET.has(raw.packType as PackType) ||
    typeof raw.packSize !== 'string' ||
    !PACK_SIZE_SET.has(raw.packSize as PackSize) ||
    !Array.isArray(raw.choices) ||
    typeof raw.remainingPicks !== 'number' ||
    !Number.isFinite(raw.remainingPicks) ||
    typeof raw.fromTag !== 'boolean'
  ) {
    return undefined;
  }

  const drawnHandCardIds = sanitizeStringArray(raw.drawnHandCardIds);
  if (!drawnHandCardIds) return undefined;

  const choices: BoosterChoice[] = [];
  for (const item of raw.choices) {
    if (!isRecord(item) || typeof item.uid !== 'string' || typeof item.picked !== 'boolean') {
      return undefined;
    }
    const payload = sanitizeCatalogPayload(item);
    if (!payload) return undefined;
    choices.push({ uid: item.uid, picked: item.picked, ...payload });
  }

  return {
    packId: raw.packId,
    packType: raw.packType as PackType,
    packSize: raw.packSize as PackSize,
    choices,
    remainingPicks: raw.remainingPicks,
    drawnHandCardIds,
    fromTag: raw.fromTag,
  };
}

function sanitizeCashout(raw: unknown): CashoutBreakdown | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw)) return undefined;
  const fields = [
    'blindReward',
    'unusedHandsBonus',
    'interestBonus',
    'relicBonus',
    'tagBonus',
    'totalReward',
  ] as const;
  for (const field of fields) {
    if (typeof raw[field] !== 'number' || !Number.isFinite(raw[field])) return undefined;
  }
  return {
    blindReward: raw.blindReward as number,
    unusedHandsBonus: raw.unusedHandsBonus as number,
    interestBonus: raw.interestBonus as number,
    relicBonus: raw.relicBonus as number,
    tagBonus: raw.tagBonus as number,
    totalReward: raw.totalReward as number,
  };
}

function sanitizeRunStats(raw: unknown): RunStats | null {
  if (!isRecord(raw)) return null;
  const requiredFields = [
    'bestHandScore',
    'handsPlayed',
    'discardsUsed',
    'cardsDestroyed',
    'dollarsSpent',
  ] as const;
  for (const field of requiredFields) {
    if (typeof raw[field] !== 'number' || !Number.isFinite(raw[field]) || raw[field] < 0) {
      return null;
    }
  }

  let bestHandType: HandType | null = null;
  if ('bestHandType' in raw && raw.bestHandType !== undefined && raw.bestHandType !== null) {
    if (typeof raw.bestHandType !== 'string' || !HAND_TYPE_SET.has(raw.bestHandType as HandType)) {
      return null;
    }
    bestHandType = raw.bestHandType as HandType;
  }

  const readOptionalCounter = (field: 'cardsPlayed' | 'cardsDiscarded' | 'cardsPurchased' | 'rerollsCount'): number | null => {
    if (!(field in raw) || raw[field] === undefined) {
      return 0;
    }
    const val = raw[field];
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
      return null;
    }
    return Math.floor(val);
  };

  const cardsPlayed = readOptionalCounter('cardsPlayed');
  const cardsDiscarded = readOptionalCounter('cardsDiscarded');
  const cardsPurchased = readOptionalCounter('cardsPurchased');
  const rerollsCount = readOptionalCounter('rerollsCount');
  if (
    cardsPlayed === null ||
    cardsDiscarded === null ||
    cardsPurchased === null ||
    rerollsCount === null
  ) {
    return null;
  }

  return {
    bestHandScore: raw.bestHandScore as number,
    bestHandType,
    handsPlayed: Math.floor(raw.handsPlayed as number),
    cardsPlayed,
    discardsUsed: Math.floor(raw.discardsUsed as number),
    cardsDiscarded,
    cardsPurchased,
    rerollsCount,
    cardsDestroyed: Math.floor(raw.cardsDestroyed as number),
    dollarsSpent: raw.dollarsSpent as number,
  };
}

function sanitizeRunSnapshot(
  raw: unknown,
  fallbackRevision: number,
  fallbackUpdatedAt: number,
): RunSnapshot | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== SAVE_SCHEMA_VERSION) return null;
  if (typeof raw.seed !== 'string') return null;

  const rngState = sanitizeRngState(raw.rngState);
  if (!rngState) return null;

  if (typeof raw.deckId !== 'string' || !DECK_SET.has(raw.deckId as DeckId)) return null;
  if (typeof raw.phase !== 'string' || !RUN_PHASE_SET.has(raw.phase as RunPhase)) return null;
  if (
    raw.previousPhase !== null &&
    (typeof raw.previousPhase !== 'string' || !RUN_PHASE_SET.has(raw.previousPhase as RunPhase))
  ) {
    return null;
  }

  if (raw.currentBlindIndex !== 0 && raw.currentBlindIndex !== 1 && raw.currentBlindIndex !== 2) {
    return null;
  }

  if (!Array.isArray(raw.anteBlinds) || raw.anteBlinds.length !== 3) return null;
  const b0 = sanitizeBlindSlot(raw.anteBlinds[0]);
  const b1 = sanitizeBlindSlot(raw.anteBlinds[1]);
  const b2 = sanitizeBlindSlot(raw.anteBlinds[2]);
  if (!b0 || !b1 || !b2) return null;

  const numericFields = [
    'ante',
    'round',
    'bossRerollsThisAnte',
    'probabilitiesNormal',
    'anteScaling',
    'score',
    'targetScore',
    'dollars',
    'handsLeft',
    'maxHands',
    'discardsLeft',
    'maxDiscards',
    'handSize',
    'tempHandSizeBonus',
    'maxRelics',
    'maxConsumables',
    'baseRerollCost',
    'interestCap',
    'shopSlots',
    'discountPercent',
    'editionRate',
    'skipsCount',
    'shopVisits',
    'nextCardUid',
  ] as const;
  for (const field of numericFields) {
    if (typeof raw[field] !== 'number' || !Number.isFinite(raw[field])) return null;
  }
  if (!Number.isInteger(raw.ante) || (raw.ante as number) < 1) return null;
  if (!Number.isInteger(raw.round) || (raw.round as number) < 0) return null;

  if (
    raw.savedBossDiscards !== null &&
    (typeof raw.savedBossDiscards !== 'number' || !Number.isFinite(raw.savedBossDiscards))
  ) {
    return null;
  }
  if (typeof raw.activeBossDisabled !== 'boolean' || typeof raw.endlessMode !== 'boolean') {
    return null;
  }

  if (!Array.isArray(raw.compactDeck)) return null;
  const compactDeck: CompactCardTuple[] = [];
  for (const item of raw.compactDeck) {
    const tuple = sanitizeCompactTuple(item);
    if (!tuple) return null;
    compactDeck.push(tuple);
  }

  const drawPileIds = sanitizeStringArray(raw.drawPileIds);
  const handIds = sanitizeStringArray(raw.handIds);
  const discardPileIds = sanitizeStringArray(raw.discardPileIds);
  if (!drawPileIds || !handIds || !discardPileIds) return null;

  if (!Array.isArray(raw.relics) || !Array.isArray(raw.consumables)) return null;
  const relics: RelicInstance[] = [];
  for (const item of raw.relics) {
    const relic = sanitizeRelicInstance(item);
    if (!relic) return null;
    relics.push(relic);
  }
  const consumables: ConsumableInstance[] = [];
  for (const item of raw.consumables) {
    const consumable = sanitizeConsumableInstance(item);
    if (!consumable) return null;
    consumables.push(consumable);
  }

  const charters = sanitizeStrictIdArray(raw.charters, CHARTER_SET);
  const pendingTags = sanitizeStrictIdArray(raw.pendingTags, TAG_SET);
  if (!charters || !pendingTags) return null;

  const bossUseCounts = sanitizeCountMap(raw.bossUseCounts, BOSS_SET);
  const handsPlayedThisRound = sanitizeCountMap(raw.handsPlayedThisRound, HAND_TYPE_SET);
  const handLevels = sanitizeHandLevelTuples(raw.handLevels);
  if (!bossUseCounts || !handsPlayedThisRound || !handLevels) return null;

  if (
    raw.lastUsedConsumableId !== null &&
    (typeof raw.lastUsedConsumableId !== 'string' ||
      (!SCROLL_SET.has(raw.lastUsedConsumableId as ScrollId) &&
        !CELESTIAL_SET.has(raw.lastUsedConsumableId as CelestialId)))
  ) {
    return null;
  }
  if (
    raw.lastPlayedHandType !== null &&
    (typeof raw.lastPlayedHandType !== 'string' ||
      !HAND_TYPE_SET.has(raw.lastPlayedHandType as HandType))
  ) {
    return null;
  }

  const shop = sanitizeShopState(raw.shop);
  if (shop === undefined) return null;

  const booster = sanitizeBoosterState(raw.booster);
  if (booster === undefined) return null;

  const cashout = sanitizeCashout(raw.cashout);
  if (cashout === undefined) return null;

  const stats = sanitizeRunStats(raw.stats);
  if (!stats) return null;

  return {
    version: SAVE_SCHEMA_VERSION,
    revision: sanitizeNonNegInt(raw.revision, fallbackRevision),
    updatedAt: sanitizeNonNegInt(raw.updatedAt, fallbackUpdatedAt),
    seed: raw.seed,
    rngState,
    deckId: raw.deckId as DeckId,
    phase: raw.phase as RunPhase,
    previousPhase: raw.previousPhase as RunPhase | null,
    ante: raw.ante as number,
    round: raw.round as number,
    currentBlindIndex: raw.currentBlindIndex,
    anteBlinds: [b0, b1, b2],
    bossUseCounts,
    bossRerollsThisAnte: raw.bossRerollsThisAnte as number,
    activeBossDisabled: raw.activeBossDisabled,
    savedBossDiscards: raw.savedBossDiscards as number | null,
    endlessMode: raw.endlessMode,
    probabilitiesNormal: raw.probabilitiesNormal as number,
    anteScaling: raw.anteScaling as number,
    score: raw.score as number,
    targetScore: raw.targetScore as number,
    dollars: raw.dollars as number,
    handsLeft: raw.handsLeft as number,
    maxHands: raw.maxHands as number,
    discardsLeft: raw.discardsLeft as number,
    maxDiscards: raw.maxDiscards as number,
    handSize: raw.handSize as number,
    tempHandSizeBonus: raw.tempHandSizeBonus as number,
    maxRelics: raw.maxRelics as number,
    maxConsumables: raw.maxConsumables as number,
    baseRerollCost: raw.baseRerollCost as number,
    interestCap: raw.interestCap as number,
    shopSlots: raw.shopSlots as number,
    discountPercent: raw.discountPercent as number,
    editionRate: raw.editionRate as number,
    compactDeck,
    drawPileIds,
    handIds,
    handSortMode: raw.handSortMode === 'suit' ? 'suit' : 'rank',
    discardPileIds,
    relics,
    consumables,
    charters,
    pendingTags,
    skipsCount: raw.skipsCount as number,
    handsPlayedThisRound,
    handLevels,
    lastUsedConsumableId: raw.lastUsedConsumableId as ScrollId | CelestialId | null,
    lastPlayedHandType: raw.lastPlayedHandType as HandType | null,
    shop,
    shopVisits: raw.shopVisits as number,
    booster,
    cashout,
    nextCardUid: raw.nextCardUid as number,
    stats,
  };
}

/**
 * Безопасно проверяет и очищает сырое (потенциально повреждённое или частичное) сохранение из хранилища.
 */
export function sanitizePlayerSaveData(raw: unknown): Partial<PlayerSaveData> {
  if (!isRecord(raw)) return {};

  if ('version' in raw && raw.version !== undefined && raw.version !== SAVE_SCHEMA_VERSION) {
    return {};
  }

  const hasRevision =
    typeof raw.revision === 'number' && Number.isFinite(raw.revision) && raw.revision >= 0;
  const hasUpdatedAt =
    typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) && raw.updatedAt >= 0;

  const revision = hasRevision ? Math.floor(raw.revision as number) : 0;
  const updatedAt = hasUpdatedAt ? Math.floor(raw.updatedAt as number) : 0;

  const result: {
    revision?: number;
    updatedAt?: number;
    meta?: MetaSave;
    activeRun?: RunSnapshot | null;
  } = {};

  if (hasRevision) result.revision = revision;
  if (hasUpdatedAt) result.updatedAt = updatedAt;

  if ('meta' in raw && raw.meta !== undefined) {
    const cleanMeta = sanitizeMetaSave(raw.meta, revision, updatedAt);
    if (cleanMeta) {
      result.meta = cleanMeta;
    }
  }

  if ('activeRun' in raw && raw.activeRun !== undefined) {
    if (raw.activeRun === null) {
      result.activeRun = null;
    } else {
      result.activeRun = sanitizeRunSnapshot(raw.activeRun, revision, updatedAt);
    }
  }

  return result;
}

function getSaveRevision(data: Partial<PlayerSaveData>): number | null {
  if (typeof data.revision === 'number' && Number.isFinite(data.revision) && data.revision >= 0) {
    return Math.floor(data.revision);
  }
  if (
    data.meta &&
    typeof data.meta.revision === 'number' &&
    Number.isFinite(data.meta.revision) &&
    data.meta.revision >= 0
  ) {
    return Math.floor(data.meta.revision);
  }
  return null;
}

function getSaveUpdatedAt(data: Partial<PlayerSaveData>): number | null {
  if (typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt) && data.updatedAt >= 0) {
    return Math.floor(data.updatedAt);
  }
  if (
    data.meta &&
    typeof data.meta.updatedAt === 'number' &&
    Number.isFinite(data.meta.updatedAt) &&
    data.meta.updatedAt >= 0
  ) {
    return Math.floor(data.meta.updatedAt);
  }
  return null;
}

function compareSaveFreshness(
  localData: Partial<PlayerSaveData>,
  cloudData: Partial<PlayerSaveData>,
): -1 | 0 | 1 {
  const localRev = getSaveRevision(localData);
  const cloudRev = getSaveRevision(cloudData);

  if (localRev !== null && cloudRev !== null) {
    if (localRev > cloudRev) return 1;
    if (cloudRev > localRev) return -1;
  } else if (localRev !== null && cloudRev === null) {
    return 1;
  } else if (cloudRev !== null && localRev === null) {
    return -1;
  }

  const localTime = getSaveUpdatedAt(localData);
  const cloudTime = getSaveUpdatedAt(cloudData);

  if (localTime !== null && cloudTime !== null) {
    if (localTime > cloudTime) return 1;
    if (cloudTime > localTime) return -1;
    return 0;
  }
  if (localTime !== null && cloudTime === null) return 1;
  if (cloudTime !== null && localTime === null) return -1;

  return 0;
}

function mergeMetaSaves(
  primary: MetaSave | undefined,
  secondary: MetaSave | undefined,
  revision: number | undefined,
  updatedAt: number | undefined,
): MetaSave | undefined {
  if (!primary && !secondary) return undefined;
  const base = primary ?? secondary!;
  const other = secondary ?? primary!;

  const finalRevision = revision ?? base.revision;
  const finalUpdatedAt = updatedAt ?? base.updatedAt;

  const activeRunTracker = base.activeRunTracker
    ? sanitizeActiveRunTracker(base.activeRunTracker)
    : undefined;

  return {
    version: SAVE_SCHEMA_VERSION,
    revision: finalRevision,
    updatedAt: finalUpdatedAt,
    settings: sanitizeSettings(base.settings),
    unlockedDecks: mergeUniqueIds(base.unlockedDecks, other.unlockedDecks),
    discoveredRelics: mergeUniqueIds(base.discoveredRelics, other.discoveredRelics),
    discoveredConsumables: mergeUniqueIds(base.discoveredConsumables, other.discoveredConsumables),
    discoveredCharters: mergeUniqueIds(base.discoveredCharters, other.discoveredCharters),
    discoveredBosses: mergeUniqueIds(base.discoveredBosses, other.discoveredBosses),
    stats: {
      runsStarted: Math.max(base.stats.runsStarted, other.stats.runsStarted),
      runsWon: Math.max(base.stats.runsWon, other.stats.runsWon),
      highestAnte: Math.max(base.stats.highestAnte, other.stats.highestAnte),
      highestRound: Math.max(base.stats.highestRound, other.stats.highestRound),
      bestHandScore: Math.max(base.stats.bestHandScore, other.stats.bestHandScore),
      maxDollars: Math.max(base.stats.maxDollars, other.stats.maxDollars),
      bestWinStreak: Math.max(
        base.stats.bestWinStreak,
        other.stats.bestWinStreak,
        base.stats.currentWinStreak,
        other.stats.currentWinStreak,
      ),
      currentWinStreak: base.stats.currentWinStreak,
      totalHandsPlayed: Math.max(base.stats.totalHandsPlayed, other.stats.totalHandsPlayed),
      handPlayCounts: mergeHandPlayCounts(base.stats.handPlayCounts, other.stats.handPlayCounts),
    },
    ...(activeRunTracker !== undefined ? { activeRunTracker } : {}),
  };
}

/**
 * Монотонно объединяет локальное и облачное сохранения по revision и updatedAt.
 * Устаревшее облако никогда не перезаписывает более свежий локальный прогресс,
 * а при совпадении ревизии активный забег и мета-прогресс объединяются консервативно.
 */
export function mergePlayerSaveData(
  localData: Partial<PlayerSaveData>,
  cloudData: Partial<PlayerSaveData>,
): Partial<PlayerSaveData> {
  const local = sanitizePlayerSaveData(localData);
  const cloud = sanitizePlayerSaveData(cloudData);

  const hasLocal = Object.keys(local).length > 0;
  const hasCloud = Object.keys(cloud).length > 0;
  if (!hasLocal && !hasCloud) return {};

  const freshness = compareSaveFreshness(local, cloud);
  const preferLocal = freshness >= 0;
  const winner = preferLocal ? local : cloud;
  const loser = preferLocal ? cloud : local;

  const finalRevision = getSaveRevision(winner) ?? getSaveRevision(loser) ?? undefined;
  const finalUpdatedAt = getSaveUpdatedAt(winner) ?? getSaveUpdatedAt(loser) ?? undefined;
  const mergedMeta = mergeMetaSaves(winner.meta, loser.meta, finalRevision, finalUpdatedAt);

  let resolvedActiveRun: RunSnapshot | null | undefined;
  if (freshness === 0) {
    // На одной ревизии облачный compactFallback (activeRun: null) не затирает локальный активный забег
    if (local.activeRun) {
      resolvedActiveRun = cloneRunSnapshot(local.activeRun);
    } else if (cloud.activeRun) {
      resolvedActiveRun = cloneRunSnapshot(cloud.activeRun);
    } else if ('activeRun' in local || 'activeRun' in cloud) {
      resolvedActiveRun = null;
    }
  } else if ('activeRun' in winner) {
    resolvedActiveRun = winner.activeRun ? cloneRunSnapshot(winner.activeRun) : null;
  } else if ('activeRun' in loser) {
    resolvedActiveRun = loser.activeRun ? cloneRunSnapshot(loser.activeRun) : null;
  }

  return {
    ...(finalRevision !== undefined ? { revision: finalRevision } : {}),
    ...(finalUpdatedAt !== undefined ? { updatedAt: finalUpdatedAt } : {}),
    ...(mergedMeta !== undefined ? { meta: mergedMeta } : {}),
    ...(resolvedActiveRun !== undefined ? { activeRun: resolvedActiveRun } : {}),
  };
}
