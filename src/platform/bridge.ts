import { createPlatformAdapter } from './adapters';
import { createAudioUnlockController } from './audioUnlock';
import { detectPlatformId, getAllUrlParams, normalizeLang } from './env';
import { readLocalSave, writeLocalSave } from './storage';
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
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseDebugFlag(params: Record<string, string>): boolean {
  if (params.debug === undefined) return false;
  const val = params.debug.trim().toLowerCase();
  return val !== '0' && val !== 'false' && val !== 'no';
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

  let initPromise: Promise<void> | null = null;
  let readyFlag = false;
  let readyCalled = false;
  let adShowing = false;
  let currentLang: SupportedLang = normalizeLang(params.lang);
  let saveQueuePromise: Promise<void> = Promise.resolve();

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
    const localData = readLocalSave<TSave>(cfg.localBackupKey, cfg.sanitizeSave);
    let rawCloud: unknown = {};
    try {
      rawCloud = await adapter.loadPlayerData();
    } catch {
      rawCloud = {};
    }

    const cloudData = sanitizeCloudObject(rawCloud);
    const merged = (
      cfg.mergeSave ? cfg.mergeSave(localData, cloudData) : { ...localData, ...cloudData }
    ) as Partial<TSave>;

    writeLocalSave(cfg.localBackupKey, merged);
    return merged;
  };

  const savePlayerData = (patch: Partial<TSave>): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      const current = readLocalSave<TSave>(cfg.localBackupKey, cfg.sanitizeSave);
      const safePatch = isPlainRecord(patch) ? patch : ({} as Partial<TSave>);
      const merged = (
        cfg.mergeSave ? cfg.mergeSave(current, safePatch) : { ...current, ...safePatch }
      ) as TSave;

      writeLocalSave(cfg.localBackupKey, merged);

      try {
        return await adapter.savePlayerData(merged);
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
    vibrate,
  };
}
