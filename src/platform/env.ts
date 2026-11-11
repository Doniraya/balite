import type { PlatformId, SupportedLang } from './types';

export interface WindowLike {
  YaGames?: unknown;
  FAPI?: unknown;
  iframeApi?: unknown;
  AndroidBridge?: unknown;
  webkit?: {
    messageHandlers?: {
      VKWebAppClose?: unknown;
    };
  };
  location?: {
    hash?: string;
    hostname?: string;
    search?: string;
  };
}

const VALID_PLATFORMS: ReadonlySet<string> = new Set([
  'yandex',
  'vk',
  'ok',
  'vkplay',
  'mock',
]);

const CIS_LANG_CODES: ReadonlySet<string> = new Set([
  'ru',
  'be',
  'kk',
  'uk',
  'uz',
]);

function safeDecode(value: string): string {
  const normalized = value.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}

/**
 * Разбирает query- или hash-строку параметров URL в словарь с ключами в нижнем регистре.
 */
export function parseUrlParams(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;

  const trimmed = raw.replace(/^[?#]+/, '');
  if (!trimmed) return out;

  for (const part of trimmed.split('&')) {
    if (!part) continue;
    const eqIndex = part.indexOf('=');
    const rawKey = eqIndex === -1 ? part : part.slice(0, eqIndex);
    const rawValue = eqIndex === -1 ? '' : part.slice(eqIndex + 1);
    const key = safeDecode(rawKey).trim().toLowerCase();
    if (!key) continue;
    out[key] = safeDecode(rawValue);
  }

  return out;
}

/**
 * Объединяет параметры из hash и search; параметры из search имеют приоритет.
 */
export function getAllUrlParams(
  search: string = typeof window !== 'undefined' ? window.location.search : '',
  hash: string = typeof window !== 'undefined' ? window.location.hash : '',
): Record<string, string> {
  const hashParams = hash.includes('=') ? parseUrlParams(hash) : {};
  const searchParams = parseUrlParams(search);
  return { ...hashParams, ...searchParams };
}

/**
 * Приводит код языка площадки или браузера к поддерживаемым 'ru' | 'en'.
 */
export function normalizeLang(
  rawLang?: string | null,
  navigatorLang: string = typeof navigator !== 'undefined' ? navigator.language || '' : '',
): SupportedLang {
  const candidate = (rawLang ?? '').trim() || navigatorLang.trim();
  if (!candidate) return 'ru';

  if (candidate === '0' || candidate === '1' || candidate === '2') return 'ru';
  if (candidate === '3') return 'en';

  const primaryCode = candidate.toLowerCase().split(/[-_]/)[0] ?? '';
  return CIS_LANG_CODES.has(primaryCode) ? 'ru' : 'en';
}

function extractHost(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.includes('://')) {
    try {
      return new URL(trimmed).hostname.toLowerCase();
    } catch {
      return trimmed;
    }
  }
  return trimmed.split(/[/:?#]/)[0] ?? '';
}

const RE_YANDEX_HOST =
  /(?:^|\.)(?:yandex\.(?:ru|com|net|by|kz|uz|az|tj|tm|kg|md|ee|lv|lt|ua|ge|am|fr|co\.il|com\.am|com\.ge|com\.tr)|playhop\.com|yastatic\.net)$/i;
const RE_VK_HOST = /(?:^|\.)(?:vk\.com|vk\.ru|vk-apps\.com|mvk\.com)$/i;
const RE_OK_HOST = /(?:^|\.)(?:ok\.ru|odnoklassniki\.ru|mycdn\.me|apiok\.ru)$/i;
const RE_VKPLAY_HOST = /(?:^|\.)(?:vkplay\.ru|vkplay\.live|store\.my\.games)$/i;

/**
 * Определяет игровую площадку по явным параметрам, глобальным SDK-объектам и домену.
 */
export function detectPlatformId(
  params: Record<string, string>,
  win: WindowLike | undefined = typeof window !== 'undefined'
    ? (window as unknown as WindowLike)
    : undefined,
  referrerHost: string = typeof document !== 'undefined' ? document.referrer || '' : '',
): PlatformId {
  const explicit = (params.platform ?? '').trim().toLowerCase();
  if (VALID_PLATFORMS.has(explicit)) {
    return explicit as PlatformId;
  }

  if (win?.YaGames) return 'yandex';
  if (win?.FAPI) return 'ok';
  if (win?.iframeApi) return 'vkplay';

  if (
    params.vk_app_id ||
    params.vk_user_id ||
    params.vk_platform ||
    params.vk_viewer_group_id ||
    (params.api_id && (params.viewer_id || params.auth_key))
  ) {
    return 'vk';
  }

  const okServerHost = params.api_server ? extractHost(params.api_server) : '';
  if (
    (okServerHost && /(?:^|\.)(?:ok\.ru|odnoklassniki\.ru)$/i.test(okServerHost)) ||
    (params.sig && params.session_key && params.logged_user_id)
  ) {
    return 'ok';
  }

  if (params.vkplay_appid) {
    return 'vkplay';
  }

  if (params.yandex !== undefined || win?.location?.hash === '#yandex') {
    return 'yandex';
  }

  if (win?.AndroidBridge || win?.webkit?.messageHandlers?.VKWebAppClose) {
    return 'vk';
  }

  const hosts = [extractHost(win?.location?.hostname ?? ''), extractHost(referrerHost)].filter(Boolean);

  if (hosts.some((h) => RE_YANDEX_HOST.test(h))) return 'yandex';
  if (hosts.some((h) => RE_VK_HOST.test(h))) return 'vk';
  if (hosts.some((h) => RE_OK_HOST.test(h))) return 'ok';
  if (hosts.some((h) => RE_VKPLAY_HOST.test(h))) return 'vkplay';

  // Общие параметры appid/app_id проверяются только если домен не определил площадку
  if ((params.appid || params.app_id) && !params.vk_app_id) {
    return 'vkplay';
  }

  return 'mock';
}
