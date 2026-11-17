---
title: "VKWebAppAllowNotifications"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppAllowNotifications"
category: "VK Bridge / События / Социальные механики и взаимодействие"
---

# VKWebAppAllowNotifications

**Важно!** Событие станет доступно пользователям после того, как ваше приложение пройдёт модерацию.

- [Модерация мини-приложений](https://dev.vk.com/ru/mini-apps/settings/moderation)
- [Модерация игр](../games/settings/moderation.md)

`VKWebAppAllowNotifications` показывает окно с запросом разрешения на отправку уведомлений от мини-приложения или игры.

- [Уведомления в мини-приложениях](https://dev.vk.com/ru/mini-apps/promotion/social-mechanics/notifications/overview)
- [Уведомления в играх](../games/promotion/game-mechanics/notifications/overview.md)

> Обратите внимание, если пользователь выключил уведомления от игр и мини-приложений в настройках, то он не сможет их получать даже после выдачи разрешения.

## Пример

```javascript
bridge.send('VKWebAppAllowNotifications')
  .then((data) => { 
    if (data.result) {
      // Разрешение на отправку уведомлений мини-приложением или игрой получено
    } else {
      // Ошибка
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

—

## Результат

Проверить результат можно:

- Используя объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`.
- С помощью [событий](#События) `VKWebAppAllowNotificationsResult` и `VKWebAppAllowNotificationsFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

Возможные ошибки:

- `This action cannot be performed in the background`, если мини-приложение или игра запущены в фоновом режиме.
- `User denied`, если пользователь закрыл окно с запросом разрешения на отправку уведомлений от мини-приложения или игры.

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `result` | `boolean` | `true`, если разрешение на отправку уведомлений мини-приложением или игрой получено. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppAllowNotificationsResult`

Сигнализирует, что разрешение на отправку уведомлений мини-приложением или игрой получено. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppAllowNotificationsResult",
    data: {
      result: true
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppAllowNotificationsFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Песочница

[VKWebAppAllowNotifications](https://vk.cc/bZfspS)

## Материалы по теме

- [Уведомления в мини-приложениях](https://dev.vk.com/ru/mini-apps/promotion/social-mechanics/notifications/overview)
- [Уведомления в играх](../games/promotion/game-mechanics/notifications/overview.md)
- [VKWebAppDenyNotifications](VKWebAppDenyNotifications.md)
