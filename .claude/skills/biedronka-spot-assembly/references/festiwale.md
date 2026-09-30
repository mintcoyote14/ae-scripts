# Фестивалі FN (Festiwal Nabiału) і FW (Festiwal Wędlin)

Корінь `X:\BiedronkaZawszeNiskieCeny2026_232084`; `vfx\shots\FESTIWAL_NABIALU`, `FESTIWAL_WEDLIN`; тижні W35–W40; **без літер частин A/B**. Цінівки/візки в `client\YYYYMMDD_CENOWKI` та `…_WIZKI` цього проєкту; `output` у корені немає; аудіо `audio\YYYYMMDD`.

## Суть (користувач)
Вкласти цінівки в оферти як у REG; фони інші (відео-фони, `paper_bg.png`), а **переходи зроблені на експрешенах** — їх не чіпай (`Adjustment Layer 1` і `logo_animation 2`, обидва заблоковані та shy).

## Правила, підтверджені користувачем
- Візку брати **з цінівки** (шар `…_Alpha` у PSD, як у REG), а не окремий PNG з dmp/output.
- Назва майстра з **T**: `BIEDR_FESTIWAL_WEDLIN_T40_Boczek_Wedliny_30` (у готовому споті `W40`, це виправляти на `T`).
- `MD` вмикати за правилом REG (є `nowy mieszaj` у цінівці → MD).
- Я збираю `Oferta` за цінівкою; монтаж і переходи робить користувач.

## Файли
- `W<NN>\dmp\W40_FW_<Offer>_vNN.aep` (візки, 1–2 МБ); `W<NN>\compo\W40_FW_<Offer1>_<Offer2>_vNN.aep` (спот на **2 оферти**); бампери окремими проєктами `W40_FW_BUMPER_<Offer>_v01.aep` (FN: `W36_FN_Bumper_…`, `BUMPERY_…`).
- Шаблони `_TEMPLATE`: FW — `FW_TEMPLATE_Spot_v01.aep` (24.09), `Festiwal_WEDLIN_TEMPLATE_PRODUCT_v01.aep`; FN — `Festiwal_Nabialu_TEMPLATE_SPOT_v02.aep` (03.09), `…_PRODUCT_v01.aep`.
- Аудіо: `BIEDR_FW_T40_1_WEDLINY_BOCZEK_EMIS_TV_-23LUFS_20260923.wav` (порядок у назві аудіо не завжди як у спота); 6-с: `BIEDR_FW_T40_6S_<OFFER>_EMIS_0DB_<date>_.wav` (по одному на оферту-бампер).

## Майстер FW (приклад `BIEDR_FESTIWAL_WEDLIN_W40_Boczek_Wedliny_30`)
30 с, 11 шарів: аудіо, `outro_logo_stroke_01.mov` (28,84 с), `Adjustment Layer 1` (експрешен-перехід, заблокований), `logo_animation 2`, outro-beauty футаж, `Oferta 01` (11 с), `Oferta 02` (17,48 с), `fest animation` (24,16–29,96 с), `footage` (опенінг-футаж 2,88–11 с), `opening` (startTime −3,76), `paper_bg.png` (вимкнений). 6-с шаблон `BIEDR_FESTIWAL_WEDLIN_WXX_Produkt_6` (7 шарів: `outro_logo_stroke`, `Adjustment Layer 1`, `logo_animation 2`, `Oferta 01`, `Oferta 02`, `fest animation`, `paper_bg`).

## `Oferta 01` (FW, готовий приклад id 282)
Шари: прев'ю-комп цінівки `FW_W40_Wędliny_v04`, legal `Limit dzienny…`, `data`, `MD` (вимкнений; вмикати за правилом), `Cenowka 04`, візка PNG `W40_FW_Wedliny_v03.png` (у нашому процесі замінюється візкою з PSD), фон-відео `wedliny`/`kielbasy` (magnific mp4, ввімкнений лише один), `paper_bg.png` (заблокований), `_Assety w przestrzeni`. Схема оформлення: як REG (прев'ю 50% + guide, data, legal, візка `…_Alpha`, механізм, Cenowka, MD), фон-відео за продуктом.

## Відкрито
Стіл/фон/людина у фестивалях, вибір відео-фону для молочки (FN) і порядок оферт у майстрі FN ще не опрацьовані; при першій збірці покажи план і звір з користувачем.
