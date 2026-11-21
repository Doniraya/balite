import './cardFrame.css';
import { getRelicDefinition } from '../engine/relics';
import type {
  BossId,
  CharterId,
  ConsumableInstance,
  ConsumableKind,
  DeckId,
  Edition,
  PackSize,
  PackType,
  PlayingCard,
  RelicId,
  RelicInstance,
  Seal,
  Suit,
} from '../engine/types';
import type { Translator } from '../i18n';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Белый список идентификаторов Навыков (Реликвий), для которых в public/sprites/relics/
 * реально присутствуют растровые .webp-спрайты (защита от 404-запросов в браузере).
 */
export const AVAILABLE_RELIC_SPRITES: ReadonlySet<RelicId> = new Set<RelicId>();

/**
 * Проверяет, существует ли локальный растровый спрайт для указанного Навыка (Реликвии).
 */
export function hasRelicSprite(relicId: RelicId): boolean {
  return AVAILABLE_RELIC_SPRITES.has(relicId);
}

/**
 * Возвращает относительный путь к пиксель-арт спрайту Навыка (Реликвии / Джокера).
 */
export function getRelicSpriteUrl(relicId: RelicId): string {
  return `./sprites/relics/${relicId}.webp`;
}

/**
 * Опции отрисовки слоёного каркаса игральной карты.
 */
export interface PlayingCardFrameOptions {
  readonly card: PlayingCard;
  readonly translator: Translator;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly compact?: boolean;
  readonly faceDown?: boolean;
  readonly triggering?: boolean;
  readonly interactive?: boolean;
}

/**
 * Общие опции отрисовки слоёного каркаса игровой сущности (реликвии, расходники, грамоты, колоды, боссы, наборы).
 */
export interface EntityCardFrameCommonOptions {
  readonly translator: Translator;
  readonly price?: number;
  readonly free?: boolean;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly compact?: boolean;
  readonly interactive?: boolean;
  readonly triggering?: boolean;
}

/**
 * Размеченное объединение параметров для отрисовки карточки любой игровой сущности.
 */
export type EntityCardFrameOptions =
  | (EntityCardFrameCommonOptions & {
      readonly kind: 'relic';
      readonly relic: RelicInstance;
    })
  | (EntityCardFrameCommonOptions & {
      readonly kind: 'consumable';
      readonly consumable: ConsumableInstance;
    })
  | (EntityCardFrameCommonOptions & {
      readonly kind: 'charter';
      readonly charterId: CharterId;
    })
  | (EntityCardFrameCommonOptions & {
      readonly kind: 'deck';
      readonly deckId: DeckId;
      readonly locked?: boolean;
    })
  | (EntityCardFrameCommonOptions & {
      readonly kind: 'boss';
      readonly bossId: BossId;
      readonly disabled?: boolean;
    })
  | (EntityCardFrameCommonOptions & {
      readonly kind: 'pack';
      readonly packType: PackType;
      readonly packSize: PackSize;
    });

/**
 * Ссылки на 4 последовательных слоя каркаса карты (снизу вверх).
 */
interface CardLayers {
  readonly enhancement: HTMLDivElement;
  readonly art: HTMLDivElement;
  readonly chrome: HTMLDivElement;
  readonly fx: HTMLDivElement;
}

/**
 * Позиции пипов (x, y, перевёрнут ли символ) для номерных карт 2..10 в системе координат 120×168.
 * Скорректированы с аккуратным зазором от увеличенных угловых индексов.
 */
const PIP_LAYOUTS: Readonly<
  Record<2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10, readonly (readonly [number, number, boolean?])[]>
> = {
  2: [
    [60, 46],
    [60, 122, true],
  ],
  3: [
    [60, 44],
    [60, 84],
    [60, 124, true],
  ],
  4: [
    [45, 45],
    [75, 45],
    [45, 123, true],
    [75, 123, true],
  ],
  5: [
    [45, 45],
    [75, 45],
    [60, 84],
    [45, 123, true],
    [75, 123, true],
  ],
  6: [
    [45, 45],
    [75, 45],
    [45, 84],
    [75, 84],
    [45, 123, true],
    [75, 123, true],
  ],
  7: [
    [45, 45],
    [75, 45],
    [60, 64],
    [45, 84],
    [75, 84],
    [45, 123, true],
    [75, 123, true],
  ],
  8: [
    [45, 45],
    [75, 45],
    [60, 64],
    [45, 84],
    [75, 84],
    [60, 104, true],
    [45, 123, true],
    [75, 123, true],
  ],
  9: [
    [45, 43],
    [75, 43],
    [45, 68],
    [75, 68],
    [60, 84],
    [45, 100, true],
    [75, 100, true],
    [45, 125, true],
    [75, 125, true],
  ],
  10: [
    [45, 43],
    [75, 43],
    [60, 57],
    [45, 71],
    [75, 71],
    [45, 97, true],
    [75, 97, true],
    [60, 111, true],
    [45, 125, true],
    [75, 125, true],
  ],
};

/**
 * Палитра печатей игральных карт.
 */
const SEAL_COLORS: Readonly<Record<Exclude<Seal, 'none'>, { readonly fill: string; readonly rim: string }>> = {
  gold: { fill: '#f5b942', rim: '#fde68a' },
  red: { fill: '#e84a5f', rim: '#fda4af' },
  blue: { fill: '#3a86ff', rim: '#93c5fd' },
  purple: { fill: '#a855f7', rim: '#d8b4fe' },
};

/**
 * Палитра стартовых колод.
 */
const DECK_PALETTES: Readonly<Record<DeckId, { readonly primary: string; readonly accent: string }>> = {
  b_red: { primary: '#9f1d35', accent: '#fda4af' },
  b_blue: { primary: '#1d4ed8', accent: '#93c5fd' },
  b_yellow: { primary: '#b45309', accent: '#fde047' },
  b_black: { primary: '#1f2937', accent: '#cbd5e1' },
};

/**
 * Категории визуальных алхимических эмблем для 40 Реликвий.
 */
type RelicMotif =
  | 'crystal'
  | 'gem'
  | 'heart'
  | 'spear'
  | 'leaf'
  | 'twins'
  | 'shield'
  | 'banner'
  | 'mountain'
  | 'mask'
  | 'scales'
  | 'compass'
  | 'chalice'
  | 'flame'
  | 'crown'
  | 'blueprint'
  | 'scroll';

const RELIC_MOTIFS: Readonly<Record<RelicId, RelicMotif>> = {
  j_joker: 'crystal',
  j_greedy_joker: 'gem',
  j_lusty_joker: 'heart',
  j_wrathful_joker: 'spear',
  j_gluttenous_joker: 'leaf',
  j_jolly: 'twins',
  j_sly: 'twins',
  j_half: 'shield',
  j_abstract: 'gem',
  j_banner: 'banner',
  j_mystic_summit: 'mountain',
  j_scary_face: 'mask',
  j_even_steven: 'scales',
  j_odd_todd: 'crystal',
  j_runner: 'compass',
  j_green_joker: 'leaf',
  j_photograph: 'crown',
  j_golden: 'chalice',
  j_flash: 'flame',
  j_trousers: 'shield',
  j_ceremonial: 'spear',
  j_blackboard: 'blueprint',
  j_card_sharp: 'crystal',
  j_acrobat: 'compass',
  j_constellation: 'compass',
  j_hologram: 'gem',
  j_vampire: 'chalice',
  j_ramen: 'chalice',
  j_stencil: 'blueprint',
  j_sock_and_buskin: 'mask',
  j_mime: 'mask',
  j_four_fingers: 'crystal',
  j_shortcut: 'compass',
  j_bull: 'shield',
  j_duo: 'twins',
  j_tribe: 'banner',
  j_baron: 'crown',
  j_blueprint: 'blueprint',
  j_brainstorm: 'scroll',
  j_vagabond: 'scroll',
};

/**
 * Создаёт HTML-элемент с опциональным классом и текстом.
 */
function createHtmlEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  textContent?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}

/**
 * Создаёт SVG-элемент в пространстве имён SVG с заданными атрибутами.
 */
function createSvgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Readonly<Record<string, string | number>>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, String(value));
    }
  }
  return el;
}

/**
 * Создаёт корневой SVG-холст фиксированной пропорции 120×168.
 */
function createCardArtSvg(kind: string, fallback = false): SVGSVGElement {
  const svg = createSvgEl('svg', {
    viewBox: '0 0 120 168',
    class: 'card-frame__art-svg',
    'aria-hidden': 'true',
    'data-art-kind': kind,
  });
  if (fallback) {
    svg.setAttribute('data-art-fallback', 'true');
  }
  return svg;
}

/**
 * Создаёт корневой элемент карточки (button при interactive=true, иначе div).
 */
function createCardRoot(interactive?: boolean): HTMLElement {
  if (interactive) {
    const button = document.createElement('button');
    button.type = 'button';
    return button;
  }
  return document.createElement('div');
}

/**
 * Создаёт и монтирует 4 слоя CardFrame в строгом порядке снизу вверх.
 */
function appendFourLayers(root: HTMLElement): CardLayers {
  const enhancement = createHtmlEl('div', 'card-frame__layer-enhancement');
  const art = createHtmlEl('div', 'card-frame__layer-art');
  const chrome = createHtmlEl('div', 'card-frame__layer-chrome');
  const fx = createHtmlEl('div', 'card-frame__layer-fx');
  root.append(enhancement, art, chrome, fx);
  return { enhancement, art, chrome, fx };
}

/**
 * Применяет общие классы и ARIA-атрибуты состояния карточки.
 */
function applyCommonState(
  root: HTMLElement,
  opts: {
    readonly selected?: boolean;
    readonly disabled?: boolean;
    readonly compact?: boolean;
    readonly triggering?: boolean;
    readonly interactive?: boolean;
    readonly debuffed?: boolean;
  },
): void {
  if (opts.interactive) {
    root.classList.add('is-interactive');
  }
  if (opts.compact) {
    root.classList.add('is-compact');
  }
  if (opts.triggering) {
    root.classList.add('is-triggering');
  }
  if (opts.debuffed) {
    root.classList.add('is-debuffed');
  }
  if (opts.selected) {
    root.classList.add('is-selected');
  }
  if (opts.interactive || opts.selected !== undefined) {
    root.setAttribute('aria-pressed', opts.selected ? 'true' : 'false');
  }
  if (opts.disabled) {
    root.classList.add('is-disabled');
    root.setAttribute('aria-disabled', 'true');
    if (root instanceof HTMLButtonElement) {
      root.disabled = true;
    }
  }
}

/**
 * Добавляет эффекты Издания в слой fx и модификатор на корень карточки.
 */
function applyEditionFx(root: HTMLElement, fxLayer: HTMLElement, edition: Edition): void {
  root.dataset.edition = edition;

  // Слой динамического блика (pointer-events: none) для всех открытых карт
  const glare = createHtmlEl('div', 'card-frame__glare card-glare');
  glare.setAttribute('aria-hidden', 'true');

  if (edition === 'base') {
    fxLayer.appendChild(glare);
    return;
  }

  root.classList.add(`card-frame--edition-${edition}`, `card-edition-${edition}`);
  const sheen = createHtmlEl('div', `card-frame__edition-sheen card-frame__fx--${edition}`);
  if (edition === 'holo') {
    root.classList.add('card-frame--edition-holographic', 'card-edition-holographic');
    sheen.classList.add('card-frame__fx--holographic');
  }
  fxLayer.append(sheen, glare);
}

/**
 * Добавляет оверлей Подавления в слой fx.
 */
function appendDebuffOverlay(fxLayer: HTMLElement, label: string): void {
  const overlay = createHtmlEl('div', 'card-frame__debuff-overlay');
  overlay.appendChild(createHtmlEl('span', 'card-frame__debuff-badge', label));
  fxLayer.appendChild(overlay);
}

/**
 * Возвращает SVG-путь масти в локальных координатах [-10..10] вокруг начала координат.
 */
function getSuitPathData(suit: Suit): string {
  switch (suit) {
    case 'spades':
      return 'M 0 -9.5 C -4.2 -4.2 -8.5 -0.8 -8.5 3 C -8.5 5.8 -6.2 7.5 -3.6 7.5 C -2.1 7.5 -1.1 6.7 -0.6 5.9 L -2.3 9.5 L 2.3 9.5 L 0.6 5.9 C 1.1 6.7 2.1 7.5 3.6 7.5 C 6.2 7.5 8.5 5.8 8.5 3 C 8.5 -0.8 4.2 -4.2 0 -9.5 Z';
    case 'hearts':
      return 'M 0 8.8 C -0.4 8.5 -8.5 2.5 -8.5 -2.6 C -8.5 -5.9 -6 -8.2 -3.1 -8.2 C -1.4 -8.2 -0.3 -7.2 0 -6.1 C 0.3 -7.2 1.4 -8.2 3.1 -8.2 C 6 -8.2 8.5 -5.9 8.5 -2.6 C 8.5 2.5 0.4 8.5 0 8.8 Z';
    case 'clubs':
      return 'M 0 -9 C -2.4 -9 -4.2 -7.2 -4.2 -4.9 C -4.2 -3.6 -3.5 -2.5 -2.6 -1.8 C -5.4 -2.2 -8.2 -0.2 -8.2 2.7 C -8.2 5.2 -6.2 7 -3.8 7 C -2.1 7 -0.9 6 -0.5 4.8 L -2 9 L 2 9 L 0.5 4.8 C 0.9 6 2.1 7 3.8 7 C 6.2 7 8.2 5.2 8.2 2.7 C 8.2 -0.2 5.4 -2.2 2.6 -1.8 C 3.5 -2.5 4.2 -3.6 4.2 -4.9 C 4.2 -7.2 2.4 -9 0 -9 Z';
    case 'diamonds':
      return 'M 0 -9.4 L 7.8 0 L 0 9.4 L -7.8 0 Z';
  }
}

/**
 * Создаёт векторный символ масти в заданной точке холста.
 */
function createSuitSymbolGroup(
  suit: Suit,
  cx: number,
  cy: number,
  size: number,
  inverted = false,
  isPip = false,
): SVGGElement {
  const scale = size / 20;
  const rotation = inverted ? ' rotate(180)' : '';
  const group = createSvgEl('g', {
    transform: `translate(${cx} ${cy})${rotation} scale(${scale.toFixed(3)})`,
  });
  if (isPip) {
    group.setAttribute('data-pip', 'true');
  }
  const path = createSvgEl('path', {
    d: getSuitPathData(suit),
    fill: 'var(--suit-color)',
  });
  group.appendChild(path);
  return group;
}

/**
 * Создаёт тонкую алхимическую внутреннюю рамку внутри SVG карты.
 */
function appendInnerFrame(svg: SVGSVGElement, stroke: string, opacity = 0.25): void {
  svg.appendChild(
    createSvgEl('rect', {
      x: 10,
      y: 10,
      width: 100,
      height: 148,
      rx: 7,
      fill: 'none',
      stroke,
      'stroke-width': 1.2,
      opacity,
    }),
  );
}

/**
 * Создаёт SVG-иллюстрацию рубашки игральной карты.
 */
function createPlayingCardBackSvg(): SVGSVGElement {
  const svg = createCardArtSvg('back');
  appendInnerFrame(svg, 'var(--card-back-accent, #f5b942)', 0.65);
  svg.appendChild(
    createSvgEl('rect', {
      x: 16,
      y: 16,
      width: 88,
      height: 136,
      rx: 5,
      fill: 'none',
      stroke: 'var(--card-back-secondary, #93c5fd)',
      'stroke-width': 0.9,
      'stroke-dasharray': '3 3',
      opacity: 0.55,
    }),
  );
  svg.appendChild(
    createSvgEl('circle', {
      cx: 60,
      cy: 84,
      r: 28,
      fill: 'none',
      stroke: 'var(--card-back-accent, #f5b942)',
      'stroke-width': 1.5,
    }),
  );
  svg.appendChild(
    createSvgEl('circle', {
      cx: 60,
      cy: 84,
      r: 18,
      fill: 'rgba(245, 185, 66, 0.14)',
      stroke: 'var(--card-back-secondary, #93c5fd)',
      'stroke-width': 1,
    }),
  );
  // 8-лучевая путеводная звезда алхимика
  svg.appendChild(
    createSvgEl('path', {
      d: 'M 60 50 L 65 79 L 94 84 L 65 89 L 60 118 L 55 89 L 26 84 L 55 79 Z',
      fill: 'var(--card-back-accent, #f5b942)',
      opacity: 0.9,
    }),
  );
  svg.appendChild(
    createSvgEl('path', {
      d: 'M 42 66 L 57 81 L 78 66 L 63 84 L 78 102 L 57 87 L 42 102 L 57 84 Z',
      fill: 'var(--card-back-secondary, #93c5fd)',
      opacity: 0.65,
    }),
  );
  return svg;
}

/**
 * Создаёт SVG-иллюстрацию для игральной карты: номерной 2..10, придворной 11..14, Каменной или рубашки.
 */
function createPlayingCardSvg(card: PlayingCard, isFaceDown: boolean): SVGSVGElement {
  if (isFaceDown) {
    return createPlayingCardBackSvg();
  }

  if (card.enhancement === 'stone') {
    const svg = createCardArtSvg('stone');
    appendInnerFrame(svg, '#94a3b8', 0.45);
    // Базальтовая руническая скрижаль без ранга и масти
    svg.appendChild(
      createSvgEl('polygon', {
        points: '60,24 94,40 98,128 60,144 22,128 26,40',
        fill: 'rgba(15, 23, 42, 0.42)',
        stroke: '#cbd5e1',
        'stroke-width': 1.6,
      }),
    );
    svg.appendChild(
      createSvgEl('path', {
        d: 'M 60 44 L 76 66 L 60 88 L 44 66 Z M 48 106 L 60 88 L 72 106 M 44 82 L 76 82',
        fill: 'none',
        stroke: '#fbbf24',
        'stroke-width': 2.8,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }),
    );
    svg.appendChild(
      createSvgEl('path', {
        d: 'M 32 48 L 45 55 M 86 116 L 72 109 M 29 114 L 40 106',
        stroke: '#94a3b8',
        'stroke-width': 1.2,
        opacity: 0.7,
      }),
    );
    return svg;
  }

  if (card.rank <= 10) {
    const svg = createCardArtSvg('pip');
    appendInnerFrame(svg, '#b08d57', 0.22);
    const coords = PIP_LAYOUTS[card.rank as keyof typeof PIP_LAYOUTS];
    for (const [x, y, inverted] of coords) {
      svg.appendChild(createSuitSymbolGroup(card.suit, x, y, 22, Boolean(inverted), true));
    }
    return svg;
  }

  // Придворные карты 11..14 в стиле «Руническая Алхимия и Астрология» (встроенный SVG fallback)
  const artKind = card.rank === 14 ? 'ace' : 'court';
  const svg = createCardArtSvg(artKind, true);
  appendInnerFrame(svg, '#b08d57', 0.35);

  // Астрологический медальон позади фигуры
  svg.appendChild(
    createSvgEl('circle', {
      cx: 60,
      cy: 84,
      r: 33,
      fill: 'rgba(245, 185, 66, 0.08)',
      stroke: 'var(--suit-color)',
      'stroke-width': 1.4,
      opacity: 0.6,
    }),
  );
  svg.appendChild(
    createSvgEl('circle', {
      cx: 60,
      cy: 84,
      r: 25,
      fill: 'none',
      stroke: '#b08d57',
      'stroke-width': 1,
      'stroke-dasharray': '3 2',
      opacity: 0.75,
    }),
  );

  if (card.rank === 11) {
    // Валет (Адепт): геральдический щит и скрещённые алхимические жезлы
    svg.appendChild(
      createSvgEl('path', {
        d: 'M 34 56 L 86 112 M 86 56 L 34 112',
        stroke: '#b08d57',
        'stroke-width': 2.2,
        'stroke-linecap': 'round',
      }),
    );
    svg.appendChild(
      createSvgEl('path', {
        d: 'M 42 60 L 78 60 L 76 92 C 76 104 60 114 60 114 C 60 114 44 104 44 92 Z',
        fill: 'rgba(255, 255, 255, 0.45)',
        stroke: 'var(--suit-color)',
        'stroke-width': 2,
      }),
    );
    svg.appendChild(createSuitSymbolGroup(card.suit, 60, 84, 24));
  } else if (card.rank === 12) {
    // Дама (Хранительница): тиара полумесяца и распускающийся лотос-фиал
    svg.appendChild(
      createSvgEl('path', {
        d: 'M 42 54 Q 60 36 78 54 Q 60 46 42 54 Z',
        fill: '#d97706',
        stroke: 'var(--suit-color)',
        'stroke-width': 1.2,
      }),
    );
    svg.appendChild(
      createSvgEl('polygon', {
        points: '60,54 84,84 60,114 36,84',
        fill: 'rgba(255, 255, 255, 0.42)',
        stroke: 'var(--suit-color)',
        'stroke-width': 1.8,
      }),
    );
    svg.appendChild(createSuitSymbolGroup(card.suit, 60, 84, 26));
  } else if (card.rank === 13) {
    // Король (Магистр): солнечная корона и алхимический скипетр
    svg.appendChild(
      createSvgEl('path', {
        d: 'M 38 60 L 42 42 L 52 52 L 60 36 L 68 52 L 78 42 L 82 60 Z',
        fill: '#eab308',
        stroke: 'var(--suit-color)',
        'stroke-width': 1.5,
        'stroke-linejoin': 'round',
      }),
    );
    svg.appendChild(
      createSvgEl('rect', {
        x: 40,
        y: 66,
        width: 40,
        height: 44,
        rx: 8,
        fill: 'rgba(255, 255, 255, 0.44)',
        stroke: 'var(--suit-color)',
        'stroke-width': 2,
      }),
    );
    svg.appendChild(createSuitSymbolGroup(card.suit, 60, 88, 26));
  } else {
    // Туз (Первоэлемент): крупная восьмилучевая звезда и центральная масть
    svg.appendChild(
      createSvgEl('path', {
        d: 'M 60 38 L 68 72 L 100 84 L 68 96 L 60 130 L 52 96 L 20 84 L 52 72 Z',
        fill: 'rgba(245, 185, 66, 0.25)',
        stroke: '#b08d57',
        'stroke-width': 1.4,
      }),
    );
    svg.appendChild(createSuitSymbolGroup(card.suit, 60, 84, 40));
  }

  return svg;
}

/**
 * Создаёт угловой индекс (ранг + символ масти) для игральной карты.
 */
function createCornerIndex(rankLabel: string, suitSymbol: string, position: 'top' | 'bottom'): HTMLDivElement {
  const corner = createHtmlEl('div', `card-frame__corner card-frame__corner--${position}`);
  corner.appendChild(createHtmlEl('span', 'card-frame__rank', rankLabel));
  corner.appendChild(createHtmlEl('span', 'card-frame__suit', suitSymbol));
  return corner;
}

/**
 * Создаёт SVG-значок восковой/рунической печати в углу карты.
 */
function createSealBadge(seal: Exclude<Seal, 'none'>, titleText: string): HTMLDivElement {
  const sealEl = createHtmlEl('div', `card-frame__seal card-frame__seal--${seal}`);
  sealEl.setAttribute('data-seal', seal);
  sealEl.setAttribute('aria-label', titleText);

  const palette = SEAL_COLORS[seal];
  const svg = createSvgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  svg.appendChild(
    createSvgEl('circle', {
      cx: 12,
      cy: 12,
      r: 10,
      fill: palette.fill,
      stroke: palette.rim,
      'stroke-width': 1.8,
    }),
  );
  svg.appendChild(
    createSvgEl('path', {
      d: 'M 12 5.5 L 13.8 10.2 L 18.5 12 L 13.8 13.8 L 12 18.5 L 10.2 13.8 L 5.5 12 L 10.2 10.2 Z',
      fill: '#ffffff',
      opacity: 0.9,
    }),
  );
  sealEl.appendChild(svg);
  return sealEl;
}

/**
 * Отрисовывает слоёный каркас игральной карты с 4 слоями (Подложка -> SVG Арт -> Хром -> Эффекты).
 */
export function renderPlayingCardFrame(options: PlayingCardFrameOptions): HTMLElement {
  const { card, translator } = options;
  const isFaceDown = options.faceDown ?? card.facing === 'back';
  const isStone = card.enhancement === 'stone';

  const root = createCardRoot(options.interactive);
  root.className = 'card-frame card-frame--playing';
  root.dataset.cardId = card.id;
  root.dataset.cardKind = 'playing';

  if (isFaceDown) {
    root.classList.add('is-face-down');
    root.dataset.faceDown = 'true';
  } else {
    root.dataset.enhancement = card.enhancement;
    if (!isStone) {
      root.classList.add(`card-frame--suit-${card.suit}`);
      root.dataset.suit = card.suit;
      root.dataset.rank = String(card.rank);
    }
    if (card.seal !== 'none') {
      root.dataset.seal = card.seal;
    }
  }

  if (card.forcedSelection && !isFaceDown) {
    root.classList.add('is-forced');
  }

  applyCommonState(root, {
    selected: options.selected,
    disabled: options.disabled,
    compact: options.compact,
    triggering: options.triggering,
    interactive: options.interactive,
    debuffed: card.debuffed,
  });

  if (!isFaceDown) {
    if (isStone) {
      root.setAttribute('aria-label', translator.catalog.enhancements.stone.name);
    } else {
      const rankFull = translator.getRankLabel(card.rank, false);
      const suitName = translator.catalog.suits[card.suit].name;
      const label =
        card.enhancement !== 'none'
          ? `${rankFull} ${suitName} — ${translator.catalog.enhancements[card.enhancement].name}`
          : `${rankFull} ${suitName}`;
      root.setAttribute('aria-label', label);
    }
  }

  const layers = appendFourLayers(root);

  // Слой 1: Подложка Улучшения
  if (isFaceDown) {
    layers.enhancement.classList.add('card-frame__enhancement--back');
  } else if (card.enhancement === 'none') {
    layers.enhancement.classList.add(
      'card-frame__enhancement--base',
      'card-frame__enhancement--none',
    );
  } else {
    layers.enhancement.classList.add(`card-frame__enhancement--${card.enhancement}`);
  }

  // Слой 2: Векторный SVG арт (номерные пипы, придворные, камень или рубашка)
  layers.art.appendChild(createPlayingCardSvg(card, isFaceDown));

  // Слой 3: Угловые индексы и бейдж улучшения
  if (!isFaceDown) {
    if (!isStone) {
      const rankShort = translator.getRankLabel(card.rank, true);
      const suitSymbol = translator.catalog.suits[card.suit].symbol;
      layers.chrome.append(
        createCornerIndex(rankShort, suitSymbol, 'top'),
        createCornerIndex(rankShort, suitSymbol, 'bottom'),
      );
    }

    if (card.enhancement !== 'none') {
      const enhName = translator.catalog.enhancements[card.enhancement].name;
      layers.chrome.appendChild(createHtmlEl('span', 'card-frame__enhancement-badge', enhName));
    }
  }

  // Слой 4: Издания, Печати и оверлей Подавления
  if (!isFaceDown) {
    applyEditionFx(root, layers.fx, card.edition);
    if (card.seal !== 'none') {
      layers.fx.appendChild(createSealBadge(card.seal, translator.catalog.seals[card.seal].name));
    }
  }

  if (card.debuffed) {
    appendDebuffOverlay(layers.fx, translator.t('ui.hud.debuffedBadge'));
  }

  return root;
}

/**
 * Переключает DOM-элемент игральной карты (или содержащий её слот-призрак) в вид рубашки
 * ровно в момент прохождения угла 90° при 3D-перевороте сброса.
 */
export function flipCardFrameToBack(root: HTMLElement): void {
  const frameEl = root.classList.contains('card-frame')
    ? root
    : root.querySelector<HTMLElement>('.card-frame');
  if (!frameEl || frameEl.classList.contains('is-face-down')) {
    return;
  }

  frameEl.classList.add('is-face-down');
  frameEl.classList.remove('is-forced', 'is-selected', 'is-triggering');
  frameEl.dataset.faceDown = 'true';

  const enhLayer = frameEl.querySelector<HTMLElement>('.card-frame__layer-enhancement');
  if (enhLayer) {
    enhLayer.className =
      'card-frame__layer card-frame__layer-enhancement card-frame__enhancement--back';
  }

  const artLayer = frameEl.querySelector<HTMLElement>('.card-frame__layer-art');
  if (artLayer) {
    artLayer.replaceChildren(createPlayingCardBackSvg());
  }

  const chromeLayer = frameEl.querySelector<HTMLElement>('.card-frame__layer-chrome');
  if (chromeLayer) {
    chromeLayer.replaceChildren();
  }

  const fxLayer = frameEl.querySelector<HTMLElement>('.card-frame__layer-fx');
  if (fxLayer) {
    fxLayer.replaceChildren();
  }
}

/**
 * Рисует центральную алхимическую эмблему для Реликвии в области (60, 62).
 */
function appendRelicMotif(svg: SVGSVGElement, motif: RelicMotif, accent: string): void {
  svg.appendChild(
    createSvgEl('circle', {
      cx: 60,
      cy: 62,
      r: 34,
      fill: 'rgba(15, 23, 42, 0.45)',
      stroke: accent,
      'stroke-width': 1.6,
    }),
  );

  switch (motif) {
    case 'crystal':
    case 'gem':
      svg.appendChild(
        createSvgEl('polygon', {
          points: '60,34 80,54 72,88 48,88 40,54',
          fill: accent,
          opacity: 0.85,
          stroke: '#f8fafc',
          'stroke-width': 1.5,
        }),
      );
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 60 34 L 60 88 M 40 54 L 80 54',
          stroke: '#ffffff',
          'stroke-width': 1,
          opacity: 0.7,
        }),
      );
      break;
    case 'heart':
      svg.appendChild(createSuitSymbolGroup('hearts', 60, 62, 42));
      break;
    case 'spear':
      svg.appendChild(createSuitSymbolGroup('spades', 60, 62, 42));
      break;
    case 'leaf':
      svg.appendChild(createSuitSymbolGroup('clubs', 60, 62, 42));
      break;
    case 'twins':
    case 'scales':
      svg.appendChild(
        createSvgEl('circle', { cx: 49, cy: 62, r: 14, fill: 'none', stroke: accent, 'stroke-width': 2.4 }),
      );
      svg.appendChild(
        createSvgEl('circle', { cx: 71, cy: 62, r: 14, fill: 'none', stroke: '#fde68a', 'stroke-width': 2.4 }),
      );
      break;
    case 'shield':
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 42 42 L 78 42 L 76 68 C 76 80 60 88 60 88 C 60 88 44 80 44 68 Z',
          fill: 'rgba(255,255,255,0.12)',
          stroke: accent,
          'stroke-width': 2.2,
        }),
      );
      break;
    case 'banner':
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 43 38 L 77 38 L 77 86 L 60 76 L 43 86 Z',
          fill: accent,
          opacity: 0.82,
          stroke: '#f8fafc',
          'stroke-width': 1.4,
        }),
      );
      break;
    case 'mountain':
      svg.appendChild(
        createSvgEl('polygon', {
          points: '34,82 54,44 66,64 74,50 86,82',
          fill: accent,
          opacity: 0.85,
          stroke: '#f8fafc',
          'stroke-width': 1.4,
        }),
      );
      break;
    case 'mask':
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 40 46 Q 60 38 80 46 L 76 74 Q 60 88 44 74 Z',
          fill: 'rgba(248, 250, 252, 0.16)',
          stroke: accent,
          'stroke-width': 2,
        }),
      );
      svg.appendChild(createSvgEl('circle', { cx: 51, cy: 59, r: 3.5, fill: '#f8fafc' }));
      svg.appendChild(createSvgEl('circle', { cx: 69, cy: 59, r: 3.5, fill: '#f8fafc' }));
      svg.appendChild(
        createSvgEl('path', { d: 'M 52 72 Q 60 77 68 72', fill: 'none', stroke: accent, 'stroke-width': 2 }),
      );
      break;
    case 'compass':
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 60 34 L 66 56 L 88 62 L 66 68 L 60 90 L 54 68 L 32 62 L 54 56 Z',
          fill: accent,
          stroke: '#fffbeb',
          'stroke-width': 1.2,
        }),
      );
      break;
    case 'chalice':
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 44 42 L 76 42 L 70 64 Q 60 72 50 64 Z M 60 68 L 60 84 M 48 84 L 72 84',
          fill: accent,
          opacity: 0.86,
          stroke: '#fde68a',
          'stroke-width': 2,
          'stroke-linejoin': 'round',
        }),
      );
      break;
    case 'flame':
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 60 34 C 74 50 78 68 60 88 C 42 68 46 50 60 34 Z',
          fill: '#fb923c',
          stroke: '#fef3c7',
          'stroke-width': 1.6,
        }),
      );
      break;
    case 'crown':
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 38 74 L 42 48 L 52 58 L 60 40 L 68 58 L 78 48 L 82 74 Z',
          fill: '#fbbf24',
          stroke: '#fef3c7',
          'stroke-width': 1.5,
          'stroke-linejoin': 'round',
        }),
      );
      break;
    case 'blueprint':
      svg.appendChild(
        createSvgEl('rect', {
          x: 40,
          y: 42,
          width: 40,
          height: 40,
          rx: 4,
          fill: 'rgba(56, 189, 248, 0.2)',
          stroke: '#7dd3fc',
          'stroke-width': 1.8,
        }),
      );
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 40 62 L 80 62 M 60 42 L 60 82',
          stroke: '#bae6fd',
          'stroke-width': 1.2,
          'stroke-dasharray': '3 2',
        }),
      );
      break;
    case 'scroll':
      svg.appendChild(
        createSvgEl('rect', {
          x: 43,
          y: 42,
          width: 34,
          height: 42,
          rx: 5,
          fill: '#fef3c7',
          opacity: 0.88,
          stroke: '#d97706',
          'stroke-width': 1.8,
        }),
      );
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 50 54 L 70 54 M 50 63 L 70 63 M 50 72 L 64 72',
          stroke: '#92400e',
          'stroke-width': 1.8,
          'stroke-linecap': 'round',
        }),
      );
      break;
  }
}

/**
 * Создаёт тематическую SVG-эмблему для расходника (Сфера, Свиток, Руна).
 */
function createConsumableSvg(consumable: ConsumableInstance): SVGSVGElement {
  const svg = createCardArtSvg(`consumable-${consumable.kind}`, true);
  appendInnerFrame(svg, '#94a3b8', 0.35);

  if (consumable.kind === 'celestial') {
    // Астральная сфера с наклонным кольцом и созвездием
    svg.appendChild(createSvgEl('circle', { cx: 30, cy: 36, r: 1.5, fill: '#e0f2fe' }));
    svg.appendChild(createSvgEl('circle', { cx: 88, cy: 38, r: 1.8, fill: '#fde68a' }));
    svg.appendChild(createSvgEl('circle', { cx: 92, cy: 84, r: 1.4, fill: '#bae6fd' }));
    svg.appendChild(
      createSvgEl('ellipse', {
        cx: 60,
        cy: 62,
        rx: 38,
        ry: 11,
        transform: 'rotate(-20 60 62)',
        fill: 'none',
        stroke: '#7dd3fc',
        'stroke-width': 2.2,
        opacity: 0.85,
      }),
    );
    svg.appendChild(
      createSvgEl('circle', {
        cx: 60,
        cy: 62,
        r: 22,
        fill: '#38bdf8',
        stroke: '#e0f2fe',
        'stroke-width': 1.8,
      }),
    );
    svg.appendChild(
      createSvgEl('path', {
        d: 'M 46 54 Q 60 44 74 56',
        fill: 'none',
        stroke: '#bae6fd',
        'stroke-width': 1.6,
        opacity: 0.8,
      }),
    );
  } else if (consumable.kind === 'scroll') {
    // Развёрнутый Алхимический свиток с печатью
    svg.appendChild(
      createSvgEl('rect', {
        x: 34,
        y: 34,
        width: 52,
        height: 58,
        rx: 4,
        fill: '#f5deb3',
        stroke: '#d97706',
        'stroke-width': 1.8,
      }),
    );
    svg.appendChild(
      createSvgEl('rect', { x: 28, y: 31, width: 64, height: 8, rx: 4, fill: '#b45309' }),
    );
    svg.appendChild(
      createSvgEl('rect', { x: 28, y: 87, width: 64, height: 8, rx: 4, fill: '#b45309' }),
    );
    svg.appendChild(
      createSvgEl('circle', {
        cx: 60,
        cy: 62,
        r: 14,
        fill: 'none',
        stroke: '#92400e',
        'stroke-width': 1.6,
      }),
    );
    svg.appendChild(
      createSvgEl('polygon', {
        points: '60,51 70,69 50,69',
        fill: 'none',
        stroke: '#b45309',
        'stroke-width': 1.6,
      }),
    );
  } else {
    // Эфирная руна (или звёздный вихрь для c_black_hole)
    if (consumable.id === 'c_black_hole') {
      svg.appendChild(
        createSvgEl('circle', {
          cx: 60,
          cy: 62,
          r: 30,
          fill: 'none',
          stroke: '#c084fc',
          'stroke-width': 2.2,
          'stroke-dasharray': '8 4',
        }),
      );
      svg.appendChild(
        createSvgEl('circle', {
          cx: 60,
          cy: 62,
          r: 16,
          fill: '#090d16',
          stroke: '#f5b942',
          'stroke-width': 2,
        }),
      );
    } else {
      svg.appendChild(
        createSvgEl('polygon', {
          points: '60,28 84,52 76,92 44,92 36,52',
          fill: 'rgba(168, 85, 247, 0.25)',
          stroke: '#d8b4fe',
          'stroke-width': 2,
        }),
      );
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 60 40 L 60 82 M 48 54 L 60 66 L 72 54 M 50 74 L 70 74',
          fill: 'none',
          stroke: '#fde68a',
          'stroke-width': 2.2,
          'stroke-linecap': 'round',
        }),
      );
    }
  }

  return svg;
}

/**
 * Рисует индивидуальный геральдический знак Босса на щите Стража.
 */
function appendBossEmblem(svg: SVGSVGElement, bossId: BossId): void {
  switch (bossId) {
    case 'bl_hook':
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 60 40 V 74 A 10 10 0 0 1 44 68 M 48 52 H 72',
          fill: 'none',
          stroke: '#fbbf24',
          'stroke-width': 3,
          'stroke-linecap': 'round',
        }),
      );
      break;
    case 'bl_manacle':
      svg.appendChild(
        createSvgEl('circle', {
          cx: 50,
          cy: 60,
          r: 10,
          fill: 'none',
          stroke: '#cbd5e1',
          'stroke-width': 3,
        }),
      );
      svg.appendChild(
        createSvgEl('circle', {
          cx: 70,
          cy: 60,
          r: 10,
          fill: 'none',
          stroke: '#cbd5e1',
          'stroke-width': 3,
        }),
      );
      break;
    case 'bl_psychic':
      svg.appendChild(
        createSvgEl('ellipse', {
          cx: 60,
          cy: 60,
          rx: 18,
          ry: 11,
          fill: 'rgba(192, 132, 252, 0.25)',
          stroke: '#e879f9',
          'stroke-width': 2.2,
        }),
      );
      svg.appendChild(createSvgEl('circle', { cx: 60, cy: 60, r: 5, fill: '#fde047' }));
      break;
    case 'bl_pillar':
      svg.appendChild(
        createSvgEl('rect', {
          x: 50,
          y: 40,
          width: 20,
          height: 38,
          rx: 2,
          fill: '#e2e8f0',
          stroke: '#94a3b8',
          'stroke-width': 1.8,
        }),
      );
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 46 40 H 74 M 46 78 H 74',
          stroke: '#fbbf24',
          'stroke-width': 3,
          'stroke-linecap': 'round',
        }),
      );
      break;
    case 'bl_club':
      svg.appendChild(createSuitSymbolGroup('clubs', 60, 60, 34));
      svg.appendChild(
        createSvgEl('line', {
          x1: 44,
          y1: 76,
          x2: 76,
          y2: 44,
          stroke: '#fb7185',
          'stroke-width': 2.6,
          'stroke-linecap': 'round',
        }),
      );
      break;
    case 'bl_water':
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 60 39 C 72 55 75 68 60 79 C 45 68 48 55 60 39 Z',
          fill: '#38bdf8',
          stroke: '#e0f2fe',
          'stroke-width': 1.8,
        }),
      );
      break;
    case 'bl_wall':
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 44 76 V 46 H 50 V 52 H 57 V 46 H 63 V 52 H 70 V 46 H 76 V 76 Z',
          fill: '#cbd5e1',
          stroke: '#475569',
          'stroke-width': 1.6,
        }),
      );
      break;
    case 'bl_flint':
      svg.appendChild(
        createSvgEl('polygon', {
          points: '60,38 74,60 60,82 46,60',
          fill: '#fb923c',
          stroke: '#fef3c7',
          'stroke-width': 1.8,
        }),
      );
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 42 60 H 78',
          stroke: '#0f172a',
          'stroke-width': 2.2,
        }),
      );
      break;
    case 'bl_final_vessel':
      svg.appendChild(
        createSvgEl('polygon', {
          points: '60,36 78,58 70,84 50,84 42,58',
          fill: '#a855f7',
          stroke: '#f3e8ff',
          'stroke-width': 2,
        }),
      );
      break;
    case 'bl_final_bell':
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 60 40 C 48 42 45 58 43 72 H 77 C 75 58 72 42 60 40 Z M 55 74 A 5 5 0 0 0 65 74',
          fill: '#38bdf8',
          stroke: '#e0f2fe',
          'stroke-width': 1.8,
        }),
      );
      break;
  }
}

/**
 * Рисует центральную эмблему типа бустер-набора.
 */
function appendPackTypeEmblem(svg: SVGSVGElement, packType: PackType): void {
  switch (packType) {
    case 'arcana':
      svg.appendChild(
        createSvgEl('rect', {
          x: 47,
          y: 50,
          width: 26,
          height: 26,
          rx: 3,
          fill: '#fde68a',
          stroke: '#d97706',
          'stroke-width': 1.6,
        }),
      );
      break;
    case 'celestial':
      svg.appendChild(
        createSvgEl('circle', {
          cx: 60,
          cy: 63,
          r: 12,
          fill: '#38bdf8',
          stroke: '#e0f2fe',
          'stroke-width': 1.6,
        }),
      );
      svg.appendChild(
        createSvgEl('ellipse', {
          cx: 60,
          cy: 63,
          rx: 20,
          ry: 6,
          transform: 'rotate(-18 60 63)',
          fill: 'none',
          stroke: '#bae6fd',
          'stroke-width': 1.4,
        }),
      );
      break;
    case 'standard':
      svg.appendChild(
        createSvgEl('rect', {
          x: 49,
          y: 48,
          width: 22,
          height: 30,
          rx: 3,
          fill: '#f8fafc',
          stroke: '#64748b',
          'stroke-width': 1.6,
        }),
      );
      svg.appendChild(createSuitSymbolGroup('diamonds', 60, 63, 14));
      break;
    case 'buffoon':
      svg.appendChild(
        createSvgEl('polygon', {
          points: '60,48 75,63 60,78 45,63',
          fill: '#fbbf24',
          stroke: '#fef3c7',
          'stroke-width': 1.6,
        }),
      );
      break;
    case 'spectral':
      svg.appendChild(
        createSvgEl('polygon', {
          points: '60,47 74,59 69,77 51,77 46,59',
          fill: '#a855f7',
          stroke: '#f3e8ff',
          'stroke-width': 1.6,
        }),
      );
      break;
  }
}

/**
 * Создаёт тематическую SVG-эмблему для Грамоты, Колоды, Босса или Бустер-набора.
 */
function createEntitySvg(options: EntityCardFrameOptions): SVGSVGElement {
  switch (options.kind) {
    case 'relic': {
      const def = getRelicDefinition(options.relic.id);
      const accentByRarity = def.rarity === 3 ? '#fbbf24' : def.rarity === 2 ? '#2dd4bf' : '#60a5fa';
      const svg = createCardArtSvg('relic', true);
      appendInnerFrame(svg, accentByRarity, 0.45);
      appendRelicMotif(svg, RELIC_MOTIFS[options.relic.id], accentByRarity);
      return svg;
    }

    case 'consumable':
      return createConsumableSvg(options.consumable);

    case 'charter': {
      const svg = createCardArtSvg('charter', true);
      appendInnerFrame(svg, '#fbbf24', 0.45);
      svg.appendChild(
        createSvgEl('rect', {
          x: 32,
          y: 30,
          width: 56,
          height: 64,
          rx: 4,
          fill: '#fef3c7',
          stroke: '#f59e0b',
          'stroke-width': 2,
        }),
      );
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 42 44 L 78 44 M 42 54 L 78 54 M 42 64 L 66 64',
          stroke: '#78350f',
          'stroke-width': 2,
          'stroke-linecap': 'round',
        }),
      );
      // Восковая печать гильдии
      svg.appendChild(
        createSvgEl('circle', {
          cx: 72,
          cy: 78,
          r: 11,
          fill: '#be123c',
          stroke: '#fbbf24',
          'stroke-width': 1.8,
        }),
      );
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 68 87 L 64 100 L 72 95 L 80 100 L 76 87',
          fill: '#fbbf24',
        }),
      );
      return svg;
    }

    case 'deck': {
      const palette = DECK_PALETTES[options.deckId];
      const svg = createCardArtSvg('deck', true);
      appendInnerFrame(svg, palette.accent, 0.45);
      svg.appendChild(
        createSvgEl('rect', {
          x: 36,
          y: 34,
          width: 48,
          height: 64,
          rx: 6,
          fill: palette.primary,
          stroke: palette.accent,
          'stroke-width': 2,
        }),
      );
      svg.appendChild(
        createSvgEl('rect', {
          x: 42,
          y: 40,
          width: 36,
          height: 52,
          rx: 4,
          fill: 'none',
          stroke: palette.accent,
          'stroke-width': 1,
          'stroke-dasharray': '3 2',
        }),
      );
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 60 50 L 66 66 L 60 82 L 54 66 Z',
          fill: palette.accent,
        }),
      );
      if (options.locked) {
        svg.appendChild(
          createSvgEl('rect', {
            x: 49,
            y: 60,
            width: 22,
            height: 18,
            rx: 3,
            fill: '#1e293b',
            stroke: '#f8fafc',
            'stroke-width': 1.6,
          }),
        );
        svg.appendChild(
          createSvgEl('path', {
            d: 'M 53 60 V 54 A 7 7 0 0 1 67 54 V 60',
            fill: 'none',
            stroke: '#f8fafc',
            'stroke-width': 2,
          }),
        );
      }
      return svg;
    }

    case 'boss': {
      const svg = createCardArtSvg('boss', true);
      appendInnerFrame(svg, '#fb7185', 0.45);
      // Геральдический щит Стража и индивидуальный знак Босса
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 32 30 L 88 30 L 84 70 C 84 85 60 98 60 98 C 60 98 36 85 36 70 Z',
          fill: 'rgba(136, 19, 55, 0.48)',
          stroke: '#fda4af',
          'stroke-width': 2,
        }),
      );
      appendBossEmblem(svg, options.bossId);
      return svg;
    }

    case 'pack': {
      const svg = createCardArtSvg(`pack-${options.packType}`, true);
      appendInnerFrame(svg, '#f5b942', 0.42);
      svg.appendChild(
        createSvgEl('rect', {
          x: 34,
          y: 30,
          width: 52,
          height: 66,
          rx: 6,
          fill: 'rgba(30, 41, 59, 0.72)',
          stroke: '#f5b942',
          'stroke-width': 2,
        }),
      );
      svg.appendChild(
        createSvgEl('path', {
          d: 'M 34 42 L 86 42 M 34 84 L 86 84',
          stroke: '#fde68a',
          'stroke-width': 1.4,
        }),
      );
      // Звёзды размера набора (1 для normal, 2 для jumbo, 3 для mega)
      const starsCount = options.packSize === 'mega' ? 3 : options.packSize === 'jumbo' ? 2 : 1;
      const startX = 60 - ((starsCount - 1) * 12) / 2;
      for (let i = 0; i < starsCount; i += 1) {
        const sx = startX + i * 12;
        svg.appendChild(
          createSvgEl('polygon', {
            points: `${sx},33 ${sx + 2},37 ${sx + 5},37 ${sx + 2.5},39.5 ${sx + 3.5},43 ${sx},41 ${sx - 3.5},43 ${sx - 2.5},39.5 ${sx - 5},37 ${sx - 2},37`,
            fill: '#fde047',
          }),
        );
      }
      appendPackTypeEmblem(svg, options.packType);
      return svg;
    }
  }
}

/**
 * Определяет CSS-класс подложки сущности по её типу и подтипу.
 */
function getEntityEnhancementClass(options: EntityCardFrameOptions): string {
  if (options.kind === 'consumable') {
    return `card-frame__enhancement--entity-${options.consumable.kind}`;
  }
  return `card-frame__enhancement--entity-${options.kind}`;
}

/**
 * Отрисовывает слоёный каркас сущности (Реликвия, Расходник, Грамота, Колода, Босс, Бустер).
 */
export function renderEntityCardFrame(options: EntityCardFrameOptions): HTMLElement {
  const { translator } = options;
  const isLocked = options.kind === 'deck' && Boolean(options.locked);
  const isDisabled = Boolean(options.disabled || isLocked);
  const isDebuffed = options.kind === 'relic' && options.relic.debuffed;
  const edition: Edition =
    options.kind === 'relic'
      ? options.relic.edition
      : options.kind === 'consumable'
        ? options.consumable.edition
        : 'base';

  const root = createCardRoot(options.interactive);
  root.className = `card-frame card-frame--entity card-frame--${options.kind}`;
  root.dataset.cardKind = options.kind;

  if (isLocked) {
    root.classList.add('is-locked');
  }

  applyCommonState(root, {
    selected: options.selected,
    disabled: isDisabled,
    compact: options.compact,
    triggering: options.triggering,
    interactive: options.interactive,
    debuffed: isDebuffed,
  });

  const layers = appendFourLayers(root);
  layers.enhancement.classList.add(getEntityEnhancementClass(options));
  layers.art.appendChild(createEntitySvg(options));

  let titleText = '';
  let kindBadgeText: string | null = null;

  switch (options.kind) {
    case 'relic': {
      const def = getRelicDefinition(options.relic.id);
      const rarityKey = String(def.rarity) as '1' | '2' | '3';
      const rarityLabel = translator.catalog.rarities[rarityKey];
      root.dataset.relicUid = options.relic.uid;
      root.dataset.relicId = options.relic.id;
      root.dataset.rarity = rarityKey;
      root.classList.add(`card-frame--rarity-${rarityKey}`);

      titleText = translator.getRelicText(options.relic.id).name;
      layers.chrome.appendChild(createHtmlEl('span', 'card-frame__rarity-badge', rarityLabel));

      if (hasRelicSprite(options.relic.id)) {
        const spriteUrl = getRelicSpriteUrl(options.relic.id);
        const img = createHtmlEl('img', 'card-frame__relic-sprite') as HTMLImageElement;
        img.src = spriteUrl;
        img.alt = '';
        img.loading = 'eager';
        img.draggable = false;
        img.onerror = () => {
          img.remove();
        };
        layers.art.appendChild(img);
      }
      break;
    }

    case 'consumable': {
      const kindKey: ConsumableKind = options.consumable.kind;
      root.dataset.consumableUid = options.consumable.uid;
      root.dataset.consumableId = options.consumable.id;
      root.dataset.consumableKind = kindKey;

      titleText = translator.getConsumableText(options.consumable.id).name;
      kindBadgeText = translator.catalog.consumableKinds[kindKey];
      break;
    }

    case 'charter': {
      root.dataset.charterId = options.charterId;
      titleText = translator.getCharterText(options.charterId).name;
      kindBadgeText = translator.t('ui.shop.charterTitle');
      break;
    }

    case 'deck': {
      root.dataset.deckId = options.deckId;
      root.dataset.locked = isLocked ? 'true' : 'false';
      titleText = translator.getDeckText(options.deckId).name;
      kindBadgeText = isLocked
        ? translator.t('ui.deckSelect.locked')
        : translator.t('ui.deckSelect.unlocked');
      break;
    }

    case 'boss': {
      root.dataset.bossId = options.bossId;
      titleText = translator.getBossText(options.bossId).name;
      kindBadgeText = translator.catalog.blinds.boss.name;
      break;
    }

    case 'pack': {
      root.dataset.packType = options.packType;
      root.dataset.packSize = options.packSize;
      titleText = translator.getPackTitle(options.packType, options.packSize);
      kindBadgeText = translator.catalog.packSizes[options.packSize].name;
      break;
    }
  }

  root.setAttribute('aria-label', titleText);

  // Нижний текстовый блок слоя chrome с названием и категорией
  const footer = createHtmlEl('div', 'card-frame__entity-footer');
  if (kindBadgeText) {
    footer.appendChild(createHtmlEl('span', 'card-frame__kind-badge', kindBadgeText));
  }
  footer.appendChild(createHtmlEl('span', 'card-frame__title', titleText));
  if (isLocked) {
    footer.appendChild(
      createHtmlEl('span', 'card-frame__lock-badge', translator.t('ui.deckSelect.locked')),
    );
  }
  layers.chrome.appendChild(footer);

  // Бейдж цены (бесплатно или сумма золота)
  if (options.free || options.price === 0) {
    layers.chrome.appendChild(
      createHtmlEl('span', 'card-frame__price-badge is-free', translator.t('ui.shop.free')),
    );
  } else if (typeof options.price === 'number' && Number.isFinite(options.price)) {
    layers.chrome.appendChild(
      createHtmlEl(
        'span',
        'card-frame__price-badge',
        translator.t('ui.hud.goldAmount', { dollars: options.price }),
      ),
    );
  }

  // Слой 4: Издания и оверлей Подавления
  applyEditionFx(root, layers.fx, edition);

  if (options.kind === 'relic' && options.relic.debuffed) {
    appendDebuffOverlay(layers.fx, translator.t('ui.hud.debuffedBadge'));
  } else if (options.kind === 'boss' && options.disabled) {
    appendDebuffOverlay(layers.fx, translator.t('ui.hud.abilityDisabled'));
  }

  return root;
}

/**
 * Ограничивает число в диапазоне [-1, 1].
 */
function clampUnit(value: number): number {
  if (value > 1) return 1;
  if (value < -1) return -1;
  return value;
}

/**
 * Подключает отслеживание 3D-наклона карточки (--tilt-x, --tilt-y) по PointerEvents
 * без блокировки тач-взаимодействий и без зависимости от hover.
 * Возвращает функцию отписки от обработчиков.
 */
export function attachCardTilt(el: HTMLElement): () => void {
  const isDelegated = (): boolean => el.closest('[data-card-tilt-managed="true"]') !== null;

  const resetTilt = (): void => {
    el.style.setProperty('--tilt-x', '0');
    el.style.setProperty('--tilt-y', '0');
  };

  const handlePointerMove = (event: Event): void => {
    if (isDelegated()) return;
    const pointer = event as PointerEvent;
    if (typeof pointer.clientX !== 'number' || typeof pointer.clientY !== 'number') {
      return;
    }

    const rect = el.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : el.clientWidth > 0 ? el.clientWidth : 120;
    const height = rect.height > 0 ? rect.height : el.clientHeight > 0 ? el.clientHeight : 168;

    const rawX = ((pointer.clientX - rect.left) / width) * 2 - 1;
    const rawY = ((pointer.clientY - rect.top) / height) * 2 - 1;

    const nx = clampUnit(Number.isFinite(rawX) ? rawX : 0);
    const ny = clampUnit(Number.isFinite(rawY) ? rawY : 0);

    el.style.setProperty('--tilt-x', String(Number(nx.toFixed(3))));
    el.style.setProperty('--tilt-y', String(Number(ny.toFixed(3))));
  };

  const handlePointerLeave = (): void => {
    if (isDelegated()) return;
    resetTilt();
  };

  el.addEventListener('pointermove', handlePointerMove);
  el.addEventListener('pointerleave', handlePointerLeave);
  el.addEventListener('pointercancel', handlePointerLeave);

  return (): void => {
    el.removeEventListener('pointermove', handlePointerMove);
    el.removeEventListener('pointerleave', handlePointerLeave);
    el.removeEventListener('pointercancel', handlePointerLeave);
    if (!isDelegated()) {
      resetTilt();
    }
  };
}
