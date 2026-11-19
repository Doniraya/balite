// Тесты реестра сэмплов и гибридного аудиодвижка Balite (Story 5.1).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHybridBaliteAudio } from '../../src/audio/hybridAudio';
import {
  AUDIO_SAMPLE_KEYS,
  AUDIO_SAMPLE_REGISTRY,
  resolveAudioSampleRegistry,
} from '../../src/audio/sampleRegistry';
import { createAudioUnlockController } from '../../src/platform/audioUnlock';

interface MockAudioParam {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  setTargetAtTime: ReturnType<typeof vi.fn>;
  cancelScheduledValues: ReturnType<typeof vi.fn>;
}

interface MockBufferSourceNode {
  kind: 'bufferSource';
  buffer: AudioBuffer | null;
  loop: boolean;
  playbackRate: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

function createMockAudioParam(initialValue = 0): MockAudioParam {
  const param: MockAudioParam = {
    value: initialValue,
    setValueAtTime: vi.fn((val: number) => {
      param.value = val;
    }),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
  return param;
}

function createFakeAudioContextClass(options: { rejectDecode?: boolean } = {}) {
  const instances: FakeAudioContext[] = [];

  class FakeAudioContext {
    state: AudioContextState = 'running';
    currentTime = 1.0;
    sampleRate = 44100;
    destination = { kind: 'destination' } as unknown as AudioDestinationNode;

    readonly gains: { gain: MockAudioParam; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
    readonly oscillators: {
      type: OscillatorType;
      frequency: MockAudioParam;
      detune: MockAudioParam;
      connect: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }[] = [];
    readonly filters: unknown[] = [];
    readonly bufferSources: MockBufferSourceNode[] = [];

    constructor() {
      instances.push(this);
    }

    createGain = vi.fn(() => {
      const node = {
        gain: createMockAudioParam(1),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      this.gains.push(node);
      return node;
    });

    createOscillator = vi.fn(() => {
      const node = {
        type: 'sine' as OscillatorType,
        frequency: createMockAudioParam(440),
        detune: createMockAudioParam(0),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      this.oscillators.push(node);
      return node;
    });

    createBiquadFilter = vi.fn(() => {
      const node = {
        type: 'lowpass' as BiquadFilterType,
        frequency: createMockAudioParam(1000),
        Q: createMockAudioParam(1),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      this.filters.push(node);
      return node;
    });

    createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => ({
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: () => new Float32Array(length),
    }));

    createBufferSource = vi.fn((): MockBufferSourceNode => {
      const node: MockBufferSourceNode = {
        kind: 'bufferSource',
        buffer: null,
        loop: false,
        playbackRate: createMockAudioParam(1),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      this.bufferSources.push(node);
      return node;
    });

    decodeAudioData = vi.fn(async (buf: ArrayBuffer): Promise<AudioBuffer> => {
      if (options.rejectDecode) {
        throw new Error('DECODE_FAILED');
      }
      return {
        duration: 12,
        length: Math.max(1, buf.byteLength),
        numberOfChannels: 2,
        sampleRate: 44100,
      } as unknown as AudioBuffer;
    });

    resume = vi.fn(async () => {
      this.state = 'running';
    });

    close = vi.fn(async () => {
      this.state = 'closed';
    });
  }

  return { FakeAudioContext, instances };
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}

describe('sampleRegistry и createHybridBaliteAudio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolveAudioSampleRegistry выбирает формат по приоритету .ogg > .mp3 > .wav и игнорирует неизвестные файлы', () => {
    const resolved = resolveAudioSampleRegistry({
      '/src/assets/audio/bgm.wav': '/assets/bgm.wav',
      '/src/assets/audio/bgm.mp3': '/assets/bgm.mp3',
      '/src/assets/audio/bgm.ogg': '/assets/bgm.ogg',
      '/src/assets/audio/chip_hit.wav': '/assets/chip_hit.wav',
      '/src/assets/audio/chip_hit.mp3': '/assets/chip_hit.mp3',
      '/src/assets/audio/card_hover.wav': '/assets/card_hover.wav',
      '/src/assets/audio/unknown_sfx.ogg': '/assets/unknown.ogg',
    });

    expect(resolved).toEqual({
      bgm: '/assets/bgm.ogg',
      chip_hit: '/assets/chip_hit.mp3',
      card_hover: '/assets/card_hover.wav',
    });
  });

  it('автоматически регистрирует подключённые bgm.mp3 и dialogue.ogg из src/assets/audio/', () => {
    expect(AUDIO_SAMPLE_REGISTRY.bgm).toMatch(/bgm.*\.mp3$/);
    expect(AUDIO_SAMPLE_KEYS).toContain('dialogue');
    expect(AUDIO_SAMPLE_REGISTRY.dialogue).toMatch(/dialogue.*\.ogg$/);
    const allowedKeys = new Set<string>(AUDIO_SAMPLE_KEYS);
    for (const key of Object.keys(AUDIO_SAMPLE_REGISTRY)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
  });

  it('при пустом реестре не делает fetch-запросов и безопасно работает в jsdom без AudioContext', () => {
    const fetchSpy = vi.fn();
    const audio = createHybridBaliteAudio(undefined, undefined, {
      sampleRegistry: {},
      fetchFn: fetchSpy as unknown as typeof fetch,
    });

    expect(() => {
      audio.unlock();
      audio.playCardHover();
      audio.playBoosterOpen();
      audio.playConsumable('celestial');
      audio.playFlameThreshold();
      audio.playChipHit(2);
      audio.dispose();
    }).not.toThrow();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('загружает сэмплы в unlock(), применяет pitch-shift по comboIndex, микро-вариацию и зацикливает BGM без синт-фона', async () => {
    const { FakeAudioContext, instances } = createFakeAudioContextClass();
    vi.stubGlobal('AudioContext', FakeAudioContext);

    const fetchSpy = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));

    const platformAudio = createAudioUnlockController();
    platformAudio.install();

    const audio = createHybridBaliteAudio(
      platformAudio,
      { soundEnabled: true, sfxVolume: 0.8, musicVolume: 0.5 },
      {
        sampleRegistry: {
          bgm: '/audio/bgm.ogg',
          chip_hit: '/audio/chip_hit.ogg',
          mult_hit: '/audio/mult_hit.ogg',
          relic_trigger: '/audio/relic_trigger.ogg',
          button: '/audio/button.ogg',
          dialogue: '/audio/dialogue.ogg',
        },
        fetchFn: fetchSpy as unknown as typeof fetch,
        randomFn: () => 1, // Максимальная положительная микро-вариация (+2%)
      },
    );

    // До unlock никаких сетевых запросов
    expect(fetchSpy).not.toHaveBeenCalled();

    audio.unlock();
    await flushMicrotasks();

    const ctx = instances[0]!;
    expect(fetchSpy).toHaveBeenCalledTimes(6);

    // После загрузки bgm процедурные осцилляторы остановлены, а bgm зациклен через musicGain
    for (const osc of ctx.oscillators) {
      expect(osc.stop).toHaveBeenCalled();
    }
    const bgmSource = ctx.bufferSources.find((s) => s.loop === true);
    expect(bgmSource).toBeDefined();
    expect(bgmSource?.start).toHaveBeenCalled();

    // Pitch-shift по comboIndex для chip_hit / mult_hit / relic_trigger
    const beforeSamples = ctx.bufferSources.length;
    audio.playChipHit(0);
    audio.playChipHit(5);
    audio.playChipHit(20);
    audio.playMultHit(3);
    audio.playRelicTrigger(4);

    const rate0 = ctx.bufferSources[beforeSamples]!.playbackRate.value;
    const rate5 = ctx.bufferSources[beforeSamples + 1]!.playbackRate.value;
    const rate20 = ctx.bufferSources[beforeSamples + 2]!.playbackRate.value;
    expect(rate0).toBeCloseTo(0.86, 3);
    expect(rate5).toBeCloseTo(0.94, 3);
    expect(rate20).toBeCloseTo(1.18, 3);
    expect(ctx.bufferSources[beforeSamples + 3]!.playbackRate.value).toBeCloseTo(0.908, 3);
    expect(ctx.bufferSources[beforeSamples + 4]!.playbackRate.value).toBeCloseTo(0.924, 3);

    // Повторный триггер (retrigger announce) использует случайный питч 0.98..1.02
    const beforeRetrigger = ctx.bufferSources.length;
    audio.playRelicTrigger(0, true);
    const retriggerRate = ctx.bufferSources[beforeRetrigger]!.playbackRate.value;
    expect(retriggerRate).toBeGreaterThanOrEqual(0.98);
    expect(retriggerRate).toBeLessThanOrEqual(1.02);

    // Микро-вариация ±2% на клике и диалоге Миры (при randomFn() === 1 -> 1.02)
    const beforeBtn = ctx.bufferSources.length;
    audio.playButton();
    audio.playDialogue();
    expect(ctx.bufferSources[beforeBtn]!.playbackRate.value).toBeCloseTo(1.02, 3);
    expect(ctx.bufferSources[beforeBtn + 1]!.playbackRate.value).toBeCloseTo(1.02, 3);

    // Мгновенный мьют при рекламе останавливает BGM и глушит SFX, а onAdEnd возобновляет BGM
    platformAudio.onAdStart();
    expect(audio.isMuted()).toBe(true);
    expect(bgmSource?.stop).toHaveBeenCalled();

    const countDuringMute = ctx.bufferSources.length;
    audio.playChipHit(1);
    expect(ctx.bufferSources.length).toBe(countDuringMute);

    const sourcesBeforeResume = ctx.bufferSources.length;
    platformAudio.onAdEnd();
    expect(audio.isMuted()).toBe(false);
    const resumedBgm = ctx.bufferSources
      .slice(sourcesBeforeResume)
      .find((s) => s.loop === true);
    expect(resumedBgm).toBeDefined();

    audio.dispose();
    platformAudio.dispose();
  });

  it('плавно падает на процедурный синтез при ошибке сети или декодирования сэмплов', async () => {
    const { FakeAudioContext, instances } = createFakeAudioContextClass({
      rejectDecode: true,
    });
    vi.stubGlobal('AudioContext', FakeAudioContext);

    const failingFetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    }));

    const audio = createHybridBaliteAudio(
      undefined,
      { soundEnabled: true, sfxVolume: 0.8, musicVolume: 0.4 },
      {
        sampleRegistry: {
          bgm: '/audio/bgm.ogg',
          chip_hit: '/audio/chip_hit.ogg',
        },
        fetchFn: failingFetch as unknown as typeof fetch,
      },
    );

    audio.unlock();
    await flushMicrotasks();

    const ctx = instances[0]!;
    const oscBefore = ctx.oscillators.length;
    audio.playChipHit(2);
    // Фолбэк сработал — создался осциллятор синтезатора
    expect(ctx.oscillators.length).toBeGreaterThan(oscBefore);

    // При проигрывании через TraceEvent также срабатывает фолбэк без ошибок
    expect(() => {
      audio.playForTraceEvent(
        { type: 'CONSUMABLE_TRIGGER', consumableId: 'c_mercury', handType: 'Pair' },
        1,
      );
      audio.playFlameThreshold();
      audio.playDialogue();
    }).not.toThrow();

    audio.dispose();
  });
});
