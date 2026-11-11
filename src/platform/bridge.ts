import { createPlatformAdapter } from './adapters';
import { createAudioUnlockController } from './audioUnlock';
import { detectPlatformId, getAllUrlParams, normalizeLang } from './env';
import { isPlainRecord, readLocalSave, writeLocalSave } from './storage';
import type {
  AdapterContext,
  InterstitialResult,
  PlatformBridge,
  PlatformBridgeConfig,
  PlatformEventListener,
  PlatformEventName,
  PlatformId,
  RewardedResult,
  SupportedLang,
} from './types';

const DEFAULT_BRIDGE_CONFIG: PlatformBridgeConfig<Record<string, unknown>> = {
  vkPlayAppId: '',
  storageKey: 'balite_save_v1',
  localBackupKey: 'balite_platform_save_v1',
  maxStorageBytes: 4000,
  sandboxMockDelayMs: 420,
  cloudDebounceMs: 0,
};

function parseDebugFlag(params: Record<string, string>): boolean {
  if (params.debug === undefined) return false;
  const val = params.debug.trim().toLowerCase();
  return val !== '0' && val !== 'false' && val !== 'no';
}

/**
 * Сравнивает свежесть локального и облачного сохранения по revision / updatedAt,
 * чтобы старый снимок из облака не перезаписывал более свежие локальные данные.
 */
function defaultMergeSave<TSave extends Record<string, unknown>>(
  localData: Partial<TSave>,
  cloudData: Partial<TSave>,
): Partial<TSave> {
  if (isPlainRecord(localData) && isPlainRecord(cloudData)) {
    for (const field of ['revision', 'updatedAt'] as const) {
      const localVal = localData[field];
      const cloudVal = cloudData[field];
      if (
        typeof localVal === 'number' &&
        Number.isFinite(localVal) &&
        typeof cloudVal === 'number' &&
        Number.isFinite(cloudVal)
      ) {
        return localVal > cloudVal
          ? ({ ...cloudData, ...localData } as Partial<TSave>)
          : ({ ...localData, ...cloudData } as Partial<TSave>);
      }
    }
  }

  return { ...localData, ...cloudData } as Partial<TSave>;
}

/**
 * Создаёт изолированный экземпляр платформенного моста для работы со звуком, рекламой и сохранениями.
 */
export function createPlatformBridge<
  TSave extends Record<string, unknown> = Record<string, unknown>,
>(userConfig: Partial<PlatformBridgeConfig<TSave>> = {}): PlatformBridge<TSave> {
  const cfg: PlatformBridgeConfig<TSave> = {
    ...(DEFAULT_BRIDGE_CONFIG as PlatformBridgeConfig<TSave>),
    ...userConfig,
  };

  const params = getAllUrlParams();
  const isDebug = parseDebugFlag(params);
  const platformId: PlatformId = detectPlatformId(params);
  const audio = cfg.audio ?? createAudioUnlockController();
  const listeners = new Set<PlatformEventListener>();

  const emit = (event: PlatformEventName, payload: Record<string, unknown>): void => {
    if (event === 'game_api_pause') {
      audio.setPlatformPaused(true);
      void flushCloudSave();
    } else if (event === 'game_api_resume') {
      audio.setPlatformPaused(false);
    }

    for (const listener of listeners) {
      try {
        listener(event, payload);
      } catch {
        // Ошибки подписчиков не должны нарушать работу SDK-моста
      }
    }
  };

  const adapterCtx: AdapterContext<TSave> = {
    params,
    isDebug,
    emit,
    storageKey: cfg.storageKey,
    maxStorageBytes: cfg.maxStorageBytes,
    vkPlayAppId: cfg.vkPlayAppId,
    sandboxMockDelayMs: cfg.sandboxMockDelayMs,
    compactFallback: cfg.compactFallback,
  };

  const adapter = createPlatformAdapter<TSave>(platformId, adapterCtx);
  const cloudDebounceMs =
    typeof cfg.cloudDebounceMs === 'number' &&
    Number.isFinite(cfg.cloudDebounceMs) &&
    cfg.cloudDebounceMs > 0
      ? cfg.cloudDebounceMs
      : 0;

  let initPromise: Promise<void> | null = null;
  let readyFlag = false;
  let readyCalled = false;
  let adShowing = false;
  let currentLang: SupportedLang = normalizeLang(params.lang);
  let saveQueuePromise: Promise<void> = Promise.resolve();
  let inMemoryBackup: Partial<TSave> = {};
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingCloudResolvers: Array<(ok: boolean) => void> = [];
  let flushListenersBound = false;

  const onPageHideFlush = (): void => {
    void flushCloudSave();
  };

  const onVisibilityChangeFlush = (): void => {
    if (typeof document !== 'undefined' && document.hidden) {
      void flushCloudSave();
    }
  };

  const bindFlushListeners = (): void => {
    if (flushListenersBound) return;
    flushListenersBound = true;
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', onPageHideFlush);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChangeFlush);
    }
  };

  const unbindFlushListeners = (): void => {
    if (!flushListenersBound) return;
    flushListenersBound = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', onPageHideFlush);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChangeFlush);
    }
  };

  const readBackupState = (): Partial<TSave> => {
    const stored = readLocalSave<TSave>(cfg.localBackupKey, cfg.sanitizeSave);
    return { ...inMemoryBackup, ...stored };
  };

  const writeBackupState = (data: Partial<TSave>): void => {
    inMemoryBackup = { ...data };
    writeLocalSave(cfg.localBackupKey, data);
  };

  const sanitizeCloudObject = (raw: unknown): Partial<TSave> => {
    if (!isPlainRecord(raw)) return {};
    if (cfg.sanitizeSave) {
      try {
        return cfg.sanitizeSave(raw);
      } catch {
        return {};
      }
    }
    return raw as Partial<TSave>;
  };

  const init = (): Promise<void> => {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      await adapter.init();

      if (params.lang && params.lang.trim()) {
        currentLang = normalizeLang(params.lang);
      } else if (typeof adapter.getLanguage === 'function') {
        try {
          currentLang = normalizeLang(await adapter.getLanguage());
        } catch {
          currentLang = normalizeLang(null);
        }
      } else {
        currentLang = normalizeLang(null);
      }

      readyFlag = true;
      emit('sdk_inited', {
        platformId,
        lang: currentLang,
        isDebug,
      });
    })();

    return initPromise;
  };

  const ready = (): void => {
    if (readyCalled) return;
    readyCalled = true;
    adapter.ready();
  };

  const showInterstitial = async (): Promise<InterstitialResult> => {
    if (adShowing) return { shown: false, busy: true };
    adShowing = true;
    audio.onAdStart();
    try {
      return await adapter.showInterstitial();
    } catch (err) {
      return {
        shown: false,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      adShowing = false;
      audio.onAdEnd();
    }
  };

  const showRewarded = async (): Promise<RewardedResult> => {
    if (adShowing) return { rewarded: false, busy: true };
    adShowing = true;
    audio.onAdStart();
    try {
      return await adapter.showRewarded();
    } catch (err) {
      return {
        rewarded: false,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      adShowing = false;
      audio.onAdEnd();
    }
  };

  const loadPlayerData = async (): Promise<Partial<TSave>> => {
    await flushCloudSave();

    let rawCloud: unknown = {};
    try {
      rawCloud = await adapter.loadPlayerData();
    } catch {
      rawCloud = {};
    }

    const localData = readBackupState();
    const cloudData = sanitizeCloudObject(rawCloud);
    const merged = (
      cfg.mergeSave ? cfg.mergeSave(localData, cloudData) : defaultMergeSave(localData, cloudData)
    ) as Partial<TSave>;

    writeBackupState(merged);
    return merged;
  };

  const applyPatchLocally = (patch: Partial<TSave>): TSave => {
    const current = readBackupState();
    const safePatch = isPlainRecord(patch) ? patch : ({} as Partial<TSave>);
    const merged = (
      cfg.mergeSave ? cfg.mergeSave(current, safePatch) : { ...current, ...safePatch }
    ) as TSave;
    writeBackupState(merged);
    return merged;
  };

  const enqueueCloudSave = (getPayload: () => TSave): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      try {
        return await adapter.savePlayerData(getPayload());
      } catch {
        return false;
      }
    };

    const next = saveQueuePromise.then(run, run);
    saveQueuePromise = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  function flushCloudSave(): Promise<boolean> {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    unbindFlushListeners();

    if (pendingCloudResolvers.length === 0) {
      return saveQueuePromise.then(() => true);
    }

    const resolvers = pendingCloudResolvers;
    pendingCloudResolvers = [];

    return enqueueCloudSave(() => readBackupState() as TSave).then((ok) => {
      for (const resolve of resolvers) {
        resolve(ok);
      }
      return ok;
    });
  }

  const savePlayerData = (patch: Partial<TSave>): Promise<boolean> => {
    if (cloudDebounceMs <= 0) {
      return enqueueCloudSave(() => applyPatchLocally(patch));
    }

    // При активном дебаунсе пишем в localStorage сразу, а облачную отправку группируем
    applyPatchLocally(patch);

    return new Promise<boolean>((resolve) => {
      pendingCloudResolvers.push(resolve);
      bindFlushListeners();
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void flushCloudSave();
      }, cloudDebounceMs);
    });
  };

  const vibrate = (style: 'light' | 'medium' | 'heavy' = 'light'): void => {
    if (typeof adapter.vibrate === 'function') {
      adapter.vibrate(style);
      return;
    }

    const ms = style === 'heavy' ? 40 : style === 'medium' ? 24 : 12;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(ms);
      }
    } catch {
      // Игнорируем ограничения браузера на вибрацию
    }
  };

  return {
    audio,
    init,
    isReady: () => readyFlag,
    getPlatformId: () => platformId,
    getLanguage: () => currentLang,
    isDebugMode: () => isDebug,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    ready,
    gameplayStart: () => adapter.gameplayStart(),
    gameplayStop: () => adapter.gameplayStop(),
    showInterstitial,
    showRewarded,
    setLeaderboardScore: (boardName, score) => adapter.setLeaderboardScore(boardName, score),
    loadPlayerData,
    savePlayerData,
    flushCloudSave,
    vibrate,
  };
}
