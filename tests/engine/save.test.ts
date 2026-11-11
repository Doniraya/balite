import { describe, expect, it } from 'vitest';
import { createPlayingCard, createStandardDeck } from '../../src/engine/cards';
import { createInitialHandLevels, getHandLevelStats } from '../../src/engine/handEval';
import { createRngState, nextFloat, nextInt } from '../../src/engine/prng';
import {
  createCompactFallbackSave,
  createInitialMetaSave,
  createPlayerSaveData,
  decodeCompactCard,
  encodeCompactCard,
  mergePlayerSaveData,
  restoreRunStateFromSnapshot,
  sanitizePlayerSaveData,
  SAVE_SCHEMA_VERSION,
  serializeRunStateToSnapshot,
} from '../../src/engine/save';
import {
  EDITIONS,
  ENHANCEMENTS,
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
      handsPlayed: 22,
      discardsUsed: 11,
      cardsDestroyed: 3,
      dollarsSpent: 64,
    },
  };
}

describe('SAVE_SCHEMA_VERSION и createInitialMetaSave', () => {
  it('создаёт валидный начальный профиль MetaSave с дефолтной скоростью 2x и Алой колодой', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(1);

    const meta = createInitialMetaSave(1700000000123);
    expect(meta).toEqual({
      version: 1,
      revision: 0,
      updatedAt: 1700000000123,
      settings: {
        animationSpeed: 2,
        lang: 'ru',
        soundEnabled: true,
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
        bestHandScore: 0,
        totalHandsPlayed: 0,
      },
    });
  });

  it('поддерживает опции инициализации и защищается от невалидного nowMs', () => {
    const meta = createInitialMetaSave(Number.NaN, {
      lang: 'en',
      animationSpeed: 4,
      soundEnabled: false,
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
      musicVolume: 0.4,
      sfxVolume: 1,
    });
    expect(meta.unlockedDecks).toEqual(['b_red', 'b_blue']);
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
        bestHandScore: 18950,
        totalHandsPlayed: 95,
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
          bestHandScore: 4200,
          totalHandsPlayed: 15,
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
        animationSpeed: 2,
        lang: 'ru',
        soundEnabled: true,
        musicVolume: 1,
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
        bestHandScore: 4200,
        totalHandsPlayed: 15,
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
        bestHandScore: 25000,
        totalHandsPlayed: 120,
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
        bestHandScore: 1500,
        totalHandsPlayed: 20,
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
    expect(merged.meta?.stats.bestHandScore).toBe(25000);
  });

  it('использует updatedAt как тай-брейкер при равной ревизии и применяет более свежий облачный сейв', () => {
    const state = createRichRunState();
    const localMeta = createInitialMetaSave(1000, { lang: 'ru', animationSpeed: 2 });
    const cloudMeta = createInitialMetaSave(3000, { lang: 'en', animationSpeed: 4 });
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
      stats: { runsStarted: 3, runsWon: 0, highestAnte: 4, bestHandScore: 18950, totalHandsPlayed: 40 },
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
