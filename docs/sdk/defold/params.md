---
title: "Другие объекты и параметры SDK"
original_url: "https://yandex.ru/dev/games/doc/ru/sdk/defold/params.md"
category: "sdk/defold"
---

# Другие объекты и параметры SDK







## Объект screen {#screen}

Содержит настройки для работы с экраном:

```lua showLineNumbers
{
    fullscreen: {
        status: function(): "on"|"off",
        request: function(): nil,
        exit: function(): nil
    },
    orientation: {
        get: function(): "portrait"|"landscape",
        set: function(value: "portrait"|"landscape")
    }
}
```

{% note alert %}

Яндекс Игры могут автоматически запускаться в полноэкранном режиме, однако многие браузеры запрещают переключать режим без команды пользователя.

В правом верхнем углу экрана Яндекс Игр уже реализована кнопка перехода в полноэкранный режим, поэтому используйте параметры объекта `screen.fullscreen` для обработки кнопок непосредственно в игре.

{% endnote %}

## Объект clipboard {#clipboard}

Предназначен для записи строки в буфер обмена при помощи метода `ysdk.clipboard.write_text(text: string)`.

## Объект device_info {#device-info}

Предназначен для получения информации об устройстве пользователя при помощи метода `ysdk.device_info()`.

```lua showLineNumbers
{
    type: "mobile"|"desktop"|"tablet"|"tv",
    isMobile: boolean,
    isDesktop: boolean,
    isTablet: boolean,
    isTV: boolean
}
```

---


{% note info %}

Если при работе с плагином вы столкнулись с проблемой или у вас появился вопрос, обратитесь в [сообщество в Телеграме](https://t.me/yagamedev/1233731){.telegram} или в [сообщество ВКонтакте](https://vk.ru/yandexgmsdev){.vk}.

{% endnote %}


<a href="https://github.com/yandex-games-plugins/defold">
  <span class="button">Репозиторий</span>
</a>
