/**
 * Имена изолированных потоков генератора случайных чисел для различных подсистем забега.
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
 * Идентификатор изолированного PRNG-потока.
 */
export type RngStreamName = (typeof RNG_STREAM_NAMES)[number];

/**
 * Карта текущих 32-битных состояний всех потоков PRNG.
 */
export type RngStreams = Readonly<Record<RngStreamName, number>>;

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
 * Инициализирует сериализуемое состояние всех 7 независимых PRNG-потоков из строкового сида забега.
 */
export function createRngState(seed: string): RngState {
  const streams = {} as Record<RngStreamName, number>;
  for (const streamName of RNG_STREAM_NAMES) {
    streams[streamName] = hashSeed(`${seed}::${streamName}`);
  }
  return {
    seed,
    streams,
  };
}

/**
 * Генерирует следующее число с плавающей точкой в [0, 1) из указанного потока, не затрагивая другие потоки.
 */
export function nextFloat(state: RngState, stream: RngStreamName): RngResult<number> {
  const step = mulberry32Step(state.streams[stream]);
  return {
    value: step.value,
    nextState: {
      seed: state.seed,
      streams: {
        ...state.streams,
        [stream]: step.nextState,
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
