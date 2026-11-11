---
metadata:
  - name: generator
    content: Diplodoc Platform v5.64.0
alternate:
  - https://yandex.ru/dev/games/doc/en/console/total-income.md
  - https://yandex.ru/dev/games/doc/ru/console/total-income.md
  - https://yandex.ru/dev/games/doc/tr/console/total-income.md
  - https://yandex.ru/dev/games/doc/zh/console/total-income.md
  - href: https://yandex.ru/dev/games/doc/ru/console/total-income.md
    type: text/markdown
    title: Markdown version
  - href: https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509
    rel: describedby
---
> **Documentation Index:** Fetch the complete configuration index at https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509

# Общий доход

<!-- source: ru/_includes/script-common.md -->
<!-- source: ru/_includes/script/index-js.md -->

<!-- endsource: ru/_includes/script/index-js.md -->

<!-- source: ru/_includes/script/requirements-js.md -->

<!-- endsource: ru/_includes/script/requirements-js.md -->

<!-- source: ru/_includes/script/image-modal-js.md -->

<!-- endsource: ru/_includes/script/image-modal-js.md -->
<!-- endsource: ru/_includes/script-common.md -->

{% note info %}

Просмотр данных доступен только для владельца игры и разработчиков с ролью **Просмотр дохода**.

{% endnote %}

В Консоли разработчика в разделе [Игры](https://games.yandex.ru/console/applications){.external} указана общая информация по монетизации:

- В столбце **Доход** — данные по каждой игре.
- Внизу в поле **Общий доход** — сумма по всем играм.

{% note warning %}

Информация не включает в себя применимое налогообложение. Информация не является публичной офертой, частью договора или заверениями об обстоятельствах. Полные условия сотрудничества вы можете найти в договорах, которые заключили с Яндексом.

{% endnote %}

## Изменить период {#change-period}

В правом верхнем углу в выпадающем списке **Период дохода** выберите нужный период:

- Относительный (7, 14, 30, 60 дней).
- Календарный (один из последних шести месяцев).

По умолчанию выбран текущий месяц.

## Скачать данные {#download-report}

Чтобы скачать отчет по доходам в формате CSV, справа от суммы общего дохода нажмите ![SVG](../_images/icons/dots.svg) → **Скачать данные за период**.

В отчете отобразятся:

- Общий доход.
- Разбивка по играм.
- Разбивка по типам монетизации: **Реклама** и **Инап-покупки**. Канал **Реклама** объединяет доходы от всех рекламных сетей, с которыми сотрудничает платформа Яндекс Игры.
