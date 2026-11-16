import type { I18nLang, LocaleDictionary } from './types';

/**
 * Рекурсивный частичный оверлей над словарём локализации с сохранением структуры ключей.
 */
export type DeepPartial<T> = {
  readonly [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * Тип частичного DEV-оверлея поверх стандартного словаря LocaleDictionary.
 */
export type DevLocaleOverlay = DeepPartial<LocaleDictionary>;

/**
 * Полный DEV-словарь оригинальных терминов Balatro (Джокеры, Таро, Планеты, Спектральные карты,
 * Ваучеры, Теги, Блайнды, Покерные комбинации, Анте, Колоды, Джимбо).
 *
 * Модуль не содержит побочных эффектов верхнего уровня и предназначен строго для подключения
 * под `if (import.meta.env.DEV)`, чтобы Vite полностью вырезал его из production-сборки.
 */
export const DEV_ORIGINAL_OVERLAYS: Readonly<Record<I18nLang, DevLocaleOverlay>> = {
  ru: {
    ui: {
      app: {
        subtitle: 'Balatro DEV — Оригинальная терминология (Джимбо)',
      },
      collection: {
        title: 'Коллекция',
        relics: 'Джокеры',
        decks: 'Колоды',
        vouchers: 'Ваучеры',
        consumablesGroup: 'РАСХОДУЕМОЕ',
        scrolls: 'Карты Таро',
        celestials: 'Карты планет',
        runes: 'Спектральные карты',
        enhancements: 'Улучшенные карты',
        seals: 'Печати',
        editions: 'Выпуски',
        packs: 'Бустерные наборы',
        tags: 'Теги',
        blinds: 'Блайнды',
        anteBaseTitle: 'АНТЕ',
        baseScoreTitle: 'БАЗА',
      },
      hud: {
        stage: 'Анте {ante}',
        stageWithMax: 'Анте {ante}/{maxAnte}',
        endlessStage: 'Бесконечное Анте {ante}',
        layout: 'Комбинация',
        power: 'Фишки',
        powerShort: 'Фиш.',
        gold: 'Деньги',
        goldAmount: '${dollars}',
        relics: 'Джокеры',
        activeTags: 'Теги',
        royalFlush: 'Флеш-рояль',
        shopBannerTitle: 'МАГАЗИН',
        blindSelectBadge: 'Выбор блайнда',
      },
      actions: {
        handReference: 'Комбинации',
        runInfo: 'Партия\nДетали',
        sell: 'Продать за ${dollars}',
        buy: 'Купить (${dollars})',
        openPack: 'Открыть (${dollars})',
        rerollBoss: 'Сменить Босса (${dollars})',
        claimCashout: 'Забрать ${dollars}',
        rerollShop: 'Обновить (${dollars})',
      },
      blindSelect: {
        title: 'Блайнды Анте {ante}',
        chooseNextPrompt: 'Выберите ваш следующий блайнд',
        reward: 'Награда: ${dollars}',
        skipButton: 'Пропустить блайнд',
        showdownBadge: 'Финальный блайнд',
        cannotSkipBoss: 'Босс-блайнд нельзя пропустить',
        advanceStageTitle: 'Повысить анте',
        advanceStageDesc: 'Поднять все блайнды и обновить их',
      },
      cashout: {
        title: 'Блайнд побеждён!',
        guardianReward: 'Награда за блайнд',
        interest: 'Проценты ($1 за каждые $5)',
        relicBonus: 'Бонус Джокеров',
        tagBonus: 'Бонус Тегов',
      },
      shop: {
        title: 'Лавка Джимбо',
        charterTitle: 'Ваучер',
        charterEmpty: 'Ваучер этого Анте уже куплен',
      },
      stats: {
        highestStage: 'Наивысшее Анте',
        mostPlayedHand: 'Частая комбинация',
        maxGold: 'Максимум денег',
      },
      credits: {
        settingLine:
          'Сеттинг: Оригинальный словарь Balatro (DEV: Джимбо, Джокеры, Таро, Планеты, Спектральные карты, Ваучеры, Теги, Блайнды, Анте)',
      },
      handReference: {
        title: 'Покерные комбинации',
        baseFormula: '{chips} Фиш. × {mult} Множ',
        hiddenLayout: 'Секретная комбинация',
      },
      runInfo: {
        title: 'Детали партии',
        tabs: {
          hands: 'Покерные руки',
          blinds: 'Блайнды',
          vouchers: 'Ваучеры',
        },
        blinds: {
          defeated: 'Побежден',
          current: 'Текущее',
          upcoming: 'Следующее',
          skipped: 'Пропущен',
          minScore: 'Минимум очков',
          reward: 'Награда: ${dollars}+',
          skipReward: 'Пропустить награду',
          bossCannotSkip: 'Босса нельзя пропустить',
        },
        vouchers: {
          empty: 'В этой партии не были выкуплены ваучеры',
          title: 'Ваучеры, выкупленные в этой партии',
        },
        backButton: 'Назад',
        handRules: {
          'High Card':
            'Если сыгранная рука не является одной из вышеуказанных рук, считается только карта с наибольшим достоинством',
          Pair: '2 карты одного достоинства. Они могут быть сыграны с максимум 3 неподсчитанными картами',
          'Two Pair': '2 пары карт разного достоинства. Они могут быть сыграны с 1 неподсчитанной картой',
          'Three of a Kind':
            '3 карты одного достоинства. Они могут быть сыграны с 2 неподсчитанными картами',
          Straight: '5 карт по порядку подряд',
          Flush: '5 карт одной масти',
          'Full House': 'Сет и пара',
          'Four of a Kind':
            '4 карты одного достоинства. Они могут быть сыграны с 1 неподсчитанной картой',
          'Straight Flush': '5 карт по порядку одной масти',
          'Five of a Kind': '5 карт одного достоинства',
          'Flush House': 'Сет и пара одной масти',
          'Flush Five': '5 карт одного достоинства и одной масти',
        },
      },
      runEnd: {
        victorySubtitle: 'Все 8 Анте успешно пройдены!',
        defeatSubtitle: 'Порог Блайнда не достигнут',
        bestHandScore: 'Лучшая рука',
        dollarsSpent: 'Потрачено денег',
        finalStage: 'Достигнутое Анте',
        mostPlayedHand: 'Частая комбинация',
        defeatedBy: 'Побеждён блайндом:',
        clearedGuardian: 'Побеждён блайнд:',
      },
    },
    hands: {
      'Flush Five': {
        name: 'Флеш-пять',
        description: '5 карт одного достоинства и одной масти',
      },
      'Flush House': {
        name: 'Флеш-хаус',
        description: 'Сет и пара одной масти',
      },
      'Five of a Kind': {
        name: 'Пять одного вида',
        description: '5 карт одного достоинства',
      },
      'Straight Flush': {
        name: 'Стрит-флеш',
        description: '5 карт по порядку одной масти',
      },
      'Four of a Kind': {
        name: 'Каре',
        description: '4 карты одного достоинства',
      },
      'Full House': {
        name: 'Фулл-хаус',
        description: 'Сет и пара',
      },
      Flush: {
        name: 'Флеш',
        description: '5 карт одной масти',
      },
      Straight: {
        name: 'Стрит',
        description: '5 карт по порядку подряд',
      },
      'Three of a Kind': {
        name: 'Сет',
        description: '3 карты одного достоинства',
      },
      'Two Pair': {
        name: 'Две пары',
        description: '2 пары карт разного достоинства',
      },
      Pair: {
        name: 'Пара',
        description: '2 карты одного достоинства',
      },
      'High Card': {
        name: 'Старшая карта',
        description: 'Если не собрана ни одна комбинация, играет старшая карта',
      },
    },
    relics: {
      j_joker: {
        name: 'Джокер',
        description: '+{mult} множ.',
      },
      j_greedy_joker: {
        name: 'Жадный джокер',
        description: 'Сыгранные карты бубновой масти дают +{mult} множ. при подсчёте',
      },
      j_lusty_joker: {
        name: 'Похотливый джокер',
        description: 'Сыгранные карты червовой масти дают +{mult} множ. при подсчёте',
      },
      j_wrathful_joker: {
        name: 'Гневный джокер',
        description: 'Сыгранные карты пиковой масти дают +{mult} множ. при подсчёте',
      },
      j_gluttenous_joker: {
        name: 'Прожорливый джокер',
        description: 'Сыгранные карты трефовой масти дают +{mult} множ. при подсчёте',
      },
      j_jolly: {
        name: 'Веселый джокер',
        description: '+{mult} множ., если сыгранная рука содержит Пару',
      },
      j_sly: {
        name: 'Хитрый джокер',
        description: '+{chips} шт. фишек, если сыгранная рука содержит Пару',
      },
      j_half: {
        name: 'Полуджокер',
        description: '+{mult} множ., если сыгранная рука содержит {maxCards} или менее карт',
      },
      j_abstract: {
        name: 'Абстрактный джокер',
        description: '+{multPerRelic} множ. за каждого Джокера (сейчас: +{mult})',
      },
      j_banner: {
        name: 'Баннер',
        description: '+{chipsPerDiscard} шт. фишек за каждый оставшийся сброс',
      },
      j_mystic_summit: {
        name: 'Мистическая вершина',
        description: '+{mult} множ. при {discards} оставшихся сбросах',
      },
      j_scary_face: {
        name: 'Жуткое лицо',
        description: 'Сыгранные карты с лицом (В, Д, К) дают +{chips} шт. фишек при подсчёте',
      },
      j_even_steven: {
        name: 'Все че(с)тно',
        description: 'Сыгранные чётные карты (10, 8, 6, 4, 2) дают +{mult} множ. при подсчёте',
      },
      j_odd_todd: {
        name: 'Нече(с)тные правила',
        description: 'Сыгранные нечётные карты (Т, 9, 7, 5, 3) дают +{chips} шт. фишек при подсчёте',
      },
      j_runner: {
        name: 'Бегун',
        description: 'Даёт +{chipsStep} шт. фишек, если сыгранная рука содержит Стрит (сейчас: +{chips})',
      },
      j_green_joker: {
        name: 'Зеленый джокер',
        description: '+{multGain} множ. за сыгранную руку, -{multLoss} множ. за сброс (сейчас: +{mult})',
      },
      j_photograph: {
        name: 'Фотография',
        description: 'Первая сыгранная карта с лицом даёт ×{xMult} множ. при подсчёте',
      },
      j_golden: {
        name: 'Золотой джокер',
        description: 'Получайте ${dollars} в конце каждого раунда',
      },
      j_flash: {
        name: 'Флеш-карта',
        description: 'Этот джокер даёт +{multStep} множ. за каждый переброс в лавке (сейчас: +{mult})',
      },
      j_trousers: {
        name: 'Запасные брюки',
        description: 'Этот джокер даёт +{multStep} множ., если сыгранная рука содержит Две пары (сейчас: +{mult})',
      },
      j_ceremonial: {
        name: 'Церемониальный кинжал',
        description:
          'При выборе блайнда уничтожает джокера справа и добавляет удвоенную цену продажи к множ. (сейчас: +{mult})',
      },
      j_blackboard: {
        name: 'Школьная доска',
        description: '×{xMult} множ., если все карты, оставшиеся в руке, — Пики или Трефы',
      },
      j_card_sharp: {
        name: 'Острая карта',
        description: '×{xMult} множ., если сыгранная покерная комбинация уже игралась в этом раунде',
      },
      j_acrobat: {
        name: 'Акробат',
        description: '×{xMult} множ. на последней руке раунда',
      },
      j_constellation: {
        name: 'Созвездие',
        description:
          'Этот джокер даёт +×{xMultStep} множ. каждый раз при использовании карты Планеты (сейчас: ×{xMult})',
      },
      j_hologram: {
        name: 'Голограмма',
        description:
          'Этот джокер даёт +×{xMultStep} множ. каждый раз при добавлении игральной карты в колоду (сейчас: ×{xMult})',
      },
      j_vampire: {
        name: 'Вампир',
        description:
          'Этот джокер даёт +×{xMultStep} множ. за каждую сыгранную улучшенную карту и снимает улучшение (сейчас: ×{xMult})',
      },
      j_ramen: {
        name: 'Рамен',
        description: '×{xMult} множ., теряет ×{xMultLoss} множ. за каждую сброшенную карту',
      },
      j_stencil: {
        name: 'Трафарет джокера',
        description: '×1 множ. за каждый пустой слот джокера, включая Трафарет (сейчас: ×{xMult})',
      },
      j_sock_and_buskin: {
        name: 'Трагедия и комедия',
        description: 'Перезапуск (+{retriggers} раз) всех сыгранных карт с лицом',
      },
      j_mime: {
        name: 'Мим',
        description: 'Перезапуск (+{retriggers} раз) всех способностей карт, оставшихся в руке',
      },
      j_four_fingers: {
        name: 'Четыре пальца',
        description: 'Все Флеши и Стриты можно собрать из {cardsRequired} карт',
      },
      j_shortcut: {
        name: 'Короткий путь',
        description: 'Позволяет формировать Стриты с пропусками в 1 достоинство (напр. 10 8 6 5 3)',
      },
      j_bull: {
        name: 'Бык',
        description: '+{chipsPerDollar} шт. фишек за каждый $1 у вас на счету (сейчас: +{chips})',
      },
      j_duo: {
        name: 'Дуэт',
        description: '×{xMult} множ., если сыгранная рука содержит Пару',
      },
      j_tribe: {
        name: 'Племя',
        description: '×{xMult} множ., если сыгранная рука содержит Флеш',
      },
      j_baron: {
        name: 'Барон',
        description: 'Каждый Король в руке даёт ×{xMult} множ.',
      },
      j_blueprint: {
        name: 'Чертеж',
        description: 'Копирует способность Джокера справа',
      },
      j_brainstorm: {
        name: 'Мозговой штурм',
        description: 'Копирует способность крайнего левого Джокера',
      },
      j_vagabond: {
        name: 'Бродяга',
        description: 'Создаёт карту Таро, если рука сыграна при наличии ${maxDollars} или меньше',
      },
    },
    celestials: {
      c_mercury: {
        name: 'Меркурий',
        description: '+1 уровень комбинации «Пара» (+{chips} фишек, +{mult} множ.)',
      },
      c_venus: {
        name: 'Венера',
        description: '+1 уровень комбинации «Сет» (+{chips} фишек, +{mult} множ.)',
      },
      c_earth: {
        name: 'Земля',
        description: '+1 уровень комбинации «Фулл-хаус» (+{chips} фишек, +{mult} множ.)',
      },
      c_mars: {
        name: 'Марс',
        description: '+1 уровень комбинации «Каре» (+{chips} фишек, +{mult} множ.)',
      },
      c_jupiter: {
        name: 'Юпитер',
        description: '+1 уровень комбинации «Флеш» (+{chips} фишек, +{mult} множ.)',
      },
      c_saturn: {
        name: 'Сатурн',
        description: '+1 уровень комбинации «Стрит» (+{chips} фишек, +{mult} множ.)',
      },
      c_uranus: {
        name: 'Уран',
        description: '+1 уровень комбинации «Две пары» (+{chips} фишек, +{mult} множ.)',
      },
      c_neptune: {
        name: 'Нептун',
        description: '+1 уровень комбинации «Стрит-флеш» (+{chips} фишек, +{mult} множ.)',
      },
      c_pluto: {
        name: 'Плутон',
        description: '+1 уровень комбинации «Старшая карта» (+{chips} фишек, +{mult} множ.)',
      },
      c_planet_x: {
        name: 'Планета X',
        description: '+1 уровень комбинации «Пять одного вида» (+{chips} фишек, +{mult} множ.)',
      },
      c_ceres: {
        name: 'Церера',
        description: '+1 уровень комбинации «Флеш-хаус» (+{chips} фишек, +{mult} множ.)',
      },
      c_eris: {
        name: 'Эрида',
        description: '+1 уровень комбинации «Флеш-пять» (+{chips} фишек, +{mult} множ.)',
      },
    },
    scrolls: {
      c_fool: {
        name: 'Дурак',
        description: 'Создаёт последнюю карту Таро или Планеты, использованную в этом забеге',
      },
      c_magician: {
        name: 'Волшебник',
        description: 'Улучшает до {count} выбранных карт до Счастливых карт',
      },
      c_empress: {
        name: 'Императрица',
        description: 'Улучшает до {count} выбранных карт до Карт множителя',
      },
      c_heirophant: {
        name: 'Иерофант',
        description: 'Улучшает до {count} выбранных карт до Бонусных карт',
      },
      c_lovers: {
        name: 'Влюбленные',
        description: 'Улучшает {count} выбранную карту до Дикой карты',
      },
      c_chariot: {
        name: 'Колесница',
        description: 'Улучшает {count} выбранную карту до Стальной карты',
      },
      c_justice: {
        name: 'Правосудие',
        description: 'Улучшает {count} выбранную карту до Стеклянной карты',
      },
      c_devil: {
        name: 'Дьявол',
        description: 'Улучшает {count} выбранную карту до Золотой карты',
      },
      c_tower: {
        name: 'Башня',
        description: 'Улучшает {count} выбранную карту до Каменной карты',
      },
      c_hermit: {
        name: 'Отшельник',
        description: 'Удваивает деньги (макс. +${maxDollars})',
      },
      c_temperance: {
        name: 'Умеренность',
        description: 'Даёт общую цену продажи всех ваших Джокеров (макс. +${maxDollars})',
      },
      c_wheel_of_fortune: {
        name: 'Колесо Фортуны',
        description: 'Шанс 1 из {odds} добавить Фольговый, Голографический или Полихромный эффект случайному Джокеру',
      },
      c_strength: {
        name: 'Сила',
        description: 'Увеличивает достоинство до {count} выбранных карт на +1 (Т -> 2)',
      },
      c_hanged_man: {
        name: 'Висельник',
        description: 'Уничтожает до {count} выбранных карт',
      },
      c_death: {
        name: 'Смерть',
        description: 'Выберите {count} карты: преобразуйте левую карту в правую карту',
      },
      c_judgement: {
        name: 'Суд',
        description: 'Создаёт случайную карту Джокера (если есть место)',
      },
    },
    runes: {
      c_talisman: {
        name: 'Талисман',
        description: 'Добавляет Золотую печать к {count} выбранной карте в руке',
      },
      c_deja_vu: {
        name: 'Дежавю',
        description: 'Добавляет Красную печать к {count} выбранной карте в руке',
      },
      c_trance: {
        name: 'Транс',
        description: 'Добавляет Синюю печать к {count} выбранной карте в руке',
      },
      c_medium: {
        name: 'Медиум',
        description: 'Добавляет Фиолетовую печать к {count} выбранной карте в руке',
      },
      c_aura: {
        name: 'Аура',
        description: 'Добавляет Фольговый, Голографический или Полихромный эффект к {count} карте в руке',
      },
      c_cryptid: {
        name: 'Криптид',
        description: 'Создаёт {copies} копии {count} выбранной карты в руке',
      },
      c_immolate: {
        name: 'Жертвоприношение',
        description: 'Уничтожает {destroyCount} случайных карт в руке и даёт +${dollars}',
      },
      c_hex: {
        name: 'Порча',
        description: 'Добавляет Полихромный эффект случайному Джокеру, уничтожая остальных Джокеров',
      },
      c_black_hole: {
        name: 'Черная дыра',
        description: 'Повышает каждую покерную комбинацию на +{levels} уровень',
      },
    },
    charters: {
      v_overstock_norm: {
        name: 'Избыток',
        description: '+{slots} слот карты в лавке',
      },
      v_clearance_sale: {
        name: 'Распродажа',
        description: 'Все карты и наборы в лавке стоят на {percent}% меньше',
      },
      v_hone: {
        name: 'Заточка',
        description: 'Фольговые, Голографические и Полихромные карты появляются в {rate} раза чаще',
      },
      v_reroll_surplus: {
        name: 'Излишек перебросов',
        description: 'Перебросы в лавке стоят на ${dollars} меньше',
      },
      v_crystal_ball: {
        name: 'Хрустальный шар',
        description: '+{slots} слот расходуемого предмета',
      },
      v_grabber: {
        name: 'Хапуга',
        description: 'Навсегда даёт +{hands} руку за каждый раунд',
      },
      v_wasteful: {
        name: 'Транжира',
        description: 'Навсегда даёт +{discards} сброс за каждый раунд',
      },
      v_seed_money: {
        name: 'Подъемные',
        description: 'Поднимает лимит процентов, получаемых в каждом раунде, до ${cap}',
      },
      v_paint_brush: {
        name: 'Кисть для рисования',
        description: '+{size} размер руки',
      },
      v_telescope: {
        name: 'Телескоп',
        description: 'Небесные наборы всегда содержат карту Планеты для самой играемой покерной комбинации',
      },
      v_observatory: {
        name: 'Обсерватория',
        description: 'Карты Планет в области расходников дают ×{xMult} множ. для своей покерной комбинации',
      },
      v_directors_cut: {
        name: 'Режиссерская версия',
        description: 'Позволяет 1 раз за Анте перебросить Босс-блайнд за ${dollars}',
      },
    },
    tags: {
      tag_uncommon: {
        name: 'Необычный тег',
        description: 'В следующей лавке будет бесплатный необычный Джокер',
      },
      tag_rare: {
        name: 'Редкий тег',
        description: 'В следующей лавке будет бесплатный редкий Джокер',
      },
      tag_investment: {
        name: 'Инвестиционный тег',
        description: 'После победы над Босс-блайндом вы получаете +${dollars}',
      },
      tag_economy: {
        name: 'Экономический тег',
        description: 'Удваивает ваши деньги (макс. +${maxDollars})',
      },
      tag_coupon: {
        name: 'Тег купона',
        description: 'Начальные карты и бустеры в следующей лавке бесплатны',
      },
      tag_d_six: {
        name: 'Тег D6',
        description: 'Перебросы в следующей лавке начинаются с $0',
      },
      tag_double: {
        name: 'Двойной тег',
        description: 'Даёт копию следующего выбранного тега (кроме Двойного тега)',
      },
      tag_juggle: {
        name: 'Жонглерский тег',
        description: '+{size} размер руки в следующем раунде',
      },
      tag_charm: {
        name: 'Тег очарования',
        description: 'Даёт бесплатный Мега-набор аркана',
      },
      tag_skip: {
        name: 'Тег скорости',
        description: 'Даёт по ${dollarsPerSkip} за каждый пропущенный блайнд в этой партии',
      },
    },
    bosses: {
      bl_hook: {
        name: 'Крюк',
        description: 'Сбрасывает по {count} случайные карты за сыгранную руку',
      },
      bl_manacle: {
        name: 'Кандалы',
        description: '-{count} размер руки',
      },
      bl_psychic: {
        name: 'Экстрасенс',
        description: 'Необходимо сыграть ровно {count} карт',
      },
      bl_pillar: {
        name: 'Столп',
        description: 'Ранее сыгранные карты в этом Анте ослаблены',
      },
      bl_club: {
        name: 'Трефа',
        description: 'Все трефовые карты ослаблены',
      },
      bl_water: {
        name: 'Вода',
        description: 'Начинайте с 0 сбросами',
      },
      bl_wall: {
        name: 'Стена',
        description: 'Особо большой блайнд',
      },
      bl_flint: {
        name: 'Кремень',
        description: 'Базовые фишки и множитель делятся пополам',
      },
      bl_final_vessel: {
        name: 'Фиолетовый сосуд',
        description: 'Очень большой блайнд',
      },
      bl_final_bell: {
        name: 'Лазурный колокольчик',
        description: '1 карта принудительно всегда выбрана',
      },
    },
    blinds: {
      small: {
        name: 'Малый блайнд',
        description: 'Можно пропустить ради Тега',
      },
      big: {
        name: 'Большой блайнд',
        description: 'Повышенный порог; можно пропустить ради Тега',
      },
      boss: {
        name: 'Босс-блайнд',
        description: 'Особое испытание Анте',
      },
    },
    decks: {
      b_red: {
        name: 'Красная колода',
        description: '+{discards} сброс в каждом раунде',
      },
      b_blue: {
        name: 'Синяя колода',
        description: '+{hands} рука в каждом раунде',
      },
      b_yellow: {
        name: 'Желтая колода',
        description: 'Начинайте с дополнительными ${dollars}',
      },
      b_black: {
        name: 'Черная колода',
        description: '+{relicSlots} слот джокера, но -{handsLoss} рука в каждом раунде',
      },
    },
    enhancements: {
      none: {
        name: 'Обычная',
        description: 'Без усиления',
      },
      bonus: {
        name: 'Бонусная карта',
        description: '+30 шт. фишек при подсчёте',
      },
      mult: {
        name: 'Карта множителя',
        description: '+4 множ. при подсчёте',
      },
      wild: {
        name: 'Дикая карта',
        description: 'Может использоваться как любая масть',
      },
      glass: {
        name: 'Стеклянная карта',
        description: '×2 множ., но шанс 1 из 4 сломаться',
      },
      steel: {
        name: 'Стальная карта',
        description: '×1.5 множ., пока остаётся в руке',
      },
      stone: {
        name: 'Каменная карта',
        description: '+50 шт. фишек, без достоинства и масти, всегда играет',
      },
      gold: {
        name: 'Золотая карта',
        description: '+$3, если остаётся в руке в конце раунда',
      },
      lucky: {
        name: 'Счастливая карта',
        description: 'Шанс 1 из 5 на +20 множ. и шанс 1 из 15 на +$20',
      },
    },
    editions: {
      base: {
        name: 'База',
        description: 'Без дополнительных эффектов',
      },
      foil: {
        name: 'Фольговый',
        description: '+50 шт. фишек',
      },
      holo: {
        name: 'Голографический',
        description: '+10 множ.',
      },
      polychrome: {
        name: 'Полихромный',
        description: '×1.5 множ.',
      },
      negative: {
        name: 'Негативный',
        description: '+1 слот джокера',
      },
    },
    seals: {
      none: {
        name: 'Без печати',
        description: 'На карте нет печати',
      },
      gold: {
        name: 'Золотая печать',
        description: 'Получите $3, когда эта карта сыграна и засчитана',
      },
      red: {
        name: 'Красная печать',
        description: 'Повторно активирует эту карту 1 раз',
      },
      blue: {
        name: 'Синяя печать',
        description: 'Создаёт карту Планеты для последней сыгранной комбинации, если осталась в руке',
      },
      purple: {
        name: 'Фиолетовая печать',
        description: 'Создаёт карту Таро при сбросе',
      },
    },
    packTypes: {
      arcana: {
        name: 'Набор аркана',
        description: 'Содержит карты Таро для немедленного применения',
      },
      celestial: {
        name: 'Небесный набор',
        description: 'Содержит карты Планет для улучшения комбинаций',
      },
      standard: {
        name: 'Стандартный набор',
        description: 'Содержит игральные карты для добавления в колоду',
      },
      buffoon: {
        name: 'Набор шута',
        description: 'Содержит случайных Джокеров на выбор',
      },
      spectral: {
        name: 'Спектральный набор',
        description: 'Содержит редкие Спектральные карты',
      },
    },
    packs: {
      arcana_normal: 'Набор аркана',
      arcana_jumbo: 'Большой набор аркана',
      arcana_mega: 'Мега-набор аркана',
      celestial_normal: 'Небесный набор',
      celestial_jumbo: 'Большой небесный набор',
      celestial_mega: 'Мега-небесный набор',
      standard_normal: 'Стандартный набор',
      standard_jumbo: 'Большой стандартный набор',
      standard_mega: 'Мега-стандартный набор',
      buffoon_normal: 'Набор шута',
      buffoon_jumbo: 'Большой набор шута',
      buffoon_mega: 'Мега-набор шута',
      spectral_normal: 'Спектральный набор',
      spectral_jumbo: 'Большой спектральный набор',
      spectral_mega: 'Мега-спектральный набор',
    },
    consumableKinds: {
      celestial: 'Планета',
      scroll: 'Таро',
      rune: 'Спектральная',
    },
    trace: {
      card_chips: '+{chips} Фиш.',
      card_dollars: '+${dollars}',
      card_shatter_glass: 'Стекло разбилось!',
      card_shatter_scroll: 'Карта уничтожена',
      card_shatter_rune: 'Уничтожена Спектральной картой',
      hand_card_gold: '+${dollars}',
      hand_card_blue_seal: 'Планета создана!',
      hand_card_purple_seal: 'Таро создано!',
      relic_chips: '+{chips} Фиш.',
      relic_dollars: '+${dollars}',
      relic_destroyed_ceremonial: 'Поглощён Кинжалом',
      relic_destroyed_ramen: 'Рамен съеден!',
      relic_destroyed_hex: 'Уничтожен Порчей!',
      relic_scroll_created: 'Таро создано!',
      consumable_nope: 'Неудача!',
      consumable_all_hands_up: 'Все комбинации +{levels} ур.!',
      hand_debuffed: 'Комбинация не сработает на Блайнде!',
      boss_disabled: 'Способность Босса отключена!',
      boss_hook_discard: 'Крюк сбросил {count} карты',
      boss_flint: 'Фишки и Множ уполовинены!',
      tag_activated: 'Тег сработал: {tagName}',
      tag_copied: 'Тег скопирован: {tagName}',
      tag_fizzled: 'Тег не сработал',
      blind_defeated: 'Блайнд побеждён!',
      run_won: 'Победа на Анте {ante}!',
      run_lost: 'Поражение на Анте {ante}',
    },
  },
  en: {
    ui: {
      app: {
        subtitle: 'Balatro DEV — Original Terms (Jimbo)',
      },
      collection: {
        title: 'Collection',
        relics: 'Jokers',
        decks: 'Decks',
        vouchers: 'Vouchers',
        consumablesGroup: 'CONSUMABLES',
        scrolls: 'Tarot Cards',
        celestials: 'Planet Cards',
        runes: 'Spectral Cards',
        enhancements: 'Enhanced Cards',
        seals: 'Seals',
        editions: 'Editions',
        packs: 'Booster Packs',
        tags: 'Tags',
        blinds: 'Blinds',
        anteBaseTitle: 'ANTE',
        baseScoreTitle: 'BASE',
      },
      hud: {
        stage: 'Ante {ante}',
        stageWithMax: 'Ante {ante}/{maxAnte}',
        endlessStage: 'Endless Ante {ante}',
        layout: 'Poker Hand',
        power: 'Chips',
        powerShort: 'Chips',
        gold: 'Money',
        goldAmount: '${dollars}',
        relics: 'Jokers',
        activeTags: 'Tags',
        royalFlush: 'Royal Flush',
        shopBannerTitle: 'SHOP',
        blindSelectBadge: 'Choose Blind',
      },
      actions: {
        handReference: 'Poker Hands',
        runInfo: 'Run\nInfo',
        sell: 'Sell for ${dollars}',
        buy: 'Buy (${dollars})',
        openPack: 'Open (${dollars})',
        rerollBoss: 'Reroll Boss (${dollars})',
        claimCashout: 'Cash Out: ${dollars}',
        rerollShop: 'Reroll (${dollars})',
      },
      blindSelect: {
        title: 'Ante {ante} Blinds',
        chooseNextPrompt: 'Choose your next Blind',
        reward: 'Reward: ${dollars}',
        skipButton: 'Skip Blind',
        showdownBadge: 'Showdown Blind',
        cannotSkipBoss: 'Boss Blind cannot be skipped',
        advanceStageTitle: 'Up the Ante',
        advanceStageDesc: 'Raise all Blinds, refresh them',
      },
      cashout: {
        title: 'Blind Defeated!',
        guardianReward: 'Blind Reward',
        interest: 'Interest ($1 per $5)',
        relicBonus: 'Joker Bonus',
        tagBonus: 'Tag Bonus',
      },
      shop: {
        title: "Jimbo's Shop",
        charterTitle: 'Voucher',
        charterEmpty: 'Ante Voucher already redeemed',
      },
      stats: {
        highestStage: 'Highest Ante',
        maxGold: 'Most Money',
      },
      credits: {
        settingLine:
          'Setting: Original Balatro Terminology (DEV: Jimbo, Jokers, Tarot, Planets, Spectral, Vouchers, Tags, Blinds, Ante)',
      },
      handReference: {
        title: 'Poker Hands',
        baseFormula: '{chips} Chips × {mult} Mult',
        hiddenLayout: 'Secret Hand',
      },
      runInfo: {
        title: 'Run Info',
        tabs: {
          hands: 'Poker Hands',
          blinds: 'Blinds',
          vouchers: 'Vouchers',
        },
        blinds: {
          defeated: 'Defeated',
          current: 'Current',
          upcoming: 'Upcoming',
          skipped: 'Skipped',
          minScore: 'Score at least',
          reward: 'Reward: ${dollars}+',
          skipReward: 'Skip reward',
          bossCannotSkip: 'Boss cannot be skipped',
        },
        vouchers: {
          empty: 'No vouchers redeemed this run',
          title: 'Vouchers redeemed this run',
        },
        backButton: 'Back',
        handRules: {
          'High Card':
            'If played hand is not any of the above hands, only the highest ranked card scores',
          Pair: '2 cards of the same rank. May be played with up to 3 other unscored cards',
          'Two Pair': '2 pairs of cards of different ranks. May be played with 1 other unscored card',
          'Three of a Kind':
            '3 cards of the same rank. May be played with up to 2 other unscored cards',
          Straight: '5 cards in consecutive sequence',
          Flush: '5 cards of the same suit',
          'Full House': 'A Three of a Kind and a Pair',
          'Four of a Kind': '4 cards of the same rank. May be played with 1 other unscored card',
          'Straight Flush': '5 cards in consecutive sequence of the same suit',
          'Five of a Kind': '5 cards of the same rank',
          'Flush House': 'A Three of a Kind and a Pair of the same suit',
          'Flush Five': '5 cards of the same rank and suit',
        },
      },
      runEnd: {
        victorySubtitle: 'All 8 Antes cleared!',
        defeatSubtitle: 'Blind target score not reached',
        bestHandScore: 'Best Hand',
        dollarsSpent: 'Money Spent',
        finalStage: 'Ante Reached',
        defeatedBy: 'Defeated by:',
        clearedGuardian: 'Defeated Blind:',
      },
    },
    hands: {
      'Flush Five': {
        name: 'Flush Five',
        description: '5 cards with the same rank and suit',
      },
      'Flush House': {
        name: 'Flush House',
        description: 'A Three of a Kind and a Pair with all cards sharing the same suit',
      },
      'Five of a Kind': {
        name: 'Five of a Kind',
        description: '5 cards with the same rank',
      },
      'Straight Flush': {
        name: 'Straight Flush',
        description: '5 cards in a row (consecutive ranks) with all cards sharing the same suit',
      },
      'Four of a Kind': {
        name: 'Four of a Kind',
        description: '4 cards with the same rank',
      },
      'Full House': {
        name: 'Full House',
        description: 'A Three of a Kind and a Pair',
      },
      Flush: {
        name: 'Flush',
        description: '5 cards that share the same suit',
      },
      Straight: {
        name: 'Straight',
        description: '5 cards in a row (consecutive ranks)',
      },
      'Three of a Kind': {
        name: 'Three of a Kind',
        description: '3 cards with the same rank',
      },
      'Two Pair': {
        name: 'Two Pair',
        description: '2 pairs of cards with different ranks',
      },
      Pair: {
        name: 'Pair',
        description: '2 cards that share the same rank',
      },
      'High Card': {
        name: 'High Card',
        description: 'If the played hand is not any of the above hands, only the highest ranked card scores',
      },
    },
    relics: {
      j_joker: {
        name: 'Joker',
        description: '+{mult} Mult',
      },
      j_greedy_joker: {
        name: 'Greedy Joker',
        description: 'Played cards with Diamond suit give +{mult} Mult when scored',
      },
      j_lusty_joker: {
        name: 'Lusty Joker',
        description: 'Played cards with Heart suit give +{mult} Mult when scored',
      },
      j_wrathful_joker: {
        name: 'Wrathful Joker',
        description: 'Played cards with Spade suit give +{mult} Mult when scored',
      },
      j_gluttenous_joker: {
        name: 'Gluttonous Joker',
        description: 'Played cards with Club suit give +{mult} Mult when scored',
      },
      j_jolly: {
        name: 'Jolly Joker',
        description: '+{mult} Mult if played hand contains a Pair',
      },
      j_sly: {
        name: 'Sly Joker',
        description: '+{chips} Chips if played hand contains a Pair',
      },
      j_half: {
        name: 'Half Joker',
        description: '+{mult} Mult if played hand contains {maxCards} or fewer cards',
      },
      j_abstract: {
        name: 'Abstract Joker',
        description: '+{multPerRelic} Mult for each Joker card (Currently +{mult} Mult)',
      },
      j_banner: {
        name: 'Banner',
        description: '+{chipsPerDiscard} Chips for each remaining discard',
      },
      j_mystic_summit: {
        name: 'Mystic Summit',
        description: '+{mult} Mult when {discards} discards remaining',
      },
      j_scary_face: {
        name: 'Scary Face',
        description: 'Played face cards give +{chips} Chips when scored',
      },
      j_even_steven: {
        name: 'Even Steven',
        description: 'Played cards with even rank give +{mult} Mult when scored (10, 8, 6, 4, 2)',
      },
      j_odd_todd: {
        name: 'Odd Todd',
        description: 'Played cards with odd rank give +{chips} Chips when scored (A, 9, 7, 5, 3)',
      },
      j_runner: {
        name: 'Runner',
        description: 'Gains +{chipsStep} Chips if played hand contains a Straight (Currently +{chips} Chips)',
      },
      j_green_joker: {
        name: 'Green Joker',
        description: '+{multGain} Mult per hand played, -{multLoss} Mult per discard (Currently +{mult} Mult)',
      },
      j_photograph: {
        name: 'Photograph',
        description: 'First played face card gives ×{xMult} Mult when scored',
      },
      j_golden: {
        name: 'Golden Joker',
        description: 'Earn ${dollars} at end of round',
      },
      j_flash: {
        name: 'Flash Card',
        description: 'This Joker gains +{multStep} Mult per reroll in the shop (Currently +{mult} Mult)',
      },
      j_trousers: {
        name: 'Spare Trousers',
        description: 'This Joker gains +{multStep} Mult if played hand contains a Two Pair (Currently +{mult} Mult)',
      },
      j_ceremonial: {
        name: 'Ceremonial Dagger',
        description:
          'When Blind is selected, destroy Joker to the right and permanently add double its sell value to Mult (Currently +{mult} Mult)',
      },
      j_blackboard: {
        name: 'Blackboard',
        description: '×{xMult} Mult if all cards held in hand are Spades or Clubs',
      },
      j_card_sharp: {
        name: 'Card Sharp',
        description: '×{xMult} Mult if played Poker Hand has already been played this round',
      },
      j_acrobat: {
        name: 'Acrobat',
        description: '×{xMult} Mult on final hand of round',
      },
      j_constellation: {
        name: 'Constellation',
        description: 'This Joker gains +×{xMultStep} Mult every time a Planet card is used (Currently ×{xMult} Mult)',
      },
      j_hologram: {
        name: 'Hologram',
        description:
          'This Joker gains +×{xMultStep} Mult every time a playing card is added to your deck (Currently ×{xMult} Mult)',
      },
      j_vampire: {
        name: 'Vampire',
        description:
          'This Joker gains +×{xMultStep} Mult per scoring Enhanced card played, removes card Enhancement (Currently ×{xMult} Mult)',
      },
      j_ramen: {
        name: 'Ramen',
        description: '×{xMult} Mult, loses ×{xMultLoss} Mult per card discarded',
      },
      j_stencil: {
        name: 'Joker Stencil',
        description: '×1 Mult for each empty Joker slot, Joker Stencil included (Currently ×{xMult})',
      },
      j_sock_and_buskin: {
        name: 'Sock and Buskin',
        description: 'Retrigger (+{retriggers}) all played face cards',
      },
      j_mime: {
        name: 'Mime',
        description: 'Retrigger (+{retriggers}) all card held in hand abilities',
      },
      j_four_fingers: {
        name: 'Four Fingers',
        description: 'All Flushes and Straights can be made with {cardsRequired} cards',
      },
      j_shortcut: {
        name: 'Shortcut',
        description: 'Allows Straights to be made with gaps of 1 rank (ex: 10 8 6 5 3)',
      },
      j_bull: {
        name: 'Bull',
        description: '+{chipsPerDollar} Chips for each $1 you have (Currently +{chips} Chips)',
      },
      j_duo: {
        name: 'The Duo',
        description: '×{xMult} Mult if played hand contains a Pair',
      },
      j_tribe: {
        name: 'The Tribe',
        description: '×{xMult} Mult if played hand contains a Flush',
      },
      j_baron: {
        name: 'Baron',
        description: 'Each King held in hand gives ×{xMult} Mult',
      },
      j_blueprint: {
        name: 'Blueprint',
        description: 'Copies ability of Joker to the right',
      },
      j_brainstorm: {
        name: 'Brainstorm',
        description: 'Copies the ability of leftmost Joker',
      },
      j_vagabond: {
        name: 'Vagabond',
        description: 'Create a Tarot card if hand is played with ${maxDollars} or less',
      },
    },
    celestials: {
      c_mercury: {
        name: 'Mercury',
        description: 'Level up Pair (+{chips} Chips, +{mult} Mult)',
      },
      c_venus: {
        name: 'Venus',
        description: 'Level up Three of a Kind (+{chips} Chips, +{mult} Mult)',
      },
      c_earth: {
        name: 'Earth',
        description: 'Level up Full House (+{chips} Chips, +{mult} Mult)',
      },
      c_mars: {
        name: 'Mars',
        description: 'Level up Four of a Kind (+{chips} Chips, +{mult} Mult)',
      },
      c_jupiter: {
        name: 'Jupiter',
        description: 'Level up Flush (+{chips} Chips, +{mult} Mult)',
      },
      c_saturn: {
        name: 'Saturn',
        description: 'Level up Straight (+{chips} Chips, +{mult} Mult)',
      },
      c_uranus: {
        name: 'Uranus',
        description: 'Level up Two Pair (+{chips} Chips, +{mult} Mult)',
      },
      c_neptune: {
        name: 'Neptune',
        description: 'Level up Straight Flush (+{chips} Chips, +{mult} Mult)',
      },
      c_pluto: {
        name: 'Pluto',
        description: 'Level up High Card (+{chips} Chips, +{mult} Mult)',
      },
      c_planet_x: {
        name: 'Planet X',
        description: 'Level up Five of a Kind (+{chips} Chips, +{mult} Mult)',
      },
      c_ceres: {
        name: 'Ceres',
        description: 'Level up Flush House (+{chips} Chips, +{mult} Mult)',
      },
      c_eris: {
        name: 'Eris',
        description: 'Level up Flush Five (+{chips} Chips, +{mult} Mult)',
      },
    },
    scrolls: {
      c_fool: {
        name: 'The Fool',
        description: 'Creates the last Tarot or Planet card used during this run',
      },
      c_magician: {
        name: 'The Magician',
        description: 'Enhances {count} selected cards to Lucky Cards',
      },
      c_empress: {
        name: 'The Empress',
        description: 'Enhances {count} selected cards to Mult Cards',
      },
      c_heirophant: {
        name: 'The Hierophant',
        description: 'Enhances {count} selected cards to Bonus Cards',
      },
      c_lovers: {
        name: 'The Lovers',
        description: 'Enhances {count} selected card into a Wild Card',
      },
      c_chariot: {
        name: 'The Chariot',
        description: 'Enhances {count} selected card into a Steel Card',
      },
      c_justice: {
        name: 'Justice',
        description: 'Enhances {count} selected card into a Glass Card',
      },
      c_devil: {
        name: 'The Devil',
        description: 'Enhances {count} selected card into a Gold Card',
      },
      c_tower: {
        name: 'The Tower',
        description: 'Enhances {count} selected card into a Stone Card',
      },
      c_hermit: {
        name: 'The Hermit',
        description: 'Doubles money (Max of +${maxDollars})',
      },
      c_temperance: {
        name: 'Temperance',
        description: 'Gives the total sell value of all current Jokers (Max of +${maxDollars})',
      },
      c_wheel_of_fortune: {
        name: 'The Wheel of Fortune',
        description: '1 in {odds} chance to add Foil, Holographic, or Polychrome edition to a random Joker',
      },
      c_strength: {
        name: 'Strength',
        description: 'Increases rank of up to {count} selected cards by 1 (A -> 2)',
      },
      c_hanged_man: {
        name: 'The Hanged Man',
        description: 'Destroys up to {count} selected cards',
      },
      c_death: {
        name: 'Death',
        description: 'Select {count} cards, convert the left card into the right card',
      },
      c_judgement: {
        name: 'Judgement',
        description: 'Creates a random Joker card (Must have room)',
      },
    },
    runes: {
      c_talisman: {
        name: 'Talisman',
        description: 'Add a Gold Seal to {count} selected card in your hand',
      },
      c_deja_vu: {
        name: 'Deja Vu',
        description: 'Add a Red Seal to {count} selected card in your hand',
      },
      c_trance: {
        name: 'Trance',
        description: 'Add a Blue Seal to {count} selected card in your hand',
      },
      c_medium: {
        name: 'Medium',
        description: 'Add a Purple Seal to {count} selected card in your hand',
      },
      c_aura: {
        name: 'Aura',
        description: 'Add Foil, Holographic, or Polychrome effect to {count} selected card in hand',
      },
      c_cryptid: {
        name: 'Cryptid',
        description: 'Create {copies} copies of {count} selected card in your hand',
      },
      c_immolate: {
        name: 'Immolate',
        description: 'Destroys {destroyCount} random cards in hand, gain +${dollars}',
      },
      c_hex: {
        name: 'Hex',
        description: 'Add Polychrome to a random Joker, destroy all other Jokers',
      },
      c_black_hole: {
        name: 'Black Hole',
        description: 'Upgrade every poker hand by +{levels} level',
      },
    },
    charters: {
      v_overstock_norm: {
        name: 'Overstock',
        description: '+{slots} card slot available in shop',
      },
      v_clearance_sale: {
        name: 'Clearance Sale',
        description: 'All cards and packs in shop are {percent}% off',
      },
      v_hone: {
        name: 'Hone',
        description: 'Foil, Holographic, and Polychrome cards appear {rate}X more often',
      },
      v_reroll_surplus: {
        name: 'Reroll Surplus',
        description: 'Rerolls cost ${dollars} less',
      },
      v_crystal_ball: {
        name: 'Crystal Ball',
        description: '+{slots} consumable slot',
      },
      v_grabber: {
        name: 'Grabber',
        description: 'Permanently gain +{hands} hand per round',
      },
      v_wasteful: {
        name: 'Wasteful',
        description: 'Permanently gain +{discards} discard each round',
      },
      v_seed_money: {
        name: 'Seed Money',
        description: 'Raise the cap on interest earned in each round to ${cap}',
      },
      v_paint_brush: {
        name: 'Paint Brush',
        description: '+{size} hand size',
      },
      v_telescope: {
        name: 'Telescope',
        description: 'Celestial Packs always contain the Planet card for your most played poker hand',
      },
      v_observatory: {
        name: 'Observatory',
        description: 'Planet cards in your consumable area give ×{xMult} Mult for their specified poker hand',
      },
      v_directors_cut: {
        name: "Director's Cut",
        description: 'Reroll Boss Blind 1 time per Ante, ${dollars} per roll',
      },
    },
    tags: {
      tag_uncommon: {
        name: 'Uncommon Tag',
        description: 'Shop has a free Uncommon Joker',
      },
      tag_rare: {
        name: 'Rare Tag',
        description: 'Shop has a free Rare Joker',
      },
      tag_investment: {
        name: 'Investment Tag',
        description: 'After defeating the Boss Blind, gain +${dollars}',
      },
      tag_economy: {
        name: 'Economy Tag',
        description: 'Doubles your money (Max of +${maxDollars})',
      },
      tag_coupon: {
        name: 'Coupon Tag',
        description: 'Initial cards and booster packs in next shop are free',
      },
      tag_d_six: {
        name: 'D6 Tag',
        description: 'Rerolls in next shop start at $0',
      },
      tag_double: {
        name: 'Double Tag',
        description: 'Gives a copy of the next selected Tag (Double Tag excluded)',
      },
      tag_juggle: {
        name: 'Juggle Tag',
        description: '+{size} hand size next round',
      },
      tag_charm: {
        name: 'Charm Tag',
        description: 'Gives a free Mega Arcana Pack',
      },
      tag_skip: {
        name: 'Speed Tag',
        description: 'Gives ${dollarsPerSkip} per skipped Blind this run',
      },
    },
    bosses: {
      bl_hook: {
        name: 'The Hook',
        description: 'Discards {count} random cards per hand played',
      },
      bl_manacle: {
        name: 'The Manacle',
        description: '-{count} Hand Size',
      },
      bl_psychic: {
        name: 'The Psychic',
        description: 'Must play {count} cards',
      },
      bl_pillar: {
        name: 'The Pillar',
        description: 'Cards played previously this Ante are debuffed',
      },
      bl_club: {
        name: 'The Club',
        description: 'All Club cards are debuffed',
      },
      bl_water: {
        name: 'The Water',
        description: 'Start with 0 discards',
      },
      bl_wall: {
        name: 'The Wall',
        description: 'Extra large blind',
      },
      bl_flint: {
        name: 'The Flint',
        description: 'Base Chips and Mult are halved',
      },
      bl_final_vessel: {
        name: 'Violet Vessel',
        description: 'Very large blind',
      },
      bl_final_bell: {
        name: 'Cerulean Bell',
        description: 'Forces 1 card to always be selected',
      },
    },
    blinds: {
      small: {
        name: 'Small Blind',
        description: 'Can be skipped for a Tag',
      },
      big: {
        name: 'Big Blind',
        description: 'Higher score requirement; can be skipped for a Tag',
      },
      boss: {
        name: 'Boss Blind',
        description: 'Ante showdown Blind',
      },
    },
    decks: {
      b_red: {
        name: 'Red Deck',
        description: '+{discards} discard every round',
      },
      b_blue: {
        name: 'Blue Deck',
        description: '+{hands} hand every round',
      },
      b_yellow: {
        name: 'Yellow Deck',
        description: 'Start with extra ${dollars}',
      },
      b_black: {
        name: 'Black Deck',
        description: '+{relicSlots} Joker slot, -{handsLoss} hand every round',
      },
    },
    enhancements: {
      none: {
        name: 'Base',
        description: 'No enhancement',
      },
      bonus: {
        name: 'Bonus Card',
        description: '+30 Chips',
      },
      mult: {
        name: 'Mult Card',
        description: '+4 Mult',
      },
      wild: {
        name: 'Wild Card',
        description: 'Can be used as any suit',
      },
      glass: {
        name: 'Glass Card',
        description: '×2 Mult, 1 in 4 chance to destroy card',
      },
      steel: {
        name: 'Steel Card',
        description: '×1.5 Mult while this card stays in hand',
      },
      stone: {
        name: 'Stone Card',
        description: '+50 Chips, no rank or suit, always scores',
      },
      gold: {
        name: 'Gold Card',
        description: '$3 if this card is held in hand at end of round',
      },
      lucky: {
        name: 'Lucky Card',
        description: '1 in 5 chance for +20 Mult, 1 in 15 chance to win $20',
      },
    },
    editions: {
      negative: {
        name: 'Negative',
        description: '+1 Joker slot',
      },
      foil: {
        name: 'Foil',
        description: '+50 Chips',
      },
    },
    seals: {
      gold: {
        name: 'Gold Seal',
        description: 'Earn $3 when this card is played and scores',
      },
      red: {
        name: 'Red Seal',
        description: 'Retrigger this card 1 time',
      },
      blue: {
        name: 'Blue Seal',
        description: 'Creates the Planet card for final played poker hand if held in hand at end of round',
      },
      purple: {
        name: 'Purple Seal',
        description: 'Creates a Tarot card when discarded',
      },
    },
    packTypes: {
      arcana: {
        name: 'Arcana Pack',
        description: 'Choose Tarot cards to be used immediately',
      },
      celestial: {
        name: 'Celestial Pack',
        description: 'Choose Planet cards to upgrade poker hands',
      },
      buffoon: {
        name: 'Buffoon Pack',
        description: 'Choose Joker cards',
      },
      spectral: {
        name: 'Spectral Pack',
        description: 'Choose Spectral cards to be used immediately',
      },
    },
    packs: {
      arcana_normal: 'Arcana Pack',
      arcana_jumbo: 'Jumbo Arcana Pack',
      arcana_mega: 'Mega Arcana Pack',
      buffoon_normal: 'Buffoon Pack',
      buffoon_jumbo: 'Jumbo Buffoon Pack',
      buffoon_mega: 'Mega Buffoon Pack',
      spectral_normal: 'Spectral Pack',
      spectral_jumbo: 'Jumbo Spectral Pack',
      spectral_mega: 'Mega Spectral Pack',
    },
    consumableKinds: {
      celestial: 'Planet',
      scroll: 'Tarot',
      rune: 'Spectral',
    },
    trace: {
      card_chips: '+{chips} Chips',
      card_dollars: '+${dollars}',
      card_shatter_glass: 'Glass shattered!',
      card_shatter_scroll: 'Card destroyed',
      card_shatter_rune: 'Destroyed by Spectral',
      hand_card_gold: '+${dollars}',
      hand_card_blue_seal: 'Planet created!',
      hand_card_purple_seal: 'Tarot created!',
      relic_chips: '+{chips} Chips',
      relic_dollars: '+${dollars}',
      relic_destroyed_ceremonial: 'Destroyed by Dagger',
      relic_destroyed_ramen: 'Ramen eaten!',
      relic_destroyed_hex: 'Destroyed by Hex!',
      relic_scroll_created: 'Tarot created!',
      consumable_all_hands_up: 'All hands +{levels} Lv.!',
      hand_debuffed: 'Hand not allowed by Blind!',
      boss_flint: 'Base Chips & Mult halved!',
      blind_defeated: 'Blind defeated!',
      run_won: 'Victory on Ante {ante}!',
      run_lost: 'Defeat on Ante {ante}',
    },
  },
};

/**
 * Иммутабельно применяет частичный оверлей к базовому узлу словаря.
 */
function mergeDictionaryNode<T extends object>(base: T, overlay: DeepPartial<T> | undefined): T {
  if (!overlay) {
    return structuredCloneSafe(base);
  }

  const result: Record<string, unknown> = {};
  for (const [key, baseValue] of Object.entries(base)) {
    const overlayValue = (overlay as Record<string, unknown>)[key];
    if (baseValue !== null && typeof baseValue === 'object' && !Array.isArray(baseValue)) {
      result[key] = mergeDictionaryNode(
        baseValue as Record<string, unknown>,
        overlayValue as DeepPartial<Record<string, unknown>> | undefined,
      );
    } else {
      result[key] = overlayValue !== undefined ? overlayValue : baseValue;
    }
  }
  return result as T;
}

/**
 * Делает безопасную глубокую копию простого словарного объекта без мутации исходного.
 */
function structuredCloneSafe<T extends object>(node: T): T {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      copy[key] = structuredCloneSafe(value as Record<string, unknown>);
    } else {
      copy[key] = value;
    }
  }
  return copy as T;
}

/**
 * Возвращает новый словарь LocaleDictionary с наложенным DEV-словарём оригинального Balatro.
 * Исходный baseDictionary не мутируется.
 */
export function applyDevOriginalOverlay(
  lang: I18nLang,
  baseDictionary: LocaleDictionary,
): LocaleDictionary {
  return mergeDictionaryNode(baseDictionary, DEV_ORIGINAL_OVERLAYS[lang]);
}

/**
 * Собирает карту DEV-словарей { ru, en } поверх переданных базовых словарей.
 */
export function buildDevOriginalDictionaries(
  baseDictionaries: Readonly<Record<I18nLang, LocaleDictionary>>,
): Readonly<Record<I18nLang, LocaleDictionary>> {
  return {
    ru: applyDevOriginalOverlay('ru', baseDictionaries.ru),
    en: applyDevOriginalOverlay('en', baseDictionaries.en),
  };
}
