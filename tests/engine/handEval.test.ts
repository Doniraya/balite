import { describe, expect, it } from 'vitest';
import { createPlayingCard } from '../../src/engine/cards';
import {
  HAND_BASE_CONFIG,
  createInitialHandLevels,
  evaluatePokerHand,
  getBlindAmount,
  getHandLevelStats,
} from '../../src/engine/handEval';
import { HAND_TYPES, type Rank, type Suit } from '../../src/engine/types';

function c(id: string, rank: Rank, suit: Suit, extra: Parameters<typeof createPlayingCard>[0]['enhancement'] = 'none') {
  return createPlayingCard({ id, rank, suit, enhancement: extra });
}

describe('Базовые таблицы раскладов и порогов Стражей (handEval.ts)', () => {
  it('содержит точные значения базовой Силы, Множ, прироста за уровень и скрытости всех 12 раскладов', () => {
    expect(Object.keys(HAND_BASE_CONFIG).sort()).toEqual([...HAND_TYPES].sort());

    expect(getHandLevelStats('Flush Five', 1)).toEqual({ chips: 160, mult: 16 });
    expect(getHandLevelStats('Flush Five', 3)).toEqual({ chips: 260, mult: 22 });
    expect(getHandLevelStats('High Card', 1)).toEqual({ chips: 5, mult: 1 });
    expect(getHandLevelStats('High Card', 4)).toEqual({ chips: 35, mult: 4 });
    expect(getHandLevelStats('Straight', 2)).toEqual({ chips: 60, mult: 7 });

    const levels = createInitialHandLevels();
    expect(levels['Flush Five'].visible).toBe(false);
    expect(levels['Flush House'].visible).toBe(false);
    expect(levels['Five of a Kind'].visible).toBe(false);
    expect(levels['Straight Flush'].visible).toBe(true);
    expect(levels['High Card'].visible).toBe(true);
  });

  it('корректно вычисляет пороги getBlindAmount для Этапов 1..8 и Бесконечного режима 9+', () => {
    expect(getBlindAmount(0)).toBe(100);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((a) => getBlindAmount(a, 1))).toEqual([
      300, 800, 2000, 5000, 11000, 20000, 35000, 50000,
    ]);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((a) => getBlindAmount(a, 2))).toEqual([
      300, 900, 2600, 8000, 20000, 36000, 60000, 100000,
    ]);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((a) => getBlindAmount(a, 3))).toEqual([
      300, 1000, 3200, 9000, 25000, 60000, 110000, 200000,
    ]);

    expect(getBlindAmount(9, 1)).toBe(110000);
    expect(getBlindAmount(10, 1)).toBeGreaterThan(getBlindAmount(9, 1));
    expect(getBlindAmount(12, 1)).toBeGreaterThan(getBlindAmount(10, 1));
  });
});

describe('evaluatePokerHand: все 12 раскладов, модификаторы и матрица вложенности', () => {
  it('распознаёт все 12 раскладов от Flush Five до High Card и выставляет isRoyal', () => {
    const flushFive = evaluatePokerHand([
      c('1', 14, 'spades'),
      c('2', 14, 'spades'),
      c('3', 14, 'spades'),
      c('4', 14, 'spades'),
      c('5', 14, 'spades'),
    ]);
    expect(flushFive.handType).toBe('Flush Five');
    expect(flushFive.scoringCardIds).toHaveLength(5);
    expect(flushFive.containedHands['Five of a Kind']).toBe(true);
    expect(flushFive.containedHands['Four of a Kind']).toBe(true);
    expect(flushFive.containedHands['Three of a Kind']).toBe(true);
    expect(flushFive.containedHands['Pair']).toBe(true);
    expect(flushFive.containedHands['Flush']).toBe(true);
    expect(flushFive.containedHands['Full House']).toBe(false);

    const flushHouse = evaluatePokerHand([
      c('1', 13, 'hearts'),
      c('2', 13, 'hearts'),
      c('3', 13, 'hearts'),
      c('4', 7, 'hearts'),
      c('5', 7, 'hearts'),
    ]);
    expect(flushHouse.handType).toBe('Flush House');
    expect(flushHouse.containedHands['Full House']).toBe(true);
    expect(flushHouse.containedHands['Two Pair']).toBe(true);
    expect(flushHouse.containedHands['Flush']).toBe(true);

    const fiveKind = evaluatePokerHand([
      c('1', 9, 'spades'),
      c('2', 9, 'hearts'),
      c('3', 9, 'clubs'),
      c('4', 9, 'diamonds'),
      c('5', 9, 'spades'),
    ]);
    expect(fiveKind.handType).toBe('Five of a Kind');
    expect(fiveKind.containedHands['Flush']).toBe(false);

    const royalFlush = evaluatePokerHand([
      c('1', 10, 'clubs'),
      c('2', 11, 'clubs'),
      c('3', 12, 'clubs'),
      c('4', 13, 'clubs'),
      c('5', 14, 'clubs'),
    ]);
    expect(royalFlush.handType).toBe('Straight Flush');
    expect(royalFlush.isRoyal).toBe(true);
    expect(royalFlush.containedHands['Straight']).toBe(true);
    expect(royalFlush.containedHands['Flush']).toBe(true);

    const lowStraightFlush = evaluatePokerHand([
      c('1', 14, 'diamonds'),
      c('2', 2, 'diamonds'),
      c('3', 3, 'diamonds'),
      c('4', 4, 'diamonds'),
      c('5', 5, 'diamonds'),
    ]);
    expect(lowStraightFlush.handType).toBe('Straight Flush');
    expect(lowStraightFlush.isRoyal).toBe(false);

    const fourKind = evaluatePokerHand([
      c('1', 8, 'spades'),
      c('2', 8, 'hearts'),
      c('3', 8, 'clubs'),
      c('4', 8, 'diamonds'),
      c('5', 14, 'spades'),
    ]);
    expect(fourKind.handType).toBe('Four of a Kind');
    expect(fourKind.scoringCardIds).toEqual(['1', '2', '3', '4']);
    expect(fourKind.containedHands['Three of a Kind']).toBe(true);
    expect(fourKind.containedHands['Pair']).toBe(true);
    expect(fourKind.containedHands['Two Pair']).toBe(false);

    const fullHouse = evaluatePokerHand([
      c('1', 6, 'spades'),
      c('2', 6, 'hearts'),
      c('3', 10, 'clubs'),
      c('4', 6, 'diamonds'),
      c('5', 10, 'spades'),
    ]);
    expect(fullHouse.handType).toBe('Full House');
    expect(fullHouse.scoringCardIds).toHaveLength(5);
    expect(fullHouse.containedHands['Two Pair']).toBe(true);
    expect(fullHouse.containedHands['Three of a Kind']).toBe(true);
    expect(fullHouse.containedHands['Pair']).toBe(true);

    const flush = evaluatePokerHand([
      c('1', 2, 'hearts'),
      c('2', 5, 'hearts'),
      c('3', 8, 'hearts'),
      c('4', 11, 'hearts'),
      c('5', 14, 'hearts'),
    ]);
    expect(flush.handType).toBe('Flush');

    const straight = evaluatePokerHand([
      c('1', 5, 'spades'),
      c('2', 4, 'hearts'),
      c('3', 3, 'clubs'),
      c('4', 2, 'diamonds'),
      c('5', 14, 'spades'),
    ]);
    expect(straight.handType).toBe('Straight');

    const trips = evaluatePokerHand([
      c('1', 4, 'spades'),
      c('2', 4, 'hearts'),
      c('3', 4, 'clubs'),
      c('4', 12, 'diamonds'),
    ]);
    expect(trips.handType).toBe('Three of a Kind');
    expect(trips.scoringCardIds).toEqual(['1', '2', '3']);
    expect(trips.containedHands['Pair']).toBe(true);

    const twoPair = evaluatePokerHand([
      c('1', 11, 'spades'),
      c('2', 3, 'hearts'),
      c('3', 11, 'clubs'),
      c('4', 3, 'diamonds'),
      c('5', 9, 'spades'),
    ]);
    expect(twoPair.handType).toBe('Two Pair');
    expect(twoPair.scoringCardIds).toEqual(['1', '2', '3', '4']);
    expect(twoPair.containedHands['Pair']).toBe(true);

    const pair = evaluatePokerHand([
      c('1', 7, 'spades'),
      c('2', 14, 'hearts'),
      c('3', 7, 'clubs'),
    ]);
    expect(pair.handType).toBe('Pair');
    expect(pair.scoringCardIds).toEqual(['1', '3']);

    const highCard = evaluatePokerHand([c('1', 2, 'spades'), c('2', 13, 'hearts')]);
    expect(highCard.handType).toBe('High Card');
    expect(highCard.scoringCardIds).toEqual(['2']);
    expect(highCard.containedHands['High Card']).toBe(true);

    const empty = evaluatePokerHand([]);
    expect(empty.handType).toBe('High Card');
    expect(empty.scoringCardIds).toEqual([]);
    expect(empty.containedHands['High Card']).toBe(false);
  });

  it('не засчитывает K-A-2-3-4 за Ряд и изолирует Stone-карты от пар/мастей/рядов', () => {
    const wrapAround = evaluatePokerHand([
      c('1', 13, 'spades'),
      c('2', 14, 'hearts'),
      c('3', 2, 'clubs'),
      c('4', 3, 'diamonds'),
      c('5', 4, 'spades'),
    ]);
    expect(wrapAround.handType).toBe('High Card');

    // Stone Ace не образует Пару с обычным Тузом и проигрывает двойке в High Card
    const stoneAndTwo = evaluatePokerHand([
      c('st', 14, 'spades', 'stone'),
      c('two', 2, 'clubs'),
    ]);
    expect(stoneAndTwo.handType).toBe('High Card');
    expect(stoneAndTwo.scoringCardIds).toEqual(['two']);

    const stonePairBlock = evaluatePokerHand([
      c('a1', 14, 'spades'),
      c('st', 14, 'spades', 'stone'),
    ]);
    expect(stonePairBlock.handType).toBe('High Card');
    expect(stonePairBlock.scoringCardIds).toEqual(['a1']);

    // Только Stone-карты -> High Card берёт первую Stone-карту
    const onlyStones = evaluatePokerHand([
      c('st1', 2, 'spades', 'stone'),
      c('st2', 14, 'hearts', 'stone'),
    ]);
    expect(onlyStones.handType).toBe('High Card');
    expect(onlyStones.scoringCardIds).toEqual(['st1']);

    // Stone-карта ломает 5-карточный Флеш/Стрит без Four Fingers, но при Four Fingers 4 обычные карты работают
    const fourNormalPlusStone = [
      c('1', 2, 'spades'),
      c('2', 3, 'spades'),
      c('3', 4, 'spades'),
      c('4', 5, 'spades'),
      c('5', 6, 'spades', 'stone'),
    ];
    expect(evaluatePokerHand(fourNormalPlusStone).handType).toBe('High Card');
    expect(evaluatePokerHand(fourNormalPlusStone, { fourFingers: true }).handType).toBe(
      'Straight Flush',
    );
  });

  it('учитывает Wild-карты и поведение подавленных (debuffed) карт во Флеше', () => {
    const wildFlush = evaluatePokerHand([
      c('1', 2, 'hearts'),
      c('2', 5, 'hearts'),
      c('3', 8, 'hearts'),
      c('4', 11, 'hearts'),
      c('5', 14, 'spades', 'wild'),
    ]);
    expect(wildFlush.handType).toBe('Flush');

    // Подавленный Wild теряет универсальность (остаётся только печатная масть spades)
    const debuffedWild = createPlayingCard({
      id: '5',
      rank: 14,
      suit: 'spades',
      enhancement: 'wild',
      debuffed: true,
    });
    expect(
      evaluatePokerHand([
        c('1', 2, 'hearts'),
        c('2', 5, 'hearts'),
        c('3', 8, 'hearts'),
        c('4', 11, 'hearts'),
        debuffedWild,
      ]).handType,
    ).toBe('High Card');

    // Подавленная обычная карта сохраняет свою печатную масть для Флеша
    const debuffedHeart = createPlayingCard({
      id: '5',
      rank: 14,
      suit: 'hearts',
      debuffed: true,
    });
    expect(
      evaluatePokerHand([
        c('1', 2, 'hearts'),
        c('2', 5, 'hearts'),
        c('3', 8, 'hearts'),
        c('4', 11, 'hearts'),
        debuffedHeart,
      ]).handType,
    ).toBe('Flush');
  });

  it('поддерживает Four Fingers, Shortcut и их комбинацию с Wild', () => {
    // Four Fingers: 4 карты в Флеш или Стрит
    const ffFlush = evaluatePokerHand(
      [c('1', 2, 'clubs'), c('2', 6, 'clubs'), c('3', 9, 'clubs'), c('4', 13, 'clubs')],
      { fourFingers: true },
    );
    expect(ffFlush.handType).toBe('Flush');

    // Four Fingers: дубли ранга внутри 5-карточного Стрита включают все карты ряда и содержат Пару
    const ffDupStraight = evaluatePokerHand(
      [
        c('a1', 14, 'spades'),
        c('a2', 14, 'hearts'),
        c('2', 2, 'clubs'),
        c('3', 3, 'diamonds'),
        c('4', 4, 'spades'),
      ],
      { fourFingers: true },
    );
    expect(ffDupStraight.handType).toBe('Straight');
    expect(ffDupStraight.scoringCardIds).toEqual(['a1', 'a2', '2', '3', '4']);
    expect(ffDupStraight.containedHands['Pair']).toBe(true);

    // Four Fingers: Straight Flush как объединение без дубликатов 4-карточного Флеша и 4-карточного Стрита
    const ffSplitSF = evaluatePokerHand(
      [
        c('a', 14, 'spades'),
        c('k', 13, 'spades'),
        c('q', 12, 'spades'),
        c('j', 11, 'hearts'),
        c('4', 4, 'spades'),
      ],
      { fourFingers: true },
    );
    expect(ffSplitSF.handType).toBe('Straight Flush');
    expect(ffSplitSF.scoringCardIds).toEqual(['a', 'k', 'q', 'j', '4']);
    expect(ffSplitSF.isRoyal).toBe(false);

    // Shortcut: пропуски на 1 ранг (включая A-3-5-7-9 и 6-8-10-Q-A)
    expect(
      evaluatePokerHand(
        [
          c('1', 14, 'spades'),
          c('2', 3, 'hearts'),
          c('3', 5, 'clubs'),
          c('4', 7, 'diamonds'),
          c('5', 9, 'spades'),
        ],
        { shortcut: true },
      ).handType,
    ).toBe('Straight');

    expect(
      evaluatePokerHand(
        [
          c('1', 12, 'spades'),
          c('2', 10, 'hearts'),
          c('3', 8, 'clubs'),
          c('4', 6, 'diamonds'),
          c('5', 14, 'spades'),
        ],
        { shortcut: true },
      ).handType,
    ).toBe('Straight');

    // Отклоняет пропуск в 2 ранга (2 -> 5) и перенос K-A-2 при Shortcut
    expect(
      evaluatePokerHand(
        [
          c('1', 2, 'spades'),
          c('2', 5, 'hearts'),
          c('3', 7, 'clubs'),
          c('4', 9, 'diamonds'),
          c('5', 11, 'spades'),
        ],
        { shortcut: true },
      ).handType,
    ).toBe('High Card');

    // Four Fingers + Shortcut + Wild вместе
    const combo = evaluatePokerHand(
      [
        c('1', 2, 'spades'),
        c('2', 4, 'spades'),
        c('3', 6, 'hearts', 'wild'),
        c('4', 8, 'spades'),
      ],
      { fourFingers: true, shortcut: true },
    );
    expect(combo.handType).toBe('Straight Flush');
    expect(combo.scoringCardIds).toEqual(['1', '2', '3', '4']);
  });
});
