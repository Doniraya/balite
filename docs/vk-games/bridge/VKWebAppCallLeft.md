---
title: "VKWebAppCallLeft"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppCallLeft"
category: "VK Bridge / События / Звонки"
---

# VKWebAppCallLeft

`VKWebAppCallLeft` используется при [интеграции звонков](https://dev.vk.com/ru/mini-apps/development/calls-integration) в мини-приложение. Событие отправляется платформой, если пользователь вышел из звонка.

## Пример

```javascript
bridge.subscribe((e) => {
  if (e.detail.type === 'VKWebAppCallLeft') {
    // Логика мини-приложения
  }
});
```

## Совместимость

| Площадки | Платформы |
| :--- | :--- |
| ВКонтакте | Android, iOS, Web |
| Одноклассники | – |

## Параметры

—

## Результат

`VKWebAppCallLeft` сигнализирует, что пользователь покинул звонок. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `reason` | `string` | Сообщение о причине, по которой пользователь вышел из звонка. Сейчас возвращается только значение `general` — неопределённая причина. |

В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    "type": "VKWebAppCallLeft",
    "data": {
      "reason": "general"
    }
  }
}
```

## Пример обработки события

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Материалы по теме

- [VKWebAppCallFinished](VKWebAppCallFinished.md)
- [Интеграция звонков](https://dev.vk.com/ru/mini-apps/development/calls-integration)
