# 04 — Ekranlar ve Dosya Biçimleri

> **Kapsam:** Maaş Bütçe Sistemi'nin bütün ekranları, pencereleri, ortak arayüz davranışları ve bütün Excel çıktı / içe alma biçimleri.
> **Okur:** programı kullanacak ya da değerlendirecek bordro, İK ve finans uzmanları; programı uyarlayacak ya da ekranlarını başka bir sistemde **aynı alanlar, sütunlar, düğmeler ve davranışla** yeniden kuracak yazılımcılar.
>
> **Kaynak:** `program/` klasörünün güncel kodu: `index.html`, `js/app.js`, `js/modules/*.js`, `js/core/*.js` (`bilesen.js`, `bicim.js`, `util.js`, `ikon.js`, `tablooku.js`, `performans.js`, `kilit.js`), API davranışı için `js/db/api.js`, görünüm için `css/app.css` ve `css/butce.css`. Her bilginin yanında kaynağı `dosya.js:işlev` biçiminde verilir. Ekranda görünen metinler tırnak içinde, koddaki gibi yazılmıştır.
> Belgede kişi adı, T.C. ya da kişiye ait tutar yoktur. Geçen sayılar koddaki sabitler / varsayılanlar ya da yuvarlak örneklerdir; örnek grup adları (Ofis, Üretim) programla gelen örnek veridendir.
> `program/img/kilavuz/*.png` görselleri bu belgenin kaynağı değildir (bkz. §6).
>
> **Diğer belgeler:** "01 — Veri Modeli ve Depolama" (tablolar, depolama, yedek, şifreleme), "02 — Hesap Motoru" (bordro ve zam hesabı, alan kodları), "03 — İş Kuralları, İş Akışları ve Yetkiler" (iş akışları, yetki tablosu). Bu belge onların ekrandaki karşılığını anlatır; hesap ve kural ayrıntısı için bölüm adıyla onlara gönderme yapar.
>
> **İşaretler:** ⚠ = yeniden kurarken dikkat edilecek davranış (koddan doğrulandı) · **doğrulanamadı** = koddan kesin çıkarılamayan nokta.

---

## İçindekiler

0. [Okuma notları ve terimler](#0-okuma-notları-ve-terimler)
1. [Uygulama kabuğu](#1-uygulama-kabuğu)
2. [Ortak arayüz davranışları](#2-ortak-arayüz-davranışları)
3. [Ekranlar](#3-ekranlar)
   - 3.1 Özet · 3.2 Maaş Dağılımı
   - 3.3 Personel ve Zam (+ kişi kartı) · 3.4 Maliyet Tablosu (+ bordro dökümü) · 3.5 Aylık Girdiler
   - 3.6 Performans Değerlendirme (+ kişi penceresi, değerlendirme modeli) · 3.7 Fazla Mesai Planı · 3.8 Bütçe Çalışmaları (+ yeni çalışma / ayarlar / revize) · 3.9 Excel Raporu
   - 3.10 Personel İçe Aktarma
   - 3.11 Parametreler · 3.12 Tanımlar (+ Gruplar, İçe Aktarma Başlıkları)
   - 3.13 Kullanıcılar ve Yetkiler · 3.14 Sistem
   - 3.15 Kullanım Kılavuzu
4. [Bütün Excel çıktıları ve içe almalar](#4-bütün-excel-çıktıları-ve-içe-almalar)
5. [Ekranlar arası gezinme haritası](#5-ekranlar-arası-gezinme-haritası)
6. [Doğrulanamayan ve dikkat edilecek noktalar](#6-doğrulanamayan-ve-dikkat-edilecek-noktalar)

---

## 0. Okuma notları ve terimler

| Terim | Anlamı |
|---|---|
| **Grup** | Bütçenin ayrı tutulduğu birim (birim, işyeri, şube…). Kullanıcı tanımlıdır: `grup` tablosu (`kod`, `ad`, `sira`, sabit maaş aralıkları), Tanımlar → Gruplar sekmesinden (§3.12.3) ya da örnek veriyle gelir. Örnek veride **Ofis** (`OFIS`) ve **Üretim** (`URETIM`); "Boş başla" ile kurulan programda tek grup **Genel** (`GENEL`). `TUMU` kodu ayrılmıştır (üst çubuktaki "Tümü"). |
| **Çalışma** | Bir grubun bir yılının bütçesi (`calisma` tablosu). Durum `TASLAK` ya da `ONAYLI`. Aynı yıl + grupta birden çok çalışma olabilir (örn. "2027 Bütçe" ve "2027 Revize"). |
| **O / Y** | Ekran başlıklarında `O = çalışma yılı − 1` (önceki yıl), `Y = çalışma yılı`. Başlıklarda gerçek yıl yazılır (örn. "2026 Maaş", "2027 Zam Miktarı"). |
| **Yaka** | `B` = beyaz yaka, `M` = mavi yaka. |
| **kp** | Hesaptaki kişinin bütçe satırı (`calisma_personel` + `personel` birleşimi, `API.calismaPersonelListe`). Kişinin tek maaş alanı `kp.maas_eski`'dir: önceki yıl net maaşı (yıl içinde girende o yılın maaşı). |
| **s** | `API.calismaHesapla(id).kisiler[i]` = `{ kp, zam, yil, girdi }`; Tümü'de `API.birlesikHesapla` her kişiye ayrıca `calisma` ekler. |
| **s.zam** | Zam sonucu (`HESAP.zamHesapla`, `js/core/hesap.js`): `eski` (= `kp.maas_eski`), `oranOngoru`, `ongoru`, `miktar` (= öngörü + düzeltme), `yeni` (= eski + miktar; zamlı maaş), `oran`. Ayrıntı: "02 — Hesap Motoru", §5 Zam motoru. |
| **s.yil** | Yıl hesabı (`HESAP.yilHesapla`): `s.yil.maliyet` (yıllık toplam maliyet), `s.yil.aylar[1..12]` (her ay motorun **alan kodlarıyla**: `DM` toplam maliyet, `CV` brüt toplam, `DD` net ödeme, `AM` net maaş, `CW` SGK işçi, `DE` SGK işveren, `CZ` ödenecek GV, `DB` ödenecek DV, `DG…DL` teşvikler, `BM` brüt mesai, `AP` AR-GE günü, `AR` sigorta günü …). Sözlük: "02 — Hesap Motoru", §3.12 Alan kodu sözlüğü. |
| **s.girdi[m]** | O ayın etkin girdileri (devralınanlar dâhil, `api.js:calismaHesapla`): `tur`, `kanun` (kural kodu), `kanunOran`, `sakatlikDerece`, `ozurluIndirimi`, `bes`, `gvTesvik`, `yol`, `fm1`, `fm2`, `argeGun`, `ayni`, `prim`, `yakit`, `calisilanGun`. |
| **Yazılabilir** | `API.calismaYazilabilir(c)` = çalışma `ONAYLI` değil **ve** kullanıcının o gruba yazma ("Görür ve düzenler") erişimi var. Ekranlar düzenleme alanlarını buna + ilgili yetkiye göre açar. Yazma kilidini (§2.2) bilmez. |
| **Yetkiler** | `window.YETKILER` (`js/db/schema.js`), 11 kod (aşağıda). Sistem yöneticisi (`yonetici = 1`) hepsine sahiptir (`api.js:yetkiVar`). Yazma yetkileri (`.yaz`, `.yonet`) ayrıca yazma kilidini ister (`api.js:yetkiIste`). |
| **Tazele** | `APP.tazele()` = etkin ekranı baştan çizer (`app.js:git(aktifModul)`, açılış parametresi olmadan). Ekranların çoğu her kayıttan sonra tazelenir. |
| **Değerlendirme modeli** | Performans puanlamasının yıl bazındaki tanımı (amirler, kriterler, ağırlıklar, ek puan kuralları). `parametre` tablosunda `perf.model` (JSON); kayıt yoksa programla gelen örnek model. Performans Değerlendirme ekranından düzenlenir (§3.6.2). |
| **Aktarım sözlüğü** | Personel İçe Aktarma'nın her alan için tanıdığı sütun başlıkları. Varsayılanlar `api.js:AKTARIM_ALANLARI`; değişiklikler `sistem_bilgi.aktarim.sozluk`. Tanımlar → İçe Aktarma Başlıkları'ndan düzenlenir (§3.12.5). |

Yetki açıklamaları (ekranda ve Kılavuz'da aynen görünür, `schema.js:YETKILER`):

| Kod | Açıklama metni |
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

Ekran dışındaki okuma kapıları (`api.js` "OKUMA KAPILARI"): hesap ve kişi verisini döndüren API işlevleri ilgili okuma yetkilerinden birini ister; yoksa "Bu bilgiyi görme yetkiniz yok."; kullanıcının göremediği grubun çalışması için "Bu grubun verisini görme yetkiniz yok." Ayrıntı: "03 — İş Kuralları, İş Akışları ve Yetkiler", §7.5.

---

## 1. Uygulama kabuğu

Kaynak: `index.html`, `js/app.js`.

### 1.1 Sayfa yerleşimi (`index.html`)

```
a.atla  : "İçeriğe geç" bağlantısı (#icerik; yalnız klavye odağında görünür)
┌───────────────┬───────────────────────────────────────────────────────────────┐
│ aside.kenar   │ main                                                           │
│  .marka       │  .ust:  [h1#sayfaBaslik / #sayfaAltBaslik]  [#donemSecici][#kayitDurum] │
│   "Maaş Bütçe"│  #kilitSerit (görüntüleme kipi şeridi, çoğunlukla gizli)        │
│   "Bütçe · Zam · Maliyet"                                                      │
│  nav#menu (aria-label="Ana menü") │  #icerik (etkin ekran)                         │
│  #kenarAlt    │                                                                │
└───────────────┴───────────────────────────────────────────────────────────────┘
#perde  : açılış / giriş / parola perdeleri (tam ekran)
#kipKap : açılan pencerelerin (kip) kabı
```

- Sayfa başlığı (`<title>`): "Maaş Bütçe Sistemi". Dil `tr`.
- Kütüphaneler yereldir (internet gerekmez): `js/vendor/sql-wasm.js`, `sql-wasm-binary.js`, `exceljs.min.js`. Betik sırası: çekirdek (`schema`, `engine`, `kilit`, `util`, `ikon`, `hesap`, `performans`, `api`, `bilesen`, `bicim`, `tablooku`), başlangıç verisi (`data/ornek-veri.js`, `data/seed.js`), `app.js`, sonra modüller **menüdeki sıralarıyla**: `ozet`, `dagilim`, `calisma`, `personel`, `aylik`, `maliyet`, `performans`, `mesai`, `aktarim`, `excel`, `parametre`, `tanim`, `kullanici`, `sistem`, `kilavuz`.
- Erişilebilirlik: sayfanın başındaki "İçeriğe geç" bağlantısı (`a.atla`) yalnız klavyeyle odaklanınca görünür ve `#icerik`e atlar; menü `nav aria-label="Ana menü"`, seçili menü düğmesi `aria-current="page"` taşır; klavye odağında görünür odak halkası (`:focus-visible`), düğme ve giriş kutuları en az 36 px, ikon düğmeleri en az 30 px yükseklikte; işletim sisteminde "hareketi azalt" seçiliyse animasyon ve geçişler kapanır (`prefers-reduced-motion`). Simgeler için §2.15.
- Açılışta `#perde` içinde dönen simge + "Veritabanı hazırlanıyor…", sonra "SQLite motoru yükleniyor…", yeni veritabanına başlangıç verisi yazılırken "Veriler aktarılıyor…" (`app.js:baslat`).
- Dar ekranda (≤ 900 px) kenar çubuğu üste geçer, menü düğmeleri yan yana sarılır; yazdırırken kenar çubuğu, üst çubuk ve düğmeler gizlenir (`css/app.css`, `@media`).

### 1.2 Açılış perdeleri (giriş öncesi)

Hepsi `#perde` içinde "perde-kart" olarak çizilir (simge, büyük başlık, alt yazı, açıklama, alanlar).

**a) Veri parolası sorma** — `app.js:veriParolasiSor(tekrarMi, baglam)` (veri dosyası şifreliyse, giriş ekranından önce)
- Başlık: "Veri Parolası" (şifreli bir yedek geri yüklenirken "Şifreli Yedek"); alt yazı: "Maaş verileri şifreli saklanıyor" / "Yedeği açmak için parola gerekli".
- Açıklama: "Bu, sisteme giriş parolanız **değildir**. Veri dosyasını açan parolayı girin — dosyayı kopyalayan biri bu parola olmadan içindekileri okuyamaz." (yedekte: "Bu yedek alındığı tarihteki **veri parolasını** girin.")
- Alan "Veri parolası" (password, `#vpParola`). Düğme **Aç**. Enter = Aç.
- Hatalar: boşsa "Parola girilmedi."; yanlış parola sonrası yeniden sorulduğunda "Parola yanlış. Tekrar deneyin." Gönderince "🔓 Açılıyor…".

**b) Yeni veri parolası belirleme** — `app.js:veriParolasiKurSor(baglam)`; `baglam` ∈ `tasima | kurulum | surdur`. Dosya diske ilk yazılmadan önce sorulur (verinin şifresiz kopyası hiç oluşmasın diye); kıyaslanacak eski parola olmadığından iki kez sorulur.
- Başlık / alt yazı / açıklama:
  - `tasima` → "Verileriniz Dosyaya Taşınıyor" / "Tarayıcıdan bağımsız, şifreli depolama" / "Kayıtlarınız artık tarayıcıda değil, program klasörünün yanındaki **veri** klasöründe duracak. Dosya diske yazılmadan önce bir **veri parolası** belirleyin: …"
  - `kurulum` → "Veri Parolası Belirleyin" / "Yeni kurulum" / "Veri dosyası diske yazılmadan önce bir **veri parolası** belirleyin: dosyayı kopyalayan biri bu parola olmadan içindekileri okuyamaz."
  - `surdur` → "Veri Parolası Gerekli" / "Veritabanı yeniden kuruluyor" / "Bu kurulumda veri şifrelemesi **açık**. Parola yalnızca bellekte tutulur ve sıfırlamada kaybolur; yeni dosyanın da şifreli yazılması için parolayı **yeniden girin** — eskisinin aynısını."
- Kırmızı uyarı (🔑): "Bu parola sisteme giriş parolanızdan **ayrıdır**. **Kaybederseniz veriye kimse ulaşamaz** — arka kapı yoktur. Kilitli bir yerde yazılı saklayın."
- Alanlar: "Veri parolası (en az 8 karakter)", "Veri parolası (tekrar)". Enter her iki alanda gönderir.
- Doğrulama: `< 8` → "Parola en az 8 karakter olmalıdır."; eşleşmezse "İki parola aynı değil." Gönderince "Şifreleniyor…".
- Düğmeler: **Şifresiz devam et** (ikincil) · **🔒 Şifreli Kaydet**.
- "Şifresiz devam et" → aynı perdede ikinci kart "Şifresiz devam edilsin mi?": kırmızı kutu "Veri dosyası **ŞİFRESİZ** yazılacak. Dosyayı kopyalayan herkes bütün maaşları okuyabilir." + "Daha sonra **Sistem → Veri Deposu** üzerinden şifrelemeyi kurabilirsiniz." Düğmeler: **← Parola belirleyeyim** (ilk karta döner) · **Şifresiz devam** (tehlike; "Kaydediliyor…").

**c) İlk kurulum (yönetici hesabı)** — `app.js:ilkKurulumEkrani` (hiç kullanıcı yoksa; `API.kullaniciVarMi`)
- Başlık "İlk Kurulum" / "Yönetici hesabı oluşturun". Açıklama: "Sisteme girişte kullanacağınız yönetici hesabını şimdi oluşturun. Parola yalnızca bu bilgisayarda, geri döndürülemez biçimde saklanır — kaybederseniz geri alınamaz."
- Alanlar (hepsi zorunlu `*`): Ad Soyad (yer tutucuda uydurma bir ad); Kullanıcı Adı ("— girişte yazacağınız ad"); Parola ("— en az 6 karakter"); Parola (tekrar).
- **Başlangıç** — iki açıklamalı seçenek kutusu (`label.secenek`: radyo + kalın ad + altında soluk açıklama):
  - **Örnek veriyle başla** (varsayılan) — "Uydurma iki grup ve personel; programı denemek için." → `API.ornekVeriYukle()` (Ofis / Üretim grupları, bölümleri, örnek personel ve çalışmalar; bkz. "01 — Veri Modeli ve Depolama", §5.5).
  - **Boş başla** — "Yalnız yasal parametreler ve bir "Genel" grubu." → `API.varsayilanGrupAc()` (hiç grup yoksa `GENEL` / "Genel" / sıra 1).
  - İpucu: "Örnek veriden gerçek kullanıma geçerken Sistem → Veritabanını Sıfırla ile baştan başlayın."
- Düğme: **Hesabı Oluştur ve Başla** (çalışırken "Oluşturuluyor…"). Enter her alanda gönderir.
- Doğrulama: Ad boş → "Ad Soyad giriniz."; parolalar farklı → "Parolalar birbirini tutmuyor."; ayrıca `API.kullaniciEkle` hataları: "Kullanıcı adı boş olamaz." · "Kullanıcı adı en az 3 karakter olmalı; yalnızca harf, rakam, nokta, tire kullanın." · "Parola en az 6 karakter olmalıdır." · "Bu kullanıcı adı zaten kayıtlı." (kullanıcı adı küçük harfe çevrilir).
- Başarıda yönetici hesabıyla giriş yapılır, başlangıç verisi yazılır, veri hemen kaydedilir ve uygulama açılır. Başlangıç verisi yazılamazsa uygulama yine açılır, bildirim: "Başlangıç verisi yüklenemedi: …" (hata).

**d) Giriş** — `app.js:girisEkrani`
- "Maaş Bütçe Sistemi" / "Bütçe · Zam · Maliyet". Alanlar: Kullanıcı Adı, Parola. Düğme **Giriş Yap** ("Kontrol ediliyor…"). Enter gönderir; açılışta Kullanıcı Adı odaklanır.
- Hata metinleri (`api.js:girisYap`): "Kullanıcı adı veya parola hatalı." · "Bu kullanıcı devre dışı bırakılmış." Hatada parola alanı temizlenir ve odaklanır.
- Alt bölüm **Giriş yapamıyorum** (açılır / kapanır):
  - "Kayıtlı kullanıcı adları aşağıda listelenir. Parola görüntülenemez — saklanmaz, yalnızca doğrulanabilir biçimde tutulur."
  - Liste: "ad (yönetici | kullanıcı[, devre dışı])" `·` ile ayrılmış; liste yoksa "Kayıtlı kullanıcı bulunamadı — sıfırlama sonrası kurulum ekranı gelir."; okunamazsa "Kullanıcı listesi okunamadı: …".
  - "Yedek dosyasından geri yükle (.db)" dosya alanı (`accept=".db,.sqlite,.sqlite3"`) + **Yedeği Geri Yükle** ("Geri yükleniyor…"). Dosya yoksa "Önce bir yedek dosyası seçin."; tarayıcı onayı: "Seçilen yedek geri yüklenecek; şu anki veri onunla değiştirilir. … Önce şu anki hâl otomatik olarak yedek-elle klasörüne yedeklenecek. … Devam edilsin mi?"; hata: "Yedek geri yüklenemedi: …". Başarıda sayfa yenilenir. Alt not: "Geri yüklemeden önce mevcut veri otomatik olarak **yedek-elle** klasörüne yedeklenir."
  - Giriş ekranında sıfırlama düğmesi **yoktur** (giriş yapmadan bütün kayıtlar silinebilirdi); sıfırlama yalnız Sistem ekranındadır (§3.14).

**e) Başlatma hatası** — `app.js:baslat` (veritabanı açılamazsa): "⚠ Sistem başlatılamadı" / "Hata" / hata metni + sarı ipucu "Dosyaların eksiksiz kopyalandığından emin olun. Sorun sürerse tarayıcıyı kapatıp yeniden açın."

**f) Çakışma perdesi** — `app.js:cakismaPerdesi` (kapatılamaz; başka biri ya da başka sekme sonradan kayıt yaptıysa)
- "Kaydınız yazılmadı" / "Veri dosyası siz açtıktan sonra değişti"; açıklama "Siz sayfayı açtıktan sonra **başka biri ya da başka bir sekme** kayıt yaptı. Sizin son değişikliğiniz, onunkini silmemek için dosyaya **yazılmadı**." + 💡 ipucu "Önce **Yedek Al** ile ekrandaki hâli indirin (gerekirse oradan geri alınabilir), sonra **Sayfayı Yenile** deyip güncel veriden devam edin."; düğmeler **⤓ Yedek Al** (`ADB.yedekIndir`) · **↻ Sayfayı Yenile**.

**g) Hareketsizlik perdesi** — `app.js:zamanAsimiBaslat / zamanAsimiDenetle / zamanAsimiKapat`
- Süre (dakika) `API.oturumZamanAsimi()` (varsayılan 5; 0 = kapalı; Sistem → Otomatik Kapanma, §3.14). Sayaç veri açıldığı anda başlar (giriş ekranında beklerken de işler). Hareket sayılan olaylar: fare hareketi / tıklaması, tuş, tekerlek, dokunma, kaydırma (saniyede en çok bir kez).
- Bitime **30 sn** kala: "⏱ Oturum kapanmak üzere" / "N dakikadır işlem yapılmadı" / "Güvenlik için program **X** saniye içinde kapanacak. Kayıtlarınız korunur; yeniden açmak için veri parolası ve giriş parolası istenir." + **Devam et**. Perde açıkken fare hareketi süreyi sıfırlamaz; yalnız "Devam et".
- Süre dolunca: bekleyen kayıt yazılır, kilit bırakılır, sayfa **yeniden yüklenir** (veri parolasının anahtarı bellekten silinsin diye; yalnız çıkış yapılsaydı anahtar bellekte kalırdı). Yeni açılışta bildirim "Hareketsizlik nedeniyle oturum kapatıldı; kayıtlarınız korundu."

**h) Açılış sonrası bildirimleri** (`app.js:baslat / depoUyarisi / sifrelemeDustuKontrol`)
- Taşındıysa: "Verileriniz tarayıcıdan veri dosyasına taşındı[ ve şifrelendi]." (başarı)
- Yabancı anahtar denetimi kapalıysa: "Uyarı: veritabanı bütünlük denetimi etkinleştirilemedi." (hata)
- Sunucusuz açıldıysa: "Dikkat: program sunucusuz açıldı, kayıtlar veri dosyasına DEĞİL tarayıcıya yazılıyor. Programı BUTCE-BASLAT.bat ile açın." (hata)
- Şifreleme düştüyse: "Veri şifrelemesi kapalı görünüyor! Sistem → Veri Deposu ekranından şifrelemeyi yeniden kurun." (hata)
- Kayıt hatası (her an): "Veri dosyaya kaydedilemedi! … — siyah sunucu penceresinin açık olduğunu kontrol edin." (hata)

### 1.3 Menü (`app.js:menuCiz`)

Modüller `APP.modulKaydet({ id, ad, ikon, grup, baslik, altBaslik, yetki, calismaGerekli, tumuDestek, gorunur, sayac, ciz })` ile kaydolur. Menü başlıkları şu sırayla: **Genel, Bütçe, İçe / Dışa Aktarma, Tanımlar, Yönetim** (`sira` dizisi; listede olmayan başlık sona düşer). Başlık içinde sıra = `index.html`'deki betik yükleme sırası. Bir modül, `yetki` tanımsızsa ya da kullanıcı yetkiliyse **ve** `gorunur()` (varsa) doğruysa görünür. Menü her ekran açılışında yeniden çizilir.

Menü simgeleri SVG çizgi simgelerdir (`IKON.menu(id)`, `js/core/ikon.js`; §2.15); kayıttaki `ikon` alanı (emoji) menüde kullanılmaz. Aşağıdaki tabloda simge, `ikon.js:MENU` eşlemesindeki adıyla verilmiştir.

| Menü başlığı | Ekran | `id` | Simge (`IKON`) | Gereken yetki | `calismaGerekli` | "Tümü"de çalışır mı (`tumuDestek`) | Not |
|---|---|---|---|---|---|---|---|
| Genel | Özet | `ozet` | `ozet` (pano) | `ozet.oku` | evet | **evet** | Girişten sonra açılan ilk ekran |
| Genel | Maaş Dağılımı | `dagilim` | `grafik` | `ozet.oku` | evet | **evet** | — |
| Bütçe | Bütçe Çalışmaları | `calisma` | `klasor` | `personel.oku` | hayır | (seçim gerekmez; "Tümü"de bütün grupları listeler) | — |
| Bütçe | Personel ve Zam | `personel` | `kisiler` | `personel.oku` | evet | hayır | Rozet: seçili çalışmadaki kişi sayısı (0 ise rozet yok) |
| Bütçe | Aylık Girdiler | `aylik` | `takvim` | `personel.oku` | evet | hayır | — |
| Bütçe | Maliyet Tablosu | `maliyet` | `hesap` (hesap makinesi) | `ozet.oku` | evet | **evet** | — |
| Bütçe | Performans Değerlendirme | `performans` | `hedef` | `zam.oku` | evet | hayır | Her grupta çalışır; "Değerlendirme modeli…" penceresi |
| Bütçe | Fazla Mesai Planı | `mesai` | `saat` | `personel.oku` | evet | hayır | Her grupta çalışır |
| İçe / Dışa Aktarma | Personel İçe Aktarma | `aktarim` | `yukle` | `personel.yaz` | evet | hayır | — |
| İçe / Dışa Aktarma | Excel Raporu | `excel` | `tablo` (tablolu belge) | `excel.aktar` | evet | hayır | — |
| Tanımlar | Parametreler | `parametre` | `ayar` (sürgüler) | `parametre.oku` | hayır | (seçim gerekmez) | — |
| Tanımlar | Tanımlar | `tanim` | `liste` | `parametre.oku` | hayır | (seçim gerekmez) | Gruplar sekmesi yalnız sistem yöneticisine; İçe Aktarma Başlıkları sekmesi |
| Yönetim | Kullanıcılar | `kullanici` | `anahtar` | `sistem.yonet` | hayır | — | Sayfa başlığı "Kullanıcılar ve Yetkiler" |
| Yönetim | Sistem | `sistem` | `disli` | `sistem.yonet` | hayır | — | — |
| (Yardım; menüde yok) | Kullanım Kılavuzu | `kilavuz` | `kitap` | yok | hayır | — | `gorunur: () => false`; sol alttaki düğmeyle açılır |

Menüdeki seçili ekran `etkin` sınıfı ve `aria-current="page"` alır. Tıklanınca `APP.git(id)`. Yetkisiz `git` çağrısında bildirim: "Bu bölüme erişim yetkiniz yok." (hata). Menü rozeti `U.sayi` ile biçimlenir.

### 1.4 Kenar alt (`app.js:kenarAltCiz`)

- Kullanıcının ad soyadı; rol ("Sistem Yöneticisi" / "Kullanıcı").
- **📖 Kullanım Kılavuzu** → `git('kilavuz')` (§3.15). (📖 düğme içinde olduğu için kitap simgesine çevrilir, §2.15.)
- **Çıkış Yap** → kilit bırakılır, `API.cikisYap` (işlem kaydına `CIKIS`), veri hemen kaydedilir, açık pencereler kapanır, giriş perdesi açılır.

### 1.5 Üst çubuk: yıl · grup · çalışma seçici (`app.js:calismaSeciciCiz`)

- **Yıl** (`select#yilSec`): `yilListesi()` = çalışması olan yıllar ∪ parametresi olan yıllar (`API.yillar`), büyükten küçüğe. Liste boşsa içinde bulunulan takvim yılı kullanılır.
- **Grup düğmeleri** (`.grup-dugmeler`): yalnız kullanıcının görebildiği gruplar (`API.gorunurGruplar`, grup sırasıyla, düğme yazısı grup adı); görünür grup sayısı > 1 ise ayrıca **Tümü** (`data-grup="TUMU"`). Seçili düğme `etkin` (vurgu rengi zemin, beyaz kalın yazı). Düğmeler küçülmez; yer yetmezse üst çubuk alt satıra geçer.
- **Çalışma seçici** (`select#calismaSec`): yalnız seçili yıl + grupta **birden çok** çalışma varsa çıkar. Seçenek metni: `<çalışma adı> · <kişi> kişi[ · onaylı]`.
- Hiç görünür grup yoksa seçicilerin yerine soluk metin: sistem yöneticisine "Henüz grup yok — Tanımlar → Gruplar sekmesinden ekleyin", diğerlerine "Size atanmış grup yok — yöneticinize başvurun" (bağlantı değildir).
- Seçimin saklanması: `localStorage['butce_secim'] = { yil, grup, calisma }` (`secimKaydet`); girişte geri okunur (`secimYukle`; saklı grup artık görünmüyorsa ilk görünür grup, "Tümü" yalnız birden çok grup varsa). Yıl / grup değişince seçili çalışma sıfırlanır ve o yıl + grubun **ilk** çalışması kullanılır (`APP.calisma`). Liste sırası `API.calismaListe`: yıl azalan, grup sırası, çalışma adı.
- "Tümü"de çalışma seçici yoktur; Tümü destekleyen ekranlar yılın her grubundan **ilk** çalışmayı alır (`APP.calismalar`).
- Her seçim değişikliğinde etkin ekran yeniden çizilir (`secimYap` / `calismaSec` → `tazele`).

### 1.6 Ekran açma akışı (`app.js:git`)

1. Oturum tazelenir (`API.oturumTazele`: yönetici / etkin bilgisi, yetkiler ve grup erişimi veritabanından yeniden okunur). Kullanıcı silinmiş ya da devre dışı bırakılmışsa bildirim "Hesabınız devre dışı bırakıldı ya da silindi; oturum kapatıldı." (uyarı) ve çıkış yapılır.
2. Ekranın `yetki`si yoksa "Bu bölüme erişim yetkiniz yok." (hata); ekran değişmez.
3. Sayfa başlığı = `baslik` (yoksa `ad`), alt başlık = `altBaslik`; açık pencereler kapanır; `#icerik` öğesi **yeniden oluşturulur** (eski dinleyiciler birikmesin); menü yeniden çizilir.
4. Ardından sırayla:
   - `calismaGerekli` ve hiç görünür grup yok → sarı kutu (ℹ): sistem yöneticisine "Henüz grup tanımlanmamış. **Tanımlar → Gruplar** sekmesinden bir grup ekleyin.", diğerlerine "Size atanmış bir grup yok. Sistem yöneticinizden grup erişimi isteyin."
   - `calismaGerekli`, "Tümü" seçili ve ekran `tumuDestek` değil → mavi kutu: "Bu ekran tek bir grup üzerinde çalışır. Üst çubuktan bir grup seçin. "Tümü" yalnızca Özet ve Maliyet Tablosu'nda kullanılabilir." (⚠ Maaş Dağılımı da "Tümü"yü destekler; metin bunu söylemez.)
   - `calismaGerekli` ve seçili yıl (+ grup) için çalışma yok → **eksik çalışma uyarısı** (§2.6).
   - Aksi hâlde `m.ciz(kap, parametre)`; ardından tek grup seçiliyse bantlar eklenir (§2.4, §2.5).
   - Çizimde hata olursa kırmızı kutu: "**Bu bölüm görüntülenemedi.**" + hata metni.
5. Sayfa en üste kayar.

---

## 2. Ortak arayüz davranışları

### 2.1 Kayıt göstergesi (`#kayitDurum`)

- Üst çubukta sağda: yeşil nokta + "Kayıtlı". `ADB.dinle('kaydedildi', …)` her başarılı dosya yazımında "Kayıtlı"ya döndürür (`app.js:kayitDurumGuncelle`).
- "Kaydediliyor…" durumu (`bekliyor` sınıfı, turuncu nokta) için `APP.kayitBekliyor()` tanımlıdır ama **hiçbir yerden çağrılmaz** — gösterge pratikte hep "Kayıtlı" görünür (⚠; Kılavuz'un "Başlarken" bölümü bu durumdan söz eder).
- Veri yazımı: her veri değişikliğinden **400 ms** sonra bütün veritabanı dosyaya yazılır (art arda gelen değişiklikler tek yazmada birleşir; yazmalar sıraya alınır — `engine.js:kaydetGecikmeli / kaydetHemen`). Görüntüleme kipinde dosyaya hiç yazılmaz. Sayfa arka plana geçerken bekleyen yazma hemen yapılır.
- Kaydet düğmesi yoktur: hücre girişleri anında kaydedilir; pencerelerde "Kaydet" düğmesi vardır.

### 2.2 Görüntüleme kipi şeridi (`#kilitSerit`, `app.js:kilitSeridiCiz`)

Aynı anda yalnız bir kişi / sekme kayıt yapabilir (`js/core/kilit.js`; kilit `veri\kilit.json`, yazan sekme 30 sn'de bir tazeler, okuyan 15 sn'de bir yoklar; 120 sn tazelenmeyen kilit düşmüş sayılır). Kilit yalnız program sunucuyla açıldığında kullanılır. Yazma yetkisi bu sekmede değilse sarı şerit:
- Aynı hesap başka sekmede: "👁 **Yalnızca görüntüleme.** Program **başka bir sekmede** açık (SS:DD itibarıyla) ve kayıt yetkisi orada. Diğer sekmeyi kapatıp bu sayfayı yenileyin; yetki buraya geçer."
- Başka kullanıcı: "👁 **Yalnızca görüntüleme.** <Ad Soyad> (SS:DD itibarıyla) kayıt yapıyor. Her şeyi görebilir, Excel alabilirsiniz; kayıt yapamazsınız. O kişi programı kapattığında devralırsınız."
- Düğme **↻ Şimdi kontrol et**: hâlâ alınamıyorsa uyarı bildirimi "Program hâlâ başka bir sekmede açık." / "Hâlâ başka bir kullanıcı kayıt yapıyor."
- Yetki geçince: "Yazma yetkisi size geçti — artık kayıt yapabilirsiniz." (başarı) ve ekran tazelenir.
- ⚠ Ekranlar görüntüleme kipinde girdileri **kapatmaz** (`calismaYazilabilir` kilidi bilmez). Yazma denemesi `API.yetkiIste` içinde reddedilir ve hata bildirimi `KILIT.engelMesaji()` metniyle çıkar: "Program BAŞKA BİR SEKMEDE açık ve kayıt yetkisi orada. Bu sekmede yalnızca görüntüleme yapabilirsiniz. Diğer sekmeyi kapatıp bu sayfayı yenileyin (en geç 2 dakika içinde kendiliğinden geçer)." ya da "Şu anda yalnızca görüntüleme yapabilirsiniz — <ad> kayıt yapıyor. O kişi programı kapattığında devralırsınız."
- Excel çıktıları (`excel.aktar`) yazma yetkisi sayılmaz; görüntüleme kipinde de alınır.

### 2.3 Bildirimler (`util.js:bildir`)

- Sağ altta küçük kutu (`.toast`, en çok 420 px), **3 sn** görünür, kayarak kaybolur. Tür: yok (koyu, `--ink`), `hata` (koyu kırmızı `--danger-dark`), `basari` (yeşil `--green`), `uyari` (turuncu `--warn`).
- Hata yakalanan her işlemde `U.bildir(e.message, 'hata')` kullanılır; API'nin hata metinleri doğrudan kullanıcıya gider. Ortak yazma denetimi metinleri (`api.js:calismaYazIste / yetkiIste`): "Çalışma bulunamadı." · "Bu grupta değişiklik yetkiniz yok." · "Bu çalışma onaylı ve kilitli. Değişiklik için Bütçe Çalışmaları → ✎ ekranından "Taslak"a alın." · "Bu işlem için yetkiniz yok." · görüntüleme kipi metni (§2.2).

### 2.4 Onaylı çalışma 🔒 bandı (`app.js:git`)

Tek grup seçili, ekran `calismaGerekli` ve çalışma `ONAYLI` ise ekranın **en üstüne** mavi bilgi kutusu:
"🔒 **<yıl> · <grup adı> onaylı ve kilitli.** Onaylanmış maliyetler olduğu gibi gösterilir; değişiklik yapılamaz. Gerekirse Bütçe Çalışmaları → ✎ ekranından "Taslak"a alın."

### 2.5 Aynı yılda birden çok çalışma 🗂 bandı (`app.js:git`)

Seçili yıl + grupta > 1 çalışma varsa (🔒 bandının altında; küçük yazı): "🗂 <yıl> · <grup adı> için **N çalışma** var; şu an seçili: **<ad>** (K kişi[, onaylı]). Diğerleri: <ad (k kişi)>, … — üst çubuktaki çalışma seçicisinden değiştirilir.[ **Seçili çalışmada kişi yok.**]" Seçili çalışmada kişi varsa mavi (`uyari-bilgi`), yoksa sarı (`uyari-dikkat`) — boş bir revize seçiliyken "kişiler kayboldu" sanılmasın diye.

### 2.6 Eksik çalışma uyarısı ve "yılına geç" (`app.js:git`)

Seçili yıl (+ grup) için çalışma yoksa sarı kutu (ℹ):
"**<yıl> · <grup adı | Tüm gruplar>** için henüz bir bütçe çalışması yok (üst çubukta seçili yıl: **<yıl>**).[ Bu grubun **<diğer yıl>** çalışması var.]"
- **<diğer yıl> yılına geç** (ikincil): grubun (Tümü'de herhangi bir grubun) çalışması olan, seçili yıldan farklı **en büyük** yıla geçer (`APP.secimYap(diger, null)`). Program son seçilen yılı hatırladığı için ekran boş görünmesin diye sunulur.
- **<yıl> çalışması aç…**: Tümü değilse, grupta yazma erişimi ve `personel.yaz` varsa görünür → `git('calisma', { yeni: true })` (Bütçe Çalışmaları ekranı açılır ve Yeni Çalışma penceresi kendiliğinden gelir, §3.8).

### 2.7 Para / oran / tarih biçimleri (`js/core/bicim.js` = `window.B`, `util.js`, `api.js`)

| İşlev | Davranış |
|---|---|
| `B.tl(n, ondalik=0)` | `tr-TR` binlik nokta, ondalık virgül. Ondalık 0 iken `|n| < 0,005` ise soluk **"—"** gösterir (sıfır yerine tire). |
| `B.tlDuz(n, ondalik=0)` | Aynı biçim, sıfırı da yazar (girdi kutularının değeri, özet kutuları). |
| `B.oran(x, ondalik=2)` | `0,2934 → %29,34` (yüzde işareti **başta**). `null` / sonsuz → soluk "—". |
| `B.isaretli(n)` | `|n| < 0,5` → soluk "0"; pozitif `+1.234` **kırmızı** (`.artis`), negatif `−1.234` **yeşil** (`.azalis`). Maliyet bakışı: artış kötü. |
| `B.tc(t)` | `alan.tc` yoksa `U.tcMaskele` ile maskeli T.C. |
| `U.tcMaskele(tc)` | 11 haneliyse `ilk 3 + "*****" + son 3` (örn. `123*****901` biçimi); değilse olduğu gibi. |
| `U.tarihGoster` | `YYYY-AA-GG → GG.AA.YYYY`. Program içinde tarihler `YYYY-AA-GG` metni olarak tutulur. |
| `U.sayi(n)` | `tr-TR` tam sayı (menü rozeti, sayaçlar). |
| `API.trSayi(s)` | Türkçe sayı çözümü: `"40.000" → 40000`, `"1.234,5" → 1234,5`, `"0,25"` / `"0.25" → 0,25`. Rakam, nokta, virgül ve eksi dışındaki karakterler atılır; virgül varsa noktalar binliktir; virgül yoksa yalnız `1–3 hane + (.3 hane)+` deseni binlik sayılır (`0` ile başlayan noktalı değer ondalıktır). Boş ya da çözülemeyen → 0. |

Tablo tutarları ekranlarda kuruşsuz (`B.tl`), bordro dökümünde ve bazı girdi kutularında 2 ondalık gösterilir. Fazla Mesai Planı ve Performans ekranları kendi sayı çözücülerini kullanır (§3.6.1, §3.7).

### 2.8 T.C. maskeleme kuralları

- `alan.tc` yetkisine **uyan** yerler (yetki yoksa `U.tcMaskele`): kişi kartı alt başlığı ("T.C. …", §3.3.1), performans kişi penceresi alt başlığı (§3.6.1), Personel İçe Aktarma önizlemesindeki "Bu çalışmada olmayanlar" tablosu (§3.10), Excel Raporu'nun ZAM ÇALIŞMASI sayfası (T.C. KİMLİK NO sütunu, §4.1.1), Performans şablonu (A sütunu, §4.3.1).
- Her zaman maskeli: performans içe almasında "bu çalışmada yok" listesi (§4.3.2).
- Maskeli T.C. taşıyan dosya geri alınamaz: Excel Raporu ve Performans içe almaları maskeli satırları atlar; dosyadaki bütün satırlar maskeliyse "Bu dosyadaki T.C. numaraları maskeli (dosya, T.C. Kimlik No'yu tam görme yetkisi olmayan bir kullanıcı tarafından alınmış). Kişiler T.C. ile eşleştirildiği için içeri alınamaz; dosyayı bu yetkiye sahip bir kullanıcıya aldırın." hatası verir.
- ⚠ Maskelemeye uymayan yerler: Personel ve Zam araması tam T.C. alt dizesiyle de arar (`alan.tc`'ye bakmaz); Excel Raporu önizlemesinde adı dosyada olmayan "bulunamayan" kişi T.C. ile yazılır (§3.9); Personel İçe Aktarma'daki "<T.C.>: yeni personelin adı dosyada yok." hatası T.C.'yi tam yazar (§4.2).
- Ayrıntılı kural: "03 — İş Kuralları, İş Akışları ve Yetkiler", §7.6.

### 2.9 Canlı arama (`bilesen.js:C.canliArama`)

- Yazdıkça **200 ms** bekleyip süzer; kutu boşaltılınca beklemeden tam liste gelir. Enter = hemen uygula. **Esc** (kutu doluysa) = kutuyu temizle ve uygula.
- Ekran yeniden çizilir (`APP.tazele`); çizimden sonra kutu yeniden odaklanır, imleç aynı yerde kalır, sayfa kaydırması korunur.
- Arama, Türkçe karakter ve büyük / küçük harf farkını yok sayar (`U.normalize`: Türkçe küçük harfe çevirme, ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u, boşluk sadeleştirme).
- Kullanan ekranlar: Personel ve Zam (`#ara`, §3.3), Performans (`#pfAra`, §3.6), Kullanım Kılavuzu (`#klAra`, §3.15).

### 2.10 Pencere (kip) davranışı (`bilesen.js:C.kipAc`)

- Başlık (h2), isteğe bağlı alt başlık (küçük, soluk), sağ üstte **×**; gövde (kendi içinde kayar, en çok ekran yüksekliği − 210 px); altlık (düğmeler sağa dayalı). Genişlik: varsayılan en çok 760 px, `genis` en çok 1080 px, `dar` en çok 460 px; köşe yarıçapı 14 px. Arka perde yarı saydam koyu. Pencere 200 ms'lik hafif kayma + belirme animasyonuyla açılır (`kip-gir`; "hareketi azalt" tercihinde kapanır).
- Kapatma: arka perdeye tıklama, `[data-kip-kapat]` taşıyan öğe (×, "Vazgeç", "Kapat"), **Esc** (en üstteki pencereyi kapatır).
- Açılınca ilk etkin `input` / `select` / `textarea` odaklanır.
- Pencereler yığın hâlinde üst üste açılabilir; ekran değişince hepsi kapanır (`C.kipHepsiniKapat`).
- **Onay penceresi** `C.onay({ baslik='Onay', mesaj, detay, evetYazi='Onayla', hayirYazi='Vazgeç', tehlike })`: dar pencere; `detay` sarı uyarı kutusunda (⚠); `tehlike` → kırmızı evet düğmesi. Arka perdeye tıklama = hayır.
- **Metin sorma** `C.metinSor({ baslik='Değer girin', etiket, deger, ipucu })`: dar pencere, bir metin kutusu; Enter ya da **Tamam** metni döndürür; **Vazgeç** → `null`.
- Form yardımcıları: `C.formOku` (bütün `[name]` alanları; onay kutusunda `checked`), `C.alanHatasi` (alan kırmızı çerçeve + altında hata metni; yazınca kalkar).

### 2.11 Tablolar (`bilesen.js:C.tablo`, `css/app.css`, `css/butce.css`)

- Bütün tablolar `.tablo-sar` kabındadır: kap ekran yüksekliğiyle sınırlı (`max-height: calc(100vh − 150px)`, pencerede `− 260px`) ve **kendi içinde kayar**; başlık satırı üstte (zemin `--surface-2` `#f8fafc`, yazı `--ink-soft`, altında ince çizgi), **toplam satırı (`tr.toplam-satir`) altta yapışkan** kalır (zemin `#eef2ff`, üstünde `#c7d2fe` çizgi, kalın).
- Yatay taşan her tablonun **üstüne ikinci bir yatay kaydırma çubuğu** eklenir ve iki çubuk eşlenir (`C.ustKaydirmaBagla`; DOM izleyiciyle her yeni tabloya kendiliğinden, pencerelerdekiler dâhil).
- `.genis-tablo`: 12 px yazı, sıkı hücreler, ilk sütun yatay kaydırmada **sabit** (yapışkan sol). `.param-tablo`: tam genişlik, satır kırar, yapışkan sütun yok.
- Başlık hücreleri büyük harf (CSS `text-transform: uppercase`, 11 px); `.genis-tablo` ve `.ozet-tablo` başlıkları satır kırar.
- Zebra sütun: çift sütunlara hafif gölge (hücrenin kendi renginin üstüne katman olarak; renk grupları ve sarı hücreler bozulmaz). Satırın üstüne gelince hafif vurgu.
- Boş tablo (`C.tablo`): "Kayıt bulunamadı." (ya da ekrana özel `bosMesaj`). Ekranların bir kısmı tabloyu kendi HTML'iyle kurar; görünüm kuralları aynıdır.
- Sayı sütunları (`num`) sağa hizalı.

### 2.12 Hücre girdileri ortak kuralları

- `.hucre-girdi`: sağa hizalı küçük kutu (varsayılan 92 px, 12 px yazı). **Sarı zemin (`degisti`) = o hücreye elle / o aya özel değer girilmiş.** `devralan` = soluk yazı (önceki aydan devralınan değer). `uyari-hucre` = sarı uyarı hücresi (Performans'ta uygulanmamış çarpan, Mesai'de kadrodan farklı kişi sayısı).
- Form alanı hatası: `input.hatali` / `select.hatali` kırmızı çerçeve.
- Kaydetme tetikleyicisi ekrana göre: Enter ve / veya odak kaybı (`blur`) ve / veya `change`. Değer değişmediyse kayıt yapılmaz.
- Sayılar `API.trSayi` ile çözülür; boş değer alana göre `0` ya da `null` (boş = otomatik) olur (`api.js:CP_SAYISAL / CP_BOS_OLABILIR`).

### 2.13 Renk grupları (Personel ve Zam tablosu, `css/butce.css`)

| Grup kodu `g` | Anlam | Başlık zemini | Hücre zemini |
|---|---|---|---|
| `eski` | Önceki yıl maaşı | `#3f6212` (koyu yeşil) | `#f7fee7` |
| `ong` | Öngörü | `#475569` (koyu gri) | `#f8fafc` |
| `duz` | Düzeltme / elle girilen | `#b45309` (koyu turuncu) | `#fffbeb` |
| `zam` | Kararlaştırılan zam | `#b91c1c` (koyu kırmızı) | `#fef2f2` |
| `yeni` | Yeni yıl maaşı / oranlar | `#0369a1` (koyu mavi) | `#f0f9ff` |
| `mal` | Maliyet | `#1e40af` (lacivert, ana renk) | `#eef2ff` |

Başlıklar beyaz yazı; başlık zeminleri beyaz yazıyla okunabilir (erişilebilir karşıtlıkta) koyu tonlardır. Renk grubunun değiştiği sütunun soluna kalın ayırıcı çizgi (`grup-sinir`, `#cbd5e1`, 3 px). Grubu olmayan sütunlar renksiz.

### 2.14 Rozet renkleri (`css/app.css`, `css/butce.css`)

| Sınıf | Görünüm | Kullanıldığı yerler (örnek) |
|---|---|---|
| `rz-yesil` | açık yeşil zemin (`#f0fdf4`), yeşil yazı, ince yeşil çerçeve | Onaylı, Resmî, Etkin, şifreli, "Zam hesabı güncel", mesai öngörüsü açık |
| `rz-sari` | açık sarı zemin (`#fffbeb`), turuncu yazı, sarı çerçeve | Taslak, "en küçük / en büyük", "sonradan çıkış", Kılavuz hedef kitlesi, "bu yıl başka bir grupta kayıtlı", aktarım başlığı "değiştirildi" |
| `rz-kirmizi` | açık kırmızı zemin, koyu kırmızı yazı | parametre "girilmemiş", ŞİFRESİZ, yıl içi çıkış (Maaş Dağılımı), grup erişimi "hiçbiri" |
| `rz-mavi` | açık mavi zemin (`--accent-soft`), ana renk yazı | seçili, yeni giriş, bu çalışma, Mavi yaka, tanınan sütun |
| `rz-gri` | gri | devre dışı, Beyaz yaka, çıkış tarihi, "🔒 onay anındaki", "henüz oluşmadı" |
| `rz-mor` | mor | Sistem Yöneticisi |
| `rz-ongoru` | `rz-sari` ile aynı görünüm (`butce.css`) | parametre öngörüsü, uygulanmamış çarpan, mesai öngörüsü kapalı, model penceresinde "100 değil" |

### 2.15 Simgeler (`js/core/ikon.js` = `window.IKON`)

Program emoji yerine SVG çizgi simgeleri kullanır (Lucide simge setinden; ISC lisansı, `js/vendor/LISANSLAR.md`). Simge rengi yazı rengini izler (`currentColor`), boyutu yazıya göre (`.ik-svg`, 1,15 em); süs amaçlıdır (`aria-hidden="true"`).

- `IKON.svg(ad)` simgenin SVG metnini, `IKON.menu(id)` menü simgesini verir (§1.3).
- **Dönüştürücü** (`IKON.donustur`, sayfa açılırken `IKON.bagla` ile bağlanır; `MutationObserver` sonradan çizilen ekranları, pencereleri ve metin değişikliklerini de çevirir). Ekran kodu simgeyi karakter olarak yazar, dönüştürücü SVG'ye çevirir:
  - **Her yerde:** 🗑 → `sil`, ✎ → `duzenle`.
  - **Yalnız düğme, başlık (h1–h4), `.logo`, `summary`, uyarı simgesi (`.ik`) ve Kılavuz'un "Ekranı aç" bağlantısı (`.kl-git`) içinde:** 🔒 `kilit` · 🔓 `kilitAcik` · 🔐 `kalkan` · ℹ `bilgi` · ⚠ `uyari` · ✓ `tamam` · 💡 `ipucu` · 📖 `kitap` · ⏱ `saat` · 🗂 `klasor` · 🔑 `anahtar` · 👁 `goz` · ⇩ ⤓ `indir` · ↻ `yenile` · ↑ `yukari` · ↓ `asagi` · ← `geri` · Σ `toplam` · 🛠 `disli` · 📤 `tablo` · 📋 `liste` · ⚙ `ayar`.
  - Düz metindeki işaretler (ör. "→", metin içindeki "✓") olduğu gibi kalır; giriş kutuları, seçim kutuları, `textarea` ve `[data-ikonsuz]` içindekilere dokunulmaz. Değişiklik ekranın görünümündedir; bu belgede ekran metinleri koddaki karakterlerle yazılmıştır.
  - Yalnız simgeden oluşan düğmeye (ör. 🗑, ✎, ↑ ↓) `title` varsa ekran okuyucu etiketi olarak `aria-label` verilir.
- Kayıtlardaki `ikon` alanı (emoji) menüde kullanılmaz; bu belgedeki "Yer" satırlarında ekranı tanıtmak için yazılır.

### 2.16 Renk değişkenleri ve görünüm (`css/app.css` `:root`)

| Değişken | Değer | Kullanım |
|---|---|---|
| `--accent` / `--accent-dark` / `--accent-soft` / `--accent-2` | `#1e40af` / `#1e3a8a` / `#eff6ff` / `#3b82f6` | ana renk (seçili grup düğmesi, birincil düğme, bağlantı), koyu tonu, açık zemin, odak halkası |
| `--gold` | `#d97706` | vurgu (ör. özet kutusu kenarı, uyarı şeridi kenarı) |
| `--bg` / `--surface` / `--surface-2` | `#f1f5f9` / `#ffffff` / `#f8fafc` | sayfa zemini, kart zemini, tablo başlığı ve pencere başlığı zemini |
| `--ink` / `--ink-soft` / `--ink-fade` | `#0f172a` / `#475569` / `#64748b` | metin, ikincil metin, soluk metin |
| `--line` / `--line-soft` / `--line-input` | `#e2e8f0` / `#f1f5f9` / `#cbd5e1` | çizgiler, ince ayırıcılar, giriş kutusu çerçevesi |
| `--green` / `--danger` / `--danger-dark` / `--warn` (+ `-soft` tonları) | `#15803d` / `#dc2626` / `#b91c1c` / `#b45309` | başarı, hata, uyarı |
| `--mavi` / `--mor` | `#2563eb` / `#7c3aed` | özet kutusu kenarları |
| `--odak` | `0 0 0 3px rgba(59,130,246,.35)` | düğme ve giriş kutularının odak gölgesi |
| `--hiz` / `--egri` | `150ms` / `cubic-bezier(.2,.8,.2,1)` | geçiş süresi ve eğrisi |
| `--yazi` / `--yazi-mono` | Segoe UI Variable / sistem yazıları; Cascadia Mono / Consolas | yazı aileleri |

- Klavye odağı: `:focus-visible` 2 px `--accent-2` çerçeve; düğme ve giriş kutularında `--odak` gölgesi.
- Ölçüler: düğme ve giriş kutusu en az 36 px yükseklik, küçük düğme 30 px, ikon düğmesi en az 30 × 30 px; seçim kutusu ve radyolar 16 px, etiketle aynı satırda.
- Geçişler 150 ms; `prefers-reduced-motion: reduce` seçiliyse bütün animasyon ve geçişler kapanır.
- Yazdırırken kenar çubuğu, üst çubuk, düğmeler, ikon düğmeleri ve "İçeriğe geç" bağlantısı gizlenir.

---

## 3. Ekranlar

Her ekran başlığında: **Kaynak** (`dosya.js:işlev`), **Yer** (menü başlığı → ekran adı; ad önündeki emoji modül kaydındaki `ikon` alanıdır, menüde SVG simgesi gösterilir — §1.3, §2.15; sayfa başlığı / alt başlık), **Yetki**, **Tümü** (üst çubukta "Tümü" seçiliyken davranış), **Amaç**; ardından kartlar, süzgeçler, sekmeler ve sütunlar, düğmeler, pencereler, klavye / odak. Sütun tablolarındaki "Düzenlenebilir" bilgisi, hücrenin ekranda hangi koşulla girdi kutusu olduğunu verir. Ekranlar bölüm numarası sırasıyla anlatılır; menüdeki sıra §1.3'tedir.

---

### 3.1 Özet

**Kaynak:** `js/modules/ozet.js` (`ciz`, `toplamSatiri`); `api.js:birlesikHesapla, calismaOzetOku, calismaOzetYaz`.
**Yer:** Genel → 📊 Özet. Sayfa başlığı "Özet", alt başlık "Toplam maliyet, bütçe ve zam". Girişten sonra açılan ilk ekran (`app.js:uygulamayiAc` → `git('ozet')`).
**Yetki:** `ozet.oku`. Önceki yıl / bütçe girdileri: tek grup + yazılabilir çalışma + `personel.yaz`.
**Tümü:** **evet** — yılın, kullanıcının görebildiği her grubundan **bir** çalışma birleştirilir (`app.js:calismalar`: `API.calismaListe` sırasıyla grubun ilk çalışması — yıl azalan, grup sırası, çalışma adı; üst çubuktaki çalışma seçicisi Tümü'de kullanılmaz) ve `API.birlesikHesapla` ile tek hesap gibi toplanır.

**Amaç:** Grubun (ya da tüm grupların) yıllık toplam maliyeti, bütçelenen maliyetle farkı ve zam toplamları; yaka, grup, ay ve bütçe bölümü kırılımları. Önceki yıl maliyeti ve bütçelenen maliyet bu ekrana elle yazılır.

**Kart 1 — "<yıl> · <grup adı> — Toplam Maliyetler"** (Tümü'de grup adı yerine "Tüm Gruplar")
- Açıklama satırı: `<çalışma adı> · N kişi`. Tümü'de çalışma adı yerine birleştirilen grupların adları ` + ` ile (örn. "Ofis + Üretim · N kişi").
- **4 kutu** (`.stat`, `izgara-4`):

| Kutu (etiket) | Değer | Ek satır |
|---|---|---|
| "<Y> toplam maliyet" | Σ `s.yil.maliyet` (`B.tlDuz`) | — |
| "Bütçelenen" | `butce_B + butce_M` (toplam 0 ise "—") | "Fark: ±(toplam maliyet − bütçe)" (`B.isaretli`) — yalnız bütçe varsa |
| "Toplam zam miktarı (net)" | Σ `s.zam.miktar` | "Oran %…" = Σ zam / Σ `s.zam.eski` |
| "Ocak aylık maliyet" | Σ `s.yil.aylar[1].DM` | — |

- **Yaka tablosu** (`.ozet-tablo`). Satırlar: Beyaz Yaka (`B`), Mavi Yaka (`M`), **Toplam** (`toplam-satir`).

| Sütun | Kaynak / hesap | Düzenlenebilir | Toplam satırı |
|---|---|---|---|
| (boş başlık) | "Beyaz Yaka" / "Mavi Yaka" (kalın) | — | "Toplam" |
| Kişi | yakadaki kişi sayısı | — | toplam kişi |
| `<O>` Toplam Maliyet | `calisma_ozet['onceki_B' / 'onceki_M']` | **evet** (`input.ozet-girdi.num[data-ozet]`, 150 px) | B + M (`B.tl`; 0 ise soluk "—") |
| `<Y>` Bütçelenen Maliyet | `calisma_ozet['butce_B' / 'butce_M']` | **evet** (aynı koşul) | B + M |
| `<Y>` Toplam Maliyet | Σ `s.yil.maliyet` (kalın) | — | toplam |
| Bütçe Farkı | maliyet − bütçe (`B.isaretli`; bütçe yoksa boş) | — | aynı kural |
| Zam Miktarı | Σ `s.zam.miktar` | — | toplam |
| Zam Oranı | Σ zam / Σ `s.zam.eski` | — | aynı formül |
| Ortalama Zam | zam / kişi (kişi yoksa boş) | — | aynı formül |

- Tablonun altında soluk metin: "Ortalama zam oranı (kişi ortalaması): %…. `<O>` maliyeti ve bütçelenen maliyet bütçe bölümünden gelir; hücreye yazıp Enter'a basın." (kişi ortalaması = Σ `s.zam.oran` / kişi).
- **Girdi davranışı:** kutu değeri `B.tlDuz(v, 2)` (boşsa boş). **Enter** ve **change** olaylarının ikisi de kaydeder: `API.calismaOzetYaz(c.id, anahtar, boş ? null : API.trSayi(v))` → `APP.tazele()`. API `personel.yaz` + yazılabilir çalışma ister; hata metni bildirimle gösterilir (§2.3).
- Girdi koşulu sağlanmazsa (Tümü, onaylı çalışma, grup yazma yetkisi ya da `personel.yaz` yok) hücre salt metindir: değer `B.tl`, boşsa soluk "—". Tümü'de değerler grupların `calisma_ozet` değerlerinin toplamıdır (`birlesikHesapla`, boş olmayanlar toplanır).

**Kart 2 — "Gruplara Göre"** (yalnız **Tümü**'de). Satır sırası: çalışma listesi sırası (grup sırası). Anahtar grup adıdır.

| Sütun | Hesap |
|---|---|
| Grup | grup adı (kalın) |
| Kişi | sayı |
| `<O>` Maaş (net) | Σ `s.zam.eski` |
| Zam Miktarı | Σ `s.zam.miktar` |
| Zam Oranı | zam / eski |
| `<Y>` Maaş (net) | eski + zam |
| `<O>` Maliyet | Σ `kp.maliyet_onceki` (kişi satırlarındaki önceki yıl maliyeti) |
| `<Y>` Maliyet | Σ `s.yil.maliyet` (kalın) |
| Fark | maliyet − önceki (`B.isaretli`) |

Toplam satırı (`toplamSatiri(liste, false)`): aynı sütunlar; oran = toplam zam / toplam eski (kişi ortalaması değil).

**Kart 3 — "Aylık Maliyet"** — açıklama "İşveren maliyeti; teşvikler düşülmüş." Tek satır: Ocak … Aralık (her ay Σ `DM`, `B.tl`) + **Toplam** (kalın, yıllık toplam maliyet). Ay başlıkları tam ad (`U.AYLAR`).

**Kart 4 — "Bütçe Bölümlerine Göre"**

| Sütun | Hesap |
|---|---|
| Bütçe Bölümü | `API.bolumEtiket(grup, bölüm)` (sıra numaralı etiket, örn. "02 MUHASEBE"); Tümü'de "<grup adı> · <etiket>"; bölümsüz "—" |
| Kişi | sayı |
| `<O>` Maaş (net) | Σ `s.zam.eski` |
| Zam Miktarı | Σ `s.zam.miktar` |
| Zam Oranı | zam / eski |
| `<Y>` Maaş (net) | eski + zam |
| Ocak Maliyeti | Σ `aylar[1].DM` |
| `<O>` Maliyet | Σ `kp.maliyet_onceki` |
| `<Y>` Maliyet | Σ `s.yil.maliyet` (kalın) |
| Fark | maliyet − önceki (`B.isaretli`) |

Anahtar `grup_kod|bölüm` (Tümü'de farklı grupların aynı adlı bölümleri karışmaz). Sıralama: önce grup **kodu** (alfabetik), sonra bölüm sırası (`API.bolumSira`; bölümsüz 999 → en sonda). Toplam satırı (`toplamSatiri(liste, true)`) "Ocak Maliyeti" sütununu da toplar.

⚠ Kart 1'deki "`<O>` Toplam Maliyet" elle girilen çalışma toplamıdır (`calisma_ozet`); Kart 2 ve Kart 4'teki "`<O>` Maliyet" ise kişi satırlarındaki `maliyet_onceki` toplamıdır. İkisi ayrı kaynaktır ve farklı olabilir.

**Klavye/odak:** yalnız Kart 1 girdileri; Enter kaydeder, kayıttan sonra ekran baştan çizilir (odak ve kaydırma korunmaz).

---

### 3.2 Maaş Dağılımı

**Kaynak:** `js/modules/dagilim.js` (`ciz`, `grupBolumu`, `durumOf`, `listedeMi`, `secimOku`, `secimYaz`, `aralikEtiketleri`, `kova`, `ortanca`, `aralikDuzenle`); `api.js:aralikOner, aralikCoz, maasAraliklari, maasAralikYaz, calismaAyarYaz, calismaZamKademe`.
**Yer:** Genel → 📶 Maaş Dağılımı. Başlık "Maaş Dağılımı", alt başlık "Maaş aralıklarına göre kişi sayısı ve sıralı maaş listesi".
**Yetki:** `ozet.oku`. Ad Soyad'ı görmek `personel.oku` (yoksa "—"). **Aralıkları Düzenle** düğmesi `parametre.yaz` (API ayrıca grup yazma yetkisi ister). **Çıkar / Ekle** düğmeleri: yazılabilir çalışma + `personel.yaz`.
**Tümü:** **evet** — Tümü'de birleştirilen her çalışma için ayrı grup kartı çizilir (§3.1'deki çalışma seçimiyle).

**Amaç:** Maaş aralıklarına göre kişi sayısı tablosu ve maaşların küçükten büyüğe sıralı listesi; zam kademesinin alt / üst eşiklerini belirlerken yol gösterir. Tutarlar net maaştır. Liste her açılışta çalışmanın güncel personelinden hesaplanır (kayıtlı bir liste değildir).

**Süzgeç kartı** (`.suzgec-satir`):
- "Esas maaş" (`#dgEsas`): "Önceki yıl maaşı (zam öncesi)" (`eski` → `s.zam.eski`, varsayılan) · "Yeni yıl maaşı (zamlı)" (`yeni` → `s.zam.yeni`).
- Yaka (`#dgYaka`): "Tüm yakalar" / "Beyaz yaka" / "Mavi yaka".
- Bilgi metni: "Aralıklar her grubun kendi maaşlarına göre seçilir; grup bazında sabitlenebilir."
- Değişince ekran tazelenir. Süzgeç durumu modül belleğinde tutulur: ekran değişse de oturum boyunca kalır, sayfa yenilenince varsayılana döner.

**Kimler listeye girer** (`listedeMi`): maaşı (eski ya da yeni) > 0 olan kişiler. Varsayılan olarak **çalışma yılı içinde işe girenler** (zam öngörülmeyenler) listeye alınmaz. Elle seçim çalışma ayarında saklanır: `calisma_ayar['dagilim.haric']` / `['dagilim.dahil']` (virgülle ayrılmış T.C. listesi). Bu yalnız bu tablonun seçimidir: kişi bütçeden silinmez; seçim yeni yıla taşınmaz. Yıl içinde ayrılanlar ayrıca süzülmez.

Kişi durumu (`durumOf`): onaylı ya da kendi dönem tarihi olan satırda (`onay_sabit > 0`) `onay_giris / onay_cikis`, değilse kart tarihleri. Çıkış yılı = çalışma yılı → "çıkış GG.AA.YYYY"; değilse giriş yılı = çalışma yılı → "yeni giriş". ⚠ Aynı yıl içinde hem girip hem çıkan kişide "çıkış" önceliklidir; bu kişi varsayılan olarak listededir.

**Grup kartı — "<yıl> · <grup adı> — Maaş Dağılımı"**
- Açıklama: "N kişi · esas: **<O maaşı | Y maaşı>** (net) · aralıklar **sabit | otomatik**[ (bu grubun maaşlarına göre)][ · listeye alınmayan **K** kişi (aşağıda)]". N = yaka süzgecinden geçen listedeki kişi.
- Sağda **Aralıkları Düzenle** (`btn-ikincil btn-kucuk`; `parametre.yaz`).
- **Aralık sınırları:** grubun sabit sınırları (`grup.maas_araliklari`, `API.maasAraliklari`) yoksa `API.aralikOner(listedeki maaşlar)` (yaka süzgecinden **önceki** liste): maaşların %10 ve %90 yüzdelikleri arası yaklaşık 8 aralığa bölünür; adım {1.000, 2.000, 5.000, 10.000, 20.000, 50.000, 100.000} içinden hedef genişliğe eşit ya da büyük ilk değer; en çok 14 sınır. Tek kişide tek sınır (10.000'e yukarı yuvarlanmış maaş); hiç kişi yoksa sınır yoktur ve tablo tek satır "0 altı" gösterir. Sınırlar **alt sınırdır**; etiketler (`aralikEtiketleri`): "X altı", "X – Y", …, "Z ve üzeri" (tutarlar `Math.round` + `B.tlDuz`). Bir maaş, sınıra eşitse üstteki aralığa girer (`kova`: `x >= sınır`).

**Tablo 1 — aralık tablosu** (`.genis-tablo`)

| Sütun | Hesap |
|---|---|
| Maaş aralığı | etiket (kalın) |
| Kişi | aralıktaki kişi (yaka süzgeciyle; kalın) |
| Pay | yatay çubuk `.dagilim-cubuk` (genişlik = kişi / en kalabalık aralığın kişisi) + soluk "%…" (kişi / listedeki toplam kişi) |
| Beyaz | beyaz yaka sayısı (0 ise boş) |
| Mavi | mavi yaka sayısı (0 ise boş) |
| Toplam maaş (aylık) | Σ esas maaş (kişi yoksa boş) |
| Ortalama maaş | Σ / kişi |
| Ort. zam oranı | Σ `s.zam.miktar` / Σ `s.zam.eski` |
| `<Y>` yıllık maliyet | Σ `s.yil.maliyet` |

Kişisi olmayan aralık satırı soluk. **Toplam** satırı: kişi, (Pay boş), beyaz, mavi, toplam maaş, ortalama, oran, maliyet.

**Ara başlık "Küçükten büyüğe — en küçük ve en büyük maaş"** + açıklama: "Zam kademesinin alt ve üst eşiği **önceki yıl maaşına** uygulanır; eşik belirlerken esası "<O> maaşı" bırakın. Mevcut eşikler Bütçe Çalışmaları → ✎ ekranında değiştirilir."

**Tablo 2 — eşik özeti.** Satırlar: Tümü / Beyaz yaka / Mavi yaka (kişisi olmayan satır çıkmaz). Yaka süzgecinden **bağımsızdır** (listedeki herkes).

| Sütun | Hesap |
|---|---|
| (ad) | kalın |
| Kişi | sayı |
| En küçük / En büyük | esas maaşın en küçüğü / en büyüğü (kalın) |
| Ortanca | medyan (`ortanca`) |
| Ortalama | ortalama |
| Mevcut kademe (alt / üst eşik) | yalnız yaka satırlarında `API.calismaZamKademe(c, P)[yaka].altEsik / ustEsik` (küçük, soluk "X / Y") |

**Açılır bölüm "Sıralı liste (N kişi)"** (`details`, varsayılan açık; tablo kabı en çok 520 px yükseklik). Başlığa, yazılabilirse "— zam almayacak kişiyi **Çıkar** ile listeden çıkarın" eklenir. Satırlar yaka süzgecinden geçen kişiler, esas maaşa göre artan.

| Sütun | Kaynak |
|---|---|
| Sıra | 1… |
| Ad Soyad | ad (`personel.oku` yoksa "—") + en küçük / en büyük maaştaki satırlarda sarı rozet "en küçük" / "en büyük" + durum rozeti: yıl içinde çıkış → kırmızı "çıkış GG.AA.YYYY"; yıl içinde giriş → mavi "yeni giriş" |
| Yaka | "Mavi" / "Beyaz" |
| Bütçe bölümü | etiket (küçük yazı) |
| `<O>` maaşı | `s.zam.eski` (esas buysa kalın) |
| `<Y>` maaşı | `s.zam.yeni` (esas buysa kalın) |
| Zam oranı | `s.zam.oran` |
| (başlıksız) | **Çıkar** (`btn-ikincil btn-kucuk`; yalnız yazılabilirse — sütun da yalnız o zaman var) |

En küçük ya da en büyük maaşa eşit bütün satırlar sarı zeminlidir (`tr.dagilim-uc`); aynı tutarda birden çok kişi varsa hepsi işaretlenir.

**Açılır bölüm "Listeye alınmayanlar (K kişi)"** (yalnız K > 0; K ≤ 15 ise açık) — başlık devamı: "— tablo ve en küçük / en büyük hesabına girmez; bütçede yerinde durur". Satırlar soluk, esas maaşa göre artan. Sütunlar: Ad Soyad · Yaka · Neden ("elle çıkarıldı" / "yıl içinde giriş — zam yok") · `<O>` maaşı · `<Y>` maaşı · **Ekle** (yazılabilirse).

**Çıkar / Ekle** (`secimYaz`): kişinin varsayılanı (yıl içinde giriş değilse "listede") hesaplanır; kişi her iki kümeden silinir, istenen durum varsayılandan farklıysa `dagilim.dahil` ya da `dagilim.haric` kümesine eklenir; `API.calismaAyarYaz(c.id, { 'dagilim.haric', 'dagilim.dahil' })` (yazılabilir çalışma + `personel.yaz`; boş küme anahtarı siler) → ekran tazelenir. Hata metni bildirimle.

**Pencere — "Maaş Aralıkları"** (`aralikDuzenle(grupKod, calismaId)`; alt başlık grup adı; varsayılan genişlik)
- Açıklama: "Aralıkların **alt sınırlarını** noktalı virgülle yazın. Örnek: `50.000; 75.000; 100.000` → "50.000 altı", "50.000 – 75.000", "75.000 – 100.000", "100.000 ve üzeri"."
- Alan "Sınırlar" (`#arSinir`): sabit sınırlar varsa onlar, yoksa öneri; `B.tlDuz` ile, `; ` ayraçlı.
- Soluk satır: "Şu anki maaşlara göre önerilen: `…`" (öneri, o çalışmanın maaşı > 0 olan **bütün** kişilerinden, listeye alınmayanlar dâhil, o anki esas maaşla hesaplanır).
- Bilgi kutusu (💡): "**Otomatik** seçilirse aralıklar her yıl maaşlarla birlikte kayar. Yıllar arası karşılaştırma yapacaksanız **sabitleyin**."
- Düğmeler: **Otomatiğe Dön** → `API.maasAralikYaz(grup, null)`, bildirim "Aralıklar otomatik." · **Vazgeç** · **Sabitle** → `API.maasAralikYaz(grup, metin)`: metin `;` ya da boşlukla bölünür, her parça `trSayi`, > 0 olanlar sıralanır ve tekilleştirilir (`aralikCoz`); başarıda bildirim "N+1 aralık sabitlendi." Başarıda pencere kapanır, ekran tazelenir.
- Hata metinleri: "En fazla 20 sınır girilebilir." · geçerli sınır yoksa "Geçerli bir sınır girilmedi." · API: "Bu işlem için yetkiniz yok." (`parametre.yaz`), "Bu grupta değişiklik yetkiniz yok.".
- ⚠ Geçerli sınır içermeyen metinle **Sabitle**'ye basılınca API önce grubun sınırlarını boşaltır (otomatiğe döndürür), ekran sonra "Geçerli bir sınır girilmedi." hatasını verir; pencere açık kalır ama sabit aralıklar silinmiş olur.
- Sabit aralıklar **grup düzeyindedir** (`grup.maas_araliklari`; bütün yıllar ve çalışmalar için ortak). Kayıt işlem kaydına `GUNCELLE / grup` olarak yazılır.

---

### 3.3 Personel ve Zam

**Kaynak:** `js/modules/personel.js` (`ciz`, `ozetKutulari`, `sutunlar`, `sinir`, `cikisHtml`, `formAc`, `gecmisHtml`, `sil`); `api.js:calismaHesapla, calismaPersonelListe, calismaPersonelAlanYaz`.
**Yer:** Bütçe → 👥 Personel ve Zam. Menü rozeti = seçili çalışmadaki kişi sayısı (0 ise ve Tümü'de rozet yok; §1.3). Başlık "Personel ve Zam", alt başlık "Bütçe satırları, zam öngörüsü ve düzeltme".
**Yetki:** görmek `personel.oku`. "Zam Çalışması" sekmesi ve üst özet kutuları `zam.oku`. Düzeltme hücresi: yazılabilir + `zam.yaz`. **+ Yeni Personel**, 🗑 ve kart kaydı: yazılabilir + `personel.yaz`.
**Tümü:** hayır (§1.6 bilgi kutusu).

**Amaç:** Bütçenin ana ekranı. Her satır bir kişinin bütçe satırıdır: önceki yıl net maaşı, zam öngörüsü (kademe / performans), yönetimin düzeltmesi, yeni yıl maaşı, yıllık maliyet.

**Kart başlığı:** "Personel ve Zam — <yıl> · <grup adı>"; altında sekmeye göre açıklama:
- zam: "Tutarlar NET. Zam öngörüsü: <maaş kademesi | sabit oran>[ × performans çarpanı] (Bütçe Çalışmaları ekranından değiştirilir). DÜZELTME yönetimin müdahalesidir; öngörülen zamma eklenir, eksi olabilir." (yöntem `calisma.zam_kademe` / `zam_performans` bayraklarından).
- kisi: "Hesaplamayı belirleyen bilgiler. Değiştirmek için kişinin adına tıklayın; yıl içi değişiklikler Aylık Girdiler'den."

**Süzgeçler** (başlığın sağında, `.btn-satir`):
- Arama `#ara` (type=search, en az 200 px, yer tutucu "Ad veya T.C. ile ara (Esc: temizle)") — canlı arama (§2.9). Eşleşme: ad `U.normalize` ile içerir **ya da** T.C. ham alt dize (aranan metnin baş/son boşluğu atılır).
- Bölüm `#bolumSuz`: "Tüm bölümler" + grubun bütçe bölümleri (etiketli, sıra numarasıyla). Seçili bölüm bu grupta yoksa süzgeç kendiliğinden düşer (liste boş görünmesin diye).
- Yaka `#yakaSuz`: "Tüm yakalar" / "Beyaz yaka" / "Mavi yaka".
- **+ Yeni Personel** (yazılabilir + `personel.yaz`) → boş kişi kartı (§3.3.1).
- Süzgeç ve sekme durumu modül belleğinde tutulur (ekran değişse de oturum boyunca kalır).

**Üst özet kutuları** (yalnız `zam.oku`; süzgeçten **bağımsız**, çalışmanın tamamı; `izgara-4`):

| Kutu (kenar rengi) | Değer | Etiket | Ek satır |
|---|---|---|---|
| (varsayılan) | Σ `s.yil.maliyet` | "<Y> toplam maliyet" | "N kişi · zam oranı %…" (= (Σyeni − Σeski) / Σeski; eski 0 ise "—") |
| `altin` | `B.isaretli(maliyet − Σ maliyet_onceki)` (önceki toplam 0 ise "—") | "Maliyet farkı (<Y> − <O>)" | "<O> maliyeti X · %…" ya da "<O> maliyeti girilmemiş" |
| `yesil` | `B.isaretli(Σyeni − Σeski)` | "Aylık net maaş artışı" | "<O>: Σeski → <Y>: Σyeni" |
| `mor` | "d / N" (düzeltmesi ≠ 0 olan kişi / kişi) | "Düzeltme yapılan kişi" | "Toplam düzeltme ±… (aylık net)" ya da "Düzeltme girilmedi" |

**Sekme çubuğu** (`.sekme-cubuk`): **Zam Çalışması** (`zam.oku`) · **Kişi Bilgileri**. Seçili sekme saklanır; yetkisi kalmamışsa ilk sekmeye düşer.

**Tablo** (`.genis-tablo.personel-tablo`). İlk iki sütun her sekmede aynıdır:
- **Ad Soyad**: (yazılabilir + `personel.yaz`) solda 🗑 düğmesi (`ikon-btn satir-sil ad-sil`, ipucu "Bütçeden çıkar"; yarı saydam, satırın üstüne gelince belirgin) + adın bağlantısı (tıklayınca kişi kartı) + çıkış rozeti (`cikisHtml(kp, true)`): gri "çıkış GG.AA.YYYY" (`onay_sabit > 0` ise çalışmanın saklı çıkış tarihi). Onaylı çalışmada (`onay_sabit = 1`) kart tarihi onaydan sonra değiştiyse ek sarı rozet "sonradan çıkış GG.AA.YYYY" ya da "çıkış sonradan silindi" (ipucu: "Personel kartında onaydan sonra değişti; onaylı maliyete girmez").
- **Bütçe Bölümü**: `API.bolumEtiket` (küçük yazı).

Satır sırası (`api.js:calismaPersonelListe`): bütçe bölümünün sırası → bölüm içinde işe giriş tarihi eskiden yeniye (çalışmanın saklı tarihi varsa o; boş tarih başta) → ad; bölümü tanımlı olmayanlar en sonda.

Başlık ve hücre sınıfları renk grubundan gelir (`bas-<g>`, `hucre-<g>`; §2.13); renk grubunun değiştiği sütunun solunda kalın ayırıcı (`grup-sinir`, `personel.js:sinir`).

**Sekme "Zam Çalışması"** (`sutunlar(c, 'zam')`)

| # | Başlık | Renk `g` | Kaynak / hesap | Düzenlenebilir | Toplam satırı |
|---|---|---|---|---|---|
| 0 | `<O>` Maaş | eski | `s.zam.eski` (= `kp.maas_eski`) | — | Σ |
| 1 | Zam Oranı Öng. | ong | `s.zam.oranOngoru` (`B.oran`) | — | boş |
| 2 | Zam Miktarı Öng. | ong | `s.zam.ongoru` | — | Σ |
| 3 | Zamlı Maaş Öng. | ong | eski + öngörü | — | Σ |
| 4 | Düzeltme | duz | `kp.duzeltme` | **evet** (`zam.yaz`): `input.hucre-girdi[data-duz]`, değer `B.tlDuz` (0 ise boş); yetkisizse `B.isaretli` | Σ |
| 5 | `<Y>` Zam Miktarı | zam | `s.zam.miktar` = öngörü + düzeltme (kalın) | — | Σ |
| 6 | `<Y>` Maaş | yeni | `s.zam.yeni` (kalın) | — | Σ |
| 7 | `<Y>` Zam Oranı | yeni | `s.zam.oran` | — | Σ(5) / Σ(0) |
| 8 | `<Y>` Toplam Maliyet | mal | `s.yil.maliyet` | — | Σ |
| 9 | `<O>` Toplam Maliyet | mal | `kp.maliyet_onceki` (kişi kartından ya da Personel İçe Aktarma'dan, §3.10) | — | Σ |
| 10 | Fark | mal | maliyet − maliyet_onceki (`B.isaretli`) | — | Σ(8) − Σ(9) |

Tutar hücreleri `B.tl` (kuruşsuz, sıfır soluk "—"). Düzeltme kaydı: **Enter** ya da odak kaybında, değer değiştiyse `API.calismaPersonelAlanYaz(c.id, tc, 'duzeltme', metin)` → ekran tazelenir. Boş = 0 (`CP_SAYISAL`). API `zam.yaz` + yazılabilir çalışma ister; hata bildirimle.

**Sekme "Kişi Bilgileri"** (`sutunlar(c, 'kisi')`; renk grubu yok, sayı hizası yok, toplam satırında yalnız ilk hücre)

| Başlık | Kaynak |
|---|---|
| Yaka | mavi rozet "Mavi" / gri rozet "Beyaz" |
| İşe Giriş | `kp.ise_giris` (GG.AA.YYYY) |
| Çıkış | `cikisHtml(kp, false)` (düz tarih + gerekiyorsa "sonradan" rozeti) |
| Hesaplama Türü | yılın hesap türü adı (`API.hesapTuruListe(yıl)`), yoksa kod, o da yoksa "—" (küçük) |
| Kanun | kanun türü adı (`API.kanunListe`); `YOK` ya da boş → "—" (küçük) |
| AR-GE GV Teşvik | `kp.gv_tesvik` (`B.oran`; 0 ise boş) |
| Sakatlık | "N. derece" (yoksa boş) |
| BES | "Katılıyor" (`EVET`) / "Katılmıyor" (`HAYIR`) / boş |
| Zam Ayı | ay adı (`zam_ayi`; boşsa Ocak) |
| Performans Puanı | 1 ondalık (boşsa boş) |
| Performans Çarpanı | 2 ondalık (boşsa boş) |

**Toplam satırı:** "Toplam (N kişi)" + boş + sütun toplamları (yalnız süzülen satırlar).

**Satır işlemleri:** ada tıklama → kişi kartı (`API.calismaPersonelGetir` ile güncel satır). 🗑 → Bütçeden Çıkar onayı (§3.3.2).

**Klavye/odak:** Düzeltme hücresinde Enter ya da başka yere geçiş kaydeder; kayıttan sonra ekran baştan çizilir ve sayfa en üste döner (bu ekranda kaydırma / odak koruması yalnız arama kutusu içindir, §2.9).

#### 3.3.1 Pencere — Kişi kartı ("Yeni Personel" / kişinin adı)

`formAc(c, kayit)`; genişlik `genis`. Alt başlık: yeni → "<yıl> · <grup adı>"; mevcut → "T.C. <tam | maskeli>" (`alan.tc`, §2.8).

- Yeni kişinin varsayılanları: yaka `B`, zam ayı Ocak, hesaplama türü `SSK`, kanun `YOK`.
- Çalışmanın kendi dönem tarihi varsa (`onay_sabit = 2`) giriş / çıkış alanları o tarihlerle dolar.
- Yazılabilir değilse (onaylı çalışma, grup yazma yetkisi ya da `personel.yaz` yok) **bütün alanlar kapalı**, altlıkta yalnız **Kapat**.

**Bölüm "Kimlik ve İstihdam — Personel İçe Aktarma'yla ERP / bordro programından da gelebilir"** (3 sütunlu ızgara)

| Alan (`name`) | Tür | Zorunlu | Not / davranış |
|---|---|---|---|
| T.C. Kimlik No (`tc_kimlik_no`) | metin, en çok 11, `mono` | **evet** (`*`) | Yeni kişide değişince (rakamları 11 hane ise) kayıtlı T.C.'nin son bilgileri doldurulur (aşağıda) |
| Ad Soyad (`ad_soyad`) | metin | **evet** (`*`) | Kayıtta baş/son ve çift boşluk sadeleşir (`U.bicimAd`) |
| Grup (`hedef_calisma`) | seçim | — | İlk seçenek mevcut grup (değer boş). Grup etiketi: grup adı; grubun o yıl birden çok çalışması varsa "Grup · çalışma adı" (örn. "Ofis · 2027 Revize"). Diğer seçenekler `API.tasimaHedefleri`: aynı yıl, başka grup, taslak, yazma yetkili çalışmalar (yalnız mevcut kişi + yazılabilirken). Hedef yoksa kapalı. Not: yeni → "Kişi bu çalışmaya eklenir."; hedef var → "Başka gruba atanırsa kişi bütün bilgileriyle (maaş, zam, aylık girdiler, değerlendirme) o gruba taşınır."; hedef yok → onaylıda "Onaylı çalışmada grup değiştirilemez.", değilse "<yıl> yılında taşınabilecek başka grup çalışması (taslak) yok." Hedef seçilince not: "Kaydedince **<hedef>** grubuna (<yıl>) bütün bilgileriyle taşınır ve <mevcut> grubundan çıkar. Onaylı çalışmalar etkilenmez. Bütçe bölümünü hedef grubun bölümlerinden seçin." ve Bütçe Bölümü listesi hedef grubunkine döner (aynı adlı bölüm varsa seçili kalır) |
| Bütçe Bölümü (`butce_bolumu`) | seçim ("—" + grubun bölümleri, etiketli) | — | |
| İşe Giriş (`ise_giris`) | tarih | — | Not: "<Y> içinde girenlere zam öngörülmez; <O> veya öncesinde girenlere <Y> zammı uygulanır." |
| İşten Çıkış (`isten_ayrilis`) | tarih | — | Not: "Çıkış ayından sonraki aylar hesaplanmaz." [+ `onay_sabit = 2` ise "**Bu çalışmanın kendi dönem tarihleri** (kişi sonra başka dönemde yeniden girdi)."] |
| Yaka (`yaka`) | seçim: Beyaz yaka (`B`) / Mavi yaka (`M`) | (API zorunlu) | |
| Bölüm (`bolum`) | metin | — | Fazla Mesai Planı'nda bölüm eşlemesi bu alanla yapılır (§3.7) |
| Ekip (`ekip`) | metin | — | |
| Görev / Meslek (`gorev`) | metin | — | |

**Grup geçmişi** (`#tcBilgi`, `gecmisHtml`; kişinin hiç çalışması yoksa boş) — başlık "Grup geçmişi"; kişinin görülebilen gruplardaki bütün çalışmaları (`API.personelGecmis`, yıl azalan): tablo Yıl · Grup · Çalışma (+ yeşil "onaylı", mavi "bu çalışma" rozeti) · İşe giriş · Çıkış (çalışmanın saklı tarihi varsa o; yoksa "—").
- Yeni kişide (T.C. doldurulunca) bilgi kutusu: "Bu T.C. kayıtlı: bilgileri son çalışmasından dolduruldu [(maaş, <O> yılının zamlı maaşı)]. **Yeniden girişse İşe Giriş tarihini yeni tarih yapın ve İşten Çıkış'ı boşaltın**; eski çalışmalar eski tarihlerini korur."
- Aynı yılda başka bir çalışmada da varsa sarı uyarı: "Bu kişi <yıl> yılında **<grup · çalışma>, …** çalışmasında da var; iki grupta birden maliyeti sayılır." + yeni kişide "Oradaki kartından **Grup** alanıyla bu gruba taşıyın.", mevcut kişide "Doğru grubu seçip diğerinden çıkarın ya da Grup alanıyla taşıyın."

**Yeni kişide T.C. ile önden doldurma** (`API.personelOnDoldur(tc, yıl)`): kayıtlı değilse geçmiş alanı temizlenir. Kayıtlıysa kişi kaydından `ad_soyad, bolum, ekip, gorev, ise_giris, isten_ayrilis`; son çalışma satırından `yaka, hesap_turu, kanun, gv_tesvik, sakatlik_derece, bes, zam_ayi, yol, maas_eski, maliyet_onceki`; bütçe bölümü yalnız son çalışma aynı gruptaysa. Boş değerler alanı değiştirmez. "Son çalışma" = bu yıldan önceki en yeni çalışma, yoksa en yeni çalışma. Son çalışma önceki bir yıldansa `maas_eski` o çalışmanın **zamlı** maaşı (`s.zam.yeni`), `maliyet_onceki` o çalışmanın yıllık maliyetidir; düzeltme ve performans alanları doldurulmaz. Sakatlık derecesi dolunca özürlü indirimi de güncellenir.

**Bölüm "Hesaplama — Ocak'tan geçerli; yıl içindeki değişiklik Aylık Girdiler'den"**

| Alan | Tür | Seçenekler / not |
|---|---|---|
| Hesaplama Türü (`hesap_turu`) | seçim (boş seçenek yok) | yılın hesap türleri (değer kod, etiket ad). Not: "SGK'sız türde yalnızca gelir ve damga vergisi hesaplanır." |
| Kanun (Teşvik) (`kanun`) | seçim (boş seçenek yok) | kanun türleri (`API.kanunListe`); varsayılan `YOK` |
| AR-GE GV Teşvik Oranı (`gv_tesvik`) | seçim | Yok (0) · %80 (0,8) · %90 (0,9) · %95 (0,95) |
| Sakatlık Derecesi (`sakatlik_derece`) | seçim | Yok (boş) · 1. derece · 2. derece · 3. derece |
| Özürlü İndirimi (aylık) (`ozurlu_indirimi`) | salt okunur sayı | ipucu "Dereceden, yılın tablosundan gelir"; derece değişince `API.sakatlikTutari(yıl, derece)` yazılır. Not (derece seçiliyken): "Hesapta <Y> tablosu kullanılır (N. derece: X TL). Tablo Parametreler'dedir; öngörü uygulanınca artar." |
| BES (`bes`) | seçim | — (boş) · Katılıyor (`EVET`) · Katılmıyor (`HAYIR`) |

**Bölüm "Maaş ve Zam — net tutarlar"** — üstte bilgi kutusu (`#maasNot`), İşe Giriş alanı değiştikçe yenilenir:
- giriş yok ya da giriş yılı < Y: "Maaş alanı **<O> maaşıdır**; <Y> zammı (öngörü + düzeltme) zam ayından itibaren üzerine eklenir.[ Kişi <O> içinde girdi; <Y> zammı yine uygulanır.]" (köşeli kısım giriş yılı = O ise)
- giriş yılı = Y: "Kişi **<Y> içinde** işe giriyor: zam öngörülmez, yazdığınız tutar **<Y> maaşıdır**; maliyet giriş ayından itibaren hesaplanır."
- giriş yılı > Y: "Giriş tarihi <Y> sonrasında; bu çalışmada maliyet hesaplanmaz."

| Alan (`name`) | Tür | Not |
|---|---|---|
| `<O>` Net Maaş (`maas_eski`) | sayı | Kişinin tek maaş alanı (önceki yıl net maaşı; yıl içinde girende o yılın maaşı) |
| Zam Ayı (`zam_ayi`) | seçim Ocak…Aralık | |
| Zam Düzeltmesi (`duzeltme`) | sayı | "Öngörülen zamma eklenir (eksi olabilir)." |
| Performans Puanı (`performans_puani`) | sayı | boş = yok |
| Performans Çarpanı (`performans_carpani`) | sayı | "Boşsa puandan (Parametreler → Performans) bulunur; o da yoksa 1." |
| Yol Parası (aylık net) (`yol`) | sayı | |
| `<O>` Toplam Maliyet (`maliyet_onceki`) | sayı | boş = yok |
| Sıra (`sira`) | number | boşsa 0 |
| Not (`not_metni`) | 2 satırlık metin | (ızgaranın altında, tam genişlik) |

Sayılar gösterimde tam sayıysa ondalıksız, değilse 2 ondalık (`B.tlDuz`); kayıtta `API.trSayi` ile çözülür. Boş sayısal alan 0 olur; `performans_puani, performans_carpani, maliyet_onceki, sakatlik_derece` boşsa `null` kalır (`api.js:CP_SAYISAL / CP_BOS_OLABILIR`). Formda olmayan `karsilastirma` alanı kayıttaki değeriyle korunur.

**Altlık:** (yazılabilirse) **🗑 Bütçeden çıkar** (yalnız mevcut kişi; tehlike rengi; ipucu "Kişiyi bu çalışmadan çıkarır (personel kaydı silinmez)") · **Vazgeç** · **Kaydet**. Yazılabilir değilse yalnız **Kapat**. 🗑 → kart kapanır, §3.3.2 onayı açılır.

**Kaydet** (`API.calismaPersonelKaydet(c.id, form, eskiTc, taşıma)`; Grup alanında hedef seçiliyse taşıma `{ hedefId, butceBolumu }` ile **aynı işlemde** `API.calismaPersonelTasi` — taşıma başarısız olursa kart değişikliği de geri alınır):
- Doğrulama ve hata metinleri (API): "T.C. Kimlik No 11 haneli olmalıdır." (rakam dışı karakterler atılıp ilk 11 rakam alınır, `U.tcTemizle`) · "Ad Soyad zorunludur." · "Yaka B (beyaz) ya da M (mavi) olmalıdır." · T.C. değiştirilmiş ve yeni T.C. başka kişiye aitse "Yeni T.C. No başka bir personele ait." · yazma denetimi: "Çalışma bulunamadı." / "Bu grupta değişiklik yetkiniz yok." / "Bu çalışma onaylı ve kilitli. Değişiklik için Bütçe Çalışmaları → ✎ ekranından "Taslak"a alın." / "Bu işlem için yetkiniz yok." / görüntüleme kipi metni (§2.2). Taşımada ayrıca: "Taşıma aynı yılın çalışmaları arasında yapılır." · "Kişi bu çalışmada yok." · "Kişi <grup · çalışma> çalışmasında zaten var."
- ⚠ T.C. için yalnız **uzunluk** denetlenir; kontrol hanesi algoritması (`U.tcGecerliMi`) kullanılmaz.
- Kişi kaydı (`personel`): yoksa `kaynak = 'ELLE'` ile eklenir; varsa ad, tarihler, bölüm, ekip, görev güncellenir. Satırın kendi dönem tarihi varsa (`onay_sabit = 2`) tarihler yalnız bu çalışma satırına yazılır, kişi kartının güncel tarihine dokunulmaz.
- Kart tarihleri değişince, kişiyi içeren **diğer** taslak çalışmalar (`onay_sabit = 0`) eski tarihleri kendi satırlarında saklar (`onay_sabit = 2`, `api.js:donemTarihleriniKoru`).
- Taşımada hedefe bütçe satırı, aylık girdiler ve performans değerlendirmesi kopyalanır, kaynaktan silinir; bütçe bölümü hedef grupta yoksa boş kalır; sıra = hedefteki en büyük sıra + 1.
- Başarı bildirimi: "Kaydedildi." ya da "<Ad> <hedef> grubuna taşındı[ (bütçe bölümünü orada seçin)]." → pencere kapanır, üst çubuk (`APP.calismaSeciciCiz`) ve ekran tazelenir. Taşımadan sonra ekran kaynak çalışmada kalır.

**Dikkat edilecekler (koddan):**
- ⚠ Kartta Zam Düzeltmesi, Performans Puanı ve Performans Çarpanı `zam.oku` / `zam.yaz` denetimi olmadan görünür ve kart kaydıyla (`personel.yaz`) yazılır; tablodaki Düzeltme hücresi ise `zam.yaz` ister.
- ⚠ Boş seçeneği olmayan seçimlerde (Hesaplama Türü, Kanun, AR-GE GV Teşvik Oranı, Yaka) kayıttaki değer listede yoksa tarayıcı ilk seçeneği gösterir ve Kaydet o değeri yazar.
- ⚠ "Aynı yılda başka çalışmada da var" uyarısı aynı grubun başka çalışmasını (örn. bir revize) da sayar; o durumda da "iki grupta birden maliyeti sayılır" der.
- ⚠ Önden doldurma bilgi kutusu, son çalışma daha eski bir yıldan olsa da "<O> yılının zamlı maaşı" yazar; doldurulan tutar o eski çalışmanın zamlı maaşıdır.

#### 3.3.2 Onay — Bütçeden Çıkar (`personel.js:sil`)

- Onay penceresi (§2.10): başlık "Bütçeden Çıkar"; mesaj "**<Ad>** bu çalışmadan çıkarılacak."; sarı detay: "Bu çalışmadaki aylık girdileri ve performans değerlendirmesi de silinir. Personel kaydı ve önceki yılların çalışmaları etkilenmez. Kişi yıl içinde ayrılacaksa silmek yerine çıkış tarihi girin."; düğmeler **Vazgeç** · **Çıkar** (tehlike).
- Onayda `API.calismaPersonelSil(c.id, tc)` (yazılabilir + `personel.yaz`; aylık girdi, performans girdisi ve bütçe satırı tek işlemde silinir) → ekran tazelenir. Hata bildirimle.

---

### 3.4 Maliyet Tablosu

**Kaynak:** `js/modules/maliyet.js` (`ciz`, `deger`, `dokumAc`, `OLCU`, `DOKUM`); `api.js:birlesikHesapla`.
**Yer:** Bütçe → 🧮 Maliyet Tablosu. Başlık "Maliyet Tablosu", alt başlık "Kişi × ay; bordro dökümü".
**Yetki:** `ozet.oku`. Düzenlenebilir hücre yok.
**Tümü:** **evet** (birleşik hesap, §3.1'deki çalışma seçimiyle; ek "Grup" sütunu).

**Amaç:** Kişi × ay tutar tablosu (gösterilen ölçü seçilir); kişinin adına tıklanınca o kişinin bordro dökümü.

**Kart başlığı:** "Maliyet Tablosu — <yıl> · <grup adı | Tüm Gruplar>"; açıklama "Kişinin adına tıklayın: ayların bordro dökümü açılır."

**Süzgeçler** (başlığın sağında; durumları modül belleğinde kalır):
- Ölçü (`#olcu`, `OLCU`) — her ay hücresi kişinin o ayki hesap sonucundaki alan kodudur (motor alan kodları: "02 — Hesap Motoru"):

| Değer | Etiket | Hesap |
|---|---|---|
| `DM` (varsayılan) | Toplam Maliyet | `aylar[m].DM` |
| `CV` | Brüt Toplam | `CV` |
| `DD` | Net Ödeme | `DD` |
| `AM` | Net Maaş | `AM` |
| `CW` | SGK İşçi | `CW` |
| `DE` | SGK İşveren | `DE` |
| `CZ` | Ödenecek Gelir Vergisi | `CZ` |
| `DB` | Ödenecek Damga Vergisi | `DB` |
| `TESVIK` | Teşvikler Toplamı | `DG + DH + DI + DJ + DK + DL` |

- Bölüm (`#bolumSuz`): "Tüm bölümler" + kişilerde geçen bütçe bölümleri. Tek grupta bölüm sırasına göre ve etiketli; Tümü'de ada göre alfabetik (`tr`), etiketsiz (süzgeç ada göre çalışır, aynı adlı bölümler gruplar arası birlikte süzülür). Seçili bölüm listede yoksa süzgeç düşer.

**Tablo** (`.genis-tablo`):

| Sütun | Kaynak |
|---|---|
| Ad Soyad | bağlantı (`data-dokum` = T.C., `data-c` = çalışma kimliği) |
| Grup | yalnız Tümü'de; grup adı (küçük) |
| Bölüm | `API.bolumEtiket` (küçük) |
| Oca · Şub · Mar · Nis · May · Haz · Tem · Ağu · Eyl · Eki · Kas · Ara | seçili ölçünün o ayki değeri |
| Toplam | satır toplamı (kalın) |

Toplam satırı: "Toplam (N)" + (Tümü'de boş Grup hücresi) + boş Bölüm + ay toplamları + genel toplam. Hücreler `B.tl` (kuruşsuz; sıfır soluk "—"). Satır sırası hesap sırasıdır (§3.3'teki sıra; Tümü'de grup grup art arda).

#### 3.4.1 Pencere — Bordro Dökümü (`dokumAc(c, s)`)

- Başlık "<Ad> — Bordro Dökümü"; alt başlık "<yıl> · <bölüm etiketi> · Zamlı maaş X (net) · Yıllık maliyet Y" (X = `s.zam.yeni`, Y = `s.yil.maliyet`); genişlik `genis`; altlık **Kapat**.
- Tablo: Kalem · Oca … Ara · **Yıl**. Ara başlık satırları (14 sütun birleşik, kalın, açık vurgu zemini `--accent-soft`): Girdiler, Ücret, Mesai / Ayni / Ek Ödeme, Toplamlar, İşveren.
- Satırlar (`DOKUM`; [alan, başlık, tür, vurgu]):

| Grup | Satırlar (alan → başlık) |
|---|---|
| Girdiler | `tur` Hesaplama türü (girdi) · `kanun` Kanun (girdi) · `AR` Sigorta günü · `AP` AR-GE günü · `AM` Net maaş · `AN` Net sakatlık indirimi · `AV` Mesai (net) · `ayni` Net ayni yardım (girdi) · `AZ` Toplam ek ödeme (net) |
| Ücret | `BB` Brüt ücret (kalın) · `BC` SGK işçi · `BD` İşsizlik işçi · `BE` GV matrahı · `BF` Devreden kümülatif matrah · `BJ` Gelir vergisi oranı (oran) · `BK` Gelir vergisi · `BL` Damga vergisi |
| Mesai / Ayni / Ek Ödeme | `BM` Brüt mesai · `BV` Mesai GV · `BX` Brüt ayni yardım · `CD` Ayni GV · `CF` Brüt ek ödeme · `CO` Ek ödeme GV · `CQ` Brüt ek ödeme-2 (yakıt) · `CK` Kümülatif GV matrahı |
| Toplamlar | `CV` Brüt toplam (kalın) · `CW` SGK işçi toplam · `CX` İşsizlik işçi toplam · `CY` Gelir vergisi toplam · `DA` Damga vergisi toplam · `DC` BES kesintisi · `DD` Net ödeme (kalın) |
| İşveren | `DE` SGK işveren · `DF` İşsizlik işveren · `DG` 05510 teşviki · `DH` 14857 engelli teşviki · `DI` 15510 teşviki · `DJ` 05746 AR-GE SGK teşviki · `DK` AR-GE GV teşviki · `DL` AR-GE DV teşviki · `CZ` Ödenecek GV · `DB` Ödenecek DV · `DM` TOPLAM MALİYET (kalın) |

- Hücre kuralları (`dokumAc → hucre`): "girdi" satırları o ayın etkin girdisi `s.girdi[m][alan]` ham değer (boş ya da 0 → boş; küçük yazı) — `tur` hesap türü **kodu**, `kanun` kanunun **kural kodu** (`YOK` dâhil olduğu gibi); oran satırı `B.oran` (0 ise boş); `AR` / `AP` biçimsiz ham sayı (0 ise boş); diğerleri `B.tl(v, 2)` (2 ondalık; sıfır soluk "—"), vurgulu satırlar kalın.
- **Yıl** sütunu (`topla`): girdi ve oran satırlarında ve `AR, AP, BF, CK, BE` satırlarında **boş**; diğerlerinde 12 ayın toplamı (2 ondalık, kalın).
- İşlev `window.MALIYET.dokumAc` olarak da dışa açılır (programda başka yerden çağrılmaz).

---

### 3.5 Aylık Girdiler

**Kaynak:** `js/modules/aylik.js` (`ciz`, `kanunKodu`, `TEK`, `TOPLAMSIZ`, `DEVREDEN`); `api.js:aylikGirdiHarita, aylikGirdiYaz, aylikGirdiToplu, AYLIK_SUREKLI, AYLIK_TEK, AYLIK_KISI_ALANLARI`.
**Yer:** Bütçe → 📅 Aylık Girdiler. Başlık "Aylık Girdiler", alt başlık "Ayni yardım, prim, mesai; yıl içi değişiklikler".
**Yetki:** görmek `personel.oku`. Hesaplama / Kanun seçimi: yazılabilir + `personel.yaz` (yalnız Şubat'tan itibaren). Tutar / saat / gün hücreleri ve toplu giriş: yazılabilir + `aylik.yaz`.
**Tümü:** hayır.

**Amaç:** Kişinin ay ay elle girilen bordro kalemleri: o aya özgü ödemeler ve yıl içi değişiklikler.

**Alan türleri** (`api.js`):
- **Sürekli** (`AYLIK_SUREKLI`; girildiği aydan itibaren sonraki aylara devreder): `hesap_turu, kanun, sakatlik_derece, ozurlu_indirimi, bes, gv_tesvik, yol, fm1, fm2, arge_gun`. Bu ekranda `hesap_turu, kanun, fm1, fm2, arge_gun` düzenlenir.
- **O aya özgü** (`AYLIK_TEK`): `ayni, prim, yakit, calisilan_gun`.
- Kişi bilgisi alanları (`AYLIK_KISI_ALANLARI`: `hesap_turu, kanun, sakatlik_derece, ozurlu_indirimi, bes, gv_tesvik, yol`) yazmak için `personel.yaz`, diğerleri `aylik.yaz` ister.

**Kart başlığı:** "Aylık Girdiler — <Ay> <yıl>"; açıklama: "Sarı hücreler bu ay için girilmiş değerdir. Hesaplama türü ve kanun Şubat'tan itibaren buradan değiştirilir ve sonraki aylara devreder; Ocak değeri kişi kartındadır. **Mesai saatleri ve AR-GE günü de devreder**: girildiği aydan itibaren sonraki aylarda aynen geçerlidir (Ocak'ta girilen AR-GE günü bütün yıl geçerli; hiç girilmemişse çalışmanın AR-GE günü ayarı, o da yoksa 0) (soluk rakam = devralınan); değiştirdiğiniz aydan itibaren yeni değer geçerli olur."

**Ay sekmeleri** (`.sekme-cubuk`): Ocak … Aralık düğmeleri (seçili `etkin`). Seçili ay modül belleğinde kalır (varsayılan Ocak).

**Toplu giriş satırı** (yalnız yazılabilir + `aylik.yaz`): "Tüm kişilere:" · alan seçimi (`#topluAlan`, aşağıdaki 7 tutar alanı, varsayılan "Net Ayni Yardım") · değer kutusu (`#topluDeger`, yer tutucu "tutar", 110 px) · **<Ay> ayına uygula** (`#topluBtn`) · soluk not "Boş bırakıp uygularsanız o alan bu ay için temizlenir."

**Tablo** (`.genis-tablo`; satırlar hesap sırasıyla bütün kişiler):

| Başlık | Alan | Düzenleme | Gösterim kuralı | Toplam satırı |
|---|---|---|---|---|
| Ad Soyad | — | — | | "Toplam" |
| Hesaplama | `hesap_turu` | Şubat+ ve `personel.yaz`: `select.hucre-girdi` (84 px; seçenek etiketi = hesap türü **kodu**) | seçim kutusunda o ayın kaydı varsa sarı (`degisti`); Ocak'ta ya da yetkisizken metin: etkin kod (kayıt yoksa ve ay Ocak değilse soluk `devralan`) | boş |
| Kanun | `kanun` | aynı | seçenek etiketi kanun kodu (`YOK` → "—"); etkin değer: o ayın kaydı, yoksa Şubat'tan o aya kadarki son kayıt, o da yoksa kişi kartı (`kanunKodu`) | boş |
| Net Ayni Yardım | `ayni` | `aylik.yaz`: `input.hucre-girdi` | kutu değeri = bu ayın kaydı (kayıt varsa sarı) | Σ bu ayın kayıtları |
| Prim / Diğer (net) | `prim` | `aylik.yaz` | aynı | Σ |
| Hafta İçi Mesai (saat) | `fm1` | `aylik.yaz` | kaydı yoksa yer tutucu = o ayın etkin saati (0 değilse); ipucu "Önceki aydan devralındı" | Σ **etkin** saat (devralınan dâhil) |
| Hafta Sonu Mesai (saat) | `fm2` | `aylik.yaz` | aynı | Σ etkin saat |
| Yakıt Yardımı | `yakit` | `aylik.yaz` | | Σ |
| Çalışılan Gün | `calisilan_gun` | `aylik.yaz` | yer tutucu her zaman "30" | **boş** |
| AR-GE Günü | `arge_gun` | `aylik.yaz` | yer tutucu = o ay hesaplanan `AP` (0 ise "—"); kaydı yoksa ipucu: "Önceki aydan devralındı" (önceki aydan değer var) / "Çalışmanın kayıtlı AR-GE günü" (hesaplanan gün var) / "AR-GE günü girilmedi (varsayılan yok) — Ocak'a girilen gün bütün yıla geçer" (GV teşviki ≥ yılın `arge_gv_esik` eşiği, vars. %80) / "AR-GE personeli değil (GV teşviki yok)" | **boş** |
| Ay Maliyeti | `s.yil.aylar[ay].DM` | — | `B.tl` | Σ |

- Kutu değeri kuruşluysa 2, değilse 0 ondalıkla gösterilir; yer tutucudaki saat / gün kesirliyse 1 ondalık.
- Tutar yetkisi olmayan kullanıcıda bu hücreler `B.tl(o ayın kaydı)` metnidir (kayıt yoksa soluk "—"; devralınan saat gösterilmez).

**Kaydetme:**
- Sayı kutuları: **Enter** ya da odak kaybında, değer değiştiyse `API.aylikGirdiYaz(c.id, tc, ay, alan, boş ? null : API.trSayi(v))`; `null` = o ayın kaydı silinir (sürekli alanda önceki ayın değeri yeniden devralınır). Hata olursa bildirim çıkar, aynı kutu yeniden kaydedilebilir.
- Seçimler (`change`): seçilen değer önceki ayın etkin değeriyle aynıysa (`s.girdi[ay−1].tur` / `kanunKodu(ay−1)`) o ayın kaydı **silinir** (`null`), değilse yazılır.
- Hata metinleri: "Bilinmeyen alan: …", yazma denetimi metinleri (§3.3.1).

**Toplu giriş** (`#topluBtn`):
- AR-GE günü **değer girilerek** uygulanıyorsa yalnız o ay kanunu (kural kodu) `05746` olan kişilere yazılır; hiç yoksa uyarı bildirimi "<Ay> ayında 05746 (AR-GE) kanunlu kişi yok." ve işlem durur. Temizlemede (boş değer) herkese uygulanır.
- Onay penceresi: başlık "Toplu Giriş"; mesaj "<Ay> ayı için **N kişinin**[ (yalnız 05746 AR-GE kanunlu olanlar)] "<alan etiketi>" alanı **<değer>** yapılacak | temizlenecek." + (AR-GE'de, varsa) "GV teşvik oranı girilmiş ama kanunu 05746 olmayan K kişiye yazılmayacak: <adlar>."; düğmeler **Vazgeç** · **Uygula**.
- Onayda `API.aylikGirdiToplu(c.id, ay, alan, boş ? null : trSayi(değer), tcListe)` (tek işlemde; ek hata "Ay 1 ile 12 arasında olmalı.") → ekran tazelenir. İşlem kaydına `TOPLU / aylik_girdi` yazılır.

**Klavye/odak:**
- **Enter** = kaydet ve **bir alttaki kişinin aynı alanına** geç; değişiklik yoksa yalnız alta geçer (içerik seçilir). Tab = yandaki alana (tarayıcı varsayılanı).
- Kayıt sonrası ekran yeniden çizilir ama **sayfa kaydırması, tablo kabının dikey / yatay kaydırması ve kaydırılmış ata öğeler korunur**; imleç hedef hücreye (`data-tc` + `data-alan`) odaklanır ve içerik seçilir (`ciz` içindeki `yenile(odak)`). Odak kaybında hedef = tıklanan yeni hücre (`relatedTarget`). Seçim kutusu değişince odak aynı hücrede kalır.
- Ay değiştirme ve toplu giriş sonrası ekran baştan çizilir (kaydırma korunmaz).

⚠ Çalışmada Fazla Mesai Planı açıksa (§3.7) bir ayın kendi kaydı olmayan hafta içi / hafta sonu mesai değeri (`fm1` / `fm2`) önceki aydan **devralınmaz**, bölüm tablosundan gelir; ekrandaki yer tutucu bu öngörü saatini gösterir ama ipucu yine "Önceki aydan devralındı" der.

---

### 3.6 Performans Değerlendirme

**Kaynak:** `js/modules/performans.js` (`ciz`, `veri`, `satirHtml`, `kisiAc`, `denetle`, `uygula`, `sutunlar`, `sayfaAdlari`, `kaliciAlanlar`, `sablonIndir`, `oku`, `onizlemeHtml`, `baglaOnizleme`; model düzenleyicisi `modelAc`, `modelDenetle`, `kaldirilanlar`, `ekAciklama`); `js/core/performans.js` (`PERF.VARSAYILAN`, `PERF.TURLER`, `PERF.hazirla`, `PERF.hesapla`, `PERF.aciklama`, `PERF.kodUret`, `PERF.sayi`); `api.js:performansModeliHam, performansModeli, calismaPerformansModeli, performansModeliYaz, performansGirdiHarita, performansGirdiYaz, performansGirdiSil, performansCarpanUygula, performansOncekiDonem, performansCarpani`; `css/butce.css` (`.pf-model-ek*`).
**Yer:** Bütçe → 🎯 Performans Değerlendirme. Sayfa başlığı "Performans Değerlendirme", alt başlık "Amir değerlendirmeleri, bölüm katsayısı ve zam çarpanı".
**Yetki:** `zam.oku` (menü ve açma). Değerlendirme girme / silme, Excel'den içe alma ve çarpan uygulama: yazılabilir çalışma (bkz. §0 "Yazılabilir") + `zam.yaz` (`yaz = API.calismaYazilabilir(c) && API.yetkiVar('zam.yaz')`). Şablon indirme: `excel.aktar`; içe alma düğmesi: `excel.aktar` **ve** `yaz`. **Değerlendirme modeli…** penceresi ekranı açan herkese açılır; modeli değiştirmek `parametre.yaz` ister (yoksa salt okunur, §3.6.2).
**Gruplar:** hepsi — ekranda grup kapısı yoktur. Değerlendirme kullanmayan grupta tablolar boş kalır, herkesin çarpanı 1'dir. **Tümü:** hayır (§1.6 bilgi kutusu).

**Amaç:** Seçili grubun çalışmasındaki kişilerin amir değerlendirmelerinden puan ve zam çarpanı hesaplamak; çarpanları zam öngörüsüne uygulamak. Değerlendirme, zammı yapılan yılın bir önceki yılının dönemine aittir (Y zammı, O dönemi). Girdiler çalışmaya kayıtlıdır (`performans_girdi`, satır başına `calisma_id, tc_kimlik_no, alan, deger`); puan ve çarpan her açılışta yeniden hesaplanır, kaydedilmez. Çarpanın zam hesabına etkisi: "02 — Hesap Motoru", §5.3 Performans çarpanı.

**Değerlendirme modeli bir veridir.** Amirler, yaka başına kriterler ve ağırlıklar, değerlendirme ağırlığı ve ek puan kuralları **yıl bazında** `parametre` tablosunda `perf.model` anahtarıyla (JSON) saklanır ve §3.6.2'deki pencereden düzenlenir. Kayıt yoksa programla gelen **örnek model** (`PERF.VARSAYILAN`) geçerlidir. Model, yılın diğer parametreleriyle birlikte yeni yıla kopyalanır (Parametreler → Yeni Yıl Öngörüsü, §3.11) ve çalışma onaylanınca dondurulur. Ekran, kişi penceresi, Excel şablonu ve içe alma her şeyi **çalışmanın** derlenmiş modelinden okur (`API.calismaPerformansModeli(id)`): taslak / revize çalışmada yılın modeli, onaylı çalışmada onay anında dondurulan parametrelerdeki model (onaydan önce kayıt yoksa örnek model). Kayıtlı model okunamaz ya da hatalıysa örnek model kullanılır (`api.js:performansModeli`). Modülde kriter adı, ağırlık ya da ek puan alanı sabiti yoktur.

Ham model biçimi (`PERF.VARSAYILAN()` ile aynı):

| Yapı | Biçim | Not |
|---|---|---|
| `amirler` | `[{ alan: 'amirN', ad, agirlik }]` | 1–5 amir. `alan` amirin kalıcı kodudur. |
| `yaka.M`, `yaka.B` | `{ ad, sayfa, degAgirlik, kriter: [{ kod, ad, agirlik }], ek: [ … ] }` | `sayfa` boşsa yaka adının büyük harfi; `degAgirlik` = değerlendirmenin toplam puandaki payı (/100) |
| `ek[]` | `{ alan, ad, tur, <türün alanları>, sinir?, not?, kalici? }` | `sinir` = `[en az, en çok]` giriş denetimi; `not` açıklamanın başına eklenir; `kalici` = yeni dönemin şablonuna önceki dönemden taşınır |

Kayıt alanları (girdi tablosundaki `alan` değeri; `M.alanlar(yaka)`): `grup` (değerlendirme bölümü) · `amirN` (amirin adı) · `a<N>.<kriter kodu>` (N **amirin kendi numarasıdır**, sırası değil — amir kaldırılsa da diğerlerinin verisi kaymaz) · ek puan alanı kodu. Metin alanları: `grup`, amir adları ve liste türündeki ek puan alanları; diğerleri sayıdır.

Ek puan kural türleri (`PERF.TURLER`; puan `puanIslevi`, açıklama `PERF.aciklama`; boş değer 0 sayılır):

| `tur` | Ekrandaki ad | Alanlar | Puan | Açıklama metni |
|---|---|---|---|---|
| `esik` | Eşik (üstü sabit puan, altı orantılı) | `esik`, `puan`, `katsayi` | değer ≥ eşik → puan; değilse değer × katsayı | "<eşik> ve üstü <puan> puan; altında değer × <katsayı>" |
| `kademe` | Kademe (sayıya göre puan) | `kademeler` = `[[en az, puan], …]` | değerin ulaştığı en yüksek kademenin puanı (ilk kademenin altındaki değer ilk kademenin puanını alır) | "<d1> → +<p1> · … · <dn> ve üzeri → <pn>" |
| `carpan` | Çarpan (değer × katsayı, üst sınırlı) | `katsayi`, `enCok` (boş = sınırsız) | en çok `enCok` olmak üzere değer × katsayı | "değer × <k>[, en çok <n>]" |
| `liste` | Liste (seçeneğe göre puan) | `secenek` = `[[ad, puan], …]`, `bos` | seçeneğin puanı (büyük harfe çevrilip boşluğu sadeleştirilmiş adla eşleşir); listede olmayan ya da boş değer → `bos` | "<Seçenek> <puan> · …[ · diğer <bos>]" |

Model denetimi (`PERF.hazirla`; hata metinleri "Değerlendirme modeli: " ile başlar): en az bir, en çok 5 amir ("en az bir amir tanımlanmalı." · "en çok 5 amir tanımlanabilir."); amir alanı `amirN` biçiminde, adı boş değil, ağırlık sayı ve eksi değil, aynı alan iki kez yok, en az bir amirin ağırlığı sıfırdan büyük ("en az bir amirin ağırlığı sıfırdan büyük olmalı."); her yaka için tanım ve en az bir kriter; kriter kodu `^[a-z][a-z0-9_]{0,29}$` ve yakada tekil; ek puan alanı kodu aynı desende, `grup` ya da `amirN` olamaz, yakada tekil; ad boş değil; kural türü seçilmiş ("… için kural türü seçilmemiş."); türün sayı alanları sayı ("<ad> eşiği sayı olmalı." gibi); kademede en az bir kademe, listede en az bir seçenek; değerlendirme ağırlığı sayı.

**Örnek model** (`PERF.VARSAYILAN`; kurum kendi politikasına göre §3.6.2'den değiştirir):

| Yapı | Değer |
|---|---|
| Amirler | `amir1` "1. AMİR" 50 · `amir2` "2. AMİR" 30 · `amir3` "İDARİ AMİR" 20 |
| Mavi yaka (`ad` "Mavi yaka", `sayfa` "MAVİ YAKA", `degAgirlik` 80) — kriterler | `is_bilgisi` İŞ BİLGİSİ 25 · `gorev` GÖREVLERİNİ YERİNE GETİRME 25 · `kural` İŞ GÜVENLİĞİ VE KURALLARA UYMA 20 · `iletisim` İLETİŞİM VE TAKIM ÇALIŞMASI 15 · `gelisim` KENDİNİ GELİŞTİRME 15 |
| Mavi yaka — ek puan alanları | `devam` DEVAMLILIK ORANI (%) — eşik 95, puan 5, katsayı 0,05; giriş 0–100 · `tutanak` TUTANAK SAYISI — kademe 0 → +2, 1 → 0, 2 ve üzeri → −2; giriş 0–99 · `kidem` · `egitim` |
| Beyaz yaka (`ad` "Beyaz yaka", `sayfa` "BEYAZ YAKA", `degAgirlik` 80) — kriterler | `is_bilgisi` İŞ BİLGİSİ 20 · `kalite` İŞ KALİTESİ VE HEDEFLERE ULAŞMA 20 · `planlama` PLANLAMA VE PROBLEM ÇÖZME 20 · `iletisim` İLETİŞİM VE TAKIM ÇALIŞMASI 15 · `gelisim` KENDİNİ GELİŞTİRME 10 · `yonetici` YÖNETİCİLİK ÖZELLİKLERİ 15 |
| Beyaz yaka — ek puan alanları | `kidem` · `egitim` |
| `kidem` KIDEM (YIL) | çarpan × 1, en çok 5; giriş 0–99; önceki dönemden taşınır; not "İşyerindeki bütün çalışma dönemlerinin toplamı (elle girilir; işe giriş tarihinden hesaplanmaz)." |
| `egitim` MEZUNİYET | liste: OKUR YAZAR 1 · İLK OKUL 2 · ORTA OKUL 3 · LİSE 4 · MESLEK LİSESİ 4 · ÖN LİSANS 5 · LİSANS 6 · YÜKSEK LİSANS 7 · DOKTORA 8; listede olmayan 0; önceki dönemden taşınır |

**Puanlama** (`PERF.hesapla(kisiler, model)`; aynı adımlar şablonun AÇIKLAMA sayfasında da yazılır, §4.3.1):
1. Amir puanı = Σ (kriter puanı × kriter ağırlığı / 100). Hiç dolu kriter yoksa **ya da toplam 0 ise** o amirin puanı yoktur. Kriter ağırlıklarının toplamı 100 değilse amir puanı en çok bu toplam kadar olur (uyarı verilir, engel değildir).
2. Değerlendirme = amir puanlarının amir ağırlıklarıyla ağırlıklı ortalaması; puanı olmayan amirin ağırlığı paydadan düşer (kalanlara dağılır). Ağırlıklar oran olarak kullanılır (toplamın 100 olması gerekmez). Hiçbir amirin puanı yoksa kişi **değerlendirilmemiş** sayılır.
3. Bölüm katsayısı = genel ortalama / kişinin değerlendirme bölümünün ortalaması. Genel ortalama, yakadaki **bölüm ortalamalarının ortalamasıdır** (kişilerin değil). Bölüm adı boş olanlar kendi aralarında bir bölümdür.
4. Toplam puan = değerlendirme × katsayı × `degAgirlik` / 100 + ek puanların toplamı.
5. Zam çarpanı = toplam puan / yakada değerlendirilenlerin ortalama toplam puanı. Değerlendirilmeyen kişi çarpan almaz (= 1).

Yakalar ayrı hesaplanır (`yaka` `M` değilse `B` sayılır).

**Kart 1 — "Performans Değerlendirme — <grup adı>"** (`ciz`; grup adı yoksa grup kodu)
- Açıklama: "<Y> zammı için <O> dönemi değerlendirmesi · <çalışma adı> · <model>. Toplam puan, yakanın ortalamasına bölünerek zam çarpanı olur (ortalama kişi = 1,00)." — <model>: onaylı çalışmada "onay anındaki değerlendirme modeli"; değilse yılın kaydı yoksa "varsayılan (örnek) değerlendirme modeli", varsa "<Y> yılına özel değerlendirme modeli".
- Düğmeler (`.btn-satir`):
  - **Değerlendirme modeli…** (`#pfModel`, ikincil, ipucu "Amirler, kriterler, ağırlıklar ve ek puan kuralları"; her zaman) → §3.6.2.
  - **Excel şablonu indir** (`#pfSablon`; `excel.aktar`) → §4.3.1. Hata: "Excel oluşturulamadı: …".
  - **Excel'den içe al…** (dosya seçici `#pfDosya`, `accept=".xlsx"`; `excel.aktar` + `yaz`) → önizleme (§4.3.2).
  - **Çarpanları zam hesabına uygula** (`#pfUygula`; `yaz`). Uygulanmamış fark yoksa **kapalı**; üzerine gelince ipucu: hiç değerlendirme varsa "Uygulanacak fark yok. Çarpan = puan ÷ yakada değerlendirilenlerin ortalaması: tek kişi (ya da hepsi aynı puanda) değerlendirildiyse çarpan 1 çıkar. Ya da hesaplanan çarpanlar zaten uygulanmış.", yoksa "Henüz değerlendirme girilmedi — herkesin çarpanı 1."
- Bilgi kutusu (`yaz`, uygulanmamış fark yok ve hiç değerlendirme yok): "**<Y> için henüz değerlendirme girilmedi**; herkesin çarpanı 1 olduğu için uygulanacak bir şey yok (düğme bu yüzden kapalı). Kişiye tıklayıp değerlendirmeyi buradan girebilir ya da "Excel şablonu indir" ile değerlendirmeyi yapacak amirlere gönderip, doldurulunca "Excel'den içe al" ile alabilirsiniz; düğme o zaman açılır. <O> değerlendirmesi taşınmaz: <Y> zammı <O> dönemi değerlendirmesiyle yapılır (şablonda <taşınan bilgiler> geçen yıldan dolu gelir)." — <taşınan bilgiler> = "değerlendirme bölümü", "amir adları" ve modelde *önceki dönemden taşınsın* işaretli ek puan alanlarının adları (küçük harf), "A, B ve C" biçiminde (`kaliciMetin`; örnek modelde "değerlendirme bölümü, amir adları, kıdem (yıl) ve mezuniyet").
- Dikkat kutusu (bir yakada en az bir kişi değerlendirilmiş ama hepsi değil): "**Değerlendirme eksik:** mavi yakada X kişi, beyaz yakada Y kişi değerlendirilmedi. Çarpan, yakada *değerlendirilenlerin* ortalamasına göre hesaplanır (tek kişi girilmişse onun çarpanı 1 çıkar); eksikler girildikçe herkesin çarpanı değişir. Uygulamadan önce tamamlamanız önerilir. (Değerlendirme dışı bırakılan yöneticiler gibi bilerek boş kalanlar çarpan 1 alır.)" (Yalnız eksiği olan yaka yazılır.)
- Dikkat kutusu (bir yakanın kriter ağırlıkları toplamı 100 değilse; yaka başına bir satır): "<yaka adı> kriter ağırlıkları toplamı X (100 değil); amir puanı en çok X olur. Gerekirse "Değerlendirme modeli…" penceresinden düzeltin."
- **Kutular** (`.izgara.izgara-4` içinde üç `.stat`):

| Kutu | Değer | Ek satır |
|---|---|---|
| "<mavi yaka adı> değerlendirilen" | değerlendirilen / yakadaki kişi | "ortalama puan X" (`sonuc.ort.M`, 2 ondalık; yoksa soluk "—") |
| "<beyaz yaka adı> değerlendirilen" | aynı (`B`) | aynı |
| "Zam hesabı" | yeşil rozet "Zam hesabı güncel" ya da turuncu (`rz-ongoru`) "N kişide çarpan zam hesabına uygulanmamış" | "Değerlendirilmeyen kişinin çarpanı 1'dir." |

  Yaka adları modelde tanımlıdır (örnek modelde "Mavi yaka", "Beyaz yaka"). "Uygulanmamış" ölçütü (`veri`): hesaplanan çarpan (değerlendirilmeyende 1) ile kişinin kayıtlı `calisma_personel.performans_carpani` değeri (boşsa 1) arasındaki fark > 1e-9.
- Çalışmada performans kapalıysa (`calisma.zam_performans` = 0) kutuların altında dikkat kutusu: "⚠ Bu çalışmada zam **performans çarpanı olmadan** hesaplanıyor. "Çarpanları zam hesabına uygula" performansı da açar."

**İçe alma önizlemesi** (`#pfOnizleme`): yalnız önizleme bu çalışmaya aitse çizilir; düzeni §4.3.2.

**Kart 2 — süzgeç ve tablolar**
- Süzgeç satırı: yaka düğmeleri (`.grup-dugmeler`, yazıları modeldeki yaka adları; mavi yaka varsayılan); arama kutusu `#pfAra` (yer tutucu "Ad, bölüm ara… (Esc: temizle)", en çok 240 px; §2.9 canlı arama) — ad soyad + değerlendirme bölümü + bütçe bölümü içinde arar (**T.C. ile aramaz**); bilgi "Satıra tıklayınca kişinin değerlendirmesi açılır."
- **"Bölüm düzeltme katsayısı — <yaka adı>"**: açıklama "Katsayı = bölüm ortalamalarının ortalaması (X) / bölümün ortalaması. Not veren amirlerin cömertlik farkını dengeler." (X = genel ortalama, 2 ondalık). Tablo (`.genis-tablo.param-tablo`, en çok 640 px), bölüm adına göre alfabetik:

| Sütun | Kaynak |
|---|---|
| Değerlendirme bölümü | girdi `grup`; boşsa "(bölüm yazılmamış)" |
| Kişi | bölümde değerlendirilen kişi sayısı |
| Ortalama değerlendirme | bölümdeki `deg` ortalaması (2 ondalık) |
| Katsayı | genel / bölüm ortalaması (4 ondalık) |

  Boşsa tek satır: "Henüz değerlendirme yok." Toplam satırı yoktur.
- **"Kişiler — <yaka adı> (N)"** tablosu (`#pfTablo`, `.tablo-sar` içinde). Satır sırası çalışmadaki kişi sırasıdır (`API.calismaHesapla` → `calismaPersonelListe`); değerlendirilmeyen satır soluk; her satır tıklanabilir (§3.6.1). Toplam satırı yoktur.

| Sütun | Kaynak / biçim |
|---|---|
| Adı soyadı | `kp.ad_soyad`; altında görev (küçük, çok soluk) |
| Bütçe bölümü | `kp.butce_bolumu` (etiket numarası olmadan) |
| Değerlendirme bölümü | girdi `grup` |
| her amir için bir sütun (başlık = amir adı; örnek modelde 1. AMİR · 2. AMİR · İDARİ AMİR) | o amirin puanı (1 ondalık; yoksa soluk "—") |
| Değerlendirme | `r.deg` (2 ondalık) ya da küçük "değerlendirilmedi" |
| Katsayı | `r.kats` (4 ondalık) |
| Ek puan | `r.ekToplam` (2 ondalık) |
| Toplam puan | `r.puan` (2 ondalık, kalın) |
| Çarpan | `r.carpan` (3 ondalık, kalın); değerlendirilmeyende "1,000" |
| Zamda uygulanan | `kp.performans_carpani` (3 ondalık; boşsa "1,000"); hesaplanandan farklıysa sarı hücre (`uyari-hucre`) + " ⚠", ipucu "Hesaplanan çarpan henüz zam hesabına uygulanmadı" |
| Zam oranı öng. | `s.zam.oranOngoru` (`B.oran`) |

**Çarpanları uygula** (`uygula`):
- Onay penceresi: başlık "Çarpanları uygula"; mesaj "N kişinin hesaplanan çarpanı zam öngörüsüne yazılacak; değerlendirilmeyen M kişinin çarpanı 1 olacak. Değişecek kişi: **D**." (D = uygulanmamış fark sayısı); detay (yalnız performans kapalıysa) "Bu çalışmada performansla zam hesabı da açılacak."; evet düğmesi **Uygula**.
- `API.performansCarpanUygula(c.id, { tc: çarpan })`: tek işlemde çalışmadaki **her** kişinin `performans_carpani` alanı yazılır — değerlendirilenlere hesaplanan çarpan, değerlendirilmeyenlere **boş** — ve çalışmada `zam_performans = 1` yapılır. İşlem kaydı `KAYDET` / `calisma_personel` "performans çarpanı uygulandı, N kişi".
- Başarı bildirimi "Çarpanlar uygulandı; zam öngörüleri güncellendi."; üst çubuktaki seçici (`APP.calismaSeciciCiz`) ve ekran yeniden çizilir.
- ⚠ Boşaltılan çarpan için zam motoru kişinin `performans_puani` alanına ve Parametreler → Performans Kademeleri'ne bakar (`api.js:performansCarpani`); kişi kartında puan girilmişse "çarpanı 1 olacak" bilgisi gerçekleşmez. Kişi kartına elle yazılmış çarpanlar da bu işlemle değişir.

**Ekranın belleği:** seçili yaka, arama metni ve içe alma önizlemesi modül değişkenlerinde tutulur; başka ekrana gidip dönünce ya da çalışma değişince korunur (önizleme yalnız ait olduğu çalışmada gösterilir).

#### 3.6.1 Pencere — Kişinin değerlendirmesi (`kisiAc`)

- `C.kipAc`, `genis`. Başlık: kişinin adı. Alt başlık: "<yaka adı> · <bütçe bölümü> · T.C. <numara>" (`alan.tc` yoksa maskeli, §2.8).
- **Üst ızgara** (`.izgara-4`): "Değerlendirme bölümü" (`grup`; öneri listesi `datalist` = aynı yakada bu çalışmada girilmiş bölüm adları, alfabetik) · her amir için "<amir adı> adı" (`amirN`).
- **"Kriter puanları (0–100)"** tablosu: sütunlar Kriter · Ağırlık · her amir için "<amir adı>" ve altında küçük "ağırlık <a>". Satırlar = yakanın kriterleri (model sırasıyla); her amir hücresi 64 px girdi (`a<N>.<kod>`; kayıtlı değer ondalık virgülle). Son satır (kalın) "Amir puanı": Ağırlık hücresinde kriter ağırlıkları toplamı (ipucu "Kriter ağırlıkları toplamı"), amir hücrelerinde hesaplanan puan (1 ondalık).
- **"Ek puanlar"** tablosu (`param-tablo`), satırlar = yakanın ek puan alanları: 1. sütun alanın adı + altında küçük açıklama (`PERF.aciklama`; giriş sınırı varsa " · giriş a–b" eklenir); 2. sütun girdi — liste türünde seçim kutusu (boş seçenek + liste; kayıtlı değer büyük harfe çevrilerek seçilir; listede olmayan kayıtlı değer ek bir seçenek olarak "<değer> (listede yok)" seçili görünür), diğer türlerde 80 px girdi; 3. sütun "X puan" (değerlendirilmişse). Yakada ek puan alanı yoksa "Bu yakada ek puan alanı yok."
- Alt bilgi: değerlendirilmişse mavi kutu "Σ Değerlendirme X × bölüm katsayısı K × <degAgirlik>/100 + ek E = **P** puan → çarpan **C** (yaka ortalaması O). Kaydedince bütün çarpanlar yeniden hesaplanır."; değilse sarı kutu "Bu kişi değerlendirilmemiş; zam çarpanı 1."
- **Altlık** — `yaz` ise: **Değerlendirmeyi sil** (kırmızı; yalnız kişinin en az bir girdisi varsa) · **Vazgeç** · **Kaydet**. `yaz` değilse yalnız **Kapat**; bütün alanlar kapalı (`disabled`).
- **Kaydet:** her alan `denetle` ile çözülür:
  - Boş (ya da tarih) → `null` (kayıtlı değer silinir).
  - Metin alanları (`grup`, amir adları, liste türü ek puan alanları): iç boşluklar teke indirilir; liste türü ek puan alanları ayrıca büyük harfe (tr) çevrilir.
  - Sayı alanları: `PERF.sayi` (ilk virgül noktaya çevrilir; binlik ayırıcı tanınmaz). Aralık: kriter puanları (`a<N>.…`) 0–100; ek puan alanında modelin giriş sınırı (`sinir`); sınırı olmayan alan sınırsız.
  - Hata metinleri: "<başlık>: "v" sayı değil" · "<başlık>: v (a–b arası olmalı)"; <başlık> şablon sütun başlığıdır (örn. "1. AMİR - İŞ BİLGİSİ"). Birden çok hata " · " ile tek bildirimde; pencere açık kalır.
  - Yalnız kayıtlı değerden farklı alanlar `API.performansGirdiYaz(c.id, liste, 'elle <ad>')` ile tek işlemde yazılır. API alan adını çalışmanın modeline göre denetler (modelde olmayan alan: "Bilinmeyen performans alanı: …"; çalışmada olmayan T.C.: "<tc> bu çalışmada yok."). Pencere kapanır; bildirim "Değerlendirme kaydedildi." ya da "Değişiklik yok."; ekran tazelenir.
- **Değerlendirmeyi sil:** onay "Değerlendirmeyi sil" — "<Ad> kişisinin bütün değerlendirme girdileri silinsin mi?" (kırmızı **Sil**) → `API.performansGirdiSil` (kişinin bu çalışmadaki bütün girdileri; işlem kaydı `SIL`) → bütün pencereler kapanır, ekran tazelenir (bildirim yok).
- Çarpanlar kaydedilince yeniden hesaplanır ama zam hesabına geçmez; "Zamda uygulanan" sütunu ⚠ gösterir.

#### 3.6.2 Pencere — Değerlendirme modeli (`modelAc`)

- **Ne düzenlenir:** seçili çalışmanın **yılının** modeli (`API.performansModeliHam(yıl)` → `{ model, varsayilan }`); o yılın bütün gruplarındaki çalışmalar kullanır. Taslak ham model üzerinde tutulur (`_` ile başlayan anahtarlar düzenleyicinin kendi işaretleridir, kaydedilmez).
- `C.kipAc`, `genis`. Başlık "Değerlendirme modeli — <yıl>"; alt başlık "Varsayılan (örnek) model" ya da "Bu yıla özel model" (+ yetki yoksa " · salt okunur").
- **Altlık:** `parametre.yaz` varsa **Varsayılan modele dön** (solda, ikincil; yalnız yıla özel kayıt varken) · **Vazgeç** · **Kaydet**; yoksa yalnız **Kapat**.
- **Salt okunur kip** (`parametre.yaz` yok): bütün alanlar kapalı; ekle / sil / sıra düğmeleri ve denetim satırı çizilmez; başta mavi kutu "ℹ Modeli değiştirmek için *Parametre ve tanımları değiştirir* yetkisi gerekir; burada yalnız görüntülenir." Sekmeler arasında gezilebilir.
- **Onaylı çalışmadan açılınca** başta mavi kutu: "🔒 Seçili çalışma onaylı: onay anındaki modelle değerlendirilir. Buradaki değişiklik <yıl> yılının taslak / revize çalışmalarına uygulanır."
- Genel not (soluk): "Model <yıl> yılının bütün gruplarındaki çalışmalarda kullanılır. Kriter puanları 0–100 arasında verilir; kriterden ya da ek alandan kaldırılan tanımların girilmiş değerleri silinmez ama artık hesaba girmez."

**Bölüm "Amirler"** — açıklama "Değerlendirme, amir puanlarının bu ağırlıklarla ortalamasıdır; puan vermeyen amirin ağırlığı diğerlerine dağıtılır. Ağırlıklar oran olarak kullanılır, toplamın 100 olması gerekmez. En çok 5 amir." Tablo (`param-tablo`, en çok 620 px):

| Sütun | İçerik |
|---|---|
| Amir | ad (metin kutusu) |
| Ağırlık | sayı kutusu (`.hucre-girdi`) |
| Kod | `amirN` (salt okunur, eş aralıklı, çok soluk) |
| (düğme) | 🗑 "Amiri kaldır" — yalnız birden çok amir varken |

Son satır (kalın) "Toplam": ağırlıkların toplamı (yazdıkça güncellenir). Altında **+ Amir ekle** (5'ten az amir varken): kullanılmayan ilk numarayla `amirN`, ad "N. AMİR", ağırlık boş; odak yeni ağırlık kutusuna geçer.

**Yaka sekmeleri** (`.sekme-cubuk`, küçük ikincil düğmeler): iki sekme, yazıları yaka adları; yakanın kriter ağırlıkları toplamı 100 değilse sekme yazısına " ⚠" eklenir. Açılışta ekranda seçili yaka açıktır. Sekme değiştirmek taslağı korur. Seçili yaka için:
- 3 sütunlu ızgara: "Yaka adı" · "Excel sayfa adı — boşsa yaka adı" (yer tutucu yaka adının büyük harfi) · "Değerlendirme ağırlığı — toplam puandaki payı (/100)" (sayı kutusu).
- **"Kriterler"** tablosu (en çok 760 px): Kriter (ad) · Ağırlık (sayı) · Kod (salt okunur; yeni kriterde "(yeni)" eki) · düğmeler ↑ (Yukarı) ↓ (Aşağı) — ilk / son satırda kapalı — ve 🗑 "Kriteri kaldır" (yakada birden çok kriter varken). Son satır (kalın) "Toplam": ağırlık toplamı; 100 değilse turuncu rozet "100 değil — amir puanı en çok X olur" (ipucu "Engel değil"). Altında **+ Kriter ekle** (odak yeni kriterin adına).
- **"Ek puan alanları"**: açıklama "Toplam puana eklenir (eksi puan da olabilir). Excel şablonunda kriterlerden sonra sütun olarak çıkar." Her alan çerçeveli bir kutudur (`.pf-model-ek`: ince çerçeve, 8 px yuvarlak köşe, açık zemin):
  - Üst satır (3 sütun): "Alan adı — Excel başlığı" (metin) · "Kural türü" (seçim: `PERF.TURLER` etiketleri; tür yoksa "— seçin —") · "Kod" (salt okunur; yeni alanda "(yeni)"); sağda 🗑 "Ek alanı kaldır".
  - Türe göre alanlar: **Eşik** → "Eşik" · "Eşik ve üstü puan" · "Altında: değer ×"; **Çarpan** → "Değer ×" · "En çok puan (boş = sınırsız)"; **Kademe** → not "Değerin ulaştığı en yüksek kademenin puanı verilir." + tablo "En az değer | Puan | 🗑" + **+ Satır**; **Liste** → tablo "Seçenek | Puan | 🗑" + **+ Satır** + "Listede olmayan ya da boş değerin puanı".
  - Ardından: "Giriş sınırı: en az [ ] en çok [ ]" (liste türünde yok) · ☐ "Önceki dönemden taşınsın" · "Not — açıklamanın başına eklenir" (metin).
  - En altta soluk "Açıklama: …" — kuralın canlı açıklaması (`ekAciklama`: `PERF.aciklama` metni + giriş sınırı varsa " · giriş a–b" + taşınıyorsa " · önceki dönemden taşınır"; yarım girilmiş değerde hata vermez, okunamazsa "—"; listede seçenek yoksa "Seçenek girilmedi.", kademe yoksa "Kademe girilmedi.").
  - Yakada ek puan alanı yoksa "Bu yakada ek puan alanı yok." Altında **+ Ek alan ekle**: yeni alan Çarpan türünde, katsayı 1, üst sınırsız; odak adına geçer.
  - Tür değişince eski türün alanları silinir, yeni türün varsayılanları eklenir (Eşik 0 / 0 / 0; Kademe tek satır [0, 0]; Çarpan katsayı 1, üst sınır yok; Liste tek boş seçenek ve diğer = 0); Liste'ye geçince giriş sınırı kaldırılır.
- En altta **canlı denetim satırı** (yalnız yazma yetkisiyle): yeşil "✓ Model geçerli; kaydedilebilir." ya da kırmızı "⚠ <hata metni>" (`modelDenetle`).

**Girdi davranışı:** metin ve sayı kutuları her tuşta taslağa yazılır (`input`); kural türü seçimi ve onay kutusu `change`'de. Sayı kutusu ondalık virgül kabul eder (`PERF.sayi`); sayı değilse kutu kırmızı çerçeve alır (`hatali`), değer metin olarak kalır ve denetim satırı hata gösterir. Toplamlar, sekme ⚠ işaretleri, ek puan alanı açıklamaları ve denetim satırı yazdıkça güncellenir. Ekle / sil / sıra / tür değişikliği gövdeyi yeniden çizer (pencerenin kaydırma yeri korunur).

**Kodlar** (`PERF.kodUret(ad, varolan)`): yeni kriter ve ek puan alanının kodu adından üretilir — Türkçe harfler ASCII'ye, küçük harfe çevrilir, harf / rakam dışı karakterler `_` olur, rakamla başlıyorsa önüne `k` eklenir, en çok 24 karakter, boşsa `alan`; aynı yakada çakışırsa `_2`, `_3`…; `grup` ve `amirN` kullanılmaz. Kod yalnız kaydedilmemiş (yeni) öğede ad değiştikçe yenilenir; kaydedilmiş kod bir daha değişmez (girilmiş değerler koda bağlıdır).

**Kaydet** (`modelDenetle` → `PERF.hazirla`):
- Kayıttan önce temizlik: boş Excel sayfa adı ve not silinir; Liste türünde giriş sınırı silinir; iki ucu boş sınır silinir; tamamen boş kademe ve seçenek satırları atılır; Çarpan'da boş üst sınır = sınırsız.
- Ek denetimler (§3.6 başındaki model denetimine ek): "<yaka> — "<alan>": giriş sınırının en az ve en çok değeri birlikte, sayı olarak girilmeli." · "<yaka> — "<alan>": giriş sınırında en az değer en çok değerden büyük olamaz."
- Hata varsa kayıt yapılmaz: hata bildirimi + denetim satırı.
- Kayıtlı modelde olup yenisinde olmayan amir / kriter / ek puan alanı varsa (`kaldirilanlar`) onay penceresi "Kaldırılan tanımlar": "Şunlar modelden kaldırılıyor:" + madde listesi ("Amir: <ad>", "<yaka adı> kriteri: <ad>", "<yaka adı> ek alanı: <ad>"); detay "Bu tanımlara girilmiş değerler silinmez, ama artık hesaba ve Excel şablonuna girmez. Aynı kodla yeniden eklenirse değerler geri gelir."; evet düğmesi **Kaydet**.
- `API.performansModeliYaz(yıl, ham)`: `parametre.yaz` + yazma kilidi; model `PERF.hazirla` ile yeniden denetlenir (hatalı model reddedilir); `parametre` tablosuna `(yıl, 'perf.model', JSON)` yazılır; işlem kaydı `KAYDET` / `parametre` "<yıl>/perf.model". Pencere kapanır; bildirim "<yıl> değerlendirme modeli kaydedildi; puanlar yeni modelle hesaplanıyor." (başarı); ekran tazelenir.

**Varsayılan modele dön** → onay (tehlike) "Varsayılan modele dön" — "<yıl> yılına özel model silinecek; bu yıl için varsayılan (örnek) model kullanılacak." / detay "Girilmiş değerlendirmeler silinmez; varsayılan modelde olmayan kriter ve alanlar hesaba girmez." / **Varsayılana dön** → `API.performansModeliYaz(yıl, null)` (kayıt silinir; işlem kaydı `SIL` / `parametre` "varsayılan modele dönüldü") → "<yıl> için varsayılan değerlendirme modeli geçerli." (başarı).

⚠ Dikkat:
- Model kaydedilince puan ve çarpanlar yeniden hesaplanır ama zam hesabına kendiliğinden geçmez; "Zamda uygulanan" sütunu ⚠ gösterir, **Çarpanları zam hesabına uygula** gerekir.
- Varsayılan modelle açılan pencerede değişiklik yapmadan Kaydet'e basmak da yıla özel bir kayıt oluşturur (değişiklik denetimi yoktur).
- Pencere onaylı çalışmadan açıldığında da yılın modelini değiştirir; onaylı çalışma dondurulmuş modelle kalır, ekranı değişmez.
- Model değişikliği için `zam.yaz` ya da gruba yazma erişimi gerekmez; `parametre.yaz` yeterlidir (model yılın parametresidir).

---

### 3.7 Fazla Mesai Planı

**Kaynak:** `js/modules/mesai.js` (`ciz`, `veri`, `bolumler`, `saatTablo`, `kisiTablo`, `takvimTablo`, `toplamGuncelle`, `aktar`, `oku`, `onizlemeHtml`); `api.js:mesaiOku, mesaiYaz, mesaiKopyala, mesaiAktifYaz, mesaiKisiBasi`, `api.js:calismaHesapla` (öngörünün hesaba girişi).
**Yer:** Bütçe → ⏱ Fazla Mesai Planı. Sayfa başlığı "Fazla Mesai Planı", alt başlık "Bölüm bazında aylık mesai saati ve kişi sayısı".
**Yetki:** `personel.oku` (menü ve açma). Hücre girme, öngörüyü açma/kapama, önceki yıldan kopyalama ve içe alma: yazılabilir çalışma + `aylik.yaz` (`yaz = API.calismaYazilabilir(c) && API.yetkiVar('aylik.yaz')`). Excel'e aktar: `excel.aktar`; Excel'den al: `excel.aktar` **ve** `yaz`.
**Gruplar:** hepsi — grup kapısı yoktur. Tabloyu kullanmayan grupta mesai kişi bazında Aylık Girdiler'den girilir (§3.5). **Tümü:** hayır (§1.6).

**Amaç:** Fazla mesaiyi kişi kişi değil bölüm bölüm planlamak. Her bölüm için ay ay **toplam** mesai saati — mavi yaka hafta içi (motorda `fm1`), mavi yaka hafta sonu (`fm2`), beyaz yaka hafta sonu (`fm2`) — ve bölümün kişi sayısı girilir. Tablo çalışmaya kayıtlıdır (`mesai_ongoru`: `calisma_id, yaka, bolum, ay, alan, deger`; takvim satırları `yaka = ''`, `bolum = ''` ile).

**Hesaba girişi** (`api.js:mesaiKisiBasi`, `calismaHesapla`):
- Kişi başı aylık mesai = bölümün o aydaki saati ÷ bölümün o aydaki kişi sayısı. Bölüm eşlemesi kişinin kartındaki **Bölüm** alanıyla (`kp.bolum`; bütçe bölümüyle değil) yapılır: iç boşluklar teke indirilir, büyük harfe (tr) çevrilir.
- Kişi sayısı girilmemişse çalışmadaki **kadro** sayılır: o yaka + bölümdeki `calisma_personel` kişi sayısı (giriş/çıkış ayına bakılmaz). Kişi sayısı 0 ise kişi başı mesai 0'dır.
- Mavi yakanın hafta içi ve hafta sonu saatleri **aynı** kişi sayısına bölünür. Beyaz yakada hafta içi mesai yoktur.
- Yalnız "Öngörü açık" iken (`calisma_ayar['mesai.ongoru'] = '1'`) kişinin `fm1` / `fm2` girdisi tablodan gelir. Kişiye **o ay** Aylık Girdiler'den yazılmış mesai önceliklidir; önceki aylardan devralınan mesai öngörü açıkken kullanılmaz (bkz. "02 — Hesap Motoru", §1.3 Aylık girdilerin aylara dağıtımı).

**Kart 1 — "Fazla Mesai Planı — <grup adı>"** (grup adı yoksa grup kodu)
- Açıklama: "<Y> · <çalışma adı>. Bölüm bazında aylık toplam mesai saati; kişi başı mesai = bölümün saati ÷ bölümün kişi sayısı. Kişiye o ay Aylık Girdiler'den mesai yazılmışsa o geçerlidir."
- Düğmeler:
  - **Excel'e aktar** (`#msAktar`; `excel.aktar`) → §4.4.1. Hata: "Excel oluşturulamadı: …".
  - **Excel'den al…** (dosya seçici `#msDosya`, `accept=".xlsx"`; `excel.aktar` + `yaz`) → önizleme (§4.4.2).
  - **<O> tablosunu kopyala** (`#msKopya`; `yaz` ve aynı grubun bir önceki yılında saat tablosu dolu bir çalışma varsa; `API.calismaListe` sırasındaki ilk uygun çalışma).
  - **Öngörüyü aç** / **Öngörüyü kapat** (`#msAc`; `yaz`; "kapat" ikincil görünümde).
- Durum satırı: yeşil rozet "Açık — kişilerin mesaisi bu tablodan" ya da turuncu (`rz-ongoru`) "Kapalı — kişilerin mesaisi Aylık Girdiler'den". Öngörü kapalı ve tablo doluysa yanında uyum bilgisi: "Tablodan hesaplanan kişi başı mesai, kişilere işlenen mesaiyle **birebir aynı** (M değer)." ya da "… **N** değerde farklı (M değer)." — her kişi × 12 ay × (`fm1`, `fm2`) için kişinin geçerli girdisi tablodan çıkan kişi başı değerle karşılaştırılır.
- Onaylı çalışmada mavi kutu: "Onaylı çalışmada tablo bilgi amaçlıdır: kişilere işlenmiş mesai onaylandığı hâliyle kalır ve onaylı maliyet değişmez. Yeni yılda "<Y> tablosunu kopyala" ile başlangıç yapılabilir."
- Saat tablosu boşsa sarı kutu: "Bu çalışmada henüz mesai öngörüsü yok. [<O> tablosunu kopyalayabilir, ]programın mesai Excel düzeninde ("Excel'e aktar" ile alınan dosya) hazırlanmış bir dosyayı içe alabilir ya da aşağıya yazabilirsiniz. Tabloyu kullanmazsanız mesai kişi bazında Aylık Girdiler'den girilir." (Yalnız takvim girilmişse tablo yine "boş" sayılır.)
- **"Aylık özet"** tablosu: sütunlar (boş) · Oca … Ara (`U.AYLAR`'ın ilk üç harfi) · Toplam.

| Satır | Hesap |
|---|---|
| Mavi yaka hafta içi saat | Σ tablodaki mavi yaka `fm1` (kuruşsuz) |
| Hafta sonu saat (mavi + beyaz) | Σ tablodaki `fm2` (iki yaka) |
| Brüt mesai ücreti (çalışmanın hesabı) — kalın | Σ kişilerin `s.yil.aylar[m].BM` alan kodu (brüt mesai) |

  "Toplam" sütunu kalındır. Bu tablo öngörü kapalıyken de tablonun saatlerini gösterir; brüt mesai satırı ise çalışmanın o anki hesabıdır.

**Düğme davranışları**
- **Öngörüyü aç:** onay "Mesai öngörüsünü aç" — "Kişilerin aylık mesaisi bölüm tablosundan hesaplanacak (bölümün saati ÷ kişi sayısı). Aylık Girdiler'de kişiye o ay yazılmış mesai varsa o geçerli kalır." (**Aç**). **Öngörüyü kapat** onaysızdır. `API.mesaiAktifYaz` → `calisma_ayar['mesai.ongoru']` yazılır / silinir (işlem kaydı "mesai öngörüsü açıldı/kapatıldı"); ekran tazelenir, bildirim yok.
- **<O> tablosunu kopyala:** saat tablosu doluysa onay "Tabloyu kopyala" (kırmızı **Kopyala**): "Bu çalışmadaki mesai öngörüsü silinip <O> tablosu kopyalanacak."; boşsa onaysız. `API.mesaiKopyala`: hedefin bütün satırları (takvim dâhil) silinir, kaynağın bütün satırları kopyalanır (işlem kaydı `KOPYALA`). Bildirim "<O> tablosu kopyalandı."

**İçe alma önizlemesi** (`#msOnizleme`): yalnız bu çalışmaya aitse; düzeni §4.4.2.

**Kart 2 — sekmeler** (`.grup-dugmeler`): **Mavi yaka · hafta içi** (`MI`, varsayılan) · **Mavi yaka · hafta sonu** (`MS`) · **Beyaz yaka · hafta sonu** (`BS`) · **Kişi sayıları** (`KS`) · **Takvim** (`TK`). Saat sekmelerinde gösterim seçimi (`#msGos`): "Bölüm toplam saat" (varsayılan) / "Kişi başı saat". `yaz` ise bilgi: "Hücreye yazıp çıkınca kaydedilir."

*Saat sekmeleri* (`saatTablo`). Satırlar = yakanın bölümleri: tablodaki bölümler ∪ çalışmadaki o yakadan kişilerin kart **Bölüm** değerleri; büyük harfli anahtara göre alfabetik.

| Sütun | Toplam kipinde | Kişi başı kipinde |
|---|---|---|
| Bölüm | bölüm adı; o yakadan kişisi yoksa küçük soluk "(kişi yok)" (ipucu "Bu çalışmada bu bölümde bu yakadan kişi yok") | aynı |
| Kadro (ipucu "Çalışmadaki kişi") | o yaka + bölümdeki kişi sayısı (küçük, soluk) | aynı |
| Oca … Ara | 62 px girdi kutusu (bölümün o aydaki toplam saati); `yaz` değilse kapalı | salt okunur: saat ÷ kişi sayısı (2 ondalık; 0 ise soluk "—") |
| Toplam | satır toplamı (kalın) | boş (başlık da boş) |

  Toplam satırı (`toplam-satir`, yalnız toplam kipinde): "Toplam", boş, ay toplamları, genel toplam. Bölüm yoksa "Bölüm yok." Alt not: toplam kipinde "Saatler bölümün o aydaki TOPLAM mesai saatidir."; kişi başı kipinde "Kişi başı saat = bölümün toplam saati ÷ kişi sayısı (Kişi sayıları sekmesi; boşsa kadro)."

*Kişi sayıları* (`kisiTablo`): iki tablo — "Mavi yaka (hafta içi ve hafta sonu) — personel sayısı" ve "Beyaz yaka — personel sayısı". Sütunlar: Bölüm · Kadro (kalın) · Oca … Ara (46 px girdi; yer tutucu = kadro; girilen sayı kadrodan farklıysa sarı `uyari-hucre`, ipucu "Kadrodan farklı"). Toplam satırı yoktur. Not: "Boş hücre = çalışmadaki kadro (soluk sayı). Kadrodan farklı yazılan sayı sarı görünür; bölümün saati bu sayıya bölünür (planlanan kişi sayısı)."

*Takvim* (`takvimTablo`): sütunlar (boş) · Oca … Ara. Satırlar (52 px girdi): HAFTAİÇİ ÇALIŞMA GÜNÜ (`gun`) · MESAİLİ ÇALIŞILACAK TATİL GÜNÜ (`tatil_mesai`) · TAM KADRO ÇALIŞILACAK TATİL GÜNÜ (`tatil_tam`) · ÇALIŞILMAYACAK TATİL GÜNÜ (`tatil_yok`); ardından kalın "Toplam (ayın günü)" = "Σ / ayın gün sayısı" (Σ dolu ve ayın gün sayısından farklıysa sarı) ve "Hafta sayısı (çalışma günü ÷ 6)" (2 ondalık). Not: "Takvim bilgi amaçlıdır; hesaba girmez. Saatleri planlarken kullanılır."

**Hücre kaydı** (bütün sekmeler; `change` olayı = değer değişip kutudan çıkınca):
- Sayı çözümü bu ekrana özeldir: noktalar silinir (binlik), virgül ondalık. Boş değer = hücreyi sil. Sayı değilse ya da negatifse bildirim "Geçersiz değer: v" ve kutuya `hata` sınıfı; kayıt yapılmaz.
- `API.mesaiYaz(c.id, [{ yaka, bolum, ay, alan, deger }])` (alanlar `fm1, fm2, kisi, gun, tatil_mesai, tatil_tam, tatil_yok`; bölüm adının iç boşlukları teke indirilir). Hata metinleri: "Bilinmeyen mesai alanı: …", "Geçersiz ay: …"; onaylı çalışmada §2.4'teki kilit metni.
- Başarıda kutu sarı (`degisti`) olur; satır ve sütun toplamları **ekran yeniden çizilmeden** güncellenir (`toplamGuncelle`; yalnız saat tablolarında). Bildirim yoktur.
- ⚠ Hücre kaydından sonra üstteki "Aylık özet" tablosu, uyum bilgisi ve brüt mesai ücreti ekran yeniden çizilene kadar eski kalır.

**Ekranın belleği:** seçili sekme, gösterim kipi ve içe alma önizlemesi modül değişkenlerinde tutulur.

---

### 3.8 Bütçe Çalışmaları

**Kaynak:** `js/modules/calisma.js` (`ciz`, `form` — içinde `kaynakGuncelle`, `ayarHtml`, `ayarOku`, `revizeAc`, `parametreDurum`, `KADEME`, `goster`); `api.js:calismaListe, calismaGetir, calismaKaydet, calismaRevizeAc, calismaSil, calismaPersonelKopyala, calismaAyarOku, calismaAyarYaz, parametreDurumu, calismaParametreDondurulmusMu`.
**Yer:** Bütçe → 🗂 Bütçe Çalışmaları (Bütçe menü başlığının ilk ekranı). Sayfa başlığı "Bütçe Çalışmaları", alt başlık "Her grubun her yılı için bütçe: açma, onay, revize ve ayarlar".
**Yetki:** `personel.oku`. **+ Yeni Çalışma**, **✎**, **🗑**, **Revize aç**: o grupta yazma erişimi (`API.grupYazabilir`) + `personel.yaz`. **Tümü:** çalışır. Ekran `calismaGerekli` değildir: seçili çalışma gerekmez, eksik çalışma uyarısı (§2.6) çıkmaz, 🔒 ve 🗂 bantları (§2.4, §2.5) eklenmez.

**Amaç:** Her grubun her yılı ayrı bir bütçe çalışmasıdır. Bu ekranda çalışma açılır (önceki yıldan / aynı yıldan kopya / boş), seçilir, ayarlanır, onaylanır (ya da taslağa alınır), onaylı çalışmanın revizesi açılır ve çalışma silinir.

**Kart başlığı:** "Bütçe Çalışmaları — <grup adı | Tüm gruplar>"; açıklama "Her grubun her yılı ayrı bir çalışmadır. Yalnızca erişim yetkiniz olan gruplar listelenir." Sağda **+ Yeni Çalışma** — `personel.yaz` var ve kullanıcının yazabildiği en az bir görünür grup varsa.

**Liste kapsamı:** tek grup seçiliyken o grubun **bütün yıllarının** çalışmaları (üst çubuktaki yıl listeyi süzmez); Tümü'de kullanıcının görebildiği bütün grupların çalışmaları. Sıra `API.calismaListe`: yıl azalan, grup sırası (`grup.sira`), çalışma adı.

**Tablo** (`C.tablo`; boşsa "Bu grupta çalışma yok."):

| Başlık | İçerik |
|---|---|
| Yıl | sayı (sağa hizalı) |
| Grup | grup adı |
| Ad | çalışma adı; üst çubukta seçili çalışmaysa mavi "seçili" rozeti |
| Kişi | çalışmadaki kişi sayısı (`calisma_personel` satırı) |
| Parametreler | Çalışma `ONAYLI` **ve** dondurulmuş parametresi varsa (`calismaParametreDondurulmusMu`) gri rozet "🔒 onay anındaki" (ipucu: "Onay anındaki parametrelerle hesaplanır; Parametreler'deki değişiklik bu çalışmaya yansımaz"). Değilse yılın parametre durumu (`parametreDurum` → `API.parametreDurumu`): yılın asgari ücret satırı yoksa kırmızı "girilmemiş"; öngörüyse turuncu "Öngörü %X,X" (öngörü oranı ×100, 1 ondalık); değilse yeşil "Resmî" |
| Zam yöntemi | `zam_kademe` → "Kademe", değilse "Sabit oran"; `zam_performans` varsa " × Performans" eklenir |
| Durum | yeşil "Onaylı" / sarı "Taslak" |
| (düğmeler, sağa hizalı) | **Aç** (herkes) · **Revize aç** (yalnız `ONAYLI` + grupta yazma + `personel.yaz`; ipucu "Onaylı çalışmanın kopyası; güncel (resmî) parametrelerle hesaplanır") · **✎** ve **🗑** (grupta yazma + `personel.yaz`; durumdan bağımsız) |

**Düğmeler:**
- **Aç** → `APP.calismaSec(id)`: üst çubuğun yılı, grubu ve çalışması bu çalışmaya ayarlanır (Tümü seçiliyse çalışmanın grubuna geçilir), seçim saklanır (§1.5); ardından `APP.git('ozet')` → Özet ekranı.
- **+ Yeni Çalışma** → Yeni Çalışma penceresi (§3.8.1).
- **✎** → Çalışma Ayarları penceresi (§3.8.2).
- **🗑** → onay penceresi (§2.10): başlık "Çalışmayı Sil"; mesaj "**<yıl> · <grup> · <ad>** silinecek."; sarı detay "Bütçe satırları ve aylık girdileri de silinir. Önce yedek almanız önerilir."; evet düğmesi **Sil** (kırmızı). Onaylanınca `API.calismaSil` → üst çubuk ve ekran yeniden çizilir. Onaylı çalışmada API reddeder: "Bu çalışma onaylı ve kilitli. Değişiklik için Bütçe Çalışmaları → ✎ ekranından "Taslak"a alın." (bildirim, §2.3).
- **Revize aç** → onay penceresi: başlık "Revize Çalışma"; mesaj "**<yıl> · <grup> · <ad>** onaylı çalışmasının kopyası "**<yıl> Revize**" adıyla taslak olarak açılacak."; detay "Onaylı çalışma olduğu gibi kalır (onay anındaki parametrelerle). Revize, <yıl> yılının **güncel** parametreleriyle hesaplanır: Ocak'ta Parametreler'e girilen resmî rakamlar yalnız revizeye yansır. Personel, zam düzeltmeleri, aylık girdiler, performans ve mesai tablosu kopyalanır."; evet düğmesi **Revize aç**. `API.calismaRevizeAc` (tek veritabanı işlemi):
  - Ad "<yıl> Revize"; aynı yıl + grupta bu ad varsa "<yıl> Revize 2", "… 3" …
  - Durum `TASLAK`; açıklama "Revize · kaynak: <kaynak adı> (onaylı)"; zam yöntemi (`zam_kademe`, `zam_performans`) kaynaktan.
  - İçerik `KOPYA` kuralıyla kopyalanır (bkz. §3.8.1). Onay anında dondurulmuş giriş/çıkış tarihleri kopyalanmaz: revize kişi kartındaki güncel tarihlerle hesaplanır.
  - Başarıda "Revize çalışma açıldı." (başarı) ve revize seçilir; ekran Bütçe Çalışmaları'nda kalır.
- Ekrana `{ yeni: true }` parametresiyle gelinirse (eksik çalışma uyarısındaki "<yıl> çalışması aç…", §2.6) ve kullanıcı çalışma açabiliyorsa Yeni Çalışma penceresi kendiliğinden açılır.

#### 3.8.1 Pencere — Yeni Çalışma

Başlık "Yeni Çalışma" (alt başlık yok). Altlık: **Vazgeç** · **Kaydet**.

| Alan | Tür | Varsayılan / not |
|---|---|---|
| Yıl (`yil`) | sayı | üst çubuktaki yıl; yoksa içinde bulunulan takvim yılı |
| Grup (`grup_kod`) | seçim | kullanıcının **yazabildiği** görünür gruplar; varsayılan seçili grup (Tümü'de listedeki ilk grup) |
| Ad (`ad`) | metin | yer tutucu "<yıl> Bütçe" (pencere açıldığındaki yıl); boş bırakılırsa API adı "<yıl> Bütçe" yapar |
| "Personel nereden gelsin?" (`kaynak`, radyo) | üç seçenek | `YENI_YIL` (varsayılan) **Önceki yılın çalışmasından** — "önceki yılın zamlı maaşları bu yılın başlangıç maaşı olur" · `KOPYA` **Aynı yıldaki bir çalışmanın kopyası** — "senaryo denemek için" · `BOS` **Boş** — "personel sonra Personel İçe Aktarma ekranından (Excel / ERP listesi) alınır ya da elle eklenir". Seçenekler satır içi radyo + kalın ad + açıklama (`label.satir`) |
| Kaynak çalışma (`kaynak_id`) | seçim | `BOS`'ta gizli. Liste: seçili grupta, `YENI_YIL` → yıl − 1, `KOPYA` → aynı yıl; etiket "<yıl> · <grup> · <ad> (N kişi)"; ilk seçenek seçili. Liste boşsa not: "<yıl − 1> yılında bu grubun çalışması yok." / "Bu yılda kopyalanacak çalışma yok." `BOS` dışında hedef yılın parametresi yoksa nota eklenir: " <yıl> parametreleri henüz yok — önce Parametreler → Yeni Yıl Öngörüsü ile oluşturun." (yalnız bilgi; kaydı engellemez) |
| Açıklama (`aciklama`) | metin | |

Kaynak listesi ve not; yıl, grup ya da kaynak türü değiştikçe yenilenir (`change`). Zam yöntemi bu pencerede sorulmaz.

**Kaydet:**
1. `BOS` değilken kaynak seçilmemişse: "Kaynak çalışma seçin ya da "Boş" seçeneğini işaretleyin."
2. `API.calismaKaydet` yeni satır açar: durum `TASLAK`, `zam_kademe = 1`, `zam_performans = 0`. Yetki hatası: "Bu grupta çalışma açma yetkiniz yok."
3. Kaynak varsa `API.calismaPersonelKopyala(kaynak, yeni, tür)` → bildirim "N kişi aktarıldı." (başarı).
4. Pencere kapanır, yeni çalışma seçilir (`APP.calismaSec`); ekran Bütçe Çalışmaları'nda kalır.

Kopyalama kuralları (`api.js:calismaPersonelKopyala`; kaynak ve hedef aynı grupta olmalı, değilse "Kaynak ve hedef aynı grupta olmalı."):
- **`YENI_YIL`** (kaynak çalışma `API.calismaHesapla` ile hesaplanır):
  - Aktarılmayanlar: kişi kartındaki **güncel** çıkış tarihi (kartta yoksa kaynak satırın dönem çıkışı) kaynak yıl ya da öncesindeyse; hedef yılda **başka bir grubun** çalışmasında zaten kayıtlıysa.
  - Hedef satır: `sira`, `butce_bolumu`, `yaka`, `not_metni` aynen; `maas_eski` = kaynak yılın **zamlı** maaşı (`s.zam.yeni`); `maliyet_onceki` = kaynak yılın yıllık maliyeti (`s.yil.maliyet`); `zam_ayi = 1`, `duzeltme = 0`; performans puanı / çarpanı boş; sürekli alanlar (`hesap_turu`, `kanun`, `sakatlik_derece`, `ozurlu_indirimi`, `bes`, `gv_tesvik`, `yol`) kaynakta Aralık'ta geçerli olan değer.
  - Aylık girdiler, özet rakamları, performans girdileri ve mesai öngörüsü taşınmaz.
  - Çalışma ayarları taşınır; şunlar hariç: `gun.*` (varsayılan gün), `dagilim.*` (Maaş Dağılımı seçimi), `arge_gun`, `tesvik.*` (yalnız `tesvik.k05510` taşınır).
- **`KOPYA`:** bütçe satırlarının bütün alanları (`CP_ALANLAR`), aylık girdiler, özet rakamları (`calisma_ozet`), performans girdileri, mesai öngörüsü ve bütün çalışma ayarları birebir.
- İki türde de satırlar `INSERT OR IGNORE` ile yazılır; işlem kaydına `KOPYALA` düşer. Ayrıntılı hesap: 02 — Hesap Motoru, "Yeni yıla geçiş (girdi hazırlığı)".

⚠ Çalışmanın açılması (adım 2) ile personelin kopyalanması (adım 3) ayrı işlemlerdir: kopyalama hata verirse boş çalışma kalır.

#### 3.8.2 Pencere — Çalışma Ayarları (✎)

Başlık "Çalışma Ayarları", alt başlık "<yıl> · <grup>". Altlık: **Vazgeç** · **Kaydet**. Ayar kutuları anında kaydedilmez; yalnız **Kaydet** yazar.

| Alan | Tür | Not |
|---|---|---|
| Yıl, Grup | kapalı | |
| Ad (`ad`) | metin | yer tutucu "<yıl> Bütçe" |
| Durum (`durum`) | seçim | "Taslak" (`TASLAK`) · "Onaylı (yönetim onayladı)" (`ONAYLI`) |
| "Zam öngörüsü yöntemi" | onay kutuları | `zam_kademe` "Maaş kademesine göre oran (düşük maaşa yüksek oran)" · `zam_performans` "Performans çarpanı uygula (kişi kartındaki puan / çarpan)" · not "İkisi birden seçilirse: kademe oranı × performans çarpanı. Kademe kapalıysa üst oran sabit uygulanır." |
| "Bu gruba özel zam kademesi" | tablo: satırlar Beyaz yaka / Mavi yaka × 4 sütun | not "Boş bırakılan alanda <yıl> yılının genel değeri (soluk) geçerlidir." Sütunlar (`KADEME`): "Alt eşik" (`zam.<B|M>.alt_esik`) · "Üst eşik" (`ust_esik`) · "Alt eşik altı oran (%)" (`ust_oran`) · "Üst eşik üstü oran (%)" (`alt_oran`). Yer tutucu = yılın parametresi (`zam.<B|M>.<anahtar>`; parametre yoksa `API.ZAM_TANIM` varsayılanı). Oranlar yüzde olarak gösterilip girilir (×100, en çok 2 ondalık, ",00" atılır), ÷100 saklanır |
| "Zam öngörüsü yuvarlama adımı (TL)" | sayı | `zam.yuvarla_ongoru` (TL olarak saklanır); yer tutucu yılın `zam_yuvarla` parametresi (yoksa 10). Not: "Öngörülen zam bu tutarın en yakın katına yuvarlanır (ör. …). Boş = yılın parametresi (Parametreler → Genel)." Geçerli adım: bu ayar, yoksa yılın parametresi, o da yoksa 10 |
| "Varsayılan çalışılan gün" | tablo: Beyaz / Mavi × Oca…Ara (44 px kutular) | `gun.<B|M>.<1..12>`, yer tutucu 30. Not: "Kişiye ayrıca gün girilmemişse bu gün kullanılır (boş = 30). Örn. mavi yaka bazı aylarda eksik gün çalışacaksa (ör. 26) o aylara gün sayısını yazın." Tablo `.tablo-sar` içinde, kendi içinde kayar (§2.11) |
| "AR-GE çalışılan gün" | sayı | `arge_gun`; **her zaman görünür**; yer tutucu "yok". Not: "Varsayılan yoktur (boş = 0). Girilirse GV teşviki %<eşik> ve üzeri olan (AR-GE) kişilerde (eşik: Parametreler → Genel), kişiye Aylık Girdiler'den gün girilmemiş aylarda kullanılır. Kişiye girilen gün her zaman önceliklidir." |
| "05510 indirim oranı (%) — 05510 dışı kanunlu kişilerde de uygulanır" | sayı (%) | `tesvik.k05510` (×100 gösterilir, ÷100 saklanır); yer tutucu yılın `t05510` parametresi (yoksa 0,02 → "2"). Not: "İmalat işyeri 5, diğerleri 2. Boş = yılın parametresi. AR-GE (05746) ve engelli (14857) kişilerin 05510 payı bu oranla hesaplanır; "05510 - %5" türündeki kişiler zaten %5 alır." |
| Açıklama (`aciklama`) | metin | |

**Onaylı çalışma:** Ad, bütün ayar kutuları (`[data-ayar]`) ve iki yöntem kutusu kapalıdır; gövdenin başında mavi kutu: "🔒 Onaylı çalışma kilitlidir. Ayarları değiştirmek için Durum'u "Taslak" yapıp kaydedin, sonra yeniden açın. Hesap, onay anındaki giriş/çıkış tarihleriyle yapılır. Taslağa alınırsa personel kartındaki güncel tarihler geçerli olur ve maliyet değişebilir." Kaydedince yalnız durum ve açıklama yazılır.

**Kaydet** (`form` içindeki `[data-kaydet]`):
1. Çalışma kilitli değilse önce ayarlar: `ayarOku` her `[data-ayar]` kutusunu okur (boş → `null`, değilse `API.trSayi(değer) ÷ çarpan`); `API.calismaAyarYaz` boş olanın kaydını siler (yılın değerine döner), doluyu yazar. Ayarlar, çalışma bu kayıtla `ONAYLI`'ya alınacaksa da kilitlenmeden önce yazılır.
2. `API.calismaKaydet`: ad, durum, zam yöntemi, açıklama. Onaylı kalan çalışmada ad ve zam yöntemi değişmez.
   - **Taslak → Onaylı:** kişilerin giriş/çıkış tarihleri (`onay_sabit = 1`) ve yılın parametreleri (`calisma_parametre`) çalışmaya dondurulur; bundan sonra Parametreler ekranındaki değişiklik bu çalışmayı etkilemez.
   - **Onaylı → Taslak:** dondurulmuş tarihler ve parametreler silinir; kişi kartındaki güncel tarihler ve yılın güncel parametreleri geçerli olur.
   - İşlem kaydı `GUNCELLE` (durum değiştiyse "durum <eski> → <yeni>" eki).
3. Pencere kapanır; üst çubuk ve ekran yeniden çizilir.

Ayarların hesaba etkisi: 02 — Hesap Motoru, "Çalışmaya özel ayarlar — `calisma_ayar`"; anahtarların listesi: 01 — Veri Modeli ve Depolama, "`calisma_ayar`".

⚠ Bu pencere zam kademesi, yuvarlama adımı, gün, AR-GE günü ve 05510 oranı dışındaki çalışma ayarlarını göstermez; motorun okuduğu `tesvik.k05746 / k14857 / k15510` anahtarlarının ekranda girişi yoktur (`KOPYA` / revize ile, örnek veriyle ya da dışarıdan gelir). `mesai.ongoru` Fazla Mesai Planı ekranından, `dagilim.*` Maaş Dağılımı'ndan yazılır.

---

### 3.9 Excel Raporu

**Kaynak:** `js/modules/excel.js` (`ciz`, `aktar`, `oku`, `hucre`, `onizlemeHtml`; sabitler `ZAM_SAYFA`, `B_TC`, `B_DUZ`, `B_MIK`, `B_ORAN`, `B_ONG`, `MASKELI_TC`); `api.js:calismaHesapla, calismaOzetOku, calismaPersonelAlanYaz, topluIslem, log`. Dışa açık: `window.EXCEL_RAPOR = { aktar, oku }`.
**Yer:** İçe / Dışa Aktarma → 📤 Excel Raporu. Sayfa başlığı "Excel Raporu", alt başlık "Bütçeyi Excel olarak alın; yönetimin düzeltmelerini dosyadan geri yükleyin".
**Yetki:** `excel.aktar` (menü ve çıktı). İçeri alma kartı: çalışma yazılabilir (`API.calismaYazilabilir`, §0) + `zam.yaz`. **Tümü:** hayır (§1.6).

**Amaç:** Yönetime gidecek üç sayfalık Excel'i üretmek; yönetimin düzeltme yazıp geri gönderdiği dosyadaki değişiklikleri önizleyip onaylanınca çalışmaya almak.

**Kart 1 — "Excel Raporu":** açıklama "<yıl> · <grup> · <çalışma adı>. Tutarlar net maaştır."; sağda **Excel'e Aktar** (`#aktarBtn`). Madde listesi (aynen):
- "**ZAM ÇALIŞMASI** sayfasında sarı **DÜZELTME** sütunu yönetimin yazacağı yerdir; zam miktarı, <yıl> maaşı ve zam oranı Excel'de anında güncellenir."
- "Yönetim isterse zam miktarını ya da oranını doğrudan da yazabilir; program içeri alırken bunu tanır."
- "Maliyet sütunları programın hesabıdır; düzeltmeler içeri alınınca yeniden hesaplanır."
- "T.C. sütununu silmeyin, satırların eşleşmesi buna göre yapılır."

**Excel'e Aktar** → `aktar(c)` (dosya düzeni §4.1). Hata: "Excel oluşturulamadı: <hata metni>" (bildirim). Onaylı çalışmada da alınabilir; görüntüleme kipinde de çalışır (`excel.aktar` yazma yetkisi değildir, §2.2).

**Kart 2 — "Yönetimden Dönen Excel'i İçeri Al"** (yalnız yazılabilir + `zam.yaz`): açıklama "Önce değişiklikler listelenir; onaylamadan hiçbir şey yazılmaz."; sağda **Dosya seç…** (gizli dosya alanı `#iceDosya`, `accept=".xlsx"`). Dosya seçilince `oku(c, dosya)` (kurallar §4.1.4) → sonuç modül belleğinde (`onizleme`) tutulur ve ekran tazelenir. Okuma hataları bildirimle gösterilir.

**Önizleme** (`#onizleme`; yalnız önizlemenin çalışması seçili çalışmaysa çizilir, başka ekrana gidip dönünce de durur):
- Bilgi kutusu (değişen varsa mavi `uyari-bilgi`, yoksa yeşil `uyari-basari`, simge ℹ): "**<dosya adı>**: N kişi okundu, **K** kişide değişiklik var." + çalışmada bulunmayan T.C. varsa "<br>M T.C. bu çalışmada yok: <dosyadaki ad ya da T.C.>, …".
- Uyarılar varsa sarı kutu (⚠), en çok 10 satır: "<Ad Soyad>: dosyadaki öngörü (X) programdakinden (Y) farklı — parametreler değişmiş olabilir."
- Değişen varsa tablo (`C.tablo`):

| Başlık | İçerik |
|---|---|
| Ad Soyad | programdaki ad |
| Bölüm | bütçe bölümü etiketi ("08 PAZARLAMA" biçimi, `API.bolumEtiket`; küçük yazı) |
| Kaynak | değerin nereden alındığı (küçük, soluk): "oran %X" / "zam miktarı" / "düzeltme" |
| Düzeltme (eski → yeni) | `mevcut düzeltme → **yeni düzeltme**` (`B.tlDuz`) |
| Zam (eski → yeni) | `mevcut zam miktarı → **öngörü + yeni düzeltme**` |
| Yeni oran | (öngörü + yeni düzeltme) / önceki yıl maaşı (`B.oran`) |

- Düğmeler: değişen varsa **K Değişikliği Uygula** (`#uygulaBtn`) · **Vazgeç** (`#vazgecBtn`); yoksa yalnız **Kapat** (`#vazgecBtn`). Vazgeç / Kapat önizlemeyi siler, ekranı tazeler.

**Uygula:** tek veritabanı işleminde (`API.topluIslem`) her değişen kişi için `API.calismaPersonelAlanYaz(c.id, tc, 'duzeltme', yeniDüzeltme)` (yalnız `duzeltme` alanı; `zam.yaz` ve yazma kilidi ister); işlem kaydı `ICE_AKTAR` ("<dosya>: K düzeltme"); bildirim "K kişinin düzeltmesi güncellendi." (başarı); önizleme silinir ve **Personel ve Zam** ekranına gidilir (`APP.git('personel')`).

---

### 3.10 Personel İçe Aktarma

**Kaynak:** `js/modules/aktarim.js` (`ciz`, `sablonIndir`, `SABLON`, `oku`, `onizlemeHtml`, `bagla`, `sozluk`; modül belleği `durum`); `css/butce.css` (`.adimlar`); `js/core/tablooku.js` (`TO`, §4.0); `api.js:aktarimSozluk, AKTARIM_ALANLARI, erpAktar, tcBaskaGrupta, calismaPersonelListe`. Sınama için dışa açık: `window.AKTARIM_TEST.oku`.
**Yer:** İçe / Dışa Aktarma → ⇩ Personel İçe Aktarma (`aktarim`). Sayfa başlığı "Personel İçe Aktarma", alt başlık "Personel listesini (Excel / CSV ya da ERP / bordro programı çıktısı) bütçeye alın".
**Yetki:** `personel.yaz` (menü). Çalışma yazılabilir değilse (onaylı ya da grupta yazma yok) içerik yerine sarı kutu: "ℹ Bu grupta aktarım yetkiniz yok ya da çalışma onaylı (kilitli)." **Tümü:** hayır (§1.6).

**Amaç:** Elde tutulan bir personel listesindeki (Excel / CSV ya da ERP / bordro programı çıktısı) güncel (gerçekleşen) net maaşları ve personel bilgisini çalışmaya almak. Listedeki net maaş, çalışmanın **önceki yıl maaşı** (`maas_eski`) olur; zam öngörüsü bunun üzerine kurulur. Önceki yılın gerçekleşen maliyeti de (`maliyet_onceki`) buradan gelebilir. Program dış sisteme hiçbir şey yazmaz; liste dosya ya da yapıştırma ile verilir (doğrudan bağlantı kurulursa yalnız `oku`'nun kaynağı değişir, önizleme ve `API.erpAktar` aynı kalır).

**Kart:** başlık "Personel İçe Aktarma — <yıl> · <grup>"; açıklama "Elinizdeki personel listesini (Excel, CSV ya da ERP / bordro programı çıktısı) bu bütçeye alın. Listedeki net maaşlar bu çalışmanın **<yıl − 1> maaşı** olur; zam öngörüsü bunun üzerine uygulanır. Sütunlar başlık adından tanınır, sıra önemli değildir."

**Adımlar** (`ol.adimlar`: numaralı, yuvarlak sayı rozetli liste):
1. "**Listenizi hazırlayın.** Kendi dosyanızı kullanabilir ya da örnek şablonu indirip doldurabilirsiniz." + **⇩ Örnek Excel şablonunu indir** (`#sablonBtn`, küçük ikincil) → `sablonIndir(c)` (dosya düzeni §4.2; hata bildirimle).
2. "**Dosyayı seçin** ya da tabloyu yapıştırın."
3. "**Önizlemeyi kontrol edin**, eklenecek yeni kişileri işaretleyin ve *Aktarımı Uygula* deyin."

Ardından iki sütunlu ızgara:
- Sol: alan "Personel listesi (.xlsx / .csv)" (`label for="dosya"`) — dosya alanı `#dosya`, `accept=".xlsx,.csv,.txt"`; altında soluk not "Tanınan başlıklar: T.C., Ad Soyad, İşe Giriş, Çıkış, Bölüm, Ekip, Görev, Net Maaş, Yaka, Bütçe Bölümü, Gerçekleşen Maliyet (sütun adları Tanımlar → İçe Aktarma Başlıkları'ndan değiştirilebilir). Yalnızca T.C. zorunludur; boş sütunlar mevcut bilgiye dokunmaz." (alan adları `API.aktarimSozluk().etiket` sırasından üretilir; "Tanımlar → İçe Aktarma Başlıkları" yalnız yönlendirme metnidir, bağlantı değildir — §3.12.5).
- Sağ: alan "…ya da Excel'den kopyalayıp yapıştırın (başlık satırıyla birlikte)" — metin kutusu `#yapistir` (4 satır, yer tutucu "TC⇥Ad Soyad⇥Net Maaş…") + **Yapıştırılanı oku** (`#yapistirBtn`, küçük ikincil).

**Okuma** (`oku`): dosya seçilince (`change`) `TO.dosyaSatirlar`, düğmeyle `TO.metinSatirlar`; ardından `TO.eslestir(satırlar, API.aktarimSozluk().sozluk, ['tc'])` (o anki geçerli sözlükle) ve satır dönüştürme (§4.2). Kaynak adı: dosya adı ya da "yapıştırılan tablo". Hatalar (bildirim): "Başlık satırında T.C. sütunu bulunamadı." (boş yapıştırma da bu hatayı verir) · "Geçerli T.C. içeren satır bulunamadı." · `TO` hataları ("Eski .xls biçimi okunamıyor. Dosyayı Excel'de .xlsx olarak kaydedin ya da tabloyu kopyalayıp yapıştırın." · "Dosyada sayfa yok." · "Excel kütüphanesi yüklenemedi."). Okunan liste modül belleğinde (`durum`) çalışma kimliğiyle tutulur; seçili çalışma değişirse atılır.

**Önizleme** (`#sonuc`, `onizlemeHtml`; karşılaştırma bu çalışmanın satırlarıyla, `API.calismaPersonelListe`):
- Mavi bilgi kutusu: "**<kaynak>**: N satır okundu. Tanınan sütunlar: " + her eşleşen alan için mavi rozet "<etiket> ← <dosyadaki başlık>"; maaş sütunu eşleşmediyse "<br>**Net maaş sütunu tanınmadı** — maaşlar güncellenmeyecek."
- Dört sayı kutusu (`.stat`): **Güncellenecek** (çalışmada olup en az bir alanı farklı) · **Değişiklik yok** · **Çalışmada yok (yeni)** · **Dosyada yok** (çalışmada olup listede olmayan).
- **"Güncellenecekler"** tablosu: Ad Soyad (programdaki) · Değişen — her farklı alan ayrı satırda "**<alan>**: <eski> → **<yeni>**". Karşılaştırılan alanlar ve koşulları:

| Etiket | Ne zaman "farklı" | Gösterim |
|---|---|---|
| Net maaş | listede maaş var ve `|maaş − maas_eski| > 0,004` | 2 ondalık (`B.tlDuz(…, 2)`) |
| Maliyet | listede maliyet var ve `|maliyet − maliyet_onceki| > 0,004` | kuruşsuz |
| Ad | listede ad var ve boşluğu sadeleştirilmiş hâli (`U.bicimAd`) programdakinden farklı | metin |
| İşe giriş | listede tarih var ve farklı | GG.AA.YYYY |
| Çıkış | listede tarih var ve farklı | GG.AA.YYYY (programda yoksa "—") |
| Yaka | listede `M` ya da `B` var ve farklı | `B` / `M` |
| Bölüm, Görev, Ekip | listede değer var ve programdakinden farklı | metin (programda yoksa "—") |

- **"Bu çalışmada olmayanlar (N)"** (varsa): not "İşaretlediğiniz kişiler bu gruba eklenir (hesaplama türü SSK, yaka dosyadan ya da beyaz). Başka gruba ait personeli işaretlemeyin." Altında onay kutusu **Tümünü seç** (`#yeniHepsi`) + soluk "(bu yıl başka bir grupta kayıtlı olanlar hariç)": işaretlenince listedeki bütün yeni kişileri — bu yıl başka bir grubun çalışmasında kayıtlı olanlar **hariç** — işaretler, kaldırılınca hepsinin işaretini kaldırır; kutu, işaretlenebilecek herkes işaretliyse işaretli gelir. Tablo: (onay kutusu; işaret `durum.yeni`'de tutulur, ekran yeniden çizilse de kalır) · T.C. (eş aralıklı yazı; `B.tc` → `alan.tc` yoksa maskeli, §2.8) · Ad Soyad · Bölüm · Net Maaş (`B.tl`) · aynı yıl başka bir grubun çalışmasında kayıtlıysa sarı rozet "bu yıl başka bir grupta kayıtlı" (`API.tcBaskaGrupta`; hangi grup olduğu söylenmez).
- **"Çalışmada olup dosyada olmayanlar"** (varsa): not "Bunlara dokunulmaz. Ayrıldılarsa kişi kartına çıkış tarihi girin." + adlar virgülle.
- Düğmeler: **Aktarımı Uygula** (`#uygulaBtn`; güncellenecek de yeni de yoksa kapalı) · **Vazgeç** (önizlemeyi siler, ekranı tazeler).

**Uygula** (`bagla`): onay penceresi — başlık "Personel İçe Aktarma"; mesaj "<Güncellenecek sayısı> kişi güncellenecek[, <işaretli sayısı> kişi eklenecek]."; detay "Net maaşlar bu çalışmanın önceki yıl maaşı olur; zam ve maliyet yeniden hesaplanır. Önce yedek almanız önerilir."; evet düğmesi **Uygula**. Onaylanınca `API.erpAktar(c.id, satırlar, işaretliler)` (yazma kuralları §4.2) → bildirim "<guncel> kişi güncellendi, <eklenen> kişi eklendi." (başarı) → önizleme silinir, **Personel ve Zam** ekranına gidilir. API hatası bildirimle gösterilir; tek işlem olduğu için hiçbir satır yazılmaz (örn. "<T.C.>: yeni personelin adı dosyada yok.").

⚠ Onaydaki "güncellenecek" sayısı yalnız farklı alanı olanlardır; `erpAktar`'ın döndürdüğü `guncel` ise listede bulunan **bütün** mevcut kişileri sayar (değişmeyenler dâhil). Bitiş bildirimindeki sayı bu yüzden önizlemedekinden büyük olabilir.

---

### 3.11 Parametreler

**Kaynak:** `js/modules/parametre.js` (`ciz`, `ongoruKarti`, `ongoruOku`, `ongoruBagla`, `ay`); `api.js:PARAMETRE_TANIM, ZAM_TANIM, yillar, parametreOku, parametreSayi, parametreYaz, asgariListe, asgariYaz, sakatlikListe, sakatlikYaz, dilimListe, dilimYaz, performansListe, performansYaz, parametreDurumu, parametreDurumYaz, ongoruHesapla, ongoruUygula, yilOnayliCalismalar, hesapParametre`.
**Yer:** Tanımlar → ⚙ Parametreler. Sayfa başlığı "Parametreler", alt başlık "Yıllık oranlar, asgari ücret, vergi tarifesi, zam kademesi".
**Yetki:** `parametre.oku`. Değiştirmek ve "Yeni Yıl Öngörüsü" kartı `parametre.yaz` ister; yetki yoksa bütün kutular `disabled`, kaydet / ekle / 🗑 düğmeleri ve öngörü kartı hiç çizilmez. **Gruplar:** parametreler yıl bazındadır, bütün grupları etkiler; ekran grup seçimi istemez (`calismaGerekli` yok). **Tümü:** çalışır.
**Yıl:** üst çubuktaki yıl (`APP.yil()`; yoksa `API.yillar()[0]`, o da yoksa bu takvim yılı). Ekrandaki yıl seçici (`#prmYilSec`) ayrı bir seçim değildir: değişince `APP.secimYap(yıl, null)` ile **üst çubuğun yılını** değiştirir; böylece ekranda görülen yıl ile öngörünün yazdığı yıl hiç ayrışmaz.

**Amaç:** Yılın yasal ve genel parametreleri (asgari ücret, gelir vergisi tarifesi, sakatlık indirimi, SGK / vergi / teşvik oranları, fazla mesai katsayıları, AR-GE günü eşiği, zam öngörüsü yuvarlaması, zam kademesi, performans kademeleri) ve resmî rakamlar açıklanmadan önce yeni yıl için öngörü oluşturma. Yılın değerlendirme modeli de bir yıl parametresidir (`perf.model`) ama bu ekranda değil, Performans Değerlendirme → **Değerlendirme modeli…** penceresinden düzenlenir (§3.6.2). Parametrelerin hesaptaki anlamı için bkz. "02 — Hesap Motoru"; tabloların yapısı için "01 — Veri Modeli ve Depolama".

Kartlar yukarıdan aşağı şu sıradadır.

**Kart 1 — "Yeni Yıl Öngörüsü" (yalnız `parametre.yaz`)**

Açıklama: "Resmî rakamlar açıklanmadan bütçe yapabilmek için: piyasa beklentisine göre bir artış oranı girin; önceki yılın asgari ücreti, gelir vergisi dilimleri ve sakatlık indirimi bu oranla artırılır. SGK tavanı ve asgari ücret istisnaları asgari ücretten kendiliğinden hesaplanır. Diğer oranlar (SGK primleri, damga vergisi, zam kademesi…) önceki yıldan kopyalanır."

Form (`#ongoruForm`, 4 sütunlu ızgara):

| Alan (`name`) | Tür | Varsayılan / not |
|---|---|---|
| Kaynak yıl (esas alınan) (`kaynakYil`) | seçim (`API.yillar()`) | Seçili yıl − 1 listede varsa o; yoksa seçili yıl listede varsa seçili yıl; yoksa listedeki en küçük yıl. Değişince "Hedef yıl" kendiliğinden kaynak + 1 olur (`ongoruBagla`). |
| Hedef yıl (bütçe yılı) (`hedefYil`) | sayı | kaynak + 1 |
| Genel artış oranı (%) (`oran`) | metin, sağa hizalı, kalın | `30`. Not: "Aşağıdaki kalemlere ayrı oran yazılmazsa hepsine bu uygulanır." Boşsa hata "Genel artış oranını girin." |
| Ara dönem artışı — ay (`araAy`) | seçim Şubat…Aralık | Temmuz (7) |
| Ara dönem artışı — oran (`araOran`) | metin, 80 px, yer tutucu "% yok" | `0` (yer tutucu bu yüzden ilk açılışta görünmez). Not: "Yıl içinde asgari ücrete ikinci bir artış beklentisi (boş = yok). Ocak'taki tutar üzerine uygulanır." 0 ya da boş = ara artış yok. |

Açılır bölüm **"Kalem bazında farklı oran ve yuvarlama"** (`<details>`; önizlenmiş durumda kalem oranlarından biri doluysa açık gelir), `#ongoruEk`:

| Alan | Not |
|---|---|
| Asgari ücret artışı (%) (`oranAsgari`) | yer tutucu "genel oran"; boş = genel oran |
| GV dilimleri artışı (%) (`oranDilim`) | aynı |
| Sakatlık indirimi artışı (%) (`oranSakatlik`) | aynı |
| Yuvarlama — Dilim (`dilimAdim`) | 1 TL · 100 TL · **1.000 TL** (varsayılan) · 10.000 TL |
| Yuvarlama — Sakatlık (`sakatlikAdim`) | 1 TL · 10 TL · **100 TL** (varsayılan) |

Yüzde alanları `API.trSayi(v) / 100` ile ondalığa çevrilir (`ongoruOku`); ekranda `%` işaretsiz, "30" ya da "12,5" biçiminde gösterilir.

Düğmeler:
- **Önizle** (ikincil) → `API.ongoruHesapla(s)`; sonuç modül belleğinde (`ongoruDurum`) tutulur ve ekran tazelenir. Hatalar bildirim olarak: "<kaynak> yılının asgari ücreti yok." · "<kaynak> yılının gelir vergisi dilimleri yok; kaynak yılı kontrol edin." · "<kaynak> yılının sakatlık indirimi tutarları yok; kaynak yılı kontrol edin."
- Önizlemeden sonra **<hedef> parametrelerini oluştur** (birincil) görünür.
- Hedef yılın asgari ücreti zaten varsa (`parametreDurumu(hedef).var`) düğmelerin yanında turuncu yazı: "⚠ <hedef> parametreleri zaten var; uygularsanız asgari ücret, dilimler ve sakatlık tutarları üzerine yazılır (diğer oranlara dokunulmaz)."

Önizleme tablosu (`tablo-sar` içinde):

| Kalem | `<kaynak>` | `<hedef>` (öngörü) | Artış | (not) |
|---|---|---|---|---|
| Asgari ücret (Ocak) | kaynak yılın **son** dönemi brütü | yuvarlanmış artırılmış tutar (kuruş) | `B.oran(hedef / kaynak − 1)` | kaynakta birden çok dönem varsa "<kaynak> son dönemi (<ay>) esas alındı" |
| Asgari ücret (<ay> ara artışı) — yalnız ara oran > 0 ve ay > Ocak | hedef Ocak tutarı | Ocak × (1 + ara oran) | | "ara dönem" |
| SGK tavanı (Ocak) | kaynak brüt × kaynak yılın `tavan_carpan`'ı | hedef Ocak × aynı çarpan | | "asgari ücretten türer" |
| GV N. dilim üst sınırı (%oran) — her dilim | kaynak üst sınır | `dilimAdim`'a yuvarlanmış artırılmış sınır | | son dilimde iki sütun "sınırsız" (soluk), not "sınırsız" |
| Sakatlık indirimi N. derece — her derece | kaynak tutar | `sakatlikAdim`'a yuvarlanmış tutar | | — |

Tutarlar `B.tl(x, 2)`; hedef sütunu kalın.

**Oluştur** → onay penceresi (`C.onay`): başlık "<hedef> Öngörüsü"; mesaj "<kaynak> yasal parametrelerine **%X** artış uygulanarak **<hedef>** parametreleri oluşturulacak[ (<ay> ara artışı %Y)]."; hedefin parametresi varsa sarı detay "<hedef> parametreleri zaten var: asgari ücret, GV dilimleri ve sakatlık tutarlarının üzerine yazılacak. <hedef> çalışmalarının bütün hesapları değişir."; evet düğmesi **Oluştur**. Onaydan önce form yeniden okunur (önizlemeden sonra alan değiştirildiyse **yeni** değerler uygulanır).
- `API.ongoruUygula` hataları: "Hedef yıl kaynak yıldan büyük olmalı." · "<hedef> yılında onaylı bir çalışma var; o yılın parametreleri öngörüyle değiştirilemez. Hedef yılı kontrol edin (örneğin kaynak <hedef>, hedef <hedef + 1>)." · "Artış oranı geçersiz." (oran −%100 ile %500 aralığı dışında) · ayrıca önizlemedeki üç hata.
- Yazılanlar: hedef yılda olmayan yasal dışı tablolar (genel oranlar ve ayarlar, değerlendirme modeli `perf.model`, hesaplama türleri, zam kademesi, performans kademeleri) kaynaktan kopyalanır; asgari ücret, GV dilimleri ve sakatlık tutarları silinip öngörüyle yeniden yazılır; `parametre` tablosuna `durum = ONGORU` ve `ongoru.*` anahtarları (kaynak yıl, oranlar, ara ay/oran, yuvarlama adımları, tarih) yazılır. İşlem kaydı `ONGORU`.
- Başarı: "<hedef> parametreleri öngörüyle oluşturuldu." (başarı bildirimi); önizleme belleği silinir ve **üst çubuk hedef yıla geçer** (`APP.secimYap(hedef, null)`).

**Kart 2 — "Parametreler — <yıl>"**

Başlık satırı: açıklama "Değişiklikler o yılın bütün gruplardaki çalışmalarını etkiler." Sağda: yıl seçimi `#prmYilSec` (seçenekler `API.yillar()`; liste boşsa yalnız seçili yıl) · durum rozeti: öngörüdeyse turuncu **Öngörü** (`rz-ongoru`), değilse yeşil **Resmî** (`rz-yesil`) · öngörüdeyse ve `parametre.yaz` varsa **Resmî rakamlar girildi** (ikincil, küçük).
- **Resmî rakamlar girildi** → onay "Resmî Rakamlar" — "<yıl> yasal parametreleri **resmî** olarak işaretlenecek." / detay "Asgari ücret, gelir vergisi dilimleri ve sakatlık indirimini açıklanan resmî rakamlarla düzelttiğinizden emin olun." / **Resmî olarak işaretle** → `API.parametreDurumYaz(yıl, 'RESMI')`, "Kaydedildi.", tazele. Değerleri kendisi değiştirmez; yalnız durum anahtarını yazar.

Kartın üstündeki bantlar (koşula göre, sırayla):
1. Yılın onaylı çalışması varsa (`API.yilOnayliCalismalar`; bütün gruplar) mavi bilgi kutusu: "🔒 **<yıl> yılının onaylı çalışmaları kilitli:** <grup adı · çalışma adı>, …. Bunlar onay anındaki parametrelerle hesaplanır; burada yapılan değişiklik (örn. Ocak'ta resmî rakamlar) onlara **yansımaz**, yalnız taslak ve revize çalışmaları etkiler. Resmî rakamlarla yeni hesap için **Bütçe Çalışmaları → Revize aç**."
2. Yıl öngörüdeyse sarı kutu: "⚠ **<yıl> yasal parametreleri öngörüdür.** <kaynak yıl> değerlerine %X artış uygulandı[, <ay> ayında %Y ara artış öngörüldü]. Resmî rakamlar açıklanınca aşağıdaki değerleri düzeltip "Resmî rakamlar girildi" düğmesine basın." (oranlar 1 ondalık)
3. `API.hesapParametre(yıl)` hata verirse kırmızı kutu: hata metni ("<yıl> yılının gelir vergisi dilimleri girilmemiş." ya da "<yıl> yılının asgari ücreti girilmemiş."); asgari ücret, dilim ya da sakatlık tablolarından biri boşsa ek satır: "<yıl> yılının yasal tabloları (asgari ücret ✓|yok, gelir vergisi dilimleri ✓|yok, sakatlık indirimi ✓|yok) eksik. Üstteki **Yeni Yıl Öngörüsü** ile <yıl − 1> → <yıl> oluşturun ya da aşağıya elle girin."

İki sütunlu ızgara:

**Sol — "Genel"** tablosu (`#genel`, `API.PARAMETRE_TANIM`'dan çizilir; satır = etiket · kutu · birim):

| `anahtar` | Etiket (aynen) | Birim | Varsayılan |
|---|---|---|---|
| `tavan_carpan` | SGK tavan çarpanı | × asgari ücret | 9 |
| `dv` | Damga vergisi oranı | oran | 0,00759 |
| `istisna_kesinti` | Asgari ücret GV matrahı kesintisi (SGK %14 + işsizlik %1) | oran | 0,15 |
| `bes_orani` | BES kesinti oranı | oran | 0,03 |
| `t05510` | 05510 indirimi — varsayılan (gruba özel oran: Bütçe Çalışmaları → ✎) | oran | 0,02 |
| `t05746` | 05746 AR-GE SGK teşvik oranı (işveren %19,75 × ½) | oran | 0,09875 |
| `t14857` | 14857 engelli teşvik oranı | oran | 0,1975 |
| `t15510` | 15510 teşvik oranı | oran | 0,05 |
| `arge_gv_esik` | AR-GE günü varsayılanının uygulandığı en düşük GV teşvik oranı | oran | 0,8 |
| `mesai_fm1_kat` | Hafta içi fazla mesai katsayısı | × saat ücreti | 1,5 |
| `mesai_fm2_kat` | Hafta sonu / tatil mesaisi katsayısı | × saat ücreti | 2 |
| `mesai_gun_saat` | Saat ücretinde günlük çalışma saati (net maaş / 30 / saat) | saat | 7,5 |
| `zam_yuvarla` | Zam öngörüsü yuvarlama adımı (çalışmaya özel de girilebilir) | TL | 10 |

- Değer yoksa varsayılan gösterilir (`API.parametreSayi`). Kutular `.hucre-girdi` (120 px). Gösterim: ondalıklı değer 6 haneye kadar yazılıp sondaki sıfırlar atılır (`0,00759`); tam sayıya dokunulmaz.
- Oranlar **ondalık** yazılır (yüzde değil: `0,15`; AR-GE eşiği `0,8` = %80).
- Son beş satır hesabın genel ayarlarıdır (motordaki karşılıkları `P.argeEsik`, `P.mesaiKat1`, `P.mesaiKat2`, `P.gunlukSaat`, `P.zamYuvarla`; "02 — Hesap Motoru"): net mesai = net maaş / 30 / günlük saat × katsayı × saat (hafta içi `fm1` ve hafta sonu `fm2` ayrı); çalışmanın AR-GE günü ayarı yalnız GV teşvik oranı bu eşik ve üzerindeki kişilere uygulanır; zam öngörüsü bu adımın en yakın katına yuvarlanır (Çalışma Ayarları'nda çalışmaya özel adım girilmişse o geçerlidir, §3.8.2). Onaylı çalışmalar bunları da onay anındaki değerleriyle kullanır.
- Her kutu ayrı kaydedilir: `change` olayında değer değiştiyse `API.parametreYaz(yıl, anahtar, trSayi(v))` → "Kaydedildi." (başarı) ve ekran tazelenir.

**Sağ üst — "Asgari Ücret (brüt)"** (`#asgari`): sütunlar "Geçerli olduğu ay" (ay seçimi) · "Brüt" · (🗑). Ocak satırında 🗑 yoktur; sonradan eklenen satırlarda vardır. 🗑 satırı yalnız ekrandan kaldırır (kaydetmeden kalıcı olmaz).
- **+ 2. dönem ekle** (ikincil): ayı Temmuz, brütü boş yeni satır.
- **Asgari ücreti kaydet**: bütün satırlar `API.asgariYaz` ile yılın tablosunun yerine yazılır. Ocak satırı yoksa "Ocak ayından geçerli bir asgari ücret girilmeli."

**Sağ alt — "Sakatlık İndirimi (aylık)"** (`#sakatlik`): üç satır "1. derece", "2. derece", "3. derece" + tutar kutusu (kayıt yoksa 0). **Sakatlık tutarlarını kaydet** → `API.sakatlikYaz` (üç derece birlikte yeniden yazılır).

**Kart 3 — "Gelir Vergisi Tarifesi"**

Açıklama: "Ücretliler için. Son dilimin üst sınırı yoktur. Kümülatif matrah üzerinden uygulanır." Tablo `#dilim`:

| Sütun | İçerik |
|---|---|
| Dilim | "1.", "2.", …; yeni eklenen satırda "+" |
| Üst sınır (TL) | kutu; **son satırda** soluk "sınırsız" (kutu yok, gizli boş değer) |
| Oran (%) | kutu (70 px), yüzde olarak (`oran × 100`) |
| (🗑) | yazma yetkisinde her satırda |

- **+ Dilim ekle** (ikincil): sınırı ve oranı boş satır.
- **Tarifeyi kaydet**: satırlar okunur (boş sınır = sınırsız, oran ÷ 100), üst sınıra göre sıralanır (sınırsız en sonda) ve `API.dilimYaz` ile yazılır. Hatalar: "N. dilimin oranı 0 ile 1 arasında olmalı." · "N. dilimin üst sınırı bir öncekinden büyük olmalı." (sınırsız satır son değilse de bu hata çıkar). Kayıtta son dilimin sınırı her zaman boş yazılır.

**Kart 4 — "Aylık Tablo (hesaplanan)"**

Açıklama: "Asgari ücret ve tarifeden her ay için ayrı türetilir; elle girilmez. GV istisnası asgari ücretin kümülatif matrahından hesaplandığı için matrah üst dilime geçtikçe aydan aya değişir." Salt okunur tablo (yalnız `hesapParametre` hatasızsa): sütunlar (boş) · Oca … Ara; satırlar:

| Satır | Ondalık |
|---|---|
| Asgari ücret | 0 |
| SGK tavanı | 0 |
| Asgari ücret GV istisnası | 2 |
| Asgari ücret DV istisnası | 2 |
| Ayın gün sayısı | tam sayı |

Hesap hatasında kartın yalnız başlığı görünür (hata Kart 2'deki kırmızı kutudadır).

**Kart 5 — "Zam Öngörüsü" ve "Performans Kademeleri"**

Açıklama: "Önceki yıl net maaşı alt eşiğin altındaysa üst oran, üst eşiğin üstündeyse alt oran; arada doğrusal azalır. Buradaki değerler yılın **genel** değeridir; her grubun kendi eşik ve oranları Bütçe Çalışmaları → ✎ Çalışma Ayarları'ndan girilir (gruplar arasında farklı olabilir). Yöntem (kademe / performans) de orada seçilir." (bkz. §3.8)

İki tablo yan yana: **Beyaz Yaka** (`data-zam="B"`) ve **Mavi Yaka** (`data-zam="M"`); satırlar `API.ZAM_TANIM`'dan:

| `anahtar` | Etiket (aynen) | Giriş biçimi | Varsayılan |
|---|---|---|---|
| `alt_esik` | Alt eşik (net) | TL | 50.000 |
| `ust_esik` | Üst eşik (net) | TL | 100.000 |
| `ust_oran` | Alt eşiğin altındaki oran | yüzde, kutunun yanında "%" (70 px) | 30 (= 0,30) |
| `alt_oran` | Üst eşiğin üstündeki oran | yüzde | 25 (= 0,25) |

Parametre anahtarı `zam.<B|M>.<anahtar>`. **Zam parametrelerini kaydet** → sekiz değer `API.parametreYaz` ile tek tek yazılır (adında `oran` geçenler ÷ 100).

Alt başlık **"Performans Kademeleri"**; not: "Kişinin performans puanı bu aralıklara göre çarpana çevrilir (kişi kartında çarpan elle girilmişse o kullanılır)." Tablo `#perf`: Alt puan · Üst puan · Çarpan (80 px kutular) · 🗑. Sıra `alt_puan`. **+ Kademe ekle** (ikincil) · **Kademeleri kaydet** → `API.performansYaz` (yılın kademeleri silinip yeniden yazılır; aralık denetimi yoktur).

**Ortak kayıt davranışı:** toplu kaydet düğmelerinin hepsi `kaydetVe` ile çalışır: başarıda "Kaydedildi." (başarı) ve ekran tazelenir; hatada API metni (hata). Her yazma `parametre.yaz` + yazma kilidi ister (§2.2) ve işlem kaydına (`KAYDET` / `GUNCELLE`) düşer. Onaylı çalışmalar bu değişikliklerden etkilenmez (dondurulmuş parametre; bkz. "01 — Veri Modeli ve Depolama").

---

### 3.12 Tanımlar

**Kaynak:** `js/modules/tanim.js` (`ciz`, `oranAlan`, `turForm`, `kanunForm`, `bolumForm`, `grupForm`, `grupSilSor`, `grupDegisti`, sabitler `KOL`, `KURAL`); `api.js:hesapTuruListe, hesapTuruKaydet, hesapTuruSil, kanunListe, kanunKaydet, kanunSil, grupListe, gorunurGruplar, grupKaydet, grupSil, calismaListe, butceBolumuListe, bolumKisiSayilari, butceBolumuKaydet, butceBolumuSil, butceBolumuBirlestir, aktarimSozluk, aktarimSozlukYaz, AKTARIM_ALANLARI`; `schema.js:BOLUM_TEMIZLE, TEMEL_VERI_YAZ`.
**Yer:** Tanımlar → 📋 Tanımlar. Sayfa başlığı "Tanımlar", alt başlık "Hesaplama türleri, kanun türleri, gruplar, bütçe bölümleri, içe aktarma başlıkları".
**Yetki:** `parametre.oku`; hesaplama türü, kanun türü, bütçe bölümü ve aktarım başlıklarını değiştirmek `parametre.yaz` (bölümde ayrıca o gruba yazma erişimi). **Gruplar** sekmesi yalnız sistem yöneticisine (`sistem.yonet`) görünür ve `parametre.yaz`'dan bağımsızdır. **Tümü:** çalışır (ekranda `calismaGerekli` yok); Bütçe Bölümleri sekmesi bu durumda son seçilen ya da ilk görünür grubu gösterir.
**Yıl:** Hesaplama Türleri ve bölüm kişi sayıları üst çubuktaki yılı kullanır (`APP.yil()`, yoksa `API.yillar()[0]`); ekranda ayrı yıl seçici yoktur.

**Amaç:** Hesabı belirleyen sözlükler: SGK / vergi kesintilerini belirleyen hesaplama türleri, teşvik kuralına bağlanan kanun türleri, bütçe grupları, her grubun bütçe bölümleri ve Personel İçe Aktarma'nın tanıdığı sütun başlıkları. Kodda sabit kalanlar: yetki anahtarları, motorun alan kodları, teşvik kurallarının ve SGK kollarının formülleri (türlerin adı ve oranları düzenlenir), yaka türleri (`B` / `M`), 30 günlük ay ve üç sakatlık derecesi (tutarları Parametreler'de düzenlenir).

**Sekme çubuğu** (`.sekme-cubuk`; sekmeler küçük ikincil düğmelerdir, seçili olan `etkin`: vurgu rengi `--accent` zemin, beyaz yazı):

| Sıra | `data-sekme` | Etiket | Görünürlük |
|---|---|---|---|
| 1 | `tur` | Hesaplama Türleri | herkes |
| 2 | `kanun` | Kanun / Teşvik Türleri | herkes |
| 3 | `grup` | Gruplar | yalnız sistem yöneticisi |
| 4 | `bolum` | Bütçe Bölümleri | herkes |
| 5 | `baslik` | İçe Aktarma Başlıkları | herkes (değiştirmek `parametre.yaz`) |

- Seçili sekme modül belleğinde tutulur (ekran değişse de oturum boyunca kalır). İlk açılışta: kullanıcı sistem yöneticisiyse ve **hiç grup yoksa** `grup`, değilse `tur`. Yönetici olmayan biri için `grup` seçiliyse `tur`'a düşer.
- `ciz(kap, param)` `param.sekme` ile belirli sekmeyle açılabilir; programda bu parametreyi veren bir çağrı yoktur (`APP.git('tanim')` hep son sekmeyle açar).

#### 3.12.1 Hesaplama Türleri (`sekme = tur`)

Açıklama: "Kişi kartında seçilen "Hesaplama Türü" SGK ve vergi kesintilerini belirler. Oranlar <yıl> yılı içindir. SGK'sız türde (huzur hakkı, danışman) yalnızca gelir ve damga vergisi hesaplanır."

Tablo (`API.hesapTuruListe(yıl)`, sıra `sira, kod`):

| Sütun | İçerik |
|---|---|
| Kod | eş aralıklı yazı (`mono`) |
| Ad | |
| SGK Kolu | `SSK` / `SGDP` / `YOK` (kod olarak) |
| SGK İşçi · İşsizlik İşçi · SGK İşveren · İşsizlik İşveren | `B.oran` (örn. `%14,00`) |
| GV · DV · AÜ İstisnası | ✓ / — |
| (düğmeler) | `parametre.yaz` varsa ✎ ve 🗑 |

Boş tablo: "Kayıt bulunamadı." Altında `parametre.yaz` varsa **+ Yeni Hesaplama Türü**. Programla gelen türler: `SSK`, `EMK`, `SGKSIZ` (bkz. "01 — Veri Modeli ve Depolama").

**Pencere — "Hesaplama Türü: <kod>" / "Yeni Hesaplama Türü"** (`turForm`; alt başlık "<yıl> yılı"; varsayılan genişlik):

| Alan (`name`) | Tür | Not |
|---|---|---|
| Kod (`kod`) | metin, `mono` | düzenlemede `readonly`; kayıtta kırpılıp büyük harfe çevrilir |
| Ad (`ad`) | metin | |
| SGK Kolu (`kol`) | seçim | `SSK` "SSK — tüm sigorta kolları" · `SGDP` "SGDP — emekli" · `YOK` "SGK yok (huzur hakkı / danışman)"; yeni türde `SSK` |
| Sıra (`sira`) | sayı | varsayılan 0 |
| SGK işçi (%) · İşsizlik işçi (%) · SGK işveren (%) · İşsizlik işveren (%) | metin, sağa hizalı | **yüzde** girilir (`14`), kayıtta ÷ 100; gösterimde ",00" atılır |
| Gelir vergisi · Damga vergisi · Asgari ücret istisnası | onay kutusu | yeni türde üçü de işaretli |
| Açıklama (`aciklama`) | metin | |

Altlık: **Vazgeç** · **Kaydet** → `API.hesapTuruKaydet(yıl, f)`; başarıda pencere kapanır, ekran tazelenir. Hatalar: "Kod boş olamaz." · "Ad boş olamaz."

**Silme** (🗑): onay "Sil" — "**<kod>** silinecek." (tehlike, **Sil**). Hatalar: "Bu hesaplama türü N kişide kullanılıyor." (o yılın çalışmalarında) · "Bu hesaplama türü N kişinin aylık girdilerinde (yıl içi değişiklik) kullanılıyor."

#### 3.12.2 Kanun / Teşvik Türleri (`sekme = kanun`)

Yıldan bağımsızdır. Açıklama: "Ad serbesttir; hesabı "kural" belirler. Yeni bir kanun kodu eklerken motorun tanıdığı kurallardan birine bağlayın."

Tablo (`API.kanunListe()`, sıra `sira, kod`):

| Sütun | İçerik |
|---|---|
| Kod | `mono` |
| Ad | |
| Kural | `KURAL` etiketi (tanınmayan kural kod olarak) |
| 05510 Oranı | yalnız kuralı `05510` olan satırda: oran varsa `B.oran`, yoksa soluk "yıl parametresi" |
| Açıklama | küçük, soluk |
| (düğmeler) | `parametre.yaz` varsa ✎ 🗑 |

Altında `parametre.yaz` varsa **+ Yeni Kanun Türü**.

**Pencere — "Kanun Türü: <kod>" / "Yeni Kanun Türü"** (`kanunForm`, `dar`):

| Alan | Not |
|---|---|
| Kod (`kod`, `mono`) | düzenlemede `readonly`; kırpılır (büyük harfe çevrilmez) |
| Ad (`ad`) | |
| Kural (`kural`) | `YOK` "Teşvik yok" · `05510` "05510 — işveren prim indirimi (oran aşağıda)" · `05746` "05746 — AR-GE (işveren payının ½ + 05510 indirimi)" · `14857` "14857 — engelli" · `15510` "15510 — emekli %5"; yeni türde `YOK` |
| 05510 indirim oranı (%) (`oran`) | yer tutucu "boş = yıl parametresi"; not "Yalnızca kuralı 05510 olan türde kullanılır: imalat dışı %2, imalat %5."; yüzde girilir, boş = `null`. Alan kuraldan bağımsız hep görünür. |
| Açıklama (`aciklama`) | |
| Sıra (`sira`) | sayı, varsayılan 0 |

**Kaydet** → `API.kanunKaydet`; hata "Kod ve ad zorunludur." **Silme**: onay "Sil" — "**<kod>** silinecek."; kullanımdaysa "Bu kanun türü N kayıtta kullanılıyor." (bütün yılların bütçe satırları + aylık girdiler).

Kuralların hesaptaki karşılığı için bkz. "02 — Hesap Motoru". Programla gelen kanun türleri yalnız `kanun_turu` tablosu **boşken** yazılır (`schema.js:TEMEL_VERI_YAZ`): kullanıcının sildiği ya da değiştirdiği tür program güncellemesinde geri gelmez.

#### 3.12.3 Gruplar (`sekme = grup`; yalnız sistem yöneticisi)

Açıklama: "Bütçe gruplar hâlinde tutulur (örn. birim, işyeri ya da şube); her grubun her yılı ayrı bir çalışmadır ve üst çubuktaki grup düğmeleri bu listeden gelir. Kod kayıttan sonra değişmez; ad ve sıra değiştirilebilir. Sistem yöneticisi dışındaki kullanıcıların yeni grubu görmesi için Kullanıcılar ekranından erişim verin."

Hiç grup yoksa sarı kutu: "ℹ Henüz grup tanımlanmamış. Çalışma ve bütçe bölümü açabilmek için önce bir grup ekleyin."

Tablo (`API.grupListe()`, sıra `sira, ad`; boşsa "Grup yok."):

| Sütun | İçerik |
|---|---|
| Sıra | sayı |
| Kod | `mono` (örn. `OFIS`) |
| Ad | (örn. Ofis) |
| Çalışma | grubun bütün yıllardaki çalışma sayısı (0 çok soluk) |
| Bütçe bölümü | grubun bölüm sayısı (0 çok soluk) |
| (düğmeler) | ✎ (ipucu "Ad / sıra") · 🗑 (ipucu "Sil") |

Altında **+ Yeni Grup**.

**Pencere — "Yeni Grup" / "Grup: <ad>"** (`grupForm`, `dar`):

| Alan | Not |
|---|---|
| Kod (`kod`, `mono`, yer tutucu "örn. OFIS") | yeni grupta not "2–20 karakter: harf, rakam, tire, alt çizgi. Kaydedildikten sonra değiştirilemez."; düzenlemede `readonly`, not "Kod değiştirilemez." |
| Ad (`ad`, yer tutucu "örn. Ofis") | |
| Sıra (`sira`, sayı, en az 1) | yeni grupta en büyük sıra + 1; not "Üst çubukta ve listelerde gruplar bu sıraya göre dizilir." |

**Kaydet** → `API.grupKaydet({kod, ad, sira}, düzenleme)`; başarıda pencere kapanır, "Grup eklendi." / "Grup güncellendi." (başarı), ardından `grupDegisti`. Kod işlemi: kırpılır, **Türkçe kurala göre** büyük harfe çevrilir (`toLocaleUpperCase('tr-TR')`), boşluklar `_` olur; desen `^[A-Z0-9_ÇĞİÖŞÜ-]{2,20}$`. Hatalar: "Grup kodu 2–20 karakter olmalı; harf, rakam, tire ve alt çizgi kullanın." · ""TUMU" kodu ayrılmıştır (üst çubuktaki "Tümü" seçimi); başka bir kod seçin." · "Grup adı boş olamaz." · "Bu kodla bir grup zaten var." · (düzenlemede) "Grup bulunamadı." Yeni grupta sıra boşsa en büyük + 1; düzenlemede boş sıra 0 olur.

**Silme** (🗑, `grupSilSor`):
- Grubun çalışması varsa pencere açılmaz, hata bildirimi: "<ad> grubunun N bütçe çalışması var; grup silinmeden önce çalışmaları Bütçe Çalışmaları ekranından silin." (API ayrıca "Bu grubun N bütçe çalışması var; önce çalışmaları silin." diye reddeder.)
- Yoksa onay "Grubu Sil" — "**<ad>** (<kod>) grubu silinecek." / detay "Grubun bütçe bölümü tanımları ve kullanıcıların bu gruba erişim kayıtları da silinir." / **Sil** (tehlike) → `API.grupSil` → "Grup silindi." (başarı) → `grupDegisti`.

**`grupDegisti` (üst çubukla eşleme):** ekleme / düzenleme / silmeden sonra üst çubuğun seçili grubu hâlâ geçerli mi bakılır ("Tümü" için en az iki görünür grup gerekir). Geçersizse ve görünür grup varsa yeni eklenen gruba (yoksa ilk gruba) geçilir (`APP.secimYap(null, kod)`); aksi hâlde yalnız üst çubuk yeniden çizilir (`APP.calismaSeciciCiz`) ve ekran tazelenir. Son grup silinirse üst çubukta "Henüz grup yok — Tanımlar → Gruplar sekmesinden ekleyin" yazısı çıkar (§1.5).

#### 3.12.4 Bütçe Bölümleri (`sekme = bolum`)

**Görülebilen grup yoksa** sarı kutu:
- sistem yöneticisine: "ℹ Henüz grup tanımlanmamış. Bütçe bölümleri bir gruba bağlıdır; önce **Gruplar** sekmesinden bir grup ekleyin." + **Gruplar sekmesine geç** (küçük düğme; sekmeyi `grup` yapar ve tazeler);
- diğer kullanıcılara: "ℹ Size atanmış bir grup yok. Sistem yöneticinizden grup erişimi isteyin."

**Grup varsa:** üstte "Grup:" seçimi (`#grupSec`, görünür gruplar; üst çubukta tek grup seçiliyse o, değilse son seçilen ya da ilk görünür grup) — değişince `APP.secimYap(null, grup)` ile **üst çubuğun grubu da değişir**. Yanında not: "Numara ada yazılmaz; "Sıra" alanından verilir ve her ekranda "08 PAZARLAMA" biçiminde görünür. Aynı numara iki bölüme verilemez."

Tablo (`API.butceBolumuListe(grup)`, sıra `sira, ad`; boşsa "Bu grupta bütçe bölümü yok."):

| Sütun | İçerik |
|---|---|
| Sıra | 2 haneli, `mono` (`08`) |
| Bütçe Bölümü | ad |
| `<yıl>` kişi | o yılın bu gruptaki bütün çalışmalarında bölüme bağlı bütçe satırı sayısı (`API.bolumKisiSayilari`; 0 çok soluk) |
| (düğmeler) | `parametre.yaz` varsa ✎ (ipucu "Düzenle / birleştir") · 🗑 (ipucu "Sil") |

Altında `parametre.yaz` varsa **+ Yeni Bütçe Bölümü**.

**Pencere — "Bütçe Bölümü" / "Yeni Bütçe Bölümü"** (`bolumForm`, `dar`):

| Alan | Not |
|---|---|
| Sıra (`sira`, sayı, en az 1) | yeni bölümde gruptaki en büyük sıra + 1 |
| Ad (`ad`, yer tutucu "örn. PAZARLAMA") | kayıtta `BOLUM_TEMIZLE`: boşluklar sadeleşir, baştaki "08 ", "08- ", "08. ", "8) " gibi numara silinir |
| Not | "Numarayı ada yazmayın. Ad değişirse bu bölümdeki bütçe satırları da güncellenir." |

Düzenlemede ve grupta başka bölüm varsa ayraçtan sonra **"Başka bölümle birleştir"**: açıklama "Mükerrer bölümler için: bu bölümdeki bütün kişiler (bütün yıllar) seçilen bölüme taşınır ve bu bölüm silinir." · hedef seçimi (`#birlesHedef`, ilk seçenek "Hedef bölüm seçin…", seçenekler "NN AD") · **Birleştir** (ikincil, küçük).
- Hedef seçilmemişse "Hedef bölümü seçin." (hata).
- Onay "Bölümleri Birleştir" — "**<kaynak>** bölümündeki kişiler **<hedef>** bölümüne taşınacak ve **<kaynak>** silinecek." / **Birleştir** → `API.butceBolumuBirlestir` → bütün pencereler kapanır, "N bütçe satırı taşındı." (başarı), tazele.

**Kaydet** → `API.butceBolumuKaydet({id, grup_kod, ad, sira})`; ad değişirse grubun bütün yıllarındaki bütçe satırlarının bölüm adı da güncellenir. Hatalar: "Bu grupta değişiklik yetkiniz yok." · "Bölüm adı boş olamaz." · "Sıra numarası 1 ya da daha büyük olmalı." · "NN numarası "<ad>" bölümünde kullanılıyor." · ""<ad>" adında bir bölüm zaten var. İkisini tek bölüm yapmak için "Birleştir"i kullanın."
**Silme** (🗑): onay "Sil" — "Bütçe bölümü silinecek." (tehlike) → `API.butceBolumuSil`; hatalar "Bu grupta değişiklik yetkiniz yok." · "Bu bölümde N bütçe satırı var; önce onları başka bölüme alın." Birleştirme hataları: "Birleştirilecek iki farklı bölüm seçin." · "Yalnızca aynı gruptaki bölümler birleştirilebilir."

Ekranlarda bölüm adı her yerde `API.bolumEtiket` ile "NN AD" biçiminde gösterilir.

#### 3.12.5 İçe Aktarma Başlıkları (`sekme = baslik`)

Personel İçe Aktarma'nın (§3.10) sütunları tanıdığı başlık sözlüğü. Yıldan ve gruptan bağımsızdır; bütün çalışmalarda aynıdır. Açıklama: "Personel İçe Aktarma, ERP / bordro programından alınan listedeki sütunları **başlık adlarıyla** tanır. Her alan için tanınacak başlıkları virgülle ayırarak yazın; büyük / küçük harf ve Türkçe karakter farkı gözetilmez ("Net Ücret" = "net ucret"). Başlık tam tutmazsa başlığın içinde geçen aday da eşleşir. T.C. sütunu zorunludur."

Tablo (`#baslikTablo`, `API.aktarimSozluk()`; satırlar `api.js:AKTARIM_ALANLARI` sırasıyla, 11 alan):

| Sütun | İçerik |
|---|---|
| Alan | alanın etiketi (kalın): T.C. · Ad Soyad · İşe Giriş · Çıkış · Bölüm · Ekip · Görev · Net Maaş · Yaka · Bütçe Bölümü · Gerçekleşen Maliyet; liste varsayılandan farklıysa sarı rozet "değiştirildi" (ipucu "Varsayılandan farklı") |
| Tanınan başlıklar | tam genişlik metin kutusu (`data-baslik`): geçerli adaylar ", " ile birleşik; `parametre.yaz` yoksa salt okunur |
| (düğme) | `parametre.yaz` varsa **Varsayılan** (küçük ikincil; ipucu = varsayılan liste): kutuya varsayılan listeyi yazar, kaydetmez |

Altında (`parametre.yaz`) **Başlıkları kaydet** (`#baslikKaydet`):
- Her kutu `,`, `;` ya da satır sonuyla bölünür; parçalar kırpılır, boşlar atılır. Varsayılanla (sıra dâhil) aynı olan alan için kayıt tutulmaz.
- T.C. kutusu boşsa: "T.C. alanı için en az bir başlık girilmeli." (hata; kayıt yapılmaz).
- `API.aktarimSozlukYaz(yeni)` (`parametre.yaz` + yazma kilidi): listesi dolu alan kaydedilir; boş liste ya da `null` o alanın kaydını siler (varsayılana döner); bilinmeyen alan "Bilinmeyen alan: …". `sistem_bilgi` tablosuna `aktarim.sozluk` (JSON, yalnız değiştirilen alanlar) yazılır; işlem kaydı `KAYDET` / `sistem_bilgi` / `aktarim.sozluk` "<N> alan değiştirilmiş". Bildirim "Aktarım başlıkları kaydedildi." (başarı); ekran tazelenir.
- ⚠ T.C. dışındaki bir alanın kutusu boşaltılıp kaydedilirse alan tanınmaz hâle gelmez, **varsayılan listesine döner**; bir alanın aktarımını kapatmanın ekranda yolu yoktur.
- Varsayılan listeler ve eşleşme kuralları: §4.2; karşılaştırma `TO.norm` ile yapılır (§4.0).

---

### 3.13 Kullanıcılar ve Yetkiler

**Kaynak:** `js/modules/kullanici.js` (`ciz`, `form`); `api.js:kullaniciListe, kullaniciGruplari, kullaniciYetkileri, kullaniciEkle, kullaniciGuncelle, parolaDegistir, kullaniciSil, kullaniciErisimYaz, digerYoneticiYok`; `schema.js:YETKILER`.
**Yer:** Yönetim → 🔑 Kullanıcılar. Sayfa başlığı "Kullanıcılar ve Yetkiler", alt başlık "Grup erişimi ve yetkiler kullanıcı bazında".
**Yetki:** `sistem.yonet`. **Tümü:** ilgisiz (grup seçimi kullanılmaz).

**Amaç:** Rol yoktur; sistem yöneticisi her kullanıcı için grup erişimini (Göremez / Görür / Görür ve düzenler) ve yetkileri tek tek işaretler. Yetki kuralları için bkz. "03 — İş Kuralları, İş Akışları ve Yetkiler".

**Kart "Kullanıcılar"**: açıklama "Sistem yöneticisi her şeyi görür. Diğer kullanıcılar yalnızca işaretlediğiniz grupları ve yetkileri kullanabilir."; sağda **+ Yeni Kullanıcı**. Tablo (`API.kullaniciListe()`: yöneticiler önce, sonra ad soyad):

| Sütun | İçerik |
|---|---|
| Kullanıcı Adı | `mono` |
| Ad Soyad | |
| Tür | yöneticide mor rozet "Sistem Yöneticisi", değilse "Kullanıcı" |
| Gruplar | yöneticide soluk "tümü"; değilse her erişim için rozet: düzenleyebilirse yeşil "<grup adı> ✎", yalnız görürse gri "<grup adı>"; hiç erişim yoksa kırmızı "hiçbiri" |
| Yetki | yöneticide "—"; değilse "n / 11" (işaretli yetki / `YETKILER` sayısı) |
| Durum | yeşil "Etkin" / gri "Devre dışı" |
| Son Giriş | "GG.AA.YYYY SS:DD" ya da "—" |
| (düğmeler) | **Düzenle** (ikincil, küçük) · 🗑 (oturum açan kişinin kendi satırında yok) |

**Silme** (🗑): onay "Kullanıcıyı Sil" — "**<kullanıcı adı>** silinecek." (tehlike, **Sil**) → `API.kullaniciSil`. Son etkin yönetici silinemez: "Sistemde en az bir etkin yönetici kalmalıdır."

**Pencere — "Yeni Kullanıcı" / "<ad soyad>"** (`form`, `genis`; düzenlemede alt başlık kullanıcı adı):

| Alan | Not |
|---|---|
| Kullanıcı Adı (`kullanici_adi`, `mono`) | düzenlemede `disabled`; kayıtta kırpılıp küçük harfe çevrilir |
| Ad Soyad (`ad_soyad`) | yeni kullanıcıda boşsa kullanıcı adı yazılır |
| Parola / Yeni Parola (`parola`, password) | yer tutucu "en az 6 karakter" (yeni) / "değişmeyecekse boş bırakın" (düzenleme) |
| ☐ Sistem yöneticisi (her şeyi görür, yetki atar) (`yonetici`) | işaretliyken alttaki erişim bölümü soluklaşır (opaklık 0,4) ama yine okunur ve kaydedilir |
| ☐ Etkin (`aktif`) | yalnız düzenlemede; yeni kullanıcı etkin açılır |
| **Grup Erişimi** tablosu | sütunlar Grup · Göremez · Görür · Görür ve düzenler; satır = **bütün** gruplar (`API.grupListe`); her satırda üç radyo (0 / 1 / 2) |
| **Yetkiler** | iki sütunlu onay kutuları "`kod` — açıklama" (`window.YETKILER`, aşağıdaki tablo). Yeni kullanıcıda işaretli gelenler: `ozet.oku`, `personel.oku`, `zam.oku`, `parametre.oku` |
| Not | ""Düzenler" yetkisi olan grupta bile işlem yapabilmek için ilgili yetki (örn. personel.yaz, zam.yaz) ayrıca işaretli olmalıdır." |

Yetki listesi (`schema.js:YETKILER`, ekranda ve Kılavuz'da aynen):

| Kod | Açıklama metni |
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

**Kaydet** sırası: yeni → `API.kullaniciEkle(ad, adSoyad, parola, yönetici)`; mevcut → `API.kullaniciGuncelle(ad, adSoyad, yönetici, etkin)` ve parola doluysa `API.parolaDegistir`; ardından `API.kullaniciErisimYaz(ad, yetkiler, gruplar)` (kullanıcının bütün yetki ve grup kayıtları silinip yeniden yazılır; radyo "Göremez" olan grup yazılmaz). Başarıda pencere kapanır, "Kullanıcı kaydedildi." (başarı), tazele. Hatalar: "Kullanıcı adı boş olamaz." · "Kullanıcı adı en az 3 karakter olmalı; yalnızca harf, rakam, nokta, tire kullanın." (desen `^[a-z0-9._-]{3,}$`) · "Parola en az 6 karakter olmalıdır." · "Bu kullanıcı adı zaten kayıtlı." · "Sistemde en az bir etkin yönetici kalmalıdır." (son etkin yöneticinin yöneticiliği ya da etkinliği kaldırılırsa).

Yetki ve grup değişikliği açık oturumlara da yansır: her ekran geçişinde kullanıcının yetkileri veritabanından yeniden okunur; silinen ya da devre dışı bırakılan kullanıcının oturumu kapanır (`api.js:oturumTazele`; bkz. §1.6).

---

### 3.14 Sistem

**Kaynak:** `js/modules/sistem.js` (`ciz`, `depoKutusunuDoldur`, `sifreKutusunuCiz`, `sifreUygula`, `sifreKaldir`); `engine.js` (`ADB.istatistik, yedekDurumu, depoDurumu, yedekSunucuyaKaydet, yedekIndir, yedektenYukle, sifirla, sifrelemeKullanilabilir, sifrelemeAcikMi, sifrelemeyiKur, sifrelemeyiKaldir`); `api.js:oturumZamanAsimi, oturumZamanAsimiYaz, logListe, ornekVeriYukle`; sunucu ucu `/veri-bilgi` (`Sunucuyu-Baslat.ps1`).
**Yer:** Yönetim → 🛠 Sistem. Sayfa başlığı "Sistem", alt başlık "Yedek, şifreleme, işlem kaydı, örnek veri".
**Yetki:** `sistem.yonet`. **Tümü:** ilgisiz.

**Amaç:** Verinin nerede ve nasıl saklandığı, şifreleme, hareketsizlikte kapanma, yedekleme / geri yükleme, işlem kaydı, örnek veri yükleme ve sıfırlama. Depolama ayrıntısı için bkz. "01 — Veri Modeli ve Depolama".

**Kartlar (yukarıdan aşağı):**

**1. "Veri Deposu"** — açıklama "Verilerin nerede durduğu ve korunması."; kutu önce "Okunuyor…" yazar, sonra `depoKutusunuDoldur` doldurur.
- Program sunucusuz açıldıysa (`ADB.depoDurumu().kip !== 'sunucu'`) kırmızı kutu: "⚠ Veriniz şu anda **tarayıcının deposunda** duruyor: tarayıcı verisi temizlenirse kayıtlar gider. Programı `BUTCE-BASLAT.bat` ile açın; veri otomatik olarak diskteki dosyaya taşınır."
- Sunucudaysa `GET /veri-bilgi`; yanıt alınamaz ya da `basarili` değilse "Dosya bilgisi alınamadı." Alınırsa: "Veriniz **tarayıcıda değil**, diskteki bir dosyada duruyor. Tarayıcı verisi silinse, profil bozulsa ya da başka tarayıcı kullanılsa bile kayıtlarınız yerinde kalır." + iki sütunlu tablo:

| Satır | Değer |
|---|---|
| Veri dosyası | dosya yolu (`code`) |
| Durum | dosya varsa yeşil "şifreli" / kırmızı "ŞİFRESİZ"; yoksa gri "henüz oluşmadı" |
| Boyut | "N KB" ya da "—" |
| Son yazma | sunucu zamanı (`T` yerine boşluk) ya da "—" |
| Otomatik yedek | "N kopya · `<klasör>`" |
| Elle yedekler | `<klasör>` |

- Yedek klasörlerinde şifresiz dosya varsa sarı kutu: "⚠ Yedek klasörlerinde **N şifresiz dosya** var (şifreleme kurulmadan önce alınmış yedekler). İçlerinde maaş verisi açık duruyor; artık gerekmiyorsa Windows Gezgini'nden silin."

**2. "🔒 Veri Şifreleme"** (`sifreKutusunuCiz`) — üç durum:
- *Kullanılamıyor* (tarayıcıda şifreleme yok ya da veri dosyada değil, şifreleme de kapalı): "Şifreleme yalnızca program `BUTCE-BASLAT.bat` ile açıldığında ve veri dosyada tutulurken kullanılabilir."
- *Kurulmamış*: sarı kutu "⚠ **Veri dosyası şu anda şifresiz.** Dosyayı kopyalayan herkes — sunucu yöneticileri ve yedekleme sistemleri dâhil — bütün maaşları okuyabilir." + kırmızı kutu "🔑 **Parolayı kaybederseniz veriye kimse ulaşamaz.** Arka kapı yoktur. Parolayı kilitli bir yerde yazılı saklayın." + alanlar "Veri parolası (en az 8 karakter)" · "Parola (tekrar)" + hata satırı + **🔒 Şifrelemeyi Kur**.
- *Açık*: yeşil kutu "🔒 **Veri şifreli.** Dosyayı kopyalayan biri veri parolası olmadan hiçbir kaydı okuyamaz. Otomatik kopyalar ve aldığınız yedekler de şifrelidir." + "Parolayı değiştirmek için yenisini girin. Daha önce alınmış yedekler **eski parolayla** açılır." + alanlar "Yeni veri parolası (en az 8 karakter)" · "Parola (tekrar)" + **🔑 Parolayı Değiştir** · **🔓 Şifrelemeyi Kaldır** (tehlike).
- Kur / değiştir (`sifreUygula`): denetimler kart içindeki kırmızı hata satırında: "Parola en az 8 karakter olmalıdır." · "İki parola aynı değil." Onay "Veri Şifreleme" — kurarken "Veri dosyası bu parolayla şifrelenecek. Parolayı kaybederseniz verilere BİR DAHA ULAŞILAMAZ. Parolayı yazılı olarak sakladınız mı?", değiştirirken "Veri parolası değiştirilecek. Programı kullanan diğer kişilere de bildirmeniz gerekir. Devam edilsin mi?" — **Evet, uygula**. Çalışırken düğme "Uygulanıyor…". Başarı: "Şifreleme kuruldu; veri dosyası şifreli yazıldı." / "Veri parolası değiştirildi." (başarı, tazele). Hata (motor metni, örn. "Şifreleme yalnızca veri dosyada tutulurken kullanılabilir.") hata satırına yazılır, düğme eski hâline döner.
- Kaldır (`sifreKaldir`): onay "Şifrelemeyi Kaldır" — "Şifreleme kaldırılacak ve veri dosyası DÜZ yazılacak." / detay "Dosyayı kopyalayan herkes — sunucu yöneticileri ve yedekleme sistemleri dâhil — bütün maaşları okuyabilir hâle gelir." / **Evet, kaldır** (tehlike) → "Şifreleme kaldırıldı." ya da "Şifreleme kaldırılamadı: …".

**3. "⏱ Otomatik Kapanma"** — açıklama "Belirtilen süre boyunca fare ya da klavye hareketi olmazsa program kendini kapatır: bekleyen kayıt dosyaya yazılır, veri parolası bellekten silinir. Yeniden açmak için veri parolası ve giriş parolası istenir. Kapanmadan 30 saniye önce uyarı çıkar. **0** yazılırsa özellik kapalıdır." Alan "Süre [sayı, 0–240, adım 1] dakika" (değer `API.oturumZamanAsimi()`, varsayılan 5) + **Kaydet** → `API.oturumZamanAsimiYaz` (yuvarlanır) → "Program N dakika hareketsizlikten sonra kapanacak." ya da "Otomatik kapanma kapatıldı." (başarı); hata "Süre 0 ile 240 dakika arasında olmalıdır (0 = kapalı)." Perde davranışı §1.2.

**4. "Yedek"** — açıklama, veri dosyadaysa: "Veriler diskteki dosyada saklanır; program her kayıttan önce `yedek` klasörüne otomatik kopya alır. Yine de **haftada bir elle yedek alıp** dosyayı ayrı bir yerde (ağ sürücüsü, harici disk) saklayın: diskin kendisi bozulursa otomatik kopyalar da aynı diskte durur. Şifreleme açıksa yedekler de şifrelidir."; sunucusuzsa: "Program sunucusuz açıldı: veri bu tarayıcıda duruyor. Tarayıcı verisi silinirse tek kurtarma yolu yedektir."
- 4 kutu (`.stat`): Personel (personel tablosundaki kayıt) · Çalışma · Aylık girdi · Veritabanı ("N KB").
- Durum kutusu: yedek alınmışsa "Son yedek: GG.AA.YYYY (N gün önce)" — 7 gün ve daha yeniyse yeşil ✓, eskiyse sarı ⚠; hiç alınmamışsa sarı ⚠ "Henüz yedek alınmamış." (Son yedek zamanı `sistem_bilgi.son_yedek`; elle yedek ve indirme yazar.)
- **Yedeği "yedek-elle" klasörüne kaydet** → `ADB.yedekSunucuyaKaydet` (`POST /yedek-kaydet`) → "Yedek kaydedildi: <klasör>\<dosya>" (başarı, tazele) ya da "Klasöre kaydedilemedi (<neden>). İndirme ile deneyin." Sunucusuz açılışta neden "Bu özellik sunucu üzerinden çalışırken kullanılabilir (BUTCE-BASLAT.bat)." olur.
- **Yedeği indir** (ikincil) → `ADB.yedekIndir`; dosya adı `maas-butce-yedek-YYYYAAGG-SSDD.db` (şifreleme açıksa şifreli); 0,5 sn sonra tazele.
- **Yedekten geri yükle** (ikincil; dosya seçimi `accept=".db"`) → onay "Yedekten Geri Yükle" — "**<dosya adı>** yüklenecek." / detay "Şu anki veritabanının üzerine yazılır. Önce mevcut hâlin yedeğini alın." / **Geri Yükle** (tehlike) → `ADB.yedektenYukle` → sayfa yeniden yüklenir. Motor hataları: "Bu dosya bir SQLite veritabanı değil." · "Dosyada personel tablosu bulunamadı; bu bir Maaş Bütçe yedeği değil." · "Şifreli yedek açılmadı." (parola penceresinden vazgeçilirse) · "Mevcut verinin yedeği alınamadığı için işlem yapılmadı: …". Şifreli yedek bellekteki anahtarla açılamazsa veri parolası perdesi "Şifreli Yedek" başlığıyla açılır (§1.2). Ayrıntı §4.5.

**5. "İşlem Kaydı"** — açıklama "Son 300 işlem." Tablo (`API.logListe(300)`, yeniden eskiye):

| Sütun | İçerik |
|---|---|
| Tarih | "GG.AA.YYYY SS:DD:ss" |
| Kullanıcı | kullanıcı adı |
| İşlem | işlem kodu (örn. `GIRIS`, `CIKIS`, `EKLE`, `KAYDET`, `GUNCELLE`, `SIL`, `KOPYALA`, `ONGORU`, `BIRLESTIR`, `ORNEK`, `DISA_AKTAR`) |
| Tablo | etkilenen tablo |
| Kayıt | kayıt anahtarı (örn. `<yıl>/<anahtar>`) |
| Ayrıntı | küçük yazı |

**6. "Örnek Veri"** — açıklama "Programı denemek için uydurma iki grup, bu grupların bütçe bölümleri, örnek personel ve bütçe çalışmaları eklenir. Var olan kayıtlara dokunulmaz: aynı kodlu grup, aynı T.C. Kimlik No'lu kişi ya da aynı yıl ve addaki çalışma zaten varsa atlanır. Gerçek kullanıma geçerken örnek grupları ve çalışmalarını silin ya da veritabanını sıfırlayın."; düğme **Örnek veriyi yükle** (ikincil).
- Onay "Örnek Veriyi Yükle" — "Uydurma iki grup (bütçe bölümleriyle), örnek personel ve bütçe çalışmaları eklenecek." / detay "Var olan kayıtlara dokunulmaz; aynı kodlu grup, aynı kişi ya da aynı çalışma varsa atlanır. Örnek veri programı denemek içindir: gerçek verinin yanında kalırsa raporlara ve toplamlara karışır." / **Yükle**.
- Çalışırken düğme kapanır ve "Yükleniyor…" yazar → `API.ornekVeriYukle()` (gruplar Ofis / `OFIS` ve Üretim / `URETIM`; bkz. "01 — Veri Modeli ve Depolama") → "Örnek veri yüklendi." (başarı). Üst çubuğun seçili grubu geçersizse ilk görünür gruba geçilir (`APP.secimYap`), değilse üst çubuk yeniden çizilip ekran tazelenir. Hata: "Örnek veri yüklenemedi: <neden>" (örn. "Örnek veri dosyası (data/ornek-veri.js) yüklenmemiş."); düğme eski hâline döner. İşlem kaydı `ORNEK`.

**7. "Veritabanını Sıfırla"** — açıklama "Elle girilen her şey ve kullanıcı hesapları silinir; program ilk kurulum ekranıyla yeniden açılır (yasal parametreler yeniden yüklenir, örnek veriyle ya da boş başlanabilir). **Program güncellemeleri için sıfırlama GEREKMEZ**: yeni özellikler mevcut verinin üzerine kendiliğinden kurulur. Sıfırlamadan önce mevcut veri otomatik olarak `yedek-elle` klasörüne yedeklenir; yedek alınamazsa sıfırlama yapılmaz."; düğme **Sıfırla…** (tehlike).
- Onay "Veritabanını Sıfırla" — "Bütün veriler ve kullanıcı hesapları silinecek." / detay "Program güncellemeleri için sıfırlama gerekmez. Önce otomatik yedek alınır; yine de bu işlem girdiğiniz bütün kayıtları siler." / **Devam** (tehlike).
- Ardından metin sorma (`C.metinSor`) "Son onay" — etiket "Sıfırlamak için büyük harflerle SIFIRLA yazın", yer tutucu "SIFIRLA". Vazgeç → işlem yok; metin (kırpılmış) "SIFIRLA" değilse "Onay metni hatalı; sıfırlama yapılmadı." (hata).
- `ADB.sifirla()`: görüntüleme kipinde reddedilir (§2.2); önce mevcut hâl yedeklenir (sunucuda `yedek-elle` klasörüne, sunucusuzda indirme); veri dosyası (`DELETE /veri`) ve tarayıcı deposu silinir. Başarıda "Sıfırlamadan önce yedek alındı: <dosya>" (başarı; sunucusuzda "indirilenler") ve 1,2 sn sonra sayfa yenilenir → ilk kurulum perdeleri (§1.2). Şifreleme işareti sıfırlamada silinmez: yeniden kurulumda veri parolası yeniden sorulur.

---

### 3.15 Kullanım Kılavuzu

**Kaynak:** `js/modules/kilavuz.js` (`BOLUMLER`, `KIME`, `ciz`, yardımcılar `ac`, `ipucu`, `dikkat`, `gorsel`, `duzMetin`); `css/butce.css` (`.kl-*`).
**Yer:** Menüde yoktur (`gorunur: () => false`, menü grubu `Yardım`); sol alttaki **📖 Kullanım Kılavuzu** düğmesiyle açılır (§1.4). Sayfa başlığı "Kullanım Kılavuzu", alt başlık "Programı öğrenmek için ekran ekran anlatım".
**Yetki:** istemez. **Tümü:** ilgisiz (`calismaGerekli` yok).

**Amaç:** Programı ilk kez kullananlar ve bütçeyi inceleyen yönetim için ekran ekran anlatım; her bölümden ilgili ekrana bağlantı.

**Düzen** (`.kl-duzen`: 260 px + kalan genişlik iki sütun; 900 px altında tek sütun ve içindekiler yapışkan olmaktan çıkar):
- **Sol — İçindekiler kartı** (`.kl-icindekiler`, yapışkan, en çok ekran yüksekliği − 120 px, kendi içinde kayar):
  - Arama kutusu `#klAra` (type search), yer tutucu "Kılavuzda ara (Esc: temizle)"; canlı arama (§2.9).
  - Altında: arama boşken "İçindekiler", doluyken "N bölüm bulundu".
  - "Görüntülerdeki isim ve tutarlar örnektir." (çok soluk).
  - Bölüm bağlantıları (başlık; hedef kitle "herkes" değilse yanında sarı rozet "Yönetim" / "Sistem yöneticisi"). Tıklayınca ilgili bölüm kartına yumuşak kaydırma (`scrollIntoView`, `behavior: 'smooth'`).
- **Sağ — bölüm kartları** (`.kl-bolum`, kimlik `kl-<id>`): başlık h2 + (hedef kitle "herkes" değilse) sarı rozet "<Yönetim | Sistem yöneticisi> için" + bölüm HTML'i. Arama sonuçsuzsa mavi kutu: ""<arama>" için bölüm bulunamadı."

**Arama:** bölüm başlığı + HTML'den etiketleri ve `&…;` varlıklarını atılmış düz metin içinde, `U.normalize` ile (Türkçe karakter ve büyük / küçük harf farkı gözetilmeden) alt dize araması. Arama metni modül belleğinde kalır.

**Bölümler** (`BOLUMLER` dizisi, bu sırayla; "kime" yalnız rozettir — bölümler herkese gösterilir):

| `id` | Başlık | Kime | "Ekranı aç →" hedefleri (`APP.git`) | Görseller (`img/kilavuz/<ad>.png`) |
|---|---|---|---|---|
| `baslarken` | Başlarken | herkes | — | `13-kilavuz-dugme` |
| `ekran` | Ekranın düzeni | herkes | — | `01-genel` |
| `yeniyil` | Yeni yıl bütçesi — adım adım | herkes | `parametre`, `calisma`, `aktarim`, `personel`, `performans`, `aylik`, `mesai`, `excel` | `08-parametre`, `07-yeni-calisma` |
| `personel` | Personel ve Zam | herkes | `personel` | `02-personel`, `03-kart` |
| `aylik` | Aylık Girdiler | herkes | `aylik` | `04-aylik` |
| `ozet` | Özet, Maliyet Tablosu ve Maaş Dağılımı | herkes | `ozet`, `maliyet`, `dagilim` | `09-maliyet`, `10-bordro` |
| `calisma` | Bütçe Çalışmaları: taslak, onay ve revize | herkes | `calisma` | `06-calisma` |
| `perfmesai` | Performans Değerlendirme ve Fazla Mesai Planı (alt bölümler: Performans Değerlendirme, Değerlendirme modeli, Fazla Mesai Planı) | herkes | `performans`, `mesai` | `14-model` |
| `rapor` | Excel Raporu | herkes | `excel` | `11-rapor` |
| `aktarim` | Personel İçe Aktarma (Excel / CSV / ERP) — İçe Aktarma Başlıkları'na yönlendirir | herkes | `aktarim` | — |
| `parametre` | Parametreler ve Tanımlar — Genel'deki mesai katsayıları, günlük saat, AR-GE eşiği, yuvarlama adımı ve İçe Aktarma Başlıkları dâhil | herkes | `parametre`, `tanim` | — |
| `yonetim` | Yönetim için: bütçeyi incelemek ve düzeltmek | Yönetim | `ozet`, `personel`, `maliyet` | `02-personel` |
| `gruplar` | Gruplar | Sistem yöneticisi | `tanim` | — |
| `kullanici` | Kullanıcılar ve yetkiler | Sistem yöneticisi | `kullanici` | `12-kullanici` |
| `sistem` | Yedek ve sistem | Sistem yöneticisi | `sistem` | — |
| `sss` | Sık sorulanlar | herkes | — | — |

**Davranış:**
- "Ekranı aç →" bağlantıları (`.kl-git`, `data-git`) `APP.git(<id>)` çağırır; yetkisiz kullanıcıda §1.3'teki "Bu bölüme erişim yetkiniz yok." bildirimi çıkar. Bütün hedef kimlikler §1.3'teki kayıtlı ekranlardır.
- `kullanici` bölümündeki yetki tablosu (`#klYetkiler`: sütunlar "Yetki" · "Ne sağlar") `window.YETKILER`'den her çizimde canlı üretilir (§3.13'teki liste).
- Bölüm içi kutular: 💡 mavi ipucu (`ipucu`), ⚠ sarı dikkat (`dikkat`).
- Görseller `figure.kl-gorsel` içinde, alt yazılı, tembel yüklenir; tıklanınca görsel `genis` pencerede (başlık = görselin alt metni) tam genişlikte açılır.
- Konular `img/kilavuz/*.png` görsellerini gösterir; görsel adları: `01-genel`, `02-personel`, `03-kart`, `04-aylik`, `06-calisma`, `07-yeni-calisma`, `08-parametre`, `09-maliyet`, `10-bordro`, `11-rapor`, `12-kullanici`, `13-kilavuz-dugme`, `14-model` (görsellerin güncelliği için bkz. §6).

---

## 4. Bütün Excel çıktıları ve içe almalar

**Ortak:** Excel işlemleri tarayıcıda ExcelJS ile yapılır (`js/vendor/exceljs.min.js`); kütüphane yoksa "Excel kütüphanesi yüklenemedi." Her çıktı `API.yetkiIste('excel.aktar')` ister (yazma yetkisi değildir; görüntüleme kipinde ve onaylı çalışmada da alınır) ve işlem kaydına `DISA_AKTAR` yazar — tek istisna, kişi verisi taşımayan Personel İçe Aktarma şablonudur (§4.2.1). Kitap yazarı (`creator`) "Maaş Bütçe Sistemi". İndirme `U.indir` ile (Blob, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`). Renk kodları ARGB (`FF` + RGB). İçe almalar her zaman önce **önizleme** gösterir; onaylanmadan hiçbir şey yazılmaz ve onaylanınca tek veritabanı işleminde yazılır.

| Ekran | Çıktı dosyası | İçe alma | Bölüm |
|---|---|---|---|
| Excel Raporu | `<Y> <grup adı> Zam Çalışması <YYYY-AA-GG>.xlsx` — sayfalar ÖZET, ZAM ÇALIŞMASI, AYLIK MALİYET | aynı dosyanın ZAM ÇALIŞMASI sayfası → yalnız `duzeltme` | §4.1 |
| Personel İçe Aktarma | boş şablon `personel-sablonu-<grup adı>-<yıl>.xlsx` — sayfalar PERSONEL, ÖRNEK VE AÇIKLAMA | personel listesi (şablon, kendi dosyası ya da ERP / bordro programı çıktısı): `.xlsx` (ilk sayfa), `.csv`, `.txt` ya da yapıştırılan tablo → kişi kartı + `maas_eski`, `maliyet_onceki`, yaka, bütçe bölümü; sütun başlıkları kullanıcının düzenlediği sözlükle tanınır | §4.0, §4.2 |
| Performans Değerlendirme | `<Y> <GRUP ADI> PERFORMANS DEĞERLENDİRME.xlsx` — yaka sayfaları + AÇIKLAMA; sütunlar çalışmanın değerlendirme modelinden | aynı şablon (aynı modelin başlıkları) → `performans_girdi` | §4.3 |
| Fazla Mesai Planı | `<Y> <GRUP ADI> MESAİ ÖNGÖRÜSÜ.xlsx` — tek sayfa MESAİ ÖNGÖRÜSÜ | aynı düzen → `mesai_ongoru` | §4.4 |
| Sistem (yedek) | `maas-butce-yedek-YYYYAAGG-SSDD.db` (Excel değil) | aynı biçim | §4.5 |

### 4.0 Genel tablo okuyucu `TO` (`js/core/tablooku.js`)

Yalnız **Personel İçe Aktarma** kullanır. Sütunlar konumla değil **başlık adıyla** eşleştirilir: kaynak programın raporunda sütun sırası değişse ya da araya sütun eklense de aktarım bozulmaz (konumla okuyan bir okuyucu kayan sütunda yanlış alanı sessizce okurdu).

- **Dosya** (`TO.dosyaSatirlar`): `.xlsx` → **ilk sayfa**, boş olmayan satırlar; hücre değeri `hucre()` ile düzleştirilir (zengin metin birleştirilir, formülde hesaplanmış sonuç, bağlantıda metin; tarih nesnesi korunur). `.xls` → hata "Eski .xls biçimi okunamıyor. Dosyayı Excel'de .xlsx olarak kaydedin ya da tabloyu kopyalayıp yapıştırın."; sayfa yoksa "Dosyada sayfa yok."; diğer uzantılar metin olarak okunur.
- **Metin** (`TO.metinSatirlar`; `.csv` / `.txt` ve yapıştırma): satır sonları `\r` atılarak bölünür, boş satırlar atılır; ayraç: ilk satırda sekme varsa sekme (Excel'den kopyala-yapıştır), yoksa `;` sayısı ≥ `,` sayısı ise `;`, değilse `,`. Hücrelerin baş / son tırnağı silinir, kırpılır. (Tırnak içindeki ayraç desteklenmez.)
- **Başlık eşleme** (`TO.eslestir(satirlar, tanim, zorunlu)`): ilk **15** satır taranır. Başlık metni `TO.norm` = `U.normalize` + `.` ve `_` → boşluk + boşluk sadeleştirme (örn. "T.C. Kimlik No" → "t c kimlik no", "Adı Soyadı" → "adi soyadi"); sözlükteki adaylar da aynı işlemden geçer. Her satırda önce **birebir** eşleşme (aday listesinde aynısı), sonra eşleşmeyen alanlar için **içerir** eşleşmesi (aday uzunluğu > 2, henüz kullanılmamış sütun, başlık adayı içeriyor). Zorunlu alanların hepsi bulunan **ilk satır** başlık satırıdır; veri onun altındaki satırlardır. Dönüş `{ sutun: { alan: indeks }, basliklar, veri }`; uygun satır yoksa `null`. ⚠ İçerir eşleşmesi sözlükteki alan sırasıyla yapılır (önce gelen alan sütunu kapar).
- **Dönüştürücüler:** `TO.tc` (yalnız rakamlar), `TO.sayi` (sayıysa olduğu gibi, metinse `API.trSayi`; boş → `null`), `TO.tarih` (Date → ISO gün; metin / seri numarası `U.tarihCoz`: `YYYY-AA-GG`, `GG.AA.YYYY`, `/` `.` `-` ayraçları, Excel seri no 1–60000; geçersiz tarih → `null`).
- Sözlük (`API.aktarimSozluk()`; varsayılanlar `api.js:AKTARIM_ALANLARI`, kullanıcı Tanımlar → İçe Aktarma Başlıkları'ndan değiştirir) ve satır dönüştürme: §4.2.

Diğer içe almalar `TO` kullanmaz, kendi sabit başlıklarıyla okur: Excel Raporu (§4.1.4), Performans şablonu (§4.3.2), Fazla Mesai Planı (§4.4.2).

---

### 4.1 Excel Raporu — çıktı ve içe alma (`js/modules/excel.js`)

**Dosya adı:** `<Y> <grup adı> Zam Çalışması <YYYY-AA-GG>.xlsx` (tarih `toISOString`, yani UTC günü). Kitap: `creator = 'Maaş Bütçe Sistemi'`, `created = şimdi`, `calcProperties.fullCalcOnLoad = true` (Excel açılışta bütün formülleri yeniden hesaplar), `views = [{ activeTab: 0 }]` (ilk sekme etkin). Sayfa sırası: **ÖZET**, **ZAM ÇALIŞMASI**, **AYLIK MALİYET** (ÖZET önce eklenir, ZAM ÇALIŞMASI kurulduktan sonra doldurulur; ÖZET formülleri ZAM ÇALIŞMASI'na bakar). İşlem kaydı `DISA_AKTAR` (`calisma`, dosya adı). `aktar(c, { sadeceIcerik: true })` dosyayı indirmeden içeriği (ArrayBuffer) döndürür (sınama için).

Hesap kaynağı: `API.calismaHesapla(c.id)` (kişi sırası: bütçe bölümünün sırası, bölüm içinde işe giriş tarihi, sonra ad — Personel ve Zam ile aynı) ve `API.calismaOzetOku(c.id)`. `O = yıl − 1`, `Y = yıl`.

**Biçimler:** `SAYI = '#,##0;[Red]-#,##0'`, `ORAN = '0.00%'`, tarih `dd.mm.yyyy`. Başlık satırı (`baslikBicim`): kalın, beyaz, 10 pt, zemin lacivert `FF1F4E79`, yatay ve dikey ortalı, metni kaydır, alt ince çizgi `FF9AA8BC`, satır yüksekliği 34. Toplam satırı (`toplamBicim`): kalın, zemin `FFDDEBF7`, üst ince çizgi (ExcelJS `eachCell` yalnız dolu hücreleri biçimler). Sarı girdi zemini `FFFFF2CC`. Sütun harfi `kol(n)` ile sütun sırasından üretilir.

#### 4.1.1 Sayfa "ZAM ÇALIŞMASI"

- Dondurma: 3 sütun + 4 satır (`xSplit: 3, ySplit: 4`).
- A1: "`<Y> <GRUP ADI (tr-TR büyük harf)> ZAM ÇALIŞMASI`" (kalın 14, lacivert). A2: "`<çalışma adı> · Tutarlar NET · Oluşturma: <tarih saat (tr-TR)>`" (italik 9, gri `FF666666`). A3: "Sarı DÜZELTME sütununa müdahalenizi yazın (öngörülen zamma eklenir, eksi olabilir). Maliyet sütunları, dosya programa geri yüklendiğinde yeniden hesaplanır." (9 pt, kahverengi `FF7A5210`). Satır 4: başlıklar (`baslikBicim`). Veri satır 5'ten (`ilk = 5`).
- Sütunlar (17; yetkiye göre değişmez):

| Harf | Başlık | Genişlik | Değer / formül (satır r) | Biçim |
|---|---|---|---|---|
| A | SIRA | 6 | `kp.sira` (0 / boşsa liste sıra no) | |
| B | BÜTÇE BÖLÜMÜ | 30 | `API.bolumEtiket` ("08 PAZARLAMA"; bölümsüzse boş) | |
| C | ADI SOYADI | 28 | ad soyad | |
| D | M / B | 6 | `kp.yaka` (`B` / `M`) | |
| E | İŞE GİRİŞ | 11 | işe giriş tarihi (UTC gece yarısı `Date`); yoksa boş | `dd.mm.yyyy` |
| F | HESAPLAMA | 10 | `kp.hesap_turu` (kişinin temel hesaplama türü kodu) | |
| G | `<O>` MAAŞ | 13 | `s.zam.eski` (önceki yıl net maaşı; değer) | SAYI |
| H | ÖNGÖRÜ ORANI | 10 | `s.zam.oranOngoru` (değer) | ORAN |
| I | ÖNGÖRÜLEN ZAM | 12 | `s.zam.ongoru` (değer) | SAYI |
| J | **DÜZELTME** | 12 | `kp.duzeltme` (boşsa 0) — **sarı zemin, kalın** | SAYI |
| K | `<Y>` ZAM MİKTARI | 13 | `=I r+J r` (sonuç `s.zam.miktar`) | SAYI |
| L | `<Y>` MAAŞ | 13 | `=G r+K r` (sonuç `s.zam.yeni`) | SAYI |
| M | ZAM ORANI | 10 | `=IF(G r=0,0,K r/G r)` (sonuç `s.zam.oran`) | ORAN |
| N | `<Y>` TOPLAM MALİYET | 15 | `s.yil.maliyet` (değer) | SAYI |
| O | `<O>` TOPLAM MALİYET | 15 | `kp.maliyet_onceki` (boşsa 0) | SAYI |
| P | MALİYET FARKI | 14 | `=N r-O r` | SAYI |
| Q | T.C. KİMLİK NO | 13 | `alan.tc` varsa tam T.C., yoksa maskeli (`U.tcMaskele`, "123*****901" biçimi); gri `FF999999`, 9 pt | |

  Her formül hücresine programın sonucu `result` olarak da yazılır (dosya hesaplanmadan açılsa da değer görünür).
- **Toplam satırı** (`son + 1`): C = "TOPLAM"; G, I, J, K, L, N, O, P → `=SUBTOTAL(9,<sütun>5:<sütun>son)` (otomatik süzgeçte görünenlerin toplamı); M → `=IF(G t=0,0,K t/G t)`; A, B, D, E, F, H boş. `toplamBicim` + sayı biçimleri.
- Otomatik süzgeç: satır 4, A'dan Q'ya, son veri satırına kadar.
- Koruma, veri doğrulama, birleştirilmiş hücre yoktur.

#### 4.1.2 Sayfa "ÖZET" (ZAM ÇALIŞMASI'na formülle bağlı)

- Genişlik: A 34, B–I 17. A1: "`<Y> <GRUP ADI (büyük harf)> — MALİYET ÖZETİ`" (kalın 14, lacivert). A2: "`<çalışma adı> · N kişi`" (italik 9, gri).
- Kısaltmalar: `Z` = `'ZAM ÇALIŞMASI'!`; `Yk` = `Z$D$5:$D$son` (M / B sütunu); `Z<x>` = ZAM ÇALIŞMASI'nın ilgili sütununun `$5:$son` aralığı (`eski` = G, `mik` = K, `mal` = N, `malO` = O).
- **Yaka bloğu** — satır 4 başlık: (boş) · KİŞİ · `<O>` TOPLAM MALİYET · `<Y>` BÜTÇELENEN MALİYET · `<Y>` TOPLAM MALİYET · BÜTÇE FARKI · ZAM MİKTARI · ZAM ORANI · ORTALAMA ZAM.

| Satır | A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|---|
| 5 | BEYAZ YAKA | `=COUNTIF(Yk,"B")` | `calisma_ozet.onceki_B` (sabit değer; yoksa boş) | `calisma_ozet.butce_B` (sabit; yoksa boş) | `=SUMIF(Yk,"B",Z<mal>)` | `=IF(D5="","",E5-D5)` | `=SUMIF(Yk,"B",Z<mik>)` | `=IFERROR(G5/SUMIF(Yk,"B",Z<eski>),0)` | `=IFERROR(G5/B5,0)` |
| 6 | MAVİ YAKA | `"M"` ile aynı | `onceki_M` | `butce_M` | `"M"` ile | `=IF(D6="","",E6-D6)` | `"M"` ile | `"M"` ile | `=IFERROR(G6/B6,0)` |
| 7 | TOPLAM | `=SUM(B5:B6)` | `=SUM(C5:C6)` | `=SUM(D5:D6)` | `=SUM(E5:E6)` | `=E7-D7` | `=SUM(G5:G6)` | `=IFERROR(G7/SUM(Z<eski>),0)` | `=IFERROR(G7/B7,0)` |

  Biçim (satır 5–7): C, D, E, F, G, I = SAYI; H = ORAN; A kalın; satır 7 `toplamBicim`. A8 not (9 pt italik, kahverengi): "Zam miktarı ve oranı ZAM ÇALIŞMASI sayfasındaki düzeltmelerle anında değişir; maliyet program tarafından yeniden hesaplanır." C ve D hücreleri Özet ekranına elle girilen rakamlardır (§3.1), formül değildir.
- **Bütçe bölümü bloğu** — satır 10 başlık: BÜTÇE BÖLÜMÜ · KİŞİ · `<O>` MAAŞ (NET) · ZAM MİKTARI · ZAM ORANI · `<Y>` MAAŞ (NET) · `<O>` MALİYET · `<Y>` MALİYET · FARK. Satır 11'den başlayarak kişilerde geçen her bütçe bölümü (bölüm sırasına göre, `API.bolumSira`; bölümsüz en sonda), A'da bölüm etiketi. `Bk` = `Z$B$5:$B$son`:
  - A etiket · B `=COUNTIF(Bk,A r)` · C `=SUMIF(Bk,A r,Z<eski>)` · D `=SUMIF(Bk,A r,Z<mik>)` · E `=IFERROR(D r/C r,0)` · F `=C r+D r` · G `=SUMIF(Bk,A r,Z<malO>)` · H `=SUMIF(Bk,A r,Z<mal>)` · I `=H r-G r`.
  - Toplam satırı (`11 + bölüm sayısı`): A "TOPLAM"; B, C, D, G, H `=SUM(<sütun>11:<sütun><son bölüm>)`; E `=IFERROR(D/C,0)`; F `=C+D`; I `=H-G`; `toplamBicim`.
  - Biçim: C, D, F, G, H, I = SAYI; E = ORAN.

#### 4.1.3 Sayfa "AYLIK MALİYET"

- Dondurma: 2 sütun + 1 satır (`xSplit: 2, ySplit: 1`). Satır 1 başlık (`baslikBicim`): BÜTÇE BÖLÜMÜ · ADI SOYADI · OCAK · ŞUBAT · MART · NİSAN · MAYIS · HAZİRAN · TEMMUZ · AĞUSTOS · EYLÜL · EKİM · KASIM · ARALIK · TOPLAM (`U.AYLAR_BUYUK`). Genişlik: A 30, B 28, C–O 13.
- Satır 2'den kişi başına: A bölüm etiketi, B ad soyad, C–N her ayın toplam maliyeti (`s.yil.aylar[m].DM`, değer), O `=SUM(C r:N r)` (sonuç `s.yil.maliyet`). C–O = SAYI.
- Toplam satırı: A boş, B "TOPLAM", C–O `=SUM(<sütun>2:<sütun>son)`; `toplamBicim`, SAYI.

#### 4.1.4 İçe alma (`excel.js:oku`)

Bu içe alma `TO` (§4.0) kullanmaz; sabit başlık adlarıyla okur. Karşılaştırmada her metin `U.normalize` + boşluk sadeleştirme ile normalleştirilir (büyük/küçük harf ve Türkçe karakter farkı yok sayılır).

1. **Sayfa:** adı normalleştirilince "ZAM ÇALIŞMASI" ile aynı olan sayfa (sırası önemsiz). Yoksa: "Dosyada "ZAM ÇALIŞMASI" sayfası yok. Programdan alınmış bir rapor seçin."
2. **Başlık satırı:** hem `DÜZELTME` hem `T.C. KİMLİK NO` başlığını (birebir) içeren ilk satır. Sütun eşleme (aynı hücre için sırayla denenir):

| Alan | Kural | Sabit |
|---|---|---|
| tc | birebir "T.C. KİMLİK NO" | `B_TC` |
| duz | birebir "DÜZELTME" | `B_DUZ` |
| mik | **sonu** "ZAM MİKTARI" ile biten (yıl önekli başlık "2027 ZAM MİKTARI" da tutar) | `B_MIK` |
| oran | birebir "ZAM ORANI" | `B_ORAN` |
| ong | birebir "ÖNGÖRÜLEN ZAM" | `B_ONG` |
| ad | birebir "ADI SOYADI" | — |

   T.C. ya da DÜZELTME bulunamazsa: "Başlık satırı bulunamadı (T.C. KİMLİK NO ve DÜZELTME sütunları gerekli)." Diğer sütunlar zorunlu değildir; yoksa o kaynak atlanır.
3. **Satırlar** (başlıktan sonraki her satır): T.C. hücresi maskeli biçimdeyse (`^\d{3}\*+\d{3}$`) satır sayılmadan atlanır. Rakamları 11 hane değilse atlanır (toplam satırı vb.). Kalanlar "okunan" sayılır; çalışmada yoksa "bulunamayan" listesine (dosyadaki adla) eklenir.
4. **Öncelik** (hücrenin formül mü elle yazılmış değer mi olduğu ayırt edilir — ExcelJS'te `formula` / `sharedFormula` ya da `result` taşıyan hücre formüldür; zengin metin birleştirilir):
   1. **ZAM ORANI** formül değil ve sayıysa (oran elle yazılmış): `yeniDüzeltme = round(oran × programdaki önceki yıl maaşı) − programdaki öngörü`; kaynak "oran %X".
   2. Değilse **ZAM MİKTARI** formül değil ve sayıysa: `yeniDüzeltme = round(miktar) − öngörü`; kaynak "zam miktarı".
   3. Değilse **DÜZELTME** (sayı değilse 0); kaynak "düzeltme".
   - Önceki yıl maaşı ve öngörü **programın** o anki hesabıdır (`calismaHesapla`), dosyadaki değil.
5. ÖNGÖRÜLEN ZAM sütunu varsa ve dosyadaki sayı programdakinden 0,5'ten fazla farklıysa uyarı: "<Ad>: dosyadaki öngörü (X) programdakinden (Y) farklı — parametreler değişmiş olabilir."
6. `|yeniDüzeltme − mevcut düzeltme| > 0,004` olanlar "değişen" olur. Önizleme ve uygulama: §3.9. Yalnız `duzeltme` alanı yazılır; dosyadaki başka hiçbir değer (maaş, maliyet, ad, bölüm) programa alınmaz.
7. Dosyada maskeli T.C. var ve tek bir satır bile okunamadıysa hata: "Bu dosyadaki T.C. numaraları maskeli (dosya, T.C. Kimlik No'yu tam görme yetkisi olmayan bir kullanıcı tarafından alınmış). Kişiler T.C. ile eşleştirildiği için içeri alınamaz; dosyayı bu yetkiye sahip bir kullanıcıya aldırın."

⚠ Maskeli ve tam T.C.'li satırlar karışıksa maskeli satırlar **sessizce** atlanır (önizlemede sayılmaz, uyarı yoktur).

---

### 4.2 Personel İçe Aktarma — şablon ve alan eşlemesi (`aktarim.js:sablonIndir / oku`, `api.js:erpAktar`)

#### 4.2.1 Örnek şablon (`aktarim.js:sablonIndir`, `SABLON`)

- Tetik: Personel İçe Aktarma → 1. adımdaki **⇩ Örnek Excel şablonunu indir**. Ekranın yetkisi (`personel.yaz` + yazılabilir çalışma) yeterlidir; `excel.aktar` istenmez, işlem kaydı yazılmaz. Dosya adı: `personel-sablonu-<grup adı>-<yıl>.xlsx` (grup adındaki `/ : * ? " < > |` atılır, boşluklar `-` olur).
- **1. sayfa "PERSONEL"** — doldurulacak sayfa, yalnız **başlık satırı** içerir (okuyucu ilk sayfayı okuduğundan şablon olduğu gibi yüklenirse kimse eklenmez). Başlık satırı dondurulmuş; kalın beyaz yazı, zemin `FF1E40AF`, dikey ortalı, yükseklik 22.

| Sütun | Alan | Başlık (varsayılan sözlükle) | Genişlik | Hücre biçimi |
|---|---|---|---|---|
| A | `tc` | T.C. Kimlik No | 16 | metin (`@`) — baştaki sıfır ve 11 hane korunur |
| B | `ad` | Ad Soyad | 26 | — |
| C | `ise_giris` | İşe Giriş Tarihi | 15 | tarih `dd.mm.yyyy` |
| D | `isten_ayrilis` | Çıkış Tarihi | 15 | tarih `dd.mm.yyyy` |
| E | `bolum` | Bölüm | 20 | — |
| F | `gorev` | Görev | 20 | — |
| G | `ekip` | Ekip | 14 | — |
| H | `yaka` | Yaka | 8 | 2.–1000. satırda Excel liste kuralı `B,M` (boş olabilir; hata başlığı "Yaka", metin "B ya da M yazın.") |
| I | `butce_bolumu` | Bütçe Bölümü | 22 | — |
| J | `maas` | Net Maaş | 14 | `#,##0.00` |
| K | `maliyet` | Gerçekleşen Maliyet | 18 | `#,##0.00` |

  Başlıklar **geçerli sözlükle tanınacak biçimde** seçilir: şablondaki başlık o alanın sözlüğüyle (`TO.eslestir`) eşleşiyorsa o kullanılır, eşleşmiyorsa (kullanıcı İçe Aktarma Başlıkları'nı değiştirdiyse) sözlüğün **ilk adayı** yazılır. Böylece indirilen şablon her zaman geri okunabilir.
- **2. sayfa "ÖRNEK VE AÇIKLAMA"** (okunmaz; genişlikler A 22, B 70 — kaydırmalı, üste hizalı — C 18):
  1. "Personel içe aktarma şablonu" (kalın, 13 pt)
  2. "Doldurulacak sayfa: PERSONEL (ilk sayfa). Bu sayfa okunmaz; yalnız açıklama ve örnektir."
  3. "Yalnız T.C. zorunludur; boş bırakılan sütun programdaki mevcut bilgiye dokunmaz. Sütun sırası önemli değildir."
  4. boş satır; başlık satırı "Sütun | Açıklama | Örnek" (kalın, zemin `FFEFF6FF`)
  5. her sütun için "başlık | açıklama | örnek" — açıklamalar: T.C. "Zorunlu. 11 hane." · Ad Soyad "Yeni eklenecek kişide zorunlu." · İşe Giriş "GG.AA.YYYY" · Çıkış "GG.AA.YYYY; çalışıyorsa boş." · Bölüm "Kişinin bölümü / departmanı." · Görev "Unvan / pozisyon." · Ekip "İsteğe bağlı." · Yaka "B = beyaz yaka, M = mavi yaka; boşsa beyaz." · Bütçe Bölümü "Tanımlar → Bütçe Bölümleri'ndeki ad (numarasız da olur)." · Net Maaş "Önceki yılın aylık NET maaşı (TL)." · Gerçekleşen Maliyet "Önceki yılın yıllık işveren maliyeti (TL); isteğe bağlı, karşılaştırma için."; örnek değerler uydurmadır (`SABLON` dizisinin 5. öğesi).
  6. grubun bütçe bölümü varsa: boş satır + "<grup adı> grubunun bütçe bölümleri | <bölüm adları, virgülle>".

#### 4.2.2 Alan eşlemesi

Okuma `TO` ile yapılır (§4.0): `.xlsx` için ilk sayfa, `.csv` / `.txt` ve yapıştırma için ayraç kendiliğinden bulunur; başlık satırı ilk 15 satırda aranır; sütunlar başlık adıyla (önce birebir, sonra "içerir") eşleşir. **Zorunlu alan yalnız `tc`.**

**Başlık eşleme sözlüğü — kullanıcı düzenler.** Okumada kullanılan sözlük `API.aktarimSozluk()`'tür: `{ sozluk: { alan: [başlıklar] }, etiket: { alan: ad }, degisen: { alan: true }, varsayilan }`. Varsayılanlar `api.js:AKTARIM_ALANLARI`'dadır (aşağıdaki tablo); kullanıcı Tanımlar → İçe Aktarma Başlıkları sekmesinden (§3.12.5) alan başına listeyi değiştirebilir. Değiştirilen alanlar `sistem_bilgi` tablosunda `aktarim.sozluk` anahtarıyla (JSON, yalnız varsayılandan farklı alanlar) saklanır; kaydı olmayan ya da boş listeli alan varsayılanı kullanır. Alanlar, etiketler ve alan sırası sabittir; yalnız aday başlıklar değişir. Adaylar karşılaştırmadan önce `TO.norm`'dan geçer (küçük harf, Türkçe karakter → ASCII, `.` ve `_` → boşluk); bu yüzden Türkçe karakterli ve karaktersiz yazımlar eşdeğerdir. "İçerir" eşleşmesi aşağıdaki **alan sırasıyla** yapılır ve yalnız 2 karakterden uzun adaylarla:

| Alan | Varsayılan aday başlıklar (aynen, `AKTARIM_ALANLARI`) | Ekran etiketi |
|---|---|---|
| `tc` | `tc`, `t c`, `tc kimlik`, `tc kimlik no`, `t c kimlik no`, `kimlik no`, `tckn`, `tc no` | T.C. |
| `ad` | `ad soyad`, `adi soyadi`, `adı soyadı`, `ad soyadi`, `personel`, `calisan`, `çalışan`, `isim` | Ad Soyad |
| `ise_giris` | `ise giris`, `işe giriş`, `ise giris tarihi`, `işe giriş tarihi`, `giris tarihi`, `giriş tarihi` | İşe Giriş |
| `isten_ayrilis` | `cikis tarihi`, `çıkış tarihi`, `isten cikis`, `işten çıkış`, `ayrilis`, `ayrılış`, `cikis`, `çıkış` | Çıkış |
| `bolum` | `bolum`, `bölüm`, `departman`, `birim` | Bölüm |
| `ekip` | `ekip` | Ekip |
| `gorev` | `gorev`, `görev`, `pozisyon`, `unvan`, `meslek` | Görev |
| `maas` | `net maas`, `net maaş`, `net ucret`, `net ücret`, `maas`, `maaş`, `ucret`, `ücret` | Net Maaş |
| `yaka` | `yaka`, `m b`, `m / b`, `m/b` | Yaka |
| `butce_bolumu` | `butce bolumu`, `bütçe bölümü`, `masraf merkezi` | Bütçe Bölümü |
| `maliyet` | `gerceklesen maliyet`, `gerçekleşen maliyet`, `toplam maliyet`, `yillik maliyet`, `yıllık maliyet`, `maliyet` | Gerçekleşen Maliyet |

**Satır dönüştürme** (`oku`; T.C.'si 11 hane olmayan satır atılır):

| Kaynak alan | Dönüşüm | Hedef | Yazma kuralı (`erpAktar`) |
|---|---|---|---|
| `tc` | `TO.tc` (yalnız rakamlar) | `personel.tc_kimlik_no`, `calisma_personel.tc_kimlik_no` | anahtar (`U.tcTemizle` ile yeniden süzülür) |
| `ad` | kırpılır; yazarken `U.bicimAd` (boşluk sadeleştirme) | `personel.ad_soyad` | doluysa güncellenir; yeni kişide **zorunlu** |
| `ise_giris` | `TO.tarih` → `YYYY-AA-GG` | `personel.ise_giris` | doluysa |
| `isten_ayrilis` | `TO.tarih` | `personel.isten_ayrilis` | doluysa |
| `bolum` | kırpılır | `personel.bolum` | doluysa |
| `ekip` | kırpılır | `personel.ekip` | doluysa |
| `gorev` | kırpılır | `personel.gorev` | doluysa |
| `maas` | `TO.sayi` (sayıysa olduğu gibi, metinse `API.trSayi`; boş → yok) | `calisma_personel.maas_eski` (önceki yıl net maaşı) | boş değilse; yeni kişide boşsa 0 |
| `yaka` | kırpılır, tr-TR büyük harf, **ilk karakter** ("Mavi" → `M`) | `calisma_personel.yaka` | yalnız `M` / `B` kabul; yeni kişide yoksa `B` |
| `butce_bolumu` | `BOLUM_TEMIZLE` (baştaki "08 ", "08- ", "8) " numarası atılır) + tr-TR büyük harf; grubun **tanımlı** bütçe bölümlerinden biriyle eşleşirse o bölümün adı | `calisma_personel.butce_bolumu` | eşleşmezse yok sayılır (mevcut değer korunur; yeni kişide boş) |
| `maliyet` | `TO.sayi` | `calisma_personel.maliyet_onceki` | boş değilse; yeni kişide boşsa boş |

**Yazma** (`api.js:erpAktar(id, satırlar, yeniEklensin)`; `personel.yaz` + çalışma yazılabilir; tek veritabanı işlemi):
- Çalışmada olmayan T.C. yalnız önizlemede **işaretlendiyse** (`yeniEklensin[tc]`) işlenir; işaretsizler atlanır.
- `personel` kaydı varsa: dolu kişi alanları (ad, işe giriş, çıkış, bölüm, ekip, görev) güncellenir, `kaynak = 'ERP'`, `guncelleme = şimdi`. Giriş ya da çıkış tarihi değişiyorsa kişiyi içeren **diğer** taslak çalışmalar eski tarihlerini kendi satırlarında saklar (`donemTarihleriniKoru`; o grubun dönemi bozulmaz). Kayıt yoksa yeni `personel` açılır (`kaynak = 'ERP'`); ad yoksa hata "<T.C.>: yeni personelin adı dosyada yok." ve bütün işlem geri alınır.
- Bu çalışmada satırı olan kişide: `maas_eski`, `maliyet_onceki`, `yaka`, `butce_bolumu` alanlarından boş olmayanlar güncellenir; sayaç `guncel` her bulunan kişide artar.
- Yeni bütçe satırı: `sira` = çalışmadaki en büyük sıra + 1; `butce_bolumu` (eşleşen ya da boş); `yaka` (listeden ya da `B`); `maas_eski` (listeden ya da 0); `maliyet_onceki` (listeden ya da boş); `hesap_turu = 'SSK'`; `kanun = 'YOK'`; `zam_ayi = 1`; sayaç `eklenen`.
- Dönüş `{ guncel, eklenen }`; işlem kaydı `AKTAR` ("<guncel> güncellendi, <eklenen> eklendi").

⚠ Yeniden kurarken dikkat:
- Önizlemedeki "Değişen" listesi **bütçe bölümü** farkını göstermez; uygulama ise eşleşen bütçe bölümünü yazar (yalnız bölümü değişen kişi "Değişiklik yok" sayılır ama yine güncellenir).
- Aday listesi kullanıcıya açık olduğundan kısa ya da genel bir aday (örn. `maliyet`, `ücret`) eklemek "içerir" eşleşmesini genişletir; sözlük değiştirildikten sonra önizlemedeki "Tanınan sütunlar" rozetleri denetlenmelidir.
- "İçerir" eşleşmesi kısa adaylarla beklenmeyen sütuna bağlanabilir: listede net maaş sütunu yoksa `maas` adayları "Brüt Maaş" gibi bir başlığa, `maliyet` adayı metin içeren bir "Maliyet …" sütununa, `yaka` adayı `m b` boşlukla birleşmiş bir başlığa ("Toplam Brüt" → "toplam brut") tutunabilir. Metin içeren bir hücre `TO.sayi`'den 0 olarak döner ve maaş / maliyet 0 yazılır. Önizlemedeki "Tanınan sütunlar" rozetleri hangi başlığın neye bağlandığını gösterir; uygulamadan önce bakılmalıdır.
- İşaretli yeni kişinin aynı yıl başka bir grupta kayıtlı olması yalnız rozetle uyarılır, engellenmez.
- Listede aynı T.C. birden çok satırda varsa hepsi sırayla işlenir; sonuncusu kalır.

---

### 4.3 Performans şablonu ve içe alma (`js/modules/performans.js`)

Şablonun sayfa adları, amir / kriter / ek puan sütunları, ağırlıkları, giriş denetimleri ve AÇIKLAMA sayfasının kuralları **çalışmanın değerlendirme modelinden** üretilir (`API.calismaPerformansModeli`, §3.6); içe alma da aynı modelin başlıklarıyla eşleştirir. Model değişirse şablon da değişir: eski modelle indirilmiş bir dosyadaki, yeni modelde olmayan başlıklar içe alınmaz. Aşağıdaki sütun harfleri **örnek model** içindir; genel kural her tablonun altında verilmiştir.

#### 4.3.1 Şablon (`sablonIndir`)

- Tetik: Performans Değerlendirme → **Excel şablonu indir**. `API.yetkiIste('excel.aktar')`. Dosya adı: `<Y> <GRUP ADI> PERFORMANS DEĞERLENDİRME.xlsx` (grup adı, yoksa grup kodu, büyük harf tr). İşlem kaydı `DISA_AKTAR` / `performans_girdi` "Excel şablonu". Kitap yazarı "Maaş Bütçe Sistemi".
- **Sayfalar:** her yaka için bir sayfa, sırayla mavi (`M`) ve beyaz (`B`), sonda **AÇIKLAMA**. Yaka sayfasının adı (`sayfaAdlari`): modeldeki Excel sayfa adı (boşsa yaka adının büyük harfi); Excel'de geçersiz karakterler (`\ / ? * [ ] :`) boşluğa çevrilir, boşluklar sadeleşir, en çok 28 karakter; sonuç boşsa "MAVİ YAKA" / "BEYAZ YAKA". Mavi sayfanın adı "AÇIKLAMA" ise sonuna " 1", beyaz sayfanınki "AÇIKLAMA" ya da mavininkiyle aynıysa " 2" eklenir (büyük / küçük harf farkı gözetilmez). Örnek modelde **MAVİ YAKA**, **BEYAZ YAKA**.
- Yaka sayfası: ilk 2 sütun ve ilk 4 satır dondurulmuş.
  - **A1:** "`<Y> <GRUP ADI> PERFORMANS DEĞERLENDİRMESİ — <SAYFA> (dönem <O>)`" (kalın, 13 pt, `FF1F3A5F`).
  - **A2:** "Sarı hücreleri doldurun. Kriter puanları 0–100. T.C. KİMLİK NO sütununu silmeyin; programa alırken satırlar buna göre eşleşir. Sütun başlıklarını değiştirmeyin. Boş bırakılan hücre programda da boşaltılır." (italik, 9 pt, `FF7A5210`).
  - **Satır 3 — amir grupları:** her amirin kriter sütunları birleştirilir (kriter sayısı 1'se birleştirme yok); metin "`<amir adı> (ağırlık <a>)`" (sayı en çok 3 ondalık, ondalık virgül; örnek modelde "1. AMİR (ağırlık 50)", "2. AMİR (ağırlık 30)", "İDARİ AMİR (ağırlık 20)"); kalın, ortalı, lacivert yazı, zemin `FFE9EFF7`. İlk kriter sütunu = 5 sabit + 1 + amir sayısı + 1 (örnek modelde **J**).
  - **Satır 4 — başlıklar:** kalın beyaz 9 pt, zemin `FF1F3A5F`, kaydırmalı, ortalı; satır yüksekliği 54. Kriter başlıklarına kriter ağırlığı eklenir: "`<amir adı> - <kriter adı> (<ağırlık>)`".
- Sütun düzeni (`SABIT` + `sutunlar(model, yaka)`):

| Sütun (örnek model) | Başlık | Genişlik | Doldurulur mu | Doğrulama kuralı (Excel) |
|---|---|---|---|---|
| A | T.C. KİMLİK NO | 14 | hayır — metin; `alan.tc` yoksa maskeli (§2.8); gri 9 pt | — |
| B | ADI SOYADI | 26 | hayır | — |
| C | BÜTÇE BÖLÜMÜ | 22 | hayır (`kp.butce_bolumu`) | — |
| D | GÖREVİ | 24 | hayır | — |
| E | İŞE GİRİŞ | 11 | hayır — **metin** `GG.AA.YYYY` | — |
| F | DEĞERLENDİRME BÖLÜMÜ | 24 | **sarı** | liste = mevcut bölüm adları (bu yakanın girdileri ∪ önceki dönemin bütün bölümleri, alfabetik); uyarı türü, metin "Var olan bölümlerden biri değil — yeni bölüm olarak alınır." |
| G, H, I | `<amir adı> ADI` (her amir için bir sütun) | 20 | sarı | — |
| J … | `<amir adı> - <kriter adı> (<ağırlık>)` — önce 1. amirin bütün kriterleri, sonra 2. amirin, … | 11 | sarı | ondalık 0–100, **durdurur**, "0 ile 100 arasında bir sayı girin." |
| sonra | ek puan alanları (model sırasıyla; başlık = alanın adı) | liste türü 16, diğerleri 12 | sarı | liste türü: liste = seçenekler, uyarı türü, "Listeden seçin."; sayı alanı: giriş sınırı varsa ondalık aralık, durdurur, "a ile b arasında bir sayı girin.", sınırı yoksa −1e9…1e9, durdurur, "Bir sayı girin." |

  Liste kuralı (bölüm ve seçenek listeleri) yalnız liste doluysa, virgülle birleşik metni 250 karakterden kısaysa ve öğelerde virgül ya da tırnak yoksa eklenir (`listeUygun`); değilse hücreye kural konmaz. Sütun sayısı = 5 + 1 + amir sayısı + amir sayısı × kriter sayısı + ek puan alanı sayısı. Örnek modelde mavi yaka 5 + 1 + 3 + 15 + 4 = **28** (A–AB; ek puan alanları Y DEVAMLILIK ORANI (%), Z TUTANAK SAYISI, AA KIDEM (YIL), AB MEZUNİYET); beyaz yaka 5 + 1 + 3 + 18 + 2 = **29** (A–AC; AB KIDEM (YIL), AC MEZUNİYET).
- Satırlar 5'ten başlar: o yakanın kişileri, çalışmadaki sırayla. F'den itibaren her hücre sarı (`FFFFF2CC`), ince (hair) sol ve alt çizgi `FFBBBBBB`; kişinin kayıtlı girdisi varsa yazılır (metin alanları metin, diğerleri sayı; sayıya çevrilemeyen değer metin).
- **Önceki dönemden önden doldurma** (`kaliciAlanlar`): kişinin bu çalışmada **hiç** girdisi yoksa ve önceki dönemde değeri varsa değerlendirme bölümü, amir adları ve modelde *önceki dönemden taşınsın* işaretli ek puan alanları (örnek modelde kıdem, mezuniyet) önceki dönemden yazılır. Önceki dönem (`api.js:performansOncekiDonem`): aynı grubun bir önceki yıl çalışmaları, onaylı olan önce; girdisi olan ilk çalışma.
- **AÇIKLAMA** sayfası (sütun genişlikleri A 46, B 12, C 90; başlık satırları kalın lacivert):
  1. "PUANLAMA (programın hesabı)"
  2. "1) Amir puanı = Σ kriter puanı × kriter ağırlığı / 100"
  3. "2) Değerlendirme = <amir adı> <ağırlık>, … ağırlıklı ortalama; puanı olmayan amirin ağırlığı diğerlerine dağıtılır" (örnek modelde "1. AMİR 50, 2. AMİR 30, İDARİ AMİR 20")
  4. "3) Bölüm katsayısı = bölüm ortalamalarının ortalaması / kişinin bölümünün ortalaması"
  5. "4) Toplam puan = değerlendirme × katsayı × (<mavi yaka adı> <degAgirlik> / <beyaz yaka adı> <degAgirlik>) / 100 + ek puanlar" (yaka adları küçük harf; örnek modelde "(mavi yaka 80 / beyaz yaka 80)")
  6. "5) Zam çarpanı = toplam puan / yakanın ortalama toplam puanı (değerlendirilmeyen kişi: 1)"
  - Her yaka için: boş satır; başlık "<SAYFA> — kriterler | Ağırlık" + her kriter "ad | ağırlık" + italik "Toplam | <ağırlık toplamı>"; başlık "<SAYFA> — ek puanlar | Giriş | Kural" + her ek puan alanı "ad | giriş | açıklama" — giriş: liste türünde "listeden", sınır varsa "a–b", yoksa "sayı"; açıklama `PERF.aciklama` metni (+ taşınan alanda " (Önceki dönemden taşınır.)"); ek puan alanı yoksa "(ek puan alanı yok)".
  - Önden doldurma yapıldıysa: boş satır, "Not" (başlık) ve "Henüz değerlendirmesi girilmemiş kişilerde <taşınan bilgiler> <önceki yıl> değerlendirmesinden önceden dolduruldu; kontrol edin. Taşınan değerler geçen yılın değeridir; zamanla değişenleri (ör. süreye bağlı sayılar) güncelleyin." (<taşınan bilgiler>: §3.6 Kart 1'deki liste).

#### 4.3.2 İçe alma (`oku`, `onizlemeHtml`, `baglaOnizleme`)

- Tetik: Performans Değerlendirme → **Excel'den içe al…** (`.xlsx`). Dosya okunur, **hiçbir şey yazılmadan** önizleme kartı gösterilir.
- **Sayfa ve başlık bulma:** dosyanın **bütün** sayfaları taranır. Bir sayfanın ilk 10 satırında normalize metni "T.C. KİMLİK NO" olan hücre aranır; bulunduğu satır başlık satırıdır. O satırdaki başlıkların sonundaki ağırlık eki "`(sayı)`" silinir, normalize edilir (`U.normalize` + boşluk sadeleştirme) ve iki yakanın şablon başlıklarıyla (`sutunlar(model, 'M') ∪ sutunlar(model, 'B')`: değerlendirme bölümü, amir adları, kriterler, ek puan alanları; A–E sabit sütunları hariç) eşleştirilir. Başlık satırı ya da eşleşen başlığı olmayan sayfa (örn. AÇIKLAMA) atlanır. Sütun ve sayfa sırası önemli değildir.
- Hiçbir sayfa uygun değilse: "Dosyada "T.C. KİMLİK NO" ve değerlendirme başlıkları olan bir sayfa bulunamadı. Programdan indirilen şablonu kullanın."
- **Satırlar** (başlık satırının altındakiler):
  - T.C. maskeli biçimdeyse (`123*****901`) satır atlanır ve sayılır. Dosyadaki bütün T.C.'ler maskeliyse ve başka satır okunamadıysa hata: "Bu dosyadaki T.C. numaraları maskeli (dosya, T.C. Kimlik No'yu tam görme yetkisi olmayan bir kullanıcı tarafından alınmış). Kişiler T.C. ile eşleştirildiği için içeri alınamaz; dosyayı bu yetkiye sahip bir kullanıcıya aldırın." ⚠ Satırların yalnız bir kısmı maskeliyse maskeli satırlar önizlemede hiçbir uyarı olmadan atlanır.
  - Rakamlar dışındaki karakterler atılır; 11 hane değilse satır sessizce atlanır.
  - Çalışmada olmayan T.C. → "bulunamayan" listesi (ad = T.C.'nin sağındaki hücre).
  - Yalnız kişinin **kendi yakasının** modeldeki alanları (`model.alanlar(yaka)`) alınır; her değer §3.6.1'deki `denetle` ile çözülür (kriter 0–100, ek puan alanında modelin giriş sınırı; liste türü büyük harfe). Hata → "<Ad> — <hata>"; **boş hücre `null` olur ve kayıtlı değeri siler**. Tarih biçimli hücre boş sayılır.
  - Uyarılar: liste türü ek puan alanında listede olmayan değer — "<Ad>: <alan adı (küçük harf)> "X" listede yok (N puan sayılır)" (N = modelin "listede olmayan" puanı); kişi kendi yakasının sayfasında değilse — "<Ad> <sayfa> sayfasında ama <yaka adı>" (sayfa adı `sayfaAdlari` ile karşılaştırılır).
  - Aynı kişi birden çok sayfada varsa alanlar birleştirilir.
- **Değişiklik:** metin alanlarında metin farkı, sayı alanlarında `PERF.sayi` farkı olan alanlar. **Etki:** yeni girdilerle `PERF.hesapla` çalışmanın modeliyle yeniden çalıştırılır; çarpanı (yoksa 1) değişecek kişiler listelenir.
- **Önizleme kartı** "İçe alma önizlemesi — <dosya adı>":
  - Açıklama: "N kişi okundu · **K** kişide A alan değişecek · sonrasında S kişi değerlendirilmiş olacak. Onaylamadan hiçbir şey yazılmaz."
  - Düğmeler: **Vazgeç** (önizleme silinir) · **İçe al** (yalnız `yaz`; değişiklik yoksa ya da **hata varsa kapalı**).
  - Hata kutusu (kırmızı): "**N hatalı değer** — dosyayı düzeltip yeniden seçin:" + ilk 30 hata ("…" ile devam).
  - Bulunamayan kutusu (sarı): "**N T.C. bu çalışmada yok** (alınmayacak): " + ilk 20 "ad + maskeli T.C." ("…" ile devam) — T.C. burada `alan.tc`'den bağımsız olarak **her zaman maskelidir**.
  - Uyarı kutusu (sarı): ilk 20 uyarı.
  - "Çarpanı değişecek kişiler (N)" tablosu (ilk 300 satır): Adı soyadı · Yaka (`M`/`B`) · Şimdiki çarpan (3 ondalık; yoksa "1,000 (yok)") · Yeni puan (2 ondalık) · Yeni çarpan (kalın; yoksa "1,000 (yok)").
  - Değişiklik var ama çarpan etkilenmiyorsa: "Değişiklikler çarpanı etkilemiyor (ad, bölüm adı gibi bilgiler)."
- **İçe al** → `API.performansGirdiYaz(c.id, liste, 'Excel: <dosya>')` (tek işlem; alanlar çalışmanın modeline göre yeniden denetlenir; işlem kaydı `KAYDET` / `performans_girdi`) → bildirim "K kişinin değerlendirmesi içe alındı. Çarpanları zam hesabına uygulamayı unutmayın." Çarpanlar kendiliğinden uygulanmaz (§3.6 **Çarpanları uygula**).

---

### 4.4 Fazla Mesai Planı — Excel düzeni (`js/modules/mesai.js:aktar / oku`)

Çıktı ve içe alma aynı düzeni kullanır; programın kendi düzenidir.

#### 4.4.1 Çıktı (`aktar`)

- Tetik: Fazla Mesai Planı → **Excel'e aktar**. `API.yetkiIste('excel.aktar')`. Dosya adı: `<Y> <GRUP ADI> MESAİ ÖNGÖRÜSÜ.xlsx` (grup adı, yoksa kodu, büyük harf tr). İşlem kaydı `DISA_AKTAR` / `mesai_ongoru` "Excel". Kitap yazarı "Maaş Bütçe Sistemi".
- Tek sayfa **"MESAİ ÖNGÖRÜSÜ"**; ilk 2 sütun dondurulmuş (satır dondurma yok). Sütun genişlikleri: A 11, B 40, Q 40 (diğerleri varsayılan). Girdi hücreleri sarı `FFFFF2CC`. Blok başlık satırlarında dolu hücreler kalın beyaz 9 pt, zemin `FF1F3A5F`.
- **Sütun düzeni:** **A** tür ("HAFTA İÇİ" / "HAFTA SONU") · **B** bölüm adı · **C–N** Ocak–Aralık toplam saat · **O** satır toplamı · **Q** bölüm adı (tekrar) · **R–AC** Ocak–Aralık kişi sayısı · **AD** kişi sayısı toplamı · **AE** kişi başı ortalama. O, AD, AE sütunlarının başlık hücresi yoktur; yalnız **AE7** = "KİŞİ BAŞI ORT." (biçimsiz).
- **Takvim (satır 1–6):**

| Satır | B | C–N |
|---|---|---|
| 1 | HAFTA SAYISI | formül `=C2/6` … `=N2/6` |
| 2 | HAFTAİÇİ ÇALIŞMA GÜNÜ | değer (girilmişse), sarı |
| 3 | MESAİLİ ÇALIŞILACAK TATİL GÜNÜ | değer, sarı |
| 4 | TAM KADRO ÇALIŞILACAK TATİL GÜNÜ | değer, sarı |
| 5 | ÇALIŞILMAYACAK TATİL GÜNÜ | değer, sarı |
| 6 | (boş) | formül `=SUM(C2:C5)` … |

- **Bloklar** satır 7'den, sırayla: (1) mavi yaka hafta içi (`fm1`), (2) mavi yaka hafta sonu (`fm2`), (3) beyaz yaka hafta sonu (`fm2`). Her blok:
  - **Başlık satırı:** B = "MAVİ YAKA" / "BEYAZ YAKA"; Q = "MAVİ YAKA-PERSONEL SAYILARI" / "BEYAZ YAKA-PERSONEL SAYILARI"; C–N ve R–AC = ay adları büyük harf ("OCAK" … "ARALIK").
  - **Bölüm satırları** (ekrandaki bölüm listesi, §3.7): A = "HAFTA İÇİ" / "HAFTA SONU"; B ve Q = bölüm adı; C–N = saat (boşsa **0**), sarı; R–AC = kişi sayısı — blok 1 ve 3'te değer (girilmişse o, girilmemişse **kadro**), sarı; blok 2'de formül = blok 1'deki aynı bölüm satırının aynı sütunu (mavi yaka hafta sonu kişi sayısı hafta içi tablosundan gelir; iki blokta bölüm listesi aynıdır). O = `=SUM(C<r>:N<r>)`, AD = `=SUM(R<r>:AC<r>)`, AE = `=IFERROR(O<r>/AD<r>,0)`.
  - Bir boş satır, ardından **toplam satırı** (kalın): C–N ve R–AC = `=SUM(<ilk>:<son>)`. Sonra bir boş satır ve sonraki blok.
- Son bloğun altında (bir boş satır daha bırakılarak) B sütununda not: "Sarı hücreler doldurulur. Saatler bölümün o aydaki TOPLAM mesai saatidir; kişi başı = saat ÷ personel sayısı. Bölüm adları personel kartındaki bölümle aynı olmalıdır. Mavi yaka hafta sonu kişi sayısı hafta içi tablosundan alınır." (italik, 9 pt, `FF7A5210`).
- ⚠ Kişi sayısı girilmemiş bölümlere dosyada **kadro** yazılır; dosya geri alınırsa bu sayılar açık değer olarak kaydedilir ("boş = kadro" davranışı o hücrelerde kalkar ve sonraki kadro değişikliğini izlemez).

#### 4.4.2 İçe alma (`oku`, `onizlemeHtml`)

- Tetik: Fazla Mesai Planı → **Excel'den al…** (`.xlsx`). Önce önizleme; onaylanmadan yazılmaz.
- **Sayfa:** adı boşluklar atılıp büyük harfe (tr) çevrildiğinde "MESAİÖNGÖRÜSÜ" olan sayfa. Yoksa: "Dosyada "MESAİ ÖNGÖRÜSÜ" sayfası yok."
- **Satır satır** (bütün satırlar; A ve B karşılaştırmaları boşluksuz büyük harfle):
  - B bir takvim satır adıysa → C–N değerleri (0 dâhil) ilgili takvim alanına (`gun, tatil_mesai, tatil_tam, tatil_yok`).
  - B "MAVİ YAKA" / "BEYAZ YAKA" **ve** C "OCAK" ise → o yakanın bloğu başlar.
  - Yaka belirlenmiş, B dolu ve A "HAFTA İÇİ" / "HAFTA SONU" ise bölüm satırıdır: hafta içi → `fm1`, hafta sonu → `fm2`. Beyaz yaka hafta içi satırı alınmaz (uyarı "<bölüm>: beyaz yaka hafta içi mesai hesaba girmez, alınmadı").
  - Saat: C–N'de boş olmayan ve **0 olmayan** değerler. Kişi sayısı: R–AC'de boş olmayan ve 0 olmayan değerler; yalnız **mavi yaka hafta içi** ve **beyaz yaka** satırlarından (mavi yaka hafta sonu bloğunun kişi sayıları okunmaz).
  - Sayı hücresi olduğu gibi; metin hücresi bu ekranın kuralıyla (noktalar silinir, virgül ondalık). Formül hücresinde hesaplanmış sonuç okunur; tarih hücresi boş sayılır.
  - Diğer satırlar (toplamlar, başlıklar, notlar) atlanır; O, AD, AE sütunları okunmaz.
  - Hiç bölüm satırı yoksa: "Sayfada bölüm satırı bulunamadı (A sütununda "HAFTA İÇİ" / "HAFTA SONU", B sütununda bölüm adı olmalı)."
- **Karşılaştırma:** aynı hücre (yaka + bölüm anahtarı + ay + alan) dosyada iki kez geçerse son değer alınır. Dosyadaki değer programdakinden farklıysa ya da bölüm adının yazımı farklıysa hücre yazılır; **programda olup dosyada olmayan hücreler (takvim ve kişi sayısı dâhil) boşaltılır.**
- **Önizleme kartı** "İçe alma önizlemesi — <dosya adı>":
  - Açıklama: "N bölüm satırı okundu · hafta içi X saat, hafta sonu Y saat · **K** hücre değişecek[ (S hücre dosyada olmadığı için boşalacak)]. Onaylamadan hiçbir şey yazılmaz."
  - Düğmeler: **Vazgeç** · **İçe al** (yalnız `yaz`; değişiklik yoksa kapalı).
  - Dikkat kutusu: "**N bölümde bu çalışmada kişi yok** — bu saatler kimseye dağılmaz. Bölüm adı personel kartındakiyle aynı mı?" + "Mavi: <bölüm> · Beyaz: <bölüm> …" listesi (saat satırı olup o yaka + bölümde kişisi olmayanlar).
  - Diğer uyarılar (alt alta).
- **İçe al** → `API.mesaiYaz(c.id, liste, 'Excel: <dosya>')` (tek işlem; işlem kaydı `KAYDET` / `mesai_ongoru`) → bildirim "Mesai öngörüsü içe alındı (N hücre)." Öngörünün açık/kapalı durumu değişmez.
- Bölüm eşlemesi kişinin kart **Bölüm** alanıyladır (bütçe bölümüyle değil); iç boşluklar teke indirilip büyük harfe çevrilerek karşılaştırılır.

---

### 4.5 Yedek dosyası (bilgi)

`.db` (SQLite veritabanının tamamı; şifreleme açıksa şifreli). Excel değildir.
- **Alma:** Sistem → **Yedeği indir** (`ADB.yedekIndir`; dosya adı `maas-butce-yedek-YYYYAAGG-SSDD.db`, yerel saat) ya da **Yedeği "yedek-elle" klasörüne kaydet** (sunucu üzerinden, `POST /yedek-kaydet`); çakışma perdesindeki **⤓ Yedek Al** aynı indirmeyi yapar (§1.2). Sunucu ayrıca kayıt sırasında `yedek` klasörüne otomatik kopya alır (en çok 10 dakikada bir; son 20 kopya tutulur).
- **Geri yükleme:** Sistem → **Yedekten geri yükle** (`accept=".db"`) ya da giriş ekranındaki **Giriş yapamıyorum** bölümü (`accept=".db,.sqlite,.sqlite3"`). Önce mevcut hâl yedeklenir; dosya SQLite değilse ya da `personel` tablosu yoksa reddedilir; şifreli yedek bellekteki anahtarla açılamazsa "Şifreli Yedek" parola perdesi açılır (§1.2). Başarıda sayfa yenilenir.
- Ayrıntı (klasörler, kopya sayıları, şifreleme): "01 — Veri Modeli ve Depolama", §6.5 Şifreleme ve §6.6 Yedekleme.

---

## 5. Ekranlar arası gezinme haritası

```
Açılış ──► (şifreliyse) Veri parolası ──► Giriş ──► Özet (varsayılan açılış; app.js:uygulamayiAc)
           (kullanıcı yoksa) Veri parolası belirleme ──► İlk kurulum (Örnek veriyle / Boş başla) ──► Özet

Üst çubuk: Yıl / Grup / Çalışma seçimi ──► etkin ekran yeniden çizilir (her ekranda)
           Grup yokken: "Tanımlar → Gruplar" yönlendirme metni (yöneticiye; bağlantı değil)
Menü:      Genel · Bütçe · İçe / Dışa Aktarma · Tanımlar · Yönetim (§1.3) ──► ilgili ekran
           "İçeriğe geç" (klavye) ──► #icerik
Sol alt:   📖 Kullanım Kılavuzu ──► Kılavuz ──"Ekranı aç →"──► parametre, calisma, aktarim, personel,
                                                             performans, aylik, mesai, excel, ozet,
                                                             maliyet, dagilim, tanim, kullanici, sistem
           Çıkış Yap ──► Giriş perdesi

Eksik çalışma uyarısı (herhangi bir çalışmalı ekran)
   ├─ "<yıl> yılına geç" ──► aynı ekran, diğer yıl
   └─ "<yıl> çalışması aç…" ──► Bütçe Çalışmaları + Yeni Çalışma penceresi

Bütçe Çalışmaları
   ├─ Aç ──► (yıl, grup, çalışma seçilir; Tümü'den çıkılır) ──► Özet
   ├─ + Yeni Çalışma ──► Yeni Çalışma penceresi ──Kaydet──► (yeni çalışma seçilir) Bütçe Çalışmaları
   ├─ Revize aç ──► onay ──► (revize seçilir) Bütçe Çalışmaları
   ├─ ✎ ──► Çalışma Ayarları penceresi ──Kaydet──► Bütçe Çalışmaları
   └─ 🗑 ──► "Çalışmayı Sil" onayı

Personel ve Zam
   ├─ ad ──► Kişi kartı penceresi ──► 🗑 Bütçeden çıkar ──► onay
   │                               └─ Kaydet (Grup = başka grup) ──► kişi taşınır; ekran kaynak çalışmada kalır
   ├─ 🗑 ──► Bütçeden Çıkar onayı
   └─ + Yeni Personel ──► Kişi kartı (boş)

Maliyet Tablosu ── ad ──► Bordro Dökümü penceresi
Maaş Dağılımı ── Aralıkları Düzenle ──► Maaş Aralıkları penceresi; Çıkar / Ekle ──► aynı ekran
Aylık Girdiler ── ay düğmesi ──► aynı ekran, başka ay; "<Ay> ayına uygula" ──► Toplu Giriş onayı
Performans ── satır ──► Kişinin değerlendirmesi penceresi ──"Değerlendirmeyi sil"──► onay
           ── Çarpanları zam hesabına uygula ──► onay ──► aynı ekran
           ── Excel'den içe al… ──► önizleme (aynı ekran) ──İçe al / Vazgeç──► aynı ekran
           ── Değerlendirme modeli… ──► Değerlendirme modeli penceresi (yetkisizde salt okunur)
                 ├─ Kaydet ──► (kaldırılan tanım varsa) "Kaldırılan tanımlar" onayı ──► aynı ekran, yeni modelle
                 └─ Varsayılan modele dön ──► onay ──► aynı ekran, örnek modelle
Fazla Mesai Planı ── Öngörüyü aç ──► onay; <O> tablosunu kopyala ──► onay (tablo doluysa)
               ── Excel'den al… ──► önizleme (aynı ekran)
Excel Raporu ── Dosya seç… ──► önizleme ──"K Değişikliği Uygula"──► Personel ve Zam
Personel İçe Aktarma ── "⇩ Örnek Excel şablonunu indir" ──► şablon dosyası iner (aynı ekran; §4.2.1)
                     ── dosya / "Yapıştırılanı oku" ──► önizleme ("Tümünü seç" / tek tek işaret) ──"Aktarımı Uygula"──► onay ──► Personel ve Zam
Parametreler ── yıl seçimi ──► üst çubuğun yılı değişir
             ── "<hedef> parametrelerini oluştur" ──► onay ──► üst çubuk hedef yıla geçer
             ── "Resmî rakamlar girildi" ──► onay
Personel İçe Aktarma ·· "Tanınan başlıklar" notu ··> Tanımlar → İçe Aktarma Başlıkları (yalnız yönlendirme metni, bağlantı değil)
Tanımlar ── sekmeler; "Gruplar sekmesine geç" ──► aynı ekran, Gruplar sekmesi
         ── İçe Aktarma Başlıkları: "Varsayılan" (kutuya yazar) / "Başlıkları kaydet" ──► aynı ekran
         ── ✎ / + Yeni ──► Hesaplama Türü / Kanun Türü / Grup / Bütçe Bölümü penceresi (Bölüm: Birleştir ──► onay)
         ── Gruplar: ekle / düzenle / sil ──► seçili grup geçersiz kaldıysa üst çubuk yeni ya da ilk gruba geçer
         ── Bütçe Bölümleri: grup seçimi ──► üst çubuğun grubu değişir
Kullanıcılar ── Düzenle / + Yeni Kullanıcı ──► kullanıcı penceresi; 🗑 ──► onay
Sistem ── Örnek veriyi yükle ──► onay ──► (seçili grup geçersizse) ilk gruba geçilir
       ── Yedekten geri yükle ──► onay ──► (şifreliyse "Şifreli Yedek" perdesi) ──► sayfa yenilenir
       ── Sıfırla… ──► onay ──► "Son onay" ──► sayfa yenilenir ──► ilk kurulum perdeleri
Görüntüleme şeridi ── ↻ Şimdi kontrol et ──► (yetki geçerse) ekran tazelenir
Çakışma perdesi ── ↻ Sayfayı Yenile ──► sayfa yenilenir
```

Veri bağları (bir ekranın girdisi başka ekranda görünür):
- **Özet** Kart 1'e elle yazılan `<O>` maliyeti ve bütçelenen maliyet (`calisma_ozet`) ──► Excel Raporu'nun ÖZET sayfası (C, D sütunları).
- **Personel ve Zam** ← Personel İçe Aktarma (`maas_eski`, `maliyet_onceki`, yaka, bütçe bölümü; kişi kartının ad, tarih, bölüm, ekip, görev alanları) · Excel Raporu içe alma (`duzeltme`) · Performans "uygula" (`performans_carpani`, `zam_performans`) · Çalışma Ayarları (zam yöntemi, gruba özel kademe) · Parametreler (yılın genel zam kademesi, performans kademeleri).
- **Özet / Maliyet Tablosu / Bordro Dökümü / Excel Raporu** ← Personel ve Zam, Aylık Girdiler, Fazla Mesai Planı (öngörü açıkken), Çalışma Ayarları (gün, AR-GE günü, 05510 oranı), Parametreler, Tanımlar (hesaplama ve kanun türleri).
- **Fazla Mesai Planı** ← kişi kartının **Bölüm** alanı (eşleme anahtarı; bütçe bölümü değil).
- **Tanımlar → Gruplar** ──► üst çubuk grup düğmeleri, Kullanıcılar'daki grup erişim tablosu, Yeni Çalışma'daki grup listesi.
- **Tanımlar → Bütçe Bölümleri** ──► kişi kartı ve süzgeçlerdeki bölüm listeleri, Özet'in bölüm tablosu, Excel Raporu, Personel İçe Aktarma'nın bütçe bölümü eşlemesi ("NN AD" etiketi).
- **Bütçe Çalışmaları → Revize aç** ──► personel, düzeltmeler, aylık girdiler, performans girdileri ve mesai tablosu revizeye kopyalanır.
- **Değerlendirme modeli** (yılın parametresi) ──► Performans ekranının sütunları, kişi penceresi, Excel şablonu ve içe alma, dolayısıyla çarpanlar ("uygula" ile Personel ve Zam'ın zam öngörüsü). Yeni Yıl Öngörüsü ile yeni yıla kopyalanır; çalışma onaylanınca dondurulur.
- **Parametreler → Genel** ──► mesai katsayıları ve günlük saat: Maliyet Tablosu / Bordro Dökümü'nün mesai satırları; AR-GE eşiği: çalışmanın AR-GE günü ayarının hangi kişilere uygulandığı (Aylık Girdiler'deki AR-GE günü); yuvarlama adımı: Personel ve Zam'ın zam öngörüsü (Çalışma Ayarları'nda çalışmaya özel adım yoksa).
- **Tanımlar → İçe Aktarma Başlıkları** ──► Personel İçe Aktarma'nın sütun eşlemesi (bütün gruplar ve yıllar).
- **Maaş Dağılımı**'nın Çıkar / Ekle seçimi yalnız o ekranı etkiler; sabit maaş aralıkları grup düzeyindedir (bütün yıllarda ortak).
- **Kullanıcılar** ──► kullanıcının menüsü ve grup düğmeleri (her ekran geçişinde yeniden okunur). **Sistem → Otomatik Kapanma** ──► hareketsizlik perdesi (§1.2).

---

## 6. Doğrulanamayan ve dikkat edilecek noktalar

**Görseller**
1. `program/img/kilavuz/*.png` görselleri (§3.15'teki 13 ad) Kılavuz'da gösterilir; `kilavuz.js` onları adlarıyla çağırır ve örnek veriden çekildiklerini söyler. Arayüz değiştikçe aynı adlarla yeniden çekilmeleri gerekir. Bu belge görsellere dayanmaz: görsel ile anlatım ayrışırsa kod esastır.

**Doğrulanamadı**
2. Ekranların güncel görüntüsü yoktur; düzenler yalnız koddan çıkarıldı (CSS kurallarının görsel sonucu tek tek denenmedi).
3. `.hucre-girdi.hata` sınıfının (Fazla Mesai Planı'nda geçersiz değerde eklenir) CSS kuralı yoktur; kutu görsel olarak işaretlenmiyor olabilir (`mesai.js:ciz`).
4. Sunucu uçlarının (`/veri-bilgi`, `/kilit`, `/yedek-kaydet`, `DELETE /veri`) yanıt biçimi yalnız ekranın kullandığı alanlarla verildi; otomatik yedek kuralları (son 20 kopya, en çok 10 dakikada bir; `yedek-elle` son 30 kopya) `Sunucuyu-Baslat.ps1`'den okundu.
5. Bordro Dökümü satırlarının anlamı ekran etiketlerinden verildi; kesin tanımlar "02 — Hesap Motoru", §3.12'dedir (`maliyet.js:DOKUM`).
6. Excel Raporu ÖZET sayfasında bölümsüz kişilerin satırında bölüm hücresi (A) boş kalır; Excel `COUNTIF` / `SUMIF`'te boş ölçütü farklı yorumlayabilir ve bu satır bölüm toplamını eksik gösterebilir. Kişisi olmayan çalışmada ZAM ÇALIŞMASI toplam satırı ters aralıkla kurulur (`G5:G4`). İkisi de Excel'de denenmedi (`excel.js:aktar`).
7. Örnek verinin tam içeriği (yıllar, çalışma adları, kişi sayısı) bu belge için okunmadı; yalnız grup kodları (`OFIS`, `URETIM`) doğrulandı.

**Koddan doğrulanan, yeniden kurarken dikkat edilmesi gereken davranışlar**

*Kabuk ve ortak*
8. "Kaydediliyor…" göstergesi tanımlı ama hiç çağrılmıyor (`app.js:kayitBekliyor`); Kılavuz'un "Başlarken" bölümü bu durumdan söz eder.
9. Görüntüleme kipinde girdiler açık kalır; kayıt denemesi hata bildirimiyle reddedilir (§2.2).
10. "Tümü" uyarı metni yalnız Özet ve Maliyet Tablosu'nu sayar; Maaş Dağılımı da "Tümü"yü destekler (`app.js:git`; Kılavuz "Ekranın düzeni" aynı eksikle).
11. "Tümü"de her grubun yalnız **ilk** çalışması birleştirilir; üst çubuktaki çalışma seçimi Tümü'de dikkate alınmaz (`app.js:calismalar`).
12. Eksik çalışma uyarısı "Tümü"de de "Bu grubun <yıl> çalışması var" der (`app.js:git`).
13. `APP.tazele()` ekranı açılış parametresi olmadan yeniden çizer (`app.js:tazele`).
14. T.C. araması `alan.tc`'ye bakmaz; Excel Raporu önizlemesinde adı olmayan kişinin T.C.'si ve Personel İçe Aktarma'nın "yeni personelin adı dosyada yok" hatasındaki T.C. tam yazılır (§2.8).
15. Kişi bütçeden çıkarılınca üst çubuktaki çalışma seçicisinin "N kişi" metni yeniden çizilmez (menü rozeti ve 🗂 bandı güncellenir) (`personel.js:sil`).
16. Simgelerin SVG'ye çevrilmesi görünüm katmanında, sonradan (`MutationObserver`) yapılır: yalnız düğme, başlık, `.logo`, `summary`, `.ik` ve `.kl-git` içindeki işaretler çevrilir; bildirim kutusundaki (`.toast`) ya da düz metindeki ⚠ ✓ gibi işaretler karakter olarak kalır (`ikon.js:donustur`). Yeniden kurarken simgeyi doğrudan SVG olarak çizmek yeterlidir.

*Özet ve Maaş Dağılımı*
17. Özet Kart 1'deki `<O>` toplam maliyeti elle girilen çalışma rakamıdır; Kart 2 ve Kart 4'teki `<O>` maliyeti kişi satırlarındaki `maliyet_onceki` toplamıdır; ikisi farklı çıkabilir (`ozet.js:ciz`).
18. Özet girdilerinde Enter ve `change` olayının ikisi de kaydeder (aynı değer iki kez yazılabilir; zararsız). Bölüm tablosu "Tümü"de grup sırasına değil grup koduna göre dizilir (`ozet.js:ciz`).
19. Maaş Dağılımı'nda geçerli sınır içermeyen metinle "Sabitle"ye basılınca API önce grubun sabit aralıklarını siler, sonra "Geçerli bir sınır girilmedi." hatası çıkar (`dagilim.js:aralikDuzenle`, `api.js:maasAralikYaz`). Maaşı olan kişi yoksa tablo tek satır "0 altı" gösterir; aynı yıl içinde girip çıkan kişi "çıkış" sayılır ve varsayılan olarak listede kalır.

*Personel ve Zam, kişi kartı, Aylık Girdiler*
20. Personel ve Zam'da hücre kaydından sonra kaydırma / odak korunmaz (yalnız Aylık Girdiler'de korunur).
21. Kişi kartında Zam Düzeltmesi, Performans Puanı ve Çarpanı `zam.oku` / `zam.yaz` denetimi olmadan görünür ve `personel.yaz` ile kaydedilir; tablodaki Düzeltme hücresi `zam.yaz` ister (`personel.js:formAc`).
22. Kişi kartında boş seçeneği olmayan seçimlerde (Hesaplama Türü, Kanun, AR-GE GV Teşvik Oranı, Yaka) kayıttaki değer listede yoksa ilk seçenek görünür ve Kaydet onu yazar (`personel.js:formAc`).
23. Kişi kartında T.C. yalnız uzunlukla denetlenir; kontrol hanesi algoritması (`U.tcGecerliMi`) kullanılmaz (`api.js:calismaPersonelKaydetIc`).
24. Kişi kartındaki "iki grupta birden maliyeti sayılır" uyarısı aynı grubun başka çalışmasını (revize) da sayar; önden doldurma notu son çalışma daha eski yıldan olsa da "<O> yılının zamlı maaşı" yazar (`personel.js:gecmisHtml`).
25. Aylık Girdiler'de "Çalışılan Gün" yer tutucusu her zaman "30"dur; çalışmanın varsayılan gün ayarı (`gun.<yaka>.<ay>`) yer tutucuya yansımaz (`aylik.js:ciz`).
26. Fazla Mesai Planı açıkken hafta içi / hafta sonu mesai (`fm1` / `fm2`) önceki aydan devralınmaz, bölüm tablosundan gelir; Aylık Girdiler'deki ipucu yine "Önceki aydan devralındı", kart metni "mesai saatleri devreder" der (`aylik.js:ciz`, `api.js:calismaHesapla`).
27. Bordro Dökümü'nde Kanun satırı kanun türünün kodunu değil kural kodunu gösterir (`maliyet.js:dokumAc`).

*Performans Değerlendirme*
28. Performans içe almasında boş sarı hücre kayıtlı değeri siler (şablon metni de bunu söyler); tarih biçimli hücre boş sayılır (`performans.js:oku`).
29. "Çarpanları uygula" çalışmadaki her kişinin `performans_carpani` alanını yeniden yazar, değerlendirilmeyenlerinkini boşaltır; kişi kartına elle yazılmış çarpan da değişir. Boş çarpanda motor kişinin puanına ve Parametreler → Performans Kademeleri'ne bakar; ekrandaki "değerlendirilmeyenin çarpanı 1" her zaman gerçekleşmez (`api.js:performansCarpanUygula, performansCarpani`).
30. Performans araması T.C. ile aramaz (ad, değerlendirme bölümü, bütçe bölümü).
31. Performans ve Mesai içe almalarının `excel.aktar` kapısı yalnız arayüzdedir; API yalnız `zam.yaz` / `aylik.yaz` ister (`performans.js:oku`, `mesai.js:oku`).
32. Değerlendirme modeli penceresi seçili çalışmanın **yılının** modelini düzenler ve yalnız `parametre.yaz` ister (`zam.yaz` ya da gruba yazma erişimi gerekmez); onaylı çalışmadan açılsa da yılın modelini değiştirir, onaylı çalışma dondurulmuş modelle kalır (`performans.js:modelAc`).
33. Model kaydında değişiklik denetimi yoktur: varsayılan modelle açılan pencerede hiçbir şey değiştirmeden Kaydet'e basmak yıla özel bir kayıt oluşturur (`performans.js:modelAc`).
34. Model değişince puan ve çarpanlar hemen yeniden hesaplanır ama zam hesabına geçmez; "Zamda uygulanan" sütunu ⚠ gösterir. Kaldırılan amir / kriter / ek puan alanının girilmiş değerleri `performans_girdi`'de kalır ve aynı kodla yeniden eklenince geri gelir (`performans.js:kaldirilanlar`).
35. Eski modelle indirilmiş bir şablon yeni modelle içe alınırsa yeni modelde olmayan başlıklar uyarısız alınmaz; ağırlığı değişen kriterin başlığı ise ağırlık eki silindiği için yine eşleşir (`performans.js:oku`).
36. Liste türü ek puan alanlarında Excel liste kuralı yalnız seçenekler virgül / tırnak içermiyorsa ve birleşik metin 250 karakterden kısaysa eklenir; değilse hücre serbest kalır, listede olmayan değer içe almada uyarıyla "listede olmayan" puanını alır (`performans.js:sablonIndir, oku`).

*Fazla Mesai Planı*
37. Mesai Excel çıktısı girilmemiş kişi sayılarına kadro yazar; dosya geri alınınca bunlar açık değer olur ("boş = kadro" davranışı o hücrelerde kalkar) (`mesai.js:aktar`).
38. Mesai içe almasında dosyada olmayan hücreler (takvim ve kişi sayısı dâhil) programda boşaltılır; 0 olan saat ve kişi sayısı okunmaz; metin "12.5" değeri 125 olur (noktalar binlik sayılır) (`mesai.js:oku, sayi`).
39. Kadro sayısı kişinin o ay çalışıp çalışmadığına bakmaz (`api.js:mesaiKisiBasi`). Hücre kaydından sonra üstteki "Aylık özet", uyum bilgisi ve brüt mesai ekran yeniden çizilene kadar eski kalır (`mesai.js:toplamGuncelle`).
40. "<O> tablosunu kopyala" saat tablosu boşken onay sormaz; yalnız takvim girilmişse takvimi de sessizce değiştirir (`mesai.js:ciz`, `api.js:mesaiKopyala`). Bölüm adının yazımı dosyada farklıysa yeni satır eklenir ama eski satır silinmez.

*Bütçe Çalışmaları, Excel Raporu, Personel İçe Aktarma*
41. Bütçe Çalışmaları'nda 🗑 onaylı çalışmada da görünür; onaydan sonra API "onaylı ve kilitli" hatasıyla reddeder (`calisma.js:ciz`, `api.js:calismaSil`).
42. Yeni çalışmanın açılması ile personelin kopyalanması ayrı işlemlerdir; kopyalama hata verirse boş çalışma kalır (`calisma.js:form`).
43. Çalışma Ayarları kutularına sayı olmayan metin yazılırsa 0 kaydedilir (`calisma.js:ayarOku`); yuvarlama adımına 0 yazılması da böyle kaydedilir. Motorun okuduğu `tesvik.k05746 / k14857 / k15510` ayarlarının ekranda girişi yoktur.
44. Excel Raporu dosya adındaki tarih UTC günüdür (gece yarısından sonraki ilk saatlerde bir önceki gün yazılabilir) (`excel.js:aktar`). Maskeli ve tam T.C.'li satırlar karışıksa maskeliler sessizce atlanır (`excel.js:oku`).
45. Personel İçe Aktarma önizlemesi bütçe bölümü farkını göstermez ama uygulama yazar; bitiş bildirimindeki "güncellendi" sayısı değişmeyen kişileri de sayar (`aktarim.js:onizlemeHtml`, `api.js:erpAktar`).
46. Personel İçe Aktarma'da "içerir" eşleşmesi yanlış sütuna tutunabilir (örn. metin içeren bir "Maliyet …" sütunu 0 olarak okunur; "Toplam Brüt" başlığı yaka adayı `m b`'yi içerir); önizlemedeki "Tanınan sütunlar" rozetlerine bakılmalıdır (`tablooku.js:eslestir`, `API.aktarimSozluk`). Sözlük kullanıcıya açık olduğundan genel bir aday eklemek bu riski artırır. Aynı yıl başka grupta kayıtlı kişinin eklenmesi yalnız rozetle uyarılır.
47. Tanımlar → İçe Aktarma Başlıkları'nda T.C. dışındaki bir alanın kutusu boşaltılıp kaydedilirse alan kapanmaz, varsayılan başlıklarına döner; bir alanın aktarımını kapatmanın ekranda yolu yoktur (`tanim.js:ciz`, `api.js:aktarimSozlukYaz`).
48. Personel İçe Aktarma şablonu `excel.aktar` istemez, işlem kaydına yazılmaz ve ExcelJS'in yüklü olup olmadığını denetlemez (kütüphane yoksa bildirimde ham hata metni çıkar) (`aktarim.js:sablonIndir`).
49. "Tümünü seç" bu yıl başka bir grupta kayıtlı kişileri atlar, ama bu kişiler tek tek işaretlenebilir ve eklenebilir; kutu, ekran yeniden çizilince işaretlenebilecek herkes işaretliyse işaretli gelir (`aktarim.js:onizlemeHtml, bagla`).

*Parametreler, Tanımlar, Kullanıcılar, Sistem, Kılavuz*
50. Parametreler'deki yıl seçici üst çubuğun yılını değiştirir; öngörü önizlemesi yıl üst çubuktan değişince eski kaynak / hedef yılı göstermeye devam eder; "Oluştur" formu yeniden okur (önizlemeden sonra değiştirilen alan önizlenmeden uygulanır) (`parametre.js:ongoruKarti, ongoruBagla`).
51. Oranların giriş biçimi karışıktır: Parametreler'in genel oranları **ondalık** (`0,00759`), zam oranları, GV dilim oranları, hesaplama türü oranları ve 05510 oranları **yüzde** girilir. Asgari ücret, dilim ve kademe satırlarındaki 🗑 satırı yalnız ekrandan kaldırır; kalıcı olması için ilgili "kaydet" düğmesi gerekir. Performans kademelerinde aralık denetimi yoktur.
52. Parametreler → Genel'deki "günlük çalışma saati" 0 ya da boş girilirse motor sessizce 7,5 kullanır (`hesap.js:ayHesapla`, `P.gunlukSaat || 7.5`). AR-GE eşiği yılın parametresidir (`arge_gv_esik`); Aylık Girdiler'deki AR-GE günü ipucu ve Çalışma Ayarları'ndaki AR-GE notu bu parametreyi okur (`aylik.js:ciz`, `calisma.js:ayarHtml`).
53. Parametreler'deki 🔒 bandı kullanıcının göremediği gruplar dâhil yılın bütün onaylı çalışmalarını adıyla listeler (`api.js:yilOnayliCalismalar`).
54. Hesaplama ve kanun türü kaydı var olanın üzerine yazar: "Yeni" pencereye var olan bir kod yazılırsa o tür sessizce değişir (`api.js:hesapTuruKaydet, kanunKaydet`). Silme denetimi kanun türünde bütün yıllara, hesaplama türünde yalnız seçili yıla bakar.
55. Grup kodu Türkçe kurala göre büyük harfe çevrilir ("i" → "İ"); düzenlemede boş bırakılan sıra 0 olur (`api.js:grupKaydet`). Tanımlar'ın `param.sekme` girişini kullanan çağrı yoktur; Kılavuz'un "Gruplar" bölümündeki "Ekranı aç" Tanımlar'ı Gruplar sekmesiyle açmaz.
56. Bütçe bölümü adını değiştirmek ya da bölüm birleştirmek grubun bütün yıllarındaki bütçe satırlarını günceller; onaylı çalışmalar da buna dâhildir (`api.js:butceBolumuKaydet, butceBolumuBirlestir`).
57. Kullanıcı penceresinde "Sistem yöneticisi" işaretliyken de grup erişimi ve yetkiler kaydedilir; yeni kullanıcı eklenip erişim yazımı hata verirse kullanıcı erişimsiz kalır (yeniden Kaydet "Bu kullanıcı adı zaten kayıtlı." der) (`kullanici.js:form`).
58. Sistem → Yedek kartı "her kayıttan önce otomatik kopya alınır" der; sunucu en çok 10 dakikada bir kopya alır. Geri yükleme onayından vazgeçilince dosya alanı sıfırlanmaz (aynı dosya yeniden seçilirse işlem tetiklenmez). Sistem ekranı yalnız `.db` kabul eder, giriş ekranı `.db`, `.sqlite`, `.sqlite3` (`sistem.js:ciz`).
59. Kılavuz'da bölümlerin hedef kitlesi ("Yönetim", "Sistem yöneticisi") yalnız rozettir; bütün bölümler herkese görünür. "Yeni yıl" ve "Parametreler" bölümlerindeki "kaynak yıl her zaman seçili yılın bir öncekidir" ifadesi kodla tam uyuşmaz (önceki yıl yoksa kaynak seçili yıldır ve kaynak elle seçilebilir); "Bütçe Çalışmaları" bölümü AR-GE çalışılan gün ayarını anmaz (`kilavuz.js:BOLUMLER`).
