---
title: "VKWebAppGetConfig"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppGetConfig"
category: "VK Bridge / События / Служебные"
---

# VKWebAppGetConfig

`VKWebAppGetConfig` получает информацию о конфигурации мини-приложения или игры, а также информацию о родительском приложении, в котором открыто мини-приложение или игра.

## Рекомендации

- Используйте это событие, если вам нужно получить конфигурацию до вызова события инициализации [`VKWebAppInit`](VKWebAppInit.md). В остальных случаях используйте стандартный способ получения конфигурации — подпишитесь на событие [`VKWebAppUpdateConfig`](VKWebAppUpdateConfig.md).
- Чтобы определить цветовую схему до получения данных от платформы, используйте свойство [`prefers-color-scheme`](https://developer.mozilla.org/ru/docs/Web/CSS/@media/prefers-color-scheme).

## Пример

```javascript
bridge.send('VKWebAppGetConfig')
  .then((data) => { 
    if (data.api_host) {
      // Информация получена
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
| Одноклассники | – |

## Параметры

—

## Результат

Чтобы проверить результат, используйте:

- Объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`.
- Событие [`VKWebAppGetConfigResult`](#События).

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующими полями:

| Поле | Тип | Платформа | Значение |
| :--- | :--- | :--- | :--- |
| `adaptivity` | `string` | Android, iOS | Адаптивная вёрстка. Возможные значения: • `auto` — автоматически выбирать вёрстку в зависимости от размера экрана. • `adaptive` – всегда использовать адаптивную вёрстку. • `force_mobile` – всегда использовать вёрстку для мобильных устройств. |
| `api_host` | `string` | Mobile Web, Web | API-хост для вызовов, не использующих VK Bridge: `api.vk.ru`. |
| `app` | `string` | Android, iOS | Тип мобильного клиента. Возможные значения: • `vkclient` — приложение «ВКонтакте». • `vkme` — приложение «VK Мессенджер». • `ok` — приложение «Одноклассники». |
| `app_id` | `string` | Android, iOS, Mobile Web, Web | Идентификатор приложения, которому соответствует нативное мобильное приложение ВКонтакте. |
| `appearance` | `string` | Android, iOS, Mobile Web, Web | Тема мини-приложения или игры. Возможные значения: • `light`— светлая тема. • `dark` — тёмная тема. |
| `back_button` | `string` | Android, iOS | Отображение кнопки выхода из приложения на главном экране. Возможные значения: • `back` — «Назад». • `close` — «Закрыть». • `none` – не показывать кнопку. |
| `insets` | `object` | Android, iOS | Величина отступов, которые необходимо выдержать от края экрана до контента. Поля объекта: • `right` — отступ справа. • `top` — отступ сверху. • `left` — отступ слева. • `bottom` – отступ снизу. Если показана клавиатура, её высота будет указана в параметре `bottom`. |
| `integration` | `string` | Android, iOS, Mobile Web, Web | Тип встраивания мини-приложения или игры. Возможные значения: • `fullscreen` – на весь экран. • `content` – встроено в контентную зону, например режим Split View в мобильном приложении или вторая колонка на сайте vk.com. • `popup` — всплывающее модальное окно. • `popup_fullscreen` — всплывающее окно на весь экран. |
| `idfv` | `string` | iOS | Идентификатор для приложений от одного разработчика на устройстве iOS. Подробнее – в [документации Apple](https://developer.apple.com/documentation/uikit/uidevice/identifierforvendor). |
| `is_layer` | `boolean` | Web | Признак того, что мини-приложение или игра открыты в слое. |
| `scheme` | `string` | Android, iOS, Mobile Web, Web | Цветовая схема мини-приложения или игры. Возможные значения: • `space_gray` — тёмная схема мобильного приложения и мобильной версии сайта. • `bright_light` — светлая схема мобильного приложения и мобильной версии сайта. • `vkcom_light` — светлая схема десктопной версии сайта. • `vkcom_dark` — тёмная схема десктопной версии сайта. |
| `start_time` | `integer` | Android, iOS | Время и дата открытия модального экрана ([Unix Timestamp](https://www.unixtimestamp.com/)). Передаётся только при открытии модального экрана. |
| `viewport_height` | `integer` | Mobile Web, Web | Высота видимой области родительского окна. |
| `viewport_width` | `integer` | Mobile Web, Web | Ширина видимой области родительского окна. |
| `avail_height` | `integer` | Mobile Web, Web | Высота доступной области родительского окна. |
| `avail_width` | `integer` | Mobile Web, Web | Ширина доступной области родительского окна. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppGetConfigResult`

Сигнализирует, что информация получена. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppGetConfigResult",
    data: {
      "scheme": "vkcom_light",
      "appearance": "light",
      "adaptivity": "auto",
      "integration": "fullscreen",
      "app": "vk.com",
      "app_id": 1234567,
      "vk_platform": "desktop_web",
      "back_button": "close",
      "api_host": "api.vk.ru",
      "viewport_width": 1103,
      "viewport_height": 722,
      "avail_width": 1103,
      "avail_height": 722
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppGetConfigFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Материалы по теме

- [VKWebAppUpdateConfig](VKWebAppUpdateConfig.md)
