# Maaş Bütçe Sistemi

Kurumların **yıllık maaş bütçesini**, **zam çalışmasını** ve **ay ay işveren maliyetini** hesaplayan,
tarayıcıda çalışan bir program. Maliyet bir mini bordroyla çıkar: netten brüte, SGK işçi/işveren payları,
kümülatif gelir vergisi, damga vergisi, asgari ücret istisnası, BES ve teşvikler (05510, 05746 AR-GE, 14857
engelli, 15510 emekli).

Bordro, İK ve finans ekipleri için yazıldı. Kurulum gerektirmez: internetsiz çalışır, veriyi tek bir
(isteğe bağlı şifreli) dosyada tutar.

> **Sorumluluk notu.** Program bütçe ve öngörü içindir; resmî bordronun yerine geçmez. Yasal parametreler
> (asgari ücret, gelir vergisi dilimleri, SGK oranları, teşvik oranları, sakatlık indirimi) her yıl resmî
> kaynaktan kontrol edilmelidir. Kurulumla 2026 değerleri gelir.

## Neler yapar

- **Gruplar ve çalışmalar.** Bütçe, kurumun belirlediği gruplar için ayrı ayrı tutulur (ör. Ofis, Üretim).
  Bir grubun bir yılı bir "çalışma"dır. Onaylanan çalışma kilitlenir; parametreleri de onay anındaki hâliyle
  dondurulur. Sonradan "revize" açılabilir.
- **Zam öngörüsü.** Maaş kademesine göre oran: alt eşiğin altına üst oran, üst eşiğin üstüne alt oran, arada
  doğrusal geçiş. İsteğe bağlı olarak performans çarpanı da uygulanır; yönetim kişi bazında düzeltme girebilir.
- **Mini bordro.** Kişi × ay maliyet tablosu ve her kişi için 12 aylık bordro dökümü.
- **Aylık girdiler.** Ayni yardım, prim, mesai, yakıt, çalışılan gün, AR-GE günü; yıl içinde hesaplama türü
  ya da kanun değişikliği.
- **Yeni yıl.** Yasal parametre öngörüsü (açıklanmamış asgari ücret ve dilimler için artış oranı) ve önceki
  yılın zamlı maaşlarından yeni çalışma.
- **Performans değerlendirmesi.** Amir puanları, bölüm katsayısı ve zam çarpanı. Gelen model bir
  **örnektir**; kriterleri ve ağırlıkları kendi politikanıza göre `program/js/core/performans.js`'te değiştirin.
- **Mesai öngörüsü.** Bölüm × ay mesai saati.
- **Excel.** Yönetim raporu çıktısı ve geri dönen dosyanın içe alınması; performans ve mesai şablonları; ERP ya
  da bordro programından alınan personel listesinin aktarımı (Dış Liste Aktarımı).
- **Kullanıcılar.** Rol yerine kişi bazında yetki ve grup erişimi; işlem kaydı; hareketsizlikte otomatik çıkış.
- **Veri güvenliği.** İsteğe bağlı şifreleme (AES-256-GCM, paroladan PBKDF2 ile anahtar), otomatik ve elle
  yedek, aynı anda birden çok kişi ya da sekme açtığında yazma kilidi.

## Çalıştırma (Windows)

Gereken: Windows PowerShell 5.1 ya da üstü ve güncel bir tarayıcı.

- **Normal:** `program/BUTCE-BASLAT.bat` dosyasına çift tıklayın. Tarayıcıda `http://localhost:8764/` açılır.
  Siyah sunucu penceresi açık kaldığı sürece program çalışır. Veri, program klasörünün yanındaki
  `veri/butce.db` dosyasına yazılır.
- **Deneme (ayrı veri klasörüyle, gerçek veriye dokunmaz):**
  `powershell -ExecutionPolicy Bypass -File program/Sunucuyu-Baslat.ps1 -Port 8793 -VeriKok C:\gecici\butce-deneme -Deneme`

**İlk açılış:**

1. Veri parolası sorulur. Parola belirleyebilir ya da "Şifresiz devam" diyebilirsiniz; şifrelemeyi sonradan
   Sistem ekranından da kurabilirsiniz.
2. Yönetici hesabı oluşturulur.
3. Başlangıç seçilir:
   - **Örnek veriyle başla:** uydurma iki grup (Ofis, Üretim), 56 kişi, 2026 onaylı ve 2027 taslak
     çalışmalar. Programı tanımak içindir.
   - **Boş başla:** yalnız yasal parametreler ve bir "Genel" grubu. Gruplarınızı **Tanımlar → Gruplar**'dan
     açın; personeli elle girin ya da Dış Liste Aktarımı ile alın.

Örnek veriden gerçek kullanıma geçerken **Sistem → Veritabanını Sıfırla** ile baştan başlayın.

Program içinde ayrıntılı bir **Kullanım Kılavuzu** vardır (sol alttaki düğme).

## Klasörler

| Yol | İçerik |
|---|---|
| `program/` | Programın kendisi: tek sayfa uygulama (`index.html`) ve yerel PowerShell sunucusu |
| `program/js/core/hesap.js` | **Hesap motoru**: bordro ve maliyet hesabının tamamı. Dışa bağımlılığı olmayan saf JavaScript |
| `program/js/core/performans.js` | Performans puanı → zam çarpanı (örnek model) |
| `program/js/db/api.js` | İş kuralları ve veri işlemleri (çalışma, personel, zam, aylık girdi, yetki…) |
| `program/js/db/schema.js`, `engine.js` | Veritabanı şeması, sürüm göçleri, dosyaya yazma, şifreleme |
| `program/js/modules/` | Ekranlar (her ekran bir dosya) |
| `program/data/seed.js` | Yasal parametreler ve örnek veri yükleyicisi |
| `program/data/ornek-veri.js` | Örnek veri (üretilmiş dosya; elle düzenlemeyin) |
| `tools/ornek-veri-uret.mjs` | Örnek veri üreteci (`node tools/ornek-veri-uret.mjs`) |
| `docs/` | Teknik belgeler (aşağıda) |
| `docs/referans/` | Örnek veriyle kurulmuş şifresiz veritabanı ve kişi kişi, ay ay referans sonuçlar |

## Belgeler

1. [`docs/01-veri-modeli-ve-depolama.md`](docs/01-veri-modeli-ve-depolama.md): bütün tablolar ve sütunlar,
   ilişkiler, şema sürümleri, başlangıç verisi, dosyaya kayıt, şifreleme, yedek, yazma kilidi, sunucu uç
   noktaları, veri dosyasını başka bir sisteme aktarma.
2. [`docs/02-hesap-motoru.md`](docs/02-hesap-motoru.md): girdi ve parametre sözlüğü, aylık bordronun adım
   adım formülleri (netten brüte, SGK tavanı, kümülatif GV, asgari ücret istisnası, teşvikler), yıllık hesap,
   zam motoru, performans modeli, rakamlı örnekler ve sınama vektörleri.
3. [`docs/03-is-kurallari-ve-yetkiler.md`](docs/03-is-kurallari-ve-yetkiler.md): çalışma yaşam döngüsü (yeni
   yıl, kopya, onay, revize), personel işlemleri, aylık girdi kuralları, içe almalar, yetki modeli, güvenlik
   denetimleri ve tasarım kararları.
4. [`docs/04-ekranlar-ve-dosya-bicimleri.md`](docs/04-ekranlar-ve-dosya-bicimleri.md): ekranların alanları,
   sütunları, düğmeleri ve davranışları; bütün Excel çıktı ve içe alma biçimleri.

Her belgenin sonunda "doğrulanamayan / dikkat edilecek noktalar" bölümü vardır.

## Hesabı sınamak

Programı değiştirdiyseniz ya da hesap motorunu başka bir sisteme taşıdıysanız, sonuçları referansla
karşılaştırın:

1. `docs/referans/ornek-veri.db` örnek veriyle kurulmuş, **şifresiz** bir veritabanıdır. Programla açmak için
   deneme sunucusunun veri klasörüne `veri/butce.db` adıyla koyun. Giriş: kullanıcı adı **`deneme`**, parola
   **`ornek-1234`** (yalnız bu örnek dosya içindir).
2. Her çalışmanın kişi kişi, ay ay sonuçları `docs/referans/ornek-veri-sonuclari.json` dosyasındadır. Toplamlar
   (TL):

   | Çalışma | Durum | Kişi | Toplam yıllık maliyet |
   |---|---|---|---|
   | 2026 · Ofis | Onaylı | 25 | 50.566.328,09 |
   | 2026 · Üretim | Onaylı | 31 | 28.655.685,33 |
   | 2027 · Ofis | Taslak | 25 | 63.179.730,56 |
   | 2027 · Üretim | Taslak | 30 | 36.497.602,97 |

   2027 çalışmaları Parametreler → Yeni Yıl Öngörüsü (%25) ve "önceki yılın çalışmasından" yeni çalışma ile
   açılmıştır.
3. Tek kişilik elle sınama için `docs/02-hesap-motoru.md` içindeki rakamlı örnekler ve sınama vektörleri
   kullanılabilir.

## Örnek veri hakkında

Örnek verideki her şey uydurmadır ve `tools/ornek-veri-uret.mjs` ile sabit tohumlu bir rastgele sayı
üretecinden üretilir; aynı komut her seferinde aynı dosyayı verir. Adlar "ÖRNEK ÇALIŞAN 001" biçimindedir.
T.C. numaralarının kontrol hanesi **kasıtlı olarak yanlıştır**: hiçbiri gerçek bir kişiye ait olamaz.

## Gerçek veri ve güvenlik

- Canlı veri yalnız `veri/butce.db` dosyasındadır. `.gitignore`, gerçek veri dosyalarının (`*.db`, `veri/`,
  `yedek/`, Excel dosyaları) depoya girmesini engeller; tek istisna `docs/referans/ornek-veri.db`'dir.
  **Kişisel veri içeren dosyaları depoya ya da paylaşılan bir yere koymayın (KVKK).**
- Veri parolasını kaybederseniz şifreli veriye kimse ulaşamaz; arka kapı yoktur.
- Program tarayıcıda çalışır: yetki denetimleri ekran dışından yapılan API çağrılarını da engeller, ancak
  şifresi çözülmüş veritabanı oturum boyunca tarayıcı belleğindedir. Okuma yetkilerinin tam korunması
  gerekiyorsa (ör. çok kullanıcılı bir ağ kurulumu) hesap ve veri sunucu tarafına taşınmalıdır. Ayrıntı:
  `docs/03-is-kurallari-ve-yetkiler.md` → Güvenlik denetimleri.

## Lisans

[MIT](LICENSE). Program olduğu gibi sunulur; hesapların doğruluğu için hiçbir güvence verilmez (bkz.
baştaki sorumluluk notu).

## Üçüncü taraf bileşenler

`program/js/vendor/` altındaki kütüphaneler kendi lisanslarıyla dağıtılır: [sql.js](https://github.com/sql-js/sql.js)
(MIT; SQLite kamu malıdır) ve [ExcelJS](https://github.com/exceljs/exceljs) (MIT). Ayrıntı:
`program/js/vendor/LISANSLAR.md`.
