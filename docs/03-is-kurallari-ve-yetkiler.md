# 03 — İş Kuralları, İş Akışları ve Yetkiler

> **Kapsam.** Ücret Hesaplama'nın iş kuralları ve yetki modeli: hangi işlemin hangi koşulla, hangi veriyi değiştirerek yapıldığı ve kimin yapabildiği. Okur: bordro, İK ve finans uzmanları ile programı kendi kurumuna uyarlayacak ya da başka bir sisteme taşıyacak yazılımcılar. Hesap motorunun formülleri `02-hesap-motoru.md`, tablo ve sütunların ayrıntısı `01-veri-modeli-ve-depolama.md`, ekranların alanları ve dosya biçimleri `04-ekranlar-ve-dosya-bicimleri.md` belgesindedir.
>
> **Okuma kuralı.** Kod adları (tablo, sütun, işlev, anahtar) aynen yazılmıştır. Her kuralın kaynağı `dosya.js:işlev` biçiminde verilir; yollar `program\` klasörüne görelidir. İş kurallarının tamamı `js/db/api.js`'tedir; yetki listesi ve şema `js/db/schema.js`'te, performans modelinin denetimi ve hesabı `js/core/performans.js`'te, açılış ve üst çubuk `js/app.js`'te, başlangıç ve örnek veri `data/seed.js`'tedir. Ekran davranışı yalnız kuralı anlamaya yetecek kadar anlatılır. **Doğrulanamadı** işareti kodda kesin karşılığı bulunmayan ya da niyeti yazılı olmayan noktaları, **Açık** işareti programın bilinen boşluklarını gösterir; hepsi §13'te toplanmıştır.
>
> **Gizlilik.** Belgede kişi adı, T.C. kimlik numarası ve maaş tutarı yoktur. Geçen sayılar koddaki sabitler, yasal oranlar ve varsayılan parametrelerdir; örnekler programla gelen örnek veriden (Ofis ve Üretim grupları) alınmıştır.

---

## İçindekiler

1. [Kavramlar](#1-kavramlar)
2. [Çalışma yaşam döngüsü](#2-çalışma-yaşam-döngüsü)
3. [Personel işlemleri](#3-personel-işlemleri)
4. [Aylık girdiler](#4-aylık-girdiler)
5. [Toplu içe alma işlemleri](#5-toplu-içe-alma-işlemleri)
6. [Parametreler ve tanımlar](#6-parametreler-ve-tanımlar)
7. [Yetki modeli](#7-yetki-modeli)
8. [Eşzamanlılık](#8-eşzamanlılık)
9. [İşlem kaydı (log)](#9-işlem-kaydı-log)
10. [Güvenlik denetimleri](#10-güvenlik-denetimleri)
11. [Bilinçli tasarım kararları](#11-bilinçli-tasarım-kararları)
12. [Açılış akışı ve üst çubuk seçimi](#12-açılış-akışı-ve-üst-çubuk-seçimi)
13. [Açık ve doğrulanamayan noktalar](#13-açık-ve-doğrulanamayan-noktalar)

---

## 1. Kavramlar

### 1.1 Grup
- Bütçenin tutulduğu birim (bir işyeri, şube ya da bölüm grubu). **Gruplar kullanıcı tanımlıdır**; program sabit bir grup listesiyle gelmez. Örnek veride iki grup vardır: Ofis (`OFIS`) ve Üretim (`URETIM`).
- Tablo `grup (kod, ad, sira, maas_araliklari)`. `sira` üst çubuktaki ve listelerdeki sırayı belirler (`js/db/api.js:grupListe`: `ORDER BY sira, ad`). `maas_araliklari` yalnız Maaş Dağılımı ekranının sabit aralık sınırlarıdır (boş = otomatik, bkz. §6.8).
- **Grup nereden gelir:** Tanımlar → Gruplar (`grupKaydet`), örnek veri (`ornekVeriYukle`, §6.9) ya da ilk kurulumdaki "Boş başla" seçeneği (`varsayilanGrupAc`: hiç grup yoksa tek bir `GENEL` / "Genel" grubu açar). Temel veri (`js/db/schema.js:TEMEL_VERI_YAZ`) grup açmaz.
- **Grup ekleme ve düzenleme** — `js/db/api.js:grupKaydet(k, duzenle)`, `k = { kod, ad, sira }`:
  - Yalnız `sistem.yonet` ister (grup erişimini atayan da sistem yöneticisidir).
  - Kod kırpılır, Türkçe büyük harfe çevrilir, boşluklar `_` olur; 2–20 karakter, yalnız harf (Türkçe büyük harfler dâhil), rakam, `_` ve `-` ("Grup kodu 2–20 karakter olmalı…"). Ad boş olamaz (`U.bicimAd` ile biçimlenir).
  - **Kod sonradan değişmez:** çalışmalar, bütçe bölümleri ve kullanıcı erişimleri koda bağlıdır. Düzenlemede (`duzenle = true`) yalnız ad ve sıra yazılır; kod yoksa "Grup bulunamadı."
  - Yeni grupta aynı kod varsa "Bu kodla bir grup zaten var."; sıra boşsa en büyük sıra + 1 verilir.
  - İşlem kaydı `EKLE` / `GUNCELLE` (tablo `grup`).
- **Grup silme** — `grupSil(kod)`: yalnız `sistem.yonet`. Grubun herhangi bir yılda çalışması varsa reddedilir ("Bu grubun n bütçe çalışması var; önce çalışmaları silin."). Onaylı çalışma silinemediği için (§2.7) onaylı çalışması olan grup, ancak o çalışma taslağa alınıp silindikten sonra silinebilir. Silme tek işlemdir ve grubun bütçe bölümlerini (`butce_bolumu`) ve kullanıcıların o gruba erişim kayıtlarını (`kullanici_grup`) da siler. Kişi kartları (`personel`) gruba bağlı olmadığı için kalır. İşlem kaydı `SIL`.
- Yeni grubu yönetici olmayan kullanıcıların görmesi için Kullanıcılar ekranından grup erişimi atanmalıdır (§7.3); sistem yöneticisi her grubu görür.
- Her ekran yalnız **seçili grubun** verisini gösterir; kullanıcı yalnız erişimi olan grupları görür (`gorunurGruplar`).
- Performans Değerlendirme ve Fazla Mesai Planı ekranları her grupta çalışır (menüde "Bütçe" başlığı altında); yalnız belirli bir gruba ait ekran yoktur.
- **Tümü** seçeneği yalnız birden fazla grubu gören kullanıcıda çıkar ve yalnız birleşik görünümü destekleyen ekranlarda (modül kaydında `tumuDestek: true`; Özet, Maliyet Tablosu gibi) çalışır; diğer ekranlar "Bu ekran tek bir grup üzerinde çalışır" uyarısı verir. Birleşik görünümde yılın görülebilen çalışmalarından grup başına biri alınır (`js/app.js:calismalar`) ve `js/db/api.js:birlesikHesapla` ile hesaplanır: kişi listeleri birleşir, özet rakamları toplanır. Gruplardan biri net, biri brüt esaslıysa (`birlesikHesapla` → `esaslar`, `karisikEsas`) maaş ve zam toplamları "—" gösterilir ve uyarı verilir; maliyetler esastan bağımsız olduğu için toplanır (§1.9). Kaynak: `js/app.js:git`, `calismaSeciciCiz`.

### 1.2 Yıl
- Bütçe yılı. Yıl listesi `parametre` ve `calisma` tablolarındaki yılların birleşimidir (`js/db/api.js:yillar`, `js/app.js:yilListesi`).
- Parametreler yıl bazındadır (§6). Bir yılın parametresi değişince o yılın bütün **taslak** çalışmaları (bütün gruplar) yeni değerle hesaplanır; onaylı çalışmalar etkilenmez (§2.4).
- İlk kurulumda yalnız başlangıç yılının (2026) yasal parametreleri yüklenir (`data/seed.js:SEED_YUKLE`); sonraki yıllar Yeni Yıl Öngörüsü (§6.2) ya da elle girilir.

### 1.3 Çalışma
- Bir grubun bir yıllık bütçe/zam çalışması: tablo `calisma (id, yil, grup_kod, ad, durum, zam_kademe, zam_performans, aciklama, olusturma)`, benzersizlik `UNIQUE (yil, grup_kod, ad)`.
- Aynı yıl ve grupta **birden çok çalışma** olabilir (ör. "2027 Bütçe" ve "2027 Revize"). Üst çubukta üçüncü bir seçiciyle biri seçilir; seçilmemişse listedeki ilki (sıralama `yil DESC, grup.sira, ad`) kullanılır. Kaynak: `js/app.js:calisma`, `js/db/api.js:calismaListe`.
- `durum`: `TASLAK` (değiştirilebilir) ya da `ONAYLI` (yönetim onayladı; kilitli).
- Bayraklar:
  - `zam_kademe` — zam öngörüsü maaş kademesine göre (düşük maaşa yüksek oran). Kapalıysa kademe tablosundaki "üst oran" sabit uygulanır.
  - `zam_performans` — kademe oranı kişinin performans çarpanıyla çarpılır.
  - Hesap ayrıntısı §6.1 ve `02-hesap-motoru.md`.
- Çalışmaya bağlı tablolar (hepsi `ON DELETE CASCADE`): `calisma_personel`, `aylik_girdi`, `calisma_ozet`, `calisma_ayar`, `performans_girdi`, `mesai_ongoru`, `calisma_parametre`. Kaynak: `js/db/schema.js:SEMA_SQL`.

### 1.4 Kişi kartı (`personel`) ile bütçe satırı (`calisma_personel`) farkı

| | Kişi kartı `personel` | Bütçe satırı `calisma_personel` |
|---|---|---|
| Kaç tane | Kişi başına **tek** kayıt, bütün yıllar ve gruplar ortak | Kişi × çalışma başına bir satır |
| Anahtar | `tc_kimlik_no` (PRIMARY KEY) | `(calisma_id, tc_kimlik_no)` |
| İçerik | `ad_soyad`, `ise_giris`, `isten_ayrilis`, `bolum`, `ekip`, `gorev`, `kaynak` (`ELLE` / `ERP` / `ORNEK`), `guncelleme` | `sira`, `butce_bolumu`, `yaka`, `maas_eski` (önceki yılın aylık maaşı, çalışmanın ücret esasında), `zam_ayi`, `duzeltme`, `performans_puani`, `performans_carpani`, `maliyet_onceki`, `karsilastirma`, Ocak'tan geçerli hesap bilgileri (`hesap_turu`, `kanun`, `sakatlik_derece`, `ozurlu_indirimi`, `bes`, `gv_tesvik`, `yol`), `not_metni`, dönem tarihi alanları `onay_sabit`, `onay_giris`, `onay_cikis` |
| Kim değiştirir | Personel formu, personel içe aktarma, örnek veri | Personel formu, hücre girişleri, aktarım, kopyalama, taşıma |

- **Maaş tek bir tutardır** ve çalışmanın ücret esasındadır (net ya da brüt, §1.9). Bütçe satırında yalnız önceki yıl maaşı (`maas_eski`) saklanır; zamlı (yeni) maaş her hesapta üretilir (`js/core/hesap.js:zamHesapla` → `yeni`) ve saklanmaz.
- T.C. değişirse (`eskiTc !== tc`) kişi kartının anahtarı güncellenir; bağlı bütün satırlar `ON UPDATE CASCADE` ile yeni numarayı izler (bütün çalışmalar, bütün yıllar). Yeni T.C. başka kişiye aitse işlem reddedilir ("Yeni T.C. No başka bir personele ait."). Kaynak: `js/db/api.js:calismaPersonelKaydet`.
- Kişi kartı tek kayıt olduğu için işe giriş/çıkış tarihi değişince diğer çalışmaların eski dönemi bozulmasın diye **dönem tarihi** mekanizması vardır (`onay_sabit`):
  - `0` — satır kişi kartının güncel tarihlerini kullanır.
  - `1` — çalışma **onaylandığı andaki** tarihler satıra dondurulmuştur (`onay_giris`, `onay_cikis`).
  - `2` — çalışmanın **kendi dönem tarihleri**: kişi sonradan başka dönemde ya da grupta yeniden girdiğinde eski çalışma eski giriş-çıkışını korur. Taslağa alma bunu silmez.
  - Hesapta, sıralamada ve ekranlarda tarih `onay_sabit > 0 ? onay_* : personel.*` kuralıyla okunur. Kaynak: `js/db/api.js:calismaHesapla`, `calismaPersonelListe`, `personelGecmis`; `js/db/schema.js` (`calisma_personel` açıklaması).

### 1.5 Bütçe bölümü
- Grup bazında tanım: `butce_bolumu (id, grup_kod, ad, sira)`, `UNIQUE (grup_kod, ad)`. Örnek veride Ofis grubunun bölümleri "YÖNETİM", "FİNANS VE MUHASEBE" … biçimindedir.
- **Numara ada yazılmaz**, ayrı `sira` alanındadır; ekranda `"08 PAZARLAMA"` biçiminde (`String(sira).padStart(2,'0') + ' ' + ad`) gösterilir. Girişte addaki baş numara `BOLUM_TEMIZLE` ile atılır (`"08 "`, `"08- "`, `"8) "`). Kaynak: `js/db/schema.js:BOLUM_TEMIZLE`, `js/db/api.js:bolumEtiket`.
- Bütçe satırı bölümü **adıyla** tutar (`calisma_personel.butce_bolumu` metin). Ad değişince o grubun bütün yıllarındaki satırlar da güncellenir (§6.7).
- **Karıştırılmamalı:** kişi kartındaki `personel.bolum` (iş yerindeki bölüm/departman) ayrı bir alandır. Fazla mesai planı `personel.bolum`'a göre eşleşir, bütçe bölümüne göre değil (`js/db/api.js:mesaiKisiBasi`).

### 1.6 Yaka
- `yaka` ∈ { `B` (beyaz), `M` (mavi) }; başka değer reddedilir (`js/db/api.js:calismaPersonelKaydet`). Personel içe aktarmada tanınmayan yaka var olan satırda değiştirilmez, yeni satırda `B` olur (`erpAktar`).
- Yakanın etkileri: zam kademesi yaka başına ayrıdır (`zam.M.*`, `zam.B.*`); varsayılan çalışılan gün yaka × ay tutulur (`gun.B.1` …); fazla mesai planında hafta içi saat (`fm1`) yalnız mavi yakaya dağıtılır (`mesaiKisiBasi`); performans modelinde her yakanın kendi kriterleri, değerlendirme ağırlığı ve ek puan alanları vardır (model `yaka.M` / `yaka.B`, §5.3); özet rakamları ve raporlar yaka kırılımlıdır (`calisma_ozet` anahtarlarının `_B` / `_M` eki).

### 1.7 Çalışma ayarları (`calisma_ayar`) anahtar kataloğu
Yılın parametresini o çalışma için geçersiz kılan anahtar/değer çiftleri. Kayıt yoksa yılın parametresi (ya da motorun varsayılanı) geçerlidir. `calismaAyarYaz` her anahtarı kabul eder; değer `null` ya da `''` ise anahtar silinir. Kaynak: `js/db/api.js:calismaAyarOku`, `calismaAyarYaz`, `calismaHesapla`, `calismaZamKademe`, `calismaPersonelKopyala`.

| Anahtar | Anlamı | Nerede yazılır | Yeni yıla (`YENI_YIL`) |
|---|---|---|---|
| `zam.{M,B}.{alt_esik,ust_esik,ust_oran,alt_oran}` | Çalışmaya özel zam kademesi; yılın `zam.*` parametresini geçersiz kılar | Çalışma Ayarları formu (Bütçe Çalışmaları → ✎) | Taşınır |
| `zam.yuvarla_ongoru` | Zam öngörüsünün yuvarlama adımı (TL). Sıra: bu ayar → yılın `zam_yuvarla` parametresi (§6.1) → 10 | Çalışma Ayarları formu ("Zam öngörüsü yuvarlama adımı (TL)"; boş = yılın parametresi) | Taşınır |
| `gun.{B,M}.{1..12}` | Yaka × ay varsayılan çalışılan gün; kişiye girilen gün önceliklidir; ikisi de yoksa 30 | Çalışma Ayarları formu | Taşınmaz |
| `arge_gun` | Çalışma geneli AR-GE günü — kişiye gün girilmemiş ve GV teşvik oranı yılın `arge_gv_esik` parametresine (varsayılan 0,8) ulaşan kişide kullanılır (§4.4) | Çalışma Ayarları formu ("AR-GE çalışılan gün"; boş = yok) | Taşınmaz |
| `tesvik.k05510` | 05510 indirim oranı (işyerinin niteliği: imalat / imalat dışı) | Çalışma Ayarları formu | Taşınır |
| `tesvik.k05746`, `tesvik.k14857`, `tesvik.k15510` | Çalışmaya özel teşvik oranları | Formda alanı yok (API) | Taşınmaz |
| `mesai.ongoru` | `'1'` ise kişilerin mesaisi bölüm tablosundan gelir (§4.6) | Fazla Mesai Planı ekranı (`mesaiAktifYaz`) | Taşınır |
| `dagilim.haric`, `dagilim.dahil` | Maaş Dağılımı listesinden çıkarılan / listeye elle alınan T.C.'ler (virgüllü) | Maaş Dağılımı ekranı | Taşınmaz |
| `ucret.esas` | Ücret esası: `'BRUT'` ya da kayıt yok (= NET) (§1.9) | Yeni Çalışma penceresi (yalnız "Boş" kaynakta); Çalışma Ayarları'nda yalnız bütçe satırı ve aylık girdi yokken | Taşınır (kaynaktan devralınır) |

`KOPYA` ve revize bütün anahtarları taşır (§2.3).

### 1.8 Çalışma özeti (`calisma_ozet`)
Elle girilen yönetim rakamları (`deger REAL`): `onceki_B`, `onceki_M` (önceki yıl maliyeti) ve `butce_B`, `butce_M` (bütçelenen maliyet). Özet ekranından yazılır (§5.5); örnek veri bunları hesaplanan maliyetten doldurur. "Tümü" görünümünde gruplarınki toplanır (`birlesikHesapla`). Kaynak: `js/db/api.js:calismaOzetOku`, `calismaOzetYaz`.

### 1.9 Ücret esası (net / brüt)
- Her bütçe çalışması tek bir **ücret esasıyla** tutulur: çalışma ayarı `ucret.esas` = `'BRUT'` ise brüt, kayıt yoksa **net** (varsayılan). Okuma `js/db/api.js:ucretEsasi(id)` (`'NET'` / `'BRUT'`); hesapta `P.ucretEsasi`, hesap sonucunda `ucretEsasi`.
- **NET esas:** girilen maaş ve ek ödemeler (prim, yol, ayni yardım, yakıt) nettir; brüt, sabit nokta yinelemesiyle bulunur. **BRÜT esas:** girilenler brüttür; kesintiler bir kez uygulanır ve net ödeme bulunur. Mesai brüt esasta brüt saat ücretinden hesaplanır; ayni yardımın vergisi brüt tutarın içinden düşülür. Kesinti, teşvik, işveren payı ve maliyet formülleri iki esasta aynıdır (ayrıntı `02-hesap-motoru.md`).
- Esasa bağlı olan yalnız **girilen tutarların anlamıdır**: `maas_eski`, zam düzeltmesi, aylık ek ödemeler, zam kademesi eşikleri (§6.1) ve içe aktarılan maaş sütunu bu esasta okunur. İşveren maliyeti her iki esasta aynı anlamdadır.
- Seçim, devralma ve değiştirilemezlik kuralları §2.9'da; ekranlar maaş ve ek ödeme etiketlerini esasa göre yazar ("Net/Brüt Maaş" gibi) ve ekran başlıklarında esası gösterir.

---

## 2. Çalışma yaşam döngüsü

```
           ┌───────────── yeni (BOS / YENI_YIL / KOPYA) ─────────────┐
           ▼                                                         │
       [TASLAK] ── Durum = Onaylı ──► [ONAYLI] ── Revize aç ──► yeni [TASLAK] ("YYYY Revize")
           ▲                              │
           └──── Durum = Taslak ──────────┘
       [TASLAK] ── Sil ──► (çalışma ve bağlı bütün kayıtlar silinir; kişi kartları kalır)
```

### 2.1 Yeni çalışma açma
- Ekran: Bütçe Çalışmaları → "+ Yeni Çalışma". API: `js/db/api.js:calismaKaydet` (id'siz kayıt) + gerekiyorsa `calismaPersonelKopyala`.
- Koşul: seçilen grupta yazma erişimi (`grupYazabilir`) **ve** `personel.yaz`. Yeni çalışma her zaman `durum='TASLAK'`, `zam_kademe=1`, `zam_performans=0` ile açılır (kaynak çalışmanın bayrakları kopyalanmaz; yalnız revizede kopyalanır). Ad boşsa `"<yıl> Bütçe"`. Ücret esası `calismaKaydet({…, ucret_esas})` ile verilir (`'NET'` / `'BRUT'`; başka değer reddedilir; verilmezse net). Ekran esas seçimini yalnız "Boş" kaynakta açar; kopyalanan çalışmada esas kaynaktan gelir (§2.9). İşlem kaydı `EKLE`.
- Aynı yıl + grup + ad ikinci kez açılamaz (veritabanı `UNIQUE` kısıtı; programda özel mesaj yoktur — bkz. §13).
- Üç kaynak türü vardır; kaynak her zaman **aynı grubun** bir çalışmasıdır:

| Tür | Kaynak çalışma | Ne yapılır |
|---|---|---|
| `BOS` | — | Yalnız çalışma açılır; personel sonra Personel İçe Aktarma ekranından (Excel / ERP listesi) alınır ya da elle eklenir. |
| `YENI_YIL` | Aynı grup, bir önceki yıl | §2.2 |
| `KOPYA` | Aynı grup, aynı yıl | §2.3 (senaryo denemek için) |

- Ekran kaynak listesini türe göre süzer (`YENI_YIL`: yıl − 1, `KOPYA`: aynı yıl). API (`calismaPersonelKopyala`) yalnız aynı grup koşulunu denetler, yıl farkını denetlemez.
- Hedef yılın parametreleri yoksa çalışma yine açılır; parametre girilene kadar hesap "<yıl> yılının gelir vergisi dilimleri girilmemiş." ya da "… asgari ücreti girilmemiş." hatası verir (`js/db/api.js:hesapParametre`).
- `calismaPersonelKopyala` kontrolleri: kaynak için okuma (`calismaOkuIste`), hedef için yazma (`calismaYazIste(hedef, 'personel.yaz')`, yani hedef taslak olmalı), kaynak ve hedef **aynı grupta** olmalı ("Kaynak ve hedef aynı grupta olmalı.").
- Çalışma açma ile kopyalama iki ayrı API çağrısıdır; ikisini tek işlemde yapan yalnız revizedir (§2.6, §13).

### 2.2 `YENI_YIL` — önceki yıldan yeni yıla aktarım
Kaynak: `js/db/api.js:calismaPersonelKopyala` (`tur !== 'KOPYA'` dalı). Kaynak çalışma önce **tam hesaplanır** (`calismaHesapla(kaynakId)`; kaynak onaylıysa dondurulmuş parametreleriyle).

**Kim aktarılmaz**
1. Çıkış yılı ≤ kaynak yıl olan kişi. Çıkış tarihi **kişi kartından güncel** okunur (onaylı çalışmanın dondurulmuş tarihinden değil): onaydan sonra ayrılan da aktarılmaz. Kartta çıkış boşsa ve satırda dönem tarihi varsa (`onay_sabit > 0`) `onay_cikis` kullanılır (kişi yeniden girdiğinde kartta çıkış silinmiştir, dönem çıkışı satırdadır).
2. Hedef yılda **başka bir grubun** herhangi bir çalışmasında zaten bulunan kişi (grup değiştirmiş).
3. Hedef çalışmada zaten olan kişi (`INSERT OR IGNORE`; aktarılan sayısına girmez).

**Yeni satırın alanları**

| Hedef alan | Değer |
|---|---|
| `sira`, `butce_bolumu`, `yaka`, `not_metni` | Kaynaktan aynen |
| `maas_eski` | Kaynak yılın **zamlı** maaşı (`zam.yeni`) |
| `zam_ayi` | 1 (Ocak) |
| `duzeltme` | 0 (sıfırlanır) |
| `maliyet_onceki` | Kaynak yılın hesaplanan yıllık maliyeti (`yil.maliyet`) |
| `hesap_turu`, `kanun`, `sakatlik_derece`, `ozurlu_indirimi`, `bes`, `gv_tesvik`, `yol` | Kaynak yılın **Aralık'ta geçerli** değeri: aylık girdilerde Şubat–Aralık arasındaki son kayıt, yoksa satırın Ocak değeri |
| `performans_puani`, `performans_carpani`, `karsilastirma` | Boş (NULL) — kopyalanmaz |
| `onay_sabit`, `onay_giris`, `onay_cikis` | Varsayılan (0 / boş) — yeni çalışma kişi kartının güncel tarihlerini kullanır |

**Hiç taşınmayanlar:** `aylik_girdi` (ayni, prim, yakıt, çalışılan gün, mesai, **AR-GE günü** ve yıl içi değişiklik kayıtları — sürekli alanların Aralık değeri satıra katlanır), `performans_girdi`, `mesai_ongoru`, `calisma_ozet`.

**Ücret esası:** hedef, kaynağın esasını devralır (§2.9).

**`calisma_ayar` aktarımı:** bütün anahtarlar kopyalanır, şunlar **hariç**: `gun.%` (eksik gün öngörüsü), `dagilim.%` (maaş dağılımı listesi seçimi), `arge_gun`, `tesvik.%` — yalnız `tesvik.k05510` taşınır. Yani taşınanlar: `zam.*` (kademe ve yuvarlama), `tesvik.k05510`, `mesai.ongoru`, `ucret.esas`.
- `mesai.ongoru` taşınır ama `mesai_ongoru` tablosu taşınmaz: öngörü açıkken yeni yılın tablosu boş kalırsa kişilerin mesaisi 0 hesaplanır (kişiye o ay elle girilen mesai hariç). Tablo `mesaiKopyala` ile önceki yıldan alınır; niyet kodda yazılı değildir (§13).

Sonradan yapılacak personel içe aktarma (§5.1) önceki yıl maaşlarını gerçekleşen maaşlarla (çalışmanın esasında) günceller.

### 2.3 `KOPYA` — aynı yıldan birebir kopya
Kaynak: `js/db/api.js:calismaPersonelKopyala` (`tur === 'KOPYA'`). Satır kopyaları `INSERT OR IGNORE`'dur (hedefte olan satır ezilmez):
- `calisma_personel` — `CP_ALANLAR` listesindeki bütün alanlar (`sira, butce_bolumu, yaka, maas_eski, zam_ayi, duzeltme, performans_puani, performans_carpani, maliyet_onceki, karsilastirma, hesap_turu, sakatlik_derece, ozurlu_indirimi, bes, kanun, gv_tesvik, yol, not_metni`). **`onay_sabit`, `onay_giris`, `onay_cikis` kopyalanmaz** (§13).
- `aylik_girdi`, `calisma_ozet`, `performans_girdi`, `mesai_ongoru` — birebir.
- `calisma_ayar` — **bütün** anahtarlar (`gun.*`, `arge_gun`, `tesvik.*`, `dagilim.*` dâhil); ücret esası kaynaktan devralınır (§2.9).
- Kopyalanan kişi sayısı geri döner; işlem kaydı `KOPYALA`.

### 2.4 Onaylama (TASLAK → ONAYLI)
- Ekran: Bütçe Çalışmaları → ✎ (Çalışma Ayarları) → Durum = "Onaylı" → Kaydet. Ayrı bir "onay" yetkisi **yoktur**: grupta yazma erişimi + `personel.yaz` yeterlidir. Kaynak: `js/db/api.js:calismaKaydet`.
- Çalışma ayarları (`calismaAyarYaz`) yalnız taslakta yazılabildiği için ayarlar durum değişmeden önce yazılmalıdır; onaylı çalışmada `calismaAyarYaz` reddedilir.
- Taslaktan onaylıya geçişte tek işlem (transaction) içinde:
  1. **Tarih dondurma** — `ONAY_TARIH_DONDUR`: `onay_sabit = 0` olan satırlar `onay_sabit = 1` yapılır ve kişi kartının o anki `ise_giris`/`isten_ayrilis` değerleri `onay_giris`/`onay_cikis`'e yazılır. `onay_sabit = 2` olan satırlar kendi dönem tarihleriyle kalır. Kaynak: `js/db/schema.js:ONAY_TARIH_DONDUR`.
  2. **Parametre dondurma** — `PARAMETRE_DONDUR`: yılın bütün hesap parametreleri (`parametre`, `gv_dilim`, `asgari_ucret`, `hesap_turu`, `kanun_turu`, `sakatlik_derece`, `performans_kademe`) JSON olarak `calisma_parametre`'ye yazılır (`INSERT OR IGNORE`, var olanın üzerine yazmaz). Kaynak: `js/db/schema.js:PARAMETRE_ANLIK_AL`, `PARAMETRE_DONDUR`.
- Onaylı çalışma **her zaman** dondurulmuş parametrelerle hesaplanır (`calismaHesapla` → `hesapParametre(yil, calismaParametreAnlik(id))`). Parametreler ekranında o yıla sonradan girilen resmî rakamlar onaylı maliyete yansımaz.
- **Kilit:** onaylı çalışmaya yazan bütün işlemler `calismaYazIste` üzerinden reddedilir: "Bu çalışma onaylı ve kilitli. Değişiklik için Bütçe Çalışmaları → ✎ ekranından "Taslak"a alın." Kaynak: `js/db/api.js:calismaYazIste`. Ekranların düzenleme alanları `calismaYazilabilir(c)` (grup yazma + onaylı değil) ile kapatılır; çalışma gerektiren her ekranın başına "onaylı ve kilitli" bandı eklenir (`js/app.js:git`).
- Onaylı kalan çalışmada `calismaKaydet` yalnız **açıklamayı** değiştirir: ad ve zam bayrakları (`zam_kademe`, `zam_performans`) kayıttaki değerde kalır. Var olan çalışmanın grubu her zaman kaydın kendisinden alınır (çalışma başka gruba aktarılamaz).
- Onaylı çalışma **silinemez** (`calismaSil` → `calismaYazIste`).

### 2.5 Taslağa geri alma (ONAYLI → TASLAK)
- Aynı formdan Durum = Taslak. Koşul onaylamayla aynı (grup yazma + `personel.yaz`). `calismaKaydet` durum değişikliğinde `calismaYazIste` çağırmadığı için bu geçiş mümkündür.
- Tek işlemde: `onay_sabit = 1` olan satırlar `onay_sabit = 0`, `onay_giris = NULL`, `onay_cikis = NULL` yapılır (kişi kartının güncel tarihleri geçerli olur — maliyet değişebilir); `calisma_parametre` kaydı silinir (yılın güncel parametreleri geçerli olur). `onay_sabit = 2` satırlarına dokunulmaz.
- İşlem kaydı `GUNCELLE` ("durum ONAYLI → TASLAK").

### 2.6 Revize açma (`calismaRevizeAc`)
- Amaç: onaylı çalışma olduğu gibi kalsın; yılın güncel (ör. sonradan açıklanan resmî) parametreleriyle hesaplanan bir **taslak kopya** açılsın. Ekran: Bütçe Çalışmaları listesinde onaylı satırdaki "Revize aç". Koşul: grup yazma + `personel.yaz`. Kaynak: `js/db/api.js:calismaRevizeAc`.
- Ad: `"<yıl> Revize"`; aynı ad varsa `"<yıl> Revize 2"`, `"<yıl> Revize 3"` …
- Açıklama: `"Revize · kaynak: <ad> (onaylı)"`.
- Kaynağın `zam_kademe` ve `zam_performans` bayrakları ve ücret esası kopyalanır.
- İçerik `calismaPersonelKopyala(kaynak, yeni, 'KOPYA')` ile kopyalanır (§2.3): personel satırları, zam düzeltmeleri, aylık girdiler, özet, performans, fazla mesai planı, bütün çalışma ayarları.
- Çalışmanın açılması ve kopyalama **tek işlemdir**: kopyalama yarıda kalırsa boş revize çalışması da oluşmaz.
- Revize yılın **güncel** parametreleriyle hesaplanır (dondurma yok). Dönem tarihleri kopyalanmadığı için kişi kartının güncel tarihlerini kullanır (§13).
- API onaylı olmayan çalışmanın revizesine de izin verir; ekranda düğme yalnız onaylı satırda çıkar.

### 2.7 Çalışma silme (`calismaSil`)
- Koşul: `calismaYazIste(id, 'personel.yaz')` → grup yazma + **taslak** + `personel.yaz`.
- Çalışma ve CASCADE ile bağlı her şey silinir (bütçe satırları, aylık girdiler, özet, ayarlar, performans, mesai, dondurulmuş parametre). Kişi kartları silinmez. İşlem kaydı `SIL`.

### 2.8 Çalışma ayarlarının ve özetin kaydı
- `calismaAyarYaz`: koşul `calismaYazIste(id, 'personel.yaz')`. Değer `null`/`''` ise anahtar silinir (yılın değerine dönülür). Oranlar ekranda yüzde girilir, oran olarak saklanır.
- `calismaOzetYaz` (özet rakamları) de aynı koşulu ister; boş değer `NULL` olarak saklanır.

### 2.9 Ücret esasının seçimi, devralınması ve değiştirilemezliği
Kaynak: `js/db/api.js:calismaKaydet`, `calismaAyarYaz`, `calismaPersonelKopyala`, `ucretEsasiYazIc`.
- **Seçim:** esas, çalışma açılırken seçilir (`calismaKaydet`, `ucret_esas`). Esası bağlayan tutar olmayan (bütçe satırı ve aylık girdi kaydı bulunmayan) taslak çalışmada Çalışma Ayarları'ndan değiştirilebilir (`calismaAyarYaz({'ucret.esas': 'NET' | 'BRUT'})`; `'NET'` kaydı siler).
- **Değiştirilemezlik:** bütçe satırı **ya da** aylık girdi kaydı olan çalışmanın esası değiştirilemez (`esasBagli(id)`; aylık girdi, satırı silinmiş bir kişiden kalmış olabilir); `calismaAyarYaz` reddeder ("Tutar girilmiş (personeli ya da aylık girdisi olan) bütçe çalışmasının ücret esası değiştirilemez: girilmiş tutarlar öbür esasta yanlış okunur. Esası değiştirmek için boş bir çalışma açın."). Onaylı çalışmada ayar zaten yazılamaz.
- **Devralma:** `YENI_YIL`, `KOPYA` ve revize hedefe kaynağın esasını yazar (`calismaPersonelKopyala`); esas, satır kopyasıyla **aynı işlemde** yazılır, kopyalama yarıda kalırsa esas da değişmez. Hedefin esası bağlıysa (`esasBagli`: bütçe satırı ya da aylık girdi var) ve esaslar farklıysa aktarım reddedilir ("Kaynak ve hedef çalışmanın ücret esası farklı (net / brüt); aktarılamaz."). Revize açılırken hedef boş olduğu için esas her zaman kaynaktan gelir.
- **Yeni esasa geçmek:** net bir bütçeyi brüte (ya da tersine) çevirmenin yolu, istenen esasla **boş** bir çalışma açıp personeli o esasta (içe aktarma ya da elle) girmektir; program tutarları çevirmez.

---

## 3. Personel işlemleri

### 3.1 Yeni personel ekleme
- Ekran: Personel ve Zam → "+ Yeni Personel". API: `js/db/api.js:calismaPersonelKaydet(id, v, null)`; koşul `calismaYazIste(id, 'personel.yaz')`.
- Zorunlu: T.C. 11 hane (`U.tcTemizle`: rakam dışı karakterler atılır, ilk 11 hane alınır), Ad Soyad, yaka `B`/`M`.
- Kişi kartı yoksa yeni kart `kaynak='ELLE'` ile oluşturulur.
- **T.C. ile ön doldurma** — `personelOnDoldur(tc, yil, hedefId)` kişi kartı varsa `{ personel, gecmis, son, satir, esasFarkli }` döndürür:
  - `son`: kişinin geçmişinde bu yıldan **önceki** en yeni çalışma; yoksa en yeni çalışma.
  - `satir`: `son` çalışmadaki bütçe satırı. `son` önceki yıldansa o çalışma hesaplanır ve — yeni yıl aktarımındaki gibi — `maas_eski` o yılın **zamlı** maaşı, `maliyet_onceki` o yılın maliyeti olur; `duzeltme` 0, `performans_puani` ve `performans_carpani` boş yapılır.
  - `son` çalışmanın ücret esası hedef çalışmanınkinden (`hedefId`) farklıysa maaş **doldurulmaz** (`maas_eski = null`, `esasFarkli = true`): net tutar brüt diye ya da brüt tutar net diye okunmasın. Maaş elle, hedefin esasında girilir.
  - Geçmiş yalnız kullanıcının **görebildiği** gruplardan derlenir (`personelGecmis` → `grupGorebilir`).
- **Geçmiş** (`personelGecmis`): kişinin bütün çalışmaları (yıl, grup, çalışma, durum, bütçe bölümü, yaka, o çalışmadaki giriş/çıkış). Kişi aynı yıl başka bir grupta da varsa iki grupta birden maliyeti sayılır; ekran bunu uyarır ve grup taşımayı (§3.6) önerir.

### 3.2 Maaş alanının anlamı (giriş tarihine bağlı)
Kaynak: `js/db/api.js:ayOf`, `calismaHesapla` (`eskiYilda`); `js/core/hesap.js:zamHesapla`, `ayHesapla`.
- İşe giriş **yıl başından önce** ya da boş → yazılan maaş **önceki yıl maaşıdır** (`maas_eski`); bu yılın zammı (kademe öngörüsü + `duzeltme`) `zam_ayi`'ndan itibaren eklenir. Önceki yıl içinde girenler de bu gruptadır.
- İşe giriş **bütçe yılı içinde** → yazılan tutar **bu yılın maaşıdır**; kademe öngörüsü 0'dır (`eskiYilda = false`), yalnız elle girilen `duzeltme` eklenir; maliyet giriş ayından itibaren hesaplanır.
- İşe giriş **bütçe yılından sonra** → bu çalışmada hiçbir ay hesaplanmaz.
- Çıkış ayı hesaplanır, sonraki aylarda maaş ve bütün ek ödemeler 0'dır. Çıkış yıl başından önceyse hiçbir ay hesaplanmaz.

### 3.3 Düzenleme
- Kişinin adına tıklanınca kart açılır; düzenleme koşulu eklemeyle aynıdır (`calismaYazilabilir` + `personel.yaz`), değilse alanlar salt okunurdur.
- Kayıtta kişi kartı ve bütçe satırı **birlikte** yazılır (tek işlem). Tarih kuralı:
  - Satır `onay_sabit = 2` ise (bu çalışmanın kendi dönemi) yeni tarihler **yalnız satıra** (`onay_giris`, `onay_cikis`) yazılır; kişi kartının tarihine dokunulmaz (ad, bölüm, ekip, görev yine kartta güncellenir).
  - Aksi hâlde tarih değişiyorsa önce `donemTarihleriniKoru`: kişiyi içeren **diğer bütün** çalışmalarda `onay_sabit = 0` olan satırlar `onay_sabit = 2` yapılır ve kartın **eski** tarihleri bu satırlara yazılır (onaylı satırlar zaten `1`'dir). Sonra kart yeni tarihlerle güncellenir. Kaynak: `js/db/api.js:donemTarihleriniKoru`, `calismaPersonelKaydet`.
- Sayısal alanlar Türkçe sayı biçiminden okunur (`trSayi`: "40.000" → 40000, "1.234,5" → 1234,5, "0,25" → 0,25; 0 ile başlayan noktalı değer ondalıktır). Boş olabilen sayısal alanlar boşta `NULL`, diğerleri 0 olur (`CP_BOS_OLABILIR`: `performans_puani, performans_carpani, maliyet_onceki, karsilastirma, sakatlik_derece`).
- Özürlü indirimi: sakatlık derecesi doluysa hesapta her ay **o yılın** sakatlık tablosundan okunur (öngörüyle kendiliğinden artar); derece boşsa kişiye girilen tutar geçerlidir (`calismaHesapla`).

### 3.4 Hücreden hızlı giriş (`calismaPersonelAlanYaz`)
- Yalnız bir alanı yazar; alan `CP_ALANLAR`'da olmalıdır ("Bilinmeyen alan").
- Yetki: `duzeltme`, `performans_puani`, `performans_carpani` → `zam.yaz`; diğerleri (`maas_eski` dâhil) → `personel.yaz`. Hepsi `calismaYazIste` (grup yazma + taslak) ister.
- Kullanımlar: Zam sekmesindeki **Düzeltme** hücresi, Kişi Bilgileri sekmesindeki **performans puanı / çarpanı** hücreleri ve Excel Raporu'ndan yönetim düzeltmelerinin geri yüklenmesi (§5.2). Her yazma ayrı bir `GUNCELLE` kaydı üretir.
- **Kişi Bilgileri hücreleri** (bütçe bölümü, yaka, işe giriş, çıkış, hesaplama türü, kanun, AR-GE GV teşviki, sakatlık, BES, zam ayı) bu yolu **kullanmaz**: hücre değişince güncel satır alınır, yalnız o alan değiştirilir ve kart kaydı (`calismaPersonelKaydet`, §3.3) çağrılır. Böylece yaka denetimi, tarih kuralı (`onay_sabit`, `donemTarihleriniKoru`) ve sakatlık derecesinden özürlü indirimi kartla aynı işler; koşul da aynıdır (`calismaYazilabilir` + `personel.yaz`). Yılı 1900–2200 dışındaki tarih ekranda reddedilir (`personel.js:hucreKaydet`).

### 3.5 Bütçeden çıkarma (`calismaPersonelSil`)
- Koşul: `calismaYazIste(id, 'personel.yaz')`. Ekran: satırdaki 🗑 ve kartta "Bütçeden çıkar".
- Tek işlemde **yalnız bu çalışmadaki** kayıtlar silinir: `aylik_girdi`, `performans_girdi`, `calisma_personel`. Kişi kartı ve diğer çalışmalar etkilenmez.
- Kişi yıl içinde ayrılacaksa silmek yerine çıkış tarihi girilmelidir (§3.7).
- `calisma_ayar` içindeki `dagilim.haric`/`dagilim.dahil` listelerinde kalan T.C. temizlenmez (zararsız; kişi listede olmadığı için etkisi yoktur).

### 3.6 Grup taşıma (`tasimaHedefleri`, `calismaPersonelTasi`)
- Amaç: kişi aynı yıl içinde başka gruba geçtiyse **bütün bilgileriyle** taşınır ve bu çalışmadan çıkar. Ekran: kişi kartındaki **Grup** seçimi. Kart kaydı ve taşıma tek bir API çağrısıdır: `calismaPersonelKaydet(id, v, eskiTc, { hedefId, butceBolumu })` önce kartı bu çalışmaya kaydeder, sonra `calismaPersonelTasi`'yı çağırır; **ikisi tek işlemdir**, taşıma başarısız olursa kart değişikliği de geri alınır.
- **Hedef listesi** (`tasimaHedefleri(id)`): aynı yılın, **başka grubun**, **onaylı olmayan**, kullanıcının **yazabildiği** ve **ücret esası aynı** olan çalışmaları.
- **Koşullar** (`calismaPersonelTasi`): kaynak ve hedef için ayrı ayrı `calismaYazIste(..., 'personel.yaz')` (ikisi de taslak, ikisinde de grup yazma); aynı yıl ("Taşıma aynı yılın çalışmaları arasında yapılır."); **aynı ücret esası** ("Ücret esasları farklı (net / brüt) çalışmalar arasında kişi taşınamaz."); kişi kaynakta olmalı; hedefte olmamalı ("Kişi <grup> · <çalışma> çalışmasında zaten var").
- **Taşınanlar** (tek işlem):
  - Bütçe satırının `CP_ALANLAR` alanları + `onay_sabit`, `onay_giris`, `onay_cikis`. `onay_sabit = 1` ise hedefe `0` olarak yazılır (onay dondurması taşınmaz); `2` korunur.
  - `butce_bolumu`: gönderilen bölüm hedef grubun bölümleri arasında varsa o, yoksa boş.
  - `sira`: hedef çalışmadaki en büyük sıra + 1.
  - `aylik_girdi` ve `performans_girdi` hedefe kopyalanır (`INSERT OR REPLACE`).
  - Kaynaktan silinir: `aylik_girdi`, `performans_girdi`, `calisma_personel`.
  - İşlem kaydı `TASI`.
- **Onaylıya etkisi:** yoktur. Onaylı çalışmalar ne kaynak ne hedef olabilir; kişinin önceki yılların onaylı çalışmalarındaki satırları olduğu gibi kalır.
- **Yeni giriş tarihi:** taşıma giriş tarihini **değiştirmez** (`calismaPersonelTasi` tarih yazmaz). Aynı kayıtta İşe Giriş değiştirilirse önce kaynak çalışmada kart güncellenir (`donemTarihleriniKoru` diğer çalışmalarda eski tarihi saklar), sonra satır taşınır; hedef çalışma kartın yeni tarihini kullanır.

### 3.7 İşten çıkış
- Kişi kartında **İşten Çıkış** tarihi girilir (silme yerine önerilen yol). Çıkış ayından sonraki aylar hesaplanmaz; kişi aynı çalışmada kalır.
- Onaylı çalışmada çıkış onay anındaki tarihle hesaplanır; kartta sonradan değişen çıkış onaylı maliyete girmez (ekran farkı ayrıca gösterir).
- Yeni yıl aktarımında çıkış yılı ≤ kaynak yıl olan kişi taşınmaz (§2.2).
- Personel içe aktarmada dosyada olmayan çalışma personeline dokunulmaz; ayrılanların çıkış tarihi kişi kartına girilmelidir.

### 3.8 Yeniden işe alım
- Aynı T.C. ile "+ Yeni Personel" açılır; ön doldurma son çalışmadan gelir (§3.1). İşe Giriş yeni tarih yapılır, İşten Çıkış boşaltılır. Kayıtta kişi kartı yeni dönemle güncellenir; eski çalışmalardaki satırlar `donemTarihleriniKoru` ile eski giriş-çıkışı kendi satırlarında saklar (`onay_sabit = 2`). Onaylı çalışmalar zaten onay anındaki tarihle hesaplanır.
- **Maaş anlamı:** son çalışma önceki yıldansa ön doldurulan maaş o yılın **zamlı** maaşıdır. Yeni giriş tarihi bütçe yılı içindeyse §3.2 gereği yazılan tutar bu yılın maaşıdır ve kademe öngörüsü uygulanmaz; yıl başından önceyse önceki yıl maaşı sayılır ve zam eklenir.
- Bütçe bölümleri grup bazında olduğundan kişi farklı bir gruba alınıyorsa bölüm yeniden seçilir.
- Personel içe aktarma boş gelen çıkış tarihini yazmadığı için yeniden giren kişinin karttaki eski çıkış tarihi aktarımla silinmez; elle boşaltılmalıdır (§13).

### 3.9 Sıralama kuralı
Kaynak: `js/db/api.js:calismaPersonelListe` (SQL `ORDER BY`). Bütün personel listeleri, hesap sonucu ve Excel çıktıları bu sırayı izler.
1. Bütçe bölümünün `sira`'sı (Tanımlar'daki). Bölümü olmayan ya da tanımda bulunmayan satırlar **en sonda**.
2. Bölüm içinde **etkin işe giriş tarihi** eskiden yeniye (en son giren bölümün en altında). Etkin tarih: `onay_sabit > 0 ? onay_giris : personel.ise_giris`. Giriş tarihi boş olanlar bölümün **başında** (SQLite'ta `NULL` artan sırada önce gelir).
3. Aynı gün girenler `ad_soyad`'a göre. Sıralama SQLite'ın varsayılan (ikili) karşılaştırmasıyla yapılır; Türkçe harf sırası uygulanmaz.
- `calisma_personel.sira` alanı listeyi **sıralamaz**; yalnız Excel Raporu dosyasında "SIRA" olarak gösterilir.

---

## 4. Aylık girdiler

### 4.1 Model
- Tablo `aylik_girdi (calisma_id, tc_kimlik_no, ay, alan, deger)`; yalnız **Ocak'tan (ya da önceki aydan) farklı** olan değerler saklanır. Ocak değerleri bütçe satırındadır.
- Alanlar ve etiketleri: `js/db/api.js:AYLIK_SUREKLI`, `AYLIK_TEK`, `AYLIK_KISI_ALANLARI`, `AYLIK_ETIKET`.

| Alan | Etiket | Tür | Gereken yetki |
|---|---|---|---|
| `hesap_turu` | Hesaplama türü | SÜREKLİ | `personel.yaz` |
| `kanun` | Kanun türü | SÜREKLİ | `personel.yaz` |
| `sakatlik_derece` | Sakatlık derecesi | SÜREKLİ | `personel.yaz` |
| `ozurlu_indirimi` | Özürlü indirimi | SÜREKLİ | `personel.yaz` |
| `bes` | BES | SÜREKLİ | `personel.yaz` |
| `gv_tesvik` | GV teşvik oranı | SÜREKLİ | `personel.yaz` |
| `yol` | Yol parası | SÜREKLİ | `personel.yaz` |
| `fm1` | Hafta içi mesai (saat) | SÜREKLİ | `aylik.yaz` |
| `fm2` | Hafta sonu mesai (saat) | SÜREKLİ | `aylik.yaz` |
| `arge_gun` | AR-GE gün | SÜREKLİ | `aylik.yaz` |
| `ayni` | Ayni yardım | TEK | `aylik.yaz` |
| `prim` | Prim ve diğer ödemeler | TEK | `aylik.yaz` |
| `yakit` | Yakıt yardımı | TEK | `aylik.yaz` |
| `calisilan_gun` | Çalışılan gün | TEK | `aylik.yaz` |

Kaynak (yetki): `js/db/api.js:aylikGirdiYaz` — `AYLIK_KISI_ALANLARI` (kişinin hesap bilgileri) `personel.yaz`, geri kalanı `aylik.yaz`. Her durumda `calismaYazIste` (grup yazma + taslak). Bilinmeyen alan reddedilir. Değer boşsa o ayın kaydı silinir, doluysa `INSERT OR REPLACE`.

### 4.2 `AYLIK_SUREKLI` (devreden) ve `AYLIK_TEK` (yalnız o ay)
Kaynak: `js/db/api.js:calismaHesapla` (ay döngüsü).
- **SÜREKLİ:** Ocak değeri bütçe satırından başlar (mesai 0, AR-GE günü boş); bir aya kayıt girilince **o aydan itibaren** sonraki bütün aylar yeni değeri kullanır, sonraki bir aya yeni kayıt girilene kadar sürer. Kanun için hem kural kodu (`kanun_turu.kural`) hem oran (`kanun_turu.oran`) ay ay güncellenir.
- **TEK:** yalnız girildiği ay geçerlidir; girilmeyen ayda 0. `calisilan_gun` girilmemişse çalışma ayarındaki `gun.<yaka>.<ay>`, o da yoksa motorun varsayılanı (30) kullanılır.
- `fm1`/`fm2` **devreder**: Ocak'a girilen mesai saatleri, değiştirilmedikçe bütün aylarda geçerlidir (aylık standart mesai öngörüsü).
- **Fazla mesai planı açıkken** (`calisma_ayar['mesai.ongoru'] = '1'`): kişinin aylık mesaisi bölüm tablosundan gelir (bölümün saati ÷ bölümün kişi sayısı); yalnız **o aya** kişiye girilmiş `fm1`/`fm2` kaydı önceliklidir. Bu kipte elle girilen mesai sonraki aylara devretmez (kod yalnız o ayın kaydına bakar: `a.fm1 !== undefined`). Kaynak: `js/db/api.js:calismaHesapla`, `mesaiKisiBasi`.

### 4.3 Aylık Girdiler ekranı
- Ay sekmeleriyle çalışır; satırlar çalışmanın bütün kişileridir. Hesaplama türü ve kanunun yıl içi değişimi Şubat'tan itibaren aylık kayıt olarak girilir (Ocak değeri kişi kartındadır) ve `personel.yaz` ister; tutar, mesai ve gün hücreleri `aylik.yaz` ister. Boş bırakılan hücre o ayın kaydını siler.
- API, `AYLIK_KISI_ALANLARI`'nın hepsine aylık kayıt yazmayı destekler; ekranın hangi alanları aylık olarak açtığı, hücre düzeni ve görsel kuralları `04-ekranlar-ve-dosya-bicimleri.md` belgesindedir.

### 4.4 AR-GE günü
- `arge_gun` **devreder**: Ocak'a girilen gün bütün yıla geçer.
- **Varsayılan yoktur:** yılın parametresi olarak AR-GE günü tutulmaz (`hesapParametre` motora `argeGun: 0` verir). Bir ayın AR-GE günü sırayla: kişiye girilen (ya da devralınan) `arge_gun`; yoksa kişinin GV teşvik oranı yılın `arge_gv_esik` parametresine (varsayılan 0,8; motorda `P.argeEsik`) ulaşıyorsa çalışma ayarı `calisma_ayar['arge_gun']`, o da yoksa 0; GV teşvik oranı eşiğin altındaysa 0. Hesapta AR-GE günü sigorta gününü aşamaz. Kaynak: `js/db/api.js:hesapParametre`, `calismaHesapla`; `js/core/hesap.js:ayHesapla` (`AP`).
- Yeni yıla taşınmaz (`YENI_YIL` hem `arge_gun` ayarını hem aylık girdileri dışarıda bırakır).

### 4.5 Toplu giriş (`aylikGirdiToplu`)
- Ekran: Aylık Girdiler → "Tüm kişilere: [alan] [değer] <Ay> ayına uygula" (onay penceresi kişi sayısını ve değeri gösterir).
- API denetimleri tek girişle aynıdır: bilinmeyen alan reddedilir; ay 1–12 olmalıdır ("Ay 1 ile 12 arasında olmalı."); `AYLIK_KISI_ALANLARI` `personel.yaz`, diğer alanlar `aylik.yaz` ister; her durumda `calismaYazIste`.
- Değer boşsa listedeki kişilerin o ayki kaydı **silinir**; doluysa `INSERT OR REPLACE`. Tek işlem; işlem kaydı `TOPLU`.
- **AR-GE günü kuralı (ekran):** değer **doluysa** yalnız o ay kanunu `05746` (AR-GE) olan kişilere yazılır (kanun o ayın etkin kanunudur); o ay 05746 kanunlu kimse yoksa işlem yapılmaz. Değer **boşsa** (temizleme) herkese uygulanır — AR-GE'li olmayan kişide kalmış gün de silinsin. API kişi listesini olduğu gibi uygular; süzme ekrandadır.

### 4.6 Fazla mesai planı (`mesai_ongoru`)
- Her grupta kullanılabilir. Tablo `mesai_ongoru (calisma_id, yaka, bolum, ay, alan, deger)`. `alan`: `fm1` (hafta içi toplam saat, yalnız mavi yakaya dağılır), `fm2` (hafta sonu toplam saat), `kisi` (planlanan kişi sayısı; boş = çalışmadaki mevcut kadro). Takvim satırları (`yaka = ''`, `bolum = ''`): `gun`, `tatil_mesai`, `tatil_tam`, `tatil_yok` — yalnız bilgi, hesaba girmez.
- Bölüm eşleşmesi `personel.bolum` ile, boşluklar sadeleştirilip Türkçe büyük harfle yapılır (`mesaiAnahtar`). Kişi başı mesai = bölümün o ayki saati ÷ kişi sayısı (`mesaiKisiBasi`). Saatin tutara çevrilmesi yılın `mesai_fm1_kat`, `mesai_fm2_kat` ve `mesai_gun_saat` parametreleriyle yapılır (§6.1).
- Tablo yalnız `calisma_ayar['mesai.ongoru'] = '1'` iken hesabı belirler; açıp kapatma `mesaiAktifYaz` ile yapılır.
- Yazma (`mesaiYaz`, `mesaiKopyala`, `mesaiAktifYaz`): `calismaYazIste(id, 'aylik.yaz')`. `mesaiYaz`'da değer boşsa hücre silinir; ay 1–12; bilinmeyen alan reddedilir; tek işlem. `mesaiKopyala` hedefteki tabloyu **siler**, kaynağınkini kopyalar (kaynak için okuma yetkisi `calismaOkuIste`).

---

## 5. Toplu içe alma işlemleri

Bütün içe almaların ortak kuralları:
1. **Önce önizleme**; kullanıcı onaylamadan hiçbir şey yazılmaz.
2. **Eşleşme T.C. ile** (rakam dışı karakterler atılır; 11 haneye ulaşmayan satır atlanır — toplam satırları böyle elenir).
3. Sütunlar **başlık adından** tanınır, sıra önemli değildir. Personel içe aktarmanın başlık sözlüğü kullanıcı tarafından düzenlenir (§5.1); diğer içe almalar programın kendi Excel çıktısının başlıklarını bekler (ayrıntı `04-ekranlar-ve-dosya-bicimleri.md`).
4. Çalışmada olmayan T.C. **atlanır** ve önizlemede listelenir (personel içe aktarmada isteğe bağlı eklenir).
5. Onaylı çalışmaya içe alma yapılamaz (`calismaYazIste`).

### 5.1 Personel içe aktarma — Excel / CSV ya da ERP / bordro listesi (`erpAktar`)
Kaynak: `js/db/api.js:erpAktar(id, satirlar, yeniEklensin, maasEsasi)`.
- Amaç: yeni yıl çalışmasına başlanırken ERP'deki ya da bordro programındaki güncel maaşlar (çalışmanın ücret esasında) bu çalışmanın **önceki yıl maaşı** (`maas_eski`) olur; önceki yılın gerçekleşen maliyeti de karşılaştırma için gelir. Liste Excel dosyasından ya da yapıştırılarak alınır; doğrudan veritabanı bağlantısı kurulursa yalnız satırların kaynağı değişir, önizleme ve uygulama aynı kalır.
- Satır alanları: `{ tc, ad, ise_giris, isten_ayrilis, bolum, ekip, gorev, maas, yaka, butce_bolumu, maliyet }` (`maas` = önceki yıl maaşı, çalışmanın esasında; `maliyet` = önceki yıl gerçekleşen maliyet). Yalnız **T.C. zorunludur**: başlık satırında T.C. sütunu bulunamazsa dosya okunmaz ("Başlık satırında T.C. sütunu bulunamadı.").
- Ekran koşulu: Personel İçe Aktarma ekranı `personel.yaz` ister; ayrıca `calismaYazilabilir(c)`. API: `calismaYazIste(id, 'personel.yaz')`. Dosya `.xlsx` ya da `.csv` olabilir; tablo yapıştırılarak da verilebilir. Excel dosyasında yalnız **ilk sayfa** okunur (`js/core/tablooku.js`).
- **Örnek şablon** (Personel İçe Aktarma ekranı, `sablonIndir`): ekrandaki "Örnek Excel şablonunu indir" düğmesi, seçili grup ve yıl için boş bir şablon üretir. İlk sayfa (`PERSONEL`) **yalnız başlık satırıdır**; örnek değerler ve açıklamalar ikinci sayfadadır. Okuyucu yalnız ilk sayfayı okuduğu için şablon olduğu gibi yüklenirse kimse eklenmez ve hiçbir şey değişmez. Şablonun başlıkları geçerli başlık sözlüğüyle tanınacak biçimde seçilir (bir başlık tanınmıyorsa sözlükteki ilk aday yazılır); böylece sözlük değiştirilmiş olsa da şablon doğrudan okunur. Biçim ayrıntısı `04-ekranlar-ve-dosya-bicimleri.md` belgesindedir.
- **Başlık sözlüğü** (alan → dosyada tanınacak sütun başlıkları):
  - Varsayılanlar `js/db/api.js:AKTARIM_ALANLARI`'dadır (alan, ekrandaki etiket, başlık listesi). Kurum kendi ERP'sinin ya da bordro programının sütun adlarını Tanımlar → İçe Aktarma Başlıkları sekmesinden alan başına değiştirir.
  - Okuma `aktarimSozluk()` → `{ sozluk, etiket, degisen, varsayilan }`; yazma `aktarimSozlukYaz({ alan: [başlıklar] | null })` — `parametre.yaz` ister; bilinmeyen alan reddedilir; boş liste ya da `null` o alanı varsayılana döndürür.
  - Saklama: `sistem_bilgi` tablosunda `aktarim.sozluk` anahtarı (JSON; yalnız varsayılandan farklı alanlar tutulur). Sözlük kurum geneldir; yıla ve gruba bağlı değildir. İşlem kaydı `KAYDET` (`sistem_bilgi`, `aktarim.sozluk`).
  - T.C. başlık listesi boş bırakılamaz (ekran engeller; API'de boş liste varsayılana döner).
- **Esas–sütun uyumu (ekran):** maaş sütunu çalışmanın ücret esasında olmalıdır. Brüt esaslı bütçede maaş sütunu yalnız başlığında "Brüt" geçiyorsa alınır (brüt adaylar sözlüğün başına eklenir; listede hem "Net Maaş" hem "Brüt Maaş" varsa brüt olan alınır); net esaslı bütçede başlığında "Brüt" geçen sütun alınmaz. Kurala uymayan sütunda uyarı verilir ve **maaşlar güncellenmez** (diğer alanlar yine alınır; satırların `maas` alanı boş gider). Şablonun maaş sütunu esasa göre adlandırılır (brüt esasta "Brüt Maaş"). Sözlükteki maaş alanının adı esastan bağımsız olarak "Maaş"tır.
- **Esas beyanı (API):** sütun başlığının denetimi ekrandadır, esasın denetimi API'dedir. Satırlardan birinde maaş varsa `maasEsasi` (`'NET'` / `'BRUT'`, dosyadaki maaşların esası) zorunludur ve çalışmanın esasıyla aynı olmalıdır; değilse işlem hiçbir şey yazmadan reddedilir ("Maaş tutarlarının esası (net / brüt) belirtilmeli." / "Maaşlar brüt, çalışma net esaslı; aktarılamaz." ya da tersi). Ekran, okuduğu sütunun esasını beyan eder. Maaşsız aktarım (yalnız kişi bilgileri) esas beyanı istemez. Doğrudan bir ERP bağlantısı da `erpAktar`'ı kullanırsa bu kural ona da uygulanır.
- **Eşleşme kuralı** (`js/core/tablooku.js:eslestir`): başlık satırı dosyanın ilk 15 satırında, zorunlu T.C. sütununu içeren ilk satır olarak aranır. Karşılaştırma büyük/küçük harf ve Türkçe karakter farkı gözetmeden yapılır (`U.normalize`: "Net Ücret" = "net ucret"). Önce birebir eşleşme aranır; tutmayan alan için, henüz kullanılmamış sütunlarda başlığın içinde geçen (en az 3 karakterlik) aday kabul edilir.
- **Önizleme** (ekran): güncellenecekler (alan alan eski → yeni), değişiklik olmayanlar, **çalışmada olmayanlar (yeni)**, **dosyada olmayanlar**. Yeniler için kişi başına işaret kutusu vardır; aynı yıl başka bir grupta kayıtlı olanlar yalnız "bu yıl başka bir grupta kayıtlı" bilgisiyle işaretlenir — **grup adı verilmez** (`tcBaskaGrupta` yalnız var/yok döndürür). "Tümünü seç" kutusu yenilerin hepsini işaretler ya da kaldırır, ama **bu yıl başka bir grupta kayıtlı olanları seçmez**: bir kişinin iki grupta birden maliyeti sayılmasın diye onlar yalnız tek tek, bilerek işaretlenebilir. Net maaş sütunu tanınmadıysa maaşlar güncellenmez.
- **Uygulama kuralları** (tek işlem; hata olursa hiçbiri yazılmaz):
  - Çalışmada olmayan ve `yeniEklensin[tc]` ile işaretlenmemiş T.C. tamamen atlanır (kişi kartı da güncellenmez).
  - **Boş gelen alana dokunulmaz.**
  - Kişi kartı varsa: dolu gelen `ad_soyad`, `ise_giris`, `isten_ayrilis`, `bolum`, `ekip`, `gorev` yazılır; `kaynak='ERP'`. Tarih geliyorsa önce `donemTarihleriniKoru` (diğer çalışmaların dönemi korunur).
  - Kişi kartı yoksa yeni kart açılır (`kaynak='ERP'`); dosyada ad yoksa hata: "<T.C.>: yeni personelin adı dosyada yok."
  - Bütçe bölümü: dosyada "08 PAZARLAMA" ya da "Pazarlama" gelebilir; numara atılıp **büyük/küçük harf duyarsız** olarak grubun bölümleriyle eşleşir; eşleşmezse boş kalır (var olan satırda değişmez).
  - Var olan satır: dolu gelen `maas_eski` (← `maas`), `maliyet_onceki` (← `maliyet`), `yaka` (yalnız `M`/`B`), `butce_bolumu` güncellenir.
  - Yeni satır: `sira` = en büyük + 1, `yaka` dosyadan ya da `B`, `maas_eski` dosyadan ya da 0, `maliyet_onceki` dosyadan, `hesap_turu='SSK'`, `kanun='YOK'`, `zam_ayi=1`.
- Sonuç `{ guncel, eklenen }` ("x güncellendi, y eklendi"; güncellenen sayısı dosyadaki bütün mevcut kişileri sayar, değişmeyenler dâhil); işlem kaydı `AKTAR`.

### 5.2 Excel Raporu (çıktı ve yönetim düzeltmelerinin geri yüklenmesi)
Ekran: Excel Raporu. Dosya biçimi `04-ekranlar-ve-dosya-bicimleri.md` belgesindedir.
- **Çıktı:** üç sayfa — `ÖZET` (yaka ve bütçe bölümü toplamları; önceki yıl ve bütçelenen maliyet `calisma_ozet`'ten), `ZAM ÇALIŞMASI` (kişi bazında; **DÜZELTME** sütunu yönetimin yazacağı yerdir; zam miktarı, yeni maaş ve oran formüldür), `AYLIK MALİYET` (kişi × ay). Kişi sırası §3.9. `T.C. KİMLİK NO` yalnız `alan.tc` yetkisiyle tam, aksi hâlde maskeli yazılır. İşlem kaydı `DISA_AKTAR`.
- **İçe alma:** yalnız `calismaYazilabilir(c)` + `zam.yaz` ile (modül ayrıca `excel.aktar` ister).
  - Dosyada `ZAM ÇALIŞMASI` sayfası olmalı; başlık satırında `T.C. KİMLİK NO` ve `DÜZELTME` zorunludur. Maskeli T.C.'ler eşleşmez; dosyanın bütün T.C.'leri maskeliyse içe alma açık bir mesajla reddedilir.
  - **Öncelik sırası** (kişi başına, formül değil **elle yazılmış** hücreye bakılarak):
    1. Elle yazılmış **ZAM ORANI** → yeni düzeltme = `round(oran × önceki maaş) − öngörü`
    2. Elle yazılmış **ZAM MİKTARI** → yeni düzeltme = `round(miktar) − öngörü`
    3. Aksi hâlde **DÜZELTME** hücresi (sayı değilse **0**).
  - Öngörü programın **güncel** hesabından alınır; dosyadaki "ÖNGÖRÜLEN ZAM" programdakinden 0,5'ten fazla farklıysa "parametreler değişmiş olabilir" uyarısı verilir.
  - Önizleme yalnız düzeltmesi değişenleri (fark > 0,004) ve çalışmada olmayan T.C.'leri gösterir.
  - Uygulama: değişen her kişi için `calismaPersonelAlanYaz(c.id, tc, 'duzeltme', yeni)` (`zam.yaz`; her biri ayrı `GUNCELLE` kaydı), hepsi `API.topluIslem` içinde **tek işlem**; ardından toplu `ICE_AKTAR` kaydı.
  - **Dikkat:** dönen dosyada DÜZELTME hücresi boşaltılmışsa düzeltme 0 okunur ve mevcut düzeltme silinir.

### 5.3 Performans değerlendirmesi
Kaynak: `js/db/api.js:performansModeliHam`, `performansModeli`, `calismaPerformansModeli`, `performansModeliYaz`, `performansGirdiHarita`, `performansGirdiYaz`, `performansGirdiSil`, `performansCarpanUygula`, `performansOncekiDonem`; `js/core/performans.js:hazirla`, `hesapla`.
- Her grupta kullanılabilir. Ekran `zam.oku` ile açılır; şablon çıktısı `excel.aktar`, giriş ve içe alma `calismaYazilabilir` + `zam.yaz`, modeli değiştirmek `parametre.yaz` ister (yetkisi olmayan modeli salt okunur görür).

**Değerlendirme modeli (veri, yıl bazında)**
- Model kod değil **veridir**: amirler (ad, ağırlık), yaka başına kriterler (kod, ad, ağırlık), değerlendirme ağırlığı, Excel sayfa adı ve ek puan kuralları. Performans Değerlendirme ekranındaki "Değerlendirme modeli…" penceresinden düzenlenir. Ham biçim: `{ amirler: [{alan: 'amirN', ad, agirlik}], yaka: { M|B: { ad, sayfa, degAgirlik, kriter: [{kod, ad, agirlik}], ek: [{alan, ad, tur, …, sinir?, not?, kalici?}] } } }`.
- Saklama: `parametre` tablosu, anahtar `perf.model` (JSON). Model **yıla bağlıdır ve o yılın bütün gruplarında ortaktır**; gruba özel model yoktur. Kayıt yoksa programla gelen örnek model geçerlidir (`PERF.VARSAYILAN()`; `performansModeliHam(yil).varsayilan`).
- **Yeni yıla geçiş:** `yilKopyala` ve öngörüdeki iç kopya (`yilKopyalaIc`) diğer parametrelerle birlikte `perf.model`'i hedef yılda yoksa taşır.
- **Onaylıda dondurma:** model `parametre` tablosunda olduğu için onayda diğer parametrelerle `calisma_parametre`'ye dondurulur. Onaylı çalışma her zaman onay anındaki modelle değerlendirilir (`calismaPerformansModeli`; onay anında o yıl için model kaydı yoksa örnek model). Yılın modeli sonradan değişirse yalnız o yılın taslak ve revize çalışmaları etkilenir.
- **Yazma** (`performansModeliYaz(yil, ham | null)`, `parametre.yaz`): model önce `PERF.hazirla` ile denetlenir; hatalıysa kaydedilmez ("Değerlendirme modeli: …"). `null` kaydı siler (örnek modele dönülür). İşlem kaydı `KAYDET` / `SIL` (`parametre`, "yıl/perf.model").
- **Model denetimleri** (`PERF.hazirla`): 1–5 amir; amir alanları `amir1`, `amir2` … biçiminde ve tekil, adları dolu, ağırlıkları eksi değil, en az birinin ağırlığı sıfırdan büyük; her yakada en az bir kriter; kriter ve ek puan kodları küçük harf, rakam ve `_` (harfle başlar, en çok 30 karakter) ve yaka içinde tekil; `grup` ve `amirN` ek puan kodu olamaz; kural türünün gerektirdiği sayılar girilmiş olmalı. Ağırlıklar oran olarak kullanılır, toplamın 100 olması gerekmez (ekran kriter toplamı 100'den farklıysa uyarır).
- **Ek puan kural türleri** (`PERF.TURLER`): `esik` (değer ≥ eşik → sabit puan; altında değer × katsayı), `kademe` ([[en az, puan] …]; değerin ulaştığı en yüksek kademenin puanı), `carpan` (değer × katsayı, en çok `enCok`), `liste` ([[seçenek, puan] …]; listede olmayan değer `bos` puanını alır). İsteğe bağlı bilgiler: `sinir` [en az, en çok] (girişte denetlenir), `not` (açıklamanın başına eklenir), `kalici` (yeni dönemin şablonuna önceki dönemden taşınır).
- **Kayıtlı alan adları** (`performans_girdi.alan`): `grup` (değerlendirme bölümü — bütçe grubu değildir), `amirN` (amir adı), `a<N>.<kriter kodu>` (N amirin kendi numarasıdır, listedeki sırası değil: `amir3` → `a3.`), ek puan kodları. Kriter ve ek puan kodu adından üretilir (`PERF.kodUret`) ve kaydedildikten sonra değişmez; girilmiş değerler koda bağlıdır.
- **Tanım kaldırılınca veri kalır:** model düzenlenirken çıkarılan kriterin, ek puan kuralının ya da amirin girilmiş değerleri `performans_girdi`'de durur ama artık hesaba ve şablona girmez (ekran kaydetmeden önce bunu onaylatır). Aynı kodla yeniden eklenen tanım eski değerlere yeniden kavuşur. Düzenleyici yeni amire en küçük boş `amirN` numarasını verir; kaldırılmış bir amirin numarası böylece yeniden kullanılırsa o amirin eski adı ve puanları geri gelir.
- Örnek veri, Üretim grubunun çarpanlarını yılın modeliyle hesaplar (`data/seed.js` → `API.performansModeli`).

**Değerlendirme girişi ve çarpan**
- **Şablon:** yaka başına bir sayfa (modeldeki `sayfa`); sütunlar ve açıklama sayfası modele göre üretilir; satırlar T.C. ile eşleşir. Henüz hiç değerlendirmesi olmayan kişilerde kalıcı bilgiler (`grup`, amir adları ve `kalici` işaretli ek puan girdileri) aynı grubun **önceki yılının** değerlendirmesinden ön doldurulur (onaylı çalışma öncelikli; `performansOncekiDonem`). T.C. yalnız `alan.tc` ile tam yazılır; maskeli T.C. içe alınamaz.
- **İçe alma (ekran):** kriter puanları 0–100, ek puan girdileri modeldeki `sinir` aralığında denetlenir. Liste türü değerler büyük harfe çevrilir; listede olmayan değer reddedilmez, uyarıyla gösterilir ve `bos` puanını alır.
- **Yazma** (`performansGirdiYaz(id, liste)`): alan **çalışmanın modeline** göre denetlenir (`calismaPerformansModeli(id).alanGecerli`); bilinmeyen alan ve çalışmada olmayan kişi reddedilir; boş değer o alanı siler; tek işlem.
- Puan ve çarpan saklanmaz, her açılışta `PERF.hesapla(kisiler, model)` ile hesaplanır. Çarpan zam hesabına **kendiliğinden geçmez**: "Çarpanları zam hesabına uygula" (`performansCarpanUygula`, `zam.yaz`) değerlendirilen kişilere hesaplanan çarpanı, değerlendirilmeyenlere boş (= 1) yazar ve çalışmada `zam_performans = 1` yapar (tek işlem). Model ya da girdiler sonradan değişirse zam hesabındaki çarpan yeniden uygulanana kadar eski değerinde kalır.
- Değerlendirme silme (`performansGirdiSil`, `zam.yaz`) o kişinin bu çalışmadaki bütün `performans_girdi` kayıtlarını siler.

### 5.4 Fazla mesai planı (Excel)
- Her grupta kullanılabilir. İçe alma `excel.aktar` + `calismaYazilabilir` + `aylik.yaz` ister; yazma `mesaiYaz` ile tek işlemdir (işlem kaydında "Excel: <dosya>").
- Dosyadaki tablo mevcut tablonun yerine geçer: dosyada olmayan mevcut hücreler boşaltılır ve önizlemede sayısı gösterilir. Bölüm adı kadroda (`personel.bolum`) eşleşmeyen satırların saatleri kimseye dağılmaz; önizleme bunları ayrıca listeler. Sayfa düzeni `04-ekranlar-ve-dosya-bicimleri.md` belgesindedir.

### 5.5 Özet ekranı rakamları
- `onceki_B/M`, `butce_B/M` hücreleri yalnız tek grup seçiliyken, `calismaYazilabilir` + `personel.yaz` ile yazılır (`calismaOzetYaz`). "Tümü" görünümünde gruplar toplanır, düzenleme kapalıdır.

---

## 6. Parametreler ve tanımlar

### 6.1 Yıl bazında parametreler
Kaynak: `js/db/api.js:PARAMETRE_TANIM`, `ZAM_TANIM`, `parametreOku`, `parametreYaz`, `hesapParametre`.
- Tablolar: `parametre (yil, anahtar, deger)`, `gv_dilim (yil, sira, ust_sinir, oran)` (son dilim `ust_sinir = NULL` = sınırsız), `asgari_ucret (yil, baslangic_ay, brut)` (başlangıç ayından itibaren geçerli), `sakatlik_derece (yil, derece, tutar)`, `performans_kademe (yil, alt_puan, ust_puan, carpan)`, `hesap_turu` (yıl bazında, §6.5).
- Değişiklik o yılın **bütün** taslak çalışmalarını (bütün gruplar) etkiler. Yazma yetkisi yalnız `parametre.yaz`; grup koşulu yoktur. Parametreler ekranındaki yıl **üst çubuktaki yılla aynıdır**.
- Genel parametreler (koddaki varsayılanlar; kayıt yoksa bunlar kullanılır):

| Anahtar | Ad | Birim | Varsayılan |
|---|---|---|---|
| `tavan_carpan` | SGK tavan çarpanı | × asgari ücret | 9 |
| `dv` | Damga vergisi oranı | oran | 0,00759 |
| `istisna_kesinti` | Asgari ücret GV matrahı kesintisi (SGK %14 + işsizlik %1) | oran | 0,15 |
| `bes_orani` | BES kesinti oranı | oran | 0,03 |
| `t05510` | 05510 indirimi — varsayılan (çalışmaya özel oran Çalışma Ayarları'nda) | oran | 0,02 |
| `t05746` | 05746 AR-GE SGK teşvik oranı (işveren %19,75 × ½) | oran | 0,09875 |
| `t14857` | 14857 engelli teşvik oranı | oran | 0,1975 |
| `t15510` | 15510 teşvik oranı | oran | 0,05 |
| `arge_gv_esik` | AR-GE günü varsayılanının uygulandığı en düşük GV teşvik oranı (§4.4) | oran | 0,8 |
| `mesai_fm1_kat` | Hafta içi fazla mesai katsayısı | × saat ücreti | 1,5 |
| `mesai_fm2_kat` | Hafta sonu / tatil mesaisi katsayısı | × saat ücreti | 2 |
| `mesai_gun_saat` | Saat ücretinde günlük çalışma saati (saat ücreti = maaş / 30 / bu saat; maaş çalışmanın esasında) | saat | 7,5 |
| `zam_yuvarla` | Zam öngörüsü yuvarlama adımı (çalışmaya özel adım `zam.yuvarla_ongoru` önceliklidir, §1.7) | TL | 10 |

- Bu anahtarlar Parametreler ekranının genel parametre tablosunda (`PARAMETRE_TANIM`'dan çizilir) yıl bazında düzenlenir. `hesapParametre` bunları motora `P.argeEsik`, `P.mesaiKat1`, `P.mesaiKat2`, `P.gunlukSaat`, `P.zamYuvarla` olarak verir; mesai tutarı = maaş (çalışmanın esasında) / 30 / günlük saat × (FM1 katsayısı × FM1 saati + FM2 katsayısı × FM2 saati) (`js/core/hesap.js:ayHesapla`, `AV`). Onaylı çalışmada değerler dondurulmuş parametrelerden gelir; yeni yıla `yilKopyalaIc` ile geçer.

- Zam kademesi yaka başına `zam.<M|B>.<anahtar>` (`ZAM_TANIM`; varsayılanlar yalnız başlangıç değeridir):

| Anahtar | Ekrandaki ad | Varsayılan |
|---|---|---|
| `alt_esik` | Alt eşik | 50.000 |
| `ust_esik` | Üst eşik | 100.000 |
| `ust_oran` | **Alt eşiğin altındaki** oran | 0,30 |
| `alt_oran` | **Üst eşiğin üstündeki** oran | 0,25 |

  Eşikler çalışmanın ücret esasındaki maaşa uygulanır: net esaslı çalışmada net, brüt esaslı çalışmada brüt maaşla karşılaştırılır. Yıl parametresi iki esasta ortak olduğundan, brüt esaslı gruplar için eşikler çalışmaya özel kademede (`calisma_ayar` `zam.*`, §1.7) brüt tutarla girilmelidir.

  **Tuzak:** `ust_oran` "yüksek oran" (düşük maaşa uygulanan), `alt_oran` "düşük oran" demektir; adları eşiklerle ters okunabilir. Kural: önceki yıl net maaşı alt eşiğin altındaysa `ust_oran`, üst eşiğin üstündeyse `alt_oran`, arada doğrusal azalır; `zam_kademe` kapalıysa `ust_oran` sabit; `zam_performans` açıksa oran kişinin çarpanıyla çarpılır; öngörü yuvarlanır (çalışma ayarı `zam.yuvarla_ongoru` → yılın `zam_yuvarla` parametresi → 10), `duzeltme` öngörüye eklenir. Yılın değeri geneldir; çalışmaya özel değer `calisma_ayar` `zam.*`'dadır. Kaynak: `js/core/hesap.js:zamHesapla`, `js/db/api.js:calismaZamKademe`.
- Doğrulamalar: GV dilim oranı 0 ≤ oran < 1; son dilim hariç üst sınırlar artan olmalı (`dilimYaz`). Asgari ücrette **Ocak'tan geçerli** bir kayıt zorunludur (`asgariYaz`). Dilim, asgari ücret, sakatlık ve performans kademesi listeleri yıl için **tamamen silinip yeniden** yazılır (tek işlem).
- Sayılar ekranda Türkçe biçimle girilir; oranlar ekranda yüzde, saklanırken oran.
- Asgari ücret, SGK tavanı, asgari ücret GV/DV istisnası ve ayın gün sayısı asgari ücret ve tarifeden **türetilir**, elle tutulmaz (`js/core/hesap.js:parametreHazirla`).
- `yilKopyala(kaynak, hedef)` (`parametre.yaz`): altı tabloyu (`parametre, gv_dilim, asgari_ucret, hesap_turu, sakatlik_derece, performans_kademe`) hedefte **olmayan** satırlar için kopyalar (`INSERT OR IGNORE`); `parametre` tablosundaki performans modeli (`perf.model`) de bununla geçer. Aynı iç kopya öngörü içinde de kullanılır.

### 6.2 Yeni yıl öngörüsü
Kaynak: `js/db/api.js:ongoruHesapla`, `ongoruUygula`, `parametreDurumu`.
- Amaç: bütçe Kasım–Aralık'ta hazırlanır, yeni yılın resmî rakamları henüz açıklanmamıştır. Bir artış oranı (piyasa beklentisi) önceki yılın yasal değerlerine uygulanır.
- Ekran yalnız `parametre.yaz` ile görünür. Üst çubukta seçili yıl **hedef**, bir önceki yıl **kaynaktır**; seçili yılın bir öncesi yoksa seçili yıl kaynak, bir sonraki yıl hedef olur.
- Girdiler: `{ kaynakYil, hedefYil, oran, oranAsgari?, oranDilim?, oranSakatlik?, araAy?, araOran?, dilimAdim, sakatlikAdim }` — kalem bazında ayrı oran boşsa genel oran kullanılır.
- **Hesap** (`ongoruHesapla`):
  - **Asgari ücret:** kaynak yılın **son dönemi** esas alınır; Ocak = son dönem brütü × (1 + asgari oranı), kuruşa yuvarlanır. Ara artış oranı girilmiş ve ay > 1 ise o aydan itibaren ikinci dönem = Ocak × (1 + ara oran).
  - **SGK tavanı:** asgari ücretten türer (önizlemede bilgi satırı).
  - **GV dilimleri:** her üst sınır × (1 + dilim oranı), dilim adımına yuvarlanır; oranlar aynı kalır; sınırsız dilim sınırsız kalır.
  - **Sakatlık:** her derece tutarı × (1 + sakatlık oranı), sakatlık adımına yuvarlanır.
  - **Boş kaynakta hata:** kaynak yılın asgari ücreti, GV dilimleri ya da sakatlık tutarları yoksa işlem durdurulur ("… kaynak yılı kontrol edin"). Bu denetim olmasa hedef yılın tabloları silinip boş kalırdı.
- **Uygulama** (`ongoruUygula`) koşulları: `parametre.yaz`; hedef > kaynak; **hedef yılında onaylı bir çalışma varsa** (herhangi bir grupta, görünürlükten bağımsız — `yilOnayliMi`) reddedilir; genel oran −1 ile 5 arasında.
- Uygulama tek işlemde: yasal olmayan parametreler (oranlar, mesai katsayıları, hesaplama türleri, zam kademesi, performans kademesi ve değerlendirme modeli…) hedefte **yoksa** kaynaktan kopyalanır (`yilKopyalaIc`, var olanlara dokunulmaz); hedefin asgari ücreti, dilimleri ve sakatlık tutarları silinip öngörüyle yazılır; `parametre`'ye `durum = 'ONGORU'` ve `ongoru.kaynak_yil`, `ongoru.oran`, `ongoru.oran_asgari`, `ongoru.oran_dilim`, `ongoru.oran_sakatlik`, `ongoru.ara_ay`, `ongoru.ara_oran`, `ongoru.dilim_adim`, `ongoru.sakatlik_adim`, `ongoru.tarih` yazılır. İşlem kaydı `ONGORU`.

### 6.3 "Resmî rakamlar girildi" durumu
- `parametreDurumu(yil)`: `var` = yılın asgari ücret kaydı var mı; `ongoru` = `parametre.durum === 'ONGORU'`.
- Gösterim: kayıt yoksa "girilmemiş"; `ONGORU` ise "Öngörü %x" ve uyarı bandı; aksi hâlde "Resmî" (durum anahtarı hiç yoksa da **Resmî** görünür). Başlangıç verisindeki yıl `durum: 'RESMI'` ile gelir.
- "Resmî rakamlar girildi" işareti (`parametreDurumYaz(yil, 'RESMI')`, `parametre.yaz`) kullanıcı asgari ücret, dilim ve sakatlık tutarlarını resmî rakamlarla düzelttikten sonra konur. Bu yalnız bir işarettir; değerleri değiştirmez.

### 6.4 Onaylı yılın kilidi
- Onaylı çalışmalar dondurulmuş parametrelerle hesaplandığı için yılın parametreleri **elle** değiştirilebilir; değişiklik yalnız taslak ve revize çalışmaları etkiler. Parametreler ekranı yılın onaylı çalışmalarını listeleyen bir bilgi bandı gösterir (`js/db/api.js:yilOnayliCalismalar`); resmî rakamlarla yeni hesap için Revize açılır (§2.6).
- **Öngörü** ise onaylı çalışması olan yılın asgari ücret, dilim ve sakatlık değerlerini **ezemez** (`ongoruUygula` reddi; onaylı maliyet değişmesin).
- Çalışma listesi, parametresi dondurulmuş çalışmayı ayrıca işaretler (`calismaParametreDondurulmusMu`).

### 6.5 Hesaplama türü (`hesap_turu`)
- **Yıl bazında**: `PRIMARY KEY (yil, kod)`. Alanlar: `kod` (büyük harfe çevrilir), `ad`, `kol` (`SSK` tüm sigorta kolları / `SGDP` emekli / `YOK` SGK'sız — huzur hakkı, danışman: yalnız GV ve DV), `sgk_isci`, `issizlik_isci`, `sgk_isveren`, `issizlik_isveren`, `gv`, `dv`, `istisna` (asgari ücret istisnası), `sira`, `aciklama`. Kaynak: `js/db/api.js:hesapTuruKaydet`, `hesapTuruSil`.
- Başlangıç türleri (2026): `SSK` (4/a), `EMK` (emekli, SGDP), `SGKSIZ` (huzur hakkı / danışman). Kaynak: `data/seed.js:SEED_YUKLE`.
- Kayıt `INSERT OR REPLACE` (kod ve ad zorunlu).
- Silme: o yılın çalışmalarında `calisma_personel.hesap_turu` olarak **ya da** o yılın aylık girdilerinde (`alan = 'hesap_turu'`, yıl içi değişiklik) kullanılıyorsa reddedilir; mesaj kaç kişide kullanıldığını söyler.
- Öngörüde hedef yılda yoksa kaynaktan kopyalanır.

### 6.6 Kanun (teşvik) türü (`kanun_turu`)
- **Yıldan bağımsız** (tek liste). Alanlar: `kod`, `ad` (serbest), `kural` (motorun tanıdığı kural: `YOK`, `05510`, `05746`, `14857`, `15510`), `oran` (yalnız kuralı `05510` olan türde; boş = yılın `t05510` parametresi), `aciklama`, `sira`. **Hesabı ad değil kural belirler.**
- Başlangıç türleri: `YOK` (TABİ DEĞİL), `05510` (%2, imalat dışı), `05510-5` (%5, imalat), `05746` (AR-GE: işveren payının ½'si + 05510 indirimi), `14857` (engelli), `15510` (emekli %5). Kaynak: `js/db/schema.js:TEMEL_VERI_YAZ`. Bu türler **yalnız `kanun_turu` tablosu boşsa** yazılır: kullanıcının sildiği ya da değiştirdiği tür sürüm yükseltmesinde geri gelmez.
- Tür adı, açıklaması, sırası ve (05510 kuralında) oranı ekrandan düzenlenir; `kural` yalnız motorun tanıdığı listeden seçilir (kuralların formülleri koddadır, §11).
- Silme: `calisma_personel.kanun` **ya da** `aylik_girdi` (alan `kanun`) içinde herhangi bir yılda kullanılıyorsa reddedilir.
- Onaylı çalışmalar dondurulmuş kanun listesini kullanır.

### 6.7 Bütçe bölümü tanımı
Kaynak: `js/db/api.js:butceBolumuKaydet`, `butceBolumuSil`, `butceBolumuBirlestir`, `bolumKisiSayilari`.
- Yetki: `parametre.yaz` **ve** ilgili grupta yazma (`grupYazabilir`). Var olan bölümde grup kayıttan alınır.
- Kayıt kuralları: ad `BOLUM_TEMIZLE` ile numarasız; ad boş olamaz; sıra ≥ 1; aynı grupta **aynı sıra** iki bölüme verilemez ("08 numarası … bölümünde kullanılıyor"); aynı grupta **aynı ad** olamaz ("Birleştir"i kullanın").
- **Ad değişince** o grubun **bütün yıllarındaki** bütçe satırlarında (`calisma_personel.butce_bolumu`) ad güncellenir — onaylı çalışmalar dâhil (yalnız etiket).
- **Silme:** grubun herhangi bir yılında bu bölümde satır varsa reddedilir ("önce onları başka bölüme alın").
- **Birleştirme:** aynı gruptaki iki farklı bölüm; kaynak bölümdeki bütün satırlar (bütün yıllar) hedef bölüme taşınır, kaynak silinir; taşınan satır sayısı döner (`BIRLESTIR`).
- Bölüm başına kişi sayısı seçili yılın çalışmalarından sayılır ve yalnız grubu görebilene verilir (`bolumKisiSayilari`).

### 6.8 Diğer tanımlar
- **Sakatlık derecesi** 1–3; tutarlar yıl bazındadır (aylık); hesapta dereceden o yılın tablosu okunur, öngörüyle artar.
- **Performans kademesi** (yıl bazında): puan aralığı → çarpan. Kişinin çarpanı: elle girilmiş `performans_carpani`, yoksa `performans_puani`'nın düştüğü kademe, o da yoksa 1 (`js/db/api.js:performansCarpani`).
- **Maaş dağılımı aralıkları** (`grup.maas_araliklari`): `maasAralikYaz` — `parametre.yaz` **ve** grupta yazma; en fazla 20 sınır; boş = otomatik. Otomatik öneri (`aralikOner`): grubun maaşlarının 10.–90. yüzdelik aralığı yaklaşık 8 aralığa bölünür, adım "yuvarlak" sayıdır (1, 2, 5, 10, 20, 50, 100 bin), en fazla 14 sınır. Sınırlar **alt sınırdır**.

### 6.9 Başlangıç verisi ve örnek veri
Kaynak: `js/db/api.js:seedYukle`, `ornekVeriYukle`, `varsayilanGrupAc`; `data/seed.js:SEED_YUKLE`, `ORNEK_VERI_YUKLE`; `js/db/schema.js:TEMEL_VERI_YAZ`.
- **Başlangıç verisi** (`seedYukle`, veritabanı ilk oluşturulurken): kanun türleri (`TEMEL_VERI_YAZ`) ve başlangıç yılının (2026) yasal parametreleri (`SEED_YUKLE`: genel oranlar, örnek zam kademesi, GV dilimleri, asgari ücret, sakatlık tutarları, hesaplama türleri; `durum = 'RESMI'`). **Grup ve personel yoktur.** Yasal rakamlar her yıl resmî kaynaktan kontrol edilmelidir. Bütün eklemeler `INSERT OR IGNORE`'dur; var olan kayıt ezilmez. `TEMEL_VERI_YAZ` şema sürümü yükseltilirken de çalışır (`js/db/engine.js:surumKontrol`), ama kanun türlerini yalnız tablo boşsa yazar (§6.6). Performans modeli ve içe aktarma başlık sözlüğü başlangıçta kaydedilmez: kayıt yokken koddaki varsayılanlar geçerlidir (§5.1, §5.3).
- **Boş başlangıç** (`varsayilanGrupAc`, `sistem.yonet`): hiç grup yoksa tek bir `GENEL` / "Genel" grubu açar (`grupKaydet` üzerinden; işlem kaydı `EKLE`). Grup varsa bir şey yapmaz.
- **Örnek veri** (`ornekVeriYukle`, yalnız `sistem.yonet`): ilk kurulumda "Örnek veriyle başla" seçilince ya da Sistem ekranındaki "Örnek veriyi yükle" ile çalışır. `data/ornek-veri.js` yüklenmemişse hata verir. Kurduğu veri:
  - Ofis ve Üretim grupları ve bölümleri (grubun hiç bölümü yoksa), uydurma personel (`kaynak='ORNEK'`), grupların çalışma ayarları.
  - Başlangıç yılı için grup başına "<yıl> Bütçe" çalışması: bütçe satırları, aylık girdiler, Üretim'de performans girdileri (çarpanlar yılın değerlendirme modeliyle hesaplanıp uygulanır) ve mesai tablosu; özet rakamları hesaplanan maliyetten türetilir; çalışmalar **onaylanır** (tarihler ve parametreler dondurulur).
  - Sonraki yıl için programın kendi işlevleri kullanılır: Yeni Yıl Öngörüsü (`ongoruUygula`, yalnız o yılın asgari ücreti yoksa) ve grup başına `YENI_YIL` taslak çalışması, fazla mesai planının kopyası (`mesaiKopyala`) ve önceki yıl AR-GE günü olan kişilere Ocak AR-GE günü (`aylikGirdiToplu`). Bu adımlar oturum açmış yöneticinin yetkisiyle çalışır.
  - Yeniden çalıştırılabilir: var olan grup, bölüm, kişi ve aynı ada sahip çalışma atlanır. İşlem kaydı `ORNEK`.
  - Örnek veri gerçek veriyle aynı veritabanına yüklenirse onun yanına eklenir. İlk kurulum ekranı, örnek veriden gerçek kullanıma geçerken veri dosyasının silinip programın yeniden başlatılmasını önerir (`js/app.js:ilkKurulumEkrani`).

---

## 7. Yetki modeli

### 7.1 Kullanıcı
Kaynak: `js/db/api.js` (KULLANICI / YETKİ bölümü), `js/app.js:ilkKurulumEkrani`, `girisEkrani`.
- **Rol yoktur.** Sistem yöneticisi her kullanıcıya yetkileri ve grup erişimini **tek tek** atar.
- Tablolar: `kullanici (kullanici_adi, ad_soyad, parola_hash, tuz, yonetici, aktif, son_giris, olusturma)`, `kullanici_yetki (kullanici_adi, yetki_kod)`, `kullanici_grup (kullanici_adi, grup_kod, yazma)`.
- Kullanıcı adı küçük harfe çevrilir; en az 3 karakter, yalnız `a-z 0-9 . _ -`. Parola en az 6 karakter; `sha256(tuz | parola)` `PAROLA_DONGU` kez (kodda 60000) yinelenir ve `sha256i$<döngü>$<özet>` biçiminde saklanır. Parola görüntülenemez, yalnız doğrulanır.
- Giriş (`girisYap`): kullanıcı yoksa ya da parola yanlışsa aynı mesaj ("Kullanıcı adı veya parola hatalı."); devre dışı hesap reddedilir ("Bu kullanıcı devre dışı bırakılmış."). Girişte yetki ve grup listesi oturum nesnesine yüklenir. Hesabın ilk girişinde (`son_giris` boş; ilk kurulumdaki yönetici dâhil) başlangıç gezisi açılır; gezi yalnız kullanıcının görebildiği ekranların adımlarını gösterir ve hiçbir şey yazmaz.
- **Yetki değişikliği açık oturuma yansır:** her ekran geçişinde `oturumTazele()` kullanıcının yönetici ve etkin bilgisini, yetkilerini ve grup erişimini yeniden okur; değişiklik varsa hesap önbelleği temizlenir. Silinen ya da devre dışı bırakılan kullanıcının oturumu kapanır (`js/app.js:git`).
- İlk kurulumda (hiç kullanıcı yoksa) giriş ekranı yerine **yönetici hesabı** oluşturma ekranı çıkar (§12).
- Sistemde **en az bir etkin yönetici** kalmalıdır: son yöneticinin yöneticiliği kaldırılamaz, devre dışı bırakılamaz, silinemez (`digerYoneticiYok`).
- Parola değiştirme: başkasının parolasını yalnız sistem yöneticisi değiştirir; kişi kendi parolasını değiştirebilir (API'de yalnız yazma kilidi istenir). Ekranda parola yalnız Kullanıcılar ekranından değiştirilir (§13).
- Hareketsizlikte otomatik kapanma: varsayılan **5 dk**, 0–240 (0 = kapalı), yalnız yönetici değiştirir (`oturumZamanAsimiYaz`, `sistem.yonet`). Süre dolmadan 30 sn önce uyarı perdesi çıkar; uyarı açıkken fare hareketi süreyi sıfırlamaz, "Devam et"e basılmalıdır. Süre dolunca bekleyen kayıt yazılır, kilit bırakılır ve sayfa **yeniden yüklenir** (yalnız çıkış değil): veri parolasının anahtarı bellekten silinir. Kaynak: `js/app.js` (hareketsizlik bölümü).

### 7.2 Sistem yöneticisi
- `kullanici.yonetici = 1`: bütün yetkiler (`yetkiVar` her kod için doğru), bütün gruplarda görme + yazma, bütün okuma kapılarından geçiş. Yetki atama ekranında yönetici işaretliyken grup ve yetki alanları anlamsızdır.

### 7.3 Grup erişimi
- Her grup için üç düzey:

| Düzey | `kullanici_grup` kaydı | Anlamı |
|---|---|---|
| Göremez | kayıt yok | Grup hiçbir ekranda görünmez; API okuma da reddeder |
| Görür | `yazma = 0` | Okur, Excel alabilir; yazamaz |
| Görür ve düzenler | `yazma = 1` | Yazabilir — **ilgili işlem yetkisi de ayrıca işaretli olmalı** (ör. `personel.yaz`) |

- Okuma denetimi API'dedir: `calismaOkuIste(id)` — kullanıcının göremediği grubun verisi ekran atlatılsa bile okunamaz ("Bu grubun verisini görme yetkiniz yok."). Kullanan işlevler: `calismaHesapla`, `calismaPersonelListe`, `calismaPersonelGetir`, `aylikGirdiHarita`, `performansGirdiHarita`, `mesaiOku`, `calismaOzetOku`, `calismaAyarOku`, kopyalamada ve mesai kopyasında kaynak. `calismaListe`, `personelGecmis`, `gorunurGruplar` görünür gruplara süzülür; `bolumKisiSayilari` görmeyene boş döner; `tcBaskaGrupta` yalnız var/yok döndürür.
- Yazma denetimi: `calismaYazIste(id, yetki)` sırasıyla (1) grupta yazma, (2) çalışma onaylı değil, (3) `yetkiIste(yetki)`.
- Kullanıcıya hiç grup atanmamışsa üst çubukta "Size atanmış grup yok — yöneticinize başvurun", çalışma gerektiren ekranlarda bilgi notu çıkar; hiç grup tanımlanmamışsa yöneticiye Tanımlar → Gruplar'dan grup eklemesi söylenir.

### 7.4 Yetki anahtarları (`window.YETKILER`, `js/db/schema.js`)
`yetkiIste(kod)`: yetki yoksa "Bu işlem için yetkiniz yok."; kod `.yaz` ya da `.yonet` ile bitiyorsa **yazma kilidi** de denetlenir (§8). `yetkiVar(kod)`: yönetici ya da listede. Okuma kapıları (`OKU_HESAP`, `OKU_PERSONEL`, `OKU_PERFORMANS`) §10.3'tedir.

| Anahtar | Tanım (koddaki) | Açtığı |
|---|---|---|
| `ozet.oku` | Özet ve maliyet tablolarını görür | Menü: Özet, Maliyet Tablosu, Maaş Dağılımı; okuma kapısı `OKU_HESAP` |
| `personel.oku` | Bütçe personel listesini görür | Menü: Bütçe Çalışmaları, Personel ve Zam, Aylık Girdiler, Fazla Mesai Planı; okuma kapıları `OKU_HESAP`, `OKU_PERSONEL`, `OKU_PERFORMANS` |
| `personel.yaz` | Bütçeye personel ekler / düzenler | Çalışma açma, ad/bayrak, onaylama/taslağa alma, revize, silme; çalışma ayarları ve özet rakamları; kişi ekleme/düzenleme/çıkarma/taşıma; kişi hesap bilgilerinin aylık girişi; Personel İçe Aktarma (menü dâhil); Maaş Dağılımı listesine ekle/çıkar; okuma kapıları |
| `zam.oku` | Zam çalışmasını görür | Personel ve Zam'da zam sekmesi; menü: Performans Değerlendirme; okuma kapıları |
| `zam.yaz` | Zam düzeltmesi girer | `duzeltme`, `performans_puani`, `performans_carpani`; Excel Raporu içe alma; performans girişi, içe alma, silme ve çarpan uygulama; okuma kapıları |
| `aylik.yaz` | Aylık girdileri (ayni yardım, prim, mesai…) düzenler | Ayni, prim, yakıt, çalışılan gün, hafta içi / hafta sonu mesai (`fm1` / `fm2`), AR-GE günü; toplu giriş; fazla mesai planı yazma, kopyalama, açma/kapatma, Excel'den alma; okuma kapıları `OKU_HESAP`, `OKU_PERSONEL` |
| `alan.tc` | T.C. Kimlik No'yu tam görür | T.C.'nin ekranda ve Excel çıktılarında tam gösterimi (aksi hâlde ilk 3 + `*****` + son 3) |
| `parametre.oku` | Parametre ve tanımları görür | Menü: Parametreler, Tanımlar (İçe Aktarma Başlıkları sekmesi dâhil) |
| `parametre.yaz` | Parametre ve tanımları değiştirir | Bütün parametre yazmaları; yeni yıl öngörüsü; resmî işareti; yıl kopyalama; hesaplama ve kanun türleri; bütçe bölümleri ve maaş dağılımı aralıkları (+ grup yazma); **performans değerlendirme modeli**; **içe aktarma başlık sözlüğü** |
| `excel.aktar` | Excel çıktısı alır / Excel'den içeri aktarır | Menü: Excel Raporu; bütün Excel çıktıları; performans ve mesai içe alma düğmeleri; okuma kapıları `OKU_HESAP`, `OKU_PERSONEL` |
| `sistem.yonet` | Kullanıcı, yetki, yedek ve sistem ayarları | Menü: Kullanıcılar, Sistem; kullanıcı ekleme/güncelleme/silme, başkasının parolası; yetki ve grup erişimi atama; **grup tanımı** (ekle, düzenle, sil); **örnek veri yükleme** ve varsayılan grup; hareketsizlik süresi; veri şifrelemesi kur/değiştir/kaldır; sıfırlama; oturum açıkken yedekten geri yükleme; işlem kaydı ve kullanıcı listelerini okuma; okuma kapıları `OKU_HESAP`, `OKU_PERSONEL` |

### 7.5 İşlem → gereken yetki tablosu
`G` = grupta yazma erişimi (`grupYazabilir`), `T` = çalışma taslak olmalı, `K` = yazma kilidi sizde olmalı (`.yaz`/`.yonet` yetkisi `yetkiIste` ile istendiğinde). İşlev sütunu `js/db/api.js`'tedir, aksi belirtilmedikçe.

| İşlem | API işlevi | G | T | Yetki | K | Not |
|---|---|:-:|:-:|---|:-:|---|
| Grup ekle / düzenle | `grupKaydet` | — | — | `sistem.yonet` | ✓ | Kod sonradan değişmez |
| Grup sil | `grupSil` | — | — | `sistem.yonet` | ✓ | Çalışması olan grup silinmez |
| Örnek veriyi yükle | `ornekVeriYukle` | — | — | `sistem.yonet` | ✓ | Var olan kayıtlar atlanır |
| Varsayılan grup | `varsayilanGrupAc` | — | — | `sistem.yonet` | ✓ | Yalnız hiç grup yokken |
| Çalışma aç | `calismaKaydet` (yeni) | ✓ | — | `personel.yaz` | ✓ | |
| Çalışma adı / bayrak / açıklama | `calismaKaydet` (id) | ✓ | — | `personel.yaz` | ✓ | Onaylı kalan çalışmada yalnız açıklama |
| Onayla / taslağa al | `calismaKaydet` | ✓ | — | `personel.yaz` | ✓ | Ayrı onay yetkisi yok |
| Revize aç | `calismaRevizeAc` | ✓ | — | `personel.yaz` | ✓ | Kaynak onaylı olabilir; tek işlem |
| Çalışma sil | `calismaSil` | ✓ | ✓ | `personel.yaz` | ✓ | |
| Çalışma ayarları | `calismaAyarYaz` | ✓ | ✓ | `personel.yaz` | ✓ | Her anahtar |
| Ücret esasını değiştir | `calismaAyarYaz({'ucret.esas': …})` | ✓ | ✓ | `personel.yaz` | ✓ | Yalnız bütçe satırı ve aylık girdi kaydı olmayan çalışmada |
| Özet rakamı | `calismaOzetYaz` | ✓ | ✓ | `personel.yaz` | ✓ | |
| Personel kopyala (`YENI_YIL`/`KOPYA`) | `calismaPersonelKopyala` | ✓ (hedef) | ✓ (hedef) | `personel.yaz` | ✓ | Kaynak için grup görme; aynı grup |
| Personel ekle / düzenle | `calismaPersonelKaydet` | ✓ | ✓ | `personel.yaz` | ✓ | Taşımalı kayıtta iki çalışma için |
| Bir alan (genel) | `calismaPersonelAlanYaz` | ✓ | ✓ | `personel.yaz` | ✓ | `maas_eski` dâhil |
| Düzeltme / performans puanı / çarpanı | `calismaPersonelAlanYaz` | ✓ | ✓ | `zam.yaz` | ✓ | |
| Bütçeden çıkar | `calismaPersonelSil` | ✓ | ✓ | `personel.yaz` | ✓ | |
| Grup taşıma | `calismaPersonelTasi` | ✓ (iki taraf) | ✓ (iki taraf) | `personel.yaz` | ✓ | Aynı yıl, aynı ücret esası |
| Personel içe aktarma | `erpAktar` | ✓ | ✓ | `personel.yaz` | ✓ | Tek işlem; maaş varsa `maasEsasi` çalışmanın esasına eşit olmalı |
| Aylık girdi — kişi hesap bilgisi | `aylikGirdiYaz` | ✓ | ✓ | `personel.yaz` | ✓ | hesap_turu, kanun, sakatlık, özürlü, BES, GV teşvik, yol |
| Aylık girdi — tutar/mesai/gün | `aylikGirdiYaz` | ✓ | ✓ | `aylik.yaz` | ✓ | ayni, prim, yakıt, çalışılan gün, fm1, fm2, arge_gun |
| Toplu aylık giriş | `aylikGirdiToplu` | ✓ | ✓ | Alana göre `personel.yaz` / `aylik.yaz` | ✓ | Tek girişle aynı ayrım |
| Fazla mesai planı / kopya / aç-kapat | `mesaiYaz`, `mesaiKopyala`, `mesaiAktifYaz` | ✓ | ✓ | `aylik.yaz` | ✓ | Kopyada kaynak için grup görme |
| Performans girdisi / sil / çarpan uygula | `performansGirdiYaz`, `performansGirdiSil`, `performansCarpanUygula` | ✓ | ✓ | `zam.yaz` | ✓ | |
| Excel Raporu'ndan düzeltmeleri geri yükleme | (ekran) `topluIslem` + `calismaPersonelAlanYaz('duzeltme')` | ✓ | ✓ | `zam.yaz` (+ ekran `excel.aktar`) | ✓ | Tek işlem |
| Excel çıktısı (her tür) | (ekran) | — | — | `excel.aktar` | — | Görüntüleme kipinde de alınabilir |
| Parametre / dilim / asgari / sakatlık / performans kademesi | `parametreYaz`, `dilimYaz`, `asgariYaz`, `sakatlikYaz`, `performansYaz` | — | — | `parametre.yaz` | ✓ | Grup koşulu yok |
| Yıl kopyala / öngörü / resmî işareti | `yilKopyala`, `ongoruUygula`, `parametreDurumYaz` | — | — | `parametre.yaz` | ✓ | Öngörü: hedef yılda onaylı çalışma olmamalı |
| Hesaplama türü / kanun türü kaydet-sil | `hesapTuruKaydet/Sil`, `kanunKaydet/Sil` | — | — | `parametre.yaz` | ✓ | Kullanımdaysa silinmez |
| Bütçe bölümü kaydet / sil / birleştir | `butceBolumuKaydet/Sil/Birlestir` | ✓ | — | `parametre.yaz` | ✓ | |
| Maaş dağılımı aralıkları | `maasAralikYaz` | ✓ | — | `parametre.yaz` | ✓ | |
| Performans değerlendirme modeli | `performansModeliYaz` | — | — | `parametre.yaz` | ✓ | Yıl bazında, bütün gruplar için; hatalı model kaydedilmez; `null` = örnek modele dön |
| İçe aktarma başlık sözlüğü | `aktarimSozlukYaz` | — | — | `parametre.yaz` | ✓ | Kurum geneli; boş liste = varsayılan |
| Yetki ve grup erişimi atama | `kullaniciErisimYaz` | — | — | `sistem.yonet` | ✓ | |
| Kullanıcı ekle / güncelle / sil | `kullaniciEkle`, `kullaniciGuncelle`, `kullaniciSil` | — | — | `sistem.yonet` | ✓ | Hiç kullanıcı yokken ilk hesap yetkisiz açılır |
| Parola değiştir | `parolaDegistir` | — | — | Başkasınınki `sistem.yonet`; kendi parolası yetkisiz | ✓ | |
| Hareketsizlik süresi | `oturumZamanAsimiYaz` | — | — | `sistem.yonet` | ✓ | 0–240 dk |
| Şifreleme kur / değiştir / kaldır | `js/db/engine.js:sifrelemeyiKur`, `sifrelemeyiKaldir` | — | — | `sistem.yonet` | ✓ | |
| Veritabanını sıfırla | `js/db/engine.js:sifirla` | — | — | `sistem.yonet` | ✓ | Önce otomatik yedek; alınamazsa yapılmaz |
| Yedekten geri yükle | `js/db/engine.js:yedektenYukle` | — | — | Oturum açıkken `sistem.yonet`; giriş ekranından §10.10 | ✓ | Önce otomatik yedek |
| İşlem kaydı ve kullanıcı listeleri | `logListe`, `kullaniciListe`, `kullaniciYetkileri`, `kullaniciGruplari` | — | — | `sistem.yonet` | — | Okuma kapısı |

**Ekran (menü) yetkileri** — modüller kendilerini `APP.modulKaydet({ yetki })` ile tanıtır; `js/app.js:git` yetkisiz modülü açmaz, `menuCiz` yetkisiz modülü menüde göstermez. Ekran adları ve sekmeleri `04-ekranlar-ve-dosya-bicimleri.md` belgesindedir.

| Ekran | Menü başlığı | Gereken yetki | Ek koşul |
|---|---|---|---|
| Özet | Genel | `ozet.oku` | Tümü destekli |
| Maaş Dağılımı | Genel | `ozet.oku` | Tümü destekli |
| Bütçe Çalışmaları | Bütçe | `personel.oku` | |
| Personel ve Zam | Bütçe | `personel.oku` | |
| Aylık Girdiler | Bütçe | `personel.oku` | |
| Maliyet Tablosu | Bütçe | `ozet.oku` | Tümü destekli |
| Performans Değerlendirme | Bütçe | `zam.oku` | Her grupta; model düzenleme `parametre.yaz` |
| Fazla Mesai Planı | Bütçe | `personel.oku` | Her grupta |
| Personel İçe Aktarma | İçe / Dışa Aktarma | `personel.yaz` | Excel / CSV ya da ERP / bordro listesi |
| Excel Raporu | İçe / Dışa Aktarma | `excel.aktar` | Geri yükleme ayrıca `zam.yaz` |
| Parametreler | Tanımlar | `parametre.oku` | |
| Tanımlar (Gruplar ve İçe Aktarma Başlıkları sekmeleri dâhil) | Tanımlar | `parametre.oku` | Gruplar sekmesi yalnız `sistem.yonet` ile görünür ve yazılır; diğer yazmalar `parametre.yaz` |
| Kullanıcılar | Yönetim | `sistem.yonet` | |
| Sistem (örnek veri yükleme dâhil) | Yönetim | `sistem.yonet` | |
| Kullanım Kılavuzu | — | yok | Menüde değil, sol alttaki düğme |

Menü başlıklarının sırası: Genel, Bütçe, İçe / Dışa Aktarma, Tanımlar, Yönetim (`js/app.js:menuCiz`); başlık içindeki sıra modüllerin yüklenme sırasıdır (`index.html`). Tablo bu sırayı izler.

### 7.6 T.C. alanının gizlenmesi
- `B.tc(t)` yetkisiz kullanıcıda `U.tcMaskele` ile ilk 3 + `*****` + son 3 haneyi gösterir (`js/core/bicim.js`, `js/core/util.js`). Kişi kartı başlığı, aktarım önizlemesi, performans ekranı ve Excel çıktıları (Excel Raporu, performans şablonu) bu kurala uyar.
- Maskeli T.C. içeren bir Excel dosyası içe alınamaz (eşleşme T.C. ile yapılır); içe alacak dosyayı `alan.tc` yetkisi olan kullanıcı almalıdır.
- T.C. kaydın anahtarı olduğu için **API'de maskelenmez**: okuma işlevleri T.C.'yi okuma yetkisi olan her kullanıcıya tam döndürür. Gizleme ekran ve dosya düzeyindedir; taşıyan sistemde bu alan sunucuda süzülmelidir (§10.12).

---

## 8. Eşzamanlılık

Kaynak: `js/core/kilit.js`, `js/db/engine.js` (depo katmanı, kalıcılık), `Sunucuyu-Baslat.ps1` (`/kilit`, `/veri`), `js/app.js:kilitSeridiCiz`, `cakismaPerdesi`.

### 8.1 Neden
Program kaydederken veritabanının **tamamını** yazar. İki kişi (ya da aynı kişinin iki sekmesi) aynı anda kayıt yaparsa ikincisinin kopyasında birincinin değişiklikleri yoktur. Çözüm "ortak klasördeki dosya" mantığıdır: programı ilk açan **yazar**, sonrakiler **görüntüleme kipinde** açılır.

### 8.2 Yazma kilidi
- Kilit sunucu belleğinde değil `veri\kilit.json` dosyasındadır (ortak klasörde herkes kendi sunucusunu çalıştırabilir; ortak olan klasördür). İçerik: `oturum`, `kullanici`, `adSoyad`, `bilgisayar`, `alindi`, `tazelendi`.
- `POST /kilit {oturum, kullanici, adSoyad}`: kilit yoksa, **120 sn**'den uzun süredir tazelenmemişse (düşmüş) ya da aynı oturumunsa sahiplik verilir/tazelenir; değilse `sahip: false` ve mevcut sahip bilgisi döner.
- İstemci: yazar 30 sn'de bir tazeler, okur 15 sn'de bir yeniden dener. Sayfa kapanırken `sendBeacon` ile bırakır; çıkışta ve hareketsizlik kapanışında `KILIT.birak()`.
- Kilit giriş ekranından **önce** alınır (girişte yazılan "son giriş" görüntüleme kipindeki kullanıcıda sahte çakışma açmasın); giriş başarılı olunca kullanıcı bilgisiyle yeniden denenir.
- Sunucusuz açılışta (veri tarayıcıda) kilit kullanılmaz, herkes yazar sayılır. Kilit sorulamazsa da yazar sayılır: programı kullanılmaz kılmak çakışma riskinden kötü sayılmıştır; çakışmayı sürüm denetimi (§8.5) yakalar.

### 8.3 Görüntüleme kipi
- `KILIT.yazabilirMi()` yanlışsa:
  - `.yaz`/`.yonet` yetkisi isteyen her API işlemi `KILIT.engelMesaji()` ile reddedilir (`yetkiIste`).
  - Veritabanı motoru dosyaya **hiç yazmaz** (`engine.js:yazmaIsi`); bellekte oluşan değişiklik (ör. giriş kaydı) kalıcı olmaz.
  - Sıfırlama ve yedekten geri yükleme yapılamaz (`yikiciIslemOncesi`).
  - Her şey görülebilir, Excel alınabilir (`excel.aktar` `.yaz` değildir).
- Ekranın üstünde şerit: "**Yalnızca görüntüleme.** <ad> (<saat> itibarıyla) kayıt yapıyor … O kişi programı kapattığında devralırsınız." ve "↻ Şimdi kontrol et". Kilit size geçince "Yazma yetkisi size geçti" bildirimi çıkar ve ekran yenilenir.

### 8.4 Aynı kişinin iki sekmesi
- Oturum kimliği sekme başınadır (`sessionStorage`); aynı kullanıcının ikinci sekmesi farklı oturumdur ve görüntüleme kipinde açılır.
- `kendiHesabimMi()` kilit sahibinin kendi hesabınız olduğunu anlar; mesaj: "Program **başka bir sekmede** açık ve kayıt yetkisi orada. Diğer sekmeyi kapatıp bu sayfayı yenileyin (en geç 2 dakika içinde kendiliğinden geçer)."
- **Risk (doğrulanamadı, tarayıcı davranışı):** tarayıcılarda "sekmeyi çoğalt" `sessionStorage`'ı kopyalar; çoğaltılan sekme aynı oturum kimliğiyle ikinci bir yazar olabilir. Bu durumda §8.5 sürüm denetimi veri kaybını önler, ancak ikinci sekmenin girdileri yazılmaz.

### 8.5 Sürüm denetimi (ikinci savunma hattı)
- Sunucu her okumada `X-Veri-Surum` başlığını (veri dosyasının son yazma zamanı, metin olarak) verir; yazarken geri gönderilir. Arada başkası yazmışsa **409** döner, kayıt **reddedilir**. Şifreleme açıkken şifresiz veri gelirse **423** döner.
- İstemci kapatılamayan "Kaydınız yazılmadı" perdesi açar: önce ekrandaki hâlin yedeği indirilir (`ADB.yedekIndir`), sonra sayfa yenilenir.
- Ardışık yazmalar 400 ms içinde tek yazmada birleşir ve **sıraya** alınır (iki yazma birlikte gitseydi ikincisi sahte çakışma alırdı).

---

## 9. İşlem kaydı (log)

- Tablo `islem_log (id, tarih, kullanici_adi, islem, tablo, kayit_anahtar, detay)`. Kayıt yazılamazsa işlem engellenmez. Sistem ekranı son 300 kaydı gösterir (`logListe`, `sistem.yonet`). Kaynak: `js/db/api.js:log`, `logListe`.

| `islem` | `tablo` | `kayit_anahtar` | `detay` | Kaynak işlev |
|---|---|---|---|---|
| `GIRIS` | kullanici | kullanıcı adı | — | `girisYap` |
| `CIKIS` | kullanici | kullanıcı adı | — | `cikisYap` |
| `EKLE` | kullanici | kullanıcı adı | Yönetici / Kullanıcı | `kullaniciEkle` |
| `GUNCELLE` | kullanici | kullanıcı adı | — / "Parola değiştirildi" | `kullaniciGuncelle`, `parolaDegistir` |
| `SIL` | kullanici | kullanıcı adı | — | `kullaniciSil` |
| `GUNCELLE` | kullanici_yetki | kullanıcı adı | "n yetki, m grup" | `kullaniciErisimYaz` |
| `EKLE` / `GUNCELLE` | grup | grup kodu | grup adı | `grupKaydet` (ve `varsayilanGrupAc`) |
| `SIL` | grup | grup kodu | — | `grupSil` |
| `GUNCELLE` | grup | grup kodu | "maaş aralıkları: …" | `maasAralikYaz` |
| `KAYDET` / `SIL` | butce_bolumu | bölüm adı | — | `butceBolumuKaydet`, `butceBolumuSil` |
| `BIRLESTIR` | butce_bolumu | "kaynak → hedef" | "n satır" | `butceBolumuBirlestir` |
| `KAYDET` / `SIL` | hesap_turu | "yıl/kod" | — | `hesapTuruKaydet`, `hesapTuruSil` |
| `KAYDET` / `SIL` | kanun_turu | kod | — | `kanunKaydet`, `kanunSil` |
| `KAYDET` | parametre | "yıl/anahtar" | değer | `parametreYaz` |
| `KAYDET` / `SIL` | parametre | "yıl/perf.model" | "değerlendirme modeli" / "varsayılan modele dönüldü" | `performansModeliYaz` |
| `KAYDET` | gv_dilim | yıl | "n dilim" | `dilimYaz` |
| `KAYDET` | asgari_ucret / sakatlik_derece / performans_kademe | yıl | — | `asgariYaz`, `sakatlikYaz`, `performansYaz` |
| `KOPYALA` | parametre | "kaynak → hedef" | — | `yilKopyala` |
| `ONGORU` | parametre | hedef yıl | "kaynak × %oran[, ay +%ara]" | `ongoruUygula` |
| `GUNCELLE` | parametre | yıl | "durum = RESMI" | `parametreDurumYaz` |
| `EKLE` | calisma | çalışma id | "yıl grup" / "revize · kaynak …" | `calismaKaydet`, `calismaRevizeAc` |
| `GUNCELLE` | calisma | çalışma id | ad [· durum X → Y] | `calismaKaydet` |
| `SIL` | calisma | çalışma id | "yıl grup ad" | `calismaSil` |
| `KAYDET` | calisma_ayar | çalışma id | "anahtar=değer, …" / "mesai öngörüsü açıldı/kapatıldı" | `calismaAyarYaz`, `mesaiAktifYaz` |
| `KAYDET` | calisma_ozet | "id/anahtar" | değer | `calismaOzetYaz` |
| `KAYDET` | calisma_personel | "id/tc" | ad soyad | `calismaPersonelKaydet` |
| `GUNCELLE` | calisma_personel | "id/tc" | "alan = değer" | `calismaPersonelAlanYaz` |
| `SIL` | calisma_personel | "id/tc" | — | `calismaPersonelSil` |
| `TASI` | calisma_personel | tc | "grup · çalışma → grup · çalışma" | `calismaPersonelTasi` |
| `KOPYALA` | calisma_personel | "kaynak → hedef" | "TÜR, n kişi" | `calismaPersonelKopyala` |
| `AKTAR` | calisma_personel | çalışma id | "x güncellendi, y eklendi" | `erpAktar` |
| `KAYDET` | calisma_personel | çalışma id | "performans çarpanı uygulandı, n kişi" | `performansCarpanUygula` |
| `KAYDET` / `SIL` | performans_girdi | çalışma id (silmede "id/tc") | "<açıklama>, n alan" / "değerlendirme silindi" | `performansGirdiYaz`, `performansGirdiSil` |
| `KAYDET` | mesai_ongoru | çalışma id | "elle / Excel: dosya, n hücre" | `mesaiYaz` |
| `KOPYALA` | mesai_ongoru | "kaynak → hedef" | "mesai öngörüsü" | `mesaiKopyala` |
| `KAYDET` | aylik_girdi | "id/tc/ay" | "alan = değer" | `aylikGirdiYaz` |
| `TOPLU` | aylik_girdi | "id/ay" | "alan = değer (n kişi)" | `aylikGirdiToplu` |
| `GUNCELLE` | sistem_bilgi | oturum_zaman_asimi_dk | "n dk" | `oturumZamanAsimiYaz` |
| `KAYDET` | sistem_bilgi | aktarim.sozluk | "n alan değiştirilmiş" | `aktarimSozlukYaz` |
| `ORNEK` | sistem | — | "örnek veri yüklendi" | `ornekVeriYukle` |
| `ICE_AKTAR` | calisma_personel | çalışma id | "dosya: n düzeltme" | Excel Raporu içe alma (ekran, `API.log`) |
| `DISA_AKTAR` | calisma / performans_girdi / mesai_ongoru | çalışma id | dosya adı / açıklama | Excel çıktıları (ekran, `API.log`) |

- **Kayıt tutulmayanlar** (kodda `log` çağrısı yok): veri şifrelemesi kur/kaldır, yedeğin indirilmesi ve yedekten geri yükleme, sıfırlama, başlangıç verisinin yüklenmesi.
- Hücre bazlı girişler (aylık girdi, düzeltme) her değişiklikte ayrı kayıt üretir; taşıyan sistemde kayıt hacmi buna göre planlanmalıdır.

---

## 10. Güvenlik denetimleri

Bu bölüm, API'nin bugün uyguladığı yetki ve bütünlük denetimlerini bir arada verir. Taşıyan sistemde aynı kurallar **sunucu tarafında** kurulmalıdır.

### 10.1 Yazma denetimi
- Bütün yazma işlemleri `yetkiIste` üzerinden geçer: yetki yoksa "Bu işlem için yetkiniz yok."; `.yaz`/`.yonet` yetkilerinde ayrıca yazma kilidi (`kilitIste`) aranır.
- Çalışmaya yazan her işlem `calismaYazIste(id, yetki)` ile sırayla grupta yazma, çalışmanın onaylı olmaması ve işlem yetkisini denetler. Tanım yazmalarında (bütçe bölümü, maaş dağılımı aralıkları) grup yazma ayrıca aranır.
- Hesap önbelleği veri yazan her işlemden sonra temizlenir (`onbellekTemizle`).

### 10.2 Kullanıcı yönetimi
- `kullaniciEkle`, `kullaniciGuncelle`, `kullaniciSil`, `kullaniciErisimYaz`, `oturumZamanAsimiYaz` `sistem.yonet` ister. İstisnalar: hiç kullanıcı yokken ilk yönetici hesabı yetkisiz açılır; kişi **kendi** parolasını değiştirebilir (`parolaDegistir`, yalnız yazma kilidi).
- Sistemde en az bir etkin yönetici kalır (`digerYoneticiYok`).

### 10.3 Okuma kapıları
- Ekranlara açılan kişi verisi okuma işlevleri ilgili okuma yetkilerinden birini ister (`okumaIste`, `kapi` sarmalayıcısı; sistem yöneticisi her zaman geçer). Yetkisizde "Bu bilgiyi görme yetkiniz yok.":

| Kapı | İsteyen işlevler | Geçiren yetkilerden biri |
|---|---|---|
| `OKU_HESAP` | `calismaHesapla`, `birlesikHesapla`, `calismaOzetOku` | `sistem.yonet`, `ozet.oku`, `personel.oku`, `zam.oku`, `personel.yaz`, `zam.yaz`, `aylik.yaz`, `excel.aktar` |
| `OKU_PERSONEL` | `calismaPersonelListe`, `calismaPersonelGetir`, `personelGetir`, `personelGecmis`, `personelOnDoldur`, `aylikGirdiHarita`, `mesaiOku` | `sistem.yonet`, `personel.oku`, `personel.yaz`, `zam.oku`, `zam.yaz`, `aylik.yaz`, `excel.aktar` |
| `OKU_PERFORMANS` | `performansGirdiHarita`, `performansOncekiDonem` | `zam.oku`, `zam.yaz`, `personel.oku`, `personel.yaz` |
| `sistem.yonet` | `logListe`, `kullaniciListe`, `kullaniciYetkileri`, `kullaniciGruplari` | `sistem.yonet` |

- İç hesaplar (ör. yeni yıl aktarımında kaynak çalışmanın hesabı) sarmalanmamış işlevleri kullanır; kapılar yalnız dışa açılan işlevlerdedir.
- Parametre ve tanım okumaları (`parametreOku`, `dilimListe`, `kanunListe`, `butceBolumuListe`, `performansModeliHam`, `performansModeli`, `calismaPerformansModeli`, `aktarimSozluk` …) kapısızdır: kişisel değildir ve her hesapta gerekir.
- Kapıya ek olarak gruba bağlı okumalar `calismaOkuIste` ile grup görme ister (§7.3). `calismaAyarOku` yalnız grup görme ister, okuma yetkisi istemez.

### 10.4 Onaylı çalışmanın korunması
- Onaylı çalışmaya hiçbir yazma işlemi yapılamaz (`calismaYazIste`).
- `calismaKaydet` onaylı kalan çalışmada yalnız açıklamayı değiştirir (ad ve zam bayrakları korunur); var olan çalışmanın grubu istekten değil kaydın kendisinden alınır. Durum değişikliği (onaylama / taslağa alma) aynı işlevle yapılır.
- Yeni yıl öngörüsü, onaylı çalışması olan yılın yasal parametrelerini ezemez (`ongoruUygula` → `yilOnayliMi`).

### 10.5 Alan ve değer denetimleri
- `calismaKaydet` ve `calismaAyarYaz`: ücret esası yalnız `NET` / `BRUT` olabilir. `erpAktar`: maaş varsa `maasEsasi` zorunlu ve çalışmanın esasına eşit.
- `aylikGirdiYaz` ve `aylikGirdiToplu`: bilinmeyen alan reddedilir; kişi hesap bilgileri (`AYLIK_KISI_ALANLARI`) `personel.yaz`, aylık tutarlar `aylik.yaz` ister. Toplu girişte ay 1–12 olmalıdır.
- `calismaPersonelAlanYaz`: alan `CP_ALANLAR`'da olmalı; zam alanları `zam.yaz` ister.
- `mesaiYaz`: bilinmeyen alan ve 1–12 dışı ay reddedilir.
- `performansGirdiYaz`: alan çalışmanın modeline göre (`calismaPerformansModeli(id).alanGecerli`) denetlenir; çalışmada olmayan kişi reddedilir.
- `performansModeliYaz`: model `PERF.hazirla` ile baştan sona denetlenir (§5.3); hatalı model kaydedilmez.
- `aktarimSozlukYaz`: bilinmeyen alan reddedilir; boş liste kaydı siler (varsayılana döner).
- `calismaPersonelKaydet`: T.C. 11 hane, ad zorunlu, yaka `B`/`M`; yeni T.C. başka kişiye aitse reddedilir.
- `dilimYaz` (oran 0–1, artan üst sınır), `asgariYaz` (Ocak kaydı zorunlu), `ongoruUygula` (hedef > kaynak, oran −1…5).
- `grupKaydet`: kod biçimi ve tekilliği.

### 10.5a Ücret esası bütünlüğü
Net ve brüt tutarların birbirine karışmaması için API şunları uygular (`js/db/api.js`):
- Bütçe satırı ya da aylık girdi kaydı olan çalışmanın esası değiştirilemez (`calismaAyarYaz` → `esasBagli`).
- Kopyalama (`YENI_YIL`, `KOPYA`, revize) hedefe kaynağın esasını satırlarla aynı işlemde yazar; hedefin esası bağlıyken esas farklıysa reddedilir (`calismaPersonelKopyala`).
- Esası farklı çalışmalar arasında kişi taşınmaz (`calismaPersonelTasi`); taşıma hedef listesi onları göstermez (`tasimaHedefleri`).
- Ön doldurma, esası farklı önceki çalışmanın maaşını getirmez (`personelOnDoldur` → `esasFarkli`).
- "Tümü" görünümünde esaslar karışıksa maaş ve zam toplamları verilmez (`birlesikHesapla` → `karisikEsas`).
- İçe aktarmada maaş tutarlarının esası beyan edilmeli ve çalışmanın esasıyla aynı olmalıdır (`erpAktar`, `maasEsasi`); sütun başlığının esasa uyumu ekranda denetlenir (§5.1).

### 10.6 Kullanımdaki kaydın silinmemesi
- `grupSil`: grubun çalışması varsa reddedilir.
- `butceBolumuSil`: grubun herhangi bir yılında o bölümde satır varsa reddedilir.
- `hesapTuruSil`: o yılın bütçe satırlarında **ya da** aylık girdilerinde kullanılıyorsa reddedilir.
- `kanunSil`: bütçe satırlarında ya da aylık girdilerde kullanılıyorsa reddedilir.
- Onaylı çalışma silinemez (`calismaSil` → `calismaYazIste`).

### 10.7 Grup gizliliği
- Görünür gruplara süzme: `calismaListe`, `gorunurGruplar`, `personelGecmis`; `bolumKisiSayilari` grubu görmeyene boş döner.
- `tcBaskaGrupta` yalnız var/yok döndürür (başka grubun adı verilmez).

### 10.8 Tek işlem (atomik) yazmalar
Biri başarısız olursa hiçbiri yazılmaz: kişi kartı + bütçe satırı kaydı; çalışma ayarlarının kaydı; çalışma onaylama ve taslağa alma; revize açma (çalışma + kopyalama); kart kaydı + grup taşıma (`calismaPersonelKaydet(id, v, eskiTc, { hedefId, butceBolumu })`); grup taşıma; bütçeden çıkarma; grup silme; bölüm birleştirme ve ad değişikliği; personel içe aktarma; Excel Raporu içe alma (`API.topluIslem`); toplu aylık giriş; performans ve mesai yazmaları; çarpan uygulama; dilim, asgari ücret, sakatlık ve performans kademesi listeleri; yeni yıl öngörüsü; yetki ve grup erişimi atama.

### 10.9 Oturum tazeleme
- Her ekran geçişinde `API.oturumTazele()` kullanıcının yönetici bilgisini, yetkilerini, grup erişimini ve etkin durumunu yeniden okur; silinen ya da devre dışı bırakılan kullanıcının oturumu kapanır (`js/app.js:git`).

### 10.10 Yedekten geri yükleme ve yıkıcı işlemler
- `js/db/engine.js:yedektenYukle`: oturum açıksa `sistem.yonet` gerekir. Giriş ekranından ("Giriş yapamıyorum") yalnız veri **şifreliyken** ve yalnız **şifreli** bir yedek yüklenebilir (yedek bellekteki anahtarla açılmazsa yedeğin veri parolası sorulur); veri şifresizse giriş ekranından geri yükleme kapalıdır ("Sistem yöneticisi olarak giriş yapıp Sistem ekranından geri yükleyin."). Dosya SQLite olmalı ve `personel` tablosu içermelidir.
- Sıfırlama (`sifirla`) ve şifreleme kur/değiştir/kaldır `sistem.yonet` ister; denetim işin kendisindedir (konsoldan çağrılsa bile).
- Sıfırlama ve geri yükleme görüntüleme kipinde yapılamaz (`yikiciIslemOncesi`); başlamadan önce mevcut hâl yedeklenir (`yedek-elle` klasörü ya da indirme), yedekleme başarısız olursa işlem yapılmaz.

### 10.11 Ekran ve dosya düzeyindeki denetimler
- T.C. maskeleme (`alan.tc`, §7.6) ekranda ve Excel çıktılarındadır; maskeli dosya içe alınamaz.
- Ekranlar düzenleme alanlarını `calismaYazilabilir(c)` ve ilgili `.yaz` yetkisiyle açar; asıl denetim API'dedir.

### 10.12 Mimari sınır
Program tarayıcıda çalışır; şifresi çözülmüş veritabanı oturum boyunca tarayıcı belleğindedir ve `window.ADB` ile doğrudan sorgulanabilir. Yukarıdaki denetimler ekran dışından yapılan API çağrısını ve yanlış kullanımı engeller; tarayıcının geliştirici araçlarını kullanan bir kullanıcının veritabanını doğrudan okumasını engelleyemez. **Okuma yetkilerinin tam koruması ancak verinin sunucuda tutulduğu bir mimaride mümkündür:** orada kişi verisi ve T.C. yalnız yetkili kullanıcıya sunucudan gönderilmeli, yazma denetimleri sunucuda tekrarlanmalıdır.

---

## 11. Bilinçli tasarım kararları

Aşağıdaki kararlar programın bugünkü davranışıdır; uyarlamada ya da taşımada **korunmaları** önerilir.

### Onay ve kilit
1. **Onaylanmış maliyet — hatalı olsa bile — değişmez; düzeltme yeni dönemde ya da revizede yapılır.** Onaylı çalışmaya hiçbir yazma işlemi yapılamaz; değişiklik için taslağa alınır. Gerekçe: yönetimin onayladığı rakam sonradan değişirse bütçe ile onay belgesi uyuşmaz. Kaynak: `api.js:calismaYazIste`.
2. **Onaylı çalışmanın parametreleri dondurulur; resmî rakamlar yalnız taslak ve revizeye yansır.** Gerekçe: bütçe genellikle resmî rakamlar açıklanmadan (öngörüyle) onaylanır; onaylı çalışma olduğu gibi kalır, resmî rakamlarla hesap "Revize" olarak yanında görünür. Kaynak: `schema.js:PARAMETRE_DONDUR`, `api.js:calismaRevizeAc`.
3. **Kişi kartına sonradan yazılan giriş/çıkış tarihi onaylı maliyeti değiştirmez:** onayda tarihler satıra dondurulur. Kaynak: `schema.js:ONAY_TARIH_DONDUR`.
4. **Öngörü, onaylı çalışması olan yılın yasal parametrelerini ezemez** (1. kararın sonucu). Kaynak: `api.js:ongoruUygula`.
5. **Ayrı bir onay yetkisi yoktur;** onay, grupta yazma + `personel.yaz` ile verilir. Görev ayrılığı gereken kurumlar ayrı bir onay yetkisi ekleyebilir. Kaynak: `api.js:calismaKaydet`.

### Grup ve kişi
6. **Gruplar kullanıcı tanımlıdır; kod sonradan değişmez, çalışması olan grup silinmez.** Gerekçe: çalışmalar, bütçe bölümleri ve kullanıcı erişimleri koda bağlıdır; geçmiş bütçeler grupla birlikte kaybolmasın. Kaynak: `api.js:grupKaydet`, `grupSil`.
7. **Kişi kartı tektir; dönem tarihleri çalışma satırında korunur** (`onay_sabit = 2`). Gerekçe: bir yıl bir grupta çalışıp ayrılan, sonra başka bir gruba yeniden giren kişide eski grubun dönemi bozulmasın. Kaynak: `api.js:donemTarihleriniKoru`.
8. **Maaş alanının anlamı giriş tarihine bağlıdır.** Yıl başından önce giren → önceki yıl maaşı + zam; yıl içinde giren → bu yılın maaşı, kademe öngörüsü yok. Gerekçe: yıl içinde işe alınan kişinin maaşı zaten o yılın piyasasına göre belirlenmiştir. Kaynak: `api.js:calismaHesapla` (`eskiYilda`), `hesap.js:zamHesapla`.
9. **Sıralama: bölüm sırası → bölüm içinde işe giriş eskiden yeniye → ad.** Gerekçe: aynı bölümdekiler alt alta, her bölümde en son giren en altta görünsün. Kaynak: `api.js:calismaPersonelListe`.
10. **Grup değiştiren kişi bütün bilgileriyle taşınır; onaylı çalışmalar etkilenmez.** Kaynak: `api.js:calismaPersonelTasi`.
11. **Aktarım önizlemesinde başka gruba ait kişinin grup adı verilmez.** Gerekçe: yetkisiz gruba ait bilgi sızmasın. Kaynak: `api.js:tcBaskaGrupta`.
12. **Personel içe aktarmada boş gelen alana dokunulmaz.** Gerekçe: eksik sütunlu ya da kısmi bir liste mevcut veriyi silmesin. Sonucu: çıkış tarihi aktarımla silinemez (§13). Kaynak: `api.js:erpAktar`.

### Yeni yıl ve parametre
13. **Yeni yıl öngörüsünde üst çubukta seçili yıl hedef, bir önceki yıl kaynaktır; Parametreler ekranının yılı üst çubuğun yılıdır.** Gerekçe: ekranda görülen yıl ile öngörünün yazdığı yıl karışmasın.
14. **Kaynak yılda asgari ücret, dilim ya da sakatlık tutarı yoksa öngörü durdurulur.** Gerekçe: aksi hâlde hedef yılın tabloları silinip boş kalırdı. Kaynak: `api.js:ongoruHesapla`.
15. **Teşvik oranları çalışmaya özeldir ve yeni yıla taşınmaz; 05510 oranı hariç.** Gerekçe: 05510 oranı işyerinin niteliğine (imalat / imalat dışı) bağlıdır ve yıldan yıla değişmez; diğer oranlar o yılın kararıdır. Kaynak: `api.js:calismaHesapla`, `calismaPersonelKopyala`.
16. **05510 iki ayrı kanun türüyle tanımlıdır: %2 (imalat dışı) ve %5 (imalat).** Hesabı tür adı değil `kural` ve `oran` belirler. Kaynak: `schema.js:TEMEL_VERI_YAZ`.

### AR-GE ve gün
17. **AR-GE günü kişiye girilir ve devreder:** Ocak'a girilen gün bütün yıla uygulanır. Kaynak: `api.js:AYLIK_SUREKLI`.
18. **AR-GE günü için yılın bir gün parametresi yoktur.** Kişiye gün girilmemişse yalnız çalışmaya kayıtlı `arge_gun` ayarı kullanılır — o da yalnız GV teşvik oranı yılın `arge_gv_esik` eşiğine (varsayılan 0,8) ulaşan kişide —; ayar yoksa 0. Gerekçe: yanlış bir varsayılan teşvik tutarını sessizce şişirir. Kaynak: `api.js:hesapParametre`, `calismaHesapla`.
19. **AR-GE günü yeni yıla taşınmaz; o yılın kararıdır.** Kaynak: `api.js:calismaPersonelKopyala`.
20. **AR-GE günü toplu girilirken yalnız o ay 05746 kanunlu kişilere yazılır; temizlerken herkese uygulanır** (Aylık Girdiler ekranı). Gerekçe: AR-GE dışı kişiye gün yazılmasın, ama yanlışlıkla kalmış gün temizlenebilsin.
21. **Eksik gün öngörüsü (`gun.*`) yalnız `KOPYA`'da taşınır;** yeni yılın gün öngörüsü o yılın kararıdır. Kaynak: `api.js:calismaPersonelKopyala`.

### Maaş dağılımı
22. **Maaş aralıkları her grubun kendi maaşlarından otomatik seçilir ya da grup için sabitlenir.** Gerekçe: grupların maaş yelpazesi çok farklı olabilir; sabitleme yıllar arası karşılaştırma içindir. Kaynak: `api.js:aralikOner`, `maasAralikYaz`.
23. **Yıl içinde işe girenler (kademe öngörüsü almayanlar) dağılım listesinde varsayılan olarak yoktur; elle eklenip çıkarılabilir; seçim (`dagilim.*`) yeni yıla taşınmaz.** Gerekçe: zam almayacak kişi zam dağılımı analizini bozar; bu yılın yeni gireni gelecek yıl zam alır ve listede olmalıdır. Kaynak: `api.js:calismaPersonelKopyala`.

### Performans ve mesai
24. **Performans değerlendirmesi her grupta yapılabilir; veriler Excel şablonunda toplanır, T.C. ile içe alınır.** Puan ve çarpan saklanmaz; çarpan zam hesabına ancak "Çarpanları uygula" ile geçer. Gerekçe: değerlendirme değişse bile zam hesabı kullanıcı onaylamadan oynamasın. Kaynak: `api.js:performansCarpanUygula`.
25. **Performans modeli veridir ve yıl bazında tutulur; programla gelen model yalnız bir örnektir.** Amirler, kriterler, ağırlıklar ve ek puan kuralları ekrandan değiştirilir; model onayda diğer parametrelerle dondurulur. Gerekçe: değerlendirme politikası kurumdan kuruma ve yıldan yıla değişir; onaylanmış bir çalışmanın dayandığı model sonradan değişmemelidir. Kriter ve ek puan kodları kaydedildikten sonra değişmez, kaldırılan tanımın girilmiş değerleri silinmez. Gerekçe: girilmiş değerlendirmeler bir model düzeltmesiyle kaybolmasın. Örnek modelde kıdem elle girilir (işyerindeki bütün çalışma dönemlerinin toplamı; işe giriş tarihinden hesaplanamaz). Kaynak: `core/performans.js:hazirla`, `api.js:performansModeliYaz`, `calismaPerformansModeli`.
26. **Fazla mesai planı bölüm × ay toplam saat olarak tutulur ve kişi başına bölünür; kişiye o ay girilen mesai önceliklidir.** Gerekçe: mesai planı kişi kişi değil bölüm bölüm yapılır. Kaynak: `api.js:mesaiKisiBasi`, `calismaHesapla`.

### Yetki, veri güvenliği, bakım
27. **Rol yoktur; yetki ve grup erişimi kullanıcı başına atanır.** Gerekçe: küçük ekiplerde her kişinin neyi görüp neyi değiştirebileceği tek tek belirlenir; rol katmanı gerekiyorsa taşıyan sistem ekler. Kaynak: `schema.js:YETKILER`, `api.js:kullaniciErisimYaz`.
28. **Hareketsizlikte otomatik kapanma (varsayılan 5 dk); yalnız çıkış değil sayfa yeniden yüklenir.** Gerekçe: veri parolasının anahtarı bellekte kalmasın. Kaynak: `app.js`, `api.js:oturumZamanAsimi`.
29. **Sıfırlama giriş ekranında yoktur; yalnız yöneticiye açıktır; önce otomatik olarak yedeklenir, yedekleme başarısız olursa yapılmaz; görüntüleme kipinde yapılamaz.** Program güncellemeleri sıfırlama gerektirmez; şema değişiklikleri sürüm göçüyle gelir (`schema.js:TABLO_GOC`, `VERI_GOCLERI`, `EKSIK_SUTUNLAR`). Gerekçe: elle girilen veriler bakım işlemiyle kaybolmasın. Kaynak: `engine.js:sifirla`, `yikiciIslemOncesi`.
30. **Veri parolası giriş parolasından ayrıdır; kaybedilirse arka kapı yoktur.** Şifrelemeyi yalnız yönetici değiştirir; denetim işin kendisindedir. Kaynak: `app.js`, `engine.js`.
31. **Kilit sorulamazsa program yazar kipinde açılır;** çakışmayı sürüm denetimi yakalar. Gerekçe: programı kullanılmaz kılmak çakışma riskinden kötüdür. Kaynak: `kilit.js:dene`.

### Hesap motoru (ayrıntısı `02-hesap-motoru.md`)
32. **Hesap kuralları** (`js/core/hesap.js` başlığı): giriş öncesi ve çıkış sonrası ayda maaş ve bütün ek ödemeler 0; sakatlık indirimi çalışan lehinedir, maliyetten düşülmez; ay içinde giren/çıkanda asgari ücret istisnası gün oranında; fiilî gün sayısıyla girilen tam ay 30 sayılır; AR-GE günü sigorta gününü, GV/DV teşviki hesaplanan vergiyi aşamaz; 15510 ve 05746'nın 05510 payı SGK tavanıyla sınırlı; ayni yardım işçi SGK tavanına ve BES matrahına girmez; SGK matrahı asgari ücret tabanının altına inmez; yakıt yardımının damgası yılın oranıyla; **mesai çalışmanın esasındaki maaştan** hesaplanır (net esasta net, brüt esasta brüt saat ücreti; katsayılar ve günlük saat yıl parametresidir, §6.1).
33. **Bütçe bölümü numarası addan ayrıdır.** Gerekçe: dış listelerde numara çoğu zaman adın içine yazılır; ayrı alan, aynı numaranın iki bölüme ya da bir bölümün iki numaraya verilmesini engeller (`butceBolumuKaydet` aynı sıra ve aynı ad denetimi). Kaynak: `schema.js:BOLUM_TEMIZLE`, `api.js:butceBolumuKaydet`.

### Tanımlar ve kod
34. **Kurumdan kuruma değişen tanımlar ekrandan düzenlenir; kodda yalnız hesabın ve güvenliğin yapısı kalır.** Programı uyarlamak için kod değiştirmek gerekmemelidir.
    - **Ekrandan (veri olarak) düzenlenenler:** gruplar ve bütçe bölümleri; hesaplama türleri (oranlar, sigorta kolu seçimi); kanun türleri (ad, açıklama, sıra, 05510 oranı, kural seçimi); yıl parametreleri (genel oranlar, teşvik oranları, AR-GE eşiği, mesai katsayıları ve günlük saat, zam yuvarlaması, zam kademesi); GV dilimleri, asgari ücret, sakatlık tutarları, performans kademeleri; performans değerlendirme modeli (§5.3); personel içe aktarmanın başlık sözlüğü (§5.1); çalışma ayarları (§1.7); maaş dağılımı aralıkları; kullanıcılar, yetkiler ve grup erişimi; hareketsizlik süresi.
    - **Bilerek kodda kalanlar ve nedeni:**
      - *Yetki anahtarları* (`schema.js:YETKILER`): her anahtar API'de bir denetime bağlıdır; yeni yetki yeni bir denetim kodu gerektirir.
      - *Motorun alan kodları* (`AM`, `BB`, `CV`, `DM` …): hesap motorunun iç değişkenleridir; formüller bunlarla yazılmıştır.
      - *Teşvik ve sigorta kolu kurallarının formülleri* (`05510`, `05746`, `14857`, `15510`; `SSK` / `SGDP` / `YOK`): mevzuatın hesap biçimidir, değişmesi formül değişikliği demektir. Kanun ve hesaplama türünün adı ve oranı düzenlenir; `kural` ve `kol` motorun tanıdığı listeden seçilir.
      - *Yaka türleri* (`B` / `M`): zam kademesi, gün öngörüsü, performans modeli, fazla mesai planı ve özet anahtarları iki yakaya göre kurulmuştur.
      - *30 günlük ay ve 3 sakatlık derecesi:* SGK gün hesabının ve gelir vergisi sakatlık indiriminin yasal yapısıdır; derecelerin tutarları her yıl düzenlenir.
      - *Şifreleme ve kilit süreleri* (kilit tazeleme 30 sn, yeniden deneme 15 sn, düşme 120 sn; veri parolası en az 8 karakter): eşzamanlılık ve veri güvenliği davranışının parçasıdır; yanlış ayar veri kaybına ya da kilitlenmeye yol açabilir. Hareketsizlik süresi ise ekrandan ayarlanır.

### Ücret esası
36. **Ücret esası (net / brüt) çalışma bazındadır ve kurallar hep "en güvenli taraf"ta kalır:** bütçe satırı ya da aylık girdisi olan çalışmanın esası değişmez; yeni yıl, kopya ve revize kaynağın esasını devralır; esası farklı çalışmalar arasında kişi taşınmaz, maaş ön doldurulmaz; "Tümü"de karışık esasta maaş toplamı verilmez; içe aktarmada maaş sütununun esası başlığından anlaşılmazsa maaş alınmaz, API de esası beyan edilmemiş ya da çalışmanınkine uymayan maaşı reddeder. Gerekçe: net ile brüt arasındaki dönüşüm sabit bir oran değildir — gelir vergisi dilimi, asgari ücret istisnası ve SGK tavanı yüzünden kişiden kişiye ve aydan aya değişir; kesin bir çevirme yoktur. Yanlış esasta okunan bir tutar hata vermeden yanlış bütçe üretir; bu yüzden program şüpheli durumda tutarı çevirmek ya da tahmin etmek yerine işlemi durdurur ya da tutarı boş bırakır. Kaynak: `api.js:esasBagli`, `calismaAyarYaz`, `calismaPersonelKopyala`, `calismaPersonelTasi`, `personelOnDoldur`, `erpAktar`, `birlesikHesapla`.
37. **Yıllar arası karşılaştırma esas yüzünden bozulmaz.** Bir çalışmanın önceki yıl maaşı (`maas_eski`) ile yeni maaşı hep aynı esastadır, çünkü yeni yıl çalışması kaynağın esasını devralır ve önceki yılın zamlı maaşı aynı esasta taşınır; zam oranı da aynı esastaki iki tutardan hesaplanır. Önceki yıl maliyeti (`maliyet_onceki`) ve bütün maliyetler işveren maliyetidir, esastan bağımsızdır. Kurum net bütçeden brüte geçerse yeni esas boş bir çalışmayla başlar; o yılın önceki yıl maaşları yeni esasta girilir.

### Ekran adları
35. **Ekran ve menü adları kullanıcının yaptığı işe göre konur** (Bütçe Çalışmaları, Personel İçe Aktarma, Excel Raporu, Fazla Mesai Planı; dosya alıp veren ekranlar "İçe / Dışa Aktarma" başlığında). Gerekçe: program bordro, İK ve finans uzmanlarının diliyle okunmalı; kod adları (`mesai_ongoru`, `erpAktar`, `fm1` / `fm2` …) değişmez. **İstisna:** Fazla Mesai Planı'nın Excel sayfa ve dosya adındaki "MESAİ ÖNGÖRÜSÜ" bilerek değiştirilmemiştir (`modules/mesai.js:SAYFA`): içe alma sayfayı bu adla arar, önceden alınmış dosyalar okunabilmeye devam etsin.

---

## 12. Açılış akışı ve üst çubuk seçimi

Kaynak: `js/app.js:baslat`, `ilkKurulumEkrani`, `girisEkrani`, `uygulamayiAc`, `secimYukle`, `calismaSeciciCiz`, `git`.

1. Veri motoru yüklenir; veri dosyası şifreliyse **veri parolası** sorulur (giriş parolası değildir). Veritabanı ilk kez oluşturuluyorsa başlangıç verisi yüklenir (`API.seedYukle`, §6.9); dosya diske ilk yazılmadan önce yeni veri parolası iki kez sorulur (en az 8 karakter; "Şifresiz devam" uyarıyla mümkündür).
2. Bütünlük denetimi (`PRAGMA foreign_keys`) kapalıysa uyarı verilir.
3. Yazma kilidi giriş ekranından önce alınır (§8.2); hareketsizlik sayacı başlar.
4. Kullanıcı yoksa **ilk kurulum**: yönetici hesabı oluşturulur ve başlangıç seçilir — "Örnek veriyle başla" (`ornekVeriYukle`) ya da "Boş başla" (`varsayilanGrupAc`: yalnız yasal parametreler ve "Genel" grubu). Başlangıç verisi yüklenemezse program yine açılır ve hata bildirilir. Kullanıcı varsa **giriş**. Giriş ekranında "Giriş yapamıyorum": kayıtlı kullanıcı adları listelenir (parola gösterilmez) ve yedekten geri yükleme yapılabilir (§10.10; önce mevcut hâl `yedek-elle`'ye yedeklenir).
5. Giriş sonrası: seçim yüklenir, menü, kenar alt bölümü, üst çubuk seçicisi ve kilit şeridi çizilir, **Özet** ekranı açılır; sunucusuz açılış ve şifrelemenin düşmesi uyarıları gösterilir.
6. **Seçim** (`localStorage['butce_secim'] = {yil, grup, calisma}`; iç anahtar adları — `butce_secim`, sekme oturumu `butce_kilit_oturum`, tarayıcı veritabanı `maas_butce_sistemi`, veri dosyası `veri\butce.db`, başlatma dosyası `BUTCE-BASLAT.bat` — program adı "Ücret Hesaplama" olduğu hâlde bilerek eski hâliyle kalmıştır: değişirse mevcut kurulumların verisi ve seçimleri bulunamaz): kayıtlı yıl listede yoksa en yeni yıl; kayıtlı grup görünür değilse ilk görünür grup (`TUMU` yalnız birden fazla grupta); kayıtlı çalışma yalnız seçili yıl + gruba aitse geçerlidir. Yıl ya da grup değişince çalışma seçimi sıfırlanır.
7. Her ekran geçişinde önce oturum tazelenir (§10.9) ve ekran yetkisi denetlenir. Çalışma gerektiren ekranlarda sırayla: hiç görünür grup yoksa yöneticiye "Henüz grup tanımlanmamış. Tanımlar → Gruplar sekmesinden bir grup ekleyin.", diğer kullanıcıya "Size atanmış bir grup yok"; Tümü seçili ve ekran desteklemiyorsa "tek grup seçin"; seçili yıl + grupta çalışma yoksa "<yıl> için henüz bir bütçe çalışması yok" + grubun çalışması olan başka bir yıl varsa "<yıl> yılına geç" + (grup yazma ve `personel.yaz` varsa) "<yıl> çalışması aç…". Aksi hâlde ekran çizilir; aynı yıl + grupta birden çok çalışma varsa hangisinin seçili olduğunu gösteren bant, onaylı çalışmada kilit bandı eklenir.
8. Çıkış: kilit bırakılır, `CIKIS` kaydı yazılır, bekleyen kayıt diske gönderilir, giriş ekranına dönülür.

---

## 13. Açık ve doğrulanamayan noktalar

Aşağıdakiler güncel kodda geçerlidir. Taşıyan sistemde kapatılması ya da bilinçli olarak kabul edilmesi gerekir.

**Çalışma ve kopyalama**
1. Aynı yıl + grup + ad ile ikinci çalışma `calismaKaydet`'te veritabanının ham `UNIQUE` kısıt hatasıyla reddedilir; özel bir mesaj yoktur (**doğrulanamadı:** kullanıcıya görünen metin).
2. `calismaKaydet` var olan çalışmada `durum` verilmezse `TASLAK` varsayar: onaylı bir çalışma için durumsuz çağrı onayı kaldırır (tarih ve parametre dondurması silinir). Ekran her zaman durumu gönderir; doğrudan API kullanan taşıma kodu dikkat etmelidir.
3. Yeni çalışma açma (`calismaKaydet`) ile kaynaktan kopyalama (`calismaPersonelKopyala`) iki ayrı çağrıdır; ikincisi hata verirse boş bir taslak çalışma kalır. Tek işlemde yapan yalnız `calismaRevizeAc`'tır. `calismaPersonelKopyala`'nın içinde de satır kopyaları tek işlemdir, `calisma_ayar` kopyası bu işlemin dışındadır.
4. `YENI_YIL`, `mesai.ongoru` ayarını taşır ama `mesai_ongoru` tablosunu taşımaz: öngörü açıkken tablo kopyalanmazsa yeni yılda mesai 0 hesaplanır (kişiye o ay girilen hariç). Niyet kodda yazılı değildir (**doğrulanamadı**); tablo `mesaiKopyala` ile alınır.
5. `KOPYA` (ve dolayısıyla revize) dönem tarihlerini (`onay_sabit`, `onay_giris`, `onay_cikis`) kopyalamaz: kaynakta kendi dönem tarihi saklanan (`onay_sabit = 2`) kişi kopyada kişi kartının güncel tarihleriyle hesaplanır; onaylı kaynağın dondurulmuş tarihleri de revizeye geçmez. Niyet kodda belirtilmemiştir (**doğrulanamadı**).
6. "Tümü" görünümünde grubun aynı yılda birden çok çalışması varsa sıralamadaki ilk çalışma (ada göre) alınır (`js/app.js:calismalar`); üst çubukta seçilen çalışma dikkate alınmaz.

**Kişi ve aktarım**
7. Personel içe aktarma boş gelen alana dokunmadığı için yeniden işe giren kişinin karttaki eski çıkış tarihi aktarımla silinmez; çıkış tarihi giriş tarihinden önce kalırsa kişinin o yılki maliyeti eksik hesaplanır. Çıkış elle boşaltılmalıdır.
8. Satırı `onay_sabit = 2` olan çalışmaya yapılan aktarımda yeni tarihler kişi kartına yazılır, bu çalışmanın satırındaki dönem tarihleri değişmez; kişi formu ise aynı durumda tarihi satıra yazar (§3.3). İki yolun davranışı farklıdır.
9. `U.tcTemizle` 11 haneden uzun değeri ilk 11 haneye kırpar (reddetmez); T.C. denetim hanesi (`U.tcGecerliMi`) kayıt ve aktarımda kullanılmaz.
10. `aylikGirdiYaz` ay aralığını (1–12) denetlemez (toplu giriş denetler). Aylık girdi ve toplu girişte T.C.'nin o çalışmada olup olmadığı denetlenmez (yabancı anahtar yalnız kişi kartının varlığını arar). `calismaPersonelAlanYaz` çalışmada olmayan T.C. için hata vermeden hiçbir şey yazmaz.
11. `mesai.ongoru` ayarı iki yoldan yazılabilir: `mesaiAktifYaz` (`aylik.yaz`) ve genel `calismaAyarYaz` (`personel.yaz`). Zam kademesi (`zam.*`) de `calismaAyarYaz` ile `personel.yaz` yetkisiyle değişir, `zam.yaz` istemez.
12. Öngörü içindeki yıl kopyası `performans_kademe`'yi satır satır birleştirir (`INSERT OR IGNORE`, anahtar `(yil, alt_puan)`): hedef yılda farklı sınırlarla kademe varsa iki tablo karışabilir. `yilKopyala`'nın ekranda ayrı bir düğmesi yoktur (**doğrulanamadı**: başka bir çağıran olup olmadığı).
13. `grupKaydet` düzenlemede sıra boş gelirse 0 yazar (önceki sıra korunmaz).

**Yetki ve gizlilik**
14. `personelGetir` ve `personelOnDoldur` kişi kartını grup görünürlüğüne bakmadan döndürür (okuma yetkisi yeterlidir): başka gruptaki bir kişinin adı, tarihleri, bölümü ve görevi T.C. ile sorgulanabilir. Geçmiş (`personelGecmis`) ise süzülür.
15. `calismaGetir`, `grupListe` ve `yilOnayliCalismalar` grup görünürlüğüne bakmaz: görülemeyen grupların adı ve çalışma bilgileri (yıl, ad, durum) okunabilir. Kişisel veri içermez. `calismaAyarOku` yalnız grup görme ister; `dagilim.*` anahtarları T.C. listesi içerir.
16. `API.ayarYaz` (`sistem_bilgi`) dışa açıktır ve yetki denetimi yapmaz; ör. hareketsizlik süresi `oturumZamanAsimiYaz`, içe aktarma başlık sözlüğü (`aktarim.sozluk`) `aktarimSozlukYaz` atlanarak değiştirilebilir. Ekranlar bu işlevi kullanmaz. `API.log` da dışa açıktır (ekranlar `ICE_AKTAR` / `DISA_AKTAR` kayıtlarını bununla yazar); işlem kaydı tarayıcı mimarisinde değiştirilemez bir iz sayılmamalıdır.
17. `girisYap` devre dışı hesabı parola denetiminden önce bildirir: hesabın varlığı ve durumu parolasız anlaşılır. Giriş ekranındaki "Giriş yapamıyorum" bölümü kayıtlı kullanıcı adlarını oturum açmadan listeler (tasarım gereği; şifreli kurulumda bu ekrana veri parolasıyla gelinir).
18. Kullanıcının kendi parolasını değiştireceği bir ekran yoktur; API destekler (`parolaDegistir`, kendi hesabında yalnız yazma kilidi).
19. T.C. API'de maskelenmez; tarayıcı mimarisinde okuma yetkilerinin tam koruması yoktur (§10.12).

**Eşzamanlılık**
20. Tarayıcının "sekmeyi çoğalt" işlevi oturum kimliğini kopyalayabilir; iki sekme aynı anda yazar olabilir (**doğrulanamadı**, tarayıcıya bağlı; sürüm denetimi veri kaybını önler, §8.4).
21. Çıkışta kilit bırakma beklenmeden `CIKIS` kaydı ve diske yazma tetiklenir; kaydın dosyaya ulaşması, yazma işinin kilit denetiminin `KILIT.birak()`'ın ağ yanıtından önce çalışmasına bağlıdır (**doğrulanamadı**, zamanlamaya bağlı).

**Tanımlar ve performans modeli**
22. Model ya da girdi değişikliği zam hesabındaki çarpanı kendiliğinden güncellemez (`calisma_personel.performans_carpani` saklı bir değerdir); "Çarpanları uygula" yeniden çalıştırılmalıdır.
23. Model düzenlenirken kaldırılan tanımın değerleri `performans_girdi`'de kalır ve `performansGirdiYaz` o alana değer yazmayı reddeder (boş değerle silmeye izin verir); ekranda görünmedikleri için pratikte kişinin bütün değerlendirmesiyle (`performansGirdiSil`) giderler. Aynı kod ya da aynı `amirN` numarası yeniden kullanılırsa eski değerler uyarısız geri gelir.
24. Değerlendirme modeli yıl bazındadır ve o yılın bütün gruplarında ortaktır; gruba özel model için veri modelinin genişletilmesi gerekir.
25. Kayıtlı model bozuksa (`PERF.hazirla` hata verirse) `performansModeli` ve `calismaPerformansModeli` uyarmadan örnek modele döner. API yazarken denetlediği için bu yalnız veritabanının doğrudan değiştirilmesiyle olur.
26. Zam öngörüsü yuvarlama adımı 0 girilirse 10 (`js/core/hesap.js:zamHesapla`: `yv.ongoru || 10`), günlük çalışma saati 0 girilirse 7,5 sayılır; yuvarlamasız zam öngörüsü seçeneği yoktur.
27. `kanunKaydet` ve `hesapTuruKaydet`, `kural` ve `kol` değerini motorun tanıdığı listeye göre denetlemez (seçimi ekran sınırlar). Tanınmayan `kural` SSK kolunda 05510 indirimi gibi işler; tanınmayan `kol` SGK primini türün oranlarıyla hesaplar ama hiçbir teşvik almaz (`js/core/hesap.js:ayHesapla`).
28. `kanun_turu` tablosu tamamen boşaltılırsa sonraki şema yükseltmesinde başlangıç kanun türleri yeniden yazılır (`TEMEL_VERI_YAZ` yalnız boş tabloyu doldurur).
29. Personel içe aktarmada başlık tam tutmazsa adayı içeren ilk boş sütun alınır; sonuç alanların sözlükteki sırasına bağlıdır ve benzer adlı sütunlar yanlış alana eşleşebilir. Eşleşen sütunlar önizlemede kontrol edilmelidir.
