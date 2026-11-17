---
title: "API-вызовы в играх"
original_url: "https://dev.vk.com/ru/games/development/api-calls"
category: "VK Games / Разработка"
---

# API-вызовы в играх

Чтобы обмениваться данными с платформой и отправлять запросы, используйте [события библиотеки VK Bridge](../../bridge/overview.md), [методы API ВКонтакте](https://dev.vk.com/ru/reference) или [API Одноклассников](https://apiok.ru).

API-cерверы ВКонтакте используют адрес `api.vk.ru`. API-серверы Одноклассников — `api.ok.ru`.

Мы рекомендуем определять адрес сервера динамически.

Чтобы определять адрес во время работы игры ВКонтакте, вызовите событие [`VKWebAppGetConfig`](../../bridge/VKWebAppGetConfig.md). Оно возвращает информацию об используемой платформе и рабочем окружении. Поле `api_host` в данных ответа содержит адрес сервера для API-запросов.

Также мы рекомендуем подписаться на событие [`VKWebAppUpdateConfig`](../../bridge/VKWebAppUpdateConfig.md). Платформа отправляет его игре при изменении параметров среды. Ответ события также содержит поле `api_host`, в котором указан адрес сервера для API-запросов.

Для вызова некоторых API-методов можно использовать событие [`VKWebAppCallAPIMethod`](../../bridge/VKWebAppCallAPIMethod.md). Оно отправляет запросы к [API ВКонтакте](https://dev.vk.com/ru/reference), [API Одноклассников](https://apiok.ru/ext/) или к серверу, который использует ваша игра. Не вызывайте с помощью этого события API-методы, использующие [сервисный ключ доступа](../../api/access-token/getting-started.md#Сервисный ключ доступа). Передавать и хранить этот ключ в клиентской части приложения небезопасно.

## Материалы по теме

- [Параметры запуска приложений ВКонтакте](https://dev.vk.com/ru/development/launch/launch-params)
- [Параметры запуска приложений в Одноклассниках](../../ok/development/launch-parameters.md)
- [Формат API-запросов](../../api/api-requests.md)
- [VKWebAppGetConfig](../../bridge/VKWebAppGetConfig.md)
- [VKWebAppUpdateConfig](../../bridge/VKWebAppUpdateConfig.md)
- [VKWebAppCallAPIMethod](../../bridge/VKWebAppCallAPIMethod.md)
