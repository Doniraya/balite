import {
  CELESTIAL_IDS,
  RUNE_IDS,
  type ConsumableId,
  type GameSettings,
  type TraceEvent,
} from '../engine/types';
import type { AudioUnlockController } from '../platform/types';

/**
 * Настройки громкости и включения звука для процедурного синтезатора.
 */
export type BaliteAudioSettings = {
  readonly soundEnabled: boolean;
  readonly sfxVolume: number;
  readonly musicVolume: number;
};

/**
 * Настроение динамической модуляции фоновой музыки по игровой фазе (Story 9.1).
 */
export type AudioMusicMood =
  | 'menu'
  | 'battle'
  | 'boss'
  | 'last_hand'
  | 'shop'
  | 'booster'
  | 'victory'
  | 'game_over';

/**
 * Издания карт и Навыков с индивидуальным звуковым откликом.
 */
export type AudioEditionKind = 'foil' | 'holo' | 'polychrome' | 'negative';

/**
 * Публичный интерфейс контроллера процедурного Web Audio синтезатора Balite.
 */
export interface BaliteAudioController {
  unlock(): void;
  setSettings(
    settings: Partial<Pick<GameSettings, 'soundEnabled' | 'sfxVolume' | 'musicVolume'>>,
  ): void;
  getSettings(): BaliteAudioSettings;
  isMuted(): boolean;
  setMusicMood?(mood: AudioMusicMood): void;
  setFlameIntensity?(intensity: number): void;
  playButton(): void;
  playCancel?(): void;
  playCardHover(): void;
  playCardSelect(): void;
  playCardDeselect(): void;
  playCardDeal(): void;
  playChipHit(comboIndex?: number): void;
  playMultHit(comboIndex?: number): void;
  playXMultHit?(comboIndex?: number): void;
  playEditionTrigger?(edition: AudioEditionKind, comboIndex?: number): void;
  playGoldSeal?(): void;
  playBossIntro?(): void;
  playRelicTrigger(comboIndex?: number, isRetriggerAnnounce?: boolean): void;
  playGoldDelta(positive?: boolean): void;
  playBoosterOpen(): void;
  playConsumable(kind?: 'celestial' | 'scroll' | 'rune'): void;
  playFlameThreshold(): void;
  playShatter(): void;
  playDebuff(): void;
  playBuy(): void;
  playReroll(): void;
  playWin(): void;
  playLose(): void;
  playDialogue(pitchRate?: number): void;
  playForTraceEvent(event: TraceEvent, comboIndex: number): void;
  dispose(): void;
}

/** Внутренние хуки расширения контроллера для гибридного аудиодвижка. */
export interface BaliteAudioHooks {
  /** Если возвращает true, процедурный фоновый эмбиент подавляется (например, играет BGM-сэмпл). */
  readonly suppressAmbient?: () => boolean;
  /** Вызывается сразу после ленивого создания графа Web Audio. */
  readonly onContextReady?: (nodes: {
    readonly ctx: AudioContext;
    readonly masterGain: GainNode;
    readonly sfxGain: GainNode;
    readonly musicGain: GainNode;
  }) => void;
  /** Вызывается при каждом обновлении состояния громкости/мьюта/разблокировки. */
  readonly onSyncState?: (state: {
    readonly ctx: AudioContext | null;
    readonly masterGain: GainNode | null;
    readonly sfxGain: GainNode | null;
    readonly musicGain: GainNode | null;
    readonly muted: boolean;
    readonly unlocked: boolean;
    readonly sfxVolume: number;
    readonly musicVolume: number;
  }) => void;
  /** Вызывается при освобождении ресурсов. */
  readonly onDispose?: () => void;
}

type AudioContextConstructor = new () => AudioContext;

interface ToneSpec {
  readonly type: OscillatorType;
  readonly startFreq: number;
  readonly endFreq?: number;
  readonly delay?: number;
  readonly attack?: number;
  readonly duration: number;
  readonly gain: number;
  readonly freqRamp?: 'linear' | 'exponential';
  readonly filterType?: BiquadFilterType;
  readonly filterStartFreq?: number;
  readonly filterEndFreq?: number;
}

interface NoiseSpec {
  readonly delay?: number;
  readonly duration: number;
  readonly gain: number;
  readonly filterType: BiquadFilterType;
  readonly startFreq: number;
  readonly endFreq?: number;
  readonly q?: number;
}

interface AmbientState {
  readonly oscillators: readonly OscillatorNode[];
  readonly nodes: readonly AudioNode[];
  readonly filter: BiquadFilterNode | null;
  readonly mixGain: GainNode;
}

interface FlameLoopState {
  readonly source: AudioBufferSourceNode;
  readonly gainNode: GainNode;
  readonly filterNode: BiquadFilterNode | null;
  readonly nodes: readonly AudioNode[];
}

const DEFAULT_SOUND_ENABLED = true;
const DEFAULT_SFX_VOLUME = 0.8;
const DEFAULT_MUSIC_VOLUME = 0.4;
const VOLUME_CURVE_EXPONENT = 1.85;
const MAX_COMBO_STEP = 64;
const MAX_COMBO_PITCH_RATE = 2;
const MIN_POSITIVE_VALUE = 0.0001;
const CELESTIAL_ID_SET = new Set<string>(CELESTIAL_IDS);
const RUNE_ID_SET = new Set<string>(RUNE_IDS);

/**
 * Преобразует линейное положение ползунка [0..1] в перцептивное усиление (степенная кривая слуха),
 * чтобы низкие и средние значения громкости регулировались плавно и не били по ушам.
 */
export function volumeToGain(volume: number): number {
  const clamped = clampUnit(volume, 0);
  if (clamped <= 0) return 0;
  if (clamped >= 1) return 1;
  return Math.pow(clamped, VOLUME_CURVE_EXPONENT);
}

/**
 * Определяет звуковую категорию расходника по его идентификатору.
 */
export function resolveConsumableSoundKind(
  consumableId: ConsumableId,
): 'celestial' | 'scroll' | 'rune' {
  if (CELESTIAL_ID_SET.has(consumableId)) return 'celestial';
  if (RUNE_ID_SET.has(consumableId)) return 'rune';
  return 'scroll';
}

/**
 * Маршрутизирует событие трассировки на методы BaliteAudioController (общий для synth и hybrid).
 */
export function dispatchTraceAudioEvent(
  audio: BaliteAudioController,
  event: TraceEvent,
  comboIndex: number,
): void {
  switch (event.type) {
    case 'CARD_TRIGGER': {
      if (event.isEditionStep) {
        if (
          event.edition === 'foil' ||
          event.edition === 'holo' ||
          event.edition === 'polychrome' ||
          event.edition === 'negative'
        ) {
          if (audio.playEditionTrigger) {
            audio.playEditionTrigger(event.edition, comboIndex);
          } else if (event.edition === 'holo' || event.edition === 'polychrome') {
            audio.playMultHit(comboIndex);
          } else {
            audio.playRelicTrigger(comboIndex);
          }
        } else {
          audio.playRelicTrigger(comboIndex);
        }
      } else if (event.xMult !== undefined && event.xMult !== 1) {
        if (audio.playXMultHit) {
          audio.playXMultHit(comboIndex);
        } else {
          audio.playMultHit(comboIndex);
        }
      } else if (event.multDelta && event.multDelta !== 0) {
        audio.playMultHit(comboIndex);
      } else if (event.dollarsDelta && event.dollarsDelta !== 0) {
        if (event.seal === 'gold' && event.dollarsDelta > 0 && audio.playGoldSeal) {
          audio.playGoldSeal();
        } else {
          audio.playGoldDelta(event.dollarsDelta > 0);
        }
      } else {
        audio.playChipHit(comboIndex);
      }
      return;
    }
    case 'HAND_CARD_TRIGGER':
    case 'RELIC_TRIGGER': {
      if (event.xMult !== undefined && event.xMult !== 1) {
        if (audio.playXMultHit) {
          audio.playXMultHit(comboIndex);
        } else {
          audio.playMultHit(comboIndex);
        }
      } else if (event.multDelta && event.multDelta !== 0) {
        audio.playMultHit(comboIndex);
      } else if (event.dollarsDelta && event.dollarsDelta !== 0) {
        audio.playGoldDelta(event.dollarsDelta > 0);
      } else if ('chipsDelta' in event && event.chipsDelta && event.chipsDelta !== 0) {
        audio.playChipHit(comboIndex);
      } else {
        const isRetriggerAnnounce =
          event.type === 'RELIC_TRIGGER' && event.locKey === 'card_retrigger';
        audio.playRelicTrigger(comboIndex, isRetriggerAnnounce);
      }
      return;
    }
    case 'CONSUMABLE_TRIGGER': {
      if (event.locKey === 'consumable_nope') {
        audio.playDebuff();
      } else {
        audio.playConsumable(resolveConsumableSoundKind(event.consumableId));
      }
      return;
    }
    case 'SCORE_UPDATE': {
      if (event.handScore > 0) {
        audio.playChipHit(comboIndex);
      }
      return;
    }
    case 'DOLLAR_DELTA': {
      if (event.delta !== 0) {
        audio.playGoldDelta(event.delta > 0);
      }
      return;
    }
    case 'CARD_SHATTER': {
      audio.playShatter();
      return;
    }
    case 'CARD_ENHANCEMENT_STRIPPED': {
      audio.playDebuff();
      return;
    }
    case 'RELIC_DESTROYED': {
      if (event.reason === 'sold') {
        audio.playGoldDelta(true);
      } else {
        audio.playShatter();
      }
      return;
    }
    case 'CARD_DEBUFFED':
    case 'HAND_DEBUFFED': {
      audio.playDebuff();
      return;
    }
    case 'BOSS_TRIGGER': {
      if (event.locKey === 'boss_disabled') {
        audio.playRelicTrigger(comboIndex);
      } else {
        audio.playDebuff();
      }
      return;
    }
    case 'TAG_TRIGGER': {
      if (event.locKey === 'tag_fizzled') {
        audio.playDebuff();
      } else {
        audio.playRelicTrigger(comboIndex);
      }
      return;
    }
    case 'HAND_LEVEL_UP': {
      audio.playRelicTrigger(comboIndex);
      return;
    }
    case 'BLIND_DEFEATED':
    case 'RUN_WON': {
      audio.playWin();
      return;
    }
    case 'RUN_LOST': {
      audio.playLose();
      return;
    }
    case 'PHASE_CHANGED': {
      if (event.to === 'playing' || event.to === 'shop' || event.to === 'booster') {
        audio.playCardDeal();
      } else if (event.to === 'blind_select' || event.to === 'cashout') {
        audio.playButton();
      }
      return;
    }
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

function clampUnit(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function clampComboStep(comboIndex: number | undefined): number {
  if (typeof comboIndex !== 'number' || !Number.isFinite(comboIndex)) {
    return 0;
  }
  const floored = Math.floor(comboIndex);
  if (floored <= 0) return 0;
  if (floored >= MAX_COMBO_STEP) return MAX_COMBO_STEP;
  return floored;
}

/**
 * Линейная формула нарастания питча оригинала Balatro (common_events.lua:780-892):
 * percent = 0.3 + step * 0.08, pitch = 0.8 + percent * 0.2 = 0.86 + step * 0.016.
 * Для анонса ретриггера ('Again!') без лесенки используется случайный pitch 0.98..1.02.
 */
export function computeBalatroComboPitch(
  comboIndex = 0,
  isRetriggerAnnounce = false,
  randomFn: () => number = Math.random,
): number {
  if (isRetriggerAnnounce) {
    const raw = randomFn();
    const r = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.5;
    const percent = 0.9 + 0.2 * r;
    return 0.8 + percent * 0.2;
  }
  const step = clampComboStep(comboIndex);
  const percent = 0.3 + step * 0.08;
  return Math.min(MAX_COMBO_PITCH_RATE, 0.8 + percent * 0.2);
}

function comboPitchFactor(comboIndex: number | undefined, isRetriggerAnnounce = false): number {
  return computeBalatroComboPitch(comboIndex ?? 0, isRetriggerAnnounce);
}

function getAudioContextConstructor(): AudioContextConstructor | null {
  const g = globalThis as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  if (typeof g.AudioContext === 'function') {
    return g.AudioContext;
  }
  if (typeof g.webkitAudioContext === 'function') {
    return g.webkitAudioContext;
  }
  if (typeof window !== 'undefined') {
    const w = window as unknown as {
      AudioContext?: AudioContextConstructor;
      webkitAudioContext?: AudioContextConstructor;
    };
    if (typeof w.AudioContext === 'function') {
      return w.AudioContext;
    }
    if (typeof w.webkitAudioContext === 'function') {
      return w.webkitAudioContext;
    }
  }
  return null;
}

function getSafeTime(ctx: AudioContext): number {
  return typeof ctx.currentTime === 'number' && Number.isFinite(ctx.currentTime)
    ? ctx.currentTime
    : 0;
}

function setParamImmediate(param: AudioParam | undefined, value: number, now: number): void {
  if (!param) return;
  try {
    if (typeof param.cancelScheduledValues === 'function') {
      param.cancelScheduledValues(now);
    }
    if (typeof param.setValueAtTime === 'function') {
      param.setValueAtTime(value, now);
    }
    param.value = value;
  } catch {
    try {
      param.value = value;
    } catch {
      // Игнорируем ограничения read-only свойств у тестовых заглушек
    }
  }
}

function scheduleParamRamp(
  param: AudioParam | undefined,
  startValue: number,
  endValue: number,
  startTime: number,
  endTime: number,
  mode: 'linear' | 'exponential',
): void {
  if (!param) return;
  try {
    if (typeof param.setValueAtTime === 'function') {
      param.setValueAtTime(startValue, startTime);
    } else {
      param.value = startValue;
    }
    if (mode === 'exponential' && typeof param.exponentialRampToValueAtTime === 'function') {
      param.exponentialRampToValueAtTime(Math.max(endValue, MIN_POSITIVE_VALUE), endTime);
    } else if (typeof param.linearRampToValueAtTime === 'function') {
      param.linearRampToValueAtTime(endValue, endTime);
    }
  } catch {
    // Безопасно пропускаем ошибки автоматизации параметров
  }
}

function scheduleEnvelope(
  gainNode: GainNode,
  peakGain: number,
  startTime: number,
  attackSec: number,
  durationSec: number,
): void {
  const param = gainNode.gain;
  if (!param) return;

  const attackEnd = startTime + Math.min(attackSec, durationSec * 0.4);
  const endTime = startTime + durationSec;

  try {
    if (typeof param.setValueAtTime === 'function') {
      param.setValueAtTime(MIN_POSITIVE_VALUE, startTime);
    } else {
      param.value = peakGain;
    }

    if (typeof param.linearRampToValueAtTime === 'function') {
      param.linearRampToValueAtTime(Math.max(peakGain, MIN_POSITIVE_VALUE), attackEnd);
    }

    if (typeof param.exponentialRampToValueAtTime === 'function') {
      param.exponentialRampToValueAtTime(MIN_POSITIVE_VALUE, endTime);
    } else if (typeof param.linearRampToValueAtTime === 'function') {
      param.linearRampToValueAtTime(0, endTime);
    }
  } catch {
    // Игнорируем несовместимость мока AudioParam
  }
}

function scheduleNoteSequence(
  ctx: AudioContext,
  destination: AudioNode,
  notes: readonly number[],
  options: {
    readonly stepSec: number;
    readonly duration: number;
    readonly lastDuration?: number;
    readonly gain: number;
    readonly type: OscillatorType;
    readonly lastType?: OscillatorType;
    readonly attack?: number;
    readonly filterStartFreq?: number;
    readonly filterEndFreq?: number;
  },
): void {
  notes.forEach((freq, idx) => {
    const isLast = idx === notes.length - 1;
    scheduleTone(ctx, destination, {
      type: isLast && options.lastType ? options.lastType : options.type,
      startFreq: freq,
      delay: idx * options.stepSec,
      duration: isLast && options.lastDuration !== undefined ? options.lastDuration : options.duration,
      attack: options.attack ?? 0.004,
      gain: options.gain,
      ...(options.filterStartFreq !== undefined
        ? {
            filterType: 'lowpass' as const,
            filterStartFreq: options.filterStartFreq,
            filterEndFreq: options.filterEndFreq,
          }
        : {}),
    });
  });
}

function safeDisconnect(node: { disconnect?: () => void } | null | undefined): void {
  if (!node || typeof node.disconnect !== 'function') return;
  try {
    node.disconnect();
  } catch {
    // Узел уже мог быть отключён
  }
}

function createNoiseBuffer(ctx: AudioContext): AudioBuffer | null {
  if (typeof ctx.createBuffer !== 'function') return null;
  try {
    const sampleRate =
      typeof ctx.sampleRate === 'number' && Number.isFinite(ctx.sampleRate) && ctx.sampleRate > 0
        ? ctx.sampleRate
        : 44100;
    const length = Math.max(1, Math.floor(sampleRate * 0.4));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    if (typeof buffer.getChannelData === 'function') {
      const data = buffer.getChannelData(0);
      // Детерминированный LCG для процедурного белого шума без зависимости от Math.random
      let seed = 0x51a7b39f;
      for (let i = 0; i < data.length; i += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        data[i] = (seed >>> 0) / 2147483648 - 1;
      }
    }
    return buffer;
  } catch {
    return null;
  }
}

function scheduleTone(ctx: AudioContext, destination: AudioNode, spec: ToneSpec): void {
  if (typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') {
    return;
  }

  try {
    const now = getSafeTime(ctx);
    const startTime = now + Math.max(0, spec.delay ?? 0);
    const duration = Math.max(0.015, spec.duration);
    const endTime = startTime + duration;
    const attack = spec.attack ?? 0.005;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = spec.type;
    if (osc.frequency) {
      osc.frequency.value = spec.startFreq;
    }

    if (spec.endFreq !== undefined && spec.endFreq !== spec.startFreq) {
      scheduleParamRamp(
        osc.frequency,
        spec.startFreq,
        spec.endFreq,
        startTime,
        endTime,
        spec.freqRamp ?? 'exponential',
      );
    } else if (osc.frequency && typeof osc.frequency.setValueAtTime === 'function') {
      osc.frequency.setValueAtTime(spec.startFreq, startTime);
    }

    scheduleEnvelope(env, spec.gain, startTime, attack, duration);

    let filter: BiquadFilterNode | null = null;
    if (spec.filterType && typeof ctx.createBiquadFilter === 'function') {
      filter = ctx.createBiquadFilter();
      filter.type = spec.filterType;
      const filterStart = spec.filterStartFreq ?? 1200;
      if (filter.frequency) {
        filter.frequency.value = filterStart;
      }
      if (spec.filterEndFreq !== undefined && spec.filterEndFreq !== filterStart) {
        scheduleParamRamp(
          filter.frequency,
          filterStart,
          spec.filterEndFreq,
          startTime,
          endTime,
          'exponential',
        );
      }
      osc.connect(filter);
      filter.connect(env);
    } else {
      osc.connect(env);
    }

    env.connect(destination);

    osc.onended = () => {
      safeDisconnect(osc);
      safeDisconnect(filter);
      safeDisconnect(env);
    };

    if (typeof osc.start === 'function') {
      osc.start(startTime);
    }
    if (typeof osc.stop === 'function') {
      osc.stop(endTime + 0.02);
    }
  } catch {
    // Предохранитель от неполной реализации Web Audio в окружении запуска
  }
}

function scheduleNoiseBurst(
  ctx: AudioContext,
  destination: AudioNode,
  noiseBuffer: AudioBuffer | null,
  spec: NoiseSpec,
): void {
  if (
    !noiseBuffer ||
    typeof ctx.createBufferSource !== 'function' ||
    typeof ctx.createGain !== 'function'
  ) {
    return;
  }

  try {
    const now = getSafeTime(ctx);
    const startTime = now + Math.max(0, spec.delay ?? 0);
    const duration = Math.max(0.015, spec.duration);
    const endTime = startTime + duration;

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const env = ctx.createGain();
    scheduleEnvelope(env, spec.gain, startTime, 0.004, duration);

    let filter: BiquadFilterNode | null = null;
    if (typeof ctx.createBiquadFilter === 'function') {
      filter = ctx.createBiquadFilter();
      filter.type = spec.filterType;
      if (filter.frequency) {
        filter.frequency.value = spec.startFreq;
      }
      if (filter.Q && spec.q !== undefined) {
        filter.Q.value = spec.q;
      }
      if (spec.endFreq !== undefined && spec.endFreq !== spec.startFreq) {
        scheduleParamRamp(
          filter.frequency,
          spec.startFreq,
          spec.endFreq,
          startTime,
          endTime,
          'exponential',
        );
      }
      source.connect(filter);
      filter.connect(env);
    } else {
      source.connect(env);
    }

    env.connect(destination);

    source.onended = () => {
      safeDisconnect(source);
      safeDisconnect(filter);
      safeDisconnect(env);
    };

    if (typeof source.start === 'function') {
      source.start(startTime);
    }
    if (typeof source.stop === 'function') {
      source.stop(endTime + 0.02);
    }
  } catch {
    // Безопасная деградация при ограничениях аудио-драйвера
  }
}

/**
 * Создаёт процедурный Web Audio синтезатор Balite с ленивой инициализацией AudioContext
 * и полной синхронизацией мьюта с платформенным AudioUnlockController.
 */
export function createBaliteAudio(
  platformAudio?: AudioUnlockController,
  initialSettings?: Partial<Pick<GameSettings, 'soundEnabled' | 'sfxVolume' | 'musicVolume'>>,
  hooks?: BaliteAudioHooks,
): BaliteAudioController {
  let soundEnabled =
    typeof initialSettings?.soundEnabled === 'boolean'
      ? initialSettings.soundEnabled
      : DEFAULT_SOUND_ENABLED;
  let sfxVolume = clampUnit(initialSettings?.sfxVolume, DEFAULT_SFX_VOLUME);
  let musicVolume = clampUnit(initialSettings?.musicVolume, DEFAULT_MUSIC_VOLUME);

  let platformMuted = platformAudio?.isMutedByPlatform() ?? false;
  let unlocked = false;
  let disposed = false;

  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let sfxGain: GainNode | null = null;
  let musicGain: GainNode | null = null;
  let cachedNoiseBuffer: AudioBuffer | null = null;
  let ambient: AmbientState | null = null;
  let flameLoop: FlameLoopState | null = null;
  let musicMood: AudioMusicMood = 'menu';
  let flameIntensity = 0;
  let unsubscribeMute: (() => void) | null = null;

  const isMuted = (): boolean =>
    disposed || !soundEnabled || platformMuted || Boolean(platformAudio?.isMutedByPlatform());

  const stopFlameLoop = (): void => {
    if (!flameLoop) return;
    try {
      if (typeof flameLoop.source.stop === 'function') {
        flameLoop.source.stop();
      }
    } catch {
      // Источник шума уже остановлен
    }
    for (const node of flameLoop.nodes) {
      safeDisconnect(node);
    }
    flameLoop = null;
  };

  const syncFlameLoop = (): void => {
    const activeIntensity =
      disposed || !unlocked || isMuted() || sfxVolume <= 0 || flameIntensity <= 0.02
        ? 0
        : Math.min(1, flameIntensity);

    if (activeIntensity <= 0 || !ctx || !sfxGain) {
      stopFlameLoop();
      return;
    }

    const now = getSafeTime(ctx);
    const targetGain = 0.02 + activeIntensity * 0.048;
    const targetFilterFreq = 460 + activeIntensity * 900;

    if (flameLoop) {
      setParamImmediate(flameLoop.gainNode.gain, targetGain, now);
      if (flameLoop.filterNode?.frequency) {
        setParamImmediate(flameLoop.filterNode.frequency, targetFilterFreq, now);
      }
      return;
    }

    if (
      !cachedNoiseBuffer ||
      typeof ctx.createBufferSource !== 'function' ||
      typeof ctx.createGain !== 'function'
    ) {
      return;
    }

    try {
      const nodes: AudioNode[] = [];
      const source = ctx.createBufferSource();
      source.buffer = cachedNoiseBuffer;
      source.loop = true;
      nodes.push(source);

      const gainNode = ctx.createGain();
      setParamImmediate(gainNode.gain, targetGain, now);
      nodes.push(gainNode);

      let filterNode: BiquadFilterNode | null = null;
      if (typeof ctx.createBiquadFilter === 'function') {
        filterNode = ctx.createBiquadFilter();
        filterNode.type = 'bandpass';
        if (filterNode.frequency) {
          filterNode.frequency.value = targetFilterFreq;
        }
        if (filterNode.Q) {
          filterNode.Q.value = 1.05;
        }
        source.connect(filterNode);
        filterNode.connect(gainNode);
        nodes.push(filterNode);
      } else {
        source.connect(gainNode);
      }

      gainNode.connect(sfxGain);
      if (typeof source.start === 'function') {
        source.start(now);
      }

      flameLoop = {
        source,
        gainNode,
        filterNode,
        nodes,
      };
    } catch {
      stopFlameLoop();
    }
  };

  const applyAmbientMood = (): void => {
    if (!ambient || !ctx) return;
    const now = getSafeTime(ctx);
    const moodFreq: Record<AudioMusicMood, number> = {
      menu: 340,
      battle: 360,
      boss: 480,
      last_hand: 520,
      shop: 280,
      booster: 250,
      victory: 440,
      game_over: 190,
    };
    if (ambient.filter?.frequency) {
      setParamImmediate(ambient.filter.frequency, moodFreq[musicMood], now);
    }
  };

  const stopAmbient = (): void => {
    if (!ambient) return;
    for (const osc of ambient.oscillators) {
      try {
        if (typeof osc.stop === 'function') {
          osc.stop();
        }
      } catch {
        // Осциллятор уже мог остановиться
      }
      safeDisconnect(osc);
    }
    for (const node of ambient.nodes) {
      safeDisconnect(node);
    }
    ambient = null;
  };

  const startAmbient = (): void => {
    if (
      ambient ||
      disposed ||
      !unlocked ||
      !ctx ||
      !musicGain ||
      isMuted() ||
      musicVolume <= 0 ||
      hooks?.suppressAmbient?.()
    ) {
      return;
    }

    if (typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') {
      return;
    }

    try {
      const now = getSafeTime(ctx);
      const oscillators: OscillatorNode[] = [];
      const nodes: AudioNode[] = [];

      // Мягкий средневеково-алхимический аккорд (A2 + E3 + C4) с плавным входом и тёплой фильтрацией
      const mixGain = ctx.createGain();
      setParamImmediate(mixGain.gain, MIN_POSITIVE_VALUE, now);
      if (typeof mixGain.gain.linearRampToValueAtTime === 'function') {
        mixGain.gain.linearRampToValueAtTime(0.055, now + 1.2);
      } else {
        mixGain.gain.value = 0.055;
      }
      nodes.push(mixGain);

      let destinationForPad: AudioNode = mixGain;
      let filterRef: BiquadFilterNode | null = null;
      if (typeof ctx.createBiquadFilter === 'function') {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        if (filter.frequency) {
          filter.frequency.value = 340;
        }
        filter.connect(mixGain);
        nodes.push(filter);
        destinationForPad = filter;
        filterRef = filter;
      }

      mixGain.connect(musicGain);

      const droneSpecs: ReadonlyArray<{ type: OscillatorType; freq: number }> = [
        { type: 'sine', freq: 110 },
        { type: 'triangle', freq: 164.81 },
        { type: 'sine', freq: 261.63 },
      ];

      for (const drone of droneSpecs) {
        const osc = ctx.createOscillator();
        osc.type = drone.type;
        if (osc.frequency) {
          osc.frequency.value = drone.freq;
        }
        osc.connect(destinationForPad);
        if (typeof osc.start === 'function') {
          osc.start(now);
        }
        oscillators.push(osc);
        nodes.push(osc);
      }

      const lfo = ctx.createOscillator();
      const lfoDepth = ctx.createGain();
      lfo.type = 'sine';
      if (lfo.frequency) {
        lfo.frequency.value = 0.075;
      }
      if (filterRef && filterRef.frequency) {
        setParamImmediate(lfoDepth.gain, 95, now);
        lfo.connect(lfoDepth);
        lfoDepth.connect(filterRef.frequency);
      } else {
        setParamImmediate(lfoDepth.gain, 0.015, now);
        lfo.connect(lfoDepth);
        lfoDepth.connect(mixGain.gain);
      }
      if (typeof lfo.start === 'function') {
        lfo.start(now);
      }
      oscillators.push(lfo);
      nodes.push(lfo, lfoDepth);

      ambient = { oscillators, nodes, filter: filterRef, mixGain };
      applyAmbientMood();
    } catch {
      stopAmbient();
    }
  };

  const tryResumeContext = (audioCtx: AudioContext): void => {
    if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
      try {
        const promise = audioCtx.resume();
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => {});
        }
      } catch {
        // Игнорируем отказ автоплея до жеста пользователя
      }
    }
  };

  const syncOutputState = (): void => {
    const muted = isMuted();

    if (ctx && masterGain && sfxGain && musicGain) {
      const now = getSafeTime(ctx);
      setParamImmediate(masterGain.gain, muted ? 0 : 1, now);
      setParamImmediate(sfxGain.gain, volumeToGain(sfxVolume), now);
      setParamImmediate(musicGain.gain, muted ? 0 : volumeToGain(musicVolume), now);
    }

    if (muted || !unlocked || musicVolume <= 0 || disposed || hooks?.suppressAmbient?.()) {
      stopAmbient();
    } else if (ctx) {
      tryResumeContext(ctx);
      startAmbient();
    }

    syncFlameLoop();

    hooks?.onSyncState?.({
      ctx,
      masterGain,
      sfxGain,
      musicGain,
      muted,
      unlocked,
      sfxVolume,
      musicVolume,
    });
  };

  const ensureContext = (): AudioContext | null => {
    if (disposed) return null;
    if (ctx && ctx.state !== 'closed') return ctx;

    const AudioCtxCtor = getAudioContextConstructor();
    if (!AudioCtxCtor) return null;

    try {
      const created = new AudioCtxCtor();
      if (
        typeof created.createGain !== 'function' ||
        typeof created.createOscillator !== 'function' ||
        !created.destination
      ) {
        return null;
      }

      const master = created.createGain();
      const sfx = created.createGain();
      const music = created.createGain();

      master.connect(created.destination);
      sfx.connect(master);
      music.connect(master);

      ctx = created;
      masterGain = master;
      sfxGain = sfx;
      musicGain = music;
      cachedNoiseBuffer = createNoiseBuffer(created);

      syncOutputState();
      hooks?.onContextReady?.({
        ctx: created,
        masterGain: master,
        sfxGain: sfx,
        musicGain: music,
      });
      platformAudio?.registerContext(created);
      return created;
    } catch {
      ctx = null;
      masterGain = null;
      sfxGain = null;
      musicGain = null;
      cachedNoiseBuffer = null;
      return null;
    }
  };

  if (platformAudio) {
    unsubscribeMute = platformAudio.subscribeMute((muted) => {
      if (disposed) return;
      platformMuted = muted;
      syncOutputState();
    });
  }

  /**
   * Подготавливает ленивый контекст и проверяет, можно ли сейчас синтезировать эффект.
   */
  const prepareSfx = (): { readonly ctx: AudioContext; readonly dest: GainNode } | null => {
    if (disposed || !unlocked || sfxVolume <= 0 || isMuted()) {
      return null;
    }
    const audioCtx = ensureContext();
    if (!audioCtx || !sfxGain || isMuted()) {
      return null;
    }
    tryResumeContext(audioCtx);
    return { ctx: audioCtx, dest: sfxGain };
  };

  const unlock = (): void => {
    if (disposed) return;
    unlocked = true;
    const audioCtx = ensureContext();
    platformAudio?.unlock();
    if (audioCtx && !isMuted()) {
      tryResumeContext(audioCtx);
    }
    syncOutputState();
  };

  const setSettings = (
    settings: Partial<Pick<GameSettings, 'soundEnabled' | 'sfxVolume' | 'musicVolume'>>,
  ): void => {
    if (disposed) return;
    if (typeof settings.soundEnabled === 'boolean') {
      soundEnabled = settings.soundEnabled;
    }
    if (settings.sfxVolume !== undefined) {
      sfxVolume = clampUnit(settings.sfxVolume, sfxVolume);
    }
    if (settings.musicVolume !== undefined) {
      musicVolume = clampUnit(settings.musicVolume, musicVolume);
    }
    syncOutputState();
  };

  const getSettings = (): BaliteAudioSettings => ({
    soundEnabled,
    sfxVolume,
    musicVolume,
  });

  const setMusicMood = (mood: AudioMusicMood): void => {
    if (disposed || musicMood === mood) return;
    musicMood = mood;
    applyAmbientMood();
  };

  const setFlameIntensity = (intensity: number): void => {
    if (disposed) return;
    flameIntensity = clampUnit(intensity, 0);
    syncFlameLoop();
  };

  const playButton = (): void => {
    const out = prepareSfx();
    if (!out) return;
    scheduleTone(out.ctx, out.dest, {
      type: 'triangle',
      startFreq: 520,
      endFreq: 260,
      duration: 0.045,
      attack: 0.005,
      gain: 0.14,
      filterType: 'lowpass',
      filterStartFreq: 1600,
      filterEndFreq: 900,
    });
  };

  const playCancel = (): void => {
    const out = prepareSfx();
    if (!out) return;
    scheduleTone(out.ctx, out.dest, {
      type: 'triangle',
      startFreq: 230,
      endFreq: 145,
      duration: 0.075,
      attack: 0.003,
      gain: 0.12,
      filterType: 'lowpass',
      filterStartFreq: 720,
      filterEndFreq: 320,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'sine',
      startFreq: 170,
      endFreq: 118,
      delay: 0.04,
      duration: 0.08,
      attack: 0.003,
      gain: 0.09,
    });
  };

  const playCardHover = (): void => {
    const out = prepareSfx();
    if (!out) return;
    scheduleTone(out.ctx, out.dest, {
      type: 'sine',
      startFreq: 680,
      endFreq: 800,
      duration: 0.024,
      attack: 0.004,
      gain: 0.028,
    });
    scheduleNoiseBurst(out.ctx, out.dest, cachedNoiseBuffer, {
      duration: 0.02,
      gain: 0.018,
      filterType: 'bandpass',
      startFreq: 2200,
      endFreq: 2900,
      q: 1.6,
    });
  };

  const playCardSelect = (): void => {
    const out = prepareSfx();
    if (!out) return;
    scheduleTone(out.ctx, out.dest, {
      type: 'sine',
      startFreq: 350,
      endFreq: 540,
      duration: 0.06,
      attack: 0.003,
      gain: 0.16,
    });
    scheduleNoiseBurst(out.ctx, out.dest, cachedNoiseBuffer, {
      duration: 0.03,
      gain: 0.06,
      filterType: 'bandpass',
      startFreq: 1800,
      endFreq: 2600,
      q: 1.4,
    });
  };

  const playCardDeselect = (): void => {
    const out = prepareSfx();
    if (!out) return;
    scheduleTone(out.ctx, out.dest, {
      type: 'sine',
      startFreq: 440,
      endFreq: 280,
      duration: 0.055,
      attack: 0.003,
      gain: 0.14,
    });
  };

  const playCardDeal = (): void => {
    const out = prepareSfx();
    if (!out) return;
    scheduleTone(out.ctx, out.dest, {
      type: 'triangle',
      startFreq: 240,
      endFreq: 135,
      duration: 0.05,
      attack: 0.002,
      gain: 0.13,
    });
    scheduleNoiseBurst(out.ctx, out.dest, cachedNoiseBuffer, {
      duration: 0.055,
      gain: 0.11,
      filterType: 'bandpass',
      startFreq: 1400,
      endFreq: 2500,
      q: 1.2,
    });
  };

  const playChipHit = (comboIndex = 0): void => {
    const out = prepareSfx();
    if (!out) return;
    const pitch = comboPitchFactor(comboIndex);
    scheduleTone(out.ctx, out.dest, {
      type: 'triangle',
      startFreq: 520 * pitch,
      endFreq: 680 * pitch,
      duration: 0.09,
      attack: 0.003,
      gain: 0.2,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'sine',
      startFreq: 1040 * pitch,
      endFreq: 1320 * pitch,
      duration: 0.07,
      attack: 0.002,
      gain: 0.09,
    });
  };

  const playMultHit = (comboIndex = 0): void => {
    const out = prepareSfx();
    if (!out) return;
    const step = clampComboStep(comboIndex);
    const pitch = comboPitchFactor(step);

    // Фирменный ударный аккорд с повышением тона по цепочке комбо
    scheduleTone(out.ctx, out.dest, {
      type: 'sawtooth',
      startFreq: 330 * pitch,
      duration: 0.18,
      attack: 0.005,
      gain: 0.14,
      filterType: 'lowpass',
      filterStartFreq: 1800 * pitch,
      filterEndFreq: 650 * pitch,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'triangle',
      startFreq: 495 * pitch,
      duration: 0.17,
      attack: 0.006,
      gain: 0.13,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'sine',
      startFreq: 660 * pitch,
      duration: 0.2,
      attack: 0.004,
      gain: 0.12,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'sine',
      startFreq: 165 * (1 + step * 0.015),
      endFreq: 68,
      duration: 0.12,
      attack: 0.002,
      gain: 0.22,
    });
  };

  const playXMultHit = (comboIndex = 0): void => {
    const out = prepareSfx();
    if (!out) return;
    const step = clampComboStep(comboIndex);
    const pitch = comboPitchFactor(step);

    // Более глубокий и мощный удар для ×Множ (отчётливо отделяется от +Множ на слух)
    scheduleTone(out.ctx, out.dest, {
      type: 'sine',
      startFreq: 138 * (1 + step * 0.012),
      endFreq: 46,
      duration: 0.22,
      attack: 0.002,
      gain: 0.25,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'sawtooth',
      startFreq: 246.94 * pitch,
      endFreq: 293.66 * pitch,
      duration: 0.24,
      attack: 0.005,
      gain: 0.15,
      filterType: 'lowpass',
      filterStartFreq: 2400 * pitch,
      filterEndFreq: 720 * pitch,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'triangle',
      startFreq: 493.88 * pitch,
      duration: 0.22,
      attack: 0.004,
      gain: 0.13,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'sine',
      startFreq: 987.77 * pitch,
      delay: 0.025,
      duration: 0.19,
      attack: 0.003,
      gain: 0.1,
    });
  };

  const playEditionTrigger = (edition: AudioEditionKind, comboIndex = 0): void => {
    const out = prepareSfx();
    if (!out) return;
    const pitch = comboPitchFactor(comboIndex);

    if (edition === 'foil') {
      // Тиснёное: звонкий металлический серебряный блик
      scheduleNoteSequence(out.ctx, out.dest, [1174.66 * pitch, 1567.98 * pitch], {
        stepSec: 0.032,
        duration: 0.11,
        lastDuration: 0.18,
        gain: 0.13,
        type: 'triangle',
        lastType: 'sine',
        attack: 0.002,
      });
      scheduleNoiseBurst(out.ctx, out.dest, cachedNoiseBuffer, {
        duration: 0.075,
        gain: 0.06,
        filterType: 'highpass',
        startFreq: 3200,
        endFreq: 5200,
      });
      return;
    }

    if (edition === 'holo') {
      // Радужное: воздушный сияющий трезвучный перелив
      scheduleNoteSequence(
        out.ctx,
        out.dest,
        [587.33 * pitch, 739.99 * pitch, 1174.66 * pitch],
        {
          stepSec: 0.038,
          duration: 0.12,
          lastDuration: 0.22,
          gain: 0.13,
          type: 'sine',
          attack: 0.005,
        },
      );
      return;
    }

    if (edition === 'polychrome') {
      // Призматическое: богатый кристальный аккорд с глубиной
      scheduleTone(out.ctx, out.dest, {
        type: 'sine',
        startFreq: 196 * pitch,
        endFreq: 98,
        duration: 0.18,
        attack: 0.004,
        gain: 0.16,
      });
      scheduleNoteSequence(
        out.ctx,
        out.dest,
        [523.25 * pitch, 659.25 * pitch, 987.77 * pitch, 1318.51 * pitch],
        {
          stepSec: 0.034,
          duration: 0.12,
          lastDuration: 0.26,
          gain: 0.12,
          type: 'triangle',
          lastType: 'sine',
          attack: 0.004,
        },
      );
      return;
    }

    // Теневое (negative): таинственный глубокий обратный импульс
    scheduleTone(out.ctx, out.dest, {
      type: 'sawtooth',
      startFreq: 311.13 * pitch,
      endFreq: 155.56 * pitch,
      duration: 0.22,
      attack: 0.015,
      gain: 0.12,
      filterType: 'lowpass',
      filterStartFreq: 420,
      filterEndFreq: 1400,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'sine',
      startFreq: 466.16 * pitch,
      endFreq: 233.08 * pitch,
      delay: 0.03,
      duration: 0.2,
      attack: 0.01,
      gain: 0.1,
    });
  };

  const playGoldSeal = (): void => {
    const out = prepareSfx();
    if (!out) return;
    scheduleNoteSequence(out.ctx, out.dest, [1046.5, 1318.51, 1567.98], {
      stepSec: 0.036,
      duration: 0.1,
      lastDuration: 0.2,
      gain: 0.15,
      type: 'sine',
      attack: 0.002,
    });
  };

  const playBossIntro = (): void => {
    const out = prepareSfx();
    if (!out) return;
    // Короткий джингл выхода Босса-монстра: литавры + тёмный медный акцент
    scheduleTone(out.ctx, out.dest, {
      type: 'sine',
      startFreq: 110,
      endFreq: 52,
      duration: 0.34,
      attack: 0.004,
      gain: 0.24,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'sawtooth',
      startFreq: 146.83,
      endFreq: 138.59,
      delay: 0.02,
      duration: 0.38,
      attack: 0.012,
      gain: 0.13,
      filterType: 'lowpass',
      filterStartFreq: 950,
      filterEndFreq: 280,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'triangle',
      startFreq: 220,
      delay: 0.11,
      duration: 0.28,
      attack: 0.008,
      gain: 0.11,
    });
    scheduleNoiseBurst(out.ctx, out.dest, cachedNoiseBuffer, {
      duration: 0.16,
      gain: 0.08,
      filterType: 'lowpass',
      startFreq: 480,
      endFreq: 140,
    });
  };

  const playRelicTrigger = (comboIndex = 0, isRetriggerAnnounce = false): void => {
    const out = prepareSfx();
    if (!out) return;
    const pitch = comboPitchFactor(comboIndex, isRetriggerAnnounce);
    scheduleTone(out.ctx, out.dest, {
      type: 'sine',
      startFreq: 587.33 * pitch,
      duration: 0.14,
      attack: 0.004,
      gain: 0.16,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'triangle',
      startFreq: 880 * pitch,
      delay: 0.04,
      duration: 0.17,
      attack: 0.004,
      gain: 0.14,
    });
  };

  const playGoldDelta = (positive = true): void => {
    const out = prepareSfx();
    if (!out) return;
    if (positive) {
      scheduleNoteSequence(out.ctx, out.dest, [987.77, 1318.51], {
        stepSec: 0.045,
        duration: 0.09,
        lastDuration: 0.16,
        gain: 0.17,
        type: 'sine',
        attack: 0.003,
      });
      return;
    }

    scheduleNoteSequence(out.ctx, out.dest, [523.25, 349.23], {
      stepSec: 0.045,
      duration: 0.08,
      lastDuration: 0.12,
      gain: 0.135,
      type: 'triangle',
      attack: 0.003,
    });
  };

  const playBoosterOpen = (): void => {
    const out = prepareSfx();
    if (!out) return;
    scheduleNoiseBurst(out.ctx, out.dest, cachedNoiseBuffer, {
      duration: 0.11,
      gain: 0.09,
      filterType: 'bandpass',
      startFreq: 950,
      endFreq: 2600,
      q: 1.3,
    });
    scheduleNoteSequence(out.ctx, out.dest, [392, 493.88, 587.33, 783.99], {
      stepSec: 0.045,
      duration: 0.13,
      lastDuration: 0.24,
      gain: 0.13,
      type: 'triangle',
      lastType: 'sine',
      attack: 0.008,
    });
  };

  const playConsumable = (kind: 'celestial' | 'scroll' | 'rune' = 'scroll'): void => {
    const out = prepareSfx();
    if (!out) return;
    if (kind === 'celestial') {
      scheduleNoteSequence(out.ctx, out.dest, [880, 1174.66, 1567.98], {
        stepSec: 0.055,
        duration: 0.16,
        lastDuration: 0.3,
        gain: 0.13,
        type: 'sine',
        attack: 0.008,
      });
      return;
    }
    if (kind === 'rune') {
      scheduleNoteSequence(out.ctx, out.dest, [293.66, 440, 659.25, 880], {
        stepSec: 0.05,
        duration: 0.15,
        lastDuration: 0.28,
        gain: 0.13,
        type: 'triangle',
        lastType: 'sine',
        attack: 0.01,
        filterStartFreq: 1800,
        filterEndFreq: 750,
      });
      return;
    }
    scheduleNoteSequence(out.ctx, out.dest, [523.25, 659.25, 783.99, 987.77], {
      stepSec: 0.045,
      duration: 0.13,
      lastDuration: 0.25,
      gain: 0.135,
      type: 'sine',
      attack: 0.007,
    });
  };

  const playFlameThreshold = (): void => {
    const out = prepareSfx();
    if (!out) return;
    scheduleNoiseBurst(out.ctx, out.dest, cachedNoiseBuffer, {
      duration: 0.24,
      gain: 0.11,
      filterType: 'lowpass',
      startFreq: 320,
      endFreq: 1450,
      q: 1.1,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'triangle',
      startFreq: 329.63,
      endFreq: 659.25,
      duration: 0.22,
      attack: 0.012,
      gain: 0.14,
      filterType: 'lowpass',
      filterStartFreq: 1600,
      filterEndFreq: 950,
    });
  };

  const playShatter = (): void => {
    const out = prepareSfx();
    if (!out) return;
    scheduleNoiseBurst(out.ctx, out.dest, cachedNoiseBuffer, {
      duration: 0.22,
      gain: 0.18,
      filterType: 'highpass',
      startFreq: 2100,
      endFreq: 850,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'triangle',
      startFreq: 1760,
      endFreq: 740,
      duration: 0.16,
      attack: 0.005,
      gain: 0.13,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'sine',
      startFreq: 2489,
      endFreq: 1046,
      delay: 0.025,
      duration: 0.17,
      attack: 0.005,
      gain: 0.1,
    });
  };

  const playDebuff = (): void => {
    const out = prepareSfx();
    if (!out) return;
    scheduleTone(out.ctx, out.dest, {
      type: 'sawtooth',
      startFreq: 220,
      endFreq: 110,
      duration: 0.2,
      attack: 0.005,
      gain: 0.15,
      filterType: 'lowpass',
      filterStartFreq: 680,
      filterEndFreq: 180,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'triangle',
      startFreq: 155.56,
      endFreq: 92.5,
      delay: 0.03,
      duration: 0.19,
      attack: 0.005,
      gain: 0.13,
    });
  };

  const playBuy = (): void => {
    const out = prepareSfx();
    if (!out) return;
    scheduleNoteSequence(out.ctx, out.dest, [523.25, 659.25, 1046.5], {
      stepSec: 0.04,
      duration: 0.1,
      lastDuration: 0.18,
      gain: 0.15,
      type: 'sine',
      attack: 0.003,
    });
  };

  const playReroll = (): void => {
    const out = prepareSfx();
    if (!out) return;
    scheduleNoiseBurst(out.ctx, out.dest, cachedNoiseBuffer, {
      duration: 0.08,
      gain: 0.1,
      filterType: 'bandpass',
      startFreq: 1100,
      endFreq: 2400,
      q: 1.5,
    });
    scheduleNoteSequence(out.ctx, out.dest, [392, 493.88, 587.33], {
      stepSec: 0.035,
      duration: 0.1,
      gain: 0.12,
      type: 'triangle',
      attack: 0.003,
    });
  };

  const playWin = (): void => {
    const out = prepareSfx();
    if (!out) return;
    scheduleNoteSequence(out.ctx, out.dest, [523.25, 659.25, 783.99, 1046.5], {
      stepSec: 0.075,
      duration: 0.16,
      lastDuration: 0.42,
      gain: 0.16,
      type: 'sine',
      lastType: 'triangle',
      attack: 0.005,
    });
  };

  const playLose = (): void => {
    const out = prepareSfx();
    if (!out) return;
    scheduleNoteSequence(out.ctx, out.dest, [392, 349.23, 293.66, 220], {
      stepSec: 0.095,
      duration: 0.18,
      lastDuration: 0.45,
      gain: 0.15,
      type: 'triangle',
      attack: 0.008,
      filterStartFreq: 900,
      filterEndFreq: 320,
    });
  };

  const playDialogue = (pitchRate = 1): void => {
    const out = prepareSfx();
    if (!out) return;
    const rate =
      typeof pitchRate === 'number' && Number.isFinite(pitchRate)
        ? Math.max(0.65, Math.min(1.45, pitchRate))
        : 1;
    // Мягкий диалоговый щелчок/чириканье реплики Миры
    scheduleTone(out.ctx, out.dest, {
      type: 'sine',
      startFreq: 580 * rate,
      endFreq: 740 * rate,
      duration: 0.04,
      attack: 0.003,
      gain: 0.065,
    });
    scheduleTone(out.ctx, out.dest, {
      type: 'triangle',
      startFreq: 880 * rate,
      endFreq: 960 * rate,
      delay: 0.014,
      duration: 0.032,
      attack: 0.002,
      gain: 0.042,
    });
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    hooks?.onDispose?.();

    if (unsubscribeMute) {
      unsubscribeMute();
      unsubscribeMute = null;
    }

    stopAmbient();
    stopFlameLoop();

    if (ctx && masterGain) {
      setParamImmediate(masterGain.gain, 0, getSafeTime(ctx));
    }

    safeDisconnect(sfxGain);
    safeDisconnect(musicGain);
    safeDisconnect(masterGain);

    if (ctx && ctx.state !== 'closed' && typeof ctx.close === 'function') {
      try {
        const closePromise = ctx.close();
        if (closePromise && typeof closePromise.catch === 'function') {
          closePromise.catch(() => {});
        }
      } catch {
        // Игнорируем ошибку закрытия контекста
      }
    }

    ctx = null;
    masterGain = null;
    sfxGain = null;
    musicGain = null;
    cachedNoiseBuffer = null;
  };

  const controller: BaliteAudioController = {
    unlock,
    setSettings,
    getSettings,
    isMuted,
    setMusicMood,
    setFlameIntensity,
    playButton,
    playCancel,
    playCardHover,
    playCardSelect,
    playCardDeselect,
    playCardDeal,
    playChipHit,
    playMultHit,
    playXMultHit,
    playEditionTrigger,
    playGoldSeal,
    playBossIntro,
    playRelicTrigger,
    playGoldDelta,
    playBoosterOpen,
    playConsumable,
    playFlameThreshold,
    playShatter,
    playDebuff,
    playBuy,
    playReroll,
    playWin,
    playLose,
    playDialogue,
    playForTraceEvent: (event, comboIndex) =>
      dispatchTraceAudioEvent(controller, event, comboIndex),
    dispose,
  };

  return controller;
}
