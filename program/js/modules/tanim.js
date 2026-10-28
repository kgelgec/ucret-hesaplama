/* =====================================================================
   TANIMLAR — hesaplama türleri, kanun (teşvik) türleri, gruplar,
   bütçe bölümleri, dış liste aktarımının tanıdığı sütun başlıkları
   ===================================================================== */
(function () {
  'use strict';

  let sekme = null, grupSec = null;
  const KOL = [{ deger: 'SSK', etiket: 'SSK — tüm sigorta kolları' }, { deger: 'SGDP', etiket: 'SGDP — emekli' },
               { deger: 'YOK', etiket: 'SGK yok (huzur hakkı / danışman)' }];
  const KURAL = [{ deger: 'YOK', etiket: 'Teşvik yok' }, { deger: '05510', etiket: '05510 — işveren prim indirimi (oran aşağıda)' },
    { deger: '05746', etiket: '05746 — AR-GE (işveren payının ½ + 05510 indirimi)' }, { deger: '14857', etiket: '14857 — engelli' },
    { deger: '15510', etiket: '15510 — emekli %5' }];

  function ciz(kap, param) {
    const yil = APP.yil() || API.yillar()[0];
    const yaz = API.yetkiVar('parametre.yaz');
    /* Gruplar sekmesi yalnız sistem yöneticisine görünür. Hiç grup yokken yönetici
       ekranı ilk açtığında doğrudan oraya gelir (bütçe bölümü ve çalışma gruba bağlıdır). */
    const yonetici = API.yetkiVar('sistem.yonet');
    if (param && param.sekme) sekme = param.sekme;
    if (!sekme) sekme = yonetici && !API.grupListe().length ? 'grup' : 'tur';
    if (sekme === 'grup' && !yonetici) sekme = 'tur';
    // Yalnızca görülebilen gruplar; üst çubukta grup seçiliyse o grup
    const gruplar = API.gorunurGruplar();
    if (!APP.tumuMu() && APP.grup()) grupSec = APP.grup();
    if (!grupSec || !gruplar.some(g => g.kod === grupSec)) grupSec = gruplar.length ? gruplar[0].kod : null;

    let icerik = '';
    if (sekme === 'tur') {
      const l = API.hesapTuruListe(yil);
      icerik = `<div class="kart-aciklama">Kişi kartında seçilen "Hesaplama Türü" SGK ve vergi kesintilerini belirler.
          Oranlar ${yil} yılı içindir. SGK'sız türde (huzur hakkı, danışman) yalnızca gelir ve damga vergisi hesaplanır.</div>
        ${C.tablo([
          { baslik: 'Kod', sinif: 'mono', deger: t => U.esc(t.kod) }, { baslik: 'Ad', alan: 'ad' },
          { baslik: 'SGK Kolu', deger: t => U.esc(t.kol) },
          { baslik: 'SGK İşçi', sinif: 'num', deger: t => B.oran(t.sgk_isci) },
          { baslik: 'İşsizlik İşçi', sinif: 'num', deger: t => B.oran(t.issizlik_isci) },
          { baslik: 'SGK İşveren', sinif: 'num', deger: t => B.oran(t.sgk_isveren) },
          { baslik: 'İşsizlik İşveren', sinif: 'num', deger: t => B.oran(t.issizlik_isveren) },
          { baslik: 'GV', deger: t => t.gv ? '✓' : '—' }, { baslik: 'DV', deger: t => t.dv ? '✓' : '—' },
          { baslik: 'AÜ İstisnası', deger: t => t.istisna ? '✓' : '—' },
          { baslik: '', sinif: 'sag-hiza', deger: t => yaz ? `<button class="ikon-btn satir-duzenle" data-tur="${U.esc(t.kod)}">✎</button>
              <button class="ikon-btn satir-sil" data-tur-sil="${U.esc(t.kod)}">🗑</button>` : '' },
        ], l)}
        ${yaz ? '<button class="btn ust-bosluk" id="yeniTur">+ Yeni Hesaplama Türü</button>' : ''}`;
    } else if (sekme === 'kanun') {
      icerik = `<div class="kart-aciklama">Ad serbesttir; hesabı "kural" belirler. Yeni bir kanun kodu eklerken
          motorun tanıdığı kurallardan birine bağlayın.</div>
        ${C.tablo([
          { baslik: 'Kod', sinif: 'mono', deger: k => U.esc(k.kod) }, { baslik: 'Ad', alan: 'ad' },
          { baslik: 'Kural', deger: k => U.esc((KURAL.find(x => x.deger === k.kural) || {}).etiket || k.kural) },
          { baslik: '05510 Oranı', sinif: 'num', deger: k => k.kural === '05510' ? (k.oran != null ? B.oran(k.oran) : '<span class="soluk">yıl parametresi</span>') : '' },
          { baslik: 'Açıklama', deger: k => `<span class="kucuk soluk">${U.esc(k.aciklama || '')}</span>` },
          { baslik: '', sinif: 'sag-hiza', deger: k => yaz ? `<button class="ikon-btn satir-duzenle" data-kanun="${U.esc(k.kod)}">✎</button>
              <button class="ikon-btn satir-sil" data-kanun-sil="${U.esc(k.kod)}">🗑</button>` : '' },
        ], API.kanunListe())}
        ${yaz ? '<button class="btn ust-bosluk" id="yeniKanun">+ Yeni Kanun Türü</button>' : ''}`;
    } else if (sekme === 'baslik') {
      const S = API.aktarimSozluk();
      icerik = `<div class="kart-aciklama">Personel İçe Aktarma, ERP / bordro programından alınan listedeki sütunları
          <strong>başlık adlarıyla</strong> tanır. Her alan için tanınacak başlıkları virgülle ayırarak yazın; büyük / küçük harf
          ve Türkçe karakter farkı gözetilmez ("Net Ücret" = "net ucret"). Başlık tam tutmazsa başlığın içinde geçen aday da
          eşleşir. T.C. sütunu zorunludur.</div>
        <table class="genis-tablo ust-bosluk" id="baslikTablo"><thead><tr><th>Alan</th><th>Tanınan başlıklar</th><th></th></tr></thead>
          <tbody>${Object.keys(S.sozluk).map(a => `<tr><td class="kalin" style="white-space:nowrap">${U.esc(S.etiket[a])}
              ${S.degisen[a] ? ' <span class="rz rz-sari" title="Varsayılandan farklı">değiştirildi</span>' : ''}</td>
            <td><input class="hucre-girdi" style="width:100%; text-align:left" data-baslik="${a}" value="${U.esc(S.sozluk[a].join(', '))}"${yaz ? '' : ' readonly'}></td>
            <td>${yaz ? `<button class="btn btn-ikincil btn-kucuk" data-baslik-sifirla="${a}" title="${U.esc(S.varsayilan[a].join(', '))}">Varsayılan</button>` : ''}</td></tr>`).join('')}
          </tbody></table>
        ${yaz ? '<button class="btn ust-bosluk" id="baslikKaydet">Başlıkları kaydet</button>' : ''}`;
    } else if (sekme === 'grup') {
      const gl = API.grupListe();
      const calSay = {}, bolSay = {};
      API.calismaListe().forEach(c => { calSay[c.grup_kod] = (calSay[c.grup_kod] || 0) + 1; });
      API.butceBolumuListe(null).forEach(b => { bolSay[b.grup_kod] = (bolSay[b.grup_kod] || 0) + 1; });
      icerik = `<div class="kart-aciklama">Bütçe gruplar hâlinde tutulur (örn. birim, işyeri ya da şube); her grubun her yılı ayrı
          bir çalışmadır ve üst çubuktaki grup düğmeleri bu listeden gelir. Kod kayıttan sonra değişmez; ad ve sıra değiştirilebilir.
          Sistem yöneticisi dışındaki kullanıcıların yeni grubu görmesi için Kullanıcılar ekranından erişim verin.</div>
        ${gl.length ? '' : `<div class="uyari uyari-dikkat"><span class="ik">ℹ</span><div>Henüz grup tanımlanmamış. Çalışma ve bütçe
          bölümü açabilmek için önce bir grup ekleyin.</div></div>`}
        ${C.tablo([
          { baslik: 'Sıra', sinif: 'num', deger: g => g.sira == null ? '' : g.sira },
          { baslik: 'Kod', sinif: 'mono', deger: g => U.esc(g.kod) }, { baslik: 'Ad', alan: 'ad' },
          { baslik: 'Çalışma', sinif: 'num', deger: g => calSay[g.kod] || '<span class="cok-soluk">0</span>' },
          { baslik: 'Bütçe bölümü', sinif: 'num', deger: g => bolSay[g.kod] || '<span class="cok-soluk">0</span>' },
          { baslik: '', sinif: 'sag-hiza', deger: g => `<button class="ikon-btn satir-duzenle" data-grup-duzenle="${U.esc(g.kod)}" title="Ad / sıra">✎</button>
              <button class="ikon-btn satir-sil" data-grup-sil="${U.esc(g.kod)}" title="Sil">🗑</button>` },
        ], gl, { bosMesaj: 'Grup yok.' })}
        <button class="btn ust-bosluk" id="yeniGrup">+ Yeni Grup</button>`;
    } else if (!grupSec) {
      // Görülebilen grup yok: bölüm listesi gruba bağlıdır (grupsuz çağrı bütün grupların bölümlerini döndürür)
      icerik = `<div class="uyari uyari-dikkat"><span class="ik">ℹ</span><div>${yonetici
          ? `Henüz grup tanımlanmamış. Bütçe bölümleri bir gruba bağlıdır; önce <strong>Gruplar</strong> sekmesinden bir grup ekleyin.
             <div class="ust-bosluk"><button class="btn btn-kucuk" data-sekme="grup">Gruplar sekmesine geç</button></div>`
          : 'Size atanmış bir grup yok. Sistem yöneticinizden grup erişimi isteyin.'}</div></div>`;
    } else {
      const l = API.butceBolumuListe(grupSec);
      const say = API.bolumKisiSayilari(grupSec, yil);
      icerik = `<div class="satir" style="margin-bottom:10px"><span class="kucuk soluk">Grup:</span>
          <select id="grupSec">${C.secenekler(gruplar.map(g => ({ deger: g.kod, etiket: g.ad })), grupSec)}</select>
          <span class="kucuk soluk">Numara ada yazılmaz; "Sıra" alanından verilir ve her ekranda "08 PAZARLAMA" biçiminde görünür.
            Aynı numara iki bölüme verilemez.</span></div>
        ${C.tablo([
          { baslik: 'Sıra', sinif: 'num mono', deger: b => String(b.sira).padStart(2, '0') },
          { baslik: 'Bütçe Bölümü', alan: 'ad' },
          { baslik: yil + ' kişi', sinif: 'num', deger: b => say[b.ad] || '<span class="cok-soluk">0</span>' },
          { baslik: '', sinif: 'sag-hiza', deger: b => yaz ? `<button class="ikon-btn satir-duzenle" data-bolum="${b.id}" title="Düzenle / birleştir">✎</button>
              <button class="ikon-btn satir-sil" data-bolum-sil="${b.id}" title="Sil">🗑</button>` : '' },
        ], l, { bosMesaj: 'Bu grupta bütçe bölümü yok.' })}
        ${yaz ? '<button class="btn ust-bosluk" id="yeniBolum">+ Yeni Bütçe Bölümü</button>' : ''}`;
    }

    kap.innerHTML = `
      <div class="kart">
        <div class="sekme-cubuk">
          ${[['tur', 'Hesaplama Türleri'], ['kanun', 'Kanun / Teşvik Türleri'], ['grup', 'Gruplar'], ['bolum', 'Bütçe Bölümleri'],
             ['baslik', 'İçe Aktarma Başlıkları']]
            .filter(s => s[0] !== 'grup' || yonetici).map(s =>
            `<button class="btn btn-ikincil btn-kucuk${sekme === s[0] ? ' etkin' : ''}" data-sekme="${s[0]}">${s[1]}</button>`).join('')}
        </div>
        ${icerik}
      </div>`;

    kap.querySelectorAll('[data-sekme]').forEach(b => b.onclick = () => { sekme = b.getAttribute('data-sekme'); APP.tazele(); });
    // Grup değişikliği üst çubuğu da değiştirir (bütün ekranlar aynı grubu gösterir)
    const gs = U.el('grupSec'); if (gs) gs.onchange = e => { grupSec = e.target.value; APP.secimYap(null, grupSec); };
    // Gruplar sistem yöneticisinindir (parametre.yaz yetkisinden bağımsız)
    if (yonetici && sekme === 'grup') {
      U.el('yeniGrup').onclick = () => grupForm(null);
      kap.addEventListener('click', e => {
        let b;
        if ((b = e.target.closest('[data-grup-duzenle]'))) return grupForm(API.grupListe().find(g => g.kod === b.getAttribute('data-grup-duzenle')));
        if ((b = e.target.closest('[data-grup-sil]'))) return grupSilSor(b.getAttribute('data-grup-sil'));
      });
    }
    if (!yaz) return;

    if (sekme === 'baslik') {
      const S = API.aktarimSozluk();
      kap.querySelectorAll('[data-baslik-sifirla]').forEach(b => b.onclick = () => {
        const a = b.getAttribute('data-baslik-sifirla');
        kap.querySelector(`[data-baslik="${a}"]`).value = S.varsayilan[a].join(', ');
      });
      U.el('baslikKaydet').onclick = () => {
        const yeni = {};
        kap.querySelectorAll('[data-baslik]').forEach(inp => {
          const a = inp.getAttribute('data-baslik');
          const l = inp.value.split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
          yeni[a] = l.join('|') === S.varsayilan[a].join('|') ? null : l;   // varsayılanla aynıysa kayıt tutulmaz
        });
        if (!(yeni.tc || S.varsayilan.tc).length) return U.bildir('T.C. alanı için en az bir başlık girilmeli.', 'hata');
        try { API.aktarimSozlukYaz(yeni); U.bildir('Aktarım başlıkları kaydedildi.', 'basari'); APP.tazele(); }
        catch (e) { U.bildir(e.message, 'hata'); }
      };
      return;
    }
    const yt = U.el('yeniTur'); if (yt) yt.onclick = () => turForm(yil, null);
    const yk = U.el('yeniKanun'); if (yk) yk.onclick = () => kanunForm(null);
    const yb = U.el('yeniBolum'); if (yb) yb.onclick = () => bolumForm(null);
    kap.addEventListener('click', async e => {
      let b;
      if ((b = e.target.closest('[data-tur]'))) return turForm(yil, API.hesapTuruListe(yil).find(t => t.kod === b.getAttribute('data-tur')));
      if ((b = e.target.closest('[data-kanun]'))) return kanunForm(API.kanunListe().find(k => k.kod === b.getAttribute('data-kanun')));
      if ((b = e.target.closest('[data-bolum]'))) return bolumForm(API.butceBolumuListe(grupSec).find(x => x.id === Number(b.getAttribute('data-bolum'))));
      const sil = async (mesaj, fn) => {
        if (!(await C.onay({ baslik: 'Sil', mesaj: mesaj, evetYazi: 'Sil', tehlike: true }))) return;
        try { fn(); APP.tazele(); } catch (err) { U.bildir(err.message, 'hata'); }
      };
      if ((b = e.target.closest('[data-tur-sil]'))) return sil(`<strong>${U.esc(b.getAttribute('data-tur-sil'))}</strong> silinecek.`,
        () => API.hesapTuruSil(yil, b.getAttribute('data-tur-sil')));
      if ((b = e.target.closest('[data-kanun-sil]'))) return sil(`<strong>${U.esc(b.getAttribute('data-kanun-sil'))}</strong> silinecek.`,
        () => API.kanunSil(b.getAttribute('data-kanun-sil')));
      if ((b = e.target.closest('[data-bolum-sil]'))) return sil('Bütçe bölümü silinecek.', () => API.butceBolumuSil(Number(b.getAttribute('data-bolum-sil'))));
    });
  }

  function oranAlan(ad, etiket, v) {
    return `<div class="alan"><label>${etiket} (%)</label>
      <input name="${ad}" class="num" value="${v == null ? '' : B.tlDuz(v * 100, 2).replace(/,00$/, '')}"></div>`;
  }

  function turForm(yil, t) {
    const k = t || { kol: 'SSK', gv: 1, dv: 1, istisna: 1 };
    const kip = C.kipAc({
      baslik: t ? 'Hesaplama Türü: ' + t.kod : 'Yeni Hesaplama Türü', altBaslik: yil + ' yılı',
      govde: `<div class="izgara izgara-2">
          <div class="alan"><label>Kod</label><input name="kod" class="mono" value="${U.esc(k.kod || '')}" ${t ? 'readonly' : ''}></div>
          <div class="alan"><label>Ad</label><input name="ad" value="${U.esc(k.ad || '')}"></div>
          <div class="alan"><label>SGK Kolu</label><select name="kol">${C.secenekler(KOL, k.kol)}</select></div>
          <div class="alan"><label>Sıra</label><input name="sira" type="number" value="${k.sira || 0}"></div>
          ${oranAlan('sgk_isci', 'SGK işçi', k.sgk_isci)}${oranAlan('issizlik_isci', 'İşsizlik işçi', k.issizlik_isci)}
          ${oranAlan('sgk_isveren', 'SGK işveren', k.sgk_isveren)}${oranAlan('issizlik_isveren', 'İşsizlik işveren', k.issizlik_isveren)}
        </div>
        <div class="satir">
          <label><input type="checkbox" name="gv" ${k.gv ? 'checked' : ''}> Gelir vergisi</label>
          <label><input type="checkbox" name="dv" ${k.dv ? 'checked' : ''}> Damga vergisi</label>
          <label><input type="checkbox" name="istisna" ${k.istisna ? 'checked' : ''}> Asgari ücret istisnası</label>
        </div>
        <div class="alan ust-bosluk"><label>Açıklama</label><input name="aciklama" value="${U.esc(k.aciklama || '')}"></div>`,
      altlik: `<button class="btn btn-ikincil" data-kip-kapat>Vazgeç</button><button class="btn" data-kaydet>Kaydet</button>`,
    });
    kip.querySelector('[data-kaydet]').onclick = () => {
      const f = C.formOku(kip);
      ['sgk_isci', 'issizlik_isci', 'sgk_isveren', 'issizlik_isveren'].forEach(a => { f[a] = API.trSayi(f[a]) / 100; });
      try { API.hesapTuruKaydet(yil, f); C.kipKapat(); APP.tazele(); } catch (e) { U.bildir(e.message, 'hata'); }
    };
  }

  function kanunForm(kn) {
    const k = kn || { kural: 'YOK' };
    const kip = C.kipAc({
      baslik: kn ? 'Kanun Türü: ' + kn.kod : 'Yeni Kanun Türü', genislik: 'dar',
      govde: `<div class="alan"><label>Kod</label><input name="kod" class="mono" value="${U.esc(k.kod || '')}" ${kn ? 'readonly' : ''}></div>
        <div class="alan"><label>Ad</label><input name="ad" value="${U.esc(k.ad || '')}"></div>
        <div class="alan"><label>Kural</label><select name="kural">${C.secenekler(KURAL, k.kural)}</select></div>
        <div class="alan"><label>05510 indirim oranı (%)</label><input name="oran" class="num" value="${k.oran == null ? '' : B.tlDuz(k.oran * 100, 2).replace(/,00$/, '')}" placeholder="boş = yıl parametresi">
          <div class="alan-not">Yalnızca kuralı 05510 olan türde kullanılır: imalat dışı %2, imalat %5.</div></div>
        <div class="alan"><label>Açıklama</label><input name="aciklama" value="${U.esc(k.aciklama || '')}"></div>
        <div class="alan"><label>Sıra</label><input name="sira" type="number" value="${k.sira || 0}"></div>`,
      altlik: `<button class="btn btn-ikincil" data-kip-kapat>Vazgeç</button><button class="btn" data-kaydet>Kaydet</button>`,
    });
    kip.querySelector('[data-kaydet]').onclick = () => {
      const f = C.formOku(kip); f.oran = String(f.oran || '').trim() === '' ? null : API.trSayi(f.oran) / 100;
      try { API.kanunKaydet(f); C.kipKapat(); APP.tazele(); } catch (e) { U.bildir(e.message, 'hata'); }
    };
  }

  function bolumForm(b) {
    const liste = API.butceBolumuListe(grupSec);
    const k = b || { grup_kod: grupSec, sira: liste.reduce((m, x) => Math.max(m, x.sira), 0) + 1 };
    const digerleri = b ? liste.filter(x => x.id !== b.id)
      .map(x => ({ deger: x.id, etiket: String(x.sira).padStart(2, '0') + ' ' + x.ad })) : [];
    const kip = C.kipAc({
      baslik: b ? 'Bütçe Bölümü' : 'Yeni Bütçe Bölümü', genislik: 'dar',
      govde: `<div class="izgara" style="grid-template-columns:90px 1fr">
          <div class="alan"><label>Sıra</label><input name="sira" type="number" min="1" value="${k.sira || ''}"></div>
          <div class="alan"><label>Ad</label><input name="ad" value="${U.esc(k.ad || '')}" placeholder="örn. PAZARLAMA"></div>
        </div>
        <div class="alan-not">Numarayı ada yazmayın. Ad değişirse bu bölümdeki bütçe satırları da güncellenir.</div>
        ${b && digerleri.length ? `<div class="ayrac"></div>
          <h3 class="bosluk-yok">Başka bölümle birleştir</h3>
          <div class="kucuk soluk" style="margin:6px 0">Mükerrer bölümler için: bu bölümdeki bütün kişiler (bütün yıllar) seçilen
            bölüme taşınır ve bu bölüm silinir.</div>
          <div class="satir"><select id="birlesHedef">${C.secenekler(digerleri, '', 'Hedef bölüm seçin…')}</select>
            <button class="btn btn-ikincil btn-kucuk" id="birlesBtn">Birleştir</button></div>` : ''}`,
      altlik: `<button class="btn btn-ikincil" data-kip-kapat>Vazgeç</button><button class="btn" data-kaydet>Kaydet</button>`,
    });
    kip.querySelector('[data-kaydet]').onclick = () => {
      const f = C.formOku(kip);
      try { API.butceBolumuKaydet({ id: k.id, grup_kod: k.grup_kod || grupSec, ad: f.ad, sira: f.sira }); C.kipKapat(); APP.tazele(); }
      catch (e) { U.bildir(e.message, 'hata'); }
    };
    const bb = kip.querySelector('#birlesBtn');
    if (bb) bb.onclick = async () => {
      const hid = Number(kip.querySelector('#birlesHedef').value);
      if (!hid) return U.bildir('Hedef bölümü seçin.', 'hata');
      const h = liste.find(x => x.id === hid);
      const ok = await C.onay({ baslik: 'Bölümleri Birleştir',
        mesaj: `<strong>${U.esc(b.ad)}</strong> bölümündeki kişiler <strong>${U.esc(h.ad)}</strong> bölümüne taşınacak ve
                <strong>${U.esc(b.ad)}</strong> silinecek.`, evetYazi: 'Birleştir' });
      if (!ok) return;
      try { const n = API.butceBolumuBirlestir(b.id, hid); C.kipHepsiniKapat(); U.bildir(n + ' bütçe satırı taşındı.', 'basari'); APP.tazele(); }
      catch (e) { U.bildir(e.message, 'hata'); }
    };
  }

  /* ------------------------------------------------------------------
     GRUPLAR — kod yalnız eklerken girilir (çalışmalar, bütçe bölümleri ve
     kullanıcı erişimleri koda bağlıdır); ad ve sıra sonradan değişir.
     ------------------------------------------------------------------ */
  function grupForm(g) {
    const k = g || { sira: API.grupListe().reduce((m, x) => Math.max(m, x.sira || 0), 0) + 1 };
    const kip = C.kipAc({
      baslik: g ? 'Grup: ' + g.ad : 'Yeni Grup', genislik: 'dar',
      govde: `<div class="alan"><label>Kod</label><input name="kod" class="mono" value="${U.esc(k.kod || '')}" ${g ? 'readonly' : ''} placeholder="örn. OFIS">
          <div class="alan-not">${g ? 'Kod değiştirilemez.' : '2–20 karakter: harf, rakam, tire, alt çizgi. Kaydedildikten sonra değiştirilemez.'}</div></div>
        <div class="alan"><label>Ad</label><input name="ad" value="${U.esc(k.ad || '')}" placeholder="örn. Ofis"></div>
        <div class="alan"><label>Sıra</label><input name="sira" type="number" min="1" value="${k.sira || ''}">
          <div class="alan-not">Üst çubukta ve listelerde gruplar bu sıraya göre dizilir.</div></div>`,
      altlik: `<button class="btn btn-ikincil" data-kip-kapat>Vazgeç</button><button class="btn" data-kaydet>Kaydet</button>`,
    });
    kip.querySelector('[data-kaydet]').onclick = () => {
      const f = C.formOku(kip);
      try {
        const kod = API.grupKaydet({ kod: g ? g.kod : f.kod, ad: f.ad, sira: f.sira }, !!g);
        C.kipKapat();
        U.bildir(g ? 'Grup güncellendi.' : 'Grup eklendi.', 'basari');
        grupDegisti(kod);
      } catch (e) { U.bildir(e.message, 'hata'); }
    };
  }

  async function grupSilSor(kod) {
    const g = API.grupListe().find(x => x.kod === kod);
    if (!g) return;
    const n = API.calismaListe().filter(c => c.grup_kod === kod).length;
    if (n) return U.bildir(`${g.ad} grubunun ${n} bütçe çalışması var; grup silinmeden önce çalışmaları Bütçe Çalışmaları ekranından silin.`, 'hata');
    const ok = await C.onay({ baslik: 'Grubu Sil', mesaj: `<strong>${U.esc(g.ad)}</strong> (${U.esc(g.kod)}) grubu silinecek.`,
      detay: 'Grubun bütçe bölümü tanımları ve kullanıcıların bu gruba erişim kayıtları da silinir.', evetYazi: 'Sil', tehlike: true });
    if (!ok) return;
    try { API.grupSil(kod); U.bildir('Grup silindi.', 'basari'); grupDegisti(null); }
    catch (e) { U.bildir(e.message, 'hata'); }
  }

  /* Grup eklenince / silinince / adı değişince üst çubuk da yenilenir. Seçili grup artık
     geçerli değilse (silindi, hiç grup yoktu ya da "Tümü" için tek grup kaldı) başka gruba geçilir. */
  function grupDegisti(yeniKod) {
    const kodlar = API.gorunurGruplar().map(g => g.kod);
    const ag = APP.grup();
    const gecerli = ag === 'TUMU' ? kodlar.length > 1 : kodlar.indexOf(ag) >= 0;
    if (!gecerli && kodlar.length) return APP.secimYap(null, kodlar.indexOf(yeniKod) >= 0 ? yeniKod : kodlar[0]);
    APP.calismaSeciciCiz();
    APP.tazele();
  }

  APP.modulKaydet({
    id: 'tanim', ad: 'Tanımlar', ikon: '📋', grup: 'Tanımlar',
    baslik: 'Tanımlar', altBaslik: 'Hesaplama türleri, kanun türleri, gruplar, bütçe bölümleri, içe aktarma başlıkları',
    yetki: 'parametre.oku', ciz: ciz,
  });
})();
