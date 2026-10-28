# Değişiklik günlüğü

Her sürümde nelerin değiştiği burada yazar. Sürüm numaraları **ana.ara.yama** biçimindedir:

- **yama** (1.0.**1**): hata düzeltmesi; veri ve kullanım değişmez.
- **ara** (1.**1**.0): yeni özellik; mevcut veri olduğu gibi açılır.
- **ana** (**2**.0.0): dikkat gerektiren değişiklik; geçiş notu bu dosyada yer alır.

Programın sürümü sol alttaki "Sürüm" yazısında görünür. İndirmek için:
[Sürümler (Releases)](https://github.com/kgelgec/ucret-hesaplama/releases). Yeni sürüme geçiş adımları README'dedir.

## [1.0.0] — 2026-10-28

İlk açık sürüm.

### Neler var

- **Bütçe çalışmaları:** grup × yıl bazında bütçe; önceki yılın zamlı maaşlarından, aynı yılın kopyasından ya da
  boş açılış. Onaylanan çalışma parametreleriyle birlikte dondurulur, sonradan revize açılabilir.
- **Ücret esası:** her çalışma net ya da brüt esaslı açılır. Yeni yıl, kopya ve revize esası kaynaktan devralır; tutar
  girilmiş çalışmanın esası değiştirilemez. Böylece yıllar arası karşılaştırma hep aynı esasta yapılır.
- **Zam öngörüsü:** maaş kademesine göre oran, isteğe bağlı performans çarpanı, kişi bazında yönetim düzeltmesi.
- **Mini bordro:** kişi × ay işveren maliyeti; SGK işçi / işveren payları, tavan, kümülatif gelir vergisi, damga
  vergisi, asgari ücret istisnası, BES, sakatlık indirimi ve teşvikler (05510, 05746 AR-GE, 14857, 15510). Kişi
  bazında 12 aylık bordro dökümü.
- **Aylık girdiler:** prim, ayni yardım, yakıt, fazla mesai saati, çalışılan gün, AR-GE günü; yıl içinde
  hesaplama türü ya da kanun değişikliği.
- **Personel:** kişi kartı; temel tanımlar (bölüm, yaka, tarihler, hesaplama türü, kanun, teşvik, sakatlık, BES,
  zam ayı, performans) tablodan da düzenlenir. Grup taşıma, bütçeden çıkarma.
- **Personel İçe Aktarma:** Excel / CSV listesi ya da ERP / bordro programı çıktısı başlık adlarıyla tanınır;
  örnek Excel şablonu indirilebilir.
- **Excel:** yönetime sunulacak bütçe raporu ve yönetimin düzeltmelerinin geri yüklenmesi; performans ve fazla
  mesai şablonları.
- **Tanımlar ekrandan:** yasal parametreler (yıl bazında, açıklanmamış yıl için öngörü), zam kademesi, performans
  değerlendirme modeli, mesai katsayıları, hesaplama ve kanun türleri, gruplar, bütçe bölümleri, içe aktarma başlıkları.
- **Kullanıcılar:** kişi bazında yetki ve grup erişimi, işlem kaydı, hareketsizlikte otomatik kapanma.
- **Veri güvenliği:** isteğe bağlı şifreleme (AES-256-GCM), otomatik ve elle yedek, aynı anda tek yazar (yazma kilidi).
- **Başlangıç gezisi** ve program içi **Kullanım Kılavuzu**.
- **Belgeler:** veri modeli, hesap motoru (formüller ve sınama vektörleri), iş kuralları ve yetkiler, ekranlar ve
  dosya biçimleri (`docs/`); örnek veriyle referans sonuçlar (`docs/referans/`).

### Güvenlik

- Yerel sunucu yazma isteklerini yalnız programın kendi sayfasından kabul eder. Program açıkken başka bir sitenin
  arka planda veri dosyasına yazması engellenir.

### Bilinen sınırlar

- Kurulumla 2026 yasal parametreleri gelir; her yıl resmî kaynaktan kontrol edilmelidir. Program resmî bordronun
  yerine geçmez.
- Net ↔ brüt esas dönüştürmesi yoktur; esası yanlış açılmış çalışma için yeni, boş bir çalışma açılır.
- Personel İçe Aktarma'da maaş sütununun esası başlıktan anlaşılır: brüt sütunun başlığında "Brüt" geçmelidir.
- Yılın genel zam eşikleri tek takımdır; brüt esaslı grup eşikleri Çalışma Ayarları'ndan brüt tutarla girmelidir.
- Teşvik ve sigorta kollarının formülleri koddadır (oranları ekrandan değişir); mevzuatın hesap biçimi değişirse
  program güncellemesi gerekir.
- Program Windows'ta denenmiştir.
