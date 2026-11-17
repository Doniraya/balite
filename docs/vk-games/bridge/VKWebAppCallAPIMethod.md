---
title: "VKWebAppCallAPIMethod"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppCallAPIMethod"
category: "VK Bridge / События / Служебные"
---

# VKWebAppCallAPIMethod

С помощью `VKWebAppCallAPIMethod` вы можете отправлять запросы к [API ВКонтакте](https://dev.vk.com/ru/reference) и [API Одноклассников](https://apiok.ru/ext/) из клиентской части вашего приложения.

**Важно!** Не вызывайте с помощью этого события методы с [сервисным ключом доступа](../api/access-token/getting-started.md#Сервисный ключ доступа). Этот ключ используется для отправки API-запросов с сервера приложения. Передавать и хранить его в клиентской части приложения небезопасно.

## Пример

```javascript
bridge.send('VKWebAppCallAPIMethod', {
  method: 'users.get',
  params: {
    user_ids: '743784474,743784479',
    v: '5.131',
    access_token: 'ключ_доступа_пользователя'
  }})
  .then((data) => { 
    if (data.response) {
      // Метод API выполнен
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
| Одноклассники | Android, iOS, Mobile Web, Web |

## Параметры

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `method` *обязательное* | `string` | Имя вызываемого [метода API](https://dev.vk.com/ru/method). |
| `params` *обязательное* | `object` | Параметры метода API. Возможные поля: • `access_token` (`string`) — ключ доступа пользователя с соответствующими правами, полученный с помощью события [`VKWebAppGetAuthToken`](VKWebAppGetAuthToken.md). • `v` (`string`) — версия API, используемая для запроса (последняя доступная версия: `5.131`). • другие обязательные параметры метода API. |
| `use_local` | `boolean` | Определяет, к API какой площадки отправляется запрос. Возможные значения: • `true` — к API площадки, которая использует SDK, например [API Одноклассников](https://apiok.ru/ext/). • `false` — к [API Вконтакте](https://dev.vk.com/ru/reference). Значение по умолчанию. |

## Результат

Проверить результат можно:

- Используя объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`.
- С помощью [событий](#События) `VKWebAppCallAPIMethodResult` и `VKWebAppCallAPIMethodFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `response` | `array[object]` | Результат выполнения метода API. Описание структуры объекта `response` можно найти на странице соответствующего метода. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppCallAPIMethodResult`

Сигнализирует, что метод API выполнен. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppCallAPIMethodResult",
    data: {
      response: [
        {
          id: 743784474,
          first_name: "Персик",
          last_name: "Рыжий",
          can_access_closed: true,
          is_closed: false
        },
        {
          id: 743784479,
          first_name: "Сеня",
          last_name: "Хомяк",
          can_access_closed: true,
          is_closed: false
        }
      ]
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppCallAPIMethodFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Песочница

[VKWebAppCallAPIMethod](https://vk.cc/bZfnNu)

## Материалы по теме

- [API-вызовы в мини-приложениях](https://dev.vk.com/ru/mini-apps/development/api-calls)
- [API-вызовы в играх](../games/development/api-calls.md)
