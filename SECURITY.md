# Güvenlik

## Açık bildirmek

Güvenlik açığını **herkese açık bir başlıkta (Issue) bildirmeyin.** Bunun yerine deponun
[**Security → Report a vulnerability**](https://github.com/kgelgec/ucret-hesaplama/security/advisories/new)
bağlantısını kullanın; bildirim yalnız depo sahibine görünür.

Bildirimde şunlar olsun:

- program sürümü (sol alttaki "Sürüm" yazısı),
- açığın ne olduğu ve neye yol açtığı,
- örnek veriyle ya da deneme kurulumuyla tekrarlama adımları.

**Gerçek kişi verisi göndermeyin:** ad soyad, T.C. Kimlik No, maaş, `butce.db`, yedek ya da Excel dosyası eklemeyin.
Açığı göstermek için örnek veri (Sistem → Örnek Veri) ya da `-Deneme` kipindeki ayrı bir veri klasörü yeterlidir:

```powershell
powershell -ExecutionPolicy Bypass -File program\Sunucuyu-Baslat.ps1 -Port 8793 -VeriKok C:\gecici\deneme -Deneme
```

Doğrulanan açık yeni bir yama sürümüyle düzeltilir; düzeltme [`CHANGELOG.md`](CHANGELOG.md)'de "Güvenlik" başlığı
altında duyurulur. Bildireni, isterse orada anarız.

## Desteklenen sürümler

Güvenlik düzeltmeleri yalnız **son sürüme** yapılır. Hangi sürümü kullandığınızı sol alttaki "Sürüm" yazısından,
son sürümü [Sürümler](https://github.com/kgelgec/ucret-hesaplama/releases/latest) sayfasından görürsünüz.

## Güvenlik modeli (kısaca)

Program tek bir bilgisayarda çalışır: tarayıcıdaki uygulama, aynı bilgisayardaki yerel PowerShell sunucusuna
(`http://localhost:8764/`) bağlanır. Veri tek bir dosyadadır (`veri\butce.db`).

Kapsamda olanlar, yani açık sayılacak durumlar:

- **Yerel sunucu:** başka bir sitenin ya da ağdaki başka bir bilgisayarın veri dosyasını okuyabilmesi, değiştirebilmesi
  ya da silebilmesi. Sunucu yalnız `localhost` adına cevap verir; yazma isteklerini yalnız programın kendi sayfasından
  kabul eder.
- **Şifreleme:** şifreli veri dosyasının ya da şifreli yedeğin parola bilinmeden açılabilmesi; şifreleme açıkken
  şifresiz veri yazılabilmesi.
- **Yetkiler:** bir kullanıcının, yetkisi olmayan bir grubun ya da işlemin verisine program arayüzü ya da API
  çağrısıyla ulaşabilmesi.
- **İçe alma:** Excel / CSV dosyası içe alınırken program içinde kod çalıştırılabilmesi ya da veri bozulması.

Bilinen ve tasarım gereği olan durumlar (kapsam dışı):

- **Şifresiz kurulum:** şifreleme açılmamışsa veri dosyasını kopyalayan herkes okuyabilir. Şifreleme kullanıcının
  seçimidir; program ilk açılışta ve Sistem ekranında uyarır.
- **Bellekteki veri:** program tarayıcıda çalıştığı için şifresi çözülmüş veritabanı oturum boyunca tarayıcı
  belleğindedir. Bilgisayara ya da oturuma erişen biri ekranda gördüğünü görebilir. Okuma yetkilerinin tam korunması
  gerekiyorsa hesap ve veri sunucu tarafına taşınmalıdır (ayrıntı: `docs/03-is-kurallari-ve-yetkiler.md` →
  Güvenlik denetimleri).
- **Bilgisayarın kendisi:** bilgisayarda yönetici yetkisi ya da zararlı yazılımı olan bir saldırgana karşı koruma.
- **Parola kaybı:** veri parolası kaybolursa veri kurtarılamaz; arka kapı yoktur.
