---
title: "VKWebAppGetCommunityToken"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppGetCommunityToken"
category: "VK Bridge / События / Доступы и разрешения"
---

# VKWebAppGetCommunityToken

`VKWebAppGetCommunityToken` показывает окно с запросом прав доступа у пользователя и получает ключ доступа для работы с API от имени сообщества. Получить ключ доступа сообщества может только его администратор.

> **Совет.** Чтобы получить список идентификаторов администрируемых сообществ, вызовите метод [`groups.get`](https://dev.vk.com/ru/method/groups.get) с параметром `filter=admin`. Для работы с этим методом необходим [ключ доступа пользователя](VKWebAppGetAuthToken.md) с правами `scope=groups`.

## Пример

```javascript
bridge.send("VKWebAppGetCommunityToken", {
   app_id: 6909581,
   group_id: 166562603,
   scope: 'messages'
   })
  .then((data) => { 
    if (data.access_token) {
      // Ключ доступа сообщества получен
    }
  })
  .catch((error) => {
    // Ошибка
    console.log(error);
  });
```

## Совместимость

| Площадки | Платформы |
| :--- | :--- |
| ВКонтакте | Android, iOS, Mobile Web, Web |
| Одноклассники | – |

## Параметры

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `app_id` *обязательное* | `integer` | Идентификатор мини-приложения. |
| `group_id` *обязательное* | `integer` | Идентификатор сообщества. |
| `scope` *обязательное* | `string` | Список [прав доступа](../api/privacy.md#Права доступа), перечисленных через запятую. Возможные значения: • `stories` — доступ к историям. • `photos` — доступ к фотографиям. • `app_widget` — доступ к [виджетам сообществ](https://dev.vk.com/ru/api/community-apps-widgets/getting-started). • `messages` — доступ к сообщениям сообщества. • `docs` — доступ к документам. • `manage` — доступ к администрированию сообщества. |

## Результат

Проверить результат можно:

- Используя объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`.
- С помощью [событий](#События) `VKWebAppGetCommunityTokenResult` и `VKWebAppGetCommunityTokenFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

Возможные ошибки:

- `This action cannot be performed in the background`, если мини-приложение запущено в фоновом режиме.

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `access_token` | `string` | Ключ доступа сообщества. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppGetCommunityTokenResult`

Сигнализирует, что ключ доступа сообщества получен. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppGetCommunityTokenResult",
    data: {
      access_token: "cc9521551d93ddb290b32648a37a006d87438a67f953dd37e564eb6db1ec28f79d05c16e207f00a0" 
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppGetCommunityTokenFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Песочница

[VKWebAppGetCommunityToken](https://vk.cc/bZfqzK)

## Материалы по теме

- [Ключ доступа сообщества](../api/access-token/getting-started.md#Ключ доступа сообщества)
- [`VKWebAppGetAuthToken`](VKWebAppGetAuthToken.md)
