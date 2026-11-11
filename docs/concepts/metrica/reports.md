---
metadata:
  - name: generator
    content: Diplodoc Platform v5.64.0
alternate:
  - https://yandex.ru/dev/games/doc/en/concepts/metrica/reports.md
  - https://yandex.ru/dev/games/doc/ru/concepts/metrica/reports.md
  - https://yandex.ru/dev/games/doc/tr/concepts/metrica/reports.md
  - https://yandex.ru/dev/games/doc/zh/concepts/metrica/reports.md
  - href: https://yandex.ru/dev/games/doc/ru/concepts/metrica/reports.md
    type: text/markdown
    title: Markdown version
  - href: https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509
    rel: describedby
---
> **Documentation Index:** Fetch the complete configuration index at https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509

# Воронки и цели

<!-- source: ru/_includes/script-common.md -->
<!-- source: ru/_includes/script/index-js.md -->

<!-- endsource: ru/_includes/script/index-js.md -->

<!-- source: ru/_includes/script/requirements-js.md -->

<!-- endsource: ru/_includes/script/requirements-js.md -->

<!-- source: ru/_includes/script/image-modal-js.md -->

<!-- endsource: ru/_includes/script/image-modal-js.md -->
<!-- endsource: ru/_includes/script-common.md -->

По событиям игры в Яндекс Метрике вы можете оценить прохождение обучения, покупку набора или участие в промоакции. Тип отчета выбирайте по вопросу, на который хотите ответить:

#|
|| **Тип отчета** | **На какой вопрос отвечает** ||
|| [Воронка](#funnels) | На каком шаге прерывается путь: от просмотра набора до покупки или от открытия события до награды. ||
|| [Цель](#parameter-goals) | Какая доля посетителей выполняет нужное действие, например покупает конкретный набор. ||
|| [Мультицель](#multi-goal) | Какая доля посетителей выполняет хотя бы одно из выбранных действий. ||
|#

Для настройки используйте [события SDK](https://yandex.ru/dev/games/doc/ru/concepts/metrica/sdk-events.md) или [события промоакции](https://yandex.ru/dev/games/doc/ru/concepts/metrica/promotions.md). Анализ возвращаемости описан на странице [Удержание игроков](https://yandex.ru/dev/games/doc/ru/concepts/metrica/players-retention.md).



## Выбор воронки {#funnels}

#|
|| **Вопрос** | **Последовательность событий** ||
|| Доходят ли игроки до покупки? | `gameOfferView` → `gamePurchaseStart` → `gamePurchaseSuccess` ||
|| Покупают ли после входа из промоакции? | `gamePromoEntry` → просмотр предложения → начало покупки → подтверждение ||
|| Завершают ли обучение? | `gameTutorialStart` → `gameTutorialComplete` ||
|| Досматривают ли рекламу с вознаграждением? | `gameRewardedRequest` → `gameRewardedOpen` → `gameRewardedEarned` ||
|#

Откройте **Отчеты** → **Создать отчет** → **Воронка**, добавьте шаги и задайте окно воронки — время, за которое игрок должен выполнить всю последовательность. Выберите срок с учетом длительности сценария в вашей игре: например, 30 минут для короткого сценария или сутки для отложенной покупки.

Настройка **Конверсия от предыдущего шага** поможет найти потери, а **Конверсия от первого шага** — оценить весь путь целиком. Подробнее — в [настройках воронки](https://yandex.ru/support/metrica/ru/reports/funnels){.external}.


### Одинаковый товар и место показа {#same-object}

Для товара из [примера магазина](https://yandex.ru/dev/games/doc/ru/concepts/metrica/sdk-events.md#purchases) используйте условие **Параметры события** с полной веткой: `event → gameOfferView → productId → gold500`.

На следующих шагах замените имя события на `gamePurchaseStart` и `gamePurchaseSuccess`. Для рекламы выберите ветку `event → gameRewardedOpen → placement → revive` и соответствующие соседние шаги. В промоакции ветка дополнительно содержит ее ID — смотрите раздел [Настройка отчетов](https://yandex.ru/dev/games/doc/ru/concepts/metrica/promotions.md#reports).

Полная ветка связывает действие с товаром, а воронка описывает путь посетителя в выбранном окне. Для учета отдельных транзакций используйте свою систему покупок.

{% note warning %}

Если добавляете к шагу несколько условий, проверьте оператор: по умолчанию стоит **ИЛИ**. Чтобы выполнялись все условия, выберите **И**.

{% endnote %}


### Неудачные попытки покупки {#purchase-errors}

Для товара `gold500` создайте отдельную воронку из двух шагов:

1. `event → gamePurchaseStart → productId → gold500`
1. `event → gamePurchaseError → productId → gold500`

Воронка покажет долю посетителей с неудачной попыткой среди тех, кто начал покупку. Для акционного товара используйте [ветки с ID промоакции](https://yandex.ru/dev/games/doc/ru/concepts/metrica/promotions.md#reports).

Отмена оплаты тоже попадает в `gamePurchaseError`. Ошибка обработки после оплаты не отменяет событие `gamePurchaseSuccess`, а повторная попытка может завершиться успешно. Поэтому доли посетителей с успехом и ошибкой могут пересекаться, а число событий не равно числу уникальных транзакций.



## Цель для конкретного товара или уровня {#parameter-goals}

Общая цель покупки объединяет все товары. Чтобы оценить покупку акционного набора `starterPack`, создайте цель типа **Параметры** по ветке `event → gamePurchaseSuccess → promo → 123456 → starterPack`. В отчете **Конверсии** она покажет долю посетителей, которые достигли этой цели.

Так же можно выделить завершение третьего уровня: `levelComplete.level3` из [примера прохождения уровней](https://yandex.ru/dev/games/doc/ru/concepts/yandex-metrica.md#parameters).

Выберите ветку из параметров, которые уже поступили в Яндекс Метрику, выполните действие и проверьте результат. Новая цель не пересчитывает прошлые данные. Подробнее — в [настройке цели](https://yandex.ru/support/metrica/ru/general/parameters-goal){.external}.



## Альтернативные действия в одной цели {#multi-goal}

Игрок может завершить обучение или пропустить его и перейти дальше. Чтобы узнать долю игроков, которые перешли дальше любым из этих способов, создайте [мультицель](https://yandex.ru/support/metrica/ru/general/multi){.external} «Обучение завершено или пропущено» и объедините в ней `gameTutorialComplete` и `gameTutorialSkip`. Цель засчитается при любом из двух действий.

Сравните конверсию по этой цели с конверсией по цели `gameTutorialComplete`. Число достижений может включать повторные действия одного человека. Для последовательных шагов используйте воронку.



## Проверка данных в отчете {#troubleshooting}

#|
|| **Симптом** | **Что проверить** ||
|| Нет достижений цели. | Номер счетчика, совпадение имени события с целью, фильтры и блокировку счетчика. ||
|| Нет параметров `reachGoal`. | Создана ли отдельная цель, а не только условие составной цели. ||
|| Покупки растут после перезапуска. | Не считается ли `getPurchases()` новой продажей. ||
|| Закрытий рекламы больше, чем показов. | Значение `wasShown`: закрытие не всегда означает показ. Ошибка и закрытие могут относиться к одной попытке. ||
|#

{% note warning %}

Не размечайте каждый кадр или выстрел. По [лимитам Яндекс Метрики](https://yandex.ru/support/metrica/ru/general/goal-js-event#restrictions){.external} одна и та же цель засчитывается не чаще раза в секунду, а за визит учитывается до 400 достижений онлайн-целей.

{% endnote %}

Доход сверяйте с Консолью. Для денежных отчетов Яндекс Метрики нужно отдельно подключить [электронную коммерцию](https://yandex.ru/support/metrica/ru/ecommerce/about){.external} и определить, какую сумму вы передаете.
