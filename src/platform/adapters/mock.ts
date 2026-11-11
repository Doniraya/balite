import type {
  AdapterContext,
  InterstitialResult,
  PlatformAdapter,
  RewardedResult,
} from '../types';
import { runSandboxInterstitial, runSandboxRewarded } from '../utils';

/**
 * Локальный/отладочный адаптер без внешней игровой площадки.
 */
export class MockAdapter<TSave extends Record<string, unknown> = Record<string, unknown>>
  implements PlatformAdapter<TSave>
{
  readonly id = 'mock' as const;
  private readonly ctx: AdapterContext<TSave>;
  private adBusy = false;

  constructor(ctx: AdapterContext<TSave>) {
    this.ctx = ctx;
  }

  async init(): Promise<void> {}

  ready(): void {}

  gameplayStart(): void {}

  gameplayStop(): void {}

  async showInterstitial(): Promise<InterstitialResult> {
    if (this.adBusy) return { shown: false, busy: true };
    this.adBusy = true;
    try {
      return await runSandboxInterstitial(this.ctx);
    } finally {
      this.adBusy = false;
    }
  }

  async showRewarded(): Promise<RewardedResult> {
    if (this.adBusy) return { rewarded: false, busy: true };
    this.adBusy = true;
    try {
      return await runSandboxRewarded(this.ctx);
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
