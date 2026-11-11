import { describe, expect, it } from 'vitest';
import { createPlayingCard, createStandardDeck } from '../../src/engine/cards';
import {
  CELESTIAL_HAND_MAP,
  HAND_TO_CELESTIAL_MAP,
  applyConsumable,
  calculateConsumableBuyCost,
  calculateConsumableSellValue,
  canUseConsumable,
  createConsumableInstance,
} from '../../src/engine/consumables';
import { HAND_BASE_CONFIG, createInitialHandLevels } from '../../src/engine/handEval';
import { createRngState } from '../../src/engine/prng';
import { createRelicInstance, getRelicDefinition, resolveRelicTarget } from '../../src/engine/relics';
import {
  HAND_TYPES,
  type ConsumableId,
  type ConsumableInstance,
  type Edition,
  type PlayingCard,
  type RelicInstance,
  type RunState,
} from '../../src/engine/types';

function createTestRunState(overrides: Partial<RunState> = {}): RunState {
  const hand = [
    createPlayingCard({ id: 'c1', suit: 'spades', rank: 14 }),
    createPlayingCard({ id: 'c2', suit: 'hearts', rank: 13 }),
    createPlayingCard({ id: 'c3', suit: 'clubs', rank: 9 }),
    createPlayingCard({ id: 'c4', suit: 'diamonds', rank: 5 }),
    createPlayingCard({ id: 'c5', suit: 'spades', rank: 2 }),
    createPlayingCard({ id: 'c6', suit: 'hearts', rank: 7 }),
  ];

  return {
    version: 1,
    seed: 'TEST_CONSUMABLES',
    rngState: createRngState('TEST_CONSUMABLES'),
    deckId: 'b_red',
    phase: 'playing',
    previousPhase: null,
    ante: 1,
    round: 1,
    currentBlindIndex: 0,
    anteBlinds: [
      { kind: 'small', bossId: null, targetScore: 300, reward: 3, status: 'current', skipTagId: null },
      { kind: 'big', bossId: null, targetScore: 450, reward: 4, status: 'upcoming', skipTagId: null },
      { kind: 'boss', bossId: 'bl_hook', targetScore: 600, reward: 5, status: 'upcoming', skipTagId: null },
    ],
    bossUseCounts: { bl_hook: 1 },
    bossRerollsThisAnte: 0,
    activeBossDisabled: false,
    savedBossDiscards: null,
    endlessMode: false,
    probabilitiesNormal: 1,
    anteScaling: 1,
    score: 0,
    targetScore: 300,
    dollars: 10,
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
    deck: hand,
    drawPileIds: [],
    handIds: hand.map((c) => c.id),
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

function makeConsumable(
  id: ConsumableId,
  uid = 'cons_1',
  edition: Edition = 'base',
): ConsumableInstance {
  return createConsumableInstance(id, uid, edition, 0);
}

describe('Расходники Balite (consumables.ts)', () => {
  it('сопоставляет все 12 раскладов и 12 Астральных сфер без пропусков и корректно считает цены', () => {
    for (const handType of HAND_TYPES) {
      const celestialId = HAND_TO_CELESTIAL_MAP[handType];
      expect(CELESTIAL_HAND_MAP[celestialId]).toBe(handType);
    }

    const sphere = createConsumableInstance('c_mercury', 'u1');
    expect(sphere.kind).toBe('celestial');
    expect(sphere.baseCost).toBe(3);
    expect(sphere.sellValue).toBe(1);

    const scroll = createConsumableInstance('c_hermit', 'u2');
    expect(scroll.kind).toBe('scroll');
    expect(scroll.baseCost).toBe(3);
    expect(scroll.sellValue).toBe(1);

    const rune = createConsumableInstance('c_hex', 'u3');
    expect(rune.kind).toBe('rune');
    expect(rune.baseCost).toBe(4);
    expect(rune.sellValue).toBe(2);

    expect(calculateConsumableBuyCost(3, 'base', 0)).toBe(3);
    expect(calculateConsumableBuyCost(4, 'base', 25)).toBe(3);
    expect(calculateConsumableBuyCost(3, 'holo', 0)).toBe(6);
    expect(calculateConsumableSellValue(6)).toBe(3);
    expect(calculateConsumableSellValue(1)).toBe(1);
  });

  it('Астральные сферы повышают уровень расклада, обновляют lastUsedConsumableId и усиливают j_constellation (без дубля от Blueprint)', () => {
    const mercury = makeConsumable('c_mercury', 'cons_m');
    const constellation = createRelicInstance('j_constellation', 'rel_c');
    const blueprint = createRelicInstance('j_blueprint', 'rel_bp');
    const handLevels = createInitialHandLevels();
    handLevels['Five of a Kind'] = {
      ...handLevels['Five of a Kind'],
      visible: true,
      playedCount: 1,
    };

    const initial = createTestRunState({
      consumables: [mercury],
      relics: [blueprint, constellation],
      handLevels,
    });

    expect(canUseConsumable(initial, mercury)).toBe(true);
    const res1 = applyConsumable(initial, mercury, [], {
      relicRegistry: getRelicDefinition,
      resolveRelicTarget,
    });

    // Исходное состояние не мутировалось
    expect(initial.handLevels.Pair.level).toBe(1);
    expect(initial.consumables).toHaveLength(1);

    expect(res1.nextState.consumables).toHaveLength(0);
    expect(res1.nextState.lastUsedConsumableId).toBe('c_mercury');
    expect(res1.nextState.handLevels.Pair).toEqual({
      level: 2,
      chips: HAND_BASE_CONFIG.Pair.baseChips + HAND_BASE_CONFIG.Pair.levelChips,
      mult: HAND_BASE_CONFIG.Pair.baseMult + HAND_BASE_CONFIG.Pair.levelMult,
      playedCount: 0,
      visible: true,
    });
    expect(res1.nextState.relics[1]!.state.xMult).toBe(1.1);
    expect(res1.events).toContainEqual({
      type: 'HAND_LEVEL_UP',
      handType: 'Pair',
      newLevel: 2,
      chips: 25,
      mult: 3,
    });
    expect(res1.events).toContainEqual(
      expect.objectContaining({
        type: 'CONSUMABLE_TRIGGER',
        consumableId: 'c_mercury',
        handType: 'Pair',
        locKey: 'hand_level_up',
        locParams: { handName: 'Pair', level: 2 },
      }),
    );
    expect(res1.events).toContainEqual(
      expect.objectContaining({
        type: 'RELIC_TRIGGER',
        relicUid: 'rel_c',
        relicId: 'j_constellation',
        hook: 'onUseConsumable',
      }),
    );

    // Проверка c_black_hole: +1 ур. ко всем 12 раскладам, lastUsedConsumableId и j_constellation не меняются
    const blackHole = makeConsumable('c_black_hole', 'cons_bh');
    const stateWithBh: RunState = {
      ...res1.nextState,
      consumables: [blackHole],
    };
    const resBh = applyConsumable(stateWithBh, blackHole, [], {
      relicRegistry: getRelicDefinition,
      resolveRelicTarget,
    });

    for (const ht of HAND_TYPES) {
      const expectedLevel = ht === 'Pair' ? 3 : 2;
      expect(resBh.nextState.handLevels[ht].level).toBe(expectedLevel);
    }
    expect(resBh.nextState.lastUsedConsumableId).toBe('c_mercury');
    expect(resBh.nextState.relics[1]!.state.xMult).toBe(1.1);
    expect(resBh.events).toContainEqual(
      expect.objectContaining({
        type: 'CONSUMABLE_TRIGGER',
        consumableId: 'c_black_hole',
        locKey: 'consumable_all_hands_up',
        locParams: { levels: 1 },
      }),
    );
  });

  it('проверяет ограничения фаз и целевых карт для свитков улучшений, c_strength и c_death', () => {
    const magician = makeConsumable('c_magician', 'cons_mag');
    const chariot = makeConsumable('c_chariot', 'cons_cha');
    const strength = makeConsumable('c_strength', 'cons_str');
    const death = makeConsumable('c_death', 'cons_dth');

    const shopState = createTestRunState({ phase: 'shop', handIds: [] });
    expect(canUseConsumable(shopState, magician, ['c1'])).toBe(false);

    const playing = createTestRunState({ phase: 'playing', handIds: ['c1', 'c2', 'c3', 'c4'] });
    expect(canUseConsumable(playing, magician, [])).toBe(false);
    expect(canUseConsumable(playing, magician, ['c1', 'c2', 'c3'])).toBe(false);
    expect(canUseConsumable(playing, magician, ['c1', 'c1'])).toBe(false);
    expect(canUseConsumable(playing, magician, ['c1', 'c2'])).toBe(true);
    expect(canUseConsumable(playing, chariot, ['c1', 'c2'])).toBe(false);
    expect(canUseConsumable(playing, chariot, ['c1'])).toBe(true);
    expect(canUseConsumable(playing, death, ['c1'])).toBe(false);
    expect(canUseConsumable(playing, death, ['c1', 'c2'])).toBe(true);

    // Улучшение до 2 карт: c_magician -> lucky
    const afterMag = applyConsumable(playing, magician, ['c1', 'c3']).nextState;
    expect(afterMag.deck.find((c) => c.id === 'c1')?.enhancement).toBe('lucky');
    expect(afterMag.deck.find((c) => c.id === 'c3')?.enhancement).toBe('lucky');

    // c_strength: Туз (14) оборачивается в 2, а 9 -> 10
    const afterStr = applyConsumable(afterMag, strength, ['c1', 'c3']).nextState;
    expect(afterStr.deck.find((c) => c.id === 'c1')?.rank).toBe(2);
    expect(afterStr.deck.find((c) => c.id === 'c3')?.rank).toBe(10);

    // c_death в бустере (использует booster.drawnHandCardIds и порядок слева направо, даже если переданы [правая, левая])
    const rightCard = createPlayingCard({
      id: 'b_right',
      suit: 'hearts',
      rank: 13,
      enhancement: 'glass',
      edition: 'polychrome',
      seal: 'red',
      permaBonus: 25,
    });
    const leftCard = createPlayingCard({ id: 'b_left', suit: 'clubs', rank: 3 });
    const boosterState = createTestRunState({
      phase: 'booster',
      deck: [leftCard, rightCard],
      handIds: [],
      booster: {
        packId: 'p_arcana_normal',
        packType: 'arcana',
        packSize: 'normal',
        choices: [],
        remainingPicks: 1,
        drawnHandCardIds: ['b_left', 'b_right'],
        fromTag: false,
      },
    });

    expect(canUseConsumable(boosterState, death, ['b_right', 'b_left'])).toBe(true);
    const afterDeath = applyConsumable(boosterState, death, ['b_right', 'b_left']).nextState;
    const copied = afterDeath.deck.find((c) => c.id === 'b_left')!;
    expect(copied.id).toBe('b_left');
    expect(copied.suit).toBe('hearts');
    expect(copied.rank).toBe(13);
    expect(copied.enhancement).toBe('glass');
    expect(copied.edition).toBe('polychrome');
    expect(copied.seal).toBe('red');
    expect(copied.permaBonus).toBe(25);
    expect(afterDeath.lastUsedConsumableId).toBe('c_death');
  });

  it('c_hanged_man удаляет до 2 карт из всех стопок, увеличивает cardsDestroyed и шлёт CARD_SHATTER', () => {
    const hanged = makeConsumable('c_hanged_man', 'cons_hm');
    const state = createTestRunState({
      consumables: [hanged],
      drawPileIds: ['c1', 'c6'],
      discardPileIds: ['c2'],
      handIds: ['c1', 'c2', 'c3', 'c4'],
    });

    const res = applyConsumable(state, hanged, ['c1', 'c2']);
    expect(res.nextState.deck.map((c) => c.id)).not.toContain('c1');
    expect(res.nextState.deck.map((c) => c.id)).not.toContain('c2');
    expect(res.nextState.handIds).toEqual(['c3', 'c4']);
    expect(res.nextState.drawPileIds).toEqual(['c6']);
    expect(res.nextState.discardPileIds).toEqual([]);
    expect(res.nextState.stats.cardsDestroyed).toBe(2);
    expect(res.events).toContainEqual({ type: 'CARD_SHATTER', cardId: 'c1', reason: 'scroll' });
    expect(res.events).toContainEqual({ type: 'CARD_SHATTER', cardId: 'c2', reason: 'scroll' });
  });

  it('c_fool, c_hermit и c_temperance соблюдают лимиты и предотвращают цепочку Fool -> Fool', () => {
    const foolInSlot = makeConsumable('c_fool', 'cons_fool');
    const extraInSlot = makeConsumable('c_hermit', 'cons_hermit');

    // Нельзя использовать без прошлого свитка/сферы или после c_fool
    expect(canUseConsumable(createTestRunState({ lastUsedConsumableId: null }), foolInSlot)).toBe(false);
    expect(canUseConsumable(createTestRunState({ lastUsedConsumableId: 'c_fool' }), foolInSlot)).toBe(false);

    // Полные слоты (2/2), но используем c_fool из своего слота -> можно!
    const fullFromSlot = createTestRunState({
      maxConsumables: 2,
      consumables: [extraInSlot, foolInSlot],
      lastUsedConsumableId: 'c_mars',
    });
    expect(canUseConsumable(fullFromSlot, foolInSlot)).toBe(true);

    // Полные слоты (2/2), c_fool открывается из бустера (не в consumables) -> нельзя!
    const packFool = makeConsumable('c_fool', 'cons_pack_fool');
    expect(canUseConsumable(fullFromSlot, packFool)).toBe(false);

    const foolRes = applyConsumable(fullFromSlot, foolInSlot);
    expect(foolRes.nextState.consumables).toHaveLength(2);
    expect(foolRes.nextState.consumables.map((c) => c.id)).toEqual(['c_hermit', 'c_mars']);
    expect(foolRes.nextState.lastUsedConsumableId).toBe('c_fool');

    // Повторное использование нового c_fool подряд запрещено
    expect(canUseConsumable(foolRes.nextState, makeConsumable('c_fool', 'cons_fool_2'))).toBe(false);

    // c_hermit: максимум +$20
    const hermitRes = applyConsumable(createTestRunState({ dollars: 35 }), makeConsumable('c_hermit'));
    expect(hermitRes.nextState.dollars).toBe(55);
    expect(hermitRes.events).toContainEqual({
      type: 'DOLLAR_DELTA',
      delta: 20,
      totalDollars: 55,
      source: 'consumable',
    });

    // c_temperance: сумма sellValue до $50
    const r1 = { ...createRelicInstance('j_joker', 'r1'), sellValue: 30 };
    const r2 = { ...createRelicInstance('j_greedy_joker', 'r2'), sellValue: 35 };
    const tempRes = applyConsumable(
      createTestRunState({ dollars: 5, relics: [r1, r2] }),
      makeConsumable('c_temperance'),
    );
    expect(tempRes.nextState.dollars).toBe(55);
  });

  it('c_wheel_of_fortune срабатывает с вероятностью probabilitiesNormal/4 (успех -> не-теневое издание, неудача -> consumable_nope)', () => {
    const wheel = makeConsumable('c_wheel_of_fortune', 'cons_wof');
    const foilRelic = createRelicInstance('j_joker', 'r_foil', 'foil');
    const baseRelic = createRelicInstance('j_banner', 'r_base', 'base');

    // Нужна хотя бы одна Реликвия без издания
    expect(canUseConsumable(createTestRunState({ relics: [foilRelic] }), wheel)).toBe(false);
    expect(canUseConsumable(createTestRunState({ relics: [foilRelic, baseRelic] }), wheel)).toBe(true);

    let hits = 0;
    let misses = 0;
    const editions = new Set<Edition>();

    for (let i = 0; i < 400; i += 1) {
      const state = createTestRunState({
        seed: `WOF_${i}`,
        rngState: createRngState(`WOF_${i}`),
        relics: [foilRelic, baseRelic],
        consumables: [wheel],
      });
      const res = applyConsumable(state, wheel);
      const nope = res.events.some(
        (ev) => ev.type === 'CONSUMABLE_TRIGGER' && ev.locKey === 'consumable_nope',
      );
      if (nope) {
        misses += 1;
        expect(res.nextState.relics[1]!.edition).toBe('base');
      } else {
        hits += 1;
        const upgraded = res.nextState.relics[1]!;
        expect(['foil', 'holo', 'polychrome']).toContain(upgraded.edition);
        expect(upgraded.sellValue).toBeGreaterThan(baseRelic.sellValue);
        editions.add(upgraded.edition);
      }
    }

    expect(hits).toBeGreaterThan(60);
    expect(hits).toBeLessThan(140);
    expect(misses).toBe(400 - hits);
    expect(editions.has('foil')).toBe(true);
    expect(editions.has('holo')).toBe(true);
    expect(editions.has('polychrome')).toBe(true);
    expect(editions.has('negative')).toBe(false);
  });

  it('c_judgement создаёт Реликвию при наличии места (учитывая Теневые слоты) и не дублирует имеющиеся без Showman', () => {
    const judge = makeConsumable('c_judgement', 'cons_jud');
    const fullRelics = [
      createRelicInstance('j_joker', 'r1'),
      createRelicInstance('j_greedy_joker', 'r2'),
      createRelicInstance('j_lusty_joker', 'r3'),
      createRelicInstance('j_wrathful_joker', 'r4'),
      createRelicInstance('j_gluttenous_joker', 'r5'),
    ];
    expect(canUseConsumable(createTestRunState({ maxRelics: 5, relics: fullRelics }), judge)).toBe(false);

    // Если одна из 5 Реликвий Теневая — лимит становится 6, место есть!
    const withNegative: RelicInstance[] = [
      ...fullRelics.slice(0, 4),
      createRelicInstance('j_gluttenous_joker', 'r5', 'negative'),
    ];
    const state = createTestRunState({ maxRelics: 5, relics: withNegative, consumables: [judge] });
    expect(canUseConsumable(state, judge)).toBe(true);

    const res = applyConsumable(state, judge);
    expect(res.nextState.relics).toHaveLength(6);
    const created = res.nextState.relics[5]!;
    expect(fullRelics.map((r) => r.id)).not.toContain(created.id);
  });

  it('Эфирные руны (печати, c_aura, c_cryptid -> j_hologram, c_immolate, c_hex с eternal) работают детерминированно', () => {
    // Печати и c_aura
    const sealState = createTestRunState();
    const talisman = applyConsumable(sealState, makeConsumable('c_talisman'), ['c1']).nextState;
    expect(talisman.deck.find((c) => c.id === 'c1')?.seal).toBe('gold');

    const aura = makeConsumable('c_aura', 'cons_aura');
    const foilCard = createPlayingCard({ id: 'c_foil', suit: 'spades', rank: 10, edition: 'foil' });
    const auraBlocked = createTestRunState({ deck: [foilCard, ...sealState.deck], handIds: ['c_foil', 'c1'] });
    expect(canUseConsumable(auraBlocked, aura, ['c_foil'])).toBe(false);
    expect(canUseConsumable(auraBlocked, aura, ['c1'])).toBe(true);
    const afterAura = applyConsumable(auraBlocked, aura, ['c1']).nextState;
    expect(['foil', 'holo', 'polychrome']).toContain(afterAura.deck.find((c) => c.id === 'c1')?.edition);

    // c_cryptid: +2 копии в руку/колоду + хук onCardAdded для j_hologram (+0.5 xMult)
    const hologram = createRelicInstance('j_hologram', 'rel_holo');
    const cryptidState = createTestRunState({
      relics: [hologram],
      handIds: ['c1', 'c2'],
      deck: [
        createPlayingCard({ id: 'c1', suit: 'spades', rank: 14, enhancement: 'steel', seal: 'red' }),
        createPlayingCard({ id: 'c2', suit: 'hearts', rank: 4 }),
      ],
    });
    const afterCryptid = applyConsumable(
      cryptidState,
      makeConsumable('c_cryptid'),
      ['c1'],
      { relicRegistry: getRelicDefinition, resolveRelicTarget },
    );
    expect(afterCryptid.nextState.deck).toHaveLength(4);
    expect(afterCryptid.nextState.handIds).toHaveLength(4);
    const copies = afterCryptid.nextState.deck.filter((c) => c.id !== 'c1' && c.id !== 'c2');
    expect(copies).toHaveLength(2);
    expect(copies[0]!.enhancement).toBe('steel');
    expect(copies[0]!.seal).toBe('red');
    expect(afterCryptid.nextState.relics[0]!.state.xMult).toBe(1.5);

    // c_immolate: требует hand.length > 1, уничтожает до 5 случайных карт через 'shuffle' + $20
    const immolate = makeConsumable('c_immolate');
    const oneCardState = createTestRunState({ handIds: ['c1'] });
    expect(canUseConsumable(oneCardState, immolate)).toBe(false);

    const fullDeck = createStandardDeck();
    const immState = createTestRunState({
      dollars: 3,
      deck: fullDeck,
      handIds: fullDeck.slice(0, 8).map((c) => c.id),
    });
    const afterImm = applyConsumable(immState, immolate);
    expect(afterImm.nextState.handIds).toHaveLength(3);
    expect(afterImm.nextState.deck).toHaveLength(47);
    expect(afterImm.nextState.stats.cardsDestroyed).toBe(5);
    expect(afterImm.nextState.dollars).toBe(23);
    expect(afterImm.events.filter((e) => e.type === 'CARD_SHATTER' && e.reason === 'rune')).toHaveLength(5);

    // c_hex: 1 случайная без издания -> polychrome, остальные не-eternal уничтожаются
    const eternalRelicBase = createRelicInstance('j_joker', 'r_et', 'base');
    const eternalRelic: RelicInstance = {
      ...eternalRelicBase,
      state: { ...eternalRelicBase.state, extra: { eternal: true } },
    };
    const disposableRelic = createRelicInstance('j_banner', 'r_disp', 'foil');
    const targetRelic = createRelicInstance('j_mystic_summit', 'r_hex_target', 'base');
    const hexState = createTestRunState({
      seed: 'HEX_SEED_FIXED',
      rngState: createRngState('HEX_SEED_FIXED'),
      relics: [eternalRelic, disposableRelic, targetRelic],
      consumables: [makeConsumable('c_hex', 'cons_hex')],
    });
    const afterHex = applyConsumable(hexState, makeConsumable('c_hex', 'cons_hex'));
    // Проверяем, что хотя бы одна базовая Реликвия стала polychrome, disposable уничтожена, а eternal сохранена (если не она стала целью -> обе сохранились; если disposable -> точно удалена)
    const polyRelics = afterHex.nextState.relics.filter((r) => r.edition === 'polychrome');
    expect(polyRelics).toHaveLength(1);
    expect(afterHex.nextState.relics.some((r) => r.uid === 'r_et')).toBe(true);
    expect(afterHex.nextState.relics.some((r) => r.uid === 'r_disp')).toBe(false);
    expect(afterHex.events).toContainEqual({
      type: 'RELIC_DESTROYED',
      relicUid: 'r_disp',
      relicId: 'j_banner',
      reason: 'hex',
    });
  });

  it('все 8 свитков улучшений и 4 руны печатей корректно применяются к целевым картам', () => {
    const cases: Array<[ConsumableId, Partial<PlayingCard>]> = [
      ['c_empress', { enhancement: 'mult' }],
      ['c_heirophant', { enhancement: 'bonus' }],
      ['c_lovers', { enhancement: 'wild' }],
      ['c_chariot', { enhancement: 'steel' }],
      ['c_justice', { enhancement: 'glass' }],
      ['c_devil', { enhancement: 'gold' }],
      ['c_tower', { enhancement: 'stone' }],
      ['c_deja_vu', { seal: 'red' }],
      ['c_trance', { seal: 'blue' }],
      ['c_medium', { seal: 'purple' }],
    ];

    const base = createTestRunState();
    for (const [id, expected] of cases) {
      const res = applyConsumable(base, makeConsumable(id), ['c1']);
      const card = res.nextState.deck.find((c) => c.id === 'c1')!;
      if (expected.enhancement) {
        expect(card.enhancement).toBe(expected.enhancement);
      }
      if (expected.seal) {
        expect(card.seal).toBe(expected.seal);
      }
    }
  });
});
