---
title: "Экран запуска приложения"
original_url: "https://dev.vk.com/ru/games/development/launch-screen"
category: "VK Games / Разработка / Запуск"
---

# Экран запуска приложения

Пока приложение не проинициализировало соединение с платформой с помощью события [`VKWebAppInit`](../../bridge/VKWebAppInit.md), пользователь будет видеть экран запуска. По умолчанию это [квадратная иконка для каталога](https://dev.vk.com/ru/mini-apps/settings/general/design#%D0%98%D0%BA%D0%BE%D0%BD%D0%BA%D0%B0%20%D0%B4%D0%BB%D1%8F%20%D0%BA%D0%B0%D1%82%D0%B0%D0%BB%D0%BE%D0%B3%D0%B0%20%D0%B8%20%D1%81%D0%BD%D0%B8%D0%BF%D0%BF%D0%B5%D1%82%D0%BE%D0%B2) на белом фоне. Вместо статичной картинки вы можете добавить анимацию.

![Экран запуска](https://sun9-56.userapi.com/EWBlWHhddjRVmpPFgtsIO-a45lNTmxeaTwfZOw/zu-tudGrW4U.jpg)Экран запуска

## Создание анимации

Подготовьте векторное изображение в формате [Lottie](https://lottiefiles.com/what-is-lottie). Если у вас есть готовые SVG-файлы, воспользуйтесь [онлайн-конвертером SVG в Lottie](https://lottiefiles.com/svg-to-lottie).

Требования к изображению:

- Максимальный размер файла: 24 Кбайта.
- Размер изображения: 96×96 px.

> Работа Lottie-анимаций отличается на разных платформах. Мы рекомендуем сверяться с [таблицей поддерживаемых функций](https://airbnb.io/lottie/#/supported-features) и проверять работу анимации с помощью предварительного просмотра на сайтах [rlottie](https://rlottie.com) и [LottieFiles](https://lottiefiles.com/preview).
>
> Если анимация некорректно отображается на iOS, добавьте поле `"ddd": 0` в каждый объект массива `layers`.

## Настройка экрана

1. Откройте [список приложений](https://dev.vk.com/ru/admin/apps-list) и перейдите в настройки вашего приложения.
2. В меню слева выберите [Настройки → Оформление](https://dev.vk.com/ru/mini-apps/settings/general/design) и перейдите на вкладку **Экран запуска**.
3. Загрузите изображение — файл в формате Lottie.
4. Если изображение анимированное, включите опцию **Анимация иконки**.
5. Укажите HEX-код для цвета фона за иконкой. Пример: #54C45D.
6. Нажмите **Сохранить**.

## Материалы по теме

- [Оформление (настройки мини-приложений)](https://dev.vk.com/ru/mini-apps/settings/general/design)
- [Оформление (настройки игр)](../settings/general/design.md)
