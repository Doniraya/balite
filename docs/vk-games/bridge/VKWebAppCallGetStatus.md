---
title: "VKWebAppCallGetStatus"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppCallGetStatus"
category: "VK Bridge / События / Звонки"
---

# VKWebAppCallGetStatus

`VKWebAppCallGetStatus` используется при [интеграции звонков](https://dev.vk.com/ru/mini-apps/development/calls-integration) в мини-приложение. Событие получает информацию о состоянии текущего активного звонка.

## Пример

```javascript
bridge.send('VKWebAppCallGetStatus')  
  .then((data) => { 
    if (data.result) {
      // Информация о состоянии активного звонка получена
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
- С помощью [событий](#События) `VKWebAppCallGetStatusResult` и `VKWebAppCallGetStatusFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `is_active` | `bool` | Состояние звонка. Возможные значения: • `true` — звонок активен. • `false` — звонок завершён. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppCallGetStatusResult`

Сигнализирует, что статус звонка получен. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppCallGetStatusResult",
    "data": {
        "is_active": true,
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppCallGetStatusFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Материалы по теме

- [Интеграция звонков](https://dev.vk.com/ru/mini-apps/development/calls-integration)
- [VKWebAppCallFinished](VKWebAppCallFinished.md)
- [VKWebAppCallLeft](VKWebAppCallLeft.md)
