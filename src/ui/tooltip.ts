import './tooltip.css';

/**
 * Предпочитаемое направление размещения тултипа относительно целевого элемента.
 */
export type TooltipPlacement = 'auto' | 'top' | 'bottom' | 'left' | 'right';

/**
 * Допустимые визуальные тона бейджей тултипа.
 */
export type TooltipBadgeTone = 'default' | 'gold' | 'blue' | 'danger' | 'purple' | 'emerald';

/**
 * Семантическая категория бейджа (издание, чары, печать, редкость или статус).
 */
export type TooltipBadgeKind = 'edition' | 'enhancement' | 'seal' | 'rarity' | 'status' | 'kind';

/**
 * Описание одного бейджа модификатора или статуса внутри тултипа.
 */
export interface TooltipBadge {
  readonly label: string;
  readonly tone?: TooltipBadgeTone;
  readonly kind?: TooltipBadgeKind;
}

/**
 * Тип игровой сущности для стилизации рамки тултипа.
 */
export type TooltipEntityKind =
  | 'playing'
  | 'relic'
  | 'consumable'
  | 'charter'
  | 'pack'
  | 'boss'
  | 'blind'
  | 'tag'
  | 'shop'
  | 'hidden';

/**
 * Полезная нагрузка данных для отображения карточки-описания при наведении.
 */
export interface TooltipData {
  readonly title: string;
  readonly subtitle?: string;
  readonly rarity?: string;
  readonly price?: string;
  readonly description?: string;
  readonly badges?: readonly TooltipBadge[];
  readonly kind?: TooltipEntityKind;
  readonly placement?: TooltipPlacement;
  /** При значении 'back' ранг, масть и модификаторы принудительно скрываются */
  readonly facing?: 'front' | 'back';
  /** При значении true показывается только безопасный текст скрытия */
  readonly hidden?: boolean;
  /** Безопасный заголовок, показываемый для скрытой/перевёрнутой карты */
  readonly hiddenTitle?: string;
  /** Безопасное описание, показываемое для скрытой/перевёрнутой карты */
  readonly hiddenDescription?: string;
}

/**
 * Параметры инициализации глобального или контейнерного контроллера ховер-тултипов.
 */
export interface HoverTooltipOptions {
  /** Корневой контейнер делегирования событий (по умолчанию document.body) */
  readonly container?: HTMLElement;
  /** Родительский узел монтирования DOM-элемента тултипа (по умолчанию document.body) */
  readonly mountParent?: HTMLElement;
  /** Зазор в пикселях между целевым элементом и тултипом (по умолчанию 10) */
  readonly offset?: number;
  /** Минимальный отступ от краёв viewport в пикселях (по умолчанию 10) */
  readonly viewportPadding?: number;
  /** Безопасный заголовок по умолчанию при facing === 'back' */
  readonly defaultHiddenTitle?: string;
  /** Безопасное описание по умолчанию при facing === 'back' */
  readonly defaultHiddenDescription?: string;
  /** Пользовательский резолвер данных тултипа по DOM-элементу */
  readonly resolveTarget?: (element: HTMLElement) => TooltipData | null;
}

/**
 * Публичный интерфейс управления контроллером ховер-тултипов.
 */
export interface HoverTooltipController {
  readonly show: (target: HTMLElement, data?: TooltipData) => void;
  readonly hide: () => void;
  readonly updatePosition: () => void;
  readonly destroy: () => void;
  readonly isVisible: () => boolean;
  readonly getElement: () => HTMLElement;
}

/**
 * Нормализованная безопасная модель содержимого тултипа перед рендером в DOM.
 */
interface ResolvedTooltipContent {
  readonly title: string;
  readonly subtitle?: string;
  readonly rarity?: string;
  readonly price?: string;
  readonly description?: string;
  readonly badges: readonly TooltipBadge[];
  readonly kind?: TooltipEntityKind;
  readonly placement: TooltipPlacement;
  readonly isHidden: boolean;
}

type ConcretePlacement = 'top' | 'bottom' | 'left' | 'right';

const DEFAULT_OFFSET_PX = 10;
const DEFAULT_VIEWPORT_PADDING_PX = 12;
const FALLBACK_TOOLTIP_WIDTH_PX = 260;
const FALLBACK_TOOLTIP_HEIGHT_PX = 130;
const DEFAULT_HIDDEN_TITLE = 'Перевёрнута';
const DEFAULT_HIDDEN_DESCRIPTION = 'Скрыто способностью Босса';

const VALID_KINDS = new Set<TooltipEntityKind>([
  'playing',
  'relic',
  'consumable',
  'charter',
  'pack',
  'boss',
  'blind',
  'tag',
  'shop',
  'hidden',
]);

const VALID_PLACEMENTS = new Set<TooltipPlacement>(['auto', 'top', 'bottom', 'left', 'right']);

/**
 * Реестр привязки структурированных данных тултипа к DOM-элементам без утечек памяти.
 */
const tooltipRegistry = new WeakMap<HTMLElement, TooltipData>();

/**
 * Привязывает данные тултипа к конкретному DOM-элементу.
 */
export function setTooltipData(element: HTMLElement, data: TooltipData): void {
  tooltipRegistry.set(element, data);
}

/**
 * Возвращает привязанные к DOM-элементу данные тултипа, если они зарегистрированы.
 */
export function getTooltipData(element: HTMLElement): TooltipData | null {
  return tooltipRegistry.get(element) ?? null;
}

/**
 * Удаляет привязку данных тултипа с указанного DOM-элемента.
 */
export function clearTooltipData(element: HTMLElement): void {
  tooltipRegistry.delete(element);
}

/**
 * Ограничивает число заданным диапазоном [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * Проверяет медиазапрос точного указателя `(pointer: fine)` с защитой для сред без matchMedia.
 */
function matchesFinePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(pointer: fine)').matches;
}

/**
 * Определяет, относится ли событие к наведению указателя ПК (исключая touch).
 */
function isFinePointerHoverEvent(event: Event): boolean {
  const pointerType = (event as Partial<PointerEvent>).pointerType;
  if (pointerType === 'touch') {
    return false;
  }
  return pointerType === 'mouse' || matchesFinePointer();
}

/**
 * Безопасно разбирает массив бейджей из JSON-атрибута `data-tooltip-badges`.
 */
function parseBadgesAttribute(raw: string | undefined): TooltipBadge[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const result: TooltipBadge[] = [];
    for (const item of parsed) {
      if (typeof item === 'string' && item.trim().length > 0) {
        result.push({ label: item.trim() });
      } else if (item && typeof item === 'object' && 'label' in item) {
        const record = item as { label?: unknown; tone?: unknown; kind?: unknown };
        if (typeof record.label === 'string' && record.label.trim().length > 0) {
          result.push({
            label: record.label,
            tone: typeof record.tone === 'string' ? (record.tone as TooltipBadgeTone) : undefined,
            kind: typeof record.kind === 'string' ? (record.kind as TooltipBadgeKind) : undefined,
          });
        }
      }
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * Читает декларативные `data-tooltip-*` атрибуты элемента, если они заданы.
 */
function readDatasetTooltipData(element: HTMLElement): TooltipData | null {
  const { dataset } = element;
  const hasTitle = typeof dataset.tooltipTitle === 'string' && dataset.tooltipTitle.length > 0;
  const hasHiddenFlag =
    dataset.tooltipHidden === 'true' || dataset.tooltipFacing === 'back';

  if (!hasTitle && !hasHiddenFlag) {
    return null;
  }

  const rawKind = dataset.tooltipKind as TooltipEntityKind | undefined;
  const rawPlacement = dataset.tooltipPlacement as TooltipPlacement | undefined;

  return {
    title: dataset.tooltipTitle ?? '',
    subtitle: dataset.tooltipSubtitle,
    rarity: dataset.tooltipRarity,
    price: dataset.tooltipPrice,
    description: dataset.tooltipDescription,
    badges: parseBadgesAttribute(dataset.tooltipBadges),
    kind: rawKind && VALID_KINDS.has(rawKind) ? rawKind : undefined,
    placement: rawPlacement && VALID_PLACEMENTS.has(rawPlacement) ? rawPlacement : undefined,
    facing: dataset.tooltipFacing === 'back' ? 'back' : undefined,
    hidden: dataset.tooltipHidden === 'true',
    hiddenTitle: dataset.tooltipHiddenTitle,
    hiddenDescription: dataset.tooltipHiddenDescription ?? dataset.tooltipHiddenText,
  };
}

/**
 * Проверяет наличие признаков скрытой/перевёрнутой карты в DOM (включая вложенный card-frame).
 */
function hasDomHiddenCardMarker(element: HTMLElement): boolean {
  if (
    element.dataset.faceDown === 'true' ||
    element.dataset.tooltipHidden === 'true' ||
    element.dataset.tooltipFacing === 'back'
  ) {
    return true;
  }
  return element.querySelector('[data-face-down="true"]') !== null;
}

/**
 * Извлекает и санирует данные тултипа для элемента, гарантируя защиту инварианта скрытых карт.
 */
function resolveTooltipContent(
  element: HTMLElement,
  options: HoverTooltipOptions,
  explicitData?: TooltipData,
): ResolvedTooltipContent | null {
  const raw =
    explicitData ??
    getTooltipData(element) ??
    options.resolveTarget?.(element) ??
    readDatasetTooltipData(element);

  if (!raw) {
    return null;
  }

  const isHidden = raw.facing === 'back' || raw.hidden === true || hasDomHiddenCardMarker(element);
  const placement = raw.placement ?? 'auto';

  if (isHidden) {
    // При перевёрнутой карте ранг, масть и любые модификаторы принудительно исключаются
    return {
      title:
        raw.hiddenTitle ??
        element.dataset.tooltipHiddenTitle ??
        options.defaultHiddenTitle ??
        DEFAULT_HIDDEN_TITLE,
      description:
        raw.hiddenDescription ??
        element.dataset.tooltipHiddenDescription ??
        element.dataset.tooltipHiddenText ??
        options.defaultHiddenDescription ??
        DEFAULT_HIDDEN_DESCRIPTION,
      badges: [],
      kind: 'hidden',
      placement,
      isHidden: true,
    };
  }

  if (!raw.title && !raw.description) {
    return null;
  }

  return {
    title: raw.title,
    subtitle: raw.subtitle,
    rarity: raw.rarity,
    price: raw.price,
    description: raw.description,
    badges: raw.badges ?? [],
    kind: raw.kind,
    placement,
    isHidden: false,
  };
}

/**
 * Ищет ближайший вверх по дереву (до container) элемент, для которого задан тултип.
 */
function findClosestTooltipHost(
  startNode: EventTarget | null,
  container: HTMLElement,
  options: HoverTooltipOptions,
): { readonly element: HTMLElement; readonly content: ResolvedTooltipContent } | null {
  if (!(startNode instanceof Node)) {
    return null;
  }

  let current: HTMLElement | null =
    startNode instanceof HTMLElement ? startNode : startNode.parentElement;

  while (current) {
    const content = resolveTooltipContent(current, options);
    if (content) {
      return { element: current, content };
    }
    if (current === container) {
      break;
    }
    current = current.parentElement;
  }

  return null;
}

/**
 * Возвращает порядок проверки направлений с учётом предпочтительного placement.
 */
function getPlacementOrder(preferred: TooltipPlacement): readonly ConcretePlacement[] {
  switch (preferred) {
    case 'bottom':
      return ['bottom', 'top', 'right', 'left'];
    case 'left':
      return ['left', 'right', 'top', 'bottom'];
    case 'right':
      return ['right', 'left', 'top', 'bottom'];
    case 'top':
    case 'auto':
    default:
      return ['top', 'bottom', 'right', 'left'];
  }
}

/**
 * Проверяет, помещается ли тултип на выбранной стороне без выхода за границы viewport.
 */
function fitsPlacement(
  placement: ConcretePlacement,
  targetRect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  offset: number,
  padding: number,
): boolean {
  switch (placement) {
    case 'top':
      return targetRect.top - offset - tooltipHeight >= padding;
    case 'bottom':
      return targetRect.bottom + offset + tooltipHeight <= viewportHeight - padding;
    case 'left':
      return targetRect.left - offset - tooltipWidth >= padding;
    case 'right':
      return targetRect.right + offset + tooltipWidth <= viewportWidth - padding;
  }
}

/**
 * Оценивает доступное свободное пространство для стороны размещения в пикселях.
 */
function getPlacementAvailableSpace(
  placement: ConcretePlacement,
  targetRect: DOMRect,
  viewportWidth: number,
  viewportHeight: number,
  offset: number,
  padding: number,
): number {
  switch (placement) {
    case 'top':
      return targetRect.top - offset - padding;
    case 'bottom':
      return viewportHeight - padding - (targetRect.bottom + offset);
    case 'left':
      return targetRect.left - offset - padding;
    case 'right':
      return viewportWidth - padding - (targetRect.right + offset);
  }
}

/**
 * Вычисляет координаты (left, top) тултипа для заданной стороны с зажимом внутри viewport.
 */
function computeCoordinatesForPlacement(
  placement: ConcretePlacement,
  targetRect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  offset: number,
  padding: number,
): { readonly left: number; readonly top: number } {
  const maxLeft = Math.max(padding, viewportWidth - padding - tooltipWidth);
  const maxTop = Math.max(padding, viewportHeight - padding - tooltipHeight);

  switch (placement) {
    case 'top': {
      const centeredX = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      return {
        left: clamp(centeredX, padding, maxLeft),
        top: clamp(targetRect.top - offset - tooltipHeight, padding, maxTop),
      };
    }
    case 'bottom': {
      const centeredX = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      return {
        left: clamp(centeredX, padding, maxLeft),
        top: clamp(targetRect.bottom + offset, padding, maxTop),
      };
    }
    case 'left': {
      const centeredY = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      return {
        left: clamp(targetRect.left - offset - tooltipWidth, padding, maxLeft),
        top: clamp(centeredY, padding, maxTop),
      };
    }
    case 'right': {
      const centeredY = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      return {
        left: clamp(targetRect.right + offset, padding, maxLeft),
        top: clamp(centeredY, padding, maxTop),
      };
    }
  }
}

/**
 * Определяет итоговое размещение и координаты тултипа с автопереворотом внутри viewport.
 */
function calculateTooltipPosition(
  targetEl: HTMLElement,
  tooltipEl: HTMLElement,
  preferred: TooltipPlacement,
  offset: number,
  padding: number,
): { readonly placement: ConcretePlacement; readonly left: number; readonly top: number } {
  const targetRect = targetEl.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();
  const tooltipWidth =
    tooltipRect.width > 0
      ? tooltipRect.width
      : tooltipEl.offsetWidth > 0
        ? tooltipEl.offsetWidth
        : FALLBACK_TOOLTIP_WIDTH_PX;
  const tooltipHeight =
    tooltipRect.height > 0
      ? tooltipRect.height
      : tooltipEl.offsetHeight > 0
        ? tooltipEl.offsetHeight
        : FALLBACK_TOOLTIP_HEIGHT_PX;

  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth || 1280;
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight || 720;

  const order = getPlacementOrder(preferred);
  let chosen: ConcretePlacement = order[0];
  let foundFitting = false;

  for (const candidate of order) {
    if (
      fitsPlacement(
        candidate,
        targetRect,
        tooltipWidth,
        tooltipHeight,
        viewportWidth,
        viewportHeight,
        offset,
        padding,
      )
    ) {
      chosen = candidate;
      foundFitting = true;
      break;
    }
  }

  // Если крупный тултип не помещается целиком ни на одной стороне, выбираем сторону с наибольшим запасом места
  if (!foundFitting) {
    let bestSpace = -Infinity;
    for (const candidate of order) {
      const space = getPlacementAvailableSpace(
        candidate,
        targetRect,
        viewportWidth,
        viewportHeight,
        offset,
        padding,
      );
      if (space > bestSpace) {
        bestSpace = space;
        chosen = candidate;
      }
    }
  }

  const coords = computeCoordinatesForPlacement(
    chosen,
    targetRect,
    tooltipWidth,
    tooltipHeight,
    viewportWidth,
    viewportHeight,
    offset,
    padding,
  );

  return {
    placement: chosen,
    left: Math.round(coords.left),
    top: Math.round(coords.top),
  };
}

/**
 * Заполняет DOM-содержимое плавающей карточки тултипа по подготовленной модели.
 */
function renderTooltipContent(
  tooltipEl: HTMLElement,
  content: ResolvedTooltipContent,
): void {
  tooltipEl.replaceChildren();

  if (content.kind) {
    tooltipEl.dataset.kind = content.kind;
  } else {
    delete tooltipEl.dataset.kind;
  }

  if (content.isHidden) {
    tooltipEl.dataset.hidden = 'true';
  } else {
    delete tooltipEl.dataset.hidden;
  }

  const header = document.createElement('div');
  header.className = 'hover-tooltip__header';

  const titleRow = document.createElement('div');
  titleRow.className = 'hover-tooltip__title-row';

  const titleEl = document.createElement('h3');
  titleEl.className = 'hover-tooltip__title';
  titleEl.textContent = content.title;
  titleRow.appendChild(titleEl);

  if (content.price) {
    const priceEl = document.createElement('span');
    priceEl.className = 'hover-tooltip__price';
    priceEl.textContent = content.price;
    titleRow.appendChild(priceEl);
  }

  header.appendChild(titleRow);

  if (content.subtitle || content.rarity) {
    const metaEl = document.createElement('div');
    metaEl.className = 'hover-tooltip__meta';

    if (content.subtitle) {
      const subEl = document.createElement('span');
      subEl.className = 'hover-tooltip__subtitle';
      subEl.textContent = content.subtitle;
      metaEl.appendChild(subEl);
    }

    if (content.rarity) {
      const rarityEl = document.createElement('span');
      rarityEl.className = 'hover-tooltip__rarity';
      rarityEl.textContent = content.rarity;
      metaEl.appendChild(rarityEl);
    }

    header.appendChild(metaEl);
  }

  tooltipEl.appendChild(header);

  if (content.description) {
    const descEl = document.createElement('p');
    descEl.className = 'hover-tooltip__description';
    descEl.textContent = content.description;
    tooltipEl.appendChild(descEl);
  }

  if (content.badges.length > 0) {
    const badgesEl = document.createElement('div');
    badgesEl.className = 'hover-tooltip__badges';

    for (const badge of content.badges) {
      const badgeEl = document.createElement('span');
      badgeEl.className = 'hover-tooltip__badge';
      if (badge.tone && badge.tone !== 'default') {
        badgeEl.classList.add(`hover-tooltip__badge--${badge.tone}`);
      }
      if (badge.kind) {
        badgeEl.classList.add(`hover-tooltip__badge--${badge.kind}`);
      }
      badgeEl.textContent = badge.label;
      badgesEl.appendChild(badgeEl);
    }

    tooltipEl.appendChild(badgesEl);
  }
}

/**
 * Инициализирует контроллер мгновенных ховер-тултипов для ПК (`pointer: fine`).
 */
export function initHoverTooltip(options: HoverTooltipOptions = {}): HoverTooltipController {
  const container = options.container ?? document.body;
  const mountParent = options.mountParent ?? document.body;
  const offset = options.offset ?? DEFAULT_OFFSET_PX;
  const viewportPadding = options.viewportPadding ?? DEFAULT_VIEWPORT_PADDING_PX;

  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'hover-tooltip';
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.hidden = true;
  // Дублируем свойство в inline-стиле для гарантии непрозрачности кликов в любых окружениях
  tooltipEl.style.pointerEvents = 'none';
  mountParent.appendChild(tooltipEl);

  let activeTarget: HTMLElement | null = null;
  let activePlacement: TooltipPlacement = 'auto';
  let destroyed = false;

  const hide = (): void => {
    activeTarget = null;
    tooltipEl.hidden = true;
    delete tooltipEl.dataset.placement;
    delete tooltipEl.dataset.hidden;
  };

  const updatePosition = (): void => {
    if (destroyed || !activeTarget || !activeTarget.isConnected || tooltipEl.hidden) {
      if (activeTarget && !activeTarget.isConnected) {
        hide();
      }
      return;
    }

    const pos = calculateTooltipPosition(
      activeTarget,
      tooltipEl,
      activePlacement,
      offset,
      viewportPadding,
    );
    tooltipEl.dataset.placement = pos.placement;
    tooltipEl.style.left = `${pos.left}px`;
    tooltipEl.style.top = `${pos.top}px`;
  };

  const showWithContent = (target: HTMLElement, content: ResolvedTooltipContent): void => {
    if (destroyed || !target.isConnected) {
      return;
    }
    activeTarget = target;
    activePlacement = content.placement;
    renderTooltipContent(tooltipEl, content);
    tooltipEl.hidden = false;
    updatePosition();
  };

  const show = (target: HTMLElement, data?: TooltipData): void => {
    if (destroyed) {
      return;
    }
    const content = resolveTooltipContent(target, options, data);
    if (!content) {
      hide();
      return;
    }
    showWithContent(target, content);
  };

  const handlePointerOver = (event: Event): void => {
    if (destroyed) {
      return;
    }
    if (!isFinePointerHoverEvent(event)) {
      hide();
      return;
    }

    const found = findClosestTooltipHost(event.target, container, options);
    if (!found) {
      hide();
      return;
    }

    showWithContent(found.element, found.content);
  };

  const handlePointerOut = (event: Event): void => {
    if (!activeTarget) {
      return;
    }
    const related = (event as PointerEvent | MouseEvent).relatedTarget;
    if (related instanceof Node && activeTarget.contains(related)) {
      return;
    }
    hide();
  };

  const handleTouchLikeInteraction = (event: Event): void => {
    const pointerType = (event as Partial<PointerEvent>).pointerType;
    if (event.type === 'touchstart' || pointerType === 'touch') {
      hide();
    }
  };

  const handleViewportChange = (): void => {
    if (!tooltipEl.hidden) {
      hide();
    }
  };

  // При перерисовке DOM внутри container исчезающий целевой элемент сразу скрывает тултип
  const observer =
    typeof MutationObserver === 'function'
      ? new MutationObserver(() => {
          if (activeTarget && !activeTarget.isConnected) {
            hide();
          }
        })
      : null;

  observer?.observe(container, { childList: true, subtree: true });

  container.addEventListener('pointerover', handlePointerOver);
  container.addEventListener('pointerout', handlePointerOut);
  container.addEventListener('pointerleave', hide);
  container.addEventListener('pointerdown', handleTouchLikeInteraction);
  container.addEventListener('pointercancel', hide);
  container.addEventListener('touchstart', handleTouchLikeInteraction, { passive: true });
  window.addEventListener('scroll', handleViewportChange, true);
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('blur', handleViewportChange);

  const destroy = (): void => {
    if (destroyed) {
      return;
    }
    destroyed = true;
    hide();
    observer?.disconnect();
    container.removeEventListener('pointerover', handlePointerOver);
    container.removeEventListener('pointerout', handlePointerOut);
    container.removeEventListener('pointerleave', hide);
    container.removeEventListener('pointerdown', handleTouchLikeInteraction);
    container.removeEventListener('pointercancel', hide);
    container.removeEventListener('touchstart', handleTouchLikeInteraction);
    window.removeEventListener('scroll', handleViewportChange, true);
    window.removeEventListener('resize', handleViewportChange);
    window.removeEventListener('blur', handleViewportChange);
    tooltipEl.remove();
  };

  return {
    show,
    hide,
    updatePosition,
    destroy,
    isVisible: () => !destroyed && !tooltipEl.hidden && activeTarget !== null,
    getElement: () => tooltipEl,
  };
}
