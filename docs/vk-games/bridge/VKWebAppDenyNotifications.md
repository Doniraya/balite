---
title: "VKWebAppDenyNotifications"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppDenyNotifications"
category: "VK Bridge / События / Социальные механики и взаимодействие"
---

# VKWebAppDenyNotifications

**Важно!** Событие станет доступно пользователям после того, как ваше приложение пройдёт модерацию.

- [Модерация мини-приложений](https://dev.vk.com/ru/mini-apps/settings/moderation)
- [Модерация игр](../games/settings/moderation.md)

`VKWebAppDenyNotifications` отключает уведомления от мини-приложения или игры.

- [Уведомления в мини-приложениях](https://dev.vk.com/ru/mini-apps/promotion/social-mechanics/notifications/overview)
- [Уведомления в играх](../games/promotion/game-mechanics/notifications/overview.md)

## Пример

```javascript
bridge.send('VKWebAppDenyNotifications')
  .then((data) => { 
    if (data.result) {
      // Уведомления от мини-приложения или игры отключены
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

- Используя объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`;
- С помощью [событий](#События) `VKWebAppDenyNotificationsResult` и `VKWebAppDenyNotificationsFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `result` | `boolean` | `true`, если уведомления отключены от мини-приложения или игры. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppDenyNotificationsResult`

Сигнализирует, что уведомления отключены от мини-приложения или игры. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppDenyNotificationsResult",
    data: {
      result: true
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppDenyNotificationsFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Песочница

[VKWebAppDenyNotifications](https://vk.cc/bZft1F)

## Материалы по теме

- [Уведомления в мини-приложениях](https://dev.vk.com/ru/mini-apps/promotion/social-mechanics/notifications/overview)
- [Уведомления в играх](../games/promotion/game-mechanics/notifications/overview.md)
- [VKWebAppAllowNotifications](VKWebAppAllowNotifications.md)
