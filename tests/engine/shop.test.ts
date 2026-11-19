import { describe, expect, it } from 'vitest';
import { createStandardDeck } from '../../src/engine/cards';
import { createConsumableInstance } from '../../src/engine/consumables';
import { createInitialHandLevels } from '../../src/engine/handEval';
import { createRngState } from '../../src/engine/prng';
import { RELIC_DEFINITIONS, createRelicInstance, getRelicDefinition, resolveRelicTarget } from '../../src/engine/relics';
import {
  appendShopTopShelfOffer,
  canAffordCost,
  createShopState,
  generateBoosterState,
  pickPoolConsumable,
  pickPoolRelic,
  pollEdition,
  rerollShopState,
  rollRelicRarity,
} from '../../src/engine/shop';
import {
  CHARTER_IDS,
  SCROLL_IDS,
  type Edition,
  type PackOffer,
  type RelicId,
  type RunState,
} from '../../src/engine/types';

function createShopTestState(overrides: Partial<RunState> = {}): RunState {
  const deck = createStandardDeck();
  return {
    version: 1,
    seed: 'SHOP_TEST_SEED',
    rngState: createRngState('SHOP_TEST_SEED'),
    deckId: 'b_red',
    phase: 'shop',
    previousPhase: 'cashout',
    ante: 1,
    round: 1,
    currentBlindIndex: 0,
    anteBlinds: [
      { kind: 'small', bossId: null, targetScore: 300, reward: 3, status: 'defeated', skipTagId: null },
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
    dollars: 50,
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
    nextCardUid: 100,
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

describe('Магазин, бустеры и вероятности Balite (shop.ts)', () => {
  it('pollEdition соблюдает вероятности обычного пула (Negative 0.3% не масштабируется от v_hone) и гарантированного пула 50/35/15', () => {
    let rng = createRngState('EDITION_RATE_1');
    const countsRate1: Record<Edition, number> = { base: 0, foil: 0, holo: 0, polychrome: 0, negative: 0 };
    const samples = 20000;

    for (let i = 0; i < samples; i += 1) {
      const roll = pollEdition(rng, 'shop', 1);
      rng = roll.nextState;
      countsRate1[roll.value] += 1;
    }

    // Не затрагивает другие потоки PRNG
    expect(rng.streams.boss).toBe(createRngState('EDITION_RATE_1').streams.boss);
    expect(countsRate1.negative / samples).toBeGreaterThan(0.0015);
    expect(countsRate1.negative / samples).toBeLessThan(0.0055);
    expect(countsRate1.foil / samples).toBeGreaterThan(0.015);
    expect(countsRate1.foil / samples).toBeLessThan(0.026);
    expect(countsRate1.base / samples).toBeGreaterThan(0.953);

    // С v_hone (editionRate = 2): Negative остаётся ~0.3%, остальные удваиваются (~8% всего)
    let rng2 = createRngState('EDITION_RATE_2');
    const countsRate2: Record<Edition, number> = { base: 0, foil: 0, holo: 0, polychrome: 0, negative: 0 };
    for (let i = 0; i < samples; i += 1) {
      const roll = pollEdition(rng2, 'shop', 2);
      rng2 = roll.nextState;
      countsRate2[roll.value] += 1;
    }
    expect(countsRate2.negative / samples).toBeGreaterThan(0.0015);
    expect(countsRate2.negative / samples).toBeLessThan(0.0055);
    expect(countsRate2.holo / samples).toBeGreaterThan(0.022);
    expect(countsRate2.foil / samples).toBeGreaterThan(0.032);
    expect((samples - countsRate2.base) / samples).toBeGreaterThan(0.072);
    expect((samples - countsRate2.base) / samples).toBeLessThan(0.088);

    // Гарантированный не-теневой пул (Колесо Алхимика / Руна Сияния): 50% foil / 35% holo / 15% polychrome
    let rngG = createRngState('GUARANTEED_ED');
    const countsG: Record<Edition, number> = { base: 0, foil: 0, holo: 0, polychrome: 0, negative: 0 };
    for (let i = 0; i < 6000; i += 1) {
      const roll = pollEdition(rngG, 'shop', 2, { guaranteed: true });
      rngG = roll.nextState;
      countsG[roll.value] += 1;
    }
    expect(countsG.base).toBe(0);
    expect(countsG.negative).toBe(0);
    expect(countsG.foil / 6000).toBeGreaterThan(0.47);
    expect(countsG.foil / 6000).toBeLessThan(0.53);
    expect(countsG.holo / 6000).toBeGreaterThan(0.32);
    expect(countsG.holo / 6000).toBeLessThan(0.38);
    expect(countsG.polychrome / 6000).toBeGreaterThan(0.13);
    expect(countsG.polychrome / 6000).toBeLessThan(0.17);
  });

  it('rollRelicRarity, pickPoolRelic и pickPoolConsumable уважают редкости, скрытые Сферы и защиту от дублей / allowDuplicates', () => {
    let rng = createRngState('RARITY_DIST');
    const rarityCounts = { 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < 6000; i += 1) {
      const r = rollRelicRarity(rng, 'shop');
      rng = r.nextState;
      rarityCounts[r.value] += 1;
    }
    expect(rarityCounts[1] / 6000).toBeGreaterThan(0.67);
    expect(rarityCounts[2] / 6000).toBeGreaterThan(0.22);
    expect(rarityCounts[3] / 6000).toBeGreaterThan(0.035);
    expect(rarityCounts[3] / 6000).toBeLessThan(0.065);

    // Защита от дублей Реликвий (когда 5 из 6 R3 уже во владении — всегда выпадает 6-я)
    const r3Ids = RELIC_DEFINITIONS.filter((r) => r.rarity === 3).map((r) => r.id);
    const ownedFiveR3 = r3Ids.slice(0, 5).map((id, idx) => createRelicInstance(id, `r_${idx}`));
    const stateNoDup = createShopTestState({ relics: ownedFiveR3 });
    const pickedR3 = pickPoolRelic(stateNoDup, { rarity: 3, stream: 'shop' });
    expect(pickedR3.value).toBe(r3Ids[5]);

    // С allowDuplicates: true ограничения на дубли снимаются
    const seen = new Set<RelicId>();
    let dupRng = stateNoDup.rngState;
    for (let i = 0; i < 40; i += 1) {
      const p = pickPoolRelic(
        { ...stateNoDup, rngState: dupRng },
        { rarity: 3, stream: 'shop', allowDuplicates: true },
      );
      dupRng = p.nextState;
      seen.add(p.value);
    }
    expect(seen.size).toBeGreaterThan(1);

    // Скрытые Сферы (c_planet_x, c_ceres, c_eris) не падают, пока visible=false; c_black_hole не падает в пуле rune
    const hiddenCheckState = createShopTestState();
    let planetRng = hiddenCheckState.rngState;
    const droppedPlanets = new Set<string>();
    for (let i = 0; i < 120; i += 1) {
      const p = pickPoolConsumable({ ...hiddenCheckState, rngState: planetRng }, 'celestial', {
        stream: 'shop',
      });
      planetRng = p.nextState;
      droppedPlanets.add(p.value);
    }
    expect(droppedPlanets.has('c_planet_x')).toBe(false);
    expect(droppedPlanets.has('c_ceres')).toBe(false);
    expect(droppedPlanets.has('c_eris')).toBe(false);

    const unlockedLevels = createInitialHandLevels();
    unlockedLevels['Five of a Kind'] = { ...unlockedLevels['Five of a Kind'], visible: true, playedCount: 1 };
    const unlockedState = createShopTestState({ handLevels: unlockedLevels });
    let uRng = unlockedState.rngState;
    let sawPlanetX = false;
    for (let i = 0; i < 150; i += 1) {
      const p = pickPoolConsumable({ ...unlockedState, rngState: uRng }, 'celestial', { stream: 'shop' });
      uRng = p.nextState;
      if (p.value === 'c_planet_x') sawPlanetX = true;
    }
    expect(sawPlanetX).toBe(true);

    let runeRng = hiddenCheckState.rngState;
    for (let i = 0; i < 80; i += 1) {
      const r = pickPoolConsumable({ ...hiddenCheckState, rngState: runeRng }, 'rune', { stream: 'pack' });
      runeRng = r.nextState;
      expect(r.value).not.toBe('c_black_hole');
    }
  });

  it('createShopState генерирует 1-й магазин с p_buffoon_normal, учитывает v_overstock_norm, v_observatory и 25% скидку', () => {
    const state = createShopTestState({ shopVisits: 0 });
    const res = createShopState(state);
    const shop = res.nextState.shop!;

    expect(res.nextState.shopVisits).toBe(1);
    expect(shop.offers).toHaveLength(2);
    expect(shop.packs).toHaveLength(2);
    expect(shop.packs[0]!.packId).toBe('p_buffoon_normal');
    expect(shop.packs[0]!.cost).toBe(4);
    expect(shop.packs[0]!.totalCards).toBe(2);
    expect(shop.packs[0]!.chooseCount).toBe(1);
    expect(shop.rerollCost).toBe(5);
    expect(shop.voucher).not.toBeNull();
    expect(shop.voucher!.charterId).not.toBe('v_observatory');

    // Расходники на верхней полке магазина никогда не получают Изданий
    for (const offer of shop.offers) {
      if (offer.kind === 'consumable') {
        expect(offer.consumable.edition).toBe('base');
      }
    }

    // Проверка Overstock (+1 слот) + Clearance Sale (25% скидка) + доступность v_observatory при наличии v_telescope
    const almostAllCharters = CHARTER_IDS.filter(
      (id) => id !== 'v_observatory' && id !== 'v_directors_cut',
    );
    const withCharters = createShopTestState({
      shopVisits: 1,
      shopSlots: 3,
      discountPercent: 25,
      charters: almostAllCharters,
    });
    const res2 = createShopState(withCharters);
    expect(res2.nextState.shop!.offers).toHaveLength(3);
    expect(['v_observatory', 'v_directors_cut']).toContain(res2.nextState.shop!.voucher!.charterId);
    expect(res2.nextState.shop!.voucher!.cost).toBe(7);

    // Во 2-м и последующих магазинах слот 0 бустера не обязан быть p_buffoon_normal
    const sawNonBuffoonFirstSlot = [2, 3, 4, 5, 6, 7, 8, 9].some((i) => {
      const s = createShopState(
        createShopTestState({ seed: `SHOP_${i}`, rngState: createRngState(`SHOP_${i}`), shopVisits: 1 }),
      );
      return s.nextState.shop!.packs[0]!.type !== 'buffoon';
    });
    expect(sawNonBuffoonFirstSlot).toBe(true);
  });

  it('createShopState применяет и расходует tag_uncommon, tag_rare (включая fizzle), tag_coupon и tag_d_six', () => {
    const stateTags = createShopTestState({
      pendingTags: ['tag_uncommon', 'tag_rare', 'tag_coupon', 'tag_d_six'],
    });
    const res = createShopState(stateTags, { relicRegistry: getRelicDefinition });
    const shop = res.nextState.shop!;

    expect(res.nextState.pendingTags).toEqual([]);
    expect(shop.offers[0]!.kind).toBe('relic');
    expect(shop.offers[1]!.kind).toBe('relic');
    if (shop.offers[0]!.kind === 'relic' && shop.offers[1]!.kind === 'relic') {
      expect(getRelicDefinition(shop.offers[0]!.relic.id).rarity).toBe(2);
      expect(getRelicDefinition(shop.offers[1]!.relic.id).rarity).toBe(3);
      expect(shop.offers[0]!.relic.sellValue).toBeGreaterThanOrEqual(1);
    }
    expect(shop.offers.every((o) => o.cost === 0)).toBe(true);
    expect(shop.packs.every((p) => p.cost === 0)).toBe(true);
    expect(shop.voucher!.cost).toBe(10); // Знак Ярмарки не обнуляет Грамоту!
    expect(shop.rerollCost).toBe(0);
    expect(shop.tempRerollCost).toBe(0);

    // Проверка tag_rare fizzle, когда все 6 R3 Реликвий уже куплены
    const allR3 = RELIC_DEFINITIONS.filter((r) => r.rarity === 3).map((r, i) =>
      createRelicInstance(r.id, `r3_${i}`),
    );
    const fizzleState = createShopTestState({
      relics: allR3,
      pendingTags: ['tag_rare'],
    });
    const fizzleRes = createShopState(fizzleState);
    expect(fizzleRes.nextState.pendingTags).toEqual([]);
    expect(fizzleRes.events).toContainEqual(
      expect.objectContaining({ type: 'TAG_TRIGGER', tagId: 'tag_rare', locKey: 'tag_fizzled' }),
    );
  });

  it('rerollShopState обновляет только верхнюю полку, увеличивает цену реролла и масштабирует j_flash', () => {
    const flash = createRelicInstance('j_flash', 'rel_flash');
    const blueprint = createRelicInstance('j_blueprint', 'rel_bp');
    const entered = createShopState(
      createShopTestState({
        dollars: 40,
        relics: [blueprint, flash],
        pendingTags: ['tag_coupon', 'tag_d_six'],
      }),
    ).nextState;

    const initialVoucher = entered.shop!.voucher;
    const initialPacks = entered.shop!.packs;

    // 1-й реролл: стоит 0 з. из-за tag_d_six; обновляет полку без повторного tag_coupon; j_flash -> +2 mult
    const r1 = rerollShopState(entered, { relicRegistry: getRelicDefinition, resolveRelicTarget });
    expect(r1.nextState.dollars).toBe(40);
    expect(r1.nextState.shop!.rerollsUsedThisShop).toBe(1);
    expect(r1.nextState.shop!.rerollCost).toBe(1);
    expect(r1.nextState.shop!.voucher).toEqual(initialVoucher);
    expect(r1.nextState.shop!.packs).toEqual(initialPacks);
    expect(r1.nextState.relics[1]!.state.mult).toBe(2);
    expect(r1.nextState.shop!.offers.some((o) => o.cost > 0)).toBe(true);
    expect(r1.events).toContainEqual(
      expect.objectContaining({
        type: 'RELIC_TRIGGER',
        relicUid: 'rel_flash',
        relicId: 'j_flash',
        hook: 'onShopReroll',
      }),
    );

    // 2-й реролл: стоит 1 з., следующая цена -> 2 з., j_flash -> +4 mult
    const r2 = rerollShopState(r1.nextState, getRelicDefinition);
    expect(r2.nextState.dollars).toBe(39);
    expect(r2.nextState.stats.dollarsSpent).toBe(1);
    expect(r2.nextState.shop!.rerollsUsedThisShop).toBe(2);
    expect(r2.nextState.shop!.rerollCost).toBe(2);
    expect(r2.nextState.relics[1]!.state.mult).toBe(4);
    expect(r2.events).toContainEqual({
      type: 'DOLLAR_DELTA',
      delta: -1,
      totalDollars: 39,
      source: 'reroll',
    });
  });

  it('generateBoosterState наполняет все 5 типов наборов, поддерживает v_telescope, временную руку и 0.3% c_black_hole', () => {
    // 1. Arcana Mega Pack (fromTag = true): 5 свитков, выбрать 2, временная рука = handSize (8)
    const arcanaMega: PackOffer = {
      uid: 'pack_arc',
      packId: 'p_arcana_mega',
      type: 'arcana',
      size: 'mega',
      cost: 8,
      baseCost: 8,
      totalCards: 5,
      chooseCount: 2,
      purchased: true,
    };
    const arcRes = generateBoosterState(createShopTestState({ handSize: 8 }), arcanaMega, true);
    const arcBooster = arcRes.nextState.booster!;
    expect(arcBooster.choices).toHaveLength(5);
    expect(arcBooster.remainingPicks).toBe(2);
    expect(arcBooster.fromTag).toBe(true);
    expect(arcBooster.drawnHandCardIds).toHaveLength(8);
    expect(arcBooster.choices.every((c) => c.kind === 'consumable' && c.consumable.kind === 'scroll')).toBe(
      true,
    );

    // 2. Celestial + v_telescope: слот 0 — Сфера самого играемого расклада (при ничьей — старший в HAND_TYPES)
    const levels = createInitialHandLevels();
    levels['Full House'] = { ...levels['Full House'], playedCount: 4 };
    levels['Pair'] = { ...levels['Pair'], playedCount: 4 };
    const celPack: PackOffer = {
      uid: 'pack_cel',
      packId: 'p_celestial_normal',
      type: 'celestial',
      size: 'normal',
      cost: 4,
      baseCost: 4,
      totalCards: 3,
      chooseCount: 1,
      purchased: true,
    };
    const celRes = generateBoosterState(
      createShopTestState({ charters: ['v_telescope'], handLevels: levels }),
      celPack,
    );
    const firstChoice = celRes.nextState.booster!.choices[0]!;
    expect(firstChoice.kind).toBe('consumable');
    if (firstChoice.kind === 'consumable') {
      expect(firstChoice.consumable.id).toBe('c_earth');
    }

    // 3. Buffoon Jumbo Pack: 4 уникальные Реликвии
    const bufPack: PackOffer = {
      uid: 'pack_buf',
      packId: 'p_buffoon_jumbo',
      type: 'buffoon',
      size: 'jumbo',
      cost: 6,
      baseCost: 6,
      totalCards: 4,
      chooseCount: 1,
      purchased: true,
    };
    const bufRes = generateBoosterState(createShopTestState(), bufPack);
    const bufRelicIds = bufRes.nextState.booster!.choices.map((c) => (c.kind === 'relic' ? c.relic.id : ''));
    expect(bufRes.nextState.booster!.choices).toHaveLength(4);
    expect(new Set(bufRelicIds).size).toBe(4);

    // 4. Standard Mega Pack: 5 игральных карт с вероятностными улучшениями/изданиями/печатями
    const stdPack: PackOffer = {
      uid: 'pack_std',
      packId: 'p_standard_mega',
      type: 'standard',
      size: 'mega',
      cost: 8,
      baseCost: 8,
      totalCards: 5,
      chooseCount: 2,
      purchased: true,
    };
    let stdState = createShopTestState();
    let totalCards = 0;
    let enhanced = 0;
    let sealed = 0;
    let editioned = 0;
    for (let i = 0; i < 400; i += 1) {
      const r = generateBoosterState(stdState, stdPack);
      stdState = r.nextState;
      for (const ch of r.nextState.booster!.choices) {
        expect(ch.kind).toBe('card');
        if (ch.kind === 'card') {
          totalCards += 1;
          if (ch.card.enhancement !== 'none') enhanced += 1;
          if (ch.card.seal !== 'none') sealed += 1;
          if (ch.card.edition !== 'base') editioned += 1;
        }
      }
    }
    expect(enhanced / totalCards).toBeGreaterThan(0.35);
    expect(enhanced / totalCards).toBeLessThan(0.45);
    expect(sealed / totalCards).toBeGreaterThan(0.16);
    expect(sealed / totalCards).toBeLessThan(0.24);
    expect(editioned / totalCards).toBeGreaterThan(0.055);
    expect(editioned / totalCards).toBeLessThan(0.105);

    // 5. Spectral Pack + 0.3% шанс c_black_hole
    const specPack: PackOffer = {
      uid: 'pack_spec',
      packId: 'p_spectral_jumbo',
      type: 'spectral',
      size: 'jumbo',
      cost: 6,
      baseCost: 6,
      totalCards: 4,
      chooseCount: 1,
      purchased: true,
    };
    let specState = createShopTestState();
    let blackHoleHits = 0;
    for (let i = 0; i < 800; i += 1) {
      const r = generateBoosterState(specState, specPack);
      specState = r.nextState;
      if (i === 0) {
        expect(r.nextState.booster!.drawnHandCardIds).toHaveLength(8);
      }
      for (const ch of r.nextState.booster!.choices) {
        if (ch.kind === 'consumable' && ch.consumable.id === 'c_black_hole') {
          blackHoleHits += 1;
        }
      }
    }
    expect(blackHoleHits).toBeGreaterThan(0);
  });

  it('A7, A14, A15, A16: единый used_jokers с полкой, фоллбэк j_joker, бесплатные рероллы/долг и забор руки бустера из drawPileIds', () => {
    // A14: при исчерпании всех R3 реликвий фоллбэк возвращает j_joker (а не дубликат и не R1/R2)
    const allR3Relics = RELIC_DEFINITIONS.filter((d) => d.rarity === 3).map((d, idx) =>
      createRelicInstance(d.id, `r3_${idx}`),
    );
    const r3Exhausted = createShopTestState({ relics: allR3Relics });
    expect(pickPoolRelic(r3Exhausted, { rarity: 3 }).value).toBe('j_joker');

    // A7: непроданные товары полки магазина не выпадают внутри открытого бустера
    const allButOneScrolls = SCROLL_IDS.slice(0, 15).map((id, idx) =>
      createConsumableInstance(id, `c_own_${idx}`),
    );
    const lastScroll = SCROLL_IDS[15]!;
    const arcanaShopState = createShopTestState({
      consumables: allButOneScrolls.slice(0, 14),
      shop: {
        offers: [
          {
            uid: 'shop_scroll',
            kind: 'consumable',
            consumable: createConsumableInstance(lastScroll, 'cons_shelf'),
            cost: 3,
            baseCost: 3,
            sold: false,
          },
        ],
        voucher: null,
        packs: [],
        rerollCost: 5,
        tempRerollCost: null,
        rerollsUsedThisShop: 0,
      },
    });
    const arcanaPack: PackOffer = {
      uid: 'p_arc',
      packId: 'p_arcana_normal',
      type: 'arcana',
      size: 'normal',
      cost: 4,
      baseCost: 4,
      totalCards: 1,
      chooseCount: 1,
      purchased: true,
    };
    const arcBooster = generateBoosterState(arcanaShopState, arcanaPack);
    const arcChoice = arcBooster.nextState.booster?.choices[0];
    expect(arcChoice?.kind).toBe('consumable');
    if (arcChoice?.kind === 'consumable') {
      // Единственный оставшийся без полки и инвентаря — SCROLL_IDS[14]
      expect(arcChoice.consumable.id).toBe(SCROLL_IDS[14]);
    }

    // Проверка appendShopTopShelfOffer (A3 на уровне shop.ts)
    const expandBase = createShopTestState({
      shopSlots: 3,
      shop: arcanaShopState.shop,
    });
    const expanded = appendShopTopShelfOffer(expandBase, getRelicDefinition);
    expect(expanded.nextState.shop?.offers).toHaveLength(3);

    // A15: бесплатный реролл (cost = 0) доступен при отрицательном балансе, платный требует bankruptAt
    const negativeState = createShopTestState({
      dollars: -5,
      shop: {
        offers: [],
        voucher: null,
        packs: [],
        rerollCost: 0,
        tempRerollCost: 0,
        rerollsUsedThisShop: 0,
      },
    });
    expect(canAffordCost(negativeState, 0)).toBe(true);
    expect(canAffordCost(negativeState, 5)).toBe(false);
    expect(rerollShopState(negativeState, getRelicDefinition).nextState.shop?.rerollsUsedThisShop).toBe(1);

    const creditShop = createShopTestState({
      dollars: -10,
      bankruptAt: -20,
      shop: {
        offers: [],
        voucher: null,
        packs: [],
        rerollCost: 5,
        tempRerollCost: null,
        rerollsUsedThisShop: 0,
      },
    });
    const creditReroll = rerollShopState(creditShop, getRelicDefinition);
    expect(creditReroll.nextState.dollars).toBe(-15);

    // A16: при непустом drawPileIds generateBoosterState берёт строго верхние handSize карт без шаффла
    const seqDeck = createStandardDeck();
    const seqIds = seqDeck.map((c) => c.id);
    const boosterDrawRes = generateBoosterState(
      createShopTestState({
        deck: seqDeck,
        drawPileIds: seqIds,
        handSize: 8,
      }),
      arcanaPack,
    );
    expect(boosterDrawRes.nextState.booster?.drawnHandCardIds).toEqual(seqIds.slice(0, 8));
    expect(boosterDrawRes.nextState.drawPileIds).toEqual(seqIds.slice(8));
  });
});
