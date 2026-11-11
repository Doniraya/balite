import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdapterContext, PlatformEventName } from '../../src/platform/types';
import { MockAdapter } from '../../src/platform/adapters/mock';
import { YandexAdapter } from '../../src/platform/adapters/yandex';
import { VkAdapter } from '../../src/platform/adapters/vk';
import { OkAdapter } from '../../src/platform/adapters/ok';
import { VkPlayAdapter } from '../../src/platform/adapters/vkplay';

const { vkBridgeMock, vkListeners } = vi.hoisted(() => {
  const listeners = new Set<(event: { detail: { type: string; data?: unknown } }) => void>();
  return {
    vkListeners: listeners,
    vkBridgeMock: {
      isEmbedded: vi.fn(() => true),
      send: vi.fn(async () => ({})),
      supportsAsync: vi.fn(async () => true),
      subscribe: vi.fn((fn: (event: { detail: { type: string; data?: unknown } }) => void) => {
        listeners.add(fn);
      }),
      unsubscribe: vi.fn((fn: (event: { detail: { type: string; data?: unknown } }) => void) => {
        listeners.delete(fn);
      }),
    },
  };
});

vi.mock('@vkontakte/vk-bridge', () => ({
  default: vkBridgeMock,
}));

function makeContext(overrides: Partial<AdapterContext> = {}): {
  ctx: AdapterContext;
  events: Array<{ event: PlatformEventName; payload: Record<string, unknown> }>;
} {
  const events: Array<{ event: PlatformEventName; payload: Record<string, unknown> }> = [];
  const ctx: AdapterContext = {
    params: {},
    isDebug: false,
    emit: (event, payload) => events.push({ event, payload }),
    storageKey: 'balite_save_v1',
    maxStorageBytes: 4000,
    vkPlayAppId: '12345',
    sandboxMockDelayMs: 5,
    ...overrides,
  };
  return { ctx, events };
}

describe('MockAdapter', () => {
  it('не показывает sandbox-рекламу при isDebug=false', async () => {
    const { ctx } = makeContext({ isDebug: false });
    const adapter = new MockAdapter(ctx);
    await adapter.init();

    expect(await adapter.showInterstitial()).toEqual({ shown: false });
    expect(await adapter.showRewarded()).toEqual({ rewarded: false });
    expect(document.querySelector('[data-balite-sandbox-ad]')).toBeNull();
  });

  it('показывает sandbox-рекламу при isDebug=true и эмитит события', async () => {
    const { ctx, events } = makeContext({ isDebug: true, sandboxMockDelayMs: 5 });
    const adapter = new MockAdapter(ctx);
    await adapter.init();

    const inter = await adapter.showInterstitial();
    expect(inter).toEqual({ shown: true });

    const rewPromise = adapter.showRewarded();
    const cancelBtn = document.querySelector<HTMLButtonElement>('[data-balite-sandbox-cancel]');
    expect(cancelBtn).not.toBeNull();
    const rew = await rewPromise;
    expect(rew).toEqual({ rewarded: true });

    // Проверка досрочной отмены rewarded-рекламы
    const rewCancelPromise = adapter.showRewarded();
    document.querySelector<HTMLButtonElement>('[data-balite-sandbox-cancel]')?.click();
    const rewCancelled = await rewCancelPromise;
    expect(rewCancelled).toEqual({ rewarded: false });

    expect(events.map((e) => e.event)).toEqual([
      'interstitial_open',
      'interstitial_close',
      'rewarded_open',
      'rewarded_rewarded',
      'rewarded_closed',
      'rewarded_open',
      'rewarded_closed',
    ]);
  });
});

describe('YandexAdapter', () => {
  beforeEach(() => {
    delete (globalThis as Record<string, unknown>).YaGames;
    document.head.innerHTML = '';
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).YaGames;
    vi.restoreAllMocks();
  });

  it('переживает ошибку загрузки /sdk.js и не вешает init()', async () => {
    const origAppend = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
      const result = origAppend(node);
      if (node instanceof HTMLScriptElement && node.src.includes('/sdk.js')) {
        queueMicrotask(() => node.dispatchEvent(new Event('error')));
      }
      return result;
    });

    const { ctx } = makeContext({ isDebug: false });
    const adapter = new YandexAdapter(ctx);
    await expect(adapter.init()).resolves.toBeUndefined();
    expect(await adapter.showInterstitial()).toEqual({ shown: false });

    // В режиме isDebug при недоступном SDK должен работать sandbox-оверлей
    const debugCtx = makeContext({ isDebug: true, sandboxMockDelayMs: 5 }).ctx;
    const debugAdapter = new YandexAdapter(debugCtx);
    await expect(debugAdapter.init()).resolves.toBeUndefined();
    expect(await debugAdapter.showInterstitial()).toEqual({ shown: true });
    expect(await debugAdapter.showRewarded()).toEqual({ rewarded: true });
  });

  it('не зависает при таймауте загрузки /sdk.js и удаляет зависший script-тег из DOM', async () => {
    vi.useFakeTimers();
    try {
      const { ctx } = makeContext({ isDebug: false });
      const adapter = new YandexAdapter(ctx);
      const initPromise = adapter.init();
      expect(document.head.querySelector('script[src*="/sdk.js"]')).not.toBeNull();

      await vi.advanceTimersByTimeAsync(5001);
      await initPromise;
      expect(document.head.querySelector('script[src*="/sdk.js"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('передаёт весь объект mergedData в player.setData без фильтрации полей Slime и работает с рекламой/лидербордами', async () => {
    const setData = vi.fn().mockResolvedValue(undefined);
    const getData = vi.fn().mockResolvedValue({ bestAnte: 4, profile: { coins: 90 } });
    const setScore = vi.fn().mockResolvedValue(undefined);
    const ready = vi.fn();
    const start = vi.fn();
    const stop = vi.fn();
    const listeners: Record<string, () => void> = {};

    (globalThis as Record<string, unknown>).YaGames = {
      init: vi.fn().mockResolvedValue({
        environment: { i18n: { lang: 'en' } },
        features: {
          LoadingAPI: { ready },
          GameplayAPI: { start, stop },
        },
        leaderboards: { setScore },
        getPlayer: vi.fn().mockResolvedValue({ getData, setData }),
        on: vi.fn((event: string, cb: () => void) => {
          listeners[event] = cb;
          return () => {};
        }),
        adv: {
          showFullscreenAdv: vi.fn(({ callbacks }) => {
            callbacks?.onOpen?.();
            callbacks?.onClose?.(true);
          }),
          showRewardedVideo: vi.fn(({ callbacks }) => {
            callbacks?.onOpen?.();
            callbacks?.onRewarded?.();
            callbacks?.onClose?.();
          }),
        },
      }),
    };

    const { ctx, events } = makeContext();
    const adapter = new YandexAdapter(ctx);
    await adapter.init();

    expect(adapter.getLanguage()).toBe('en');
    adapter.ready();
    adapter.gameplayStart();
    adapter.gameplayStop();
    expect(ready).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);

    listeners.game_api_pause?.();
    listeners.game_api_resume?.();
    expect(events.map((e) => e.event)).toContain('game_api_pause');
    expect(events.map((e) => e.event)).toContain('game_api_resume');

    expect(await adapter.showInterstitial()).toEqual({ shown: true });
    expect(await adapter.showRewarded()).toEqual({ rewarded: true });

    await adapter.setLeaderboardScore('best_run', 4200);
    expect(setScore).toHaveBeenCalledWith('best_run', 4200);

    expect(await adapter.loadPlayerData()).toEqual({ bestAnte: 4, profile: { coins: 90 } });

    const payload = { runSeed: 'ABC123', ante: 5, jokers: ['j_joker'] };
    expect(await adapter.savePlayerData(payload)).toBe(true);
    expect(setData).toHaveBeenCalledWith(payload, true);
  });
});

describe('VkAdapter', () => {
  beforeEach(() => {
    vkListeners.clear();
    vkBridgeMock.isEmbedded.mockReturnValue(true);
    vkBridgeMock.send.mockReset().mockResolvedValue({});
    vkBridgeMock.supportsAsync.mockReset().mockResolvedValue(true);
  });

  it('инициализируется, работает со storageKey, рекламой и событиями скрытия вкладки', async () => {
    const { ctx, events } = makeContext({ storageKey: 'balite_save_v1', maxStorageBytes: 200 });
    const adapter = new VkAdapter(ctx);
    await adapter.init();

    expect(vkBridgeMock.send).toHaveBeenCalledWith('VKWebAppInit');

    for (const listener of vkListeners) {
      listener({ detail: { type: 'VKWebAppViewHide' } });
      listener({ detail: { type: 'VKWebAppViewRestore' } });
    }
    expect(events.map((e) => e.event)).toEqual(['game_api_pause', 'game_api_resume']);

    vkBridgeMock.send.mockResolvedValueOnce({
      keys: [{ key: 'balite_save_v1', value: JSON.stringify({ ante: 2 }) }],
    });
    expect(await adapter.loadPlayerData()).toEqual({ ante: 2 });

    vkBridgeMock.send.mockResolvedValueOnce({ result: true });
    expect(await adapter.savePlayerData({ ante: 3 })).toBe(true);
    expect(vkBridgeMock.send).toHaveBeenCalledWith('VKWebAppStorageSet', {
      key: 'balite_save_v1',
      value: JSON.stringify({ ante: 3 }),
    });

    vkBridgeMock.send.mockResolvedValueOnce({ result: true });
    expect(await adapter.showInterstitial()).toEqual({ shown: true });

    vkBridgeMock.send.mockResolvedValueOnce({ result: true });
    expect(await adapter.showRewarded()).toEqual({ rewarded: true });
  });

  it('не вызывает VKWebAppInit вне iframe VK и проверяет supportsAsync до эмиссии *_open', async () => {
    vkBridgeMock.isEmbedded.mockReturnValue(false);
    vkBridgeMock.supportsAsync.mockResolvedValue(false);

    const { ctx, events } = makeContext({
      params: { platform: 'vk' },
      isDebug: false,
    });
    const adapter = new VkAdapter(ctx);
    await adapter.init();

    expect(vkBridgeMock.send).not.toHaveBeenCalledWith('VKWebAppInit');
    expect(await adapter.showInterstitial()).toEqual({ shown: false });
    expect(events).toEqual([]);
  });
});

describe('OkAdapter', () => {
  beforeEach(() => {
    delete (globalThis as Record<string, unknown>).FAPI;
    delete (globalThis as Record<string, unknown>).API_callback;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).FAPI;
    delete (globalThis as Record<string, unknown>).API_callback;
  });

  it('инициализируется через FAPI и использует CUSTOM storage и API_callback для рекламы', async () => {
    const callMock = vi.fn((params: Record<string, unknown>, cb: (status: string, data: unknown) => void) => {
      if (params.method === 'storage.get') {
        cb('ok', { data: { balite_save_v1: JSON.stringify({ chips: 500 }) } });
      } else if (params.method === 'storage.set') {
        cb('ok', { success: true });
      }
    });

    (globalThis as Record<string, unknown>).FAPI = {
      init: vi.fn((_s, _c, onSuccess) => onSuccess?.()),
      Client: { call: callMock },
      UI: {
        showAd: vi.fn(() => {
          const cb = (globalThis as unknown as Record<string, ((...args: unknown[]) => void) | undefined>)
            .API_callback;
          cb?.('showAd', 'ok', '');
        }),
        loadAd: vi.fn(() => {
          const cb = (globalThis as unknown as Record<string, ((...args: unknown[]) => void) | undefined>)
            .API_callback;
          cb?.('loadAd', 'ok', 'ready');
        }),
        showLoadedAd: vi.fn(() => {
          const cb = (globalThis as unknown as Record<string, ((...args: unknown[]) => void) | undefined>)
            .API_callback;
          cb?.('showLoadedAd', 'ok', 'complete');
        }),
      },
    };

    const { ctx } = makeContext({
      params: { api_server: 'https://api.ok.ru/', api_connection: 'conn1' },
    });
    const adapter = new OkAdapter(ctx);
    await adapter.init();

    expect(await adapter.loadPlayerData()).toEqual({ chips: 500 });
    expect(await adapter.savePlayerData({ chips: 700 })).toBe(true);
    expect(callMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'storage.set',
        key: 'balite_save_v1',
        scope: 'CUSTOM',
      }),
      expect.any(Function),
    );

    expect(await adapter.showInterstitial()).toEqual({ shown: true });
    expect(await adapter.showRewarded()).toEqual({ rewarded: true });
  });
});

describe('VkPlayAdapter', () => {
  beforeEach(() => {
    delete (globalThis as Record<string, unknown>).iframeApi;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).iframeApi;
  });

  it('использует iframeApi при наличии и безопасно деградирует без него', async () => {
    const showAds = vi.fn().mockResolvedValue({ result: true });
    (globalThis as Record<string, unknown>).iframeApi = vi.fn().mockResolvedValue({ showAds });

    const { ctx } = makeContext({ vkPlayAppId: '999' });
    const adapter = new VkPlayAdapter(ctx);
    await adapter.init();

    expect(await adapter.showInterstitial()).toEqual({ shown: true });
    expect(await adapter.showRewarded()).toEqual({ rewarded: true });
    expect(showAds).toHaveBeenCalledTimes(2);
  });

  it('не засчитывает rewarded/shown при пустом результате {} от iframeApi.showAds', async () => {
    const showAds = vi.fn().mockResolvedValue({});
    (globalThis as Record<string, unknown>).iframeApi = vi.fn().mockResolvedValue({ showAds });

    const { ctx, events } = makeContext({ vkPlayAppId: '999' });
    const adapter = new VkPlayAdapter(ctx);
    await adapter.init();

    expect(await adapter.showInterstitial()).toEqual({ shown: false });
    expect(await adapter.showRewarded()).toEqual({ rewarded: false });
    expect(events.map((e) => e.event)).not.toContain('rewarded_rewarded');
  });
});
