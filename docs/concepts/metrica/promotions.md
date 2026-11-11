---
metadata:
  - name: generator
    content: Diplodoc Platform v5.64.0
alternate:
  - https://yandex.ru/dev/games/doc/en/concepts/metrica/promotions.md
  - https://yandex.ru/dev/games/doc/ru/concepts/metrica/promotions.md
  - https://yandex.ru/dev/games/doc/tr/concepts/metrica/promotions.md
  - https://yandex.ru/dev/games/doc/zh/concepts/metrica/promotions.md
  - href: https://yandex.ru/dev/games/doc/ru/concepts/metrica/promotions.md
    type: text/markdown
    title: Markdown version
  - href: https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509
    rel: describedby
---
> **Documentation Index:** Fetch the complete configuration index at https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509

# Анализ промоакций

<!-- source: ru/_includes/script-common.md -->
<!-- source: ru/_includes/script/index-js.md -->

<!-- endsource: ru/_includes/script/index-js.md -->

<!-- source: ru/_includes/script/requirements-js.md -->

<!-- endsource: ru/_includes/script/requirements-js.md -->

<!-- source: ru/_includes/script/image-modal-js.md -->

<!-- endsource: ru/_includes/script/image-modal-js.md -->
<!-- endsource: ru/_includes/script-common.md -->

Встроенные [метрики](https://yandex.ru/dev/games/doc/ru/concepts/metric.md) в Консоли разработчика показывают аудиторию и покупки игры до и во время промоакции. События Яндекс Метрики дополняют эти показатели подробностями о поведении игрока внутри игры.

Разметьте путь игрока от перехода по промоакции до покупки или награды — вы увидите, дошел ли он до предложения, начал ли покупку и на каком шаге остановился. Результаты помогут подготовить следующий запуск.

Примеры в статье построены на двух промоакциях: скидочный набор `starterPack` и игровое событие `coinQuest`. Анализ возвращаемости описан в разделе [Возвращаемость после промоакции](https://yandex.ru/dev/games/doc/ru/concepts/metrica/players-retention.md#promo-retention).



## Цель промоакции {#objective}

Перед настройкой событий определите цель промоакции и показатели, по которым будете оценивать результат:

#|
|| **Цель промоакции** | **Что смотреть** | **Что можно изменить по результатам** ||
|| Продать набор по скидке | Просмотр предложения → начало покупки → подтверждение | Какой набор и вариант карточки проверить в следующий раз ||
|| Вовлечь в игровое событие | Просмотр события → начало участия → получение награды | Что изменить в задании, награде или времени на прохождение ||
|| Дать новым игрокам повод вернуться | Возвраты после первого входа из промоакции | Какой контент предложить после первого знакомства с игрой ||
|#

Если игра монетизируется через покупки и рекламу, дополнительно сравните покупку набора и просмотр рекламы с вознаграждением в игровом событии. Один игрок может выполнить оба действия.



## Пример воронки {#example}

Воронка для скидочного набора: вход из промоакции → просмотр предложения → начало покупки → подтверждение. Иллюстрация повторяет структуру отчета Яндекс Метрики, данные условные:

![Воронка промоакции: 1000 входов, 700 просмотров предложения, 210 начал покупки, 168 подтверждений. Общая конверсия 16,8 процента.](../../_images/metrica/promo-funnel.svg){inline=false}

Группировка по типу устройства поможет сравнить один и тот же путь на компьютерах и смартфонах. Настройка **Конверсия от первого шага** показывает итоговую конверсию, **Конверсия от предыдущего шага** — переход между соседними шагами.



## Подготовка {#prepare}

1. [Подключите счетчик](https://yandex.ru/dev/games/doc/ru/concepts/yandex-metrica.md#connection), функцию [trackGameEvent()](https://yandex.ru/dev/games/doc/ru/concepts/yandex-metrica.md#send-events) и общую функцию [trackSdkEvent()](https://yandex.ru/dev/games/doc/ru/concepts/metrica/sdk-events.md#context).
1. [Создайте отдельную цель](https://yandex.ru/dev/games/doc/ru/concepts/yandex-metrica.md#goal) для каждого события из примеров.
1. [Добавьте промоакцию](https://yandex.ru/dev/games/doc/ru/console/promo-add.md). Для скидочного набора укажите ID покупки `starterPack`, для задания «Собери монеты» — значение `coinQuest` в поле **Intent**.
1. Подготовьте товар или задание в игре. Скидка и доступность контента задаются отдельно от аналитики.
1. После инициализации SDK [обработайте данные диплинка](#entry).

{% note info %}

`starterPack` и `coinQuest` — ID товара и задания в примерах. Вы можете заменить их своими значениями. ID промоакции в коде задавать не нужно, его передает SDK.

{% endnote %}



## Обработка диплинка {#entry}

После перехода из акционного баннера SDK заполняет объект [ysdk.environment.referrer](https://yandex.ru/dev/games/doc/ru/sdk/sdk-environment.md#structure-referrer):

#|
|| **Параметр** | **Описание** ||
|| `promoId` | ID промоакции. ||
|| `inappId` | ID товара для скидочной акции. ||
|| `intent` | Заданное вами действие, например открытие задания `coinQuest`. ||
|#

После инициализации SDK один раз вызовите `handlePromoLink()`, когда игра готова открывать экраны:

```javascript showLineNumbers
async function handlePromoLink() {
    const entry = ysdk.environment.referrer;
    if (entry?.type !== 'promo') return;

    trackSdkEvent('gamePromoEntry', { promoId: entry.promoId });

    if (entry.inappId) {
        // В примере реализована выдача только набора starterPack.
        if (entry.inappId !== 'starterPack') return;
        await setupPromoOffer(entry.promoId, entry.inappId);
    } else if (entry.intent === 'coinQuest') {
        await setupPromoQuest(entry.promoId);
    }
}
```

Этот обработчик уже отправляет `gamePromoEntry`, поэтому повторять [отдельный пример](https://yandex.ru/dev/games/doc/ru/concepts/metrica/sdk-events.md#promo) логирования входа не нужно. Без диплинка игра запускается обычным способом. Если товар или действие неизвестны, акционный экран не открывается. Когда есть `inappId`, сначала обрабатывается товар.

Обработчик передает ID промоакции в функции [setupPromoOffer()](#discount) и [setupPromoQuest()](#content).



## Скидочный набор {#discount}

В примере `starterPack` — набор из 500 монет по акционной цене. Товар уже есть в каталоге с нужной ценой, а скидочная акция [создана](https://yandex.ru/dev/games/doc/ru/console/promo-add.md) в Консоли. Показывайте набор в период ее действия, название и цену берите из каталога SDK.

В [сценарий покупки](https://yandex.ru/dev/games/doc/ru/concepts/metrica/sdk-events.md#purchases) добавлены открытие экрана и данные диплинка. На экране `shop` разместите кнопку:

```html
<button type="button" id="buyStarterPack" disabled>Купить</button>
```

Обработчик диплинка передает в `setupPromoOffer()` ID промоакции и товара из SDK. Функция загружает товар и открывает магазин. Подключайте обработчик кнопки один раз: при повторном показе того же предложения достаточно отправить `gameOfferView`.

{% note warning %}

Функция `openScreen()` в примере — навигация вашей игры, а не метод SDK. Замените ее своим вызовом, который открывает экран и завершается после его отрисовки.

{% endnote %}

```javascript showLineNumbers
async function setupPromoOffer(promoId, inappId) {
    const catalog = await ysdk.payments.getCatalog();
    const product = catalog.find((item) => item.id === inappId);
    if (!product) return;

    const player = await ysdk.getPlayer();
    await openScreen('shop');
    const button = document.querySelector('#buyStarterPack');
    button.textContent = `${product.title} — ${product.price}`;
    button.disabled = false; // Товар загружен — можно покупать.
    trackSdkEvent('gameOfferView', { promo: { [promoId]: product.id } });

    button.addEventListener('click', async () => {
        button.disabled = true; // Не допускаем повторный клик во время покупки.
        try {
            trackSdkEvent('gamePurchaseStart', { promo: { [promoId]: product.id } });
            const purchase = await ysdk.payments.purchase({ id: product.id });
            trackSdkEvent('gamePurchaseSuccess', {
                promo: { [promoId]: purchase.productID }
            });

            await player.incrementStats({ gold: 500 });
            await ysdk.payments.consumePurchase(purchase.purchaseToken);
        } catch (error) {
            trackSdkEvent('gamePurchaseError', {
                promo: { [promoId]: product.id }
            });
            console.error('Покупка или выдача набора не завершена', error);
        } finally {
            button.disabled = false;
        }
    });
}
```

Если SDK передал `promoId: "123456"` и `inappId: "starterPack"`, параметр `promo` свяжет действие, промоакцию и товар в одной ветке: `event → gameOfferView → promo → 123456 → starterPack`. Эта связь нужна, чтобы построить воронку одного набора в одной промоакции. Передача ID в аналитику не применяет скидку — вам нужно сделать это отдельно.

Создайте цель `gamePurchaseError`: при отказе оплаты или ошибке обработки покупки она получит ID промоакции и товара. Если ошибка произошла после оплаты, также будет отправлено событие `gamePurchaseSuccess`.

{% note warning %}

Пример обрабатывает только `starterPack`, потому что после оплаты выдает именно 500 монет. Для другого товара добавьте свою выдачу и маршрут в `handlePromoLink()`. Сохраните [восстановление покупок](https://yandex.ru/dev/games/doc/ru/concepts/metrica/sdk-events.md#purchases).

{% endnote %}

Дополнительные поля, например показанную цену, добавляйте только тогда, когда вам нужен такой срез. Для этой воронки достаточно ID промоакции и товара.



## Игровое событие {#content}

Для задания, турнира или игрового события отмечайте три действия:

#|
|| **Действие** | **Событие** ||
|| Открылся экран | `gameContentView` ||
|| Игрок начал участие | `gameContentStart` ||
|| Награда выдана, прогресс сохранен | `gameContentReward` ||
|#

На экране задания разместите кнопку:

```html
<button type="button" id="startQuest">Начать задание</button>
```

Для промоакции с `intent: "coinQuest"` обработчик диплинка вызовет `setupPromoQuest()` и передаст ID промоакции:

```javascript showLineNumbers
async function setupPromoQuest(promoId) {
    const questId = 'coinQuest'; // Задание «Собери монеты».
    await openScreen(questId);
    trackSdkEvent('gameContentView', { promo: { [promoId]: questId } });

    document.querySelector('#startQuest').addEventListener('click', () => {
        startQuest(questId);
        trackSdkEvent('gameContentStart', { promo: { [promoId]: questId } });
    });
}
```

`startQuest()` — запуск задания, который уже есть в вашей игре. Добавьте событие в обработчик кнопки и не запускайте задание повторно. Если запуск асинхронный, отправляйте `gameContentStart` после его успешного завершения. Подписку подключите один раз для этой кнопки.

Открытие экрана отмечает только просмотр, а начало участия — нажатие кнопки **Начать задание**.

Запись `[promoId]` подставляет ID из диплинка в название ветки, например `event → gameContentStart → promo → 123456 → coinQuest`. Когда награда выдана и прогресс сохранен, отправьте `gameContentReward` с теми же `promoId` и `questId` из контекста этого задания.

Определите единицу участия: один заход или первое участие в событии. Чтение сохраненного прогресса не создает новую выдачу награды.

Покупки внутри события размечайте так же, как [скидочный набор](#discount). Для [рекламы с вознаграждением](https://yandex.ru/dev/games/doc/ru/concepts/metrica/sdk-events.md#rewarded) задайте отдельный `placement`, например `questBonus`. Событие `gameRewardedEarned` означает засчитанный просмотр, а `gameContentReward` — выдачу игровой награды.



## Настройка отчетов {#reports}

Во всех ветках ниже `123456` — пример ID из SDK. В отчете выбирайте ID вашей промоакции из тех параметров, которые уже поступили в Яндекс Метрику.


### Воронка покупки {#purchase-funnel}

1. Откройте **Отчеты** → **Создать отчет** → **Воронка**.
1. На первом шаге выберите **Параметры события** и полную ветку `event → gameOfferView → promo → 123456 → starterPack`.
1. Добавьте такие же ветки для `gamePurchaseStart` и `gamePurchaseSuccess`.
1. Задайте окно воронки, например 30 минут для быстрой покупки, и период после подключения разметки.
1. Выберите настройку **Конверсия от предыдущего шага** и посмотрите число посетителей.

В примере события относятся к предложению, которое игрок открыл по диплинку. Чтобы учесть вход из каталога, как на иллюстрации из раздела [Пример воронки](#example), добавьте первым шагом ветку `event → gamePromoEntry → promoId → 123456`.

{% note info %}

Выбирайте полные ветки: независимые параметры товара и промоакции за один визит могут относиться к разным действиям. Воронка описывает путь посетителей в выбранном окне, а не отдельные транзакции.

{% endnote %}


### Неудачные попытки покупки {#purchase-errors}

Создайте отдельную воронку из двух шагов:

1. `event → gamePurchaseStart → promo → 123456 → starterPack`
1. `event → gamePurchaseError → promo → 123456 → starterPack`

Воронка покажет, какая доля игроков начала покупку и столкнулась с отказом оплаты или ошибкой обработки. Период и окно оставьте такими же, как в воронке покупки.

Отмена оплаты тоже считается неудачной попыткой. Игрок может повторить покупку и попасть в обе воронки — успешную и неудачную. Ошибка выдачи товара после оплаты также попадет в `gamePurchaseError`. Подробнее — в разделе [Неудачные попытки покупки](https://yandex.ru/dev/games/doc/ru/concepts/metrica/reports.md#purchase-errors).


### Прохождение игрового события {#content-funnel}

Для контента используйте ветку `event → gameContentView → promo → 123456 → coinQuest`, затем такие же ветки для `gameContentStart` и `gameContentReward`. Окно воронки должно позволять пройти задание.

После запуска перейдите к [возвращаемости игроков из промоакции](https://yandex.ru/dev/games/doc/ru/concepts/metrica/players-retention.md#promo-retention).


### Покупки и реклама с вознаграждением {#purchases-and-ads}

Заранее создайте [цели по параметрам](https://yandex.ru/dev/games/doc/ru/concepts/metrica/reports.md#parameter-goals):

- покупка набора — `event → gamePurchaseSuccess → promo → 123456 → starterPack`;
- просмотр рекламы с вознаграждением в событии — `event → gameRewardedEarned → placement → questBonus`.

В отчете **Конверсии** сравните доли посетителей с этими целями и число достижений на посетителя при одинаковом периоде и срезе. Группы пересекаются: игрок может и купить набор, и посмотреть рекламу.

Финансовый результат сверяйте с Консолью — callback-функции не содержат рекламного дохода.



## Подготовка следующего запуска {#next-launch}

#|
|| **Наблюдение** | **Следующее действие** ||
|| Игроки входят из промоакции, но не видят предложение. | Проверьте диплинк и доступность нужного экрана. ||
|| Предложение смотрят, но редко начинают покупку. | Подготовьте для проверки другой состав набора, карточку или место показа. ||
|| Покупку начинают, но не завершают. | Посмотрите долю посетителей с `gamePurchaseError`, затем проверьте обработку оплаты и выдачи товара. ||
|| В событие вступают, но редко получают награду. | Проверьте сложность задания, время на прохождение и выдачу награды. ||
|#

Сопоставьте результат с [метриками игры](https://yandex.ru/dev/games/doc/ru/concepts/metric.md) и [метриками покупок](https://yandex.ru/dev/games/doc/ru/console/purchase-metrics.md). Учитывайте трафик, обновления и состав аудитории: рост в период промоакции сам по себе не доказывает ее влияние.



## Проверка перед запуском {#check}

#|
|| **Что проверить** | **Ожидаемый результат** ||
|| Переход по кнопке **Проверить переход** в Консоли | Открывается нужный экран, после показа отправляется событие. ||
|| Запуск без диплинка | Игра запускается обычным способом, без событий акционного входа и предложения. ||
|| Неизвестный товар или `intent` | Акционный экран не открывается, покупка не запускается. ||
|| Другой товар после перехода | Исходный ID промоакции не подставляется автоматически. ||
|| Отмена и восстановление покупки | Нет ложного подтверждения и повторной продажи. ||
|| Блокировка Яндекс Метрики | Игра и покупки работают. ||
|#

Для проверки оплаты используйте [тестовые покупки](https://yandex.ru/dev/games/doc/ru/console/test-game.md#testing-purchases).
