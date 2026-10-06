# Бампери (6 с)

Бампер — 6-секундний спот: коротке інтро + одна оферта + аутро. Приклад REG: `…\NISKIE CENY\W40\compo\W40A_1_Bumper_Mrozonki_v01.aep` (також `…_Bumper_Obiadki_v01`, `…_Bumper_Tarczynski_v01`, `W40A_2_Bumper_Eden_v01`).

## Як робиться
- **Окремий проєкт AE** (копія основного спота, збережена під ім'ям `W<NN><A|B>_<N>_Bumper_<Offer>_v01.aep`), щоб правки бампера не впливали на основний спот.
- Використовується 6-секундний майстер із шаблону `BIEDR_REG_TXX_X_Produkt_6` (у фестивалях `BIEDR_FESTIWAL_WEDLIN_WXX_Produkt_6`). Кінець назви майстра `_6` = 6 с. **Літера частини обов'язкова:** `BIEDR_REG_T40A_1_Mrozonki_6` (а не `T40_1`).
- Підміняється відповідна оферта: залишається ввімкненою лише потрібна `Oferta N` (з цінівкою цього продукту), решта вимкнені, `Oferta 1` під нею не тримаємо.
- Окреме digital-аудіо для 6 с: `BIEDR_CNC_W40A_<NAZWA>_6_EMIS_DIGITAL_0DB_<date>.wav` (5,76 с), шаром 1; фестивалі: `BIEDR_FW_T40_6S_<OFFER>_EMIS_0DB_<date>_.wav`. Для пошуку аудіо брати `DIGITAL` та `6S`.

## Будова 6-с майстра REG (11 шарів)
аудіо (0–5,76 с), `OUTRO_SUPER_SHORT` (4,84–6 с), `Opening` (startTime −4,2: видно лише останні 0,88 с), `Blur_Przejscia_outro`, `Logo_ROG` (з 0,44 с), `Oferta 1..4` (усі з 0,44 с), `_Assety` і `Transition_bez_Ekspresji` (вимкнені).

## Практика W41 (02.10.2026): 4 бампери
Правило користувача: **з регуляра береш у регуляр, з фреша у фреш.** Аудіо за 01.10 лежить у `audio\20261001\BIEDR_CNC_BUMPER_W41A_<NAZWA>_6_EMIS_0DB_20261001.wav` (6,00 с; назв: MAKARONY, PRALINY, WEDLINY, SCHAB). Кожен бампер: копія проєкту-джерела з `compo` у `_ai_progress` (MD5 звірено), 6-с майстер уже є в проєкті (`BIEDR_REG_TXX_X_Produkt_6`, у FRESH `BIEDR_FRESH_TXX_X_Produkt_6`) і має `Oferta 1..4` (усі ввімкнені, з 0,44 с; у FRESH Opening довший: оферта з 0,4, `Logo_ROG` з 0,72).
| Бампер | Проєкт-джерело | Оферта | Майстер |
|---|---|---|---|
| Makarony | REG `W41A_1_Makarony_Kawa_Praliny_v01` | `Oferta 1` | `BIEDR_REG_T41A_1_Makarony_6` |
| Praliny | REG `W41A_1_Makarony_Kawa_Praliny_v01` | `Oferta 3` | `BIEDR_REG_T41A_1_Praliny_6` |
| Wedliny | REG `W41A_2_Ser_Wedliny_Reczniki_v04` | `Oferta 2` | `BIEDR_REG_T41A_2_Wedliny_6` |
| Schab | FRESH `W41A_1_Wedliny_UdoPodudzie_Schab_v02` | `Oferta 4` (лада) | `BIEDR_FRESH_T41A_1_Schab_6` |
Файли: `W41A_1_Bumper_Makarony_v01.aep`, `W41A_1_Bumper_Praliny_v01.aep`, `W41A_2_Bumper_Wedliny_v01.aep` (у `NISKIE CENY\W41\compo\_ai_progress`), `W41A_1_Bumper_Schab_v01.aep` (у `FRESH\W41\compo\_ai_progress`).
Кроки через MCP: `item.set_props item:<id> name:…` (перейменування), `layer.set_enabled` для зайвих `Oferta N`, `project.import_file` аудіо, `item.move_to_folder` у `_AUDIO`, `layer.create_footage comp sourceItemId` (нова шарова позиція одразу зверху, перевпорядковувати не треба), `ae_render_frame` на 0,2 / 1 / 2 / 3,5 / 5 / 5,8 с з `contactSheet {columns:3}` для перевірки. 30-с майстер у проєкті лишаю як є (копія). Візуально перевірено всі чотири. У Praliny у legal цінівки видно «do 10.08.2026» замість 10.10 (помилка в PSD агенції, не правив).
**Рендер бамперів (схема з T40, підтверджено папкою від продюсера 02.10.2026):** `X:\BiedronkaPricesOnGoing2026_231510\finals\T<NN>\DIGITAL_<NN>A_6\<ІМ'Я АУДІО без .wav до _EMIS>\<майстер>\<майстер>_[#####].dpx`. Продюсер створює `DIGITAL_41A_6` і в ній підпапки за назвою аудіо (`BIEDR_CNC_BUMPER_W41A_<NAZWA>_6`) з wav усередині; кадри йдуть у підпапку з назвою майстра поруч із wav. `Base Path` = `…\DIGITAL_41A_6\BIEDR_CNC_BUMPER_W41A_<NAZWA>_6`, `Subfolder Path` = майстер. mp4 у корені `DIGITAL_…` робить хтось інший. Черга: Best Settings, DPXseq, Work Area Only 0–6 с (150 кадрів: аудіо тепер 6,00 с, не 5,76 як у W40, де було 144 кадри), одна черга на проєкт. Відрендерено 02.10.2026 (за командою користувача я запустив `render.start` сам: 150 dpx у кожній папці), проєкти скопійовано в `compo`; `Winogrona` GANG лежить у цій же папці, його не чіпаємо.

### Бампер Świeżaki (GANG, Winogrona), 02.10.2026
Проєкт `X:\BiedronkaSwiezaki2026_231584\vfx\shots\W41\compo\_ai_progress\W41A_1_Bumper_Winogrona_v01.aep` (копія `W41A_1_Winogrona_Ziemniaki_v01`; `_ai_progress` у цьому корені не існувала, створив). У проєкті є готовий 6-с майстер `Bumper_6` (папка `_MASTERs`; шари: `transition_znc_02.mov`, `OUTRO_SUPER_SHORT`, `Adjustment Layer 20`, `Logo_ROG`, `Oferta 1`, `Oferta 2`; у шаблоні ввімкнена `Oferta 2`). Робота: `comp.duplicate comp:4096 newName:GANG_T41A_1_WINOGRONA_6` → ввімкнути `Oferta 1` (виноград — перший продукт спота), вимкнути `Oferta 2`, аудіо `BIEDR_GANG_W41A_WINOGRONA_6s_EMIS_DIGITAL_0Db_20260924.wav` (5,76 с, **144 кадри**, той самий wav, що й у W40) шаром 1. Назва майстра за зразком W40 `GANG_T40A_1_WINOGRONA_6` (без `BIEDR_`).
Рендер за схемою W40: **у корені PricesOnGoing**, у папці винограду: `X:\BiedronkaPricesOnGoing2026_231510\finals\T41\DIGITAL_41A_6\BIEDR_GANG_W41A_WINOGRONA_6\GANG_T41A_1_WINOGRONA_6\GANG_T41A_1_WINOGRONA_6_[#####].dpx`, Work Area Only 0–5,76 с.

## Порядок дій (коли користувач попросить)
1. Копія основного проєкту → `…_Bumper_<Offer>_v01.aep`.
2. Перейменувати 6-с майстер за зразком вище.
3. Підмінити оферту: ввімкнути потрібну `Oferta N`, вимкнути решту.
4. Підставити 6-с digital-аудіо.
5. Решту (опенінг, `Logo_ROG`, outro) лишити як у шаблоні. Збереження в пісочниці.

Поки користувач пояснює суть, нічого не збирай у продакшн-папках.

## ПРАВИЛО: бампер = 144 кадри (користувач, 02.10.2026)
Бампери рендеряться **144 кадри (0–5,76 с, `…_00000`–`…_00143`)**, а не 150. Робоча зона 6-с майстра `0 … 5,76` (`comp.set_work_area start:0 duration:5.76`), `Work Area Only`. Аудіо бампера може бути 6,00 с, кадри після 5,76 с не потрібні. W41 бампери (Makarony, Praliny, Wedliny, Schab) були відрендерені на 150 кадрів; 02.10.2026 за командою користувача видалено рівно `…_00144`…`…_00149` в кожній папці (перевірено: 150 → 144, wav на місці). Винятків для Winogrona нема (вже було 144, 5,76 с). Проєкти бамперів у `_ai_progress` і `compo` мають робочу зону 0–6 с у черзі, при наступній перерендерці виставити 5,76.

## Шаблони з робочою зоною 5,76 с (02.10.2026)
У шаблонах 6-с майстри мають робочу зону `0…5,76 с` (144 кадри). Нові версії (старі лишились без змін): **REG `NISKIE CENY\_TEMPLATE\Template_SPOT_v09.aep`** (майстер `BIEDR_REG_TXX_X_Produkt_6`), **FRESH `FRESH\_TEMPLATE\Template_SPOT_Fresh_v11.aep`** (майстри `BIEDR_FRESH_TXX_X_Produkt_6` і старий REG-майстер у ньому), **Świeżaki `…\BiedronkaSwiezaki2026_231584\vfx\shots\_template\compo\Template_spot_5.aep`** (майстер `Bumper_6`). Нові споти й бампери брати з цих версій. Проєкти бамперів W41 (Makarony, Praliny, Wedliny, Schab в `_ai_progress` і `compo`, Winogrona в `_ai_progress` Świeżaki) теж мають зону 5,76; старі `compo`-файли бамперів збережені в `_ai_progress\_backup\…_compo-before-workarea576_20261002.aep`.

## Бампери T41B (06.10.2026, запит Agnieszka Smolińska: «poniżej 150 klatek», тобто 144)
У Teams: 1× F&V banany, 1× MEAT schab, 3× REG bakalie / rafaello / dallmayr lub colgate (залежить від аудіо). Підготовлено без аудіо й без рендеру (джерело = копія з `compo`, MD5 звірено, у `_ai_progress`):
| Бампер | Файл | Оферта | Майстер |
|---|---|---|---|
| Bakalie (Bakador) | `NISKIE CENY\W41\compo\_ai_progress\W41B_1_Bumper_Bakador_v01` | `Oferta 1` | `BIEDR_REG_T41B_1_Bakador_6` |
| Rafaello | `…\W41B_2_Bumper_Raffaello_v01` | `Oferta 3` | `BIEDR_REG_T41B_2_Raffaello_6` |
| Dallmayr / Colgate (обидва, потім зайвий прибрати) | `…\W41B_2_Bumper_Dallmayer_v01`, `…_Colgate_v01` | `Oferta 1` / `Oferta 2` | `BIEDR_REG_T41B_2_Dallmayer_6`, `…_Colgate_6` |
| Schab | `FRESH\W41\compo\_ai_progress\W41B_1_Bumper_Schab_v01` (з compo `W41B_1_Bakador_Schab_Szynka_v01` від 05.10) | `Oferta 2` (VAC) | `BIEDR_FRESH_T41B_1_Schab_6` |
| Banany (F&V) | `X:\BiedronkaSwiezaki2026_231584\vfx\shots\W41\compo\_ai_progress\W41B_1_Bumper_Banany_v01` (з `W41B_1_Winogrona_Banany_v01`) | `Oferta 2` у `Bumper_6` → дубль `GANG_T41B_1_BANANY_6` | `GANG_T41B_1_BANANY_6` |
Робота в кожному: перейменувати 6-с майстер, залишити одну `Oferta N` (решта вимкнені), `comp.set_work_area start:0 duration:5.76` (у проєктах зі старого шаблону v08 зона була 0–6), перевірка кадрів 0,3 / 2,5 / 4,5 / 5,7. `W41B_1`/`W41B_2` проєкти ще з v08, тому зона 0–6 → виправляти. Аудіо digital для B ще не надійшло.

### DN у бампері (Raffaello W41B_2, 06.10.2026) і правка legal
- **Лого в куті в бампері:** `Logo_ROG` спільний із 30-с майстром, тому для бампера дублюю його (`comp.duplicate 11111 → Logo_ROG_bumper`), підміняю джерело шару `Logo_ROG` у 6-с майстрі (`layer.replace_source`, шар сам перейменується) і правлю ключі лише в дублі. Час у `Logo_ROG` = час майстра − 0,44 (шар стартує з 0,44). Цикл для 6-с (Swivel): стікер 0,64 (−90) → 1,28 (0, hold) → 2,78 (0) → 3,42 (90, hold); `LOGO_PingPong` 0 (0) → 0,64 (90, hold) → 3,42 (−90) → 4,06 (0, hold). Червоний лого знову на місці до ≈4,5 с (майстер) перед блюром/outro; стікер `startTime`/`inPoint` 0,64.
- **Правка тексту в legal Dallmayr** (`ibez` → `i bez`): `layer.copy_to_comp` легал-шару в активний комп (`WEDLINY_SER_Precomp`), `command.execute 3799`, `text.paste_range` із заміною 1 символу `i` на 2 символи `i ` з іншого місця того ж тексту (`wartości `, стиль збігається; довжина діапазонів може бути різною). Повернення в `Oferta` + старий шар вимкнути й `layer.set_guide`. У самому споті `W41B_2` (вже відрендерений) не чіпала.
- **Побажання користувача (06.10.2026):** у бампері анімація лого в куті не має стартувати одразу, початкові ключі зсунуті пізніше (він сам виправив у `W41B_2_Bumper_Raffaello_v01`). Наступні бампери з DN ставлю початок циклу пізніше (напр. S ≥ 1,0 с у часі `Logo_ROG`). Перед будь-якою правкою цього файла перечитую його з диска, його правки не відкочую.
