import { describe, expect, it } from 'vitest';
import {
  BLIND_KINDS,
  BOSS_IDS,
  CELESTIAL_IDS,
  CHARTER_IDS,
  CONSUMABLE_KINDS,
  DECK_IDS,
  EDITIONS,
  ENHANCEMENTS,
  HAND_TYPES,
  PACK_SIZES,
  PACK_TYPES,
  RANKS,
  RELIC_IDS,
  RUNE_IDS,
  SCROLL_IDS,
  SEALS,
  SUITS,
  TAG_IDS,
} from '../../src/engine/types';
import { EN_DICTIONARY, RU_DICTIONARY } from '../../src/i18n';
import {
  DEV_ORIGINAL_OVERLAYS,
  applyDevOriginalOverlay,
  buildDevOriginalDictionaries,
} from '../../src/i18n/devOriginalOverlay';
import type { I18nLang, LocaleDictionary, PackCombinationKey, RankKey } from '../../src/i18n/types';

/**
 * Рекурсивно собирает все пары [путьКлюча, строка] из словаря локализации.
 */
function collectLeafStrings(node: unknown, prefix = ''): Array<[string, string]> {
  if (typeof node === 'string') {
    return [[prefix, node]];
  }
  if (!node || typeof node !== 'object') {
    return [];
  }

  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(node)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    entries.push(...collectLeafStrings(value, nextPrefix));
  }
  return entries;
}

/**
 * Извлекает отсортированный список имён плейсхолдеров формата {param}.
 */
function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{([a-zA-Z0-9_]+)\}/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1, -1)))).sort();
}

describe('DEV-словарь оригинальной терминологии Balatro (devOriginalOverlay)', () => {
  it('не мутирует базовые словари RU_DICTIONARY и EN_DICTIONARY при наложении оверлея', () => {
    const ruBefore = RU_DICTIONARY.relics.j_joker.name;
    const enBefore = EN_DICTIONARY.relics.j_joker.name;
    const ruUiBefore = RU_DICTIONARY.ui.hud.power;
    const enUiBefore = EN_DICTIONARY.ui.hud.power;

    const devRu = applyDevOriginalOverlay('ru', RU_DICTIONARY);
    const devEn = applyDevOriginalOverlay('en', EN_DICTIONARY);

    expect(RU_DICTIONARY.relics.j_joker.name).toBe(ruBefore);
    expect(EN_DICTIONARY.relics.j_joker.name).toBe(enBefore);
    expect(RU_DICTIONARY.ui.hud.power).toBe(ruUiBefore);
    expect(EN_DICTIONARY.ui.hud.power).toBe(enUiBefore);

    expect(devRu).not.toBe(RU_DICTIONARY);
    expect(devEn).not.toBe(EN_DICTIONARY);
    expect(devRu.relics).not.toBe(RU_DICTIONARY.relics);
    expect(devEn.ui).not.toBe(EN_DICTIONARY.ui);
  });

  it('возвращает полную карту DEV-словарей для ru и en без пропусков ключей', () => {
    const devDicts = buildDevOriginalDictionaries({
      ru: RU_DICTIONARY,
      en: EN_DICTIONARY,
    });

    for (const lang of ['ru', 'en'] as const satisfies readonly I18nLang[]) {
      const dict: LocaleDictionary = devDicts[lang];
      for (const hand of HAND_TYPES) {
        expect(dict.hands[hand]?.name.length).toBeGreaterThan(0);
        expect(dict.hands[hand]?.description.length).toBeGreaterThan(0);
      }
      for (const id of RELIC_IDS) {
        expect(dict.relics[id]?.name.length).toBeGreaterThan(0);
        expect(dict.relics[id]?.description.length).toBeGreaterThan(0);
      }
      for (const id of CELESTIAL_IDS) {
        expect(dict.celestials[id]?.name.length).toBeGreaterThan(0);
        expect(dict.celestials[id]?.description.length).toBeGreaterThan(0);
      }
      for (const id of SCROLL_IDS) {
        expect(dict.scrolls[id]?.name.length).toBeGreaterThan(0);
        expect(dict.scrolls[id]?.description.length).toBeGreaterThan(0);
      }
      for (const id of RUNE_IDS) {
        expect(dict.runes[id]?.name.length).toBeGreaterThan(0);
        expect(dict.runes[id]?.description.length).toBeGreaterThan(0);
      }
      for (const id of CHARTER_IDS) {
        expect(dict.charters[id]?.name.length).toBeGreaterThan(0);
        expect(dict.charters[id]?.description.length).toBeGreaterThan(0);
      }
      for (const id of TAG_IDS) {
        expect(dict.tags[id]?.name.length).toBeGreaterThan(0);
        expect(dict.tags[id]?.description.length).toBeGreaterThan(0);
      }
      for (const id of BOSS_IDS) {
        expect(dict.bosses[id]?.name.length).toBeGreaterThan(0);
        expect(dict.bosses[id]?.description.length).toBeGreaterThan(0);
      }
      for (const kind of BLIND_KINDS) {
        expect(dict.blinds[kind]?.name.length).toBeGreaterThan(0);
        expect(dict.blinds[kind]?.description.length).toBeGreaterThan(0);
      }
      for (const id of DECK_IDS) {
        expect(dict.decks[id]?.name.length).toBeGreaterThan(0);
        expect(dict.decks[id]?.description.length).toBeGreaterThan(0);
      }
      for (const enh of ENHANCEMENTS) {
        expect(dict.enhancements[enh]?.name.length).toBeGreaterThan(0);
      }
      for (const ed of EDITIONS) {
        expect(dict.editions[ed]?.name.length).toBeGreaterThan(0);
      }
      for (const seal of SEALS) {
        expect(dict.seals[seal]?.name.length).toBeGreaterThan(0);
      }
      for (const pType of PACK_TYPES) {
        expect(dict.packTypes[pType]?.name.length).toBeGreaterThan(0);
        for (const pSize of PACK_SIZES) {
          const combo: PackCombinationKey = `${pType}_${pSize}`;
          expect(dict.packs[combo]?.length).toBeGreaterThan(0);
        }
      }
      for (const kind of CONSUMABLE_KINDS) {
        expect(dict.consumableKinds[kind]?.length).toBeGreaterThan(0);
      }
      for (const suit of SUITS) {
        expect(dict.suits[suit]?.name.length).toBeGreaterThan(0);
      }
      for (const rank of RANKS) {
        expect(dict.ranks[String(rank) as RankKey]?.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('сохраняет все {placeholder}-шаблоны 1:1 и не содержит сырой Lua-разметки', () => {
    const pairs: Array<[I18nLang, LocaleDictionary]> = [
      ['ru', RU_DICTIONARY],
      ['en', EN_DICTIONARY],
    ];

    for (const [lang, base] of pairs) {
      const overlaid = applyDevOriginalOverlay(lang, base);
      const baseLeaves = new Map(collectLeafStrings(base));
      const overlaidLeaves = collectLeafStrings(overlaid);

      expect(overlaidLeaves.length).toBe(baseLeaves.size);

      for (const [keyPath, value] of overlaidLeaves) {
        expect(value.trim(), `${lang}.${keyPath} не должен быть пустым`).not.toBe('');
        expect(value, `${lang}.${keyPath} не должен содержать сырой Lua-разметки`).not.toMatch(
          /\{[CXV]:|#\d+#/,
        );

        const expectedPlaceholders = extractPlaceholders(baseLeaves.get(keyPath) ?? '');
        const actualPlaceholders = extractPlaceholders(value);
        expect(
          actualPlaceholders,
          `Нарушены плейсхолдеры для ${lang}.${keyPath}`,
        ).toEqual(expectedPlaceholders);
      }
    }
  });

  it('покрывает все игровые сущности из каталогов в DEV_ORIGINAL_OVERLAYS (ru и en)', () => {
    for (const lang of ['ru', 'en'] as const satisfies readonly I18nLang[]) {
      const overlay = DEV_ORIGINAL_OVERLAYS[lang];
      expect(Object.keys(overlay.hands ?? {}).sort()).toEqual([...HAND_TYPES].sort());
      expect(Object.keys(overlay.relics ?? {}).sort()).toEqual([...RELIC_IDS].sort());
      expect(Object.keys(overlay.celestials ?? {}).sort()).toEqual([...CELESTIAL_IDS].sort());
      expect(Object.keys(overlay.scrolls ?? {}).sort()).toEqual([...SCROLL_IDS].sort());
      expect(Object.keys(overlay.runes ?? {}).sort()).toEqual([...RUNE_IDS].sort());
      expect(Object.keys(overlay.charters ?? {}).sort()).toEqual([...CHARTER_IDS].sort());
      expect(Object.keys(overlay.tags ?? {}).sort()).toEqual([...TAG_IDS].sort());
      expect(Object.keys(overlay.bosses ?? {}).sort()).toEqual([...BOSS_IDS].sort());
      expect(Object.keys(overlay.blinds ?? {}).sort()).toEqual([...BLIND_KINDS].sort());
      expect(Object.keys(overlay.decks ?? {}).sort()).toEqual([...DECK_IDS].sort());
    }
  });

  it('содержит точные оригинальные русские термины Balatro (Джокеры, Таро, Планеты, Спектральные, Ваучеры, Теги, Блайнды, Покерные комбинации, Анте, Колоды, Джимбо)', () => {
    const ru = applyDevOriginalOverlay('ru', RU_DICTIONARY);

    // Базовые понятия интерфейса, Фишки, Анте, Блайнды, Джимбо
    expect(ru.ui.hud.power).toBe('Фишки');
    expect(ru.ui.hud.stage).toContain('Анте');
    expect(ru.ui.hud.relics).toBe('Джокеры');
    expect(ru.ui.hud.activeTags).toBe('Теги');
    expect(ru.ui.hud.royalFlush).toBe('Флеш-рояль');
    expect(ru.ui.handReference.title).toContain('Покер');
    expect(ru.ui.shop.charterTitle).toBe('Ваучер');
    expect(ru.ui.credits.settingLine).toContain('Джимбо');
    expect(ru.ui.app.subtitle).toContain('Джимбо');

    // Расходники и Покерные комбинации
    expect(ru.consumableKinds.scroll).toBe('Таро');
    expect(ru.consumableKinds.celestial).toBe('Планета');
    expect(ru.consumableKinds.rune).toBe('Спектральная');
    expect(ru.hands['Straight'].name).toBe('Стрит');
    expect(ru.hands['Flush'].name).toBe('Флеш');
    expect(ru.hands['Three of a Kind'].name).toBe('Сет');
    expect(ru.hands['Four of a Kind'].name).toBe('Каре');
    expect(ru.hands['Full House'].name).toBe('Фулл-хаус');

    // Примеры Джокеров, Таро, Планет, Спектральных, Ваучеров, Тегов, Блайндов, Колод
    expect(ru.relics.j_joker.name).toBe('Джокер');
    expect(ru.relics.j_blueprint.name).toBe('Чертеж');
    expect(ru.relics.j_vagabond.name).toBe('Бродяга');
    expect(ru.relics.j_ceremonial.name).toBe('Церемониальный кинжал');
    expect(ru.scrolls.c_fool.name).toBe('Дурак');
    expect(ru.scrolls.c_devil.name).toBe('Дьявол');
    expect(ru.scrolls.c_hanged_man.name).toBe('Висельник');
    expect(ru.celestials.c_mercury.name).toBe('Меркурий');
    expect(ru.runes.c_immolate.name).toBe('Жертвоприношение');
    expect(ru.charters.v_overstock_norm.name).toBe('Избыток');
    expect(ru.charters.v_directors_cut.name).toBe('Режиссерская версия');
    expect(ru.tags.tag_charm.name).toBe('Тег очарования');
    expect(ru.blinds.small.name).toBe('Малый блайнд');
    expect(ru.blinds.big.name).toBe('Большой блайнд');
    expect(ru.blinds.boss.name).toBe('Босс-блайнд');
    expect(ru.bosses.bl_hook.name).toBe('Крюк');
    expect(ru.bosses.bl_final_bell.name).toBe('Лазурный колокольчик');
    expect(ru.decks.b_red.name).toBe('Красная колода');
    expect(ru.editions.negative.name).toBe('Негативный');
    expect(ru.packTypes.buffoon.name).toBe('Набор шута');
  });

  it('содержит точные оригинальные английские термины Balatro (Jokers, Tarot, Planets, Spectral, Vouchers, Tags, Blinds, Poker Hands, Ante, Decks, Jimbo)', () => {
    const en = applyDevOriginalOverlay('en', EN_DICTIONARY);

    expect(en.ui.hud.power).toBe('Chips');
    expect(en.ui.hud.stage).toContain('Ante');
    expect(en.ui.hud.relics).toBe('Jokers');
    expect(en.ui.hud.activeTags).toBe('Tags');
    expect(en.ui.hud.royalFlush).toBe('Royal Flush');
    expect(en.ui.handReference.title).toContain('Poker Hands');
    expect(en.ui.shop.charterTitle).toBe('Voucher');
    expect(en.ui.credits.settingLine).toContain('Jimbo');
    expect(en.ui.app.subtitle).toContain('Jimbo');

    expect(en.consumableKinds.scroll).toBe('Tarot');
    expect(en.consumableKinds.celestial).toBe('Planet');
    expect(en.consumableKinds.rune).toBe('Spectral');
    expect(en.hands['Straight'].name).toBe('Straight');
    expect(en.hands['Flush'].name).toBe('Flush');
    expect(en.hands['High Card'].name).toBe('High Card');

    expect(en.relics.j_joker.name).toBe('Joker');
    expect(en.relics.j_greedy_joker.name).toBe('Greedy Joker');
    expect(en.relics.j_blueprint.name).toBe('Blueprint');
    expect(en.relics.j_vagabond.name).toBe('Vagabond');
    expect(en.scrolls.c_fool.name).toBe('The Fool');
    expect(en.scrolls.c_devil.name).toBe('The Devil');
    expect(en.scrolls.c_hanged_man.name).toBe('The Hanged Man');
    expect(en.celestials.c_planet_x.name).toBe('Planet X');
    expect(en.runes.c_immolate.name).toBe('Immolate');
    expect(en.charters.v_overstock_norm.name).toBe('Overstock');
    expect(en.charters.v_directors_cut.name).toBe("Director's Cut");
    expect(en.tags.tag_skip.name).toBe('Speed Tag');
    expect(en.blinds.small.name).toBe('Small Blind');
    expect(en.blinds.big.name).toBe('Big Blind');
    expect(en.blinds.boss.name).toBe('Boss Blind');
    expect(en.bosses.bl_hook.name).toBe('The Hook');
    expect(en.bosses.bl_final_bell.name).toBe('Cerulean Bell');
    expect(en.decks.b_red.name).toBe('Red Deck');
    expect(en.editions.negative.name).toBe('Negative');
    expect(en.packTypes.buffoon.name).toBe('Buffoon Pack');
  });
});
