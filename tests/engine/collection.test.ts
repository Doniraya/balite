import { describe, expect, it } from 'vitest';
import {
  getCollectionCategoryItemIds,
  getCollectionCategoryStats,
  hasAnyUnseenCollectionItems,
  isCollectionItemDiscovered,
  isCollectionItemSeen,
  markCollectionCategorySeen,
  markCollectionItemSeen,
  resetCollection,
  unlockAllCollection,
} from '../../src/engine/collection';
import { createInitialMetaSave } from '../../src/engine/save';
import type { MetaSave } from '../../src/engine/types';

describe('Коллекция Balite (src/engine/collection.ts)', () => {
  const baseMeta: MetaSave = createInitialMetaSave();

  it('содержит корректные списки сущностей во всех 11 категориях', () => {
    expect(getCollectionCategoryItemIds('relics')).toHaveLength(40);
    expect(getCollectionCategoryItemIds('decks')).toHaveLength(4);
    expect(getCollectionCategoryItemIds('vouchers')).toHaveLength(12);
    expect(getCollectionCategoryItemIds('scrolls')).toHaveLength(16);
    expect(getCollectionCategoryItemIds('celestials')).toHaveLength(12);
    expect(getCollectionCategoryItemIds('runes')).toHaveLength(9);
    expect(getCollectionCategoryItemIds('enhancements')).toHaveLength(8);
    expect(getCollectionCategoryItemIds('seals')).toHaveLength(4);
    expect(getCollectionCategoryItemIds('editions')).toHaveLength(5);
    expect(getCollectionCategoryItemIds('packs')).toHaveLength(12);
    expect(getCollectionCategoryItemIds('tags')).toHaveLength(10);
    expect(getCollectionCategoryItemIds('blinds')).toHaveLength(26);
  });

  it('в новом профиле открыты стартовые колоды, базовые улучшения/печати и монстры 1 этапа', () => {
    expect(isCollectionItemDiscovered(baseMeta, 'decks', 'b_red')).toBe(true);
    expect(isCollectionItemDiscovered(baseMeta, 'enhancements', 'bonus')).toBe(true);
    expect(isCollectionItemDiscovered(baseMeta, 'seals', 'gold')).toBe(true);
    expect(isCollectionItemDiscovered(baseMeta, 'editions', 'base')).toBe(true);
    expect(isCollectionItemDiscovered(baseMeta, 'blinds', 'm_ante_1_small')).toBe(true);
    expect(isCollectionItemDiscovered(baseMeta, 'relics', 'j_joker')).toBe(false);
  });

  it('корректно управляет отметками о просмотренных сущностях и индикатором «!»', () => {
    const metaWithRelic: MetaSave = {
      ...baseMeta,
      discoveredRelics: ['j_joker'],
    };

    const stats = getCollectionCategoryStats(metaWithRelic, 'relics');
    expect(stats.discovered).toBe(1);
    expect(stats.total).toBe(40);
    expect(stats.hasUnseen).toBe(true);
    expect(hasAnyUnseenCollectionItems(metaWithRelic)).toBe(true);

    // Помечаем реликвию как просмотренную
    const metaSeen = markCollectionItemSeen(metaWithRelic, 'j_joker');
    expect(isCollectionItemSeen(metaSeen, 'j_joker')).toBe(true);
    expect(getCollectionCategoryStats(metaSeen, 'relics').hasUnseen).toBe(false);
  });

  it('помечает всю категорию как просмотренную', () => {
    const metaWithRelics: MetaSave = {
      ...baseMeta,
      discoveredRelics: ['j_joker', 'j_sly'],
    };

    const metaCategorySeen = markCollectionCategorySeen(metaWithRelics, 'relics');
    expect(isCollectionItemSeen(metaCategorySeen, 'j_joker')).toBe(true);
    expect(isCollectionItemSeen(metaCategorySeen, 'j_sly')).toBe(true);
    expect(getCollectionCategoryStats(metaCategorySeen, 'relics').hasUnseen).toBe(false);
  });

  it('unlockAllCollection открывает все предметы, а resetCollection сбрасывает до базы', () => {
    const fullyUnlocked = unlockAllCollection(baseMeta);
    const relicsStats = getCollectionCategoryStats(fullyUnlocked, 'relics');
    expect(relicsStats.discovered).toBe(40);
    expect(getCollectionCategoryStats(fullyUnlocked, 'blinds').discovered).toBe(26);

    const reset = resetCollection(fullyUnlocked);
    expect(getCollectionCategoryStats(reset, 'relics').discovered).toBe(0);
    expect(isCollectionItemDiscovered(reset, 'decks', 'b_red')).toBe(true);
  });
});
