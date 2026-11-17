---
title: "VKWebAppOpenCodeReader"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppOpenCodeReader"
category: "VK Bridge / События / Текст и медиафайлы"
---

# VKWebAppOpenCodeReader

`VKWebAppOpenCodeReader` открывает камеру для считывания QR- или штрихкода и получает результат сканирования.

## Пример

```javascript
bridge.send('VKWebAppOpenCodeReader')
  .then((data) => { 
    if (data.code_data) {
      // Результат сканирования получен
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
| Одноклассники | Android, iOS |

## Параметры

—

## Результат

Проверить результат можно:

- Используя объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`.
- С помощью [событий](#События) `VKWebAppOpenCodeReaderResult` и `VKWebAppOpenCodeReaderFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

Возможные ошибки:

- `This action cannot be performed in the background`, если мини-приложение или игра запущены в фоновом режиме.
- `User denied`, если пользователь закрыл камеру.

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `code_data` | `string` | Строка, закодированная в QR- или штрихкоде. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppOpenCodeReaderResult`

Сигнализирует, что результат сканирования получен. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppOpenCodeReaderResult",
    data: {
      code_data: "https://vk.com/persik_ryzhiy"
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VVKWebAppOpenCodeReaderFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).
