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

  it('реагирует на setPlatformPaused и window.blur / focus', () => {
    const controller = createAudioUnlockController();
    const history: boolean[] = [];
    controller.subscribeMute((m) => history.push(m));
    controller.install();

    controller.setPlatformPaused(true);
    expect(controller.isMutedByPlatform()).toBe(true);

    controller.setPlatformPaused(false);
    expect(controller.isMutedByPlatform()).toBe(false);

    window.dispatchEvent(new Event('blur'));
    expect(controller.isMutedByPlatform()).toBe(true);

    window.dispatchEvent(new Event('focus'));
    expect(controller.isMutedByPlatform()).toBe(false);

    expect(history).toEqual([true, false, true, false]);
    controller.dispose();
  });
});
