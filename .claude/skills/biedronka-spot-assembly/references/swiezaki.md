# GANG / Świeżaki (фрукти й овочі)

Корінь `X:\BiedronkaSwiezaki2026_231584`. Шаблон `vfx\shots\_template\compo\Template_spot_4.aep` (найновіший, 29.09; `_2`, `_3` старі). Споти `vfx\shots\W<NN>\compo\W41A_1_<P1>_<P2>_v01.aep` (напр. `W41A_1_Jablka_Ziemniaki`, `W41A_1_Winogrona_Ziemniaki`): **2 оферти** (TVC `GANG_T41A_1`). `dmp` порожня (візки рахуються в PricesOnGoing `Plansze_Do_Spotu\FRESH`). Цінівки з `client` самого Świeżaki (`YYYYMMDD_CENOWKI`, PSD `GANG_W41A_<Offer>_vNN.psd` чи `W41A_<Offer>_vNN.psd`, часто в розпакованих zip-ах) або з `client\FRESH`.

## Майстри в шаблоні (`_MASTERs`)
Тематичні готові споти: `Welcome`, `Spring`, `Nowalijki`, `Regular`, `Polish_Orchards`, `Soft fruits`, `Stone fruits`, `Bumper_6`, плюс збірний `BIEDR_GANG_T40A_1_JABLKA_ZIEMNIAKI_30`. Кожна тема має свій опенінг (футажі `vfx\assets\_Skladowe\_beauty\bgsw_*` Welcome, `bgsn_*` Nowalijki, `bgsr_*` Regular, `bgss_*`, `bgsf_*`, `Polish_Orchards_*`, `Stone_Fruits_*`) і outro (наприклад `jablko_ziemniak.mov`).
**Тему вибирає те, які фрукти/фігурки будуть на цінівках:** дублюю відповідний майстр і перейменовую за зразком `BIEDR_GANG_T41A_1_<P1>_<P2>_30` (продукти у верхньому регістрі, як у `…T40A_1_JABLKA_ZIEMNIAKI_30`). Якщо тема невідома — спитай користувача.

## Фігурки
У шаблоні 2 анімовані фігурки (`vfx\assets\_Skladowe\postaci_do ofert\`: `Jablko.mov`, `Ziemniak.mov`, `Sliwka_v02.mov`, `Winogrona.mov`, `Truskawka.mov`, `borowka.mov`…), під них підлаштовані інтро/аутро. **Фігурки лишаються від шаблону**, навіть якщо оферта з іншим продуктом (виноград із фігуркою яблука — правильно). Оферти (інші фрукти/овочі) додаються лише з цінівками.

## Структура споту (готовий W41A_1)
Шари майстра: аудіо `BIEDR_GANG_T40A1_<…>_EMIS_TV_-23LUFS_<date>.wav`, `transition_znc_02.mov`, `Logo_ROG`, `Transition_LOGO_01–04`, `AI_LEGAL.png` ×2, `OUTRO_SUPER_SHORT`, outro-футаж, `Oferta 2`, `Oferta 1`, опенінг `bgsw_*`, `Biedronka_Autumn_veggies…dpx`. `Oferta 1` (14,36 с) і `Oferta 2` (20,4 с). Офер-комп: фігурка (`Jablko.mov`×2 або `Ziemniak.mov`), `produktpolski 2`, `Blat_Swieze.png`, фони `Owoce`/`Warzywa`/`Mieso_*`/`Ryby`, цінівка-комп.

## Схема
Далі так само, як у REG/FRESH: вкладаю елементи цінівки (data, legal, візка, механізм, MD, Cenowka, стікер) в `Oferta N`, комп цінівки не чіпаю. Стіл `Blat_Swieze.png`, фон `Owoce` для фруктів і `Warzywa` для овочів. Перевіряти рендером проти PSD-компу.
