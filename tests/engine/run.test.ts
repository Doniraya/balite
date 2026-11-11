import { describe, expect, it } from 'vitest';
import {
  CELESTIAL_HAND_MAP,
  createConsumableInstance,
  createInitialRunState,
  createPlayingCard,
  createRelicInstance,
  dispatch,
  evaluatePlay,
  evaluateRoundEnd,
  getRelicDefinition,
  resolveRelicTarget,
  restoreRunStateFromSnapshot,
  serializeRunStateToSnapshot,
  type DispatchResult,
  type GameCommand,
  type PlayingCard,
  type RunState,
  type TraceEvent,
} from '../../src/engine';
import { EN_DICTIONARY, RU_DICTIONARY } from '../../src/i18n';

/**
 * Прогоняет последовательность команд через чистый диспетчер и собирает все порождённые события.
 */
function runCommands(
  initial: RunState,
  commands: readonly GameCommand[],
): { readonly state: RunState; readonly events: TraceEvent[] } {
  let state = initial;
  const allEvents: TraceEvent[] = [];

  for (const command of commands) {
    const result = dispatch(state, command);
    state = result.nextState;
    allEvents.push(...result.events);
  }

  return { state, events: allEvents };
}

/**
 * Собирает все ключи trace-локализации в словаре.
 */
function getValidTraceLocKeys(): Set<string> {
  return new Set(Object.keys(RU_DICTIONARY.trace));
}

describe('Конечный автомат забега Balite (Stage 5B: run.ts + index.ts + locKey)', () => {
  it('инициализирует 4 стартовые колоды с точными параметрами и сбрасывает в blind_select через START_RUN', () => {
    const red = createInitialRunState('b_red', 'SEED_RED');
    const blue = createInitialRunState('b_blue', 'SEED_BLUE');
    const yellow = createInitialRunState('b_yellow', 'SEED_YELLOW');
    const black = createInitialRunState('b_black', 'SEED_BLACK');

    expect(red.phase).toBe('blind_select');
    expect(red.ante).toBe(1);
    expect(red.round).toBe(0);
    expect(red.currentBlindIndex).toBe(0);
    expect(red.deck).toHaveLength(52);
    expect(red.drawPileIds).toHaveLength(52);
    expect(red.handIds).toHaveLength(0);
    expect(red.discardPileIds).toHaveLength(0);

    expect(red.maxHands).toBe(4);
    expect(red.maxDiscards).toBe(4);
    expect(red.dollars).toBe(4);

    expect(blue.maxHands).toBe(5);
    expect(blue.maxDiscards).toBe(3);

    expect(yellow.dollars).toBe(14);

    expect(black.maxRelics).toBe(6);
    expect(black.maxHands).toBe(3);

    const restarted = dispatch(
      { ...black, phase: 'game_over', dollars: 999 },
      { type: 'START_RUN', deckId: 'b_yellow', seed: 'NEW_SEED' },
    );
    expect(restarted.nextState.phase).toBe('blind_select');
    expect(restarted.nextState.deckId).toBe('b_yellow');
    expect(restarted.nextState.dollars).toBe(14);
    expect(restarted.events).toContainEqual({
      type: 'PHASE_CHANGED',
      from: 'game_over',
      to: 'blind_select',
    });
  });

  it('корректно обрабатывает SKIP_BLIND с обычными Знаками и цепочкой tag_double + tag_charm -> 2 бесплатных Мега-набора Свитков', () => {
    const base = createInitialRunState('b_red', 'SKIP_TEST');
    const withDoubleAndCharmTags: RunState = {
      ...base,
      anteBlinds: [
        { ...base.anteBlinds[0], skipTagId: 'tag_double' },
        { ...base.anteBlinds[1], skipTagId: 'tag_charm' },
        base.anteBlinds[2],
      ],
    };

    // Босса пропускать нельзя
    const bossSkipAttempt = dispatch(
      { ...withDoubleAndCharmTags, currentBlindIndex: 2 },
      { type: 'SKIP_BLIND' },
    );
    expect(bossSkipAttempt.nextState.currentBlindIndex).toBe(2);
    expect(bossSkipAttempt.events).toEqual([]);

    // Пропуск Малого Стража даёт tag_double
    const step1 = dispatch(withDoubleAndCharmTags, { type: 'SKIP_BLIND' });
    expect(step1.nextState.phase).toBe('blind_select');
    expect(step1.nextState.currentBlindIndex).toBe(1);
    expect(step1.nextState.skipsCount).toBe(1);
    expect(step1.nextState.anteBlinds[0].status).toBe('skipped');
    expect(step1.nextState.pendingTags).toContain('tag_double');

    // Пропуск Старшего Стража с tag_charm активирует tag_double -> 2 бесплатных Мега-набора Свитков подряд
    const step2 = dispatch(step1.nextState, { type: 'SKIP_BLIND' });
    expect(step2.nextState.phase).toBe('booster');
    expect(step2.nextState.previousPhase).toBe('blind_select');
    expect(step2.nextState.currentBlindIndex).toBe(2);
    expect(step2.nextState.booster).not.toBeNull();
    expect(step2.nextState.booster?.packId).toBe('p_arcana_mega');
    expect(step2.nextState.booster?.fromTag).toBe(true);
    expect(step2.nextState.booster?.remainingPicks).toBe(2);
    expect(step2.nextState.booster?.drawnHandCardIds).toHaveLength(step2.nextState.handSize);

    // Пропуск первого бесплатного набора сразу открывает второй бесплатный набор
    const afterFirstSkip = dispatch(step2.nextState, { type: 'SKIP_BOOSTER' });
    expect(afterFirstSkip.nextState.phase).toBe('booster');
    expect(afterFirstSkip.nextState.previousPhase).toBe('blind_select');
    expect(afterFirstSkip.nextState.booster?.packId).toBe('p_arcana_mega');
    expect(afterFirstSkip.nextState.booster?.fromTag).toBe(true);

    // Пропуск второго бесплатного набора возвращает на blind_select
    const afterSecondSkip = dispatch(afterFirstSkip.nextState, { type: 'SKIP_BOOSTER' });
    expect(afterSecondSkip.nextState.phase).toBe('blind_select');
    expect(afterSecondSkip.nextState.previousPhase).toBeNull();
    expect(afterSecondSkip.nextState.booster).toBeNull();
    expect(afterSecondSkip.events).toContainEqual({
      type: 'PHASE_CHANGED',
      from: 'booster',
      to: 'blind_select',
    });
  });

  it('SELECT_BLIND активирует onBlindSelect (j_ceremonial), tag_juggle и не удваивает handSize при победе над bl_manacle', () => {
    const base = createInitialRunState('b_red', 'MANACLE_CEREMONIAL');
    const ceremonial = createRelicInstance('j_ceremonial', 'relic_c', 'base');
    const victim = createRelicInstance('j_joker', 'relic_v', 'base');

    const bossManacleState: RunState = {
      ...base,
      currentBlindIndex: 2,
      anteBlinds: [
        { ...base.anteBlinds[0], status: 'defeated' },
        { ...base.anteBlinds[1], status: 'defeated' },
        {
          kind: 'boss',
          bossId: 'bl_manacle',
          targetScore: 10,
          reward: 5,
          status: 'upcoming',
          skipTagId: null,
        },
      ],
      targetScore: 10,
      tempHandSizeBonus: 3, // как от tag_juggle
      relics: [ceremonial, victim],
    };

    const selected = dispatch(bossManacleState, { type: 'SELECT_BLIND' });
    expect(selected.nextState.phase).toBe('playing');
    expect(selected.nextState.round).toBe(1);
    // handSize 8 - 1 (bl_manacle) = 7, при этом в руку набрано 7 + 3 (tag_juggle) = 10 карт
    expect(selected.nextState.handSize).toBe(7);
    expect(selected.nextState.handIds).toHaveLength(10);
    // Ритуальный кинжал уничтожил соседа справа и получил 2 * sellValue к mult
    expect(selected.nextState.relics).toHaveLength(1);
    expect(selected.nextState.relics[0]?.id).toBe('j_ceremonial');
    expect(selected.nextState.relics[0]?.state.mult).toBe(victim.sellValue * 2);
    expect(selected.events.some((e) => e.type === 'RELIC_DESTROYED' && e.reason === 'ceremonial')).toBe(
      true,
    );

    // Побеждаем bl_manacle: handSize должен вернуться ровно к исходным 8 (а не 9!), а tempHandSizeBonus сброситься к 0
    const played = dispatch(selected.nextState, {
      type: 'PLAY_HAND',
      cardIds: [selected.nextState.handIds[0]!],
    });
    expect(played.nextState.phase).toBe('cashout');
    expect(played.nextState.handSize).toBe(8);
    expect(played.nextState.tempHandSizeBonus).toBe(0);
    expect(played.nextState.anteBlinds[2].status).toBe('defeated');
  });

  it('DISCARD_CARDS соблюдает bl_water, bl_final_bell, Лиловую печать, onDiscard (j_ramen) и добирает руку', () => {
    const base = createInitialRunState('b_red', 'DISCARD_TEST');
    const selected = dispatch(base, { type: 'SELECT_BLIND' }).nextState;
    const purpleCardId = selected.handIds[0]!;
    const secondCardId = selected.handIds[1]!;

    const prepared: RunState = {
      ...selected,
      deck: selected.deck.map((c) =>
        c.id === purpleCardId
          ? { ...c, seal: 'purple', forcedSelection: true }
          : c,
      ),
      relics: [createRelicInstance('j_ramen', 'relic_ramen', 'base')],
      anteBlinds: [
        selected.anteBlinds[0],
        selected.anteBlinds[1],
        {
          kind: 'boss',
          bossId: 'bl_final_bell',
          targetScore: 1000,
          reward: 8,
          status: 'current',
          skipTagId: null,
        },
      ],
      currentBlindIndex: 2,
    };

    // Попытка сбросить без принудительно выделенной карты на bl_final_bell отклоняется
    const blocked = dispatch(prepared, {
      type: 'DISCARD_CARDS',
      cardIds: [secondCardId],
    });
    expect(blocked.nextState.discardsLeft).toBe(prepared.discardsLeft);

    // Сброс с принудительной картой разрешён, создаёт Свиток и убавляет xMult у Лапши быстрого приготовления
    const discarded = dispatch(prepared, {
      type: 'DISCARD_CARDS',
      cardIds: [purpleCardId, secondCardId],
    });
    expect(discarded.nextState.discardsLeft).toBe(prepared.discardsLeft - 1);
    expect(discarded.nextState.stats.discardsUsed).toBe(1);
    expect(discarded.nextState.handIds).toHaveLength(prepared.handSize);
    expect(discarded.nextState.consumables).toHaveLength(1);
    expect(discarded.nextState.consumables[0]?.kind).toBe('scroll');
    expect(discarded.nextState.relics[0]?.state.xMult).toBe(1.98);
    expect(discarded.nextState.deck.find((c) => c.id === purpleCardId)?.forcedSelection).toBe(false);
    // Для bl_final_bell в оставшейся руке выбрана новая принудительная карта
    const newHandSet = new Set(discarded.nextState.handIds);
    expect(
      discarded.nextState.deck.some((c) => newHandSet.has(c.id) && c.forcedSelection),
    ).toBe(true);
  });

  it('поддерживает SORT_HAND, REORDER_HAND, REORDER_RELICS, REORDER_CONSUMABLES и игнорирует некорректные перестановки', () => {
    const base = createInitialRunState('b_red', 'SORT_REORDER');
    const selected = dispatch(base, { type: 'SELECT_BLIND' }).nextState;
    const withItems: RunState = {
      ...selected,
      relics: [
        createRelicInstance('j_joker', 'r1', 'base'),
        createRelicInstance('j_blueprint', 'r2', 'base'),
      ],
      consumables: [
        createConsumableInstance('c_mercury', 'c1', 'base'),
        createConsumableInstance('c_venus', 'c2', 'base'),
      ],
    };

    const sortedRank = dispatch(withItems, { type: 'SORT_HAND', by: 'rank' }).nextState;
    const cardMap = new Map(sortedRank.deck.map((c) => [c.id, c]));
    for (let i = 1; i < sortedRank.handIds.length; i += 1) {
      const prev = cardMap.get(sortedRank.handIds[i - 1]!)!;
      const cur = cardMap.get(sortedRank.handIds[i]!)!;
      expect(prev.rank >= cur.rank).toBe(true);
    }

    const sortedSuit = dispatch(sortedRank, { type: 'SORT_HAND', by: 'suit' }).nextState;
    expect(sortedSuit.handIds).toHaveLength(withItems.handIds.length);

    // Перестановка карт с дубликатом должна отклоняться
    const invalidHandReorder = dispatch(sortedSuit, {
      type: 'REORDER_HAND',
      cardIds: [sortedSuit.handIds[0]!, sortedSuit.handIds[0]!],
    });
    expect(invalidHandReorder.nextState.handIds).toEqual(sortedSuit.handIds);

    const reversedHand = [...sortedSuit.handIds].reverse();
    const validHandReorder = dispatch(sortedSuit, {
      type: 'REORDER_HAND',
      cardIds: reversedHand,
    });
    expect(validHandReorder.nextState.handIds).toEqual(reversedHand);

    const reorderedRelics = dispatch(validHandReorder.nextState, {
      type: 'REORDER_RELICS',
      relicUids: ['r2', 'r1'],
    });
    expect(reorderedRelics.nextState.relics.map((r) => r.uid)).toEqual(['r2', 'r1']);

    const reorderedCons = dispatch(reorderedRelics.nextState, {
      type: 'REORDER_CONSUMABLES',
      consumableUids: ['c2', 'c1'],
    });
    expect(reorderedCons.nextState.consumables.map((c) => c.uid)).toEqual(['c2', 'c1']);
  });

  it('полный экономический цикл: cashout -> магазин -> реролл с j_flash -> грамота -> бустер -> сохранение грамоты в рамках Этапа и обновление после Босса', () => {
    const start = createInitialRunState('b_yellow', 'ECON_LOOP');
    // Делаем Малый Страж легко побеждаемым за 1 руку и даём 1 реликвию j_flash
    const flash = createRelicInstance('j_flash', 'relic_flash', 'base');
    const smallSetup: RunState = {
      ...start,
      dollars: 30,
      relics: [flash],
      anteBlinds: [
        { ...start.anteBlinds[0], targetScore: 1 },
        { ...start.anteBlinds[1], targetScore: 1 },
        { ...start.anteBlinds[2], targetScore: 1 },
      ],
      targetScore: 1,
    };

    const s1 = dispatch(smallSetup, { type: 'SELECT_BLIND' }).nextState;
    const w1 = dispatch(s1, { type: 'PLAY_HAND', cardIds: [s1.handIds[0]!] });
    expect(w1.nextState.phase).toBe('cashout');
    expect(w1.nextState.cashout?.totalReward).toBeGreaterThanOrEqual(3);

    const shop1 = dispatch(w1.nextState, { type: 'CLAIM_CASHOUT' });
    expect(shop1.nextState.phase).toBe('shop');
    expect(shop1.nextState.shop?.packs[0]?.packId).toBe('p_buffoon_normal');
    const ante1CharterUid = shop1.nextState.shop?.voucher?.uid;
    expect(ante1CharterUid).toBeTruthy();

    // Реролл в магазине качает j_flash (+2 Множ)
    const rerolled = dispatch(shop1.nextState, { type: 'REROLL_SHOP' });
    expect(rerolled.nextState.shop?.rerollsUsedThisShop).toBe(1);
    expect(rerolled.nextState.relics[0]?.state.mult).toBe(2);

    // Покупка доступного товара на верхней полке (если есть) и открытие первого бустера
    let afterBuy = rerolled.nextState;
    const firstOffer = afterBuy.shop?.offers.find((o) => !o.sold);
    if (firstOffer) {
      const buyRes = dispatch(afterBuy, {
        type: 'BUY_SHOP_OFFER',
        offerUid: firstOffer.uid,
        useImmediately: false,
      });
      afterBuy = buyRes.nextState;
      expect(afterBuy.shop?.offers.find((o) => o.uid === firstOffer.uid)?.sold).toBe(true);
    }

    // Покупка Грамоты гильдии
    const charterOffer = afterBuy.shop?.voucher;
    expect(charterOffer).not.toBeNull();
    const boughtCharter = dispatch(afterBuy, { type: 'BUY_CHARTER' });
    expect(boughtCharter.nextState.shop?.voucher?.sold).toBe(true);
    expect(boughtCharter.nextState.charters).toContain(charterOffer!.charterId);

    // Открытие бустера Набора Реликвий -> выбор 1 реликвии -> возврат в shop
    const pack = boughtCharter.nextState.shop!.packs[0]!;
    const opened = dispatch(boughtCharter.nextState, {
      type: 'OPEN_PACK',
      packUid: pack.uid,
    });
    expect(opened.nextState.phase).toBe('booster');
    expect(opened.nextState.previousPhase).toBe('shop');

    const pickedChoice = opened.nextState.booster!.choices[0]!;
    const picked = dispatch(opened.nextState, {
      type: 'PICK_BOOSTER_ITEM',
      choiceUid: pickedChoice.uid,
    });
    expect(picked.nextState.phase).toBe('shop');
    expect(picked.nextState.booster).toBeNull();

    // Выход из магазина -> Старший Страж (index 1, тот же Этап 1)
    const toBig = dispatch(picked.nextState, { type: 'NEXT_ROUND' });
    expect(toBig.nextState.phase).toBe('blind_select');
    expect(toBig.nextState.ante).toBe(1);
    expect(toBig.nextState.currentBlindIndex).toBe(1);

    const bigPlay = dispatch(toBig.nextState, { type: 'SELECT_BLIND' }).nextState;
    const bigWin = dispatch(bigPlay, {
      type: 'PLAY_HAND',
      cardIds: bigPlay.handIds.slice(0, 5),
    }).nextState;
    expect(bigWin.phase).toBe('cashout');
    const bigShop = dispatch(bigWin, { type: 'CLAIM_CASHOUT' }).nextState;

    // В магазине после Старшего Стража грамота ТА ЖЕ (и всё ещё sold: true)!
    expect(bigShop.shop?.voucher?.uid).toBe(ante1CharterUid);
    expect(bigShop.shop?.voucher?.sold).toBe(true);

    // Переходим к Боссу Этапа 1, побеждаем его -> в пост-боссовом магазине грамота ОБНОВЛЯЕТСЯ!
    const toBoss = dispatch(bigShop, { type: 'NEXT_ROUND' }).nextState;
    expect(toBoss.currentBlindIndex).toBe(2);
    const bossPlay = dispatch(toBoss, { type: 'SELECT_BLIND' }).nextState;
    const bossWin = dispatch(bossPlay, {
      type: 'PLAY_HAND',
      cardIds: bossPlay.handIds.slice(0, 5),
    }).nextState;
    expect(bossWin.phase).toBe('cashout');
    const postBossShop = dispatch(bossWin, { type: 'CLAIM_CASHOUT' }).nextState;

    expect(postBossShop.shop?.voucher?.uid).not.toBe(ante1CharterUid);
    expect(postBossShop.shop?.voucher?.sold).toBe(false);

    // NEXT_ROUND после пост-боссового магазина переводит на Этап 2 и сохраняет ту же грамоту для Этапа 2
    const postBossVoucherUid = postBossShop.shop?.voucher?.uid;
    const ante2 = dispatch(postBossShop, { type: 'NEXT_ROUND' }).nextState;
    expect(ante2.ante).toBe(2);
    expect(ante2.currentBlindIndex).toBe(0);
    expect(ante2.bossRerollsThisAnte).toBe(0);
    expect(ante2.shop?.voucher?.uid).toBe(postBossVoucherUid);
  });

  it('REROLL_BOSS требует v_directors_cut, списывает 10 з. один раз за Этап и меняет Босса', () => {
    const start = createInitialRunState('b_red', 'DIRECTOR_REROLL');
    const withoutCharter = dispatch({ ...start, dollars: 30 }, { type: 'REROLL_BOSS' });
    expect(withoutCharter.nextState.anteBlinds[2].bossId).toBe(start.anteBlinds[2].bossId);
    expect(withoutCharter.nextState.dollars).toBe(30);

    const withCharter: RunState = {
      ...start,
      dollars: 25,
      charters: ['v_directors_cut'],
    };
    const originalBoss = withCharter.anteBlinds[2].bossId;
    const rerolled = dispatch(withCharter, { type: 'REROLL_BOSS' });
    expect(rerolled.nextState.dollars).toBe(15);
    expect(rerolled.nextState.bossRerollsThisAnte).toBe(1);
    expect(rerolled.nextState.anteBlinds[2].bossId).not.toBe(originalBoss);
    expect(rerolled.events).toContainEqual({
      type: 'DOLLAR_DELTA',
      delta: -10,
      totalDollars: 15,
      source: 'reroll',
    });

    // Второй реролл Босса в том же Этапе запрещён
    const secondTry = dispatch(rerolled.nextState, { type: 'REROLL_BOSS' });
    expect(secondTry.nextState.dollars).toBe(15);
    expect(secondTry.nextState.anteBlinds[2].bossId).toBe(rerolled.nextState.anteBlinds[2].bossId);
  });

  it('поддерживает USE_CONSUMABLE (в т.ч. без таргетов через BUY_SHOP_OFFER useImmediately) и SELL_RELIC / SELL_CONSUMABLE', () => {
    const start = createInitialRunState('b_red', 'SELL_USE');
    const joker = createRelicInstance('j_joker', 'relic_sell', 'base');
    const mercury = createConsumableInstance('c_mercury', 'cons_sell', 'base');

    const withStuff: RunState = {
      ...start,
      dollars: 10,
      relics: [joker],
      consumables: [mercury],
    };

    const used = dispatch(withStuff, {
      type: 'USE_CONSUMABLE',
      consumableUid: 'cons_sell',
    });
    expect(used.nextState.consumables).toHaveLength(0);
    expect(used.nextState.handLevels['Pair'].level).toBe(2);

    const soldRelic = dispatch(used.nextState, {
      type: 'SELL_RELIC',
      relicUid: 'relic_sell',
    });
    expect(soldRelic.nextState.relics).toHaveLength(0);
    expect(soldRelic.nextState.dollars).toBe(10 + joker.sellValue);
    expect(soldRelic.events).toContainEqual({
      type: 'RELIC_DESTROYED',
      relicUid: 'relic_sell',
      relicId: 'j_joker',
      reason: 'sold',
    });

    const withAnotherCons: RunState = {
      ...soldRelic.nextState,
      consumables: [createConsumableInstance('c_venus', 'cons_2', 'base')],
    };
    const soldCons = dispatch(withAnotherCons, {
      type: 'SELL_CONSUMABLE',
      consumableUid: 'cons_2',
    });
    expect(soldCons.nextState.consumables).toHaveLength(0);
    expect(soldCons.nextState.dollars).toBe(withAnotherCons.dollars + 1);

    // Покупка с немедленным применением при заполненных слотах расходников
    const mercCons = createConsumableInstance('c_mercury', 'cons_shop_merc', 'base');
    const empressCons = createConsumableInstance('c_empress', 'cons_shop_emp', 'base');
    const shopState: RunState = {
      ...soldCons.nextState,
      phase: 'shop',
      dollars: 20,
      consumables: [
        createConsumableInstance('c_venus', 'c_full_1', 'base'),
        createConsumableInstance('c_earth', 'c_full_2', 'base'),
      ],
      shop: {
        offers: [
          {
            uid: 'offer_merc',
            kind: 'consumable',
            consumable: mercCons,
            cost: 3,
            baseCost: 3,
            sold: false,
          },
          {
            uid: 'offer_emp',
            kind: 'consumable',
            consumable: empressCons,
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
    };

    const buyUseMerc = dispatch(shopState, {
      type: 'BUY_SHOP_OFFER',
      offerUid: 'offer_merc',
      useImmediately: true,
    });
    expect(buyUseMerc.nextState.dollars).toBe(17);
    expect(buyUseMerc.nextState.handLevels['Pair'].level).toBe(3);
    expect(buyUseMerc.nextState.shop?.offers[0]?.sold).toBe(true);

    // Свиток, требующий выбора карт, не может быть применён сразу в магазине без руки
    const rejectedEmp = dispatch(buyUseMerc.nextState, {
      type: 'BUY_SHOP_OFFER',
      offerUid: 'offer_emp',
      useImmediately: true,
    });
    expect(rejectedEmp.nextState.dollars).toBe(17);
    expect(rejectedEmp.nextState.shop?.offers[1]?.sold).toBe(false);
  });

  it('победа на Боссе 8 Этапа переводит в victory (RUN_WON), CONTINUE_ENDLESS ведёт в cashout -> shop -> Этап 9', () => {
    const base = createInitialRunState('b_red', 'ANTE8_WIN');
    const ante8Setup: RunState = {
      ...base,
      ante: 8,
      currentBlindIndex: 2,
      anteBlinds: [
        { ...base.anteBlinds[0], status: 'defeated' },
        { ...base.anteBlinds[1], status: 'defeated' },
        {
          kind: 'boss',
          bossId: 'bl_final_vessel',
          targetScore: 10,
          reward: 8,
          status: 'upcoming',
          skipTagId: null,
        },
      ],
      targetScore: 10,
    };

    const selected = dispatch(ante8Setup, { type: 'SELECT_BLIND' }).nextState;
    const won = dispatch(selected, {
      type: 'PLAY_HAND',
      cardIds: [selected.handIds[0]!],
    });
    expect(won.nextState.phase).toBe('victory');
    expect(won.events.some((e) => e.type === 'RUN_WON' && e.ante === 8)).toBe(true);

    // Игровые команды в победной фазе (кроме START_RUN / CONTINUE_ENDLESS) не изменяют состояние
    const ignored = dispatch(won.nextState, { type: 'SKIP_BLIND' });
    expect(ignored.nextState).toBe(won.nextState);

    const endless = dispatch(won.nextState, { type: 'CONTINUE_ENDLESS' });
    expect(endless.nextState.endlessMode).toBe(true);
    expect(endless.nextState.phase).toBe('cashout');

    const shop9 = dispatch(endless.nextState, { type: 'CLAIM_CASHOUT' }).nextState;
    const ante9 = dispatch(shop9, { type: 'NEXT_ROUND' }).nextState;
    expect(ante9.ante).toBe(9);
    expect(ante9.endlessMode).toBe(true);
    expect(ante9.phase).toBe('blind_select');
    expect(ante9.anteBlinds[0].targetScore).toBeGreaterThan(50000);
  });

  it('поражение при handsLeft === 0 и недоборе targetScore переводит в game_over (RUN_LOST)', () => {
    const base = createInitialRunState('b_red', 'GAME_OVER');
    const lowTarget: RunState = {
      ...base,
      maxHands: 1,
      handsLeft: 1,
      anteBlinds: [
        { ...base.anteBlinds[0], targetScore: 999999999 },
        base.anteBlinds[1],
        base.anteBlinds[2],
      ],
      targetScore: 999999999,
    };

    const playing = dispatch(lowTarget, { type: 'SELECT_BLIND' }).nextState;
    const lost = dispatch(playing, {
      type: 'PLAY_HAND',
      cardIds: [playing.handIds[0]!],
    });
    expect(lost.nextState.phase).toBe('game_over');
    expect(lost.events.some((e) => e.type === 'RUN_LOST' && e.ante === 1)).toBe(true);

    // Повторные действия после поражения (кроме START_RUN) игнорируются
    const locked = dispatch(lost.nextState, { type: 'CLAIM_CASHOUT' });
    expect(locked.nextState.phase).toBe('game_over');
  });

  it('детерминизм и эквивалентность после serializeRunStateToSnapshot -> restoreRunStateFromSnapshot', () => {
    const initA = createInitialRunState('b_blue', 'DETERMINISM_42');
    const initB = createInitialRunState('b_blue', 'DETERMINISM_42');
    expect(initA).toEqual(initB);

    const step1A = runCommands(initA, [
      { type: 'SELECT_BLIND' },
      { type: 'SORT_HAND', by: 'rank' },
    ]);
    const playId = step1A.state.handIds[0]!;
    const discardId = step1A.state.handIds[1]!;

    // Снимаем сериализованный JSON-снимок в середине боя
    const snapshot = serializeRunStateToSnapshot(step1A.state, 1, 1700000000000);
    const jsonRoundTrip = JSON.parse(JSON.stringify(snapshot));
    const restored = restoreRunStateFromSnapshot(jsonRoundTrip);

    const tailCommands: GameCommand[] = [
      { type: 'DISCARD_CARDS', cardIds: [discardId] },
      { type: 'PLAY_HAND', cardIds: [playId] },
    ];

    const fromOriginal = runCommands(step1A.state, tailCommands);
    const fromRestored = runCommands(restored, tailCommands);

    expect(fromRestored.state).toEqual(fromOriginal.state);
    expect(fromRestored.events).toEqual(fromOriginal.events);
  });

  it('все locKey из scoring.ts и run.ts строго соответствуют TraceLocKey в RU/EN словарях', () => {
    const validKeys = getValidTraceLocKeys();
    const enKeys = new Set(Object.keys(EN_DICTIONARY.trace));
    expect(validKeys).toEqual(enKeys);

    const base = createInitialRunState('b_red', 'LOCKEY_AUDIT');
    const handCards: PlayingCard[] = [
      createPlayingCard({ id: 'lk_1', suit: 'hearts', rank: 14, enhancement: 'steel', seal: 'purple' }),
      createPlayingCard({ id: 'lk_2', suit: 'spades', rank: 13, enhancement: 'gold', seal: 'blue' }),
      createPlayingCard({ id: 'lk_3', suit: 'diamonds', rank: 10 }),
      createPlayingCard({ id: 'lk_4', suit: 'clubs', rank: 9 }),
      createPlayingCard({ id: 'lk_5', suit: 'hearts', rank: 8 }),
    ];

    const testState: RunState = {
      ...base,
      phase: 'playing',
      score: 100,
      targetScore: 100,
      currentBlindIndex: 2,
      anteBlinds: [
        { ...base.anteBlinds[0], status: 'defeated' },
        { ...base.anteBlinds[1], status: 'defeated' },
        {
          kind: 'boss',
          bossId: 'bl_hook',
          targetScore: 100,
          reward: 5,
          status: 'current',
          skipTagId: null,
        },
      ],
      deck: handCards,
      handIds: handCards.map((c) => c.id),
      drawPileIds: [],
      discardPileIds: [],
      relics: [
        createRelicInstance('j_joker', 'rj1', 'foil'),
        createRelicInstance('j_jolly', 'rj2', 'holo'),
        createRelicInstance('j_sly', 'rj3', 'polychrome'),
        createRelicInstance('j_sock_and_buskin', 'rj4', 'base'),
        createRelicInstance('j_mime', 'rj5', 'base'),
      ],
      consumables: [createConsumableInstance('c_mercury', 'cm1', 'base')],
      charters: ['v_observatory'],
      pendingTags: ['tag_investment'],
    };

    const collectedEvents: TraceEvent[] = [];

    // 1) Проверка срабатываний в evaluatePlay (bl_hook, фиолетовая печать, ретриггер, steel, foil/holo/polychrome, observatory)
    const playRes1: DispatchResult = evaluatePlay(testState, ['lk_2'], {
      relicRegistry: getRelicDefinition,
      resolveRelicTarget,
    });
    collectedEvents.push(...playRes1.events);

    // 2) Проверка bl_psychic и bl_flint
    const psychicState: RunState = {
      ...testState,
      anteBlinds: [
        testState.anteBlinds[0],
        testState.anteBlinds[1],
        {
          kind: 'boss',
          bossId: 'bl_psychic',
          targetScore: 100,
          reward: 5,
          status: 'current',
          skipTagId: null,
        },
      ],
    };
    collectedEvents.push(
      ...evaluatePlay(psychicState, ['lk_2'], {
        relicRegistry: getRelicDefinition,
        resolveRelicTarget,
      }).events,
    );

    const flintState: RunState = {
      ...testState,
      anteBlinds: [
        testState.anteBlinds[0],
        testState.anteBlinds[1],
        {
          kind: 'boss',
          bossId: 'bl_flint',
          targetScore: 100,
          reward: 5,
          status: 'current',
          skipTagId: null,
        },
      ],
    };
    collectedEvents.push(
      ...evaluatePlay(flintState, ['lk_3'], {
        relicRegistry: getRelicDefinition,
        resolveRelicTarget,
      }).events,
    );

    // 3) Проверка evaluateRoundEnd (gold, blue seal, retrigger, tag_investment)
    const roundEndRes = evaluateRoundEnd(
      { ...testState, lastPlayedHandType: CELESTIAL_HAND_MAP['c_mercury'] },
      { relicRegistry: getRelicDefinition, resolveRelicTarget },
    );
    collectedEvents.push(...roundEndRes.events);

    for (const event of collectedEvents) {
      if ('locKey' in event && event.locKey !== undefined) {
        expect(validKeys.has(event.locKey), `Неизвестный locKey: ${event.locKey}`).toBe(true);
      }
    }
  });
});
