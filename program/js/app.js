/* =====================================================================
   UYGULAMA KABUĞU — açılış, giriş, menü, yönlendirme

   Modüller kendilerini APP.modulKaydet ile tanıtır:
     { id, ad, ikon, grup, baslik, altBaslik, yetki, ciz(kap, param) }
   ===================================================================== */
window.APP = (function () {
  'use strict';

  const MODULLER = [];
  let aktifModul = null;
  let aktifCalisma = null;      // seçili bütçe çalışmasının id'si (yıl × grup)

  function modulKaydet(m) { MODULLER.push(m); }

  /* ---------------- Veri parolası ekranı ----------------
     Veri dosyası şifreliyse program açılmadan ÖNCE sorulur; parola olmadan
     veritabanı çözülemez, giriş ekranı bile çizilemez. Bu, sisteme giriş
     parolası DEĞİLDİR — metin bunu açıkça söyler. */
  function veriParolasiSor(tekrarMi, baglam) {
    return new Promise(resolve => {
      const perde = U.el('perde');
      perde.classList.remove('gizli');
      const yedekMi = baglam === 'yedek';
      perde.innerHTML = `
        <div class="perde-kart" style="max-width:460px; text-align:left;">
          <div style="text-align:center">
            <div class="logo">🔒</div>
            <div class="marka">${yedekMi ? 'Şifreli Yedek' : 'Veri Parolası'}</div>
            <div class="alt">${yedekMi ? 'Yedeği açmak için parola gerekli' : 'Maaş verileri şifreli saklanıyor'}</div>
          </div>
          <p class="aciklama" style="margin-top:14px">${yedekMi
            ? 'Bu yedek alındığı tarihteki <strong>veri parolasını</strong> girin.'
            : 'Bu, sisteme giriş parolanız <strong>değildir</strong>. Veri dosyasını açan parolayı girin — ' +
              'dosyayı kopyalayan biri bu parola olmadan içindekileri okuyamaz.'}</p>
          <label>Veri parolası <input type="password" id="vpParola" autocomplete="off"></label>
          <div class="perde-hata" id="vpHata">${tekrarMi ? 'Parola yanlış. Tekrar deneyin.' : ''}</div>
          <button class="btn" id="vpBtn" style="width:100%; justify-content:center;">Aç</button>
        </div>`;
      const alan = U.el('vpParola');
      const gonder = () => {
        if (!alan.value) { U.el('vpHata').textContent = 'Parola girilmedi.'; return; }
        const p = alan.value;
        perde.innerHTML = '<div class="perde-kart"><div class="logo">🔓</div><div class="marka">Açılıyor…</div></div>';
        resolve(p);
      };
      U.el('vpBtn').onclick = gonder;
      alan.onkeydown = e => { if (e.key === 'Enter') gonder(); };
      setTimeout(() => alan.focus(), 50);
    });
  }

  /* ---------------- Yeni veri parolası (iki kez) ----------------
     Dosya diske İLK yazılmadan önce sorulur; maaş verisinin şifresiz kopyası
     hiç oluşmaz.
       tasima : tarayıcıdaki veri dosyaya taşınıyor (bu sürüme ilk geçiş)
       kurulum: yeni kurulum
       surdur : şifreleme açıktı, veritabanı yeniden kuruluyor (sıfırlama)
     İki kez sorulur: kıyaslanacak eski dosya yok, yanlış yazılan parola
     sessizce "yeni parola" olurdu. */
  function veriParolasiKurSor(baglam) {
    return new Promise(resolve => {
      const perde = U.el('perde');
      perde.classList.remove('gizli');
      const metin = {
        tasima: ['Verileriniz Dosyaya Taşınıyor', 'Tarayıcıdan bağımsız, şifreli depolama',
          'Kayıtlarınız artık tarayıcıda değil, program klasörünün yanındaki <b>veri</b> klasöründe ' +
          'duracak. Dosya diske yazılmadan önce bir <b>veri parolası</b> belirleyin: dosyayı kopyalayan biri ' +
          'bu parola olmadan maaşları okuyamaz.'],
        kurulum: ['Veri Parolası Belirleyin', 'Yeni kurulum',
          'Veri dosyası diske yazılmadan önce bir <b>veri parolası</b> belirleyin: dosyayı kopyalayan biri ' +
          'bu parola olmadan içindekileri okuyamaz.'],
        surdur: ['Veri Parolası Gerekli', 'Veritabanı yeniden kuruluyor',
          'Bu kurulumda veri şifrelemesi <b>açık</b>. Parola yalnızca bellekte tutulur ve sıfırlamada kaybolur; ' +
          'yeni dosyanın da şifreli yazılması için parolayı <b>yeniden girin</b> — eskisinin aynısını.'],
      }[baglam] || ['Veri Parolası', '', ''];
      perde.innerHTML = `
        <div class="perde-kart" style="max-width:520px; text-align:left;">
          <div style="text-align:center">
            <div class="logo">🔒</div>
            <div class="marka">${metin[0]}</div>
            <div class="alt">${metin[1]}</div>
          </div>
          <p class="aciklama" style="margin-top:14px">${metin[2]}</p>
          <div class="uyari uyari-hata" style="text-align:left"><span class="ik">🔑</span>
            <div>Bu parola sisteme giriş parolanızdan <b>ayrıdır</b>. <b>Kaybederseniz veriye kimse ulaşamaz</b> —
              arka kapı yoktur. Kilitli bir yerde yazılı saklayın.</div></div>
          <label>Veri parolası (en az 8 karakter) <input type="password" id="vkParola" autocomplete="new-password"></label>
          <label>Veri parolası (tekrar) <input type="password" id="vkParola2" autocomplete="new-password"></label>
          <div class="perde-hata" id="vkHata"></div>
          <div style="display:flex; gap:10px; margin-top:14px">
            <button class="btn btn-ikincil" id="vkGec" style="flex:1; justify-content:center;">Şifresiz devam et</button>
            <button class="btn" id="vkBtn" style="flex:1.4; justify-content:center;">🔒 Şifreli Kaydet</button>
          </div>
        </div>`;
      const a1 = U.el('vkParola'), a2 = U.el('vkParola2'), hata = U.el('vkHata');
      const gonder = () => {
        const p = a1.value;
        if (p.length < 8) { hata.textContent = 'Parola en az 8 karakter olmalıdır.'; return; }
        if (p !== a2.value) { hata.textContent = 'İki parola aynı değil.'; return; }
        perde.innerHTML = '<div class="perde-kart"><div class="logo">🔒</div><div class="marka">Şifreleniyor…</div></div>';
        resolve(p);
      };
      U.el('vkBtn').onclick = gonder;
      [a1, a2].forEach(a => { a.onkeydown = e => { if (e.key === 'Enter') gonder(); }; });
      /* Vazgeçmek mümkün olmalı (parolayı o an belirleyemeyen programsız
         kalmasın) — ama önce açıkça uyarılır. Onay perdenin İÇİNDE sorulur:
         uygulama kabuğu henüz kurulmadı. */
      U.el('vkGec').onclick = () => {
        perde.innerHTML = `
          <div class="perde-kart" style="max-width:500px; text-align:left;">
            <div style="text-align:center"><div class="logo">🔓</div><div class="marka">Şifresiz devam edilsin mi?</div></div>
            <div class="uyari uyari-hata" style="text-align:left; margin-top:14px"><span class="ik">⚠</span>
              <div>Veri dosyası <b>ŞİFRESİZ</b> yazılacak. Dosyayı kopyalayan herkes bütün maaşları okuyabilir.</div></div>
            <p class="aciklama">Daha sonra <b>Sistem → Veri Deposu</b> üzerinden şifrelemeyi kurabilirsiniz.</p>
            <div style="display:flex; gap:10px; margin-top:14px">
              <button class="btn" id="vkGeri" style="flex:1.4; justify-content:center;">← Parola belirleyeyim</button>
              <button class="btn btn-tehlike" id="vkGecOnay" style="flex:1; justify-content:center;">Şifresiz devam</button>
            </div>
          </div>`;
        U.el('vkGeri').onclick = () => resolve(veriParolasiKurSor(baglam));
        U.el('vkGecOnay').onclick = () => {
          perde.innerHTML = '<div class="perde-kart"><div class="logo">🔓</div><div class="marka">Kaydediliyor…</div></div>';
          resolve(null);
        };
      };
      setTimeout(() => a1.focus(), 50);
    });
  }

  /* ---------------- Açılış ---------------- */
  async function baslat() {
    const perdeYazi = U.el('perdeYazi');
    try {
      ADB.parolaSoraniAyarla(veriParolasiSor);
      ADB.sifreKuranSoraniAyarla(veriParolasiKurSor);
      perdeYazi.textContent = 'SQLite motoru yükleniyor…';
      const sonuc = await ADB.baslat(() => {
        const y = U.el('perdeYazi');
        if (y) y.textContent = 'Veriler aktarılıyor…';
        API.seedYukle();
      });

      if (sonuc.yeniKuruldu) {
        console.log('Veritabanı oluşturuldu:', ADB.istatistik());
      }
      if (sonuc.tasindi) {
        setTimeout(() => U.bildir('Verileriniz tarayıcıdan veri dosyasına taşındı' +
          (ADB.sifrelemeAcikMi() ? ' ve şifrelendi.' : '.'), 'basari'), 1200);
      }

      // Yabancı anahtar zorlaması kapalıysa T.C. düzeltmeleri bağlı
      // kayıtları takip etmez; sessizce yetim kayıt oluşur. Erken uyar.
      if (!ADB.fkAcikMi()) {
        console.error('PRAGMA foreign_keys kapalı — ilişkisel bütünlük korunmuyor.');
        setTimeout(() => U.bildir(
          'Uyarı: veritabanı bütünlük denetimi etkinleştirilemedi.', 'hata'), 1500);
      }

      ADB.dinle('kaydedildi', kayitDurumGuncelle);
      ADB.dinle('hata', e => {
        if (e && e.cakisma) return;      // çakışma perdesi ayrıca açılır
        U.bildir('Veri dosyaya kaydedilemedi! ' + ((e && e.message) || '') +
                 ' — siyah sunucu penceresinin açık olduğunu kontrol edin.', 'hata');
      });
      /* ÇAKIŞMA: siz sayfayı açtıktan sonra başka biri (ya da başka bir
         sekme) kayıt yaptı. Sizin değişikliğiniz YAZILMADI — yazılsaydı
         onunki silinirdi. Fark edilmeden çalışmaya devam edilmesin diye
         kapatılamayan bir perdedir. */
      ADB.dinle('cakisma', cakismaPerdesi);

      /* Kilit giriş ekranından ÖNCE alınır: girisYap son giriş tarihini
         yazıyor; görüntüleme kipindeki kullanıcının bu yazması dosyaya
         gitmeye çalışırsa sahte "çakışma" perdesi açılırdı. */
      KILIT.dinle(kilitDurumuDegisti);
      await KILIT.baslat();

      /* Hareketsizlik sayacı veri açıldığı anda başlar — giriş ekranında
         beklenirken de (anahtar bellekte) süre işler. */
      zamanAsimiBaslat();

      if (!API.kullaniciVarMi()) ilkKurulumEkrani();
      else girisEkrani();

    } catch (e) {
      console.error(e);
      U.el('perde').innerHTML = `
        <div class="perde-kart">
          <div class="logo">⚠</div>
          <div class="marka">Sistem başlatılamadı</div>
          <div class="alt">Hata</div>
          <p class="aciklama">${U.esc(e.message || String(e))}</p>
          <div class="uyari uyari-dikkat" style="text-align:left">
            <span class="ik">💡</span>
            <div>Dosyaların eksiksiz kopyalandığından emin olun. Sorun sürerse
                 tarayıcıyı kapatıp yeniden açın.</div>
          </div>
        </div>`;
    }
  }

  /* ---------------- İlk kurulum (yönetici hesabı) ---------------- */
  function ilkKurulumEkrani() {
    const perde = U.el('perde');
    perde.innerHTML = `
      <div class="perde-kart" style="max-width:440px; text-align:left;">
        <div style="text-align:center">
          <div class="logo">🔐</div>
          <div class="marka">İlk Kurulum</div>
          <div class="alt">Yönetici hesabı oluşturun</div>
        </div>
        <p class="aciklama">Sisteme girişte kullanacağınız yönetici hesabını
           şimdi oluşturun. Parola yalnızca bu bilgisayarda, geri döndürülemez
           biçimde saklanır — kaybederseniz geri alınamaz.</p>
        <div class="alan">
          <label>Ad Soyad <span class="zorunlu">*</span></label>
          <input id="kurAd" placeholder="Örn. Ayşe Yılmaz">
        </div>
        <div class="alan">
          <label>Kullanıcı Adı <span class="zorunlu">*</span>
            <span class="ipucu">— girişte yazacağınız ad</span></label>
          <input id="kurKullanici" placeholder="ayse" autocomplete="off">
        </div>
        <div class="alan">
          <label>Parola <span class="zorunlu">*</span>
            <span class="ipucu">— en az 6 karakter</span></label>
          <input id="kurParola" type="password" autocomplete="new-password">
        </div>
        <div class="alan">
          <label>Parola (tekrar) <span class="zorunlu">*</span></label>
          <input id="kurParola2" type="password" autocomplete="new-password">
        </div>
        <div class="alan">
          <label>Başlangıç</label>
          <label class="secenek"><input type="radio" name="kurBaslangic" value="ornek" checked>
            <span><strong>Örnek veriyle başla</strong><span class="ipucu">Uydurma iki grup ve personel; programı denemek için.</span></span></label>
          <label class="secenek"><input type="radio" name="kurBaslangic" value="bos">
            <span><strong>Boş başla</strong><span class="ipucu">Yalnız yasal parametreler ve bir "Genel" grubu.</span></span></label>
          <div class="ipucu">Örnek veriden gerçek kullanıma geçerken Sistem → Veritabanını Sıfırla ile baştan başlayın.</div>
        </div>
        <button class="btn" id="kurBtn" style="width:100%; justify-content:center;">Hesabı Oluştur ve Başla</button>
        <div class="perde-hata" id="kurHata"></div>
      </div>`;

    const hata = U.el('kurHata');
    function olustur() {
      hata.textContent = '';
      const ad = U.el('kurAd').value.trim();
      const ka = U.el('kurKullanici').value.trim();
      const p1 = U.el('kurParola').value;
      const p2 = U.el('kurParola2').value;
      if (!ad) return hata.textContent = 'Ad Soyad giriniz.';
      if (p1 !== p2) return hata.textContent = 'Parolalar birbirini tutmuyor.';
      U.el('kurBtn').disabled = true;
      U.el('kurBtn').textContent = 'Oluşturuluyor…';
      setTimeout(() => {
        try {
          API.kullaniciEkle(ka, ad, p1, true);
          const g = API.girisYap(ka, p1);
          if (g.basarili) {
            KILIT.dene();
            const ornek = (perde.querySelector('input[name="kurBaslangic"]:checked') || {}).value === 'ornek';
            try { if (ornek) API.ornekVeriYukle(); else API.varsayilanGrupAc(); }
            catch (e) { console.error(e); setTimeout(() => U.bildir('Başlangıç verisi yüklenemedi: ' + e.message, 'hata'), 800); }
            ADB.kaydetHemen(); uygulamayiAc();
          }
          else hata.textContent = g.mesaj;
        } catch (e) {
          hata.textContent = e.message;
          U.el('kurBtn').disabled = false;
          U.el('kurBtn').textContent = 'Hesabı Oluştur ve Başla';
        }
      }, 30);
    }
    U.el('kurBtn').onclick = olustur;
    perde.querySelectorAll('input').forEach(i =>
      i.addEventListener('keydown', e => { if (e.key === 'Enter') olustur(); }));
    U.el('kurAd').focus();
  }

  /* ---------------- Giriş ---------------- */
  function girisEkrani() {
    const perde = U.el('perde');
    perde.classList.remove('gizli');
    perde.innerHTML = `
      <div class="perde-kart">
        <div class="logo">🔒</div>
        <div class="marka">Maaş Bütçe Sistemi</div>
        <div class="alt">Bütçe · Zam · Maliyet</div>
        <div class="alan">
          <label>Kullanıcı Adı</label>
          <input id="grKullanici" autocomplete="username">
        </div>
        <div class="alan">
          <label>Parola</label>
          <input id="grParola" type="password" autocomplete="current-password">
        </div>
        <button class="btn" id="grBtn" style="width:100%; justify-content:center;">Giriş Yap</button>
        <div class="perde-hata" id="grHata"></div>

        <!-- Yedekten geri yükleme Sistem ekranındadır ve giriş gerektirir.
             Giriş yapılamadığında yedek işe yaramaz hâle geliyordu; bu
             bölüm o çıkmazı açar. -->
        <div style="margin-top:18px; padding-top:14px; border-top:1px solid var(--line);">
          <button class="btn btn-ikincil" id="grKurtarBtn"
                  style="width:100%; justify-content:center;">Giriş yapamıyorum</button>
          <div id="grKurtar" class="gizli" style="margin-top:12px; text-align:left;">
            <div class="kucuk soluk" style="margin-bottom:10px;">
              Kayıtlı kullanıcı adları aşağıda listelenir. Parola görüntülenemez —
              saklanmaz, yalnızca doğrulanabilir biçimde tutulur.
            </div>
            <div id="grKullaniciListe" class="kucuk"
                 style="margin-bottom:12px; font-weight:600;"></div>

            <div class="alan">
              <label>Yedek dosyasından geri yükle (.db)</label>
              <input type="file" id="grYedekDosya" accept=".db,.sqlite,.sqlite3">
            </div>
            <button class="btn btn-ikincil" id="grYedekBtn"
                    style="width:100%; justify-content:center; margin-bottom:10px;">
              Yedeği Geri Yükle</button>

            <!-- "Veritabanını Sıfırla" bu ekranda yoktur: giriş yapmadan bütün
                 kayıtlar silinebilirdi. Sıfırlama yalnızca Sistem ekranında,
                 sistem yöneticisine açıktır. Geri yüklemeden önce mevcut hâl
                 otomatik yedeklenir. -->
            <div class="kucuk soluk" style="margin:6px 0 0;">Geri yüklemeden önce mevcut veri otomatik olarak
              <strong>yedek-elle</strong> klasörüne yedeklenir.</div>
            <div class="perde-hata" id="grKurtarHata"></div>
          </div>
        </div>
      </div>`;

    const hata = U.el('grHata');

    U.el('grKurtarBtn').onclick = () => {
      const k = U.el('grKurtar');
      const acik = !k.classList.contains('gizli');
      k.classList.toggle('gizli', acik);
      if (acik) return;
      let liste = 'Kayıtlı kullanıcı bulunamadı — sıfırlama sonrası kurulum ekranı gelir.';
      try {
        const kl = ADB.tumu(
          `SELECT kullanici_adi, yonetici, aktif FROM kullanici ORDER BY kullanici_adi`);
        if (kl.length) {
          liste = kl.map(x => x.kullanici_adi + ' (' + (x.yonetici ? 'yönetici' : 'kullanıcı') +
                              (x.aktif ? '' : ', devre dışı') + ')').join(' · ');
        }
      } catch (e) { liste = 'Kullanıcı listesi okunamadı: ' + e.message; }
      U.el('grKullaniciListe').textContent = liste;
    };

    U.el('grYedekBtn').onclick = async () => {
      const kh = U.el('grKurtarHata');
      kh.textContent = '';
      const dosya = U.el('grYedekDosya').files[0];
      if (!dosya) { kh.textContent = 'Önce bir yedek dosyası seçin.'; return; }
      if (!window.confirm('Seçilen yedek geri yüklenecek; şu anki veri onunla değiştirilir.\n\n' +
            'Önce şu anki hâl otomatik olarak yedek-elle klasörüne yedeklenecek.\n\nDevam edilsin mi?')) return;
      const btn = U.el('grYedekBtn');
      btn.disabled = true; btn.textContent = 'Geri yükleniyor…';
      try {
        await ADB.yedektenYukle(await dosya.arrayBuffer());
        location.reload();
      } catch (e) {
        kh.textContent = 'Yedek geri yüklenemedi: ' + e.message;
        btn.disabled = false; btn.textContent = 'Yedeği Geri Yükle';
      }
    };

    function giris() {
      hata.textContent = '';
      const btn = U.el('grBtn');
      btn.disabled = true; btn.textContent = 'Kontrol ediliyor…';
      // Parola doğrulaması yoğun işlem içerir; arayüzün donmaması için ertelenir
      setTimeout(() => {
        const g = API.girisYap(U.el('grKullanici').value, U.el('grParola').value);
        if (g.basarili) { KILIT.dene(); uygulamayiAc(); }
        else {
          hata.textContent = g.mesaj;
          btn.disabled = false; btn.textContent = 'Giriş Yap';
          U.el('grParola').value = '';
          U.el('grParola').focus();
        }
      }, 30);
    }
    U.el('grBtn').onclick = giris;
    perde.querySelectorAll('input').forEach(i =>
      i.addEventListener('keydown', e => { if (e.key === 'Enter') giris(); }));
    U.el('grKullanici').focus();
  }

  /* ---------------- Kabuk ---------------- */
  function uygulamayiAc() {
    U.el('perde').classList.add('gizli');
    U.el('uygulama').classList.remove('gizli');
    secimYukle();
    menuCiz();
    kenarAltCiz();
    calismaSeciciCiz();
    kilitSeridiCiz(KILIT.durumBilgisi());
    git('ozet');
    depoUyarisi();
    sifrelemeDustuKontrol();
  }

  /* ---------------- Yazma kilidi şeridi ---------------- */
  function kilitSeridiCiz(bilgi) {
    const s = U.el('kilitSerit');
    if (!s) return;
    if (!KILIT.kullanilabilir() || bilgi.yazar) { s.className = 'kilit-serit gizli'; s.innerHTML = ''; return; }
    const sahip = bilgi.sahip || {};
    const ad = U.esc(sahip.adSoyad || sahip.kullanici || 'Başka bir kullanıcı');
    let saat = '';
    if (sahip.alindi) {
      const d = new Date(sahip.alindi);
      if (!isNaN(d)) saat = ' (' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' itibarıyla)';
    }
    const kendim = KILIT.kendiHesabimMi();
    s.className = 'kilit-serit';
    s.innerHTML = `<span class="ik">👁</span>
      <div class="metin">${kendim
        ? `<b>Yalnızca görüntüleme.</b> Program <b>başka bir sekmede</b> açık${U.esc(saat)} ve kayıt yetkisi orada.
           Diğer sekmeyi kapatıp bu sayfayı yenileyin; yetki buraya geçer.`
        : `<b>Yalnızca görüntüleme.</b> ${ad}${U.esc(saat)} kayıt yapıyor. Her şeyi görebilir, Excel alabilirsiniz;
           kayıt yapamazsınız. O kişi programı kapattığında devralırsınız.`}</div>
      <button class="btn btn-ikincil btn-kucuk" id="kilitYokla">↻ Şimdi kontrol et</button>`;
    U.el('kilitYokla').onclick = async () => {
      await KILIT.dene();
      if (!KILIT.yazabilirMi()) U.bildir(KILIT.kendiHesabimMi() ? 'Program hâlâ başka bir sekmede açık.' : 'Hâlâ başka bir kullanıcı kayıt yapıyor.', 'uyari');
    };
  }
  let oncekiKilitDurumu = null;
  function kilitDurumuDegisti(bilgi) {
    kilitSeridiCiz(bilgi);
    if (oncekiKilitDurumu === 'okur' && bilgi.durum === 'yazar' && aktifModul) {
      U.bildir('Yazma yetkisi size geçti — artık kayıt yapabilirsiniz.', 'basari');
      tazele();
    }
    oncekiKilitDurumu = bilgi.durum;
  }

  /* ---------------- Çakışma perdesi ---------------- */
  function cakismaPerdesi() {
    if (U.el('cakismaPerde')) return;
    const p = document.createElement('div');
    p.className = 'perde';
    p.id = 'cakismaPerde';
    p.innerHTML = `
      <div class="perde-kart" style="max-width:520px; text-align:left;">
        <div style="text-align:center"><div class="logo">⚠</div><div class="marka">Kaydınız yazılmadı</div>
          <div class="alt">Veri dosyası siz açtıktan sonra değişti</div></div>
        <p class="aciklama" style="margin-top:14px">Siz sayfayı açtıktan sonra <b>başka biri ya da başka bir sekme</b>
          kayıt yaptı. Sizin son değişikliğiniz, onunkini silmemek için dosyaya <b>yazılmadı</b>.</p>
        <div class="uyari uyari-bilgi" style="text-align:left"><span class="ik">💡</span>
          <div>Önce <b>Yedek Al</b> ile ekrandaki hâli indirin (gerekirse oradan geri alınabilir), sonra
            <b>Sayfayı Yenile</b> deyip güncel veriden devam edin.</div></div>
        <div style="display:flex; gap:10px; margin-top:16px">
          <button class="btn btn-ikincil" id="cakismaYedek" style="flex:1; justify-content:center;">⤓ Yedek Al</button>
          <button class="btn" id="cakismaYenile" style="flex:1; justify-content:center;">↻ Sayfayı Yenile</button>
        </div>
      </div>`;
    document.body.appendChild(p);
    U.el('cakismaYedek').onclick = () => { Promise.resolve(ADB.yedekIndir()).catch(e => console.error(e)); };
    U.el('cakismaYenile').onclick = () => location.reload();
  }

  /* ---------------- Hareketsizlikte otomatik kapanma ----------------
     Belirli süre işlem yapılmazsa oturum kapanır (varsayılan 5 dakika).
     Süre Sistem ekranından ayarlanır (0 = kapalı).

     Süre dolunca yalnız "çıkış" YAPILMAZ, program YENİDEN YÜKLENİR: veri
     parolasının anahtarı bellekten silinir, tekrar girmek için hem veri
     parolası hem giriş parolası gerekir. Sadece çıkış yapılsaydı giriş
     ekranı açık kalır, anahtar bellekte dururdu ve "Giriş yapamıyorum →
     Sıfırla" yolu parolasız kullanılabilirdi.

     Bitimden 30 sn önce uyarı perdesi çıkar; "Devam et" süreyi sıfırlar.
     Kapanmadan önce bekleyen kayıt dosyaya yazılır, kilit bırakılır. */
  const UYARI_SN = 30;
  let sonHareket = Date.now();
  let zamanAsimiKuruldu = false;
  let kapaniyor = false;
  function hareket() {
    sonHareket = Date.now();
    const u = U.el('zamanAsimiPerde');
    if (u) u.remove();
  }
  function zamanAsimiDakika() {
    try { return API.oturumZamanAsimi(); } catch (e) { return 5; }
  }
  async function zamanAsimiKapat() {
    if (kapaniyor) return;
    kapaniyor = true;
    try { await ADB.kaydetHemen(); } catch (e) { }
    try { await KILIT.birak(); } catch (e) { }
    try { sessionStorage.setItem('butce_zaman_asimi', '1'); } catch (e) { }
    location.reload();
  }
  function zamanAsimiDenetle() {
    const dk = zamanAsimiDakika();
    if (!dk || kapaniyor) return;
    const kalan = Math.round((sonHareket + dk * 60000 - Date.now()) / 1000);
    if (kalan <= 0) { zamanAsimiKapat(); return; }
    let p = U.el('zamanAsimiPerde');
    if (kalan > UYARI_SN) { if (p) p.remove(); return; }
    if (!p) {
      p = document.createElement('div');
      p.className = 'perde';
      p.id = 'zamanAsimiPerde';
      p.innerHTML = `
        <div class="perde-kart" style="max-width:420px">
          <div class="logo">⏱</div>
          <div class="marka">Oturum kapanmak üzere</div>
          <div class="alt">${dk} dakikadır işlem yapılmadı</div>
          <p class="aciklama">Güvenlik için program <b id="zaKalan">${kalan}</b> saniye içinde kapanacak.
            Kayıtlarınız korunur; yeniden açmak için veri parolası ve giriş parolası istenir.</p>
          <button class="btn" id="zaDevam" style="width:100%; justify-content:center;">Devam et</button>
        </div>`;
      document.body.appendChild(p);
      U.el('zaDevam').onclick = hareket;
    } else {
      const k = U.el('zaKalan');
      if (k) k.textContent = kalan;
    }
  }
  function zamanAsimiBaslat() {
    if (zamanAsimiKuruldu) return;
    zamanAsimiKuruldu = true;
    /* Uyarı perdesi açıkken fare hareketi süreyi SIFIRLAMAZ — kullanıcı
       "Devam et"e basmalı; yoksa ekranın önünden geçen biri de sıfırlardı. */
    let son = 0;
    const dinle = () => {
      const s = Date.now();
      if (s - son < 1000) return;
      son = s;
      if (!U.el('zamanAsimiPerde')) sonHareket = s;
    };
    ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(o =>
      document.addEventListener(o, dinle, { passive: true, capture: true }));
    setInterval(zamanAsimiDenetle, 1000);
    try {
      if (sessionStorage.getItem('butce_zaman_asimi')) {
        sessionStorage.removeItem('butce_zaman_asimi');
        setTimeout(() => U.bildir('Hareketsizlik nedeniyle oturum kapatıldı; kayıtlarınız korundu.'), 800);
      }
    } catch (e) { }
  }

  /* Program sunucusuz (index.html çift tıklanarak) açıldıysa veri yine
     tarayıcıda kalır — kullanıcı bunu bilmeli. */
  function depoUyarisi() {
    if (ADB.depoDurumu().kip === 'sunucu') return;
    setTimeout(() => U.bildir('Dikkat: program sunucusuz açıldı, kayıtlar veri dosyasına DEĞİL tarayıcıya yazılıyor. ' +
      'Programı BUTCE-BASLAT.bat ile açın.', 'hata'), 1200);
  }

  /* Şifreleme bu kurulumda açıktı ama şu an kapalı (işaret var, anahtar yok) */
  async function sifrelemeDustuKontrol() {
    let dustu = false;
    try { dustu = await ADB.sifrelemeDustuMu(); } catch (e) { return; }
    if (!dustu) return;
    U.bildir('Veri şifrelemesi kapalı görünüyor! Sistem → Veri Deposu ekranından şifrelemeyi yeniden kurun.', 'hata');
  }

  function cikis() {
    KILIT.birak();
    API.cikisYap();
    ADB.kaydetHemen();
    C.kipHepsiniKapat();
    U.el('uygulama').classList.add('gizli');
    girisEkrani();
  }

  /* ---------------- Yıl ve Grup ----------------
     Program grupların (Tanımlar → Gruplar) bütçesini ayrı ayrı tutar. Üst
     çubukta YIL ve GRUP seçilir; bütün ekranlar yalnızca seçili grubun
     verisini gösterir. Kullanıcı yalnızca yetkili olduğu grupların
     düğmelerini görür — örneğin yalnız bir gruba yetkili kişi diğer
     grupların düğmesini hiç görmez.
     "Tümü" birden fazla gruba yetkisi olanlarda çıkar ve yalnızca
     birleştirmeyi destekleyen ekranlarda (Özet, Maliyet) kullanılır. */
  let aktifYil = null, aktifGrup = null;

  function secimYukle() {
    let k = {};
    try { k = JSON.parse(localStorage.getItem('butce_secim') || '{}'); } catch (e) { }
    const gruplar = API.gorunurGruplar().map(g => g.kod);
    const yillar = yilListesi();
    aktifYil = yillar.indexOf(k.yil) >= 0 ? k.yil : (yillar[0] || new Date().getFullYear());
    aktifGrup = (k.grup === 'TUMU' && gruplar.length > 1) || gruplar.indexOf(k.grup) >= 0 ? k.grup : (gruplar[0] || null);
    aktifCalisma = null;
    const c = API.calismaListe().find(x => x.id === k.calisma && x.yil === aktifYil && x.grup_kod === aktifGrup);
    if (c) aktifCalisma = c.id;
  }
  function secimKaydet() {
    try { localStorage.setItem('butce_secim', JSON.stringify({ yil: aktifYil, grup: aktifGrup, calisma: aktifCalisma })); } catch (e) { }
  }
  function yilListesi() {
    const s = new Set(API.calismaListe().map(c => c.yil));
    API.yillar().forEach(y => s.add(y));
    return [...s].sort((a, b) => b - a);
  }

  function yil() { return aktifYil; }
  function grup() { return aktifGrup; }
  function tumuMu() { return aktifGrup === 'TUMU'; }

  /* Seçili yıl+grubun çalışması. Aynı yıl ve grupta birden çok çalışma
     varsa üst çubuktaki üçüncü seçiciyle biri seçilir. */
  function calisma() {
    if (!aktifGrup || tumuMu()) return null;
    const l = API.calismaListe().filter(c => c.yil === aktifYil && c.grup_kod === aktifGrup);
    if (!l.length) return null;
    return l.find(c => c.id === aktifCalisma) || l[0];
  }
  /* "Tümü" seçiliyken yılın görülebilen bütün çalışmaları (grup başına bir tane). */
  function calismalar() {
    if (!tumuMu()) { const c = calisma(); return c ? [c] : []; }
    const gor = {}, l = [];
    API.calismaListe().filter(c => c.yil === aktifYil).forEach(c => {
      if (!gor[c.grup_kod]) { gor[c.grup_kod] = 1; l.push(c); }
    });
    return l;
  }

  function calismaSec(id) {
    const c = API.calismaGetir(Number(id));
    if (c) { aktifYil = c.yil; aktifGrup = c.grup_kod; aktifCalisma = c.id; }
    secimKaydet();
    calismaSeciciCiz();
    tazele();
  }
  function secimYap(yeniYil, yeniGrup) {
    if (yeniYil != null) aktifYil = Number(yeniYil);
    if (yeniGrup != null) aktifGrup = yeniGrup;
    aktifCalisma = null;
    secimKaydet();
    calismaSeciciCiz();
    tazele();
  }

  function calismaSeciciCiz() {
    const kap = U.el('donemSecici');
    if (!kap) return;
    const gruplar = API.gorunurGruplar();
    if (!gruplar.length) {
      kap.innerHTML = API.kullanici() && API.kullanici().yonetici
        ? '<span class="kucuk soluk">Henüz grup yok — Tanımlar → Gruplar sekmesinden ekleyin</span>'
        : '<span class="kucuk soluk">Size atanmış grup yok — yöneticinize başvurun</span>';
      return;
    }
    const yillar = yilListesi();
    const ayni = aktifGrup && !tumuMu()
      ? API.calismaListe().filter(c => c.yil === aktifYil && c.grup_kod === aktifGrup) : [];
    const secili = calisma();
    kap.innerHTML = `<div class="ust-secici">
      <select id="yilSec" title="Yıl">${yillar.map(y => `<option value="${y}" ${y === aktifYil ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <div class="grup-dugmeler">
        ${gruplar.map(g => `<button data-grup="${g.kod}" class="${g.kod === aktifGrup ? 'etkin' : ''}">${U.esc(g.ad)}</button>`).join('')}
        ${gruplar.length > 1 ? `<button data-grup="TUMU" class="${tumuMu() ? 'etkin' : ''}">Tümü</button>` : ''}
      </div>
      ${ayni.length > 1 ? `<select id="calismaSec">${ayni.map(c =>
        `<option value="${c.id}" ${secili && c.id === secili.id ? 'selected' : ''}>${U.esc(c.ad)} · ${c.kisi} kişi${c.durum === 'ONAYLI' ? ' · onaylı' : ''}</option>`).join('')}</select>` : ''}
    </div>`;
    U.el('yilSec').onchange = e => secimYap(e.target.value, null);
    kap.querySelectorAll('[data-grup]').forEach(b => b.onclick = () => secimYap(null, b.getAttribute('data-grup')));
    const cs = U.el('calismaSec'); if (cs) cs.onchange = e => calismaSec(e.target.value);
  }

  function gorunurModuller() {
    return MODULLER.filter(m => (!m.yetki || API.yetkiVar(m.yetki)) && (!m.gorunur || m.gorunur()));
  }

  function menuCiz() {
    const gruplar = {};
    gorunurModuller().forEach(m => {
      const g = m.grup || 'Diğer';
      (gruplar[g] = gruplar[g] || []).push(m);
    });
    const sira = ['Genel', 'Bütçe', 'İçe / Dışa Aktarma', 'Tanımlar', 'Yönetim'];
    const anahtarlar = Object.keys(gruplar).sort((a, b) => {
      const ia = sira.indexOf(a), ib = sira.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    U.el('menu').innerHTML = anahtarlar.map(g => `
      <div class="grup-baslik">${U.esc(g)}</div>
      ${gruplar[g].map(m => {
        let rozet = '';
        try { if (m.sayac) { const n = m.sayac(); if (n) rozet = `<span class="rozet">${U.sayi(n)}</span>`; } }
        catch (e) {}
        return `<button data-modul="${m.id}" class="${aktifModul === m.id ? 'etkin' : ''}"${aktifModul === m.id ? ' aria-current="page"' : ''}>
                  <span class="ikon">${IKON.menu(m.id)}</span><span>${U.esc(m.ad)}</span>${rozet}
                </button>`;
      }).join('')}`).join('');

    U.el('menu').onclick = e => {
      const b = e.target.closest('[data-modul]');
      if (b) git(b.getAttribute('data-modul'));
    };
  }

  function kenarAltCiz() {
    const k = API.kullanici();
    U.el('kenarAlt').innerHTML = `
      <div class="kisi">${U.esc(k.ad_soyad)}</div>
      <div class="rol">${k.yonetici ? 'Sistem Yöneticisi' : 'Kullanıcı'}</div>
      <button id="kilavuzBtn" class="kilavuz-btn">📖 Kullanım Kılavuzu</button>
      <button id="cikisBtn">Çıkış Yap</button>`;
    U.el('kilavuzBtn').onclick = () => git('kilavuz');
    U.el('cikisBtn').onclick = cikis;
  }

  function git(modulId, parametre) {
    const m = MODULLER.find(x => x.id === modulId);
    if (!m) return;
    /* Yetki değişikliği açık oturuma yansısın */
    if (API.kullanici() && !API.oturumTazele()) {
      U.bildir('Hesabınız devre dışı bırakıldı ya da silindi; oturum kapatıldı.', 'uyari');
      return cikis();
    }
    if (m.yetki && !API.yetkiVar(m.yetki)) {
      U.bildir('Bu bölüme erişim yetkiniz yok.', 'hata');
      return;
    }
    aktifModul = modulId;
    U.el('sayfaBaslik').textContent = m.baslik || m.ad;
    U.el('sayfaAltBaslik').textContent = m.altBaslik || '';

    C.kipHepsiniKapat();

    /* İçerik alanını YENİDEN OLUŞTUR (innerHTML temizlemek yeterli değil):
       modüller kendi kaplarına dinleyici bağlıyor; aynı öğe tekrar
       kullanılırsa her ziyarette bir dinleyici daha eklenir. */
    const eskiKap = U.el('icerik');
    const kap = document.createElement('div');
    kap.id = 'icerik';
    kap.className = eskiKap.className;
    eskiKap.replaceWith(kap);

    menuCiz();
    try {
      if (m.calismaGerekli && !API.gorunurGruplar().length) {
        kap.innerHTML = `<div class="uyari uyari-dikkat"><span class="ik">ℹ</span>
          <div>${API.kullanici() && API.kullanici().yonetici
            ? 'Henüz grup tanımlanmamış. <strong>Tanımlar → Gruplar</strong> sekmesinden bir grup ekleyin.'
            : 'Size atanmış bir grup yok. Sistem yöneticinizden grup erişimi isteyin.'}</div></div>`;
      } else if (m.calismaGerekli && tumuMu() && !m.tumuDestek) {
        kap.innerHTML = `<div class="uyari uyari-bilgi"><span class="ik">ℹ</span>
          <div>Bu ekran tek bir grup üzerinde çalışır. Üst çubuktan bir grup seçin.
          "Tümü" yalnızca Özet ve Maliyet Tablosu'nda kullanılabilir.</div></div>`;
      } else if (m.calismaGerekli && !calismalar().length) {
        const g = (API.grupListe().find(x => x.kod === aktifGrup) || {}).ad || '';
        const acabilir = !tumuMu() && API.grupYazabilir(aktifGrup) && API.yetkiVar('personel.yaz');
        /* Program son seçilen yılı hatırlar; o yılda bu grubun çalışması yoksa ekran boş görünmesin diye
           çalışması olan yıla tek tıkla geçiş sunulur. */
        const diger = API.calismaListe().filter(c => tumuMu() || c.grup_kod === aktifGrup).map(c => c.yil)
          .filter(y => y !== aktifYil).sort((a, b) => b - a)[0];
        kap.innerHTML = `<div class="uyari uyari-dikkat"><span class="ik">ℹ</span>
          <div><strong>${aktifYil} · ${U.esc(tumuMu() ? 'Tüm gruplar' : g)}</strong> için henüz bir bütçe çalışması yok
          (üst çubukta seçili yıl: <strong>${aktifYil}</strong>).
          ${diger ? ` Bu grubun <strong>${diger}</strong> çalışması var.` : ''}
          <div class="ust-bosluk btn-satir">${diger ? `<button class="btn btn-ikincil" id="yilGecBtn">${diger} yılına geç</button>` : ''}
          ${acabilir ? `<button class="btn" id="calismaAcBtn">${aktifYil} çalışması aç…</button>` : ''}</div></div></div>`;
        const b = U.el('calismaAcBtn');
        if (b) b.onclick = () => git('calisma', { yeni: true });
        const yg = U.el('yilGecBtn');
        if (yg) yg.onclick = () => secimYap(diger, null);
      } else {
        m.ciz(kap, parametre);
        /* Onaylı (kilitli) çalışmada her ekranın başında uyarı bandı */
        const oc = m.calismaGerekli && !tumuMu() ? calisma() : null;
        /* Aynı yıl + grupta birden çok çalışma olabilir (ör. bir taslak ve bir revize); boş olan seçiliyse
           "kişiler kayboldu" sanılmasın diye hangisinin seçili olduğu her ekranda görünür. */
        const ayniYil = oc ? API.calismaListe().filter(x => x.yil === oc.yil && x.grup_kod === oc.grup_kod) : [];
        if (ayniYil.length > 1) {
          kap.insertAdjacentHTML('afterbegin', `<div class="uyari ${oc.kisi ? 'uyari-bilgi' : 'uyari-dikkat'} kucuk"><span class="ik">🗂</span>
            <div>${oc.yil} · ${U.esc(oc.grup_adi)} için <strong>${ayniYil.length} çalışma</strong> var; şu an seçili:
            <strong>${U.esc(oc.ad)}</strong> (${oc.kisi} kişi${oc.durum === 'ONAYLI' ? ', onaylı' : ''}).
            Diğerleri: ${ayniYil.filter(x => x.id !== oc.id).map(x => U.esc(x.ad) + ' (' + x.kisi + ' kişi)').join(', ')} —
            üst çubuktaki çalışma seçicisinden değiştirilir.${oc.kisi ? '' : ' <strong>Seçili çalışmada kişi yok.</strong>'}</div></div>`);
        }
        if (oc && oc.durum === 'ONAYLI') {
          kap.insertAdjacentHTML('afterbegin', `<div class="uyari uyari-bilgi"><span class="ik">🔒</span>
            <div><strong>${oc.yil} · ${U.esc(oc.grup_adi)} onaylı ve kilitli.</strong> Onaylanmış maliyetler olduğu gibi gösterilir;
            değişiklik yapılamaz.
            Gerekirse Bütçe Çalışmaları → ✎ ekranından "Taslak"a alın.</div></div>`);
        }
      }
    } catch (e) {
      console.error(e);
      kap.innerHTML = `<div class="uyari uyari-hata"><span class="ik">⚠</span>
        <div><strong>Bu bölüm görüntülenemedi.</strong><br>${U.esc(e.message || String(e))}</div></div>`;
    }
    window.scrollTo(0, 0);
  }

  /* Aktif modülü yeniden çizer. */
  function tazele() { git(aktifModul); }

  function kayitDurumGuncelle() {
    const d = U.el('kayitDurum');
    if (!d) return;
    d.classList.remove('bekliyor');
    d.querySelector('span:last-child').textContent = 'Kayıtlı';
  }

  function kayitBekliyor() {
    const d = U.el('kayitDurum');
    if (!d) return;
    d.classList.add('bekliyor');
    d.querySelector('span:last-child').textContent = 'Kaydediliyor…';
  }

  function aktifModulKod() { return aktifModul; }

  return { modulKaydet, baslat, git, tazele, cikis, kayitBekliyor, gorunurModuller,
           aktifModul: aktifModulKod, calisma, calismalar, calismaSec, calismaSeciciCiz,
           yil, grup, tumuMu, secimYap };
})();

document.addEventListener('DOMContentLoaded', () => APP.baslat());
