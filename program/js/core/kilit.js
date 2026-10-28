/* ===================================================================
   YAZMA KİLİDİ — aynı anda yalnız bir kişi kayıt yapar
   -------------------------------------------------------------------
   NEDEN: program kaydederken veritabanının TAMAMINI yazıyor. İki kişi
   (ya da aynı kişinin iki sekmesi) aynı anda kayıt yaparsa ikincisinin
   kopyasında birincinin değişiklikleri yoktur. Sürüm denetimi bunu
   reddeder — veri kaybolmaz — ama ikincinin girdiği her şey boşa gider.

   ÇÖZÜM: ortak klasördeki Excel mantığı. Programı ilk açan yazar;
   ikincisi GÖRÜNTÜLEME kipinde açılır: her şeyi görür, Excel alır,
   kayıt yapamaz. Kilit `veri\kilit.json` dosyasındadır, 30 sn'de bir
   tazelenir; 120 sn tazelenmezse düşmüş sayılır.
   =================================================================== */
window.KILIT = (function () {
  'use strict';

  const TAZELE_MS  = 30000;
  const KONTROL_MS = 15000;
  const OTURUM_ANAHTAR = 'butce_kilit_oturum';

  let oturum = null;
  let durum = 'bilinmiyor';   /* 'yazar' | 'okur' | 'kapali' */
  let sahipBilgi = null;
  let zamanlayici = null;
  const dinleyiciler = [];

  function oturumAl() {
    if (oturum) return oturum;
    const uret = () => 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    try {
      oturum = sessionStorage.getItem(OTURUM_ANAHTAR);
      if (!oturum) { oturum = uret(); sessionStorage.setItem(OTURUM_ANAHTAR, oturum); }
    } catch (e) { oturum = uret(); }
    return oturum;
  }

  function kullanilabilir() { return !!(window.ADB && ADB.depoDurumu && ADB.depoDurumu().kip === 'sunucu'); }
  function durumBilgisi() { return { durum: durum, yazar: durum === 'yazar', sahip: sahipBilgi }; }
  function bildir() { dinleyiciler.forEach(f => { try { f(durumBilgisi()); } catch (e) { } }); }

  async function dene() {
    if (!kullanilabilir()) { durum = 'yazar'; return true; }
    const k = (window.API && API.kullanici && API.kullanici()) || {};
    try {
      const y = await fetch('/kilit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oturum: oturumAl(), kullanici: k.kullanici_adi || '', adSoyad: k.ad_soyad || '' }),
      });
      const s = await y.json();
      if (s && s.sahip) { durum = 'yazar'; sahipBilgi = s.kilit; }
      else { durum = 'okur'; sahipBilgi = (s && s.kilit) || null; }
    } catch (e) {
      console.warn('Kilit sorulamadı', e);   // programı kullanılmaz kılmak çakışma riskinden kötü
      durum = 'yazar';
    }
    bildir();
    return durum === 'yazar';
  }

  function zamanlayiciyiKur() {
    clearTimeout(zamanlayici);
    zamanlayici = setTimeout(async () => { await dene(); zamanlayiciyiKur(); },
                             durum === 'yazar' ? TAZELE_MS : KONTROL_MS);
  }

  async function baslat() { await dene(); zamanlayiciyiKur(); return durumBilgisi(); }

  async function birak() {
    clearTimeout(zamanlayici);
    if (!kullanilabilir() || !oturum) { durum = 'kapali'; return; }
    try { await fetch('/kilit?oturum=' + encodeURIComponent(oturum), { method: 'DELETE' }); } catch (e) { }
    durum = 'okur'; sahipBilgi = null;
    bildir();
  }

  function kapanirkenBirak() {
    if (!kullanilabilir() || !oturum || durum !== 'yazar') return;
    try {
      const a = '/kilit?oturum=' + encodeURIComponent(oturum);
      if (navigator.sendBeacon) navigator.sendBeacon(a + '&birak=1', new Blob([], { type: 'text/plain' }));
    } catch (e) { }
  }

  function yazabilirMi() { return durum !== 'okur'; }

  /* Kilidi tutan KENDİ hesabımız mı? (aynı kişinin ikinci sekmesi) */
  function kendiHesabimMi() {
    if (!sahipBilgi) return false;
    const k = (window.API && API.kullanici && API.kullanici()) || {};
    const ben = String(k.kullanici_adi || '').trim().toLowerCase();
    return !!ben && ben === String(sahipBilgi.kullanici || '').trim().toLowerCase();
  }

  function engelMesaji() {
    if (kendiHesabimMi()) {
      return 'Program BAŞKA BİR SEKMEDE açık ve kayıt yetkisi orada. Bu sekmede yalnızca görüntüleme ' +
             'yapabilirsiniz. Diğer sekmeyi kapatıp bu sayfayı yenileyin (en geç 2 dakika içinde kendiliğinden geçer).';
    }
    const ad = (sahipBilgi && (sahipBilgi.adSoyad || sahipBilgi.kullanici)) || 'başka bir kullanıcı';
    return 'Şu anda yalnızca görüntüleme yapabilirsiniz — ' + ad + ' kayıt yapıyor. ' +
           'O kişi programı kapattığında devralırsınız.';
  }

  function dinle(fn) { dinleyiciler.push(fn); }
  window.addEventListener('beforeunload', () => { try { kapanirkenBirak(); } catch (e) { } });

  return { baslat, dene, birak, yazabilirMi, engelMesaji, durumBilgisi, dinle, kullanilabilir, kendiHesabimMi };
})();
