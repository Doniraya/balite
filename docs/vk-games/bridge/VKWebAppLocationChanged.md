---
title: "VKWebAppLocationChanged"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppLocationChanged"
category: "VK Bridge / События / Навигация"
---

# VKWebAppLocationChanged

`VKWebAppLocationChanged` отправляется платформой при изменении значения хеша после символа `#` через событие [`VKWebAppSetLocation`](VKWebAppSetLocation.md).

## Пример

```javascript
bridge.subscribe((e) => {
  if (e.detail.type === 'VKWebAppLocationChanged') {
    // Логика мини-приложения
  }
});
```

## Совместимость

| Площадки | Платформы |
| :--- | :--- |
| ВКонтакте | Mobile Web, Web |
| Одноклассники | – |

## Параметры

—

## Результат

`VKWebAppLocationChanged` сигнализирует, что хеш изменён. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `location` | `string` | Хеш — строка после символа `#` в URL вида `vk.com/app6909581#`. |

В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppLocationChanged",
    data: {
      location: "fragment"
    }
  }
}
```

## Пример обработки события

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).
