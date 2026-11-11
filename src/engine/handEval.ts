import { getCardEffectiveRank, isCardSuit, sortCardsByOrder } from './cards';
import {
  HAND_TYPES,
  SUITS,
  type HandEvaluationResult,
  type HandLevelState,
  type HandType,
  type PlayingCard,
} from './types';

/**
 * Базовые параметры и прирост за уровень Астральной сферы для одного типа расклада.
 */
export interface HandBaseConfig {
  readonly handType: HandType;
  readonly baseChips: number;
  readonly baseMult: number;
  readonly levelChips: number;
  readonly levelMult: number;
  readonly hidden: boolean;
}

/**
 * Каноническая таблица всех 12 раскладов Balite v1.0.
 */
export const HAND_BASE_CONFIG: Readonly<Record<HandType, HandBaseConfig>> = {
  'Flush Five': {
    handType: 'Flush Five',
    baseChips: 160,
    baseMult: 16,
    levelChips: 50,
    levelMult: 3,
    hidden: true,
  },
  'Flush House': {
    handType: 'Flush House',
    baseChips: 140,
    baseMult: 14,
    levelChips: 40,
    levelMult: 4,
    hidden: true,
  },
  'Five of a Kind': {
    handType: 'Five of a Kind',
    baseChips: 120,
    baseMult: 12,
    levelChips: 35,
    levelMult: 3,
    hidden: true,
  },
  'Straight Flush': {
    handType: 'Straight Flush',
    baseChips: 100,
    baseMult: 8,
    levelChips: 40,
    levelMult: 4,
    hidden: false,
  },
  'Four of a Kind': {
    handType: 'Four of a Kind',
    baseChips: 60,
    baseMult: 7,
    levelChips: 30,
    levelMult: 3,
    hidden: false,
  },
  'Full House': {
    handType: 'Full House',
    baseChips: 40,
    baseMult: 4,
    levelChips: 25,
    levelMult: 2,
    hidden: false,
  },
  Flush: {
    handType: 'Flush',
    baseChips: 35,
    baseMult: 4,
    levelChips: 15,
    levelMult: 2,
    hidden: false,
  },
  Straight: {
    handType: 'Straight',
    baseChips: 30,
    baseMult: 4,
    levelChips: 30,
    levelMult: 3,
    hidden: false,
  },
  'Three of a Kind': {
    handType: 'Three of a Kind',
    baseChips: 30,
    baseMult: 3,
    levelChips: 20,
    levelMult: 2,
    hidden: false,
  },
  'Two Pair': {
    handType: 'Two Pair',
    baseChips: 20,
    baseMult: 2,
    levelChips: 20,
    levelMult: 1,
    hidden: false,
  },
  Pair: {
    handType: 'Pair',
    baseChips: 10,
    baseMult: 2,
    levelChips: 15,
    levelMult: 1,
    hidden: false,
  },
  'High Card': {
    handType: 'High Card',
    baseChips: 5,
    baseMult: 1,
    levelChips: 10,
    levelMult: 1,
    hidden: false,
  },
};

/**
 * Опции модификаторов правил оценки комбинаций (Реликвии Четырёхгранник и Тайная тропа).
 */
export interface EvaluatePokerHandOptions {
  readonly fourFingers?: boolean;
  readonly shortcut?: boolean;
}

/**
 * Таблица базовых порогов Стражей для Этапов 1..8 при разных кривых сложности (1..3).
 */
const BLIND_BASE_AMOUNTS: Readonly<Record<1 | 2 | 3, readonly number[]>> = {
  1: [300, 800, 2000, 5000, 11000, 20000, 35000, 50000],
  2: [300, 900, 2600, 8000, 20000, 36000, 60000, 100000],
  3: [300, 1000, 3200, 9000, 25000, 60000, 110000, 200000],
};

/**
 * Вычисляет Силу и Множитель расклада на указанном уровне (минимум 0 Силы и 1 Множ).
 */
export function getHandLevelStats(
  handType: HandType,
  level: number,
): { readonly chips: number; readonly mult: number } {
  const cfg = HAND_BASE_CONFIG[handType];
  const normalizedLevel = Math.max(0, level);
  return {
    chips: Math.max(cfg.baseChips + cfg.levelChips * (normalizedLevel - 1), 0),
    mult: Math.max(cfg.baseMult + cfg.levelMult * (normalizedLevel - 1), 1),
  };
}

/**
 * Создаёт стартовую карту уровней всех 12 раскладов для нового забега.
 */
export function createInitialHandLevels(): Record<HandType, HandLevelState> {
  const result = {} as Record<HandType, HandLevelState>;
  for (const handType of HAND_TYPES) {
    const cfg = HAND_BASE_CONFIG[handType];
    result[handType] = {
      level: 1,
      chips: cfg.baseChips,
      mult: cfg.baseMult,
      playedCount: 0,
      visible: !cfg.hidden,
    };
  }
  return result;
}

/**
 * Находит группы карт с точным совпадением кратности ранга (без Каменных карт), отсортированные от старшего ранга к младшему.
 */
function getSameRankGroups(count: number, cards: readonly PlayingCard[]): PlayingCard[][] {
  const byRank = new Map<number, PlayingCard[]>();

  for (const card of cards) {
    const rank = getCardEffectiveRank(card);
    if (rank === null) continue;
    const bucket = byRank.get(rank);
    if (bucket) {
      bucket.push(card);
    } else {
      byRank.set(rank, [card]);
    }
  }

  const groups: PlayingCard[][] = [];
  for (let rank = 14; rank >= 2; rank -= 1) {
    const bucket = byRank.get(rank);
    if (bucket && bucket.length === count) {
      groups.push(bucket);
    }
  }

  return groups;
}

/**
 * Определяет наличие Флеша (4 карты при Four Fingers, иначе 5; Каменные карты учитываются в общей длине руки).
 */
function getFlushCards(cards: readonly PlayingCard[], fourFingers: boolean): PlayingCard[] {
  const required = fourFingers ? 4 : 5;
  if (cards.length > 5 || cards.length < required) return [];

  for (const suit of SUITS) {
    const matched: PlayingCard[] = [];
    for (const card of cards) {
      if (isCardSuit(card, suit, false, true)) {
        matched.push(card);
      }
    }
    if (matched.length >= required) {
      return matched;
    }
  }

  return [];
}

/**
 * Определяет наличие Ряда с поддержкой Four Fingers (4 карты и дубли рангов) и Shortcut (пропуски на 1 ранг).
 */
function getStraightCards(
  cards: readonly PlayingCard[],
  fourFingers: boolean,
  shortcut: boolean,
): PlayingCard[] {
  const required = fourFingers ? 4 : 5;
  if (cards.length > 5 || cards.length < required) return [];

  const byRank = new Map<number, PlayingCard[]>();
  for (const card of cards) {
    const rank = getCardEffectiveRank(card);
    if (rank === null) continue;
    const bucket = byRank.get(rank);
    if (bucket) {
      bucket.push(card);
    } else {
      byRank.set(rank, [card]);
    }
  }

  let straightLength = 0;
  let found = false;
  let skippedRank = false;
  let acc: PlayingCard[] = [];

  for (let step = 1; step <= 14; step += 1) {
    const rank = step === 1 ? 14 : step;
    const bucket = byRank.get(rank);

    if (bucket && bucket.length > 0) {
      straightLength += 1;
      skippedRank = false;
      for (const card of bucket) {
        acc.push(card);
      }
    } else if (shortcut && !skippedRank && step !== 14) {
      // Shortcut разрешает пропуск ровно одного промежуточного ранга без переноса через Туза
      skippedRank = true;
    } else {
      straightLength = 0;
      skippedRank = false;
      if (found) break;
      acc = [];
    }

    if (straightLength >= required) {
      found = true;
    }
  }

  return found ? acc : [];
}

/**
 * Выбирает старшую карту для расклада High Card (Каменные карты уступают любой обычной карте).
 */
function getHighestCards(cards: readonly PlayingCard[]): PlayingCard[] {
  if (cards.length === 0) return [];

  let highest = cards[0]!;
  let highestScore = getCardNominalWeight(highest);

  for (let i = 1; i < cards.length; i += 1) {
    const candidate = cards[i]!;
    const score = getCardNominalWeight(candidate);
    if (score > highestScore) {
      highest = candidate;
      highestScore = score;
    }
  }

  return [highest];
}

/**
 * Числовой вес карты при сравнении в getHighestCards (Stone-карты всегда ниже любой обычной карты).
 */
function getCardNominalWeight(card: PlayingCard): number {
  const rank = getCardEffectiveRank(card);
  return rank === null ? -10000 : rank;
}

/**
 * Объединяет два набора карт без дубликатов по ID (для Straight Flush с Four Fingers).
 */
function mergeUniqueCards(
  primary: readonly PlayingCard[],
  secondary: readonly PlayingCard[],
): PlayingCard[] {
  const seenIds = new Set<string>();
  const merged: PlayingCard[] = [];

  for (const card of primary) {
    if (!seenIds.has(card.id)) {
      seenIds.add(card.id);
      merged.push(card);
    }
  }
  for (const card of secondary) {
    if (!seenIds.has(card.id)) {
      seenIds.add(card.id);
      merged.push(card);
    }
  }

  return merged;
}

/**
 * Оценивает сыгранную/выделенную руку, возвращая старший расклад, карты подсчёта, флаг Royal и матрицу вложенности.
 */
export function evaluatePokerHand(
  playedCards: readonly PlayingCard[],
  options: EvaluatePokerHandOptions = {},
): HandEvaluationResult {
  const fourFingers = options.fourFingers ?? false;
  const shortcut = options.shortcut ?? false;

  const same5 = getSameRankGroups(5, playedCards);
  const same4 = getSameRankGroups(4, playedCards);
  const same3 = getSameRankGroups(3, playedCards);
  const same2 = getSameRankGroups(2, playedCards);
  const flushCards = getFlushCards(playedCards, fourFingers);
  const straightCards = getStraightCards(playedCards, fourFingers, shortcut);
  const highestCards = getHighestCards(playedCards);

  const has5 = same5.length > 0;
  const has4 = same4.length > 0;
  const has3 = same3.length > 0;
  const has2 = same2.length > 0;
  const hasFlush = flushCards.length > 0;
  const hasStraight = straightCards.length > 0;
  const hasTwoPair = same2.length >= 2 || (same3.length === 1 && same2.length === 1);

  // Матрица вложенности строится с каскадом вниз: 5 -> 4 -> 3 -> 2
  const containedHands: Record<HandType, boolean> = {
    'Flush Five': has5 && hasFlush,
    'Flush House': has3 && has2 && hasFlush,
    'Five of a Kind': has5,
    'Straight Flush': hasFlush && hasStraight,
    'Four of a Kind': has4 || has5,
    'Full House': has3 && has2,
    Flush: hasFlush,
    Straight: hasStraight,
    'Three of a Kind': has3 || has4 || has5,
    'Two Pair': hasTwoPair,
    Pair: has2 || has3 || has4 || has5,
    'High Card': highestCards.length > 0,
  };

  let handType: HandType = 'High Card';
  let rawScoringCards: PlayingCard[] = highestCards;

  if (containedHands['Flush Five']) {
    handType = 'Flush Five';
    rawScoringCards = same5[0]!;
  } else if (containedHands['Flush House']) {
    handType = 'Flush House';
    rawScoringCards = [...same3[0]!, ...same2[0]!];
  } else if (containedHands['Five of a Kind']) {
    handType = 'Five of a Kind';
    rawScoringCards = same5[0]!;
  } else if (containedHands['Straight Flush']) {
    handType = 'Straight Flush';
    rawScoringCards = mergeUniqueCards(flushCards, straightCards);
  } else if (containedHands['Four of a Kind']) {
    handType = 'Four of a Kind';
    rawScoringCards = same4[0]!;
  } else if (containedHands['Full House']) {
    handType = 'Full House';
    rawScoringCards = [...same3[0]!, ...same2[0]!];
  } else if (containedHands.Flush) {
    handType = 'Flush';
    rawScoringCards = flushCards;
  } else if (containedHands.Straight) {
    handType = 'Straight';
    rawScoringCards = straightCards;
  } else if (containedHands['Three of a Kind']) {
    handType = 'Three of a Kind';
    rawScoringCards = same3[0]!;
  } else if (containedHands['Two Pair']) {
    handType = 'Two Pair';
    const secondPair = same2[1] ?? same3[0]!;
    rawScoringCards = [...same2[0]!, ...secondPair];
  } else if (containedHands.Pair) {
    handType = 'Pair';
    rawScoringCards = same2[0]!;
  }

  const playedOrderIds = playedCards.map((card) => card.id);
  const scoringCards = sortCardsByOrder(rawScoringCards, playedOrderIds);
  const scoringCardIds = scoringCards.map((card) => card.id);

  let isRoyal: boolean | undefined;
  if (handType === 'Straight Flush') {
    const minRank = scoringCards.reduce((min, card) => {
      const rank = getCardEffectiveRank(card);
      return rank !== null && rank < min ? rank : min;
    }, 15);
    isRoyal = minRank >= 10 && minRank <= 14;
  }

  return isRoyal !== undefined
    ? {
        handType,
        scoringCards,
        scoringCardIds,
        containedHands,
        isRoyal,
      }
    : {
        handType,
        scoringCards,
        scoringCardIds,
        containedHands,
      };
}

/**
 * Вычисляет базовый порог Стража для указанного Этапа (1..8 и экспоненциальный Бесконечный режим 9+).
 */
export function getBlindAmount(ante: number, scaling: 1 | 2 | 3 = 1): number {
  if (ante < 1) return 100;

  const amounts = BLIND_BASE_AMOUNTS[scaling];
  if (ante <= 8) {
    return amounts[ante - 1]!;
  }

  const k = 0.75;
  const a = amounts[7]!;
  const b = 1.6;
  const c = ante - 8;
  const d = 1 + 0.2 * c;
  const raw = Math.floor(a * (b + (k * c) ** d) ** c);

  if (!Number.isFinite(raw) || raw <= 0) {
    return raw;
  }

  const step = 10 ** Math.floor(Math.log10(raw) - 1);
  return raw - (raw % step);
}
