---
title: "Локализация текста"
original_url: "https://yandex.ru/dev/games/doc/ru/sdk/construct-3/text-localization.md"
category: "sdk/construct-3"
---

# Локализация текста







Одна из основополагающих функций данного плагина — это система автоматического перевода текста.

Для этого подготовьте переводы в формате JSON, чтобы применять их в своих проектах. В большинстве случаев вы сможете локализовать игру, не добавляя новый код.

## Создание файлов перевода {#create-i18n-files}

Чтобы локализовать игру, подготовьте JSON-файлы переводов:

1. В директории `Files` создайте папку `i18n`.
1. В созданной папке создайте JSON-файлы и назовите их соответствующими кодами языков в формате [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes){.external}.

![Видео работы в Construct 3: в левой верхней части экрана расположена файловая структура. Видна часть списка папок: «Videos», «Fronts», «Icons», «Files». Пользователь выделяет папку «Files» и в контекстном меню выбирает опцию «Add subfolder». В папке «Files» возникает новая папка и пользователь называет ее «i18n». Затем он выделяет новую папку «i18n», в контекстном меню выбирает «New» → «JSON» и называет его «en.json». Потом в той же папке «i18n» он создает файл «ru.json».](https://yandex.ru/dev/games/_images/construct-3/text-localization/create-i18n-files.gif)

Примеры содержимого файлов `en.json` и `ru.json`:

{% list tabs %}

- `en.json`

    ```json showLineNumbers
    {
        "game": {
            "title": "First Fantasy 10"
        },
        "potions": {
            "health": "Health Potion",
            "mana": "Mana Potion"
        }
    }
    ```

- `ru.json`

    ```json showLineNumbers
    {
        "game": {
            "title": "Первая Фантазия 10"
        },
        "potions": {
            "health": "Зелье жизни",
            "mana": "Зелье маны"
        }
    }
    ```

{% endlist %}

Эти файлы переводов на английский и русский можно использовать в проекте.

## Использование в макетах {#use-in-layouts}

Чтобы воспользоваться созданными ранее переводами, создайте объект текста в макете и установите ему значение `{game.title}`.

![Скриншот Construct 3: на сером фоне выделен объект текста, он выглядит как черная надпись «{game.title}». Рядом открыто всплывающее окно, в центре верхней панели которого написано «Text». Большая часть всплывающего окна — это текстовое поле, в левой верхней его части написано «{game.title}». В нижней правой части окна есть кнопки «OK» и «Cancel», указатель наведен на кнопку «OK».](https://yandex.ru/dev/games/_images/construct-3/text-localization/example.webp)

Чтобы протестировать перевод, нажмите кнопку **Play** (превью). В окне **Preview** текст изменится на «First Fantasy 10». Это происходит, потому что система автоматической локализации может заменять текст внутри объектов [Текст](https://www.construct.net/en/make-games/manuals/construct-3/plugin-reference/text){.external}, [Текстурный Шрифт](https://www.construct.net/en/make-games/manuals/construct-3/plugin-reference/sprite-font){.external} и [Адаптивный Текст](https://yandex.ru/dev/games/doc/ru/adaptive-text.md){.external}.

![Скриншот Construct 3: в окне Editor (слева) расположен текст «{game.title}». В окне Preview (справа) расположен текст «First Fantasy 10».](https://yandex.ru/dev/games/_images/construct-3/text-localization/result.webp)

## Использование в событиях {#use-in-events}

Также, вы можете использовать ключи перевода в нативных событиях Construct 3 и не только.

Система автоматической локализации может заменить `{potions.mana}` на «Mana Potion» при изменении даже во время игры.

![Скриншот Construct 3: в верхней части экрана расположена таблица. Она состоит из трех горизонтальных ячеек: иконка настроек «System», «On start of layout», иконка буквы «T» в пунктирном квадрате и текст «Text | Set text to "{potions.mana} = 10$"». В окне Preview отображается текст «Mana Potion = 10$».](https://yandex.ru/dev/games/_images/construct-3/text-localization/runtime-set-text.webp)

Более того, вы не ограничены только использованием **Установить текст**, вы можете менять текст как угодно и когда угодно.

Например, вы можете запустить анимацию печатанья текста время нажатия кнопки и все будет работать.

![Видео работы Construct 3: в верхней части экрана расположена таблица. Она состоит из трех горизонтальных ячеек: иконка «OK» и текст «Button», «On clicked», иконка буквы «T» в пунктирном квадрате и текст «Text | Typewriter text "{potions.mana} = 10$" over 3 seconds». В окне Preview есть только белая кнопка с надписью «Button». Пользователь нажимает ее, и по одной букве начинает появляться текст «Mana Potion = 10$».](https://yandex.ru/dev/games/_images/construct-3/text-localization/runtime-typewrite-text.gif)

---


{% note info %}

Если при работе с плагином вы столкнулись с проблемой или у вас появился вопрос, обратитесь в [сообщество в Телеграме](https://t.me/yagamedev/1056558){.telegram} или в [сообщество ВКонтакте](https://vk.ru/yandexgmsdev){.vk}.

{% endnote %}


<a href="https://github.com/yandex-games-plugins/construct3">
  <span class="button">Репозиторий</span>
</a>
