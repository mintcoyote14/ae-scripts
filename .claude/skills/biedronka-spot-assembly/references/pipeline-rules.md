# Зведення правил пайплайну Biedronka (оновлено 02.11.2026)

Єдиний чекліст «що робити завжди». Деталі по шоу: fresh.md, reg.md, carry-over.md, replace-cenowka.md, stickers.md, ae-mcp.md.

## 0. Межі
- Я: збірка з шаблону, імпорт цінівок, оформлення Oferta N, beautyshot, заміна цінівок, перенос і рендер планш. Користувач: монтаж по голосу, кнопка Render спотів (крім «запускай рендер»).
- Робота в `W<NN>\compo\_ai_progress\`; у compo лише затверджене. Правка в compo лише з явним дозволом, спершу резерв у `_ai_progress\_backup` + MD5.
- X: максимально обережно: видаляти лише своє, без масових операцій, при сумніві питати.
- Папки й файли, що створюю я, латиницею без діакритики.
- Викреслена оферта в таблиці = пропустити; вже зроблені файли не видаляти.

## 1. Чекліст оферти перед звітом
1. Preview = комп нової цінівки першим шаром: enabled, guide, Opacity 50 (`property.set ["Transform","Opacity"]`, перевірити `property.get`; `layer.set_props opacity` НЕ працює), blend Normal, outPoint до кінця оферти.
2. `data` і legal завжди нові (з нової цінівки), перевірити текст і дати за таблицею.
3. Старі шари вимкнути + shy. Окремі шари: data, legal, механізм, планша `…_Alpha`, один фон за столом.
4. Анімовані стікери (`pakowany_anim`, `produkty_chlodzone.mov`, `sticker_*`) ЗСУВАТИ початком на кадр 10 (0,4 с), не обрізати inPoint (`inPoint == startTime`).
5. Рендер кадру оферти й порівняння з комп-ом цінівки; кадр ~9,5 с має показувати дату й legal.
6. Різні люди в оферт одного споту (дублювати фон-комп, міняти кліп `NOWE_ROTO`/`LUDZIE`; без коротких рукавів/шортів).

## 2. Імпорт цінівок (PSD агенції)
- Імпорт як 25 fps (агенція шле один кадр). Після імпорту перевірити fps. У спотах Biedronka усе 25 fps: 24 fps комп → `comp.set_props frameRate:25`, 24 fps футаж → `footage.interpret conformFrameRate:25`.
- Комп цінівки на всю тривалість оферти; у `data OK`, `plansza`, механізм-компі й компі цінівки `layer.set_timing layer:"all" outPoint:"comp"`, інакше дата зникає (≈4 с).
- Цінівки колег класти в `_CENOWKI\_`. Чужі споти доводити до нашої схеми (preview, окремі data/legal/механізм/планша, один фон).

## 3. Перевірка файлів агенції (вони часто помиляються)
Розміри (Blat_Tlo/Alpha 1920×1080; CC handlowa Blat_Tlo була 1920×1078), краї альфи, зайві шари (Eden 1+1 у Majonez), legal і дати, висота столу.
- Дефект: фони KREACJA з напівпрозорими краями (alpha 246: Dada, Eden, Konserwy, Pet_Food, Przekazki, Queen, Ready_To_Eat, Slodycze; Maka 253) та `_OUT\FRESH\Do_Plansz_Kreacja` (Ryby 246, Mieso_Lada 251, Warzywa 253) дають «дірку 1 px» в експортованих планшах. Рішення по виправленню файлів за користувачем; скан PNG через LockBits.

## 4. Висота столів
Агенція міняє її щотижня. Порівнювати профіль рендеру PSD з нашим (колонки x=40/1700). T44 PSD 619/871 (м'ясо 619/866), T45 PSD 597/845. Ніколи не переносити виправлення з іншого тижня.

## 5. Планші (візки)
- Перенос в новий тиждень (dmp): Save As, перейменувати майстер-комп `W<old>`→`W<new>`, прибрати DONE з черги, дублювати перші 4 UNQUEUED шаблони з "png + a" (шляхи `output\<SHOW>\YYYYMMDD\<project>\…_Full|_Blat_Tlo|_Alpha.png` і `vfx\_out\Plansze_Do_Spotu\<SHOW>\W<new>\…_Alpha.png`), `render.start` (виняток дозволений), звірити файли на диску.
- Перший `_Full` часто ERR_STOPPED: sacrificial item у scratchpad; індекси зсуваються після `remove_item` (sacrifice=8, новий Full=9). Потім прибрати sacrificial, зберегти, видалити scratchpad.
- Планша «видовжені години» (`CC_…handlowa_wydluz_godz`) = остання оферта: той самий фон, що в попередній, зі зсувом часу, щоб рух людини продовжувався: `startTime_bg_in_Oferta4 = startTime_bg_in_Oferta3 + (start Oferta3 − start Oferta4)`; після ремонтажу перерахувати; перевірити стик кадром.
- Перед створенням: перевірити, чи не була вже в Plansze_Do_Spotu; з таблиці дивитись, звідки робили базову планшу, і перевіряти її проєкт.

## 6. FRESH
Дивись fresh.md: Mieso_VAC, MEGA PAKA, Ryby, `produkty_chlodzone.mov`, «pakowany» sticker, REG-подібні оферти (`Blat_Niskie_Ceny` + `WEDLINY_SER_Precomp`/`WEDLINY_Precomp`, blur 6), `Opening_Ryby_kolko` якщо перша оферта риба.

## 7. Motion Tools Pro (кнопки)
Конфіг `C:\Users\a.popyk\AppData\Roaming\MDS\Motion_Tools_Pro\configs\userConfig.json` (після правки перезапустити панель/AE). Кнопки: MD `D:\_SCRIPTS_\MT_MD_duplicate_parent.jsx`; T `MT_T_guide_opacity50.jsx`; Fo `MT_Fo_reflection_hdr.jsx`; FF `MT_FF_freeze_frame.jsx`; CD `X:\_users\ArtemP\_AE_\scripts\change_comp_duration.jsx`. Бекапи конфігу в `D:\_SCRIPTS_\_task_archive\`. (Репозиторій тепер має `_motion_tools/`; перед правкою перечитати з диска.)

## 8. AE MCP: короткі пастки
`item.set_props` (name напряму), `property.set {property:[…]}`, `render.start` без параметрів, `eval.run` вимкнено, перевіряти результат рендером кадру, зберігати після кожного кроку.

## 9. Планші FRESH при перенесенні: перевірка фону (02.11.2026, W46A Jablka)
- У `TŁA_DO_ZMIANY` кілька тл (Warzywa, Ryby, Owoce, Mieso_Vac, Mieso_Lada); видиме верхнє ввімкнене. База W16A Jablka мала ввімкнений `Warzywa.png` над `Owoce.png` → планша з овочевим фоном. Після перенесення ЗАВЖДИ рендерити кадр PLANSZA_EXPORT і дивитись фон (фрукти = `Owoce`, м'ясо = `Mieso_*`, риба = `Ryby`, овочі = `Warzywa`); зайві вимкнути.
- Перерендер: `_Full.png`, що вже існує, перезаписати не вдається (ERR_STOPPED, навіть із жертовним пунктом). Свій свіжий `_Full.png` видалити й рендерити знову; перевірити час/розмір файла.
