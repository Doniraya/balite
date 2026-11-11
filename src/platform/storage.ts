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
