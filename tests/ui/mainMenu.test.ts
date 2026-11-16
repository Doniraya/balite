import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../src/i18n';
import {
  APP_VERSION,
  renderMainMenu,
  type MainMenuHandlers,
} from '../../src/ui/mainMenu';

/**
 * Создаёт отслеживаемые колбэки Главного меню для модульных тестов.
 */
function createMenuHandlers(): MainMenuHandlers {
  return {
    onPlay: vi.fn(),
    onOpenSettings: vi.fn(),
    onToggleLanguage: vi.fn(),
    onOpenCollection: vi.fn(),
  };
}

describe('Главное меню Balite (src/ui/mainMenu.ts)', () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.replaceChildren(root);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('отрисовывает логотип BALITE с центральной рунической картой, версию, 3 кнопки и переключатель языка на ru/en', () => {
    for (const lang of ['ru', 'en'] as const) {
      const translator = createTranslator(lang);
      const handlers = createMenuHandlers();

      renderMainMenu(
        root,
        {
          translator,
          lang,
          version: APP_VERSION,
          hasSavedRun: false,
        },
        handlers,
      );

      const menuEl = root.querySelector<HTMLElement>('.main-menu[data-screen="main-menu"]');
      expect(menuEl).not.toBeNull();

      // Логотип BALITE и центральная руническая карта без туза пик
      const logoEl = root.querySelector<HTMLElement>('.main-menu__logo');
      expect(logoEl?.getAttribute('aria-label')).toBe('Balite');
      expect(logoEl?.textContent?.replace(/\s+/g, '')).toBe('BALITE');
      expect(root.querySelector('.main-menu__card svg')).not.toBeNull();
      expect(root.innerHTML).not.toContain('♠');
      expect(root.innerHTML).not.toContain('%E2%99%A0');

      // Версия сборки в правом верхнем углу совпадает с package.json
      const versionEl = root.querySelector<HTMLElement>('.main-menu__version');
      expect(versionEl?.textContent).toContain(APP_VERSION);

      // Кнопки нижней панели: ИГРАТЬ / ПАРАМЕТРЫ / КОЛЛЕКЦИЯ (disabled + Скоро) / Язык
      const playBtn = root.querySelector<HTMLButtonElement>('[data-menu-action="play"]');
      const settingsBtn = root.querySelector<HTMLButtonElement>('[data-menu-action="settings"]');
      const collectionBtn = root.querySelector<HTMLButtonElement>('[data-menu-action="collection"]');
      const langBtn = root.querySelector<HTMLButtonElement>('[data-menu-action="toggle-lang"]');

      expect(playBtn).not.toBeNull();
      expect(settingsBtn).not.toBeNull();
      expect(collectionBtn).not.toBeNull();
      expect(langBtn).not.toBeNull();

      expect(playBtn?.disabled).toBe(false);
      expect(settingsBtn?.disabled).toBe(false);
      expect(collectionBtn?.disabled).toBe(false);
      expect(collectionBtn?.textContent).not.toContain(lang === 'ru' ? 'Скоро' : 'Soon');
      expect(langBtn?.textContent).toContain(lang === 'ru' ? 'Русский' : 'English');

      // Запрещённые элементы референса (Профиль, Discord, X, Выход, внешние ссылки) отсутствуют
      const text = root.textContent ?? '';
      expect(text).not.toMatch(/Профиль|Profile|Discord|Выход|Exit/i);
      expect(root.innerHTML).not.toMatch(/<a\b|https?:/i);

      // Клики вызывают нужные обработчики
      playBtn?.click();
      settingsBtn?.click();
      langBtn?.click();
      collectionBtn?.click();

      expect(handlers.onPlay).toHaveBeenCalledTimes(1);
      expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);
      expect(handlers.onToggleLanguage).toHaveBeenCalledTimes(1);
      expect(handlers.onOpenCollection).toHaveBeenCalledTimes(1);

      // Бэйдж «!» появляется при наличии новых сущностей в коллекции
      renderMainMenu(
        root,
        {
          translator,
          lang,
          version: APP_VERSION,
          hasSavedRun: false,
          hasUnseenCollection: true,
        },
        handlers,
      );
      expect(root.querySelector('.main-menu__alert-badge')?.textContent).toBe('!');
    }
  });

  it('mainMenu.css допускает :hover только под @media (hover: hover) and (pointer: fine) и задаёт адаптивные стили', async () => {
    const fsModule = 'node:fs';
    const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as {
      readFileSync: (file: string, encoding: 'utf8') => string;
    };
    const css = readFileSync('src/ui/mainMenu.css', 'utf8');
    const withoutFineHover = css.replace(
      /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*\{[\s\S]*?\}\s*\}/g,
      '',
    );
    expect(withoutFineHover).not.toMatch(/:hover\b/);
    expect(css).toContain('@media (hover: hover) and (pointer: fine)');
    expect(css).toContain('brightness(0.86)');
    expect(css).toContain('.main-menu');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('@media');
  });
});
