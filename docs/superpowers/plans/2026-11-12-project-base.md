# Стартовая база проекта `balite` — План реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Развернуть в `d:\Proga\balite` чистый каркас браузерной игры на `Vite + TypeScript + Vitest` с адаптированными `AGENTS.md` и `docs/`, обобщённым `PlatformBridge` (Яндекс, ВК, ОК, VK Play, Mock), модулем разблокировки звука и минимальной заглушкой интерфейса.

**Architecture:** Платформенная логика выносится из монолитного `export_template.html` в изолированные TS-модули под `src/platform/` с чётким разделением на определение окружения (`env.ts`), сериализацию и слияние сохранений (`storage.ts`), управление звуком (`audioUnlock.ts`), адаптеры площадок (`adapters/*.ts`) и единый фасад (`bridge.ts`). Игровой рендерер не подключается до отдельного этапа проектирования самой игры.

**Tech Stack:** TypeScript (`strict: true`), Vite (`base: './'`), Vitest (`jsdom`), `@vkontakte/vk-bridge`, `@types/ysdk` (dev).

**Spec:** `docs/superpowers/specs/2026-11-12-project-base-design.md`

## Global Constraints

- Среда: `Node v26.13.0`, `npm 11.20.0`, `git 2.56.0`.
- TypeScript: `strict: true`; сборка Vite с `base: './'`, `dist/index.html` строго в корне сборки.
- Идентификаторы в коде на английском (`camelCase` / `PascalCase`); комментарии и сообщения Git-коммитов на русском.
- В `docs/` копируется только чистая документация ЯИ без `superpowers/`, `ui_concepts/`, `.gdignore` и `localization_strings.csv` от *Slime 2048*.
- Ноль упоминаний и ключей от *Slime 2048* (`slime_save`, `slime2048_save_v1`, `Slime2048`, `high_scores` / `achievements` в ядре моста).
- Ленивая загрузка `/sdk.js` в `YandexAdapter` (без блокирующего `<script src="/sdk.js">` в `index.html`).

## Review Focus

1. Повторный вызов `showInterstitial()` или `showRewarded()` во время уже открытой рекламы возвращает `{ shown: false, busy: true }` / `{ rewarded: false, busy: true }`, не дергает адаптер повторно и не сбивает глушение звука.
2. Битый JSON в `localStorage` или облачном хранилище не приводит к падению `readLocalSave` / `loadPlayerData` — возвращается безопасное пустое или локальное состояние.
3. `serializeWithinLimit` при превышении `maxBytes` (4000 байт для VK/OK) даже после `compactFallback` гарантированно возвращает валидный JSON длиной ≤ `maxBytes`.
4. Отсутствие или таймаут `/sdk.js` / `YaGames.init()` не роняют `bridge.init()`, а в `?debug`-режиме `showInterstitial()` и `showRewarded()` продолжают работать через sandbox-оверлей.
5. Параллельные вызовы `savePlayerData()` выполняются строго последовательно через очередь сохранений, чтобы поздний ответ не перезаписал свежие данные.

---

### Task 1: Инициализация Git, документация, `AGENTS.md` и каркас `Vite + TypeScript + Vitest`

**Files:**
- Create: `.gitignore`
- Create: `AGENTS.md`
- Create: `THIRD_PARTY_NOTICES.txt`
- Create: `docs/**` (копия из `d:\Proga\yan\docs\` без `superpowers/`, `ui_concepts/`, `.gdignore`, `localization_strings.csv`)
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`

**Interfaces:**
- Consumes: нет (начальная инфраструктура).
- Produces: команды `npm run dev`, `npm run build`, `npm run typecheck`, `npm test`; входной скрипт `/src/main.ts` в `index.html`.

- [ ] **Step 1: Инициализировать Git и создать `.gitignore`**

В `.gitignore` включить `node_modules/`, `dist/`, `*.zip`, `.DS_Store`, `Thumbs.db`, локальные `*.bat`. Выполнить `git init` в `d:\Proga\balite`.

- [ ] **Step 2: Перенести чистую документацию ЯИ в `docs/` и создать `AGENTS.md` + `THIRD_PARTY_NOTICES.txt`**

Скопировать файлы из `d:\Proga\yan\docs\` в `d:\Proga\balite\docs\`, исключив `superpowers/`, `ui_concepts/`, `.gdignore` и `localization_strings.csv` (сохранив уже созданный `docs/superpowers/`).
Адаптировать `AGENTS.md` из `d:\Proga\yan\AGENTS.md`: заменить `../docs/` на `docs/`, убрать строку про `Godot MCP`, добавить команду `npm test` (`vitest run`) и упоминание `PlatformBridge`.
В `THIRD_PARTY_NOTICES.txt` указать лицензию MIT для `@vkontakte/vk-bridge`.

- [ ] **Step 3: Создать `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html` и установить зависимости**

В `package.json` задать скрипты:
- `"dev": "vite"`
- `"build": "vite build"`
- `"preview": "vite preview"`
- `"typecheck": "tsc --noEmit"`
- `"test": "vitest run"`

Зависимости: `dependencies`: `@vkontakte/vk-bridge`; `devDependencies`: `typescript`, `vite`, `vitest`, `jsdom`, `@types/ysdk`.
В `tsconfig.json`: `"target": "ES2022"`, `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`, `"types": ["vitest/globals"]`.
В `vite.config.ts`: `base: './'`.
В `vitest.config.ts`: `environment: 'jsdom'`.
В `index.html`: `<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover">`, `<div id="app"></div>`, `<script type="module" src="/src/main.ts"></script>` (без статического `/sdk.js`).

Run: `npm install`
Expected: установка зависимостей без ошибок, создан `package-lock.json`.

- [ ] **Step 4: Проверить TypeScript-конфигурацию и зафиксировать базовый каркас**

Run: `npm run typecheck` (с временным пустым или минимальным экспортом не требуется до создания `src/main.ts`, поэтому проверка `npx tsc --showConfig` подтверждает валидный конфиг).
Expected: `npx tsc --showConfig` завершается с кодом 0.

- [ ] **Step 5: Commit**

```bash
git add .gitignore AGENTS.md THIRD_PARTY_NOTICES.txt package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts index.html docs
git commit -m "chore: инициализирован каркас Vite + TS и перенесена документация ЯИ"
```

---

### Task 2: Типы моста, определение окружения и универсальное хранилище сохранений

**Files:**
- Create: `src/platform/types.ts`
- Create: `src/platform/env.ts`
- Create: `src/platform/storage.ts`
- Test: `tests/platform/env.test.ts`
- Test: `tests/platform/storage.test.ts`

**Interfaces:**
- Consumes: нет.
- Produces:
  - `types.ts`: `PlatformId = 'yandex' | 'vk' | 'ok' | 'vkplay' | 'mock'`, `SupportedLang = 'ru' | 'en'`, `PlatformEventName`, `PlatformEventListener`, `InterstitialResult`, `RewardedResult`, `PlatformAdapter`, `PlatformBridgeConfig<TSave>`.
  - `env.ts`: `parseUrlParams(raw: string): Record<string, string>`, `getAllUrlParams(search?: string, hash?: string): Record<string, string>`, `normalizeLang(rawLang?: string | null, navigatorLang?: string): SupportedLang`, `detectPlatformId(params: Record<string, string>, win?: WindowLike, referrerHost?: string): PlatformId`.
  - `storage.ts`: `utf8ByteLength(str: string): number`, `serializeWithinLimit<TSave>(data: TSave, maxBytes: number, compactFallback?: (data: TSave) => unknown): string`, `readLocalSave<TSave>(key: string, sanitize?: (raw: unknown) => Partial<TSave>): Partial<TSave>`, `writeLocalSave<TSave>(key: string, data: TSave): void`.

- [ ] **Step 1: Написать падающие тесты `tests/platform/env.test.ts` и `tests/platform/storage.test.ts`**

В `tests/platform/env.test.ts` проверить:
- `getAllUrlParams('?platform=vk&lang=en', '#lang=ru&debug')`: search перекрывает hash, ключ `debug` присутствует.
- `normalizeLang`: `'0'`/`'1'`/`'2'` -> `'ru'`, `'3'` -> `'en'`, `'be'`/`'kk'`/`'uk'`/`'uz'` -> `'ru'`, `'de-DE'` -> `'en'`, пустое значение берёт `navigatorLang` с дефолтом `'ru'`.
- `detectPlatformId`: явный `?platform=...`, параметры VK (`vk_app_id`), OK (`api_server=ok.ru`), VK Play (`vkplay_appid`), реферер `playhop.com` -> `'yandex'`, дефолт `'mock'`.

В `tests/platform/storage.test.ts` проверить:
- `readLocalSave` при битом JSON в `localStorage` возвращает `{}` без исключения (Review Focus #2).
- `writeLocalSave` + `readLocalSave` сохраняет и читает произвольную структуру без упоминаний `slime_save`.
- `serializeWithinLimit`: при превышении `maxBytes` вызывает `compactFallback`, а если и после него строка > `maxBytes`, гарантированно возвращает `'{}'` (или валидный JSON ≤ `maxBytes`) без обрыва строки (Review Focus #3).

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm test`
Expected: FAIL — модули `src/platform/env` и `src/platform/storage` ещё не существуют.

- [ ] **Step 3: Реализовать `src/platform/types.ts`, `src/platform/env.ts`, `src/platform/storage.ts`**

Перенести чистую логику детекта, нормализации языка и безопасной сериализации. По умолчанию `maxStorageBytes = 4000`, слияние в `bridge.ts` конфигурируется через `mergeSave`, никаких жёстких полей `high_scores` / `achievements`.

- [ ] **Step 4: Запустить тесты и убедиться, что все проходят**

Run: `npm test`
Expected: PASS по `env.test.ts` и `storage.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/platform/types.ts src/platform/env.ts src/platform/storage.ts tests/platform/env.test.ts tests/platform/storage.test.ts
git commit -m "feat(platform): добавлены типы, определение окружения и хранилище сохранений"
```

---

### Task 3: Модуль разблокировки звука `AudioUnlock` и адаптеры площадок

**Files:**
- Create: `src/platform/audioUnlock.ts`
- Create: `src/platform/utils.ts` (`withTimeout`, `loadScriptOnce`, `formatBridgeError`, `showSandboxAdOverlay`)
- Create: `src/platform/adapters/mock.ts`
- Create: `src/platform/adapters/yandex.ts`
- Create: `src/platform/adapters/vk.ts`
- Create: `src/platform/adapters/ok.ts`
- Create: `src/platform/adapters/vkplay.ts`
- Create: `src/platform/adapters/index.ts`
- Test: `tests/platform/audioUnlock.test.ts`
- Test: `tests/platform/adapters.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `env.ts`, `storage.ts` (из Task 2).
- Produces:
  - `audioUnlock.ts`: `createAudioUnlockController()` -> `{ install(): void; dispose(): void; unlock(): void; registerContext(ctx: AudioContext): void; onAdStart(): void; onAdEnd(): void; isMutedByPlatform(): boolean; subscribeMute(fn: (muted: boolean) => void): () => void }`.
  - `adapters/index.ts`: `createAdapter<TSave>(platformId: PlatformId, ctx: AdapterContext<TSave>): PlatformAdapter<TSave>`.

- [ ] **Step 1: Написать падающие тесты `tests/platform/audioUnlock.test.ts` и `tests/platform/adapters.test.ts`**

В `tests/platform/audioUnlock.test.ts` проверить:
- `onAdStart()` переводит `isMutedByPlatform()` в `true` и уведомляет подписчика; `onAdEnd()` возвращает `false` при видимой вкладке.
- При `document.hidden === true` `unlock()` не воспроизводит канал iOS и сообщает о глушении (`muted = true`).
- `dispose()` снимает глобальные слушатели.

В `tests/platform/adapters.test.ts` проверить:
- `MockAdapter` при `isDebug: false` возвращает `{ shown: false }` / `{ rewarded: false }`, при `isDebug: true` показывает оверлей и возвращает `{ shown: true }` / `{ rewarded: true }`.
- `YandexAdapter` при ошибке/таймауте загрузки `/sdk.js` не падает в `init()` и в режиме `isDebug: true` корректно отрабатывает `showInterstitial()` / `showRewarded()` через sandbox-оверлей (Review Focus #4).
- `YandexAdapter.savePlayerData` передаёт весь объект `mergedData` в `player.setData(mergedData, true)`, не отфильтровывая поля.
- `VkAdapter` с мокнутым `vkBridge` корректно сохраняет/читает ключ `CONFIG.storageKey` и вызывает `VKWebAppShowNativeAds`.

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm test`
Expected: FAIL — модули `audioUnlock` и `adapters` ещё не существуют.

- [ ] **Step 3: Реализовать `audioUnlock.ts`, `utils.ts` и `adapters/*.ts`**

В `VkAdapter` использовать пакет `@vkontakte/vk-bridge` (без вшитого минифицированного блоба в HTML). В `YandexAdapter`, `OkAdapter`, `VkPlayAdapter` сохранить все проверенные таймауты и защитные проверки из `export_template.html`.

- [ ] **Step 4: Запустить тесты и убедиться, что проходят**

Run: `npm test`
Expected: PASS по `audioUnlock.test.ts` и `adapters.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/platform/audioUnlock.ts src/platform/utils.ts src/platform/adapters tests/platform/audioUnlock.test.ts tests/platform/adapters.test.ts
git commit -m "feat(platform): добавлены AudioUnlock и адаптеры Yandex, VK, OK, VK Play, Mock"
```

---

### Task 4: Фасад `PlatformBridge`, заглушка экрана `src/main.ts` и полная проверка сборки

**Files:**
- Create: `src/platform/bridge.ts`
- Create: `src/platform/index.ts`
- Create: `src/style.css`
- Create: `src/main.ts`
- Test: `tests/platform/bridge.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `env.ts`, `storage.ts`, `audioUnlock.ts`, `adapters/index.ts` (из Tasks 2–3).
- Produces:
  - `bridge.ts`: `createPlatformBridge<TSave extends Record<string, unknown>>(config?: Partial<PlatformBridgeConfig<TSave>>): PlatformBridge<TSave>`, `platformBridge` (дефолтный синглтон с ключом `balite_save_v1` и `balite_platform_save_v1`).
  - `src/platform/index.ts`: реэкспорт `platformBridge`, `createPlatformBridge` и публичных типов.

- [ ] **Step 1: Написать падающие тесты `tests/platform/bridge.test.ts`**

Проверить:
- Повторный вызов `showInterstitial()` / `showRewarded()` пока первый не завершился сразу возвращает `{ shown: false, busy: true }` / `{ rewarded: false, busy: true }`, не вызывая адаптер второй раз (Review Focus #1).
- Во время рекламы `audio.isMutedByPlatform()` становится `true` и сбрасывается в `false` после завершения, даже если адаптер выбросил ошибку.
- Параллельные вызовы `savePlayerData({ a: 1 })` и `savePlayerData({ b: 2 })` выполняются строго по очереди и в итоге сохраняют объединённый `{ a: 1, b: 2 }` (Review Focus #5).
- `ready()` идемпотентен: повторный вызов не отправляет второй `LoadingAPI.ready()` в адаптер.
- Битый `cloudData` не ломает `loadPlayerData()`.

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm test`
Expected: FAIL — `src/platform/bridge.ts` ещё не существует.

- [ ] **Step 3: Реализовать `src/platform/bridge.ts`, `src/platform/index.ts`, `src/style.css` и `src/main.ts`**

В `src/main.ts`:
- Установить `audioUnlock.install()`, вызвать `platformBridge.init()`, показать минимальный портретный контейнер `720×1280` (масштабируемый на любой экран) со статусом платформы (`getPlatformId()`) и языка (`getLanguage()`), после рендера вызвать `platformBridge.ready()`.
- Если `platformBridge.isDebugMode() === true`, отобразить компактную debug-панель с кнопками проверки `showInterstitial()`, `showRewarded()` и `savePlayerData()` + `loadPlayerData()`.

- [ ] **Step 4: Запустить полную верификацию (тесты, типы, сборка, проверка артефактов)**

Run: `npm test && npm run typecheck && npm run build`
Expected:
- Все тесты Vitest PASS;
- `tsc --noEmit` без ошибок;
- `vite build` собирает `dist/index.html` в корень `dist/` с относительными путями `./assets/...`;
- Проверка, что в `src/` и `index.html` нет подстроки `slime` (`rg -i "slime" src index.html` возвращает пустой результат).

- [ ] **Step 5: Commit**

```bash
git add src tests/platform/bridge.test.ts
git commit -m "feat: добавлен фасад PlatformBridge, тесты и стартовая заглушка интерфейса"
```
