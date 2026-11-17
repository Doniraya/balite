---
title: "VKWebAppCallFinished"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppCallFinished"
category: "VK Bridge / События / Звонки"
---

# VKWebAppCallFinished

`VKWebAppCallFinished` используется при [интеграции звонков](https://dev.vk.com/ru/mini-apps/development/calls-integration) в мини-приложение. Отправляется платформой, если пользователь, создавший звонок, завершил его.

## Пример

```javascript
bridge.subscribe((e) => {
  if (e.detail.type === 'VKWebAppCallFinished') {
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

`VKWebAppCallFinished` сигнализирует, что пользователь, начавший звонок, завершил его для всех. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    "type": "VKWebAppCallFinished",
    "data": {}
  }
}
```

## Пример обработки события

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Рекомендации

После того как мини-приложение получит событие `VKWebAppCallFinished` от платформы, вам нужно передать эту информацию в серверную часть вашего мини-приложения и больше не отправлять пользователям ссылку на завершившийся звонок.

## Материалы по теме

- [VKWebAppCallLeft](VKWebAppCallLeft.md)
- [Интеграция звонков](https://dev.vk.com/ru/mini-apps/development/calls-integration)
