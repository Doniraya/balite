import vkBridge, { type VKBridgeSubscribeHandler } from '@vkontakte/vk-bridge';
import { normalizeLang } from '../env';
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
  SupportedLang,
} from '../types';
import { runSandboxInterstitial, runSandboxRewarded, withTimeout } from '../utils';

const VK_INSET_SIDES = ['top', 'right', 'bottom', 'left'] as const;

/**
 * Пробрасывает системные отступы нативного клиента ВК в CSS-переменные `--vk-inset-*`.
 */
function applyVkInsets(rawInsets: unknown): void {
  if (typeof document === 'undefined' || !document.documentElement?.style || !isPlainRecord(rawInsets)) {
    return;
  }

  for (const side of VK_INSET_SIDES) {
    const val = rawInsets[side];
    if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
      document.documentElement.style.setProperty(`--vk-inset-${side}`, `${Math.round(val)}px`);
    }
  }
}

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
          const data = (event?.detail as { data?: unknown } | undefined)?.data;
          if (type === 'VKWebAppViewHide') {
            this.ctx.emit('game_api_pause', {});
          } else if (type === 'VKWebAppViewRestore') {
            this.ctx.emit('game_api_resume', {});
          } else if (type === 'VKWebAppUpdateInsets' && isPlainRecord(data)) {
            applyVkInsets(isPlainRecord(data.insets) ? data.insets : data);
          } else if (
            (type === 'VKWebAppUpdateConfig' || type === 'VKWebAppGetConfigResult') &&
            isPlainRecord(data) &&
            isPlainRecord(data.insets)
          ) {
            applyVkInsets(data.insets);
          }
        };
        vkBridge.subscribe(this.lifecycleHandler);
      }

      if (vkBridge.isEmbedded()) {
        await withTimeout(vkBridge.send('VKWebAppInit'), 4000, 'VKWebAppInit');
        this.inited = true;
        await this.configureViewportAndGestures();
      }
    } catch {
      this.inited = false;
    }
  }

  private async configureViewportAndGestures(): Promise<void> {
    try {
      const canGetConfig = await vkBridge.supportsAsync('VKWebAppGetConfig').catch(() => false);
      if (canGetConfig) {
        const config: unknown = await withTimeout(
          vkBridge.send('VKWebAppGetConfig'),
          1500,
          'VKWebAppGetConfig',
        ).catch(() => null);
        if (isPlainRecord(config) && isPlainRecord(config.insets)) {
          applyVkInsets(config.insets);
        }
      }
    } catch {
      // Игнорируем ошибку чтения конфигурации в окружениях без поддержки insets
    }

    try {
      const canSetSwipeSettings = await vkBridge
        .supportsAsync('VKWebAppSetSwipeSettings')
        .catch(() => false);
      if (canSetSwipeSettings) {
        await withTimeout(
          vkBridge.send('VKWebAppSetSwipeSettings', { history: false }),
          1500,
          'VKWebAppSetSwipeSettings',
        ).catch(() => null);
        return;
      }

      const canDisableSwipeBack = await vkBridge
        .supportsAsync('VKWebAppDisableSwipeBack')
        .catch(() => false);
      if (canDisableSwipeBack) {
        await withTimeout(
          vkBridge.send('VKWebAppDisableSwipeBack'),
          1500,
          'VKWebAppDisableSwipeBack',
        ).catch(() => null);
      }
    } catch {
      // Игнорируем ошибку настройки свайпа в браузере
    }
  }

  getLanguage(): SupportedLang {
    return normalizeLang(this.ctx.params.lang || this.ctx.params.vk_language);
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

  async setLeaderboardScore(_boardName: string, _score: number): Promise<void> {
    // По правилам модерации VK Игр (п. 3.1.9.10) автоматическое открытие
    // системного окна турнирной таблицы (VKWebAppShowLeaderBoardBox) без явного клика запрещено.
  }

  async loadPlayerData(): Promise<Partial<TSave>> {
    try {
      return await assembleFromKeyValueCloud<TSave>(this.ctx.storageKey, async (keys) => {
        const res = await withTimeout(
          vkBridge.send('VKWebAppStorageGet', { keys }),
          4000,
          'VKWebAppStorageGet',
        );
        const out: Record<string, string | undefined> = {};
        if (Array.isArray(res?.keys)) {
          for (const item of res.keys) {
            if (item && typeof item.key === 'string' && typeof item.value === 'string') {
              out[item.key] = item.value;
            }
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
        const res = await withTimeout(
          vkBridge.send('VKWebAppStorageSet', {
            key: entry.key,
            value: entry.value,
          }),
          4000,
          'VKWebAppStorageSet',
        );
        if (!Boolean((res as { result?: boolean })?.result ?? true)) {
          return false;
        }
      }
      return true;
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
