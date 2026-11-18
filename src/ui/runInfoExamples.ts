import type { HandType, Rank, Suit } from '../engine';
import type { Translator } from '../i18n';

/**
 * Описание одной карты в наглядном 5-карточном примере комбинации.
 */
export interface HandExampleCard {
  readonly rank: Rank;
  readonly suit: Suit;
  /** Зачётная ли карта в комбинации (приподнята вверх). */
  readonly scored: boolean;
}

/**
 * Каноничные 5-карточные примеры для всех 12 комбинаций по эталону Balatro.
 */
export const HAND_TYPE_EXAMPLES: Readonly<Record<HandType, readonly HandExampleCard[]>> = {
  'High Card': [
    { rank: 14, suit: 'spades', scored: true },
    { rank: 13, suit: 'diamonds', scored: false },
    { rank: 8, suit: 'diamonds', scored: false },
    { rank: 4, suit: 'clubs', scored: false },
    { rank: 3, suit: 'diamonds', scored: false },
  ],
  Pair: [
    { rank: 13, suit: 'spades', scored: true },
    { rank: 13, suit: 'hearts', scored: true },
    { rank: 10, suit: 'diamonds', scored: false },
    { rank: 7, suit: 'clubs', scored: false },
    { rank: 2, suit: 'diamonds', scored: false },
  ],
  'Two Pair': [
    { rank: 12, suit: 'spades', scored: true },
    { rank: 12, suit: 'hearts', scored: true },
    { rank: 8, suit: 'diamonds', scored: true },
    { rank: 8, suit: 'clubs', scored: true },
    { rank: 3, suit: 'hearts', scored: false },
  ],
  'Three of a Kind': [
    { rank: 11, suit: 'hearts', scored: true },
    { rank: 11, suit: 'clubs', scored: true },
    { rank: 11, suit: 'diamonds', scored: true },
    { rank: 7, suit: 'diamonds', scored: false },
    { rank: 4, suit: 'hearts', scored: false },
  ],
  Straight: [
    { rank: 9, suit: 'spades', scored: true },
    { rank: 8, suit: 'hearts', scored: true },
    { rank: 7, suit: 'diamonds', scored: true },
    { rank: 6, suit: 'clubs', scored: true },
    { rank: 5, suit: 'hearts', scored: true },
  ],
  Flush: [
    { rank: 14, suit: 'hearts', scored: true },
    { rank: 13, suit: 'hearts', scored: true },
    { rank: 10, suit: 'hearts', scored: true },
    { rank: 6, suit: 'hearts', scored: true },
    { rank: 2, suit: 'hearts', scored: true },
  ],
  'Full House': [
    { rank: 13, suit: 'spades', scored: true },
    { rank: 13, suit: 'hearts', scored: true },
    { rank: 13, suit: 'diamonds', scored: true },
    { rank: 9, suit: 'clubs', scored: true },
    { rank: 9, suit: 'diamonds', scored: true },
  ],
  'Four of a Kind': [
    { rank: 11, suit: 'spades', scored: true },
    { rank: 11, suit: 'hearts', scored: true },
    { rank: 11, suit: 'clubs', scored: true },
    { rank: 11, suit: 'diamonds', scored: true },
    { rank: 2, suit: 'clubs', scored: false },
  ],
  'Straight Flush': [
    { rank: 10, suit: 'spades', scored: true },
    { rank: 9, suit: 'spades', scored: true },
    { rank: 8, suit: 'spades', scored: true },
    { rank: 7, suit: 'spades', scored: true },
    { rank: 6, suit: 'spades', scored: true },
  ],
  'Five of a Kind': [
    { rank: 14, suit: 'spades', scored: true },
    { rank: 14, suit: 'hearts', scored: true },
    { rank: 14, suit: 'diamonds', scored: true },
    { rank: 14, suit: 'clubs', scored: true },
    { rank: 14, suit: 'spades', scored: true },
  ],
  'Flush House': [
    { rank: 13, suit: 'hearts', scored: true },
    { rank: 13, suit: 'hearts', scored: true },
    { rank: 13, suit: 'hearts', scored: true },
    { rank: 9, suit: 'hearts', scored: true },
    { rank: 9, suit: 'hearts', scored: true },
  ],
  'Flush Five': [
    { rank: 14, suit: 'hearts', scored: true },
    { rank: 14, suit: 'hearts', scored: true },
    { rank: 14, suit: 'hearts', scored: true },
    { rank: 14, suit: 'hearts', scored: true },
    { rank: 14, suit: 'hearts', scored: true },
  ],
};

/**
 * Создаёт мини-карту для плашки предпросмотра комбинации.
 */
export function createMiniCardElement(
  card: HandExampleCard,
  translator: Translator,
): HTMLElement {
  const cardEl = document.createElement('div');
  cardEl.className = 'run-info-mini-card';
  if (card.scored) {
    cardEl.classList.add('run-info-mini-card--scored');
  } else {
    cardEl.classList.add('run-info-mini-card--unscored');
  }

  const isRedSuit = card.suit === 'hearts' || card.suit === 'diamonds';
  cardEl.dataset.suit = card.suit;
  cardEl.classList.add(isRedSuit ? 'run-info-mini-card--red' : 'run-info-mini-card--black');

  // Текстовая метка ранга
  const rankLabel = translator.getRankLabel(card.rank, true);
  const rankTop = document.createElement('span');
  rankTop.className = 'run-info-mini-card__rank';
  rankTop.textContent = rankLabel;

  // Иконка масти по центру
  const suitIcon = createMiniSuitSvg(card.suit);

  cardEl.append(rankTop, suitIcon);
  return cardEl;
}

/**
 * Возвращает компактную SVG-иконку масти.
 */
function createMiniSuitSvg(suit: Suit): SVGSVGElement {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('run-info-mini-card__suit-svg', `suit--${suit}`);

  const path = document.createElementNS(svgNs, 'path');
  path.setAttribute('fill', 'currentColor');

  if (suit === 'spades') {
    path.setAttribute(
      'd',
      'M12 2C9 6 4 9.5 4 14a4.5 4.5 0 0 0 7 3.7L10 21h4l-1-3.3A4.5 4.5 0 0 0 20 14c0-4.5-5-8-8-12Z',
    );
  } else if (suit === 'hearts') {
    path.setAttribute(
      'd',
      'M12 21s-7.5-4.7-9-9.5C1.8 7.6 4.7 4 8.2 4c2 0 3.3 1.1 3.8 2.2C12.5 5.1 13.8 4 15.8 4 19.3 4 22.2 7.6 21 11.5 19.5 16.3 12 21 12 21Z',
    );
  } else if (suit === 'clubs') {
    path.setAttribute(
      'd',
      'M12 3a4 4 0 0 0-3.2 6.4A4.2 4.2 0 0 0 4 13.5 4 4 0 0 0 11 16l-1 5h4l-1-5a4 4 0 0 0 7-2.5 4.2 4.2 0 0 0-4.8-4.1A4 4 0 0 0 12 3Z',
    );
  } else {
    path.setAttribute('d', 'M12 2L20 12L12 22L4 12Z');
  }

  svg.appendChild(path);
  return svg;
}

/**
 * Отрисовывает всплывающую белую плашку с красной рамкой, правилом и 5 мини-картами.
 */
export function renderHandExamplePopup(
  handType: HandType,
  ruleText: string,
  translator: Translator,
): HTMLElement {
  const popup = document.createElement('div');
  popup.className = 'hand-preview-popup';
  popup.dataset.handType = handType;

  const descEl = document.createElement('div');
  descEl.className = 'hand-preview-popup__desc';
  descEl.textContent = ruleText;
  popup.appendChild(descEl);

  const cardsRow = document.createElement('div');
  cardsRow.className = 'hand-preview-popup__cards';

  const cards = HAND_TYPE_EXAMPLES[handType];
  if (cards) {
    for (const card of cards) {
      cardsRow.appendChild(createMiniCardElement(card, translator));
    }
  }

  popup.appendChild(cardsRow);
  return popup;
}
