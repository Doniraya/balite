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
 * Персонаж-рассказчик реплики обучения:
 * В стандартном режиме (6+/12+) — Мира (управляющая Гильдии).
 * В DEV-режиме оригинальных терминов Balatro — Джимбо (весёлый шут).
 */
export type TutorialSpeaker = 'Мира' | 'Джимбо';

/**
 * Эмоциональное состояние персонажа для подбора аватара.
 */
export type TutorialEmotion = 'neutral' | 'happy' | 'thinking' | 'warning';

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
  readonly speaker: TutorialSpeaker;
  readonly emotion: TutorialEmotion;
  readonly requireAction: TutorialRequiredAction;
}

/**
 * Внутренняя схема шага со словарём для стандартного 6+/12+ и DEV-режимов.
 */
interface RawTutorialStepDefinition {
  readonly id: string;
  readonly phase: TutorialPhase;
  readonly targetSelector?: string;
  readonly arrowPosition: TutorialArrowPosition;
  readonly emotion: TutorialEmotion;
  readonly requireAction: TutorialRequiredAction;
  readonly standard: {
    readonly title: string;
    readonly text: string;
  };
  readonly devOriginal: {
    readonly title: string;
    readonly text: string;
  };
}

/**
 * Канонический список из 21 подробного шага интерактивного обучения Balite.
 * Охватывает все тонкости игровой математики, экономику, позиционирование реликвий и механику расхода карт.
 */
const RAW_TUTORIAL_DEFINITIONS: readonly RawTutorialStepDefinition[] = [
  // --------------------------------------------------------------------------
  // ФАЗА: BLIND_SELECT (Выбор Стража)
  // --------------------------------------------------------------------------
  {
    id: 'welcome_guild',
    phase: 'blind_select',
    arrowPosition: 'none',
    emotion: 'happy',
    requireAction: 'next',
    standard: {
      title: 'Добро пожаловать в Гильдию!',
      text: 'Приветствую, исследователь! Меня зовут {C:attention}Мира{}, я управляющая Гильдии. Рада видеть тебя в наших рядах! Твоя цель — пройти все 8 Этапов подземелья, побеждая грозных {C:attention}Стражей{} силой карточной математики и собирая могущественные синергии.',
    },
    devOriginal: {
      title: 'Добро пожаловать в Balite!',
      text: 'Привет! Меня зовут {C:attention}Джимбо{}, и я научу тебя побеждать в Balite! Твоя цель — пройти все 8 Анте, побеждая {C:attention}Блайнды{} карточными комбинациями и собирая безумные комбо с джокерами.',
    },
  },
  {
    id: 'blind_select_overview',
    phase: 'blind_select',
    targetSelector: '.blind-card--current',
    arrowPosition: 'bottom',
    emotion: 'neutral',
    requireAction: 'next',
    standard: {
      title: 'Выбор Стража',
      text: 'Каждый Этап охраняют три Стража: {C:blue}Младший{}, {C:attention}Старший{} и {C:red}Главный страж (Босс){}. Чтобы одолеть Стража, нужно набрать его целевой счёт за ограниченное число попыток. За каждую победу казна выплачивает щедрое {C:money}золото{}!',
    },
    devOriginal: {
      title: 'Выбор Блайнда',
      text: 'В каждом Анте тебя ждут три раунда: {C:blue}Малый блайнд{}, {C:attention}Большой блайнд{} и {C:red}Босс-блайнд{}. Чтобы победить блайнд, нужно набрать необходимое число {C:blue}фишек{} за ограниченное количество рук. Победа приносит награду в {C:money}долларах{}!',
    },
  },
  {
    id: 'skip_blind_and_tags',
    phase: 'blind_select',
    targetSelector: '.blind-card--upcoming .blind-card__skip-row',
    arrowPosition: 'bottom',
    emotion: 'thinking',
    requireAction: 'next',
    standard: {
      title: 'Пропуск Стража и Знаки',
      text: 'Младшего и Старшего Стражей можно не сражать, а {C:attention}пропустить{}! За пропуск ты мгновенно получаешь ценный {C:attention}Знак{} с уникальным даром: бесплатный набор в Лавке, удвоение золота или мгновенное усиление. Но помни: при пропуске ты не попадаешь в Лавку Гильдии и остаёшься без боевой выплаты!',
    },
    devOriginal: {
      title: 'Пропуск и Теги',
      text: 'Малый и Большой блайнды можно {C:attention}пропустить{}! За пропуск даётся {C:attention}Тег{} с мощным бонусом: бесплатный бустер, удвоение денег или прокачка руки. Однако пропуская раунд, ты не заходишь в магазин и не получаешь выплату за победу!',
    },
  },
  {
    id: 'boss_blind_warning',
    phase: 'blind_select',
    targetSelector: '[data-blind-kind="boss"]',
    arrowPosition: 'bottom',
    emotion: 'warning',
    requireAction: 'next',
    standard: {
      title: 'Опасность Главного Стража',
      text: '{C:warning}Внимание! Главного Стража (Босса) пропустить нельзя!{} У каждого Босса есть коварная способность: блокировка мастей, скрытие карт рубашкой вверх или уполовинивание очков. Победа над Боссом завершает текущий Этап и делает всех следующих врагов сильнее. Одолей Босса 8-го Этапа, чтобы победить!',
    },
    devOriginal: {
      title: 'Опасность Босс-блайнда',
      text: '{C:warning}Босс-блайнд нельзя пропустить!{} У каждого Босса есть особая пассивная способность: обнуление мастей, переворот карт рубашкой вверх или снижение множителя. Победа над Боссом повышает Анте и усложняет игру. Победи Босса 8-го Анте, чтобы выиграть забег!',
    },
  },
  {
    id: 'action_select_blind',
    phase: 'blind_select',
    targetSelector: '.blind-card--current .blind-card__battle-btn',
    arrowPosition: 'top',
    emotion: 'happy',
    requireAction: 'select_blind',
    standard: {
      title: 'В бой со Стражем!',
      text: 'Начнём наш путь со сражения против Младшего Стража. Для победы нужно набрать всего 300 очков. Нажми кнопку {C:blue}«Сразиться»{}, чтобы начать первый раунд!',
    },
    devOriginal: {
      title: 'Выбери Блайнд!',
      text: 'Начнём с Малого блайнда. Порог победы — 300 фишек. Жми кнопку {C:blue}«Выбрать»{}, чтобы перейти к раздаче карт!',
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
    emotion: 'neutral',
    requireAction: 'next',
    standard: {
      title: 'Формула очков: Сила × Множитель',
      text: 'Взгляни на верхнюю панель подсчёта! Очки любой комбинации вычисляются по базовой формуле: {C:blue}Сила (Синие очки){} × {C:red}Множитель (Красные очки){}. Чем больше оба числа, тем мощнее итоговый залп очков! Например: 40 Силы × 4 Множитель = {C:attention}160 итоговых очков{}.',
    },
    devOriginal: {
      title: 'Формула: Фишки × Множ',
      text: 'Взгляни на панель счёта! Очки за сыгранную руку вычисляются по формуле: {C:blue}Синие фишки{} × {C:red}Красный множитель{}. Чем выше оба значения, тем грандиознее результат! Например: 40 Фишек × 4 Множ = {C:attention}160 очков{}.',
    },
  },
  {
    id: 'card_rank_chips',
    phase: 'playing',
    targetSelector: '.belt--hand .hand-fan',
    arrowPosition: 'bottom',
    emotion: 'thinking',
    requireAction: 'next',
    standard: {
      title: 'Сила игральных карт',
      text: 'Важнейший секрет: {C:blue}каждая сыгранная карта сама по себе приносит Силу{} в общую копилку! Карты от 2 до 10 дают Силу по своему достоинству (от +2 до +10). Фигурные карты (Валет, Дама, Король) дают по {C:blue}+10 Силы{}, а Туз даёт сразу {C:blue}+11 Силы{}! Разыгрывать старшие карты всегда выгоднее.',
    },
    devOriginal: {
      title: 'Фишки карт в руке',
      text: 'Помни: {C:blue}каждая зачётная карта приносит свои фишки{}! Числовые карты от 2 до 10 дают фишки по своему номиналу. Картинки (Валет, Дама, Король) дают по {C:blue}+10 фишек{}, а Туз приносит целых {C:blue}+11 фишек{}! Старшие карты существенно раздувают базу очков.',
    },
  },
  {
    id: 'hand_combinations_guide',
    phase: 'playing',
    targetSelector: '.hud-buttons-row button:first-child',
    arrowPosition: 'top',
    emotion: 'neutral',
    requireAction: 'next',
    standard: {
      title: 'Комбинации карт',
      text: 'Ты можешь собирать комбинации до 5 карт: от {C:attention}Старшей карты{} и {C:attention}Пары{} до {C:attention}Стрита{} (5 карт по порядку), {C:attention}Флеша{} (5 карт одной масти), {C:attention}Фулл-Хауса{} и венца игры — {C:attention}Флеш-Рояля{}! Чем сложнее комбинация, тем выше её начальные Сила и Множитель. Нажми кнопку {C:attention}«Комбинации»{}, чтобы открыть полную памятку.',
    },
    devOriginal: {
      title: 'Покерные комбинации',
      text: 'Ты можешь разыгрывать комбинации до 5 карт: от {C:attention}Старшей карты{} и {C:attention}Пары{} до {C:attention}Стрита{} (5 карт подряд), {C:attention}Флеша{} (5 карт одной масти), {C:attention}Фулл-Хауса{} и {C:attention}Флеш-Рояля{}! Нажми кнопку {C:attention}«Комбинации»{}, чтобы в любой момент проверить базовые фишки и множители всех рук.',
    },
  },
  {
    id: 'action_select_hand_cards',
    phase: 'playing',
    targetSelector: '.belt--hand .hand-card-slot:first-child',
    arrowPosition: 'bottom',
    emotion: 'neutral',
    requireAction: 'select_card',
    standard: {
      title: 'Выбор карт в руке',
      text: 'Давай выберем карты! Нажимай на карты в руке (до 5 штук), чтобы выделить их. Выбранные карты приподнимутся. Попробуй найти карты одного достоинства (Пару или Тройку) или карты одной масти.',
    },
    devOriginal: {
      title: 'Выбери карты в руке!',
      text: 'Давай выберем руку! Коснись карт в руке (до 5 штук), чтобы поднять их. Попробуй собрать Пару, Сет или карты одной масти для Флеша.',
    },
  },
  {
    id: 'discards_and_sorting',
    phase: 'playing',
    targetSelector: '.hand-actions',
    arrowPosition: 'bottom',
    emotion: 'thinking',
    requireAction: 'next',
    standard: {
      title: 'Сброс и сортировка руки',
      text: 'Не видишь хорошей комбинации? Используй {C:red}«Сброс»{}! Ты можешь отправить в сброс до 5 карт и бесплатно добрать новые из колоды. {C:warning}Важно: сброшенные карты уходят в отбой и не вернутся до следующего раунда!{} А кнопки {C:attention}«По рангу»{} и {C:attention}«По масти»{} помогут быстро навести порядок в руке.',
    },
    devOriginal: {
      title: 'Сброс и сортировка',
      text: 'Рука не складывается? Используй {C:red}«Сбросить»{}! Можно сбросить до 5 ненужных карт и добрать новые. {C:warning}Учти: сброшенные карты не вернутся до конца раунда!{} Кнопки {C:attention}«По рангу»{} и {C:attention}«По масти»{} помогают мгновенно заметить совпадения.',
    },
  },
  {
    id: 'action_play_hand',
    phase: 'playing',
    targetSelector: '.hand-actions__play',
    arrowPosition: 'bottom',
    emotion: 'happy',
    requireAction: 'play_hand',
    standard: {
      title: 'Розыгрыш комбинации',
      text: 'Карты выбраны! Теперь нажми синюю кнопку {C:blue}«Сыграть комбинацию»{}. Карты отправятся в бой, принесут Силу и умножатся на Множитель. Если наберёшь 300 очков — раунд завершится досрочной победой!',
    },
    devOriginal: {
      title: 'Сыграй руку!',
      text: 'Отлично! Теперь жми кнопку {C:blue}«Сыграть руку»{}. Карты принесут фишки, сработает множитель, и пламя счёта вспыхнет! Набери 300 фишек, чтобы победить в раунде.',
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
    emotion: 'happy',
    requireAction: 'next',
    standard: {
      title: 'Выплата и проценты на золото',
      text: 'Страж повержен! На экране выплаты виден расчёт награды: выплата за Стража + по $1 за каждую сэкономленную попытку + {C:money}Проценты с казны{}! {C:attention}Золотое правило: за каждые $5 в кошельке ты получаешь $1 процента (до максимума в $5 при наличии $25){}. Копить золото невероятно выгодно!',
    },
    devOriginal: {
      title: 'Кэшаут и проценты',
      text: 'Раунд пройден! На экране кэшаута показана выплата: награда за блайнд + по $1 за каждую оставшуюся руку + {C:money}Проценты{}! {C:attention}Экономический закон: каждые $5 в банке дают $1 процента (максимум $5 за $25 сбережений){}. Копи деньги, чтобы богатеть быстрее!',
    },
  },
  {
    id: 'action_claim_cashout',
    phase: 'cashout',
    targetSelector: '.claim-cashout-btn',
    arrowPosition: 'bottom',
    emotion: 'neutral',
    requireAction: 'next',
    standard: {
      title: 'Забрать награду',
      text: 'Нажми кнопку {C:gold}«Забрать золото»{}, чтобы пополнить свой кошелёк и отправиться в Лавку Гильдии за новыми улучшениями!',
    },
    devOriginal: {
      title: 'Забрать доллары',
      text: 'Жми кнопку {C:gold}«Забрать»{}, чтобы перевести заработанные деньги в кошелёк и перейти в магазин!',
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
    emotion: 'neutral',
    requireAction: 'next',
    standard: {
      title: 'Лавка Гильдии и Реликвии',
      text: 'Добро пожаловать в Лавку! Главное сокровище здесь — {C:attention}Реликвии{} (у тебя есть 5 слотов под них). Каждая Реликвия даёт уникальный пассивный бонус: добавление Силы, умножение очков или усиление карт. Реликвии делятся на ранги редкости: {C:blue}B (Обычные){}, {C:green}A (Необычные){} и {C:red}S (Редкие){}. Чем выше ранг, тем сокрушительнее мощь!',
    },
    devOriginal: {
      title: 'Магазин и Джокеры',
      text: 'Добро пожаловать в магазин! Основа любой сборки — {C:attention}Джокеры{} (до 5 слотов). Каждый Джокер кардинально меняет правила: даёт фишки, множитель или генерирует карты. Они бывают {C:blue}Обычными (B){}, {C:green}Необычными (A){} и {C:red}Редкими (S){}.',
    },
  },
  {
    id: 'relic_order_pro_tip',
    phase: 'shop',
    targetSelector: '.belt--inventory .inventory-strip:first-child',
    arrowPosition: 'top',
    emotion: 'warning',
    requireAction: 'next',
    standard: {
      title: 'Секрет порядка: Слева направо!',
      text: '{C:warning}САМЫЙ ВАЖНЫЙ ТАКТИЧЕСКИЙ СЕКРЕТ:{} Реликвии срабатывают строго {C:attention}слева направо{}! Располагай Реликвии с плоской Силой (+Сила) и плоским Множителем (+Множитель) {C:blue}СЛЕВА{}, а умножающие Реликвии (×Множитель) ставь {C:red}СПРАВА{}! Сравни: (10 + 10) × 3 = {C:attention}60{}, а (10 × 3) + 10 = всего лишь {C:red}40{}! Ты можешь перетаскивать Реликвии в любое время.',
    },
    devOriginal: {
      title: 'Порядок Джокеров: Слева направо!',
      text: '{C:warning}ГЛАВНЫЙ СЕКРЕТ ИГРЫ:{} Джокеры активируются строго {C:attention}слева направо{}! Всегда ставь Джокеров на плоские фишки (+Фишки) и плоский множ (+Множ) {C:blue}СЛЕВА{}, а перемножающие (×Множ) {C:red}СТРОГО СПРАВА{}! Сравни: (10 + 10) × 3 = {C:attention}60{}, а (10 × 3) + 10 = всего {C:red}40{}! Ты можешь свободно перетаскивать их мышкой или пальцем.',
    },
  },
  {
    id: 'consumables_overview',
    phase: 'shop',
    targetSelector: '.belt--inventory .inventory-strip:nth-child(2)',
    arrowPosition: 'top',
    emotion: 'thinking',
    requireAction: 'next',
    standard: {
      title: 'Расходники: Фолианты, Свитки, Пандора',
      text: 'В поясе инвентаря есть 2 слота под одноразовые {C:attention}Расходники{}:\n• {C:planet}Фолианты{}: навсегда повышают базовые очки конкретной комбинации!\n• {C:tarot}Свитки Кузни{}: зачаровывают карты в руке (делают их стальными, золотыми или хрустальными).\n• {C:spectral}Свитки Пандоры{}: редчайшие рискованные заклинания, меняющие всю колоду или реликвии.',
    },
    devOriginal: {
      title: 'Расходники: Таро, Планеты, Спектралки',
      text: 'В инвентаре есть 2 слота под {C:attention}Расходники{}:\n• {C:planet}Планеты{}: навсегда повышают уровень и базовые очки выбранной покерной руки!\n• {C:tarot}Карты Таро{}: улучшают карты в руке (бонусные, стальные, золотые, стеклянные свойства).\n• {C:spectral}Спектральные карты{}: опасные и невероятно сильные эффекты, меняющие всю колоду.',
    },
  },
  {
    id: 'vouchers_privileges',
    phase: 'shop',
    targetSelector: '.shop-bottom-grid .shop-row:first-child',
    arrowPosition: 'bottom',
    emotion: 'neutral',
    requireAction: 'next',
    standard: {
      title: 'Грамоты Гильдии (Привилегии)',
      text: 'В нижней витрине продаётся {C:attention}Грамота (Привилегия){}. Это постоянное пассивное свойство на всю экспедицию: +1 карта в руке, дополнительные сбросы, скидки или повышенный лимит процентов! Новая Грамота появляется один раз за Этап — сразу после победы над Боссом.',
    },
    devOriginal: {
      title: 'Ваучеры',
      text: 'Внизу витрины продаётся {C:attention}Ваучер{}. Это постоянное пассивное улучшение на весь забег: увеличение размера руки, дополнительные сбросы или скидки. Ассортимент ваучеров обновляется после победы над каждым Босс-блайндом.',
    },
  },
  {
    id: 'action_buy_shop_item',
    phase: 'shop',
    targetSelector: '.shop-offers-grid .shop-slot-btn:first-child',
    arrowPosition: 'top',
    emotion: 'neutral',
    requireAction: 'buy_relic',
    standard: {
      title: 'Покупка в Лавке',
      text: 'Нажми на товар на витрине, чтобы открыть окно инспекции и нажать {C:gold}«Купить»{}. Если не хватает места или золота — любую ненужную Реликвию или Расходник из инвентаря можно продать за полцены!',
    },
    devOriginal: {
      title: 'Купи карту!',
      text: 'Коснись карты на полке магазина, чтобы прочитать описание и нажать {C:gold}«Купить»{}. Если не хватает места или денег — любую карту из инвентаря можно продать за полцены!',
    },
  },
  {
    id: 'combat_consumables_usage',
    phase: 'shop',
    targetSelector: '.belt--inventory .inventory-strip:nth-child(2)',
    arrowPosition: 'top',
    emotion: 'happy',
    requireAction: 'next',
    standard: {
      title: 'Использование расходников в бою',
      text: 'Полезные свитки можно приберечь! Использовать расходники разрешено не только в Лавке, но и прямо посреди боя. Например, для Свитка Кузни выбери до 2 карт в руке, нажми на Свиток в верхнем поясе и кликни {C:attention}«Использовать»{} — карты мгновенно получат новые зачарования!',
    },
    devOriginal: {
      title: 'Применение расходников',
      text: 'Прибереги сильные карты на потом! Использовать расходники можно прямо во время сражения. Выдели нужные карты в руке, нажми на карту Таро в верхнем слоте и выбери {C:attention}«Использовать»{} — карты мгновенно усилятся!',
    },
  },
  {
    id: 'reroll_and_next_round',
    phase: 'shop',
    targetSelector: '.shop-next-btn',
    arrowPosition: 'top',
    emotion: 'neutral',
    requireAction: 'leave_shop',
    standard: {
      title: 'Обновление и Следующий раунд',
      text: 'Если на полке нет подходящих товаров, можно {C:attention}обновить ассортимент Лавки{} за золото (каждый повторный поиск в раунде дороже на $1). А когда закончишь подготовку, нажми зелёную кнопку {C:blue}«Следующий раунд»{}!',
    },
    devOriginal: {
      title: 'Реролл и следующий раунд',
      text: 'Если в магазине нет нужных карт, жми кнопку {C:attention}«Обновить»{} за доллары. А когда закончишь покупки, жми {C:blue}«Следующий раунд»{}, чтобы перейти к новому блайнду!',
    },
  },
  {
    id: 'tutorial_conclusion',
    phase: 'shop',
    arrowPosition: 'none',
    emotion: 'happy',
    requireAction: 'next',
    standard: {
      title: 'Ты готов к экспедиции!',
      text: 'Превосходно! Теперь ты знаешь основы карточной математики, экономии золота и построения могущественных синергий. Исследуй подземелье, экспериментируй с Реликвиями и приведи Гильдию к триумфу на 8-м Этапе! Обучение всегда можно перечитать в Настройках. Удачи!',
    },
    devOriginal: {
      title: 'Ты готов побеждать!',
      text: 'Отлично! Теперь ты знаешь всё необходимое: формулу очков, управление экономикой и порядок джокеров. Экспериментируй со сборками и одолей 8-е Анте! Ты всегда можешь перезапустить обучение в Меню настроек. Удачи в забеге!',
    },
  },
];

/**
 * Преобразует сырое определение шага в готовый TutorialStep в зависимости от режима оригинальных терминов.
 */
function resolveStep(def: RawTutorialStepDefinition, devOriginal: boolean): TutorialStep {
  const content = devOriginal ? def.devOriginal : def.standard;
  const speaker: TutorialSpeaker = devOriginal ? 'Джимбо' : 'Мира';

  return {
    id: def.id,
    title: content.title,
    text: content.text,
    phase: def.phase,
    ...(def.targetSelector ? { targetSelector: def.targetSelector } : {}),
    arrowPosition: def.arrowPosition,
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
