import { describe, expect, it } from 'vitest';
import { createPlayingCard } from '../../src/engine/cards';
import { createInitialHandLevels } from '../../src/engine/handEval';
import { createRngState, nextFloat } from '../../src/engine/prng';
import { evaluatePlay, evaluateRoundEnd } from '../../src/engine/scoring';
import {
  type BlindSlotState,
  type ConsumableInstance,
  type PlayingCard,
  type RelicDefinition,
  type RelicId,
  type RelicInstance,
  type RelicRegistryLookup,
  type RunState,
} from '../../src/engine/types';

function makeRelic(
  uid: string,
  id: RelicId,
  overrides: Partial<RelicInstance> = {},
): RelicInstance {
  return {
    uid,
    id,
    edition: overrides.edition ?? 'base',
    baseCost: overrides.baseCost ?? 5,
    sellValue: overrides.sellValue ?? 2,
    extraValue: overrides.extraValue ?? 0,
    debuffed: overrides.debuffed ?? false,
    state: overrides.state ?? { chips: 0, mult: 0, xMult: 1 },
  };
}

function makeRegistry(defs: Partial<Record<RelicId, RelicDefinition>>): RelicRegistryLookup {
  return (id) => defs[id];
}

function makeBaseState(overrides: Partial<RunState> = {}): RunState {
  const defaultBlinds: readonly [BlindSlotState, BlindSlotState, BlindSlotState] = [
    {
      kind: 'small',
      bossId: null,
      targetScore: 300,
      reward: 3,
      status: 'current',
      skipTagId: 'tag_coupon',
    },
    {
      kind: 'big',
      bossId: null,
      targetScore: 450,
      reward: 4,
      status: 'upcoming',
      skipTagId: 'tag_skip',
    },
    {
      kind: 'boss',
      bossId: 'bl_hook',
      targetScore: 600,
      reward: 5,
      status: 'upcoming',
      skipTagId: null,
    },
  ];

  const deck: readonly PlayingCard[] = overrides.deck ?? [
    createPlayingCard({ id: 'c1', suit: 'spades', rank: 14 }),
    createPlayingCard({ id: 'c2', suit: 'hearts', rank: 14 }),
    createPlayingCard({ id: 'c3', suit: 'clubs', rank: 5 }),
    createPlayingCard({ id: 'c4', suit: 'diamonds', rank: 8 }),
    createPlayingCard({ id: 'c5', suit: 'spades', rank: 9 }),
  ];

  return {
    version: 1,
    seed: 'SCORE-TEST',
    rngState: createRngState('SCORE-TEST'),
    deckId: 'b_red',
    phase: 'playing',
    previousPhase: null,
    ante: 1,
    round: 1,
    currentBlindIndex: 0,
    anteBlinds: defaultBlinds,
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
    deck,
    drawPileIds: [],
    handIds: deck.map((c) => c.id),
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
    nextCardUid: 100,
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

function findSeedWithRoll(
  stream: 'lucky' | 'glass',
  predicate: (firstRoll: number, secondRoll?: number) => boolean,
): string {
  for (let i = 0; i < 1000; i += 1) {
    const seed = `ROLL-${stream}-${i}`;
    const rng0 = createRngState(seed);
    const r1 = nextFloat(rng0, stream);
    const r2 = nextFloat(r1.nextState, stream);
    if (predicate(r1.value, r2.value)) {
      return seed;
    }
  }
  throw new Error('NO_TEST_SEED_FOUND');
}

describe('evaluatePlay: базовый 7-этапный конвейер и правила Боссов', () => {
  it('считает Пару + кикер + Каменную карту и обновляет счётчики/колоду', () => {
    const stone = createPlayingCard({
      id: 'st1',
      suit: 'clubs',
      rank: 2,
      enhancement: 'stone',
    });
    const baseDeck = [
      createPlayingCard({ id: 'c1', suit: 'spades', rank: 14 }),
      createPlayingCard({ id: 'c2', suit: 'hearts', rank: 14 }),
      createPlayingCard({ id: 'c3', suit: 'clubs', rank: 5 }),
      stone,
      createPlayingCard({ id: 'c4', suit: 'diamonds', rank: 9 }),
    ];
    const state = makeBaseState({ deck: baseDeck });

    // Играем: Туз(11), 5(не в счёте), Каменная(+50), Туз(11). База Пары = 10 x 2
    // Итого Сила = 10 + 11 + 50 + 11 = 82, Множ = 2 => 164 очка
    const res = evaluatePlay(state, ['c1', 'c3', 'st1', 'c2'], {
      relicRegistry: makeRegistry({}),
    });

    expect(res.nextState.score).toBe(164);
    expect(res.nextState.handsLeft).toBe(3);
    expect(res.nextState.lastPlayedHandType).toBe('Pair');
    expect(res.nextState.handLevels.Pair.playedCount).toBe(1);
    expect(res.nextState.handsPlayedThisRound.Pair).toBe(1);
    expect(res.nextState.handIds).toEqual(['c4']);
    expect(res.nextState.discardPileIds).toEqual(['c1', 'c3', 'st1', 'c2']);
    expect(res.nextState.deck.find((c) => c.id === 'c1')?.playedThisAnte).toBe(true);
    expect(res.nextState.deck.find((c) => c.id === 'c4')?.playedThisAnte).toBe(false);

    const scoreEvt = res.events.find((e) => e.type === 'SCORE_UPDATE');
    expect(scoreEvt).toEqual({
      type: 'SCORE_UPDATE',
      chips: 82,
      mult: 2,
      handScore: 164,
      totalScore: 164,
      targetScore: 300,
      handType: 'Pair',
    });
  });

  it('раскрывает скрытые расклады и эмитит BLIND_DEFEATED при достижении цели', () => {
    const flushFiveDeck = [
      createPlayingCard({ id: '1', suit: 'spades', rank: 14 }),
      createPlayingCard({ id: '2', suit: 'spades', rank: 14 }),
      createPlayingCard({ id: '3', suit: 'spades', rank: 14 }),
      createPlayingCard({ id: '4', suit: 'spades', rank: 14 }),
      createPlayingCard({ id: '5', suit: 'spades', rank: 14 }),
    ];
    const state = makeBaseState({ deck: flushFiveDeck, targetScore: 1000 });
    const res = evaluatePlay(state, ['1', '2', '3', '4', '5'], {
      relicRegistry: makeRegistry({}),
    });

    // Flush Five: 160 + 5*11 = 215 chips, 16 mult => 3440
    expect(res.nextState.handLevels['Flush Five'].visible).toBe(true);
    expect(res.nextState.score).toBe(3440);
    expect(res.events.some((e) => e.type === 'BLIND_DEFEATED')).toBe(true);
  });

  it('обрабатывает bl_psychic (debuffHand при <5 карт) и bl_flint (половина базы после onBeforeScore)', () => {
    const psychicState = makeBaseState({
      currentBlindIndex: 2,
      anteBlinds: [
        { kind: 'small', bossId: null, targetScore: 300, reward: 3, status: 'defeated', skipTagId: null },
        { kind: 'big', bossId: null, targetScore: 450, reward: 4, status: 'defeated', skipTagId: null },
        { kind: 'boss', bossId: 'bl_psychic', targetScore: 600, reward: 5, status: 'current', skipTagId: null },
      ],
      targetScore: 600,
    });

    const resPsychic = evaluatePlay(psychicState, ['c1', 'c2'], {
      relicRegistry: makeRegistry({}),
    });
    expect(resPsychic.nextState.score).toBe(0);
    expect(resPsychic.nextState.handsLeft).toBe(3);
    expect(resPsychic.nextState.handLevels.Pair.playedCount).toBe(1);
    expect(resPsychic.events.some((e) => e.type === 'HAND_DEBUFFED')).toBe(true);

    // bl_flint делит базу Пары (10 x 2 -> 5 x 1) после onBeforeScore, но до Step 4 карт
    const flintState = makeBaseState({
      currentBlindIndex: 2,
      anteBlinds: [
        { kind: 'small', bossId: null, targetScore: 300, reward: 3, status: 'defeated', skipTagId: null },
        { kind: 'big', bossId: null, targetScore: 450, reward: 4, status: 'defeated', skipTagId: null },
        { kind: 'boss', bossId: 'bl_flint', targetScore: 600, reward: 5, status: 'current', skipTagId: null },
      ],
      targetScore: 600,
    });
    const resFlint = evaluatePlay(flintState, ['c1', 'c2'], {
      relicRegistry: makeRegistry({}),
    });
    // 5 + 11 + 11 = 27 chips, 1 mult => 27
    expect(resFlint.nextState.score).toBe(27);
  });

  it('обрабатывает bl_hook: сбрасывает 2 карты до оценки, триггерит onDiscard и Лиловую печать', () => {
    const deck = [
      createPlayingCard({ id: 'p1', suit: 'spades', rank: 14 }),
      createPlayingCard({ id: 'h1', suit: 'hearts', rank: 13, seal: 'purple' }),
      createPlayingCard({ id: 'h2', suit: 'clubs', rank: 13, seal: 'purple' }),
    ];
    const ramenDef: RelicDefinition = {
      id: 'j_ramen',
      rarity: 2,
      baseCost: 6,
      blueprintCompat: true,
      perishableCompat: true,
      eternalCompat: false,
      initialState: { chips: 0, mult: 0, xMult: 2 },
      hooks: {
        onDiscard: (ctx) => {
          if (ctx.isBlueprintCopy) return null;
          const nextX = Number((ctx.effectRelic.state.xMult - 0.01).toFixed(2));
          if (nextX <= 1) {
            return { destroySelf: true };
          }
          return {
            updatedEffectState: { ...ctx.effectRelic.state, xMult: nextX },
          };
        },
        onScoreRelic: (ctx) => ({ xMult: ctx.effectRelic.state.xMult }),
      },
    };

    const hookState = makeBaseState({
      deck,
      currentBlindIndex: 2,
      anteBlinds: [
        { kind: 'small', bossId: null, targetScore: 300, reward: 3, status: 'defeated', skipTagId: null },
        { kind: 'big', bossId: null, targetScore: 450, reward: 4, status: 'defeated', skipTagId: null },
        { kind: 'boss', bossId: 'bl_hook', targetScore: 600, reward: 5, status: 'current', skipTagId: null },
      ],
      relics: [makeRelic('r_ramen', 'j_ramen', { state: { chips: 0, mult: 0, xMult: 1.02 } })],
    });

    const res = evaluatePlay(hookState, ['p1'], {
      relicRegistry: makeRegistry({ j_ramen: ramenDef }),
    });

    // Две карты сброшены bl_hook -> j_ramen теряет 0.02 -> 1.00 <= 1 -> самоуничтожается до этапа 6!
    expect(res.nextState.handIds).toEqual([]);
    expect(res.nextState.relics).toEqual([]);
    expect(res.nextState.consumables).toHaveLength(2);
    expect(res.nextState.consumables.every((c) => c.kind === 'scroll')).toBe(true);
    expect(res.events.some((e) => e.type === 'BOSS_TRIGGER' && e.bossId === 'bl_hook')).toBe(true);
    expect(res.events.some((e) => e.type === 'RELIC_DESTROYED' && e.reason === 'ramen')).toBe(true);
  });
});

describe('evaluatePlay: Этапы 3-7 (vampire, повторы, Lucky/Glass, Held, Blueprint, Observatory)', () => {
  it('снимает улучшения в onBeforeScore (j_vampire) до Этапа 4 и соблюдает строгий порядок эффектов карты и изданий', () => {
    const vampireDef: RelicDefinition = {
      id: 'j_vampire',
      rarity: 2,
      baseCost: 7,
      blueprintCompat: true,
      perishableCompat: false,
      eternalCompat: true,
      initialState: { chips: 0, mult: 0, xMult: 1 },
      hooks: {
        onBeforeScore: (ctx) => {
          if (ctx.isBlueprintCopy) return null;
          const strippedCardIds = ctx.scoringCards
            .filter((card) => !card.debuffed && card.enhancement !== 'none')
            .map((card) => card.id);
          if (strippedCardIds.length === 0) return null;
          return {
            strippedCardIds,
            updatedEffectState: {
              ...ctx.effectRelic.state,
              xMult: Number((ctx.effectRelic.state.xMult + strippedCardIds.length * 0.1).toFixed(2)),
            },
          };
        },
        onScoreRelic: (ctx) => ({ xMult: ctx.effectRelic.state.xMult }),
      },
    };

    const multCard = createPlayingCard({
      id: 'c1',
      suit: 'spades',
      rank: 10,
      enhancement: 'mult',
      edition: 'holo',
      seal: 'gold',
    });
    const debuffedCard = createPlayingCard({
      id: 'c2',
      suit: 'hearts',
      rank: 10,
      enhancement: 'glass',
      debuffed: true,
    });

    const state = makeBaseState({
      deck: [multCard, debuffedCard],
      relics: [makeRelic('r_vamp', 'j_vampire', { state: { chips: 0, mult: 0, xMult: 1 } })],
    });

    const res = evaluatePlay(state, ['c1', 'c2'], {
      relicRegistry: makeRegistry({ j_vampire: vampireDef }),
    });

    // c1 теряет 'mult' в Step 3 (xMult=1.1), c2 подавлена (пропускается)
    // Pair (10 x 2) -> c1 (+10c, +3$, holo +10m => 20 x 12) -> Vampire (x1.1 => mult 13.2) -> floor(20 * 13.2) = 264
    expect(res.nextState.deck.find((c) => c.id === 'c1')?.enhancement).toBe('none');
    expect(res.nextState.deck.find((c) => c.id === 'c2')?.enhancement).toBe('glass');
    expect(res.nextState.dollars).toBe(7);
    expect(res.nextState.score).toBe(264);
    expect(res.events.some((e) => e.type === 'CARD_ENHANCEMENT_STRIPPED' && e.cardId === 'c1')).toBe(
      true,
    );
    expect(res.events.some((e) => e.type === 'CARD_DEBUFFED' && e.cardId === 'c2')).toBe(true);
  });

  it('применяет ретриггеры Step 4 (Red Seal + Sock&Buskin), firstFace (Photograph) и разделение effectRelic/stateRelic', () => {
    const face1 = createPlayingCard({
      id: 'k1',
      suit: 'spades',
      rank: 13,
      seal: 'red',
    });
    const face2 = createPlayingCard({
      id: 'k2',
      suit: 'hearts',
      rank: 13,
    });

    const sockDef: RelicDefinition = {
      id: 'j_sock_and_buskin',
      rarity: 2,
      baseCost: 6,
      blueprintCompat: true,
      perishableCompat: true,
      eternalCompat: true,
      initialState: { chips: 0, mult: 0, xMult: 1 },
      hooks: {
        onScoreCardRepetition: (ctx) =>
          ctx.card.rank >= 11 && ctx.card.rank <= 13 ? { retriggerDelta: 1 } : null,
      },
    };
    const photoDef: RelicDefinition = {
      id: 'j_photograph',
      rarity: 1,
      baseCost: 5,
      blueprintCompat: true,
      perishableCompat: true,
      eternalCompat: true,
      initialState: { chips: 0, mult: 0, xMult: 1 },
      hooks: {
        onScoreCard: (ctx) => (ctx.isFirstScoringFaceCard ? { xMult: 2 } : null),
      },
    };
    const jokerDef: RelicDefinition = {
      id: 'j_joker',
      rarity: 1,
      baseCost: 2,
      blueprintCompat: true,
      perishableCompat: true,
      eternalCompat: true,
      initialState: { chips: 0, mult: 0, xMult: 1 },
      hooks: {
        onScoreRelic: () => ({ multDelta: 4 }),
      },
    };
    const blueprintDef: RelicDefinition = {
      id: 'j_blueprint',
      rarity: 3,
      baseCost: 10,
      blueprintCompat: true,
      perishableCompat: true,
      eternalCompat: true,
      initialState: { chips: 0, mult: 0, xMult: 1 },
      hooks: {},
    };

    const state = makeBaseState({
      deck: [face1, face2],
      relics: [
        makeRelic('r_sock', 'j_sock_and_buskin'),
        makeRelic('r_photo', 'j_photograph'),
        makeRelic('r_bp', 'j_blueprint', { edition: 'polychrome' }),
        makeRelic('r_joker', 'j_joker', { edition: 'foil' }),
      ],
    });

    const res = evaluatePlay(state, ['k1', 'k2'], {
      relicRegistry: makeRegistry({
        j_sock_and_buskin: sockDef,
        j_photograph: photoDef,
        j_blueprint: blueprintDef,
        j_joker: jokerDef,
      }),
      resolveRelicTarget: (relics, idx) => {
        const slot = relics[idx]!;
        if (slot.id === 'j_blueprint') {
          const right = relics[idx + 1]!;
          return { effectRelic: right, stateRelic: slot, isBlueprintCopy: true };
        }
        return { effectRelic: slot, stateRelic: slot, isBlueprintCopy: false };
      },
    });

    // Pair (10 x 2)
    // k1 (Red Seal + Sock&Buskin => 3 триггера): каждый раз +10 chips и x2 от Photograph => +30 chips (40), mult = 2 * 2^3 = 16
    // k2 (Sock&Buskin => 2 триггера): +20 chips (60), не firstFace => mult=16
    // Step 6:
    //   r_sock (base), r_photo (base)
    //   r_bp (polychrome, копирует j_joker): сначала +4 mult (20), затем polychrome x1.5 (30)
    //   r_joker (foil): сначала foil +50 chips (110), затем +4 mult (34)
    // Итог: 110 * 34 = 3740
    expect(res.nextState.score).toBe(3740);
    const bpTrigger = res.events.find(
      (e) => e.type === 'RELIC_TRIGGER' && e.copiedByUid === 'r_bp' && e.multDelta === 4,
    );
    expect(bpTrigger).toBeDefined();
  });

  it('выполняет Step 5 (Steel + Baron + Mime в руке) ДО Step 6 и игнорирует издания в руке', () => {
    const playAce = createPlayingCard({ id: 'a1', suit: 'spades', rank: 14 });
    const heldKing = createPlayingCard({
      id: 'hk',
      suit: 'hearts',
      rank: 13,
      enhancement: 'steel',
      edition: 'holo', // издание в руке НЕ должно срабатывать!
      seal: 'red',
    });
    const heldNormal = createPlayingCard({
      id: 'hn',
      suit: 'clubs',
      rank: 7,
      seal: 'red', // нет эффекта в руке -> не должен триггериться
    });

    const baronDef: RelicDefinition = {
      id: 'j_baron',
      rarity: 3,
      baseCost: 8,
      blueprintCompat: true,
      perishableCompat: true,
      eternalCompat: true,
      initialState: { chips: 0, mult: 0, xMult: 1 },
      hooks: {
        onHoldCard: (ctx) => (!ctx.card.debuffed && ctx.card.rank === 13 ? { xMult: 1.5 } : null),
      },
    };
    const mimeDef: RelicDefinition = {
      id: 'j_mime',
      rarity: 2,
      baseCost: 5,
      blueprintCompat: true,
      perishableCompat: true,
      eternalCompat: true,
      initialState: { chips: 0, mult: 0, xMult: 1 },
      hooks: {
        onHoldCardRepetition: (ctx) => (ctx.phase === 'scoring' ? { retriggerDelta: 1 } : null),
      },
    };
    const jokerDef: RelicDefinition = {
      id: 'j_joker',
      rarity: 1,
      baseCost: 2,
      blueprintCompat: true,
      perishableCompat: true,
      eternalCompat: true,
      initialState: { chips: 0, mult: 0, xMult: 1 },
      hooks: { onScoreRelic: () => ({ multDelta: 4 }) },
    };

    const state = makeBaseState({
      deck: [playAce, heldKing, heldNormal],
      relics: [makeRelic('r_baron', 'j_baron'), makeRelic('r_mime', 'j_mime'), makeRelic('r_j', 'j_joker')],
    });

    const res = evaluatePlay(state, ['a1'], {
      relicRegistry: makeRegistry({ j_baron: baronDef, j_mime: mimeDef, j_joker: jokerDef }),
    });

    // High Card (5 x 1) + Ace(11) => 16 x 1
    // Step 5 (heldKing: Red Seal + Mime => 3 повтора; на каждом Steel x1.5 и Baron x1.5 = x2.25 => 2.25^3 = 11.390625)
    // Step 6 (j_joker +4 mult) => 11.390625 + 4 = 15.390625
    // floor(16 * 15.390625) = floor(246.25) = 246
    expect(res.nextState.score).toBe(246);
    expect(res.events.some((e) => e.type === 'HAND_CARD_TRIGGER' && e.cardId === 'hn')).toBe(false);
  });

  it('бросает вероятности Lucky (поток lucky) и ломает Glass ровно 1 раз (поток glass), а также применяет Observatory и Vagabond', () => {
    const luckyHitSeed = findSeedWithRoll('lucky', (r1, r2) => r1 < 0.2 && (r2 ?? 1) < 1 / 15);
    const glassShatterSeed = findSeedWithRoll('glass', (r1) => r1 < 0.25);

    const luckyCard = createPlayingCard({
      id: 'l1',
      suit: 'hearts',
      rank: 2,
      enhancement: 'lucky',
    });
    const stateLucky = makeBaseState({
      seed: luckyHitSeed,
      rngState: createRngState(luckyHitSeed),
      deck: [luckyCard],
    });
    const resLucky = evaluatePlay(stateLucky, ['l1'], { relicRegistry: makeRegistry({}) });
    // High Card: 5+2=7 chips, 1+20=21 mult => 147; +20$
    expect(resLucky.nextState.score).toBe(147);
    expect(resLucky.nextState.dollars).toBe(24);

    // Glass с Red Seal при попадании <0.25 ломается ровно 1 раз
    const glassCard = createPlayingCard({
      id: 'g1',
      suit: 'spades',
      rank: 10,
      enhancement: 'glass',
      seal: 'red',
    });
    const vagabondDef: RelicDefinition = {
      id: 'j_vagabond',
      rarity: 3,
      baseCost: 8,
      blueprintCompat: true,
      perishableCompat: true,
      eternalCompat: true,
      initialState: { chips: 0, mult: 0, xMult: 1 },
      hooks: {
        onScoreRelic: (ctx) => (ctx.state.dollars <= 4 ? { createConsumableKind: 'scroll' } : null),
      },
    };
    const pluto: ConsumableInstance = {
      uid: 'cons_1',
      id: 'c_pluto',
      kind: 'celestial',
      edition: 'base',
      baseCost: 3,
      sellValue: 1,
    };

    const stateGlass = makeBaseState({
      seed: glassShatterSeed,
      rngState: createRngState(glassShatterSeed),
      deck: [glassCard],
      charters: ['v_telescope', 'v_observatory'],
      consumables: [pluto],
      relics: [makeRelic('r_vag', 'j_vagabond')],
    });
    const resGlass = evaluatePlay(stateGlass, ['g1'], {
      relicRegistry: makeRegistry({ j_vagabond: vagabondDef }),
    });

    // High Card: 5 + 10*2 (Red Seal) = 25 chips; Glass x2 дважды -> mult 4; Observatory Pluto -> 4 * 1.5 = 6 => 150
    expect(resGlass.nextState.score).toBe(150);
    expect(resGlass.nextState.deck).toHaveLength(0);
    expect(resGlass.nextState.discardPileIds).toEqual([]);
    expect(resGlass.nextState.stats.cardsDestroyed).toBe(1);
    expect(resGlass.nextState.consumables).toHaveLength(2);
    expect(resGlass.nextState.consumables[1]?.kind).toBe('scroll');
    expect(resGlass.events.filter((e) => e.type === 'CARD_SHATTER')).toHaveLength(1);
  });

  it('соблюдает иммутабельность state и проверяет лимит расходников (с учётом negative)', () => {
    const negPluto: ConsumableInstance = {
      uid: 'c_neg',
      id: 'c_pluto',
      kind: 'celestial',
      edition: 'negative',
      baseCost: 3,
      sellValue: 1,
    };
    const stdMercury: ConsumableInstance = {
      uid: 'c_std1',
      id: 'c_mercury',
      kind: 'celestial',
      edition: 'base',
      baseCost: 3,
      sellValue: 1,
    };
    const stdVenus: ConsumableInstance = {
      uid: 'c_std2',
      id: 'c_venus',
      kind: 'celestial',
      edition: 'base',
      baseCost: 3,
      sellValue: 1,
    };
    const vagabondDef: RelicDefinition = {
      id: 'j_vagabond',
      rarity: 3,
      baseCost: 8,
      blueprintCompat: true,
      perishableCompat: true,
      eternalCompat: true,
      initialState: { chips: 0, mult: 0, xMult: 1 },
      hooks: {
        onScoreRelic: (ctx) => (ctx.state.dollars <= 4 ? { createConsumableKind: 'scroll' } : null),
      },
    };

    const state = makeBaseState({
      maxConsumables: 2,
      consumables: [negPluto, stdMercury, stdVenus], // 2 обычных + 1 Теневой = 3/3 занято
      relics: [makeRelic('r_vag', 'j_vagabond')],
    });
    const beforeSnapshot = structuredClone(state);

    const resFull = evaluatePlay(state, ['c1'], {
      relicRegistry: makeRegistry({ j_vagabond: vagabondDef }),
    });
    expect(state).toEqual(beforeSnapshot);
    expect(resFull.nextState.consumables).toHaveLength(3);

    // Освобождаем 1 слот: остаётся 1 обычный + 1 Теневой (лимит 3) -> Vagabond создаёт Свиток
    const stateRoom = makeBaseState({
      maxConsumables: 2,
      consumables: [negPluto, stdMercury],
      relics: [makeRelic('r_vag', 'j_vagabond')],
    });
    const resCreated = evaluatePlay(stateRoom, ['c1'], {
      relicRegistry: makeRegistry({ j_vagabond: vagabondDef }),
    });
    expect(resCreated.nextState.consumables).toHaveLength(3);
    expect(resCreated.nextState.consumables[2]?.kind).toBe('scroll');
  });
});

describe('evaluateRoundEnd: награды руки в конце раунда и CashoutBreakdown', () => {
  it('считает Золотые карты, Лазурную печать с ретриггером Mime, Золотую чашу, Знак Вклада и проценты до выплаты', () => {
    const goldCard = createPlayingCard({
      id: 'hg',
      suit: 'diamonds',
      rank: 6,
      enhancement: 'gold',
      seal: 'blue',
    });
    const goldenDef: RelicDefinition = {
      id: 'j_golden',
      rarity: 1,
      baseCost: 6,
      blueprintCompat: false,
      perishableCompat: true,
      eternalCompat: true,
      initialState: { chips: 0, mult: 0, xMult: 1 },
      hooks: {
        onRoundEnd: (ctx) => (!ctx.isBlueprintCopy ? { dollarsDelta: 4 } : null),
      },
    };
    const mimeDef: RelicDefinition = {
      id: 'j_mime',
      rarity: 2,
      baseCost: 5,
      blueprintCompat: true,
      perishableCompat: true,
      eternalCompat: true,
      initialState: { chips: 0, mult: 0, xMult: 1 },
      hooks: {
        onHoldCardRepetition: (ctx) => (ctx.phase === 'roundEnd' ? { retriggerDelta: 1 } : null),
      },
    };

    const state = makeBaseState({
      currentBlindIndex: 2,
      anteBlinds: [
        { kind: 'small', bossId: null, targetScore: 300, reward: 3, status: 'defeated', skipTagId: null },
        { kind: 'big', bossId: null, targetScore: 450, reward: 4, status: 'defeated', skipTagId: null },
        { kind: 'boss', bossId: 'bl_manacle', targetScore: 600, reward: 5, status: 'current', skipTagId: null },
      ],
      handSize: 7, // уменьшен bl_manacle при входе
      tempHandSizeBonus: 3,
      score: 700,
      targetScore: 600,
      dollars: 17, // после Gold Card x2 (+6$) станет 23$ => 4$ процентов!
      handsLeft: 2,
      deck: [goldCard],
      handIds: ['hg'],
      lastPlayedHandType: 'Flush',
      relics: [makeRelic('r_gold', 'j_golden'), makeRelic('r_mime', 'j_mime')],
      pendingTags: ['tag_investment', 'tag_coupon'],
      maxConsumables: 2,
    });

    const res = evaluateRoundEnd(state, {
      relicRegistry: makeRegistry({ j_golden: goldenDef, j_mime: mimeDef }),
    });

    // Gold + Blue Seal сработали дважды (из-за Mime), слоты расходников = 2 -> создано 2 Сферы c_jupiter
    expect(res.nextState.dollars).toBe(23);
    expect(res.nextState.consumables.map((c) => c.id)).toEqual(['c_jupiter', 'c_jupiter']);
    expect(res.nextState.pendingTags).toEqual(['tag_coupon']);
    // bl_manacle восстановил +1 handSize (7 -> 8), tempHandSizeBonus сброшен
    expect(res.nextState.handSize).toBe(8);
    expect(res.nextState.tempHandSizeBonus).toBe(0);

    expect(res.nextState.cashout).toEqual({
      blindReward: 5,
      unusedHandsBonus: 2,
      interestBonus: 4,
      relicBonus: 4,
      tagBonus: 25,
      totalReward: 40,
    });
  });
});
