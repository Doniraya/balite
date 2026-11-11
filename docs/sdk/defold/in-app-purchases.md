---
title: "Инап-покупки"
original_url: "https://yandex.ru/dev/games/doc/ru/sdk/defold/in-app-purchases.md"
category: "sdk/defold"
---

# Инап-покупки







Вы можете получать доход, предоставив пользователям возможность совершать покупки в игре. Например, дополнительное время на прохождение уровня или аксессуары для игрового персонажа. Для этого:

- [Подключите инап-покупки](https://yandex.ru/dev/games/console/purchases#connect) в Консоли разработчика Яндекс Игр.
- Настройте в SDK возможность работы с покупками.

## Портальная валюта {#portal-currency}

Ян (Yan) — это портальная валюта платформы Яндекс Игры для оплаты инап-покупок. Яны хранятся на едином для всех игр балансе игрока, который можно пополнить с помощью банковских карт. Курс яна к рублю динамический.

{% note info %}

Для международных платежей коэффициент яна к валюте будет зависеть от страны игрока.

{% endnote %}

Пополнить баланс можно:

- в шапке каталога;
- в профиле игрока;
- во время покупки в игре.

Пользователи также могут получать яны бонусом за участие в акциях или покупку фиксированных паков.

Совершать инап-покупки могут как авторизованные на Яндексе пользователи, так и неавторизованные. Авторизоваться пользователь может непосредственно во время игры, в том числе и в момент совершения покупки.

Порядок и условия выплаты лицензионного вознаграждения разработчику в связи с введением портальной валюты не изменятся.

## Условия подключения {#connection-conditions}

Требования к подключению покупок зависят от резидентства вашего юридического лица.

{% list tabs %}

- Резидент РФ

    Для настройки и тестирования покупок необходимо подписать «Акт приема-передачи неисключительных прав на использование Игры».

    После добавления покупок и публикации черновика игры отправьте письмо с запросом формы акта на почту [games-partners@yandex-team.ru](https://yandex.ru/dev/games/doc/ru/mailto:games-partners@yandex-team.ru){.external}. В письме обязательно укажите название и идентификатор (ID) игры.

    В ответ на ваше письмо будет отправлена форма «Акт приема-передачи неисключительных прав на использование Игры». Эту форму необходимо заполнить, подписать и отправить скан (или фото хорошего качества) в ответ на наше письмо.

    Только после получения подписанного акта инап-покупки можно будет настраивать и тестировать.

- Нерезидент РФ

    После добавления покупок и публикации черновика игры отправьте письмо с запросом на подключение покупок на почту [games-partners@yandex-team.ru](https://yandex.ru/dev/games/doc/ru/mailto:games-partners@yandex-team.ru){.external}. В письме обязательно укажите название и идентификатор (ID) игры, а также страну резидентства вашего юридического лица.

{% endlist %}

## Процесс покупки {#purchase-process}

Активировать инап-покупку можно следующим методом:

```lua
ysdk.payments.create_purchase(callback, options)
```

`callback` — function — callback вызванного метода. Имеет вид:

```lua
function(self, purchase: table|nil, signature: string|nil): nil
```

- `purchase: table` — информация о покупке. Содержит свойства:
    - `product_id: string` — идентификатор товара.
    - `purchase_token: string` — токен для использования покупки.
    - `developer_payload: string|nil` — дополнительные данные о покупке.
- `signature: string|nil` — данные о покупке и подпись для [проверки подлинности игрока](https://yandex.ru/dev/games/sdk/sdk-purchases#purchase-data-example).

`options` — параметры метода. Содержит свойства:

- `id: string` — идентификатор товара, который задан в Консоли разработчика.
- `developer_payload: string` — опциональный параметр. Дополнительная информация о покупке, которую вы хотите передавать на свой сервер (будет передана в параметре signature).
- `signed: boolean|nil` — опциональный параметр. Предназначен для защиты игры от накруток.

**Пример**

```lua showLineNumbers
function buy_item(id)
    ysdk.payments.create_purchase(
        function(self, purchase, signature)
            if purchase then
                print(purchase.product_id, signature)
            end
        end,
        { id, signed = true }
    )
end
```

## Получение списка купленных товаров {#getting-purchased-items}

Чтобы узнать, какие покупки игрок уже совершил, используйте метод:

```lua showLineNumbers
ysdk.payments.getPurchases(
    callback: function,
    options: {
        signed: boolean|nil
    }
)
```

`callback` — function — callback вызванного метода. Имеет вид:

```lua
function(self, purchase: Purchase[]|nil, signature: string|nil): nil
```

- `Purchase` — информация о покупке. Содержит свойства:
    - `product_id: string` — идентификатор товара.
    - `purchase_token: string` — токен для использования покупки.
    - `developer_payload: string|nil` — дополнительные данные о покупке.

- `signature: string|nil` — данные о покупке и подпись для проверки подлинности игрока.

**Пример**

```lua showLineNumbers
function display_puchases()
    ysdk.payments.get_purchases(function(self, purchases)
        if purchases then
            for k, v in pairs(purchases) do print(k, v) end
        end
    end)
end
```

## Получение каталога всех товаров {#getting-all-products}

Чтобы получить список доступных покупок и их стоимость, используйте метод `ysdk.payments.getCatalog()`.

```lua
ysdk.payments.getCatalog(callback: function)
```

`callback` — function — callback вызванного метода. Имеет вид:

```lua
function(self, products: Product[]|nil): nil
```

- `products: table[]` — информация о товарах. Содержит свойства:

```lua showLineNumbers
products = [
    {
        id: string,
        title: string,
        description: string,
        image_uri: string,
        price: string,
        price_value: string,
        price_currency_code: string,
        price_currency_image: {
            small: string,
            medium: string,
            svg: string
        }
    },
    ...
]
```

**Пример**

```lua showLineNumbers
function display_shop()
    ysdk.payments.get_catalog(function(self, products)
        if products then
            for k, v in pairs(products) do print(v.title, v.price, v.description) end
        end
    end)
end
```

## Обработка покупки и начисление внутриигровой валюты {#processing-crediting}

Существуют два типа покупок — постоянные (например, отключение рекламы) и используемые (например, внутриигровая валюта).

Для обработки постоянных покупок применяйте метод `ysdk.payments.get_purchases()`.

Для обработки используемых покупок применяйте метод `ysdk.payments.consume_purchase()`.

```lua
ysdk.payments.consume_purchase(purchase_token: string)
```

{% note alert %}

После вызова метода `ysdk.payments.consume_purchase()` обработанная покупка удаляется без возможности восстановления. Поэтому сначала модифицируйте данные игрока методами `ysdk.player.set_stats()` или `ysdk.player.increment_stats()`, а затем обрабатывайте покупку.

{% endnote %}

**Пример**

```lua showLineNumbers
function buy_item(id)
    ysdk.payments.create_purchase(
        function(self, purchase)
            if purchase then
                ysdk.payments.consume_puchase(purchase.purchase_token)
            end
        end,
        { id }
    )
end
```

---


{% note info %}

Если при работе с плагином вы столкнулись с проблемой или у вас появился вопрос, обратитесь в [сообщество в Телеграме](https://t.me/yagamedev/1233731){.telegram} или в [сообщество ВКонтакте](https://vk.ru/yandexgmsdev){.vk}.

{% endnote %}


<a href="https://github.com/yandex-games-plugins/defold">
  <span class="button">Репозиторий</span>
</a>
