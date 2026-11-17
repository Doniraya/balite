---
title: "VKWebAppAllowMessagesFromGroup"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppAllowMessagesFromGroup"
category: "VK Bridge / События / Пользователи и сообщества / Сообщества"
---

# VKWebAppAllowMessagesFromGroup

**Важно!** Событие станет доступно пользователям после того, как ваше приложение пройдёт модерацию.

- [Модерация мини-приложений](https://dev.vk.com/ru/mini-apps/settings/moderation)
- [Модерация игр](../games/settings/moderation.md)

`VKWebAppAllowMessagesFromGroup` показывает окно с запросом прав доступа на отправку сообщений от имени сообщества.

## Пример

```javascript
bridge.send('VKWebAppAllowMessagesFromGroup', {
  group_id: 166562603,
  key: 'dBuBKe1kFcdemzB' 
  })
  .then((data) => { 
    if (data.result) {
      // Пользователь разрешил отправку сообщений от имени сообщества
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
| `group_id` *обязательное* | `integer` | Идентификатор сообщества. |
| `key` *необязательное* | `string` | Произвольная строка. Этот параметр можно использовать для идентификации пользователя. |

## Результат

Проверить результат можно:

- Используя объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`.
- С помощью [событий](#События) `VKWebAppAllowMessagesFromGroupResult` и `VKWebAppAllowMessagesFromGroupFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

Возможные ошибки:

- `User denied`, если пользователь запретил отправку сообщений от имени сообщества.

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `result` | `boolean` | `true`, если пользователь разрешил отправку сообщений от имени сообщества. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppAllowMessagesFromGroupResult`

Сигнализирует, что пользователь разрешил отправку сообщений от имени сообщества. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppAllowMessagesFromGroupResult",
    data: {
      result: true
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppAllowMessagesFromGroupFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Песочница

[VKWebAppAllowMessagesFromGroup](https://vk.cc/bZfqcr)

## Материалы по теме

- [Игровые и социальные механики — Личные сообщения от игры](../games/promotion/game-mechanics/messages.md)
