# Maaş Bütçe Sistemi

Tanımladığınız grupların (ör. Ofis, Üretim) yıllık maaş bütçesini, zam çalışmasını ve
ay ay işveren maliyetini (mini bordro: brüt, SGK, gelir ve damga vergisi, teşvikler)
hesaplar. Tarayıcıda çalışır; kurulum ve internet gerekmez, veri bu bilgisayarda kalır.

## Başlatma

`BUTCE-BASLAT.bat` dosyasına çift tıklayın. Tarayıcıda **http://localhost:8764/**
açılır. Siyah pencere açık kaldığı sürece program çalışır; kapatınca durur.
Yönetici yetkisi gerekmez, Windows PowerShell yeterlidir.

Programı gerçek veriye dokunmadan denemek için `Sunucu-Test-8794.ps1`
(geçici klasörde ayrı veriyle, http://localhost:8794/) kullanılabilir.

## İlk kurulum

1. **Veri parolası:** veri dosyasını şifrelemek için ortak bir parola belirleyin ya da
   "Şifresiz devam et" deyin. Parola kaybolursa veri kurtarılamaz.
2. **Yönetici hesabı:** girişte kullanacağınız ad ve parola.
3. **Başlangıç:**
   - *Örnek veriyle başla* — uydurma iki grup (Ofis, Üretim), personel ve çalışmalar;
     programı tanımak için.
   - *Boş başla* — yalnız yasal parametreler ve "Genel" grubu. Kendi gruplarınızı
     **Tanımlar → Gruplar** sekmesinden ekleyin.

Örnek veriden gerçek kullanıma geçerken **Sistem → Veritabanını Sıfırla** ile ilk kurulum
ekranına dönün (önce otomatik yedek alınır) ya da örnek grupları ve çalışmalarını silin.

Diğer kullanıcılar **Yönetim → Kullanıcılar** ekranından eklenir. Görecekleri ve
düzenleyecekleri gruplar ile yetkileri kişi kişi atanır.

## Ekranlar

| Menü | Ekran | İş |
|---|---|---|
| Genel | Özet | Yaka ve bütçe bölümü toplamları, bütçelenen tutar ve fark; "Tümü" ile bütün gruplar |
| Genel | Maaş Dağılımı | Maaş aralıklarına göre kişi sayısı ve sıralı maaş listesi |
| Bütçe | Personel ve Zam | Bütçe satırları, zam öngörüsü, yönetim düzeltmesi, kişi kartı |
| Bütçe | Maliyet Tablosu | Kişi × ay tutarlar; kişiye tıklayınca 12 aylık bordro dökümü |
| Bütçe | Aylık Girdiler | Aynî yardım, prim, mesai, yakıt, AR-GE günü; yıl içi hesaplama türü / kanun değişikliği |
| Bütçe | Performans Değerlendirme | Amir değerlendirmeleri, bölüm katsayısı ve zam çarpanı; yıl bazında düzenlenen değerlendirme modeli (amirler, kriterler, ağırlıklar, ek puanlar); Excel şablonu |
| Bütçe | Mesai Öngörüsü | Bölüm × ay mesai saati ve kişi sayısı; kişi başı mesai |
| Bütçe | Çalışmalar | Yıl × grup çalışmaları (taslak / onaylı / revize), zam yöntemi |
| Bütçe | Yönetim Raporu | Yönetime giden Excel ve geri dönen düzeltmelerin içeri alınması |
| Veri | Dış Liste Aktarımı | ERP / bordro programından güncel maaş ve personel listesinin alınması |
| Tanımlar | Parametreler | Asgari ücret, GV tarifesi, SGK ve teşvik oranları, zam kademesi, sakatlık indirimi, mesai katsayıları |
| Tanımlar | Tanımlar | Gruplar, hesaplama türleri (SSK / Emekli / SGK'sız), kanun türleri, bütçe bölümleri, aktarım başlıkları |
| Yönetim | Kullanıcılar | Kullanıcılar, grup erişimi ve yetkiler |
| Yönetim | Sistem | Yedek, veri şifreleme, işlem kaydı, örnek veri, sıfırlama |

Ayrıntılı anlatım programın içindedir: sol alttaki **📖 Kullanım Kılavuzu**.

## Yedek

Veri diskte tek dosyadadır: program klasörünün yanındaki `veri\butce.db` (isteğe bağlı şifreli).
Program açılışta dosyayı belleğe alır, her değişiklikte tamamını geri yazar.

- Sunucu her kayıttan önce en çok 10 dakikada bir `yedek\` klasörüne otomatik yedek alır (son 20).
- **Sistem → Yedeği "yedek-elle" klasörüne kaydet** `yedek-elle\` klasörüne yazar (son 30).
- **Sistem → Yedeği indir** tarayıcının indirme klasörüne bir kopya verir.
- **Sistem → Yedekten geri yükle** yalnız sistem yöneticisi içindir; yüklemeden önce mevcut hâl yedeklenir.

Veri şifreliyse yedekler de şifrelidir; yedek, alındığı andaki veri parolasıyla açılır.
