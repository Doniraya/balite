---
title: "VKWebAppSecureTokenSet"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppSecureTokenSet"
category: "VK Bridge / События / Мобильные устройства / Аутентификация"
---

# VKWebAppSecureTokenSet

`VKWebAppSecureTokenSet` сохраняет произвольную строку в защищённое хранилище на устройстве пользователя. Получить строку из хранилища можно с помощью события [`VKWebAppSecureTokenGet`](VKWebAppSecureTokenGet.md).

Сохранённое значение используется в качестве ключа доступа к данным приложения после успешной [аутентификации пользователя по биометрии](https://dev.vk.com/ru/mini-apps/development/biometrics-authentication).

## Пример

```javascript
bridge.send('VKWebAppSecureTokenSet', {
  token: 'le93@1YpW73&1'
  })
  .then((data) => { 
    if (data.result) {
      // Произвольная строка сохранена в качестве ключа доступа
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

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `token` *обязательное* | `string` | Произвольная строка, которую необходимо сохранить в качестве ключа доступа. Если у вас несколько мини-приложений, то строка должна быть уникальна для каждого из них. |

## Результат

Проверить результат можно:

- Используя объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`.
- С помощью [событий](#События) `VKWebAppSecureTokenSetResult` и `VKWebAppSecureTokenSetFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `result` | `boolean` | `true`, если произвольная строка была сохранена в качестве ключа доступа. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppSecureTokenSetResult`

Сигнализирует, что произвольная строка была сохранена в качестве ключа доступа. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppSecureTokenSetResult",
    data: {
      result: true
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppSecureTokenSetFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой, или о том, что биометрия недоступна на устройстве.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Рекомендации

- Чтобы сохранение и получение ключа работало корректно, сначала разрешите вход в мини-приложение c помощью биометрии, используя событие [`VKWebAppSecureTokenRequestAccess`](VKWebAppSecureTokenRequestAccess.md).
- Чтобы получить сохранённую строку, используйте событие [`VKWebAppSecureTokenGet`](VKWebAppSecureTokenGet.md).

## Материалы по теме

- [Аутентификация с помощью биометрии](https://dev.vk.com/ru/mini-apps/development/biometrics-authentication)
- [`VKWebAppSecureTokenGet`](VKWebAppSecureTokenGet.md)
- [`VKWebAppSecureTokenRequestAccess`](VKWebAppSecureTokenRequestAccess.md)
