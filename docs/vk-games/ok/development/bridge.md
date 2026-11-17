---
title: "События VK Bridge"
original_url: "https://dev.vk.com/ru/ok/development/bridge"
category: "Приложения в Одноклассниках / Разработка"
---

# События VK Bridge

На странице представлены события, которые поддерживаются в Одноклассниках. Некоторые события имеют отличия при работе ВКонтакте и в Одноклассниках. Мы указали это в таблице. Учитывайте это при разработке приложений.

## Служебные

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppInit](../../bridge/VKWebAppInit.md) Инициализировать VK Bridge. | Android iOS Mobile Web Web |  |
| [VKWebAppGetLaunchParams](../../bridge/VKWebAppGetLaunchParams.md) Получить параметры запуска приложения. | Android iOS Mobile Web Web | В параметре `vk_platform` передаётся платформа, на которой запущено приложение: • `desktop_web_ok` — десктопная версия сайта. • `mobile_android_ok` — приложение для Android. • `mobile_iphone_ok` — приложение для iOS. • `mobile_web_ok` — мобильный браузер. |
| [VKWebAppGetClientVersion](../../bridge/VKWebAppGetClientVersion.md) Получить информацию о платформе ВКонтакте, на которой запущено приложение. | Android iOS Mobile Web Web | В поле `platform` возвращается: • `web-ok` — если приложение запущено в десктопной версии сайта. • `android` — если приложение запущено в мобильном клиенте для Android. • `ios` — если приложение запущено в мобильном клиенте для iOS. • `mobile-web-ok` — если приложение запущено в мобильном браузере. |
| [VKWebAppCallAPIMethod](../../bridge/VKWebAppCallAPIMethod.md) Вызвать метод API ВКонтакте. | Android iOS Mobile Web Web | Параметр `use_local` определяет, к какому API отправляется запрос. Возможные значения: • `true` — к API площадки, которая использует SDK, например [API Одноклассников](https://apiok.ru/ext/). • `false` — к [API Вконтакте](https://dev.vk.com/ru/reference). Значение по умолчанию. |

## Доступы и разрешения

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppGetAuthToken](../../bridge/VKWebAppGetAuthToken.md) Запросить доступ к данным пользователя. | Android iOS Mobile Web Web | Параметр `append_local` казывает, для какой площадки нужно получить ключ. Возможные значения: • `true` — получить ключ для площадки, которая использует SDK (например, Одноклассники). • `false` — получить ключ для ВКонтакте. Значение по умолчанию. Ключ доступа вернётся в ответе в поле `local_access_token`. |
| [VKWebAppCheckAllowedScopes](../../bridge/VKWebAppCheckAllowedScopes.md) Получить список данных, к которым у приложения есть доступ. | iOS Mobile Web Web |  |
| [VKWebAppGetGrantedPermissions](../../bridge/VKWebAppGetGrantedPermissions.md) Получить список разрешений, выданных мобильному приложению Одноклассники. | Android iOS |  |

## Внешний вид

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppResizeWindow](../../bridge/VKWebAppResizeWindow.md) Изменить размер окна приложения. | Web |  |
| [VKWebAppSetViewSettings](../../bridge/VKWebAppSetViewSettings.md) Настроить вид элементов управления приложением: статус-бара, экшен-бара, панели навигации. | Android iOS |  |

## Навигация

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppSetLocation](../../bridge/VKWebAppSetLocation.md) Задать значение хеша в адресной строке для навигации внутри приложения. | Android Mobile Web Web |  |
| [VKWebAppSetSwipeSettings](../../bridge/VKWebAppSetSwipeSettings.md) Включить жест «смахнуть назад» (свайп). | iOS |  |
| [VKWebAppOpenApp](../../bridge/VKWebAppOpenApp.md) Открыть другое приложение из текущего. | Mobile Web Web | Параметр `app_is_local` определяет, приложение какой площадки должно быть открыто. Возможные значения: • `true` — открыть приложение площадки, которая использует SDK (например, Одноклассники). • `false` — открыть мини-приложение ВКонтакте. Значение по умолчанию. |
| [VKWebAppClose](../../bridge/VKWebAppClose.md) Закрыть приложение. | Android iOS Mobile Web Web |  |
| [VKWebAppScroll](../../bridge/VKWebAppScroll.md) Прокрутить окно приложения по вертикали. | Mobile Web Web |  |
| [VKWebAppScrollTop](../../bridge/VKWebAppScrollTop.md) Получить текущую позицию прокрутки относительно верха родительского окна приложения. | Web |  |
| [VKWebAppScrollTopStart](../../bridge/VKWebAppScrollTopStart.md) Начать отправку событий о прокрутке родительского окна. | Web |  |
| [VKWebAppScrollTopStop](../../bridge/VKWebAppScrollTopStop.md) Остановить отправку событий о прокрутке, начатых событием. [`VKWebAppScrollTopStart`](../../bridge/VKWebAppScrollTopStart.md) | Web |  |

## Монетизация

### Реклама

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppCheckNativeAds](../../bridge/VKWebAppCheckNativeAds.md) Проверить, есть ли на стороне пользователя рекламные материалы, доступные для показа. | Android iOS Mobile Web Web |  |
| [VKWebAppShowNativeAds](../../bridge/VKWebAppShowNativeAds.md) Показать рекламу. | Android iOS Mobile Web Web |  |

### Баннеры

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppShowBannerAd](../../bridge/VKWebAppShowBannerAd.md) Показать баннерную рекламу. | Android iOS Mobile Web Web |  |
| [VKWebAppCheckBannerAd](../../bridge/VKWebAppCheckBannerAd.md) Проверить, была ли показана баннерная реклама. | Android iOS Mobile Web Web |  |
| [VKWebAppBannerAdUpdated](../../bridge/VKWebAppBannerAdUpdated.md) Получить статус обновления баннерной рекламы. | Android iOS Mobile Web Web |  |
| [VKWebAppHideBannerAd](../../bridge/VKWebAppHideBannerAd.md) Скрыть баннерную рекламу. | Android iOS Mobile Web Web |  |
| [VKWebAppBannerAdClosedByUser](../../bridge/VKWebAppBannerAdClosedByUser.md) Сообщить, что пользователь закрыл баннер рекламы. | Android iOS Mobile Web Web |  |

## Покупки

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppShowOrderBox](../../bridge/VKWebAppShowOrderBox.md) Открыть окно покупки товара. | Android iOS Mobile Web Web |  |
| [VKWebAppShowSubscriptionBox](../../bridge/VKWebAppShowSubscriptionBox.md) Показать окно покупки, отмены или восстановления подписки. | Android iOS Mobile Web Web |  |

## Аналитика

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppRetargetingPixel](../../bridge/VKWebAppRetargetingPixel.md) Добавить пользователя в аудиторию ретаргетинга. | Android iOS Mobile Web Web |  |
| [VKWebAppTrackEvent](../../bridge/VKWebAppTrackEvent.md) Отправить данные в [MyTracker](https://tracker.my.com/promo). | Android iOS Mobile Web Web |  |

## Пользователи

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppGetEmail](../../bridge/VKWebAppGetEmail.md) Запросить доступ к адресу электронной почты пользователя. | iOS Mobile Web Web |  |
| [VKWebAppGetFriends](../../bridge/VKWebAppGetFriends.md) Показать список друзей пользователя. | Android iOS Mobile Web Web |  |
| [VKWebAppGetPhoneNumber](../../bridge/VKWebAppGetPhoneNumber.md) Запросить доступ к номеру телефона пользователя. | iOS Mobile Web Web |  |
| [VKWebAppOpenContacts](../../bridge/VKWebAppOpenContacts.md) Запросить доступ к контактам из телефонной книги пользователя. | Android iOS |  |
| [VKWebAppGetUserInfo](../../bridge/VKWebAppGetUserInfo.md) Получить данные из профиля пользователя. | Android iOS Mobile Web Web | Параметр `use_local` определяет, с какой площадки нужно получить данные. Возможные значения: • `true` — с площадки, которая использует SDK, например Одноклассники. • `false` — ВКонтакте. Значение по умолчанию. |

## Сообщества

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppAddToCommunity](../../bridge/VKWebAppAddToCommunity.md) Добавить приложение в сообщество. | Android iOS Mobile Web Web |  |
| [VKWebAppAllowMessagesFromGroup](../../bridge/VKWebAppAllowMessagesFromGroup.md) Получить разрешение на отправку сообщений от имени сообщества. | Android iOS Mobile Web Web |  |
| [VKWebAppGetGroupInfo](../../bridge/VKWebAppGetGroupInfo.md) Получить информацию о сообществе. | Android iOS Mobile Web Web |  |
| [VKWebAppJoinGroup](../../bridge/VKWebAppJoinGroup.md) Предложить пользователю вступить в сообщество. | Android iOS Mobile Web Web |  |
| [VKWebAppLeaveGroup](../../bridge/VKWebAppLeaveGroup.md) Предложить пользователю выйти из сообщества. | Android iOS Mobile Web Web |  |

## Социальные механики и взаимодействие

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppShare](../../bridge/VKWebAppShare.md) Поделиться ссылкой. | Android iOS Mobile Web Web | • В вебе и мобильном браузере можно поделиться только записью на стене. • На Android и iOS: на стене, на стене сообщества, в личных сообщениях, дополнить текстом и отправить в ленту, отправить в приложение или скопировать ссылку |
| [VKWebAppShowStoryBox](../../bridge/VKWebAppShowStoryBox.md) Открыть редактор историй. | Android iOS Mobile Web Web | • Для поля `background_type` поддерживается только значение `image`. • Для `blob` поддерживаются значения `JPEG`, `PNG`, `SVG`. • В объекте `attachment` у параметра `type` поддерживается только значение `url` |
| [VKWebAppOpenWallPost](../../bridge/VKWebAppOpenWallPost.md) Открыть запись со стены в слое. | iOS Mobile Web Web | Если запись опубликована пользователем, то в `owner_id` нужно указать идентификатор пользователя. Если запись опубликована в группе, то нужно указать значение `0` |
| [VKWebAppShowInviteBox](../../bridge/VKWebAppShowInviteBox.md) Пригласить друзей в игру. | Android iOS Mobile Web Web | Для игр, запущенных в десктопной и мобильной версии сайта Одноклассники, необходимо обязательно передавать параметр `message` |
| [VKWebAppShowRequestBox](../../bridge/VKWebAppShowRequestBox.md) Отправить пользователю запрос о помощи в игре. | iOS Mobile Web Web |  |
| [VKWebAppAllowNotifications](../../bridge/VKWebAppAllowNotifications.md) Запросить разрешение на отправку уведомлений. | Android iOS Mobile Web Web |  |
| [VKWebAppDenyNotifications](../../bridge/VKWebAppDenyNotifications.md) Отключить уведомления. | Android iOS Mobile Web Web |  |

## Текст и медиафайлы

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppCopyText](../../bridge/VKWebAppCopyText.md) Копировать текст в буфер обмена. | Android iOS Mobile Web Web |  |
| [VKWebAppDownloadFile](../../bridge/VKWebAppDownloadFile.md) Скачать файл на устройство. | Android |  |
| [VKWebAppOpenCodeReader](../../bridge/VKWebAppOpenCodeReader.md) Считать QR-код. | Android iOS |  |
| [VKWebAppShowImages](../../bridge/VKWebAppShowImages.md) Открыть нативный экран для просмотра изображений. | Android iOS Mobile Web |  |
| [VKWebAppTranslate](../../bridge/VKWebAppTranslate.md) Перевести текст на другой язык. | Android iOS Mobile Web Web |  |

## Хранилище VK Storage

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppStorageSet](../../bridge/VKWebAppStorageSet.md) Создать пару «ключ — значение». | Android iOS Mobile Web Web |  |
| [VKWebAppStorageGet](../../bridge/VKWebAppStorageGet.md) Получить значение ключа. | Android iOS Mobile Web Web |  |
| [VKWebAppStorageGetKeys](../../bridge/VKWebAppStorageGetKeys.md) Получить названия всех переменных. | Android iOS Mobile Web Web |  |

## Аутентификация

События этой группы доступны только для [мини-приложений](https://dev.vk.com/ru/mini-apps/overview).

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppSecureTokenRequestAccess](../../bridge/VKWebAppSecureTokenRequestAccess.md) Запросить у пользователя разрешение на использование биометрии в качестве способа аутентификации в приложении. | iOS |  |
| [VKWebAppSecureTokenSet](../../bridge/VKWebAppSecureTokenSet.md) Сохранить в защищённое хранилище произвольную строку, которая будет использоваться как ключ доступа. | iOS |  |
| [VKWebAppSecureTokenGet](../../bridge/VKWebAppSecureTokenGet.md) Запустить проверку биометрии и после её успешного прохождения получить ключ доступа из защищённого хранилища. | iOS |  |
| [VKWebAppSecureTokenGetInfo](../../bridge/VKWebAppSecureTokenGetInfo.md) Получить информацию о том, доступна ли на устройстве биометрия. | iOS |  |
| [VKWebAppSecureTokenRemove](../../bridge/VKWebAppSecureTokenRemove.md) Удалить из защищённого хранилища ключ доступа, который был сохранён для аутентификации пользователя с помощью биометрии. | iOS |  |

## Мобильные устройства

### Виброотклик

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppTapticImpactOccurred](../../bridge/VKWebAppTapticImpactOccurred.md) Вызвать вибрацию при столкновении. | iOS |  |
| [VKWebAppTapticNotificationOccurred](../../bridge/VKWebAppTapticNotificationOccurred.md) Вызвать вибрацию после выполнения действия. | iOS |  |
| [VKWebAppTapticSelectionChanged](../../bridge/VKWebAppTapticSelectionChanged.md) Вызвать вибрацию при изменении выбора пользователем. | iOS |  |

### Фонарик

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppFlashGetInfo](../../bridge/VKWebAppFlashGetInfo.md) Получить информацию о фонарике. | Android iOS |  |
| [VKWebAppFlashSetLevel](../../bridge/VKWebAppFlashSetLevel.md) Задать уровень яркости фонарика. | Android iOS |  |

### Датчики

| Событие | Платформы | Особенности |
| :--- | :--- | :--- |
| [VKWebAppAccelerometerStart](../../bridge/VKWebAppAccelerometerStart.md) Отслеживать данные акселерометра. | Android iOS |  |
| [VKWebAppAccelerometerStop](../../bridge/VKWebAppAccelerometerStop.md) Прекратить отслеживание данных акселерометра. | Android iOS |  |
| [VKWebAppDeviceMotionStart](../../bridge/VKWebAppDeviceMotionStart.md) Отслеживать данные о положении устройства. | Android iOS |  |
| [VKWebAppDeviceMotionStop](../../bridge/VKWebAppDeviceMotionStop.md) Прекратить отслеживание данных о положении устройства. | Android iOS |  |
| [VKWebAppGyroscopeStart](../../bridge/VKWebAppGyroscopeStart.md) Отслеживать данные гироскопа. | Android iOS |  |
| [VKWebAppGyroscopeStop](../../bridge/VKWebAppGyroscopeStop.md) Прекратить отслеживание данных гироскопа. | Android iOS |  |

## Материалы по теме

- [Библиотека VK Bridge | Первые шаги](../../bridge/getting-started.md)
- [Параметры запуска приложений в Одноклассниках](launch-parameters.md)
