---
title: "Переменные окружения"
original_url: "https://yandex.ru/dev/games/doc/ru/sdk/defold/environment.md"
category: "sdk/defold"
---

# Переменные окружения







Вы можете получать информацию об окружении, в котором работает игра. Для этого используется объект `ysdk.environment`.

```lua showLineNumbers
{
    app: {
        id: string
    },
    browser: {
        lang: string
    },
    i18n: {
        lang: string,
        tld: string
    },
    payload: string|nil
}
```

## Объект environment {#environment-object}

Содержит переменные окружения игры.

#|
|| **Параметр** | **Тип** | **Описание** ||
|| `app` | table | Данные игры. ||
|| `browser` | table | Данные браузера. ||
|| `i18n` | table | Интернационализация на сервисе. ||
|| `payload` | string\|nil | Значение параметра `payload` из адреса игры. Необязательный параметр. Например, для игры `https://yandex.ru/games/app/123?payload=test` значение `test` можно получить так: `ysdk.environment.payload`. ||
|#

### Структура app {#app-structure}

#|
|| **Параметр** | **Тип** | **Описание** ||
|| `id` | string | Идентификатор игры. ||
|#

### Структура browser {#browser-structure}

#|
|| **Параметр** | **Тип** | **Описание** ||
|| `lang` | string | Приоритетный язык браузера в формате ISO 639-1. ||
|#

### Структура i18n {#i18n-structure}

#|
|| **Параметр** | **Тип** | **Описание** ||
|| `lang` | string | [Язык интерфейса Яндекс Игр](https://yandex.ru/dev/games/concepts/languages-and-domains.md#languages) в формате ISO 639-1. Например, `"tr"` означает, что игра сейчас запущена в турецком интерфейсе Яндекс Игр. Рекомендуем использовать этот параметр для определения языка пользователя в игре. ||
|| `tld` | string | Домен верхнего уровня. Например, `"com"` означает, что игра сейчас запущена на международном домене Яндекс Игр. При размещении игры на своем домене учтите, что она должна корректно открываться на любом yandex-домене. ||
|#

---


{% note info %}

Если при работе с плагином вы столкнулись с проблемой или у вас появился вопрос, обратитесь в [сообщество в Телеграме](https://t.me/yagamedev/1233731){.telegram} или в [сообщество ВКонтакте](https://vk.ru/yandexgmsdev){.vk}.

{% endnote %}


<a href="https://github.com/yandex-games-plugins/defold">
  <span class="button">Репозиторий</span>
</a>
