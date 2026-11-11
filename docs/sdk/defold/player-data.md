---
title: "Данные игрока"
original_url: "https://yandex.ru/dev/games/doc/ru/sdk/defold/player-data.md"
category: "sdk/defold"
---

# Данные игрока







Вы можете сохранять данные состояния игры (пройденные уровни, опыт, инап-покупки и т. д.) на сервере Яндекса или передавать их на свой сервер. Также вы можете персонализировать игру, используя некоторые данные из профиля пользователя на Яндексе, например, имя.

## Информация об игроке {#player-info}

```lua showLineNumbers
ysdk.player.get_info(
    callback: function,
    options: {
        scopes: boolean|nil,
        signed: boolean|nil
    }
)
```

`callback: function` — callback вызванного метода. Имеет вид:

```lua
function(self, player: table|nil, signature: string|nil): nil
```

- `player: table` — информация об игроке. Содержит свойства:

```lua showLineNumbers
player = {
    logged_in: boolean,
    unique_id: string,
    name: string,
    photo: {
        small: string,
        medium: string,
        large: string
    }
}
```

**Пример**

```lua showLineNumbers
function init_player()
    ysdk.player.get_info(function(self, player)
        if player then
            display_player(self, player)
        else
            ysdk.player.open_auth_dialog(function(self, authorized)
                ysdk.player.get_info(display_player, {})
            end)
        end
    end,
    {})
end

function display_player(player)
    if player then
        print(player.name, signature)
    end
end
```

## Авторизация пользователя {#auth}

Если игрок не авторизован, вы можете использовать метод `ysdk.player.open_auth_dialog()`, чтобы вызвать окно авторизации.

```lua
ysdk.player.open_auth_dialog(callback: function)
```

`callback: function` — callback вызванного метода. Имеет вид:

```lua
function(self, authorized: boolean): nil
```

- `authorized: boolean` — игрок авторизовался или нет.

## Внутриигровые данные {#ingame-data}

Для работы с внутриигровыми данными пользователя используйте методы объекта `Player`:

- `ysdk.player.set_data(data, flush)` — сохраняет данные пользователя. Максимальный размер данных не должен превышать 200 KБ. {#setdata}
    - `data: table` — содержит пары «ключ — значение».
    - `flush: boolean` — определяет очередность отправки данных. При значении `true` данные будут отправлены на сервер немедленно; `false` (значение по умолчанию) — запрос на отправку данных будет поставлен в очередь.

Метод возвращает `Promise`, который показывает, удалось сохранить данные или нет.

При значении параметра `flush: false` возвращаемый результат показывает только валидность данных (сама отправка поставлена в очередь и будет осуществлена позже). При этом метод `ysdk.player.get_data()` вернет данные, установленные последним вызовом `ysdk.player.set_data()`, даже если они еще не были отправлены.

- `ysdk.player.get_data(callback, keys)` — запрашивает внутриигровые данные пользователя, сохраненные в базе данных Яндекса.
    - `callback: fun(self, data: table<string, any>)` — функция-обработчик для работы с полученными внутриигровыми данными пользователя.
    - `keys: table<number, string>` — список ключей, которые необходимо вернуть. Если параметр `keys` отсутствует, то метод возвращает все внутриигровые данные пользователя.

- `ysdk.player.set_stats(stats)` — сохраняет численные данные пользователя. Максимальный размер данных не должен превышать 10 КБ.
    - `stats: table<string, number>` — содержит пары «ключ — значение», где каждое значение должно быть числом.

{% note info %}

Используйте данный метод для часто изменяемых числовых значений (баллы, очки опыта, внутриигровая валюта) вместо [ysdk.player.set_data()](https://yandex.ru/dev/games/doc/ru/#setdata).

{% endnote %}

- `ysdk.player.increment_stats(increments)` — изменяет внутриигровые данные пользователя. Максимальный размер данных не должен превышать 10 КБ.
    - `increments: table<string, number>` — объект, который содержит пары «ключ — значение», где каждое значение должно быть числом.
- `ysdk.player.get_stats(callback, keys)` — получить численные данные пользователя, сохраненные в базе данных Яндекса.
- `callback: fun(self, data: table<string, number>|nil)` — функция-обработчик для работы с полученными численные данными пользователя.
- `keys: string[]` — список ключей, которые необходимо вернуть. Если параметр keys отсутствует, то метод возвращает все внутриигровые данные пользователя.

## Идентификаторы пользователя {#user-ids}

```lua
ysdk.player.get_ids_per_game(callback: function)
```

`callback: function` — callback вызванного метода. Имеет вид:

```lua
function(self, ids: {appID: number, userID: string}[]): nil
```

- `ids` — идентификаторы пользователя во всех играх разработчика, в которых от пользователя было получено явное согласие на передачу персональных данных. Содержит свойства:
    - `app_id: string` — идентификатор приложения.
    - `user_id: string` — идентификатор пользователя.

**Пример**

```lua showLineNumbers
function log_ids()
    ysdk.player.get_ids_per_game(function(self, ids)
        for _, value in ipairs(ids) do
            print(value.app_id, value.user_id)
        end
    end)
end
```

---


{% note info %}

Если при работе с плагином вы столкнулись с проблемой или у вас появился вопрос, обратитесь в [сообщество в Телеграме](https://t.me/yagamedev/1233731){.telegram} или в [сообщество ВКонтакте](https://vk.ru/yandexgmsdev){.vk}.

{% endnote %}


<a href="https://github.com/yandex-games-plugins/defold">
  <span class="button">Репозиторий</span>
</a>
