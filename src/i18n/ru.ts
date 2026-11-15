import type { LocaleDictionary } from './types';

/**
 * Полный русский словарь локализации Balite (сеттинг «Гильдия приключенцев», 6+/12+).
 */
export const RU_DICTIONARY: LocaleDictionary = {
  ui: {
    app: {
      title: 'Balite',
      subtitle: 'Гильдия приключенцев',
      portraitHint: 'Оптимально для портрета 720×1280',
    },
    mainMenu: {
      play: 'Играть',
      options: 'Параметры',
      collection: 'Коллекция',
      comingSoon: 'Скоро',
      version: 'Версия {version}',
    },
    hud: {
      stage: 'Ранг гильдии {ante}',
      stageWithMax: 'Ранг гильдии {ante}/{maxAnte}',
      endlessStage: 'Бесконечный ранг {ante}',
      rankWithMax: 'Ранг {rank} ({ante}/{maxAnte})',
      endlessRank: 'Ранг SS+ ({ante})',
      round: 'Бой {round}',
      score: 'Очки',
      target: 'Цель',
      scoreProgress: '{score} / {target}',
      layout: 'Комбинация',
      levelShort: 'Ур. {level}',
      power: 'Сила',
      powerShort: 'Сил.',
      mult: 'Множ',
      multShort: 'Мн.',
      hands: 'Руки',
      discards: 'Сбросы',
      gold: 'Золото',
      goldAmount: '{dollars} з.',
      relics: 'Навыки',
      consumables: 'Расходники',
      slotsCount: '{count}/{max}',
      deck: 'Колода',
      activeTags: 'Талоны',
      abilityDisabled: 'Эффект подавлен',
      debuffedBadge: 'Ослаблена',
      royalFlush: 'Высший ряд',
      previewHint: 'Выберите до 5 карт',
      shopBannerTitle: 'ГИЛЬДИЯ',
      shopBannerSubtitle: 'Снаряжение и припасы',
      blindSelectBadge: 'Доска заказов',
    },
    actions: {
      playHand: 'Сыграть',
      discard: 'Сбросить',
      sort: 'Сортировка',
      sortByRank: 'По рангу',
      sortBySuit: 'По масти',
      deckButton: 'Колода ({remaining}/{total})',
      handReference: 'Комбинации',
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
      battle: 'Принять заказ',
      rerollBoss: 'Сменить Босса ({dollars} з.)',
      claimCashout: 'Забрать {dollars} з.',
      rerollShop: 'Обновить ({dollars} з.)',
      nextRound: 'Далее',
      skipPack: 'Закрыть сундук',
      pickItem: 'Взять',
      startRun: 'Начать забег',
      continueRun: 'Продолжить забег',
      newRun: 'Новый забег',
      continueEndless: 'Бесконечный режим',
      playAgain: 'Играть снова',
      toDeckSelect: 'Выбор колоды',
      copy: 'Копия',
      copied: 'Скопировано',
      mainMenu: 'Главное меню',
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
      title: 'Заказы ступени {ante}',
      rankTitle: 'Заказы ранга {rank}',
      chooseNextPrompt: 'Выберите заказ на доске гильдии',
      current: 'Текущий',
      defeated: 'Выполнен',
      skipped: 'Пропущен',
      upcoming: 'Впереди',
      minScore: 'Минимум очков',
      reward: 'Награда: {dollars} з.',
      target: 'Цель: {score}',
      orSeparator: 'ИЛИ',
      skipButton: 'Пропустить заказ',
      skipWithTag: 'Пропустить -> {tag}',
      showdownBadge: 'Финальный босс',
      cannotSkipBoss: 'Босса-монстра нельзя пропустить',
      advanceStageTitle: 'Повышение ранга',
      advanceStageDesc: 'Усилить монстров и обновить заказы',
    },
    cashout: {
      title: 'Заказ выполнен!',
      guardianReward: 'Награда за заказ',
      unusedHands: 'Оставшиеся руки ({count})',
      interest: 'Проценты казны (1 з. за каждые 5 з.)',
      relicBonus: 'Бонус Навыков',
      tagBonus: 'Бонус Талонов',
      total: 'Итого',
    },
    shop: {
      title: 'Стойка гильдии',
      shelfTitle: 'Товары',
      charterTitle: 'Привилегия гильдии',
      packsTitle: 'Сундуки',
      sold: 'Продано',
      noSlots: 'Нет свободных слотов',
      notEnoughGold: 'Недостаточно золота',
      free: 'Бесплатно',
      charterEmpty: 'Привилегия ранга уже куплена',
    },
    booster: {
      picksLeft: 'Осталось выбрать: {count}',
      choosePattern: 'Выберите {choose} из {total}',
      handCardsTitle: 'Карты в руке',
    },
    settings: {
      title: 'Настройки',
      hubTitle: 'Параметры',
      hubSettings: 'Настройки',
      hubStats: 'Статистика',
      hubCredits: 'Титры',
      hubMainMenu: 'В главное меню',
      animationSpeed: 'Скорость анимаций',
      speed05x: '0.5x',
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
      crtMode: 'CRT-эффект',
      crtOff: 'Выкл',
      crtLight: 'Лёгкий',
      crtOriginal: 'Оригинал',
      resetTutorial: 'Пройти обучение заново',
    },
    stats: {
      title: 'Статистика',
      bestHand: 'Лучшая комбинация',
      highestRound: 'Наивысший бой',
      highestStage: 'Высший ранг',
      mostPlayedHand: 'Частая комбинация',
      noneHand: 'Нет ({count})',
      maxGold: 'Максимум золота',
      bestWinStreak: 'Лучшая серия побед',
      runsStartedWon: 'Забегов / Побед',
      discoveryProgress: 'Прогресс открытий',
    },
    credits: {
      title: 'Титры и об игре',
      version: 'Версия сборки: {version}',
      settingLine: 'Сеттинг: Гильдия приключенцев (исэкай-фэнтези)',
      engineLine: 'Игровой движок и графика: команда разработки (векторная и холстовая отрисовка)',
      audioLine: 'Звуковое сопровождение: гибридный аудиодвижок и процедурный синтез',
      fontLine: 'Шрифт: Pixellari (Zacchary Dempsey-Plante, кириллица YuRaNnNzZZ, SIL OFL 1.1)',
      complianceLine: 'Веб-версия без внешних ссылок и переходов.',
    },
    handReference: {
      title: 'Список комбинаций',
      level: 'Ур. {level}',
      played: 'Сыграно: {count}',
      baseFormula: '{chips} Сил. × {mult} Множ',
      hiddenLayout: 'Скрытая комбинация',
    },
    deckModal: {
      title: 'Состав колоды',
      remainingTab: 'Оставшаяся колода',
      fullTab: 'Полная колода',
      baseCardsTitle: 'Базовые карты',
      aces: 'Тузы',
      faces: 'Фигуры',
      numbers: 'Числа',
      rankAce: 'Т',
      rankKing: 'К',
      rankQueen: 'Д',
      rankJack: 'В',
      backButton: 'Назад',
      drawPile: 'В колоде добора ({count})',
      discardPile: 'В сбросе ({count})',
      inHand: 'В руке ({count})',
      totalCards: 'Всего карт: {count}',
    },
    runEnd: {
      victoryTitle: 'Победа!',
      victorySubtitle: 'Все 8 рангов гильдии пройдены — получен ранг гильдии!',
      defeatTitle: 'Заказ провален',
      defeatSubtitle: 'Цель заказа не достигнута',
      bestHandScore: 'Лучшая комбинация',
      handsPlayed: 'Сыграно рук',
      discardsUsed: 'Использовано сбросов',
      cardsDestroyed: 'Уничтожено карт',
      dollarsSpent: 'Потрачено золота',
      finalStage: 'Достигнутый ранг',
      finalRound: 'Бой',
      runSeed: 'Код забега',
      mostPlayedHand: 'Частая комбинация',
      cardsPlayed: 'Сыгранные карты',
      cardsDiscarded: 'Сброшенные карты',
      cardsPurchased: 'Купленные карты',
      rerollsCount: 'Количество обновлений',
      newDiscoveries: 'Новые открытия',
      defeatedBy: 'Провал на заказе:',
      clearedGuardian: 'Выполнен заказ:',
      newRecordBadge: 'Новый рекорд!',
      none: 'Нет ({count})',
    },
    tooltip: {
      hiddenTitle: 'Скрытая карта',
      hiddenSubtitle: 'Перевёрнута',
      hiddenDescription: 'Скрыто способностью Босса',
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
      description: 'Любая карта, если нет других комбинаций',
    },
  },
  relics: {
    j_joker: {
      name: 'Базовый удар',
      description: '+{mult} Множ',
    },
    j_greedy_joker: {
      name: 'Охотник за золотом',
      description: '+{mult} Множ за каждую Бубну при подсчёте',
    },
    j_lusty_joker: {
      name: 'Пылкое сердце',
      description: '+{mult} Множ за каждую Черву при подсчёте',
    },
    j_wrathful_joker: {
      name: 'Ярость клинка',
      description: '+{mult} Множ за каждую Пику при подсчёте',
    },
    j_gluttenous_joker: {
      name: 'Лесной оберег',
      description: '+{mult} Множ за каждую Трефу при подсчёте',
    },
    j_jolly: {
      name: 'Парная стойка',
      description: '+{mult} Множ, если комбинация содержит Пару',
    },
    j_sly: {
      name: 'Хитрая уловка',
      description: '+{chips} Силы, если комбинация содержит Пару',
    },
    j_half: {
      name: 'Быстрый выпад',
      description: '+{mult} Множ, если сыграно не более {maxCards} карт',
    },
    j_abstract: {
      name: 'Синергия гильдии',
      description: '+{multPerRelic} Множ за каждый Навык в панели (сейчас: +{mult})',
    },
    j_banner: {
      name: 'Осадная стойка',
      description: '+{chipsPerDiscard} Силы за каждый оставшийся сброс',
    },
    j_mystic_summit: {
      name: 'Последний рубеж',
      description: '+{mult} Множ, когда осталось {discards} сбросов',
    },
    j_scary_face: {
      name: 'Устрашение',
      description: '+{chips} Силы за каждую картинку (В, Д, К) при подсчёте',
    },
    j_even_steven: {
      name: 'Чётный ритм',
      description: '+{mult} Множ за каждую чётную карту (10, 8, 6, 4, 2) при подсчёте',
    },
    j_odd_todd: {
      name: 'Нечётный выпад',
      description: '+{chips} Силы за каждую нечётную карту (Т, 9, 7, 5, 3) при подсчёте',
    },
    j_runner: {
      name: 'Рывок авантюриста',
      description: 'Накопительно +{chipsStep} Силы, если комбинация содержит Ряд (сейчас: +{chips})',
    },
    j_green_joker: {
      name: 'Боевая закалка',
      description: '+{multGain} Множ за ход, -{multLoss} Множ за сброс, мин. 0 (сейчас: +{mult})',
    },
    j_photograph: {
      name: 'Меткий взгляд',
      description: 'Первая картинка (В, Д, К) при подсчёте даёт ×{xMult} Множ',
    },
    j_golden: {
      name: 'Гильдейское жалование',
      description: '+{dollars} з. после выполнения заказа',
    },
    j_flash: {
      name: 'Торговая жилка',
      description: 'Накопительно +{multStep} Множ за каждое обновление прилавка (сейчас: +{mult})',
    },
    j_trousers: {
      name: 'Запасная экипировка',
      description: 'Накопительно +{multStep} Множ, если комбинация содержит Две пары (сейчас: +{mult})',
    },
    j_ceremonial: {
      name: 'Поглощение навыка',
      description:
        'При принятии заказа поглощает Навык справа и добавляет его двойную цену к Множ (сейчас: +{mult})',
    },
    j_blackboard: {
      name: 'Ночная засада',
      description: '×{xMult} Множ, если все оставшиеся в руке карты — Пики или Трефы',
    },
    j_card_sharp: {
      name: 'Повторный приём',
      description: '×{xMult} Множ, если эта комбинация уже игралась в текущем бою',
    },
    j_acrobat: {
      name: 'Финальный рывок',
      description: '×{xMult} Множ на последнем ходу боя',
    },
    j_constellation: {
      name: 'Начитанность',
      description:
        'Накопительно +×{xMultStep} Множ за каждый изученный Том комбинаций (сейчас: ×{xMult})',
    },
    j_hologram: {
      name: 'Призыв союзника',
      description:
        'Накопительно +×{xMultStep} Множ за каждую карту, добавленную в колоду (сейчас: ×{xMult})',
    },
    j_vampire: {
      name: 'Вытягивание чар',
      description:
        'Накопительно +×{xMultStep} Множ за каждую Улучшенную карту в счёте и снимает её улучшение (сейчас: ×{xMult})',
    },
    j_ramen: {
      name: 'Сытный рамен',
      description: '×{xMult} Множ; теряет ×{xMultLoss} за каждую сброшенную карту (исчезает при ×1)',
    },
    j_stencil: {
      name: 'Чистый лист',
      description: '×1 Множ за каждый свободный слот Навыка, включая себя (сейчас: ×{xMult})',
    },
    j_sock_and_buskin: {
      name: 'Эхо приёма',
      description: 'Повторно активирует (+{retriggers} раз) все картинки (В, Д, К) при подсчёте',
    },
    j_mime: {
      name: 'Второе дыхание',
      description: 'Повторно активирует (+{retriggers} раз) все эффекты карт, оставшихся в руке',
    },
    j_four_fingers: {
      name: 'Гибкая техника',
      description: 'Масть и Ряд можно собрать из {cardsRequired} карт вместо 5',
    },
    j_shortcut: {
      name: 'Тайный манёвр',
      description: 'В Ряду допускаются пропуски на 1 ранг (например: Т-Д-10-8-6)',
    },
    j_bull: {
      name: 'Полный кошель',
      description: '+{chipsPerDollar} Силы за каждый 1 з. в вашей казне (сейчас: +{chips})',
    },
    j_duo: {
      name: 'Двойной удар',
      description: '×{xMult} Множ, если комбинация содержит Пару',
    },
    j_tribe: {
      name: 'Боевое братство',
      description: '×{xMult} Множ, если комбинация содержит Масть',
    },
    j_baron: {
      name: 'Королевский указ',
      description: 'Каждый Король, оставшийся в руке при подсчёте, даёт ×{xMult} Множ',
    },
    j_blueprint: {
      name: 'Копирование техники',
      description: 'Копирует способность совместимого Навыка справа',
    },
    j_brainstorm: {
      name: 'Перенимание опыта',
      description: 'Копирует способность самого левого совместимого Навыка',
    },
    j_vagabond: {
      name: 'Странник без гроша',
      description: 'Создаёт случайный Свиток Кузницы при ходе, если в казне не более {maxDollars} з.',
    },
  },
  celestials: {
    c_mercury: {
      name: 'Том парного боя',
      description: '+1 уровень комбинации «Пара» (+{chips} Силы, +{mult} Множ)',
    },
    c_venus: {
      name: 'Том тройного удара',
      description: '+1 уровень комбинации «Тройка» (+{chips} Силы, +{mult} Множ)',
    },
    c_earth: {
      name: 'Том полного строя',
      description: '+1 уровень комбинации «Полный строй» (+{chips} Силы, +{mult} Множ)',
    },
    c_mars: {
      name: 'Том четвёрки',
      description: '+1 уровень комбинации «Четвёрка» (+{chips} Силы, +{mult} Множ)',
    },
    c_jupiter: {
      name: 'Том единой масти',
      description: '+1 уровень комбинации «Масть» (+{chips} Силы, +{mult} Множ)',
    },
    c_saturn: {
      name: 'Том боевого ряда',
      description: '+1 уровень комбинации «Ряд» (+{chips} Силы, +{mult} Множ)',
    },
    c_uranus: {
      name: 'Том двух пар',
      description: '+1 уровень комбинации «Две пары» (+{chips} Силы, +{mult} Множ)',
    },
    c_neptune: {
      name: 'Том штурма',
      description: '+1 уровень комбинации «Мастный ряд» (+{chips} Силы, +{mult} Множ)',
    },
    c_pluto: {
      name: 'Том основы',
      description: '+1 уровень комбинации «Старшая карта» (+{chips} Силы, +{mult} Множ)',
    },
    c_planet_x: {
      name: 'Тайный том X',
      description: '+1 уровень комбинации «Пятёрка» (+{chips} Силы, +{mult} Множ)',
    },
    c_ceres: {
      name: 'Том аристократа',
      description: '+1 уровень комбинации «Мастный строй» (+{chips} Силы, +{mult} Множ)',
    },
    c_eris: {
      name: 'Том легенд',
      description: '+1 уровень комбинации «Мастная пятёрка» (+{chips} Силы, +{mult} Множ)',
    },
  },
  scrolls: {
    c_fool: {
      name: 'Свиток Эха Кузницы',
      description: 'Создаёт копию последнего Свитка Кузницы или Тома комбинаций в забеге (кроме себя)',
    },
    c_magician: {
      name: 'Свиток Благословения',
      description: 'Улучшает до {count} выбранных карт до Благословенных',
    },
    c_empress: {
      name: 'Свиток Горнила',
      description: 'Улучшает до {count} выбранных карт до Пылающих',
    },
    c_heirophant: {
      name: 'Свиток Закалки',
      description: 'Улучшает до {count} выбранных карт до Рунических',
    },
    c_lovers: {
      name: 'Свиток Сплава',
      description: 'Улучшает {count} выбранную карту до карты Хамелеон',
    },
    c_chariot: {
      name: 'Свиток Стальной Ковки',
      description: 'Улучшает {count} выбранную карту до Стальной',
    },
    c_justice: {
      name: 'Свиток Гранильщика',
      description: 'Улучшает {count} выбранную карту до Хрустальной',
    },
    c_devil: {
      name: 'Свиток Позолоты',
      description: 'Улучшает {count} выбранную карту до Золотой',
    },
    c_tower: {
      name: 'Свиток Каменщика',
      description: 'Улучшает {count} выбранную карту до Каменной',
    },
    c_hermit: {
      name: 'Свиток Скупщика',
      description: 'Удваивает текущее золото (макс. +{maxDollars} з.)',
    },
    c_temperance: {
      name: 'Свиток Оценщика',
      description: 'Даёт золото по сумме цены продажи всех ваших Навыков (макс. +{maxDollars} з.)',
    },
    c_wheel_of_fortune: {
      name: 'Молот Удачи',
      description: 'Шанс 1 к {odds} добавить Тиснёное, Радужное или Призматическое издание Навыку',
    },
    c_strength: {
      name: 'Свиток Повышения Ранга',
      description: 'Повышает ранг до {count} выбранных карт на +1 (Т -> 2)',
    },
    c_hanged_man: {
      name: 'Свиток Переплавки',
      description: 'Уничтожает до {count} выбранных карт',
    },
    c_death: {
      name: 'Свиток Штампа',
      description: 'Выберите {count} карты: левая карта превращается в копию правой',
    },
    c_judgement: {
      name: 'Свиток Пробуждения',
      description: 'Открывает случайный Навык, если есть свободный слот',
    },
  },
  runes: {
    c_talisman: {
      name: 'Пандора: Золотая печать',
      description: 'Накладывает Золотую печать на {count} выбранную карту в руке',
    },
    c_deja_vu: {
      name: 'Пандора: Алая печать',
      description: 'Накладывает Алую печать на {count} выбранную карту в руке',
    },
    c_trance: {
      name: 'Пандора: Лазурная печать',
      description: 'Накладывает Лазурную печать на {count} выбранную карту в руке',
    },
    c_medium: {
      name: 'Пандора: Лиловая печать',
      description: 'Накладывает Лиловую печать на {count} выбранную карту в руке',
    },
    c_aura: {
      name: 'Пандора: Сияние',
      description: 'Накладывает Тиснёное, Радужное или Призматическое издание на {count} карту',
    },
    c_cryptid: {
      name: 'Пандора: Двойник',
      description: 'Создаёт {copies} копии {count} выбранной карты прямо в руке',
    },
    c_immolate: {
      name: 'Пандора: Жар Бездны',
      description: 'Уничтожает {destroyCount} случайных карт в руке и даёт +{dollars} з.',
    },
    c_hex: {
      name: 'Пандора: Призма Риска',
      description: 'Делает случайный Навык Призматическим, удаляя все остальные Навыки',
    },
    c_black_hole: {
      name: 'Пандора: Дар Древних',
      description: 'Повышает уровень всех 12 комбинаций на +{levels}',
    },
  },
  charters: {
    v_overstock_norm: {
      name: 'Расширенная витрина',
      description: '+{slots} слот товара у стойки гильдии',
    },
    v_clearance_sale: {
      name: 'Скидка гильдии',
      description: 'Все товары и сундуки стоят на {percent}% дешевле',
    },
    v_hone: {
      name: 'Мастерская огранка',
      description: 'Тиснёные, Радужные и Призматические карты появляются в {rate} раза чаще',
    },
    v_reroll_surplus: {
      name: 'Доступ к складу',
      description: 'Обновление прилавка гильдии стоит на {dollars} з. меньше',
    },
    v_crystal_ball: {
      name: 'Поясная сумка',
      description: '+{slots} слот для расходников',
    },
    v_grabber: {
      name: 'Выносливость',
      description: '+{hands} рука в каждом бою',
    },
    v_wasteful: {
      name: 'Быстрая пересдача',
      description: '+{discards} сброс в каждом бою',
    },
    v_seed_money: {
      name: 'Вклад в казну гильдии',
      description: 'Потолок процентов за бой повышен до {cap} з.',
    },
    v_paint_brush: {
      name: 'Широкий веер',
      description: '+{size} к размеру руки',
    },
    v_telescope: {
      name: 'Ключ от архива',
      description: 'Сундуки Знаний всегда содержат Том вашей самой частой комбинации',
    },
    v_observatory: {
      name: 'Библиотечная карта',
      description: 'Томы комбинаций в слотах расходников дают ×{xMult} Множ для своей комбинации',
    },
    v_directors_cut: {
      name: 'Замена контракта',
      description: 'Позволяет 1 раз за ранг сменить Босса-монстра за {dollars} з.',
    },
  },
  tags: {
    tag_uncommon: {
      name: 'Талон А-ранга',
      description: 'Следующий Навык ранга А у стойки станет бесплатным',
    },
    tag_rare: {
      name: 'Талон мага-мастера',
      description: 'Следующий Навык высшего ранга у стойки станет бесплатным',
    },
    tag_investment: {
      name: 'Талон премии',
      description: 'Даёт +{dollars} з. после победы над Боссом-монстром',
    },
    tag_economy: {
      name: 'Талон казначея',
      description: 'Удваивает ваше текущее золото (макс. +{maxDollars} з.)',
    },
    tag_coupon: {
      name: 'Талон снабжения',
      description: 'Стартовые товары и сундуки при следующем визите бесплатны',
    },
    tag_d_six: {
      name: 'Талон обновления',
      description: 'Обновление при следующем визите начинается с 0 з.',
    },
    tag_double: {
      name: 'Двойной талон',
      description: 'Даёт копию следующего полученного Талона (кроме Двойного талона)',
    },
    tag_juggle: {
      name: 'Талон бодрости',
      description: '+{size} к размеру руки на следующий бой',
    },
    tag_charm: {
      name: 'Талон Кузницы',
      description: 'Мгновенно открывает бесплатный Мега-сундук Кузницы',
    },
    tag_skip: {
      name: 'Талон следопыта',
      description: 'Даёт +{dollarsPerSkip} з. за каждый пропущенный заказ в забеге',
    },
  },
  bosses: {
    bl_hook: {
      name: 'Тролль-грабитель',
      description: 'Сбрасывает {count} случайные карты из руки после каждого хода',
    },
    bl_manacle: {
      name: 'Железный голем',
      description: '-{count} к размеру руки на весь бой',
    },
    bl_psychic: {
      name: 'Магический сфинкс',
      description: 'Нужно разыгрывать ровно {count} карт',
    },
    bl_pillar: {
      name: 'Призрак руин',
      description: 'Карты, уже сыгранные на этом ранге, ослаблены',
    },
    bl_club: {
      name: 'Лесной энт',
      description: 'Все карты масти Трефы ослаблены',
    },
    bl_water: {
      name: 'Песчаный василиск',
      description: 'Начинаете бой с 0 сбросами',
    },
    bl_wall: {
      name: 'Каменный титан',
      description: 'Огромный порог очков (×4 базы)',
    },
    bl_flint: {
      name: 'Кремнёвый виверн',
      description: 'Базовая Сила и Множитель комбинации делятся пополам',
    },
    bl_final_vessel: {
      name: 'Аметистовый дракон',
      description: 'Гигантский порог финального ранга (×6 базы)',
    },
    bl_final_bell: {
      name: 'Лазурная гарпия',
      description: 'При каждом доборе 1 случайная карта в руке принудительно выделяется',
    },
  },
  blinds: {
    small: {
      name: 'Гоблин-налетчик',
      description: 'Обычный заказ гильдии (порог ×1)',
    },
    big: {
      name: 'Орк-берсерк',
      description: 'Сложный заказ гильдии (порог ×1.5)',
    },
    boss: {
      name: 'Босс-монстр',
      description: 'Элитный заказ с особым условием',
    },
  },
  decks: {
    b_red: {
      name: 'Алая колода',
      description: '+{discards} сброс в каждом бою',
    },
    b_blue: {
      name: 'Лазурная колода',
      description: '+{hands} рука в каждом бою',
    },
    b_yellow: {
      name: 'Янтарная колода',
      description: '+{dollars} з. дополнительного стартового золота',
    },
    b_black: {
      name: 'Обсидиановая колода',
      description: '+{relicSlots} слот Навыков, но -{handsLoss} рука в каждом бою',
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
      description: '+3 з. в конце боя, если осталась в руке',
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
      description: '+1 слот Навыка',
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
      description: 'Создаёт Том последней комбинации, если осталась в руке в конце боя',
    },
    purple: {
      name: 'Лиловая печать',
      description: 'Создаёт случайный Свиток Кузницы при сбросе этой карты',
    },
  },
  packTypes: {
    arcana: {
      name: 'Сундук Кузницы',
      description: 'Содержит Свитки Кузницы для ковки и изменения карт',
    },
    celestial: {
      name: 'Сундук Знаний',
      description: 'Содержит Томы комбинаций для усиления приёмов',
    },
    standard: {
      name: 'Сундук Карт',
      description: 'Содержит новые игральные карты для добавления в колоду',
    },
    buffoon: {
      name: 'Сундук Навыков',
      description: 'Содержит случайные Навыки гильдии на выбор',
    },
    spectral: {
      name: 'Сундук Пандоры',
      description: 'Содержит редкие Карты Пандоры с высоким риском',
    },
  },
  packSizes: {
    normal: {
      name: 'Обычный',
      description: 'Стандартный сундук',
    },
    jumbo: {
      name: 'Большой',
      description: 'Крупный сундук с большим выбором',
    },
    mega: {
      name: 'Мега',
      description: 'Редкий сундук с выбором двух наград',
    },
  },
  packs: {
    arcana_normal: 'Обычный сундук Кузницы',
    arcana_jumbo: 'Большой сундук Кузницы',
    arcana_mega: 'Мега-сундук Кузницы',
    celestial_normal: 'Обычный сундук Знаний',
    celestial_jumbo: 'Большой сундук Знаний',
    celestial_mega: 'Мега-сундук Знаний',
    standard_normal: 'Обычный сундук Карт',
    standard_jumbo: 'Большой сундук Карт',
    standard_mega: 'Мега-сундук Карт',
    buffoon_normal: 'Обычный сундук Навыков',
    buffoon_jumbo: 'Большой сундук Навыков',
    buffoon_mega: 'Мега-сундук Навыков',
    spectral_normal: 'Обычный сундук Пандоры',
    spectral_jumbo: 'Большой сундук Пандоры',
    spectral_mega: 'Мега-сундук Пандоры',
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
    '1': 'Ранг B',
    '2': 'Ранг A',
    '3': 'Ранг S',
  },
  consumableKinds: {
    celestial: 'Том комбинаций',
    scroll: 'Свиток Кузницы',
    rune: 'Карта Пандоры',
  },
  trace: {
    card_chips: '+{chips} Силы',
    card_mult: '+{mult} Множ',
    card_x_mult: '×{xMult} Множ',
    card_dollars: '+{dollars} з.',
    card_retrigger: 'Повтор!',
    card_debuffed: 'Ослаблена!',
    card_shatter_glass: 'Хрусталь раскололся!',
    card_shatter_scroll: 'Карта переплавлена',
    card_shatter_rune: 'Сгорела в Бездне',
    card_enhancement_stripped: 'Чары вытянуты',
    hand_card_steel: '×{xMult} Множ',
    hand_card_gold: '+{dollars} з.',
    hand_card_blue_seal: 'Том получен!',
    hand_card_purple_seal: 'Свиток получен!',
    relic_chips: '+{chips} Силы',
    relic_mult: '+{mult} Множ',
    relic_x_mult: '×{xMult} Множ',
    relic_dollars: '+{dollars} з.',
    relic_upgrade: 'Усиление!',
    relic_reset: 'Сброс!',
    relic_destroyed_ceremonial: 'Навык поглощён',
    relic_destroyed_ramen: 'Рамен съеден!',
    relic_destroyed_hex: 'Удалён Пандорой!',
    relic_destroyed_sold: 'Продано',
    relic_scroll_created: 'Свиток создан!',
    consumable_used: 'Применено',
    consumable_nope: 'Неудача!',
    consumable_all_hands_up: 'Все комбинации +{levels} ур.!',
    hand_level_up: '{handName}: Ур. {level}',
    hand_debuffed: 'Комбинация запрещена Боссом!',
    boss_disabled: 'Эффект монстра подавлен!',
    boss_hook_discard: 'Монстр сбросил {count} карты',
    boss_manacle: 'Размер руки -{count}',
    boss_psychic: 'Нужно ровно {count} карт!',
    boss_water: 'Все сбросы обнулены!',
    boss_flint: 'Сила и Множ уполовинены!',
    boss_final_bell: 'Карта принудительно выделена!',
    tag_activated: 'Талон сработал: {tagName}',
    tag_copied: 'Талон скопирован: {tagName}',
    tag_fizzled: 'Талон не сработал',
    blind_defeated: 'Заказ выполнен!',
    run_won: 'Победа! Ранг гильдии {ante}!',
    run_lost: 'Провал на ступени {ante}',
  },
};
