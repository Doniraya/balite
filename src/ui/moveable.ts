/**
 * Чистое математическое ядро пружинного движка Moveable (T -> VT),
 * перенесённое из reference/balatro_lua/engine/moveable.lua и game.lua.
 *
 * Не зависит от DOM и таймеров, работает детерминированно в Node/jsdom и браузере.
 */

/**
 * Трансформ объекта в пространстве сцены.
 * - `x`, `y` — смещение / координаты в пикселях;
 * - `scale` — безразмерный множитель масштаба (1 = 100%);
 * - `r` — угол поворота в радианах.
 */
export interface MoveableTransform {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly r: number;
}

/**
 * Текущие скорости сближения VT к целевому трансформу T (в единицах за подшаг).
 */
export interface MoveableVelocity {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly r: number;
}

/**
 * Состояние затухающего импульса juice_up.
 */
export interface MoveableJuice {
  readonly scale: number;
  readonly scaleAmt: number;
  readonly r: number;
  readonly rAmt: number;
  readonly elapsed: number;
  readonly duration: number;
}

/**
 * Полное неизменяемое состояние одного Moveable-объекта.
 */
export interface MoveableState {
  readonly t: MoveableTransform;
  readonly vt: MoveableTransform;
  readonly velocity: MoveableVelocity;
  readonly juice: MoveableJuice | null;
  readonly settled: boolean;
}

/**
 * Дополнительные параметры интегрирования шага Moveable.
 */
export interface MoveableStepOptions {
  /** Ограничение скорости перемещения по XY в пикселях/сек (по умолчанию 5600). */
  readonly maxVelocityPxPerSec?: number;
  /** Коэффициент аэродинамического наклона от горизонтальной скорости (рад / (px/s)). */
  readonly tiltVelocityFactor?: number;
  /** Максимальный угол наклона от скорости полёта в радианах. */
  readonly maxTiltRad?: number;
}

const DEFAULT_TRANSFORM: MoveableTransform = { x: 0, y: 0, scale: 1, r: 0 };
const ZERO_VELOCITY: MoveableVelocity = { x: 0, y: 0, scale: 0, r: 0 };

const MAX_FRAME_DT_SECONDS = 1 / 20;
const SUBSTEP_MAX_DT_SECONDS = 1 / 60;
const JUICE_DURATION_SECONDS = 0.4;

const DEFAULT_MAX_VELOCITY_PX_PER_SEC = 5600;
const DEFAULT_TILT_VELOCITY_FACTOR = 0.000167;
const DEFAULT_MAX_TILT_RAD = 0.35;

const POS_EPSILON_PX = 0.2;
const POS_VEL_EPSILON_PX = 0.2;
const SCALE_EPSILON = 0.001;
const SCALE_VEL_EPSILON = 0.001;
const ROT_EPSILON_RAD = 0.001;
const ROT_VEL_EPSILON_RAD = 0.001;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function mergeTransform(
  base: MoveableTransform,
  patch: Partial<MoveableTransform> | undefined,
): MoveableTransform {
  if (!patch) return { ...base };
  return {
    x: patch.x !== undefined && Number.isFinite(patch.x) ? patch.x : base.x,
    y: patch.y !== undefined && Number.isFinite(patch.y) ? patch.y : base.y,
    scale: patch.scale !== undefined && Number.isFinite(patch.scale) ? patch.scale : base.scale,
    r: patch.r !== undefined && Number.isFinite(patch.r) ? patch.r : base.r,
  };
}

function isTransformEqual(a: MoveableTransform, b: MoveableTransform): boolean {
  return a.x === b.x && a.y === b.y && a.scale === b.scale && a.r === b.r;
}

function isVelocityZero(v: MoveableVelocity): boolean {
  return v.x === 0 && v.y === 0 && v.scale === 0 && v.r === 0;
}

function computeSettled(
  t: MoveableTransform,
  vt: MoveableTransform,
  velocity: MoveableVelocity,
  juice: MoveableJuice | null,
): boolean {
  return juice === null && isTransformEqual(t, vt) && isVelocityZero(velocity);
}

/**
 * Создаёт начальное состояние Moveable с совмещёнными T и VT (settled = true).
 */
export function createMoveableState(initial?: Partial<MoveableTransform>): MoveableState {
  const t = mergeTransform(DEFAULT_TRANSFORM, initial);
  return {
    t,
    vt: { ...t },
    velocity: { ...ZERO_VELOCITY },
    juice: null,
    settled: true,
  };
}

/**
 * Мгновенно перемещает целевой и видимый трансформы (T = VT = target) и сбрасывает скорости/импульсы.
 */
export function hardSetTarget(
  state: MoveableState,
  target: Partial<MoveableTransform>,
): MoveableState {
  const t = mergeTransform(state.t, target);
  return {
    t,
    vt: { ...t },
    velocity: { ...ZERO_VELOCITY },
    juice: null,
    settled: true,
  };
}

/**
 * Обновляет целевой трансформ T без мгновенного переноса VT (запускает плавное сближение).
 */
export function setTarget(
  state: MoveableState,
  target: Partial<MoveableTransform>,
): MoveableState {
  const t = mergeTransform(state.t, target);
  return {
    t,
    vt: { ...state.vt },
    velocity: { ...state.velocity },
    juice: state.juice ? { ...state.juice } : null,
    settled: computeSettled(t, state.vt, state.velocity, state.juice),
  };
}

/**
 * Запускает пружинный импульс scale/rotation (аналог Moveable:juice_up).
 * При reducedMotion = true не добавляет колебаний и удерживает VT = T.
 */
export function juiceUp(
  state: MoveableState,
  scaleDelta = 0.4,
  rotDelta = 0,
  reducedMotion = false,
): MoveableState {
  if (reducedMotion) {
    return {
      t: { ...state.t },
      vt: { ...state.t },
      velocity: { ...ZERO_VELOCITY },
      juice: null,
      settled: true,
    };
  }

  const safeScaleAmt = Number.isFinite(scaleDelta) ? scaleDelta : 0.4;
  const safeRotAmt = Number.isFinite(rotDelta) ? rotDelta : 0;
  const juice: MoveableJuice = {
    scale: 0,
    scaleAmt: safeScaleAmt,
    r: 0,
    rAmt: safeRotAmt,
    elapsed: 0,
    duration: JUICE_DURATION_SECONDS,
  };
  const nextVt: MoveableTransform = {
    ...state.vt,
    scale: state.t.scale - 0.6 * safeScaleAmt,
  };

  return {
    t: { ...state.t },
    vt: nextVt,
    velocity: { ...state.velocity },
    juice,
    settled: false,
  };
}

/**
 * Продвигает симуляцию impulse-колебания juice на один подшаг subDt.
 */
function advanceJuice(juice: MoveableJuice | null, subDt: number): MoveableJuice | null {
  if (!juice) return null;
  const elapsed = juice.elapsed + subDt;
  if (elapsed >= juice.duration) {
    return null;
  }
  const rem = Math.max(0, (juice.duration - elapsed) / juice.duration);
  return {
    ...juice,
    elapsed,
    scale: juice.scaleAmt * Math.sin(50.8 * elapsed) * rem * rem * rem,
    r: juice.rAmt * Math.sin(40.8 * elapsed) * rem * rem,
  };
}

/**
 * Выполняет один численно устойчивый подшаг интегрирования T -> VT.
 */
function integrateSubstep(
  state: MoveableState,
  subDt: number,
  maxVelocityPxPerSec: number,
  tiltVelocityFactor: number,
  maxTiltRad: number,
): MoveableState {
  const { t } = state;
  const juice = advanceJuice(state.juice, subDt);

  let vx = state.velocity.x;
  let vy = state.velocity.y;
  let vs = state.velocity.scale;
  let vr = state.velocity.r;

  let vtx = state.vt.x;
  let vty = state.vt.y;
  let vtScale = state.vt.scale;
  let vtR = state.vt.r;

  // 1. Позиция XY (move_xy)
  if (
    t.x !== vtx ||
    Math.abs(vx) > POS_VEL_EPSILON_PX ||
    t.y !== vty ||
    Math.abs(vy) > POS_VEL_EPSILON_PX
  ) {
    const expXy = Math.exp(-50 * subDt);
    vx = expXy * vx + (1 - expXy) * (t.x - vtx) * 35 * subDt;
    vy = expXy * vy + (1 - expXy) * (t.y - vty) * 35 * subDt;

    const maxVel = maxVelocityPxPerSec * subDt;
    const speedSq = vx * vx + vy * vy;
    if (maxVel > 0 && speedSq > maxVel * maxVel) {
      const actualVel = Math.sqrt(speedSq);
      vx = (maxVel * vx) / actualVel;
      vy = (maxVel * vy) / actualVel;
    }

    vtx += vx;
    vty += vy;

    if (Math.abs(vtx - t.x) < POS_EPSILON_PX && Math.abs(vx) < POS_VEL_EPSILON_PX) {
      vtx = t.x;
      vx = 0;
    }
    if (Math.abs(vty - t.y) < POS_EPSILON_PX && Math.abs(vy) < POS_VEL_EPSILON_PX) {
      vty = t.y;
      vy = 0;
    }
  } else {
    vtx = t.x;
    vty = t.y;
    vx = 0;
    vy = 0;
  }

  // 2. Поворот от скорости полёта и импульса (move_r)
  const velTilt = clamp((vx / subDt) * tiltVelocityFactor, -maxTiltRad, maxTiltRad);
  const desR = t.r + velTilt + (juice ? juice.r * 2 : 0);
  if (desR !== vtR || Math.abs(vr) > ROT_VEL_EPSILON_RAD) {
    const expR = Math.exp(-190 * subDt);
    vr = expR * vr + (1 - expR) * (desR - vtR);
    vtR += vr;
  }
  if (!juice && Math.abs(vtR - t.r) < ROT_EPSILON_RAD && Math.abs(vr) < ROT_VEL_EPSILON_RAD) {
    vtR = t.r;
    vr = 0;
  }

  // 3. Масштаб и импульс scale (move_scale)
  const desScale = t.scale + (juice ? juice.scale : 0);
  if (desScale !== vtScale || Math.abs(vs) > SCALE_VEL_EPSILON) {
    const expScale = Math.exp(-60 * subDt);
    vs = expScale * vs + (1 - expScale) * (desScale - vtScale);
    vtScale += vs;
  }
  if (
    !juice &&
    Math.abs(vtScale - t.scale) < SCALE_EPSILON &&
    Math.abs(vs) < SCALE_VEL_EPSILON
  ) {
    vtScale = t.scale;
    vs = 0;
  }

  const nextVt: MoveableTransform = { x: vtx, y: vty, scale: vtScale, r: vtR };
  const nextVelocity: MoveableVelocity = { x: vx, y: vy, scale: vs, r: vr };

  return {
    t: { ...t },
    vt: nextVt,
    velocity: nextVelocity,
    juice,
    settled: computeSettled(t, nextVt, nextVelocity, juice),
  };
}

/**
 * Выполняет шаг интегрирования VT -> T с защитой от больших dt (clamp до 0.05с),
 * учётом speedMultiplier и поддержкой reducedMotion (мгновенный переход VT = T).
 */
export function stepMoveable(
  state: MoveableState,
  dtSeconds: number,
  speedMultiplier = 1,
  reducedMotion = false,
  options: MoveableStepOptions = {},
): MoveableState {
  if (reducedMotion) {
    return {
      t: { ...state.t },
      vt: { ...state.t },
      velocity: { ...ZERO_VELOCITY },
      juice: null,
      settled: true,
    };
  }

  const clampedDt =
    Number.isFinite(dtSeconds) && dtSeconds > 0
      ? Math.min(MAX_FRAME_DT_SECONDS, dtSeconds)
      : 0;
  const safeSpeed = Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1;
  const totalDt = clampedDt * safeSpeed;

  if (totalDt <= 0 || state.settled) {
    return {
      t: { ...state.t },
      vt: { ...state.vt },
      velocity: { ...state.velocity },
      juice: state.juice ? { ...state.juice } : null,
      settled: computeSettled(state.t, state.vt, state.velocity, state.juice),
    };
  }

  const maxVelocityPxPerSec =
    options.maxVelocityPxPerSec ?? DEFAULT_MAX_VELOCITY_PX_PER_SEC;
  const tiltVelocityFactor = options.tiltVelocityFactor ?? DEFAULT_TILT_VELOCITY_FACTOR;
  const maxTiltRad = options.maxTiltRad ?? DEFAULT_MAX_TILT_RAD;

  // Разбиваем шаг на фиксированные подшаги <= 1/60с для устойчивости на высоких скоростях (2x/4x)
  const substeps = Math.max(1, Math.ceil(totalDt / SUBSTEP_MAX_DT_SECONDS));
  const subDt = totalDt / substeps;

  let current = state;
  for (let i = 0; i < substeps; i += 1) {
    current = integrateSubstep(
      current,
      subDt,
      maxVelocityPxPerSec,
      tiltVelocityFactor,
      maxTiltRad,
    );
    if (current.settled) {
      break;
    }
  }

  return current;
}
