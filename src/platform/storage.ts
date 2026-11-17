/**
 * Вычисляет реальный размер строки в байтах в кодировке UTF-8.
 */
export function utf8ByteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  return unescape(encodeURIComponent(str)).length;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeJsonStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value) ?? '{}';
  } catch {
    return null;
  }
}

/**
 * Пытается сериализовать объект сохранения в JSON, не превышая maxBytes (UTF-8).
 * Возвращает null, если ни полный объект, ни compactFallback не укладываются в лимит или сериализация упала.
 */
export function trySerializeWithinLimit<TSave>(
  data: TSave,
  maxBytes: number,
  compactFallback?: (data: TSave) => unknown,
): string | null {
  if (maxBytes <= 0) return null;

  const fullJson = safeJsonStringify(data);
  if (fullJson !== null && utf8ByteLength(fullJson) <= maxBytes) {
    return fullJson;
  }

  if (compactFallback) {
    try {
      const compactJson = safeJsonStringify(compactFallback(data));
      if (compactJson !== null && utf8ByteLength(compactJson) <= maxBytes) {
        return compactJson;
      }
    } catch {
      // При сбое compactFallback безопасно возвращаем null, чтобы не затирать облачный сейв
    }
  }

  return null;
}

/**
 * Сериализует объект сохранения с учётом лимита облачного хранилища площадки.
 * При переполнении откатывается к минимальному валидному JSON ('{}').
 */
export function serializeWithinLimit<TSave>(
  data: TSave,
  maxBytes: number,
  compactFallback?: (data: TSave) => unknown,
): string {
  if (maxBytes <= 0) return '';

  const serialized = trySerializeWithinLimit(data, maxBytes, compactFallback);
  if (serialized !== null) {
    return serialized;
  }

  if (maxBytes >= 2) return '{}';
  return '0';
}

const DEFAULT_CLOUD_RUN_CHUNK_LIMIT = 2000;
const INITIAL_CLOUD_RUN_CHUNK_PREFETCH = 8;
const MAX_CLOUD_RUN_CHUNKS = 16;

interface CloudRunChunkManifest {
  readonly n: number;
  readonly len: number;
  readonly h: string;
}

/**
 * Вычисляет компактную контрольную сумму FNV-1a для проверки целостности собранного JSON.
 */
function computeFnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Нарезает строку на фрагменты, каждый из которых строго укладывается в maxBytes (UTF-8) и maxBytes символов.
 */
function splitStringWithinUtf8Limit(str: string, maxBytes: number): string[] {
  if (maxBytes <= 0) return [];
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < str.length) {
    let end = Math.min(str.length, cursor + maxBytes);
    // Не разрываем суррогатную пару UTF-16 на границе фрагмента
    if (end < str.length) {
      const prevCode = str.charCodeAt(end - 1);
      if (prevCode >= 0xd800 && prevCode <= 0xdbff) {
        end = Math.max(cursor + 1, end - 1);
      }
    }

    let piece = str.slice(cursor, end);
    while (piece.length > 1 && utf8ByteLength(piece) > maxBytes) {
      end -= Math.max(1, Math.ceil((utf8ByteLength(piece) - maxBytes) / 2));
      if (end > cursor && end < str.length) {
        const prevCode = str.charCodeAt(end - 1);
        if (prevCode >= 0xd800 && prevCode <= 0xdbff) {
          end -= 1;
        }
      }
      end = Math.max(cursor + 1, end);
      piece = str.slice(cursor, end);
    }

    if (utf8ByteLength(piece) > maxBytes) {
      return [];
    }

    chunks.push(piece);
    cursor = end;
  }

  return chunks;
}

export interface KeyValueCloudEntry {
  readonly key: string;
  readonly value: string;
}

/**
 * Подготавливает набор пар key/value для key-value облачного хранилища (VK/OK) со строгим лимитом на каждый ключ.
 * При переполнении основного ключа выносит activeRun в чанки `${storageKey}_r0..` с сохранением целого MetaSave в `${storageKey}`.
 * Возвращает null, если даже compactFallback не укладывается в maxBytes.
 */
export function splitPayloadForKeyValueCloud<TSave>(
  data: TSave,
  storageKey: string,
  maxBytes: number,
  compactFallback?: (data: TSave) => unknown,
): KeyValueCloudEntry[] | null {
  if (maxBytes <= 0) return null;

  const fullJson = safeJsonStringify(data);
  if (fullJson !== null && fullJson.length <= maxBytes && utf8ByteLength(fullJson) <= maxBytes) {
    return [{ key: storageKey, value: fullJson }];
  }

  if (!compactFallback) {
    return null;
  }

  let fallbackData: unknown;
  try {
    fallbackData = compactFallback(data);
  } catch {
    return null;
  }

  const fallbackJson = safeJsonStringify(fallbackData);
  if (
    fallbackJson === null ||
    fallbackJson.length > maxBytes ||
    utf8ByteLength(fallbackJson) > maxBytes
  ) {
    return null;
  }

  if (
    !isPlainRecord(data) ||
    !isPlainRecord(data.activeRun) ||
    !isPlainRecord(fallbackData)
  ) {
    return [{ key: storageKey, value: fallbackJson }];
  }

  const activeRunJson = safeJsonStringify(data.activeRun);
  if (!activeRunJson) {
    return [{ key: storageKey, value: fallbackJson }];
  }

  const chunkLimit = Math.min(DEFAULT_CLOUD_RUN_CHUNK_LIMIT, maxBytes);
  const chunks = splitStringWithinUtf8Limit(activeRunJson, chunkLimit);
  if (chunks.length === 0 || chunks.length > MAX_CLOUD_RUN_CHUNKS) {
    return [{ key: storageKey, value: fallbackJson }];
  }

  const manifest: CloudRunChunkManifest = {
    n: chunks.length,
    len: activeRunJson.length,
    h: computeFnv1aHex(activeRunJson),
  };
  const manifestPayload = { ...fallbackData, _r: manifest };
  const manifestJson = safeJsonStringify(manifestPayload);
  if (
    manifestJson === null ||
    manifestJson.length > maxBytes ||
    utf8ByteLength(manifestJson) > maxBytes
  ) {
    return [{ key: storageKey, value: fallbackJson }];
  }

  // Чанки пишем до основного ключа, чтобы указатель _r никогда не ссылался на незаписанные фрагменты
  const entries: KeyValueCloudEntry[] = chunks.map((value, index) => ({
    key: `${storageKey}_r${index}`,
    value,
  }));
  entries.push({ key: storageKey, value: manifestJson });
  return entries;
}

/**
 * Читает основное сохранение и при наличии манифеста _r безопасно дособирает activeRun из облачных чанков.
 */
export async function assembleFromKeyValueCloud<
  TSave extends Record<string, unknown> = Record<string, unknown>,
>(
  storageKey: string,
  readKeys: (keys: string[]) => Promise<Record<string, string | undefined>>,
): Promise<Partial<TSave>> {
  const initialKeys = [storageKey];
  for (let i = 0; i < INITIAL_CLOUD_RUN_CHUNK_PREFETCH; i += 1) {
    initialKeys.push(`${storageKey}_r${i}`);
  }

  const values = await readKeys(initialKeys);
  const rawPrimary = values[storageKey];
  if (typeof rawPrimary !== 'string' || !rawPrimary) {
    return {};
  }

  const parsed: unknown = JSON.parse(rawPrimary);
  if (!isPlainRecord(parsed)) {
    return {};
  }

  const manifestRaw = parsed._r;
  const output: Record<string, unknown> = { ...parsed };
  delete output._r;

  if (
    !output.activeRun &&
    isPlainRecord(manifestRaw) &&
    typeof manifestRaw.n === 'number' &&
    Number.isInteger(manifestRaw.n) &&
    manifestRaw.n >= 1 &&
    manifestRaw.n <= MAX_CLOUD_RUN_CHUNKS &&
    typeof manifestRaw.len === 'number' &&
    Number.isInteger(manifestRaw.len) &&
    manifestRaw.len > 0 &&
    typeof manifestRaw.h === 'string'
  ) {
    const chunkCount = manifestRaw.n;
    let allValues = values;
    if (chunkCount > INITIAL_CLOUD_RUN_CHUNK_PREFETCH) {
      const missingKeys: string[] = [];
      for (let i = INITIAL_CLOUD_RUN_CHUNK_PREFETCH; i < chunkCount; i += 1) {
        missingKeys.push(`${storageKey}_r${i}`);
      }
      if (missingKeys.length > 0) {
        try {
          const extraValues = await readKeys(missingKeys);
          allValues = { ...values, ...extraValues };
        } catch {
          return output as Partial<TSave>;
        }
      }
    }

    const parts: string[] = [];
    let complete = true;
    for (let i = 0; i < chunkCount; i += 1) {
      const part = allValues[`${storageKey}_r${i}`];
      if (typeof part !== 'string' || part.length === 0) {
        complete = false;
        break;
      }
      parts.push(part);
    }

    if (complete) {
      const joined = parts.join('');
      if (joined.length === manifestRaw.len && computeFnv1aHex(joined) === manifestRaw.h) {
        try {
          const parsedRun: unknown = JSON.parse(joined);
          if (isPlainRecord(parsedRun)) {
            output.activeRun = parsedRun;
          }
        } catch {
          // Битый чанк не мешает восстановить MetaSave из основного ключа
        }
      }
    }
  }

  return output as Partial<TSave>;
}

/**
 * Безопасно читает локальное сохранение из localStorage без legacy-фолбэков.
 */
export function readLocalSave<TSave extends Record<string, unknown> = Record<string, unknown>>(
  key: string,
  sanitize?: (raw: unknown) => Partial<TSave>,
): Partial<TSave> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(key);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (sanitize) {
      return sanitize(parsed);
    }
    return isPlainRecord(parsed) ? (parsed as Partial<TSave>) : {};
  } catch {
    return {};
  }
}

/**
 * Безопасно записывает объект сохранения в localStorage.
 */
export function writeLocalSave<TSave>(key: string, data: TSave): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Игнорируем переполнение квоты или запрет доступа к хранилищу в приватном режиме
  }
}
