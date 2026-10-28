# 01 — Veri Modeli ve Depolama

> Ücret Hesaplama'nın (bundan sonra "program") bütün verisinin nerede, hangi biçimde ve hangi kurallarla tutulduğunu anlatır. İki tür okur için yazılmıştır: programı kullanacak bordro / İK / finans uzmanları ile programı kuracak, kendi kurumuna uyarlayacak ya da verisini başka bir sisteme aktaracak yazılımcılar. Programı daha önce görmemiş olmak engel değildir.
>
> **Kaynak:** Bu depodaki kod. Dosya yolları `program/` klasörüne göredir (`js/db/schema.js` = `program/js/db/schema.js`); `tools/…` ile başlayanlar depo köküne göredir. Her bilginin yanında kaynağı `dosya:işlev` biçiminde yazılıdır. Koddan doğrulanamayan her nokta **"doğrulanamadı"** diye işaretlidir ve [§9](#9-belirsiz-kalan--doğrulanamayan-noktalar)'da toplanmıştır.
>
> **Örnekler:** Belgedeki kişi, T.C. Kimlik No ve tutar örnekleri programla gelen uydurma örnek veriden (`data/ornek-veri.js`) ya da yuvarlak rakamlardandır. Yasal rakamlar (asgari ücret, vergi dilimleri, prim oranları) başlangıç verisinden aynen alınmıştır; her yıl resmî kaynaktan kontrol edilmelidir.

---

## İçindekiler

1. [Genel mimari (depolama açısından)](#1-genel-mimari-depolama-açısından)
2. [Tablolar](#2-tablolar)
3. [Tablolar arası ilişkiler ve veri kuralları](#3-tablolar-arası-ilişkiler-ve-veri-kuralları)
4. [Şema sürümleri ve veri göçleri](#4-şema-sürümleri-ve-veri-göçleri)
5. [Başlangıç verisi ve örnek veri](#5-başlangıç-verisi-ve-örnek-veri)
6. [Depolama ve kayıt mekanizması](#6-depolama-ve-kayıt-mekanizması)
7. [Sunucu: uç noktalar ve dosya yolları](#7-sunucu-uç-noktalar-ve-dosya-yolları)
8. [Veri dosyasını başka bir sisteme aktarma](#8-veri-dosyasını-başka-bir-sisteme-aktarma)
9. [Belirsiz kalan / doğrulanamayan noktalar](#9-belirsiz-kalan--doğrulanamayan-noktalar)
10. [Kaynak dizini](#10-kaynak-dizini)

---

## 1. Genel mimari (depolama açısından)

### 1.1 Katmanlar

| Katman | Dosya | Nesne | Görevi |
|---|---|---|---|
| Şema | `js/db/schema.js` | `window.SEMA_SQL`, `SEMA_SURUM`, `YETKILER`, `EKSIK_SUTUNLAR`, `TABLO_GOC`, `VERI_GOCLERI`, `TEMEL_VERI_YAZ`, `ONAY_TARIH_DONDUR`, `PARAMETRE_ANLIK_AL`, `PARAMETRE_DONDUR`, `BOLUM_TEMIZLE` | Tablo tanımları, sürüm yükseltme düzeni, yetki listesi, onay dondurma yardımcıları |
| Motor | `js/db/engine.js` | `window.ADB` | sql.js (SQLite'ın WebAssembly derlemesi) ile bellekte veritabanı; dosyayı okuma/yazma, şifreleme, yedek, sürüm denetimi |
| Veri erişimi | `js/db/api.js` | `window.API` | **Bütün SQL sorguları burada.** Ekranlar veritabanını doğrudan tanımaz. Yetki denetimi, iş kuralları, hesap motorunun beslenmesi |
| Yazma kilidi | `js/core/kilit.js` | `window.KILIT` | Aynı anda yalnız bir oturumun kayıt yapması |
| Sunucu | `Sunucuyu-Baslat.ps1` | — | Windows PowerShell `HttpListener`; statik dosyaları sunar, veri dosyasını okur/yazar, yedekler, kilit dosyasını yönetir |
| Başlangıç verisi | `data/seed.js` | `window.SEED_YUKLE`, `ORNEK_VERI_YUKLE` | Yeni veritabanına yasal parametreler; isteğe bağlı örnek veri |
| Örnek veri | `data/ornek-veri.js` (üretici: `tools/ornek-veri-uret.mjs`) | `window.ORNEK_VERI` | Uydurma iki grup, 56 kişi, değerlendirme ve mesai tablosu (§5.6) |
| Hesap motoru | `js/core/hesap.js` | `window.HESAP` | Brüt, prim, vergi, maliyet hesabı (02 numaralı belgenin konusu). **Hesap sonuçları veritabanında saklanmaz.** |
| Performans modeli | `js/core/performans.js` | `window.PERF` | Değerlendirme modelinin varsayılanı (`VARSAYILAN`), denetimi ve derlenmesi (`hazirla`), puan → zam çarpanı hesabı (`hesapla`). Modelin kendisi **veridir**: yıl bazında `parametre` tablosunda (`perf.model`, §2.21). **Puan ve çarpan saklanmaz.** |

`engine.js` ve `api.js` başlıklarında "sunucuya geçiş" notu vardır: üst katmanlar değişmeden yalnız bu iki dosyanın gövdesi HTTP çağrılarıyla değiştirilecek şekilde tasarlanmıştır (`engine.js` dosya başı yorumu, `api.js` dosya başı yorumu).

### 1.2 Verinin yaşam döngüsü

1. `BUTCE-BASLAT.bat` → `Sunucuyu-Baslat.ps1` çalışır, `http://localhost:8764/` açılır.
2. Tarayıcı `index.html`'i yükler; `app.js:baslat` → `ADB.baslat(…)` (geri çağrı `API.seedYukle`).
3. `ADB.baslat` dosyayı `GET /veri` ile **tamamen** belleğe alır; şifreliyse veri parolası sorulur, çözülür, `new SQL.Database(bytes)` ile açılır. Dosya yoksa şema kurulur ve başlangıç verisi yüklenir (`engine.js:baslat`, §5.1).
4. Her yazma işlemi bellekteki SQLite'a yapılır; 400 ms içinde biriken değişiklikler tek seferde veritabanının **tamamı** olarak dışa aktarılır (`db.export()`) ve `POST /veri` ile dosyanın yerine yazılır (`engine.js:kaydetGecikmeli`, `yazmaIsi`).
5. Sunucu her yazmadan önce (en çok 10 dakikada bir) dosyanın kopyasını `yedek\` klasörüne koyar.

Kısmi yazma yoktur: dosya her seferinde baştan sona yeniden yazılır. Bu yüzden eşzamanlılık "sürüm denetimi" (409) ve "yazma kilidi" ile çözülmüştür (§6.4, §6.8).

### 1.3 Genel veri kuralları

| Kural | Ayrıntı | Kaynak |
|---|---|---|
| Kişi kimliği | T.C. Kimlik No, **11 haneli METİN** (`TEXT`). Sayıya çevrilmemeli (11 hane 32 bitlik tamsayıya sığmaz; metin olarak taşınmalı). Girişte rakam dışı karakterler atılır, ilk 11 hane alınır; 11 haneden kısa numara kişi kartında reddedilir, dış liste aktarımında o satır atlanır. **Kontrol hanesi denetlenmez:** `util.js:tcGecerliMi` tanımlıdır ama hiçbir yerde çağrılmaz; örnek verinin kasıtlı geçersiz numaraları bu yüzden kabul edilir (§5.6). | `schema.js` başlık yorumu; `util.js:tcTemizle`; `api.js:calismaPersonelKaydetIc`, `erpAktar` |
| Tutarlar | Maaş ve ek ödemeler **çalışmanın ücret esasında** saklanır: varsayılan NET, çalışma ayarı `ucret.esas = 'BRUT'` ise brüt (§2.18, §3.4 madde 19). Esasın karşı tarafı (net esasta brüt, brüt esasta net ödeme) ve işveren maliyeti hesap motorunda üretilir, saklanmaz. | `api.js:ucretEsasi`; `hesap.js` başlık yorumu |
| Parametreler | **Yıl bazında.** Yeni yıl önceki yıldan kopyalanır, değişenler düzeltilir. | `schema.js` başlık yorumu; `api.js:yilKopyalaIc` |
| Tarih (gün) | `TEXT`, `YYYY-MM-DD` (ISO). Ay hesabı `slice(0,4)` / `slice(5,7)` ile yapılır; başka biçim hesabı bozar. Dışarıdan gelen tarih (Excel seri numarası, `gg.aa.yyyy` metni, `Date`) bu biçime çevrilerek yazılır. | `api.js:ayOf`; `util.js:tarihCoz` |
| Zaman damgası | `TEXT`, JavaScript `new Date().toISOString()` → UTC, `YYYY-MM-DDTHH:MM:SS.sssZ` | `util.js:simdi` |
| Evet/Hayır | `INTEGER` 0/1 | tüm şema |
| Oranlar | Kesir olarak (`0.14` = %14). Ekranlar yüzde gösterir, kesir yazar. | `api.js:PARAMETRE_TANIM` (`birim: 'oran'`) |
| Anahtar-değer tabloları | `parametre.deger`, `calisma_ayar.deger`, `aylik_girdi.deger`, `performans_girdi.deger`, `sistem_bilgi.deger` **TEXT**; sayılar `String(sayı)` ile yazılır (ör. `"0.05"`, `"22"`). `calisma_ozet.deger` ve `mesai_ongoru.deger` ise **REAL**. | `api.js` ilgili `…Yaz` işlevleri |
| Yabancı anahtar | Her bağlantıda `PRAGMA foreign_keys = ON`. sql.js `export()` sonrası bu ayar kapanır; motor her dışa aktarımdan sonra yeniden açar. Açılışta kapalı görülürse uyarı verilir. | `engine.js:ikiliAl`, `baslat`; `app.js:baslat` (`ADB.fkAcikMi`) |

---

## 2. Tablolar

Tanımların tek kaynağı `js/db/schema.js` → `window.SEMA_SQL`'dir: **23 tablo, 3 indeks** (AUTOINCREMENT kullanıldığı için SQLite ayrıca kendi `sqlite_sequence` tablosunu kurar). Aşağıda her tablo için: amaç, sütunlar, anahtar/kısıtlar, **kim yazar**, notlar.

"Kim yazar" sütunlarında `api.js` işlev adları verilmiştir; hangi ekranın hangi işlevi çağırdığı 04 numaralı belgededir. Bir çalışmaya yazan işlevlerin çoğu `api.js:calismaYazIste` üzerinden geçer: kullanıcının o gruba yazma hakkı olmalı, çalışma **onaylı olmamalı** ve ilgili yetki bulunmalıdır (§3.4).

### 2.1 `sistem_bilgi` — sistem ayarları (anahtar-değer)

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `anahtar` | TEXT | **PK** | Ayar adı |
| `deger` | TEXT | NULL olabilir | Değer (metin) |

**Kullanılan bütün anahtarlar:**

| Anahtar | Değer | Yazan | Okuyan |
|---|---|---|---|
| `sema_surum` | Şema sürümü, metin (şu an `"1"`) | `engine.js:baslat` (yeni kurulum), `engine.js:surumKontrol` (yükseltme) | `engine.js:surumKontrol` |
| `son_yedek` | Son yedeğin ISO zamanı | `engine.js:sonYedekYaz` (yedek indirme / `yedek-elle` kaydı) | `engine.js:yedekDurumu` → "son yedek kaç gün önce" bilgisi |
| `son_yedek_yol` | `yedek-elle` klasörü + `\` + dosya adı | `engine.js:yedekSunucuyaKaydet` | — (yalnız kayıt) |
| `oturum_zaman_asimi_dk` | Dakika, `0`–`240`, `0` = kapalı. Kayıt yoksa **5** | `api.js:oturumZamanAsimiYaz` (`sistem.yonet`) | `api.js:oturumZamanAsimi` → `app.js:zamanAsimiDakika` |
| `aktarim.sozluk` | JSON: `{ "<alan>": ["başlık", …] }` — dış liste aktarımının başlık sözlüğünde **yalnız değiştirilen** alanlar. Kayıt yoksa ya da alanın listesi boşsa o alanın varsayılan başlıkları geçerlidir | `api.js:aktarimSozlukYaz` (`parametre.yaz`; boş liste / `null` = o alan varsayılana döner; bilinmeyen alan reddedilir; işlem kaydı `KAYDET sistem_bilgi aktarim.sozluk`) | `api.js:aktarimSozluk` → `{ sozluk, etiket, degisen, varsayilan }` |

Genel amaçlı `api.js:ayarOku/ayarYaz` işlevleri de bu tabloyu kullanır; kod taramasında yukarıdakilerden başka anahtar bulunmadı.

**Dış liste başlık sözlüğü:** Dosyadaki sütun başlığı → aktarım alanı eşlemesidir. Varsayılanlar `api.js:AKTARIM_ALANLARI`'ndadır (`[alan, etiket, [başlıklar]]`): `tc`, `ad`, `ise_giris`, `isten_ayrilis`, `bolum`, `ekip`, `gorev`, `maas`, `yaka`, `butce_bolumu`, `maliyet` — `erpAktar`'ın satır alanlarıyla aynı (§2.19). `aktarim.sozluk` yalnız varsayılandan farklı listeleri tutar. Dosyadaki sütun başlığıyla eşleşme `js/core/tablooku.js:eslestir` ile yapılır: büyük/küçük harf, Türkçe karakter, nokta ve alt çizgi farkı gözetilmez; T.C. sütunu zorunludur.

### 2.2 `kullanici` — program kullanıcıları

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `kullanici_adi` | TEXT | **PK** | Giriş adı. Küçük harfe çevrilir, `^[a-z0-9._-]{3,}$` olmalı |
| `ad_soyad` | TEXT | NOT NULL | Görünen ad (boşluklar sadeleştirilir; boşsa kullanıcı adı) |
| `parola_hash` | TEXT | NOT NULL | `sha256i$<tur>$<hex>` biçiminde özet (§6.10) |
| `tuz` | TEXT | NOT NULL | 16 rastgele bayt, 32 karakter küçük harf hex |
| `yonetici` | INTEGER | NOT NULL, vars. 0 | 1 = her şeyi görür, yetki atar |
| `aktif` | INTEGER | NOT NULL, vars. 1 | 0 = giriş yapamaz |
| `son_giris` | TEXT | NULL | Son başarılı giriş (ISO) |
| `olusturma` | TEXT | NOT NULL | Oluşturma zamanı (ISO) |

- **Yazan:** İlk kurulum (`app.js:ilkKurulumEkrani` → `API.kullaniciEkle(…, yonetici=true)`; hiç kullanıcı yokken yetki aranmaz), `api.js:kullaniciEkle`, `kullaniciGuncelle`, `kullaniciSil` (üçü de `sistem.yonet`), `parolaDegistir` (kişi kendi parolasını yetkisiz değiştirir; başkasınınki `sistem.yonet` ister), `girisYap` (`son_giris`).
- **Kurallar:** Parola en az 6 karakter. Sistemde en az bir **etkin yönetici** kalmalı (`api.js:digerYoneticiYok`). Rol kavramı yoktur; her yetki kullanıcıya ayrı ayrı verilir.

### 2.3 `kullanici_yetki` — kullanıcıya atanan yetkiler

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `kullanici_adi` | TEXT | NOT NULL, FK → `kullanici(kullanici_adi)` ON UPDATE CASCADE ON DELETE CASCADE | |
| `yetki_kod` | TEXT | NOT NULL | `window.YETKILER` listesindeki kod (§5.7). FK yok. |

PK: (`kullanici_adi`, `yetki_kod`). **Yazan:** `api.js:kullaniciErisimYaz` (kullanıcının bütün yetkileri silinip yeniden yazılır; tek işlem; `sistem.yonet`). `yonetici = 1` olan kullanıcıda bu tablo dikkate alınmaz (`api.js:yetkiVar`).

### 2.4 `kullanici_grup` — kullanıcının görebildiği / yazabildiği gruplar

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `kullanici_adi` | TEXT | NOT NULL, FK → `kullanici` ON UPDATE/DELETE CASCADE | |
| `grup_kod` | TEXT | NOT NULL, FK → `grup(kod)` ON UPDATE/DELETE CASCADE | |
| `yazma` | INTEGER | NOT NULL, vars. 0 | 0 = yalnız görür, 1 = değişiklik yapabilir |

PK: (`kullanici_adi`, `grup_kod`). **Kaydı olmayan grup kullanıcıya hiç görünmez** (API okuma düzeyinde de engellenir: `api.js:calismaOkuIste`). **Yazan:** `api.js:kullaniciErisimYaz`; grup silinirken satırları da silinir (`api.js:grupSil`).

### 2.5 `islem_log` — işlem kaydı (denetim izi)

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `tarih` | TEXT | NOT NULL | ISO zaman |
| `kullanici_adi` | TEXT | NULL | İşlemi yapan (FK yok; kullanıcı silinse de kayıt kalır) |
| `islem` | TEXT | NOT NULL | İşlem kodu (aşağıda) |
| `tablo` | TEXT | NULL | Etkilenen tablo (ya da mantıksal ad) |
| `kayit_anahtar` | TEXT | NULL | Kaydın anahtarı (ör. `"3/99000000115"` = çalışma id / T.C., `"2027/t05510"`) |
| `detay` | TEXT | NULL | Serbest açıklama (ör. `"duzeltme = 1500"`) |

İndeks: `ix_log_tarih (tarih)`. **Yazan:** `api.js:log` (bütün yazma işlemleri; yazılamazsa işlem engellenmez) ve ekranlar `API.log` ile. **Hiç silinmez/budanmaz** (kodda silme sorgusu yok). Ekrana son 300 kayıt verilir (`api.js:logListe`, `sistem.yonet`).

`islem` kodları (`api.js` taraması): `EKLE`, `GUNCELLE`, `SIL`, `KAYDET`, `GIRIS`, `CIKIS`, `BIRLESTIR`, `KOPYALA`, `ONGORU`, `TASI`, `AKTAR` (dış liste aktarımı, `erpAktar`), `TOPLU` (toplu aylık girdi), `ORNEK` (örnek veri yüklendi). Ekranlar `API.log` ile ayrıca `ICE_AKTAR` ve `DISA_AKTAR` yazar. `tablo` sütununda gerçek tablo adları dışında `sistem` gibi mantıksal adlar da geçer.

> Dikkat: `detay` ve `kayit_anahtar` içinde T.C. No ve tutar (ör. düzeltme, parametre değeri) bulunabilir; kişisel veri olarak ele alınmalıdır.

### 2.6 `grup` — bütçe grupları (kullanıcı tanımlı)

"Grup" bütçenin tutulduğu birimdir (ör. bir şube, bir tesis, bir işlev). Program grup adı ya da kodu varsaymaz; gruplar kullanıcı tarafından açılır ya da örnek veriyle gelir.

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `kod` | TEXT | **PK** | Büyük harf kod. 2–20 karakter: harf (Türkçe büyük harfler dâhil), rakam, tire, alt çizgi; boşluklar `_` olur (`^[A-Z0-9_ÇĞİÖŞÜ-]{2,20}$`). **Kayıttan sonra değişmez** (çalışmalar, bölümler ve erişimler koda bağlıdır) |
| `ad` | TEXT | NOT NULL | Görünen ad (boşluklar sadeleştirilir) |
| `sira` | INTEGER | NOT NULL, vars. 0 | Menü/rapor sırası; yeni grupta boş bırakılırsa en büyük sıra + 1 |
| `maas_araliklari` | TEXT | NULL | Maaş dağılımı tablosunun **sabit** aralık alt sınırları, `;` ile ayrılmış sayılar (ör. `"50000;100000"`, en çok 20). NULL = her çalışmada maaşlara göre otomatik (`api.js:aralikOner`) |

- **Yazan:** `api.js:grupKaydet` (ekleme / ad ve sıra düzenleme; `sistem.yonet`), `api.js:grupSil` (**çalışması olan grup silinmez**; grubun bütçe bölümleri ve kullanıcı erişimleri aynı işlemde silinir; `sistem.yonet`), `api.js:varsayilanGrupAc` (hiç grup yokken `GENEL` / "Genel", §5.4), `seed.js:ORNEK_VERI_YUKLE` (`OFIS` / "Ofis", `URETIM` / "Üretim"). `TEMEL_VERI_YAZ` grup **açmaz**.
- `maas_araliklari` → `api.js:maasAralikYaz` (`parametre.yaz` + grup yazma hakkı). Okuma `api.js:aralikCoz` ile `;` ya da boşlukla bölünür, sıralanır, tekrarlar atılır; sınırlar **alt sınırdır** ([50000, 100000] → "50.000'in altı", "50.000–100.000", "100.000 ve üzeri").
- `TUMU` kodu arayüzde "Tümü" (bütün grupların birleşik görünümü) seçimi için ayrılmıştır (`app.js:secimYukle`); `grupKaydet` bu kodla grup açılmasını reddeder.

### 2.7 `butce_bolumu` — bütçe bölümleri

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `grup_kod` | TEXT | NOT NULL, FK → `grup(kod)` ON UPDATE CASCADE | Bölüm gruba bağlıdır (ON DELETE tanımsız: grup silinirken kod siler) |
| `ad` | TEXT | NOT NULL | **Numarasız** ad (ör. `PAZARLAMA`) |
| `sira` | INTEGER | NOT NULL, vars. 0 | Bölüm numarası; ekranda `08 PAZARLAMA` biçiminde gösterilir (`api.js:bolumEtiket`) |

Kısıt: UNIQUE (`grup_kod`, `ad`). Ayrıca **aynı grupta aynı sıra numarası** yasaktır (`api.js:butceBolumuKaydet`; veritabanında kısıt değil, kod denetimi). `sira` ≥ 1 olmalı.

- **Yazan:** `seed.js:ORNEK_VERI_YUKLE` (grubun hiç bölümü yoksa, `sira = 1, 2, …`); `api.js:butceBolumuKaydet`, `butceBolumuSil`, `butceBolumuBirlestir` (üçü de `parametre.yaz` + grup yazma hakkı); `api.js:grupSil`.
- **Önemli:** `calisma_personel.butce_bolumu` bu tabloya **id ile değil, AD ile** bağlıdır (FK yok). Bölümün adı değişince aynı gruptaki **bütün yılların** bütçe satırları da yeni ada güncellenir. Birleştirmede kaynak bölümün satırları hedefe alınır, kaynak silinir. Satırı olan bölüm silinemez.
- Adın temizlenmesi `schema.js:BOLUM_TEMIZLE`: boşluklar sadeleşir, baştaki `08 `, `08- `, `8) ` gibi numara atılır.

### 2.8 `hesap_turu` — hesaplama türü, yıl bazında

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `yil` | INTEGER | NOT NULL | Geçerli yıl |
| `kod` | TEXT | NOT NULL | Büyük harf kod: `SSK`, `EMK`, `SGKSIZ` (kullanıcı ekleyebilir) |
| `ad` | TEXT | NOT NULL | Görünen ad |
| `kol` | TEXT | NOT NULL, vars. `'SSK'` | Sigorta kolu: `SSK` (4/a tüm kollar), `SGDP` (emekli – sosyal güvenlik destek primi), `YOK` (SGK'sız; yalnız GV ve DV) |
| `sgk_isci` | REAL | NOT NULL, 0 | SGK işçi payı oranı |
| `issizlik_isci` | REAL | NOT NULL, 0 | İşsizlik işçi payı oranı |
| `sgk_isveren` | REAL | NOT NULL, 0 | SGK işveren payı oranı |
| `issizlik_isveren` | REAL | NOT NULL, 0 | İşsizlik işveren payı oranı |
| `gv` | INTEGER | NOT NULL, 1 | Gelir vergisi uygulanır mı |
| `dv` | INTEGER | NOT NULL, 1 | Damga vergisi uygulanır mı |
| `istisna` | INTEGER | NOT NULL, 1 | Asgari ücret istisnası uygulanır mı |
| `sira` | INTEGER | NOT NULL, 0 | Liste sırası |
| `aciklama` | TEXT | NULL | |

PK: (`yil`, `kod`). **Yazan:** `seed.js:SEED_YUKLE` (2026), `api.js:hesapTuruKaydet` (`INSERT OR REPLACE`), `hesapTuruSil` (o yılın bir kişi satırında ya da aylık girdisinde kullanılıyorsa silinemez), yıl kopyalama / yeni yıl öngörüsü (`yilKopyalaIc`); hepsi `parametre.yaz`.
Kişide yalnız `kod` saklanır (`calisma_personel.hesap_turu`, `aylik_girdi` alan `hesap_turu`); kod **çalışmanın yılındaki** satırdan çözülür (`api.js:hesapParametre`). FK yoktur. Kodun o yılda karşılığı yoksa hesap hata vermez: kişi SGK'sız sayılır, GV, DV ve istisna uygulanır (`hesap.js:ayHesapla`, `tur = P.turler[g.tur] || null`).

### 2.9 `kanun_turu` — teşvik kanunu türü, **yıldan bağımsız**

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `kod` | TEXT | **PK** | `YOK`, `05510`, `05510-5`, `05746`, `14857`, `15510` (kullanıcı ekleyebilir) |
| `ad` | TEXT | NOT NULL | Görünen ad (serbest) |
| `kural` | TEXT | NOT NULL, vars. `'YOK'` | Hesap motorunun tanıdığı teşvik kuralı: `YOK` / `05510` / `05746` / `14857` / `15510`. **Hesabı ad değil kural belirler.** |
| `aciklama` | TEXT | NULL | |
| `sira` | INTEGER | NOT NULL, 0 | |
| `oran` | REAL | NULL | Yalnız `kural = '05510'` türünde: o türün indirim oranı (imalat dışı 0.02, imalat 0.05). NULL = çalışma ayarı `tesvik.k05510`, o da yoksa yılın `t05510` parametresi |

**Yazan:** `schema.js:TEMEL_VERI_YAZ` (yalnız tablo **boşken**, §5.2), `api.js:kanunKaydet` (`INSERT OR REPLACE`), `kanunSil` (bir kişi satırında ya da aylık girdide kullanılıyorsa silinemez); ikisi de `parametre.yaz`. Kişide `kod` saklanır; hesapta `kod → kural` ve `kod → oran` eşlemesi yapılır (`api.js:hesapParametre` → `P.kanunKural`, `P.kanunOran`). Tanımsız kod `YOK` sayılır (teşvik yok).

**05510 oranının önceliği** (`hesap.js:ayHesapla`, `api.js:calismaHesapla`):
- Kanunu `kural = '05510'` olan kişide: `kanun_turu.oran` → `calisma_ayar.tesvik.k05510` → `parametre.t05510` → 0.02.
- 05510 payı alan diğer SSK'lı kanunlarda (05746, 14857): `calisma_ayar.tesvik.k05510` → `parametre.t05510` → 0.02.

### 2.10 `sakatlik_derece` — sakatlık indirimi tutarı, yıl bazında

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `yil` | INTEGER | NOT NULL | |
| `derece` | INTEGER | NOT NULL | 1, 2, 3 |
| `tutar` | REAL | NOT NULL, 0 | Aylık indirim tutarı (TL) |

PK: (`yil`, `derece`). **Yazan:** `seed.js:SEED_YUKLE`; `api.js:sakatlikYaz` (yılın satırları silinip yeniden yazılır); `ongoruUygula`; `yilKopyalaIc`.

### 2.11 `parametre` — yıl parametreleri (anahtar-değer)

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `yil` | INTEGER | NOT NULL | |
| `anahtar` | TEXT | NOT NULL | |
| `deger` | TEXT | NULL | Sayılar metin olarak |

PK: (`yil`, `anahtar`). Bir yılın parametrelerinin "var" sayılması için `asgari_ucret`'te o yıla satır olmalıdır (`api.js:parametreDurumu.var`). Yıl listesi `parametre` ve `calisma` yıllarının birleşimidir (`api.js:yillar`).

**Bütün anahtarlar** (kaynak: `api.js:PARAMETRE_TANIM`, `ZAM_TANIM`, `hesapParametre`, `parametreDurumu`, `ongoruUygula`, `performansModeliYaz`; `seed.js:SEED_YUKLE`):

| Anahtar | Anlamı | Kod içi varsayılan (kayıt yoksa) | Yazan |
|---|---|---|---|
| `durum` | `RESMI` = resmî rakamlar; `ONGORU` = yeni yıl öngörüsü (rakamlar henüz açıklanmamış). Başka değer resmî sayılır | — | `SEED_YUKLE` (`RESMI`), `ongoruUygula` (`ONGORU`), `parametreDurumYaz` |
| `tavan_carpan` | SGK tavanı = asgari ücret × bu çarpan | 9 | `SEED_YUKLE`, `parametreYaz` |
| `dv` | Damga vergisi oranı | 0.00759 | aynı |
| `istisna_kesinti` | Asgari ücret GV matrahı kesintisi (SGK %14 + işsizlik %1) | 0.15 | aynı |
| `bes_orani` | BES kesinti oranı | 0.03 | aynı |
| `t05510` | 05510 indirim oranı (varsayılan; kanun türünün `oran`'ı ve çalışma ayarı önce gelir, §2.9) | 0.02 | aynı |
| `t05746` | 05746 AR-GE SGK teşvik oranı (işveren %19,75 × ½) | 0.09875 | aynı |
| `t14857` | 14857 engelli teşvik oranı | 0.1975 | aynı |
| `t15510` | 15510 teşvik oranı | 0.05 | aynı |
| `arge_gv_esik` | Çalışmanın AR-GE günü varsayılanının uygulandığı en düşük GV teşvik oranı (kişiye aylık AR-GE günü girilmemişse, §3.4 madde 8) | 0.8 | `parametreYaz` |
| `mesai_fm1_kat` | Hafta içi fazla mesai katsayısı (× saat ücreti) | 1.5 | `parametreYaz` |
| `mesai_fm2_kat` | Hafta sonu / tatil mesaisi katsayısı (× saat ücreti) | 2 | `parametreYaz` |
| `mesai_gun_saat` | Saat ücretinde günlük çalışma saati: saat ücreti = maaş (çalışmanın esasında: net ya da brüt) / 30 / bu değer | 7.5 | `parametreYaz` |
| `zam_yuvarla` | Zam öngörüsünün yuvarlama adımı (TL); çalışmaya özel `calisma_ayar.zam.yuvarla_ongoru` önce gelir | 10 | `parametreYaz` |
| `zam.M.alt_esik` / `zam.B.alt_esik` | Zam kademesi alt eşiği (önceki yıl maaşı, çalışmanın ücret esasında), mavi (M) / beyaz (B) yaka | 50000 | `SEED_YUKLE`, `parametreYaz` |
| `zam.M.ust_esik` / `zam.B.ust_esik` | Zam kademesi üst eşiği | 100000 | aynı |
| `zam.M.ust_oran` / `zam.B.ust_oran` | **Alt eşiğin altındaki** maaşa uygulanan (yüksek) oran | 0.30 | aynı |
| `zam.M.alt_oran` / `zam.B.alt_oran` | **Üst eşiğin üstündeki** maaşa uygulanan (düşük) oran. İki eşik arasında doğrusal geçiş | 0.25 | aynı |
| `ongoru.kaynak_yil` | Öngörünün dayandığı yıl | — | `ongoruUygula` |
| `ongoru.oran` | Genel artış oranı | — | `ongoruUygula` |
| `ongoru.oran_asgari` | Asgari ücrete uygulanan oran | — | `ongoruUygula` |
| `ongoru.oran_dilim` | GV dilim sınırlarına uygulanan oran | — | `ongoruUygula` |
| `ongoru.oran_sakatlik` | Sakatlık tutarlarına uygulanan oran | — | `ongoruUygula` |
| `ongoru.ara_ay` | Yıl içi ara artış ayı (yoksa NULL) | — | `ongoruUygula` |
| `ongoru.ara_oran` | Ara artış oranı (yoksa NULL) | — | `ongoruUygula` |
| `ongoru.dilim_adim` | Dilim sınırı yuvarlama adımı | — | `ongoruUygula` |
| `ongoru.sakatlik_adim` | Sakatlık tutarı yuvarlama adımı | — | `ongoruUygula` |
| `ongoru.tarih` | Öngörünün uygulandığı an (ISO) | — | `ongoruUygula` |
| `perf.model` | O yılın **performans değerlendirme modeli**, JSON (ham biçim, §2.21) | Kayıt yoksa `PERF.VARSAYILAN()` (örnek model) | `api.js:performansModeliYaz` (`null` = kaydı siler, varsayılana döner; hatalı model `PERF.hazirla` denetiminden geçmez, kaydedilmez) |

Hepsi `parametre.yaz` ister. Başlangıç verisi beş yeni hesap anahtarını (`arge_gv_esik` … `zam_yuvarla`) ve `perf.model`'i yazmaz; kayıt yoksa kod içi varsayılan geçerlidir (§5.3). `parametre` tablosundaki **her** anahtar — `perf.model` dâhil — yeni yıla `yilKopyalaIc` ile (yıl kopyası ve yeni yıl öngörüsü, yalnız eksikse) kopyalanır ve onaylı çalışmada `calisma_parametre` görüntüsüyle dondurulur (§2.23). Onaylı çalışma bu yüzden onay anındaki katsayılarla hesaplanır ve onay anındaki modelle değerlendirilir; onaydan önce `perf.model` kaydı yoksa sonradan yazılan model değil varsayılan model geçerlidir (`api.js:calismaPerformansModeli`).

**Yıl parametresi olarak AR-GE günü yoktur:** AR-GE günü yalnız çalışma ayarı (`calisma_ayar.arge_gun`) ya da kişiye girilen aylık `arge_gun`'dür; ikisi de yoksa 0 (`api.js:hesapParametre` → `argeGun: 0`; §3.4 madde 8).

> Zam kademesi anahtar adları terstir: `ust_oran` alt dilimin, `alt_oran` üst dilimin oranıdır (`api.js:ZAM_TANIM` etiketleri ve `hesap.js:zamHesapla`). Başka bir sistemde ad değiştirilecekse eşleme dikkatle yapılmalı.

### 2.12 `gv_dilim` — gelir vergisi tarifesi, yıl bazında

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `yil` | INTEGER | NOT NULL | |
| `sira` | INTEGER | NOT NULL | 1'den başlar |
| `ust_sinir` | REAL | NULL | Dilimin üst sınırı (kümülatif matrah). **NULL = son dilim (sınırsız)** |
| `oran` | REAL | NOT NULL | 0 ≤ oran < 1 |

PK: (`yil`, `sira`). **Yazan:** `SEED_YUKLE`; `api.js:dilimYaz` (sınırlar artan olmalı, son dilim NULL'a çevrilir, yılın satırları silinip yazılır); `ongoruUygula`; `yilKopyalaIc`.

### 2.13 `asgari_ucret` — brüt asgari ücret, yıl ve dönem bazında

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `yil` | INTEGER | NOT NULL | |
| `baslangic_ay` | INTEGER | NOT NULL | Bu aydan itibaren geçerli (1 = Ocak; 2. dönem ör. 7) |
| `brut` | REAL | NOT NULL | Brüt asgari ücret |

PK: (`yil`, `baslangic_ay`). Ocak satırı **zorunludur** (`api.js:asgariYaz`). Yazan: `SEED_YUKLE`, `asgariYaz`, `ongoruUygula`, `yilKopyalaIc`. SGK tavanı ve asgari ücret istisnaları bundan türetilir, ayrıca saklanmaz (`hesap.js:parametreHazirla`).

### 2.14 `performans_kademe` — performans puanı → zam çarpanı (isteğe bağlı), yıl bazında

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `yil` | INTEGER | NOT NULL | |
| `alt_puan` | REAL | NOT NULL | Aralık alt puanı (dâhil) |
| `ust_puan` | REAL | NOT NULL | Aralık üst puanı (dâhil) |
| `carpan` | REAL | NOT NULL | Zam oranı çarpanı |

PK: (`yil`, `alt_puan`). **Yazan:** yalnız `api.js:performansYaz` ve yıl kopyası. **Başlangıç verisinde ve örnek veride satır yoktur.** Kullanım: kişinin `performans_carpani` boşsa `performans_puani` bu aralıklara bakılarak çarpana çevrilir (`api.js:performansCarpani`). Ayrıntılı performans değerlendirmesi bu tabloyu değil `performans_girdi`'yi kullanır (§2.21); ikisi zam hesabına giden iki ayrı yoldur.

### 2.15 `personel` — kişi kartı (kimlik ve istihdam)

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `tc_kimlik_no` | TEXT | **PK** | 11 haneli T.C. No |
| `ad_soyad` | TEXT | NOT NULL | |
| `ise_giris` | TEXT | NULL | İşe giriş tarihi `YYYY-MM-DD` |
| `isten_ayrilis` | TEXT | NULL | İşten çıkış tarihi; NULL = çalışıyor |
| `bolum` | TEXT | NULL | İK / ERP bölümü (bütçe bölümünden **farklıdır**; mesai öngörüsü bu alanla eşleşir, §2.22) |
| `ekip` | TEXT | NULL | |
| `gorev` | TEXT | NULL | Görev/unvan |
| `kaynak` | TEXT | NOT NULL, vars. `'ELLE'` | Kaydın kaynağı: `ELLE` (kişi kartı), `ERP` (dış liste aktarımı), `ORNEK` (örnek veri) |
| `guncelleme` | TEXT | NULL | Son güncelleme (ISO) |

İndeks: `ix_personel_ad (ad_soyad)`.

- **Yazan:** `api.js:calismaPersonelKaydet` (kişi kartı; yeni kayıtta `kaynak = 'ELLE'`, var olan kaydın `kaynak`'ı değişmez); `api.js:erpAktar` (ERP / bordro programından alınan liste; boş gelen alana dokunmaz; güncellenen ya da eklenen kayıtta `kaynak = 'ERP'`); `seed.js:ORNEK_VERI_YUKLE` (`kaynak = 'ORNEK'`).
- **Tek kayıt:** Bir kişinin giriş/çıkışı kartta **tektir**; farklı dönemler çalışma satırında saklanır (`calisma_personel.onay_sabit = 2`, §3.4).
- **T.C. düzeltme:** kişi kartında T.C. değiştirilince `UPDATE personel SET tc_kimlik_no` yapılır; bağlı tablolar `ON UPDATE CASCADE` ile izler (yeni numara başka kişiye aitse reddedilir).
- **Silme yok:** Kodda `DELETE FROM personel` yoktur. Bütçeden çıkarılan kişinin kartı kalır.

### 2.16 `calisma` — bütçe çalışması (bir grubun bir yılı)

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `yil` | INTEGER | NOT NULL | Bütçe yılı |
| `grup_kod` | TEXT | NOT NULL, FK → `grup(kod)` ON UPDATE CASCADE | |
| `ad` | TEXT | NOT NULL | Ör. `2027 Bütçe`, `2027 Revize`, `2027 Revize 2`; boşsa `<yıl> Bütçe` |
| `durum` | TEXT | NOT NULL, vars. `'TASLAK'` | `TASLAK` ya da `ONAYLI` (onaylandı → **kilitli**) |
| `zam_kademe` | INTEGER | NOT NULL, vars. 1 | Zam öngörüsünde maaş kademesi kullanılsın (0 = her maaşa üst oran) |
| `zam_performans` | INTEGER | NOT NULL, vars. 0 | Zam öngörüsünde performans çarpanı uygulansın |
| `aciklama` | TEXT | NULL | Ör. `Revize · kaynak: 2026 Bütçe (onaylı)`, `Örnek veri — taslak` |
| `olusturma` | TEXT | NOT NULL | ISO |

Kısıt: UNIQUE (`yil`, `grup_kod`, `ad`). Aynı yıl ve grupta birden çok çalışma olabilir (senaryo, revize).

- **Yazan:** `api.js:calismaKaydet` (yeni çalışma her zaman `TASLAK`, `zam_kademe = 1`, `zam_performans = 0`; isteğe bağlı `ucret_esas` = `NET` / `BRUT` → `calisma_ayar.ucret.esas`, §2.18; grup yazma hakkı + `personel.yaz`; onaylı kalan çalışmada yalnız açıklama değişir, ad ve zam yöntemi korunur), `calismaRevizeAc`, `calismaSil`, `performansCarpanUygula` (`zam_performans = 1`), `seed.js:ORNEK_VERI_YUKLE`.
- Silme: yalnız TASLAK silinebilir (`calismaYazIste`); bağlı bütün tablolar `ON DELETE CASCADE` ile silinir (§3).
- Onay/taslak geçişlerinin yan etkileri §3.4'te.

### 2.17 `calisma_ozet` — özet rakamları (anahtar-değer, REAL)

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `calisma_id` | INTEGER | NOT NULL, FK → `calisma(id)` ON DELETE CASCADE | |
| `anahtar` | TEXT | NOT NULL | |
| `deger` | REAL | NULL | |

PK: (`calisma_id`, `anahtar`).

**Bütün anahtarlar:**

| Anahtar | Anlamı |
|---|---|
| `butce_B`, `butce_M` | **Bütçelenen yıllık maliyet** (kurumun bütçe sürecinden gelen hedef rakam), beyaz / mavi yaka |
| `onceki_B`, `onceki_M` | **Önceki yıl gerçekleşen toplam maliyet**, beyaz / mavi yaka |

- **Yazan:** `api.js:calismaOzetYaz` (`personel.yaz`; onaylı çalışmada yazılamaz; boş değer NULL olarak yazılır, satır silinmez); çalışma kopyası `KOPYA` aynen kopyalar (`YENI_YIL` kopyalamaz); `seed.js:ORNEK_VERI_YUKLE` (bütçelenen = hesaplanan yıllık maliyetin %2 fazlası, bine yuvarlı; önceki = kişilerin `maliyet_onceki` toplamı).
- "Tümü" görünümünde gruplar anahtar anahtar toplanır (`api.js:birlesikHesapla`).

### 2.18 `calisma_ayar` — çalışmaya özel ayarlar (anahtar-değer, TEXT)

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `calisma_id` | INTEGER | NOT NULL, FK → `calisma(id)` ON DELETE CASCADE | |
| `anahtar` | TEXT | NOT NULL | |
| `deger` | TEXT | NULL | |

PK: (`calisma_id`, `anahtar`). Kayıt yoksa yılın parametresi / kod içi varsayılan geçerlidir. Değer boş/NULL yazılırsa satır silinir (`api.js:calismaAyarYaz`, `personel.yaz`). **Onaylı çalışmada yazılamaz.**

**Bütün anahtarlar** (tarama: `api.js:calismaHesapla`, `calismaZamKademe`, `calismaPersonelKopyala`, `mesaiAktifYaz`; `seed.js:ORNEK_VERI_YUKLE`; ekranların `calismaAyarYaz` çağrıları):

| Anahtar | Değer | Anlamı | Yazan | Yeni yıla (`YENI_YIL`) geçer mi |
|---|---|---|---|---|
| `ucret.esas` | `'BRUT'` ya da satır yok (= NET) | **Ücret esası:** çalışmaya girilen maaş (`calisma_personel.maas_eski`) ve aylık ek ödeme tutarları (yol, prim, ayni, yakıt) net mi brüt mü. Hesap motoruna `P.ucretEsasi` olarak geçer (`api.js:ucretEsasi`, `calismaHesapla`; formüller 02 numaralı belgede). Yalnız `'BRUT'` saklanır; NET'te satır silinir (`ucretEsasiYazIc`) | `calismaKaydet({…, ucret_esas})` (yeni çalışma); `calismaAyarYaz` (**bütçe satırı ya da aylık girdi kaydı olan çalışmada değiştirilemez** — `api.js:esasBagli`; `NET`/`BRUT` dışı değer reddedilir); `calismaPersonelKopyala` (hedefe kaynağın esası, satırlarla aynı işlemde) | **Evet** — yeni yıl, kopya ve revize kaynağın esasını devralır (§3.4 madde 19) |
| `zam.B.alt_esik`, `zam.B.ust_esik`, `zam.B.ust_oran`, `zam.B.alt_oran`, `zam.M.…` (8 anahtar) | sayı (oran kesir) | Bu çalışmaya özel zam kademesi; boş = yılın `parametre.zam.*` (`calismaZamKademe`) | `calismaAyarYaz`; örnek veri (iki grupta da) | Evet |
| `gun.B.1` … `gun.B.12`, `gun.M.1` … `gun.M.12` (24 anahtar) | gün sayısı | Yaka × ay **varsayılan çalışılan gün** (kişiye o ay gün girilmemişse). Boş = 30 (`hesap.js:ayHesapla`) | `calismaAyarYaz` | **Hayır** (yalnız `KOPYA`'da) |
| `arge_gun` | gün | Çalışmanın AR-GE günü: aylık `arge_gun`'ü olmayan ve GV teşvik oranı yılın `arge_gv_esik`'ine (vars. 0,8) eşit ya da büyük olan kişilerde kullanılır. Boş = 0 | `calismaAyarYaz` | **Hayır** — o yılın kararıdır |
| `tesvik.k05510` | oran | 05510 indirim oranı bu çalışmada (ör. imalat işyerinde 0.05); önceliği §2.9 | `calismaAyarYaz` | **Evet** (işyerinin niteliğidir) |
| `tesvik.k05746`, `tesvik.k14857`, `tesvik.k15510` | oran | Teşvik oranının çalışmaya özel geçersiz kılınması | `calismaAyarYaz` (örnek veri kullanmaz) | Hayır |
| `zam.yuvarla_ongoru` | sayı | Zam öngörüsünün yuvarlama adımı (TL); boş = yılın `parametre.zam_yuvarla`, o da yoksa 10 (`api.js:calismaHesapla`, `hesap.js:zamHesapla`) | `calismaAyarYaz`; örnek veri (Üretim grubu) | Evet |
| `mesai.ongoru` | `'1'` | Açıkken kişilerin aylık mesaisi mesai öngörüsü tablosundan gelir (§2.22) | `api.js:mesaiAktifYaz` (`aylik.yaz`; kapatınca satır silinir); örnek veri (Üretim grubu) | Evet |
| `dagilim.haric` | T.C. listesi, `,` ile | Maaş dağılımı tablosundan elle çıkarılan kişiler | `calismaAyarYaz` | Hayır |
| `dagilim.dahil` | T.C. listesi, `,` ile | Varsayılan olarak dışarıda olup (yıl içinde girenler) elle eklenenler | `calismaAyarYaz` | Hayır |

`YENI_YIL` kopyasının dışarıda bıraktığı anahtarlar kodda tek bir süzgeçtir: `gun.%`, `dagilim.%`, `arge_gun` ve `tesvik.k05510` dışındaki `tesvik.%` (`api.js:calismaPersonelKopyala`). `KOPYA` bütün anahtarları kopyalar.

> **Tuzak:** `dagilim.haric/dahil` T.C. No'larını düz metin olarak tutar; T.C. düzeltildiğinde `ON UPDATE CASCADE` bunları **güncellemez**. Başka bir sisteme aktarırken bu değerler ilişkisel yapıya çevrilmeli.

### 2.19 `calisma_personel` — çalışmadaki kişi (bütçenin bir satırı)

PK: (`calisma_id`, `tc_kimlik_no`). FK: `calisma_id` → `calisma(id)` ON DELETE CASCADE; `tc_kimlik_no` → `personel(tc_kimlik_no)` ON UPDATE CASCADE ON DELETE CASCADE.
Ocak'ın **sürekli** aylık girdileri (hesap türü, kanun, sakatlık…) bu satırdadır; sonraki aylar değişmedikçe bunları devralır (§2.20).

| Sütun | Tip | NULL/Vars. | Anlamı (iş dili) |
|---|---|---|---|
| `calisma_id` | INTEGER | NOT NULL | Çalışma |
| `tc_kimlik_no` | TEXT | NOT NULL | Kişi |
| `sira` | INTEGER | NOT NULL, 0 | Satır sırası (yeni eklenen: en büyük + 1). Ekran sıralaması bölüm sırası + işe giriş tarihine göredir (`api.js:calismaPersonelListe`) |
| `butce_bolumu` | TEXT | NULL | Bütçe bölümünün **adı** (numarasız) |
| `yaka` | TEXT | NOT NULL, vars. `'B'` | `B` beyaz / `M` mavi (başka değer reddedilir) |
| `maas_eski` | REAL | NOT NULL, 0 | **Önceki yılın aylık maaşı, çalışmanın ücret esasında** (`calisma_ayar.ucret.esas`: yoksa NET, `'BRUT'` ise brüt). Sütunun kendisi esası taşımaz; esas çalışmadan okunmadan tutar yorumlanamaz. Zam bunun üzerine hesaplanır; yeni (zamlı) maaş saklanmaz, `maas_eski + zam` olarak aynı esasta hesaplanır (`hesap.js:zamHesapla` → `yeni`) |
| `zam_ayi` | INTEGER | NOT NULL, 1 | Zammın geçerli olduğu ay (1–12) |
| `duzeltme` | REAL | NOT NULL, 0 | Zam öngörüsüne **elle müdahale** (yönetimin düzeltmesi); zam = öngörü + düzeltme. `zam.yaz` yetkisi |
| `performans_puani` | REAL | NULL | Performans puanı (→ `performans_kademe`) |
| `performans_carpani` | REAL | NULL | Zam çarpanı; doluysa puana bakılmaz. NULL = 1. Performans değerlendirmesinden `performansCarpanUygula` yazar |
| `maliyet_onceki` | REAL | NULL | Önceki yıl toplam işveren maliyeti |
| `karsilastirma` | REAL | NULL | Karşılaştırma maaşı (bilgi amaçlı) |
| `hesap_turu` | TEXT | NULL | Ocak'taki hesaplama türü kodu (`hesap_turu.kod`) |
| `sakatlik_derece` | INTEGER | NULL | Ocak'taki sakatlık derecesi (1–3) |
| `ozurlu_indirimi` | REAL | NOT NULL, 0 | Ocak'taki özürlü indirimi tutarı. Derece doluysa hesap tutarı o yılın `sakatlik_derece` tablosundan alır; bu alan yalnız derecesiz kişide kullanılır (`api.js:calismaHesapla`) |
| `bes` | TEXT | NULL | `EVET` = BES'e katılıyor, `HAYIR`, NULL = belirtilmemiş (katılmıyor gibi hesaplanır) |
| `kanun` | TEXT | NULL | Ocak'taki kanun türü kodu (`kanun_turu.kod`) |
| `gv_tesvik` | REAL | NOT NULL, 0 | GV (AR-GE) teşvik oranı (ör. 0.8–1); yılın `arge_gv_esik`'ine (vars. 0.8) ulaşınca çalışmanın AR-GE günü kullanılır |
| `yol` | REAL | NOT NULL, 0 | Yol parası (çalışmanın ücret esasında) |
| `not_metni` | TEXT | NULL | Serbest not |
| `onay_sabit` | INTEGER | NOT NULL, 0 | Tarih dondurma: **0** = personel kartının güncel tarihleri; **1** = çalışma onaylandığı andaki tarihler; **2** = çalışmanın kendi dönem tarihleri (kişi sonra başka dönemde/grupta yeniden girdi) |
| `onay_giris` | TEXT | NULL | Dondurulmuş işe giriş (`onay_sabit > 0` iken geçerli) |
| `onay_cikis` | TEXT | NULL | Dondurulmuş çıkış |

- **Yazan:**
  - Kişi kartı: `api.js:calismaPersonelKaydet` (`CP_ALANLAR` listesindeki 18 alanın tamamı, `sira`'dan `not_metni`'ne; kart ve satır tek işlemde; istenirse aynı işlemde grup değiştirme).
  - Tek bir sütun: `api.js:calismaPersonelAlanYaz` (ör. düzeltme; `duzeltme`, `performans_puani`, `performans_carpani` için `zam.yaz`, diğerleri `personel.yaz`). Excel'den içe alınan düzeltmeler de bu yoldan yazılır.
  - Silme: `api.js:calismaPersonelSil` (kişinin bu çalışmadaki `aylik_girdi` ve `performans_girdi` satırları da silinir); grup değiştirme: `calismaPersonelTasi`.
  - Dış liste aktarımı: `api.js:erpAktar` — var olan satırda `maas_eski`, `maliyet_onceki`, `yaka`, `butce_bolumu` (boş gelen alana dokunulmaz); yeni kişide `hesap_turu = 'SSK'`, `kanun = 'YOK'`, `zam_ayi = 1`, yaka boşsa `'B'`. Satır alanları: `{ tc, ad, ise_giris, isten_ayrilis, bolum, ekip, gorev, maas, yaka, butce_bolumu, maliyet }`; `maas` → `maas_eski`, `maliyet` → `maliyet_onceki`. **Maaş esası beyanı:** imza `erpAktar(id, satirlar, yeniEklensin, maasEsasi)`; satırlardan birinde `maas` doluysa `maasEsasi` (`'NET'` / `'BRUT'`) zorunludur ve çalışmanın esasıyla aynı olmalıdır, değilse hiçbir şey yazılmadan hata atılır ("Maaş tutarlarının esası (net / brüt) belirtilmeli." ya da "Maaşlar brüt, çalışma net esaslı; aktarılamaz." biçiminde). Maaş sütunu alınmamışsa satırlarda `maas` boş gönderilir ve beyan gerekmez. Dosyadaki sütunun esasını belirleyip beyan etmek çağıranın işidir (içe alma ekranı, 04 numaralı belge). Çalışmada olmayan kişi yalnız `yeniEklensin[tc]` işaretliyse eklenir. Bütçe bölümü numarasız ve büyük/küçük harf duyarsız eşleşir; eşleşmezse NULL.
  - Performans: `performans_carpani` (`performansCarpanUygula`; değerlendirilmeyen kişide NULL).
  - Çalışma kopyası / yeni yıl (`calismaPersonelKopyala`), örnek veri (`ORNEK_VERI_YUKLE`), onay dondurma (`ONAY_TARIH_DONDUR`, taslağa alma, `donemTarihleriniKoru` → `onay_*`).
- **Sayısal alanlar** (`api.js:CP_SAYISAL`): boş gelirse `CP_BOS_OLABILIR` listesindekiler (`performans_puani`, `performans_carpani`, `maliyet_onceki`, `karsilastirma`, `sakatlik_derece`) NULL, diğerleri 0 yazılır. Metin girişleri Türkçe sayı biçiminden çevrilir (`api.js:trSayi`: `"40.000"` → 40000, `"0,25"` → 0.25, `"0.075"` → 0.075).

### 2.20 `aylik_girdi` — aylık girdiler (yalnız Ocak'tan / önceki aydan farklı olanlar)

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `calisma_id` | INTEGER | NOT NULL, FK → `calisma(id)` ON DELETE CASCADE | |
| `tc_kimlik_no` | TEXT | NOT NULL, FK → `personel` ON UPDATE/DELETE CASCADE | |
| `ay` | INTEGER | NOT NULL | 1–12 |
| `alan` | TEXT | NOT NULL | Alan adı (aşağıda) |
| `deger` | TEXT | NULL | Metin; sayılar `String(sayı)` |

PK: (`calisma_id`, `tc_kimlik_no`, `ay`, `alan`). İndeks: `ix_aylik_calisma (calisma_id, ay)`. Değer boş yazılınca satır silinir.

**Bütün alan adları** (`api.js:AYLIK_SUREKLI`, `AYLIK_TEK`, `AYLIK_ETIKET`, `AYLIK_KISI_ALANLARI`). Başka alan adı `aylikGirdiYaz` ve `aylikGirdiToplu`'da reddedilir.

| Alan | Etiket | Tür | Değer | Yazma yetkisi |
|---|---|---|---|---|
| `hesap_turu` | Hesaplama türü | **Sürekli** (girildiği aydan itibaren devreder) | `hesap_turu.kod` | `personel.yaz` |
| `kanun` | Kanun türü | Sürekli | `kanun_turu.kod` | `personel.yaz` |
| `sakatlik_derece` | Sakatlık derecesi | Sürekli | 1–3 | `personel.yaz` |
| `ozurlu_indirimi` | Özürlü indirimi | Sürekli | tutar | `personel.yaz` |
| `bes` | BES | Sürekli | `EVET` / `HAYIR` | `personel.yaz` |
| `gv_tesvik` | GV teşvik oranı | Sürekli | oran | `personel.yaz` |
| `yol` | Yol parası | Sürekli | tutar | `personel.yaz` |
| `fm1` | Hafta içi mesai (saat) | **Sürekli** | saat (hafta içi) | `aylik.yaz` |
| `fm2` | Hafta sonu mesai (saat) | **Sürekli** | saat (hafta sonu) | `aylik.yaz` |
| `arge_gun` | AR-GE gün | **Sürekli** | gün | `aylik.yaz` |
| `ayni` | Ayni yardım | **O aya özgü** (devretmez; girilmeyen ay 0) | tutar | `aylik.yaz` |
| `prim` | Prim ve diğer ödemeler | O aya özgü | tutar | `aylik.yaz` |
| `yakit` | Yakıt yardımı | O aya özgü | tutar | `aylik.yaz` |
| `calisilan_gun` | Çalışılan gün | O aya özgü (girilmezse `calisma_ayar.gun.<yaka>.<ay>`, o da yoksa 30) | gün | `aylik.yaz` |

> Ocak (ay 1) için sürekli kişi alanları normalde `calisma_personel`'dedir; `aylik_girdi`'de ay 1 kaydı varsa motor onu da uygular (`api.js:calismaHesapla` döngüsü 1. aydan başlar). Örnek veri `fm2` ve `arge_gun`'ı bu yolla, ay 1 kaydı olarak yazar (Ocak'tan geçerli, bütün yıla devreder).
>
> Mesai öngörüsü açıkken (`calisma_ayar.mesai.ongoru = '1'`) kişinin o ayki `fm1/fm2`'si tablodan gelir; yalnız **o aya** elle girilmiş değer önceliklidir, önceki aydan devralınan değer değil (`api.js:calismaHesapla`).
>
> `fm1/fm2` saattir; tutara yılın `mesai_gun_saat`, `mesai_fm1_kat`, `mesai_fm2_kat` parametreleriyle çevrilir (§2.11; formül 02 numaralı belgede). Brüt esaslı çalışmada saat ücreti brüt maaştan hesaplanır.
>
> **Tutar alanları çalışmanın ücret esasındadır:** ek ödemeler (`yol`, `ayni`, `prim`, `yakit`) NET esaslı çalışmada net, BRÜT esaslı çalışmada brüt girilmiş sayılır (`calisma_ayar.ucret.esas`, §2.18). Satırda esas bilgisi yoktur. Bu yüzden aylık girdi kaydı olan çalışmanın esası da değiştirilemez (§3.4 madde 19).

### 2.21 `performans_girdi` — performans değerlendirmesi (kişi başına alan/değer)

Her grupta kullanılabilir.

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `calisma_id` | INTEGER | NOT NULL, FK → `calisma` ON DELETE CASCADE | |
| `tc_kimlik_no` | TEXT | NOT NULL, FK → `personel` ON UPDATE/DELETE CASCADE | |
| `alan` | TEXT | NOT NULL | Alan adı (aşağıda) |
| `deger` | TEXT | NULL | Puan (sayı metni) ya da metin |

PK: (`calisma_id`, `tc_kimlik_no`, `alan`). **Puan ve çarpan saklanmaz**, her açılışta `js/core/performans.js:PERF.hesapla(kisiler, model)` ile çalışmanın modeline göre hesaplanır; zam hesabına `performansCarpanUygula` ile `calisma_personel.performans_carpani` olarak geçer.

**Alan adları çalışmanın modeline bağlıdır.** Model, çalışmanın yılının `parametre.perf.model` kaydıdır (onaylı çalışmada onay anındaki dondurulmuş kopya; kayıt yoksa `PERF.VARSAYILAN()`) — `api.js:calismaPerformansModeli`. Geçerli alanlar modelin içeriğinden türetilir (`PERF.hazirla(ham).alanlar(yaka)`, `alanGecerli`); `performansGirdiYaz` başka adı reddeder:

| Alan | Anlamı | Tür |
|---|---|---|
| `grup` | Değerlendirme bölümü (bölüm katsayısı buna göre hesaplanır; bütçe grubu değildir). Ayrılmış ad | metin |
| `amirN` (modeldeki her amirin `alan`'ı: `amir1`, `amir2`…) | O amirin **adı** | metin |
| `aN.<kriter kodu>` | Amir N'nin o kriterdeki puanı (0–100). **Önekteki sayı, amirin listedeki sırası değil kendi numarasıdır:** `amir3` → `a3.`; `amir1` ile `amir4` tanımlıysa öneki `a1.` ve `a4.` olur | sayı |
| Ek puan alanının `alan` kodu (ör. `devam`, `kidem`) | Ek puan girdisi; `liste` türünde seçenek metni, diğerlerinde sayı | sayı / metin |

**Kaldırılan tanımların verisi kalır:** model değiştirilip bir amir, kriter ya da ek puan alanı çıkarılınca o alanlara girilmiş satırlar silinmez, yalnız hesaba girmez. `performansGirdiYaz` bu alanlara değer yazmayı "Bilinmeyen performans alanı" diye reddeder, ama boş değerle silmeye izin verir; ekranda görünmedikleri için bu satırlar pratikte kişinin bütün değerlendirmesi silinince (`performansGirdiSil`) ya da kişi çalışmadan çıkarılınca gider. `KOPYA` ve grup değiştirme bu satırları da kopyalar. Aynı kodla yeniden tanımlanan alan eski değerleri yeniden okur.

**Modelin ham biçimi** (`parametre.perf.model` JSON'u; denetim ve derleme `PERF.hazirla`, hatalıysa "Değerlendirme modeli: …" hatası):

```
{ "amirler": [ { "alan": "amir1", "ad": "1. AMİR", "agirlik": 50 }, … ],          // 1–5 amir, alan "amirN"
  "yaka": {
    "M": { "ad": "Mavi yaka", "sayfa": "MAVİ YAKA", "degAgirlik": 80,
           "kriter": [ { "kod": "is_bilgisi", "ad": "İŞ BİLGİSİ", "agirlik": 25 }, … ],
           "ek":     [ { "alan": "devam", "ad": "…", "tur": "esik", …türün alanları, "sinir": [0, 100], "not": "…", "kalici": true }, … ] },
    "B": { … } } }
```

- Kodlar (`kriter.kod`, `ek.alan`): `^[a-z][a-z0-9_]{0,29}$`; `grup` ve `amirN` biçimi ek puan alanına verilemez; aynı yakada tekrar edemez. En az bir amirin ağırlığı sıfırdan büyük olmalı; her yakada en az bir kriter. `sayfa`, Excel şablonundaki sayfa adıdır.
- **Ek puan kural türleri** (`PERF.TURLER`): `esik` (değer ≥ `esik` → `puan`; altında değer × `katsayi`), `kademe` (`kademeler: [[en az, puan], …]`; ulaşılan en yüksek kademenin puanı), `carpan` (değer × `katsayi`, en çok `enCok`), `liste` (`secenek: [[seçenek, puan], …]`; listede olmayan → `bos`). İsteğe bağlı: `sinir` [en az, en çok] (giriş denetimi), `not` (açıklamanın başına), `kalici` (yeni dönemin şablonuna önceki dönemden taşınır). Puan formülleri 02 numaralı belgededir.
- Önceki dönemden şablona taşınan alanlar: `grup`, amir adları ve `kalici` işaretli ek puan alanları (`api.js:performansOncekiDonem`: aynı grup, bir önceki yıl, onaylı çalışma öncelikli).

Programla gelen **varsayılan model bir örnektir** (`PERF.VARSAYILAN()`); kurum kendi kriterlerine ve ağırlıklarına göre yıl bazında değiştirir (`api.js:performansModeliYaz`, `parametre.yaz`). İçeriği:

| | Mavi yaka (`M`) | Beyaz yaka (`B`) |
|---|---|---|
| Kriterler (ağırlık) | `is_bilgisi` (25), `gorev` (25), `kural` (20), `iletisim` (15), `gelisim` (15) | `is_bilgisi` (20), `kalite` (20), `planlama` (20), `iletisim` (15), `gelisim` (10), `yonetici` (15) |
| Değerlendirmenin toplam puandaki ağırlığı (`degAgirlik`) | 80 | 80 |
| Ek puan alanları (tür) | `devam` (`esik`), `tutanak` (`kademe`), `kidem` (`carpan`, kalıcı), `egitim` (`liste`, kalıcı) | `kidem`, `egitim` |
| Amirler (`amirler`) | `amir1` 50, `amir2` 30, `amir3` 20 (puanı olmayan amirin ağırlığı kalanlara dağıtılır) | aynı |

Varsayılan `egitim` seçenekleri: `OKUR YAZAR`, `İLK OKUL`, `ORTA OKUL`, `LİSE`, `MESLEK LİSESİ`, `ÖN LİSANS`, `LİSANS`, `YÜKSEK LİSANS`, `DOKTORA`.

**Yazan:** `seed.js:ORNEK_VERI_YUKLE` (Üretim grubunun 2026 çalışması); `api.js:performansGirdiYaz` (`zam.yaz`; yalnız çalışmada bulunan kişiye ve modelde bulunan alana; boş değer satırı siler; `aciklama` işlem kaydına yazılır), `performansGirdiSil` (kişinin bütün değerlendirmesi). `KOPYA` ve grup değiştirme satırları kopyalar; `YENI_YIL` kopyalamaz.

### 2.22 `mesai_ongoru` — mesai öngörüsü (bütçe bölümü değil, **personel bölümü** × ay)

Her grupta kullanılabilir.

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `calisma_id` | INTEGER | NOT NULL, FK → `calisma` ON DELETE CASCADE | |
| `yaka` | TEXT | NOT NULL | `M` / `B`; takvim satırlarında `''` (boş metin) |
| `bolum` | TEXT | NOT NULL | `personel.bolum` ile eşleşir (boşluk sadeleştirilmiş, büyük/küçük harf duyarsız `tr-TR`); takvim satırında `''` |
| `ay` | INTEGER | NOT NULL | 1–12 |
| `alan` | TEXT | NOT NULL | Aşağıda |
| `deger` | REAL | NULL | |

PK: (`calisma_id`, `yaka`, `bolum`, `ay`, `alan`).

| Alan | Satır türü | Anlamı |
|---|---|---|
| `fm1` | yaka+bölüm | Hafta içi toplam mesai saati (yalnız mavi yakada kullanılır) |
| `fm2` | yaka+bölüm | Hafta sonu toplam mesai saati |
| `kisi` | yaka+bölüm | Personel sayısı; boş = çalışmada o yaka ve bölümdeki kişi sayısı |
| `gun`, `tatil_mesai`, `tatil_tam`, `tatil_yok` | takvim (`yaka=''`, `bolum=''`) | Bilgi amaçlı takvim satırları (hesapta kullanılmaz) |

Kişi başı mesai = bölüm saati / kişi sayısı (`api.js:mesaiKisiBasi`). Tablo kişilerin mesaisini **yalnız** `calisma_ayar.mesai.ongoru = '1'` iken belirler (§2.20 notu). **Yazan:** `seed.js:ORNEK_VERI_YUKLE` (Üretim grubu: takvim `gun` satırları + dört mavi yaka bölümünün `fm1/fm2`'si; `mesai.ongoru` açık); `api.js:mesaiYaz` (`aylik.yaz`; bilinmeyen alan ya da 1–12 dışı ay reddedilir; boş değer satırı siler), `mesaiKopyala` (başka çalışmadan; hedefteki tablo silinip yazılır), `KOPYA`. `YENI_YIL` kopyalamaz.

### 2.23 `calisma_parametre` — onaylı çalışmanın dondurulmuş parametreleri

| Sütun | Tip | NULL/Vars. | Anlamı |
|---|---|---|---|
| `calisma_id` | INTEGER | PK, FK → `calisma(id)` ON DELETE CASCADE | |
| `yil` | INTEGER | NOT NULL | Çalışmanın yılı |
| `veri` | TEXT | NOT NULL | Yılın bütün hesap parametrelerinin **JSON** görüntüsü |
| `tarih` | TEXT | NULL | Dondurma anı (ISO) |

`veri` JSON yapısı (`schema.js:PARAMETRE_ANLIK_AL`; her dizi elemanı ilgili tablonun satırının bütün sütunlarıdır, `parametre` hariç). Değerler başlangıç verisinden:

```json
{
  "parametre":  [{ "anahtar": "dv", "deger": "0.00759" }, …, { "anahtar": "perf.model", "deger": "{\"amirler\":[…],\"yaka\":{…}}" }],
  "dilim":      [{ "yil": 2026, "sira": 1, "ust_sinir": 190000, "oran": 0.15 }, …, { "ust_sinir": null, … }],
  "asgari":     [{ "yil": 2026, "baslangic_ay": 1, "brut": 33030 }],
  "tur":        [{ "yil": 2026, "kod": "SSK", "ad": "…", "kol": "SSK", "sgk_isci": 0.14, … , "aciklama": "…" }, …],
  "kanun":      [{ "kod": "05510", "ad": "05510 - %2", "kural": "05510", "aciklama": "…", "sira": 2, "oran": 0.02 }, …],
  "sakatlik":   [{ "yil": 2026, "derece": 1, "tutar": 12000 }, …],
  "performans": [{ "yil": 2026, "alt_puan": …, "ust_puan": …, "carpan": … }]
}
```

- **Yazan:** `schema.js:PARAMETRE_DONDUR` (`INSERT OR IGNORE` — var olanın üzerine yazmaz): durum `TASLAK → ONAYLI` yapılırken (`api.js:calismaKaydet`) ve örnek verinin 2026 çalışmaları onaylanırken (`seed.js:ORNEK_VERI_YUKLE`).
- **Silen:** `ONAYLI → TASLAK` geçişi.
- **Kullanan:** `api.js:calismaHesapla` — `durum = 'ONAYLI'` ise `hesapParametre(yil, calismaParametreAnlik(id))`; değilse yılın güncel tabloları. `api.js:calismaPerformansModeli` — onaylı çalışmanın değerlendirme modeli görüntüdeki `perf.model` satırıdır (yoksa varsayılan model). `calisma_ayar` dondurulmaz (onaylı çalışmada zaten yazılamaz).
- `parametre` dizisi o yılın **bütün** anahtarlarını içerir; ileride eklenen bir parametre de kendiliğinden dondurulur. Görüntüde olmayan anahtar (ör. onaydan sonra eklenmiş) için hesap kod içi varsayılanı kullanır.

### 2.24 İndeksler

| İndeks | Tablo (sütunlar) |
|---|---|
| `ix_log_tarih` | `islem_log (tarih)` |
| `ix_personel_ad` | `personel (ad_soyad)` |
| `ix_aylik_calisma` | `aylik_girdi (calisma_id, ay)` |

### 2.25 Kod değer kümeleri (başka sistemde enum/kısıt olarak kurulabilir)

| Yer | Değerler | Kaynak |
|---|---|---|
| `calisma.durum` | `TASLAK`, `ONAYLI` | `api.js:calismaKaydet`, `calismaYazIste` |
| `calisma_personel.yaka`, `mesai_ongoru.yaka` | `B`, `M` (`mesai_ongoru`'da ayrıca `''`) | `api.js:calismaPersonelKaydetIc`, `mesaiYaz` |
| `calisma_personel.onay_sabit` | `0`, `1`, `2` | §3.4 |
| `calisma_personel.bes`, `aylik_girdi(bes)` | `EVET`, `HAYIR`, NULL | `hesap.js:ayHesapla` (`g.bes === 'EVET'`) |
| `personel.kaynak` | `ELLE`, `ERP`, `ORNEK` | `schema.js` yorumu, `api.js`, `seed.js` |
| `hesap_turu.kol` | `SSK`, `SGDP`, `YOK` | `schema.js` yorumu |
| `kanun_turu.kural` | `YOK`, `05510`, `05746`, `14857`, `15510` | `schema.js` yorumu, `hesap.js` |
| `parametre(durum)` | `RESMI`, `ONGORU` | `api.js:parametreDurumu` |
| `sakatlik_derece.derece` | 1, 2, 3 | `seed.js:SEED_YUKLE` |
| `mesai_ongoru.alan` | `fm1`, `fm2`, `kisi`, `gun`, `tatil_mesai`, `tatil_tam`, `tatil_yok` | `api.js:mesaiYaz` |
| Performans ek puan kural türü (`perf.model` → `ek[].tur`) | `esik`, `kademe`, `carpan`, `liste` | `performans.js:TURLER` |
| `performans_girdi` `liste` türü alanlar | Modeldeki seçenekler (varsayılan modelde `egitim`, §2.21); büyük harfe çevrilerek karşılaştırılır | `performans.js:hazirla` |
| Ay alanları | 1–12 | |

---

## 3. Tablolar arası ilişkiler ve veri kuralları

### 3.1 İlişki şeması (FK'ler, metin hâlinde)

```
kullanici (kullanici_adi) ─┬─< kullanici_yetki (kullanici_adi, yetki_kod)        [UPD/DEL CASCADE]
                           └─< kullanici_grup  (kullanici_adi, grup_kod, yazma)  [UPD/DEL CASCADE]
                                        │
grup (kod) ─────────────────────────────┘ (kullanici_grup.grup_kod)              [UPD/DEL CASCADE]
  ├─< butce_bolumu (id; grup_kod, ad)                                           [UPD CASCADE]
  └─< calisma (id; yil, grup_kod, ad)                                           [UPD CASCADE]
         ├─< calisma_ozet      (calisma_id, anahtar)                            [DEL CASCADE]
         ├─< calisma_ayar      (calisma_id, anahtar)                            [DEL CASCADE]
         ├── calisma_parametre (calisma_id) 1:0..1                              [DEL CASCADE]
         ├─< mesai_ongoru      (calisma_id, yaka, bolum, ay, alan)              [DEL CASCADE]
         ├─< calisma_personel  (calisma_id, tc_kimlik_no)                       [DEL CASCADE]
         ├─< aylik_girdi       (calisma_id, tc_kimlik_no, ay, alan)             [DEL CASCADE]
         └─< performans_girdi  (calisma_id, tc_kimlik_no, alan)                 [DEL CASCADE]

personel (tc_kimlik_no)
  ├─< calisma_personel.tc_kimlik_no                                             [UPD/DEL CASCADE]
  ├─< aylik_girdi.tc_kimlik_no                                                  [UPD/DEL CASCADE]
  └─< performans_girdi.tc_kimlik_no                                             [UPD/DEL CASCADE]

Bağımsız (FK'siz) tablolar: sistem_bilgi, islem_log, kanun_turu,
  parametre, gv_dilim, asgari_ucret, hesap_turu, sakatlik_derece, performans_kademe
  (son altısı YIL ile gruplanır)
```

`─<` = bire-çok. `grup`'a bağlı `butce_bolumu` ve `calisma`'da ON DELETE tanımsızdır: çalışması olan grup FK nedeniyle de silinemez; bölümleri `grupSil` kendisi siler. Not: `aylik_girdi` ve `performans_girdi`'nin `calisma_personel`'e FK'si **yoktur**; yalnız `calisma` ve `personel`'e ayrı ayrı bağlıdırlar. Kişi çalışmadan çıkarılırken bu satırları kod siler (`api.js:calismaPersonelSil`, `calismaPersonelTasi`). Başka sisteme aktarırken yetim satır denetimi yapılmalı (§8.3).

### 3.2 Mantıksal bağlar (veritabanında FK yok, kodda var)

| Kaynak | Hedef | Eşleşme | Not |
|---|---|---|---|
| `calisma_personel.butce_bolumu` | `butce_bolumu` | (`calisma.grup_kod`, `ad`) | Ad ile; ad değişikliği kodla yayılır |
| `calisma_personel.hesap_turu`, `aylik_girdi(alan='hesap_turu').deger` | `hesap_turu` | (`calisma.yil`, `kod`) | Yıl çalışmadan gelir; karşılıksız kod = SGK'sız hesap (§2.8) |
| `calisma_personel.kanun`, `aylik_girdi(alan='kanun').deger` | `kanun_turu` | `kod` | Karşılıksız kod = teşvik yok |
| `calisma_personel.sakatlik_derece`, `aylik_girdi(sakatlik_derece)` | `sakatlik_derece` | (`calisma.yil`, `derece`) | Derece doluysa tutar tablodan |
| `calisma_personel.performans_puani` | `performans_kademe` | (`calisma.yil`, `alt_puan ≤ puan ≤ ust_puan`) | |
| `performans_girdi.alan` | Çalışmanın değerlendirme modeli (`parametre.perf.model`, onaylıda dondurulmuş kopya; yoksa `PERF.VARSAYILAN()`) | amir alanı, `aN.<kriter kodu>`, ek puan alanı kodu | Modelde artık olmayan alanın satırları kalır, hesaba girmez (§2.21) |
| `kullanici_yetki.yetki_kod` | `window.YETKILER` | kod | Liste kodda, tabloda değil |
| `sistem_bilgi(aktarim.sozluk)` anahtarları | `api.js:AKTARIM_ALANLARI` | alan adı | Bilinmeyen alan yazılamaz |
| `mesai_ongoru.bolum` | `personel.bolum` | normalleştirilmiş ad | Bütçe bölümü DEĞİL |
| `calisma_ayar(dagilim.haric/dahil)` | `personel.tc_kimlik_no` | `,` ayrılmış metin | T.C. değişince güncellenmez |
| `calisma_parametre.veri` | `parametre`, `gv_dilim`, `asgari_ucret`, `hesap_turu`, `kanun_turu`, `sakatlik_derece`, `performans_kademe` | JSON kopya | Bilerek bağımsız (dondurma) |
| `islem_log.kullanici_adi` | `kullanici` | ad | FK yok, kayıt kalıcı |
| `parametre.yil`, `calisma.yil` | — | Yıl listesi bu ikisinin birleşimidir (`api.js:yillar`) | |
| `calisma_personel.maas_eski`, `calisma_personel.yol`, `aylik_girdi` tutarları | `calisma_ayar(ucret.esas)` | `calisma_id` | Tutarın net mi brüt mü olduğu yalnız çalışmanın esasından okunur. Kopya / yeni yıl / revize hedefe kaynağın esasını yazar; esası farklı iki çalışma arasında kişi taşınmaz, önceki yıl maaşı ön doldurulmaz (§3.4 madde 19) |

### 3.3 Bağımlılık sırası (yükleme / aktarma sırası)

`grup` → `kullanici` → `kullanici_yetki`, `kullanici_grup` → `kanun_turu`, yıl tabloları (`parametre`, `gv_dilim`, `asgari_ucret`, `hesap_turu`, `sakatlik_derece`, `performans_kademe`) → `butce_bolumu` → `personel` → `calisma` → `calisma_ozet`, `calisma_ayar`, `calisma_parametre`, `mesai_ongoru` → `calisma_personel` → `aylik_girdi`, `performans_girdi` → `islem_log`, `sistem_bilgi`.

### 3.4 Veri bütünlüğü ve yaşam döngüsü kuralları

Şemadan bağımsız olarak kodda uygulanan, veriyi başka bir sisteme aktaran ya da programı uyarlayan herkesin bilmesi gereken kurallar.

1. **Onaylı çalışma kilitlidir.** `durum = 'ONAYLI'` olan çalışmanın hiçbir verisi (kişi satırı, aylık girdi, özet, ayar, performans, mesai) değiştirilemez; yalnız durum (taslağa alma) ve açıklama değişir (`api.js:calismaYazIste`, `calismaKaydet`). Gerekçe (`calismaYazIste` yorumu): onaylanmış maliyet — hatalı olsa bile — sonradan değişmesin; düzeltme için çalışma taslağa alınır ya da revize açılır.
2. **Onaya alma (TASLAK → ONAYLI)** tek işlemde (`api.js:calismaKaydet`):
   - `ONAY_TARIH_DONDUR`: `onay_sabit = 0` olan satırlara `onay_sabit = 1`, `onay_giris/onay_cikis` = personel kartındaki o anki tarihler. (`onay_sabit = 2` satırlara dokunulmaz.)
   - `PARAMETRE_DONDUR`: yılın bütün hesap parametreleri JSON olarak `calisma_parametre`'ye (varsa üzerine yazılmaz).
3. **Taslağa alma (ONAYLI → TASLAK):** `onay_sabit = 1` olan satırlar `0`'a döner, `onay_giris/onay_cikis = NULL`; `calisma_parametre` satırı silinir. Güncel tarih ve parametreler geçerli olur, maliyet değişebilir. `onay_sabit = 2` korunur.
4. **`onay_sabit` anlamı:**
   - `0` → hesap ve sıralama personel kartının güncel `ise_giris/isten_ayrilis`'ini kullanır.
   - `1` → onay anındaki tarihler (kartta sonradan yazılan çıkış onaylı maliyeti değiştirmez).
   - `2` → çalışmanın **kendi dönem** tarihleri. Kişi kartında tarih değişirken (`api.js:donemTarihleriniKoru`; kişi kartı ve dış liste aktarımı çağırır), kişinin **diğer** çalışmalarındaki `onay_sabit = 0` satırlarına eski tarihler yazılıp `2` yapılır. Bir çalışmanın satırı `2` ise o çalışmadan yapılan tarih düzenlemesi **satıra** yazılır, karta dokunulmaz. Taslağa almak bunu çözmez.
   - Kural: hesapta tarih = `onay_sabit > 0 ? onay_giris/onay_cikis : personel.ise_giris/isten_ayrilis` (`api.js:calismaHesapla`, `calismaPersonelListe`, `personelGecmis`).
   - Grup değiştirmede (`calismaPersonelTasi`) `onay_sabit = 1` hedefte `0` olur; `2` ve tarihler aynen kopyalanır.
5. **Onaylı çalışma her zaman dondurulmuş parametreyle hesaplanır** (`calismaHesapla`: `c.durum === 'ONAYLI' ? calismaParametreAnlik(id) : null`) ve **dondurulmuş modelle değerlendirilir** (`calismaPerformansModeli`). Yeni yılın resmî rakamları, mesai katsayıları ya da değerlendirme modeli sonradan değişse de onaylı maliyet değişmez; güncel değerlerle yeni hesap için **revize** açılır.
6. **Revize** (`api.js:calismaRevizeAc`): herhangi bir çalışmanın (genellikle onaylının) birebir **TASLAK** kopyası; ad `"<yıl> Revize"`, çakışırsa `"<yıl> Revize 2"`, `3`…; `zam_kademe`, `zam_performans` ve ücret esası kaynaktan; `KOPYA` türü veri aktarımı (madde 9). Tek işlemdir: kopya yarıda kalırsa boş revize de oluşmaz. Revize yılın **güncel** parametreleriyle hesaplanır.
7. **Öngörü onaylı yılı ezemez** (`api.js:ongoruUygula`): hedef yılda (herhangi bir grupta) onaylı çalışma varsa yeni yıl öngörüsü reddedilir. Öngörü önce yasal olmayan tabloları kopyalar (`yilKopyalaIc`, yalnız eksikleri), sonra asgari ücret / dilim / sakatlık satırlarını yeniden yazar ve `durum = 'ONGORU'` + `ongoru.*` anahtarlarını kaydeder. Kaynak yılda dilim ya da sakatlık tutarı yoksa durur. Asgari ücrette kaynak yılın **son** dönemi esas alınır.
8. **AR-GE günü varsayılansız:** motor yıl parametresinden AR-GE günü almaz (`P.argeGun = 0`); `calisma_ayar.arge_gun` varsa o geçerli; kişiye `aylik_girdi.arge_gun` girilir ve sonraki aylara devreder (`api.js:calismaHesapla`, `AYLIK_SUREKLI`). Kişinin aylık AR-GE günü yoksa çalışma ayarı yalnız GV teşvik oranı yılın `arge_gv_esik` parametresine (vars. 0,8) ulaşan kişide kullanılır (`hesap.js:ayHesapla`, `r.AP`).
9. **Çalışma kopyalama** (`api.js:calismaPersonelKopyala`; kaynak ve hedef aynı grupta olmalı; hedef taslak olmalı; `tur` `'KOPYA'` değilse `YENI_YIL` kuralı uygulanır):
   - `KOPYA` (aynı yıl, senaryo/revize): `calisma_personel` (`CP_ALANLAR` — `onay_*` sütunları **hariç**), `aylik_girdi`, `calisma_ozet`, `performans_girdi`, `mesai_ongoru` birebir; `calisma_ayar` tamamı. Hepsi `INSERT OR IGNORE`.
   - `YENI_YIL` (önceki yıldan): kaynak yılın **zamlı** maaşı hedefin `maas_eski`'si; kaynak yılın hesaplanan yıllık maliyeti `maliyet_onceki`; `zam_ayi = 1`, `duzeltme = 0`, performans puanı/çarpanı ve `karsilastirma` boş; `sira`, `butce_bolumu`, `yaka`, `not_metni` aynen; hesap türü / kanun / sakatlık / özürlü / BES / GV teşvik / yol **Aralık'taki geçerli değerle** (Şubat–Aralık aylık girdilerinden son değişiklik, yoksa satırdaki değer). Kaynak yıl içinde (ya da daha önce) ayrılanlar (çıkış tarihi kartta güncel okunur; kartta yoksa dönem çıkışı) ve hedef yılda başka grupta kaydı olanlar aktarılmaz. `calisma_ayar` kopyalanır **ama** `gun.%`, `dagilim.%`, `arge_gun` ve `tesvik.k05510` dışındaki `tesvik.%` hariç. Aylık girdiler, özet, performans girdileri ve mesai tablosu taşınmaz (mesai tablosu gerekiyorsa `mesaiKopyala` ile ayrıca kopyalanır).
10. **Grup değiştirme** (`calismaPersonelTasi`): aynı yılın iki TASLAK çalışması arasında kişi bütün bilgileriyle (satır, aylık girdi, performans girdisi) taşınır ve kaynaktan silinir; hedefte bölüm adı yoksa `butce_bolumu = NULL`; hedefte kişi zaten varsa reddedilir.
11. **Okuma yetkisi:** kullanıcının göremediği grubun verisi API'den de okunamaz (`calismaOkuIste`); kişi verisi döndüren işlevler ayrıca okuma yetkisi ister (§5.7). Aynı yıl başka grupta kayıtlı T.C.'ler için yalnız "var/yok" döner, grup adı verilmez (`tcBaskaGrupta`).
12. **Bütçe bölümü:** ad numarasız, sıra ayrı; ad değişikliği aynı grubun bütün yıllarına yayılır; aynı grupta aynı sıra numarası yasak; kullanımdaki bölüm silinemez (§2.7).
13. **Kullanımdaki tanım silinemez:** hesap türü (o yılın kişi satırında ya da aylık girdisinde), kanun türü (kişi satırında ya da aylık girdide), bütçe bölümü (satırı varsa), grup (çalışması varsa).
14. **En az bir etkin yönetici** kalmalı.
15. **Performans çarpanı önceliği:** `performans_carpani` doluysa o; değilse `performans_puani` → `performans_kademe`; hiçbiri yoksa 1. Çarpan yalnız `calisma.zam_performans = 1` iken zam oranını çarpar (`api.js:performansCarpani`, `hesap.js:zamHesapla`).
16. **Mesai öngörüsü önceliği:** `mesai.ongoru = '1'` iken kişinin `fm1/fm2`'si tablodan; kişiye o ay elle girilmişse elle girilen.
17. **Yeni yıl parametre kopyası:** `yilKopyalaIc` yalnız eksik satırları (`INSERT OR IGNORE`) kopyalar: `parametre` (değerlendirme modeli `perf.model` ve mesai / AR-GE / yuvarlama katsayıları dâhil), `gv_dilim`, `asgari_ucret`, `hesap_turu`, `sakatlik_derece`, `performans_kademe`. (`kanun_turu` yıldan bağımsızdır.)
18. **Değerlendirme modeli yıl bazındadır:** her yılın modeli ayrıdır; bir yılın modelini değiştirmek diğer yılları etkilemez. Taslak çalışma yılının güncel modeliyle, onaylı çalışma onay anındaki modelle değerlendirilir. Modelde artık olmayan alanların girdileri silinmez (§2.21).
19. **Ücret esası (net / brüt) çalışma bazındadır** (`calisma_ayar.ucret.esas`; `api.js:ucretEsasi`, `ucretEsasiYazIc`, `api.js` "ÜCRET ESASI" yorumu). Net ile brüt arasında aydan aya değişmeyen kesin bir karşılık olmadığı için kod tutarları hiçbir zaman dönüştürmez; bunun yerine esasın karışmasını engeller:
    - **Esasa bağlı tutarı olan çalışmanın esası değiştirilemez:** bütçe satırı (`calisma_personel`) ya da aylık girdi kaydı (`aylik_girdi`) varsa `calismaAyarYaz` hata atar (`api.js:esasBagli`; girilmiş tutarlar öbür esasta yanlış okunurdu). Esas yeni çalışma açılırken seçilir (`calismaKaydet({…, ucret_esas})`, yalnız `NET` / `BRUT`) ya da çalışmaya tutar girilmeden önce değiştirilir. Onaylı çalışmada ayar zaten yazılamaz.
    - **Yeni yıl, kopya ve revize kaynağın esasını devralır** (`calismaPersonelKopyala`: esaslar farklıysa ve hedefte bütçe satırı ya da aylık girdi yoksa kaynağın esası hedefe, kopyalanan satırlarla **aynı işlemde** yazılır — kopya yarıda kalırsa hedef eski esasında kalır; hedef `esasBagli` ise "aktarılamaz" hatası). Böylece önceki yıl maaşı ile yeni maaş hep aynı esastadır.
    - **Esası farklı çalışmalar arasında kişi taşınmaz** (`calismaPersonelTasi` hata atar; `tasimaHedefleri` bu çalışmaları listelemez).
    - **Dış liste aktarımı:** maaş içeren satırlar için dosyanın esası beyan edilmeli ve çalışmanınkiyle aynı olmalı (`erpAktar` → `maasEsasi`, §2.19).
    - **Ön doldurma:** `personelOnDoldur(tc, yil, hedefId)` önceki çalışma hedefle farklı esastaysa `maas_eski`'yi boş bırakır (`esasFarkli: true`).
    - **Birleşik görünüm:** `birlesikHesapla` `esaslar` ve `karisikEsas` döndürür; esaslar karışıksa maaş ve zam toplamları anlamsızdır (ekranlar göstermez), maliyetler esastan bağımsız olduğu için toplanır.
    - Zam kademesi eşikleri çalışmanın esasındaki maaşa uygulanır (aynı eşik net ve brüt çalışmada farklı maaş düzeyine karşılık gelir).

---

## 4. Şema sürümleri ve veri göçleri

Şu anki sürüm **1**'dir ve hiç göç tanımlı değildir: `SEMA_SURUM = 1`, `EKSIK_SUTUNLAR = []`, `TABLO_GOC = []`, `VERI_GOCLERI = []` (`schema.js`). Mekanizma, programı kendi kurumuna uyarlayan ya da ileride şemayı değiştirecek olanlar için hazır durmaktadır: var olan veri dosyaları elle müdahale gerekmeden yeni şemaya yükseltilir.

### 4.1 Sürüm denetimi nasıl çalışır (`engine.js:surumKontrol`)

Dosyadaki sürüm `sistem_bilgi.sema_surum`'dadır (kayıt yoksa 0 sayılır). Dosya açılırken ve yedekten geri yüklenirken, dosyadaki sürüm koddaki `SEMA_SURUM`'dan **küçükse** sırasıyla:

1. `eksikSutunlariEkle()` — `EKSIK_SUTUNLAR`'daki sütunlar `PRAGMA table_info` ile denetlenir, yoksa `ALTER TABLE … ADD COLUMN`.
2. `tabloGocleriUygula()` — `TABLO_GOC` (tablo yeniden kurma, §4.3).
3. `db.exec(SEMA_SQL)` — `CREATE TABLE/INDEX IF NOT EXISTS` ile **yeni tablolar ve indeksler** eklenir.
4. `eksikSutunlariEkle()` yeniden (yeni kurulan tabloya dayanan sütunlar için).
5. `TEMEL_VERI_YAZ` — kanun türleri, yalnız `kanun_turu` tablosu **boşsa** (§5.2); hata verirse konsola yazılır, devam edilir.
6. `VERI_GOCLERI` içinden `eski sürüm < g.surum ≤ SEMA_SURUM` olanlar sırayla, **her biri ayrı işlemde** (BEGIN/COMMIT). Bir göç hata verirse ROLLBACK, sonraki göçler çalışmaz ve **sürüm yükseltilmez** (bir sonraki açılışta eski sürümden itibaren hepsi yeniden denenir).
7. `sema_surum = SEMA_SURUM` yazılır, kayıt planlanır.

Dosyadaki sürüm koddakine **eşit ya da büyükse** hiçbir şey yapılmaz (§9.2). Yeni kurulumda göç çalışmaz: şema doğrudan `SEMA_SQL` ile kurulur, `sema_surum = SEMA_SURUM` yazılır ve başlangıç verisi yüklenir (`engine.js:baslat`, §5.1).

### 4.2 `EKSIK_SUTUNLAR` — sonradan eklenen sütunlar

Biçim (`schema.js` yorumu, `engine.js:eksikSutunlariEkle`): `{ tablo, sutun, tanim, doldur? }`.

- `tanim`: `ALTER TABLE … ADD COLUMN <sutun> <tanim>` için sütun tanımı (ör. `'INTEGER NOT NULL DEFAULT 0'`; SQLite'ta eklenen NOT NULL sütunun varsayılanı olmalıdır).
- `doldur`: isteğe bağlı; sütun eklendikten hemen sonra çalışan SQL (var olan satırları doldurmak için).
- Kaydın sürüm alanı yoktur: liste her yükseltmede baştan taranır, sütun zaten varsa atlanır (tekrar çalıştırılabilir). Hata konsola yazılır, yükseltme durmaz.
- Uydurma örnek: `{ tablo: 'personel', sutun: 'eposta', tanim: 'TEXT' }`.

### 4.3 `TABLO_GOC` — tablo yeniden kurma

SQLite'ta `ALTER TABLE` kısıt, tip ya da yabancı anahtar değiştiremez; bunun için tablo yeniden kurulur. `engine.js:tabloGocleriUygula`'nın beklediği biçim: `{ tablo, gerekliSutun, yeni, tasi }`.

- Tablo varsa ve `gerekliSutun` sütunu **yoksa** (yani göç henüz uygulanmamışsa) tek işlemde: `yeni` (`CREATE TABLE <tablo>_yeni …`), `tasi` (`INSERT INTO <tablo>_yeni … SELECT … FROM <tablo>`), `DROP TABLE <tablo>`, `ALTER TABLE <tablo>_yeni RENAME TO <tablo>`.
- Hata olursa ROLLBACK ve konsola hata; **sürüm yine de yükseltilir** (veri göçlerinden farklı olarak) — göç bir sonraki sürüm yükseltmesine kadar denenmez.
- **Uyarı:** Yabancı anahtar açıkken (`PRAGMA foreign_keys = ON`; motor hep açık tutar, geçici olarak kapatmaz) `DROP TABLE`, tabloyu silmeden önce örtük bir `DELETE` yapar. Bu yüzden başka tabloların bağlı olduğu bir tabloda bu yol güvenli değildir: çocuk FK'si `ON DELETE CASCADE` ise çocuk satırlar **silinir** (`personel`, `calisma`, `kullanici` yeniden kurulursa bağlı bütün satırlar gider); eylemsiz FK varsa (`grup` → `butce_bolumu`, `calisma`) `DROP` "FOREIGN KEY constraint failed" verir ve göç geri alınır. İki durum da node:sqlite (SQLite 3.53) ile küçük tablolarda denendi. Böyle bir değişiklik gerekiyorsa göç, işlem dışında `PRAGMA foreign_keys = OFF` yapacak biçimde ayrıca yazılmalıdır.
- `schema.js`'teki yorum biçimi `{ surum, calistir(calistir, tumu) }` olarak yazar; çalışan kod yukarıdaki biçimi bekler (§9.2).

### 4.4 `VERI_GOCLERI` — veri dönüşümleri

Biçim: `{ surum, ad, calistir(calistir, tumu) }` (`schema.js` yorumu, `engine.js:surumKontrol`). `calistir(sql, parametreler)` yazar, `tumu(sql, parametreler)` satırları döndürür.

- Yalnız dosyanın eski sürümünden büyük, kodun sürümünden küçük ya da ona eşit `surum`'lu göçler, `VERI_GOCLERI` dizisindeki sırayla çalışır.
- Her göç kendi işlemindedir. Hata → ROLLBACK, kalan göçler atlanır, sürüm yükseltilmez; ama 1–5. adımların yaptığı şema değişiklikleri kalır. Bu yüzden göçler **tekrar çalıştırılabilir** yazılmalıdır (`INSERT OR IGNORE`, koşullu `UPDATE`).
- Göç kodu yetki denetiminden geçmez (`API` kullanılmaz, doğrudan SQL).

### 4.5 Şemayı değiştirirken izlenecek sıra

1. `SEMA_SQL`'deki `CREATE TABLE` tanımını güncelleyin — yeni kurulumlar yalnız bunu çalıştırır.
2. Var olan dosyalar için uygun mekanizmayı ekleyin: yeni sütun → `EKSIK_SUTUNLAR`; yeni tablo/indeks → başka bir şey gerekmez (`SEMA_SQL` `IF NOT EXISTS` ile kurar); kısıt/tip değişikliği → `TABLO_GOC` (§4.3 uyarısı); veri dönüşümü → `VERI_GOCLERI` (`surum` = yeni sürüm).
3. `SEMA_SURUM`'u bir artırın. Artırılmazsa var olan dosyalarda hiçbir adım çalışmaz.
4. `api.js`'teki sütun listelerini güncelleyin: `CP_ALANLAR`, `CP_SAYISAL`, `CP_BOS_OLABILIR` (kişi satırı), `AYLIK_SUREKLI` / `AYLIK_TEK` / `AYLIK_KISI_ALANLARI` (aylık alanlar), `calismaPersonelKopyala` ve `calismaPersonelTasi`'nın kopyaladığı sütunlar, yıl tablosuysa `yilKopyalaIc` listesi ve `PARAMETRE_ANLIK_AL`.
5. Yeni yetki gerekiyorsa `YETKILER`'e ekleyin (§5.7).
6. `TEMEL_VERI_YAZ` yalnız boş `kanun_turu` tablosuna yazar; ona eklenen yeni bir kanun türü var olan dosyalara **ulaşmaz** (kullanıcının sildiği ya da değiştirdiği türler de geri gelmez). Var olan dosyalara yeni temel kayıt eklemek gerekiyorsa `INSERT OR IGNORE` kullanan bir `VERI_GOCLERI` kaydı yazılır.
7. Yeni bir yıl parametresi eklerken `PARAMETRE_TANIM`'a varsayılanıyla ekleyin ve `hesapParametre`'de okuyun: kayıt yoksa (eski yıllar, eski onay görüntüleri) varsayılan geçerli olur, göç gerekmez. Yeni yıla kopyalanması ve onayda dondurulması kendiliğindendir (§2.11).
8. Eski sürümlü bir dosyayla ve eski bir yedekten geri yüklemeyle deneyin (geri yükleme de `surumKontrol` çalıştırır).

---

## 5. Başlangıç verisi ve örnek veri

### 5.1 Akış

`app.js:baslat` → `ADB.baslat(() => API.seedYukle())`. Dosya yoksa (`GET /veri` → 204) ve tarayıcıda eski veri de yoksa (`engine.js:baslat`):

1. Sunucu kipindeyse veri şifreleme parolası sorulur (dosya diske ilk yazılmadan; §6.5).
2. `SEMA_SQL` kurulur, `sema_surum = SEMA_SURUM` (`"1"`) yazılır.
3. `API.seedYukle` → `TEMEL_VERI_YAZ` (kanun türleri) + `SEED_YUKLE` (2026 yasal parametreleri). **Grup, personel ve kullanıcı yoktur.**
4. `kaydetHemen(true)` ile dosyaya yazılır.
5. Kullanıcı tablosu boş olduğundan **ilk kurulum** açılır (`app.js:ilkKurulumEkrani`): ilk yönetici hesabı oluşturulur, oturum açılır ve başlangıç seçeneğine göre örnek veri yüklenir ya da boş başlanır (§5.4).

Üçü de **yeniden çalıştırılabilir**dir: `SEED_YUKLE` ve `ORNEK_VERI_YUKLE` var olan kayıtları `INSERT OR IGNORE` ile atlar (`seed.js` başlık yorumu); `TEMEL_VERI_YAZ` tablo doluysa hiçbir şey yazmaz.

### 5.2 `TEMEL_VERI_YAZ` (`schema.js`) — her yeni veritabanında ve her sürüm yükseltmesinde çağrılır

Yalnız kanun türlerini yazar, o da yalnız `kanun_turu` tablosu **boşsa** (`INSERT … SELECT … WHERE NOT EXISTS (SELECT 1 FROM kanun_turu)`): kullanıcı Tanımlar'dan bir türü silmiş ya da değiştirmişse sürüm yükseltmesi onu geri getirmez; tablo tamamen boşaltılmışsa altı tür yeniden yazılır (node:sqlite ile denendi). **Grup açmaz** (gruplar kullanıcıdan ya da örnek veriden gelir).

| kod | ad | kural | aciklama | sira | oran |
|---|---|---|---|---|---|
| `YOK` | TABİ DEĞİL | `YOK` | Teşvik yok | 1 | NULL |
| `05510` | 05510 - %2 | `05510` | SGK işveren payında 2 puan indirim (imalat dışı) | 2 | 0.02 |
| `05510-5` | 05510 - %5 | `05510` | SGK işveren payında 5 puan indirim (imalat sektörü) | 3 | 0.05 |
| `05746` | 05746 - ARGE | `05746` | AR-GE: işveren SGK payının yarısı + 05510 indirimi | 4 | NULL |
| `14857` | 14857 - ENGELLİ %100 | `14857` | Engelli: asgari ücret üzerinden işveren payı | 5 | NULL |
| `15510` | 15510 - %5 | `15510` | Emekli (SGDP) çalışanda %5 indirim | 6 | NULL |

### 5.3 `SEED_YUKLE` (`data/seed.js`) — 2026 yılının yasal parametreleri

Yıl kodda sabittir (`YIL = 2026`). Sonraki yıllar programın kendi işlemleriyle açılır: yeni yıl öngörüsü (`ongoruUygula`) ya da yıl kopyalama (`yilKopyala`). Dosya yorumundaki uyarı: **yasal rakamları her yıl resmî kaynaktan kontrol edin.**

**`parametre` (yil = 2026):**

| anahtar | deger |
|---|---|
| `durum` | `RESMI` |
| `tavan_carpan` | 9 |
| `dv` | 0.00759 |
| `istisna_kesinti` | 0.15 |
| `bes_orani` | 0.03 |
| `t05510` | 0.02 |
| `t05746` | 0.09875 (= 0.1975 / 2) |
| `t14857` | 0.1975 |
| `t15510` | 0.05 |
| `zam.M.alt_esik`, `zam.B.alt_esik` | 50000 |
| `zam.M.ust_esik`, `zam.B.ust_esik` | 100000 |
| `zam.M.ust_oran`, `zam.B.ust_oran` | 0.30 |
| `zam.M.alt_oran`, `zam.B.alt_oran` | 0.25 |

Zam kademesi değerleri yasal değildir, **örnek başlangıç değeridir** (dosya yorumu); kurum kendi zam politikasına göre değiştirir. `arge_gv_esik`, `mesai_fm1_kat`, `mesai_fm2_kat`, `mesai_gun_saat`, `zam_yuvarla` ve `perf.model` yazılmaz: kayıt eklenene kadar kod içi varsayılanlar (0.8, 1.5, 2, 7.5, 10, varsayılan değerlendirme modeli) geçerlidir (§2.11, §5.8).

**`gv_dilim` (2026):** 1: ≤ 190.000 → %15 · 2: ≤ 400.000 → %20 · 3: ≤ 1.500.000 → %27 · 4: ≤ 5.300.000 → %35 · 5: sınırsız (NULL) → %40.

**`asgari_ucret` (2026):** `baslangic_ay = 1`, `brut = 33030`.

**`sakatlik_derece` (2026):** 1 → 12000, 2 → 7000, 3 → 3000.

**`hesap_turu` (2026):**

| kod | ad | kol | sgk_isci | issizlik_isci | sgk_isveren | issizlik_isveren | gv | dv | istisna | sira | aciklama |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `SSK` | SSK (4/a — tüm sigorta kolları) | SSK | 0.14 | 0.01 | 0.2175 | 0.02 | 1 | 1 | 1 | 1 | Normal çalışan |
| `EMK` | Emekli (SGDP) | SGDP | 0.075 | 0 | 0.2475 | 0 | 1 | 1 | 1 | 2 | Emekli çalışan — sosyal güvenlik destek primi |
| `SGKSIZ` | SGK'sız (huzur hakkı / danışman) | YOK | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 3 | SGK primi hesaplanmaz; yalnızca gelir ve damga vergisi |

`performans_kademe`: **satır yüklenmez.**

Yeni bir veritabanında bu adımdan sonraki satır sayıları: `kanun_turu` 6, `parametre` 17, `gv_dilim` 5, `asgari_ucret` 1, `sakatlik_derece` 3, `hesap_turu` 3, `sistem_bilgi` 1; diğer bütün tablolar boş.

### 5.4 İlk kurulumda başlangıç seçimi (`app.js:ilkKurulumEkrani`)

İlk yönetici hesabı oluşturulup oturum açıldıktan sonra iki seçenekten biri uygulanır:

| Seçenek | Çağrı | Sonuç |
|---|---|---|
| **Örnek veriyle başla** (varsayılan seçili) | `API.ornekVeriYukle()` → `seed.js:ORNEK_VERI_YUKLE` | Uydurma iki grup, 56 kişi, 2026 onaylı ve 2027 taslak çalışmalar (§5.5). Programı denemek içindir |
| **Boş başla** | `API.varsayilanGrupAc()` | Hiç grup yoksa tek bir grup: `kod = 'GENEL'`, `ad = 'Genel'`, `sira = 1` (`grupKaydet` ile). Çalışma ve personel yok |

- İkisi de `sistem.yonet` ister; ilk yönetici bu yetkiye sahiptir. Hata olursa bildirim gösterilir, program yine açılır.
- `API.ornekVeriYukle` sonradan da çağrılabilir (`sistem.yonet`); var olan kayıtları atlar, ikinci kez çalıştırmak bir şey bozmaz (`api.js:ornekVeriYukle` yorumu).
- Örnek veriden gerçek kullanıma geçmek için veritabanı sıfırlanır (`engine.js:sifirla`, §6.7; ilk kurulum ekranındaki ipucu): yasal parametreler yeniden yüklenir, ilk kurulum yeniden açılır ve "Boş başla" seçilir.

### 5.5 `ORNEK_VERI_YUKLE` algoritması (`data/seed.js`)

Girdi: `window.ORNEK_VERI` (§5.6). Yasal parametrelerin (`SEED_YUKLE`) yüklenmiş olması gerekir. Adımlar:

1. **Tek işlemde, her grup için:** grup (`INSERT OR IGNORE`); grubun hiç bölümü yoksa bölümler `sira = 1, 2, …` ile; `<yıl> Bütçe` adlı çalışma zaten varsa grup atlanır. Yoksa çalışma `TASLAK` olarak açılır (`zam_kademe = 1`, `zam_performans` = grubun `performans` bayrağı, açıklama `Örnek veri — onaylı bütçe`); grubun `ayar`'ı `calisma_ayar`'a; her kişi için `personel` (`kaynak = 'ORNEK'`, `ekip` NULL), `calisma_personel` (`sira` = listedeki sıra) ve `ay` alanından `aylik_girdi` (ay 1 dâhil). Grubun `performans` bayrağı varsa değerlendirme girdileri `performans_girdi`'ye yazılır ve çarpanlar **yılın değerlendirme modeliyle** hesaplanıp (`API.performansModeli(2026)` → `PERF.hesapla(girdi, model)`; örnek kurulumda 2026'nın `perf.model` kaydı olmadığından varsayılan model) `performans_carpani`'ye yazılır (`performansCarpanUygula` ile aynı sonuç). Örnek verinin değerlendirme alanları (`a1.`/`a2.` önekleri, kriter ve ek puan alanı kodları) varsayılan modele göre üretilmiştir. Grubun `mesai` bayrağı varsa mesai öngörüsü tablosu (`ORNEK_VERI.mesai`) o grubun çalışmasına yazılır.
2. **Her yeni çalışma için ayrı işlemde:** çalışma hesaplanır; `calisma_ozet`'e bütçelenen (maliyetin %2 fazlası, bine yuvarlı) ve önceki yıl (`maliyet_onceki` toplamı) rakamları yazılır; durum `ONAYLI` yapılır, `ONAY_TARIH_DONDUR` ve `PARAMETRE_DONDUR` uygulanır.
3. 2027'nin asgari ücreti yoksa **yeni yıl öngörüsü**: `ongoruUygula({ kaynakYil: 2026, hedefYil: 2027, oran: 0.25, dilimAdim: 1000, sakatlikAdim: 100 })`.
4. Her grup için 2027'de çalışması yoksa: `calismaKaydet` ile `2027 Bütçe` (TASLAK, açıklama `Örnek veri — taslak`), `calismaPersonelKopyala(…, 'YENI_YIL')`; kaynakta mesai tablosu varsa `mesaiKopyala`; Ocak'ta AR-GE günü girilmiş kişilere 2027 Ocak'ı için `aylikGirdiToplu(…, 'arge_gun', 22, …)` (AR-GE günü yeni yıla kendiliğinden geçmez, madde 9 / §3.4); kaynakta düzeltmesi olan ve yıl içinde ayrılmamış kişilere aynı düzeltme `calismaPersonelAlanYaz(…, 'duzeltme', …)` ile yeniden girilir (düzeltme de yeni yıla kendiliğinden geçmez).
5. Dönüş: `{ gruplar, kisi, calisma }`.

2–4. adımlar programın kendi API işlevlerini kullanır; bu yüzden oturum açmış bir yöneticinin yetkisiyle çalışır ve işlem kaydına (`islem_log`) normal kayıtlar düşer. Bütün yükleme tek bir işlem değildir: yarıda kalırsa önceki adımların yazdıkları kalır.

**Sonuç** (örnek veriyle kurulmuş bir veritabanında sayılmıştır; `data/ornek-veri.js` yeniden üretilirse değişebilir):

| Tablo | Satır | Açıklama |
|---|---|---|
| `grup` | 2 | `OFIS` "Ofis", `URETIM` "Üretim" |
| `butce_bolumu` | 12 | Ofis 7, Üretim 5 |
| `personel` | 56 | hepsi `kaynak = 'ORNEK'` |
| `calisma` | 4 | 2026 Bütçe × 2 (`ONAYLI`), 2027 Bütçe × 2 (`TASLAK`) |
| `calisma_personel` | 111 | 2026: 25 + 31; 2027: 25 + 30 (2026'da ayrılan bir kişi yeni yıla aktarılmaz) |
| `calisma_parametre` | 2 | iki onaylı çalışma |
| `calisma_ozet` | 8 | onaylı çalışma başına `butce_B/M`, `onceki_B/M` |
| `calisma_ayar` | 28 | zam kademeleri, Üretim'de ayrıca `zam.yuvarla_ongoru` ve `mesai.ongoru` |
| `performans_girdi` | 412 | Üretim 2026: 30 kişi (2026'da işe girenler değerlendirilmez) |
| `mesai_ongoru` | 216 | Üretim 2026 ve 2027, her birinde 12 takvim + 96 bölüm satırı |
| `aylik_girdi` | 168 | |
| `parametre` | 44 | 2026 `RESMI` (17), 2027 `ONGORU` (27) |

### 5.6 Örnek verinin üretimi (`tools/ornek-veri-uret.mjs`)

`data/ornek-veri.js` elle yazılmaz; `node tools/ornek-veri-uret.mjs` ile üretilir (dosya başındaki yorum: "Elle düzenlemeyin; üreteci değiştirip yeniden çalıştırın").

- **Deterministik:** Bütün değerler sabit tohumlu (`TOHUM = 2026`) bir rastgele sayı üretecinden (mulberry32) gelir; aynı üreteç her çalıştırmada aynı dosyayı üretir.
- **Gerçek kişi ya da kurum verisi yoktur.** Adlar `ÖRNEK ÇALIŞAN 001` … `056` biçimindedir; değerlendirmedeki amir adları da aynı biçimde uydurmadır.
- **T.C. numaraları kasıtlı olarak geçersizdir:** `99` + 7 haneli sıra numarası; 10. hane kurala göre hesaplanır, 11. (kontrol) hanesi bilerek yanlış yazılır (`gecersizTc`). Hiçbir gerçek kişiye ait olamaz. Program kontrol hanesini denetlemediği için (§1.3) bu numaralarla çalışır.
- **Tutarlar ve tarihler rastgeledir:** önceki yıl maaşı bölüm × yaka bandında rastgele, önceki yıl maliyeti maaş × 12 × 1,45–1,6; işe giriş 2008–2025 arası.
- **Her hesap kuralı en az bir kez görünür:** AR-GE personeli (05746, GV teşviki 0,8, Ocak'tan 22 AR-GE günü), emekli (EMK + 15510), SGK'sız danışman, engelli (14857 + sakatlık derecesi), yıl içinde giren ve çıkan, Temmuz'da zam, bayram ayni yardımı, üç ayda bir satış primi, yakıt yardımı, hafta sonu mesaisi, ücretsiz izin (çalışılan gün), BES katılımı, yol parası, zam düzeltmesi; Üretim grubunda performans değerlendirmesi (bölümlerin not ortalamaları bilerek farklı) ve mesai öngörüsü.

**`window.ORNEK_VERI` yapısı:**

| Alan | Yapı |
|---|---|
| `yil` | Örnek verinin yılı (2026) |
| `gruplar` | Dizi; her eleman `{ kod, ad, sira, bolumler: [bölüm adları], ayar: { calisma_ayar anahtarı: değer }, performans?: true, mesai?: true }` |
| `personel` | Dizi; her eleman `{ tc, ad, grup, butce_bolumu, bolum, gorev, yaka, ise_giris, cikis, maas_eski, maliyet_onceki, hesap_turu, kanun, bes, sakatlik_derece, gv_tesvik, yol, duzeltme, zam_ayi?, ay }`; tarihler `YYYY-MM-DD`; `ay` = `{ "<ay no>": { aylik_girdi alanı: değer } }` (yalnız girilen aylar ve alanlar) |
| `performans` | Nesne: `{ "<T.C.>": { performans_girdi alanı: değer } }` (§2.21 alan adları) |
| `mesai` | Dizi; her eleman 5'li dizi `[yaka, bölüm, ay, alan, değer]`; takvim satırında yaka ve bölüm `''` |

> `data/ornek-veri.js` ve `data/seed.js`, `index.html` tarafından **her açılışta** yüklenir (yalnız ilk kurulumda kullanılsa da). Başka bir sisteme aktarılırken bu dosyalar taşınmaz; veri veritabanından gelir.

### 5.7 `window.YETKILER` — yetki listesi (`schema.js`)

| Kod | Açıklama |
|---|---|
| `ozet.oku` | Özet ve maliyet tablolarını görür |
| `personel.oku` | Bütçe personel listesini görür |
| `personel.yaz` | Bütçeye personel ekler / düzenler |
| `zam.oku` | Zam çalışmasını görür |
| `zam.yaz` | Zam düzeltmesi girer |
| `aylik.yaz` | Aylık girdileri (ayni yardım, prim, mesai…) düzenler |
| `alan.tc` | T.C. Kimlik No'yu tam görür |
| `parametre.oku` | Parametre ve tanımları görür |
| `parametre.yaz` | Parametre ve tanımları değiştirir |
| `excel.aktar` | Excel çıktısı alır / Excel'den içeri aktarır |
| `sistem.yonet` | Kullanıcı, yetki, yedek ve sistem ayarları |

**Yazma kuralları** (`api.js:yetkiVar`, `yetkiIste`): `yonetici = 1` → her yetki. `.yaz` ya da `.yonet` ile biten yetkiler yazma kilidi başkasındayken de reddedilir. Grup yazma hakkı (`kullanici_grup.yazma`) ayrıca gerekir. Hangi işlemin hangi yetkiyi istediği:

| Yetki | İşlemler (`api.js`) |
|---|---|
| `personel.yaz` | Çalışma açma/düzenleme/silme/revize, çalışma ayarı, özet rakamı, kişi satırı ve kartı, kişi silme/taşıma/kopyalama, dış liste aktarımı (`erpAktar`), aylık girdilerdeki kişi alanları (hesap türü, kanun, sakatlık, özürlü, BES, GV teşvik, yol) |
| `zam.yaz` | `duzeltme`, `performans_puani`, `performans_carpani`; performans girdileri ve çarpan uygulama |
| `aylik.yaz` | Aylık tutarlar (ayni, prim, yakıt, çalışılan gün), mesai saatleri, AR-GE günü, mesai öngörüsü tablosu ve açma/kapama |
| `parametre.yaz` | Yıl parametreleri, GV dilimi, asgari ücret, sakatlık, performans kademesi, değerlendirme modeli (`performansModeliYaz`), yıl kopyası, öngörü, parametre durumu, hesap türü, kanun türü, bütçe bölümü, maaş aralığı, dış liste başlık sözlüğü (`aktarimSozlukYaz`) |
| `sistem.yonet` | Grup ekleme/düzenleme/silme, kullanıcılar ve erişimleri, oturum zaman aşımı, örnek veri, "Genel" grubu, şifreleme kurma/kaldırma, sıfırlama, (oturum açıkken) yedekten geri yükleme, işlem kaydını okuma |

**Okuma kapıları** (`api.js` "OKUMA KAPILARI"): kişi verisi döndüren işlevler dışarıya sarmalanmış olarak açılır ve kullanıcıda listelenen yetkilerden en az biri yoksa reddeder (yönetici muaf):

| Kapı | Yetkiler | İşlevler |
|---|---|---|
| `OKU_HESAP` | `sistem.yonet`, `ozet.oku`, `personel.oku`, `zam.oku`, `personel.yaz`, `zam.yaz`, `aylik.yaz`, `excel.aktar` | `calismaHesapla`, `birlesikHesapla`, `calismaOzetOku` |
| `OKU_PERSONEL` | `sistem.yonet`, `personel.oku`, `personel.yaz`, `zam.oku`, `zam.yaz`, `aylik.yaz`, `excel.aktar` | `calismaPersonelListe`, `calismaPersonelGetir`, `personelGetir`, `personelGecmis`, `personelOnDoldur`, `aylikGirdiHarita`, `mesaiOku` |
| `OKU_PERFORMANS` | `zam.oku`, `zam.yaz`, `personel.oku`, `personel.yaz` | `performansGirdiHarita`, `performansOncekiDonem` |
| — | `sistem.yonet` | `logListe`, `kullaniciListe`, `kullaniciYetkileri`, `kullaniciGruplari` |

`alan.tc` yoksa T.C. ekranda maskelenir (`123*****901`, `util.js:tcMaskele`). Kodun kendi sınırı (`api.js` yorumu): program tarayıcıda çalıştığı ve çözülmüş veritabanı oturum boyunca bellekte durduğu için bu denetimler ekran dışından API çağrısını engeller, tarayıcının geliştirici araçlarıyla doğrudan veritabanı okunmasını engelleyemez; tam koruma ancak sunucu tarafında kurulabilir.

### 5.8 Varsayılanların koddaki kopyaları

Parametre satırı yoksa motor şu varsayılanları kullanır (`api.js:hesapParametre`, `PARAMETRE_TANIM`, `ZAM_TANIM`): `tavan_carpan` 9, `dv` 0.00759, `bes_orani` 0.03, `istisna_kesinti` 0.15, `t05510` 0.02, `t05746` 0.09875, `t14857` 0.1975, `t15510` 0.05, `arge_gv_esik` 0.8, `mesai_fm1_kat` 1.5, `mesai_fm2_kat` 2, `mesai_gun_saat` 7.5, `zam_yuvarla` 10, zam kademesi 50000 / 100000 / 0.30 / 0.25; `perf.model` yoksa `PERF.VARSAYILAN()`. Aynı sayılar `hesap.js:ayHesapla` / `zamHesapla` içinde de ikinci kez varsayılan olarak durur (parametre nesnesinde değer yoksa). AR-GE günü 0 (`hesapParametre`, `argeGun: 0`). Zam öngörüsü yuvarlama adımının önceliği: `calisma_ayar.zam.yuvarla_ongoru` → `parametre.zam_yuvarla` → 10 (`api.js:calismaHesapla`). Varsayılan çalışılan gün 30 (`hesap.js:ayHesapla`). Oturum zaman aşımı 5 dk (`api.js:ZAMAN_ASIMI_VARSAYILAN`). Gelir vergisi dilimi ya da asgari ücret yoksa hesap hata verir ("… girilmemiş").

---

## 6. Depolama ve kayıt mekanizması

### 6.1 Depo kipleri (`engine.js` "DEPO KATMANI")

| Kip | Ne zaman | Asıl depo |
|---|---|---|
| `sunucu` | `GET /veri` yanıt verdiyse (200 ya da 204) | Diskteki `veri\butce.db` |
| `tarayici` | Sunucuya ulaşılamadıysa (ör. `index.html` çift tıklanarak açıldı) | Tarayıcının IndexedDB'si; ekranda "kayıtlar tarayıcıya yazılıyor" uyarısı çıkar (`app.js:depoUyarisi`) |

IndexedDB (`engine.js:idb*`): veritabanı adı `maas_butce_sistemi`, nesne deposu `veritabani`, anahtar `main`; değer = SQLite baytları (şifreleme açıksa şifreli paket). Sunucu kipinde iki işi kalır: (a) dosya yokken eski tarayıcı verisini **bir kez** dosyaya taşımak (`gocBekliyor`), (b) dosyaya yazılan son hâlin kopyasını tutmak (güvenlik ağı).

> Not: sunucu kapalıyken açılan bir oturumun kayıtları IndexedDB'de kalır ve dosya varken bir daha dosyaya alınmaz (tarayıcıdan dosyaya geçiş yalnız dosya yokken). Asıl kaynak her zaman `veri\butce.db`'dir.

### 6.2 Açılış (okuma)

`engine.js:depoOku`:
1. `GET /veri` (`cache: 'no-store'`). 204 → dosya yok, sürüm `'0'`. 200 → baytlar + `X-Veri-Surum` başlığı.
2. Baytlar `BTENC1` imzalıysa `sifreliDosyayiAc` (parola doğru olana kadar sorar).
3. Dosya yoksa IndexedDB'de eski veri varsa o alınır, `gocBekliyor = true`.
4. `new SQL.Database(bytes)`, `PRAGMA foreign_keys = ON`, `surumKontrol()`.
5. Tarayıcı verisi dosyaya geçecekse önce şifre parolası (bağlam `tasima`) sorulur, sonra hemen dosyaya yazılır.

sql.js, `js/vendor/sql-wasm.js` + base64 gömülü WebAssembly ikilisi `js/vendor/sql-wasm-binary.js` (`window.IK_SQL_WASM_B64`) ile yüklenir (`engine.js:sqlYukle`); internet gerekmez. sql.js sürümü dosyalardan **doğrulanamadı** (§9.1).

### 6.3 Yazma

| Adım | Ayrıntı | Kaynak |
|---|---|---|
| Tetikleme | Her `calistir`, `betik`, `islem` (COMMIT sonrası) → `kaydetGecikmeli()` | `engine.js` |
| Birleştirme | **400 ms** içindeki değişiklikler tek yazmada birleşir | `kaydetGecikmeli` |
| Sıralama | Yazmalar bir Promise zincirinde **sıraya** alınır (iki yazma aynı anda gitseydi ikincisi birincinin yeni sürümünü bilmez, sahte çakışma alırdı) | `kaydetHemen`, `yazmaZinciri` |
| Görüntüleme kipi | `KILIT.yazabilirMi()` false ise dosyaya **hiç yazılmaz** (`zorla` hariç); değişiklik yalnız bellekte kalır | `yazmaIsi` |
| Dışa aktarma | `db.export()` → SQLite dosyasının tamamı; ardından `PRAGMA foreign_keys = ON` | `ikiliAl` |
| Şifreleme | Anahtar varsa `paketle()` ile şifreli paket | `depoYaz` |
| Gönderme | `POST /veri`, gövde ham bayt, `Content-Type: application/octet-stream`, `X-Veri-Surum` başlığı | `sunucuyaYaz` |
| Yanıt | 200 → yeni sürüm **başlıktan** alınır; 409 → çakışma olayı; 423 → "şifresiz veri reddedildi" hatası | `sunucuyaYaz` |
| Güvenlik ağı | Başarılı yazmadan sonra aynı baytlar IndexedDB'ye | `depoYaz` |
| İşlem | `ADB.islem(fn)`: BEGIN…COMMIT; hata → ROLLBACK. İç içe çağrıda yalnız en dıştaki BEGIN/COMMIT yapar | `islem` |
| Sekme gizlenince | Bekleyen yazma hemen gönderilir | `visibilitychange` dinleyicisi |
| Sekme kapanırken | Şifreleme **kapalıysa** `navigator.sendBeacon('/veri?surum=…')` ile ham bayt + IndexedDB. Şifreleme **açıksa** düz veri gönderilmez: tarayıcının "sayfadan ayrıl?" sorusu çıkarılır, kayıt arka planda tamamlanmaya çalışılır | `beforeunload` dinleyicisi |

### 6.4 Sürüm denetimi (çakışma koruması)

- Sürüm = sunucudaki dosyanın **`LastWriteTimeUtc.Ticks`** değeri (.NET tick: 0001-01-01'den beri 100 ns), **metin** olarak `X-Veri-Surum` başlığında (JSON sayısı 19 haneyi yuvarlayacağı için). İstemci de metin tutar (`veriSurumu`).
- Okumada sürüm alınır; yazarken geri gönderilir (`sendBeacon` başlık koyamadığı için `?surum=` sorgu dizesiyle de kabul edilir).
- Sunucu: dosya varsa, gelen sürüm doluysa ve eşleşmiyorsa → **409** `{"basarili":false,"cakisma":true,"surum":"<mevcut>"}`; kayıt **reddedilir**. Gelen sürüm boşsa denetim yapılmaz.
- İstemci 409'da kapatılamayan "Kaydınız yazılmadı" perdesini açar; ekrandaki hâli yedek olarak indirme ve sayfayı yenileme seçenekleri vardır (`app.js:cakismaPerdesi`). Dosyadaki veri kaybolmaz; çakışan oturumun girdiği değişiklik dosyaya gitmez.
- Not (koddan çıkarım): görüntüleme kipinden yazar kipine geçen oturum veriyi **yeniden okumaz** (`app.js:kilitDurumuDegisti` yalnız ekranı tazeler). Arada başkası yazdıysa ilk kayıtta 409 alınır ve sayfa yenilenir. Ekranda denenmedi (§9.1).

### 6.5 Şifreleme

**Dosya biçimi** (`engine.js` "ŞİFRELEME" bölümü):

| Bayt aralığı | İçerik |
|---|---|
| 0–7 | İmza: ASCII `BTENC1` + iki sıfır bayt (`[66,84,69,78,67,49,0,0]`) |
| 8–23 | Tuz (16 bayt) — her parola kurulumunda/değişiminde yenilenir; **gizli değildir** |
| 24–35 | IV (12 bayt) — her yazmada yeniden üretilir |
| 36–son | AES-256-GCM şifreli SQLite dosyası; **son 16 bayt GCM etiketi** (WebCrypto etiketi şifreli metnin sonuna ekler). Ek doğrulanmış veri (AAD) yoktur |

**Anahtar türetme:** `PBKDF2(parola UTF-8 baytları, tuz, 250000 tur, SHA-256)` → 256 bit AES-GCM anahtarı (`anahtarUret`). Anahtar **yalnız tarayıcı belleğinde** durur; sunucuya ve diske hiç gitmez. Parola hiçbir yere yazılmaz. **Parola kaybolursa veri kurtarılamaz** (arka kapı yok). Yanlış parola GCM etiket denetiminde net hata verir (bozuk veriyle karışmaz). Veri parolası en az 8 karakter (`sifrelemeyiKur`).

**Şifreleme yalnız `sunucu` kipinde** ve `crypto.subtle` varken kullanılabilir (`sifrelemeKullanilabilir`).

**Tuzun saklanması:** Tuz `localStorage['butce_sifre_tuzu']`'nda base64 olarak da tutulur (`tuzuSakla`); sıfırlama sonrası aynı parolayla aynı anahtar türetilebilsin diye (bağlam `surdur`).

**Şifreleme-açık işaret dosyası:** `veri\sifreleme-acik` (veritabanının **dışında**; sıfırlamadan sağ çıkar).
- İşaret varken sunucu **şifresiz veriyi yazmaz**: `POST /veri` → **423** `{"basarili":false,"sifreGerekli":true,…}`; `POST /yedek-kaydet` → 500 "Şifreleme açıkken şifresiz yedek yazılmaz." (`Sunucuyu-Baslat.ps1:Duz-Reddedilsin-Mi`).
- Amaç: şifrelemenin sessizce düşmesini (ör. sıfırlamadan sonra anahtar yokken verinin düz yazılmasını) önlemek. Açılışta işaret var ama anahtar yoksa uyarı çıkar (`sifrelemeDustuMu`, `app.js:sifrelemeDustuKontrol`).
- İçeriği bilgi metnidir (kurulduğu an + "silmeyin" uyarısı); program yalnız **varlığına** bakar.

**Parola soruları (bağlamlar)** (`yazmadanOnceSifre`, `app.js:veriParolasiKurSor`, `veriParolasiSor`):

| Bağlam | Durum | Davranış |
|---|---|---|
| `acilis` | Şifreli dosya açılıyor | Parola doğru olana kadar sorulur; vazgeçilirse program açılmaz |
| `yedek` | Şifreli yedek geri yükleniyor, tuzu bellektekinden farklı | Yedeğin parolası sorulur |
| `kurulum` | Yeni kurulum (dosya ve tarayıcı verisi yok) | Yeni parola iki kez sorulur, **dosya diske ilk yazılmadan önce**; vazgeçilirse uyarıyla şifresiz devam |
| `tasima` | Tarayıcıdaki veri dosyaya geçiyor | Aynı |
| `surdur` | Dosya yok ama işaret var (sıfırlama sonrası) | Aynı parola istenir, saklanan tuz kullanılır; vazgeçilirse **işaret kaldırılır** (yoksa sunucu yazmayı reddederdi) |

İlk şifreli yazma başarılı olduktan **sonra** işaret konur (`isaretBekliyor`).

**Şifreleme kurma / parola değiştirme** (`engine.js:sifrelemeyiKur`, `sistem.yonet`): yeni tuz üretilir, veri hemen şifreli yazılır, işaret konur. Eski yedekler **eski parolayla** açılmaya devam eder (her yedeğin tuzu kendi başlığında).
**Kaldırma** (`sifrelemeyiKaldir`): önce işaret silinir, sonra anahtar ve saklanan tuz atılır, veri düz yazılır.

**Yedekler de şifrelidir:** yedek indirme ve `yedek-elle` kaydı `yedekBaytlari()` ile bellekteki anahtarla paketlenir; sunucunun otomatik `yedek\veri-*.db` kopyaları zaten diskteki (şifreli) dosyanın kopyasıdır.

Bir dosyanın şifreli olup olmadığı ilk 6 baytından anlaşılır: `BTENC1` ise şifreli, `SQLite format 3` ile başlıyorsa düz SQLite.

### 6.6 Yedekleme

| Tür | Kim üretir | Nereye | Ad | Saklama | Not |
|---|---|---|---|---|---|
| Otomatik (yazma öncesi) | Sunucu, her `POST /veri`'de dosya varsa | `<VeriKok>\yedek\` | `veri-yyyyMMdd-HHmmss.db` | Son **20** (`veri-*.db`, `LastWriteTime`'a göre) | En çok **10 dakikada bir**: en yeni `veri-*.db`'nin `LastWriteTime`'ı 10 dk'dan eskiyse kopya çıkarılır. `Copy-Item` kaynağın `LastWriteTime`'ını korur; bu yüzden yedek dosyasının tarihi **verinin son yazıldığı an**, adındaki saat **kopyanın çıkarıldığı an**dır |
| Sıfırlama öncesi | Sunucu, `DELETE /veri` | `<VeriKok>\yedek\` | `sifirlama-oncesi-yyyyMMdd-HHmmss.db` | **Silinmez** (20'lik budama `veri-*` süzgecini kullanır) | |
| Elle (klasöre) | `engine.js:yedekSunucuyaKaydet`; geri yükleme ve sıfırlamadan önce de kendiliğinden | `<VeriKok>\yedek-elle\` | `butce-yedek-yyyyMMdd-HHmmss.db` | Son **30** (`butce-yedek-*.db`) | Bellekteki veri (şifreleme açıksa şifreli). `sistem_bilgi.son_yedek`, `son_yedek_yol` yazılır |
| İndirme | `engine.js:yedekIndir`; çakışma perdesi; sunucusuz kipte yıkıcı işlem öncesi | Tarayıcının indirme klasörü | `maas-butce-yedek-YYYYMMDD-HHMM.db` | — | `son_yedek` yazılır |

**Geri yükleme** (`engine.js:yedektenYukle`):
- **Kim yapabilir:** oturum açıksa yalnız `sistem.yonet`. Oturum yokken (giriş ekranından) yalnız veri şifreliyken ve yalnız şifreli yedek kabul edilir; giriş ekranına ulaşmak için veri parolası zaten girilmiş olduğundan, veri parolasını bilmeyen biri kendi hazırladığı bir veritabanını yükleyip yönetici olamaz.
- **Akış:** şifreliyse, yedeğin tuzu bellekteki tuzla aynıysa bellekteki anahtarla, değilse sorulan parolayla çözülür; ilk 15 bayt `SQLite format 3` olmalı ve `personel` tablosu bulunmalı; görüntüleme kipinde yapılamaz; **önce mevcut hâl yedeklenir, yedeklenemezse işlem yapılmaz**; ardından `surumKontrol()` (eski yedek yeni sürüme yükseltilir) ve zorunlu yazma.

### 6.7 Sıfırlama (`engine.js:sifirla`)

Yalnız `sistem.yonet`; görüntüleme kipinde yapılamaz; önce otomatik yedek (alınamazsa işlem yok); bellekteki veritabanı kapatılır; `DELETE /veri` (sunucu önce `sifirlama-oncesi-*` kopyası çıkarır); anahtar bellekten silinir; IndexedDB kaydı silinir. **Şifreleme işareti silinmez** → yeniden kurulumda parola yeniden sorulur (`surdur`). Sayfa yenilenince ilk kurulum (başlangıç verisi + ilk yönetici + başlangıç seçimi) baştan yapılır.

### 6.8 Yazma kilidi (`js/core/kilit.js`, sunucu `/kilit`)

**Amaç:** Program her kayıtta veritabanının tamamını yazdığı için aynı anda iki yazar olursa ikincinin kopyasında birincinin değişiklikleri olmaz. Sürüm denetimi bunu reddeder ama ikincinin işi boşa gider. Çözüm: ilk açan yazar, diğerleri **görüntüleme kipinde** açılır (her şeyi görür, Excel alır, kayıt yapamaz).

**Kilit dosyası:** `<VeriKok>\veri\kilit.json` (UTF-8, BOM'suz, tek satır JSON). Sunucu belleğinde değil dosyadadır: ortak bir klasörde her kullanıcı kendi sunucusunu çalıştırabilir, ortak olan klasördür.

| Alan | Anlamı |
|---|---|
| `oturum` | Tarayıcı sekmesinin oturum kimliği: `'o' + Date.now().toString(36) + 8 rastgele karakter`; `sessionStorage['butce_kilit_oturum']`'da (sekme başına; aynı sekmede yenilemede korunur) |
| `kullanici` | Giriş yapmış kullanıcının adı (girişten önce boş) |
| `adSoyad` | Kullanıcının adı soyadı |
| `bilgisayar` | Sunucunun çalıştığı bilgisayarın adı (`$env:COMPUTERNAME`) |
| `alindi` | Kilidin ilk alındığı an (UTC, ISO 8601 "o" biçimi); aynı oturum tazelerken korunur |
| `tazelendi` | Son tazeleme anı (UTC, ISO) |

Örnek (uydurma): `{"oturum":"olq2x9abc1de2","kullanici":"ornek.kullanici","adSoyad":"Örnek Kullanıcı","bilgisayar":"PC-01","alindi":"2027-01-04T08:00:00.0000000Z","tazelendi":"2027-01-04T08:00:30.0000000Z"}`

**Zamanlar:**

| Sabit | Değer | Anlamı |
|---|---|---|
| `TAZELE_MS` | 30 000 ms | Yazar kilidi **30 sn'de bir** tazeler (`POST /kilit`) |
| `KONTROL_MS` | 15 000 ms | Görüntüleyen **15 sn'de bir** kilidi almayı dener |
| Düşme süresi (sunucu) | 120 sn | `tazelendi` 120 sn'den eskiyse kilit düşmüş sayılır, başkası alabilir |

**Davranış:**
- `POST /kilit` gövdesi `{oturum, kullanici, adSoyad}`. Kilit yok / düşmüş / aynı oturumun ise yazılır ve `sahip: true`; değilse `sahip: false` ve mevcut kilit bilgisi döner.
- Kilit giriş ekranından **önce** alınır (giriş `son_giris` yazar; görüntüleyenin bu yazması sahte çakışma doğurmasın diye) ve girişte kullanıcı bilgisiyle yeniden denenir (`app.js:baslat`).
- Sunucuya sorulamazsa oturum **yazar** sayılır (program kullanılamaz olmasın diye; `kilit.js:dene`).
- Bırakma: çıkışta / zaman aşımında `DELETE /kilit?oturum=…`; sekme kapanırken `sendBeacon('POST /kilit?oturum=…&birak=1')`. Yalnız aynı oturum bırakabilir.
- Görüntüleme kipinde: `API.yetkiIste` `.yaz/.yonet` yetkilerini reddeder (mesaj: kim kayıt yapıyor ya da "başka sekmede açık"); `engine.js` dosyaya yazmaz; sıfırlama/geri yükleme yapılamaz; üstte "Yalnızca görüntüleme" şeridi (`app.js:kilitSeridiCiz`). Kilit aynı kullanıcının başka sekmesindeyse ayrı mesaj (`kendiHesabimMi`).
- Tarayıcı kipinde kilit yoktur, her zaman yazar.

### 6.9 Oturum zaman aşımı (`app.js` "Hareketsizlikte otomatik kapanma")

- Süre `sistem_bilgi.oturum_zaman_asimi_dk` (vars. **5 dk**, 0–240, 0 = kapalı); `sistem.yonet` değiştirir.
- Etkinlik: `mousemove`, `mousedown`, `keydown`, `wheel`, `touchstart`, `scroll` (saniyede en çok bir kez sayılır). Sayaç veri açıldığı anda başlar (giriş ekranında beklerken de işler).
- Bitimden **30 sn** önce uyarı perdesi; perde açıkken fare hareketi süreyi sıfırlamaz, "Devam et" gerekir.
- Süre dolunca: bekleyen kayıt yazılır, kilit bırakılır, `sessionStorage['butce_zaman_asimi'] = '1'`, **sayfa yeniden yüklenir** → veri anahtarı bellekten silinir; tekrar girmek için **veri parolası + giriş parolası** gerekir. Açılışta bu işaret görülürse "oturum kapatıldı" bildirimi.

### 6.10 Kullanıcı ve parola saklama

- **Özet yöntemi** (`api.js:parolaHashle`, `parolaDogrula`; `util.js:sha256Hex`):
  1. `tuz` = 16 rastgele bayt (`crypto.getRandomValues`), 32 karakter küçük harf hex.
  2. `h = SHA256_hex( tuz + "|" + parola )` — girdi UTF-8, çıktı 64 karakter küçük harf hex.
  3. 60 000 kez: `h = SHA256_hex( h )` (önceki hex metninin UTF-8 baytları).
  4. Saklanan: `sha256i$60000$<h>`.
  Denetimde tur sayısı saklanan metinden okunur; önek `sha256i` değilse giriş reddedilir. Toplam 60 001 SHA-256. SHA-256 saf JavaScript ile yazılmıştır (WebCrypto'ya bağlı değil).
- **Sınama değeri** (uydurma): tuz `00112233445566778899aabbccddeeff`, parola `Ornek123` → `sha256i$60000$549032abe5c78dc1cf4714071fa39a531fae9d2f83b3f5b49aee1ee8c988c6a0`. Node.js'te aynı değer: `h = sha256(tuz + '|' + parola)`; 60 000 kez `h = sha256(h)` (`crypto.createHash('sha256').update(x, 'utf8').digest('hex')`). Türkçe karakterli parolada da iki yol aynı sonucu verir (denendi).
- **Başka sisteme aktarırken:** Özetler taşınıp aynı algoritma ile denetlenebilir; ya da kullanıcılar hedefte yeniden oluşturulur. Parolalar düz olarak hiçbir yerde yoktur.
- **Giriş:** kullanıcı adı küçük harfe çevrilir; pasif kullanıcı reddedilir; başarılı girişte `son_giris` ve `islem_log(GIRIS)`. Oturum bilgisi yalnız bellekte (`aktifKullanici`: ad, yönetici mi, yetkiler, gruplar); çıkışta silinir. Yetki ve grup erişimi her ekran geçişinde veritabanından yeniden okunur; kullanıcı silinmiş ya da pasifleştirilmişse oturum kapanır (`api.js:oturumTazele`).

### 6.11 Tarayıcı tarafı depolama anahtarları

| Yer | Anahtar | İçerik |
|---|---|---|
| IndexedDB | `maas_butce_sistemi` / `veritabani` / `main` | Son yazılan veritabanı baytları (şifreliyse şifreli) |
| localStorage | `butce_sifre_tuzu` | Şifreleme tuzu (base64) |
| localStorage | `butce_secim` | Ekran seçimi `{yil, grup, calisma}` (`grup` = kod ya da `TUMU`) |
| sessionStorage | `butce_kilit_oturum` | Yazma kilidi oturum kimliği |
| sessionStorage | `butce_zaman_asimi` | Zaman aşımıyla kapanma işareti |

Bunların hiçbiri aktarılacak iş verisi değildir.

> **İç adlar bilerek eski kaldı.** Programın görünen adı "Ücret Hesaplama"dır; ama iç anahtarlar ve dosya adları değiştirilmemiştir: IndexedDB adı `maas_butce_sistemi`, `localStorage` / `sessionStorage` anahtarları (`butce_sifre_tuzu`, `butce_secim`, `butce_kilit_oturum`, `butce_zaman_asimi`), veri dosyası `veri\butce.db` (ve `butce-yedek-*.db`, `maas-butce-yedek-*.db` yedek dosyalarının adları), başlatıcı `BUTCE-BASLAT.bat`. Bunlar değiştirilirse var olan kurulumlar verisini bulamaz: tarayıcıdaki güvenlik ağı kopyası ve saklanan şifreleme tuzu kaybolur, sunucu yeni dosya adında boş veri görüp ilk kurulumu açar. Programı uyarlarken bu adlara dokunulmamalı ya da bir geçiş adımı yazılmalıdır.

---

## 7. Sunucu: uç noktalar ve dosya yolları

### 7.1 Başlatma (`Sunucuyu-Baslat.ps1`)

- `BUTCE-BASLAT.bat` → `powershell.exe -NoProfile -ExecutionPolicy Bypass -File Sunucuyu-Baslat.ps1`. Yönetici yetkisi ve kurulum gerektirmez (Windows PowerShell 5.1, `System.Net.HttpListener`).
- Parametreler: `-Port` (vars. **8764**), `-VeriKok` (vars. program klasörünün **bir üstü**: program dosyaları güncellenirken veri etkilenmesin diye), `-Deneme` (tarayıcı açmaz). Deneme sunucusu: `Sunucu-Test-8794.ps1` → port 8794, veri kökü `%TEMP%\butce-deneme` (asıl veri klasörüne dokunmaz).
- Adres `http://localhost:<Port>/`. Port meşgulse ve o adres 200 veriyorsa "zaten çalışıyor" denip tarayıcı oraya yönlendirilir; yeni sunucu açılmaz (tarayıcı deposu adrese bağlı olduğu için program hep aynı adreste açılmalı). Yanıt yoksa hata verip çıkar.
- İstekler **tek iş parçacığında sırayla** işlenir (`GetContext` döngüsü). Bir istekteki hata sunucuyu düşürmez; o isteğe 500 döner.

### 7.2 Dosya yolları

| Yol | İçerik |
|---|---|
| `<program>\` (`$kok`) | Statik dosyalar (`index.html`, `js\`, `css\`, `data\`, `img\`) |
| `<VeriKok>\veri\butce.db` | **Veritabanı** (şifreli ya da düz SQLite) |
| `<VeriKok>\veri\butce.db.yeni` | Yazma sırasında geçici dosya (yazılıp `Move-Item` ile yerine konur; yarıda kesilen yazma mevcut veriyi bozmaz) |
| `<VeriKok>\veri\kilit.json` | Yazma kilidi |
| `<VeriKok>\veri\sifreleme-acik` | Şifreleme işareti |
| `<VeriKok>\yedek\veri-*.db`, `sifirlama-oncesi-*.db` | Otomatik yedekler |
| `<VeriKok>\yedek-elle\butce-yedek-*.db` | Elle yedekler |

Varsayılan kurulumda `<VeriKok>`, `program\` klasörünü içeren klasördür (ör. depo kökü).

### 7.3 Uç noktalar

Bütün JSON yanıtları `application/json; charset=utf-8` ve `Cache-Control: no-store`.

| Yol | Yöntem | İstek | Yanıt |
|---|---|---|---|
| `/veri` | GET | — | Dosya varsa **200**, `application/octet-stream`, gövde = dosya baytları, başlık `X-Veri-Surum: <ticks>`. Yoksa **204**, `X-Veri-Surum: 0` |
| `/veri` | POST | Gövde: SQLite ya da `BTENC1` paket baytları. Sürüm: başlık `X-Veri-Surum` ya da sorgu `?surum=` | **400** `{"basarili":false,"mesaj":"Gelen veri bir Ucret Hesaplama veri dosyasi degil."}` (64 bayttan kısa; ya da `BTENC1` ile başlamıyor ve 512 bayttan kısa ya da `SQLite format 3` değil) · **423** `{"basarili":false,"sifreGerekli":true,"mesaj":…}` (işaret var, veri düz) · **409** `{"basarili":false,"cakisma":true,"surum":"<ticks>"}` · **200** `{"basarili":true,"surum":"<ticks>","boyut":<bayt>}` + `X-Veri-Surum` başlığı. Yazmadan önce otomatik yedek (§6.6) |
| `/veri` | DELETE | — | Dosya varsa `yedek\sifirlama-oncesi-*.db`'ye kopyalanır ve silinir. **200** `{"basarili":true}` |
| `/veri-bilgi` | (her yöntem) | — | **200** `{"basarili":true,"var":bool,"yol":"<veri dosyası>","boyut":bayt,"tarih":"yyyy-MM-ddTHH:mm:ss" (yerel saat),"sifreli":bool,"yedekKlasor":"…","elleYedekKlasor":"…","yedekSayisi":<yedek\ içindeki *.db>,"duzYedek":<iki klasördeki şifresiz *.db>,"sifreIsaret":bool}` |
| `/yedek-kaydet` | POST | Gövde: yedek baytları | **200** `{"basarili":true,"dosya":"butce-yedek-….db","klasor":"…","boyut":n,"sifreli":bool}` · **500** `{"basarili":false,"mesaj":…}` (biçim tanınmadı ya da işaret varken düz veri) |
| `/yedek-listesi` | (her yöntem) | — | **200** `{"basarili":true,"klasor":"…","yedekler":[{"ad","boyut","tarih":"yyyy-MM-ddTHH:mm:ss","sifreli":bool}]}` — `yedek-elle\*.db`, yeniden eskiye |
| `/kilit` | GET | — | `{"basarili":true,"bos":bool,"kilit":{…}\|null}` (istemci kullanmıyor) |
| `/kilit` | POST | Gövde `{"oturum","kullanici","adSoyad"}` | **200** `{"basarili":true,"sahip":true,"kilit":{…}}` ya da `"sahip":false` + mevcut kilit · **400** `{"basarili":false,"mesaj":"Oturum bilgisi eksik."}` |
| `/kilit?oturum=…&birak=1` | POST | (boş; `sendBeacon`) | Aynı oturumun kilidi silinir. **200** `{"basarili":true}` |
| `/kilit?oturum=…` | DELETE | — | Aynı oturumun kilidi silinir. **200** `{"basarili":true}` |
| `/sifre-isaret` | GET / POST / DELETE | — | POST işaret dosyasını yazar, DELETE siler, GET dokunmaz. Hepsi **200** `{"basarili":true,"isaret":bool}` |
| `/` ve diğer yollar | GET | — | Program klasöründen statik dosya (`/` → `/index.html`). Yol çözülür (`Resolve-Path … .ProviderPath`) ve program klasörünün dışına çıkamaz. Tip tablosu: `.html`, `.css`, `.js`, `.json` (UTF-8), `.wasm`, `.db` (`application/x-sqlite3`), `.ico`, `.png`, `.svg`; diğerleri `application/octet-stream`. `Cache-Control: no-store, no-cache, must-revalidate`. Yoksa **404** düz metin |
| (her yol) | HEAD | — | Yalnız 200/404 (gövde yazılmaz). Yol program klasörü altında aranır (§9.1) |

### 7.4 İstemcinin kullandığı çağrılar (`fetch` taraması)

`engine.js`: `GET/POST/DELETE /veri`, `POST /yedek-kaydet`, `GET /yedek-listesi`, `GET/POST/DELETE /sifre-isaret`, beacon `POST /veri?surum=`; `kilit.js`: `POST /kilit`, `DELETE /kilit?oturum=`, beacon `POST /kilit?…&birak=1`; Sistem ekranı: `GET /veri-bilgi`. Başka uç nokta yoktur; `/api/...` henüz yoktur (yalnız `api.js` yorumunda gelecek planı).

---

## 8. Veri dosyasını başka bir sisteme aktarma

Programın bütün verisi tek bir SQLite dosyasıdır: `<VeriKok>\veri\butce.db` (isteğe bağlı olarak şifreli). Veriyi başka bir veritabanına, bir raporlama aracına ya da kendi yazacağınız bir sisteme aktarmak için genel yol: **yazmayı durdurup dosyayı kopyalamak → şifreyi çözmek → denetlemek → tablo tablo dışa aktarmak → hedefte bağımlılık sırasıyla (§3.3) yüklemek.**

### 8.1 Ön koşullar

1. **Kimse yazmıyor olmalı.** Bütün kullanıcılar programı kapatmalı; `veri\kilit.json` yoksa ya da `tazelendi` 120 sn'den eskiyse yazar yoktur. Sunucu penceresi kapatılırsa kesinleşir.
2. **Kopya üzerinde çalışın.** `veri\butce.db`'yi (ve isterseniz `yedek\`, `yedek-elle\`'yi) ayrı bir klasöre kopyalayın; asıl dosyaya ve programa dokunmayın. Program açıkken kopyalanan dosya en son tamamlanmış yazmayı içerir (yazma geçici dosya + yer değiştirme ile yapılır).
3. **Veri parolası** gerekir (dosya şifreliyse: ilk 6 bayt `BTENC1`, §6.5). Parolayı bilen kişi işlemi kendisi yapmalı ya da parola ortam değişkeniyle verilmeli; betiğe/belgeye yazılmamalı.
4. **Node.js 22.13+ ya da 24** önerilir (yerleşik `crypto` ve `node:sqlite`). Windows PowerShell 5.1 (.NET Framework) `AesGcm` sınıfını içermez; PowerShell ile çözmek için PowerShell 7+ gerekir. Bu yüzden aşağıda Node betikleri verilmiştir.

### 8.2 Şifre çözme

Aşağıdaki betik programın `engine.js:paketle/cozPaket/anahtarUret` biçiminin birebir tersidir. Programın yöntemiyle (WebCrypto, aynı parametreler) şifrelenmiş örnek veriyle ve Türkçe karakterli bir parolayla denendi: çözülen dosya özgün dosyayla bayt bayt aynı çıktı; yanlış parola `Unsupported state or unable to authenticate data` hatası verdi.

```js
'use strict';
// coz.js — Kullanım (cmd):  set BUTCE_PAROLA=<veri parolası>  &&  node coz.js <butce.db kopyası> <cikti.sqlite>
const fs = require('fs'), crypto = require('crypto');
const [, , giris, cikis] = process.argv;
const b = fs.readFileSync(giris);
if (b.subarray(0, 15).toString('latin1') === 'SQLite format 3') {          // şifresiz dosya
  fs.copyFileSync(giris, cikis); console.log('Dosya zaten şifresiz; kopyalandı.'); process.exit(0);
}
if (b.subarray(0, 6).toString('latin1') !== 'BTENC1') throw new Error('Tanınmayan biçim (BTENC1 imzası yok).');
const tuz = b.subarray(8, 24);                 // 16 bayt
const iv = b.subarray(24, 36);                 // 12 bayt
const govde = b.subarray(36);
const etiket = govde.subarray(govde.length - 16);           // GCM etiketi (son 16 bayt)
const sifreli = govde.subarray(0, govde.length - 16);
const parola = process.env.BUTCE_PAROLA;
if (!parola) throw new Error('BUTCE_PAROLA ortam değişkeni boş.');
const anahtar = crypto.pbkdf2Sync(Buffer.from(parola, 'utf8'), tuz, 250000, 32, 'sha256');
const d = crypto.createDecipheriv('aes-256-gcm', anahtar, iv);
d.setAuthTag(etiket);
const acik = Buffer.concat([d.update(sifreli), d.final()]); // parola yanlışsa final() hata atar
if (acik.subarray(0, 15).toString('latin1') !== 'SQLite format 3') throw new Error('Çözülen veri SQLite değil.');
fs.writeFileSync(cikis, acik);
console.log('Çözüldü:', cikis, acik.length, 'bayt');
```

Aynı betik `yedek\veri-*.db`, `sifirlama-oncesi-*.db` ve `yedek-elle\butce-yedek-*.db` dosyalarında da çalışır. **Dikkat:** her dosya, **yazıldığı andaki** parolayla açılır (parola değiştiyse eski yedekler eski parolayı ister).

> Çözülmüş `.sqlite` dosyası bütün maaşları düz içerir. Yalnız aktarma süresince, erişimi kısıtlı bir klasörde tutun ve iş bitince silin (geri dönüşüm kutusundan da).

**Başka yollar (önerilmez):**
- Programda şifrelemeyi kaldırmak (`sifrelemeyiKaldir`): canlı dosyayı düz yazar, işareti siler; iş bitince yeniden kurmak gerekir ve canlı veriyi bir süre şifresiz bırakır.
- Tarayıcı konsolunda `ADB.disaAktarBytes()` bellekteki veritabanının düz baytlarını verir (`engine.js` dışa açık işlev); denetimsiz bir dosya üretir.

### 8.3 Denetim (çözdükten sonra, aktarmadan önce)

`node:sqlite` ya da herhangi bir SQLite aracıyla (sorgular örnek veriyle kurulmuş bir veritabanında denendi; hepsi beklenen sonucu verdi):

```sql
PRAGMA integrity_check;                                  -- 'ok' olmalı
PRAGMA foreign_key_check;                                -- boş olmalı
SELECT deger FROM sistem_bilgi WHERE anahtar = 'sema_surum';   -- programın SEMA_SURUM değeri ('1')
SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY 1;  -- 23 tablo + 3 indeks
-- Yetim satır denetimi (FK yok ama mantıksal bağ var; hepsi 0 olmalı):
SELECT COUNT(*) FROM aylik_girdi a WHERE NOT EXISTS (SELECT 1 FROM calisma_personel cp WHERE cp.calisma_id = a.calisma_id AND cp.tc_kimlik_no = a.tc_kimlik_no);
SELECT COUNT(*) FROM performans_girdi a WHERE NOT EXISTS (SELECT 1 FROM calisma_personel cp WHERE cp.calisma_id = a.calisma_id AND cp.tc_kimlik_no = a.tc_kimlik_no);
SELECT COUNT(*) FROM calisma_personel cp JOIN calisma c ON c.id = cp.calisma_id
  WHERE cp.butce_bolumu IS NOT NULL AND NOT EXISTS (SELECT 1 FROM butce_bolumu b WHERE b.grup_kod = c.grup_kod AND b.ad = cp.butce_bolumu);
SELECT COUNT(*) FROM calisma_personel cp JOIN calisma c ON c.id = cp.calisma_id
  WHERE cp.hesap_turu IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hesap_turu h WHERE h.yil = c.yil AND h.kod = cp.hesap_turu);
SELECT COUNT(*) FROM calisma_personel cp WHERE cp.kanun IS NOT NULL AND NOT EXISTS (SELECT 1 FROM kanun_turu k WHERE k.kod = cp.kanun);
-- Onay dondurmaları (0 olmalı):
SELECT COUNT(*) FROM calisma WHERE durum = 'ONAYLI' AND id NOT IN (SELECT calisma_id FROM calisma_parametre);
SELECT COUNT(*) FROM calisma_personel cp JOIN calisma c ON c.id = cp.calisma_id WHERE c.durum = 'ONAYLI' AND cp.onay_sabit = 0;
```

Sayısal karşılaştırma için programın gösterdiği sayaçlar (personel, çalışma, aylık girdi, parametre, kullanıcı, boyut — `engine.js:istatistik`) ve tablo satır sayıları kaydedilmelidir.

### 8.4 Tablo tablo dışa aktarım

Önerilen: her tablo için **JSON** (tipleri korur; T.C. metin kalır). Aşağıdaki betik örnek veriyle denendi (Node 24; "experimental" uyarısı verir, sonuç etkilenmez):

```js
'use strict';
// disa.js — Kullanım: node disa.js <cozulmus.sqlite> <cikti-klasoru>
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs'), path = require('path');
const [, , dosya, klasor] = process.argv;
fs.mkdirSync(klasor, { recursive: true });
const db = new DatabaseSync(dosya, { readOnly: true });
const tablolar = db.prepare(`SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();
const ozet = {};
fs.writeFileSync(path.join(klasor, '_sema.sql'), tablolar.map(t => t.sql + ';').join('\n\n'));
for (const t of tablolar) {
  const satirlar = db.prepare(`SELECT * FROM "${t.name}"`).all();
  fs.writeFileSync(path.join(klasor, t.name + '.json'), JSON.stringify(satirlar, null, 1));
  ozet[t.name] = satirlar.length;
}
fs.writeFileSync(path.join(klasor, '_satir-sayilari.json'), JSON.stringify(ozet, null, 1));
console.log(ozet);
```

`_sema.sql` dosyası, dosyanın **gerçek** şemasını verir (ileride `ALTER TABLE` ile eklenen sütunlar dâhil; bunlar tablonun sonundadır); `schema.js` ile karşılaştırılmalıdır.

**Tablo başına dönüşüm notları** (hedef ilişkisel bir veritabanıysa):

| Tablo | Not |
|---|---|
| `personel` | `tc_kimlik_no` metin/CHAR(11); kontrol hanesi geçersiz numaralar olabilir (örnek veri, §5.6). Tarihler `DATE`. Silinmemiş eski kartlar da vardır (bütçede olmayan kişiler) |
| `grup` | `kod` kalıcı anahtardır; hedefte de değişmez tutulmalı |
| `calisma` | `id` korunmalı (bütün çocuk tablolar ona bağlı) ya da eski→yeni id eşleme tablosu tutulmalı. `islem_log.kayit_anahtar` içinde id ve T.C. metin olarak geçer |
| `calisma_personel` | 23 sütun aynen. `onay_sabit/onay_giris/onay_cikis` **kesinlikle** aktarılmalı (onaylı maliyet ve dönem tarihleri buna bağlı). `maas_eski` ve `yol` çalışmanın ücret esasındadır; esas bilgisi olmadan aktarılan tutar net mi brüt mü bilinemez |
| `aylik_girdi` | `deger` metindir; alan türüne göre (kod / sayı / `EVET`-`HAYIR`) çevrilmeli. Sürekli / o aya özgü ayrımı korunmalı: tablo yalnız **değişiklikleri** tutar; hedef "her ayın tam değeri" modelini seçerse 12 ay açılımı `api.js:calismaHesapla`'daki devralma kuralıyla yapılmalı (Ocak = `calisma_personel` + varsa ay 1 kaydı; sürekli alanlar sonraki aylara devreder; o aya özgü alanlar girilmeyen ayda 0; `calisilan_gun` girilmeyen ayda `calisma_ayar.gun.<yaka>.<ay>`, yoksa 30) |
| `calisma_ayar` | Anahtarlar §2.18; değerler metin. **`ucret.esas` mutlaka okunmalı:** satır yoksa NET, `'BRUT'` ise brüt; hedefte çalışmanın bir sütunu (ör. `ucret_esasi NOT NULL DEFAULT 'NET'`) olarak tutulması önerilir. `dagilim.haric/dahil` (T.C. listesi) ayrı bir tabloya açılması önerilir |
| `calisma_ozet` | Anahtarlar §2.17; REAL |
| `calisma_parametre` | `veri` JSON'u **olduğu gibi** saklanmalı (onaylı çalışmanın hesabı buna bağlı). Hedef bunu ayrı tablolara açacaksa da onaylı çalışma başına ayrı kopya korunmalı; yılın güncel parametre tablolarıyla birleştirilmemeli |
| `parametre`, `gv_dilim`, `asgari_ucret`, `hesap_turu`, `sakatlik_derece`, `performans_kademe` | Yıl anahtarıyla aynen. `gv_dilim.ust_sinir` NULL = son dilim. `parametre(perf.model)` değeri bir JSON belgesidir (değerlendirme modeli, §2.21): hedefte JSON sütunu ya da ayrı model tabloları olarak tutulabilir; yıl başına ayrı kopya korunmalı. Kaydı olmayan yıl varsayılan modeli kullanır |
| `kanun_turu` | Yıldan bağımsız; `kural` ve `oran` hesabın parçası |
| `butce_bolumu` | Hedefte çalışma satırının bölüme **id ile** bağlanması önerilir; eşleme (`calisma.grup_kod`, `ad`) ile yapılır |
| `performans_girdi` | Anahtar-değer; alan adları çalışmanın yılının modeline bağlıdır (§2.21). Modelde artık olmayan alanların satırları da bulunabilir: hedefte ya arşivlenmeli ya da çalışmanın modeline göre süzülmeli. Hesaplanan puan/çarpan saklanmaz (çarpan `calisma_personel.performans_carpani`'dedir) |
| `mesai_ongoru` | Takvim satırları (`yaka=''`, `bolum=''`) ayrıştırılmalı; `bolum` = personel bölümü |
| `kullanici`, `kullanici_yetki`, `kullanici_grup` | Özet uyumu için §6.10. Yetki kodları hedefin yetki modeline eşlenmeli |
| `islem_log` | Denetim izi olarak arşivlenmeli; kişisel veri içerir |
| `sistem_bilgi` | `sema_surum`, `son_yedek*` hedefte anlamsız; `oturum_zaman_asimi_dk` ve `aktarim.sozluk` (yalnız değiştirilen başlık listeleri; varsayılanlar `api.js:AKTARIM_ALANLARI`'nda) ayarları aktarılabilir |
| `sqlite_sequence` | AUTOINCREMENT sayaçları; id'ler korunacaksa hedef sayaçlar en büyük id'den başlatılmalı |

### 8.5 Hedefte dikkat edilecekler

1. **Hesaplanan değer saklanmaz.** Veritabanında brüt, prim, vergi, aylık/yıllık maliyet, zam miktarı, yeni maaş ve performans puanı yoktur; her açılışta motor üretir. Hedef aynı rakamları görmek için aynı hesap motorunu (`hesap.js`, `performans.js` — dışa bağımlılığı olmayan saf JavaScript; 02 numaralı belge) kurmalı ya da aktarma anında programın ürettiği sonuçları ayrıca dışa almalıdır (programın Excel çıktıları). Motor, `parametre` tablosundaki katsayıları (mesai, AR-GE eşiği, yuvarlama) ve `perf.model`'i kod içi varsayılanlarıyla birlikte okumalıdır: kayıt olmayan yılda varsayılan geçerlidir.
2. **Onaylı çalışmalar** hedefte de kilitli olmalı; dondurulmuş parametreler ve tarihler korunmalı (§3.4 madde 1–5).
3. **Ücret esası:** her çalışmanın esası `calisma_ayar.ucret.esas`'tan okunup tutarlarla birlikte aktarılmalı. Net ve brüt çalışmaların maaş / ek ödeme tutarları birbirine eklenmemeli, dönüştürülmemeli (programda dönüşüm yoktur); karşılaştırma maliyet üzerinden yapılmalı. Esasın değişmezlik ve devralma kuralları (§3.4 madde 19) hedefte de kurulmalı.
4. **Tarih biçimi** `YYYY-MM-DD`; zaman damgaları UTC.
5. **T.C. No** metin; maskeleme/yetki kuralı (`alan.tc`) hedefte yeniden kurulmalı.
6. **Grup görünürlüğü** okuma düzeyinde uygulanmalı (kayıt yoksa grup hiç görünmez).
7. **Bütçe bölümü adı** numarasız; ekranda `sira` ile `08 PAZARLAMA` biçimi.
8. **Anahtar-değer tablolarındaki metin referansları** (T.C. listeleri) hedefte ilişkisel yapıya çevrilmeli; yoksa T.C. düzeltmesi bunları bozar.
9. **Yazma modeli:** hedef sunucu tabanlıysa "tam dosya yazma + 409 + tek yazar kilidi" mekanizması gereksizleşir; ama "aynı anda iki kişi aynı çalışmayı değiştirirse" sorusu (son yazan kazanmasın) hedefte ayrıca çözülmeli.
10. **Şifreleme:** hedefte veri dinlenme hâlinde şifrelenmeli (bu programda AES-256-GCM ile şifreli tutulabiliyor); çözülmüş ara dosyalar aktarma sonrası imha edilmeli.
11. **KVKK:** `personel`, `calisma_personel`, `aylik_girdi`, `performans_girdi` (amir adları, değerlendirme), `islem_log` kişisel veri içerir.

### 8.6 Hedefte artık gerekmeyen mekanizmalar

IndexedDB depo ve tarayıcıdan dosyaya geçiş, `sendBeacon` ile kapanışta yazma, `VERI_GOCLERI` / `EKSIK_SUTUNLAR` / `TABLO_GOC` (veri aktarıldığı sürümdeki hâliyle alınır), `TEMEL_VERI_YAZ`, `data/seed.js` ve `data/ornek-veri.js` (temel veri zaten veritabanında), `sistem_bilgi.sema_surum`, `son_yedek*`, kilit dosyası ve şifreleme işareti (hedefin kendi güvenlik/eşzamanlılık modeli varsa). **Kalıcı olanlar:** §3.4'teki iş kuralları, yetki listesi, anahtar-değer anahtarlarının anlamları, onaylı çalışma dondurmaları, yıl bazında değerlendirme modeli ve kod içi varsayılanlar (§5.8).

---

## 9. Belirsiz kalan / doğrulanamayan noktalar

### 9.1 Doğrulanamayanlar

1. **sql.js / SQLite sürümü** (`js/vendor/sql-wasm.js`, `sql-wasm-binary.js`) dosyalardan belirlenemedi. SQLite dosya biçimi standart olduğundan aktarmayı etkilemesi beklenmez.
2. **`gv_tesvik` değer aralığı:** Kodda yalnız yılın `arge_gv_esik` eşiğiyle karşılaştırılması (vars. 0.8) ve çarpan olarak kullanımı görüldü (`hesap.js:ayHesapla`); izin verilen değerlerin listesi (ör. 0.80 / 0.90 / 0.95 / 1) kodda tanımlı değil, girişte denetlenmiyor.
3. **Görüntüleme → yazar geçişinde yeniden okuma yapılmaması** (§6.4 notu) koddan çıkarımdır; ekranda denenmedi.
4. **Yedeklerin hangi parolayla şifreli olduğu:** parola hiç değiştirilmediyse hepsi aynı paroladır; değiştirildiyse eski yedekler eski parolayı ister. Hangisinin geçerli olduğu dosyadan bilinemez (tuz karşılaştırması ipucu verir: aynı tuz = aynı parola kurulumu).
5. **`Sunucuyu-Baslat.ps1`'de HEAD isteği** yolu program klasörüne sınırlamadan `Test-Path` yapar (yalnız var/yok bilgisi sızar); güvenlik açısından önemsiz ama başka bir sunucuda tekrarlanmamalı.

### 9.2 Kodda görülen sınırlar ve tutarsızlıklar

1. **`TABLO_GOC` ve yabancı anahtarlar:** `engine.js:tabloGocleriUygula` (`{ tablo, gerekliSutun, yeni, tasi }`, §4.3), yabancı anahtar açık kaldığı için başka tabloların bağlı olduğu bir tabloda çocuk satırları CASCADE ile siler ya da FK hatasıyla geri alınır (§4.3 uyarısı); hata verse de sürüm yükseltilir.
2. **Uyumsuz ya da daha yeni sürümlü dosya:** `surumKontrol` yalnız dosya sürümü koddakinden küçükken çalışır. Daha yeni bir programın dosyası (ya da aynı adlı tabloları farklı sütunlarla içeren başka bir SQLite dosyası) uyarısız açılır; geri yükleme yalnız `personel` tablosunun varlığına bakar (`engine.js:yedektenYukle`). Uyumsuzluk ancak ilk sorguda hata olarak görünür.
3. **`YENI_YIL` ve ay 1 kaydı:** Hesap, `aylik_girdi`'deki ay 1 sürekli kayıtlarını uygular (§2.20 notu); `calismaPersonelKopyala`'nın `YENI_YIL` kolu ise "Aralık'taki geçerli değeri" bulurken 2. aydan başlar (`son()` döngüsü). Kişi alanı (hesap türü, kanun, sakatlık, BES, GV teşvik, yol) yalnız ay 1 kaydı olarak girilmişse yeni yıla satırdaki eski değer geçer. Örnek veri ay 1'e yalnız `fm2` ve `arge_gun` yazdığından (ikisi de yeni yıla zaten geçmez) etkilenmez.
4. **Geri yükleme yorumu:** `engine.js:yedektenYukle` yorumu giriş ekranından "yalnız aynı veri parolasıyla şifrelenmiş yedek" der; kod herhangi bir şifreli yedeği kabul eder ve tuzu farklıysa yedeğin kendi parolasını sorar. Giriş ekranına ulaşmak için veri parolası zaten gerektiğinden yorumdaki amaç (parolayı bilmeyen yönetici olamasın) korunur.
5. **`aylikGirdiYaz` ay aralığını denetlemez** (1–12 denetimi yalnız `aylikGirdiToplu` ve `mesaiYaz`'da vardır); ekranlar yalnız 1–12 gönderir.
6. **Bozuk değerlendirme modeli sessizce varsayılana döner:** `performansModeliYaz` hatalı modeli reddeder ve genel `parametreYaz` `perf.model` anahtarını kabul etmez; model yalnız doğrudan veritabanı düzenlemesiyle bozulabilir. O durumda `performansModeli` / `calismaPerformansModeli` hatayı yutar ve uyarı vermeden varsayılan modeli kullanır.
7. **Modelde artık olmayan alanların satırları:** `performansGirdiYaz` alan denetimini yalnız değer yazarken yapar; boş değerle silme, modelde artık olmayan alanda da yapılabilir (kaldırılan tanımın eski verisi temizlenebilir). Ekranda bu alanlar görünmediği için silme ancak API'den ya da kişinin bütün değerlendirmesi silinerek (`performansGirdiSil`) yapılır (§2.21).
8. **Sıfır girilen katsayı varsayılana döner:** `zam_yuvarla` / `zam.yuvarla_ongoru` = 0 ise yuvarlama adımı 10 olur (`hesap.js:zamHesapla`, `yv.ongoru || 10`); `mesai_gun_saat` = 0 ise 7.5 olur (`hesap.js:ayHesapla`, `P.gunlukSaat || 7.5`). `parametreYaz` değerleri denetlemez.
9. **Ücret esası onayda dondurulmaz:** `ucret.esas` bir çalışma ayarıdır, `calisma_parametre` görüntüsüne girmez. Yine de onaylı çalışmanın esası değişemez: onaylı çalışmaya ayar yazılamaz (`calismaYazIste`), taslağa alındığında da bütçe satırları olduğu için `calismaAyarYaz` esas değişikliğini reddeder (`esasBagli`). Koruma bu iki kurala dayanır; doğrudan veritabanı düzenlemesine karşı koruma yoktur.
10. **Net ↔ brüt dönüşümü yoktur:** esası yanlış seçilmiş ve tutar girilmiş bir çalışmanın esası programdan değiştirilemez; doğru esasla yeni (boş) bir çalışma açılıp tutarlar yeniden girilmelidir. Örnek veri bütünüyle NET esaslıdır (hiçbir çalışmada `ucret.esas` satırı yok).

---

## 10. Kaynak dizini

| Konu | Dosya:işlev |
|---|---|
| Tablo tanımları | `js/db/schema.js:SEMA_SQL` |
| Şema sürümü | `js/db/schema.js:SEMA_SURUM` (1) |
| Sonradan eklenen sütunlar | `js/db/schema.js:EKSIK_SUTUNLAR`; `js/db/engine.js:eksikSutunlariEkle` |
| Tablo göçü | `js/db/schema.js:TABLO_GOC`; `js/db/engine.js:tabloGocleriUygula` |
| Veri göçleri | `js/db/schema.js:VERI_GOCLERI`; `js/db/engine.js:surumKontrol` |
| Temel veri | `js/db/schema.js:TEMEL_VERI_YAZ`; `data/seed.js:SEED_YUKLE`; `js/db/api.js:seedYukle` |
| Örnek veri | `data/seed.js:ORNEK_VERI_YUKLE`; `data/ornek-veri.js` (`window.ORNEK_VERI`); `tools/ornek-veri-uret.mjs` (`gecersizTc`, `GRUPLAR`, `KADRO`); `js/db/api.js:ornekVeriYukle`, `varsayilanGrupAc` |
| İlk kurulum | `js/app.js:baslat`, `ilkKurulumEkrani`; `js/db/engine.js:baslat` |
| Gruplar | `js/db/api.js:grupKaydet`, `grupSil`, `grupListe`, `gorunurGruplar`, `maasAraliklari`, `maasAralikYaz`, `aralikOner`, `aralikCoz` |
| Yetki listesi | `js/db/schema.js:YETKILER`; `js/db/api.js:yetkiVar`, `yetkiIste`, `grupGorebilir`, `grupYazabilir`, `calismaOkuIste`, `calismaYazIste`, `okumaIste` (`OKU_HESAP`, `OKU_PERSONEL`, `OKU_PERFORMANS`) |
| Onay dondurma | `js/db/schema.js:ONAY_TARIH_DONDUR`, `PARAMETRE_ANLIK_AL`, `PARAMETRE_DONDUR`; `js/db/api.js:calismaKaydet`, `calismaParametreAnlik`, `donemTarihleriniKoru` |
| Bölüm adı | `js/db/schema.js:BOLUM_TEMIZLE`; `js/db/api.js:butceBolumuKaydet`, `butceBolumuBirlestir`, `butceBolumuSil`, `bolumEtiket` |
| Parametre anahtarları | `js/db/api.js:PARAMETRE_TANIM`, `ZAM_TANIM`, `hesapParametre`, `parametreYaz`, `parametreDurumu`, `ongoruUygula`, `yilKopyalaIc` |
| Dış liste başlık sözlüğü | `js/db/api.js:AKTARIM_ALANLARI`, `aktarimSozluk`, `aktarimSozlukYaz`, `erpAktar`; `js/core/tablooku.js:eslestir` |
| Ücret esası | `js/db/api.js:ucretEsasi`, `ucretEsasiYazIc`, `esasBagli`, `erpAktar` (`maasEsasi`), `calismaKaydet` (`ucret_esas`), `calismaAyarYaz`, `calismaPersonelKopyala`, `calismaPersonelTasi`, `tasimaHedefleri`, `personelOnDoldur`, `birlesikHesapla`; `js/core/hesap.js` (`P.ucretEsasi`) |
| Çalışma ayarı anahtarları | `js/db/api.js:calismaHesapla`, `calismaZamKademe`, `calismaAyarYaz`, `calismaPersonelKopyala`, `mesaiAktifYaz` |
| Özet anahtarları | `js/db/api.js:calismaOzetYaz`, `calismaOzetOku`, `birlesikHesapla` |
| Aylık girdi alanları | `js/db/api.js:AYLIK_SUREKLI`, `AYLIK_TEK`, `AYLIK_KISI_ALANLARI`, `AYLIK_ETIKET`, `aylikGirdiYaz`, `aylikGirdiToplu` |
| Değerlendirme modeli ve alanları | `js/core/performans.js:VARSAYILAN`, `TURLER`, `hazirla` (`alanlar`, `alanGecerli`, `metinAlan`), `hesapla`, `aciklama`, `kodUret`; `js/db/api.js:performansModeliHam`, `performansModeli`, `calismaPerformansModeli`, `performansModeliYaz`, `performansGirdiYaz`, `performansGirdiSil`, `performansCarpanUygula`, `performansOncekiDonem` |
| Mesai öngörüsü | `js/db/api.js:mesaiOku`, `mesaiYaz`, `mesaiKopyala`, `mesaiAktifYaz`, `mesaiKisiBasi` |
| Kişi satırı alanları | `js/db/api.js:CP_ALANLAR`, `CP_SAYISAL`, `CP_BOS_OLABILIR`, `calismaPersonelKaydet`, `calismaPersonelAlanYaz`, `calismaPersonelTasi`, `erpAktar`, `trSayi` |
| Depo, okuma/yazma | `js/db/engine.js:depoOku`, `depoYaz`, `sunucudanOku`, `sunucuyaYaz`, `kaydetGecikmeli`, `kaydetHemen`, `yazmaIsi`, `ikiliAl`, `islem` |
| Şifreleme | `js/db/engine.js:anahtarUret`, `paketle`, `cozPaket`, `sifreliDosyayiAc`, `yazmadanOnceSifre`, `sifrelemeyiKur`, `sifrelemeyiKaldir`, `sifreIsaretiKoy/Kaldir/VarMi`; `js/app.js:veriParolasiSor`, `veriParolasiKurSor` |
| Yedek / geri yükleme / sıfırlama | `js/db/engine.js:yedekIndir`, `yedekSunucuyaKaydet`, `yedekListesi`, `yedekDurumu`, `yedektenYukle`, `oncesiYedek`, `yikiciIslemOncesi`, `sifirla` |
| Yazma kilidi | `js/core/kilit.js:dene`, `baslat`, `birak`, `kapanirkenBirak`, `yazabilirMi`, `engelMesaji`; `js/app.js:kilitSeridiCiz`, `kilitDurumuDegisti` |
| Zaman aşımı | `js/db/api.js:oturumZamanAsimi`, `oturumZamanAsimiYaz`; `js/app.js:zamanAsimiBaslat`, `zamanAsimiDenetle`, `zamanAsimiKapat` |
| Kullanıcı ve parola | `js/db/api.js:parolaHashle`, `parolaDogrula`, `kullaniciEkle`, `girisYap`, `oturumTazele`, `kullaniciErisimYaz`; `js/core/util.js:sha256Hex`, `rastgeleHex` |
| T.C. ve tarih | `js/core/util.js:tcTemizle`, `tcMaskele`, `tcGecerliMi` (kullanılmıyor), `tarihCoz`, `simdi` |
| İşlem kaydı | `js/db/api.js:log`, `logListe` |
| Sunucu | `Sunucuyu-Baslat.ps1` (bütün uç noktalar tek dosyada); `BUTCE-BASLAT.bat`; `Sunucu-Test-8794.ps1` |
