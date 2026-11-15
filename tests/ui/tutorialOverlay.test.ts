import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTutorialOverlay,
  formatTutorialText,
  renderMiraAvatar,
  resolveMiraSprite,
  type TutorialEmotion,
  type TutorialOverlayController,
  type TutorialStep,
} from '../../src/ui/tutorialOverlay';

describe('formatTutorialText', () => {
  it('возвращает пустую строку для пустого ввода', () => {
    expect(formatTutorialText('')).toBe('');
  });

  it('экранирует потенциально опасные HTML-теги', () => {
    const raw = '<script>alert("xss")</script> & <b>test</b>';
    const formatted = formatTutorialText(raw);
    expect(formatted).not.toContain('<script>');
    expect(formatted).toContain('&lt;script&gt;');
    expect(formatted).toContain('&amp;');
  });

  it('форматирует теги цвета в стиле {C:blue}...{/C}', () => {
    const raw = 'Получите {C:blue}+50 фишек{/C} за разыгранную комбинацию.';
    const formatted = formatTutorialText(raw);
    expect(formatted).toContain('<span class="tut-hl tut-hl--blue">+50 фишек</span>');
  });

  it('форматирует теги цвета в стиле Balatro {C:red}...{} (закрывающая фигурная скобка)', () => {
    const raw = 'Умножьте на {C:red}×4 Множитель{} для победы!';
    const formatted = formatTutorialText(raw);
    expect(formatted).toContain('<span class="tut-hl tut-hl--red">×4 Множитель</span>');
  });

  it('поддерживает все ключевые категории цветов', () => {
    const raw = `
      {C:money}$15{} {C:gold}Золото{}
      {C:green}Шанс 1 из 4{}
      {C:attention}Важно{}
      {C:tarot}Свиток кузни{}
      {C:planet}Том планет{}
      {C:spectral}Пандора{}
      {C:white}Белый{}
      {C:inactive}Неактивно{}
    `;
    const formatted = formatTutorialText(raw);
    expect(formatted).toContain('tut-hl--gold');
    expect(formatted).toContain('tut-hl--green');
    expect(formatted).toContain('tut-hl--attention');
    expect(formatted).toContain('tut-hl--tarot');
    expect(formatted).toContain('tut-hl--planet');
    expect(formatted).toContain('tut-hl--spectral');
    expect(formatted).toContain('tut-hl--white');
    expect(formatted).toContain('tut-hl--inactive');
  });

  it('форматирует бейджи множителей {X:mult,C:white} ... {}', () => {
    const raw = 'Ваш множитель вырастет на {X:mult,C:white} X2 {}!';
    const formatted = formatTutorialText(raw);
    expect(formatted).toContain('<span class="tut-badge tut-badge--mult"> X2 </span>');
  });

  it('форматирует масштабирование размера {s:0.85}...{}', () => {
    const raw = '{s:0.85}$5{} за каждый процент';
    const formatted = formatTutorialText(raw);
    expect(formatted).toContain('<span style="font-size:0.85em">$5</span>');
  });

  it('преобразует символы перевода строки в <br>', () => {
    const raw = 'Первая строка\nВторая строка';
    const formatted = formatTutorialText(raw);
    expect(formatted).toBe('Первая строка<br>Вторая строка');
  });
});

describe('renderMiraAvatar & resolveMiraSprite', () => {
  it('корректно сопоставляет эмоции со спрайтами чиби-маскота Миры', () => {
    expect(resolveMiraSprite('welcome')).toBe('mira_welcome');
    expect(resolveMiraSprite('guide_cards')).toBe('mira_guide_cards');
    expect(resolveMiraSprite('guide_book')).toBe('mira_guide_book');
    expect(resolveMiraSprite('guide_point')).toBe('mira_guide_point');
    expect(resolveMiraSprite('guide')).toBe('mira_guide');
    expect(resolveMiraSprite('happy')).toBe('mira_happy');
    expect(resolveMiraSprite('worried')).toBe('mira_worried');
    expect(resolveMiraSprite('idle')).toBe('mira_idle');

    // Обратная совместимость со старыми эмоциями
    expect(resolveMiraSprite('neutral')).toBe('mira_idle');
    expect(resolveMiraSprite('thinking')).toBe('mira_guide_point');
    expect(resolveMiraSprite('warning')).toBe('mira_worried');
  });

  it('генерирует корректный тег <img> для всех эмоций Миры с fallback на .png', () => {
    const emotions: TutorialEmotion[] = [
      'welcome',
      'guide_cards',
      'guide_book',
      'guide_point',
      'guide',
      'happy',
      'worried',
      'idle',
      'neutral',
      'thinking',
      'warning',
    ];
    for (const emotion of emotions) {
      const html = renderMiraAvatar(emotion, 'Мира');
      expect(html).toContain('<img');
      expect(html).toContain('class="tut-avatar-img"');
      expect(html).toContain(`alt="Мира (${emotion})"`);
      expect(html).toContain('.webp');
      expect(html).toContain('.png');
      expect(html).toContain('onerror=');
    }
  });

  it('генерирует векторный аватар Джимбо при указании спикера "Джимбо"', () => {
    const svg = renderMiraAvatar('neutral', 'Джимбо');
    expect(svg).toContain('<svg');
    expect(svg).toContain('aria-label="Джимбо"');
  });
});

describe('createTutorialOverlay', () => {
  let controller: TutorialOverlayController;
  let onNext: () => void;
  let onSkip: () => void;
  let onAction: (action: string) => void;

  beforeEach(() => {
    onNext = vi.fn();
    onSkip = vi.fn();
    onAction = vi.fn();

    controller = createTutorialOverlay({
      onNext,
      onSkip,
      onAction,
    });
  });

  afterEach(() => {
    controller.destroy();
    document.body.innerHTML = '';
  });

  it('монтирует оверлей в DOM в скрытом состоянии', () => {
    const overlay = document.querySelector('.tut-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.classList.contains('is-visible')).toBe(false);
    expect(controller.isVisible).toBe(false);
    expect(controller.currentStep).toBeNull();
  });

  it('корректно отображает шаг обучения showStep()', () => {
    const step: TutorialStep = {
      id: 'step-intro',
      title: 'Добро пожаловать в Гильдию!',
      text: 'Привет! Я {C:gold}Мира{}, администратор гильдии.',
      speaker: 'Мира',
      emotion: 'happy',
      stepIndex: 1,
      totalSteps: 12,
      requireAction: 'next',
    };

    controller.showStep(step);

    expect(controller.isVisible).toBe(true);
    expect(controller.currentStep).toBe(step);

    const overlay = document.querySelector('.tut-overlay');
    expect(overlay?.classList.contains('is-visible')).toBe(true);

    const titleEl = document.querySelector('.tut-step-title');
    expect(titleEl?.textContent).toBe('Добро пожаловать в Гильдию!');

    const counterEl = document.querySelector('.tut-step-counter');
    expect(counterEl?.textContent).toBe('Шаг 1 из 12');

    const bodyEl = document.querySelector('.tut-card-body');
    expect(bodyEl?.innerHTML).toContain('<span class="tut-hl tut-hl--gold">Мира</span>');

    const nextBtn = document.querySelector<HTMLButtonElement>('.tut-btn--next');
    expect(nextBtn?.textContent).toBe('Дальше');
  });

  it('на последнем шаге меняет надпись на кнопке на "Завершить"', () => {
    const step: TutorialStep = {
      id: 'step-final',
      title: 'Удачи в забеге!',
      text: 'Вы готовы к покорению Анте.',
      stepIndex: 5,
      totalSteps: 5,
    };

    controller.showStep(step);

    const nextBtn = document.querySelector<HTMLButtonElement>('.tut-btn--next');
    expect(nextBtn?.textContent).toBe('Завершить');
  });

  it('при требовании действия показывает пульсирующую подсказку', () => {
    const step: TutorialStep = {
      id: 'step-play',
      title: 'Сыграйте руку',
      text: 'Нажмите кнопку {C:blue}Играть руку{/C}.',
      requireAction: 'play_hand',
    };

    controller.showStep(step);

    const nextBtn = document.querySelector<HTMLButtonElement>('.tut-btn--next');
    expect(nextBtn?.classList.contains('tut-btn--action-hint')).toBe(true);
    expect(nextBtn?.textContent).toContain('Выполните действие');
  });

  it('находит целевой элемент по targetSelector и позиционирует спотлайт', () => {
    const target = document.createElement('button');
    target.id = 'test-play-btn';
    target.style.position = 'fixed';
    target.style.top = '600px';
    target.style.left = '200px';
    target.style.width = '120px';
    target.style.height = '50px';
    document.body.appendChild(target);

    // Мокаем getBoundingClientRect для jsdom
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 600,
      left: 200,
      width: 120,
      height: 50,
      right: 320,
      bottom: 650,
      x: 200,
      y: 600,
      toJSON: () => {},
    });

    const step: TutorialStep = {
      id: 'step-target',
      title: 'Кнопка действия',
      text: 'Обратите внимание на эту кнопку.',
      targetSelector: '#test-play-btn',
      arrowPosition: 'top',
    };

    controller.showStep(step);

    const spotlight = document.querySelector<HTMLElement>('.tut-spotlight');
    expect(spotlight?.style.display).toBe('block');
    // top = 600 - padding(6) = 594px
    expect(spotlight?.style.top).toBe('594px');
    expect(spotlight?.style.left).toBe('194px');

    const arrow = document.querySelector<HTMLElement>('.tut-arrow');
    expect(arrow?.style.display).toBe('block');
    expect(arrow?.className).toContain('tut-arrow--top');
  });

  it('накладывает clip-path на блокировщик при интерактивном шаге', () => {
    const target = document.createElement('div');
    target.id = 'interactive-card';
    document.body.appendChild(target);

    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 400,
      left: 100,
      width: 80,
      height: 120,
      right: 180,
      bottom: 520,
      x: 100,
      y: 400,
      toJSON: () => {},
    });

    const step: TutorialStep = {
      id: 'step-select-card',
      title: 'Выберите карту',
      text: 'Кликните по карте.',
      targetSelector: '#interactive-card',
      requireAction: 'select_card',
    };

    controller.showStep(step);

    const blocker = document.querySelector<HTMLElement>('.tut-click-blocker');
    expect(blocker?.style.clipPath).toContain('polygon');
  });

  it('позволяет динамически менять цель через setTarget()', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      left: 100,
      width: 50,
      height: 50,
      right: 150,
      bottom: 150,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    controller.setTarget(target, 'right');

    const spotlight = document.querySelector<HTMLElement>('.tut-spotlight');
    expect(spotlight?.style.display).toBe('block');

    const arrow = document.querySelector<HTMLElement>('.tut-arrow');
    expect(arrow?.style.display).toBe('block');
    expect(arrow?.className).toContain('tut-arrow--right');

    // Сброс цели
    controller.setTarget(null);
    expect(spotlight?.style.display).toBe('none');
    expect(arrow?.style.display).toBe('none');
  });

  it('скрывает оверлей при вызове hide()', () => {
    const step: TutorialStep = {
      id: 'step-hide',
      title: 'Заголовок',
      text: 'Текст',
    };

    controller.showStep(step);
    expect(controller.isVisible).toBe(true);

    controller.hide();
    expect(controller.isVisible).toBe(false);

    const overlay = document.querySelector('.tut-overlay');
    expect(overlay?.classList.contains('is-visible')).toBe(false);
  });

  it('вызывает onNext при клике на кнопку «Дальше»', () => {
    controller.showStep({
      id: 'step-click',
      title: 'Шаг',
      text: 'Текст',
    });

    const nextBtn = document.querySelector<HTMLButtonElement>('.tut-btn--next');
    nextBtn?.click();

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('вызывает onSkip при клике на кнопку «Пропустить» и верхнюю кнопку пропуска', () => {
    controller.showStep({
      id: 'step-skip',
      title: 'Шаг',
      text: 'Текст',
    });

    const skipBtn = document.querySelector<HTMLButtonElement>('.tut-btn--skip');
    skipBtn?.click();
    expect(onSkip).toHaveBeenCalledTimes(1);

    const topSkipBtn = document.querySelector<HTMLButtonElement>('.tut-skip-top-btn');
    topSkipBtn?.click();
    expect(onSkip).toHaveBeenCalledTimes(2);
  });

  it('обрабатывает клавиши Escape (пропуск) и Enter/Space (дальше)', () => {
    controller.showStep({
      id: 'step-keys',
      title: 'Шаг',
      text: 'Текст',
      requireAction: 'next',
    });

    // Enter
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onNext).toHaveBeenCalledTimes(1);

    // Escape
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('клик по блокировщику при requireAction !== "next" передает outside_click в onAction', () => {
    controller.showStep({
      id: 'step-action',
      title: 'Действие',
      text: 'Текст',
      requireAction: 'select_card',
    });

    const blocker = document.querySelector<HTMLElement>('.tut-click-blocker');
    blocker?.click();

    expect(onAction).toHaveBeenCalledWith('outside_click');
    expect(onNext).not.toHaveBeenCalled();
  });

  it('полностью очищает DOM и слушатели при вызове destroy()', () => {
    expect(document.querySelector('.tut-overlay')).not.toBeNull();

    controller.destroy();

    expect(document.querySelector('.tut-overlay')).toBeNull();

    // Нажатие клавиш больше не вызывает колбэки
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onSkip).not.toHaveBeenCalled();
  });
});
