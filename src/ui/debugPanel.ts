// Модуль расширенной Админ-панели (?debug) для отладки боя, карт, предметов и SDK (Эпик 3).
import './debugPanel.css';
import {
  CELESTIAL_IDS,
  CHARTER_IDS,
  EDITIONS,
  ENHANCEMENTS,
  RELIC_IDS,
  RUNE_IDS,
  SCROLL_IDS,
  SEALS,
  type CharterId,
  type ConsumableId,
  type DebugCardModsOptions,
  type DebugResourcesOptions,
  type Edition,
  type RelicId,
  type RunState,
} from '../engine';
import type { Translator } from '../i18n';

/** Доступные вкладки Админ-панели. */
export type DebugPanelTab = 'combat' | 'cards' | 'spawn' | 'system';

/** Фильтры категорий в каталоге выдачи предметов. */
export type DebugSpawnFilter = 'relics' | 'celestial' | 'scroll' | 'rune' | 'charters';

/** Действия вкладки Система / SDK. */
export type DebugSystemAction =
  | 'interstitial'
  | 'rewarded'
  | 'flush'
  | 'resetRun'
  | 'unlockCollection'
  | 'resetCollection';

/** Параметры рендера Админ-панели. */
export interface DebugPanelOptions {
  readonly state: RunState;
  readonly selectedCardIds: readonly string[];
  readonly translator: Translator;
  readonly platformId?: string;
  readonly initialTab?: DebugPanelTab;
  readonly initialSpawnFilter?: DebugSpawnFilter;
  readonly initialSearchQuery?: string;
  readonly initialSpawnEdition?: Edition;
  readonly initialCardScope?: 'selected' | 'all';
  readonly initialLogs?: readonly string[];
  readonly devOriginalTermsEnabled?: boolean;
  readonly onToggleDevOriginalTerms?: (enabled: boolean) => void;
  readonly onTabChange?: (tab: DebugPanelTab) => void;
  readonly onSpawnFilterChange?: (filter: DebugSpawnFilter) => void;
  readonly onSearchQueryChange?: (query: string) => void;
  readonly onSpawnEditionChange?: (edition: Edition) => void;
  readonly onCardScopeChange?: (scope: 'selected' | 'all') => void;
  readonly onUpdateResources: (opts: DebugResourcesOptions) => void;
  readonly onForceBlindWin: () => void;
  readonly onForceRunEnd: (outcome: 'victory' | 'game_over') => void;
  readonly onApplyCardMods: (opts: DebugCardModsOptions) => void;
  readonly onTestGlassShatter: () => void;
  readonly onGiveRelic: (relicId: RelicId, edition: Edition) => void;
  readonly onGiveConsumable: (consumableId: ConsumableId, edition: Edition) => void;
  readonly onApplyVoucher: (charterId: CharterId) => void;
  readonly onDebugAction: (action: DebugSystemAction) => Promise<string>;
  readonly onClose: () => void;
}

function createDebugEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function createDebugButton(
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const btn = createDebugEl('button', className, label);
  btn.type = 'button';
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Отрисовывает модальную Админ-панель (?debug) с 4 вкладками, поиском и DEV-словарём.
 */
export function renderDebugPanel(options: DebugPanelOptions): HTMLElement {
  const { state, selectedCardIds, translator, onClose } = options;
  const isRu = translator.lang === 'ru';

  let activeTab: DebugPanelTab = options.initialTab ?? 'combat';
  let spawnFilter: DebugSpawnFilter = options.initialSpawnFilter ?? 'relics';
  let searchQuery = options.initialSearchQuery ?? '';
  let spawnEdition: Edition = options.initialSpawnEdition ?? 'base';
  let cardScope: 'selected' | 'all' = options.initialCardScope ?? 'selected';
  const logLines = [...(options.initialLogs ?? ['ready'])];

  const backdrop = createDebugEl('div', 'modal-backdrop');
  backdrop.dataset.modal = 'debug';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) onClose();
  });

  const sheet = createDebugEl('div', 'modal-sheet debug-panel-sheet');
  const header = createDebugEl('div', 'modal-header');
  const title = createDebugEl('h2', 'modal-title', isRu ? 'DEV-панель (?debug)' : 'DEV Panel (?debug)');
  const closeIconBtn = createDebugButton('×', 'modal-close-btn', onClose);
  closeIconBtn.setAttribute('aria-label', translator.t('ui.actions.close'));
  header.append(title, closeIconBtn);

  // Мета-строка состояния забега и переключателя DEV-словаря (только в DEV-окружении)
  const metaBar = createDebugEl('div', 'debug-panel__meta');
  const goldText = translator.t('ui.hud.goldAmount', { dollars: state.dollars });
  const statusSpan = createDebugEl(
    'span',
    undefined,
    isRu
      ? `Этап ${state.ante} · Очки ${state.score}/${state.targetScore} · ${goldText} · Выбрано в руке: ${selectedCardIds.length} · ${state.phase}`
      : `Stage ${state.ante} · Score ${state.score}/${state.targetScore} · ${goldText} · Selected: ${selectedCardIds.length} · ${state.phase}`,
  );
  metaBar.append(statusSpan);

  if (import.meta.env.DEV && options.onToggleDevOriginalTerms) {
    const devWrap = createDebugEl('div', 'debug-panel__dev-toggle');
    devWrap.append(createDebugEl('span', undefined, isRu ? 'Словарь:' : 'Terms:'));
    const offBtn = createDebugButton(
      translator.t('ui.settings.soundOff'),
      `debug-panel__chip ${options.devOriginalTermsEnabled ? '' : 'is-active'}`.trim(),
      () => options.onToggleDevOriginalTerms?.(false),
    );
    offBtn.dataset.devTerms = 'off';
    const onBtn = createDebugButton(
      isRu ? 'Оригинал' : 'Original',
      `debug-panel__chip ${options.devOriginalTermsEnabled ? 'is-active' : ''}`.trim(),
      () => options.onToggleDevOriginalTerms?.(true),
    );
    onBtn.dataset.devTerms = 'on';
    devWrap.append(offBtn, onBtn);
    metaBar.append(devWrap);
  }

  // Навигация по 4 вкладкам
  const tabsRow = createDebugEl('div', 'debug-panel__tabs');
  const tabDefs: ReadonlyArray<{ id: DebugPanelTab; label: string }> = [
    { id: 'combat', label: isRu ? 'Бой и ресурсы' : 'Combat & Gold' },
    { id: 'cards', label: isRu ? 'Карты в руке' : 'Hand Cards' },
    { id: 'spawn', label: isRu ? 'Выдать предмет' : 'Spawn Item' },
    { id: 'system', label: isRu ? 'Система / SDK' : 'System / SDK' },
  ];

  const body = createDebugEl('div', 'modal-body');
  const tabButtons = new Map<DebugPanelTab, HTMLButtonElement>();

  const pushLog = (line: string): void => {
    logLines.unshift(line);
    if (logLines.length > 20) logLines.length = 20;
  };

  const renderBody = (): void => {
    body.replaceChildren();
    for (const [id, btn] of tabButtons) {
      btn.classList.toggle('is-active', id === activeTab);
    }

    if (activeTab === 'combat') {
      const resSec = createDebugEl('div', 'debug-panel__section');
      resSec.append(createDebugEl('h3', 'debug-panel__section-title', isRu ? 'Ресурсы и Ранг' : 'Resources & Rank'));
      const resGrid = createDebugEl('div', 'debug-panel__grid');

      const resButtons: ReadonlyArray<{ cmd: string; label: string; opts: DebugResourcesOptions }> = [
        { cmd: 'add-dollars-20', label: '+$20', opts: { addDollars: 20 } },
        { cmd: 'add-dollars-100', label: '+$100', opts: { addDollars: 100 } },
        { cmd: 'add-hands-2', label: isRu ? '+2 Руки' : '+2 Hands', opts: { addHands: 2 } },
        { cmd: 'add-discards-2', label: isRu ? '+2 Сброса' : '+2 Discards', opts: { addDiscards: 2 } },
        { cmd: 'target-50', label: isRu ? '50% цели' : '50% Target', opts: { targetPercent: 50 } },
        { cmd: 'target-100', label: isRu ? 'Пробить порог' : '100% Target', opts: { targetPercent: 100 } },
        { cmd: 'ante-next', label: isRu ? 'Ранг +1' : 'Rank +1', opts: { setAnte: Math.min(8, state.ante + 1) } },
        { cmd: 'ante-8', label: isRu ? 'Ранг SS (8)' : 'Rank SS (8)', opts: { setAnte: 8 } },
      ];
      for (const item of resButtons) {
        const btn = createDebugButton(item.label, 'debug-panel__btn', () => {
          options.onUpdateResources(item.opts);
        });
        btn.dataset.debugCmd = item.cmd;
        resGrid.append(btn);
      }
      resSec.append(resGrid);

      const flowSec = createDebugEl('div', 'debug-panel__section');
      flowSec.append(createDebugEl('h3', 'debug-panel__section-title', isRu ? 'Переходы раунда' : 'Round Transitions'));
      const flowGrid = createDebugEl('div', 'debug-panel__grid');

      const winRoundBtn = createDebugButton(
        isRu ? 'Выполнить заказ (кэшаут)' : 'Clear Quest (Cashout)',
        'debug-panel__btn debug-panel__btn--accent',
        () => options.onForceBlindWin(),
      );
      winRoundBtn.dataset.debugCmd = 'force-cashout';

      const victoryBtn = createDebugButton(
        isRu ? 'Победа (+конфетти)' : 'Victory (+confetti)',
        'debug-panel__btn debug-panel__btn--accent',
        () => options.onForceRunEnd('victory'),
      );
      victoryBtn.dataset.debugCmd = 'force-victory';

      const defeatBtn = createDebugButton(
        isRu ? 'Поражение' : 'Defeat',
        'debug-panel__btn debug-panel__btn--danger',
        () => options.onForceRunEnd('game_over'),
      );
      defeatBtn.dataset.debugCmd = 'force-gameover';

      flowGrid.append(winRoundBtn, victoryBtn, defeatBtn);
      flowSec.append(flowGrid);

      body.append(resSec, flowSec);
      return;
    }

    if (activeTab === 'cards') {
      const scopeSec = createDebugEl('div', 'debug-panel__section');
      scopeSec.append(createDebugEl('h3', 'debug-panel__section-title', isRu ? 'Цель модификации' : 'Target Cards'));
      const scopeRow = createDebugEl('div', 'debug-panel__chips-row');
      const selectedLabel =
        selectedCardIds.length > 0
          ? isRu
            ? `Выбранные (${selectedCardIds.length})`
            : `Selected (${selectedCardIds.length})`
          : isRu
            ? 'Выбранные (0 -> 1-я карта)'
            : 'Selected (0 -> 1st card)';
      const selScopeBtn = createDebugButton(
        selectedLabel,
        `debug-panel__chip ${cardScope === 'selected' ? 'is-active' : ''}`.trim(),
        () => {
          cardScope = 'selected';
          options.onCardScopeChange?.(cardScope);
          renderBody();
        },
      );
      selScopeBtn.dataset.debugScope = 'selected';

      const allScopeBtn = createDebugButton(
        isRu ? `Вся рука (${state.handIds.length})` : `Whole hand (${state.handIds.length})`,
        `debug-panel__chip ${cardScope === 'all' ? 'is-active' : ''}`.trim(),
        () => {
          cardScope = 'all';
          options.onCardScopeChange?.(cardScope);
          renderBody();
        },
      );
      allScopeBtn.dataset.debugScope = 'all';
      scopeRow.append(selScopeBtn, allScopeBtn);
      scopeSec.append(scopeRow);

      const getScopeCardIds = (): readonly string[] | 'all' | undefined =>
        cardScope === 'all' ? 'all' : selectedCardIds;

      // Издания
      const edSec = createDebugEl('div', 'debug-panel__section');
      edSec.append(createDebugEl('h3', 'debug-panel__section-title', isRu ? 'Издание' : 'Edition'));
      const edRow = createDebugEl('div', 'debug-panel__chips-row');
      for (const edition of EDITIONS) {
        const btn = createDebugButton(
          translator.catalog.editions[edition].name,
          'debug-panel__chip',
          () => options.onApplyCardMods({ cardIds: getScopeCardIds(), edition }),
        );
        btn.dataset.debugEdition = edition;
        edRow.append(btn);
      }
      edSec.append(edRow);

      // Усиления
      const enhSec = createDebugEl('div', 'debug-panel__section');
      enhSec.append(createDebugEl('h3', 'debug-panel__section-title', isRu ? 'Усиление' : 'Enhancement'));
      const enhRow = createDebugEl('div', 'debug-panel__chips-row');
      for (const enhancement of ENHANCEMENTS) {
        const label =
          enhancement === 'none'
            ? isRu
              ? 'Без усиления'
              : 'No Enhancement'
            : translator.catalog.enhancements[enhancement].name;
        const btn = createDebugButton(label, 'debug-panel__chip', () =>
          options.onApplyCardMods({ cardIds: getScopeCardIds(), enhancement }),
        );
        btn.dataset.debugEnhancement = enhancement;
        enhRow.append(btn);
      }
      enhSec.append(enhRow);

      // Печати + быстрый тест осколков Хрусталя
      const sealSec = createDebugEl('div', 'debug-panel__section');
      sealSec.append(createDebugEl('h3', 'debug-panel__section-title', isRu ? 'Печать и тест осколков' : 'Seal & Shatter FX'));
      const sealRow = createDebugEl('div', 'debug-panel__chips-row');
      for (const seal of SEALS) {
        const btn = createDebugButton(translator.catalog.seals[seal].name, 'debug-panel__chip', () =>
          options.onApplyCardMods({ cardIds: getScopeCardIds(), seal }),
        );
        btn.dataset.debugSeal = seal;
        sealRow.append(btn);
      }
      const shatterBtn = createDebugButton(
        isRu ? 'Тест осколков Хрусталя' : 'Test Crystal Shatter',
        'debug-panel__btn debug-panel__btn--accent',
        () => options.onTestGlassShatter(),
      );
      shatterBtn.dataset.debugCmd = 'test-glass-shatter';
      sealRow.append(shatterBtn);
      sealSec.append(sealRow);

      body.append(scopeSec, edSec, enhSec, sealSec);
      return;
    }

    if (activeTab === 'spawn') {
      const ctrlSec = createDebugEl('div', 'debug-panel__section');

      const searchInput = createDebugEl('input', 'debug-panel__search');
      searchInput.type = 'search';
      searchInput.value = searchQuery;
      searchInput.placeholder = isRu ? 'Поиск по названию или id...' : 'Search by name or id...';
      searchInput.dataset.debugSearch = 'true';

      const filterRow = createDebugEl('div', 'debug-panel__chips-row');
      const filterDefs: ReadonlyArray<{ id: DebugSpawnFilter; label: string }> = [
        { id: 'relics', label: translator.t('ui.hud.relics') },
        { id: 'celestial', label: translator.catalog.consumableKinds.celestial },
        { id: 'scroll', label: translator.catalog.consumableKinds.scroll },
        { id: 'rune', label: translator.catalog.consumableKinds.rune },
        { id: 'charters', label: translator.t('ui.shop.charterTitle') },
      ];
      const filterButtons = new Map<DebugSpawnFilter, HTMLButtonElement>();
      for (const f of filterDefs) {
        const btn = createDebugButton(
          f.label,
          `debug-panel__chip ${spawnFilter === f.id ? 'is-active' : ''}`.trim(),
          () => {
            spawnFilter = f.id;
            options.onSpawnFilterChange?.(f.id);
            renderSpawnItems();
            for (const [fid, fbtn] of filterButtons) {
              fbtn.classList.toggle('is-active', fid === spawnFilter);
            }
          },
        );
        btn.dataset.debugFilter = f.id;
        filterButtons.set(f.id, btn);
        filterRow.append(btn);
      }

      const editionRow = createDebugEl('div', 'debug-panel__chips-row');
      const editionButtons = new Map<Edition, HTMLButtonElement>();
      for (const ed of EDITIONS) {
        const btn = createDebugButton(
          translator.catalog.editions[ed].name,
          `debug-panel__chip ${spawnEdition === ed ? 'is-active' : ''}`.trim(),
          () => {
            spawnEdition = ed;
            options.onSpawnEditionChange?.(ed);
            for (const [eid, ebtn] of editionButtons) {
              ebtn.classList.toggle('is-active', eid === spawnEdition);
            }
          },
        );
        btn.dataset.debugSpawnEdition = ed;
        editionButtons.set(ed, btn);
        editionRow.append(btn);
      }

      const listEl = createDebugEl('div', 'debug-panel__spawn-list');

      const renderSpawnItems = (): void => {
        listEl.replaceChildren();
        const needle = searchQuery.trim().toLowerCase();

        interface SpawnEntry {
          readonly giveAttr: string;
          readonly id: string;
          readonly name: string;
          readonly onSelect: () => void;
        }

        const entries: SpawnEntry[] = [];
        if (spawnFilter === 'relics') {
          for (const relicId of RELIC_IDS) {
            const name = translator.getRelicText(relicId).name;
            entries.push({
              giveAttr: `relic:${relicId}`,
              id: relicId,
              name,
              onSelect: () => options.onGiveRelic(relicId, spawnEdition),
            });
          }
        } else if (spawnFilter === 'charters') {
          for (const charterId of CHARTER_IDS) {
            const name = translator.getCharterText(charterId).name;
            entries.push({
              giveAttr: `charter:${charterId}`,
              id: charterId,
              name,
              onSelect: () => options.onApplyVoucher(charterId),
            });
          }
        } else {
          const consIds =
            spawnFilter === 'celestial'
              ? CELESTIAL_IDS
              : spawnFilter === 'scroll'
                ? SCROLL_IDS
                : RUNE_IDS;
          for (const consId of consIds) {
            const name = translator.getConsumableText(consId).name;
            entries.push({
              giveAttr: `consumable:${consId}`,
              id: consId,
              name,
              onSelect: () => options.onGiveConsumable(consId, spawnEdition),
            });
          }
        }

        for (const entry of entries) {
          if (
            needle.length > 0 &&
            !entry.name.toLowerCase().includes(needle) &&
            !entry.id.toLowerCase().includes(needle)
          ) {
            continue;
          }
          const itemBtn = createDebugEl('button', 'debug-panel__spawn-item');
          itemBtn.type = 'button';
          itemBtn.dataset.debugGive = entry.giveAttr;
          itemBtn.append(
            createDebugEl('span', 'debug-panel__spawn-name', entry.name),
            createDebugEl('span', 'debug-panel__spawn-id', entry.id),
          );
          itemBtn.addEventListener('click', entry.onSelect);
          listEl.append(itemBtn);
        }
      };

      searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        options.onSearchQueryChange?.(searchQuery);
        renderSpawnItems();
      });

      renderSpawnItems();
      ctrlSec.append(searchInput, filterRow, editionRow, listEl);
      body.append(ctrlSec);
      return;
    }

    // Вкладка 4: Система / SDK
    const sysSec = createDebugEl('div', 'debug-panel__section');
    sysSec.append(
      createDebugEl(
        'h3',
        'debug-panel__section-title',
        `SDK: ${options.platformId ?? 'unknown'} · Seed: ${state.seed}`,
      ),
    );
    const sysGrid = createDebugEl('div', 'debug-panel__grid');
    const logEl = createDebugEl('pre', 'debug-panel__log', logLines.join('\n'));
    logEl.dataset.debugLog = 'true';

    const sysActions: ReadonlyArray<{ action: DebugSystemAction; label: string }> = [
      { action: 'interstitial', label: 'showInterstitial()' },
      { action: 'rewarded', label: 'showRewarded()' },
      { action: 'flush', label: 'flushCloudSave()' },
      { action: 'resetRun', label: 'resetRun()' },
      { action: 'unlockCollection', label: 'Открыть всю коллекцию' },
      { action: 'resetCollection', label: 'Сбросить коллекцию' },
    ];

    for (const item of sysActions) {
      const btn = createDebugButton(item.label, 'debug-panel__btn', () => {
        void options.onDebugAction(item.action).then(
          (res) => {
            pushLog(res);
            logEl.textContent = logLines.join('\n');
          },
          (err: unknown) => {
            pushLog(`${item.action}: ${String(err)}`);
            logEl.textContent = logLines.join('\n');
          },
        );
      });
      btn.dataset.debugAction = item.action;
      sysGrid.append(btn);
    }

    sysSec.append(sysGrid, logEl);
    body.append(sysSec);
  };

  for (const def of tabDefs) {
    const tabBtn = createDebugButton(def.label, 'debug-panel__tab', () => {
      activeTab = def.id;
      options.onTabChange?.(def.id);
      renderBody();
    });
    tabBtn.dataset.debugTab = def.id;
    tabButtons.set(def.id, tabBtn);
    tabsRow.append(tabBtn);
  }

  renderBody();

  const footer = createDebugEl('div', 'modal-footer');
  const closeFooterBtn = createDebugButton(
    translator.t('ui.actions.close'),
    'modal-btn modal-btn--primary',
    onClose,
  );
  closeFooterBtn.dataset.action = 'close';
  footer.append(closeFooterBtn);

  sheet.append(header, metaBar, tabsRow, body, footer);
  backdrop.append(sheet);
  return backdrop;
}
