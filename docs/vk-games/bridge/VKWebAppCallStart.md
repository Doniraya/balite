---
title: "VKWebAppCallStart"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppCallStart"
category: "VK Bridge / События / Звонки"
---

# VKWebAppCallStart

`VKWebAppCallStart` используется при [интеграции звонков](https://dev.vk.com/ru/mini-apps/development/calls-integration) в мини-приложение. Событие создаёт ссылку, по которой к звонку могут присоединяться пользователи, запустившие мини-приложение.

## Пример

```javascript
bridge.send('VKWebAppCallStart')  
  .then((data) => { 
    if (data.result) {
      // Ссылка на звонок создана
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
| ВКонтакте | Android, iOS, Web |
| Одноклассники | – |

## Параметры

—

## Результат

Проверить результат можно:

- Используя объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`.
- С помощью [событий](#События) `VKWebAppCallStartResult` и `VKWebAppCallStartFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `join_link` | `string` | URL, по которому можно подключить к звонку других участников с помощью события [`VKWebAppCallJoin`](VKWebAppCallJoin.md). |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppCallStartResult`

Сигнализирует, что метод API выполнен. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppCallStartResult",
    data: {
        "join_link": "hg0IXLVD7txQyFKMTLt2Zy4P6HmuXxcKGcfF0A8GznU"
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppCallStartFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Материалы по теме

- [Интеграция звонков](https://dev.vk.com/ru/mini-apps/development/calls-integration)
- [VKWebAppCallJoin](VKWebAppCallJoin.md)
