---
metadata:
  - name: generator
    content: Diplodoc Platform v5.64.0
alternate:
  - https://yandex.ru/dev/games/doc/en/requirements/1/6.md
  - https://yandex.ru/dev/games/doc/hi/requirements/1/6.md
  - https://yandex.ru/dev/games/doc/ko/requirements/1/6.md
  - https://yandex.ru/dev/games/doc/ru/requirements/1/6.md
  - https://yandex.ru/dev/games/doc/tr/requirements/1/6.md
  - https://yandex.ru/dev/games/doc/vi/requirements/1/6.md
  - https://yandex.ru/dev/games/doc/zh/requirements/1/6.md
  - href: https://yandex.ru/dev/games/doc/ru/requirements/1/6.md
    type: text/markdown
    title: Markdown version
  - href: https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509
    rel: describedby
---
> **Documentation Index:** Fetch the complete configuration index at https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509

# Системный плеер

<!-- source: ru/_includes/script-common.md -->
<!-- source: ru/_includes/script/index-js.md -->

<!-- endsource: ru/_includes/script/index-js.md -->

<!-- source: ru/_includes/script/requirements-js.md -->

<!-- endsource: ru/_includes/script/requirements-js.md -->

<!-- source: ru/_includes/script/image-modal-js.md -->

<!-- endsource: ru/_includes/script/image-modal-js.md -->
<!-- endsource: ru/_includes/script-common.md -->

{% note info "Пункты 1.6.1.6 и 1.6.2.5 Требований к игре" %}

В любых браузерах не отображается системный плеер, вызываемый игрой.

{% endnote %}

Системный плеер браузера позволяет управлять звуком и видео. Для проверки игры модерация запускает ее на [мобильных устройствах](#mobile) и [десктопе](#desktop) (для проверки на компьютере убедитесь, что [плеер включен](#enable-player)).



## Отключение системного плеера {#disable-player}

Системный плеер появляется, когда браузер фиксирует воспроизведение через HTML-элементы `<audio>` или `<video>`. Чтобы этого избежать, используйте Web Audio API — он работает напрямую с аудиоконтекстом и не регистрирует медиасессию в браузере.

Типовой сценарий воспроизведения звука через Web Audio API:

1. Создайте аудиоконтекст: `const ctx = new AudioContext()`.
1. Загрузите аудиофайл через `fetch()` и декодируйте его с помощью [ctx.decodeAudioData()](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData){.external}.
1. Создайте источник звука — `AudioBufferSourceNode` — и подключите его к выходу контекста: `source.connect(ctx.destination)`.
1. Запустите воспроизведение: `source.start()`.

Подробнее о Web Audio API см. в [документации MDN](https://developer.mozilla.org/ru/docs/Web/API/Web_Audio_API){.external}.



## Проверка на мобильных {#mobile}

Запустите игру. Затем проведите вниз по экрану, чтобы открыть панель уведомлений. Убедитесь, что на ней:

- Плеера нет.
- Плеер есть, но он вызван звуком из другой вкладки или приложения.



## Проверка на десктопе {#desktop}

### Включение плеера {#enable-player}

1. Включите системный плеер в настройках браузера.

    {% cut "Включить плеер в Яндекс Браузере" %}

    Чтобы включить системный плеер в Яндекс Браузере, в верхнем правом углу выберите ![SVG](../../_images/icons/menu.svg) → **Настройки** → **Интерфейс** → **Общее** и включите опцию **Показывать на панели инструментов кнопку управления музыкой и видео**.

    Подробнее о плеере читайте в [Cправке Браузера](https://yandex.ru/support/browser/ru/working-with-files/audio){.external}.

    {% endcut %}

2. Убедитесь, что плеер работает. Для этого в браузере включите видео или музыку, например [видеоурок по Unity](https://yandex.ru/dev/games/doc/ru/sdk/unity/advertisement.md).

Если системный плеер настроен правильно, то в правом верхнем углу браузера появится соответствующий значок:

- Google Chrome — ![SVG](../../_images/requirements/1-6-browser-player/system-player-chrom.svg)
- Яндекс Браузер — ![SVG](../../_images/requirements/1-6-browser-player/system-player.svg)

{% note info %}

Если в Яндекс Браузере у вас включена боковая панель, значок может находиться на ней.

{% endnote %}


### Проверка {#desktop-check}

Если плеер уже [включен](#enable-player), откройте игру и убедитесь, что:

- Плеера нет.
- Плеер есть, но он вызван звуком из другой вкладки или приложения (чтобы проверить это, нажмите на значок плеера).

{% cut "Пример правильно настроенной игры" %}

![Скриншот игры с открытым плеером в верхней правой части экрана.](../../_images/requirements/1-6-browser-player/pc-screenshot.webp)

{% endcut %}
