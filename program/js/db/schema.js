/* =====================================================================
   ÜCRET HESAPLAMA — VERİTABANI ŞEMASI (SQLite)
   ---------------------------------------------------------------------
   Bu şema hem tarayıcıda (sql.js) hem sunucuda değiştirilmeden çalışır.

   TEMEL KURALLAR
   - Personel kimliği T.C. Kimlik No'dur (PRIMARY KEY). Bağlantılar
     ON UPDATE CASCADE ile tanımlıdır; hatalı T.C. düzeltildiğinde
     bütçe ve aylık girdi kayıtları yeni numarayı takip eder.
   - "Grup" bütçenin tutulduğu birimdir (örn. Ofis, Üretim); gruplar
     Tanımlar ekranından açılır. "Çalışma" bir grubun bir yıllık
     bütçe/zam çalışmasıdır (örn. 2026 · Ofis).
   - Tutarlar NET'tir; brüt ve maliyet hesap motorunda
     (js/core/hesap.js) üretilir, veritabanında saklanmaz.
   - Parametreler YIL bazındadır; yeni yıl açıldığında önceki yıldan
     kopyalanır ve yalnızca değişenler düzeltilir.
   ===================================================================== */

window.SEMA_SURUM = 1;

window.SEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sistem_bilgi (
  anahtar TEXT PRIMARY KEY,
  deger   TEXT
);

/* ---------------------------------------------------------------
   KULLANICI VE YETKİ
   Rol yoktur: yönetici her kullanıcıya yetkileri ve görebileceği
   grupları tek tek atar. yonetici = 1 olan kullanıcı her şeyi görür
   ve yetki atar.
   --------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS kullanici (
  kullanici_adi TEXT PRIMARY KEY,
  ad_soyad      TEXT NOT NULL,
  parola_hash   TEXT NOT NULL,
  tuz           TEXT NOT NULL,
  yonetici      INTEGER NOT NULL DEFAULT 0,
  aktif         INTEGER NOT NULL DEFAULT 1,
  son_giris     TEXT,
  olusturma     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kullanici_yetki (
  kullanici_adi TEXT NOT NULL REFERENCES kullanici(kullanici_adi)
                  ON UPDATE CASCADE ON DELETE CASCADE,
  yetki_kod     TEXT NOT NULL,
  PRIMARY KEY (kullanici_adi, yetki_kod)
);

/* Grup erişimi: kaydı olmayan grup kullanıcıya hiç görünmez.
   yazma = 0 ise yalnızca görüntüler. */
CREATE TABLE IF NOT EXISTS kullanici_grup (
  kullanici_adi TEXT NOT NULL REFERENCES kullanici(kullanici_adi)
                  ON UPDATE CASCADE ON DELETE CASCADE,
  grup_kod      TEXT NOT NULL REFERENCES grup(kod) ON UPDATE CASCADE ON DELETE CASCADE,
  yazma         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kullanici_adi, grup_kod)
);

CREATE TABLE IF NOT EXISTS islem_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tarih         TEXT NOT NULL,
  kullanici_adi TEXT,
  islem         TEXT NOT NULL,
  tablo         TEXT,
  kayit_anahtar TEXT,
  detay         TEXT
);
CREATE INDEX IF NOT EXISTS ix_log_tarih ON islem_log(tarih);

/* ---------------------------------------------------------------
   TANIMLAR
   --------------------------------------------------------------- */
/* maas_araliklari: Maaş Dağılımı tablosunun SABİT aralık alt sınırları
   ("60000;70000;80000"). Boş = her çalışmada maaşlara göre OTOMATİK. */
CREATE TABLE IF NOT EXISTS grup (
  kod  TEXT PRIMARY KEY,
  ad   TEXT NOT NULL,
  sira INTEGER NOT NULL DEFAULT 0,
  maas_araliklari TEXT
);

/* Bütçe bölümü ("01 YÖNETİM" …). Gruba bağlıdır; numara ayrı "sira" alanındadır. */
CREATE TABLE IF NOT EXISTS butce_bolumu (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  grup_kod TEXT NOT NULL REFERENCES grup(kod) ON UPDATE CASCADE,
  ad       TEXT NOT NULL,
  sira     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (grup_kod, ad)
);

/* Hesaplama türü (SSK / emekli / SGK'sız).
   kol:  SSK  = tüm sigorta kolları (4/a)
         SGDP = emekli, sosyal güvenlik destek primi
         YOK  = SGK'sız (huzur hakkı, danışman…) — yalnızca GV ve DV
   gv / dv / istisna: gelir vergisi, damga vergisi ve asgari ücret
   istisnası uygulanır mı (1/0). */
CREATE TABLE IF NOT EXISTS hesap_turu (
  yil               INTEGER NOT NULL,
  kod               TEXT NOT NULL,
  ad                TEXT NOT NULL,
  kol               TEXT NOT NULL DEFAULT 'SSK',
  sgk_isci          REAL NOT NULL DEFAULT 0,
  issizlik_isci     REAL NOT NULL DEFAULT 0,
  sgk_isveren       REAL NOT NULL DEFAULT 0,
  issizlik_isveren  REAL NOT NULL DEFAULT 0,
  gv                INTEGER NOT NULL DEFAULT 1,
  dv                INTEGER NOT NULL DEFAULT 1,
  istisna           INTEGER NOT NULL DEFAULT 1,
  sira              INTEGER NOT NULL DEFAULT 0,
  aciklama          TEXT,
  PRIMARY KEY (yil, kod)
);

/* Kanun (teşvik) türü.
   kural: motorun tanıdığı teşvik kuralı (YOK/05510/05746/14857/15510).
   Ad serbesttir; kural kodu hesabı belirler. */
CREATE TABLE IF NOT EXISTS kanun_turu (
  kod      TEXT PRIMARY KEY,
  ad       TEXT NOT NULL,
  kural    TEXT NOT NULL DEFAULT 'YOK',
  aciklama TEXT,
  sira     INTEGER NOT NULL DEFAULT 0,
  /* 05510 indirim oranı bu kanunda farklıysa (imalat %5, diğer %2). Boş = yılın
     parametresi (t05510). Yalnızca kural '05510' olan türde kullanılır. */
  oran     REAL
);

/* Sakatlık indirimi (derece → aylık tutar) */
CREATE TABLE IF NOT EXISTS sakatlik_derece (
  yil    INTEGER NOT NULL,
  derece INTEGER NOT NULL,
  tutar  REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (yil, derece)
);

/* ---------------------------------------------------------------
   PARAMETRELER (yıl bazında)
   --------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS parametre (
  yil     INTEGER NOT NULL,
  anahtar TEXT NOT NULL,
  deger   TEXT,
  PRIMARY KEY (yil, anahtar)
);

/* Gelir vergisi tarifesi. ust_sinir NULL = son dilim (sınırsız). */
CREATE TABLE IF NOT EXISTS gv_dilim (
  yil       INTEGER NOT NULL,
  sira      INTEGER NOT NULL,
  ust_sinir REAL,
  oran      REAL NOT NULL,
  PRIMARY KEY (yil, sira)
);

/* Brüt asgari ücret; baslangic_ay'dan itibaren geçerli (1. / 2. dönem). */
CREATE TABLE IF NOT EXISTS asgari_ucret (
  yil          INTEGER NOT NULL,
  baslangic_ay INTEGER NOT NULL,
  brut         REAL NOT NULL,
  PRIMARY KEY (yil, baslangic_ay)
);

/* Performans puanı → zam çarpanı (isteğe bağlı). */
CREATE TABLE IF NOT EXISTS performans_kademe (
  yil      INTEGER NOT NULL,
  alt_puan REAL NOT NULL,
  ust_puan REAL NOT NULL,
  carpan   REAL NOT NULL,
  PRIMARY KEY (yil, alt_puan)
);

/* ---------------------------------------------------------------
   PERSONEL — kimlik ve istihdam bilgisi
   kaynak: ELLE (ekrandan) / ERP (dış listeden aktarım) / ORNEK (örnek veri)
   --------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS personel (
  tc_kimlik_no  TEXT PRIMARY KEY,
  ad_soyad      TEXT NOT NULL,
  ise_giris     TEXT,
  isten_ayrilis TEXT,
  bolum         TEXT,
  ekip          TEXT,
  gorev         TEXT,
  kaynak        TEXT NOT NULL DEFAULT 'ELLE',
  guncelleme    TEXT
);
CREATE INDEX IF NOT EXISTS ix_personel_ad ON personel(ad_soyad);

/* ---------------------------------------------------------------
   BÜTÇE ÇALIŞMASI — bir grubun bir yılı
   zam_kademe     : zam öngörüsünde maaş kademesi kullanılsın
   zam_performans : zam öngörüsünde performans çarpanı kullanılsın
   --------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS calisma (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  yil            INTEGER NOT NULL,
  grup_kod       TEXT NOT NULL REFERENCES grup(kod) ON UPDATE CASCADE,
  ad             TEXT NOT NULL,
  durum          TEXT NOT NULL DEFAULT 'TASLAK',
  zam_kademe     INTEGER NOT NULL DEFAULT 1,
  zam_performans INTEGER NOT NULL DEFAULT 0,
  aciklama       TEXT,
  olusturma      TEXT NOT NULL,
  UNIQUE (yil, grup_kod, ad)
);

/* Özet ekranının elle girilen değerleri (bütçelenen tutar, önceki yıl
   maliyeti) — anahtar örn. 'butce_B' (beyaz yaka), 'onceki_M' (mavi yaka). */
CREATE TABLE IF NOT EXISTS calisma_ozet (
  calisma_id INTEGER NOT NULL REFERENCES calisma(id) ON DELETE CASCADE,
  anahtar    TEXT NOT NULL,
  deger      REAL,
  PRIMARY KEY (calisma_id, anahtar)
);

/* Çalışmaya özel ayarlar — yıl parametresini bu çalışma için geçersiz kılar:
   zam kademesi ('zam.M.alt_esik', 'zam.B.ust_oran' …), zam yuvarlaması,
   teşvik oranları, varsayılan çalışılan gün ('gun.M.8'), mesai öngörüsü.
   Kayıt yoksa yılın parametresi geçerlidir. */
CREATE TABLE IF NOT EXISTS calisma_ayar (
  calisma_id INTEGER NOT NULL REFERENCES calisma(id) ON DELETE CASCADE,
  anahtar    TEXT NOT NULL,
  deger      TEXT,
  PRIMARY KEY (calisma_id, anahtar)
);

/* Çalışmadaki personel — bütçenin bir satırı.
   Ocak'ın aylık girdileri (hesap türü, kanun, sakatlık…) burada;
   sonraki aylar değişmedikçe bunları devralır (aylik_girdi).

   maas_eski   : önceki yılın NET aylık maaşı (zam bunun üzerine hesaplanır)
   duzeltme    : zam öngörüsüne elle müdahale (yönetimin düzeltmesi)
   maliyet_onceki : önceki yıl toplam maliyeti
   karsilastirma  : karşılaştırma maaşı (bilgi amaçlı)
   onay_sabit / onay_giris / onay_cikis : çalışma onaylandığı andaki işe giriş ve
                 çıkış tarihleri. Personel kartına sonradan yazılan çıkış onaylı
                 maliyeti değiştirmesin diye hesap bunları kullanır (onay_sabit = 1).
                 onay_sabit = 2: çalışmanın KENDİ dönem tarihleri — kişi sonra başka dönemde / grupta
                 yeniden girdiğinde eski çalışma eski giriş-çıkışını korur.
                 Taslağa alınınca silinir; güncel tarihler geçerli olur. */
CREATE TABLE IF NOT EXISTS calisma_personel (
  calisma_id         INTEGER NOT NULL REFERENCES calisma(id) ON DELETE CASCADE,
  tc_kimlik_no       TEXT NOT NULL REFERENCES personel(tc_kimlik_no)
                       ON UPDATE CASCADE ON DELETE CASCADE,
  sira               INTEGER NOT NULL DEFAULT 0,
  butce_bolumu       TEXT,
  yaka               TEXT NOT NULL DEFAULT 'B',
  maas_eski          REAL NOT NULL DEFAULT 0,
  zam_ayi            INTEGER NOT NULL DEFAULT 1,
  duzeltme           REAL NOT NULL DEFAULT 0,
  performans_puani   REAL,
  performans_carpani REAL,
  maliyet_onceki     REAL,
  karsilastirma      REAL,
  hesap_turu         TEXT,
  sakatlik_derece    INTEGER,
  ozurlu_indirimi    REAL NOT NULL DEFAULT 0,
  bes                TEXT,
  kanun              TEXT,
  gv_tesvik          REAL NOT NULL DEFAULT 0,
  yol                REAL NOT NULL DEFAULT 0,
  not_metni          TEXT,
  onay_sabit         INTEGER NOT NULL DEFAULT 0,
  onay_giris         TEXT,
  onay_cikis         TEXT,
  PRIMARY KEY (calisma_id, tc_kimlik_no)
);

/* Aylık girdiler — yalnızca Ocak'tan (ya da önceki aydan) farklı olan.
   SÜREKLİ alanlar (hesap_turu, kanun, sakatlik_derece, ozurlu_indirimi,
   bes, gv_tesvik, yol, fm1, fm2, arge_gun) sonraki aylara devreder.
   O AYA ÖZGÜ alanlar (ayni, prim, yakit, calisilan_gun) devretmez;
   girilmeyen ay 0 / varsayılandır. */
CREATE TABLE IF NOT EXISTS aylik_girdi (
  calisma_id   INTEGER NOT NULL REFERENCES calisma(id) ON DELETE CASCADE,
  tc_kimlik_no TEXT NOT NULL REFERENCES personel(tc_kimlik_no)
                 ON UPDATE CASCADE ON DELETE CASCADE,
  ay           INTEGER NOT NULL,
  alan         TEXT NOT NULL,
  deger        TEXT,
  PRIMARY KEY (calisma_id, tc_kimlik_no, ay, alan)
);
CREATE INDEX IF NOT EXISTS ix_aylik_calisma ON aylik_girdi(calisma_id, ay);

/* Performans değerlendirmesi — kişi başına alan/değer. Alanlar js/core/performans.js'te
   (amir1…amir5, a<N>.<kriter>, ek alanlar — hepsi çalışmanın değerlendirme modelinden). Puan ve çarpan
   kayıtlı değildir, her açılışta hesaplanır; zam hesabına "Çarpanları uygula" ile geçer. */
CREATE TABLE IF NOT EXISTS performans_girdi (
  calisma_id   INTEGER NOT NULL REFERENCES calisma(id) ON DELETE CASCADE,
  tc_kimlik_no TEXT NOT NULL REFERENCES personel(tc_kimlik_no)
                 ON UPDATE CASCADE ON DELETE CASCADE,
  alan         TEXT NOT NULL,
  deger        TEXT,
  PRIMARY KEY (calisma_id, tc_kimlik_no, alan)
);

/* Mesai öngörüsü — bölüm × ay. alan: fm1 (hafta içi toplam saat, yalnız mavi yaka),
   fm2 (hafta sonu toplam saat), kisi (personel sayısı; boş = çalışmadaki mevcut kadro).
   Takvim satırları (yaka = '' ve bolum = ''): gun, tatil_mesai, tatil_tam, tatil_yok — bilgi amaçlı.
   Kişi başı mesai = bölümün saati / kişi sayısı. Çalışmanın mesai tutarlarını yalnız
   calisma_ayar 'mesai.ongoru' = 1 iken belirler. */
CREATE TABLE IF NOT EXISTS mesai_ongoru (
  calisma_id   INTEGER NOT NULL REFERENCES calisma(id) ON DELETE CASCADE,
  yaka         TEXT NOT NULL,
  bolum        TEXT NOT NULL,
  ay           INTEGER NOT NULL,
  alan         TEXT NOT NULL,
  deger        REAL,
  PRIMARY KEY (calisma_id, yaka, bolum, ay, alan)
);

/* Onaylı çalışmanın parametreleri. Onay anında yılın bütün hesap parametreleri (genel oranlar,
   GV dilimleri, asgari ücret, hesaplama türleri, kanun türleri, sakatlık, performans kademesi) JSON
   olarak burada dondurulur; onaylı çalışma HER ZAMAN bununla hesaplanır. Böylece Ocak'ta resmî
   rakamlar Parametreler'e girildiğinde onaylı maliyet değişmez, yalnız taslak / revize çalışmalar
   değişir. Taslağa alınınca silinir (güncel parametreler geçerli olur). */
CREATE TABLE IF NOT EXISTS calisma_parametre (
  calisma_id   INTEGER PRIMARY KEY REFERENCES calisma(id) ON DELETE CASCADE,
  yil          INTEGER NOT NULL,
  veri         TEXT NOT NULL,
  tarih        TEXT
);
`;

/* =====================================================================
   YETKİLER — yönetici bunları kullanıcı bazında atar.
   YENİ MODÜL EKLERKEN BU LİSTEYE YETKİSİ EKLENMELİ.
   ===================================================================== */
window.YETKILER = [
  ['ozet.oku',        'Özet ve maliyet tablolarını görür'],
  ['personel.oku',    'Bütçe personel listesini görür'],
  ['personel.yaz',    'Bütçeye personel ekler / düzenler'],
  ['zam.oku',         'Zam çalışmasını görür'],
  ['zam.yaz',         'Zam düzeltmesi girer'],
  ['aylik.yaz',       'Aylık girdileri (ayni yardım, prim, mesai…) düzenler'],
  ['alan.tc',         'T.C. Kimlik No\'yu tam görür'],
  ['parametre.oku',   'Parametre ve tanımları görür'],
  ['parametre.yaz',   'Parametre ve tanımları değiştirir'],
  ['excel.aktar',     'Excel çıktısı alır / Excel\'den içeri aktarır'],
  ['sistem.yonet',    'Kullanıcı, yetki, yedek ve sistem ayarları'],
];

/* Sürüm yükseltmelerinde eklenen sütunlar: { tablo, sutun, tanim, doldur? }.
   Şema sürüm 1'dir; ileride sütun eklenirse buraya yazılır ve SEMA_SURUM artırılır. */
window.EKSIK_SUTUNLAR = [];

/* Onaylanan çalışmanın personelinin giriş/çıkış tarihlerini dondurur (zaten dondurulmuş
   satıra dokunmaz). Örnek veride ve Onaylı'ya alınırken çağrılır. */
window.ONAY_TARIH_DONDUR = function (calistir, calismaId) {
  calistir(`UPDATE calisma_personel SET onay_sabit = 1,
              onay_giris = (SELECT p.ise_giris FROM personel p WHERE p.tc_kimlik_no = calisma_personel.tc_kimlik_no),
              onay_cikis = (SELECT p.isten_ayrilis FROM personel p WHERE p.tc_kimlik_no = calisma_personel.tc_kimlik_no)
            WHERE calisma_id = ? AND onay_sabit = 0`, [calismaId]);
};
/* Yılın hesap parametrelerinin anlık görüntüsü — api.hesapParametre ile aynı kaynaklar */
window.PARAMETRE_ANLIK_AL = function (tumu, yil) {
  return {
    parametre: tumu(`SELECT anahtar, deger FROM parametre WHERE yil = ?`, [yil]),
    dilim: tumu(`SELECT * FROM gv_dilim WHERE yil = ? ORDER BY sira`, [yil]),
    asgari: tumu(`SELECT * FROM asgari_ucret WHERE yil = ? ORDER BY baslangic_ay`, [yil]),
    tur: tumu(`SELECT * FROM hesap_turu WHERE yil = ? ORDER BY sira, kod`, [yil]),
    kanun: tumu(`SELECT * FROM kanun_turu ORDER BY sira, kod`),
    sakatlik: tumu(`SELECT * FROM sakatlik_derece WHERE yil = ? ORDER BY derece`, [yil]),
    performans: tumu(`SELECT * FROM performans_kademe WHERE yil = ? ORDER BY alt_puan`, [yil]),
  };
};
/* Onaylı çalışmanın parametrelerini dondurur (var olanın üzerine yazmaz) */
window.PARAMETRE_DONDUR = function (calistir, tumu, calismaId) {
  const c = tumu(`SELECT yil FROM calisma WHERE id = ?`, [calismaId])[0];
  if (!c) return;
  calistir(`INSERT OR IGNORE INTO calisma_parametre (calisma_id, yil, veri, tarih) VALUES (?,?,?,?)`,
           [calismaId, c.yil, JSON.stringify(window.PARAMETRE_ANLIK_AL(tumu, c.yil)), new Date().toISOString()]);
};
/* Tablo göçleri (tabloyu yeniden kurmak gerektiğinde): { tablo, gerekliSutun, yeni, tasi } —
   tabloda gerekliSutun yoksa engine.js 'yeni' (CREATE TABLE <tablo>_yeni …) ve 'tasi' (INSERT … SELECT)
   betiklerini çalıştırır, eski tabloyu silip yenisini yerine adlandırır. Şimdilik yok. */
window.TABLO_GOC = [];

/* Temel veri — hem ilk kurulumda hem sürüm yükseltmesinde çalışır. Kanun türleri yalnız tablo
   BOŞSA yazılır: kullanıcı Tanımlar'dan bir türü silmiş ya da değiştirmişse yükseltme onu geri getirmez.
   05510: 2026'dan itibaren işveren prim indirimi imalat dışında 2 puan, imalatta 5 puan;
   iki ayrı tür tanımlıdır. Gruplar burada açılmaz: Tanımlar → Gruplar'dan ya da örnek veriyle gelir. */
window.TEMEL_VERI_YAZ = function (calistir) {
  const satirlar = [
    ['YOK',     'TABİ DEĞİL',            'YOK',   'Teşvik yok', 1, null],
    ['05510',   '05510 - %2',            '05510', 'SGK işveren payında 2 puan indirim (imalat dışı)', 2, 0.02],
    ['05510-5', '05510 - %5',            '05510', 'SGK işveren payında 5 puan indirim (imalat sektörü)', 3, 0.05],
    ['05746',   '05746 - ARGE',          '05746', 'AR-GE: işveren SGK payının yarısı + 05510 indirimi', 4, null],
    ['14857',   '14857 - ENGELLİ %100',  '14857', 'Engelli: asgari ücret üzerinden işveren payı', 5, null],
    ['15510',   '15510 - %5',            '15510', 'Emekli (SGDP) çalışanda %5 indirim', 6, null],
  ];
  calistir(`INSERT INTO kanun_turu (kod, ad, kural, aciklama, sira, oran)
            SELECT * FROM (VALUES ${satirlar.map(() => '(?,?,?,?,?,?)').join(',')})
            WHERE NOT EXISTS (SELECT 1 FROM kanun_turu)`, [].concat(...satirlar));
};

/* =====================================================================
   BÜTÇE BÖLÜMÜ ADI
   Dış listelerde sıra numarası çoğu zaman adın içine yazılır ("08 PAZARLAMA").
   Numara ayrı "sira" alanındadır; ad numarasız tutulur ve ekranda
   "08 PAZARLAMA" biçiminde gösterilir (bkz. bicim.js → B.bolum).
   ===================================================================== */
window.BOLUM_TEMIZLE = function (ad) {
  return String(ad == null ? '' : ad)
    .replace(/\s+/g, ' ').trim()
    .replace(/^\d{1,3}\s*[-.)]?\s+/, '')     // baştaki "08 ", "08- ", "8) "
    .trim();
};

/* Veri göçleri: { surum, ad, calistir(calistir, tumu) } — engine.js çalıştırır.
   Şema sürüm 1'dir; ileride veri dönüşümü gerekirse buraya eklenir. */
window.VERI_GOCLERI = [];
