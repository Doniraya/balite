import { describe, expect, it } from 'vitest';
import {
  buildDailyRunSpec,
  DAILY_SEED_PREFIX,
  extractDailyDateKeyFromSeed,
  formatUtcDateKey,
  isDailyRunSeed,
} from '../../src/engine/daily';
import { DECK_IDS } from '../../src/engine/types';

describe('daily run engine helpers', () => {
  it('форматирует временную метку строго по UTC-дате YYYY-MM-DD', () => {
    // 2026-11-17T23:59:59Z
    const lateUtc = Date.UTC(2026, 10, 17, 23, 59, 59);
    // 2026-11-18T00:00:00Z
    const nextUtc = Date.UTC(2026, 10, 18, 0, 0, 0);

    expect(formatUtcDateKey(lateUtc)).toBe('2026-11-17');
    expect(formatUtcDateKey(nextUtc)).toBe('2026-11-18');
    expect(formatUtcDateKey(Number.NaN)).toBe('1970-01-01');
  });

  it('строит детерминированную спецификацию дня с единым сидом и колодой из DECK_IDS', () => {
    const morning = Date.UTC(2026, 10, 17, 6, 15, 0);
    const evening = Date.UTC(2026, 10, 17, 22, 45, 0);

    const specA = buildDailyRunSpec(morning);
    const specB = buildDailyRunSpec(evening);
    const specC = buildDailyRunSpec('2026-11-17');

    expect(specA).toEqual(specB);
    expect(specA).toEqual(specC);
    expect(specA.dateKey).toBe('2026-11-17');
    expect(specA.seed).toBe(`${DAILY_SEED_PREFIX}20261117`);
    expect(DECK_IDS).toContain(specA.deckId);

    const nextDay = buildDailyRunSpec('2026-11-18');
    expect(nextDay.dateKey).toBe('2026-11-18');
    expect(nextDay.seed).toBe('DAILY-20261118');
    expect(DECK_IDS).toContain(nextDay.deckId);
  });

  it('распознаёт ежедневный сид и извлекает UTC-дату', () => {
    expect(isDailyRunSeed('DAILY-20261117')).toBe(true);
    expect(isDailyRunSeed(' DAILY-20261117 ')).toBe(true);
    expect(isDailyRunSeed('DAILY-12345')).toBe(false);
    expect(isDailyRunSeed('BALITE-SEED')).toBe(false);

    expect(extractDailyDateKeyFromSeed('DAILY-20261117')).toBe('2026-11-17');
    expect(extractDailyDateKeyFromSeed('DAILY-20261117-X')).toBeNull();
    expect(extractDailyDateKeyFromSeed('RANDOM')).toBeNull();
  });
});
