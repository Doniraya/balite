import { describe, expect, it } from 'vitest';
import {
  BLIND_KINDS,
  BOSS_IDS,
  CELESTIAL_IDS,
  CHARTER_IDS,
  DECK_IDS,
  EDITIONS,
  ENHANCEMENTS,
  HAND_TYPES,
  PACK_SIZES,
  PACK_TYPES,
  RANKS,
  RELIC_HOOK_NAMES,
  RELIC_IDS,
  RUNE_IDS,
  SCROLL_IDS,
  SEALS,
  SUITS,
  TAG_IDS,
  type DispatchResult,
  type GameCommand,
  type MetaSave,
  type PlayingCard,
  type RelicHookContext,
  type RelicInstance,
  type RunSnapshot,
  type RunState,
  type TraceEvent,
} from '../../src/engine/types';
import { createRngState } from '../../src/engine/prng';

describe('Канонические перечисления и таблицы идентификаторов Balite v1.0', () => {
  it('содержит точное количество уникальных модификаторов карт, мастей, рангов и раскладов', () => {
    expect(SUITS).toHaveLength(4);
    expect(new Set(SUITS).size).toBe(4);

    expect(RANKS).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(ENHANCEMENTS).toHaveLength(9);
    expect(ENHANCEMENTS).toContain('none');
    expect(new Set(ENHANCEMENTS).size).toBe(9);

    expect(EDITIONS).toEqual(['base', 'foil', 'holo', 'polychrome', 'negative']);
    expect(SEALS).toEqual(['none', 'gold', 'red', 'blue', 'purple']);
    expect(HAND_TYPES).toHaveLength(12);
    expect(new Set(HAND_TYPES).size).toBe(12);
  });

  it('содержит ровно 40 Реликвий, 12 Сфер, 16 Свитков, 9 Рун (включая c_black_hole)', () => {
    expect(RELIC_IDS).toHaveLength(40);
    expect(new Set(RELIC_IDS).size).toBe(40);
    expect(RELIC_IDS).toContain('j_gluttenous_joker');
    expect(RELIC_IDS).toContain('j_blueprint');
    expect(RELIC_IDS).toContain('j_brainstorm');
    expect(RELIC_IDS).toContain('j_vagabond');

    expect(CELESTIAL_IDS).toHaveLength(12);
    expect(new Set(CELESTIAL_IDS).size).toBe(12);
    expect(CELESTIAL_IDS).toContain('c_planet_x');
    expect(CELESTIAL_IDS).toContain('c_ceres');
    expect(CELESTIAL_IDS).toContain('c_eris');

    expect(SCROLL_IDS).toHaveLength(16);
    expect(new Set(SCROLL_IDS).size).toBe(16);
    expect(SCROLL_IDS).toContain('c_heirophant');

    expect(RUNE_IDS).toHaveLength(9);
    expect(new Set(RUNE_IDS).size).toBe(9);
    expect(RUNE_IDS).toContain('c_black_hole');
  });

  it('содержит ровно 12 Грамот, 10 Знаков, 10 Боссов, 4 Колоды, 9 хуков и типы бустеров/стражей', () => {
    expect(CHARTER_IDS).toHaveLength(12);
    expect(new Set(CHARTER_IDS).size).toBe(12);

    expect(TAG_IDS).toHaveLength(10);
    expect(new Set(TAG_IDS).size).toBe(10);

    expect(BOSS_IDS).toHaveLength(10);
    expect(new Set(BOSS_IDS).size).toBe(10);
    expect(BOSS_IDS).toContain('bl_final_vessel');
    expect(BOSS_IDS).toContain('bl_final_bell');

    expect(DECK_IDS).toEqual(['b_red', 'b_blue', 'b_yellow', 'b_black']);
    expect(RELIC_HOOK_NAMES).toEqual([
      'onBlindSelect',
      'onDiscard',
      'onBeforeScore',
      'onScoreCard',
      'onHoldCard',
      'onScoreRelic',
      'onRoundEnd',
      'onShopReroll',
      'onCardAdded',
    ]);
    expect(BLIND_KINDS).toEqual(['small', 'big', 'boss']);
    expect(PACK_TYPES).toEqual(['arcana', 'celestial', 'standard', 'buffoon', 'spectral']);
    expect(PACK_SIZES).toEqual(['normal', 'jumbo', 'mega']);
  });
});

describe('Типы состояния, команд, хуков и сохранений', () => {
  it('корректно разделяет effectRelic и stateRelic в RelicHookContext и моделирует RunState/Save', () => {
    const card: PlayingCard = {
      id: 'card_1',
      suit: 'spades',
      rank: 14,
      enhancement: 'none',
      edition: 'base',
      seal: 'none',
      bonusChips: 0,
      permaBonus: 0,
      debuffed: false,
      playedThisAnte: false,
      facing: 'front',
      forcedSelection: false,
    };

    const blueprint: RelicInstance = {
      uid: 'relic_1',
      id: 'j_blueprint',
      edition: 'base',
      baseCost: 10,
      sellValue: 5,
      extraValue: 0,
      debuffed: false,
      state: { chips: 0, mult: 0, xMult: 1 },
    };

    const runner: RelicInstance = {
      uid: 'relic_2',
      id: 'j_runner',
      edition: 'foil',
      baseCost: 5,
      sellValue: 3,
      extraValue: 0,
      debuffed: false,
      state: { chips: 30, mult: 0, xMult: 1 },
    };

    const handLevels = Object.fromEntries(
      HAND_TYPES.map((hand) => [
        hand,
        { level: 1, chips: 10, mult: 2, playedCount: 0, visible: true },
      ]),
    ) as RunState['handLevels'];

    const runState: RunState = {
      version: 1,
      seed: 'TYPE-TEST',
      rngState: createRngState('TYPE-TEST'),
      deckId: 'b_red',
      phase: 'playing',
      previousPhase: null,
      ante: 1,
      round: 1,
      currentBlindIndex: 0,
      anteBlinds: [
        { kind: 'small', bossId: null, targetScore: 300, reward: 3, status: 'current', skipTagId: 'tag_coupon' },
        { kind: 'big', bossId: null, targetScore: 450, reward: 4, status: 'upcoming', skipTagId: 'tag_skip' },
        { kind: 'boss', bossId: 'bl_hook', targetScore: 600, reward: 5, status: 'upcoming', skipTagId: null },
      ],
      bossUseCounts: { bl_hook: 1 },
      bossRerollsThisAnte: 0,
      activeBossDisabled: false,
      savedBossDiscards: null,
      endlessMode: false,
      score: 0,
      targetScore: 300,
      dollars: 4,
      handsLeft: 4,
      maxHands: 4,
      discardsLeft: 4,
      maxDiscards: 4,
      handSize: 8,
      tempHandSizeBonus: 0,
      maxRelics: 5,
      maxConsumables: 2,
      baseRerollCost: 5,
      interestCap: 25,
      shopSlots: 2,
      discountPercent: 0,
      editionRate: 1,
      deck: [card],
      drawPileIds: [],
      handIds: [card.id],
      discardPileIds: [],
      relics: [blueprint, runner],
      consumables: [],
      charters: [],
      pendingTags: [],
      skipsCount: 0,
      handsPlayedThisRound: {},
      handLevels,
      lastUsedConsumableId: null,
      lastPlayedHandType: null,
      shop: null,
      shopVisits: 0,
      booster: null,
      cashout: null,
      nextCardUid: 2,
      stats: {
        bestHandScore: 0,
        handsPlayed: 0,
        discardsUsed: 0,
        cardsDestroyed: 0,
        dollarsSpent: 0,
      },
    };

    const hookContext: RelicHookContext = {
      hook: 'onScoreRelic',
      state: runState,
      effectRelic: runner,
      stateRelic: blueprint,
      relicIndex: 0,
      isBlueprintCopy: true,
      playedCards: [card],
      scoringCards: [card],
      handCards: [],
      handEvaluation: {
        handType: 'High Card',
        scoringCards: [card],
        scoringCardIds: [card.id],
        containedHands: Object.fromEntries(
          HAND_TYPES.map((h) => [h, h === 'High Card']),
        ) as Record<(typeof HAND_TYPES)[number], boolean>,
      },
    };

    expect(hookContext.effectRelic.id).toBe('j_runner');
    expect(hookContext.stateRelic.id).toBe('j_blueprint');
    expect(hookContext.isBlueprintCopy).toBe(true);

    const cmd: GameCommand = { type: 'PLAY_HAND', cardIds: [card.id] };
    const event: TraceEvent = {
      type: 'RELIC_TRIGGER',
      relicUid: runner.uid,
      relicId: runner.id,
      copiedByUid: blueprint.uid,
      hook: 'onScoreRelic',
      chipsDelta: 30,
    };
    const result: DispatchResult = { nextState: runState, events: [event] };
    expect(cmd.type).toBe('PLAY_HAND');
    expect(result.events).toHaveLength(1);

    const meta: MetaSave = {
      version: 1,
      revision: 3,
      updatedAt: 1700000000000,
      settings: {
        animationSpeed: 2,
        lang: 'ru',
        soundEnabled: true,
      },
      unlockedDecks: ['b_red'],
      discoveredRelics: ['j_blueprint', 'j_runner'],
      discoveredConsumables: [],
      discoveredCharters: [],
      discoveredBosses: ['bl_hook'],
      stats: {
        runsStarted: 1,
        runsWon: 0,
        highestAnte: 1,
        bestHandScore: 0,
        totalHandsPlayed: 0,
      },
    };

    const snapshot: RunSnapshot = {
      version: 1,
      revision: 3,
      updatedAt: 1700000000000,
      seed: runState.seed,
      rngState: runState.rngState,
      deckId: runState.deckId,
      phase: runState.phase,
      previousPhase: runState.previousPhase,
      ante: runState.ante,
      round: runState.round,
      currentBlindIndex: runState.currentBlindIndex,
      anteBlinds: runState.anteBlinds,
      bossUseCounts: runState.bossUseCounts,
      bossRerollsThisAnte: runState.bossRerollsThisAnte,
      activeBossDisabled: runState.activeBossDisabled,
      savedBossDiscards: runState.savedBossDiscards,
      endlessMode: runState.endlessMode,
      score: runState.score,
      targetScore: runState.targetScore,
      dollars: runState.dollars,
      handsLeft: runState.handsLeft,
      maxHands: runState.maxHands,
      discardsLeft: runState.discardsLeft,
      maxDiscards: runState.maxDiscards,
      handSize: runState.handSize,
      tempHandSizeBonus: runState.tempHandSizeBonus,
      maxRelics: runState.maxRelics,
      maxConsumables: runState.maxConsumables,
      baseRerollCost: runState.baseRerollCost,
      interestCap: runState.interestCap,
      shopSlots: runState.shopSlots,
      discountPercent: runState.discountPercent,
      editionRate: runState.editionRate,
      compactDeck: [['card_1', 0, 14, 0, 0, 0, 0, 0, 0]],
      drawPileIds: [],
      handIds: ['card_1'],
      discardPileIds: [],
      relics: runState.relics,
      consumables: [],
      charters: [],
      pendingTags: [],
      skipsCount: 0,
      handsPlayedThisRound: {},
      handLevels: Object.fromEntries(
        HAND_TYPES.map((h) => [h, [1, 0, 1] as const]),
      ) as RunSnapshot['handLevels'],
      lastUsedConsumableId: null,
      lastPlayedHandType: null,
      shop: null,
      shopVisits: 0,
      booster: null,
      cashout: null,
      nextCardUid: 2,
      stats: runState.stats,
    };

    expect(meta.settings.animationSpeed).toBe(2);
    expect(meta.settings.lang).toBe('ru');
    expect(snapshot.compactDeck[0][2]).toBe(14);
  });
});
