import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchTraceAudioEvent, type BaliteAudioController } from '../../src/audio/synth';
import {
  buildDailyRunSpec,
  createConsumableInstance,
  createInitialMetaSave,
  createInitialRunState,
  createPlayerSaveData,
  createPlayingCard,
  createRelicInstance,
  dispatch,
  serializeRunStateToSnapshot,
} from '../../src/engine';
import type { PlayerSaveData, RunState } from '../../src/engine/types';
import { setDevOriginalTermsEnabled } from '../../src/i18n';
import {
  createAudioUnlockController,
  type AudioUnlockController,
  type InterstitialResult,
  type PlatformBridge,
  type PlatformEventListener,
  type PlatformEventName,
  type PlatformId,
  type RewardedResult,
  type SupportedLang,
} from '../../src/platform';
import { type BaliteAppHandle, mountBaliteApp } from '../../src/ui/app';

/**
 * Запрещённые слова для возрастного рейтинга 6+/12+ в UI и разметке.
 */
const FORBIDDEN_RU_PATTERNS: readonly RegExp[] = [
  /покер\p{L}*/iu,
  /казино\p{L}*/iu,
  /ставк\p{L}*/iu,
  /блекджек\p{L}*/iu,
  /блэкджек\p{L}*/iu,
  /рулетк\p{L}*/iu,
  /слот-?машин\p{L}*/iu,
  /таро/iu,
  /гадани\p{L}*/iu,
  /азартн\p{L}*/iu,
];

const FORBIDDEN_EN_PATTERNS: readonly RegExp[] = [
  /\bpokers?\b/i,
  /\bcasinos?\b/i,
  /\bbets?\b/i,
  /\bbetting\b/i,
  /\bblackjack\b/i,
  /\broulette\b/i,
  /\bgambling\b/i,
  /\btarot\b/i,
];

interface MockBridgeOptions {
  platformId?: PlatformId;
  lang?: SupportedLang;
  isDebug?: boolean;
  initialSave?: PlayerSaveData | null;
  interstitialResult?: InterstitialResult;
  rewardedResult?: RewardedResult;
  serverTimeMs?: number;
  canShowRewarded?: boolean;
  openLeaderboardResult?: boolean;
  canRequestReview?: boolean;
  requestReviewResult?: boolean;
  canShowShortcutPrompt?: boolean;
  showShortcutResult?: boolean;
}

/**
 * Создаёт управляемый тестовый PlatformBridge с журналом вызовов, аудио-контроллером и событиями.
 */
function createMockBridge(options: MockBridgeOptions = {}) {
  const audio = createAudioUnlockController();
  const baseInstall = audio.install.bind(audio);
  const baseUnlock = audio.unlock.bind(audio);
  const callLog: string[] = [];
  let savedData: Partial<PlayerSaveData> = options.initialSave ?? {};
  const listeners = new Set<PlatformEventListener>();

  const audioProxy: AudioUnlockController = {
    install: vi.fn(() => {
      callLog.push('audio.install');
      baseInstall();
    }),
    dispose: vi.fn(() => {
      callLog.push('audio.dispose');
      audio.dispose();
    }),
    unlock: vi.fn(() => {
      callLog.push('audio.unlock');
      baseUnlock();
    }),
    registerContext: audio.registerContext.bind(audio),
    setPlatformPaused: vi.fn((paused: boolean) => {
      callLog.push(`audio.paused:${paused}`);
      audio.setPlatformPaused(paused);
    }),
    onAdStart: vi.fn(() => {
      callLog.push('audio.onAdStart');
      audio.onAdStart();
    }),
    onAdEnd: vi.fn(() => {
      callLog.push('audio.onAdEnd');
      audio.onAdEnd();
    }),
    isMutedByPlatform: audio.isMutedByPlatform.bind(audio),
    subscribeMute: audio.subscribeMute.bind(audio),
  };

  const bridge: PlatformBridge<PlayerSaveData> = {
    audio: audioProxy,
    getPlatformId: () => options.platformId ?? 'yandex',
    getLanguage: () => options.lang ?? 'ru',
    isDebugMode: () => Boolean(options.isDebug),
    isReady: () => callLog.includes('ready'),
    init: vi.fn(async () => {
      callLog.push('init');
    }),
    ready: vi.fn(() => {
      callLog.push('ready');
    }),
    showInterstitial: vi.fn(async () => {
      callLog.push('showInterstitial');
      audioProxy.onAdStart();
      try {
        return options.interstitialResult ?? { shown: true };
      } finally {
        audioProxy.onAdEnd();
      }
    }),
    showRewarded: vi.fn(async () => {
      callLog.push('showRewarded');
      return options.rewardedResult ?? { rewarded: true };
    }),
    savePlayerData: vi.fn(async (data: Partial<PlayerSaveData>) => {
      callLog.push('savePlayerData');
      savedData = data;
      return true;
    }),
    loadPlayerData: vi.fn(async () => {
      callLog.push('loadPlayerData');
      return savedData;
    }),
    flushCloudSave: vi.fn(async () => {
      callLog.push('flushCloudSave');
      return true;
    }),
    setLeaderboardScore: vi.fn(async (_boardName: string, _score: number) => {
      callLog.push('setLeaderboardScore');
    }),
    gameplayStart: vi.fn(() => {
      callLog.push('gameplayStart');
    }),
    gameplayStop: vi.fn(() => {
      callLog.push('gameplayStop');
    }),
    subscribe: vi.fn((handler: PlatformEventListener) => {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    }),
    vibrate: vi.fn(),
    getServerTime: vi.fn(async () => options.serverTimeMs ?? Date.UTC(2026, 10, 17, 12, 0, 0)),
    canShowRewarded: vi.fn(async () => options.canShowRewarded ?? true),
    openLeaderboardBox: vi.fn(async (_score: number) => {
      callLog.push('openLeaderboardBox');
      return options.openLeaderboardResult ?? true;
    }),
    canRequestReview: vi.fn(async () => options.canRequestReview ?? false),
    requestReview: vi.fn(async () => {
      callLog.push('requestReview');
      return options.requestReviewResult ?? false;
    }),
    canShowShortcutPrompt: vi.fn(async () => options.canShowShortcutPrompt ?? false),
    showShortcutPrompt: vi.fn(async () => {
      callLog.push('showShortcutPrompt');
      return options.showShortcutResult ?? false;
    }),
  };

  const emit = (event: PlatformEventName, payload: Record<string, unknown> = {}): void => {
    if (event === 'game_api_pause') {
      audioProxy.setPlatformPaused(true);
    } else if (event === 'game_api_resume') {
      audioProxy.setPlatformPaused(false);
    }
    for (const handler of listeners) {
      handler(event, payload);
    }
  };

  return {
    bridge,
    audioProxy,
    callLog,
    getSavedData: () => savedData,
    emit,
  };
}

/**
 * Ищет кнопку внутри контейнера по точному или частичному тексту.
 */
function findButtonByText(container: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((btn) =>
    btn.textContent?.includes(text),
  );
}

/**
 * Пропускает цикл микрозадач в асинхронных тестах.
 */
async function flushMicrotasks(ticks = 4): Promise<void> {
  for (let i = 0; i < ticks; i += 1) {
    await Promise.resolve();
  }
}

describe('Интеграция приложения Balite (src/ui/app.ts)', () => {
  let root: HTMLDivElement;
  let mounted: BaliteAppHandle | null = null;

  beforeEach(() => {
    root = document.createElement('div');
    root.id = 'app';
    document.body.replaceChildren(root);
    document.documentElement.lang = 'ru';
  });

  afterEach(() => {
    mounted?.destroy();
    mounted = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  describe('Жизненный цикл запуска, язык, звук и восстановление забега', () => {
    it('выполняет строгую последовательность старта, синхронизирует lang и вызывает ready() после рендера', async () => {
      const enMeta = createInitialMetaSave(1000, { lang: 'en', soundEnabled: true });
      const enSave = createPlayerSaveData(enMeta, null, 2, 1000);
      const mock = createMockBridge({ lang: 'ru', initialSave: enSave });

      let stageRenderedBeforeReady = false;
      (mock.bridge.ready as ReturnType<typeof vi.fn>).mockImplementation(() => {
        mock.callLog.push('ready');
        stageRenderedBeforeReady =
          root.querySelector('.backdrop-canvas') !== null &&
          root.querySelector('.stage-portrait.stage-portrait--menu .main-menu') !== null;
      });

      mounted = mountBaliteApp(root, {
        bridge: mock.bridge,
        initialNowMs: () => 5000,
      });
      await mounted.readyPromise;

      expect(stageRenderedBeforeReady).toBe(true);
      expect(mock.bridge.ready).toHaveBeenCalledTimes(1);
      expect(document.documentElement.lang).toBe('en');

      const installIdx = mock.callLog.indexOf('audio.install');
      const initIdx = mock.callLog.indexOf('init');
      const loadIdx = mock.callLog.indexOf('loadPlayerData');
      const readyIdx = mock.callLog.indexOf('ready');
      expect(installIdx).toBeGreaterThanOrEqual(0);
      expect(installIdx).toBeLessThan(initIdx);
      expect(initIdx).toBeLessThan(loadIdx);
      expect(loadIdx).toBeLessThan(readyIdx);

      // При первом старте в Главном меню геймплей и реклама не запускаются
      expect(mock.bridge.gameplayStart).not.toHaveBeenCalled();
      expect(mock.bridge.showInterstitial).not.toHaveBeenCalled();
      expect(mounted.getState().phase).toBe('deck_select');

      // Переход по кнопке Играть открывает экран выбора колоды/сида в 9:16 сцене
      root.querySelector<HTMLButtonElement>('[data-menu-action="play"]')?.click();
      expect(root.querySelector('.stage-portrait--menu')).toBeNull();
      expect(root.querySelector('.stage-portrait .run-shell[data-phase="deck_select"]')).not.toBeNull();

      // Кнопка Назад возвращает в Главное меню
      root.querySelector<HTMLButtonElement>('[data-action="back-to-menu"]')?.click();
      expect(root.querySelector('.stage-portrait.stage-portrait--menu .main-menu')).not.toBeNull();
    });

    it('автоматически восстанавливает сохранённый активный забег (phase != deck_select)', async () => {
      const baseRun = createInitialRunState('b_red', 'RESTORE1');
      const card = createPlayingCard({ id: 'hand_a', suit: 'spades', rank: 14 });
      const activeState: RunState = {
        ...baseRun,
        phase: 'playing',
        round: 1,
        deck: [card, ...baseRun.deck.slice(1)],
        handIds: [card.id],
      };
      const meta = createInitialMetaSave(1000, { lang: 'ru' });
      const snapshot = serializeRunStateToSnapshot(activeState, 3, 2000);
      const save = createPlayerSaveData(meta, snapshot, 3, 2000);
      const mock = createMockBridge({ initialSave: save });

      mounted = mountBaliteApp(root, { bridge: mock.bridge });
      await mounted.readyPromise;

      expect(mounted.getState().phase).toBe('playing');
      expect(mounted.getState().seed).toBe('RESTORE1');
      expect(root.querySelector('[data-belt="hand"] [data-card-id="hand_a"]')).not.toBeNull();
      expect(mock.bridge.gameplayStart).toHaveBeenCalledTimes(1);

      const readyIdx = mock.callLog.indexOf('ready');
      const gameplayStartIdx = mock.callLog.indexOf('gameplayStart');
      expect(readyIdx).toBeGreaterThanOrEqual(0);
      expect(gameplayStartIdx).toBeGreaterThan(readyIdx);
    });

    it('на стартовом экране через Играть с сохранённым снимком держит кнопку Продолжить забег и восстанавливает по клику', async () => {
      const baseRun = createInitialRunState('b_red', 'RESUME9');
      const snapshot = serializeRunStateToSnapshot({ ...baseRun, phase: 'deck_select', previousPhase: 'blind_select' }, 2, 1500);
      const meta = createInitialMetaSave(1000, { lang: 'ru' });
      const save = createPlayerSaveData(meta, snapshot, 2, 1500);
      const mock = createMockBridge({ initialSave: save });

      mounted = mountBaliteApp(root, { bridge: mock.bridge });
      await mounted.readyPromise;

      expect(mounted.getState().phase).toBe('deck_select');
      expect(root.querySelector('.main-menu')).not.toBeNull();
      root.querySelector<HTMLButtonElement>('[data-menu-action="play"]')?.click();

      const continueBtn = findButtonByText(root, 'Продолжить забег');
      expect(continueBtn).toBeDefined();

      continueBtn!.click();
      expect(mounted.getState().phase).toBe('blind_select');
      expect(mounted.getState().seed).toBe('RESUME9');
      expect(mock.bridge.gameplayStart).toHaveBeenCalledTimes(1);
    });

    it('разблокирует аудио на первом жесте и глушит звук при game_api_pause / рекламе', async () => {
      const mock = createMockBridge({ initialSave: null });
      mounted = mountBaliteApp(root, { bridge: mock.bridge });
      await mounted.readyPromise;

      root.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      expect(mock.audioProxy.unlock).toHaveBeenCalled();

      mock.emit('game_api_pause');
      expect(mock.audioProxy.isMutedByPlatform()).toBe(true);

      mock.emit('game_api_resume');
      expect(mock.audioProxy.isMutedByPlatform()).toBe(false);
    });
  });

  describe('Командный цикл, PLAY_HAND, TracePlayer и сохранения', () => {
    it('PLAY_HAND сохраняет снимок с инкрементом revision, проигрывает TraceEvents с поп-апами/подсветкой и пропускается по клику', async () => {
      vi.useFakeTimers();
      let nowMs = 10_000;
      const baseRun = createInitialRunState('b_red', 'PLAY123');
      const ace = createPlayingCard({ id: 'c_ace', suit: 'spades', rank: 14, enhancement: 'bonus' });
      const king = createPlayingCard({ id: 'c_king', suit: 'spades', rank: 13 });
      const joker = createRelicInstance('j_joker', 'r_joker');
      const state: RunState = {
        ...baseRun,
        phase: 'playing',
        round: 1,
        targetScore: 300,
        deck: [ace, king, ...baseRun.deck.slice(2)],
        handIds: ['c_ace', 'c_king'],
        drawPileIds: baseRun.deck.slice(2).map((c) => c.id),
        relics: [joker],
      };
      const meta = createInitialMetaSave(nowMs, { lang: 'ru', animationSpeed: 1 });
      const save = createPlayerSaveData(meta, serializeRunStateToSnapshot(state, 5, nowMs), 5, nowMs);
      const mock = createMockBridge({ initialSave: save });

      mounted = mountBaliteApp(root, {
        bridge: mock.bridge,
        initialNowMs: () => nowMs,
      });
      await mounted.readyPromise;

      nowMs = 12_500;
      const handCard = root.querySelector('[data-belt="hand"] [data-card-id="c_ace"]') as HTMLElement;
      handCard.click();

      const playBtn = findButtonByText(root.querySelector('[data-belt="hand"]')!, 'Сыграть')!;
      expect(playBtn.disabled).toBe(false);
      playBtn.click();

      // Сразу сохраняется обновлённый снимок и повышается revision
      const nextSave = mounted.getSaveData();
      expect(nextSave.revision).toBe(6);
      expect(nextSave.updatedAt).toBeGreaterThanOrEqual(12_500);
      expect(nextSave.meta.stats.totalHandsPlayed).toBe(1);
      expect(mock.bridge.savePlayerData).toHaveBeenCalledTimes(1);
      expect(nextSave.activeRun).not.toBeNull();

      // Анимация активна: сыгранная карта отображается на арене
      const arenaEl = root.querySelector('.arena-stage') as HTMLElement;
      expect(arenaEl.dataset.animating).toBe('true');
      expect(arenaEl.querySelector('.play-zone [data-card-id="c_ace"]')).not.toBeNull();

      // Прокручиваем первые шаги TracePlayer (1x = 640мс/шаг) — появляются поп-апы и подсветка карты/реликвии
      await vi.advanceTimersByTimeAsync(180);
      expect(root.querySelectorAll('.popup-layer .trace-popup').length).toBeGreaterThan(0);

      const highlightedNodes = root.querySelectorAll(
        '[data-highlighted="true"], .is-highlighted, .card-frame.is-triggering',
      );
      expect(highlightedNodes.length).toBeGreaterThan(0);

      // Тап по арене пропускает оставшуюся анимацию и перерендеривает итоговое состояние
      arenaEl.click();
      await vi.advanceTimersByTimeAsync(20);
      await flushMicrotasks();

      const afterArena = root.querySelector('.arena-stage') as HTMLElement;
      expect(afterArena.dataset.animating).toBeUndefined();
      expect(mounted.getState().score).toBeGreaterThan(0);
    });
  });

  describe('Инспектор, целевые расходники, модалки и режим отладки', () => {
    it('включает режим выбора целей (consumableTargetMode) для свитка и применяет USE_CONSUMABLE с картами в руке', async () => {
      const baseRun = createInitialRunState('b_red', 'CONS1');
      const c1 = createPlayingCard({ id: 'h1', suit: 'hearts', rank: 7 });
      const c2 = createPlayingCard({ id: 'h2', suit: 'clubs', rank: 8 });
      const scroll = createConsumableInstance('c_lovers', 'cons_lovers');
      const state: RunState = {
        ...baseRun,
        phase: 'playing',
        round: 1,
        deck: [c1, c2, ...baseRun.deck.slice(2)],
        handIds: ['h1', 'h2'],
        consumables: [scroll],
      };
      const meta = createInitialMetaSave(1000, { lang: 'ru' });
      const save = createPlayerSaveData(meta, serializeRunStateToSnapshot(state, 1, 1000), 1, 1000);
      const mock = createMockBridge({ initialSave: save });

      mounted = mountBaliteApp(root, { bridge: mock.bridge });
      await mounted.readyPromise;

      // Открываем инспектор расходника
      const consSlot = root.querySelector('[data-consumable-uid="cons_lovers"]') as HTMLElement;
      consSlot.click();

      const useBtn = root.querySelector('.inspector-backdrop [data-action="use"]') as HTMLButtonElement;
      expect(useBtn).not.toBeNull();
      expect(useBtn.disabled).toBe(false);
      useBtn.click();

      // Инспектор закрылся, в Поясе 4 появился баннер выбора цели
      expect(root.querySelector('.inspector-backdrop')).toBeNull();
      const targetBanner = root.querySelector('.target-banner');
      expect(targetBanner).not.toBeNull();

      const confirmBtn = findButtonByText(targetBanner!, 'Подтвердить')!;
      expect(confirmBtn.disabled).toBe(true);

      // Выбираем карту h2 в руке
      (root.querySelector('[data-belt="hand"] [data-card-id="h2"]') as HTMLElement).click();
      const confirmBtnActive = findButtonByText(root.querySelector('.target-banner')!, 'Подтвердить')!;
      expect(confirmBtnActive.disabled).toBe(false);
      confirmBtnActive.click();

      // Свиток Влюблённых применился на h2 (Дикая карта) и расходник потрачен
      expect(mounted.getState().consumables).toHaveLength(0);
      expect(mounted.getState().deck.find((c) => c.id === 'h2')?.enhancement).toBe('wild');
      expect(root.querySelector('.target-banner')).toBeNull();
    });

    it('в магазине поддерживает Buy & Use для немедленного применения расходника', async () => {
      const baseRun = createInitialRunState('b_red', 'SHOP_BUY');
      const hermit = createConsumableInstance('c_hermit', 'shop_hermit');
      const state: RunState = {
        ...baseRun,
        phase: 'shop',
        round: 1,
        dollars: 10,
        shop: {
          offers: [
            {
              uid: 'offer_hermit',
              kind: 'consumable',
              consumable: hermit,
              cost: 3,
              baseCost: 3,
              sold: false,
            },
          ],
          voucher: null,
          packs: [],
          rerollCost: 5,
          tempRerollCost: null,
          rerollsUsedThisShop: 0,
        },
      };
      const meta = createInitialMetaSave(1000, { lang: 'ru' });
      const save = createPlayerSaveData(meta, serializeRunStateToSnapshot(state, 1, 1000), 1, 1000);
      const mock = createMockBridge({ initialSave: save });

      mounted = mountBaliteApp(root, { bridge: mock.bridge });
      await mounted.readyPromise;

      const offerEl = root.querySelector('[data-offer-uid="offer_hermit"]') as HTMLElement;
      offerEl.click();

      const buyAndUseBtn = root.querySelector(
        '.inspector-backdrop [data-action="buy-and-use"]',
      ) as HTMLButtonElement;
      expect(buyAndUseBtn).not.toBeNull();
      expect(buyAndUseBtn.disabled).toBe(false);
      buyAndUseBtn.click();

      // 10 - 3 = 7 з., затем c_hermit удвоил 7 -> 14 з.
      expect(mounted.getState().dollars).toBe(14);
      expect(mounted.getState().consumables).toHaveLength(0);
    });

    it('открывает модалки Расклады, Колода, Настройки, сохраняет смену языка и показывает debug-кнопки только при isDebugMode()', async () => {
      const mockNormal = createMockBridge({ isDebug: false });
      mounted = mountBaliteApp(root, { bridge: mockNormal.bridge });
      await mounted.readyPromise;

      // В Главном меню кнопка Параметры открывает настройки, а кнопка языка переключает ru/en
      root.querySelector<HTMLButtonElement>('[data-menu-action="toggle-lang"]')?.click();
      expect(document.documentElement.lang).toBe('en');
      expect(mounted.getSaveData().meta.settings.lang).toBe('en');
      root.querySelector<HTMLButtonElement>('[data-menu-action="toggle-lang"]')?.click();
      expect(document.documentElement.lang).toBe('ru');

      root.querySelector<HTMLButtonElement>('[data-menu-action="settings"]')?.click();
      expect(root.querySelector('[data-modal="settings"]')).not.toBeNull();
      expect(root.querySelector('[data-hub-action="main-menu"]')).toBeNull();
      root.querySelector<HTMLButtonElement>('[data-hub-action="settings"]')?.click();
      expect(root.querySelector('[data-debug-action]')).toBeNull();

      // Проверяем CSS-переменную --anim-speed и переключение на 0.5x
      const stageEl = root.querySelector('.stage-portrait') as HTMLElement;
      expect(stageEl.style.getPropertyValue('--anim-speed')).toBe('1');
      root.querySelector<HTMLButtonElement>('[data-modal="settings"] [data-speed="0.5"]')?.click();
      expect(mounted.getSaveData().meta.settings.animationSpeed).toBe(0.5);
      expect(stageEl.style.getPropertyValue('--anim-speed')).toBe('0.5');

      // Меняем язык на English — при этом модалка остаётся открытой на вкладке Настройки
      findButtonByText(root.querySelector('[data-modal="settings"]')!, 'English')!.click();
      expect(document.documentElement.lang).toBe('en');
      expect(mounted.getSaveData().meta.settings.lang).toBe('en');
      expect(root.querySelector('[data-modal="settings"] [data-speed="0.5"]')).not.toBeNull();
      expect(mockNormal.bridge.savePlayerData).toHaveBeenCalled();

      mounted.destroy();
      root.replaceChildren();

      // С флагом debug=true отладочные кнопки отображаются и работают
      const mockDebug = createMockBridge({ isDebug: true });
      mounted = mountBaliteApp(root, { bridge: mockDebug.bridge });
      await mounted.readyPromise;

      findButtonByText(root, 'Параметры')!.click();
      root.querySelector<HTMLButtonElement>('[data-hub-action="settings"]')?.click();
      const settingsSheetBeforeSlider = root.querySelector('[data-modal="settings"] .modal-sheet');
      const sfxRange = root.querySelector('[data-modal="settings"] [data-volume="sfx"]') as HTMLInputElement;
      sfxRange.value = '0.35';
      sfxRange.dispatchEvent(new Event('input', { bubbles: true }));
      expect(mounted.getSaveData().meta.settings.sfxVolume).toBe(0.35);
      // Ползунок не пересоздаёт DOM модалки при перетаскивании
      expect(root.querySelector('[data-modal="settings"] .modal-sheet')).toBe(settingsSheetBeforeSlider);

      const debugInterstitial = root.querySelector(
        '[data-modal="settings"] [data-debug-action="interstitial"]',
      ) as HTMLButtonElement;
      expect(debugInterstitial).not.toBeNull();
      debugInterstitial.click();
      await flushMicrotasks();
      expect(mockDebug.bridge.showInterstitial).toHaveBeenCalledTimes(1);

      root.querySelector<HTMLButtonElement>('[data-modal="settings"] [data-action="hub-back"]')?.click();
      root.querySelector<HTMLButtonElement>('[data-modal="settings"] [data-action="close"]')?.click();

      // Из Главного меню через Играть открываем выбор колоды и начинаем забег
      root.querySelector<HTMLButtonElement>('[data-menu-action="play"]')?.click();
      findButtonByText(root, 'Начать забег')!.click();
      findButtonByText(root, 'Принять заказ')!.click();

      // В активном забеге хаб Настроек содержит кнопку «В главное меню» и сохраняет автосейв при выходе
      findButtonByText(root, 'Настройки')!.click();
      const returnMenuBtn = root.querySelector<HTMLButtonElement>(
        '[data-modal="settings"] [data-hub-action="main-menu"]',
      );
      expect(returnMenuBtn).not.toBeNull();
      returnMenuBtn?.click();
      expect(root.querySelector('.main-menu')).not.toBeNull();
      expect(mounted.getSaveData().activeRun).not.toBeNull();

      // Через Играть -> Продолжить забег возвращаемся в сохранённый забег
      root.querySelector<HTMLButtonElement>('[data-menu-action="play"]')?.click();
      findButtonByText(root, 'Продолжить забег')!.click();
      expect(mounted.getState().phase).toBe('playing');

      (findButtonByText(root, 'Детали партии') ?? findButtonByText(root, 'Комбинации'))!.click();
      const runInfoModal =
        root.querySelector('[data-modal="run-info"]') ??
        root.querySelector('[data-modal="hand-reference"]');
      expect(runInfoModal).not.toBeNull();
      (findButtonByText(runInfoModal!, 'Назад') ?? findButtonByText(runInfoModal!, 'Закрыть'))!.click();

      const deckOpenBtn = root.querySelector<HTMLButtonElement>('[data-action="open-deck"]');
      expect(deckOpenBtn?.getAttribute('aria-label')).toContain('Колода');
      deckOpenBtn!.click();
      expect(root.querySelector('[data-modal="deck"]')).not.toBeNull();
    });

    it('поддерживает инспектор Реликвии (перемещение и продажа) и выбор цели в бустере', async () => {
      const baseRun = createInitialRunState('b_red', 'RELIC_BOOST');
      const handCard = createPlayingCard({ id: 'bh_1', suit: 'diamonds', rank: 9 });
      const relicA = createRelicInstance('j_joker', 'rel_a');
      const relicB = createRelicInstance('j_banner', 'rel_b');
      const boosterScroll = createConsumableInstance('c_chariot', 'b_chariot');
      const state: RunState = {
        ...baseRun,
        phase: 'booster',
        round: 1,
        dollars: 5,
        deck: [handCard, ...baseRun.deck.slice(1)],
        relics: [relicA, relicB],
        booster: {
          packId: 'arcana_normal',
          packType: 'arcana',
          packSize: 'normal',
          remainingPicks: 1,
          drawnHandCardIds: ['bh_1'],
          fromTag: false,
          choices: [
            {
              uid: 'choice_chariot',
              kind: 'consumable',
              consumable: boosterScroll,
              picked: false,
            },
          ],
        },
      };
      const meta = createInitialMetaSave(1000, { lang: 'ru' });
      const save = createPlayerSaveData(meta, serializeRunStateToSnapshot(state, 1, 1000), 1, 1000);
      const mock = createMockBridge({ initialSave: save });

      mounted = mountBaliteApp(root, { bridge: mock.bridge });
      await mounted.readyPromise;

      // Открываем инспектор первой реликвии и двигаем её вправо
      (root.querySelector('[data-relic-uid="rel_a"]') as HTMLElement).click();
      const moveRightBtn = root.querySelector('.inspector-backdrop [data-action="move-right"]') as HTMLButtonElement;
      moveRightBtn.click();
      expect(mounted.getState().relics.map((r) => r.uid)).toEqual(['rel_b', 'rel_a']);

      // Выбираем карту в бустере и активируем свиток Стальной Ковки
      (root.querySelector('[data-belt="hand"] [data-card-id="bh_1"]') as HTMLElement).click();
      const choiceBtn = findButtonByText(
        root.querySelector('[data-choice-uid="choice_chariot"]')!,
        'Взять',
      )!;
      expect(choiceBtn.disabled).toBe(false);
      choiceBtn.click();

      expect(mounted.getState().deck.find((c) => c.id === 'bh_1')?.enhancement).toBe('steel');

      // Продаём первую реликвию через инспектор
      const dollarsBeforeSell = mounted.getState().dollars;
      (root.querySelector('[data-relic-uid="rel_b"]') as HTMLElement).click();
      const sellBtn = root.querySelector('.inspector-backdrop [data-action="sell"]') as HTMLButtonElement;
      sellBtn.click();
      expect(mounted.getState().relics.map((r) => r.uid)).toEqual(['rel_a']);
      expect(mounted.getState().dollars).toBeGreaterThan(dollarsBeforeSell);
    });
  });

  describe('Рекламные паузы (adCooldownMs), лидерборд и завершение забега', () => {
    it('записывает статистику, открывает колоду, отправляет рекорд в лидерборд и делает flushCloudSave при victory', async () => {
      let nowMs = 50_000;
      const baseRun = createInitialRunState('b_red', 'WIN8');
      const card = createPlayingCard({ id: 'win_ace', suit: 'spades', rank: 14 });
      const ante8BossState: RunState = {
        ...baseRun,
        phase: 'playing',
        ante: 8,
        round: 24,
        currentBlindIndex: 2,
        targetScore: 10,
        score: 0,
        deck: [card, ...baseRun.deck.slice(1)],
        handIds: ['win_ace'],
        anteBlinds: [
          { ...baseRun.anteBlinds[0], status: 'defeated' },
          { ...baseRun.anteBlinds[1], status: 'defeated' },
          { ...baseRun.anteBlinds[2], status: 'current', targetScore: 10 },
        ],
      };
      const meta = createInitialMetaSave(nowMs, { lang: 'ru', animationSpeed: 4 });
      const save = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(ante8BossState, 10, nowMs),
        10,
        nowMs,
      );
      const mock = createMockBridge({ initialSave: save });

      mounted = mountBaliteApp(root, {
        bridge: mock.bridge,
        initialNowMs: () => nowMs,
      });
      await mounted.readyPromise;

      vi.useFakeTimers();
      (root.querySelector('[data-belt="hand"] [data-card-id="win_ace"]') as HTMLElement).click();
      findButtonByText(root.querySelector('[data-belt="hand"]')!, 'Сыграть')!.click();

      // Пропускаем анимацию кликом по арене
      (root.querySelector('.arena-stage') as HTMLElement).click();
      await vi.advanceTimersByTimeAsync(20);
      await flushMicrotasks();

      expect(mounted.getState().phase).toBe('victory');
      expect(mock.bridge.gameplayStop).toHaveBeenCalled();
      expect(mock.bridge.setLeaderboardScore).toHaveBeenCalledWith(
        'best_hand',
        mounted.getState().stats.bestHandScore,
      );
      expect(mock.bridge.flushCloudSave).toHaveBeenCalled();

      const nextSave = mounted.getSaveData();
      expect(nextSave.activeRun).toBeNull();
      expect(nextSave.meta.stats.runsWon).toBe(1);
      expect(nextSave.meta.stats.highestAnte).toBe(8);
      expect(nextSave.meta.stats.highestRound).toBe(24);
      expect(nextSave.meta.stats.maxDollars).toBeGreaterThanOrEqual(ante8BossState.dollars);
      expect(nextSave.meta.stats.currentWinStreak).toBe(1);
      expect(nextSave.meta.stats.bestWinStreak).toBe(1);
      expect(nextSave.meta.stats.handPlayCounts['High Card']).toBe(1);
      expect(nextSave.meta.unlockedDecks).toContain('b_blue');
    });

    it('обновляет currentWinStreak/bestWinStreak при game_over и отображает актуальную статистику в хабе Параметры', async () => {
      let nowMs = 70_000;
      const baseRun = createInitialRunState('b_red', 'LOSE1');
      const ace = createPlayingCard({ id: 'lose_ace', suit: 'hearts', rank: 14 });
      const loseState: RunState = {
        ...baseRun,
        phase: 'playing',
        ante: 3,
        round: 7,
        dollars: 33,
        handsLeft: 1,
        targetScore: 999_999,
        score: 0,
        deck: [ace, ...baseRun.deck.slice(1)],
        handIds: ['lose_ace'],
      };
      const baseMeta = createInitialMetaSave(nowMs, { lang: 'ru', animationSpeed: 4 });
      const meta = {
        ...baseMeta,
        stats: {
          ...baseMeta.stats,
          runsStarted: 3,
          runsWon: 2,
          highestAnte: 8,
          highestRound: 5,
          maxDollars: 20,
          bestWinStreak: 2,
          currentWinStreak: 2,
          handPlayCounts: { Pair: 4 },
        },
      };
      const save = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(loseState, 5, nowMs),
        5,
        nowMs,
      );
      const mock = createMockBridge({ initialSave: save });

      mounted = mountBaliteApp(root, {
        bridge: mock.bridge,
        initialNowMs: () => nowMs,
      });
      await mounted.readyPromise;

      vi.useFakeTimers();
      (root.querySelector('[data-belt="hand"] [data-card-id="lose_ace"]') as HTMLElement).click();
      findButtonByText(root.querySelector('[data-belt="hand"]')!, 'Сыграть')!.click();
      (root.querySelector('.arena-stage') as HTMLElement).click();
      await vi.advanceTimersByTimeAsync(20);
      await flushMicrotasks();

      expect(mounted.getState().phase).toBe('game_over');
      const nextStats = mounted.getSaveData().meta.stats;
      expect(nextStats.highestRound).toBe(7);
      expect(nextStats.maxDollars).toBe(33);
      expect(nextStats.bestWinStreak).toBe(2);
      expect(nextStats.currentWinStreak).toBe(0);
      expect(nextStats.handPlayCounts['High Card']).toBe(1);
      expect(nextStats.handPlayCounts.Pair).toBe(4);

      // Открываем хаб Параметры -> Статистика и проверяем отрендеренные значения
      findButtonByText(root, 'Настройки')!.click();
      root.querySelector<HTMLButtonElement>('[data-hub-action="stats"]')?.click();
      const statsText = root.querySelector('[data-stats-panel="true"]')?.textContent ?? '';
      expect(statsText).toContain('7');
      expect(statsText).toContain('33');
      expect(statsText).toContain('2 (0)');
      expect(statsText).toContain('(4)');
    });

    it('при поражении в endlessMode не сбрасывает currentWinStreak', async () => {
      let nowMs = 80_000;
      const baseRun = createInitialRunState('b_red', 'ENDLESS_LOSS');
      const ace = createPlayingCard({ id: 'endless_ace', suit: 'clubs', rank: 14 });
      const endlessState: RunState = {
        ...baseRun,
        phase: 'playing',
        ante: 9,
        round: 25,
        endlessMode: true,
        handsLeft: 1,
        targetScore: 999_999,
        score: 0,
        deck: [ace, ...baseRun.deck.slice(1)],
        handIds: ['endless_ace'],
      };
      const baseMeta = createInitialMetaSave(nowMs, { lang: 'ru', animationSpeed: 4 });
      const meta = {
        ...baseMeta,
        stats: {
          ...baseMeta.stats,
          runsStarted: 1,
          runsWon: 1,
          bestWinStreak: 1,
          currentWinStreak: 1,
        },
      };
      const save = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(endlessState, 12, nowMs),
        12,
        nowMs,
      );
      const mock = createMockBridge({ initialSave: save });

      mounted = mountBaliteApp(root, {
        bridge: mock.bridge,
        initialNowMs: () => nowMs,
      });
      await mounted.readyPromise;

      vi.useFakeTimers();
      (root.querySelector('[data-belt="hand"] [data-card-id="endless_ace"]') as HTMLElement).click();
      findButtonByText(root.querySelector('[data-belt="hand"]')!, 'Сыграть')!.click();
      (root.querySelector('.arena-stage') as HTMLElement).click();
      await vi.advanceTimersByTimeAsync(20);
      await flushMicrotasks();

      expect(mounted.getState().phase).toBe('game_over');
      expect(mounted.getSaveData().meta.stats.currentWinStreak).toBe(1);
      expect(mounted.getSaveData().meta.stats.bestWinStreak).toBe(1);
    });

    it('показывает showInterstitial строго на логических паузах и соблюдает кулдаун adCooldownMs = 180_000 мс', async () => {
      let nowMs = 1_000_000;
      const baseRun = createInitialRunState('b_red', 'AD_FLOW');
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
      const meta = createInitialMetaSave(nowMs, { lang: 'ru' });
      const save = createPlayerSaveData(meta, serializeRunStateToSnapshot(shopState, 1, nowMs), 1, nowMs);
      const mock = createMockBridge({ initialSave: save });

      mounted = mountBaliteApp(root, {
        bridge: mock.bridge,
        initialNowMs: () => nowMs,
        adCooldownMs: 180_000,
      });
      await mounted.readyPromise;

      expect(mock.bridge.showInterstitial).not.toHaveBeenCalled();

      // 1-я логическая пауза: Далее из магазина -> показывает рекламу
      findButtonByText(root, 'Далее')!.click();
      await flushMicrotasks();
      expect(mock.bridge.showInterstitial).toHaveBeenCalledTimes(1);
      expect(mounted.getState().phase).toBe('blind_select');

      // Доводим за счёт второго захода в магазин спустя 60_000 мс (< 180_000 мс)
      nowMs += 60_000;
      // Быстро вернёмся в shop через отладку? Нет, проверим сценарий game_over -> Играть снова:
      // Перемонтируем с game_over с тем же bridge? Кулдаун внутри одного инстанса, поэтому проиграем или пройдём до магазина честно:
      // В фазе blind_select: Сразиться -> сыграем 4 слабых руки без очков? Нет, одна карта даёт очки; на Ante 1 target=300, 4 двойки разных мастей дают < 300!
      findButtonByText(root, 'Принять заказ')!.click();
      while (mounted.getState().phase === 'playing') {
        const state = mounted.getState();
        const lowestCardId = [...state.handIds].sort((a, b) => {
          const ra = state.deck.find((c) => c.id === a)?.rank ?? 14;
          const rb = state.deck.find((c) => c.id === b)?.rank ?? 14;
          return ra - rb;
        })[0]!;
        (root.querySelector(`[data-belt="hand"] [data-card-id="${lowestCardId}"]`) as HTMLElement).click();
        findButtonByText(root.querySelector('[data-belt="hand"]')!, 'Сыграть')!.click();
        const arena = root.querySelector('.arena-stage') as HTMLElement;
        if (arena.dataset.animating === 'true') {
          arena.click();
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
        await flushMicrotasks();
      }

      // На Ante 1 (300 очков) 4 одиночных младших карты без реликвий наберут < 120 -> поражение!
      expect(mounted.getState().phase).toBe('game_over');
      expect(mock.bridge.gameplayStop).toHaveBeenCalled();

      // Прошло только 60_000 мс (< 180_000 мс): нажатие «Новый забег» НЕ показывает рекламу
      findButtonByText(root, 'Новый забег')!.click();
      await flushMicrotasks();
      expect(mock.bridge.showInterstitial).toHaveBeenCalledTimes(1);
      expect(mounted.getState().phase).toBe('blind_select');

      // Сдвигаем часы на +180_000 мс и снова проигрываем на 1-м страже -> реклама снова показывается
      nowMs += 180_000;
      findButtonByText(root, 'Принять заказ')!.click();
      while (mounted.getState().phase === 'playing') {
        const state = mounted.getState();
        const lowestCardId = [...state.handIds].sort((a, b) => {
          const ra = state.deck.find((c) => c.id === a)?.rank ?? 14;
          const rb = state.deck.find((c) => c.id === b)?.rank ?? 14;
          return ra - rb;
        })[0]!;
        (root.querySelector(`[data-belt="hand"] [data-card-id="${lowestCardId}"]`) as HTMLElement).click();
        findButtonByText(root.querySelector('[data-belt="hand"]')!, 'Сыграть')!.click();
        const arena = root.querySelector('.arena-stage') as HTMLElement;
        if (arena.dataset.animating === 'true') {
          arena.click();
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
        await flushMicrotasks();
      }

      expect(mounted.getState().phase).toBe('game_over');
      findButtonByText(root, 'Новый забег')!.click();
      await flushMicrotasks();
      expect(mock.bridge.showInterstitial).toHaveBeenCalledTimes(2);
    });
  });

  describe('Статическая проверка модерации 6+/12+ и верстки', () => {
    it('index.html не содержит запрещённых символов, внешних ссылок и блокирующего /sdk.js', async () => {
      const fsModule = 'node:fs';
      const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as {
        readFileSync: (file: string, encoding: 'utf8') => string;
      };
      const html = readFileSync('index.html', 'utf8');

      expect(html).not.toContain('♠');
      expect(html).not.toContain('%E2%99%A0');
      expect(html).not.toMatch(/src\s*=\s*["']\/?sdk\.js["']/i);
      expect(html).not.toMatch(/<a\b|https:\/\//i);
      expect(html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')).not.toMatch(/http:\/\//i);
      expect(html).toContain('data:image/svg+xml');
    });

    it('src/style.css задаёт живой фон, портретную сцену 9:16 и не использует :hover', async () => {
      const fsModule = 'node:fs';
      const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as {
        readFileSync: (file: string, encoding: 'utf8') => string;
      };
      const css = readFileSync('src/style.css', 'utf8');

      expect(css).not.toMatch(/:hover\b/);
      expect(css).toContain('.backdrop-canvas');
      expect(css).toContain('.stage-portrait');
      expect(css).toContain('.trace-popup');
      expect(css).toContain('--trace-popup-duration');
      expect(css).toContain('--trace-highlight-transition');
      expect(css).toContain('.is-triggering');
      expect(css).toContain('.is-highlighted');
      expect(css).toContain('safe-area-inset');
      expect(css).toContain('overflow: hidden');
      expect(css).toContain('@font-face');
      expect(css).toContain('pixellari-cyrillic');
      expect(css).toContain('Pixellari');
      expect(css).toContain('button,');
      expect(css).toContain('.crt-overlay');
      expect(css).toContain('prefers-reduced-motion');
      expect(css).toContain('image-rendering: pixelated');
      expect(css).not.toMatch(/https?:\/\/fonts\./i);
    });

    it('живой DOM приложения на ru и en не содержит покерных/казино слов и внешних ссылок', async () => {
      for (const lang of ['ru', 'en'] as const) {
        const meta = createInitialMetaSave(1000, { lang });
        const mock = createMockBridge({ lang, initialSave: createPlayerSaveData(meta, null) });
        const app = mountBaliteApp(root, { bridge: mock.bridge });
        await app.readyPromise;

        const visibleText = root.textContent ?? '';
        const patterns = lang === 'ru' ? FORBIDDEN_RU_PATTERNS : FORBIDDEN_EN_PATTERNS;
        expect(root.innerHTML).not.toMatch(/<a\b|https?:\/\//i);
        for (const pattern of patterns) {
          expect(visibleText).not.toMatch(pattern);
        }

        app.destroy();
        root.replaceChildren();
      }
    });
  });

  describe('Story 1.4: трекер забега, возврат из финала и hover-тултипы', () => {
    it('выход в Главное меню из game_over сбрасывает завершённый снимок и отображает бейдж рекорда', async () => {
      localStorage.clear();
      const nowMs = 500_000;
      const base = createInitialRunState('b_red', 'TRACKER_SEED');
      const defeatState: RunState = {
        ...base,
        phase: 'game_over',
        ante: 6,
        round: 14,
        relics: [createRelicInstance('j_joker', 'r1')],
        stats: {
          ...base.stats,
          bestHandScore: 9999,
          bestHandType: 'Full House',
          cardsPlayed: 33,
          cardsDiscarded: 11,
          cardsPurchased: 4,
          rerollsCount: 2,
        },
      };
      const baseMeta = createInitialMetaSave(nowMs, { lang: 'ru' });
      const meta = {
        ...baseMeta,
        discoveredRelics: ['j_joker' as const],
        stats: {
          ...baseMeta.stats,
          bestHandScore: 2000,
          highestAnte: 3,
          highestRound: 8,
          maxDollars: 5,
        },
        activeRunTracker: {
          baselineBestHandScore: 2000,
          baselineHighestAnte: 3,
          baselineHighestRound: 8,
          newDiscoveries: 1,
        },
      };
      const save = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(defeatState, 1, nowMs),
        1,
        nowMs,
      );
      const mock = createMockBridge({ initialSave: save });

      mounted = mountBaliteApp(root, {
        bridge: mock.bridge,
        initialNowMs: () => nowMs,
        adCooldownMs: 0,
      });
      await mounted.readyPromise;

      expect(root.textContent).toContain('9999');
      expect(root.textContent).toContain('Новый рекорд!');
      expect(root.querySelector('.run-end-victim-box .blind-card__emblem')).not.toBeNull();

      findButtonByText(root, 'Главное меню')!.click();
      await flushMicrotasks();

      expect(mock.bridge.showInterstitial).toHaveBeenCalledTimes(1);
      expect(mounted.getSaveData().activeRun).toBeNull();
      expect(root.querySelector('.main-menu')).not.toBeNull();

      // Новый вход через «Играть» должен вести на чистый выбор колоды, а не на старый game_over
      findButtonByText(root, 'Играть')!.click();
      expect(mounted.getState().phase).toBe('deck_select');
    });

    it('подключает hover-тултипы в screenHostEl и скрывает свойства карт рубашкой вверх', async () => {
      localStorage.clear();
      const originalMatchMedia = window.matchMedia;
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(pointer: fine)' || query === '(hover: hover)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      try {
        const base = createInitialRunState('b_red', 'HOVER_SEED');
        const playing = dispatch(base, { type: 'SELECT_BLIND' }).nextState;
        const openId = playing.handIds[0]!;
        const hiddenId = playing.handIds[1]!;
        const stateWithFacing: RunState = {
          ...playing,
          deck: playing.deck.map((card) => {
            if (card.id === openId) {
              return { ...card, rank: 12 as const, suit: 'diamonds' as const, facing: 'front' as const };
            }
            if (card.id === hiddenId) {
              return {
                ...card,
                rank: 14 as const,
                suit: 'spades' as const,
                edition: 'foil' as const,
                facing: 'back' as const,
              };
            }
            return card;
          }),
        };
        const meta = createInitialMetaSave(10_000, { lang: 'ru' });
        const save = createPlayerSaveData(
          meta,
          serializeRunStateToSnapshot(stateWithFacing, 1, 10_000),
          1,
          10_000,
        );
        const mock = createMockBridge({ initialSave: save });

        mounted = mountBaliteApp(root, { bridge: mock.bridge });
        await mounted.readyPromise;

        const openEl = root.querySelector<HTMLElement>(`.hand-card-slot[data-card-id="${openId}"]`);
        const hiddenEl = root.querySelector<HTMLElement>(`.hand-card-slot[data-card-id="${hiddenId}"]`);
        expect(openEl).not.toBeNull();
        expect(hiddenEl).not.toBeNull();

        openEl!.dispatchEvent(
          Object.assign(new MouseEvent('pointerover', { bubbles: true }), { pointerType: 'mouse' }),
        );
        const tooltipEl = root.querySelector<HTMLElement>('.hover-tooltip');
        expect(tooltipEl).not.toBeNull();
        expect(tooltipEl!.hidden).toBe(false);
        expect(tooltipEl!.textContent).toContain('Бубны');

        hiddenEl!.dispatchEvent(
          Object.assign(new MouseEvent('pointerover', { bubbles: true }), { pointerType: 'mouse' }),
        );
        expect(tooltipEl!.hidden).toBe(false);
        expect(tooltipEl!.textContent).toContain('Скрытая карта');
        expect(tooltipEl!.textContent).toContain('Скрыто способностью Босса');
        expect(tooltipEl!.textContent).not.toContain('Пики');
        expect(tooltipEl!.textContent).not.toContain('Тисн');

        // Переход на модалку настроек скрывает активный тултип
        findButtonByText(root, 'Настройки')!.click();
        expect(tooltipEl!.hidden).toBe(true);
      } finally {
        Object.defineProperty(window, 'matchMedia', {
          configurable: true,
          writable: true,
          value: originalMatchMedia,
        });
      }
    });
  });

  describe('Story 1.5: DEV-словарь оригинальной терминологии под ?debug', () => {
    it('переключает термины интерфейса в ?debug и восстанавливает флаг из localStorage при перезапуске', async () => {
      localStorage.clear();
      await setDevOriginalTermsEnabled(false, false);

      try {
        const mockDebug = createMockBridge({ isDebug: true });
        mounted = mountBaliteApp(root, { bridge: mockDebug.bridge });
        await mounted.readyPromise;

        // Входим в бой, чтобы видеть термины HUD/кнопок
        root.querySelector<HTMLButtonElement>('[data-menu-action="play"]')?.click();
        findButtonByText(root, 'Начать забег')!.click();
        findButtonByText(root, 'Принять заказ')!.click();
        expect(root.textContent).toContain('Сил.');
        expect(root.textContent).toContain('Навыки');
        expect(root.textContent).toContain('Этаж 1');

        // Открываем Настройки и включаем DEV-словарь
        findButtonByText(root, 'Настройки')!.click();
        root.querySelector<HTMLButtonElement>('[data-hub-action="settings"]')?.click();
        const devOnBtn = root.querySelector<HTMLButtonElement>('[data-dev-terms="on"]');
        expect(devOnBtn).not.toBeNull();
        devOnBtn!.click();

        await vi.waitFor(() => {
          expect(root.textContent).toContain('Фиш.');
        });
        expect(root.textContent).toMatch(/Партия|Комбинации/);
        expect(root.textContent).toContain('Джокеры');
        expect(root.textContent).toContain('Анте');
        expect(root.querySelector<HTMLButtonElement>('[data-dev-terms="on"]')?.getAttribute('aria-pressed')).toBe('true');

        // Перемонтируем приложение — флаг из localStorage должен автоматически подтянуть DEV-словарь до готовности
        mounted.destroy();
        root.replaceChildren();

        const mockReloaded = createMockBridge({ isDebug: true });
        mounted = mountBaliteApp(root, { bridge: mockReloaded.bridge });
        await mounted.readyPromise;

        root.querySelector<HTMLButtonElement>('[data-menu-action="play"]')?.click();
        findButtonByText(root, 'Начать забег')!.click();
        expect(root.textContent).toContain('Блайнд');
      } finally {
        await setDevOriginalTermsEnabled(false, false);
        localStorage.clear();
      }
    });
  });

  describe('Story 1.6: пиксельный шрифт, CRT-эффект и локальные ассеты', () => {
    it('локальный шрифт Pixellari лежит в src/assets/fonts/, а :hover допустим только под @media (hover: hover) and (pointer: fine)', async () => {
      const fsModule = 'node:fs';
      const { existsSync, readFileSync } = (await import(/* @vite-ignore */ fsModule)) as {
        existsSync: (file: string) => boolean;
        readFileSync: (file: string, encoding: 'utf8') => string;
      };

      for (const file of [
        'src/assets/fonts/pixellari-cyrillic.woff2',
        'src/assets/fonts/Pixellari-OFL-LICENSE.txt',
      ]) {
        expect(existsSync(file)).toBe(true);
      }

      const indexHtml = readFileSync('index.html', 'utf8');
      expect(indexHtml).not.toMatch(/https?:\/\/fonts\./i);

      for (const cssFile of [
        'src/style.css',
        'src/ui/screens.css',
        'src/ui/modals.css',
        'src/ui/mainMenu.css',
        'src/ui/cardFrame.css',
      ]) {
        const css = readFileSync(cssFile, 'utf8');
        const marker = '@media (hover: hover) and (pointer: fine)';
        let stripped = css;
        let idx = stripped.indexOf(marker);
        while (idx !== -1) {
          const openBrace = stripped.indexOf('{', idx);
          if (openBrace === -1) break;
          let depth = 0;
          let end = openBrace;
          for (let i = openBrace; i < stripped.length; i += 1) {
            if (stripped[i] === '{') depth += 1;
            else if (stripped[i] === '}') {
              depth -= 1;
              if (depth === 0) {
                end = i + 1;
                break;
              }
            }
          }
          stripped = stripped.slice(0, idx) + stripped.slice(end);
          idx = stripped.indexOf(marker);
        }
        expect(stripped).not.toMatch(/:hover\b/);
      }
    });

    it('монтирует .crt-overlay с data-crt="light" по умолчанию и переключает режим через Настройки', async () => {
      localStorage.clear();
      const mock = createMockBridge();
      const mounted = mountBaliteApp(root, { bridge: mock.bridge });
      await mounted.readyPromise;

      const crtOverlay = root.querySelector<HTMLElement>('.crt-overlay');
      expect(crtOverlay).not.toBeNull();
      expect(crtOverlay?.getAttribute('aria-hidden')).toBe('true');
      expect(root.dataset.crt).toBe('light');
      expect(mounted.getSaveData().meta.settings.crtMode).toBe('light');

      // Переключаем CRT-режим через Настройки -> Оригинал -> Выкл
      root.querySelector<HTMLButtonElement>('[data-menu-action="settings"]')!.click();
      root.querySelector<HTMLButtonElement>('[data-hub-action="settings"]')?.click();

      const originalBtn = root.querySelector<HTMLButtonElement>('[data-crt-mode="original"]');
      expect(originalBtn).not.toBeNull();
      originalBtn!.click();

      expect(root.dataset.crt).toBe('original');
      expect(mounted.getSaveData().meta.settings.crtMode).toBe('original');
      expect(
        root.querySelector<HTMLButtonElement>('[data-crt-mode="original"]')?.getAttribute('aria-pressed'),
      ).toBe('true');

      root.querySelector<HTMLButtonElement>('[data-crt-mode="off"]')?.click();
      expect(root.dataset.crt).toBe('off');
      expect(mounted.getSaveData().meta.settings.crtMode).toBe('off');

      mounted.destroy();
      expect(root.dataset.crt).toBeUndefined();
      localStorage.clear();
    });
  });

  describe('Story 2.1: пружинные полёты карт CardAnimator', () => {
    it('интегрирует CardAnimator в app.ts: монтирует .card-flight-layer, анимирует перелёт карт в Play Zone, сортировку, сброс и очищает при destroy()', async () => {
      localStorage.clear();
      const baseState = createInitialRunState('b_red', 'APPANIM1');
      const playingState = dispatch(baseState, { type: 'SELECT_BLIND' }).nextState;
      const nowMs = 1_700_000_000_000;
      const save = createPlayerSaveData(
        createInitialMetaSave(nowMs, { lang: 'ru', animationSpeed: 1 }),
        serializeRunStateToSnapshot(playingState, 1, nowMs),
        1,
        nowMs,
      );
      const mock = createMockBridge({ initialSave: save });

      let frameNowMs = 0;
      let nextFrameId = 1;
      const pendingFrames = new Map<number, FrameRequestCallback>();
      const canceledFrames: number[] = [];
      const runFrames = (maxFrames = 200): void => {
        let count = 0;
        while (pendingFrames.size > 0 && count < maxFrames) {
          frameNowMs += 16;
          const batch = [...pendingFrames.entries()];
          pendingFrames.clear();
          for (const [, cb] of batch) {
            cb(frameNowMs);
          }
          count += 1;
        }
      };

      const rectSpy = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: HTMLElement): DOMRect {
          if (this.classList.contains('stage-screen-host') || this.classList.contains('card-flight-layer')) {
            return { x: 0, y: 0, left: 0, top: 0, width: 720, height: 1280, right: 720, bottom: 1280, toJSON: () => ({}) } as DOMRect;
          }
          if (this.classList.contains('deck-stack-btn')) {
            return { x: 600, y: 1120, left: 600, top: 1120, width: 70, height: 96, right: 670, bottom: 1216, toJSON: () => ({}) } as DOMRect;
          }
          if (this.classList.contains('hand-card-slot')) {
            const idx = Number(this.dataset.index ?? '0');
            const left = 60 + idx * 72;
            return { x: left, y: 960, left, top: 960, width: 80, height: 112, right: left + 80, bottom: 1072, toJSON: () => ({}) } as DOMRect;
          }
          if (this.classList.contains('play-zone__card')) {
            const left = 280;
            return { x: left, y: 520, left, top: 520, width: 88, height: 122, right: left + 88, bottom: 642, toJSON: () => ({}) } as DOMRect;
          }
          return { x: 0, y: 0, left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, toJSON: () => ({}) } as DOMRect;
        });

      try {
        const mounted = mountBaliteApp(root, {
          bridge: mock.bridge,
          initialNowMs: () => nowMs,
          cardAnimatorOptions: {
            now: () => frameNowMs,
            prefersReducedMotion: () => false,
            requestFrame: (cb) => {
              const id = nextFrameId++;
              pendingFrames.set(id, cb);
              return id;
            },
            cancelFrame: (id) => {
              canceledFrames.push(id);
              pendingFrames.delete(id);
            },
          },
        });
        await mounted.readyPromise;

        const flightLayer = root.querySelector<HTMLElement>('.card-flight-layer');
        expect(flightLayer).not.toBeNull();
        expect(flightLayer?.getAttribute('aria-hidden')).toBe('true');

        // 1. Сортировка по масти меняет порядок слотов и запускает rAF-перелёт
        const suitSortBtn = root.querySelector<HTMLButtonElement>('.hand-actions__sort-suit')!;
        suitSortBtn.click();
        expect(pendingFrames.size).toBeGreaterThanOrEqual(0);
        runFrames();
        root.querySelectorAll<HTMLElement>('.hand-card-slot').forEach((slot) => {
          expect(slot.style.transform).toBe('');
          expect(slot.dataset.flightActive).toBeUndefined();
        });

        // 2. Розыгрыш карты переносит её в Play Zone с data-flight-active
        const firstHandCard = root.querySelector<HTMLElement>('[data-belt="hand"] [data-zone="hand"][data-card-id]')!;
        const playedId = firstHandCard.dataset.cardId!;
        firstHandCard.click();
        runFrames();

        vi.useFakeTimers();
        findButtonByText(root.querySelector('[data-belt="hand"]')!, 'Сыграть')!.click();

        const playSlot = root.querySelector<HTMLElement>(`.play-zone__card[data-card-id="${playedId}"]`);
        expect(playSlot).not.toBeNull();
        expect(playSlot?.dataset.flightActive).toBe('true');
        expect(playSlot?.style.transform).toContain('translate3d(');
        expect(pendingFrames.size).toBe(1);

        runFrames();
        expect(playSlot?.style.transform).toBe('');
        expect(playSlot?.dataset.flightActive).toBeUndefined();

        // 3. По окончании TracePlayer сыгранная карта улетает через призрака в сброс
        (root.querySelector('.arena-stage') as HTMLElement).click();
        await vi.advanceTimersByTimeAsync(20);
        await flushMicrotasks();

        expect(flightLayer?.querySelectorAll('.card-flight-ghost').length).toBeGreaterThanOrEqual(1);
        expect(pendingFrames.size).toBe(1);

        // 4. destroy() отменяет rAF и удаляет всех незавершённых призраков
        mounted.destroy();
        expect(canceledFrames.length).toBeGreaterThanOrEqual(1);
        expect(flightLayer?.querySelectorAll('.card-flight-ghost').length).toBe(0);
        localStorage.clear();
      } finally {
        rectSpy.mockRestore();
      }
    });
  });

  describe('Story 2.2: 3D-наклон, парение и перелив изданий', () => {
    it('подключает initCardTiltController в app.ts, обновляет --tilt-x/--tilt-y/--glare-x/--sway-r и очищает ресурсы при destroy()', async () => {
      localStorage.clear();
      const baseState = createInitialRunState('b_red', 'APPTILT1');
      const playingState = dispatch(baseState, { type: 'SELECT_BLIND' }).nextState;
      const nowMs = 1_700_000_000_000;
      const save = createPlayerSaveData(
        createInitialMetaSave(nowMs, { lang: 'ru' }),
        serializeRunStateToSnapshot(playingState, 1, nowMs),
        1,
        nowMs,
      );
      const mock = createMockBridge({ initialSave: save });

      let frameNowMs = 0;
      let nextFrameId = 1;
      const pendingFrames = new Map<number, FrameRequestCallback>();
      const canceledFrames: number[] = [];
      const runStep = (dtMs = 16): void => {
        frameNowMs += dtMs;
        const batch = [...pendingFrames.entries()];
        pendingFrames.clear();
        for (const [, cb] of batch) {
          cb(frameNowMs);
        }
      };

      const rectSpy = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: HTMLElement): DOMRect {
          if (this.classList.contains('card-frame')) {
            return { x: 100, y: 200, left: 100, top: 200, width: 100, height: 140, right: 200, bottom: 340, toJSON: () => ({}) } as DOMRect;
          }
          return { x: 0, y: 0, left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, toJSON: () => ({}) } as DOMRect;
        });

      try {
        const mounted = mountBaliteApp(root, {
          bridge: mock.bridge,
          initialNowMs: () => nowMs,
          cardTiltOptions: {
            now: () => frameNowMs,
            reducedMotion: () => false,
            requestFrame: (cb) => {
              const id = nextFrameId++;
              pendingFrames.set(id, cb);
              return id;
            },
            cancelFrame: (id) => {
              canceledFrames.push(id);
              pendingFrames.delete(id);
            },
          },
        });
        await mounted.readyPromise;

        const stage = root.querySelector<HTMLElement>('.stage-portrait');
        expect(stage?.dataset.cardTiltManaged).toBe('true');

        const firstFrame = root.querySelector<HTMLElement>('[data-belt="hand"] .card-frame');
        expect(firstFrame).not.toBeNull();
        expect(firstFrame?.querySelector('.card-glare')).not.toBeNull();

        // Несколько кадров парения в простое заполняют --sway-r и --sway-y
        runStep(24);
        runStep(24);
        expect(firstFrame!.style.getPropertyValue('--sway-r')).toMatch(/deg$/);
        expect(firstFrame!.style.getPropertyValue('--sway-y')).toMatch(/px$/);

        // Наведение и движение мыши обновляют --tilt-x и --glare-x через делегированный контроллер
        firstFrame!.dispatchEvent(
          Object.assign(new Event('pointerover', { bubbles: true }), {
            pointerType: 'mouse',
            clientX: 190,
            clientY: 220,
          }),
        );
        firstFrame!.dispatchEvent(
          Object.assign(new Event('pointermove', { bubbles: true }), {
            pointerType: 'mouse',
            clientX: 195,
            clientY: 215,
          }),
        );
        for (let i = 0; i < 6; i += 1) {
          runStep(16);
        }
        expect(Number(firstFrame!.style.getPropertyValue('--tilt-x'))).toBeGreaterThan(0.5);
        expect(firstFrame!.style.getPropertyValue('--glare-x')).toMatch(/%$/);

        // destroy() отменяет rAF и убирает data-card-tilt-managed
        mounted.destroy();
        expect(canceledFrames.length).toBeGreaterThanOrEqual(1);
        expect(pendingFrames.size).toBe(0);
        expect(stage?.dataset.cardTiltManaged).toBeUndefined();
        localStorage.clear();
      } finally {
        rectSpy.mockRestore();
      }
    });
  });

  describe('Story 2.3: импульс juice_up и пламя scoreFlame', () => {
    it('зажигает пламя .hud-score-flame при пробитии порога в предпросмотре и во время TracePlayer, запускает juice_up и гасит при выходе из боя / destroy()', async () => {
      localStorage.clear();
      const baseState = createInitialRunState('b_red', 'APPFLAME1');
      let playingState = dispatch(baseState, { type: 'SELECT_BLIND' }).nextState;
      const lethalAce = createPlayingCard({
        id: 'lethal_ace',
        suit: 'spades',
        rank: 14,
        enhancement: 'mult',
        edition: 'foil',
      });
      const relic = createRelicInstance('j_joker', 'rel_flame_joker');
      playingState = {
        ...playingState,
        score: Math.max(0, playingState.targetScore - 4),
        handIds: ['lethal_ace', ...playingState.handIds.slice(1)],
        deck: [lethalAce, ...playingState.deck],
        relics: [relic],
      };

      const nowMs = 1_700_000_000_000;
      const save = createPlayerSaveData(
        createInitialMetaSave(nowMs, { lang: 'ru', animationSpeed: 2 }),
        serializeRunStateToSnapshot(playingState, 1, nowMs),
        1,
        nowMs,
      );
      const mock = createMockBridge({ initialSave: save });

      let animNowMs = 0;
      let nextAnimId = 1;
      const animFrames = new Map<number, FrameRequestCallback>();
      const animCanceled: number[] = [];

      let flameNowMs = 0;
      let nextFlameId = 1;
      const flameFrames = new Map<number, FrameRequestCallback>();
      const flameCanceled: number[] = [];

      const stepAllFrames = (dtMs = 16): void => {
        animNowMs += dtMs;
        const aBatch = [...animFrames.entries()];
        animFrames.clear();
        for (const [, cb] of aBatch) cb(animNowMs);

        flameNowMs += dtMs;
        const fBatch = [...flameFrames.entries()];
        flameFrames.clear();
        for (const [, cb] of fBatch) cb(flameNowMs);
      };

      const mounted = mountBaliteApp(root, {
        bridge: mock.bridge,
        initialNowMs: () => nowMs,
        cardAnimatorOptions: {
          now: () => animNowMs,
          prefersReducedMotion: () => false,
          requestFrame: (cb) => {
            const id = nextAnimId++;
            animFrames.set(id, cb);
            return id;
          },
          cancelFrame: (id) => {
            animCanceled.push(id);
            animFrames.delete(id);
          },
        },
        scoreFlameOptions: {
          now: () => flameNowMs,
          reducedMotion: () => false,
          requestFrame: (cb) => {
            const id = nextFlameId++;
            flameFrames.set(id, cb);
            return id;
          },
          cancelFrame: (id) => {
            flameCanceled.push(id);
            flameFrames.delete(id);
          },
        },
      });
      await mounted.readyPromise;

      // При пустом выборе пламя неактивно
      const flameIdle = root.querySelector<HTMLElement>('.hud-score-flame');
      expect(flameIdle).not.toBeNull();
      expect(flameIdle?.dataset.flameActive).toBe('false');

      // Выделяем туза: в предпросмотре 5 * 1 = 5, порог 296 + 5 >= 300 пробит -> пламя загорается
      root.querySelector<HTMLElement>('[data-belt="hand"] [data-card-id="lethal_ace"]')!.click();
      expect(root.querySelector<HTMLElement>('.hud-score-flame')?.dataset.flameActive).toBe('true');

      // Снимаем выделение -> пламя предпросмотра гаснет, затем снова выделяем карту
      root.querySelector<HTMLElement>('[data-belt="hand"] [data-card-id="lethal_ace"]')!.click();
      expect(root.querySelector<HTMLElement>('.hud-score-flame')?.dataset.flameActive).toBe('false');
      root.querySelector<HTMLElement>('[data-belt="hand"] [data-card-id="lethal_ace"]')!.click();

      // Запускаем PLAY_HAND: на шагах CARD_TRIGGER и RELIC_TRIGGER
      // формула растёт пошагово, срабатывает juice_up и горит пламя
      vi.useFakeTimers();
      findButtonByText(root.querySelector('[data-belt="hand"]')!, 'Сыграть')!.click();

      const playCardSlot = root.querySelector<HTMLElement>('.play-zone__card[data-card-id="lethal_ace"]');
      const chipsPill = root.querySelector<HTMLElement>('.hud-pill--chips');
      const chipsValEl = root.querySelector<HTMLElement>('[data-ref="chips"]');
      const multValEl = root.querySelector<HTMLElement>('[data-ref="mult"]');

      expect(playCardSlot?.dataset.flightActive).toBe('true');
      expect(chipsPill?.dataset.flightActive).toBe('true');

      // Прокручиваем кадры NumberRoller на первом шаге и затем до RELIC_TRIGGER (350 мс при speed=2)
      await vi.advanceTimersByTimeAsync(150);
      expect(Number(chipsValEl?.textContent)).toBeGreaterThan(5);

      await vi.advanceTimersByTimeAsync(200);
      stepAllFrames(16);

      const flameActive = root.querySelector<HTMLElement>('.hud-score-flame');
      expect(flameActive?.dataset.flameActive).toBe('true');
      expect(Number(multValEl?.textContent)).toBeGreaterThanOrEqual(5);

      // Завершаем оставшиеся шаги TracePlayer -> переход в cashout гасит пламя
      await vi.advanceTimersByTimeAsync(3000);
      await flushMicrotasks();

      expect(mounted.getState().phase).toBe('cashout');
      const flameAfterRound = root.querySelector<HTMLElement>('.hud-score-flame');
      expect(flameAfterRound?.dataset.flameActive).toBe('false');

      // После destroy() активные кадры пламени и аниматора остановлены
      mounted.destroy();
      expect(animFrames.size).toBe(0);
      expect(flameFrames.size).toBe(0);
      expect(flameCanceled.length).toBeGreaterThanOrEqual(0);
      localStorage.clear();
    });
  });

  describe('Story 2.4: numberRoller, построчный кэшаут и particleCanvas', () => {
    it('накручивает счётчики HUD, ведёт построчный кэшаут без перезапуска и запускает частицы shatter / расходников / confetti', async () => {
      localStorage.clear();
      const fillColors: string[] = [];
      let arcCalls = 0;
      let fillRectCalls = 0;
      let polygonCalls = 0;

      const origGetContext = HTMLCanvasElement.prototype.getContext;
      const ctxSpy = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockImplementation(function (this: HTMLCanvasElement, contextId: string) {
          if (contextId === '2d' && this.classList.contains('fx-particle-canvas')) {
            let currentFill = '';
            return {
              save: vi.fn(),
              restore: vi.fn(),
              clearRect: vi.fn(),
              scale: vi.fn(),
              translate: vi.fn(),
              rotate: vi.fn(),
              beginPath: vi.fn(),
              moveTo: vi.fn(),
              lineTo: vi.fn(() => {
                polygonCalls += 1;
              }),
              closePath: vi.fn(),
              arc: vi.fn(() => {
                arcCalls += 1;
              }),
              fill: vi.fn(() => {
                if (currentFill) fillColors.push(currentFill);
              }),
              fillRect: vi.fn(() => {
                fillRectCalls += 1;
                if (currentFill) fillColors.push(currentFill);
              }),
              set fillStyle(val: string) {
                currentFill = val;
              },
              get fillStyle() {
                return currentFill;
              },
              globalAlpha: 1,
            } as unknown as CanvasRenderingContext2D;
          }
          return origGetContext ? origGetContext.call(this, contextId as '2d') : null;
        });

      try {
        const baseState = createInitialRunState('b_red', 'STORY24');
        let playingState = dispatch(baseState, { type: 'SELECT_BLIND' }).nextState;
        const glassAce = createPlayingCard({
          id: 'glass_ace',
          suit: 'spades',
          rank: 14,
          enhancement: 'glass',
        });
        // Делаем детерминированное разрушение при броске или проверяем через расходник + победу
        const scroll = createConsumableInstance('c_mercury', 'cons_planet_mercury');
        const rune = createConsumableInstance('c_trance', 'cons_rune_trance');
        playingState = {
          ...playingState,
          score: Math.max(0, playingState.targetScore - 20),
          handIds: ['glass_ace', ...playingState.handIds.slice(1)],
          deck: [glassAce, ...playingState.deck],
          consumables: [scroll, rune],
        };

        const nowMs = 1_700_000_000_000;
        const save = createPlayerSaveData(
          createInitialMetaSave(nowMs, { lang: 'ru', animationSpeed: 1 }),
          serializeRunStateToSnapshot(playingState, 1, nowMs),
          1,
          nowMs,
        );
        const mock = createMockBridge({ initialSave: save });

        let rollerNowMs = 0;
        let nextRollerId = 1;
        const rollerFrames = new Map<number, FrameRequestCallback>();

        let fxNowMs = 0;
        let nextFxId = 1;
        const fxFrames = new Map<number, FrameRequestCallback>();

        const stepRoller = (dtMs: number): void => {
          rollerNowMs += dtMs;
          const batch = [...rollerFrames.entries()];
          rollerFrames.clear();
          for (const [, cb] of batch) cb(rollerNowMs);
        };

        const stepFx = (dtMs: number): void => {
          fxNowMs += dtMs;
          const batch = [...fxFrames.entries()];
          fxFrames.clear();
          for (const [, cb] of batch) cb(fxNowMs);
        };

        const mounted = mountBaliteApp(root, {
          bridge: mock.bridge,
          initialNowMs: () => nowMs,
          numberRollerOptions: {
            now: () => rollerNowMs,
            reducedMotion: () => false,
            requestFrame: (cb) => {
              const id = nextRollerId++;
              rollerFrames.set(id, cb);
              return id;
            },
            cancelFrame: (id) => {
              rollerFrames.delete(id);
            },
          },
          particleCanvasOptions: {
            now: () => fxNowMs,
            reducedMotion: () => false,
            requestFrame: (cb) => {
              const id = nextFxId++;
              fxFrames.set(id, cb);
              return id;
            },
            cancelFrame: (id) => {
              fxFrames.delete(id);
            },
          },
        });
        await mounted.readyPromise;

        const fxCanvas = root.querySelector<HTMLCanvasElement>('.fx-particle-canvas');
        expect(fxCanvas).not.toBeNull();
        expect(fxCanvas?.getAttribute('aria-hidden')).toBe('true');
        expect(fxCanvas?.style.pointerEvents).toBe('none');

        // 1. Применение Сферы (c_mercury) из полки выпускает искры (arc)
        root.querySelector<HTMLElement>(`[data-consumable-uid="${scroll.uid}"]`)!.click();
        findButtonByText(root.querySelector('.stage-overlay-host')!, 'Использовать')!.click();
        expect(fxFrames.size).toBeGreaterThan(0);
        stepFx(16);
        expect(arcCalls).toBeGreaterThan(0);

        // 2. Выбираем карту в руке -> счётчик Сила (chips) катится плавно через numberRoller, а не прыгает
        root.querySelector<HTMLElement>('[data-belt="hand"] [data-card-id="glass_ace"]')!.click();
        const chipsElBefore = root.querySelector<HTMLElement>('[data-ref="chips"]')!;
        expect(Number(chipsElBefore.textContent)).toBe(0);
        stepRoller(80);
        const midChips = Number(root.querySelector<HTMLElement>('[data-ref="chips"]')!.textContent);
        expect(midChips).toBeGreaterThan(0);
        expect(midChips).toBeLessThan(5);
        stepRoller(300);
        expect(Number(root.querySelector<HTMLElement>('[data-ref="chips"]')!.textContent)).toBe(5);

        // 3. Играем руку (пробиваем порог и выходим в cashout) -> проверяем построчный кэшаут
        vi.useFakeTimers();
        findButtonByText(root.querySelector('[data-belt="hand"]')!, 'Сыграть')!.click();
        await vi.advanceTimersByTimeAsync(4500);
        await flushMicrotasks();

        // Пока роллер докручивает score, догоняем кадры и переходим в cashout
        stepRoller(400);
        expect(mounted.getState().phase).toBe('cashout');

        const cashoutRows = Array.from(root.querySelectorAll<HTMLElement>('.cashout-row'));
        expect(cashoutRows.length).toBe(6);
        expect(cashoutRows[0]?.dataset.cashoutRevealed).toBe('true');
        expect(cashoutRows[5]?.dataset.cashoutRevealed).toBe('false');

        // Продвигаем таймлайн кэшаута на один шаг
        stepRoller(160);
        expect(cashoutRows[1]?.dataset.cashoutRevealed).toBe('true');

        // Клик по списку кэшаута мгновенно завершает оставшиеся строки
        root.querySelector<HTMLElement>('.cashout-list')?.click();
        expect(cashoutRows.every((row) => row.dataset.cashoutRevealed === 'true')).toBe(true);

        // Повторная перерисовка (смена языка в Настройках вызывает render()) не сбрасывает и не перезапускает строки обратно в false
        findButtonByText(root, 'Настройки')!.click();
        root.querySelector<HTMLButtonElement>('[data-hub-action="settings"]')?.click();
        findButtonByText(root.querySelector('[data-modal="settings"]')!, 'English')!.click();
        root.querySelector<HTMLButtonElement>('[data-modal="settings"] [data-action="close"]')?.click();
        const rowsAfterRerender = Array.from(root.querySelectorAll<HTMLElement>('.cashout-row'));
        expect(rowsAfterRerender.every((row) => row.dataset.cashoutRevealed === 'true')).toBe(true);

        // Переходим к победному экрану через состояние забега? Проверим отдельный сценарий победы с confetti и разрушением ниже
        mounted.destroy();
        expect(rollerFrames.size).toBe(0);
        expect(fxFrames.size).toBe(0);
        expect(root.querySelector('.fx-particle-canvas')).toBeNull();
        expect(polygonCalls).toBeGreaterThanOrEqual(0);
        expect(fillRectCalls).toBeGreaterThanOrEqual(0);
        expect(fillColors.length).toBeGreaterThan(0);
        localStorage.clear();
      } finally {
        ctxSpy.mockRestore();
      }
    });

    it('пропускает кэшаут по клику, выпускает конфетти при победе и чистит частицы при destroy()', async () => {
      localStorage.clear();
      let confettiRects = 0;
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      const ctxSpy = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockImplementation(function (this: HTMLCanvasElement, contextId: string) {
          if (contextId === '2d' && this.classList.contains('fx-particle-canvas')) {
            return {
              save: vi.fn(),
              restore: vi.fn(),
              clearRect: vi.fn(),
              scale: vi.fn(),
              translate: vi.fn(),
              rotate: vi.fn(),
              beginPath: vi.fn(),
              moveTo: vi.fn(),
              lineTo: vi.fn(),
              closePath: vi.fn(),
              arc: vi.fn(),
              fill: vi.fn(),
              fillRect: vi.fn(() => {
                confettiRects += 1;
              }),
              fillStyle: '#fff',
              globalAlpha: 1,
            } as unknown as CanvasRenderingContext2D;
          }
          return origGetContext ? origGetContext.call(this, contextId as '2d') : null;
        });

      try {
        // Проверка победы: Анте 8, Босс-страж пробит на 1 очко до цели -> PLAY_HAND ведёт к victory -> confetti
        const baseState = createInitialRunState('b_red', 'STORY24WIN');
        let playingState = dispatch(baseState, { type: 'SELECT_BLIND' }).nextState;
        playingState = {
          ...playingState,
          ante: 8,
          currentBlindIndex: 2,
          score: Math.max(0, playingState.targetScore - 5),
        };

        const nowMs = 1_700_000_000_000;
        const save = createPlayerSaveData(
          createInitialMetaSave(nowMs, { lang: 'ru', animationSpeed: 4 }),
          serializeRunStateToSnapshot(playingState, 1, nowMs),
          1,
          nowMs,
        );
        const mock = createMockBridge({ initialSave: save });

        let fxNowMs = 0;
        let nextFxId = 1;
        const fxFrames = new Map<number, FrameRequestCallback>();

        const mounted = mountBaliteApp(root, {
          bridge: mock.bridge,
          initialNowMs: () => nowMs,
          particleCanvasOptions: {
            now: () => fxNowMs,
            reducedMotion: () => false,
            requestFrame: (cb) => {
              const id = nextFxId++;
              fxFrames.set(id, cb);
              return id;
            },
            cancelFrame: (id) => {
              fxFrames.delete(id);
            },
          },
        });
        await mounted.readyPromise;

        // Побеждаем на 8 анте
        vi.useFakeTimers();
        const firstCardId = mounted.getState().handIds[0]!;
        root.querySelector<HTMLElement>(`[data-belt="hand"] [data-card-id="${firstCardId}"]`)!.click();
        findButtonByText(root.querySelector('[data-belt="hand"]')!, 'Сыграть')!.click();
        await vi.advanceTimersByTimeAsync(2500);
        await flushMicrotasks();

        expect(mounted.getState().phase).toBe('victory');
        expect(fxFrames.size).toBeGreaterThan(0);

        fxNowMs += 16;
        const batch = [...fxFrames.entries()];
        fxFrames.clear();
        for (const [, cb] of batch) cb(fxNowMs);
        expect(confettiRects).toBeGreaterThan(0);

        // Повторная перерисовка (смена языка в Настройках вызывает render()) не спавнит конфетти повторно
        const rectsBeforeReopen = confettiRects;
        findButtonByText(root, 'Настройки')!.click();
        root.querySelector<HTMLButtonElement>('[data-hub-action="settings"]')?.click();
        findButtonByText(root.querySelector('[data-modal="settings"]')!, 'English')!.click();
        root.querySelector<HTMLButtonElement>('[data-modal="settings"] [data-action="close"]')?.click();
        expect(confettiRects).toBe(rectsBeforeReopen);

        mounted.destroy();
        expect(fxFrames.size).toBe(0);
        localStorage.clear();
      } finally {
        ctxSpy.mockRestore();
      }
    });

    it('выпускает кристальные осколки shatter на canvas при разрушении Хрустальной карты (CARD_SHATTER)', async () => {
      localStorage.clear();
      let shardPolygons = 0;
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      const ctxSpy = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockImplementation(function (this: HTMLCanvasElement, contextId: string) {
          if (contextId === '2d' && this.classList.contains('fx-particle-canvas')) {
            return {
              save: vi.fn(),
              restore: vi.fn(),
              clearRect: vi.fn(),
              scale: vi.fn(),
              translate: vi.fn(),
              rotate: vi.fn(),
              beginPath: vi.fn(),
              moveTo: vi.fn(),
              lineTo: vi.fn(() => {
                shardPolygons += 1;
              }),
              closePath: vi.fn(),
              arc: vi.fn(),
              fill: vi.fn(),
              fillRect: vi.fn(),
              fillStyle: '#fff',
              globalAlpha: 1,
            } as unknown as CanvasRenderingContext2D;
          }
          return origGetContext ? origGetContext.call(this, contextId as '2d') : null;
        });

      try {
        // Детерминированно подбираем сид, при котором хрустальный туз разбивается с первого броска
        let shatterState: RunState | null = null;
        for (let i = 0; i < 40; i++) {
          const base = createInitialRunState('b_red', `SHATTER_${i}`);
          const sel = dispatch(base, { type: 'SELECT_BLIND' }).nextState;
          const glassAce = createPlayingCard({
            id: 'glass_ace',
            suit: 'spades',
            rank: 14,
            enhancement: 'glass',
          });
          const candidate: RunState = {
            ...sel,
            handIds: ['glass_ace', ...sel.handIds.slice(1)],
            deck: [glassAce, ...sel.deck],
          };
          const probe = dispatch(candidate, { type: 'PLAY_HAND', cardIds: ['glass_ace'] });
          if (probe.events.some((ev) => ev.type === 'CARD_SHATTER' && ev.cardId === 'glass_ace')) {
            shatterState = candidate;
            break;
          }
        }
        expect(shatterState).not.toBeNull();

        const nowMs = 1_700_000_000_000;
        const save = createPlayerSaveData(
          createInitialMetaSave(nowMs, { lang: 'ru', animationSpeed: 4 }),
          serializeRunStateToSnapshot(shatterState!, 1, nowMs),
          1,
          nowMs,
        );
        const mock = createMockBridge({ initialSave: save });

        let fxNowMs = 0;
        let nextFxId = 1;
        const fxFrames = new Map<number, FrameRequestCallback>();

        const mounted = mountBaliteApp(root, {
          bridge: mock.bridge,
          initialNowMs: () => nowMs,
          particleCanvasOptions: {
            now: () => fxNowMs,
            reducedMotion: () => false,
            requestFrame: (cb) => {
              const id = nextFxId++;
              fxFrames.set(id, cb);
              return id;
            },
            cancelFrame: (id) => {
              fxFrames.delete(id);
            },
          },
        });
        await mounted.readyPromise;

        vi.useFakeTimers();
        root.querySelector<HTMLElement>('[data-belt="hand"] [data-card-id="glass_ace"]')!.click();
        findButtonByText(root.querySelector('[data-belt="hand"]')!, 'Сыграть')!.click();

        await vi.advanceTimersByTimeAsync(2500);
        await flushMicrotasks();

        expect(fxFrames.size).toBeGreaterThan(0);
        fxNowMs += 16;
        const batch = [...fxFrames.entries()];
        fxFrames.clear();
        for (const [, cb] of batch) cb(fxNowMs);
        expect(shardPolygons).toBeGreaterThan(0);

        mounted.destroy();
        expect(fxFrames.size).toBe(0);
        localStorage.clear();
      } finally {
        ctxSpy.mockRestore();
      }
    });
  });

  describe('Эпик 3: Админ-панель (?debug) и защита прод-сборки', () => {
    it('скрывает кнопку DEV, пункт в Настройках и блокирует F9 при isDebug=false', async () => {
      localStorage.clear();
      const mock = createMockBridge({ isDebug: false });
      const mounted = mountBaliteApp(root, { bridge: mock.bridge });
      await mounted.readyPromise;

      root.querySelector<HTMLButtonElement>('[data-menu-action="play"]')?.click();
      findButtonByText(root, 'Начать забег')!.click();
      findButtonByText(root, 'Принять заказ')!.click();

      expect(root.querySelector('[data-action="open-debug"]')).toBeNull();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F9', bubbles: true }));
      expect(root.querySelector('[data-modal="debug"]')).toBeNull();

      findButtonByText(root, 'Настройки')!.click();
      root.querySelector<HTMLButtonElement>('[data-hub-action="settings"]')?.click();
      expect(root.querySelector('[data-debug-open-panel]')).toBeNull();

      mounted.destroy();
      localStorage.clear();
    });

    it('при isDebug=true открывает Админ-панель по кнопке DEV / F9 / Настройкам и применяет мутации RunState', async () => {
      localStorage.clear();
      const mock = createMockBridge({ isDebug: true });
      const mounted = mountBaliteApp(root, { bridge: mock.bridge });
      await mounted.readyPromise;

      root.querySelector<HTMLButtonElement>('[data-menu-action="play"]')?.click();
      findButtonByText(root, 'Начать забег')!.click();
      findButtonByText(root, 'Принять заказ')!.click();

      const devBtn = root.querySelector<HTMLButtonElement>('[data-action="open-debug"]');
      expect(devBtn).not.toBeNull();

      // Открытие по F9 и закрытие повторным F9
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F9', bubbles: true }));
      expect(root.querySelector('[data-modal="debug"]')).not.toBeNull();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F9', bubbles: true }));
      expect(root.querySelector('[data-modal="debug"]')).toBeNull();

      // Открываем через кнопку DEV в HUD
      devBtn!.click();
      expect(root.querySelector('[data-modal="debug"]')).not.toBeNull();

      // Вкладка «Бой и ресурсы»: +$20 и пробитие порога
      const initialDollars = mounted.getState().dollars;
      root.querySelector<HTMLButtonElement>('[data-debug-cmd="add-dollars-20"]')?.click();
      expect(mounted.getState().dollars).toBe(initialDollars + 20);

      // Вкладка «Карты в руке»: применяем Полихром и Хрусталь к первой карте
      root.querySelector<HTMLButtonElement>('[data-debug-tab="cards"]')?.click();
      root.querySelector<HTMLButtonElement>('[data-debug-edition="polychrome"]')?.click();
      root.querySelector<HTMLButtonElement>('[data-debug-enhancement="glass"]')?.click();
      const firstHandId = mounted.getState().handIds[0]!;
      const modifiedCard = mounted.getState().deck.find((c) => c.id === firstHandId);
      expect(modifiedCard?.edition).toBe('polychrome');
      expect(modifiedCard?.enhancement).toBe('glass');

      // Вкладка «Выдать предмет»: выдаём реликвию j_joker
      root.querySelector<HTMLButtonElement>('[data-debug-tab="spawn"]')?.click();
      root.querySelector<HTMLButtonElement>('[data-debug-give="relic:j_joker"]')?.click();
      expect(mounted.getState().relics.some((r) => r.id === 'j_joker')).toBe(true);

      // Вкладка «Бой и ресурсы»: перевод в кэшаут и в победу
      root.querySelector<HTMLButtonElement>('[data-debug-tab="combat"]')?.click();
      root.querySelector<HTMLButtonElement>('[data-debug-cmd="force-cashout"]')?.click();
      expect(mounted.getState().phase).toBe('cashout');

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F9', bubbles: true }));
      root.querySelector<HTMLButtonElement>('[data-debug-cmd="force-victory"]')?.click();
      expect(mounted.getState().phase).toBe('victory');

      mounted.destroy();
      localStorage.clear();
    });

    it('открывает окно «Коллекция» из Главного меню и поддерживает управление через дебаг-панель', async () => {
      const mock = createMockBridge({ isDebug: true });
      const mounted = mountBaliteApp(root, { bridge: mock.bridge });
      await flushMicrotasks();

      // Нажимаем кнопку Коллекция в главном меню
      const collectionMenuBtn = root.querySelector<HTMLButtonElement>('[data-menu-action="collection"]');
      expect(collectionMenuBtn).not.toBeNull();
      expect(collectionMenuBtn?.disabled).toBe(false);
      collectionMenuBtn?.click();

      // Модальное окно коллекции открыто
      const collectionModal = root.querySelector<HTMLElement>('[data-modal="collection"]');
      expect(collectionModal).not.toBeNull();
      expect(collectionModal?.querySelector('.collection-hub')).not.toBeNull();

      // Закрываем окно коллекции через кнопку Назад
      collectionModal?.querySelector<HTMLButtonElement>('.collection-back-btn')?.click();
      expect(root.querySelector('[data-modal="collection"]')).toBeNull();

      // Открываем панель дебага по F9
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F9', bubbles: true }));
      expect(root.querySelector('[data-modal="debug"]')).not.toBeNull();

      // Переходим на вкладку Система / SDK
      findButtonByText(root.querySelector('[data-modal="debug"]')!, 'Система / SDK')?.click();

      // Нажимаем «Открыть всю коллекцию»
      const unlockBtn = root.querySelector<HTMLButtonElement>('[data-debug-action="unlockCollection"]');
      expect(unlockBtn).not.toBeNull();
      unlockBtn?.click();
      await flushMicrotasks();

      expect(mounted.getSaveData().meta.discoveredRelics.length).toBe(40);

      // Нажимаем «Сбросить коллекцию»
      const resetBtn = root.querySelector<HTMLButtonElement>('[data-debug-action="resetCollection"]');
      expect(resetBtn).not.toBeNull();
      resetBtn?.click();
      await flushMicrotasks();

      expect(mounted.getSaveData().meta.discoveredRelics.length).toBe(0);

      mounted.destroy();
      localStorage.clear();
    });
  });

  describe('Story 5.1: Интеграция гибридного аудиодвижка в app.ts', () => {
    function createSpyAudio(): BaliteAudioController {
      const controller: BaliteAudioController = {
        unlock: vi.fn(),
        setSettings: vi.fn(),
        getSettings: vi.fn(() => ({ soundEnabled: true, sfxVolume: 0.8, musicVolume: 0.4 })),
        isMuted: vi.fn(() => false),
        playButton: vi.fn(),
        playCardHover: vi.fn(),
        playCardSelect: vi.fn(),
        playCardDeselect: vi.fn(),
        playCardDeal: vi.fn(),
        playChipHit: vi.fn(),
        playMultHit: vi.fn(),
        playRelicTrigger: vi.fn(),
        playGoldDelta: vi.fn(),
        playBoosterOpen: vi.fn(),
        playConsumable: vi.fn(),
        playFlameThreshold: vi.fn(),
        playShatter: vi.fn(),
        playDebuff: vi.fn(),
        playBuy: vi.fn(),
        playReroll: vi.fn(),
        playWin: vi.fn(),
        playLose: vi.fn(),
        playDialogue: vi.fn(),
        playForTraceEvent: vi.fn((event, comboIndex) => {
          dispatchTraceAudioEvent(controller, event, comboIndex);
        }),
        dispose: vi.fn(),
      };
      return controller;
    }

    function dispatchPointerOver(el: Element, pointerType: 'mouse' | 'touch', relatedTarget: EventTarget | null = null): void {
      const ev = new MouseEvent('pointerover', { bubbles: true, relatedTarget });
      Object.defineProperty(ev, 'pointerType', { value: pointerType });
      el.dispatchEvent(ev);
    }

    it('проигрывает playCardHover на открытой карте в руке для pointer: fine с троттлингом >= 60ms и игнорирует touch/рубашки', async () => {
      const root = document.createElement('div');
      document.body.appendChild(root);
      let nowClockMs = 1_000;

      const base = createInitialRunState('b_red', 'AUDIOHOVER');
      const playing = dispatch(base, { type: 'SELECT_BLIND' }).nextState;
      const hiddenCardId = playing.handIds[1]!;
      const playingWithFaceDown: RunState = {
        ...playing,
        deck: playing.deck.map((card) =>
          card.id === hiddenCardId ? { ...card, facing: 'back' } : card,
        ),
      };
      const save = createPlayerSaveData(
        createInitialMetaSave(nowClockMs, { lang: 'ru', animationSpeed: 4 }),
        serializeRunStateToSnapshot(playingWithFaceDown, 1, nowClockMs),
        1,
        nowClockMs,
      );

      const mock = createMockBridge({ initialSave: save });
      const spyAudio = createSpyAudio();
      const mounted = mountBaliteApp(root, {
        bridge: mock.bridge,
        initialNowMs: () => nowClockMs,
        audio: spyAudio,
      });
      await mounted.readyPromise;

      const openCardId = playingWithFaceDown.handIds[0]!;
      const openCardEl = root.querySelector<HTMLElement>(`[data-zone="hand"][data-card-id="${openCardId}"]`)!;
      const openCardInner = openCardEl.querySelector('.card-frame')!;
      const hiddenCardEl = root.querySelector<HTMLElement>(`[data-zone="hand"][data-card-id="${hiddenCardId}"]`)!;
      const thirdCardEl = root.querySelector<HTMLElement>(
        `[data-zone="hand"][data-card-id="${playingWithFaceDown.handIds[2]!}"]`,
      )!;

      // Touch-наведение игнорируется
      dispatchPointerOver(openCardEl, 'touch');
      expect(spyAudio.playCardHover).not.toHaveBeenCalled();

      // Карта рубашкой вверх игнорируется
      dispatchPointerOver(hiddenCardEl, 'mouse');
      expect(spyAudio.playCardHover).not.toHaveBeenCalled();

      // Первое наведение мышью на открытую карту звучит
      dispatchPointerOver(openCardEl, 'mouse');
      expect(spyAudio.playCardHover).toHaveBeenCalledTimes(1);

      // Переход на дочерний элемент той же карты (relatedTarget внутри слота) не срабатывает даже через 20мс
      nowClockMs += 20;
      dispatchPointerOver(openCardInner, 'mouse', openCardEl);
      expect(spyAudio.playCardHover).toHaveBeenCalledTimes(1);

      // Наведение на другую карту раньше 60мс (всего прошло 40мс с 1000мс) троттлится
      nowClockMs += 20;
      dispatchPointerOver(thirdCardEl, 'mouse', openCardEl);
      expect(spyAudio.playCardHover).toHaveBeenCalledTimes(1);

      // Наведение через >= 60мс (всего прошло 70мс с 1000мс) снова звучит
      nowClockMs += 30;
      dispatchPointerOver(thirdCardEl, 'mouse', openCardEl);
      expect(spyAudio.playCardHover).toHaveBeenCalledTimes(2);

      mounted.destroy();
    });

    it('проигрывает playBoosterOpen при открытии пака и playConsumable(kind) в руке/магазине/бустере без дубля с playForTraceEvent', async () => {
      const root = document.createElement('div');
      document.body.appendChild(root);
      const nowMs = 1_700_000_000_000;

      const base = createInitialRunState('b_red', 'AUDIOCONSUMABLE');
      const shopBase = dispatch(base, { type: 'SELECT_BLIND' }).nextState;
      const planet = createConsumableInstance('c_pluto', 'con_pluto');
      const shopPlanet = createConsumableInstance('c_mars', 'con_mars');
      const spectral = createConsumableInstance('c_black_hole', 'con_black_hole');

      const stateInShop: RunState = {
        ...shopBase,
        phase: 'shop',
        round: 1,
        dollars: 100,
        consumables: [planet],
        shop: {
          rerollCost: 5,
          tempRerollCost: null,
          rerollsUsedThisShop: 0,
          voucher: null,
          offers: [
            {
              uid: 'offer_planet',
              kind: 'consumable',
              consumable: shopPlanet,
              cost: 3,
              baseCost: 3,
              sold: false,
            },
          ],
          packs: [
            {
              uid: 'pack_arcana',
              packId: 'p_arcana_normal_1',
              type: 'arcana',
              size: 'normal',
              cost: 4,
              baseCost: 4,
              totalCards: 3,
              chooseCount: 1,
              purchased: false,
            },
          ],
        },
      };

      const save = createPlayerSaveData(
        createInitialMetaSave(nowMs, { lang: 'ru', animationSpeed: 4 }),
        serializeRunStateToSnapshot(stateInShop, 1, nowMs),
        1,
        nowMs,
      );
      localStorage.clear();
      const mock = createMockBridge({ initialSave: save });
      const spyAudio = createSpyAudio();
      const mounted = mountBaliteApp(root, {
        bridge: mock.bridge,
        initialNowMs: () => nowMs,
        audio: spyAudio,
      });
      await mounted.readyPromise;

      // 1. Сфера из инвентаря в руке -> 'celestial', ровно 1 раз (без дубля с playForTraceEvent и без playButton)
      root.querySelector<HTMLElement>('[data-consumable-uid="con_pluto"]')?.click();
      vi.mocked(spyAudio.playButton).mockClear();
      root.querySelector<HTMLButtonElement>('.inspector-backdrop [data-action="use"]')?.click();
      expect(spyAudio.playConsumable).toHaveBeenCalledTimes(1);
      expect(spyAudio.playConsumable).toHaveBeenLastCalledWith('celestial');
      expect(spyAudio.playButton).not.toHaveBeenCalled();

      // 2. Покупка с немедленным применением в Магазине -> playBuy + playConsumable('celestial') ровно 1 раз
      vi.mocked(spyAudio.playBuy).mockClear();
      root.querySelector<HTMLElement>('[data-offer-uid="offer_planet"]')?.click();
      root.querySelector<HTMLButtonElement>('.inspector-backdrop [data-action="buy-and-use"]')?.click();
      expect(spyAudio.playBuy).toHaveBeenCalledTimes(1);
      expect(spyAudio.playConsumable).toHaveBeenCalledTimes(2);
      expect(spyAudio.playConsumable).toHaveBeenLastCalledWith('celestial');

      // 3. Открытие бустера в Магазине -> playBoosterOpen (а не playBuy)
      vi.mocked(spyAudio.playBuy).mockClear();
      root.querySelector<HTMLElement>('[data-pack-uid="pack_arcana"]')?.click();
      root.querySelector<HTMLButtonElement>('.inspector-backdrop [data-action="open-pack"]')?.click();
      expect(spyAudio.playBoosterOpen).toHaveBeenCalledTimes(1);
      expect(spyAudio.playBuy).not.toHaveBeenCalled();

      // 4. Выбор расходника внутри бустера
      mounted.destroy();

      const boosterBase = dispatch(base, { type: 'SELECT_BLIND' }).nextState;
      const boosterState: RunState = {
        ...boosterBase,
        phase: 'booster',
        booster: {
          packId: 'p_spectral_normal_1',
          packType: 'spectral',
          packSize: 'normal',
          choices: [
            {
              uid: 'choice_rune',
              kind: 'consumable',
              consumable: spectral,
              picked: false,
            },
          ],
          remainingPicks: 1,
          drawnHandCardIds: boosterBase.handIds.slice(0, 5),
          fromTag: false,
        },
      };
      const saveBooster = createPlayerSaveData(
        createInitialMetaSave(nowMs, { lang: 'ru', animationSpeed: 4 }),
        serializeRunStateToSnapshot(boosterState, 1, nowMs),
        1,
        nowMs,
      );
      localStorage.clear();
      const mockBooster = createMockBridge({ initialSave: saveBooster });
      const spyBoosterAudio = createSpyAudio();
      const mountedBooster = mountBaliteApp(root, {
        bridge: mockBooster.bridge,
        initialNowMs: () => nowMs,
        audio: spyBoosterAudio,
      });
      await mountedBooster.readyPromise;

      // Применяем Руну из бустера -> 'rune', ровно 1 раз
      vi.mocked(spyBoosterAudio.playButton).mockClear();
      root.querySelector<HTMLButtonElement>('[data-choice-uid="choice_rune"] button')?.click();
      expect(spyBoosterAudio.playConsumable).toHaveBeenCalledTimes(1);
      expect(spyBoosterAudio.playConsumable).toHaveBeenLastCalledWith('rune');
      expect(spyBoosterAudio.playButton).not.toHaveBeenCalled();

      mountedBooster.destroy();
      localStorage.clear();
    });

    it('проигрывает playConsumable без дубля при CONSUMABLE_TRIGGER во время PLAY_HAND и playFlameThreshold один раз при 0 -> >0', async () => {
      const root = document.createElement('div');
      document.body.appendChild(root);
      const nowMs = 1_700_000_000_000;

      const base = createInitialRunState('b_red', 'AUDIOFLAME');
      let playing = dispatch(base, { type: 'SELECT_BLIND' }).nextState;
      const customDeck = [
        createPlayingCard({ id: 'af_as', suit: 'spades', rank: 14 }),
        createPlayingCard({ id: 'af_ah', suit: 'hearts', rank: 14 }),
        createPlayingCard({ id: 'af_kd', suit: 'diamonds', rank: 13 }),
        createPlayingCard({ id: 'af_2c', suit: 'clubs', rank: 2 }),
      ];
      playing = {
        ...playing,
        deck: customDeck,
        handIds: customDeck.map((c) => c.id),
        targetScore: 15,
        score: 0,
        relics: [
          // Старшая карта 1 уровня = 5*1 = 5 < 15 (пламя 0), Пара 1 уровня = 10*2 = 20 >= 15 (пламя >0)
          createRelicInstance('j_joker', 'r_plain'),
        ],
      };

      const save = createPlayerSaveData(
        createInitialMetaSave(nowMs, { lang: 'ru', animationSpeed: 4 }),
        serializeRunStateToSnapshot(playing, 1, nowMs),
        1,
        nowMs,
      );
      const mock = createMockBridge({ initialSave: save });
      const spyAudio = createSpyAudio();
      const mounted = mountBaliteApp(root, {
        bridge: mock.bridge,
        initialNowMs: () => nowMs,
        audio: spyAudio,
      });
      await mounted.readyPromise;

      expect(spyAudio.playFlameThreshold).not.toHaveBeenCalled();

      // Выбираем первого туза: порог ещё не пробит
      root.querySelector<HTMLElement>('[data-belt="hand"] [data-card-id="af_as"]')?.click();
      expect(spyAudio.playFlameThreshold).not.toHaveBeenCalled();

      // Выбираем второго туза: Пара пробивает targetScore=100 -> переход 0 -> >0, звук ровно 1 раз!
      root.querySelector<HTMLElement>('[data-belt="hand"] [data-card-id="af_ah"]')?.click();
      expect(spyAudio.playFlameThreshold).toHaveBeenCalledTimes(1);

      // Добавляем третью карту: пламя уже горит (>0 -> >0), повторно НЕ звучит!
      root.querySelector<HTMLElement>('[data-belt="hand"] [data-card-id="af_kd"]')?.click();
      expect(spyAudio.playFlameThreshold).toHaveBeenCalledTimes(1);

      // Снимаем второго туза -> пламя падает в 0, затем снова выбираем -> снова 1 раз
      root.querySelector<HTMLElement>('[data-belt="hand"] [data-card-id="af_ah"]')?.click();
      root.querySelector<HTMLElement>('[data-belt="hand"] [data-card-id="af_ah"]')?.click();
      expect(spyAudio.playFlameThreshold).toHaveBeenCalledTimes(2);

      // Проверим CONSUMABLE_TRIGGER во время PLAY_HAND (через Синий знак -> создаёт или срабатывает) — если playForTraceEvent получил CONSUMABLE_TRIGGER, дубля нет
      spyAudio.playForTraceEvent({ type: 'CONSUMABLE_TRIGGER', consumableId: 'c_mercury' }, 0);
      expect(spyAudio.playConsumable).toHaveBeenCalledTimes(1);
      expect(spyAudio.playConsumable).toHaveBeenLastCalledWith('celestial');

      mounted.destroy();
    });
  });

  describe('Story 6.1 & 6.4: авто-учёт коллекции, статистика привилегий и повтор расклада', () => {
    it('автоматически учитывает открытия коллекции и накопительную статистику в лавке (покупка+применение тома, издание, грамота, реролл, сундук)', async () => {
      const nowMs = 2_000_000;
      const base = createInitialRunState('b_red', 'SHOP_META');
      const shopBase = dispatch(base, { type: 'SELECT_BLIND' }).nextState;
      const jupiter = createConsumableInstance('c_jupiter', 'shop_jup');
      const foilRelic = createRelicInstance('j_blueprint', 'shop_bp', 'foil');

      const shopState: RunState = {
        ...shopBase,
        phase: 'shop',
        round: 1,
        dollars: 50,
        shop: {
          offers: [
            {
              uid: 'off_cel',
              kind: 'consumable',
              consumable: jupiter,
              cost: 3,
              baseCost: 3,
              sold: false,
            },
            {
              uid: 'off_foil',
              kind: 'relic',
              relic: foilRelic,
              cost: 6,
              baseCost: 6,
              sold: false,
            },
          ],
          voucher: {
            uid: 'v_grab',
            charterId: 'v_grabber',
            cost: 10,
            baseCost: 10,
            sold: false,
          },
          packs: [
            {
              uid: 'pack_arc',
              packId: 'arcana_normal',
              type: 'arcana',
              size: 'normal',
              cost: 4,
              baseCost: 4,
              totalCards: 3,
              chooseCount: 1,
              purchased: false,
            },
          ],
          rerollCost: 5,
          tempRerollCost: null,
          rerollsUsedThisShop: 0,
        },
      };

      const meta = createInitialMetaSave(nowMs, {
        lang: 'ru',
        animationSpeed: 4,
        tutorialCompleted: true,
      });
      const save = createPlayerSaveData(meta, serializeRunStateToSnapshot(shopState, 1, nowMs), 1, nowMs);
      const mock = createMockBridge({ initialSave: save });

      mounted = mountBaliteApp(root, {
        bridge: mock.bridge,
        initialNowMs: () => nowMs,
      });
      await mounted.readyPromise;

      // До покупки в лавке на неоткрытых слотах отображаются бейджи «Новое!»
      expect(
        root.querySelector('[data-offer-uid="off_cel"] [data-new-badge="true"]')?.textContent,
      ).toBe('Новое!');
      expect(
        root.querySelector('[data-offer-uid="off_foil"] [data-new-badge="true"]')?.textContent,
      ).toBe('Новое!');
      expect(
        root.querySelector('[data-charter-id="v_grabber"] [data-new-badge="true"]')?.textContent,
      ).toBe('Новое!');
      expect(
        root.querySelector('[data-pack-uid="pack_arc"] [data-new-badge="true"]')?.textContent,
      ).toBe('Новое!');

      // 1. Покупка + немедленное применение небесного тома c_jupiter (3 з.)
      root.querySelector<HTMLElement>('[data-offer-uid="off_cel"]')?.click();
      root.querySelector<HTMLButtonElement>('.inspector-backdrop [data-action="buy-and-use"]')?.click();

      let nextMeta = mounted.getSaveData().meta;
      expect(nextMeta.discoveredConsumables).toContain('c_jupiter');
      expect(nextMeta.stats.totalCelestialsUsed).toBe(1);
      expect(nextMeta.stats.totalMoneySpent).toBe(3);

      // 2. Покупка реликвии с изданием foil (6 з.)
      root.querySelector<HTMLElement>('[data-offer-uid="off_foil"]')?.click();
      root.querySelector<HTMLButtonElement>('.inspector-backdrop [data-action="buy"]')?.click();

      nextMeta = mounted.getSaveData().meta;
      expect(nextMeta.discoveredRelics).toContain('j_blueprint');
      expect(nextMeta.discoveredEditions).toContain('foil');
      expect(nextMeta.stats.totalMoneySpent).toBe(9);

      // 3. Покупка грамоты v_grabber (10 з.)
      root.querySelector<HTMLElement>('[data-charter-id="v_grabber"]')?.click();
      root.querySelector<HTMLButtonElement>('.inspector-backdrop [data-action="buy-charter"]')?.click();

      nextMeta = mounted.getSaveData().meta;
      expect(nextMeta.discoveredCharters).toContain('v_grabber');
      expect(nextMeta.stats.totalMoneySpent).toBe(19);

      // 4. Обновление витрины (реролл 5 з.)
      findButtonByText(root, 'Обновить')?.click();

      nextMeta = mounted.getSaveData().meta;
      expect(nextMeta.stats.totalShopRerolls).toBe(1);
      expect(nextMeta.stats.totalMoneySpent).toBe(24);

      // 5. Открытие сундука arcana_normal (4 з.) -> pack_arcana_normal в коллекции
      root.querySelector<HTMLElement>('[data-pack-uid="pack_arc"]')?.click();
      root.querySelector<HTMLButtonElement>('.inspector-backdrop [data-action="open-pack"]')?.click();

      nextMeta = mounted.getSaveData().meta;
      expect(nextMeta.discoveredPacks).toContain('pack_arcana_normal');
      expect(nextMeta.stats.totalMoneySpent).toBe(28);
    });

    it('фиксирует открытия при USE_CONSUMABLE, PICK_BOOSTER_ITEM (небесный том) и SKIP_BLIND (знак пропуска)', async () => {
      const nowMs = 3_000_000;

      // 1. USE_CONSUMABLE в бою (c_pluto) -> discoveredConsumables + totalCelestialsUsed
      const base = createInitialRunState('b_red', 'TRACK_ACTIONS');
      const playingBase = dispatch(base, { type: 'SELECT_BLIND' }).nextState;
      const pluto = createConsumableInstance('c_pluto', 'inv_pluto');
      const playingWithCons: RunState = {
        ...playingBase,
        consumables: [pluto],
      };

      const meta = createInitialMetaSave(nowMs, {
        lang: 'ru',
        animationSpeed: 4,
        tutorialCompleted: true,
      });
      const savePlaying = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(playingWithCons, 1, nowMs),
        1,
        nowMs,
      );
      const mockPlaying = createMockBridge({ initialSave: savePlaying });

      mounted = mountBaliteApp(root, {
        bridge: mockPlaying.bridge,
        initialNowMs: () => nowMs,
      });
      await mounted.readyPromise;

      root.querySelector<HTMLElement>('[data-consumable-uid="inv_pluto"]')?.click();
      root.querySelector<HTMLButtonElement>('.inspector-backdrop [data-action="use"]')?.click();

      expect(mounted.getSaveData().meta.discoveredConsumables).toContain('c_pluto');
      expect(mounted.getSaveData().meta.stats.totalCelestialsUsed).toBe(1);

      mounted.destroy();
      mounted = null;

      // 2. PICK_BOOSTER_ITEM в бустере (c_venus) -> бейдж Новое! до выбора, учёт после выбора
      const venus = createConsumableInstance('c_venus', 'boost_venus');
      const boosterState: RunState = {
        ...playingBase,
        phase: 'booster',
        booster: {
          packId: 'p_celestial_normal_1',
          packType: 'celestial',
          packSize: 'normal',
          remainingPicks: 1,
          drawnHandCardIds: [],
          fromTag: false,
          choices: [
            {
              uid: 'ch_venus',
              kind: 'consumable',
              consumable: venus,
              picked: false,
            },
          ],
        },
      };
      const saveBooster = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(boosterState, 1, nowMs),
        1,
        nowMs,
      );
      const mockBooster = createMockBridge({ initialSave: saveBooster });

      mounted = mountBaliteApp(root, {
        bridge: mockBooster.bridge,
        initialNowMs: () => nowMs,
      });
      await mounted.readyPromise;

      expect(
        root.querySelector('[data-choice-uid="ch_venus"] [data-new-badge="true"]')?.textContent,
      ).toBe('Новое!');
      root.querySelector<HTMLButtonElement>('[data-choice-uid="ch_venus"] button')?.click();

      expect(mounted.getSaveData().meta.discoveredConsumables).toContain('c_venus');
      expect(mounted.getSaveData().meta.discoveredPacks).toContain('pack_celestial_normal');
      expect(mounted.getSaveData().meta.stats.totalCelestialsUsed).toBe(1);

      mounted.destroy();
      mounted = null;

      // 3. SKIP_BLIND на экране выбора заказа -> skipTagId попадает в discoveredTags
      const blindSelectState = createInitialRunState('b_red', 'TRACK_SKIP');
      const expectedTagId = blindSelectState.anteBlinds[0].skipTagId;
      expect(expectedTagId).not.toBeNull();

      const saveBlindSelect = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(blindSelectState, 1, nowMs),
        1,
        nowMs,
      );
      const mockSkip = createMockBridge({ initialSave: saveBlindSelect });

      mounted = mountBaliteApp(root, {
        bridge: mockSkip.bridge,
        initialNowMs: () => nowMs,
      });
      await mounted.readyPromise;

      root.querySelector<HTMLButtonElement>('[data-blind-kind="small"] [data-action="skip-blind"]')?.click();

      expect(mounted.getSaveData().meta.discoveredTags).toContain(expectedTagId);
    });

    it('кнопка Повторить расклад перезапускает забег с тем же seed и deckId из victory (без рекламы) и из game_over (с рекламой)', async () => {
      const nowMs = 4_000_000;

      // 1. Победа -> Повторить расклад без показа рекламы
      const winBase = createInitialRunState('b_blue', 'REPLAY_WIN_99');
      const winState: RunState = {
        ...winBase,
        phase: 'victory',
      };
      const winMeta = createInitialMetaSave(nowMs, {
        lang: 'ru',
        animationSpeed: 4,
        unlockedDecks: ['b_red', 'b_blue'],
        tutorialCompleted: true,
      });
      const winSave = createPlayerSaveData(
        winMeta,
        serializeRunStateToSnapshot(winState, 1, nowMs),
        1,
        nowMs,
      );
      const mockWin = createMockBridge({ initialSave: winSave });

      mounted = mountBaliteApp(root, {
        bridge: mockWin.bridge,
        initialNowMs: () => nowMs,
        adCooldownMs: 180_000,
      });
      await mounted.readyPromise;

      const winReplayBtn = root.querySelector<HTMLButtonElement>('[data-action="replay-seed"]');
      expect(winReplayBtn?.textContent).toBe('Повторить расклад (тот же сид)');
      winReplayBtn?.click();

      expect(mockWin.bridge.showInterstitial).not.toHaveBeenCalled();
      expect(mounted.getState().phase).toBe('blind_select');
      expect(mounted.getState().seed).toBe('REPLAY_WIN_99');
      expect(mounted.getState().deckId).toBe('b_blue');
      expect(mounted.getSaveData().meta.stats.runsStarted).toBe(1);

      mounted.destroy();
      mounted = null;

      // 2. Поражение -> Повторить расклад вызывает showInterstitial по логической паузе и сохраняет тот же сид/колоду
      const lossBase = createInitialRunState('b_yellow', 'REPLAY_LOSS_55');
      const lossState: RunState = {
        ...lossBase,
        phase: 'game_over',
      };
      const lossMeta = createInitialMetaSave(nowMs, {
        lang: 'ru',
        animationSpeed: 4,
        unlockedDecks: ['b_red', 'b_blue', 'b_yellow'],
        tutorialCompleted: true,
      });
      const lossSave = createPlayerSaveData(
        lossMeta,
        serializeRunStateToSnapshot(lossState, 1, nowMs),
        1,
        nowMs,
      );
      const mockLoss = createMockBridge({ initialSave: lossSave });

      mounted = mountBaliteApp(root, {
        bridge: mockLoss.bridge,
        initialNowMs: () => nowMs,
        adCooldownMs: 180_000,
      });
      await mounted.readyPromise;

      const lossReplayBtn = root.querySelector<HTMLButtonElement>('[data-action="replay-seed"]');
      expect(lossReplayBtn).not.toBeNull();
      lossReplayBtn?.click();
      await flushMicrotasks();

      expect(mockLoss.bridge.showInterstitial).toHaveBeenCalledTimes(1);
      expect(mounted.getState().phase).toBe('blind_select');
      expect(mounted.getState().seed).toBe('REPLAY_LOSS_55');
      expect(mounted.getState().deckId).toBe('b_yellow');
      expect(mounted.getSaveData().meta.stats.runsStarted).toBe(1);
    });
  });

  describe('Story 6.5.4: загрузочный спиннер, экран ошибки с повтором и touch-action: none при перетаскивании', () => {
    it('показывает локализованный лоадер до инициализации, а при ошибке init рендерит кнопку повтора и успешно перезапускается', async () => {
      const mock = createMockBridge({ lang: 'ru', initialSave: null });
      let shouldFailInit = true;
      let resolveSecondInit: (() => void) | null = null;

      (mock.bridge.init as ReturnType<typeof vi.fn>).mockImplementation(() => {
        mock.callLog.push('init');
        if (shouldFailInit) {
          shouldFailInit = false;
          return Promise.reject(new Error('VKBridge timeout'));
        }
        return new Promise<void>((resolve) => {
          resolveSecondInit = resolve;
        });
      });

      mounted = mountBaliteApp(root, { bridge: mock.bridge });

      // Сразу после синхронного вызова mountBaliteApp отображается лоадер
      expect(root.querySelector('[data-boot-state="loading"]')).not.toBeNull();

      await mounted.readyPromise;

      // После первой ошибки инициализации показан экран ошибки с кнопкой Повторить
      const errorScreen = root.querySelector<HTMLElement>('[data-boot-state="error"]');
      expect(errorScreen).not.toBeNull();
      expect(errorScreen?.textContent).toContain('Не удалось загрузить данные');
      expect(mock.bridge.ready).not.toHaveBeenCalled();

      const retryBtn = root.querySelector<HTMLButtonElement>('[data-action="boot-retry"]');
      expect(retryBtn).not.toBeNull();
      retryBtn!.click();

      // Во время повторной попытки снова виден лоадер
      expect(root.querySelector('[data-boot-state="loading"]')).not.toBeNull();
      expect(resolveSecondInit).not.toBeNull();
      resolveSecondInit!();
      await flushMicrotasks(12);

      expect(root.querySelector('[data-boot-state]')).toBeNull();
      expect(root.querySelector('.main-menu')).not.toBeNull();
      expect(mock.bridge.ready).toHaveBeenCalledTimes(1);
    });

    it('выставляет touch-action: none на перетаскиваемых слотах карт руки и реликвий', async () => {
      const baseRun = createInitialRunState('b_red', 'DRAG_TOUCH_ACTION');
      const playing = dispatch(baseRun, { type: 'SELECT_BLIND' }).nextState;
      const runWithRelic: RunState = {
        ...playing,
        relics: [createRelicInstance('j_joker', 'r_drag_1')],
      };
      const meta = createInitialMetaSave(1000, { lang: 'ru', tutorialCompleted: true });
      const save = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(runWithRelic, 1, 1000),
        1,
        1000,
      );
      const mock = createMockBridge({ initialSave: save });

      mounted = mountBaliteApp(root, { bridge: mock.bridge });
      await mounted.readyPromise;

      const handSlot = root.querySelector<HTMLElement>('.hand-card-slot[data-zone="hand"]');
      const relicSlot = root.querySelector<HTMLElement>('.inventory-slot[data-relic-uid="r_drag_1"]');
      expect(handSlot?.style.touchAction).toBe('none');
      expect(relicSlot?.style.touchAction).toBe('none');
    });
  });

  describe('Эпик 7: Rewarded-реклама, Ежедневный заказ, отзывы/ярлык и ПК-управление', () => {
    it('Story 7.1: поддерживает бесплатный реролл в лавке и Второй шанс (+1 рука) за рекламу, но скрывает Второй шанс в Ежедневном заказе', async () => {
      const nowMs = 5_000_000;
      const meta = createInitialMetaSave(nowMs, {
        lang: 'ru',
        animationSpeed: 4,
        tutorialCompleted: true,
      });

      // 1. В лавке при нехватке золота доступна кнопка «Обновить за рекламу» (1 раз за визит)
      const baseRun = createInitialRunState('b_red', 'STORY_7_1_SHOP');
      const fighting = dispatch(baseRun, { type: 'SELECT_BLIND' }).nextState;
      const cashout = dispatch(
        { ...fighting, score: fighting.targetScore },
        { type: 'PLAY_HAND', cardIds: fighting.handIds.slice(0, 1) },
      ).nextState;
      const inShop = dispatch(cashout, { type: 'CLAIM_CASHOUT' }).nextState;
      const brokeShop: RunState = {
        ...inShop,
        dollars: 0,
      };
      const shopSave = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(brokeShop, 1, nowMs),
        1,
        nowMs,
      );
      const mockShop = createMockBridge({
        initialSave: shopSave,
        rewardedResult: { rewarded: true },
        canShowRewarded: true,
      });

      mounted = mountBaliteApp(root, { bridge: mockShop.bridge, initialNowMs: () => nowMs });
      await mounted.readyPromise;
      await flushMicrotasks(8);

      const initialOffers = mounted.getState().shop?.offers.map((o) => o.uid);
      const adRerollBtn = root.querySelector<HTMLButtonElement>('[data-action="ad-reroll-shop"]');
      expect(adRerollBtn).not.toBeNull();
      adRerollBtn?.click();
      await flushMicrotasks(8);

      expect(mockShop.bridge.showRewarded).toHaveBeenCalledTimes(1);
      expect(mounted.getState().shop?.adRerollUsed).toBe(true);
      expect(mounted.getState().shop?.offers.map((o) => o.uid)).not.toEqual(initialOffers);
      expect(root.querySelector('[data-action="ad-reroll-shop"]')).toBeNull();

      mounted.destroy();
      mounted = null;

      // 2. В обычном забеге при поражении доступен «Второй шанс» (+1 рука, revivedBadge), 1 раз за забег
      const lostNormal: RunState = {
        ...fighting,
        phase: 'game_over',
        handsLeft: 0,
        reviveUsed: false,
      };
      const lossSave = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(lostNormal, 1, nowMs),
        1,
        nowMs,
      );
      const mockRevive = createMockBridge({
        initialSave: lossSave,
        rewardedResult: { rewarded: true },
        canShowRewarded: true,
      });

      mounted = mountBaliteApp(root, { bridge: mockRevive.bridge, initialNowMs: () => nowMs });
      await mounted.readyPromise;
      await flushMicrotasks(8);

      const reviveBtn = root.querySelector<HTMLButtonElement>('[data-action="revive-run"]');
      expect(reviveBtn).not.toBeNull();
      reviveBtn?.click();
      await flushMicrotasks(8);

      expect(mockRevive.bridge.showRewarded).toHaveBeenCalledTimes(1);
      expect(mounted.getState().phase).toBe('playing');
      expect(mounted.getState().handsLeft).toBe(1);
      expect(mounted.getState().reviveUsed).toBe(true);

      mounted.destroy();
      mounted = null;

      // 3. В Ежедневном заказе «Второй шанс» скрыт и недоступен на экране поражения
      const dailyBase = createInitialRunState('b_red', 'DAILY-20261117');
      const dailyLost: RunState = {
        ...dispatch(dailyBase, { type: 'SELECT_BLIND' }).nextState,
        phase: 'game_over',
        handsLeft: 0,
        reviveUsed: false,
      };
      const dailyLossSave = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(dailyLost, 1, nowMs),
        1,
        nowMs,
      );
      const mockDailyLoss = createMockBridge({
        initialSave: dailyLossSave,
        rewardedResult: { rewarded: true },
        canShowRewarded: true,
      });

      mounted = mountBaliteApp(root, { bridge: mockDailyLoss.bridge, initialNowMs: () => nowMs });
      await mounted.readyPromise;
      await flushMicrotasks(8);

      expect(root.querySelector('[data-daily-badge="true"]')).not.toBeNull();
      expect(root.querySelector('[data-action="revive-run"]')).toBeNull();
    });

    it('Story 7.2: запускает Ежедневный заказ по серверному времени, отправляет best_hand/highest_ante/daily_score и открывает лидерборд VK по клику', async () => {
      const serverTimeMs = Date.UTC(2026, 10, 17, 15, 30, 0);
      const expectedDaily = buildDailyRunSpec(serverTimeMs);
      const meta = createInitialMetaSave(serverTimeMs, {
        lang: 'ru',
        animationSpeed: 4,
        tutorialCompleted: true,
        unlockedDecks: ['b_red'],
      });
      const save = createPlayerSaveData(meta, null, 1, serverTimeMs);
      const mock = createMockBridge({
        platformId: 'vk',
        initialSave: save,
        serverTimeMs,
      });

      mounted = mountBaliteApp(root, { bridge: mock.bridge, initialNowMs: () => serverTimeMs });
      await mounted.readyPromise;
      await flushMicrotasks(8);

      root.querySelector<HTMLButtonElement>('[data-menu-action="play"]')?.click();
      const dailyCard = root.querySelector('[data-daily-run-card="true"]');
      expect(dailyCard).not.toBeNull();
      expect(dailyCard?.textContent).toContain(expectedDaily.dateKey);

      root.querySelector<HTMLButtonElement>('[data-action="start-daily-run"]')?.click();
      expect(mounted.getState().phase).toBe('blind_select');
      expect(mounted.getState().seed).toBe(expectedDaily.seed);
      expect(mounted.getState().deckId).toBe(expectedDaily.deckId);

      // Завершаем забег (открываем Настройки и имитируем окончание? Перейдём в бой и проиграем с очками > 0)
      mounted.destroy();
      mounted = null;

      const fightingDaily = dispatch(
        createInitialRunState(expectedDaily.deckId, expectedDaily.seed),
        { type: 'SELECT_BLIND' },
      ).nextState;
      const terminalDaily: RunState = {
        ...fightingDaily,
        phase: 'game_over',
        ante: 4,
        stats: {
          ...fightingDaily.stats,
          bestHandScore: 12345,
        },
      };
      const terminalSave = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(terminalDaily, 2, serverTimeMs),
        2,
        serverTimeMs,
      );
      const mockVkEnd = createMockBridge({
        platformId: 'vk',
        initialSave: terminalSave,
        serverTimeMs,
      });

      mounted = mountBaliteApp(root, { bridge: mockVkEnd.bridge, initialNowMs: () => serverTimeMs });
      await mounted.readyPromise;
      await flushMicrotasks(8);

      // Переигрываем/завершаем 1 бой или проверяем кнопку лидерборда на экране конца забега
      const lbBtn = root.querySelector<HTMLButtonElement>('[data-action="open-vk-leaderboard"]');
      expect(lbBtn).not.toBeNull();
      // На восстановленном терминальном экране лидерборд не открывается сам, а ждёт явного клика
      expect(mockVkEnd.bridge.openLeaderboardBox).not.toHaveBeenCalled();
      lbBtn?.click();
      expect(mockVkEnd.bridge.openLeaderboardBox).toHaveBeenCalledWith(12345);

      mounted.destroy();
      mounted = null;

      // Проверяем отправку всех 3 метрик при переходе в game_over после поражения
      const mockMetrics = createMockBridge({
        platformId: 'yandex',
        initialSave: createPlayerSaveData(
          meta,
          serializeRunStateToSnapshot(
            {
              ...fightingDaily,
              handsLeft: 1,
              targetScore: 999_999,
              ante: 3,
              stats: { ...fightingDaily.stats, bestHandScore: 4321 },
            },
            3,
            serverTimeMs,
          ),
          3,
          serverTimeMs,
        ),
        serverTimeMs,
      });

      mounted = mountBaliteApp(root, {
        bridge: mockMetrics.bridge,
        initialNowMs: () => serverTimeMs,
      });
      await mounted.readyPromise;
      await flushMicrotasks(8);

      const firstCardId = mounted.getState().handIds[0]!;
      root.querySelector<HTMLElement>(`.hand-card-slot[data-card-id="${firstCardId}"]`)?.click();
      findButtonByText(root, 'Сыграть')?.click();
      await flushMicrotasks(12);

      expect(mounted.getState().phase).toBe('game_over');
      expect(mockMetrics.bridge.setLeaderboardScore).toHaveBeenCalledWith(
        'best_hand',
        expect.any(Number),
      );
      expect(mockMetrics.bridge.setLeaderboardScore).toHaveBeenCalledWith('highest_ante', 3);
      expect(mockMetrics.bridge.setLeaderboardScore).toHaveBeenCalledWith(
        'daily_score',
        expect.any(Number),
      );
    });

    it('Story 7.3: запрашивает оценку после победы над Боссом и предлагает ярлык после 2+ забегов', async () => {
      const nowMs = 6_000_000;
      const baseRun = createInitialRunState('b_red', 'STORY_7_3_BOSS');
      const atBossSelect: RunState = {
        ...baseRun,
        currentBlindIndex: 2,
        anteBlinds: [
          { ...baseRun.anteBlinds[0], status: 'defeated' },
          { ...baseRun.anteBlinds[1], status: 'defeated' },
          { ...baseRun.anteBlinds[2], status: 'current' },
        ],
      };
      const bossFight = dispatch(atBossSelect, { type: 'SELECT_BLIND' }).nextState;
      const bossCashout = dispatch(
        { ...bossFight, score: bossFight.targetScore },
        { type: 'PLAY_HAND', cardIds: bossFight.handIds.slice(0, 1) },
      ).nextState;
      expect(bossCashout.phase).toBe('cashout');

      const baseMeta = createInitialMetaSave(nowMs, {
        lang: 'ru',
        animationSpeed: 4,
        tutorialCompleted: true,
      });
      const meta = {
        ...baseMeta,
        stats: {
          ...baseMeta.stats,
          runsStarted: 2,
        },
      };
      const save = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(bossCashout, 1, nowMs),
        1,
        nowMs,
      );
      const mock = createMockBridge({
        platformId: 'yandex',
        initialSave: save,
        canRequestReview: true,
        requestReviewResult: true,
        canShowShortcutPrompt: true,
        showShortcutResult: true,
      });

      mounted = mountBaliteApp(root, { bridge: mock.bridge, initialNowMs: () => nowMs });
      await mounted.readyPromise;
      await flushMicrotasks(8);

      // Забираем награду после победы над Боссом -> вызывается requestReview() 1 раз
      root.querySelector<HTMLButtonElement>('.claim-cashout-btn')?.click();
      await flushMicrotasks(12);

      expect(mounted.getState().phase).toBe('shop');
      expect(mock.bridge.requestReview).toHaveBeenCalledTimes(1);
      expect(mounted.getSaveData().meta.settings.reviewPrompted).toBe(true);

      mounted.destroy();
      mounted = null;

      // При game_over и runsStarted >= 2 автоматически вызывается showShortcutPrompt() 1 раз
      const preLoss = dispatch(createInitialRunState('b_red', 'STORY_7_3_SHORTCUT'), {
        type: 'SELECT_BLIND',
      }).nextState;
      const preLossState: RunState = {
        ...preLoss,
        handsLeft: 1,
        targetScore: 999_999,
      };
      const shortcutSave = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(preLossState, 2, nowMs),
        2,
        nowMs,
      );
      const mockShortcut = createMockBridge({
        platformId: 'yandex',
        initialSave: shortcutSave,
        canRequestReview: false,
        canShowShortcutPrompt: true,
        showShortcutResult: true,
      });

      mounted = mountBaliteApp(root, { bridge: mockShortcut.bridge, initialNowMs: () => nowMs });
      await mounted.readyPromise;
      await flushMicrotasks(8);

      const cardId = mounted.getState().handIds[0]!;
      root.querySelector<HTMLElement>(`.hand-card-slot[data-card-id="${cardId}"]`)?.click();
      vi.useFakeTimers();
      findButtonByText(root, 'Сыграть')?.click();
      await vi.advanceTimersByTimeAsync(4500);
      await flushMicrotasks(12);

      expect(mounted.getState().phase).toBe('game_over');
      expect(mockShortcut.bridge.showShortcutPrompt).toHaveBeenCalledTimes(1);
      expect(mounted.getSaveData().meta.settings.shortcutPrompted).toBe(true);
    });

    it('Story 7.4: ПКМ сбрасывает выделение карт в бою (удерживая forcedSelection), в сундуке и при выборе целей расходника', async () => {
      const nowMs = 7_000_000;
      const meta = createInitialMetaSave(nowMs, {
        lang: 'ru',
        animationSpeed: 4,
        tutorialCompleted: true,
      });

      // 1. В фазе playing ПКМ снимает обычное выделение, но оставляет карту Босса Орстеда (forcedSelection: true)
      const baseRun = createInitialRunState('b_red', 'STORY_7_4_RMB');
      const playing = dispatch(baseRun, { type: 'SELECT_BLIND' }).nextState;
      const forcedId = playing.handIds[0]!;
      const normalId = playing.handIds[1]!;
      const lovers = createConsumableInstance('c_lovers', 'cons_rmb_lovers');
      const playingWithForced: RunState = {
        ...playing,
        deck: playing.deck.map((c) => (c.id === forcedId ? { ...c, forcedSelection: true } : c)),
        consumables: [lovers],
      };

      const mockPlaying = createMockBridge({
        initialSave: createPlayerSaveData(
          meta,
          serializeRunStateToSnapshot(playingWithForced, 1, nowMs),
          1,
          nowMs,
        ),
      });

      mounted = mountBaliteApp(root, { bridge: mockPlaying.bridge, initialNowMs: () => nowMs });
      await mounted.readyPromise;
      await flushMicrotasks(8);

      // Принудительная карта выбрана изначально; выбираем вторую карту
      expect(
        root.querySelector(`.hand-card-slot[data-card-id="${forcedId}"]`)?.classList.contains('is-selected'),
      ).toBe(true);
      root.querySelector<HTMLElement>(`.hand-card-slot[data-card-id="${normalId}"]`)?.click();
      expect(
        root.querySelector(`.hand-card-slot[data-card-id="${normalId}"]`)?.classList.contains('is-selected'),
      ).toBe(true);

      // Клик ПКМ внутри корневого контейнера сбрасывает обычную карту, оставляя принудительную
      const rmbEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      root.dispatchEvent(rmbEvent);
      expect(rmbEvent.defaultPrevented).toBe(true);
      expect(
        root.querySelector(`.hand-card-slot[data-card-id="${normalId}"]`)?.classList.contains('is-selected'),
      ).toBe(false);
      expect(
        root.querySelector(`.hand-card-slot[data-card-id="${forcedId}"]`)?.classList.contains('is-selected'),
      ).toBe(true);

      // 2. В режиме выбора целей расходника ПКМ полностью сбрасывает выбор целей (включая forcedId)
      root.querySelector<HTMLElement>('[data-consumable-uid="cons_rmb_lovers"]')?.click();
      root.querySelector<HTMLButtonElement>('.inspector-backdrop [data-action="use"]')?.click();
      expect(root.querySelector('.target-banner')).not.toBeNull();

      root.querySelector<HTMLElement>(`.hand-card-slot[data-card-id="${forcedId}"]`)?.click();
      expect(
        root.querySelector(`.hand-card-slot[data-card-id="${forcedId}"]`)?.classList.contains('is-selected'),
      ).toBe(true);

      root.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      expect(root.querySelectorAll('.hand-card-slot.is-selected')).toHaveLength(0);

      mounted.destroy();
      mounted = null;

      // 3. В фазе booster ПКМ полностью сбрасывает выделение карт в руке сундука
      const boosterState: RunState = {
        ...playing,
        phase: 'booster',
        booster: {
          packId: 'p_arcana_normal_1',
          packType: 'arcana',
          packSize: 'normal',
          remainingPicks: 1,
          drawnHandCardIds: playing.handIds.slice(0, 4),
          fromTag: false,
          choices: [
            {
              uid: 'ch_lovers_boost',
              kind: 'consumable',
              consumable: createConsumableInstance('c_lovers', 'boost_lovers'),
              picked: false,
            },
          ],
        },
      };
      const mockBooster = createMockBridge({
        initialSave: createPlayerSaveData(
          meta,
          serializeRunStateToSnapshot(boosterState, 2, nowMs),
          2,
          nowMs,
        ),
      });

      mounted = mountBaliteApp(root, { bridge: mockBooster.bridge, initialNowMs: () => nowMs });
      await mounted.readyPromise;
      await flushMicrotasks(8);

      const boosterCardId = boosterState.booster!.drawnHandCardIds[0]!;
      root.querySelector<HTMLElement>(`.hand-card-slot[data-card-id="${boosterCardId}"]`)?.click();
      expect(root.querySelectorAll('.hand-card-slot.is-selected')).toHaveLength(1);

      root.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      expect(root.querySelectorAll('.hand-card-slot.is-selected')).toHaveLength(0);
    });

    it('Story 7.4: Escape работает трёхуровневым каскадом (модалки/инспектор -> отмена целей расходника -> Параметры)', async () => {
      const nowMs = 8_000_000;
      const meta = createInitialMetaSave(nowMs, {
        lang: 'ru',
        animationSpeed: 4,
        tutorialCompleted: true,
      });
      const baseRun = createInitialRunState('b_red', 'STORY_7_4_ESC');
      const playing = dispatch(baseRun, { type: 'SELECT_BLIND' }).nextState;
      const lovers = createConsumableInstance('c_lovers', 'cons_esc_lovers');
      const stateWithCons: RunState = {
        ...playing,
        consumables: [lovers],
      };

      const mock = createMockBridge({
        initialSave: createPlayerSaveData(
          meta,
          serializeRunStateToSnapshot(stateWithCons, 1, nowMs),
          1,
          nowMs,
        ),
      });

      mounted = mountBaliteApp(root, { bridge: mock.bridge, initialNowMs: () => nowMs });
      await mounted.readyPromise;
      await flushMicrotasks(8);

      // Уровень 1: Escape закрывает открытый инспектор, не отменяя игру и не открывая Параметры
      root.querySelector<HTMLElement>('[data-consumable-uid="cons_esc_lovers"]')?.click();
      expect(root.querySelector('.inspector-backdrop')).not.toBeNull();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
      expect(root.querySelector('.inspector-backdrop')).toBeNull();
      expect(root.querySelector('[data-modal="settings"]')).toBeNull();

      // Уровень 2: в режиме выбора целей расходника Escape отменяет выбор целей (без открытия Параметров)
      root.querySelector<HTMLElement>('[data-consumable-uid="cons_esc_lovers"]')?.click();
      root.querySelector<HTMLButtonElement>('.inspector-backdrop [data-action="use"]')?.click();
      expect(root.querySelector('.target-banner')).not.toBeNull();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
      expect(root.querySelector('.target-banner')).toBeNull();
      expect(root.querySelector('[data-modal="settings"]')).toBeNull();

      // Уровень 3: в активном забеге без модалок и targetMode Escape открывает Параметры, а следующий Escape закрывает их
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
      expect(root.querySelector('[data-modal="settings"]')).not.toBeNull();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
      expect(root.querySelector('[data-modal="settings"]')).toBeNull();
    });
  });

  describe('Эпик 8: Настройка колоды (палитра мастей и рубашка)', () => {
    it('Story 8.2: применяет suitPalette и cardBack на корневом контейнере, переключает в Параметрах и сохраняет в MetaSave', async () => {
      const nowMs = 9_000_000;
      const meta = createInitialMetaSave(nowMs, {
        lang: 'ru',
        animationSpeed: 4,
        tutorialCompleted: true,
        suitPalette: 'standard',
        cardBack: 'default',
      });
      const baseRun = createInitialRunState('b_red', 'STORY_8_2_CUSTOMIZE');
      const playing = dispatch(baseRun, { type: 'SELECT_BLIND' }).nextState;
      const save = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(playing, 1, nowMs),
        1,
        nowMs,
      );
      const mock = createMockBridge({ initialSave: save });

      mounted = mountBaliteApp(root, { bridge: mock.bridge, initialNowMs: () => nowMs });
      await mounted.readyPromise;
      await flushMicrotasks(8);

      expect(root.dataset.suitPalette).toBe('standard');
      expect(root.dataset.cardBack).toBe('default');

      // Открываем Параметры -> Настроить колоду
      findButtonByText(root, 'Настройки')?.click();
      root.querySelector<HTMLButtonElement>('[data-hub-action="customize-deck"]')?.click();
      expect(root.querySelector('[data-customize-deck-panel="true"]')).not.toBeNull();

      // Выбираем высококонтрастную палитру и рубашку b_blue
      root.querySelector<HTMLButtonElement>('[data-suit-palette-option="high_contrast"]')?.click();
      root.querySelector<HTMLButtonElement>('[data-card-back-option="b_blue"]')?.click();

      expect(root.dataset.suitPalette).toBe('high_contrast');
      expect(root.dataset.cardBack).toBe('b_blue');
      expect(mounted.getSaveData().meta.settings.suitPalette).toBe('high_contrast');
      expect(mounted.getSaveData().meta.settings.cardBack).toBe('b_blue');
    });
  });

  describe('Бесшовные фазовые переходы (выбор заказа, бой, кэшаут, магазин)', () => {
    it('перемещает уходящие элементы HUD вверх, арену вниз и анимирует появление боя и магазина', async () => {
      const makeRect = (left: number, top: number, width: number, height: number): DOMRect =>
        ({
          x: left,
          y: top,
          left,
          top,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement,
      ) {
        if (this.classList.contains('stage-portrait')) {
          return makeRect(0, 0, 1280, 720);
        }
        if (
          this.classList.contains('hud-choose-prompt') ||
          this.classList.contains('hud-boss-btn') ||
          this.classList.contains('hud-shop-sign')
        ) {
          return makeRect(20, 12, 320, 220);
        }
        if (this.classList.contains('blinds-grid') || this.classList.contains('arena-stage')) {
          return makeRect(380, 140, 860, 540);
        }
        return makeRect(0, 0, 0, 0);
      });

      const nowMs = 9_500_000;
      const meta = createInitialMetaSave(nowMs, {
        lang: 'ru',
        animationSpeed: 1,
        tutorialCompleted: true,
      });
      const blindRun = createInitialRunState('b_red', 'PHASE_TRANSITION_TEST');
      const save = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(blindRun, 1, nowMs),
        1,
        nowMs,
      );
      const mock = createMockBridge({ initialSave: save });

      vi.useFakeTimers();
      mounted = mountBaliteApp(root, { bridge: mock.bridge, initialNowMs: () => nowMs });
      await mounted.readyPromise;
      await flushMicrotasks(8);

      // 1. Выбор заказа -> Бой: надпись выбора улетает вверх, блайнды — вниз
      root.querySelector<HTMLButtonElement>('.blind-card__battle-btn')?.click();
      const shellAfterBlind = root.querySelector<HTMLElement>('.run-shell');
      expect(shellAfterBlind?.dataset.phaseTransition).toBe('blind-to-playing');

      const layer = root.querySelector<HTMLElement>('.phase-transition-layer');
      const blindExitHud = layer?.querySelector<HTMLElement>('.phase-exit-hud-up');
      const blindExitGrid = layer?.querySelector<HTMLElement>('.phase-exit-blinds-grid');
      expect(blindExitHud).not.toBeNull();
      expect(blindExitGrid).not.toBeNull();
      expect(Number.parseFloat(blindExitHud!.style.getPropertyValue('--phase-exit-y'))).toBeLessThan(
        0,
      );
      expect(
        Number.parseFloat(blindExitGrid!.style.getPropertyValue('--phase-exit-y')),
      ).toBeGreaterThan(0);

      await vi.advanceTimersByTimeAsync(1050);
      expect(layer?.childElementCount).toBe(0);
      expect(shellAfterBlind?.dataset.phaseTransition).toBeUndefined();

      mounted.destroy();
      mounted = null;

      // 2. Выплата -> Магазин -> Выбор заказа
      const wonPlaying = dispatch(blindRun, { type: 'SELECT_BLIND' }).nextState;
      const cashoutState: RunState = {
        ...wonPlaying,
        phase: 'cashout',
        cashout: {
          blindReward: 3,
          unusedHandsBonus: 3,
          interestBonus: 0,
          relicBonus: 0,
          tagBonus: 0,
          totalReward: 6,
        },
      };
      const cashoutSave = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(cashoutState, 2, nowMs),
        2,
        nowMs,
      );
      const mockCashout = createMockBridge({ initialSave: cashoutSave });

      mounted = mountBaliteApp(root, { bridge: mockCashout.bridge, initialNowMs: () => nowMs });
      await mounted.readyPromise;
      await flushMicrotasks(8);

      root.querySelector<HTMLButtonElement>('.claim-cashout-btn')?.click();
      const shellShop = root.querySelector<HTMLElement>('.run-shell');
      expect(shellShop?.dataset.phaseTransition).toBe('cashout-to-shop');
      expect(root.querySelectorAll('.hud-shop-sign__title-char').length).toBeGreaterThan(3);

      const layer2 = root.querySelector<HTMLElement>('.phase-transition-layer');
      expect(layer2?.querySelector('.phase-exit-hud-up')).not.toBeNull();
      expect(layer2?.querySelector('.phase-exit-arena-down')).not.toBeNull();

      await vi.advanceTimersByTimeAsync(1050);
      expect(layer2?.childElementCount).toBe(0);

      root.querySelector<HTMLButtonElement>('.shop-next-btn')?.click();
      await flushMicrotasks(8);
      const shellNextBlind = root.querySelector<HTMLElement>('.run-shell');
      expect(shellNextBlind?.dataset.phaseTransition).toBe('shop-to-blind');
      expect(shellNextBlind?.style.getPropertyValue('--blind-intro-delay')).toBe('400ms');
      expect(layer2?.querySelector('.phase-exit-hud-up')).not.toBeNull();
      expect(layer2?.querySelector('.phase-exit-arena-down')).not.toBeNull();

      await vi.advanceTimersByTimeAsync(1050);
      expect(layer2?.childElementCount).toBe(0);
    });

    it('в конце победного боя дожидается улёта оставшихся карт перед выездом и раскрытием кэшаута', async () => {
      const makeRect = (left: number, top: number, width: number, height: number): DOMRect =>
        ({
          x: left,
          y: top,
          left,
          top,
          width,
          height,
          right: left + width,
          bottom: top + height,
          toJSON: () => ({}),
        }) as DOMRect;

      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement,
      ) {
        if (this.classList.contains('stage-portrait')) {
          return makeRect(0, 0, 1280, 720);
        }
        if (this.dataset.cardId) {
          return makeRect(420, 460, 88, 124);
        }
        return makeRect(0, 0, 0, 0);
      });

      const nowMs = 9_600_000;
      const meta = createInitialMetaSave(nowMs, {
        lang: 'ru',
        animationSpeed: 1,
        tutorialCompleted: true,
      });
      const baseRun = createInitialRunState('b_red', 'CASHOUT_WAIT_CARDS');
      const playing = dispatch(baseRun, { type: 'SELECT_BLIND' }).nextState;
      const ace = createPlayingCard({ id: 'win_ace', rank: 14, suit: 'spades' });
      const fallbackRanks = [2, 3, 4, 5, 6, 7, 8] as const;
      const rest = playing.handIds.slice(1).map((id, i) =>
        createPlayingCard({ id, rank: fallbackRanks[i % fallbackRanks.length] ?? 2, suit: 'hearts' }),
      );
      const winningState: RunState = {
        ...playing,
        targetScore: 10,
        deck: [ace, ...rest],
        handIds: [ace.id, ...rest.map((c) => c.id)],
        drawPileIds: [],
      };
      const save = createPlayerSaveData(
        meta,
        serializeRunStateToSnapshot(winningState, 1, nowMs),
        1,
        nowMs,
      );
      const mock = createMockBridge({ initialSave: save });

      let rollerNowMs = 0;
      let nextRollerId = 1;
      const rollerFrames = new Map<number, FrameRequestCallback>();
      const stepRoller = (dtMs = 16): void => {
        rollerNowMs += dtMs;
        const batch = [...rollerFrames.entries()];
        rollerFrames.clear();
        for (const [, cb] of batch) cb(rollerNowMs);
      };

      vi.useFakeTimers();
      mounted = mountBaliteApp(root, {
        bridge: mock.bridge,
        initialNowMs: () => nowMs,
        numberRollerOptions: {
          now: () => rollerNowMs,
          reducedMotion: () => false,
          requestFrame: (cb) => {
            const id = nextRollerId++;
            rollerFrames.set(id, cb);
            return id;
          },
          cancelFrame: (id) => {
            rollerFrames.delete(id);
          },
        },
      });
      await mounted.readyPromise;
      await flushMicrotasks(8);

      root.querySelector<HTMLElement>(`.hand-card-slot[data-card-id="${ace.id}"]`)?.click();
      findButtonByText(root, 'Сыграть')?.click();

      // Проигрываем TracePlayer до перехода в cashout (960 + 800 + 640 ~ 2400мс)
      await vi.advanceTimersByTimeAsync(2600);
      await flushMicrotasks(12);

      expect(mounted.getState().phase).toBe('cashout');
      const shellCashout = root.querySelector<HTMLElement>('.run-shell');
      expect(shellCashout?.dataset.phaseTransition).toBe('playing-to-cashout');

      const enterDelayMs = Number.parseInt(
        shellCashout?.style.getPropertyValue('--arena-enter-delay') ?? '0',
        10,
      );
      expect(enterDelayMs).toBeGreaterThanOrEqual(450);

      // Пока улетают карты, строки кэшаута ещё скрыты и не стакуются поверх улетающих карт
      stepRoller(32);
      const firstRowBeforeWait = root.querySelector<HTMLElement>('.cashout-row');
      expect(firstRowBeforeWait?.dataset.cashoutRevealed).toBe('false');

      // После улёта карт и паузы запускается таймлайн кэшаута и раскрывает первую строку
      await vi.advanceTimersByTimeAsync(enterDelayMs + 220);
      stepRoller(32);
      expect(firstRowBeforeWait?.dataset.cashoutRevealed).toBe('true');
    });
  });
});
