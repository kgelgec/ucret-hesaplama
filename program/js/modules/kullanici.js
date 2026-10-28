/* =====================================================================
   KULLANICILAR VE YETKİLER
   Rol yok: sistem yöneticisi her kullanıcı için
     - hangi grupları görebileceğini / düzenleyebileceğini,
     - hangi işlem ve alanlara erişebileceğini
   tek tek işaretler.
   ===================================================================== */
(function () {
  'use strict';

  function ciz(kap) {
    const liste = API.kullaniciListe();
    const gruplar = API.grupListe();
    const ben = API.kullanici();

    kap.innerHTML = `
      <div class="kart">
        <div class="kart-baslik">
          <div><h2>Kullanıcılar</h2>
            <div class="kart-aciklama">Sistem yöneticisi her şeyi görür. Diğer kullanıcılar yalnızca işaretlediğiniz
              grupları ve yetkileri kullanabilir.</div></div>
          <button class="btn" id="yeniBtn">+ Yeni Kullanıcı</button>
        </div>
        ${C.tablo([
          { baslik: 'Kullanıcı Adı', sinif: 'mono', alan: 'kullanici_adi' },
          { baslik: 'Ad Soyad', alan: 'ad_soyad' },
          { baslik: 'Tür', deger: k => k.yonetici ? '<span class="rz rz-mor">Sistem Yöneticisi</span>' : 'Kullanıcı' },
          { baslik: 'Gruplar', deger: k => k.yonetici ? '<span class="soluk">tümü</span>' :
              API.kullaniciGruplari(k.kullanici_adi).map(g => {
                const ad = (gruplar.find(x => x.kod === g.grup_kod) || {}).ad || g.grup_kod;
                return `<span class="rz ${g.yazma ? 'rz-yesil' : 'rz-gri'}">${U.esc(ad)}${g.yazma ? ' ✎' : ''}</span>`;
              }).join(' ') || '<span class="rz rz-kirmizi">hiçbiri</span>' },
          { baslik: 'Yetki', sinif: 'num', deger: k => k.yonetici ? '—' : API.kullaniciYetkileri(k.kullanici_adi).length + ' / ' + window.YETKILER.length },
          { baslik: 'Durum', deger: k => k.aktif ? '<span class="rz rz-yesil">Etkin</span>' : '<span class="rz rz-gri">Devre dışı</span>' },
          { baslik: 'Son Giriş', deger: k => k.son_giris ? U.tarihGoster(k.son_giris) + ' ' + k.son_giris.slice(11, 16) : '—' },
          { baslik: '', sinif: 'sag-hiza', deger: k => `<button class="btn btn-ikincil btn-kucuk" data-duzenle="${U.esc(k.kullanici_adi)}">Düzenle</button>
              ${k.kullanici_adi !== ben.kullanici_adi ? `<button class="ikon-btn satir-sil" data-sil="${U.esc(k.kullanici_adi)}">🗑</button>` : ''}` },
        ], liste)}
      </div>`;

    U.el('yeniBtn').onclick = () => form(null);
    kap.addEventListener('click', async e => {
      let b;
      if ((b = e.target.closest('[data-duzenle]'))) return form(liste.find(k => k.kullanici_adi === b.getAttribute('data-duzenle')));
      if ((b = e.target.closest('[data-sil]'))) {
        const ka = b.getAttribute('data-sil');
        if (!(await C.onay({ baslik: 'Kullanıcıyı Sil', mesaj: `<strong>${U.esc(ka)}</strong> silinecek.`, evetYazi: 'Sil', tehlike: true }))) return;
        try { API.kullaniciSil(ka); APP.tazele(); } catch (err) { U.bildir(err.message, 'hata'); }
      }
    });
  }

  function form(k) {
    const yeni = !k;
    const gruplar = API.grupListe();
    const gYetki = yeni ? [] : API.kullaniciGruplari(k.kullanici_adi);
    const yetkiler = yeni ? ['ozet.oku', 'personel.oku', 'zam.oku', 'parametre.oku'] : API.kullaniciYetkileri(k.kullanici_adi);
    const kip = C.kipAc({
      baslik: yeni ? 'Yeni Kullanıcı' : k.ad_soyad, altBaslik: yeni ? null : k.kullanici_adi,
      genislik: 'genis',
      govde: `<div class="izgara izgara-3">
          <div class="alan"><label>Kullanıcı Adı</label><input name="kullanici_adi" class="mono" value="${U.esc(yeni ? '' : k.kullanici_adi)}" ${yeni ? '' : 'disabled'}></div>
          <div class="alan"><label>Ad Soyad</label><input name="ad_soyad" value="${U.esc(yeni ? '' : k.ad_soyad)}"></div>
          <div class="alan"><label>${yeni ? 'Parola' : 'Yeni Parola'}</label><input name="parola" type="password" autocomplete="new-password"
               placeholder="${yeni ? 'en az 6 karakter' : 'değişmeyecekse boş bırakın'}"></div>
        </div>
        <div class="satir">
          <label><input type="checkbox" name="yonetici" ${!yeni && k.yonetici ? 'checked' : ''}> Sistem yöneticisi (her şeyi görür, yetki atar)</label>
          ${yeni ? '' : `<label><input type="checkbox" name="aktif" ${k.aktif ? 'checked' : ''}> Etkin</label>`}
        </div>
        <div id="erisim">
          <h3 class="ust-bosluk">Grup Erişimi</h3>
          <table class="genis-tablo"><thead><tr><th>Grup</th><th>Göremez</th><th>Görür</th><th>Görür ve düzenler</th></tr></thead>
            <tbody>${gruplar.map(g => { const v = gYetki.find(x => x.grup_kod === g.kod); const d = !v ? 0 : v.yazma ? 2 : 1;
              return `<tr><td class="kalin">${U.esc(g.ad)}</td>${[0, 1, 2].map(i =>
                `<td class="orta-hiza"><input type="radio" name="grup_${g.kod}" value="${i}" ${d === i ? 'checked' : ''}></td>`).join('')}</tr>`; }).join('')}
            </tbody></table>
          <h3 class="ust-bosluk">Yetkiler</h3>
          <div class="izgara izgara-2">${window.YETKILER.map(y => `<label class="satir kucuk">
              <input type="checkbox" data-yetki="${y[0]}" ${yetkiler.indexOf(y[0]) >= 0 ? 'checked' : ''}>
              <span><span class="mono">${U.esc(y[0])}</span> — ${U.esc(y[1])}</span></label>`).join('')}</div>
          <div class="kucuk soluk ust-bosluk">"Düzenler" yetkisi olan grupta bile işlem yapabilmek için ilgili yetki
            (örn. personel.yaz, zam.yaz) ayrıca işaretli olmalıdır.</div>
        </div>`,
      altlik: `<button class="btn btn-ikincil" data-kip-kapat>Vazgeç</button><button class="btn" data-kaydet>Kaydet</button>`,
    });
    const yon = kip.querySelector('[name=yonetici]');
    const goster = () => { U.el('erisim').style.opacity = yon.checked ? 0.4 : 1; };
    yon.onchange = goster; goster();

    kip.querySelector('[data-kaydet]').onclick = () => {
      const f = C.formOku(kip);
      try {
        let ka = yeni ? null : k.kullanici_adi;
        if (yeni) ka = API.kullaniciEkle(f.kullanici_adi, f.ad_soyad, f.parola, f.yonetici);
        else {
          API.kullaniciGuncelle(ka, f.ad_soyad, f.yonetici, f.aktif);
          if (f.parola) API.parolaDegistir(ka, f.parola);
        }
        // Radyo düğmeleri C.formOku ile okunamaz (son seçeneğin değerini döndürür)
        const secili = kod => { const r = kip.querySelector(`[name="grup_${kod}"]:checked`); return r ? Number(r.value) : 0; };
        const g = gruplar.map(x => ({ grup_kod: x.kod, d: secili(x.kod) }))
                         .filter(x => x.d > 0).map(x => ({ grup_kod: x.grup_kod, yazma: x.d === 2 }));
        const y = [...kip.querySelectorAll('[data-yetki]')].filter(i => i.checked).map(i => i.getAttribute('data-yetki'));
        API.kullaniciErisimYaz(ka, y, g);
        C.kipKapat();
        U.bildir('Kullanıcı kaydedildi.', 'basari');
        APP.tazele();
      } catch (e) { U.bildir(e.message, 'hata'); }
    };
  }

  APP.modulKaydet({
    id: 'kullanici', ad: 'Kullanıcılar', ikon: '🔑', grup: 'Yönetim',
    baslik: 'Kullanıcılar ve Yetkiler', altBaslik: 'Grup erişimi ve yetkiler kullanıcı bazında',
    yetki: 'sistem.yonet', ciz: ciz,
  });
})();
