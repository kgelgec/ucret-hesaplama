/* =====================================================================
   BAŞLANGIÇ VERİSİ
   ---------------------------------------------------------------------
   SEED_YUKLE        — veritabanı ilk oluşturulduğunda: 2026 yılının yasal
                       parametreleri (asgari ücret, GV tarifesi, SGK oranları,
                       sakatlık indirimi). Gruplar ve personel YOKTUR.
                       ⚠ Yasal rakamları her yıl resmî kaynaktan kontrol edin.
   ORNEK_VERI_YUKLE  — isteğe bağlı örnek veri (data/ornek-veri.js): iki grup,
                       uydurma personel, 2026 onaylı ve 2027 taslak çalışmalar.
                       İlk kurulumda "Örnek veriyle başla" seçilince ya da
                       Sistem ekranından çağrılır.

   İkisi de yeniden çalıştırılabilir: var olan kayıtlar INSERT OR IGNORE ile atlanır.
   ===================================================================== */
window.SEED_YUKLE = function (db) {
  'use strict';
  const YIL = 2026;
  const c = db.calistir;

  /* ---------- Parametreler (zam kademesi varsayılanları örnektir) ---------- */
  const PARAM = {
    durum: 'RESMI', tavan_carpan: 9, dv: 0.00759, istisna_kesinti: 0.15, bes_orani: 0.03,
    t05510: 0.02, t05746: 0.1975 / 2, t14857: 0.1975, t15510: 0.05,
    'zam.M.alt_esik': 50000, 'zam.M.ust_esik': 100000, 'zam.M.ust_oran': 0.30, 'zam.M.alt_oran': 0.25,
    'zam.B.alt_esik': 50000, 'zam.B.ust_esik': 100000, 'zam.B.ust_oran': 0.30, 'zam.B.alt_oran': 0.25,
  };
  Object.keys(PARAM).forEach(k =>
    c(`INSERT OR IGNORE INTO parametre (yil, anahtar, deger) VALUES (?,?,?)`, [YIL, k, String(PARAM[k])]));

  [[190000, 0.15], [400000, 0.20], [1500000, 0.27], [5300000, 0.35], [null, 0.40]].forEach((d, i) =>
    c(`INSERT OR IGNORE INTO gv_dilim (yil, sira, ust_sinir, oran) VALUES (?,?,?,?)`, [YIL, i + 1, d[0], d[1]]));

  c(`INSERT OR IGNORE INTO asgari_ucret (yil, baslangic_ay, brut) VALUES (?,?,?)`, [YIL, 1, 33030]);

  [[1, 12000], [2, 7000], [3, 3000]].forEach(s =>
    c(`INSERT OR IGNORE INTO sakatlik_derece (yil, derece, tutar) VALUES (?,?,?)`, [YIL, s[0], s[1]]));

  [
    ['SSK',    'SSK (4/a — tüm sigorta kolları)', 'SSK',  0.14,  0.01, 0.2175, 0.02, 1, 1, 1, 1,
     'Normal çalışan'],
    ['EMK',    'Emekli (SGDP)',                   'SGDP', 0.075, 0,    0.2475, 0,    1, 1, 1, 2,
     'Emekli çalışan — sosyal güvenlik destek primi'],
    ['SGKSIZ', 'SGK\'sız (huzur hakkı / danışman)', 'YOK', 0,    0,    0,      0,    1, 1, 1, 3,
     'SGK primi hesaplanmaz; yalnızca gelir ve damga vergisi'],
  ].forEach(t => c(`INSERT OR IGNORE INTO hesap_turu (yil, kod, ad, kol, sgk_isci, issizlik_isci,
      sgk_isveren, issizlik_isveren, gv, dv, istisna, sira, aciklama) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [YIL].concat(t)));
};

/* Örnek veriyi yükler. db = { calistir, deger, tumu, islem }.
   2026 çalışmaları ONAYLI olarak kurulur (parametreleri ve tarihleri dondurulur). 2027 için
   programın kendi işlemleri kullanılır: Parametreler → Yeni Yıl Öngörüsü (%25) ve "önceki
   yılın çalışmasından" yeni çalışma — bunlar oturum açmış yöneticinin yetkisiyle çalışır.
   Dönüş: { gruplar, kisi, calisma } */
window.ORNEK_VERI_YUKLE = function (db) {
  'use strict';
  const V = window.ORNEK_VERI;
  if (!V) throw new Error('Örnek veri dosyası (data/ornek-veri.js) yüklenmemiş.');
  const YIL = V.yil, AD = YIL + ' Bütçe', c = db.calistir;
  const simdi = new Date().toISOString();
  const kurulan = [];

  db.islem(() => {
    V.gruplar.forEach(g => {
      c(`INSERT OR IGNORE INTO grup (kod, ad, sira) VALUES (?,?,?)`, [g.kod, g.ad, g.sira]);
      if (!db.deger(`SELECT COUNT(*) FROM butce_bolumu WHERE grup_kod = ?`, [g.kod]))
        g.bolumler.forEach((b, i) => c(`INSERT INTO butce_bolumu (grup_kod, ad, sira) VALUES (?,?,?)`, [g.kod, b, i + 1]));

      if (db.deger(`SELECT id FROM calisma WHERE yil = ? AND grup_kod = ? AND ad = ?`, [YIL, g.kod, AD])) return;
      c(`INSERT INTO calisma (yil, grup_kod, ad, durum, zam_kademe, zam_performans, aciklama, olusturma)
         VALUES (?, ?, ?, 'TASLAK', 1, ?, ?, ?)`, [YIL, g.kod, AD, g.performans ? 1 : 0, 'Örnek veri — onaylı bütçe', simdi]);
      const id = db.deger(`SELECT id FROM calisma WHERE yil = ? AND grup_kod = ? AND ad = ?`, [YIL, g.kod, AD]);
      Object.keys(g.ayar || {}).forEach(k =>
        c(`INSERT OR IGNORE INTO calisma_ayar (calisma_id, anahtar, deger) VALUES (?,?,?)`, [id, k, String(g.ayar[k])]));

      const kisiler = V.personel.filter(p => p.grup === g.kod);
      kisiler.forEach((p, i) => {
        c(`INSERT OR IGNORE INTO personel (tc_kimlik_no, ad_soyad, ise_giris, isten_ayrilis, bolum, ekip, gorev, kaynak, guncelleme)
           VALUES (?,?,?,?,?,?,?, 'ORNEK', ?)`, [p.tc, p.ad, p.ise_giris, p.cikis, p.bolum, null, p.gorev, simdi]);
        c(`INSERT INTO calisma_personel (calisma_id, tc_kimlik_no, sira, butce_bolumu, yaka, maas_eski, zam_ayi, duzeltme,
             maliyet_onceki, hesap_turu, sakatlik_derece, bes, kanun, gv_tesvik, yol)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [id, p.tc, i + 1, p.butce_bolumu, p.yaka, p.maas_eski, p.zam_ayi || 1, p.duzeltme || 0, p.maliyet_onceki,
           p.hesap_turu, p.sakatlik_derece, p.bes, p.kanun, p.gv_tesvik || 0, p.yol || 0]);
        Object.keys(p.ay || {}).forEach(m => Object.keys(p.ay[m]).forEach(al =>
          c(`INSERT OR IGNORE INTO aylik_girdi (calisma_id, tc_kimlik_no, ay, alan, deger) VALUES (?,?,?,?,?)`,
            [id, p.tc, Number(m), al, String(p.ay[m][al])])));
      });

      if (g.performans) {
        const girdi = [];
        kisiler.forEach(p => {
          const pg = V.performans[p.tc];
          if (!pg) return;
          Object.keys(pg).forEach(al => c(`INSERT OR IGNORE INTO performans_girdi (calisma_id, tc_kimlik_no, alan, deger) VALUES (?,?,?,?)`,
                                          [id, p.tc, al, String(pg[al])]));
          girdi.push({ tc: p.tc, yaka: p.yaka, g: pg });
        });
        /* Çarpanlar örnek modelden hesaplanıp zam hesabına uygulanır ("Çarpanları uygula" ile aynı) */
        const sonuc = window.PERF ? window.PERF.hesapla(girdi) : { kisi: {} };
        Object.keys(sonuc.kisi).forEach(tc => c(`UPDATE calisma_personel SET performans_carpani = ? WHERE calisma_id = ? AND tc_kimlik_no = ?`,
                                                [sonuc.kisi[tc].carpan, id, tc]));
      }
      if (g.mesai) (V.mesai || []).forEach(x =>
        c(`INSERT OR IGNORE INTO mesai_ongoru (calisma_id, yaka, bolum, ay, alan, deger) VALUES (?,?,?,?,?,?)`, [id].concat(x)));
      kurulan.push({ grup: g.kod, id: id });
    });
  });

  /* Özet: bütçelenen tutar = hesaplanan maliyetin %2 fazlası (bin TL'ye yuvarlı), önceki yıl = önceki yıl maliyetleri */
  const API_ = window.API;
  kurulan.forEach(k => {
    API_.onbellekTemizle();
    const h = API_.calismaHesapla(k.id, { tazele: true });
    const t = { B: 0, M: 0 }, o = { B: 0, M: 0 };
    h.kisiler.forEach(s => { t[s.kp.yaka] += s.yil.maliyet; o[s.kp.yaka] += s.kp.maliyet_onceki || 0; });
    db.islem(() => {
      ['B', 'M'].forEach(y => {
        c(`INSERT OR IGNORE INTO calisma_ozet (calisma_id, anahtar, deger) VALUES (?,?,?)`, [k.id, 'butce_' + y, Math.round(t[y] * 1.02 / 1000) * 1000]);
        c(`INSERT OR IGNORE INTO calisma_ozet (calisma_id, anahtar, deger) VALUES (?,?,?)`, [k.id, 'onceki_' + y, Math.round(o[y] * 100) / 100]);
      });
      c(`UPDATE calisma SET durum = 'ONAYLI' WHERE id = ?`, [k.id]);
      window.ONAY_TARIH_DONDUR(c, k.id);
      window.PARAMETRE_DONDUR(c, db.tumu, k.id);
    });
  });

  /* 2027: yasal parametre öngörüsü (%25) ve önceki yılın çalışmasından taslak bütçe */
  let calisma = kurulan.length;
  if (kurulan.length && !db.deger(`SELECT COUNT(*) FROM asgari_ucret WHERE yil = ?`, [YIL + 1])) {
    API_.ongoruUygula({ kaynakYil: YIL, hedefYil: YIL + 1, oran: 0.25, dilimAdim: 1000, sakatlikAdim: 100 });
  }
  kurulan.forEach(k => {
    if (db.deger(`SELECT COUNT(*) FROM calisma WHERE yil = ? AND grup_kod = ?`, [YIL + 1, k.grup])) return;
    const yeni = API_.calismaKaydet({ yil: YIL + 1, grup_kod: k.grup, ad: (YIL + 1) + ' Bütçe', aciklama: 'Örnek veri — taslak' });
    API_.calismaPersonelKopyala(k.id, yeni, 'YENI_YIL');
    /* Yeni yıla kendiliğinden geçmeyenler (programda kullanıcı girer): mesai tablosu ve AR-GE günleri */
    if (db.deger(`SELECT COUNT(*) FROM mesai_ongoru WHERE calisma_id = ?`, [k.id])) API_.mesaiKopyala(yeni, k.id);
    const arge = V.personel.filter(p => p.grup === k.grup && p.ay[1] && p.ay[1].arge_gun).map(p => p.tc);
    if (arge.length) API_.aylikGirdiToplu(yeni, 1, 'arge_gun', 22, arge);
    /* Yönetimin düzeltmesi yeni yıla taşınmaz; örnekte görünsün diye aynı kişilere yeniden girilir */
    V.personel.filter(p => p.grup === k.grup && p.duzeltme && !p.cikis)
      .forEach(p => API_.calismaPersonelAlanYaz(yeni, p.tc, 'duzeltme', p.duzeltme));
    calisma++;
  });
  API_.onbellekTemizle();
  return { gruplar: V.gruplar.length, kisi: V.personel.length, calisma: calisma };
};
