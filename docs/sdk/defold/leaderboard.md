---
title: "Лидерборды"
original_url: "https://yandex.ru/dev/games/doc/ru/sdk/defold/leaderboard.md"
category: "sdk/defold"
---

# Лидерборды







Вы можете показывать на странице игры персонализированные лидерборды (таблицы лидеров) с результатами лучших игроков и местом в рейтинге авторизованного пользователя.

Чтобы у вас заработали описанные ниже запросы, проверьте, что выполнены условия:

- вы [подключили и настроили SDK](https://yandex.ru/dev/games/sdk/sdk-about.md#use) и его объект доступен через переменную `ysdk`;
- в Консоли разработчика [создан](https://yandex.ru/dev/games/concepts/leaderboards.md) лидерборд.

{% note alert %}

Если в Консоли нет лидерборда с соответствующим именем в поле **Техническое название лидерборда**, запросы будут выдавать ошибку 404.

{% endnote %}

## Описание лидерборда {#leaderboard-description}

Чтобы получить описание таблицы лидеров по его имени, используйте метод `ysdk.leaderboards.get_description()`:

```lua showLineNumbers
ysdk.leaderboards.get_description(
    leaderboard_name: string,
    callback: function
)
```

`callback: function` — обработчик вызванного метода. Имеет вид:

```lua
function(self, description: table|nil): nil
```

- `description: table` — описание таблицы лидеров. Содержит свойства:

```lua showLineNumbers
description: {
    app_id: string,
    default: boolean,
    invert_sort_order: boolean,
    decimal_offset: integer,
    type: string,
    name: string,
    title: {
        en: string,
        ru: string
    }
}
```

**Пример**

```lua showLineNumbers
function display_leaderboard()
    ysdk.leaderboards.get_description("highscores",
        function (self, description)
            if description then
                print(
                    description.name,
                    description.title.en
                )
            end
        end)
end
```

## Новый результат {#new-score}

{% note alert %}

Запрос доступен только для авторизованных пользователей. При необходимости воспользуйтесь [авторизацией](https://yandex.ru/dev/games/sdk/defold/player-data.md#auth).

{% endnote %}

Чтобы установить игроку новый результат, используйте метод `ysdk.leaderboards.set_score()`:

```lua showLineNumbers
ysdk.leaderboards.set_score(
    leaderboard_name: string,
    score: integer,
    extraData: string|nil
)
```

{% note info %}

Запрос можно отправлять не чаще, чем раз в секунду, иначе он будет отклонен с ошибкой.

{% endnote %}

## Получение рейтинга {#getting-ranking}

{% note alert %}

Запрос доступен только для авторизованных пользователей. При необходимости воспользуйтесь [авторизацией](https://yandex.ru/dev/games/sdk/defold/player-data.md#auth).

{% endnote %}

Чтобы получить рейтинг пользователя, используйте метод `ysdk.leaderboards.get_player_entry()`:

```lua showLineNumbers
ysdk.leaderboards.get_player_entry(
    leaderboard_name: string,
    callback: function
)
```

`callback: function` — обработчик вызванного метода. Имеет вид:

```lua
function(self, player_entry: table|nil): nil
```

- `player_entry: table` — рейтинг пользователя. Содержит свойства:

```lua showLineNumbers
player_entry: {
    score: integer,
    extraData: string,
    rank: integer,
    avatar_src: {
        small: string,
        medium: string,
        large: string
    },
    avatar_srcset: {
        small: string,
        medium: string,
        large: string
    },
    lang: string,
    public_name: string,
    unique_id: string,
    formatted_score: string
}
```

**Пример**

```lua showLineNumbers
function display_high_score()
    ysdk.leaderboards.get_player_entry("highscores",
        function (self, player_entry)
            if player_entry then
                print("highscore: " .. player_entry.score)
            end
        end)
end
```

## Записи лидерборда {#leaderboard-entries}

Чтобы вывести рейтинг пользователей, используйте метод `ysdk.leaderboards.get_entries()`:

```lua showLineNumbers
ysdk.leaderboards.get_entries(
    leaderboardName: string,
    callback: function,
    options: {
        include_user: boolean|nil,
        quantity_around: number|nil,
        quantity_top: number|nil
    }
)
```

`callback: function` — обработчик вызванного метода. Имеет вид:

```lua
function(self, entries: table|nil): nil
```

`entries: table` — рейтинг пользователей. Содержит свойства:

```lua showLineNumbers
entries: {
    leaderboard: {
        ...
    },
    ranges: [
        {
            start: integer,
            size: integer
        }
    ],
    userRank: integer,
    entries: [
        {
            score: integer,
            extraData: string,
            rank: integer,
            avatar_src: {
                small: string,
                medium: string,
                large: string
            },
            avatar_srcset: {
                small: string,
                medium: string,
                large: string
            },
            lang: string,
            public_name: string,
            unique_id: string,
            formatted_score: string
        },
        ...
    ]
}
```

---


{% note info %}

Если при работе с плагином вы столкнулись с проблемой или у вас появился вопрос, обратитесь в [сообщество в Телеграме](https://t.me/yagamedev/1233731){.telegram} или в [сообщество ВКонтакте](https://vk.ru/yandexgmsdev){.vk}.

{% endnote %}


<a href="https://github.com/yandex-games-plugins/defold">
  <span class="button">Репозиторий</span>
</a>
