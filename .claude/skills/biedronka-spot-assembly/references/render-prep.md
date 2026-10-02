# Підготовка споту до рендеру (REG, DPX)

Користувач сам тисне Render (виняток лише для візок, див. `carry-over.md`). Так готувати й надалі (підтверджено 01.10.2026). **Лише якщо користувач прямо попросить запустити рендер, спершу переконуюсь, що спот вийде в правильну папку:** `render.status`/`render.get_settings`: шлях `finals\T<NN>\<ШЛЯХ-ПАПКА>\<майстер>\…`, `Subfolder Path` = ім'я майстра, у черзі лише цей пункт (без старих шляхів), тиждень і частина в шляху збігаються з проєктом; тоді `render.start` і нагадую, що смуги прогресу в AE не буде. Я готую чергу в тому проєкті, який він змонтував (правки прямо в `compo`, якщо він дозволив). Приклад від користувача (W41B_1, 01.10.2026).

## Що зробити
1. **Скинути зайві пункти черги** (`render.clear_queue`) і додати лише майстер-комп споту (`render.add_to_queue comp:<id майстра>`).
2. **Render Settings:** `Best Settings`; **Output Module:** шаблон `DPXseq` (DPX/Cineon Sequence, RGB, `Starting #` 0); Log: Errors Only. **Time Span ОБОВ'ЯЗКОВО `Work Area Only`** (не `Custom`!): на W41B_2 я виставив `Custom 0–30` через `timeSpanStart/Duration`, і «Duplicate with file name» рендерив увесь спот замість виділеної частини (виправлено 01.10.2026). Тому в `render.set_output` НЕ передавати `timeSpanStart/timeSpanDuration`; викликати `comp.set_work_area start:0 duration:<тривалість>` і `render.set_settings settings:{"Time Span":"Work Area Only"}`. Пункти у стані DONE не редагуються: щоб виправити, видалити їх (`render.remove_item`) і додати новий пункт.

### Поправки в уже відрендереному споті (часткова перерендерка)
Коли в споті щось змінили, треба перерендерити лише змінені кадри. Робота розподілена так:
1. Я визначаю **візуально видиму частину, де відбулась зміна** (порівнюю кадри до/після, `ae_render_frame`, `compare_frames.ps1`), беру її `in` і `out` та додаю **5 запасних кадрів на початку і в кінці** (25 fps → 0,2 с): `workAreaStart = max(0, in − 0,2)`, `workAreaDuration = (out − in) + 0,4`, не виходячи за 0–тривалість споту.
2. Виставляю цю робочу зону майстер-компу: `comp.set_work_area comp:<майстер> start:<..> duration:<..>`, зберігаю проєкт.
3. **Скрипт не виконує справжню «Duplicate with file name», тому я зобов'язаний перевірити, що рендер піде в те саме місце** (вимога користувача 01.10.2026). Обов'язкові перевірки до `render.start`: (а) `Full Flat Path`, `Base Path`, `Subfolder Path`, `File Name`, `File Template` дубліката **символ у символ** збігаються з оригінальним пунктом; (б) цільова папка вже існує й містить кадри (`Get-ChildItem`, лише читання): запам'ятовую кількість файлів і `LastWriteTime` діапазону кадрів; (в) `Use Comp Frame Number` = true, `Starting #` = 0, `Skip Existing Files` = false, тож кадр `N` (час×25) перезапише файл `…_[0000N].dpx`, а не створить новий; (г) очікуваний діапазон файлів (початок робочої зони ×25 … кінець ×25) обчислений наперед. Якщо будь-що розходиться, не рендерю: виправляю шлях (`render.set_output`/`set_om_settings`) і перевіряю знову або питаю користувача. **Після рендеру:** кількість файлів у папці та їхні імена не змінились (нових файлів нема), оновився `LastWriteTime` лише в очікуваному діапазоні, решта кадрів не чіпані; звіт користувачу.
4. Рендер часткової зони. Два варіанти:
   - **робоча схема за замовчуванням (підтверджено користувачем 01.10.2026):** я роблю правки, відокремлюю видиму змінену частину (робоча зона з запасом), **повідомляю користувачу діапазон**, а він сам робить дублікат з іменем і пускає рендер. Сам запускаю лише якщо він прямо скаже «зроби сам» (тоді за варіантом нижче з усіма перевірками). Користувач пускає **Duplicate with file name**; оскільки пункт має `Work Area Only`, дублікат рендерить лише робочу зону й **перезаписує тільки змінені кадри** (нумерація за кадрами компу, `Use Comp Frame Number`);
   - **після явного підтвердження користувача («правки підтверджую»)** це роблю я (дозвіл від 01.10.2026): точної команди меню «Duplicate with file name» скриптом не викликати (її нема серед `command.find`), тому відтворюю її: `render.duplicate_item queueIndex:<пункт майстра>` (дублікат успадковує `Work Area Only` і той самий вивід), потім **перед стартом перевіряю** `render.status`/`render.get_settings`: `Time Span` = `Work Area Only`, робоча зона = зона поправки (0,2 с запасу з боків), шлях і `Subfolder Path` ті самі, що в оригінального пункту (`finals\T<NN>\<ШЛЯХ-ПАПКА>\<майстер>\`, правильний тиждень і частина), дублікат ввімкнений, оригінальний DONE-пункт не ввімкнений; лише тоді `render.start` (великий `timeoutMs`; в AE не буде смуги прогресу, UI заблокований до кінця) і звіт: які кадри (діапазон) і скільки файлів оновилось (mtime). Без явного підтвердження рендер не запускаю.
5. Після перерендерки повернути робочу зону на весь спот (`start:0 duration:30`) і зберегти проєкт.
Без дозволу користувача нічого в уже відрендереному споті не міняю ([[biedronka-dont-edit-rendered-spots]]).
3. **Шлях виводу:** `X:\BiedronkaPricesOnGoing2026_231510\finals\T<NN>\<ШЛЯХ-ПАПКА>\<ім'я майстер-компу>\<ім'я майстер-компу>_[#####].dpx`
   - `<ШЛЯХ-ПАПКА>` = `BIEDR_REG_<NN><A|B>_<номер споту>_<тривалість>` (де **останнє число = тривалість споту в секундах**: 30 для спота, 6 для бампера), напр. `BIEDR_REG_41B_1_30`, `BIEDR_REG_41B_2_30`. Для FRESH `BIEDR_FRESH_W41A_1_30`.
   - Папку `finals\T<NN>\<ШЛЯХ-ПАПКА>` створюю, якщо її нема (`render.set_output` теж створює папки виводу; не вигадувати тестові імена).
   - **Кадри йдуть у підпапку з назвою майстер-компу** («Save in subfolder»): в `Output File Info` це `Base Path` = `…\finals\T41\BIEDR_REG_41B_1_30`, `Subfolder Path` = ім'я майстер-компу, `File Name` = `<майстер>_[#####].dpx`, `File Template` = `<майстер>\<майстер>_[#####].[fileExtension]`.
4. Збережений проєкт; користувач тисне Render. Статус перевіряю `render.status` (DONE, час).
5. Поруч у `<ШЛЯХ-ПАПКА>` лежить `digital…` з аудіо (робить окрема кнопка/користувач).

## Як це зробити через MCP (перевірено на W41B_2, 01.10.2026)
```
render.clear_queue                         # в шаблоні лишаються зайві DONE-пункти (3 × RYBY і старий пункт майстра зі шляхом старого тижня T36!)
render.add_to_queue comp:<id майстра>
comp.set_work_area comp:<майстер> start:0 duration:30
render.set_output  queueIndex:1 renderTemplate:"Best Settings" outputTemplate:"DPXseq"
                   outputPath:<повний шлях …\<майстер>\<майстер>_[#####].dpx> logType:"errorsOnly"   # БЕЗ timeSpan*
render.set_settings queueIndex:1 settings:{"Time Span":"Work Area Only"}
render.set_om_settings queueIndex:1 settings:{"Output File Info":{
    "Base Path":"X:\\…\\finals\\T41\\BIEDR_REG_41B_2_30",
    "Subfolder Path":"<ім'я майстра>",
    "File Template":"<майстер>\\<майстер>_[#####].[fileExtension]"}}   # це і є «Save in subfolder»
render.get_settings queueIndex:1 format:"all" # звірити Base Path / Subfolder Path
ae_save_project
```
Сам `render.set_output` з повним шляхом лишає `Subfolder Path` порожнім: потрібен окремий `set_om_settings`. Шаблонний пункт майстра в черзі може вказувати на **старий тиждень**: завжди чисти чергу, не дублюй його.

## Зразок (W41B_1)
`render.status`: `BIEDR_REG_T41B_1_Bakador_Perwoll_Ptasie_Mleczko_30`, `Work Area Only 0–30 с`, 101 с, шлях `…\finals\T41\BIEDR_REG_41B_1_30\BIEDR_REG_T41B_1_Bakador_Perwoll_Ptasie_Mleczko_30\BIEDR_REG_T41B_1_Bakador_Perwoll_Ptasie_Mleczko_30_[#####].dpx`. Settings: Quality Best, Resolution Full, Guide Layers All Off, Motion Blur/Frame Blending On for Checked Layers, Disk Cache Read Only.
Попередні тижні: `finals\T40\BIEDR_REGULAR_W40B_1_30\BIEDR_REG_40_1_…_30` (стара назва папки), у T41 схема `BIEDR_REG_41A_1_30`, `BIEDR_REG_41A_2_30`.

## Нагадування
- W41B_2: підготую до рендеру, коли користувач змонтує (шлях `…\finals\T41\BIEDR_REG_41B_2_30\BIEDR_REG_T41B_2_Dallmayer_Colgate_Raffaello_30\…_[#####].dpx`).
- Шаблон виводу `DPXseq` має бути в списку `render.list_templates`; перевірка після налаштування: `render.get_settings format:all` (Subfolder Path заповнений).

## Часткова перерендерка після правки легала Praliny (02.10.2026, приклад)
Правка в одній оферті (`Oferta 3`, дата в легалі): користувач відмічає робочу зону майстра клавішами B/N (видима змінена частина = **лише ця оферта + запас по 5 кадрів**), рендер лише цього діапазону. Не рахую піксельні різниці: беру робочу зону, яку виставив користувач (тут 18,48–25,60 с, кадри 462–639), і готую чергу: `Work Area Only`, шлях той самий `finals\T41\BIEDR_REG_41A_1_30\<майстер>\<майстер>_[#####].dpx` (Subfolder Path = майстер). `Starting #` в output module AE сам ставить 462, але `Use Comp Frame Number` = true, тож імена збігаються з наявними кадрами і файли перезаписуються (імена фреймів не змінюються). Користувач сам робить Duplicate with file name і пускає рендер.
