import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioUnlockController } from '../../src/platform/audioUnlock';

describe('createAudioUnlockController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  it('отслеживает состояние мьюта при рекламе и скрытии вкладки без лишних уведомлений', () => {
    const controller = createAudioUnlockController();
    const muteHistory: boolean[] = [];
    const unsubscribe = controller.subscribeMute((muted) => muteHistory.push(muted));

    controller.install();
    expect(controller.isMutedByPlatform()).toBe(false);

    // Реклама включает мьют
    controller.onAdStart();
    controller.onAdStart(); // повторный вызов не должен дублировать событие
    expect(controller.isMutedByPlatform()).toBe(true);

    // Скрытие вкладки во время рекламы сохраняет мьют, возврат вкладки его не снимает
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(controller.isMutedByPlatform()).toBe(true);

    // Окончание рекламы при видимой вкладке снимает мьют
    controller.onAdEnd();
    expect(controller.isMutedByPlatform()).toBe(false);

    // Скрытие вкладки вне рекламы включает мьют
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(controller.isMutedByPlatform()).toBe(true);

    // Возврат вкладки снимает мьют
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(controller.isMutedByPlatform()).toBe(false);

    expect(muteHistory).toEqual([true, false, true, false]);

    unsubscribe();
    controller.dispose();
  });

  it('разблокирует зарегистрированный AudioContext по пользовательскому жесту', () => {
    const controller = createAudioUnlockController();
    const resume = vi.fn().mockResolvedValue(undefined);
    const start = vi.fn();
    const connect = vi.fn();
    const createBuffer = vi.fn().mockReturnValue({});
    const createBufferSource = vi.fn().mockReturnValue({
      buffer: null,
      connect,
      start,
    });

    const fakeCtx = {
      state: 'suspended',
      destination: {},
      resume,
      createBuffer,
      createBufferSource,
    } as unknown as AudioContext;

    controller.install();
    controller.registerContext(fakeCtx);

    window.dispatchEvent(new Event('pointerdown'));

    expect(resume).toHaveBeenCalledTimes(1);
    expect(createBuffer).toHaveBeenCalledWith(1, 1, 22050);
    expect(start).toHaveBeenCalledWith(0);

    controller.dispose();
    // После dispose новые события не вызывают resume
    window.dispatchEvent(new Event('pointerdown'));
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('реагирует на setPlatformPaused и window.pagehide/pageshow, но не глушится на window.blur и не дублирует слушатели на document', () => {
    const docAddSpy = vi.spyOn(document, 'addEventListener');
    const controller = createAudioUnlockController();
    const history: boolean[] = [];
    controller.subscribeMute((m) => history.push(m));
    controller.install();

    const docEvents = docAddSpy.mock.calls.map(([evt]) => evt);
    expect(docEvents).not.toContain('pageshow');
    expect(docEvents).not.toContain('pagehide');

    controller.setPlatformPaused(true);
    expect(controller.isMutedByPlatform()).toBe(true);

    controller.setPlatformPaused(false);
    expect(controller.isMutedByPlatform()).toBe(false);

    // Клик по шапке/оверлею портала вызывает blur у iframe — звук не должен пропадать
    window.dispatchEvent(new Event('blur'));
    expect(controller.isMutedByPlatform()).toBe(false);

    window.dispatchEvent(new Event('pagehide'));
    expect(controller.isMutedByPlatform()).toBe(true);

    window.dispatchEvent(new Event('pageshow'));
    expect(controller.isMutedByPlatform()).toBe(false);

    expect(history).toEqual([true, false, true, false]);
    controller.dispose();
  });

  it('приостанавливает running AudioContext при глушении и возобновляет после снятия мьюта', () => {
    const controller = createAudioUnlockController();
    const suspend = vi.fn().mockResolvedValue(undefined);
    const resume = vi.fn().mockResolvedValue(undefined);
    const fakeCtx = {
      state: 'running',
      destination: {},
      suspend,
      resume,
      createBuffer: vi.fn().mockReturnValue({}),
      createBufferSource: vi.fn().mockReturnValue({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
      }),
    } as unknown as AudioContext;

    controller.install();
    controller.registerContext(fakeCtx);

    // Имитируем первый пользовательский жест (звук разблокирован)
    window.dispatchEvent(new Event('pointerdown'));
    resume.mockClear();

    // Во время рекламы/паузы контекст уходит в suspend()
    controller.onAdStart();
    expect(suspend).toHaveBeenCalledTimes(1);

    // Имитация состояния suspended перед выходом из рекламы
    (fakeCtx as { state: string }).state = 'suspended';
    controller.onAdEnd();
    expect(resume).toHaveBeenCalledTimes(1);

    controller.dispose();
  });
});
