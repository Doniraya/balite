import { describe, expect, it, vi } from 'vitest';
import { createPlayingCard } from '../../src/engine/cards';
import { createConsumableInstance } from '../../src/engine/consumables';
import { createRelicInstance } from '../../src/engine/relics';
import {
  BOSS_IDS,
  CELESTIAL_IDS,
  CHARTER_IDS,
  DECK_IDS,
  EDITIONS,
  ENHANCEMENTS,
  PACK_SIZES,
  PACK_TYPES,
  RANKS,
  RELIC_IDS,
  RUNE_IDS,
  SCROLL_IDS,
  SEALS,
  SUITS,
  type ConsumableInstance,
  type Edition,
} from '../../src/engine/types';
import { createTranslator } from '../../src/i18n';
import {
  attachCardTilt,
  renderEntityCardFrame,
  renderPlayingCardFrame,
} from '../../src/ui/cardFrame';

/**
 * Проверяет порядок и наличие четырёх обязательных слоёв каркаса CardFrame снизу вверх.
 */
function assertFourLayersOrder(cardEl: HTMLElement): {
  enhancement: HTMLElement;
  art: HTMLElement;
  chrome: HTMLElement;
  fx: HTMLElement;
} {
  const children = Array.from(cardEl.children) as HTMLElement[];
  expect(children).toHaveLength(4);
  expect(children[0]?.classList.contains('card-frame__layer-enhancement')).toBe(true);
  expect(children[1]?.classList.contains('card-frame__layer-art')).toBe(true);
  expect(children[2]?.classList.contains('card-frame__layer-chrome')).toBe(true);
  expect(children[3]?.classList.contains('card-frame__layer-fx')).toBe(true);

  return {
    enhancement: children[0]!,
    art: children[1]!,
    chrome: children[2]!,
    fx: children[3]!,
  };
}

/**
 * Создаёт тестовый экземпляр расходника.
 */
function makeConsumable(
  id: ConsumableInstance['id'],
  kind: ConsumableInstance['kind'],
  edition: Edition = 'base',
): ConsumableInstance {
  return {
    uid: `cons_${id}`,
    id,
    kind,
    edition,
    baseCost: 3,
    sellValue: 1,
  };
}

describe('Слоёный каркас карт CardFrame (TDD)', () => {
  const ru = createTranslator('ru');
  const en = createTranslator('en');

  describe('renderPlayingCardFrame', () => {
    it('рендерит 4 слоя снизу вверх, data-card-id и корректный SVG для номерных карт 2..10', () => {
      for (const rank of RANKS) {
        if (rank > 10) continue;
        const card = createPlayingCard({
          id: `card_${rank}_hearts`,
          suit: 'hearts',
          rank,
        });
        const el = renderPlayingCardFrame({ card, translator: ru });

        expect(el.tagName).toBe('DIV');
        expect(el.classList.contains('card-frame')).toBe(true);
        expect(el.classList.contains('card-frame--playing')).toBe(true);
        expect(el.dataset.cardId).toBe(card.id);

        const layers = assertFourLayersOrder(el);
        expect(layers.enhancement.classList.contains('card-frame__enhancement--base')).toBe(true);

        const svg = layers.art.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg?.getAttribute('viewBox')).toBe('0 0 120 168');

        // Для номерной карты количество векторных символов масти (пипов) совпадает с рангом
        const pips = svg?.querySelectorAll('[data-pip="true"]') ?? [];
        expect(pips).toHaveLength(rank);

        const cornerRank = layers.chrome.querySelector('.card-frame__rank')?.textContent;
        const cornerSuit = layers.chrome.querySelector('.card-frame__suit')?.textContent;
        expect(cornerRank).toBe(ru.getRankLabel(rank, true));
        expect(cornerSuit).toBe(ru.catalog.suits.hearts.symbol);
      }
    });

    it('рендерит тематический векторный SVG с fallback-признаком для придворных 11..14 на ru и en', () => {
      const courtRanks = [11, 12, 13, 14] as const;

      for (const rank of courtRanks) {
        const card = createPlayingCard({
          id: `court_${rank}`,
          suit: 'spades',
          rank,
        });

        const elRu = renderPlayingCardFrame({ card, translator: ru });
        const layersRu = assertFourLayersOrder(elRu);
        const svgRu = layersRu.art.querySelector('svg');
        expect(svgRu).not.toBeNull();
        expect(svgRu?.getAttribute('viewBox')).toBe('0 0 120 168');
        expect(svgRu?.getAttribute('data-art-fallback')).toBe('true');
        expect(layersRu.chrome.querySelector('.card-frame__rank')?.textContent).toBe(
          ru.getRankLabel(rank, true),
        );

        const elEn = renderPlayingCardFrame({ card, translator: en });
        expect(elEn.querySelector('.card-frame__rank')?.textContent).toBe(
          en.getRankLabel(rank, true),
        );
      }
    });

    it('поддерживает все 8 Улучшений, скрывает ранг/масть у Каменной карты (stone) и рисует рубашку при faceDown', () => {
      for (const enhancement of ENHANCEMENTS) {
        const card = createPlayingCard({
          id: `enh_${enhancement}`,
          suit: 'diamonds',
          rank: 13,
          enhancement,
        });

        const el = renderPlayingCardFrame({ card, translator: ru });
        const layers = assertFourLayersOrder(el);

        if (enhancement === 'none') {
          expect(layers.enhancement.classList.contains('card-frame__enhancement--base')).toBe(true);
          expect(layers.chrome.querySelector('.card-frame__enhancement-badge')).toBeNull();
        } else {
          expect(
            layers.enhancement.classList.contains(`card-frame__enhancement--${enhancement}`),
          ).toBe(true);
          const badge = layers.chrome.querySelector('.card-frame__enhancement-badge');
          expect(badge?.textContent).toBe(ru.catalog.enhancements[enhancement].name);
        }

        if (enhancement === 'stone') {
          // У Каменной карты отсутствуют стандартные угловые индексы ранга и масти
          expect(layers.chrome.querySelectorAll('.card-frame__corner')).toHaveLength(0);
          expect(layers.chrome.querySelector('.card-frame__rank')).toBeNull();
          expect(layers.chrome.querySelector('.card-frame__suit')).toBeNull();
          expect(el.dataset.rank).toBeUndefined();
          expect(el.dataset.suit).toBeUndefined();
          expect(layers.art.querySelector('svg')?.getAttribute('data-art-kind')).toBe('stone');
        } else {
          expect(layers.chrome.querySelectorAll('.card-frame__corner').length).toBeGreaterThanOrEqual(
            1,
          );
        }
      }

      // Явный faceDown: true скрывает лицевую информацию и рисует SVG-рубашку
      const hiddenCard = createPlayingCard({
        id: 'hidden_ace',
        suit: 'clubs',
        rank: 14,
        enhancement: 'gold',
        seal: 'red',
        edition: 'polychrome',
      });
      const backEl = renderPlayingCardFrame({
        card: hiddenCard,
        translator: ru,
        faceDown: true,
      });
      expect(backEl.classList.contains('is-face-down')).toBe(true);
      const backLayers = assertFourLayersOrder(backEl);
      const backSvg = backLayers.art.querySelector('svg');
      expect(backSvg?.getAttribute('viewBox')).toBe('0 0 120 168');
      expect(backSvg?.getAttribute('data-art-kind')).toBe('back');
      expect(backLayers.chrome.querySelector('.card-frame__rank')).toBeNull();
      expect(backLayers.chrome.querySelector('.card-frame__enhancement-badge')).toBeNull();
      expect(backLayers.fx.querySelector('.card-frame__seal')).toBeNull();

      // Карта с facing: 'back' по умолчанию также рисуется рубашкой вверх
      const backByFacing = renderPlayingCardFrame({
        card: createPlayingCard({ id: 'back_facing', suit: 'hearts', rank: 7, facing: 'back' }),
        translator: ru,
      });
      expect(backByFacing.classList.contains('is-face-down')).toBe(true);

      // Явный faceDown: false показывает лицевую сторону даже при facing: 'back'
      const revealedCard = renderPlayingCardFrame({
        card: createPlayingCard({
          id: 'revealed_facing',
          suit: 'spades',
          rank: 10,
          facing: 'back',
          forcedSelection: true,
        }),
        translator: ru,
        faceDown: false,
      });
      expect(revealedCard.classList.contains('is-face-down')).toBe(false);
      expect(revealedCard.classList.contains('is-forced')).toBe(true);
      expect(revealedCard.querySelector('.card-frame__rank')?.textContent).toBe('10');
    });

    it('отображает все Издания, Печати, оверлей Подавления и интерактивные состояния (selected, disabled, compact, triggering)', () => {
      for (const edition of EDITIONS) {
        const card = createPlayingCard({
          id: `ed_${edition}`,
          suit: 'spades',
          rank: 9,
          edition,
        });
        const el = renderPlayingCardFrame({ card, translator: en });
        const { fx } = assertFourLayersOrder(el);

        if (edition === 'base') {
          expect(fx.querySelector('.card-frame__edition-sheen')).toBeNull();
        } else {
          const sheen = fx.querySelector('.card-frame__edition-sheen');
          expect(sheen).not.toBeNull();
          expect(sheen?.classList.contains(`card-frame__fx--${edition}`)).toBe(true);
          if (edition === 'holo') {
            expect(sheen?.classList.contains('card-frame__fx--holographic')).toBe(true);
          }
        }
      }

      for (const seal of SEALS) {
        const card = createPlayingCard({
          id: `seal_${seal}`,
          suit: 'clubs',
          rank: 5,
          seal,
        });
        const el = renderPlayingCardFrame({ card, translator: ru });
        const { fx } = assertFourLayersOrder(el);
        const sealEl = fx.querySelector('.card-frame__seal');
        if (seal === 'none') {
          expect(sealEl).toBeNull();
        } else {
          expect(sealEl).not.toBeNull();
          expect(sealEl?.getAttribute('data-seal')).toBe(seal);
          expect(sealEl?.getAttribute('aria-label')).toBe(ru.catalog.seals[seal].name);
        }
      }

      // Подавленная интерактивная выбранная компактная триггерящаяся карта
      const interactiveCard = createPlayingCard({
        id: 'card_full_state',
        suit: 'hearts',
        rank: 12,
        debuffed: true,
        edition: 'holo',
        seal: 'gold',
      });
      const el = renderPlayingCardFrame({
        card: interactiveCard,
        translator: ru,
        selected: true,
        disabled: true,
        compact: true,
        triggering: true,
        interactive: true,
      });

      expect(el.tagName).toBe('BUTTON');
      expect((el as HTMLButtonElement).type).toBe('button');
      expect((el as HTMLButtonElement).disabled).toBe(true);
      expect(el.dataset.cardId).toBe('card_full_state');
      expect(el.getAttribute('aria-pressed')).toBe('true');
      expect(el.getAttribute('aria-disabled')).toBe('true');
      expect(el.classList.contains('is-selected')).toBe(true);
      expect(el.classList.contains('is-disabled')).toBe(true);
      expect(el.classList.contains('is-compact')).toBe(true);
      expect(el.classList.contains('is-triggering')).toBe(true);
      expect(el.classList.contains('is-interactive')).toBe(true);
      expect(el.classList.contains('is-debuffed')).toBe(true);

      const { fx } = assertFourLayersOrder(el);
      const debuffBadge = fx.querySelector('.card-frame__debuff-badge');
      expect(debuffBadge?.textContent).toBe(ru.t('ui.hud.debuffedBadge'));

      // На английском текст Подавления тоже локализован
      const elEn = renderPlayingCardFrame({
        card: interactiveCard,
        translator: en,
        selected: false,
        interactive: true,
      });
      expect(elEn.getAttribute('aria-pressed')).toBe('false');
      expect(elEn.querySelector('.card-frame__debuff-badge')?.textContent).toBe(
        en.t('ui.hud.debuffedBadge'),
      );
    });
  });

  describe('renderEntityCardFrame', () => {
    it('рендерит Реликвии всех редкостей (R1/R2/R3), издания, debuffed и цену', () => {
      const r1 = createRelicInstance('j_joker', 'rel_1', 'foil');
      const r2 = createRelicInstance('j_flash', 'rel_2', 'holo');
      const r3 = { ...createRelicInstance('j_blueprint', 'rel_3', 'negative'), debuffed: true };

      const el1 = renderEntityCardFrame({
        kind: 'relic',
        relic: r1,
        translator: ru,
        price: 4,
      });
      assertFourLayersOrder(el1);
      expect(el1.dataset.rarity).toBe('1');
      expect(el1.classList.contains('card-frame--rarity-1')).toBe(true);
      expect(el1.querySelector('.card-frame__title')?.textContent).toBe(
        ru.getRelicText('j_joker').name,
      );
      expect(el1.querySelector('.card-frame__rarity-badge')?.textContent).toBe(
        ru.catalog.rarities['1'],
      );
      expect(el1.querySelector('.card-frame__price-badge')?.textContent).toBe(
        ru.t('ui.hud.goldAmount', { dollars: 4 }),
      );
      expect(el1.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 120 168');
      expect(el1.querySelector('.card-frame__fx--foil')).not.toBeNull();

      const el2 = renderEntityCardFrame({
        kind: 'relic',
        relic: r2,
        translator: en,
        free: true,
        selected: true,
        interactive: true,
      });
      expect(el2.tagName).toBe('BUTTON');
      expect(el2.dataset.rarity).toBe('2');
      expect(el2.classList.contains('is-selected')).toBe(true);
      expect(el2.getAttribute('aria-pressed')).toBe('true');
      expect(el2.querySelector('.card-frame__fx--holographic')).not.toBeNull();
      expect(el2.querySelector('.card-frame__price-badge')?.textContent).toBe(en.t('ui.shop.free'));

      const el3 = renderEntityCardFrame({
        kind: 'relic',
        relic: r3,
        translator: ru,
      });
      expect(el3.dataset.rarity).toBe('3');
      expect(el3.classList.contains('is-debuffed')).toBe(true);
      expect(el3.querySelector('.card-frame__fx--negative')).not.toBeNull();
      expect(el3.querySelector('.card-frame__debuff-badge')?.textContent).toBe(
        ru.t('ui.hud.debuffedBadge'),
      );
    });

    it('рендерит Расходники (сферы, свитки, руны), Грамоты, Колоды, Боссов и Бустеры', () => {
      const celestialEl = renderEntityCardFrame({
        kind: 'consumable',
        consumable: makeConsumable('c_mercury', 'celestial', 'polychrome'),
        translator: ru,
        price: 3,
      });
      assertFourLayersOrder(celestialEl);
      expect(celestialEl.dataset.consumableKind).toBe('celestial');
      expect(celestialEl.querySelector('.card-frame__title')?.textContent).toBe(
        ru.getConsumableText('c_mercury').name,
      );
      expect(celestialEl.querySelector('.card-frame__fx--polychrome')).not.toBeNull();
      expect(celestialEl.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 120 168');

      const scrollEl = renderEntityCardFrame({
        kind: 'consumable',
        consumable: makeConsumable('c_fool', 'scroll'),
        translator: en,
      });
      expect(scrollEl.dataset.consumableKind).toBe('scroll');
      expect(scrollEl.querySelector('.card-frame__title')?.textContent).toBe(
        en.getConsumableText('c_fool').name,
      );

      const runeEl = renderEntityCardFrame({
        kind: 'consumable',
        consumable: makeConsumable('c_black_hole', 'rune'),
        translator: ru,
      });
      expect(runeEl.dataset.consumableKind).toBe('rune');
      expect(runeEl.querySelector('.card-frame__title')?.textContent).toBe(
        ru.getConsumableText('c_black_hole').name,
      );

      const charterEl = renderEntityCardFrame({
        kind: 'charter',
        charterId: 'v_observatory',
        translator: ru,
        price: 10,
      });
      assertFourLayersOrder(charterEl);
      expect(charterEl.querySelector('.card-frame__title')?.textContent).toBe(
        ru.getCharterText('v_observatory').name,
      );
      expect(charterEl.querySelector('.card-frame__price-badge')?.textContent).toBe(
        ru.t('ui.hud.goldAmount', { dollars: 10 }),
      );

      const lockedDeckEl = renderEntityCardFrame({
        kind: 'deck',
        deckId: 'b_black',
        locked: true,
        translator: ru,
        interactive: true,
      });
      assertFourLayersOrder(lockedDeckEl);
      expect(lockedDeckEl.classList.contains('is-locked')).toBe(true);
      expect(lockedDeckEl.classList.contains('is-disabled')).toBe(true);
      expect(lockedDeckEl.getAttribute('aria-disabled')).toBe('true');
      expect(lockedDeckEl.querySelector('.card-frame__title')?.textContent).toBe(
        ru.getDeckText('b_black').name,
      );
      expect(lockedDeckEl.textContent).toContain(ru.t('ui.deckSelect.locked'));

      const bossDisabledEl = renderEntityCardFrame({
        kind: 'boss',
        bossId: 'bl_final_vessel',
        disabled: true,
        translator: en,
      });
      assertFourLayersOrder(bossDisabledEl);
      expect(bossDisabledEl.classList.contains('is-disabled')).toBe(true);
      expect(bossDisabledEl.querySelector('.card-frame__title')?.textContent).toBe(
        en.getBossText('bl_final_vessel').name,
      );
      expect(bossDisabledEl.querySelector('.card-frame__debuff-badge')?.textContent).toBe(
        en.t('ui.hud.abilityDisabled'),
      );

      const packEl = renderEntityCardFrame({
        kind: 'pack',
        packType: 'spectral',
        packSize: 'mega',
        translator: ru,
        price: 8,
      });
      assertFourLayersOrder(packEl);
      expect(packEl.querySelector('.card-frame__title')?.textContent).toBe(
        ru.getPackTitle('spectral', 'mega'),
      );
      expect(packEl.querySelector('.card-frame__price-badge')?.textContent).toBe(
        ru.t('ui.hud.goldAmount', { dollars: 8 }),
      );
      expect(packEl.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 120 168');

      // Цена 0 трактуется как бесплатная позиция (и на ru, и на en)
      const zeroPricePack = renderEntityCardFrame({
        kind: 'pack',
        packType: 'arcana',
        packSize: 'normal',
        translator: ru,
        price: 0,
      });
      expect(zeroPricePack.querySelector('.card-frame__price-badge')?.textContent).toBe(
        ru.t('ui.shop.free'),
      );
    });

    it('не содержит запрещённых слов 6+/12+ в видимых/озвучиваемых текстах и внешних ссылок ни в одной из сущностей', () => {
      const forbiddenTextPattern =
        /\bskull|\btarot|\bcasino|\bpoker|\bdevil|\bvampire|\bjoker|\bouija|\bbet(?:s|ting)?\b|\bstake|\bgambl|череп|таро(?![а-яё])|казино|покер|дьявол|вампир|джокер|рулетк|азарт/iu;

      const elements: HTMLElement[] = [];

      for (const translator of [ru, en]) {
        for (const suit of SUITS) {
          for (const rank of RANKS) {
            elements.push(
              renderPlayingCardFrame({
                card: createPlayingCard({ id: `${suit}_${rank}`, suit, rank }),
                translator,
              }),
            );
          }
        }
        for (const relicId of RELIC_IDS) {
          elements.push(
            renderEntityCardFrame({
              kind: 'relic',
              relic: createRelicInstance(relicId, `u_${relicId}`),
              translator,
            }),
          );
        }
        for (const celestialId of CELESTIAL_IDS) {
          elements.push(
            renderEntityCardFrame({
              kind: 'consumable',
              consumable: makeConsumable(celestialId, 'celestial'),
              translator,
            }),
          );
        }
        for (const scrollId of SCROLL_IDS) {
          elements.push(
            renderEntityCardFrame({
              kind: 'consumable',
              consumable: makeConsumable(scrollId, 'scroll'),
              translator,
            }),
          );
        }
        for (const runeId of RUNE_IDS) {
          elements.push(
            renderEntityCardFrame({
              kind: 'consumable',
              consumable: makeConsumable(runeId, 'rune'),
              translator,
            }),
          );
        }
        for (const charterId of CHARTER_IDS) {
          elements.push(renderEntityCardFrame({ kind: 'charter', charterId, translator }));
        }
        for (const deckId of DECK_IDS) {
          elements.push(renderEntityCardFrame({ kind: 'deck', deckId, translator }));
        }
        for (const bossId of BOSS_IDS) {
          elements.push(renderEntityCardFrame({ kind: 'boss', bossId, translator }));
        }
        for (const packType of PACK_TYPES) {
          for (const packSize of PACK_SIZES) {
            elements.push(
              renderEntityCardFrame({ kind: 'pack', packType, packSize, translator }),
            );
          }
        }
      }

      for (const el of elements) {
        const visibleText = el.textContent ?? '';
        const ariaLabel = el.getAttribute('aria-label') ?? '';
        const htmlWithoutSvgNs = el.outerHTML.replaceAll('http://www.w3.org/2000/svg', '');

        expect(visibleText).not.toMatch(forbiddenTextPattern);
        expect(ariaLabel).not.toMatch(forbiddenTextPattern);
        expect(htmlWithoutSvgNs).not.toMatch(/<a\b|href=|xlink:href=|https?:\/\//i);
      }
    });
  });

  describe('attachCardTilt и CSS-контракт', () => {
    it('обновляет --tilt-x и --tilt-y на pointermove, сбрасывает на pointerleave и не блокирует touch', () => {
      const cardEl = renderPlayingCardFrame({
        card: createPlayingCard({ id: 'tilt_card', suit: 'diamonds', rank: 10 }),
        translator: ru,
        interactive: true,
      });

      vi.spyOn(cardEl, 'getBoundingClientRect').mockReturnValue({
        x: 100,
        y: 200,
        left: 100,
        top: 200,
        right: 220,
        bottom: 368,
        width: 120,
        height: 168,
        toJSON: () => ({}),
      });

      const detach = attachCardTilt(cardEl);

      // Имитация pointermove в правый верхний квадрант
      const moveEvent = new Event('pointermove', { bubbles: true, cancelable: true });
      Object.assign(moveEvent, { clientX: 190, clientY: 242, pointerType: 'touch' });
      const preventSpy = vi.spyOn(moveEvent, 'preventDefault');
      cardEl.dispatchEvent(moveEvent);

      expect(preventSpy).not.toHaveBeenCalled();
      const tiltX = Number(cardEl.style.getPropertyValue('--tilt-x'));
      const tiltY = Number(cardEl.style.getPropertyValue('--tilt-y'));
      expect(tiltX).toBeCloseTo(0.5, 2);
      expect(tiltY).toBeCloseTo(-0.5, 2);

      // Имитация pointerleave сбрасывает наклон в 0
      cardEl.dispatchEvent(new Event('pointerleave'));
      expect(cardEl.style.getPropertyValue('--tilt-x')).toBe('0');
      expect(cardEl.style.getPropertyValue('--tilt-y')).toBe('0');

      // После вызова detach слушатели отвязаны
      detach();
      cardEl.dispatchEvent(
        Object.assign(new Event('pointermove'), { clientX: 210, clientY: 210 }),
      );
      expect(cardEl.style.getPropertyValue('--tilt-x')).toBe('0');
      expect(cardEl.style.getPropertyValue('--tilt-y')).toBe('0');
    });

    it('безопасно обрабатывает нулевой getBoundingClientRect без NaN', () => {
      const cardEl = document.createElement('div');
      const detach = attachCardTilt(cardEl);

      const moveEvent = new Event('pointermove');
      Object.assign(moveEvent, { clientX: 90, clientY: 42 });
      cardEl.dispatchEvent(moveEvent);

      const tiltX = Number(cardEl.style.getPropertyValue('--tilt-x'));
      const tiltY = Number(cardEl.style.getPropertyValue('--tilt-y'));
      expect(Number.isFinite(tiltX)).toBe(true);
      expect(Number.isFinite(tiltY)).toBe(true);

      detach();
    });

    it('ограничивает --tilt-x и --tilt-y в диапазоне [-1, 1] и сбрасывает их при pointercancel', () => {
      const cardEl = renderEntityCardFrame({
        kind: 'relic',
        relic: createRelicInstance('j_abstract', 'rel_tilt', 'polychrome'),
        translator: ru,
        compact: true,
        selected: true,
        interactive: true,
      });

      expect(cardEl.classList.contains('is-compact')).toBe(true);
      expect(cardEl.classList.contains('is-selected')).toBe(true);
      expect(cardEl.classList.contains('is-interactive')).toBe(true);

      vi.spyOn(cardEl, 'getBoundingClientRect').mockReturnValue({
        x: 50,
        y: 50,
        left: 50,
        top: 50,
        right: 170,
        bottom: 218,
        width: 120,
        height: 168,
        toJSON: () => ({}),
      });

      const detach = attachCardTilt(cardEl);
      cardEl.dispatchEvent(
        Object.assign(new Event('pointermove'), { clientX: -500, clientY: 5000 }),
      );
      expect(cardEl.style.getPropertyValue('--tilt-x')).toBe('-1');
      expect(cardEl.style.getPropertyValue('--tilt-y')).toBe('1');

      cardEl.dispatchEvent(new Event('pointercancel'));
      expect(cardEl.style.getPropertyValue('--tilt-x')).toBe('0');
      expect(cardEl.style.getPropertyValue('--tilt-y')).toBe('0');

      detach();
    });

    it('приоритезирует free: true над price и корректно проставляет атрибуты на всех 40 реликвиях и 10 боссах', () => {
      const freeOverPrice = renderEntityCardFrame({
        kind: 'charter',
        charterId: 'v_clearance_sale',
        translator: en,
        price: 10,
        free: true,
      });
      expect(freeOverPrice.querySelector('.card-frame__price-badge')?.textContent).toBe(
        en.t('ui.shop.free'),
      );
      expect(freeOverPrice.querySelector('.card-frame__price-badge')?.classList.contains('is-free')).toBe(
        true,
      );

      for (const relicId of RELIC_IDS) {
        const el = renderEntityCardFrame({
          kind: 'relic',
          relic: createRelicInstance(relicId, `id_${relicId}`),
          translator: ru,
        });
        expect(el.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 120 168');
        expect(el.querySelector('.card-frame__title')?.textContent).toBe(
          ru.getRelicText(relicId).name,
        );
      }

      for (const bossId of BOSS_IDS) {
        const el = renderEntityCardFrame({
          kind: 'boss',
          bossId,
          translator: ru,
        });
        expect(el.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 120 168');
        expect(el.querySelector('.card-frame__title')?.textContent).toBe(
          ru.getBossText(bossId).name,
        );
      }
    });
  });

  describe('Story 2.2: перелив изданий (.card-edition-*), .card-glare и защита рубашки', () => {
    it('добавляет классы .card-edition-* и слой .card-glare для лицевых карт, но полностью скрывает их при facing === back / faceDown', () => {
      const expectedEditionClass: Record<Exclude<Edition, 'base'>, string> = {
        foil: 'card-edition-foil',
        holo: 'card-edition-holographic',
        polychrome: 'card-edition-polychrome',
        negative: 'card-edition-negative',
      };

      for (const edition of EDITIONS) {
        const openEl = renderPlayingCardFrame({
          card: createPlayingCard({
            id: `s22_open_${edition}`,
            suit: 'hearts',
            rank: 11,
            edition,
          }),
          translator: ru,
        });

        const glare = openEl.querySelector('.card-frame__layer-fx .card-glare');
        expect(glare, `Открытая карта (${edition}) должна иметь слой .card-glare`).not.toBeNull();

        if (edition === 'base') {
          expect(openEl.className).not.toMatch(/card-edition-/);
          expect(openEl.querySelector('.card-frame__edition-sheen')).toBeNull();
        } else {
          const editionClass = expectedEditionClass[edition];
          expect(
            openEl.classList.contains(editionClass),
            `Ожидался класс ${editionClass} для ${edition}`,
          ).toBe(true);
          expect(openEl.querySelector('.card-frame__edition-sheen')).not.toBeNull();
        }

        // Закрытая рубашкой вверх карта НИКОГДА не должна выдавать эффекты лицевого издания
        const backEl = renderPlayingCardFrame({
          card: createPlayingCard({
            id: `s22_back_${edition}`,
            suit: 'spades',
            rank: 14,
            edition,
            facing: 'back',
          }),
          translator: ru,
        });

        expect(backEl.classList.contains('is-face-down')).toBe(true);
        expect(backEl.dataset.edition).toBeUndefined();
        expect(backEl.className).not.toMatch(/card-edition-/);
        expect(backEl.querySelector('.card-frame__edition-sheen')).toBeNull();
        expect(backEl.querySelector('.card-glare')).toBeNull();
      }
    });

    it('добавляет .card-edition-* и .card-glare на реликвии и расходники с изданием', () => {
      const relic = renderEntityCardFrame({
        kind: 'relic',
        relic: createRelicInstance('j_joker', 's22_rel_poly', 'polychrome'),
        translator: ru,
      });
      expect(relic.classList.contains('card-edition-polychrome')).toBe(true);
      expect(relic.querySelector('.card-glare')).not.toBeNull();

      const consumable = renderEntityCardFrame({
        kind: 'consumable',
        consumable: createConsumableInstance('c_pluto', 's22_cons_neg', 'negative'),
        translator: en,
      });
      expect(consumable.classList.contains('card-edition-negative')).toBe(true);
      expect(consumable.querySelector('.card-glare')).not.toBeNull();
    });

    it('cardFrame.css поддерживает 3D-наклон, фазовое парение (--sway-r, --sway-y), блик (--glare-x, --glare-y), перелив изданий и reduced-motion', async () => {
      const fsModule = 'node:fs';
      const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as {
        readFileSync: (file: string, encoding: 'utf8') => string;
      };
      const css = readFileSync('src/ui/cardFrame.css', 'utf8');

      expect(css).toContain('--sway-r');
      expect(css).toContain('--sway-y');
      expect(css).toContain('--glare-x');
      expect(css).toContain('--glare-y');
      expect(css).toContain('.card-glare');
      expect(css).toContain('.card-edition-foil');
      expect(css).toContain('.card-edition-holographic');
      expect(css).toContain('.card-edition-polychrome');
      expect(css).toContain('.card-edition-negative');
      expect(css).toContain('@keyframes');
      expect(css).toContain('prefers-reduced-motion: reduce');
      expect(css).toMatch(/\.card-frame\.is-face-down[\s\S]*display:\s*none/);
    });

    it('cardFrame.css использует пиксельный шрифт Pixellari для рангов и аккуратное позиционирование угловых индексов', async () => {
      const fsModule = 'node:fs';
      const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as {
        readFileSync: (file: string, encoding: 'utf8') => string;
      };
      const css = readFileSync('src/ui/cardFrame.css', 'utf8');

      expect(css).toContain("'Pixellari'");
      expect(css).toContain('.card-frame__corner--top');
      expect(css).toContain('.card-frame__corner--bottom');
      expect(css).toContain('.card-frame__rank');
      expect(css).toContain('.card-frame__suit');
      expect(css).toMatch(/font-family:\s*['"]Pixellari['"],\s*monospace/);
      expect(css).toMatch(/font-weight:\s*700/);
      expect(css).toMatch(/line-height:\s*0\.9/);
      expect(css).toMatch(/letter-spacing:\s*-0\.03em/);
    });
  });
});
