# 02 — HESAP MOTORU

Bu belge Maaş Bütçe Sistemi'nin hesap motorunun başvuru belgesidir: girdi ve parametre sözlüğü, aylık bordronun
(netten brüte) adım adım formülleri, yıllık hesap, zam motoru ve motoru başka bir dilde ya da sistemde yeniden yazanların
sonucu karşılaştırabileceği rakamlı sınama vektörleri. Bütün formüller kaynaktan (`program/js/`) okunarak yazılmıştır;
her formülün yanında `dosya.js:işlev` kaynağı verilir. Koddan kesinleştirilemeyen ya da mevzuat açısından ayrıca
değerlendirilmesi gereken noktalar §7'de toplanmıştır.

Yasal rakamlar (asgari ücret, GV tarifesi, SGK oranları, teşvik oranları, sakatlık indirimi) `data/seed.js`'teki 2026
değerleridir; her yıl resmî kaynaktan kontrol edilmelidir. Örneklerdeki kişiler ve tutarlar uydurmadır.

## İçindekiler

- [Kaynaklar, genel ilkeler, motorun kuralları](#kaynaklar-genel-ilkeler-motorun-kuralları)
- [1. Girdi sözlüğü](#1-girdi-sözlüğü)
- [2. Parametre sözlüğü](#2-parametre-sözlüğü)
- [3. Aylık bordro hesabı](#3-aylık-bordro-hesabı-adım-adım--hesapjsayhesaplap-k-g-m-devreden)
- [4. Yıllık hesap](#4-yıllık-hesap)
- [5. Zam motoru](#5-zam-motoru--hesapjszamhesaplaz-z)
- [6. Sayısal örnek ve sınama vektörleri](#6-sayısal-örnek-ve-sınama-vektörleri)
- [7. Belirsiz / doğrulanamayan noktalar](#7-belirsiz--doğrulanamayan-noktalar)

---

## Kaynaklar, genel ilkeler, motorun kuralları

Kaynak dosyalar (`program/` klasörü):

| Dosya | İçerik |
|---|---|
| `js/core/hesap.js` | Asıl motor: `parametreHazirla`, `ayHesapla`, `yilHesapla`, `zamHesapla`, `vergi`, `mround` |
| `js/core/performans.js` | Performans değerlendirmesi: modelin denetimi ve derlenmesi (`PERF.hazirla`), hesap → zam çarpanı (`PERF.hesapla`), varsayılan örnek model (`PERF.VARSAYILAN`) |
| `js/db/api.js` | Veritabanından motora köprü: `PARAMETRE_TANIM`, `hesapParametre`, `calismaHesapla`, `calismaZamKademe`, `performansCarpani`, `performansModeli` / `calismaPerformansModeli` / `performansModeliYaz`, `ayOf`, `AYLIK_SUREKLI` / `AYLIK_TEK`, `mesaiKisiBasi`, `birlesikHesapla`, `calismaPersonelKopyala`, `ongoruHesapla` |
| `js/db/schema.js` | Tablolar, varsayılan kanun türleri (`TEMEL_VERI_YAZ`), `PARAMETRE_ANLIK_AL` / `PARAMETRE_DONDUR` / `ONAY_TARIH_DONDUR` |
| `data/seed.js` | 2026 yasal parametreleri ve hesaplama türleri (`SEED_YUKLE`) |

Genel ilkeler (bütün bölümler için geçerli):

- Motor **IEEE-754 double** ile çalışır. Ara adımlarda **yuvarlama yoktur**; yalnızca iki yerde yuvarlanır: zam
  öngörüsü (`mround`, §5.2) ve BES kesintisi (`asagiYuvarla`, §3.7). Ekrandaki 2 ondalık / kuruşsuz gösterim yalnızca
  biçimdir (`js/core/bicim.js`).
- Motor veritabanını tanımaz; düz nesnelerle çalışır: `P` (yıl parametreleri), `k` (kişinin yıllık bilgisi), `g`
  (kişinin o ayki girdileri). Bu nesneleri veritabanından `api.js:calismaHesapla` kurar (§1.3, §2.6).
- Maaş **tek bir net aylık tutardır**: önceki yılın maaşı `calisma_personel.maas_eski` (motorda `k.maasEski`), zamlı
  maaş `zamHesapla` sonucunun `yeni` alanı (motorda `k.maasYeni`). Bütçe netle tutulur; brüt, SGK, vergiler ve maliyet
  netten türetilir.
- **Alan kodları.** Motorun ara değerleri iki harfli **alan kodlarıyla** adlandırılır (`AM` = net maaş, `BB` = brüt
  ücret, `CV` = brüt toplam, `DM` = toplam maliyet …). Bunlar `ayHesapla`'nın döndürdüğü nesnenin (`r`) alan adlarıdır;
  kodlar yalnız kısa addır, alfabetik sıraları kabaca hesap sırasını izler. Tam sözlük §3.12'dedir.
- **30 gün esası.** Maaş, SGK tavanı ve asgari ücret istisnası 30 günlük aya göre hesaplanır; ayın tamamı çalışılmışsa
  sigorta günü 30 sayılır (kural d).

**Motorun kuralları** (`hesap.js` dosya başı, "KURALLAR"):

| Kural | İçerik | Kodda |
|---|---|---|
| a | Giriş öncesi / çıkış sonrası ayda maaş ve bütün ek ödemeler (yol, prim, yakıt, aynî, mesai) 0'dır. | `pasifSifir` (§3.2) |
| b | Sakatlık indirimi **çalışan lehinedir**: brüt, indirimin vergi etkisi kadar yüksek hesaplanır, çalışan eline fazlasını alır; bu tutar maliyetten **düşülmez**. | `AN` (§3.5), `DM` (§3.11) |
| c | Ay içinde giren/çıkan (sigorta günü < 30): asgari ücret GV/DV istisnası gün oranında (`AR/30`). | `istOran` (§3.2) |
| d | Ayın tamamı fiilî gün sayısıyla girilmişse (Şubat 28, Ocak 31) ücret tam ay (30) sayılır. | `AR`, `UG` (§3.2) |
| e | AR-GE günü sigorta gününü aşamaz; GV teşviki hesaplanan GV'yi, DV teşviki hesaplanan DV'yi aşamaz, eksiye düşemez. | `AP` (§3.2), `DK`, `DL` (§3.10) |
| f | 05510 indirimi (05746'nın 05510 payı dahil) ve 15510 indirimi SGK tavanıyla, gün oranında sınırlı prim matrahı üzerinden hesaplanır. | `sinirli` (§3.10) |
| g | Aynî yardım işçi SGK tavan karşılaştırmasına ve BES matrahına girmez; BES tavanı sigorta günüyle. | `topEk` (§3.5), `besMatrah`, `besGun` (§3.7) |
| h | SGK prim matrahı asgari ücret tabanının (asgari / 30 × sigorta günü) altına inmez. | `taban`, `tb` (§3.4) |
| i | Yakıt yardımının damga vergisi yılın damga oranıyla. | `CR` (§3.5) |
| — | Mesai NET maaş üzerinden hesaplanır (bütçe net maaşla tutulur): saat ücreti = net maaş / 30 / günlük saat; FM1 (hafta içi) ve FM2 (hafta sonu / tatil) saatleri yılın katsayılarıyla çarpılır. | `AV` (§3.3) |

Motorda kalan sabitler: 30 günlük ay, yaka türleri (B / M), 3 sakatlık derecesi (tutarları parametredir), teşvik ve sigorta
kolu kurallarının formülleri (kanun ve hesaplama türlerinin adı ve oranı parametredir). Oranlar, katsayılar, eşikler ve
yuvarlama adımları yıl parametresidir (§2.1).

---

## 1. Girdi sözlüğü

### 1.1 Kişinin yıllık bilgisi — motor nesnesi `k` (`api.js:calismaHesapla` kurar, `hesap.js:ayHesapla` okur)

| `k` alanı | Birim | Kaynak (tablo.sütun) | Kural |
|---|---|---|---|
| `yaka` | `'B'` beyaz / `'M'` mavi | `calisma_personel.yaka` | Kayıtta yalnız B/M kabul edilir (`api.js:calismaPersonelKaydet`). Varsayılan çalışılan günü ve zam kademesini seçer. |
| `girisAy` | 0–13 | `personel.ise_giris` ya da `calisma_personel.onay_giris` | `ayOf(tarih, yil) \|\| 0` (bkz. §4.2). |
| `cikisAy` | 0–13 ya da `null` | `personel.isten_ayrilis` ya da `calisma_personel.onay_cikis` | `ayOf(tarih, yil)`; boşsa `null` = ayrılmamış. |
| `zamAyi` | 1–12 | `calisma_personel.zam_ayi` | `kp.zam_ayi \|\| 1`. Bu aydan itibaren yeni maaş geçerli. |
| `maasEski` | TL/ay, net | `calisma_personel.maas_eski` | Önceki yılın net aylık maaşı. `\|\| 0`. Zam ayından önceki aylarda ödenir. |
| `maasYeni` | TL/ay, net | zam motoru çıktısı `zam.yeni` | `maasEski + miktar` (§5). Zam ayından itibaren ödenir. |

Zam motoruna ayrıca giden kişi alanları (`calisma_personel`): `duzeltme` (TL/ay — zam öngörüsüne elle eklenen tutar),
`performans_puani`, `performans_carpani`. Bkz. §5.

`onay_sabit` (0/1/2): 0 değilse giriş/çıkış ayı `personel` kartından değil satırdaki `onay_giris` / `onay_cikis`
alanından alınır (`api.js:calismaHesapla`: `ayOf(kp.onay_sabit ? kp.onay_giris : kp.ise_giris, c.yil)`).
- `1` = çalışma ONAYLI'ya alınırken giriş/çıkış tarihleri donduruldu (`schema.js:ONAY_TARIH_DONDUR`). Kişi
  kartına sonradan yazılan çıkış onaylı maliyeti değiştirmez. Çalışma taslağa alınınca `onay_sabit = 1` satırlar
  sıfırlanır (`api.js:calismaKaydet`).
- `2` = çalışmanın kendi dönem tarihleri: kişi başka dönemde / grupta yeniden girdiğinde eski çalışma eski
  tarihlerini korur (`api.js:donemTarihleriniKoru`). Taslağa almakla silinmez.

### 1.2 Kişinin aylık girdileri — motor nesnesi `g` (ay başına bir nesne)

Aylık girdiler `aylik_girdi(calisma_id, tc_kimlik_no, ay, alan, deger)` tablosunda **yalnızca değişen ay için**
saklanır; değer metin olarak tutulur. İki tür alan vardır (`api.js`):

```
AYLIK_SUREKLI = ['hesap_turu','kanun','sakatlik_derece','ozurlu_indirimi','bes','gv_tesvik','yol','fm1','fm2','arge_gun']
AYLIK_TEK     = ['ayni','prim','yakit','calisilan_gun']
```

- **SÜREKLİ** alan: Ocak değeri kişi satırından (`calisma_personel`) gelir (`fm1`, `fm2` için 0; `arge_gun` için
  `null`). Bir ayda `aylik_girdi` kaydı varsa o aydan **itibaren** (sonraki bütün aylarda) yeni değer geçerlidir
  (devreder). Dönüşüm: `hesap_turu` ve `bes` metin kalır; `kanun` → kural kodu + oran (§1.3); diğerleri `Number(v)`.
- **TEK** alan: yalnız girildiği ay geçerlidir, devretmez. `ayni`, `prim`, `yakit` girilmemişse 0;
  `calisilan_gun` girilmemişse çalışmanın varsayılanı (`calisma_ayar` `gun.<yaka>.<ay>`), o da yoksa `null`.

| `g` alanı | Alan kodu | Birim | Kaynak / tür | Varsayılan ve kural |
|---|---|---|---|---|
| `tur` | — | hesaplama türü kodu (`SSK`/`EMK`/`SGKSIZ`…) | `hesap_turu`, sürekli | `P.turler[tur]`; tanımsızsa SGK yok, GV/DV/istisna var (§2.3). |
| `kanun` | — | **kural kodu**: `YOK`/`05510`/`05746`/`14857`/`15510` | `kanun`, sürekli | `P.kanunKural[kanunKodu] \|\| 'YOK'`. |
| `kanunOran` | — | oran | `kanun_turu.oran` | `P.kanunOran[kanunKodu]` (yoksa `undefined`). Yalnız kural `05510`'da kullanılır. |
| `sakatlikDerece` | — | 1/2/3 | `sakatlik_derece`, sürekli | |
| `ozurluIndirimi` | `AF` | TL/ay | `ozurlu_indirimi`, sürekli | Derece doluysa **`P.sakatlik[derece] \|\| 0` ile ezilir** (yılın tablosu); derece boşsa kişiye girilen tutar geçerlidir. |
| `bes` | — | `'EVET'` ya da başka | `bes`, sürekli | Yalnız `=== 'EVET'` BES keser. |
| `gvTesvik` | — | oran (0–1) | `gv_tesvik`, sürekli | AR-GE gelir vergisi teşvik oranı. `\|\| 0`. |
| `yol` | `AY` | TL/ay **net** | `yol`, sürekli | |
| `fm1` | `AT` | saat | `fm1`, sürekli | Hafta içi fazla mesai (× `P.mesaiKat1`, vars. 1,5). Mesai öngörüsü açıksa bkz. §1.3. |
| `fm2` | `AU` | saat | `fm2`, sürekli | Hafta sonu / tatil fazla mesai (× `P.mesaiKat2`, vars. 2). |
| `argeGun` | `AP` | gün | `arge_gun`, sürekli | Girilmemişse `null` → §3.2 kuralı. |
| `ayni` | `AW` | TL **net** | `ayni`, tek | Aynî yardım. |
| `prim` | `AX` | TL **net** | `prim`, tek | Prim ve diğer ödemeler. |
| `yakit` | `AO` | TL **net** | `yakit`, tek | Yakıt yardımı (yalnız damga vergisine tabi). |
| `calisilanGun` | `AQ` | gün | `calisilan_gun`, tek | `a.calisilan_gun != null ? Number(...) : varsayilanGun(yaka, ay)`; o da `null` ise motor 30 alır (§3.2). |

### 1.3 Aylık girdilerin aylara dağıtımı — `api.js:calismaHesapla` (birebir sıra)

```
surekli = { tur: kp.hesap_turu, kanun: P.kanunKural[kp.kanun] || 'YOK', kanunOran: P.kanunOran[kp.kanun],
            sakatlikDerece: kp.sakatlik_derece, ozurluIndirimi: kp.ozurlu_indirimi || 0, bes: kp.bes,
            gvTesvik: kp.gv_tesvik || 0, yol: kp.yol || 0, fm1: 0, fm2: 0, argeGun: null }
s = kopya(surekli)
for m = 1..12:
  a = aylik_girdi[kisi][m] || {}
  for al in AYLIK_SUREKLI:                       # sıra önemsiz
    if a[al] tanımsız: devam
    v = a[al]
    if al == 'kanun': s.kanunOran = P.kanunOran[v]; v = P.kanunKural[v] || 'YOK'
    elif al not in ('hesap_turu','bes'): v = Number(v)
    s[ALAN[al]] = v                              # s kalıcıdır → sonraki aylara devreder
  g = kopya(s)
  if mesaiOngoru açık:                           # calisma_ayar 'mesai.ongoru' == '1'
    o = mesaiKisiBasi(kp.yaka, kp.bolum, m)
    g.fm1 = a.fm1 tanımlı ? Number(a.fm1) : o.fm1   # öngörü devreden değeri EZER; yalnız o aya elle giriş önceliklidir
    g.fm2 = a.fm2 tanımlı ? Number(a.fm2) : o.fm2
  if g.sakatlikDerece: g.ozurluIndirimi = P.sakatlik[g.sakatlikDerece] || 0
  g.ayni = Number(a.ayni) || 0; g.prim = Number(a.prim) || 0; g.yakit = Number(a.yakit) || 0
  g.calisilanGun = a.calisilan_gun != null ? Number(a.calisilan_gun) : varsayilanGun(kp.yaka, m)
```

`varsayilanGun(yaka, m)` = `calisma_ayar['gun.' + yaka + '.' + m]` sayısı; boş/yoksa `null`.

**Mesai öngörüsü** (`api.js:mesaiKisiBasi`, yalnız `calisma_ayar 'mesai.ongoru' = '1'` iken): tablo
`mesai_ongoru(yaka, bolum, ay, alan∈{fm1,fm2,kisi})`. Anahtar = `(yaka==='M'?'M':'B') + '|' + BÜYÜK_HARF(boşlukları tekle(bolum))`
(bölüm = `personel.bolum`). `kisi = t.kisi[ay] ?? (çalışmada o yaka+bölümdeki kişi sayısı)`.
`fm1 = (yaka M ve tablo var ve kisi≠0) ? (t.fm1[ay]||0)/kisi : 0` (beyaz yakada hafta içi mesai yok);
`fm2 = (tablo var ve kisi≠0) ? (t.fm2[ay]||0)/kisi : 0`.

---

## 2. Parametre sözlüğü

### 2.1 Ham parametreler — `api.js:hesapParametre(yil, anlik)`

Kaynak: onaylı çalışmada `calisma_parametre.veri` (onay anında dondurulmuş JSON, `schema.js:PARAMETRE_ANLIK_AL`
yapısı); `anlik` yoksa yılın güncel tabloları. `anlik` yapısı:
`{ parametre:[{anahtar,deger}], dilim:[gv_dilim satırları], asgari:[asgari_ucret], tur:[hesap_turu], kanun:[kanun_turu], sakatlik:[sakatlik_derece], performans:[performans_kademe] }`.
(Kanun türleri yıla bağlı değildir; diğerleri yıla bağlıdır.) Onaylı çalışma böylece hep onay anındaki parametrelerle
hesaplanır: yeni yılın yasal rakamları sonradan girilse de onaylı maliyet değişmez.

`parametre` tablosundan sayı okuma: `parametreSayi(o, anahtar, vars)` = değer `undefined/null/''` ise `vars`, değilse `Number(deger)`.

| Motor alanı | Anahtar / tablo | Varsayılan | 2026 (`data/seed.js`) | Anlam |
|---|---|---|---|---|
| `yil` | — | — | 2026 | |
| `dilimler` | `gv_dilim(yil, sira, ust_sinir, oran)` → `[{ust, oran}]` sıra ile | yoksa **hata** | 190.000 %15 · 400.000 %20 · 1.500.000 %27 · 5.300.000 %35 · ∞ %40 | Son dilim `ust = null` (sınırsız). Kümülatif matraha uygulanır. |
| `asgariUcret` | `asgari_ucret(yil, baslangic_ay, brut)` → `[{ay, brut}]` | yoksa **hata** | Ocak 33.030 | Ocak'tan geçerli bir kayıt zorunlu (`asgariYaz`). Yıl içi ara dönem (örn. Temmuz) ayrı satır. |
| `tavanCarpan` | `tavan_carpan` | 9 | 9 | SGK tavanı = asgari × çarpan. |
| `dv` | `dv` | 0,00759 | 0,00759 | Damga vergisi oranı. |
| `besOrani` | `bes_orani` | 0,03 | 0,03 | Otomatik katılım BES oranı. |
| `istisnaKesinti` | `istisna_kesinti` | 0,15 | 0,15 | Asgari ücretin GV matrahı = brüt × (1 − bu oran) (SGK %14 + işsizlik %1). |
| `argeGun` | — (yıl parametresi değildir) | **0** | — | `hesapParametre` her zaman 0 kurar; çalışma ayarı `arge_gun` ezer (§2.6). |
| `argeEsik` | `arge_gv_esik` | 0,8 | — (varsayılan) | Kişiye AR-GE günü girilmemişse çalışmanın AR-GE günü yalnız `gvTesvik ≥ argeEsik` olan kişiye uygulanır (§3.2). |
| `mesaiKat1` | `mesai_fm1_kat` | 1,5 | — (varsayılan) | Hafta içi fazla mesai katsayısı (§3.3). |
| `mesaiKat2` | `mesai_fm2_kat` | 2 | — (varsayılan) | Hafta sonu / tatil mesaisi katsayısı (§3.3). |
| `gunlukSaat` | `mesai_gun_saat` | 7,5 | — (varsayılan) | Saat ücretinde günlük çalışma saati: saat ücreti = net maaş / 30 / `gunlukSaat` (§3.3). |
| `zamYuvarla` | `zam_yuvarla` | 10 | — (varsayılan) | Zam öngörüsü yuvarlama adımı (TL); çalışma ayarı `zam.yuvarla_ongoru` önceliklidir (§5.1). `parametreHazirla`'dan sonra `P`'ye eklenir. |
| `turler` | `hesap_turu` (yıl) | — | bkz. §2.3 | |
| `tesvik.k05510` | `t05510` | 0,02 | 0,02 | 05510 indirimi varsayılan oranı (kanun türünde oran yoksa). |
| `tesvik.k05746` | `t05746` | 0,09875 | 0,1975 / 2 | 05746 AR-GE SGK teşviki oranı (işveren %19,75 × ½). |
| `tesvik.k14857` | `t14857` | 0,1975 | 0,1975 | 14857 engelli teşviki oranı. |
| `tesvik.k15510` | `t15510` | 0,05 | 0,05 | 15510 (SGDP) indirimi. |
| `kanunKural` | `kanun_turu.kural` | — | bkz. §2.4 | kanun kodu → kural kodu |
| `kanunOran` | `kanun_turu.oran` | `null` | bkz. §2.4 | kanun kodu → 05510 oranı |
| `zamKademe` | `zam.M.*`, `zam.B.*` | `api.js:ZAM_TANIM` (§5.1) | 50.000 / 100.000 / 0,30 / 0,25 (iki yaka) | Zam kademesi; çalışma ayarı ezer. |
| `performans` | `performans_kademe(yil, alt_puan, ust_puan, carpan)` satırları | `[]` | — (boş) | Puan → çarpan tablosu (§5.3). |
| `sakatlik` | `sakatlik_derece(yil, derece, tutar)` → `{derece: tutar}` | `{}` | 1: 12.000 · 2: 7.000 · 3: 3.000 | Aylık sakatlık indirimi tutarı. |
| `dondurulmus` | — | — | | `anlik` verildiyse `true` (yalnız bilgi). |

`parametre` tablosundaki `durum` anahtarı (`RESMI` / `ONGORU`) yalnız bilgidir; motor okumaz. Aynı tabloda yılın
performans değerlendirme modeli de durur (`perf.model`, JSON); onu motor değil `api.js:performansModeli` okur (§5.3).
Ekranın çizdiği genel parametre listesi `api.js:PARAMETRE_TANIM`'dır (anahtar, ad, birim, varsayılan).

Varsayılanlar `hesap.js:ayHesapla`'da da tekrarlanır (alan `P`'de yoksa): `argeEsik`, `mesaiKat1`, `mesaiKat2` için
`P.x == null ? varsayılan : P.x` (0 geçerli değerdir); `gunlukSaat` için `P.gunlukSaat || 7.5` (0 da 7,5 sayılır).
Yuvarlama adımında da 0 girilirse 10 kullanılır (`zamHesapla`: `yuvarla.ongoru || 10`).

Bütün yıl parametreleri (`perf.model` dahil) yeni yıla `api.js:yilKopyalaIc` ile kopyalanır (hedefte olan anahtara
dokunulmaz) ve onaylı çalışmada `calisma_parametre` anlık görüntüsüyle dondurulur.

### 2.2 Türetilen aylık tablolar — `hesap.js:parametreHazirla(ham)`

`P = kopya(ham)`; `au = asgariUcret` aya göre sıralı. Her `m = 1..12` için:

```
auAy(m)          = au[0].brut ile başla; ay <= m olan her kayıt için b = kayıt.brut   (son geçerli dönem)
P.asgari[m]      = auAy(m)
P.tavan[m]       = P.asgari[m] × (ham.tavanCarpan || 9)
kum             += P.asgari[m] × (1 − (ham.istisnaKesinti ?? 0.15))       # kümülatif asgari GV matrahı
P.istGV[m]       = vergi(kum, dilimler) − vergi(kum_önceki_ay, dilimler)  # asgari ücret GV istisnası (aylık artış)
P.istDV[m]       = P.asgari[m] × ham.dv                                   # asgari ücret DV istisnası
P.istMatrahDV[m] = P.asgari[m]                                            # DV istisnasının matrahı (AR-GE DV teşvikinde)
P.gun[m]         = ayın takvim gün sayısı (yil, m)                        # 28–31
```

2026 değerleriyle: `asgari = 33.030`, `tavan = 297.270`, `tavanG = tavan / 30 = 9.909`, `istDV = 250,6977` (her ay).
Kümülatif asgari matrahı aylık `33.030 × 0,85 = 28.075,50` artar; `istGV` Ocak–Haziran `28.075,50 × 0,15 = 4.211,325`,
Temmuz `4.537,75` (kümülatif 196.528,50 ile 190.000'i geçer), Ağustos–Aralık `28.075,50 × 0,20 = 5.615,10`.

**Gelir vergisi tarifesi** — `hesap.js:vergi(matrah, dilimler)` (kümülatif matrahın toplam vergisi):
```
alt = 0; t = 0
for d in dilimler:
  ust = d.ust ?? +∞
  if matrah <= ust: return t + (matrah − alt) × d.oran
  t += (ust − alt) × d.oran; alt = ust
return t + (matrah − alt) × son_dilim.oran
```
`dilimOrani(matrah, dilimler)` = `matrah <= ust` koşulunu ilk sağlayan dilimin oranı (yoksa son dilim); yalnız `AN`
(sakatlık indiriminin vergi etkisi) hesabında kullanılır.

### 2.3 Hesaplama türleri — `hesap_turu` (yıl bazında) → `P.turler[kod]`

`{ kol, sgkIsci, issizlikIsci, sgkIsveren, issizlikIsveren, gv: !!, dv: !!, istisna: !! }`

| Kod | Ad | `kol` | SGK işçi | İşsizlik işçi | SGK işveren | İşsizlik işveren | gv | dv | istisna |
|---|---|---|---|---|---|---|---|---|---|
| `SSK` | SSK (4/a — tüm sigorta kolları) | `SSK` | 0,14 | 0,01 | 0,2175 | 0,02 | 1 | 1 | 1 |
| `EMK` | Emekli (SGDP) | `SGDP` | 0,075 | 0 | 0,2475 | 0 | 1 | 1 | 1 |
| `SGKSIZ` | SGK'sız (huzur hakkı / danışman) | `YOK` | 0 | 0 | 0 | 0 | 1 | 1 | 1 |

(Değerler `data/seed.js` 2026 kaydıdır; yeni yıl `api.js:yilKopyalaIc` ile kopyalanır ve Parametreler'den değiştirilebilir.)

- `kol = 'YOK'` ya da tür seçilmemiş (`P.turler[g.tur]` yok) → SGK hesaplanmaz.
- Tür seçilmemişse oranlar 0, `gv = dv = istisna = true` kabul edilir (`hesap.js:ayHesapla`:
  `oran = tur || {…0…, gv:1, dv:1, istisna:1}`, `gvVar = !tur || tur.gv` …).
- `gv = 0` → gelir vergisi 0; `dv = 0` → damga vergisi 0; `istisna = 0` → asgari ücret GV/DV istisnası 0.

### 2.4 Kanun (teşvik) türleri — `kanun_turu` (yıldan bağımsız) — `schema.js:TEMEL_VERI_YAZ`

| Kod | Ad | `kural` | `oran` | Açıklama |
|---|---|---|---|---|
| `YOK` | TABİ DEĞİL | `YOK` | — | Teşvik yok |
| `05510` | 05510 - %2 | `05510` | 0,02 | İşveren SGK payında 2 puan indirim (imalat dışı) |
| `05510-5` | 05510 - %5 | `05510` | 0,05 | 5 puan indirim (imalat) |
| `05746` | 05746 - ARGE | `05746` | — | AR-GE: işveren SGK payının yarısı + 05510 indirimi |
| `14857` | 14857 - ENGELLİ %100 | `14857` | — | Engelli: asgari ücret üzerinden işveren payı |
| `15510` | 15510 - %5 | `15510` | — | Emekli (SGDP) çalışanda %5 indirim |

Bu varsayılan türler yalnız `kanun_turu` tablosu boşken yazılır; türler Tanımlar'dan eklenip değiştirilebilir, silinen
tür kendiliğinden geri gelmez. Motor **kural koduna** bakar; ad ve oran serbesttir, kural kodları (`YOK`, `05510`,
`05746`, `14857`, `15510`) ve formülleri kodda sabittir. `kanunOran` yalnız `kural = '05510'` olan türde kullanılır.

### 2.5 Çalışmaya özel ayarlar — `calisma_ayar` (`api.js:calismaHesapla`, `calismaZamKademe`)

| Anahtar | Etki | Yeni yıla taşınır mı (`calismaPersonelKopyala` `YENI_YIL`) |
|---|---|---|
| `zam.<M\|B>.alt_esik` / `ust_esik` / `ust_oran` / `alt_oran` | Yılın zam kademesini bu çalışma için ezer (§5.1). | Evet |
| `zam.yuvarla_ongoru` | Zam öngörüsünün yuvarlama adımı (TL; boş = yılın `zam_yuvarla` parametresi). | Evet |
| `arge_gun` | `P.argeGun` (yoksa 0). Kişiye girilmiş AR-GE günü yoksa ve `gvTesvik ≥ P.argeEsik` ise kullanılır (§3.2). | Hayır (o yılın kararıdır) |
| `tesvik.k05510` / `k05746` / `k14857` / `k15510` | `P.tesvik` oranlarını ezer (ör. imalat işyerinde 05510 %5). | Yalnız `tesvik.k05510` (işyerinin niteliği) |
| `gun.<M\|B>.<ay>` | O yaka ve ay için varsayılan çalışılan gün (`AQ`). | Hayır |
| `mesai.ongoru` | `'1'` ise mesai, bölüm × ay öngörü tablosundan gelir (§1.3). | Evet |

Revize (`KOPYA`) bütün ayarları birebir kopyalar. Kayıt yoksa yılın parametresi geçerlidir.

### 2.6 `calismaHesapla` içinde parametreye yapılan son düzeltmeler (sırayla)

```
P = hesapParametre(c.yil, c.durum == 'ONAYLI' ? calismaParametreAnlik(id) : null)   # P.argeGun = 0
if secenek.dilimler:                                     # GV tarifesini bu hesap için değiştirir (karşılaştırma)
  P.dilimler = secenek.dilimler; Object.assign(P, parametreHazirla(P + {dilimler}))
ayar = calisma_ayar(id)
if ayar.arge_gun dolu: P.argeGun = Number(ayar.arge_gun)
P.tesvik = kopya(P.tesvik); her k in [k05510,k05746,k14857,k15510]: ayar['tesvik.'+k] doluysa ez
Z.yuvarla.ongoru = ayar['zam.yuvarla_ongoru'] dolu ? Number(…) : P.zamYuvarla     # §5.1
```
`calismaParametreAnlik(id)` dondurulmuş kayıt yoksa `null` döner; o zaman yılın güncel tabloları kullanılır.

### 2.7 Yasal parametre öngörüsü (bilgi) — `api.js:ongoruHesapla`

Yeni yılın resmî rakamları açıklanmadan önce bütçe bir artış oranıyla hazırlanabilir:
asgari Ocak = `yuvarla(önceki yılın SON dönem brütü × (1 + oranAsgari))`
(`yuvarla(x, adim)` = `adim ? Math.round(x/adim)×adim : Math.round(x×100)/100`); ara artış verilirse
`yuvarla(ocak × (1 + araOran))` `araAy`'dan (> 1) geçerli; GV dilim üst sınırları `yuvarla(ust × (1 + oranDilim), dilimAdim)`
(oranlar aynı, son dilim sınırsız kalır); sakatlık tutarları `yuvarla(tutar × (1 + oranSakatlik), sakatlikAdim)`.
`oranAsgari`, `oranDilim`, `oranSakatlik` verilmezse ortak `oran` kullanılır. Tavan ve istisnalar asgariden türediği için
kendiliğinden değişir. Kaynak yılda dilim ya da sakatlık tablosu yoksa hata verir; onaylı çalışması olan hedef yıla
uygulanamaz (`ongoruUygula`). Uygulanan yıl `durum = 'ONGORU'` olarak işaretlenir.

---

## 3. Aylık bordro hesabı (adım adım) — `hesap.js:ayHesapla(P, k, g, m, devreden)`

`devreden` = önceki ayın kümülatif GV matrahı (`CK`); Ocak'ta 0. Dönüş nesnesi `r` bütün ara değerleri taşır.

### 3.1 Tür, SGK/GV/DV/istisna bayrakları

```
tur    = P.turler[g.tur] || null
sgkVar = !!(tur && tur.kol != 'YOK')
kol    = tur ? tur.kol : 'YOK'
oran   = tur || {sgkIsci:0, issizlikIsci:0, sgkIsveren:0, issizlikIsveren:0, gv:1, dv:1, istisna:1}
gvVar  = !tur || tur.gv ;  dvVar = !tur || tur.dv ;  istVar = !tur || tur.istisna
D      = P.dilimler ;  dvO = P.dv
tavan  = P.tavan[m] ;  tavanG = tavan / 30
```

### 3.2 Çalışma durumu, maaş, günler

```
aktif      = !(k.cikisAy != null && k.cikisAy < m) && !(k.girisAy > m)
zamli      = k.zamAyi <= m
pasifSifir = !aktif                                          # kural (a)

AM   = aktif ? (zamli ? k.maasYeni : k.maasEski) : 0         # NET MAAŞ
AF   = g.ozurluIndirimi || 0                                 # özürlü (sakatlık) indirimi, aylık TL
argeEsik = P.argeEsik ?? 0.8
r.AP = g.argeGun != null ? g.argeGun : ((g.gvTesvik || 0) < argeEsik ? 0 : P.argeGun)   # AR-GE GÜN (ham)
AQ   = g.calisilanGun != null ? g.calisilanGun : ((k.yaka == 'B' || k.yaka == 'M') ? 30 : 0)   # ÇALIŞILAN GÜN
AR   = (AQ == P.gun[m]) ? 30 : AQ                            # SİGORTA GÜN — kural (d)
AO = pasifSifir ? 0 : (g.yakit || 0)                         # yakıt yardımı (net)
AT = pasifSifir ? 0 : (g.fm1 || 0)                           # FM1 saat
AU = pasifSifir ? 0 : (g.fm2 || 0)                           # FM2 saat
AW = pasifSifir ? 0 : (g.ayni || 0)                          # aynî yardım (net)
AX = pasifSifir ? 0 : (g.prim || 0)                          # prim (net)
AY = pasifSifir ? 0 : (g.yol || 0)                           # yol (net)
UG = AR                                                      # ücret günü
AP = min(r.AP, AR)                                           # kural (e): AR-GE günü sigorta gününü aşamaz
istOran     = min(AR, 30) / 30                               # kural (c)
istGV       = istVar ? P.istGV[m] × istOran : 0
istDV       = istVar ? P.istDV[m] × istOran : 0
istMatrahDV = P.istMatrahDV[m] × istOran                     # DİKKAT: istVar'a bağlı değil
```

**AR-GE günü kuralı.** `AP` önce kişiye girilen `arge_gun`'dan gelir (sürekli alan — Ocak'a yazılan bütün yıla geçer).
Girilmemişse: `gvTesvik < P.argeEsik` (yıl parametresi `arge_gv_esik`, vars. 0,8) ise 0, değilse `P.argeGun` (çalışma
ayarı `arge_gun`; yoksa 0). Yani varsayılan yoktur: AR-GE günü ya kişiye ya çalışmaya girilir; çalışmaya girilen gün
yalnız GV teşvik oranı eşiğe ulaşan kişiye geçer, kişiye girilen gün eşikten bağımsızdır. Hesapta kullanılan `AP` sigorta günüyle sınırlıdır; dönüş nesnesindeki
`r.AP` ise sınırlanmamış ham değerdir.

**Giriş/çıkış ayı.** Etki **ay düzeyindedir**: giriş ayı ve çıkış ayı `aktif` sayılır ve tam ay (`AQ` varsayılan 30)
hesaplanır. Tarihin gün kısmı ne motorda ne `calismaHesapla`'da kullanılır; kısmi ay için o aya `calisilan_gun`
girilmelidir. Girişten önceki ve çıkıştan sonraki aylarda maaş ve bütün ek ödemeler 0'dır (kural a). Kısmi ayda maaş
gün oranındadır (`AM/30×UG`), ek ödemeler (yol, prim, aynî, yakıt) ise girilen tutarla tam yazılır (bkz. §6.4 kişi F).

### 3.3 Net ödeme bileşenleri (bilgi alanları)

```
AS = hata0(AM/30×UG) + AO                                         # TOPLAM ÜCRET ÖDEMESİ
saat = P.gunlukSaat || 7.5 ;  kat1 = P.mesaiKat1 ?? 1.5 ;  kat2 = P.mesaiKat2 ?? 2
AV = hata0(AM/30/saat×kat1×AT + AM/30/saat×kat2×AU)               # TOPLAM MESAİ (net)
AZ = AY + AX + AO                                                 # TOPLAM EK ÖDEME
BA = AZ + AV + AS                                                 # TOPLAM NET ÖDEME (yalnız gösterim)
netUcret = hata0(AM/30×UG)
```
`hata0(x)` = `x` sonlu sayı değilse 0 (sıfıra bölme gibi durumlar). Mesai NET maaş (`AM`) üzerinden: saat ücreti
`AM / 30 / gunlukSaat`, hafta içi × `mesaiKat1`, hafta sonu/tatil × `mesaiKat2` (varsayılanlarla `AM / 225`, ×1,5, ×2).
Mesai, kısmi ayda da tam ay maaşının saat ücretiyle hesaplanır (`AM`, `UG` ile oranlanmaz). Gözlem: `AO` hem `AS`'de hem `AZ`'de olduğundan `BA`'da iki kez
sayılır; `BA` hiçbir hesaba girmez (§7).

### 3.4 SGK tabanı ve yardımcı işlevler

```
taban = AM == 0 ? 0 : P.asgari[m]/30 × AR                         # kural (h): SGK prim matrahı tabanı
tb(x) = x < taban ? taban : x
pos(x) = x < 0 ? 0 : x

sgkUcret(brut, o):                                  # BC/BD — ücretin SGK'sı, tavan üstü kesilmez
  if !sgkVar: 0
  brut = tb(brut)
  hata0( brut/AR < tavanG ? brut×o : o×tavan/30×AR )

sgkMesai(mesai, ucret, onceki, o):                  # BN/BO — tavana kalan pay kadar
  if !sgkVar: 0
  hata0( (mesai + tb(ucret))/AR < tavanG ? mesai×o : o×tavan/30×AR − onceki )

sgkEk(ek, toplam, onceki, o):                       # CG/CH
  if !sgkVar: 0
  if AR == 0: toplam < tavan ? ek×o : o×tavan
  (toplam/AR) < tavanG ? ek×o : o×tavan/30×AR − onceki

ortOran(onceki, sonraki) = hata0( (vergi(sonraki) − vergi(onceki)) / (sonraki − onceki) )   # BJ/BU/CC/CN
artakalan(onceki, bu)    = pos( onceki < 0 ? bu + onceki : bu )   # istisnanın tüketilmeyen kısmı sonraki kaleme düşer
```

### 3.5 Netten brüte: sabit nokta yinelemesi

Brüt kendine bağlıdır (`BB = net + SGK(BB) + GV(BB) + DV(BB)`). Motor bu eşitliği **Jacobi tipi sabit nokta
yinelemesi** ile çözer. Beş döngüsel brüt + sakatlık etkisi:

| Alan kodu | Anlam |
|---|---|
| `BB` | BRÜT ÜCRET |
| `BM` | brüt mesai |
| `BX` | brüt aynî |
| `CF` | brüt ek ödeme (yol + prim) |
| `CQ` | brüt ek ödeme 2 (yakıt) |
| `AN` | sakatlık indiriminin vergi etkisi (çalışana verilir — kural b) |

Başlangıç: hepsi 0. En çok 2000 tur. Her turda `s` yeniden, **bir önceki turun** `BB, BM, BX, CF, CQ` değerleriyle hesaplanır:

```
# --- Ücret ---
BC = sgkUcret(BB, oran.sgkIsci)                              # SGK işçi (ücret)
BD = sgkUcret(BB, oran.issizlikIsci)                         # işsizlik işçi (ücret)
BE = hata0(pos(BB − BC − BD − AF/30×AR))                     # ücret GV matrahı (sakatlık indirimi düşülmüş)
BF = devreden                                                # önceki kümülatif matrah
BG = BE + BF
BH = vergi(BF); BI = vergi(BG)
BJ = gvVar ? ortOran(BF, BG) : 0
gvU = hata0(BJ×BE) − istGV
BK = pos(gvU)                                                # GV (ücret)
dvU = dvVar ? hata0(BB×dvO) − istDV : −istDV
BL = dvVar ? pos(dvU) : 0                                    # DV (ücret)
# --- Mesai ---
BN = sgkMesai(BM, BB, BC, oran.sgkIsci)
BO = sgkMesai(BM, BB, BD, oran.issizlikIsci)
BP = BM − BN − BO                                            # mesai GV matrahı
BQ = BG; BR = BP + BQ
BU = gvVar ? ortOran(BQ, BR) : 0
BV = artakalan(gvU, hata0(BU×BP))                            # GV (mesai)
gvM = hata0(BU×BP) + hata0(BJ×BE) − istGV
BW = dvVar ? artakalan(dvU, hata0(BM×dvO)) : 0               # DV (mesai)
dvM = hata0(BM×dvO) + hata0(BB×dvO) − istDV
# --- Aynî (SGK'ya tabi değil) ---
BY = BR; BZ = BY + BX
CC = gvVar ? ortOran(BY, BZ) : 0
CD = artakalan(gvM, hata0(BX×CC))                            # GV (aynî)
gvA = hata0(BX×CC) + gvM
CE = dvVar ? artakalan(dvM, hata0(BX×dvO)) : 0               # DV (aynî)
dvA = hata0(BX×dvO) + dvM
# --- Ek ödeme (yol + prim) ---
topEk = CF + BM + tb(BB)                                     # kural (g): aynî tavan karşılaştırmasına girmez
CG = sgkEk(CF, topEk, BC + BN, oran.sgkIsci)
CH = sgkEk(CF, topEk, BD + BO, oran.issizlikIsci)
CI = CF − CG − CH                                            # ek ödeme GV matrahı
CJ = BZ; CK = CJ + CI                                        # KÜMÜLATİF MATRAH (sonraki aya devreder)
CN = gvVar ? ortOran(CJ, CK) : 0
CO = artakalan(gvA, hata0(CN×CI))                            # GV (ek)
CP = dvVar ? artakalan(dvA, hata0(CF×dvO)) : 0               # DV (ek)
dvE = hata0(CF×dvO) + dvA
# --- Ek ödeme 2 (yakıt): yalnız damga; SGK ve GV yok — kural (i) ---
CR = dvVar ? artakalan(dvE, hata0(CQ×dvO)) : 0
# --- Sakatlık indiriminin vergi etkisi — kural (b) ---
yeniAN = AM == 0 ? 0 : hata0(dilimOrani(CK) × AF/30 × UG)

# --- Yeni brütler ---
yBB = hata0(netUcret + BC + BD + BK + BL + yeniAN)
yBM = hata0(AV + BN + BO + BV + BW)
yBX = hata0(AW + CD + CE)
yCF = hata0(AZ − AO + CG + CH + CO + CP)                     # = yol + prim + kesintiler
yCQ = hata0(AO + CR)
fark = |yBB−BB| + |yBM−BM| + |yBX−BX| + |yCF−CF| + |yCQ−CQ| + |yeniAN−AN|
BB,BM,BX,CF,CQ,AN = yBB,yBM,yBX,yCF,yCQ,yeniAN
if fark < 1e-9 × max(1, |BB| + |CF|): r.tur = tur+1; dur           # BB, CF burada YENİ değerler
```

Yakınsamazsa `r.yakinsamadi = true` (beklenmez; ekranlar uyarı gösterebilir). Döngü bitince `r`'ye son turun `s`
değerleri (yani **bir önceki turun brütleriyle** hesaplanmış kesintiler) ve son brütler (`BB…CQ`, `AN`) yazılır.
Sonraki bütün adımlar (toplamlar, işveren payı, teşvikler) son brütlerle hesaplanır.

`AN`, kümülatif matrahın (`CK`) düştüğü dilimin **marjinal oranıyla** hesaplanır: ilk dilimdeki kişide
`AN = 0,15 × AF`, yani indirimin GV etkisi brüte eklenir; brüt değişmez, çalışanın neti `AN` kadar artar (§6.4 kişi E).

**Hassasiyet notu.** Durma ölçütü göreli olduğundan sonuç kesin sabit noktadan ~10⁻⁵ TL sapabilir; örn. §6.2 Ocak:
kesin `BB = 63.697,49660796` (kapalı form), motor `63.697,49659132` (17 tur). Fark kuruşun çok altındadır; kuruş düzeyinde
aynı sonuç için yinelemeyi bu sırayla (başlangıç 0, Jacobi, aynı ölçüt) kurmak yeterli ve en güvenli yoldur. Kapalı form
yalnız tek dilim, tavan altı, ek ödemesiz, sakatlıksız durumda kolaydır:
`BB = (net − istGV − istDV) / (1 − sgk − işsizlik − r×(1 − sgk − işsizlik) − dv)` (r = dilim oranı).
Dilim geçişinde ve tavanda kapalı form parçalıdır; motor bunu kullanmaz.

### 3.6 Toplamlar

```
CV = CF + BB + BX + BM + CQ                 # BRÜT TOPLAM
CW = BC + CG + BN                           # SSK İŞÇİ
CX = BD + CH + BO                           # İŞSİZLİK İŞÇİ
CY = CO + CD + BK + BV                      # TOPLAM GELİR VERGİSİ
DA = CP + CE + BL + BW + CR                 # TOPLAM DAMGA VERGİSİ
```

### 3.7 BES (otomatik katılım) — `DC`

```
besMatrah = BB + CF + BM                    # kural (g): aynî girmez
besGun    = AR
DC = g.bes == 'EVET'
   ? asagiYuvarla( besGun == 0
       ? (besMatrah < tavan ? besMatrah×besOrani : tavan×besOrani)
       : (besMatrah/besGun < tavanG ? besMatrah×besOrani : tavanG×besGun×besOrani) )
   : 0
```
`asagiYuvarla(x)` = sıfıra doğru tam sayıya (`x<0 ? ceil : floor`). BES netten kesilir; brüte eklenmez (döngüye
girmez), maliyeti değiştirmez.

### 3.8 Net ödeme — `DD`

```
DD = CV − CW − CX − CY − DA − AW − DC
```
Aynî (`AW`) parayla ödenmediği için düşülür. `DD`, teşvik öncesi `CY` / `DA` ile hesaplanır (teşvik çalışanın netini
değiştirmez). Sakatlık etkisi `AN` brütte olduğundan net ödemeye eklenmiş olur. Sonuç olarak tam ayda
`DD = AM + AV + AY + AX + AO − DC + AN` olur (kişi B: `30.000 + 4.133,33 + 2.000 − 1.329 = 34.804,33`).

### 3.9 İşveren payları — `DE`, `DF`

```
isveren(o):
  if !sgkVar: 0
  mat = BM + CF + tb(BB)                                    # aynî ve yakıt işveren matrahına girmez
  hata0( AR == 0 ? (CF > tavan ? tavan×o : o×CF)
                 : (mat/AR > tavanG ? tavanG×AR×o : o×mat) )
DE = isveren(oran.sgkIsveren)      # SGK işveren
DF = isveren(oran.issizlikIsveren) # işsizlik işveren
```

### 3.10 Teşvikler

```
T = P.tesvik ; kn = g.kanun || ''           # kn = kural kodu
sgkMatrah = tb(BB) + CF + BM
sinirli   = AR == 0 ? min(CF, tavan) : min(sgkMatrah, tavanG×AR)     # kural (f): tavanla, gün oranında sınırlı matrah
DG = DH = DI = DJ = DK = DL = 0
```

**05510 — işveren payı indirimi (`DG`).** Koşul: `aktif && sgkVar && kol == 'SSK' && kn && kn != 'YOK'` — yani SSK'lı
**her** teşvik kuralında (05510, 05746, 14857) uygulanır; 15510 SGDP olduğu için girmez.
```
o5510 = (kn == '05510' && g.kanunOran != null) ? g.kanunOran : T.k05510
DG    = sinirli × o5510
```
Öncelik: kural 05510 olan türde `kanun_turu.oran` (0,02 / 0,05); öteki kurallarda (05746, 14857) ya da oranı boş türde
`T.k05510` (yıl parametresi `t05510`, çalışma ayarı `tesvik.k05510` ile ezilebilir).

**14857 — engelli (`DH`).** Koşul: `aktif && sgkVar && kol == 'SSK' && kn == '14857'`.
```
DH = P.asgari[m] × T.k14857 / 30 × AR
```
(Kişinin brütünden bağımsız; asgari ücret üzerinden. `DG` de ayrıca uygulanır.)

**15510 — SGDP (`DI`).** Koşul: `aktif && sgkVar && kol == 'SGDP' && kn == '15510'`.
```
DI = sinirli × T.k15510
```

**05746 — AR-GE SGK teşviki (`DJ`).** Koşul: `aktif && sgkVar && kol == 'SSK' && kn == '05746'`.
```
bb = tb(BB)
DJ = hata0( bb/AR < tavanG ? bb × T.k05746 / AR × AP
                           : tavanG × AR × T.k05746 / AR × AP )
```
Yalnız brüt ücret (mesai ve ek ödeme hariç), AR-GE günü / sigorta günü oranında. `DG` (05510 payı) ayrıca uygulanır.

**AR-GE GV ve DV teşviki (`DK`, `DL`).** Koşul: `aktif && gvT > 0` (`gvT = g.gvTesvik || 0`) — kanundan ve SGK'dan bağımsız.
```
CM = vergi(CK)
v  = hata0( ((CI + BX + BE) × (CM − BH) / (CK − BF) / AR × AP − istGV) × gvT )
dl = hata0( ((BB + BX + CF + CQ) / AR × AP − istMatrahDV) × dvO )
DK = min(pos(v), CY)                        # kural (e)
DL = min(pos(dl), DA)                       # kural (e)
```
Formüldeki kesin ayrıntılar (kod böyledir; mevzuata uygunluğu §7'de):
- GV teşvik matrahı `CI + BX + BE` — **mesai matrahı (`BP`) girmez**; oran ise ayın bütün matrahının ortalama oranıdır
  (`(CM−BH)/(CK−BF)`).
- `istGV` AR-GE günü oranıyla (`AP/AR`) ölçeklenmez, tam düşülür (kısmi ayda zaten `AR/30` oranındadır).
- DV teşviki matrahı `BB + BX + CF + CQ` — **brüt mesai (`BM`) girmez**; `gvT` ile **çarpılmaz** (teşvik oranı ne olursa
  olsun DV teşviki tam).
- `istMatrahDV`, hesap türünde `istisna = 0` olsa da düşülür.

```
CZ = CY − DK        # ÖDENECEK GELİR VERGİSİ
DB = DA − DL        # ÖDENECEK DAMGA VERGİSİ
```
(`r.CM` yalnız `gvT > 0` iken atanır.)

### 3.11 Toplam maliyet — `DM`

```
DM = CV + DE + DF − DG − DH − DI − DJ − DK − DL
```
Kural (b): sakatlık etkisi `AN` çalışana ödendiği için brütte (`CV`) kalır, maliyetten düşülmez. BES (`DC`) çalışanın
netinden kesildiği için maliyeti değiştirmez.

### 3.12 Alan kodu sözlüğü

`ayHesapla` dönüş nesnesinin (`r`) alanları. Ayrıca `r.tur` (yakınsama tur sayısı) ve `r.yakinsamadi` vardır.

| Kod | Anlam | | Kod | Anlam |
|---|---|---|---|---|
| `AF` | özürlü (sakatlık) indirimi, aylık TL (yalnız iç değişken) | | `BW` | DV (mesai) |
| `AM` | NET MAAŞ | | `BX` | brüt aynî |
| `AN` | sakatlık indiriminin vergi etkisi (çalışana) | | `BY`, `BZ` | kümülatif matrah (aynî öncesi / sonrası) |
| `AO` | yakıt yardımı, net (yalnız iç değişken) | | `CC` | ortalama oran (aynî) |
| `AP` | AR-GE günü (ham; hesapta `min(AP, AR)`) | | `CD`, `CE` | GV / DV (aynî) |
| `AQ` | çalışılan gün | | `CF` | brüt ek ödeme (yol + prim) |
| `AR` | SİGORTA GÜN | | `CG`, `CH` | SGK / işsizlik işçi (ek ödeme) |
| `AS` | TOPLAM ÜCRET ÖDEMESİ | | `CI` | ek ödeme GV matrahı |
| `AT`, `AU` | FM1, FM2 saat (yalnız iç değişken) | | `CJ` | kümülatif matrah (ek ödeme öncesi) |
| `AV` | TOPLAM MESAİ (net) | | `CK` | KÜMÜLATİF GV MATRAHI (sonraki aya devreder) |
| `AW`, `AX`, `AY` | aynî, prim, yol — net (yalnız iç değişken) | | `CM` | `vergi(CK)` (yalnız AR-GE GV teşvikinde) |
| `AZ` | TOPLAM EK ÖDEME | | `CN` | ortalama oran (ek ödeme) |
| `BA` | TOPLAM NET ÖDEME (gösterim) | | `CO`, `CP` | GV / DV (ek ödeme) |
| `BB` | BRÜT ÜCRET | | `CQ` | brüt ek ödeme 2 (yakıt) |
| `BC` | SGK işçi (ücret) | | `CR` | DV (yakıt) |
| `BD` | işsizlik işçi (ücret) | | `CV` | BRÜT TOPLAM |
| `BE` | ücret GV matrahı | | `CW` | SSK İŞÇİ (toplam) |
| `BF` | devreden kümülatif matrah | | `CX` | İŞSİZLİK İŞÇİ (toplam) |
| `BG` | kümülatif matrah (ücret sonrası) | | `CY` | TOPLAM GELİR VERGİSİ |
| `BH`, `BI` | `vergi(BF)`, `vergi(BG)` | | `CZ` | ÖDENECEK GELİR VERGİSİ |
| `BJ` | ortalama oran (ücret) | | `DA` | TOPLAM DAMGA VERGİSİ |
| `BK` | GV (ücret) | | `DB` | ÖDENECEK DAMGA VERGİSİ |
| `BL` | DV (ücret) | | `DC` | BES kesintisi |
| `BM` | brüt mesai | | `DD` | NET ÖDEME |
| `BN`, `BO` | SGK / işsizlik işçi (mesai) | | `DE` | SGK işveren |
| `BP` | mesai GV matrahı | | `DF` | işsizlik işveren |
| `BQ`, `BR` | kümülatif matrah (mesai öncesi / sonrası) | | `DG` | 05510 indirimi |
| `BU` | ortalama oran (mesai) | | `DH` | 14857 engelli teşviki |
| `BV` | GV (mesai) | | `DI` | 15510 indirimi |
| | | | `DJ` | 05746 AR-GE SGK teşviki |
| | | | `DK` | AR-GE GV teşviki |
| | | | `DL` | AR-GE DV teşviki |
| | | | `DM` | TOPLAM MALİYET |

---

## 4. Yıllık hesap

### 4.1 `hesap.js:yilHesapla(P, k, aylikGirdi)`

`aylikGirdi` ay numarası alıp o ayın `g` nesnesini döndüren işlevdir.
```
aylar = [null]; devreden = 0; toplam = 0
for m = 1..12:
  r = ayHesapla(P, k, aylikGirdi(m), m, devreden)
  aylar.push(r); devreden = r.CK; toplam += r.DM
return { aylar, maliyet: toplam }          # aylar[1..12]
```
- **Kümülatif taşıma:** yalnız GV matrahı (`CK` → sonraki ayın `BF`). Yıl başında 0; önceki yıldan taşınmaz. Pasif
  aylarda da `CK` taşınır (matrah 0 olduğundan değişmeden).
- **Yıllık toplam maliyet** = Σ `DM` (12 ay). Başka yıllık toplam motor tarafından üretilmez; ekranlar ayları toplar.
- **Zam ayı:** `m >= k.zamAyi` aylarda `maasYeni`, öncesinde `maasEski`.

### 4.2 Giriş/çıkış ayı — `api.js:ayOf(tarih, yil)`

```
tarih boş → null
yıl(tarih) < yil → 0          # yıl başından önce
yıl(tarih) > yil → 13         # yıl sonrasında
aksi → ay(tarih)  (1–12)
```
Tarih `YYYY-AA-GG` metni olarak okunur (`slice(0,4)`, `slice(5,7)`).
- `k.girisAy = girisAy || 0` (boş giriş = yıl başından önce sayılır). `girisAy = 13` → bütün yıl pasif.
- `k.cikisAy = cikisAy` (boşsa `null`). `cikisAy = 0` (önceki yılda ayrılmış) → bütün yıl pasif, maliyet 0.
- Hangi tarih: `onay_sabit` 0 değilse `onay_giris/onay_cikis`, değilse `personel.ise_giris/isten_ayrilis` (§1.1).

### 4.3 Çalışmanın bütünü — `api.js:calismaHesapla(id, secenek)`

Kişi sırası `calismaPersonelListe` (bütçe bölümü sırası → giriş tarihi → ad). Her kişi için: zam (§5) → `k` → aylık
`g`'ler (§1.3) → `yilHesapla`. Sonuç `{ calisma, P, kisiler: [{ kp, zam, yil: {aylar, maliyet}, girdi }] }`.
Sonuç önbelleğe alınır; anahtar `id + (secenek.dilimler ? ':d' : '')`; veri yazan her işlem önbelleği temizler,
`secenek.tazele` önbelleği atlar.

`birlesikHesapla(calismaListesi)`: her çalışmayı ayrı `calismaHesapla` ile hesaplar, kişileri `{calisma}` ekiyle tek
listede birleştirir, `calisma_ozet` değerlerini anahtar bazında toplar. Gruplar arası etkileşim yoktur.

### 4.4 Yeni yıla geçiş (girdi hazırlığı) — `api.js:calismaPersonelKopyala(kaynakId, hedefId, 'YENI_YIL')`

Motorun parçası değil ama yeni yılın girdilerini belirler: kaynak yılın **zamlı** maaşı (`zam.yeni`) hedefin
`maas_eski`'si olur; `zam_ayi = 1`, `duzeltme = 0`; performans puanı ve çarpanı boş kalır; `maliyet_onceki` = kaynak yıl
maliyeti (`yil.maliyet`). Sürekli kişi alanlarının (hesap türü, kanun, sakatlık derecesi, özürlü indirimi, BES, GV
teşviki, yol) **Aralık'taki geçerli değeri** taşınır: kaynak çalışmanın `aylik_girdi` kayıtlarında 2.–12. aylardaki son
değer, yoksa kişi satırındaki değer (Ocak kaydına bakılmaz — §7). Tek seferlik aylık girdiler (aynî, prim, yakıt,
çalışılan gün), mesai saatleri, mesai öngörü tablosu ve AR-GE günü taşınmaz. Kaynak yıl içinde ya da önce ayrılanlar (`isten_ayrilis` yılı ≤ kaynak
yıl; güncel karttan, kartta yoksa dondurulmuş `onay_cikis`) ve hedef yılda başka bir grubun çalışmasında olanlar
aktarılmaz. Çalışma ayarlarından taşınmayanlar §2.5'tedir (ayrıca `dagilim.*`; motor kullanmaz).

Revize (`calismaRevizeAc` → `calismaPersonelKopyala(…, 'KOPYA')`) satırları, aylık girdileri, özet değerlerini, performans
girdilerini, mesai tablosunu ve bütün çalışma ayarlarını birebir kopyalar; onay tarihleri (`onay_sabit`) kopyalanmaz ve
revize TASLAK olduğu için yılın **güncel** parametreleriyle hesaplanır.

---

## 5. Zam motoru — `hesap.js:zamHesapla(Z, z)`

### 5.1 Girdiler (`api.js:calismaHesapla`)

```
Z = { yontem:  { kademe: !!c.zam_kademe, performans: !!c.zam_performans },
      kademe:  calismaZamKademe(c, P),            # {M:{altEsik,ustEsik,ustOran,altOran}, B:{…}}
      yuvarla: { ongoru: calisma_ayar['zam.yuvarla_ongoru'] dolu ? Number(…) : P.zamYuvarla } }
z = { yaka, eskiYilda: girisAy === 0 || girisAy === null,
      maasEski: kp.maas_eski, duzeltme: kp.duzeltme, carpan: performansCarpani(P, kp) }
```
**Yuvarlama adımının önceliği:** çalışma ayarı `zam.yuvarla_ongoru` > yılın `zam_yuvarla` parametresi (`P.zamYuvarla`,
`hesapParametre`'de varsayılan 10) > 10 (`zamHesapla`: `yuvarla.ongoru || 10` — boş ya da 0 adım 10 sayılır).

`calismaZamKademe(c, P)`: yılın `P.zamKademe`'si, üzerine çalışma ayarı `zam.<Y>.<anahtar>` (doluysa) yazılır.
Kademe varsayılanları (`api.js:ZAM_TANIM`; yıl parametresi `zam.<Y>.<anahtar>`, çalışma ayarı ezer). Bunlar yalnız
başlangıç değeridir; kurum kendi politikasına göre Parametreler'den değiştirir:

| Anahtar | Motor | Varsayılan | Anlam |
|---|---|---|---|
| `alt_esik` | `altEsik` | 50.000 | Alt eşik (net) |
| `ust_esik` | `ustEsik` | 100.000 | Üst eşik (net) |
| `ust_oran` | `ustOran` | 0,30 | Alt eşiğin **altındaki** oran (yüksek oran) |
| `alt_oran` | `altOran` | 0,25 | Üst eşiğin **üstündeki** oran (düşük oran) |

### 5.2 Öngörü oranı ve tutarı

```
eski = maasEski || 0
kd = Z.kademe[yaka] || null
oran = 0
if kd && eskiYilda:
  if Z.yontem.kademe === false: o = kd.ustOran               # kademesiz: düz yüksek oran
  elif eski < kd.altEsik:       o = kd.ustOran
  elif eski > kd.ustEsik:       o = kd.altOran
  else: o = kd.ustOran − (eski − kd.altEsik)/(kd.ustEsik − kd.altEsik) × (kd.ustOran − kd.altOran)   # doğrusal ara değer
  oran = o × (Z.yontem.performans ? (carpan ?? 1) : 1)
ongoru = mround(oran × eski, Z.yuvarla.ongoru || 10)
miktar = (duzeltme || 0) + ongoru
```
`mround(x, kat)`: `kat` yoksa 0; aksi `işaret(x) × Math.round(|x|/kat + 1e-12) × kat` — en yakın kata, yarımda sıfırdan
uzağa. Kat §5.1'deki öncelikle belirlenir; `yuvarla.ongoru || 10` nedeniyle 0 girilen kat da 10 sayılır.

**Zam almama kuralı.** `eskiYilda = (girisAy === 0 || girisAy === null)`: çalışma yılından önce girmiş (ya da giriş
tarihi boş) kişi zam alır — önceki yıl içinde girmiş olan da alır. Çalışma yılı içinde (1–12) ya da sonra (13) giren
için `oran = 0` → `ongoru = 0`; bu kişide `maas_eski` o yılın maaşıdır. Ancak **`duzeltme` yine eklenir**
(`miktar = duzeltme`); "zam almaz", öngörünün sıfırlanmasıdır, elle düzeltme engellenmez. Yakası `M`/`B` dışında olan
(kademe tanımı bulunmayan) kişide de öngörü 0'dır.

### 5.3 Performans çarpanı

`api.js:performansCarpani(P, kp)`:
```
kp.performans_carpani dolu ('' ya da null değil) → Number(kp.performans_carpani)
aksi, kp.performans_puani != null ve P.performans boş değil → alt_puan <= puan <= ust_puan olan İLK satırın carpan'ı
aksi → 1
```
Çarpan yalnız `Z.yontem.performans` (çalışmanın `zam_performans`) açıkken etkilidir.

`performans_carpani` her grupta Performans Değerlendirme'den gelebilir: `js/core/performans.js:PERF.hesapla` çarpanı
üretir, `api.js:performansCarpanUygula(id, harita)` haritadaki değeri olduğu gibi yazar (haritada olmayanın çarpanı
boşaltılır = 1) ve çalışmada `zam_performans = 1` yapar. Değerlendirme girdileri `performans_girdi(calisma_id,
tc_kimlik_no, alan, deger)` tablosundadır; puan ve çarpan kaydedilmez, her açılışta hesaplanır.

#### 5.3.1 Değerlendirme modeli bir veridir

Amirler, yaka başına kriterler ve ağırlıklar, değerlendirme ağırlığı ve ek puan kuralları kodda değil **yılın
parametresinde** durur ve ekrandan (Performans Değerlendirme → "Değerlendirme modeli") düzenlenir.

> **Örnek model.** Kayıt yoksa geçerli olan varsayılan model (`PERF.VARSAYILAN()`) bir **örnektir**. Her kurum kendi
> değerlendirme politikasına göre kriterleri, ağırlıkları ve ek puan kurallarını değiştirmelidir. Aşağıdaki hesap düzeni
> (amir puanı → değerlendirme → bölüm katsayısı → toplam puan → çarpan) modele bağlı değildir; değişen yalnız modelin
> içeriğidir.

**Saklama ve geçerli model** (`api.js`):

| İşlev | Davranış |
|---|---|
| Saklama | `parametre(yil, 'perf.model', JSON)` — `PERF.hazirla(ham).ham` (denetlenmiş, sayıları ve seçenekleri düzeltilmiş ham biçim). Kayıt yoksa varsayılan model. |
| `performansModeliHam(yil)` | `{ model: kayıtlı ham ya da PERF.VARSAYILAN(), varsayilan: kayıt yok mu }` (düzenleyici için). |
| `performansModeli(yil)` | `PERF.hazirla(kayıtlı ham)`; kayıt yoksa, JSON bozuksa ya da model denetimden geçmezse `PERF.hazirla(null)` (varsayılan). |
| `calismaPerformansModeli(id)` | ONAYLI çalışmada `calisma_parametre` anlık görüntüsündeki `perf.model` (onaydan önce kayıt yoksa varsayılan; yılın sonradan değişen modeli onaylıyı etkilemez); anlık görüntü yoksa ya da çalışma taslak / revize ise yılın modeli. |
| `performansModeliYaz(yil, ham \| null)` | `parametre.yaz` ister. `null` → kayıt silinir (varsayılana dönülür); aksi `PERF.hazirla(ham)` denetler, hatalıysa kaydetmez (hata metni "Değerlendirme modeli: …"). |
| `performansGirdiYaz(id, liste)` | Alan adını çalışmanın modeline göre denetler (`model.alanGecerli`); bilinmeyen alan reddedilir. |
| Yeni yıl | `perf.model` diğer yıl parametreleriyle `yilKopyalaIc` ile kopyalanır. |

Model düzenlenirken bir tanım (kriter, ek puan alanı, amir) kaldırılırsa girilmiş değerler silinmez, yalnız hesaba girmez.

**Ham biçim** (`PERF.VARSAYILAN()` bu biçimdedir):
```
{ amirler: [ { alan: 'amir1', ad, agirlik }, … ],                 # 1–5 amir; alan 'amirN'
  yaka: { M: { ad, sayfa, degAgirlik,
               kriter: [ { kod, ad, agirlik }, … ],
               ek:     [ { alan, ad, tur, <türün alanları>, sinir?, not?, kalici? }, … ] },
          B: { … } } }
```

**Ek puan kuralı türleri** (`v` = girilen değer; sayısal türlerde `n0(v)` = sayı değilse 0, ondalık virgül kabul edilir):

| `tur` | Türün alanları | Puan |
|---|---|---|
| `esik` | `esik`, `puan`, `katsayi` | `v ≥ esik ? puan : v × katsayi` |
| `kademe` | `kademeler: [[enAz, puan], …]` (artan sıraya dizilir) | değerin ulaştığı en yüksek kademenin puanı (`v ≥ enAz` olan son satır); `v` en alt kademenin altındaysa en alt kademenin puanı |
| `carpan` | `katsayi`, `enCok` (boş = sınırsız) | `min(v × katsayi, enCok)` |
| `liste` | `secenek: [[ad, puan], …]`, `bos` (vars. 0) | seçeneğin puanı; listede olmayan ya da boş değer → `bos`. Eşleme `tr-TR` büyük harf ve boşlukları teklenmiş metinle yapılır; seçeneklerin adları da bu biçimde saklanır |

Ek puan alanının isteğe bağlı bilgileri: `sinir: [en az, en çok]` — giriş denetimidir (ekran ve Excel şablonu; kriter
puanlarına ekran 0–100 uygular); hesapta ve `performansGirdiYaz`'da kullanılmaz.
`not` — kuralın açıklama metninin (`PERF.aciklama(ek)`) başına eklenir. `kalici: true` — yeni dönemin şablonuna önceki
dönemden taşınır (ör. kıdem, mezuniyet; değerlendirme bölümü ve amir adları her zaman taşınır).

**Alan adları** (`performans_girdi.alan`; `model.alanlar(yaka)`): `grup` (değerlendirme bölümü), amir alanları
(`amir1`…, amirin adı), `a<N>.<kriter kodu>` (N. amirin kriter puanı) ve ek puan alanları. Kriter öneki **amirin kendi
numarasıdır**, listedeki sırası değil: `amir3` → `a3.` (amirler `amir1`, `amir3` ise ikincinin öneki `a3.`'tür).

**Denetim** (`PERF.hazirla(ham)`; `ham` boşsa varsayılan): 1–5 amir, alanı `amir<sayı>` ve tekil, adı dolu, ağırlığı sayı
ve ≥ 0, en az birinin ağırlığı > 0; her iki yaka tanımlı ve en az bir kriterli; kriter kodu ve ek puan alanı kodu
`^[a-z][a-z0-9_]{0,29}$`, yaka içinde tekil (ek puan alanı `grup` ya da `amirN` olamaz); adlar dolu; tür geçerli ve türün
sayıları sayı; `kademe` / `liste` en az bir satırlı; `degAgirlik` sayı. Hata `Error('Değerlendirme modeli: …')`. Kriter
ağırlıklarının toplamının 100 olması **zorunlu değildir** (ekran yalnız uyarır); toplam 100 değilse amir puanının ölçeği,
dolayısıyla ek puanların değerlendirmeye göre payı değişir. `PERF.kodUret(ad, varolan)` addan tekil kod üretir
(Türkçe harfler sadeleştirilir; `grup` ve `amirN` atlanır). `PERF.TURLER` tür adlarının listesidir.

**Derlenmiş model** (`hazirla` dönüşü, `PERF.hesapla`'nın beklediği): `{ ham, amir: [[alan, ad, agirlik, önek]],
M: { ad, sayfa, degAgirlik, kriter: [[kod, ad, agirlik]], ek: [{ alan, ad, tur, aciklama, puan(v), metin, liste, sinir,
kalici }] }, B: {…}, alanlar(yaka), alanGecerli(alan), metinAlan(alan), toplamAgirlik(yaka) }`.

**Varsayılan örnek model** (`PERF.VARSAYILAN()`):

| | Mavi yaka (`M`) | Beyaz yaka (`B`) |
|---|---|---|
| Kriterler (kod, ağırlık; toplam 100) | `is_bilgisi` 25 · `gorev` 25 · `kural` (iş güvenliği ve kurallara uyma) 20 · `iletisim` 15 · `gelisim` 15 | `is_bilgisi` 20 · `kalite` 20 · `planlama` 20 · `iletisim` 15 · `gelisim` 10 · `yonetici` 15 |
| `degAgirlik` | 80 | 80 |
| Ek puan alanları | `devam`, `tutanak`, `kidem`, `egitim` | `kidem`, `egitim` |

Amirler: `amir1` "1. AMİR" 50 · `amir2` "2. AMİR" 30 · `amir3` "İDARİ AMİR" 20.

| Ek puan alanı | Yaka | Tür ve tanım | Puan |
|---|---|---|---|
| `devam` (devamlılık %) | M | `esik`: eşik 95, puan 5, katsayı 0,05; sınır 0–100 | `v ≥ 95 → 5`; aksi `v × 0,05` |
| `tutanak` (sayı) | M | `kademe`: [[0, +2], [1, 0], [2, −2]]; sınır 0–99 | 0 → +2 · 1 → 0 · 2 ve üzeri → −2 |
| `kidem` (yıl; işyerindeki bütün dönemlerin toplamı, elle girilir) | M, B | `carpan`: katsayı 1, en çok 5; sınır 0–99; kalıcı; not var | `min(v, 5)` |
| `egitim` (mezuniyet) | M, B | `liste`: okur yazar 1 · ilk okul 2 · orta okul 3 · lise 4 · meslek lisesi 4 · ön lisans 5 · lisans 6 · yüksek lisans 7 · doktora 8; `bos` 0; kalıcı | seçeneğin puanı; listede olmayan / boş 0 |

#### 5.3.2 Hesap — `PERF.hesapla(kisiler, model)`

`kisiler = [{ tc, yaka, g: {alan: değer} }]`; `model` = `PERF.hazirla(…)` sonucu (boşsa `PERF.hazirla(null)`, yani
varsayılan). Çalışma için doğru model `api.js:calismaPerformansModeli(id)`'dir. Her yaka (`M`; `M` dışındaki her şey
`B`) ayrı hesaplanır; `t = model[yaka]`:
1. **Amir puanı** (`amirPuani`): her amir için `Σ g[önek + kriter] × kriter_ağırlığı / 100` (yalnız dolu kriterler);
   hiç dolu yoksa ya da toplam 0 ise `null`.
2. **Değerlendirme** `deg = Σ amir_puanı_i × w_i / Σ w_i` — yalnız puanı olan amirler (`w` = modeldeki amir ağırlığı;
   puanı olmayan amirin ağırlığı kalanlara dağılır). `Σ w_i = 0` ise kişi **değerlendirilmemiş** sayılır (sonuçta yer
   almaz → çarpan 1).
3. **Bölüm katsayısı:** `grOrt[grup]` = o bölümdeki `deg` ortalaması (`grup` alanı, kırpılmış);
   `genel` = bölüm ortalamalarının ortalaması (kişilerin değil); `kats = grOrt ? genel / grOrt[grup] : 1`. Bölümler
   arası not cömertliği böylece dengelenir.
4. **Toplam puan** `puan = kats × deg × t.degAgirlik / 100 + Σ e.puan(g[e.alan])` (modeldeki bütün ek puan alanları).
5. **Zam çarpanı** `carpan = ort ? puan / ort : 1`, `ort` = o yakadaki değerlendirilmiş kişilerin `puan` ortalaması.

Dönüş: `{ kisi: { tc: { tc, amir, deg, grup, ek, ekToplam, kats, duzDeg, puan, carpan } }, grup: { M: [{ grup, kisi, ort,
kats }], B: […] }, ort: { M, B }, genel: { M, B } }`.

**Örnek (uydurma, varsayılan model, mavi yaka, iki bölüm).** Kriter puanları sırasıyla iş bilgisi / görev / kural /
iletişim / gelişim:

| Kişi | Bölüm | Amir puanları | `deg` | Ek: devam + tutanak + kıdem + eğitim | `kats` | `puan` | `carpan` |
|---|---|---|---|---|---|---|---|
| K1 | X | 1. amir 90/85/80/75/70 → 81,5 | 81,50 | %98 → 5 · 0 → +2 · 6 yıl → 5 · lise → 4 = 16 | 0,912044 | 75,4653 | 1,102891 |
| K2 | X | 1. amir 80'ler → 80 · 2. amir 70'ler → 70 | 76,25 | %90 → 4,5 · 1 → 0 · 2 → 2 · ilk okul → 2 = 8,5 | 0,912044 | 64,1347 | 0,937299 |
| K3 | Y | 1. amir 70'ler → 70 | 70,00 | %95 → 5 · 2 → −2 · 10 → 5 · meslek lisesi → 4 = 12 | 1,106731 | 73,9769 | 1,081139 |
| K4 | Y | 1. amir 60'lar → 60 | 60,00 | %80 → 4 · 0 → +2 · 1 → 1 · boş → 0 = 7 | 1,106731 | 60,1231 | 0,878671 |
| K5 | Y | yok (yalnız devam %99, kıdem 3) | — | — | — | değerlendirilmedi | 1 |

`deg(K2) = (80×50 + 70×30) / 80 = 76,25`; `grOrt(X) = 78,875`, `grOrt(Y) = 65`, `genel = 71,9375`,
`kats(X) = 71,9375 / 78,875`; `puan(K1) = 0,912044 × 81,5 × 80/100 + 16 = 75,4653`; `ort = 68,425`;
`carpan(K1) = 75,4653 / 68,425`. Yeniden üretmek için (depo kökünde):

```js
global.window = {}; require(require('path').resolve('program/js/core/performans.js'));
const PERF = window.PERF, model = PERF.hazirla(null);      // varsayılan model; yıla özel model için PERF.hazirla(ham)
const a = (i, v) => Object.fromEntries(['is_bilgisi', 'gorev', 'kural', 'iletisim', 'gelisim'].map((k, j) => ['a' + i + '.' + k, v[j]]));
console.log(PERF.hesapla([
  { tc: 'K1', yaka: 'M', g: { grup: 'X', ...a(1, [90, 85, 80, 75, 70]), devam: 98, tutanak: 0, kidem: 6, egitim: 'Lise' } },
  { tc: 'K2', yaka: 'M', g: { grup: 'X', ...a(1, [80, 80, 80, 80, 80]), ...a(2, [70, 70, 70, 70, 70]), devam: 90, tutanak: 1, kidem: 2, egitim: 'İlk okul' } },
  { tc: 'K3', yaka: 'M', g: { grup: 'Y', ...a(1, [70, 70, 70, 70, 70]), devam: 95, tutanak: 2, kidem: 10, egitim: 'Meslek lisesi' } },
  { tc: 'K4', yaka: 'M', g: { grup: 'Y', ...a(1, [60, 60, 60, 60, 60]), devam: 80, tutanak: 0, kidem: 1, egitim: '' } },
  { tc: 'K5', yaka: 'M', g: { grup: 'Y', devam: 99, kidem: 3 } },
], model).kisi);
```

### 5.4 Yeni maaş ve yuvarlama

```
yeni = eski + miktar                        # = maasEski + duzeltme + ongoru
oran = eski ? miktar / eski : 0             # gerçekleşen zam oranı (düzeltme dahil)
```
Dönüş yalnız şu alanlardır: `{ eski, oranOngoru, ongoru, miktar, yeni, oran }` (`oranOngoru` = §5.2'deki `oran`).

- Yeni maaş **tek bir net tutardır**; motor bunu `k.maasYeni` olarak zam ayından itibaren öder (§3.2).
- **Yalnız öngörü yuvarlanır** (`mround`; kat: çalışma ayarı `zam.yuvarla_ongoru`, yoksa yılın `zam_yuvarla`, yoksa 10).
  `duzeltme` yuvarlanmadan eklenir;
  `maas_eski` yuvarlak değilse yeni maaş da yuvarlak olmaz.
- `oranOngoru` yuvarlama öncesi orandır (kademe × çarpan); `oran` ise yuvarlanmış öngörü ve düzeltmeyle gerçekleşen
  orandır.

### 5.5 Zam örnekleri (Node ile `HESAP.zamHesapla` çalıştırılarak)

Varsayılan kademe: alt eşik 50.000, üst eşik 100.000, alt eşiğin altında 0,30, üst eşiğin üstünde 0,25; beyaz yaka,
yıl başından önce girmiş (`eskiYilda = true`), aksi belirtilmedikçe performans kapalı, düzeltme 0, yuvarlama 10 (yılın
`zam_yuvarla` varsayılanı). "Yuvarlama 100" satırı çalışma ayarı `zam.yuvarla_ongoru = 100` durumudur.

| Senaryo | `eski` | `o` | `oranOngoru` | `oran × eski` | `ongoru` | `miktar` | `yeni` | `oran` |
|---|---|---|---|---|---|---|---|---|
| Alt eşiğin altında | 40.000 | 0,30 | 0,30 | 12.000 | 12.000 | 12.000 | 52.000 | 0,300000 |
| İki eşik arasında | 75.000 | 0,275 | 0,275 | 20.625 | 20.630 | 20.630 | 95.630 | 0,275067 |
| Aynı, yuvarlama 100 | 75.000 | 0,275 | 0,275 | 20.625 | 20.600 | 20.600 | 95.600 | 0,274667 |
| Üst eşiğin üstünde | 120.000 | 0,25 | 0,25 | 30.000 | 30.000 | 30.000 | 150.000 | 0,250000 |
| Performans açık, çarpan 1,08, düzeltme +500 | 75.000 | 0,275 | 0,297 | 22.275 | 22.280 | 22.780 | 97.780 | 0,303733 |
| Kademe kapalı (`zam_kademe = 0`) | 75.000 | 0,30 | 0,30 | 22.500 | 22.500 | 22.500 | 97.500 | 0,300000 |
| Yıl içinde giren (`eskiYilda = false`), düzeltme +1.000 | 75.000 | — | 0 | 0 | 0 | 1.000 | 76.000 | 0,013333 |

Ara değer: `o = 0,30 − (75.000 − 50.000)/(100.000 − 50.000) × (0,30 − 0,25) = 0,275`; `0,275 × 75.000 = 20.625` →
10'a yuvarlamada yarım değer sıfırdan uzağa: 20.630; 100'e: 20.600. Performanslı satırda `0,275 × 1,08 = 0,297`,
`0,297 × 75.000 = 22.275` → 22.280; `miktar = 500 + 22.280`.

```js
global.window = {}; require(require('path').resolve('program/js/core/hesap.js'));
// calismaHesapla'nın kurduğu Z: yuvarla.ongoru = çalışma ayarı 'zam.yuvarla_ongoru' ?? P.zamYuvarla (vars. 10)
const Z = { yontem: { kademe: true, performans: false }, yuvarla: { ongoru: 10 },
            kademe: { B: { altEsik: 50000, ustEsik: 100000, ustOran: 0.30, altOran: 0.25 } } };
console.log(window.HESAP.zamHesapla(Z, { yaka: 'B', eskiYilda: true, maasEski: 75000, duzeltme: 0, carpan: 1 }));
// → { eski: 75000, oranOngoru: 0.275, ongoru: 20630, miktar: 20630, yeni: 95630, oran: 0.27506… }
```

---

## 6. Sayısal örnek ve sınama vektörleri

### 6.1 Kurulum ve nasıl yeniden üretilir

Parametreler `data/seed.js`'teki 2026 değerleridir ve `api.js:hesapParametre`'nin kurduğu biçimde verilir: dilimler
190.000 %15 · 400.000 %20 · 1.500.000 %27 · 5.300.000 %35 · ∞ %40; asgari 33.030 (Ocak'tan, tek dönem); tavan çarpanı 9;
DV 0,00759; BES 0,03; istisna kesintisi 0,15; AR-GE günü 0 (çalışma ayarı yok); `PARAMETRE_TANIM` varsayılanları (AR-GE
eşiği 0,8, mesai katsayıları 1,5 / 2, günlük saat 7,5, zam yuvarlama 10); hesaplama türleri §2.3; kanun türleri
§2.4; teşvik 0,02 / 0,09875 / 0,1975 / 0,05; sakatlık {1: 12.000, 2: 7.000, 3: 3.000}. Çalışma ayarı yok (varsayılan
çalışılan gün yok → 30; mesai öngörüsü kapalı). Kişilere zam motorundan çıkmış maaş doğrudan verilir (`maasEski`,
`maasYeni`, `zamAyi`).

Aşağıdaki betik bu bölümdeki bütün vektörleri üretir. `ornek.js` adıyla depo köküne kaydedip `node ornek.js` ile
çalıştırın; istediğiniz alanı `hesapla(...KISI.A).aylar[m]` nesnesinden okuyabilirsiniz.

```js
// Depo kökünde çalıştırın:  node ornek.js
global.window = {};
require(require('path').resolve('program/js/core/hesap.js'));
const H = window.HESAP;

// api.js:hesapParametre'nin kurduğu nesne — 2026 değerleri data/seed.js'ten
const P = H.parametreHazirla({
  yil: 2026, asgariUcret: [{ ay: 1, brut: 33030 }],
  dilimler: [{ ust: 190000, oran: 0.15 }, { ust: 400000, oran: 0.20 }, { ust: 1500000, oran: 0.27 },
             { ust: 5300000, oran: 0.35 }, { ust: null, oran: 0.40 }],
  tavanCarpan: 9, dv: 0.00759, besOrani: 0.03, istisnaKesinti: 0.15, argeGun: 0,
  argeEsik: 0.8, mesaiKat1: 1.5, mesaiKat2: 2, gunlukSaat: 7.5,   // PARAMETRE_TANIM varsayılanları
  turler: {
    SSK:    { kol: 'SSK',  sgkIsci: 0.14,  issizlikIsci: 0.01, sgkIsveren: 0.2175, issizlikIsveren: 0.02, gv: true, dv: true, istisna: true },
    EMK:    { kol: 'SGDP', sgkIsci: 0.075, issizlikIsci: 0,    sgkIsveren: 0.2475, issizlikIsveren: 0,    gv: true, dv: true, istisna: true },
    SGKSIZ: { kol: 'YOK',  sgkIsci: 0,     issizlikIsci: 0,    sgkIsveren: 0,      issizlikIsveren: 0,    gv: true, dv: true, istisna: true },
  },
  tesvik: { k05510: 0.02, k05746: 0.09875, k14857: 0.1975, k15510: 0.05 },
});
P.zamYuvarla = 10;
P.kanunKural = { YOK: 'YOK', '05510': '05510', '05510-5': '05510', '05746': '05746', '14857': '14857', '15510': '15510' };
P.kanunOran  = { '05510': 0.02, '05510-5': 0.05 };
P.sakatlik   = { 1: 12000, 2: 7000, 3: 3000 };

// api.js:calismaHesapla'daki aylık dağıtım: sürekli alan devreder, tek seferlik alan yalnız o aya
const SUREKLI = { hesap_turu: 'tur', kanun: 'kanun', sakatlik_derece: 'sakatlikDerece', ozurlu_indirimi: 'ozurluIndirimi',
                  bes: 'bes', gv_tesvik: 'gvTesvik', yol: 'yol', fm1: 'fm1', fm2: 'fm2', arge_gun: 'argeGun' };
function hesapla(kp, ay = {}) {
  const s = { tur: kp.hesap_turu, kanun: P.kanunKural[kp.kanun] || 'YOK', kanunOran: P.kanunOran[kp.kanun],
              sakatlikDerece: kp.sakatlik_derece, ozurluIndirimi: kp.ozurlu_indirimi || 0, bes: kp.bes,
              gvTesvik: kp.gv_tesvik || 0, yol: kp.yol || 0, fm1: 0, fm2: 0, argeGun: null };
  const G = [null];
  for (let m = 1; m <= 12; m++) {
    const a = ay[m] || {};
    for (const al in SUREKLI) if (a[al] !== undefined) {
      let v = a[al];
      if (al === 'kanun') { s.kanunOran = P.kanunOran[v]; v = P.kanunKural[v] || 'YOK'; }
      else if (al !== 'hesap_turu' && al !== 'bes') v = Number(v);
      s[SUREKLI[al]] = v;
    }
    const g = Object.assign({}, s, { ayni: a.ayni || 0, prim: a.prim || 0, yakit: a.yakit || 0,
                                     calisilanGun: a.calisilan_gun != null ? a.calisilan_gun : null });
    if (g.sakatlikDerece) g.ozurluIndirimi = P.sakatlik[g.sakatlikDerece] || 0;
    G.push(g);
  }
  const k = { yaka: kp.yaka, girisAy: kp.girisAy || 0, cikisAy: kp.cikisAy == null ? null : kp.cikisAy,
              zamAyi: kp.zamAyi || 1, maasEski: kp.maasEski, maasYeni: kp.maasYeni };
  return H.yilHesapla(P, k, m => G[m]);
}

// Sınama vektörleri (§6) — kişi satırı + aylık girdiler { ay: { alan: değer } }
const KISI = {
  A: [{ yaka: 'B', hesap_turu: 'SSK', kanun: '05510', maasEski: 50000, maasYeni: 50000 }],
  B: [{ yaka: 'M', hesap_turu: 'SSK', kanun: '05510-5', bes: 'EVET', yol: 2000, maasEski: 30000, maasYeni: 30000 },
      { 1: { fm1: 10, fm2: 8 }, 3: { prim: 10000 }, 5: { ayni: 5000 }, 12: { yakit: 4000 } }],
  C: [{ yaka: 'B', hesap_turu: 'SSK', kanun: '05746', gv_tesvik: 0.95, maasEski: 100000, maasYeni: 100000 },
      { 1: { arge_gun: 20 } }],
  D: [{ yaka: 'B', hesap_turu: 'EMK', kanun: '15510', maasEski: 40000, maasYeni: 40000 }],
  E: [{ yaka: 'M', hesap_turu: 'SSK', kanun: '14857', sakatlik_derece: 2, maasEski: 40000, maasYeni: 40000 }],
  F: [{ yaka: 'B', hesap_turu: 'SSK', kanun: '05510', yol: 2000, girisAy: 4, cikisAy: 9, maasEski: 50000, maasYeni: 50000 },
      { 4: { calisilan_gun: 15 }, 9: { calisilan_gun: 20 } }],
  G: [{ yaka: 'B', hesap_turu: 'SSK', kanun: '05510', zamAyi: 7, maasEski: 40000, maasYeni: 50000 }],
  T: [{ yaka: 'B', hesap_turu: 'SSK', kanun: '05510', maasEski: 300000, maasYeni: 300000 }, { 3: { prim: 100000 } }],
  S: [{ yaka: 'B', hesap_turu: 'SGKSIZ', kanun: 'YOK', maasEski: 50000, maasYeni: 50000 }],
};
for (const ad in KISI) {
  const y = hesapla(...KISI[ad]);
  console.log(ad, 'yıllık maliyet', y.maliyet.toFixed(2), '| Ocak BB', y.aylar[1].BB.toFixed(2), 'DM', y.aylar[1].DM.toFixed(2));
}
```

Beklenen çıktı (yeniden yazılan motorun ilk sınaması):

| Kişi | Özellik | Ocak `BB` | Ocak `DM` | Yıllık maliyet |
|---|---|---|---|---|
| A | Beyaz yaka, net 50.000, SSK, 05510 %2 | 63.697,50 | 77.551,70 | 996.411,70 |
| B | Mavi yaka, net 30.000, 05510 %5, mesai 10 + 8 saat, yol 2.000, BES; Mart prim, Mayıs aynî, Aralık yakıt | 35.721,95 | 52.607,57 | 680.034,03 |
| C | Beyaz yaka, net 100.000, 05746 AR-GE, GV teşviki %95, AR-GE günü 20 | 133.636,37 | 146.688,67 | 1.883.845,78 |
| D | Emekli (EMK), net 40.000, 15510 | 45.639,92 | 54.653,80 | 684.447,90 |
| E | Mavi yaka, net 40.000, 14857 engelli, sakatlık 2. derece | 49.709,72 | 53.998,16 | 665.576,47 |
| F | Nisan ortasında giren (15 gün), Eylül'de çıkan (20 gün), net 50.000, yol 2.000 | 0,00 | 0,00 | 425.708,55 |
| G | Net 40.000 → 50.000, zam ayı Temmuz | 49.709,72 | 60.521,59 | 877.226,18 |
| T | Net 300.000 (SGK tavanı üstü), Mart prim 100.000 | 405.989,80 | 470.646,02 | 6.747.519,38 |
| S | SGK'sız, net 50.000 | 54.056,79 | 54.056,79 | 694.356,98 |

### 6.2 Kişi A — Ocak, adım adım

Beyaz yaka, SSK, kanun `05510` (`kanunOran 0,02`), bütün yıl aktif (`girisAy 0`, `cikisAy null`), zam ayı 1, net maaş
50.000, sakatlık / BES / AR-GE / ek ödeme yok, çalışılan gün girilmemiş (→ 30).

| Adım | Formül | Değer |
|---|---|---|
| Durum | `aktif = true`, `zamli = true` | |
| AM | `maasYeni` | 50.000 |
| AQ, AR, UG | varsayılan 30; `30 ≠ 31` → AR = 30 | 30 ; 30 ; 30 |
| AP | `argeGun` yok, `gvTesvik 0 < argeEsik (0,8)` → 0 | 0 |
| istOran | `min(30,30)/30` | 1 |
| istGV, istDV | §2.2 | 4.211,325 ; 250,6977 |
| netUcret | `50.000/30×30` | 50.000 |
| taban | `33.030/30×30` | 33.030 |
| **BB** (17 tur) | sabit nokta | **63.697,496591** (kesin 63.697,496608) |
| BC | `BB/30 = 2.123,25 < 9.909` → `BB × 0,14` | 8.917,649517 |
| BD | `BB × 0,01` | 636,974965 |
| BE | `BB − BC − BD − 0` | 54.142,872067 |
| BF, BG | `0` ; `BE + BF` | 0 ; 54.142,872067 |
| BH, BI | `vergi(0)` ; `vergi(54.142,87) = 54.142,87 × 0,15` | 0 ; 8.121,430810 |
| BJ | `(BI − BH)/(BG − BF)` | 0,15 |
| BK | `pos(0,15 × 54.142,872067 − 4.211,325)` | 3.910,105810 |
| BL | `pos(63.697,4966 × 0,00759 − 250,6977)` | 232,766299 |
| Kontrol | `BB = 50.000 + 8.917,6495 + 636,9750 + 3.910,1058 + 232,7663 + 0` | 63.697,4966 ✓ |
| Kapalı form | `(50.000 − 4.211,325 − 250,6977) / (1 − 0,14 − 0,01 − 0,15×0,85 − 0,00759) = 45.537,9773 / 0,71491` | 63.697,4966 ✓ |
| CK | `BG + BX + BP + CI` (ek kalemler 0) | 54.142,872067 → Şubat'a devreder |
| CV, CW, CX | | 63.697,50 ; 8.917,65 ; 636,97 |
| CY, DA | | 3.910,11 ; 232,77 |
| DC | `bes ≠ 'EVET'` | 0 |
| DD | `CV − CW − CX − CY − DA − 0 − 0` | 50.000,00 |
| DE | `mat = 0 + 0 + tb(BB) = BB`; `BB/30 < tavanG` → `BB × 0,2175` | 13.854,205509 |
| DF | `BB × 0,02` | 1.273,949932 |
| DG | `sinirli = min(BB, 9.909×30) = BB`; `BB × 0,02` | 1.273,949932 |
| DH, DI, DJ, DK, DL | koşullar sağlanmıyor | 0 |
| **DM** | `CV + DE + DF − DG` | **77.551,702100** |

Nisan (dilim geçişi): `BF = 162.428,62`, `BG = 218.250,95` 190.000'i geçer → `BH = 24.364,29`, `BI = 34.150,19`,
`BJ = (34.150,19 − 24.364,29) / 55.822,34 = 0,175304` (dilim geçişinde ortalama oran);
`BK = 0,175304 × 55.822,34 − 4.211,325 = 5.574,57`. Temmuz: istisna 4.537,75'e çıkar, brüt düşer. Ağustos:
`BF = 390.533,31`, `BG = 450.820,80` 400.000'i geçer → `BJ = 0,259008`. Eylül'den itibaren `BJ = 0,27`.

### 6.3 Kişi A — bütün yıl

| Ay | istGV | BB brüt | CW SGK işçi | CX işsizlik işçi | BE GV matrahı | CK kümülatif matrah | BJ oran | CY GV | DA DV | DD net | DE SGK işveren | DF işsizlik işveren | DG 05510 | DM maliyet | tur |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 4.211,33 | 63.697,50 | 8.917,65 | 636,97 | 54.142,87 | 54.142,87 | %15,0000 | 3.910,11 | 232,77 | 50.000,00 | 13.854,21 | 1.273,95 | 1.273,95 | 77.551,70 | 17 |
| 2 | 4.211,33 | 63.697,50 | 8.917,65 | 636,97 | 54.142,87 | 108.285,74 | %15,0000 | 3.910,11 | 232,77 | 50.000,00 | 13.854,21 | 1.273,95 | 1.273,95 | 77.551,70 | 17 |
| 3 | 4.211,33 | 63.697,50 | 8.917,65 | 636,97 | 54.142,87 | 162.428,62 | %15,0000 | 3.910,11 | 232,77 | 50.000,00 | 13.854,21 | 1.273,95 | 1.273,95 | 77.551,70 | 17 |
| 4 | 4.211,32 | 65.673,34 | 9.194,27 | 656,73 | 55.822,34 | 218.250,95 | %17,5304 | 5.574,57 | 247,76 | 50.000,00 | 14.283,95 | 1.313,47 | 1.313,47 | 79.957,29 | 19 |
| 5 | 4.211,33 | 67.723,53 | 9.481,29 | 677,24 | 57.565,00 | 275.815,95 | %20,0000 | 7.301,67 | 263,32 | 50.000,00 | 14.729,87 | 1.354,47 | 1.354,47 | 82.453,40 | 19 |
| 6 | 4.211,33 | 67.723,53 | 9.481,29 | 677,24 | 57.565,00 | 333.380,95 | %20,0000 | 7.301,67 | 263,32 | 50.000,00 | 14.729,87 | 1.354,47 | 1.354,47 | 82.453,40 | 19 |
| 7 | 4.537,75 | 67.238,07 | 9.413,33 | 672,38 | 57.152,36 | 390.533,31 | %20,0000 | 6.892,72 | 259,64 | 50.000,00 | 14.624,28 | 1.344,76 | 1.344,76 | 81.862,35 | 19 |
| 8 | 5.615,10 | 70.926,46 | 9.929,70 | 709,26 | 60.287,49 | 450.820,80 | %25,9008 | 9.999,85 | 287,63 | 50.000,00 | 15.426,50 | 1.418,53 | 1.418,53 | 86.352,96 | 22 |
| 9 | 5.615,10 | 72.007,64 | 10.081,07 | 720,08 | 61.206,49 | 512.027,29 | %27,0000 | 10.910,65 | 295,84 | 50.000,00 | 15.661,66 | 1.440,15 | 1.440,15 | 87.669,30 | 22 |
| 10 | 5.615,10 | 72.007,64 | 10.081,07 | 720,08 | 61.206,49 | 573.233,78 | %27,0000 | 10.910,65 | 295,84 | 50.000,00 | 15.661,66 | 1.440,15 | 1.440,15 | 87.669,30 | 22 |
| 11 | 5.615,10 | 72.007,64 | 10.081,07 | 720,08 | 61.206,49 | 634.440,28 | %27,0000 | 10.910,65 | 295,84 | 50.000,00 | 15.661,66 | 1.440,15 | 1.440,15 | 87.669,30 | 22 |
| 12 | 5.615,10 | 72.007,64 | 10.081,07 | 720,08 | 61.206,49 | 695.646,77 | %27,0000 | 10.910,65 | 295,84 | 50.000,00 | 15.661,66 | 1.440,15 | 1.440,15 | 87.669,30 | 22 |
| **Yıl** | | **818.407,97** | **114.577,12** | **8.184,08** | **695.646,77** | | | **92.443,43** | **3.203,34** | **600.000,00** | **178.003,73** | **16.368,16** | **16.368,16** | **996.411,70** | |

**Yıllık toplam maliyet: 996.411,70 TL** (`y.maliyet = 996411.700439883`).

### 6.4 Ek sınama vektörleri (aynı parametrelerle; 2 ondalık)

Yeniden yazılan motoru dallara göre sınamak için. Girdiler §6.1 betiğindeki `KISI` tablosundadır; belirtilmeyen alanlar
kişi A'daki gibidir.

**B — mavi yaka, mesai, yol, prim, aynî, yakıt, BES, 05510 %5.** Net 30.000; Ocak'a `fm1 10`, `fm2 8` (sürekli →
bütün yıl); `yol 2.000` (sürekli); `bes 'EVET'`; Mart `prim 10.000`; Mayıs `ayni 5.000`; Aralık `yakit 4.000`;
kanun `05510-5` (`kanunOran 0,05`).

| Ay | AV | BB | BM | BX | CF | CQ | CY | DA | DC | DD | DE | DG | DM |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 4.133,33 | 35.721,95 | 5.781,61 | 0 | 2.797,55 | 0 | 1.437,07 | 85,55 | 1.329 | 34.804,33 | 9.635,49 | 2.215,06 | 52.607,57 |
| 3 | 4.133,33 | 35.721,95 | 5.781,61 | 0 | 16.785,33 | 0 | 3.220,51 | 191,71 | 1.748 | 44.385,33 | 12.677,83 | 2.914,44 | 69.218,06 |
| 5 | 4.133,33 | 35.935,88 | 6.147,04 | 6.309,86 | 2.974,38 | 0 | 3.336,06 | 139,18 | 1.351 | 34.782,33 | 9.799,96 | 2.252,87 | 59.815,41 |
| 12 | 4.133,33 | 39.376,42 | 6.743,79 | 0 | 3.263,12 | 4.030,59 | 5.718,37 | 154,71 | 1.481 | 38.652,33 | 10.740,87 | 2.469,17 | 62.673,29 |

Kontroller: `AV = 30.000 / 30 / 7,5 × (1,5×10 + 2×8) = 4.133,33` (varsayılan mesai parametreleri); Ocak `DC = asagiYuvarla(0,03 × (35.721,95 + 2.797,55 + 5.781,61)) = 1.329`;
Mayıs'ta aynî BES matrahına girmez (`0,03 × (35.935,88 + 2.974,38 + 6.147,04) = 1.351,7 → 1.351`) ve parayla ödenmediği için
`DD`'den düşülür (`30.000 + 4.133,33 + 2.000 − 1.351 = 34.782,33`); `DG = (BB + CF + BM) × 0,05` (Ocak 2.215,06);
Aralık yakıtın DV'si `CR = 4.030,59 × 0,00759 = 30,59`, `CQ = 4.000 + 30,59`. Yıl: **680.034,03 TL**.

**C — 05746 AR-GE + GV teşviki.** Beyaz yaka, net 100.000, kanun `05746` (`kanunOran` yok → 05510 payı `T.k05510 = 0,02`),
`gvTesvik 0,95`, Ocak'a `arge_gun 20` (sürekli → bütün yıl).

| Ay | AP | BB | CK | CY | DA | DE | DG | DJ | DK | DL | CZ | DB | DM |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 20 | 133.636,37 | 113.590,91 | 12.827,31 | 763,60 | 29.065,91 | 2.672,73 | 8.797,73 | 6.790,38 | 425,50 | 6.036,93 | 338,10 | 146.688,67 |
| 6 | 20 | 155.876,03 | 742.961,75 | 31.562,22 | 932,40 | 33.903,04 | 3.117,52 | 10.261,84 | 18.655,82 | 538,04 | 12.906,40 | 394,37 | 160.323,37 |
| 12 | 20 | 157.658,70 | 1.531.204,90 | 33.063,96 | 945,93 | 34.290,77 | 3.153,17 | 10.379,20 | 19.162,40 | 547,06 | 13.901,57 | 398,88 | 161.860,82 |

Ocak kontrolü: `DJ = 133.636,37 × 0,09875 / 30 × 20 = 8.797,73`;
`DK = (113.590,91 × 0,15 / 30 × 20 − 4.211,325) × 0,95 = (11.359,09 − 4.211,325) × 0,95 = 6.790,38`;
`DL = (133.636,37 / 30 × 20 − 33.030) × 0,00759 = 425,50`; `DG = 133.636,37 × 0,02 = 2.672,73`.
`DD` teşvikten etkilenmez (100.000). Yıl: **1.883.845,78 TL**.

**D — emekli (SGDP) 15510.** Hesap türü `EMK` (kol SGDP; 0,075 / 0 / 0,2475 / 0), kanun `15510`, net 40.000.

| Ay | BB | BC | BD | CY | DA | DD | DE | DF | DI | DM |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 45.639,92 | 3.422,99 | 0 | 2.121,21 | 95,71 | 40.000,00 | 11.295,88 | 0 | 2.282,00 | 54.653,80 |
| 12 | 51.125,13 | 3.834,38 | 0 | 7.153,40 | 137,34 | 40.000,00 | 12.653,47 | 0 | 2.556,26 | 61.222,34 |

Kontrol: `BC = BB × 0,075`, `DE = BB × 0,2475`, `DI = BB × 0,05`; `DG` yok (kol SGDP). Ocak
`DM = 45.639,92 + 11.295,88 − 2.282,00 = 54.653,80`. Yıl: **684.447,90 TL**.

**E — engelli 14857 + sakatlık derecesi.** Mavi yaka, net 40.000, kanun `14857`, sakatlık 2. derece → `AF = P.sakatlik[2] = 7.000`.

| Ay | AN | BB | BE | BK | CV | DD | DE | DG | DH | DM |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1.050,00 | 49.709,72 | 35.253,26 | 1.076,66 | 49.709,72 | 41.050,00 | 10.811,86 | 994,19 | 6.523,43 | 53.998,16 |
| 12 | 1.890,00 | 55.170,20 | 39.894,67 | 4.836,63 | 55.170,20 | 41.890,00 | 11.999,52 | 1.103,40 | 6.523,43 | 60.646,30 |

Kontrol: `BE = 49.709,72 − 6.959,36 − 497,10 − 7.000 = 35.253,26`; `AN = 0,15 × 7.000 = 1.050` (Aralık'ta `CK = 435.325,62`
→ %27 dilimi → `0,27 × 7.000 = 1.890`); `DD = 40.000 + AN`; `DH = 33.030 × 0,1975 / 30 × 30 = 6.523,43` (kişinin
brütünden bağımsız); `DG = BB × 0,02`. Ocak brütü sakatlıksız aynı netin brütüyle (kişi G Ocak) aynıdır: ilk dilimde
`AN` indirimin GV etkisini tam karşılar; brüt değişmez, çalışanın neti 1.050 artar, maliyetten düşülmez (kural b).
Yıl: **665.576,47 TL**.

**F — ay ortasında giren / çıkan.** Beyaz yaka, net 50.000, `yol 2.000` (sürekli); `girisAy 4` (Nisan ortası) ve Nisan'a
`calisilan_gun 15`; `cikisAy 9` ve Eylül'e `calisilan_gun 20`.

| Ay | AM | AR | AZ | BB | BK | BL | CV | DD | DE | DG | DM |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | 0 | 30 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 4 | 50.000 | 15 | 2.000 | 31.848,75 | 1.955,05 | 116,38 | 34.646,30 | 27.000,00 | 7.535,57 | 692,93 | 42.181,87 |
| 5 | 50.000 | 30 | 2.000 | 63.697,50 | 3.910,11 | 232,77 | 66.495,05 | 52.000,00 | 14.462,67 | 1.329,90 | 80.957,73 |
| 9 | 50.000 | 20 | 2.000 | 43.757,23 | 3.695,33 | 164,99 | 46.731,61 | 35.333,33 | 10.164,13 | 934,63 | 56.895,73 |
| 10 | 0 | 30 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Kontroller: Ocak–Mart ve Ekim–Aralık pasif; sürekli `yol` dahil her şey 0 (kural a). Nisan: `istOran = 15/30` →
`istGV = 2.105,66`; `taban = 33.030/30 × 15 = 16.515`; `BK = 0,15 × 27.071,44 − 2.105,66 = 1.955,05`; maaş gün oranında
(`50.000/30 × 15 = 25.000`), yol tam (2.000) → `DD = 27.000`. Mayıs'ta `BB` kişi A'nın Ocak brütüyle aynıdır (kümülatif
matrah hâlâ ilk dilimde). Yıl: **425.708,55 TL**.

**G — zam ayı.** Beyaz yaka, `maasEski 40.000`, `maasYeni 50.000`, `zamAyi 7`.

| Ay | AM | BB | CY | DD | DM |
|---|---|---|---|---|---|
| 6 | 40.000 | 52.851,65 | 4.773,46 | 40.000,00 | 64.346,88 |
| 7 | 50.000 | 67.238,07 | 6.892,72 | 50.000,00 | 81.862,35 |

Yıl: **877.226,18 TL** (6 ay × 40.000 + 6 ay × 50.000 net).

**T — SGK tavanı üstü.** Beyaz yaka, net 300.000, kanun `05510`; Mart `prim 100.000`.

| Ay | BB | CF | BC | CG | CW | CY | DD | DE | DF | DG | DM |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 405.989,80 | 0 | 41.617,80 | 0 | 41.617,80 | 58.568,53 | 300.000,00 | 64.656,23 | 5.945,40 | 5.945,40 | 470.646,02 |
| 3 | 454.159,05 | 138.425,55 | 41.617,80 | 0 | 41.617,80 | 143.747,08 | 400.000,00 | 64.656,23 | 5.945,40 | 5.945,40 | 657.240,83 |
| 12 | 513.606,51 | 0 | 41.617,80 | 0 | 41.617,80 | 165.368,44 | 300.000,00 | 64.656,23 | 5.945,40 | 5.945,40 | 578.262,74 |

Kontrol: `BB/30 = 13.533 > tavanG = 9.909` → `BC = 0,14 × 297.270 = 41.617,80`, `BD = 2.972,70`;
`DE = 0,2175 × 297.270 = 64.656,23`; `DF = DG = 0,02 × 297.270 = 5.945,40`. Mart'ta tavan dolu olduğundan prim SGK'ya
girmez (`CG = CH = 0`), yalnız GV ve DV doğurur. Yıl: **6.747.519,38 TL**.

**S — SGK'sız.** Hesap türü `SGKSIZ` (kol YOK), kanun `YOK`, net 50.000.

| Ay | BB | BC | CY | DA | DD | DE | DM |
|---|---|---|---|---|---|---|---|
| 1 | 54.056,79 | 0 | 3.897,19 | 159,59 | 50.000,00 | 0 | 54.056,79 |
| 12 | 61.093,01 | 0 | 10.880,01 | 213,00 | 50.000,00 | 0 | 61.093,01 |

Kontrol: `BB = (50.000 − 4.211,325 − 250,6977) / (1 − 0,15 − 0,00759) = 45.537,98 / 0,84241 = 54.056,79`; SGK, işveren
payı ve teşvik yok → maliyet = brüt. Asgari ücret istisnası uygulanır (`istisna = 1`). Yıl: **694.356,98 TL**.

---

## 7. Belirsiz / doğrulanamayan noktalar

1. **AR-GE GV ve DV teşviki formülü** (§3.10): GV teşvik matrahına mesai matrahı (`BP`) girmez ama oran ayın bütün
   matrahının ortalamasıdır; `istGV` AR-GE günü oranıyla (`AP/AR`) ölçeklenmez; DV teşviki `gvTesvik` oranıyla
   çarpılmaz ve matrahına brüt mesai (`BM`) girmez; `istMatrahDV` `istisna = 0` olan türde de düşülür. Kod böyledir;
   mevzuata uygunluğu bu belgede değerlendirilmedi.
2. **AR-GE günü eşiği.** Kişiye girilmemiş AR-GE günü için çalışmanın `arge_gun` ayarı yalnız `gvTesvik ≥ argeEsik`
   (yıl parametresi `arge_gv_esik`, vars. 0,8) olan kişiye uygulanır (`hesap.js:ayHesapla`). `api.js`'teki
   `AYLIK_SUREKLI` yorumu ("girilmemişse çalışmanın AR-GE günü ayarı kullanılır") bu eşiği anmaz. Kişiye girilen gün
   eşikten bağımsız geçerlidir.
3. **`BA`** (TOPLAM NET ÖDEME) yakıtı (`AO`) iki kez sayar (`AS` ve `AZ` içinde); yalnız gösterimdir, hiçbir hesaba girmez.
4. **`AQ` kenar durumu.** `AQ`'ya ayın gün sayısından farklı ve 30'dan büyük bir değer girilirse (örn. 30 günlük ayda 31)
   `AR = 31` olur: ücret `31/30` ay, istisna 1 ile sınırlı. Kodda bu durum için koruma yok.
5. **Kısmi ayda ek ödemeler.** Maaş gün oranındadır, yol / prim / aynî / yakıt ise girilen tutarla tam yazılır
   (§6.4 kişi F, Nisan). Bilinçli olup olmadığı koddan çıkmaz; gerekirse kısmi aya oranlanmış tutar girilmelidir.
6. **Yıl içinde giren kişiye düzeltme.** Öngörü sıfırlanır ama `duzeltme` yine eklenir (§5.2). Bilinçli olup olmadığı
   koddan çıkmaz.
7. **`AN` yaklaşık değerdir.** Sakatlık indiriminin vergi etkisi kümülatif matrahın düştüğü dilimin marjinal oranıyla
   hesaplanır; indirim tutarının dilim sınırını aştığı ayda kesin vergi farkından biraz sapar.
8. **`r.AP` ham değerdir.** Hesapta `min(AP, AR)` kullanılır; dönüş nesnesindeki `r.AP` sınırlanmamıştır. `r.AP`'yi
   gösteren ya da dışa aktaran yer sigorta gününü aşan bir değer gösterebilir.
9. **Yeni yıla taşımada Ocak kaydı.** `calismaPersonelKopyala('YENI_YIL')` sürekli kişi alanlarının Aralık değerini
   `aylik_girdi`'nin 2.–12. aylarından okur; Ocak'a (`ay = 1`) yazılmış bir `aylik_girdi` kaydı (ör. toplu girişle)
   hesapta geçerli olduğu hâlde taşımada dikkate alınmaz, kişi satırındaki değer taşınır.
10. **Sıfır girilen parametreler.** `mesai_gun_saat = 0` sessizce 7,5, `zam_yuvarla = 0` (ya da çalışma ayarı
    `zam.yuvarla_ongoru = 0`) sessizce 10 sayılır (`||`); mesai katsayıları ve AR-GE eşiği için 0 geçerli değerdir
    (`== null`). Parametre ekranı bu ayrımı göstermez.
11. **Bozuk değerlendirme modeli.** `performansModeli` / `calismaPerformansModeli`, kayıtlı `perf.model` JSON'u
    çözülemezse ya da `PERF.hazirla` denetiminden geçmezse hata vermeden varsayılan modele döner. `performansModeliYaz`
    hatalı modeli kaydetmediği için bu yalnız tabloya dışarıdan yazılmış kayıtta olur; o durumda hesap, kullanıcının
    düzenlediği modelle değil varsayılanla yapılır.
12. **Ek puan sınırı yalnız girişte.** `sinir` ekranda ve Excel şablonunda denetlenir; `performansGirdiYaz` ve
    `PERF.hesapla` denetlemez. API'den ya da dışarıdan yazılmış sınır dışı değer hesaba olduğu gibi girer (ör. `esik`
    türünde eşiğin altındaki çok büyük eksi değer eksi puan doğurur).
13. **Kriter ağırlık toplamı.** `PERF.hazirla` toplamı 100 olmayan kriter ağırlıklarını reddetmez (ekran yalnız uyarır).
    Toplam 100 değilse amir puanı ölçeklenir; bölüm katsayısı etkilenmez ama ek puanların değerlendirmeye göre payı
    değişir, dolayısıyla çarpanlar da değişir.
