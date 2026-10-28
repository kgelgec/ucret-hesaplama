/* =====================================================================
   KULLANIM KILAVUZU

   Programı ilk kez kullanacaklar ve bütçeyi inceleyen yönetim için
   ekran ekran anlatım.

   Menüde görünmez; sol alttaki "📖 Kullanım Kılavuzu" düğmesiyle açılır,
   yetki istemez. Bölümler aşağıdaki BOLUMLER dizisindedir; arama yazdıkça
   süzer (canlı arama kuralı). "Ekranı aç →" bağlantısı ilgili ekrana gider.
   Ekran ya da kural değişince ilgili bölüm burada da güncellenmelidir.
   ===================================================================== */
(function () {
  'use strict';

  let arama = '';

  const ac = (modul, yazi) => `<a href="#" class="kl-git" data-git="${modul}">${yazi || 'Ekranı aç'} →</a>`;
  const ipucu = h => `<div class="uyari uyari-bilgi kucuk"><span class="ik">💡</span><div>${h}</div></div>`;
  /* Ekran görüntüsü (img/kilavuz). Görüntüler örnek veriden çekilir; isimler ve tutarlar uydurmadır.
     Tıklayınca büyük hâli açılır. Ekran değişince görüntü de yenilenmeli. */
  const gorsel = (dosya, yazi) => `<figure class="kl-gorsel"><img src="img/kilavuz/${dosya}.png" alt="${U.esc(yazi)}" loading="lazy" data-buyut="${dosya}" title="Büyütmek için tıklayın">
      <figcaption>${yazi}</figcaption></figure>`;
  const dikkat = h => `<div class="uyari uyari-dikkat kucuk"><span class="ik">⚠</span><div>${h}</div></div>`;

  /* kime: 'herkes' | 'yonetim' (işveren / yönetim) | 'yonetici' (sistem yöneticisi) */
  const BOLUMLER = [
    { id: 'baslarken', baslik: 'Başlarken', kime: 'herkes', html: `
      <p>Maaş Bütçe Sistemi; tanımladığınız grupların (örneğin birim, işyeri ya da şube) yıllık maaş bütçesini, zam çalışmasını ve
        ay ay işveren maliyetini (brüt, SGK, gelir ve damga vergisi, teşvikler) hesaplar. Her grubun her yılı ayrı bir bütçe çalışmasıdır.</p>
      <h4>Programı açmak</h4>
      <ol>
        <li><strong>BUTCE-BASLAT.bat</strong> dosyasına (ya da masaüstüne koyduğunuz kısayoluna) çift tıklayın. Siyah bir pencere açılır,
          program tarayıcıda açılır. Siyah pencere açık kaldığı sürece program çalışır.</li>
        <li>Veriler şifreliyse önce <strong>Veri Parolası</strong> sorulur. Bu parola sizin giriş parolanız değildir; veri dosyasını açan ortak paroladır.</li>
        <li>Ardından kendi <strong>kullanıcı adınız</strong> ve <strong>parolanızla</strong> giriş yapın.</li>
      </ol>
      <h4>İlk kurulum</h4>
      <p>Program ilk kez açıldığında önce veri parolası belirlenir (ya da <em>Şifresiz devam et</em> seçilir), sonra yönetici hesabı
        oluşturulur ve başlangıç seçilir:</p>
      <ul>
        <li><strong>Örnek veriyle başla:</strong> uydurma iki grup (<em>Ofis</em> ve <em>Üretim</em>), bütçe bölümleri, örnek personel ve
          çalışmalar yüklenir. Programı tanımak ve bu kılavuzu ekranda denemek için uygundur.</li>
        <li><strong>Boş başla:</strong> yalnız yasal parametreler (asgari ücret, vergi dilimleri, SGK oranları…) ve "Genel" adlı bir grup gelir.
          Kendi gruplarınızı <em>Tanımlar → Gruplar</em> sekmesinden açarsınız (bkz. <em>Gruplar</em> bölümü).</li>
      </ul>
      ${ipucu(`Örnekle başlayıp gerçek kullanıma geçerken <em>Sistem → Veritabanını Sıfırla</em> ile ilk kurulum ekranına dönebilir
        ya da örnek grupları ve çalışmalarını silebilirsiniz.`)}
      <h4>Kayıt</h4>
      <p>Kaydet düğmesi aramanıza gerek yok: yaptığınız her değişiklik hemen kaydedilir. Ekranın üstündeki gösterge
        <em>Kaydediliyor…</em> iken bekleyin, <em>Kayıtlı</em> olunca işlem tamamdır.</p>
      ${dikkat(`Aynı anda yalnız <strong>bir kişi</strong> kayıt yapabilir. Program başka bir bilgisayarda ya da başka bir sekmede açıksa
        üstte sarı bir şerit çıkar ve siz <strong>yalnızca görüntüleme</strong> kipinde olursunuz: her şeyi görür, Excel alabilirsiniz ama kayıt yapamazsınız.
        Diğer sekmeyi kapatın ya da diğer kullanıcının işini bitirmesini bekleyin.`)}
      <h4>Çıkış</h4>
      <p>İşiniz bitince sol alttaki <strong>Çıkış Yap</strong> düğmesine basın. Belirli bir süre işlem yapılmazsa program oturumu kendiliğinden kapatır.</p>
      <p>Bu kılavuza her ekrandan sol alttaki <strong>📖 Kullanım Kılavuzu</strong> düğmesiyle ulaşırsınız.</p>
      ${gorsel('13-kilavuz-dugme', 'Sol alt köşe: kılavuz ve çıkış düğmeleri')}` },

    { id: 'ekran', baslik: 'Ekranın düzeni', kime: 'herkes', html: `
      <ul>
        <li><strong>Sol menü:</strong> ekranlar başlıklar altında toplanır: Genel, Bütçe, Veri, Tanımlar, Yönetim.
          Yalnızca yetkiniz olan ekranları görürsünüz.</li>
        <li><strong>Üst çubuk — yıl:</strong> hangi yılın bütçesine baktığınızı seçer (örneğin 2027).</li>
        <li><strong>Üst çubuk — grup:</strong> erişiminiz olan gruplar (örnek veride <em>Ofis</em> ve <em>Üretim</em>) ve birden çok grup varsa <em>Tümü</em>.
          "Tümü" yalnız Özet ve Maliyet Tablosu'nda kullanılır; diğer ekranlar tek bir grup üzerinde çalışır.</li>
        <li><strong>Üst çubuk — çalışma:</strong> aynı yıl ve grupta birden çok çalışma varsa (örneğin "2027 Bütçe" ve "2027 Revize")
          hangisinde çalıştığınızı buradan seçersiniz. Ekranların başındaki 🗂 bandı da hangi çalışmanın seçili olduğunu gösterir.</li>
        <li><strong>🔒 bandı:</strong> seçili çalışma <em>onaylı</em> ise rakamlar kilitlidir; değiştirilemez.</li>
      </ul>
      ${ipucu(`Arama kutuları yazdıkça süzer, Enter beklemez. <strong>Esc</strong> aramayı temizler.`)}
      ${gorsel('01-genel', 'Genel görünüm: solda menü, sağ üstte yıl ve grup seçimi, ortada Özet ekranı')}` },

    { id: 'yeniyil', baslik: 'Yeni yıl bütçesi — adım adım', kime: 'herkes', html: `
      <p>Yeni yılın bütçesine genellikle yıl sonuna doğru başlanır. Önerilen sıra:</p>
      <ol>
        <li><strong>Parametreler:</strong> üst çubuktan yeni yılı seçin. <em>Yeni yıl öngörüsü</em> bölümünde kaynak yıl, seçili yılın bir önceki yılı;
          hedef yıl, seçili yıldır. Öngörü oranlarını kontrol edip parametreleri oluşturun (vergi dilimleri, asgari ücret, sakatlık indirimi oranla artırılır).
          Resmî rakamlar açıklanınca bu ekrandan düzeltin ve <strong>Resmî rakamlar girildi</strong> deyin. ${ac('parametre')}</li>
        <li><strong>Bütçe Çalışmaları → + Yeni Çalışma:</strong> grubu seçin, kaynak olarak <em>Önceki yılın çalışmasından</em>'ı seçin.
          Geçen yılın zamlı maaşları bu yılın başlangıç maaşı olur; kişiler, kanunlar, BES ve benzeri bilgiler taşınır.
          Aynî yardım, prim, yakıt, mesai ve AR-GE günü <strong>taşınmaz</strong>; her yıl yeniden girilir. ${ac('calisma')}</li>
        <li><strong>Personel İçe Aktarma:</strong> ERP ya da bordro programınızdaki güncel net maaşları ve personel bilgisini alın. ${ac('aktarim')}</li>
        <li><strong>Personel ve Zam:</strong> zam öngörüsünü inceleyin, gereken kişilere düzeltme yazın. ${ac('personel')}</li>
        <li><strong>Performans Değerlendirme</strong> (zam performansa bağlıysa): değerlendirmeleri girin ya da Excel şablonuyla toplayın,
          sonra <em>Çarpanları zam hesabına uygula</em> deyin. ${ac('performans')}</li>
        <li><strong>Aylık Girdiler:</strong> aynî yardım, prim, yakıt yardımı, fazla mesai ve AR-GE günlerini girin. ${ac('aylik')}
          Fazla mesaiyi bölüm bölüm planlıyorsanız <em>Fazla Mesai Planı</em>'nü kullanın. ${ac('mesai')}</li>
        <li><strong>Excel Raporu:</strong> yönetime Excel gönderin ya da yönetime programda Personel ve Zam yetkisi verin. ${ac('excel')}</li>
        <li><strong>Onay:</strong> yönetim onaylayınca Bütçe Çalışmaları → ✎ → Durum: <em>Onaylı</em>. Onaylı çalışma kilitlenir ve rakamları bir daha değişmez.</li>
      </ol>
      ${gorsel('08-parametre', 'Adım 1 — Parametreler: üstte Yeni Yıl Öngörüsü, altta yılın parametreleri')}
      ${gorsel('07-yeni-calisma', 'Adım 2 — Yeni Çalışma penceresi: "Önceki yılın çalışmasından" seçilir')}` },

    { id: 'personel', baslik: 'Personel ve Zam', kime: 'herkes', html: `
      <p>Bütçenin ana ekranıdır: her satır bir kişidir. Önceki yıl net maaşı, zam öngörüsü, düzeltme, yeni yıl maaşı ve yıllık maliyet burada görünür. ${ac('personel')}</p>
      ${gorsel('02-personel', 'Personel ve Zam: üstte özet kutuları, tabloda sarı Düzeltme sütunu')}
      <h4>Üstteki özet kutuları</h4>
      <p>Toplam maliyet, önceki yıla göre maliyet farkı, aylık net maaş artışı ve düzeltme yapılan kişi sayısı. Kutular arama ve süzgeçten bağımsızdır,
        çalışmanın tamamını gösterir; bir düzeltme yazdığınızda hemen değişir.</p>
      <h4>Sekmeler</h4>
      <ul>
        <li><strong>Zam Çalışması:</strong> zam öngörüsü, <strong>Düzeltme</strong> hücresi ve sonuç. Düzeltme, öngörülen zamma eklenir; eksi olabilir.
          Hücreye yazıp Enter'a basın ya da başka bir hücreye geçin.</li>
        <li><strong>Kişi Bilgileri:</strong> hesabı belirleyen bilgiler (yaka, hesaplama türü, kanun, giriş-çıkış…).</li>
      </ul>
      <h4>Kişi kartı</h4>
      <p>Kişinin adına tıklayınca kart açılır. Bütçe bölümü, giriş/çıkış tarihi, yaka, hesaplama türü (SSK / EMK / SGK'sız), kanun (teşvik),
        AR-GE GV teşvik oranı, sakatlık, BES, önceki yıl maaşı, zam ayı, düzeltme ve not buradan değiştirilir.</p>
      <ul>
        <li><strong>+ Yeni Personel:</strong> T.C. yazınca kişi programda daha önce varsa bilgileri kendiliğinden gelir.</li>
        <li><strong>🗑 Bütçeden çıkar:</strong> kişiyi bu çalışmadan çıkarır; personel kaydı ve geçmiş yıllar etkilenmez.
          Kişi yıl içinde ayrılacaksa silmeyin, <strong>işten çıkış tarihi</strong> girin; maliyet o aya kadar hesaplanır.</li>
        <li><strong>Grup değiştirme:</strong> kartta <em>Grup</em> alanından başka bir grubu seçip kaydederseniz kişi bütün bilgileriyle o gruba taşınır
          (örneğin Ofis'ten Üretim'e). Onaylı çalışmalar etkilenmez; yeni giriş tarihini kartta güncelleyebilirsiniz.</li>
      </ul>
      ${ipucu(`<strong>Zam kuralı:</strong> çalışma yılından önce işe girenin maaşı önceki yılın maaşı sayılır ve zam alır.
        Çalışma yılı içinde işe giren zam almaz.`)}
      <p>Liste bütçe bölümüne, bölüm içinde işe giriş tarihine (eskiden yeniye) göre sıralıdır.</p>
      ${gorsel('03-kart', 'Kişi kartı: kimlik, grup, giriş-çıkış ve hesaplama bilgileri')}` },

    { id: 'aylik', baslik: 'Aylık Girdiler', kime: 'herkes', html: `
      <p>Kişinin ay ay elle girilen bordro kalemleridir. Üstteki ay düğmeleriyle ayı seçin. ${ac('aylik')}</p>
      <h4>Hangi alan nasıl çalışır?</h4>
      <table class="genis-tablo kucuk"><thead><tr><th>Girdiğiniz aydan itibaren bütün yıla geçenler</th><th>Yalnız girdiğiniz ayda geçerli olanlar</th></tr></thead>
        <tbody><tr><td>Hesaplama türü, kanun türü, sakatlık, BES, GV teşvik oranı, yol parası,
          <strong>FM1 / FM2 fazla mesai saatleri</strong> (hafta içi / hafta sonu-tatil; katsayıları Parametreler'de), <strong>AR-GE günü</strong></td>
          <td><strong>Aynî yardım</strong>, <strong>prim ve diğer ödemeler</strong>, <strong>yakıt yardımı</strong>, çalışılan gün</td></tr></tbody></table>
      <ul>
        <li>Ocak'a girdiğiniz mesai saati ya da AR-GE günü bütün yıla geçer; sonraki aylarda soluk rakamla görünür.
          Bir ayda değiştirirseniz o aydan itibaren yeni değer geçerli olur.</li>
        <li>Aynî yardım, prim ve yakıt yardımı hangi ayda verilecekse o ayın sekmesine girilir.</li>
        <li>AR-GE günü kişiye girilmezse çalışmanın AR-GE günü ayarı (varsa) kullanılır; o da yoksa 0 gün sayılır.</li>
        <li>Grupta <em>Fazla Mesai Planı</em> açıksa kişinin mesaisi bölüm tablosundan gelir; buraya o ay elle yazılan mesai önceliklidir.</li>
      </ul>
      <h4>Hızlı giriş</h4>
      <ul>
        <li><strong>Enter</strong> kaydeder ve bir alttaki kişinin aynı alanına geçer; <strong>Tab</strong> yandaki alana geçer. Ekran yerinde kalır.</li>
        <li><strong>Tüm kişilere</strong> satırı: alanı seçip tutarı yazın, <em>… ayına uygula</em>'ya basın. AR-GE günü seçildiğinde
          yalnız o ay kanunu <strong>05746 - ARGE</strong> olan kişilere yazılır. Kutuyu boş bırakıp uygularsanız o alan o ay için herkesten silinir.</li>
      </ul>
      ${gorsel('04-aylik', 'Aylık Girdiler: ay düğmeleri, "Tüm kişilere" satırı ve kişi bazında girdiler')}` },

    { id: 'ozet', baslik: 'Özet, Maliyet Tablosu ve Maaş Dağılımı', kime: 'herkes', html: `
      <ul>
        <li><strong>Özet:</strong> yaka ve bütçe bölümü bazında toplam maliyet, bütçelenen maliyet ve zam. Grup olarak "Tümü" seçilirse
          bütün grupların toplamını verir. Önceki yıl maliyeti ve bütçelenen tutar buradan elle girilir. ${ac('ozet')}</li>
        <li><strong>Maliyet Tablosu:</strong> kişi × ay maliyet tablosu; hangi tutarın gösterileceğini seçebilirsiniz.
          Kişiye tıklayınca o kişinin ay ay bordro dökümü açılır (brüt, SGK, vergi, teşvikler). ${ac('maliyet')}</li>
        <li><strong>Maaş Dağılımı:</strong> maaş aralıklarına göre kişi sayısı ve küçükten büyüğe sıralı maaş listesi;
          zam kademesinin alt ve üst eşiklerini belirlerken kullanılır. ${ac('dagilim')}</li>
      </ul>
      ${gorsel('09-maliyet', 'Maliyet Tablosu: kişi × ay; kişinin adına tıklayınca bordro dökümü açılır')}
      ${gorsel('10-bordro', 'Bordro dökümü: bir kişinin ay ay brüt ücret, SGK, vergi ve teşvik hesabı')}` },

    { id: 'calisma', baslik: 'Bütçe Çalışmaları: taslak, onay ve revize', kime: 'herkes', html: `
      <p>Her grubun her yılı ayrı bir bütçe çalışmasıdır (örneğin "2027 · Ofis · 2027 Bütçe"). ${ac('calisma')}</p>
      <ul>
        <li><strong>+ Yeni Çalışma:</strong> <em>Önceki yılın çalışmasından</em> (yeni yıl için), <em>Aynı yıldaki bir çalışmanın kopyası</em>
          (senaryo denemek için) ya da <em>Boş</em>.</li>
        <li><strong>Taslak:</strong> üzerinde çalışılan bütçe; her şey değiştirilebilir.</li>
        <li><strong>Onaylı:</strong> yönetimin onayladığı bütçe. Rakamları, parametreleri ve kişilerin giriş-çıkış tarihleri onay anındaki hâliyle dondurulur;
          sonradan parametre ya da kart değişse de onaylı maliyet değişmez.</li>
        <li><strong>Revize aç:</strong> onaylı bir çalışmada değişiklik gerekirse eski çalışma kilitli kalır, yanında "Revize" adlı yeni bir taslak açılır.</li>
        <li><strong>✎ Çalışma Ayarları:</strong> zam yöntemi (maaş kademesi, performans çarpanı), gruba özel zam kademesi, varsayılan çalışılan gün,
          05510 indirim oranı ve bu çalışmaya özel <em>zam öngörüsü yuvarlama adımı</em> (boşsa yılın parametresi kullanılır).</li>
      </ul>
      ${dikkat(`Aynı yıl ve grup için iki çalışma açarsanız ekranlar seçili olanı gösterir. "Kişiler görünmüyor" gibi bir durumda
        önce üst çubuktaki çalışma seçicisine bakın; gereksiz çalışmayı Bütçe Çalışmaları ekranından silin.`)}
      ${gorsel('06-calisma', 'Bütçe Çalışmaları: taslak ve onaylı çalışmalar; Aç, Revize aç ve ✎ düğmeleri')}` },

    { id: 'perfmesai', baslik: 'Performans Değerlendirme ve Fazla Mesai Planı', kime: 'herkes', html: `
      <p>İki ekran da seçili grubun çalışması üzerinde çalışır ve isteğe bağlıdır: kullanmayan grupta boş kalır, hesaba etkisi olmaz.</p>
      <h4>Performans Değerlendirme</h4>
      <ul>
        <li>Her kişi için amirler (örnek modelde 1. amir, 2. amir ve idari amir) kriterlere 0–100 arası puan verir; değerlendirme bölümü ve
          ek puan bilgileri (kıdem, mezuniyet gibi) girilir. Kişiye tıklayıp ekrandan girebilir ya da <em>Excel şablonu indir</em> ile şablonu
          değerlendirmeyi yapacak amirlere gönderip doldurulan dosyayı <em>Excel'den içe al</em> ile alabilirsiniz. Kişiler T.C. ile eşleşir;
          içe almadan önce değişiklikler gösterilir. ${ac('performans')}</li>
        <li>Program amir puanlarını ağırlıklı ortalamayla birleştirir, bölümler arası not cömertliğini <em>bölüm katsayısı</em>yla dengeler,
          ek puanları ekler ve toplam puanı yakanın ortalamasına bölerek <strong>zam çarpanını</strong> bulur (ortalama kişi = 1,00).
          Değerlendirilmeyen kişinin çarpanı 1'dir.</li>
        <li>Çarpan zam hesabına kendiliğinden geçmez: <em>Çarpanları zam hesabına uygula</em> deyin. Çalışmada performansla zam hesabı
          kapalıysa bu düğme onu da açar.</li>
        <li>Kriterler, ağırlıklar ve ek puan kuralları kişi penceresinde ve şablonun <em>AÇIKLAMA</em> sayfasında görünür.</li>
      </ul>
      <h4>Değerlendirme modeli</h4>
      <p>Programla gelen model bir örnektir; ekranın üstündeki <strong>Değerlendirme modeli…</strong> düğmesiyle kendi politikanıza göre
        değiştirilir. Model <strong>yıl bazındadır</strong>: seçili çalışmanın yılının modeli düzenlenir ve o yılın bütün gruplarında kullanılır.
        Değiştirmek için <em>Parametre ve tanımları değiştirir</em> yetkisi gerekir; yetkisi olmayan modeli yalnız görüntüler.</p>
      <ul>
        <li><strong>Amirler:</strong> ad ve ağırlık; en çok 5 amir eklenebilir. Ağırlıklar oran olarak kullanılır (toplamın 100 olması gerekmez);
          en az bir amirin ağırlığı sıfırdan büyük olmalıdır.</li>
        <li><strong>Mavi yaka / Beyaz yaka sekmeleri:</strong> yaka adı, Excel sayfa adı, değerlendirme ağırlığı (değerlendirmenin toplam puandaki payı)
          ve kriterler (ad, ağırlık; ekle, sil, sırala). Kriter ağırlıklarının toplamı 100 değilse uyarı çıkar ama kayda engel değildir.</li>
        <li><strong>Ek puan alanları:</strong> toplam puana eklenen (eksi de olabilen) alanlar. Kural türleri: <em>Eşik</em> (eşik ve üstü sabit puan,
          altında değer × katsayı), <em>Kademe</em> (değerin ulaştığı en yüksek kademenin puanı), <em>Çarpan</em> (değer × katsayı, isteğe bağlı üst sınır)
          ve <em>Liste</em> (seçeneğe göre puan; listede olmayan değerin puanı ayrıca girilir). İsteğe bağlı olarak giriş sınırı (en az / en çok), not
          ve <em>Önceki dönemden taşınsın</em> işareti (yeni dönemin şablonuna geçen yılın değeri önceden yazılır) verilir. Her alanın altında
          kuralın açıklaması yazdıkça güncellenir.</li>
        <li><strong>Kaydet</strong> modeli denetler; hatalı model (ör. bütün amir ağırlıkları 0) kaydedilmez, nedeni pencerede gösterilir.
          Kaydedince puanlar ve çarpanlar yeni modelle yeniden hesaplanır; gerekirse <em>Çarpanları zam hesabına uygula</em> deyin.
          <strong>Varsayılan modele dön</strong> yılın özel modelini siler.</li>
        <li>Kaldırılan amir, kriter ya da ek alana girilmiş değerler silinmez ama artık hesaba ve şablona girmez; aynı kodla yeniden eklenirse geri gelir.
          Kodlar yeni kriter ve alanlarda adından üretilir, sonradan değişmez.</li>
      </ul>
      ${gorsel('14-model', 'Değerlendirme modeli penceresi: amirler, yaka sekmeleri, kriterler ve ek puan alanları')}
      ${dikkat(`Onaylı çalışma onay anındaki modelle değerlendirilir; modeldeki değişiklik o yılın taslak ve revize çalışmalarına uygulanır.`)}
      <h4>Fazla Mesai Planı</h4>
      <ul>
        <li>Fazla mesaiyi kişi kişi değil bölüm bölüm planlamak içindir: her bölümün ay ay toplam mesai saati (mavi yaka hafta içi ve hafta sonu,
          beyaz yaka hafta sonu) ve kişi sayısı girilir. Kişi başı mesai = bölümün saati ÷ kişi sayısı; kişi sayısı boşsa çalışmadaki kadro sayılır. ${ac('mesai')}</li>
        <li>Tablo yalnız <em>Öngörüyü aç</em> denince kişilerin mesaisini belirler; kişiye Aylık Girdiler'den o ay elle girilen mesai önceliklidir.
          Öngörü kapalıyken mesai kişi bazında Aylık Girdiler'den girilir.</li>
        <li><em>Excel'e aktar</em> tabloyu programın mesai düzeninde verir; aynı düzende doldurulan dosya <em>Excel'den al</em> ile içe alınır (önce önizleme).
          Geçen yılın tablosu <em>… tablosunu kopyala</em> ile yeni yıla başlangıç olarak alınabilir.</li>
      </ul>` },

    { id: 'rapor', baslik: 'Excel Raporu', kime: 'herkes', html: `
      <p>Yönetime gidecek Excel'i hazırlar ve geri gelen dosyadaki düzeltmeleri programa alır. ${ac('excel')}</p>
      <ul>
        <li><strong>Excel'e Aktar:</strong> üç sayfa: <em>ÖZET</em> (yaka ve bölüm toplamları), <em>ZAM ÇALIŞMASI</em> (kişi bazında zam; sarı
          <em>DÜZELTME</em> sütunu yönetimin alanıdır) ve <em>AYLIK MALİYET</em> (kişi × ay).</li>
        <li><strong>Dosya seç…:</strong> yönetimin doldurduğu dosyayı seçin. Kişiler T.C. ile eşleşir. Önce değişiklikler gösterilir;
          <em>Değişikliği Uygula</em> demeden hiçbir şey yazılmaz.</li>
        <li>Öncelik: elle yazılmış zam oranı → elle yazılmış zam miktarı → düzeltme.</li>
      </ul>
      ${ipucu(`Yönetim programı kullanacaksa Excel'e gerek kalmaz; yönetime Personel ve Zam yetkisi verin. Düzeltmeyi doğrudan programa yazarlar.`)}
      ${gorsel('11-rapor', 'Excel Raporu: Excel’e aktarma ve yönetimden dönen dosyayı içeri alma')}` },

    { id: 'aktarim', baslik: 'Personel İçe Aktarma (Excel / CSV / ERP)', kime: 'herkes', html: `
      <p>Elinizdeki personel listesini (Excel, CSV ya da ERP / bordro programı çıktısı) bütçeye alır: güncel net maaşları ve personel bilgilerini (ad, işe giriş-çıkış, bölüm, görev, yaka, bütçe bölümü)
        çalışmaya alır. Maaşlar çalışmanın "önceki yıl maaşı" olur ve zam bunların üzerine uygulanır; önceki yılın gerçekleşen maliyeti de
        buradan gelebilir. ${ac('aktarim')}</p>
      <ul>
        <li>Hazır bir listeniz yoksa ekrandaki <strong>Örnek Excel şablonunu indir</strong> düğmesiyle şablonu alın: ilk sayfaya (PERSONEL)
          kişileri yazın; ikinci sayfada her sütunun açıklaması ve örneği vardır. Şablonun başlıkları program tarafından tanınır.</li>
        <li>Listenizi Excel (.xlsx) ya da CSV olarak verin ya da tabloyu başlık satırıyla birlikte kopyalayıp yapıştırın.</li>
        <li>Önizlemede bütçede olmayan kişiler ayrı listelenir; <strong>Tümünü seç</strong> ile hepsini (başka grupta kayıtlı olanlar hariç) işaretleyebilirsiniz.</li>
        <li>Sütunlar sırasına göre değil <strong>başlık adına</strong> göre tanınır (örneğin "T.C. Kimlik No", "Adı Soyadı", "Net Maaş");
          önizlemede hangi sütunun neye eşlendiği gösterilir. Programınızın başlıkları tanınmıyorsa tanınan başlıklar
          <em>Tanımlar → İçe Aktarma Başlıkları</em>'ndan alan başına eklenir.</li>
        <li>Önce önizleme gösterilir: güncellenecek kişiler, değişmeyenler, çalışmada olmayan yeni kişiler ve dosyada olmayanlar.
          Yeni kişilerden eklenecekleri işaretleyip <em>Aktarımı Uygula</em> deyin. Dosyada boş gelen alana dokunulmaz.</li>
      </ul>
      ${dikkat(`Program ERP'ye ya da bordro programına hiçbir şey yazmaz; yalnız okur. Dosyada olmayan kişilere dokunulmaz:
        ayrılan biri varsa kişi kartına çıkış tarihi girin.`)}` },

    { id: 'parametre', baslik: 'Parametreler ve Tanımlar', kime: 'herkes', html: `
      <ul>
        <li><strong>Parametreler</strong> (yıl bazında): SGK tavan çarpanı, damga vergisi, BES oranı, teşvik oranları, asgari ücret (iki dönem olabilir),
          gelir vergisi dilimleri, sakatlık indirim tutarları ve zam kademesi (alt eşik / üst eşik / oranlar). ${ac('parametre')}</li>
        <li><strong>Parametreler → Genel</strong> ayrıca hesabın şu ayarlarını içerir: FM1 (hafta içi) ve FM2 (hafta sonu / tatil) fazla mesai katsayıları
          (saat ücretinin kaç katı), saat ücretinde günlük çalışma saati, AR-GE günü varsayılanının uygulandığı en düşük GV teşvik oranı ve
          zam öngörüsü yuvarlama adımı (bir çalışmaya özel adım Çalışma Ayarları'ndan girilebilir).</li>
        <li><strong>Yeni yıl öngörüsü:</strong> kaynak yıl her zaman seçili yılın bir önceki yılıdır, hedef yıl seçili yıldır. Onaylı çalışması olan yılın
          parametreleri kilitlidir.</li>
        <li><strong>Tanımlar:</strong> hesaplama türleri (SSK, EMK, SGK'sız), kanun (teşvik) türleri, gruplar (yalnız sistem yöneticisi),
          her grubun bütçe bölümleri ve <strong>İçe Aktarma Başlıkları</strong>: Personel İçe Aktarma'nın her alan için tanıdığı sütun başlıkları
          (virgülle ayrılmış; büyük / küçük harf ve Türkçe karakter farkı gözetilmez). Değiştirilen alan <em>Varsayılan</em> düğmesiyle geri alınır. ${ac('tanim')}</li>
      </ul>` },

    { id: 'yonetim', baslik: 'Yönetim için: bütçeyi incelemek ve düzeltmek', kime: 'yonetim', html: `
      <p>Bu bölüm bütçeyi inceleyip onaylayan yönetim içindir.</p>
      <ol>
        <li><strong>Özet:</strong> grubun toplam maliyetine, bütçelenen tutara ve zam oranına bakın. "Tümü" seçilirse bütün gruplar birlikte görünür. ${ac('ozet')}</li>
        <li><strong>Personel ve Zam:</strong> üstteki kutularda toplam maliyet, geçen yıla göre fark ve aylık net artış görünür.
          Kişi bazında öngörülen zamma bakın; değiştirmek istediğiniz kişinin <strong>Düzeltme</strong> hücresine farkı yazın
          (artı ya da eksi, aylık net). Yeni maaş, zam oranı ve maliyet hemen yeniden hesaplanır. ${ac('personel')}</li>
        <li><strong>Maliyet Tablosu:</strong> bir kişinin ay ay maliyetini görmek için adına tıklayın. ${ac('maliyet')}</li>
        <li>Bütçe uygun olduğunda bütçe sorumlusuna bildirin; çalışma <strong>Onaylı</strong>'ya alınır ve kilitlenir.</li>
      </ol>
      ${gorsel('02-personel', 'Düzeltme, sarı DÜZELTME sütununa aylık net tutar olarak yazılır; üstteki kutular hemen güncellenir')}
      ${ipucu(`Excel ile çalışmayı tercih ederseniz bütçe sorumlusu <em>Excel Raporu</em>'ndan Excel gönderir; sarı DÜZELTME sütununu doldurup geri verirsiniz.`)}` },

    { id: 'gruplar', baslik: 'Gruplar', kime: 'yonetici', html: `
      <p>Bütçe gruplar hâlinde tutulur (örneğin birim, işyeri ya da şube); her grubun her yılı ayrı bir çalışmadır ve üst çubuktaki grup
        düğmeleri bu listeden gelir. Gruplar <strong>Tanımlar → Gruplar</strong> sekmesinden yönetilir; bu sekmeyi yalnız sistem yöneticisi görür. ${ac('tanim')}</p>
      <ul>
        <li><strong>+ Yeni Grup:</strong> kod (örneğin URETIM), ad (örneğin Üretim) ve sıra girilir. Kod kayıttan sonra değişmez; çalışmalar,
          bütçe bölümleri ve kullanıcı erişimleri koda bağlıdır.</li>
        <li><strong>✎ Düzenle:</strong> grubun adı ve sırası (üst çubuktaki yeri) değiştirilir.</li>
        <li><strong>🗑 Sil:</strong> bütçe çalışması olan grup silinmez; önce çalışmalarını silin. Silinen grubun bütçe bölümleri ve kullanıcı erişimleri de gider.</li>
      </ul>
      ${ipucu(`Yeni grubu sistem yöneticisi dışındaki kullanıcıların görmesi için <em>Kullanıcılar</em> ekranından grup erişimi verin.
        Ardından grubun bütçe bölümlerini <em>Tanımlar → Bütçe Bölümleri</em>'nden ekleyip <em>Bütçe Çalışmaları</em>'ndan ilk çalışmasını açın.`)}` },

    { id: 'kullanici', baslik: 'Kullanıcılar ve yetkiler', kime: 'yonetici', html: `
      <p>Sistem yöneticisi her kullanıcı için hangi grupları görebileceğini ve düzenleyebileceğini, hangi işlemlere erişebileceğini tek tek işaretler. ${ac('kullanici')}</p>
      <div id="klYetkiler"></div>
      <h4>Yönetim için önerilen yetkiler</h4>
      <p><em>Özet ve maliyet tablolarını görür</em>, <em>Bütçe personel listesini görür</em>, <em>Zam çalışmasını görür</em>, <em>Zam düzeltmesi girer</em>.
        Grup erişiminde ilgili grupları işaretleyin.</p>
      ${gorsel('12-kullanici', 'Yeni Kullanıcı penceresi: grup erişimi ve yetkiler tek tek işaretlenir')}` },

    { id: 'sistem', baslik: 'Yedek ve sistem', kime: 'yonetici', html: `
      <ul>
        <li><strong>Yedeği indir</strong> ya da <strong>"yedek-elle" klasörüne kaydet:</strong> büyük bir işlemden önce (toplu aktarım, yeni yıl, silme) yedek alın.
          Sunucu ayrıca her kayıttan önce (en çok 10 dakikada bir) <code>yedek</code> klasörüne kendiliğinden yedek alır.</li>
        <li><strong>Yedekten geri yükle:</strong> bir hata olursa son yedeğe döner. Yalnız sistem yöneticisi yapabilir. Giriş ekranındaki
          "Giriş yapamıyorum" bölümünden yalnız veri şifreliyken ve yalnız şifreli bir yedekle geri yükleme yapılabilir.</li>
        <li><strong>İşlem kaydı:</strong> kim, ne zaman, neyi değiştirdi.</li>
        <li><strong>Şifreleme:</strong> veri dosyasının şifrelenmesi ve veri parolasının değiştirilmesi.</li>
        <li><strong>Otomatik kapanma:</strong> fare ya da klavye hareketi olmadan ne kadar süre sonra programın kendini kapatacağı.</li>
        <li><strong>Örnek veri:</strong> programı denemek için uydurma iki grubu, personeli ve çalışmaları ekler; var olan kayıtlara dokunmaz.</li>
      </ul>
      ${dikkat(`<em>Sıfırla…</em> bütün veriyi ve kullanıcı hesaplarını siler; program ilk kurulum ekranıyla açılır. Sıfırlamadan önce mevcut veri
        kendiliğinden yedeklenir, yine de kullanmadan önce yedeğinizi kontrol edin.`)} ${ac('sistem')}` },

    { id: 'sss', baslik: 'Sık sorulanlar', kime: 'herkes', html: `
      <dl class="kl-sss">
        <dt>Kişiler görünmüyor.</dt>
        <dd>Üst çubukta doğru yıl, grup ve çalışma seçili mi bakın. Aynı yıl için iki çalışma varsa boş olanı seçmiş olabilirsiniz.</dd>
        <dt>Bir grup üst çubukta görünmüyor.</dt>
        <dd>O gruba erişiminiz yoktur. Sistem yöneticisi <em>Kullanıcılar</em> ekranından grup erişimi verir.</dd>
        <dt>Kayıt yapamıyorum, alanlar kapalı.</dt>
        <dd>Çalışma onaylı (🔒) olabilir; değişiklik için <em>Revize aç</em> kullanılır. Ya da program başka bir sekmede/bilgisayarda açıktır (sarı şerit).
          Bir de yetkinizi kontrol ettirin.</dd>
        <dt>"Program başka sekmede açık" diyor.</dt>
        <dd>Programı iki sekmede açmışsınızdır. Diğer sekmeyi kapatın; bu sekmede şeritteki düğmeyle yeniden deneyin.</dd>
        <dt>Yeni yılda aynî yardım ya da AR-GE günü gelmedi.</dt>
        <dd>Bilerek böyle: bunlar her yıl yeniden belirlenir. Aylık Girdiler'den girin.</dd>
        <dt>Bir kişiyi yanlışlıkla bütçeden çıkardım.</dt>
        <dd>+ Yeni Personel ile T.C.'yi yazarak tekrar ekleyin; bilgileri gelir. Aylık girdileri yeniden girmeniz gerekir. Büyük bir kayıpta Sistem ekranından yedeğe dönülür.</dd>
        <dt>Programda değişiklik yapıldı ama ekranda görünmüyor.</dt>
        <dd>Sayfayı yenileyin (F5).</dd>
      </dl>` },
  ];

  const KIME = { herkes: 'Herkes', yonetim: 'Yönetim', yonetici: 'Sistem yöneticisi' };
  const duzMetin = h => h.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');

  function ciz(kap) {
    const q = U.normalize(arama.trim());
    const liste = BOLUMLER.filter(b => !q || U.normalize(b.baslik + ' ' + duzMetin(b.html)).includes(q));
    kap.innerHTML = `
      <div class="kl-duzen">
        <div class="kart kl-icindekiler">
          <input id="klAra" type="search" placeholder="Kılavuzda ara (Esc: temizle)" value="${U.esc(arama)}">
          <div class="kucuk soluk" style="margin:6px 0 8px">${q ? liste.length + ' bölüm bulundu' : 'İçindekiler'}</div>
          <div class="kucuk cok-soluk" style="margin-bottom:8px">Görüntülerdeki isim ve tutarlar örnektir.</div>
          ${liste.map(b => `<a href="#" data-bolum="${b.id}">${U.esc(b.baslik)}${b.kime !== 'herkes' ? ` <span class="rz rz-sari">${KIME[b.kime]}</span>` : ''}</a>`).join('')}
        </div>
        <div class="kl-icerik">
          ${liste.length ? liste.map(b => `
            <div class="kart kl-bolum" id="kl-${b.id}">
              <div class="kart-baslik"><h2>${U.esc(b.baslik)}</h2>${b.kime !== 'herkes' ? `<span class="rz rz-sari">${KIME[b.kime]} için</span>` : ''}</div>
              ${b.html}
            </div>`).join('')
          : `<div class="uyari uyari-bilgi"><span class="ik">ℹ</span><div>"${U.esc(arama)}" için bölüm bulunamadı.</div></div>`}
        </div>
      </div>`;

    // Yetki listesi programdaki gerçek listeden çizilir (yetki eklenince kılavuz kendiliğinden güncel kalır)
    const y = U.el('klYetkiler');
    if (y) y.innerHTML = `<table class="genis-tablo kucuk"><thead><tr><th>Yetki</th><th>Ne sağlar</th></tr></thead><tbody>
      ${(window.YETKILER || []).map(x => `<tr><td><code>${U.esc(x[0])}</code></td><td>${U.esc(x[1])}</td></tr>`).join('')}</tbody></table>`;

    C.canliArama('klAra', v => { arama = v; });
    kap.querySelectorAll('[data-bolum]').forEach(a => a.onclick = e => {
      e.preventDefault();
      const h = U.el('kl-' + a.getAttribute('data-bolum'));
      if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    kap.querySelectorAll('[data-buyut]').forEach(im => im.onclick = () => C.kipAc({ baslik: im.alt, genislik: 'genis',
      govde: `<img src="${im.getAttribute('src')}" alt="" style="width:100%; height:auto; display:block">` }));
    kap.querySelectorAll('[data-git]').forEach(a => a.onclick = e => { e.preventDefault(); APP.git(a.getAttribute('data-git')); });
  }

  APP.modulKaydet({
    id: 'kilavuz', ad: 'Kullanım Kılavuzu', ikon: '📖', grup: 'Yardım',
    baslik: 'Kullanım Kılavuzu', altBaslik: 'Programı öğrenmek için ekran ekran anlatım',
    gorunur: () => false,   // menüde değil, sol alttaki düğmeyle açılır
    ciz: ciz,
  });
})();
