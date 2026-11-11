---
title: "Ярлык на рабочий стол"
original_url: "https://yandex.ru/dev/games/doc/ru/sdk/defold/shortcut.md"
category: "sdk/defold"
---

# Ярлык на рабочий стол







С помощью нативного диалогового окна вы можете предложить пользователю добавить на рабочий стол ярлык — ссылку на игру.

Прежде чем вывести диалоговое окно, убедитесь, что опция доступна.

## Проверка возможности добавления ярлыка {#can-add-shortcut}

Доступность опции зависит от платформы, внутренних правил браузера и ограничений платформы [Яндекс Игры](https://yandex.ru/games/){.external}. Чтобы убедиться, что ярлык можно добавить, используйте метод `ysdk.shortcut.can_show_prompt()`:

```lua showLineNumbers
ysdk.shortcut.can_show_prompt(function (self, can_show)
    if can_show then
        -- Здесь можно показать кнопку для добавления ярлыка.
    end
end)
```

## Вызов диалогового окна {#dialog-box-open}

После проверки можно показать в игре кнопку (или другой элемент интерфейса), по нажатию на которую будет вызван диалог добавления ярлыка. Для вызова диалога используйте метод `ysdk.shortcut.show_prompt()`:

```lua showLineNumbers
ysdk.shortcut.show_prompt(function (self, accepted)
    if accepted then
        -- А здесь — начислить награду за добавление ярлыка.
    end
end)
```

При первом вызове метода создается ярлык для каталога [Яндекс Игр](https://yandex.ru/games/){.external}. Если он уже есть, то будет создан ярлык со ссылкой на саму игру.

---


{% note info %}

Если при работе с плагином вы столкнулись с проблемой или у вас появился вопрос, обратитесь в [сообщество в Телеграме](https://t.me/yagamedev/1233731){.telegram} или в [сообщество ВКонтакте](https://vk.ru/yandexgmsdev){.vk}.

{% endnote %}


<a href="https://github.com/yandex-games-plugins/defold">
  <span class="button">Репозиторий</span>
</a>
