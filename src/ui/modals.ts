import './modals.css';
import {
  BOSS_IDS,
  CELESTIAL_IDS,
  CHARTER_IDS,
  DECK_IDS,
  DECK_VIEW_SUIT_ORDER,
  HAND_TYPES,
  RELIC_IDS,
  RUNE_IDS,
  SCROLL_IDS,
  buildDeckViewModel,
  getMostPlayedHand,
  type AnimationSpeed,
  type CrtMode,
  type DeckViewMode,
  type GameSettings,
  type MetaSave,
  type MetaStats,
  type PlayingCard,
  type Rank,
  type RunState,
  type Suit,
} from '../engine';
import {
  getGuildRank,
  isDevOriginalTermsEnabled,
  type I18nLang,
  type Translator,
} from '../i18n';
import { renderPlayingCardFrame } from './cardFrame';
import { APP_VERSION } from './mainMenu';
import { buildPlayingCardTooltip } from './screens';
import { setTooltipData } from './tooltip';

/**
 * Активный экран внутри модального хаба «Параметры».
 */
export type SettingsModalTab = 'hub' | 'settings' | 'stats' | 'credits';

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
 * Отрисовывает модальное окно справки по всем 12 раскладам с уровнями, счётчиками и формулами.
 */
export function renderHandReferenceModal(
  state: RunState,
  translator: Translator,
  onClose: () => void,
): HTMLElement {
  const { backdrop, body } = createModalShell(
    translator.t('ui.handReference.title'),
    null,
    translator,
    onClose,
    'hand-reference',
  );

  const list = document.createElement('div');
  list.className = 'hand-ref-list';

  for (const handType of HAND_TYPES) {
    const levelState = state.handLevels[handType];
    const row = document.createElement('div');
    row.className = 'hand-ref-row';
    if (!levelState.visible) {
      row.classList.add('hand-ref-row--hidden');
    }
    row.dataset.handType = handType;
    row.dataset.visible = String(levelState.visible);

    const mainCol = document.createElement('div');
    mainCol.className = 'hand-ref-main';

    const nameEl = document.createElement('div');
    nameEl.className = 'hand-ref-name';

    if (levelState.visible) {
      const handText = translator.getHandText(handType);
      nameEl.textContent = handText.name;
      mainCol.appendChild(nameEl);

      const descEl = document.createElement('div');
      descEl.className = 'hand-ref-desc';
      descEl.textContent = handText.description;
      mainCol.appendChild(descEl);
    } else {
      // Скрытые расклады не раскрывают название и правила до первого появления в забеге
      nameEl.textContent = translator.t('ui.handReference.hiddenLayout');
      mainCol.appendChild(nameEl);
    }

    const statsCol = document.createElement('div');
    statsCol.className = 'hand-ref-stats';

    const metaRow = document.createElement('div');
    metaRow.className = 'hand-ref-meta';

    const levelBadge = document.createElement('span');
    levelBadge.className = 'hand-ref-level';
    levelBadge.textContent = translator.t('ui.handReference.level', {
      level: levelState.level,
    });
    metaRow.appendChild(levelBadge);

    const playedEl = document.createElement('span');
    playedEl.textContent = translator.t('ui.handReference.played', {
      count: levelState.playedCount,
    });
    metaRow.appendChild(playedEl);

    const formulaEl = document.createElement('div');
    formulaEl.className = 'hand-ref-formula';
    formulaEl.textContent = translator.t('ui.handReference.baseFormula', {
      chips: levelState.chips,
      mult: levelState.mult,
    });

    statsCol.appendChild(metaRow);
    statsCol.appendChild(formulaEl);

    row.appendChild(mainCol);
    row.appendChild(statsCol);
    list.appendChild(row);
  }

  body.appendChild(list);
  return backdrop;
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
        setTooltipData(frame, buildPlayingCardTooltip(visibleCard, translator));
        fanEl.appendChild(frame);
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
        setTooltipData(frame, buildPlayingCardTooltip(visibleCard, translator));
        stoneFan.appendChild(frame);
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
function computeMetaStatsSummary(meta: MetaSave | undefined): MetaStats & {
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
    BOSS_IDS.length;

  const discoveredCount = meta
    ? new Set(meta.unlockedDecks).size +
      new Set(meta.discoveredRelics).size +
      new Set(meta.discoveredConsumables).size +
      new Set(meta.discoveredCharters).size +
      new Set(meta.discoveredBosses).size
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
function renderStatsTabBody(body: HTMLElement, meta: MetaSave | undefined, translator: Translator): void {
  const summary = computeMetaStatsSummary(meta);
  const topHand = getMostPlayedHand(summary);
  const mostPlayedText = topHand
    ? `${translator.getHandText(topHand.handType).name} (${topHand.count})`
    : translator.t('ui.stats.noneHand', { count: 0 });

  const grid = document.createElement('div');
  grid.className = 'stats-grid';
  grid.dataset.statsPanel = 'true';

  const entries: ReadonlyArray<{ readonly label: string; readonly value: string }> = [
    { label: translator.t('ui.stats.bestHand'), value: String(summary.bestHandScore) },
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
}

/**
 * Заполняет содержимое текстового окна «Титры и об игре» без внешних ссылок.
 */
function renderCreditsTabBody(
  body: HTMLElement,
  version: string,
  translator: Translator,
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

  // Отладочные инструменты и DEV-переключатель словаря доступны строго по флагу ?debug
  if (options.isDebug === true) {
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
 * Отрисовывает модальный хаб «Параметры» с вкладками «Настройки», «Статистика», «Титры» и возвратом в Главное меню.
 */
export function renderSettingsModal(options: SettingsModalOptions): HTMLElement {
  const { translator, onClose, onReturnToMainMenu, onTabChange } = options;
  const version = options.version ?? APP_VERSION;
  let currentTab: SettingsModalTab = options.initialTab ?? 'hub';

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
  };

  const renderActiveTab = (): void => {
    body.replaceChildren();
    footer.replaceChildren();
    sheet.classList.toggle('settings-hub-sheet--wide', currentTab === 'stats');

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
      renderStatsTabBody(body, options.meta, translator);
    } else {
      if (titleEl) {
        titleEl.textContent = translator.t('ui.credits.title');
      }
      renderCreditsTabBody(body, version, translator);
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
