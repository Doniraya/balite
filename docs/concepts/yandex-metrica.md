---
metadata:
  - name: generator
    content: Diplodoc Platform v5.64.0
alternate:
  - https://yandex.ru/dev/games/doc/en/concepts/yandex-metrica.md
  - https://yandex.ru/dev/games/doc/ru/concepts/yandex-metrica.md
  - https://yandex.ru/dev/games/doc/tr/concepts/yandex-metrica.md
  - https://yandex.ru/dev/games/doc/zh/concepts/yandex-metrica.md
  - href: https://yandex.ru/dev/games/doc/ru/concepts/yandex-metrica.md
    type: text/markdown
    title: Markdown version
  - href: https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509
    rel: describedby
---
> **Documentation Index:** Fetch the complete configuration index at https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509

# Яндекс Метрика

<!-- source: ru/_includes/script-common.md -->
<!-- source: ru/_includes/script/index-js.md -->

<!-- endsource: ru/_includes/script/index-js.md -->

<!-- source: ru/_includes/script/requirements-js.md -->

<!-- endsource: ru/_includes/script/requirements-js.md -->

<!-- source: ru/_includes/script/image-modal-js.md -->

<!-- endsource: ru/_includes/script/image-modal-js.md -->
<!-- endsource: ru/_includes/script-common.md -->

Встроенные [метрики](https://yandex.ru/dev/games/doc/ru/concepts/metric.md) в Консоли разработчика показывают аудиторию и покупки игры в целом и не требуют настройки. Счетчик Яндекс Метрики дополняет их: вы сможете проследить путь игрока внутри игры — как он проходит обучение, доходит до покупки и возвращается после промоакции.

Общий принцип: вы передаете действия, их параметры и свойства игрока, а затем используете эти данные в отчетах.

Перед началом работы [подключите счетчик](#connection) к игре.

Настройка Яндекс Метрики показана на двух примерах:

- [Обучение](#tutorial) — отдельное событие на каждое действие игрока. Покажет, какая доля игроков завершает обучение, а какая пропускает его.
- [Прохождение уровней](#parameters) — одно событие с параметром. Покажет, сколько игроков завершили каждый уровень.

Остальные сценарии описаны в отдельных статьях:

- [События SDK](https://yandex.ru/dev/games/doc/ru/concepts/metrica/sdk-events.md) — разметка покупок, рекламы и других методов SDK Яндекс Игр.
- [Анализ промоакций](https://yandex.ru/dev/games/doc/ru/concepts/metrica/promotions.md) — путь игрока от перехода по промоакции до покупки или награды.
- [Воронки и цели](https://yandex.ru/dev/games/doc/ru/concepts/metrica/reports.md) — настройка воронок, целей по параметрам и мультицелей.
- [Удержание игроков](https://yandex.ru/dev/games/doc/ru/concepts/metrica/players-retention.md) — доля игроков, которые возвращаются в игру.



## Подключение счетчика {#connection}

Если счетчик уже подключен к игре, используйте его и перейдите к [настройке целей](#goal).

1. Откройте [Яндекс Метрику](https://metrika.yandex.ru/){.external} и [создайте счетчик](https://yandex.ru/support/metrica/ru/general/creating-counter){.external}.
1. Снимите отметку в поле **Принимать данные только с указанных адресов**.
1. Добавьте счетчик в игру:

    1. Перейдите на вкладку **Настройки** → **Счётчик**.
    1. В блоке **Код счетчика** нажмите **Скопировать код**.
    1. Вставьте код в файл `index.html` перед [кодом отправки событий](#send-events).

1. [Обновите версию игры](https://yandex.ru/dev/games/doc/ru/console/update-game.md) в Консоли. Игра заново пройдет модерацию.



## Обучение {#tutorial}

Чтобы узнать, какая доля игроков завершает обучение, разметьте три действия:

#|
|| **Действие** | **Событие** ||
|| Игрок начал обучение | `gameTutorialStart` ||
|| Игрок выполнил последний шаг обучения | `gameTutorialComplete` ||
|| Игрок выбрал пропуск обучения | `gameTutorialSkip` ||
|#

Яндекс Метрика будет учитывать эти действия в отчетах о конверсиях и воронках.

Имена событий и параметров в примерах записаны в camelCase. Вы можете выбрать свои имена, но в коде игры и в настройках целей они должны совпадать. Названия полей SDK изменять не нужно.


### Настройка целей {#goal}

1. В [Яндекс Метрике](https://metrika.yandex.ru/){.external} выберите счетчик и нажмите **Цели** → **Добавить цель**.
1. Укажите название цели, например «Начало обучения», и выберите тип **Целевое событие** (прежнее название — **JS-событие**).
1. Задайте точное совпадение с идентификатором `gameTutorialStart`.
1. Повторите шаги 1–3 для `gameTutorialComplete` и `gameTutorialSkip`.


### Отправка событий {#send-events}

Метод счетчика `reachGoal` сообщает о достижении цели. В примере функция `trackGameEvent()` вызывает его с именем и параметрами действия. Замените `0` на ваш номер счетчика:

```javascript showLineNumbers
const counterId = 0; // Укажите ваш номер счетчика.

function sendMetrica(method, ...args) {
    if (counterId <= 0 || typeof window.ym !== 'function') return;
    try {
        window.ym(counterId, method, ...args);
    } catch {
        // Ошибка аналитики не должна прерывать игру.
    }
}

function trackGameEvent(name, params = {}) {
    sendMetrica('reachGoal', name, params);
}
```

Добавьте каждый вызов в обработчик соответствующего действия:

```javascript showLineNumbers
// Игрок начал обучение.
trackGameEvent('gameTutorialStart');

// Игрок выполнил последний шаг обучения.
trackGameEvent('gameTutorialComplete');

// Игрок выбрал пропуск обучения.
trackGameEvent('gameTutorialSkip');
```

Установите код счетчика до отправки событий. Если счетчик недоступен, функция `sendMetrica()` пропустит вызов, чтобы ошибка аналитики не прервала игру.

{% note warning %}

Создавайте отдельную цель для каждого имени (`name`), которое отправляете через метод `reachGoal`. Без цели параметры вызова не попадут в [отчет «Параметры событий»](https://yandex.ru/support/metrica/ru/reports/event-params){.external}.

{% endnote %}


### Проверка разметки {#check}

1. Откройте игру с параметром `_ym_debug=1` в адресе. Платформа автоматически передаст его в `iframe` игры.
1. В браузере откройте консоль DevTools и выберите контекст игры.
1. Пройдите обучение и в консоли найдите сообщения `Reach goal` с номером вашего счетчика и целями `gameTutorialStart` и `gameTutorialComplete`.
1. Отдельно проверьте пропуск обучения: должны отправиться `gameTutorialStart` и `gameTutorialSkip`, без `gameTutorialComplete`.
1. Проверьте параметры событий и убедитесь, что одно действие не отправляется повторно.

Если данные не появляются в отчетах, проверьте опцию **Не учитывать мои визиты** (**Настройки** → **Фильтры**).

{% note tip %}

В Яндекс Метрике есть два [способа отладки](https://yandex.ru/support/metrica/ru/general/check-goal){.external}:

- `_ym_debug=1` — выводит сообщения в консоль DevTools.
- `_ym_debug=2` — выводит визуальную панель внизу страницы, но доступен только с новым кодом счетчика.

Оба способа подходят для проверки кода из примера.

{% endnote %}


### Создание воронки {#create-funnel}

1. В [Яндекс Метрике](https://metrika.yandex.ru/){.external} откройте **Отчеты** → **Создать отчет** → **Воронка**.
1. Добавьте два шага с условием **Достижение JS-цели**: `gameTutorialStart` и `gameTutorialComplete`.
1. Задайте окно воронки — время, за которое игрок должен выполнить всю последовательность. Для короткого обучения начните с 30 минут и проверьте, подходит ли это значение игре.
1. В отчете выберите период после подключения событий.

Настройка **Конверсия от первого шага** покажет долю игроков, которые начали обучение и завершили его в выбранном окне. Пропуск обучения анализируйте отдельно или объедините с завершением в [мультицель](https://yandex.ru/dev/games/doc/ru/concepts/metrica/reports.md#multi-goal).



## Прохождение уровней {#parameters}

Чтобы узнать, сколько игроков завершили каждый уровень, передавайте их идентификатор через `params` — метод счетчика для дополнительных параметров:

```javascript showLineNumbers
function trackLevelComplete(levelId) {
    sendMetrica('params', { levelComplete: String(levelId) });
}

// В обработчике успешного завершения уровня.
trackLevelComplete('level3');
```

В отчете **Параметры событий** откройте `levelComplete`: значения `level1`, `level2` и `level3` покажут число посетителей, которые завершили каждый уровень.

Чтобы смотреть конверсию посетителей в завершение третьего уровня, заранее создайте [цель типа «Параметры»](https://yandex.ru/support/metrica/ru/general/parameters-goal){.external} по ветке `levelComplete → level3`. Новая цель не пересчитывает прошлые данные.
