import { describe, expect, it } from 'vitest';
import { createPlayingCard, createStandardDeck } from '../../src/engine/cards';
import {
  COLLECTION_ENHANCEMENTS,
  COLLECTION_SEALS,
  hasAnyUnseenCollectionItems,
  resetCollection,
  unlockAllCollection,
} from '../../src/engine/collection';
import { createInitialHandLevels, getHandLevelStats } from '../../src/engine/handEval';
import { createRngState, nextFloat, nextInt } from '../../src/engine/prng';
import {
  advanceActiveRunTracker,
  countMetaDiscoveries,
  createActiveRunTracker,
  createCompactFallbackSave,
  createInitialMetaSave,
  createPlayerSaveData,
  decodeCompactCard,
  DEFAULT_ANIMATION_SPEED,
  DEFAULT_CRT_MODE,
  encodeCompactCard,
  getMostPlayedHand,
  getMostPlayedHandInRun,
  getRunEndSummary,
  mergePlayerSaveData,
  restoreRunStateFromSnapshot,
  sanitizePlayerSaveData,
  SAVE_SCHEMA_VERSION,
  serializeRunStateToSnapshot,
  SETTINGS_SCHEMA_VERSION,
  updateMetaStatsFromRunState,
} from '../../src/engine/save';
import {
  EDITIONS,
  ENHANCEMENTS,
  HAND_TYPES,
  RANKS,
  SEALS,
  SUITS,
  type MetaSave,
  type PlayerSaveData,
  type PlayingCard,
  type RelicInstance,
  type RunSnapshot,
  type RunState,
} from '../../src/engine/types';
import { trySerializeWithinLimit, utf8ByteLength } from '../../src/platform/storage';

/**
 * Создаёт насыщенное состояние активного забега для проверки lossless-сериализации.
 */
function createRichRunState(): RunState {
  let rng = createRngState('SAVE-TEST-SEED');
  rng = nextFloat(rng, 'shop').nextState;
  rng = nextInt(rng, 'boss', 0, 7).nextState;
  rng = nextFloat(rng, 'shuffle').nextState;
  rng = nextFloat(rng, 'pack').nextState;
  rng = nextFloat(rng, 'lucky').nextState;
  rng = nextFloat(rng, 'glass').nextState;
  rng = nextFloat(rng, 'tag').nextState;

  const baseDeck = createStandardDeck(1);
  const deck: PlayingCard[] = baseDeck.map((card, idx) => {
    if (idx === 0) {
      return createPlayingCard({
        id: card.id,
        suit: card.suit,
        rank: card.rank,
        enhancement: 'glass',
        edition: 'polychrome',
        seal: 'red',
        bonusChips: 25,
        permaBonus: 15,
        debuffed: true,
        playedThisAnte: true,
        facing: 'back',
        forcedSelection: true,
      });
    }
    if (idx === 1) {
      return createPlayingCard({
        id: card.id,
        suit: 'hearts',
        rank: 13,
        enhancement: 'steel',
        edition: 'foil',
        seal: 'gold',
        bonusChips: 10,
        permaBonus: 5,
      });
    }
    return card;
  });

  const relics: RelicInstance[] = [
    {
      uid: 'relic_1',
      id: 'j_runner',
      edition: 'foil',
      baseCost: 5,
      sellValue: 3,
      extraValue: 1,
      debuffed: false,
      state: { chips: 45, mult: 0, xMult: 1, extra: { triggeredCount: 3 } },
    },
    {
      uid: 'relic_2',
      id: 'j_ramen',
      edition: 'negative',
      baseCost: 6,
      sellValue: 3,
      extraValue: 0,
      debuffed: true,
      state: { chips: 0, mult: 0, xMult: 1.87 },
    },
  ];

  const handLevels = createInitialHandLevels();
  const flushFiveStats = getHandLevelStats('Flush Five', 3);
  const pairStats = getHandLevelStats('Pair', 5);
  handLevels['Flush Five'] = {
    level: 3,
    chips: flushFiveStats.chips,
    mult: flushFiveStats.mult,
    playedCount: 2,
    visible: true,
  };
  handLevels.Pair = {
    level: 5,
    chips: pairStats.chips,
    mult: pairStats.mult,
    playedCount: 7,
    visible: true,
  };

  return {
    version: SAVE_SCHEMA_VERSION,
    seed: 'SAVE-TEST-SEED',
    rngState: rng,
    deckId: 'b_black',
    phase: 'booster',
    previousPhase: 'shop',
    ante: 4,
    round: 10,
    currentBlindIndex: 2,
    anteBlinds: [
      { kind: 'small', bossId: null, targetScore: 5000, reward: 3, status: 'skipped', skipTagId: 'tag_double' },
      { kind: 'big', bossId: null, targetScore: 7500, reward: 4, status: 'defeated', skipTagId: 'tag_coupon' },
      { kind: 'boss', bossId: 'bl_wall', targetScore: 20000, reward: 5, status: 'current', skipTagId: null },
    ],
    bossUseCounts: { bl_hook: 1, bl_club: 1, bl_wall: 1 },
    bossRerollsThisAnte: 1,
    activeBossDisabled: false,
    savedBossDiscards: 4,
    endlessMode: false,
    probabilitiesNormal: 2,
    anteScaling: 1,
    score: 14500,
    targetScore: 20000,
    dollars: 37,
    handsLeft: 2,
    maxHands: 4,
    discardsLeft: 1,
    maxDiscards: 3,
    handSize: 9,
    tempHandSizeBonus: 3,
    maxRelics: 6,
    maxConsumables: 3,
    baseRerollCost: 3,
    interestCap: 50,
    shopSlots: 3,
    discountPercent: 25,
    editionRate: 2,
    deck,
    drawPileIds: deck.slice(8, 40).map((c) => c.id),
    handIds: deck.slice(0, 8).map((c) => c.id),
    handSortMode: 'rank',
    discardPileIds: deck.slice(40).map((c) => c.id),
    relics,
    consumables: [
      {
        uid: 'cons_1',
        id: 'c_mercury',
        kind: 'celestial',
        edition: 'negative',
        baseCost: 3,
        sellValue: 1,
      },
      {
        uid: 'cons_2',
        id: 'c_cryptid',
        kind: 'rune',
        edition: 'base',
        baseCost: 4,
        sellValue: 2,
      },
    ],
    charters: ['v_overstock_norm', 'v_clearance_sale', 'v_seed_money'],
    pendingTags: ['tag_investment', 'tag_d_six'],
    skipsCount: 2,
    handsPlayedThisRound: { Pair: 2, 'Two Pair': 1 },
    handLevels,
    lastUsedConsumableId: 'c_mercury',
    lastPlayedHandType: 'Pair',
    shop: {
      offers: [
        {
          uid: 'offer_1',
          kind: 'relic',
          relic: {
            uid: 'relic_shop_1',
            id: 'j_blueprint',
            edition: 'holo',
            baseCost: 10,
            sellValue: 5,
            extraValue: 0,
            debuffed: false,
            state: { chips: 0, mult: 0, xMult: 1 },
          },
          cost: 10,
          baseCost: 10,
          sold: false,
        },
        {
          uid: 'offer_2',
          kind: 'card',
          card: deck[1]!,
          cost: 2,
          baseCost: 2,
          sold: true,
        },
      ],
      voucher: {
        uid: 'voucher_1',
        charterId: 'v_telescope',
        cost: 8,
        baseCost: 10,
        sold: false,
      },
      packs: [
        {
          uid: 'pack_1',
          packId: 'p_arcana_mega_1',
          type: 'arcana',
          size: 'mega',
          cost: 6,
          baseCost: 8,
          totalCards: 5,
          chooseCount: 2,
          purchased: true,
        },
      ],
      rerollCost: 6,
      tempRerollCost: 0,
      rerollsUsedThisShop: 3,
    },
    shopVisits: 7,
    booster: {
      packId: 'p_arcana_mega_1',
      packType: 'arcana',
      packSize: 'mega',
      choices: [
        {
          uid: 'choice_1',
          kind: 'consumable',
          consumable: {
            uid: 'cons_pack_1',
            id: 'c_hermit',
            kind: 'scroll',
            edition: 'base',
            baseCost: 3,
            sellValue: 1,
          },
          picked: false,
        },
      ],
      remainingPicks: 2,
      drawnHandCardIds: [deck[0]!.id, deck[1]!.id],
      fromTag: true,
    },
    cashout: {
      blindReward: 4,
      unusedHandsBonus: 2,
      interestBonus: 5,
      relicBonus: 4,
      tagBonus: 0,
      totalReward: 15,
    },
    nextCardUid: 53,
    stats: {
      bestHandScore: 18950,
      bestHandType: 'Flush',
      handsPlayed: 22,
      cardsPlayed: 84,
      discardsUsed: 11,
      cardsDiscarded: 39,
      cardsPurchased: 14,
      rerollsCount: 6,
      cardsDestroyed: 3,
      dollarsSpent: 64,
    },
  };
}

describe('SAVE_SCHEMA_VERSION и createInitialMetaSave', () => {
  it('создаёт валидный начальный профиль MetaSave с дефолтной скоростью 1x, crtMode light и Алой колодой', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(1);
    expect(DEFAULT_ANIMATION_SPEED).toBe(1);
    expect(DEFAULT_CRT_MODE).toBe('light');
    expect(SETTINGS_SCHEMA_VERSION).toBe(2);

    const meta = createInitialMetaSave(1700000000123);
    expect(meta).toEqual({
      version: 1,
      revision: 0,
      updatedAt: 1700000000123,
      settings: {
        animationSpeed: 1,
        lang: 'ru',
        soundEnabled: true,
        crtMode: 'light',
        settingsVersion: 2,
      },
      unlockedDecks: ['b_red'],
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
    });
  });

  it('поддерживает опции инициализации (включая 0.5x и 2x) и защищается от невалидного nowMs', () => {
    const meta = createInitialMetaSave(Number.NaN, {
      lang: 'en',
      animationSpeed: 4,
      soundEnabled: false,
      crtMode: 'original',
      musicVolume: 0.4,
      sfxVolume: 1.5,
      revision: 2,
      unlockedDecks: ['b_red', 'b_blue', 'b_red'],
    });

    expect(meta.updatedAt).toBe(0);
    expect(meta.revision).toBe(2);
    expect(meta.settings).toEqual({
      animationSpeed: 4,
      lang: 'en',
      soundEnabled: false,
      crtMode: 'original',
      musicVolume: 0.4,
      sfxVolume: 1,
      settingsVersion: 2,
    });
    expect(meta.unlockedDecks).toEqual(['b_red', 'b_blue']);

    const slowMeta = createInitialMetaSave(100, { animationSpeed: 0.5, crtMode: 'off' });
    expect(slowMeta.settings.animationSpeed).toBe(0.5);
    expect(slowMeta.settings.crtMode).toBe('off');

    const doubleMeta = createInitialMetaSave(100, { animationSpeed: 2 });
    expect(doubleMeta.settings.animationSpeed).toBe(2);
  });
});

describe('encodeCompactCard и decodeCompactCard', () => {
  it('кодирует и декодирует все 4 бита флагов и все перечисления без потерь', () => {
    const bitFlags = [
      { debuffed: false, playedThisAnte: false, facing: 'front' as const, forcedSelection: false, expected: 0 },
      { debuffed: true, playedThisAnte: false, facing: 'front' as const, forcedSelection: false, expected: 1 },
      { debuffed: false, playedThisAnte: true, facing: 'front' as const, forcedSelection: false, expected: 2 },
      { debuffed: false, playedThisAnte: false, facing: 'back' as const, forcedSelection: false, expected: 4 },
      { debuffed: false, playedThisAnte: false, facing: 'front' as const, forcedSelection: true, expected: 8 },
      { debuffed: true, playedThisAnte: true, facing: 'back' as const, forcedSelection: true, expected: 15 },
    ];

    for (const flagsCase of bitFlags) {
      const card = createPlayingCard({
        id: `c_${flagsCase.expected}`,
        suit: 'diamonds',
        rank: 14,
        enhancement: 'lucky',
        edition: 'negative',
        seal: 'purple',
        bonusChips: 30,
        permaBonus: 12,
        debuffed: flagsCase.debuffed,
        playedThisAnte: flagsCase.playedThisAnte,
        facing: flagsCase.facing,
        forcedSelection: flagsCase.forcedSelection,
      });

      const tuple = encodeCompactCard(card);
      expect(tuple[8]).toBe(flagsCase.expected);
      expect(decodeCompactCard(tuple)).toEqual(card);
    }

    for (let s = 0; s < SUITS.length; s += 1) {
      for (let e = 0; e < ENHANCEMENTS.length; e += 1) {
        const card = createPlayingCard({
          id: `combo_${s}_${e}`,
          suit: SUITS[s]!,
          rank: RANKS[(s + e) % RANKS.length]!,
          enhancement: ENHANCEMENTS[e]!,
          edition: EDITIONS[e % EDITIONS.length]!,
          seal: SEALS[e % SEALS.length]!,
        });
        expect(decodeCompactCard(encodeCompactCard(card))).toEqual(card);
      }
    }
  });
});

describe('serializeRunStateToSnapshot и restoreRunStateFromSnapshot', () => {
  it('выполняет точный lossless round-trip полного RunState с PRNG-стримами, колодой и состояниями подсистем', () => {
    const state = createRichRunState();
    const snapshot: RunSnapshot = serializeRunStateToSnapshot(state, 14, 1700000123456);

    expect(snapshot.version).toBe(SAVE_SCHEMA_VERSION);
    expect(snapshot.revision).toBe(14);
    expect(snapshot.updatedAt).toBe(1700000123456);
    expect(snapshot.compactDeck).toHaveLength(52);
    expect(snapshot.handLevels['Flush Five']).toEqual([3, 2, 1]);
    expect(snapshot.handLevels['Five of a Kind']).toEqual([1, 0, 0]);

    const restored = restoreRunStateFromSnapshot(snapshot);
    expect(restored).toEqual(state);

    // Детерминированность PRNG после восстановления должна совпадать побайтово
    expect(nextFloat(restored.rngState, 'shop')).toEqual(nextFloat(state.rngState, 'shop'));
    expect(nextInt(restored.rngState, 'glass', 1, 4)).toEqual(nextInt(state.rngState, 'glass', 1, 4));
  });

  it('изолирует восстановленное состояние от последующих мутаций исходных структур', () => {
    const state = createRichRunState();
    const snapshot = serializeRunStateToSnapshot(state, 1, 100);
    const restored = restoreRunStateFromSnapshot(snapshot);

    expect(restored.relics[0]).not.toBe(state.relics[0]);
    expect(restored.rngState.streams).not.toBe(state.rngState.streams);
    expect(restored.shop).not.toBe(state.shop);
    expect(restored.booster).not.toBe(state.booster);
    expect(restored.anteBlinds[0]).not.toBe(state.anteBlinds[0]);
  });

  it('чинит статус upcoming -> current у активного узла в фазе blind_select при загрузке старого снимка', () => {
    const state = createRichRunState();
    const brokenBlindState: RunState = {
      ...state,
      phase: 'blind_select',
      currentBlindIndex: 1,
      anteBlinds: [
        { ...state.anteBlinds[0], status: 'defeated' },
        { ...state.anteBlinds[1], status: 'upcoming' },
        { ...state.anteBlinds[2], status: 'upcoming' },
      ],
    };
    const snapshot = serializeRunStateToSnapshot(brokenBlindState, 1, 100);
    const restored = restoreRunStateFromSnapshot(snapshot);
    expect(restored.anteBlinds[1].status).toBe('current');
  });
});

describe('createPlayerSaveData и createCompactFallbackSave', () => {
  it('создаёт согласованный PlayerSaveData и компактный fallback для лимита 4000 байт VK/OK', () => {
    const state = createRichRunState();
    const meta: MetaSave = {
      ...createInitialMetaSave(1700000000000, { unlockedDecks: ['b_red', 'b_blue', 'b_black'] }),
      discoveredRelics: ['j_runner', 'j_ramen', 'j_blueprint'],
      discoveredConsumables: ['c_mercury', 'c_cryptid', 'c_hermit'],
      discoveredCharters: ['v_overstock_norm', 'v_clearance_sale', 'v_seed_money'],
      discoveredBosses: ['bl_hook', 'bl_wall'],
      stats: {
        runsStarted: 4,
        runsWon: 1,
        highestAnte: 8,
        highestRound: 24,
        bestHandScore: 18950,
        maxDollars: 65,
        bestWinStreak: 2,
        currentWinStreak: 1,
        totalHandsPlayed: 95,
        handPlayCounts: {
          Pair: 40,
          Flush: 25,
          'Full House': 12,
        },
      },
    };
    const snapshot = serializeRunStateToSnapshot(state, 9, 1700000055555);
    const saveData: PlayerSaveData = createPlayerSaveData(meta, snapshot, 9, 1700000055555);

    expect(saveData.revision).toBe(9);
    expect(saveData.updatedAt).toBe(1700000055555);
    expect(saveData.meta.revision).toBe(9);
    expect(saveData.meta.updatedAt).toBe(1700000055555);
    expect(saveData.activeRun?.revision).toBe(9);

    // Полный снимок насыщенного забега превышает 4000 байт
    expect(utf8ByteLength(JSON.stringify(saveData))).toBeGreaterThan(4000);

    const fallback = createCompactFallbackSave(saveData);
    expect(fallback.activeRun).toBeNull();
    expect(fallback.revision).toBe(9);
    expect(fallback.updatedAt).toBe(1700000055555);
    expect(fallback.meta.version).toBe(SAVE_SCHEMA_VERSION);
    expect(fallback.meta.unlockedDecks).toEqual(['b_red', 'b_blue', 'b_black']);
    expect(fallback.meta.discoveredRelics).toEqual(['j_runner', 'j_ramen', 'j_blueprint']);
    expect(fallback.meta.stats.bestHandScore).toBe(18950);

    const serializedWithin4k = trySerializeWithinLimit(saveData, 4000, createCompactFallbackSave);
    expect(serializedWithin4k).not.toBeNull();
    expect(utf8ByteLength(serializedWithin4k!)).toBeLessThanOrEqual(4000);
    expect(JSON.parse(serializedWithin4k!)).toEqual(fallback);
  });
});

describe('sanitizePlayerSaveData', () => {
  it('отклоняет некорректные корневые значения и несовместимую версию схемы', () => {
    expect(sanitizePlayerSaveData(null)).toEqual({});
    expect(sanitizePlayerSaveData(undefined)).toEqual({});
    expect(sanitizePlayerSaveData('broken')).toEqual({});
    expect(sanitizePlayerSaveData([1, 2, 3])).toEqual({});
    expect(sanitizePlayerSaveData({ version: 99, revision: 1 })).toEqual({});
    expect(
      sanitizePlayerSaveData({
        revision: 3,
        updatedAt: 5000,
        meta: { version: 999, unlockedDecks: ['b_red'] },
        activeRun: { version: 2, seed: 'ABC' },
      }),
    ).toEqual({
      revision: 3,
      updatedAt: 5000,
      activeRun: null,
    });
  });

  it('чинит частично повреждённый MetaSave и отбрасывает битый activeRun без потери мета-прогресса', () => {
    const sanitized = sanitizePlayerSaveData({
      revision: 4,
      updatedAt: 123456,
      meta: {
        version: 1,
        settings: {
          animationSpeed: 99,
          lang: 'de',
          soundEnabled: 'yes',
          musicVolume: 2.5,
        },
        unlockedDecks: ['b_red', 'unknown_deck', 'b_yellow', 'b_red'],
        discoveredRelics: ['j_joker', 'invalid_relic'],
        discoveredConsumables: ['c_mercury', 123],
        discoveredCharters: ['v_hone', 'bad'],
        discoveredBosses: ['bl_wall', null],
        stats: {
          runsStarted: -10,
          runsWon: 2,
          highestAnte: 'NaN',
          highestRound: -3,
          bestHandScore: 4200,
          maxDollars: 'oops',
          bestWinStreak: 1,
          currentWinStreak: 3,
          totalHandsPlayed: 15,
          handPlayCounts: {
            Pair: 6.9,
            Flush: 0,
            Straight: -2,
            InvalidHand: 99,
          },
        },
      },
      activeRun: {
        version: 1,
        seed: 'BROKEN',
        compactDeck: [['bad_tuple']],
      },
    });

    expect(sanitized.revision).toBe(4);
    expect(sanitized.updatedAt).toBe(123456);
    expect(sanitized.activeRun).toBeNull();
    expect(sanitized.meta).toEqual({
      version: 1,
      revision: 4,
      updatedAt: 123456,
      settings: {
        animationSpeed: 1,
        lang: 'ru',
        soundEnabled: true,
        crtMode: 'light',
        musicVolume: 1,
        settingsVersion: 2,
      },
      unlockedDecks: ['b_red', 'b_yellow'],
      discoveredRelics: ['j_joker'],
      discoveredConsumables: ['c_mercury'],
      discoveredCharters: ['v_hone'],
      discoveredBosses: ['bl_wall'],
      stats: {
        runsStarted: 0,
        runsWon: 2,
        highestAnte: 0,
        highestRound: 0,
        bestHandScore: 4200,
        maxDollars: 0,
        bestWinStreak: 3,
        currentWinStreak: 3,
        totalHandsPlayed: 15,
        handPlayCounts: {
          Pair: 6,
        },
      },
    });
  });

  it('сохраняет валидный полный PlayerSaveData после санитизации', () => {
    const state = createRichRunState();
    const meta = createInitialMetaSave(5000);
    const snapshot = serializeRunStateToSnapshot(state, 3, 5000);
    const full = createPlayerSaveData(meta, snapshot, 3, 5000);

    const parsed = JSON.parse(JSON.stringify(full)) as unknown;
    expect(sanitizePlayerSaveData(parsed)).toEqual(full);
  });

  it('отбрасывает activeRun при повреждении rngState, handLevels, shop, booster или ante, сохраняя meta', () => {
    const state = createRichRunState();
    const meta = createInitialMetaSave(5000);
    const baseSnapshot = serializeRunStateToSnapshot(state, 2, 5000);

    const brokenCases: Array<Record<string, unknown>> = [
      { ...baseSnapshot, ante: 0 },
      { ...baseSnapshot, deckId: 'unknown_deck' },
      { ...baseSnapshot, phase: 'invalid_phase' },
      { ...baseSnapshot, rngState: { seed: 'X', streams: { shop: 1 } } },
      { ...baseSnapshot, handLevels: { Pair: [1, 0, 1] } },
      { ...baseSnapshot, shop: { offers: 'bad' } },
      { ...baseSnapshot, booster: { packId: 123 } },
      { ...baseSnapshot, relics: [{ uid: 'r1', id: 'bad_relic' }] },
      { ...baseSnapshot, consumables: [{ uid: 'c1', kind: 'scroll', id: 'c_mercury', edition: 'base', baseCost: 3, sellValue: 1 }] },
    ];

    for (const brokenRun of brokenCases) {
      const sanitized = sanitizePlayerSaveData({
        revision: 2,
        updatedAt: 5000,
        meta,
        activeRun: brokenRun,
      });
      expect(sanitized.activeRun).toBeNull();
      expect(sanitized.meta?.version).toBe(SAVE_SCHEMA_VERSION);
    }
  });

  it('мигрирует старые сохранения v1 со скоростью по умолчанию 2 на 1, сохраняет явный выбор 1/4/0.5 и удерживает лимит 4000 байт', () => {
    // Старое сохранение v1 без settingsVersion со старым дефолтом 2 -> мигрирует на 1
    const legacyDefaultSave = {
      revision: 5,
      updatedAt: 9000,
      meta: {
        version: 1,
        settings: {
          animationSpeed: 2,
          lang: 'ru',
          soundEnabled: true,
        },
        unlockedDecks: ['b_red'],
      },
      activeRun: serializeRunStateToSnapshot(createRichRunState(), 5, 9000),
    };

    const migrated = sanitizePlayerSaveData(legacyDefaultSave);
    expect(migrated.meta?.settings.animationSpeed).toBe(1);
    expect(migrated.meta?.settings.settingsVersion).toBe(2);

    // Компактный fallback после миграции укладывается в 4000 байт VK/OK
    const fallbackJson = trySerializeWithinLimit(
      migrated as PlayerSaveData,
      4000,
      createCompactFallbackSave,
    );
    expect(fallbackJson).not.toBeNull();
    expect(utf8ByteLength(fallbackJson!)).toBeLessThanOrEqual(4000);
    const parsedFallback = JSON.parse(fallbackJson!) as PlayerSaveData;
    expect(parsedFallback.meta.settings.animationSpeed).toBe(1);
    expect(parsedFallback.meta.settings.settingsVersion).toBe(2);

    // Старое сохранение v1 без settingsVersion, но с явно выбранной скоростью 4 или 1 -> выбор сохраняется
    const legacyFast = sanitizePlayerSaveData({
      revision: 6,
      updatedAt: 10000,
      meta: {
        version: 1,
        settings: {
          animationSpeed: 4,
          lang: 'en',
          soundEnabled: false,
        },
      },
    });
    expect(legacyFast.meta?.settings.animationSpeed).toBe(4);
    expect(legacyFast.meta?.settings.settingsVersion).toBe(2);

    // Старое сохранение без поля settings или без animationSpeed -> получает 1
    const legacyMissingSpeed = sanitizePlayerSaveData({
      revision: 7,
      updatedAt: 11000,
      meta: {
        version: 1,
        settings: {
          lang: 'ru',
          soundEnabled: true,
        },
      },
    });
    expect(legacyMissingSpeed.meta?.settings.animationSpeed).toBe(1);
    expect(legacyMissingSpeed.meta?.settings.settingsVersion).toBe(2);

    // Новое сохранение с settingsVersion: 2 сохраняет осознанный выбор 2x и 0.5x
    const modernDouble = sanitizePlayerSaveData({
      revision: 8,
      updatedAt: 12000,
      meta: {
        version: 1,
        settings: {
          animationSpeed: 2,
          lang: 'ru',
          soundEnabled: true,
          settingsVersion: 2,
        },
      },
    });
    expect(modernDouble.meta?.settings.animationSpeed).toBe(2);
    expect(modernDouble.meta?.settings.settingsVersion).toBe(2);

    const modernSlow = sanitizePlayerSaveData({
      revision: 9,
      updatedAt: 13000,
      meta: {
        version: 1,
        settings: {
          animationSpeed: 0.5,
          lang: 'en',
          soundEnabled: true,
          settingsVersion: 2,
        },
      },
    });
    expect(modernSlow.meta?.settings.animationSpeed).toBe(0.5);
    expect(modernSlow.meta?.settings.crtMode).toBe('light');

    // Старое сохранение без crtMode или с невалидным crtMode -> безопасно мигрирует на 'light', а валидные 'off'/'original' сохраняются
    const legacyNoCrt = sanitizePlayerSaveData({
      revision: 10,
      updatedAt: 14000,
      meta: {
        version: 1,
        settings: {
          animationSpeed: 1,
          lang: 'ru',
          soundEnabled: true,
          crtMode: 'invalid_crt',
          settingsVersion: 2,
        },
      },
    });
    expect(legacyNoCrt.meta?.settings.crtMode).toBe('light');

    const modernCrtOff = sanitizePlayerSaveData({
      revision: 11,
      updatedAt: 15000,
      meta: {
        version: 1,
        settings: {
          animationSpeed: 1,
          lang: 'ru',
          soundEnabled: true,
          crtMode: 'off',
          settingsVersion: 2,
        },
      },
    });
    expect(modernCrtOff.meta?.settings.crtMode).toBe('off');

    const compactWithCrtJson = trySerializeWithinLimit(
      createPlayerSaveData(modernCrtOff.meta!, null, 11, 15000),
      4000,
      createCompactFallbackSave,
    );
    expect(compactWithCrtJson).not.toBeNull();
    expect(utf8ByteLength(compactWithCrtJson!)).toBeLessThanOrEqual(4000);
    expect((JSON.parse(compactWithCrtJson!) as PlayerSaveData).meta.settings.crtMode).toBe('off');
  });

  it('мигрирует старое сохранение MetaStats без новых полей и сохраняет лимит 4000 байт при всех 12 handPlayCounts', () => {
    const legacySave = {
      revision: 12,
      updatedAt: 50_000,
      meta: {
        version: 1,
        settings: {
          animationSpeed: 1,
          lang: 'ru',
          soundEnabled: true,
          settingsVersion: 2,
        },
        unlockedDecks: ['b_red', 'b_blue'],
        stats: {
          runsStarted: 7,
          runsWon: 3,
          highestAnte: 8,
          bestHandScore: 31500,
          totalHandsPlayed: 110,
        },
      },
      activeRun: null,
    };

    const migrated = sanitizePlayerSaveData(legacySave);
    expect(migrated.meta?.stats).toEqual({
      runsStarted: 7,
      runsWon: 3,
      highestAnte: 8,
      highestRound: 0,
      bestHandScore: 31500,
      maxDollars: 0,
      bestWinStreak: 0,
      currentWinStreak: 0,
      totalHandsPlayed: 110,
      handPlayCounts: {},
    });

    // Проверяем, что даже со всеми 12 handPlayCounts компактный fallback укладывается в 4000 байт
    const allCounts = Object.fromEntries(HAND_TYPES.map((hand, idx) => [hand, idx + 1]));
    const fullMeta = {
      ...migrated.meta!,
      stats: {
        ...migrated.meta!.stats,
        highestRound: 27,
        maxDollars: 145,
        bestWinStreak: 4,
        currentWinStreak: 2,
        handPlayCounts: allCounts,
      },
    };
    const fullSave = createPlayerSaveData(
      fullMeta,
      serializeRunStateToSnapshot(createRichRunState(), 12, 50_000),
      12,
      50_000,
    );
    const compactJson = trySerializeWithinLimit(fullSave, 4000, createCompactFallbackSave);
    expect(compactJson).not.toBeNull();
    expect(utf8ByteLength(compactJson!)).toBeLessThanOrEqual(4000);
    const parsedCompact = JSON.parse(compactJson!) as PlayerSaveData;
    expect(parsedCompact.meta.stats.handPlayCounts).toEqual(allCounts);
    expect(parsedCompact.meta.stats.highestRound).toBe(27);
  });
});

describe('mergePlayerSaveData', () => {
  it('не позволяет устаревшему облачному сейву перезаписать более новый локальный прогресс', () => {
    const state = createRichRunState();
    const localMeta: MetaSave = {
      ...createInitialMetaSave(2000, { lang: 'ru', animationSpeed: 4, soundEnabled: false }),
      unlockedDecks: ['b_red', 'b_blue'],
      discoveredRelics: ['j_joker', 'j_blueprint'],
      stats: {
        runsStarted: 6,
        runsWon: 2,
        highestAnte: 8,
        highestRound: 24,
        bestHandScore: 25000,
        maxDollars: 88,
        bestWinStreak: 3,
        currentWinStreak: 0,
        totalHandsPlayed: 120,
        handPlayCounts: { Pair: 30, Flush: 15 },
      },
    };
    const localRun = serializeRunStateToSnapshot(state, 8, 2000);
    const local = createPlayerSaveData(localMeta, localRun, 8, 2000);

    const staleCloudMeta: MetaSave = {
      ...createInitialMetaSave(1000, { lang: 'en', animationSpeed: 1, soundEnabled: true }),
      unlockedDecks: ['b_red', 'b_yellow'],
      discoveredRelics: ['j_joker', 'j_baron'],
      stats: {
        runsStarted: 2,
        runsWon: 0,
        highestAnte: 3,
        highestRound: 26,
        bestHandScore: 1500,
        maxDollars: 120,
        bestWinStreak: 5,
        currentWinStreak: 2,
        totalHandsPlayed: 20,
        handPlayCounts: { Pair: 10, Straight: 9 },
      },
    };
    const staleCloud = createPlayerSaveData(staleCloudMeta, null, 3, 1000);

    const merged = mergePlayerSaveData(local, staleCloud);
    expect(merged.revision).toBe(8);
    expect(merged.updatedAt).toBe(2000);
    expect(merged.activeRun).toEqual(localRun);
    expect(merged.meta?.settings).toEqual(localMeta.settings);
    expect(merged.meta?.unlockedDecks).toEqual(['b_red', 'b_blue', 'b_yellow']);
    expect(merged.meta?.discoveredRelics).toEqual(['j_joker', 'j_blueprint', 'j_baron']);
    expect(merged.meta?.stats).toEqual({
      runsStarted: 6,
      runsWon: 2,
      highestAnte: 8,
      highestRound: 26,
      bestHandScore: 25000,
      maxDollars: 120,
      bestWinStreak: 5,
      // currentWinStreak берётся от более свежего локального сейва
      currentWinStreak: 0,
      totalHandsPlayed: 120,
      handPlayCounts: { Pair: 30, Flush: 15, Straight: 9 },
    });
  });

  it('использует updatedAt как тай-брейкер при равной ревизии и применяет более свежий облачный сейв', () => {
    const state = createRichRunState();
    const localMeta = createInitialMetaSave(1000, { lang: 'ru', animationSpeed: 2, crtMode: 'off' });
    const cloudMeta = createInitialMetaSave(3000, { lang: 'en', animationSpeed: 4, crtMode: 'original' });
    const cloudRun = serializeRunStateToSnapshot(state, 5, 3000);

    const local = createPlayerSaveData(localMeta, null, 5, 1000);
    const cloud = createPlayerSaveData(cloudMeta, cloudRun, 5, 3000);

    const merged = mergePlayerSaveData(local, cloud);
    expect(merged.revision).toBe(5);
    expect(merged.updatedAt).toBe(3000);
    expect(merged.activeRun).toEqual(cloudRun);
    expect(merged.meta?.settings).toEqual(cloudMeta.settings);
  });

  it('при одинаковых revision и updatedAt сохраняет локальный activeRun, если в облаке compactFallback (activeRun: null)', () => {
    const state = createRichRunState();
    const localMeta: MetaSave = {
      ...createInitialMetaSave(4000, { lang: 'ru', animationSpeed: 2 }),
      unlockedDecks: ['b_red', 'b_blue'],
      discoveredRelics: ['j_runner'],
      stats: {
        runsStarted: 3,
        runsWon: 0,
        highestAnte: 4,
        highestRound: 11,
        bestHandScore: 18950,
        maxDollars: 42,
        bestWinStreak: 1,
        currentWinStreak: 0,
        totalHandsPlayed: 40,
        handPlayCounts: { Pair: 18 },
      },
    };
    const localRun = serializeRunStateToSnapshot(state, 7, 4000);
    const local = createPlayerSaveData(localMeta, localRun, 7, 4000);

    const cloudFallback = createCompactFallbackSave({
      ...local,
      meta: {
        ...localMeta,
        unlockedDecks: ['b_red', 'b_black'],
        discoveredBosses: ['bl_wall'],
      },
    });

    const merged = mergePlayerSaveData(local, cloudFallback);
    expect(merged.revision).toBe(7);
    expect(merged.updatedAt).toBe(4000);
    expect(merged.activeRun).toEqual(localRun);
    expect(merged.meta?.unlockedDecks).toEqual(['b_red', 'b_blue', 'b_black']);
    expect(merged.meta?.discoveredRelics).toEqual(['j_runner']);
    expect(merged.meta?.discoveredBosses).toEqual(['bl_wall']);
  });
});

describe('updateMetaStatsFromRunState и getMostPlayedHand', () => {
  it('обновляет highestRound, maxDollars, handPlayCounts, серии побед и определяет самый частый расклад', () => {
    const baseMeta = createInitialMetaSave(1000);
    const baseRun = createRichRunState();

    // Начало забега
    const startedStats = updateMetaStatsFromRunState(
      baseMeta.stats,
      { ...baseRun, ante: 1, round: 0, dollars: 4, stats: { ...baseRun.stats, bestHandScore: 0 } },
      { runStarted: true },
    );
    expect(startedStats.runsStarted).toBe(1);
    expect(startedStats.maxDollars).toBe(4);
    expect(getMostPlayedHand(startedStats)).toBeNull();

    // Сыграны две руки: Flush и Pair, затем ещё Flush
    const afterHand1 = updateMetaStatsFromRunState(
      startedStats,
      {
        ...baseRun,
        ante: 2,
        round: 5,
        dollars: 22,
        lastPlayedHandType: 'Flush',
        stats: { ...baseRun.stats, bestHandScore: 1200 },
      },
      { handPlayed: true },
    );
    const afterHand2 = updateMetaStatsFromRunState(
      afterHand1,
      {
        ...baseRun,
        ante: 3,
        round: 8,
        dollars: -3,
        lastPlayedHandType: 'Pair',
        stats: { ...baseRun.stats, bestHandScore: 900 },
      },
      { handPlayed: true },
    );
    const afterHand3 = updateMetaStatsFromRunState(
      afterHand2,
      {
        ...baseRun,
        ante: 8,
        round: 24,
        dollars: 55,
        lastPlayedHandType: 'Flush',
        stats: { ...baseRun.stats, bestHandScore: 24000 },
      },
      { handPlayed: true },
    );

    expect(afterHand3.totalHandsPlayed).toBe(3);
    expect(afterHand3.highestAnte).toBe(8);
    expect(afterHand3.highestRound).toBe(24);
    expect(afterHand3.maxDollars).toBe(55);
    expect(afterHand3.bestHandScore).toBe(24000);
    expect(afterHand3.handPlayCounts).toEqual({ Flush: 2, Pair: 1 });
    expect(getMostPlayedHand(afterHand3)).toEqual({ handType: 'Flush', count: 2 });

    // Победа на 8-м Этапе увеличивает серию побед
    const afterWin1 = updateMetaStatsFromRunState(
      afterHand3,
      { ...baseRun, phase: 'victory', ante: 8, round: 24 },
      { runWon: true },
    );
    expect(afterWin1.runsWon).toBe(1);
    expect(afterWin1.currentWinStreak).toBe(1);
    expect(afterWin1.bestWinStreak).toBe(1);

    // Вторая победа подряд
    const afterWin2 = updateMetaStatsFromRunState(
      afterWin1,
      { ...baseRun, phase: 'victory', ante: 8, round: 25 },
      { runWon: true },
    );
    expect(afterWin2.runsWon).toBe(2);
    expect(afterWin2.currentWinStreak).toBe(2);
    expect(afterWin2.bestWinStreak).toBe(2);

    // Поражение в бесконечном режиме НЕ сбрасывает текущую серию побед
    const afterEndlessLoss = updateMetaStatsFromRunState(
      afterWin2,
      { ...baseRun, phase: 'game_over', endlessMode: true, ante: 10, round: 30 },
      { runLost: true },
    );
    expect(afterEndlessLoss.currentWinStreak).toBe(2);
    expect(afterEndlessLoss.bestWinStreak).toBe(2);
    expect(afterEndlessLoss.highestRound).toBe(30);

    // Поражение в обычном забеге сбрасывает currentWinStreak, но сохраняет bestWinStreak
    const afterNormalLoss = updateMetaStatsFromRunState(
      afterEndlessLoss,
      { ...baseRun, phase: 'game_over', endlessMode: false, ante: 4, round: 10 },
      { runLost: true },
    );
    expect(afterNormalLoss.currentWinStreak).toBe(0);
    expect(afterNormalLoss.bestWinStreak).toBe(2);
  });
});

describe('миграция RunStats, activeRunTracker и getRunEndSummary', () => {
  it('безопасно мигрирует старый RunSnapshot без новых полей RunStats и отбрасывает битый activeRun', () => {
    const state = createRichRunState();
    const meta = createInitialMetaSave(20_000);
    const snapshot = serializeRunStateToSnapshot(state, 3, 20_000);

    // Имитируем старый снимок v1 без cardsPlayed / cardsDiscarded / cardsPurchased / rerollsCount / bestHandType
    const legacyRunSnapshot = {
      ...snapshot,
      stats: {
        bestHandScore: 1234,
        handsPlayed: 7,
        discardsUsed: 4,
        cardsDestroyed: 1,
        dollarsSpent: 15,
      },
    };

    const sanitized = sanitizePlayerSaveData({
      revision: 3,
      updatedAt: 20_000,
      meta,
      activeRun: legacyRunSnapshot,
    });
    expect(sanitized.activeRun).not.toBeNull();
    expect(sanitized.activeRun?.stats).toEqual({
      bestHandScore: 1234,
      bestHandType: null,
      handsPlayed: 7,
      cardsPlayed: 0,
      discardsUsed: 4,
      cardsDiscarded: 0,
      cardsPurchased: 0,
      rerollsCount: 0,
      cardsDestroyed: 1,
      dollarsSpent: 15,
    });

    // Невалидное значение нового поля отбрасывает activeRun, не теряя meta
    const brokenRun = {
      ...snapshot,
      stats: {
        ...snapshot.stats,
        cardsPlayed: -5,
      },
    };
    const sanitizedBroken = sanitizePlayerSaveData({
      revision: 4,
      updatedAt: 21_000,
      meta,
      activeRun: brokenRun,
    });
    expect(sanitizedBroken.activeRun).toBeNull();
    expect(sanitizedBroken.meta?.version).toBe(SAVE_SCHEMA_VERSION);
  });

  it('строит getRunEndSummary с частой рукой забега, стражем, новыми открытиями и флагами рекорда под лимит 4000 байт', () => {
    const baseRun = createRichRunState();
    const prevMeta: MetaSave = {
      ...createInitialMetaSave(1000),
      discoveredRelics: ['j_joker'],
      stats: {
        ...createInitialMetaSave(1000).stats,
        bestHandScore: 10000,
        highestAnte: 5,
        highestRound: 10,
      },
    };

    const startTracker = createActiveRunTracker(prevMeta);
    expect(startTracker).toEqual({
      baselineBestHandScore: 10000,
      baselineHighestAnte: 5,
      baselineHighestRound: 10,
      newDiscoveries: 0,
    });

    const nextMeta: MetaSave = {
      ...prevMeta,
      discoveredRelics: ['j_joker', 'j_runner', 'j_blueprint'],
      discoveredBosses: ['bl_wall'],
      activeRunTracker: startTracker,
    };
    const updatedTracker = advanceActiveRunTracker(prevMeta, nextMeta, false);
    expect(updatedTracker.newDiscoveries).toBe(3);

    const metaWithTracker: MetaSave = {
      ...nextMeta,
      activeRunTracker: updatedTracker,
    };

    // Проверяем сохранность activeRunTracker при санитизации и соблюдение 4000 байт в compactFallback
    const saveData = createPlayerSaveData(
      metaWithTracker,
      serializeRunStateToSnapshot(baseRun, 8, 50_000),
      8,
      50_000,
    );
    const sanitized = sanitizePlayerSaveData(JSON.parse(JSON.stringify(saveData)) as unknown);
    expect(sanitized.meta?.activeRunTracker).toEqual(updatedTracker);

    const compactJson = trySerializeWithinLimit(saveData, 4000, createCompactFallbackSave);
    expect(compactJson).not.toBeNull();
    expect(utf8ByteLength(compactJson!)).toBeLessThanOrEqual(4000);

    // Итог забега: ante=4 (не рекорд), round=10 (не рекорд), bestHandScore=18950 (рекорд!), Pair=7 (чаще Flush Five=2)
    const lostRun: RunState = {
      ...baseRun,
      phase: 'game_over',
    };
    expect(getMostPlayedHandInRun(lostRun)).toEqual({ handType: 'Pair', count: 7 });

    const summary = getRunEndSummary(lostRun, metaWithTracker);
    expect(summary).toEqual({
      outcome: 'game_over',
      seed: 'SAVE-TEST-SEED',
      ante: 4,
      round: 10,
      bestHandScore: 18950,
      bestHandType: 'Flush',
      mostPlayedHand: { handType: 'Pair', count: 7 },
      cardsPlayed: 84,
      cardsDiscarded: 39,
      cardsPurchased: 14,
      rerollsCount: 6,
      newDiscoveries: 3,
      defeatedBy: {
        kind: 'boss',
        bossId: 'bl_wall',
      },
      records: {
        bestHandScore: true,
        highestAnte: false,
        highestRound: false,
      },
    });
  });

  it('сохраняет и восстанавливает handSortMode с откатом к rank для старых снимков', () => {
    const suitRun: RunState = {
      ...createRichRunState(),
      handSortMode: 'suit',
    };

    const snapshot = serializeRunStateToSnapshot(suitRun, 1, 1_000);
    expect(snapshot.handSortMode).toBe('suit');

    const saveData = createPlayerSaveData(
      createInitialMetaSave(1_000, { revision: 1 }),
      snapshot,
      1,
      1_000,
    );
    const sanitized = sanitizePlayerSaveData(
      JSON.parse(JSON.stringify(saveData)) as unknown,
    );
    expect(sanitized.activeRun?.handSortMode).toBe('suit');
    const restored = restoreRunStateFromSnapshot(sanitized.activeRun!);
    expect(restored.handSortMode).toBe('suit');

    // Старый снимок без поля handSortMode восстанавливается с 'rank' по умолчанию
    const legacyRaw = JSON.parse(JSON.stringify(saveData)) as Record<string, unknown>;
    delete (legacyRaw.activeRun as Record<string, unknown>).handSortMode;
    const sanitizedLegacy = sanitizePlayerSaveData(legacyRaw);
    expect(sanitizedLegacy.activeRun).not.toBeNull();
    expect(restoreRunStateFromSnapshot(sanitizedLegacy.activeRun!).handSortMode).toBe('rank');
  });
});

describe('Story 6.1 & 6.2: накопительная статистика, countMetaDiscoveries и сжатие unlockAllCollection', () => {
  it('накапливает totalMoneySpent, totalShopRerolls и totalCelestialsUsed в updateMetaStatsFromRunState, sanitize и merge', () => {
    const baseMeta = createInitialMetaSave(1000);
    const run = createRichRunState();

    const step1 = updateMetaStatsFromRunState(baseMeta.stats, run, {
      dollarsSpentDelta: 12,
      shopRerollsDelta: 2,
      celestialsUsedDelta: 1,
    });
    expect(step1.totalMoneySpent).toBe(12);
    expect(step1.totalShopRerolls).toBe(2);
    expect(step1.totalCelestialsUsed).toBe(1);

    // Последующий вызов без дельт не сбрасывает накопительную статистику
    const step2 = updateMetaStatsFromRunState(step1, run, { handPlayed: true });
    expect(step2.totalMoneySpent).toBe(12);
    expect(step2.totalShopRerolls).toBe(2);
    expect(step2.totalCelestialsUsed).toBe(1);

    // Отрицательные/NaN дельты игнорируются, дробные округляются вниз
    const step3 = updateMetaStatsFromRunState(step2, run, {
      dollarsSpentDelta: -50,
      shopRerollsDelta: Number.NaN,
      celestialsUsedDelta: 2.9,
    });
    expect(step3.totalMoneySpent).toBe(12);
    expect(step3.totalShopRerolls).toBe(2);
    expect(step3.totalCelestialsUsed).toBe(3);

    // Санитизация фильтрует невалидные и нулевые значения
    const sanitizedInvalid = sanitizePlayerSaveData({
      revision: 1,
      updatedAt: 2000,
      meta: {
        ...baseMeta,
        stats: {
          ...baseMeta.stats,
          totalMoneySpent: -10,
          totalShopRerolls: 0,
          totalCelestialsUsed: 4.7,
        },
      },
    });
    expect(sanitizedInvalid.meta?.stats.totalMoneySpent).toBeUndefined();
    expect(sanitizedInvalid.meta?.stats.totalShopRerolls).toBeUndefined();
    expect(sanitizedInvalid.meta?.stats.totalCelestialsUsed).toBe(4);

    // Merge берёт Math.max по всем трём накопительным счётчикам
    const local = createPlayerSaveData(
      {
        ...baseMeta,
        stats: {
          ...baseMeta.stats,
          totalMoneySpent: 320,
          totalShopRerolls: 7,
          totalCelestialsUsed: 15,
        },
      },
      null,
      5,
      5000,
    );
    const cloud = createPlayerSaveData(
      {
        ...baseMeta,
        stats: {
          ...baseMeta.stats,
          totalMoneySpent: 190,
          totalShopRerolls: 14,
          totalCelestialsUsed: 9,
        },
      },
      null,
      4,
      4000,
    );
    const merged = mergePlayerSaveData(local, cloud);
    expect(merged.meta?.stats.totalMoneySpent).toBe(320);
    expect(merged.meta?.stats.totalShopRerolls).toBe(14);
    expect(merged.meta?.stats.totalCelestialsUsed).toBe(15);
  });

  it('countMetaDiscoveries учитывает все 8 категорий с дедупликацией и исключением стартовых/невалидных записей', () => {
    const base = createInitialMetaSave(1000);
    expect(countMetaDiscoveries(base)).toBe(0);
    expect(countMetaDiscoveries(resetCollection(base))).toBe(0);

    // Обратная совместимость: вызов только с 4 обязательными полями
    expect(
      countMetaDiscoveries({
        discoveredRelics: ['j_joker', 'j_joker'],
        discoveredConsumables: ['c_mercury'],
        discoveredCharters: ['v_hone'],
        discoveredBosses: ['bl_hook'],
      }),
    ).toBe(4);

    // Расширенный подсчёт с тегами, монстрами (кроме ante 1), паками (только валидными) и изданиями (кроме base)
    const extended: MetaSave = {
      ...base,
      discoveredRelics: ['j_joker', 'j_sly', 'j_joker'],
      discoveredConsumables: ['c_mercury', 'c_fool'],
      discoveredCharters: ['v_hone'],
      discoveredBosses: ['bl_hook'],
      discoveredTags: ['tag_double', 'tag_skip', 'tag_double'],
      discoveredMonsters: ['m_ante_1_small', 'm_ante_1_big', 'm_ante_2_small', 'm_ante_3_big'],
      discoveredPacks: [
        'pack_arcana_normal',
        'pack_buffoon_mega',
        'pack_spectral_normal',
        'invalid_pack',
      ],
      discoveredEditions: ['base', 'foil', 'negative', 'foil'],
    };
    // 2 + 2 + 1 + 1 + 2 + 2 + 2 + 2 = 14
    expect(countMetaDiscoveries(extended)).toBe(14);

    const unlocked = unlockAllCollection(base);
    // 40 реликвий + 37 расходников + 12 грамот + 10 боссов + 10 тегов + 14 монстров (16 - 2 стартовых) + 12 паков + 4 издания (5 - base) = 139
    expect(countMetaDiscoveries(unlocked)).toBe(139);

    const trackerAfter = advanceActiveRunTracker(base, extended, true);
    expect(trackerAfter.newDiscoveries).toBe(14);
  });

  it('сжимает 100% открытую Коллекцию (unlockAllCollection) в createCompactFallbackSave <= 2500 байт с 100% lossless round-trip', () => {
    const base = createInitialMetaSave(1700000000000, {
      lang: 'ru',
      animationSpeed: 2,
      crtMode: 'original',
      musicVolume: 0.75,
      sfxVolume: 0.5,
      tutorialCompleted: true,
      tutorialStep: 21,
    });
    const fullCollection = unlockAllCollection(base);
    const allCounts = Object.fromEntries(HAND_TYPES.map((hand, idx) => [hand, (idx + 1) * 5]));
    const fullMeta: MetaSave = {
      ...fullCollection,
      stats: {
        runsStarted: 42,
        runsWon: 17,
        highestAnte: 11,
        highestRound: 33,
        bestHandScore: 987654,
        maxDollars: 520,
        bestWinStreak: 6,
        currentWinStreak: 4,
        totalHandsPlayed: 410,
        handPlayCounts: allCounts,
        totalMoneySpent: 3250,
        totalShopRerolls: 74,
        totalCelestialsUsed: 63,
      },
      activeRunTracker: {
        baselineBestHandScore: 987654,
        baselineHighestAnte: 11,
        baselineHighestRound: 33,
        newDiscoveries: 12,
      },
    };
    const snapshot = serializeRunStateToSnapshot(createRichRunState(), 25, 1700000055555);
    const fullSave = createPlayerSaveData(fullMeta, snapshot, 25, 1700000055555);

    // Без сжатия даже meta-часть с unlockAllCollection превышает 4000 байт
    const plainMetaOnly = createPlayerSaveData(fullMeta, null, 25, 1700000055555);
    expect(utf8ByteLength(JSON.stringify(plainMetaOnly))).toBeGreaterThan(4000);

    const compact = createCompactFallbackSave(fullSave);
    expect(compact.activeRun).toBeNull();
    expect(compact.revision).toBe(25);
    expect(compact.updatedAt).toBe(1700000055555);

    const serializedDirect = trySerializeWithinLimit(compact, 2200);
    expect(serializedDirect).not.toBeNull();
    expect(serializedDirect!.length).toBeLessThanOrEqual(2200);
    expect(utf8ByteLength(serializedDirect!)).toBeLessThanOrEqual(2200);

    const serializedViaFallback = trySerializeWithinLimit(fullSave, 2200, createCompactFallbackSave);
    expect(serializedViaFallback).toBe(serializedDirect);

    // Полный lossless round-trip через sanitizePlayerSaveData
    const parsedRaw = JSON.parse(serializedDirect!) as unknown;
    const restored = sanitizePlayerSaveData(parsedRaw);
    expect(restored.revision).toBe(25);
    expect(restored.updatedAt).toBe(1700000055555);
    expect(restored.activeRun).toBeNull();
    expect(restored.meta).toEqual({
      ...fullMeta,
      revision: 25,
      updatedAt: 1700000055555,
      settings: {
        ...fullMeta.settings,
        tutorialCompleted: true,
        tutorialStep: 21,
      },
    });
    expect(countMetaDiscoveries(restored.meta!)).toBe(139);
    expect(hasAnyUnseenCollectionItems(restored.meta!)).toBe(false);
  });

  it('сохраняет lossless round-trip для частичных открытий, enhancements/seals в seen, нестандартных строк и merge со сжатым fallback', () => {
    const base = createInitialMetaSave(2000);
    // Создаём сейв размером > 1800 байт с частичным набором и нестандартными seen-элементами
    const unlocked = unlockAllCollection(base);
    const partialMeta: MetaSave = {
      ...base,
      unlockedDecks: ['b_blue', 'b_black'],
      discoveredRelics: unlocked.discoveredRelics.slice(0, 32),
      discoveredConsumables: unlocked.discoveredConsumables.slice(0, 28),
      discoveredCharters: ['v_overstock_norm', 'v_directors_cut'],
      discoveredBosses: ['bl_hook', 'bl_final_bell'],
      discoveredTags: [],
      discoveredMonsters: ['m_ante_2_small', 'm_ante_8_big'],
      discoveredPacks: ['pack_arcana_normal', 'pack_buffoon_mega'],
      discoveredEditions: ['base', 'negative'],
      seenCollectionItems: [
        'j_joker',
        ...COLLECTION_ENHANCEMENTS,
        ...COLLECTION_SEALS,
        'custom_legacy_seen_id',
        ...unlocked.discoveredRelics,
        ...unlocked.discoveredConsumables,
      ],
      stats: {
        ...base.stats,
        totalMoneySpent: 500,
      },
    };
    const save = createPlayerSaveData(partialMeta, null, 10, 3000);
    const compact = createCompactFallbackSave(save);
    const json = trySerializeWithinLimit(compact, 4000);
    expect(json).not.toBeNull();
    expect(utf8ByteLength(json!)).toBeLessThanOrEqual(2500);

    const sanitized = sanitizePlayerSaveData(JSON.parse(json!) as unknown);
    expect(sanitized.meta?.unlockedDecks).toEqual(['b_blue', 'b_black']);
    expect(new Set(sanitized.meta?.discoveredRelics)).toEqual(new Set(partialMeta.discoveredRelics));
    expect(new Set(sanitized.meta?.discoveredConsumables)).toEqual(
      new Set(partialMeta.discoveredConsumables),
    );
    expect(sanitized.meta?.discoveredCharters).toEqual(['v_overstock_norm', 'v_directors_cut']);
    expect(sanitized.meta?.discoveredBosses).toEqual(['bl_hook', 'bl_final_bell']);
    expect(sanitized.meta?.discoveredTags).toEqual([]);
    expect(sanitized.meta?.discoveredMonsters).toEqual(['m_ante_2_small', 'm_ante_8_big']);
    expect(sanitized.meta?.discoveredPacks).toEqual(['pack_arcana_normal', 'pack_buffoon_mega']);
    expect(sanitized.meta?.discoveredEditions).toEqual(['base', 'negative']);
    expect(new Set(sanitized.meta?.seenCollectionItems)).toEqual(
      new Set(partialMeta.seenCollectionItems),
    );
    expect(sanitized.meta?.stats.totalMoneySpent).toBe(500);

    // mergePlayerSaveData корректно объединяет локальный сейв со сжатым облачным fallback
    const local = createPlayerSaveData(
      {
        ...base,
        discoveredRelics: ['j_vagabond'],
        stats: { ...base.stats, totalMoneySpent: 900, totalShopRerolls: 5 },
      },
      null,
      11,
      4000,
    );
    const merged = mergePlayerSaveData(local, JSON.parse(json!) as Partial<PlayerSaveData>);
    expect(merged.meta?.unlockedDecks).toEqual(['b_red', 'b_blue', 'b_black']);
    expect(merged.meta?.discoveredRelics).toContain('j_vagabond');
    expect(merged.meta?.discoveredRelics).toContain('j_joker');
    expect(merged.meta?.discoveredBosses).toEqual(['bl_hook', 'bl_final_bell']);
    expect(merged.meta?.stats.totalMoneySpent).toBe(900);
    expect(merged.meta?.stats.totalShopRerolls).toBe(5);
  });
});

describe('Эпик 7: reviveUsed, adRerollUsed, dailyBestDate/Score и reviewPrompted/shortcutPrompted', () => {
  it('сохраняет и объединяет поля Эпика 7 без потери и с соблюдением лимита <= 2200 символов при 100% коллекции', () => {
    const base = createInitialMetaSave(1700000000000);
    const dailyRun: RunState = {
      ...createRichRunState(),
      seed: 'DAILY-20261117',
      reviveUsed: true,
      shop: {
        ...createRichRunState().shop!,
        adRerollUsed: true,
      },
      stats: {
        ...createRichRunState().stats,
        bestHandScore: 24500,
      },
    };

    const nextStats = updateMetaStatsFromRunState(base.stats, dailyRun, { runWon: true });
    expect(nextStats.dailyBestDate).toBe('2026-11-17');
    expect(nextStats.dailyBestScore).toBe(24500);

    // Более старый ежедневный сид не перезаписывает рекорд более свежего дня
    const olderDaily: RunState = {
      ...dailyRun,
      seed: 'DAILY-20261116',
      stats: { ...dailyRun.stats, bestHandScore: 99999 },
    };
    const afterOlder = updateMetaStatsFromRunState(nextStats, olderDaily, { runWon: true });
    expect(afterOlder.dailyBestDate).toBe('2026-11-17');
    expect(afterOlder.dailyBestScore).toBe(24500);

    // Обычный не-daily сид не меняет dailyBest*
    const normalRun: RunState = {
      ...dailyRun,
      seed: 'NORMAL-SEED',
      stats: { ...dailyRun.stats, bestHandScore: 500000 },
    };
    const afterNormal = updateMetaStatsFromRunState(afterOlder, normalRun, { runWon: true });
    expect(afterNormal.dailyBestDate).toBe('2026-11-17');
    expect(afterNormal.dailyBestScore).toBe(24500);

    // Round-trip RunSnapshot для reviveUsed и adRerollUsed
    const snap = serializeRunStateToSnapshot(dailyRun, 5, 1700000010000);
    expect(snap.reviveUsed).toBe(true);
    expect(snap.shop?.adRerollUsed).toBe(true);
    const restoredRun = restoreRunStateFromSnapshot(snap);
    expect(restoredRun.reviveUsed).toBe(true);
    expect(restoredRun.shop?.adRerollUsed).toBe(true);

    // Merge настроек и dailyBest при слиянии двух сохранений
    const localSave = createPlayerSaveData(
      {
        ...unlockAllCollection(base),
        settings: { ...base.settings, reviewPrompted: true },
        stats: { ...afterNormal, dailyBestDate: '2026-11-17', dailyBestScore: 24500 },
      },
      snap,
      5,
      1700000010000,
    );
    const cloudSave = createPlayerSaveData(
      {
        ...base,
        settings: { ...base.settings, shortcutPrompted: true },
        stats: { ...base.stats, dailyBestDate: '2026-11-17', dailyBestScore: 31000 },
      },
      null,
      4,
      1700000005000,
    );

    const merged = mergePlayerSaveData(localSave, cloudSave);
    expect(merged.meta?.settings.reviewPrompted).toBe(true);
    expect(merged.meta?.settings.shortcutPrompted).toBe(true);
    expect(merged.meta?.stats.dailyBestDate).toBe('2026-11-17');
    expect(merged.meta?.stats.dailyBestScore).toBe(31000);

    // Сжатый fallback с 100% коллекцией и полями Эпика 7 укладывается в 2200 байт
    const compact = createCompactFallbackSave(merged as PlayerSaveData);
    const serialized = trySerializeWithinLimit(compact, 2200);
    expect(serialized).not.toBeNull();
    expect(utf8ByteLength(serialized!)).toBeLessThanOrEqual(2200);
  });

  it('Эпик 8: санитизирует, сохраняет, сбрасывает в дефолт и объединяет suitPalette и cardBack в пределах <= 2200 байт', () => {
    const base = createInitialMetaSave(1700000000000, {
      suitPalette: 'high_contrast',
      cardBack: 'b_blue',
    });
    expect(base.settings.suitPalette).toBe('high_contrast');
    expect(base.settings.cardBack).toBe('b_blue');

    // Невалидные значения отбрасываются, дефолтные не засоряют сериализацию
    const invalidSanitized = sanitizePlayerSaveData({
      version: 1,
      revision: 2,
      updatedAt: 1700000001000,
      meta: {
        ...base,
        settings: {
          ...base.settings,
          suitPalette: 'neon_invalid',
          cardBack: 'unknown_back',
        },
      },
    });
    expect(invalidSanitized.meta?.settings.suitPalette).toBeUndefined();
    expect(invalidSanitized.meta?.settings.cardBack).toBeUndefined();

    const defaultSanitized = sanitizePlayerSaveData({
      version: 1,
      revision: 3,
      updatedAt: 1700000002000,
      meta: {
        ...base,
        settings: {
          ...base.settings,
          suitPalette: 'standard',
          cardBack: 'default',
        },
      },
    });
    expect(defaultSanitized.meta?.settings.suitPalette).toBeUndefined();
    expect(defaultSanitized.meta?.settings.cardBack).toBeUndefined();

    // При слиянии более свежая настройка побеждает
    const olderSave = createPlayerSaveData(
      { ...base, settings: { ...base.settings, suitPalette: 'standard', cardBack: 'b_red' } },
      null,
      4,
      1700000005000,
    );
    const newerSave = createPlayerSaveData(
      {
        ...unlockAllCollection(base),
        settings: { ...base.settings, suitPalette: 'high_contrast', cardBack: 'b_blue' },
      },
      null,
      5,
      1700000010000,
    );
    const merged = mergePlayerSaveData(olderSave, newerSave);
    expect(merged.meta?.settings.suitPalette).toBe('high_contrast');
    expect(merged.meta?.settings.cardBack).toBe('b_blue');

    const compact = createCompactFallbackSave(merged as PlayerSaveData);
    const serialized = trySerializeWithinLimit(compact, 2200);
    expect(serialized).not.toBeNull();
    expect(utf8ByteLength(serialized!)).toBeLessThanOrEqual(2200);
  });
});
