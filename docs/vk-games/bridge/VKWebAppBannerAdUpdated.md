---
title: "VKWebAppBannerAdUpdated"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppBannerAdUpdated"
category: "VK Bridge / События / Монетизация / Баннеры"
---

# VKWebAppBannerAdUpdated

`VKWebAppBannerAdUpdated` отправляется платформой, если в игре или мини-приложении обновилась баннерная реклама.

- [Баннерная реклама в играх](../games/monetization/ad/banners.md)
- [Баннерная реклама в мини-приложениях](https://dev.vk.com/ru/mini-apps/monetization/ad/banners)

## Пример

```javascript
bridge.subscribe((e) => {
  if (e.detail.type === 'VKWebAppBannerAdUpdated') {
    // Логика мини-приложения
  }
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

`VKWebAppBannerAdUpdated` сигнализирует, что произошло обновление баннерной рекламы или получена ошибка. В качестве ответа платформа возвращает объект со следующими полями:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `result` | `boolean` | `true`, если баннерная реклама обновлена. `false` — в ином случае. |
| `banner_width` | `integer` | Ширина отображённого баннера в пикселях. |
| `banner_height` | `integer` | Высота отображённого баннера в пикселях. |
| `banner_location` | `string` | Расположение отображённого баннера по вертикали. Возможные значения: • `top` — баннер прижат к верху экрана приложения. • `bottom` — баннер прижат к низу экрана приложения. |
| `banner_align` | `string` | Расположение отображённого баннера по горизонтали. Используется при следующих условиях: • Поле `layout_type` равно `overlay`. — и — • Игра запущена в десктопной версии сайта. — или — Игра запущена на мобильном устройстве, которое работает в горизонтальной ориентации. Возможные значения: • `left` — баннер прижат к левому краю экрана. • `right` — баннер прижат к правому краю экрана. • `center` — баннер расположен по центру экрана. Если значение `layout_type` равно `resize`, параметр не возвращается. |
| `orientation` | `string` | Ориентация отображённого баннера. Используется только для игр, работающих в десктопной версии сайта. Возможные значения: • `vertical` — баннер вытянут по вертикали. Изображение расположено сверху. • `horizontal` — баннер вытянут по горизонтали. Изображение расположено слева. |
| `layout_type` | `string` | Тип фона отображённого баннера. Возможные значения: • `resize` — экран игры или мини-приложения уменьшен на размер баннера. • `overlay` — баннер расположен поверх экрана игры или мини-приложения. |
| `error_type` | `string` | Тип ошибки. |
| `error_data` | `object` | Дополнительные данные ошибки. |

В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppBannerAdUpdated",
    data: {
      "result" : true,
      "banner_width": 100,
      "banner_height": 64,
      "banner_location": "bottom",
      "banner_align": "left",
      "orientation": "horizontal",
      "layout_type": "overlay"
    }
  }
}
```

## Пример обработки события

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Материалы по теме

- [Баннерная реклама в мини-приложении](https://dev.vk.com/ru/mini-apps/monetization/ad/banners)
- [Как добавить баннерную рекламу в мини-приложение](https://dev.vk.com/ru/mini-apps/monetization/ad/implementation#%D0%91%D0%B0%D0%BD%D0%BD%D0%B5%D1%80%D0%BD%D0%B0%D1%8F%20%D1%80%D0%B5%D0%BA%D0%BB%D0%B0%D0%BC%D0%B0)
- [Баннерная реклама в игре](../games/monetization/ad/banners.md)
- [Как добавить баннерную рекламу в игру](../games/monetization/ad/implementation.md#Баннерная реклама)
- [VKWebAppBannerAdClosedByUser](VKWebAppBannerAdClosedByUser.md)
