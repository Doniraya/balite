import './mainMenu.css';
import type { I18nLang, Translator } from '../i18n';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Текущая версия сборки приложения, подставляемая Vite из package.json.
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? __APP_VERSION__ : '0.1.0';

/**
 * Данные для отрисовки экрана Главного меню Balite.
 */
export interface MainMenuViewModel {
  readonly translator: Translator;
  readonly lang: I18nLang;
  readonly version: string;
  readonly hasSavedRun: boolean;
}

/**
 * Обработчики пользовательских действий в Главном меню.
 */
export interface MainMenuHandlers {
  readonly onPlay: () => void;
  readonly onOpenSettings: () => void;
  readonly onToggleLanguage: () => void;
}

/**
 * Создаёт SVG-элемент с заданными атрибутами.
 */
function createSvgEl(
  tag: keyof SVGElementTagNameMap,
  attrs: Record<string, string>,
): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

/**
 * Создаёт SVG-эмблему вертикального алхимического жезла позади центральной карты.
 */
function createArcaneStaffSvg(): SVGElement {
  const svg = createSvgEl('svg', {
    class: 'main-menu__staff',
    viewBox: '0 0 120 320',
    'aria-hidden': 'true',
  });

  svg.append(
    createSvgEl('line', {
      x1: '60',
      y1: '14',
      x2: '60',
      y2: '306',
      stroke: 'rgba(245, 185, 66, 0.72)',
      'stroke-width': '4',
      'stroke-linecap': 'round',
    }),
    createSvgEl('path', {
      d: 'M60 18 C82 40, 38 74, 60 100 C82 126, 38 194, 60 220 C82 246, 38 280, 60 302',
      fill: 'none',
      stroke: 'rgba(94, 198, 255, 0.7)',
      'stroke-width': '3',
      'stroke-linecap': 'round',
    }),
    createSvgEl('polygon', {
      points: '60,4 70,18 60,32 50,18',
      fill: '#f5b942',
    }),
    createSvgEl('polygon', {
      points: '60,288 68,302 60,316 52,302',
      fill: '#e84a5f',
    }),
  );

  return svg;
}

/**
 * Создаёт центральную руническую карту логотипа (строго без туза пик и покерных мастей).
 */
function createRunicCardElement(): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'main-menu__card';
  card.setAttribute('aria-hidden', 'true');

  const sigilSvg = createSvgEl('svg', {
    class: 'main-menu__card-sigil',
    viewBox: '0 0 100 130',
  });

  sigilSvg.append(
    createSvgEl('rect', {
      x: '8',
      y: '8',
      width: '84',
      height: '114',
      rx: '8',
      fill: 'none',
      stroke: '#d49a35',
      'stroke-width': '2',
    }),
    // Угловые рунические звёзды в углах карты (SVG вместо текста, чтобы textContent логотипа оставался чистым)
    createSvgEl('polygon', {
      points: '18,14 20,18 24,20 20,22 18,26 16,22 12,20 16,18',
      fill: '#b47816',
    }),
    createSvgEl('polygon', {
      points: '82,104 84,108 88,110 84,112 82,116 80,112 76,110 80,108',
      fill: '#b47816',
    }),
    createSvgEl('circle', {
      cx: '50',
      cy: '65',
      r: '28',
      fill: 'rgba(22, 46, 40, 0.08)',
      stroke: '#1e3a34',
      'stroke-width': '2.5',
    }),
    createSvgEl('polygon', {
      points: '50,24 62,55 90,65 62,75 50,106 38,75 10,65 38,55',
      fill: '#1b3530',
      stroke: '#c98926',
      'stroke-width': '2',
    }),
    createSvgEl('polygon', {
      points: '50,42 59,65 50,88 41,65',
      fill: '#f5b942',
    }),
    createSvgEl('circle', {
      cx: '50',
      cy: '65',
      r: '4',
      fill: '#1b3530',
    }),
  );

  card.append(sigilSvg);
  return card;
}

/**
 * Создаёт компактную SVG-иконку выбора языка.
 */
function createLanguageIconSvg(): SVGElement {
  const svg = createSvgEl('svg', {
    class: 'main-menu__lang-icon',
    viewBox: '0 0 24 24',
    width: '18',
    height: '18',
    'aria-hidden': 'true',
  });
  svg.append(
    createSvgEl('circle', {
      cx: '12',
      cy: '12',
      r: '9',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
    }),
    createSvgEl('ellipse', {
      cx: '12',
      cy: '12',
      rx: '4',
      ry: '9',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.6',
    }),
    createSvgEl('line', {
      x1: '3',
      y1: '12',
      x2: '21',
      y2: '12',
      stroke: 'currentColor',
      'stroke-width': '1.6',
    }),
  );
  return svg;
}

/**
 * Отрисовывает экран Главного меню поверх живого фонового холста.
 */
export function renderMainMenu(
  root: HTMLElement,
  vm: MainMenuViewModel,
  handlers: MainMenuHandlers,
): void {
  const { translator, lang, version } = vm;
  root.replaceChildren();

  const shell = document.createElement('section');
  shell.className = 'main-menu';
  shell.dataset.screen = 'main-menu';

  // Верхняя строка: версия сборки в правом углу
  const topBar = document.createElement('div');
  topBar.className = 'main-menu__top';
  const versionBadge = document.createElement('span');
  versionBadge.className = 'main-menu__version';
  versionBadge.dataset.version = version;
  versionBadge.textContent = `v${version}`;
  versionBadge.setAttribute('aria-label', translator.t('ui.mainMenu.version', { version }));
  topBar.append(versionBadge);

  // Центральный блок: крупный логотип BALITE + руническая карта
  const hero = document.createElement('div');
  hero.className = 'main-menu__hero';

  const logo = document.createElement('h1');
  logo.className = 'main-menu__logo';
  logo.setAttribute('aria-label', translator.t('ui.app.title'));

  const wordLeft = document.createElement('span');
  wordLeft.className = 'main-menu__wordmark';
  wordLeft.textContent = 'BAL';

  const cardWrap = document.createElement('span');
  cardWrap.className = 'main-menu__card-wrap';
  cardWrap.append(createArcaneStaffSvg(), createRunicCardElement());

  const wordRight = document.createElement('span');
  wordRight.className = 'main-menu__wordmark';
  wordRight.textContent = 'ITE';

  logo.append(wordLeft, cardWrap, wordRight);

  const subtitle = document.createElement('p');
  subtitle.className = 'main-menu__subtitle';
  subtitle.textContent = translator.t('ui.app.subtitle');

  hero.append(logo, subtitle);

  // Нижняя панель кнопок и переключатель языка справа
  const dock = document.createElement('div');
  dock.className = 'main-menu__dock';

  const panel = document.createElement('nav');
  panel.className = 'main-menu__panel';
  panel.setAttribute('aria-label', translator.t('ui.app.title'));

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'main-menu__btn main-menu__btn--play';
  playBtn.dataset.menuAction = 'play';
  playBtn.textContent = translator.t('ui.mainMenu.play');
  playBtn.addEventListener('click', handlers.onPlay);

  const settingsBtn = document.createElement('button');
  settingsBtn.type = 'button';
  settingsBtn.className = 'main-menu__btn main-menu__btn--settings';
  settingsBtn.dataset.menuAction = 'settings';
  settingsBtn.textContent = translator.t('ui.mainMenu.options');
  settingsBtn.addEventListener('click', handlers.onOpenSettings);

  const collectionBtn = document.createElement('button');
  collectionBtn.type = 'button';
  collectionBtn.className = 'main-menu__btn main-menu__btn--collection';
  collectionBtn.dataset.menuAction = 'collection';
  collectionBtn.disabled = true;
  collectionBtn.setAttribute('aria-disabled', 'true');

  const collectionLabel = document.createElement('span');
  collectionLabel.textContent = translator.t('ui.mainMenu.collection');
  const soonBadge = document.createElement('span');
  soonBadge.className = 'main-menu__soon-badge';
  soonBadge.textContent = translator.t('ui.mainMenu.comingSoon');
  collectionBtn.append(collectionLabel, soonBadge);

  panel.append(playBtn, settingsBtn, collectionBtn);

  const langBtn = document.createElement('button');
  langBtn.type = 'button';
  langBtn.className = 'main-menu__lang-btn';
  langBtn.dataset.menuAction = 'toggle-lang';
  langBtn.append(
    createLanguageIconSvg(),
    Object.assign(document.createElement('span'), {
      className: 'main-menu__lang-label',
      textContent:
        lang === 'ru' ? translator.t('ui.settings.langRu') : translator.t('ui.settings.langEn'),
    }),
  );
  langBtn.addEventListener('click', handlers.onToggleLanguage);

  dock.append(panel, langBtn);

  shell.append(topBar, hero, dock);
  root.append(shell);
}
