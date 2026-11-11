---
metadata:
  - name: generator
    content: Diplodoc Platform v5.64.0
alternate:
  - https://yandex.ru/dev/games/doc/en/console/promo-and-discounts.md
  - https://yandex.ru/dev/games/doc/hi/console/promo-and-discounts.md
  - https://yandex.ru/dev/games/doc/ko/console/promo-and-discounts.md
  - https://yandex.ru/dev/games/doc/ru/console/promo-and-discounts.md
  - https://yandex.ru/dev/games/doc/tr/console/promo-and-discounts.md
  - https://yandex.ru/dev/games/doc/vi/console/promo-and-discounts.md
  - https://yandex.ru/dev/games/doc/zh/console/promo-and-discounts.md
  - href: https://yandex.ru/dev/games/doc/ru/console/promo-and-discounts.md
    type: text/markdown
    title: Markdown version
  - href: https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509
    rel: describedby
---
> **Documentation Index:** Fetch the complete configuration index at https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509

# Промоакции

<!-- source: ru/_includes/script-common.md -->
<!-- source: ru/_includes/script/index-js.md -->

<!-- endsource: ru/_includes/script/index-js.md -->

<!-- source: ru/_includes/script/requirements-js.md -->

<!-- endsource: ru/_includes/script/requirements-js.md -->

<!-- source: ru/_includes/script/image-modal-js.md -->

<!-- endsource: ru/_includes/script/image-modal-js.md -->
<!-- endsource: ru/_includes/script-common.md -->

Промоакции дают игре дополнительное продвижение в каталоге. Регулярно запускайте их, чтобы:

- Привлечь больше игроков: как новых, так и тех, кто уже знаком с игрой.
- Увеличить количество показов рекламы и инап-покупок.
- Развивать игровое сообщество.

Вы можете приурочить события и скидки к тематическим акциям Яндекс Игр или запускать свои.

Промоакции отображаются:

- На главной странице [Яндекс Игр](https://yandex.ru/games/){.external} с бейджем «Акция»:

    - в блоке **Мои игры**;
    - в карусели;
    - в общем каталоге.

    ![Скриншот интерфейса Яндекс Игр с открытой главной страницей. Игру «Играляндия» с активной акцией видно в трех местах: блоке «Мои игры», карусели и общем каталоге.](../_images/promo/main-page.webp)

- В разделе [Скидки и акции](https://games.yandex.ru/promos){.external}.

    ![Скриншот интерфейса Яндекс Игр с открытым разделом «Скидки и акции».](../_images/promo/discounts-and-promotions.webp)

- В тематических подборках Яндекс Игр.

    ![Скриншот интерфейса Яндекс Игр с открытой страницей тематической подборки «Сокровища семи морей».](../_images/promo/thematic-collection.webp)

Призы для участников промоакций могут быть только внутриигровыми. Например:

- Скидка на бонусную валюту и другие внутриигровые товары.
- Уникальные облики для персонажей.
- Лимитированные игровые отметки.



## Запуск промоакции {#promo-launch}

1. Ознакомьтесь с [требованиями](https://yandex.ru/dev/games/doc/ru/console/promo-rules.md).
1. [Обновите игру](https://yandex.ru/dev/games/doc/ru/console/promo-add.md#add-to-game): добавьте промоакцию и [обработку переходов](https://yandex.ru/dev/games/doc/ru/sdk/sdk-environment.md#structure-referrer) по ней.
1. [Активируйте](https://yandex.ru/dev/games/doc/ru/console/promo-add.md#activate) ее в Консоли Яндекс Игр.

{% note warning %}

Любые промоакции длятся не более 10 дней, поэтому, чтобы активировать их во время праздников и привлечь в игру больше пользователей, рассчитывайте и планируйте запуск заранее.

Подать промоакцию на модерацию нужно минимум за 72 часа до предполагаемой даты запуска. Завести промоакцию вы можете не раньше, чем за 30 дней до начала акции.

{% endnote %}



## Типы промоакций {#promo-types}

В [форме](https://yandex.ru/dev/games/doc/ru/console/promo-add.md#activate) можно завести промоакции двух видов: игровое событие или скидочную акцию. Различие сводится к тому, что вы предлагаете игроку сделать на баннере.

#|
||  | **Игровое событие** | **Скидочная акция** ||
|| **Призыв на баннере** | Играть, участвовать, пройти | Купить ||
|| **Что игрок получает** | Новый опыт, эксклюзив за прохождение | Скидку, бонус, набор ||
|| **Главная метрика** | Удержание, вовлечение | Конверсия, выручка ||
|| **Длительность** | Дни, недели | Часы, дни ||
|| **Целевая аудитория** | Активные игроки | Платящие и потенциально платящие игроки ||
|| **Примеры** | Анонс нового сезона, контентное обновление, событие со сбором | Скидка, бонусный набор, стартовый пак ||
|#

{% note tip %}

Если в акции совмещены механика и скидка, выбирайте по основному содержанию. Длинные кампании (сезоны, баттл-пассы) разложите на несколько игровых событий и скидочных акций.

{% endnote %}



## Частые вопросы {#faq}

{% cut "**Сколько длится модерация события?**" %} {#time-of-promo}

Обычно модерация занимает 1–3 рабочих дня.

{% endcut %}


{% cut "**Как я могу оценить эффективность акций и скидок?**" %} {#efficiency-promo}

Чтобы оценить эффективность акций и скидок в своих играх, подключите [Яндекс Метрику](https://yandex.ru/dev/games/doc/ru/concepts/yandex-metrica.md).

{% endcut %}
