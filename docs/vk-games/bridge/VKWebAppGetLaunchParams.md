---
title: "VKWebAppGetLaunchParams"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppGetLaunchParams"
category: "VK Bridge / События / Служебные"
---

# VKWebAppGetLaunchParams

`VKWebAppGetLaunchParams` получает актуальные значения параметров запуска игры или мини-приложения.

- [Параметры запуска приложений ВКонтакте](https://dev.vk.com/ru/development/launch/launch-params)
- [Параметры запуска приложений в Одноклассниках](../ok/development/launch-parameters.md)

Во время работы приложения некоторые параметры могут поменяться и будут отличаться от значений, которые были переданы при запуске приложения. Например, пользователь во время работы с приложением разрешил ему отправлять уведомления. В таком случае после вызова события `VKWebAppGetLaunchParams` параметр `vk_are_notifications_enabled` будет содержать значение `1` — отправка уведомлений разрешена.

## Пример

```javascript
bridge.send('VKWebAppGetLaunchParams')
  .then((data) => { 
    if (data.vk_app_id) {
      // Параметры запуска получены
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

- Используя объект [``](#Объект ), который возвращается вызовом `bridge.send(...)`.
- С помощью [событий](#События) `VKWebAppGetLaunchParamsResult` и `VKWebAppGetLaunchParamsFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект с параметрами запуска игры или мини-приложения.

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppGetLaunchParamsResult`

Сигнализирует, что параметры запуска получены. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppGetLaunchParamsResult",
    data: {
      sign: "Hb67aIL4cElWINenspCpKu3tUgacikw541NCXX8zWL4",
      vk_access_token_settings: "",
      vk_app_id: 8142709,
      vk_are_notifications_enabled: 0,
      vk_is_app_user: 1,
      vk_is_favorite: 0,
      vk_language: "ru",
      vk_platform: "desktop_web",
      vk_ref: "other",
      vk_ts: 1664886146,
      vk_user_id: 82156740
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppGetLaunchParamsFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Материалы по теме

- [Параметры запуска приложений ВКонтакте](https://dev.vk.com/ru/development/launch/launch-params)
- [Параметры запуска приложений в Одноклассниках](../ok/development/launch-parameters.md)
