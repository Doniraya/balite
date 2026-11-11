---
metadata:
  - name: generator
    content: Diplodoc Platform v5.64.0
alternate:
  - https://yandex.ru/dev/games/doc/en/requirements/1/12.md
  - https://yandex.ru/dev/games/doc/hi/requirements/1/12.md
  - https://yandex.ru/dev/games/doc/ko/requirements/1/12.md
  - https://yandex.ru/dev/games/doc/ru/requirements/1/12.md
  - https://yandex.ru/dev/games/doc/tr/requirements/1/12.md
  - https://yandex.ru/dev/games/doc/vi/requirements/1/12.md
  - https://yandex.ru/dev/games/doc/zh/requirements/1/12.md
  - href: https://yandex.ru/dev/games/doc/ru/requirements/1/12.md
    type: text/markdown
    title: Markdown version
  - href: https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509
    rel: describedby
---
> **Documentation Index:** Fetch the complete configuration index at https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509

# Монетизация

<!-- source: ru/_includes/script-common.md -->
<!-- source: ru/_includes/script/index-js.md -->

<!-- endsource: ru/_includes/script/index-js.md -->

<!-- source: ru/_includes/script/requirements-js.md -->

<!-- endsource: ru/_includes/script/requirements-js.md -->

<!-- source: ru/_includes/script/image-modal-js.md -->

<!-- endsource: ru/_includes/script/image-modal-js.md -->
<!-- endsource: ru/_includes/script-common.md -->

{% note info "Пункт 1.12 Требований к игре" %}

Подключена монетизация: в игре есть реклама или инап-покупки.

{% endnote %}

## Методика проверки {#verification-method}

По умолчанию в игре обязательно должна быть подключена монетизация. Если вы не хотите монетизировать игру, то в [Консоли](https://games.yandex.ru/console){.external} на вкладке **Черновик** в поле **Комментарий разработчика** прямо напишите о своем решении.

Если вы работаете по единой лицензионной схеме (ЕЛС), монетизация уже подключена автоматически. Подробнее о проверке статуса подключения см. на странице [Проверка подключения](https://yandex.ru/dev/games/doc/ru/payments.md#check-ulm).

Чтобы подключить монетизацию самостоятельно, см. раздел [Монетизация](https://yandex.ru/dev/games/doc/ru/services/about-monetization.md).

Если вы планируете получать доход от игры, в ней должны присутствовать реклама или инап-покупки:

- Реклама: полноэкранные блоки, блоки с вознаграждением или стики-баннеры. Исключение: не считается стартовый рекламный блок, который виден во время загрузки игры и вызывается платформой Яндекс Игры.
- Покупки: на странице **Инап-покупки** добавлены товары и на вкладке **Настройки** этой страницы присутствует надпись **Покупки подключены**.

Модерация одобрит игру, если выполнено хотя бы одно из этих условий (есть реклама или покупки) или если указано, что в игре не предусмотрена монетизация.
