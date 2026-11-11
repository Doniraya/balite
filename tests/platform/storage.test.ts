import { beforeEach, describe, expect, it } from 'vitest';
import {
  readLocalSave,
  serializeWithinLimit,
  trySerializeWithinLimit,
  utf8ByteLength,
  writeLocalSave,
} from '../../src/platform/storage';

describe('utf8ByteLength', () => {
  it('считает реальный размер строки в байтах UTF-8', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('Привет')).toBe(12);
    expect(utf8ByteLength('🃏')).toBe(4);
  });
});

describe('serializeWithinLimit', () => {
  it('возвращает полный JSON, если укладывается в лимит байтов', () => {
    const data = { ante: 1, chips: 300 };
    const result = serializeWithinLimit(data, 200);
    expect(JSON.parse(result)).toEqual(data);
    expect(utf8ByteLength(result)).toBeLessThanOrEqual(200);
  });

  it('применяет compactFallback при превышении лимита с учётом UTF-8', () => {
    const data = {
      title: 'Длинная строка на кириллице',
      history: ['много', 'лишних', 'данных'],
    };
    const result = serializeWithinLimit(data, 45, (d) => ({ t: d.title.slice(0, 3) }));
    expect(JSON.parse(result)).toEqual({ t: 'Дли' });
    expect(utf8ByteLength(result)).toBeLessThanOrEqual(45);
  });

  it('возвращает валидный компактный JSON "{}" если даже fallback превышает лимит', () => {
    const data = { payload: 'x'.repeat(500) };
    const result = serializeWithinLimit(data, 10, () => ({ stillTooLarge: 'y'.repeat(100) }));
    expect(result).toBe('{}');
    expect(utf8ByteLength(result)).toBeLessThanOrEqual(10);
  });

  it('не падает на циклических объектах или ошибке внутри compactFallback', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;

    expect(serializeWithinLimit(cyclic, 100)).toBe('{}');
    expect(
      serializeWithinLimit({ ok: true, pad: 'x'.repeat(20) }, 10, () => {
        throw new Error('fallback crash');
      }),
    ).toBe('{}');
  });
});

describe('trySerializeWithinLimit', () => {
  it('возвращает JSON если укладывается напрямую или через compactFallback', () => {
    expect(trySerializeWithinLimit({ ante: 2 }, 100)).toBe('{"ante":2}');
    expect(
      trySerializeWithinLimit(
        { ante: 2, log: 'x'.repeat(80) },
        25,
        (d) => ({ ante: d.ante }),
      ),
    ).toBe('{"ante":2}');
  });

  it('возвращает null вместо "{}" если лимит превышен, maxBytes <= 0 или объект не сериализуется', () => {
    expect(trySerializeWithinLimit({ payload: 'x'.repeat(100) }, 20)).toBeNull();
    expect(
      trySerializeWithinLimit({ payload: 'x'.repeat(100) }, 10, () => ({
        stillTooBig: 'y'.repeat(50),
      })),
    ).toBeNull();
    expect(trySerializeWithinLimit({ a: 1 }, 0)).toBeNull();

    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(trySerializeWithinLimit(cyclic, 200)).toBeNull();
  });
});

describe('readLocalSave / writeLocalSave', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('сохраняет и читает данные по переданному ключу без legacy slime-ключей', () => {
    localStorage.setItem('slime_save', JSON.stringify({ legacy: true }));
    expect(readLocalSave('balite_platform_save_v1')).toEqual({});

    writeLocalSave('balite_platform_save_v1', { ante: 3, lang: 'ru' });
    expect(readLocalSave('balite_platform_save_v1')).toEqual({ ante: 3, lang: 'ru' });
  });

  it('безопасно обрабатывает повреждённый JSON и массивы', () => {
    localStorage.setItem('broken_key', '{not-valid-json');
    expect(readLocalSave('broken_key')).toEqual({});

    localStorage.setItem('array_key', '[1, 2, 3]');
    expect(readLocalSave('array_key')).toEqual({});
  });

  it('передаёт распарсенное значение в sanitize', () => {
    localStorage.setItem('custom_key', JSON.stringify({ ante: 'bad', score: 150 }));
    const parsed = readLocalSave<{ score: number }>('custom_key', (raw) => {
      const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      return typeof obj.score === 'number' ? { score: obj.score } : {};
    });
    expect(parsed).toEqual({ score: 150 });
  });
});
