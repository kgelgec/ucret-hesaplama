/* =====================================================================
   VERİTABANI MOTORU — SQLite (sql.js / WebAssembly)
   ---------------------------------------------------------------------
   Veritabanı gerçek bir SQLite dosyasıdır ve TARAYICIDA DEĞİL, diskte
   durur: program klasörünün bir üstündeki "veri\butce.db" dosyası
   (sunucu: Sunucuyu-Baslat.ps1). Böylece tarayıcı verisi temizlense,
   profil bozulsa ya da başka tarayıcı kullanılsa da kayıtlar kaybolmaz.

   Bu katman: dosyada depolama, şifreleme, şifreleme işareti, çakışma
   koruması ve yazma kilidi (bkz. js/core/kilit.js). Ortak bir klasörde
   birden çok kişinin kullanımına göre kurulmuştur.

   Veri bir veritabanı sunucusunda tutulacaksa bu dosyanın yerine
   sunucuya HTTP isteği atan bir sürüm konur. Üst katmanlar (api.js ve
   modüller) değişmez.
   ===================================================================== */

window.ADB = (function () {
  'use strict';

  const IDB_ADI     = 'maas_butce_sistemi';
  const IDB_STORE   = 'veritabani';
  const IDB_ANAHTAR = 'main';

  let SQL = null;      // sql.js modülü
  let db  = null;      // açık veritabanı
  let yazmaZamanlayici = null;
  let yazmaBekleyen = false;
  const dinleyiciler = { kaydedildi: [], hata: [], cakisma: [] };

  /* ---------- base64 <-> Uint8Array ---------- */
  function b64ToBytes(b64) {
    const ham = atob(b64);
    const arr = new Uint8Array(ham.length);
    for (let i = 0; i < ham.length; i++) arr[i] = ham.charCodeAt(i);
    return arr;
  }
  function b64Yaz(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  /* ---------- IndexedDB yardımcıları ----------
     Tarayıcı deposu ASIL depo değildir. İki işi vardır:
       · veri dosyası yokken tarayıcıda kalmış veriyi bir kez dosyaya taşımak,
       · dosyaya yazılan son hâlin bir kopyasını tutmak (güvenlik ağı;
         şifreleme açıksa o kopya da şifrelidir).
     Sunucu hiç yoksa (index.html çift tıklanarak açıldıysa) veri yalnız burada durur. */
  function idbAc() {
    return new Promise((resolve, reject) => {
      const istek = indexedDB.open(IDB_ADI, 1);
      istek.onupgradeneeded = () => {
        const d = istek.result;
        if (!d.objectStoreNames.contains(IDB_STORE)) d.createObjectStore(IDB_STORE);
      };
      istek.onsuccess = () => resolve(istek.result);
      istek.onerror   = () => reject(istek.error);
    });
  }
  async function idbOku() {
    const d = await idbAc();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(IDB_STORE, 'readonly');
      const r  = tx.objectStore(IDB_STORE).get(IDB_ANAHTAR);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror   = () => reject(r.error);
    });
  }
  async function idbYaz(bytes) {
    const d = await idbAc();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(bytes, IDB_ANAHTAR);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }
  async function idbSil() {
    const d = await idbAc();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_ANAHTAR);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  /* ================================================================
     ŞİFRELEME — dosyayı eline geçiren okuyamasın
     ----------------------------------------------------------------
     Dosya biçimi:
       0..7    BTENC1 + iki sıfır bayt — tanıtıcı imza
       8..23   tuz (16 bayt) — her parola değişiminde yenilenir
       24..35  iv  (12 bayt) — her yazmada yenilenir
       36..    AES-256-GCM ile şifrelenmiş SQLite dosyası (+ etiket)
     Anahtar paroladan PBKDF2-SHA256 ile 250.000 turla üretilir ve
     YALNIZ tarayıcı belleğinde durur; sunucuya hiç gitmez. GCM doğrulama
     da yapar: yanlış parola "bozuk veri" değil, net bir hata verir.
     PAROLA KAYBOLURSA VERİ KURTARILAMAZ — arka kapı yoktur.
     ================================================================ */
  const SIFRE_IMZA = [66, 84, 69, 78, 67, 49, 0, 0];   /* BTENC1 + 2 sıfır */
  const SIFRE_TUZ_BOY = 16;
  const SIFRE_IV_BOY  = 12;
  const SIFRE_TUR_SAYISI = 250000;
  const SIFRE_TUZ_YEDEK = 'butce_sifre_tuzu';

  let sifreAnahtar = null;   /* CryptoKey */
  let sifreTuz     = null;   /* Uint8Array(16) */
  let parolaSoran  = null;   /* (tekrarMi, baglam) => parola | null   — açılış/yedek */
  let sifreKuranSoran = null;/* (baglam) => parola | null — yeni parola, iki kez sorar */

  function kriptoVar() { return !!(window.crypto && window.crypto.subtle); }

  function sifreliMi(bytes) {
    if (!bytes || bytes.length < SIFRE_IMZA.length) return false;
    for (let i = 0; i < SIFRE_IMZA.length; i++) if (bytes[i] !== SIFRE_IMZA[i]) return false;
    return true;
  }

  async function anahtarUret(parola, tuz) {
    const ham = await crypto.subtle.importKey('raw', new TextEncoder().encode(parola), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: tuz, iterations: SIFRE_TUR_SAYISI, hash: 'SHA-256' },
      ham, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function paketle(bytes) {
    const iv = crypto.getRandomValues(new Uint8Array(SIFRE_IV_BOY));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, sifreAnahtar, bytes));
    const paket = new Uint8Array(SIFRE_IMZA.length + SIFRE_TUZ_BOY + SIFRE_IV_BOY + ct.length);
    paket.set(SIFRE_IMZA, 0);
    paket.set(sifreTuz, SIFRE_IMZA.length);
    paket.set(iv, SIFRE_IMZA.length + SIFRE_TUZ_BOY);
    paket.set(ct, SIFRE_IMZA.length + SIFRE_TUZ_BOY + SIFRE_IV_BOY);
    return paket;
  }
  async function cozPaket(bytes, anahtar) {
    const bas = SIFRE_IMZA.length;
    const iv = bytes.subarray(bas + SIFRE_TUZ_BOY, bas + SIFRE_TUZ_BOY + SIFRE_IV_BOY);
    const ct = bytes.subarray(bas + SIFRE_TUZ_BOY + SIFRE_IV_BOY);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, anahtar || sifreAnahtar, ct));
  }
  function paketTuzu(bytes) { return bytes.slice(SIFRE_IMZA.length, SIFRE_IMZA.length + SIFRE_TUZ_BOY); }

  function sifreHatasi(m) { const h = new Error(m); h.sifreHatasi = true; return h; }

  /* Şifreli dosyayı açar: parola doğru olana kadar sorar. */
  async function sifreliDosyayiAc(bytes, baglam) {
    if (!kriptoVar()) throw sifreHatasi('Veri şifreli ama bu tarayıcıda çözülemiyor. Programı BUTCE-BASLAT.bat ile açın.');
    const tuz = paketTuzu(bytes);
    let tekrar = false;
    for (;;) {
      if (typeof parolaSoran !== 'function') throw sifreHatasi('Veri parolası sorulamadı.');
      const parola = await parolaSoran(tekrar, baglam);
      if (parola == null) throw sifreHatasi('Veri parolası girilmedi.');
      try {
        const anahtar = await anahtarUret(parola, tuz);
        const acik = await cozPaket(bytes, anahtar);
        sifreAnahtar = anahtar;
        sifreTuz = tuz;
        tuzuSakla();
        return acik;
      } catch (e) { tekrar = true; }
    }
  }

  /* Tuz gizli değildir (şifreli dosyanın başlığında düz durur). Saklanır ki
     sıfırlama sonrası aynı parolayla aynı anahtar türetilebilsin. PAROLA
     HİÇBİR YERE YAZILMAZ. */
  function tuzuSakla() { if (sifreTuz) try { localStorage.setItem(SIFRE_TUZ_YEDEK, b64Yaz(sifreTuz)); } catch (e) { } }
  function saklananTuz() {
    try {
      const s = localStorage.getItem(SIFRE_TUZ_YEDEK);
      if (!s) return null;
      const t = b64ToBytes(s);
      return t.length === SIFRE_TUZ_BOY ? t : null;
    } catch (e) { return null; }
  }

  function sifrelemeAcikMi() { return !!sifreAnahtar; }
  function sifrelemeKullanilabilir() { return kriptoVar() && depoKipi === 'sunucu'; }

  /* ŞİFRELEME İŞARETİ — veritabanının DIŞINDA (veri\sifreleme-acik).
     Sıfırlama ya da yeniden kurulum sonrası şifreleme sessizce düşüp veri
     şifresiz yazılmasın diye: işaret sıfırlamadan sağ çıkar; ayrıca
     işaret varken SUNUCU şifresiz veri YAZMAZ (423). */
  async function sifreIsaretiKoy()    { if (depoKipi === 'sunucu') try { await fetch('/sifre-isaret', { method: 'POST' }); } catch (e) { } }
  async function sifreIsaretiKaldir() { if (depoKipi === 'sunucu') try { await fetch('/sifre-isaret', { method: 'DELETE' }); } catch (e) { } }
  async function sifreIsaretiVarMi() {
    if (depoKipi !== 'sunucu') return false;
    try {
      const y = await fetch('/sifre-isaret', { cache: 'no-store' });
      if (!y.ok) return false;
      const s = await y.json();
      return !!(s && s.isaret);
    } catch (e) { return false; }
  }
  async function sifrelemeDustuMu() { return sifreAnahtar ? false : sifreIsaretiVarMi(); }

  /* Yeni parola belirler (anahtar + tuz). Diske yazmaz. */
  async function yeniAnahtar(parola, tuz) {
    sifreTuz = tuz || crypto.getRandomValues(new Uint8Array(SIFRE_TUZ_BOY));
    sifreAnahtar = await anahtarUret(String(parola), sifreTuz);
    tuzuSakla();
  }

  /* KURULUM / TAŞIMA ÖNCESİ PAROLA — dosya diske İLK yazılmadan önce sorulur;
     böylece maaş verisinin şifresiz bir kopyası diskte hiç oluşmaz.
       baglam 'tasima' : tarayıcıdaki veri dosyaya taşınıyor
       baglam 'kurulum': yeni kurulum (dosya da tarayıcı verisi de yok)
       baglam 'surdur' : işaret var (sıfırlama sonrası) — aynı parolayı yeniden gir
     Vazgeçilirse (null) veri şifresiz yazılır — parola ekranında "Şifresiz
     devam" açıkça seçilmiştir; 'surdur' durumunda işaret de kaldırılır,
     yoksa sunucu yazmayı reddederdi. */
  async function yazmadanOnceSifre(baglam) {
    if (sifreAnahtar) return true;
    if (depoKipi !== 'sunucu' || !kriptoVar() || typeof sifreKuranSoran !== 'function') return false;
    let parola = null;
    try { parola = await sifreKuranSoran(baglam); } catch (e) { parola = null; }
    if (!parola) {
      if (await sifreIsaretiVarMi()) await sifreIsaretiKaldir();
      return false;
    }
    await yeniAnahtar(parola, baglam === 'surdur' ? saklananTuz() : null);
    isaretBekliyor = true;    // ilk şifreli yazmadan SONRA işaret konur
    return true;
  }
  let isaretBekliyor = false;

  /* Şifrelemeyi yalnız sistem yöneticisi değiştirebilir — denetim işin
     kendisinde (konsoldan ADB.sifrelemeyiKaldir() yazılsa bile). */
  function sifreYetkisiIste() {
    if (window.API && typeof window.API.yetkiIste === 'function') window.API.yetkiIste('sistem.yonet');
  }

  /* Şifrelemeyi kurar ya da parolayı değiştirir: YENİ tuz, veri hemen
     yeniden yazılır. Eski yedekler eski parolayla açılmaya devam eder. */
  async function sifrelemeyiKur(parola) {
    sifreYetkisiIste();
    if (!kriptoVar()) throw new Error('Şifreleme bu tarayıcıda kullanılamıyor. Programı BUTCE-BASLAT.bat ile açın.');
    if (depoKipi !== 'sunucu') throw new Error('Şifreleme yalnızca veri dosyada tutulurken kullanılabilir.');
    if (!parola || String(parola).length < 8) throw new Error('Veri parolası en az 8 karakter olmalıdır.');
    await yeniAnahtar(parola, null);
    await kaydetHemen(true);
    await sifreIsaretiKoy();
    return true;
  }

  /* Şifrelemeyi kaldırır. ÖNCE işaret silinir (yoksa sunucu düz veriyi
     reddeder), sonra veri düz yazılır. */
  async function sifrelemeyiKaldir() {
    sifreYetkisiIste();
    if (!sifreAnahtar) return true;
    await sifreIsaretiKaldir();
    sifreAnahtar = null;
    sifreTuz = null;
    try { localStorage.removeItem(SIFRE_TUZ_YEDEK); } catch (e) { }
    await kaydetHemen(true);
    return true;
  }

  function parolaSoraniAyarla(fn) { parolaSoran = fn; }
  function sifreKuranSoraniAyarla(fn) { sifreKuranSoran = fn; }

  /* ================================================================
     DEPO KATMANI — veri NEREDE duruyor?
       SUNUCU  : Sunucuyu-Baslat.ps1 veriyi "veri\butce.db" dosyasında tutar.
       TARAYICI: IndexedDB — yalnız sunucu yoksa (index.html çift tıklanarak
                 açıldıysa). Program bu durumda uyarı gösterir.
     ÇAKIŞMA KORUMASI: sunucu her okumada bir SÜRÜM verir; yazarken geri
     gönderilir. Bu arada başkası yazmışsa 409 döner ve kayıt REDDEDİLİR.
     ================================================================ */
  let depoKipi   = 'bilinmiyor';   /* 'sunucu' | 'tarayici' */
  let veriSurumu = null;           /* METİN — 19 basamaklı, sayıya çevrilmez */
  let cakismaBildirildi = false;
  let gocBekliyor = false;

  async function sunucudanOku() {
    const y = await fetch('/veri', { cache: 'no-store' });
    if (y.status === 204) { veriSurumu = y.headers.get('X-Veri-Surum') || '0'; return null; }
    if (!y.ok) throw new Error('Sunucu veri vermedi: ' + y.status);
    veriSurumu = y.headers.get('X-Veri-Surum') || '0';
    return new Uint8Array(await y.arrayBuffer());
  }

  async function sunucuyaYaz(bytes) {
    const basliklar = { 'Content-Type': 'application/octet-stream' };
    if (veriSurumu != null) basliklar['X-Veri-Surum'] = String(veriSurumu);
    const y = await fetch('/veri', { method: 'POST', headers: basliklar, body: bytes });
    if (y.status === 409) {
      if (!cakismaBildirildi) {
        cakismaBildirildi = true;
        dinleyiciler.cakisma.forEach(f => { try { f(); } catch (e) { } });
      }
      const e = new Error('CAKISMA'); e.cakisma = true; throw e;
    }
    if (y.status === 423) throw new Error('Sunucu şifresiz veriyi reddetti: bu kurulumda şifreleme açık. Sayfayı yenileyip veri parolasını girin.');
    if (!y.ok) throw new Error('Sunucuya yazılamadı: ' + y.status);
    const basliktan = y.headers.get('X-Veri-Surum');      // sürüm BAŞLIKTAN (metin)
    if (basliktan) veriSurumu = String(basliktan);
    cakismaBildirildi = false;
    return true;
  }

  async function depoOku() {
    try {
      const b = await sunucudanOku();
      depoKipi = 'sunucu';
      if (b && sifreliMi(b)) return await sifreliDosyayiAc(b, 'acilis');
      /* Dosya yoksa ESKİ tarayıcı verisi varsa o taşınır (tek seferlik göç) */
      if (!b) {
        let eski = await idbOku().catch(() => null);
        if (eski && eski.length) {
          if (sifreliMi(eski)) eski = await sifreliDosyayiAc(eski, 'acilis');
          console.info('Tarayıcıdaki veri dosyaya taşınıyor…');
          gocBekliyor = true;
          return eski;
        }
      }
      return b;
    } catch (e) {
      if (e && e.sifreHatasi) throw e;      // parola hatası sunucu hatası değildir
      depoKipi = 'tarayici';
      const b = await idbOku();
      if (b && sifreliMi(b)) return await sifreliDosyayiAc(b, 'acilis');
      return b;
    }
  }

  /* Şifreleme açıksa diske ŞİFRELİ paket gider. Açık SQLite baytları
     şifreleme açıkken hiçbir zaman ne dosyaya ne tarayıcıya yazılır. */
  async function depoYaz(bytes) {
    const yazilacak = sifreAnahtar ? await paketle(bytes) : bytes;
    if (depoKipi === 'sunucu') {
      await sunucuyaYaz(yazilacak);
      idbYaz(yazilacak).catch(() => { });      // güvenlik ağı — o da şifreli
      return;
    }
    return idbYaz(yazilacak);
  }

  function depoDurumu() { return { kip: depoKipi, surum: veriSurumu, sifreli: !!sifreAnahtar }; }

  /* ---------- Veritabanı dosyasını ikili olarak al ----------
     sql.js export() bağlantıyı yeniden açar; PRAGMA foreign_keys KAPALI
     döner. Her dışa aktarımdan sonra yeniden açılır. */
  function ikiliAl() {
    const bytes = db.export();
    db.run('PRAGMA foreign_keys = ON;');
    return bytes;
  }

  /* ---------- Kalıcılık ----------
     Art arda gelen işlemler 400 ms içinde tek yazmada birleşir. Yazmalar
     SIRAYA alınır: iki kayıt birlikte gitseydi ikincisi birincinin yeni
     sürümünü bilmez ve sahte "çakışma" alırdı. */
  function kaydetGecikmeli() {
    yazmaBekleyen = true;
    clearTimeout(yazmaZamanlayici);
    yazmaZamanlayici = setTimeout(() => { kaydetHemen(); }, 400);
  }

  let yazmaZinciri = Promise.resolve();
  /* zorla: şifreleme kurulurken/kaldırılırken veri değişmemiş olsa da yazılır */
  function kaydetHemen(zorla) {
    if (!db) return Promise.resolve();
    clearTimeout(yazmaZamanlayici);
    const is = () => yazmaIsi(zorla);
    yazmaZinciri = yazmaZinciri.then(is, is);
    return yazmaZinciri;
  }

  async function yazmaIsi(zorla) {
    if (!db) return;
    /* GÖRÜNTÜLEME KİPİ: dosyaya hiç yazılmaz (bkz. js/core/kilit.js) */
    if (!zorla && window.KILIT && typeof KILIT.yazabilirMi === 'function' && !KILIT.yazabilirMi()) {
      yazmaBekleyen = false;
      return;
    }
    try {
      await depoYaz(ikiliAl());
      yazmaBekleyen = false;
      if (isaretBekliyor) { isaretBekliyor = false; await sifreIsaretiKoy(); }
      dinleyiciler.kaydedildi.forEach(f => { try { f(); } catch (e) { } });
    } catch (e) {
      console.error('Veritabanı kaydedilemedi', e);
      dinleyiciler.hata.forEach(f => { try { f(e); } catch (_) { } });
      if (zorla) throw e;
    }
  }

  /* ---------- Sorgu arayüzü ---------- */
  function tumu(sql, parametreler) {
    const stmt = db.prepare(sql);
    try {
      if (parametreler) stmt.bind(parametreler);
      const sonuc = [];
      while (stmt.step()) sonuc.push(stmt.getAsObject());
      return sonuc;
    } finally { stmt.free(); }
  }
  function tek(sql, parametreler) { const r = tumu(sql, parametreler); return r.length ? r[0] : null; }
  function deger(sql, parametreler) {
    const r = tek(sql, parametreler);
    if (!r) return null;
    const k = Object.keys(r);
    return k.length ? r[k[0]] : null;
  }
  function calistir(sql, parametreler) {
    db.run(sql, parametreler || []);
    kaydetGecikmeli();
    return { degisen: db.getRowsModified(), sonId: deger('SELECT last_insert_rowid()') };
  }
  function betik(sql) { db.exec(sql); kaydetGecikmeli(); }

  /* İşlem (transaction). Hata atarsa tüm değişiklikler geri alınır.
     İç içe çağrıda yalnız en dıştaki BEGIN/COMMIT yapar (SQLite iç içe
     BEGIN kabul etmez). */
  let islemDerinlik = 0;
  function islem(fn) {
    if (islemDerinlik > 0) {
      islemDerinlik++;
      try { return fn(); } finally { islemDerinlik--; }
    }
    islemDerinlik = 1;
    db.exec('BEGIN');
    try {
      const sonuc = fn();
      db.exec('COMMIT');
      kaydetGecikmeli();
      return sonuc;
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (_) { }
      throw e;
    } finally { islemDerinlik = 0; }
  }

  /* ---------- Kurulum ---------- */
  async function sqlYukle() {
    if (SQL) return SQL;
    if (!window.initSqlJs) throw new Error('sql.js yüklenemedi (js/vendor/sql-wasm.js).');
    if (!window.IK_SQL_WASM_B64) throw new Error('SQLite ikili dosyası yüklenemedi (js/vendor/sql-wasm-binary.js).');
    SQL = await window.initSqlJs({ wasmBinary: b64ToBytes(window.IK_SQL_WASM_B64) });
    return SQL;
  }

  /* Var olan veritabanını açar; yoksa şemayı kurup başlangıç verisini yükler.
     Dönen değer: { yeniKuruldu, tasindi } */
  async function baslat(seedYukleyici) {
    await sqlYukle();

    const mevcut = await depoOku();
    if (mevcut && mevcut.length) {
      db = new SQL.Database(new Uint8Array(mevcut));
      db.run('PRAGMA foreign_keys = ON;');
      surumKontrol();
      /* Tarayıcıdan gelen veri dosyaya HEMEN yazılır — ama önce parola
         sorulur: dosya diske ilk yazılışından itibaren şifreli olsun. */
      if (gocBekliyor) {
        gocBekliyor = false;
        await yazmadanOnceSifre('tasima');
        await kaydetHemen(true);
        return { yeniKuruldu: false, tasindi: true };
      }
      return { yeniKuruldu: false, tasindi: false };
    }

    /* ŞİFRELEME, VERİTABANI KURULMADAN ÖNCE HAZIRLANIR: tohum yüklerken
       her işlem kaydetGecikmeli() tetikler; anahtar o an yoksa dosya DÜZ
       yazılırdı. */
    if (depoKipi === 'sunucu') {
      await yazmadanOnceSifre((await sifreIsaretiVarMi()) ? 'surdur' : 'kurulum');
    }

    db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON;');
    db.exec(window.SEMA_SQL);
    db.run("INSERT OR REPLACE INTO sistem_bilgi (anahtar, deger) VALUES ('sema_surum', ?)", [String(window.SEMA_SURUM)]);
    if (typeof seedYukleyici === 'function') seedYukleyici();
    await kaydetHemen(true);
    return { yeniKuruldu: true, tasindi: false };
  }

  /* Var olan tablolara sonradan eklenen sütunları tamamlar. */
  function eksikSutunlariEkle() {
    (window.EKSIK_SUTUNLAR || []).forEach(s => {
      let mevcut;
      try { mevcut = tumu(`PRAGMA table_info(${s.tablo})`).map(r => r.name); } catch (e) { return; }
      if (mevcut.indexOf(s.sutun) >= 0) return;
      try {
        db.run(`ALTER TABLE ${s.tablo} ADD COLUMN ${s.sutun} ${s.tanim}`);
        if (s.doldur) db.run(s.doldur);
      } catch (e) { console.error(`${s.tablo}.${s.sutun} sütunu eklenemedi`, e); }
    });
  }

  /* Tablo göçleri (bkz. schema.js → TABLO_GOC). */
  function tabloGocleriUygula() {
    (window.TABLO_GOC || []).forEach(g => {
      let sutunlar = [];
      try { sutunlar = tumu(`PRAGMA table_info(${g.tablo})`).map(r => r.name); } catch (err) { return; }
      if (!sutunlar.length || sutunlar.indexOf(g.gerekliSutun) >= 0) return;
      try {
        db.exec('BEGIN');
        db.run(g.yeni); db.run(g.tasi);
        db.run(`DROP TABLE ${g.tablo}`);
        db.run(`ALTER TABLE ${g.tablo}_yeni RENAME TO ${g.tablo}`);
        db.exec('COMMIT');
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch (e2) { }
        console.error('Tablo göçü başarısız: ' + g.tablo, err);
      }
    });
  }

  function surumKontrol() {
    let surum = 0;
    try { surum = Number(deger("SELECT deger FROM sistem_bilgi WHERE anahtar='sema_surum'")) || 0; } catch (e) { surum = 0; }
    if (surum < window.SEMA_SURUM) {
      /* ÖNCE eksik sütunlar, SONRA şema (yeni sütuna dayanan indeks olabilir) */
      eksikSutunlariEkle();
      tabloGocleriUygula();
      db.exec(window.SEMA_SQL);
      eksikSutunlariEkle();
      if (typeof window.TEMEL_VERI_YAZ === 'function') {
        try { window.TEMEL_VERI_YAZ((sql, p) => db.run(sql, p || [])); } catch (e) { console.error('Temel veri güncellenemedi', e); }
      }
      /* Veri göçleri: yalnız eski sürümden gelende; hata verirse sürüm yükseltilmez */
      const goc = (window.VERI_GOCLERI || []).filter(g => g.surum > surum && g.surum <= window.SEMA_SURUM);
      for (const g of goc) {
        try {
          db.exec('BEGIN');
          g.calistir((sql, p) => db.run(sql, p || []), (sql, p) => tumu(sql, p));
          db.exec('COMMIT');
          console.info('Veri göçü uygulandı:', g.ad);
        } catch (e) {
          try { db.exec('ROLLBACK'); } catch (_) { }
          console.error('Veri göçü başarısız: ' + g.ad, e);
          return;
        }
      }
      db.run("INSERT OR REPLACE INTO sistem_bilgi (anahtar, deger) VALUES ('sema_surum', ?)", [String(window.SEMA_SURUM)]);
      kaydetGecikmeli();
    }
  }

  /* ---------- Yedekleme — YEDEKLER DE ŞİFRELENİR ---------- */
  function disaAktarBytes() { return ikiliAl(); }
  async function yedekBaytlari() { const b = ikiliAl(); return sifreAnahtar ? await paketle(b) : b; }

  function dosyaAdiUret() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `maas-butce-yedek-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.db`;
  }
  function sonYedekYaz(yol) {
    try {
      db.run(`INSERT OR REPLACE INTO sistem_bilgi (anahtar, deger) VALUES ('son_yedek', ?)`, [new Date().toISOString()]);
      if (yol) db.run(`INSERT OR REPLACE INTO sistem_bilgi (anahtar, deger) VALUES ('son_yedek_yol', ?)`, [yol]);
      kaydetGecikmeli();
    } catch (e) { }
  }

  async function yedekIndir() {
    const blob = new Blob([await yedekBaytlari()], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = dosyaAdiUret();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    sonYedekYaz(null);
  }

  /* Yedeği "yedek-elle" klasörüne yazar (sunucu aynı makinede çalışır). */
  async function yedekSunucuyaKaydet() {
    if (location.protocol === 'file:') throw new Error('Bu özellik sunucu üzerinden çalışırken kullanılabilir (BUTCE-BASLAT.bat).');
    const yanit = await fetch('/yedek-kaydet', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: await yedekBaytlari() });
    let s = null;
    try { s = await yanit.json(); } catch (e) { }
    if (!yanit.ok || !s || !s.basarili) throw new Error((s && s.mesaj) || ('Sunucu yanıtı: ' + yanit.status));
    sonYedekYaz(s.klasor + '\\' + s.dosya);
    return s;
  }

  async function yedekListesi() {
    if (location.protocol === 'file:') return { basarili: false, yedekler: [] };
    const yanit = await fetch('/yedek-listesi');
    if (!yanit.ok) return { basarili: false, yedekler: [] };
    return await yanit.json();
  }

  function yedekDurumu() {
    let son = '';
    try { son = deger(`SELECT deger FROM sistem_bilgi WHERE anahtar='son_yedek'`) || ''; } catch (e) { son = ''; }
    if (!son) return { alinmis: false, gun: null, tarih: '' };
    return { alinmis: true, gun: Math.floor((Date.now() - new Date(son).getTime()) / 86400000), tarih: son };
  }

  /* Yedekten geri yükler. Yedek şifreliyse önce bellekteki anahtar denenir;
     tutmazsa (eski parola) kullanıcıya sorulur. */
  /* Kim geri yükleyebilir:
     · oturum açıksa yalnız sistem yöneticisi (sistem.yonet);
     · giriş ekranından ("Giriş yapamıyorum") yalnız veri şifreliyken ve yalnız aynı veri parolasıyla şifrelenmiş
       yedek — veri parolasını bilmeyen biri kendi hazırladığı bir veritabanını yükleyip yönetici olamaz. */
  async function yedektenYukle(arrayBuffer) {
    let bytes = new Uint8Array(arrayBuffer);
    const oturum = window.API && typeof API.kullanici === 'function' ? API.kullanici() : null;
    if (oturum) { if (!API.yetkiVar('sistem.yonet')) throw new Error('Yedekten geri yükleme için sistem yöneticisi yetkisi gerekir.'); }
    else {
      if (!sifreAnahtar) throw new Error('Veri şifrelenmediği için giriş ekranından geri yükleme yapılamaz. ' +
                                        'Sistem yöneticisi olarak giriş yapıp Sistem ekranından geri yükleyin.');
      if (!sifreliMi(bytes)) throw new Error('Giriş ekranından yalnız şifreli yedek (veri parolasıyla) geri yüklenebilir.');
    }
    if (sifreliMi(bytes)) {
      const tuz = paketTuzu(bytes);
      let cozuldu = null;
      if (sifreAnahtar && sifreTuz && b64Yaz(tuz) === b64Yaz(sifreTuz)) {
        try { cozuldu = await cozPaket(bytes, sifreAnahtar); } catch (e) { cozuldu = null; }
      }
      if (!cozuldu) {
        if (typeof parolaSoran !== 'function') throw new Error('Bu yedek şifreli; veri parolası sorulamadı.');
        let tekrar = false;
        for (;;) {
          const parola = await parolaSoran(tekrar, 'yedek');
          if (parola == null) throw new Error('Şifreli yedek açılmadı.');
          try { cozuldu = await cozPaket(bytes, await anahtarUret(parola, tuz)); break; } catch (e) { tekrar = true; }
        }
      }
      bytes = cozuldu;
    }
    const imza = String.fromCharCode.apply(null, bytes.subarray(0, 15));
    if (imza !== 'SQLite format 3') throw new Error('Bu dosya bir SQLite veritabanı değil.');
    const yeni = new SQL.Database(bytes);
    const t = yeni.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='personel'");
    if (!t.length) { yeni.close(); throw new Error('Dosyada personel tablosu bulunamadı; bu bir Ücret Hesaplama yedeği değil.'); }
    try { yikiciIslemOncesi(); await oncesiYedek(); } catch (e) { yeni.close(); throw e; }
    if (db) db.close();
    db = yeni;
    db.run('PRAGMA foreign_keys = ON;');
    surumKontrol();
    await kaydetHemen(true);
  }

  /* YIKICI İŞLEM GÜVENCELERİ
     Sıfırlama ve yedekten geri yükleme elle girilmiş her şeyi silebilir.
     Şema değişiklikleri açılışta sürüm denetimiyle (surumKontrol) uygulandığı
     için olağan kullanımda sıfırlama gerekmez; yine de yapılırsa:
       · görüntüleme kipinde (yazma kilidi başkasındaysa) yapılamaz,
       · başlamadan önce mevcut hâl yedeklenir; yedek ALINAMAZSA işlem YAPILMAZ. */
  function yikiciIslemOncesi() {
    if (window.KILIT && typeof KILIT.yazabilirMi === 'function' && !KILIT.yazabilirMi()) throw new Error(KILIT.engelMesaji());
  }
  async function oncesiYedek() {
    if (!db) return null;
    try {
      if (depoKipi === 'sunucu') return await yedekSunucuyaKaydet();
      await yedekIndir();
      return { dosya: 'indirilenler' };
    } catch (e) {
      throw new Error('Mevcut verinin yedeği alınamadığı için işlem yapılmadı: ' + e.message);
    }
  }

  /* Veritabanını tamamen siler. YALNIZ sistem yöneticisi; önce otomatik yedek.
     Dosyadaysa DOSYA da silinir (sunucu ayrıca "sifirlama-oncesi" kopyası
     bırakır). Şifreleme işareti SİLİNMEZ: yeniden kurulumda parola yeniden
     sorulur, dosya şifresiz oluşmaz. */
  async function sifirla() {
    sifreYetkisiIste();
    yikiciIslemOncesi();
    const y = await oncesiYedek();
    if (db) { db.close(); db = null; }
    if (depoKipi === 'sunucu') {
      try { await fetch('/veri', { method: 'DELETE' }); veriSurumu = null; } catch (e) { console.error('Veri dosyası silinemedi', e); }
    }
    sifreAnahtar = null;
    await idbSil();
    return y;
  }

  /* ---------- Bilgi ---------- */
  function istatistik() {
    const say = t => { try { return deger(`SELECT COUNT(*) FROM ${t}`) || 0; } catch (e) { return 0; } };
    return {
      personel: say('personel'), calisma: say('calisma'), aylik: say('aylik_girdi'),
      parametre: say('parametre'), kullanici: say('kullanici'),
      boyutKB: db ? Math.round(ikiliAl().length / 1024) : 0,
    };
  }
  function fkAcikMi() { return Number(deger('PRAGMA foreign_keys')) === 1; }
  function acikMi() { return !!db; }
  function bekleyenYazmaVar() { return yazmaBekleyen; }
  function dinle(olay, fn) { if (dinleyiciler[olay]) dinleyiciler[olay].push(fn); }

  /* ---------- Sekme kapanırken bekleyen yazma ----------
     Sekme gizlenince (başka sekmeye geçme, pencere kapanmaya başlama)
     bekleyen yazma HEMEN gönderilir; çoğu durumda kapanmadan tamamlanır.

     ŞİFRELEME AÇIKKEN düz veri GÖNDERİLMEZ. Şifreleme eşzamansızdır,
     beforeunload içinde yapılamaz; sendBeacon ile ham bayt göndermek
     şifreli kurulumda dosyaya ŞİFRESİZ veri yazabilirdi. Bu yüzden o
     durumda tarayıcının "sayfadan ayrıl?" sorusu çıkarılır ve kayıt arka
     planda tamamlanır. Sunucu da düz veriyi reddeder (423). Şifresiz
     kurulumda son hâl sendBeacon ile gönderilir. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && db && yazmaBekleyen) kaydetHemen();
  });
  window.addEventListener('beforeunload', e => {
    if (!db || !yazmaBekleyen) return;
    if (sifreAnahtar) {
      kaydetHemen();
      e.preventDefault();
      e.returnValue = '';
      return;
    }
    try {
      const bytes = ikiliAl();
      if (depoKipi === 'sunucu' && navigator.sendBeacon) {
        const adres = '/veri' + (veriSurumu != null ? '?surum=' + encodeURIComponent(veriSurumu) : '');
        navigator.sendBeacon(adres, new Blob([bytes], { type: 'application/octet-stream' }));
      }
      const istek = indexedDB.open(IDB_ADI, 1);
      istek.onsuccess = () => {
        const d = istek.result;
        if (!d.objectStoreNames.contains(IDB_STORE)) return;
        d.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(bytes, IDB_ANAHTAR);
      };
    } catch (err) { }
  });

  return {
    baslat, tumu, tek, deger, calistir, betik, islem,
    kaydetHemen, yedekIndir, yedekSunucuyaKaydet, yedekListesi, yedekDurumu,
    yedektenYukle, disaAktarBytes, sifirla,
    istatistik, acikMi, bekleyenYazmaVar, dinle, fkAcikMi, depoDurumu,
    sifrelemeAcikMi, sifrelemeKullanilabilir, sifrelemeyiKur, sifrelemeyiKaldir, sifrelemeDustuMu,
    parolaSoraniAyarla, sifreKuranSoraniAyarla,
  };
})();
