import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlatformBridge } from '../../src/platform/bridge';

describe('createPlatformBridge', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (globalThis as Record<string, unknown>).YaGames;
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).YaGames;
    vi.restoreAllMocks();
  });

  it('инициализируется один раз, определяет язык/debug и вызывает ready() идемпотентно', async () => {
    window.history.replaceState({}, '', '/?platform=yandex&lang=en&debug=1');
    const ready = vi.fn();
    (globalThis as Record<string, unknown>).YaGames = {
      init: vi.fn().mockResolvedValue({
        environment: { i18n: { lang: 'ru' } },
        features: { LoadingAPI: { ready }, GameplayAPI: { start: vi.fn(), stop: vi.fn() } },
        getPlayer: vi.fn().mockResolvedValue({
          getData: vi.fn().mockResolvedValue({}),
          setData: vi.fn().mockResolvedValue(undefined),
        }),
        on: vi.fn(() => () => {}),
      }),
    };

    const bridge = createPlatformBridge({
      storageKey: 'balite_test_cloud',
      localBackupKey: 'balite_test_local',
    });

    const events: string[] = [];
    const unsubscribe = bridge.subscribe((evt) => events.push(evt));

    await Promise.all([bridge.init(), bridge.init()]);
    expect(bridge.isReady()).toBe(true);
    expect(bridge.getPlatformId()).toBe('yandex');
    expect(bridge.isDebugMode()).toBe(true);
    // Явный ?lang=en в URL перекрывает язык окружения в отладке
    expect(bridge.getLanguage()).toBe('en');
    expect(events.filter((e) => e === 'sdk_inited')).toHaveLength(1);

    bridge.ready();
    bridge.ready();
    expect(ready).toHaveBeenCalledTimes(1);

    unsubscribe();
    bridge.audio.dispose();
  });

  it('блокирует параллельные показы рекламы (busy) и снимает audio mute даже при ошибке адаптера', async () => {
    window.history.replaceState({}, '', '/?platform=yandex');

    let closeFirstAd: ((shown: boolean) => void) | null = null;
    const showFullscreenAdv = vi
      .fn()
      .mockImplementationOnce(({ callbacks }) => {
        callbacks?.onOpen?.();
        closeFirstAd = (shown: boolean) => callbacks?.onClose?.(shown);
      });

    const showRewardedVideo = vi.fn(() => {
      throw new Error('SDK crash');
    });

    (globalThis as Record<string, unknown>).YaGames = {
      init: vi.fn().mockResolvedValue({
        environment: { i18n: { lang: 'ru' } },
        features: { LoadingAPI: { ready: vi.fn() }, GameplayAPI: { start: vi.fn(), stop: vi.fn() } },
        getPlayer: vi.fn().mockResolvedValue(null),
        on: vi.fn(() => () => {}),
        adv: { showFullscreenAdv, showRewardedVideo },
      }),
    };

    const bridge = createPlatformBridge();
    bridge.audio.install();
    await bridge.init();

    const firstAdPromise = bridge.showInterstitial();
    // Пока идёт первая реклама — аудио замьючено, а второй вызов получает busy: true
    expect(bridge.audio.isMutedByPlatform()).toBe(true);
    expect(await bridge.showRewarded()).toEqual({ rewarded: false, busy: true });
    expect(showRewardedVideo).not.toHaveBeenCalled();

    closeFirstAd!(true);
    expect(await firstAdPromise).toEqual({ shown: true });
    expect(bridge.audio.isMutedByPlatform()).toBe(false);

    // Исключение внутри showRewardedVideo должно безопасно завершиться и размьютить аудио
    const failedRewarded = await bridge.showRewarded();
    expect(failedRewarded.rewarded).toBe(false);
    expect(bridge.audio.isMutedByPlatform()).toBe(false);

    bridge.audio.dispose();
  });

  it('сериализует параллельные savePlayerData в очередь и восстанавливается после сбоя', async () => {
    window.history.replaceState({}, '', '/?platform=yandex');
    const savedSnapshots: Array<Record<string, unknown>> = [];
    let releaseFirstSave: (() => void) | null = null;

    const setData = vi
      .fn()
      .mockImplementationOnce((payload: Record<string, unknown>) => {
        savedSnapshots.push({ ...payload });
        return new Promise<void>((resolve, reject) => {
          releaseFirstSave = () => reject(new Error('network error'));
          void resolve;
        });
      })
      .mockImplementationOnce((payload: Record<string, unknown>) => {
        savedSnapshots.push({ ...payload });
        return Promise.resolve();
      });

    (globalThis as Record<string, unknown>).YaGames = {
      init: vi.fn().mockResolvedValue({
        environment: { i18n: { lang: 'ru' } },
        features: { LoadingAPI: { ready: vi.fn() }, GameplayAPI: { start: vi.fn(), stop: vi.fn() } },
        getPlayer: vi.fn().mockResolvedValue({
          getData: vi.fn().mockResolvedValue({}),
          setData,
        }),
        on: vi.fn(() => () => {}),
      }),
    };

    const bridge = createPlatformBridge<{ ante?: number; gold?: number }>({
      localBackupKey: 'balite_queue_test',
    });
    await bridge.init();

    const p1 = bridge.savePlayerData({ ante: 2 });
    const p2 = bridge.savePlayerData({ gold: 15 });

    // Второй setData не должен стартовать до завершения первого
    await Promise.resolve();
    await Promise.resolve();
    expect(setData).toHaveBeenCalledTimes(1);

    releaseFirstSave!();
    expect(await p1).toBe(false);
    expect(await p2).toBe(true);

    expect(savedSnapshots).toEqual([{ ante: 2 }, { ante: 2, gold: 15 }]);
    expect(JSON.parse(localStorage.getItem('balite_queue_test') || '{}')).toEqual({
      ante: 2,
      gold: 15,
    });
    bridge.audio.dispose();
  });

  it('безопасно объединяет локальное и облачное сохранение через пользовательский mergeSave', async () => {
    window.history.replaceState({}, '', '/?platform=yandex');
    localStorage.setItem(
      'balite_merge_local',
      JSON.stringify({ bestAnte: 3, settings: { speed: 2 } }),
    );

    (globalThis as Record<string, unknown>).YaGames = {
      init: vi.fn().mockResolvedValue({
        environment: { i18n: { lang: 'ru' } },
        features: { LoadingAPI: { ready: vi.fn() }, GameplayAPI: { start: vi.fn(), stop: vi.fn() } },
        getPlayer: vi.fn().mockResolvedValue({
          getData: vi.fn().mockResolvedValue({ bestAnte: 6, unlocked: ['j1'] }),
          setData: vi.fn().mockResolvedValue(undefined),
        }),
        on: vi.fn(() => () => {}),
      }),
    };

    type TestSave = { bestAnte?: number; unlocked?: string[]; settings?: { speed: number } };
    const bridge = createPlatformBridge<TestSave>({
      localBackupKey: 'balite_merge_local',
      mergeSave: (base, incoming) => ({
        ...base,
        ...incoming,
        bestAnte: Math.max(base.bestAnte ?? 0, incoming.bestAnte ?? 0),
      }),
    });
    await bridge.init();

    const loaded = await bridge.loadPlayerData();
    expect(loaded).toEqual({
      bestAnte: 6,
      unlocked: ['j1'],
      settings: { speed: 2 },
    });
    expect(JSON.parse(localStorage.getItem('balite_merge_local') || '{}')).toEqual(loaded);
    bridge.audio.dispose();
  });

  it('синхронизирует game_api_pause/resume с AudioUnlock и переносит битые cloudData в loadPlayerData', async () => {
    window.history.replaceState({}, '', '/?platform=yandex');
    localStorage.setItem('balite_bad_cloud', JSON.stringify({ level: 4 }));
    const listeners: Record<string, () => void> = {};
    const getData = vi.fn().mockResolvedValue('not-an-object');

    (globalThis as Record<string, unknown>).YaGames = {
      init: vi.fn().mockResolvedValue({
        environment: { i18n: { lang: 'ru' } },
        features: { LoadingAPI: { ready: vi.fn() }, GameplayAPI: { start: vi.fn(), stop: vi.fn() } },
        getPlayer: vi.fn().mockResolvedValue({
          getData,
          setData: vi.fn().mockResolvedValue(undefined),
        }),
        on: vi.fn((evt: string, cb: () => void) => {
          listeners[evt] = cb;
          return () => {};
        }),
      }),
    };

    const bridge = createPlatformBridge({ localBackupKey: 'balite_bad_cloud' });
    bridge.audio.install();
    await bridge.init();

    listeners.game_api_pause?.();
    expect(bridge.audio.isMutedByPlatform()).toBe(true);
    listeners.game_api_resume?.();
    expect(bridge.audio.isMutedByPlatform()).toBe(false);

    expect(await bridge.loadPlayerData()).toEqual({ level: 4 });

    getData.mockRejectedValueOnce(new Error('cloud down'));
    expect(await bridge.loadPlayerData()).toEqual({ level: 4 });

    bridge.audio.dispose();
  });

  it('сохраняет накопленные патчи в памяти при отказе localStorage', async () => {
    window.history.replaceState({}, '', '/?platform=yandex');
    const saved: Array<Record<string, unknown>> = [];

    (globalThis as Record<string, unknown>).YaGames = {
      init: vi.fn().mockResolvedValue({
        environment: { i18n: { lang: 'ru' } },
        features: { LoadingAPI: { ready: vi.fn() }, GameplayAPI: { start: vi.fn(), stop: vi.fn() } },
        getPlayer: vi.fn().mockResolvedValue({
          getData: vi.fn().mockResolvedValue({}),
          setData: vi.fn((payload: Record<string, unknown>) => {
            saved.push({ ...payload });
            return Promise.resolve();
          }),
        }),
        on: vi.fn(() => () => {}),
      }),
    };

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    const bridge = createPlatformBridge<{ a?: number; b?: number }>();
    await bridge.init();

    await Promise.all([
      bridge.savePlayerData({ a: 1 }),
      bridge.savePlayerData({ b: 2 }),
    ]);

    expect(saved).toEqual([{ a: 1 }, { a: 1, b: 2 }]);
    bridge.audio.dispose();
  });

  it('при стандартном слиянии учитывает revision/updatedAt и не затирает более свежий локальный сейв старым облаком', async () => {
    window.history.replaceState({}, '', '/?platform=yandex');
    localStorage.setItem(
      'balite_fresh_local',
      JSON.stringify({ revision: 5, bestAnte: 8, unlocked: ['r1', 'r2'] }),
    );
    const getData = vi.fn().mockResolvedValue({
      revision: 3,
      bestAnte: 2,
      cloudOnlyBonus: true,
    });

    (globalThis as Record<string, unknown>).YaGames = {
      init: vi.fn().mockResolvedValue({
        environment: { i18n: { lang: 'ru' } },
        features: { LoadingAPI: { ready: vi.fn() }, GameplayAPI: { start: vi.fn(), stop: vi.fn() } },
        getPlayer: vi.fn().mockResolvedValue({
          getData,
          setData: vi.fn().mockResolvedValue(undefined),
        }),
        on: vi.fn(() => () => {}),
      }),
    };

    const bridge = createPlatformBridge({ localBackupKey: 'balite_fresh_local' });
    await bridge.init();

    const loaded = await bridge.loadPlayerData();
    expect(loaded).toEqual({
      revision: 5,
      bestAnte: 8,
      unlocked: ['r1', 'r2'],
      cloudOnlyBonus: true,
    });

    // А когда облако новее по updatedAt, приоритет у облака
    localStorage.setItem(
      'balite_fresh_local_2',
      JSON.stringify({ updatedAt: 1000, bestAnte: 4 }),
    );
    getData.mockResolvedValueOnce({ updatedAt: 2000, bestAnte: 9 });
    const bridge2 = createPlatformBridge({ localBackupKey: 'balite_fresh_local_2' });
    await bridge2.init();
    expect(await bridge2.loadPlayerData()).toEqual({ updatedAt: 2000, bestAnte: 9 });

    bridge.audio.dispose();
    bridge2.audio.dispose();
  });

  it('дебаунсит облачные сохранения и немедленно сбрасывает их через flushCloudSave или pagehide/game_api_pause', async () => {
    vi.useFakeTimers();
    try {
      window.history.replaceState({}, '', '/?platform=yandex');
      const setData = vi.fn().mockResolvedValue(undefined);
      const listeners: Record<string, () => void> = {};

      (globalThis as Record<string, unknown>).YaGames = {
        init: vi.fn().mockResolvedValue({
          environment: { i18n: { lang: 'ru' } },
          features: { LoadingAPI: { ready: vi.fn() }, GameplayAPI: { start: vi.fn(), stop: vi.fn() } },
          getPlayer: vi.fn().mockResolvedValue({
            getData: vi.fn().mockResolvedValue({}),
            setData,
          }),
          on: vi.fn((evt: string, cb: () => void) => {
            listeners[evt] = cb;
            return () => {};
          }),
        }),
      };

      const bridge = createPlatformBridge<{ a?: number; b?: number; c?: number }>({
        localBackupKey: 'balite_debounce_local',
        cloudDebounceMs: 1000,
      });
      await bridge.init();

      const p1 = bridge.savePlayerData({ a: 1 });
      const p2 = bridge.savePlayerData({ b: 2 });

      // Локально доступно сразу, а в облако ещё не ушло
      expect(JSON.parse(localStorage.getItem('balite_debounce_local') || '{}')).toEqual({
        a: 1,
        b: 2,
      });
      expect(setData).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);
      await expect(Promise.all([p1, p2])).resolves.toEqual([true, true]);
      expect(setData).toHaveBeenCalledTimes(1);
      expect(setData).toHaveBeenCalledWith({ a: 1, b: 2 }, true);

      // Принудительный flushCloudSave сбрасывает отложенную запись без ожидания таймера
      const p3 = bridge.savePlayerData({ c: 3 });
      expect(setData).toHaveBeenCalledTimes(1);
      await expect(bridge.flushCloudSave()).resolves.toBe(true);
      await expect(p3).resolves.toBe(true);
      expect(setData).toHaveBeenCalledTimes(2);
      expect(setData).toHaveBeenLastCalledWith({ a: 1, b: 2, c: 3 }, true);

      // Событие паузы платформы также инициирует немедленный flush
      const p4 = bridge.savePlayerData({ a: 10 });
      expect(setData).toHaveBeenCalledTimes(2);
      listeners.game_api_pause?.();
      await vi.waitFor(() => expect(setData).toHaveBeenCalledTimes(3));
      await expect(p4).resolves.toBe(true);
      expect(setData).toHaveBeenLastCalledWith({ a: 10, b: 2, c: 3 }, true);

      bridge.audio.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('распознаёт vk_language (включая kz/ua и числовой код 3) и флаг #debug в hash в dev-режиме', async () => {
    window.history.replaceState({}, '', '/?platform=vk&vk_language=3#debug');
    const bridgeEn = createPlatformBridge();
    expect(bridgeEn.getLanguage()).toBe('en');
    expect(bridgeEn.isDebugMode()).toBe(true);
    await bridgeEn.init();
    expect(bridgeEn.getLanguage()).toBe('en');
    bridgeEn.audio.dispose();

    window.history.replaceState({}, '', '/?platform=vk&vk_language=kz');
    const bridgeKz = createPlatformBridge();
    expect(bridgeKz.getLanguage()).toBe('ru');
    expect(bridgeKz.isDebugMode()).toBe(false);
    await bridgeKz.init();
    expect(bridgeKz.getLanguage()).toBe('ru');
    bridgeKz.audio.dispose();
  });
});
