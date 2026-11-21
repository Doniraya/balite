import './tutorialOverlay.css';
import type { BaliteAudioController } from '../audio/synth';
import tutArrowGoldUrl from '../assets/ui/tut-arrow-gold.webp';
import { getTooltipData } from './tooltip';
import {
  type CanonicalTutorialEmotion,
  normalizeTutorialEmotion,
  type TutorialArrowPosition,
  type TutorialEmotion,
  type TutorialPhase,
  type TutorialPlacement,
} from './tutorialSteps';

export type {
  CanonicalTutorialEmotion,
  TutorialArrowPosition,
  TutorialEmotion,
  TutorialPhase,
  TutorialPlacement,
};

/**
 * Ожидаемое от игрока действие для перехода к следующему шагу.
 */
export type TutorialAction =
  | 'next'
  | 'select_blind'
  | 'select_card'
  | 'play_hand'
  | 'discard'
  | 'buy_relic'
  | 'buy_consumable'
  | 'use_consumable'
  | 'leave_shop'
  | string;

/**
 * Описание одного шага интерактивного обучения.
 */
export interface TutorialStep {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly phase?: TutorialPhase;
  readonly targetSelector?: string;
  readonly arrowPosition?: TutorialArrowPosition;
  readonly placement?: TutorialPlacement;
  readonly speaker?: string;
  readonly emotion?: TutorialEmotion;
  readonly requireAction?: TutorialAction;
  readonly stepIndex?: number;
  readonly totalSteps?: number;
}

/**
 * Опции обратных вызовов для оверлея обучения.
 */
export interface TutorialOverlayOptions {
  readonly onNext: () => void;
  readonly onSkip: () => void;
  readonly onAction?: (action: string) => void;
  readonly container?: HTMLElement;
  readonly audio?: BaliteAudioController;
  readonly reducedMotion?: boolean | (() => boolean);
}

/**
 * Контроллер управления оверлеем обучения.
 */
export interface TutorialOverlayController {
  showStep(step: TutorialStep): void;
  hide(): void;
  setTarget(element: HTMLElement | null, arrowPosition?: string): void;
  destroy(): void;
  readonly isVisible: boolean;
  readonly currentStep: TutorialStep | null;
  readonly element: HTMLElement;
}

/**
 * Преобразует ключевое слово цвета в соответствующий CSS-класс подсветки.
 */
function getHighlightClass(colorName: string): string {
  const norm = colorName.toLowerCase().trim();
  switch (norm) {
    case 'blue':
    case 'chips':
      return 'tut-hl--blue';
    case 'red':
    case 'mult':
      return 'tut-hl--red';
    case 'money':
    case 'gold':
      return 'tut-hl--gold';
    case 'green':
      return 'tut-hl--green';
    case 'attention':
      return 'tut-hl--attention';
    case 'tarot':
      return 'tut-hl--tarot';
    case 'planet':
      return 'tut-hl--planet';
    case 'spectral':
      return 'tut-hl--spectral';
    case 'white':
      return 'tut-hl--white';
    case 'inactive':
      return 'tut-hl--inactive';
    default:
      return 'tut-hl--attention';
  }
}

/**
 * Форматирует текст подсказки с поддержкой разметки в стиле Balatro:
 * - `{C:blue}...{/C}` или `{C:blue}...{}` — подсветка цветом
 * - `{X:mult,C:white} X2 {}` — плашка множителя
 * - `{s:0.85}...{}` — масштабирование размера
 * - `\n` — перенос строки
 * Сырой текст экранируется от XSS перед наложением тегов.
 */
export function formatTutorialText(raw: string): string {
  if (!raw) return '';

  // 1. Экранирование спецсимволов HTML для безопасности
  let text = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // 2. Теги бейджей Balatro {X:mult,C:white} ... {} или {X:chips,C:white} ... {}
  text = text.replace(
    /\{X:([a-zA-Z0-9_]+),C:([a-zA-Z0-9_]+)\}([\s\S]*?)(?:\{\/X\}|\{\})/g,
    (_match, type, _color, content) => {
      const safeType = type.toLowerCase() === 'chips' ? 'chips' : 'mult';
      return `<span class="tut-badge tut-badge--${safeType}">${content}</span>`;
    },
  );

  // 3. Теги относительного масштаба {s:0.85} ... {}
  text = text.replace(
    /\{s:([0-9.]+)\}([\s\S]*?)(?:\{\/s\}|\{\})/g,
    (_match, scale, content) => {
      return `<span style="font-size:${scale}em">${content}</span>`;
    },
  );

  // 4. Теги цвета {C:blue} ... {/C} или {C:blue} ... {}
  text = text.replace(
    /\{C:([a-zA-Z0-9_]+)\}([\s\S]*?)(?:\{\/C\}|\{\})/g,
    (_match, color, content) => {
      const cls = getHighlightClass(color);
      return `<span class="tut-hl ${cls}">${content}</span>`;
    },
  );

  // 5. Переносы строк
  text = text.replace(/\n/g, '<br>');

  return text;
}

const devSpeakerAvatarRenderers = new Map<string, () => string>();

/**
 * Регистрирует DEV-рендерер альтернативного спикера обучения (исключается из prod-сборки).
 */
export function registerTutorialSpeakerAvatar(speaker: string, renderFn: () => string): void {
  if (!import.meta.env.DEV) return;
  devSpeakerAvatarRenderers.set(speaker, renderFn);
}

if (import.meta.env.DEV) {
  void import('./tutorialDevOverlay').then((mod) => {
    registerTutorialSpeakerAvatar(mod.DEV_TUTORIAL_SPEAKER, mod.renderJimboAvatar);
  });
}

/**
 * Возвращает имя файла спрайта Миры в соответствии с переданной эмоцией.
 * Поддерживает как 8 новых эмоций (welcome, guide_cards, guide_book, guide_point, guide, happy, worried, idle),
 * так и обратную совместимость со старыми ключами (neutral, thinking, warning).
 */
export function resolveMiraSprite(emotion: TutorialEmotion = 'idle'): string {
  const normalized = normalizeTutorialEmotion(emotion);
  return `mira_${normalized}`;
}

/**
 * Отрисовывает аватар персонажа обучения:
 * - Для Миры возвращает <img> спрайт чиби-маскота (webp с fallback на png по onerror).
 * - В DEV-режиме для альтернативного спикера использует зарегистрированный векторный рендерер.
 */
export function renderMiraAvatar(
  emotion: TutorialEmotion = 'idle',
  speaker: string = 'Мира',
): string {
  if (import.meta.env.DEV && speaker !== 'Мира') {
    const customRenderer = devSpeakerAvatarRenderers.get(speaker);
    if (customRenderer) {
      return customRenderer();
    }
    return `<svg viewBox="0 0 64 64" width="100%" height="100%" shape-rendering="crispEdges" aria-label="${speaker}"><rect x="12" y="6" width="40" height="52" rx="4" fill="#ffffff" stroke="#c0392b" stroke-width="2"/></svg>`;
  }

  const spriteName = resolveMiraSprite(emotion);
  const webpSrc = `./sprites/mira/${spriteName}.webp`;
  const pngSrc = `./sprites/mira/${spriteName}.png`;
  const altText = `${speaker} (${emotion})`;

  return `<img src="${webpSrc}" alt="${altText}" class="tut-avatar-img" draggable="false" onerror="this.onerror=null;this.src='${pngSrc}';" />`;
}

/**
 * Создаёт пиксельную иконку стрелки-указателя.
 */
function renderArrowSvg(): string {
  return `<img src="${tutArrowGoldUrl}" class="tut-arrow__img" alt="" draggable="false" />`;
}

/**
 * Фабрика компонента Tutorial Overlay: создаёт оверлей, монтирует его в DOM
 * и возвращает контроллер управления.
 */
export function createTutorialOverlay(options: TutorialOverlayOptions): TutorialOverlayController {
  let isVisible = false;
  let currentStep: TutorialStep | null = null;
  let currentTargetElement: HTMLElement | null = null;
  let currentArrowPosition: TutorialArrowPosition = 'none';
  let revealTimers: Array<ReturnType<typeof setTimeout>> = [];
  let isRevealComplete = true;

  const isReducedMotion = (): boolean => {
    if (typeof options.reducedMotion === 'function') {
      return options.reducedMotion();
    }
    if (typeof options.reducedMotion === 'boolean') {
      return options.reducedMotion;
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  };

  const clearRevealTimers = (): void => {
    for (const timerId of revealTimers) {
      globalThis.clearTimeout(timerId);
    }
    revealTimers = [];
  };

  const completeTextReveal = (): void => {
    clearRevealTimers();
    isRevealComplete = true;
    textEl.classList.add('is-reveal-complete');
    textEl.classList.remove('is-revealing');
  };

  const computeCharRevealStepMs = (charCount: number): number => {
    if (charCount <= 135) {
      return 16;
    }
    // Для длинных реплик (150–250+ символов) плавно ускоряем шаг, сохраняя посимвольную печать до конца (~2.2–2.8 с)
    const targetSpanMs = Math.min(2700, 2160 + (charCount - 135) * 4);
    return Number((targetSpanMs / charCount).toFixed(2));
  };

  /**
   * Оборачивает текстовые узлы внутри отформатированной реплики в посимвольные
   * DynaText-спаны, сохраняя целостность слов при переносах и все цветовые обёртки.
   */
  const applyDynaTextReveal = (rootEl: HTMLElement): { readonly charCount: number; readonly stepMs: number } => {
    let charIndex = 0;

    const walk = (node: Node): void => {
      if (node.nodeType === 3) {
        const raw = node.textContent ?? '';
        if (!raw) return;
        const frag = document.createDocumentFragment();
        const tokens = raw.split(/(\s+)/);
        for (const token of tokens) {
          if (!token) continue;
          if (/^\s+$/.test(token)) {
            frag.appendChild(document.createTextNode(token));
            continue;
          }
          const wordSpan = document.createElement('span');
          wordSpan.className = 'tut-word';
          for (const ch of token) {
            const chSpan = document.createElement('span');
            chSpan.className = 'tut-char';
            chSpan.style.setProperty('--char-i', String(charIndex));
            chSpan.textContent = ch;
            wordSpan.appendChild(chSpan);
            charIndex += 1;
          }
          frag.appendChild(wordSpan);
        }
        node.parentNode?.replaceChild(frag, node);
        return;
      }
      if (node.nodeType === 1) {
        const el = node as HTMLElement;
        if (el.classList.contains('tut-hl') || el.classList.contains('tut-badge')) {
          // Плашка/рамка синхронизируется по задержке со своим первым видимым символом
          el.style.setProperty('--char-i', String(charIndex));
        }
        const children = Array.from(node.childNodes);
        for (const child of children) {
          walk(child);
        }
      }
    };

    walk(rootEl);
    const stepMs = computeCharRevealStepMs(charIndex);
    rootEl.style.setProperty('--char-step-ms', `${stepMs}ms`);
    return { charCount: charIndex, stepMs };
  };

  const scheduleDialogueChatter = (charCount: number, stepMs: number): void => {
    clearRevealTimers();
    if (charCount <= 0) {
      completeTextReveal();
      return;
    }

    const revealSpanMs = Math.max(0, (charCount - 1) * stepMs);

    if (charCount > 4 && options.audio) {
      // Равномерные посимвольные слоги речи на всю длительность печати без раннего обрыва
      const syllableIntervalMs = Math.max(68, Math.min(88, Math.round(stepMs * 5)));
      const syllableCount = Math.max(1, Math.floor(revealSpanMs / syllableIntervalMs));
      for (let i = 1; i <= syllableCount; i += 1) {
        const progress = i / Math.max(1, syllableCount);
        const pitchRate = 0.9 + Math.sin(progress * Math.PI) * 0.12 + progress * 0.1;
        const delayMs = Math.round(i * syllableIntervalMs);
        if (delayMs > revealSpanMs) break;
        const timerId = globalThis.setTimeout(() => {
          if (!isVisible || isRevealComplete) return;
          options.audio?.playDialogue(pitchRate);
        }, delayMs);
        revealTimers.push(timerId);
      }
    }

    // Завершаем печать строго после окончания CSS-анимации последнего символа и плашки (160ms + 40ms запас)
    const totalMs = Math.ceil(revealSpanMs + 200);
    const doneTimer = globalThis.setTimeout(() => {
      completeTextReveal();
    }, totalMs);
    revealTimers.push(doneTimer);
  };

  const handleSpeechBubbleClick = (event: MouseEvent): void => {
    if (!isVisible || isRevealComplete) return;
    event.stopPropagation();
    completeTextReveal();
  };

  // Создаем корневой элемент оверлея
  const overlayEl = document.createElement('div');
  overlayEl.className = 'tut-overlay';
  overlayEl.setAttribute('role', 'dialog');
  overlayEl.setAttribute('aria-modal', 'true');
  overlayEl.setAttribute('aria-labelledby', 'tut-step-title');

  // Полупрозрачная вуаль затемнения (БЕЗ размытия/blur)
  const backdropEl = document.createElement('div');
  backdropEl.className = 'tut-backdrop';
  backdropEl.setAttribute('aria-hidden', 'true');
  overlayEl.appendChild(backdropEl);

  // Спотлайт-вырез вокруг элемента (чистый вырез без размытия, 100% резкий и яркий)
  const spotlightEl = document.createElement('div');
  spotlightEl.className = 'tut-spotlight';
  spotlightEl.setAttribute('aria-hidden', 'true');
  overlayEl.appendChild(spotlightEl);

  // Блокировщик кликов с вырезом
  const blockerEl = document.createElement('div');
  blockerEl.className = 'tut-click-blocker';
  overlayEl.appendChild(blockerEl);

  // Прыгающая стрелка
  const arrowEl = document.createElement('div');
  arrowEl.className = 'tut-arrow';
  arrowEl.setAttribute('aria-hidden', 'true');
  arrowEl.innerHTML = renderArrowSvg();
  overlayEl.appendChild(arrowEl);

  // Кнопка быстрого пропуска в верхнем правом углу (в стиле Balatro)
  const topSkipBtn = document.createElement('button');
  topSkipBtn.type = 'button';
  topSkipBtn.className = 'tut-skip-top-btn';
  topSkipBtn.setAttribute('aria-label', 'Пропустить обучение');
  topSkipBtn.innerHTML = `<span>Пропуск</span><span class="tut-skip-icon">&gt;</span>`;
  overlayEl.appendChild(topSkipBtn);

  // Плавающий кластер обучения (Речевое облачко Balatro + свободная Мира + кнопка «Дальше»)
  const cardEl = document.createElement('div');
  cardEl.className = 'tut-card tut-floating-cluster';

  // 1. ВВЕРХУ: Белое речевое облачко в стиле Balatro
  const speechBubbleEl = document.createElement('div');
  speechBubbleEl.className = 'tut-speech-bubble';
  speechBubbleEl.setAttribute('role', 'region');
  speechBubbleEl.setAttribute('aria-live', 'polite');

  // Мета-строка шапки: счётчик и спикер
  const bubbleMetaEl = document.createElement('div');
  bubbleMetaEl.className = 'tut-bubble-meta tut-header-meta';

  const stepCounterEl = document.createElement('div');
  stepCounterEl.className = 'tut-step-counter';
  bubbleMetaEl.appendChild(stepCounterEl);

  const avatarNameEl = document.createElement('div');
  avatarNameEl.className = 'tut-avatar-name';
  avatarNameEl.textContent = 'Мира';
  bubbleMetaEl.appendChild(avatarNameEl);

  speechBubbleEl.appendChild(bubbleMetaEl);

  // Заголовок шага
  const stepTitleEl = document.createElement('h3');
  stepTitleEl.id = 'tut-step-title';
  stepTitleEl.className = 'tut-step-title';
  speechBubbleEl.appendChild(stepTitleEl);

  // Текстовое тело подсказки
  const cardBodyEl = document.createElement('div');
  cardBodyEl.className = 'tut-card-body';

  const textEl = document.createElement('div');
  textEl.className = 'tut-text';
  cardBodyEl.appendChild(textEl);
  speechBubbleEl.appendChild(cardBodyEl);

  // Указательный хвостик облачка речи вниз к Мире
  const bubbleTailEl = document.createElement('div');
  bubbleTailEl.className = 'tut-speech-tail';
  bubbleTailEl.setAttribute('aria-hidden', 'true');
  speechBubbleEl.appendChild(bubbleTailEl);

  cardEl.appendChild(speechBubbleEl);

  // 2. В СЕРЕДИНЕ: Свободно парящая Мира с летающими частицами конфетти
  const mascotStageEl = document.createElement('div');
  mascotStageEl.className = 'tut-mascot-stage';

  // Разноцветные частицы конфетти вокруг маскота
  const confettiContainerEl = document.createElement('div');
  confettiContainerEl.className = 'tut-confetti-container';
  confettiContainerEl.setAttribute('aria-hidden', 'true');

  const confettiFlakeClasses = [
    'cyan tut-flake--1',
    'orange tut-flake--2',
    'gold tut-flake--3',
    'red tut-flake--4',
    'cyan tut-flake--5',
    'orange tut-flake--6',
    'gold tut-flake--7',
    'red tut-flake--8',
    'gold tut-flake--9',
    'cyan tut-flake--10',
  ];
  for (const flakeCls of confettiFlakeClasses) {
    const flakeEl = document.createElement('span');
    flakeEl.className = `tut-flake tut-flake--${flakeCls}`;
    confettiContainerEl.appendChild(flakeEl);
  }
  mascotStageEl.appendChild(confettiContainerEl);

  // Контейнер маскота без рамок и заточения в коробку
  const avatarFrameEl = document.createElement('div');
  avatarFrameEl.className = 'tut-avatar-frame tut-mascot-figure';
  avatarFrameEl.innerHTML = renderMiraAvatar('neutral');
  mascotStageEl.appendChild(avatarFrameEl);

  cardEl.appendChild(mascotStageEl);

  // 3. СНИЗУ: Заметная обособленная красная кнопка «Дальше» в стиле Balatro
  const cardFooterEl = document.createElement('div');
  cardFooterEl.className = 'tut-card-footer tut-actions';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'tut-btn tut-btn--next';
  nextBtn.textContent = 'Дальше';
  cardFooterEl.appendChild(nextBtn);

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'tut-btn tut-btn--skip';
  skipBtn.textContent = 'Пропустить';
  cardFooterEl.appendChild(skipBtn);

  cardEl.appendChild(cardFooterEl);
  overlayEl.appendChild(cardEl);

  // Монтируем в контейнер или body
  const targetContainer = options.container ?? document.body;
  targetContainer.appendChild(overlayEl);

  /**
   * Обновляет координаты спотлайта, стрелки и плавающего кластера Миры.
   */
  function updatePositions(): void {
    if (!currentTargetElement || !currentTargetElement.isConnected) {
      spotlightEl.style.display = 'none';
      arrowEl.style.display = 'none';
      blockerEl.style.clipPath = 'none';
      backdropEl.style.opacity = '1';

      // Если задано смещение влево на десктопе, освобождаем центр стола
      if (currentStep?.placement === 'left' && window.innerWidth >= 860) {
        cardEl.style.top = '50%';
        cardEl.style.left = 'clamp(16px, 12vw, 200px)';
        cardEl.style.bottom = 'auto';
        cardEl.style.right = 'auto';
        cardEl.style.transform = 'translateY(-50%)';
      } else {
        // Центрируем диалог по экрану
        cardEl.style.top = '50%';
        cardEl.style.left = '50%';
        cardEl.style.bottom = 'auto';
        cardEl.style.right = 'auto';
        cardEl.style.transform = 'translate(-50%, -50%)';
      }
      return;
    }

    const rect = currentTargetElement.getBoundingClientRect();
    const padding = 6;
    const spotlightTop = Math.max(0, rect.top - padding);
    const spotlightLeft = Math.max(0, rect.left - padding);
    const spotlightWidth = rect.width + padding * 2;
    const spotlightHeight = rect.height + padding * 2;

    spotlightEl.style.display = 'block';
    backdropEl.style.opacity = '0'; // Спотлайт сам формирует темную вуаль без двойного затемнения
    spotlightEl.style.top = `${spotlightTop}px`;
    spotlightEl.style.left = `${spotlightLeft}px`;
    spotlightEl.style.width = `${spotlightWidth}px`;
    spotlightEl.style.height = `${spotlightHeight}px`;

    // Если ожидается интерактивное действие игрока (например, клик по карте или блайнду),
    // накладываем clip-path вырез на блокировщик кликов, чтобы клики попадали точно в элемент
    const isInteractiveAction =
      Boolean(currentStep?.requireAction) && currentStep?.requireAction !== 'next';

    if (isInteractiveAction) {
      const t = spotlightTop;
      const l = spotlightLeft;
      const r = spotlightLeft + spotlightWidth;
      const b = spotlightTop + spotlightHeight;
      blockerEl.style.clipPath = `polygon(0% 0%, 0% 100%, ${l}px 100%, ${l}px ${t}px, ${r}px ${t}px, ${r}px ${b}px, ${l}px ${b}px, ${l}px 100%, 100% 100%, 100% 0%)`;
    } else {
      blockerEl.style.clipPath = 'none';
    }

    // Позиционирование стрелки
    const arrowPos = currentArrowPosition;
    if (!arrowPos || arrowPos === 'none') {
      arrowEl.style.display = 'none';
    } else {
      arrowEl.style.display = 'block';
      arrowEl.className = `tut-arrow tut-arrow--${arrowPos}`;
      const arrowSize = 36;
      let arrowTop = 0;
      let arrowLeft = 0;

      switch (arrowPos) {
        case 'top':
          arrowTop = spotlightTop - arrowSize - 8;
          arrowLeft = spotlightLeft + spotlightWidth / 2 - arrowSize / 2;
          break;
        case 'bottom':
          arrowTop = spotlightTop + spotlightHeight + 8;
          arrowLeft = spotlightLeft + spotlightWidth / 2 - arrowSize / 2;
          break;
        case 'left':
          arrowTop = spotlightTop + spotlightHeight / 2 - arrowSize / 2;
          arrowLeft = spotlightLeft - arrowSize - 8;
          break;
        case 'right':
          arrowTop = spotlightTop + spotlightHeight / 2 - arrowSize / 2;
          arrowLeft = spotlightLeft + spotlightWidth + 8;
          break;
      }

      // Не выпускаем стрелку за пределы видимой области экрана
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      arrowLeft = Math.max(8, Math.min(vw - arrowSize - 8, arrowLeft));
      arrowTop = Math.max(8, Math.min(vh - arrowSize - 8, arrowTop));

      arrowEl.style.top = `${arrowTop}px`;
      arrowEl.style.left = `${arrowLeft}px`;
    }

    // Умное динамическое позиционирование кластера Миры:
    // Кластер размещается рядом с целевым элементом, ни в коем случае не закрывая его.
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const targetCenterY = rect.top + rect.height / 2;

    // Сброс горизонтальных и вертикальных координат
    cardEl.style.right = 'auto';

    const placement = currentStep?.placement ?? 'auto';

    if (vw >= 860) {
      // НА ДЕСКТОПЕ:
      if (
        placement === 'left' ||
        (placement === 'auto' &&
          (currentStep?.phase === 'cashout' || currentStep?.phase === 'shop'))
      ) {
        // Размещаем кластер на левой стороне над панелью очков/HUD, чтобы центр стола был абсолютно свободен
        cardEl.style.left = 'clamp(16px, 12vw, 220px)';
        cardEl.style.top = '50%';
        cardEl.style.bottom = 'auto';
        cardEl.style.transform = 'translateY(-50%)';
      } else if (placement === 'top-left') {
        // Размещаем кластер в верхнем левом углу над панелью очков, не перекрывая веер карт внизу
        cardEl.style.left = 'clamp(16px, 12vw, 220px)';
        cardEl.style.top = 'clamp(12px, 2.5vh, 32px)';
        cardEl.style.bottom = 'auto';
        cardEl.style.transform = 'none';
      } else if (placement === 'center') {
        cardEl.style.left = '50%';
        cardEl.style.top = '50%';
        cardEl.style.bottom = 'auto';
        cardEl.style.transform = 'translate(-50%, -50%)';
      } else if (rect.right < vw * 0.38) {
        // Целевой элемент в левой колонке HUD -> кластер размещается правее в столе
        cardEl.style.left = 'clamp(360px, 48vw, 680px)';
        cardEl.style.top = '50%';
        cardEl.style.bottom = 'auto';
        cardEl.style.transform = 'translateY(-50%)';
      } else if (targetCenterY > vh * 0.48) {
        // Целевой элемент в нижней половине экрана -> кластер вверху слева
        cardEl.style.top = 'clamp(12px, 2.5vh, 32px)';
        cardEl.style.bottom = 'auto';
        cardEl.style.left = 'clamp(16px, 12vw, 220px)';
        cardEl.style.transform = 'none';
      } else {
        // Элемент в верхней половине экрана -> кластер внизу слева
        cardEl.style.top = 'auto';
        cardEl.style.bottom = 'clamp(14px, 3vh, 36px)';
        cardEl.style.left = 'clamp(16px, 12vw, 220px)';
        cardEl.style.transform = 'none';
      }
    } else {
      // НА МОБИЛЬНОМ (ПОРТРЕТ 720×1280):
      if (placement === 'center') {
        cardEl.style.left = '50%';
        cardEl.style.top = '50%';
        cardEl.style.bottom = 'auto';
        cardEl.style.transform = 'translate(-50%, -50%)';
      } else if (targetCenterY > vh * 0.48) {
        // Элемент находится в нижней половине экрана -> кластер размещается вверху
        cardEl.style.top = 'clamp(14px, 3vh, 36px)';
        cardEl.style.bottom = 'auto';
        cardEl.style.left = '50%';
        cardEl.style.transform = 'translateX(-50%)';
      } else {
        // Элемент в верхней половине экрана -> кластер размещается внизу
        cardEl.style.top = 'auto';
        cardEl.style.bottom = 'clamp(14px, 3vh, 36px)';
        cardEl.style.left = '50%';
        cardEl.style.transform = 'translateX(-50%)';
      }
    }
  }

  let lastHoveredElement: HTMLElement | null = null;

  function clearHoveredElement(): void {
    if (lastHoveredElement) {
      lastHoveredElement.classList.remove('tut-hovered');
      lastHoveredElement.dispatchEvent(
        new PointerEvent('pointerout', {
          bubbles: true,
          cancelable: true,
          pointerType: 'mouse',
        }),
      );
      lastHoveredElement = null;
    }
    blockerEl.style.cursor = 'default';
  }

  function handlePointerMove(e: PointerEvent): void {
    if (!isVisible) return;
    if (e.pointerType === 'touch') return;

    // Если курсор находится над плавающим кластером Миры или кнопками оверлея
    const targetNode = e.target;
    if (
      targetNode instanceof Node &&
      (cardEl.contains(targetNode) || topSkipBtn.contains(targetNode))
    ) {
      clearHoveredElement();
      return;
    }

    if (typeof document.elementsFromPoint !== 'function') {
      return;
    }

    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    let gameTarget: HTMLElement | null = null;
    for (const el of elements) {
      if (el instanceof HTMLElement && !overlayEl.contains(el)) {
        gameTarget = el;
        break;
      }
    }

    if (!gameTarget) {
      clearHoveredElement();
      return;
    }

    // Ищем хост тултипа или интерактивный элемент
    let hostEl: HTMLElement | null = null;
    let curr: HTMLElement | null = gameTarget;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      if (
        getTooltipData(curr) ||
        curr.dataset.tooltipTitle ||
        curr.dataset.tooltipHidden === 'true' ||
        curr.dataset.faceDown === 'true' ||
        curr.classList.contains('hand-card-slot') ||
        curr.classList.contains('interactive-slot') ||
        curr.classList.contains('card-frame') ||
        curr.classList.contains('shop-slot-btn') ||
        curr.classList.contains('blind-card') ||
        curr.classList.contains('sidebar-card') ||
        curr.tagName === 'BUTTON'
      ) {
        hostEl = curr;
        break;
      }
      curr = curr.parentElement;
    }

    if (!hostEl) {
      hostEl = gameTarget;
    }

    if (hostEl === lastHoveredElement) {
      return;
    }

    // Смена хоста
    if (lastHoveredElement) {
      lastHoveredElement.classList.remove('tut-hovered');
      lastHoveredElement.dispatchEvent(
        new PointerEvent('pointerout', {
          bubbles: true,
          cancelable: true,
          clientX: e.clientX,
          clientY: e.clientY,
          pointerType: 'mouse',
        }),
      );
    }

    lastHoveredElement = hostEl;
    lastHoveredElement.classList.add('tut-hovered');

    // Диспатчим pointerover для tooltip.ts
    lastHoveredElement.dispatchEvent(
      new PointerEvent('pointerover', {
        bubbles: true,
        cancelable: true,
        clientX: e.clientX,
        clientY: e.clientY,
        pointerType: 'mouse',
      }),
    );

    // Курсор: если элемент интерактивен, ставим pointer на блокировщике
    const isInteractive =
      hostEl.tagName === 'BUTTON' ||
      hostEl.classList.contains('hand-card-slot') ||
      hostEl.classList.contains('card-frame') ||
      hostEl.classList.contains('shop-slot-btn') ||
      hostEl.classList.contains('blind-card') ||
      hostEl.getAttribute('role') === 'button';

    blockerEl.style.cursor = isInteractive ? 'pointer' : 'default';
  }

  // Обработчики событий
  function handleNextClick(e?: Event): void {
    e?.stopPropagation();
    options.onNext();
  }

  function handleSkipClick(e?: Event): void {
    e?.stopPropagation();
    options.onSkip();
  }

  function handleBlockerClick(e?: MouseEvent): void {
    // Если клик с мыши и под курсором есть игровой интерактивный элемент:
    if (
      e &&
      typeof e.clientX === 'number' &&
      typeof e.clientY === 'number' &&
      (e.clientX > 0 || e.clientY > 0) &&
      typeof document.elementsFromPoint === 'function'
    ) {
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      let gameTarget: HTMLElement | null = null;
      for (const el of elements) {
        if (el instanceof HTMLElement && !overlayEl.contains(el)) {
          gameTarget = el;
          break;
        }
      }

      if (gameTarget) {
        const interactive = gameTarget.closest<HTMLElement>(
          'button, .hand-card-slot, .card-frame, .shop-slot-btn, .blind-card, [role="button"]',
        );
        if (interactive) {
          interactive.click();
          return;
        }
      }
    }

    // Если на шаге просто информационный показ без жесткого действия — клик по оверлею продолжает обучение
    if (!currentStep?.requireAction || currentStep.requireAction === 'next') {
      options.onNext();
    } else {
      // При интерактивном действии клик вне цели дает мягкую тактильную подсказку
      options.onAction?.('outside_click');
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!isVisible) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      options.onSkip();
    } else if (event.key === 'Enter' || event.key === ' ') {
      // Если фокус не находится на кнопке пропуска и нет активного поля ввода
      const activeEl = document.activeElement;
      if (activeEl === skipBtn || activeEl === topSkipBtn) {
        return;
      }
      if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA') {
        return;
      }

      if (!currentStep?.requireAction || currentStep.requireAction === 'next') {
        event.preventDefault();
        options.onNext();
      }
    }
  }

  function handleWindowResize(): void {
    if (isVisible) {
      updatePositions();
    }
  }

  nextBtn.addEventListener('click', handleNextClick);
  skipBtn.addEventListener('click', handleSkipClick);
  topSkipBtn.addEventListener('click', handleSkipClick);
  speechBubbleEl.addEventListener('click', handleSpeechBubbleClick);
  blockerEl.addEventListener('click', handleBlockerClick);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', handleWindowResize);
  window.addEventListener('scroll', handleWindowResize, true);
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('pointerleave', clearHoveredElement);
  window.addEventListener('blur', clearHoveredElement);

  /**
   * Контроллер управления оверлеем
   */
  const controller: TutorialOverlayController = {
    get isVisible(): boolean {
      return isVisible;
    },

    get currentStep(): TutorialStep | null {
      return currentStep;
    },

    get element(): HTMLElement {
      return overlayEl;
    },

    showStep(step: TutorialStep): void {
      const isNewStep = step.id !== currentStep?.id || step.text !== currentStep?.text;
      if (isNewStep) {
        clearRevealTimers();
        options.audio?.playDialogue(0.86);
      }
      currentStep = step;

      // 1. Обновляем спикера и эмоцию
      const speaker = step.speaker ?? 'Мира';
      const emotion = step.emotion ?? 'neutral';
      avatarFrameEl.innerHTML = renderMiraAvatar(emotion, speaker);
      avatarNameEl.textContent = speaker;

      // 2. Счётчик шагов
      if (step.stepIndex !== undefined) {
        stepCounterEl.textContent = step.totalSteps
          ? `Шаг ${step.stepIndex} из ${step.totalSteps}`
          : `Шаг ${step.stepIndex}`;
        stepCounterEl.style.display = 'block';
      } else {
        stepCounterEl.style.display = 'none';
      }

      // 3. Заголовок
      stepTitleEl.textContent = step.title;

      // 4. Текст с подсветкой терминов и посимвольным появлением (DynaText)
      textEl.innerHTML = formatTutorialText(step.text);
      if (isNewStep && !isReducedMotion()) {
        const { charCount, stepMs } = applyDynaTextReveal(textEl);
        isRevealComplete = false;
        textEl.classList.remove('is-reveal-complete');
        textEl.classList.add('is-revealing');
        scheduleDialogueChatter(charCount, stepMs);
      } else {
        completeTextReveal();
      }

      // 5. Кнопка «Дальше» или подсказка о действии
      const isLastStep =
        step.stepIndex !== undefined &&
        step.totalSteps !== undefined &&
        step.stepIndex >= step.totalSteps;

      const hasAction = Boolean(step.requireAction) && step.requireAction !== 'next';

      if (hasAction) {
        nextBtn.className = 'tut-btn tut-btn--next tut-btn--action-hint';
        nextBtn.innerHTML = `<span class="tut-action-pulse-dot"></span><span>Выполните действие</span>`;
      } else {
        nextBtn.className = 'tut-btn tut-btn--next';
        nextBtn.textContent = isLastStep ? 'Завершить' : 'Дальше';
      }

      // 6. Поиск целевого элемента по селектору
      let targetEl: HTMLElement | null = null;
      if (step.targetSelector) {
        targetEl = document.querySelector<HTMLElement>(step.targetSelector);
      }

      currentTargetElement = targetEl;
      currentArrowPosition = step.arrowPosition ?? (targetEl ? 'bottom' : 'none');

      // 7. Показываем оверлей и обновляем геометрию
      isVisible = true;
      overlayEl.classList.add('is-visible');
      updatePositions();
    },

    hide(): void {
      isVisible = false;
      completeTextReveal();
      clearHoveredElement();
      overlayEl.classList.remove('is-visible');
      currentTargetElement = null;
      currentArrowPosition = 'none';
      spotlightEl.style.display = 'none';
      arrowEl.style.display = 'none';
      blockerEl.style.clipPath = 'none';
      backdropEl.style.opacity = '0';
    },

    setTarget(element: HTMLElement | null, arrowPosition?: string): void {
      currentTargetElement = element;
      if (arrowPosition !== undefined) {
        currentArrowPosition = arrowPosition as TutorialArrowPosition;
      }
      updatePositions();
    },

    destroy(): void {
      isVisible = false;
      clearRevealTimers();
      clearHoveredElement();
      currentTargetElement = null;
      currentStep = null;

      nextBtn.removeEventListener('click', handleNextClick);
      skipBtn.removeEventListener('click', handleSkipClick);
      topSkipBtn.removeEventListener('click', handleSkipClick);
      speechBubbleEl.removeEventListener('click', handleSpeechBubbleClick);
      blockerEl.removeEventListener('click', handleBlockerClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('scroll', handleWindowResize, true);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', clearHoveredElement);
      window.removeEventListener('blur', clearHoveredElement);

      if (overlayEl.parentNode) {
        overlayEl.parentNode.removeChild(overlayEl);
      }
    },
  };

  return controller;
}
