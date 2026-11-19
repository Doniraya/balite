import {
  RANKS,
  SUITS,
  type CardFacing,
  type Edition,
  type Enhancement,
  type PlayingCard,
  type Rank,
  type Seal,
  type Suit,
} from './types';

/**
 * Порядок мастей при сортировке и переборе флешей.
 */
export const SUIT_ORDER: Readonly<Record<Suit, number>> = {
  spades: 0,
  hearts: 1,
  clubs: 2,
  diamonds: 3,
};

/**
 * Номинальные коэффициенты масти в формуле Balatro (`Card:get_nominal`).
 */
const SUIT_NOMINAL_VALUE: Readonly<Record<Suit, number>> = {
  diamonds: 0.01,
  clubs: 0.02,
  hearts: 0.03,
  spades: 0.04,
};

function parseCardUniqueVal(cardId: string): number {
  const match = /(\d+)$/.exec(cardId);
  return match ? Number(match[1]) % 10000 : 0;
}

/**
 * Вычисляет числовой номинал карты (`Card:get_nominal`) по формуле Balatro:
 * для Каменных карт используется множитель масти -1000, поэтому они всегда ниже обычных карт,
 * а между собой сортируются по обратному номиналу масти, базовому номиналу и уникальному индексу.
 */
export function getCardNominal(card: PlayingCard, mod: 'rank' | 'suit' = 'rank'): number {
  const mult = card.enhancement === 'stone' ? -1000 : mod === 'suit' ? 1000 : 1;
  const baseNominal = getRankBaseChips(card.rank);
  const suitNominal = SUIT_NOMINAL_VALUE[card.suit];
  const suitNominalOriginal = suitNominal * 0.1;
  const faceNominal =
    card.rank === 14
      ? 0.4
      : card.rank === 13
        ? 0.3
        : card.rank === 12
          ? 0.2
          : card.rank === 11
            ? 0.1
            : 0;

  return (
    baseNominal +
    suitNominal * mult +
    suitNominalOriginal * 0.0001 * mult +
    faceNominal +
    0.000001 * parseCardUniqueVal(card.id)
  );
}

/**
 * Параметры для создания новой игральной карты с безопасными значениями по умолчанию.
 */
export interface CreatePlayingCardParams {
  readonly id: string;
  readonly suit: Suit;
  readonly rank: Rank;
  readonly enhancement?: Enhancement;
  readonly edition?: Edition;
  readonly seal?: Seal;
  readonly bonusChips?: number;
  readonly permaBonus?: number;
  readonly debuffed?: boolean;
  readonly playedThisAnte?: boolean;
  readonly facing?: CardFacing;
  readonly forcedSelection?: boolean;
}

/**
 * Возвращает базовый номинал Силы для ранга карты (2..10 -> номинал, В/Д/К -> 10, Туз -> 11).
 */
export function getRankBaseChips(rank: Rank): number {
  if (rank === 14) return 11;
  if (rank >= 11) return 10;
  return rank;
}

/**
 * Возвращает эффективный ранг карты или null для Каменной карты (не образует пар и рядов).
 */
export function getCardEffectiveRank(card: PlayingCard): Rank | null {
  if (card.enhancement === 'stone') return null;
  return card.rank;
}

/**
 * Возвращает базовый номинал Силы карты без учёта улучшений и накопительных бонусов (0 для Каменной карты).
 */
export function getCardBaseChips(card: PlayingCard): number {
  if (card.enhancement === 'stone') return 0;
  return getRankBaseChips(card.rank);
}

/**
 * Возвращает полную Силу карты при подсчёте (номинал + улучшение Руническая/Каменная + bonusChips + permaBonus; 0 при подавлении).
 */
export function getCardScoringChips(card: PlayingCard): number {
  if (card.debuffed) return 0;

  const enhancementChips =
    card.enhancement === 'stone' ? 50 : card.enhancement === 'bonus' ? 30 : 0;

  return getCardBaseChips(card) + enhancementChips + card.bonusChips + card.permaBonus;
}

/**
 * Проверяет, является ли карта картинкой (Валет, Дама, Король).
 * Каменная карта и подавленная карта (если проверка не от Босса) не считаются картинками.
 */
export function isCardFace(card: PlayingCard, fromBoss = false): boolean {
  if (card.debuffed && !fromBoss) return false;
  if (card.enhancement === 'stone') return false;
  return card.rank === 11 || card.rank === 12 || card.rank === 13;
}

/**
 * Проверяет принадлежность карты к указанной масти с точными правилами Wild, Stone, debuffed и расчёта Флеша.
 * - При flushCalc=true: Stone=false; неподавленный Wild=true; подавленный Wild теряет универсальность; обычная карта сохраняет масть.
 * - При flushCalc=false: подавленная карта (без bypassDebuff) не даёт масть; неподавленный/обходящий дебафф Wild=true; Stone=false.
 */
export function isCardSuit(
  card: PlayingCard,
  suit: Suit,
  bypassDebuff = false,
  flushCalc = false,
): boolean {
  if (flushCalc) {
    if (card.enhancement === 'stone') return false;
    if (card.enhancement === 'wild' && !card.debuffed) return true;
    return card.suit === suit;
  }

  if (card.debuffed && !bypassDebuff) return false;
  if (card.enhancement === 'stone') return false;
  if (card.enhancement === 'wild') return true;
  return card.suit === suit;
}

/**
 * Создаёт неизменяемый экземпляр игральной карты.
 */
export function createPlayingCard(params: CreatePlayingCardParams): PlayingCard {
  return {
    id: params.id,
    suit: params.suit,
    rank: params.rank,
    enhancement: params.enhancement ?? 'none',
    edition: params.edition ?? 'base',
    seal: params.seal ?? 'none',
    bonusChips: params.bonusChips ?? 0,
    permaBonus: params.permaBonus ?? 0,
    debuffed: params.debuffed ?? false,
    playedThisAnte: params.playedThisAnte ?? false,
    facing: params.facing ?? 'front',
    forcedSelection: params.forcedSelection ?? false,
  };
}

/**
 * Генерирует стандартную 52-карточную колоду (4 масти × 13 рангов) с детерминированными ID.
 */
export function createStandardDeck(startUid = 1): PlayingCard[] {
  const deck: PlayingCard[] = [];
  let uid = startUid;

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(
        createPlayingCard({
          id: `card_${uid}`,
          suit,
          rank,
        }),
      );
      uid += 1;
    }
  }

  return deck;
}

/**
 * Общий детерминированный компаратор карт для сортировки руки по рангу или по масти.
 */
function compareCards(a: PlayingCard, b: PlayingCard, primary: 'rank' | 'suit'): number {
  const diff = getCardNominal(b, primary) - getCardNominal(a, primary);
  if (Math.abs(diff) > 1e-12) return diff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Возвращает отсортированную по убыванию ранга копию массива карт без мутации входных данных.
 */
export function sortCardsByRank(cards: readonly PlayingCard[]): PlayingCard[] {
  return [...cards].sort((a, b) => compareCards(a, b, 'rank'));
}

/**
 * Возвращает отсортированную по масти (и убыванию ранга внутри масти) копию массива карт.
 */
export function sortCardsBySuit(cards: readonly PlayingCard[]): PlayingCard[] {
  return [...cards].sort((a, b) => compareCards(a, b, 'suit'));
}

/**
 * Упорядочивает карты строго в последовательности указанных идентификаторов (слева направо).
 */
export function sortCardsByOrder(
  cards: readonly PlayingCard[],
  orderIds: readonly string[],
): PlayingCard[] {
  const indexById = new Map<string, number>();
  for (let i = 0; i < orderIds.length; i += 1) {
    indexById.set(orderIds[i]!, i);
  }

  return [...cards].sort((a, b) => {
    const indexA = indexById.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const indexB = indexById.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return indexA - indexB;
  });
}
