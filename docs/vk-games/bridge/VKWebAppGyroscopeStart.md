---
title: "VKWebAppGyroscopeStart"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppGyroscopeStart"
category: "VK Bridge / События / Мобильные устройства / Гироскоп"
---

# VKWebAppGyroscopeStart

`VKWebAppGyroscopeStart` включает отслеживание и приём данных гироскопа, установленного на мобильном устройстве.

## Схема работы

1. Клиент вызывает `VKWebAppGyroscopeStart` для начала получения данных гироскопа.
2. Платформа отвечает:
  - Событием [`VKWebAppGyroscopeStartResult`](#VKWebAppGyroscopeStartResult) в случае успешного выполнения.
  - Событием [`VKWebAppGyroscopeStartFailed`](#VKWebAppGyroscopeStartFailed) в случае ошибки доступа к датчику.
3. Если на предыдущем шаге не было ошибки, платформа начинает отправлять поток событий [`VKWebAppGyroscopeChanged`](#VKWebAppGyroscopeChanged) с данными гироскопа.
4. На iOS поток событий с данными гироскопа может быть прерван. В этом случае платформа отправляет событие [`VKWebAppGyroscopeInterrupted`](#VKWebAppGyroscopeInterrupted).
5. Чтобы возобновить получение данных гироскопа, снова вызовите `VKWebAppGyroscopeStart`.

Чтобы прекратить отслеживание данных, вызовите [`VKWebAppGyroscopeStop`](VKWebAppGyroscopeStop.md).

## Пример

```javascript
bridge.send('VKWebAppGyroscopeStart', {
  refresh_rate: 500
  })
  .then((data) => { 
    if (data.result) {
      // Отслеживание данных гироскопа включено
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

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `refresh_rate` *необязательное* | `integer` | Период обновления данных гироскопа в миллисекундах. Минимальное значение: `20`. Максимальное значение: `1000`. Значение по умолчанию: `1000`. |

## Результат

Проверить результат можно:

- Используя объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`.
- С помощью событий:
  - [`VKWebAppGyroscopeStartResult`](#VKWebAppGyroscopeStartResult)
  - [`VKWebAppGyroscopeStartFailed`](#VKWebAppGyroscopeStartFailed)

Подробнее о проверке результатов при вызовах VK Bridge — в разделе [Обработка результата](getting-started.md#Обработка результата).

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`.

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppGyroscopeStartResult`

Сигнализирует, что отслеживание данных гироскопа включено и мини-приложение может получать данные. В обработчик события на стороне пользователя передаются данные:

```javascript
{
  detail: {
    type: "VKWebAppGyroscopeStartResult",
    data: {
      result: true
    }
  }
}
```

В качестве ответа платформа возвращает объект с полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `result` | `boolean` | `true`, если отслеживание данных гироскопа включено. |

#### `VKWebAppGyroscopeStartFailed`

Информирует, что при взаимодействии с платформой произошла ошибка или что мини-приложение не может получать данные гироскопа.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

## Отслеживание данных

Чтобы получить текущее состояние гироскопа, подпишитесь на события:

- [`VKWebAppGyroscopeChanged`](#VKWebAppGyroscopeChanged) — отслеживает координаты устройства при его перемещении.
- [`VKWebAppGyroscopeInterrupted`](#VKWebAppGyroscopeInterrupted) — сообщает о том, что поток данных прервался. Событие доступно только для iOS.

#### `VKWebAppGyroscopeChanged`

Сигнализирует, что получены данные гироскопа — скорость вращения устройства вокруг осей X, Y и Z. Знак числа показывает, в какую сторону происходит вращение.

В обработчик события на стороне пользователя передаются данные:

```javascript
{
  detail: {
    type: "VKWebAppGyroscopeChanged",
    data: {
      x: -0.005497787,
      y: 0.002443461,
      z: 0.004886922
    }
  }
}
```

В качестве ответа платформа возвращает объект с полями:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `x` | `float` | Скорость вращения устройства вокруг оси X в радиан/c. |
| `y` | `float` | Скорость вращения устройства вокруг оси Y в радиан/c. |
| `z` | `float` | Скорость вращения устройства вокруг оси Z в радиан/c. |

#### `VKWebAppGyroscopeInterrupted`

Указывает на то, что поток событий `VKWebAppGyroscopeChanged` прерван и данные гироскопа больше не могут быть получены. Событие доступно только для iOS.

В обработчик события на стороне пользователя передаются данные:

```javascript
{
  detail: {
    type: "VKWebAppGyroscopeInterrupted",
    data: {
      "message": "Received empty accelerometer data"
    }
  }
}
```

Чтобы продолжить отслеживание данных гироскопа, снова вызовите событие `VKWebAppGyroscopeStart`.
