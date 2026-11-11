---
metadata:
  - name: generator
    content: Diplodoc Platform v5.64.0
alternate:
  - https://yandex.ru/dev/games/doc/en/concepts/metrica/players-retention.md
  - https://yandex.ru/dev/games/doc/ru/concepts/metrica/players-retention.md
  - https://yandex.ru/dev/games/doc/tr/concepts/metrica/players-retention.md
  - https://yandex.ru/dev/games/doc/zh/concepts/metrica/players-retention.md
  - href: https://yandex.ru/dev/games/doc/ru/concepts/metrica/players-retention.md
    type: text/markdown
    title: Markdown version
  - href: https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509
    rel: describedby
---
> **Documentation Index:** Fetch the complete configuration index at https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509

# Удержание игроков

<!-- source: ru/_includes/script-common.md -->
<!-- source: ru/_includes/script/index-js.md -->

<!-- endsource: ru/_includes/script/index-js.md -->

<!-- source: ru/_includes/script/requirements-js.md -->

<!-- endsource: ru/_includes/script/requirements-js.md -->

<!-- source: ru/_includes/script/image-modal-js.md -->

<!-- endsource: ru/_includes/script/image-modal-js.md -->
<!-- endsource: ru/_includes/script-common.md -->

Отчет **Retention** показывает, какая доля игроков возвращается в игру через день, неделю или другой период. По нему вы можете сравнить удержание новых игроков, которые пришли во время разных промоакций.

Для базового отчета достаточно [подключенного счетчика](https://yandex.ru/dev/games/doc/ru/concepts/yandex-metrica.md#connection). Игровой ID, дата создания профиля и уровень дополняют данные об игроке и позволяют подробнее настроить сегменты.



## Идентификаторы игрока {#identity}

В интеграции используются два идентификатора:

#|
|| **Идентификатор** | **Описание** ||
|| `ClientID` | Идентификатор посетителя, который Яндекс Метрика создает автоматически в браузере. ||
|| Игровой ID | Идентификатор из метода [player.getUniqueID()](https://yandex.ru/dev/games/doc/ru/sdk/sdk-player.md#getuniqueid) в SDK Яндекс Игр. Его можно передать в Яндекс Метрику как `UserID`. ||
|#

Метод [setUserID](https://yandex.ru/support/metrica/ru/objects/set-user-id){.external} из JavaScript API счетчика связывает переданный игровой ID с браузерным `ClientID`. Вызов выглядит так: `ym(counterId, 'setUserID', player.getUniqueID())`. В примерах его выполняет общая функция `sendMetrica()`. Создавать цель для вызова не нужно.

При следующих входах передавайте ID текущего игрока в тот же счетчик.

{% note warning %}

Связь игрового ID с `ClientID` позволяет передавать свойства профиля, но сама по себе не объединяет разные устройства в одного пользователя стандартного отчета **Retention**. Подробнее об идентификаторах — в [документации Яндекс Метрики](https://yandex.ru/support/metrica/ru/general/clientid-userid){.external}.

{% endnote %}



## Профиль, визит и действие {#profile}

Способ передачи выбирайте по смыслу параметра:

#|
|| **Данные** | **Куда передать** | **Как использовать** ||
|| Игровой ID | `setUserID` | Связать игровую учетную запись с посетителем Яндекс Метрики. ||
|| Дата создания профиля | `userParams`: `profileCreatedDate` | Выбрать посетителей с профилями, которые созданы в нужный период. ||
|| Уровень при загрузке | `params`: `levelAtLaunch` | Сегментировать визиты по уровню, с которым игрок вошел. ||
|| Уровень в момент действия | Параметры `reachGoal`: `player → level` | Разбирать действия с учетом прогресса игрока. ||
|#

{% note warning %}

`userParams` — свойства посетителя, а не снимок каждого события. Когда вы обновляете значение, оно распространяется на всю историю посетителя. Поэтому изменяемый уровень для анализа прошлых покупок передавайте вместе с действием. Подробнее — в [правилах параметров посетителей](https://yandex.ru/support/metrica/ru/data/user-params-data){.external}.

{% endnote %}


### Создание профиля {#create-profile}

При создании нового профиля возьмите [серверное время](https://yandex.ru/dev/games/doc/ru/sdk/sdk-server-time.md) из SDK, преобразуйте его в дату формата `YYYY-MM-DD` по UTC и сохраните вместе с прогрессом:

```javascript showLineNumbers
async function createProfile(player) {
    const profile = {
        createdDate: new Date(ysdk.serverTime()).toISOString().slice(0, 10),
        level: 1
    };
    await player.setData({ profile }, true);
    return profile;
}
```

Добавьте поля `profile`, `createdDate` и `level` из примера в свою схему сохранений. Вызывайте `createProfile(player)` только в той ветке кода, где профиль создается. При следующих входах загружайте сохраненный профиль через `player.getData(['profile'])`. Если у старого профиля дата неизвестна, оставьте `createdDate` пустым.


### Передача данных в Яндекс Метрику {#send-profile}

После вызова `ysdk.getPlayer()` и загрузки профиля вызовите `identifyPlayer(player, profile)`. Пример использует функцию `sendMetrica()` из раздела [Отправка событий](https://yandex.ru/dev/games/doc/ru/concepts/yandex-metrica.md#send-events) и объект `playerEventParams` из раздела [Общие параметры](https://yandex.ru/dev/games/doc/ru/concepts/metrica/sdk-events.md#context).

```javascript showLineNumbers
function setAnalyticsLevel(level) {
    playerEventParams = { level: String(level) };
}

function identifyPlayer(player, profile) {
    sendMetrica('setUserID', player.getUniqueID());
    if (profile.createdDate) {
        sendMetrica('userParams', {
            profileCreatedDate: profile.createdDate
        });
    }
    setAnalyticsLevel(profile.level);
    sendMetrica('params', { levelAtLaunch: String(profile.level) });
}
```

Когда игрок переходит на новый уровень, вызывайте `setAnalyticsLevel(newLevel)` — следующие события `trackSdkEvent()` получат новое значение. Если уровней в игре нет, исключите оба параметра уровня. После авторизации или смены игрока обновите объект `Player`, профиль и контекст аналитики.

Копировать `userParams` в каждое событие не нужно: Яндекс Метрика сама связывает их с посетителем. Параметр `levelAtLaunch` относится к загрузке игры, которая не обязательно начинает новый визит. Состояние на момент покупки передает параметр `player → level`.



## Настройка отчета Retention {#report}

1. В [Яндекс Метрике](https://metrika.yandex.ru/){.external} откройте **Отчеты** → **Retention**.
1. Выберите период после подключения счетчика и значение **Новые пользователи**, чтобы рассматривать тех, кто впервые пришел в игру по данным Яндекс Метрики.
1. Оставьте группировку **Дата визита**, выберите дни и способ отсчета: календарные дни или интервалы по 24 часа.
1. Начните с показателя **Пользователи** — он отвечает на вопрос, кто вернулся. Чтобы увидеть возвращения с готовой игрой, переключитесь на **Достижения цели** и выберите цель `gameReady`. [Создайте](https://yandex.ru/dev/games/doc/ru/concepts/yandex-metrica.md#goal) ее заранее.
1. Сравнивайте завершившиеся окна D1 и D7. Например, для вчерашней когорты D7 еще неизвестен.
1. Добавьте сегмент по параметрам посетителя или визита.

    {% note info %}

    Сегментация этого отчета применяется только к первым визитам.

    {% endnote %}

Строка отчета — когорта по дате визита, а столбец — время после него. Ячейка с целью `gameReady` показывает долю когорты, которая достигла цели в этом окне. Выберите `gamePurchaseSuccess`, чтобы увидеть долю купивших: исходная когорта при этом останется прежней.

Дата `profileCreatedDate` помогает выбрать профили, но не меняет точку отсчета отчета на дату их создания. Чтобы посчитать удержание от регистрации в вашей игре, понадобится когорта с соответствующим начальным событием и отдельный расчет.

Удержание в Яндекс Метрике показывают разные отчеты:

#|
|| **Отчет** | **Что показывает** ||
|| **Retention** | Долю игроков, которые вернулись через определенный срок после первого визита. ||
|| **Rolling Retention** | Долю игроков, которые вернулись в выбранный период или хотя бы один раз после него. ||
|| **Retention Dynamics** | Удержание разных когорт в сравнении, например, до и после обновления игры. ||
|#

Когда сравниваете периоды между собой, выбирайте один и тот же отчет: показатели рассчитываются по-разному и несопоставимы.

Подробнее о настройках и расчете отчета — в [документации Яндекс Метрики](https://yandex.ru/support/metrica/ru/reports/retention-cohorts){.external}.



## Возвращаемость после промоакции {#promo-retention}

Для новых посетителей, которых привлекла промоакция, добавьте сегмент по ветке первого визита `event → gamePromoEntry → promoId → 123456` из [примера входа](https://yandex.ru/dev/games/doc/ru/concepts/metrica/sdk-events.md#promo). Сначала посмотрите возврат по пользователям, затем — достижение целей `gameReady` или `gamePurchaseSuccess`.

Если в промоакции участвуют давние игроки, удержание от даты участия считайте отдельной событийной когортой.



## Интерпретация результатов {#churn}

Значение `100% − Retention D7` — доля игроков, которые не вернулись в окно D7. Она не означает, что игроки ушли навсегда. Чтобы посчитать тех, кто не возвращался ни разу за семь дней, учитывайте весь период, а не только окно D7.

Сравнивайте одинаковые окна и учитывайте состав аудитории. Перед сопоставлением с [метриками возвращаемости](https://yandex.ru/dev/games/doc/ru/concepts/metric.md#player-retention) в Консоли сверьте определения посетителя, часовой пояс и охват. Если удержание резко изменилось, проверьте адрес запуска и идентификацию: Яндекс Метрика зависит от загрузки счетчика и настроек браузера.

Результат наблюдения используйте для [следующей промоакции](https://yandex.ru/dev/games/doc/ru/concepts/metrica/promotions.md#next-launch): выберите, какой повод для возвращения проверить. Разница в удержании двух когорт сама по себе не доказывает влияние промоакции.
