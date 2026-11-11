import type { AudioUnlockController } from './types';

// Минимальный 1-семпловый WAV тишины для обхода переключателя беззвучного режима на iOS
const SILENCE_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1)
  );
}

function isDocumentHidden(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.hidden || document.visibilityState === 'hidden');
}

/**
 * Создаёт контроллер разблокировки Web Audio и платформенного мьюта при рекламе/паузе/сворачивании.
 */
export function createAudioUnlockController(): AudioUnlockController {
  let installed = false;
  let hasUserInteracted = false;
  let adShowing = false;
  let platformPaused = false;
  let pageHidden = false;
  let lastMuted: boolean | null = null;
  let iosChannelAudio: HTMLAudioElement | null = null;

  const contexts = new Set<AudioContext>();
  const unlockedContexts = new WeakSet<AudioContext>();
  const muteListeners = new Set<(muted: boolean) => void>();

  const isMutedByPlatform = (): boolean =>
    adShowing || platformPaused || pageHidden || isDocumentHidden();

  const notifyMuteIfChanged = (): void => {
    const muted = isMutedByPlatform();
    if (muted === lastMuted) return;
    lastMuted = muted;
    for (const listener of muteListeners) {
      try {
        listener(muted);
      } catch {
        // Ошибки пользовательских подписчиков не должны ломать цикл событий
      }
    }
  };

  const ensureIosSilentTag = (): void => {
    if (!isIosDevice() || typeof Audio === 'undefined' || isMutedByPlatform()) return;
    try {
      if (!iosChannelAudio) {
        iosChannelAudio = new Audio(SILENCE_WAV_DATA_URI);
        iosChannelAudio.loop = true;
        iosChannelAudio.setAttribute('playsinline', 'true');
      }
      if (iosChannelAudio.paused) {
        const playPromise = iosChannelAudio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      }
    } catch {
      // Игнорируем ограничения автоплея вне пользовательского жеста
    }
  };

  const pauseIosSilentTag = (): void => {
    if (!iosChannelAudio) return;
    try {
      iosChannelAudio.pause();
    } catch {
      // Игнорируем
    }
  };

  const suspendContexts = (): void => {
    pauseIosSilentTag();
    for (const ctx of contexts) {
      try {
        if (ctx.state === 'running' && typeof ctx.suspend === 'function') {
          const suspended = ctx.suspend();
          if (suspended && typeof suspended.catch === 'function') {
            suspended.catch(() => {});
          }
        }
      } catch {
        // Некоторые среды не поддерживают программный suspend
      }
    }
  };

  const destroyIosSilentTag = (): void => {
    if (!iosChannelAudio) return;
    try {
      iosChannelAudio.pause();
      iosChannelAudio.src = '';
    } catch {
      // Игнорируем
    }
    iosChannelAudio = null;
  };

  const unlockSingleContext = (ctx: AudioContext): void => {
    try {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        const resumed = ctx.resume();
        if (resumed && typeof resumed.catch === 'function') {
          resumed.catch(() => {});
        }
      }
      if (
        !unlockedContexts.has(ctx) &&
        typeof ctx.createBuffer === 'function' &&
        typeof ctx.createBufferSource === 'function' &&
        ctx.destination
      ) {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        unlockedContexts.add(ctx);
      }
    } catch {
      // Некоторые среды (например jsdom или строгий autoplay) не поддерживают все методы AudioContext
    }
  };

  const unlock = (): void => {
    hasUserInteracted = true;
    if (isMutedByPlatform()) return;
    for (const ctx of contexts) {
      unlockSingleContext(ctx);
    }
    ensureIosSilentTag();
  };

  const handleVisibility = (): void => {
    notifyMuteIfChanged();
    if (isMutedByPlatform()) {
      suspendContexts();
    } else if (hasUserInteracted) {
      unlock();
    }
  };

  const handlePageHide = (): void => {
    pageHidden = true;
    handleVisibility();
  };

  const handlePageShow = (): void => {
    pageHidden = false;
    handleVisibility();
  };

  const handleGesture = (): void => {
    if (pageHidden) {
      pageHidden = false;
      notifyMuteIfChanged();
    }
    unlock();
  };

  const gestureEvents = ['pointerdown', 'touchstart', 'mousedown', 'keydown'] as const;

  const install = (): void => {
    if (installed) return;
    installed = true;
    lastMuted = isMutedByPlatform();

    if (typeof window !== 'undefined') {
      for (const evt of gestureEvents) {
        window.addEventListener(evt, handleGesture, { capture: true, passive: true });
      }
      // Не глушим звук на window.blur: внутри iframe клик по шапке площадки уводит фокус окна
      window.addEventListener('pageshow', handlePageShow);
      window.addEventListener('pagehide', handlePageHide);
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
  };

  const dispose = (): void => {
    if (installed) {
      if (typeof window !== 'undefined') {
        for (const evt of gestureEvents) {
          window.removeEventListener(evt, handleGesture, { capture: true });
        }
        window.removeEventListener('pageshow', handlePageShow);
        window.removeEventListener('pagehide', handlePageHide);
      }

      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      installed = false;
    }

    hasUserInteracted = false;
    adShowing = false;
    platformPaused = false;
    pageHidden = false;
    destroyIosSilentTag();
    contexts.clear();
    muteListeners.clear();
  };

  const registerContext = (ctx: AudioContext): void => {
    contexts.add(ctx);
    if (hasUserInteracted && !isMutedByPlatform() && ctx.state === 'suspended') {
      unlockSingleContext(ctx);
    }
  };

  const setPlatformPaused = (paused: boolean): void => {
    platformPaused = paused;
    handleVisibility();
  };

  const onAdStart = (): void => {
    adShowing = true;
    notifyMuteIfChanged();
    suspendContexts();
  };

  const onAdEnd = (): void => {
    adShowing = false;
    notifyMuteIfChanged();
    if (hasUserInteracted && !isMutedByPlatform()) {
      unlock();
    }
  };

  const subscribeMute = (listener: (muted: boolean) => void): (() => void) => {
    muteListeners.add(listener);
    return () => {
      muteListeners.delete(listener);
    };
  };

  return {
    install,
    dispose,
    unlock,
    registerContext,
    setPlatformPaused,
    onAdStart,
    onAdEnd,
    isMutedByPlatform,
    subscribeMute,
  };
}
