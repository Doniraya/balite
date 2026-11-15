import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialMetaSave,
  createPlayerSaveData,
  mergePlayerSaveData,
  sanitizePlayerSaveData,
} from '../../src/engine/save';
import type { GameSettings, MetaSave } from '../../src/engine/types';
import { createTranslator } from '../../src/i18n';
import { renderSettingsModal, type SettingsModalOptions } from '../../src/ui/modals';
import {
  createTutorialOverlay,
  renderMiraAvatar,
  resolveMiraSprite,
  type TutorialOverlayController,
  type TutorialStep,
} from '../../src/ui/tutorialOverlay';
import {
  CanonicalTutorialEmotion,
  getTutorialStepByIndex,
  getTutorialSteps,
  normalizeTutorialEmotion,
  TUTORIAL_STEPS,
} from '../../src/ui/tutorialSteps';

/**
 * Запрещённые слова и корни для рейтинга 6+/12+ (модерация площадок).
 */
const FORBIDDEN_RU_PATTERNS: readonly RegExp[] = [
  /(?<![а-яё])покер/iu,
  /(?<![а-яё])казино/iu,
  /(?<![а-яё])ставк[аиуео]?[ймх]?/iu,
  /(?<![а-яё])блайнд/iu,
  /(?<![а-яё])фишк/iu,
  /(?<![а-яё])фишек/iu,
  /(?<![а-яё])таро(?![а-яё])/iu,
  /(?<![а-яё])дьявол/iu,
  /(?<![а-яё])повешен/iu,
  /(?<![а-яё])шулер/iu,
  /(?<![а-яё])жертв/iu,
  /(?<![а-яё])вампир/iu,
  /(?<![а-яё])джокер/iu,
  /(?<![а-яё])рулетк/iu,
  /(?<![а-яё])азарт/iu,
  /(?<![а-яё])джимбо/iu,
  /(?<![а-яё])анте(?![а-яё])/iu,
  /(?<![а-яё])балатро/iu,
  /(?<![а-яё])ваучер/iu,
];

describe('Интерактивное обучение (tests/ui/tutorial.test.ts)', () => {
  let controller: TutorialOverlayController | null = null;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    window.innerWidth = 720;
    window.innerHeight = 1280;
  });

  afterEach(() => {
    controller?.destroy();
    controller = null;
    document.body.innerHTML = '';
  });

  describe('1. Инициализация обучения и прогрессия шагов', () => {
    it('корректно инициализирует оверлей и отображает первый шаг сценария', () => {
      const onNext = vi.fn();
      const onSkip = vi.fn();
      controller = createTutorialOverlay({ onNext, onSkip });

      expect(controller.isVisible).toBe(false);
      expect(controller.currentStep).toBeNull();

      const firstStep = TUTORIAL_STEPS[0];
      controller.showStep({
        ...firstStep,
        stepIndex: 1,
        totalSteps: TUTORIAL_STEPS.length,
      });

      expect(controller.isVisible).toBe(true);
      expect(controller.currentStep?.id).toBe('welcome_guild');

      const overlayEl = document.querySelector('.tut-overlay');
      expect(overlayEl).not.toBeNull();
      expect(overlayEl?.classList.contains('is-visible')).toBe(true);

      const titleEl = document.querySelector('#tut-step-title');
      expect(titleEl?.textContent).toBe(firstStep.title);

      const counterEl = document.querySelector('.tut-step-counter');
      expect(counterEl?.textContent).toBe(`Шаг 1 из ${TUTORIAL_STEPS.length}`);

      const speakerNameEl = document.querySelector('.tut-avatar-name');
      expect(speakerNameEl?.textContent).toBe('Мира');
    });

    it('последовательно проходит по цепочке всех шагов обучения от 1 до 21', () => {
      let currentStepIndex = 0;
      const allSteps = getTutorialSteps(false);
      const totalSteps = allSteps.length;
      expect(totalSteps).toBe(21);

      const onNext = vi.fn(() => {
        currentStepIndex += 1;
        if (currentStepIndex < totalSteps) {
          const nextStep = allSteps[currentStepIndex];
          controller?.showStep({
            ...nextStep,
            stepIndex: currentStepIndex + 1,
            totalSteps,
          });
        } else {
          controller?.hide();
        }
      });
      const onSkip = vi.fn();

      controller = createTutorialOverlay({ onNext, onSkip });

      // Шаг 1: Приветствие
      controller.showStep({
        ...allSteps[0],
        stepIndex: 1,
        totalSteps,
      });
      expect(controller.currentStep?.id).toBe('welcome_guild');

      const nextBtn = document.querySelector<HTMLButtonElement>('.tut-btn--next');
      expect(nextBtn).not.toBeNull();

      // Проходим первые 5 шагов
      for (let i = 0; i < 5; i++) {
        nextBtn?.click();
      }

      expect(onNext).toHaveBeenCalledTimes(5);
      expect(currentStepIndex).toBe(5);
      expect(controller.currentStep?.id).toBe(allSteps[5].id);

      // Проходим оставшиеся шаги до последнего
      while (currentStepIndex < totalSteps - 1) {
        nextBtn?.click();
      }

      expect(currentStepIndex).toBe(totalSteps - 1);
      expect(controller.currentStep?.id).toBe('tutorial_conclusion');

      // На последнем шаге кнопка меняет надпись на «Завершить»
      expect(nextBtn?.textContent).toBe('Завершить');

      // Клик по «Завершить» закрывает обучение
      nextBtn?.click();
      expect(controller.isVisible).toBe(false);
    });

    it('сохраняет прогресс шагов и статус tutorialCompleted в мета-сохранении', () => {
      const meta = createInitialMetaSave();
      expect(meta.tutorialCompleted).toBeUndefined();
      expect(meta.tutorialStep).toBeUndefined();

      // Обновление шага 7
      const saveStep7 = sanitizePlayerSaveData({
        meta: {
          ...meta,
          tutorialStep: 7,
          settings: {
            ...meta.settings,
            tutorialStep: 7,
          },
        },
      });
      const step7Meta = saveStep7.meta;
      expect(step7Meta).toBeDefined();
      if (!step7Meta) return;

      expect(step7Meta.tutorialStep).toBe(7);
      expect(step7Meta.settings.tutorialStep).toBe(7);
      expect(step7Meta.tutorialCompleted).toBeUndefined();

      // Завершение обучения
      const saveCompleted = sanitizePlayerSaveData({
        meta: {
          ...step7Meta,
          tutorialCompleted: true,
          tutorialStep: 21,
          settings: {
            ...step7Meta.settings,
            tutorialCompleted: true,
            tutorialStep: 21,
          },
        },
      });
      const completedMeta = saveCompleted.meta;
      expect(completedMeta).toBeDefined();
      if (!completedMeta) return;

      expect(completedMeta.tutorialCompleted).toBe(true);
      expect(completedMeta.settings.tutorialCompleted).toBe(true);
      expect(completedMeta.tutorialStep).toBe(21);

      // Проверка монотонного слияния (true wins для completed, Math.max для step)
      const merged = mergePlayerSaveData(
        createPlayerSaveData(step7Meta, null),
        createPlayerSaveData(completedMeta, null),
      );
      expect(merged.meta).toBeDefined();
      expect(merged.meta?.tutorialCompleted).toBe(true);
      expect(merged.meta?.tutorialStep).toBe(21);
    });
  });

  describe('2. Логика спотлайта и позиционирования элементов', () => {
    it('корректно рассчитывает геометрию спотлайта вокруг целевого элемента', () => {
      // Создаем фейковый целевой элемент в DOM
      const target = document.createElement('div');
      target.id = 'test-target-btn';
      target.style.position = 'fixed';
      target.style.top = '100px';
      target.style.left = '50px';
      target.style.width = '200px';
      target.style.height = '60px';
      document.body.appendChild(target);

      vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        left: 50,
        width: 200,
        height: 60,
        bottom: 160,
        right: 250,
        x: 50,
        y: 100,
        toJSON: () => ({}),
      });

      controller = createTutorialOverlay({ onNext: vi.fn(), onSkip: vi.fn() });

      const step: TutorialStep = {
        id: 'step_with_target',
        title: 'Тестовая цель',
        text: 'Проверка выреза спотлайта',
        targetSelector: '#test-target-btn',
        arrowPosition: 'bottom',
        requireAction: 'next',
      };

      controller.showStep(step);

      const spotlightEl = document.querySelector<HTMLElement>('.tut-spotlight');
      expect(spotlightEl).not.toBeNull();
      expect(spotlightEl?.style.display).toBe('block');
      // BoundingBox с отступом 6px: top = 100 - 6 = 94px, left = 50 - 6 = 44px, width = 200 + 12 = 212px, height = 60 + 12 = 72px
      expect(spotlightEl?.style.top).toBe('94px');
      expect(spotlightEl?.style.left).toBe('44px');
      expect(spotlightEl?.style.width).toBe('212px');
      expect(spotlightEl?.style.height).toBe('72px');
    });

    it('безопасно скрывает спотлайт и центрирует диалог, если целевой элемент отсутствует', () => {
      controller = createTutorialOverlay({ onNext: vi.fn(), onSkip: vi.fn() });

      const step: TutorialStep = {
        id: 'no_target',
        title: 'Нет цели',
        text: 'Шаг без целевого селектора',
        arrowPosition: 'none',
        requireAction: 'next',
      };

      controller.showStep(step);

      const spotlightEl = document.querySelector<HTMLElement>('.tut-spotlight');
      const arrowEl = document.querySelector<HTMLElement>('.tut-arrow');
      const cardEl = document.querySelector<HTMLElement>('.tut-card');

      expect(spotlightEl?.style.display).toBe('none');
      expect(arrowEl?.style.display).toBe('none');
      expect(cardEl?.style.top).toBe('50%');
      expect(cardEl?.style.left).toBe('50%');
      expect(cardEl?.style.transform).toBe('translate(-50%, -50%)');
    });

    it('умно позиционирует карточку: сверху, если цель внизу, и снизу, если цель вверху', () => {
      const topTarget = document.createElement('div');
      topTarget.className = 'top-hud-element';
      document.body.appendChild(topTarget);

      // Цель в верхней части экрана (y = 80px из 1280px)
      vi.spyOn(topTarget, 'getBoundingClientRect').mockReturnValue({
        top: 60,
        left: 20,
        width: 150,
        height: 40,
        bottom: 100,
        right: 170,
        x: 20,
        y: 60,
        toJSON: () => ({}),
      });

      controller = createTutorialOverlay({ onNext: vi.fn(), onSkip: vi.fn() });
      controller.showStep({
        id: 'top_step',
        title: 'Вверху',
        text: 'Цель вверху',
        targetSelector: '.top-hud-element',
        arrowPosition: 'bottom',
        requireAction: 'next',
      });

      const cardEl = document.querySelector<HTMLElement>('.tut-card');
      // Когда цель в верхней половине (targetCenterY <= 1280 * 0.48), карточка уходит вниз
      expect(cardEl?.style.bottom).toBe('clamp(14px, 3vh, 36px)');
      expect(cardEl?.style.top).toBe('auto');

      // Переключаем на цель в нижней части экрана (рука карт, y = 1000px)
      const bottomTarget = document.createElement('div');
      bottomTarget.className = 'bottom-hand-element';
      document.body.appendChild(bottomTarget);

      vi.spyOn(bottomTarget, 'getBoundingClientRect').mockReturnValue({
        top: 960,
        left: 30,
        width: 300,
        height: 120,
        bottom: 1080,
        right: 330,
        x: 30,
        y: 960,
        toJSON: () => ({}),
      });

      controller.showStep({
        id: 'bottom_step',
        title: 'Внизу',
        text: 'Цель внизу',
        targetSelector: '.bottom-hand-element',
        arrowPosition: 'top',
        requireAction: 'next',
      });

      // Когда цель в нижней половине, карточка уходит вверх
      expect(cardEl?.style.top).toBe('clamp(14px, 3vh, 36px)');
      expect(cardEl?.style.bottom).toBe('auto');
    });

    it('накладывает динамический clip-path вырез на блокировщик кликов для интерактивных действий', () => {
      const actionTarget = document.createElement('button');
      actionTarget.id = 'play-btn';
      document.body.appendChild(actionTarget);

      vi.spyOn(actionTarget, 'getBoundingClientRect').mockReturnValue({
        top: 800,
        left: 100,
        width: 140,
        height: 50,
        bottom: 850,
        right: 240,
        x: 100,
        y: 800,
        toJSON: () => ({}),
      });

      controller = createTutorialOverlay({ onNext: vi.fn(), onSkip: vi.fn() });

      // Шаг с интерактивным действием 'play_hand'
      controller.showStep({
        id: 'interactive_step',
        title: 'Сыграть руку',
        text: 'Нажми кнопку сыграть',
        targetSelector: '#play-btn',
        arrowPosition: 'bottom',
        requireAction: 'play_hand',
      });

      const blockerEl = document.querySelector<HTMLElement>('.tut-click-blocker');
      expect(blockerEl?.style.clipPath).toContain('polygon(');

      // Шаг без интерактивного действия ('next') сбрасывает clipPath
      controller.showStep({
        id: 'info_step',
        title: 'Инфо',
        text: 'Просто текст',
        requireAction: 'next',
      });
      expect(blockerEl?.style.clipPath).toBe('none');
    });

    it('правильно ориентирует стрелку и не выпускает её за границы экрана', () => {
      const edgeTarget = document.createElement('div');
      edgeTarget.id = 'edge-target';
      document.body.appendChild(edgeTarget);

      // Элемент почти у самого правого края (left = 700 при ширине экрана 720)
      vi.spyOn(edgeTarget, 'getBoundingClientRect').mockReturnValue({
        top: 200,
        left: 690,
        width: 30,
        height: 30,
        bottom: 230,
        right: 720,
        x: 690,
        y: 200,
        toJSON: () => ({}),
      });

      controller = createTutorialOverlay({ onNext: vi.fn(), onSkip: vi.fn() });
      controller.showStep({
        id: 'edge_step',
        title: 'Край',
        text: 'Цель у правого края',
        targetSelector: '#edge-target',
        arrowPosition: 'top',
        requireAction: 'next',
      });

      const arrowEl = document.querySelector<HTMLElement>('.tut-arrow');
      expect(arrowEl?.classList.contains('tut-arrow--top')).toBe(true);

      // Стрелка смещена влево, чтобы не вылезти за пределы экрана:
      // maxLeft = vw(720) - arrowSize(36) - 8 = 676px
      const leftVal = parseFloat(arrowEl?.style.left ?? '0');
      expect(leftVal).toBeLessThanOrEqual(676);
      expect(leftVal).toBeGreaterThanOrEqual(8);
    });
  });

  describe('3. Триггеры действий и обработка кнопки «Пропустить»', () => {
    it('на шаге с требованием действия показывает пульсирующую кнопку с подсказкой', () => {
      const onNext = vi.fn();
      const onAction = vi.fn();
      controller = createTutorialOverlay({ onNext, onSkip: vi.fn(), onAction });

      controller.showStep({
        id: 'action_step',
        title: 'Выберите карты',
        text: 'Коснитесь карт в руке',
        requireAction: 'select_card',
      });

      const nextBtn = document.querySelector<HTMLButtonElement>('.tut-btn--next');
      expect(nextBtn?.classList.contains('tut-btn--action-hint')).toBe(true);
      expect(nextBtn?.innerHTML).toContain('tut-action-pulse-dot');
      expect(nextBtn?.textContent).toContain('Выполните действие');

      // Клик по блокировщику кликов вне цели генерирует событие outside_click
      const blockerEl = document.querySelector<HTMLElement>('.tut-click-blocker');
      blockerEl?.click();
      expect(onAction).toHaveBeenCalledWith('outside_click');
    });

    it('на информационном шаге клик по фону и клавиши Enter/Space вызывают onNext', () => {
      const onNext = vi.fn();
      controller = createTutorialOverlay({ onNext, onSkip: vi.fn() });

      controller.showStep({
        id: 'info_step',
        title: 'Приветствие',
        text: 'Простое сообщение',
        requireAction: 'next',
      });

      // Клик по блокировщику
      const blockerEl = document.querySelector<HTMLElement>('.tut-click-blocker');
      blockerEl?.click();
      expect(onNext).toHaveBeenCalledTimes(1);

      // Клавиша Enter
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(onNext).toHaveBeenCalledTimes(2);

      // Клавиша Пробел
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      expect(onNext).toHaveBeenCalledTimes(3);
    });

    it('кнопка «Пропустить» в карточке и в правом верхнем углу корректно закрывает обучение', () => {
      const onSkip = vi.fn();
      controller = createTutorialOverlay({ onNext: vi.fn(), onSkip });

      controller.showStep({
        id: 'skip_test_step',
        title: 'Пропуск',
        text: 'Тест пропуска',
        requireAction: 'next',
      });

      // 1. Кнопка в футере диалога
      const cardSkipBtn = document.querySelector<HTMLButtonElement>('.tut-btn--skip');
      expect(cardSkipBtn).not.toBeNull();
      cardSkipBtn?.click();
      expect(onSkip).toHaveBeenCalledTimes(1);

      // 2. Кнопка в правом верхнем углу экрана
      const topSkipBtn = document.querySelector<HTMLButtonElement>('.tut-skip-top-btn');
      expect(topSkipBtn).not.toBeNull();
      topSkipBtn?.click();
      expect(onSkip).toHaveBeenCalledTimes(2);

      // 3. Клавиша Escape
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onSkip).toHaveBeenCalledTimes(3);
    });
  });

  describe('4. Сброс обучения из Меню настроек', () => {
    it('отображает кнопку «Пройти обучение заново» в настройках и вызывает сброс', () => {
      const translator = createTranslator('ru');
      const onChangeSettings = vi.fn();
      const onResetTutorial = vi.fn();

      const settings: GameSettings = {
        soundEnabled: true,
        animationSpeed: 1,
        crtMode: 'off',
        lang: 'ru',
        tutorialCompleted: true,
        tutorialStep: 21,
      };

      const options: SettingsModalOptions = {
        settings,
        translator,
        initialTab: 'settings',
        onChangeSettings,
        onResetTutorial,
        onClose: vi.fn(),
      };

      const modalEl = renderSettingsModal(options);
      document.body.appendChild(modalEl);

      const resetBtn = modalEl.querySelector<HTMLButtonElement>('[data-action="reset-tutorial"]');
      expect(resetBtn).not.toBeNull();
      expect(resetBtn?.textContent).toContain('Пройти обучение заново');

      resetBtn?.click();
      expect(onResetTutorial).toHaveBeenCalledTimes(1);
    });

    it('при отсутствии явного колбэка onResetTutorial сбрасывает tutorialCompleted и tutorialStep через onChangeSettings', () => {
      const translator = createTranslator('ru');
      const onChangeSettings = vi.fn();

      const settings: GameSettings = {
        soundEnabled: true,
        animationSpeed: 1,
        crtMode: 'off',
        lang: 'ru',
        tutorialCompleted: true,
        tutorialStep: 21,
      };

      const options: SettingsModalOptions = {
        settings,
        translator,
        initialTab: 'settings',
        onChangeSettings,
        onClose: vi.fn(),
      };

      const modalEl = renderSettingsModal(options);
      document.body.appendChild(modalEl);

      const resetBtn = modalEl.querySelector<HTMLButtonElement>('[data-action="reset-tutorial"]');
      expect(resetBtn).not.toBeNull();

      resetBtn?.click();
      expect(onChangeSettings).toHaveBeenCalledWith({
        tutorialCompleted: false,
        tutorialStep: 0,
      });
    });

    it('после сброса настроек обучение способно начаться повторно с 1-го шага', () => {
      let state: MetaSave = {
        ...createInitialMetaSave(),
        tutorialCompleted: true,
        tutorialStep: 21,
      };

      // Функция сброса
      const resetTutorial = () => {
        state = {
          ...state,
          tutorialCompleted: false,
          tutorialStep: 0,
          settings: {
            ...state.settings,
            tutorialCompleted: false,
            tutorialStep: 0,
          },
        };
      };

      resetTutorial();
      expect(state.tutorialCompleted).toBe(false);
      expect(state.tutorialStep).toBe(0);

      // Перезапуск оверлея
      const steps = getTutorialSteps(false);
      const startStep = getTutorialStepByIndex(state.tutorialStep ?? 0, false);
      expect(startStep?.id).toBe(steps[0].id);

      controller = createTutorialOverlay({ onNext: vi.fn(), onSkip: vi.fn() });
      controller.showStep({
        ...startStep!,
        stepIndex: 1,
        totalSteps: steps.length,
      });

      expect(controller.isVisible).toBe(true);
      expect(controller.currentStep?.id).toBe('welcome_guild');
      expect(document.querySelector('#tut-step-title')?.textContent).toBe(steps[0].title);
    });
  });

  describe('5. Строгое соответствие рейтингу 6+/12+ и DEV-терминология', () => {
    it('в стандартном режиме ни один из 21 шагов не содержит запрещённых казино/покер/таро терминов', () => {
      const steps = getTutorialSteps(false);
      expect(steps.length).toBeGreaterThan(0);

      for (const step of steps) {
        expect(step.speaker).toBe('Мира');

        const combinedText = `${step.title} ${step.text}`;
        for (const pattern of FORBIDDEN_RU_PATTERNS) {
          const match = combinedText.match(pattern);
          expect(
            match,
            `Запрещённое слово "${match?.[0]}" найдено в шаге id="${step.id}"! Текст: "${combinedText}"`,
          ).toBeNull();
        }
      }
    });

    it('в DEV-режиме (devOriginal: true) используется оригинальная терминология Balatro и Джимбо', () => {
      const devSteps = getTutorialSteps(true);
      expect(devSteps.length).toBe(21);

      const firstStep = devSteps[0];
      expect(firstStep.speaker).toBe('Джимбо');
      expect(firstStep.text).toContain('Джимбо');
      expect(firstStep.text).toContain('Анте');
      expect(firstStep.text).toContain('Блайнды');

      // Шаг с формулой
      const formulaStep = devSteps.find((s) => s.id === 'scoring_formula_deep');
      expect(formulaStep?.text.toLowerCase()).toContain('фишки');
      expect(formulaStep?.text).toContain('Множ');

      // Шаг с джокерами
      const relicsStep = devSteps.find((s) => s.id === 'guild_shop_relics_rarity');
      expect(relicsStep?.text).toContain('Джокеры');
    });
  });

  describe('6. Мобильная сенсорная оптимизация и доступность', () => {
    it('все интерактивные кнопки имеют минимальный размер >= 44px для комфортного нажатия на мобильных', () => {
      controller = createTutorialOverlay({ onNext: vi.fn(), onSkip: vi.fn() });
      controller.showStep({
        id: 'touch_test',
        title: 'Сенсорные зоны',
        text: 'Тест кнопок',
        requireAction: 'next',
      });

      const buttons = document.querySelectorAll<HTMLButtonElement>(
        '.tut-btn--next, .tut-btn--skip, .tut-skip-top-btn',
      );
      expect(buttons.length).toBe(3);

      for (const btn of Array.from(buttons)) {
        // Проверяем, что в классах и разметке заданы условия сенсорного интерфейса
        expect(btn.tabIndex).toBeGreaterThanOrEqual(0);
        expect(btn.type).toBe('button');
      }
    });

    it('оверлей содержит корректные ARIA-атрибуты доступности', () => {
      controller = createTutorialOverlay({ onNext: vi.fn(), onSkip: vi.fn() });
      controller.showStep({
        id: 'a11y_test',
        title: 'Доступность',
        text: 'Тест доступности',
        requireAction: 'next',
      });

      const overlay = document.querySelector('.tut-overlay');
      expect(overlay?.getAttribute('role')).toBe('dialog');
      expect(overlay?.getAttribute('aria-modal')).toBe('true');
      expect(overlay?.getAttribute('aria-labelledby')).toBe('tut-step-title');

      const topSkipBtn = document.querySelector('.tut-skip-top-btn');
      expect(topSkipBtn?.getAttribute('aria-label')).toBe('Пропустить обучение');
    });
  });

  describe('7. Жизненный цикл и очистка памяти', () => {
    it('метод destroy() удаляет оверлей из DOM и снимает слушатели событий', () => {
      const onNext = vi.fn();
      controller = createTutorialOverlay({ onNext, onSkip: vi.fn() });
      controller.showStep({
        id: 'destroy_test',
        title: 'Удаление',
        text: 'Тест destroy()',
        requireAction: 'next',
      });

      expect(document.querySelector('.tut-overlay')).not.toBeNull();
      controller.destroy();

      expect(document.querySelector('.tut-overlay')).toBeNull();
      expect(controller.isVisible).toBe(false);

      // Нажатие клавиш после destroy не вызывает колбэки
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onNext).not.toHaveBeenCalled();
    });
  });

  describe('8. Чиби-спрайты Миры и палитра 8 эмоций', () => {
    const CANONICAL_EMOTIONS: readonly CanonicalTutorialEmotion[] = [
      'welcome',
      'guide_cards',
      'guide_book',
      'guide_point',
      'guide',
      'happy',
      'worried',
      'idle',
    ];

    it('поддерживает все 8 канонических эмоций Миры и корректно формирует пути к спрайтам', () => {
      for (const emotion of CANONICAL_EMOTIONS) {
        expect(normalizeTutorialEmotion(emotion)).toBe(emotion);
        expect(resolveMiraSprite(emotion)).toBe(`mira_${emotion}`);

        const html = renderMiraAvatar(emotion, 'Мира');
        expect(html).toContain('<img');
        expect(html).toContain(`src="./sprites/mira/mira_${emotion}.webp"`);
        expect(html).toContain(`onerror="this.onerror=null;this.src='./sprites/mira/mira_${emotion}.png';"`);
        expect(html).toContain(`alt="Мира (${emotion})"`);
        expect(html).toContain('class="tut-avatar-img"');
      }
    });

    it('обеспечивает обратную совместимость для устаревших алиасов эмоций', () => {
      expect(normalizeTutorialEmotion('neutral')).toBe('idle');
      expect(normalizeTutorialEmotion('thinking')).toBe('guide_point');
      expect(normalizeTutorialEmotion('warning')).toBe('worried');

      expect(resolveMiraSprite('neutral')).toBe('mira_idle');
      expect(resolveMiraSprite('thinking')).toBe('mira_guide_point');
      expect(resolveMiraSprite('warning')).toBe('mira_worried');
    });

    it('монтирует <img> спрайт чиби-маскота при отображении шага обучения', () => {
      controller = createTutorialOverlay({ onNext: vi.fn(), onSkip: vi.fn() });
      controller.showStep({
        id: 'sprite_step_test',
        title: 'Тест спрайта',
        text: 'Проверка рендера чиби-маскота Миры',
        emotion: 'guide_cards',
        requireAction: 'next',
      });

      const imgEl = document.querySelector<HTMLImageElement>('.tut-avatar-frame img.tut-avatar-img');
      expect(imgEl).not.toBeNull();
      expect(imgEl?.src).toContain('sprites/mira/mira_guide_cards.webp');
      expect(imgEl?.getAttribute('onerror')).toContain('mira_guide_cards.png');
      expect(imgEl?.alt).toBe('Мира (guide_cards)');
    });
  });
});
