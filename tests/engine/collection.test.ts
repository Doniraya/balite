import { describe, expect, it } from 'vitest';
import { createPlayingCard } from '../../src/engine/cards';
import {
  COLLECTION_PACK_IDS,
  collectRunMetaDiscoveries,
  getCollectionCategoryItemIds,
  getCollectionCategoryStats,
  hasAnyUnseenCollectionItems,
  isCollectionItemDiscovered,
  isCollectionItemSeen,
  markCollectionCategorySeen,
  markCollectionItemSeen,
  normalizePackIdForCollection,
  resetCollection,
  unlockAllCollection,
} from '../../src/engine/collection';
import { createConsumableInstance } from '../../src/engine/consumables';
import { createRelicInstance } from '../../src/engine/relics';
import { createInitialRunState } from '../../src/engine/run';
import { createInitialMetaSave } from '../../src/engine/save';
import type { MetaSave, PackSize, PackType, RunState } from '../../src/engine/types';

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

  it('normalizePackIdForCollection корректно преобразует форматы shop.ts в COLLECTION_PACK_IDS и возвращает null для spectral', () => {
    const catalogTypes: readonly PackType[] = ['arcana', 'celestial', 'standard', 'buffoon'];
    const sizes: readonly PackSize[] = ['normal', 'jumbo', 'mega'];

    for (const packType of catalogTypes) {
      for (const packSize of sizes) {
        const expected = `pack_${packType}_${packSize}`;
        expect(COLLECTION_PACK_IDS).toContain(expected);
        expect(normalizePackIdForCollection(packType, packSize)).toBe(expected);
        expect(normalizePackIdForCollection(`p_${packType}_${packSize}`)).toBe(expected);
        expect(normalizePackIdForCollection(`p_${packType}_${packSize}_1`)).toBe(expected);
        expect(normalizePackIdForCollection(expected)).toBe(expected);
      }
    }

    for (const packSize of sizes) {
      expect(normalizePackIdForCollection('spectral', packSize)).toBeNull();
      expect(normalizePackIdForCollection(`p_spectral_${packSize}`)).toBeNull();
      expect(normalizePackIdForCollection(`pack_spectral_${packSize}`)).toBeNull();
    }

    expect(normalizePackIdForCollection('')).toBeNull();
    expect(normalizePackIdForCollection('unknown_pack')).toBeNull();
    expect(normalizePackIdForCollection('arcana', 'ultra')).toBeNull();
  });

  it('collectRunMetaDiscoveries собирает открытия из RunState и extras без DOM и мутаций', () => {
    const baseState = createInitialRunState('b_red', 'COLL-TEST-SEED');
    const foilCard = createPlayingCard({
      id: 'extra_foil',
      suit: 'spades',
      rank: 14,
      edition: 'foil',
    });
    const holoRelic = createRelicInstance('j_blueprint', 'r_1', 'holo');
    const negConsumable = createConsumableInstance('c_mercury', 'c_1', 'negative');

    const richState: RunState = {
      ...baseState,
      phase: 'playing',
      ante: 3,
      anteBlinds: [
        {
          kind: 'small',
          bossId: null,
          targetScore: 2000,
          reward: 3,
          status: 'skipped',
          skipTagId: 'tag_double',
        },
        {
          kind: 'big',
          bossId: null,
          targetScore: 3000,
          reward: 4,
          status: 'current',
          skipTagId: 'tag_coupon',
        },
        {
          kind: 'boss',
          bossId: 'bl_wall',
          targetScore: 4000,
          reward: 5,
          status: 'upcoming',
          skipTagId: 'tag_skip',
        },
      ],
      relics: [holoRelic],
      consumables: [negConsumable],
      lastUsedConsumableId: 'c_fool',
      charters: ['v_overstock_norm', 'v_hone'],
      pendingTags: ['tag_investment'],
      deck: [...baseState.deck, foilCard],
      booster: {
        packId: 'p_arcana_mega_1',
        packType: 'arcana',
        packSize: 'mega',
        choices: [],
        remainingPicks: 2,
        drawnHandCardIds: [],
        fromTag: false,
      },
    };

    const discoveries = collectRunMetaDiscoveries(richState, {
      extraConsumableIds: ['c_cryptid', 'c_mercury'],
      extraTagIds: ['tag_d_six', 'tag_double'],
      extraPackIds: ['p_buffoon_normal_1', 'pack_standard_jumbo', 'p_spectral_normal', 'bad_pack'],
      extraEditions: ['base', 'polychrome', 'foil'],
    });

    expect(discoveries.discoveredRelics).toEqual(['j_blueprint']);
    expect(discoveries.discoveredConsumables).toEqual(['c_mercury', 'c_fool', 'c_cryptid']);
    expect(discoveries.discoveredCharters).toEqual(['v_overstock_norm', 'v_hone']);
    expect(discoveries.discoveredBosses).toEqual(['bl_wall']);
    // Включает pendingTags, skipTagId только у skipped-слота и extras (без tag_coupon/tag_skip)
    expect(discoveries.discoveredTags).toEqual(['tag_double', 'tag_investment', 'tag_d_six']);
    // На 3-м анте в фазе playing открыт current big-монстр, но не skipped small
    expect(discoveries.discoveredMonsters).toEqual(['m_ante_3_big']);
    expect(discoveries.discoveredPacks).toEqual([
      'pack_arcana_mega',
      'pack_buffoon_normal',
      'pack_standard_jumbo',
    ]);
    expect(discoveries.discoveredEditions).toEqual(['holo', 'negative', 'foil', 'polychrome']);

    // В фазе blind_select текущий (ещё не начатый) монстр не открывается, но defeated открывается
    const blindSelectState: RunState = {
      ...richState,
      phase: 'blind_select',
      ante: 4,
      anteBlinds: [
        { kind: 'small', bossId: null, targetScore: 5000, reward: 3, status: 'defeated', skipTagId: null },
        { kind: 'big', bossId: null, targetScore: 7500, reward: 4, status: 'current', skipTagId: null },
        { kind: 'boss', bossId: 'bl_hook', targetScore: 10000, reward: 5, status: 'upcoming', skipTagId: null },
      ],
      booster: {
        packId: 'p_spectral_normal',
        packType: 'spectral',
        packSize: 'normal',
        choices: [],
        remainingPicks: 1,
        drawnHandCardIds: [],
        fromTag: false,
      },
    };

    const blindSelectDiscoveries = collectRunMetaDiscoveries(blindSelectState);
    expect(blindSelectDiscoveries.discoveredMonsters).toEqual(['m_ante_4_small']);
    expect(blindSelectDiscoveries.discoveredPacks).toEqual([]);

    // Для Анте 1 и Анте 9 (Endless) обычные монстры не добавляются
    const ante1Discoveries = collectRunMetaDiscoveries({
      ...richState,
      ante: 1,
      phase: 'playing',
    });
    expect(ante1Discoveries.discoveredMonsters).toEqual([]);

    const ante9Discoveries = collectRunMetaDiscoveries({
      ...richState,
      ante: 9,
      phase: 'playing',
    });
    expect(ante9Discoveries.discoveredMonsters).toEqual([]);

    // A11: после победы над Боссом Этапа 1 state.ante уже 2, а anteBlinds всё ещё с побеждённым Боссом Этапа 1 —
    // монстры m_ante_2_* НЕ должны засчитываться преждевременно; после Босса Этапа 2 (state.ante = 3) — m_ante_2_* засчитываются
    const postBoss1Shop: RunState = {
      ...richState,
      phase: 'shop',
      ante: 2,
      currentBlindIndex: 2,
      anteBlinds: [
        { kind: 'small', bossId: null, targetScore: 300, reward: 3, status: 'defeated', skipTagId: null },
        { kind: 'big', bossId: null, targetScore: 450, reward: 4, status: 'defeated', skipTagId: null },
        { kind: 'boss', bossId: 'bl_hook', targetScore: 600, reward: 5, status: 'defeated', skipTagId: null },
      ],
    };
    expect(collectRunMetaDiscoveries(postBoss1Shop).discoveredMonsters).toEqual([]);

    const postBoss2Shop: RunState = {
      ...postBoss1Shop,
      ante: 3,
    };
    expect(collectRunMetaDiscoveries(postBoss2Shop).discoveredMonsters).toEqual([
      'm_ante_2_small',
      'm_ante_2_big',
    ]);
  });
});
