---
title: "Тестирование"
original_url: "https://yandex.ru/dev/games/doc/ru/sdk/cocos/testing.md"
category: "sdk/cocos"
---

# Тестирование







Игры могут запускаться на платформе с локального сервера, что упрощает разработку и тестирование функционала, связанного с SDK.

Обратите внимание, что вам потребуется [добавить черновик игры](https://yandex.ru/dev/games/console/add-new-game.md) с помощью Консоли Яндекс Игр.

## Настройка сборки {#build-configuration}

Первым делом необходимо настроить сборку проекта в панели **Проект** → **Сборка**.

![Скриншот Cocos Creator. В верхнем левом углу расположено меню с несколькими разделами: «File», «Edit», «Node», «Project», «Panel», «Extension», «Developer», «Help», «Yandex.Games SDK» и другие. Выбран раздел «Project», в выпадающем меню указатель наведен на опцию «Build».](https://yandex.ru/dev/games/_images/cocos/testing/build.webp)

В открывшемся окне нажмите **Новая задача сборки**, чтобы создать новую конфигурацию сборки.

Настройте параметры. Обычно рекомендуется включать элементы **Source Maps** и **Debug** для упрощения отладки.

![Скриншот Cocos Creator, окно «Build», всплывающее окно «Edit Build Config».](https://yandex.ru/dev/games/_images/cocos/testing/edit-build-config.webp)

После завершения настройки нажмите кнопку **Сборка**, чтобы собрать проект.

Затем перейдите в папку, где находится ваш проект. Вы увидите папку со структурой, похожей на эту:

```text showLineNumbers
Project name/
└── build/
    └── debug/
        ├── ...
        └── index.html
```

## Настройка локального сервера {#local-server-setting}

Подробную информацию см. в разделе [Запуск с локального сервера](https://yandex.ru/dev/games/concepts/local-launch.md).

### Тестирование {#testing}

Когда локальный сервер запущен, вы можете протестировать вашу игру, используя эту ссылку, где XXXXXX — это код вашего черновика:

```text
https://yandex.ru/games/app/XXXXXX?draft=true&game_url=https://localhost:6577
```

Чтобы протестировать новую версию, пересоберите проект в панели **Сборка**, не изменяя никаких параметров, и обновите страницу после завершения сборки.

![Скриншот всплывающего окна «debug» с зеленым текстом «5-8-2023 23:01:44 Build success in 19220 ms!» В правом нижнем углу расположены кнопки «Build» и «Run», указатель наведен на кнопку «Build».](https://yandex.ru/dev/games/_images/cocos/testing/rebuild.webp)

---


{% note info %}

Если при работе с плагином вы столкнулись с проблемой или у вас появился вопрос, обратитесь в [сообщество в Телеграме](https://t.me/yagamedev/1476038){.telegram} или в [сообщество ВКонтакте](https://vk.ru/yandexgmsdev){.vk}.

{% endnote %}


<a href="https://github.com/yandex-games-plugins/cocos">
  <span class="button">Репозиторий</span>
</a>
