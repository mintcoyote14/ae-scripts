# Практика роботи з AE MCP

## Обмеження середовища
- **`eval.run` вимкнено** (потрібен `AE_MCP_ENABLE_EVAL=1`), тому працюй готовими операціями `ae_do` (каталог: `ae_catalog`, можна по категорії). Кілька операцій — одним `batch.run` (`args: { ops: [{operation, args}], stopOnError: true }`). Одна операція = одна undo-група; `project.undo` не клади в `batch`.
- Python на машині нема (тільки заглушка Microsoft Store); для обробки JSON і зображень — PowerShell (`ConvertFrom-Json`, `System.Drawing`) чи Node. Розпізнавання мови нема (тільки англійський SAPI, для польської не годиться). Whisper не ставили без дозволу: завантаження треба підтверджувати.
- `ae_project_info` і `ae_comp_info` для великих проєктів видають 60–100 тис. символів і зберігаються у файл; читай їх через PowerShell або бери вужчі операції `item.list` (з `folder`, `type`, `nameContains`, `limit`).

## Корисні операції
- Проєкт: `project.open` (закриває поточний без збереження, якщо `save` не задано), `project.import_file` (`importAs`: `compRetainLayerSizes`), `project.rename` (map/regex, `scope`, `itemTypes`), `project.find_layers`, `ae_save_project`.
- Елементи: `item.list`, `item.move_to_folder`, `item.usages`, `folder.create`.
- Шари: `layer.create_footage` (додає джерело нагору), `layer.copy_to_comp` (копія з трансформами; нові шари стають нагорі в порядку копіювання), `layer.move` (toIndex), `layer.set_enabled`, `layer.set_guide`, `layer.set_props` (`solo`, `threeDLayer`, `name`…; `layer:"all"` теж можна), `layer.set_timing` (`shift`, `startTime`, `inPoint`, `outPoint`), `layer.replace_source`, `layer.delete`, `layer.info`, `layer.bounds`.
- Властивості: `property.set` (`["Transform","Position"]`, `["Transform","Opacity"]`, `["Transform","Scale"]`), `property.get` (є `time`), `marker.list`.
- Композиції: `comp.set_props` (`props:{duration:8}`), `comp.info`; `comp.duplicate`.

## Пастки
- Після `layer.delete`/додавання індекси шарів зсуваються; звертайся до шарів за **назвою**, коли вона унікальна, а індекси обчислюй після кожного кроку.
- `layer.copy_to_comp` ставить копії над наявними шарами; порядок треба потім вирівняти `layer.move`. Дубльовані назви (наприклад, `Blat_Niskie_Ceny.png` у двох комп-ах) приводять до помилок, називай копії.
- Час маркера шару в `marker.list` повертається в часі компа (після `set_timing` перевіряй).
- Комп-и з однаковими іменами в різних папках (`Oferta 1` у кількох шаблонах старих проєктів): використовуй числовий `id` або перевір, що знайдено потрібну.
- Відсутні операції: `Time Remap`/keys створюються через `keyframe.*`; не міняй їх без потреби.
- `project.open` відкриває лише один проєкт за раз; пісочницю потрібно повертати після читання оригіналів.

## Перевірка результату
- `ae_render_frame compNameOrId:<id> time:<с> outPath:<…>`: з `times:[…]` і `contactSheet` отримуєш одну картинку з кількох кадрів; `analyze:true` дає `contentBounds` (корисно для стікерів, поки фон прозорий).
- Рендер комп цінівки може бути 960×540 навіть якщо комп 1920×1080: пам'ятай масштаб під час порівняння координат.
- Обрізка області на PNG:
  ```powershell
  Add-Type -AssemblyName System.Drawing
  $img=[System.Drawing.Bitmap]::FromFile("file.png")
  $r=New-Object System.Drawing.Rectangle x,y,w,h
  $c=$img.Clone($r,$img.PixelFormat)
  # збільш через Graphics.DrawImage і збережи
  ```
- Щоб знайти файли на диску: `Get-ChildItem … -Recurse -Filter *.psd`, шляхи з пробілами в лапках; `client` може мати zip-и та їх розпаковані папки поруч.

## Робоча папка `_ai_progress` і резервні копії
Робота йде в `…\W<NN>\compo\_ai_progress\`; `compo` залишається чистим (лише затверджені проєкти споту). Створення робочої копії та резерв:
```powershell
$compo='…\W41\compo'
$work=Join-Path $compo '_ai_progress'; New-Item -ItemType Directory -Force $work | Out-Null
# новий спот: копія шаблону під правильною назвою
Copy-Item '…\_TEMPLATE\Template_SPOT_v08.aep' (Join-Path $work 'W41A_1_<P1>_<P2>_<P3>_v01.aep')
# резерв перед великою правкою (проєкт уже збережено)
$f=Join-Path $work 'W41A_1_<P1>_<P2>_<P3>_v01.aep'
$b=Join-Path $work '_backup'; New-Item -ItemType Directory -Force $b | Out-Null
Copy-Item $f (Join-Path $b ((Get-Item $f).BaseName + '_' + (Get-Date -f 'yyyyMMdd_HHmm') + '.aep'))
# затвердження: запис у compo (лише якщо там нема файла з таким ім'ям або є згода)
Copy-Item $f (Join-Path $compo (Split-Path $f -Leaf))
```
Копіюй файл тільки після `ae_save_project`. `_ai_progress` не зчитується IMPORT/AUDIO як проєкт спота (вони читають лише назву відкритого проєкту). Не перезаписуй існуючий спот у `compo` без явної згоди; нова версія = наступний номер `_vNN`.

## Тимчасові файли
Скрипти й рендери пиши в scratchpad сесії, а не в проєкт; рендери не зберігай у продакшн-папках.

## Правка тексту в легалі (дата, цифри), 02.10.2026
Легал/текст цінівки приходить із PSD як шар-растр, але в PSD це живий текст (шрифти FuturaPT Demi/Book/Bold). Правити так, як робить користувач: `Convert to Editable Text` (меню Layer > Create, `command.execute id:3799`), далі міняти лише цифри зі збереженням стилю.
- **`text.set_content` і `property.set` на Source Text НЕ використовувати для змішаного стилю:** текст отримує стиль першого символу і leading падає до ~1 px, рядки накладаються (перевірено на легалі Praliny, зіпсовано). Відкат через `project.undo` не врятував.
- **Правильно: `text.paste_range`** (AE 25.1+, `CharacterRange.pasteFrom`): вставити діапазон цифр із того самого тексту зі стилем. Приклад: `10.08.2026` → `10.10.2026`: індекс `i` = `IndexOf("10.08")` у тексті шару (`\r` рахується одним символом), `start:i+3 end:i+5 sourceStart:i sourceEnd:i+2` (замінює `08` на `10`, стиль жирного зберігається). Результат перевіряти `layer_info` (текст) і рендером кадру в 1:1 (шар має Position 105/856 і Scale 267,7% після конвертації).
- **Команда 3799 діє на ВИДІЛЕНІ шари АКТИВНОГО компу**, а активний комп через MCP не відкрити (`comp.open` нема, активним лишається той, що відкритий у вікні). Обхід: `layer.copy_to_comp` шару в активний комп (напр. 6-с майстер), `layer.set_props props:{selected:true}` на копії (перевірити `ae_context.selectedLayers`), `command.execute 3799`, `text.paste_range`, назад `layer.copy_to_comp` у `Oferta N` (трансформ зберігається), старий шар вимкнути + `layer.set_guide` (як у користувача), копію з майстра `layer.delete`.
- **`project.open` зберігає поточний проєкт перед відкриттям (спостерігав 02.10.2026, навіть з `save:false`):** зіпсований стан теж записався на диск. Перед `project.open` не лишати експериментальних правок; відновлення: перемістити зіпсований файл у `_ai_progress\_backup\<ім'я>_BROKEN-…aep` і скопіювати чистий файл (із `compo`) назад з перевіркою MD5.
