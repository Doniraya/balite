/**
 * Контроллер 3D-наклона карт по вектору указателя и фазового парения в простое (Story 2.2).
 *
 * Вычисляет и обновляет CSS-переменные на элементах `.card-frame`:
 * - `--tilt-x`, `--tilt-y` — нормализованный вектор наклона в диапазоне [-1, 1];
 * - `--glare-x`, `--glare-y` — координата блика в процентах ('0%'..'100%');
 * - `--sway-r`, `--sway-y` — амплитуда парения в простое ('...deg' и '...px').
 */

/**
 * Опции инициализации контроллера 3D-наклона и парения карт.
 */
export interface CardTiltOptions {
  /** Корневой контейнер, на который делегируются pointer-события. */
  readonly container: HTMLElement;
  /** CSS-селектор целевых карточек (по умолчанию '.card-frame'). */
  readonly cardSelector?: string;
  /** Явное переопределение или ленивый опрос флага reduced-motion (для тестов и настроек). */
  readonly reducedMotion?: boolean | (() => boolean);
  /** Источник текущего времени в мс (по умолчанию performance.now). */
  readonly now?: () => number;
  /** Функция планирования кадра анимации (по умолчанию requestAnimationFrame). */
  readonly requestFrame?: (callback: FrameRequestCallback) => number;
  /** Функция отмены кадра анимации (по умолчанию cancelAnimationFrame). */
  readonly cancelFrame?: (id: number) => void;
}

/**
 * Публичный интерфейс управления контроллером 3D-наклона.
 */
export interface CardTiltController {
  /** Пересканирует карточки внутри контейнера после перерисовки DOM. */
  refresh(): void;
  /** Останавливает rAF, снимает слушатели и сбрасывает инлайновые CSS-переменные. */
  destroy(): void;
}

interface CardTiltEntry {
  readonly element: HTMLElement;
  phaseOffset: number;
  freqMul: number;
  currentTiltX: number;
  currentTiltY: number;
  targetTiltX: number;
  targetTiltY: number;
  currentGlareX: number;
  currentGlareY: number;
  targetGlareX: number;
  targetGlareY: number;
  ambientWeight: number;
  isHovered: boolean;
  isActiveTouch: boolean;
  activeTouchPointerId: number | null;
}

const DEFAULT_CARD_SELECTOR = '.card-frame';
const MAX_FRAME_DT_SECONDS = 0.05;
const TILT_FOLLOW_RATE = 20;
const AMBIENT_BLEND_RATE = 14;
const SWAY_ROTATION_DEG = 1.5;
const SWAY_OFFSET_PX = 2.4;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function resolveCardSeed(card: HTMLElement, fallbackIndex: number): number {
  const slot = card.closest<HTMLElement>('[data-card-id]');
  const key =
    card.dataset.cardId ||
    card.dataset.relicId ||
    card.dataset.consumableId ||
    card.dataset.charterId ||
    card.dataset.deckId ||
    card.dataset.bossId ||
    slot?.dataset.cardId ||
    `card-index-${fallbackIndex}`;
  return hashString(key);
}

function createCardEntry(card: HTMLElement, index: number): CardTiltEntry {
  const seed = resolveCardSeed(card, index);
  return {
    element: card,
    phaseOffset: ((seed % 6283) / 1000) + index * 0.47,
    freqMul: 0.88 + ((seed >>> 4) % 31) * 0.01,
    currentTiltX: 0,
    currentTiltY: 0,
    targetTiltX: 0,
    targetTiltY: 0,
    currentGlareX: 50,
    currentGlareY: 50,
    targetGlareX: 50,
    targetGlareY: 50,
    ambientWeight: 1,
    isHovered: false,
    isActiveTouch: false,
    activeTouchPointerId: null,
  };
}

function applyNeutralVars(card: HTMLElement): void {
  card.style.setProperty('--tilt-x', '0');
  card.style.setProperty('--tilt-y', '0');
  card.style.setProperty('--glare-x', '50%');
  card.style.setProperty('--glare-y', '50%');
  card.style.setProperty('--sway-r', '0deg');
  card.style.setProperty('--sway-y', '0px');
}

function clearInlineVars(card: HTMLElement): void {
  card.style.removeProperty('--tilt-x');
  card.style.removeProperty('--tilt-y');
  card.style.removeProperty('--glare-x');
  card.style.removeProperty('--glare-y');
  card.style.removeProperty('--sway-r');
  card.style.removeProperty('--sway-y');
}

function isSwayPaused(entry: CardTiltEntry): boolean {
  const { element } = entry;
  if (entry.isHovered || entry.isActiveTouch) {
    return true;
  }
  if (
    element.classList.contains('is-selected') ||
    element.classList.contains('is-disabled') ||
    element.hasAttribute('data-flight-active')
  ) {
    return true;
  }
  return element.closest('.is-selected, [data-flight-active="true"]') !== null;
}

/**
 * Инициализирует контроллер 3D-наклона и парения карт в указанном DOM-контейнере.
 */
export function initCardTiltController(options: CardTiltOptions): CardTiltController {
  const { container } = options;
  const cardSelector = options.cardSelector ?? DEFAULT_CARD_SELECTOR;
  const getNow = options.now ?? (() => performance.now());
  const scheduleFrame =
    options.requestFrame ?? ((cb: FrameRequestCallback) => window.requestAnimationFrame(cb));
  const cancelScheduledFrame =
    options.cancelFrame ?? ((id: number) => window.cancelAnimationFrame(id));

  const mediaQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  const isReducedMotion = (): boolean => {
    if (typeof options.reducedMotion === 'function') {
      return options.reducedMotion();
    }
    if (typeof options.reducedMotion === 'boolean') {
      return options.reducedMotion;
    }
    return mediaQuery?.matches ?? false;
  };

  const entries = new Map<HTMLElement, CardTiltEntry>();
  let rafId: number | null = null;
  let lastFrameMs: number | null = null;
  let destroyed = false;

  const stopLoop = (): void => {
    if (rafId !== null) {
      cancelScheduledFrame(rafId);
      rafId = null;
    }
    lastFrameMs = null;
  };

  const resetEntryTarget = (entry: CardTiltEntry): void => {
    entry.isHovered = false;
    entry.isActiveTouch = false;
    entry.activeTouchPointerId = null;
    entry.targetTiltX = 0;
    entry.targetTiltY = 0;
    entry.targetGlareX = 50;
    entry.targetGlareY = 50;
  };

  const updatePointerTarget = (entry: CardTiltEntry, clientX: number, clientY: number): void => {
    const rect = entry.element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const relX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const relY = clamp((clientY - rect.top) / rect.height, 0, 1);
    entry.targetTiltX = clamp((relX - 0.5) * 2, -1, 1);
    entry.targetTiltY = clamp((relY - 0.5) * 2, -1, 1);
    entry.targetGlareX = relX * 100;
    entry.targetGlareY = relY * 100;
  };

  const stepFrame = (timestampMs: number): void => {
    rafId = null;
    if (destroyed) return;

    if (isReducedMotion()) {
      for (const entry of entries.values()) {
        resetEntryTarget(entry);
        entry.currentTiltX = 0;
        entry.currentTiltY = 0;
        entry.currentGlareX = 50;
        entry.currentGlareY = 50;
        entry.ambientWeight = 0;
        applyNeutralVars(entry.element);
      }
      lastFrameMs = null;
      return;
    }

    const rawDt = lastFrameMs !== null ? (timestampMs - lastFrameMs) / 1000 : 1 / 60;
    lastFrameMs = timestampMs;
    const dt = clamp(Number.isFinite(rawDt) && rawDt > 0 ? rawDt : 1 / 60, 0, MAX_FRAME_DT_SECONDS);
    const timeSec = timestampMs / 1000;

    const tiltAlpha = 1 - Math.exp(-TILT_FOLLOW_RATE * dt);
    const ambientAlpha = 1 - Math.exp(-AMBIENT_BLEND_RATE * dt);

    for (const [card, entry] of entries) {
      if (!card.isConnected) {
        entries.delete(card);
        continue;
      }

      const paused = isSwayPaused(entry);
      const targetAmbient = paused ? 0 : 1;
      entry.ambientWeight += (targetAmbient - entry.ambientWeight) * ambientAlpha;
      if (Math.abs(entry.ambientWeight - targetAmbient) < 0.002) {
        entry.ambientWeight = targetAmbient;
      }

      const phase = timeSec * entry.freqMul + entry.phaseOffset;
      const swayR = Math.sin(phase * 1.45) * SWAY_ROTATION_DEG * entry.ambientWeight;
      const swayY = Math.cos(phase * 1.9 + 0.7) * SWAY_OFFSET_PX * entry.ambientWeight;

      entry.currentTiltX += (entry.targetTiltX - entry.currentTiltX) * tiltAlpha;
      entry.currentTiltY += (entry.targetTiltY - entry.currentTiltY) * tiltAlpha;
      if (!entry.isHovered && !entry.isActiveTouch) {
        if (Math.abs(entry.currentTiltX) < 0.001) entry.currentTiltX = 0;
        if (Math.abs(entry.currentTiltY) < 0.001) entry.currentTiltY = 0;
      }

      const desiredGlareX =
        entry.isHovered || entry.isActiveTouch
          ? entry.targetGlareX
          : 50 + Math.cos(phase * 0.95) * 16 * entry.ambientWeight;
      const desiredGlareY =
        entry.isHovered || entry.isActiveTouch
          ? entry.targetGlareY
          : 50 + Math.sin(phase * 0.8 + 0.5) * 12 * entry.ambientWeight;

      entry.currentGlareX += (desiredGlareX - entry.currentGlareX) * tiltAlpha;
      entry.currentGlareY += (desiredGlareY - entry.currentGlareY) * tiltAlpha;

      card.style.setProperty('--tilt-x', entry.currentTiltX.toFixed(4));
      card.style.setProperty('--tilt-y', entry.currentTiltY.toFixed(4));
      card.style.setProperty('--glare-x', `${entry.currentGlareX.toFixed(2)}%`);
      card.style.setProperty('--glare-y', `${entry.currentGlareY.toFixed(2)}%`);
      card.style.setProperty('--sway-r', `${swayR.toFixed(3)}deg`);
      card.style.setProperty('--sway-y', `${swayY.toFixed(2)}px`);
    }

    if (entries.size > 0 && !destroyed && !isReducedMotion()) {
      rafId = scheduleFrame(stepFrame);
    }
  };

  const ensureLoopRunning = (): void => {
    if (destroyed || rafId !== null || entries.size === 0 || isReducedMotion()) {
      return;
    }
    lastFrameMs = getNow();
    rafId = scheduleFrame(stepFrame);
  };

  const resolveCardFromTarget = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) return null;
    const card = target.closest<HTMLElement>(cardSelector);
    if (!card || !container.contains(card)) return null;
    return card;
  };

  const getOrCreateEntry = (card: HTMLElement): CardTiltEntry => {
    let entry = entries.get(card);
    if (!entry) {
      entry = createCardEntry(card, entries.size);
      entries.set(card, entry);
      ensureLoopRunning();
    }
    return entry;
  };

  const handlePointerOver = (rawEvent: Event): void => {
    if (destroyed || isReducedMotion()) return;
    const event = rawEvent as PointerEvent;
    if (event.pointerType === 'touch') return;

    const card = resolveCardFromTarget(event.target);
    if (!card || card.classList.contains('is-disabled')) return;

    const entry = getOrCreateEntry(card);
    entry.isHovered = true;
    updatePointerTarget(entry, event.clientX, event.clientY);
  };

  const handlePointerMove = (rawEvent: Event): void => {
    if (destroyed || isReducedMotion()) return;
    const event = rawEvent as PointerEvent;

    if (event.pointerType === 'touch') {
      for (const entry of entries.values()) {
        if (entry.isActiveTouch && entry.activeTouchPointerId === event.pointerId) {
          updatePointerTarget(entry, event.clientX, event.clientY);
        }
      }
      return;
    }

    const card = resolveCardFromTarget(event.target);
    if (!card || card.classList.contains('is-disabled')) return;

    const entry = getOrCreateEntry(card);
    entry.isHovered = true;
    updatePointerTarget(entry, event.clientX, event.clientY);
  };

  const handlePointerOut = (rawEvent: Event): void => {
    const event = rawEvent as PointerEvent;
    if (event.pointerType === 'touch') return;

    const card = resolveCardFromTarget(event.target);
    if (!card) return;
    if (event.relatedTarget instanceof Node && card.contains(event.relatedTarget)) {
      return;
    }

    const entry = entries.get(card);
    if (entry) {
      resetEntryTarget(entry);
    }
  };

  const handlePointerDown = (rawEvent: Event): void => {
    if (destroyed || isReducedMotion()) return;
    const event = rawEvent as PointerEvent;
    if (event.pointerType !== 'touch') return;

    const card = resolveCardFromTarget(event.target);
    if (!card || card.classList.contains('is-disabled')) return;

    const entry = getOrCreateEntry(card);
    entry.isActiveTouch = true;
    entry.activeTouchPointerId = event.pointerId;
    updatePointerTarget(entry, event.clientX, event.clientY);
  };

  const handleTouchRelease = (rawEvent: Event): void => {
    const event = rawEvent as PointerEvent;
    for (const entry of entries.values()) {
      if (
        entry.isActiveTouch &&
        (entry.activeTouchPointerId === null || entry.activeTouchPointerId === event.pointerId)
      ) {
        resetEntryTarget(entry);
      }
    }
  };

  const handleMouseLeave = (): void => {
    for (const entry of entries.values()) {
      resetEntryTarget(entry);
    }
  };

  const refresh = (): void => {
    if (destroyed) return;
    const currentCards = Array.from(container.querySelectorAll<HTMLElement>(cardSelector));
    const currentSet = new Set(currentCards);

    for (const card of entries.keys()) {
      if (!currentSet.has(card)) {
        entries.delete(card);
      }
    }

    currentCards.forEach((card, index) => {
      if (!entries.has(card)) {
        entries.set(card, createCardEntry(card, index));
      } else {
        const entry = entries.get(card)!;
        const seed = resolveCardSeed(card, index);
        entry.phaseOffset = ((seed % 6283) / 1000) + index * 0.47;
        entry.freqMul = 0.88 + ((seed >>> 4) % 31) * 0.01;
      }
    });

    if (isReducedMotion()) {
      stopLoop();
      for (const entry of entries.values()) {
        resetEntryTarget(entry);
        applyNeutralVars(entry.element);
      }
      return;
    }

    if (entries.size === 0) {
      stopLoop();
      return;
    }

    ensureLoopRunning();
  };

  const handleMediaChange = (): void => {
    refresh();
  };

  container.addEventListener('pointerover', handlePointerOver);
  container.addEventListener('pointermove', handlePointerMove);
  container.addEventListener('pointerout', handlePointerOut);
  container.addEventListener('pointerdown', handlePointerDown);
  container.addEventListener('pointerup', handleTouchRelease);
  container.addEventListener('pointercancel', handleTouchRelease);
  container.addEventListener('mouseleave', handleMouseLeave);
  mediaQuery?.addEventListener?.('change', handleMediaChange);

  refresh();

  return {
    refresh,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      stopLoop();

      container.removeEventListener('pointerover', handlePointerOver);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerout', handlePointerOut);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointerup', handleTouchRelease);
      container.removeEventListener('pointercancel', handleTouchRelease);
      container.removeEventListener('mouseleave', handleMouseLeave);
      mediaQuery?.removeEventListener?.('change', handleMediaChange);

      for (const card of entries.keys()) {
        clearInlineVars(card);
      }
      entries.clear();
    },
  };
}
