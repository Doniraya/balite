---
title: "События"
original_url: "https://yandex.ru/dev/games/doc/ru/sdk/defold/events.md"
category: "sdk/defold"
---

# События







Вы можете отслеживать события, возникающие при нажатии пользователем определенных кнопок в игре.

Доступные события и методы для работы с ними:

```lua showLineNumbers
ysdk = {
    on_event = function (eventName: "EXIT" | "HISTORY_BACK", listener: function): nil,
    dispatch_event = function (eventName: "EXIT" | "HISTORY_BACK", detail: table|nil): nil
}
```

## HISTORY_BACK {#history-back}

Чтобы отследить нажатие на кнопку **Back**, используйте метод:

```lua showLineNumbers
ysdk.on_event("HISTORY_BACK", function (self)
    -- Показ пользователю кастомного диалога игры с возможностью
    -- подтвердить выход из игры, перейти к внутренним настройкам, магазину и т. п.
end)
```

{% note alert %}

Событие доступно только в случае, если игра запущена на телевизоре.

{% endnote %}

## EXIT {#exit}

Если пользователь подтвердил выход из игры в кастомном диалоге, открывшемся после нажатия **Back**, то игра должна отправить событие выхода. Для этого используйте метод:

```lua
ysdk.dispatch_event("EXIT")
```

---



{% note info %}

Если при работе с плагином вы столкнулись с проблемой или у вас появился вопрос, обратитесь в [сообщество в Телеграме](https://t.me/yagamedev/1233731){.telegram} или в [сообщество ВКонтакте](https://vk.ru/yandexgmsdev){.vk}.

{% endnote %}


<a href="https://github.com/yandex-games-plugins/defold">
  <span class="button">Репозиторий</span>
</a>
