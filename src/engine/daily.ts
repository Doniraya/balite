import { hashSeed } from './prng';
import { DECK_IDS, type DeckId } from './types';

/**
 * Префикс сида «Ежедневного заказа гильдии».
 */
export const DAILY_SEED_PREFIX = 'DAILY-';

/**
 * Детерминированная спецификация «Ежедневного заказа гильдии» на конкретные сутки UTC.
 */
export interface DailyRunSpec {
  /** Календарная дата по UTC в формате YYYY-MM-DD */
  readonly dateKey: string;
  /** Детерминированный сид дня в формате DAILY-YYYYMMDD */
  readonly seed: string;
  /** Фиксированная колода дня для всех игроков */
  readonly deckId: DeckId;
}

/**
 * Форматирует временную метку (в мс) в строку даты UTC формата `YYYY-MM-DD`.
 */
export function formatUtcDateKey(timestampMs: number): string {
  const safeMs =
    typeof timestampMs === 'number' && Number.isFinite(timestampMs) && timestampMs > 0
      ? Math.floor(timestampMs)
      : 0;
  const date = new Date(safeMs);
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Формирует детерминированную спецификацию «Ежедневного заказа гильдии» по UTC-дате или timestamp.
 */
export function buildDailyRunSpec(timestampOrDateKey: number | string): DailyRunSpec {
  const dateKey =
    typeof timestampOrDateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(timestampOrDateKey.trim())
      ? timestampOrDateKey.trim()
      : formatUtcDateKey(typeof timestampOrDateKey === 'number' ? timestampOrDateKey : 0);

  const compactDate = dateKey.replace(/-/g, '');
  const seed = `${DAILY_SEED_PREFIX}${compactDate}`;
  const hash = hashSeed(`balite_daily_deck::${dateKey}`);
  const deckId: DeckId = DECK_IDS[hash % DECK_IDS.length] ?? 'b_red';

  return {
    dateKey,
    seed,
    deckId,
  };
}

/**
 * Проверяет, принадлежит ли сид режиму «Ежедневный заказ гильдии» (`DAILY-YYYYMMDD`).
 */
export function isDailyRunSeed(seed: string): boolean {
  return /^DAILY-\d{8}$/.test(seed.trim());
}

/**
 * Извлекает календарную дату UTC (`YYYY-MM-DD`) из сида вида `DAILY-YYYYMMDD`, либо null.
 */
export function extractDailyDateKeyFromSeed(seed: string): string | null {
  const match = /^DAILY-(\d{4})(\d{2})(\d{2})$/.exec(seed.trim());
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}
