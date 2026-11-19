import { describe, expect, it } from 'vitest';
import { createPlayingCard } from '../../src/engine/cards';
import { createConsumableInstance } from '../../src/engine/consumables';
import {
  BOSS_DEFINITIONS,
  CHARTER_DEFINITIONS,
  DECK_DEFINITIONS,
  TAG_DEFINITIONS,
  applyBossDebuffsToDeck,
  applyBossOnBlindSelect,
  applyDeckStartingParams,
  applyFinalBellSelection,
  buildAnteBlinds,
  disableActiveBoss,
  getEligibleCharters,
  grantSkipTag,
  isCardDebuffedByBoss,
  redeemCharter,
  restoreBossEffectsOnRoundEnd,
  rollSkipTag,
  selectBossForAnte,
} from '../../src/engine/catalog';
import { createInitialHandLevels } from '../../src/engine/handEval';
import { createRngState } from '../../src/engine/prng';
import { createRelicInstance } from '../../src/engine/relics';
import {
  BOSS_IDS,
  CHARTER_IDS,
  DECK_IDS,
  TAG_IDS,
  type BlindSlotState,
  type BossId,
  type ConsumableInstance,
  type RunState,
  type ShopState,
} from '../../src/engine/types';

/**
 * Создаёт минимальное детерминированное состояние забега для тестирования каталога.
 */
function createTestRunState(overrides: Partial<RunState> = {}): RunState {
  const defaultBlinds: readonly [BlindSlotState, BlindSlotState, BlindSlotState] = [
    { kind: 'small', bossId: null, targetScore: 300, reward: 3, status: 'current', skipTagId: 'tag_skip' },
    { kind: 'big', bossId: null, targetScore: 450, reward: 4, status: 'upcoming', skipTagId: 'tag_coupon' },
    { kind: 'boss', bossId: 'bl_hook', targetScore: 600, reward: 5, status: 'upcoming', skipTagId: null },
  ];

  return {
    version: 1,
    seed: 'CATALOG-TEST',
    rngState: createRngState('CATALOG-TEST'),
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
      bestHandType: null,
      handsPlayed: 0,
      cardsPlayed: 0,
      discardsUsed: 0,
      cardsDiscarded: 0,
      cardsPurchased: 0,
      rerollsCount: 0,
      cardsDestroyed: 0,
      dollarsSpent: 0,
    },
    ...overrides,
  };
}

describe('Каталог 4 стартовых колод (DECK_DEFINITIONS и applyDeckStartingParams)', () => {
  it('содержит все 4 колоды и возвращает точные стартовые параметры для каждой', () => {
    expect(Object.keys(DECK_DEFINITIONS).sort()).toEqual([...DECK_IDS].sort());

    const red = applyDeckStartingParams('b_red');
    expect(red).toMatchObject({
      deckId: 'b_red',
      dollars: 4,
      handSize: 8,
      maxHands: 4,
      handsLeft: 4,
      maxDiscards: 4,
      discardsLeft: 4,
      maxRelics: 5,
      maxConsumables: 2,
      baseRerollCost: 5,
      interestCap: 25,
      shopSlots: 2,
      discountPercent: 0,
      editionRate: 1,
    });

    const blue = applyDeckStartingParams('b_blue');
    expect(blue.maxHands).toBe(5);
    expect(blue.handsLeft).toBe(5);
    expect(blue.maxDiscards).toBe(3);

    const yellow = applyDeckStartingParams('b_yellow');
    expect(yellow.dollars).toBe(14);
    expect(yellow.maxHands).toBe(4);
    expect(yellow.maxDiscards).toBe(3);

    const black = applyDeckStartingParams('b_black');
    expect(black.maxRelics).toBe(6);
    expect(black.maxHands).toBe(3);
    expect(black.handsLeft).toBe(3);
  });
});

describe('Каталог 10 Боссов, выбор пула и эффекты Стражей', () => {
  it('описывает все 10 Боссов с точными minAnte, showdown, targetMultiplier и reward', () => {
    expect(Object.keys(BOSS_DEFINITIONS).sort()).toEqual([...BOSS_IDS].sort());

    expect(BOSS_DEFINITIONS.bl_hook).toMatchObject({ minAnte: 1, showdown: false, targetMultiplier: 2, reward: 5 });
    expect(BOSS_DEFINITIONS.bl_manacle).toMatchObject({ minAnte: 1, showdown: false, targetMultiplier: 2, reward: 5 });
    expect(BOSS_DEFINITIONS.bl_psychic).toMatchObject({ minAnte: 1, showdown: false, targetMultiplier: 2, reward: 5 });
    expect(BOSS_DEFINITIONS.bl_pillar).toMatchObject({ minAnte: 1, showdown: false, targetMultiplier: 2, reward: 5 });
    expect(BOSS_DEFINITIONS.bl_club).toMatchObject({ minAnte: 1, showdown: false, targetMultiplier: 2, reward: 5 });
    expect(BOSS_DEFINITIONS.bl_water).toMatchObject({ minAnte: 2, showdown: false, targetMultiplier: 2, reward: 5 });
    expect(BOSS_DEFINITIONS.bl_wall).toMatchObject({ minAnte: 2, showdown: false, targetMultiplier: 4, reward: 5 });
    expect(BOSS_DEFINITIONS.bl_flint).toMatchObject({ minAnte: 2, showdown: false, targetMultiplier: 2, reward: 5 });
    expect(BOSS_DEFINITIONS.bl_final_vessel).toMatchObject({ minAnte: 8, showdown: true, targetMultiplier: 6, reward: 8 });
    expect(BOSS_DEFINITIONS.bl_final_bell).toMatchObject({ minAnte: 8, showdown: true, targetMultiplier: 2, reward: 8 });
  });

  it('выбирает Боссов без повторов из допустимого пула и переходит на Showdown на Этапах кратных 8', () => {
    let rng = createRngState('BOSS-POOL');
    let counts: Partial<Record<BossId, number>> = {};

    // На Этапе 1 доступны только 5 Боссов с minAnte=1; 5 последовательных выборов покрывают все 5 без повтора
    const ante1Picked: BossId[] = [];
    for (let i = 0; i < 5; i += 1) {
      const sel = selectBossForAnte(1, counts, rng);
      rng = sel.nextRngState;
      counts = sel.nextBossUseCounts;
      ante1Picked.push(sel.bossId);
      expect(BOSS_DEFINITIONS[sel.bossId].minAnte).toBe(1);
      expect(BOSS_DEFINITIONS[sel.bossId].showdown).toBe(false);
    }
    expect(new Set(ante1Picked).size).toBe(5);

    // На Этапе 2 в пул добавляются bl_water, bl_wall, bl_flint (count = 0), поэтому они выбираются раньше повторных (count = 1)
    const ante2Picked: BossId[] = [];
    for (let i = 0; i < 3; i += 1) {
      const sel = selectBossForAnte(2, counts, rng);
      rng = sel.nextRngState;
      counts = sel.nextBossUseCounts;
      ante2Picked.push(sel.bossId);
    }
    expect(new Set(ante2Picked)).toEqual(new Set(['bl_water', 'bl_wall', 'bl_flint']));

    // На Этапах 8 и 16 выбираются только Showdown-боссы без повтора
    const ante8 = selectBossForAnte(8, counts, rng);
    expect(BOSS_DEFINITIONS[ante8.bossId].showdown).toBe(true);
    const ante16 = selectBossForAnte(16, ante8.nextBossUseCounts, ante8.nextRngState);
    expect(BOSS_DEFINITIONS[ante16.bossId].showdown).toBe(true);
    expect(ante16.bossId).not.toBe(ante8.bossId);
  });

  it('формирует 3 Стража Этапа через buildAnteBlinds с точными порогами, наградами и Знаками пропуска', () => {
    const rng = createRngState('ANTE-BLINDS');
    const res = buildAnteBlinds(2, 'bl_wall', rng, 1);

    expect(res.anteBlinds).toHaveLength(3);
    expect(res.anteBlinds[0]).toMatchObject({
      kind: 'small',
      bossId: null,
      targetScore: 800,
      reward: 3,
      status: 'current',
    });
    expect(TAG_IDS).toContain(res.anteBlinds[0].skipTagId);

    expect(res.anteBlinds[1]).toMatchObject({
      kind: 'big',
      bossId: null,
      targetScore: 1200,
      reward: 4,
      status: 'upcoming',
    });
    expect(TAG_IDS).toContain(res.anteBlinds[1].skipTagId);

    expect(res.anteBlinds[2]).toEqual({
      kind: 'boss',
      bossId: 'bl_wall',
      targetScore: 3200,
      reward: 5,
      status: 'upcoming',
      skipTagId: null,
    });

    // Showdown Фиолетовый Монолит на 8 Этапе: 50000 * 6 = 300000, награда 8 з.
    const showdown = buildAnteBlinds(8, 'bl_final_vessel', res.nextRngState, 1);
    expect(showdown.anteBlinds[2]).toEqual({
      kind: 'boss',
      bossId: 'bl_final_vessel',
      targetScore: 300000,
      reward: 8,
      status: 'upcoming',
      skipTagId: null,
    });
  });

  it('корректно применяет подавление карт для bl_pillar и bl_club (включая Wild и Stone)', () => {
    const club = createPlayingCard({ id: 'c1', suit: 'clubs', rank: 10 });
    const spade = createPlayingCard({ id: 's1', suit: 'spades', rank: 10, playedThisAnte: true });
    const wildHeart = createPlayingCard({ id: 'w1', suit: 'hearts', rank: 9, enhancement: 'wild' });
    const stoneClub = createPlayingCard({ id: 'st1', suit: 'clubs', rank: 8, enhancement: 'stone' });

    expect(isCardDebuffedByBoss(club, 'bl_club')).toBe(true);
    expect(isCardDebuffedByBoss(wildHeart, 'bl_club')).toBe(true);
    expect(isCardDebuffedByBoss(stoneClub, 'bl_club')).toBe(false);
    expect(isCardDebuffedByBoss(spade, 'bl_club')).toBe(false);
    expect(isCardDebuffedByBoss(club, 'bl_club', true)).toBe(false);

    expect(isCardDebuffedByBoss(spade, 'bl_pillar')).toBe(true);
    expect(isCardDebuffedByBoss(club, 'bl_pillar')).toBe(false);

    const updated = applyBossDebuffsToDeck([club, spade, wildHeart, stoneClub], 'bl_club', false);
    expect(updated.map((c) => c.debuffed)).toEqual([true, false, true, false]);
  });

  it('применяет, отключает и восстанавливает эффекты bl_manacle, bl_water, bl_wall, bl_final_vessel и bl_pillar', () => {
    // bl_manacle: -1 handSize при выборе и +1 при победе или отключении (с добором 1 карты при отключении)
    const deckCards = [1, 2, 3].map((r, i) =>
      createPlayingCard({ id: `c_${i}`, suit: 'spades', rank: (r + 1) as 2 | 3 | 4, playedThisAnte: true }),
    );
    const manacleState = createTestRunState({
      currentBlindIndex: 2,
      anteBlinds: [
        { kind: 'small', bossId: null, targetScore: 300, reward: 3, status: 'defeated', skipTagId: null },
        { kind: 'big', bossId: null, targetScore: 450, reward: 4, status: 'defeated', skipTagId: null },
        { kind: 'boss', bossId: 'bl_manacle', targetScore: 600, reward: 5, status: 'current', skipTagId: null },
      ],
      targetScore: 600,
      handSize: 8,
      deck: deckCards,
      handIds: ['c_0'],
      drawPileIds: ['c_1', 'c_2'],
    });

    const selectedManacle = applyBossOnBlindSelect(manacleState);
    expect(selectedManacle.nextState.handSize).toBe(7);
    expect(selectedManacle.events[0]).toMatchObject({ type: 'BOSS_TRIGGER', bossId: 'bl_manacle', locKey: 'boss_manacle' });

    // Отключение bl_manacle возвращает handSize = 8 и добирает 1 карту
    const disabledManacle = disableActiveBoss(selectedManacle.nextState);
    expect(disabledManacle.nextState.activeBossDisabled).toBe(true);
    expect(disabledManacle.nextState.handSize).toBe(8);
    expect(disabledManacle.nextState.handIds).toEqual(['c_0', 'c_1']);
    expect(disabledManacle.nextState.drawPileIds).toEqual(['c_2']);
    expect(disabledManacle.events[0]).toMatchObject({ type: 'BOSS_TRIGGER', bossId: 'bl_manacle', locKey: 'boss_disabled' });

    // Повторное отключение не даёт лишний +1 handSize, а restoreBossEffectsOnRoundEnd при победе над Боссом сбрасывает playedThisAnte
    const afterWin = restoreBossEffectsOnRoundEnd(disabledManacle.nextState, true);
    expect(afterWin.handSize).toBe(8);
    expect(afterWin.deck.every((c) => !c.playedThisAnte)).toBe(true);

    // Если не был отключён, restoreBossEffectsOnRoundEnd при победе восстанавливает handSize
    const restoredOnWin = restoreBossEffectsOnRoundEnd(selectedManacle.nextState, true);
    expect(restoredOnWin.handSize).toBe(8);

    // bl_water: сохраняет сбросы и ставит 0; при отключении или конце раунда восстанавливает
    const waterState = createTestRunState({
      currentBlindIndex: 2,
      anteBlinds: [
        manacleState.anteBlinds[0],
        manacleState.anteBlinds[1],
        { kind: 'boss', bossId: 'bl_water', targetScore: 1600, reward: 5, status: 'current', skipTagId: null },
      ],
      discardsLeft: 4,
    });
    const selectedWater = applyBossOnBlindSelect(waterState);
    expect(selectedWater.nextState.discardsLeft).toBe(0);
    expect(selectedWater.nextState.savedBossDiscards).toBe(4);
    expect(selectedWater.events[0]).toMatchObject({ type: 'BOSS_TRIGGER', bossId: 'bl_water', locKey: 'boss_water' });

    const disabledWater = disableActiveBoss(selectedWater.nextState);
    expect(disabledWater.nextState.discardsLeft).toBe(4);
    expect(disabledWater.nextState.savedBossDiscards).toBeNull();

    // bl_wall (/2) и bl_final_vessel (/3)
    const wallState = createTestRunState({
      currentBlindIndex: 2,
      anteBlinds: [
        manacleState.anteBlinds[0],
        manacleState.anteBlinds[1],
        { kind: 'boss', bossId: 'bl_wall', targetScore: 3200, reward: 5, status: 'current', skipTagId: null },
      ],
      targetScore: 3200,
    });
    expect(disableActiveBoss(wallState).nextState.targetScore).toBe(1600);

    const vesselState = createTestRunState({
      currentBlindIndex: 2,
      anteBlinds: [
        manacleState.anteBlinds[0],
        manacleState.anteBlinds[1],
        { kind: 'boss', bossId: 'bl_final_vessel', targetScore: 300000, reward: 8, status: 'current', skipTagId: null },
      ],
      targetScore: 300000,
    });
    expect(disableActiveBoss(vesselState).nextState.targetScore).toBe(100000);
  });

  it('применяет принудительное выделение bl_final_bell через shuffle и не повторяет его пока карта в руке', () => {
    const cards = [
      createPlayingCard({ id: 'h1', suit: 'spades', rank: 14 }),
      createPlayingCard({ id: 'h2', suit: 'hearts', rank: 13 }),
      createPlayingCard({ id: 'h3', suit: 'clubs', rank: 12 }),
    ];
    const bellState = createTestRunState({
      currentBlindIndex: 2,
      anteBlinds: [
        { kind: 'small', bossId: null, targetScore: 50000, reward: 3, status: 'defeated', skipTagId: null },
        { kind: 'big', bossId: null, targetScore: 75000, reward: 4, status: 'defeated', skipTagId: null },
        { kind: 'boss', bossId: 'bl_final_bell', targetScore: 100000, reward: 8, status: 'current', skipTagId: null },
      ],
      deck: cards,
      handIds: ['h1', 'h2', 'h3'],
    });

    const first = applyFinalBellSelection(bellState);
    const forced = first.nextState.deck.filter((c) => c.forcedSelection);
    expect(forced).toHaveLength(1);
    expect(first.events).toHaveLength(1);
    expect(first.events[0]).toMatchObject({
      type: 'BOSS_TRIGGER',
      bossId: 'bl_final_bell',
      affectedCardIds: [forced[0]!.id],
      locKey: 'boss_final_bell',
    });

    // Повторный вызов пока выделенная карта ещё в руке ничего не меняет и не двигает PRNG
    const second = applyFinalBellSelection(first.nextState);
    expect(second.nextState.rngState).toEqual(first.nextState.rngState);
    expect(second.events).toHaveLength(0);
    expect(second.nextState.deck.filter((c) => c.forcedSelection)).toHaveLength(1);
  });
});

describe('Каталог 12 Гильдейских грамот (CHARTER_DEFINITIONS, getEligibleCharters, redeemCharter)', () => {
  it('содержит все 12 Грамот и корректно учитывает пререквизит v_observatory -> v_telescope', () => {
    expect(Object.keys(CHARTER_DEFINITIONS).sort()).toEqual([...CHARTER_IDS].sort());
    for (const id of CHARTER_IDS) {
      expect(CHARTER_DEFINITIONS[id].baseCost).toBe(10);
    }

    const basePool = getEligibleCharters([]);
    expect(basePool).toHaveLength(11);
    expect(basePool).not.toContain('v_observatory');

    const withTelescope = getEligibleCharters(['v_telescope']);
    expect(withTelescope).toContain('v_observatory');
    expect(withTelescope).not.toContain('v_telescope');
  });

  it('корректно применяет эффекты всех 12 Грамот, включая пересчёт цен магазина (v_clearance_sale) и реролла (v_reroll_surplus)', () => {
    const relicNormal = createRelicInstance('j_joker', 'r1'); // baseCost 2
    const relicPoly = createRelicInstance('j_blueprint', 'r2', 'polychrome'); // baseCost 10 + 5 = 15
    const relicCoupon = createRelicInstance('j_sly', 'r3');
    const cons: ConsumableInstance = {
      uid: 'con1',
      id: 'c_mercury',
      kind: 'celestial',
      edition: 'base',
      baseCost: 3,
      sellValue: 1,
    };
    const card = createPlayingCard({ id: 'card_1', suit: 'hearts', rank: 14 });

    const shop: ShopState = {
      offers: [
        { uid: 'o1', kind: 'relic', relic: relicNormal, cost: 2, baseCost: 2, sold: false },
        { uid: 'o2', kind: 'relic', relic: relicPoly, cost: 15, baseCost: 15, sold: false },
        { uid: 'o3', kind: 'relic', relic: relicCoupon, cost: 0, baseCost: 3, sold: false },
        { uid: 'o4', kind: 'consumable', consumable: cons, cost: 3, baseCost: 3, sold: false },
        { uid: 'o5', kind: 'card', card, cost: 1, baseCost: 1, sold: false },
      ],
      voucher: { uid: 'v1', charterId: 'v_clearance_sale', cost: 10, baseCost: 10, sold: true },
      packs: [
        {
          uid: 'p1',
          packId: 'p_arcana_normal',
          type: 'arcana',
          size: 'normal',
          cost: 4,
          baseCost: 4,
          totalCards: 3,
          chooseCount: 1,
          purchased: false,
        },
        {
          uid: 'p2',
          packId: 'p_buffoon_mega',
          type: 'buffoon',
          size: 'mega',
          cost: 0,
          baseCost: 8,
          totalCards: 4,
          chooseCount: 2,
          purchased: false,
        },
      ],
      rerollCost: 5,
      tempRerollCost: null,
      rerollsUsedThisShop: 0,
    };

    let state = createTestRunState({ shop });

    state = redeemCharter(state, 'v_overstock_norm');
    expect(state.shopSlots).toBe(3);

    state = redeemCharter(state, 'v_clearance_sale');
    expect(state.discountPercent).toBe(25);
    expect(state.shop?.offers[0]?.cost).toBe(1); // floor(2.5 * 0.75) = 1
    expect(state.shop?.offers[1]?.cost).toBe(11); // floor(15.5 * 0.75) = 11
    expect(state.shop?.offers[2]?.cost).toBe(0); // купон остаётся 0
    expect(state.shop?.offers[3]?.cost).toBe(2); // floor(3.5 * 0.75) = 2
    expect(state.shop?.offers[4]?.cost).toBe(1); // max(1, floor(1.5 * 0.75)) = 1
    expect(state.shop?.packs[0]?.cost).toBe(3); // floor(4.5 * 0.75) = 3
    expect(state.shop?.packs[1]?.cost).toBe(0); // купон остаётся 0

    state = redeemCharter(state, 'v_hone');
    expect(state.editionRate).toBe(2);

    state = redeemCharter(state, 'v_reroll_surplus');
    expect(state.baseRerollCost).toBe(3);
    expect(state.shop?.rerollCost).toBe(3);

    state = redeemCharter(state, 'v_crystal_ball');
    expect(state.maxConsumables).toBe(3);

    state = redeemCharter(state, 'v_grabber');
    expect(state.maxHands).toBe(5);
    expect(state.handsLeft).toBe(5);

    state = redeemCharter(state, 'v_wasteful');
    expect(state.maxDiscards).toBe(4);
    expect(state.discardsLeft).toBe(4);

    state = redeemCharter(state, 'v_seed_money');
    expect(state.interestCap).toBe(50);

    state = redeemCharter(state, 'v_paint_brush');
    expect(state.handSize).toBe(9);

    state = redeemCharter(state, 'v_telescope');
    state = redeemCharter(state, 'v_observatory');
    state = redeemCharter(state, 'v_directors_cut');
    expect(state.charters).toEqual(CHARTER_IDS);
  });
});

describe('Каталог 10 Знаков пропуска (TAG_DEFINITIONS, rollSkipTag, grantSkipTag)', () => {
  it('содержит все 10 Знаков без ограничения по Этапу и детерминированно выбирает Знак по стриму tag', () => {
    expect(Object.keys(TAG_DEFINITIONS).sort()).toEqual([...TAG_IDS].sort());
    for (const id of TAG_IDS) {
      expect(TAG_DEFINITIONS[id].minAnte).toBe(1);
    }

    const rng = createRngState('TAG-SEED');
    const rolled = rollSkipTag(rng);
    expect(TAG_IDS).toContain(rolled.tagId);
    expect(rolled.nextRngState.streams.tag).not.toBe(rng.streams.tag);
    expect(rolled.nextRngState.streams.shop).toBe(rng.streams.shop);
  });

  it('корректно применяет немедленные и отложенные Знаки и дублирование через tag_double', () => {
    // tag_skip: +$5 * skipsCount
    const skipState = createTestRunState({ dollars: 4, skipsCount: 2 });
    const skipRes = grantSkipTag(skipState, 'tag_skip');
    expect(skipRes.nextState.dollars).toBe(14);
    expect(skipRes.events).toEqual([
      { type: 'TAG_TRIGGER', tagId: 'tag_skip', locKey: 'tag_activated', locParams: { tagName: 'tag_skip' } },
      { type: 'DOLLAR_DELTA', delta: 10, totalDollars: 14, source: 'tag' },
    ]);

    // tag_economy: +min(40, max(0, dollars))
    expect(grantSkipTag(createTestRunState({ dollars: 12 }), 'tag_economy').nextState.dollars).toBe(24);
    expect(grantSkipTag(createTestRunState({ dollars: 60 }), 'tag_economy').nextState.dollars).toBe(100);
    expect(grantSkipTag(createTestRunState({ dollars: -5 }), 'tag_economy').nextState.dollars).toBe(-5);

    // Отложенные знаки добавляются в pendingTags (включая tag_juggle — round_start_bonus до старта следующего раунда)
    for (const deferred of [
      'tag_investment',
      'tag_uncommon',
      'tag_rare',
      'tag_coupon',
      'tag_d_six',
      'tag_juggle',
    ] as const) {
      const res = grantSkipTag(createTestRunState(), deferred);
      expect(res.nextState.pendingTags).toEqual([deferred]);
    }
    expect(grantSkipTag(createTestRunState(), 'tag_juggle').nextState.tempHandSizeBonus).toBe(0);

    // tag_double снимается из pendingTags и применяет следующий знак дважды (с copiedFromDouble: true у копии)
    const doubleBase = grantSkipTag(createTestRunState({ dollars: 10 }), 'tag_double');
    expect(doubleBase.nextState.pendingTags).toEqual(['tag_double']);

    // Двойной tag_double не дублирует сам себя
    const secondDouble = grantSkipTag(doubleBase.nextState, 'tag_double');
    expect(secondDouble.nextState.pendingTags).toEqual(['tag_double', 'tag_double']);

    // 1 tag_double + tag_economy: $10 -> $20 -> $40!
    const doubledEconomy = grantSkipTag(doubleBase.nextState, 'tag_economy');
    expect(doubledEconomy.nextState.pendingTags).toEqual([]);
    expect(doubledEconomy.nextState.dollars).toBe(40);
    expect(doubledEconomy.events.filter((e) => e.type === 'TAG_TRIGGER')).toEqual([
      { type: 'TAG_TRIGGER', tagId: 'tag_economy', locKey: 'tag_activated', locParams: { tagName: 'tag_economy' } },
      {
        type: 'TAG_TRIGGER',
        tagId: 'tag_economy',
        copiedFromDouble: true,
        locKey: 'tag_copied',
        locParams: { tagName: 'tag_economy' },
      },
    ]);

    // 1 tag_double + tag_charm -> 2 бесплатных Мега-набора Свитков
    const doubledCharm = grantSkipTag(doubleBase.nextState, 'tag_charm');
    expect(doubledCharm.openFreeArcanaMegaPackCount).toBe(2);
    expect(doubledCharm.nextState.pendingTags).toEqual([]);

    // 1 tag_double + отложенный tag_investment -> 2 знака в pendingTags
    const doubledInv = grantSkipTag(doubleBase.nextState, 'tag_investment');
    expect(doubledInv.nextState.pendingTags).toEqual(['tag_investment', 'tag_investment']);

    // Сохранение других отложенных знаков при срабатывании tag_double и 2x tag_double
    const mixedQueue = createTestRunState({
      dollars: 10,
      pendingTags: ['tag_uncommon', 'tag_double', 'tag_double'],
    });
    const tripleEconomy = grantSkipTag(mixedQueue, 'tag_economy');
    expect(tripleEconomy.nextState.pendingTags).toEqual(['tag_uncommon']);
    // 10 -> 20 -> 40 -> 80
    expect(tripleEconomy.nextState.dollars).toBe(80);
  });

  it('покрывает идемпотентность грамот, клампинг реролла >= 0, дебафф колоды в applyBossOnBlindSelect и пустую руку bl_final_bell', () => {
    // Повторное применение грамоты не дублирует бонусы, а v_reroll_surplus зажимает стоимость в 0
    const baseState = createTestRunState({
      baseRerollCost: 1,
      shop: {
        offers: [
          {
            uid: 'sold_offer',
            kind: 'relic',
            relic: createRelicInstance('j_joker', 'rj'),
            cost: 2,
            baseCost: 2,
            sold: true,
          },
        ],
        voucher: null,
        packs: [],
        rerollCost: 1,
        tempRerollCost: 1,
        rerollsUsedThisShop: 0,
      },
    });
    const clamped = redeemCharter(baseState, 'v_reroll_surplus');
    expect(clamped.baseRerollCost).toBe(0);
    expect(clamped.shop?.rerollCost).toBe(0);
    expect(clamped.shop?.tempRerollCost).toBe(0);

    const once = redeemCharter(clamped, 'v_grabber');
    const twice = redeemCharter(once, 'v_grabber');
    expect(twice.maxHands).toBe(5);
    expect(twice.charters).toEqual(['v_reroll_surplus', 'v_grabber']);

    // Проданный лот при v_clearance_sale не меняет цену
    const discounted = redeemCharter(twice, 'v_clearance_sale');
    expect(discounted.shop?.offers[0]?.cost).toBe(2);

    // applyBossOnBlindSelect для bl_pillar помечает сыгранные в Этапе карты как debuffed
    const pillarState = createTestRunState({
      currentBlindIndex: 2,
      anteBlinds: [
        { kind: 'small', bossId: null, targetScore: 300, reward: 3, status: 'defeated', skipTagId: null },
        { kind: 'big', bossId: null, targetScore: 450, reward: 4, status: 'defeated', skipTagId: null },
        { kind: 'boss', bossId: 'bl_pillar', targetScore: 600, reward: 5, status: 'current', skipTagId: null },
      ],
      deck: [
        createPlayingCard({ id: 'p1', suit: 'spades', rank: 14, playedThisAnte: true }),
        createPlayingCard({ id: 'p2', suit: 'hearts', rank: 13, playedThisAnte: false }),
      ],
    });
    const selectedPillar = applyBossOnBlindSelect(pillarState);
    expect(selectedPillar.nextState.deck.map((c) => c.debuffed)).toEqual([true, false]);
    expect(selectedPillar.nextState.targetScore).toBe(600);

    // Отключение bl_pillar снимает дебафф, а повторное отключение ничего не меняет
    const disabledPillar = disableActiveBoss(selectedPillar.nextState);
    expect(disabledPillar.nextState.deck.map((c) => c.debuffed)).toEqual([false, false]);
    expect(disableActiveBoss(disabledPillar.nextState).events).toEqual([]);

    // bl_final_bell на пустой руке безопасен
    const emptyBell = createTestRunState({
      currentBlindIndex: 2,
      anteBlinds: [
        pillarState.anteBlinds[0],
        pillarState.anteBlinds[1],
        { kind: 'boss', bossId: 'bl_final_bell', targetScore: 100000, reward: 8, status: 'current', skipTagId: null },
      ],
      handIds: [],
    });
    expect(applyFinalBellSelection(emptyBell).events).toEqual([]);
  });

  it('A4, A10, A13: v_clearance_sale пересчитывает sellValue инвентаря, bl_manacle опускает handSize до 0, disableActiveBoss завершает стену при достаточном счёте', () => {
    // A4: уценка уже купленных Реликвий (сохраняя extraValue) и Расходников при v_clearance_sale
    const ownedRelic = {
      ...createRelicInstance('j_joker', 'rel_owned'),
      baseCost: 10,
      sellValue: 8, // 5 + 3 extraValue
      extraValue: 3,
    };
    const ownedRune = {
      ...createConsumableInstance('c_deja_vu', 'cons_rune'),
      baseCost: 4,
      sellValue: 2,
    };
    const clearanceState = createTestRunState({
      relics: [ownedRelic],
      consumables: [ownedRune],
    });
    const afterClearance = redeemCharter(clearanceState, 'v_clearance_sale');
    expect(afterClearance.discountPercent).toBe(25);
    // buyCost = floor(10 * 0.75) = 7 -> sellValue = floor(7 / 2) + 3 = 6
    expect(afterClearance.relics[0]?.sellValue).toBe(6);
    expect(afterClearance.relics[0]?.extraValue).toBe(3);
    // buyCost руны = floor(4 * 0.75) = 3 -> sellValue = max(1, floor(3 / 2)) = 1
    expect(afterClearance.consumables[0]?.sellValue).toBe(1);

    // A10: bl_manacle снижает handSize до 0 без зажима в 1 и возвращает обратно при победе
    const manacleOneCard = createTestRunState({
      handSize: 1,
      currentBlindIndex: 2,
      anteBlinds: [
        { kind: 'small', bossId: null, targetScore: 300, reward: 3, status: 'defeated', skipTagId: null },
        { kind: 'big', bossId: null, targetScore: 450, reward: 4, status: 'defeated', skipTagId: null },
        { kind: 'boss', bossId: 'bl_manacle', targetScore: 600, reward: 5, status: 'current', skipTagId: null },
      ],
    });
    const afterManacle = applyBossOnBlindSelect(manacleOneCard).nextState;
    expect(afterManacle.handSize).toBe(0);
    expect(restoreBossEffectsOnRoundEnd(afterManacle, true).handSize).toBe(1);

    // A13: disableActiveBoss на bl_wall / bl_final_vessel в бою при score >= targetScore/div эмитит BLIND_DEFEATED
    const wallState = createTestRunState({
      phase: 'playing',
      currentBlindIndex: 2,
      anteBlinds: [
        { kind: 'small', bossId: null, targetScore: 300, reward: 3, status: 'defeated', skipTagId: null },
        { kind: 'big', bossId: null, targetScore: 450, reward: 4, status: 'defeated', skipTagId: null },
        { kind: 'boss', bossId: 'bl_wall', targetScore: 1200, reward: 5, status: 'current', skipTagId: null },
      ],
      score: 700,
      targetScore: 1200,
    });
    const disabledWall = disableActiveBoss(wallState);
    expect(disabledWall.nextState.targetScore).toBe(600);
    expect(disabledWall.events).toContainEqual(
      expect.objectContaining({
        type: 'BLIND_DEFEATED',
        bossId: 'bl_wall',
        finalScore: 700,
        targetScore: 600,
      }),
    );

    const vesselLowScore = createTestRunState({
      phase: 'playing',
      currentBlindIndex: 2,
      anteBlinds: [
        wallState.anteBlinds[0],
        wallState.anteBlinds[1],
        { kind: 'boss', bossId: 'bl_final_vessel', targetScore: 3000, reward: 8, status: 'current', skipTagId: null },
      ],
      score: 500,
      targetScore: 3000,
    });
    const disabledVessel = disableActiveBoss(vesselLowScore);
    expect(disabledVessel.nextState.targetScore).toBe(1000);
    expect(disabledVessel.events.some((e) => e.type === 'BLIND_DEFEATED')).toBe(false);
  });
});
