import './style.css';
import { platformBridge } from './platform';
import type { SupportedLang } from './platform';

const UI_TEXT: Record<
  SupportedLang,
  {
    subtitle: string;
    stubTitle: string;
    stubBody: string;
    footer: string;
    debugFooter: string;
    debugTitle: string;
    btnInterstitial: string;
    btnRewarded: string;
    btnSave: string;
    btnLoad: string;
    readyLog: string;
  }
> = {
  ru: {
    subtitle: 'Карточный рогалик • Портрет 720×1280',
    stubTitle: 'Базовый каркас запущен',
    stubBody:
      'Платформенный мост и разблокировка аудио инициализированы. Ядро карт и раундов будет добавлено в следующих модулях.',
    footer: 'Для открытия отладочных кнопок добавьте ?debug к URL',
    debugFooter: 'Режим отладки активен (?debug)',
    debugTitle: 'Отладка моста (?debug)',
    btnInterstitial: 'Interstitial',
    btnRewarded: 'Rewarded',
    btnSave: 'Сохранить тест',
    btnLoad: 'Загрузить',
    readyLog: 'Ожидание действий…',
  },
  en: {
    subtitle: 'Card Roguelike • Portrait 720×1280',
    stubTitle: 'Base Shell Ready',
    stubBody:
      'Platform bridge and audio unlock controller are active. Card engine and rounds will be added in upcoming modules.',
    footer: 'Append ?debug to the URL to inspect bridge test controls',
    debugFooter: 'Debug mode active (?debug)',
    debugTitle: 'Bridge Debug (?debug)',
    btnInterstitial: 'Interstitial',
    btnRewarded: 'Rewarded',
    btnSave: 'Save Test',
    btnLoad: 'Load Save',
    readyLog: 'Idle…',
  },
};

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  textContent?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}

function renderShell(root: HTMLElement): void {
  const lang = platformBridge.getLanguage();
  const copy = UI_TEXT[lang];
  const platformId = platformBridge.getPlatformId();
  const isDebug = platformBridge.isDebugMode();

  root.replaceChildren();

  const stage = createElement('main', 'stage-portrait');
  stage.setAttribute('data-design-resolution', '720x1280');

  // Верхняя шапка с названием и бейджами среды
  const header = createElement('header', 'stage-header');
  const brand = createElement('div', 'brand');
  brand.appendChild(createElement('h1', 'brand-title', 'BALITE'));
  brand.appendChild(createElement('p', 'brand-subtitle', copy.subtitle));

  const chips = createElement('div', 'status-chips');
  chips.appendChild(createElement('span', 'chip', `sdk: ${platformId}`));
  chips.appendChild(createElement('span', 'chip', `lang: ${lang}`));
  chips.appendChild(createElement('span', 'chip', isDebug ? 'debug' : 'release'));

  header.append(brand, chips);

  // Центральная карточка-заглушка
  const hero = createElement('section', 'hero-card');
  hero.appendChild(createElement('h2', undefined, copy.stubTitle));
  hero.appendChild(createElement('p', undefined, copy.stubBody));

  stage.append(header, hero);

  // Панель отладки отображается исключительно при ?debug
  if (isDebug) {
    const debugPanel = createElement('section', 'debug-panel');
    debugPanel.setAttribute('data-debug-panel', '1');
    debugPanel.appendChild(createElement('div', 'debug-title', copy.debugTitle));

    const actions = createElement('div', 'debug-actions');
    const logEl = createElement('pre', 'debug-log', copy.readyLog);
    const writeLog = (msg: string): void => {
      logEl.textContent = msg;
    };

    const btnInter = createElement('button', 'debug-btn', copy.btnInterstitial);
    btnInter.type = 'button';
    btnInter.addEventListener('click', async () => {
      writeLog('showInterstitial()...');
      const res = await platformBridge.showInterstitial();
      writeLog(`interstitial => ${JSON.stringify(res)}`);
    });

    const btnRew = createElement('button', 'debug-btn', copy.btnRewarded);
    btnRew.type = 'button';
    btnRew.addEventListener('click', async () => {
      writeLog('showRewarded()...');
      const res = await platformBridge.showRewarded();
      writeLog(`rewarded => ${JSON.stringify(res)}`);
    });

    const btnSave = createElement('button', 'debug-btn', copy.btnSave);
    btnSave.type = 'button';
    btnSave.addEventListener('click', async () => {
      const ok = await platformBridge.savePlayerData({
        debugPingAt: Date.now(),
        platform: platformId,
      });
      writeLog(`savePlayerData() => ${String(ok)}`);
    });

    const btnLoad = createElement('button', 'debug-btn', copy.btnLoad);
    btnLoad.type = 'button';
    btnLoad.addEventListener('click', async () => {
      const data = await platformBridge.loadPlayerData();
      writeLog(`loadPlayerData() => ${JSON.stringify(data)}`);
    });

    actions.append(btnInter, btnRew, btnSave, btnLoad);
    debugPanel.append(actions, logEl);
    stage.appendChild(debugPanel);
  }

  stage.appendChild(createElement('footer', 'stage-footer', isDebug ? copy.debugFooter : copy.footer));
  root.appendChild(stage);
}

async function bootstrap(): Promise<void> {
  platformBridge.audio.install();
  await platformBridge.init();

  const root = document.getElementById('app');
  if (root) {
    renderShell(root);
  }

  platformBridge.ready();
}

void bootstrap();
