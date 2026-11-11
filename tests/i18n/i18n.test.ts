import { afterEach, describe, expect, it, vi } from 'vitest';
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
import {
  EN_DICTIONARY,
  RU_DICTIONARY,
  createTranslator,
  formatMessage,
  getCatalogTexts,
  syncDocumentLanguage,
} from '../../src/i18n';

/**
 * Рекурсивно собирает все листовые пары [путьКлюча, строка] из объекта словаря.
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

/**
 * Запрещённые слова и корни для рейтинга 6+/12+ (модерация площадок).
 */
const FORBIDDEN_EN_PATTERNS: readonly RegExp[] = [
  /\bpokers?\b/i,
  /\bcasinos?\b/i,
  /\bbets?\b/i,
  /\bbetting\b/i,
  /\bstakes?\b/i,
  /\bblinds?\b/i,
  /\bchips?\b/i,
  /\btarots?\b/i,
  /\bdevils?\b/i,
  /\bhanged\s*man\b/i,
  /\bhanged\b/i,
  /\bouija\b/i,
  /\bdrunkards?\b/i,
  /\bjokers?\b/i,
  /\bvampires?\b/i,
  /\bgambl(?:e|ing)\b/i,
  /\bjackpots?\b/i,
  /\broulette\b/i,
];

const FORBIDDEN_RU_PATTERNS: readonly RegExp[] = [
  /(?<![а-яё])покер/iu,
  /(?<![а-яё])казино/iu,
  /(?<![а-яё])ставк[аиуео]?[ймх]?/iu,
  /(?<![а-яё])блайнд/iu,
  /(?<![а-яё])фишк/iu,
  /(?<![а-яё])фишек/iu,
  /(?<![а-яё])таро(?![а-яё])/iu,
  /(?<![а-яё])дьявол/iu,
  /(?<![а-яё])повешен/iu,
  /(?<![а-яё])шулер/iu,
  /(?<![а-яё])жертв/iu,
  /(?<![а-яё])вампир/iu,
  /(?<![а-яё])джокер/iu,
  /(?<![а-яё])рулетк/iu,
  /(?<![а-яё])азарт/iu,
];

describe('Локализация Balite (i18n)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = 'ru';
    }
  });

  it('обеспечивает 100% паритет ключей и плейсхолдеров между ru и en словарями', () => {
    const ruLeaves = collectLeafStrings(RU_DICTIONARY);
    const enLeaves = collectLeafStrings(EN_DICTIONARY);

    const ruMap = new Map(ruLeaves);
    const enMap = new Map(enLeaves);

    expect(ruLeaves.length).toBeGreaterThan(200);
    expect(Array.from(ruMap.keys()).sort()).toEqual(Array.from(enMap.keys()).sort());

    for (const [key, ruValue] of ruMap.entries()) {
      const enValue = enMap.get(key);
      expect(enValue, `Отсутствует перевод для ключа ${key}`).toBeDefined();
      expect(ruValue.trim().length, `Пустая RU-строка для ключа ${key}`).toBeGreaterThan(0);
      expect(enValue!.trim().length, `Пустая EN-строка для ключа ${key}`).toBeGreaterThan(0);

      // Набор параметров {placeholder} обязан совпадать 1:1 между языками
      expect(
        extractPlaceholders(ruValue),
        `Несовпадение плейсхолдеров в ключе ${key}`,
      ).toEqual(extractPlaceholders(enValue!));
    }
  });

  it('не содержит запрещённых слов покерной/казино/таро тематики ни в ru, ни в en строках', () => {
    const rawTemplates: Array<[string, string]> = [
      ...collectLeafStrings(RU_DICTIONARY, 'ru'),
      ...collectLeafStrings(EN_DICTIONARY, 'en'),
    ];

    // В исходных шаблонах проверяем всё содержимое за пределами имён {placeholder}
    for (const [path, template] of rawTemplates) {
      const staticText = template.replace(/\{[a-zA-Z0-9_]+\}/g, '0');
      for (const pattern of FORBIDDEN_EN_PATTERNS) {
        expect(
          pattern.test(staticText),
          `Запрещённое EN-слово ${pattern} в ${path}: "${template}"`,
        ).toBe(false);
      }
      for (const pattern of FORBIDDEN_RU_PATTERNS) {
        expect(
          pattern.test(staticText),
          `Запрещённое RU-слово ${pattern} в ${path}: "${template}"`,
        ).toBe(false);
      }
    }

    // В готовых строках каталога (кроме descriptionTemplate) проверяем текст целиком без замен
    for (const lang of ['ru', 'en'] as const) {
      const catalogLeaves = collectLeafStrings(getCatalogTexts(lang), `catalog.${lang}`).filter(
        ([path]) => !path.endsWith('.descriptionTemplate'),
      );
      for (const [path, text] of catalogLeaves) {
        for (const pattern of FORBIDDEN_EN_PATTERNS) {
          expect(pattern.test(text), `Запрещённое EN-слово ${pattern} в ${path}: "${text}"`).toBe(
            false,
          );
        }
        for (const pattern of FORBIDDEN_RU_PATTERNS) {
          expect(pattern.test(text), `Запрещённое RU-слово ${pattern} в ${path}: "${text}"`).toBe(
            false,
          );
        }
      }
    }
  });

  it('не допускает смешивания алфавитов (кириллица в EN допустима только в названии русского языка)', () => {
    const enLeaves = collectLeafStrings(EN_DICTIONARY);
    for (const [key, text] of enLeaves) {
      if (key === 'ui.settings.langRu') {
        expect(text).toBe('Русский');
        continue;
      }
      expect(/[а-яё]/i.test(text), `Кириллица в EN-ключе ${key}: "${text}"`).toBe(false);
    }

    // В RU-словаре латиница за пределами {placeholder} допустима лишь в бренде, скорости и 'English'/'X'
    const ruLeaves = collectLeafStrings(RU_DICTIONARY);
    for (const [key, text] of ruLeaves) {
      if (
        key === 'ui.app.title' ||
        key === 'ui.settings.langEn' ||
        key === 'celestials.c_planet_x.name' ||
        key === 'ui.settings.speed1x' ||
        key === 'ui.settings.speed2x' ||
        key === 'ui.settings.speed4x'
      ) {
        continue;
      }
      const withoutPlaceholders = text.replace(/\{[a-zA-Z0-9_]+\}/g, '');
      expect(
        /[a-z]/i.test(withoutPlaceholders),
        `Неожиданная латиница в RU-ключе ${key}: "${text}"`,
      ).toBe(false);
    }

    // В RU-настройках название английского языка — English (требование 8.2.3)
    expect(RU_DICTIONARY.ui.settings.langEn).toBe('English');
    expect(RU_DICTIONARY.ui.settings.langRu).toBe('Русский');
    expect(EN_DICTIONARY.ui.settings.langEn).toBe('English');
  });

  it('покрывает 100% всех идентификаторов движка в getCatalogTexts(lang) без сырых плейсхолдеров', () => {
    for (const lang of ['ru', 'en'] as const) {
      const catalog = getCatalogTexts(lang);

      for (const handType of HAND_TYPES) {
        expect(catalog.hands[handType].name.trim().length).toBeGreaterThan(0);
        expect(catalog.hands[handType].description.trim().length).toBeGreaterThan(0);
      }

      for (const relicId of RELIC_IDS) {
        const entry = catalog.relics[relicId];
        expect(entry.name.trim().length).toBeGreaterThan(0);
        expect(entry.description.trim().length).toBeGreaterThan(0);
        expect(entry.description).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
      }

      for (const celestialId of CELESTIAL_IDS) {
        const entry = catalog.celestials[celestialId];
        expect(entry.name.trim().length).toBeGreaterThan(0);
        expect(entry.description).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
      }

      for (const scrollId of SCROLL_IDS) {
        const entry = catalog.scrolls[scrollId];
        expect(entry.name.trim().length).toBeGreaterThan(0);
        expect(entry.description).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
      }

      for (const runeId of RUNE_IDS) {
        const entry = catalog.runes[runeId];
        expect(entry.name.trim().length).toBeGreaterThan(0);
        expect(entry.description).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
      }

      for (const charterId of CHARTER_IDS) {
        const entry = catalog.charters[charterId];
        expect(entry.name.trim().length).toBeGreaterThan(0);
        expect(entry.description).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
      }

      for (const tagId of TAG_IDS) {
        const entry = catalog.tags[tagId];
        expect(entry.name.trim().length).toBeGreaterThan(0);
        expect(entry.description).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
      }

      for (const bossId of BOSS_IDS) {
        const entry = catalog.bosses[bossId];
        expect(entry.name.trim().length).toBeGreaterThan(0);
        expect(entry.description).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
      }

      for (const blindKind of BLIND_KINDS) {
        expect(catalog.blinds[blindKind].name.trim().length).toBeGreaterThan(0);
        expect(catalog.blinds[blindKind].description.trim().length).toBeGreaterThan(0);
      }

      for (const deckId of DECK_IDS) {
        const entry = catalog.decks[deckId];
        expect(entry.name.trim().length).toBeGreaterThan(0);
        expect(entry.description).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
      }

      for (const enhancement of ENHANCEMENTS) {
        expect(catalog.enhancements[enhancement].name.trim().length).toBeGreaterThan(0);
        expect(catalog.enhancements[enhancement].description.trim().length).toBeGreaterThan(0);
      }

      for (const edition of EDITIONS) {
        expect(catalog.editions[edition].name.trim().length).toBeGreaterThan(0);
        expect(catalog.editions[edition].description.trim().length).toBeGreaterThan(0);
      }

      for (const seal of SEALS) {
        expect(catalog.seals[seal].name.trim().length).toBeGreaterThan(0);
        expect(catalog.seals[seal].description.trim().length).toBeGreaterThan(0);
      }

      for (const packType of PACK_TYPES) {
        expect(catalog.packTypes[packType].name.trim().length).toBeGreaterThan(0);
        expect(catalog.packTypes[packType].description.trim().length).toBeGreaterThan(0);
        for (const packSize of PACK_SIZES) {
          expect(catalog.packs[`${packType}_${packSize}`].trim().length).toBeGreaterThan(0);
        }
      }

      for (const packSize of PACK_SIZES) {
        expect(catalog.packSizes[packSize].name.trim().length).toBeGreaterThan(0);
        expect(catalog.packSizes[packSize].description.trim().length).toBeGreaterThan(0);
      }

      for (const suit of SUITS) {
        expect(catalog.suits[suit].name.trim().length).toBeGreaterThan(0);
        expect(catalog.suits[suit].symbol.trim().length).toBeGreaterThan(0);
      }

      for (const rank of RANKS) {
        expect(catalog.ranks[`${rank}`].name.trim().length).toBeGreaterThan(0);
        expect(catalog.ranks[`${rank}`].short.trim().length).toBeGreaterThan(0);
      }

      for (const kind of CONSUMABLE_KINDS) {
        expect(catalog.consumableKinds[kind].trim().length).toBeGreaterThan(0);
      }

      expect(catalog.rarities['1'].trim().length).toBeGreaterThan(0);
      expect(catalog.rarities['2'].trim().length).toBeGreaterThan(0);
      expect(catalog.rarities['3'].trim().length).toBeGreaterThan(0);
    }
  });

  it('сохраняет точные канонические названия Balite из GDD в русской локали', () => {
    const ruCatalog = getCatalogTexts('ru');

    expect(ruCatalog.relics.j_joker.name).toBe('Путевой камень');
    expect(ruCatalog.relics.j_vampire.name).toBe('Поглотитель чар');
    expect(ruCatalog.relics.j_gluttenous_joker.name).toBe('Четырёхлистник');
    expect(ruCatalog.relics.j_blueprint.name).toBe('Чертёж Мастера');
    expect(ruCatalog.relics.j_brainstorm.name).toBe('Искра Озарения');
    expect(ruCatalog.relics.j_vagabond.name).toBe('Аскет');

    expect(ruCatalog.hands['Flush Five'].name).toBe('Мастная пятёрка');
    expect(ruCatalog.hands['High Card'].name).toBe('Старшая карта');

    expect(ruCatalog.scrolls.c_heirophant.name).toBe('Свиток Рун');
    expect(ruCatalog.scrolls.c_hanged_man.name).toBe('Свиток Очищения');
    expect(ruCatalog.scrolls.c_devil.name).toBe('Свиток Мидаса');

    expect(ruCatalog.runes.c_black_hole.name).toBe('Звёздный провал');
    expect(ruCatalog.bosses.bl_final_vessel.name).toBe('Фиолетовый Монолит');
    expect(ruCatalog.bosses.bl_final_bell.name).toBe('Лазурный Звон');
    expect(ruCatalog.blinds.small.name).toBe('Малый Страж');
    expect(ruCatalog.blinds.big.name).toBe('Старший Страж');
    expect(ruCatalog.decks.b_red.name).toBe('Алая колода');
  });

  it('корректно подставляет параметры в formatMessage и шаблоны Реликвий', () => {
    expect(formatMessage('ru', 'ui.hud.stageWithMax', { ante: 3, maxAnte: 8 })).toBe('Этап 3/8');
    expect(formatMessage('en', 'ui.hud.stageWithMax', { ante: 3, maxAnte: 8 })).toBe('Stage 3/8');

    // Подстановка нуля не должна восприниматься как отсутствующий параметр
    expect(formatMessage('ru', 'relics.j_mystic_summit.description', { mult: 15, discards: 0 })).toContain(
      '0',
    );
    expect(formatMessage('en', 'relics.j_mystic_summit.description', { mult: 15, discards: 0 })).toBe(
      '+15 Mult when 0 discards remain',
    );

    // Проверка накопительного счётчика Реликвии
    expect(
      formatMessage('ru', 'relics.j_runner.description', { chipsStep: 15, chips: 45 }),
    ).toContain('+45');
    expect(
      formatMessage('en', 'relics.j_constellation.description', { xMultStep: 0.1, xMult: 1.4 }),
    ).toContain('×1.4');

    // Поддержка ключей TraceEvent (с префиксом trace. и без него)
    expect(formatMessage('ru', 'trace.boss_hook_discard', { count: 2 })).toBe(
      'Страж сбросил 2 карты',
    );
    expect(formatMessage('en', 'boss_hook_discard', { count: 2 })).toBe('Boss discarded 2 cards');

    // Недостающий параметр сохраняется в виде шаблона, неизвестный ключ возвращается как есть
    expect(formatMessage('en', 'ui.hud.stage', {})).toBe('Stage {ante}');
    expect(formatMessage('ru', 'trace.custom.unknown')).toBe('trace.custom.unknown');
  });

  it('предоставляет удобный переводчик createTranslator(lang) с объединением дефолтов и живых чисел', () => {
    const ruT = createTranslator('ru');
    const enT = createTranslator('en');

    expect(ruT.lang).toBe('ru');
    expect(enT.lang).toBe('en');

    expect(ruT.t('ui.actions.playHand')).toBe('Сыграть');
    expect(enT.t('ui.actions.playHand')).toBe('Play Hand');

    // Слияние параметров по умолчанию с живым значением chips
    const runner = enT.getRelicText('j_runner', { chips: 60 });
    expect(runner.name).toBe('Wayfarer Boots');
    expect(runner.description).toContain('+15 Power');
    expect(runner.description).toContain('+60');

    // Расходники (Сфера, Свиток, Руна), Грамоты, Знаки, Боссы, Колоды и Расклады
    expect(ruT.getConsumableText('c_mercury').name).toBe('Меркурий');
    expect(enT.getConsumableText('c_devil').name).toBe('Scroll of Midas');
    expect(ruT.getConsumableText('c_black_hole', { levels: 2 }).description).toContain('+2');
    expect(enT.getCharterText('v_observatory').name).toBe('Observatory');
    expect(ruT.getCharterText('v_observatory').name).toBe('Обсерватория');
    expect(ruT.getTagText('tag_investment').description).toContain('+25 з.');
    expect(enT.getBossText('bl_final_vessel').name).toBe('Violet Monolith');
    expect(ruT.getDeckText('b_yellow').description).toContain('+10 з.');
    expect(enT.getHandText('Flush').name).toBe('Flush');
    expect(ruT.getPackSubtitle(2, 5)).toBe('Выберите 2 из 5');
    expect(enT.getPackSubtitle(1, 3)).toBe('Choose 1 of 3');

    // Обычный Страж vs Босс Этапа
    expect(ruT.getBlindText('small').name).toBe('Малый Страж');
    expect(ruT.getBlindText('boss', 'bl_wall').name).toBe('Великая Стена');
    expect(enT.getPackTitle('buffoon', 'normal')).toBe('Relic Pack');
    expect(ruT.getPackTitle('buffoon', 'normal')).toBe('Обычный набор Реликвий');
    expect(enT.getRankLabel(14)).toBe('Ace');
    expect(ruT.getRankLabel(14, true)).toBe('Т');
    expect(enT.getSuitLabel('spades')).toBe('Spades');
    expect(ruT.getSuitLabel('spades', true)).toBe('П');
  });

  it('безопасно синхронизирует document.documentElement.lang при вызове syncDocumentLanguage', () => {
    document.documentElement.lang = 'en';
    syncDocumentLanguage('ru');
    expect(document.documentElement.lang).toBe('ru');

    syncDocumentLanguage('en');
    expect(document.documentElement.lang).toBe('en');

    // В среде без document функция не падает
    vi.stubGlobal('document', undefined);
    expect(() => syncDocumentLanguage('ru')).not.toThrow();
  });
});
