import type { AnimationSpeed } from '../engine/types';
import {
  createMoveableState,
  juiceUp,
  setMoveableZoom,
  setTarget,
  stepMoveable,
  type MoveableState,
} from './moveable';

/**
 * Геометрия DOM-элемента на сцене в пикселях.
 */
export interface CardRectSnapshot {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly centerX: number;
  readonly centerY: number;
}

/**
 * Снимок состояния одной отображаемой карты до перерендера DOM.
 */
export interface CardSnapshotEntry {
  readonly cardId: string;
  readonly zone: 'hand' | 'play';
  readonly rect: CardRectSnapshot;
  readonly fanAngleRad: number;
  readonly fanOffsetY: number;
  readonly selected: boolean;
  readonly shattered: boolean;
  readonly ghostNode: HTMLElement | null;
}

/**
 * Полный снимок расположения карт и стопки колоды перед перерисовкой экрана.
 */
export interface CardLayoutSnapshot {
  readonly cards: ReadonlyMap<string, CardSnapshotEntry>;
  readonly deckRect: CardRectSnapshot | null;
  readonly containerRect: CardRectSnapshot;
}

/**
 * Настройки контроллера полётов карт CardAnimator.
 */
export interface CardAnimatorOptions {
  /** Слой для призрачных копий уходящих карт поверх сцены. */
  readonly flightLayer?: HTMLElement | null;
  /** Провайдер текущей скорости анимации (по умолчанию 1). */
  readonly getSpeed?: () => AnimationSpeed;
  /** Проверка пользовательской настройки reduced motion. */
  readonly prefersReducedMotion?: () => boolean;
  /** Инъекция requestAnimationFrame для детерминированного тестирования. */
  readonly requestFrame?: (cb: FrameRequestCallback) => number;
  /** Инъекция cancelAnimationFrame для детерминированного тестирования. */
  readonly cancelFrame?: (id: number) => void;
  /** Источник времени в миллисекундах для первого кадра. */
  readonly now?: () => number;
  /** Вызывается при старте каскадного вылета каждой карты из колоды или из руки. */
  readonly onCardDeal?: (index: number, zone: 'hand' | 'play') => void;
  /** Вызывается при старте поочерёдного сброса уходящей карты. */
  readonly onCardDepart?: (index: number, zone: 'hand' | 'play') => void;
}

/**
 * Опции запуска переходов по сохранённому снимку.
 */
export interface AnimateFromSnapshotOptions {
  readonly speed?: AnimationSpeed;
  readonly animateDepartures?: boolean;
  readonly animateDeal?: boolean;
  readonly dealInitialDelaySeconds?: number;
  readonly playInitialDelaySeconds?: number;
  readonly departInitialDelaySeconds?: number;
  readonly triggerCardIds?: readonly string[];
}

/**
 * Параметры пружинного импульса juice_up для любого DOM-слота или HUD-плитки.
 */
export interface TriggerJuiceOptions {
  readonly scaleDelta?: number;
  readonly rotDelta?: number;
  readonly speed?: AnimationSpeed;
}

/**
 * Контроллер пружинной анимации карт на базе Moveable и requestAnimationFrame.
 */
export interface CardAnimatorController {
  captureSnapshot: (
    container: HTMLElement,
    options?: { readonly captureGhosts?: boolean },
  ) => CardLayoutSnapshot;
  animateFromSnapshot: (
    container: HTMLElement,
    snapshot: CardLayoutSnapshot,
    options?: AnimateFromSnapshotOptions,
  ) => number;
  pulseCard: (cardId: string, scaleDelta?: number, rotDelta?: number) => boolean;
  triggerJuice: (target: HTMLElement | null, options?: TriggerJuiceOptions) => boolean;
  setHoverZoom?: (target: HTMLElement | null, hovered: boolean) => boolean;
  cancelAll: () => void;
  getActiveFlightCount: () => number;
  destroy: () => void;
}

interface ActiveLiveFlight {
  readonly kind: 'live';
  readonly cardId: string;
  readonly el: HTMLElement;
  readonly baseFanY: number;
  readonly baseFanDeg: number;
  delaySeconds: number;
  readonly flightTempo: number;
  onLaunch?: () => void;
  state: MoveableState;
}

interface ActiveGhostFlight {
  readonly kind: 'ghost';
  readonly cardId: string;
  readonly el: HTMLElement;
  readonly startDistance: number;
  delaySeconds: number;
  readonly flightTempo: number;
  onLaunch?: () => void;
  state: MoveableState;
}

type ActiveFlight = ActiveLiveFlight | ActiveGhostFlight;

const TRACKED_CARD_SELECTOR = '[data-zone="hand"][data-card-id], [data-zone="play"][data-card-id]';
const DECK_STACK_SELECTOR = '[data-deck-stack="true"], .deck-stack-btn';

const MIN_DELTA_PX = 0.5;
const MIN_DELTA_SCALE = 0.01;
const MIN_DELTA_RAD = 0.005;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function readRect(el: HTMLElement): CardRectSnapshot {
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
  };
}

function isNonZeroRect(rect: CardRectSnapshot | null): rect is CardRectSnapshot {
  return rect !== null && (rect.width > 0 || rect.height > 0 || rect.left !== 0 || rect.top !== 0);
}

function parseCssNumber(raw: string): number {
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseFanAngleDeg(el: HTMLElement): number {
  return parseCssNumber(el.style.getPropertyValue('--fan-angle'));
}

function parseFanOffsetY(el: HTMLElement): number {
  return parseCssNumber(el.style.getPropertyValue('--fan-offset-y'));
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function defaultPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function findDeckRect(container: HTMLElement): CardRectSnapshot | null {
  const deckEl = container.querySelector<HTMLElement>(DECK_STACK_SELECTOR);
  return deckEl ? readRect(deckEl) : null;
}

/**
 * Подготавливает визуальный клон уходящей карты без интерактивных атрибутов.
 */
function cloneCardAsGhost(sourceEl: HTMLElement): HTMLElement {
  const ghost = sourceEl.cloneNode(true) as HTMLElement;
  ghost.classList.remove('interactive-slot', 'is-selected', 'is-dragging');
  ghost.classList.add('card-flight-ghost');
  ghost.removeAttribute('role');
  ghost.removeAttribute('tabindex');
  ghost.removeAttribute('aria-pressed');
  ghost.removeAttribute('data-flight-active');
  return ghost;
}

/**
 * Применяет текущий трансформ Moveable поверх базового веерного угла/смещения слота.
 */
function applyLiveTransform(flight: ActiveLiveFlight): void {
  const { vt } = flight.state;
  const totalY = vt.y + flight.baseFanY;
  const totalDeg = flight.baseFanDeg + radToDeg(vt.r);
  const parts = [`translate3d(${vt.x.toFixed(2)}px, ${totalY.toFixed(2)}px, 0)`];
  if (Math.abs(totalDeg) > 0.001) {
    parts.push(`rotate(${totalDeg.toFixed(2)}deg)`);
  }
  if (Math.abs(vt.scale - 1) > 0.001) {
    parts.push(`scale(${vt.scale.toFixed(4)})`);
  }
  flight.el.style.transform = parts.join(' ');
}

/**
 * Применяет текущий трансформ и плавное затухание прозрачности к призраку в сбросе.
 */
function applyGhostTransform(flight: ActiveGhostFlight): void {
  const { t, vt } = flight.state;
  const deg = radToDeg(vt.r);
  const parts = [`translate3d(${vt.x.toFixed(2)}px, ${vt.y.toFixed(2)}px, 0)`];
  if (Math.abs(deg) > 0.001) {
    parts.push(`rotate(${deg.toFixed(2)}deg)`);
  }
  if (Math.abs(vt.scale - 1) > 0.001) {
    parts.push(`scale(${vt.scale.toFixed(4)})`);
  }
  flight.el.style.transform = parts.join(' ');

  if (flight.startDistance > 1) {
    const remaining = Math.hypot(t.x - vt.x, t.y - vt.y);
    const progress = clamp(1 - remaining / flight.startDistance, 0, 1);
    const opacity = progress < 0.55 ? 1 : clamp(1 - (progress - 0.55) / 0.35, 0, 1);
    flight.el.style.opacity = opacity.toFixed(3);
  }
}

function clearLiveElementFlight(el: HTMLElement): void {
  el.style.transform = '';
  el.style.opacity = '';
  delete el.dataset.flightActive;
  delete el.dataset.flightHidden;
}

/**
 * Создаёт контроллер анимации карт на базе пружинной физики Moveable и requestAnimationFrame.
 */
export function createCardAnimator(options: CardAnimatorOptions = {}): CardAnimatorController {
  const flightLayer = options.flightLayer ?? null;
  const getSpeed = options.getSpeed ?? (() => 1);
  const prefersReducedMotion = options.prefersReducedMotion ?? defaultPrefersReducedMotion;
  const requestFrame: (cb: FrameRequestCallback) => number =
    options.requestFrame ??
    ((cb) =>
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(cb)
        : (setTimeout(() => cb(Date.now()), 16) as unknown as number));
  const cancelFrame: (id: number) => void =
    options.cancelFrame ??
    ((id) => {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(id);
      } else {
        clearTimeout(id);
      }
    });
  const nowFn =
    options.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const onCardDeal = options.onCardDeal;
  const onCardDepart = options.onCardDepart;

  let destroyed = false;
  let rafId: number | null = null;
  let lastFrameMs: number | null = null;
  let activeSpeed: AnimationSpeed = getSpeed();
  let flights: ActiveFlight[] = [];
  let juiceStepCounter = 0;

  const stopScheduler = (): void => {
    if (rafId !== null) {
      cancelFrame(rafId);
      rafId = null;
    }
    lastFrameMs = null;
  };

  const cleanupFlight = (flight: ActiveFlight): void => {
    if (flight.kind === 'live') {
      clearLiveElementFlight(flight.el);
    } else {
      flight.el.remove();
    }
  };

  const cancelAll = (): void => {
    stopScheduler();
    for (const flight of flights) {
      cleanupFlight(flight);
    }
    flights = [];
  };

  const tick = (frameTimeMs: number): void => {
    rafId = null;
    if (destroyed) return;

    const dtSeconds =
      lastFrameMs === null ? 1 / 60 : Math.max(0, (frameTimeMs - lastFrameMs) / 1000);
    lastFrameMs = frameTimeMs;

    const reduced = prefersReducedMotion();
    const nextFlights: ActiveFlight[] = [];

    for (const flight of flights) {
      if (flight.kind === 'live' && !flight.el.isConnected) {
        clearLiveElementFlight(flight.el);
        continue;
      }

      if (flight.delaySeconds > 0 && !reduced) {
        flight.delaySeconds -= dtSeconds;
        if (flight.delaySeconds > 0) {
          nextFlights.push(flight);
          continue;
        }
        const remDt = Math.max(1 / 240, -flight.delaySeconds);
        flight.delaySeconds = 0;
        if (flight.kind === 'live') {
          delete flight.el.dataset.flightHidden;
          if (flight.el.style.opacity === '0') {
            flight.el.style.opacity = '';
          }
        }
        if (flight.onLaunch) {
          flight.onLaunch();
          flight.onLaunch = undefined;
        }
        // Пружины Moveable и juice_up всегда тикают по реальному времени REAL (C1)
        flight.state = stepMoveable(flight.state, remDt, 1, reduced);
      } else {
        if (flight.kind === 'live') {
          delete flight.el.dataset.flightHidden;
          if (flight.el.style.opacity === '0') {
            flight.el.style.opacity = '';
          }
        }
        if (flight.onLaunch) {
          flight.onLaunch();
          flight.onLaunch = undefined;
        }
        flight.state = stepMoveable(flight.state, dtSeconds, 1, reduced);
      }

      if (flight.state.settled) {
        if (
          flight.kind === 'live' &&
          flight.state.zoom?.enabled &&
          flight.state.zoom.hover
        ) {
          applyLiveTransform(flight);
          nextFlights.push(flight);
        } else {
          cleanupFlight(flight);
        }
      } else {
        if (flight.kind === 'live') {
          applyLiveTransform(flight);
        } else {
          applyGhostTransform(flight);
        }
        nextFlights.push(flight);
      }
    }

    flights = nextFlights;
    if (flights.some((flight) => !flight.state.settled || flight.delaySeconds > 0)) {
      rafId = requestFrame(tick);
    } else {
      lastFrameMs = null;
    }
  };

  const ensureLoopRunning = (): void => {
    if (destroyed || rafId !== null) return;
    if (!flights.some((flight) => !flight.state.settled || flight.delaySeconds > 0)) return;
    lastFrameMs = nowFn();
    rafId = requestFrame(tick);
  };

  const captureSnapshot = (
    container: HTMLElement,
    captureOptions: { readonly captureGhosts?: boolean } = {},
  ): CardLayoutSnapshot => {
    const cards = new Map<string, CardSnapshotEntry>();
    const captureGhosts = captureOptions.captureGhosts !== false;
    const slotElements = container.querySelectorAll<HTMLElement>(TRACKED_CARD_SELECTOR);

    slotElements.forEach((slotEl) => {
      const cardId = slotEl.dataset.cardId;
      const rawZone = slotEl.dataset.zone;
      if (!cardId || (rawZone !== 'hand' && rawZone !== 'play')) return;

      cards.set(cardId, {
        cardId,
        zone: rawZone,
        rect: readRect(slotEl),
        fanAngleRad: degToRad(parseFanAngleDeg(slotEl)),
        fanOffsetY: parseFanOffsetY(slotEl),
        selected: slotEl.classList.contains('is-selected'),
        shattered: slotEl.dataset.shattered === 'true' || slotEl.classList.contains('is-shattered'),
        ghostNode: captureGhosts ? cloneCardAsGhost(slotEl) : null,
      });
    });

    return {
      cards,
      deckRect: findDeckRect(container),
      containerRect: readRect(container),
    };
  };

  const animateFromSnapshot = (
    container: HTMLElement,
    snapshot: CardLayoutSnapshot,
    animateOptions: AnimateFromSnapshotOptions = {},
  ): number => {
    if (destroyed) return 0;
    cancelAll();

    activeSpeed = animateOptions.speed ?? getSpeed();
    if (prefersReducedMotion()) {
      return 0;
    }

    const animateDeal = animateOptions.animateDeal !== false;
    const animateDepartures = animateOptions.animateDepartures !== false;
    const basePlayDelay = Math.max(0, animateOptions.playInitialDelaySeconds ?? 0);
    const baseDepartDelay = Math.max(0, animateOptions.departInitialDelaySeconds ?? 0);
    const triggerSet = new Set(animateOptions.triggerCardIds ?? []);

    const currentSlots = container.querySelectorAll<HTMLElement>(TRACKED_CARD_SELECTOR);
    const presentIds = new Set<string>();
    currentSlots.forEach((slotEl) => {
      const cardId = slotEl.dataset.cardId;
      const rawZone = slotEl.dataset.zone;
      if (cardId && (rawZone === 'hand' || rawZone === 'play')) {
        presentIds.add(cardId);
      }
    });
    let departingCount = 0;
    if (animateDepartures && flightLayer) {
      snapshot.cards.forEach((entry) => {
        if (!presentIds.has(entry.cardId) && entry.ghostNode && isNonZeroRect(entry.rect)) {
          departingCount += 1;
        }
      });
    }
    // В оригинале перед добором новой руки после сброса стоит пауза delay(0.3) + по 0.1с на сброшенную карту
    const autoDealDelayAfterDepart =
      departingCount > 0 ? (departingCount - 1) * 0.1 + 0.3 : 0;
    const baseDealDelay =
      animateOptions.dealInitialDelaySeconds !== undefined
        ? Math.max(0, animateOptions.dealInitialDelaySeconds)
        : autoDealDelayAfterDepart;

    const currentCardIds = new Set<string>();
    const dealSourceRect = snapshot.deckRect ?? findDeckRect(container);
    let dealOrder = 0;
    let playOrder = 0;
    let ghostOrder = 0;

    currentSlots.forEach((slotEl) => {
      const cardId = slotEl.dataset.cardId;
      const rawZone = slotEl.dataset.zone;
      if (!cardId || (rawZone !== 'hand' && rawZone !== 'play')) return;

      currentCardIds.add(cardId);
      const toRect = readRect(slotEl);
      const baseFanDeg = parseFanAngleDeg(slotEl);
      const baseFanY = parseFanOffsetY(slotEl);
      const toFanAngleRad = degToRad(baseFanDeg);
      const isSelected = slotEl.classList.contains('is-selected');
      const prev = snapshot.cards.get(cardId);

      let dx = 0;
      let dy = 0;
      let dScale = 1;
      let dR = 0;
      let shouldJuice = triggerSet.has(cardId);
      let delaySeconds = 0;
      let flightTempo = 1;
      let hideUntilLaunch = false;
      let onLaunch: (() => void) | undefined;

      if (prev) {
        if (isNonZeroRect(prev.rect) && isNonZeroRect(toRect)) {
          dx = prev.rect.centerX - toRect.centerX;
          dy = prev.rect.centerY - toRect.centerY;
          if (prev.zone === 'hand' && rawZone === 'hand' && prev.selected !== isSelected) {
            dy += (prev.selected ? -24 : 0) - (isSelected ? -24 : 0);
            shouldJuice = true;
          }
          if (toRect.width > 0 && prev.rect.width > 0) {
            dScale = clamp(prev.rect.width / toRect.width, 0.4, 2.5);
          }
        }
        dR = prev.fanAngleRad - toFanAngleRad;
        if (prev.zone === 'hand' && rawZone === 'play') {
          shouldJuice = true;
          const order = playOrder++;
          delaySeconds = (basePlayDelay + order * 0.1) / activeSpeed;
          flightTempo = 1;
          onLaunch = onCardDeal ? () => onCardDeal(order, 'play') : undefined;
        }
      } else if (
        rawZone === 'hand' &&
        animateDeal &&
        isNonZeroRect(dealSourceRect) &&
        isNonZeroRect(toRect)
      ) {
        dx = dealSourceRect.centerX - toRect.centerX;
        dy = dealSourceRect.centerY - toRect.centerY;
        dScale =
          toRect.width > 0 && dealSourceRect.width > 0
            ? clamp(dealSourceRect.width / toRect.width, 0.45, 1.4)
            : 0.72;
        dR = -toFanAngleRad;
        const order = dealOrder++;
        delaySeconds = (baseDealDelay + order * 0.1) / activeSpeed;
        flightTempo = 1;
        hideUntilLaunch = delaySeconds > 0;
        onLaunch =
          (order > 0 || baseDealDelay > 0) && onCardDeal
            ? () => onCardDeal(order, 'hand')
            : undefined;
      }

      const hasSignificantDelta =
        Math.abs(dx) >= MIN_DELTA_PX ||
        Math.abs(dy) >= MIN_DELTA_PX ||
        Math.abs(dScale - 1) >= MIN_DELTA_SCALE ||
        Math.abs(dR) >= MIN_DELTA_RAD;

      if (!hasSignificantDelta) {
        return;
      }

      let moveableState = createMoveableState({
        x: dx,
        y: dy,
        scale: dScale,
        r: dR,
      });
      moveableState = setTarget(moveableState, { x: 0, y: 0, scale: 1, r: 0 });
      if (shouldJuice) {
        const autoRot = (juiceStepCounter++ % 2 === 0 ? 1 : -1) * 0.085;
        moveableState = juiceUp(moveableState, 0.18, autoRot, false);
      }

      const liveFlight: ActiveLiveFlight = {
        kind: 'live',
        cardId,
        el: slotEl,
        baseFanY,
        baseFanDeg,
        delaySeconds,
        flightTempo,
        onLaunch,
        state: moveableState,
      };
      slotEl.dataset.flightActive = 'true';
      if (hideUntilLaunch) {
        slotEl.dataset.flightHidden = 'true';
        slotEl.style.opacity = '0';
      }
      applyLiveTransform(liveFlight);
      flights.push(liveFlight);
    });

    if (animateDepartures && flightLayer) {
      const layerRect = readRect(flightLayer);
      const effectiveLayerWidth = layerRect.width > 0 ? layerRect.width : 720;

      snapshot.cards.forEach((entry) => {
        if (currentCardIds.has(entry.cardId)) return;
        if (!entry.ghostNode || !isNonZeroRect(entry.rect)) return;

        const ghost = entry.ghostNode;
        const relLeft = entry.rect.left - layerRect.left;
        const relTop = entry.rect.top - layerRect.top;
        ghost.style.left = `${relLeft.toFixed(2)}px`;
        ghost.style.top = `${relTop.toFixed(2)}px`;
        ghost.style.width = `${entry.rect.width.toFixed(2)}px`;
        ghost.style.height = `${entry.rect.height.toFixed(2)}px`;
        flightLayer.append(ghost);

        const targetTransform = entry.shattered
          ? { x: 0, y: 24, scale: 0.35, r: entry.fanAngleRad - 0.35 }
          : {
              x: Math.max(220, effectiveLayerWidth - relLeft + 96),
              y: entry.zone === 'play' ? -90 : -45,
              scale: 0.7,
              r: 0.25,
            };

        let ghostState = createMoveableState({
          x: 0,
          y: 0,
          scale: 1,
          r: entry.fanAngleRad,
        });
        ghostState = setTarget(ghostState, targetTransform);

        const order = ghostOrder++;
        const ghostFlight: ActiveGhostFlight = {
          kind: 'ghost',
          cardId: entry.cardId,
          el: ghost,
          startDistance: Math.hypot(targetTransform.x, targetTransform.y),
          delaySeconds: (baseDepartDelay + order * 0.1) / activeSpeed,
          flightTempo: 1,
          onLaunch: onCardDepart ? () => onCardDepart(order, entry.zone) : undefined,
          state: ghostState,
        };
        applyGhostTransform(ghostFlight);
        flights.push(ghostFlight);
      });
    }

    if (flights.length > 0) {
      ensureLoopRunning();
    }

    return flights.length;
  };

  const pulseCard = (cardId: string, scaleDelta = 0.2, rotDelta = 0.08): boolean => {
    if (destroyed || prefersReducedMotion()) return false;
    const active = flights.find((f) => f.kind === 'live' && f.cardId === cardId);
    if (!active || active.kind !== 'live') return false;
    if (active.delaySeconds > 0) {
      active.delaySeconds = 0;
      delete active.el.dataset.flightHidden;
      active.el.style.opacity = '';
      active.onLaunch?.();
      active.onLaunch = undefined;
    }
    active.state = juiceUp(active.state, scaleDelta, rotDelta, false);
    applyLiveTransform(active);
    ensureLoopRunning();
    return true;
  };

  const triggerJuice = (target: HTMLElement | null, juiceOptions?: TriggerJuiceOptions): boolean => {
    if (destroyed || !target || !target.isConnected || prefersReducedMotion()) {
      return false;
    }

    const scaleDelta = juiceOptions?.scaleDelta ?? 0.24;
    const rotDelta =
      juiceOptions?.rotDelta !== undefined
        ? juiceOptions.rotDelta
        : (juiceStepCounter++ % 2 === 0 ? 1 : -1) * Math.max(0.055, scaleDelta * 0.35);

    if (flights.length === 0 || juiceOptions?.speed !== undefined) {
      activeSpeed = juiceOptions?.speed ?? getSpeed();
    }

    const existing = flights.find(
      (f): f is ActiveLiveFlight => f.kind === 'live' && f.el === target,
    );
    if (existing) {
      if (existing.delaySeconds > 0) {
        existing.delaySeconds = 0;
        delete existing.el.dataset.flightHidden;
        existing.el.style.opacity = '';
        existing.onLaunch?.();
        existing.onLaunch = undefined;
      }
      existing.state = juiceUp(existing.state, scaleDelta, rotDelta, false);
      target.dataset.flightActive = 'true';
      applyLiveTransform(existing);
      ensureLoopRunning();
      return true;
    }

    // Сохраняем базовый подъём подсвеченной карты в Play Zone, чтобы импульс не опускал её
    const baseFanY =
      target.classList.contains('play-zone__card') && target.classList.contains('is-highlighted')
        ? -6
        : parseFanOffsetY(target);
    const baseFanDeg = parseFanAngleDeg(target);

    const state = juiceUp(
      createMoveableState({ x: 0, y: 0, scale: 1, r: 0 }),
      scaleDelta,
      rotDelta,
      false,
    );
    const flight: ActiveLiveFlight = {
      kind: 'live',
      cardId: target.dataset.cardId ?? target.dataset.relicUid ?? target.dataset.ref ?? 'juice',
      el: target,
      baseFanY,
      baseFanDeg,
      delaySeconds: 0,
      flightTempo: 1,
      state,
    };

    target.dataset.flightActive = 'true';
    applyLiveTransform(flight);
    flights.push(flight);
    ensureLoopRunning();
    return true;
  };

  const setHoverZoom = (target: HTMLElement | null, hovered: boolean): boolean => {
    if (destroyed || !target || !target.isConnected || prefersReducedMotion()) {
      return false;
    }

    const existing = flights.find(
      (f): f is ActiveLiveFlight => f.kind === 'live' && f.el === target,
    );
    if (existing) {
      existing.state = setMoveableZoom(existing.state, { enabled: true, hover: hovered });
      target.dataset.flightActive = 'true';
      applyLiveTransform(existing);
      ensureLoopRunning();
      return true;
    }

    if (!hovered) {
      return false;
    }

    const baseFanY =
      target.classList.contains('play-zone__card') && target.classList.contains('is-highlighted')
        ? -6
        : parseFanOffsetY(target);
    const baseFanDeg = parseFanAngleDeg(target);
    const state = setMoveableZoom(
      createMoveableState({ x: 0, y: 0, scale: 1, r: 0 }),
      { enabled: true, hover: true, drag: false },
    );
    const flight: ActiveLiveFlight = {
      kind: 'live',
      cardId: target.dataset.cardId ?? target.dataset.relicUid ?? target.dataset.ref ?? 'hover',
      el: target,
      baseFanY,
      baseFanDeg,
      delaySeconds: 0,
      flightTempo: 1,
      state,
    };

    target.dataset.flightActive = 'true';
    applyLiveTransform(flight);
    flights.push(flight);
    ensureLoopRunning();
    return true;
  };

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    cancelAll();
  };

  return {
    captureSnapshot,
    animateFromSnapshot,
    pulseCard,
    triggerJuice,
    setHoverZoom,
    cancelAll,
    getActiveFlightCount: () =>
      flights.filter((flight) => !flight.state.settled || flight.delaySeconds > 0).length,
    destroy,
  };
}
