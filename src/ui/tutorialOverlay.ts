import './tutorialOverlay.css';

/**
 * Фаза игрового процесса, к которой привязан шаг обучения.
 */
export type TutorialPhase = 'blind_select' | 'playing' | 'cashout' | 'shop' | 'any';

/**
 * Направление стрелки-указателя на целевой элемент интерфейса.
 */
export type TutorialArrowPosition = 'top' | 'bottom' | 'left' | 'right' | 'none';

/**
 * Эмоциональное состояние персонажа-спикера (Миры).
 */
export type TutorialEmotion = 'neutral' | 'happy' | 'thinking' | 'warning';

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

/**
 * Генерирует пиксель-арт SVG портрета Джимбо (пасхалка для разработчика).
 */
function renderJimboAvatar(): string {
  return `
    <svg viewBox="0 0 64 64" width="100%" height="100%" shape-rendering="crispEdges" aria-label="Джимбо">
      <!-- Фон карты -->
      <rect x="12" y="6" width="40" height="52" rx="4" fill="#ffffff" stroke="#c0392b" stroke-width="2"/>
      <text x="16" y="16" font-family="'Pixellari', monospace" font-size="7" font-weight="900" fill="#c0392b">J</text>
      <!-- Шут и бубенцы -->
      <path d="M 22 24 Q 18 14 12 18 Q 18 26 24 28" fill="#3a86ff"/>
      <circle cx="11" cy="18" r="2.5" fill="#f5b942"/>
      <path d="M 42 24 Q 46 14 52 18 Q 46 26 40 28" fill="#e84a5f"/>
      <circle cx="53" cy="18" r="2.5" fill="#f5b942"/>
      <path d="M 24 26 Q 32 12 40 26 Z" fill="#f5b942"/>
      <circle cx="32" cy="12" r="2.5" fill="#ffffff"/>
      <!-- Лицо -->
      <ellipse cx="32" cy="34" rx="10" ry="9" fill="#fde2cd"/>
      <!-- Глаза -->
      <circle cx="28" cy="33" r="1.5" fill="#11231f"/>
      <circle cx="36" cy="33" r="1.5" fill="#11231f"/>
      <!-- Румянец -->
      <circle cx="25" cy="36" r="2" fill="#ff7675" opacity="0.6"/>
      <circle cx="39" cy="36" r="2" fill="#ff7675" opacity="0.6"/>
      <!-- Улыбка -->
      <path d="M 27 37 Q 32 43 37 37" stroke="#c0392b" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <!-- Воротник шута -->
      <polygon points="20,44 26,48 32,44 38,48 44,44 40,52 24,52" fill="#3a86ff"/>
      <polygon points="26,48 32,44 38,48 32,53" fill="#e84a5f"/>
    </svg>
  `;
}

/**
 * Генерирует пиксель-арт SVG портрета Миры (администратора Гильдии) с поддержкой эмоций.
 * Эмоции: 'neutral' | 'happy' | 'thinking' | 'warning'.
 */
export function renderMiraAvatar(emotion: TutorialEmotion = 'neutral', speaker: string = 'Мира'): string {
  if (speaker === 'Джимбо') {
    return renderJimboAvatar();
  }

  // Специфичные элементы лица в зависимости от эмоции
  let eyesAndBrowsSvg = '';
  let mouthSvg = '';
  let emotionExtraSvg = '';

  switch (emotion) {
    case 'happy':
      // Веселые прищуренные глазки-дуги
      eyesAndBrowsSvg = `
        <!-- Брови приподнятые от радости -->
        <rect x="23" y="22" width="6" height="1.5" fill="#962d00" rx="0.5"/>
        <rect x="35" y="22" width="6" height="1.5" fill="#962d00" rx="0.5"/>
        <!-- Глаза-дуги ^ ^ -->
        <path d="M 23 28 Q 26 23 29 28" stroke="#165b32" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M 35 28 Q 38 23 41 28" stroke="#165b32" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Яркий румянец -->
        <rect x="21" y="29" width="6" height="3" fill="#f1948a" rx="1" opacity="0.85"/>
        <rect x="37" y="29" width="6" height="3" fill="#f1948a" rx="1" opacity="0.85"/>
      `;
      // Широкая открытая улыбка
      mouthSvg = `
        <path d="M 28 34 Q 32 40 36 34 Z" fill="#c0392b"/>
        <rect x="30" y="34" width="4" height="1.2" fill="#ffffff" rx="0.5"/>
      `;
      // Летающие золотые искры радости
      emotionExtraSvg = `
        <rect x="8" y="14" width="3" height="3" fill="#ffd700"/>
        <rect x="54" y="18" width="3" height="3" fill="#ffd700"/>
        <polygon points="12,32 14,35 17,35 15,38 16,41 13,39 10,41 11,38 9,35 12,35" fill="#f5b942" opacity="0.9"/>
      `;
      break;

    case 'thinking':
      // Задумчивый взгляд: одна бровь приподнята, взгляд вверх-вправо
      eyesAndBrowsSvg = `
        <!-- Левая бровь поднята высоко -->
        <rect x="23" y="20" width="6" height="1.5" fill="#962d00" rx="0.5"/>
        <!-- Правая бровь нахмурена -->
        <rect x="35" y="23" width="6" height="1.5" fill="#962d00" rx="0.5"/>
        <!-- Глаза смотрят вверх и вправо -->
        <rect x="24" y="24" width="5" height="4.5" fill="#ffffff" rx="1"/>
        <rect x="26" y="24" width="3" height="4.5" fill="#1e824c" rx="0.5"/>
        <rect x="27" y="24" width="2" height="2" fill="#ffffff"/>
        <rect x="35" y="24" width="5" height="4.5" fill="#ffffff" rx="1"/>
        <rect x="37" y="24" width="3" height="4.5" fill="#1e824c" rx="0.5"/>
        <rect x="38" y="24" width="2" height="2" fill="#ffffff"/>
        <!-- Мягкий румянец -->
        <rect x="22" y="30" width="4" height="2" fill="#f5b7b1" opacity="0.6"/>
        <rect x="38" y="30" width="4" height="2" fill="#f5b7b1" opacity="0.6"/>
      `;
      // Задумчивая волнистая линия губ
      mouthSvg = `
        <path d="M 29 35 Q 31 34 33 36 Q 35 34 36 35" stroke="#962d00" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      `;
      // Облачко мыслей с вопросительным знаком
      emotionExtraSvg = `
        <circle cx="52" cy="14" r="5.5" fill="#f5b942" opacity="0.95"/>
        <text x="52" y="17.5" font-family="'Pixellari', monospace" font-size="10" font-weight="900" fill="#0d1d1b" text-anchor="middle">?</text>
        <circle cx="46" cy="22" r="1.5" fill="#f5b942" opacity="0.75"/>
      `;
      break;

    case 'warning':
      // Встревоженный / настороженный взгляд
      eyesAndBrowsSvg = `
        <!-- Брови сдвинуты в тревоге -->
        <path d="M 23 21 L 28 23.5" stroke="#962d00" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M 41 21 L 36 23.5" stroke="#962d00" stroke-width="1.8" stroke-linecap="round"/>
        <!-- Широко распахнутые глаза -->
        <rect x="23" y="23" width="6" height="5.5" fill="#ffffff" rx="1"/>
        <rect x="25" y="24" width="2.5" height="3.5" fill="#1e824c"/>
        <rect x="25" y="25" width="2" height="2" fill="#0d381e"/>
        <rect x="35" y="23" width="6" height="5.5" fill="#ffffff" rx="1"/>
        <rect x="37" y="24" width="2.5" height="3.5" fill="#1e824c"/>
        <rect x="37" y="25" width="2" height="2" fill="#0d381e"/>
      `;
      // Приоткрытый от удивления/предостережения рот
      mouthSvg = `
        <rect x="30" y="34" width="4" height="2.5" fill="#962d00" rx="1"/>
      `;
      // Капелька пота на виске и янтарный знак предупреждения
      emotionExtraSvg = `
        <!-- Капля пота -->
        <path d="M 46 19 C 46 19 48 22 48 24 C 48 25.5 47 26 46 26 C 45 26 44 25.5 44 24 C 44 22 46 19 46 19 Z" fill="#3a86ff"/>
        <!-- Алмаз предупреждения с восклицательным знаком -->
        <polygon points="12,10 16,14 12,18 8,14" fill="#e84a5f"/>
        <text x="12" y="16.5" font-family="'Pixellari', monospace" font-size="9" font-weight="900" fill="#ffffff" text-anchor="middle">!</text>
      `;
      break;

    case 'neutral':
    default:
      // Спокойный, дружелюбный, уверенный взгляд администратора
      eyesAndBrowsSvg = `
        <!-- Спокойные ровные брови -->
        <rect x="23" y="22" width="6" height="1.5" fill="#962d00" rx="0.5"/>
        <rect x="35" y="22" width="6" height="1.5" fill="#962d00" rx="0.5"/>
        <!-- Выразительные изумрудные глаза -->
        <rect x="24" y="24" width="5" height="5" fill="#ffffff" rx="1"/>
        <rect x="25" y="25" width="3" height="4" fill="#1e824c" rx="0.5"/>
        <rect x="26" y="26" width="2" height="2" fill="#0d381e"/>
        <rect x="25" y="24.5" width="1.5" height="1.5" fill="#ffffff"/>
        <rect x="35" y="24" width="5" height="5" fill="#ffffff" rx="1"/>
        <rect x="36" y="25" width="3" height="4" fill="#1e824c" rx="0.5"/>
        <rect x="37" y="26" width="2" height="2" fill="#0d381e"/>
        <rect x="36" y="24.5" width="1.5" height="1.5" fill="#ffffff"/>
        <!-- Нежный румянец -->
        <rect x="22" y="30" width="4" height="2" fill="#f5b7b1" opacity="0.65"/>
        <rect x="38" y="30" width="4" height="2" fill="#f5b7b1" opacity="0.65"/>
      `;
      // Мягкая приветливая улыбка
      mouthSvg = `
        <path d="M 29 35 Q 32 37.5 35 35" stroke="#962d00" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      `;
      // Золотая искорка на фоне
      emotionExtraSvg = `
        <polygon points="56,8 57,11 60,12 57,13 56,16 55,13 52,12 55,11" fill="#f5b942" opacity="0.8"/>
      `;
      break;
  }

  return `
    <svg viewBox="0 0 64 64" width="100%" height="100%" shape-rendering="crispEdges" aria-label="Мира (${emotion})">
      <defs>
        <radialGradient id="mira-cameo-bg" cx="50%" cy="38%" r="65%">
          <stop offset="0%" stop-color="#1e3e34"/>
          <stop offset="100%" stop-color="#0b1a15"/>
        </radialGradient>
      </defs>

      <!-- Фон камеи -->
      <rect x="0" y="0" width="64" height="64" fill="url(#mira-cameo-bg)" rx="8"/>

      <!-- Задняя масса огненно-рыжих волос -->
      <rect x="18" y="10" width="28" height="28" fill="#a03000"/>
      <rect x="14" y="14" width="36" height="26" fill="#bf3e00"/>
      <!-- Администраторский аккуратный пучок с золотой заколкой -->
      <rect x="44" y="10" width="9" height="9" fill="#d35400" rx="2"/>
      <rect x="42" y="12" width="4" height="4" fill="#f5b942"/>

      <!-- Плечи и одежда -->
      <!-- Белый строгий воротник рубашки -->
      <polygon points="26,43 32,52 38,43 32,46" fill="#ffffff"/>
      <polygon points="28,43 32,50 30,43" fill="#d5dbdb"/>
      <polygon points="36,43 32,50 34,43" fill="#d5dbdb"/>

      <!-- Зелёный жилет Гильдии -->
      <path d="M 15 48 L 26 43 L 28 64 L 12 64 Z" fill="#1e824c"/>
      <path d="M 26 43 L 28 64 L 30 64 L 28 46 Z" fill="#145a32"/>
      <path d="M 49 48 L 38 43 L 36 64 L 52 64 Z" fill="#1e824c"/>
      <path d="M 38 43 L 36 64 L 34 64 L 36 46 Z" fill="#145a32"/>
      <!-- Золотые пуговицы жилета -->
      <rect x="31" y="52" width="2" height="2" fill="#ffd700"/>
      <rect x="31" y="58" width="2" height="2" fill="#ffd700"/>

      <!-- Золотой значок Гильдии (Guild badge) со щитом и рубином -->
      <polygon points="19,49 24,49 25,54 21.5,57 18,54" fill="#f1c40f" stroke="#b7950b" stroke-width="0.5"/>
      <rect x="20.5" y="51.5" width="2" height="2" fill="#e74c3c"/>

      <!-- Шея -->
      <rect x="28" y="38" width="8" height="7" fill="#f3bfa0"/>
      <rect x="29" y="41" width="6" height="3" fill="#e2a785"/>

      <!-- Лицо -->
      <rect x="20" y="18" width="24" height="22" fill="#fde2cd" rx="4"/>
      <rect x="22" y="36" width="20" height="4" fill="#fde2cd"/>
      <!-- Тень под подбородком -->
      <rect x="25" y="39" width="14" height="1.5" fill="#f3bfa0"/>

      <!-- Волосы спереди: рыжие пряди и чёлка -->
      <path d="M 16 16 L 48 16 L 48 24 L 44 26 L 42 20 L 32 23 L 22 19 L 18 28 L 16 26 Z" fill="#e67e22"/>
      <path d="M 18 14 L 46 14 L 44 18 L 34 16 L 24 18 Z" fill="#f39c12"/>
      <!-- Локоны по бокам лица -->
      <rect x="16" y="24" width="4" height="12" fill="#d35400"/>
      <rect x="18" y="26" width="2" height="12" fill="#e67e22"/>
      <rect x="44" y="24" width="4" height="11" fill="#d35400"/>
      <rect x="44" y="26" width="2" height="11" fill="#e67e22"/>

      <!-- Глаза и брови -->
      ${eyesAndBrowsSvg}

      <!-- Рот -->
      ${mouthSvg}

      <!-- Спецэффекты эмоции -->
      ${emotionExtraSvg}
    </svg>
  `;
}

/**
 * Создаёт SVG иконку стрелки-указателя.
 */
function renderArrowSvg(): string {
  return `
    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L12 16" stroke="#f5b942" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M5 11L12 18L19 11" stroke="#f5b942" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 4L12 16" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
      <path d="M7 11L12 16L17 11" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
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

  // Создаем корневой элемент оверлея
  const overlayEl = document.createElement('div');
  overlayEl.className = 'tut-overlay';
  overlayEl.setAttribute('role', 'dialog');
  overlayEl.setAttribute('aria-modal', 'true');
  overlayEl.setAttribute('aria-labelledby', 'tut-step-title');

  // Полупрозрачный фон
  const backdropEl = document.createElement('div');
  backdropEl.className = 'tut-backdrop';
  backdropEl.setAttribute('aria-hidden', 'true');
  overlayEl.appendChild(backdropEl);

  // Спотлайт-вырез вокруг элемента
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

  // Кнопка быстрого пропуска в верхнем правом углу
  const topSkipBtn = document.createElement('button');
  topSkipBtn.type = 'button';
  topSkipBtn.className = 'tut-skip-top-btn';
  topSkipBtn.setAttribute('aria-label', 'Пропустить обучение');
  topSkipBtn.innerHTML = `<span>Пропустить</span><span class="tut-skip-icon">›</span>`;
  overlayEl.appendChild(topSkipBtn);

  // Диалоговая карточка
  const cardEl = document.createElement('div');
  cardEl.className = 'tut-card';

  // Шапка карточки
  const cardHeaderEl = document.createElement('div');
  cardHeaderEl.className = 'tut-card-header';

  // Аватар
  const avatarWrapperEl = document.createElement('div');
  avatarWrapperEl.className = 'tut-avatar-wrapper';

  const avatarFrameEl = document.createElement('div');
  avatarFrameEl.className = 'tut-avatar-frame';
  avatarFrameEl.innerHTML = renderMiraAvatar('neutral');
  avatarWrapperEl.appendChild(avatarFrameEl);

  const avatarNameEl = document.createElement('div');
  avatarNameEl.className = 'tut-avatar-name';
  avatarNameEl.textContent = 'Мира';
  avatarWrapperEl.appendChild(avatarNameEl);

  cardHeaderEl.appendChild(avatarWrapperEl);

  // Мета шапки (счётчик и заголовок)
  const headerMetaEl = document.createElement('div');
  headerMetaEl.className = 'tut-header-meta';

  const stepCounterEl = document.createElement('div');
  stepCounterEl.className = 'tut-step-counter';
  headerMetaEl.appendChild(stepCounterEl);

  const stepTitleEl = document.createElement('h3');
  stepTitleEl.id = 'tut-step-title';
  stepTitleEl.className = 'tut-step-title';
  headerMetaEl.appendChild(stepTitleEl);

  cardHeaderEl.appendChild(headerMetaEl);
  cardEl.appendChild(cardHeaderEl);

  // Текстовая область
  const cardBodyEl = document.createElement('div');
  cardBodyEl.className = 'tut-card-body';

  const textEl = document.createElement('div');
  textEl.className = 'tut-text';
  cardBodyEl.appendChild(textEl);
  cardEl.appendChild(cardBodyEl);

  // Подвал с кнопками
  const cardFooterEl = document.createElement('div');
  cardFooterEl.className = 'tut-card-footer';

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'tut-btn tut-btn--skip';
  skipBtn.textContent = 'Пропустить';
  cardFooterEl.appendChild(skipBtn);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'tut-btn tut-btn--next';
  nextBtn.textContent = 'Дальше';
  cardFooterEl.appendChild(nextBtn);

  cardEl.appendChild(cardFooterEl);
  overlayEl.appendChild(cardEl);

  // Монтируем в body
  document.body.appendChild(overlayEl);

  /**
   * Обновляет координаты спотлайта, стрелки и карточки диалога.
   */
  function updatePositions(): void {
    if (!currentTargetElement || !currentTargetElement.isConnected) {
      spotlightEl.style.display = 'none';
      arrowEl.style.display = 'none';
      blockerEl.style.clipPath = 'none';

      // Центрируем диалог по экрану
      cardEl.style.top = '50%';
      cardEl.style.left = '50%';
      cardEl.style.bottom = 'auto';
      cardEl.style.right = 'auto';
      cardEl.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const rect = currentTargetElement.getBoundingClientRect();
    const padding = 6;
    const spotlightTop = Math.max(0, rect.top - padding);
    const spotlightLeft = Math.max(0, rect.left - padding);
    const spotlightWidth = rect.width + padding * 2;
    const spotlightHeight = rect.height + padding * 2;

    spotlightEl.style.display = 'block';
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

    // Умное позиционирование карточки диалога:
    // Карточка размещается так, чтобы ни при каких обстоятельствах не закрывать целевой элемент.
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const targetCenterY = rect.top + rect.height / 2;

    // Сброс горизонтальных координат
    cardEl.style.right = 'auto';

    // На широком экране десктопа проверяем также боковое размещение
    if (vw >= 960 && rect.right < vw * 0.38) {
      cardEl.style.left = 'clamp(360px, 48vw, 680px)';
      cardEl.style.top = '50%';
      cardEl.style.bottom = 'auto';
      cardEl.style.transform = 'translateY(-50%)';
    } else if (targetCenterY > vh * 0.48) {
      // Элемент находится в нижней половине экрана -> карточка размещается вверху
      cardEl.style.top = 'clamp(14px, 3vh, 36px)';
      cardEl.style.bottom = 'auto';
      cardEl.style.left = '50%';
      cardEl.style.transform = 'translateX(-50%)';
    } else {
      // Элемент в верхней половине экрана -> карточка размещается внизу
      cardEl.style.top = 'auto';
      cardEl.style.bottom = 'clamp(14px, 3vh, 36px)';
      cardEl.style.left = '50%';
      cardEl.style.transform = 'translateX(-50%)';
    }
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

  function handleBlockerClick(): void {
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
  blockerEl.addEventListener('click', handleBlockerClick);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', handleWindowResize);
  window.addEventListener('scroll', handleWindowResize, true);

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

    showStep(step: TutorialStep): void {
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

      // 4. Текст с подсветкой терминов
      textEl.innerHTML = formatTutorialText(step.text);

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
      overlayEl.classList.remove('is-visible');
      currentTargetElement = null;
      currentArrowPosition = 'none';
      spotlightEl.style.display = 'none';
      arrowEl.style.display = 'none';
      blockerEl.style.clipPath = 'none';
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
      currentTargetElement = null;
      currentStep = null;

      nextBtn.removeEventListener('click', handleNextClick);
      skipBtn.removeEventListener('click', handleSkipClick);
      topSkipBtn.removeEventListener('click', handleSkipClick);
      blockerEl.removeEventListener('click', handleBlockerClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('scroll', handleWindowResize, true);

      if (overlayEl.parentNode) {
        overlayEl.parentNode.removeChild(overlayEl);
      }
    },
  };

  return controller;
}
