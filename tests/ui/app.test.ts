import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createConsumableInstance,
  createInitialMetaSave,
  createInitialRunState,
  createPlayerSaveData,
  createPlayingCard,
  createRelicInstance,
  serializeRunStateToSnapshot,
} from '../../src/engine';
import type { PlayerSaveData, RunState } from '../../src/engine/types';
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
          root.querySelector('.stage-portrait .run-shell') !== null;
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

      // При первом старте в deck_select геймплей и реклама не запускаются
      expect(mock.bridge.gameplayStart).not.toHaveBeenCalled();
      expect(mock.bridge.showInterstitial).not.toHaveBeenCalled();
      expect(mounted.getState().phase).toBe('deck_select');
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
    });

    it('на стартовом deck_select с сохранённым снимком держит кнопку Продолжить забег и восстанавливает по клику', async () => {
      const baseRun = createInitialRunState('b_red', 'RESUME9');
      const snapshot = serializeRunStateToSnapshot({ ...baseRun, phase: 'deck_select', previousPhase: 'blind_select' }, 2, 1500);
      const meta = createInitialMetaSave(1000, { lang: 'ru' });
      const save = createPlayerSaveData(meta, snapshot, 2, 1500);
      const mock = createMockBridge({ initialSave: save });

      mounted = mountBaliteApp(root, { bridge: mock.bridge });
      await mounted.readyPromise;

      expect(mounted.getState().phase).toBe('deck_select');
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

      // Прокручиваем первые шаги TracePlayer (1x = 280мс/шаг) — появляются поп-апы и подсветка карты/реликвии
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

      findButtonByText(root, 'Настройки')!.click();
      expect(root.querySelector('[data-modal="settings"]')).not.toBeNull();
      expect(root.querySelector('[data-debug-action]')).toBeNull();

      // Меняем язык на English
      findButtonByText(root.querySelector('[data-modal="settings"]')!, 'English')!.click();
      expect(document.documentElement.lang).toBe('en');
      expect(mounted.getSaveData().meta.settings.lang).toBe('en');
      expect(mockNormal.bridge.savePlayerData).toHaveBeenCalled();

      mounted.destroy();
      root.replaceChildren();

      // С флагом debug=true отладочные кнопки отображаются и работают
      const mockDebug = createMockBridge({ isDebug: true });
      mounted = mountBaliteApp(root, { bridge: mockDebug.bridge });
      await mounted.readyPromise;

      findButtonByText(root, 'Настройки')!.click();
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

      findButtonByText(root.querySelector('[data-modal="settings"]')!, 'Закрыть')?.click();

      // Начинаем забег чтобы проверить модалки Расклады и Колода
      findButtonByText(root, 'Начать забег')!.click();
      findButtonByText(root, 'Сразиться')!.click();

      findButtonByText(root, 'Расклады')!.click();
      expect(root.querySelector('[data-modal="hand-reference"]')).not.toBeNull();
      findButtonByText(root.querySelector('[data-modal="hand-reference"]')!, 'Закрыть')!.click();

      findButtonByText(root, 'Колода')!.click();
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

      // Выбираем карту в бустере и активируем свиток Колесницы (Сталь)
      (root.querySelector('[data-belt="hand"] [data-card-id="bh_1"]') as HTMLElement).click();
      const choiceBtn = findButtonByText(
        root.querySelector('[data-choice-uid="choice_chariot"]')!,
        'Выбрать',
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
      expect(nextSave.meta.unlockedDecks).toContain('b_blue');
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
      findButtonByText(root, 'Сразиться')!.click();
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

      // Прошло только 60_000 мс (< 180_000 мс): нажатие «Играть снова» НЕ показывает рекламу
      findButtonByText(root, 'Играть снова')!.click();
      await flushMicrotasks();
      expect(mock.bridge.showInterstitial).toHaveBeenCalledTimes(1);
      expect(mounted.getState().phase).toBe('blind_select');

      // Сдвигаем часы на +180_000 мс и снова проигрываем на 1-м страже -> реклама снова показывается
      nowMs += 180_000;
      findButtonByText(root, 'Сразиться')!.click();
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
      findButtonByText(root, 'Играть снова')!.click();
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
      expect(css).toContain('.is-triggering');
      expect(css).toContain('safe-area-inset');
      expect(css).toContain('overflow: hidden');
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
});
