---
metadata:
  - name: generator
    content: Diplodoc Platform v5.64.0
alternate:
  - https://yandex.ru/dev/games/doc/en/concepts/metrica/sdk-events.md
  - https://yandex.ru/dev/games/doc/ru/concepts/metrica/sdk-events.md
  - https://yandex.ru/dev/games/doc/tr/concepts/metrica/sdk-events.md
  - https://yandex.ru/dev/games/doc/zh/concepts/metrica/sdk-events.md
  - href: https://yandex.ru/dev/games/doc/ru/concepts/metrica/sdk-events.md
    type: text/markdown
    title: Markdown version
  - href: https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509
    rel: describedby
---
> **Documentation Index:** Fetch the complete configuration index at https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509

# События SDK

<!-- source: ru/_includes/script-common.md -->
<!-- source: ru/_includes/script/index-js.md -->

<!-- endsource: ru/_includes/script/index-js.md -->

<!-- source: ru/_includes/script/requirements-js.md -->

<!-- endsource: ru/_includes/script/requirements-js.md -->

<!-- source: ru/_includes/script/image-modal-js.md -->

<!-- endsource: ru/_includes/script/image-modal-js.md -->
<!-- endsource: ru/_includes/script-common.md -->

Добавьте вызовы Яндекс Метрики к методам SDK Яндекс Игр — вы сможете проследить покупку от показа товара до оплаты, определить источник перехода из промоакции и сравнить места показа рекламы.

Перед началом работы [подключите счетчик](https://yandex.ru/dev/games/doc/ru/concepts/yandex-metrica.md#connection) и функцию [trackGameEvent()](https://yandex.ru/dev/games/doc/ru/concepts/yandex-metrica.md#send-events), а затем [создайте отдельную цель](https://yandex.ru/dev/games/doc/ru/concepts/yandex-metrica.md#goal) для каждого события из примеров.

{% note info %}

Имена вида `gamePurchaseSuccess` заданы для примеров. SDK не отправляет эти события автоматически — вызовы Яндекс Метрики вы добавляете сами.

{% endnote %}



## Общие параметры {#context}

После [инициализации SDK](https://yandex.ru/dev/games/doc/ru/sdk/sdk-about.md#connect) один раз за загрузку передайте данные игры. Объект [environment](https://yandex.ru/dev/games/doc/ru/sdk/sdk-environment.md) содержит ID игры и язык платформы:

```javascript showLineNumbers
sendMetrica('params', {
    game: {
        appId: ysdk.environment.app.id,
        language: ysdk.environment.i18n.lang
    }
});
```

Функция `trackSdkEvent()` передает параметры действия в ветке `event`, а свойства игрока — в ветке `player`:

```javascript showLineNumbers
let playerEventParams = {};

function trackSdkEvent(name, params = {}) {
    trackGameEvent(name, {
        event: { [name]: params },
        player: playerEventParams
    });
}
```

Например, вызов `trackSdkEvent('gameOfferView', { productId: 'gold500' })` создаст ветку `event → gameOfferView → productId → gold500`. По ней вы сможете выбрать в отчете просмотр именно этого товара.

Пока объект `playerEventParams` остается пустым. Как добавить в него уровень игрока — в разделе [Профиль, визит и действие](https://yandex.ru/dev/games/doc/ru/concepts/metrica/players-retention.md#profile).



## Готовность игры {#ready}

Добавьте событие Яндекс Метрики к вызову [LoadingAPI.ready()](https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events.md#ready):

```javascript showLineNumbers
function reportGameReady() {
    ysdk.features.LoadingAPI?.ready();
    trackSdkEvent('gameReady');
}
```

Вызывайте функцию один раз, когда игра готова к взаимодействию. Цель `gameReady` пригодится для [удержания по загрузкам игры](https://yandex.ru/dev/games/doc/ru/concepts/metrica/players-retention.md#report).



## Инап-покупки {#purchases}

В основе сценария — пример покупки из [документации SDK](https://yandex.ru/dev/games/doc/ru/sdk/sdk-purchases.md): товар `gold500` выдает 500 монет.

В примере SDK инициализирован с `signed: false`, а товар уже добавлен в Консоли. Код получает каталог, показывает кнопку с ценой и отправляет события просмотра, начала покупки и успешной оплаты.

Добавьте кнопку на экран магазина:

```html
<button type="button" id="buyGold" disabled>Купить</button>
```

Пока товар загружается, кнопка недоступна. При первом открытии экрана вызовите `setupGoldOffer()` один раз для этой кнопки. При повторном показе того же экрана отправьте только `gameOfferView`: обработчик уже подключен, добавлять его заново не нужно.

```javascript showLineNumbers
async function setupGoldOffer() {
    const catalog = await ysdk.payments.getCatalog();
    const product = catalog.find((item) => item.id === 'gold500');
    if (!product) return; // Товар недоступен этому игроку.

    const player = await ysdk.getPlayer();
    const button = document.querySelector('#buyGold');
    button.textContent = `${product.title} — ${product.price}`;
    button.disabled = false; // Товар загружен — можно покупать.
    trackSdkEvent('gameOfferView', { productId: product.id });

    button.addEventListener('click', async () => {
        button.disabled = true; // Не допускаем повторный клик во время покупки.
        try {
            trackSdkEvent('gamePurchaseStart', { productId: product.id });
            const purchase = await ysdk.payments.purchase({ id: product.id });
            trackSdkEvent('gamePurchaseSuccess', { productId: purchase.productID });

            await player.incrementStats({ gold: 500 });
            await ysdk.payments.consumePurchase(purchase.purchaseToken);
        } catch (error) {
            trackSdkEvent('gamePurchaseError', { productId: product.id });
            console.error('Покупка или выдача монет не завершена', error);
        } finally {
            button.disabled = false;
        }
    });
}
```

Событие `gamePurchaseSuccess` отмечает успешный ответ на оплату до выдачи товара. При отмене оплаты событие не отправится. Цена и валюта на кнопке берутся из каталога, токен покупки в Метрику не передается.

Создайте также цель `gamePurchaseError`: она отмечает попытку, при которой оплата или обработка покупки завершилась ошибкой. Отмена оплаты тоже попадает в эту цель. Если сбой произошел после оплаты, для одной покупки будут отправлены и `gamePurchaseSuccess`, и `gamePurchaseError`. Подробнее — в разделе [Неудачные попытки покупки](https://yandex.ru/dev/games/doc/ru/concepts/metrica/reports.md#purchase-errors).

{% note warning %}

В игре сохраните обработку ошибок, [восстановление необработанных покупок](https://yandex.ru/dev/games/doc/ru/sdk/sdk-purchases.md#check-purchases) и защиту от повторной выдачи. Чтение `getPurchases()` не должно отмечать новую продажу. Для `signed: true` отправляйте успех после проверки подписи на сервере.

{% endnote %}

Воронка для этого сценария: `gameOfferView → gamePurchaseStart → gamePurchaseSuccess`. Как добавить к нему скидочную промоакцию — в разделе [Скидочный набор](https://yandex.ru/dev/games/doc/ru/concepts/metrica/promotions.md#discount).



## Переход из промоакции {#promo}

После [инициализации SDK](https://yandex.ru/dev/games/doc/ru/sdk/sdk-about.md#connect) прочитайте [referrer](https://yandex.ru/dev/games/doc/ru/sdk/sdk-environment.md#structure-referrer) и отправьте событие входа один раз:

```javascript showLineNumbers
const entry = ysdk.environment.referrer;
if (entry?.type === 'promo') {
    trackSdkEvent('gamePromoEntry', { promoId: entry.promoId });
}
```

В отчете появится ветка `event → gamePromoEntry → promoId → <ID промоакции>`, которая описывает источник входа. В [полном примере](https://yandex.ru/dev/games/doc/ru/concepts/metrica/promotions.md#entry) этот ID передается в обработчик товара или задания, открытого по диплинку. Другие покупки в игре не нужно автоматически относить к этой промоакции.

Обработайте `referrer.inappId` или `referrer.intent`, а затем отметьте фактический показ предложения. Диплинк сам по себе его не подтверждает.



## Реклама с вознаграждением {#rewarded}

В методе [showRewardedVideo()](https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv.md#show-rewarded-video) различайте запрос, открытие и засчитанный просмотр. Параметр `placement` — идентификатор места показа, например `revive` для возрождения персонажа.

Передайте в `callbacks` текущие обработчики паузы, звука, награды и возобновления игры:

```javascript showLineNumbers
function showRewardedWithAnalytics(placement, callbacks) {
    const params = { placement };
    trackSdkEvent('gameRewardedRequest', params);

    ysdk.adv.showRewardedVideo({
        callbacks: {
            onOpen: () => {
                trackSdkEvent('gameRewardedOpen', params);
                callbacks.onOpen?.();
            },
            onRewarded: () => {
                trackSdkEvent('gameRewardedEarned', params);
                callbacks.onRewarded?.();
            },
            onClose: (...args) => {
                trackSdkEvent('gameRewardedClose', params);
                callbacks.onClose?.(...args);
            },
            onError: (error) => {
                trackSdkEvent('gameRewardedError', params);
                callbacks.onError?.(error);
            }
        }
    });
}
```

Замените существующий рекламный вызов этой оберткой в том же месте игры.

{% note warning %}

Награду начисляйте только в `onRewarded`. Закрытие рекламы ее не подтверждает, а засчитанный просмотр еще не означает сохранение награды.

{% endnote %}

Воронка для этого сценария: `gameRewardedRequest → gameRewardedOpen → gameRewardedEarned`. Сравнивайте по ней места показа. Денежного дохода эти callback-функции не содержат.



## Полноэкранная реклама {#fullscreen}

У метода [showFullscreenAdv()](https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv.md#show-fullscreen-adv) успешное открытие отмечает `onOpen`, а `onClose` передает `wasShown`.

Передайте в `callbacks` текущие игровые обработчики:

```javascript showLineNumbers
function showFullscreenWithAnalytics(placement, callbacks) {
    trackSdkEvent('gameFullscreenRequest', { placement });

    ysdk.adv.showFullscreenAdv({
        callbacks: {
            onOpen: () => {
                trackSdkEvent('gameFullscreenOpen', { placement });
                callbacks.onOpen?.();
            },
            onClose: (wasShown) => {
                trackSdkEvent('gameFullscreenClose', {
                    placement,
                    wasShown: wasShown ? 'yes' : 'no'
                });
                callbacks.onClose?.(wasShown);
            },
            onError: (error) => {
                trackSdkEvent('gameFullscreenError', { placement });
                callbacks.onError?.(error);
            }
        }
    });
}
```

Значение `wasShown: false` не подтверждает показ. Закрытие и ошибка могут относиться к одной попытке — не складывайте их.

{% note info %}

По этой разметке нельзя восстановить все показы и CPM: [реклама на старте](https://yandex.ru/dev/games/doc/ru/sdk/sdk-events.md#startup-fullscreen-ad) не дает таких callback-функций, а статус стики-баннера не дает числа показов.

{% endnote %}
