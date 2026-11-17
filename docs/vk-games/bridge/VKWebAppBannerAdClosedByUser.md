---
title: "VKWebAppBannerAdClosedByUser"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppBannerAdClosedByUser"
category: "VK Bridge / События / Монетизация / Баннеры"
---

# VKWebAppBannerAdClosedByUser

`VKWebAppBannerAdClosedByUser` отправляется платформой, если пользователь закрыл баннер рекламы в игре или мини-приложении, нажав кнопку на баннере.

- [Баннерная реклама в играх](../games/monetization/ad/banners.md)
- [Баннерная реклама в мини-приложениях](https://dev.vk.com/ru/mini-apps/monetization/ad/banners)

## Пример

```javascript
bridge.subscribe((e) => {
  if (e.detail.type === 'VKWebAppBannerAdClosedByUser') {
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

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

`VKWebAppBannerAdClosedByUser` сигнализирует, что баннер закрыт пользователем. В качестве ответа платформа возвращает объект со следующими полями:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `banner_width` | `integer` | Ширина скрытого баннера в пикселях. |
| `banner_height` | `integer` | Высота скрытого баннера в пикселях. |
| `banner_location` | `string` | Расположение скрытого баннера по вертикали. Возможные значения: • `top` — баннер был прижат к верху экрана приложения. • `bottom` — баннер был прижат к низу экрана приложения. |
| `banner_align` | `string` | Расположение баннера по горизонтали. Используется при следующих условиях: • Поле `layout_type` равно `overlay`. — и — • Игра запущена в десктопной версии сайта. — или — Игра запущена на мобильном устройстве, которое работает в горизонтальной ориентации. Возможные значения: • `left` — баннер прижат к левому краю экрана. • `right` — баннер прижат к правому краю экрана. • `center` — баннер расположен по центру экрана. Если значение `layout_type` равно `resize`, параметр не возвращается. |
| `orientation` | `string` | Ориентация скрытого баннера. Используется только для игр, работающих в десктопной версии сайта. Возможные значения: • `vertical` — баннер был вытянут по вертикали. Изображение расположено сверху. • `horizontal` — баннер был вытянут по горизонтали. Изображение расположено слева. |
| `layout_type` | `string` | Тип фона баннера. Возможные значения: • `resize` — экран игры или мини-приложения был уменьшен на размер баннера. • `overlay` — баннер был расположен поверх экрана игры или мини-приложения. |

В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppBannerAdClosedByUser",
    data: {
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
- [VKWebAppBannerAdUpdated](VKWebAppBannerAdUpdated.md)
