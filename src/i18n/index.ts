import type {
  BlindKind,
  BossId,
  CelestialId,
  CharterId,
  ConsumableId,
  DeckId,
  PackSize,
  PackType,
  Rank,
  RelicId,
  RuneId,
  ScrollId,
  Suit,
  TagId,
} from '../engine/types';
import { EN_DICTIONARY } from './en';
import { RU_DICTIONARY } from './ru';
import type {
  CatalogTextEntry,
  CatalogTexts,
  I18nLang,
  LocaleDictionary,
  MessageKey,
  MessageParams,
  PackCombinationKey,
  ParameterizedCatalogEntry,
  RankKey,
  Translator,
} from './types';

export { EN_DICTIONARY } from './en';
export { RU_DICTIONARY } from './ru';
export type * from './types';

/**
 * Буквенная шкала рангов приключенца в гильдии (от F на 1-м этапе до SS на 8-м).
 */
const GUILD_RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS'] as const;

/**
 * Возвращает буквенный ранг приключенца для номера этапа забега (F → SS, далее SS+).
 */
export function getGuildRank(ante: number): string {
  const index = Math.floor(ante) - 1;
  if (index < 0) return GUILD_RANKS[0];
  if (index < GUILD_RANKS.length) return GUILD_RANKS[index]!;
  return 'SS+';
}

/**
 * Карта поддерживаемых словарей по коду языка.
 */
export const DICTIONARIES: Readonly<Record<I18nLang, LocaleDictionary>> = {
  ru: RU_DICTIONARY,
  en: EN_DICTIONARY,
};

/**
 * Базовые параметры v1.0 для подстановки в описания Реликвий по умолчанию.
 */
export const DEFAULT_RELIC_PARAMS: Readonly<Record<RelicId, MessageParams>> = {
  j_joker: { mult: 4 },
  j_greedy_joker: { mult: 3 },
  j_lusty_joker: { mult: 3 },
  j_wrathful_joker: { mult: 3 },
  j_gluttenous_joker: { mult: 3 },
  j_jolly: { mult: 8 },
  j_sly: { chips: 50 },
  j_half: { mult: 20, maxCards: 3 },
  j_abstract: { multPerRelic: 3, mult: 0 },
  j_banner: { chipsPerDiscard: 30 },
  j_mystic_summit: { mult: 15, discards: 0 },
  j_scary_face: { chips: 30 },
  j_even_steven: { mult: 4 },
  j_odd_todd: { chips: 31 },
  j_runner: { chipsStep: 15, chips: 0 },
  j_green_joker: { multGain: 1, multLoss: 1, mult: 0 },
  j_photograph: { xMult: 2 },
  j_golden: { dollars: 4 },
  j_flash: { multStep: 2, mult: 0 },
  j_trousers: { multStep: 2, mult: 0 },
  j_ceremonial: { mult: 0 },
  j_blackboard: { xMult: 3 },
  j_card_sharp: { xMult: 3 },
  j_acrobat: { xMult: 3 },
  j_constellation: { xMultStep: 0.1, xMult: 1 },
  j_hologram: { xMultStep: 0.25, xMult: 1 },
  j_vampire: { xMultStep: 0.1, xMult: 1 },
  j_ramen: { xMult: 2, xMultLoss: 0.01 },
  j_stencil: { xMult: 1 },
  j_sock_and_buskin: { retriggers: 1 },
  j_mime: { retriggers: 1 },
  j_four_fingers: { cardsRequired: 4 },
  j_shortcut: {},
  j_bull: { chipsPerDollar: 2, chips: 0 },
  j_duo: { xMult: 2 },
  j_tribe: { xMult: 2 },
  j_baron: { xMult: 1.5 },
  j_blueprint: {},
  j_brainstorm: {},
  j_vagabond: { maxDollars: 4 },
};

/**
 * Базовые приросты Силы и Множителя для 12 Астральных сфер.
 */
export const DEFAULT_CELESTIAL_PARAMS: Readonly<Record<CelestialId, MessageParams>> = {
  c_mercury: { chips: 15, mult: 1 },
  c_venus: { chips: 20, mult: 2 },
  c_earth: { chips: 25, mult: 2 },
  c_mars: { chips: 30, mult: 3 },
  c_jupiter: { chips: 15, mult: 2 },
  c_saturn: { chips: 30, mult: 3 },
  c_uranus: { chips: 20, mult: 1 },
  c_neptune: { chips: 40, mult: 4 },
  c_pluto: { chips: 10, mult: 1 },
  c_planet_x: { chips: 35, mult: 3 },
  c_ceres: { chips: 40, mult: 4 },
  c_eris: { chips: 50, mult: 3 },
};

/**
 * Базовые параметры для 16 Алхимических свитков.
 */
export const DEFAULT_SCROLL_PARAMS: Readonly<Record<ScrollId, MessageParams>> = {
  c_fool: {},
  c_magician: { count: 2 },
  c_empress: { count: 2 },
  c_heirophant: { count: 2 },
  c_lovers: { count: 1 },
  c_chariot: { count: 1 },
  c_justice: { count: 1 },
  c_devil: { count: 1 },
  c_tower: { count: 1 },
  c_hermit: { maxDollars: 20 },
  c_temperance: { maxDollars: 50 },
  c_wheel_of_fortune: { odds: 4 },
  c_strength: { count: 2 },
  c_hanged_man: { count: 2 },
  c_death: { count: 2 },
  c_judgement: {},
};

/**
 * Базовые параметры для 9 Эфирных рун (включая c_black_hole).
 */
export const DEFAULT_RUNE_PARAMS: Readonly<Record<RuneId, MessageParams>> = {
  c_talisman: { count: 1 },
  c_deja_vu: { count: 1 },
  c_trance: { count: 1 },
  c_medium: { count: 1 },
  c_aura: { count: 1 },
  c_cryptid: { copies: 2, count: 1 },
  c_immolate: { destroyCount: 5, dollars: 20 },
  c_hex: {},
  c_black_hole: { levels: 1 },
};

/**
 * Базовые параметры для 12 Гильдейских грамот.
 */
export const DEFAULT_CHARTER_PARAMS: Readonly<Record<CharterId, MessageParams>> = {
  v_overstock_norm: { slots: 1 },
  v_clearance_sale: { percent: 25 },
  v_hone: { rate: 2 },
  v_reroll_surplus: { dollars: 2 },
  v_crystal_ball: { slots: 1 },
  v_grabber: { hands: 1 },
  v_wasteful: { discards: 1 },
  v_seed_money: { cap: 50 },
  v_paint_brush: { size: 1 },
  v_telescope: {},
  v_observatory: { xMult: 1.5 },
  v_directors_cut: { dollars: 10 },
};

/**
 * Базовые параметры для 10 Знаков пропуска.
 */
export const DEFAULT_TAG_PARAMS: Readonly<Record<TagId, MessageParams>> = {
  tag_uncommon: {},
  tag_rare: {},
  tag_investment: { dollars: 25 },
  tag_economy: { maxDollars: 40 },
  tag_coupon: {},
  tag_d_six: {},
  tag_double: {},
  tag_juggle: { size: 3 },
  tag_charm: {},
  tag_skip: { dollarsPerSkip: 5 },
};

/**
 * Базовые параметры для 10 Боссов Этапа.
 */
export const DEFAULT_BOSS_PARAMS: Readonly<Record<BossId, MessageParams>> = {
  bl_hook: { count: 2 },
  bl_manacle: { count: 1 },
  bl_psychic: { count: 5 },
  bl_pillar: {},
  bl_club: {},
  bl_water: {},
  bl_wall: {},
  bl_flint: {},
  bl_final_vessel: {},
  bl_final_bell: {},
};

/**
 * Базовые параметры для 4 стартовых колод.
 */
export const DEFAULT_DECK_PARAMS: Readonly<Record<DeckId, MessageParams>> = {
  b_red: { discards: 1 },
  b_blue: { hands: 1 },
  b_yellow: { dollars: 10 },
  b_black: { relicSlots: 1, handsLoss: 1 },
};

const RE_PLACEHOLDER = /\{([a-zA-Z0-9_]+)\}/g;

/**
 * Нормализует переданный код языка к поддерживаемым 'ru' | 'en'.
 */
function resolveLang(lang: I18nLang | string | undefined): I18nLang {
  return lang === 'ru' ? 'ru' : 'en';
}

/**
 * Заменяет вложенные шаблоны {param} значениями из словаря params.
 */
export function interpolate(template: string, params?: MessageParams): string {
  if (!params) {
    return template;
  }
  return template.replace(RE_PLACEHOLDER, (fullMatch, token: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, token)) {
      return fullMatch;
    }
    const value = params[token];
    return value === undefined ? fullMatch : String(value);
  });
}

/**
 * Разворачивает вложенный объект словаря в плоскую карту 'section.key' -> шаблон.
 */
function flattenDictionary(node: unknown, prefix = '', target = new Map<string, string>()): Map<string, string> {
  if (typeof node === 'string') {
    target.set(prefix, node);
    return target;
  }
  if (!node || typeof node !== 'object') {
    return target;
  }
  for (const [key, value] of Object.entries(node)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenDictionary(value, nextPrefix, target);
  }
  return target;
}

const FLAT_MESSAGES: Record<I18nLang, Map<string, string>> = {
  ru: flattenDictionary(RU_DICTIONARY),
  en: flattenDictionary(EN_DICTIONARY),
};

const CATALOG_CACHE: Partial<Record<I18nLang, CatalogTexts>> = {};

// DEV-оверлей оригинальной терминологии подключается строго под import.meta.env.DEV и вырезается из prod-бандла
const DEV_ORIGINAL_STORAGE_KEY = 'balite_dev_original_terms_v1';
let devOriginalEnabled = false;
let devOriginalDictionaries: Readonly<Record<I18nLang, LocaleDictionary>> | null = null;
let devOriginalFlatMessages: Readonly<Record<I18nLang, Map<string, string>>> | null = null;
let devCatalogCache: Partial<Record<I18nLang, CatalogTexts>> = {};

function getActiveDictionaries(): Readonly<Record<I18nLang, LocaleDictionary>> {
  if (import.meta.env.DEV && devOriginalEnabled && devOriginalDictionaries) {
    return devOriginalDictionaries;
  }
  return DICTIONARIES;
}

function getActiveFlatMessages(): Readonly<Record<I18nLang, Map<string, string>>> {
  if (import.meta.env.DEV && devOriginalEnabled && devOriginalFlatMessages) {
    return devOriginalFlatMessages;
  }
  return FLAT_MESSAGES;
}

/**
 * Возвращает сохранённое состояние DEV-переключателя оригинальной терминологии (strictly DEV-only).
 */
export function readStoredDevOriginalTermsFlag(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }
  try {
    return (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(DEV_ORIGINAL_STORAGE_KEY) === '1'
    );
  } catch {
    return false;
  }
}

/**
 * Показывает, активен ли в данный момент DEV-словарь оригинальной терминологии.
 */
export function isDevOriginalTermsEnabled(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }
  return devOriginalEnabled && devOriginalDictionaries !== null;
}

/**
 * Включает или отключает DEV-словарь оригинальной терминологии с ленивой подгрузкой модуля оверлея.
 * В продакшен-сборке (`import.meta.env.DEV === false`) полностью вырезается сборщиком Vite.
 */
export async function setDevOriginalTermsEnabled(
  enabled: boolean,
  persist = true,
): Promise<boolean> {
  if (!import.meta.env.DEV) {
    return false;
  }

  if (enabled) {
    if (!devOriginalDictionaries) {
      const overlayModule = await import('./devOriginalOverlay');
      const built = overlayModule.buildDevOriginalDictionaries(DICTIONARIES);
      devOriginalDictionaries = built;
      devOriginalFlatMessages = {
        ru: flattenDictionary(built.ru),
        en: flattenDictionary(built.en),
      };
      devCatalogCache = {};
    }
    devOriginalEnabled = true;
  } else {
    devOriginalEnabled = false;
  }

  if (persist) {
    try {
      if (typeof localStorage !== 'undefined') {
        if (devOriginalEnabled) {
          localStorage.setItem(DEV_ORIGINAL_STORAGE_KEY, '1');
        } else {
          localStorage.removeItem(DEV_ORIGINAL_STORAGE_KEY);
        }
      }
    } catch {
      // Игнорируем ограничения sandbox/private-mode при обращении к localStorage
    }
  }

  return devOriginalEnabled;
}

/**
 * Возвращает словарь локализации для указанного языка.
 */
export function getDictionary(lang: I18nLang): LocaleDictionary {
  return getActiveDictionaries()[resolveLang(lang)];
}

/**
 * Форматирует сообщение по ключу и подставляет параметры в шаблон.
 * Безопасно поддерживает короткие locKey событий без префикса 'trace.'.
 */
export function formatMessage(
  lang: I18nLang,
  key: MessageKey | (string & {}),
  params?: MessageParams,
): string {
  const flatMap = getActiveFlatMessages()[resolveLang(lang)];
  const template = flatMap.get(key) ?? flatMap.get(`trace.${key}`);
  if (template === undefined) {
    return key;
  }
  return interpolate(template, params);
}

/**
 * Формирует параметризованный подраздел каталога с дефолтными значениями и шаблоном.
 */
function buildParameterizedSection<K extends string>(
  rawSection: Readonly<Record<K, CatalogTextEntry>>,
  defaultsMap: Readonly<Record<K, MessageParams>>,
): Readonly<Record<K, ParameterizedCatalogEntry>> {
  const out = {} as Record<K, ParameterizedCatalogEntry>;
  for (const key of Object.keys(rawSection) as K[]) {
    const raw = rawSection[key];
    out[key] = {
      name: raw.name,
      description: interpolate(raw.description, defaultsMap[key]),
      descriptionTemplate: raw.description,
    };
  }
  return out;
}

/**
 * Возвращает полный каталог локализованных текстов для всех сущностей игры.
 */
export function getCatalogTexts(lang: I18nLang): CatalogTexts {
  const resolved = resolveLang(lang);
  const useDevCache = import.meta.env.DEV && devOriginalEnabled && devOriginalDictionaries !== null;
  const cache = useDevCache ? devCatalogCache : CATALOG_CACHE;
  const cached = cache[resolved];
  if (cached) {
    return cached;
  }

  const dict = getActiveDictionaries()[resolved];
  const catalog: CatalogTexts = {
    hands: dict.hands,
    relics: buildParameterizedSection(dict.relics, DEFAULT_RELIC_PARAMS),
    celestials: buildParameterizedSection(dict.celestials, DEFAULT_CELESTIAL_PARAMS),
    scrolls: buildParameterizedSection(dict.scrolls, DEFAULT_SCROLL_PARAMS),
    runes: buildParameterizedSection(dict.runes, DEFAULT_RUNE_PARAMS),
    charters: buildParameterizedSection(dict.charters, DEFAULT_CHARTER_PARAMS),
    tags: buildParameterizedSection(dict.tags, DEFAULT_TAG_PARAMS),
    bosses: buildParameterizedSection(dict.bosses, DEFAULT_BOSS_PARAMS),
    blinds: dict.blinds,
    anteMonsters: dict.anteMonsters,
    decks: buildParameterizedSection(dict.decks, DEFAULT_DECK_PARAMS),
    enhancements: dict.enhancements,
    editions: dict.editions,
    seals: dict.seals,
    packTypes: dict.packTypes,
    packSizes: dict.packSizes,
    packs: dict.packs,
    suits: dict.suits,
    ranks: dict.ranks,
    rarities: dict.rarities,
    consumableKinds: dict.consumableKinds,
  };

  cache[resolved] = catalog;
  return catalog;
}

/**
 * Создаёт параметризованную запись для конкретной сущности с учётом живых параметров.
 */
function formatParameterizedEntry<K extends string>(
  rawSection: Readonly<Record<K, CatalogTextEntry>>,
  defaultsMap: Readonly<Record<K, MessageParams>>,
  id: K,
  params?: MessageParams,
): ParameterizedCatalogEntry {
  const raw = rawSection[id];
  const mergedParams: MessageParams = params
    ? { ...defaultsMap[id], ...params }
    : defaultsMap[id];
  return {
    name: raw.name,
    description: interpolate(raw.description, mergedParams),
    descriptionTemplate: raw.description,
  };
}

/**
 * Возвращает тексты расходника любого вида (Сфера, Свиток или Руна).
 */
function resolveConsumableEntry(
  dict: LocaleDictionary,
  id: ConsumableId,
  params?: MessageParams,
): ParameterizedCatalogEntry {
  if (Object.prototype.hasOwnProperty.call(dict.celestials, id)) {
    return formatParameterizedEntry(
      dict.celestials,
      DEFAULT_CELESTIAL_PARAMS,
      id as CelestialId,
      params,
    );
  }
  if (Object.prototype.hasOwnProperty.call(dict.scrolls, id)) {
    return formatParameterizedEntry(
      dict.scrolls,
      DEFAULT_SCROLL_PARAMS,
      id as ScrollId,
      params,
    );
  }
  return formatParameterizedEntry(dict.runes, DEFAULT_RUNE_PARAMS, id as RuneId, params);
}

/**
 * Создаёт привязанный к языку объект переводчика для использования в UI.
 */
export function createTranslator(lang: I18nLang): Translator {
  const resolved = resolveLang(lang);
  const dict = getActiveDictionaries()[resolved];
  const catalog = getCatalogTexts(resolved);

  return {
    lang: resolved,
    catalog,
    t(key: MessageKey | (string & {}), params?: MessageParams): string {
      return formatMessage(resolved, key, params);
    },
    getHandText(handType): CatalogTextEntry {
      return catalog.hands[handType];
    },
    getRelicText(relicId: RelicId, params?: MessageParams): ParameterizedCatalogEntry {
      return formatParameterizedEntry(dict.relics, DEFAULT_RELIC_PARAMS, relicId, params);
    },
    getConsumableText(id: ConsumableId, params?: MessageParams): ParameterizedCatalogEntry {
      return resolveConsumableEntry(dict, id, params);
    },
    getCharterText(id: CharterId, params?: MessageParams): ParameterizedCatalogEntry {
      return formatParameterizedEntry(dict.charters, DEFAULT_CHARTER_PARAMS, id, params);
    },
    getTagText(id: TagId, params?: MessageParams): ParameterizedCatalogEntry {
      return formatParameterizedEntry(dict.tags, DEFAULT_TAG_PARAMS, id, params);
    },
    getBossText(id: BossId, params?: MessageParams): ParameterizedCatalogEntry {
      return formatParameterizedEntry(dict.bosses, DEFAULT_BOSS_PARAMS, id, params);
    },
    getDeckText(id: DeckId, params?: MessageParams): ParameterizedCatalogEntry {
      return formatParameterizedEntry(dict.decks, DEFAULT_DECK_PARAMS, id, params);
    },
    getBlindText(kind: BlindKind, bossId?: BossId | null, ante?: number): CatalogTextEntry {
      if (kind === 'boss' && bossId) {
        return catalog.bosses[bossId];
      }
      if (ante !== undefined && catalog.anteMonsters) {
        const tier = Math.max(1, Math.min(8, Math.floor(ante)));
        const monster = catalog.anteMonsters[tier]?.[kind as 'small' | 'big'];
        if (monster) {
          return monster;
        }
      }
      return catalog.blinds[kind];
    },
    getPackTitle(type: PackType, size: PackSize): string {
      const key: PackCombinationKey = `${type}_${size}`;
      return catalog.packs[key];
    },
    getPackSubtitle(chooseCount: number, totalCards: number): string {
      return formatMessage(resolved, 'ui.booster.choosePattern', {
        choose: chooseCount,
        total: totalCards,
      });
    },
    getRankLabel(rank: Rank, short = false): string {
      const entry = catalog.ranks[String(rank) as RankKey];
      return short ? entry.short : entry.name;
    },
    getSuitLabel(suit: Suit, short = false): string {
      const entry = catalog.suits[suit];
      return short ? entry.short : entry.name;
    },
  };
}

/**
 * Безопасно синхронизирует атрибут lang корневого элемента <html> при наличии DOM.
 */
export function syncDocumentLanguage(lang: I18nLang): I18nLang {
  const resolved = resolveLang(lang);
  if (typeof document !== 'undefined' && document !== null && document.documentElement) {
    document.documentElement.lang = resolved;
  }
  return resolved;
}
