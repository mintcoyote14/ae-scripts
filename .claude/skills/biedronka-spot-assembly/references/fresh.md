# FRESH (м'ясо, риба, лада)

Шаблони `…\NISKIE CENY\FRESH\_TEMPLATE\`: `Template_SPOT_Fresh_v10.aep` (найновіший), `Template_PRODUCTS_v02.aep`. Споти `…\FRESH\W<NN>\compo\W41A_1_Wedliny_Mielone_Schab_v01.aep`; візки `…\FRESH\W<NN>\dmp\W41A_Mielone_v02.aep`; клієнтські цінівки `client\FRESH\YYYYMMDD_CENOWKI\` (`W41A_Wedliny_v01.psd`…); вихід `output\FRESH\YYYYMMDD\<Offer>_vNN\`. Цінівки м'яса/риби/лади беруться з `client\FRESH`; овочі/фрукти (GANG) з `client` Świeżaki.

## Схема
Та сама, що в REG (`references/reg.md`): каркас майстра однаковий. Відмінності:
- **Майстер:** `BIEDR_FRESH_T41A_1_<P1>_<P2>_<P3>_30`; аудіо без слова REG: `BIEDR_CNC_W41A_1_WEDLINY_MIELONE_SCHAB_30_EMIS_TV_-23LUFS_<date>.wav`.
- **Оферти в шаблоні v10** вже очищені (8–10 шарів): у `Oferta 1` `MD`, `Cenowka`, `Blat_Niskie_Ceny.png`, `WEDLINY_Precomp`, `Ryby`, `Owoce`, `Warzywa`, `Mieso_VAC`, `Mieso_Lada`; `Oferta 2` (є `MEGA PAKA`, `Cenowka`, `Cenowka Druga`, `Mieso_VAC` ввімкнений, **нема `MD` і `Blat`**); `Oferta 3` порожня (не використовується); `Oferta 4` з готовою ладою `Lada_Tradycyjna_[00000-00542].png`.
- **Ступенева відповідність:** лада (м'ясна, schab lada) завжди остання оферта, перед нею оферта з пакованим м'ясом (VAC). Беру готову `Oferta 4` для лади; нумерація Oferta-комп в AE не важлива, важливий зміст, що відповідає назвам продуктів. Перша оферта може бути з регуляра (дивись таблицю, але вона не завжди свіжа).
- **Фони:** `Mieso_VAC` (пакований фарш/Mielone), `Mieso_Lada` (лада), `WEDLINY_Precomp` (ведлини) і `Ryby`, `Owoce`, `Warzywa`.
- **Стіл залежить від шоу САМОЇ оферти:** оферта з REG (напр. `Wedliny` як перша оферта FRESH-споту) — світлий `Blat_Niskie_Ceny.png` (Y=586); оферта FRESH — темний. Темний стіл вже є у фонах `Mieso_VAC`/`Mieso_Lada` (Blat не додавай); для ведлин на темний фон потрібен шар `Blat_Niskie_Ceny.png` з підміненим джерелом `Blat_Meat.png`. Бібліотека `vfx\assets\BEAUTYSHOT_TLA\2026\_BLATY\` (`Blat_Niskie_Ceny/Meat/Ryby/Swieze.png`, усі 3500×2287, однаковий Position/scale/маска).
- **MD/MEGA PAKA — як у цінівці:** є `nowy mieszaj` → MD (у FRESH-`Oferta 2` MD треба додати: `layer.create_footage` з comp `MD`, бо його там нема; scale 66,6%); нема MD, є мега-пака → `MEGA PAKA` (підігнати під стікер цінівки); нема ні того ні того → `MEGA PAKA` вимкнена. У W41A (Wedliny/Mielone/Schab) мега-паки нема.
- **KA-карта:** у Schab (лада) KA вимкнена в PSD, тому `Cenowka`/MD у `Oferta 4` не додавати.
- **Значок лади** (`Lada_Tradycyjna_*.png`, scale 45,37%) метчити по `lada tradycyjna` у PSD Schab (центр 718,5/256,5): Position ≈ **721/254,8**; перевірка рендером видимий значок ≈ 613–825 × 158–357 px.
- **Beautyshot:** у FRESH-комп-ах 48 кліпів (нема `Wedliny`): Wedliny → `Szynka.mov`, Mielone → `Miesa_VAC.mov`, лада → **шар 46 `LADA_Miesna`** (у `Czwarty_Beautyshot` і `Trzeci_Beautyshot`, бо в монтажі лада може бути третьою чи четвертою). Комп 200 кадрів.
- **Людина у фоні** FRESH: у PSD вона є, у нашому кадрі лади її не було (питання відкрите).

## Порядок дій (W41A_1 як приклад)
Копія `Template_SPOT_Fresh_v10` → перейменування майстра → імпорт 3 PSD у `_CENOWKI` (корінь-папка `_CENOWKI`) → Oferta 1 (Wedliny), Oferta 2 (Mielone), Oferta 4 (Schab) як у REG → стіл → beautyshot solo → збереження. Після кожного кроку рендер і порівняння з PSD-компом.
