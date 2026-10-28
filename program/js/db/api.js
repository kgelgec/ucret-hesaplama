/* =====================================================================
   VERİ ERİŞİM KATMANI
   ---------------------------------------------------------------------
   Uygulamadaki TÜM SQL sorguları bu dosyadadır. Modüller veritabanını
   doğrudan tanımaz.

   SUNUCUYA GEÇİŞ: bu dosyanın gövdesi fetch('/api/...') çağrılarıyla
   değiştirilir; modüller değişmez.
   ===================================================================== */
window.API = (function () {
  'use strict';

  const db = window.ADB;
  let aktifKullanici = null;
  let hesapOnbellek = {};

  let bolumOnbellek = {};
  function onbellekTemizle() { hesapOnbellek = {}; bolumOnbellek = {}; }

  /* Türkçe sayı: "40.000" → 40000, "1.234,5" → 1234.5, "0,25" → 0.25, "0.25" → 0.25.
     U.sayiCoz "40.000" değerini 40 okuyordu (nokta ondalık sanılıyordu). */
  function trSayi(s) {
    if (s == null || s === '') return 0;
    if (typeof s === 'number') return s;
    let t = String(s).trim().replace(/[^\d.,-]/g, '');
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    // "0.075" gibi oranlar binlik sanılmasın: 0 ile başlayan hep ondalıktır
    else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    const n = parseFloat(t);
    return isNaN(n) ? 0 : n;
  }

  /* ---------------------------------------------------------------
     KAYIT DEFTERİ
     --------------------------------------------------------------- */
  function log(islem, tablo, anahtar, detay) {
    try {
      db.calistir(
        `INSERT INTO islem_log (tarih, kullanici_adi, islem, tablo, kayit_anahtar, detay)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [U.simdi(), aktifKullanici ? aktifKullanici.kullanici_adi : null,
         islem, tablo || null, anahtar == null ? null : String(anahtar), detay || null]);
    } catch (e) { /* log yazılamazsa işlem engellenmez */ }
  }
  function logListe(limit) {
    return db.tumu(`SELECT * FROM islem_log ORDER BY id DESC LIMIT ?`, [limit || 300]);
  }

  /* ---------------------------------------------------------------
     KULLANICI / YETKİ
     Rol yok: yönetici her kullanıcıya yetki ve grup erişimini ayrı
     ayrı atar. yonetici = 1 olan kullanıcı her şeye erişir.
     --------------------------------------------------------------- */
  const PAROLA_DONGU = 60000;

  function parolaHashle(parola, tuz) {
    let h = U.sha256Hex(tuz + '|' + parola);
    for (let i = 0; i < PAROLA_DONGU; i++) h = U.sha256Hex(h);
    return 'sha256i$' + PAROLA_DONGU + '$' + h;
  }
  function parolaDogrula(parola, tuz, saklanan) {
    const p = String(saklanan || '').split('$');
    if (p[0] !== 'sha256i') return false;
    const dongu = Number(p[1]) || PAROLA_DONGU;
    let h = U.sha256Hex(tuz + '|' + parola);
    for (let i = 0; i < dongu; i++) h = U.sha256Hex(h);
    return h === p[2];
  }

  function kullaniciVarMi() { return (db.deger('SELECT COUNT(*) FROM kullanici') || 0) > 0; }

  function kullaniciListe() {
    return db.tumu(`SELECT kullanici_adi, ad_soyad, yonetici, aktif, son_giris, olusturma
                    FROM kullanici ORDER BY yonetici DESC, ad_soyad`);
  }

  /* Kullanıcı işlemleri yalnız sistem yöneticisi içindir; ekran dışından da
     çağrılamaz. Tek istisna ilk kurulum: hiç kullanıcı yokken ilk yönetici hesabı açılır. */
  function kullaniciEkle(kullaniciAdi, adSoyad, parola, yonetici) {
    if (kullaniciVarMi()) yetkiIste('sistem.yonet');
    const ka = String(kullaniciAdi || '').trim().toLowerCase();
    if (!ka) throw new Error('Kullanıcı adı boş olamaz.');
    if (!/^[a-z0-9._-]{3,}$/.test(ka))
      throw new Error('Kullanıcı adı en az 3 karakter olmalı; yalnızca harf, rakam, nokta, tire kullanın.');
    if (!parola || parola.length < 6) throw new Error('Parola en az 6 karakter olmalıdır.');
    if (db.deger('SELECT COUNT(*) FROM kullanici WHERE kullanici_adi = ?', [ka]))
      throw new Error('Bu kullanıcı adı zaten kayıtlı.');
    const tuz = U.rastgeleHex(16);
    db.calistir(
      `INSERT INTO kullanici (kullanici_adi, ad_soyad, parola_hash, tuz, yonetici, aktif, olusturma)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [ka, U.bicimAd(adSoyad) || ka, parolaHashle(parola, tuz), tuz, yonetici ? 1 : 0, U.simdi()]);
    log('EKLE', 'kullanici', ka, yonetici ? 'Yönetici' : 'Kullanıcı');
    return ka;
  }

  function kullaniciGuncelle(kullaniciAdi, adSoyad, yonetici, aktif) {
    yetkiIste('sistem.yonet');
    if ((!yonetici || !aktif) && digerYoneticiYok(kullaniciAdi))
      throw new Error('Sistemde en az bir etkin yönetici kalmalıdır.');
    db.calistir(`UPDATE kullanici SET ad_soyad = ?, yonetici = ?, aktif = ? WHERE kullanici_adi = ?`,
                [U.bicimAd(adSoyad), yonetici ? 1 : 0, aktif ? 1 : 0, kullaniciAdi]);
    log('GUNCELLE', 'kullanici', kullaniciAdi);
  }

  function digerYoneticiYok(kullaniciAdi) {
    return !db.deger(`SELECT COUNT(*) FROM kullanici WHERE yonetici = 1 AND aktif = 1
                      AND kullanici_adi <> ?`, [kullaniciAdi]);
  }

  /* Başkasının parolasını yalnız sistem yöneticisi değiştirir; kişi kendi parolasını değiştirebilir */
  function parolaDegistir(kullaniciAdi, yeniParola) {
    if (!aktifKullanici) throw new Error('Oturum açık değil.');
    if (aktifKullanici.kullanici_adi !== kullaniciAdi) yetkiIste('sistem.yonet'); else kilitIste();
    if (!yeniParola || yeniParola.length < 6) throw new Error('Parola en az 6 karakter olmalıdır.');
    const tuz = U.rastgeleHex(16);
    db.calistir(`UPDATE kullanici SET parola_hash = ?, tuz = ? WHERE kullanici_adi = ?`,
                [parolaHashle(yeniParola, tuz), tuz, kullaniciAdi]);
    log('GUNCELLE', 'kullanici', kullaniciAdi, 'Parola değiştirildi');
  }

  function kullaniciSil(kullaniciAdi) {
    yetkiIste('sistem.yonet');
    if (digerYoneticiYok(kullaniciAdi)) throw new Error('Sistemde en az bir etkin yönetici kalmalıdır.');
    db.calistir(`DELETE FROM kullanici WHERE kullanici_adi = ?`, [kullaniciAdi]);
    log('SIL', 'kullanici', kullaniciAdi);
  }

  function kullaniciYetkileri(ka) {
    return db.tumu(`SELECT yetki_kod FROM kullanici_yetki WHERE kullanici_adi = ?`, [ka])
             .map(r => r.yetki_kod);
  }
  function kullaniciGruplari(ka) {
    return db.tumu(`SELECT grup_kod, yazma FROM kullanici_grup WHERE kullanici_adi = ?`, [ka]);
  }

  /* Yöneticinin atadığı yetki ve grup erişimini tek seferde yazar. */
  function kullaniciErisimYaz(ka, yetkiler, gruplar) {
    yetkiIste('sistem.yonet');
    db.islem(() => {
      db.calistir(`DELETE FROM kullanici_yetki WHERE kullanici_adi = ?`, [ka]);
      (yetkiler || []).forEach(k =>
        db.calistir(`INSERT INTO kullanici_yetki (kullanici_adi, yetki_kod) VALUES (?,?)`, [ka, k]));
      db.calistir(`DELETE FROM kullanici_grup WHERE kullanici_adi = ?`, [ka]);
      (gruplar || []).forEach(g =>
        db.calistir(`INSERT INTO kullanici_grup (kullanici_adi, grup_kod, yazma) VALUES (?,?,?)`,
                    [ka, g.grup_kod, g.yazma ? 1 : 0]));
    });
    log('GUNCELLE', 'kullanici_yetki', ka,
        (yetkiler || []).length + ' yetki, ' + (gruplar || []).length + ' grup');
  }

  function girisYap(kullaniciAdi, parola) {
    const ka = String(kullaniciAdi || '').trim().toLowerCase();
    const k = db.tek(`SELECT * FROM kullanici WHERE kullanici_adi = ?`, [ka]);
    if (!k) return { basarili: false, mesaj: 'Kullanıcı adı veya parola hatalı.' };
    if (!k.aktif) return { basarili: false, mesaj: 'Bu kullanıcı devre dışı bırakılmış.' };
    if (!parolaDogrula(parola, k.tuz, k.parola_hash))
      return { basarili: false, mesaj: 'Kullanıcı adı veya parola hatalı.' };
    aktifKullanici = {
      kullanici_adi: k.kullanici_adi, ad_soyad: k.ad_soyad, yonetici: !!k.yonetici,
      yetkiler: kullaniciYetkileri(ka), gruplar: kullaniciGruplari(ka),
    };
    db.calistir(`UPDATE kullanici SET son_giris = ? WHERE kullanici_adi = ?`, [U.simdi(), ka]);
    log('GIRIS', 'kullanici', ka);
    return { basarili: true, kullanici: aktifKullanici };
  }

  function cikisYap() {
    log('CIKIS', 'kullanici', aktifKullanici && aktifKullanici.kullanici_adi);
    aktifKullanici = null;
    onbellekTemizle();
  }
  function kullanici() { return aktifKullanici; }
  /* Yetki değişikliği açık oturuma da yansır: her ekran geçişinde kullanıcının yönetici / etkin
     bilgisi, yetkileri ve grup erişimi veritabanından yeniden okunur. Kullanıcı silinmiş ya da devre dışı bırakılmışsa
     false döner; uygulama oturumu kapatır. */
  function oturumTazele() {
    if (!aktifKullanici) return false;
    const k = db.tek(`SELECT kullanici_adi, ad_soyad, yonetici, aktif FROM kullanici WHERE kullanici_adi = ?`, [aktifKullanici.kullanici_adi]);
    if (!k || !k.aktif) return false;
    const yetkiler = kullaniciYetkileri(k.kullanici_adi).sort();
    const gruplar = kullaniciGruplari(k.kullanici_adi).sort((a, b) => (a.grup_kod > b.grup_kod ? 1 : -1));
    const once = JSON.stringify([aktifKullanici.yonetici, aktifKullanici.yetkiler.slice().sort(), aktifKullanici.gruplar]);
    Object.assign(aktifKullanici, { ad_soyad: k.ad_soyad, yonetici: !!k.yonetici, yetkiler: yetkiler, gruplar: gruplar });
    if (once !== JSON.stringify([aktifKullanici.yonetici, yetkiler, gruplar])) onbellekTemizle();
    return true;
  }
  function yetkiVar(kod) {
    if (!aktifKullanici) return false;
    return aktifKullanici.yonetici || aktifKullanici.yetkiler.indexOf(kod) >= 0;
  }
  /* Yazma yetkileri (.yaz / .yonet) yazma kilidi başkasındayken reddedilir —
     bütün yazma işlemleri buradan geçer (bkz. js/core/kilit.js). */
  function yetkiIste(kod) {
    if (!yetkiVar(kod)) throw new Error('Bu işlem için yetkiniz yok.');
    if (/\.(yaz|yonet)$/.test(kod)) kilitIste();
  }
  function kilitIste() {
    if (window.KILIT && typeof KILIT.yazabilirMi === 'function' && !KILIT.yazabilirMi()) {
      const h = new Error(KILIT.engelMesaji());
      h.kilitli = true;
      throw h;
    }
  }

  function grupGorebilir(kod) {
    if (!aktifKullanici) return false;
    return aktifKullanici.yonetici || aktifKullanici.gruplar.some(g => g.grup_kod === kod);
  }
  function grupYazabilir(kod) {
    if (!aktifKullanici) return false;
    return aktifKullanici.yonetici || aktifKullanici.gruplar.some(g => g.grup_kod === kod && g.yazma);
  }
  /* Okuma denetimi: kullanıcının göremediği grubun verisi API'den de
     okunamaz (ekran atlatılsa bile). */
  function calismaOkuIste(calismaId) {
    const c = db.tek(`SELECT grup_kod FROM calisma WHERE id = ?`, [calismaId]);
    if (!c) throw new Error('Çalışma bulunamadı.');
    if (!grupGorebilir(c.grup_kod)) throw new Error('Bu grubun verisini görme yetkiniz yok.');
  }

  function calismaYazIste(calismaId, yetki) {
    const c = calismaGetir(calismaId);
    if (!c) throw new Error('Çalışma bulunamadı.');
    if (!grupYazabilir(c.grup_kod)) throw new Error('Bu grupta değişiklik yetkiniz yok.');
    /* Onaylı çalışma kilitlidir: onaylanmış maliyet — hatalı olsa bile — değişmez.
       Değişiklik için Çalışma Ayarları'ndan Taslak'a alınır. */
    if (c.durum === 'ONAYLI') throw new Error('Bu çalışma onaylı ve kilitli. Değişiklik için Çalışmalar → ✎ ekranından "Taslak"a alın.');
    if (yetki) yetkiIste(yetki);
    return c;
  }
  /* Ekranların düzenleme alanlarını açıp kapatması için: grup yazma yetkisi + çalışma onaylı değil */
  function calismaYazilabilir(c) { return !!c && c.durum !== 'ONAYLI' && grupYazabilir(c.grup_kod); }

  /* ---------------------------------------------------------------
     TANIMLAR
     --------------------------------------------------------------- */
  function grupListe() { return db.tumu(`SELECT * FROM grup ORDER BY sira, ad`); }
  function gorunurGruplar() { return grupListe().filter(g => grupGorebilir(g.kod)); }

  /* Grup ekleme / düzenleme — yalnız sistem yöneticisi (grup erişimini de o atar).
     Kod kayıttan sonra değişmez (çalışmalar, bölümler ve yetkiler koda bağlıdır); ad ve sıra değişir.
     k = { kod, ad, sira }; duzenle = true ise var olan grup güncellenir. */
  function grupKaydet(k, duzenle) {
    yetkiIste('sistem.yonet');
    const kod = String(k.kod || '').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, '_');
    if (!/^[A-Z0-9_ÇĞİÖŞÜ-]{2,20}$/.test(kod))
      throw new Error('Grup kodu 2–20 karakter olmalı; harf, rakam, tire ve alt çizgi kullanın.');
    if (kod === 'TUMU') throw new Error('"TUMU" kodu ayrılmıştır (üst çubuktaki "Tümü" seçimi); başka bir kod seçin.');
    const ad = U.bicimAd(k.ad);
    if (!ad) throw new Error('Grup adı boş olamaz.');
    const var_ = db.tek(`SELECT kod FROM grup WHERE kod = ?`, [kod]);
    if (duzenle) {
      if (!var_) throw new Error('Grup bulunamadı.');
      db.calistir(`UPDATE grup SET ad = ?, sira = ? WHERE kod = ?`, [ad, Number(k.sira) || 0, kod]);
    } else {
      if (var_) throw new Error('Bu kodla bir grup zaten var.');
      const sira = Number(k.sira) || ((db.deger(`SELECT MAX(sira) FROM grup`) || 0) + 1);
      db.calistir(`INSERT INTO grup (kod, ad, sira) VALUES (?,?,?)`, [kod, ad, sira]);
    }
    log(duzenle ? 'GUNCELLE' : 'EKLE', 'grup', kod, ad);
    onbellekTemizle();
    return kod;
  }
  /* Çalışması olan grup silinmez; bölüm tanımları ve kullanıcı erişimleri grupla birlikte gider. */
  function grupSil(kod) {
    yetkiIste('sistem.yonet');
    const n = db.deger(`SELECT COUNT(*) FROM calisma WHERE grup_kod = ?`, [kod]) || 0;
    if (n) throw new Error(`Bu grubun ${n} bütçe çalışması var; önce çalışmaları silin.`);
    db.islem(() => {
      db.calistir(`DELETE FROM butce_bolumu WHERE grup_kod = ?`, [kod]);
      db.calistir(`DELETE FROM kullanici_grup WHERE grup_kod = ?`, [kod]);
      db.calistir(`DELETE FROM grup WHERE kod = ?`, [kod]);
    });
    log('SIL', 'grup', kod);
    onbellekTemizle();
  }

  /* ---------------------------------------------------------------
     MAAŞ DAĞILIMI ARALIKLARI
     "Şu aralıkta kaç kişi var" tablosu. Grupların maaş yelpazesi çok farklı
     olabilir (biri geniş, biri dar); bu yüzden
     aralıklar her grubun KENDİ maaşlarından otomatik seçilir; istenirse
     grup için sabitlenir (yıllar arası karşılaştırma için). Sınırlar ALT
     sınırdır: [60000, 70000] → "60.000'in altı", "60.000–70.000", "70.000 ve üzeri".
     --------------------------------------------------------------- */
  const ARALIK_ADIMLARI = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
  function aralikOner(maaslar) {
    const a = (maaslar || []).filter(x => isFinite(x) && x > 0).sort((x, y) => x - y);
    if (a.length < 2) return a.length ? [Math.ceil(a[0] / 10000) * 10000] : [];
    const yuzde = p => a[Math.min(a.length - 1, Math.floor(p * (a.length - 1)))];
    const alt = yuzde(0.1), ust = yuzde(0.9);
    // 10.–90. yüzdelik arası yaklaşık 8 aralığa bölünür; adım "yuvarlak" sayıdır (5 bin, 10 bin, 20 bin…)
    const hedef = Math.max(1, (ust - alt) / 8);
    const adim = ARALIK_ADIMLARI.find(s => s >= hedef) || 100000;
    const bas = Math.max(adim, Math.floor(alt / adim) * adim);
    const son = Math.max(bas + adim, Math.ceil(ust / adim) * adim);
    const sinir = [];
    for (let x = bas; x <= son && sinir.length < 14; x += adim) sinir.push(x);
    return sinir;
  }
  function aralikCoz(metin) {
    return String(metin || '').split(/[;\s]+/).map(s => trSayi(s)).filter(x => isFinite(x) && x > 0)
      .sort((x, y) => x - y).filter((x, i, d) => i === 0 || x !== d[i - 1]);
  }
  /* Grubun sabit aralıkları; yoksa null (= otomatik) */
  function maasAraliklari(grupKod) {
    const g = db.tek(`SELECT maas_araliklari FROM grup WHERE kod = ?`, [grupKod]);
    const s = g && g.maas_araliklari ? aralikCoz(g.maas_araliklari) : [];
    return s.length ? s : null;
  }
  function maasAralikYaz(grupKod, sinirlar) {
    yetkiIste('parametre.yaz');
    if (!grupYazabilir(grupKod)) throw new Error('Bu grupta değişiklik yetkiniz yok.');
    const s = sinirlar == null ? [] : (Array.isArray(sinirlar) ? sinirlar : aralikCoz(sinirlar));
    if (s.length > 20) throw new Error('En fazla 20 sınır girilebilir.');
    db.calistir(`UPDATE grup SET maas_araliklari = ? WHERE kod = ?`, [s.length ? s.join(';') : null, grupKod]);
    log('GUNCELLE', 'grup', grupKod, 'maaş aralıkları: ' + (s.length ? s.join(';') : 'otomatik'));
    return s.length ? s : null;
  }

  function butceBolumuListe(grupKod) {
    return grupKod
      ? db.tumu(`SELECT * FROM butce_bolumu WHERE grup_kod = ? ORDER BY sira, ad`, [grupKod])
      : db.tumu(`SELECT * FROM butce_bolumu ORDER BY grup_kod, sira, ad`);
  }
  /* Bölümün ekrandaki adı: "08 PAZARLAMA". Sıra ayrı alandadır (bkz. schema.js → BOLUM_TEMIZLE). */
  function bolumHarita(grupKod) {
    if (!bolumOnbellek[grupKod]) {
      const h = {};
      butceBolumuListe(grupKod).forEach(b => { h[b.ad] = b.sira; });
      bolumOnbellek[grupKod] = h;
    }
    return bolumOnbellek[grupKod];
  }
  function bolumEtiket(grupKod, ad) {
    if (!ad) return '';
    const s = bolumHarita(grupKod)[ad];
    return s ? String(s).padStart(2, '0') + ' ' + ad : ad;
  }
  /* Bölüm başına kişi sayısı (seçili yılın çalışmalarında). Grup görme yetkisi ister. */
  function bolumKisiSayilari(grupKod, yil) {
    if (!grupGorebilir(grupKod)) return {};
    const s = {};
    db.tumu(`SELECT cp.butce_bolumu AS ad, COUNT(*) AS n FROM calisma_personel cp JOIN calisma c ON c.id = cp.calisma_id
             WHERE c.grup_kod = ? AND c.yil = ? GROUP BY cp.butce_bolumu`, [grupKod, yil]).forEach(r => { s[r.ad] = r.n; });
    return s;
  }
  function bolumSira(grupKod, ad) { const s = bolumHarita(grupKod)[ad]; return s == null ? 999 : s; }

  function butceBolumuKaydet(k) {
    yetkiIste('parametre.yaz');
    const gk = k.id ? (db.tek(`SELECT grup_kod FROM butce_bolumu WHERE id = ?`, [k.id]) || {}).grup_kod : k.grup_kod;
    if (!grupYazabilir(gk)) throw new Error('Bu grupta değişiklik yetkiniz yok.');
    // Numara ada yazılmaz ("08 PAZARLAMA" → "PAZARLAMA"); sıra ayrı alandır
    const ad = window.BOLUM_TEMIZLE(k.ad);
    if (!ad) throw new Error('Bölüm adı boş olamaz.');
    const sira = Number(k.sira) || 0;
    if (!(sira > 0)) throw new Error('Sıra numarası 1 ya da daha büyük olmalı.');
    const ayniSira = db.tek(`SELECT ad FROM butce_bolumu WHERE grup_kod = ? AND sira = ? AND id <> ?`, [gk, sira, k.id || 0]);
    if (ayniSira) throw new Error(`${String(sira).padStart(2, '0')} numarası "${ayniSira.ad}" bölümünde kullanılıyor.`);
    const ayniAd = db.tek(`SELECT id FROM butce_bolumu WHERE grup_kod = ? AND ad = ? AND id <> ?`, [gk, ad, k.id || 0]);
    if (ayniAd) throw new Error(`"${ad}" adında bir bölüm zaten var. İkisini tek bölüm yapmak için "Birleştir"i kullanın.`);
    k = Object.assign({}, k, { sira: sira });
    if (k.id) {
      const eski = db.tek(`SELECT * FROM butce_bolumu WHERE id = ?`, [k.id]);
      db.islem(() => {
        db.calistir(`UPDATE butce_bolumu SET ad = ?, sira = ? WHERE id = ?`, [ad, Number(k.sira) || 0, k.id]);
        // Adı değişen bölüm, bütçe satırlarında da güncellenir
        if (eski && eski.ad !== ad)
          db.calistir(`UPDATE calisma_personel SET butce_bolumu = ?
                       WHERE butce_bolumu = ? AND calisma_id IN (SELECT id FROM calisma WHERE grup_kod = ?)`,
                      [ad, eski.ad, eski.grup_kod]);
      });
    } else {
      db.calistir(`INSERT INTO butce_bolumu (grup_kod, ad, sira) VALUES (?,?,?)`,
                  [k.grup_kod, ad, Number(k.sira) || 0]);
    }
    log('KAYDET', 'butce_bolumu', ad);
    onbellekTemizle();
  }
  function butceBolumuSil(id) {
    yetkiIste('parametre.yaz');
    const b = db.tek(`SELECT * FROM butce_bolumu WHERE id = ?`, [id]);
    if (!b) return;
    if (!grupYazabilir(b.grup_kod)) throw new Error('Bu grupta değişiklik yetkiniz yok.');
    const n = db.deger(`SELECT COUNT(*) FROM calisma_personel cp JOIN calisma c ON c.id = cp.calisma_id
                        WHERE c.grup_kod = ? AND cp.butce_bolumu = ?`, [b.grup_kod, b.ad]);
    if (n) throw new Error(`Bu bölümde ${n} bütçe satırı var; önce onları başka bölüme alın.`);
    db.calistir(`DELETE FROM butce_bolumu WHERE id = ?`, [id]);
    log('SIL', 'butce_bolumu', b.ad);
    onbellekTemizle();
  }

  /* Mükerrer bölümü birleştirir: kaynak bölümdeki bütçe satırları hedefe
     taşınır, kaynak silinir. Aynı gruptaki bütün yıllar etkilenir. */
  function butceBolumuBirlestir(kaynakId, hedefId) {
    yetkiIste('parametre.yaz');
    const k = db.tek(`SELECT * FROM butce_bolumu WHERE id = ?`, [kaynakId]);
    const h = db.tek(`SELECT * FROM butce_bolumu WHERE id = ?`, [hedefId]);
    if (!k || !h || k.id === h.id) throw new Error('Birleştirilecek iki farklı bölüm seçin.');
    if (k.grup_kod !== h.grup_kod) throw new Error('Yalnızca aynı gruptaki bölümler birleştirilebilir.');
    if (!grupYazabilir(k.grup_kod)) throw new Error('Bu grupta değişiklik yetkiniz yok.');
    let n = 0;
    db.islem(() => {
      n = db.calistir(`UPDATE calisma_personel SET butce_bolumu = ?
                       WHERE butce_bolumu = ? AND calisma_id IN (SELECT id FROM calisma WHERE grup_kod = ?)`,
                      [h.ad, k.ad, k.grup_kod]).degisen;
      db.calistir(`DELETE FROM butce_bolumu WHERE id = ?`, [k.id]);
    });
    log('BIRLESTIR', 'butce_bolumu', k.ad + ' → ' + h.ad, n + ' satır');
    onbellekTemizle();
    return n;
  }

  function hesapTuruListe(yil) {
    return db.tumu(`SELECT * FROM hesap_turu WHERE yil = ? ORDER BY sira, kod`, [yil]);
  }
  function hesapTuruKaydet(yil, k) {
    yetkiIste('parametre.yaz');
    const kod = String(k.kod || '').trim().toUpperCase();
    if (!kod) throw new Error('Kod boş olamaz.');
    if (!U.bicimAd(k.ad)) throw new Error('Ad boş olamaz.');
    db.calistir(`INSERT OR REPLACE INTO hesap_turu
      (yil, kod, ad, kol, sgk_isci, issizlik_isci, sgk_isveren, issizlik_isveren, gv, dv, istisna, sira, aciklama)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [yil, kod, U.bicimAd(k.ad), k.kol || 'SSK', Number(k.sgk_isci) || 0, Number(k.issizlik_isci) || 0,
       Number(k.sgk_isveren) || 0, Number(k.issizlik_isveren) || 0, k.gv ? 1 : 0, k.dv ? 1 : 0,
       k.istisna ? 1 : 0, Number(k.sira) || 0, k.aciklama || null]);
    log('KAYDET', 'hesap_turu', yil + '/' + kod);
    onbellekTemizle();
  }
  function hesapTuruSil(yil, kod) {
    yetkiIste('parametre.yaz');
    const n = db.deger(`SELECT COUNT(*) FROM calisma_personel cp JOIN calisma c ON c.id = cp.calisma_id
                        WHERE c.yil = ? AND cp.hesap_turu = ?`, [yil, kod]);
    if (n) throw new Error(`Bu hesaplama türü ${n} kişide kullanılıyor.`);
    /* Yıl içinde değişen tür Aylık Girdiler'de durur: orada kullanılıyorsa da silinmez */
    const a = db.deger(`SELECT COUNT(DISTINCT ag.calisma_id || '/' || ag.tc_kimlik_no) FROM aylik_girdi ag JOIN calisma c ON c.id = ag.calisma_id
                        WHERE c.yil = ? AND ag.alan = 'hesap_turu' AND ag.deger = ?`, [yil, kod]);
    if (a) throw new Error(`Bu hesaplama türü ${a} kişinin aylık girdilerinde (yıl içi değişiklik) kullanılıyor.`);
    db.calistir(`DELETE FROM hesap_turu WHERE yil = ? AND kod = ?`, [yil, kod]);
    log('SIL', 'hesap_turu', yil + '/' + kod);
    onbellekTemizle();
  }

  function kanunListe() { return db.tumu(`SELECT * FROM kanun_turu ORDER BY sira, kod`); }
  function kanunKaydet(k) {
    yetkiIste('parametre.yaz');
    const kod = String(k.kod || '').trim();
    if (!kod || !U.bicimAd(k.ad)) throw new Error('Kod ve ad zorunludur.');
    db.calistir(`INSERT OR REPLACE INTO kanun_turu (kod, ad, kural, aciklama, sira, oran) VALUES (?,?,?,?,?,?)`,
                [kod, U.bicimAd(k.ad), k.kural || 'YOK', k.aciklama || null, Number(k.sira) || 0,
                 k.oran === '' || k.oran == null ? null : Number(k.oran)]);
    log('KAYDET', 'kanun_turu', kod);
    onbellekTemizle();
  }
  function kanunSil(kod) {
    yetkiIste('parametre.yaz');
    const n = db.deger(`SELECT COUNT(*) FROM calisma_personel WHERE kanun = ?`, [kod]) +
              db.deger(`SELECT COUNT(*) FROM aylik_girdi WHERE alan = 'kanun' AND deger = ?`, [kod]);
    if (n) throw new Error(`Bu kanun türü ${n} kayıtta kullanılıyor.`);
    db.calistir(`DELETE FROM kanun_turu WHERE kod = ?`, [kod]);
    log('SIL', 'kanun_turu', kod);
  }

  function sakatlikListe(yil) {
    return db.tumu(`SELECT * FROM sakatlik_derece WHERE yil = ? ORDER BY derece`, [yil]);
  }
  function sakatlikTutari(yil, derece) {
    return db.deger(`SELECT tutar FROM sakatlik_derece WHERE yil = ? AND derece = ?`, [yil, derece]) || 0;
  }

  /* ---------------------------------------------------------------
     PARAMETRELER (yıl bazında)
     --------------------------------------------------------------- */
  /* Anahtarların anlamı ve varsayılanı. Ekran bu listeden çizilir. */
  const PARAMETRE_TANIM = [
    { anahtar: 'tavan_carpan',   ad: 'SGK tavan çarpanı',           birim: '× asgari ücret', vars: 9 },
    { anahtar: 'dv',             ad: 'Damga vergisi oranı',        birim: 'oran', vars: 0.00759 },
    { anahtar: 'istisna_kesinti',ad: 'Asgari ücret GV matrahı kesintisi (SGK %14 + işsizlik %1)', birim: 'oran', vars: 0.15 },
    { anahtar: 'bes_orani',      ad: 'BES kesinti oranı',          birim: 'oran', vars: 0.03 },
    { anahtar: 't05510',         ad: '05510 indirimi — varsayılan (gruba özel oran: Çalışmalar → ✎)', birim: 'oran', vars: 0.02 },
    { anahtar: 't05746',         ad: '05746 AR-GE SGK teşvik oranı (işveren %19,75 × ½)', birim: 'oran', vars: 0.09875 },
    { anahtar: 't14857',         ad: '14857 engelli teşvik oranı', birim: 'oran', vars: 0.1975 },
    { anahtar: 't15510',         ad: '15510 teşvik oranı',         birim: 'oran', vars: 0.05 },
  ];
  /* Zam öngörüsü kademesi — varsayılanlar yalnızca başlangıç değeridir; Parametreler'den değiştirilir */
  const ZAM_TANIM = [
    { anahtar: 'alt_esik', ad: 'Alt eşik (net)',   vars: 50000 },
    { anahtar: 'ust_esik', ad: 'Üst eşik (net)',   vars: 100000 },
    { anahtar: 'ust_oran', ad: 'Alt eşiğin altındaki oran', vars: 0.30 },
    { anahtar: 'alt_oran', ad: 'Üst eşiğin üstündeki oran', vars: 0.25 },
  ];

  function yillar() {
    return db.tumu(`SELECT DISTINCT yil FROM parametre
                    UNION SELECT DISTINCT yil FROM calisma ORDER BY 1 DESC`).map(r => r.yil);
  }
  function parametreOku(yil) {
    const o = {};
    db.tumu(`SELECT anahtar, deger FROM parametre WHERE yil = ?`, [yil]).forEach(r => { o[r.anahtar] = r.deger; });
    return o;
  }
  function parametreSayi(o, anahtar, vars) {
    const v = o[anahtar];
    return v === undefined || v === null || v === '' ? vars : Number(v);
  }
  function parametreYaz(yil, anahtar, deger) {
    yetkiIste('parametre.yaz');
    db.calistir(`INSERT OR REPLACE INTO parametre (yil, anahtar, deger) VALUES (?,?,?)`,
                [yil, anahtar, deger == null ? null : String(deger)]);
    log('KAYDET', 'parametre', yil + '/' + anahtar, String(deger));
    onbellekTemizle();
  }

  function dilimListe(yil) { return db.tumu(`SELECT * FROM gv_dilim WHERE yil = ? ORDER BY sira`, [yil]); }
  function dilimYaz(yil, liste) {
    yetkiIste('parametre.yaz');
    let onceki = 0;
    liste.forEach((d, i) => {
      if (!(d.oran >= 0 && d.oran < 1)) throw new Error((i + 1) + '. dilimin oranı 0 ile 1 arasında olmalı.');
      if (i < liste.length - 1) {
        if (!(d.ust_sinir > onceki)) throw new Error((i + 1) + '. dilimin üst sınırı bir öncekinden büyük olmalı.');
        onceki = d.ust_sinir;
      }
    });
    db.islem(() => {
      db.calistir(`DELETE FROM gv_dilim WHERE yil = ?`, [yil]);
      liste.forEach((d, i) => db.calistir(
        `INSERT INTO gv_dilim (yil, sira, ust_sinir, oran) VALUES (?,?,?,?)`,
        [yil, i + 1, i === liste.length - 1 ? null : d.ust_sinir, d.oran]));
    });
    log('KAYDET', 'gv_dilim', yil, liste.length + ' dilim');
    onbellekTemizle();
  }

  function asgariListe(yil) { return db.tumu(`SELECT * FROM asgari_ucret WHERE yil = ? ORDER BY baslangic_ay`, [yil]); }
  function asgariYaz(yil, liste) {
    yetkiIste('parametre.yaz');
    if (!liste.some(a => a.baslangic_ay === 1)) throw new Error('Ocak ayından geçerli bir asgari ücret girilmeli.');
    db.islem(() => {
      db.calistir(`DELETE FROM asgari_ucret WHERE yil = ?`, [yil]);
      liste.forEach(a => db.calistir(`INSERT INTO asgari_ucret (yil, baslangic_ay, brut) VALUES (?,?,?)`,
                                      [yil, a.baslangic_ay, a.brut]));
    });
    log('KAYDET', 'asgari_ucret', yil);
    onbellekTemizle();
  }

  function sakatlikYaz(yil, liste) {
    yetkiIste('parametre.yaz');
    db.islem(() => {
      db.calistir(`DELETE FROM sakatlik_derece WHERE yil = ?`, [yil]);
      liste.forEach(s => db.calistir(`INSERT INTO sakatlik_derece (yil, derece, tutar) VALUES (?,?,?)`,
                                      [yil, s.derece, s.tutar]));
    });
    log('KAYDET', 'sakatlik_derece', yil);
    onbellekTemizle();
  }

  function performansListe(yil) {
    return db.tumu(`SELECT * FROM performans_kademe WHERE yil = ? ORDER BY alt_puan`, [yil]);
  }
  function performansYaz(yil, liste) {
    yetkiIste('parametre.yaz');
    db.islem(() => {
      db.calistir(`DELETE FROM performans_kademe WHERE yil = ?`, [yil]);
      liste.forEach(p => db.calistir(
        `INSERT INTO performans_kademe (yil, alt_puan, ust_puan, carpan) VALUES (?,?,?,?)`,
        [yil, p.alt_puan, p.ust_puan, p.carpan]));
    });
    log('KAYDET', 'performans_kademe', yil);
    onbellekTemizle();
  }

  /* Yeni yılın parametrelerini önceki yıldan kopyalar (var olanlara dokunmaz). */
  function yilKopyalaIc(kaynak, hedef) {
    ['parametre', 'gv_dilim', 'asgari_ucret', 'hesap_turu', 'sakatlik_derece', 'performans_kademe'].forEach(t => {
      const sut = db.tumu(`PRAGMA table_info(${t})`).map(r => r.name).filter(n => n !== 'yil');
      db.calistir(`INSERT OR IGNORE INTO ${t} (yil, ${sut.join(',')})
                   SELECT ?, ${sut.join(',')} FROM ${t} WHERE yil = ?`, [hedef, kaynak]);
    });
  }
  function yilKopyala(kaynak, hedef) {
    yetkiIste('parametre.yaz');
    db.islem(() => yilKopyalaIc(kaynak, hedef));
    log('KOPYALA', 'parametre', kaynak + ' → ' + hedef);
    onbellekTemizle();
  }

  /* ---------------------------------------------------------------
     YASAL PARAMETRE ÖNGÖRÜSÜ
     Bütçe Kasım–Aralık'ta hazırlanır; o sırada yeni yılın resmî
     rakamları açıklanmamıştır. Piyasa beklentisine göre bir artış
     oranı seçilir ve önceki yılın yasal değerlerine uygulanır:
       - asgari ücret (önceki yılın SON dönemi esas alınır),
       - gelir vergisi dilim sınırları,
       - sakatlık indirimi tutarları.
     SGK tavanı ve asgari ücret istisnaları asgari ücretten türediği
     için kendiliğinden güncellenir. Yıl içi ara artış beklentisi
     (örn. Temmuz) ayrıca girilebilir.
     Resmî rakamlar açıklanınca değerler elle düzeltilir ve yıl
     "Resmî" olarak işaretlenir.
     --------------------------------------------------------------- */
  function yuvarla(x, adim) { return adim ? Math.round(x / adim) * adim : Math.round(x * 100) / 100; }

  function parametreDurumu(yil) {
    const o = parametreOku(yil);
    const varMi = !!db.deger(`SELECT COUNT(*) FROM asgari_ucret WHERE yil = ?`, [yil]);
    return {
      var: varMi, ongoru: o.durum === 'ONGORU',
      oran: o['ongoru.oran'] == null ? null : Number(o['ongoru.oran']),
      kaynakYil: o['ongoru.kaynak_yil'] == null ? null : Number(o['ongoru.kaynak_yil']),
      araAy: o['ongoru.ara_ay'] == null ? null : Number(o['ongoru.ara_ay']),
      araOran: o['ongoru.ara_oran'] == null ? null : Number(o['ongoru.ara_oran']),
      tarih: o['ongoru.tarih'] || null, ayar: o,
    };
  }

  /* s = { kaynakYil, hedefYil, oran, oranAsgari?, oranDilim?, oranSakatlik?,
           araAy?, araOran?, dilimAdim, sakatlikAdim }
     Dönüş: { asgari:[{ay, brut}], dilim:[{ust_sinir, oran}], sakatlik:[{derece, tutar}], satirlar:[…] } */
  function ongoruHesapla(s) {
    const oA = s.oranAsgari == null ? s.oran : s.oranAsgari;
    const oD = s.oranDilim == null ? s.oran : s.oranDilim;
    const oS = s.oranSakatlik == null ? s.oran : s.oranSakatlik;
    const kAu = asgariListe(s.kaynakYil);
    if (!kAu.length) throw new Error(s.kaynakYil + ' yılının asgari ücreti yok.');
    const son = kAu[kAu.length - 1];
    const ocak = yuvarla(son.brut * (1 + oA));
    const asgari = [{ baslangic_ay: 1, brut: ocak }];
    const satirlar = [{ kalem: 'Asgari ücret (Ocak)', kaynak: son.brut, hedef: ocak,
      not: kAu.length > 1 ? `${s.kaynakYil} son dönemi (${U.AYLAR[son.baslangic_ay - 1]}) esas alındı` : '' }];
    if (s.araOran && s.araAy > 1) {
      const ara = yuvarla(ocak * (1 + s.araOran));
      asgari.push({ baslangic_ay: s.araAy, brut: ara });
      satirlar.push({ kalem: `Asgari ücret (${U.AYLAR[s.araAy - 1]} ara artışı)`, kaynak: ocak, hedef: ara, not: 'ara dönem' });
    }
    const tavanC = parametreSayi(parametreOku(s.kaynakYil), 'tavan_carpan', 9);
    satirlar.push({ kalem: 'SGK tavanı (Ocak)', kaynak: son.brut * tavanC, hedef: ocak * tavanC, not: 'asgari ücretten türer' });
    const kD = dilimListe(s.kaynakYil);
    /* Kaynakta dilim / sakatlık yoksa hedefinkiler sessizce BOŞALIYORDU — durdurulur */
    if (!kD.length) throw new Error(s.kaynakYil + ' yılının gelir vergisi dilimleri yok; kaynak yılı kontrol edin.');
    if (!sakatlikListe(s.kaynakYil).length) throw new Error(s.kaynakYil + ' yılının sakatlık indirimi tutarları yok; kaynak yılı kontrol edin.');
    const dilim = kD.map((d, i) => {
      const u = d.ust_sinir == null ? null : yuvarla(d.ust_sinir * (1 + oD), s.dilimAdim);
      satirlar.push({ kalem: `GV ${i + 1}. dilim üst sınırı (%${Math.round(d.oran * 100)})`, kaynak: d.ust_sinir, hedef: u,
                      not: u == null ? 'sınırsız' : '' });
      return { ust_sinir: u, oran: d.oran };
    });
    const sakatlik = sakatlikListe(s.kaynakYil).map(x => {
      const t = yuvarla(x.tutar * (1 + oS), s.sakatlikAdim);
      satirlar.push({ kalem: `Sakatlık indirimi ${x.derece}. derece`, kaynak: x.tutar, hedef: t, not: '' });
      return { derece: x.derece, tutar: t };
    });
    return { asgari: asgari, dilim: dilim, sakatlik: sakatlik, satirlar: satirlar };
  }

  /* Yılın onaylı (kilitli) çalışması var mı — tüm gruplar, görünürlükten bağımsız */
  function yilOnayliMi(yil) {
    return !!db.deger(`SELECT COUNT(*) FROM calisma WHERE yil = ? AND durum = 'ONAYLI'`, [yil]);
  }
  function ongoruUygula(s) {
    yetkiIste('parametre.yaz');
    if (!(s.hedefYil > s.kaynakYil)) throw new Error('Hedef yıl kaynak yıldan büyük olmalı.');
    /* Onaylı maliyet değişmez: onaylı çalışması olan yılın asgari ücreti,
       dilimleri ve sakatlık tutarları öngörüyle ezilemez. */
    if (yilOnayliMi(s.hedefYil)) throw new Error(s.hedefYil + ' yılında onaylı bir çalışma var; o yılın parametreleri öngörüyle değiştirilemez. ' +
      'Hedef yılı kontrol edin (örneğin kaynak ' + (s.hedefYil) + ', hedef ' + (s.hedefYil + 1) + ').');
    if (!(s.oran > -1 && s.oran < 5)) throw new Error('Artış oranı geçersiz.');
    const o = ongoruHesapla(s);
    db.islem(() => {
      // Yasal olmayan parametreler (oranlar, hesaplama türleri, zam kademesi) hedefte yoksa kopyalanır
      yilKopyalaIc(s.kaynakYil, s.hedefYil);
      db.calistir(`DELETE FROM asgari_ucret WHERE yil = ?`, [s.hedefYil]);
      o.asgari.forEach(a => db.calistir(`INSERT INTO asgari_ucret (yil, baslangic_ay, brut) VALUES (?,?,?)`,
                                        [s.hedefYil, a.baslangic_ay, a.brut]));
      db.calistir(`DELETE FROM gv_dilim WHERE yil = ?`, [s.hedefYil]);
      o.dilim.forEach((d, i) => db.calistir(`INSERT INTO gv_dilim (yil, sira, ust_sinir, oran) VALUES (?,?,?,?)`,
                                            [s.hedefYil, i + 1, d.ust_sinir, d.oran]));
      db.calistir(`DELETE FROM sakatlik_derece WHERE yil = ?`, [s.hedefYil]);
      o.sakatlik.forEach(x => db.calistir(`INSERT INTO sakatlik_derece (yil, derece, tutar) VALUES (?,?,?)`,
                                          [s.hedefYil, x.derece, x.tutar]));
      const yaz = (k, v) => db.calistir(`INSERT OR REPLACE INTO parametre (yil, anahtar, deger) VALUES (?,?,?)`,
                                        [s.hedefYil, k, v == null ? null : String(v)]);
      yaz('durum', 'ONGORU');
      yaz('ongoru.kaynak_yil', s.kaynakYil);
      yaz('ongoru.oran', s.oran);
      yaz('ongoru.oran_asgari', s.oranAsgari == null ? s.oran : s.oranAsgari);
      yaz('ongoru.oran_dilim', s.oranDilim == null ? s.oran : s.oranDilim);
      yaz('ongoru.oran_sakatlik', s.oranSakatlik == null ? s.oran : s.oranSakatlik);
      yaz('ongoru.ara_ay', s.araOran ? s.araAy : null);
      yaz('ongoru.ara_oran', s.araOran || null);
      yaz('ongoru.dilim_adim', s.dilimAdim);
      yaz('ongoru.sakatlik_adim', s.sakatlikAdim);
      yaz('ongoru.tarih', U.simdi());
    });
    log('ONGORU', 'parametre', s.hedefYil, `${s.kaynakYil} × %${(s.oran * 100).toFixed(1)}` +
        (s.araOran ? `, ${s.araAy}. ay +%${(s.araOran * 100).toFixed(1)}` : ''));
    onbellekTemizle();
    return o;
  }

  function parametreDurumYaz(yil, durum) {
    yetkiIste('parametre.yaz');
    db.calistir(`INSERT OR REPLACE INTO parametre (yil, anahtar, deger) VALUES (?, 'durum', ?)`, [yil, durum]);
    log('GUNCELLE', 'parametre', yil, 'durum = ' + durum);
  }

  /* ---------------------------------------------------------------
     ÇALIŞMA (grup × yıl)
     --------------------------------------------------------------- */
  function calismaListe() {
    return db.tumu(`SELECT c.*, g.ad AS grup_adi,
                           (SELECT COUNT(*) FROM calisma_personel cp WHERE cp.calisma_id = c.id) AS kisi
                    FROM calisma c JOIN grup g ON g.kod = c.grup_kod
                    ORDER BY c.yil DESC, g.sira, c.ad`)
             .filter(c => grupGorebilir(c.grup_kod));
  }
  function calismaGetir(id) {
    return db.tek(`SELECT c.*, g.ad AS grup_adi FROM calisma c JOIN grup g ON g.kod = c.grup_kod
                   WHERE c.id = ?`, [id]);
  }
  function calismaKaydet(k) {
    const eski = k.id ? calismaGetir(k.id) : null;
    if (k.id && !eski) throw new Error('Çalışma bulunamadı.');
    /* Var olan çalışmanın grubu, gönderilen veriden değil kaydın kendisinden alınır */
    if (!grupYazabilir(eski ? eski.grup_kod : k.grup_kod)) throw new Error('Bu grupta çalışma açma yetkiniz yok.');
    yetkiIste('personel.yaz');
    let ad = U.bicimAd(k.ad) || (k.yil + ' Bütçe');
    if (k.id) {
      const durum = k.durum || 'TASLAK';
      /* Onaylı kalan çalışmada yalnız açıklama değişebilir: ad ve zam yöntemi kilitlidir */
      const b = eski.durum === 'ONAYLI' && durum === 'ONAYLI'
        ? { zam_kademe: eski.zam_kademe, zam_performans: eski.zam_performans } : k;
      if (eski.durum === 'ONAYLI' && durum === 'ONAYLI') ad = eski.ad;
      db.islem(() => {
        db.calistir(`UPDATE calisma SET ad = ?, durum = ?, zam_kademe = ?, zam_performans = ?,
                     aciklama = ? WHERE id = ?`,
                    [ad, durum, b.zam_kademe ? 1 : 0, b.zam_performans ? 1 : 0, k.aciklama || null, k.id]);
        /* Onaylanınca giriş/çıkış tarihleri dondurulur; taslağa alınınca güncel tarihler geçerli olur */
        if (durum === 'ONAYLI' && eski.durum !== 'ONAYLI') {
          window.ONAY_TARIH_DONDUR((s, p) => db.calistir(s, p), k.id);
          window.PARAMETRE_DONDUR((s, p) => db.calistir(s, p), (s, p) => db.tumu(s, p), k.id);
        }
        if (durum !== 'ONAYLI' && eski.durum === 'ONAYLI') {
          db.calistir(`UPDATE calisma_personel SET onay_sabit = 0, onay_giris = NULL, onay_cikis = NULL
                       WHERE calisma_id = ? AND onay_sabit = 1`, [k.id]);
          db.calistir(`DELETE FROM calisma_parametre WHERE calisma_id = ?`, [k.id]);
        }
      });
      log('GUNCELLE', 'calisma', k.id, ad + (durum !== eski.durum ? ' · durum ' + eski.durum + ' → ' + durum : ''));
      onbellekTemizle();
      return k.id;
    }
    const r = db.calistir(`INSERT INTO calisma (yil, grup_kod, ad, durum, zam_kademe, zam_performans,
                             aciklama, olusturma) VALUES (?,?,?,?,?,?,?,?)`,
                          [k.yil, k.grup_kod, ad, 'TASLAK', 1, 0, k.aciklama || null, U.simdi()]);
    log('EKLE', 'calisma', r.sonId, k.yil + ' ' + k.grup_kod);
    return r.sonId;
  }
  /* REVİZE: onaylı çalışmanın birebir kopyası, TASLAK. Onaylı çalışma olduğu gibi kalır (dondurulmuş
     parametreleriyle); revize yılın GÜNCEL parametreleriyle (örn. Ocak'ta girilen resmî rakamlar) hesaplanır. */
  function calismaRevizeAc(kaynakId) {
    const k = calismaGetir(kaynakId);
    if (!k) throw new Error('Çalışma bulunamadı.');
    if (!grupYazabilir(k.grup_kod)) throw new Error('Bu grupta çalışma açma yetkiniz yok.');
    yetkiIste('personel.yaz');
    const adlar = new Set(calismaListe().filter(x => x.yil === k.yil && x.grup_kod === k.grup_kod).map(x => x.ad));
    let ad = k.yil + ' Revize', n = 2;
    while (adlar.has(ad)) ad = k.yil + ' Revize ' + n++;
    /* Tek işlem: kopyalama yarıda kalırsa boş revize çalışması da oluşmaz */
    const id = db.islem(() => {
      const yeni = calismaKaydet({ yil: k.yil, grup_kod: k.grup_kod, ad: ad,
        aciklama: 'Revize · kaynak: ' + k.ad + (k.durum === 'ONAYLI' ? ' (onaylı)' : '') });
      db.calistir(`UPDATE calisma SET zam_kademe = ?, zam_performans = ? WHERE id = ?`,
                  [k.zam_kademe, k.zam_performans, yeni]);
      calismaPersonelKopyala(kaynakId, yeni, 'KOPYA');
      return yeni;
    });
    log('EKLE', 'calisma', id, 'revize · kaynak ' + kaynakId + ' ' + k.ad);
    onbellekTemizle();
    return id;
  }
  function calismaSil(id) {
    const c = calismaYazIste(id, 'personel.yaz');
    db.calistir(`DELETE FROM calisma WHERE id = ?`, [id]);
    log('SIL', 'calisma', id, c.yil + ' ' + c.grup_kod + ' ' + c.ad);
    onbellekTemizle();
  }
  function calismaOzetOku(id) {
    calismaOkuIste(id);
    const o = {};
    db.tumu(`SELECT anahtar, deger FROM calisma_ozet WHERE calisma_id = ?`, [id]).forEach(r => { o[r.anahtar] = r.deger; });
    return o;
  }
  /* Çalışmaya özel ayarlar (zam kademesi). Kayıt yoksa yılın parametresi geçerlidir. */
  function calismaAyarOku(id) {
    calismaOkuIste(id);
    const o = {};
    db.tumu(`SELECT anahtar, deger FROM calisma_ayar WHERE calisma_id = ?`, [id]).forEach(r => { o[r.anahtar] = r.deger; });
    return o;
  }
  /* degerler = { anahtar: deger | null }; null ya da '' = kaldır (yılın değerine dön) */
  function calismaAyarYaz(id, degerler) {
    calismaYazIste(id, 'personel.yaz');
    db.islem(() => Object.keys(degerler).forEach(k => {
      const v = degerler[k];
      if (v == null || v === '') db.calistir(`DELETE FROM calisma_ayar WHERE calisma_id = ? AND anahtar = ?`, [id, k]);
      else db.calistir(`INSERT OR REPLACE INTO calisma_ayar (calisma_id, anahtar, deger) VALUES (?,?,?)`, [id, k, String(v)]);
    }));
    log('KAYDET', 'calisma_ayar', id, Object.keys(degerler).map(k => k + '=' + degerler[k]).join(', '));
    onbellekTemizle();
  }
  /* Çalışmanın geçerli zam kademesi: yıl parametresi + çalışmaya özel eşik/oranlar */
  function calismaZamKademe(c, P) {
    const a = calismaAyarOku(c.id);
    const k = { M: Object.assign({}, P.zamKademe.M), B: Object.assign({}, P.zamKademe.B) };
    const ad = { alt_esik: 'altEsik', ust_esik: 'ustEsik', ust_oran: 'ustOran', alt_oran: 'altOran' };
    ['M', 'B'].forEach(y => Object.keys(ad).forEach(z => {
      const v = a['zam.' + y + '.' + z];
      if (v != null && v !== '') k[y][ad[z]] = Number(v);
    }));
    return k;
  }

  function calismaOzetYaz(id, anahtar, deger) {
    calismaYazIste(id, 'personel.yaz');
    db.calistir(`INSERT OR REPLACE INTO calisma_ozet (calisma_id, anahtar, deger) VALUES (?,?,?)`,
                [id, anahtar, deger == null || deger === '' ? null : Number(deger)]);
    log('KAYDET', 'calisma_ozet', id + '/' + anahtar, String(deger));
  }

  /* ---------------------------------------------------------------
     PERSONEL VE BÜTÇE SATIRI
     --------------------------------------------------------------- */
  function personelGetir(tc) { return db.tek(`SELECT * FROM personel WHERE tc_kimlik_no = ?`, [tc]); }

  function calismaPersonelListe(id) {
    calismaOkuIste(id);
    /* Sıra: önce bütçe bölümünün sırası (Tanımlar'daki); bölüm içinde İŞE GİRİŞ tarihine göre eskiden yeniye
       (en son giren bölümün en altında), aynı gün girenler ada göre. Çalışmanın kendi
       dönem/onay tarihi varsa (onay_sabit > 0) o kullanılır. Giriş tarihi boş olanlar bölümün başında, bölümü olmayanlar
       en sonda. */
    return db.tumu(`SELECT p.ad_soyad, p.ise_giris, p.isten_ayrilis, p.bolum, p.ekip, p.gorev, cp.*
                    FROM calisma_personel cp JOIN personel p ON p.tc_kimlik_no = cp.tc_kimlik_no
                    JOIN calisma c ON c.id = cp.calisma_id
                    LEFT JOIN butce_bolumu bb ON bb.grup_kod = c.grup_kod AND bb.ad = cp.butce_bolumu
                    WHERE cp.calisma_id = ? ORDER BY CASE WHEN bb.id IS NULL THEN 1 ELSE 0 END, bb.sira,
                      CASE WHEN cp.onay_sabit > 0 THEN cp.onay_giris ELSE p.ise_giris END, p.ad_soyad`, [id]);
  }
  function calismaPersonelGetir(id, tc) {
    calismaOkuIste(id);
    return db.tek(`SELECT p.ad_soyad, p.ise_giris, p.isten_ayrilis, p.bolum, p.ekip, p.gorev, cp.*
                   FROM calisma_personel cp JOIN personel p ON p.tc_kimlik_no = cp.tc_kimlik_no
                   WHERE cp.calisma_id = ? AND cp.tc_kimlik_no = ?`, [id, tc]);
  }

  const CP_ALANLAR = ['sira', 'butce_bolumu', 'yaka', 'maas_eski', 'zam_ayi',
    'duzeltme', 'performans_puani', 'performans_carpani', 'maliyet_onceki', 'karsilastirma',
    'hesap_turu', 'sakatlik_derece', 'ozurlu_indirimi', 'bes', 'kanun', 'gv_tesvik', 'yol', 'not_metni'];
  const CP_SAYISAL = { sira: 1, maas_eski: 1, zam_ayi: 1, duzeltme: 1,
    performans_puani: 1, performans_carpani: 1, maliyet_onceki: 1, karsilastirma: 1,
    sakatlik_derece: 1, ozurlu_indirimi: 1, gv_tesvik: 1, yol: 1 };
  const CP_BOS_OLABILIR = { performans_puani: 1, performans_carpani: 1, maliyet_onceki: 1,
    karsilastirma: 1, sakatlik_derece: 1 };

  /* Kişi kartı + bütçe satırı birlikte kaydedilir.
     v: formdan gelen düz nesne; eskiTc: düzenlenen kaydın eski T.C.'si */
  /* DÖNEM TARİHLERİ: bir çalışan bir yıl bir gruptayken ayrılıp sonra başka bir gruba yeniden girebilir.
     İşe giriş / çıkış kişi kartında TEK kayıttır. Kart tarihi değişirken, kişiyi
     içeren DİĞER çalışmalar eski tarihleri kendi satırında saklar (onay_sabit = 2) — eski grubun dönemi
     bozulmaz. Onaylı çalışmalar zaten onay anındaki tarihle (onay_sabit = 1) hesaplanır. */
  function donemTarihleriniKoru(tc, yeniGiris, yeniCikis, haricId) {
    const p = personelGetir(tc);
    if (!p) return;
    if ((p.ise_giris || null) === (yeniGiris || null) && (p.isten_ayrilis || null) === (yeniCikis || null)) return;
    db.calistir(`UPDATE calisma_personel SET onay_sabit = 2, onay_giris = ?, onay_cikis = ?
                 WHERE tc_kimlik_no = ? AND onay_sabit = 0 AND calisma_id <> ?`,
                [p.ise_giris || null, p.isten_ayrilis || null, tc, haricId || 0]);
  }
  /* Kişinin bütün çalışmaları (görülebilen gruplar): yıl, grup, çalışma, durum, o çalışmadaki tarihler */
  function personelGecmis(tc) {
    return db.tumu(`SELECT c.id, c.yil, c.ad, c.durum, c.grup_kod, g.ad AS grup_adi, cp.butce_bolumu, cp.yaka,
                           CASE WHEN cp.onay_sabit > 0 THEN cp.onay_giris ELSE p.ise_giris END AS giris,
                           CASE WHEN cp.onay_sabit > 0 THEN cp.onay_cikis ELSE p.isten_ayrilis END AS cikis
                    FROM calisma_personel cp JOIN calisma c ON c.id = cp.calisma_id JOIN grup g ON g.kod = c.grup_kod
                    JOIN personel p ON p.tc_kimlik_no = cp.tc_kimlik_no
                    WHERE cp.tc_kimlik_no = ? ORDER BY c.yil DESC, g.sira`, [tc]).filter(x => grupGorebilir(x.grup_kod));
  }
  /* Yeni personel formu için: kayıtlı kişinin son bilgileri. Son çalışma önceki yıldansa, o yılın
     ZAMLI maaşı bu yılın "önceki yıl maaşı" olur (yeni yıl aktarımındaki gibi). */
  function personelOnDoldur(tc, yil) {
    const p = personelGetir(tc);
    if (!p) return null;
    const g = personelGecmis(tc);
    const son = g.find(x => x.yil < yil) || g[0] || null;
    let satir = null;
    if (son) {
      const kp = db.tek(`SELECT * FROM calisma_personel WHERE calisma_id = ? AND tc_kimlik_no = ?`, [son.id, tc]);
      satir = Object.assign({}, kp);
      if (son.yil < yil) {
        try {
          const h = calismaHesapla(son.id).kisiler.find(x => x.kp.tc_kimlik_no === tc);
          if (h) { satir.maas_eski = h.zam.yeni; satir.maliyet_onceki = h.yil.maliyet; }
        } catch (e) { }
        satir.duzeltme = 0; satir.performans_puani = null; satir.performans_carpani = null;
      }
    }
    return { personel: p, gecmis: g, son: son, satir: satir };
  }
  /* GRUP DEĞİŞTİRME: kişi, aynı yılın başka bir grubunun çalışmasına BÜTÜN bilgileriyle taşınır
     (bütçe satırı, aylık girdiler, performans değerlendirmesi) ve bu çalışmadan çıkar.
     İki çalışma da taslak olmalı — onaylı çalışma kilitlidir, etkilenmez. */
  function tasimaHedefleri(id) {
    const c = calismaGetir(id);
    return calismaListe().filter(x => x.yil === c.yil && x.grup_kod !== c.grup_kod && x.durum !== 'ONAYLI' && grupYazabilir(x.grup_kod));
  }
  function calismaPersonelTasi(kaynakId, tc, hedefId, butceBolumu) {
    const k = calismaYazIste(kaynakId, 'personel.yaz');
    const h = calismaYazIste(hedefId, 'personel.yaz');
    if (k.yil !== h.yil) throw new Error('Taşıma aynı yılın çalışmaları arasında yapılır.');
    if (kaynakId === hedefId) return;
    const row = db.tek(`SELECT * FROM calisma_personel WHERE calisma_id = ? AND tc_kimlik_no = ?`, [kaynakId, tc]);
    if (!row) throw new Error('Kişi bu çalışmada yok.');
    if (db.deger(`SELECT COUNT(*) FROM calisma_personel WHERE calisma_id = ? AND tc_kimlik_no = ?`, [hedefId, tc]))
      throw new Error('Kişi ' + h.grup_adi + ' · ' + h.ad + ' çalışmasında zaten var.');
    const bol = butceBolumuListe(h.grup_kod).map(b => b.ad);
    const bb = butceBolumu && bol.indexOf(butceBolumu) >= 0 ? butceBolumu : null;
    const sira = (db.deger(`SELECT MAX(sira) FROM calisma_personel WHERE calisma_id = ?`, [hedefId]) || 0) + 1;
    const sut = CP_ALANLAR.concat(['onay_sabit', 'onay_giris', 'onay_cikis']);
    const deg = sut.map(a => a === 'butce_bolumu' ? bb : a === 'sira' ? sira : (a === 'onay_sabit' && row.onay_sabit === 1 ? 0 : row[a]));
    db.islem(() => {
      db.calistir(`INSERT INTO calisma_personel (calisma_id, tc_kimlik_no, ${sut.join(',')}) VALUES (?, ?, ${sut.map(() => '?').join(',')})`,
                  [hedefId, tc].concat(deg));
      db.calistir(`INSERT OR REPLACE INTO aylik_girdi (calisma_id, tc_kimlik_no, ay, alan, deger)
                   SELECT ?, tc_kimlik_no, ay, alan, deger FROM aylik_girdi WHERE calisma_id = ? AND tc_kimlik_no = ?`, [hedefId, kaynakId, tc]);
      db.calistir(`INSERT OR REPLACE INTO performans_girdi (calisma_id, tc_kimlik_no, alan, deger)
                   SELECT ?, tc_kimlik_no, alan, deger FROM performans_girdi WHERE calisma_id = ? AND tc_kimlik_no = ?`, [hedefId, kaynakId, tc]);
      ['aylik_girdi', 'performans_girdi', 'calisma_personel'].forEach(t =>
        db.calistir(`DELETE FROM ${t} WHERE calisma_id = ? AND tc_kimlik_no = ?`, [kaynakId, tc]));
    });
    log('TASI', 'calisma_personel', tc, k.grup_adi + ' · ' + k.ad + ' → ' + h.grup_adi + ' · ' + h.ad);
    onbellekTemizle();
    return { hedef: h, butceBolumu: bb };
  }

  /* tasima = { hedefId, butceBolumu }: kart kaydı ve grup taşıma TEK İŞLEMDE yapılır — taşıma başarısız
     olursa kart değişikliği de geri alınır. Dönüş: tasima yoksa T.C.; varsa { tc, hedef, butceBolumu }. */
  function calismaPersonelKaydet(id, v, eskiTc, tasima) {
    if (!tasima) return calismaPersonelKaydetIc(id, v, eskiTc);
    return db.islem(() => {
      const tc = calismaPersonelKaydetIc(id, v, eskiTc);
      return Object.assign({ tc: tc }, calismaPersonelTasi(id, tc, tasima.hedefId, tasima.butceBolumu));
    });
  }
  function calismaPersonelKaydetIc(id, v, eskiTc) {
    calismaYazIste(id, 'personel.yaz');
    const tc = U.tcTemizle(v.tc_kimlik_no);
    if (tc.length !== 11) throw new Error('T.C. Kimlik No 11 haneli olmalıdır.');
    const ad = U.bicimAd(v.ad_soyad);
    if (!ad) throw new Error('Ad Soyad zorunludur.');
    if (v.yaka !== 'B' && v.yaka !== 'M') throw new Error('Yaka B (beyaz) ya da M (mavi) olmalıdır.');
    db.islem(() => {
      if (eskiTc && eskiTc !== tc) {
        if (personelGetir(tc)) throw new Error('Yeni T.C. No başka bir personele ait.');
        db.calistir(`UPDATE personel SET tc_kimlik_no = ? WHERE tc_kimlik_no = ?`, [tc, eskiTc]);
      }
      const p = personelGetir(tc);
      const satir = db.tek(`SELECT onay_sabit FROM calisma_personel WHERE calisma_id = ? AND tc_kimlik_no = ?`, [id, tc]);
      if (p && satir && satir.onay_sabit === 2) {
        /* Bu çalışmanın KENDİ dönem tarihleri var (kişi sonra başka dönemde / grupta yeniden girdi):
           tarih bu satıra yazılır, kişi kartının güncel tarihine dokunulmaz. */
        db.calistir(`UPDATE personel SET ad_soyad = ?, bolum = ?, ekip = ?, gorev = ?, guncelleme = ? WHERE tc_kimlik_no = ?`,
                    [ad, v.bolum || null, v.ekip || null, v.gorev || null, U.simdi(), tc]);
        db.calistir(`UPDATE calisma_personel SET onay_giris = ?, onay_cikis = ? WHERE calisma_id = ? AND tc_kimlik_no = ?`,
                    [v.ise_giris || null, v.isten_ayrilis || null, id, tc]);
      } else if (p) {
        donemTarihleriniKoru(tc, v.ise_giris, v.isten_ayrilis, id);
        db.calistir(`UPDATE personel SET ad_soyad = ?, ise_giris = ?, isten_ayrilis = ?, bolum = ?,
                     ekip = ?, gorev = ?, guncelleme = ? WHERE tc_kimlik_no = ?`,
                    [ad, v.ise_giris || null, v.isten_ayrilis || null, v.bolum || null, v.ekip || null,
                     v.gorev || null, U.simdi(), tc]);
      } else {
        db.calistir(`INSERT INTO personel (tc_kimlik_no, ad_soyad, ise_giris, isten_ayrilis, bolum, ekip,
                     gorev, kaynak, guncelleme) VALUES (?,?,?,?,?,?,?, 'ELLE', ?)`,
                    [tc, ad, v.ise_giris || null, v.isten_ayrilis || null, v.bolum || null, v.ekip || null,
                     v.gorev || null, U.simdi()]);
      }
      const degerler = CP_ALANLAR.map(a => {
        let x = v[a];
        if (CP_SAYISAL[a]) {
          if (x === '' || x == null) return CP_BOS_OLABILIR[a] ? null : 0;
          x = typeof x === 'number' ? x : trSayi(x);
          return isFinite(x) ? x : 0;
        }
        return x === '' || x == null ? null : x;
      });
      const var_ = db.deger(`SELECT COUNT(*) FROM calisma_personel WHERE calisma_id = ? AND tc_kimlik_no = ?`, [id, tc]);
      if (var_) {
        db.calistir(`UPDATE calisma_personel SET ${CP_ALANLAR.map(a => a + ' = ?').join(', ')}
                     WHERE calisma_id = ? AND tc_kimlik_no = ?`, degerler.concat([id, tc]));
      } else {
        db.calistir(`INSERT INTO calisma_personel (calisma_id, tc_kimlik_no, ${CP_ALANLAR.join(',')})
                     VALUES (?, ?, ${CP_ALANLAR.map(() => '?').join(',')})`, [id, tc].concat(degerler));
      }
    });
    log('KAYDET', 'calisma_personel', id + '/' + tc, ad);
    onbellekTemizle();
    return tc;
  }

  /* Tek bir alanı günceller (zam düzeltmesi gibi hızlı girişler için). */
  function calismaPersonelAlanYaz(id, tc, alan, deger) {
    const gerekli = (alan === 'duzeltme' || alan === 'performans_puani' || alan === 'performans_carpani')
      ? 'zam.yaz' : 'personel.yaz';
    calismaYazIste(id, gerekli);
    if (CP_ALANLAR.indexOf(alan) < 0) throw new Error('Bilinmeyen alan: ' + alan);
    let x = deger;
    if (CP_SAYISAL[alan]) {
      x = (deger === '' || deger == null) ? (CP_BOS_OLABILIR[alan] ? null : 0)
        : (typeof deger === 'number' ? deger : trSayi(deger));
    }
    db.calistir(`UPDATE calisma_personel SET ${alan} = ? WHERE calisma_id = ? AND tc_kimlik_no = ?`, [x, id, tc]);
    log('GUNCELLE', 'calisma_personel', id + '/' + tc, alan + ' = ' + x);
    onbellekTemizle();
  }

  function calismaPersonelSil(id, tc) {
    calismaYazIste(id, 'personel.yaz');
    db.islem(() => {
      db.calistir(`DELETE FROM aylik_girdi WHERE calisma_id = ? AND tc_kimlik_no = ?`, [id, tc]);
      // Kişinin bu çalışmadaki performans değerlendirmesi de gider (artık kalmasın)
      db.calistir(`DELETE FROM performans_girdi WHERE calisma_id = ? AND tc_kimlik_no = ?`, [id, tc]);
      db.calistir(`DELETE FROM calisma_personel WHERE calisma_id = ? AND tc_kimlik_no = ?`, [id, tc]);
    });
    log('SIL', 'calisma_personel', id + '/' + tc);
    onbellekTemizle();
  }

  /* Bir çalışmanın personelini başka bir çalışmaya aktarır.
     YENI_YIL: kaynak yılın ZAMLI maaşı hedefin "önceki yıl maaşı" olur;
               kaynak yılın maliyeti karşılaştırma maliyeti olur; düzeltme
               ve performans sıfırlanır; Aralık'taki hesaplama türü /
               kanun / sakatlık / teşvik geçerli değer olarak taşınır.
               Kaynak yıl içinde ayrılanlar aktarılmaz.
     KOPYA:    satırlar, aylık girdiler ve özet değerleri birebir kopyalanır. */
  function calismaPersonelKopyala(kaynakId, hedefId, tur) {
    calismaOkuIste(kaynakId);
    const hedef = calismaYazIste(hedefId, 'personel.yaz');
    const kaynak = calismaGetir(kaynakId);
    if (kaynak.grup_kod !== hedef.grup_kod) throw new Error('Kaynak ve hedef aynı grupta olmalı.');
    let n = 0;
    if (tur === 'KOPYA') {
      const sut = CP_ALANLAR.join(',');
      db.islem(() => {
        n = db.calistir(`INSERT OR IGNORE INTO calisma_personel (calisma_id, tc_kimlik_no, ${sut})
                         SELECT ?, tc_kimlik_no, ${sut} FROM calisma_personel WHERE calisma_id = ?`, [hedefId, kaynakId]).degisen;
        db.calistir(`INSERT OR IGNORE INTO aylik_girdi (calisma_id, tc_kimlik_no, ay, alan, deger)
                     SELECT ?, tc_kimlik_no, ay, alan, deger FROM aylik_girdi WHERE calisma_id = ?`, [hedefId, kaynakId]);
        db.calistir(`INSERT OR IGNORE INTO calisma_ozet (calisma_id, anahtar, deger)
                     SELECT ?, anahtar, deger FROM calisma_ozet WHERE calisma_id = ?`, [hedefId, kaynakId]);
        db.calistir(`INSERT OR IGNORE INTO performans_girdi (calisma_id, tc_kimlik_no, alan, deger)
                     SELECT ?, tc_kimlik_no, alan, deger FROM performans_girdi WHERE calisma_id = ?`, [hedefId, kaynakId]);
        db.calistir(`INSERT OR IGNORE INTO mesai_ongoru (calisma_id, yaka, bolum, ay, alan, deger)
                     SELECT ?, yaka, bolum, ay, alan, deger FROM mesai_ongoru WHERE calisma_id = ?`, [hedefId, kaynakId]);
      });
    } else {
      const h = calismaHesapla(kaynakId);
      const har = aylikGirdiHarita(kaynakId);
      const son = (tc, alan, vars) => {          // sürekli alanın Aralık'taki geçerli (ham) değeri
        const o = har[tc] || {}; let v = vars;
        for (let m = 2; m <= 12; m++) if (o[m] && o[m][alan] !== undefined) v = o[m][alan];
        return v;
      };
      db.islem(() => h.kisiler.forEach(s => {
        const k = s.kp;
        /* Çıkış tarihi personel kartından GÜNCEL okunur (hesap önbelleğinden ya da onaylı
           çalışmanın dondurulmuş tarihinden değil): onaydan sonra ayrılan da aktarılmaz. */
        const cikis = db.deger(`SELECT isten_ayrilis FROM personel WHERE tc_kimlik_no = ?`, [k.tc_kimlik_no])
          || (k.onay_sabit ? k.onay_cikis : null);      // yeniden girdiyse kartta çıkış silinmiştir; dönem çıkışı satırda
        if (cikis && Number(String(cikis).slice(0, 4)) <= kaynak.yil) return;
        /* Hedef yılda başka bir grubun çalışmasında zaten varsa (grup değiştirmiş) aktarılmaz */
        if (db.deger(`SELECT COUNT(*) FROM calisma_personel cp JOIN calisma c ON c.id = cp.calisma_id
                      WHERE cp.tc_kimlik_no = ? AND c.yil = ? AND c.grup_kod <> ?`, [k.tc_kimlik_no, hedef.yil, hedef.grup_kod])) return;
        const d = son(k.tc_kimlik_no, 'sakatlik_derece', k.sakatlik_derece);
        n += db.calistir(`INSERT OR IGNORE INTO calisma_personel (calisma_id, tc_kimlik_no, sira, butce_bolumu, yaka,
            maas_eski, zam_ayi, duzeltme, maliyet_onceki, hesap_turu, sakatlik_derece,
            ozurlu_indirimi, bes, kanun, gv_tesvik, yol, not_metni)
            VALUES (?,?,?,?,?,?,1,0,?,?,?,?,?,?,?,?,?)`,
          [hedefId, k.tc_kimlik_no, k.sira, k.butce_bolumu, k.yaka, s.zam.yeni, s.yil.maliyet,
           son(k.tc_kimlik_no, 'hesap_turu', k.hesap_turu), d === '' ? null : d,
           Number(son(k.tc_kimlik_no, 'ozurlu_indirimi', k.ozurlu_indirimi)) || 0, son(k.tc_kimlik_no, 'bes', k.bes),
           son(k.tc_kimlik_no, 'kanun', k.kanun), Number(son(k.tc_kimlik_no, 'gv_tesvik', k.gv_tesvik)) || 0,
           Number(son(k.tc_kimlik_no, 'yol', k.yol)) || 0, k.not_metni]).degisen;
      }));
    }
    /* Grubun ayarları (zam kademesi) yeni çalışmaya da geçer. AR-GE günü yeni yıla taşınmaz: o yılın kararıdır,
       kişiye Aylık Girdiler'den girilir. Eksik gün öngörüsü ('gun.*') ve teşvik oranları (05510 hariç: işyerinin
       niteliğidir) yalnızca KOPYA'da taşınır: yeni yılda o yılın kararıdır. */
    db.calistir(`INSERT OR IGNORE INTO calisma_ayar (calisma_id, anahtar, deger)
                 SELECT ?, anahtar, deger FROM calisma_ayar WHERE calisma_id = ?
                 ${tur === 'KOPYA' ? '' : "AND anahtar NOT LIKE 'gun.%' AND anahtar NOT LIKE 'dagilim.%' AND anahtar <> 'arge_gun' AND (anahtar NOT LIKE 'tesvik.%' OR anahtar = 'tesvik.k05510')"}`, [hedefId, kaynakId]);
    /* 'dagilim.*' (Maaş Dağılımı listesine elle alınan / çıkarılan kişiler) da yeni yıla
       taşınmaz: bu yılın yeni gireni gelecek yıl zam alır, listede olmalıdır. */
    log('KOPYALA', 'calisma_personel', kaynakId + ' → ' + hedefId, tur + ', ' + n + ' kişi');
    onbellekTemizle();
    return n;
  }

  /* ---------------------------------------------------------------
     DIŞ LİSTE AKTARIMI (ERP / bordro programı)
     ERP'den ya da bordro programından alınan Excel / yapıştırılmış liste ile;
     doğrudan veritabanı bağlantısı kurulursa yalnızca bu işlevin kaynağı değişir.
     satir = { tc, ad, ise_giris, isten_ayrilis, bolum, ekip, gorev,
               maas (önceki yıl net maaş), yaka, butce_bolumu,
               maliyet (önceki yıl gerçekleşen maliyet) }
     Boş gelen alana dokunulmaz.
     yeniEklensin: { tc: true } — çalışmada olmayıp eklenecekler
     --------------------------------------------------------------- */
  function erpAktar(id, satirlar, yeniEklensin) {
    const c = calismaYazIste(id, 'personel.yaz');
    let guncel = 0, eklenen = 0;
    const bol = butceBolumuListe(c.grup_kod).map(b => b.ad);
    db.islem(() => satirlar.forEach(r => {
      const tc = U.tcTemizle(r.tc);
      if (tc.length !== 11) return;
      const cp = db.tek(`SELECT * FROM calisma_personel WHERE calisma_id = ? AND tc_kimlik_no = ?`, [id, tc]);
      if (!cp && !(yeniEklensin || {})[tc]) return;
      const p = personelGetir(tc);
      if (p) {
        const alan = { ad_soyad: r.ad ? U.bicimAd(r.ad) : null, ise_giris: r.ise_giris, isten_ayrilis: r.isten_ayrilis,
                       bolum: r.bolum, ekip: r.ekip, gorev: r.gorev };
        const set = Object.keys(alan).filter(a => alan[a] != null && alan[a] !== '');
        if (alan.ise_giris || alan.isten_ayrilis)
          donemTarihleriniKoru(tc, alan.ise_giris || p.ise_giris, alan.isten_ayrilis || p.isten_ayrilis, id);
        if (set.length) db.calistir(`UPDATE personel SET ${set.map(a => a + ' = ?').join(', ')}, kaynak = 'ERP', guncelleme = ?
                                     WHERE tc_kimlik_no = ?`, set.map(a => alan[a]).concat([U.simdi(), tc]));
      } else {
        if (!r.ad) throw new Error(tc + ': yeni personelin adı dosyada yok.');
        db.calistir(`INSERT INTO personel (tc_kimlik_no, ad_soyad, ise_giris, isten_ayrilis, bolum, ekip, gorev, kaynak, guncelleme)
                     VALUES (?,?,?,?,?,?,?, 'ERP', ?)`,
                    [tc, U.bicimAd(r.ad), r.ise_giris || null, r.isten_ayrilis || null, r.bolum || null, r.ekip || null,
                     r.gorev || null, U.simdi()]);
      }
      // Dosyada "08 PAZARLAMA" ya da "Pazarlama" gelebilir: numarasız, büyük/küçük harf duyarsız eşleşir
      const bt = r.butce_bolumu ? window.BOLUM_TEMIZLE(r.butce_bolumu).toLocaleUpperCase('tr-TR') : '';
      const bb = bt ? (bol.find(b => b.toLocaleUpperCase('tr-TR') === bt) || null) : null;
      const yaka = r.yaka === 'M' || r.yaka === 'B' ? r.yaka : null;
      if (cp) {
        const alan = { maas_eski: r.maas, maliyet_onceki: r.maliyet, yaka: yaka, butce_bolumu: bb };
        const set = Object.keys(alan).filter(a => alan[a] != null);
        if (set.length) db.calistir(`UPDATE calisma_personel SET ${set.map(a => a + ' = ?').join(', ')}
                                     WHERE calisma_id = ? AND tc_kimlik_no = ?`, set.map(a => alan[a]).concat([id, tc]));
        guncel++;
      } else {
        const sira = (db.deger(`SELECT MAX(sira) FROM calisma_personel WHERE calisma_id = ?`, [id]) || 0) + 1;
        db.calistir(`INSERT INTO calisma_personel (calisma_id, tc_kimlik_no, sira, butce_bolumu, yaka, maas_eski,
                     maliyet_onceki, hesap_turu, kanun, zam_ayi) VALUES (?,?,?,?,?,?,?, 'SSK', 'YOK', 1)`,
                    [id, tc, sira, bb, yaka || 'B', r.maas || 0, r.maliyet == null ? null : r.maliyet]);
        eklenen++;
      }
    }));
    log('AKTAR', 'calisma_personel', id, guncel + ' güncellendi, ' + eklenen + ' eklendi');
    onbellekTemizle();
    return { guncel: guncel, eklenen: eklenen };
  }

  /* Aynı yıl başka bir grubun çalışmasında kayıtlı T.C.'ler (grup adı verilmez —
     yetkisiz gruba ait bilgi sızmasın, yalnızca var/yok). */
  function tcBaskaGrupta(yil, grupKod, tcListe) {
    const s = {};
    if (!tcListe.length) return s;
    db.tumu(`SELECT DISTINCT cp.tc_kimlik_no FROM calisma_personel cp JOIN calisma c ON c.id = cp.calisma_id
             WHERE c.yil = ? AND c.grup_kod <> ?`, [yil, grupKod]).forEach(r => { if (tcListe.indexOf(r.tc_kimlik_no) >= 0) s[r.tc_kimlik_no] = 1; });
    return s;
  }

  /* ---------------------------------------------------------------
     AYLIK GİRDİLER
     --------------------------------------------------------------- */
  /* Sürekli alanlar girildiği aydan itibaren sonraki aylara devreder. Mesai (fm1/fm2) da süreklidir:
     Ocak'a girilen mesai saatleri, değiştirilmedikçe bütün aylarda geçerlidir (aylık standart mesai öngörüsü).
     arge_gun da DEVREDER: girildiği aydan itibaren sonraki aylarda geçerlidir. Girilmemişse çalışmanın
     AR-GE günü ayarı (Çalışma Ayarları) kullanılır; o da yoksa 0 — varsayılan yoktur. */
  const AYLIK_SUREKLI = ['hesap_turu', 'kanun', 'sakatlik_derece', 'ozurlu_indirimi', 'bes', 'gv_tesvik', 'yol', 'fm1', 'fm2', 'arge_gun'];
  const AYLIK_TEK = ['ayni', 'prim', 'yakit', 'calisilan_gun'];
  /* Kişinin hesaplama bilgisi olan alanlar: yazmak için personel.yaz gerekir (aylık tutarlar aylik.yaz ister) */
  const AYLIK_KISI_ALANLARI = ['hesap_turu', 'kanun', 'sakatlik_derece', 'ozurlu_indirimi', 'bes', 'gv_tesvik', 'yol'];
  const AYLIK_ETIKET = {
    hesap_turu: 'Hesaplama türü', kanun: 'Kanun türü', sakatlik_derece: 'Sakatlık derecesi',
    ozurlu_indirimi: 'Özürlü indirimi', bes: 'BES', gv_tesvik: 'GV teşvik oranı', yol: 'Yol parası',
    ayni: 'Net ayni yardım', prim: 'Prim ve diğer ödemeler', fm1: 'FM1 mesai (saat)',
    fm2: 'FM2 mesai (saat)', yakit: 'Yakıt yardımı', calisilan_gun: 'Çalışılan gün', arge_gun: 'AR-GE gün',
  };

  /* ---------------------------------------------------------------
     PERFORMANS DEĞERLENDİRME — girdiler; hesap js/core/performans.js
     --------------------------------------------------------------- */
  function performansGirdiHarita(id) {
    calismaOkuIste(id);
    const h = {};
    db.tumu(`SELECT tc_kimlik_no, alan, deger FROM performans_girdi WHERE calisma_id = ?`, [id]).forEach(r => {
      (h[r.tc_kimlik_no] = h[r.tc_kimlik_no] || {})[r.alan] = r.deger;
    });
    return h;
  }
  /* liste = [{ tc, alan, deger }] — deger boş/null ise alan silinir. Tek işlemde yazılır. */
  function performansGirdiYaz(id, liste, aciklama) {
    calismaYazIste(id, 'zam.yaz');
    const kisi = {};
    db.tumu(`SELECT tc_kimlik_no FROM calisma_personel WHERE calisma_id = ?`, [id]).forEach(r => { kisi[r.tc_kimlik_no] = 1; });
    liste.forEach(x => {
      if (!window.PERF.alanGecerli(x.alan)) throw new Error('Bilinmeyen performans alanı: ' + x.alan);
      if (!kisi[x.tc]) throw new Error(x.tc + ' bu çalışmada yok.');
    });
    db.islem(() => liste.forEach(x => {
      if (x.deger == null || String(x.deger).trim() === '')
        db.calistir(`DELETE FROM performans_girdi WHERE calisma_id = ? AND tc_kimlik_no = ? AND alan = ?`, [id, x.tc, x.alan]);
      else
        db.calistir(`INSERT OR REPLACE INTO performans_girdi (calisma_id, tc_kimlik_no, alan, deger) VALUES (?,?,?,?)`,
                    [id, x.tc, x.alan, String(x.deger).trim()]);
    }));
    log('KAYDET', 'performans_girdi', id, (aciklama || 'elle') + ', ' + liste.length + ' alan');
    onbellekTemizle();
  }
  function performansGirdiSil(id, tc) {
    calismaYazIste(id, 'zam.yaz');
    db.calistir(`DELETE FROM performans_girdi WHERE calisma_id = ? AND tc_kimlik_no = ?`, [id, tc]);
    log('SIL', 'performans_girdi', id + '/' + tc, 'değerlendirme silindi');
    onbellekTemizle();
  }
  /* Hesaplanan çarpanları zam hesabına yazar. harita = { tc: çarpan }; haritada olmayan
     (değerlendirilmeyen) kişinin çarpanı boşaltılır (= 1). Çalışmada performans açılır. */
  function performansCarpanUygula(id, harita) {
    calismaYazIste(id, 'zam.yaz');
    let n = 0;
    db.islem(() => {
      db.tumu(`SELECT tc_kimlik_no FROM calisma_personel WHERE calisma_id = ?`, [id]).forEach(r => {
        const v = harita[r.tc_kimlik_no];
        db.calistir(`UPDATE calisma_personel SET performans_carpani = ? WHERE calisma_id = ? AND tc_kimlik_no = ?`,
                    [v == null ? null : v, id, r.tc_kimlik_no]);
        if (v != null) n++;
      });
      db.calistir(`UPDATE calisma SET zam_performans = 1 WHERE id = ?`, [id]);
    });
    log('KAYDET', 'calisma_personel', id, 'performans çarpanı uygulandı, ' + n + ' kişi');
    onbellekTemizle();
    return n;
  }
  /* Önceki dönemin (aynı grup, bir önceki yıl) değerlendirmesi — şablona kalıcı bilgileri
     (değerlendirme bölümü, amir adları, eğitim, kıdem) önceden doldurmak için. */
  function performansOncekiDonem(id) {
    const c = calismaGetir(id);
    const l = calismaListe().filter(x => x.grup_kod === c.grup_kod && x.yil === c.yil - 1)
      .sort((a, b) => (b.durum === 'ONAYLI') - (a.durum === 'ONAYLI'));
    for (const o of l) { const h = performansGirdiHarita(o.id); if (Object.keys(h).length) return { calisma: o, harita: h }; }
    return null;
  }

  /* ---------------------------------------------------------------
     MESAİ ÖNGÖRÜSÜ — bölüm × ay toplam saat ve kişi sayısı
     --------------------------------------------------------------- */
  const mesaiAnahtar = b => String(b || '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr-TR');
  /* { tablo: { 'M|BÖLÜM': { bolum, yaka, fm1:[13], fm2:[13], kisi:[13] } }, takvim: { gun:[13], … } } */
  function mesaiOku(id) {
    calismaOkuIste(id);
    const tablo = {}, takvim = {};
    db.tumu(`SELECT yaka, bolum, ay, alan, deger FROM mesai_ongoru WHERE calisma_id = ?`, [id]).forEach(r => {
      if (!r.yaka && !r.bolum) { (takvim[r.alan] = takvim[r.alan] || [])[r.ay] = r.deger; return; }
      const k = r.yaka + '|' + mesaiAnahtar(r.bolum);
      const t = tablo[k] = tablo[k] || { yaka: r.yaka, bolum: r.bolum, fm1: [], fm2: [], kisi: [] };
      if (t[r.alan]) t[r.alan][r.ay] = r.deger;
    });
    return { tablo, takvim };
  }
  /* liste = [{ yaka, bolum, ay, alan, deger }] — deger boş/null ise silinir */
  function mesaiYaz(id, liste, aciklama) {
    calismaYazIste(id, 'aylik.yaz');
    const ALAN = { fm1: 1, fm2: 1, kisi: 1, gun: 1, tatil_mesai: 1, tatil_tam: 1, tatil_yok: 1 };
    liste.forEach(x => {
      if (!ALAN[x.alan]) throw new Error('Bilinmeyen mesai alanı: ' + x.alan);
      if (!(x.ay >= 1 && x.ay <= 12)) throw new Error('Geçersiz ay: ' + x.ay);
    });
    db.islem(() => liste.forEach(x => {
      const b = x.yaka ? String(x.bolum || '').replace(/\s+/g, ' ').trim() : '';
      if (x.deger == null || x.deger === '')
        db.calistir(`DELETE FROM mesai_ongoru WHERE calisma_id = ? AND yaka = ? AND bolum = ? AND ay = ? AND alan = ?`, [id, x.yaka || '', b, x.ay, x.alan]);
      else
        db.calistir(`INSERT OR REPLACE INTO mesai_ongoru (calisma_id, yaka, bolum, ay, alan, deger) VALUES (?,?,?,?,?,?)`,
                    [id, x.yaka || '', b, x.ay, x.alan, Number(x.deger)]);
    }));
    log('KAYDET', 'mesai_ongoru', id, (aciklama || 'elle') + ', ' + liste.length + ' hücre');
    onbellekTemizle();
  }
  /* Kaynak çalışmanın tablosunu hedefe kopyalar (hedefteki tablo silinir) */
  function mesaiKopyala(hedefId, kaynakId) {
    calismaYazIste(hedefId, 'aylik.yaz');
    calismaOkuIste(kaynakId);
    db.islem(() => {
      db.calistir(`DELETE FROM mesai_ongoru WHERE calisma_id = ?`, [hedefId]);
      db.calistir(`INSERT INTO mesai_ongoru (calisma_id, yaka, bolum, ay, alan, deger)
                   SELECT ?, yaka, bolum, ay, alan, deger FROM mesai_ongoru WHERE calisma_id = ?`, [hedefId, kaynakId]);
    });
    log('KOPYALA', 'mesai_ongoru', kaynakId + ' → ' + hedefId, 'mesai öngörüsü');
    onbellekTemizle();
  }
  /* Açıkken kişilerin aylık mesaisi tablodan gelir (kişiye o ay elle girilen mesai önceliklidir) */
  function mesaiAktifYaz(id, acik) {
    calismaYazIste(id, 'aylik.yaz');
    db.calistir(acik ? `INSERT OR REPLACE INTO calisma_ayar (calisma_id, anahtar, deger) VALUES (?, 'mesai.ongoru', '1')`
                     : `DELETE FROM calisma_ayar WHERE calisma_id = ? AND anahtar = 'mesai.ongoru'`, [id]);
    log('KAYDET', 'calisma_ayar', id, 'mesai öngörüsü ' + (acik ? 'açıldı' : 'kapatıldı'));
    onbellekTemizle();
  }
  /* Kişi başı mesai: (yaka, bölüm, ay) → { fm1, fm2, kisi, kisiMevcut }.
     Kişi sayısı girilmemişse çalışmadaki mevcut kadro sayılır. Beyaz yakada hafta içi mesai yok. */
  function mesaiKisiBasi(id, personel) {
    const m = mesaiOku(id);
    const mevcut = {};
    (personel || calismaPersonelListe(id)).forEach(kp => {
      const k = (kp.yaka === 'M' ? 'M' : 'B') + '|' + mesaiAnahtar(kp.bolum);
      mevcut[k] = (mevcut[k] || 0) + 1;
    });
    return (yaka, bolum, ay) => {
      const y = yaka === 'M' ? 'M' : 'B', k = y + '|' + mesaiAnahtar(bolum);
      const t = m.tablo[k];
      const kisi = t && t.kisi[ay] != null ? t.kisi[ay] : (mevcut[k] || 0);
      const fm1 = y === 'M' && t && kisi ? (t.fm1[ay] || 0) / kisi : 0;
      const fm2 = t && kisi ? (t.fm2[ay] || 0) / kisi : 0;
      return { fm1, fm2, kisi, kisiMevcut: mevcut[k] || 0 };
    };
  }

  function aylikGirdiHarita(id) {
    calismaOkuIste(id);
    const h = {};
    db.tumu(`SELECT tc_kimlik_no, ay, alan, deger FROM aylik_girdi WHERE calisma_id = ?`, [id]).forEach(r => {
      const t = h[r.tc_kimlik_no] = h[r.tc_kimlik_no] || {};
      const a = t[r.ay] = t[r.ay] || {};
      a[r.alan] = r.deger;
    });
    return h;
  }
  function aylikGirdiYaz(id, tc, ay, alan, deger) {
    // Kişinin hesaplama bilgileri personel.yaz, aylık tutarlar (mesai dâhil) aylik.yaz ister
    const kisiAlani = AYLIK_KISI_ALANLARI.indexOf(alan) >= 0;
    calismaYazIste(id, kisiAlani ? 'personel.yaz' : 'aylik.yaz');
    if (AYLIK_SUREKLI.indexOf(alan) < 0 && AYLIK_TEK.indexOf(alan) < 0) throw new Error('Bilinmeyen alan: ' + alan);
    if (deger === '' || deger == null) {
      db.calistir(`DELETE FROM aylik_girdi WHERE calisma_id = ? AND tc_kimlik_no = ? AND ay = ? AND alan = ?`,
                  [id, tc, ay, alan]);
    } else {
      db.calistir(`INSERT OR REPLACE INTO aylik_girdi (calisma_id, tc_kimlik_no, ay, alan, deger) VALUES (?,?,?,?,?)`,
                  [id, tc, ay, alan, String(deger)]);
    }
    log('KAYDET', 'aylik_girdi', id + '/' + tc + '/' + ay, alan + ' = ' + deger);
    onbellekTemizle();
  }
  /* Bir alanı bir ay için bütün kişilere birden yazar (örn. bayram ayni yardımı). */
  function aylikGirdiToplu(id, ay, alan, deger, tcListe) {
    /* Tek girişteki denetimlerin aynısı: bilinmeyen alan reddedilir, kişi bilgisi alanı personel.yaz ister */
    if (AYLIK_SUREKLI.indexOf(alan) < 0 && AYLIK_TEK.indexOf(alan) < 0) throw new Error('Bilinmeyen alan: ' + alan);
    if (!(ay >= 1 && ay <= 12)) throw new Error('Ay 1 ile 12 arasında olmalı.');
    calismaYazIste(id, AYLIK_KISI_ALANLARI.indexOf(alan) >= 0 ? 'personel.yaz' : 'aylik.yaz');
    db.islem(() => tcListe.forEach(tc => {
      if (deger === '' || deger == null)
        db.calistir(`DELETE FROM aylik_girdi WHERE calisma_id = ? AND tc_kimlik_no = ? AND ay = ? AND alan = ?`,
                    [id, tc, ay, alan]);
      else
        db.calistir(`INSERT OR REPLACE INTO aylik_girdi (calisma_id, tc_kimlik_no, ay, alan, deger) VALUES (?,?,?,?,?)`,
                    [id, tc, ay, alan, String(deger)]);
    }));
    log('TOPLU', 'aylik_girdi', id + '/' + ay, alan + ' = ' + deger + ' (' + tcListe.length + ' kişi)');
    onbellekTemizle();
  }

  /* ---------------------------------------------------------------
     HESAP
     --------------------------------------------------------------- */
  /* anlik: onaylı çalışmanın dondurulmuş parametreleri (calisma_parametre); yoksa yılın güncel tabloları */
  function hesapParametre(yil, anlik) {
    const A = anlik || window.PARAMETRE_ANLIK_AL((sql, p) => db.tumu(sql, p), yil);
    const o = {}; A.parametre.forEach(r => { o[r.anahtar] = r.deger; });
    const s = (a, v) => parametreSayi(o, a, v);
    const dilimler = A.dilim.map(d => ({ ust: d.ust_sinir, oran: d.oran }));
    if (!dilimler.length) throw new Error(yil + ' yılının gelir vergisi dilimleri girilmemiş.');
    const au = A.asgari.map(a => ({ ay: a.baslangic_ay, brut: a.brut }));
    if (!au.length) throw new Error(yil + ' yılının asgari ücreti girilmemiş.');
    const turler = {};
    A.tur.forEach(t => {
      turler[t.kod] = { kol: t.kol, sgkIsci: t.sgk_isci, issizlikIsci: t.issizlik_isci,
        sgkIsveren: t.sgk_isveren, issizlikIsveren: t.issizlik_isveren,
        gv: !!t.gv, dv: !!t.dv, istisna: !!t.istisna };
    });
    const kanunKural = {};
    const kanunOran = {};
    A.kanun.forEach(k => { kanunKural[k.kod] = k.kural; kanunOran[k.kod] = k.oran == null ? null : Number(k.oran); });
    const zam = { M: {}, B: {} };
    ['M', 'B'].forEach(y => ZAM_TANIM.forEach(z => { zam[y][z.anahtar === 'alt_esik' ? 'altEsik' :
      z.anahtar === 'ust_esik' ? 'ustEsik' : z.anahtar === 'ust_oran' ? 'ustOran' : 'altOran'] =
      s('zam.' + y + '.' + z.anahtar, z.vars); }));
    const P = HESAP.parametreHazirla({
      yil: yil, dilimler: dilimler, asgariUcret: au, tavanCarpan: s('tavan_carpan', 9),
      dv: s('dv', 0.00759), besOrani: s('bes_orani', 0.03), argeGun: 0,
      istisnaKesinti: s('istisna_kesinti', 0.15), turler: turler,
      tesvik: { k05510: s('t05510', 0.02), k05746: s('t05746', 0.09875),
                k14857: s('t14857', 0.1975), k15510: s('t15510', 0.05) },
    });
    P.kanunKural = kanunKural;
    P.kanunOran = kanunOran;
    P.zamKademe = zam;
    P.performans = A.performans;
    P.sakatlik = {};
    A.sakatlik.forEach(x => { P.sakatlik[x.derece] = x.tutar; });
    P.dondurulmus = !!anlik;
    return P;
  }

  function calismaParametreAnlik(id) {
    const r = db.tek(`SELECT veri FROM calisma_parametre WHERE calisma_id = ?`, [id]);
    if (!r) return null;
    try { return JSON.parse(r.veri); } catch (e) { return null; }
  }
  function calismaParametreDondurulmusMu(id) { return !!db.deger(`SELECT COUNT(*) FROM calisma_parametre WHERE calisma_id = ?`, [id]); }
  /* Yılın onaylı (dondurulmuş) çalışmaları — Parametreler ekranında kilit bilgisi için */
  function yilOnayliCalismalar(yil) {
    return db.tumu(`SELECT c.id, c.ad, c.grup_kod, g.ad AS grup_adi, cp.tarih FROM calisma c JOIN grup g ON g.kod = c.grup_kod
                    LEFT JOIN calisma_parametre cp ON cp.calisma_id = c.id
                    WHERE c.yil = ? AND c.durum = 'ONAYLI' ORDER BY g.sira, c.ad`, [yil]);
  }

  function ayOf(tarih, yil) {
    if (!tarih) return null;
    const y = Number(String(tarih).slice(0, 4)), a = Number(String(tarih).slice(5, 7));
    if (y < yil) return 0;       // yıl başından önce
    if (y > yil) return 13;      // yıl sonrasında
    return a;
  }

  function performansCarpani(P, kp) {
    if (kp.performans_carpani != null && kp.performans_carpani !== '') return Number(kp.performans_carpani);
    if (kp.performans_puani != null && P.performans.length) {
      const k = P.performans.find(p => kp.performans_puani >= p.alt_puan && kp.performans_puani <= p.ust_puan);
      if (k) return k.carpan;
    }
    return 1;
  }

  /* Birden çok çalışmanın (grup) birleşik hesabı — "Tümü" görünümü için.
     Her kişi kaydına hangi çalışmadan geldiği eklenir (s.calisma). */
  function birlesikHesapla(calismaListesi) {
    const kisiler = [], ozet = {};
    calismaListesi.forEach(c => {
      const h = calismaHesapla(c.id);
      h.kisiler.forEach(s => kisiler.push(Object.assign({ calisma: c }, s)));
      const o = calismaOzetOku(c.id);
      Object.keys(o).forEach(k => { if (o[k] != null) ozet[k] = (ozet[k] || 0) + Number(o[k]); });
    });
    return { kisiler: kisiler, ozet: ozet };
  }

  /* Bir çalışmanın bütün hesabı. Önbellekli; veri yazan her işlem önbelleği temizler.
     secenek.dilimler: GV tarifesini bu hesap için geçersiz kılar (karşılaştırma için); secenek.tazele: önbelleği atla. */
  function calismaHesapla(id, secenek) {
    calismaOkuIste(id);
    secenek = secenek || {};
    const c = calismaGetir(id);
    if (!c) throw new Error('Çalışma bulunamadı.');
    const anahtar = id + (secenek.dilimler ? ':d' : '');
    if (!secenek.tazele && hesapOnbellek[anahtar]) return hesapOnbellek[anahtar];
    const P = hesapParametre(c.yil, c.durum === 'ONAYLI' ? calismaParametreAnlik(id) : null);
    if (secenek.dilimler) {
      P.dilimler = secenek.dilimler;
      Object.assign(P, HESAP.parametreHazirla(Object.assign({}, P, { dilimler: secenek.dilimler })));
    }
    const girdi = aylikGirdiHarita(id);
    /* Çalışmaya özel varsayılanlar: yaka ve ay bazında çalışılan gün (örn. mavi yaka bazı
       aylarda eksik gün) ve AR-GE günü. Kişiye girilmiş gün her zaman önceliklidir. */
    const ayar = calismaAyarOku(id);
    const ayarSayi = k => ayar[k] == null || ayar[k] === '' ? null : Number(ayar[k]);
    /* AR-GE günü varsayılansızdır: çalışmaya gün girilmemişse 0; gün kişiye Aylık Girdiler'den girilir. */
    if (ayarSayi('arge_gun') != null) P.argeGun = ayarSayi('arge_gun');
    /* Teşvik oranı çalışmaya özel olabilir (örn. imalat işyerinde 05510 %5). Yalnızca o çalışmanın
       ayarıdır; yeni yıla taşınmaz, yeni yıl parametreyi kullanır — 05510 oranı hariç: o işyerinin
       niteliğidir ve yeni yıla geçer. */
    P.tesvik = Object.assign({}, P.tesvik);
    ['k05510', 'k05746', 'k14857', 'k15510'].forEach(k => { if (ayarSayi('tesvik.' + k) != null) P.tesvik[k] = ayarSayi('tesvik.' + k); });
    /* Zam öngörüsünün yuvarlama adımı da çalışmaya özel (boş = 10 TL) */
    const Z = { yontem: { kademe: !!c.zam_kademe, performans: !!c.zam_performans }, kademe: calismaZamKademe(c, P),
      yuvarla: { ongoru: ayarSayi('zam.yuvarla_ongoru') } };
    const varsayilanGun = (yaka, m) => {
      const v = ayar['gun.' + yaka + '.' + m];
      return v == null || v === '' ? null : Number(v);
    };
    /* Mesai öngörüsü açıksa kişinin aylık mesaisi bölüm tablosundan gelir */
    const personelListe = calismaPersonelListe(id);
    const mesaiOng = ayar['mesai.ongoru'] === '1' ? mesaiKisiBasi(id, personelListe) : null;
    const kisiler = personelListe.map(kp => {
      /* Onaylı çalışmada onay anındaki tarihler: sonradan girilen çıkış onaylı maliyeti değiştirmez */
      const girisAy = ayOf(kp.onay_sabit ? kp.onay_giris : kp.ise_giris, c.yil);
      const cikisAy = ayOf(kp.onay_sabit ? kp.onay_cikis : kp.isten_ayrilis, c.yil);
      const zam = HESAP.zamHesapla(Z, {
        yaka: kp.yaka, eskiYilda: girisAy === 0 || girisAy === null,
        maasEski: kp.maas_eski, duzeltme: kp.duzeltme, carpan: performansCarpani(P, kp),
      });
      const k = {
        yaka: kp.yaka, girisAy: girisAy || 0, cikisAy: cikisAy, zamAyi: kp.zam_ayi || 1,
        maasEski: kp.maas_eski || 0, maasYeni: zam.yeni,
      };
      const kg = girdi[kp.tc_kimlik_no] || {};
      /* Sürekli alanlar Ocak'tan başlar, değiştiği aydan itibaren yeni değer geçerlidir. */
      const surekli = {
        tur: kp.hesap_turu, kanun: P.kanunKural[kp.kanun] || 'YOK', kanunOran: P.kanunOran[kp.kanun], sakatlikDerece: kp.sakatlik_derece,
        ozurluIndirimi: kp.ozurlu_indirimi || 0, bes: kp.bes, gvTesvik: kp.gv_tesvik || 0, yol: kp.yol || 0, fm1: 0, fm2: 0, argeGun: null,
      };
      const ALAN = { hesap_turu: 'tur', kanun: 'kanun', sakatlik_derece: 'sakatlikDerece',
        ozurlu_indirimi: 'ozurluIndirimi', bes: 'bes', gv_tesvik: 'gvTesvik', yol: 'yol', fm1: 'fm1', fm2: 'fm2', arge_gun: 'argeGun' };
      const aylikGirdiler = [null];
      const s = Object.assign({}, surekli);
      for (let m = 1; m <= 12; m++) {
        const a = kg[m] || {};
        AYLIK_SUREKLI.forEach(al => {
          if (a[al] === undefined) return;
          let v = a[al];
          if (al === 'kanun') { s.kanunOran = P.kanunOran[v]; v = P.kanunKural[v] || 'YOK'; }
          else if (al !== 'hesap_turu' && al !== 'bes') v = Number(v);
          s[ALAN[al]] = v;
        });
        const g = Object.assign({}, s);
        if (mesaiOng) {
          const o = mesaiOng(kp.yaka, kp.bolum, m);
          g.fm1 = a.fm1 !== undefined ? Number(a.fm1) : o.fm1;
          g.fm2 = a.fm2 !== undefined ? Number(a.fm2) : o.fm2;
        }
        /* Sakatlık indirimi dereceden, o YILIN tablosundan gelir (öngörü
           uygulanınca kendiliğinden artar). Derece yoksa kişiye girilen tutar geçerlidir. */
        if (g.sakatlikDerece) g.ozurluIndirimi = P.sakatlik[g.sakatlikDerece] || 0;
        g.ayni = Number(a.ayni) || 0; g.prim = Number(a.prim) || 0;
        g.yakit = Number(a.yakit) || 0;
        g.calisilanGun = a.calisilan_gun != null ? Number(a.calisilan_gun) : varsayilanGun(kp.yaka, m);
        aylikGirdiler.push(g);
      }
      const yil = HESAP.yilHesapla(P, k, m => aylikGirdiler[m]);
      return { kp: kp, zam: zam, yil: yil, girdi: aylikGirdiler };
    });
    const sonuc = { calisma: c, P: P, kisiler: kisiler };
    hesapOnbellek[anahtar] = sonuc;
    return sonuc;
  }

  /* ---------------------------------------------------------------
     SİSTEM
     --------------------------------------------------------------- */
  function ayarOku(anahtar, varsayilan) {
    const v = db.deger(`SELECT deger FROM sistem_bilgi WHERE anahtar = ?`, [anahtar]);
    return v === null || v === undefined ? varsayilan : v;
  }
  function ayarYaz(anahtar, deger) {
    db.calistir(`INSERT OR REPLACE INTO sistem_bilgi (anahtar, deger) VALUES (?,?)`, [anahtar, String(deger)]);
  }

  /* Hareketsizlikte otomatik kapanma süresi (dakika; 0 = kapalı).
     Varsayılan 5; yalnızca sistem yöneticisi değiştirir. */
  const ZAMAN_ASIMI_VARSAYILAN = 5;
  function oturumZamanAsimi() {
    let v = ZAMAN_ASIMI_VARSAYILAN;
    try { v = Number(ayarOku('oturum_zaman_asimi_dk', ZAMAN_ASIMI_VARSAYILAN)); } catch (e) { }
    return isFinite(v) && v >= 0 ? v : ZAMAN_ASIMI_VARSAYILAN;
  }
  function oturumZamanAsimiYaz(dk) {
    yetkiIste('sistem.yonet');
    const v = Math.round(Number(dk));
    if (!isFinite(v) || v < 0 || v > 240) throw new Error('Süre 0 ile 240 dakika arasında olmalıdır (0 = kapalı).');
    ayarYaz('oturum_zaman_asimi_dk', v);
    log('GUNCELLE', 'sistem_bilgi', 'oturum_zaman_asimi_dk', v + ' dk');
    return v;
  }

  const seedDb = () => ({
    calistir: (sql, p) => db.calistir(sql, p || []),
    deger: (sql, p) => db.deger(sql, p || []),
    tek: (sql, p) => db.tek(sql, p || []),
    tumu: (sql, p) => db.tumu(sql, p || []),
    islem: db.islem,
  });
  /* Veritabanı ilk oluşturulduğunda: temel veri + yasal parametreler (gruplar ve personel yok) */
  function seedYukle() {
    if (typeof window.TEMEL_VERI_YAZ === 'function') window.TEMEL_VERI_YAZ((sql, p) => db.calistir(sql, p || []));
    if (typeof window.SEED_YUKLE === 'function') window.SEED_YUKLE(seedDb());
  }
  /* Örnek veri (uydurma gruplar, personel ve çalışmalar) — deneme içindir; yalnız sistem yöneticisi.
     Var olan kayıtlar atlanır, yani ikinci kez çalıştırmak bir şey bozmaz. */
  function ornekVeriYukle() {
    yetkiIste('sistem.yonet');
    if (typeof window.ORNEK_VERI_YUKLE !== 'function') throw new Error('Örnek veri dosyası (data/ornek-veri.js) yüklenmemiş.');
    const sonuc = window.ORNEK_VERI_YUKLE(seedDb());
    log('ORNEK', 'sistem', null, 'örnek veri yüklendi');
    onbellekTemizle();
    return sonuc;
  }
  /* Boş başlangıç: hiç grup yoksa tek bir "Genel" grubu açılır */
  function varsayilanGrupAc() {
    yetkiIste('sistem.yonet');
    if (db.deger(`SELECT COUNT(*) FROM grup`)) return null;
    return grupKaydet({ kod: 'GENEL', ad: 'Genel', sira: 1 });
  }

  /* ---------------------------------------------------------------
     OKUMA KAPILARI
     Ekranlara giden kişi verisi yalnız ilgili okuma yetkisiyle verilir.
     İç hesaplar sarmalanmamış işlevleri kullanır; yalnız modüllere açılan kapılar denetlenir.
     SINIR: program tarayıcıda çalışır ve şifresi çözülmüş veritabanı oturum boyunca bellektedir; bu
     denetimler ekran dışından API çağrısını engeller, tarayıcı geliştirici araçlarıyla doğrudan veritabanı
     okunmasını engelleyemez. Bu tam koruma ancak sunucu tarafında kurulabilir.
     --------------------------------------------------------------- */
  const OKU_HESAP = ['sistem.yonet', 'ozet.oku', 'personel.oku', 'zam.oku', 'personel.yaz', 'zam.yaz', 'aylik.yaz', 'excel.aktar'];
  const OKU_PERSONEL = ['sistem.yonet', 'personel.oku', 'personel.yaz', 'zam.oku', 'zam.yaz', 'aylik.yaz', 'excel.aktar'];
  const OKU_PERFORMANS = ['zam.oku', 'zam.yaz', 'personel.oku', 'personel.yaz'];
  function okumaIste(kodlar) {
    if (!aktifKullanici) throw new Error('Oturum açık değil.');
    if (aktifKullanici.yonetici) return;
    if (!kodlar.some(yetkiVar)) throw new Error('Bu bilgiyi görme yetkiniz yok.');
  }
  const kapi = (fn, kodlar, sonra) => function () { okumaIste(kodlar); const r = fn.apply(null, arguments); return sonra ? sonra(r) : r; };
  const DIS = {
    calismaHesapla: kapi(calismaHesapla, OKU_HESAP),
    birlesikHesapla: kapi(birlesikHesapla, OKU_HESAP),
    calismaOzetOku: kapi(calismaOzetOku, OKU_HESAP),
    calismaPersonelListe: kapi(calismaPersonelListe, OKU_PERSONEL),
    calismaPersonelGetir: kapi(calismaPersonelGetir, OKU_PERSONEL),
    personelGetir: kapi(personelGetir, OKU_PERSONEL),
    personelGecmis: kapi(personelGecmis, OKU_PERSONEL),
    personelOnDoldur: kapi(personelOnDoldur, OKU_PERSONEL),
    aylikGirdiHarita: kapi(aylikGirdiHarita, OKU_PERSONEL),
    mesaiOku: kapi(mesaiOku, OKU_PERSONEL),
    performansGirdiHarita: kapi(performansGirdiHarita, OKU_PERFORMANS),
    performansOncekiDonem: kapi(performansOncekiDonem, OKU_PERFORMANS),
    logListe: kapi(logListe, ['sistem.yonet']),
    kullaniciListe: kapi(kullaniciListe, ['sistem.yonet']),
    kullaniciYetkileri: kapi(kullaniciYetkileri, ['sistem.yonet']),
    kullaniciGruplari: kapi(kullaniciGruplari, ['sistem.yonet']),
  };
  /* Birden çok yazmayı tek işlemde yapmak için (ör. Excel'den içe alma). fn senkron olmalı. */
  function topluIslem(fn) { return db.islem(fn); }

  return Object.assign({
    log, logListe, onbellekTemizle, oturumTazele, topluIslem,
    kullaniciVarMi, kullaniciListe, kullaniciEkle, kullaniciGuncelle, parolaDegistir, kullaniciSil,
    kullaniciYetkileri, kullaniciGruplari, kullaniciErisimYaz,
    girisYap, cikisYap, kullanici, yetkiVar, yetkiIste, grupGorebilir, grupYazabilir, calismaYazilabilir,

    grupListe, gorunurGruplar, grupKaydet, grupSil, aralikOner, maasAraliklari, maasAralikYaz,
    performansGirdiHarita, performansGirdiYaz, performansGirdiSil, performansCarpanUygula, performansOncekiDonem,
    calismaRevizeAc, calismaParametreDondurulmusMu, yilOnayliCalismalar,
    personelGecmis, personelOnDoldur, tasimaHedefleri, calismaPersonelTasi,
    mesaiOku, mesaiYaz, mesaiKopyala, mesaiAktifYaz, mesaiKisiBasi,
    butceBolumuListe, butceBolumuKaydet, butceBolumuSil, butceBolumuBirlestir, bolumEtiket, bolumSira, bolumKisiSayilari,
    hesapTuruListe, hesapTuruKaydet, hesapTuruSil,
    kanunListe, kanunKaydet, kanunSil,
    sakatlikListe, sakatlikTutari, sakatlikYaz,

    PARAMETRE_TANIM, ZAM_TANIM, yillar, parametreOku, parametreSayi, parametreYaz,
    dilimListe, dilimYaz, asgariListe, asgariYaz, performansListe, performansYaz, yilKopyala,
    parametreDurumu, ongoruHesapla, ongoruUygula, parametreDurumYaz, yilOnayliMi,

    calismaListe, calismaGetir, calismaKaydet, calismaSil, calismaOzetOku, calismaOzetYaz,
    calismaAyarOku, calismaAyarYaz, calismaZamKademe,

    personelGetir, calismaPersonelListe, calismaPersonelGetir, calismaPersonelKaydet,
    calismaPersonelAlanYaz, calismaPersonelSil, calismaPersonelKopyala, erpAktar, tcBaskaGrupta,

    AYLIK_SUREKLI, AYLIK_TEK, AYLIK_ETIKET, aylikGirdiHarita, aylikGirdiYaz, aylikGirdiToplu,

    hesapParametre, calismaHesapla, birlesikHesapla,
    ayarOku, ayarYaz, oturumZamanAsimi, oturumZamanAsimiYaz, seedYukle, ornekVeriYukle, varsayilanGrupAc, trSayi,
  }, DIS);
})();
