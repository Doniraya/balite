---
title: "Командная работа"
original_url: "https://yandex.ru/dev/games/doc/ru/console/teamwork.md"
category: "console"
---

# Командная работа







## Роли и доступы {#roles-accesses}

В Консоли вы можете настроить права доступа для совместной работы с командой. Для этого предусмотрено несколько ролей с предсобранным набором прав. Доступ [выдается](https://yandex.ru/dev/games/doc/ru/#add-user) к конкретной игре, а управлять им может только ее владелец ([учетная запись](https://yandex.ru/dev/games/doc/ru/*user_account), из-под которой [создали](https://yandex.ru/dev/games/doc/ru/manage-account.md#dev-profile-create) [аккаунт разработчика](https://yandex.ru/dev/games/doc/ru/*developer_account)).

{% note info %}

Разграничение ролей в Консоли разработчика не касается аккаунтов в партнерских системах: РСЯ, Яндекс Директ.

{% endnote %}

![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) — право на чтение.
\
![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) — право на редактирование.

#|
||  | **Администратор** | **Разработчик** | **Аналитик** | **Поддержка** | **Менеджер приложений** | **Менеджер рекламы** ||
|| **Свой профиль** | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) ||
|| **Профиль родительского аккаунта** | — | — | — | — | — | — ||
|| **Список игр** | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) ||
|| **Панель управления** | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | — ||
|| **Черновик** | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | — | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) ||
|| **Инап-покупки** | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | — | — | — ||
|| **Продвижение** | — | — | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | — | — | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) ||
|| **Реклама** | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | — | — | — | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | — ||
|| **Метрики**<span class="red">*</span> | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | — | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | — ||
|| **Эксперименты** | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | — ||
|| **Лидерборды** | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | — | — | — | — ||
|| **Промоакции** | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | — | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | — | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | — ||
|| **Отзывы** | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | — | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/read.svg) | — ||
|| **CSP** | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | — | — | ![SVG](https://yandex.ru/dev/games/doc/_images/icons/edit.svg) | — ||
|#

<span class="red">*</span>&nbsp;Просмотр денежных метрик доступен только для владельца игры и разработчиков с ролью **Просмотр дохода**.

{% note tip %}

Чтобы расширить полномочия пользователя, выберите для него сразу несколько ролей.

{% endnote %}

## Добавление пользователя {#add-user}

1. В Консоли откройте раздел [Пользователи и доступ](https://games.yandex.ru/console/linked-accounts){.external}.
1. Нажмите **Добавить нового пользователя +**.
1. Введите логин Яндекс ID, отметьте роли и укажите игры, к которым пользователь получит доступ.

    {% note info %}

    Чтобы разрешить пользователю создавать игры от вашего имени, в разделе **Специальные Права** выберите опцию **Может создавать приложения от вашего имени**. В списке разработчиков такие пользователи будут отмечены значком ![SVG](https://yandex.ru/dev/games/doc/_images/icons/can-add-games-icon.svg) рядом с логином.

    {% endnote %}

1. Нажмите **Пригласить**.

Приглашенный пользователь сможет [переключиться](https://yandex.ru/dev/games/doc/ru/manage-account.md#dev-profile-change) на ваш аккаунт разработчика. Ему будут видны только те игры и вкладки, к которым вы дали доступ.

## Редактирование пользователя {#edit-user}

1. В Консоли откройте раздел [Пользователи и доступ](https://games.yandex.ru/console/linked-accounts){.external}.
1. В списке нажмите логин нужного пользователя.
1. Измените набор ролей и игр, разрешите или запретите создавать игры от вашего имени.
1. Нажмите **Редактировать**.

## Удаление пользователя {#delete-user}

1. В Консоли откройте раздел [Пользователи и доступ](https://games.yandex.ru/console/linked-accounts){.external}.
1. В списке нажмите логин нужного пользователя.
1. Нажмите **Удалить**.

[*user_account]: Аккаунт [Яндекс ID](https://id.yandex.ru/){.external}, под которым авторизован пользователь Консоли разработчика.

[*developer_account]: Аккаунт, из-под которого выкладываются игры в каталог. К нему выдается ограниченный доступ. Для приглашенных пользователей это родительский аккаунт.
