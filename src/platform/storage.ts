/**
 * Вычисляет реальный размер строки в байтах в кодировке UTF-8.
 */
export function utf8ByteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  return unescape(encodeURIComponent(str)).length;
}

/**
 * Сериализует объект сохранения с учётом лимита облачного хранилища площадки.
 */
export function serializeWithinLimit<TSave>(
  data: TSave,
  maxBytes: number,
  compactFallback?: (data: TSave) => unknown,
): string {
  if (maxBytes <= 0) return '';

  const fullJson = JSON.stringify(data) ?? '{}';
  if (utf8ByteLength(fullJson) <= maxBytes) {
    return fullJson;
  }

  if (compactFallback) {
    const compactJson = JSON.stringify(compactFallback(data)) ?? '{}';
    if (utf8ByteLength(compactJson) <= maxBytes) {
      return compactJson;
    }
  }

  if (maxBytes >= 2) return '{}';
  if (maxBytes === 1) return '0';
  return '';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
