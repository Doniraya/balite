---
title: "Performance в DevTools"
original_url: "https://yandex.ru/dev/games/doc/ru/concepts/performance.md"
category: "concepts"
---

# Performance в DevTools







Платформа Яндекс Игры дает возможность отслеживать [технические метрики](https://yandex.ru/dev/games/doc/ru/metric.md#tech) **Game Ready** и **Time To Interactive** (TTI) во вкладке [Performance](https://developer.chrome.com/docs/devtools/performance/overview?hl=ru){.external} в DevTools. Вы можете посмотреть, в какой момент срабатывают метрики, какие задачи выполняются перед ними, и на основе этой информации оптимизировать и ускорить процессы.

## Как отправляются метки {#send-marks}

- Метка **Game Ready** срабатывает, когда вызывается метод [ysdk.features.LoadingAPI.ready()](https://yandex.ru/dev/games/doc/sdk/sdk-game-events.md#gameready).
- Метка [Time To Interactive](https://developer.chrome.com/docs/lighthouse/performance/interactive?hl=ru){.external} срабатывает автоматически по определенным условиям.

## Как посмотреть метки {#check-marks}

1. Запустите игру любым удобным способом.
2. Откройте DevTools:
    - Windows: **F12**, **Ctrl** + **Shift** + **I**
    - macOS: **Cmd** + **Opt** + **I**
3. Перейдите на вкладку **Performance**.
4. В левом верхнем углу нажмите **Record and reload** ![SVG](https://yandex.ru/dev/games/doc/_images/performance-devtools/reload.svg) и дождитесь сборки профиля. В строке **Timings** отобразятся желтые метки с названиями [Game Ready](https://yandex.ru/dev/games/doc/ru/*gr) и [Time To Interactive](https://yandex.ru/dev/games/doc/ru/*tti).

    {% cut "Пример собранного профиля" %}

    ![Скриншот игры с открытой панелью DevTools на вкладке Performance.](https://yandex.ru/dev/games/doc/_images/performance-devtools/profile-ready.webp)

    {% endcut %}

[*gr]: ![На шкале Timings отметка Game Ready.](https://yandex.ru/dev/games/doc/_images/performance-devtools/game-ready-mark.webp)

[*tti]: ![На шкале Timings отметка Time To Interactive.](https://yandex.ru/dev/games/doc/_images/performance-devtools/tti-mark.webp)
