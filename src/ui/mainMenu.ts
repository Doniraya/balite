import './mainMenu.css';
import type { I18nLang, Translator } from '../i18n';
import guildCrestUrl from '../assets/ui/guild-crest.webp';
import langGlobeUrl from '../assets/ui/icon-lang-globe.webp';

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
  readonly hasUnseenCollection?: boolean;
}

/**
 * Обработчики пользовательских действий в Главном меню.
 */
export interface MainMenuHandlers {
  readonly onPlay: () => void;
  readonly onOpenSettings: () => void;
  readonly onToggleLanguage: () => void;
  readonly onOpenCollection?: () => void;
}

/**
 * Создаёт центральную пиксельную эмблему гильдии (зачарованный талисман со скипетром, без покерных мастей).
 */
function createRunicCardElement(): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'main-menu__card';
  card.setAttribute('aria-hidden', 'true');

  const crestImg = document.createElement('img');
  crestImg.className = 'main-menu__crest-img';
  crestImg.src = guildCrestUrl;
  crestImg.alt = '';
  crestImg.draggable = false;
  crestImg.setAttribute('aria-hidden', 'true');

  card.append(crestImg);
  return card;
}

/**
 * Создаёт компактную пиксельную иконку выбора языка.
 */
function createLanguageIconImg(): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'main-menu__lang-icon';
  img.src = langGlobeUrl;
  img.alt = '';
  img.draggable = false;
  img.setAttribute('aria-hidden', 'true');
  return img;
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
  cardWrap.append(createRunicCardElement());

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
  if (handlers.onOpenCollection) {
    collectionBtn.addEventListener('click', handlers.onOpenCollection);
  }

  const collectionLabel = document.createElement('span');
  collectionLabel.textContent = translator.t('ui.mainMenu.collection');
  collectionBtn.append(collectionLabel);

  if (vm.hasUnseenCollection) {
    const alertBadge = document.createElement('span');
    alertBadge.className = 'main-menu__alert-badge';
    alertBadge.textContent = '!';
    alertBadge.setAttribute('aria-hidden', 'true');
    collectionBtn.append(alertBadge);
  }

  panel.append(playBtn, settingsBtn, collectionBtn);

  const langBtn = document.createElement('button');
  langBtn.type = 'button';
  langBtn.className = 'main-menu__lang-btn';
  langBtn.dataset.menuAction = 'toggle-lang';
  langBtn.append(
    createLanguageIconImg(),
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
