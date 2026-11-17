---
title: "VKWebAppSecureTokenGet"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppSecureTokenGet"
category: "VK Bridge / События / Мобильные устройства / Аутентификация"
---

# VKWebAppSecureTokenGet

`VKWebAppSecureTokenGet` запускает [проверку биометрии](https://dev.vk.com/ru/mini-apps/development/biometrics-authentication) и после её успешного прохождения возвращает ключ доступа из защищённого хранилища. Ключ доступа устанавливается с помощью события [`VKWebAppSecureTokenSet`](VKWebAppSecureTokenSet.md).

![Окно проверки биометрии](https://sun9-47.userapi.com/fJ9q8kqrFJHpXpWzDHgi_etar-Tn3Z0X0lagew/xeZJ5FcRgzQ.jpg)Окно проверки биометрии

## Пример

```javascript
bridge.send('VKWebAppSecureTokenGet')
  .then((data) => { 
    if (data.token) {
      // Ключ доступа получен
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
- С помощью [событий](#События) `VKWebAppSecureTokenGetResult` и `VKWebAppSecureTokenGetFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `token` | `string` | Ключ доступа из защищённого хранилища. Если на устройстве нет сохранённого ключа доступа, возвращается значение `null`. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppSecureTokenGetResult`

Сигнализирует, что ключ доступа получен. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppSecureTokenGetResult",
    data: {
      result: {
        token: "le93@1YpW73&1"
      }
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppSecureTokenGetFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой, или означает, что пользователь запретил использование биометрии.

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
