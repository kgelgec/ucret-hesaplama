/* =====================================================================
   PERSONEL VE ZAM — kişi bazında bütçe satırları

   Her satır bir kişinin bütçe satırıdır: önceki yıl net maaşı, zam
   öngörüsü (kademe / performans), yönetimin düzeltmesi ve sonuçta
   yeni yıl maaşı ile yıllık maliyet.
   Düzeltme hücresine doğrudan yazılır (Enter ya da hücreden çıkış).
   ===================================================================== */
(function () {
  'use strict';

  let arama = '', bolumSuz = '', yakaSuz = '', sekme = 'zam';

  /* Onaylı çalışma onay anındaki çıkış tarihiyle hesaplanır; kartta sonradan
     değişen tarih ayrıca gösterilir (onaylı maliyete girmez). */
  /* Üst özet kutuları — zam çalışmasının toplu görünümü. Süzgeçten bağımsız: çalışmanın tamamını gösterir;
     düzeltme girildikçe anında değişir. Tutarlar net maaş ve yıllık maliyettir. */
  function ozetKutulari(c, kisiler) {
    const O = c.yil - 1, Y = c.yil;
    const top = f => kisiler.reduce((a, s) => a + (Number(f(s)) || 0), 0);
    const eski = top(s => s.zam.eski), yeni = top(s => s.zam.yeni), mal = top(s => s.yil.maliyet);
    const onceki = top(s => s.kp.maliyet_onceki), duzKisi = kisiler.filter(s => Number(s.kp.duzeltme)).length;
    const duzTop = top(s => s.kp.duzeltme);
    const oran = (a, b) => b ? B.oran(a / b) : '—';
    return `<div class="izgara izgara-4" style="margin-bottom:12px">
        <div class="stat"><div class="deger">${B.tlDuz(mal)}</div><div class="etiket">${Y} toplam maliyet</div>
          <div class="ek">${kisiler.length} kişi · zam oranı ${oran(yeni - eski, eski)}</div></div>
        <div class="stat altin"><div class="deger">${onceki ? B.isaretli(mal - onceki) : '—'}</div><div class="etiket">Maliyet farkı (${Y} − ${O})</div>
          <div class="ek">${onceki ? O + ' maliyeti ' + B.tlDuz(onceki) + ' · ' + oran(mal - onceki, onceki) : O + ' maliyeti girilmemiş'}</div></div>
        <div class="stat yesil"><div class="deger">${B.isaretli(yeni - eski)}</div><div class="etiket">Aylık net maaş artışı</div>
          <div class="ek">${O}: ${B.tlDuz(eski)} → ${Y}: ${B.tlDuz(yeni)}</div></div>
        <div class="stat mor"><div class="deger">${duzKisi} / ${kisiler.length}</div><div class="etiket">Düzeltme yapılan kişi</div>
          <div class="ek">${duzKisi ? 'Toplam düzeltme ' + B.isaretli(duzTop) + ' (aylık net)' : 'Düzeltme girilmedi'}</div></div>
      </div>`;
  }

  function cikisHtml(kp, rozet) {
    const hesap = kp.onay_sabit ? kp.onay_cikis : kp.isten_ayrilis;
    let h = hesap ? (rozet ? ' <span class="rz rz-gri">çıkış ' + U.tarihGoster(hesap) + '</span>' : U.tarihGoster(hesap)) : '';
    if (kp.onay_sabit === 1 && (kp.isten_ayrilis || null) !== (kp.onay_cikis || null)) {
      const t = kp.isten_ayrilis ? 'sonradan çıkış ' + U.tarihGoster(kp.isten_ayrilis) : 'çıkış sonradan silindi';
      h += ' <span class="rz rz-sari" title="Personel kartında onaydan sonra değişti; onaylı maliyete girmez">' + t + '</span>';
    }
    return h;
  }

  /* ------------------------------------------------------------------
     SEKMELER
       zam      — önceki yıl maaşı, öngörü, DÜZELTME, yeni maaş, maliyet
       kisi     — hesaplamayı belirleyen kişi bilgileri
     Sütun tanımı: { b: başlık, g: renk grubu, v: hücre, t: toplam (sayı),
     tHtml: toplam hücresi (oran gibi toplanamayanlar) }
     Renk grupları (butce.css): eski=yeşil, ong=gri, duz=sarı, zam=pembe,
     yeni=mavi, mal=lacivert.
     ------------------------------------------------------------------ */
  function sutunlar(c, sekmeKod, yetki) {
    const O = c.yil - 1, Y = c.yil;
    const yuzde = x => B.oran(x);
    if (sekmeKod === 'zam') return [
      { b: O + ' Maaş', g: 'eski', v: s => B.tl(s.zam.eski), t: s => s.zam.eski },
      { b: 'Zam Oranı Öng.', g: 'ong', v: s => yuzde(s.zam.oranOngoru) },
      { b: 'Zam Miktarı Öng.', g: 'ong', v: s => B.tl(s.zam.ongoru), t: s => s.zam.ongoru },
      { b: 'Zamlı Maaş Öng.', g: 'ong', v: s => B.tl(s.zam.eski + s.zam.ongoru), t: s => s.zam.eski + s.zam.ongoru },
      { b: 'Düzeltme', g: 'duz', v: s => yetki.zYaz
          ? `<input class="hucre-girdi" data-duz="${U.esc(s.kp.tc_kimlik_no)}" value="${s.kp.duzeltme ? B.tlDuz(s.kp.duzeltme) : ''}">`
          : B.isaretli(s.kp.duzeltme), t: s => s.kp.duzeltme || 0 },
      { b: Y + ' Zam Miktarı', g: 'zam', v: s => '<strong>' + B.tl(s.zam.miktar) + '</strong>', t: s => s.zam.miktar },
      { b: Y + ' Maaş', g: 'yeni', v: s => '<strong>' + B.tl(s.zam.yeni) + '</strong>', t: s => s.zam.yeni },
      { b: Y + ' Zam Oranı', g: 'yeni', v: s => yuzde(s.zam.oran), tHtml: T => yuzde(T[0] ? T[5] / T[0] : 0) },
      { b: Y + ' Toplam Maliyet', g: 'mal', v: s => B.tl(s.yil.maliyet), t: s => s.yil.maliyet },
      { b: O + ' Toplam Maliyet', g: 'mal', v: s => B.tl(s.kp.maliyet_onceki), t: s => s.kp.maliyet_onceki || 0 },
      { b: 'Fark', g: 'mal', v: s => B.isaretli(s.yil.maliyet - (s.kp.maliyet_onceki || 0)), tHtml: T => B.isaretli(T[8] - T[9]) },
    ];
    // Kişi bilgileri
    const turAd = {}; API.hesapTuruListe(c.yil).forEach(t => { turAd[t.kod] = t.ad; });
    const kanunAd = {}; API.kanunListe().forEach(k => { kanunAd[k.kod] = k.ad; });
    return [
      { b: 'Yaka', v: s => s.kp.yaka === 'M' ? '<span class="rz rz-mavi">Mavi</span>' : '<span class="rz rz-gri">Beyaz</span>' },
      { b: 'İşe Giriş', v: s => U.tarihGoster(s.kp.ise_giris) },
      { b: 'Çıkış', v: s => cikisHtml(s.kp, false) },
      { b: 'Hesaplama Türü', v: s => '<span class="kucuk">' + U.esc(turAd[s.kp.hesap_turu] || s.kp.hesap_turu || '—') + '</span>' },
      { b: 'Kanun', v: s => '<span class="kucuk">' + U.esc(s.kp.kanun && s.kp.kanun !== 'YOK' ? (kanunAd[s.kp.kanun] || s.kp.kanun) : '—') + '</span>' },
      { b: 'AR-GE GV Teşvik', v: s => s.kp.gv_tesvik ? yuzde(s.kp.gv_tesvik) : '' },
      { b: 'Sakatlık', v: s => s.kp.sakatlik_derece ? s.kp.sakatlik_derece + '. derece' : '' },
      { b: 'BES', v: s => s.kp.bes === 'EVET' ? 'Katılıyor' : s.kp.bes === 'HAYIR' ? 'Katılmıyor' : '' },
      { b: 'Zam Ayı', v: s => U.AYLAR[(s.kp.zam_ayi || 1) - 1] },
      { b: 'Performans Puanı', v: s => s.kp.performans_puani == null ? '' : B.tlDuz(s.kp.performans_puani, 1) },
      { b: 'Performans Çarpanı', v: s => s.kp.performans_carpani == null ? '' : B.tlDuz(s.kp.performans_carpani, 2) },
    ];
  }



  // Renk grubu değişen sütunun soluna kalın ayırıcı çizgi
  function sinir(S, i) { return S[i].g && (i === 0 || S[i - 1].g !== S[i].g) ? ' grup-sinir' : ''; }

  function ciz(kap) {
    const c = APP.calisma();
    const h = API.calismaHesapla(c.id);
    const yaz = API.calismaYazilabilir(c);
    const yetki = {
      pYaz: yaz && API.yetkiVar('personel.yaz'), zYaz: yaz && API.yetkiVar('zam.yaz'),
      zGor: API.yetkiVar('zam.oku'),
    };
    const sekmeler = [
      yetki.zGor ? ['zam', 'Zam Çalışması'] : null,
      ['kisi', 'Kişi Bilgileri'],
    ].filter(Boolean);
    if (!sekmeler.some(x => x[0] === sekme)) sekme = sekmeler[0][0];
    const liste = sekme === 'kisi' ? '' : 'num ';
    const bolumler = API.butceBolumuListe(c.grup_kod);
    /* Başka grupta seçilmiş bölüm süzgeci bu grupta yoksa düşürülür — yoksa liste tamamen boş görünür */
    if (bolumSuz && !bolumler.some(b => b.ad === bolumSuz)) bolumSuz = '';

    const q = U.normalize(arama);
    const satirlar = h.kisiler.filter(s =>
      (!q || U.normalize(s.kp.ad_soyad).includes(q) || s.kp.tc_kimlik_no.includes(arama.trim())) &&
      (!bolumSuz || s.kp.butce_bolumu === bolumSuz) && (!yakaSuz || s.kp.yaka === yakaSuz));

    const S = sutunlar(c, sekme, yetki);
    const T = S.map(k => k.t ? satirlar.reduce((a, s) => a + (Number(k.t(s)) || 0), 0) : null);
    const ozet = yetki.zGor ? ozetKutulari(c, h.kisiler) : '';
    const yontem = [c.zam_kademe ? 'maaş kademesi' : 'sabit oran', c.zam_performans ? 'performans çarpanı' : null]
      .filter(Boolean).join(' × ');
    const aciklama = {
      zam: 'Tutarlar NET. Zam öngörüsü: ' + U.esc(yontem) + ' (Çalışmalar ekranından değiştirilir). DÜZELTME yönetimin ' +
           'müdahalesidir; öngörülen zamma eklenir, eksi olabilir.',
      kisi: 'Hesaplamayı belirleyen bilgiler. Değiştirmek için kişinin adına tıklayın; yıl içi değişiklikler Aylık Girdiler\'den.',
    }[sekme];

    kap.innerHTML = `
      <div class="kart">
        <div class="kart-baslik">
          <div>
            <h2>Personel ve Zam — ${c.yil} · ${U.esc(c.grup_adi)}</h2>
            <div class="kart-aciklama">${aciklama}</div>
          </div>
          <div class="btn-satir">
            <input id="ara" placeholder="Ad veya T.C. ile ara (Esc: temizle)" type="search" value="${U.esc(arama)}" style="min-width:200px">
            <select id="bolumSuz">${C.secenekler(bolumler.map(b => ({ deger: b.ad, etiket: API.bolumEtiket(c.grup_kod, b.ad) })), bolumSuz, 'Tüm bölümler')}</select>
            <select id="yakaSuz">${C.secenekler([{ deger: 'B', etiket: 'Beyaz yaka' }, { deger: 'M', etiket: 'Mavi yaka' }], yakaSuz, 'Tüm yakalar')}</select>
            ${yetki.pYaz ? '<button class="btn" id="yeniBtn">+ Yeni Personel</button>' : ''}
          </div>
        </div>
        ${ozet}
        <div class="sekme-cubuk">${sekmeler.map(x =>
          `<button class="btn btn-ikincil btn-kucuk${x[0] === sekme ? ' etkin' : ''}" data-sekme="${x[0]}">${x[1]}</button>`).join('')}</div>
        <div class="tablo-sar"><table class="genis-tablo personel-tablo">
          <thead><tr>
            <th>Ad Soyad</th><th>Bütçe Bölümü</th>
            ${S.map((k, i) => `<th class="${liste}bas-${k.g || 'yok'}${sinir(S, i)}">${U.esc(k.b)}</th>`).join('')}
          </tr></thead>
          <tbody>${satirlar.map(s => `<tr>
            <td>${yetki.pYaz ? `<button class="ikon-btn satir-sil ad-sil" data-sil="${U.esc(s.kp.tc_kimlik_no)}" title="Bütçeden çıkar">🗑</button>` : ''}<a href="#" data-kart="${U.esc(s.kp.tc_kimlik_no)}">${U.esc(s.kp.ad_soyad)}</a>
              ${cikisHtml(s.kp, true)}</td>
            <td class="kucuk">${U.esc(API.bolumEtiket(c.grup_kod, s.kp.butce_bolumu))}</td>
            ${S.map((k, i) => `<td class="${liste}hucre-${k.g || 'yok'}${sinir(S, i)}">${k.v(s)}</td>`).join('')}
          </tr>`).join('')}
          <tr class="toplam-satir"><td>Toplam (${satirlar.length} kişi)</td><td></td>
            ${S.map((k, i) => `<td class="num">${k.tHtml ? k.tHtml(T) : (k.t ? B.tl(T[i]) : '')}</td>`).join('')}</tr>
          </tbody></table></div>
      </div>`;

    C.canliArama('ara', v => { arama = v; });
    U.el('bolumSuz').onchange = e => { bolumSuz = e.target.value; APP.tazele(); };
    U.el('yakaSuz').onchange = e => { yakaSuz = e.target.value; APP.tazele(); };
    kap.querySelectorAll('[data-sekme]').forEach(b => b.onclick = () => { sekme = b.getAttribute('data-sekme'); APP.tazele(); });
    if (yetki.pYaz) U.el('yeniBtn').onclick = () => formAc(c, null);

    kap.querySelectorAll('[data-duz]').forEach(inp => {
      const eski = inp.value;
      const kaydet = () => {
        if (inp.value === eski) return;
        try {
          API.calismaPersonelAlanYaz(c.id, inp.getAttribute('data-duz'), 'duzeltme', inp.value.trim());
          APP.tazele();
        } catch (e) { U.bildir(e.message, 'hata'); }
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') kaydet(); });
      inp.addEventListener('blur', kaydet);
    });

    kap.addEventListener('click', e => {
      const a = e.target.closest('[data-kart]');
      if (a) { e.preventDefault(); return formAc(c, API.calismaPersonelGetir(c.id, a.getAttribute('data-kart'))); }
      const s = e.target.closest('[data-sil]');
      if (s) return sil(c, s.getAttribute('data-sil'));
    });
  }

  const yaz0 = c => API.calismaYazilabilir(c) && API.yetkiVar('personel.yaz');

  function formAc(c, kayit) {
    const k = kayit ? Object.assign({}, kayit, kayit.onay_sabit === 2 ? { ise_giris: kayit.onay_giris, isten_ayrilis: kayit.onay_cikis } : {})
                    : { yaka: 'B', zam_ayi: 1, hesap_turu: 'SSK', kanun: 'YOK' };
    const yeni = !kayit;
    const gecmis = yeni ? [] : API.personelGecmis(k.tc_kimlik_no);
    const hedefler = !yeni && yaz0(c) ? API.tasimaHedefleri(c.id) : [];
    /* Grup alanında yalnız grup adı görünür ("Ofis"); grubun o yıl birden çok çalışması varsa ayırt etmek için
       çalışma adı eklenir ("Ofis · 2027 Revize"). Tek çalışmada çalışma adı eklenmez: "Ofis · 2027 Bütçe" gereksiz kalabalıktır. */
    const yilCalisma = API.calismaListe().filter(x => x.yil === c.yil);
    const grupEtiket = x => yilCalisma.filter(y => y.grup_kod === x.grup_kod).length > 1 ? x.grup_adi + ' · ' + x.ad : x.grup_adi;
    const yaz = API.calismaYazilabilir(c) && API.yetkiVar('personel.yaz');
    const turler = API.hesapTuruListe(c.yil).map(t => ({ deger: t.kod, etiket: t.ad }));
    const kanunlar = API.kanunListe().map(x => ({ deger: x.kod, etiket: x.ad }));
    const bolumler = API.butceBolumuListe(c.grup_kod).map(b => ({ deger: b.ad, etiket: API.bolumEtiket(c.grup_kod, b.ad) }));
    const v = x => U.esc(x == null ? '' : x);
    const sayi = x => x == null || x === '' ? '' : B.tlDuz(x, Math.round(x) === x ? 0 : 2);

    const kip = C.kipAc({
      baslik: yeni ? 'Yeni Personel' : k.ad_soyad,
      altBaslik: yeni ? c.yil + ' · ' + c.grup_adi : 'T.C. ' + (API.yetkiVar('alan.tc') ? k.tc_kimlik_no : U.tcMaskele(k.tc_kimlik_no)),
      genislik: 'genis',
      govde: `
        <h3 class="bosluk-yok">Kimlik ve İstihdam <span class="kucuk soluk">— Dış Liste Aktarımı'yla ERP / bordro programından da gelebilir</span></h3>
        <div class="izgara izgara-3 ust-bosluk">
          <div class="alan"><label>T.C. Kimlik No <span class="zorunlu">*</span></label>
            <input name="tc_kimlik_no" class="mono" maxlength="11" value="${v(k.tc_kimlik_no)}"></div>
          <div class="alan"><label>Ad Soyad <span class="zorunlu">*</span></label>
            <input name="ad_soyad" value="${v(k.ad_soyad)}"></div>
          <div class="alan"><label>Grup</label>
            <select name="hedef_calisma"${hedefler.length ? '' : ' disabled'}>
              <option value="">${U.esc(grupEtiket(c))}</option>
              ${hedefler.map(h => `<option value="${h.id}">${U.esc(grupEtiket(h))}</option>`).join('')}</select>
            <div class="alan-not" id="grupNot">${yeni ? 'Kişi bu çalışmaya eklenir.' : hedefler.length
              ? 'Başka gruba atanırsa kişi bütün bilgileriyle (maaş, zam, aylık girdiler, değerlendirme) o gruba taşınır.'
              : (c.durum === 'ONAYLI' ? 'Onaylı çalışmada grup değiştirilemez.' : c.yil + ' yılında taşınabilecek başka grup çalışması (taslak) yok.')}</div></div>
          <div class="alan"><label>Bütçe Bölümü</label>
            <select name="butce_bolumu">${C.secenekler(bolumler, k.butce_bolumu, '—')}</select></div>
          <div class="alan"><label>İşe Giriş</label><input name="ise_giris" type="date" value="${v(k.ise_giris)}">
            <div class="alan-not">${c.yil} içinde girenlere zam öngörülmez; ${c.yil - 1} veya öncesinde girenlere ${c.yil} zammı uygulanır.</div></div>
          <div class="alan"><label>İşten Çıkış</label><input name="isten_ayrilis" type="date" value="${v(k.isten_ayrilis)}">
            <div class="alan-not">Çıkış ayından sonraki aylar hesaplanmaz.${k.onay_sabit === 2 ? ' <strong>Bu çalışmanın kendi dönem tarihleri</strong> (kişi sonra başka dönemde yeniden girdi).' : ''}</div></div>
          <div class="alan"><label>Yaka</label>
            <select name="yaka">${C.secenekler([{ deger: 'B', etiket: 'Beyaz yaka' }, { deger: 'M', etiket: 'Mavi yaka' }], k.yaka)}</select></div>
          <div class="alan"><label>Bölüm</label><input name="bolum" value="${v(k.bolum)}"></div>
          <div class="alan"><label>Ekip</label><input name="ekip" value="${v(k.ekip)}"></div>
          <div class="alan"><label>Görev / Meslek</label><input name="gorev" value="${v(k.gorev)}"></div>
        </div>

        <div id="tcBilgi">${gecmisHtml(gecmis, c)}</div>
        <h3>Hesaplama <span class="kucuk soluk">— Ocak'tan geçerli; yıl içindeki değişiklik Aylık Girdiler'den</span></h3>
        <div class="izgara izgara-3 ust-bosluk">
          <div class="alan"><label>Hesaplama Türü</label>
            <select name="hesap_turu">${C.secenekler(turler, k.hesap_turu)}</select>
            <div class="alan-not">SGK'sız türde yalnızca gelir ve damga vergisi hesaplanır.</div></div>
          <div class="alan"><label>Kanun (Teşvik)</label>
            <select name="kanun">${C.secenekler(kanunlar, k.kanun || 'YOK')}</select></div>
          <div class="alan"><label>AR-GE GV Teşvik Oranı</label>
            <select name="gv_tesvik">${C.secenekler([{ deger: 0, etiket: 'Yok' }, { deger: 0.8, etiket: '%80' },
              { deger: 0.9, etiket: '%90' }, { deger: 0.95, etiket: '%95' }], k.gv_tesvik || 0)}</select></div>
          <div class="alan"><label>Sakatlık Derecesi</label>
            <select name="sakatlik_derece">${C.secenekler([{ deger: 1, etiket: '1. derece' }, { deger: 2, etiket: '2. derece' },
              { deger: 3, etiket: '3. derece' }], k.sakatlik_derece, 'Yok')}</select></div>
          <div class="alan"><label>Özürlü İndirimi (aylık)</label>
            <input name="ozurlu_indirimi" class="num" value="${sayi(k.ozurlu_indirimi)}" readonly title="Dereceden, yılın tablosundan gelir">
            <div class="alan-not" id="sakatlikNot"></div></div>
          <div class="alan"><label>BES</label>
            <select name="bes">${C.secenekler([{ deger: 'EVET', etiket: 'Katılıyor' }, { deger: 'HAYIR', etiket: 'Katılmıyor' }], k.bes, '—')}</select></div>
        </div>

        <h3>Maaş ve Zam <span class="kucuk soluk">— net tutarlar</span></h3>
        <div class="uyari uyari-bilgi kucuk" id="maasNot"><span class="ik">ℹ</span><div></div></div>
        <div class="izgara izgara-3 ust-bosluk">
          <div class="alan"><label>${c.yil - 1} Net Maaş</label>
            <input name="maas_eski" class="num" value="${sayi(k.maas_eski)}"></div>
          <div class="alan"><label>Zam Ayı</label>
            <select name="zam_ayi">${C.aySecenekleri(k.zam_ayi || 1)}</select></div>
          <div class="alan"><label>Zam Düzeltmesi</label>
            <input name="duzeltme" class="num" value="${sayi(k.duzeltme)}">
            <div class="alan-not">Öngörülen zamma eklenir (eksi olabilir).</div></div>
          <div class="alan"><label>Performans Puanı</label>
            <input name="performans_puani" class="num" value="${sayi(k.performans_puani)}"></div>
          <div class="alan"><label>Performans Çarpanı</label>
            <input name="performans_carpani" class="num" value="${sayi(k.performans_carpani)}">
            <div class="alan-not">Boşsa puandan (Parametreler → Performans) bulunur; o da yoksa 1.</div></div>
          <div class="alan"><label>Yol Parası (aylık net)</label>
            <input name="yol" class="num" value="${sayi(k.yol)}"></div>
          <div class="alan"><label>${c.yil - 1} Toplam Maliyet</label>
            <input name="maliyet_onceki" class="num" value="${sayi(k.maliyet_onceki)}"></div>
          <div class="alan"><label>Sıra</label><input name="sira" type="number" value="${v(k.sira || 0)}"></div>
        </div>
        <div class="alan"><label>Not</label><textarea name="not_metni" rows="2">${v(k.not_metni)}</textarea></div>`,
      altlik: yaz ? `${yeni ? '' : '<button class="btn btn-tehlike" data-cikar title="Kişiyi bu çalışmadan çıkarır (personel kaydı silinmez)">🗑 Bütçeden çıkar</button>'}
                     <button class="btn btn-ikincil" data-kip-kapat>Vazgeç</button>
                     <button class="btn" data-kaydet>Kaydet</button>`
                  : `<button class="btn btn-ikincil" data-kip-kapat>Kapat</button>`,
    });

    if (!yaz) kip.querySelectorAll('input, select, textarea').forEach(e => { e.disabled = true; });
    const der = kip.querySelector('[name=sakatlik_derece]');
    const notu = () => {
      const t = der.value ? API.sakatlikTutari(c.yil, Number(der.value)) : 0;
      U.el('sakatlikNot').textContent = der.value ? `Hesapta ${c.yil} tablosu kullanılır (${der.value}. derece: ${B.tlDuz(t)} TL). Tablo Parametreler'dedir; öngörü uygulanınca artar.` : '';
    };
    der.onchange = () => {
      notu();
      const inp = kip.querySelector('[name=ozurlu_indirimi]');
      inp.value = der.value ? B.tlDuz(API.sakatlikTutari(c.yil, Number(der.value))) : '';
    };
    notu();

    /* Bütçeden çıkarma kartta da vardır (tablodaki 🗑 ile aynı işlem): geniş tabloda satır düğmesi gözden kaçabilir. */
    /* Grup değişince bütçe bölümü listesi hedef grubunkine döner */
    const gs = kip.querySelector('[name=hedef_calisma]'), bs = kip.querySelector('[name=butce_bolumu]');
    if (gs) gs.onchange = () => {
      const h = hedefler.find(x => x.id === Number(gs.value));
      const gk = h ? h.grup_kod : c.grup_kod;
      const eski = bs.value;
      const l = API.butceBolumuListe(gk).map(b => ({ deger: b.ad, etiket: API.bolumEtiket(gk, b.ad) }));
      bs.innerHTML = C.secenekler(l, l.some(x => x.deger === eski) ? eski : '', '—');
      U.el('grupNot').innerHTML = h ? `Kaydedince <strong>${U.esc(grupEtiket(h))}</strong> grubuna (${c.yil}) bütün bilgileriyle taşınır ve
        ${U.esc(grupEtiket(c))} grubundan çıkar. Onaylı çalışmalar etkilenmez. Bütçe bölümünü hedef grubun bölümlerinden seçin.`
        : 'Başka gruba atanırsa kişi bütün bilgileriyle (maaş, zam, aylık girdiler, değerlendirme) o gruba taşınır.';
    };
    /* Maaş alanının anlamı giriş tarihine bağlıdır: yıl başından ÖNCE giren → yazılan tutar önceki yıl maaşı, zam
       uygulanır (önceki yılın son aylarında alınan kişi de Ocak'ta zam alır); yıl İÇİNDE giren → tutar bu yılın maaşı, zam yok. */
    const girIn = kip.querySelector('[name=ise_giris]');
    const maasNotu = () => {
      const g = girIn.value, y = g ? Number(g.slice(0, 4)) : null;
      const n = kip.querySelector('#maasNot div');
      n.innerHTML = !g || y < c.yil
        ? `Maaş alanı <strong>${c.yil - 1} maaşıdır</strong>; ${c.yil} zammı (öngörü + düzeltme) zam ayından itibaren üzerine eklenir.${g && y === c.yil - 1 ? ` Kişi ${c.yil - 1} içinde girdi; ${c.yil} zammı yine uygulanır.` : ''}`
        : y === c.yil
          ? `Kişi <strong>${c.yil} içinde</strong> işe giriyor: zam öngörülmez, yazdığınız tutar <strong>${c.yil} maaşıdır</strong>; maliyet giriş ayından itibaren hesaplanır.`
          : `Giriş tarihi ${c.yil} sonrasında; bu çalışmada maliyet hesaplanmaz.`;
    };
    girIn.addEventListener('change', maasNotu); maasNotu();

    /* Yeni personel: kayıtlı T.C. yazılınca kişinin son bilgileri dolar (yeniden giriş, grup değişikliği) */
    const tcIn = kip.querySelector('[name=tc_kimlik_no]');
    if (yeni && tcIn) tcIn.addEventListener('change', () => {
      const tc = U.tcTemizle(tcIn.value);
      if (tc.length !== 11) return;
      const o = API.personelOnDoldur(tc, c.yil);
      if (!o) { U.el('tcBilgi').innerHTML = ''; return; }
      const ata = (ad, val) => { const e = kip.querySelector('[name=' + ad + ']'); if (e && val != null && val !== '') e.value = e.tagName === 'SELECT' ? val : (typeof val === 'number' ? sayi(val) : val); };
      ['ad_soyad', 'bolum', 'ekip', 'gorev', 'ise_giris', 'isten_ayrilis'].forEach(a => ata(a, o.personel[a]));
      if (o.satir) {
        ['yaka', 'hesap_turu', 'kanun', 'gv_tesvik', 'sakatlik_derece', 'bes', 'zam_ayi', 'yol'].forEach(a => ata(a, o.satir[a]));
        ['maas_eski', 'maliyet_onceki'].forEach(a => ata(a, o.satir[a]));
        if (o.son && o.son.grup_kod === c.grup_kod) ata('butce_bolumu', o.satir.butce_bolumu);
        der.onchange && der.onchange();
      }
      U.el('tcBilgi').innerHTML = gecmisHtml(o.gecmis, c, true);
      maasNotu();
    });

    const cb = kip.querySelector('[data-cikar]');
    if (cb) cb.onclick = async () => { C.kipKapat(); await sil(c, k.tc_kimlik_no); };
    const kb = kip.querySelector('[data-kaydet]');
    if (kb) kb.onclick = () => {
      const f = C.formOku(kip);
      // Formda olmayan alanlar kayıttaki değeriyle korunur
      ['maliyet_onceki', 'karsilastirma'].forEach(a => { if (!(a in f)) f[a] = k[a]; });
      const hedefId = Number(f.hedef_calisma) || null; delete f.hedef_calisma;
      try {
        // Kart kaydı ve grup taşıma tek işlemde (taşıma başarısız olursa kart değişikliği de geri alınır)
        const t = API.calismaPersonelKaydet(c.id, f, yeni ? null : k.tc_kimlik_no,
                                             hedefId ? { hedefId: hedefId, butceBolumu: f.butce_bolumu } : null);
        if (hedefId) {
          U.bildir(`${f.ad_soyad} ${grupEtiket(t.hedef)} grubuna taşındı${t.butceBolumu ? '' : ' (bütçe bölümünü orada seçin)'}.`, 'basari');
        } else U.bildir('Kaydedildi.', 'basari');
        C.kipKapat();
        APP.calismaSeciciCiz(); APP.tazele();
      } catch (e) { U.bildir(e.message, 'hata'); }
    };
  }

  /* Kişinin grup / çalışma geçmişi; yeni personelde yeniden giriş ve aynı yılda başka grup uyarısı */
  function gecmisHtml(g, c, yeni) {
    if (!g || !g.length) return '';
    const ayniYilBaska = g.filter(x => x.yil === c.yil && x.id !== c.id);
    const satir = x => `<tr><td>${x.yil}</td><td>${U.esc(x.grup_adi)}</td><td>${U.esc(x.ad)}${x.durum === 'ONAYLI' ? ' <span class="rz rz-yesil">onaylı</span>' : ''}${x.id === c.id ? ' <span class="rz rz-mavi">bu çalışma</span>' : ''}</td>
      <td>${x.giris ? U.tarihGoster(x.giris) : '—'}</td><td>${x.cikis ? U.tarihGoster(x.cikis) : '—'}</td></tr>`;
    return `<h3>Grup geçmişi</h3>
      ${yeni ? `<div class="uyari uyari-bilgi kucuk"><span class="ik">ℹ</span><div>Bu T.C. kayıtlı: bilgileri son çalışmasından dolduruldu
        ${g.find(x => x.yil < c.yil) ? '(maaş, ' + (c.yil - 1) + ' yılının zamlı maaşı)' : ''}. <strong>Yeniden girişse İşe Giriş tarihini yeni tarih yapın ve İşten Çıkış'ı boşaltın</strong>;
        eski çalışmalar eski tarihlerini korur.</div></div>` : ''}
      ${ayniYilBaska.length ? `<div class="uyari uyari-dikkat kucuk"><span class="ik">⚠</span><div>Bu kişi ${c.yil} yılında
        <strong>${ayniYilBaska.map(x => U.esc(x.grup_adi + ' · ' + x.ad)).join(', ')}</strong> çalışmasında da var; iki grupta birden maliyeti sayılır.
        ${yeni ? 'Oradaki kartından <strong>Grup</strong> alanıyla bu gruba taşıyın.' : 'Doğru grubu seçip diğerinden çıkarın ya da Grup alanıyla taşıyın.'}</div></div>` : ''}
      <table class="genis-tablo param-tablo ust-bosluk"><thead><tr><th>Yıl</th><th>Grup</th><th>Çalışma</th><th>İşe giriş</th><th>Çıkış</th></tr></thead>
      <tbody>${g.map(satir).join('')}</tbody></table>`;
  }

  async function sil(c, tc) {
    const k = API.calismaPersonelGetir(c.id, tc);
    const ok = await C.onay({
      baslik: 'Bütçeden Çıkar',
      mesaj: `<strong>${U.esc(k.ad_soyad)}</strong> bu çalışmadan çıkarılacak.`,
      detay: 'Bu çalışmadaki aylık girdileri ve performans değerlendirmesi de silinir. Personel kaydı ve önceki yılların çalışmaları etkilenmez. Kişi yıl içinde ayrılacaksa silmek yerine çıkış tarihi girin.',
      evetYazi: 'Çıkar', tehlike: true,
    });
    if (!ok) return;
    try { API.calismaPersonelSil(c.id, tc); APP.tazele(); } catch (e) { U.bildir(e.message, 'hata'); }
  }

  APP.modulKaydet({
    id: 'personel', ad: 'Personel ve Zam', ikon: '👥', grup: 'Bütçe',
    baslik: 'Personel ve Zam', altBaslik: 'Bütçe satırları, zam öngörüsü ve düzeltme',
    yetki: 'personel.oku', calismaGerekli: true,
    sayac: () => { const c = APP.calisma(); return c ? API.calismaPersonelListe(c.id).length : 0; },
    ciz: ciz,
  });
})();
