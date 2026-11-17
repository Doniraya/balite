---
title: "VKWebAppShowCommunityWidgetPreviewBox"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppShowCommunityWidgetPreviewBox"
category: "VK Bridge / События / Пользователи и сообщества / Сообщества"
---

# VKWebAppShowCommunityWidgetPreviewBox

`VKWebAppShowCommunityWidgetPreviewBox` показывает экран предпросмотра виджета для сообщества.

**Важно!** Перед установкой виджета пользователь должен добавить плагин в сообщество. Чтобы добавить плагин, используйте событие VK Bridge [`VKWebAppAddToCommunity`](VKWebAppAddToCommunity.md). Подробнее — в разделе [Виджеты сообществ](https://dev.vk.com/ru/api/community-apps-widgets/getting-started).

## Пример

```javascript
bridge.send('VKWebAppShowCommunityWidgetPreviewBox', {
  group_id: 1234567890,
  type: 'cover_list',
  code: `return {
    "title": "Рестораны",
    "rows": [
      { "title": "Корюшка", "button": "Забронировать", "descr": "Петропавловская крепость, д. 3", "cover_id": "23434_45" },
      { "title": "Food Park", "button": "Забронировать стол", "descr": "Александровский парк, д. 4/3, лит. А", "cover_id": "23434_45435" }
    ]
  };`
})
  .then((data) => {
    if (data.result) {
      // Экран предпросмотра показан
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
| ВКонтакте | Android, iOS, Web |
| Одноклассники | – |

## Параметры

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `group_id` *обязательное* | `integer` | Идентификатор сообщества. |
| `type` *обязательное* | `string` | Тип виджета. Возможные значения: • `list` — выводит список объектов с описанием и кнопками для действий. • `table` — выводит таблицу с данными. • `tiles` — выводит плитки с изображением и кратким описанием. • `compact_list` — выводит список элементов в компактном виде. • `cover_list` — выводит список изображений (от 1 до 3) с кнопкой для действия, заголовком и описанием. • `match` — выводит текущий результат спортивного матча. • `matches` — выводит список спортивных матчей. • `donation` — выводит прогресс пожертвований. Параметры всех поддерживаемых типов виджетов подробно описаны в разделе [Виджеты сообществ](https://dev.vk.com/ru/reference/objects/app-widget). |
| `code` *обязательное* | `string` | Код виджета на языке программирования VKScript. Подробная информация о синтаксисе и возможностях этого языка с примерами находится в описании метода [`execute`](https://dev.vk.com/ru/method/execute#%D0%9F%D1%80%D0%B8%D0%BC%D0%B5%D1%80%20%D0%B7%D0%BD%D0%B0%D1%87%D0%B5%D0%BD%D0%B8%D1%8F%20%D0%BF%D0%B0%D1%80%D0%B0%D0%BC%D0%B5%D1%82%D1%80%D0%B0%20code). |

## Результат

Проверить результат можно:

- Используя объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`.
- С помощью [событий](#События) `VKWebAppShowCommunityWidgetPreviewBoxResult` и `VKWebAppShowCommunityWidgetPreviewBoxFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `result` | `boolean` | `true`, если экран предпросмотра показан. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppShowCommunityWidgetPreviewBoxResult`

Сигнализирует, что экран предпросмотра показан. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppShowCommunityWidgetPreviewBoxResult",
    data: {
      result: true
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppShowCommunityWidgetPreviewBoxFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Песочница

[VKWebAppShowCommunityWidgetPreviewBox](https://vk.cc/bZfr2S)
