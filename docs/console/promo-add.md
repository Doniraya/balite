---
metadata:
  - name: generator
    content: Diplodoc Platform v5.64.0
alternate:
  - https://yandex.ru/dev/games/doc/en/console/promo-add.md
  - https://yandex.ru/dev/games/doc/hi/console/promo-add.md
  - https://yandex.ru/dev/games/doc/ko/console/promo-add.md
  - https://yandex.ru/dev/games/doc/ru/console/promo-add.md
  - https://yandex.ru/dev/games/doc/tr/console/promo-add.md
  - https://yandex.ru/dev/games/doc/vi/console/promo-add.md
  - https://yandex.ru/dev/games/doc/zh/console/promo-add.md
  - href: https://yandex.ru/dev/games/doc/ru/console/promo-add.md
    type: text/markdown
    title: Markdown version
  - href: https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509
    rel: describedby
---
> **Documentation Index:** Fetch the complete configuration index at https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509

# Подключение

<!-- source: ru/_includes/script-common.md -->
<!-- source: ru/_includes/script/index-js.md -->

<!-- endsource: ru/_includes/script/index-js.md -->

<!-- source: ru/_includes/script/requirements-js.md -->

<!-- endsource: ru/_includes/script/requirements-js.md -->

<!-- source: ru/_includes/script/image-modal-js.md -->

<!-- endsource: ru/_includes/script/image-modal-js.md -->
<!-- endsource: ru/_includes/script-common.md -->

Чтобы промоакция появилась в каталоге:

1. [Добавьте ее в игру](#add-to-game){.arrow}
1. [Заполните форму в Консоли](#activate){.arrow}

Все события проходят проверку — соблюдайте [требования](https://yandex.ru/dev/games/doc/ru/console/promo-rules.md), чтобы промоакция прошла ее с первого раза.

После завершения промоакции [уберите ее из игры](#finish).



## Шаг 1. Добавьте промоакцию в игру {#add-to-game}

1. Добавьте в игру:

    - контент промоакции (например, новые уровни, призы, наборы);
    - обработку переходов с помощью [ysdk.environment.referrer](https://yandex.ru/dev/games/doc/ru/sdk/sdk-environment.md#structure-referrer).

2. Подключите промоакцию одним из способов:

    - Через [удаленную конфигурацию](https://yandex.ru/dev/games/doc/ru/config.md) — рекомендуемый способ, не требует повторной модерации билда.

        {% cut "Как настроить" %}

        1. Запланируйте промоакции в игре заранее.
        1. В [Консоли разработчика](https://games.yandex.ru/console){.external} добавьте [флаги](https://yandex.ru/dev/games/doc/ru/config.md). Вы можете настроить их активацию по времени или переключаться на конфигурацию с акцией и обратно самостоятельно.
        1. Внесите изменения в билд: используйте метод [ysdk.getFlags()](https://yandex.ru/dev/games/doc/ru/sdk/sdk-config.md), чтобы настроить логику отображения промоакций в игре.
        1. [Обновите игру](https://yandex.ru/dev/games/doc/ru/console/update-game.md) и пройдите модерацию. Полная проверка потребуется только один раз. Затем вы сможете включать и отключать промоакции с помощью флагов.
        1. Перед стартом промоакции включите нужный флаг заранее: модерация дополнительно проверит, что событие действительно добавлено в игру. Если на момент проверки флаг не включен, промоакция не пройдет модерацию.

        {% endcut %}

    - Через [обновление билда](https://yandex.ru/dev/games/doc/ru/console/update-game.md) без настройки условий — подходит для разовых акций: каждый раз потребуется модерация.



## Шаг 2. Активируйте промоакцию в Консоли {#activate}

1. В [Консоли Яндекс Игр](https://games.yandex.ru/console){.external} перейдите на вкладку **Промоакции** и нажмите **Создать промоакцию**.

1. Заполните поля:

    #|
    || **Поле** | **Описание** | **Обязательность** ||
    || **Активирована** | Опция будет включена, если модераторы одобрят промоакцию. |  ||
    || **Начало промоакции** |

    Укажите дату и время начала акции. Выбранный момент должен быть не ранее чем за 30 дней и не позднее чем за 72 часа от текущего. Реальное время старта акции может быть отложено до прохождения модерации.

    Система учитывает часовой пояс пользователя.

    |::{align="center"}

    ![SVG](../_images/icons/yes-button.svg)

    ||
    || **Конец промоакции** |

    Укажите дату и время окончания акции. Максимальная длительность акции — 10 дней.

    Система учитывает часовой пояс пользователя.

    |::{align="center"}

    ![SVG](../_images/icons/yes-button.svg)

    ||
    || **Тип акции** |

    Влияет на отображение акции на витрине и в аналитике.

    - **Игровое событие** — акции с фокусом на игровой механике: задания, сбор предметов, турниры, лидерборды, новые сезоны. Покупка для участия необязательна.
    - **Скидочная акция** — акции с прямой выгодой при покупке: процент скидки, множитель, бонус к сумме, промокод, стартовый набор.

    {% note info %}

    Если в акции совмещены механика и скидка, выбирайте по основному содержанию.

    «—» — устаревший вариант для старых акций.

    {% endnote %}

    [Сравнение типов акций](https://yandex.ru/dev/games/doc/ru/console/promo-and-discounts.md#promo-types){.arrow}

    <!-- -->

    |::{align="center"}

    ![SVG](../_images/icons/yes-button.svg)

    ||
    || **Intent** | Произвольная подсказка для маршрутизации внутри игры и аналитики. Например: `open_shop`, `open_starter_pack`. Передается в [SDK](https://yandex.ru/dev/games/doc/ru/sdk/sdk-environment.md#structure-referrer) при переходе из акции. |  ||
    || **ID инапа** | [ID инап-покупки](https://yandex.ru/dev/games/doc/ru/console/purchases.md#add-purchases), с которой связана акция в игре. Привязка позволяет игре сразу открыть платформенный диалог покупки. Доступно, если выбран тип **Скидочная акция**. |  ||
    || **Обложка** |

    Баннер события.

    Размер — 928 × 540 пикселей.

    Формат — PNG.

    [Требования к оформлению](https://yandex.ru/dev/games/doc/ru/console/promo-rules.md#banner){.arrow}

    <!-- -->

    |  ||
    || **Название** |

    Название промоакции.

    Максимальная длина — 50 символов (включая знаки препинания).

    [Требования к оформлению](https://yandex.ru/dev/games/doc/ru/console/promo-rules.md#name){.arrow}

    <!-- -->

    |::{align="center"}

    ![SVG](../_images/icons/yes-button.svg)

    ||
    || **Описание** |

    Описание промоакции.

    Максимальная длина — 120 символов (включая знаки препинания).

    [Требования к оформлению](https://yandex.ru/dev/games/doc/ru/console/promo-rules.md#description){.arrow}

    <!-- -->

    |::{align="center"}

    ![SVG](../_images/icons/yes-button.svg)

    ||
    |#

    {% note info %}

    По умолчанию у промоакций установлен русский язык. Для текстовых полей (**Название** и **Описание**) вы можете:

    - Добавить другой язык — нажмите ![SVG](../_images/icons/add-purchase.svg) и выберите язык из списка.
    - Убрать неиспользуемый язык — справа от него нажмите ![SVG](../_images/icons/delete-button.svg). Русский язык убрать нельзя.

    {% endnote %}

1. Нажмите **Отправить на модерацию**. Модераторы проверят промоакцию на соответствие [требованиям](https://yandex.ru/dev/games/doc/ru/console/promo-rules.md), обычно это занимает 1–3 рабочих дня.

Результаты проверки вы увидите в [Консоли](https://games.yandex.ru/console){.external}:

- После прохождения модерации промоакция появится в разделе [Скидки и акции](https://games.yandex.ru/promos){.external} и других подборках каталога Яндекс Игр.
- Если промоакция не пройдет модерацию, в каталог она не попадет. Причины отклонения пришлем на почту, указанную в [профиле разработчика](https://yandex.ru/dev/games/doc/ru/console/manage-account.md#profile-manage).



## После завершения промоакции {#finish}

- Если подключали через удаленную конфигурацию — отключите промоакцию в [Консоли разработчика](https://games.yandex.ru/console){.external}.
- Если обновляли билд — повторите процесс: загрузите новый архив с выключенной промоакцией и пройдите модерацию.
