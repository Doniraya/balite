// Гибридный аудиодвижок Balite: сэмплы с приоритетным фолбэком на процедурный синтезатор (Story 5.1).
import type { GameSettings, TraceEvent } from '../engine/types';
import type { AudioUnlockController } from '../platform/types';
import {
  AUDIO_SAMPLE_REGISTRY,
  type AudioSampleKey,
} from './sampleRegistry';
import {
  computeBalatroComboPitch,
  createBaliteAudio,
  dispatchTraceAudioEvent,
  type BaliteAudioController,
  type BaliteAudioSettings,
} from './synth';

/** Настройки гибридного аудиоконтроллера. */
export interface HybridAudioOptions {
  /** Переопределение реестра URL-ов сэмплов (по умолчанию AUDIO_SAMPLE_REGISTRY). */
  readonly sampleRegistry?: Readonly<Partial<Record<AudioSampleKey, string>>>;
  /** Переопределение функции HTTP-загрузки (по умолчанию globalThis.fetch). */
  readonly fetchFn?: typeof fetch;
  /** Переопределение генератора случайных чисел [0..1) для микро-вариации тона. */
  readonly randomFn?: () => number;
}

const MICRO_DETUNE_RANGE = 0.02;

function computeComboPlaybackRate(
  comboIndex = 0,
  isRetriggerAnnounce = false,
  randomFn: () => number = Math.random,
): number {
  return computeBalatroComboPitch(comboIndex, isRetriggerAnnounce, randomFn);
}

async function decodeSampleBuffer(
  ctx: AudioContext,
  data: ArrayBuffer,
): Promise<AudioBuffer> {
  if (typeof ctx.decodeAudioData !== 'function') {
    throw new Error('AUDIO_DECODE_UNSUPPORTED');
  }
  return new Promise<AudioBuffer>((resolve, reject) => {
    let settled = false;
    const onSuccess = (decoded: AudioBuffer) => {
      if (settled) return;
      settled = true;
      resolve(decoded);
    };
    const onError = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    try {
      const maybePromise = ctx.decodeAudioData(data, onSuccess, onError);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(onSuccess, onError);
      }
    } catch (err) {
      onError(err);
    }
  });
}

/**
 * Создаёт гибридный аудиоконтроллер, использующий загруженные сэмплы (.ogg/.mp3/.wav)
 * с ленивой подгрузкой в unlock(), pitch-shift по комбо и плавным фолбэком на synth.ts.
 */
export function createHybridBaliteAudio(
  platformAudio?: AudioUnlockController,
  initialSettings?: Partial<Pick<GameSettings, 'soundEnabled' | 'sfxVolume' | 'musicVolume'>>,
  options: HybridAudioOptions = {},
): BaliteAudioController {
  const sampleRegistry = options.sampleRegistry ?? AUDIO_SAMPLE_REGISTRY;
  const fetchFn =
    options.fetchFn ??
    (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined);
  const randomFn = options.randomFn ?? Math.random;

  const decodedBuffers = new Map<AudioSampleKey, AudioBuffer>();
  let audioCtx: AudioContext | null = null;
  let sfxGain: GainNode | null = null;
  let musicGain: GainNode | null = null;

  let bgmSource: AudioBufferSourceNode | null = null;
  let bgmStartTime = 0;
  let bgmPauseOffset = 0;

  let lastMuted = false;
  let lastUnlocked = false;
  let lastMusicVolume = initialSettings?.musicVolume ?? 0.4;
  let loadStarted = false;
  let disposed = false;

  const hasBgmBuffer = (): boolean => decodedBuffers.has('bgm');

  const stopBgmSource = (saveOffset: boolean): void => {
    if (!bgmSource) return;
    if (saveOffset && audioCtx) {
      const bgmBuffer = decodedBuffers.get('bgm');
      const elapsed = Math.max(0, (audioCtx.currentTime || 0) - bgmStartTime);
      const duration = bgmBuffer?.duration && bgmBuffer.duration > 0 ? bgmBuffer.duration : 0;
      bgmPauseOffset =
        duration > 0 ? (bgmPauseOffset + elapsed) % duration : bgmPauseOffset + elapsed;
    }
    try {
      if (typeof bgmSource.stop === 'function') {
        bgmSource.stop();
      }
    } catch {
      // Источник BGM уже остановлен
    }
    try {
      if (typeof bgmSource.disconnect === 'function') {
        bgmSource.disconnect();
      }
    } catch {
      // Игнорируем ошибку отсоединения узла
    }
    bgmSource = null;
  };

  const startBgmSource = (): void => {
    if (
      disposed ||
      bgmSource ||
      !audioCtx ||
      !musicGain ||
      lastMuted ||
      !lastUnlocked ||
      lastMusicVolume <= 0 ||
      typeof audioCtx.createBufferSource !== 'function'
    ) {
      return;
    }

    const bgmBuffer = decodedBuffers.get('bgm');
    if (!bgmBuffer) return;

    try {
      const source = audioCtx.createBufferSource();
      source.buffer = bgmBuffer;
      source.loop = true;
      source.connect(musicGain);
      const offset =
        bgmBuffer.duration && bgmBuffer.duration > 0
          ? bgmPauseOffset % bgmBuffer.duration
          : 0;
      bgmStartTime = audioCtx.currentTime || 0;
      if (typeof source.start === 'function') {
        source.start(0, offset);
      }
      bgmSource = source;
    } catch {
      stopBgmSource(false);
    }
  };

  const synth = createBaliteAudio(platformAudio, initialSettings, {
    suppressAmbient: hasBgmBuffer,
    onContextReady: (nodes) => {
      audioCtx = nodes.ctx;
      sfxGain = nodes.sfxGain;
      musicGain = nodes.musicGain;
    },
    onSyncState: (state) => {
      audioCtx = state.ctx;
      sfxGain = state.sfxGain;
      musicGain = state.musicGain;
      lastMuted = state.muted;
      lastUnlocked = state.unlocked;
      lastMusicVolume = state.musicVolume;

      if (state.muted || !state.unlocked || state.musicVolume <= 0 || disposed) {
        stopBgmSource(true);
        return;
      }

      if (hasBgmBuffer()) {
        startBgmSource();
      }
    },
    onDispose: () => {
      disposed = true;
      stopBgmSource(false);
      decodedBuffers.clear();
      audioCtx = null;
      sfxGain = null;
      musicGain = null;
    },
  });

  const loadSample = async (
    key: AudioSampleKey,
    url: string,
    ctx: AudioContext,
  ): Promise<void> => {
    if (!fetchFn || disposed) return;
    try {
      const response = await fetchFn(url);
      if (!response.ok || disposed) return;
      const arrayBuffer = await response.arrayBuffer();
      if (disposed || audioCtx !== ctx) return;
      const decoded = await decodeSampleBuffer(ctx, arrayBuffer);
      if (disposed || audioCtx !== ctx) return;

      decodedBuffers.set(key, decoded);
      if (key === 'bgm') {
        // Останавливаем процедурный эмбиент и запускаем сэмпл BGM через общий sync
        synth.setSettings({});
      }
    } catch {
      // При любой ошибке сети или декодирования остаётся фолбэк на процедурный синтезатор
    }
  };

  const microVariationRate = (): number => {
    const raw = randomFn();
    const clamped = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.5;
    return 1 + (clamped * 2 - 1) * MICRO_DETUNE_RANGE;
  };

  const playSample = (key: AudioSampleKey, playbackRate = 1): boolean => {
    if (
      disposed ||
      synth.isMuted() ||
      synth.getSettings().sfxVolume <= 0 ||
      !audioCtx ||
      !sfxGain ||
      typeof audioCtx.createBufferSource !== 'function'
    ) {
      return false;
    }

    const buffer = decodedBuffers.get(key);
    if (!buffer) return false;

    try {
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      if (source.playbackRate && typeof source.playbackRate === 'object') {
        source.playbackRate.value = playbackRate;
      }
      source.connect(sfxGain);
      if (typeof source.start === 'function') {
        source.start(audioCtx.currentTime || 0);
      }
      return true;
    } catch {
      return false;
    }
  };

  const unlock = (): void => {
    if (disposed) return;
    synth.unlock();

    if (loadStarted || !audioCtx || !fetchFn) return;
    const entries = Object.entries(sampleRegistry) as [AudioSampleKey, string | undefined][];
    if (entries.length === 0) return;

    loadStarted = true;
    const targetCtx = audioCtx;
    for (const [key, url] of entries) {
      if (typeof url === 'string' && url.length > 0) {
        void loadSample(key, url, targetCtx);
      }
    }
  };

  const controller: BaliteAudioController = {
    unlock,
    setSettings: (settings) => synth.setSettings(settings),
    getSettings: (): BaliteAudioSettings => synth.getSettings(),
    isMuted: () => synth.isMuted(),
    playButton: () => {
      if (!playSample('button', microVariationRate())) synth.playButton();
    },
    playCardHover: () => {
      if (!playSample('card_hover', microVariationRate())) synth.playCardHover();
    },
    playCardSelect: () => {
      if (!playSample('card_select', microVariationRate())) synth.playCardSelect();
    },
    playCardDeselect: () => {
      if (!playSample('card_deselect', microVariationRate())) synth.playCardDeselect();
    },
    playCardDeal: () => {
      if (!playSample('card_deal', microVariationRate())) synth.playCardDeal();
    },
    playChipHit: (comboIndex = 0) => {
      if (!playSample('chip_hit', computeComboPlaybackRate(comboIndex, false, randomFn))) {
        synth.playChipHit(comboIndex);
      }
    },
    playMultHit: (comboIndex = 0) => {
      if (!playSample('mult_hit', computeComboPlaybackRate(comboIndex, false, randomFn))) {
        synth.playMultHit(comboIndex);
      }
    },
    playRelicTrigger: (comboIndex = 0, isRetriggerAnnounce = false) => {
      if (
        !playSample(
          'relic_trigger',
          computeComboPlaybackRate(comboIndex, isRetriggerAnnounce, randomFn),
        )
      ) {
        synth.playRelicTrigger(comboIndex, isRetriggerAnnounce);
      }
    },
    playGoldDelta: (positive = true) => {
      if (!playSample('gold', positive ? 1 : 0.88)) {
        synth.playGoldDelta(positive);
      }
    },
    playBoosterOpen: () => {
      if (!playSample('booster_open', 1)) synth.playBoosterOpen();
    },
    playConsumable: (kind: 'celestial' | 'scroll' | 'rune' = 'scroll') => {
      const rate = kind === 'celestial' ? 1.06 : kind === 'rune' ? 0.94 : 1;
      if (!playSample('consumable', rate)) {
        synth.playConsumable(kind);
      }
    },
    playFlameThreshold: () => {
      if (!playSample('flame_surge', 1)) synth.playFlameThreshold();
    },
    playShatter: () => {
      if (!playSample('shatter', 1)) synth.playShatter();
    },
    playDebuff: () => {
      if (!playSample('debuff', 1)) synth.playDebuff();
    },
    playBuy: () => {
      if (!playSample('gold', 1.04)) synth.playBuy();
    },
    playReroll: () => {
      if (!playSample('card_deal', 1.06)) synth.playReroll();
    },
    playWin: () => {
      if (!playSample('win', 1)) synth.playWin();
    },
    playLose: () => {
      if (!playSample('lose', 1)) synth.playLose();
    },
    playDialogue: () => {
      if (!playSample('dialogue', microVariationRate())) synth.playDialogue();
    },
    playForTraceEvent: (event: TraceEvent, comboIndex: number) =>
      dispatchTraceAudioEvent(controller, event, comboIndex),
    dispose: () => synth.dispose(),
  };

  return controller;
}
