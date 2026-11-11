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
});
