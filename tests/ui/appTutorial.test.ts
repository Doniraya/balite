import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialMetaSave,
  createPlayerSaveData,
  serializeRunStateToSnapshot,
} from '../../src/engine/save';
import { createInitialRunState } from '../../src/engine/run';
import type { PlayerSaveData, RunState } from '../../src/engine/types';
import type { PlatformBridge, PlatformEventListener } from '../../src/platform/types';
import { createAudioUnlockController } from '../../src/platform/audioUnlock';
import { type BaliteAppHandle, mountBaliteApp } from '../../src/ui/app';

/**
 * Создаёт легковесный мок-мост платформы для тестов жизненного цикла приложения.
 */
function createMockBridge(initialSave?: PlayerSaveData | null): {
  bridge: PlatformBridge<PlayerSaveData>;
  savePlayerData: ReturnType<typeof vi.fn>;
} {
  const audio = createAudioUnlockController();
  let saved = initialSave ?? null;
  const savePlayerData = vi.fn(async (data: PlayerSaveData) => {
    saved = data;
    return true;
  });

  const bridge: PlatformBridge<PlayerSaveData> = {
    audio,
    getPlatformId: () => 'mock',
    getLanguage: () => 'ru',
    isDebugMode: () => false,
    isReady: () => true,
    init: vi.fn(async () => {}),
    ready: vi.fn(() => {}),
    showInterstitial: vi.fn(async () => ({ shown: false })),
    showRewarded: vi.fn(async () => ({ rewarded: false })),
    loadPlayerData: vi.fn(async () => saved ?? {}),
    savePlayerData,
    flushCloudSave: vi.fn(async () => true),
    setLeaderboardScore: vi.fn(async () => {}),
    gameplayStart: vi.fn(() => {}),
    gameplayStop: vi.fn(() => {}),
    vibrate: vi.fn(() => {}),
    subscribe: vi.fn((_listener: PlatformEventListener) => () => {}),
    getServerTime: vi.fn(async () => Date.UTC(2026, 10, 17, 12, 0, 0)),
    canShowRewarded: vi.fn(async () => true),
    openLeaderboardBox: vi.fn(async () => false),
    canRequestReview: vi.fn(async () => false),
    requestReview: vi.fn(async () => false),
    canShowShortcutPrompt: vi.fn(async () => false),
    showShortcutPrompt: vi.fn(async () => false),
  };

  return { bridge, savePlayerData };
}

/**
 * Ищет кнопку внутри контейнера по тексту.
 */
function findButtonByText(container: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((btn) =>
    btn.textContent?.includes(text),
  );
}

describe('Интеграция Tutorial Overlay в app.ts (tests/ui/appTutorial.test.ts)', () => {
  let root: HTMLElement;
  let mounted: BaliteAppHandle | null = null;

  beforeEach(() => {
    root = document.createElement('div');
    root.id = 'app';
    document.body.appendChild(root);
    window.innerWidth = 720;
    window.innerHeight = 1280;
  });

  afterEach(() => {
    mounted?.destroy();
    mounted = null;
    document.body.innerHTML = '';
  });

  it('монтирует оверлей обучения в root и держит его скрытым в Главном меню', async () => {
    const meta = createInitialMetaSave(1000, { tutorialCompleted: false });
    const save = createPlayerSaveData(meta, null, 1, 1000);
    const mock = createMockBridge(save);

    mounted = mountBaliteApp(root, { bridge: mock.bridge });
    await mounted.readyPromise;

    const overlayEl = root.querySelector('.tut-overlay');
    expect(overlayEl).not.toBeNull();
    // В главном меню оверлей скрыт
    expect(overlayEl?.classList.contains('is-visible')).toBe(false);
  });

  it('активирует шаг обучения при старте забега, если обучение не завершено', async () => {
    const meta = createInitialMetaSave(1000, { tutorialCompleted: false, tutorialStep: 0 });
    const save = createPlayerSaveData(meta, null, 1, 1000);
    const mock = createMockBridge(save);

    mounted = mountBaliteApp(root, { bridge: mock.bridge });
    await mounted.readyPromise;

    // Нажимаем «Играть» в меню
    const playMenuBtn = root.querySelector<HTMLButtonElement>('[data-menu-action="play"]');
    expect(playMenuBtn).not.toBeNull();
    playMenuBtn?.click();

    // Теперь в фазе выбора колоды/старта нажимаем «Начать забег»
    const startBtn = Array.from(root.querySelectorAll<HTMLButtonElement>('.deck-start-actions button')).find((b) =>
      b.textContent?.includes('Начать забег'),
    );
    expect(startBtn).toBeDefined();
    startBtn?.click();

    // Забег перешёл в blind_select: туториал должен стать видимым
    const overlayEl = root.querySelector('.tut-overlay');
    expect(overlayEl?.classList.contains('is-visible')).toBe(true);

    const titleEl = root.querySelector('#tut-step-title');
    expect(titleEl?.textContent).toBe('Добро пожаловать в Гильдию!');
  });

  it('по кнопке «Пропустить» сохраняет tutorialCompleted: true и скрывает оверлей', async () => {
    const state: RunState = {
      ...createInitialRunState('b_red', 'TUT_SEED_1'),
      phase: 'blind_select',
    };
    const meta = createInitialMetaSave(1000, { tutorialCompleted: false, tutorialStep: 0 });
    const snapshot = serializeRunStateToSnapshot(state, 2, 1000);
    const save = createPlayerSaveData(meta, snapshot, 2, 1000);
    const mock = createMockBridge(save);

    mounted = mountBaliteApp(root, { bridge: mock.bridge });
    await mounted.readyPromise;

    const overlayEl = root.querySelector('.tut-overlay');
    expect(overlayEl?.classList.contains('is-visible')).toBe(true);

    // Кликаем «Пропустить»
    const skipBtn = root.querySelector<HTMLButtonElement>('.tut-btn--skip');
    skipBtn?.click();

    expect(overlayEl?.classList.contains('is-visible')).toBe(false);

    const latestSave = mounted.getSaveData();
    expect(latestSave.meta.settings.tutorialCompleted).toBe(true);
    expect(latestSave.meta.tutorialCompleted).toBe(true);
  });

  it('сброс обучения через настройки перезапускает сценарий с 1-го шага', async () => {
    const state: RunState = {
      ...createInitialRunState('b_red', 'TUT_SEED_2'),
      phase: 'blind_select',
    };
    const meta = createInitialMetaSave(1000, { tutorialCompleted: true, tutorialStep: 21 });
    const snapshot = serializeRunStateToSnapshot(state, 3, 1000);
    const save = createPlayerSaveData(meta, snapshot, 3, 1000);
    const mock = createMockBridge(save);

    mounted = mountBaliteApp(root, { bridge: mock.bridge });
    await mounted.readyPromise;

    const overlayEl = root.querySelector('.tut-overlay');
    // Изначально обучение завершено -> оверлей скрыт
    expect(overlayEl?.classList.contains('is-visible')).toBe(false);

    // Открываем Настройки
    const settingsBtn = findButtonByText(root, 'Настройки');
    expect(settingsBtn).toBeDefined();
    settingsBtn?.click();

    // Переходим в подменю настроек из хаба
    const hubSettingsBtn = root.querySelector<HTMLButtonElement>('[data-hub-action="settings"]');
    expect(hubSettingsBtn).not.toBeNull();
    hubSettingsBtn?.click();

    // Находим кнопку «Пройти обучение заново»
    const resetTutorialBtn = root.querySelector<HTMLButtonElement>('[data-action="reset-tutorial"]');
    expect(resetTutorialBtn).not.toBeNull();
    resetTutorialBtn?.click();

    // Обучение сброшено: оверлей снова активен на 1-м шаге
    expect(overlayEl?.classList.contains('is-visible')).toBe(true);
    expect(root.querySelector('#tut-step-title')?.textContent).toBe('Добро пожаловать в Гильдию!');

    const latestSave = mounted.getSaveData();
    expect(latestSave.meta.settings.tutorialCompleted).toBe(false);
    expect(latestSave.meta.settings.tutorialStep).toBe(0);
    expect(latestSave.meta.tutorialCompleted).toBe(false);
    expect(latestSave.meta.tutorialStep).toBe(0);
  });

  it('не показывает межстраничную рекламу при выходе из лавки на шаге обучения 20 -> 21 (Story 6.5.1)', async () => {
    const baseRun = createInitialRunState('b_red', 'TUTORIAL');
    const shopState: RunState = {
      ...baseRun,
      phase: 'shop',
      round: 1,
      shop: {
        offers: [],
        voucher: null,
        packs: [],
        rerollCost: 5,
        tempRerollCost: null,
        rerollsUsedThisShop: 0,
      },
    };
    const meta = createInitialMetaSave(1000, {
      tutorialCompleted: false,
      tutorialStep: 19,
    });
    const snapshot = serializeRunStateToSnapshot(shopState, 2, 1000);
    const save = createPlayerSaveData(meta, snapshot, 2, 1000);
    const mock = createMockBridge(save);

    mounted = mountBaliteApp(root, { bridge: mock.bridge, adCooldownMs: 0 });
    await mounted.readyPromise;

    const nextRoundBtn = findButtonByText(root, 'Далее');
    expect(nextRoundBtn).toBeDefined();
    nextRoundBtn?.click();

    expect(mock.bridge.showInterstitial).not.toHaveBeenCalled();
    expect(mounted.getState().phase).toBe('blind_select');
    expect(mounted.getSaveData().meta.settings.tutorialStep).toBe(20);
  });
});
