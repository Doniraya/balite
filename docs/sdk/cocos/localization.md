---
title: "Локализация"
original_url: "https://yandex.ru/dev/games/doc/ru/sdk/cocos/localization.md"
category: "sdk/cocos"
---

# Локализация







## Редактор локализаций {#localization-editor}

Переводы хранятся в формате JSON внутри проекта, и мы настоятельно рекомендуем использовать его для их редактирования.

После установки плагина в разделе SDK Яндекс Игр нажмите на опцию **Редактор локализации**.

Чтобы создать локализацию, в верхнем левом углу нажмите кнопку **Создать**.

![Скриншот Cocos Creator, окно «Localization Editor»: указатель наведен на кнопку «+ New» в левом верхнем углу. Правее в этом окне расположен редактор кода, в нем на первой строке напечатано «{», на второй — «}».](https://yandex.ru/dev/games/_images/cocos/localization/create-loc.webp)

Перед вами появится модальное окно, где можно выбрать язык. Закончив, нажмите **Создать JSON файл**.

![Скриншот Cocos Creator, поверх окна «Localization Editor» всплывающее окно. В центре окна текст «Create new localization», ниже заголовок «Language» и в выпадающем списке выбран язык «Afar (aa)», еще ниже кнопка «Create JSON file!»](https://yandex.ru/dev/games/_images/cocos/localization/create-json.webp)

Например, выберем _English (en)_ и введем следующее в редактор.

```json showLineNumbers
{
    "title": "best game in the world 2"
}
```

Нажмите на кнопку **Сохранить**, чтобы сохранить вашу локализацию и протестировать ее в игре.

![Скриншот Cocos Creator, окно «Localization Editor» (название окна написано голубым шрифтом). В левом верхнем углу три кнопки: «+ New», иконка дискеты и текст «Save» (на эту кнопку наведен указатель), иконка папки и текст «Open». Ниже оглавление с одним файлом «EN». Правее в этом окне расположен редактор кода, в нем на первой строке напечатано «{», на второй — «"title": "best game in the world 2"», на третей — «}».](https://yandex.ru/dev/games/_images/cocos/localization/save-loc.webp)

### Применение вашей локализации {#localization-use}

Локализацию можно применить двумя способами: с помощью метода `l10n.t()` или через умный компонент локализации.

#### Метод l10n.t {#ll0nt-method}

Давайте сначала попробуем использовать метод `l10n.t()`. Создайте новый компонент и вставьте в него следующее:

```tsx showLineNumbers
import { _decorator, Component, Label } from 'cc';
import { l10n } from 'db://yandex-games-sdk/ysdk';
const { ccclass, requireComponent } = _decorator;

@ccclass('ButtonLocalizationTest') // Название компонента.
@requireComponent(Label) // Зависимость от компонента Label.
export class ButtonLocalizationTest extends Component {
    onLoad() {
        const label = this.getComponent(Label); // Получаем компонент Label.
        label.string = l10n.t('title'); // Устанавливаем текст Label на основе ключа, заданного ранее.
    }
}
```

После того как вы создадите узел с компонентом Label на сцене, вы можете локализовать его, перетащив компонент в узел.

![Видео настройки Cocos Creator: в окне «Hierarchy» раскрыта структура с корневым элементом «scene-2D». Он содержит элемент «Canvas», в котором расположен элемент «Camera». Пользователь нажимает ПКМ, выбирает «Create» → «2D objects» → «Label». Появляется объект «Label», и пользователь выделяет его, так что в окне «Inspector» отображаются его свойства. В окне «Assets» рядом с элементом «scene-2D» расположен элемент «LabelLocalization Test». Пользователь перетаскивает этот элемент в раздел cc.Label. Затем пользователь нажимает кнопку «Play» на панели Предварительный просмотр (она находится в верхней части экрана, в середине). Появляется всплывающее окно с доступной для взаимодействия игрой, после загрузки на экране возникает локализированная надпись «best game in the world 2».](https://yandex.ru/dev/games/_images/cocos/localization/label.gif)

#### Готовый компонент L10nLabel {#l10nlabel}

В плагине есть готовый компонент, который отображает ключ прямо в редакторе. Компилировать проект для просмотра изменений не требуется, так как он автоматически обновляется при внесении изменений в редакторе переводов.

Нажмите на кнопку **Добавить компонент** для интересующего вас узла, прокрутите до группы **YandexGamesSDK** и выберите **L10nLabel**.

![Видео настройки Cocos Creator: пользователь нажимает кнопку «Add component» в конце списка компонентов. В выпадающем списке пользователь выбирает «YandexGamesSDK» → «L10nLabel».](https://yandex.ru/dev/games/_images/cocos/localization/l10n-label.gif)

Чтобы изменения локализации сразу отображались в проекте без необходимости заново компилировать его, введите свой ключ в поле **Ключ**.

![Видео настройки Cocos Creator: в окне «Localization Editor» (название окна написано голубым шрифтом) пользователь редактирует текст. Он меняет текст «"title": "best game in 3asd a asd a"» на «"title": "best game in the world 3"». Затем он нажимает кнопку с иконкой дискеты и текстом «Save» в левом верхнем углу окна «Localization Editor». Сразу после этого текст в окне «Scene» меняется с «best game in 3asd a asd a» на «best game in the world 3».](https://yandex.ru/dev/games/_images/cocos/localization/enter-key.gif)

---


{% note info %}

Если при работе с плагином вы столкнулись с проблемой или у вас появился вопрос, обратитесь в [сообщество в Телеграме](https://t.me/yagamedev/1476038){.telegram} или в [сообщество ВКонтакте](https://vk.ru/yandexgmsdev){.vk}.

{% endnote %}


<a href="https://github.com/yandex-games-plugins/cocos">
  <span class="button">Репозиторий</span>
</a>
