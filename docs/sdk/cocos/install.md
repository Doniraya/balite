---
title: "Установка"
original_url: "https://yandex.ru/dev/games/doc/ru/sdk/cocos/install.md"
category: "sdk/cocos"
---

# Установка







## Установка плагина из Cocos Store {#plugin-install}

Вы можете установить плагин напрямую из [Cocos Store](https://store.cocos.com/app/en/detail/5341){.external}.

## Установка плагина из репозитория {#install-from-repository}

После [загрузки плагина](https://github.com/yandex-games-plugins/cocos/releases/latest){.external}, откройте ваш проект в Cocos Creator или создайте новый. В верхней панели наведите на **Расширения** и выберите **Менеджер расширений**.

![Скриншот Cocos Creator. В верхнем левом углу расположено меню с несколькими разделами: «File», «Edit», «Node», «Project», «Panel», «Extension», «Developer», «Help», «Yandex.Games SDK» и другие. Выбран раздел «Extension», в выпадающем меню указатель наведен на опцию «Extension Manager».](https://yandex.ru/dev/games/_images/cocos/installation/extension-manager.webp)

Далее наведите на **Импортировать файл расширения (.zip)** и выберите плагин, который вы ранее загрузили из выпадающего меню.

![Скриншот Cocos Creator. Во всплывающем окне «Extension Manager - <название проекта>» в верхнем левом углу расположено меню: выпадающий список, в котором выбрана опция «Cocos Official» и статус «Installed», значок лупы, значок «Скачать» (стрелка направлена вниз и вправо, внутрь квадратной рамки), значок перезагрузки. Указатель наведен на значок «Скачать», под ним всплывающая подпись «Import Extension File(.zip)».](https://yandex.ru/dev/games/_images/cocos/installation/import-extensions.webp)

## Настройка шаблонов {#templates-setup}

Скорее всего, после установки плагина вы увидите сообщения, подобные приведенным ниже. Это происходит потому, что Яндекс Игры требуют [SDK Яндекс Игр](https://yandex.ru/dev/ru/index.md) для импорта напрямую в файлы, такие как index.html, которые появляются после компиляции.

![Скриншот предупреждений в консоли Cocos Creator: «[yandex-games-sdk] Failed to find build-templates/web-desktop template! [yandex-games-sdk] Failed to find build-templates/web-mobile template! [yandex-games-sdk] Failed to find preview-template template!»](https://yandex.ru/dev/games/_images/cocos/installation/templates-failure.webp)

Чтобы решить эту проблему, посетите новый раздел SDK Яндекс Игр и выберите опцию генерации шаблонов, чтобы плагин сгенерировал необходимые шаблоны самостоятельно. Вы также можете написать их самостоятельно.

Если шаблоны скомпилированы успешно, плагин должен выдать сообщение, подобное приведенному ниже, в консоль. Это означает, что все в порядке, и вы можете приступать к работе.

![Скриншот сообщений в консоли Cocos Creator: «Register native engine in D:\Programms\cocos-dashbo..., [yandex-games-sdk] Templates looks fine! [Scene] [Physics] [Bullett]' Using asmis Bullet libs».](https://yandex.ru/dev/games/_images/cocos/installation/templates-success.webp)

Для более детальной информации: [настройка шаблонов сборки](https://docs.cocos.com/creator/manual/en/editor/preview/browser.html){.external}, [настройка веб-просмотра Cocos Creator](https://docs.cocos.com/creator/manual/en/editor/preview/browser.html){.external}.

---


{% note info %}

Если при работе с плагином вы столкнулись с проблемой или у вас появился вопрос, обратитесь в [сообщество в Телеграме](https://t.me/yagamedev/1476038){.telegram} или в [сообщество ВКонтакте](https://vk.ru/yandexgmsdev){.vk}.

{% endnote %}


<a href="https://github.com/yandex-games-plugins/cocos">
  <span class="button">Репозиторий</span>
</a>
