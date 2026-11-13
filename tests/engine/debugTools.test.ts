// Тесты чистых функций отладочных мутаций RunState для Админ-панели (Эпик 3).
import { describe, expect, it } from 'vitest';
import {
  applyDebugCardMods,
  applyDebugVoucher,
  createInitialRunState,
  dispatch,
  forceDebugBlindWin,
  forceDebugRunEnd,
  giveDebugConsumable,
  giveDebugRelic,
  setDebugResources,
  type RunState,
} from '../../src/engine';

function createPlayingState(seed = 'DEBUG-SEED'): RunState {
  const initial = createInitialRunState('b_red', seed);
  return dispatch(initial, { type: 'SELECT_BLIND' }).nextState;
}

describe('debugTools', () => {
  it('applyDebugCardMods изменяет выбранные карты, первую карту при пустом списке и всю руку при "all"', () => {
    const state = createPlayingState();
    const firstId = state.handIds[0];
    const secondId = state.handIds[1];
    const thirdId = state.handIds[2];

    // Пустой cardIds -> модифицируется первая карта в руке
    const firstModded = applyDebugCardMods(state, {
      cardIds: [],
      enhancement: 'glass',
      edition: 'foil',
    });
    expect(firstModded).not.toBe(state);
    expect(firstModded.deck.find((c) => c.id === firstId)?.enhancement).toBe('glass');
    expect(firstModded.deck.find((c) => c.id === firstId)?.edition).toBe('foil');
    expect(firstModded.deck.find((c) => c.id === secondId)?.enhancement).toBe('none');

    // Явные cardIds -> только указанные карты в руке
    const targetModded = applyDebugCardMods(firstModded, {
      cardIds: [secondId],
      seal: 'red',
    });
    expect(targetModded.deck.find((c) => c.id === secondId)?.seal).toBe('red');
    expect(targetModded.deck.find((c) => c.id === thirdId)?.seal).toBe('none');

    // 'all' -> вся текущая рука
    const allModded = applyDebugCardMods(targetModded, {
      cardIds: 'all',
      edition: 'polychrome',
    });
    for (const id of allModded.handIds) {
      expect(allModded.deck.find((c) => c.id === id)?.edition).toBe('polychrome');
    }
    // Карты не в руке не затронуты
    const outOfHandId = allModded.drawPileIds[0];
    expect(allModded.deck.find((c) => c.id === outOfHandId)?.edition).toBe('base');
  });

  it('giveDebugRelic выдаёт реликвию, расширяет maxRelics при переполнении и учитывает +1 слот для negative', () => {
    let state = createPlayingState();
    expect(state.maxRelics).toBe(5);

    // 5 базовых реликвий помещаются в maxRelics = 5
    for (let i = 0; i < 5; i++) {
      state = giveDebugRelic(state, 'j_joker', 'base');
    }
    expect(state.relics).toHaveLength(5);
    expect(state.maxRelics).toBe(5);

    // Negative даёт +1 эффективный слот и не требует увеличивать maxRelics
    state = giveDebugRelic(state, 'j_greedy_joker', 'negative');
    expect(state.relics).toHaveLength(6);
    expect(state.relics[5].edition).toBe('negative');
    expect(state.maxRelics).toBe(5);

    // 7-я не-negative реликвия безопасно расширяет maxRelics до 6 (+1 negative = 7 слотов)
    state = giveDebugRelic(state, 'j_lusty_joker', 'polychrome');
    expect(state.relics).toHaveLength(7);
    expect(state.relics[6].edition).toBe('polychrome');
    expect(state.maxRelics).toBe(6);
  });

  it('giveDebugConsumable добавляет расходники и расширяет maxConsumables при переполнении', () => {
    let state = createPlayingState();
    expect(state.maxConsumables).toBe(2);

    state = giveDebugConsumable(state, 'c_mercury');
    state = giveDebugConsumable(state, 'c_fool', 'foil');
    expect(state.consumables).toHaveLength(2);
    expect(state.maxConsumables).toBe(2);
    expect(state.consumables[1].edition).toBe('foil');

    state = giveDebugConsumable(state, 'c_aura');
    expect(state.consumables).toHaveLength(3);
    expect(state.maxConsumables).toBe(3);
  });

  it('applyDebugVoucher применяет грамоту через механику каталога и идемпотентен при повторе', () => {
    const state = createPlayingState();
    const withGrabber = applyDebugVoucher(state, 'v_grabber');
    expect(withGrabber.charters).toContain('v_grabber');
    expect(withGrabber.maxHands).toBe(state.maxHands + 1);
    expect(withGrabber.handsLeft).toBe(state.handsLeft + 1);

    const repeat = applyDebugVoucher(withGrabber, 'v_grabber');
    expect(repeat.maxHands).toBe(withGrabber.maxHands);
  });

  it('setDebugResources меняет деньги, руки, сбросы, анте 1..8, очки и % от порога', () => {
    const state = createPlayingState();
    const boosted = setDebugResources(state, {
      addDollars: 100,
      addHands: 2,
      addDiscards: 3,
      setAnte: 8,
      targetPercent: 50,
    });

    expect(boosted.dollars).toBe(state.dollars + 100);
    expect(boosted.handsLeft).toBe(state.handsLeft + 2);
    expect(boosted.discardsLeft).toBe(state.discardsLeft + 3);
    expect(boosted.ante).toBe(8);
    expect(boosted.currentBlindIndex).toBe(0);
    expect(boosted.targetScore).toBe(boosted.anteBlinds[0].targetScore);
    expect(boosted.score).toBe(Math.round(boosted.targetScore * 0.5));

    // Пробитие 100% цели + addScore
    const thresholdReached = setDebugResources(boosted, {
      targetPercent: 100,
      addScore: 25,
    });
    expect(thresholdReached.score).toBe(boosted.targetScore + 25);

    // Ограничение диапазона Анте [1..8]
    expect(setDebugResources(state, { setAnte: 99 }).ante).toBe(8);
    expect(setDebugResources(state, { setAnte: -2 }).ante).toBe(1);
  });

  it('forceDebugBlindWin переводит в cashout с порогом и детализацией выплаты', () => {
    const state = createPlayingState();
    const won = forceDebugBlindWin(state);

    expect(won.phase).toBe('cashout');
    expect(won.score).toBeGreaterThanOrEqual(won.targetScore);
    expect(won.cashout).not.toBeNull();
    expect(won.cashout?.blindReward).toBe(state.anteBlinds[state.currentBlindIndex].reward);
    expect(won.anteBlinds[state.currentBlindIndex].status).toBe('defeated');
  });

  it('forceDebugRunEnd переводит в victory или game_over', () => {
    const state = createPlayingState();
    const victory = forceDebugRunEnd(state, 'victory');
    expect(victory.phase).toBe('victory');
    expect(victory.score).toBeGreaterThanOrEqual(victory.targetScore);
    expect(victory.cashout).toBeNull();

    const defeat = forceDebugRunEnd(state, 'game_over');
    expect(defeat.phase).toBe('game_over');
    expect(defeat.cashout).toBeNull();
  });
});
