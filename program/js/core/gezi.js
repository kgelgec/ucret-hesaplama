/* =====================================================================
   BAŞLANGIÇ GEZİSİ

   İlk girişte (ilk kurulum dâhil) kendiliğinden açılır; sonra sol alttaki
   "Başlangıç Gezisi" düğmesiyle ya da kılavuzdan yeniden başlatılır.
   Programa başlarken yapılacakları sırasıyla gösterir: her adım ilgili
   ekranı açar ve menüdeki düğmesini vurgular. Kullanıcının göremediği
   ekranların adımı atlanır (yetki).

   Klavye: → / Enter ileri, ← geri, Esc kapat; Tab kart içinde döner.
   Ekran ya da menü adı değişince adım metinleri de güncellenmelidir.
   ===================================================================== */
window.GEZI = (function () {
  'use strict';

  /* hedef: vurgulanacak öğe (seçici); yoksa kart ortada durur.
     modul: adımda açılacak ekran — hedef verilmemişse menüdeki düğmesi vurgulanır. */
  const ADIMLAR = [
    { baslik: 'Ücret Hesaplama\'ya hoş geldiniz', metin: b => `
      <p>Bu kısa gezi, programı kullanmaya başlamadan önce yapılacakları sırasıyla gösterir. Her adımda ilgili ekran açılır.</p>
      ${b.baslangic === 'ornek'
        ? '<p>Örnek veriyle başladınız: gördüğünüz gruplar, kişiler ve tutarlar uydurmadır; ekranları rahatça deneyebilirsiniz. Gerçek kullanıma geçerken <strong>Sistem → Veritabanını Sıfırla</strong> ile baştan başlayın.</p>'
        : b.baslangic === 'bos'
          ? '<p>Boş başladınız: yasal parametreler ve "Genel" adlı bir grup hazır. Aşağıdaki adımları sırayla izleyerek kendi bütçenizi kurun.</p>'
          : ''}
      <p class="gezi-not">İstediğiniz an <kbd>Esc</kbd> ile çıkabilirsiniz; gezi sol alttaki <strong>Başlangıç Gezisi</strong> düğmesiyle yeniden açılır.</p>` },
    { modul: 'parametre', baslik: 'Yasal parametreleri kontrol edin', metin: () => `
      <p>Asgari ücret, gelir vergisi dilimleri, SGK oranları ve tavanı, damga vergisi ve teşvik oranları yıl bazında buradadır.
        Kurulumla gelen değerleri resmî kaynaktan doğrulayın.</p>
      <p>Henüz açıklanmamış bir yıl için artış oranıyla öngörü yapılır. Mesai katsayıları ve günlük çalışma saati <strong>Genel</strong> sekmesindedir.</p>` },
    { modul: 'tanim', baslik: 'Gruplarınızı ve bütçe bölümlerinizi tanımlayın', metin: () => `
      <p>Bütçe gruplar hâlinde tutulur (örneğin birim, işyeri ya da şube). <strong>Gruplar</strong> ve <strong>Bütçe Bölümleri</strong>
        sekmelerinden kendi yapınızı kurun.</p>
      <p>Personel listenizin sütun başlıkları farklı adlar taşıyorsa <strong>İçe Aktarma Başlıkları</strong> sekmesinden tanıtın.</p>` },
    { hedef: '#donemSecici', baslik: 'Yıl ve grup seçimi', metin: () => `
      <p>Üst çubuktan çalıştığınız <strong>yılı</strong> ve <strong>grubu</strong> seçersiniz. Bütçe ekranları seçili grubun o yılki
        çalışmasını gösterir; <strong>Tümü</strong> grupları birlikte özetler.</p>` },
    { modul: 'calisma', baslik: 'Bütçe çalışmasını açın', metin: () => `
      <p>Her grubun her yılı bir bütçe çalışmasıdır. <strong>Yeni Çalışma</strong> ile açın: önceki yılın çalışmasından, aynı yılın
        bir kopyasından ya da boş.</p>
      <div class="gezi-dikkat"><strong>Ücret esası:</strong> maaşları <strong>net</strong> mi <strong>brüt</strong> mü gireceğinizi
        burada seçersiniz. Tutar girildikten sonra değiştirilemez; yeni yıl çalışması esası önceki yıldan alır.</div>` },
    { modul: 'aktarim', baslik: 'Personel listenizi alın', metin: () => `
      <p>Elinizdeki Excel ya da CSV listesini, bordro programınızın çıktısını yükleyin; sütunlar başlık adlarından tanınır.</p>
      <p>Hazır listeniz yoksa bu ekrandan <strong>örnek Excel şablonunu</strong> indirip doldurun. Kişileri tek tek
        Personel ve Zam ekranından da ekleyebilirsiniz.</p>` },
    { modul: 'personel', baslik: 'Maaşları ve zam öngörüsünü gözden geçirin', metin: () => `
      <p>Önceki yıl maaşı, zam ayı, yaka, kanun ve teşvik bilgileri kişi kartındadır. Öngörülen zam, zam kademesi kurallarına göre
        hesaplanır; gerekirse kişi bazında düzeltme girersiniz.</p>` },
    { modul: 'aylik', baslik: 'Aylık girdileri ekleyin', metin: () => `
      <p>Prim, ayni yardım, yakıt, fazla mesai saati, çalışılan gün ve AR-GE günü gibi aya özgü bilgiler buradadır.
        Bir tutarı bir ayda bütün kişilere birden de yazabilirsiniz.</p>` },
    { modul: 'maliyet', baslik: 'Sonucu inceleyin', metin: () => `
      <p>Maliyet Tablosu kişi × ay işveren maliyetini ve her kişinin 12 aylık bordro dökümünü gösterir.
        <strong>Özet</strong> ve <strong>Maaş Dağılımı</strong> toplamları ve zammın etkisini verir.</p>` },
    { modul: 'excel', baslik: 'Raporu alın ve onaylayın', metin: () => `
      <p>Excel Raporu bütçeyi yönetime sunulacak biçimde indirir; yönetimin düzeltmeleri aynı dosyadan geri yüklenir.</p>
      <p>Kesinleşen çalışmayı <strong>Bütçe Çalışmaları</strong> ekranında onaylayın: onaylı çalışma kilitlenir, parametreleri dondurulur.</p>` },
    { modul: 'sistem', baslik: 'Verinizi koruyun', metin: () => `
      <p>Veriler bu bilgisayarda tek bir dosyada durur. Buradan <strong>şifrelemeyi</strong> açın ve <strong>yedek</strong> alın;
        büyük işlemlerden önce yedek almayı alışkanlık edinin.</p>
      <p>Programı başkaları da kullanacaksa <strong>Kullanıcılar</strong> ekranından hesap açıp yetki verin.</p>` },
    { hedef: '#kilavuzBtn', baslik: 'Hazırsınız', metin: () => `
      <p>Her ekranın ayrıntısı <strong>Kullanım Kılavuzu</strong>ndadır. Bu geziyi yeniden görmek için hemen altındaki
        <strong>Başlangıç Gezisi</strong> düğmesini kullanın.</p>` },
  ];

  let adimlar = [], sira = 0, baglam = {}, donusModul = null;
  let perde = null, isik = null, kart = null, oncekiOdak = null;

  function gorunurAdimlar() {
    const moduller = APP.gorunurModuller().map(m => m.id);
    return ADIMLAR.filter(a => !a.modul || moduller.indexOf(a.modul) >= 0);
  }

  function hedefBul(a) {
    if (a.hedef) return document.querySelector(a.hedef);
    if (a.modul) return document.querySelector(`#menu [data-modul="${a.modul}"]`);
    return null;
  }

  function olustur() {
    perde = document.createElement('div');
    perde.className = 'gezi-perde';
    isik = document.createElement('div');
    isik.className = 'gezi-isik';
    kart = document.createElement('div');
    kart.className = 'gezi-kart';
    kart.setAttribute('role', 'dialog');
    kart.setAttribute('aria-modal', 'true');
    kart.setAttribute('aria-labelledby', 'geziBaslik');
    kart.setAttribute('aria-describedby', 'geziMetin');
    perde.appendChild(isik);
    perde.appendChild(kart);
    document.body.appendChild(perde);
    kart.addEventListener('click', e => {
      const b = e.target.closest('[data-gezi]');
      if (!b) return;
      const is = b.getAttribute('data-gezi');
      if (is === 'ileri') git(sira + 1);
      else if (is === 'geri') git(sira - 1);
      else kapat();
    });
    document.addEventListener('keydown', tus, true);
    window.addEventListener('resize', yerlestir);
    window.addEventListener('scroll', yerlestir, true);
  }

  function tus(e) {
    if (!perde) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); kapat(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); git(sira + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); git(sira - 1); }
    else if (e.key === 'Tab') {           // odak kartın içinde kalır
      const d = [...kart.querySelectorAll('button')];
      if (!d.length) return;
      const i = d.indexOf(document.activeElement);
      e.preventDefault();
      d[(i + (e.shiftKey ? -1 : 1) + d.length) % d.length].focus();
    }
  }

  function git(yeni) {
    if (yeni >= adimlar.length) return kapat();
    if (yeni < 0) return;
    sira = yeni;
    const a = adimlar[sira];
    if (a.modul && APP.aktifModul() !== a.modul) APP.git(a.modul);
    const son = sira === adimlar.length - 1;
    kart.innerHTML = `
      <div class="gezi-ust">
        <span class="gezi-sayac">${sira === 0 ? 'Başlangıç gezisi' : `Adım ${sira} / ${adimlar.length - 1}`}</span>
        <button class="gezi-kapat" data-gezi="kapat" aria-label="Geziyi kapat" title="Geziyi kapat (Esc)">×</button>
      </div>
      <div class="gezi-ilerleme" aria-hidden="true"><span style="width:${Math.round(sira / (adimlar.length - 1) * 100)}%"></span></div>
      <h2 id="geziBaslik">${U.esc(a.baslik)}</h2>
      <div id="geziMetin" class="gezi-metin">${a.metin(baglam)}</div>
      <div class="gezi-alt">
        ${sira > 0 ? '<button class="btn btn-ikincil" data-gezi="geri">Geri</button>' : '<button class="btn btn-ikincil" data-gezi="kapat">Şimdi değil</button>'}
        <button class="btn" data-gezi="ileri">${son ? 'Bitir' : sira === 0 ? 'Geziye başla' : 'İleri'}</button>
      </div>`;
    const h = hedefBul(a);
    if (h) h.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    yerlestir();
    kart.querySelector('[data-gezi="ileri"]').focus();
  }

  /* Işık hedefin üstüne, kart hedefin sağına (yer yoksa altına / üstüne) oturur; hedef yoksa ya da
     görünmüyorsa kart ortada durur ve perde bütün ekranı karartır. */
  function yerlestir() {
    if (!perde) return;
    const a = adimlar[sira];
    const h = hedefBul(a);
    const r = h && h.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, P = 8, BOSLUK = 14, KENAR = 16;
    const kw = kart.offsetWidth, kh = kart.offsetHeight;
    if (!r || !r.width || !r.height || r.bottom < 0 || r.top > vh) {
      perde.classList.add('ortada');
      kart.style.left = Math.max(KENAR, (vw - kw) / 2) + 'px';
      kart.style.top = Math.max(KENAR, (vh - kh) / 2) + 'px';
      return;
    }
    perde.classList.remove('ortada');
    const x = r.left - P, y = r.top - P, w = r.width + 2 * P, hh = r.height + 2 * P;
    Object.assign(isik.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
    const sigar = (v, en, max) => Math.min(Math.max(KENAR, v), Math.max(KENAR, max - en - KENAR));
    let kx, ky;
    if (x + w + BOSLUK + kw + KENAR <= vw) { kx = x + w + BOSLUK; ky = sigar(y, kh, vh); }
    else if (y + hh + BOSLUK + kh + KENAR <= vh) { kx = sigar(x, kw, vw); ky = y + hh + BOSLUK; }
    else if (y - BOSLUK - kh >= KENAR) { kx = sigar(x, kw, vw); ky = y - BOSLUK - kh; }
    else { kx = sigar((vw - kw) / 2, kw, vw); ky = sigar((vh - kh) / 2, kh, vh); }
    kart.style.left = kx + 'px';
    kart.style.top = ky + 'px';
  }

  /* b = { baslangic: 'ornek' | 'bos' } — ilk kurulumdan gelirken; yeniden başlatmada boş */
  function baslat(b) {
    if (perde) kapat();
    baglam = b || {};
    adimlar = gorunurAdimlar();
    donusModul = APP.aktifModul();
    oncekiOdak = document.activeElement;
    C.kipHepsiniKapat();
    olustur();
    git(0);
  }

  /* donmeden: oturum kapanırken — ekran değiştirilmez, odak taşınmaz */
  function kapat(donmeden) {
    if (!perde) return;
    document.removeEventListener('keydown', tus, true);
    window.removeEventListener('resize', yerlestir);
    window.removeEventListener('scroll', yerlestir, true);
    perde.remove();
    perde = isik = kart = null;
    /* Gezinin açtığı ekranlar arasında kalınmasın: başladığı ekrana dönülür */
    if (donmeden === true) return;
    if (donusModul && APP.aktifModul() !== donusModul) APP.git(donusModul);
    const o = U.el('geziBtn') || oncekiOdak;
    if (o && o.focus) o.focus();
  }

  return { baslat, kapat, acikMi: () => !!perde };
})();
