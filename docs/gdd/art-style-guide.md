# Визуальная памятка и Арт-гайд **Balite** (Art & UI Style Guide)

> **Назначение документа:** единый визуальный стандарт для интерфейса и нейросетевой генерации пиксель-арта (Google Flow / Nano Banana) в сеттинге **«Гильдия приключенцев»**.  
> **Связанные документы:** [balite-gdd.md](balite-gdd.md), [2026-11-12-desktop-ui-pacing-epics.md](../superpowers/specs/2026-11-12-desktop-ui-pacing-epics.md).

---

## 1. Главная формула стиля (чтобы всё выглядело как одна игра)

- **Плотность пикселя («битность»):** **Hi-Bit / 32-bit Indie RPG Pixel Art** — современный плотный пиксель-арт в стилистике аниме-фэнтези (*Konosuba*, *Frieren*, *Octopath Traveler*, *Owlboy*).
  - **НЕ использовать** грубые «8-битные кубики» уровня Денди (`8-bit chunky pixels`).
  - **НЕ использовать** гладкую «безпиксельную» векторную или акварельную графику без пиксельной сетки.
- **Эталоны проекта (ориентиры при генерации):**
  - Персонажи: [mira_idle.webp](../../public/sprites/mira/mira_idle.webp) (`321×515` px)
  - Медальоны монстров и боссов: [slime.webp](../../public/sprites/blinds/slime.webp) и [orsted.webp](../../public/sprites/blinds/orsted.webp) (`256×256` px)
- **Ключевые признаки стиля:**
  - Чёткая тёмная пиксельная обводка (`1–2 px` тёмно-коричневого или почти чёрного цвета, не чисто `#000000` внутри светлых материалов).
  - Направленный свет **сверху-слева** и богатые ступенчатые тени (`3–5` оттенков на каждый материал).
  - Тёплая приключенческая атмосфера зала гильдии: дерево, пергамент, кованая латунь, сургуч, кристаллы маны.
- **Строгие запреты (`6+` / `12+` для Яндекс Игр, VK Игр и ОК):**
  - Никакого зелёного покерного сукна, фишек, рулеток и эстетики казино Balatro.
  - Никакого оккультного Таро и черепов.
  - Никаких таверных алкогольных атрибутов (кружек, бутылок, бочек с элем) — только **зал Гильдии приключенцев**.

---

## 2. Официальная цветовая палитра проекта

| Роль в интерфейсе | Название цвета | Hex-коды | Где применяется |
| :--- | :--- | :--- | :--- |
| **Светлое дерево (основа доски)** | Тёплый дуб / каштан | `#8A5A3A` · `#6D452B` | Доски фона в Главном меню, на Доске заказов, за стойкой Миры |
| **Тёмное дерево (рамы и тени)** | Морёный орех | `#3D2315` · `#2A160C` | Деревянные рамы панелей, борт стола, полки магазина |
| **Затухание глубины** | Ночной дуб | `#120905` | Виньетка по краям экрана и глубокие тени под панелями |
| **Стол боя — Вариант А *(рек.)*** | Сапфир гильдии | `#162642` · `#0E1A30` | Полотно стола в бою (в тон жилета Миры; даёт топ-контраст картам) |
| **Стол боя — Вариант Б** | Королевский бордо | `#3A141D` · `#230A10` | Альтернативное полотно стола в бою (тёплая гильдейская ткань) |
| **Обычный пергамент** | Тёплый крем / старая бумага | `#F2DFB4` · `#D9BC84` | Центр листков заказов (без пятен!), окна «Детали партии» и реплик |
| **Пергамент Босса** | Жжёный янтарь и багрянец | `#EBD0A0` · `#5C181C` | Край обгоревшего контракта Босса, середина остаётся светлой |
| **Чернила на бумаге** | Тёмная сепия | `#2A180D` · `#5E3C24` | Заголовки, цели и награды на светлых пергаментных листках |
| **Золото и латунь** | Золото гильдии / латунь | `#F5B942` · `#FFD584` · `#B8860B` | Уголки рамок, монеты, акценты кнопок, бейджи, рамки этапов |
| **Кованое железо** | Воронёная сталь | `#858E9E` · `#4E5561` | Заклёпки, гвозди на листках, металлические элементы |
| **Сила (Chips)** | Сапфировая мана | `#1E58B8` · `#3B82F6` | Левый счётчик `Сила`, синие всплывающие поп-апы |
| **Множ (Mult) / Сургуч** | Рубиновый сургуч | `#B91C1C` · `#EF4444` | Правый счётчик `Множ`, сургучные печати Босса, красные кнопки |
| **Главное действие** | Изумруд гильдии | `#2D8759` · `#1E6240` | Кнопки «Сыграть», «Далее», «Принять заказ» |
| **Текст на тёмном (HUD)** | Светлый пергамент | `#FFF6E5` · `#C9B499` | Надписи в боковой/верхней панели HUD и на тёмных кнопках |

---

## 3. Технические требования к картинкам (под веб-игры `2–3 МБ`)

1. **Ракурс UI-элементов:** строго **плоский вид спереди (`flat 2D front-facing orthographic view`)**, без наклона, перспективы и падающих теней (тень и лёгкий поворот листков делаются кодом в CSS).
2. **Фон для вырезки:**
   - Отдельные элементы (листки, рамки, кнопки, печати, иконки карт) генерируются на **чистом сплошном хромакее `#00FF00`**.
   - **Для 9-slice рамок с пустой серединой:** `#00FF00` должен быть **и снаружи рамки, и внутри её центра**.
   - Фоны-текстуры (дерево, ткань стола) генерируются **без `#00FF00`**, как квадратный бесшовный тайл (`seamless tileable`).
3. **Чистота под текст:** внутри пергаментных листков и кнопок не должно быть букв, фейковых рун, клякс или картинок — середина должна быть спокойной, чтобы шрифт `Pixellari` читался чётко даже на экране телефона `720×1280`.
4. **Целевые размеры после сжатия (исходники с Банана ресайзятся методом `NEAREST` в `.webp`):**

| Тип ассета | Соотношение в Банане | Размер в игре (`.webp`) | Целевой вес 1 файла |
| :--- | :---: | :---: | :---: |
| Бесшовный тайл фона (дерево, ткань стола) | `1:1` | `256×256` px | `15–30 КБ` |
| 9-slice рамка панелей | `1:1` | `96×96` – `128×128` px | `6–15 КБ` |
| 9-slice табличка кнопки | `16:9` или `2:1` | `160×80` px | `6–12 КБ` |
| Пергаментный листок заказа | `3:4` | `240×320` px | `15–28 КБ` |
| Медальоны монстров и Боссов *(уже готовы)* | `1:1` | `256×256` px | `32–39 КБ` |
| Мелкий крепёж (гвоздь, печать, бирка) | `1:1` | `64×64` – `96×96` px | `3–6 КБ` |
| Иконки карт (Навыки, Свитки, Томы, Сундуки, Привилегии) | `1:1` | `128×128` px | `4–9 КБ` |
| Фигуры (`В/Д/К/Т`) и рубашки колод | `3:4` | `120×168` px | `8–15 КБ` |

---

## 4. Универсальная заготовка промптов для Банана (Google Flow)

### Правило №1: прикрепляй референс стиля
В Google Flow, если есть поле для картинки-примера, прикрепляй:
- [orsted.webp](../../public/sprites/blinds/orsted.webp) — для рамок, Босс-листка, сургуча, тёмных/опасных артефактов;
- [mira_idle.webp](../../public/sprites/mira/mira_idle.webp) — для обычных листков, кнопок, Навыков, Томов, Свитков и персонажей.

И добавляй в промпт: `match the pixel density, 1px dark outline and shading quality of the reference sprite`.

### Правило №2: стоп-слова для фильтра Google Flow
Чтобы фильтр не блокировал генерацию, **никогда не пиши в промптах**: `felt`, `playing cards`, `coins`, `poker`, `casino`, `bounty`, `wanted`, `skulls`, `blood`, `tavern`.  
Используй безопасные замены: `adventurers guild`, `quest parchment`, `official contract`, `woven cloth`, `fantasy guild hall`.

### Единая шапка стиля (копируй в начало каждого промпта)
```text
High-detail 32-bit modern indie RPG pixel art in anime fantasy style, dense crisp pixel clusters, 1px dark sepia outline, rich stepped shading with top-left lighting, matching modern Hi-Bit SNES/GBA fantasy RPG aesthetic (not chunky 8-bit)
```

---

## 5. Готовые промпты по этапам

### Фаза 1: Каркас интерфейса «Гильдия приключенцев» (6 базовых ассетов)

#### 1. Деревянная доска и стена гильдии (бесшовный фон — `1:1`, без хромакея)
*Куда идёт: фон Главного меню, Доски заказов, задник Стойки Миры и поля на широком ПК.*
```text
Seamless tileable high-detail 32-bit modern indie RPG pixel art texture of a warm fantasy adventurers guild wooden notice board, horizontal warm oak and chestnut wood planks with subtle wood grain, dark plank seams and tiny iron nail heads, warm medium-brown wood tones, low contrast in the middle so UI panels remain readable, crisp pixel clusters, flat top-down orthographic 2D game texture, no vignette, no lighting gradient, no text, no objects.
```

#### 2. Поверхность стола в бою (бесшовный фон — `1:1`, без хромакея)
*Куда идёт: центральная арена во время боя (под выложенные карты и руку).*

**Вариант 2А — Сапфирово-синее полотно гильдии (под костюм Миры, рекомендуется):**
```text
Seamless tileable high-detail 32-bit anime fantasy pixel art texture of a royal dark navy blue woven cloth table runner in an adventurers guild hall, subtle faint woven diamond pattern, calm matte low-contrast surface, rich deep indigo-slate shadows, flat top-down orthographic 2D game texture, crisp pixel clusters.
```

**Вариант 2Б — Королевское бордовое полотно гильдии (альтернатива):**
```text
Seamless tileable high-detail 32-bit anime fantasy pixel art texture of a deep dark crimson-burgundy woven tapestry fabric for an adventurers guild table, subtle faint textile weave pattern, calm matte low-contrast surface, flat top-down orthographic 2D game texture, crisp pixel clusters.
```

#### 3А. Обычный пергаментный листок заказа (`3:4`, фон `#00FF00`)
*Куда идёт: листки Младшего и Старшего заказа на Доске заказов, подложки окон правил и «Деталей партии».*
```text
High-detail 32-bit modern indie RPG pixel art UI sprite of an ornate medieval adventurers guild parchment contract sheet, strictly front-facing flat 2D orthographic view. Dense fine pixel clusters, crisp 1px dark sepia pixel outline, layered ragged aged paper edges with curled corners, subtle horizontal fold crease and tactile paper fiber shading. Printed near the inner perimeter is an elegant dark-brown ink guild document border with intricate filigree corner flourishes and tiny heraldic diamond ornaments. Large clean warm cream-ivory blank paper center with plenty of empty space for text, zero words, zero letters, zero illustrations inside, no pins, no drop shadow, isolated on solid flat pure chroma-key green #00FF00 background.
```

#### 3Б. Контракт Босса-монстра (`3:4`, фон `#00FF00`)
*Куда идёт: правая карточка Босса-монстра на Доске заказов.*
```text
High-detail 32-bit modern indie RPG pixel art UI sprite of an urgent high-rank royal danger quest decree parchment for a dungeon boss encounter, strictly front-facing flat 2D orthographic view. Dense fine pixel clusters, crisp dark pixel outline, heavily weathered tattered edges with dark scorched charred borders and deep crimson-burgundy outer staining. Printed near the inner perimeter is an ornate dark gothic-fantasy frame border with metallic tarnished gold and crimson spiky corner filigree, faint subtle arcane corner scrollwork and weathered wax smudges only along the border. Clean readable warm pale-amber parchment center with zero text, zero letters, zero characters inside, no drop shadow, isolated on solid flat pure chroma-key green #00FF00 background.
```

#### 4. Резная деревянно-латунная рамка 9-slice (`1:1`, `#00FF00` и снаружи, и внутри!)
*Куда идёт: рамки HUD, полки Навыков, борт стола боя, полки Стойки Миры и модальные окна.*
```text
High-detail 32-bit modern indie RPG pixel art UI 9-slice window frame border only, square warm dark oak wood frame with ornate riveted brass corner brackets and crisp 1px dark outline, strictly straight horizontal and vertical borders, completely EMPTY hollow center filled with solid pure chroma-key green #00FF00, outside background also solid pure chroma-key green #00FF00, flat front-facing orthographic 2D UI asset, no inner background, no text, no icons, no shadow.
```

#### 5. Кнопка-табличка гильдии (`16:9` или `2:1`, фон `#00FF00`)
*Куда идёт: основа для всех главных кнопок («ИГРАТЬ», «В бой», «Сыграть», «Сбросить», «Далее»).*
```text
High-detail 32-bit anime fantasy RPG pixel art UI wooden and golden-brass beveled button plate sprite, front-facing flat 2D orthographic view, warm polished oak wood base with riveted golden-bronze trim border and crisp dark sepia pixel outline, subtle top bevel highlight, completely clean flat center with zero text and zero icons, no drop shadow, isolated on solid flat pure chroma-key green #00FF00 background.
```

#### 6. Лист крепежа и печатей (`1:1`, фон `#00FF00`)
*Куда идёт: железный гвоздь сверху обычных листков, красная сургучная печать на лист Босса, отрывная бирка Талона гильдии.*
```text
High-detail 32-bit anime fantasy pixel art RPG UI icon sheet containing 3 separate well-spaced items isolated on a solid flat pure chroma-key green #00FF00 background, crisp 1px dark outline: 1) top-left: a small round hammered iron nail head pin seen straight from front, 2) top-right: a round crimson red wax guild seal stamp embossed with a tiny golden shield emblem, 3) bottom: a small blank cream parchment hang-tag ticket with a tiny eyelet hole and twine loop on top (no text). Strict flat 2D front view, wide green gaps between items, no drop shadows.
```

---

### Фаза 2: Контент карт для будущих генераций (`CardFrame`)

Когда дойдём до наполнения карточек в игре, используется та же шапка стиля, но с коротким шаблоном под предмет:

- **Навык / Предмет (`1:1`, фон `#00FF00`):**
  ```text
  High-detail 32-bit modern indie RPG pixel art game icon of [ПРЕДМЕТ И ЕГО АНИМЕ-ФЭНТЕЗИ ДЕТАЛИ], strictly centered icon composition, crisp 1px dark sepia pixel outline, vibrant anime fantasy palette with warm highlights, no background scenery, no text, no frame, no drop shadow, isolated on solid flat pure chroma-key green #00FF00 background.
  ```
- **Свиток Кузницы / Том комбинаций / Карта Пандоры (`1:1`, фон `#00FF00`):**
  - *Том:* `glowing antique leather-bound spellbook tome embossed with [СИМВОЛ]`
  - *Свиток:* `rolled magical parchment forge scroll tied with [ЦВЕТ] ribbon and glowing rune stamp`
  - *Пандора:* `mysterious ornate arcane relic card floating with [ЦВЕТ] magical aura wisps`
- **Сундук (`1:1`, фон `#00FF00`):**
  `ornate medieval fantasy treasure chest with [ДЕРЕВО/ЗОЛОТО/АЛЫЕ КАМНИ] trim, closed slightly angled front-facing RPG sprite, crisp 1px dark outline, isolated on #00FF00`
- **Фигурная карта `В/Д/К` (`3:4`, без хромакея или на светлом креме `#FFF6E5`):**
  `high-detail 32-bit anime fantasy RPG pixel art character portrait bust of [Рыцарь/Принцесса/Король в стиле гильдии], centered inside a clean warm cream card illustration frame, crisp 1px dark outline, vibrant clean colors`

---

## 6. Быстрый чек-лист приёмки перед сохранением в `scratch/raw_ui/`

Перед тем как сохранить картинку из Банана, проверь 5 пунктов глазами:
1. Нет «шахматки» вместо ровного `#00FF00`?
2. Нет случайных надписей, фальшивых букв или лишних значков в центре?
3. Элемент смотрит строго прямо на тебя (не повёрнут в изометрию / 3D)?
4. Плотность пикселей мелкая и сочная (как на Мире и медальонах), а не крупные квадратики?
5. Снизу/сбоку нет обрезанных краёв?
