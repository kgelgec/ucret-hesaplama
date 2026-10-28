/* =====================================================================
   ORTAK ARAYÜZ BİLEŞENLERİ
   Modüllerin paylaştığı kip (modal), tablo, form ve seçim yardımcıları.
   ===================================================================== */
window.C = (function () {
  'use strict';

  /* ---------------- Kip (modal) ---------------- */
  let kipYigin = [];

  function kipAc(secenek) {
    const { baslik, altBaslik, govde, altlik, genislik, acilinca } = secenek;
    const kap = document.createElement('div');
    kap.className = 'kip-perde';
    kap.innerHTML = `
      <div class="kip ${genislik || ''}">
        <div class="kip-ust">
          <div>
            <h2>${U.esc(baslik)}</h2>
            ${altBaslik ? `<div class="kucuk soluk">${U.esc(altBaslik)}</div>` : ''}
          </div>
          <button class="kapat" data-kip-kapat title="Kapat">&times;</button>
        </div>
        <div class="kip-govde">${govde || ''}</div>
        ${altlik ? `<div class="kip-alt">${altlik}</div>` : ''}
      </div>`;
    document.getElementById('kipKap').appendChild(kap);
    kipYigin.push(kap);

    /* Kapatma: arka perdeye ya da [data-kip-kapat] taşıyan bir öğeye
       tıklanması yeterli. closest() kullanılır; düğmenin içindeki
       simgeye/metne denk gelen tıklamalar da yakalanır. */
    kap.addEventListener('click', e => {
      if (e.target === kap || e.target.closest('[data-kip-kapat]')) {
        e.preventDefault();
        kipKapatBu(kap);
      }
    });
    if (typeof acilinca === 'function') acilinca(kap);
    const ilk = kap.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
    if (ilk) setTimeout(() => ilk.focus(), 40);
    return kap;
  }

  /* CANLI ARAMA — Excel'in süzgeci gibi: ad yazıldıkça liste daralır, silinince tam liste gelir.
     Yazdıkça kısa bir beklemeyle süzer (hızlı yazarken her harfte çizmesin); silince tam liste
     gelir; Esc temizler. Ekran yeniden çizildiğinde kutu odakta, imleç yerinde ve sayfa kaydırması korunur.
     ayarla(deger): modülün arama durumunu günceller. */
  function canliArama(id, ayarla, gecikme) {
    const inp = document.getElementById(id);
    if (!inp) return;
    let z = null;
    const uygula = () => {
      const v = inp.value, p = inp.selectionStart, sy = window.scrollY;
      ayarla(v);
      APP.tazele();
      window.scrollTo(0, sy);
      const y = document.getElementById(id);
      if (y) { y.focus(); try { y.setSelectionRange(p, p); } catch (e) { } }
    };
    inp.addEventListener('input', () => { clearTimeout(z); z = setTimeout(uygula, inp.value === '' ? 0 : (gecikme == null ? 200 : gecikme)); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { clearTimeout(z); uygula(); }
      if (e.key === 'Escape' && inp.value) { inp.value = ''; clearTimeout(z); uygula(); }
    });
  }

  function kipKapat() {
    const k = kipYigin.pop();
    if (k) k.remove();
  }

  /* Belirli bir pencereyi kapatır — yığının en üstünde olmasa bile
     doğru olanı kaldırır. */
  function kipKapatBu(kap) {
    const i = kipYigin.indexOf(kap);
    if (i >= 0) kipYigin.splice(i, 1);
    kap.remove();
  }

  function kipHepsiniKapat() { while (kipYigin.length) kipYigin.pop().remove(); }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && kipYigin.length) kipKapat();
  });

  /* Onay kutusu — geri dönüşü olmayan işlemler için */
  function onay(secenek) {
    return new Promise(resolve => {
      const kap = kipAc({
        baslik: secenek.baslik || 'Onay',
        genislik: 'dar',
        govde: `<div style="font-size:13.5px;">${secenek.mesaj || ''}</div>` +
               (secenek.detay ? `<div class="uyari uyari-dikkat ust-bosluk">
                                   <span class="ik">⚠</span><div>${secenek.detay}</div></div>` : ''),
        altlik: `<button class="btn btn-ikincil" data-hayir>${U.esc(secenek.hayirYazi || 'Vazgeç')}</button>
                 <button class="btn ${secenek.tehlike ? 'btn-tehlike' : ''}" data-evet>
                   ${U.esc(secenek.evetYazi || 'Onayla')}</button>`,
      });
      kap.querySelector('[data-evet]').onclick = () => { kipKapat(); resolve(true); };
      kap.querySelector('[data-hayir]').onclick = () => { kipKapat(); resolve(false); };
      kap.addEventListener('click', e => { if (e.target === kap) resolve(false); });
    });
  }

  /* Basit metin girişi kutusu */
  function metinSor(secenek) {
    return new Promise(resolve => {
      const kap = kipAc({
        baslik: secenek.baslik || 'Değer girin',
        genislik: 'dar',
        govde: `<div class="alan">
                  <label>${U.esc(secenek.etiket || '')}</label>
                  <input id="__metinSor" value="${U.esc(secenek.deger || '')}"
                         placeholder="${U.esc(secenek.ipucu || '')}">
                </div>`,
        altlik: `<button class="btn btn-ikincil" data-hayir>Vazgeç</button>
                 <button class="btn" data-evet>Tamam</button>`,
      });
      const gir = kap.querySelector('#__metinSor');
      const tamam = () => { const v = gir.value; kipKapat(); resolve(v); };
      kap.querySelector('[data-evet]').onclick = tamam;
      kap.querySelector('[data-hayir]').onclick = () => { kipKapat(); resolve(null); };
      gir.addEventListener('keydown', e => { if (e.key === 'Enter') tamam(); });
    });
  }

  /* ---------------- Form yardımcıları ---------------- */

  // <option> listesi üretir
  function secenekler(liste, secili, bosEtiket) {
    let h = '';
    if (bosEtiket !== undefined && bosEtiket !== null)
      h += `<option value="">${U.esc(bosEtiket)}</option>`;
    (liste || []).forEach(o => {
      const deger = typeof o === 'object' ? o.deger : o;
      const etiket = typeof o === 'object' ? o.etiket : o;
      h += `<option value="${U.esc(deger)}"${String(deger) === String(secili == null ? '' : secili) ? ' selected' : ''}>${U.esc(etiket)}</option>`;
    });
    return h;
  }

  /* ---------------- Aramalı seçim ----------------
     Binlerce seçeneği olan listeler (örn. SGK meslek kodları) için
     açılır kutu kullanılamaz. Bu bileşen yazdıkça süzer; hem koda
     hem karşılığındaki ada bakar.

     secenekler: [{ deger, ek }]  — ek isteğe bağlı açıklama/ad
     Gerçek değer gizli <input name="..."> içinde tutulur; formOku
     onu diğer alanlar gibi okur. */

  function asGosterim(o) {
    if (!o) return '';
    return o.ek ? o.deger + ' — ' + o.ek : String(o.deger);
  }

  function aramaliSecim(ad, secenekler, secili, secenek) {
    secenek = secenek || {};
    const s = (secenekler || []).find(
      o => String(o.deger) === String(secili == null ? '' : secili));
    return `
      <div class="alan arama-secim" data-arama-secim="${U.esc(ad)}">
        <label>${secenek.etiket || ''}</label>
        <input type="text" class="as-arama" autocomplete="off" spellcheck="false"
               placeholder="${U.esc(secenek.ipucu || 'Yazarak arayın…')}"
               value="${U.esc(s ? asGosterim(s) : (secili || ''))}">
        <input type="hidden" name="${U.esc(ad)}" value="${U.esc(secili == null ? '' : secili)}">
        <div class="as-liste gizli"></div>
        ${secenek.not ? `<div class="alan-not">${secenek.not}</div>` : ''}
      </div>`;
  }

  const AS_LISTE_SINIR = 300;   // aynı anda çizilen en fazla satır

  function aramaliSecimBagla(kok, ad, secenekler, secildi) {
    const kap = kok.querySelector(`[data-arama-secim="${ad}"]`);
    if (!kap) return;
    const arama = kap.querySelector('.as-arama');
    const gizli = kap.querySelector('input[type=hidden]');
    const liste = kap.querySelector('.as-liste');

    /* Arama anahtarı bir kez hesaplanır; her tuş vuruşunda binlerce
       kaydı yeniden normalleştirmek gereksiz yavaşlatır. */
    const hazir = (secenekler || []).map(o => Object.assign({}, o, {
      _anahtar: U.normalize(String(o.deger) + ' ' + (o.ek || '')),
    }));

    let suzulmus = [], vurgu = -1, acik = false;

    function suz(q) {
      const qn = U.normalize(q);
      if (!qn) return hazir.slice(0, AS_LISTE_SINIR);
      return hazir.filter(o => o._anahtar.includes(qn)).slice(0, AS_LISTE_SINIR);
    }

    function ac(q) {
      suzulmus = suz(q === undefined ? '' : q);
      vurgu = -1;
      liste.innerHTML = suzulmus.length
        ? suzulmus.map((o, i) => `
            <div class="as-satir" data-i="${i}">
              <span class="as-kod">${U.esc(o.deger)}</span>
              ${o.ek ? `<span class="as-ad">${U.esc(o.ek)}</span>` : ''}
            </div>`).join('') +
          (suzulmus.length >= AS_LISTE_SINIR
            ? `<div class="as-bos">İlk ${AS_LISTE_SINIR} sonuç — daraltmak için yazmaya devam edin.</div>`
            : '')
        : '<div class="as-bos">Eşleşen kayıt yok.</div>';
      liste.classList.remove('gizli');
      acik = true;
    }

    function kapat() { liste.classList.add('gizli'); acik = false; vurgu = -1; }

    function sec(o) {
      gizli.value = o ? o.deger : '';
      arama.value = o ? asGosterim(o) : '';
      kapat();
      if (secildi) secildi(o || null);
    }

    function vurguyuTasi(yon) {
      if (!acik || !suzulmus.length) return;
      vurgu = (vurgu + yon + suzulmus.length) % suzulmus.length;
      liste.querySelectorAll('.as-satir').forEach((e, i) =>
        e.classList.toggle('etkin', i === vurgu));
      const etkin = liste.querySelector('.as-satir.etkin');
      if (etkin) etkin.scrollIntoView({ block: 'nearest' });
    }

    arama.addEventListener('focus', () => ac(arama.value === asGosterim(
      hazir.find(o => String(o.deger) === gizli.value)) ? '' : arama.value));
    arama.addEventListener('input', () => {
      // Yazmaya başlayınca önceki seçim düşer; boş bırakılırsa temizlenir
      gizli.value = '';
      ac(arama.value);
    });
    arama.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!acik) ac(arama.value); else vurguyuTasi(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); vurguyuTasi(-1); }
      else if (e.key === 'Enter') {
        if (!acik) return;
        e.preventDefault();
        sec(suzulmus[vurgu >= 0 ? vurgu : 0] || null);
      } else if (e.key === 'Escape' && acik) { e.preventDefault(); e.stopPropagation(); kapat(); }
    });

    /* mousedown kullanılır: blur'dan önce çalışır, aksi hâlde liste
       tıklama kaydedilmeden kapanırdı. */
    liste.addEventListener('mousedown', e => {
      const s = e.target.closest('[data-i]');
      if (!s) return;
      e.preventDefault();
      sec(suzulmus[Number(s.getAttribute('data-i'))]);
    });

    arama.addEventListener('blur', () => {
      setTimeout(() => {
        kapat();
        // Yazılan metin bir seçime karşılık gelmiyorsa eski hâline döner
        if (!gizli.value) { if (arama.value.trim()) arama.value = ''; return; }
        const o = hazir.find(x => String(x.deger) === gizli.value);
        arama.value = asGosterim(o);
      }, 120);
    });
  }

  function yilSecenekleri(secili, baslangic, bitis) {
    const bugunYil = new Date().getFullYear();
    const b = baslangic || bugunYil - 3, s = bitis || bugunYil + 3;
    const l = []; for (let y = b; y <= s; y++) l.push(y);
    return secenekler(l, secili);
  }

  function aySecenekleri(secili) {
    return secenekler(U.AYLAR.map((a, i) => ({ deger: i + 1, etiket: a })), secili);
  }

  // Bir formdaki tüm [name] alanlarını nesne olarak toplar
  function formOku(kok) {
    const veri = {};
    kok.querySelectorAll('[name]').forEach(e => {
      if (e.type === 'checkbox') veri[e.name] = e.checked;
      else veri[e.name] = e.value;
    });
    return veri;
  }

  function alanHatasi(kok, ad, mesaj) {
    const e = kok.querySelector(`[name="${ad}"]`);
    if (!e) return;
    e.classList.add('hatali');
    let n = e.parentNode.querySelector('.alan-hata');
    if (!n) { n = document.createElement('div'); n.className = 'alan-hata'; e.parentNode.appendChild(n); }
    n.textContent = mesaj;
    e.addEventListener('input', () => {
      e.classList.remove('hatali');
      if (n) n.textContent = '';
    }, { once: true });
  }

  function hatalariTemizle(kok) {
    kok.querySelectorAll('.hatali').forEach(e => e.classList.remove('hatali'));
    kok.querySelectorAll('.alan-hata').forEach(e => e.textContent = '');
  }

  /* ---------------- Tablo ---------------- */

  /* kolonlar: [{ baslik, alan?, deger?(satir), sinif?, genislik? }] */
  function tablo(kolonlar, satirlar, secenek) {
    secenek = secenek || {};
    if (!satirlar.length) {
      return `<div class="tablo-sar"><div class="tablo-bos">${U.esc(secenek.bosMesaj || 'Kayıt bulunamadı.')}</div></div>`;
    }
    const bas = kolonlar.map(k =>
      `<th class="${k.sinif || ''}"${k.genislik ? ` style="width:${k.genislik}"` : ''}>${U.esc(k.baslik)}</th>`).join('');
    const govde = satirlar.map((s, i) => {
      const hucre = kolonlar.map(k => {
        const icerik = k.deger ? k.deger(s, i) : U.esc(s[k.alan] == null ? '' : s[k.alan]);
        return `<td class="${k.sinif || ''}">${icerik}</td>`;
      }).join('');
      const sinif = secenek.satirSinif ? secenek.satirSinif(s) : '';
      const nitelik = secenek.satirNitelik ? secenek.satirNitelik(s) : '';
      return `<tr class="${sinif}" ${nitelik}>${hucre}</tr>`;
    }).join('');
    /* tabloSinif: tabloya özel davranış eklemek için (örn. ilk kolonu
       yatay kaydırmada sabitleyen "yapiskan-ilk"). */
    const tSinif = secenek.tabloSinif ? ` class="${secenek.tabloSinif}"` : '';
    return `<div class="tablo-sar"><table${tSinif}><thead><tr>${bas}</tr></thead><tbody>${govde}</tbody></table></div>`;
  }

  /* ---------------- Rozetler ---------------- */
  function durumRozet(durum) {
    return durum === 'AKTIF'
      ? '<span class="rz rz-yesil">Aktif</span>'
      : '<span class="rz rz-gri">Ayrıldı</span>';
  }

  /* EVET / HAYIR / YOK döngü düğmesi */
  const EHY_SIRA = ['', 'EVET', 'HAYIR', 'YOK'];

  // Bir sonraki değeri verir; tabloda yerinde güncelleme yapan
  // modüller de aynı sırayı kullansın diye dışarı açılır.
  function ehySonraki(deger) {
    return EHY_SIRA[(EHY_SIRA.indexOf(deger || '') + 1) % EHY_SIRA.length];
  }

  function ehyDugme(kod, deger) {
    const d = deger || '';
    const sinif = d === 'EVET' ? 'evet' : d === 'HAYIR' ? 'hayir' : d === 'YOK' ? 'yok' : 'bos';
    return `<button type="button" class="ehy ${sinif}" data-ehy="${U.esc(kod)}" data-deger="${U.esc(d)}">${d || '—'}</button>`;
  }

  function ehyBagla(kok) {
    kok.addEventListener('click', e => {
      const b = e.target.closest('[data-ehy]');
      if (!b) return;
      e.preventDefault();
      ehyDugmeyiAyarla(b, ehySonraki(b.getAttribute('data-deger')));
    });
  }

  /* Bir EHY düğmesinin görünümünü ve değerini yerinde günceller */
  function ehyDugmeyiAyarla(b, deger) {
    const d = deger || '';
    b.setAttribute('data-deger', d);
    b.textContent = d || '—';
    b.className = 'ehy ' + (d === 'EVET' ? 'evet' : d === 'HAYIR' ? 'hayir' : d === 'YOK' ? 'yok' : 'bos');
  }

  function ehyOku(kok) {
    const o = {};
    kok.querySelectorAll('[data-ehy]').forEach(b => {
      o[b.getAttribute('data-ehy')] = b.getAttribute('data-deger') || '';
    });
    return o;
  }

  function ehyRozet(deger) {
    if (!deger) return '<span class="cok-soluk">—</span>';
    const s = deger === 'EVET' ? 'rz-ehy-evet' : deger === 'HAYIR' ? 'rz-ehy-hayir' : 'rz-ehy-yok';
    return `<span class="rz ${s}">${U.esc(deger)}</span>`;
  }

  /* ---------------- Personel seçici ----------------
     T.C. No ya da isimle arayıp personel seçtirir. Sistemdeki tüm
     modüller aynı seçiciyi kullanır, böylece kayıtlar hep aynı
     personel kartına bağlanır. */
  function personelSecici(id, seciliTc, secenek) {
    secenek = secenek || {};
    const p = seciliTc ? API.personelGetir(seciliTc) : null;
    return `
      <div class="alan" data-personel-secici="${id}">
        <label>${U.esc(secenek.etiket || 'Personel')} <span class="zorunlu">*</span>
          <span class="ipucu">— T.C. No veya ad ile arayın</span></label>
        <input type="text" id="${id}_arama" placeholder="T.C. Kimlik No veya Ad Soyad"
               autocomplete="off" value="${p ? U.esc(p.ad_soyad + ' — ' + p.tc_kimlik_no) : ''}">
        <input type="hidden" name="${secenek.ad || 'tc_kimlik_no'}" id="${id}_tc" value="${U.esc(seciliTc || '')}">
        <div id="${id}_sonuc" class="kucuk" style="margin-top:5px;"></div>
      </div>`;
  }

  function personelSeciciBagla(kok, id, secildi) {
    const arama = kok.querySelector('#' + id + '_arama');
    const gizli = kok.querySelector('#' + id + '_tc');
    const sonuc = kok.querySelector('#' + id + '_sonuc');
    if (!arama) return;

    function temizle() { gizli.value = ''; if (secildi) secildi(null); }

    arama.addEventListener('input', () => {
      const q = arama.value.trim();
      temizle();
      if (q.length < 2) { sonuc.innerHTML = ''; return; }
      const bulunan = API.personelListe({ arama: q }).slice(0, 8);
      if (!bulunan.length) {
        sonuc.innerHTML = '<span style="color:var(--danger)">Personel bulunamadı. ' +
                          'Önce Personel modülünden kartını oluşturun.</span>';
        return;
      }
      sonuc.innerHTML = bulunan.map(b => `
        <button type="button" class="btn btn-ikincil btn-kucuk" style="margin:2px 3px 0 0;"
                data-sec-tc="${U.esc(b.tc_kimlik_no)}">
          ${U.esc(b.ad_soyad)} · ${U.esc(U.tcMaskele(b.tc_kimlik_no))}
          ${b.durum === 'AYRILDI' ? ' (ayrıldı)' : ''}
        </button>`).join('');
    });

    sonuc.addEventListener('click', e => {
      const b = e.target.closest('[data-sec-tc]');
      if (!b) return;
      const tc = b.getAttribute('data-sec-tc');
      const p = API.personelGetir(tc);
      gizli.value = tc;
      arama.value = p.ad_soyad + ' — ' + p.tc_kimlik_no;
      sonuc.innerHTML = `<span style="color:var(--green)">✓ ${U.esc(p.ad_soyad)} seçildi</span>`;
      if (secildi) secildi(p);
    });
  }

  /* ---------------- Sayfalama ---------------- */
  function sayfala(satirlar, sayfa, boyut) {
    const toplam = Math.max(1, Math.ceil(satirlar.length / boyut));
    const s = Math.min(Math.max(1, sayfa), toplam);
    return { satirlar: satirlar.slice((s - 1) * boyut, s * boyut), sayfa: s, toplamSayfa: toplam,
             toplamKayit: satirlar.length };
  }

  function sayfalamaCubugu(bilgi, id) {
    if (bilgi.toplamSayfa <= 1)
      return `<div class="kucuk soluk ust-bosluk">${U.sayi(bilgi.toplamKayit)} kayıt</div>`;
    return `<div class="satir ust-bosluk">
        <span class="kucuk soluk">${U.sayi(bilgi.toplamKayit)} kayıt · sayfa ${bilgi.sayfa}/${bilgi.toplamSayfa}</span>
        <span class="buyu"></span>
        <button class="btn btn-ikincil btn-kucuk" data-sayfa="${id}:${bilgi.sayfa - 1}"
                ${bilgi.sayfa <= 1 ? 'disabled' : ''}>‹ Önceki</button>
        <button class="btn btn-ikincil btn-kucuk" data-sayfa="${id}:${bilgi.sayfa + 1}"
                ${bilgi.sayfa >= bilgi.toplamSayfa ? 'disabled' : ''}>Sonraki ›</button>
      </div>`;
  }

  /* ---------------- Tablo üstü yatay kaydırma çubuğu ----------------
     Uzun tablolarda sağa kaydırmak için sayfanın dibine inmek gerekiyordu.
     Her .tablo-sar kutusunun üstüne ikinci bir yatay çubuk eklenir ve iki
     çubuk karşılıklı eşitlenir.

     Neden MutationObserver: tablolar modüllerde, kiplerde ve panelde ayrı
     ayrı üretiliyor. Her çizim yerine tek tek çağrı eklemek yerine DOM
     izlenir; böylece sonradan yazılan modüller de bu davranışı kendiliğinden
     alır. */
  function ustKaydirmaBagla(sar) {
    if (!sar || sar.dataset.ustCubuk) return;
    sar.dataset.ustCubuk = '1';

    const cubuk = document.createElement('div');
    cubuk.className = 'tablo-ust-cubuk';
    const ic = document.createElement('div');
    cubuk.appendChild(ic);
    sar.parentNode.insertBefore(cubuk, sar);

    const guncelle = () => {
      const tasiyor = sar.scrollWidth - sar.clientWidth > 1;
      cubuk.style.display = tasiyor ? 'block' : 'none';
      ic.style.width = sar.scrollWidth + 'px';
    };

    /* Karşılıklı eşitleme sonsuz döngüye girmesin diye tek kilit yeter. */
    let kilit = false;
    const bagla = (a, b) => {
      a.addEventListener('scroll', () => {
        if (kilit) return;
        kilit = true;
        b.scrollLeft = a.scrollLeft;
        kilit = false;
      });
    };
    bagla(cubuk, sar);
    bagla(sar, cubuk);

    guncelle();
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(guncelle);
      ro.observe(sar);
      const tbl = sar.querySelector('table');
      if (tbl) ro.observe(tbl);
    } else {
      setTimeout(guncelle, 120);
    }
  }

  /* Verilen kökün altındaki bütün tabloları tarar. */
  function ustKaydirmaTara(kok) {
    (kok || document).querySelectorAll('.tablo-sar').forEach(ustKaydirmaBagla);
  }

  function ustKaydirmaIzle() {
    ustKaydirmaTara(document);
    if (!window.MutationObserver) return;
    new MutationObserver(kayitlar => {
      for (const k of kayitlar) {
        for (const d of k.addedNodes) {
          if (d.nodeType !== 1) continue;
          if (d.classList && d.classList.contains('tablo-sar')) ustKaydirmaBagla(d);
          else ustKaydirmaTara(d);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ustKaydirmaIzle);
  } else {
    ustKaydirmaIzle();
  }


  return {
    kipAc, kipKapat, kipKapatBu, kipHepsiniKapat, onay, metinSor, canliArama,
    secenekler, yilSecenekleri, aySecenekleri,
    aramaliSecim, aramaliSecimBagla,
    formOku, alanHatasi, hatalariTemizle,
    tablo, durumRozet,
    ehyDugme, ehyBagla, ehyOku, ehyRozet, ehySonraki, ehyDugmeyiAyarla,
    personelSecici, personelSeciciBagla,
    sayfala, sayfalamaCubugu,
    ustKaydirmaBagla, ustKaydirmaTara,
  };
})();
