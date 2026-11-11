import vkBridge, { type VKBridgeSubscribeHandler } from '@vkontakte/vk-bridge';
import { serializeWithinLimit } from '../storage';
import type {
  AdapterContext,
  InterstitialResult,
  PlatformAdapter,
  RewardedResult,
} from '../types';
import { runSandboxInterstitial, runSandboxRewarded, withTimeout } from '../utils';

/**
 * Адаптер VK Mini Apps / VK Игр на базе пакета @vkontakte/vk-bridge.
 */
export class VkAdapter<TSave extends Record<string, unknown> = Record<string, unknown>>
  implements PlatformAdapter<TSave>
{
  readonly id = 'vk' as const;
  private readonly ctx: AdapterContext<TSave>;
  private inited = false;
  private adBusy = false;
  private lifecycleHandler: VKBridgeSubscribeHandler | null = null;

  constructor(ctx: AdapterContext<TSave>) {
    this.ctx = ctx;
  }

  async init(): Promise<void> {
    try {
      if (!this.lifecycleHandler) {
        this.lifecycleHandler = (event) => {
          const type = event?.detail?.type;
          if (type === 'VKWebAppViewHide') {
            this.ctx.emit('game_api_pause', {});
          } else if (type === 'VKWebAppViewRestore') {
            this.ctx.emit('game_api_resume', {});
          }
        };
        vkBridge.subscribe(this.lifecycleHandler);
      }

      if (vkBridge.isEmbedded()) {
        await withTimeout(vkBridge.send('VKWebAppInit'), 4000, 'VKWebAppInit');
        this.inited = true;
      }
    } catch {
      this.inited = false;
    }
  }

  ready(): void {}

  gameplayStart(): void {}

  gameplayStop(): void {}

  private async showNativeAd(
    adFormat: 'interstitial' | 'reward',
  ): Promise<{ supported: boolean; shown: boolean }> {
    const supported = await vkBridge.supportsAsync('VKWebAppShowNativeAds').catch(() => false);
    if (!supported) {
      return { supported: false, shown: false };
    }

    this.ctx.emit(adFormat === 'reward' ? 'rewarded_open' : 'interstitial_open', {});
    const res = await withTimeout(
      vkBridge.send('VKWebAppShowNativeAds', { ad_format: adFormat }),
      adFormat === 'reward' ? 60000 : 30000,
      `VKWebAppShowNativeAds:${adFormat}`,
    );
    return { supported: true, shown: Boolean((res as { result?: boolean })?.result) };
  }

  async showInterstitial(): Promise<InterstitialResult> {
    if (this.adBusy) return { shown: false, busy: true };

    this.adBusy = true;
    try {
      if (!this.inited && !vkBridge.isEmbedded()) {
        return await runSandboxInterstitial(this.ctx);
      }

      const { supported, shown } = await this.showNativeAd('interstitial');
      if (!supported) {
        return { shown: false };
      }
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
      if (!this.inited && !vkBridge.isEmbedded()) {
        return await runSandboxRewarded(this.ctx);
      }

      const { supported, shown } = await this.showNativeAd('reward');
      if (!supported) {
        return { rewarded: false };
      }
      if (shown) this.ctx.emit('rewarded_rewarded', {});
      this.ctx.emit('rewarded_closed', { rewarded: shown });
      return { rewarded: shown };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.ctx.emit('rewarded_error', { error: message });
      return { rewarded: false, error: message };
    } finally {
      this.adBusy = false;
    }
  }

  async setLeaderboardScore(_boardName: string, score: number): Promise<void> {
    const safeScore = Math.floor(score);
    if (!this.inited || !Number.isFinite(safeScore)) return;
    try {
      const supported = await vkBridge.supportsAsync('VKWebAppShowLeaderBoardBox').catch(() => false);
      if (!supported) return;
      await vkBridge.send('VKWebAppShowLeaderBoardBox', {
        user_result: safeScore,
      });
    } catch {
      // Игнорируем ошибку таблицы лидеров
    }
  }

  async loadPlayerData(): Promise<Partial<TSave>> {
    try {
      const res = await withTimeout(
        vkBridge.send('VKWebAppStorageGet', { keys: [this.ctx.storageKey] }),
        4000,
        'VKWebAppStorageGet',
      );
      const entry = res?.keys?.find((item) => item.key === this.ctx.storageKey);
      if (!entry?.value) return {};
      const parsed: unknown = JSON.parse(entry.value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Partial<TSave>)
        : {};
    } catch {
      return {};
    }
  }

  async savePlayerData(mergedData: TSave): Promise<boolean> {
    try {
      const serialized = serializeWithinLimit(
        mergedData,
        this.ctx.maxStorageBytes,
        this.ctx.compactFallback,
      );
      const res = await withTimeout(
        vkBridge.send('VKWebAppStorageSet', {
          key: this.ctx.storageKey,
          value: serialized,
        }),
        4000,
        'VKWebAppStorageSet',
      );
      return Boolean((res as { result?: boolean })?.result ?? true);
    } catch {
      return false;
    }
  }

  vibrate(style: 'light' | 'medium' | 'heavy'): void {
    vkBridge
      .supportsAsync('VKWebAppTapticImpactOccurred')
      .then((ok) => {
        if (ok) {
          return vkBridge.send('VKWebAppTapticImpactOccurred', { style });
        }
        return undefined;
      })
      .catch(() => {});
  }
}
