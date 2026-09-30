# REG (NISKIE CENY): повна схема

Шаблони `…\NISKIE CENY\_TEMPLATE\`: `Template_SPOT_v08.aep` (спот), `Template_PRODUCTS_v03_AE2026.aep` (візка). Споти в `W<NN>\compo`, візки в `W<NN>\dmp`. Актуальна пісочниця з шаблоном лежить у `…\vfx\temp\AI_TEST\`.

## Зведення кроків
1. **Копія і імена.** `W41A_1_Makarony_Kawa_Praliny_v01.aep`; майстер `BIEDR_REG_T41A_1_Makarony_Kawa_Praliny_30` (перейменування комп: `project.rename scope:items itemTypes:["CompItem"] map:{...}`). Другий майстер у шаблоні `BIEDR_REG_TXX_X_Produkt_6` — 6-с, для бамперів.
2. **Цінівки.** Імпорт `compRetainLayerSizes` → комп `W41A_Makarony_v03` + папка `… Layers` → обидва в `_CENOWKI` (id папки шукай `item.list type:FolderItem nameContains:_CENOWKI`). Назви файлів різні (`Kawy` ↔ Kawa), версії `_vNN`.
3. **Структура PSD-компу** (різна між продуктами, шукай за ознаками): `nowy mieszaj` (стікер MD у PSD), `data OK`/`data` (comp), legal (шар `Limit dzienny…`, `*Przy zakupie…`, `Oferta obowiązuje…`), `mechanizm` або `X+X GRATIS KA 1` (comp з механізмом і KA), `plansza` (comp: `…_Alpha` + `…_Blat_Tlo`).
4. **Копії в Oferta:** `layer.copy_to_comp` з PSD-компу (data, legal), з comp механізму (`mechanizm NEW` чи `Inteligentny obiekt wektorowy`/`XX procent taniej`), з `plansza` (`…_Alpha`). Позиції в PSD = координати Oferta (компи однакового розміру), тому копії стають на місце.
5. **Cenowka** (comp `Cenowka`, анімація карти/апки): увімкнути, Position = позиція шару KA (`z KiA kopia 2`/`KA kopia 3`) ≈ **1412/137** (у Schab KA вимкнена, тоді Cenowka не додавати). Власний таймінг і Time Remap не міняти.
6. **MD** (comp `MD`, `inPoint` 0,4 с): Position = позиція `nowy mieszaj` + (−0,24; −2,42), scale ≈ 66,2% (у шаблоні 66,19 або 66,60). Приклади nowy mieszaj: Makarony 847/155, Kawy 922/186, Praliny 847/123, Mielone 813/173.
7. **Стіл:** `Blat_Niskie_Ceny.png` Position 960/**586**, scale 54,857%, з маскою шаблону. У всіх оферт REG однаковий; край стільниці ≈597 px.
8. **Фон:** один увімкнений шар під заблокованим `TLA Warstwy ukryte`. Таблиця: Makarony → `MAKI_MAKARONY`, Kawa → `KAWA_HERBATA_Precomp`, Praliny → `SLODYCZE`, інші за змістом; у шаблоні можуть бути увімкнені зайві (напр. `SLODYCZE`, `KONSERWY`), вимикай.
9. **Людина:** в комп-фоні шар `woman_NN`/`man_NN` з `NOWE ROTO` (`vfx\assets\BEAUTYSHOT_TLA\2026\NOWE_ROTO\`). Чергувати жінка/чоловік. Якщо шару нема (напр. `KAWA_HERBATA_Precomp` має лише `woman_03` вимкнену, а потрібен чоловік) — `layer.create_footage` з `man_01.mov` верхнім шаром із позицією за замовчуванням.
10. **Beautyshot:** див. нижче. **Аудіо:** `audio\YYYYMMDD\BIEDR_CNC_REG_W41A_1_<PRODUCTS>_EMIS_TV_-23LUFS_<date>.wav`, вибір за кількістю співпадіння оферт, довжиною 30 і номером спота; береться найновіший за часом файлу, бо дата в назві ненадійна.

## Майстер (як виглядає готовий)
Шари зверху: аудіо (0–30 с), `Transition_LOGO_05` (вхід в outro, 24,64 с), `OUTRO_SUPER_SHORT`, `Opening` (0–6,04 с), `Transition_LOGO_01–04`, `Blur_Przejscia_outro`, `Outro_Beautyshot`, `Logo_ROG`, `AI_LEGAL.png` (вимкнений), `KONTROLA CENOWEK` (заблокований), `Oferta 4`, `Czwarty_Beautyshot`, `Oferta 3`, `Trzeci_Beautyshot`, `Oferta 2`, `Drugi_Beautyshot`, `Oferta 1`, `Pierwszy_Beautyshot`. Oferta N лежить над своїм beautyshot. Типові старти (W41A_1 оригінал): Oferta 1/2/3 = 7,48 / 11,68 / 18,88 с, по 10 с; Transition_LOGO_01 11–12,2 с; `_05` 24,64–25,76 с; `Logo_ROG` 4,76–25,76 с.

## Монтаж по голосу (робить користувач, я знаю правила)
- Перед Oferta 1 — завжди beautyshot; Oferta 1 входить на слово «Wszystkie» (або на згадці оферти).
- Перед Oferta 2/3: одне-два короткі слова («a», «a do środy») → короткий `Transition_LOGO` (використовується один, рухається `_01`): маркер переходу (0,68 с від старту шару) = старт оферти, startTime = старт оферти − 0,68 с, тривалість 1,2 с. Ціла фраза → beautyshot.
- **Або перехід, або beautyshot, не обидва:** якщо перехід, відповідний beautyshot вимкнути; якщо beautyshot, короткого переходу перед нею нема. Beautyshot лежить **під** Oferta N.
- Невикористані `Transition_LOGO_NN` — вимкнути і поставити на 0-й кадр (не за межі майстра).

## Beautyshot
Кожен `*_Beautyshot` комп має ~48–49 кліпів, усі ввімкнені; потрібний вибирається `solo`. Спершу `layer.set_props layer:"all" props:{solo:false}`, далі `solo:true` на потрібному. Приклади: Makarony → `Fussini.mov`, Praliny → `Czekolady_Range.mov`, Kawa → `Kawa_Range.mov`/`Kawa.mov`, Wedliny → `Szynka.mov`, Mielone → `Miesa_VAC.mov`, **лада → шар 46 (`LADA_Miesna`)**. Композиція beautyshot — 200 кадрів (`comp.set_props props:{duration:8}`), клипи не розтягувати. Beautyshot замість короткого переходу: вікно 1,2 с, startTime = старт оферти − 0,68 с (після узгодження з користувачем).

## Оновлення цінівки
Нова версія = імпорт в `_CENOWKI`, стара (комп + `Layers`) в `_OLD`; потім у `Oferta` підмінити джерела шарів, які брались з цінівки (`layer.replace_source`: legal, data, механізм, візка, прев'ю) і стікер в асет-компі (`references/stickers.md`), перевірити розмір/позицію рендером.

## Помилки PSD агенції, про які варто казати користувачу
У legal Praliny і Wedliny W41 було «do 10.08.2026» замість 10.10; у Kawa (W40B) «Kawy_v02.jpg» без psd тощо. Legal переноситься як є, тож сигналізуй.
