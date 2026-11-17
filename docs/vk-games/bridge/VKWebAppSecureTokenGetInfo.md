---
title: "VKWebAppSecureTokenGetInfo"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppSecureTokenGetInfo"
category: "VK Bridge / События / Мобильные устройства / Аутентификация"
---

# VKWebAppSecureTokenGetInfo

`VKWebAppSecureTokenGetInfo` возвращает информацию о том, доступно ли на устройстве использование биометрии: изображения лица или отпечатка пальца.

В дальнейшем эти данные могут использоваться для [аутентификации пользователя в мини-приложении](https://dev.vk.com/ru/mini-apps/development/biometrics-authentication).

## Пример

```javascript
bridge.send('VKWebAppSecureTokenGetInfo')
  .then((data) => { 
    if (data.available) {
      // Биометрия доступна на устройстве
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
- С помощью [событий](#События) `VKWebAppSecureTokenGetInfoResult` и `VKWebAppSecureTokenGetInfoFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `available` | `boolean` | Информация о том, доступно ли использование биометрических данных на устройстве. Возможные значения: • `true` — биометрия доступна. • `false` — биометрия недоступна. |
| `access_requested` | `boolean` | Информация о том, запрашивало ли мини-приложение доступ к биометрии. Возможные значения: • `true` — доступ запрошен. • `false` — доступ не запрошен. |
| `allowed` | `boolean` | Информация о том, получило ли мини-приложение разрешение на использование биометрии. Поле есть, если `accessRequested` = `true`. Возможные значения: • `true` — разрешение получено. • `false` — разрешение не получено. |
| `stored` | `boolean` | Информация о том, есть ли сохранённый ключ доступа на устройстве. Возможные значения: • `true` — сохранённый ключ доступа есть на устройстве. • `false` — сохранённый ключ доступа отсутствует на устройстве. |
| `type` | `string` | Если биометрия доступна на устройстве, то всегда возвращает значение `finger` независимо от типа доступной биометрии: отпечатка пальца или изображения лица. |
| `device_id` | `string` | Уникальный идентификатор устройства, с помощью которого можно сопоставить ключ доступа с устройством. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppSecureTokenGetInfoResult`

Сигнализирует, что биометрия доступна на устройстве. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppSecureTokenGetInfoResult",
    data: {
      available: true,
      access_requested: true,
      allowed: false,
      stored: false,
      type: "finger",
      device_id: "abceb6d87d4f65f2d5436573136720b9"
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppSecureTokenGetInfoFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Рекомендации

- Чтобы сохранение и получение ключа работало корректно, сначала разрешите вход в мини-приложение c помощью биометрии, используя событие [`VKWebAppSecureTokenRequestAccess`](VKWebAppSecureTokenRequestAccess.md).
- Чтобы сохранить произвольную строку в качестве ключа доступа, используйте событие [`VKWebAppSecureTokenSet`](VKWebAppSecureTokenSet.md).

## Материалы по теме

- [Авторизация с помощью биометрии](https://dev.vk.com/ru/mini-apps/development/biometrics-authentication)
- [`VKWebAppSecureTokenSet`](VKWebAppSecureTokenSet.md)
- [`VKWebAppSecureTokenRequestAccess`](VKWebAppSecureTokenRequestAccess.md)
