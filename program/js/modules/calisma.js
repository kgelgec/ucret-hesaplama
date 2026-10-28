/* =====================================================================
   ÇALIŞMALAR — her grubun her yılı ayrı bir bütçe çalışmasıdır

   Yeni çalışma üç kaynaktan açılabilir:
     BOS      — boş; personel Personel İçe Aktarma ekranıyla (Excel / ERP
                programı) ya da elle girilir
     YENI_YIL — önceki yılın çalışmasından: o yılın ZAMLI maaşları yeni
                yılın "önceki yıl maaşı" olur, önceki yılın maliyeti
                karşılaştırma maliyeti olur. (Dış liste aktarımı sonradan
                gerçek maaşlarla günceller.)
     KOPYA    — aynı yıldan birebir kopya (senaryo denemek için)

   ÜCRET ESASI (net / brüt) çalışmanın ayarıdır: girilen maaş ve ek ödemeler
   net mi brüt mü? Yalnız BOŞ çalışmada seçilir; YENI_YIL, KOPYA ve revize
   kaynağın esasını devralır. Personeli olan çalışmanın esası değiştirilemez
   (kural API'dedir; ekran yalnız seçimi kapatır ve nedenini yazar).
   ===================================================================== */
(function () {
  'use strict';

  function ciz(kap, param) {
    const tumu = APP.tumuMu();
    const liste = API.calismaListe().filter(c => tumu || c.grup_kod === APP.grup());
    const yeniVar = API.yetkiVar('personel.yaz') && API.gorunurGruplar().some(g => API.grupYazabilir(g.kod));
    const aktif = APP.calisma();
    const grupAd = tumu ? 'Tüm gruplar' : ((API.grupListe().find(g => g.kod === APP.grup()) || {}).ad || '');

    kap.innerHTML = `
      <div class="kart">
        <div class="kart-baslik">
          <div><h2>Bütçe Çalışmaları — ${U.esc(grupAd)}</h2>
            <div class="kart-aciklama">Her grubun her yılı ayrı bir çalışmadır. Yalnızca erişim yetkiniz olan gruplar listelenir.</div></div>
          ${yeniVar ? '<button class="btn" id="yeniBtn">+ Yeni Çalışma</button>' : ''}
        </div>
        ${C.tablo([
          { baslik: 'Yıl', sinif: 'num', alan: 'yil' },
          { baslik: 'Grup', alan: 'grup_adi' },
          { baslik: 'Ad', deger: c => `${U.esc(c.ad)}${aktif && aktif.id === c.id ? ' <span class="rz rz-mavi">seçili</span>' : ''}` },
          { baslik: 'Kişi', sinif: 'num', alan: 'kisi' },
          { baslik: 'Parametreler', deger: c => c.durum === 'ONAYLI' && API.calismaParametreDondurulmusMu(c.id)
              ? '<span class="rz rz-gri" title="Onay anındaki parametrelerle hesaplanır; Parametreler\'deki değişiklik bu çalışmaya yansımaz">🔒 onay anındaki</span>'
              : parametreDurum(c.yil) },
          { baslik: 'Ücret esası', deger: c => B.esasRozet(c) },
          { baslik: 'Zam yöntemi', deger: c => [c.zam_kademe ? 'Kademe' : 'Sabit oran', c.zam_performans ? 'Performans' : null].filter(Boolean).join(' × ') },
          { baslik: 'Durum', deger: c => c.durum === 'ONAYLI' ? '<span class="rz rz-yesil">Onaylı</span>' : '<span class="rz rz-sari">Taslak</span>' },
          { baslik: '', sinif: 'sag-hiza', deger: c => `
              <button class="btn btn-ikincil btn-kucuk" data-sec="${c.id}">Aç</button>
              ${c.durum === 'ONAYLI' && API.grupYazabilir(c.grup_kod) && API.yetkiVar('personel.yaz')
                ? `<button class="btn btn-ikincil btn-kucuk" data-revize="${c.id}" title="Onaylı çalışmanın kopyası; güncel (resmî) parametrelerle hesaplanır">Revize aç</button>` : ''}
              ${API.grupYazabilir(c.grup_kod) && API.yetkiVar('personel.yaz') ? `<button class="ikon-btn satir-duzenle" data-duzenle="${c.id}">✎</button>
              <button class="ikon-btn satir-sil" data-sil="${c.id}">🗑</button>` : ''}` },
        ], liste, { bosMesaj: 'Bu grupta çalışma yok.' })}
      </div>`;

    const yb = U.el('yeniBtn'); if (yb) yb.onclick = () => form(null);
    if (param && param.yeni && yeniVar) setTimeout(() => form(null), 0);
    kap.addEventListener('click', async e => {
      let b;
      if ((b = e.target.closest('[data-sec]'))) { APP.calismaSec(b.getAttribute('data-sec')); APP.git('ozet'); return; }
      if ((b = e.target.closest('[data-revize]'))) return revizeAc(Number(b.getAttribute('data-revize')));
      if ((b = e.target.closest('[data-duzenle]'))) return form(API.calismaGetir(Number(b.getAttribute('data-duzenle'))));
      if ((b = e.target.closest('[data-sil]'))) {
        const c = API.calismaGetir(Number(b.getAttribute('data-sil')));
        const ok = await C.onay({ baslik: 'Çalışmayı Sil',
          mesaj: `<strong>${c.yil} · ${U.esc(c.grup_adi)} · ${U.esc(c.ad)}</strong> silinecek.`,
          detay: 'Bütçe satırları ve aylık girdileri de silinir. Önce yedek almanız önerilir.', evetYazi: 'Sil', tehlike: true });
        if (!ok) return;
        try { API.calismaSil(c.id); APP.calismaSeciciCiz(); APP.tazele(); } catch (err) { U.bildir(err.message, 'hata'); }
      }
    });
  }

  /* ------------------------------------------------------------------
     GRUBA ÖZEL AYARLAR (calisma_ayar)
     Zam kademesi, varsayılan çalışılan gün ve AR-GE günü gruptan gruba
     farklı olabilir (örn. bir grubun kademe eşikleri yılın genel
     eşiklerinden farklı; başka bir grupta mavi yaka bazı aylarda eksik
     gün çalışır).
     Boş alan = yılın parametresi (gün için 30; AR-GE günü için yok).
     ------------------------------------------------------------------ */
  const KADEME = [['alt_esik', 'Alt eşik', 1], ['ust_esik', 'Üst eşik', 1], ['ust_oran', 'Alt eşik altı oran (%)', 100],
                  ['alt_oran', 'Üst eşik üstü oran (%)', 100]];
  const goster = (v, carp) => v == null || v === '' ? '' : B.tlDuz(Number(v) * carp, carp === 100 ? 2 : 0).replace(/,00$/, '');

  async function revizeAc(id) {
    const c = API.calismaGetir(id);
    const ok = await C.onay({ baslik: 'Revize Çalışma',
      mesaj: `<strong>${c.yil} · ${U.esc(c.grup_adi)} · ${U.esc(c.ad)}</strong> onaylı çalışmasının kopyası "<strong>${c.yil} Revize</strong>"
              adıyla taslak olarak açılacak.`,
      detay: `Onaylı çalışma olduğu gibi kalır (onay anındaki parametrelerle). Revize, ${c.yil} yılının <strong>güncel</strong> parametreleriyle
              hesaplanır: Ocak'ta Parametreler'e girilen resmî rakamlar yalnız revizeye yansır. Personel, zam düzeltmeleri, aylık girdiler,
              performans ve mesai tablosu kopyalanır.`, evetYazi: 'Revize aç' });
    if (!ok) return;
    try {
      const yeni = API.calismaRevizeAc(id);
      U.bildir('Revize çalışma açıldı.', 'basari');
      APP.calismaSec(yeni);
    } catch (e) { U.bildir(e.message, 'hata'); }
  }

  function ayarHtml(c) {
    const a = API.calismaAyarOku(c.id);
    const yp = API.parametreOku(c.yil);
    const yy = (k, vars) => API.parametreSayi(yp, k, vars);
    return `<h3 class="ust-bosluk">Bu gruba özel zam kademesi</h3>
      <div class="kucuk soluk">Boş bırakılan alanda ${c.yil} yılının genel değeri (soluk) geçerlidir.${B.esasKod(c) === 'BRUT'
        ? ' <strong>Brüt esaslı çalışma:</strong> eşikler brüt maaşa uygulanır; yılın genel eşikleri net maaşa göreyse burada brüte göre girin.' : ''}</div>
      <table class="genis-tablo ust-bosluk" id="ayarKademe"><thead><tr><th></th>${KADEME.map(z => `<th class="num">${z[1]}</th>`).join('')}</tr></thead>
        <tbody>${[['B', 'Beyaz yaka'], ['M', 'Mavi yaka']].map(y => `<tr><td class="kalin">${y[1]}</td>${KADEME.map(z => {
          const an = 'zam.' + y[0] + '.' + z[0];
          const vars = API.ZAM_TANIM.find(t => t.anahtar === z[0]).vars;
          return `<td class="num"><input class="hucre-girdi" data-ayar="${an}" data-carp="${z[2]}" value="${goster(a[an], z[2])}"
                   placeholder="${goster(yy(an, vars), z[2])}"></td>`; }).join('')}</tr>`).join('')}</tbody></table>
      <div class="alan ust-bosluk" style="max-width:420px"><label>Zam öngörüsü yuvarlama adımı (TL)</label>
        <input class="hucre-girdi" data-ayar="zam.yuvarla_ongoru" data-carp="1" value="${a['zam.yuvarla_ongoru'] == null ? '' : a['zam.yuvarla_ongoru']}"
               placeholder="${goster(yy('zam_yuvarla', 10), 1)}">
        <div class="kucuk soluk">Öngörülen zam bu tutarın en yakın katına yuvarlanır (ör. 10, 50, 100). Boş = yılın parametresi
          (Parametreler → Genel).</div></div>
      <h3 class="ust-bosluk">Varsayılan çalışılan gün</h3>
      <div class="kucuk soluk">Kişiye ayrıca gün girilmemişse bu gün kullanılır (boş = 30). Örn. mavi yaka bazı aylarda eksik gün çalışacaksa (ör. 26) o aylara gün sayısını yazın.</div>
      <div class="tablo-sar ust-bosluk"><table class="genis-tablo" id="ayarGun"><thead><tr><th></th>${U.AYLAR.map(x => `<th class="num">${x.slice(0, 3)}</th>`).join('')}</tr></thead>
        <tbody>${[['B', 'Beyaz'], ['M', 'Mavi']].map(y => `<tr><td class="kalin">${y[1]}</td>${U.AYLAR.map((x, i) => {
          const an = 'gun.' + y[0] + '.' + (i + 1);
          return `<td class="num"><input class="hucre-girdi" style="width:44px" data-ayar="${an}" data-carp="1" value="${a[an] == null ? '' : a[an]}" placeholder="30"></td>`;
        }).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="alan ust-bosluk" style="max-width:420px"><label>AR-GE çalışılan gün</label>
        <input class="hucre-girdi" data-ayar="arge_gun" data-carp="1" value="${a.arge_gun == null ? '' : a.arge_gun}" placeholder="yok">
        <div class="kucuk soluk">Varsayılan yoktur (boş = 0). Girilirse GV teşviki %${goster(yy('arge_gv_esik', 0.8), 100)} ve üzeri olan (AR-GE) kişilerde (eşik: Parametreler → Genel), kişiye
          Aylık Girdiler'den gün girilmemiş aylarda kullanılır. Kişiye girilen gün her zaman önceliklidir.</div></div>
      <div class="alan ust-bosluk" style="max-width:420px"><label>05510 indirim oranı (%) — 05510 dışı kanunlu kişilerde de uygulanır</label>
        <input class="hucre-girdi" data-ayar="tesvik.k05510" data-carp="100" value="${goster(a['tesvik.k05510'], 100)}"
               placeholder="${goster(yy('t05510', 0.02), 100)}">
        <div class="kucuk soluk">İmalat işyeri 5, diğerleri 2. Boş = yılın parametresi. AR-GE (05746) ve engelli (14857)
          kişilerin 05510 payı bu oranla hesaplanır; "05510 - %5" türündeki kişiler zaten %5 alır.</div></div>`;
  }

  function ayarOku(kip) {
    const o = {};
    kip.querySelectorAll('[data-ayar]').forEach(inp => {
      const v = inp.value.trim(), carp = Number(inp.getAttribute('data-carp')) || 1;
      o[inp.getAttribute('data-ayar')] = v === '' ? null : API.trSayi(v) / carp;
    });
    return o;
  }

  /* Ücret esası seçimi (yeni çalışma ve Çalışma Ayarları penceresi; açıklama esasGuncelle / form'da yazılır) */
  function esasHtml(deger) {
    return `<h3 class="ust-bosluk">Ücret esası</h3>
      <div class="alan" style="max-width:520px"><label>Girilen maaş ve ek ödemeler (prim, yol, aynî, yakıt)</label>
        <select name="ucret_esas">${C.secenekler([
          { deger: 'NET', etiket: 'Net — girilen tutarlar net; brüt hesaplanır' },
          { deger: 'BRUT', etiket: 'Brüt — girilen tutarlar brüt; net ödeme hesaplanır' }], deger)}</select>
        <div class="alan-not" id="esasNot"></div></div>`;
  }

  function parametreDurum(yil) {
    const p = API.parametreDurumu(yil);
    if (!p.var) return '<span class="rz rz-kirmizi">girilmemiş</span>';
    return p.ongoru ? `<span class="rz rz-ongoru">Öngörü %${B.tlDuz(p.oran * 100, 1)}</span>` : '<span class="rz rz-yesil">Resmî</span>';
  }

  function form(c) {
    const yeni = !c;
    const gruplar = API.gorunurGruplar().filter(g => API.grupYazabilir(g.kod)).map(g => ({ deger: g.kod, etiket: g.ad }));
    const k = c || { yil: APP.yil() || new Date().getFullYear(), grup_kod: APP.tumuMu() ? (gruplar[0] || {}).deger : APP.grup(),
                     zam_kademe: 1, zam_performans: 0, durum: 'TASLAK' };
    const kip = C.kipAc({
      baslik: yeni ? 'Yeni Çalışma' : 'Çalışma Ayarları', altBaslik: yeni ? null : c.yil + ' · ' + c.grup_adi,
      govde: `<div class="izgara izgara-2">
          <div class="alan"><label>Yıl</label><input name="yil" type="number" value="${k.yil}" ${yeni ? '' : 'disabled'}></div>
          <div class="alan"><label>Grup</label><select name="grup_kod" ${yeni ? '' : 'disabled'}>${C.secenekler(gruplar, k.grup_kod)}</select></div>
          <div class="alan"><label>Ad</label><input name="ad" value="${U.esc(k.ad || '')}" placeholder="${k.yil} Bütçe"></div>
          ${yeni ? '' : `<div class="alan"><label>Durum</label><select name="durum">${C.secenekler([{ deger: 'TASLAK', etiket: 'Taslak' },
              { deger: 'ONAYLI', etiket: 'Onaylı (yönetim onayladı)' }], k.durum)}</select></div>`}
        </div>
        ${yeni ? `<h3>Personel nereden gelsin?</h3>
          <label class="satir"><input type="radio" name="kaynak" value="YENI_YIL" checked>
            <span><strong>Önceki yılın çalışmasından</strong> — önceki yılın zamlı maaşları bu yılın başlangıç maaşı olur</span></label>
          <label class="satir"><input type="radio" name="kaynak" value="KOPYA">
            <span><strong>Aynı yıldaki bir çalışmanın kopyası</strong> — senaryo denemek için</span></label>
          <label class="satir"><input type="radio" name="kaynak" value="BOS">
            <span><strong>Boş</strong> — personel sonra Personel İçe Aktarma ekranından (Excel / ERP listesi) alınır ya da elle eklenir</span></label>
          <div class="alan ust-bosluk" id="kaynakKap"><label>Kaynak çalışma</label><select name="kaynak_id"></select>
            <div class="alan-not" id="kaynakNot"></div></div>
          ${esasHtml('NET')}` : ''}
        ${yeni ? '' : esasHtml(B.esasKod(c))}
        ${yeni ? '' : `<h3>Zam öngörüsü yöntemi</h3>
        <label class="satir"><input type="checkbox" name="zam_kademe" ${k.zam_kademe ? 'checked' : ''}>
          Maaş kademesine göre oran (düşük maaşa yüksek oran)</label>
        <label class="satir"><input type="checkbox" name="zam_performans" ${k.zam_performans ? 'checked' : ''}>
          Performans çarpanı uygula (kişi kartındaki puan / çarpan)</label>
        <div class="kucuk soluk">İkisi birden seçilirse: kademe oranı × performans çarpanı. Kademe kapalıysa üst oran sabit uygulanır.</div>
        ${ayarHtml(c)}`}
        <div class="alan ust-bosluk"><label>Açıklama</label><input name="aciklama" value="${U.esc(k.aciklama || '')}"></div>`,
      altlik: `<button class="btn btn-ikincil" data-kip-kapat>Vazgeç</button><button class="btn" data-kaydet>Kaydet</button>`,
    });

    /* Ücret esası: yeni çalışmada yalnız "Boş" kaynakta seçilir (kaynaklı açılışta kaynağın esası gösterilir);
       var olan çalışmada personel yoksa değiştirilebilir, varsa salt okunur. */
    const esasSec = kip.querySelector('[name=ucret_esas]'), esasNot = kip.querySelector('#esasNot');
    let esasElle = 'NET';                         // "Boş"ta kullanıcının son seçimi (kaynak türü değişip dönünce korunur)
    esasSec.addEventListener('change', () => { if (!esasSec.disabled) esasElle = esasSec.value; });
    const esasGuncelle = () => {
      const tur = (kip.querySelector('[name=kaynak]:checked') || {}).value;
      if (tur === 'BOS') {
        esasSec.disabled = false; esasSec.value = esasElle;
        esasNot.innerHTML = 'Bütün maaş ve ek ödeme tutarları bu esasla girilir. Personel eklendikten sonra <strong>değiştirilemez</strong>.';
        return;
      }
      const kid = Number(kip.querySelector('[name=kaynak_id]').value);
      esasSec.disabled = true;
      esasSec.value = kid ? B.esasKod(kid) : 'NET';
      esasNot.innerHTML = kid ? `Kaynak çalışmadan gelir: <strong>${B.esasBas(kid)} esas</strong>. Farklı esasla başlamak için "Boş" seçin.`
                              : 'Kaynak çalışmadan gelir.';
    };
    if (!yeni) {
      const kisi = API.calismaPersonelListe(c.id).length;
      const bagli = API.ucretEsasiBagli(c.id);      // API ile aynı kural: bütçe satırı ya da aylık girdi
      if (bagli || c.durum === 'ONAYLI') {
        esasSec.disabled = true;
        esasNot.innerHTML = c.durum === 'ONAYLI' ? 'Onaylı çalışma kilitlidir.'
          : (kisi ? `Personeli olan çalışmanın esası değiştirilemez; girilmiş ${kisi} kişinin maaşları öbür esasta yanlış okunur.`
                  : 'Çalışmada aylık girdi tutarları var; esas değiştirilirse öbür esasta yanlış okunur.') +
            ' Farklı esasla çalışmak için yeni, boş bir çalışma açın.';
      } else esasNot.innerHTML = 'Çalışmada henüz personel yok; esas değiştirilebilir. Personel eklendikten sonra değiştirilemez.';
    }

    // Kaynak seçenekleri, yıl / grup / kaynak türü değiştikçe yenilenir
    const kaynakGuncelle = () => {
      if (!yeni) return;
      const tur = (kip.querySelector('[name=kaynak]:checked') || {}).value;
      const y = Number(kip.querySelector('[name=yil]').value), g = kip.querySelector('[name=grup_kod]').value;
      const sec = kip.querySelector('[name=kaynak_id]');
      U.el('kaynakKap').style.display = tur === 'BOS' ? 'none' : '';
      const l = API.calismaListe().filter(x => x.grup_kod === g && (tur === 'YENI_YIL' ? x.yil === y - 1 : x.yil === y));
      sec.innerHTML = C.secenekler(l.map(x => ({ deger: x.id, etiket: `${x.yil} · ${x.grup_adi} · ${x.ad} (${x.kisi} kişi)` })), l.length ? l[0].id : '');
      U.el('kaynakNot').textContent = l.length ? '' : (tur === 'YENI_YIL' ? `${y - 1} yılında bu grubun çalışması yok.` : 'Bu yılda kopyalanacak çalışma yok.');
      const pd = API.parametreDurumu(y);
      if (tur !== 'BOS' && !pd.var) U.el('kaynakNot').textContent += ` ${y} parametreleri henüz yok — önce Parametreler → Yeni Yıl Öngörüsü ile oluşturun.`;
      esasGuncelle();
    };
    if (yeni) {
      kip.querySelectorAll('[name=kaynak], [name=yil], [name=grup_kod]').forEach(e => e.addEventListener('change', kaynakGuncelle));
      kip.querySelector('[name=kaynak_id]').addEventListener('change', esasGuncelle);
      kaynakGuncelle();
    }
    /* Onaylı çalışma kilitlidir: yalnızca durum (Taslak'a alma) ve açıklama değiştirilebilir */
    const kilitli = !yeni && c.durum === 'ONAYLI';
    if (kilitli) {
      kip.querySelectorAll('[data-ayar], [name=zam_kademe], [name=zam_performans], [name=ad], [name=ucret_esas]')
         .forEach(e => { e.disabled = true; });
      kip.querySelector('.kip-govde').insertAdjacentHTML('afterbegin', `<div class="uyari uyari-bilgi kucuk"><span class="ik">🔒</span>
        <div>Onaylı çalışma kilitlidir. Ayarları değiştirmek için Durum'u "Taslak" yapıp kaydedin, sonra yeniden açın.<br>
        Hesap, onay anındaki giriş/çıkış tarihleriyle yapılır. Taslağa alınırsa personel kartındaki güncel tarihler geçerli olur
        ve maliyet değişebilir.</div></div>`);
    }

    kip.querySelector('[data-kaydet]').onclick = () => {
      const f = C.formOku(kip);
      const tur = yeni ? (kip.querySelector('[name=kaynak]:checked') || {}).value : null;
      try {
        if (yeni && tur !== 'BOS' && !f.kaynak_id) throw new Error('Kaynak çalışma seçin ya da "Boş" seçeneğini işaretleyin.');
        // Ayarlar, çalışma kilitlenmeden (Onaylı'ya alınmadan) önce yazılır. Esas yalnız değiştiyse gönderilir
        // (personeli olan çalışmada API değişikliği reddeder).
        if (!yeni && !kilitli) {
          const ayar = ayarOku(kip);
          if (!esasSec.disabled && esasSec.value !== B.esasKod(c)) ayar['ucret.esas'] = esasSec.value;
          API.calismaAyarYaz(c.id, ayar);
        }
        const yeniEsas = f.ucret_esas;
        const alanlar = Object.assign({}, kilitli ? { durum: f.durum, aciklama: f.aciklama } : f);
        delete alanlar.ucret_esas;
        /* Kaynaklı açılışta esas kaynaktan gelir (calismaPersonelKopyala); "Boş"ta seçilen esas */
        const id = API.calismaKaydet(Object.assign({}, k, alanlar, { id: yeni ? null : c.id, yil: yeni ? Number(f.yil) : c.yil,
                                                                   grup_kod: yeni ? f.grup_kod : c.grup_kod,
                                                                   ucret_esas: yeni && tur === 'BOS' ? yeniEsas : null }));
        if (yeni && tur !== 'BOS') {
          const n = API.calismaPersonelKopyala(Number(f.kaynak_id), id, tur);
          U.bildir(n + ' kişi aktarıldı.', 'basari');
        }
        C.kipKapat();
        if (yeni) APP.calismaSec(id); else { APP.calismaSeciciCiz(); APP.tazele(); }
      } catch (e) { U.bildir(e.message, 'hata'); }
    };
  }

  APP.modulKaydet({
    id: 'calisma', ad: 'Bütçe Çalışmaları', ikon: '🗂', grup: 'Bütçe',
    baslik: 'Bütçe Çalışmaları', altBaslik: 'Her grubun her yılı için bütçe: açma, onay, revize ve ayarlar',
    yetki: 'personel.oku', ciz: ciz,
  });
})();
