import { describe, expect, it, vi } from 'vitest';
import { createInitialRunState, dispatch } from '../../src/engine';
import type { DebugCardModsOptions, DebugResourcesOptions } from '../../src/engine';
import { createTranslator } from '../../src/i18n';
import {
  renderDebugPanel,
  type DebugPanelOptions,
  type DebugPanelTab,
} from '../../src/ui/debugPanel';

const FORBIDDEN_MODERATION_WORDS: readonly RegExp[] = [
  /покер\p{L}*/iu,
  /казино\p{L}*/iu,
  /таро/iu,
  /джокер\p{L}*/iu,
  /блайнд\p{L}*/iu,
  /ваучер\p{L}*/iu,
  /\bpokers?\b/i,
  /\bcasinos?\b/i,
  /\btarot\b/i,
  /\bjokers?\b/i,
  /\bvouchers?\b/i,
  /\bgambling\b/i,
];

function createPlayingState() {
  const base = createInitialRunState('b_red', 'DBGPANEL');
  return dispatch(base, { type: 'SELECT_BLIND' }).nextState;
}

describe('Расширенная Админ-панель (?debug) — src/ui/debugPanel.ts', () => {
  it('рендерит 4 вкладки, счётчик выбранных карт и переключатель DEV-словаря, без запрещённых слов 6+/12+', async () => {
    const ru = createTranslator('ru');
    const state = createPlayingState();
    const selectedIds = state.handIds.slice(0, 2);

    const onClose = vi.fn();
    const onToggleDevOriginalTerms = vi.fn();

    const modal = renderDebugPanel({
      state,
      selectedCardIds: selectedIds,
      translator: ru,
      platformId: 'mock',
      devOriginalTermsEnabled: false,
      onToggleDevOriginalTerms,
      onUpdateResources: vi.fn(),
      onForceBlindWin: vi.fn(),
      onForceRunEnd: vi.fn(),
      onApplyCardMods: vi.fn(),
      onTestGlassShatter: vi.fn(),
      onGiveRelic: vi.fn(),
      onGiveConsumable: vi.fn(),
      onApplyVoucher: vi.fn(),
      onDebugAction: vi.fn().mockResolvedValue('ok'),
      onClose,
    });

    expect(modal.dataset.modal).toBe('debug');
    expect(modal.querySelectorAll('[data-debug-tab]')).toHaveLength(4);
    expect(modal.textContent).toContain('2');

    // Проверка на отсутствие запрещённых терминов и сырых ключей i18n во всех 4 вкладках (при отключённом DEV-словаре)
    const tabs: readonly DebugPanelTab[] = ['combat', 'cards', 'spawn', 'system'];
    for (const tab of tabs) {
      modal.querySelector<HTMLButtonElement>(`[data-debug-tab="${tab}"]`)?.click();
      const text = modal.textContent ?? '';
      expect(text, `Вкладка ${tab} не должна содержать непереведённые ключи ui.*`).not.toMatch(/\bui\.[a-zA-Z0-9_.]+/);
      for (const btn of Array.from(modal.querySelectorAll<HTMLButtonElement>('button'))) {
        expect(btn.textContent ?? '', `Кнопка на вкладке ${tab} не должна содержать сырой ключ ui.*`).not.toMatch(/\bui\.[a-zA-Z0-9_.]+/);
      }
      for (const rx of FORBIDDEN_MODERATION_WORDS) {
        expect(text, `Вкладка ${tab} не должна содержать запрещённое слово ${rx}`).not.toMatch(rx);
      }
    }

    // Переключатель DEV-словаря
    const devOnBtn = modal.querySelector<HTMLButtonElement>('[data-dev-terms="on"]');
    expect(devOnBtn).not.toBeNull();
    devOnBtn?.click();
    expect(onToggleDevOriginalTerms).toHaveBeenCalledWith(true);

    // Вкладка CSS без открытого :hover вне @media (hover: hover) and (pointer: fine)
    const fsModule = 'node:fs';
    const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as {
      readFileSync: (file: string, encoding: 'utf8') => string;
    };
    const css = readFileSync('src/ui/debugPanel.css', 'utf8');
    const strippedMedia = css.replace(
      /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*\{[\s\S]*?\n\}/g,
      '',
    );
    expect(strippedMedia).not.toMatch(/:hover\b/);
  });

  it('вкладка «Бой и ресурсы» вызывает все мутации ресурсов, Стража, Этапа и финала забега', () => {
    const ru = createTranslator('ru');
    const state = createPlayingState();
    const onUpdateResources = vi.fn<(opts: DebugResourcesOptions) => void>();
    const onForceBlindWin = vi.fn();
    const onForceRunEnd = vi.fn();

    const modal = renderDebugPanel({
      state,
      selectedCardIds: [],
      translator: ru,
      platformId: 'mock',
      initialTab: 'combat',
      onUpdateResources,
      onForceBlindWin,
      onForceRunEnd,
      onApplyCardMods: vi.fn(),
      onTestGlassShatter: vi.fn(),
      onGiveRelic: vi.fn(),
      onGiveConsumable: vi.fn(),
      onApplyVoucher: vi.fn(),
      onDebugAction: vi.fn().mockResolvedValue('ok'),
      onClose: vi.fn(),
    });

    modal.querySelector<HTMLButtonElement>('[data-debug-cmd="add-dollars-20"]')?.click();
    expect(onUpdateResources).toHaveBeenCalledWith({ addDollars: 20 });

    modal.querySelector<HTMLButtonElement>('[data-debug-cmd="target-50"]')?.click();
    expect(onUpdateResources).toHaveBeenCalledWith({ targetPercent: 50 });

    modal.querySelector<HTMLButtonElement>('[data-debug-cmd="target-100"]')?.click();
    expect(onUpdateResources).toHaveBeenCalledWith({ targetPercent: 100 });

    modal.querySelector<HTMLButtonElement>('[data-debug-cmd="ante-8"]')?.click();
    expect(onUpdateResources).toHaveBeenCalledWith({ setAnte: 8 });

    modal.querySelector<HTMLButtonElement>('[data-debug-cmd="force-cashout"]')?.click();
    expect(onForceBlindWin).toHaveBeenCalledTimes(1);

    modal.querySelector<HTMLButtonElement>('[data-debug-cmd="force-victory"]')?.click();
    expect(onForceRunEnd).toHaveBeenCalledWith('victory');

    modal.querySelector<HTMLButtonElement>('[data-debug-cmd="force-gameover"]')?.click();
    expect(onForceRunEnd).toHaveBeenCalledWith('game_over');
  });

  it('вкладка «Карты в руке» применяет Издания/Усиления/Печати к выбранным или ко всей руке и тестирует осколки', () => {
    const ru = createTranslator('ru');
    const state = createPlayingState();
    const selectedIds = [state.handIds[0]!, state.handIds[2]!];
    const onApplyCardMods = vi.fn<(opts: DebugCardModsOptions) => void>();
    const onTestGlassShatter = vi.fn();

    const modal = renderDebugPanel({
      state,
      selectedCardIds: selectedIds,
      translator: ru,
      platformId: 'mock',
      initialTab: 'cards',
      onUpdateResources: vi.fn(),
      onForceBlindWin: vi.fn(),
      onForceRunEnd: vi.fn(),
      onApplyCardMods,
      onTestGlassShatter,
      onGiveRelic: vi.fn(),
      onGiveConsumable: vi.fn(),
      onApplyVoucher: vi.fn(),
      onDebugAction: vi.fn().mockResolvedValue('ok'),
      onClose: vi.fn(),
    });

    // По умолчанию область — выбранные карты
    modal.querySelector<HTMLButtonElement>('[data-debug-edition="polychrome"]')?.click();
    expect(onApplyCardMods).toHaveBeenCalledWith({
      cardIds: selectedIds,
      edition: 'polychrome',
    });

    // Переключаем на всю руку
    modal.querySelector<HTMLButtonElement>('[data-debug-scope="all"]')?.click();
    modal.querySelector<HTMLButtonElement>('[data-debug-enhancement="glass"]')?.click();
    expect(onApplyCardMods).toHaveBeenCalledWith({
      cardIds: 'all',
      enhancement: 'glass',
    });

    modal.querySelector<HTMLButtonElement>('[data-debug-seal="red"]')?.click();
    expect(onApplyCardMods).toHaveBeenCalledWith({
      cardIds: 'all',
      seal: 'red',
    });

    modal.querySelector<HTMLButtonElement>('[data-debug-cmd="test-glass-shatter"]')?.click();
    expect(onTestGlassShatter).toHaveBeenCalledTimes(1);
  });

  it('вкладка «Выдать предмет» фильтрует и ищет по категориям и выдаёт Реликвию / Расходник / Грамоту в 1 клик', () => {
    const ru = createTranslator('ru');
    const state = createPlayingState();
    const onGiveRelic = vi.fn();
    const onGiveConsumable = vi.fn();
    const onApplyVoucher = vi.fn();

    const options: DebugPanelOptions = {
      state,
      selectedCardIds: [],
      translator: ru,
      platformId: 'mock',
      initialTab: 'spawn',
      onUpdateResources: vi.fn(),
      onForceBlindWin: vi.fn(),
      onForceRunEnd: vi.fn(),
      onApplyCardMods: vi.fn(),
      onTestGlassShatter: vi.fn(),
      onGiveRelic,
      onGiveConsumable,
      onApplyVoucher,
      onDebugAction: vi.fn().mockResolvedValue('ok'),
      onClose: vi.fn(),
    };

    const modal = renderDebugPanel(options);

    // Выбираем издание «Радужное» (holo) для выдачи и выдаём j_joker
    modal.querySelector<HTMLButtonElement>('[data-debug-spawn-edition="holo"]')?.click();
    const searchInput = modal.querySelector<HTMLInputElement>('[data-debug-search="true"]')!;
    searchInput.value = 'j_joker';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    modal.querySelector<HTMLButtonElement>('[data-debug-give="relic:j_joker"]')?.click();
    expect(onGiveRelic).toHaveBeenCalledWith('j_joker', 'holo');

    // Переключаемся на Свитки и выдаём с_empress
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    modal.querySelector<HTMLButtonElement>('[data-debug-filter="scroll"]')?.click();
    modal.querySelector<HTMLButtonElement>('[data-debug-give="consumable:c_empress"]')?.click();
    expect(onGiveConsumable).toHaveBeenCalledWith('c_empress', 'holo');

    // Переключаемся на Грамоты и применяем v_grabber
    modal.querySelector<HTMLButtonElement>('[data-debug-filter="charters"]')?.click();
    modal.querySelector<HTMLButtonElement>('[data-debug-give="charter:v_grabber"]')?.click();
    expect(onApplyVoucher).toHaveBeenCalledWith('v_grabber');
  });

  it('вкладка «Система / SDK» вызывает showInterstitial/showRewarded/flush/resetRun и обновляет лог', async () => {
    const ru = createTranslator('ru');
    const state = createPlayingState();
    const onDebugAction = vi.fn().mockResolvedValue('interstitial: shown=true');

    const modal = renderDebugPanel({
      state,
      selectedCardIds: [],
      translator: ru,
      platformId: 'yandex',
      initialTab: 'system',
      onUpdateResources: vi.fn(),
      onForceBlindWin: vi.fn(),
      onForceRunEnd: vi.fn(),
      onApplyCardMods: vi.fn(),
      onTestGlassShatter: vi.fn(),
      onGiveRelic: vi.fn(),
      onGiveConsumable: vi.fn(),
      onApplyVoucher: vi.fn(),
      onDebugAction,
      onClose: vi.fn(),
    });

    modal.querySelector<HTMLButtonElement>('[data-debug-action="interstitial"]')?.click();
    expect(onDebugAction).toHaveBeenCalledWith('interstitial');
    await Promise.resolve();
    await Promise.resolve();
    expect(modal.querySelector('[data-debug-log]')?.textContent).toContain('interstitial: shown=true');
  });
});
