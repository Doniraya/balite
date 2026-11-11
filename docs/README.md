# База знаний и документация Яндекс Игр (Yandex Games)

Полное руководство разработчика Яндекс Игр, структурированное для локальной разработки, быстрого поиска требований платформы, интеграции SDK и успешного прохождения модерации.

---

## 📌 Быстрый чек-лист готовности к модерации

Перед отправкой игры на модерацию обязательно сверьтесь с ключевыми требованиями платформы:

| Требование | Что проверить | Ссылка на документ |
| :--- | :--- | :--- |
| **Game Ready** | Вызван `ysdk.features.LoadingAPI.ready()` сразу после полной загрузки игры и ассетов. Загрузочный экран обязан исчезать автоматически, без необходимости клика игрока. | [requirements/1-19-sdk-methods.md](requirements/1-19-sdk-methods.md) |
| **Звук вне игры** | Звук обязательно глушится при сворачивании вкладки браузера и во время показа рекламы (`onOpen`). Возобновляется в `onClose`. | [requirements/1-3-sound-outside-game.md](requirements/1-3-sound-outside-game.md) |
| **Облачные сохранения** | Прогресс сохраняется в облако Яндекса через `player.setData()` для авторизованных игроков и в LocalStorage/Cloud для гостей. | [requirements/1-9-progress-saving.md](requirements/1-9-progress-saving.md) |
| **Реклама Interstitial** | Полноэкранная реклама не показывается сразу при старте игры, не мешает геймплею, вызывается между логическими паузами (смерть, уровень) с интервалом не менее 1-3 минут. Задержка перед рекламой не более 2 секунд. | [requirements/4-4-ad-placement.md](requirements/4-4-ad-placement.md) |
| **Реклама Rewarded** | Награда выдается только в колбэке `onRewarded`, звук глушится на время показа. | [sdk/sdk-adv.md](sdk/sdk-adv.md) |
| **Адаптивность (Mobile + PC + TV)** | Игра масштабируется под любые разрешения, не выходит за границы экрана, поддерживает Touch на смартфонах и мышь/клавиатуру на ПК. На ТВ запрещены вертикальные игры и игры, не растянутые на всю доступную область экрана. | [requirements/1-10-correct-display.md](requirements/1-10-correct-display.md) |
| **Авторизация** | Игра не должна принуждать к обязательной авторизации (у игрока должна быть возможность играть гостем). | [requirements/1-2-authorization.md](requirements/1-2-authorization.md) |
| **Локализация** | Язык игры автоматически соответствует языку портала (`ysdk.environment.i18n.lang`). | [requirements/2-14-auto-language-detection.md](requirements/2-14-auto-language-detection.md) |
| **Внешние ссылки** | В игре запрещены любые ссылки на сторонние сайты, соцсети и магазины приложений (за исключением промо-ссылок через Yandex SDK). | [requirements/8-4-1-links-to-other-games.md](requirements/8-4-1-links-to-other-games.md) |
| **Подключение SDK** | Подключение осуществляется строго через относительный путь `/sdk.js`. Запрещены прямые абсолютные ссылки на `games.s3.yandex.net` (ошибка `SERVICE_STORAGE_URL_DETECTED`). | [sdk/sdk-about.md](sdk/sdk-about.md) |
| **Модерация и ЕЛС** | Отправка черновика на проверку модерацией доступна до заключения договора по ЕЛС. Договор обязателен для публикации игры и выплат. | [concepts/moderation.md](concepts/moderation.md) |

---

## ⚡ Шпаргалка по JavaScript SDK (Cheat Sheet)

### 1. Подключение SDK в `index.html`

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <!-- Скрипт Yandex Games SDK -->
    <script src="/sdk.js"></script>
</head>
<body>
    <div id="game-container"></div>
    <script src="main.js"></script>
</body>
</html>
```

### 2. Инициализация и сигнал готовности

```javascript
let ysdk = null;
let player = null;

YaGames.init().then(_ysdk => {
    ysdk = _ysdk;
    console.log('Yandex SDK инициализирован');
    
    // Получение объекта игрока
    return ysdk.getPlayer();
}).then(_player => {
    player = _player;
    
    // Сигнал готовности игры (вызывать, когда меню/сцена загрузилась)
    ysdk.features.LoadingAPI?.ready();
}).catch(err => {
    console.error('Ошибка инициализации SDK:', err);
});
```

### 3. Полноэкранная реклама (Interstitial)

```javascript
function showFullscreenAd() {
    if (!ysdk) return;
    ysdk.adv.showFullscreenAdv({
        callbacks: {
            onOpen: () => {
                // ОБЯЗАТЕЛЬНО заглушить игровой звук
                audioManager.mute();
            },
            onClose: (wasShown) => {
                // Возобновить звук
                audioManager.unmute();
            },
            onError: (error) => {
                audioManager.unmute();
                console.error('Ошибка показа рекламы:', error);
            }
        }
    });
}
```

### 4. Реклама за вознаграждение (Rewarded Video)

```javascript
function showRewardedAd(onRewardSuccess) {
    if (!ysdk) return;
    ysdk.adv.showRewardedVideo({
        callbacks: {
            onOpen: () => {
                audioManager.mute();
            },
            onRewarded: () => {
                // Выдаем награду игроку
                onRewardSuccess();
            },
            onClose: () => {
                audioManager.unmute();
            },
            onError: (error) => {
                audioManager.unmute();
                console.error('Ошибка видеорекламы:', error);
            }
        }
    });
}
```

### 5. Облачные сохранения (Cloud Saves)

```javascript
// Сохранение данных
function saveGameData(dataObj) {
    if (player) {
        player.setData(dataObj, true).then(() => {
            console.log('Данные сохранены в облаке Яндекса');
        });
    } else {
        localStorage.setItem('my_game_save', JSON.stringify(dataObj));
    }
}

// Загрузка данных
function loadGameData() {
    if (player) {
        return player.getData().then(data => data || {});
    } else {
        const local = localStorage.getItem('my_game_save');
        return Promise.resolve(local ? JSON.parse(local) : {});
    }
}
```

---

## 🗂️ Каталог документации

### 1. Основы и концепции
- [overview.md](overview.md) — Преимущества платформы Яндекс Игры и аудитория
- [concepts/quick-start.md](concepts/quick-start.md) — Быстрый старт: от регистрации до релиза
- [concepts/languages-and-domains.md](concepts/languages-and-domains.md) — Поддерживаемые языки и доменные зоны
- [concepts/local-launch.md](concepts/local-launch.md) — Запуск и отладка с локального сервера
- [concepts/performance.md](concepts/performance.md) — Профилирование производительности через DevTools
- [concepts/troubleshooting.md](concepts/troubleshooting.md) — Устранение неполадок и обратная связь

### 2. Требования платформы и модерация (Полный свод)
- [concepts/requirements.md](concepts/requirements.md) — Полный список требований к игре
- [concepts/criteria.md](concepts/criteria.md) — Краткий обзор требований к игре по темам и уровням
- [concepts/moderation.md](concepts/moderation.md) — Процесс проверки и прохождения модерации
- [requirements/1-2-authorization.md](requirements/1-2-authorization.md) — Правила авторизации пользователей
- [requirements/1-3-sound-outside-game.md](requirements/1-3-sound-outside-game.md) — Поведение звука вне игры и при рекламе
- [requirements/1-6-system-player.md](requirements/1-6-system-player.md) — Требования к системному плееру браузера
- [requirements/1-6-2-1-desktop-active-area.md](requirements/1-6-2-1-desktop-active-area.md) — Активное поле на десктопе
- [requirements/1-6-3-tv-adaptation.md](requirements/1-6-3-tv-adaptation.md) — Адаптация игры для Яндекс ТВ и пультов
- [requirements/1-9-progress-saving.md](requirements/1-9-progress-saving.md) — Правила сохранения игрового прогресса
- [requirements/1-10-correct-display.md](requirements/1-10-correct-display.md) — Корректное отображение, масштабирование, адаптив
- [requirements/1-12-monetization-yan.md](requirements/1-12-monetization-yan.md) — Монетизация (РСЯ и Единая лицензионная схема)
- [requirements/1-13-in-app-purchases.md](requirements/1-13-in-app-purchases.md) — Требования к внутриигровым покупкам
- [requirements/1-14-technical-errors.md](requirements/1-14-technical-errors.md) — Список технических ошибок, ведущих к реджекту
- [requirements/1-15-basic-violations.md](requirements/1-15-basic-violations.md) — Завершенный вид игры (наполнение и контент)
- [requirements/1-19-sdk-methods.md](requirements/1-19-sdk-methods.md) — Обязательные методы SDK (Game Ready и др.)
- [requirements/2-4-game-mechanics.md](requirements/2-4-game-mechanics.md) — Требования к понятности и качеству механик
- [requirements/2-7-age-rating.md](requirements/2-7-age-rating.md) — Возрастные рейтинги и классификация
- [requirements/2-9-content-duration.md](requirements/2-9-content-duration.md) — Минимальная длительность контента
- [requirements/2-14-auto-language-detection.md](requirements/2-14-auto-language-detection.md) — Автоматическое определение языка
- [requirements/3-6-game-duplicates.md](requirements/3-6-game-duplicates.md) — Запрет дубликатов и клонов
- [requirements/4-4-ad-placement.md](requirements/4-4-ad-placement.md) — Правильное расположение рекламы
- [requirements/5-1-1-2-gameplay-graphics-demo.md](requirements/5-1-1-2-gameplay-graphics-demo.md) — Демонстрация геймплея на промо
- [requirements/5-1-3-identical-game-title.md](requirements/5-1-3-identical-game-title.md) — Соответствие названий игры
- [requirements/8-2-3-text-translations.md](requirements/8-2-3-text-translations.md) — Требования к качеству переводов
- [requirements/8-3-4-ui-elements.md](requirements/8-3-4-ui-elements.md) — Запрещенные и обязательные элементы интерфейса
- [requirements/8-3-5-erotica-and-discrimination.md](requirements/8-3-5-erotica-and-discrimination.md) — Ограничения по контенту
- [requirements/8-3-6-shocking-content.md](requirements/8-3-6-shocking-content.md) — Запрет шокирующего контента
- [requirements/8-4-1-links-to-other-games.md](requirements/8-4-1-links-to-other-games.md) — Ссылки на внешние ресурсы и игры

### 3. JavaScript / TypeScript SDK
- [sdk/sdk-overview.md](sdk/sdk-overview.md) — Введение в SDK и экосистему
- [sdk/sdk-about.md](sdk/sdk-about.md) — Подключение и базовое использование
- [sdk/sdk-game-events.md](sdk/sdk-game-events.md) — События загрузки игры (`LoadingAPI.ready()`) и геймплея
- [sdk/sdk-player.md](sdk/sdk-player.md) — Работа с игроком, авторизация, облачные сохранения (`player.setData`)
- [sdk/sdk-adv.md](sdk/sdk-adv.md) — Полноэкранная реклама, Rewarded видео и баннеры
- [sdk/sdk-purchases.md](sdk/sdk-purchases.md) — Внутриигровые покупки за игровую валюту платформы (Яны)
- [sdk/sdk-leaderboard.md](sdk/sdk-leaderboard.md) — Создание и обновление таблиц лидеров
- [sdk/sdk-multiplayer-sessions.md](sdk/sdk-multiplayer-sessions.md) — Асинхронный мультиплеер и игровые сессии
- [sdk/sdk-review.md](sdk/sdk-review.md) — Окно оценки игры пользователем (`feedback.requestReview()`)
- [sdk/sdk-shortcut.md](sdk/sdk-shortcut.md) — Предложение добавить ярлык на рабочий стол (`shortcut.showPrompt()`)
- [sdk/sdk-environment.md](sdk/sdk-environment.md) — Переменные окружения (язык, устройство, браузер, полноэкранный режим)
- [sdk/sdk-server-time.md](sdk/sdk-server-time.md) — Получение точного серверного времени
- [sdk/sdk-events.md](sdk/sdk-events.md) — События жизненного цикла игры
- [sdk/sdk-other-games.md](sdk/sdk-other-games.md) — Легальный кросс-промоушн других игр разработчика
- [sdk/sdk-params.md](sdk/sdk-params.md) — Дополнительные параметры и объекты SDK
- [sdk/sdk-config.md](sdk/sdk-config.md) — Удаленная конфигурация игры (Remote Config)
- [sdk/typescript.md](sdk/typescript.md) — Использование SDK с TypeScript (типы, интерфейсы)
- [sdk/sdk-example.md](sdk/sdk-example.md) — Полный комплексный пример интеграции SDK

### 4. Консоль разработчика и публикации
- [console/manage-account.md](console/manage-account.md) — Управление аккаунтом разработчика
- [console/add-new-game.md](console/add-new-game.md) — Добавление новой игры
- [console/add-new-game/draft.md](console/add-new-game/draft.md) — Заполнение полей черновика (иконки, баннеры, описание)
- [console/test-game.md](console/test-game.md) — Тестирование игры в консоли
- [console/draft-mode.md](console/draft-mode.md) — Режим черновика и предпросмотр
- [console/debug-panel.md](console/debug-panel.md) — Debug-панель для проверки SDK в реальном времени
- [console/update-game.md](console/update-game.md) — Выпуск обновлений игры
- [console/ab-builds.md](console/ab-builds.md) — A/B тестирование разных сборок игры
- [console/config-flags.md](console/config-flags.md) — Флаги и эксперименты
- [console/vq-test.md](console/vq-test.md) — Тестирование качества версий
- [console/delete-restore.md](console/delete-restore.md) — Удаление и восстановление игр
- [console/teamwork.md](console/teamwork.md) — Командный доступ к консоли

### 5. Монетизация, аналитика и оперирование (LiveOps)
- [services/about-monetization.md](services/about-monetization.md) — Принципы монетизации на Яндекс Играх
- [console/adv-monetization.md](console/adv-monetization.md) — Настройка рекламной монетизации
- [console/purchases.md](console/purchases.md) — Настройка каталога инап-покупок
- [payments/licensing-scheme.md](payments/licensing-scheme.md) — Единая лицензионная схема расчетов
- [payments/self-employed.md](payments/self-employed.md) — Сотрудничество с самозанятыми разработчиками
- [console/total-income.md](console/total-income.md) — Отслеживание общего дохода и отчеты
- [liveops/liveops-overview.md](liveops/liveops-overview.md) — Оперирование игрой (LiveOps)
- [concepts/analytics.md](concepts/analytics.md) — Аналитика игр на платформе
- [console/control-panel.md](console/control-panel.md) — Панель управления и дашборды
- [concepts/metric.md](concepts/metric.md) — Метрики игры (удержание, время, сессии)
- [console/purchase-metrics.md](console/purchase-metrics.md) — Метрики покупок (ARPU, конверсия)
- [concepts/yandex-metrica.md](concepts/yandex-metrica.md) — Подключение счетчика Яндекс Метрики (разметка обучения и уровней)
- [concepts/metrica/sdk-events.md](concepts/metrica/sdk-events.md) — Разметка событий SDK в Яндекс Метрике
- [concepts/metrica/promotions.md](concepts/metrica/promotions.md) — Анализ промоакций через Яндекс Метрику
- [concepts/metrica/reports.md](concepts/metrica/reports.md) — Воронки и цели в Яндекс Метрике
- [concepts/metrica/players-retention.md](concepts/metrica/players-retention.md) — Удержание игроков (Retention) в Яндекс Метрике
- [console/reviews.md](console/reviews.md) — Работа с отзывами игроков
- [concepts/leaderboards.md](concepts/leaderboards.md) — Механики соревнований и лидербордов
- [concepts/promotion.md](concepts/promotion.md) — Привлечение игроков
- [concepts/paid-promotion.md](concepts/paid-promotion.md) — Платное продвижение в каталоге и Директ Про
- [concepts/start-screen.md](concepts/start-screen.md) — Платное продвижение (алиас)
- [concepts/ranking-and-featuring.md](concepts/ranking-and-featuring.md) — Органическое ранжирование и фичеринг в каталоге
- [concepts/ab-test.md](concepts/ab-test.md) — A/B тестирование иконок и промоматериалов
- [console/promo-and-discounts.md](console/promo-and-discounts.md) — Участие в промоакциях и скидках
- [console/promo-rules.md](console/promo-rules.md) — Правила участия в акциях
- [console/promo-add.md](console/promo-add.md) — Подключение акций к игре

### 6. Плагины для сторонних движков
- **Unity**:
  - [sdk/unity/install.md](sdk/unity/install.md) — Установка PluginYG2
  - [sdk/unity/advertisement.md](sdk/unity/advertisement.md) — Реклама в Unity
  - [sdk/unity/env-auth-lang.md](sdk/unity/env-auth-lang.md) — Окружение, авторизация, язык
  - [sdk/unity/progress-saving.md](sdk/unity/progress-saving.md) — Сохранения в Unity
  - [sdk/unity/leaderboards.md](sdk/unity/leaderboards.md) — Лидерборды
  - [sdk/unity/inaps.md](sdk/unity/inaps.md) — Покупки в Unity
  - [sdk/unity/metrics.md](sdk/unity/metrics.md) — Метрика
  - [sdk/unity/other.md](sdk/unity/other.md) — Ярлыки, серверное время, оценки
  - [sdk/unity/flags-links.md](sdk/unity/flags-links.md) — Флаги и ссылки
  - [sdk/unity/setting-up.md](sdk/unity/setting-up.md) — Оптимизация сборки WebGL
- **Cocos Creator**:
  - [sdk/cocos/install.md](sdk/cocos/install.md), [sdk/cocos/ysdk.md](sdk/cocos/ysdk.md), [sdk/cocos/localization.md](sdk/cocos/localization.md), [sdk/cocos/testing.md](sdk/cocos/testing.md)
- **Construct 3**:
  - [sdk/construct-3/about.md](sdk/construct-3/about.md), [sdk/construct-3/ads.md](sdk/construct-3/ads.md), [sdk/construct-3/authorization-and-data.md](sdk/construct-3/authorization-and-data.md), [sdk/construct-3/leaderboards.md](sdk/construct-3/leaderboards.md), [sdk/construct-3/in-game-purchases.md](sdk/construct-3/in-game-purchases.md) и др.
- **Defold**:
  - [sdk/defold/install.md](sdk/defold/install.md), [sdk/defold/game-start.md](sdk/defold/game-start.md), [sdk/defold/adv.md](sdk/defold/adv.md), [sdk/defold/player-data.md](sdk/defold/player-data.md), [sdk/defold/leaderboard.md](sdk/defold/leaderboard.md) и др.
