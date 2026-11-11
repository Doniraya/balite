---
metadata:
  - name: generator
    content: Diplodoc Platform v5.64.0
alternate:
  - https://yandex.ru/dev/games/doc/en/console/add-new-game.md
  - https://yandex.ru/dev/games/doc/hi/console/add-new-game.md
  - https://yandex.ru/dev/games/doc/ko/console/add-new-game.md
  - https://yandex.ru/dev/games/doc/ru/console/add-new-game.md
  - https://yandex.ru/dev/games/doc/tr/console/add-new-game.md
  - https://yandex.ru/dev/games/doc/vi/console/add-new-game.md
  - https://yandex.ru/dev/games/doc/zh/console/add-new-game.md
  - href: https://yandex.ru/dev/games/doc/ru/console/add-new-game.md
    type: text/markdown
    title: Markdown version
  - href: https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509
    rel: describedby
---
> **Documentation Index:** Fetch the complete configuration index at https://yandex.ru/dev/games/doc/ru/llms.txt?revision=r21827509

# Загрузка игры

<!-- source: ru/_includes/script-common.md -->
<!-- source: ru/_includes/script/index-js.md -->

<!-- endsource: ru/_includes/script/index-js.md -->

<!-- source: ru/_includes/script/requirements-js.md -->

<!-- endsource: ru/_includes/script/requirements-js.md -->

<!-- source: ru/_includes/script/image-modal-js.md -->

<!-- endsource: ru/_includes/script/image-modal-js.md -->
<!-- endsource: ru/_includes/script-common.md -->

#|
|| ![SVG](../_images/icons/video.svg) | Видеоурок. Как загрузить черновик игры в Яндекс Игры?

<div class="cut-button">

{% cut "Посмотреть видео" %}

{% list tabs %}

- Яндекс

  @[](https://runtime.strm.yandex.ru/player/video/vplvknhfsomeeaausd5p?autoplay=0&mute=0)

- YouTube

  @[youtube](https://www.youtube.com/embed/VHNxcAVKuwo)

{% endlist %}

{% endcut %}

</div>

||
|#



[Яндекс Игры](https://yandex.ru/games/){.external} — бесплатная платформа для публикации браузерных игр. Вы можете разместить игру на любом [поддерживаемом языке](https://yandex.ru/dev/games/doc/ru/concepts/languages-and-domains.md) — как новую, так и уже опубликованную на других платформах. Мы возьмем на себя хостинг и привлечение игроков.

{% note tip "Перед началом" %}

- [Зарегистрируйтесь](https://yandex.ru/dev/games/doc/ru/console/manage-account.md#registration) в Консоли разработчика и заключите договор — по [единой лицензионной схеме](https://yandex.ru/dev/games/doc/ru/payments.md) прямо в Консоли или в [РСЯ](https://partner.yandex.ru/){.external}.
- Подготовьте игру: изучите [требования](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md) и подключите [SDK или плагин](https://yandex.ru/dev/games/doc/ru/sdk.md).
- Если в игре есть [инап-покупки](https://yandex.ru/dev/games/doc/ru/console/purchases.md), заранее проверьте [условия их подключения](https://yandex.ru/dev/games/doc/ru/sdk/sdk-purchases.md#conditions).

{% endnote %}



## Шаг 1. Создайте черновик {#step-create-draft}

1. <!-- source: ru/_includes/console/open-console.md -->
   Зайдите в [Консоль](https://games.yandex.ru/console){.external} с аккаунтом разработчика.
   <!-- endsource: ru/_includes/console/open-console.md -->
1. В правом верхнем углу нажмите **Добавить игру** — откроется вкладка **Черновик** с полями для заполнения.

<!-- source: ru/_includes/console/duplicate-drafts.md -->
Учитывайте, что к каждой игре привязаны:

- Уникальный ID. В каждый черновик публикуйте новую игру:
    - Не загружайте новую игру в черновик, где ранее была опубликована другая ([пункт 1.24](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-24)).
    - Не дублируйте игры: не загружайте одну и ту же игру в разные черновики ([пункт 3.6](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#3-6)).
- Аккаунт разработчика, с которого создали черновик. Если вам нужно перенести черновик на другой аккаунт:
    - [Удалите черновик](https://yandex.ru/dev/games/doc/ru/console/delete-restore.md#full-removal) с аккаунта, где он уже есть. После этого загрузите игру в новый черновик на другом аккаунте.
    - Напишите в [чат поддержки](https://yandex.ru/chat/#/user/774df508-c12d-9d6e-6a27-5e3fc522016a){.external}.
<!-- endsource: ru/_includes/console/duplicate-drafts.md -->



## Шаг 2. Загрузите архив с игрой {#step-upload-build}

1. Поместите в один ZIP-архив версии игры для всех платформ и языков локализации. Требования к архиву:

    - Содержимое архива до сжатия весит не более 100 МБ ([пункт 1.21](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-21)).
    - В корне есть один файл `index.html` ([пункт 1.22](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-22)).
    - В названиях файлов и папок нет пробелов и кириллических символов ([пункт 1.22](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-22)).

1. В поле **Общее** → **Архив** загрузите полученный архив с игрой.

<!-- source: ru/_includes/console/iframe.md -->
Мы рекомендуем хранить игры на сервере Яндекса. Если игре нужна сложная серверная архитектура (например, для мультиплеера), вы можете подключить ее через `iframe`. Для этого напишите в [чат поддержки](https://yandex.ru/chat/#/user/774df508-c12d-9d6e-6a27-5e3fc522016a){.external} и укажите: {#iframe}

- название игры;
- аккаунт разработчика;
- ссылку на игру в формате `https`;
- причину, по которой загрузка через архив не подходит.
<!-- endsource: ru/_includes/console/iframe.md -->



## Шаг 3. Заполните черновик {#step-fill-draft}

Заполните оставшиеся поля на вкладке **Черновик**. Они разделены на два блока:

- **Общее** — технические параметры, метаданные и настройки публикации. Поля общие для всех языков.
- **Описание и продвижение** — текстовые описания, изображения и видео для продвижения. Поля нужно заполнить отдельно для каждого языка локализации, в том числе перевести надписи и логотипы на всех медиаматериалах. Чтобы упростить задачу:

    - Подключите [AI-описания](https://yandex.ru/dev/games/doc/ru/concepts/languages-and-domains.md#ai-descriptions): система автоматически создаст описания на других языках на основе английского.
    - Сделайте медиаматериалы без текста — тогда их можно использовать на всех языках.

Подробное описание всех полей — на странице [Заполнение черновика](https://yandex.ru/dev/games/doc/ru/console/add-new-game/draft.md).

Чем больше полей вы заполните, тем выше шанс игры попасть в [тематические подборки](https://yandex.ru/dev/games/doc/ru/concepts/ranking-and-featuring.md#featuring) и получить больше трафика.



## Шаг 4. Настройте хосты и дистрибуцию {#step-optional-settings}

Шаг необязательный: выполните его, если вашей игре нужны внешние хосты или вы хотите ограничить распространение по странам.

### Разрешенные хосты {#step-check-host}

Если для игры нужен внешний хост (например, для подгружаемого контента), перейдите на вкладку **CSP**, укажите хосты и причину их использования — мы рассмотрим вашу заявку. Игра должна соответствовать [Content Security Policy](https://developer.mozilla.org/ru/docs/Web/HTTP/Guides/CSP){.external}. Подробнее о CSP и разрешенных хостах см. в статье [Новые правила доступа к хостам и Content Security Policy](https://yandex.ru/blog/gamesfordevelopers/content-security-policy-i-novye-pravila-dostupa-k-khostam){.external}.

{% cut "Дополнительные требования к хостам" %} {#additional-requirements}

- **Формат адреса**: в поле нельзя прописывать пути (`https://host.example.com/path`), порты после двоеточия, IP-адреса.
- **Протоколы**: указывать протокол не нужно — по умолчанию `https` и `wss`. Хосты с незащищенными протоколами `http` или `ws` не допускаются.
- **Обработка ошибок**: игра должна корректно сообщать пользователю об ошибках подключения к хосту и предлагать решение (например, кнопку повтора или перезагрузку страницы).
- **Объем данных**: с внешнего хоста не должны грузиться почти все данные игры — их нужно разместить в [архиве](https://yandex.ru/dev/games/doc/ru/console/add-new-game/draft.md#field-archive) или [iframe](#iframe). Для `iframe` потребуется отдельное согласование.

{% endcut %}


### Страны дистрибуции {#step-distribution-countries}

По умолчанию игра отображается для пользователей всех стран. Если вы хотите ограничить доступность вашей игры:

1. Перейдите на вкладку **Страны и регионы**.
1. Нажмите на регион — откроется список стран.
1. Снимите отметки со стран, где игра не должна отображаться.
1. Нажмите **Сохранить**.



## Шаг 5. Пройдите модерацию {#step-moderation-game}

<!-- source: ru/concepts/quick-start.md -->
### Протестируйте игру {#test}

Перед отправкой на проверку [протестируйте игру](https://yandex.ru/dev/games/doc/ru/console/test-game.md) самостоятельно.

<!-- source: ru/_includes/requirements/violated-requirements.md -->
{% cut "Частые причины отказа в публикации" %}

#|
|| **Пункт Требований к игре** | **Категория** | **Нарушение** | **Пояснение** ||
|| [1.6.1.8](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-6-1-8), [1.6.2.7](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-6-2-7) | UI / Интерфейс | Контекстное меню при взаимодействии | При правом клике или долгом нажатии появляется системное контекстное меню браузера — его необходимо отключить в игровой области. ||
|| [1.6.1.6](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-6-1-6), [1.6.2.5](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-6-2-5) | ^ | Системный плеер (десктоп и мобильные устройства) | Аудио- или видеоконтент воспроизводится через системный плеер вместо встроенного игрового — нарушает целостность интерфейса. [Подробнее](https://yandex.ru/dev/games/doc/ru/requirements/1/6.md). ||
|| [4.7](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#4-7) | ^ | Звук при показе рекламы не ставится на паузу | Во время показа рекламного ролика звук из игры продолжает играть. Необходимо ставить аудио на паузу на время рекламы. ||
|| [1.3](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-3) | ^ | Звук продолжается при переключении вкладки | Музыка или звуки из игры не останавливаются при уходе со вкладки. Необходимо реагировать на потерю фокуса страницы. [Подробнее](https://yandex.ru/dev/games/doc/ru/requirements/1/3.md). ||
|| [2.14](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#2-14) | SDK / Game Ready | Автоопределение языка через SDK не реализовано | Язык интерфейса задается вручную вместо использования `ysdk.environment.i18n.lang`. Игра должна автоматически подстраиваться под язык пользователя. [Подробнее](https://yandex.ru/dev/games/doc/ru/requirements/2/14.md). ||
|| [1.19.2](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-19-2) | ^ | Game Ready не используется совсем | Game Ready не интегрирован, хотя обязателен для публикации в каталоге. [Подробнее](https://yandex.ru/dev/games/doc/ru/requirements/1/19.md#gameready). ||
|| [1.1](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-1) | ^ | SDK не встроен или встроен некорректно | Скрипт SDK отсутствует, подключен не из официального источника или инициализируется с ошибками. [Подробнее](https://yandex.ru/dev/games/doc/ru/sdk/sdk-about.md#check). ||
|| [1.9](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-9) | Технические сбои | Прогресс не сохраняется | Результаты, уровни или настройки не сохраняются между сессиями. [Подробнее](https://yandex.ru/dev/games/doc/ru/requirements/1/9.md). ||
|| [1.14](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-14) | ^ | Игра не запускается | Загрузочный экран зависает или игра не доходит до геймплея. Проверьте консоль на ошибки при инициализации. [Подробнее](https://yandex.ru/dev/games/doc/ru/requirements/1/14.md#loading). ||
|| [1.14](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-14) | ^ | Ошибка на старте или при действиях | В консоли браузера появляются JS-ошибки при запуске или в ходе игры, которые влияют на работоспособность. [Подробнее](https://yandex.ru/dev/games/doc/ru/requirements/1/14.md#errors). ||
|| [1.15](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-15) | ^ | Игра выглядит незавершенной | В игре отсутствуют или не работают необходимые элементы (тексты, текстуры, управление, иконки), либо остались следы разработки («demo», «в разработке», «trial version»). [Подробнее](https://yandex.ru/dev/games/doc/ru/requirements/1/15.md). ||
|| [2.3](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#2-3) | Соответствие описанию | Игра не соответствует заявленному жанру | Геймплей противоречит выбранной на вкладке **Черновик** [категории](https://yandex.ru/dev/games/doc/ru/console/add-new-game/draft.md#field-category). Жанр и описание должны точно отражать содержание игры. ||
|| [8.2.2](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#8-2-2) | Название игры | Вводящее в заблуждение название | Название содержит слова, которые вводят пользователя в заблуждение относительно условий игры: «free», «top», «best», «бесплатно», «бесплатный» и т. п. ||
|#

{% endcut %}
<!-- endsource: ru/_includes/requirements/violated-requirements.md -->


### Отправьте на модерацию {#submit}

На вкладке **Черновик** нажмите **Отправить на модерацию** — игра перейдет в статус **Ожидает модерации**. Если хотите сами выбрать время релиза, заранее включите опцию [Отсроченная публикация](https://yandex.ru/dev/games/doc/ru/console/add-new-game/draft.md#field-delay).

<!-- source: ru/_includes/console/moderation.md -->
Игру проверят на соответствие [требованиям](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md). Обычно [модерация](https://yandex.ru/dev/games/doc/ru/concepts/moderation.md) занимает 3–5 рабочих дней.
<!-- endsource: ru/_includes/console/moderation.md -->

{% cut "О результатах модерации" %}

Результаты проверки вы увидите в [Консоли](https://games.yandex.ru/console){.external}:

- Если модерация одобрит игру, статус изменится на:

  - **Опубликовано**: игра опубликуется автоматически.
  - **Проверен**, если включена опция **Отсроченная публикация**. На вкладке **Черновик** появится кнопка **Опубликовать**.

- Если в публикации откажут, статус изменится на **Отклонен**. Причины придут на почту, указанную в [профиле разработчика](https://yandex.ru/dev/games/doc/ru/console/manage-account.md#profile-manage).

{% endcut %}

<!-- source: ru/_includes/console/moderation.md -->
Единовременно можно отправить не больше двух заявок на публикацию новых игр, а с [аккаунта без истории](https://yandex.ru/dev/games/doc/ru/concepts/moderation.md#queue-order) — одну. Чтобы отправить на модерацию следующую игру, дождитесь решения по одной из текущих заявок или отзовите одну из них самостоятельно.

Ограничение не распространяется на обновления уже опубликованных игр.
<!-- endsource: ru/_includes/console/moderation.md -->
<!-- endsource: ru/concepts/quick-start.md -->

После публикации игра появится в каталоге. Как развивать ее дальше — в разделе [Оперирование](https://yandex.ru/dev/games/doc/ru/liveops.md).



## Частые вопросы {#faq}

{% cut "**Почему в черновике игры появилась ошибка «Доступ запрещен»?**" %}

Ошибка может возникнуть из-за потери авторизации (например, если в другой вкладке браузера вы авторизовались в другом аккаунте) или из-за некорректной ссылки.

Варианты решения:

- Смените аккаунт:

    1. Выйдите из аккаунта разработчика.
    1. Заново авторизуйтесь в [Консоли Яндекс Игр](https://games.yandex.ru/console){.external}.
    1. Обновите страницу.
    1. В левом верхнем углу несколько раз нажмите на логотип Консоли или на раздел **Игры**.
    1. Выберите нужную игру в списке.

- Убедитесь, что отключен VPN, и попробуйте авторизоваться в Консоли в режиме инкогнито.
- Обратитесь в [чат поддержки](https://yandex.ru/chat/#/user/774df508-c12d-9d6e-6a27-5e3fc522016a){.external}.

{% endcut %}


{% cut "**Как долго игры хранятся на сервере Яндекса?**" %}

Все материалы на вкладке **Черновик** бессрочно хранятся на сервере Яндекса. Но при [удалении черновика](https://yandex.ru/dev/games/doc/ru/console/delete-restore.md#full-removal) игры они удаляются безвозвратно. Восстановить игру после этого невозможно.

{% endcut %}


{% cut "**Можно восстановить ранее удаленную игру?**" %}

Да, если не был удален черновик игры. Подробнее см. в разделе [Восстановление](https://yandex.ru/dev/games/doc/ru/console/delete-restore.md#restore).

{% endcut %}


{% cut "**Можно добавить игру с серверной частью?**" %}

Да. Например, при помощи [серверной части](https://yandex.ru/dev/games/doc/ru/sdk/sdk-about.md#use) можно:

- сохранять [данные игрока](https://yandex.ru/dev/games/doc/ru/sdk/sdk-player.md);
- установить [защиту от накруток](https://yandex.ru/dev/games/doc/ru/sdk/sdk-server-time.md);
- добавить в игру [инап-покупки](https://yandex.ru/dev/games/doc/ru/sdk/sdk-purchases.md).

{% endcut %}


{% cut "**Можно добавить игру, которая запускается только через Flash Player?**" %}

Нет.

Однако команда Яндекс Игр постоянно работает над улучшением сервиса и планирует реализовать эту возможность.

{% endcut %}


{% cut "**Платформа Яндекс Игры поддерживает технологию WebGL?**" %}

Да. Но в браузере игрока должна быть включена библиотека WebGL (в большинстве браузеров это опция **Использовать аппаратное ускорение**).

Если WebGL недоступен, при открытии игры об этом не должно быть уведомлений ([пункт 1.6.1.7](https://yandex.ru/dev/games/doc/ru/concepts/requirements.md#1-6-1-7)). Вы можете заранее [протестировать](https://yandex.ru/dev/games/doc/ru/console/test-game.md) технологию WebGL в Яндекс Браузере.

{% endcut %}


{% cut "**Нужно ли использовать Service Worker в игре?**" %}

Нет, использовать Service Worker необязательно. Пункт 1.6.4 Требований к игре о корректной работе Service Worker был удален из перечня в декабре 2022 года.

{% endcut %}
