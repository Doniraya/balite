import './modals.css';
import {
  HAND_TYPES,
  SUITS,
  sortCardsByRank,
  type AnimationSpeed,
  type GameSettings,
  type PlayingCard,
  type RunState,
  type Suit,
} from '../engine';
import type { I18nLang, Translator } from '../i18n';
import { renderPlayingCardFrame } from './cardFrame';

/**
 * Параметры отрисовки модального окна настроек игры.
 */
export interface SettingsModalOptions {
  readonly settings: GameSettings;
  readonly translator: Translator;
  readonly platformId?: string;
  readonly isDebug?: boolean;
  readonly onChangeSettings: (patch: Partial<GameSettings>) => void;
  readonly onClose: () => void;
  readonly onDebugAction?: (
    action: 'interstitial' | 'rewarded' | 'flush' | 'resetRun',
  ) => Promise<string>;
}

/**
 * Допустимые значения скорости анимаций для сегментированного переключателя.
 */
const SPEED_OPTIONS: ReadonlyArray<{
  readonly value: AnimationSpeed;
  readonly key: 'ui.settings.speed1x' | 'ui.settings.speed2x' | 'ui.settings.speed4x';
}> = [
  { value: 1, key: 'ui.settings.speed1x' },
  { value: 2, key: 'ui.settings.speed2x' },
  { value: 4, key: 'ui.settings.speed4x' },
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
 * Разрешает массив идентификаторов карт в объекты PlayingCard согласно карте поиска колоды.
 */
function resolvePileCards(
  ids: readonly string[],
  cardById: ReadonlyMap<string, PlayingCard>,
): PlayingCard[] {
  const result: PlayingCard[] = [];
  for (const id of ids) {
    const card = cardById.get(id);
    if (card) {
      result.push(card);
    }
  }
  return result;
}

/**
 * Создаёт секцию стопки колоды с заголовком и сеткой компактных неинтерактивных карт.
 */
function createDeckPileSection(
  pileKey: string,
  title: string,
  cards: readonly PlayingCard[],
  translator: Translator,
): HTMLDivElement {
  const section = document.createElement('div');
  section.className = 'deck-pile-section';
  section.dataset.pile = pileKey;

  const heading = document.createElement('h3');
  heading.className = 'deck-pile-title';
  heading.textContent = title;
  section.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'deck-pile-grid';
  for (const card of cards) {
    grid.appendChild(
      renderPlayingCardFrame({
        card,
        translator,
        compact: true,
        interactive: false,
        faceDown: false,
      }),
    );
  }
  section.appendChild(grid);

  return section;
}

/**
 * Подсчитывает количество карт каждой масти в полной колоде (исключая Каменные карты).
 */
function countSuitsInDeck(deck: readonly PlayingCard[]): Record<Suit, number> {
  const counts: Record<Suit, number> = {
    spades: 0,
    hearts: 0,
    clubs: 0,
    diamonds: 0,
  };
  for (const card of deck) {
    if (card.enhancement === 'stone') {
      continue;
    }
    counts[card.suit] += 1;
  }
  return counts;
}

/**
 * Отрисовывает модальное окно состава колоды со сводкой по мастям и карточками стопок.
 */
export function renderDeckModal(
  state: RunState,
  translator: Translator,
  onClose: () => void,
): HTMLElement {
  const { backdrop, body } = createModalShell(
    translator.t('ui.deckModal.title'),
    translator.t('ui.deckModal.totalCards', { count: state.deck.length }),
    translator,
    onClose,
    'deck',
  );

  // Сводка по мастям над стопками (Каменные карты не имеют масти и пропускаются)
  const suitCounts = countSuitsInDeck(state.deck);
  const summary = document.createElement('div');
  summary.className = 'deck-suit-summary';
  for (const suit of SUITS) {
    const suitInfo = translator.catalog.suits[suit];
    const chip = document.createElement('div');
    chip.className = `deck-suit-chip deck-suit-chip--${suit}`;
    chip.dataset.suitSummary = suit;
    chip.dataset.count = String(suitCounts[suit]);
    chip.setAttribute('aria-label', `${suitInfo.name}: ${suitCounts[suit]}`);
    chip.textContent = `${suitInfo.symbol} ${suitCounts[suit]}`;
    summary.appendChild(chip);
  }
  body.appendChild(summary);

  const cardById = new Map<string, PlayingCard>(state.deck.map((card) => [card.id, card]));
  const inHandCards = resolvePileCards(state.handIds, cardById);
  // Колоду добора и сброс сортируем по рангу, чтобы не раскрывать скрытый порядок перемешивания
  const drawPileCards = sortCardsByRank(resolvePileCards(state.drawPileIds, cardById));
  const discardPileCards = sortCardsByRank(resolvePileCards(state.discardPileIds, cardById));

  body.appendChild(
    createDeckPileSection(
      'in-hand',
      translator.t('ui.deckModal.inHand', { count: inHandCards.length }),
      inHandCards,
      translator,
    ),
  );
  body.appendChild(
    createDeckPileSection(
      'draw-pile',
      translator.t('ui.deckModal.drawPile', { count: drawPileCards.length }),
      drawPileCards,
      translator,
    ),
  );
  body.appendChild(
    createDeckPileSection(
      'discard-pile',
      translator.t('ui.deckModal.discardPile', { count: discardPileCards.length }),
      discardPileCards,
      translator,
    ),
  );

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
 * Отрисовывает модальное окно настроек игры (скорость, звук, громкость, язык и опционально отладка).
 */
export function renderSettingsModal(options: SettingsModalOptions): HTMLElement {
  const { settings, translator, onChangeSettings, onClose } = options;
  const { backdrop, body } = createModalShell(
    translator.t('ui.settings.title'),
    null,
    translator,
    onClose,
    'settings',
  );

  // Скорость анимаций 1x / 2x / 4x
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

  // Отладочные инструменты доступны строго по флагу ?debug
  if (options.isDebug === true) {
    body.appendChild(createDebugSection(options.platformId, options.onDebugAction));
  }

  return backdrop;
}
