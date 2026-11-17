---
title: "VKWebAppViewRestore"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppViewRestore"
category: "VK Bridge / События / Навигация"
---

# VKWebAppViewRestore

Мобильное приложение ВКонтакте для Android или iOS отправляет `VKWebAppViewRestore`, когда пользователь возвращается в игру или мини-приложение, после того как ранее переключился из него.

## Пример

#### Как подписаться на событие

```javascript
bridge.subscribe((e) => {
  if (e.detail.type === 'VKWebAppViewRestore') {
    // Действия при восстановлении 
    // экрана игры или мини-приложения
  }
});
```

#### Как обработать событие

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

Пример обработки также можно найти в разделе [Обработка событий сворачивания и восстановления экрана игры](../games/how-to/handle-minimize-and-restore-events.md).

## Совместимость

| Площадки | Платформы |
| :--- | :--- |
| ВКонтакте | Android, iOS |
| Одноклассники | – |

## Параметры

—

## Результат

`VKWebAppViewRestore` сигнализирует, что пользователь вернулся в мини-приложение или игру, после того как ранее перешёл из него в другое приложение. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppViewRestore",
    data: { }
  }
}
```

## Примечания

- Событие `VKWebAppViewRestore` является сигналом того, что мини-приложение или игра переходят в рабочий режим из фонового. Подробнее — в разделе [Работа VK Bridge в фоновом режиме](background-mode.md).
- Если мини-приложение или игра находятся в кеше приложений, платформа ВКонтакте вернёт пользователя на экран, который был активен при переходе из приложения.

## Материалы по теме

- [Работа VK Bridge в фоновом режиме](background-mode.md)
- [Обработка событий сворачивания и восстановления экрана игры](../games/how-to/handle-minimize-and-restore-events.md)
- [Работа кеша приложений](https://dev.vk.com/ru/development/launch/cache)
- [VKWebAppViewHide](VKWebAppViewHide.md)
- [VKWebAppChangeFragment](VKWebAppChangeFragment.md)
