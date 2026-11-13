import type { DeckId, PlayingCard, Rank, RunState, Suit } from './types';

/**
 * Режим отображения окна состава колоды: оставшаяся стопка добора или полная колода забега.
 */
export type DeckViewMode = 'remaining' | 'full';

/**
 * Текущее расположение карты в стопках забега.
 */
export type DeckCardLocation = 'draw' | 'hand' | 'discard';

/**
 * Запись карты для отображения в подробном окне колоды.
 */
export interface DeckViewCardEntry {
  readonly card: PlayingCard;
  readonly inDrawPile: boolean;
  readonly location: DeckCardLocation;
}

/**
 * Счётчик количества карт для одного ранга в боковой сводке.
 */
export interface DeckRankCount {
  readonly rank: Rank;
  readonly count: number;
}

/**
 * Горизонтальный ряд карт одной масти (от Туза к Двойке).
 */
export interface DeckSuitRow {
  readonly suit: Suit;
  readonly count: number;
  readonly cards: readonly DeckViewCardEntry[];
}

/**
 * Сводная статистика «Базовые карты» для выбранного режима колоды.
 */
export interface DeckViewSummary {
  readonly totalCount: number;
  readonly aces: number;
  readonly faces: number;
  readonly numbers: number;
  readonly stoneCount: number;
  readonly suits: Readonly<Record<Suit, number>>;
  readonly rankCounts: readonly DeckRankCount[];
}

/**
 * Полная модель данных для отрисовки подробного окна Колоды.
 */
export interface DeckViewModel {
  readonly mode: DeckViewMode;
  readonly deckId: DeckId;
  readonly totalCount: number;
  readonly remainingCount: number;
  readonly fullCount: number;
  readonly summary: DeckViewSummary;
  readonly suitRows: readonly DeckSuitRow[];
  readonly stoneCards: readonly DeckViewCardEntry[];
}

/**
 * Порядок рангов в вертикальном списке и внутри рядов мастей: от Туза (14) к Двойке (2).
 */
export const DECK_VIEW_RANK_ORDER: readonly Rank[] = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Порядок 4 рядов мастей сверху вниз (Пики, Червы, Трефы, Бубны).
 */
export const DECK_VIEW_SUIT_ORDER: readonly Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

/**
 * Определяет расположение карты среди стопок забега без раскрытия порядка тасования.
 */
function resolveCardLocations(state: RunState): ReadonlyMap<string, DeckCardLocation> {
  const locations = new Map<string, DeckCardLocation>();
  for (const id of state.discardPileIds) {
    locations.set(id, 'discard');
  }
  for (const id of state.handIds) {
    locations.set(id, 'hand');
  }
  for (const id of state.drawPileIds) {
    locations.set(id, 'draw');
  }
  return locations;
}

/**
 * Детерминированно сортирует записи карт по убыванию ранга (от Туза к 2) и по id.
 */
function compareDeckEntries(a: DeckViewCardEntry, b: DeckViewCardEntry): number {
  if (a.card.rank !== b.card.rank) {
    return b.card.rank - a.card.rank;
  }
  if (a.card.id === b.card.id) return 0;
  return a.card.id < b.card.id ? -1 : 1;
}

/**
 * Строит чистую модель данных для подробного окна просмотра колоды в режиме `'remaining'` или `'full'`.
 */
export function buildDeckViewModel(
  state: RunState,
  mode: DeckViewMode = 'remaining',
): DeckViewModel {
  const locations = resolveCardLocations(state);
  const entries: DeckViewCardEntry[] = [];

  for (const card of state.deck) {
    const location = locations.get(card.id) ?? 'discard';
    const inDrawPile = location === 'draw';
    if (mode === 'remaining' && !inDrawPile) {
      continue;
    }
    entries.push({ card, inDrawPile, location });
  }

  const suitsCount: Record<Suit, number> = {
    spades: 0,
    hearts: 0,
    clubs: 0,
    diamonds: 0,
  };
  const rankMap = new Map<Rank, number>(DECK_VIEW_RANK_ORDER.map((rank) => [rank, 0]));
  const rowsBySuit: Record<Suit, DeckViewCardEntry[]> = {
    spades: [],
    hearts: [],
    clubs: [],
    diamonds: [],
  };
  const stoneCards: DeckViewCardEntry[] = [];

  let aces = 0;
  let faces = 0;
  let numbers = 0;

  for (const entry of entries) {
    const { card } = entry;
    if (card.enhancement === 'stone') {
      stoneCards.push(entry);
      continue;
    }

    suitsCount[card.suit] += 1;
    rowsBySuit[card.suit].push(entry);
    rankMap.set(card.rank, (rankMap.get(card.rank) ?? 0) + 1);

    if (card.rank === 14) {
      aces += 1;
    } else if (card.rank >= 11 && card.rank <= 13) {
      faces += 1;
    } else {
      numbers += 1;
    }
  }

  stoneCards.sort(compareDeckEntries);

  const suitRows: DeckSuitRow[] = DECK_VIEW_SUIT_ORDER.map((suit) => {
    const cards = [...rowsBySuit[suit]].sort(compareDeckEntries);
    return {
      suit,
      count: cards.length,
      cards,
    };
  });

  const rankCounts: DeckRankCount[] = DECK_VIEW_RANK_ORDER.map((rank) => ({
    rank,
    count: rankMap.get(rank) ?? 0,
  }));

  return {
    mode,
    deckId: state.deckId,
    totalCount: entries.length,
    remainingCount: state.drawPileIds.length,
    fullCount: state.deck.length,
    summary: {
      totalCount: entries.length,
      aces,
      faces,
      numbers,
      stoneCount: stoneCards.length,
      suits: suitsCount,
      rankCounts,
    },
    suitRows,
    stoneCards,
  };
}
