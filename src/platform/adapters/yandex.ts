import type * as YSDK from 'ysdk';
import { normalizeLang } from '../env';
import type {
  AdapterContext,
  InterstitialResult,
  PlatformAdapter,
  RewardedResult,
  SupportedLang,
} from '../types';
import {
  loadScriptOnce,
  runSandboxInterstitial,
  runSandboxRewarded,
  withTimeout,
} from '../utils';

interface YaGamesGlobal {
  init(): Promise<YSDK.SDK>;
}

/**
 * Адаптер Яндекс Игр с ленивой загрузкой /sdk.js и полной поддержкой SDK-методов.
 */
export class YandexAdapter<TSave extends Record<string, unknown> = Record<string, unknown>>
  implements PlatformAdapter<TSave>
{
  readonly id = 'yandex' as const;
  private readonly ctx: AdapterContext<TSave>;
  private ysdk: YSDK.SDK | null = null;
  private player: YSDK.Player | null = null;
  private adBusy = false;
  private readySent = false;

  constructor(ctx: AdapterContext<TSave>) {
    this.ctx = ctx;
  }

  private getYaGamesGlobal(): YaGamesGlobal | undefined {
    return (globalThis as Record<string, unknown>).YaGames as YaGamesGlobal | undefined;
  }

  async init(): Promise<void> {
    try {
      if (!this.getYaGamesGlobal()) {
        await loadScriptOnce('/sdk.js', 5000);
      }

      const yaGames = this.getYaGamesGlobal();
      if (!yaGames || typeof yaGames.init !== 'function') {
        return;
      }

      const sdk = await withTimeout(yaGames.init(), 5000, 'YaGames.init');
      this.ysdk = sdk;

      if (typeof sdk.on === 'function') {
        sdk.on('game_api_pause', () => {
          this.ctx.emit('game_api_pause', {});
        });
        sdk.on('game_api_resume', () => {
          this.ctx.emit('game_api_resume', {});
        });
      }

      try {
        this.player = await withTimeout(sdk.getPlayer(), 3500, 'ysdk.getPlayer');
      } catch {
        this.player = null;
      }
    } catch {
      // В оффлайне или без SDK приложение продолжает работу на локальном резерве
    }
  }

  getLanguage(): SupportedLang {
    const sdkLang = this.ysdk?.environment?.i18n?.lang;
    return normalizeLang(sdkLang || this.ctx.params.lang);
  }

  ready(): void {
    if (this.readySent) return;
    try {
      this.ysdk?.features?.LoadingAPI?.ready?.();
      this.readySent = true;
    } catch {
      // Игнорируем при отсутствии SDK
    }
  }

  gameplayStart(): void {
    try {
      this.ysdk?.features?.GameplayAPI?.start?.();
    } catch {
      // Игнорируем
    }
  }

  gameplayStop(): void {
    try {
      this.ysdk?.features?.GameplayAPI?.stop?.();
    } catch {
      // Игнорируем
    }
  }

  async showInterstitial(): Promise<InterstitialResult> {
    if (this.adBusy) return { shown: false, busy: true };

    this.adBusy = true;
    try {
      if (!this.ysdk?.adv?.showFullscreenAdv) {
        return await runSandboxInterstitial(this.ctx);
      }

      return await withTimeout(
        new Promise<InterstitialResult>((resolve) => {
          this.ysdk!.adv.showFullscreenAdv({
            callbacks: {
              onOpen: () => {
                this.ctx.emit('interstitial_open', {});
              },
              onClose: (wasShown) => {
                const shown = Boolean(wasShown);
                this.ctx.emit('interstitial_close', { shown });
                resolve({ shown });
              },
              onOffline: () => {
                this.ctx.emit('interstitial_error', { error: 'offline' });
                resolve({ shown: false, error: 'offline' });
              },
              onError: (err) => {
                const message = err instanceof Error ? err.message : String(err ?? 'unknown');
                this.ctx.emit('interstitial_error', { error: message });
                resolve({ shown: false, error: message });
              },
            },
          });
        }),
        30000,
        'ysdk.adv.showFullscreenAdv',
      );
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
    let rewarded = false;
    try {
      if (!this.ysdk?.adv?.showRewardedVideo) {
        return await runSandboxRewarded(this.ctx);
      }

      return await withTimeout(
        new Promise<RewardedResult>((resolve) => {
          this.ysdk!.adv.showRewardedVideo({
            callbacks: {
              onOpen: () => {
                this.ctx.emit('rewarded_open', {});
              },
              onRewarded: () => {
                rewarded = true;
                this.ctx.emit('rewarded_rewarded', {});
              },
              onClose: () => {
                this.ctx.emit('rewarded_closed', { rewarded });
                resolve({ rewarded });
              },
              onError: (err) => {
                const message = err instanceof Error ? err.message : String(err ?? 'unknown');
                this.ctx.emit('rewarded_error', { error: message });
                resolve({ rewarded: false, error: message });
              },
            },
          });
        }),
        60000,
        'ysdk.adv.showRewardedVideo',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.ctx.emit('rewarded_error', { error: message });
      return { rewarded: false, error: message };
    } finally {
      this.adBusy = false;
    }
  }

  async setLeaderboardScore(boardName: string, score: number): Promise<void> {
    const safeScore = Math.floor(score);
    if (!Number.isFinite(safeScore)) return;

    try {
      if (this.ysdk?.leaderboards?.setScore) {
        await withTimeout(
          this.ysdk.leaderboards.setScore(boardName, safeScore),
          4000,
          'ysdk.leaderboards.setScore',
        );
      } else if (typeof this.ysdk?.getLeaderboards === 'function') {
        const lb = await withTimeout(this.ysdk.getLeaderboards(), 4000, 'ysdk.getLeaderboards');
        await withTimeout(
          lb.setLeaderboardScore(boardName, safeScore),
          4000,
          'lb.setLeaderboardScore',
        );
      }
    } catch {
      // Ошибка лидерборда не должна блокировать игровой цикл
    }
  }

  private async ensurePlayer(): Promise<YSDK.Player | null> {
    if (this.player) return this.player;
    if (!this.ysdk) return null;
    try {
      this.player = await withTimeout(this.ysdk.getPlayer(), 3500, 'ysdk.getPlayer');
      return this.player;
    } catch {
      return null;
    }
  }

  async loadPlayerData(): Promise<Partial<TSave>> {
    const player = await this.ensurePlayer();
    if (!player) return {};
    try {
      const data = await withTimeout(player.getData(), 4000, 'player.getData');
      return data && typeof data === 'object' ? (data as Partial<TSave>) : {};
    } catch {
      return {};
    }
  }

  async savePlayerData(mergedData: TSave): Promise<boolean> {
    const player = await this.ensurePlayer();
    if (!player) return false;
    try {
      await withTimeout(player.setData(mergedData, true), 4000, 'player.setData');
      return true;
    } catch {
      return false;
    }
  }
}
