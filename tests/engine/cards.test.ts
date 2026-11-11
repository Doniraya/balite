import { describe, expect, it } from 'vitest';
import {
  createPlayingCard,
  createStandardDeck,
  getCardBaseChips,
  getCardEffectiveRank,
  getCardScoringChips,
  getRankBaseChips,
  isCardFace,
  isCardSuit,
  sortCardsByOrder,
  sortCardsByRank,
  sortCardsBySuit,
} from '../../src/engine/cards';
import { SUITS, RANKS } from '../../src/engine/types';

describe('Номиналы и свойства игральных карт (cards.ts)', () => {
  it('корректно вычисляет номиналы рангов 2..14 и учитывает Stone/Bonus/PermaBonus/Debuff', () => {
    expect(getRankBaseChips(2)).toBe(2);
    expect(getRankBaseChips(10)).toBe(10);
    expect(getRankBaseChips(11)).toBe(10);
    expect(getRankBaseChips(12)).toBe(10);
    expect(getRankBaseChips(13)).toBe(10);
    expect(getRankBaseChips(14)).toBe(11);

    const ace = createPlayingCard({ id: 'c1', suit: 'spades', rank: 14 });
    expect(getCardBaseChips(ace)).toBe(11);
    expect(getCardScoringChips(ace)).toBe(11);
    expect(getCardEffectiveRank(ace)).toBe(14);

    const bonusKing = createPlayingCard({
      id: 'c2',
      suit: 'hearts',
      rank: 13,
      enhancement: 'bonus',
      bonusChips: 5,
      permaBonus: 10,
    });
    expect(getCardBaseChips(bonusKing)).toBe(10);
    expect(getCardScoringChips(bonusKing)).toBe(10 + 30 + 5 + 10);

    const stoneAce = createPlayingCard({
      id: 'c3',
      suit: 'clubs',
      rank: 14,
      enhancement: 'stone',
      permaBonus: 20,
    });
    expect(getCardEffectiveRank(stoneAce)).toBeNull();
    expect(getCardBaseChips(stoneAce)).toBe(0);
    expect(getCardScoringChips(stoneAce)).toBe(50 + 20);

    const debuffedBonus = createPlayingCard({
      id: 'c4',
      suit: 'diamonds',
      rank: 14,
      enhancement: 'bonus',
      permaBonus: 50,
      debuffed: true,
    });
    expect(getCardScoringChips(debuffedBonus)).toBe(0);
  });

  it('корректно определяет картинки (isCardFace) с учётом Stone и debuffed/fromBoss', () => {
    const jack = createPlayingCard({ id: 'j', suit: 'spades', rank: 11 });
    const queen = createPlayingCard({ id: 'q', suit: 'hearts', rank: 12 });
    const king = createPlayingCard({ id: 'k', suit: 'clubs', rank: 13 });
    const ace = createPlayingCard({ id: 'a', suit: 'diamonds', rank: 14 });
    const ten = createPlayingCard({ id: 't', suit: 'spades', rank: 10 });
    const stoneKing = createPlayingCard({
      id: 'sk',
      suit: 'spades',
      rank: 13,
      enhancement: 'stone',
    });
    const debuffedQueen = createPlayingCard({
      id: 'dq',
      suit: 'clubs',
      rank: 12,
      debuffed: true,
    });

    expect(isCardFace(jack)).toBe(true);
    expect(isCardFace(queen)).toBe(true);
    expect(isCardFace(king)).toBe(true);
    expect(isCardFace(ace)).toBe(false);
    expect(isCardFace(ten)).toBe(false);
    expect(isCardFace(stoneKing)).toBe(false);
    expect(isCardFace(stoneKing, true)).toBe(false);
    expect(isCardFace(debuffedQueen)).toBe(false);
    expect(isCardFace(debuffedQueen, true)).toBe(true);
  });

  it('корректно проверяет масть (isCardSuit) для обычных карт, Wild, Stone и подавления (debuff/flushCalc)', () => {
    const club = createPlayingCard({ id: 'c', suit: 'clubs', rank: 7 });
    const wildHeart = createPlayingCard({ id: 'wh', suit: 'hearts', rank: 9, enhancement: 'wild' });
    const stoneSpade = createPlayingCard({ id: 'ss', suit: 'spades', rank: 14, enhancement: 'stone' });
    const debuffedClub = createPlayingCard({ id: 'dc', suit: 'clubs', rank: 5, debuffed: true });
    const debuffedWildHeart = createPlayingCard({
      id: 'dwh',
      suit: 'hearts',
      rank: 8,
      enhancement: 'wild',
      debuffed: true,
    });

    expect(isCardSuit(club, 'clubs')).toBe(true);
    expect(isCardSuit(club, 'spades')).toBe(false);

    // Активный Хамелеон считается любой мастью и в обычных проверках, и во флеше
    for (const suit of SUITS) {
      expect(isCardSuit(wildHeart, suit)).toBe(true);
      expect(isCardSuit(wildHeart, suit, false, true)).toBe(true);
      // Каменная карта не имеет масти никогда
      expect(isCardSuit(stoneSpade, suit, true, false)).toBe(false);
      expect(isCardSuit(stoneSpade, suit, true, true)).toBe(false);
    }

    // Подавленная обычная карта: без flushCalc/bypassDebuff -> false; при bypassDebuff или flushCalc -> своя масть
    expect(isCardSuit(debuffedClub, 'clubs', false, false)).toBe(false);
    expect(isCardSuit(debuffedClub, 'clubs', true, false)).toBe(true);
    expect(isCardSuit(debuffedClub, 'clubs', false, true)).toBe(true);
    expect(isCardSuit(debuffedClub, 'hearts', false, true)).toBe(false);

    // Подавленный Хамелеон: при bypassDebuff (проверка босса bl_club) — любая масть;
    // при flushCalc=true — теряет универсальность Хамелеона и сохраняет только печатную масть
    expect(isCardSuit(debuffedWildHeart, 'clubs', false, false)).toBe(false);
    expect(isCardSuit(debuffedWildHeart, 'clubs', true, false)).toBe(true);
    expect(isCardSuit(debuffedWildHeart, 'clubs', false, true)).toBe(false);
    expect(isCardSuit(debuffedWildHeart, 'hearts', false, true)).toBe(true);
  });

  it('создаёт полную 52-карточную колоду без дубликатов и детерминированно сортирует без мутаций', () => {
    const deck = createStandardDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);

    for (const suit of SUITS) {
      const ofSuit = deck.filter((c) => c.suit === suit).map((c) => c.rank).sort((a, b) => a - b);
      expect(ofSuit).toEqual([...RANKS]);
    }

    const sample = [
      createPlayingCard({ id: 'c_2s', suit: 'spades', rank: 2 }),
      createPlayingCard({ id: 'c_st', suit: 'spades', rank: 14, enhancement: 'stone' }),
      createPlayingCard({ id: 'c_ah', suit: 'hearts', rank: 14 }),
      createPlayingCard({ id: 'c_as', suit: 'spades', rank: 14 }),
      createPlayingCard({ id: 'c_kc', suit: 'clubs', rank: 13 }),
    ];
    const snapshot = [...sample];

    const byRank = sortCardsByRank(sample);
    expect(sample).toEqual(snapshot);
    expect(byRank.map((c) => c.id)).toEqual(['c_as', 'c_ah', 'c_kc', 'c_2s', 'c_st']);

    const bySuit = sortCardsBySuit(sample);
    expect(bySuit.map((c) => c.id)).toEqual(['c_as', 'c_2s', 'c_ah', 'c_kc', 'c_st']);

    const byOrder = sortCardsByOrder(byRank, ['c_st', 'c_kc', 'c_as', 'c_2s', 'c_ah']);
    expect(byOrder.map((c) => c.id)).toEqual(['c_st', 'c_kc', 'c_as', 'c_2s', 'c_ah']);
  });
});
