import { describe, expect, it } from 'vitest';
import {
  Mulberry32,
  RNG_STREAM_NAMES,
  createRngState,
  hashSeed,
  nextFloat,
  nextInt,
  pickElement,
  shuffleArray,
  type RngState,
} from '../../src/engine/prng';

describe('hashSeed', () => {
  it('возвращает детерминированное беззнаковое 32-битное целое число', () => {
    const first = hashSeed('BALITE-SEED-42');
    const second = hashSeed('BALITE-SEED-42');

    expect(first).toBe(second);
    expect(Number.isInteger(first)).toBe(true);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(0xffffffff);
  });

  it('различает похожие строки сидов и корректно обрабатывает пустую строку', () => {
    const a = hashSeed('SEED1');
    const b = hashSeed('SEED2');
    const empty = hashSeed('');
    const unicode = hashSeed('руна-α-777');

    expect(a).not.toBe(b);
    expect(Number.isInteger(empty)).toBe(true);
    expect(empty).toBeGreaterThanOrEqual(0);
    expect(unicode).toBe(hashSeed('руна-α-777'));
  });
});

describe('Mulberry32', () => {
  it('генерирует детерминированную последовательность чисел в полуинтервале [0, 1)', () => {
    const rngA = new Mulberry32('RUN-101');
    const rngB = new Mulberry32('RUN-101');

    const seqA = Array.from({ length: 20 }, () => rngA.next());
    const seqB = Array.from({ length: 20 }, () => rngB.next());

    expect(seqA).toEqual(seqB);
    for (const val of seqA) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('не застревает в нуле при передаче числового сида 0', () => {
    const rng = new Mulberry32(0);
    const values = [rng.next(), rng.next(), rng.next()];

    expect(new Set(values).size).toBe(3);
  });

  it('восстанавливает точное продолжение последовательности через getState и fromState', () => {
    const rng = new Mulberry32(123456);
    rng.next();
    rng.next();
    const savedState = rng.getState();

    const restored = Mulberry32.fromState(savedState);
    const expectedTail = [rng.next(), rng.next(), rng.next(), rng.next()];
    const actualTail = [restored.next(), restored.next(), restored.next(), restored.next()];

    expect(actualTail).toEqual(expectedTail);
  });
});

describe('Многопоточный иммутабельный PRNG (RngState)', () => {
  it('создаёт все 7 независимых потоков генерации с различными стартовыми состояниями', () => {
    const state = createRngState('ALPHA-777');

    expect(Object.keys(state.streams).sort()).toEqual([...RNG_STREAM_NAMES].sort());
    const uniqueStreamStates = new Set(Object.values(state.streams));
    expect(uniqueStreamStates.size).toBe(RNG_STREAM_NAMES.length);
  });

  it('продвижение одного потока не искажает остальные потоки и не мутирует исходный state', () => {
    const initial = createRngState('ISOLATION-TEST');
    const snapshotBefore = structuredClone(initial);

    // Продвигаем только поток shop 10 раз
    let afterShop: RngState = initial;
    for (let i = 0; i < 10; i += 1) {
      afterShop = nextFloat(afterShop, 'shop').nextState;
    }

    // Исходное состояние не должно измениться
    expect(initial).toEqual(snapshotBefore);

    // Поток boss и остальные потоки должны выдать ровно те же значения, что и из initial
    for (const stream of RNG_STREAM_NAMES) {
      if (stream === 'shop') continue;
      expect(afterShop.streams[stream]).toBe(initial.streams[stream]);
      expect(nextFloat(afterShop, stream).value).toBe(nextFloat(initial, stream).value);
    }
  });

  it('сохранение и восстановление RngState через JSON воспроизводит идентичную последовательность', () => {
    let state = createRngState('SAVE-LOAD-SEED');
    state = nextFloat(state, 'shop').nextState;
    state = nextInt(state, 'lucky', 1, 15).nextState;
    state = shuffleArray(state, 'shuffle', [1, 2, 3, 4, 5]).nextState;

    const restored: RngState = JSON.parse(JSON.stringify(state)) as RngState;

    const seqOriginal: number[] = [];
    const seqRestored: number[] = [];
    let s1 = state;
    let s2 = restored;

    for (const stream of RNG_STREAM_NAMES) {
      const r1 = nextFloat(s1, stream);
      const r2 = nextFloat(s2, stream);
      seqOriginal.push(r1.value);
      seqRestored.push(r2.value);
      s1 = r1.nextState;
      s2 = r2.nextState;
    }

    expect(seqRestored).toEqual(seqOriginal);
  });

  it('nextInt возвращает целые числа строго в диапазоне [min, max] включительно', () => {
    let state = createRngState('INT-RANGE');
    const hits = new Set<number>();

    for (let i = 0; i < 200; i += 1) {
      const res = nextInt(state, 'glass', 0, 3);
      expect(Number.isInteger(res.value)).toBe(true);
      expect(res.value).toBeGreaterThanOrEqual(0);
      expect(res.value).toBeLessThanOrEqual(3);
      hits.add(res.value);
      state = res.nextState;
    }

    expect(hits).toEqual(new Set([0, 1, 2, 3]));
    expect(nextInt(state, 'boss', 5, 5).value).toBe(5);
    expect(nextInt(state, 'boss', -3, -1).value).toBeGreaterThanOrEqual(-3);
    expect(nextInt(state, 'boss', -3, -1).value).toBeLessThanOrEqual(-1);
  });

  it('nextInt выбрасывает RangeError при некорректных границах', () => {
    const state = createRngState('BAD-INT');

    expect(() => nextInt(state, 'shop', 5, 4)).toThrow(RangeError);
    expect(() => nextInt(state, 'shop', 1.5, 4)).toThrow(RangeError);
  });

  it('pickElement детерминированно выбирает элемент и падает на пустом массиве', () => {
    const state = createRngState('PICK-SEED');
    const items = ['a', 'b', 'c', 'd'] as const;

    const first = pickElement(state, 'pack', items);
    const second = pickElement(state, 'pack', items);

    expect(first.value).toBe(second.value);
    expect(items).toContain(first.value);
    expect(pickElement(state, 'tag', ['only']).value).toBe('only');
    expect(() => pickElement(state, 'tag', [])).toThrow(RangeError);
  });

  it('shuffleArray не мутирует исходный массив, сохраняет мультимножество и детерминирован', () => {
    const state = createRngState('DECK-SHUFFLE');
    const ordered = Array.from({ length: 52 }, (_, i) => i + 1);
    const orderedCopy = [...ordered];

    const resA = shuffleArray(state, 'shuffle', ordered);
    const resB = shuffleArray(state, 'shuffle', ordered);

    expect(ordered).toEqual(orderedCopy);
    expect(resA.value).toEqual(resB.value);
    expect(resA.value).not.toEqual(ordered);
    expect([...resA.value].sort((a, b) => a - b)).toEqual(ordered);
    expect(shuffleArray(state, 'shuffle', []).value).toEqual([]);
    expect(shuffleArray(state, 'shuffle', [42]).value).toEqual([42]);
  });
});
