import './modals.css';
import {
  BOSS_IDS,
  CELESTIAL_IDS,
  CHARTER_IDS,
  COLLECTION_EDITIONS,
  COLLECTION_PACK_IDS,
  DECK_IDS,
  DECK_VIEW_SUIT_ORDER,
  HAND_TYPES,
  REGULAR_MONSTER_IDS,
  RELIC_IDS,
  RUNE_IDS,
  SCROLL_IDS,
  TAG_IDS,
  buildDeckViewModel,
  countMetaDiscoveries,
  createPlayingCard,
  formatBalatroNumber,
  getMostPlayedHand,
  type AnimationSpeed,
  type CardBackStyle,
  type CrtMode,
  type DeckViewCardEntry,
  type DeckViewMode,
  type GameSettings,
  type HandType,
  type MetaSave,
  type MetaStats,
  type PlayingCard,
  type Rank,
  type RunState,
  type Suit,
  type SuitPalette,
} from '../engine';
import {
  getGuildRank,
  isDevOriginalTermsEnabled,
  type I18nLang,
  type Translator,
} from '../i18n';
import { renderEntityCardFrame, renderPlayingCardFrame } from './cardFrame';
import { APP_VERSION } from './mainMenu';
import { renderHandExamplePopup } from './runInfoExamples';
import {
  buildBlindTooltip,
  buildCharterTooltip,
  buildPlayingCardTooltip,
  buildTagTooltip,
  createBlindEmblem,
} from './screens';
import { setTooltipData } from './tooltip';

/**
 * Активный экран внутри модального хаба «Параметры».
 */
export type SettingsModalTab = 'hub' | 'settings' | 'stats' | 'customize_deck' | 'credits';

/**
 * Параметры отрисовки модального хаба «Параметры» и вложенных вкладок.
 */
export interface SettingsModalOptions {
  readonly settings: GameSettings;
  readonly translator: Translator;
  readonly meta?: MetaSave;
  readonly version?: string;
  readonly initialTab?: SettingsModalTab;
  readonly canReturnToMainMenu?: boolean;
  readonly platformId?: string;
  readonly isDebug?: boolean;
  readonly devOriginalTermsEnabled?: boolean;
  readonly onToggleDevOriginalTerms?: (enabled: boolean) => void;
  readonly onChangeSettings: (patch: Partial<GameSettings>) => void;
  readonly onClose: () => void;
  readonly onReturnToMainMenu?: () => void;
  readonly onTabChange?: (tab: SettingsModalTab) => void;
  readonly onResetTutorial?: () => void;
  readonly onOpenLeaderboard?: () => void;
  readonly canShowShortcutPrompt?: boolean;
  readonly onAddShortcut?: () => void;
  readonly onOpenDebugPanel?: () => void;
  readonly onDebugAction?: (
    action: 'interstitial' | 'rewarded' | 'flush' | 'resetRun',
  ) => Promise<string>;
}

/**
 * Допустимые значения скорости анимаций для сегментированного переключателя.
 */
const SPEED_OPTIONS: ReadonlyArray<{
  readonly value: AnimationSpeed;
  readonly key:
    | 'ui.settings.speed05x'
    | 'ui.settings.speed1x'
    | 'ui.settings.speed2x'
    | 'ui.settings.speed4x';
}> = [
  { value: 0.5, key: 'ui.settings.speed05x' },
  { value: 1, key: 'ui.settings.speed1x' },
  { value: 2, key: 'ui.settings.speed2x' },
  { value: 4, key: 'ui.settings.speed4x' },
];

/**
 * Допустимые режимы ЭЛТ-оверлея для сегментированного переключателя.
 */
const CRT_MODE_OPTIONS: ReadonlyArray<{
  readonly value: CrtMode;
  readonly key: 'ui.settings.crtOff' | 'ui.settings.crtLight' | 'ui.settings.crtOriginal';
}> = [
  { value: 'off', key: 'ui.settings.crtOff' },
  { value: 'light', key: 'ui.settings.crtLight' },
  { value: 'original', key: 'ui.settings.crtOriginal' },
];

/**
 * Допустимые палитры мастей игральных карт.
 */
const SUIT_PALETTE_OPTIONS: ReadonlyArray<{
  readonly value: SuitPalette;
  readonly key: 'ui.settings.suitPaletteStandard' | 'ui.settings.suitPaletteHighContrast';
}> = [
  { value: 'standard', key: 'ui.settings.suitPaletteStandard' },
  { value: 'high_contrast', key: 'ui.settings.suitPaletteHighContrast' },
];

/**
 * Допустимые стили оформления рубашки колоды.
 */
const CARD_BACK_OPTIONS: ReadonlyArray<{
  readonly value: CardBackStyle;
  readonly key:
    | 'ui.settings.cardBackDefault'
    | 'ui.settings.cardBackRed'
    | 'ui.settings.cardBackBlue'
    | 'ui.settings.cardBackYellow'
    | 'ui.settings.cardBackBlack';
}> = [
  { value: 'default', key: 'ui.settings.cardBackDefault' },
  { value: 'b_red', key: 'ui.settings.cardBackRed' },
  { value: 'b_blue', key: 'ui.settings.cardBackBlue' },
  { value: 'b_yellow', key: 'ui.settings.cardBackYellow' },
  { value: 'b_black', key: 'ui.settings.cardBackBlack' },
];

/**
 * Варианты отладочных действий для режима разработчика (?debug).
 */
const DEBUG_ACTIONS: ReadonlyArray<{
  readonly action: 'interstitial' | 'rewarded' | 'flush' | 'resetRun';
  readonly label: string;
}> = [
  { action: 'interstitial', label: 'showInterstitial()' },
  { action: 'rewarded', label: 'showRewarded()' },
  { action: 'flush', label: 'flushCloudSave()' },
  { action: 'resetRun', label: 'resetRun()' },
];

/**
 * Создаёт единый каркас модального окна с затемнённым фоном, шапкой, телом и кнопкой закрытия.
 */
function createModalShell(
  titleText: string,
  subtitleText: string | null,
  translator: Translator,
  onClose: () => void,
  modalName: string,
): {
  readonly backdrop: HTMLDivElement;
  readonly sheet: HTMLDivElement;
  readonly body: HTMLDivElement;
  readonly footer: HTMLDivElement;
} {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.dataset.modal = modalName;

  // Тап непосредственно по затемнённому фону закрывает окно, тапы по содержимому — нет
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      onClose();
    }
  });

  const sheet = document.createElement('div');
  sheet.className = 'modal-sheet';
  backdrop.appendChild(sheet);

  const header = document.createElement('div');
  header.className = 'modal-header';

  const titleWrap = document.createElement('div');
  const titleEl = document.createElement('h2');
  titleEl.className = 'modal-title';
  titleEl.textContent = titleText;
  titleWrap.appendChild(titleEl);

  if (subtitleText) {
    const subtitleEl = document.createElement('p');
    subtitleEl.className = 'modal-subtitle';
    subtitleEl.textContent = subtitleText;
    titleWrap.appendChild(subtitleEl);
  }

  header.appendChild(titleWrap);
  sheet.appendChild(header);

  const body = document.createElement('div');
  body.className = 'modal-body';
  sheet.appendChild(body);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-btn modal-btn--full';
  closeBtn.dataset.action = 'close';
  closeBtn.textContent = translator.t('ui.actions.close');
  closeBtn.addEventListener('click', onClose);
  footer.appendChild(closeBtn);

  sheet.appendChild(footer);

  return { backdrop, sheet, body, footer };
}

/**
 * Активная вкладка в окне «Детали партии» (Run Info).
 */
export type RunInfoTab = 'hands' | 'blinds' | 'vouchers';

/**
 * Отрисовывает модальное окно деталей партии (Run Info) по эталону Balatro
 * с 3 вкладками («Комбинации», «Заказы», «Привилегии»), интерактивными 5 картами-примерами,
 * карточками заказов текущего Этажа и сеткой купленных ваучеров.
 */
export function renderRunInfoModal(
  state: RunState,
  translator: Translator,
  onClose: () => void,
  initialTab: RunInfoTab = 'hands',
): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.dataset.modal = 'run-info';

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      onClose();
    }
  });

  const sheet = document.createElement('div');
  sheet.className = 'modal-sheet modal-sheet--run-info';
  backdrop.appendChild(sheet);

  let currentTab: RunInfoTab = initialTab;

  // Шапка с 3 вкладками
  const header = document.createElement('div');
  header.className = 'run-info-header';

  const tabList = document.createElement('div');
  tabList.className = 'run-info-tabs';
  tabList.setAttribute('role', 'tablist');

  const tabsConfig: ReadonlyArray<{ id: RunInfoTab; labelKey: string }> = [
    { id: 'hands', labelKey: 'ui.runInfo.tabs.hands' },
    { id: 'blinds', labelKey: 'ui.runInfo.tabs.blinds' },
    { id: 'vouchers', labelKey: 'ui.runInfo.tabs.vouchers' },
  ];

  const tabButtons = new Map<RunInfoTab, HTMLButtonElement>();

  const body = document.createElement('div');
  body.className = 'run-info-body modal-body';

  function updateTabsUi(): void {
    for (const [tabId, btn] of tabButtons.entries()) {
      const isActive = tabId === currentTab;
      btn.classList.toggle('run-info-tab--active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      const arrow = btn.querySelector('.run-info-tab-arrow');
      if (isActive && !arrow) {
        const arrowEl = document.createElement('span');
        arrowEl.className = 'run-info-tab-arrow';
        arrowEl.setAttribute('aria-hidden', 'true');
        arrowEl.textContent = '▼';
        btn.prepend(arrowEl);
      } else if (!isActive && arrow) {
        arrow.remove();
      }
    }
  }

  function renderCurrentTabContent(): void {
    body.innerHTML = '';
    if (currentTab === 'hands') {
      renderHandsTab(body, state, translator);
    } else if (currentTab === 'blinds') {
      renderBlindsTab(body, state, translator);
    } else {
      renderVouchersTab(body, state, translator);
    }
  }

  for (const { id, labelKey } of tabsConfig) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'run-info-tab';
    btn.dataset.tab = id;
    btn.setAttribute('role', 'tab');
    btn.textContent = translator.t(labelKey);
    btn.addEventListener('click', () => {
      if (currentTab !== id) {
        currentTab = id;
        updateTabsUi();
        renderCurrentTabContent();
      }
    });
    tabButtons.set(id, btn);
    tabList.appendChild(btn);
  }

  header.appendChild(tabList);
  sheet.appendChild(header);
  sheet.appendChild(body);

  // Нижняя оранжево-золотая кнопка «Назад»
  const footer = document.createElement('div');
  footer.className = 'run-info-footer modal-footer';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'run-info-back-btn modal-btn modal-btn--full';
  backBtn.dataset.action = 'close';
  backBtn.textContent = translator.t('ui.runInfo.backButton');
  backBtn.addEventListener('click', onClose);
  footer.appendChild(backBtn);
  sheet.appendChild(footer);

  updateTabsUi();
  renderCurrentTabContent();

  return backdrop;
}

/**
 * Отрисовывает содержимое вкладки «Комбинации» с овалами формул и интерактивным поп-апом с 5 картами.
 */
const TOP_HAND_TYPES = new Set<HandType>([
  'Three of a Kind',
  'Two Pair',
  'Pair',
  'High Card',
]);

function renderHandsTab(
  container: HTMLElement,
  state: RunState,
  translator: Translator,
): void {
  const list = document.createElement('div');
  list.className = 'run-info-hands-list hand-ref-list';

  let activePopup: HTMLElement | null = null;

  function closePopup(): void {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
  }

  for (const handType of HAND_TYPES) {
    const levelState = state.handLevels[handType];
    const row = document.createElement('div');
    row.className = 'run-info-hand-row hand-ref-row';
    if (!levelState.visible) {
      row.classList.add('run-info-hand-row--hidden', 'hand-ref-row--hidden');
    }
    row.dataset.handType = handType;
    row.dataset.visible = String(levelState.visible);

    // Слева бейдж уровня: [ ур.1 ]
    const levelBadge = document.createElement('div');
    levelBadge.className = 'run-info-level-badge hand-ref-level';
    levelBadge.textContent = translator.t('ui.handReference.level', {
      level: levelState.level,
    });

    // Название комбинации
    const nameEl = document.createElement('div');
    nameEl.className = 'run-info-hand-name hand-ref-name';

    if (levelState.visible) {
      const handText = translator.getHandText(handType);
      nameEl.textContent = handText.name;
    } else {
      nameEl.textContent = translator.t('ui.handReference.hiddenLayout');
    }

    // Формула: [ 100 ] X [ 8 ]
    const formulaEl = document.createElement('div');
    formulaEl.className = 'run-info-formula hand-ref-formula';

    // Включаем скрытый текст базовой формулы для совместимости со скрин-ридерами и тестами
    const srFormula = document.createElement('span');
    srFormula.className = 'sr-only';
    srFormula.textContent = translator.t('ui.handReference.baseFormula', {
      chips: levelState.chips,
      mult: levelState.mult,
    });
    formulaEl.appendChild(srFormula);

    const chipPill = document.createElement('span');
    chipPill.className = 'run-info-chip-pill';
    chipPill.setAttribute('aria-hidden', 'true');
    chipPill.textContent = formatBalatroNumber(levelState.chips);

    const multTimes = document.createElement('span');
    multTimes.className = 'run-info-mult-times';
    multTimes.setAttribute('aria-hidden', 'true');
    multTimes.textContent = 'X';

    const multPill = document.createElement('span');
    multPill.className = 'run-info-mult-pill';
    multPill.setAttribute('aria-hidden', 'true');
    multPill.textContent = formatBalatroNumber(levelState.mult);

    formulaEl.append(chipPill, multTimes, multPill);

    // Счётчик сыгранных раз: # 0
    const playedEl = document.createElement('div');
    playedEl.className = 'run-info-played-count';
    const hashSpan = document.createElement('span');
    hashSpan.className = 'run-info-hash';
    hashSpan.textContent = '#';
    const playedNum = document.createElement('span');
    playedNum.className = 'run-info-played-num';
    playedNum.textContent = String(levelState.playedCount);
    playedEl.append(hashSpan, ' ', playedNum);

    // Скрытый playedEl для совместимости с hand-ref-meta
    const srPlayed = document.createElement('span');
    srPlayed.className = 'sr-only';
    srPlayed.textContent = translator.t('ui.handReference.played', {
      count: levelState.playedCount,
    });
    playedEl.appendChild(srPlayed);

    row.append(levelBadge, nameEl, formulaEl, playedEl);

    // Интерактивное наведение и клик для показа 5 мини-карт и правила
    if (levelState.visible) {
      const showPopup = (): void => {
        closePopup();
        const ruleKey = `ui.runInfo.handRules.${handType}`;
        const ruleText = translator.t(ruleKey);
        const popup = renderHandExamplePopup(
          handType,
          ruleText && ruleText !== ruleKey
            ? ruleText
            : translator.getHandText(handType).description,
          translator,
        );

        const isTop = TOP_HAND_TYPES.has(handType);
        if (isTop) {
          popup.classList.add('hand-preview-popup--top');
          // Позиционируем плашку строго над строкой
          const bottomDist = Math.max(0, list.offsetHeight - row.offsetTop + 4);
          popup.style.bottom = `${bottomDist}px`;
          popup.style.top = 'auto';
        } else {
          popup.classList.add('hand-preview-popup--bottom');
          // Позиционируем плашку строго под строкой
          const topDist = row.offsetTop + row.offsetHeight + 4;
          popup.style.top = `${topDist}px`;
          popup.style.bottom = 'auto';
        }

        popup.addEventListener('click', (e) => {
          e.stopPropagation();
          closePopup();
        });
        list.appendChild(popup);
        activePopup = popup;
      };

      row.addEventListener('mouseenter', () => {
        showPopup();
      });

      row.addEventListener('mouseleave', () => {
        closePopup();
      });

      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activePopup?.dataset.handType === handType) {
          closePopup();
        } else {
          showPopup();
        }
      });
    }

    list.appendChild(row);
  }

  list.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.run-info-hand-row')) {
      closePopup();
    }
  });

  container.appendChild(list);
}

/**
 * Отрисовывает содержимое вкладки «Заказы» (Блайнды) с 3 карточками текущего Этажа.
 */
function renderBlindsTab(
  container: HTMLElement,
  state: RunState,
  translator: Translator,
): void {
  const grid = document.createElement('div');
  grid.className = 'run-info-blinds-grid';

  for (const slot of state.anteBlinds) {
    const card = document.createElement('div');
    card.className = `run-info-blind-card run-info-blind-card--${slot.kind} run-info-blind-card--${slot.status}`;
    card.dataset.blindKind = slot.kind;
    card.dataset.status = slot.status;

    const blindText = translator.getBlindText(slot.kind, slot.bossId, state.ante);
    const statusText = translator.t(`ui.runInfo.blinds.${slot.status}`);

    // Бейдж статуса: [ Побежден ] / [ Текущий ] / [ Следующее ]
    const statusPill = document.createElement('div');
    statusPill.className = `run-info-blind-status-pill run-info-blind-status-pill--${slot.status}`;
    statusPill.textContent = statusText;

    // Пилюля названия
    const namePill = document.createElement('div');
    namePill.className = 'run-info-blind-name-pill';
    namePill.textContent = blindText.name;

    // Круглый жетон
    const tokenWrap = document.createElement('div');
    tokenWrap.className = 'run-info-blind-token';
    const emblem = createBlindEmblem(
      slot.kind,
      slot.bossId,
      state.ante,
      'run-info-blind-emblem',
    );
    tokenWrap.appendChild(emblem);

    const blindTooltip = buildBlindTooltip(
      slot.kind,
      slot.bossId,
      slot.targetScore,
      slot.reward,
      false,
      translator,
      state.ante,
    );
    setTooltipData(namePill, blindTooltip);
    setTooltipData(tokenWrap, blindTooltip);

    card.append(statusPill, namePill, tokenWrap);

    // Свойство босса прямо под жетоном
    if (slot.kind === 'boss' && slot.bossId !== null) {
      const bossDesc = document.createElement('div');
      bossDesc.className = 'run-info-blind-boss-desc';
      bossDesc.textContent = blindText.description;
      setTooltipData(bossDesc, blindTooltip);
      card.appendChild(bossDesc);
    }

    // Минимум очков и награда
    const targetBox = document.createElement('div');
    targetBox.className = 'run-info-blind-target';

    const targetCaption = document.createElement('span');
    targetCaption.className = 'run-info-blind-target-caption';
    targetCaption.textContent = translator.t('ui.runInfo.blinds.minScore');

    const targetVal = document.createElement('div');
    targetVal.className = 'run-info-blind-target-value';
    const gem = document.createElement('span');
    gem.className = 'run-info-blind-gem';
    gem.textContent = '◆';
    const num = document.createElement('strong');
    num.textContent = formatBalatroNumber(slot.targetScore);
    targetVal.append(gem, ' ', num);

    const rewardEl = document.createElement('div');
    rewardEl.className = 'run-info-blind-reward';
    rewardEl.textContent = translator.t('ui.runInfo.blinds.reward', {
      dollars: slot.reward,
    });

    targetBox.append(targetCaption, targetVal, rewardEl);
    card.appendChild(targetBox);

    // Разделитель ИЛИ и талон пропуска для Малого и Старшего
    if (slot.kind !== 'boss' && slot.skipTagId !== null) {
      const orDiv = document.createElement('div');
      orDiv.className = 'run-info-blind-or';
      orDiv.textContent = translator.t('ui.blindSelect.orSeparator');

      const tagCard = document.createElement('div');
      tagCard.className = 'run-info-tag-card';
      tagCard.dataset.tagId = slot.skipTagId;

      const tagIcon = document.createElement('div');
      tagIcon.className = 'run-info-tag-icon';
      tagIcon.textContent = '✦';

      const tagLabel = document.createElement('span');
      tagLabel.className = 'run-info-tag-label';
      tagLabel.textContent = translator.t('ui.runInfo.blinds.skipReward');

      tagCard.append(tagIcon, tagLabel);

      const tagTooltip = buildTagTooltip(slot.skipTagId, translator);
      setTooltipData(tagCard, tagTooltip);

      card.append(orDiv, tagCard);
    }

    grid.appendChild(card);
  }

  container.appendChild(grid);
}

/**
 * Отрисовывает содержимое вкладки «Привилегии» (Ваучеры) с пустым состоянием или сеткой карточек.
 */
function renderVouchersTab(
  container: HTMLElement,
  state: RunState,
  translator: Translator,
): void {
  const wrap = document.createElement('div');
  wrap.className = 'run-info-vouchers-container';

  if (state.charters.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'run-info-vouchers-empty';
    emptyEl.textContent = translator.t('ui.runInfo.vouchers.empty');
    wrap.appendChild(emptyEl);
  } else {
    const titleEl = document.createElement('h3');
    titleEl.className = 'run-info-vouchers-title';
    titleEl.textContent = translator.t('ui.runInfo.vouchers.title');
    wrap.appendChild(titleEl);

    const grid = document.createElement('div');
    grid.className = 'run-info-vouchers-grid';

    for (const charterId of state.charters) {
      const cardSlot = document.createElement('div');
      cardSlot.className = 'run-info-voucher-slot';
      const frameEl = renderEntityCardFrame({
        kind: 'charter',
        charterId,
        translator,
      });
      frameEl.classList.add('run-info-voucher-card');
      setTooltipData(frameEl, buildCharterTooltip(charterId, translator));
      cardSlot.appendChild(frameEl);
      grid.appendChild(cardSlot);
    }

    wrap.appendChild(grid);
  }

  container.appendChild(wrap);
}

/**
 * Отрисовывает модальное окно справки по всем раскладам (алиас для обратной совместимости).
 */
export function renderHandReferenceModal(
  state: RunState,
  translator: Translator,
  onClose: () => void,
): HTMLElement {
  return renderRunInfoModal(state, translator, onClose, 'hands');
}

/**
 * Возвращает SVG-иконку масти для сводки колоды (не зависит от символов юникода в шрифте).
 */
function createSuitSvgIcon(suit: Suit): SVGSVGElement {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('deck-suit-svg', `deck-suit-svg--${suit}`);

  const path = document.createElementNS(svgNs, 'path');
  path.setAttribute('fill', 'currentColor');
  if (suit === 'spades') {
    path.setAttribute(
      'd',
      'M12 2C9 6 4 9.5 4 14a4.5 4.5 0 0 0 7 3.7L10 21h4l-1-3.3A4.5 4.5 0 0 0 20 14c0-4.5-5-8-8-12Z',
    );
  } else if (suit === 'hearts') {
    path.setAttribute(
      'd',
      'M12 21s-7.5-4.7-9-9.5C1.8 7.6 4.7 4 8.2 4c2 0 3.3 1.1 3.8 2.2C12.5 5.1 13.8 4 15.8 4 19.3 4 22.2 7.6 21 11.5 19.5 16.3 12 21 12 21Z',
    );
  } else if (suit === 'clubs') {
    path.setAttribute(
      'd',
      'M12 3a4 4 0 0 0-3.2 6.4A4.2 4.2 0 0 0 4 13.5 4 4 0 0 0 11 16l-1 5h4l-1-5a4 4 0 0 0 7-2.5 4.2 4.2 0 0 0-4.8-4.1A4 4 0 0 0 12 3Z',
    );
  } else {
    path.setAttribute('d', 'M12 2L20 12L12 22L4 12Z');
  }
  svg.appendChild(path);
  return svg;
}

/**
 * Преобразует ранг карты в короткую локализованную метку для вертикальной шкалы Т..2 / A..2.
 */
function formatDeckRankLabel(rank: Rank, translator: Translator): string {
  switch (rank) {
    case 14:
      return translator.t('ui.deckModal.rankAce');
    case 13:
      return translator.t('ui.deckModal.rankKing');
    case 12:
      return translator.t('ui.deckModal.rankQueen');
    case 11:
      return translator.t('ui.deckModal.rankJack');
    default:
      return String(rank);
  }
}

/**
 * Создаёт компактную карточку для окна «Состав колоды» с визуальными бейджами
 * сыгранности на текущем этаже (playedThisAnte) и ослабления (debuffed), а также обогащённым тултипом.
 */
function createDeckModalCardFrame(
  entry: DeckViewCardEntry,
  activeMode: DeckViewMode,
  translator: Translator,
): HTMLElement {
  // В окне состава колоды отображаем лицо карты, но в детерминированном порядке по масти/рангу
  const visibleCard: PlayingCard =
    entry.card.facing === 'back' ? { ...entry.card, facing: 'front' } : entry.card;
  const frame = renderPlayingCardFrame({
    card: visibleCard,
    translator,
    compact: true,
    interactive: false,
    faceDown: false,
  });
  frame.dataset.inDraw = entry.inDrawPile ? 'true' : 'false';
  if (activeMode === 'full' && !entry.inDrawPile) {
    frame.classList.add('is-out-of-draw');
  }

  const fxLayer = frame.querySelector<HTMLElement>('.card-frame__layer-fx') ?? frame;

  // Визуальная пометка карт, уже сыгранных на текущем этаже (важно против Босса Махораги)
  if (visibleCard.playedThisAnte) {
    frame.classList.add('is-played-this-ante');
    frame.dataset.playedThisAnte = 'true';

    const playedBadge = document.createElement('span');
    playedBadge.className = 'deck-card-badge deck-card-badge--played-ante';
    playedBadge.dataset.deckBadge = 'played-this-ante';
    playedBadge.textContent = translator.t('ui.deckModal.playedThisAnteBadge');
    fxLayer.appendChild(playedBadge);
  }

  // Явная визуальная пометка ослабленных карт в окне колоды
  if (visibleCard.debuffed) {
    frame.classList.add('is-debuffed');
    frame.dataset.debuffed = 'true';

    const existingDebuffBadge = frame.querySelector<HTMLElement>('.card-frame__debuff-badge');
    if (existingDebuffBadge) {
      existingDebuffBadge.classList.add('deck-card-badge', 'deck-card-badge--debuffed');
      existingDebuffBadge.dataset.deckBadge = 'debuffed';
    } else {
      const debuffBadge = document.createElement('span');
      debuffBadge.className = 'card-frame__debuff-badge deck-card-badge deck-card-badge--debuffed';
      debuffBadge.dataset.deckBadge = 'debuffed';
      debuffBadge.textContent = translator.t('ui.hud.debuffedBadge');
      fxLayer.appendChild(debuffBadge);
    }
  }

  const baseTooltip = buildPlayingCardTooltip(visibleCard, translator);
  if (visibleCard.playedThisAnte) {
    const playedHint = translator.t('ui.deckModal.playedThisAnteHint');
    const nextDescription = baseTooltip.description
      ? `${baseTooltip.description} • ${playedHint}`
      : playedHint;
    const nextBadges = [
      ...(baseTooltip.badges ?? []),
      {
        label: translator.t('ui.deckModal.playedThisAnteBadge'),
        tone: 'gold' as const,
        kind: 'status' as const,
      },
    ];
    setTooltipData(frame, {
      ...baseTooltip,
      description: nextDescription,
      badges: nextBadges,
    });
  } else {
    setTooltipData(frame, baseTooltip);
  }

  return frame;
}
/**
 * Отрисовывает подробное модальное окно состава колоды с вкладками Оставшаяся/Полная,
 * левой сводкой базовых карт и рангов и 4 веерными рядами мастей с ховер-тултипами.
 */
export function renderDeckModal(
  state: RunState,
  translator: Translator,
  onClose: () => void,
): HTMLElement {
  const { backdrop, sheet, body, footer } = createModalShell(
    translator.t('ui.deckModal.title'),
    translator.t('ui.deckModal.totalCards', { count: state.deck.length }),
    translator,
    onClose,
    'deck',
  );
  sheet.classList.add('modal-sheet--deck');

  // Заменяем текст кнопки закрытия на «Назад» и стилизуем широкую оранжевую кнопку
  const closeBtn = footer.querySelector<HTMLButtonElement>('[data-action="close"]');
  if (closeBtn) {
    closeBtn.textContent = translator.t('ui.deckModal.backButton');
    closeBtn.classList.add('modal-btn--deck-back');
  }

  let activeMode: DeckViewMode = 'remaining';

  // Вкладки переключения между оставшейся стопкой добора и полной колодой
  const tabsWrap = document.createElement('div');
  tabsWrap.className = 'deck-tabs';

  const remainingTab = document.createElement('button');
  remainingTab.type = 'button';
  remainingTab.className = 'modal-btn deck-tab-btn';
  remainingTab.dataset.deckTab = 'remaining';
  remainingTab.textContent = translator.t('ui.deckModal.remainingTab');

  const fullTab = document.createElement('button');
  fullTab.type = 'button';
  fullTab.className = 'modal-btn deck-tab-btn';
  fullTab.dataset.deckTab = 'full';
  fullTab.textContent = translator.t('ui.deckModal.fullTab');

  tabsWrap.append(remainingTab, fullTab);
  body.appendChild(tabsWrap);

  const contentHost = document.createElement('div');
  contentHost.className = 'deck-modal-content';
  body.appendChild(contentHost);

  const renderModeContent = (): void => {
    remainingTab.setAttribute('aria-pressed', activeMode === 'remaining' ? 'true' : 'false');
    remainingTab.classList.toggle('is-active', activeMode === 'remaining');
    fullTab.setAttribute('aria-pressed', activeMode === 'full' ? 'true' : 'false');
    fullTab.classList.toggle('is-active', activeMode === 'full');

    const model = buildDeckViewModel(state, activeMode);
    contentHost.replaceChildren();

    const layout = document.createElement('div');
    layout.className = 'deck-modal-layout';

    // Левая панель: текущая стартовая колода, «Базовые карты» и вертикальный столбец рангов Т..2
    const sidebar = document.createElement('div');
    sidebar.className = 'deck-modal-sidebar';

    const leftSummaryCol = document.createElement('div');
    leftSummaryCol.className = 'deck-sidebar-main';

    const deckInfo = document.createElement('div');
    deckInfo.className = 'deck-info-card';
    const deckText = translator.getDeckText(model.deckId);
    const deckNameEl = document.createElement('div');
    deckNameEl.className = 'deck-info-card__name';
    deckNameEl.textContent = deckText.name;
    const deckDescEl = document.createElement('div');
    deckDescEl.className = 'deck-info-card__desc';
    deckDescEl.textContent = deckText.description;
    deckInfo.append(deckNameEl, deckDescEl);
    leftSummaryCol.appendChild(deckInfo);

    const baseCardBox = document.createElement('div');
    baseCardBox.className = 'deck-base-cards';

    const baseTitle = document.createElement('h3');
    baseTitle.className = 'deck-base-cards__title';
    baseTitle.textContent = translator.t('ui.deckModal.baseCardsTitle');
    baseCardBox.appendChild(baseTitle);

    const categoriesRow = document.createElement('div');
    categoriesRow.className = 'deck-categories-grid';
    const categories: ReadonlyArray<{
      readonly key: 'aces' | 'faces' | 'numbers';
      readonly badge: string;
      readonly label: string;
      readonly count: number;
    }> = [
      {
        key: 'aces',
        badge: translator.t('ui.deckModal.rankAce'),
        label: translator.t('ui.deckModal.aces'),
        count: model.summary.aces,
      },
      {
        key: 'faces',
        badge: `${translator.t('ui.deckModal.rankKing')}`,
        label: translator.t('ui.deckModal.faces'),
        count: model.summary.faces,
      },
      {
        key: 'numbers',
        badge: '#',
        label: translator.t('ui.deckModal.numbers'),
        count: model.summary.numbers,
      },
    ];
    for (const cat of categories) {
      const cell = document.createElement('div');
      cell.className = 'deck-category-cell';
      cell.dataset.baseCategory = cat.key;
      cell.title = cat.label;

      const icon = document.createElement('span');
      icon.className = `deck-category-cell__badge deck-category-cell__badge--${cat.key}`;
      icon.textContent = cat.badge;

      const val = document.createElement('span');
      val.className = 'deck-category-cell__count';
      val.textContent = String(cat.count);

      cell.append(icon, val);
      categoriesRow.appendChild(cell);
    }
    baseCardBox.appendChild(categoriesRow);

    const suitsGrid = document.createElement('div');
    suitsGrid.className = 'deck-suit-summary';
    for (const suit of DECK_VIEW_SUIT_ORDER) {
      const suitInfo = translator.catalog.suits[suit];
      const count = model.summary.suits[suit];
      const chip = document.createElement('div');
      chip.className = `deck-suit-chip deck-suit-chip--${suit}`;
      chip.dataset.suitSummary = suit;
      chip.dataset.count = String(count);
      chip.setAttribute('aria-label', `${suitInfo.name}: ${count}`);

      const countSpan = document.createElement('span');
      countSpan.className = 'deck-suit-chip__count';
      countSpan.textContent = String(count);

      chip.append(createSuitSvgIcon(suit), countSpan);
      suitsGrid.appendChild(chip);
    }
    baseCardBox.appendChild(suitsGrid);

    if (model.summary.stoneCount > 0) {
      const stoneBadge = document.createElement('div');
      stoneBadge.className = 'deck-stone-summary';
      stoneBadge.textContent = `${translator.catalog.enhancements.stone.name}: ${model.summary.stoneCount}`;
      baseCardBox.appendChild(stoneBadge);
    }

    leftSummaryCol.appendChild(baseCardBox);

    // Вертикальная колонка счётчиков рангов от Туза до Двойки
    const ranksCol = document.createElement('div');
    ranksCol.className = 'deck-ranks-col';
    for (const item of model.summary.rankCounts) {
      const row = document.createElement('div');
      row.className = `deck-rank-row ${item.count === 0 ? 'is-zero' : ''}`.trim();
      row.dataset.rankSummary = String(item.rank);

      const rankBadge = document.createElement('span');
      rankBadge.className = 'deck-rank-row__badge';
      rankBadge.textContent = formatDeckRankLabel(item.rank, translator);

      const rankCount = document.createElement('span');
      rankCount.className = 'deck-rank-row__count';
      rankCount.textContent = String(item.count);

      row.append(rankBadge, rankCount);
      ranksCol.appendChild(row);
    }

    sidebar.append(leftSummaryCol, ranksCol);

    // Правая панель: 4 ряда мини-карт по мастям веером с ховер-тултипом на каждой карте
    const rowsPanel = document.createElement('div');
    rowsPanel.className = 'deck-modal-rows';

    for (const suitRow of model.suitRows) {
      const rowEl = document.createElement('div');
      rowEl.className = `deck-suit-row deck-suit-row--${suitRow.suit}`;
      rowEl.dataset.suitRow = suitRow.suit;

      const fanEl = document.createElement('div');
      fanEl.className = 'deck-fan-row';
      const extraOverlap =
        suitRow.cards.length > 13 ? Math.min(14, (suitRow.cards.length - 13) * 2) : 0;
      fanEl.style.setProperty('--deck-fan-extra', `${extraOverlap}px`);

      for (const entry of suitRow.cards) {
        fanEl.appendChild(createDeckModalCardFrame(entry, activeMode, translator));
      }

      rowEl.appendChild(fanEl);
      rowsPanel.appendChild(rowEl);
    }

    if (model.stoneCards.length > 0) {
      const stoneRowEl = document.createElement('div');
      stoneRowEl.className = 'deck-stone-row';
      const stoneLabel = document.createElement('span');
      stoneLabel.className = 'deck-stone-row__label';
      stoneLabel.textContent = translator.catalog.enhancements.stone.name;
      const stoneFan = document.createElement('div');
      stoneFan.className = 'deck-fan-row';
      for (const entry of model.stoneCards) {
        stoneFan.appendChild(createDeckModalCardFrame(entry, activeMode, translator));
      }
      stoneRowEl.append(stoneLabel, stoneFan);
      rowsPanel.appendChild(stoneRowEl);
    }

    layout.append(sidebar, rowsPanel);
    contentHost.appendChild(layout);
  };

  remainingTab.addEventListener('click', () => {
    if (activeMode !== 'remaining') {
      activeMode = 'remaining';
      renderModeContent();
    }
  });
  fullTab.addEventListener('click', () => {
    if (activeMode !== 'full') {
      activeMode = 'full';
      renderModeContent();
    }
  });

  renderModeContent();
  return backdrop;
}

/**
 * Создаёт группу переключателей (сегментированные кнопки) с взаимным переключением активного состояния.
 */
function createSegmentedSettingGroup<T extends string | number>(options: {
  label: string;
  items: ReadonlyArray<{
    readonly value: T;
    readonly text: string;
    readonly dataAttr: string;
  }>;
  currentValue: T;
  onSelect: (value: T) => void;
}): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'settings-group';

  const labelRow = document.createElement('div');
  labelRow.className = 'settings-label-row';
  const labelEl = document.createElement('span');
  labelEl.textContent = options.label;
  labelRow.appendChild(labelEl);
  group.appendChild(labelRow);

  const segmented = document.createElement('div');
  segmented.className = 'settings-segmented';

  const buttons: Array<{ btn: HTMLButtonElement; value: T }> = [];
  for (const item of options.items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'modal-btn';
    btn.setAttribute(item.dataAttr, String(item.value));
    const isActive = item.value === options.currentValue;
    btn.classList.toggle('modal-btn--active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
    btn.textContent = item.text;

    btn.addEventListener('click', () => {
      for (const entry of buttons) {
        const active = entry.value === item.value;
        entry.btn.classList.toggle('modal-btn--active', active);
        entry.btn.setAttribute('aria-pressed', String(active));
      }
      options.onSelect(item.value);
    });

    buttons.push({ btn, value: item.value });
    segmented.appendChild(btn);
  }

  group.appendChild(segmented);
  return group;
}

/**
 * Создаёт группу ползунка громкости (диапазон 0..1) с крупной сенсорной зоной нажатия.
 */
function createVolumeSliderGroup(options: {
  label: string;
  volumeKey: 'sfx' | 'music';
  initialValue: number;
  onChange: (nextValue: number) => void;
}): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'settings-group';

  const labelRow = document.createElement('div');
  labelRow.className = 'settings-label-row';

  const labelEl = document.createElement('label');
  const inputId = `balite-volume-${options.volumeKey}`;
  labelEl.htmlFor = inputId;
  labelEl.textContent = options.label;

  const valueBadge = document.createElement('span');
  valueBadge.className = 'settings-value';
  valueBadge.textContent = `${Math.round(options.initialValue * 100)}%`;

  labelRow.appendChild(labelEl);
  labelRow.appendChild(valueBadge);
  group.appendChild(labelRow);

  const rangeWrap = document.createElement('div');
  rangeWrap.className = 'settings-range-wrap';

  const input = document.createElement('input');
  input.id = inputId;
  input.type = 'range';
  input.className = 'settings-range';
  input.min = '0';
  input.max = '1';
  input.step = '0.05';
  input.value = String(options.initialValue);
  input.dataset.volume = options.volumeKey;

  let lastEmitted = options.initialValue;
  const handleRangeUpdate = (): void => {
    const parsed = Number(input.value);
    const clamped = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : lastEmitted;
    valueBadge.textContent = `${Math.round(clamped * 100)}%`;
    if (clamped !== lastEmitted) {
      lastEmitted = clamped;
      options.onChange(clamped);
    }
  };

  input.addEventListener('input', handleRangeUpdate);
  input.addEventListener('change', handleRangeUpdate);

  rangeWrap.appendChild(input);
  group.appendChild(rangeWrap);
  return group;
}

/**
 * Создаёт отладочную панель (?debug) для ручной проверки рекламы, облачных сохранений и сброса забега.
 */
function createDebugSection(
  platformId: string | undefined,
  onDebugAction?: SettingsModalOptions['onDebugAction'],
): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'modal-debug-panel';
  panel.dataset.debugPanel = 'true';

  const header = document.createElement('div');
  header.className = 'modal-debug-header';

  const modeTag = document.createElement('span');
  modeTag.textContent = '?debug';
  const sdkTag = document.createElement('span');
  sdkTag.textContent = `sdk: ${platformId ?? 'unknown'}`;

  header.appendChild(modeTag);
  header.appendChild(sdkTag);
  panel.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'modal-debug-grid';

  const logEl = document.createElement('pre');
  logEl.className = 'modal-debug-log';
  logEl.dataset.debugLog = 'true';
  logEl.textContent = 'ready';

  for (const item of DEBUG_ACTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'modal-btn';
    btn.dataset.debugAction = item.action;
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      if (!onDebugAction) {
        return;
      }
      void onDebugAction(item.action).then(
        (result) => {
          logEl.textContent = `${item.action}: ${result}`;
        },
        (err: unknown) => {
          logEl.textContent = `${item.action}: ${String(err)}`;
        },
      );
    });
    grid.appendChild(btn);
  }

  panel.appendChild(grid);
  panel.appendChild(logEl);
  return panel;
}

/**
 * Вычисляет безопасные значения статистики и процент открытий из MetaSave.
 */
export function computeMetaStatsSummary(meta: MetaSave | undefined): MetaStats & {
  readonly discoveredCount: number;
  readonly totalDiscoverable: number;
  readonly discoveryPercent: number;
} {
  const rawStats = (meta?.stats ?? {}) as Partial<MetaStats>;

  const totalDiscoverable =
    DECK_IDS.length +
    RELIC_IDS.length +
    CELESTIAL_IDS.length +
    SCROLL_IDS.length +
    RUNE_IDS.length +
    CHARTER_IDS.length +
    BOSS_IDS.length +
    TAG_IDS.length +
    (REGULAR_MONSTER_IDS.length - 2) +
    COLLECTION_PACK_IDS.length +
    (COLLECTION_EDITIONS.length - 1);

  const discoveredCount = meta
    ? Math.min(totalDiscoverable, countMetaDiscoveries(meta) + new Set(meta.unlockedDecks).size)
    : 0;

  const discoveryPercent =
    totalDiscoverable > 0
      ? Math.min(100, Math.round((discoveredCount / totalDiscoverable) * 100))
      : 0;

  return {
    runsStarted: rawStats.runsStarted ?? 0,
    runsWon: rawStats.runsWon ?? 0,
    highestAnte: rawStats.highestAnte ?? 0,
    bestHandScore: rawStats.bestHandScore ?? 0,
    totalHandsPlayed: rawStats.totalHandsPlayed ?? 0,
    highestRound: rawStats.highestRound ?? 0,
    maxDollars: rawStats.maxDollars ?? 0,
    bestWinStreak: rawStats.bestWinStreak ?? 0,
    currentWinStreak: rawStats.currentWinStreak ?? 0,
    handPlayCounts: rawStats.handPlayCounts ?? {},
    ...(rawStats.totalMoneySpent !== undefined ? { totalMoneySpent: rawStats.totalMoneySpent } : {}),
    ...(rawStats.totalShopRerolls !== undefined
      ? { totalShopRerolls: rawStats.totalShopRerolls }
      : {}),
    ...(rawStats.totalCelestialsUsed !== undefined
      ? { totalCelestialsUsed: rawStats.totalCelestialsUsed }
      : {}),
    ...(rawStats.dailyBestDate !== undefined ? { dailyBestDate: rawStats.dailyBestDate } : {}),
    ...(rawStats.dailyBestScore !== undefined ? { dailyBestScore: rawStats.dailyBestScore } : {}),
    discoveredCount,
    totalDiscoverable,
    discoveryPercent,
  };
}

/**
 * Создаёт кнопку действия модального хаба «Параметры».
 */
function createHubButton(
  label: string,
  action: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `modal-btn ${className}`.trim();
  btn.dataset.hubAction = action;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Заполняет содержимое вкладки «Статистика» из мета-сохранения.
 */
function renderStatsTabBody(
  body: HTMLElement,
  meta: MetaSave | undefined,
  translator: Translator,
  options?: {
    readonly platformId?: string;
    readonly onOpenLeaderboard?: () => void;
  },
): void {
  const summary = computeMetaStatsSummary(meta);
  const topHand = getMostPlayedHand(summary);
  const mostPlayedText = topHand
    ? `${translator.getHandText(topHand.handType).name} (${topHand.count})`
    : translator.t('ui.stats.noneHand', { count: 0 });

  const grid = document.createElement('div');
  grid.className = 'stats-grid';
  grid.dataset.statsPanel = 'true';

  const entries: ReadonlyArray<{ readonly label: string; readonly value: string }> = [
    { label: translator.t('ui.stats.bestHand'), value: formatBalatroNumber(summary.bestHandScore) },
    { label: translator.t('ui.stats.highestRound'), value: String(summary.highestRound) },
    {
      label: translator.t('ui.stats.highestStage'),
      value:
        isDevOriginalTermsEnabled() || summary.highestAnte <= 0
          ? String(summary.highestAnte)
          : `${getGuildRank(summary.highestAnte)} (${summary.highestAnte})`,
    },
    { label: translator.t('ui.stats.mostPlayedHand'), value: mostPlayedText },
    {
      label: translator.t('ui.stats.maxGold'),
      value: translator.t('ui.hud.goldAmount', { dollars: summary.maxDollars }),
    },
    {
      label: translator.t('ui.stats.bestWinStreak'),
      value: `${summary.bestWinStreak} (${summary.currentWinStreak})`,
    },
    {
      label: translator.t('ui.stats.runsStartedWon'),
      value: `${summary.runsStarted} / ${summary.runsWon}`,
    },
    {
      label: translator.t('ui.stats.discoveryProgress'),
      value: `${summary.discoveryPercent}% (${summary.discoveredCount}/${summary.totalDiscoverable})`,
    },
    {
      label: translator.t('ui.stats.dailyBest'),
      value: String(summary.dailyBestScore ?? 0),
    },
  ];

  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'stats-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'stats-row__label';
    labelEl.textContent = entry.label;

    const valueEl = document.createElement('span');
    valueEl.className = 'stats-row__value';
    valueEl.textContent = entry.value;

    row.append(labelEl, valueEl);
    grid.append(row);
  }

  body.append(grid);

  if (options?.platformId === 'vk' && options.onOpenLeaderboard) {
    const leaderboardBtn = document.createElement('button');
    leaderboardBtn.type = 'button';
    leaderboardBtn.className = 'modal-btn modal-btn--primary modal-btn--full stats-leaderboard-btn';
    leaderboardBtn.dataset.action = 'open-vk-leaderboard';
    leaderboardBtn.textContent = translator.t('ui.actions.openLeaderboard');
    leaderboardBtn.addEventListener('click', () => options.onOpenLeaderboard?.());
    body.append(leaderboardBtn);
  }
}

/**
 * Контактный адрес обратной связи для витрин VK / OK (п. 4.9 правил ВК).
 */
export const BALITE_SUPPORT_EMAIL = 'support@balite.game';

/**
 * Заполняет содержимое текстового окна «Титры и об игре» (контакт поддержки рендерится только для VK/OK).
 */
function renderCreditsTabBody(
  body: HTMLElement,
  version: string,
  translator: Translator,
  platformId?: string,
): void {
  const card = document.createElement('div');
  card.className = 'credits-card';
  card.dataset.creditsPanel = 'true';

  const heading = document.createElement('h3');
  heading.className = 'credits-card__title';
  heading.textContent = translator.t('ui.app.title');

  const lines = [
    translator.t('ui.credits.version', { version }),
    translator.t('ui.credits.settingLine'),
    translator.t('ui.credits.engineLine'),
    translator.t('ui.credits.audioLine'),
    translator.t('ui.credits.fontLine'),
    translator.t('ui.credits.complianceLine'),
  ];

  card.append(heading);
  for (const line of lines) {
    const p = document.createElement('p');
    p.className = 'credits-card__line';
    p.textContent = line;
    card.append(p);
  }

  if (platformId === 'vk' || platformId === 'ok') {
    const supportBlock = document.createElement('div');
    supportBlock.className = 'credits-card__support';
    supportBlock.dataset.creditsSupport = 'true';

    const supportTitle = document.createElement('div');
    supportTitle.className = 'credits-card__support-title';
    supportTitle.textContent = translator.t('ui.credits.supportLabel');

    const supportDesc = document.createElement('p');
    supportDesc.className = 'credits-card__support-desc';
    supportDesc.textContent = translator.t('ui.credits.supportText');

    const supportLink = document.createElement('a');
    supportLink.className = 'credits-card__support-link';
    supportLink.href = `mailto:${BALITE_SUPPORT_EMAIL}`;
    supportLink.textContent = BALITE_SUPPORT_EMAIL;

    supportBlock.append(supportTitle, supportDesc, supportLink);
    card.append(supportBlock);
  }

  body.append(card);
}

/**
 * Заполняет содержимое вкладки «Настройки» (скорость, звук, громкость, язык и отладка).
 */
function renderSettingsControlsBody(body: HTMLElement, options: SettingsModalOptions): void {
  const { settings, translator, onChangeSettings } = options;

  // Скорость анимаций 0.5x / 1x / 2x / 4x
  body.appendChild(
    createSegmentedSettingGroup<AnimationSpeed>({
      label: translator.t('ui.settings.animationSpeed'),
      items: SPEED_OPTIONS.map((item) => ({
        value: item.value,
        text: translator.t(item.key),
        dataAttr: 'data-speed',
      })),
      currentValue: settings.animationSpeed,
      onSelect: (animationSpeed) => onChangeSettings({ animationSpeed }),
    }),
  );

  // Переключатель звука Вкл / Выкл
  body.appendChild(
    createSegmentedSettingGroup<'on' | 'off'>({
      label: translator.t('ui.settings.sound'),
      items: [
        { value: 'on', text: translator.t('ui.settings.soundOn'), dataAttr: 'data-sound' },
        { value: 'off', text: translator.t('ui.settings.soundOff'), dataAttr: 'data-sound' },
      ],
      currentValue: settings.soundEnabled ? 'on' : 'off',
      onSelect: (val) => onChangeSettings({ soundEnabled: val === 'on' }),
    }),
  );

  // Ползунки громкости эффектов и музыки (0..1)
  body.appendChild(
    createVolumeSliderGroup({
      label: translator.t('ui.settings.sfxVolume'),
      volumeKey: 'sfx',
      initialValue: settings.sfxVolume ?? 0.8,
      onChange: (sfxVolume) => onChangeSettings({ sfxVolume }),
    }),
  );

  body.appendChild(
    createVolumeSliderGroup({
      label: translator.t('ui.settings.musicVolume'),
      volumeKey: 'music',
      initialValue: settings.musicVolume ?? 0.4,
      onChange: (musicVolume) => onChangeSettings({ musicVolume }),
    }),
  );

  // Переключение режима CRT-эффекта: Выкл / Лёгкий / Оригинал
  body.appendChild(
    createSegmentedSettingGroup<CrtMode>({
      label: translator.t('ui.settings.crtMode'),
      items: CRT_MODE_OPTIONS.map((option) => ({
        value: option.value,
        text: translator.t(option.key),
        dataAttr: 'data-crt-mode',
      })),
      currentValue: settings.crtMode,
      onSelect: (crtMode) => onChangeSettings({ crtMode }),
    }),
  );

  // Переключение языка ru / en
  body.appendChild(
    createSegmentedSettingGroup<I18nLang>({
      label: translator.t('ui.settings.language'),
      items: [
        { value: 'ru', text: translator.t('ui.settings.langRu'), dataAttr: 'data-lang' },
        { value: 'en', text: translator.t('ui.settings.langEn'), dataAttr: 'data-lang' },
      ],
      currentValue: settings.lang,
      onSelect: (lang) => onChangeSettings({ lang }),
    }),
  );

  // Кнопка сброса / повторного прохождения интерактивного обучения
  const resetTutorialBtn = createHubButton(
    translator.t('ui.settings.resetTutorial'),
    'reset-tutorial',
    'modal-btn--secondary modal-btn--full',
    () => {
      if (options.onResetTutorial) {
        options.onResetTutorial();
      } else {
        onChangeSettings({ tutorialCompleted: false, tutorialStep: 0 });
      }
    },
  );
  resetTutorialBtn.dataset.action = 'reset-tutorial';
  body.appendChild(resetTutorialBtn);

  // Кнопка добавления ярлыка на рабочий стол (для Яндекс Игр при доступности в SDK)
  if (options.canShowShortcutPrompt && !settings.shortcutPrompted && options.onAddShortcut) {
    const addShortcutBtn = createHubButton(
      translator.t('ui.actions.addShortcut'),
      'add-shortcut',
      'modal-btn--secondary modal-btn--full',
      () => options.onAddShortcut?.(),
    );
    addShortcutBtn.dataset.action = 'add-shortcut';
    body.appendChild(addShortcutBtn);
  }

  // Отладочные инструменты и DEV-переключатель словаря доступны строго по флагу ?debug вне prod-сборки
  if (!import.meta.env.PROD && options.isDebug === true) {
    if (import.meta.env.DEV && options.onToggleDevOriginalTerms) {
      const devTermsLabel =
        translator.lang === 'ru'
          ? 'Оригинальные термины (DEV)'
          : 'Original Terms (DEV)';
      body.appendChild(
        createSegmentedSettingGroup<'off' | 'on'>({
          label: devTermsLabel,
          items: [
            { value: 'off', text: translator.t('ui.settings.soundOff'), dataAttr: 'data-dev-terms' },
            { value: 'on', text: translator.t('ui.settings.soundOn'), dataAttr: 'data-dev-terms' },
          ],
          currentValue: options.devOriginalTermsEnabled ? 'on' : 'off',
          onSelect: (val) => options.onToggleDevOriginalTerms?.(val === 'on'),
        }),
      );
    }
    if (options.onOpenDebugPanel) {
      const openPanelBtn = createHubButton(
        translator.lang === 'ru' ? 'Админ-панель (F9)' : 'Admin Panel (F9)',
        'open-debug-panel',
        'modal-btn--primary',
        options.onOpenDebugPanel,
      );
      openPanelBtn.dataset.debugOpenPanel = 'true';
      body.appendChild(openPanelBtn);
    }
    body.appendChild(createDebugSection(options.platformId, options.onDebugAction));
  }
}

/**
 * Заполняет содержимое вкладки «Настроить колоду» (палитра мастей, выбор рубашки и живой предпросмотр).
 */
function renderCustomizeDeckTabBody(
  body: HTMLElement,
  sheet: HTMLElement,
  translator: Translator,
  initialSuitPalette: SuitPalette,
  initialCardBack: CardBackStyle,
  onSelectSuitPalette: (suitPalette: SuitPalette) => void,
  onSelectCardBack: (cardBack: CardBackStyle) => void,
): void {
  let currentSuitPalette = initialSuitPalette;
  let currentCardBack = initialCardBack;

  sheet.dataset.suitPalette = currentSuitPalette;
  sheet.dataset.cardBack = currentCardBack;

  const panel = document.createElement('div');
  panel.className = 'customize-deck-panel';
  panel.dataset.customizeDeckPanel = 'true';

  // Живой предпросмотр рубашки и 4 мастей
  const previewBox = document.createElement('div');
  previewBox.className = 'customize-deck-preview';

  const previewTitle = document.createElement('div');
  previewTitle.className = 'customize-deck-preview__title';
  previewTitle.textContent = translator.t('ui.settings.customizePreviewTitle');

  const previewRow = document.createElement('div');
  previewRow.className = 'customize-deck-preview__cards';

  const backPreviewCard = renderPlayingCardFrame({
    card: createPlayingCard({ id: 'preview_back', suit: 'spades', rank: 14, facing: 'back' }),
    translator,
    compact: true,
    faceDown: true,
  });
  backPreviewCard.dataset.previewCard = 'back';
  previewRow.appendChild(backPreviewCard);

  const suitPreviews: ReadonlyArray<{ readonly suit: Suit; readonly rank: Rank }> = [
    { suit: 'spades', rank: 14 },
    { suit: 'hearts', rank: 13 },
    { suit: 'clubs', rank: 12 },
    { suit: 'diamonds', rank: 11 },
  ];
  for (const item of suitPreviews) {
    const cardEl = renderPlayingCardFrame({
      card: createPlayingCard({
        id: `preview_${item.suit}`,
        suit: item.suit,
        rank: item.rank,
      }),
      translator,
      compact: true,
    });
    cardEl.dataset.previewSuit = item.suit;
    previewRow.appendChild(cardEl);
  }

  previewBox.append(previewTitle, previewRow);
  panel.appendChild(previewBox);

  // Переключатель палитры мастей (Классическая / Высокий контраст)
  const hintEl = document.createElement('p');
  hintEl.className = 'customize-deck-hint';
  hintEl.dataset.suitPaletteDesc = 'true';
  hintEl.textContent = translator.t(
    currentSuitPalette === 'high_contrast'
      ? 'ui.settings.suitPaletteDescHighContrast'
      : 'ui.settings.suitPaletteDescStandard',
  );

  const paletteGroup = createSegmentedSettingGroup<SuitPalette>({
    label: translator.t('ui.settings.suitPalette'),
    items: SUIT_PALETTE_OPTIONS.map((item) => ({
      value: item.value,
      text: translator.t(item.key),
      dataAttr: 'data-suit-palette-option',
    })),
    currentValue: currentSuitPalette,
    onSelect: (suitPalette) => {
      currentSuitPalette = suitPalette;
      sheet.dataset.suitPalette = suitPalette;
      hintEl.textContent = translator.t(
        suitPalette === 'high_contrast'
          ? 'ui.settings.suitPaletteDescHighContrast'
          : 'ui.settings.suitPaletteDescStandard',
      );
      onSelectSuitPalette(suitPalette);
    },
  });
  paletteGroup.appendChild(hintEl);
  panel.appendChild(paletteGroup);

  // Выбор рубашки колоды
  const backGroup = document.createElement('div');
  backGroup.className = 'settings-group';

  const backLabelRow = document.createElement('div');
  backLabelRow.className = 'settings-label-row';
  const backLabel = document.createElement('span');
  backLabel.textContent = translator.t('ui.settings.cardBack');
  backLabelRow.appendChild(backLabel);

  const backGrid = document.createElement('div');
  backGrid.className = 'customize-card-back-grid';
  backGrid.setAttribute('role', 'group');
  backGrid.setAttribute('aria-label', translator.t('ui.settings.cardBack'));

  const backButtons: Array<{ readonly btn: HTMLButtonElement; readonly value: CardBackStyle }> = [];
  for (const option of CARD_BACK_OPTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'customize-card-back-btn';
    btn.dataset.cardBackOption = option.value;
    const isActive = option.value === currentCardBack;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));

    const swatch = document.createElement('span');
    swatch.className = `customize-card-back-swatch customize-card-back-swatch--${option.value}`;
    swatch.setAttribute('aria-hidden', 'true');

    const textEl = document.createElement('span');
    textEl.className = 'customize-card-back-label';
    textEl.textContent = translator.t(option.key);

    btn.append(swatch, textEl);
    btn.addEventListener('click', () => {
      currentCardBack = option.value;
      sheet.dataset.cardBack = option.value;
      for (const entry of backButtons) {
        const active = entry.value === option.value;
        entry.btn.classList.toggle('is-active', active);
        entry.btn.setAttribute('aria-pressed', String(active));
      }
      onSelectCardBack(option.value);
    });

    backButtons.push({ btn, value: option.value });
    backGrid.appendChild(btn);
  }

  backGroup.append(backLabelRow, backGrid);
  panel.appendChild(backGroup);

  body.appendChild(panel);
}

/**
 * Отрисовывает модальный хаб «Параметры» с вкладками «Настройки», «Статистика», «Настроить колоду», «Титры» и возвратом в Главное меню.
 */
export function renderSettingsModal(options: SettingsModalOptions): HTMLElement {
  const { translator, onClose, onReturnToMainMenu, onTabChange } = options;
  const version = options.version ?? APP_VERSION;
  let currentTab: SettingsModalTab = options.initialTab ?? 'hub';
  let liveSuitPalette: SuitPalette = options.settings.suitPalette ?? 'standard';
  let liveCardBack: CardBackStyle = options.settings.cardBack ?? 'default';

  const { backdrop, sheet, body, footer } = createModalShell(
    translator.t('ui.settings.hubTitle'),
    null,
    translator,
    onClose,
    'settings',
  );
  sheet.classList.add('settings-hub-sheet');

  const titleEl = sheet.querySelector<HTMLElement>('.modal-title');

  const switchTab = (nextTab: SettingsModalTab): void => {
    currentTab = nextTab;
    onTabChange?.(nextTab);
    renderActiveTab();
    // Перезапускаем пружинный выезд окна снизу вверх при смене подменю, как в Balatro
    sheet.style.animation = 'none';
    void sheet.offsetWidth;
    sheet.style.animation = '';
  };

  const renderActiveTab = (): void => {
    body.replaceChildren();
    footer.replaceChildren();
    sheet.classList.toggle(
      'settings-hub-sheet--wide',
      currentTab === 'stats' || currentTab === 'customize_deck',
    );

    if (currentTab === 'hub') {
      if (titleEl) {
        titleEl.textContent = translator.t('ui.settings.hubTitle');
      }

      const menu = document.createElement('div');
      menu.className = 'settings-hub-menu';
      menu.append(
        createHubButton(
          translator.t('ui.settings.hubSettings'),
          'settings',
          'modal-btn--hub modal-btn--full',
          () => switchTab('settings'),
        ),
        createHubButton(
          translator.t('ui.settings.hubStats'),
          'stats',
          'modal-btn--hub modal-btn--full',
          () => switchTab('stats'),
        ),
        createHubButton(
          translator.t('ui.settings.hubCustomizeDeck'),
          'customize-deck',
          'modal-btn--hub modal-btn--full',
          () => switchTab('customize_deck'),
        ),
        createHubButton(
          translator.t('ui.settings.hubCredits'),
          'credits',
          'modal-btn--hub modal-btn--full',
          () => switchTab('credits'),
        ),
      );

      if (options.canReturnToMainMenu && onReturnToMainMenu) {
        menu.append(
          createHubButton(
            translator.t('ui.settings.hubMainMenu'),
            'main-menu',
            'modal-btn--primary modal-btn--full',
            onReturnToMainMenu,
          ),
        );
      }

      body.append(menu);

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'modal-btn modal-btn--gold modal-btn--full';
      closeBtn.dataset.action = 'close';
      closeBtn.textContent = translator.t('ui.actions.back');
      closeBtn.addEventListener('click', onClose);
      footer.append(closeBtn);
      return;
    }

    if (currentTab === 'settings') {
      if (titleEl) {
        titleEl.textContent = translator.t('ui.settings.hubSettings');
      }
      renderSettingsControlsBody(body, options);
    } else if (currentTab === 'stats') {
      if (titleEl) {
        titleEl.textContent = translator.t('ui.stats.title');
      }
      renderStatsTabBody(body, options.meta, translator, {
        platformId: options.platformId,
        onOpenLeaderboard: options.onOpenLeaderboard,
      });
    } else if (currentTab === 'customize_deck') {
      if (titleEl) {
        titleEl.textContent = translator.t('ui.settings.hubCustomizeDeck');
      }
      renderCustomizeDeckTabBody(
        body,
        sheet,
        translator,
        liveSuitPalette,
        liveCardBack,
        (suitPalette) => {
          liveSuitPalette = suitPalette;
          options.onChangeSettings({ suitPalette });
        },
        (cardBack) => {
          liveCardBack = cardBack;
          options.onChangeSettings({ cardBack });
        },
      );
    } else {
      if (titleEl) {
        titleEl.textContent = translator.t('ui.credits.title');
      }
      renderCreditsTabBody(body, version, translator, options.platformId);
    }

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'modal-btn modal-btn--gold modal-btn--full';
    backBtn.dataset.action = 'hub-back';
    backBtn.textContent = translator.t('ui.actions.back');
    backBtn.addEventListener('click', () => switchTab('hub'));
    footer.append(backBtn);
  };

  renderActiveTab();
  return backdrop;
}
