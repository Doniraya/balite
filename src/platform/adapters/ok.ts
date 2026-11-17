import {
  assembleFromKeyValueCloud,
  isPlainRecord,
  splitPayloadForKeyValueCloud,
} from '../storage';
import type {
  AdapterContext,
  InterstitialResult,
  PlatformAdapter,
  RewardedResult,
} from '../types';
import {
  loadScriptOnce,
  runSandboxInterstitial,
  runSandboxRewarded,
  withTimeout,
} from '../utils';

interface FapiGlobal {
  init(
    apiServer: string,
    apiConnection: string,
    onSuccess?: () => void,
    onError?: (err?: unknown) => void,
  ): void;
  UI?: {
    showAd?: () => void;
    loadAd?: () => void;
    showLoadedAd?: () => void;
  };
  Client?: {
    call?: (
      params: Record<string, unknown>,
      callback: (status: string, data: unknown, error?: unknown) => void,
    ) => void;
  };
}

const OK_LOAD_AD_COOLDOWN_MS = 15500;

/**
 * Адаптер Игр Одноклассников (FAPI5): реклама через API_callback и CUSTOM storage.
 */
export class OkAdapter<TSave extends Record<string, unknown> = Record<string, unknown>>
  implements PlatformAdapter<TSave>
{
  readonly id = 'ok' as const;
  private readonly ctx: AdapterContext<TSave>;
  private inited = false;
  private adBusy = false;
  private adLoaded = false;
  private lastLoadAdAt = 0;
  private hookHandler: ((method: string, result: string, data: unknown) => void) | null = null;
  private readonly pendingCallbacks = new Map<
    string,
    (result: string, data: unknown) => void
  >();

  constructor(ctx: AdapterContext<TSave>) {
    this.ctx = ctx;
  }

  private getFapi(): FapiGlobal | undefined {
    return (globalThis as Record<string, unknown>).FAPI as FapiGlobal | undefined;
  }

  private installCallbackHook(): void {
    const g = globalThis as Record<string, unknown>;
    if (this.hookHandler && g.API_callback === this.hookHandler) {
      return;
    }

    const prev = g.API_callback as
      | ((method: string, result: string, data: unknown) => void)
      | undefined;

    this.hookHandler = (method: string, result: string, data: unknown) => {
      const pending = this.pendingCallbacks.get(method);
      if (pending) {
        this.pendingCallbacks.delete(method);
        pending(result, data);
      }
      if (typeof prev === 'function' && prev !== this.hookHandler) {
        try {
          prev(method, result, data);
        } catch {
          // Игнорируем ошибки внешнего обработчика
        }
      }
    };

    g.API_callback = this.hookHandler;
  }

  private waitForCallback(method: string, timeoutMs: number): Promise<{ result: string; data: unknown }> {
    return withTimeout(
      new Promise<{ result: string; data: unknown }>((resolve) => {
        this.pendingCallbacks.set(method, (result, data) => {
          resolve({ result, data });
        });
      }),
      timeoutMs,
      `FAPI.API_callback:${method}`,
    ).catch((err) => {
      this.pendingCallbacks.delete(method);
      throw err;
    });
  }

  async init(): Promise<void> {
    this.installCallbackHook();

    try {
      if (!this.getFapi()) {
        await loadScriptOnce('https://api.ok.ru/js/fapi5.js', 5000);
      }

      const fapi = this.getFapi();
      if (!fapi || typeof fapi.init !== 'function') {
        return;
      }

      const apiServer = this.ctx.params.api_server ?? '';
      const apiConnection = this.ctx.params.api_connection ?? '';

      await withTimeout(
        new Promise<void>((resolve) => {
          fapi.init(
            apiServer,
            apiConnection,
            () => {
              this.inited = true;
              resolve();
            },
            () => {
              this.inited = false;
              resolve();
            },
          );
        }),
        5000,
        'FAPI.init',
      );
    } catch {
      this.inited = false;
    }
  }

  ready(): void {}

  gameplayStart(): void {}

  gameplayStop(): void {}

  async showInterstitial(): Promise<InterstitialResult> {
    if (this.adBusy) return { shown: false, busy: true };

    this.adBusy = true;
    try {
      const showAd = this.getFapi()?.UI?.showAd;
      if (!this.inited || typeof showAd !== 'function') {
        return await runSandboxInterstitial(this.ctx);
      }

      this.ctx.emit('interstitial_open', {});
      const wait = this.waitForCallback('showAd', 30000);
      showAd();
      const { result } = await wait;
      const shown = result === 'ok';
      this.ctx.emit('interstitial_close', { shown });
      return { shown };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.ctx.emit('interstitial_error', { error: message });
      return { shown: false, error: message };
    } finally {
      this.adBusy = false;
    }
  }

  async showRewarded(): Promise<RewardedResult> {
    if (this.adBusy) return { rewarded: false, busy: true };

    this.adBusy = true;
    try {
      const ui = this.getFapi()?.UI;
      if (!this.inited || typeof ui?.loadAd !== 'function' || typeof ui?.showLoadedAd !== 'function') {
        return await runSandboxRewarded(this.ctx);
      }

      const now = Date.now();
      if (!this.adLoaded) {
        if (this.lastLoadAdAt > 0 && now - this.lastLoadAdAt < OK_LOAD_AD_COOLDOWN_MS) {
          this.ctx.emit('rewarded_error', { error: 'cooldown' });
          return { rewarded: false, error: 'cooldown' };
        }
        this.lastLoadAdAt = now;
        const loadWait = this.waitForCallback('loadAd', 7000);
        ui.loadAd();
        const loaded = await loadWait;
        if (loaded.result !== 'ok') {
          const error = `loadAd:${loaded.result}`;
          this.ctx.emit('rewarded_error', { error });
          return { rewarded: false, error };
        }
        this.adLoaded = true;
      }

      this.ctx.emit('rewarded_open', {});
      this.adLoaded = false;
      const showWait = this.waitForCallback('showLoadedAd', 60000);
      ui.showLoadedAd();
      const { result } = await showWait;
      const rewarded = result === 'ok';
      if (rewarded) {
        this.ctx.emit('rewarded_rewarded', {});
      }
      this.ctx.emit('rewarded_closed', { rewarded });
      return { rewarded };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.ctx.emit('rewarded_error', { error: message });
      return { rewarded: false, error: message };
    } finally {
      this.adBusy = false;
    }
  }

  async setLeaderboardScore(_boardName: string, _score: number): Promise<void> {}

  private callClient(params: Record<string, unknown>): Promise<{ status: string; data: unknown }> {
    const call = this.getFapi()?.Client?.call;
    if (!this.inited || typeof call !== 'function') {
      return Promise.reject(new Error('FAPI.Client недоступен'));
    }

    return withTimeout(
      new Promise<{ status: string; data: unknown }>((resolve) => {
        call(params, (status, data) => resolve({ status, data }));
      }),
      4000,
      `FAPI.Client:${String(params.method ?? 'unknown')}`,
    );
  }

  async loadPlayerData(): Promise<Partial<TSave>> {
    try {
      return await assembleFromKeyValueCloud<TSave>(this.ctx.storageKey, async (keys) => {
        const { status, data } = await this.callClient({
          method: 'storage.get',
          keys,
          scope: 'CUSTOM',
        });
        if (status !== 'ok' || !isPlainRecord(data)) return {};

        const container = isPlainRecord(data.data) ? data.data : data;
        const out: Record<string, string | undefined> = {};
        for (const key of keys) {
          const raw = container[key];
          if (typeof raw === 'string' && raw) {
            out[key] = raw;
          }
        }
        return out;
      });
    } catch {
      return {};
    }
  }

  async savePlayerData(mergedData: TSave): Promise<boolean> {
    try {
      const entries = splitPayloadForKeyValueCloud(
        mergedData,
        this.ctx.storageKey,
        this.ctx.maxStorageBytes,
        this.ctx.compactFallback,
      );
      if (entries === null) {
        // Не перезаписываем облачное сохранение пустым '{}', оставляя локальный сейв целым
        return false;
      }

      for (const entry of entries) {
        const { status } = await this.callClient({
          method: 'storage.set',
          key: entry.key,
          value: entry.value,
          scope: 'CUSTOM',
        });
        if (status !== 'ok') {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }
}
