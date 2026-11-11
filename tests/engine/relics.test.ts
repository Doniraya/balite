import { describe, expect, it } from 'vitest';
import { createPlayingCard } from '../../src/engine/cards';
import { createInitialHandLevels, evaluatePokerHand } from '../../src/engine/handEval';
import { createRngState } from '../../src/engine/prng';
import {
  RELIC_DEFINITIONS,
  RELIC_REGISTRY,
  calculateRelicBuyCost,
  calculateRelicSellValue,
  createRelicInstance,
  getRelicDefinition,
  resolveRelicTarget,
} from '../../src/engine/relics';
import {
  RELIC_IDS,
  type BlindSlotState,
  type ConsumableInstance,
  type Edition,
  type PlayingCard,
  type RelicDefinition,
  type RelicHookContextFor,
  type RelicHookName,
  type RelicId,
  type RelicInstance,
  type RelicRarity,
  type RunState,
} from '../../src/engine/types';

/**
 * Создаёт минимальное детерминированное состояние забега для модульного тестирования Реликвий.
 */
function createTestRunState(overrides: Partial<RunState> = {}): RunState {
  const defaultBlind: BlindSlotState = {
    kind: 'small',
    bossId: null,
    targetScore: 300,
    reward: 3,
    status: 'current',
    skipTagId: null,
  };

  return {
    version: 1,
    seed: 'RELIC-TEST',
    rngState: createRngState('RELIC-TEST'),
    deckId: 'b_red',
    phase: 'playing',
    previousPhase: null,
    ante: 1,
    round: 1,
    currentBlindIndex: 0,
    anteBlinds: [
      defaultBlind,
      { kind: 'big', bossId: null, targetScore: 450, reward: 4, status: 'upcoming', skipTagId: null },
      { kind: 'boss', bossId: 'bl_hook', targetScore: 600, reward: 5, status: 'upcoming', skipTagId: null },
    ],
    bossUseCounts: {},
    bossRerollsThisAnte: 0,
    activeBossDisabled: false,
    savedBossDiscards: null,
    endlessMode: false,
    probabilitiesNormal: 1,
    anteScaling: 1,
    score: 0,
    targetScore: 300,
    dollars: 4,
    handsLeft: 4,
    maxHands: 4,
    discardsLeft: 3,
    maxDiscards: 3,
    handSize: 8,
    tempHandSizeBonus: 0,
    maxRelics: 5,
    maxConsumables: 2,
    baseRerollCost: 5,
    interestCap: 25,
    shopSlots: 2,
    discountPercent: 0,
    editionRate: 1,
    deck: [],
    drawPileIds: [],
    handIds: [],
    discardPileIds: [],
    relics: [],
    consumables: [],
    charters: [],
    pendingTags: [],
    skipsCount: 0,
    handsPlayedThisRound: {},
    handLevels: createInitialHandLevels(),
    lastUsedConsumableId: null,
    lastPlayedHandType: null,
    shop: null,
    shopVisits: 0,
    booster: null,
    cashout: null,
    nextCardUid: 1,
    stats: {
      bestHandScore: 0,
      handsPlayed: 0,
      discardsUsed: 0,
      cardsDestroyed: 0,
      dollarsSpent: 0,
    },
    ...overrides,
  };
}

/**
 * Вспомогательный вызов произвольного хука для Реликвии в указанном контексте.
 */
function callHook<H extends RelicHookName>(
  id: RelicId,
  hookName: H,
  ctx: RelicHookContextFor<H>,
) {
  const handler = getRelicDefinition(id).hooks[hookName];
  return handler ? handler(ctx) : undefined;
}

describe('Реестр 40 Реликвий Balite v1.0 и создание экземпляров', () => {
  it('содержит все 40 Реликвий из RELIC_IDS с точным распределением редкостей, цен и флагов совместимости', () => {
    expect(RELIC_DEFINITIONS).toHaveLength(40);
    expect(RELIC_DEFINITIONS.map((def) => def.id)).toEqual([...RELIC_IDS]);
    expect(Object.keys(RELIC_REGISTRY).sort()).toEqual([...RELIC_IDS].sort());

    const rarityCounts: Record<RelicRarity, number> = { 1: 0, 2: 0, 3: 0 };
    for (const id of RELIC_IDS) {
      const def = getRelicDefinition(id);
      expect(RELIC_REGISTRY[id]).toBe(def);
      rarityCounts[def.rarity] += 1;
    }
    expect(rarityCounts).toEqual({ 1: 18, 2: 16, 3: 6 });

    // Точные базовые стоимости и редкости из GDD §6.3 и спецификации #10
    const expectedSpecs: Readonly<
      Record<
        RelicId,
        readonly [
          rarity: RelicRarity,
          baseCost: number,
          blueprintCompat: boolean,
          perishableCompat: boolean,
          eternalCompat: boolean,
        ]
      >
    > = {
      j_joker: [1, 2, true, true, true],
      j_greedy_joker: [1, 5, true, true, true],
      j_lusty_joker: [1, 5, true, true, true],
      j_wrathful_joker: [1, 5, true, true, true],
      j_gluttenous_joker: [1, 5, true, true, true],
      j_jolly: [1, 3, true, true, true],
      j_sly: [1, 3, true, true, true],
      j_half: [1, 5, true, true, true],
      j_abstract: [1, 4, true, true, true],
      j_banner: [1, 5, true, true, true],
      j_mystic_summit: [1, 5, true, true, true],
      j_scary_face: [1, 4, true, true, true],
      j_even_steven: [1, 4, true, true, true],
      j_odd_todd: [1, 4, true, true, true],
      j_runner: [1, 5, true, false, true],
      j_green_joker: [1, 4, true, false, true],
      j_photograph: [1, 5, true, true, true],
      j_golden: [1, 6, false, true, true],
      j_flash: [2, 5, true, false, true],
      j_trousers: [2, 6, true, false, true],
      j_ceremonial: [2, 6, true, false, true],
      j_blackboard: [2, 6, true, true, true],
      j_card_sharp: [2, 6, true, true, true],
      j_acrobat: [2, 6, true, true, true],
      j_constellation: [2, 6, true, false, true],
      j_hologram: [2, 7, true, false, true],
      j_vampire: [2, 7, true, false, true],
      j_ramen: [2, 6, true, true, false],
      j_stencil: [2, 8, true, true, true],
      j_sock_and_buskin: [2, 6, true, true, true],
      j_mime: [2, 5, true, true, true],
      j_four_fingers: [2, 7, false, true, true],
      j_shortcut: [2, 7, false, true, true],
      j_bull: [2, 6, true, true, true],
      j_duo: [3, 8, true, true, true],
      j_tribe: [3, 8, true, true, true],
      j_baron: [3, 8, true, true, true],
      j_blueprint: [3, 10, true, true, true],
      j_brainstorm: [3, 10, true, true, true],
      j_vagabond: [3, 8, true, true, true],
    };

    for (const id of RELIC_IDS) {
      const def = getRelicDefinition(id);
      const [rarity, baseCost, bp, perish, eternal] = expectedSpecs[id];
      expect(def.rarity, `${id} rarity`).toBe(rarity);
      expect(def.baseCost, `${id} baseCost`).toBe(baseCost);
      expect(def.blueprintCompat, `${id} blueprintCompat`).toBe(bp);
      expect(def.perishableCompat, `${id} perishableCompat`).toBe(perish);
      expect(def.eternalCompat, `${id} eternalCompat`).toBe(eternal);
    }

    const nonBp = RELIC_DEFINITIONS.filter((d) => !d.blueprintCompat).map((d) => d.id);
    expect(nonBp).toEqual(['j_golden', 'j_four_fingers', 'j_shortcut']);
  });

  it('корректно создаёт экземпляры Реликвий с изоляцией state, ценами изданий и скидками', () => {
    const r1 = createRelicInstance('j_runner', 'u1');
    const r2 = createRelicInstance('j_runner', 'u2');
    expect(r1).toEqual({
      uid: 'u1',
      id: 'j_runner',
      edition: 'base',
      baseCost: 5,
      sellValue: 2,
      extraValue: 0,
      debuffed: false,
      state: { chips: 0, mult: 0, xMult: 1 },
    });
    expect(r1.state).not.toBe(r2.state);

    // Издания: foil +2, holo +3, polychrome +5, negative +5; скидка 25%
    const editions: readonly [Edition, number, number][] = [
      ['base', 10, 5],
      ['foil', 12, 6],
      ['holo', 13, 6],
      ['polychrome', 15, 7],
      ['negative', 15, 7],
    ];
    for (const [edition, expectedBuy, expectedSell] of editions) {
      expect(calculateRelicBuyCost(10, edition, 0)).toBe(expectedBuy);
      const inst = createRelicInstance('j_blueprint', `bp_${edition}`, edition, 0);
      expect(inst.baseCost).toBe(10);
      expect(inst.sellValue).toBe(expectedSell);
    }

    // Скидка 25%: floor((10 + 0 + 0.5) * 0.75) = 7 -> sellValue = floor(7/2) = 3
    const discounted = createRelicInstance('j_blueprint', 'bp_disc', 'base', 25);
    expect(discounted.baseCost).toBe(10);
    expect(discounted.sellValue).toBe(3);

    // Минимум 1$ для дешёвой Реликвии
    expect(calculateRelicBuyCost(2, 'base', 100)).toBe(1);
    expect(calculateRelicSellValue(1, 0)).toBe(1);

    // j_ramen стартует с xMult = 2
    const ramen = createRelicInstance('j_ramen', 'ramen_1');
    expect(ramen.state).toEqual({ chips: 0, mult: 0, xMult: 2 });
  });
});

describe('Разрешение целей j_blueprint и j_brainstorm (resolveRelicTarget)', () => {
  it('копирует соседа справа для j_blueprint и самый левый слот для j_brainstorm с разделением effectRelic и stateRelic', () => {
    const bp = createRelicInstance('j_blueprint', 'bp_1', 'foil');
    const runner: RelicInstance = {
      ...createRelicInstance('j_runner', 'run_1', 'holo'),
      state: { chips: 45, mult: 0, xMult: 1 },
    };
    const bs = createRelicInstance('j_brainstorm', 'bs_1', 'polychrome');
    const relics = [runner, bp, bs];

    // slot 0 (обычная) -> сама себе без флага копии
    expect(resolveRelicTarget(relics, 0)).toEqual({
      effectRelic: runner,
      stateRelic: runner,
      isBlueprintCopy: false,
    });

    // slot 1 (Blueprint) -> смотрит на slot 2 (Brainstorm) -> смотрит на slot 0 (Runner)!
    const resolvedBp = resolveRelicTarget(relics, 1);
    expect(resolvedBp).toEqual({
      effectRelic: runner,
      stateRelic: bp,
      isBlueprintCopy: true,
    });

    // slot 2 (Brainstorm) -> смотрит на slot 0 (Runner)
    const resolvedBs = resolveRelicTarget(relics, 2);
    expect(resolvedBs).toEqual({
      effectRelic: runner,
      stateRelic: bs,
      isBlueprintCopy: true,
    });
  });

  it('мгновенно разрывает циклы (Blueprint <-> Brainstorm, Brainstorm в слоте 0) без бесконечной рекурсии', () => {
    const bp = createRelicInstance('j_blueprint', 'bp_1');
    const bs = createRelicInstance('j_brainstorm', 'bs_1');

    // Blueprint -> Brainstorm -> Blueprint
    expect(resolveRelicTarget([bp, bs], 0)).toBeNull();
    expect(resolveRelicTarget([bp, bs], 1)).toBeNull();

    // Brainstorm на индексе 0 ссылается сам на себя
    expect(resolveRelicTarget([bs, createRelicInstance('j_joker', 'j_1')], 0)).toBeNull();

    // Blueprint -> Blueprint -> Brainstorm -> Blueprint
    const bp2 = createRelicInstance('j_blueprint', 'bp_2');
    expect(resolveRelicTarget([bp, bp2, bs], 0)).toBeNull();
  });

  it('возвращает null при выходе за границы, подавлении или blueprintCompat === false (кроме прямого слота)', () => {
    const bp = createRelicInstance('j_blueprint', 'bp_1');
    const golden = createRelicInstance('j_golden', 'gold_1');
    const fourFingers = createRelicInstance('j_four_fingers', 'ff_1');
    const shortcut = createRelicInstance('j_shortcut', 'sc_1');
    const debuffedJoker: RelicInstance = {
      ...createRelicInstance('j_joker', 'j_deb'),
      debuffed: true,
    };

    expect(resolveRelicTarget([bp], 0)).toBeNull();
    expect(resolveRelicTarget([bp], -1)).toBeNull();
    expect(resolveRelicTarget([bp], 5)).toBeNull();

    // Несовместимые цели не копируются, но сами по себе работают
    expect(resolveRelicTarget([bp, golden], 0)).toBeNull();
    expect(resolveRelicTarget([bp, golden], 1)).toEqual({
      effectRelic: golden,
      stateRelic: golden,
      isBlueprintCopy: false,
    });
    expect(resolveRelicTarget([bp, fourFingers], 0)).toBeNull();
    expect(resolveRelicTarget([bp, shortcut], 0)).toBeNull();

    // Подавленная цель или подавленный копир -> null
    expect(resolveRelicTarget([bp, debuffedJoker], 0)).toBeNull();
    expect(resolveRelicTarget([{ ...bp, debuffed: true }, createRelicInstance('j_joker', 'j_ok')], 0)).toBeNull();

    // Поддержка пользовательского lookup
    const customLookup = (id: RelicId): RelicDefinition | undefined =>
      id === 'j_joker'
        ? { ...getRelicDefinition('j_joker'), blueprintCompat: false }
        : getRelicDefinition(id);
    expect(resolveRelicTarget([bp, createRelicInstance('j_joker', 'j_1')], 0, customLookup)).toBeNull();
  });
});

describe('Простые, мастные и позиционные Реликвии (R1 и R2/R3 scoring)', () => {
  it('обрабатывает j_joker, мастные Реликвии (вкл. j_gluttenous_joker, Wild, Stone, debuffed)', () => {
    const state = createTestRunState();
    const joker = createRelicInstance('j_joker', 'r1');
    const diamond = createPlayingCard({ id: 'd1', suit: 'diamonds', rank: 5 });
    const heart = createPlayingCard({ id: 'h1', suit: 'hearts', rank: 6 });
    const spade = createPlayingCard({ id: 's1', suit: 'spades', rank: 7 });
    const club = createPlayingCard({ id: 'c1', suit: 'clubs', rank: 8 });
    const wild = createPlayingCard({ id: 'w1', suit: 'hearts', rank: 9, enhancement: 'wild' });
    const stoneClub = createPlayingCard({ id: 'st1', suit: 'clubs', rank: 10, enhancement: 'stone' });
    const debuffedSpade = createPlayingCard({ id: 'ds1', suit: 'spades', rank: 14, debuffed: true });
    const evalRes = evaluatePokerHand([diamond]);

    expect(
      callHook('j_joker', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state,
        effectRelic: joker,
        stateRelic: joker,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: [diamond],
        scoringCards: [diamond],
        handCards: [],
        handEvaluation: evalRes,
      })?.multDelta,
    ).toBe(4);

    const suitChecks: readonly [RelicId, PlayingCard, boolean][] = [
      ['j_greedy_joker', diamond, true],
      ['j_greedy_joker', wild, true],
      ['j_greedy_joker', stoneClub, false],
      ['j_greedy_joker', heart, false],
      ['j_lusty_joker', heart, true],
      ['j_lusty_joker', wild, true],
      ['j_wrathful_joker', spade, true],
      ['j_wrathful_joker', debuffedSpade, false],
      ['j_gluttenous_joker', club, true],
      ['j_gluttenous_joker', wild, true],
      ['j_gluttenous_joker', stoneClub, false],
    ];

    for (const [relicId, card, shouldTrigger] of suitChecks) {
      const relic = createRelicInstance(relicId, `u_${relicId}`);
      const res = callHook(relicId, 'onScoreCard', {
        hook: 'onScoreCard',
        state,
        effectRelic: relic,
        stateRelic: relic,
        relicIndex: 0,
        isBlueprintCopy: false,
        card,
        playedCards: [card],
        scoringCards: [card],
        handEvaluation: evalRes,
      });
      if (shouldTrigger) {
        expect(res?.multDelta, `${relicId} on ${card.id}`).toBe(3);
      } else {
        expect(res, `${relicId} on ${card.id}`).toBeNull();
      }
    }
  });

  it('обрабатывает j_jolly, j_sly, j_duo, j_tribe через вложенность раскладов (containedHands)', () => {
    const state = createTestRunState();
    const fullHouse = [
      createPlayingCard({ id: 'c1', suit: 'hearts', rank: 10 }),
      createPlayingCard({ id: 'c2', suit: 'diamonds', rank: 10 }),
      createPlayingCard({ id: 'c3', suit: 'clubs', rank: 10 }),
      createPlayingCard({ id: 'c4', suit: 'spades', rank: 4 }),
      createPlayingCard({ id: 'c5', suit: 'hearts', rank: 4 }),
    ];
    const flushHouse = fullHouse.map((c) => ({ ...c, suit: 'spades' as const }));
    const highCard = [createPlayingCard({ id: 'hc', suit: 'spades', rank: 14 })];

    const fhEval = evaluatePokerHand(fullHouse);
    const flhEval = evaluatePokerHand(flushHouse);
    const hcEval = evaluatePokerHand(highCard);

    const makeCtx = (id: RelicId, evaluation: ReturnType<typeof evaluatePokerHand>) => {
      const relic = createRelicInstance(id, `u_${id}`);
      return {
        hook: 'onScoreRelic' as const,
        state,
        effectRelic: relic,
        stateRelic: relic,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: fullHouse,
        scoringCards: fullHouse,
        handCards: [],
        handEvaluation: evaluation,
      };
    };

    expect(callHook('j_jolly', 'onScoreRelic', makeCtx('j_jolly', fhEval))?.multDelta).toBe(8);
    expect(callHook('j_sly', 'onScoreRelic', makeCtx('j_sly', fhEval))?.chipsDelta).toBe(50);
    expect(callHook('j_duo', 'onScoreRelic', makeCtx('j_duo', fhEval))?.xMult).toBe(2);
    expect(callHook('j_tribe', 'onScoreRelic', makeCtx('j_tribe', fhEval))).toBeNull();
    expect(callHook('j_tribe', 'onScoreRelic', makeCtx('j_tribe', flhEval))?.xMult).toBe(2);

    expect(callHook('j_jolly', 'onScoreRelic', makeCtx('j_jolly', hcEval))).toBeNull();
    expect(callHook('j_sly', 'onScoreRelic', makeCtx('j_sly', hcEval))).toBeNull();
    expect(callHook('j_duo', 'onScoreRelic', makeCtx('j_duo', hcEval))).toBeNull();
  });

  it('проверяет j_half (<=3 сыгранных карт с кикерами), j_abstract (включая debuffed), j_banner, j_mystic_summit, j_bull', () => {
    const r1 = createRelicInstance('j_abstract', 'r1');
    const r2: RelicInstance = { ...createRelicInstance('j_joker', 'r2'), debuffed: true };
    const r3 = createRelicInstance('j_banner', 'r3');
    const state = createTestRunState({
      relics: [r1, r2, r3],
      discardsLeft: 2,
      dollars: 15,
    });

    const threeCards = [
      createPlayingCard({ id: '1', suit: 'spades', rank: 14 }),
      createPlayingCard({ id: '2', suit: 'hearts', rank: 14 }),
      createPlayingCard({ id: '3', suit: 'clubs', rank: 7 }),
    ];
    const fourCards = [...threeCards, createPlayingCard({ id: '4', suit: 'diamonds', rank: 2 })];
    const pairEval = evaluatePokerHand(threeCards);

    // j_half: 3 карты (пара + кикер) -> +20; 4 карты (пара + 2 кикера) -> null
    const half = createRelicInstance('j_half', 'h');
    expect(
      callHook('j_half', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state,
        effectRelic: half,
        stateRelic: half,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: threeCards,
        scoringCards: threeCards.slice(0, 2),
        handCards: [],
        handEvaluation: pairEval,
      })?.multDelta,
    ).toBe(20);
    expect(
      callHook('j_half', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state,
        effectRelic: half,
        stateRelic: half,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: fourCards,
        scoringCards: threeCards.slice(0, 2),
        handCards: [],
        handEvaluation: pairEval,
      }),
    ).toBeNull();

    // j_abstract: +3 * 3 (включая подавленную r2) = +9
    expect(
      callHook('j_abstract', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state,
        effectRelic: r1,
        stateRelic: r1,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: threeCards,
        scoringCards: threeCards,
        handCards: [],
        handEvaluation: pairEval,
      })?.multDelta,
    ).toBe(9);

    // j_banner: 2 сброса -> +60 Силы; 0 сбросов -> null
    expect(
      callHook('j_banner', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state,
        effectRelic: r3,
        stateRelic: r3,
        relicIndex: 2,
        isBlueprintCopy: false,
        playedCards: threeCards,
        scoringCards: threeCards,
        handCards: [],
        handEvaluation: pairEval,
      })?.chipsDelta,
    ).toBe(60);

    const zeroDiscardState = createTestRunState({ discardsLeft: 0, dollars: 0 });
    expect(
      callHook('j_banner', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state: zeroDiscardState,
        effectRelic: r3,
        stateRelic: r3,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: threeCards,
        scoringCards: threeCards,
        handCards: [],
        handEvaluation: pairEval,
      }),
    ).toBeNull();

    // j_mystic_summit: 0 сбросов -> +15 Множ; >0 -> null
    const summit = createRelicInstance('j_mystic_summit', 'ms');
    expect(
      callHook('j_mystic_summit', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state: zeroDiscardState,
        effectRelic: summit,
        stateRelic: summit,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: threeCards,
        scoringCards: threeCards,
        handCards: [],
        handEvaluation: pairEval,
      })?.multDelta,
    ).toBe(15);
    expect(
      callHook('j_mystic_summit', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state,
        effectRelic: summit,
        stateRelic: summit,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: threeCards,
        scoringCards: threeCards,
        handCards: [],
        handEvaluation: pairEval,
      }),
    ).toBeNull();

    // j_bull: +2 * 15 = +30 Силы; при <=0$ -> null
    const bull = createRelicInstance('j_bull', 'bull');
    expect(
      callHook('j_bull', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state,
        effectRelic: bull,
        stateRelic: bull,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: threeCards,
        scoringCards: threeCards,
        handCards: [],
        handEvaluation: pairEval,
      })?.chipsDelta,
    ).toBe(30);
    expect(
      callHook('j_bull', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state: createTestRunState({ dollars: -5 }),
        effectRelic: bull,
        stateRelic: bull,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: threeCards,
        scoringCards: threeCards,
        handCards: [],
        handEvaluation: pairEval,
      }),
    ).toBeNull();
  });

  it('проверяет ранговые Реликвии (j_scary_face, j_even_steven, j_odd_todd, j_photograph, j_baron)', () => {
    const state = createTestRunState();
    const ace = createPlayingCard({ id: 'a', suit: 'spades', rank: 14 });
    const king = createPlayingCard({ id: 'k', suit: 'hearts', rank: 13 });
    const queen = createPlayingCard({ id: 'q', suit: 'clubs', rank: 12 });
    const jack = createPlayingCard({ id: 'j', suit: 'diamonds', rank: 11 });
    const ten = createPlayingCard({ id: '10', suit: 'spades', rank: 10 });
    const nine = createPlayingCard({ id: '9', suit: 'hearts', rank: 9 });
    const two = createPlayingCard({ id: '2', suit: 'clubs', rank: 2 });
    const stoneKing = createPlayingCard({ id: 'sk', suit: 'spades', rank: 13, enhancement: 'stone' });
    const debuffedKing = createPlayingCard({ id: 'dk', suit: 'spades', rank: 13, debuffed: true });
    const evalRes = evaluatePokerHand([king, queen]);

    const scary = createRelicInstance('j_scary_face', 'sf');
    const even = createRelicInstance('j_even_steven', 'es');
    const odd = createRelicInstance('j_odd_todd', 'ot');
    const photo = createRelicInstance('j_photograph', 'ph');
    const baron = createRelicInstance('j_baron', 'br');

    // j_scary_face: J/Q/K -> +30; A/10/Stone/debuffed -> null
    expect(
      callHook('j_scary_face', 'onScoreCard', {
        hook: 'onScoreCard',
        state,
        effectRelic: scary,
        stateRelic: scary,
        relicIndex: 0,
        isBlueprintCopy: false,
        card: jack,
        playedCards: [jack],
        scoringCards: [jack],
        handEvaluation: evalRes,
      })?.chipsDelta,
    ).toBe(30);
    expect(
      callHook('j_scary_face', 'onScoreCard', {
        hook: 'onScoreCard',
        state,
        effectRelic: scary,
        stateRelic: scary,
        relicIndex: 0,
        isBlueprintCopy: false,
        card: stoneKing,
        playedCards: [stoneKing],
        scoringCards: [stoneKing],
        handEvaluation: evalRes,
      }),
    ).toBeNull();

    // j_even_steven: 2 и 10 -> +4; Дама(12), Туз(14), 9, Stone -> null
    for (const c of [two, ten]) {
      expect(
        callHook('j_even_steven', 'onScoreCard', {
          hook: 'onScoreCard',
          state,
          effectRelic: even,
          stateRelic: even,
          relicIndex: 0,
          isBlueprintCopy: false,
          card: c,
          playedCards: [c],
          scoringCards: [c],
          handEvaluation: evalRes,
        })?.multDelta,
      ).toBe(4);
    }
    for (const c of [queen, ace, nine, stoneKing]) {
      expect(
        callHook('j_even_steven', 'onScoreCard', {
          hook: 'onScoreCard',
          state,
          effectRelic: even,
          stateRelic: even,
          relicIndex: 0,
          isBlueprintCopy: false,
          card: c,
          playedCards: [c],
          scoringCards: [c],
          handEvaluation: evalRes,
        }),
      ).toBeNull();
    }

    // j_odd_todd: Туз(14) и 9 -> +31; J(11), K(13), 10, 2, Stone -> null
    for (const c of [ace, nine]) {
      expect(
        callHook('j_odd_todd', 'onScoreCard', {
          hook: 'onScoreCard',
          state,
          effectRelic: odd,
          stateRelic: odd,
          relicIndex: 0,
          isBlueprintCopy: false,
          card: c,
          playedCards: [c],
          scoringCards: [c],
          handEvaluation: evalRes,
        })?.chipsDelta,
      ).toBe(31);
    }
    for (const c of [jack, king, ten, two, stoneKing]) {
      expect(
        callHook('j_odd_todd', 'onScoreCard', {
          hook: 'onScoreCard',
          state,
          effectRelic: odd,
          stateRelic: odd,
          relicIndex: 0,
          isBlueprintCopy: false,
          card: c,
          playedCards: [c],
          scoringCards: [c],
          handEvaluation: evalRes,
        }),
      ).toBeNull();
    }

    // j_photograph: первая неподавленная картинка (через isFirstScoringFaceCard и без него)
    expect(
      callHook('j_photograph', 'onScoreCard', {
        hook: 'onScoreCard',
        state,
        effectRelic: photo,
        stateRelic: photo,
        relicIndex: 0,
        isBlueprintCopy: false,
        card: king,
        playedCards: [debuffedKing, king, queen],
        scoringCards: [debuffedKing, king, queen],
        handEvaluation: evalRes,
        isFirstScoringFaceCard: true,
      })?.xMult,
    ).toBe(2);
    expect(
      callHook('j_photograph', 'onScoreCard', {
        hook: 'onScoreCard',
        state,
        effectRelic: photo,
        stateRelic: photo,
        relicIndex: 0,
        isBlueprintCopy: false,
        card: queen,
        playedCards: [debuffedKing, king, queen],
        scoringCards: [debuffedKing, king, queen],
        handEvaluation: evalRes,
        isFirstScoringFaceCard: false,
      }),
    ).toBeNull();
    // Фоллбек вычисления без переданного флага isFirstScoringFaceCard (debuffedKing пропускается!)
    expect(
      callHook('j_photograph', 'onScoreCard', {
        hook: 'onScoreCard',
        state,
        effectRelic: photo,
        stateRelic: photo,
        relicIndex: 0,
        isBlueprintCopy: false,
        card: king,
        playedCards: [debuffedKing, king, queen],
        scoringCards: [debuffedKing, king, queen],
        handEvaluation: evalRes,
      })?.xMult,
    ).toBe(2);

    // j_baron: Король в руке -> x1.5; Каменный Король или подавленный -> null
    expect(
      callHook('j_baron', 'onHoldCard', {
        hook: 'onHoldCard',
        state,
        effectRelic: baron,
        stateRelic: baron,
        relicIndex: 0,
        isBlueprintCopy: false,
        card: king,
        handCards: [king, stoneKing, debuffedKing],
        handEvaluation: evalRes,
      })?.xMult,
    ).toBe(1.5);
    expect(
      callHook('j_baron', 'onHoldCard', {
        hook: 'onHoldCard',
        state,
        effectRelic: baron,
        stateRelic: baron,
        relicIndex: 0,
        isBlueprintCopy: false,
        card: stoneKing,
        handCards: [king, stoneKing, debuffedKing],
        handEvaluation: evalRes,
      }),
    ).toBeNull();
    expect(
      callHook('j_baron', 'onHoldCard', {
        hook: 'onHoldCard',
        state,
        effectRelic: baron,
        stateRelic: baron,
        relicIndex: 0,
        isBlueprintCopy: false,
        card: debuffedKing,
        handCards: [king, stoneKing, debuffedKing],
        handEvaluation: evalRes,
      }),
    ).toBeNull();
  });
});

describe('Сложные условия R2/R3 (j_blackboard, j_card_sharp, j_acrobat, j_stencil, j_sock_and_buskin, j_mime, j_golden, j_vagabond)', () => {
  it('проверяет все граничные случаи j_blackboard: пустая рука, подавленные Пики/Трефы, подавленный Wild, Stone', () => {
    const state = createTestRunState();
    const bb = createRelicInstance('j_blackboard', 'bb');
    const evalRes = evaluatePokerHand([createPlayingCard({ id: 'p', suit: 'hearts', rank: 2 })]);

    const runBlackboard = (handCards: readonly PlayingCard[]) =>
      callHook('j_blackboard', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state,
        effectRelic: bb,
        stateRelic: bb,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: [],
        scoringCards: [],
        handCards,
        handEvaluation: evalRes,
      });

    // Пустая рука -> x3
    expect(runBlackboard([])?.xMult).toBe(3);

    // Подавленная Трефа и неподавленный Wild Червы -> x3
    const debuffedClub = createPlayingCard({ id: 'dc', suit: 'clubs', rank: 5, debuffed: true });
    const wildHeart = createPlayingCard({ id: 'wh', suit: 'hearts', rank: 9, enhancement: 'wild' });
    expect(runBlackboard([debuffedClub, wildHeart])?.xMult).toBe(3);

    // Подавленный Wild (масть Бубны) теряет универсальность -> null
    const debuffedWildDiamond = createPlayingCard({
      id: 'dwd',
      suit: 'diamonds',
      rank: 7,
      enhancement: 'wild',
      debuffed: true,
    });
    expect(runBlackboard([debuffedClub, debuffedWildDiamond])).toBeNull();

    // Stone-карта с базовой мастью Пики не считается мастью -> null
    const stoneSpade = createPlayingCard({ id: 'ss', suit: 'spades', rank: 8, enhancement: 'stone' });
    expect(runBlackboard([stoneSpade])).toBeNull();
  });

  it('проверяет j_card_sharp и j_acrobat', () => {
    const pairCards = [
      createPlayingCard({ id: '1', suit: 'spades', rank: 7 }),
      createPlayingCard({ id: '2', suit: 'hearts', rank: 7 }),
    ];
    const evalPair = evaluatePokerHand(pairCards);

    const sharp = createRelicInstance('j_card_sharp', 'cs');
    const stateFirst = createTestRunState({ handsPlayedThisRound: { Pair: 1 } });
    const stateSecond = createTestRunState({ handsPlayedThisRound: { Pair: 2 } });

    expect(
      callHook('j_card_sharp', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state: stateFirst,
        effectRelic: sharp,
        stateRelic: sharp,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: pairCards,
        scoringCards: pairCards,
        handCards: [],
        handEvaluation: evalPair,
      }),
    ).toBeNull();
    expect(
      callHook('j_card_sharp', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state: stateSecond,
        effectRelic: sharp,
        stateRelic: sharp,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: pairCards,
        scoringCards: pairCards,
        handCards: [],
        handEvaluation: evalPair,
      })?.xMult,
    ).toBe(3);

    const acrobat = createRelicInstance('j_acrobat', 'ac');
    expect(
      callHook('j_acrobat', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state: createTestRunState({ handsLeft: 1 }),
        effectRelic: acrobat,
        stateRelic: acrobat,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: pairCards,
        scoringCards: pairCards,
        handCards: [],
        handEvaluation: evalPair,
      }),
    ).toBeNull();
    expect(
      callHook('j_acrobat', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state: createTestRunState({ handsLeft: 0 }),
        effectRelic: acrobat,
        stateRelic: acrobat,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: pairCards,
        scoringCards: pairCards,
        handCards: [],
        handEvaluation: evalPair,
      })?.xMult,
    ).toBe(3);
  });

  it('проверяет j_stencil (с учётом negative слотов и строгого порога emptySlots > 0)', () => {
    const stencil1 = createRelicInstance('j_stencil', 'st1');
    const stencil2 = createRelicInstance('j_stencil', 'st2');
    const negStencil = createRelicInstance('j_stencil', 'st_neg', 'negative');
    const bp = createRelicInstance('j_blueprint', 'bp');
    const filler = createRelicInstance('j_joker', 'f');
    const evalRes = evaluatePokerHand([createPlayingCard({ id: '1', suit: 'spades', rank: 14 })]);

    const runStencil = (relics: readonly RelicInstance[], effectRelic = stencil1, stateRelic = stencil1, isCopy = false) =>
      callHook('j_stencil', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state: createTestRunState({ maxRelics: 5, relics }),
        effectRelic,
        stateRelic,
        relicIndex: 0,
        isBlueprintCopy: isCopy,
        playedCards: [],
        scoringCards: [],
        handCards: [],
        handEvaluation: evalRes,
      });

    // 1 слепок в 5 слотах: empty = 4 > 0 -> 4 + 1 = x5
    expect(runStencil([stencil1])?.xMult).toBe(5);

    // 2 слепка + 2 реликвии (4 занято, 1 пустой): empty = 1 > 0 -> 1 + 2 = x3
    expect(runStencil([stencil1, stencil2, filler, filler])?.xMult).toBe(3);

    // 5 занятых слотов (вкл. 2 слепка): empty = 0 -> НЕ срабатывает (vanilla gate!)
    expect(runStencil([stencil1, stencil2, filler, filler, filler])).toBeNull();

    // 5 реликвий, одна из них negative: limit = 5 + 1 = 6, empty = 1 > 0 -> 1 + 1 = x2
    expect(runStencil([negStencil, filler, filler, filler, filler], negStencil, negStencil)?.xMult).toBe(2);

    // Blueprint копирует Stencil: xMult = (5 - 2) + 1 = x4 (при 0 пустых слотов тоже null)
    expect(runStencil([bp, stencil1], stencil1, bp, true)?.xMult).toBe(4);
    expect(runStencil([bp, stencil1, filler, filler, filler], stencil1, bp, true)).toBeNull();
  });

  it('проверяет ретриггеры j_sock_and_buskin и j_mime (фазы scoring и roundEnd)', () => {
    const state = createTestRunState();
    const queen = createPlayingCard({ id: 'q', suit: 'hearts', rank: 12 });
    const ten = createPlayingCard({ id: '10', suit: 'hearts', rank: 10 });
    const stoneQ = createPlayingCard({ id: 'sq', suit: 'hearts', rank: 12, enhancement: 'stone' });
    const debuffedQ = createPlayingCard({ id: 'dq', suit: 'hearts', rank: 12, debuffed: true });
    const evalRes = evaluatePokerHand([queen]);

    const sock = createRelicInstance('j_sock_and_buskin', 'sb');
    expect(
      callHook('j_sock_and_buskin', 'onScoreCardRepetition', {
        hook: 'onScoreCardRepetition',
        state,
        effectRelic: sock,
        stateRelic: sock,
        relicIndex: 0,
        isBlueprintCopy: false,
        card: queen,
        playedCards: [queen],
        scoringCards: [queen],
        handEvaluation: evalRes,
      })?.retriggerDelta,
    ).toBe(1);
    for (const c of [ten, stoneQ, debuffedQ]) {
      expect(
        callHook('j_sock_and_buskin', 'onScoreCardRepetition', {
          hook: 'onScoreCardRepetition',
          state,
          effectRelic: sock,
          stateRelic: sock,
          relicIndex: 0,
          isBlueprintCopy: false,
          card: c,
          playedCards: [c],
          scoringCards: [c],
          handEvaluation: evalRes,
        }),
      ).toBeNull();
    }

    const mime = createRelicInstance('j_mime', 'mm');
    const goldCard = createPlayingCard({ id: 'g', suit: 'diamonds', rank: 6, enhancement: 'gold' });
    expect(
      callHook('j_mime', 'onHoldCardRepetition', {
        hook: 'onHoldCardRepetition',
        state,
        effectRelic: mime,
        stateRelic: mime,
        relicIndex: 0,
        isBlueprintCopy: false,
        card: queen,
        handCards: [queen],
        handEvaluation: evalRes,
        phase: 'scoring',
      })?.retriggerDelta,
    ).toBe(1);
    expect(
      callHook('j_mime', 'onHoldCardRepetition', {
        hook: 'onHoldCardRepetition',
        state,
        effectRelic: mime,
        stateRelic: mime,
        relicIndex: 0,
        isBlueprintCopy: false,
        card: goldCard,
        handCards: [goldCard],
        phase: 'roundEnd',
      })?.retriggerDelta,
    ).toBe(1);
    expect(
      callHook('j_mime', 'onHoldCardRepetition', {
        hook: 'onHoldCardRepetition',
        state,
        effectRelic: mime,
        stateRelic: mime,
        relicIndex: 0,
        isBlueprintCopy: false,
        card: debuffedQ,
        handCards: [debuffedQ],
        phase: 'roundEnd',
      }),
    ).toBeNull();
  });

  it('проверяет j_golden (onRoundEnd) и j_vagabond (dollars <= 4 и свободный слот расходника)', () => {
    const golden = createRelicInstance('j_golden', 'g1');
    const stateWon = createTestRunState();
    expect(
      callHook('j_golden', 'onRoundEnd', {
        hook: 'onRoundEnd',
        state: stateWon,
        effectRelic: golden,
        stateRelic: golden,
        relicIndex: 0,
        isBlueprintCopy: false,
        blind: stateWon.anteBlinds[0],
        won: true,
      })?.dollarsDelta,
    ).toBe(4);
    expect(
      callHook('j_golden', 'onRoundEnd', {
        hook: 'onRoundEnd',
        state: stateWon,
        effectRelic: golden,
        stateRelic: golden,
        relicIndex: 0,
        isBlueprintCopy: false,
        blind: stateWon.anteBlinds[0],
        won: false,
      }),
    ).toBeNull();

    const vagabond = createRelicInstance('j_vagabond', 'vg');
    const bp = createRelicInstance('j_blueprint', 'bp');
    const evalRes = evaluatePokerHand([createPlayingCard({ id: '1', suit: 'spades', rank: 2 })]);
    const dummyConsumable: ConsumableInstance = {
      uid: 'con1',
      id: 'c_fool',
      kind: 'scroll',
      edition: 'base',
      baseCost: 3,
      sellValue: 1,
    };

    // <= 4$ и есть место -> 'scroll' (и Blueprint тоже копирует!)
    expect(
      callHook('j_vagabond', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state: createTestRunState({ dollars: 4, consumables: [dummyConsumable], maxConsumables: 2 }),
        effectRelic: vagabond,
        stateRelic: bp,
        relicIndex: 0,
        isBlueprintCopy: true,
        playedCards: [],
        scoringCards: [],
        handCards: [],
        handEvaluation: evalRes,
      })?.createConsumableKind,
    ).toBe('scroll');

    // 5$ -> null
    expect(
      callHook('j_vagabond', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state: createTestRunState({ dollars: 5, consumables: [], maxConsumables: 2 }),
        effectRelic: vagabond,
        stateRelic: vagabond,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: [],
        scoringCards: [],
        handCards: [],
        handEvaluation: evalRes,
      }),
    ).toBeNull();

    // Слоты расходников заполнены -> null
    expect(
      callHook('j_vagabond', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state: createTestRunState({
          dollars: 2,
          consumables: [dummyConsumable, { ...dummyConsumable, uid: 'con2' }],
          maxConsumables: 2,
        }),
        effectRelic: vagabond,
        stateRelic: vagabond,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: [],
        scoringCards: [],
        handCards: [],
        handEvaluation: evalRes,
      }),
    ).toBeNull();
  });
});

describe('Накопительные скейлеры и запрет мутации при isBlueprintCopy === true', () => {
  it('j_runner, j_green_joker, j_flash, j_trousers, j_ceremonial корректно растут только при !isBlueprintCopy и отдают счёт в копиях', () => {
    const bp = createRelicInstance('j_blueprint', 'bp');
    const straightCards = [2, 3, 4, 5, 6].map((r, i) =>
      createPlayingCard({ id: `s${i}`, suit: i % 2 === 0 ? 'spades' : 'hearts', rank: r as 2 | 3 | 4 | 5 | 6 }),
    );
    const twoPairCards = [
      createPlayingCard({ id: 'tp1', suit: 'spades', rank: 9 }),
      createPlayingCard({ id: 'tp2', suit: 'hearts', rank: 9 }),
      createPlayingCard({ id: 'tp3', suit: 'clubs', rank: 4 }),
      createPlayingCard({ id: 'tp4', suit: 'diamonds', rank: 4 }),
    ];
    const straightEval = evaluatePokerHand(straightCards);
    const twoPairEval = evaluatePokerHand(twoPairCards);
    const state = createTestRunState();

    // j_runner
    const runner = createRelicInstance('j_runner', 'run');
    const runGrow = callHook('j_runner', 'onBeforeScore', {
      hook: 'onBeforeScore',
      state,
      effectRelic: runner,
      stateRelic: runner,
      relicIndex: 0,
      isBlueprintCopy: false,
      playedCards: straightCards,
      scoringCards: straightCards,
      handCards: [],
      handEvaluation: straightEval,
    });
    expect(runGrow?.updatedEffectState?.chips).toBe(15);
    // Blueprint-копия НЕ скейлит j_runner, но считывает накопленное
    expect(
      callHook('j_runner', 'onBeforeScore', {
        hook: 'onBeforeScore',
        state,
        effectRelic: runner,
        stateRelic: bp,
        relicIndex: 0,
        isBlueprintCopy: true,
        playedCards: straightCards,
        scoringCards: straightCards,
        handCards: [],
        handEvaluation: straightEval,
      }),
    ).toBeNull();
    const grownRunner: RelicInstance = { ...runner, state: runGrow!.updatedEffectState! };
    expect(
      callHook('j_runner', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state,
        effectRelic: grownRunner,
        stateRelic: bp,
        relicIndex: 0,
        isBlueprintCopy: true,
        playedCards: straightCards,
        scoringCards: straightCards,
        handCards: [],
        handEvaluation: straightEval,
      })?.chipsDelta,
    ).toBe(15);

    // j_green_joker: +1 на onBeforeScore, -1 (мин 0) ТОЛЬКО на isLastDiscardedCard === true
    const green = createRelicInstance('j_green_joker', 'gj');
    expect(
      callHook('j_green_joker', 'onBeforeScore', {
        hook: 'onBeforeScore',
        state,
        effectRelic: green,
        stateRelic: green,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: twoPairCards,
        scoringCards: twoPairCards,
        handCards: [],
        handEvaluation: twoPairEval,
      })?.updatedEffectState?.mult,
    ).toBe(1);
    expect(
      callHook('j_green_joker', 'onBeforeScore', {
        hook: 'onBeforeScore',
        state,
        effectRelic: green,
        stateRelic: bp,
        relicIndex: 0,
        isBlueprintCopy: true,
        playedCards: twoPairCards,
        scoringCards: twoPairCards,
        handCards: [],
        handEvaluation: twoPairEval,
      }),
    ).toBeNull();

    const greenWithMult: RelicInstance = { ...green, state: { chips: 0, mult: 2, xMult: 1 } };
    expect(
      callHook('j_green_joker', 'onDiscard', {
        hook: 'onDiscard',
        state,
        effectRelic: greenWithMult,
        stateRelic: greenWithMult,
        relicIndex: 0,
        isBlueprintCopy: false,
        discardedCards: twoPairCards,
        card: twoPairCards[0],
        cardIndex: 0,
        isLastDiscardedCard: false,
      }),
    ).toBeNull();
    expect(
      callHook('j_green_joker', 'onDiscard', {
        hook: 'onDiscard',
        state,
        effectRelic: greenWithMult,
        stateRelic: greenWithMult,
        relicIndex: 0,
        isBlueprintCopy: false,
        discardedCards: twoPairCards,
        card: twoPairCards[3],
        cardIndex: 3,
        isLastDiscardedCard: true,
      })?.updatedEffectState?.mult,
    ).toBe(1);
    // При 0 не уходит в минус и при Blueprint-копии не сбрасывает
    expect(
      callHook('j_green_joker', 'onDiscard', {
        hook: 'onDiscard',
        state,
        effectRelic: green,
        stateRelic: green,
        relicIndex: 0,
        isBlueprintCopy: false,
        discardedCards: [twoPairCards[0]],
        card: twoPairCards[0],
        cardIndex: 0,
        isLastDiscardedCard: true,
      }),
    ).toBeNull();
    expect(
      callHook('j_green_joker', 'onDiscard', {
        hook: 'onDiscard',
        state,
        effectRelic: greenWithMult,
        stateRelic: bp,
        relicIndex: 0,
        isBlueprintCopy: true,
        discardedCards: [twoPairCards[0]],
        card: twoPairCards[0],
        cardIndex: 0,
        isLastDiscardedCard: true,
      }),
    ).toBeNull();

    // j_flash
    const flash = createRelicInstance('j_flash', 'fl');
    const flashUp = callHook('j_flash', 'onShopReroll', {
      hook: 'onShopReroll',
      state,
      effectRelic: flash,
      stateRelic: flash,
      relicIndex: 0,
      isBlueprintCopy: false,
      rerollCost: 5,
    });
    expect(flashUp?.updatedEffectState?.mult).toBe(2);
    expect(
      callHook('j_flash', 'onShopReroll', {
        hook: 'onShopReroll',
        state,
        effectRelic: flash,
        stateRelic: bp,
        relicIndex: 0,
        isBlueprintCopy: true,
        rerollCost: 5,
      }),
    ).toBeNull();

    // j_trousers
    const trousers = createRelicInstance('j_trousers', 'tr');
    const trousersUp = callHook('j_trousers', 'onBeforeScore', {
      hook: 'onBeforeScore',
      state,
      effectRelic: trousers,
      stateRelic: trousers,
      relicIndex: 0,
      isBlueprintCopy: false,
      playedCards: twoPairCards,
      scoringCards: twoPairCards,
      handCards: [],
      handEvaluation: twoPairEval,
    });
    expect(trousersUp?.updatedEffectState?.mult).toBe(2);
    expect(
      callHook('j_trousers', 'onBeforeScore', {
        hook: 'onBeforeScore',
        state,
        effectRelic: trousers,
        stateRelic: bp,
        relicIndex: 0,
        isBlueprintCopy: true,
        playedCards: twoPairCards,
        scoringCards: twoPairCards,
        handCards: [],
        handEvaluation: twoPairEval,
      }),
    ).toBeNull();

    // j_ceremonial: уничтожает relics[idx + 1] и прибавляет 2 * sellValue
    const dagger = createRelicInstance('j_ceremonial', 'dg');
    const sacrifice = createRelicInstance('j_blueprint', 'sac'); // sellValue = 5
    const daggerState = createTestRunState({ relics: [dagger, sacrifice] });
    const daggerRes = callHook('j_ceremonial', 'onBlindSelect', {
      hook: 'onBlindSelect',
      state: daggerState,
      effectRelic: dagger,
      stateRelic: dagger,
      relicIndex: 0,
      isBlueprintCopy: false,
      blind: daggerState.anteBlinds[0],
    });
    expect(daggerRes?.destroyRightRelic).toBe(true);
    expect(daggerRes?.destroyedRelicUid).toBe('sac');
    expect(daggerRes?.updatedEffectState?.mult).toBe(10);
    // Blueprint НЕ уничтожает соседа и НЕ скейлит кинжал
    expect(
      callHook('j_ceremonial', 'onBlindSelect', {
        hook: 'onBlindSelect',
        state: createTestRunState({ relics: [bp, dagger, sacrifice] }),
        effectRelic: dagger,
        stateRelic: bp,
        relicIndex: 0,
        isBlueprintCopy: true,
        blind: daggerState.anteBlinds[0],
      }),
    ).toBeNull();
  });

  it('j_constellation, j_hologram, j_vampire и j_ramen работают точно по контракту и не мутируют при Blueprint', () => {
    const bp = createRelicInstance('j_blueprint', 'bp');
    const state = createTestRunState();

    // j_constellation: +0.1 за 'celestial', игнорирует 'scroll', не скейлит при Blueprint
    const constellation = createRelicInstance('j_constellation', 'con');
    const sphere: ConsumableInstance = {
      uid: 'c1',
      id: 'c_mercury',
      kind: 'celestial',
      edition: 'base',
      baseCost: 3,
      sellValue: 1,
    };
    const scroll: ConsumableInstance = {
      uid: 'c2',
      id: 'c_hermit',
      kind: 'scroll',
      edition: 'base',
      baseCost: 3,
      sellValue: 1,
    };
    expect(
      callHook('j_constellation', 'onUseConsumable', {
        hook: 'onUseConsumable',
        state,
        effectRelic: constellation,
        stateRelic: constellation,
        relicIndex: 0,
        isBlueprintCopy: false,
        consumable: scroll,
      }),
    ).toBeNull();
    const conUp = callHook('j_constellation', 'onUseConsumable', {
      hook: 'onUseConsumable',
      state,
      effectRelic: constellation,
      stateRelic: constellation,
      relicIndex: 0,
      isBlueprintCopy: false,
      consumable: sphere,
    });
    expect(conUp?.updatedEffectState?.xMult).toBe(1.1);
    expect(
      callHook('j_constellation', 'onUseConsumable', {
        hook: 'onUseConsumable',
        state,
        effectRelic: constellation,
        stateRelic: bp,
        relicIndex: 0,
        isBlueprintCopy: true,
        consumable: sphere,
      }),
    ).toBeNull();

    // j_hologram: +0.25 * addedCards.length
    const hologram = createRelicInstance('j_hologram', 'holo');
    const added = [
      createPlayingCard({ id: 'a1', suit: 'spades', rank: 2 }),
      createPlayingCard({ id: 'a2', suit: 'hearts', rank: 3 }),
    ];
    const holoUp = callHook('j_hologram', 'onCardAdded', {
      hook: 'onCardAdded',
      state,
      effectRelic: hologram,
      stateRelic: hologram,
      relicIndex: 0,
      isBlueprintCopy: false,
      addedCards: added,
    });
    expect(holoUp?.updatedEffectState?.xMult).toBe(1.5);
    expect(
      callHook('j_hologram', 'onCardAdded', {
        hook: 'onCardAdded',
        state,
        effectRelic: hologram,
        stateRelic: bp,
        relicIndex: 0,
        isBlueprintCopy: true,
        addedCards: added,
      }),
    ).toBeNull();

    // j_vampire: собирает strippedCardIds только из неподавленных scoringCards с enhancement !== 'none'
    const vampire = createRelicInstance('j_vampire', 'vp');
    const cBonus = createPlayingCard({ id: 'vb', suit: 'spades', rank: 10, enhancement: 'bonus' });
    const cStone = createPlayingCard({ id: 'vs', suit: 'hearts', rank: 10, enhancement: 'stone' });
    const cDebuffedMult = createPlayingCard({
      id: 'vd',
      suit: 'clubs',
      rank: 10,
      enhancement: 'mult',
      debuffed: true,
    });
    const cPlain = createPlayingCard({ id: 'vp_plain', suit: 'diamonds', rank: 5 });
    const vpEval = evaluatePokerHand([cBonus, cDebuffedMult, cPlain, cStone]);

    const vpRes = callHook('j_vampire', 'onBeforeScore', {
      hook: 'onBeforeScore',
      state,
      effectRelic: vampire,
      stateRelic: vampire,
      relicIndex: 0,
      isBlueprintCopy: false,
      playedCards: [cBonus, cDebuffedMult, cPlain, cStone],
      scoringCards: [cBonus, cDebuffedMult, cStone],
      handCards: [],
      handEvaluation: vpEval,
    });
    expect(vpRes?.stripCardEnhancement).toBe(true);
    expect(vpRes?.strippedCardIds).toEqual(['vb', 'vs']);
    expect(vpRes?.updatedEffectState?.xMult).toBe(1.2);
    expect(
      callHook('j_vampire', 'onBeforeScore', {
        hook: 'onBeforeScore',
        state,
        effectRelic: vampire,
        stateRelic: bp,
        relicIndex: 0,
        isBlueprintCopy: true,
        playedCards: [cBonus, cStone],
        scoringCards: [cBonus, cStone],
        handCards: [],
        handEvaluation: vpEval,
      }),
    ).toBeNull();

    // j_ramen: -0.01 за сброшенную карту, уничтожается при <= 1
    let ramen = createRelicInstance('j_ramen', 'rm');
    const discardCard = createPlayingCard({ id: 'd1', suit: 'spades', rank: 2 });
    const ramenStep = callHook('j_ramen', 'onDiscard', {
      hook: 'onDiscard',
      state,
      effectRelic: ramen,
      stateRelic: ramen,
      relicIndex: 0,
      isBlueprintCopy: false,
      discardedCards: [discardCard],
      card: discardCard,
      cardIndex: 0,
      isLastDiscardedCard: true,
    });
    expect(ramenStep?.destroySelf).toBeUndefined();
    expect(ramenStep?.updatedEffectState?.xMult).toBe(1.99);

    // Blueprint копия не тратит эликсир
    expect(
      callHook('j_ramen', 'onDiscard', {
        hook: 'onDiscard',
        state,
        effectRelic: ramen,
        stateRelic: bp,
        relicIndex: 0,
        isBlueprintCopy: true,
        discardedCards: [discardCard],
        card: discardCard,
        cardIndex: 0,
        isLastDiscardedCard: true,
      }),
    ).toBeNull();

    // На 1.01 следующий сброс приводит к 1.00 <= 1 -> destroySelf: true
    ramen = { ...ramen, state: { chips: 0, mult: 0, xMult: 1.01 } };
    const ramenDepleted = callHook('j_ramen', 'onDiscard', {
      hook: 'onDiscard',
      state,
      effectRelic: ramen,
      stateRelic: ramen,
      relicIndex: 0,
      isBlueprintCopy: false,
      discardedCards: [discardCard],
      card: discardCard,
      cardIndex: 0,
      isLastDiscardedCard: true,
    });
    expect(ramenDepleted?.destroySelf).toBe(true);
    expect(ramenDepleted?.destroyedRelicUid).toBe('rm');

    // Копия xMult от скейлера на onScoreRelic работает
    const activeRamen: RelicInstance = { ...ramen, state: { chips: 0, mult: 0, xMult: 1.5 } };
    expect(
      callHook('j_ramen', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state,
        effectRelic: activeRamen,
        stateRelic: bp,
        relicIndex: 0,
        isBlueprintCopy: true,
        playedCards: [],
        scoringCards: [],
        handCards: [],
        handEvaluation: vpEval,
      })?.xMult,
    ).toBe(1.5);
  });

  it('покрывает дополнительные граничные случаи: 100 шагов j_ramen, точность float, ретриггер j_photograph, цепочки Blueprint и защиту debuffed', () => {
    const state = createTestRunState();
    const lookup: import('../../src/engine/types').RelicRegistryLookup = getRelicDefinition;
    expect(lookup('j_joker')?.baseCost).toBe(2);

    // Цепочка Blueprint -> Blueprint -> Joker
    const bp1 = createRelicInstance('j_blueprint', 'bp1', 'foil');
    const bp2 = createRelicInstance('j_blueprint', 'bp2');
    const joker = createRelicInstance('j_joker', 'jk');
    expect(resolveRelicTarget([bp1, bp2, joker], 0)).toEqual({
      effectRelic: joker,
      stateRelic: bp1,
      isBlueprintCopy: true,
    });

    // Точность float в j_constellation на 10 использований (1.0 -> 2.0 без 1.3000000000000003)
    let constellation = createRelicInstance('j_constellation', 'c_float');
    const sphere: ConsumableInstance = {
      uid: 'sp',
      id: 'c_pluto',
      kind: 'celestial',
      edition: 'base',
      baseCost: 3,
      sellValue: 1,
    };
    const observedXMults: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const res = callHook('j_constellation', 'onUseConsumable', {
        hook: 'onUseConsumable',
        state,
        effectRelic: constellation,
        stateRelic: constellation,
        relicIndex: 0,
        isBlueprintCopy: false,
        consumable: sphere,
      });
      const nextState = res!.updatedEffectState!;
      observedXMults.push(nextState.xMult);
      constellation = { ...constellation, state: nextState };
    }
    expect(observedXMults).toEqual([1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2]);

    // 100 одиночных сбросов для j_ramen: на 99-м -> 1.01 (жив), на 100-м -> уничтожается (<= 1)
    let ramen = createRelicInstance('j_ramen', 'rm_100');
    const card = createPlayingCard({ id: 'd', suit: 'spades', rank: 2 });
    for (let i = 0; i < 99; i += 1) {
      const res = callHook('j_ramen', 'onDiscard', {
        hook: 'onDiscard',
        state,
        effectRelic: ramen,
        stateRelic: ramen,
        relicIndex: 0,
        isBlueprintCopy: false,
        discardedCards: [card],
        card,
        cardIndex: 0,
        isLastDiscardedCard: true,
      });
      expect(res?.destroySelf).toBeUndefined();
      ramen = { ...ramen, state: res!.updatedEffectState! };
    }
    expect(ramen.state.xMult).toBe(1.01);
    const hundredth = callHook('j_ramen', 'onDiscard', {
      hook: 'onDiscard',
      state,
      effectRelic: ramen,
      stateRelic: ramen,
      relicIndex: 0,
      isBlueprintCopy: false,
      discardedCards: [card],
      card,
      cardIndex: 0,
      isLastDiscardedCard: true,
    });
    expect(hundredth?.destroySelf).toBe(true);

    // Пакетный вызов j_ramen (без поля card) для 3 сброшенных карт -> -0.03
    const batchRamen = callHook('j_ramen', 'onDiscard', {
      hook: 'onDiscard',
      state,
      effectRelic: createRelicInstance('j_ramen', 'rm_batch'),
      stateRelic: createRelicInstance('j_ramen', 'rm_batch'),
      relicIndex: 0,
      isBlueprintCopy: false,
      discardedCards: [card, card, card],
    });
    expect(batchRamen?.updatedEffectState?.xMult).toBe(1.97);

    // j_ceremonial в крайнем правом слоте (нет соседа справа) и при eternal-соседе -> null
    const dagger = createRelicInstance('j_ceremonial', 'dg_last');
    const eternalNeighbor: RelicInstance = {
      ...createRelicInstance('j_joker', 'et'),
      state: { chips: 0, mult: 0, xMult: 1, extra: { eternal: true } },
    };
    expect(
      callHook('j_ceremonial', 'onBlindSelect', {
        hook: 'onBlindSelect',
        state: createTestRunState({ relics: [dagger] }),
        effectRelic: dagger,
        stateRelic: dagger,
        relicIndex: 0,
        isBlueprintCopy: false,
        blind: state.anteBlinds[0],
      }),
    ).toBeNull();
    expect(
      callHook('j_ceremonial', 'onBlindSelect', {
        hook: 'onBlindSelect',
        state: createTestRunState({ relics: [dagger, eternalNeighbor] }),
        effectRelic: dagger,
        stateRelic: dagger,
        relicIndex: 0,
        isBlueprintCopy: false,
        blind: state.anteBlinds[0],
      }),
    ).toBeNull();

    // j_vampire без улучшений / только с подавленной картой и j_hologram с пустым addedCards -> null
    const plainCard = createPlayingCard({ id: 'pl', suit: 'hearts', rank: 3 });
    const debuffedEnh = createPlayingCard({ id: 'de', suit: 'hearts', rank: 4, enhancement: 'mult', debuffed: true });
    const vpEval = evaluatePokerHand([plainCard, debuffedEnh]);
    const vampire = createRelicInstance('j_vampire', 'vp_empty');
    expect(
      callHook('j_vampire', 'onBeforeScore', {
        hook: 'onBeforeScore',
        state,
        effectRelic: vampire,
        stateRelic: vampire,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: [plainCard, debuffedEnh],
        scoringCards: [plainCard, debuffedEnh],
        handCards: [],
        handEvaluation: vpEval,
      }),
    ).toBeNull();

    const hologram = createRelicInstance('j_hologram', 'holo_empty');
    expect(
      callHook('j_hologram', 'onCardAdded', {
        hook: 'onCardAdded',
        state,
        effectRelic: hologram,
        stateRelic: hologram,
        relicIndex: 0,
        isBlueprintCopy: false,
        addedCards: [],
      }),
    ).toBeNull();

    // j_photograph срабатывает на каждый ретриггер первой лицевой карты
    const king = createPlayingCard({ id: 'k1', suit: 'spades', rank: 13 });
    const photo = createRelicInstance('j_photograph', 'ph_retrigger');
    const photoCtx: RelicHookContextFor<'onScoreCard'> = {
      hook: 'onScoreCard',
      state,
      effectRelic: photo,
      stateRelic: photo,
      relicIndex: 0,
      isBlueprintCopy: false,
      card: king,
      playedCards: [king],
      scoringCards: [king],
      handEvaluation: evaluatePokerHand([king]),
      isFirstScoringFaceCard: true,
    };
    expect(callHook('j_photograph', 'onScoreCard', photoCtx)?.xMult).toBe(2);
    expect(callHook('j_photograph', 'onScoreCard', photoCtx)?.xMult).toBe(2);

    // Прямой вызов хука подавленной Реликвии возвращает null
    const debuffedJoker: RelicInstance = { ...joker, debuffed: true };
    expect(
      callHook('j_joker', 'onScoreRelic', {
        hook: 'onScoreRelic',
        state,
        effectRelic: debuffedJoker,
        stateRelic: debuffedJoker,
        relicIndex: 0,
        isBlueprintCopy: false,
        playedCards: [king],
        scoringCards: [king],
        handCards: [],
        handEvaluation: evaluatePokerHand([king]),
      }),
    ).toBeNull();
  });
});
