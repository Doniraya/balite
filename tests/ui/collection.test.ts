import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialMetaSave,
  type MetaSave,
} from '../../src/engine';
import { createTranslator } from '../../src/i18n';
import { formatVoucherCondition, renderCollectionModal } from '../../src/ui/collection';
import { getTooltipData } from '../../src/ui/tooltip';

describe('Коллекция Balite (src/ui/collection.ts)', () => {
  let root: HTMLDivElement;
  const translator = createTranslator('ru');
  const baseMeta: MetaSave = createInitialMetaSave();

  beforeEach(() => {
    root = document.createElement('div');
    document.body.replaceChildren(root);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('отрисовывает экран Хаба с 2 колонками, 11 категориями, блоком «РАСХОДНИКИ» и кнопкой «Назад»', () => {
    const onClose = vi.fn();
    const modal = renderCollectionModal({
      meta: baseMeta,
      translator,
      onClose,
    });
    root.appendChild(modal);

    expect(modal.dataset.modal).toBe('collection');

    // Кнопки категорий в хабе
    const hub = modal.querySelector('.collection-hub');
    expect(hub).not.toBeNull();

    const categories = [
      'relics',
      'decks',
      'vouchers',
      'scrolls',
      'celestials',
      'runes',
      'enhancements',
      'seals',
      'editions',
      'packs',
      'tags',
      'blinds',
    ];

    for (const cat of categories) {
      const btn = modal.querySelector(`[data-category="${cat}"]`);
      expect(btn, `Кнопка категории ${cat} должна существовать`).not.toBeNull();
    }

    // Блок РАСХОДНИКИ
    const consumablesGroup = modal.querySelector('.collection-hub__consumables');
    expect(consumablesGroup).not.toBeNull();
    expect(modal.querySelector('.collection-hub__consumables-text')?.textContent).toContain(
      'РАСХОДНИКИ',
    );

    // Оранжевая кнопка «Назад»
    const backBtn = modal.querySelector<HTMLButtonElement>('.collection-back-btn');
    expect(backBtn).not.toBeNull();
    expect(backBtn?.textContent).toBe('Назад');
    backBtn?.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('отображает бэйдж «!» при наличии непросмотренных открытий в категории', () => {
    const metaWithUnseen: MetaSave = {
      ...baseMeta,
      discoveredRelics: ['j_joker'],
      seenCollectionItems: [],
    };

    const modal = renderCollectionModal({
      meta: metaWithUnseen,
      translator,
      onClose: vi.fn(),
    });
    root.appendChild(modal);

    const relicsBtn = modal.querySelector('[data-category="relics"]');
    expect(relicsBtn?.querySelector('.collection-alert-badge')?.textContent).toBe('!');
  });

  it('переходит в категорию «Навыки» (5x3, 15 на страницу, пагинация 1/3) и обратно в Хаб', () => {
    const onUpdateMeta = vi.fn();
    const modal = renderCollectionModal({
      meta: baseMeta,
      translator,
      onClose: vi.fn(),
      onUpdateMeta,
    });
    root.appendChild(modal);

    // Кликаем по категории Навыки
    const relicsBtn = modal.querySelector<HTMLButtonElement>('[data-category="relics"]');
    relicsBtn?.click();

    expect(onUpdateMeta).toHaveBeenCalled();

    const categoryView = modal.querySelector('.collection-category--relics');
    expect(categoryView).not.toBeNull();

    // 5x3 сетка
    const grid = categoryView?.querySelector('.collection-grid--5x3');
    expect(grid).not.toBeNull();
    expect(grid?.children.length).toBe(15);

    // Пагинация: Страница 1/3
    const pageIndicator = categoryView?.querySelector('.collection-page-indicator');
    expect(pageIndicator?.textContent).toContain('1/3');

    const nextBtn = categoryView?.querySelector<HTMLButtonElement>('.collection-page-btn--next');
    expect(nextBtn?.disabled).toBe(false);
    nextBtn?.click();

    expect(modal.querySelector('.collection-page-indicator')?.textContent).toContain('2/3');

    // Кнопка Назад возвращает в Хаб
    const backBtn = modal.querySelector<HTMLButtonElement>('.collection-back-btn');
    backBtn?.click();

    expect(modal.querySelector('.collection-hub')).not.toBeNull();
  });

  it('отображает категорию «Привилегии» с парами Т1 и Т2, замками и условиями', () => {
    const modal = renderCollectionModal({
      meta: baseMeta,
      translator,
      initialCategory: 'vouchers',
      onClose: vi.fn(),
    });
    root.appendChild(modal);

    const categoryView = modal.querySelector('.collection-category--vouchers');
    expect(categoryView).not.toBeNull();

    const grid = categoryView?.querySelector('.collection-grid--4x2');
    expect(grid).not.toBeNull();
    // 4 пары на 1-й странице = 8 карточек
    expect(grid?.children.length).toBe(8);

    // Проверяем наличие замка на заблокированном Т2 ваучере
    const lockedCard = grid?.querySelector('.card-frame--locked');
    expect(lockedCard).not.toBeNull();
    expect(lockedCard?.querySelector('.collection-lock-svg')).not.toBeNull();
  });

  it('отображает категорию «Улучшения карт» (8 шт.) с правилом внизу', () => {
    const modal = renderCollectionModal({
      meta: baseMeta,
      translator,
      initialCategory: 'enhancements',
      onClose: vi.fn(),
    });
    root.appendChild(modal);

    const categoryView = modal.querySelector('.collection-category--enhancements');
    expect(categoryView).not.toBeNull();

    const grid = categoryView?.querySelector('.collection-grid--4x2');
    expect(grid?.children.length).toBe(8);

    const rule = categoryView?.querySelector('.collection-rule-notice');
    expect(rule?.textContent).toContain('У каждой игральной карты может быть по одному улучшению');
  });

  it('отображает категорию «Печати» (4 шт.) с правилом внизу', () => {
    const modal = renderCollectionModal({
      meta: baseMeta,
      translator,
      initialCategory: 'seals',
      onClose: vi.fn(),
    });
    root.appendChild(modal);

    const categoryView = modal.querySelector('.collection-category--seals');
    expect(categoryView).not.toBeNull();

    const grid = categoryView?.querySelector('.collection-grid--4x1');
    expect(grid?.children.length).toBe(4);
  });

  it('отображает категорию «Издания» (5 шт.)', () => {
    const modal = renderCollectionModal({
      meta: baseMeta,
      translator,
      initialCategory: 'editions',
      onClose: vi.fn(),
    });
    root.appendChild(modal);

    const categoryView = modal.querySelector('.collection-category--editions');
    expect(categoryView).not.toBeNull();

    const grid = categoryView?.querySelector('.collection-grid--5x1');
    expect(grid?.children.length).toBe(5);
  });

  it('отображает категорию «Сундуки» (Бустерные наборы: 4x2, пагинация 1/2)', () => {
    const modal = renderCollectionModal({
      meta: baseMeta,
      translator,
      initialCategory: 'packs',
      onClose: vi.fn(),
    });
    root.appendChild(modal);

    const categoryView = modal.querySelector('.collection-category--packs');
    expect(categoryView).not.toBeNull();

    const grid = categoryView?.querySelector('.collection-grid--4x2');
    expect(grid?.children.length).toBe(8);

    const indicator = categoryView?.querySelector('.collection-page-indicator');
    expect(indicator?.textContent).toContain('1/2');
  });

  it('отображает категорию «Талоны» (Теги: 5x2, 10 шт.)', () => {
    const modal = renderCollectionModal({
      meta: baseMeta,
      translator,
      initialCategory: 'tags',
      onClose: vi.fn(),
    });
    root.appendChild(modal);

    const categoryView = modal.querySelector('.collection-category--tags');
    expect(categoryView).not.toBeNull();

    const grid = categoryView?.querySelector('.collection-grid--5x2');
    expect(grid?.children.length).toBe(10);
  });

  it('отображает категорию «Заказы и боссы» с таблицей 1..8 слева и 26 жетонами справа', () => {
    const modal = renderCollectionModal({
      meta: baseMeta,
      translator,
      initialCategory: 'blinds',
      onClose: vi.fn(),
    });
    root.appendChild(modal);

    const categoryView = modal.querySelector('.collection-category--blinds');
    expect(categoryView).not.toBeNull();

    // Таблица этажей
    const table = categoryView?.querySelector('.collection-blinds-table');
    expect(table).not.toBeNull();
    const rows = table?.querySelectorAll('.collection-blinds-row');
    expect(rows?.length).toBe(8);

    // 26 жетонов
    const tokensGrid = categoryView?.querySelector('.collection-blinds-tokens');
    expect(tokensGrid?.children.length).toBe(26);
  });

  it('отображает категорию «Колоды» с каруселью, 3D стопкой карт и переключением', () => {
    const modal = renderCollectionModal({
      meta: baseMeta,
      translator,
      initialCategory: 'decks',
      onClose: vi.fn(),
    });
    root.appendChild(modal);

    const categoryView = modal.querySelector('.collection-category--decks');
    expect(categoryView).not.toBeNull();

    const stack = categoryView?.querySelector('.deck-stack-3d');
    expect(stack).not.toBeNull();

    const title = categoryView?.querySelector('.collection-deck-title');
    expect(title?.textContent).toBe(translator.getDeckText('b_red').name);

    const nextArrow = categoryView?.querySelector<HTMLButtonElement>('.collection-deck-arrow--next');
    nextArrow?.click();

    expect(modal.querySelector('.collection-deck-title')?.textContent).toBe(
      translator.getDeckText('b_blue').name,
    );

    // Стрелка назад переключает обратно на предыдущую колоду
    const prevArrow = categoryView?.querySelector<HTMLButtonElement>('.collection-deck-arrow--prev');
    prevArrow?.click();
    expect(modal.querySelector('.collection-deck-title')?.textContent).toBe(
      translator.getDeckText('b_red').name,
    );
  });

  it('поддерживает переходы во ВСЕ 12 категорий и корректный возврат в Хаб', () => {
    const allCategories = [
      'relics',
      'decks',
      'vouchers',
      'scrolls',
      'celestials',
      'runes',
      'enhancements',
      'seals',
      'editions',
      'packs',
      'tags',
      'blinds',
    ] as const;

    const modal = renderCollectionModal({
      meta: baseMeta,
      translator,
      onClose: vi.fn(),
    });
    root.appendChild(modal);

    for (const cat of allCategories) {
      // Находим кнопку в хабе
      const catBtn = modal.querySelector<HTMLButtonElement>(`[data-category="${cat}"]`);
      expect(catBtn, `Кнопка категории ${cat} должна присутствовать в Хабе`).not.toBeNull();
      catBtn?.click();

      // Проверяем, что открылся экран категории
      const catView = modal.querySelector(`.collection-category--${cat}`);
      expect(catView, `Экран категории ${cat} должен отображаться после клика`).not.toBeNull();

      // Нажимаем кнопку Назад
      const backBtn = modal.querySelector<HTMLButtonElement>('.collection-back-btn');
      expect(backBtn, `Кнопка Назад должна присутствовать на экране ${cat}`).not.toBeNull();
      backBtn?.click();

      // Проверяем, что вернулись в Хаб
      expect(modal.querySelector('.collection-hub')).not.toBeNull();
    }
  });

  it('корректно работает пагинация для всех многостраничных категорий (relics, scrolls, celestials, packs)', () => {
    const testCases = [
      { cat: 'relics' as const, expectedPages: 3 },
      { cat: 'scrolls' as const, expectedPages: 2 },
      { cat: 'celestials' as const, expectedPages: 2 },
      { cat: 'packs' as const, expectedPages: 2 },
    ];

    for (const { cat, expectedPages } of testCases) {
      const modal = renderCollectionModal({
        meta: baseMeta,
        translator,
        initialCategory: cat,
        onClose: vi.fn(),
      });
      root.appendChild(modal);

      const indicator = modal.querySelector('.collection-page-indicator');
      expect(indicator?.textContent).toContain(`1/${expectedPages}`);

      const prevBtn = modal.querySelector<HTMLButtonElement>('.collection-page-btn--prev');
      const nextBtn = modal.querySelector<HTMLButtonElement>('.collection-page-btn--next');

      expect(prevBtn?.disabled).toBe(true);
      expect(nextBtn?.disabled).toBe(false);

      // Переход на страницу 2
      nextBtn?.click();
      expect(modal.querySelector('.collection-page-indicator')?.textContent).toContain(`2/${expectedPages}`);
      const updatedPrevBtn = modal.querySelector<HTMLButtonElement>('.collection-page-btn--prev');
      expect(updatedPrevBtn?.disabled).toBe(false);

      // Возврат на страницу 1
      updatedPrevBtn?.click();
      expect(modal.querySelector('.collection-page-indicator')?.textContent).toContain(`1/${expectedPages}`);
      expect(modal.querySelector<HTMLButtonElement>('.collection-page-btn--prev')?.disabled).toBe(true);

      root.replaceChildren();
    }
  });

  it('для одностраничной категории (runes: 9 предметов) блок пагинации не отображается', () => {
    const modal = renderCollectionModal({
      meta: baseMeta,
      translator,
      initialCategory: 'runes',
      onClose: vi.fn(),
    });
    root.appendChild(modal);

    expect(modal.querySelector('.collection-pagination')).toBeNull();
  });

  it('снимает бэйдж «!» после открытия категории и обновляет мета-прогресс', () => {
    let savedMeta: MetaSave = {
      ...baseMeta,
      discoveredRelics: ['j_joker'],
      seenCollectionItems: [],
    };

    const modal = renderCollectionModal({
      meta: savedMeta,
      translator,
      onClose: vi.fn(),
      onUpdateMeta: (newMeta) => {
        savedMeta = newMeta;
      },
    });
    root.appendChild(modal);

    // Изначально в хабе есть бэйдж
    const relicBtn = modal.querySelector('[data-category="relics"]');
    expect(relicBtn?.querySelector('.collection-alert-badge')).not.toBeNull();

    // Кликаем по категории Навыки
    modal.querySelector<HTMLButtonElement>('[data-category="relics"]')?.click();

    // Мета обновилась
    expect(savedMeta.seenCollectionItems).toContain('j_joker');

    // Возвращаемся в Хаб
    modal.querySelector<HTMLButtonElement>('.collection-back-btn')?.click();

    // В Хабе бэйдж снят
    const relicBtnAfter = modal.querySelector('[data-category="relics"]');
    expect(relicBtnAfter?.querySelector('.collection-alert-badge')).toBeNull();
  });

  it('закрывает модалку при клике на бэкдроп', () => {
    const onClose = vi.fn();
    const modal = renderCollectionModal({
      meta: baseMeta,
      translator,
      onClose,
    });
    root.appendChild(modal);

    modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('отображает реальный прогресс условий Т2-привилегий (spend2500, reroll50, use50Celestials) из meta.stats в formatVoucherCondition и тултипах', () => {
    const emptyMeta = createInitialMetaSave();

    // При нулевом прогрессе возвращаются начальные счётчики в золоте без хардкодных заглушек
    expect(formatVoucherCondition('spend2500', emptyMeta, translator)).toContain('0 з.');
    expect(formatVoucherCondition('reroll50', emptyMeta, translator)).toContain('0/50');
    expect(formatVoucherCondition('use50Celestials', emptyMeta, translator)).toContain('0/50');

    const progressedMeta: MetaSave = {
      ...emptyMeta,
      stats: {
        ...emptyMeta.stats,
        totalMoneySpent: 1420,
        totalShopRerolls: 31,
        totalCelestialsUsed: 18,
      },
    };

    const seedCond = formatVoucherCondition('spend2500', progressedMeta, translator);
    const rerollCond = formatVoucherCondition('reroll50', progressedMeta, translator);
    const telescopeCond = formatVoucherCondition('use50Celestials', progressedMeta, translator);

    expect(seedCond).toContain('1420 з.');
    expect(rerollCond).toContain('31/50');
    expect(telescopeCond).toContain('18/50');

    // Проверяем, что тултипы заблокированных привилегий в DOM содержат реальный прогресс из meta.stats
    const modal = renderCollectionModal({
      meta: progressedMeta,
      translator,
      initialCategory: 'vouchers',
      onClose: vi.fn(),
    });
    root.appendChild(modal);

    const collectLockedTooltipDescriptions = (): string[] =>
      Array.from(modal.querySelectorAll<HTMLElement>('.card-frame--locked'))
        .map((el) => getTooltipData(el)?.description ?? '')
        .filter(Boolean);

    const page1Tooltips = collectLockedTooltipDescriptions();
    modal.querySelector<HTMLButtonElement>('.collection-page-btn--next')?.click();
    const page2Tooltips = collectLockedTooltipDescriptions();
    const allTooltips = [...page1Tooltips, ...page2Tooltips].join('\n');

    expect(allTooltips).toContain('1420 з.');
    expect(allTooltips).toContain('31/50');
    expect(allTooltips).toContain('18/50');
  });

  it('collection.css допускает :hover только под @media (hover: hover) and (pointer: fine)', async () => {
    const fsModule = 'node:fs';
    const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as {
      readFileSync: (file: string, encoding: 'utf8') => string;
    };
    const css = readFileSync('src/ui/collection.css', 'utf8');
    const withoutFineHover = css.replace(
      /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*\{[\s\S]*?\}\s*\}/g,
      '',
    );
    expect(withoutFineHover).not.toMatch(/:hover\b/);
    expect(css).toContain('@media (hover: hover) and (pointer: fine)');
  });
});
