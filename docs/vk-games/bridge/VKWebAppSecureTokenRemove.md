---
title: "VKWebAppSecureTokenRemove"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppSecureTokenRemove"
category: "VK Bridge / События / Мобильные устройства / Аутентификация"
---

# VKWebAppSecureTokenRemove

`VKWebAppSecureTokenRemove` удаляет ключ доступа, который был сохранён для [аутентификации пользователя с помощью биометрии](https://dev.vk.com/ru/mini-apps/development/biometrics-authentication), из защищённого хранилища.

## Пример

```javascript
bridge.send('VKWebAppSecureTokenRemove')
  .then((data) => { 
    if (data.result) {
      // Ключ доступа удалён из защищённого хранилища
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
- С помощью [событий](#События) `VKWebAppSecureTokenRemoveResult` и `VKWebAppSecureTokenRemoveFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `result` | `boolean` | `true`, если ключ доступа был удалён из защищённого хранилища. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppSecureTokenRemoveResult`

Сигнализирует, что ключ доступа был удалён из защищённого хранилища. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppSecureTokenRemoveResult",
    data: {
      result: true
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppSecureTokenRemoveFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой, или о том, что биометрия недоступна на устройстве.

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
