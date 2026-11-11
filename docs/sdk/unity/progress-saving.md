---
title: "Облачные сохранения"
original_url: "https://yandex.ru/dev/games/doc/ru/sdk/unity/progress-saving.md"
category: "sdk/unity"
---

# Облачные сохранения и работа с данными







#|
|| ![SVG](https://yandex.ru/dev/games/_images/icons/video.svg) | Видеоурок 4. Облачные сохранения и работа с данными

<div class="cut-button">

{% cut "Посмотреть видео" %}


{% list tabs %}

- Яндекс

  @[](https://runtime.strm.yandex.ru/player/video/vplv7lqkgm4gplipbdge?autoplay=0&mute=0)

- YouTube

  @[youtube](https://youtu.be/QCgXHR6sBIk?si=dxZzUJ6ZGzwnLFJ-)

{% endlist %}

{% endcut %}

</div>

||
|#

[Сохранение прогресса](https://max-games.ru/plugin-yg/doc/storage/){.external} позволяет создать комфортный и разнообразный игровой опыт. Вы можете сохранять данные о состоянии игры (пройденные уровни, опыт, инап-покупки и т. д.) на сервере Яндекса или передавать их на свой сервер. Также вы можете персонализировать игру, используя данные из профиля пользователя, например, имя.

В некоторых случаях сохранение прогресса в игре необходимо:
- У игрока должна быть возможность продолжить игру после обновления ее страницы, не теряя свои достижения или рекорды (см. [пояснение](https://yandex.ru/dev/games/requirements/1/9.md) к пункту 1.9).
- Если в игре предполагается:
  - Движение по сюжету.
  - Постепенное прохождение уровней.
  - Постановка рекордов.
- Если игра бесконечная (см. [пункт 1.9](https://yandex.ru/dev/games/concepts/requirements.md#1-9)).

Если вы используете облачные сохранения, укажите это в черновике (см. [пункт 1.11](https://yandex.ru/dev/games/concepts/requirements.md#1-11)).


---

{% note info %}

В [телеграм-канале](https://t.me/pluginYG2){.telegram} по PluginYG2 публикуются обновления плагина и его модулей и полезная информация. По вопросам пишите в [чат плагина](https://t.me/pluginYG){.telegram}.

{% endnote %}
