# Таблиця CNC 2026 і проєкти

## Як читати
Google Sheets id `14sx3NGmiSQVzUtOWI2aBmjG_xbHPhfWlQWPSDVFwvw4`. Коннектора Sheets нема, тому читаю через Chrome (`claude-in-chrome`, у логіні користувача): у вкладці таблиці через `javascript_tool` роблю `fetch('https://docs.google.com/spreadsheets/d/<id>/gviz/tq?tqx=out:csv&sheet=<назва вкладки>', {credentials:'include'})` і парсю CSV. Брати **за назвою аркуша**, не за gid (gid у виводі блокується як «query string»); клік по вкладці URL не змінює. Вивід JS обрізається ~1000 символів, тож віддавай по 10–15 рядків. Після роботи закрий вкладку (`tabs_close_mcp`).

## Вкладки тижня
- **`CNC T<NN> oferty`** — складання **візок** (`dmp`): продукт, тексти цінівки, колонка M WIZKI, колонка N UWAGI (з якого тижня брати візку; лінки transfernow = нові матеріали, вручну).
- **`CNC T<NN> TVC`** — складання **спотів** (`compo`): колонки `nazwa spotu` (`REG_T41A_1`, `FRESH_T41A_1`, `GANG_T41A_1`), `produkt 1/2/3(/4)`, дата здачі, примітки (напр. «(DN)» = Dzień Nauczyciela). Порядок продуктів у назві проєкту = порядок колонок.
- У CSV рядки можуть зсуватись на 1 відносно екрана; знаходь продукт за текстом у колонці C.

## Три шоу у таблиці
- **REG** — звичайні оферти, 2 споти на частину (`_1_`, `_2_`).
- **FRESH** — м'ясо, риба + іноді одна оферта з REG (залежить від замовлення). Колонка A блоку каже частину A або B цільового тижня.
- **GANG** — овочі й фрукти (Świeżaki).
Фестивалі FN/FW та бампери не в цій вкладці.

## Частини тижня
A — перша половина тижня (матеріали здаються першими, напр. 30/09), B — кінець тижня (здаються пізніше, напр. 5/10). Weekend завжди на тиждень менше (коли решта W39, Weekend = W38).

## Корені проєктів на X:
- REG і FRESH: `X:\BiedronkaPricesOnGoing2026_231510\vfx\shots\2026\NISKIE CENY\W<NN>\{dmp,compo}` і `…\FRESH\W<NN>`; клієнт `…\client\{NISKIE CENY,FRESH}\YYYYMMDD_CENOWKI\HHMM`; вихід `…\output\NISKIE_CENY|FRESH\YYYYMMDD\<Offer>_vNN\{Alpha,Blat_Tlo,Full}.png`; аудіо `…\audio\YYYYMMDD\`.
- Świeżaki: `X:\BiedronkaSwiezaki2026_231584`.
- Фестивалі: `X:\BiedronkaZawszeNiskieCeny2026_232084` (`FESTIWAL_NABIALU`, `FESTIWAL_WEDLIN`).
- Weekend: `X:\BiedronkaWeekend2026_231673`.

## Вихід візок
Кожна візка (`dmp`) віддається трьома PNG: `_Alpha` (продукт на альфі), `_Blat_Tlo` (стіл + фон), `_Full` (як виглядає). Версії ростуть від правок (v01 йде агенції першою). Копія `_Alpha` кладеться в `vfx\_out\Plansze_Do_Spotu\<ШОУ>\W<NN>\` (її підхоплює IMPORT-скрипт). У PSD агенції ці PNG уже вбудовані як шари `…_Alpha` і `…_Blat_Tlo` (вони показують, яку версію візки використала агенція).

## Правила переносу візок (з пам'яті `biedronka-wizki-rules`)
Автоматизуються лише уваги в межах того самого шоу; уваги на інші проєкти й transfernow-лінки — руками. Літера в увазі: A/B = CNC (FRESH/NISKIE CENY), C = Weekend. Частину A/B брати з блоку таблиці, а не з назви базового проєкту.
