---
title: "VKWebAppStorageGetKeys"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppStorageGetKeys"
category: "VK Bridge / События / Хранилище VK Storage"
---

# VKWebAppStorageGetKeys

`VKWebAppStorageGetKeys` возвращает названия переменных, сохранённых событием [`VKWebAppStorageSet`](VKWebAppStorageSet.md).

## Пример

```javascript
bridge.send('VKWebAppStorageGetKeys', {
  count: 20,
  offset: 0
  })
  .then((data) => { 
    if (data.keys) {
      // Названия переменных получены
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
| `count` *обязательное* | `integer` | Количество переменных, названия которых необходимо получить. |
| `offset` *обязательное* | `integer` | Смещение для возвращения названий переменных относительно начала списка. |

## Результат

Проверить результат можно:

- Используя объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`.
- С помощью [событий](#События) `VKWebAppStorageGetKeysResult` и `VKWebAppStorageGetKeysFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `keys` | `array[string]` | Названия переменных. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppStorageGetKeysResult`

Сигнализирует, что названия переменных получены. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppStorageGetKeysResult",
    data: {
      keys: [
        "example1",
        "example2",
        "example3"
      ]
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppStorageGetKeysFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Песочница

[VKWebAppStorageGetKeys](https://vk.cc/bZfuSa)
