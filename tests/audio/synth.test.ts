import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaliteAudio } from '../../src/audio/synth';
import type { TraceEvent } from '../../src/engine/types';
import { createAudioUnlockController } from '../../src/platform/audioUnlock';

interface MockAudioParam {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  setTargetAtTime: ReturnType<typeof vi.fn>;
  cancelScheduledValues: ReturnType<typeof vi.fn>;
}

interface MockGainNode {
  kind: 'gain';
  gain: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

interface MockOscillatorNode {
  kind: 'oscillator';
  type: OscillatorType;
  frequency: MockAudioParam;
  detune: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

interface MockBiquadFilterNode {
  kind: 'filter';
  type: BiquadFilterType;
  frequency: MockAudioParam;
  Q: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

interface MockBufferSourceNode {
  kind: 'bufferSource';
  buffer: AudioBuffer | null;
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

function createFakeAudioContextClass() {
  const instances: FakeAudioContext[] = [];

  class FakeAudioContext {
    state: AudioContextState = 'suspended';
    currentTime = 1.5;
    sampleRate = 44100;
    destination = { kind: 'destination' } as unknown as AudioDestinationNode;

    readonly gains: MockGainNode[] = [];
    readonly oscillators: MockOscillatorNode[] = [];
    readonly filters: MockBiquadFilterNode[] = [];
    readonly bufferSources: MockBufferSourceNode[] = [];

    constructor() {
      instances.push(this);
    }

    createGain = vi.fn((): MockGainNode => {
      const node: MockGainNode = {
        kind: 'gain',
        gain: createMockAudioParam(1),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      this.gains.push(node);
      return node;
    });

    createOscillator = vi.fn((): MockOscillatorNode => {
      const node: MockOscillatorNode = {
        kind: 'oscillator',
        type: 'sine',
        frequency: createMockAudioParam(440),
        detune: createMockAudioParam(0),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      this.oscillators.push(node);
      return node;
    });

    createBiquadFilter = vi.fn((): MockBiquadFilterNode => {
      const node: MockBiquadFilterNode = {
        kind: 'filter',
        type: 'lowpass',
        frequency: createMockAudioParam(1000),
        Q: createMockAudioParam(1),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      this.filters.push(node);
      return node;
    });

    createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => {
      const data = new Float32Array(length);
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData: vi.fn(() => data),
      } as unknown as AudioBuffer;
    });

    createBufferSource = vi.fn((): MockBufferSourceNode => {
      const node: MockBufferSourceNode = {
        kind: 'bufferSource',
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      this.bufferSources.push(node);
      return node;
    });

    resume = vi.fn(async () => {
      this.state = 'running';
    });

    suspend = vi.fn(async () => {
      this.state = 'suspended';
    });

    close = vi.fn(async () => {
      this.state = 'closed';
    });
  }

  return { FakeAudioContext, instances };
}

describe('createBaliteAudio (процедурный Web Audio синтезатор)', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  it('безопасно работает в среде без AudioContext (например jsdom) без исключений', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);

    const platformAudio = createAudioUnlockController();
    platformAudio.install();

    const audio = createBaliteAudio(platformAudio, {
      soundEnabled: true,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });

    expect(audio.isMuted()).toBe(false);
    expect(audio.getSettings()).toEqual({
      soundEnabled: true,
      sfxVolume: 0.7,
      musicVolume: 0.5,
    });

    expect(() => {
      audio.unlock();
      audio.playButton();
      audio.playCardSelect();
      audio.playCardDeselect();
      audio.playCardDeal();
      audio.playChipHit(2);
      audio.playMultHit(3);
      audio.playRelicTrigger(1);
      audio.playGoldDelta(true);
      audio.playGoldDelta(false);
      audio.playShatter();
      audio.playDebuff();
      audio.playBuy();
      audio.playReroll();
      audio.playWin();
      audio.playLose();
      audio.setSettings({ soundEnabled: false, sfxVolume: 0.2, musicVolume: 0 });
      audio.dispose();
    }).not.toThrow();

    platformAudio.dispose();
  });

  it('создаёт AudioContext лениво только в unlock() или при звуке после unlock(), а не при инициализации', () => {
    const { FakeAudioContext, instances } = createFakeAudioContextClass();
    vi.stubGlobal('AudioContext', FakeAudioContext);

    const platformAudio = createAudioUnlockController();
    const registerSpy = vi.spyOn(platformAudio, 'registerContext');
    const unlockSpy = vi.spyOn(platformAudio, 'unlock');

    const audio = createBaliteAudio(platformAudio);
    expect(instances).toHaveLength(0);

    // Звуки до unlock() не должны создавать AudioContext
    audio.playButton();
    audio.playChipHit(0);
    expect(instances).toHaveLength(0);

    // Первый unlock() создаёт контекст, регистрирует его и разблокирует платформу
    audio.unlock();
    expect(instances).toHaveLength(1);
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith(instances[0]);
    expect(unlockSpy).toHaveBeenCalledTimes(1);

    // Повторный unlock() не создаёт дубликат контекста
    audio.unlock();
    expect(instances).toHaveLength(1);

    audio.dispose();
  });

  it('создаёт AudioContext при звуке после unlock(), если конструктор появился после вызова unlock()', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);

    const audio = createBaliteAudio();
    audio.unlock();

    // Конструктор появился позже
    const { FakeAudioContext, instances } = createFakeAudioContextClass();
    vi.stubGlobal('AudioContext', FakeAudioContext);

    audio.playButton();
    expect(instances).toHaveLength(1);
    expect(instances[0]!.oscillators.length).toBeGreaterThan(0);

    audio.dispose();
  });

  it('интегрируется с AudioUnlockController: мгновенно глушит masterGain и эмбиент при рекламе, паузе и скрытии вкладки', () => {
    const { FakeAudioContext, instances } = createFakeAudioContextClass();
    vi.stubGlobal('AudioContext', FakeAudioContext);

    const platformAudio = createAudioUnlockController();
    platformAudio.install();

    const audio = createBaliteAudio(platformAudio, {
      soundEnabled: true,
      sfxVolume: 0.8,
      musicVolume: 0.5,
    });
    audio.unlock();

    const ctx = instances[0]!;
    // Первый созданный GainNode — masterGain
    const masterGain = ctx.gains[0]!;
    expect(masterGain.gain.value).toBe(1);
    expect(audio.isMuted()).toBe(false);

    // Запомнили осцилляторы эмбиента, запущенные при разблокировке
    const ambientOscCount = ctx.oscillators.length;
    expect(ambientOscCount).toBeGreaterThan(0);

    // 1) Реклама onAdStart -> мгновенный мьют и остановка эмбиента
    platformAudio.onAdStart();
    expect(audio.isMuted()).toBe(true);
    expect(masterGain.gain.value).toBe(0);
    for (let i = 0; i < ambientOscCount; i += 1) {
      expect(ctx.oscillators[i]!.stop).toHaveBeenCalled();
    }

    // Во время мьюта SFX не создают новых осцилляторов
    const countWhileMuted = ctx.oscillators.length;
    audio.playChipHit(1);
    expect(ctx.oscillators.length).toBe(countWhileMuted);

    // Окончание рекламы onAdEnd -> восстановление звука и эмбиента
    platformAudio.onAdEnd();
    expect(audio.isMuted()).toBe(false);
    expect(masterGain.gain.value).toBe(1);
    expect(ctx.oscillators.length).toBeGreaterThan(countWhileMuted);

    // 2) Пауза площадки (game_api_pause) -> мьют
    platformAudio.setPlatformPaused(true);
    expect(audio.isMuted()).toBe(true);
    expect(masterGain.gain.value).toBe(0);

    platformAudio.setPlatformPaused(false);
    expect(audio.isMuted()).toBe(false);
    expect(masterGain.gain.value).toBe(1);

    // 3) Сворачивание вкладки -> мьют, возврат -> снятие мьюта
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(audio.isMuted()).toBe(true);
    expect(masterGain.gain.value).toBe(0);

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(audio.isMuted()).toBe(false);
    expect(masterGain.gain.value).toBe(1);

    audio.dispose();
    platformAudio.dispose();
  });

  it('управляет настройками soundEnabled, sfxVolume и musicVolume с ограничением [0..1]', () => {
    const { FakeAudioContext, instances } = createFakeAudioContextClass();
    vi.stubGlobal('AudioContext', FakeAudioContext);

    const audio = createBaliteAudio(undefined, {
      soundEnabled: true,
      sfxVolume: 1.5,
      musicVolume: -0.2,
    });

    expect(audio.getSettings()).toEqual({
      soundEnabled: true,
      sfxVolume: 1,
      musicVolume: 0,
    });

    audio.unlock();
    const ctx = instances[0]!;
    const masterGain = ctx.gains[0]!;
    const sfxGain = ctx.gains[1]!;
    const musicGain = ctx.gains[2]!;

    expect(masterGain.gain.value).toBe(1);
    expect(sfxGain.gain.value).toBe(1);
    expect(musicGain.gain.value).toBe(0);

    // Включаем музыку и меняем громкость эффектов
    audio.setSettings({ sfxVolume: 0.45, musicVolume: 0.35 });
    expect(sfxGain.gain.value).toBeCloseTo(0.45);
    expect(musicGain.gain.value).toBeCloseTo(0.35);
    expect(ctx.oscillators.length).toBeGreaterThan(0);

    // Выключение звука через soundEnabled: false
    audio.setSettings({ soundEnabled: false });
    expect(audio.isMuted()).toBe(true);
    expect(masterGain.gain.value).toBe(0);

    const oscBeforePlay = ctx.oscillators.length;
    audio.playWin();
    expect(ctx.oscillators.length).toBe(oscBeforePlay);

    // Обратное включение звука
    audio.setSettings({ soundEnabled: true });
    expect(audio.isMuted()).toBe(false);
    expect(masterGain.gain.value).toBe(1);

    // Некорректные NaN значения игнорируются
    audio.setSettings({ sfxVolume: Number.NaN, musicVolume: Number.POSITIVE_INFINITY });
    expect(audio.getSettings()).toEqual({
      soundEnabled: true,
      sfxVolume: 0.45,
      musicVolume: 0.35,
    });

    audio.dispose();
  });

  it('повышает частоту в playChipHit, playMultHit и playRelicTrigger с ростом comboIndex', () => {
    const { FakeAudioContext, instances } = createFakeAudioContextClass();
    vi.stubGlobal('AudioContext', FakeAudioContext);

    // Отключаем эмбиент, чтобы в ctx.oscillators были только SFX-осцилляторы
    const audio = createBaliteAudio(undefined, { musicVolume: 0, sfxVolume: 0.8 });
    audio.unlock();
    const ctx = instances[0]!;

    const captureFirstFreq = (fn: () => void): number => {
      const before = ctx.oscillators.length;
      fn();
      expect(ctx.oscillators.length).toBeGreaterThan(before);
      return ctx.oscillators[before]!.frequency.value;
    };

    const chip0 = captureFirstFreq(() => audio.playChipHit(0));
    const chip1 = captureFirstFreq(() => audio.playChipHit(1));
    const chip5 = captureFirstFreq(() => audio.playChipHit(5));
    expect(chip1).toBeGreaterThan(chip0);
    expect(chip5).toBeGreaterThan(chip1);

    // Удар множителя создаёт аккорд (несколько осцилляторов) и повышает тон
    const beforeMult0 = ctx.oscillators.length;
    audio.playMultHit(0);
    const mult0OscCount = ctx.oscillators.length - beforeMult0;
    const mult0Freq = ctx.oscillators[beforeMult0]!.frequency.value;
    expect(mult0OscCount).toBeGreaterThanOrEqual(3);

    const mult3Freq = captureFirstFreq(() => audio.playMultHit(3));
    const mult8Freq = captureFirstFreq(() => audio.playMultHit(8));
    expect(mult3Freq).toBeGreaterThan(mult0Freq);
    expect(mult8Freq).toBeGreaterThan(mult3Freq);

    // Срабатывание реликвии также повышает тон
    const relic0 = captureFirstFreq(() => audio.playRelicTrigger(0));
    const relic4 = captureFirstFreq(() => audio.playRelicTrigger(4));
    expect(relic4).toBeGreaterThan(relic0);

    // Отрицательный или чрезмерный comboIndex безопасно ограничивается
    const chipNeg = captureFirstFreq(() => audio.playChipHit(-5));
    expect(chipNeg).toBeCloseTo(chip0);

    audio.dispose();
  });

  it('синтезирует все SFX-методы и различает положительное/отрицательное золото', () => {
    const { FakeAudioContext, instances } = createFakeAudioContextClass();
    vi.stubGlobal('AudioContext', FakeAudioContext);

    const audio = createBaliteAudio(undefined, { musicVolume: 0 });
    audio.unlock();
    const ctx = instances[0]!;

    const expectSoundProduced = (label: string, fn: () => void) => {
      const oscBefore = ctx.oscillators.length;
      const bufBefore = ctx.bufferSources.length;
      fn();
      const createdNodes =
        ctx.oscillators.length - oscBefore + (ctx.bufferSources.length - bufBefore);
      expect(createdNodes, `метод ${label} должен создавать аудио-узлы`).toBeGreaterThan(0);
    };

    expectSoundProduced('playButton', () => audio.playButton());
    expectSoundProduced('playCardSelect', () => audio.playCardSelect());
    expectSoundProduced('playCardDeselect', () => audio.playCardDeselect());
    expectSoundProduced('playCardDeal', () => audio.playCardDeal());
    expectSoundProduced('playShatter', () => audio.playShatter());
    expectSoundProduced('playDebuff', () => audio.playDebuff());
    expectSoundProduced('playBuy', () => audio.playBuy());
    expectSoundProduced('playReroll', () => audio.playReroll());
    expectSoundProduced('playWin', () => audio.playWin());
    expectSoundProduced('playLose', () => audio.playLose());

    const beforePos = ctx.oscillators.length;
    audio.playGoldDelta(true);
    const posFreq = ctx.oscillators[beforePos]!.frequency.value;

    const beforeNeg = ctx.oscillators.length;
    audio.playGoldDelta(false);
    const negFreq = ctx.oscillators[beforeNeg]!.frequency.value;
    expect(posFreq).toBeGreaterThan(negFreq);

    audio.dispose();
  });

  it('диспетчеризует все 18 типов TraceEvent в playForTraceEvent и масштабирует тон по comboIndex', () => {
    const { FakeAudioContext, instances } = createFakeAudioContextClass();
    vi.stubGlobal('AudioContext', FakeAudioContext);

    const audio = createBaliteAudio(undefined, { musicVolume: 0 });
    audio.unlock();
    const ctx = instances[0]!;

    const allEvents: TraceEvent[] = [
      { type: 'CARD_TRIGGER', cardId: 'c1', retriggerIndex: 0, chipsDelta: 10 },
      { type: 'CARD_TRIGGER', cardId: 'c2', retriggerIndex: 0, multDelta: 4 },
      { type: 'CARD_TRIGGER', cardId: 'c3', retriggerIndex: 0, xMult: 2 },
      { type: 'CARD_TRIGGER', cardId: 'c4', retriggerIndex: 0, dollarsDelta: 3 },
      { type: 'HAND_CARD_TRIGGER', cardId: 'c5', retriggerIndex: 0, xMult: 1.5 },
      { type: 'RELIC_TRIGGER', relicUid: 'r1', relicId: 'j_joker', hook: 'onScoreRelic', multDelta: 4 },
      { type: 'RELIC_TRIGGER', relicUid: 'r2', relicId: 'j_blueprint', hook: 'onBeforeScore' },
      { type: 'CONSUMABLE_TRIGGER', consumableId: 'c_mercury', handType: 'Pair' },
      { type: 'CONSUMABLE_TRIGGER', consumableId: 'c_wheel_of_fortune', locKey: 'consumable_nope' },
      {
        type: 'SCORE_UPDATE',
        chips: 100,
        mult: 10,
        handScore: 1000,
        totalScore: 1000,
        targetScore: 300,
        handType: 'Flush',
      },
      { type: 'DOLLAR_DELTA', delta: 5, totalDollars: 15, source: 'cashout' },
      { type: 'DOLLAR_DELTA', delta: -4, totalDollars: 11, source: 'shop' },
      { type: 'CARD_SHATTER', cardId: 'c6', reason: 'glass' },
      {
        type: 'CARD_ENHANCEMENT_STRIPPED',
        cardId: 'c7',
        previousEnhancement: 'mult',
        relicUid: 'r3',
      },
      { type: 'RELIC_DESTROYED', relicUid: 'r4', relicId: 'j_ramen', reason: 'ramen' },
      { type: 'RELIC_DESTROYED', relicUid: 'r5', relicId: 'j_joker', reason: 'sold' },
      { type: 'CARD_DEBUFFED', cardId: 'c8', bossId: 'bl_club' },
      { type: 'HAND_DEBUFFED', bossId: 'bl_psychic', handType: 'Pair', locKey: 'hand_debuffed' },
      { type: 'BOSS_TRIGGER', bossId: 'bl_hook', locKey: 'boss_hook_discard' },
      { type: 'BOSS_TRIGGER', bossId: 'bl_wall', locKey: 'boss_disabled' },
      { type: 'TAG_TRIGGER', tagId: 'tag_skip', locKey: 'tag_activated' },
      { type: 'TAG_TRIGGER', tagId: 'tag_rare', locKey: 'tag_fizzled' },
      { type: 'HAND_LEVEL_UP', handType: 'Pair', newLevel: 2, chips: 25, mult: 3 },
      {
        type: 'BLIND_DEFEATED',
        ante: 1,
        blindKind: 'small',
        bossId: null,
        finalScore: 500,
        targetScore: 300,
      },
      { type: 'RUN_WON', ante: 8, finalScore: 50000 },
      { type: 'RUN_LOST', ante: 3, blindKind: 'boss', finalScore: 1000, targetScore: 5000 },
      { type: 'PHASE_CHANGED', from: 'blind_select', to: 'playing' },
    ];

    for (const event of allEvents) {
      expect(() => audio.playForTraceEvent(event, 1)).not.toThrow();
    }

    // Проверяем рост тона на цепочке комбо через диспетчер
    const idxLow = ctx.oscillators.length;
    audio.playForTraceEvent({ type: 'CARD_TRIGGER', cardId: 'c1', retriggerIndex: 0, chipsDelta: 10 }, 0);
    const freqLow = ctx.oscillators[idxLow]!.frequency.value;

    const idxHigh = ctx.oscillators.length;
    audio.playForTraceEvent({ type: 'CARD_TRIGGER', cardId: 'c2', retriggerIndex: 0, chipsDelta: 10 }, 6);
    const freqHigh = ctx.oscillators[idxHigh]!.frequency.value;

    expect(freqHigh).toBeGreaterThan(freqLow);

    audio.dispose();
  });

  it('корректно отписывается и освобождает ресурсы в dispose(), а также терпим к урезанному AudioContext', () => {
    class MinimalAudioContext {
      state: AudioContextState = 'running';
      currentTime = 0;
      destination = {} as AudioDestinationNode;
      createGain = vi.fn(() => ({
        gain: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }));
      createOscillator = vi.fn(() => ({
        type: 'sine' as OscillatorType,
        frequency: { value: 440 },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }));
      close = vi.fn().mockResolvedValue(undefined);
    }

    vi.stubGlobal('AudioContext', MinimalAudioContext);

    const unsubscribeSpy = vi.fn();
    const subscribeMuteSpy = vi.fn(() => unsubscribeSpy);
    const mockPlatformAudio = {
      install: vi.fn(),
      dispose: vi.fn(),
      unlock: vi.fn(),
      registerContext: vi.fn(),
      setPlatformPaused: vi.fn(),
      onAdStart: vi.fn(),
      onAdEnd: vi.fn(),
      isMutedByPlatform: vi.fn(() => false),
      subscribeMute: subscribeMuteSpy,
    };

    const audio = createBaliteAudio(mockPlatformAudio);
    audio.unlock();

    expect(() => {
      audio.playCardDeal();
      audio.playShatter();
      audio.playDebuff();
      audio.playMultHit(2);
      audio.playWin();
      audio.playLose();
    }).not.toThrow();

    audio.dispose();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(audio.isMuted()).toBe(true);

    // Повторный dispose и вызовы после dispose безопасны и не переподписываются
    expect(() => {
      audio.dispose();
      audio.unlock();
      audio.playButton();
    }).not.toThrow();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  it('поддерживает webkitAudioContext, сбой конструктора AudioContext и отложенное снятие мьюта после unlock() во время рекламы', () => {
    const { FakeAudioContext, instances } = createFakeAudioContextClass();
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', FakeAudioContext);

    const platformAudio = createAudioUnlockController();
    platformAudio.install();
    platformAudio.onAdStart();

    const audio = createBaliteAudio(platformAudio, { musicVolume: 0.4 });
    audio.unlock();

    expect(instances).toHaveLength(1);
    const ctx = instances[0]!;
    const masterGain = ctx.gains[0]!;
    expect(masterGain.gain.value).toBe(0);
    // Во время активной рекламы эмбиент не запускается даже после unlock()
    expect(ctx.oscillators).toHaveLength(0);

    // После завершения рекламы звук включается и эмбиент стартует
    platformAudio.onAdEnd();
    expect(masterGain.gain.value).toBe(1);
    expect(ctx.oscillators.length).toBeGreaterThan(0);

    audio.dispose();
    platformAudio.dispose();

    // Исключение внутри конструктора AudioContext не должно ломать контроллер
    vi.stubGlobal('webkitAudioContext', undefined);
    vi.stubGlobal(
      'AudioContext',
      class ThrowingAudioContext {
        constructor() {
          throw new Error('Аудиоустройство недоступно');
        }
      },
    );

    const fallbackAudio = createBaliteAudio();
    expect(() => {
      fallbackAudio.unlock();
      fallbackAudio.playButton();
      fallbackAudio.playWin();
      fallbackAudio.dispose();
    }).not.toThrow();
  });
});
