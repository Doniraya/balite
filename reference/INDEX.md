# Справочная база оригинального Balatro (`1.0.1o-FULL`)

> [!IMPORTANT]
> **Назначение и юридическое ограничение:**
> Папка `reference/balatro_lua/` содержит копии выбранных `.lua`-файлов из [balatro_unpacked](file:///C:/Users/doniraya/Documents/antigravity/rea/balatro_unpacked) исключительно как локальный справочник механик, баланса и формул для разработки **balite**.
> - **Запрещено** копировать оригинальный Lua-код «в лоб», импортировать файлы отсюда в `src/` или класть их в `public/` / `dist/`.
> - **Запрещено** использовать оригинальные текстуры, шрифты, звуки и шейдеры (они намеренно **не** копировались).
> - При инициализации Git папку `reference/` нужно добавить в `.gitignore`, чтобы исходники оригинала не попали в репозиторий.

---

## Карта скопированных файлов и ключевых строк

### 1. Данные сущностей, стартовые параметры и главный цикл

| Файл | Строки | Что внутри |
| --- | --- | --- |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `218–223` | `P_SEALS` — 4 печати (`Gold`, `Red`, `Blue`, `Purple`) |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `224–250` | `P_TAGS` — 24 тега пропуска блайндов |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `252–261` | `P_STAKES` — 8 уровней сложности (`White` .. `Gold`) |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `263–297` | `P_BLINDS` — 30 блайндов (`Small`, `Big`, 28 боссов, включая 5 финальных) |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `299–362` | `P_CARDS` — стандартная колода из 52 карт |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `368–526` | `P_CENTERS`: все 150 джокеров (`j_joker` .. `j_perkeo`, редкость 1–4, цены, конфиги) |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `533–554` | `P_CENTERS`: 22 карты Таро (`c_fool` .. `c_world`) |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `557–568` | `P_CENTERS`: 12 карт Планет (`c_mercury` .. `c_eris`, 3 скрытых) |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `571–588` | `P_CENTERS`: 18 Спектральных карт (`c_familiar` .. `c_black_hole`) |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `592–624` | `P_CENTERS`: 32 ваучера (16 базовых + 16 второго тира) |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `628–644` | `P_CENTERS`: 15 стартовых колод + `Challenge Deck` |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `648–655` | `P_CENTERS`: 8 улучшений карт (`Bonus`, `Mult`, `Wild`, `Glass`, `Steel`, `Stone`, `Gold`, `Lucky`) |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `658–662` | `P_CENTERS`: 5 изданий (`Base`, `Foil`, `Holographic`, `Polychrome`, `Negative`) |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `665–696` | `P_CENTERS`: 32 бустера (`Arcana`, `Celestial`, `Spectral`, `Standard`, `Buffoon`) |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `1862–2016` | `Game:init_game_object` — экономика, рейты магазина и все 12 комбинаций `hands` (`2001–2014`) |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `2018–2448` | `Game:start_run` — инициализация забега, модификаторы Stakes и челленджей |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `2618–2628` | `G.exp_times` (`xy`, `scale`, `r`, `max_vel`) и обновление движения |
| [game.lua](file:///d:/Proga/balite/reference/balatro_lua/game.lua) | `3072–3580` | Логика магазина (`update_shop`) и состояний открытия бустер-паков |
| [globals.lua](file:///d:/Proga/balite/reference/balatro_lua/globals.lua) | `1–522` | 19 состояний `STATES`, `GAMESPEED`, пропорции карт (`CARD_W`, `CARD_H`, `HIGHLIGHT_H`), палитра `C` |
| [challenges.lua](file:///d:/Proga/balite/reference/balatro_lua/challenges.lua) | `1–738` | 20 испытаний (`CHALLENGES`) со спецправилами |

### 2. Поведение карт, джокеров, ваучеров, блайндов, колод и тегов

| Файл | Строки | Что внутри |
| --- | --- | --- |
| [card.lua](file:///d:/Proga/balite/reference/balatro_lua/card.lua) | `369–386` | `Card:set_cost` — наценка изданий (`+2/+3/+5/+5`), скидки, `sell_cost = max(1, floor(cost/2))` |
| [card.lua](file:///d:/Proga/balite/reference/balatro_lua/card.lua) | `387–539` | `set_edition`, `set_seal`, стикеры `eternal` / `perishable` / `rental`, `set_debuff` |
| [card.lua](file:///d:/Proga/balite/reference/balatro_lua/card.lua) | `564–701` | `add_to_deck` / `remove_from_deck` — пассивные эффекты джокеров (`Juggler`, `Drunkard`, `Credit Card`, `Four Fingers` и др.) |
| [card.lua](file:///d:/Proga/balite/reference/balatro_lua/card.lua) | `950–1090` | Скоринг игральных карт: `get_id` (`Stone Card`), `is_face`, `get_chip_bonus`, `get_chip_mult`, `get_chip_x_mult`, эффекты удержания и конца раунда (`Gold`, `Blue Seal`) |
| [card.lua](file:///d:/Proga/balite/reference/balatro_lua/card.lua) | `1091–1589` | `use_consumeable` и `can_use_consumeable` — все эффекты 22 Таро, 12 Планет и 18 Спектральных карт |
| [card.lua](file:///d:/Proga/balite/reference/balatro_lua/card.lua) | `1590–1680` | `sell_card` и `calculate_dollar_bonus` (выплаты джокеров в конце раунда) |
| [card.lua](file:///d:/Proga/balite/reference/balatro_lua/card.lua) | `1681–1972` | `open` (открытие бустеров) и `redeem` / `apply_to_run` (все 32 ваучера) |
| [card.lua](file:///d:/Proga/balite/reference/balatro_lua/card.lua) | `2242–2290` | `calculate_seal` (`Purple Seal`), `calculate_rental`, `calculate_perishable` |
| [card.lua](file:///d:/Proga/balite/reference/balatro_lua/card.lua) | `2291–4063` | **`Card:calculate_joker`** — логика всех 150 джокеров по контекстам (`before`, `individual`, `repetition`, `joker_main`, `other_joker`, `after`, `discard`, `end_of_round`, `setting_blind`, `skip_blind`, `reroll_shop` и т.д.) |
| [blind.lua](file:///d:/Proga/balite/reference/balatro_lua/blind.lua) | `78–216` | `Blind:set_blind` — формула цели блайнда (`get_blind_amount * mult * ante_scaling`) и стартовые эффекты боссов |
| [blind.lua](file:///d:/Proga/balite/reference/balatro_lua/blind.lua) | `346–653` | `disable`, `press_play`, `modify_hand`, `debuff_hand`, `drawn_to_hand`, `stay_flipped`, `debuff_card` |
| [back.lua](file:///d:/Proga/balite/reference/balatro_lua/back.lua) | `108–278` | `Back:trigger_effect` (`Plasma`, `Anaglyph`) и `Back:apply_to_run` (эффекты всех 15+1 колод) |
| [tag.lua](file:///d:/Proga/balite/reference/balatro_lua/tag.lua) | `115–469` | `Tag:apply_to_run` — реализация всех 24 тегов за пропуск блайндов |

### 3. Математика, скоринг-пайплайн, PRNG и магазин (`functions/`)

| Файл | Строки | Что внутри |
| --- | --- | --- |
| [misc_functions.lua](file:///d:/Proga/balite/reference/balatro_lua/functions/misc_functions.lua) | `206–320` | Детерминированный PRNG: `pseudoshuffle`, `pseudorandom_element`, `pseudohash`, `pseudoseed`, `pseudorandom` |
| [misc_functions.lua](file:///d:/Proga/balite/reference/balatro_lua/functions/misc_functions.lua) | `376–622` | `evaluate_poker_hand` (включая вложенность рук `507–517`), `get_flush`, `get_straight`, `get_X_same`, `get_highest` |
| [misc_functions.lua](file:///d:/Proga/balite/reference/balatro_lua/functions/misc_functions.lua) | `919–966` | `get_blind_amount` (таблицы для Ante 1–8 и формула Endless для `ante > 8`) и `number_format` |
| [misc_functions.lua](file:///d:/Proga/balite/reference/balatro_lua/functions/misc_functions.lua) | `1868–1881` | `get_starting_params` |
| [state_events.lua](file:///d:/Proga/balite/reference/balatro_lua/functions/state_events.lua) | `1–353` | `win_game`, `end_round`, `new_round` |
| [state_events.lua](file:///d:/Proga/balite/reference/balatro_lua/functions/state_events.lua) | `355–569` | Добор, сброс (`discard`), розыгрыш (`play_cards_from_highlighted`), `get_poker_hand_info` |
| [state_events.lua](file:///d:/Proga/balite/reference/balatro_lua/functions/state_events.lua) | `571–1086` | **`evaluate_play`** — полный 7-этапный конвейер подсчёта очков и порядка срабатываний |
| [state_events.lua](file:///d:/Proga/balite/reference/balatro_lua/functions/state_events.lua) | `1135–1208` | **`evaluate_round`** — награда блайнда, `+\$1`/рука и расчёт процентов (`interest`) |
| [common_events.lua](file:///d:/Proga/balite/reference/balatro_lua/functions/common_events.lua) | `464–657` | `level_up_hand` и `eval_card` |
| [common_events.lua](file:///d:/Proga/balite/reference/balatro_lua/functions/common_events.lua) | `1944–2155` | `get_pack`, `get_current_pool` (редкости 70/25/5%, софтлоки), `poll_edition`, `create_card` |
| [common_events.lua](file:///d:/Proga/balite/reference/balatro_lua/functions/common_events.lua) | `2263–2383` | `calculate_reroll_cost`, сбросы целей (`Idol`, `Mail`, `Ancient`, `Castle`) и выбор боссов `get_new_boss` |
| [button_callbacks.lua](file:///d:/Proga/balite/reference/balatro_lua/functions/button_callbacks.lua) | `36–124`, `2155–2957` | Проверки покупки/открытия, `use_card`, `buy_from_shop`, `select_blind`, `skip_blind`, `reroll_boss`, `reroll_shop`, `cash_out` |
| [UI_definitions.lua](file:///d:/Proga/balite/reference/balatro_lua/functions/UI_definitions.lua) | `637–800`, `1252–1858` | Витрина магазина и `create_card_for_shop` (`742–800`), выдача тегов (`add_tag`), выбор блайндов, наполнение бустеров |

### 4. Кинематика карт, очередь анимаций и тексты

| Файл | Строки | Что внутри |
| --- | --- | --- |
| [engine/moveable.lua](file:///d:/Proga/balite/reference/balatro_lua/engine/moveable.lua) | `350–480` | Пружинное сглаживание `T` → `VT`, наклон от скорости `move_r`, масштаб при наведении/перетаскивании, параллакс |
| [engine/event.lua](file:///d:/Proga/balite/reference/balatro_lua/engine/event.lua) | `1–195` | `Event` (`immediate`, `after`, `ease`, `condition`, `before`) и `EventManager` |
| [cardarea.lua](file:///d:/Proga/balite/reference/balatro_lua/cardarea.lua) | `113–228`, `410–553` | Выделение до 5 карт, сортировка по рангу/масти и веерная укладка `align_cards` |
| [localization/ru.lua](file:///d:/Proga/balite/reference/balatro_lua/localization/ru.lua) | `1–4317` | Русские формулировки всех джокеров (`434+`), таро, планет, спектралок, ваучеров, тегов и боссов |
| [localization/en-us.lua](file:///d:/Proga/balite/reference/balatro_lua/localization/en-us.lua) | `1–4317` | Английские ключи и названия для сопоставления с `self.ability.name` в Lua-коде |

---

## Что намеренно НЕ скопировано из `balatro_unpacked`

* Вся папка `resources/` (текстуры `.png`, GLSL-шейдеры `.fs`, аудио `.ogg`, шрифты `.ttf`) — заменим собственной clean-room графикой и Web Audio.
* Поточные и платформенные менеджеры Love2D (`sound_manager.lua`, `save_manager.lua`, `http_manager.lua`, `controller.lua`, `profile.lua`, `string_packer.lua`, `ui.lua`, `text.lua`, `sprite.lua`, `particles.lua`, `node.lua`, `object.lua`, `animatedsprite.lua`, `card_character.lua`, `test_functions.lua`, `main.lua`, `conf.lua`).
* Остальные 13 файлов локализации (`de`, `es`, `fr`, `id`, `it`, `ja`, `ko`, `nl`, `pl`, `pt_BR`, `zh_CN`, `zh_TW`).
