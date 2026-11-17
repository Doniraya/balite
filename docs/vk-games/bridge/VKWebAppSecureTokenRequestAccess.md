---
title: "VKWebAppSecureTokenRequestAccess"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppSecureTokenRequestAccess"
category: "VK Bridge / События / Мобильные устройства / Аутентификация"
---

# VKWebAppSecureTokenRequestAccess

`VKWebAppSecureTokenRequestAccess` запрашивает у пользователя разрешение на использование биометрии в качестве способа [аутентификации пользователя в мини-приложении](https://dev.vk.com/ru/mini-apps/development/biometrics-authentication). Пользователю будет показан запрос на использование биометрии: отпечатка пальца или лица.

## Пример

```javascript
bridge.send('VKWebAppSecureTokenRequestAccess')
  .then((data) => { 
    if (data.result) {
      // Разрешение на использование биометрии получено
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
| ВКонтакте | Android, iOS |
| Одноклассники | iOS |

## Параметры

—

## Результат

Проверить результат можно:

- Используя объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`.
- С помощью [событий](#События) `VKWebAppSecureTokenRequestAccessResult` и `VKWebAppSecureTokenRequestAccessFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `result` | `boolean` | `true`, если разрешение на использование биометрии для аутентификации было получено. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppSecureTokenRequestAccessResult`

Сигнализирует, что разрешение на использование биометрии для аутентификации было получено. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppSecureTokenRequestAccessResult",
    data: {
      result: true
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppSecureTokenRequestAccessFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой, или о том, что биометрия недоступна на устройстве.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Рекомендации

- Отправляйте событие `VKWebAppSecureTokenRequestAccess`, прежде чем сохранять ключ доступа с помощью события [`VKWebAppSecureTokenSet`](VKWebAppSecureTokenSet.md).
- Чтобы проверить, доступна ли биометрия на устройстве и запрашивалось ли разрешение пользователя для аутентификации по биометрии в мини-приложении, используйте событие [`VKWebAppSecureTokenGetInfo`](VKWebAppSecureTokenGetInfo.md).

## Материалы по теме

- [Аутентификация с помощью биометрии](https://dev.vk.com/ru/mini-apps/development/biometrics-authentication)
- [`VKWebAppSecureTokenSet`](VKWebAppSecureTokenSet.md)
- [`VKWebAppSecureTokenGet`](VKWebAppSecureTokenGet.md)
