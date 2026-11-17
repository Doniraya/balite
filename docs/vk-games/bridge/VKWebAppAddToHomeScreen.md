---
title: "VKWebAppAddToHomeScreen"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppAddToHomeScreen"
category: "VK Bridge / События / Социальные механики и взаимодействие"
---

# VKWebAppAddToHomeScreen

`VKWebAppAddToHomeScreen` показывает окно с предложением добавить ярлык мини-приложения или игры на экран устройства. Чтобы убедиться, что ярлык ещё не был добавлен, вызовите событие [`VKWebAppAddToHomeScreenInfo`](VKWebAppAddToHomeScreenInfo.md).

## Пример

```javascript
bridge.send('VKWebAppAddToHomeScreen')
  .then((data) => { 
    if (data.result) {
      // Ярлык мини-приложения или игры добавлен на экран устройства
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
| ВКонтакте | Android |
| Одноклассники | – |

## Параметры

—

## Результат

Проверить результат можно:

- Используя объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`.
- С помощью [событий](#События) `VKWebAppAddToHomeScreenResult` и `VKWebAppAddToHomeScreenFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

Возможные ошибки:

- `This action cannot be performed in the background`, если мини-приложение или игра запущены в фоновом режиме.
- `User denied`, если пользователь запретил доступ.

### Объект `Promise`

Если вызов к платформе прошёл успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `result` | `boolean` | `true`, если ярлык мини-приложения или игры добавлен на главный экран устройства. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppAddToHomeScreenResult`

Сигнализирует, что ярлык мини-приложения или игры добавлен на главный экран устройства. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppAddToHomeScreenResult",
    data: {
      result: true
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppAddToHomeScreenFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Смотри раздел [Обработка событий-результатов](getting-started.md#Обработка результата).

## Материалы по теме

- [Добавление игры на главный экран Android-устройства](../games/promotion/game-mechanics/add-to-home-screen.md)
- [VKWebAppAddToHomeScreenInfo](VKWebAppAddToHomeScreenInfo.md)
