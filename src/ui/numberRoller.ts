// Контроллер плавной накрутки целых чисел и таймлайн построчной выплаты кэшаута (Story 2.4).
import type { AnimationSpeed } from '../engine/types';

/** Параметры контроллера плавной накрутки чисел. */
export interface NumberRollerOptions {
  /** Целевой DOM-элемент для автоматического обновления textContent. */
  element?: HTMLElement | null;
  /** Начальное целое значение (по умолчанию 0). */
  initialValue?: number;
  /** Функция форматирования отображаемого числа. */
  format?: (value: number) => string;
  /** Колбэк при каждом изменении отображаемого числа. */
  onUpdate?: (value: number, formatted: string) => void;
  /** Базовая длительность перехода в мс при скорости 1x (по умолчанию 240). */
  durationMs?: number;
  /** Множитель скорости анимации (0.5 | 1 | 2 | 4) или его геттер. */
  speed?: AnimationSpeed | (() => AnimationSpeed);
  /** Переопределение reduced-motion (для тестов и настроек доступности). */
  reducedMotion?: boolean | (() => boolean);
  /** Инъекция часов (мс) для детерминированных тестов. */
  now?: () => number;
  /** Инъекция планировщика кадров. */
  requestFrame?: (cb: FrameRequestCallback) => number;
  /** Инъекция отмены кадра. */
  cancelFrame?: (id: number) => void;
}

/** Опции единичного перехода накрутки. */
export interface NumberRollerSetOptions {
  /** Переопределение базовой длительности перехода при 1x (мс). */
  durationMs?: number;
  /** Установить значение без анимации. */
  immediate?: boolean;
}

/** Публичный интерфейс контроллера накрутки чисел. */
export interface NumberRollerController {
  /** Запускает плавную накрутку от текущего значения к указанному целому. */
  setTarget(value: number, opts?: NumberRollerSetOptions): void;
  /** Мгновенно фиксирует текущее значение (или текущую цель, если аргумент опущен). */
  snap(value?: number): void;
  /** Мгновенно завершает текущую накрутку до целевого значения. */
  skip(): void;
  /** Возвращает текущее отображаемое целое число. */
  getCurrent(): number;
  /** Возвращает целевое целое число. */
  getTarget(): number;
  /** Возвращает true, пока идёт анимация переката. */
  isAnimating(): boolean;
  /** Останавливает rAF и освобождает слушатели. */
  destroy(): void;
}

/** Описание одной строки в таймлайне кэшаута. */
export interface CashoutTimelineRow {
  /** Элемент строки кэшаута (получит data-cashout-revealed="true"|"false"). */
  rowElement?: HTMLElement | null;
  /** Элемент суммы внутри строки для накрутки числа. */
  valueElement?: HTMLElement | null;
  /** Сумма данной строки в золоте. */
  amount: number;
  /** Форматтер суммы строки (по умолчанию String(v)). */
  formatAmount?: (value: number) => string;
  /** Является ли строка итоговой. */
  isTotal?: boolean;
}

/** Параметры таймлайна построчной выплаты кэшаута. */
export interface CashoutTimelineOptions {
  /** Строки выплат в порядке их появления. */
  rows: ReadonlyArray<CashoutTimelineRow>;
  /** Опциональный элемент итоговой суммы (например, кнопка «Забрать $X»). */
  totalElement?: HTMLElement | null;
  /** Форматтер текста для totalElement. */
  formatTotal?: (value: number) => string;
  /** Колбэк при раскрытии очередной строки. */
  onRowReveal?: (index: number, row: CashoutTimelineRow) => void;
  /** Колбэк при обновлении нарастающего итога. */
  onTotalUpdate?: (value: number) => void;
  /** Колбэк завершения всего таймлайна (или skip). */
  onComplete?: () => void;
  /** Пауза между раскрытием строк при 1x (по умолчанию 140 мс). */
  rowStepMs?: number;
  /** Длительность накрутки суммы в строке при 1x (по умолчанию 220 мс). */
  rollDurationMs?: number;
  /** Множитель скорости анимации (0.5 | 1 | 2 | 4) или его геттер. */
  speed?: AnimationSpeed | (() => AnimationSpeed);
  /** Переопределение reduced-motion. */
  reducedMotion?: boolean | (() => boolean);
  now?: () => number;
  requestFrame?: (cb: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
}

/** Контроллер таймлайна кэшаута. */
export interface CashoutTimelineController {
  /** Запускает последовательное появление строк и накрутку золота. */
  start(): void;
  /** Мгновенно раскрывает все строки и фиксирует финальные суммы. */
  skip(): void;
  /** Завершён ли таймлайн. */
  isFinished(): boolean;
  /** Останавливает цикл rAF и отписывается от слушателей. */
  destroy(): void;
}

function normalizeSpeed(speed: AnimationSpeed | number | undefined): AnimationSpeed {
  if (speed === 0.5 || speed === 1 || speed === 2 || speed === 4) {
    return speed;
  }
  return 1;
}

function easeOutCubic(t: number): number {
  const inv = 1 - Math.max(0, Math.min(1, t));
  return 1 - inv * inv * inv;
}

function createRuntimeHooks(options: {
  speed?: AnimationSpeed | (() => AnimationSpeed);
  reducedMotion?: boolean | (() => boolean);
  now?: () => number;
  requestFrame?: (cb: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
}) {
  const mql =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  const getSpeed = (): AnimationSpeed => {
    const raw = typeof options.speed === 'function' ? options.speed() : options.speed;
    return normalizeSpeed(raw);
  };

  const isReducedMotion = (): boolean => {
    if (typeof options.reducedMotion === 'function') {
      return options.reducedMotion();
    }
    if (typeof options.reducedMotion === 'boolean') {
      return options.reducedMotion;
    }
    return Boolean(mql?.matches);
  };

  const getNow =
    options.now ??
    (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const reqFrame =
    options.requestFrame ??
    ((cb: FrameRequestCallback) => window.requestAnimationFrame(cb));
  const cancelReqFrame =
    options.cancelFrame ??
    ((id: number) => window.cancelAnimationFrame(id));

  return { mql, getSpeed, isReducedMotion, getNow, reqFrame, cancelReqFrame };
}

/**
 * Создаёт контроллер плавной накрутки целого числа с поддержкой AnimationSpeed,
 * reduced-motion и безопасной работой в jsdom.
 */
export function createNumberRoller(
  options: NumberRollerOptions = {},
): NumberRollerController {
  const {
    element = null,
    initialValue = 0,
    format = (v: number) => String(v),
    onUpdate,
    durationMs = 240,
  } = options;

  const hooks = createRuntimeHooks(options);
  let current = Math.round(Number.isFinite(initialValue) ? initialValue : 0);
  let target = current;
  let from = current;
  let startTimeMs = 0;
  let activeDurationMs = Math.max(1, durationMs);
  let rafId: number | null = null;
  let destroyed = false;

  const renderValue = (val: number, notify: boolean): void => {
    const rounded = Math.round(val);
    current = rounded;
    const text = format(rounded);
    if (element && element.textContent !== text) {
      element.textContent = text;
    }
    if (notify) {
      onUpdate?.(rounded, text);
    }
  };

  const stopLoop = (): void => {
    if (rafId !== null) {
      hooks.cancelReqFrame(rafId);
      rafId = null;
    }
  };

  const snap = (value?: number): void => {
    if (destroyed) return;
    stopLoop();
    const next =
      value === undefined
        ? target
        : Math.round(Number.isFinite(value) ? value : current);
    target = next;
    from = next;
    if (current !== next || (element && element.textContent !== format(next))) {
      renderValue(next, true);
    }
  };

  const step = (timestamp: number): void => {
    rafId = null;
    if (destroyed) return;

    if (hooks.isReducedMotion()) {
      snap(target);
      return;
    }

    const elapsed = Math.max(0, timestamp - startTimeMs);
    const progress = activeDurationMs > 0 ? Math.min(1, elapsed / activeDurationMs) : 1;
    const eased = easeOutCubic(progress);
    const nextValue = Math.round(from + (target - from) * eased);

    if (nextValue !== current) {
      renderValue(nextValue, true);
    }

    if (progress >= 1) {
      if (current !== target) {
        renderValue(target, true);
      }
      from = target;
      return;
    }

    rafId = hooks.reqFrame(step);
  };

  const setTarget = (value: number, opts?: NumberRollerSetOptions): void => {
    if (destroyed) return;
    const nextTarget = Math.round(Number.isFinite(value) ? value : current);

    if (nextTarget === target && (rafId !== null || current === nextTarget)) {
      return;
    }

    if (opts?.immediate || hooks.isReducedMotion()) {
      snap(nextTarget);
      return;
    }

    target = nextTarget;
    if (current === target) {
      stopLoop();
      return;
    }

    const baseDuration = Math.max(1, opts?.durationMs ?? durationMs);
    activeDurationMs = Math.max(1, Math.round(baseDuration / hooks.getSpeed()));
    from = current;
    startTimeMs = hooks.getNow();

    if (rafId === null) {
      rafId = hooks.reqFrame(step);
    }
  };

  const handleMotionChange = (): void => {
    if (!destroyed && hooks.isReducedMotion() && rafId !== null) {
      snap(target);
    }
  };

  hooks.mql?.addEventListener?.('change', handleMotionChange);
  // Первичная синхронизация текста DOM без лишнего колбэка
  renderValue(current, false);

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    stopLoop();
    hooks.mql?.removeEventListener?.('change', handleMotionChange);
  };

  return {
    setTarget,
    snap,
    skip: () => snap(target),
    getCurrent: () => current,
    getTarget: () => target,
    isAnimating: () => rafId !== null,
    destroy,
  };
}

/**
 * Создаёт последовательный таймлайн раскрытия строк кэшаута и накрутки итогового золота.
 */
export function createCashoutTimeline(
  options: CashoutTimelineOptions,
): CashoutTimelineController {
  const {
    rows,
    totalElement = null,
    formatTotal = (v: number) => String(v),
    onRowReveal,
    onTotalUpdate,
    onComplete,
    rowStepMs = 140,
    rollDurationMs = 220,
  } = options;

  const hooks = createRuntimeHooks(options);
  let started = false;
  let finished = false;
  let destroyed = false;
  let rafId: number | null = null;
  let startTimeMs = 0;

  // Подготовка расписания каждой строки относительно старта таймлайна (при 1x)
  interface ScheduledRow {
    index: number;
    row: CashoutTimelineRow;
    startMs: number;
    rollMs: number;
    revealed: boolean;
    lastDisplayed: number;
    format: (v: number) => string;
  }

  let accMs = 0;
  const scheduled: ScheduledRow[] = rows.map((row, index) => {
    const isZero = row.amount === 0 && !row.isTotal;
    const stepDelay = isZero ? Math.round(rowStepMs * 0.45) : rowStepMs;
    const rollMs = isZero ? 0 : rollDurationMs;
    const startMs = accMs;
    accMs += stepDelay;
    return {
      index,
      row,
      startMs,
      rollMs,
      revealed: false,
      lastDisplayed: -1,
      format: row.formatAmount ?? ((v: number) => String(v)),
    };
  });

  const totalFinalAmount = (() => {
    const explicitTotal = rows.find((r) => r.isTotal);
    if (explicitTotal) return Math.round(explicitTotal.amount);
    return Math.round(rows.reduce((sum, r) => sum + r.amount, 0));
  })();

  let lastRenderedTotal = -1;

  const writeRowState = (item: ScheduledRow, value: number, revealed: boolean): void => {
    if (item.row.rowElement) {
      item.row.rowElement.dataset.cashoutRevealed = revealed ? 'true' : 'false';
      item.row.rowElement.style.opacity = revealed ? '1' : '0';
    }
    const rounded = Math.round(value);
    if (item.row.valueElement && item.lastDisplayed !== rounded) {
      item.lastDisplayed = rounded;
      item.row.valueElement.textContent = item.format(rounded);
    }
  };

  const writeTotalState = (value: number): void => {
    const rounded = Math.round(value);
    if (rounded === lastRenderedTotal) return;
    lastRenderedTotal = rounded;
    if (totalElement) {
      totalElement.textContent = formatTotal(rounded);
    }
    onTotalUpdate?.(rounded);
  };

  const stopLoop = (): void => {
    if (rafId !== null) {
      hooks.cancelReqFrame(rafId);
      rafId = null;
    }
  };

  const finishImmediately = (): void => {
    if (destroyed || finished) return;
    finished = true;
    started = true;
    stopLoop();

    for (const item of scheduled) {
      const wasRevealed = item.revealed;
      item.revealed = true;
      writeRowState(item, item.row.amount, true);
      if (!wasRevealed) {
        onRowReveal?.(item.index, item.row);
      }
    }
    writeTotalState(totalFinalAmount);
    onComplete?.();
  };

  const step = (timestamp: number): void => {
    rafId = null;
    if (destroyed || finished) return;

    if (hooks.isReducedMotion()) {
      finishImmediately();
      return;
    }

    const speed = hooks.getSpeed();
    // Эквивалентное время в шкале 1x позволяет плавно масштабировать таймлайн скоростью
    const elapsedVirtualMs = Math.max(0, (timestamp - startTimeMs) * speed);
    let runningTotal = 0;
    let allSettled = true;

    for (const item of scheduled) {
      if (elapsedVirtualMs < item.startMs) {
        allSettled = false;
        continue;
      }

      if (!item.revealed) {
        item.revealed = true;
        writeRowState(item, 0, true);
        onRowReveal?.(item.index, item.row);
      }

      const localElapsed = elapsedVirtualMs - item.startMs;
      const progress =
        item.rollMs > 0 ? Math.min(1, localElapsed / item.rollMs) : 1;
      if (progress < 1) {
        allSettled = false;
      }

      const currentVal = Math.round(item.row.amount * easeOutCubic(progress));
      writeRowState(item, currentVal, true);

      if (!item.row.isTotal) {
        runningTotal += currentVal;
      }
    }

    const hasExplicitTotal = scheduled.some((item) => item.row.isTotal);
    const totalRow = scheduled.find((item) => item.row.isTotal);
    const displayedTotal =
      hasExplicitTotal && totalRow && totalRow.revealed
        ? Math.max(runningTotal, totalRow.lastDisplayed)
        : runningTotal;
    writeTotalState(displayedTotal);

    if (allSettled) {
      finished = true;
      writeTotalState(totalFinalAmount);
      onComplete?.();
      return;
    }

    rafId = hooks.reqFrame(step);
  };

  // Изначально скрываем нераскрытые строки
  for (const item of scheduled) {
    writeRowState(item, 0, false);
  }
  writeTotalState(0);

  const start = (): void => {
    if (destroyed || finished || started) return;
    started = true;
    if (hooks.isReducedMotion() || scheduled.length === 0) {
      finishImmediately();
      return;
    }
    startTimeMs = hooks.getNow();
    rafId = hooks.reqFrame(step);
  };

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    stopLoop();
  };

  return {
    start,
    skip: finishImmediately,
    isFinished: () => finished,
    destroy,
  };
}
