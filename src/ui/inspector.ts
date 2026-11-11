import './modals.css';
import { getRelicDefinition } from '../engine/relics';
import type {
  BossId,
  CharterId,
  ConsumableId,
  ConsumableInstance,
  PackOffer,
  PlayingCard,
  RelicId,
  RelicInstance,
  RunState,
  ShopOffer,
} from '../engine/types';
import { DEFAULT_RELIC_PARAMS, type Translator } from '../i18n';
import { renderEntityCardFrame, renderPlayingCardFrame } from './cardFrame';

/**
 * Требования к выбору целевых карт в руке перед применением расходника.
 */
export interface ConsumableTargetRequirement {
  readonly min: number;
  readonly max: number;
  readonly mode: 'none' | 'upTo' | 'exact' | 'single' | 'mirror';
}

/**
 * Расходники, допускающие выбор 1 или 2 целевых карт в руке.
 */
const UP_TO_TWO_CONSUMABLES: ReadonlySet<ConsumableId> = new Set([
  'c_magician',
  'c_empress',
  'c_heirophant',
  'c_strength',
  'c_hanged_man',
]);

/**
 * Расходники, требующие выбора ровно 1 целевой карты в руке.
 */
const SINGLE_TARGET_CONSUMABLES: ReadonlySet<ConsumableId> = new Set([
  'c_lovers',
  'c_chariot',
  'c_justice',
  'c_devil',
  'c_tower',
  'c_talisman',
  'c_deja_vu',
  'c_trance',
  'c_medium',
  'c_aura',
  'c_cryptid',
]);

/**
 * Определяет правило выбора карт в руке для указанного идентификатора расходника.
 */
export function getConsumableTargetRequirement(
  consumableId: ConsumableId,
): ConsumableTargetRequirement {
  if (UP_TO_TWO_CONSUMABLES.has(consumableId)) {
    return { min: 1, max: 2, mode: 'upTo' };
  }
  if (SINGLE_TARGET_CONSUMABLES.has(consumableId)) {
    return { min: 1, max: 1, mode: 'single' };
  }
  if (consumableId === 'c_death') {
    return { min: 2, max: 2, mode: 'mirror' };
  }
  return { min: 0, max: 0, mode: 'none' };
}

/**
 * Срез состояния забега, достаточный для расчёта живых параметров подстановки Реликвий.
 */
export type RelicLocParamsState = Pick<
  RunState,
  'relics' | 'deck' | 'discardsLeft' | 'handsLeft' | 'handLevels' | 'charters'
> &
  Partial<Pick<RunState, 'maxRelics' | 'dollars'>>;

/**
 * Округляет множитель до сотых, устраняя погрешность двоичной арифметики.
 */
function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Вычисляет текущие параметры подстановки {placeholder} для описания Реликвии
 * на основе её накопительных счётчиков и состояния забега, дополняя значениями DEFAULT_RELIC_PARAMS.
 */
export function getRelicLocParams(
  relic: RelicInstance,
  state?: RelicLocParamsState,
): Record<string, string | number> {
  const defaults = DEFAULT_RELIC_PARAMS[relic.id] ?? {};
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(defaults)) {
    if (value !== undefined) {
      params[key] = value;
    }
  }

  switch (relic.id) {
    case 'j_runner':
      params.chips = relic.state.chips;
      break;
    case 'j_green_joker':
    case 'j_flash':
    case 'j_trousers':
    case 'j_ceremonial':
      params.mult = relic.state.mult;
      break;
    case 'j_constellation':
    case 'j_hologram':
    case 'j_vampire':
      if (relic.state.xMult > 0) {
        params.xMult = roundToHundredths(relic.state.xMult);
      }
      break;
    case 'j_ramen':
      if (relic.state.xMult > 0) {
        params.xMult = roundToHundredths(relic.state.xMult);
      }
      break;
    case 'j_abstract':
      if (state) {
        params.mult = state.relics.length * 3;
      } else if (relic.state.mult > 0) {
        params.mult = relic.state.mult;
      }
      break;
    case 'j_bull':
      if (state?.dollars !== undefined) {
        params.chips = Math.max(0, state.dollars) * 2;
      } else {
        params.chips = relic.state.chips;
      }
      break;
    case 'j_stencil':
      if (state) {
        let negativeCount = 0;
        let stencilCount = 0;
        for (const item of state.relics) {
          if (item.edition === 'negative') negativeCount += 1;
          if (item.id === 'j_stencil') stencilCount += 1;
        }
        const relicSlotLimit = (state.maxRelics ?? 5) + negativeCount;
        const emptySlots = Math.max(0, relicSlotLimit - state.relics.length);
        params.xMult = emptySlots <= 0 ? 1 : Math.max(1, emptySlots + stencilCount);
      } else if (relic.state.xMult > 1) {
        params.xMult = roundToHundredths(relic.state.xMult);
      }
      break;
    default:
      break;
  }

  return params;
}

/**
 * Размеченное объединение сущностей, доступных для просмотра в инспекторе.
 */
export type InspectTarget =
  | {
      readonly kind: 'relic';
      readonly relic: RelicInstance;
      readonly index: number;
      readonly total: number;
    }
  | {
      readonly kind: 'consumable';
      readonly consumable: ConsumableInstance;
      readonly index: number;
      readonly total: number;
      readonly canUse: boolean;
    }
  | {
      readonly kind: 'shop_offer';
      readonly offer: ShopOffer;
      readonly canAfford: boolean;
      readonly hasSlot: boolean;
      readonly slotFreeForImmediateUse: boolean;
    }
  | {
      readonly kind: 'shop_charter';
      readonly charterId: CharterId;
      readonly price: number;
      readonly canAfford: boolean;
    }
  | {
      readonly kind: 'shop_pack';
      readonly pack: PackOffer;
      readonly canAfford: boolean;
    }
  | {
      readonly kind: 'playing_card';
      readonly card: PlayingCard;
    }
  | {
      readonly kind: 'boss';
      readonly bossId: BossId;
      readonly disabled?: boolean;
    };

/**
 * Коллбэки действий пользователя внутри оверлея инспектора.
 */
export interface InspectorCallbacks {
  readonly onClose: () => void;
  readonly onMoveRelic?: (uid: string, delta: -1 | 1) => void;
  readonly onSellRelic?: (uid: string) => void;
  readonly onMoveConsumable?: (uid: string, delta: -1 | 1) => void;
  readonly onUseConsumable?: (uid: string) => void;
  readonly onSellConsumable?: (uid: string) => void;
  readonly onBuyOffer?: (offerUid: string, useImmediately?: boolean) => void;
  readonly onBuyCharter?: () => void;
  readonly onOpenPack?: (packUid: string) => void;
}

type ButtonVariant = 'default' | 'primary' | 'gold' | 'danger';
type BadgeVariant = 'default' | 'gold' | 'danger' | 'blue';

/**
 * Создаёт сенсорную кнопку инспектора с минимальной областью нажатия >= 44×44px.
 */
function createActionButton(options: {
  label: string;
  action: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
}): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'modal-btn';
  if (options.variant && options.variant !== 'default') {
    btn.classList.add(`modal-btn--${options.variant}`);
  }
  if (options.fullWidth) {
    btn.classList.add('modal-btn--full');
  }
  btn.dataset.action = options.action;
  btn.textContent = options.label;
  btn.disabled = Boolean(options.disabled);
  if (options.onClick) {
    btn.addEventListener('click', options.onClick);
  }
  return btn;
}

/**
 * Создаёт декоративный бейдж статуса или свойства.
 */
function createBadge(text: string, variant: BadgeVariant = 'default'): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.className = 'inspector-badge';
  if (variant !== 'default') {
    badge.classList.add(`inspector-badge--${variant}`);
  }
  badge.textContent = text;
  return badge;
}

/**
 * Возвращает локализованное название редкости Реликвии по её идентификатору.
 */
function getRelicRarityLabel(relicId: RelicId, translator: Translator): string | null {
  const rarity = getRelicDefinition(relicId)?.rarity;
  if (!rarity) {
    return null;
  }
  const key = String(rarity) as '1' | '2' | '3';
  return translator.catalog.rarities[key] ?? null;
}

/**
 * Добавляет в контейнер бейдж Издания, если оно отлично от базового.
 */
function appendEditionBadge(
  container: HTMLElement,
  edition: PlayingCard['edition'],
  translator: Translator,
): void {
  if (edition === 'base') {
    return;
  }
  const entry = translator.catalog.editions[edition];
  container.appendChild(createBadge(`${entry.name} (${entry.description})`, 'blue'));
}

/**
 * Заполняет описание, бейджи и превью для игральной карты.
 */
function populatePlayingCardDetails(
  preview: HTMLElement,
  titleEl: HTMLElement,
  descriptionEl: HTMLElement,
  badgesEl: HTMLElement,
  card: PlayingCard,
  translator: Translator,
): void {
  preview.appendChild(
    renderPlayingCardFrame({
      card,
      translator,
      interactive: false,
      faceDown: false,
    }),
  );

  if (card.enhancement === 'stone') {
    const stoneEntry = translator.catalog.enhancements.stone;
    titleEl.textContent = stoneEntry.name;
    descriptionEl.textContent = stoneEntry.description;
  } else {
    titleEl.textContent = `${translator.getRankLabel(card.rank)} — ${translator.getSuitLabel(card.suit)}`;
    if (card.enhancement !== 'none') {
      const enhEntry = translator.catalog.enhancements[card.enhancement];
      descriptionEl.textContent = enhEntry.description;
      badgesEl.appendChild(createBadge(enhEntry.name, 'gold'));
    } else {
      descriptionEl.hidden = true;
    }
  }

  appendEditionBadge(badgesEl, card.edition, translator);

  if (card.seal !== 'none') {
    const sealEntry = translator.catalog.seals[card.seal];
    badgesEl.appendChild(createBadge(`${sealEntry.name}: ${sealEntry.description}`, 'blue'));
  }

  const extraChips = card.bonusChips + card.permaBonus;
  if (extraChips > 0) {
    badgesEl.appendChild(createBadge(translator.t('trace.card_chips', { chips: extraChips }), 'gold'));
  }

  if (card.debuffed) {
    badgesEl.appendChild(createBadge(translator.t('ui.hud.debuffedBadge'), 'danger'));
  }
}

/**
 * Заполняет описание и бейджи для Реликвии (в инвентаре или в магазине).
 */
function populateRelicDetails(
  preview: HTMLElement,
  titleEl: HTMLElement,
  descriptionEl: HTMLElement,
  badgesEl: HTMLElement,
  relic: RelicInstance,
  state: RunState,
  translator: Translator,
  priceOptions?: { readonly price: number; readonly free: boolean },
): void {
  preview.appendChild(
    renderEntityCardFrame({
      kind: 'relic',
      relic,
      translator,
      interactive: false,
      price: priceOptions?.price,
      free: priceOptions?.free,
    }),
  );

  const text = translator.getRelicText(relic.id, getRelicLocParams(relic, state));
  titleEl.textContent = text.name;
  descriptionEl.textContent = text.description;

  const rarityLabel = getRelicRarityLabel(relic.id, translator);
  if (rarityLabel) {
    badgesEl.appendChild(createBadge(rarityLabel));
  }
  appendEditionBadge(badgesEl, relic.edition, translator);
  if (relic.debuffed) {
    badgesEl.appendChild(createBadge(translator.t('ui.hud.debuffedBadge'), 'danger'));
  }
}

/**
 * Заполняет описание и бейджи для Расходника (в слоте или в магазине).
 */
function populateConsumableDetails(
  preview: HTMLElement,
  titleEl: HTMLElement,
  descriptionEl: HTMLElement,
  badgesEl: HTMLElement,
  consumable: ConsumableInstance,
  translator: Translator,
  priceOptions?: { readonly price: number; readonly free: boolean },
): void {
  preview.appendChild(
    renderEntityCardFrame({
      kind: 'consumable',
      consumable,
      translator,
      interactive: false,
      price: priceOptions?.price,
      free: priceOptions?.free,
    }),
  );

  const text = translator.getConsumableText(consumable.id);
  titleEl.textContent = text.name;
  descriptionEl.textContent = text.description;

  const kindLabel = translator.catalog.consumableKinds[consumable.kind];
  badgesEl.appendChild(createBadge(kindLabel));
  appendEditionBadge(badgesEl, consumable.edition, translator);
}

/**
 * Создаёт строку кнопок перемещения влево/вправо и продажи для слота инвентаря.
 */
function buildMoveButtonsRow(
  uid: string,
  index: number,
  total: number,
  translator: Translator,
  onMove?: (uid: string, delta: -1 | 1) => void,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'inspector-actions-row';

  row.appendChild(
    createActionButton({
      label: translator.t('ui.actions.moveLeft'),
      action: 'move-left',
      disabled: index <= 0 || !onMove,
      onClick: () => onMove?.(uid, -1),
    }),
  );

  row.appendChild(
    createActionButton({
      label: translator.t('ui.actions.moveRight'),
      action: 'move-right',
      disabled: index >= total - 1 || !onMove,
      onClick: () => onMove?.(uid, 1),
    }),
  );

  return row;
}

/**
 * Добавляет статусный бейдж магазина (продано / мало золота / нет слотов / бесплатно).
 */
function appendShopStatusBadges(
  badgesEl: HTMLElement,
  options: {
    readonly sold: boolean;
    readonly price: number;
    readonly canAfford: boolean;
    readonly hasSlot: boolean;
  },
  translator: Translator,
): void {
  if (options.sold) {
    badgesEl.appendChild(createBadge(translator.t('ui.shop.sold'), 'danger'));
    return;
  }
  if (options.price === 0) {
    badgesEl.appendChild(createBadge(translator.t('ui.shop.free'), 'gold'));
  }
  if (!options.canAfford) {
    badgesEl.appendChild(createBadge(translator.t('ui.shop.notEnoughGold'), 'danger'));
  }
  if (!options.hasSlot) {
    badgesEl.appendChild(createBadge(translator.t('ui.shop.noSlots'), 'danger'));
  }
}

/**
 * Отрисовывает мобильный оверлей инспектора для Реликвий, Расходников, товаров магазина, карт и Боссов.
 */
export function renderInspectorOverlay(
  target: InspectTarget,
  state: RunState,
  translator: Translator,
  callbacks: InspectorCallbacks,
): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop inspector-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.dataset.inspectorKind = target.kind;

  // Закрытие только при тапе непосредственно по затемнённому фону, без всплытия с карточки
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      callbacks.onClose();
    }
  });

  const sheet = document.createElement('div');
  sheet.className = 'modal-sheet inspector-card';
  backdrop.appendChild(sheet);

  const header = document.createElement('div');
  header.className = 'modal-header';
  const titleWrap = document.createElement('div');
  const titleEl = document.createElement('h2');
  titleEl.className = 'modal-title';
  titleWrap.appendChild(titleEl);
  header.appendChild(titleWrap);
  sheet.appendChild(header);

  const body = document.createElement('div');
  body.className = 'modal-body';
  sheet.appendChild(body);

  const hero = document.createElement('div');
  hero.className = 'inspector-hero';
  body.appendChild(hero);

  const preview = document.createElement('div');
  preview.className = 'inspector-preview';
  hero.appendChild(preview);

  const info = document.createElement('div');
  info.className = 'inspector-info';
  hero.appendChild(info);

  const descriptionEl = document.createElement('p');
  descriptionEl.className = 'inspector-description';
  info.appendChild(descriptionEl);

  const badgesEl = document.createElement('div');
  badgesEl.className = 'inspector-badges';
  info.appendChild(badgesEl);

  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'inspector-actions';

  switch (target.kind) {
    case 'relic': {
      populateRelicDetails(
        preview,
        titleEl,
        descriptionEl,
        badgesEl,
        target.relic,
        state,
        translator,
      );

      const isEternal = target.relic.state.extra?.eternal === true;
      if (isEternal) {
        sheet.dataset.eternal = 'true';
      }

      actionsContainer.appendChild(
        buildMoveButtonsRow(
          target.relic.uid,
          target.index,
          target.total,
          translator,
          callbacks.onMoveRelic,
        ),
      );

      actionsContainer.appendChild(
        createActionButton({
          label: translator.t('ui.actions.sell', { dollars: target.relic.sellValue }),
          action: 'sell',
          variant: 'danger',
          disabled: isEternal || !callbacks.onSellRelic,
          fullWidth: true,
          onClick: () => callbacks.onSellRelic?.(target.relic.uid),
        }),
      );
      break;
    }

    case 'consumable': {
      populateConsumableDetails(
        preview,
        titleEl,
        descriptionEl,
        badgesEl,
        target.consumable,
        translator,
      );

      actionsContainer.appendChild(
        buildMoveButtonsRow(
          target.consumable.uid,
          target.index,
          target.total,
          translator,
          callbacks.onMoveConsumable,
        ),
      );

      const actionRow = document.createElement('div');
      actionRow.className = 'inspector-actions-row';
      actionRow.appendChild(
        createActionButton({
          label: translator.t('ui.actions.use'),
          action: 'use',
          variant: 'primary',
          disabled: !target.canUse || !callbacks.onUseConsumable,
          onClick: () => callbacks.onUseConsumable?.(target.consumable.uid),
        }),
      );
      actionRow.appendChild(
        createActionButton({
          label: translator.t('ui.actions.sell', { dollars: target.consumable.sellValue }),
          action: 'sell',
          variant: 'danger',
          disabled: !callbacks.onSellConsumable,
          onClick: () => callbacks.onSellConsumable?.(target.consumable.uid),
        }),
      );
      actionsContainer.appendChild(actionRow);
      break;
    }

    case 'shop_offer': {
      const { offer } = target;
      const priceOptions = { price: offer.cost, free: offer.cost === 0 };

      if (offer.kind === 'relic') {
        populateRelicDetails(
          preview,
          titleEl,
          descriptionEl,
          badgesEl,
          offer.relic,
          state,
          translator,
          priceOptions,
        );
      } else if (offer.kind === 'consumable') {
        populateConsumableDetails(
          preview,
          titleEl,
          descriptionEl,
          badgesEl,
          offer.consumable,
          translator,
          priceOptions,
        );
      } else {
        populatePlayingCardDetails(
          preview,
          titleEl,
          descriptionEl,
          badgesEl,
          offer.card,
          translator,
        );
        badgesEl.appendChild(
          createBadge(translator.t('ui.hud.goldAmount', { dollars: offer.cost }), 'gold'),
        );
      }

      appendShopStatusBadges(
        badgesEl,
        {
          sold: offer.sold,
          price: offer.cost,
          canAfford: target.canAfford,
          hasSlot: target.hasSlot,
        },
        translator,
      );

      const buyRow = document.createElement('div');
      buyRow.className = 'inspector-actions-row';
      buyRow.appendChild(
        createActionButton({
          label: translator.t('ui.actions.buy', { dollars: offer.cost }),
          action: 'buy',
          variant: 'gold',
          disabled: offer.sold || !target.canAfford || !target.hasSlot || !callbacks.onBuyOffer,
          onClick: () => callbacks.onBuyOffer?.(offer.uid, false),
        }),
      );

      if (offer.kind === 'consumable') {
        buyRow.appendChild(
          createActionButton({
            label: translator.t('ui.actions.buyAndUse'),
            action: 'buy-and-use',
            variant: 'primary',
            disabled:
              offer.sold ||
              !target.canAfford ||
              !target.slotFreeForImmediateUse ||
              !callbacks.onBuyOffer,
            onClick: () => callbacks.onBuyOffer?.(offer.uid, true),
          }),
        );
      }
      actionsContainer.appendChild(buyRow);
      break;
    }

    case 'shop_charter': {
      preview.appendChild(
        renderEntityCardFrame({
          kind: 'charter',
          charterId: target.charterId,
          price: target.price,
          free: target.price === 0,
          interactive: false,
          translator,
        }),
      );

      const subtitle = document.createElement('p');
      subtitle.className = 'modal-subtitle';
      subtitle.textContent = translator.t('ui.shop.charterTitle');
      titleWrap.appendChild(subtitle);

      const charterText = translator.getCharterText(target.charterId);
      titleEl.textContent = charterText.name;
      descriptionEl.textContent = charterText.description;

      appendShopStatusBadges(
        badgesEl,
        {
          sold: false,
          price: target.price,
          canAfford: target.canAfford,
          hasSlot: true,
        },
        translator,
      );

      actionsContainer.appendChild(
        createActionButton({
          label: translator.t('ui.actions.buy', { dollars: target.price }),
          action: 'buy-charter',
          variant: 'gold',
          disabled: !target.canAfford || !callbacks.onBuyCharter,
          fullWidth: true,
          onClick: () => callbacks.onBuyCharter?.(),
        }),
      );
      break;
    }

    case 'shop_pack': {
      const { pack } = target;
      preview.appendChild(
        renderEntityCardFrame({
          kind: 'pack',
          packType: pack.type,
          packSize: pack.size,
          price: pack.cost,
          free: pack.cost === 0,
          interactive: false,
          translator,
        }),
      );

      titleEl.textContent = translator.getPackTitle(pack.type, pack.size);
      const subtitle = document.createElement('p');
      subtitle.className = 'modal-subtitle';
      subtitle.textContent = translator.getPackSubtitle(pack.chooseCount, pack.totalCards);
      titleWrap.appendChild(subtitle);

      descriptionEl.textContent = translator.catalog.packTypes[pack.type].description;

      appendShopStatusBadges(
        badgesEl,
        {
          sold: pack.purchased,
          price: pack.cost,
          canAfford: target.canAfford,
          hasSlot: true,
        },
        translator,
      );

      actionsContainer.appendChild(
        createActionButton({
          label: translator.t('ui.actions.openPack', { dollars: pack.cost }),
          action: 'open-pack',
          variant: 'primary',
          disabled: pack.purchased || !target.canAfford || !callbacks.onOpenPack,
          fullWidth: true,
          onClick: () => callbacks.onOpenPack?.(pack.uid),
        }),
      );
      break;
    }

    case 'playing_card': {
      populatePlayingCardDetails(
        preview,
        titleEl,
        descriptionEl,
        badgesEl,
        target.card,
        translator,
      );
      break;
    }

    case 'boss': {
      preview.appendChild(
        renderEntityCardFrame({
          kind: 'boss',
          bossId: target.bossId,
          disabled: target.disabled,
          interactive: false,
          translator,
        }),
      );

      const bossText = translator.getBossText(target.bossId);
      titleEl.textContent = bossText.name;
      descriptionEl.textContent = bossText.description;

      if (target.disabled) {
        badgesEl.appendChild(createBadge(translator.t('ui.hud.abilityDisabled'), 'danger'));
      }
      break;
    }
  }

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  sheet.appendChild(footer);

  if (actionsContainer.childElementCount > 0) {
    actionsContainer.style.width = '100%';
    footer.appendChild(actionsContainer);
  }

  footer.appendChild(
    createActionButton({
      label: translator.t('ui.actions.close'),
      action: 'close',
      fullWidth: true,
      onClick: callbacks.onClose,
    }),
  );

  return backdrop;
}
