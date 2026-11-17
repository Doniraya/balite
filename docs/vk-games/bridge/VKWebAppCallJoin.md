---
title: "VKWebAppCallJoin"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppCallJoin"
category: "VK Bridge / События / Звонки"
---

# VKWebAppCallJoin

`VKWebAppCallJoin` используется при [интеграции звонков](https://dev.vk.com/ru/mini-apps/development/calls-integration) в мини-приложение. Событие подключает пользователя к звонку по ссылке. Перед подключением пользователь видит окно с возможностью присоединиться к звонку.

![Окно подключения к звонку](https://sun9-40.userapi.com/XDs9TjifuRocSJgt0N9Ra2G69lAypvqGOIwxRw/Br4Ho9CCoNM.jpg)Окно подключения к звонку

## Пример

```javascript
bridge.send('VKWebAppCallJoin', {
  join_link: 'hg0IXLVD7txQyFKMTLt2Zy4P6HmuXxcKGcfF0A8GznU' 
  })
  .then((data) => { 
    if (data.result) {
      // Пользователь присоединился к звонку
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

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `join_link` *обязательное* | `string` | Ссылка для подключения к звонку. Ссылку на звонок возвращает событие [`VKWebAppCallStart`](VKWebAppCallStart.md). |

## Результат

Проверить результат можно:

- Используя объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`.
- С помощью [событий](#События) `VKWebAppCallJoinResult` и `VKWebAppCallJoinFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `result` | `boolean` | `true`, если пользователь присоединился к звонку. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppCallJoinResult`

Сигнализирует, что метод API выполнен. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppCallJoinResult",
    data: {
      result: true
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppCallJoinFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

- Если пользователь уже находится в звонке, возвращается ошибка c кодом `13:Сustom error`.
- Если пользователь не предоставил необходимые доступы ВКонтакте, возвращается код ошибки `11 Access denied`.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Материалы по теме

- [Интеграция звонков](https://dev.vk.com/ru/mini-apps/development/calls-integration)
- [VKWebAppCallStart](VKWebAppCallStart.md)
