// Гибридный аудиодвижок Balite: сэмплы с балансом микса, динамикой BGM и фолбэком на синтезатор (Story 5.1 / 9.1).
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
  type AudioEditionKind,
  type AudioMusicMood,
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

/** Базовый коэффициент громкости фонового трека BGM (под комфортный дефолт без клиппинга). */
export const BGM_BASE_MIX_GAIN = 0.24;

/** Индивидуальные коэффициенты микса для каждого SFX-сэмпла (баланс между шорохом и акцентами). */
export const SAMPLE_MIX_GAINS: Readonly<Record<Exclude<AudioSampleKey, 'bgm'>, number>> = {
  card_hover: 0.075,
  dialogue: 0.11,
  card_deselect: 0.15,
  card_deal: 0.16,
  card_select: 0.17,
  button: 0.17,
  gold: 0.21,
  chip_hit: 0.21,
  relic_trigger: 0.22,
  consumable: 0.22,
  debuff: 0.22,
  mult_hit: 0.23,
  booster_open: 0.24,
  flame_surge: 0.24,
  flame_loop: 0.24,
  lose: 0.24,
  shatter: 0.25,
  win: 0.26,
};

interface BgmMoodProfile {
  readonly filterFreq: number;
  readonly playbackRate: number;
  readonly gainMul: number;
  readonly rampSec: number;
}

const BGM_MOOD_PROFILES: Readonly<Record<AudioMusicMood, BgmMoodProfile>> = {
  menu: { filterFreq: 18000, playbackRate: 1.0, gainMul: 1.0, rampSec: 0.55 },
  battle: { filterFreq: 18000, playbackRate: 1.0, gainMul: 1.0, rampSec: 0.55 },
  shop: { filterFreq: 2100, playbackRate: 0.985, gainMul: 0.85, rampSec: 0.65 },
  booster: { filterFreq: 1450, playbackRate: 0.96, gainMul: 0.8, rampSec: 0.45 },
  boss: { filterFreq: 20000, playbackRate: 1.04, gainMul: 1.08, rampSec: 0.6 },
  last_hand: { filterFreq: 16500, playbackRate: 1.055, gainMul: 1.06, rampSec: 0.45 },
  victory: { filterFreq: 20000, playbackRate: 1.02, gainMul: 1.0, rampSec: 0.5 },
  game_over: { filterFreq: 850, playbackRate: 0.5, gainMul: 0.82, rampSec: 1.1 },
};

const MICRO_DETUNE_RANGE = 0.02;

function applySmoothParam(
  param: AudioParam | undefined,
  target: number,
  now: number,
  rampSec: number,
  immediate: boolean,
): void {
  if (!param) return;
  try {
    if (immediate) {
      if (typeof param.cancelScheduledValues === 'function') {
        param.cancelScheduledValues(now);
      }
      if (typeof param.setValueAtTime === 'function') {
        param.setValueAtTime(target, now);
      }
      param.value = target;
      return;
    }
    if (typeof param.setTargetAtTime === 'function') {
      param.setTargetAtTime(target, now, Math.max(0.04, rampSec / 3));
    } else if (typeof param.linearRampToValueAtTime === 'function') {
      param.linearRampToValueAtTime(target, now + rampSec);
    } else {
      param.value = target;
    }
  } catch {
    try {
      param.value = target;
    } catch {
      // Игнорируем ограничения тестовых моков AudioParam
    }
  }
}

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
  let bgmFilter: BiquadFilterNode | null = null;
  let bgmMixGain: GainNode | null = null;
  let bgmStartTime = 0;
  let bgmPauseOffset = 0;
  let currentMusicMood: AudioMusicMood = 'menu';

  let lastMuted = false;
  let lastUnlocked = false;
  let lastSfxVolume = initialSettings?.sfxVolume ?? 0.8;
  let lastMusicVolume = initialSettings?.musicVolume ?? 0.4;
  let flameIntensity = 0;
  let flameSource: AudioBufferSourceNode | null = null;
  let flameMixGain: GainNode | null = null;
  const fadingFlameSources = new Set<{
    readonly source: AudioBufferSourceNode;
    readonly gain: GainNode | null;
  }>();
  let loadStarted = false;
  let disposed = false;

  const hasBgmBuffer = (): boolean => decodedBuffers.has('bgm');
  const hasFlameBuffer = (): boolean => decodedBuffers.has('flame_loop');

  const applyBgmMood = (immediate: boolean): void => {
    if (!audioCtx || !bgmSource) return;
    const profile = BGM_MOOD_PROFILES[currentMusicMood];
    const now = typeof audioCtx.currentTime === 'number' ? audioCtx.currentTime : 0;

    applySmoothParam(bgmSource.playbackRate, profile.playbackRate, now, profile.rampSec, immediate);
    if (bgmFilter) {
      applySmoothParam(bgmFilter.frequency, profile.filterFreq, now, profile.rampSec, immediate);
    }
    if (bgmMixGain) {
      applySmoothParam(
        bgmMixGain.gain,
        BGM_BASE_MIX_GAIN * profile.gainMul,
        now,
        profile.rampSec,
        immediate,
      );
    }
  };

  const stopBgmSource = (saveOffset: boolean): void => {
    if (!bgmSource) return;
    if (saveOffset && audioCtx) {
      const bgmBuffer = decodedBuffers.get('bgm');
      const profile = BGM_MOOD_PROFILES[currentMusicMood];
      const elapsed = Math.max(0, (audioCtx.currentTime || 0) - bgmStartTime) * profile.playbackRate;
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
    try {
      bgmFilter?.disconnect();
    } catch {
      // Игнорируем ошибку отсоединения фильтра
    }
    try {
      bgmMixGain?.disconnect();
    } catch {
      // Игнорируем ошибку отсоединения микс-гейна
    }
    bgmSource = null;
    bgmFilter = null;
    bgmMixGain = null;
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

      let tail: AudioNode = source;
      if (typeof audioCtx.createBiquadFilter === 'function') {
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        tail.connect(filter);
        tail = filter;
        bgmFilter = filter;
      }

      if (typeof audioCtx.createGain === 'function') {
        const mix = audioCtx.createGain();
        tail.connect(mix);
        tail = mix;
        bgmMixGain = mix;
      }

      tail.connect(musicGain);
      bgmSource = source;
      applyBgmMood(true);

      const offset =
        bgmBuffer.duration && bgmBuffer.duration > 0
          ? bgmPauseOffset % bgmBuffer.duration
          : 0;
      bgmStartTime = audioCtx.currentTime || 0;
      if (typeof source.start === 'function') {
        source.start(0, offset);
      }
    } catch {
      stopBgmSource(false);
    }
  };

  const stopFlameSample = (immediate: boolean): void => {
    if (immediate) {
      for (const item of fadingFlameSources) {
        try {
          if (typeof item.source.stop === 'function') {
            item.source.stop();
          }
        } catch {
          // Узел уже остановлен
        }
        try {
          item.source.disconnect();
        } catch {
          // Узел уже отключён
        }
        try {
          item.gain?.disconnect();
        } catch {
          // Узел уже отключён
        }
      }
      fadingFlameSources.clear();
    }

    if (!flameSource) return;
    const src = flameSource;
    const mix = flameMixGain;
    flameSource = null;
    flameMixGain = null;

    if (immediate || !audioCtx) {
      if (mix?.gain) {
        const now = typeof audioCtx?.currentTime === 'number' ? audioCtx.currentTime : 0;
        applySmoothParam(mix.gain, 0, now, 0, true);
      }
      try {
        if (typeof src.stop === 'function') {
          src.stop();
        }
      } catch {
        // Источник пламени уже остановлен
      }
      try {
        src.disconnect();
      } catch {
        // Игнорируем ошибку отсоединения
      }
      try {
        mix?.disconnect();
      } catch {
        // Игнорируем ошибку отсоединения
      }
      return;
    }

    const now = typeof audioCtx.currentTime === 'number' ? audioCtx.currentTime : 0;
    if (mix?.gain) {
      applySmoothParam(mix.gain, 0, now, 0.08, false);
    }

    const fadingEntry = { source: src, gain: mix };
    fadingFlameSources.add(fadingEntry);
    src.onended = () => {
      fadingFlameSources.delete(fadingEntry);
      try {
        src.disconnect();
      } catch {
        // Узел уже отключён
      }
      try {
        mix?.disconnect();
      } catch {
        // Узел уже отключён
      }
    };

    try {
      if (typeof src.stop === 'function') {
        src.stop(now + 0.09);
      }
    } catch {
      fadingFlameSources.delete(fadingEntry);
      try {
        src.disconnect();
      } catch {
        // Игнорируем ошибку отсоединения
      }
      try {
        mix?.disconnect();
      } catch {
        // Игнорируем ошибку отсоединения
      }
    }
  };

  const syncFlameSample = (): void => {
    const mustMuteImmediately = disposed || lastMuted || !lastUnlocked || lastSfxVolume <= 0;
    const canPlaySample =
      !mustMuteImmediately &&
      flameIntensity > 0.02 &&
      Boolean(audioCtx) &&
      Boolean(sfxGain) &&
      hasFlameBuffer() &&
      typeof audioCtx?.createBufferSource === 'function';

    if (!canPlaySample) {
      stopFlameSample(mustMuteImmediately);
      if (mustMuteImmediately || hasFlameBuffer()) {
        synth.setFlameIntensity?.(0);
      } else {
        synth.setFlameIntensity?.(flameIntensity);
      }
      return;
    }

    // При наличии живого сэмпла flame_loop процедурный шум пламени отключается
    synth.setFlameIntensity?.(0);

    const active = Math.min(1, flameIntensity);
    const targetMixGain = SAMPLE_MIX_GAINS.flame_loop * (0.45 + active * 0.85);
    const targetRate = 0.94 + active * 0.2;
    const ctx = audioCtx!;
    const now = typeof ctx.currentTime === 'number' ? ctx.currentTime : 0;

    if (flameSource) {
      applySmoothParam(flameSource.playbackRate, targetRate, now, 0.14, false);
      if (flameMixGain) {
        applySmoothParam(flameMixGain.gain, targetMixGain, now, 0.14, false);
      }
      return;
    }

    const flameBuffer = decodedBuffers.get('flame_loop');
    if (!flameBuffer || !sfxGain) return;

    try {
      const source = ctx.createBufferSource();
      source.buffer = flameBuffer;
      source.loop = true;
      if (source.playbackRate && typeof source.playbackRate === 'object') {
        source.playbackRate.value = targetRate;
      }

      let mixGain: GainNode | null = null;
      if (typeof ctx.createGain === 'function') {
        mixGain = ctx.createGain();
        if (mixGain.gain) {
          if (typeof mixGain.gain.setValueAtTime === 'function') {
            mixGain.gain.setValueAtTime(Math.min(0.015, targetMixGain), now);
          }
          applySmoothParam(mixGain.gain, targetMixGain, now, 0.1, false);
        }
        source.connect(mixGain);
        mixGain.connect(sfxGain);
      } else {
        source.connect(sfxGain);
      }

      source.onended = () => {
        try {
          source.disconnect();
        } catch {
          // Узел уже отключён
        }
        try {
          mixGain?.disconnect();
        } catch {
          // Узел уже отключён
        }
        if (flameSource === source) {
          flameSource = null;
          flameMixGain = null;
        }
      };

      flameSource = source;
      flameMixGain = mixGain;
      if (typeof source.start === 'function') {
        source.start(now);
      }
    } catch {
      stopFlameSample(true);
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
      lastSfxVolume = state.sfxVolume;
      lastMusicVolume = state.musicVolume;

      syncFlameSample();

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
      flameIntensity = 0;
      stopFlameSample(true);
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
      } else if (key === 'flame_loop') {
        syncFlameSample();
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

  const playSample = (
    key: Exclude<AudioSampleKey, 'bgm'>,
    playbackRate = 1,
    gainScale = 1,
  ): boolean => {
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

      const mixGainValue = Math.max(0.01, (SAMPLE_MIX_GAINS[key] ?? 0.2) * gainScale);
      let sampleGain: GainNode | null = null;
      if (typeof audioCtx.createGain === 'function') {
        sampleGain = audioCtx.createGain();
        if (sampleGain.gain) {
          sampleGain.gain.value = mixGainValue;
        }
        source.connect(sampleGain);
        sampleGain.connect(sfxGain);
      } else {
        source.connect(sfxGain);
      }

      source.onended = () => {
        try {
          source.disconnect();
        } catch {
          // Узел уже отключён
        }
        try {
          sampleGain?.disconnect();
        } catch {
          // Узел уже отключён
        }
      };

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

  const setMusicMood = (mood: AudioMusicMood): void => {
    if (disposed) return;
    const changed = currentMusicMood !== mood;
    currentMusicMood = mood;
    synth.setMusicMood?.(mood);
    if (changed) {
      applyBgmMood(false);
    }
  };

  const setFlameIntensity = (intensity: number): void => {
    if (disposed) return;
    flameIntensity = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0;
    syncFlameSample();
  };

  const controller: BaliteAudioController = {
    unlock,
    setSettings: (settings) => synth.setSettings(settings),
    getSettings: (): BaliteAudioSettings => synth.getSettings(),
    isMuted: () => synth.isMuted(),
    setMusicMood,
    setFlameIntensity,
    playButton: () => {
      if (!playSample('button', microVariationRate())) synth.playButton();
    },
    playCancel: () => {
      synth.playCancel?.();
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
    playXMultHit: (comboIndex = 0) => {
      const baseRate = computeComboPlaybackRate(comboIndex, false, randomFn);
      // Пониженный плотный удар сэмпла + глубокий саб-удар синтезатора отличают ×Множ от +Множ
      const playedSample = playSample('mult_hit', Math.max(0.68, baseRate * 0.84), 1.15);
      if (!playedSample) {
        synth.playXMultHit?.(comboIndex);
      } else {
        synth.playXMultHit?.(comboIndex);
      }
    },
    playEditionTrigger: (edition: AudioEditionKind, comboIndex = 0) => {
      synth.playEditionTrigger?.(edition, comboIndex);
    },
    playGoldSeal: () => {
      const played = playSample('gold', 1.22, 0.92);
      if (!played) {
        synth.playGoldSeal?.();
      } else {
        synth.playGoldSeal?.();
      }
    },
    playBossIntro: () => {
      synth.playBossIntro?.();
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
    playDialogue: (pitchRate?: number) => {
      const rate =
        typeof pitchRate === 'number' && Number.isFinite(pitchRate)
          ? Math.max(0.65, Math.min(1.45, pitchRate))
          : microVariationRate();
      if (!playSample('dialogue', rate)) synth.playDialogue(rate);
    },
    playForTraceEvent: (event: TraceEvent, comboIndex: number) =>
      dispatchTraceAudioEvent(controller, event, comboIndex),
    dispose: () => synth.dispose(),
  };

  return controller;
}
