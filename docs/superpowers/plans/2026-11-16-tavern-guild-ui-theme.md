# План реализации: Редизайн UI «Таверна и дубовая стойка Гильдии» (Вариант А)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полный визуальный редизайн интерфейса Balite из зелёно-неонового стиля Balatro в атмосферное фэнтези «Гильдия приключенцев» (морёный дуб, латунь, пергаментные заказы, самоцветы маны Силы и Множителя, парящие каминные искры и увеличенные жетоны монстров) с сохранением полной модульности под генерации в Nano Banana 2.1.

**Architecture:** Переход осуществляется через сквозную замену дизайн-токенов темы (`--screen-*`), переработку процедурного фона `backdropCanvas.ts` (тёплые каминные волны и искры), обогащение CSS-стилей доски заказов (`.blind-card`), боевого HUD (сапфир/рубин) и слотов экипировки (`cardFrame.css`) без изменения структуры DOM-дерева логики `screens.ts`, что гарантирует 100% сохранение всех 418 unit-тестов.

**Tech Stack:** TypeScript, CSS3 (Custom Properties, clamp, pseudo-elements, gradients, box-shadows), HTML5 Canvas 2D, Vitest, Chrome DevTools MCP.

**Spec:** [docs/superpowers/specs/2026-11-16-tavern-guild-ui-theme-design.md](file:///d:/Proga/balite/docs/superpowers/specs/2026-11-16-tavern-guild-ui-theme-design.md)

## Global Constraints

- **Язык общения:** Строго русский язык во всех ответах и пояснениях.
- **Итоги для игрока:** Финальные отчёты формулировать языком игрока (что появилось на экранах), без перечисления внутренних имён функций/переменных.
- **Код:** Комментарии в коде — на русском, Git-коммиты — на русском, идентификаторы в коде — на английском.
- **Ссылки на файлы:** Всегда оформлять в виде `[текст](file:///полный/путь)`.
- **Модерация 6+/12+:** Запрещены любые азартные/казино/таро термины (покер, казино, ставка, блайнд, фишка, таро, дьявол, шулер, вампир и т.д.) в видимых текстах и тестах.
- **Запрет внешних ссылок:** Никаких `<a href="...">` или `xlink:href` в SVG/HTML.
- **Готовность к Nano Banana:** Все элементы используют CSS/SVG каркас с возможностью бесшовной подстановки WebP-спрайтов.

## Review Focus

1. **Контрастность текста на пергаменте и дубе:** Проверить читаемость золотого и бежевого текста на тёмном фоне (WCAG AA).
2. **Адаптивность 720×1280 и десктоп:** Убедиться, что крупные жетоны мобов (до 195px) и пергаментные карточки не вызывают горизонтального или вертикального скролла вьюпорта.
3. **Производительность Canvas:** Фон `backdropCanvas.ts` должен плавно работать на 60 FPS без утечек памяти при смене состояний экрана.
4. **Чистота консоли DevTools:** 0 ошибок в консоли браузера при любых переключениях экранов (`list_console_messages`).
5. **Сохранение паритета тестов:** Все 418 unit-тестов обязаны оставаться строго зелёными.

---

### Task 1: Процедурный Canvas-фон каминного зала таверны

**Files:**
- Modify: `src/ui/backdropCanvas.ts:48-91`, `src/ui/backdropCanvas.ts:227-248`
- Create: `tests/ui/backdropCanvas.test.ts`

**Interfaces:**
- Consumes: `BackdropMood`, `createBackdropCanvas(canvas: HTMLCanvasElement): BackdropController`
- Produces: обновлённые палитры `MOOD_PALETTES` (дуб, янтарь, каминный огонь) и искры `SparkParticle`

- [ ] **Step 1: Write the failing test for backdrop palette and sparks**

Создать `tests/ui/backdropCanvas.test.ts` с проверкой корректности всех 6 палитр настроений (`menu`, `battle`, `boss`, `shop`, `victory`, `defeat`): они не должны быть зелёными (компоненты Red > Green для menu/battle/shop/boss), не содержат NaN, и контроллер корректно меняет mood без ошибок.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/backdropCanvas.test.ts`
Expected: FAIL (из-за старых зелёных тонов menu/battle).

- [ ] **Step 3: Implement tavern fireplace palettes and sparks in `src/ui/backdropCanvas.ts`**

Обновить объект `MOOD_PALETTES`:
- `menu`: внутренний `[48, 28, 16]`, внешний `[20, 10, 6]`, волны `[112, 66, 32]` и `[184, 115, 51]`, акцент `#f5b942`.
- `battle`: внутренний `[42, 24, 14]`, внешний `[18, 9, 5]`, волны `[96, 54, 26]` и `[198, 128, 54]`, акцент `#ffd584`.
- `boss`: внутренний `[62, 18, 22]`, внешний `[24, 8, 10]`, волны `[142, 38, 48]` и `[196, 62, 42]`, акцент `#ff7a66`.
- `shop`: внутренний `[58, 36, 18]`, внешний `[24, 14, 8]`, волны `[148, 92, 38]` и `[218, 148, 56]`, акцент `#fde68a`.
- `victory`: внутренний `[48, 42, 20]`, внешний `[22, 18, 8]`, волны `[186, 150, 48]` и `[234, 198, 72]`, акцент `#ffe882`.
- `defeat`: внутренний `[28, 24, 26]`, внешний `[12, 10, 12]`, волны `[68, 62, 70]` и `[112, 78, 86]`, акцент `#ba98aa`.

Настроить физику `ambientSparks`: частицы медленно всплывают вверх (`vy: -14` до `-32`), мягко покачиваясь, имитируя искры очага в таверне.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/backdropCanvas.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/backdropCanvas.ts tests/ui/backdropCanvas.test.ts
git commit -m "feat(ui): процедурный Canvas-фон каминного зала гильдии и искры очага"
```

---

### Task 2: Глобальные дизайн-токены таверны и базовые стили экранов

**Files:**
- Modify: `src/ui/screens.css:1-120`
- Test: `tests/ui/screens.test.ts`

**Interfaces:**
- Consumes: CSS-переменные темы `:root`
- Produces: палитра мореного дуба, латуни и пергамента для всех экранов приложения

- [ ] **Step 1: Write test for theme tokens and styling consistency**

В `tests/ui/screens.test.ts` добавить тест проверки наличия базовых токенов дубовой палитры и отсутствия кислотно-зеленых оттенков Balatro в корневых стилях.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/screens.test.ts`
Expected: FAIL (если проверяем новые токены).

- [ ] **Step 3: Update CSS root variables and panels in `src/ui/screens.css`**

Задать в `:root`:
- `--screen-bg-top`: `#2a160c`;
- `--screen-bg-bottom`: `#120905`;
- `--screen-panel`: `rgba(26, 15, 9, 0.94)`;
- `--screen-panel-alt`: `rgba(38, 22, 13, 0.96)`;
- `--screen-border`: `rgba(212, 163, 72, 0.42)`;
- `--screen-border-strong`: `rgba(245, 185, 66, 0.85)`;
- `--screen-text`: `#fff6e5`;
- `--screen-muted`: `#c9b499`;
- `--screen-gold`: `#f5b942`;
- Стилизовать боковую панель `.screen-sidebar` под темную дубовую стойку с латунным кантом и объемной тенью.
- Стилизовать информационные плашки (руки, сбросы, ранг) под чеканные медные таблички.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/screens.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens.css tests/ui/screens.test.ts
git commit -m "feat(ui): глобальные дизайн-токены морёного дуба, латуни и пергамента"
```

---

### Task 3: Доска заказов гильдии и свитки пергамента с крупными жетонами

**Files:**
- Modify: `src/ui/screens.css:300-500`
- Test: `tests/ui/screens.test.ts`

**Interfaces:**
- Consumes: DOM-структура `.blind-card`, `.blind-card__token`, `.blind-card__emblem`, `.blind-select-screen`
- Produces: стилизованные под свитки пергамента карточки заказов с крупными жетонами (до 195px) и геральдическими кнопками

- [ ] **Step 1: Add assertions for enlarged tokens and quest board classes in `tests/ui/screens.test.ts`**

Убедиться, что тесты проверяют рендеринг карточек заказов, сохранение доступности кнопок и отсутствие скролла.

- [ ] **Step 2: Run test to verify baseline**

Run: `npx vitest run tests/ui/screens.test.ts`
Expected: PASS

- [ ] **Step 3: Implement tavern quest board styling in `src/ui/screens.css`**

- Оформить `.blind-select-screen` как настенную деревянную доску объявлений гильдии с текстурной глубиной.
- Стилизовать `.blind-card`:
  - Фон под плотный пергаментный свиток с эффектом тиснения и латунной каймой.
  - Декоративные латунные уголки на карточках через CSS `::before` / `::after`.
  - Увеличить жетоны монстров `.blind-card__token .blind-card__emblem`:
    - Десктоп: `clamp(140px, min(13vw, 21dvh), 195px)`.
    - Мобилка: `clamp(96px, min(16vw, 13dvh), 132px)`.
    - `flex: 1` для вертикального центрирования жетона.
  - Чеканные шильдики для плашек с именами мобов (`.blind-card__badge--small`, `big`, `boss`).
  - Золотая объемная кнопка «Принять заказ» с эффектом нажатия и янтарным сиянием.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/screens.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens.css tests/ui/screens.test.ts
git commit -m "feat(ui): оформление доски заказов гильдии под пергаментные свитки с крупными жетонами"
```

---

### Task 4: Боевой HUD, самоцветы маны и резные слоты экипировки

**Files:**
- Modify: `src/ui/screens.css:500-750`, `src/ui/cardFrame.css:1-120`
- Test: `tests/ui/cardFrame.test.ts`, `tests/ui/screens.test.ts`

**Interfaces:**
- Consumes: классы боевого HUD `.battle-hud`, `.battle-hud__chips`, `.battle-hud__mult`, `.card-slot-placeholder`
- Produces: сапфировый и рубиновый кристаллы маны, резные лотки для слотов Навыков/Расходников в дубовой балке

- [ ] **Step 1: Write test for slot placeholder styling and mana gems in `tests/ui/cardFrame.test.ts`**

Убедиться, что слоты и карточки сохраняют правильные классы, атрибуты и безопасны для 6+/12+.

- [ ] **Step 2: Run test to verify baseline**

Run: `npx vitest run tests/ui/cardFrame.test.ts`
Expected: PASS

- [ ] **Step 3: Implement mana gems and carved wooden slots**

В `src/ui/screens.css`:
- Оформить блок «Сила» как выпуклый сапфировый самоцвет: глубокий синий градиент, верхний стеклянный блик, золотая оправа с мягкой внутренней тенью.
- Оформить блок «Множ» как выпуклый рубиновый самоцвет: глубокий багрово-алый градиент, пламенный блик, золотая оправа.
- Знак «×» оформить как чеканную бронзовую эмблему.
- Стилизовать боевые кнопки «Разыграть руку» и «Сброс» под массивные деревянные пластины с латунным ободом.

В `src/ui/cardFrame.css`:
- Стилизовать слоты `.card-slot-placeholder`: глубокие резные выемки в дубовой балке (`box-shadow: inset 0 3px 8px rgba(0,0,0,0.7)`), темно-бордовое бархатное ложе, тонкая гравировка номера слота латунью.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ui/cardFrame.test.ts tests/ui/screens.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens.css src/ui/cardFrame.css tests/ui/cardFrame.test.ts
git commit -m "feat(ui): самоцветы маны в боевом HUD и резные дубовые лотки для слотов"
```

---

### Task 5: Эмпирическая верификация через Chrome DevTools и финальная полировка

**Files:**
- Modify: `src/ui/screens.css` (точечная подгонка отступов при необходимости)
- Test: Chrome DevTools MCP (навигация, скриншоты, проверка консоли), `npm test`, `npm run typecheck`

**Interfaces:**
- Consumes: Dev-сервер `http://localhost:5173/?debug`
- Produces: визуальные подтверждения, отсутствие переполнений (overflow: false), 0 ошибок в консоли

- [ ] **Step 1: Inspect screens in desktop mode (1920×935)**

- Перейти на `http://localhost:5173/?debug`.
- Снять скриншот доски заказов гильдии (`take_screenshot`).
- Проверить читаемость шрифтов, вид пергамента и масштаб жетонов (до 195px).
- Проверить консоль браузера (`list_console_messages`): 0 ошибок.

- [ ] **Step 2: Inspect screens in mobile portrait mode (720×1280)**

- Переключить viewport на 720×1280 (`emulate` / `resize_page`).
- Снять скриншот доски заказов и боевого экрана.
- Убедиться в отсутствии горизонтальной и вертикальной прокрутки (`scrollWidth === clientWidth`, `scrollHeight === clientHeight`).

- [ ] **Step 3: Run complete regression test suite**

Run: `npm test && npm run typecheck`
Expected: 418+ тестов зелёные, 0 ошибок компилятора TypeScript.

- [ ] **Step 4: Final commit**

```bash
git add -u
git commit -m "feat(ui): финальная полировка стиля таверны гильдии и адаптивности"
```
