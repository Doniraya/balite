import type { LocaleDictionary } from './types';

/**
 * Полный русский словарь локализации Balite (сеттинг «Руническая Алхимия и Астрология», 6+/12+).
 */
export const RU_DICTIONARY: LocaleDictionary = {
  ui: {
    app: {
      title: 'Balite',
      subtitle: 'Руническая алхимия и астрология',
      portraitHint: 'Оптимально для портрета 720×1280',
    },
    hud: {
      stage: 'Этап {ante}',
      stageWithMax: 'Этап {ante}/{maxAnte}',
      endlessStage: 'Бесконечный этап {ante}',
      round: 'Раунд {round}',
      score: 'Очки',
      target: 'Цель',
      scoreProgress: '{score} / {target}',
      layout: 'Расклад',
      levelShort: 'Ур. {level}',
      power: 'Сила',
      powerShort: 'Сил.',
      mult: 'Множ',
      multShort: 'Мн.',
      hands: 'Руки',
      discards: 'Сбросы',
      gold: 'Золото',
      goldAmount: '{dollars} з.',
      relics: 'Реликвии',
      consumables: 'Расходники',
      slotsCount: '{count}/{max}',
      deck: 'Колода',
      activeTags: 'Знаки',
      abilityDisabled: 'Способность подавлена',
      debuffedBadge: 'Подавлена',
      royalFlush: 'Высший ряд',
      previewHint: 'Выберите до 5 карт',
    },
    actions: {
      playHand: 'Сыграть',
      discard: 'Сбросить',
      sort: 'Сортировка',
      sortByRank: 'По рангу',
      sortBySuit: 'По масти',
      deckButton: 'Колода ({remaining}/{total})',
      handReference: 'Расклады',
      settings: 'Настройки',
      info: 'Подробнее',
      sell: 'Продать за {dollars} з.',
      use: 'Использовать',
      buy: 'Купить ({dollars} з.)',
      buyAndUse: 'Купить и применить',
      openPack: 'Открыть ({dollars} з.)',
      moveLeft: '◀ Влево',
      moveRight: 'Вправо ▶',
      close: 'Закрыть',
      cancel: 'Отмена',
      confirm: 'Подтвердить',
      back: 'Назад',
      skip: 'Пропустить',
      battle: 'Сразиться',
      rerollBoss: 'Сменить Босса ({dollars} з.)',
      claimCashout: 'Забрать {dollars} з.',
      rerollShop: 'Обновить ({dollars} з.)',
      nextRound: 'Далее',
      skipPack: 'Пропустить набор',
      pickItem: 'Выбрать',
      startRun: 'Начать забег',
      continueRun: 'Продолжить забег',
      newRun: 'Новый забег',
      continueEndless: 'Бесконечный режим',
      playAgain: 'Играть снова',
      toDeckSelect: 'Выбор колоды',
    },
    selection: {
      upToCards: 'Выберите до {max} карт (выбрано {count}/{max})',
      exactCards: 'Выберите ровно {exact} карт (выбрано {count}/{exact})',
      singleCard: 'Выберите {exact} карту (выбрано {count}/{exact})',
      mirrorCards: 'Выберите {exact} карты: левая станет копией правой ({count}/{exact})',
    },
    deckSelect: {
      title: 'Выбор стартовой колоды',
      seedLabel: 'Код забега',
      randomSeed: 'Случайный',
      seedPlaceholder: 'Введите код или оставьте пустым',
      unlocked: 'Открыта',
      locked: 'Заблокирована',
    },
    blindSelect: {
      title: 'Стражи Этапа {ante}',
      current: 'Текущий',
      defeated: 'Побеждён',
      skipped: 'Пропущен',
      upcoming: 'Впереди',
      reward: 'Награда: {dollars} з.',
      target: 'Цель: {score}',
      skipWithTag: 'Пропустить -> {tag}',
      showdownBadge: 'Финальный Страж',
      cannotSkipBoss: 'Босса нельзя пропустить',
    },
    cashout: {
      title: 'Страж повержен!',
      guardianReward: 'Награда за Стража',
      unusedHands: 'Оставшиеся руки ({count})',
      interest: 'Проценты (по 1 з. за каждые 5 з.)',
      relicBonus: 'Бонус Реликвий',
      tagBonus: 'Бонус Знаков',
      total: 'Итого',
    },
    shop: {
      title: 'Лавка Алхимика',
      shelfTitle: 'Товары',
      charterTitle: 'Грамота гильдии',
      packsTitle: 'Наборы',
      sold: 'Продано',
      noSlots: 'Нет свободных слотов',
      notEnoughGold: 'Недостаточно золота',
      free: 'Бесплатно',
      charterEmpty: 'Грамота этапа уже получена',
    },
    booster: {
      picksLeft: 'Осталось выбрать: {count}',
      choosePattern: 'Выберите {choose} из {total}',
      handCardsTitle: 'Карты в руке',
    },
    settings: {
      title: 'Настройки',
      animationSpeed: 'Скорость анимаций',
      speed1x: '1x',
      speed2x: '2x',
      speed4x: '4x',
      sound: 'Звук',
      soundOn: 'Вкл',
      soundOff: 'Выкл',
      musicVolume: 'Громкость музыки',
      sfxVolume: 'Громкость эффектов',
      language: 'Язык',
      langRu: 'Русский',
      langEn: 'English',
    },
    handReference: {
      title: 'Справка раскладов',
      level: 'Ур. {level}',
      played: 'Сыграно: {count}',
      baseFormula: '{chips} Сил. × {mult} Множ',
      hiddenLayout: 'Скрытый расклад',
    },
    deckModal: {
      title: 'Состав колоды',
      drawPile: 'В колоде добора ({count})',
      discardPile: 'В сбросе ({count})',
      inHand: 'В руке ({count})',
      totalCards: 'Всего карт: {count}',
    },
    runEnd: {
      victoryTitle: 'Победа!',
      victorySubtitle: 'Все 8 Этапов успешно пройдены!',
      defeatTitle: 'Поражение',
      defeatSubtitle: 'Порог Стража не достигнут',
      bestHandScore: 'Лучший расклад',
      handsPlayed: 'Сыграно рук',
      discardsUsed: 'Использовано сбросов',
      cardsDestroyed: 'Уничтожено карт',
      dollarsSpent: 'Потрачено золота',
      finalStage: 'Достигнутый Этап',
      finalRound: 'Раунд',
      runSeed: 'Код забега',
    },
  },
  hands: {
    'Flush Five': {
      name: 'Мастная пятёрка',
      description: '5 карт одного ранга и одной масти',
    },
    'Flush House': {
      name: 'Мастный строй',
      description: 'Тройка и Пара, все карты одной масти',
    },
    'Five of a Kind': {
      name: 'Пятёрка',
      description: '5 карт одного ранга',
    },
    'Straight Flush': {
      name: 'Мастный ряд',
      description: '5 карт подряд одной масти',
    },
    'Four of a Kind': {
      name: 'Четвёрка',
      description: '4 карты одного ранга',
    },
    'Full House': {
      name: 'Полный строй',
      description: 'Тройка и Пара разных рангов',
    },
    Flush: {
      name: 'Масть',
      description: '5 карт одной масти',
    },
    Straight: {
      name: 'Ряд',
      description: '5 карт подряд по рангу',
    },
    'Three of a Kind': {
      name: 'Тройка',
      description: '3 карты одного ранга',
    },
    'Two Pair': {
      name: 'Две пары',
      description: 'Две пары карт разных рангов',
    },
    Pair: {
      name: 'Пара',
      description: '2 карты одного ранга',
    },
    'High Card': {
      name: 'Старшая карта',
      description: 'Любая карта, если нет других раскладов',
    },
  },
  relics: {
    j_joker: {
      name: 'Путевой камень',
      description: '+{mult} Множ',
    },
    j_greedy_joker: {
      name: 'Алмазная брошь',
      description: '+{mult} Множ за каждую Бубну при подсчёте',
    },
    j_lusty_joker: {
      name: 'Сердцеедка',
      description: '+{mult} Множ за каждую Черву при подсчёте',
    },
    j_wrathful_joker: {
      name: 'Наконечник копья',
      description: '+{mult} Множ за каждую Пику при подсчёте',
    },
    j_gluttenous_joker: {
      name: 'Четырёхлистник',
      description: '+{mult} Множ за каждую Трефу при подсчёте',
    },
    j_jolly: {
      name: 'Печать Близнецов',
      description: '+{mult} Множ, если расклад содержит Пару',
    },
    j_sly: {
      name: 'Талисман Согласия',
      description: '+{chips} Силы, если расклад содержит Пару',
    },
    j_half: {
      name: 'Расколотый щит',
      description: '+{mult} Множ, если сыграно не более {maxCards} карт',
    },
    j_abstract: {
      name: 'Символ Единства',
      description: '+{multPerRelic} Множ за каждую Реликвию в панели (сейчас: +{mult})',
    },
    j_banner: {
      name: 'Боевое знамя',
      description: '+{chipsPerDiscard} Силы за каждый оставшийся сброс',
    },
    j_mystic_summit: {
      name: 'Вершина Покоя',
      description: '+{mult} Множ, когда осталось {discards} сбросов',
    },
    j_scary_face: {
      name: 'Древняя личина',
      description: '+{chips} Силы за каждую картинку (В, Д, К) при подсчёте',
    },
    j_even_steven: {
      name: 'Весы Чётности',
      description: '+{mult} Множ за каждую чётную карту (10, 8, 6, 4, 2) при подсчёте',
    },
    j_odd_todd: {
      name: 'Камень Нечёта',
      description: '+{chips} Силы за каждую нечётную карту (Т, 9, 7, 5, 3) при подсчёте',
    },
    j_runner: {
      name: 'Сапоги странника',
      description: 'Накопительно +{chipsStep} Силы, если расклад содержит Ряд (сейчас: +{chips})',
    },
    j_green_joker: {
      name: 'Изумрудный росток',
      description: '+{multGain} Множ за розыгрыш, -{multLoss} Множ за сброс, мин. 0 (сейчас: +{mult})',
    },
    j_photograph: {
      name: 'Старый медальон',
      description: 'Первая картинка (В, Д, К) при подсчёте даёт ×{xMult} Множ',
    },
    j_golden: {
      name: 'Золотая чаша',
      description: '+{dollars} з. в конце каждого раунда',
    },
    j_flash: {
      name: 'Вспышка кузни',
      description: 'Накопительно +{multStep} Множ за каждое обновление лавки (сейчас: +{mult})',
    },
    j_trousers: {
      name: 'Запасной мундир',
      description: 'Накопительно +{multStep} Множ, если расклад содержит Две пары (сейчас: +{mult})',
    },
    j_ceremonial: {
      name: 'Плавильный клинок',
      description:
        'При выборе Стража поглощает Реликвию справа и добавляет её двойную цену к Множ (сейчас: +{mult})',
    },
    j_blackboard: {
      name: 'Аспидная доска',
      description: '×{xMult} Множ, если все оставшиеся в руке карты — Пики или Трефы',
    },
    j_card_sharp: {
      name: 'Отточенный знак',
      description: '×{xMult} Множ, если этот тип расклада уже игрался в текущем раунде',
    },
    j_acrobat: {
      name: 'Канатоходец',
      description: '×{xMult} Множ на последнем розыгрыше раунда',
    },
    j_constellation: {
      name: 'Небесный компас',
      description: 'Накопительно +×{xMultStep} Множ за каждую использованную Сферу (сейчас: ×{xMult})',
    },
    j_hologram: {
      name: 'Призма памяти',
      description:
        'Накопительно +×{xMultStep} Множ за каждую карту, добавленную в колоду (сейчас: ×{xMult})',
    },
    j_vampire: {
      name: 'Поглотитель чар',
      description:
        'Накопительно +×{xMultStep} Множ за каждую Улучшенную карту в счёте и снимает её улучшение (сейчас: ×{xMult})',
    },
    j_ramen: {
      name: 'Пряный эликсир',
      description: '×{xMult} Множ; теряет ×{xMultLoss} за каждую сброшенную карту (исчезает при ×1)',
    },
    j_stencil: {
      name: 'Пустой слепок',
      description: '×1 Множ за каждый свободный слот Реликвии, включая сам слепок (сейчас: ×{xMult})',
    },
    j_sock_and_buskin: {
      name: 'Двойная маска',
      description: 'Повторно активирует (+{retriggers} раз) все картинки (В, Д, К) при подсчёте',
    },
    j_mime: {
      name: 'Зеркальный мим',
      description: 'Повторно активирует (+{retriggers} раз) все эффекты карт, оставшихся в руке',
    },
    j_four_fingers: {
      name: 'Четырёхгранник',
      description: 'Масть и Ряд можно собрать из {cardsRequired} карт вместо 5',
    },
    j_shortcut: {
      name: 'Тайная тропа',
      description: 'В Ряду допускаются пропуски на 1 ранг (например: Т-Д-10-8-6)',
    },
    j_bull: {
      name: 'Медный бык',
      description: '+{chipsPerDollar} Силы за каждый 1 з. в вашей казне (сейчас: +{chips})',
    },
    j_duo: {
      name: 'Клятва Близнецов',
      description: '×{xMult} Множ, если расклад содержит Пару',
    },
    j_tribe: {
      name: 'Единство Племени',
      description: '×{xMult} Множ, если расклад содержит Масть',
    },
    j_baron: {
      name: 'Корона Монарха',
      description: 'Каждый Король, оставшийся в руке при подсчёте, даёт ×{xMult} Множ',
    },
    j_blueprint: {
      name: 'Чертёж Мастера',
      description: 'Копирует способность совместимой Реликвии справа',
    },
    j_brainstorm: {
      name: 'Искра Озарения',
      description: 'Копирует способность самой левой совместимой Реликвии',
    },
    j_vagabond: {
      name: 'Аскет',
      description: 'Создаёт случайный Свиток при розыгрыше, если в казне не более {maxDollars} з.',
    },
  },
  celestials: {
    c_mercury: {
      name: 'Меркурий',
      description: '+1 уровень расклада «Пара» (+{chips} Силы, +{mult} Множ)',
    },
    c_venus: {
      name: 'Венера',
      description: '+1 уровень расклада «Тройка» (+{chips} Силы, +{mult} Множ)',
    },
    c_earth: {
      name: 'Земля',
      description: '+1 уровень расклада «Полный строй» (+{chips} Силы, +{mult} Множ)',
    },
    c_mars: {
      name: 'Марс',
      description: '+1 уровень расклада «Четвёрка» (+{chips} Силы, +{mult} Множ)',
    },
    c_jupiter: {
      name: 'Юпитер',
      description: '+1 уровень расклада «Масть» (+{chips} Силы, +{mult} Множ)',
    },
    c_saturn: {
      name: 'Сатурн',
      description: '+1 уровень расклада «Ряд» (+{chips} Силы, +{mult} Множ)',
    },
    c_uranus: {
      name: 'Уран',
      description: '+1 уровень расклада «Две пары» (+{chips} Силы, +{mult} Множ)',
    },
    c_neptune: {
      name: 'Нептун',
      description: '+1 уровень расклада «Мастный ряд» (+{chips} Силы, +{mult} Множ)',
    },
    c_pluto: {
      name: 'Плутон',
      description: '+1 уровень расклада «Старшая карта» (+{chips} Силы, +{mult} Множ)',
    },
    c_planet_x: {
      name: 'Планета X',
      description: '+1 уровень расклада «Пятёрка» (+{chips} Силы, +{mult} Множ)',
    },
    c_ceres: {
      name: 'Церера',
      description: '+1 уровень расклада «Мастный строй» (+{chips} Силы, +{mult} Множ)',
    },
    c_eris: {
      name: 'Эрида',
      description: '+1 уровень расклада «Мастная пятёрка» (+{chips} Силы, +{mult} Множ)',
    },
  },
  scrolls: {
    c_fool: {
      name: 'Свиток Эха',
      description: 'Создаёт копию последнего использованного Свитка или Сферы в забеге (кроме себя)',
    },
    c_magician: {
      name: 'Свиток Удачи',
      description: 'Улучшает до {count} выбранных карт до Благословенных',
    },
    c_empress: {
      name: 'Свиток Пламени',
      description: 'Улучшает до {count} выбранных карт до Пылающих',
    },
    c_heirophant: {
      name: 'Свиток Рун',
      description: 'Улучшает до {count} выбранных карт до Рунических',
    },
    c_lovers: {
      name: 'Свиток Гармонии',
      description: 'Улучшает {count} выбранную карту до карты Хамелеон',
    },
    c_chariot: {
      name: 'Свиток Кузнеца',
      description: 'Улучшает {count} выбранную карту до Стальной',
    },
    c_justice: {
      name: 'Свиток Кристалла',
      description: 'Улучшает {count} выбранную карту до Хрустальной',
    },
    c_devil: {
      name: 'Свиток Мидаса',
      description: 'Улучшает {count} выбранную карту до Золотой',
    },
    c_tower: {
      name: 'Свиток Бастиона',
      description: 'Улучшает {count} выбранную карту до Каменной',
    },
    c_hermit: {
      name: 'Свиток Скряги',
      description: 'Удваивает текущее золото (макс. +{maxDollars} з.)',
    },
    c_temperance: {
      name: 'Свиток Оценщика',
      description: 'Даёт золото по сумме цены продажи всех ваших Реликвий (макс. +{maxDollars} з.)',
    },
    c_wheel_of_fortune: {
      name: 'Колесо Алхимика',
      description: 'Шанс 1 к {odds} добавить Тиснёное, Радужное или Призматическое издание Реликвии',
    },
    c_strength: {
      name: 'Свиток Возвышения',
      description: 'Повышает ранг до {count} выбранных карт на +1 (Т -> 2)',
    },
    c_hanged_man: {
      name: 'Свиток Очищения',
      description: 'Уничтожает до {count} выбранных карт',
    },
    c_death: {
      name: 'Свиток Зеркала',
      description: 'Выберите {count} карты: левая карта превращается в копию правой',
    },
    c_judgement: {
      name: 'Свиток Призыва',
      description: 'Создаёт случайную Реликвию, если есть свободный слот',
    },
  },
  runes: {
    c_talisman: {
      name: 'Руна Талисмана',
      description: 'Накладывает Золотую печать на {count} выбранную карту в руке',
    },
    c_deja_vu: {
      name: 'Алая руна',
      description: 'Накладывает Алую печать на {count} выбранную карту в руке',
    },
    c_trance: {
      name: 'Лазурная руна',
      description: 'Накладывает Лазурную печать на {count} выбранную карту в руке',
    },
    c_medium: {
      name: 'Лиловая руна',
      description: 'Накладывает Лиловую печать на {count} выбранную карту в руке',
    },
    c_aura: {
      name: 'Руна Сияния',
      description: 'Накладывает Тиснёное, Радужное или Призматическое издание на {count} карту',
    },
    c_cryptid: {
      name: 'Руна Двойника',
      description: 'Создаёт {copies} копии {count} выбранной карты прямо в руке',
    },
    c_immolate: {
      name: 'Руна Пепла',
      description: 'Уничтожает {destroyCount} случайных карт в руке и даёт +{dollars} з.',
    },
    c_hex: {
      name: 'Руна Призмы',
      description: 'Делает случайную Реликвию Призматической, уничтожая все остальные Реликвии',
    },
    c_black_hole: {
      name: 'Звёздный провал',
      description: 'Повышает уровень всех 12 раскладов на +{levels}',
    },
  },
  charters: {
    v_overstock_norm: {
      name: 'Расширенный прилавок',
      description: '+{slots} слот товара на верхней полке лавки',
    },
    v_clearance_sale: {
      name: 'Торговый указ',
      description: 'Все товары и наборы стоят на {percent}% дешевле',
    },
    v_hone: {
      name: 'Огранка',
      description: 'Тиснёные, Радужные и Призматические карты появляются в {rate} раза чаще',
    },
    v_reroll_surplus: {
      name: 'Дешёвое обновление',
      description: 'Обновление полки лавки стоит на {dollars} з. меньше',
    },
    v_crystal_ball: {
      name: 'Пояс алхимика',
      description: '+{slots} слот для расходников',
    },
    v_grabber: {
      name: 'Запас сил',
      description: '+{hands} розыгрыш в каждом раунде',
    },
    v_wasteful: {
      name: 'Свежий ветер',
      description: '+{discards} сброс в каждом раунде',
    },
    v_seed_money: {
      name: 'Казначейская печать',
      description: 'Потолок процентов за раунд повышен до {cap} з.',
    },
    v_paint_brush: {
      name: 'Широкий хват',
      description: '+{size} к размеру руки',
    },
    v_telescope: {
      name: 'Астролябия',
      description: 'Астральные наборы всегда содержат Сферу вашего самого частого расклада',
    },
    v_observatory: {
      name: 'Обсерватория',
      description: 'Астральные сферы в слотах расходников дают ×{xMult} Множ для своего расклада',
    },
    v_directors_cut: {
      name: 'Указ смены врага',
      description: 'Позволяет 1 раз за Этап сменить Босса за {dollars} з.',
    },
  },
  tags: {
    tag_uncommon: {
      name: 'Знак Редкости',
      description: 'Следующая Необычная Реликвия в лавке станет бесплатной',
    },
    tag_rare: {
      name: 'Знак Величия',
      description: 'Следующая Редкая Реликвия в лавке станет бесплатной',
    },
    tag_investment: {
      name: 'Знак Вклада',
      description: 'Даёт +{dollars} з. после победы над Боссом Этапа',
    },
    tag_economy: {
      name: 'Знак Казны',
      description: 'Удваивает ваше текущее золото (макс. +{maxDollars} з.)',
    },
    tag_coupon: {
      name: 'Знак Ярмарки',
      description: 'Стартовые товары и наборы в следующем магазине бесплатны',
    },
    tag_d_six: {
      name: 'Знак Обновления',
      description: 'Обновление в следующем магазине начинается с 0 з.',
    },
    tag_double: {
      name: 'Знак Удвоения',
      description: 'Даёт копию следующего полученного Знака (кроме Знака Удвоения)',
    },
    tag_juggle: {
      name: 'Знак Размаха',
      description: '+{size} к размеру руки на следующий раунд',
    },
    tag_charm: {
      name: 'Знак Свитков',
      description: 'Мгновенно открывает бесплатный Мега-набор Свитков',
    },
    tag_skip: {
      name: 'Знак Странника',
      description: 'Даёт +{dollarsPerSkip} з. за каждого пропущенного Стража в забеге',
    },
  },
  bosses: {
    bl_hook: {
      name: 'Разоритель',
      description: 'Сбрасывает {count} случайные карты из руки после каждого розыгрыша',
    },
    bl_manacle: {
      name: 'Оковы',
      description: '-{count} к размеру руки на весь бой',
    },
    bl_psychic: {
      name: 'Строгий Судья',
      description: 'Нужно разыгрывать ровно {count} карт',
    },
    bl_pillar: {
      name: 'Столп Памяти',
      description: 'Карты, уже сыгранные в этом Этапе, подавлены',
    },
    bl_club: {
      name: 'Затмение Треф',
      description: 'Все карты масти Трефы подавлены',
    },
    bl_water: {
      name: 'Засуха',
      description: 'Начинаете бой с 0 сбросами',
    },
    bl_wall: {
      name: 'Великая Стена',
      description: 'Огромный порог очков (×4 базы)',
    },
    bl_flint: {
      name: 'Кремнёвый Страж',
      description: 'Базовая Сила и Множитель расклада делятся пополам',
    },
    bl_final_vessel: {
      name: 'Фиолетовый Монолит',
      description: 'Гигантский порог финального Этапа (×6 базы)',
    },
    bl_final_bell: {
      name: 'Лазурный Звон',
      description: 'При каждом доборе 1 случайная карта в руке принудительно выделяется',
    },
  },
  blinds: {
    small: {
      name: 'Малый Страж',
      description: 'Начальный противник Этапа (порог ×1)',
    },
    big: {
      name: 'Старший Страж',
      description: 'Усиленный противник Этапа (порог ×1.5)',
    },
    boss: {
      name: 'Босс Этапа',
      description: 'Главный Страж Этапа с особым правилом',
    },
  },
  decks: {
    b_red: {
      name: 'Алая колода',
      description: '+{discards} сброс в каждом раунде',
    },
    b_blue: {
      name: 'Лазурная колода',
      description: '+{hands} розыгрыш в каждом раунде',
    },
    b_yellow: {
      name: 'Янтарная колода',
      description: '+{dollars} з. дополнительного стартового золота',
    },
    b_black: {
      name: 'Чёрная колода',
      description: '+{relicSlots} слот Реликвий, но -{handsLoss} розыгрыш в каждом раунде',
    },
  },
  enhancements: {
    none: {
      name: 'Обычная',
      description: 'Карта без особых чар',
    },
    bonus: {
      name: 'Руническая',
      description: '+30 Силы при подсчёте',
    },
    mult: {
      name: 'Пылающая',
      description: '+4 Множ при подсчёте',
    },
    wild: {
      name: 'Хамелеон',
      description: 'Считается картой любой масти',
    },
    glass: {
      name: 'Хрустальная',
      description: '×2 Множ; шанс 1 к 4 разрушиться после подсчёта',
    },
    steel: {
      name: 'Стальная',
      description: '×1.5 Множ, пока остаётся в руке',
    },
    stone: {
      name: 'Каменная',
      description: '+50 Силы, без ранга и масти; всегда участвует в подсчёте',
    },
    gold: {
      name: 'Золотая',
      description: '+3 з. в конце раунда, если осталась в руке',
    },
    lucky: {
      name: 'Благословенная',
      description: 'Шанс 1 к 5 дать +20 Множ и шанс 1 к 15 дать +20 з.',
    },
  },
  editions: {
    base: {
      name: 'Обычное',
      description: 'Базовое исполнение без модификаторов',
    },
    foil: {
      name: 'Тиснёное',
      description: '+50 Силы',
    },
    holo: {
      name: 'Радужное',
      description: '+10 Множ',
    },
    polychrome: {
      name: 'Призматическое',
      description: '×1.5 Множ',
    },
    negative: {
      name: 'Теневое',
      description: '+1 слот Реликвии',
    },
  },
  seals: {
    none: {
      name: 'Без печати',
      description: 'На карте нет печати',
    },
    gold: {
      name: 'Золотая печать',
      description: '+3 з. каждый раз, когда карта участвует в подсчёте',
    },
    red: {
      name: 'Алая печать',
      description: 'Повторно активирует эту карту +1 раз',
    },
    blue: {
      name: 'Лазурная печать',
      description: 'Создаёт Сферу последнего расклада, если осталась в руке в конце раунда',
    },
    purple: {
      name: 'Лиловая печать',
      description: 'Создаёт случайный Свиток при сбросе этой карты',
    },
  },
  packTypes: {
    arcana: {
      name: 'Набор Свитков',
      description: 'Содержит Алхимические свитки для изменения карт и колоды',
    },
    celestial: {
      name: 'Астральный набор',
      description: 'Содержит Астральные сферы для усиления раскладов',
    },
    standard: {
      name: 'Набор Карт',
      description: 'Содержит новые игральные карты для добавления в колоду',
    },
    buffoon: {
      name: 'Набор Реликвий',
      description: 'Содержит случайные Реликвии на выбор',
    },
    spectral: {
      name: 'Эфирный набор',
      description: 'Содержит редкие Эфирные руны и печати',
    },
  },
  packSizes: {
    normal: {
      name: 'Обычный',
      description: 'Стандартный набор',
    },
    jumbo: {
      name: 'Большой',
      description: 'Расширенный набор с большим выбором',
    },
    mega: {
      name: 'Мега',
      description: 'Крупный набор с выбором двух карт',
    },
  },
  packs: {
    arcana_normal: 'Обычный набор Свитков',
    arcana_jumbo: 'Большой набор Свитков',
    arcana_mega: 'Мега-набор Свитков',
    celestial_normal: 'Обычный Астральный набор',
    celestial_jumbo: 'Большой Астральный набор',
    celestial_mega: 'Мега-Астральный набор',
    standard_normal: 'Обычный набор Карт',
    standard_jumbo: 'Большой набор Карт',
    standard_mega: 'Мега-набор Карт',
    buffoon_normal: 'Обычный набор Реликвий',
    buffoon_jumbo: 'Большой набор Реликвий',
    buffoon_mega: 'Мега-набор Реликвий',
    spectral_normal: 'Обычный Эфирный набор',
    spectral_jumbo: 'Большой Эфирный набор',
    spectral_mega: 'Мега-Эфирный набор',
  },
  suits: {
    spades: { name: 'Пики', short: 'П', symbol: '♠' },
    hearts: { name: 'Червы', short: 'Ч', symbol: '♥' },
    clubs: { name: 'Трефы', short: 'Тр', symbol: '♣' },
    diamonds: { name: 'Бубны', short: 'Б', symbol: '♦' },
  },
  ranks: {
    '2': { name: 'Двойка', short: '2' },
    '3': { name: 'Тройка', short: '3' },
    '4': { name: 'Четвёрка', short: '4' },
    '5': { name: 'Пятёрка', short: '5' },
    '6': { name: 'Шестёрка', short: '6' },
    '7': { name: 'Семёрка', short: '7' },
    '8': { name: 'Восьмёрка', short: '8' },
    '9': { name: 'Девятка', short: '9' },
    '10': { name: 'Десятка', short: '10' },
    '11': { name: 'Валет', short: 'В' },
    '12': { name: 'Дама', short: 'Д' },
    '13': { name: 'Король', short: 'К' },
    '14': { name: 'Туз', short: 'Т' },
  },
  rarities: {
    '1': 'Обычная',
    '2': 'Необычная',
    '3': 'Редкая',
  },
  consumableKinds: {
    celestial: 'Астральная сфера',
    scroll: 'Алхимический свиток',
    rune: 'Эфирная руна',
  },
  trace: {
    card_chips: '+{chips} Силы',
    card_mult: '+{mult} Множ',
    card_x_mult: '×{xMult} Множ',
    card_dollars: '+{dollars} з.',
    card_retrigger: 'Повтор!',
    card_debuffed: 'Подавлена!',
    card_shatter_glass: 'Хрусталь раскололся!',
    card_shatter_scroll: 'Карта очищена',
    card_shatter_rune: 'Обращена в пепел',
    card_enhancement_stripped: 'Чары поглощены',
    hand_card_steel: '×{xMult} Множ',
    hand_card_gold: '+{dollars} з.',
    hand_card_blue_seal: 'Сфера создана!',
    hand_card_purple_seal: 'Свиток создан!',
    relic_chips: '+{chips} Силы',
    relic_mult: '+{mult} Множ',
    relic_x_mult: '×{xMult} Множ',
    relic_dollars: '+{dollars} з.',
    relic_upgrade: 'Усиление!',
    relic_reset: 'Сброс!',
    relic_destroyed_ceremonial: 'Поглощена клинком',
    relic_destroyed_ramen: 'Эликсир иссяк!',
    relic_destroyed_hex: 'Разрушена руной!',
    relic_destroyed_sold: 'Продано',
    relic_scroll_created: 'Свиток создан!',
    consumable_used: 'Применено',
    consumable_nope: 'Неудача!',
    consumable_all_hands_up: 'Все расклады +{levels} ур.!',
    hand_level_up: '{handName}: Ур. {level}',
    hand_debuffed: 'Расклад запрещён Стражем!',
    boss_disabled: 'Способность Стража подавлена!',
    boss_hook_discard: 'Страж сбросил {count} карты',
    boss_manacle: 'Размер руки -{count}',
    boss_psychic: 'Нужно ровно {count} карт!',
    boss_water: 'Все сбросы обнулены!',
    boss_flint: 'Сила и Множ уполовинены!',
    boss_final_bell: 'Карта принудительно выделена!',
    tag_activated: 'Знак сработал: {tagName}',
    tag_copied: 'Знак скопирован: {tagName}',
    tag_fizzled: 'Знак не сработал',
    blind_defeated: 'Страж повержен!',
    run_won: 'Победа на Этапе {ante}!',
    run_lost: 'Поражение на Этапе {ante}',
  },
};
