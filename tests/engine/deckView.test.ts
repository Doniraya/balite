import { describe, expect, it } from 'vitest';
import { createPlayingCard } from '../../src/engine/cards';
import {
  buildDeckViewModel,
  DECK_VIEW_RANK_ORDER,
  DECK_VIEW_SUIT_ORDER,
} from '../../src/engine/deckView';
import { createInitialRunState, dispatch } from '../../src/engine/run';
import type { PlayingCard, RunState } from '../../src/engine/types';

/**
 * Создаёт детерминированный RunState и доводит его до фазы боя (playing),
 * где колода разделена между drawPileIds и handIds.
 */
function createPlayingRunState(seed = 'DECKVIEW1'): RunState {
  const initial = createInitialRunState('b_red', seed);
  const entered = dispatch(initial, { type: 'SELECT_BLIND' });
  return entered.nextState;
}

describe('buildDeckViewModel (модель данных подробного окна Колоды)', () => {
  it('строит полную сводку и 4 ряда мастей (A -> 2) для стандартной 52-карточной колоды в режиме full', () => {
    const state = createPlayingRunState('FULLDECK1');
    const snapshotDrawOrder = [...state.drawPileIds];

    const view = buildDeckViewModel(state, 'full');

    expect(view.mode).toBe('full');
    expect(view.deckId).toBe('b_red');
    expect(view.fullCount).toBe(52);
    expect(view.remainingCount).toBe(state.drawPileIds.length);
    expect(view.totalCount).toBe(52);

    // Сводка «Базовые карты» как на эталоне: 4 Туза, 12 фигур, 36 числовых, по 13 каждой масти
    expect(view.summary.totalCount).toBe(52);
    expect(view.summary.aces).toBe(4);
    expect(view.summary.faces).toBe(12);
    expect(view.summary.numbers).toBe(36);
    expect(view.summary.stoneCount).toBe(0);
    expect(view.summary.suits).toEqual({
      spades: 13,
      hearts: 13,
      clubs: 13,
      diamonds: 13,
    });

    // Вертикальный список рангов строго A..2 (14..2), по 4 карты каждого ранга
    expect(view.summary.rankCounts.map((entry) => entry.rank)).toEqual(DECK_VIEW_RANK_ORDER);
    for (const rankEntry of view.summary.rankCounts) {
      expect(rankEntry.count).toBe(4);
    }

    // 4 ряда мастей в порядке Пики, Червы, Трефы, Бубны, каждый отсортирован от Туза к 2
    expect(view.suitRows.map((row) => row.suit)).toEqual(DECK_VIEW_SUIT_ORDER);
    for (const row of view.suitRows) {
      expect(row.cards).toHaveLength(13);
      expect(row.count).toBe(13);
      expect(row.cards.map((entry) => entry.card.rank)).toEqual(DECK_VIEW_RANK_ORDER);
    }

    // Входной RunState не мутируется
    expect(state.drawPileIds).toEqual(snapshotDrawOrder);
  });

  it('в режиме remaining учитывает только карты в drawPileIds и не раскрывает скрытый порядок добора', () => {
    let state = createPlayingRunState('REMDECK1');
    // Сбрасываем 3 карты, чтобы в колоде были карты во всех трёх зонах: draw, hand, discard
    const discardIds = state.handIds.slice(0, 3);
    state = dispatch(state, { type: 'DISCARD_CARDS', cardIds: discardIds }).nextState;

    const remainingView = buildDeckViewModel(state, 'remaining');
    const fullView = buildDeckViewModel(state, 'full');

    expect(remainingView.mode).toBe('remaining');
    expect(remainingView.remainingCount).toBe(state.drawPileIds.length);
    expect(remainingView.totalCount).toBe(state.drawPileIds.length);
    expect(remainingView.totalCount).toBeLessThan(52);

    // Сумма базовых категорий совпадает с количеством карт в стопке добора
    const categorySum =
      remainingView.summary.aces +
      remainingView.summary.faces +
      remainingView.summary.numbers +
      remainingView.summary.stoneCount;
    expect(categorySum).toBe(state.drawPileIds.length);

    // Каждая карта в remainingView принадлежит drawPileIds и упорядочена от Туза к 2
    const drawSet = new Set(state.drawPileIds);
    const renderedIds: string[] = [];
    for (const row of remainingView.suitRows) {
      for (let i = 0; i < row.cards.length; i += 1) {
        const entry = row.cards[i]!;
        expect(drawSet.has(entry.card.id)).toBe(true);
        expect(entry.inDrawPile).toBe(true);
        expect(entry.location).toBe('draw');
        renderedIds.push(entry.card.id);
        if (i > 0) {
          expect(row.cards[i - 1]!.card.rank).toBeGreaterThanOrEqual(entry.card.rank);
        }
      }
    }
    expect(renderedIds).toHaveLength(state.drawPileIds.length);

    // В fullView корректно проставлены location ('draw' | 'hand' | 'discard')
    const locations = new Set(
      fullView.suitRows.flatMap((row) => row.cards.map((entry) => entry.location)),
    );
    expect(locations.has('draw')).toBe(true);
    expect(locations.has('hand')).toBe(true);
    expect(locations.has('discard')).toBe(true);
  });

  it('корректно обрабатывает Каменные (stone), Дикие (wild) и добавленные дубликаты карт', () => {
    const baseState = createPlayingRunState('MODCARDS1');
    const stoneCard: PlayingCard = createPlayingCard({
      id: 'stone_extra_1',
      suit: 'spades',
      rank: 14,
      enhancement: 'stone',
    });
    const wildCard: PlayingCard = createPlayingCard({
      id: 'wild_extra_1',
      suit: 'hearts',
      rank: 13,
      enhancement: 'wild',
    });

    const modifiedState: RunState = {
      ...baseState,
      deck: [...baseState.deck, stoneCard, wildCard],
      drawPileIds: [...baseState.drawPileIds, stoneCard.id, wildCard.id],
    };

    const fullView = buildDeckViewModel(modifiedState, 'full');

    expect(fullView.totalCount).toBe(54);
    expect(fullView.summary.stoneCount).toBe(1);
    expect(fullView.stoneCards.map((entry) => entry.card.id)).toEqual(['stone_extra_1']);
    // Каменная карта не засчитывается в Тузы, масть Пики и счётчик ранга A
    expect(fullView.summary.aces).toBe(4);
    expect(fullView.summary.suits.spades).toBe(13);
    expect(fullView.summary.rankCounts.find((r) => r.rank === 14)?.count).toBe(4);

    // Дикая карта (Король Червей) учитывается как фигура, Черва и Король
    expect(fullView.summary.faces).toBe(13);
    expect(fullView.summary.suits.hearts).toBe(14);
    expect(fullView.summary.rankCounts.find((r) => r.rank === 13)?.count).toBe(5);
    expect(fullView.suitRows.find((row) => row.suit === 'hearts')?.cards).toHaveLength(14);
  });
});
