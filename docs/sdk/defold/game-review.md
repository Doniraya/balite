---
title: "Оценка игры"
original_url: "https://yandex.ru/dev/games/doc/ru/sdk/defold/game-review.md"
category: "sdk/defold"
---

# Оценка игры







Вы можете попросить пользователя оценить игру и написать комментарий во всплывающем окне (появится в момент запроса оценки, закрывая фон приложения). Всплывающее окно не будет показано, если пользователь не авторизован или оценивал игру ранее.

Прежде чем запросить оценку игры, убедитесь, что опция доступна для этого пользователя.

## Проверка возможности запросить оценку {#can-review}

Чтобы узнать, можно ли запросить оценку игры, используйте метод `ysdk.feedback.can_review()`.

```lua
ysdk.feedback.can_review(callback: function)
```

`callback: function` — обработчик вызванного метода. Имеет вид:

```lua
function(self, can_review: boolean, reason: string|nil): nil
```

- `can_review: boolean` — можно ли запросить или нет.
- `reason: string|nil` — причина, почему нельзя запросить рекламу. Возможные значения:
    - `NO_AUTH` — пользователь не авторизован.
    - `GAME_RATED` — пользователь уже оценивал игру.
    - `REVIEW_ALREADY_REQUESTED` — запрос уже отправлен, ожидаются действия пользователя.
    - `REVIEW_WAS_REQUESTED` — запрос уже отправлен, пользователь совершил действие: поставил оценку или закрыл всплывающее окно.
    - `UNKNOWN` — запрос не был отправлен, ошибка на стороне Яндекса.

## Запрос оценки {#review-request}

{% note alert %}

Запросить оценку игры можно только один раз за сессию. Обязательно используйте метод `ysdk.feedback.can_review()` перед выполнением запроса.

{% endnote %}

Чтобы предложить пользователю оценить игру, используйте метод `ysdk.feedback.request_review()`.

```lua
ysdk.player.open_auth_dialog(callback)
```

`callback: function` — обработчик вызванного метода. Имеет вид:

```lua
function(self, feedback_sent: boolean): nil
```

- `feedback_sent: boolean` — оценил ли пользователь игру (true) или закрыл всплывающее окно (false).

**Пример**

```lua showLineNumbers
ysdk.feedback.can_review(function (self, can_review, reason)
    if can_review then
        ysdk.feedback.request_review(function (self, feedback_sent)
            if feedback_sent then
                print("Reward")
            end
        end)
    else
        print(reason)
    end
end)
```

---


{% note info %}

Если при работе с плагином вы столкнулись с проблемой или у вас появился вопрос, обратитесь в [сообщество в Телеграме](https://t.me/yagamedev/1233731){.telegram} или в [сообщество ВКонтакте](https://vk.ru/yandexgmsdev){.vk}.

{% endnote %}


<a href="https://github.com/yandex-games-plugins/defold">
  <span class="button">Репозиторий</span>
</a>
