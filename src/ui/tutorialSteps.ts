import { isDevOriginalTermsEnabled } from '../i18n';

/**
 * Игровые фазы, в которых может отображаться шаг интерактивного обучения.
 */
export type TutorialPhase = 'blind_select' | 'playing' | 'cashout' | 'shop';

/**
 * Расположение указательной анимированной стрелки относительно подсвечиваемого элемента.
 */
export type TutorialArrowPosition = 'top' | 'bottom' | 'left' | 'right' | 'none';

/**
 * Предпочтительное размещение плавающего кластера маскота относительно экрана/цели:
 * - left: на левой стороне экрана над HUD (идеально для кэшаута, магазина и доски заказов, чтобы освободить центр)
 * - top-left: вверху слева над панелью очков (идеально при взаимодействии с картами внизу)
 * - center: по центру экрана (для приветствия и финального поздравления)
 * - auto: автоматический выбор позиции (вверху/внизу от цели)
 */
export type TutorialPlacement = 'auto' | 'left' | 'top-left' | 'center';

/**
 * Персонаж-рассказчик реплики обучения:
 * В стандартном режиме (6+/12+) — Мира (управляющая Гильдии).
 */
export type TutorialSpeaker = 'Мира' | (string & {});

/**
 * Канонический набор из 8 эмоциональных состояний и поз чиби-маскота Миры:
 * - welcome: приветствие с планшеткой гильдии
 * - guide_cards: веер карт в руке и указка пальцем
 * - guide_book: открытый гримуар с рунами
 * - guide_point: подмигивание и поднятый палец «Важное правило»
 * - guide: свиток и указка
 * - happy: радость, победа и мешочек золота
 * - worried: тревога, капелька пота и руки у щёк
 * - idle: базовое спокойное парение
 */
export type CanonicalTutorialEmotion =
  | 'welcome'
  | 'guide_cards'
  | 'guide_book'
  | 'guide_point'
  | 'guide'
  | 'happy'
  | 'worried'
  | 'idle';

/**
 * Устаревшие псевдонимы эмоций для обратной совместимости.
 */
export type LegacyTutorialEmotion = 'neutral' | 'thinking' | 'warning';

/**
 * Полный тип эмоции персонажа обучения (канонические 8 эмоций + legacy-алиасы).
 */
export type TutorialEmotion = CanonicalTutorialEmotion | LegacyTutorialEmotion;

/**
 * Нормализует любую эмоцию обучения к одному из 8 канонических состояний спрайта.
 */
export function normalizeTutorialEmotion(emotion: TutorialEmotion): CanonicalTutorialEmotion {
  switch (emotion) {
    case 'neutral':
      return 'idle';
    case 'thinking':
      return 'guide_point';
    case 'warning':
      return 'worried';
    default:
      return emotion;
  }
}

/**
 * Требуемое действие игрока для перехода к следующему шагу или разблокировки кнопки «Дальше».
 */
export type TutorialRequiredAction =
  | 'next'
  | 'select_blind'
  | 'select_card'
  | 'play_hand'
  | 'discard'
  | 'buy_relic'
  | 'buy_consumable'
  | 'use_consumable'
  | 'leave_shop';

/**
 * Описание одного шага интерактивного сценария обучения Balite.
 */
export interface TutorialStep {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly phase: TutorialPhase;
  readonly targetSelector?: string;
  readonly arrowPosition: TutorialArrowPosition;
  readonly placement?: TutorialPlacement;
  readonly speaker: TutorialSpeaker;
  readonly emotion: TutorialEmotion;
  readonly requireAction: TutorialRequiredAction;
}

/**
 * Внутренняя схема шага со словарём для стандартного 6+/12+ режима.
 */
interface RawTutorialStepDefinition {
  readonly id: string;
  readonly phase: TutorialPhase;
  readonly targetSelector?: string;
  readonly arrowPosition: TutorialArrowPosition;
  readonly placement?: TutorialPlacement;
  readonly emotion: TutorialEmotion;
  readonly requireAction: TutorialRequiredAction;
  readonly standard: {
    readonly title: string;
    readonly text: string;
  };
}

let devSpeakerName: TutorialSpeaker = 'Мира';
let devStepOverrides: Readonly<
  Record<string, { readonly title: string; readonly text: string }>
> | null = null;

/**
 * Регистрирует DEV-оверлей шагов обучения (только в режиме разработки).
 */
export function registerDevTutorialOverlay(
  speaker: TutorialSpeaker,
  overrides: Readonly<Record<string, { readonly title: string; readonly text: string }>>,
): void {
  if (!import.meta.env.DEV) return;
  devSpeakerName = speaker;
  devStepOverrides = overrides;
}

/**
 * Лениво подгружает DEV-оверлей обучения (в prod-сборке полностью вырезается сборщиком).
 */
export async function preloadDevTutorialSteps(): Promise<void> {
  if (!import.meta.env.DEV) return;
  if (!devStepOverrides) {
    const mod = await import('./tutorialDevOverlay');
    registerDevTutorialOverlay(mod.DEV_TUTORIAL_SPEAKER, mod.DEV_TUTORIAL_STEP_OVERRIDES);
  }
}

if (import.meta.env.DEV) {
  void preloadDevTutorialSteps();
}

/**
 * Канонический список из 21 подробного шага интерактивного обучения Balite.
 * Охватывает все тонкости игровой математики, экономику, позиционирование навыков и механику расхода карт.
 * Строго соблюдает канонический словарь гильдии 6+/12+ (ru.ts).
 */
const RAW_TUTORIAL_DEFINITIONS: readonly RawTutorialStepDefinition[] = [
  // --------------------------------------------------------------------------
  // ФАЗА: BLIND_SELECT (Выбор Заказа)
  // --------------------------------------------------------------------------
  {
    id: 'welcome_guild',
    phase: 'blind_select',
    arrowPosition: 'none',
    placement: 'left',
    emotion: 'welcome',
    requireAction: 'next',
    standard: {
      title: 'Добро пожаловать в Гильдию!',
      text: 'Приветствую, исследователь! Меня зовут {C:attention}Мира{}, я управляющая Гильдии. Рада видеть тебя в наших рядах! Твоя цель — пройти все 8 Этажей подземелья, выполняя {C:attention}Заказы{} на монстров силой карточной математики и собирая могущественные синергии Навыков.',
    },
  },
  {
    id: 'blind_select_overview',
    phase: 'blind_select',
    targetSelector: '.blind-card--current',
    arrowPosition: 'bottom',
    placement: 'left',
    emotion: 'welcome',
    requireAction: 'next',
    standard: {
      title: 'Выбор Заказа на доске',
      text: 'На каждом Этаже подземелья тебя ждут три Заказа: {C:blue}Младший заказ{}, {C:attention}Старший заказ{} и опасный {C:red}Босс-монстр{}. Чтобы выполнить Заказ, нужно набрать его целевой счёт за ограниченное число рук. За каждую победу казна выплачивает щедрое {C:money}золото{}!',
    },
  },
  {
    id: 'skip_blind_and_tags',
    phase: 'blind_select',
    targetSelector: '.blind-card--upcoming .blind-card__skip-row',
    arrowPosition: 'bottom',
    placement: 'left',
    emotion: 'guide_point',
    requireAction: 'next',
    standard: {
      title: 'Пропуск Заказа и Талоны',
      text: 'Младший и Старший Заказы можно не выполнять, а {C:attention}пропустить{}! За пропуск ты мгновенно получаешь ценный {C:attention}Талон{} с уникальным эффектом: бесплатный сундук в Лавке, удвоение золота или мгновенное усиление. Но помни: при пропуске ты не попадаешь в Лавку Гильдии и остаёшься без боевой выплаты!',
    },
  },
  {
    id: 'boss_blind_warning',
    phase: 'blind_select',
    targetSelector: '[data-blind-kind="boss"]',
    arrowPosition: 'bottom',
    placement: 'left',
    emotion: 'worried',
    requireAction: 'next',
    standard: {
      title: 'Опасность Босса-монстра',
      text: '{C:warning}Внимание! Босса-монстра пропустить нельзя!{} У каждого Босса есть коварная способность: блокировка мастей, скрытие карт рубашкой вверх или уполовинивание очков. Победа над Боссом завершает текущий Этаж подземелья и делает всех следующих монстров сильнее. Одолей Босса 8-го Этажа, чтобы победить!',
    },
  },
  {
    id: 'action_select_blind',
    phase: 'blind_select',
    targetSelector: '.blind-card--current .blind-card__battle-btn',
    arrowPosition: 'top',
    placement: 'left',
    emotion: 'welcome',
    requireAction: 'select_blind',
    standard: {
      title: 'Принять первый заказ!',
      text: 'Начнём наш путь со сражения против первого монстра (Слизняка). Для победы нужно набрать всего 300 очков. Нажми кнопку {C:blue}«Принять заказ»{}, чтобы начать первый раунд!',
    },
  },

  // --------------------------------------------------------------------------
  // ФАЗА: PLAYING (Бой и Розыгрыш карт)
  // --------------------------------------------------------------------------
  {
    id: 'scoring_formula_deep',
    phase: 'playing',
    targetSelector: '.score-calc-row',
    arrowPosition: 'top',
    placement: 'left',
    emotion: 'guide_book',
    requireAction: 'next',
    standard: {
      title: 'Формула очков: Сила × Множитель',
      text: 'Взгляни на панель подсчёта очков! Результат любой комбинации вычисляется по формуле: {C:blue}Сила (Синие очки){} × {C:red}Множитель (Красные очки){}. Чем больше оба числа, тем мощнее итоговый залп очков! Например: 40 Силы × 4 Множитель = {C:attention}160 итоговых очков{}.',
    },
  },
  {
    id: 'card_rank_chips',
    phase: 'playing',
    targetSelector: '.belt--hand .hand-fan',
    arrowPosition: 'bottom',
    placement: 'top-left',
    emotion: 'guide_cards',
    requireAction: 'next',
    standard: {
      title: 'Сила игральных карт',
      text: 'Важнейший секрет: {C:blue}каждая сыгранная карта сама по себе приносит Силу{} в общую копилку! Карты от 2 до 10 дают Силу по своему достоинству (от +2 до +10). Фигурные карты (Валет, Дама, Король) дают по {C:blue}+10 Силы{}, а Туз даёт сразу {C:blue}+11 Силы{}! Разыгрывать старшие карты всегда выгоднее.',
    },
  },
  {
    id: 'hand_combinations_guide',
    phase: 'playing',
    targetSelector: '.hud-buttons-row button:first-child',
    arrowPosition: 'top',
    placement: 'left',
    emotion: 'guide_cards',
    requireAction: 'next',
    standard: {
      title: 'Комбинации карт',
      text: 'Ты можешь собирать комбинации до 5 карт: от {C:attention}Старшей карты{} и {C:attention}Пары{} до {C:attention}Ряда{} (5 карт подряд по рангу), {C:attention}Масти{} (5 карт одной масти), {C:attention}Полного строя{} (3 одного ранга + 2 другого) и венца игры — {C:attention}Мастного ряда{}! Чем сложнее комбинация, тем выше её начальные Сила и Множитель. Нажми кнопку {C:attention}«Комбинации»{}, чтобы открыть полную памятку.',
    },
  },
  {
    id: 'action_select_hand_cards',
    phase: 'playing',
    targetSelector: '.belt--hand .hand-card-slot:first-child',
    arrowPosition: 'bottom',
    placement: 'top-left',
    emotion: 'guide_cards',
    requireAction: 'select_card',
    standard: {
      title: 'Выбор карт в руке',
      text: 'Давай выберем карты! Нажимай на карты в руке (до 5 штук), чтобы выделить их. Выбранные карты приподнимутся. Попробуй найти карты одного достоинства (Пару или Тройку) или карты одной масти.',
    },
  },
  {
    id: 'discards_and_sorting',
    phase: 'playing',
    targetSelector: '.hand-actions',
    arrowPosition: 'bottom',
    placement: 'top-left',
    emotion: 'guide_point',
    requireAction: 'next',
    standard: {
      title: 'Сброс и сортировка руки',
      text: 'Не видишь хорошей комбинации? Используй {C:red}«Сброс»{}! Ты можешь отправить в сброс до 5 карт и бесплатно добрать новые из колоды. {C:warning}Важно: сброшенные карты уходят в отбой и не вернутся до следующего раунда!{} А кнопки {C:attention}«По рангу»{} и {C:attention}«По масти»{} помогут быстро навести порядок в руке.',
    },
  },
  {
    id: 'action_play_hand',
    phase: 'playing',
    targetSelector: '.hand-actions__play',
    arrowPosition: 'bottom',
    placement: 'top-left',
    emotion: 'guide_cards',
    requireAction: 'play_hand',
    standard: {
      title: 'Розыгрыш комбинации',
      text: 'Карты выбраны! Теперь нажми зелёную кнопку {C:blue}«Сыграть»{}. Карты отправятся в бой, принесут Силу и умножатся на Множитель. Если наберёшь 300 очков — заказ выполнится досрочно!',
    },
  },

  // --------------------------------------------------------------------------
  // ФАЗА: CASHOUT (Экран выплаты)
  // --------------------------------------------------------------------------
  {
    id: 'cashout_and_interest',
    phase: 'cashout',
    targetSelector: '.cashout-container',
    arrowPosition: 'left',
    placement: 'left',
    emotion: 'happy',
    requireAction: 'next',
    standard: {
      title: 'Выплата и проценты казны',
      text: 'Заказ выполнен! На экране выплаты виден расчёт награды: выплата за заказ + по 1 з. за каждую сэкономленную руку + {C:money}Проценты казны{}! {C:attention}Золотое правило: за каждые 5 з. в кошельке ты получаешь 1 з. процента (до максимума в 5 з. при наличии 25 з.){}. Копить золото невероятно выгодно!',
    },
  },
  {
    id: 'action_claim_cashout',
    phase: 'cashout',
    targetSelector: '.claim-cashout-btn',
    arrowPosition: 'bottom',
    placement: 'left',
    emotion: 'happy',
    requireAction: 'next',
    standard: {
      title: 'Забрать награду',
      text: 'Нажми кнопку {C:gold}«Забрать золото»{}, чтобы пополнить свой кошелёк и отправиться в Лавку Гильдии за новыми улучшениями!',
    },
  },

  // --------------------------------------------------------------------------
  // ФАЗА: SHOP (Лавка Гильдии / Магазин)
  // --------------------------------------------------------------------------
  {
    id: 'guild_shop_relics_rarity',
    phase: 'shop',
    targetSelector: '.shop-row--offers',
    arrowPosition: 'top',
    placement: 'left',
    emotion: 'idle',
    requireAction: 'next',
    standard: {
      title: 'Лавка Гильдии и Навыки',
      text: 'Добро пожаловать в Лавку! Главное сокровище здесь — {C:attention}Навыки{} (у тебя есть 5 слотов под них). Каждый Навык даёт уникальный пассивный бонус: добавление Силы, умножение очков или усиление карт. Навыки делятся на ранги редкости: {C:blue}B (Обычные){}, {C:green}A (Необычные){} и {C:red}S (Редкие){}. Чем выше ранг, тем сокрушительнее мощь!',
    },
  },
  {
    id: 'relic_order_pro_tip',
    phase: 'shop',
    targetSelector: '.belt--inventory .inventory-strip:first-child',
    arrowPosition: 'top',
    placement: 'left',
    emotion: 'guide_point',
    requireAction: 'next',
    standard: {
      title: 'Секрет порядка Навыков: Слева направо!',
      text: '{C:warning}САМЫЙ ВАЖНЫЙ ТАКТИЧЕСКИЙ СЕКРЕТ:{} Навыки срабатывают строго {C:attention}слева направо{}! Располагай Навыки с плоской Силой (+Сила) и плоским Множителем (+Множитель) {C:blue}СЛЕВА{}, а умножающие Навыки (×Множитель) ставь {C:red}СПРАВА{}! Сравни: (10 + 10) × 3 = {C:attention}60{}, а (10 × 3) + 10 = всего лишь {C:red}40{}! Ты можешь перетаскивать Навыки в любое время.',
    },
  },
  {
    id: 'consumables_overview',
    phase: 'shop',
    targetSelector: '.belt--inventory .inventory-strip:nth-child(2)',
    arrowPosition: 'top',
    placement: 'left',
    emotion: 'guide_book',
    requireAction: 'next',
    standard: {
      title: 'Расходники: Фолианты, Свитки, Карты Пандоры',
      text: 'В поясе инвентаря есть 2 слота под одноразовые {C:attention}Расходники{}:\n• {C:planet}Фолианты{}: навсегда повышают базовые очки конкретной комбинации!\n• {C:tarot}Свитки Кузни{}: зачаровывают карты в руке (делают их стальными, золотыми или хрустальными).\n• {C:spectral}Карты Пандоры{}: редчайшие рискованные заклинания, меняющие всю колоду или Навыки.',
    },
  },
  {
    id: 'vouchers_privileges',
    phase: 'shop',
    targetSelector: '.shop-bottom-grid .shop-row:first-child',
    arrowPosition: 'bottom',
    placement: 'left',
    emotion: 'guide_point',
    requireAction: 'next',
    standard: {
      title: 'Привилегии гильдии',
      text: 'В нижней витрине продаётся {C:attention}Привилегия гильдии{}. Это постоянное пассивное свойство на всю экспедицию: +1 карта в руке, дополнительные сбросы, скидки или повышенный лимит процентов! Новая Привилегия появляется один раз за Этаж — сразу после победы над Боссом.',
    },
  },
  {
    id: 'action_buy_shop_item',
    phase: 'shop',
    targetSelector: '.shop-offers-grid .shop-slot-btn:first-child',
    arrowPosition: 'top',
    placement: 'left',
    emotion: 'happy',
    requireAction: 'buy_relic',
    standard: {
      title: 'Покупка в Лавке',
      text: 'Нажми на товар на витрине, чтобы открыть окно описания и нажать {C:gold}«Купить»{}. Если не хватает места или золота — любой ненужный Навык или Расходник из инвентаря можно продать за полцены!',
    },
  },
  {
    id: 'combat_consumables_usage',
    phase: 'shop',
    targetSelector: '.belt--inventory .inventory-strip:nth-child(2)',
    arrowPosition: 'top',
    placement: 'left',
    emotion: 'guide',
    requireAction: 'next',
    standard: {
      title: 'Использование расходников в бою',
      text: 'Полезные свитки можно приберечь! Использовать расходники разрешено не только в Лавке, но и прямо посреди боя. Например, для Свитка Кузни выбери до 2 карт в руке, нажми на Свиток в верхнем поясе и кликни {C:attention}«Использовать»{} — карты мгновенно получат новые зачарования!',
    },
  },
  {
    id: 'reroll_and_next_round',
    phase: 'shop',
    targetSelector: '.shop-next-btn',
    arrowPosition: 'top',
    placement: 'left',
    emotion: 'idle',
    requireAction: 'leave_shop',
    standard: {
      title: 'Обновление и Следующий раунд',
      text: 'Если на полке нет подходящих товаров, можно {C:attention}обновить ассортимент Лавки{} за золото (каждый повторный поиск в раунде дороже на 1 з.). А когда закончишь подготовку, нажми зелёную кнопку {C:blue}«Далее»{}!',
    },
  },
  {
    id: 'tutorial_conclusion',
    phase: 'shop',
    arrowPosition: 'none',
    placement: 'center',
    emotion: 'happy',
    requireAction: 'next',
    standard: {
      title: 'Ты готов к экспедиции!',
      text: 'Превосходно! Теперь ты знаешь основы карточной математики, экономии золота и построения могущественных синергий Навыков. Исследуй подземелье, экспериментируй с Навыками и покори все 8 Этажей! Обучение всегда можно перечитать в Настройках. Удачи!',
    },
  },
];

/**
 * Преобразует сырое определение шага в готовый TutorialStep в зависимости от режима оригинальных терминов.
 */
function resolveStep(def: RawTutorialStepDefinition, devOriginal: boolean): TutorialStep {
  const useDev = Boolean(import.meta.env.DEV && devOriginal && devStepOverrides?.[def.id]);
  const content = useDev ? devStepOverrides![def.id]! : def.standard;
  const speaker: TutorialSpeaker = useDev ? devSpeakerName : 'Мира';

  return {
    id: def.id,
    title: content.title,
    text: content.text,
    phase: def.phase,
    ...(def.targetSelector ? { targetSelector: def.targetSelector } : {}),
    arrowPosition: def.arrowPosition,
    ...(def.placement ? { placement: def.placement } : {}),
    speaker,
    emotion: def.emotion,
    requireAction: def.requireAction,
  };
}

/**
 * Возвращает полный список шагов обучения с учётом текущего или заданного режима оригинальных терминов.
 *
 * @param devOriginal - Явный флаг использования оригинальной терминологии Balatro (по умолчанию проверяет isDevOriginalTermsEnabled()).
 */
export function getTutorialSteps(devOriginal = isDevOriginalTermsEnabled()): readonly TutorialStep[] {
  return RAW_TUTORIAL_DEFINITIONS.map((def) => resolveStep(def, devOriginal));
}

/**
 * Возвращает шаг обучения по его уникальному идентификатору.
 */
export function getTutorialStep(
  id: string,
  devOriginal = isDevOriginalTermsEnabled(),
): TutorialStep | undefined {
  const def = RAW_TUTORIAL_DEFINITIONS.find((item) => item.id === id);
  return def ? resolveStep(def, devOriginal) : undefined;
}

/**
 * Возвращает шаг обучения по его порядковому номеру (0..N-1).
 */
export function getTutorialStepByIndex(
  index: number,
  devOriginal = isDevOriginalTermsEnabled(),
): TutorialStep | undefined {
  const def = RAW_TUTORIAL_DEFINITIONS[index];
  return def ? resolveStep(def, devOriginal) : undefined;
}

/**
 * Возвращает индекс шага обучения по его идентификатору (-1, если не найден).
 */
export function getTutorialStepIndex(id: string): number {
  return RAW_TUTORIAL_DEFINITIONS.findIndex((item) => item.id === id);
}

/**
 * Возвращает все шаги обучения, привязанные к определённой фазе игры.
 */
export function getTutorialStepsByPhase(
  phase: TutorialPhase,
  devOriginal = isDevOriginalTermsEnabled(),
): readonly TutorialStep[] {
  return RAW_TUTORIAL_DEFINITIONS.filter((item) => item.phase === phase).map((def) =>
    resolveStep(def, devOriginal),
  );
}

/**
 * Возвращает общее количество шагов в сценарии интерактивного обучения.
 */
export function getTutorialTotalSteps(): number {
  return RAW_TUTORIAL_DEFINITIONS.length;
}

/**
 * Канонический массив шагов обучения по умолчанию со строгой цензурой 6+/12+ для модерации площадок.
 */
export const TUTORIAL_STEPS: readonly TutorialStep[] = getTutorialSteps(false);
