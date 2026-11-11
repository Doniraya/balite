import type {
  AdapterContext,
  InterstitialResult,
  RewardedResult,
} from './types';

const loadedScriptPromises = new Map<string, Promise<void>>();

/**
 * Ограничивает ожидание промиса заданным таймаутом и очищает таймер после завершения.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Таймаут ожидания (${timeoutMs}мс): ${label}`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Лениво загружает внешний скрипт не более одного раза при успешной загрузке.
 */
export function loadScriptOnce(src: string, timeoutMs = 5000): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('DOM недоступен для загрузки скрипта'));
  }

  const existing = loadedScriptPromises.get(src);
  if (existing) {
    return existing;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;

    let settled = false;
    const cleanupScript = (removeTag: boolean): void => {
      clearTimeout(timer);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      if (removeTag) {
        script.remove();
      }
    };

    const onLoad = (): void => {
      if (settled) return;
      settled = true;
      cleanupScript(false);
      resolve();
    };

    const onError = (): void => {
      if (settled) return;
      settled = true;
      cleanupScript(true);
      loadedScriptPromises.delete(src);
      reject(new Error(`Ошибка загрузки скрипта: ${src}`));
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanupScript(true);
      loadedScriptPromises.delete(src);
      reject(new Error(`Таймаут загрузки скрипта: ${src}`));
    }, timeoutMs);

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);

    (document.head ?? document.documentElement).appendChild(script);
  });

  loadedScriptPromises.set(src, promise);
  return promise;
}

export interface SandboxAdResult {
  completed: boolean;
}

/**
 * Показывает отладочный оверлей песочницы для тестирования рекламы без SDK площадки.
 */
export function showSandboxAdOverlay(
  kind: 'interstitial' | 'rewarded',
  delayMs = 420,
): Promise<SandboxAdResult> {
  const safeDelay = Math.max(0, delayMs);

  if (typeof document === 'undefined' || !document.body) {
    return new Promise<SandboxAdResult>((resolve) => {
      setTimeout(() => resolve({ completed: true }), safeDelay);
    });
  }

  return new Promise<SandboxAdResult>((resolve) => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-balite-sandbox-ad', kind);
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.gap = '14px';
    overlay.style.background = 'rgba(10, 12, 18, 0.92)';
    overlay.style.color = '#f4f6fb';
    overlay.style.fontFamily = 'system-ui, sans-serif';
    overlay.style.textAlign = 'center';
    overlay.style.padding = '24px';

    const title = document.createElement('div');
    title.textContent =
      kind === 'rewarded'
        ? '[Sandbox] Rewarded Ad (эмуляция награды)'
        : '[Sandbox] Interstitial Ad (эмуляция паузы)';
    title.style.fontSize = '18px';
    title.style.fontWeight = '700';

    const subtitle = document.createElement('div');
    subtitle.textContent = `Автозавершение через ${safeDelay} мс`;
    subtitle.style.fontSize = '13px';
    subtitle.style.opacity = '0.8';

    overlay.appendChild(title);
    overlay.appendChild(subtitle);

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (completed: boolean): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      overlay.remove();
      resolve({ completed });
    };

    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.style.padding = '10px 18px';
    actionBtn.style.borderRadius = '8px';
    actionBtn.style.border = '1px solid rgba(255,255,255,0.28)';
    actionBtn.style.background = '#24304a';
    actionBtn.style.color = '#fff';
    actionBtn.style.cursor = 'pointer';

    if (kind === 'rewarded') {
      actionBtn.setAttribute('data-balite-sandbox-cancel', '1');
      actionBtn.textContent = 'Отмена (без награды)';
      actionBtn.addEventListener('click', () => finish(false));
    } else {
      actionBtn.setAttribute('data-balite-sandbox-close', '1');
      actionBtn.textContent = 'Закрыть';
      actionBtn.addEventListener('click', () => finish(true));
    }

    overlay.appendChild(actionBtn);
    document.body.appendChild(overlay);

    timer = setTimeout(() => finish(true), safeDelay);
  });
}

/**
 * Общий сценарий эмуляции межстраничной рекламы в debug-песочнице.
 */
export async function runSandboxInterstitial<TSave extends Record<string, unknown>>(
  ctx: AdapterContext<TSave>,
): Promise<InterstitialResult> {
  if (!ctx.isDebug) return { shown: false };
  ctx.emit('interstitial_open', { mock: true });
  await showSandboxAdOverlay('interstitial', ctx.sandboxMockDelayMs);
  ctx.emit('interstitial_close', { shown: true, mock: true });
  return { shown: true };
}

/**
 * Общий сценарий эмуляции рекламы с вознаграждением в debug-песочнице.
 */
export async function runSandboxRewarded<TSave extends Record<string, unknown>>(
  ctx: AdapterContext<TSave>,
): Promise<RewardedResult> {
  if (!ctx.isDebug) return { rewarded: false };
  ctx.emit('rewarded_open', { mock: true });
  const { completed } = await showSandboxAdOverlay('rewarded', ctx.sandboxMockDelayMs);
  if (completed) {
    ctx.emit('rewarded_rewarded', { mock: true });
  }
  ctx.emit('rewarded_closed', { rewarded: completed, mock: true });
  return { rewarded: completed };
}
