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
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.includes('://')) {
    try {
      return new URL(trimmed).hostname;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

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

  if (
    (params.api_server && /ok\.ru|odnoklassniki/i.test(params.api_server)) ||
    (params.sig && params.session_key && params.logged_user_id)
  ) {
    return 'ok';
  }

  if (params.vkplay_appid || ((params.appid || params.app_id) && !params.vk_app_id)) {
    return 'vkplay';
  }

  if (params.yandex !== undefined || win?.location?.hash === '#yandex') {
    return 'yandex';
  }

  if (win?.AndroidBridge || win?.webkit?.messageHandlers?.VKWebAppClose) {
    return 'vk';
  }

  const host = extractHost(win?.location?.hostname ?? '');
  const refHost = extractHost(referrerHost);
  const combinedHost = `${host} ${refHost}`.trim();

  if (!combinedHost) return 'mock';

  if (/(?:^|\s|\.)(?:yandex\.[a-z.]+|playhop\.com|yastatic\.net)(?:$|\/|:|\s)/i.test(combinedHost)) {
    return 'yandex';
  }

  if (/(?:^|\s|\.)(?:vk\.com|vk\.ru|vk-apps\.com|mvk\.com)(?:$|\/|:|\s)/i.test(combinedHost)) {
    return 'vk';
  }

  if (/(?:^|\s|\.)(?:ok\.ru|odnoklassniki\.ru|mycdn\.me|apiok\.ru)(?:$|\/|:|\s)/i.test(combinedHost)) {
    return 'ok';
  }

  if (/(?:^|\s|\.)vkplay\.ru(?:$|\/|:|\s)|\.vkplay\./i.test(combinedHost)) {
    return 'vkplay';
  }

  return 'mock';
}
