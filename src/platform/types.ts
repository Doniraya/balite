export type PlatformId = 'yandex' | 'vk' | 'ok' | 'vkplay' | 'mock';

export type SupportedLang = 'ru' | 'en';

export type PlatformEventName =
  | 'sdk_inited'
  | 'game_api_pause'
  | 'game_api_resume'
  | 'interstitial_open'
  | 'interstitial_close'
  | 'interstitial_error'
  | 'rewarded_open'
  | 'rewarded_rewarded'
  | 'rewarded_closed'
  | 'rewarded_error';

export type PlatformEventListener = (
  event: PlatformEventName,
  payload: Record<string, unknown>,
) => void;

export interface InterstitialResult {
  shown: boolean;
  busy?: boolean;
  error?: string;
}

export interface RewardedResult {
  rewarded: boolean;
  busy?: boolean;
  error?: string;
}

export interface AudioUnlockController {
  install(): void;
  dispose(): void;
  unlock(): void;
  registerContext(ctx: AudioContext): void;
  setPlatformPaused(paused: boolean): void;
  onAdStart(): void;
  onAdEnd(): void;
  isMutedByPlatform(): boolean;
  subscribeMute(listener: (muted: boolean) => void): () => void;
}

export interface AdapterContext<
  TSave extends Record<string, unknown> = Record<string, unknown>,
> {
  params: Record<string, string>;
  isDebug: boolean;
  emit: (event: PlatformEventName, payload: Record<string, unknown>) => void;
  storageKey: string;
  maxStorageBytes: number;
  vkPlayAppId?: string;
  sandboxMockDelayMs?: number;
  compactFallback?: (data: TSave) => unknown;
}

export interface PlatformAdapter<
  TSave extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly id: PlatformId;
  init(): Promise<void>;
  getLanguage?(): SupportedLang | Promise<SupportedLang>;
  ready(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  showInterstitial(): Promise<InterstitialResult>;
  showRewarded(): Promise<RewardedResult>;
  setLeaderboardScore(boardName: string, score: number): Promise<void>;
  loadPlayerData(): Promise<Partial<TSave>>;
  savePlayerData(mergedData: TSave): Promise<boolean>;
  vibrate?(style: 'light' | 'medium' | 'heavy'): void;
}

export interface PlatformBridgeConfig<
  TSave extends Record<string, unknown> = Record<string, unknown>,
> {
  vkPlayAppId: string;
  storageKey: string;
  localBackupKey: string;
  maxStorageBytes: number;
  sandboxMockDelayMs: number;
  mergeSave?: (baseData: Partial<TSave>, incomingData: Partial<TSave>) => Partial<TSave>;
  compactFallback?: (data: TSave) => unknown;
  sanitizeSave?: (raw: unknown) => Partial<TSave>;
  audio?: AudioUnlockController;
}

export interface PlatformBridge<
  TSave extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly audio: AudioUnlockController;
  init(): Promise<void>;
  isReady(): boolean;
  getPlatformId(): PlatformId;
  getLanguage(): SupportedLang;
  isDebugMode(): boolean;
  subscribe(listener: PlatformEventListener): () => void;
  ready(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  showInterstitial(): Promise<InterstitialResult>;
  showRewarded(): Promise<RewardedResult>;
  setLeaderboardScore(boardName: string, score: number): Promise<void>;
  loadPlayerData(): Promise<Partial<TSave>>;
  savePlayerData(patch: Partial<TSave>): Promise<boolean>;
  vibrate(style?: 'light' | 'medium' | 'heavy'): void;
}
