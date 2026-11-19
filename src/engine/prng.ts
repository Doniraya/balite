/**
 * Базовые имена потоков PRNG для совместимости инициализации и санитизации сохранений.
 */
export const RNG_STREAM_NAMES = [
  'shop',
  'boss',
  'shuffle',
  'pack',
  'lucky',
  'glass',
  'tag',
] as const;

/**
 * Алфавит случайных кодов забега из оригинала Balatro ('1'..'9', 'A'..'N', 'P'..'Z'; исключены '0' и 'O').
 */
export const SEED_ALPHABET = '123456789ABCDEFGHIJKLMNPQRSTUVWXYZ';

/**
 * Идентификатор потока/ключа PRNG (базовый поток или динамический строковый ключ Balatro вроде 'lucky_mult', 'cdt1').
 */
export type RngStreamName = (typeof RNG_STREAM_NAMES)[number] | (string & {});

/**
 * Динамический словарь состояний ключей PRNG (`G.GAME.pseudorandom`).
 */
export type RngStreams = Readonly<Record<string, number>>;

/**
 * Сериализуемое иммутабельное состояние многопоточного PRNG забега.
 */
export interface RngState {
  readonly seed: string;
  readonly streams: RngStreams;
}

/**
 * Чистый результат обращения к PRNG: сгенерированное значение и новое состояние потоков.
 */
export interface RngResult<T> {
  readonly value: T;
  readonly nextState: RngState;
}

/**
 * Результат одного шага чистого алгоритма Mulberry32.
 */
export interface Mulberry32Step {
  readonly value: number;
  readonly nextState: number;
}

const UINT32_MODULO = 4294967296;

/**
 * Проверяет корректность целочисленного диапазона [min, max].
 */
function assertValidIntRange(min: number, max: number): void {
  if (
    !Number.isSafeInteger(min) ||
    !Number.isSafeInteger(max) ||
    min > max ||
    !Number.isSafeInteger(max - min + 1)
  ) {
    throw new RangeError('INVALID_INT_RANGE');
  }
}

/**
 * Преобразует число с плавающей точкой из [0, 1) в целое число из [min, max] включительно.
 */
function floatToIntInRange(floatValue: number, min: number, max: number): number {
  const span = max - min + 1;
  return min + Math.floor(floatValue * span);
}

/**
 * Детерминированно хеширует строковый сид в беззнаковое 32-битное целое число (FNV-1a + лавинное перемешивание).
 */
export function hashSeed(seed: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Лавинное перемешивание (fmix32) гарантирует отсутствие корреляции даже для близких строк сидов
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * Выполняет один чистый шаг генератора Mulberry32, возвращая число в [0, 1) и следующее 32-битное состояние.
 */
export function mulberry32Step(state: number): Mulberry32Step {
  const nextState = (state + 0x6d2b79f5) | 0;
  let mixed = nextState;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  const uint32 = (mixed ^ (mixed >>> 14)) >>> 0;

  return {
    value: uint32 / UINT32_MODULO,
    nextState: nextState >>> 0,
  };
}

/**
 * Императивная обёртка над алгоритмом Mulberry32 с поддержкой сохранения и восстановления внутреннего состояния.
 */
export class Mulberry32 {
  private state: number;

  /**
   * Создаёт экземпляр генератора из строкового или 32-битного числового сида.
   */
  public constructor(seed: number | string) {
    this.state = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  }

  /**
   * Восстанавливает генератор из сохранённого 32-битного внутреннего состояния.
   */
  public static fromState(state: number): Mulberry32 {
    return new Mulberry32(state >>> 0);
  }

  /**
   * Возвращает текущее беззнаковое 32-битное внутреннее состояние для сериализации.
   */
  public getState(): number {
    return this.state >>> 0;
  }

  /**
   * Возвращает следующее псевдослучайное число в полуинтервале [0, 1).
   */
  public next(): number {
    const step = mulberry32Step(this.state);
    this.state = step.nextState;
    return step.value;
  }

  /**
   * Возвращает следующее псевдослучайное целое число в диапазоне [min, max] включительно.
   */
  public nextInt(min: number, max: number): number {
    assertValidIntRange(min, max);
    return floatToIntInRange(this.next(), min, max);
  }
}

/**
 * Вычисляет некриптографический float-хеш строки `pseudohash` по точной формуле Balatro (misc_functions.lua:279).
 */
export function pseudohash(str: string): number {
  let num = 1;
  for (let i = str.length; i >= 1; i -= 1) {
    num = ((1.1239285023 / num) * str.charCodeAt(i - 1) * Math.PI + Math.PI * i) % 1;
    if (!Number.isFinite(num) || num === 0) {
      num = 1e-13;
    }
  }
  return num;
}

/**
 * Генерирует случайный код забега по алгоритму и алфавиту оригинала (`random_string`: 1..9, A..N, P..Z).
 */
export function generateRandomSeed(length = 8): string {
  const digits = '123456789';
  const lettersAN = 'ABCDEFGHIJKLMN';
  const lettersPZ = 'PQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    const branch = Math.random();
    if (branch > 0.7) {
      result += digits[Math.floor(Math.random() * digits.length)] ?? '1';
    } else if (Math.random() > 0.45) {
      result += lettersAN[Math.floor(Math.random() * lettersAN.length)] ?? 'A';
    } else {
      result += lettersPZ[Math.floor(Math.random() * lettersPZ.length)] ?? 'P';
    }
  }
  return result;
}

/**
 * Сворачивает [0, 1) double из `pseudoseed` в 32-битное зерно с сохранением старших и младших бит мантиссы.
 */
function doubleToUint32Seed(value: number): number {
  const scaled = value * UINT32_MODULO;
  const hi = Math.floor(scaled) >>> 0;
  const lo = Math.floor((scaled - hi) * UINT32_MODULO) >>> 0;
  let h = (hi ^ Math.imul(lo, 0x9e3779b1)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/**
 * Инициализирует сериализуемое состояние PRNG с базовыми потоками через `pseudohash`.
 */
export function createRngState(seed: string): RngState {
  const streams: Record<string, number> = {};
  for (const streamName of RNG_STREAM_NAMES) {
    streams[streamName] = pseudohash(`${streamName}${seed}`);
  }
  return {
    seed,
    streams,
  };
}

/**
 * Генерирует следующее число с плавающей точкой в [0, 1) из указанного ключа PRNG (`pseudoseed`),
 * не затрагивая остальные ключи словаря.
 */
export function nextFloat(state: RngState, stream: RngStreamName): RngResult<number> {
  const prevRaw = state.streams[stream];
  const prev =
    prevRaw === undefined
      ? pseudohash(`${stream}${state.seed}`)
      : prevRaw > 1
        ? ((prevRaw >>> 0) % 1_000_000_000) / 1_000_000_000 || 0.5
        : prevRaw;

  const nextStreamVal = Math.abs(
    Number(((2.134453429141 + prev * 1.72431234) % 1).toFixed(13)),
  );
  const hashedSeed = pseudohash(state.seed);
  const seedFloat = (nextStreamVal + hashedSeed) / 2;
  const step = mulberry32Step(doubleToUint32Seed(seedFloat));

  return {
    value: step.value,
    nextState: {
      seed: state.seed,
      streams: {
        ...state.streams,
        [stream]: nextStreamVal,
      },
    },
  };
}

/**
 * Генерирует целое число в диапазоне [min, max] включительно из указанного потока PRNG.
 */
export function nextInt(
  state: RngState,
  stream: RngStreamName,
  min: number,
  max: number,
): RngResult<number> {
  assertValidIntRange(min, max);
  const floatResult = nextFloat(state, stream);
  return {
    value: floatToIntInRange(floatResult.value, min, max),
    nextState: floatResult.nextState,
  };
}

/**
 * Детерминированно выбирает один элемент из непустого массива без мутации входных данных.
 */
export function pickElement<T>(
  state: RngState,
  stream: RngStreamName,
  items: readonly T[],
): RngResult<T> {
  if (items.length === 0) {
    throw new RangeError('EMPTY_ARRAY');
  }
  const indexResult = nextInt(state, stream, 0, items.length - 1);
  return {
    value: items[indexResult.value]!,
    nextState: indexResult.nextState,
  };
}

/**
 * Возвращает перетасованную копию массива (алгоритм Фишера — Йетса) без мутации исходного массива.
 */
export function shuffleArray<T>(
  state: RngState,
  stream: RngStreamName,
  items: readonly T[],
): RngResult<T[]> {
  const copy = [...items];
  let currentState = state;

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const roll = nextInt(currentState, stream, 0, i);
    currentState = roll.nextState;
    const swapIdx = roll.value;
    if (swapIdx !== i) {
      const temp = copy[i]!;
      copy[i] = copy[swapIdx]!;
      copy[swapIdx] = temp;
    }
  }

  return {
    value: copy,
    nextState: currentState,
  };
}

/**
 * Извлекает стабильный числовой индекс создания карты (`sort_id`) из идентификатора `card_<N>`.
 */
export function getCardSortId(cardId: string): number {
  const match = /^card_(\d+)$/.exec(cardId);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

/**
 * Компаратор для предварительной сортировки карт перед перетасовкой `pseudoshuffle`.
 */
export function compareCardIdsForShuffle(a: string, b: string): number {
  const sortA = getCardSortId(a);
  const sortB = getCardSortId(b);
  if (sortA !== sortB) return sortA - sortB;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Детерминированная перетасовка колоды по алгоритму Balatro (`pseudoshuffle`):
 * сначала сортирует карты по `sort_id`, затем выполняет тасование Фишера — Йетса.
 */
export function shuffleDeckIds(
  state: RngState,
  stream: RngStreamName,
  cardIds: readonly string[],
): RngResult<string[]> {
  if (cardIds.length <= 1) {
    return { value: [...cardIds], nextState: state };
  }
  const sorted = [...cardIds].sort(compareCardIdsForShuffle);
  return shuffleArray(state, stream, sorted);
}
