---
title: "API SDK Яндекс Игр"
original_url: "https://yandex.ru/dev/games/doc/ru/sdk/cocos/ysdk.md"
category: "sdk/cocos"
---

# API SDK Яндекс Игр







После установки плагина вы найдете объект `ysdk`, который является типизированным эквивалентом [одноименного объекта из SDK Яндекс Игр](https://yandex.ru/dev/games/sdk/sdk-game-events.md). Он позволяет вам получить доступ ко всем методам SDK.

Вот пример того, как использовать [переменные окружения](https://yandex.ru/dev/games/sdk/sdk-environment.md) из SDK Яндекс Игр.

```tsx showLineNumbers
import { Component } from 'cc';
import { ysdk } from 'db://yandex-games-sdk/ysdk';
const { ccclass, property } = _decorator;

@ccclass('YourGameComponent')
export class YourGameComponent extends Component {
    start() {
        console.debug(`App ID: ${ysdk.environment.app.id}`);
        console.debug(`User Language: ${ysdk.environment.i18n.lang}`);
        console.debug(`URL Payload: ${ysdk.environment.payload}`);
    }

    update(deltaTime: number) {}
}
```

## Компонент для отображения рекламы {#ads-display-component}

Например, создадим компонент для кнопки, которая запускает видеорекламу с вознаграждением.

Дополнительно определим метод `onReward()` и передадим его в качестве callback для метода `ysdk.adv.showRewardedVideo()`, чтобы реализовать логику события получения награды.

```tsx showLineNumbers
import { _decorator, Button, Component } from 'cc';
import { ysdk } from 'db://yandex-games-sdk/ysdk';
const { ccclass, property, requireComponent } = _decorator;

@ccclass('RewardADButton')
@requireComponent(Button)
export class RewardADButton extends Component {
    start() {
        this.node.on('click', this.onClick.bind(this));
    }

    onClick() {
        const callbacks = {
            onRewarded: this.onReward.bind(this)
        };

        ysdk.adv.showRewardedVideo({ callbacks });
    }

    onReward() {
        // Наградить пользователя.
    }
}
```

При нажатии на кнопку с этим компонентом на платформе Яндекс, вы увидите рекламу. Для упрощенного тестирования ознакомьтесь с разделом [Тестирование](https://yandex.ru/dev/games/doc/ru/testing.md).

---


{% note info %}

Если при работе с плагином вы столкнулись с проблемой или у вас появился вопрос, обратитесь в [сообщество в Телеграме](https://t.me/yagamedev/1476038){.telegram} или в [сообщество ВКонтакте](https://vk.ru/yandexgmsdev){.vk}.

{% endnote %}


<a href="https://github.com/yandex-games-plugins/cocos">
  <span class="button">Репозиторий</span>
</a>
