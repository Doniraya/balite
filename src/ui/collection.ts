import './collection.css';
import lockChainsUrl from '../assets/ui/icon-lock-chains.webp';
import {
  COLLECTION_BLIND_IDS,
  COLLECTION_EDITIONS,
  COLLECTION_ENHANCEMENTS,
  COLLECTION_PACK_IDS,
  COLLECTION_SEALS,
  DECK_IDS,
  REGULAR_MONSTER_IDS,
  VOUCHER_PAIRS,
  createConsumableInstance,
  createPlayingCard,
  createRelicInstance,
  getCollectionCategoryItemIds,
  getCollectionCategoryStats,
  isCollectionItemDiscovered,
  isCollectionItemSeen,
  markCollectionCategorySeen,
  type BossId,
  type CollectionCategory,
  type ConsumableId,
  type DeckId,
  type Edition,
  type MetaSave,
  type PackSize,
  type PackType,
  type RelicId,
  type TagId,
} from '../engine';
import type { Translator } from '../i18n';
import { attachCardTilt, renderEntityCardFrame, renderPlayingCardFrame } from './cardFrame';
import {
  buildBlindTooltip,
  buildCharterTooltip,
  buildConsumableTooltip,
  buildPackTooltip,
  buildPlayingCardTooltip,
  buildRelicTooltip,
  buildTagTooltip,
  createBlindEmblem,
} from './screens';
import { setTooltipData, type TooltipData } from './tooltip';

const ANTE_BASE_SCORES: readonly number[] = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];

/**
 * Опции инициализации модального окна «Коллекция».
 */
export interface CollectionModalOptions {
  readonly meta: MetaSave;
  readonly translator: Translator;
  readonly initialCategory?: CollectionCategory | null;
  readonly onClose: () => void;
  readonly onUpdateMeta?: (meta: MetaSave) => void;
  readonly audio?: {
    readonly playButton?: () => void;
  };
}

/**
 * Вычисляет общее количество карт внутри бустерного набора по его типу и размеру.
 */
function getPackTotalCards(type: PackType, size: PackSize): number {
  if (type === 'buffoon') {
    return size === 'mega' ? 4 : size === 'jumbo' ? 3 : 2;
  }
  return size === 'normal' ? 3 : 5;
}

/**
 * Вычисляет количество карт для выбора из бустерного набора.
 */
function getPackChooseCount(_type: PackType, size: PackSize): number {
  return size === 'mega' ? 2 : 1;
}

/**
 * Форматирует условие открытия заблокированного ваучера Т2 с текущим прогрессом.
 */
export function formatVoucherCondition(
  key: string,
  meta: MetaSave,
  translator: Translator,
): string {
  const isRu = translator.lang === 'ru';
  const formatGold = (amount: number): string => (isRu ? `${amount} з.` : `${amount} Gold`);
  let current = formatGold(0);
  switch (key) {
    case 'spend2500':
      current = formatGold(meta.stats?.totalMoneySpent ?? 0);
      break;
    case 'reroll50':
      current = `${meta.stats?.totalShopRerolls ?? 0}/50`;
      break;
    case 'use50Celestials':
      current = `${meta.stats?.totalCelestialsUsed ?? 0}/50`;
      break;
    case 'play250Hands':
      current = `${meta.stats?.totalHandsPlayed ?? 0}/250`;
      break;
    case 'earn400Dollars':
      current = isRu
        ? `${meta.stats?.maxDollars ?? 0}/400 з.`
        : `${meta.stats?.maxDollars ?? 0}/400 Gold`;
      break;
    case 'defeat10Bosses':
      current = `${meta.discoveredBosses?.length ?? 0}/10`;
      break;
  }
  return translator.t(`ui.collection.voucherConditions.${key}`, { current });
}

/**
 * Создаёт HTML-элемент неоткрытой карточки со знаком «?».
 */
function createUndiscoveredCard(
  cardKind: 'relic' | 'consumable' | 'charter' | 'pack',
  translator: Translator,
): HTMLElement {
  const card = document.createElement('div');
  card.className = `card-frame card-frame--undiscovered card-frame--${cardKind}`;
  card.dataset.cardKind = cardKind;
  card.setAttribute('aria-label', translator.t('ui.collection.notDiscoveredTitle'));

  const content = document.createElement('div');
  content.className = 'collection-undiscovered-content';
  const qmark = document.createElement('span');
  qmark.className = 'collection-undiscovered-qmark';
  qmark.textContent = '?';
  content.appendChild(qmark);
  card.appendChild(content);

  const tooltip: TooltipData = {
    title: translator.t('ui.collection.notDiscoveredTitle'),
    description: translator.t('ui.collection.notDiscoveredDesc'),
    kind: 'hidden',
  };
  setTooltipData(card, tooltip);

  return card;
}

/**
 * Создаёт HTML-элемент заблокированного ваучера Т2 с цепью и навесным замком.
 */
function createLockedVoucherCard(
  pair: (typeof VOUCHER_PAIRS)[number],
  meta: MetaSave,
  translator: Translator,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card-frame card-frame--locked card-frame--charter';
  card.dataset.cardKind = 'charter';
  card.setAttribute('aria-label', translator.t('ui.collection.lockedTitle'));

  const overlay = document.createElement('div');
  overlay.className = 'collection-lock-overlay';

  const lockImg = document.createElement('img');
  lockImg.className = 'collection-lock-svg';
  lockImg.src = lockChainsUrl;
  lockImg.alt = '';
  lockImg.draggable = false;
  lockImg.setAttribute('aria-hidden', 'true');

  overlay.appendChild(lockImg);
  card.appendChild(overlay);

  const tooltip: TooltipData = {
    title: translator.t('ui.collection.lockedTitle'),
    description: formatVoucherCondition(pair.unlockConditionKey, meta, translator),
    kind: 'charter',
  };
  setTooltipData(card, tooltip);

  return card;
}

/**
 * Отрисовывает полноэкранное модальное окно «Коллекция» (Хаб и 11 категорий).
 */
export function renderCollectionModal(options: CollectionModalOptions): HTMLElement {
  const { translator, onClose, onUpdateMeta, audio } = options;

  let activeMeta: MetaSave = options.meta;
  let currentCategory: CollectionCategory | null = options.initialCategory ?? null;
  let lastRenderedCategory: CollectionCategory | null | undefined = undefined;
  let currentPage = 0;
  let deckCarouselIndex = 0;
  const cleanups: Array<() => void> = [];

  const runCleanups = (): void => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.length = 0;
  };

  const playClick = (): void => {
    audio?.playButton?.();
  };

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.dataset.modal = 'collection';

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      runCleanups();
      onClose();
    }
  });

  const sheet = document.createElement('div');
  sheet.className = 'modal-sheet modal-sheet--collection';
  backdrop.appendChild(sheet);

  /**
   * Создает оранжевую кнопку «Назад».
   */
  const createBackButton = (onClick: () => void): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'collection-back-btn';
    btn.textContent = translator.t('ui.collection.back');
    btn.addEventListener('click', () => {
      playClick();
      onClick();
    });
    return btn;
  };

  /**
   * Создает панель пагинации (< Страница X/Y >).
   */
  const createPagination = (
    current: number,
    total: number,
    onPageChange: (newPage: number) => void,
  ): HTMLElement => {
    const container = document.createElement('div');
    container.className = 'collection-pagination';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'collection-page-btn collection-page-btn--prev';
    prevBtn.textContent = '<';
    prevBtn.disabled = current <= 0;
    prevBtn.addEventListener('click', () => {
      playClick();
      onPageChange(current - 1);
    });

    const info = document.createElement('div');
    info.className = 'collection-page-indicator';
    info.textContent = translator.t('ui.collection.pageInfo', {
      current: current + 1,
      total,
    });

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'collection-page-btn collection-page-btn--next';
    nextBtn.textContent = '>';
    nextBtn.disabled = current >= total - 1;
    nextBtn.addEventListener('click', () => {
      playClick();
      onPageChange(current + 1);
    });

    container.append(prevBtn, info, nextBtn);
    return container;
  };

  /**
   * Отрисовывает экран Хаба со всеми 11 категориями.
   */
  const renderHubView = (): void => {
    const hub = document.createElement('div');
    hub.className = 'collection-hub';

    const grid = document.createElement('div');
    grid.className = 'collection-hub__grid';

    // Левая колонка: Навыки, Колоды, Привилегии, Расходники
    const leftCol = document.createElement('div');
    leftCol.className = 'collection-hub__col';

    const createHubButton = (
      category: CollectionCategory,
      extraClass = '',
      showCount = true,
    ): HTMLButtonElement => {
      const stats = getCollectionCategoryStats(activeMeta, category);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `collection-hub-btn ${extraClass}`.trim();
      btn.dataset.category = category;

      const title = document.createElement('span');
      title.className = 'collection-hub-btn__title';
      title.textContent = translator.t(`ui.collection.${category}`);
      btn.appendChild(title);

      if (showCount) {
        const count = document.createElement('span');
        count.className = 'collection-hub-btn__count';
        count.textContent = `${stats.discovered} / ${stats.total}`;
        btn.appendChild(count);
      }

      if (stats.hasUnseen) {
        const badge = document.createElement('span');
        badge.className = 'collection-alert-badge';
        badge.textContent = '!';
        badge.setAttribute('aria-hidden', 'true');
        btn.appendChild(badge);
      }

      btn.addEventListener('click', () => {
        playClick();
        currentCategory = category;
        currentPage = 0;
        deckCarouselIndex = 0;
        activeMeta = markCollectionCategorySeen(activeMeta, category);
        onUpdateMeta?.(activeMeta);
        renderView();
      });

      return btn;
    };

    leftCol.appendChild(createHubButton('relics', 'collection-hub-btn--large'));
    leftCol.appendChild(createHubButton('decks'));
    leftCol.appendChild(createHubButton('vouchers'));

    // Блок «РАСХОДНИКИ»
    const consumablesGroup = document.createElement('div');
    consumablesGroup.className = 'collection-hub__consumables';

    const consumablesTab = document.createElement('div');
    consumablesTab.className = 'collection-hub__consumables-tab';
    const consumablesText = document.createElement('span');
    consumablesText.className = 'collection-hub__consumables-text';
    consumablesText.textContent = translator.t('ui.collection.consumablesGroup');
    consumablesTab.appendChild(consumablesText);

    const consumablesCol = document.createElement('div');
    consumablesCol.className = 'collection-hub__consumables-col';
    consumablesCol.appendChild(createHubButton('scrolls', 'collection-hub-btn--scrolls'));
    consumablesCol.appendChild(createHubButton('celestials', 'collection-hub-btn--celestials'));
    consumablesCol.appendChild(createHubButton('runes', 'collection-hub-btn--runes'));

    consumablesGroup.append(consumablesTab, consumablesCol);
    leftCol.appendChild(consumablesGroup);

    // Правая колонка: Улучшения, Печати, Издания, Сундуки, Талоны, Заказы
    const rightCol = document.createElement('div');
    rightCol.className = 'collection-hub__col';

    rightCol.appendChild(createHubButton('enhancements', '', false));
    rightCol.appendChild(createHubButton('seals', '', false));
    rightCol.appendChild(createHubButton('editions'));
    rightCol.appendChild(createHubButton('packs'));
    rightCol.appendChild(createHubButton('tags'));
    rightCol.appendChild(createHubButton('blinds', 'collection-hub-btn--large'));

    grid.append(leftCol, rightCol);

    const backBtn = createBackButton(() => {
      runCleanups();
      onClose();
    });

    hub.append(grid, backBtn);
    sheet.appendChild(hub);
  };

  /**
   * Отрисовывает экран категории «Навыки» (5x3, 15 на страницу, всего 3 страницы).
   */
  const renderRelicsView = (): void => {
    const container = document.createElement('div');
    container.className = 'collection-category collection-category--relics';

    const itemIds = getCollectionCategoryItemIds('relics') as readonly RelicId[];
    const pageSize = 15;
    const totalPages = Math.ceil(itemIds.length / pageSize);
    const start = currentPage * pageSize;
    const pageItemIds = itemIds.slice(start, start + pageSize);

    const grid = document.createElement('div');
    grid.className = 'collection-grid collection-grid--5x3';

    for (const id of pageItemIds) {
      const isDiscovered = isCollectionItemDiscovered(activeMeta, 'relics', id);
      if (isDiscovered) {
        const relic = createRelicInstance(id, `col_${id}`, 'base');
        const cardEl = renderEntityCardFrame({
          kind: 'relic',
          relic,
          translator,
          interactive: true,
        });
        cleanups.push(attachCardTilt(cardEl));
        setTooltipData(cardEl, buildRelicTooltip(relic, undefined, translator));

        if (!isCollectionItemSeen(activeMeta, id)) {
          const badge = document.createElement('span');
          badge.className = 'collection-alert-badge';
          badge.textContent = '!';
          cardEl.appendChild(badge);
        }

        grid.appendChild(cardEl);
      } else {
        grid.appendChild(createUndiscoveredCard('relic', translator));
      }
    }

    container.appendChild(grid);
    container.appendChild(
      createPagination(currentPage, totalPages, (newPage) => {
        currentPage = newPage;
        renderView();
      }),
    );
    container.appendChild(
      createBackButton(() => {
        currentCategory = null;
        renderView();
      }),
    );

    sheet.appendChild(container);
  };

  /**
   * Отрисовывает экран расходников (Свитки, Томы, Руны: 5x2, 10 на страницу).
   */
  const renderConsumablesView = (kind: 'scroll' | 'celestial' | 'rune'): void => {
    const categoryKey: CollectionCategory =
      kind === 'scroll' ? 'scrolls' : kind === 'celestial' ? 'celestials' : 'runes';
    const container = document.createElement('div');
    container.className = `collection-category collection-category--${categoryKey}`;

    const itemIds = getCollectionCategoryItemIds(categoryKey);
    const pageSize = 10;
    const totalPages = Math.ceil(itemIds.length / pageSize);
    const start = currentPage * pageSize;
    const pageItemIds = itemIds.slice(start, start + pageSize);

    const grid = document.createElement('div');
    grid.className = 'collection-grid collection-grid--5x2';

    for (const id of pageItemIds) {
      const isDiscovered = isCollectionItemDiscovered(activeMeta, categoryKey, id);
      if (isDiscovered) {
        const consumable = createConsumableInstance(id as ConsumableId, `col_${id}`, 'base');
        const cardEl = renderEntityCardFrame({
          kind: 'consumable',
          consumable,
          translator,
          interactive: true,
        });
        cleanups.push(attachCardTilt(cardEl));
        setTooltipData(cardEl, buildConsumableTooltip(consumable, translator));

        if (!isCollectionItemSeen(activeMeta, id)) {
          const badge = document.createElement('span');
          badge.className = 'collection-alert-badge';
          badge.textContent = '!';
          cardEl.appendChild(badge);
        }

        grid.appendChild(cardEl);
      } else {
        grid.appendChild(createUndiscoveredCard('consumable', translator));
      }
    }

    container.appendChild(grid);
    if (totalPages > 1) {
      container.appendChild(
        createPagination(currentPage, totalPages, (newPage) => {
          currentPage = newPage;
          renderView();
        }),
      );
    }
    container.appendChild(
      createBackButton(() => {
        currentCategory = null;
        renderView();
      }),
    );

    sheet.appendChild(container);
  };

  /**
   * Отрисовывает экран «Привилегии» (Ваучеры: 4x2, пары Т1 и Т2 в колонках).
   */
  const renderVouchersView = (): void => {
    const container = document.createElement('div');
    container.className = 'collection-category collection-category--vouchers';

    const pairs = VOUCHER_PAIRS;
    const pairsPerPage = 4;
    const totalPages = Math.ceil(pairs.length / pairsPerPage);
    const start = currentPage * pairsPerPage;
    const pagePairs = pairs.slice(start, start + pairsPerPage);

    const grid = document.createElement('div');
    grid.className = 'collection-grid collection-grid--4x2';

    for (const pair of pagePairs) {
      // Т1 ваучер
      const t1Discovered = isCollectionItemDiscovered(activeMeta, 'vouchers', pair.t1);
      if (t1Discovered) {
        const cardEl = renderEntityCardFrame({
          kind: 'charter',
          charterId: pair.t1,
          translator,
          interactive: true,
        });
        cleanups.push(attachCardTilt(cardEl));
        setTooltipData(cardEl, buildCharterTooltip(pair.t1, translator));

        if (!isCollectionItemSeen(activeMeta, pair.t1)) {
          const badge = document.createElement('span');
          badge.className = 'collection-alert-badge';
          badge.textContent = '!';
          cardEl.appendChild(badge);
        }
        grid.appendChild(cardEl);
      } else {
        grid.appendChild(createUndiscoveredCard('charter', translator));
      }

      // Т2 ваучер (с замком и условием или открытый)
      const t2Discovered = isCollectionItemDiscovered(activeMeta, 'vouchers', pair.t2);
      if (t2Discovered) {
        const cardEl = renderEntityCardFrame({
          kind: 'charter',
          charterId: pair.t2,
          translator,
          interactive: true,
        });
        cleanups.push(attachCardTilt(cardEl));
        setTooltipData(cardEl, buildCharterTooltip(pair.t2, translator));

        if (!isCollectionItemSeen(activeMeta, pair.t2)) {
          const badge = document.createElement('span');
          badge.className = 'collection-alert-badge';
          badge.textContent = '!';
          cardEl.appendChild(badge);
        }
        grid.appendChild(cardEl);
      } else {
        grid.appendChild(createLockedVoucherCard(pair, activeMeta, translator));
      }
    }

    container.appendChild(grid);
    if (totalPages > 1) {
      container.appendChild(
        createPagination(currentPage, totalPages, (newPage) => {
          currentPage = newPage;
          renderView();
        }),
      );
    }
    container.appendChild(
      createBackButton(() => {
        currentCategory = null;
        renderView();
      }),
    );

    sheet.appendChild(container);
  };

  /**
   * Отрисовывает экран «Улучшения карт» (8 карт: 4x2, правила модификаций внизу).
   */
  const renderEnhancementsView = (): void => {
    const container = document.createElement('div');
    container.className = 'collection-category collection-category--enhancements';

    const grid = document.createElement('div');
    grid.className = 'collection-grid collection-grid--4x2';

    for (const enhancement of COLLECTION_ENHANCEMENTS) {
      const card = createPlayingCard({
        id: `enh_${enhancement}`,
        suit: 'spades',
        rank: 14,
        enhancement,
        edition: 'base',
        seal: 'none',
        facing: 'front',
      });

      const cardEl = renderPlayingCardFrame({
        card,
        translator,
        interactive: true,
      });
      cleanups.push(attachCardTilt(cardEl));
      setTooltipData(cardEl, buildPlayingCardTooltip(card, translator));

      grid.appendChild(cardEl);
    }

    const ruleNotice = document.createElement('p');
    ruleNotice.className = 'collection-rule-notice';
    ruleNotice.textContent = translator.t('ui.collection.enhancementRuleNotice');

    container.append(
      grid,
      createBackButton(() => {
        currentCategory = null;
        renderView();
      }),
      ruleNotice,
    );

    sheet.appendChild(container);
  };

  /**
   * Отрисовывает экран «Печати» (4 шт. в ряд, правила внизу).
   */
  const renderSealsView = (): void => {
    const container = document.createElement('div');
    container.className = 'collection-category collection-category--seals';

    const grid = document.createElement('div');
    grid.className = 'collection-grid collection-grid--4x1';

    for (const seal of COLLECTION_SEALS) {
      const card = createPlayingCard({
        id: `seal_${seal}`,
        suit: 'spades',
        rank: 14,
        enhancement: 'none',
        edition: 'base',
        seal,
        facing: 'front',
      });

      const cardEl = renderPlayingCardFrame({
        card,
        translator,
        interactive: true,
      });
      cleanups.push(attachCardTilt(cardEl));
      setTooltipData(cardEl, buildPlayingCardTooltip(card, translator));

      grid.appendChild(cardEl);
    }

    const ruleNotice = document.createElement('p');
    ruleNotice.className = 'collection-rule-notice';
    ruleNotice.textContent = translator.t('ui.collection.enhancementRuleNotice');

    container.append(
      grid,
      createBackButton(() => {
        currentCategory = null;
        renderView();
      }),
      ruleNotice,
    );

    sheet.appendChild(container);
  };

  /**
   * Отрисовывает экран «Издания» (5 шт. в ряд).
   */
  const renderEditionsView = (): void => {
    const container = document.createElement('div');
    container.className = 'collection-category collection-category--editions';

    const grid = document.createElement('div');
    grid.className = 'collection-grid collection-grid--5x1';

    for (const edition of COLLECTION_EDITIONS) {
      const isDiscovered = isCollectionItemDiscovered(activeMeta, 'editions', edition);
      if (isDiscovered) {
        const relic = createRelicInstance('j_joker', `ed_${edition}`, edition);
        const cardEl = renderEntityCardFrame({
          kind: 'relic',
          relic,
          translator,
          interactive: true,
        });
        cleanups.push(attachCardTilt(cardEl));

        const editionEntry = translator.catalog.editions[edition as Edition];
        const tooltip: TooltipData = {
          title: editionEntry?.name ?? edition,
          description: editionEntry?.description,
          kind: 'relic',
        };
        setTooltipData(cardEl, tooltip);

        if (!isCollectionItemSeen(activeMeta, edition)) {
          const badge = document.createElement('span');
          badge.className = 'collection-alert-badge';
          badge.textContent = '!';
          cardEl.appendChild(badge);
        }

        grid.appendChild(cardEl);
      } else {
        grid.appendChild(createUndiscoveredCard('relic', translator));
      }
    }

    const ruleNotice = document.createElement('p');
    ruleNotice.className = 'collection-rule-notice';
    ruleNotice.textContent = translator.t('ui.collection.enhancementRuleNotice');

    container.append(
      grid,
      createBackButton(() => {
        currentCategory = null;
        renderView();
      }),
      ruleNotice,
    );

    sheet.appendChild(container);
  };

  /**
   * Отрисовывает экран «Сундуки» (Бустерные наборы: 4x2, 8 на страницу, 2 страницы).
   */
  const renderPacksView = (): void => {
    const container = document.createElement('div');
    container.className = 'collection-category collection-category--packs';

    const itemIds = COLLECTION_PACK_IDS;
    const pageSize = 8;
    const totalPages = Math.ceil(itemIds.length / pageSize);
    const start = currentPage * pageSize;
    const pageItemIds = itemIds.slice(start, start + pageSize);

    const grid = document.createElement('div');
    grid.className = 'collection-grid collection-grid--4x2';

    for (const packId of pageItemIds) {
      const isDiscovered = isCollectionItemDiscovered(activeMeta, 'packs', packId);
      const [, typeStr, sizeStr] = packId.split('_');
      const packType = typeStr as PackType;
      const packSize = sizeStr as PackSize;

      if (isDiscovered) {
        const cardEl = renderEntityCardFrame({
          kind: 'pack',
          packType,
          packSize,
          translator,
          interactive: true,
        });
        cleanups.push(attachCardTilt(cardEl));

        const packOffer = {
          uid: packId,
          packId,
          type: packType,
          size: packSize,
          cost: 0,
          baseCost: 0,
          totalCards: getPackTotalCards(packType, packSize),
          chooseCount: getPackChooseCount(packType, packSize),
          purchased: false,
        };
        setTooltipData(cardEl, buildPackTooltip(packOffer, translator));

        if (!isCollectionItemSeen(activeMeta, packId)) {
          const badge = document.createElement('span');
          badge.className = 'collection-alert-badge';
          badge.textContent = '!';
          cardEl.appendChild(badge);
        }

        grid.appendChild(cardEl);
      } else {
        grid.appendChild(createUndiscoveredCard('pack', translator));
      }
    }

    container.appendChild(grid);
    if (totalPages > 1) {
      container.appendChild(
        createPagination(currentPage, totalPages, (newPage) => {
          currentPage = newPage;
          renderView();
        }),
      );
    }
    container.appendChild(
      createBackButton(() => {
        currentCategory = null;
        renderView();
      }),
    );

    sheet.appendChild(container);
  };

  /**
   * Отрисовывает экран «Талоны» (Теги: 5x2, 10 шт.).
   */
  const renderTagsView = (): void => {
    const container = document.createElement('div');
    container.className = 'collection-category collection-category--tags';

    const itemIds = getCollectionCategoryItemIds('tags') as readonly TagId[];
    const grid = document.createElement('div');
    grid.className = 'collection-grid collection-grid--5x2';

    for (const tagId of itemIds) {
      const isDiscovered = isCollectionItemDiscovered(activeMeta, 'tags', tagId);
      const slot = document.createElement('div');
      slot.className = `collection-tag-slot ${isDiscovered ? '' : 'collection-tag-slot--undiscovered'}`.trim();
      slot.dataset.tagId = tagId;

      if (isDiscovered) {
        const glyph = document.createElement('span');
        glyph.className = 'collection-tag-glyph';
        glyph.textContent = '✦';
        slot.appendChild(glyph);

        setTooltipData(slot, buildTagTooltip(tagId, translator));

        if (!isCollectionItemSeen(activeMeta, tagId)) {
          const badge = document.createElement('span');
          badge.className = 'collection-alert-badge';
          badge.textContent = '!';
          slot.appendChild(badge);
        }
      } else {
        slot.textContent = '?';
        setTooltipData(slot, {
          title: translator.t('ui.collection.notDiscoveredTitle'),
          description: translator.t('ui.collection.notDiscoveredDesc'),
          kind: 'hidden',
        });
      }

      grid.appendChild(slot);
    }

    container.append(
      grid,
      createBackButton(() => {
        currentCategory = null;
        renderView();
      }),
    );

    sheet.appendChild(container);
  };

  /**
   * Отрисовывает экран «Заказы и боссы» (Таблица этажей 1..8 слева, 26 жетонов справа).
   */
  const renderBlindsView = (): void => {
    const container = document.createElement('div');
    container.className = 'collection-category collection-category--blinds';

    const view = document.createElement('div');
    view.className = 'collection-blinds-view';

    // Левая панель: таблица этажей и базовых очков
    const table = document.createElement('div');
    table.className = 'collection-blinds-table';

    const headerRow = document.createElement('div');
    headerRow.className = 'collection-blinds-header-row';
    const anteHeader = document.createElement('span');
    anteHeader.textContent = translator.t('ui.collection.anteBaseTitle');
    const baseHeader = document.createElement('span');
    baseHeader.textContent = translator.t('ui.collection.baseScoreTitle');
    headerRow.append(anteHeader, baseHeader);
    table.appendChild(headerRow);

    for (let floor = 1; floor <= 8; floor += 1) {
      const row = document.createElement('div');
      row.className = 'collection-blinds-row';

      const floorLabel = document.createElement('span');
      floorLabel.textContent = String(floor);

      const scoreLabel = document.createElement('span');
      scoreLabel.className = 'collection-blinds-score';
      const score = ANTE_BASE_SCORES[floor - 1] ?? 300;
      scoreLabel.textContent = `◆ ${score.toLocaleString()}`;

      row.append(floorLabel, scoreLabel);
      table.appendChild(row);
    }

    // Правая панель: 26 круглых жетонов
    const tokensGrid = document.createElement('div');
    tokensGrid.className = 'collection-blinds-tokens';

    for (let i = 0; i < COLLECTION_BLIND_IDS.length; i += 1) {
      const blindId = COLLECTION_BLIND_IDS[i]!;
      const isDiscovered = isCollectionItemDiscovered(activeMeta, 'blinds', blindId);
      const isRegular = REGULAR_MONSTER_IDS.includes(blindId);

      const tokenEl = document.createElement('div');
      tokenEl.className = `collection-blind-token ${isDiscovered ? '' : 'collection-blind-token--undiscovered'}`.trim();

      if (isDiscovered) {
        if (isRegular) {
          const ante = Math.floor(i / 2) + 1;
          const isBig = i % 2 === 1;
          const kind = isBig ? 'big' : 'small';
          const emblem = createBlindEmblem(kind, null, ante);
          tokenEl.appendChild(emblem);

          const baseScore = ANTE_BASE_SCORES[ante - 1] ?? 300;
          const targetScore = isBig ? Math.round(baseScore * 1.5) : baseScore;
          const reward = isBig ? 4 : 3;

          setTooltipData(
            tokenEl,
            buildBlindTooltip(kind, null, targetScore, reward, false, translator, ante),
          );
        } else {
          const bossId = blindId as BossId;
          const emblem = createBlindEmblem('boss', bossId, 1);
          tokenEl.appendChild(emblem);

          setTooltipData(
            tokenEl,
            buildBlindTooltip('boss', bossId, 600, 5, false, translator, 1),
          );
        }

        if (!isCollectionItemSeen(activeMeta, blindId)) {
          const badge = document.createElement('span');
          badge.className = 'collection-alert-badge';
          badge.textContent = '!';
          tokenEl.appendChild(badge);
        }
      } else {
        tokenEl.textContent = '?';
        setTooltipData(tokenEl, {
          title: translator.t('ui.collection.notDiscoveredTitle'),
          description: translator.t('ui.collection.notDiscoveredDesc'),
          kind: 'hidden',
        });
      }

      tokensGrid.appendChild(tokenEl);
    }

    view.append(table, tokensGrid);

    container.append(
      view,
      createBackButton(() => {
        currentCategory = null;
        renderView();
      }),
    );

    sheet.appendChild(container);
  };

  /**
   * Отрисовывает экран «Колоды» (карусель с объемной стопкой карт и описанием бонуса).
   */
  const renderDecksView = (): void => {
    const container = document.createElement('div');
    container.className = 'collection-category collection-category--decks';

    const currentDeckId = DECK_IDS[deckCarouselIndex] as DeckId;
    const isUnlocked = isCollectionItemDiscovered(activeMeta, 'decks', currentDeckId);
    const deckText = translator.getDeckText(currentDeckId);

    const carousel = document.createElement('div');
    carousel.className = 'collection-deck-carousel';

    const prevArrow = document.createElement('button');
    prevArrow.type = 'button';
    prevArrow.className = 'collection-deck-arrow collection-deck-arrow--prev';
    prevArrow.textContent = '<';
    prevArrow.addEventListener('click', () => {
      playClick();
      deckCarouselIndex = (deckCarouselIndex - 1 + DECK_IDS.length) % DECK_IDS.length;
      renderView();
    });

    const showcase = document.createElement('div');
    showcase.className = 'collection-deck-showcase';

    // 3D объемная стопка карт
    const stack3d = document.createElement('div');
    stack3d.className = 'deck-stack-3d';

    const layerBottom = document.createElement('div');
    layerBottom.className = 'deck-stack-3d__layer deck-stack-3d__layer--bottom';
    const layerMid = document.createElement('div');
    layerMid.className = 'deck-stack-3d__layer deck-stack-3d__layer--mid';
    const topWrap = document.createElement('div');
    topWrap.className = 'deck-stack-3d__top';

    const topCard = renderEntityCardFrame({
      kind: 'deck',
      deckId: currentDeckId,
      locked: !isUnlocked,
      translator,
      interactive: true,
    });
    cleanups.push(attachCardTilt(topCard));
    topWrap.appendChild(topCard);

    stack3d.append(layerBottom, layerMid, topWrap);

    // Правая информационная карточка
    const info = document.createElement('div');
    info.className = 'collection-deck-info';

    const titleBadge = document.createElement('div');
    titleBadge.className = 'collection-deck-title';
    titleBadge.textContent = deckText.name;

    const contentCard = document.createElement('div');
    contentCard.className = 'collection-deck-card';
    if (isUnlocked) {
      contentCard.textContent = deckText.description;
    } else {
      contentCard.textContent = translator.t('ui.deckSelect.locked');
    }

    info.append(titleBadge, contentCard);
    showcase.append(stack3d, info);

    const nextArrow = document.createElement('button');
    nextArrow.type = 'button';
    nextArrow.className = 'collection-deck-arrow collection-deck-arrow--next';
    nextArrow.textContent = '>';
    nextArrow.addEventListener('click', () => {
      playClick();
      deckCarouselIndex = (deckCarouselIndex + 1) % DECK_IDS.length;
      renderView();
    });

    carousel.append(prevArrow, showcase, nextArrow);

    // Точки индикации колод
    const dots = document.createElement('div');
    dots.className = 'collection-deck-dots';
    for (let i = 0; i < DECK_IDS.length; i += 1) {
      const dot = document.createElement('span');
      dot.className = `collection-deck-dot ${i === deckCarouselIndex ? 'is-active' : ''}`.trim();
      dots.appendChild(dot);
    }

    container.append(
      carousel,
      dots,
      createBackButton(() => {
        currentCategory = null;
        renderView();
      }),
    );

    sheet.appendChild(container);
  };

  /**
   * Главный диспетчер перерисовки контента модального окна.
   */
  const renderView = (): void => {
    const categoryChanged =
      lastRenderedCategory !== undefined && lastRenderedCategory !== currentCategory;
    lastRenderedCategory = currentCategory;

    runCleanups();
    sheet.replaceChildren();

    if (categoryChanged) {
      // Перезапускаем выезд панели снизу вверх при переходе между хабом и категорией
      sheet.style.animation = 'none';
      void sheet.offsetWidth;
      sheet.style.animation = '';
    }

    if (currentCategory === null) {
      renderHubView();
      return;
    }

    switch (currentCategory) {
      case 'relics':
        renderRelicsView();
        break;
      case 'scrolls':
        renderConsumablesView('scroll');
        break;
      case 'celestials':
        renderConsumablesView('celestial');
        break;
      case 'runes':
        renderConsumablesView('rune');
        break;
      case 'vouchers':
        renderVouchersView();
        break;
      case 'enhancements':
        renderEnhancementsView();
        break;
      case 'seals':
        renderSealsView();
        break;
      case 'editions':
        renderEditionsView();
        break;
      case 'packs':
        renderPacksView();
        break;
      case 'tags':
        renderTagsView();
        break;
      case 'blinds':
        renderBlindsView();
        break;
      case 'decks':
        renderDecksView();
        break;
    }
  };

  renderView();

  return backdrop;
}
