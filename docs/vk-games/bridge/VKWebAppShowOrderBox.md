---
title: "VKWebAppShowOrderBox"
original_url: "https://dev.vk.com/ru/bridge/VKWebAppShowOrderBox"
category: "VK Bridge / События / Монетизация / Покупки"
---

# VKWebAppShowOrderBox

`VKWebAppShowOrderBox` открывает окно покупки виртуальной ценности в мини-приложении или игре.

**Примечание.** Чтобы протестировать платежи, добавьте тестировщиков в разделе **Платежи** панели управления. На счету каждого тестировщика должен быть как минимум 1 голос. При оплате голоса не будут списаны со счетов тестировщиков.

- [Платежи в панели управления играми](../games/settings/payments/setting-up.md)
- [Платежи в панели управления мини-приложениями](https://dev.vk.com/ru/mini-apps/settings/payments/setting-up)
- [Платежи виртуальной валютой](../api/payments/overview.md)

## Пример

```javascript
bridge.send('VKWebAppShowOrderBox', { 
  type: 'item',
  item: 'item_id_123456'
  })
  .then((data) => {
    if (data.success) {
      // Списание голосов прошло успешно
  }})
  .catch((error) => {
    // Ошибка
    console.log(error);
  });
```

## Совместимость

| Площадки | Платформы |
| :--- | :--- |
| ВКонтакте | Android, Mobile Web, Web |
| Одноклассники | Android, iOS, Mobile Web, Web |

## Параметры

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `type` *обязательное* | `string` | Тип виртуальной ценности. Всегда имеет значение `item`. |
| `item` *обязательное* | `string` | Название виртуальной ценности. Будет передано в уведомлении на получение информации о виртуальной ценности. Длина строки: 64 символа. |

## Результат

Проверить результат можно:

- Используя объект [`Promise`](#Объект Promise), который возвращается вызовом `bridge.send(...)`.
- С помощью [событий](#События) `VKWebAppShowOrderBoxResult` и `VKWebAppShowOrderBoxFailed`.

[Подробнее о проверке результатов при вызовах VK Bridge](getting-started.md#Обработка результата).

Возможные ошибки:

- `This action cannot be performed in the background`, если мини-приложение или игра запущены в фоновом режиме.

### Объект `Promise`

Если обращение к платформе прошло успешно, управление будет передано в `then`-обработчик объекта `Promise`. В качестве ответа платформа возвращает объект со следующим полем:

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `success` | `boolean` | Возвращает значение `true`, если списание прошло успешно. |
| `order_id` | `string` | Идентификатор заказа в [cистеме платежей](https://dev.vk.com/ru/api/payments/notifications/order-status-change). Возвращается, если `status` = `true`. |

Если при обращении к платформе произошла ошибка, управление передаётся в метод `catch`. В качестве ответа платформа возвращает [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех событий VK Bridge.

### События

#### `VKWebAppShowOrderBoxResult`

Сигнализирует, что списание голосов прошло успешно. В обработчик события на стороне пользователя передаются следующие данные:

```javascript
{
  detail: {
    type: "VKWebAppShowOrderBoxResult",
    data: {
      success: true,
      order_id: "235379722919"
    }
  }
}
```

Передаваемый объект подобен объекту, возвращаемому при [успешном выполнении промиса](#Объект Promise).

#### `VKWebAppShowOrderBoxFailed`

Информирует об ошибке, которая произошла при взаимодействии с платформой.

В обработчик события на стороне пользователя передаётся [объект с информацией об ошибке](getting-started.md#Обработка ошибок), общий для всех методов VK Bridge.

#### Пример обработки событий

Подробнее — в разделе [Обработка результата](getting-started.md#Обработка результата).

## Песочница игр

[VKWebAppShowOrderBox](https://vk.cc/bZfCRH)

## Материалы по теме

- [Мини-приложения — Панель управления | Платежи](https://dev.vk.com/ru/mini-apps/settings/payments/setting-up)
- [Игры — Панель управления | Платежи](../games/settings/payments/setting-up.md)
- [Продажа игровых товаров](../games/monetization/digital-goods.md)
- [Продажа товаров в мини-приложениях](https://dev.vk.com/ru/mini-apps/monetization/payments)
- [Платежи виртуальной валютой](../api/payments/overview.md)
