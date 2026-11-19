import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TraceEvent } from '../../src/engine/types';
import { createTranslator } from '../../src/i18n';
import {
  createBackdropCanvas,
  type BackdropMood,
} from '../../src/ui/backdropCanvas';
import {
  DEFAULT_BASE_STEP_MS,
  advanceComboAcc,
  computeComboSpeedFactor,
  getEventBaseDelayMs,
  getStepDelayMs,
  playTraceEvents,
  quantizeBalatroStepDelayMs,
  resolveSpeed,
  type TracePlayerHandlers,
  type TracePopupPayload,
} from '../../src/ui/tracePlayer';

/**
 * Создаёт имитацию CanvasRenderingContext2D для проверки 2D-отрисовки в jsdom.
 */
function createMockCanvasContext(): CanvasRenderingContext2D {
  const gradientStub = {
    addColorStop: vi.fn(),
  };

  return {
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    createRadialGradient: vi.fn(() => gradientStub),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  } as unknown as CanvasRenderingContext2D;
}

describe('Проигрыватель TraceEvent (tracePlayer)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('масштабирует задержку шага в getStepDelayMs обратно пропорционально AnimationSpeed (0.5 / 1 / 2 / 4) и откалиброван до ~620-680мс на 1x', () => {
    expect(DEFAULT_BASE_STEP_MS).toBeGreaterThanOrEqual(620);
    expect(DEFAULT_BASE_STEP_MS).toBeLessThanOrEqual(680);

    expect(resolveSpeed(0.5)).toBe(0.5);
    expect(resolveSpeed(1)).toBe(1);
    expect(resolveSpeed(2)).toBe(2);
    expect(resolveSpeed(4)).toBe(4);
    expect(resolveSpeed(undefined)).toBe(1);
    expect(resolveSpeed(99)).toBe(1);

    expect(getStepDelayMs(0.5, 400)).toBe(800);
    expect(getStepDelayMs(1, 400)).toBe(400);
    expect(getStepDelayMs(2, 400)).toBe(200);
    expect(getStepDelayMs(4, 400)).toBe(100);
    expect(getStepDelayMs(2, 0)).toBe(0);
    expect(getStepDelayMs(2, -10)).toBe(0);

    const d05 = getStepDelayMs(0.5);
    const d1 = getStepDelayMs(1);
    const d2 = getStepDelayMs(2);
    const d4 = getStepDelayMs(4);
    expect(d05).toBeGreaterThanOrEqual(1240);
    expect(d05).toBeLessThanOrEqual(1360);
    expect(d1).toBeGreaterThanOrEqual(620);
    expect(d1).toBeLessThanOrEqual(680);
    expect(d2).toBeGreaterThanOrEqual(310);
    expect(d2).toBeLessThanOrEqual(340);
    expect(d4).toBeGreaterThanOrEqual(155);
    expect(d4).toBeLessThanOrEqual(170);
    expect(d05).toBeGreaterThan(d1);
    expect(d1).toBeGreaterThan(d2);
    expect(d2).toBeGreaterThan(d4);
    expect(d4).toBeGreaterThan(0);
  });

  it('корректно обрабатывает все 18 типов TraceEvent, локализуя поп-апы и баннеры без зашитых строк', async () => {
    for (const lang of ['ru', 'en'] as const) {
      const translator = createTranslator(lang);
      const popups: TracePopupPayload[] = [];
      const banners: Array<{ text: string; tone: string }> = [];
      const cardHighlights: Array<string | null> = [];
      const handHighlights: Array<string | null> = [];
      const relicHighlights: Array<string | null> = [];
      const onScore = vi.fn();
      const onDollars = vi.fn();
      const onShatterCard = vi.fn();
      const playForTraceEvent = vi.fn();

      const events: TraceEvent[] = [
        {
          type: 'BOSS_TRIGGER',
          bossId: 'bl_psychic',
          locKey: 'boss_psychic',
          locParams: { count: 5 },
        },
        {
          type: 'HAND_DEBUFFED',
          bossId: 'bl_psychic',
          handType: 'Pair',
          locKey: 'hand_debuffed',
        },
        {
          type: 'CARD_DEBUFFED',
          cardId: 'c_debuffed',
          bossId: 'bl_club',
          locKey: 'card_debuffed',
        },
        {
          type: 'CARD_ENHANCEMENT_STRIPPED',
          cardId: 'c_1',
          previousEnhancement: 'mult',
          relicUid: 'rel_vamp',
        },
        {
          type: 'CARD_TRIGGER',
          cardId: 'c_1',
          retriggerIndex: 0,
          chipsDelta: 61,
          multDelta: 4,
          xMult: 2,
          dollarsDelta: 3,
          edition: 'foil',
          enhancement: 'glass',
          seal: 'gold',
        },
        {
          type: 'CARD_TRIGGER',
          cardId: 'c_discarded',
          retriggerIndex: 0,
          seal: 'purple',
          locKey: 'hand_card_purple_seal',
        },
        {
          type: 'HAND_CARD_TRIGGER',
          cardId: 'c_hand',
          retriggerIndex: 0,
          xMult: 1.5,
          dollarsDelta: 3,
          locKey: 'hand_card_steel',
          locParams: { xMult: 1.5 },
        },
        {
          type: 'HAND_CARD_TRIGGER',
          cardId: 'c_hand_blue',
          retriggerIndex: 0,
          createdConsumableId: 'c_mercury',
          locKey: 'hand_card_blue_seal',
        },
        {
          type: 'RELIC_TRIGGER',
          relicUid: 'rel_1',
          relicId: 'j_joker',
          copiedByUid: 'rel_bp',
          hook: 'onScoreRelic',
          chipsDelta: 50,
          multDelta: 10,
          xMult: 1.5,
          dollarsDelta: 4,
        },
        {
          type: 'RELIC_TRIGGER',
          relicUid: 'rel_runner',
          relicId: 'j_runner',
          hook: 'onBeforeScore',
          locKey: 'relic_upgrade',
        },
        {
          type: 'CONSUMABLE_TRIGGER',
          consumableUid: 'cons_obs',
          consumableId: 'c_mercury',
          handType: 'Pair',
          xMult: 1.5,
          locKey: 'relic_x_mult',
          locParams: { xMult: 1.5 },
        },
        {
          type: 'CONSUMABLE_TRIGGER',
          consumableUid: 'cons_wheel',
          consumableId: 'c_wheel_of_fortune',
          locKey: 'consumable_nope',
        },
        {
          type: 'HAND_LEVEL_UP',
          handType: 'Pair',
          newLevel: 2,
          chips: 25,
          mult: 3,
        },
        {
          type: 'DOLLAR_DELTA',
          delta: 7,
          totalDollars: 15,
          source: 'cashout',
        },
        {
          type: 'CARD_SHATTER',
          cardId: 'c_1',
          reason: 'glass',
        },
        {
          type: 'RELIC_DESTROYED',
          relicUid: 'rel_ramen',
          relicId: 'j_ramen',
          reason: 'ramen',
        },
        {
          type: 'TAG_TRIGGER',
          tagId: 'tag_investment',
          locKey: 'tag_activated',
          locParams: { tagName: 'tag_investment' },
        },
        {
          type: 'SCORE_UPDATE',
          chips: 120,
          mult: 24,
          handScore: 2880,
          totalScore: 2880,
          targetScore: 600,
          handType: 'Pair',
        },
        {
          type: 'BLIND_DEFEATED',
          ante: 1,
          blindKind: 'boss',
          bossId: 'bl_psychic',
          finalScore: 2880,
          targetScore: 600,
        },
        {
          type: 'RUN_WON',
          ante: 8,
          finalScore: 100500,
        },
        {
          type: 'RUN_LOST',
          ante: 3,
          blindKind: 'small',
          finalScore: 500,
          targetScore: 2000,
        },
        {
          type: 'PHASE_CHANGED',
          from: 'playing',
          to: 'cashout',
        },
      ];

      const handlers: TracePlayerHandlers = {
        translator,
        audio: { playForTraceEvent },
        onScore,
        onDollars,
        onHighlightCard: (id) => cardHighlights.push(id),
        onHighlightHandCard: (id) => handHighlights.push(id),
        onHighlightRelic: (uid) => relicHighlights.push(uid),
        onPopup: (popup) => popups.push(popup),
        onShatterCard,
        onBanner: (text, tone) => banners.push({ text, tone }),
      };

      const handle = playTraceEvents(events, 2, handlers);
      await vi.runAllTimersAsync();
      await handle.promise;

      expect(onScore).toHaveBeenCalledWith(120, 24, 2880, 600, 'Pair');
      expect(onDollars).toHaveBeenCalledWith(15, 7);
      expect(onShatterCard).toHaveBeenCalledWith('c_1');
      expect(playForTraceEvent).toHaveBeenCalledTimes(events.length);

      // Подсветки снимаются по завершении
      expect(cardHighlights).toContain('c_1');
      expect(cardHighlights[cardHighlights.length - 1]).toBeNull();
      expect(handHighlights).toContain('c_hand');
      expect(handHighlights[handHighlights.length - 1]).toBeNull();
      expect(relicHighlights).toContain('rel_bp');
      expect(relicHighlights[relicHighlights.length - 1]).toBeNull();

      // Поп-апы соответствуют локали и не содержат нераскрытых плейсхолдеров
      const expectedMultPopup = lang === 'ru' ? '+4 Мн.' : '+4 Mult';
      const expectedGoldPopup = lang === 'ru' ? '+3 з.' : '+3 Gold';
      expect(popups.some((p) => p.kind === 'chips' && p.text === '+61' && p.targetCardId === 'c_1')).toBe(true);
      expect(popups.some((p) => p.kind === 'mult' && p.text === expectedMultPopup && p.targetCardId === 'c_1')).toBe(true);
      expect(popups.some((p) => p.kind === 'xmult' && p.text === '×2' && p.targetCardId === 'c_1')).toBe(true);
      expect(popups.some((p) => p.kind === 'dollars' && p.text === expectedGoldPopup && p.targetCardId === 'c_1')).toBe(true);
      expect(popups.some((p) => p.kind === 'shatter' && p.targetCardId === 'c_1')).toBe(true);
      expect(popups.some((p) => p.kind === 'shatter' && p.targetRelicUid === 'rel_ramen')).toBe(true);
      expect(popups.some((p) => p.kind === 'debuff' && p.targetCardId === 'c_debuffed')).toBe(true);
      expect(popups.some((p) => p.kind === 'level')).toBe(true);
      expect(popups.some((p) => p.kind === 'boss')).toBe(true);
      expect(popups.some((p) => p.kind === 'tag')).toBe(true);

      // Знак и расклад подставляются человекочитаемым названием, а не сырым ID
      const tagBanner = banners.find((b) =>
        b.text.includes(translator.getTagText('tag_investment').name),
      );
      expect(tagBanner).toBeDefined();
      expect(tagBanner?.text).not.toContain('tag_investment');

      const levelBanner = banners.find((b) =>
        b.text.includes(translator.getHandText('Pair').name),
      );
      expect(levelBanner).toBeDefined();

      expect(
        banners.some(
          (b) => b.tone === 'boss' && b.text === translator.t('boss_psychic', { count: 5 }),
        ),
      ).toBe(true);
      expect(
        banners.some((b) => b.tone === 'win' && b.text === translator.t('run_won', { ante: 8 })),
      ).toBe(true);
      expect(
        banners.some((b) => b.tone === 'lose' && b.text === translator.t('run_lost', { ante: 3 })),
      ).toBe(true);

      for (const popup of popups) {
        expect(popup.text).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
      }
      for (const banner of banners) {
        expect(banner.text).not.toMatch(/\{[a-zA-Z0-9_]+\}/);
      }
    }
  });

  it('увеличивает comboIndex на цепочке триггеров подсчёта и сбрасывает после SCORE_UPDATE', async () => {
    const translator = createTranslator('ru');
    const audioCalls: Array<{ type: TraceEvent['type']; comboIndex: number }> = [];

    const events: TraceEvent[] = [
      { type: 'CARD_TRIGGER', cardId: 'c1', retriggerIndex: 0, chipsDelta: 10 },
      { type: 'CARD_TRIGGER', cardId: 'c2', retriggerIndex: 0, multDelta: 4 },
      { type: 'HAND_CARD_TRIGGER', cardId: 'c3', retriggerIndex: 0, xMult: 1.5 },
      { type: 'RELIC_TRIGGER', relicUid: 'r1', relicId: 'j_joker', hook: 'onScoreRelic', multDelta: 4 },
      {
        type: 'CONSUMABLE_TRIGGER',
        consumableUid: 'obs',
        consumableId: 'c_mercury',
        handType: 'Pair',
        xMult: 1.5,
      },
      {
        type: 'SCORE_UPDATE',
        chips: 20,
        mult: 12,
        handScore: 240,
        totalScore: 240,
        targetScore: 300,
        handType: 'Pair',
      },
      { type: 'RELIC_TRIGGER', relicUid: 'r2', relicId: 'j_golden', hook: 'onRoundEnd', dollarsDelta: 4 },
    ];

    const handle = playTraceEvents(events, 4, {
      translator,
      audio: {
        playForTraceEvent: (event, comboIndex) => {
          audioCalls.push({ type: event.type, comboIndex });
        },
      },
    });

    await vi.runAllTimersAsync();
    await handle.promise;

    expect(audioCalls).toEqual([
      { type: 'CARD_TRIGGER', comboIndex: 0 },
      { type: 'CARD_TRIGGER', comboIndex: 1 },
      { type: 'HAND_CARD_TRIGGER', comboIndex: 2 },
      { type: 'RELIC_TRIGGER', comboIndex: 3 },
      { type: 'CONSUMABLE_TRIGGER', comboIndex: 4 },
      { type: 'SCORE_UPDATE', comboIndex: 5 },
      { type: 'RELIC_TRIGGER', comboIndex: 0 },
    ]);
  });

  it('завершается тем быстрее, чем выше AnimationSpeed (4x < 2x < 1x < 0.5x)', async () => {
    const translator = createTranslator('ru');
    const events: TraceEvent[] = [
      { type: 'CARD_TRIGGER', cardId: 'c1', retriggerIndex: 0, chipsDelta: 10 },
      { type: 'CARD_TRIGGER', cardId: 'c2', retriggerIndex: 0, chipsDelta: 10 },
      {
        type: 'SCORE_UPDATE',
        chips: 30,
        mult: 2,
        handScore: 60,
        totalScore: 60,
        targetScore: 300,
        handType: 'Pair',
      },
    ];

    const measureDuration = async (speed: 0.5 | 1 | 2 | 4): Promise<number> => {
      const start = Date.now();
      let doneAt = -1;
      const handle = playTraceEvents(events, speed, { translator });
      void handle.promise.then(() => {
        doneAt = Date.now() - start;
      });
      await vi.runAllTimersAsync();
      await handle.promise;
      return doneAt;
    };

    const t05 = await measureDuration(0.5);
    const t1 = await measureDuration(1);
    const t2 = await measureDuration(2);
    const t4 = await measureDuration(4);

    expect(t05).toBeGreaterThan(t1);
    expect(t1).toBeGreaterThan(t2);
    expect(t2).toBeGreaterThan(t4);
    expect(t4).toBeGreaterThan(0);
    // Два триггера карт + обновление счёта на 1x дают около 3 шагов (~2000 мс)
    expect(t1).toBeGreaterThanOrEqual(1800);
  });

  it('мгновенно завершает пустую очередь событий', async () => {
    const translator = createTranslator('en');
    const onScore = vi.fn();
    const handle = playTraceEvents([], 2, { translator, onScore });

    await handle.promise;
    expect(onScore).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('skip() сбрасывает задержки, применяет финальные onScore/onDollars/onShatterCard и снимает подсветки', async () => {
    const translator = createTranslator('ru');
    const onScore = vi.fn();
    const onDollars = vi.fn();
    const onShatterCard = vi.fn();
    const onHighlightCard = vi.fn();
    const onHighlightHandCard = vi.fn();
    const onHighlightRelic = vi.fn();
    const onPopup = vi.fn();
    const playForTraceEvent = vi.fn();

    const events: TraceEvent[] = [
      { type: 'CARD_TRIGGER', cardId: 'c1', retriggerIndex: 0, chipsDelta: 11 },
      { type: 'CARD_TRIGGER', cardId: 'c2', retriggerIndex: 0, chipsDelta: 10 },
      { type: 'HAND_CARD_TRIGGER', cardId: 'h1', retriggerIndex: 0, xMult: 1.5 },
      { type: 'RELIC_TRIGGER', relicUid: 'r1', relicId: 'j_joker', hook: 'onScoreRelic', multDelta: 4 },
      { type: 'DOLLAR_DELTA', delta: 3, totalDollars: 10, source: 'card' },
      { type: 'CARD_SHATTER', cardId: 'c2', reason: 'glass' },
      {
        type: 'SCORE_UPDATE',
        chips: 50,
        mult: 8,
        handScore: 400,
        totalScore: 400,
        targetScore: 300,
        handType: 'Pair',
      },
    ];

    const handle = playTraceEvents(events, 1, {
      translator,
      audio: { playForTraceEvent },
      onScore,
      onDollars,
      onShatterCard,
      onHighlightCard,
      onHighlightHandCard,
      onHighlightRelic,
      onPopup,
    });

    // Первый шаг уже начался (c1 подсвечена), но финальный результат ещё не применён
    expect(onHighlightCard).toHaveBeenCalledWith('c1');
    expect(onScore).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    handle.skip();
    await handle.promise;

    expect(vi.getTimerCount()).toBe(0);
    expect(onScore).toHaveBeenCalledTimes(1);
    expect(onScore).toHaveBeenCalledWith(50, 8, 400, 300, 'Pair');
    expect(onDollars).toHaveBeenCalledWith(10, 3);
    expect(onShatterCard).toHaveBeenCalledWith('c2');
    expect(onHighlightCard).toHaveBeenLastCalledWith(null);
    // Повторный вызов skip/cancel безопасен и не дублирует эффекты
    handle.skip();
    handle.cancel();
    expect(onScore).toHaveBeenCalledTimes(1);
  });

  it('cancel() немедленно завершает воспроизведение, чистит таймеры и не вызывает оставшиеся эффекты', async () => {
    const translator = createTranslator('ru');
    const onScore = vi.fn();
    const onDollars = vi.fn();
    const onShatterCard = vi.fn();
    const onHighlightCard = vi.fn();
    const onPopup = vi.fn();
    const playForTraceEvent = vi.fn();

    const events: TraceEvent[] = [
      { type: 'CARD_TRIGGER', cardId: 'c1', retriggerIndex: 0, chipsDelta: 11 },
      { type: 'DOLLAR_DELTA', delta: 5, totalDollars: 9, source: 'relic' },
      { type: 'CARD_SHATTER', cardId: 'c1', reason: 'glass' },
      {
        type: 'SCORE_UPDATE',
        chips: 40,
        mult: 4,
        handScore: 160,
        totalScore: 160,
        targetScore: 300,
        handType: 'Pair',
      },
    ];

    const handle = playTraceEvents(events, 1, {
      translator,
      audio: { playForTraceEvent },
      onScore,
      onDollars,
      onShatterCard,
      onHighlightCard,
      onPopup,
    });

    expect(vi.getTimerCount()).toBeGreaterThan(0);
    handle.cancel();
    await handle.promise;

    expect(vi.getTimerCount()).toBe(0);
    expect(onScore).not.toHaveBeenCalled();
    expect(onDollars).not.toHaveBeenCalled();
    expect(onShatterCard).not.toHaveBeenCalled();
    expect(onHighlightCard).toHaveBeenLastCalledWith(null);
    expect(playForTraceEvent).toHaveBeenCalledTimes(1);

    // Продвижение времени не должно вызывать оставшиеся шаги
    await vi.runAllTimersAsync();
    expect(onScore).not.toHaveBeenCalled();
    expect(playForTraceEvent).toHaveBeenCalledTimes(1);
  });

  it('не дублирует баннер hand_level_up сразу после HAND_LEVEL_UP и корректно локализует c_black_hole', async () => {
    const translator = createTranslator('ru');
    const banners: string[] = [];
    const popups: TracePopupPayload[] = [];

    const events: TraceEvent[] = [
      { type: 'HAND_LEVEL_UP', handType: 'Flush', newLevel: 3, chips: 65, mult: 8 },
      {
        type: 'CONSUMABLE_TRIGGER',
        consumableId: 'c_jupiter',
        handType: 'Flush',
        locKey: 'hand_level_up',
        locParams: { handName: 'Flush', level: 3 },
      },
      {
        type: 'CONSUMABLE_TRIGGER',
        consumableId: 'c_black_hole',
        locKey: 'consumable_all_hands_up',
        locParams: { levels: 1 },
      },
    ];

    const handle = playTraceEvents(events, 4, {
      translator,
      onBanner: (text) => banners.push(text),
      onPopup: (popup) => popups.push(popup),
    });

    await vi.runAllTimersAsync();
    await handle.promise;

    expect(banners).toEqual(['Масть: Ур. 3', 'Все комбинации +1 ур.!']);
    expect(popups.map((p) => p.text)).toEqual(['Масть: Ур. 3', 'Все комбинации +1 ур.!']);
  });
});

describe('Процедурный фон Canvas (backdropCanvas)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  it('безопасно деградирует в no-op контроллер в jsdom при getContext("2d") === null', () => {
    const canvas = document.createElement('canvas');
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

    const controller = createBackdropCanvas(canvas);
    expect(rafSpy).not.toHaveBeenCalled();

    expect(() => {
      controller.setMood('boss');
      controller.triggerPulse('#ff0000');
      controller.spawnParticles(0.5, 0.5, '#f5b942', 12);
      controller.resize();
      controller.destroy();
    }).not.toThrow();
  });

  it('не запускает rAF при document.hidden === true и корректно реагирует на visibilitychange и destroy()', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });

    const canvas = document.createElement('canvas');
    const mockCtx = createMockCanvasContext();
    vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx);

    let nextRafId = 1;
    const rafCallbacks = new Map<number, FrameRequestCallback>();
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        const id = nextRafId++;
        rafCallbacks.set(id, cb);
        return id;
      });
    const cancelSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((id: number) => {
        rafCallbacks.delete(id);
      });

    const controller = createBackdropCanvas(canvas);
    expect(rafSpy).not.toHaveBeenCalled();

    // Возврат вкладки запускает анимацию
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rafSpy).toHaveBeenCalledTimes(1);

    // Выполняем один кадр (имитируем снятие выполненного кадра браузером перед вызовом)
    const firstEntry = Array.from(rafCallbacks.entries())[0];
    expect(firstEntry).toBeDefined();
    rafCallbacks.delete(firstEntry![0]);
    firstEntry![1](16);
    expect(mockCtx.fillRect).toHaveBeenCalled();

    // Повторное скрытие вкладки останавливает анимацию
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(cancelSpy).toHaveBeenCalled();
    expect(rafCallbacks.size).toBe(0);

    // После destroy() даже возврат видимости не запускает rAF
    controller.destroy();
    const callsBeforeShow = rafSpy.mock.calls.length;
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rafSpy).toHaveBeenCalledTimes(callsBeforeShow);
  });

  it('растягивается под родителя, меняет палитру по mood, рисует импульсы и частицы', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });

    const parent = document.createElement('div');
    let parentWidth = 1280;
    let parentHeight = 720;
    vi.spyOn(parent, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          width: parentWidth,
          height: parentHeight,
          top: 0,
          left: 0,
          right: parentWidth,
          bottom: parentHeight,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    const canvas = document.createElement('canvas');
    parent.appendChild(canvas);
    const mockCtx = createMockCanvasContext();
    vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx);

    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const controller = createBackdropCanvas(canvas);
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
    expect(canvas.width).toBeGreaterThanOrEqual(1280);
    expect(canvas.height).toBeGreaterThanOrEqual(720);

    // Переключение всех режимов, импульсы и частицы
    const moods: readonly BackdropMood[] = ['menu', 'battle', 'boss', 'shop', 'victory', 'defeat'];
    for (const mood of moods) {
      controller.setMood(mood);
    }
    controller.triggerPulse();
    controller.triggerPulse('#ff4d6d');
    controller.spawnParticles(0.5, 0.4, '#f5b942', 14);

    const frame = rafCallbacks.shift();
    expect(frame).toBeDefined();
    frame!(32);
    expect(mockCtx.createRadialGradient).toHaveBeenCalled();
    expect(mockCtx.arc).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();

    // Проверка resize при смене размера родителя
    parentWidth = 720;
    parentHeight = 1280;
    controller.resize();
    expect(canvas.width).toBeGreaterThanOrEqual(720);
    expect(canvas.height).toBeGreaterThanOrEqual(1280);

    controller.destroy();
  });
});

describe('Story 2.3: синхронизация onJuice и onFormulaDelta в TracePlayer', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('вызывает onJuice и onFormulaDelta для карт, реликвий (включая повторные срабатывания) и плиток Сила/Множ', async () => {
      const translator = createTranslator('ru');
      const juiceCalls: Array<{ kind: string; id?: string }> = [];
      const formulaDeltas: Array<{ chipsDelta: number; multDelta: number; xMult: number }> = [];

      const events: readonly TraceEvent[] = [
        { type: 'CARD_TRIGGER', cardId: 'c_ace', retriggerIndex: 0, chipsDelta: 11 },
        { type: 'CARD_TRIGGER', cardId: 'c_ace', retriggerIndex: 1, multDelta: 4 },
        { type: 'HAND_CARD_TRIGGER', cardId: 'c_king', retriggerIndex: 0, xMult: 1.5 },
        {
          type: 'RELIC_TRIGGER',
          relicUid: 'rel_1',
          relicId: 'j_joker',
          hook: 'onScoreRelic',
          multDelta: 4,
        },
        {
          type: 'SCORE_UPDATE',
          chips: 41,
          mult: 12,
          handScore: 492,
          totalScore: 492,
          targetScore: 300,
          handType: 'High Card',
        },
      ];

      const handle = playTraceEvents(events, 2, {
        translator,
        onJuice: (target) => {
          const id =
            target.kind === 'card' || target.kind === 'hand_card'
              ? target.cardId
              : target.kind === 'relic'
                ? target.relicUid
                : undefined;
          juiceCalls.push({ kind: target.kind, id });
        },
        onFormulaDelta: (delta) => {
          formulaDeltas.push(delta);
        },
      });

      await vi.runAllTimersAsync();
      await handle.promise;

      // Оба триггера c_ace вызывают juice_up на карте и соответствующих плитках HUD
      expect(juiceCalls.filter((c) => c.kind === 'card' && c.id === 'c_ace')).toHaveLength(2);
      expect(juiceCalls.some((c) => c.kind === 'hand_card' && c.id === 'c_king')).toBe(true);
      expect(juiceCalls.some((c) => c.kind === 'relic' && c.id === 'rel_1')).toBe(true);
      expect(juiceCalls.some((c) => c.kind === 'chips')).toBe(true);
      expect(juiceCalls.some((c) => c.kind === 'mult')).toBe(true);

      expect(formulaDeltas).toEqual([
        { chipsDelta: 11, multDelta: 0, xMult: 1 },
        { chipsDelta: 0, multDelta: 4, xMult: 1 },
        { chipsDelta: 0, multDelta: 0, xMult: 1.5 },
        { chipsDelta: 0, multDelta: 4, xMult: 1 },
      ]);
    });

    it('не вызывает onJuice для пропущенных событий при вызове skip()', async () => {
      const translator = createTranslator('ru');
      const juiceCalls: string[] = [];
      const onScore = vi.fn();

      const events: readonly TraceEvent[] = [
        { type: 'CARD_TRIGGER', cardId: 'c_1', retriggerIndex: 0, chipsDelta: 10 },
        { type: 'RELIC_TRIGGER', relicUid: 'rel_1', relicId: 'j_joker', hook: 'onScoreRelic', multDelta: 4 },
        {
          type: 'SCORE_UPDATE',
          chips: 20,
          mult: 5,
          handScore: 100,
          totalScore: 100,
          targetScore: 300,
          handType: 'High Card',
        },
      ];

      const handle = playTraceEvents(events, 1, {
        translator,
        onScore,
        onJuice: (target) => juiceCalls.push(target.kind),
      });

      // После первого шага нажимаем skip(): оставшийся RELIC_TRIGGER не должен запускать juice_up
      const countBeforeSkip = juiceCalls.length;
      handle.skip();
      await handle.promise;

      expect(countBeforeSkip).toBeGreaterThanOrEqual(1);
      expect(juiceCalls.length).toBe(countBeforeSkip);
      expect(onScore).toHaveBeenCalledWith(20, 5, 100, 300, 'High Card');
    });

    it('вызывает onConsumableTrigger при CONSUMABLE_TRIGGER и не вызывает при дубликате или skip()', async () => {
      const translator = createTranslator('ru');
      const triggers: Array<{ consumableId: string; consumableUid?: string; targetCardIds?: readonly string[] }> = [];

      const events: readonly TraceEvent[] = [
        {
          type: 'HAND_LEVEL_UP',
          handType: 'Pair',
          newLevel: 2,
          chips: 25,
          mult: 3,
        },
        {
          type: 'CONSUMABLE_TRIGGER',
          consumableId: 'c_mercury',
          consumableUid: 'cons_1',
          handType: 'Pair',
          locKey: 'hand_level_up',
          locParams: { hand: 'Pair', level: 2 },
        },
        {
          type: 'CONSUMABLE_TRIGGER',
          consumableId: 'c_aura',
          consumableUid: 'cons_2',
          targetCardIds: ['c_ace'],
        },
        {
          type: 'CONSUMABLE_TRIGGER',
          consumableId: 'c_empress',
          consumableUid: 'cons_3',
          targetCardIds: ['c_ace'],
        },
      ];

      const handle = playTraceEvents(events, 2, {
        translator,
        onConsumableTrigger: (payload) => {
          triggers.push(payload);
        },
      });

      // HAND_LEVEL_UP подавляет дубль c_mercury (hand_level_up), и сразу на следующем шаге (через 340мс) срабатывает c_aura
      expect(triggers).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(400);
      expect(triggers).toHaveLength(1);
      expect(triggers[0]?.consumableId).toBe('c_aura');
      expect(triggers[0]?.targetCardIds).toEqual(['c_ace']);

      // Оставшийся c_empress после skip() не вызывается
      handle.skip();
      await handle.promise;
      expect(triggers).toHaveLength(1);
    });
  });

  describe('Ускорение длинных комбо G.ACC / SPEEDFACTOR и дифференцированные паузы Balatro (C4, C5)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('возвращает каноничные базовые задержки для разных типов событий (C5)', () => {
      expect(getEventBaseDelayMs({ type: 'CARD_TRIGGER', cardId: 'c1', retriggerIndex: 0, chipsDelta: 10 })).toBe(750);
      expect(getEventBaseDelayMs({ type: 'CARD_TRIGGER', cardId: 'c1', retriggerIndex: 0, multDelta: 4 })).toBe(813);
      expect(getEventBaseDelayMs({ type: 'CARD_TRIGGER', cardId: 'c1', retriggerIndex: 0, chipsDelta: 50, isEditionStep: true })).toBe(938);
      expect(getEventBaseDelayMs({ type: 'RELIC_TRIGGER', relicId: 'j_joker', relicUid: 'r1', hook: 'onAfterScore', multDelta: 4 })).toBe(938);
      expect(getEventBaseDelayMs({ type: 'RELIC_TRIGGER', relicId: 'j_mime', relicUid: 'r2', hook: 'onHoldCardRepetition', locKey: 'card_retrigger' })).toBe(563);
      expect(getEventBaseDelayMs({ type: 'SCORE_UPDATE', chips: 10, mult: 2, handScore: 20, totalScore: 20, targetScore: 300, handType: 'Pair' })).toBe(2000);
      expect(getEventBaseDelayMs({ type: 'SCORE_UPDATE', chips: 0, mult: 0, handScore: 0, totalScore: 0, targetScore: 300, handType: 'High Card' })).toBe(400);

      // Квантование 60 Гц EventManager (1000/60 мс): 750 / 4 = 187.5 -> 12 + 1 = 13 кадров (~217мс)
      expect(quantizeBalatroStepDelayMs(750, 4)).toBe(217);
      expect(quantizeBalatroStepDelayMs(0, 4)).toBe(0);
    });

    it('накапливает G.ACC (потолок 16) и ускоряет длинную 25-шаговую цепочку сверх базовой скорости (C4)', async () => {
      expect(computeComboSpeedFactor(1, 0)).toBe(1);
      expect(computeComboSpeedFactor(1, 2)).toBe(1);
      expect(computeComboSpeedFactor(1, 5)).toBe(4);
      expect(advanceComboAcc(15.9, 5, 4)).toBe(16);

      const translator = createTranslator('ru');
      const events: TraceEvent[] = Array.from({ length: 30 }, (_, i) => ({
        type: 'CARD_TRIGGER' as const,
        cardId: `card_${i}`,
        retriggerIndex: 0,
        chipsDelta: 5,
      }));

      let completed = false;
      const handle = playTraceEvents(events, 1, { translator });
      void handle.promise.then(() => {
        completed = true;
      });

      // Без ACC 30 шагов по 750мс заняли бы 22500мс; с G.ACC/SPEEDFACTOR всё завершается раньше 18500мс
      await vi.advanceTimersByTimeAsync(18500);
      expect(completed).toBe(true);
    });

    it('проигрывает вступительные шаги leadInSteps перед триггерами и корректно сбрасывает их по skip()', async () => {
      const translator = createTranslator('ru');
      const order: string[] = [];
      const handle = playTraceEvents(
        [{ type: 'CARD_TRIGGER', cardId: 'c1', retriggerIndex: 0, chipsDelta: 11 }],
        1,
        {
          translator,
          onPopup: () => order.push('popup'),
        },
        {
          leadInSteps: [
            { delayMs: 700, onTrigger: () => order.push('deal_wait') },
            { delayMs: 100, highlightCardId: 'c1', onTrigger: () => order.push('highlight') },
          ],
        },
      );

      expect(order).toEqual(['deal_wait']);
      await vi.advanceTimersByTimeAsync(750);
      expect(order).toEqual(['deal_wait', 'highlight']);

      handle.skip();
      await handle.promise;
      // Пропущенное событие CARD_TRIGGER не вызывает onPopup после skip()
      expect(order).toEqual(['deal_wait', 'highlight']);
    });
  });
