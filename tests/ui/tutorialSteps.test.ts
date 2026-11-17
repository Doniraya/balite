import { describe, expect, it, vi } from 'vitest';
import {
  createInitialMetaSave,
  createPlayerSaveData,
  mergePlayerSaveData,
  sanitizePlayerSaveData,
} from '../../src/engine/save';
import type { GameSettings, MetaSave } from '../../src/engine/types';
import { createBalitePlatformBridge, loadBaliteSave } from '../../src/platform/baliteSave';
import {
  getTutorialStep,
  getTutorialStepByIndex,
  getTutorialStepIndex,
  getTutorialSteps,
  getTutorialStepsByPhase,
  getTutorialTotalSteps,
  normalizeTutorialEmotion,
  preloadDevTutorialSteps,
  TUTORIAL_STEPS,
  type CanonicalTutorialEmotion,
  type TutorialPhase,
} from '../../src/ui/tutorialSteps';

/**
 * Запрещённые слова и корни для рейтинга 6+/12+ (модерация площадок Яндекс Игры и ВК Игры).
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
  /(?<![а-яё])стрит(?![а-яё])/iu,
  /(?<![а-яё])флеш(?![а-яё])/iu,
  /(?<![а-яё])фулл-?хаус/iu,
  /(?<![а-яё])флеш-?роял/iu,
];

describe('Интерактивный сценарий обучения (src/ui/tutorialSteps.ts)', () => {
  it('содержит ровно 21 детализированный шаг обучения', () => {
    expect(TUTORIAL_STEPS).toHaveLength(21);
    expect(getTutorialTotalSteps()).toBe(21);
  });

  it('каждый шаг имеет уникальный id и заполненные обязательные поля', () => {
    const ids = new Set<string>();
    const validPhases: readonly TutorialPhase[] = ['blind_select', 'playing', 'cashout', 'shop'];
    const validArrows = ['top', 'bottom', 'left', 'right', 'none'];
    const validEmotions = [
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
    const validActions = [
      'next',
      'select_blind',
      'select_card',
      'play_hand',
      'discard',
      'buy_relic',
      'buy_consumable',
      'use_consumable',
      'leave_shop',
    ];

    for (const step of TUTORIAL_STEPS) {
      expect(step.id.trim().length).toBeGreaterThan(0);
      expect(ids.has(step.id)).toBe(false);
      ids.add(step.id);

      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.text.trim().length).toBeGreaterThan(0);
      expect(validPhases).toContain(step.phase);
      expect(validArrows).toContain(step.arrowPosition);
      expect(validEmotions).toContain(step.emotion);
      expect(validActions).toContain(step.requireAction);
      expect(step.speaker).toBe('Мира');
    }
  });

  it('в стандартном режиме (6+/12+) строго соблюдает запреты модерации и не содержит запрещённых слов', () => {
    for (const step of TUTORIAL_STEPS) {
      for (const pattern of FORBIDDEN_RU_PATTERNS) {
        expect(
          pattern.test(step.title),
          `Запрещённое слово ${pattern} найдено в заголовке шага "${step.id}": "${step.title}"`,
        ).toBe(false);

        expect(
          pattern.test(step.text),
          `Запрещённое слово ${pattern} найдено в тексте шага "${step.id}": "${step.text}"`,
        ).toBe(false);
      }
    }
  });

  it('в DEV-режиме использует аутентичные термины Balatro и рассказчика Джимбо', async () => {
    await preloadDevTutorialSteps();
    const devSteps = getTutorialSteps(true);
    expect(devSteps).toHaveLength(21);

    for (const step of devSteps) {
      expect(step.speaker).toBe('Джимбо');
    }

    const firstStep = devSteps[0]!;
    expect(firstStep.text).toContain('Джимбо');
    expect(firstStep.text).toContain('Анте');
    expect(firstStep.text).toContain('Блайнды');

    const formulaStep = devSteps.find((s) => s.id === 'scoring_formula_deep')!;
    expect(formulaStep.text).toContain('фишки');
    expect(formulaStep.text).toContain('множитель');

    const proTipStep = devSteps.find((s) => s.id === 'relic_order_pro_tip')!;
    expect(proTipStep.text).toContain('Джокеры активируются строго');
  });

  it('детально раскрывает ключевые математические и экономические механики игры', () => {
    // 1. Формула очков
    const formulaStep = TUTORIAL_STEPS.find((s) => s.id === 'scoring_formula_deep')!;
    expect(formulaStep.text).toContain('Сила');
    expect(formulaStep.text).toContain('Множитель');
    expect(formulaStep.text).toContain('40');

    // 2. Вклад рангов карт
    const rankStep = TUTORIAL_STEPS.find((s) => s.id === 'card_rank_chips')!;
    expect(rankStep.text).toContain('+10');
    expect(rankStep.text).toContain('+11');

    // 3. Комбинации карт (канонические термины 6+/12+: Ряд, Масть, Полный строй)
    const combStep = TUTORIAL_STEPS.find((s) => s.id === 'hand_combinations_guide')!;
    expect(combStep.text).toContain('Ряда');
    expect(combStep.text).toContain('Масти');
    expect(combStep.text).toContain('Полного строя');
    expect(combStep.text).toContain('Мастного ряда');

    // 4. Сброс карт и предупреждение о невозврате
    const discardStep = TUTORIAL_STEPS.find((s) => s.id === 'discards_and_sorting')!;
    expect(discardStep.text).toContain('сброшенные карты уходят в отбой');
    expect(discardStep.text).toContain('По рангу');
    expect(discardStep.text).toContain('По масти');

    // 5. Кэшаут и проценты
    const cashoutStep = TUTORIAL_STEPS.find((s) => s.id === 'cashout_and_interest')!;
    expect(cashoutStep.text).toContain('каждые 5 з.');
    expect(cashoutStep.text).toContain('максимума в 5 з.');

    // 6. Лавка, Навыки и редкость B/A/S
    const shopStep = TUTORIAL_STEPS.find((s) => s.id === 'guild_shop_relics_rarity')!;
    expect(shopStep.text).toContain('B (Обычные)');
    expect(shopStep.text).toContain('A (Необычные)');
    expect(shopStep.text).toContain('S (Редкие)');
    expect(shopStep.text).toContain('Навыки');

    // 7. Порядок навыков: слева направо (про-тип)
    const orderStep = TUTORIAL_STEPS.find((s) => s.id === 'relic_order_pro_tip')!;
    expect(orderStep.text).toContain('слева направо');
    expect(orderStep.text).toContain('60');
    expect(orderStep.text).toContain('40');

    // 8. Расходники (Фолианты, Свитки Кузни, Карты Пандоры)
    const consStep = TUTORIAL_STEPS.find((s) => s.id === 'consumables_overview')!;
    expect(consStep.text).toContain('Фолианты');
    expect(consStep.text).toContain('Свитки Кузни');
    expect(consStep.text).toContain('Карты Пандоры');

    // 9. Привилегии гильдии
    const voucherStep = TUTORIAL_STEPS.find((s) => s.id === 'vouchers_privileges')!;
    expect(voucherStep.text).toContain('Привилегия гильдии');

    // 10. Пропуск и Босс-монстр
    const skipStep = TUTORIAL_STEPS.find((s) => s.id === 'skip_blind_and_tags')!;
    expect(skipStep.text).toContain('Талон');
    const bossStep = TUTORIAL_STEPS.find((s) => s.id === 'boss_blind_warning')!;
    expect(bossStep.text).toContain('Босса-монстра пропустить нельзя');

    // 11. Использование расходников в бою
    const useStep = TUTORIAL_STEPS.find((s) => s.id === 'combat_consumables_usage')!;
    expect(useStep.text).toContain('Использовать');
  });

  it('вспомогательные функции поиска корректно находят шаги по id, индексу и фазе', () => {
    const welcome = getTutorialStep('welcome_guild');
    expect(welcome).toBeDefined();
    expect(welcome?.title).toBe('Добро пожаловать в Гильдию!');

    expect(getTutorialStepIndex('welcome_guild')).toBe(0);
    expect(getTutorialStepIndex('non_existent')).toBe(-1);

    const step1 = getTutorialStepByIndex(1);
    expect(step1?.id).toBe('blind_select_overview');
    expect(getTutorialStepByIndex(999)).toBeUndefined();

    const shopSteps = getTutorialStepsByPhase('shop');
    expect(shopSteps.length).toBeGreaterThan(5);
    for (const step of shopSteps) {
      expect(step.phase).toBe('shop');
    }
  });

  it('задействует полный спектр из 8 канонических эмоций маскота Миры', () => {
    const canonicalSet = new Set<CanonicalTutorialEmotion>([
      'welcome',
      'guide_cards',
      'guide_book',
      'guide_point',
      'guide',
      'happy',
      'worried',
      'idle',
    ]);

    const usedEmotions = new Set(TUTORIAL_STEPS.map((s) => s.emotion));
    for (const canonical of canonicalSet) {
      expect(
        usedEmotions.has(canonical),
        `Эмоция ${canonical} не задействована ни в одном шаге обучения`,
      ).toBe(true);
    }

    // Проверяем работу нормализации legacy-эмоций
    expect(normalizeTutorialEmotion('neutral')).toBe('idle');
    expect(normalizeTutorialEmotion('thinking')).toBe('guide_point');
    expect(normalizeTutorialEmotion('warning')).toBe('worried');
    expect(normalizeTutorialEmotion('happy')).toBe('happy');
    expect(normalizeTutorialEmotion('welcome')).toBe('welcome');
  });

  it('все целевые селекторы targetSelector являются валидными CSS-селекторами', () => {
    for (const step of TUTORIAL_STEPS) {
      if (step.targetSelector) {
        expect(() => document.querySelector(step.targetSelector!)).not.toThrow();
      }
    }
  });
});

describe('Поддержка tutorialCompleted и tutorialStep в схеме сохранений', () => {
  it('GameSettings и MetaSave безопасно хранят флаги обучения', () => {
    const settings: GameSettings = {
      animationSpeed: 1,
      lang: 'ru',
      soundEnabled: true,
      crtMode: 'off',
      tutorialCompleted: false,
      tutorialStep: 5,
    };
    expect(settings.tutorialCompleted).toBe(false);
    expect(settings.tutorialStep).toBe(5);

    const meta: MetaSave = {
      version: 1,
      revision: 1,
      updatedAt: 1000,
      settings,
      unlockedDecks: ['b_red'],
      discoveredRelics: [],
      discoveredConsumables: [],
      discoveredCharters: [],
      discoveredBosses: [],
      stats: {
        runsStarted: 0,
        runsWon: 0,
        highestAnte: 0,
        highestRound: 0,
        bestHandScore: 0,
        maxDollars: 0,
        bestWinStreak: 0,
        currentWinStreak: 0,
        totalHandsPlayed: 0,
        handPlayCounts: {},
      },
      tutorialCompleted: true,
      tutorialStep: 12,
    };

    expect(meta.tutorialCompleted).toBe(true);
    expect(meta.tutorialStep).toBe(12);
  });

  it('createInitialMetaSave принимает tutorialCompleted и tutorialStep', () => {
    const initial = createInitialMetaSave(1000, {
      tutorialCompleted: false,
      tutorialStep: 3,
    });

    expect(initial.tutorialCompleted).toBe(false);
    expect(initial.tutorialStep).toBe(3);
    expect(initial.settings.tutorialCompleted).toBe(false);
    expect(initial.settings.tutorialStep).toBe(3);
  });

  it('sanitizePlayerSaveData сохраняет и санитизирует поля обучения', () => {
    const rawData = {
      version: 1,
      revision: 2,
      updatedAt: 2000,
      meta: {
        version: 1,
        revision: 2,
        updatedAt: 2000,
        settings: {
          animationSpeed: 1,
          lang: 'ru',
          soundEnabled: true,
          crtMode: 'off',
          tutorialCompleted: true,
          tutorialStep: 7.8, // должно округлиться до 7
        },
        tutorialCompleted: true,
        tutorialStep: 7.8,
        unlockedDecks: ['b_red'],
        discoveredRelics: [],
        discoveredConsumables: [],
        discoveredCharters: [],
        discoveredBosses: [],
        stats: {},
      },
    };

    const sanitized = sanitizePlayerSaveData(rawData);
    expect(sanitized.meta?.tutorialCompleted).toBe(true);
    expect(sanitized.meta?.tutorialStep).toBe(7);
    expect(sanitized.meta?.settings.tutorialCompleted).toBe(true);
    expect(sanitized.meta?.settings.tutorialStep).toBe(7);
  });

  it('mergePlayerSaveData монотонно объединяет прогресс обучения (true wins, max step)', () => {
    const local = createPlayerSaveData(
      createInitialMetaSave(1000, { tutorialCompleted: false, tutorialStep: 4 }),
      null,
      1,
      1000,
    );
    const cloud = createPlayerSaveData(
      createInitialMetaSave(1000, { tutorialCompleted: true, tutorialStep: 8 }),
      null,
      1,
      1000,
    );

    const merged = mergePlayerSaveData(local, cloud);
    expect(merged.meta?.tutorialCompleted).toBe(true);
    expect(merged.meta?.tutorialStep).toBe(8);
  });

  it('loadBaliteSave корректно синхронизирует поля обучения при первом запуске', async () => {
    const bridge = createBalitePlatformBridge();
    bridge.loadPlayerData = vi.fn(async () => ({}));

    const loaded = await loadBaliteSave(bridge, {
      nowMs: 12345,
      tutorialCompleted: false,
      tutorialStep: 0,
    });

    expect(loaded.meta.tutorialCompleted).toBe(false);
    expect(loaded.meta.tutorialStep).toBe(0);
    expect(loaded.meta.settings.tutorialCompleted).toBe(false);
    expect(loaded.meta.settings.tutorialStep).toBe(0);
  });
});
