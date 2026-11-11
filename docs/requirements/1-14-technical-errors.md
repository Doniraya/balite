---
metadata:
  - name: generator
    content: Diplodoc Platform v5.64.0
alternate:
  - https://yandex.ru/dev/games/doc/en/requirements/1/14.md
  - https://yandex.ru/dev/games/doc/hi/requirements/1/14.md
  - https://yandex.ru/dev/games/doc/ko/requirements/1/14.md
  - https://yandex.ru/dev/games/doc/ru/requirements/1/14.md
  - https://yandex.ru/dev/games/doc/tr/requirements/1/14.md
  - https://yandex.ru/dev/games/doc/vi/requirements/1/14.md
  - https://yandex.ru/dev/games/doc/zh/requirements/1/14.md
  - href: https://yandex.ru/dev/games/doc/ru/requirements/1/14.md
    type: text/markdown
    title: Markdown version
  - href: https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509
    rel: describedby
---
> **Documentation Index:** Fetch the complete configuration index at https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509

# Технические ошибки

<!-- source: ru/_includes/script-common.md -->
<!-- source: ru/_includes/script/index-js.md -->

<!-- endsource: ru/_includes/script/index-js.md -->

<!-- source: ru/_includes/script/requirements-js.md -->

<!-- endsource: ru/_includes/script/requirements-js.md -->

<!-- source: ru/_includes/script/image-modal-js.md -->

<!-- endsource: ru/_includes/script/image-modal-js.md -->
<!-- endsource: ru/_includes/script-common.md -->

{% note info "Пункт 1.14 Требований к игре" %}

Игра работает без технических ошибок, зависаний и вылетов как в ходе обычного геймплея, так и при различных действиях: повороте экрана, длительном нажатии, жестах, сворачивании браузера, показе рекламы, переходах по истории браузера и других.

{% endnote %}

Игра должна работать без технических сбоев — при любых действиях пользователя и в разных условиях:

- Корректно [загружаться](#loading).
- Не [зависать](#lags).
- Не содержать [технических надписей](#text).
- Не вызывать [ошибок](#errors) и браузерных уведомлений.



## Загрузка игры {#loading}

<div class="table-50">

#|
|| **Игра** | **Комментарий** ||
||::{align="center"} ![Видео загрузки игры: после экрана с иконкой игры и надписью «Загрузка» возникает реклама, а затем экран становится полностью черным.](../../_images/requirements/1-14-technical-errors/black-screen-downloading.gif) | Игра не загружается: видна только иконка игры. ||
|| ![Видео загрузки игры: экран полностью черный на протяжении всего видео.](../../_images/requirements/1-14-technical-errors/black-screen.gif) | Игра не загружается: виден только черный экран. ||
|| ![Скриншот загрузки игры: в правой части экрана открыта консоль Devtools. В ней есть несколько строк, выделенных красным: они описывают ошибку и трейс вызовов, которые к ней привели.](../../_images/requirements/1-14-technical-errors/console.webp) | Игра не загружается, в консоли браузера возникает ошибка. ||
|| ![Видео загрузки игры: после загрузки появляется черный экран. После нескольких секунд по экрану кликают, и возникает логотип игры.](../../_images/requirements/1-14-technical-errors/loads-only-after-click.gif) | Игра начинает загружаться только после клика по экрану. ||
|| ![Видео загрузки игры: под иконкой игры крутится кружок. После нескольких секунд страницу перезагружают, на месте кружка появляется быстро заполняющаяся шкала загрузки, а затем возникает игровое поле.](../../_images/requirements/1-14-technical-errors/works-only-after-reloading.gif) | Чтобы игра загрузилась, нужно перезагрузить страницу. ||
|| ![Видео загрузки игры: во время загрузки страницу с игрой перезагружают и через несколько секунд появляется ошибка «На странице «...» повторно возникла проблема».](../../_images/requirements/1-14-technical-errors/crashes-after-refresh.gif) | Игра вылетает во время загрузки. ||
|| ![Скриншот ошибки: «к сожалению, страница не может быть загружена».](../../_images/requirements/1-14-technical-errors/iOS-error.webp) | Страница игры не загружается на iOS. ||
|#

</div>



## Зависания {#lags}

<div class="table-50">

#|
|| **Игра** | **Комментарий** ||
||::{align="center"} ![Видео геймплея: кликер работает, после открытия новой вкладки и перехода обратно на вкладку с игрой кликер перестает работать.](../../_images/requirements/1-14-technical-errors/after-tab-changing-game-stops-responding.gif) | Игра перестает отвечать после перехода на другую вкладку. ||
|| ![Видео геймплея: во время прохождения игры возникает реклама. После закрытия рекламы возникает экран загрузки, но игра не загружается и не реагирует на клики.](../../_images/requirements/1-14-technical-errors/lags-loading-to-long.gif) | Игра медленно отвечает на клики и перестает загружаться. ||
|| ![Видео геймплея: при попытке выхода из полноэкранного режима экран становится полностью черным.](../../_images/requirements/1-14-technical-errors/unable-to-leave-fullscreen.gif) | После выхода из полноэкранного режима игра зависает, отображается черный экран. ||
||::{align="center"} ![Видео геймплея: при изменении размера окна практически все игровое поле перекрывает черный прямоугольник.](../../_images/requirements/1-14-technical-errors/game-field-block-3.gif) | После выхода из полноэкранного режима игра зависает, отображается черный экран. ||
|#

</div>


### Зависания, вызванные рекламой {#freezes-caused-by-ads}

<div class="table-50">

#|
|| **Игра** | **Комментарий** ||
|| ![Видео геймплея: игрок проходит викторину, затем просматривает рекламу и переходит по ссылке в ней. После возвращения на вкладку с игрой она перестает реагировать на клики.](../../_images/requirements/1-14-technical-errors/after-ad-gameplay-is-blocked.gif) |
После перехода по рекламе игра перестает реагировать на клики игрока. ||
|| ![Видео геймплея: игрок выбирает посмотреть рекламу за вознаграждение, но после просмотра рекламы и нажатия кнопки «Закрыть» вместо игры появляется черный экран, который не реагирует на клики.](../../_images/requirements/1-14-technical-errors/ad-ruins-game.gif) | После просмотра рекламы в игре отображается только черный экран. ||
|| ![Видео таймера, предупреждающего о рекламе: реклама не начинается, так как, когда отсчет доходит до нуля, он снова начинается.](../../_images/requirements/1-14-technical-errors/timer-freeze-1.gif) | Реклама не начинается: таймер, предупреждающий о рекламе, зацикливается. ||
|| ![Видео таймера, предупреждающего о рекламе: реклама не начинается, так как, когда отсчет доходит до нуля, он снова начинается.](../../_images/requirements/1-14-technical-errors/timer-freeze-2.gif) | Реклама не начинается: таймер, предупреждающий о рекламе, зацикливается. ||
|#

</div>



## Технический текст {#text}

<div class="table-50">

#|
|| **Игра** | **Комментарий** ||
|| ![Скриншот игры: в середине экрана в небольшом сером прямоугольнике есть технический текст, не относящийся к игре.](../../_images/requirements/1-14-technical-errors/technical-text-1.webp) | В игре есть всплывающий технический текст:
> ##(InputEventAction: action-start_game, pressed=(false)##
||
|| ![Видео геймплея: после нажатия на иконку трех горизонтальных линий появляется техническое меню с неигровыми кнопками.](../../_images/requirements/1-14-technical-errors/technical-text-2.gif) | Присутствует меню с техническими, неигровыми кнопками:
> ##Import Saves
Export Saves
Download Log
Powered by Ren'Py##
||
|| ![Видео загрузки игры: в верхней части пустого серого экрана отображается технический текст.](../../_images/requirements/1-14-technical-errors/technical-text-3.gif) | На экране загрузки игры отображается технический текст:
> ##const ysdk = await YaGames.init();
// Сообщаем платформе, что игра загрузилась и можно начинать играть.
const ysdk = await YaGames.init();
// Сообщаем о старте геймплея.
ysdk.features.GameplayAPI?.start()
// Игровой процесс активен.
// Сообщаем об остановке геймплея:
// игрок вышел в меню, прошел уровень или планируется показ рекламы.
ysdk.features.GameplayAPI?.stop()##
||
|| ![Видео геймплея: в нижнем левом углу отображается технический текст, написанный мелким шрифтом и выделенный красным.](../../_images/requirements/1-14-technical-errors/technical-text-4.gif) | В нижней части экрана отображается техническая информация для разработчиков:
> ##Service name: Учeтнaя запись, state: Connected
v2.6.5. https://ww2-2-6.amt-games.com/, acc: 2a7197c5-3d81-4fc1-9a52-edbb23434354, tex: .dds, web publisher: vandex, quality: SD, ait: 822 (15.09.2023 4:11), exp: TA##
||
|#

</div>



## Уведомления об ошибках {#errors}

<div class="table-50">

#|
|| **Игра** | **Комментарий** ||
|| ![Скриншот игры: открыто меню с кнопками «Play» и «Лидеры игры», а также кнопкой со знаком вопроса. В верхней части экрана браузерное уведомление, частично перекрывающее игру: «Уверены, что хотите закрыть эту страницу? Введенные вами данные могут не сохраниться».](../../_images/requirements/1-14-technical-errors/browser-notifyings.webp) | Появляется браузерное уведомление о несохраненном прогрессе. ||
|| ![Скриншот меню Яндекс Игр, которое появляется, когда пользователь выбирает игру в каталоге: в верхнем правом углу кнопка «Отмена», ниже выбран пункт «Использовать фотографию и имя пользователя из Яндекса», кнопка «Играть», предупреждение «Начиная игру, вы соглашаетесь с условиями лицензионного соглашения» и кнопка «Подробнее об игре». В верхней части экрана браузерное уведомление: «Уведомление от сайта app-303900.games.s3.yandex.net TypeError: Cannot set properties of null (setting 'onclick')».](../../_images/requirements/1-14-technical-errors/error-properties-of-null.webp) | Всплывает сообщение об ошибке:
> ##TypeError: Cannot set properties of null (setting 'onclick')## ||
|| ![Скриншот игры, в нижней части частично перекрывающее игру уведомление на красном фоне с текстом «Превышено количество запросов к /games/api/sdk/v1/player/data. Пожалуйста, пересмотрите использование методов SDK.» Справа открыты DevTools, на вкладке Console видны несколько ошибок: «11 проблем: 8 errors 3 warnings.» Две идентичны той, что указана в красном уведомлении, и еще три «Uncaught (in promise) y2:sourcemap:1». Подробнее об «Uncaught (in promise) y2:sourcemap:1»: Uncaught (in promise) y2:sourcemap:1. Error: The number of requests is exceeded. Try again later. at [название функции] ([путь к функции в исходных файлах]). Подробнее о «Превышено количество запросов»: Error: превышено количество запросов к /games/api/sdk/v1/player/data. Пожалуйста, пересмотрите использование методов SDK. client-game.desktoo._uild.is:sourcemap:l. at [название функции] ([путь к функции в исходных файлах]).](../../_images/requirements/1-14-technical-errors/number-of-sdk-requests.webp) | Возникает ошибка о превышении количества запросов. ||
|| ![Уведомление от сайта app-294102.games.s3.yandex.net: An error occurred running the Unity content on this page. See your browser JavaScript console for more info. The error was: RuntimeError: memory access out of bounds. at [название функции] ([путь к функции в исходных файлах])](../../_images/requirements/1-14-technical-errors/unity-error.webp) | Игра слишком тяжелая для устройства, не получается загрузить все текстуры:
> ##An error occurred running the Unity content on this page.## ||
|#

</div>



## Связаться с модерацией {#forma}

Если вы считаете, что ваша игра не содержит технических ошибок и была снята с публикации или не допущена до нее по ошибке — заполните форму ниже.

Служба контроля качества модерации перепроверит решение и вернет игру, если она была заблокирована несправедливо.

<div class="cut-button">

{% cut "Открыть форму" %}

<div style="padding: 15px;
         margin: 10px 0;
         background: #FFFFFF;
         border-radius: 10px;
         border: 1px solid var(--yc-color-line-generic);">
      <iframe height="400"
              width="100%"
              frameborder="0"
              id="moderation-1-10-form"
              src="https://forms.yandex.ru/surveys/13487250.5a13659b18018197b1f339b05e2d4dacc05604a6/?answer_choices_52072484=63212291&iframe=1">
      </iframe>
</div>

{% endcut %}

</div>
