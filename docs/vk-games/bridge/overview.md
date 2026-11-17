---
title: "Обзор"
original_url: "https://dev.vk.com/ru/bridge/overview"
category: "VK Bridge"
---

**Часть сервисов временно недоступна**

Возникли технические неполадки, но мы уже всё исправляем. Попробуйте зайти чуть позже.

Скоро вернёмся!

# Обзор

**VK Bridge** — это JavaScript-библиотека, которая позволяет [играм](../games/overview.md) и [мини-приложениям](https://dev.vk.com/ru/mini-apps/overview) использовать [API ВКонтакте](https://dev.vk.com/ru/reference) и API операционной системы на устройстве пользователя.

VK Bridge осуществляет обмен [событиями](#События VK Bridge) между пользовательскими приложениями и клиентской частью ВКонтакте: десктопной и мобильной версиями сайта, а также мобильными приложениями. Это позволяет приложениям получать доступ к данным пользователя, отправлять уведомления и использовать другие функции платформы ВКонтакте.

Исходный код библиотеки VK Bridge хранится в репозиториях:

- [npm](https://www.npmjs.com/package/@vkontakte/vk-bridge)
- [GitHub](https://github.com/VKCOM/vk-bridge)

## Начало работы

Для начала работы с VK Bridge следуйте инструкциям, представленным в разделе [VK Bridge | Первые шаги](getting-started.md). Для тестирования событий библиотеки вы можете использовать [песочницу VK Bridge](https://vk.com/app6909581).

После подключения библиотеки в коде приложения обязательно нужно вызвать событие инициализации [`VKWebAppInit`](VKWebAppInit.md). Оно информирует платформу ВКонтакте о старте приложения и инициализирует параметры, необходимые для работы библиотеки.

## События VK Bridge

### Служебные

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppInit](VKWebAppInit.md) | Инициализировать VK Bridge. |
| [VKWebAppGetLaunchParams](VKWebAppGetLaunchParams.md) | Получить параметры запуска приложения. |
| [VKWebAppGetClientVersion](VKWebAppGetClientVersion.md) | Получить информацию о платформе ВКонтакте, на которой запущено приложение. |
| [VKWebAppGetConfig](VKWebAppGetConfig.md) | Получить конфигурацию приложения. |
| [VKWebAppUpdateConfig](VKWebAppUpdateConfig.md) | Получить информацию о смене конфигурации приложения. |
| [VKWebAppCreateHash](VKWebAppCreateHash.md) | Создать криптографическую подпись для передаваемых данных. |
| [VKWebAppCallAPIMethod](VKWebAppCallAPIMethod.md) | Вызвать метод API ВКонтакте. |

### Доступы и разрешения

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppGetAuthToken](VKWebAppGetAuthToken.md) | Запросить доступ к данным пользователя. |
| [VKWebAppGetCommunityToken](VKWebAppGetCommunityToken.md) | Запросить доступ к данным сообщества. |
| [VKWebAppCheckAllowedScopes](VKWebAppCheckAllowedScopes.md) | Получить список данных, к которым у приложения есть доступ. |
| [VKWebAppGetGrantedPermissions](VKWebAppGetGrantedPermissions.md) | Получить список разрешений, выданных мобильному приложению ВКонтакте. |

### Внешний вид

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppResizeWindow](VKWebAppResizeWindow.md) | Изменить размер окна приложения. |
| [VKWebAppSetViewSettings](VKWebAppSetViewSettings.md) | Настроить вид элементов управления приложением: статус-бара, экшн-бара, панели навигации. |

### Навигация

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppSetLocation](VKWebAppSetLocation.md) | Задать значение хеша в адресной строке для навигации внутри приложения. |
| [VKWebAppChangeFragment](VKWebAppChangeFragment.md) | Изменить значение хеша в адресной строке при навигации внутри приложения. |
| [VKWebAppLocationChanged](VKWebAppLocationChanged.md) | Сообщить о том, что значение хеша в адресной строке приложения изменилось. |
| [VKWebAppSetSwipeSettings](VKWebAppSetSwipeSettings.md) | Включить жест «смахнуть назад» (свайп). |
| [VKWebAppOpenApp](VKWebAppOpenApp.md) | Открыть другое приложение из текущего. |
| [VKWebAppClose](VKWebAppClose.md) | Закрыть приложение. |
| [VKWebAppSendToClient](VKWebAppSendToClient.md) | Показать окно с предложением открыть приложение на привязанном к аккаунту мобильном устройстве. |
| [VKWebAppViewHide](VKWebAppViewHide.md) | Сообщить о том, что пользователь переключился на другое приложение или вернулся на главный экран. |
| [VKWebAppViewRestore](VKWebAppViewRestore.md) | Сообщить о том, что пользователь снова открыл приложение после переключения. |
| [VKWebAppScroll](VKWebAppScroll.md) | Прокрутить окно приложения по вертикали. |
| [VKWebAppScrollTop](VKWebAppScrollTop.md) | Получить текущую позицию прокрутки относительно верха родительского окна приложения. |
| [VKWebAppScrollTopStart](VKWebAppScrollTopStart.md) | Начать отправку событий о прокрутке родительского окна. |
| [VKWebAppScrollTopStop](VKWebAppScrollTopStop.md) | Остановить отправку событий о прокрутке, начатых событием [`VKWebAppScrollTopStart`](VKWebAppScrollTopStart.md). |

### Монетизация

#### Реклама

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppCheckNativeAds](VKWebAppCheckNativeAds.md) | Проверить, есть ли на стороне пользователя рекламные материалы, доступные для показа. |
| [VKWebAppShowNativeAds](VKWebAppShowNativeAds.md) | Показать рекламу. |

#### Баннеры

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppShowBannerAd](VKWebAppShowBannerAd.md) | Показать баннерную рекламу. |
| [VKWebAppCheckBannerAd](VKWebAppCheckBannerAd.md) | Проверить, была ли показана баннерная реклама. |
| [VKWebAppBannerAdUpdated](VKWebAppBannerAdUpdated.md) | Получить статус обновления баннерной рекламы. |
| [VKWebAppHideBannerAd](VKWebAppHideBannerAd.md) | Скрыть баннерную рекламу. |
| [VKWebAppBannerAdClosedByUser](VKWebAppBannerAdClosedByUser.md) | Сообщить о том, что пользователь закрыл баннер рекламы. |

#### Покупки

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppShowOrderBox](VKWebAppShowOrderBox.md) | Открыть окно покупки товара. |
| [VKWebAppShowSubscriptionBox](VKWebAppShowSubscriptionBox.md) | Показать окно покупки, отмены или восстановления подписки. |
| [VKWebAppOpenPayForm](VKWebAppOpenPayForm.md) | Показать платёжное окно VK Pay. |

#### Аналитика

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppConversionHit](VKWebAppConversionHit.md) | Отслеживать конверсионные действия пользователей. |
| [VKWebAppRetargetingPixel](VKWebAppRetargetingPixel.md) | Добавить пользователя в аудиторию ретаргетинга. |
| [VKWebAppTrackEvent](VKWebAppTrackEvent.md) | Отправить данные в [MyTracker](https://tracker.my.com/promo). |

### Пользователи и сообщества

#### Пользователи

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppGetEmail](VKWebAppGetEmail.md) | Запросить доступ к адресу электронной почты пользователя. |
| [VKWebAppGetFriends](VKWebAppGetFriends.md) | Показать список друзей пользователя. |
| [VKWebAppGetGeodata](VKWebAppGetGeodata.md) | Показать текущее местоположение пользователя. |
| [VKWebAppGetPersonalCard](VKWebAppGetPersonalCard.md) | Показать карточку с контактными данными пользователя. |
| [VKWebAppGetPhoneNumber](VKWebAppGetPhoneNumber.md) | Запросить доступ к номеру телефона пользователя. |
| [VKWebAppOpenContacts](VKWebAppOpenContacts.md) | Запросить доступ к контактам из телефонной книги пользователя. |
| [VKWebAppGetUserInfo](VKWebAppGetUserInfo.md) | Получить данные из профиля пользователя. |

#### Сообщества

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppAddToCommunity](VKWebAppAddToCommunity.md) | Добавить приложение в сообщество. |
| [VKWebAppAllowMessagesFromGroup](VKWebAppAllowMessagesFromGroup.md) | Получить разрешение на отправку сообщений от имени сообщества. |
| [VKWebAppGetGroupInfo](VKWebAppGetGroupInfo.md) | Получить информацию о сообществе. |
| [VKWebAppJoinGroup](VKWebAppJoinGroup.md) | Предложить пользователю вступить в сообщество. |
| [VKWebAppLeaveGroup](VKWebAppLeaveGroup.md) | Предложить пользователю выйти из сообщества. |
| [VKWebAppSendPayload](VKWebAppSendPayload.md) | Отправить событие из приложения, добавленного в сообщество. |
| [VKWebAppShowCommunityWidgetPreviewBox](VKWebAppShowCommunityWidgetPreviewBox.md) | Показать виджет сообщества перед публикацией. |

### Социальные механики и взаимодействие

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppAddToFavorites](VKWebAppAddToFavorites.md) | Добавить приложение в избранное. |
| [VKWebAppAddToHomeScreen](VKWebAppAddToHomeScreen.md) | Добавить ярлык приложения на главный экран устройства. |
| [VKWebAppAddToHomeScreenInfo](VKWebAppAddToHomeScreenInfo.md) | Получить информацию о ярлыке приложения. |
| [VKWebAppRecommend](VKWebAppRecommend.md) | Порекомендовать приложение друзьям. |
| [VKWebAppShare](VKWebAppShare.md) | Поделиться ссылкой. |
| [VKWebAppShowStoryBox](VKWebAppShowStoryBox.md) | Открыть редактор историй. |
| [VKWebAppAllowNotifications](VKWebAppAllowNotifications.md) | Запросить разрешение на отправку уведомлений. |
| [VKWebAppDenyNotifications](VKWebAppDenyNotifications.md) | Отключить уведомления. |
| [VKWebAppOpenWallPost](VKWebAppOpenWallPost.md) | Открыть запись со стены в слое. |
| [VKWebAppShowInviteBox](VKWebAppShowInviteBox.md) | Пригласить друзей в игру. |
| [VKWebAppShowLeaderBoardBox](VKWebAppShowLeaderBoardBox.md) | Показать таблицу результатов. |
| [VKWebAppShowRequestBox](VKWebAppShowRequestBox.md) | Отправить пользователю запрос о помощи в игре. |

### Текст и медиафайлы

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppCopyText](VKWebAppCopyText.md) | Копировать текст в буфер обмена. |
| [VKWebAppDownloadFile](VKWebAppDownloadFile.md) | Скачать файл на устройство. |
| [VKWebAppOpenCodeReader](VKWebAppOpenCodeReader.md) | Считать QR-код. |
| [VKWebAppShowSlidesSheet](VKWebAppShowSlidesSheet.md) | Показать [информационные экраны](https://dev.vk.com/ru/mini-apps/development/information-screens), которые используются для знакомства с возможностями приложения. |
| [VKWebAppShowImages](VKWebAppShowImages.md) | Открыть нативный экран для просмотра изображений. |
| [VKWebAppTranslate](VKWebAppTranslate.md) | Перевести текст на другой язык. |

### Хранилище VK Storage

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppStorageSet](VKWebAppStorageSet.md) | Создать пару «ключ — значение». |
| [VKWebAppStorageGet](VKWebAppStorageGet.md) | Получить значение ключа. |
| [VKWebAppStorageGetKeys](VKWebAppStorageGetKeys.md) | Получить названия всех переменных. |

### Звонки

| Событие | Сценарий использования |
| :--- | :--- |
| [—](call.md) | Позвонить пользователю. |
| [VKWebAppCallStart](VKWebAppCallStart.md) | Создать ссылку, по которой к [звонку](https://dev.vk.com/ru/mini-apps/development/calls-integration) могут подключиться пользователи. |
| [VKWebAppCallJoin](VKWebAppCallJoin.md) | Подключить пользователя к [звонку](https://dev.vk.com/ru/mini-apps/development/calls-integration) по ссылке. |
| [VKWebAppCallGetStatus](VKWebAppCallGetStatus.md) | Получить информацию о состоянии текущего активного [звонка](https://dev.vk.com/ru/mini-apps/development/calls-integration). |
| [VKWebAppCallLeft](VKWebAppCallLeft.md) | Сообщить, если пользователь вышел из [звонка](https://dev.vk.com/ru/mini-apps/development/calls-integration). |
| [VKWebAppCallFinished](VKWebAppCallFinished.md) | Сообщить, если пользователь, создавший [звонок](https://dev.vk.com/ru/mini-apps/development/calls-integration), завершил его для всех. |

### Мобильные устройства

#### Аутентификация

События этой группы доступны только для [мини-приложений](https://dev.vk.com/ru/mini-apps/overview).

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppSecureTokenRequestAccess](VKWebAppSecureTokenRequestAccess.md) | Запросить у пользователя разрешение на использование биометрии в качестве способа аутентификации в приложении. |
| [VKWebAppSecureTokenSet](VKWebAppSecureTokenSet.md) | Сохранить в защищённое хранилище произвольную строку, которая будет использоваться как ключ доступа. |
| [VKWebAppSecureTokenGet](VKWebAppSecureTokenGet.md) | Запустить проверку биометрии и после её успешного прохождения получить ключ доступа из защищённого хранилища. |
| [VKWebAppSecureTokenGetInfo](VKWebAppSecureTokenGetInfo.md) | Получить информацию о том, доступна ли на устройстве биометрия. |
| [VKWebAppSecureTokenRemove](VKWebAppSecureTokenRemove.md) | Удалить из защищённого хранилища ключ доступа, который был сохранён для аутентификации пользователя с помощью биометрии. |

#### Виброотклик

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppTapticImpactOccurred](VKWebAppTapticImpactOccurred.md) | Вызвать вибрацию при столкновении. |
| [VKWebAppTapticNotificationOccurred](VKWebAppTapticNotificationOccurred.md) | Вызвать вибрацию после выполнения действия. |
| [VKWebAppTapticSelectionChanged](VKWebAppTapticSelectionChanged.md) | Вызвать вибрацию при изменении выбора пользователем. |

#### Фонарик

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppFlashGetInfo](VKWebAppFlashGetInfo.md) | Получить информацию о фонарике. |
| [VKWebAppFlashSetLevel](VKWebAppFlashSetLevel.md) | Задать уровень яркости фонарика. |

#### Датчики

| Событие | Сценарий использования |
| :--- | :--- |
| [VKWebAppAccelerometerStart](VKWebAppAccelerometerStart.md) | Отслеживать данные акселерометра. |
| [VKWebAppAccelerometerStop](VKWebAppAccelerometerStop.md) | Прекратить отслеживание данных акселерометра. |
| [VKWebAppDeviceMotionStart](VKWebAppDeviceMotionStart.md) | Отслеживать данные о положении устройства. |
| [VKWebAppDeviceMotionStop](VKWebAppDeviceMotionStop.md) | Прекратить отслеживание данных о положении устройства. |
| [VKWebAppGyroscopeStart](VKWebAppGyroscopeStart.md) | Отслеживать данные гироскопа. |
| [VKWebAppGyroscopeStop](VKWebAppGyroscopeStop.md) | Прекратить отслеживание данных гироскопа. |

## Материалы по теме

- [Использование API ВКонтакте](../api/overview.md)
- [Документация React](https://ru.react.dev/learn)
