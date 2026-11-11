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

interface VkPlayIframeClient {
  showAds?: (opts: { interstitial: boolean }) => Promise<{ result?: boolean } | boolean>;
}

type IframeApiGlobal =
  | VkPlayIframeClient
  | ((opts?: { appid?: string }) => Promise<VkPlayIframeClient> | VkPlayIframeClient);

/**
 * Адаптер VK Play (mailru.core.js / iframeApi).
 */
export class VkPlayAdapter<TSave extends Record<string, unknown> = Record<string, unknown>>
  implements PlatformAdapter<TSave>
{
  readonly id = 'vkplay' as const;
  private readonly ctx: AdapterContext<TSave>;
  private client: VkPlayIframeClient | null = null;
  private adBusy = false;

  constructor(ctx: AdapterContext<TSave>) {
    this.ctx = ctx;
  }

  private getIframeApiGlobal(): IframeApiGlobal | undefined {
    return (globalThis as Record<string, unknown>).iframeApi as IframeApiGlobal | undefined;
  }

  async init(): Promise<void> {
    try {
      const appId =
        this.ctx.vkPlayAppId || this.ctx.params.vkplay_appid || this.ctx.params.appid || this.ctx.params.app_id || '';

      if (!this.getIframeApiGlobal() && appId) {
        try {
          await loadScriptOnce(`https://vkplay.ru/app/${appId}/static/mailru.core.js`, 5000);
        } catch {
          await loadScriptOnce(`https://store.my.games/app/${appId}/static/mailru.core.js`, 5000);
        }
      }

      const rawApi = this.getIframeApiGlobal();
      if (!rawApi) return;

      if (typeof rawApi === 'function') {
        this.client = await withTimeout(
          Promise.resolve(rawApi({ appid: appId || undefined })),
          5000,
          'iframeApi',
        );
      } else {
        this.client = rawApi;
      }
    } catch {
      this.client = null;
    }
  }

  ready(): void {}

  gameplayStart(): void {}

  gameplayStop(): void {}

  async showInterstitial(): Promise<InterstitialResult> {
    if (this.adBusy) return { shown: false, busy: true };

    this.adBusy = true;
    try {
      if (typeof this.client?.showAds !== 'function') {
        return await runSandboxInterstitial(this.ctx);
      }

      this.ctx.emit('interstitial_open', {});
      const res = await withTimeout(
        this.client.showAds({ interstitial: true }),
        30000,
        'iframeApi.showAds:interstitial',
      );
      const shown = typeof res === 'boolean' ? res : Boolean(res?.result ?? true);
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
      if (typeof this.client?.showAds !== 'function') {
        return await runSandboxRewarded(this.ctx);
      }

      this.ctx.emit('rewarded_open', {});
      const res = await withTimeout(
        this.client.showAds({ interstitial: false }),
        60000,
        'iframeApi.showAds:rewarded',
      );
      const rewarded = typeof res === 'boolean' ? res : Boolean(res?.result ?? true);
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

  async loadPlayerData(): Promise<Partial<TSave>> {
    return {};
  }

  async savePlayerData(_mergedData: TSave): Promise<boolean> {
    return true;
  }
}
