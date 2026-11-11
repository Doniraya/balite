---
title: "Локализация"
original_url: "https://yandex.ru/dev/games/doc/ru/sdk/defold/localization.md"
category: "sdk/defold"
---

# Локализация







## Создание переводов {#create-translation}

Чтобы создать перевод, создайте папку `i18n`. В ней будут храниться переводы в файлах формата JSON.

Ниже приведены примеры переводов в файлах `en.json` и `ru.json`, которые соответствуют английскому и русскому языкам.

![Cкриншот файловой структуры: видна часть списка папок «fronts», «i18n», «input» и «ysdk». В папке «i18n» лежат файлы «en.json» и «ru.json».](https://yandex.ru/dev/games/_images/defold/localization/files-create.webp)

Теперь, стоит наполнить наши файлы каким-нибудь содержанием:

{% list tabs %}

- en.json

    ```json showLineNumbers
    {
        "game": {
            "title": "Cool Game"
        },
        "button": "Button"
    }
    ```

- ru.json

    ```json showLineNumbers
    {
        "game": {
            "title": "Крутая игра"
        },
        "button": "Кнопка"
    }
    ```

{% endlist %}

## Получение переводов {#get-translation}

Чтобы получить значение определенного ключа, вы можете воспользоваться методом `i18n.localize(key)`.

```lua
print(i18n.key("game.title")) -- "Cool Game"
```

Также существует вспомогательный метод `i18n.gui(node_id, key)`, который заменяет содержимое выбранного узла в пользовательском интерфейсе.

С помощью `i18n.gui()` мы можем сократить:

```lua
gui.set_text(gui.get_node("Title Label"), i18n.key("game.title"))
```

До:

```lua
i18n.gui("title_label", "game.title")
```

### Пример локализации игры {#localization-example}

```lua showLineNumbers
local i18n = require('ysdk.i18n')

local function on_localize()
    i18n.gui("title_label", "game.title")
    i18n.gui("button_label", "game.title")
end

function init(self)
    i18n.on(on_localize)
end

function final(self)
    i18n.off(on_localize)
end
```

![В центре черного экрана надпись «Cool», чуть ниже белая кнопка с надписью «Button».](https://yandex.ru/dev/games/_images/defold/localization/example.webp)

## Смена языка переводов {#lang-change}

{% note info %}

Модуль i18n самостоятельно инициализирует язык, соответствующий языку пользователя из [переменных окружения](https://yandex.ru/dev/games/doc/ru/environment.md).

Рекомендуется использовать данный метод только если хотите вручную изменить язык по желанию от пользователя.

{% endnote %}

Чтобы сменить язык перевода, вы можете воспользоваться методом `i18n.set_language(code: string)`.

```lua showLineNumbers
function settings.change_language(code)
    i18n.set_language(code)
end
```

---


{% note info %}

Если при работе с плагином вы столкнулись с проблемой или у вас появился вопрос, обратитесь в [сообщество в Телеграме](https://t.me/yagamedev/1233731){.telegram} или в [сообщество ВКонтакте](https://vk.ru/yandexgmsdev){.vk}.

{% endnote %}


<a href="https://github.com/yandex-games-plugins/defold">
  <span class="button">Репозиторий</span>
</a>
