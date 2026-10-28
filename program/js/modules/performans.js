/* =====================================================================
   PERFORMANS DEĞERLENDİRME — seçili grubun çalışması

   Amir değerlendirmeleri programa elle girilir ya da dışarıda Excel
   şablonunda toplanıp geri alınır; şablon T.C. kimlik numarasıyla eşleşir.
   Değerlendirme kullanmayan grupta ekran boş kalır, herkesin çarpanı 1'dir.

   · Girdiler çalışmaya kayıtlıdır (performans_girdi); puan ve çarpan
     her açılışta js/core/performans.js ile hesaplanır. Kriter adları,
     ağırlıklar ve ek puan alanları PERF.MODEL / PERF.AMIR'den okunur;
     burada sabit yazılmaz.
   · Excel şablonu: her yaka için bir sayfa (PERF.MODEL[yaka].sayfa) ve
     AÇIKLAMA sayfası; sarı hücreler doldurulur, satırlar T.C. ile eşleşir.
     İçe alırken önce değişiklikler gösterilir.
   · Çarpan zam hesabına kendiliğinden geçmez: "Çarpanları uygula" ile
     kişilerin zam çarpanı yazılır (ekranda uygulanmamış fark gösterilir).
   ===================================================================== */
(function () {
  'use strict';

  let yaka = 'M';
  let arama = '';
  let onizleme = null;          // Excel içe alma önizlemesi { calismaId, dosya, kisi:[…], … }

  const SARI = 'FFFFF2CC', LACIVERT = 'FF1F3A5F', ACIK = 'FFE9EFF7';
  const B_TC = 'T.C. KİMLİK NO';
  const sayi1 = x => x == null ? '<span class="cok-soluk">—</span>' : B.tlDuz(x, 1);
  const sayi2 = x => x == null ? '<span class="cok-soluk">—</span>' : B.tlDuz(x, 2);
  const norm = s => U.normalize(String(s == null ? '' : s)).replace(/\s+/g, ' ').trim();

  /* Excel başlıkları — içe alırken de aynı başlıklarla eşleşir */
  function sutunlar(y) {
    const m = PERF.MODEL[y];
    const l = [{ alan: 'grup', baslik: 'DEĞERLENDİRME BÖLÜMÜ', metin: true, g: 24 }];
    PERF.AMIR.forEach(a => l.push({ alan: a[0], baslik: a[1] + ' ADI', metin: true, g: 20 }));
    PERF.AMIR.forEach((a, i) => m.kriter.forEach(k =>
      l.push({ alan: 'a' + (i + 1) + '.' + k[0], baslik: a[1] + ' - ' + k[1], puan: true, g: 11, amir: i })));
    m.ek.forEach(e => l.push({ alan: e.alan, baslik: e.ad, metin: !!e.metin, liste: e.liste, g: e.metin ? 16 : 12, ek: true }));
    return l;
  }
  /* Değer aralığı: kriter puanları ve devamlılık oranı 0–100; tutanak ve kıdem 0 ve üzeri.
     Modele yeni bir sayısal ek alan eklenirse aralığı buraya da yazılmalıdır. */
  const ARALIK = { devam: [0, 100], tutanak: [0, 99], kidem: [0, 99] };
  const aralikOf = alan => /^a\d\./.test(alan) ? [0, 100] : ARALIK[alan];

  function veri(c) {
    const h = API.calismaHesapla(c.id);
    const g = API.performansGirdiHarita(c.id);
    const kisiler = h.kisiler.map(s => ({ tc: s.kp.tc_kimlik_no, yaka: s.kp.yaka === 'M' ? 'M' : 'B', g: g[s.kp.tc_kimlik_no] || {}, s: s }));
    const sonuc = PERF.hesapla(kisiler);
    let uygulanmamis = 0;
    kisiler.forEach(k => {
      const r = sonuc.kisi[k.tc];
      const yeni = r ? r.carpan : null;
      const eski = k.s.kp.performans_carpani == null || k.s.kp.performans_carpani === '' ? null : Number(k.s.kp.performans_carpani);
      k.r = r; k.uygulanan = eski;
      // boş çarpan = 1 (değerlendirilmeyen kişi)
      k.fark = Math.abs((yeni == null ? 1 : yeni) - (eski == null ? 1 : eski)) > 1e-9;
      if (k.fark) uygulanmamis++;
    });
    return { h, g, kisiler, sonuc, uygulanmamis };
  }

  function ciz(kap) {
    const c = APP.calisma();
    const V = veri(c);
    const yaz = API.calismaYazilabilir(c) && API.yetkiVar('zam.yaz');
    const excel = API.yetkiVar('excel.aktar');
    const say = { M: 0, B: 0 }, top = { M: 0, B: 0 };
    V.kisiler.forEach(k => { top[k.yaka]++; if (k.r) say[k.yaka]++; });
    const m = PERF.MODEL[yaka];

    const durum = !V.uygulanmamis
      ? '<span class="rz rz-yesil">Zam hesabı güncel</span>'
      : `<span class="rz rz-ongoru">${V.uygulanmamis} kişide çarpan zam hesabına uygulanmamış</span>`;
    const perfKapali = !c.zam_performans
      ? `<div class="uyari uyari-dikkat"><span class="ik">⚠</span><div>Bu çalışmada zam <strong>performans çarpanı olmadan</strong>
         hesaplanıyor. "Çarpanları zam hesabına uygula" performansı da açar.</div></div>` : '';

    const liste = V.kisiler.filter(k => k.yaka === yaka)
      .filter(k => !arama || norm(k.s.kp.ad_soyad + ' ' + (k.g.grup || '') + ' ' + (k.s.kp.butce_bolumu || '')).includes(norm(arama)));

    kap.innerHTML = `
      <div class="kart">
        <div class="kart-baslik"><div><h2>Performans Değerlendirme — ${U.esc(c.grup_adi || c.grup_kod)}</h2>
          <div class="kart-aciklama">${c.yil} zammı için ${c.yil - 1} dönemi değerlendirmesi · ${U.esc(c.ad)}.
            Toplam puan, yakanın ortalamasına bölünerek zam çarpanı olur (ortalama kişi = 1,00).</div></div>
          <div class="btn-satir">
            ${excel ? '<button class="btn btn-ikincil" id="pfSablon">Excel şablonu indir</button>' : ''}
            ${excel && yaz ? '<label class="btn btn-ikincil">Excel\'den içe al…<input type="file" id="pfDosya" accept=".xlsx" class="gizli"></label>' : ''}
            ${yaz ? `<button class="btn" id="pfUygula"${V.uygulanmamis ? '' : ` disabled title="${say.M + say.B ? 'Uygulanacak fark yok. Çarpan = puan ÷ yakada değerlendirilenlerin ortalaması: tek kişi (ya da hepsi aynı puanda) değerlendirildiyse çarpan 1 çıkar. Ya da hesaplanan çarpanlar zaten uygulanmış.' : 'Henüz değerlendirme girilmedi — herkesin çarpanı 1.'}"`}>Çarpanları zam hesabına uygula</button>` : ''}
          </div></div>
        ${yaz && !V.uygulanmamis && !(say.M + say.B) ? `<div class="uyari uyari-bilgi"><span class="ik">ℹ</span><div>
          <strong>${c.yil} için henüz değerlendirme girilmedi</strong>; herkesin çarpanı 1 olduğu için uygulanacak bir şey yok (düğme bu yüzden kapalı).
          Kişiye tıklayıp değerlendirmeyi buradan girebilir ya da "Excel şablonu indir" ile değerlendirmeyi yapacak amirlere gönderip,
          doldurulunca "Excel'den içe al" ile alabilirsiniz; düğme o zaman açılır.
          ${c.yil - 1} değerlendirmesi taşınmaz: ${c.yil} zammı ${c.yil - 1} dönemi değerlendirmesiyle yapılır
          (şablonda bölüm, amir adları, mezuniyet ve kıdem geçen yıldan dolu gelir).</div></div>` : ''}
        ${(say.M && say.M < top.M) || (say.B && say.B < top.B) ? `<div class="uyari uyari-dikkat"><span class="ik">⚠</span><div>
          <strong>Değerlendirme eksik:</strong> ${say.M && say.M < top.M ? `mavi yakada ${top.M - say.M} kişi` : ''}${say.M && say.M < top.M && say.B && say.B < top.B ? ', ' : ''}${say.B && say.B < top.B ? `beyaz yakada ${top.B - say.B} kişi` : ''}
          değerlendirilmedi. Çarpan, yakada <em>değerlendirilenlerin</em> ortalamasına göre hesaplanır (tek kişi girilmişse onun çarpanı 1 çıkar);
          eksikler girildikçe herkesin çarpanı değişir. Uygulamadan önce tamamlamanız önerilir. (Değerlendirme dışı bırakılan yöneticiler gibi
          bilerek boş kalanlar çarpan 1 alır.)</div></div>` : ''}
        <div class="izgara izgara-4">
          <div class="stat"><div class="kucuk soluk">Mavi yaka değerlendirilen</div><div class="gosterge">${say.M} / ${top.M}</div>
            <div class="kucuk soluk">ortalama puan ${sayi2(V.sonuc.ort.M)}</div></div>
          <div class="stat"><div class="kucuk soluk">Beyaz yaka değerlendirilen</div><div class="gosterge">${say.B} / ${top.B}</div>
            <div class="kucuk soluk">ortalama puan ${sayi2(V.sonuc.ort.B)}</div></div>
          <div class="stat"><div class="kucuk soluk">Zam hesabı</div><div class="ust-bosluk">${durum}</div>
            <div class="kucuk soluk ust-bosluk">Değerlendirilmeyen kişinin çarpanı 1'dir.</div></div>
        </div>
        ${perfKapali}
      </div>
      <div id="pfOnizleme">${onizleme && onizleme.calismaId === c.id ? onizlemeHtml(onizleme, yaz) : ''}</div>
      <div class="kart">
        <div class="suzgec-satir">
          <div class="grup-dugmeler">
            <button class="${yaka === 'M' ? 'etkin' : ''}" data-yaka="M">Mavi yaka</button>
            <button class="${yaka === 'B' ? 'etkin' : ''}" data-yaka="B">Beyaz yaka</button>
          </div>
          <input id="pfAra" type="search" placeholder="Ad, bölüm ara… (Esc: temizle)" value="${U.esc(arama)}" style="max-width:240px">
          <span class="kucuk soluk">Satıra tıklayınca kişinin değerlendirmesi açılır.</span>
        </div>
        <h3 class="ust-bosluk">Bölüm düzeltme katsayısı — ${m.ad}</h3>
        <div class="kucuk soluk">Katsayı = bölüm ortalamalarının ortalaması (${sayi2((V.sonuc.genel || {})[yaka])}) / bölümün ortalaması.
          Not veren amirlerin cömertlik farkını dengeler.</div>
        <table class="genis-tablo param-tablo ust-bosluk" style="max-width:640px"><thead><tr><th>Değerlendirme bölümü</th>
          <th class="num">Kişi</th><th class="num">Ortalama değerlendirme</th><th class="num">Katsayı</th></tr></thead>
          <tbody>${V.sonuc.grup[yaka].map(g => `<tr><td>${U.esc(g.grup || '(bölüm yazılmamış)')}</td><td class="num">${g.kisi}</td>
            <td class="num">${sayi2(g.ort)}</td><td class="num">${B.tlDuz(g.kats, 4)}</td></tr>`).join('') ||
            '<tr><td colspan="4" class="soluk">Henüz değerlendirme yok.</td></tr>'}</tbody></table>
        <h3 class="ust-bosluk">Kişiler — ${m.ad} (${liste.length})</h3>
        <div class="tablo-sar ust-bosluk"><table class="genis-tablo" id="pfTablo"><thead><tr>
          <th>Adı soyadı</th><th>Bütçe bölümü</th><th>Değerlendirme bölümü</th>
          ${PERF.AMIR.map(a => `<th class="num">${a[1]}</th>`).join('')}
          <th class="num">Değerlendirme</th><th class="num">Katsayı</th><th class="num">Ek puan</th>
          <th class="num">Toplam puan</th><th class="num">Çarpan</th><th class="num">Zamda uygulanan</th><th class="num">Zam oranı öng.</th>
        </tr></thead><tbody>${liste.map(k => satirHtml(k)).join('')}</tbody></table></div>
      </div>`;

    kap.querySelectorAll('[data-yaka]').forEach(b => b.onclick = () => { yaka = b.getAttribute('data-yaka'); APP.tazele(); });
    C.canliArama('pfAra', v => { arama = v; });
    kap.querySelectorAll('#pfTablo tbody tr[data-tc]').forEach(tr => tr.onclick = () =>
      kisiAc(c, V.kisiler.find(k => k.tc === tr.getAttribute('data-tc')), yaz, V));
    const sb = U.el('pfSablon');
    if (sb) sb.onclick = () => sablonIndir(c, V).catch(e => { console.error(e); U.bildir('Excel oluşturulamadı: ' + e.message, 'hata'); });
    const d = U.el('pfDosya');
    if (d) d.onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { onizleme = await oku(c, V, f); APP.tazele(); }
      catch (err) { console.error(err); U.bildir(err.message, 'hata'); }
    };
    const ub = U.el('pfUygula');
    if (ub) ub.onclick = () => uygula(c, V);
    baglaOnizleme(c);
  }

  function satirHtml(k) {
    const r = k.r, kp = k.s.kp;
    const uyg = k.uygulanan == null ? '1,000' : B.tlDuz(k.uygulanan, 3);
    return `<tr data-tc="${U.esc(k.tc)}" style="cursor:pointer"${r ? '' : ' class="soluk"'}>
      <td>${U.esc(kp.ad_soyad)}${kp.gorev ? `<div class="kucuk cok-soluk">${U.esc(kp.gorev)}</div>` : ''}</td>
      <td class="kucuk">${U.esc(kp.butce_bolumu || '')}</td>
      <td class="kucuk">${U.esc(k.g.grup || '')}</td>
      ${PERF.AMIR.map((a, i) => `<td class="num">${sayi1(r ? r.amir[i] : null)}</td>`).join('')}
      <td class="num">${r ? sayi2(r.deg) : '<span class="kucuk">değerlendirilmedi</span>'}</td>
      <td class="num">${r ? B.tlDuz(r.kats, 4) : ''}</td>
      <td class="num">${r ? sayi2(r.ekToplam) : ''}</td>
      <td class="num kalin">${r ? sayi2(r.puan) : ''}</td>
      <td class="num kalin">${r ? B.tlDuz(r.carpan, 3) : '1,000'}</td>
      <td class="num${k.fark ? ' uyari-hucre' : ''}" title="${k.fark ? 'Hesaplanan çarpan henüz zam hesabına uygulanmadı' : ''}">${uyg}${k.fark ? ' ⚠' : ''}</td>
      <td class="num">${B.oran(k.s.zam.oranOngoru)}</td></tr>`;
  }

  /* ---------- Kişinin değerlendirmesi (görüntüle / düzenle) ---------- */
  function kisiAc(c, k, yaz, V) {
    const m = PERF.MODEL[k.yaka], g = k.g, r = k.r;
    const ro = yaz ? '' : ' disabled';
    const gruplar = [...new Set(V.kisiler.filter(x => x.yaka === k.yaka && x.g.grup).map(x => x.g.grup))].sort((a, b) => a.localeCompare(b, 'tr'));
    const deger = a => g[a] == null ? '' : U.esc(String(g[a]).replace('.', ','));
    const govde = `
      <div class="izgara izgara-4">
        <div class="alan"><label>Değerlendirme bölümü</label><input data-pf="grup" list="pfGrupListe" value="${U.esc(g.grup || '')}"${ro}>
          <datalist id="pfGrupListe">${gruplar.map(x => `<option value="${U.esc(x)}">`).join('')}</datalist></div>
        ${PERF.AMIR.map(a => `<div class="alan"><label>${a[1]} adı</label><input data-pf="${a[0]}" value="${U.esc(g[a[0]] || '')}"${ro}></div>`).join('')}
      </div>
      <h3 class="ust-bosluk">Kriter puanları (0–100)</h3>
      <div class="tablo-sar"><table class="genis-tablo"><thead><tr><th>Kriter</th><th class="num">Ağırlık</th>
        ${PERF.AMIR.map(a => `<th class="num">${a[1]}<div class="kucuk soluk">ağırlık ${a[2]}</div></th>`).join('')}</tr></thead>
        <tbody>${m.kriter.map(kr => `<tr><td>${U.esc(kr[1])}</td><td class="num">${kr[2]}</td>
          ${PERF.AMIR.map((a, i) => `<td class="num"><input class="hucre-girdi" style="width:64px" data-pf="a${i + 1}.${kr[0]}"
            value="${deger('a' + (i + 1) + '.' + kr[0])}"${ro}></td>`).join('')}</tr>`).join('')}
          <tr class="kalin"><td>Amir puanı</td><td></td>${PERF.AMIR.map((a, i) => `<td class="num">${sayi1(r ? r.amir[i] : null)}</td>`).join('')}</tr>
        </tbody></table></div>
      <h3 class="ust-bosluk">Ek puanlar</h3>
      <table class="genis-tablo param-tablo"><tbody>${m.ek.map(e => `<tr><td>${U.esc(e.ad)}<div class="kucuk soluk">${U.esc(e.aciklama)}</div></td>
        <td class="num">${e.liste
          ? `<select data-pf="${e.alan}"${ro}><option value=""></option>${e.liste.map(x => `<option${String(g[e.alan] || '').toLocaleUpperCase('tr-TR') === x ? ' selected' : ''}>${x}</option>`).join('')}</select>`
          : `<input class="hucre-girdi" style="width:80px" data-pf="${e.alan}" value="${deger(e.alan)}"${ro}>`}</td>
        <td class="num">${r ? sayi2(r.ek[e.alan]) + ' puan' : ''}</td></tr>`).join('')}</tbody></table>
      ${r ? `<div class="uyari uyari-bilgi ust-bosluk"><span class="ik">Σ</span><div>
        Değerlendirme ${sayi2(r.deg)} × bölüm katsayısı ${B.tlDuz(r.kats, 4)} × ${m.degAgirlik}/100 + ek ${sayi2(r.ekToplam)}
        = <strong>${sayi2(r.puan)}</strong> puan → çarpan <strong>${B.tlDuz(r.carpan, 3)}</strong>
        (yaka ortalaması ${sayi2(V.sonuc.ort[k.yaka])}). Kaydedince bütün çarpanlar yeniden hesaplanır.</div></div>`
        : '<div class="uyari uyari-dikkat ust-bosluk"><span class="ik">ℹ</span><div>Bu kişi değerlendirilmemiş; zam çarpanı 1.</div></div>'}`;
    const kip = C.kipAc({
      baslik: k.s.kp.ad_soyad, altBaslik: m.ad + ' · ' + (k.s.kp.butce_bolumu || '') + ' · T.C. ' +
        (API.yetkiVar('alan.tc') ? k.tc : U.tcMaskele(k.tc)),
      genislik: 'genis', govde: govde,
      altlik: yaz ? `${Object.keys(g).length ? '<button class="btn btn-tehlike" data-sil>Değerlendirmeyi sil</button>' : ''}
        <button class="btn btn-ikincil" data-kip-kapat>Vazgeç</button><button class="btn" data-kaydet>Kaydet</button>`
        : '<button class="btn btn-ikincil" data-kip-kapat>Kapat</button>',
    });
    if (!yaz) return;
    kip.querySelector('[data-kaydet]').onclick = () => {
      try {
        const liste = [], hata = [];
        kip.querySelectorAll('[data-pf]').forEach(inp => {
          const alan = inp.getAttribute('data-pf');
          const d = denetle(alan, inp.value);
          if (d.hata) hata.push(d.hata);
          else if (String(d.deger == null ? '' : d.deger) !== String(g[alan] == null ? '' : g[alan])) liste.push({ tc: k.tc, alan: alan, deger: d.deger });
        });
        if (hata.length) throw new Error(hata.join(' · '));
        if (liste.length) API.performansGirdiYaz(c.id, liste, 'elle ' + k.s.kp.ad_soyad);
        C.kipKapat(); U.bildir(liste.length ? 'Değerlendirme kaydedildi.' : 'Değişiklik yok.', 'basari'); APP.tazele();
      } catch (e) { U.bildir(e.message, 'hata'); }
    };
    const sil = kip.querySelector('[data-sil]');
    if (sil) sil.onclick = async () => {
      if (!await C.onay({ baslik: 'Değerlendirmeyi sil', mesaj: U.esc(k.s.kp.ad_soyad) + ' kişisinin bütün değerlendirme girdileri silinsin mi?', tehlike: true, evetYazi: 'Sil' })) return;
      try { API.performansGirdiSil(c.id, k.tc); C.kipHepsiniKapat(); APP.tazele(); } catch (e) { U.bildir(e.message, 'hata'); }
    };
  }

  /* Bir alanın değerini denetler → { deger } ya da { hata } */
  function denetle(alan, ham) {
    const v = ham == null ? '' : (ham instanceof Date ? '' : String(ham).trim());
    if (v === '') return { deger: null };
    if (PERF.metinAlan(alan)) return { deger: alan === 'egitim' ? v.toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ') : v.replace(/\s+/g, ' ') };
    const n = PERF.sayi(v);
    const a = aralikOf(alan) || [0, 1e9];
    const ad = (sutunlar('M').concat(sutunlar('B')).find(s => s.alan === alan) || {}).baslik || alan;
    if (n == null) return { hata: ad + ': "' + v + '" sayı değil' };
    if (n < a[0] || n > a[1]) return { hata: ad + ': ' + v + ' (' + a[0] + '–' + a[1] + ' arası olmalı)' };
    return { deger: n };
  }

  /* ---------- Çarpanları zam hesabına uygula ---------- */
  async function uygula(c, V) {
    const harita = {}; let n = 0, deg = 0;
    V.kisiler.forEach(k => { if (k.r) { harita[k.tc] = k.r.carpan; n++; } if (k.fark) deg++; });
    const ok = await C.onay({ baslik: 'Çarpanları uygula',
      mesaj: `${n} kişinin hesaplanan çarpanı zam öngörüsüne yazılacak; değerlendirilmeyen ${V.kisiler.length - n} kişinin çarpanı 1 olacak.
              Değişecek kişi: <strong>${deg}</strong>.`,
      detay: c.zam_performans ? '' : 'Bu çalışmada performansla zam hesabı da açılacak.', evetYazi: 'Uygula' });
    if (!ok) return;
    try { API.performansCarpanUygula(c.id, harita); U.bildir('Çarpanlar uygulandı; zam öngörüleri güncellendi.', 'basari'); APP.calismaSeciciCiz(); APP.tazele(); }
    catch (e) { U.bildir(e.message, 'hata'); }
  }

  /* ---------- Excel şablonu ---------- */
  async function sablonIndir(c, V) {
    if (!window.ExcelJS) throw new Error('Excel kütüphanesi yüklenemedi.');
    API.yetkiIste('excel.aktar');
    const once = API.performansOncekiDonem(c.id);
    // Yıldan yıla değişmeyen bilgiler: geçen yılın değerlendirmesinden önceden doldurulur
    const kalici = ['grup'].concat(PERF.AMIR.map(a => a[0]), ['egitim', 'kidem']);
    const grupAd = String(c.grup_adi || c.grup_kod).toLocaleUpperCase('tr-TR');
    const kitap = new ExcelJS.Workbook();
    kitap.creator = 'Maaş Bütçe Sistemi'; kitap.created = new Date();
    let onceden = 0;
    ['M', 'B'].forEach(y => {
      const m = PERF.MODEL[y], S = sutunlar(y);
      const ws = kitap.addWorksheet(m.sayfa, { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }] });
      const SABIT = [{ b: B_TC, g: 14 }, { b: 'ADI SOYADI', g: 26 }, { b: 'BÜTÇE BÖLÜMÜ', g: 22 }, { b: 'GÖREVİ', g: 24 }, { b: 'İŞE GİRİŞ', g: 11 }];
      const K = SABIT.concat(S.map(s => ({ b: s.baslik, g: s.g, s: s })));
      K.forEach((k, i) => { ws.getColumn(i + 1).width = k.g; });
      ws.getCell('A1').value = `${c.yil} ${grupAd} PERFORMANS DEĞERLENDİRMESİ — ${m.sayfa} (dönem ${c.yil - 1})`;
      ws.getCell('A1').font = { bold: true, size: 13, color: { argb: LACIVERT } };
      ws.getCell('A2').value = 'Sarı hücreleri doldurun. Kriter puanları 0–100. T.C. KİMLİK NO sütununu silmeyin; programa alırken satırlar buna göre eşleşir. ' +
        'Sütun başlıklarını değiştirmeyin. Boş bırakılan hücre programda da boşaltılır.';
      ws.getCell('A2').font = { italic: true, size: 9, color: { argb: 'FF7A5210' } };
      // 3. satır: amir grupları
      const ilkKriter = SABIT.length + 1 + 1 + PERF.AMIR.length;   // grup + amir adları sonrası
      PERF.AMIR.forEach((a, i) => {
        const bas = ilkKriter + i * m.kriter.length, son = bas + m.kriter.length - 1;
        ws.mergeCells(3, bas, 3, son);
        const h = ws.getCell(3, bas);
        h.value = `${a[1]} (ağırlık ${a[2]})`; h.alignment = { horizontal: 'center' };
        h.font = { bold: true, color: { argb: LACIVERT } }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACIK } };
      });
      const bas = ws.getRow(4);
      K.forEach((k, i) => {
        const h = bas.getCell(i + 1);
        h.value = k.s && k.s.puan ? `${k.b} (${m.kriter.find(x => k.s.alan.endsWith('.' + x[0]))[2]})` : k.b;
        h.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
        h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LACIVERT } };
        h.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
      });
      bas.height = 54;
      const grupListe = [...new Set(V.kisiler.filter(k => k.yaka === y && k.g.grup).map(k => k.g.grup)
        .concat(once ? Object.keys(once.harita).map(t => once.harita[t].grup).filter(Boolean) : []))].sort((a, b) => a.localeCompare(b, 'tr'));
      let rn = 5;
      V.kisiler.filter(k => k.yaka === y).forEach(k => {
        const kp = k.s.kp, row = ws.getRow(rn);
        const o = once && once.harita[k.tc];
        row.getCell(1).value = API.yetkiVar('alan.tc') ? String(k.tc) : U.tcMaskele(k.tc);   // T.C.'yi tam görme yetkisi yoksa maskeli
        row.getCell(2).value = kp.ad_soyad; row.getCell(3).value = kp.butce_bolumu || ''; row.getCell(4).value = kp.gorev || '';
        row.getCell(5).value = kp.ise_giris ? U.tarihGoster(kp.ise_giris) : '';
        S.forEach((s, j) => {
          const cell = row.getCell(SABIT.length + 1 + j);
          let v = k.g[s.alan];
          if ((v == null || v === '') && !Object.keys(k.g).length && o && kalici.indexOf(s.alan) >= 0 && o[s.alan] != null) { v = o[s.alan]; onceden++; }
          if (v != null && v !== '') cell.value = s.metin ? String(v) : Number(v);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SARI } };
          cell.border = { left: { style: 'hair', color: { argb: 'FFBBBBBB' } }, bottom: { style: 'hair', color: { argb: 'FFBBBBBB' } } };
          if (s.liste) cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + s.liste.join(',') + '"'],
            showErrorMessage: true, errorStyle: 'warning', error: 'Listeden seçin.' };
          else if (s.alan === 'grup' && grupListe.length && grupListe.join(',').length < 250)
            cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + grupListe.join(',') + '"'],
              showErrorMessage: true, errorStyle: 'warning', error: 'Var olan bölümlerden biri değil — yeni bölüm olarak alınır.' };
          else if (!s.metin) {
            const a = aralikOf(s.alan) || [0, 100];
            cell.dataValidation = { type: 'decimal', operator: 'between', allowBlank: true, formulae: [a[0], a[1]],
              showErrorMessage: true, errorStyle: 'stop', error: a[0] + ' ile ' + a[1] + ' arasında bir sayı girin.' };
          }
        });
        row.getCell(1).font = { color: { argb: 'FF888888' }, size: 9 };
        rn++;
      });
    });
    // AÇIKLAMA sayfası
    const a = kitap.addWorksheet('AÇIKLAMA');
    a.getColumn(1).width = 46; a.getColumn(2).width = 12; a.getColumn(3).width = 90;
    const ekle = (x, kalin) => { const r = a.addRow(x); if (kalin) r.font = { bold: true, color: { argb: LACIVERT } }; return r; };
    ekle(['PUANLAMA (programın hesabı)'], true);
    ekle(['1) Amir puanı = Σ kriter puanı × kriter ağırlığı / 100']);
    ekle(['2) Değerlendirme = ' + PERF.AMIR.map(x => x[1] + ' ' + x[2]).join(', ') +
          ' ağırlıklı ortalama; puanı olmayan amirin ağırlığı diğerlerine dağıtılır']);
    ekle(['3) Bölüm katsayısı = bölüm ortalamalarının ortalaması / kişinin bölümünün ortalaması']);
    ekle(['4) Toplam puan = değerlendirme × katsayı × (' +
          ['M', 'B'].map(y => PERF.MODEL[y].ad.toLocaleLowerCase('tr-TR') + ' ' + PERF.MODEL[y].degAgirlik).join(' / ') +
          ') / 100 + ek puanlar']);
    ekle(['5) Zam çarpanı = toplam puan / yakanın ortalama toplam puanı (değerlendirilmeyen kişi: 1)']);
    ['M', 'B'].forEach(y => {
      const m = PERF.MODEL[y];
      a.addRow([]); ekle([m.sayfa + ' — kriterler', 'Ağırlık'], true);
      m.kriter.forEach(k => a.addRow([k[1], k[2]]));
      ekle([m.sayfa + ' — ek puanlar', '', 'Kural'], true);
      m.ek.forEach(e => a.addRow([e.ad, '', e.aciklama]));
    });
    if (onceden) { a.addRow([]); ekle(['Not'], true);
      a.addRow([`Henüz değerlendirmesi girilmemiş kişilerde bölüm, amir adları, mezuniyet ve kıdem ${once.calisma.yil} değerlendirmesinden önceden dolduruldu; kontrol edin. Kıdem geçen yılın değeridir — işyerindeki bütün çalışma dönemlerinin toplamı olarak güncelleyin.`]); }
    const buf = await kitap.xlsx.writeBuffer();
    U.indir(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${c.yil} ${grupAd} PERFORMANS DEĞERLENDİRME.xlsx`);
    API.log('DISA_AKTAR', 'performans_girdi', c.id, 'Excel şablonu');
  }

  /* ---------- Excel'den içe alma: önce önizleme ---------- */
  function hucre(v) {
    if (v == null) return null;
    if (typeof v === 'object') {
      if (v instanceof Date) return v;
      if (v.richText) return v.richText.map(t => t.text).join('');
      if ('result' in v) return v.result;
      if (v.text) return v.text;
    }
    return v;
  }

  async function oku(c, V, dosya) {
    if (!window.ExcelJS) throw new Error('Excel kütüphanesi yüklenemedi.');
    const kitap = new ExcelJS.Workbook();
    await kitap.xlsx.load(await dosya.arrayBuffer());
    // Başlık → alan (iki yakanın başlıkları; ağırlık eki "(30)" yok sayılır)
    const harita = {};
    ['M', 'B'].forEach(y => sutunlar(y).forEach(s => { harita[norm(s.baslik)] = s.alan; }));
    const bul = {}; V.kisiler.forEach(k => { bul[k.tc] = k; });
    const kisi = {}, bulunamayan = [], hata = [], uyari = [];
    let sayfa = 0, maskeli = 0;
    kitap.worksheets.forEach(ws => {
      let basSatir = 0; const sut = {}; let tcSut = 0;
      for (let rn = 1; rn <= Math.min(10, ws.rowCount) && !basSatir; rn++) {
        const row = ws.getRow(rn);
        for (let i = 1; i <= row.cellCount; i++) if (norm(hucre(row.getCell(i).value)) === norm(B_TC)) { basSatir = rn; tcSut = i; }
        if (basSatir) for (let i = 1; i <= row.cellCount; i++) {
          const b = norm(String(hucre(row.getCell(i).value) || '').replace(/\s*\(\d+([.,]\d+)?\)\s*$/, ''));
          if (harita[b]) sut[i] = harita[b];
        }
      }
      if (!basSatir || !Object.keys(sut).length) return;
      sayfa++;
      ws.eachRow((row, rn) => {
        if (rn <= basSatir) return;
        const tcHam = String(hucre(row.getCell(tcSut).value) || '').trim();
        if (/^\d{3}\*+\d{3}$/.test(tcHam)) { maskeli++; return; }   // maskeli T.C. eşleşmez
        const tc = tcHam.replace(/\D/g, '');
        if (tc.length !== 11) return;
        const k = bul[tc];
        if (!k) { bulunamayan.push({ tc: tc, ad: String(hucre(row.getCell(tcSut + 1).value) || ''), sayfa: ws.name }); return; }
        const gecerli = new Set(PERF.alanlar(k.yaka));
        const yeni = {};
        Object.keys(sut).forEach(i => {
          const alan = sut[i];
          if (!gecerli.has(alan)) return;
          const d = denetle(alan, hucre(row.getCell(Number(i)).value));
          if (d.hata) hata.push(k.s.kp.ad_soyad + ' — ' + d.hata);
          else yeni[alan] = d.deger;
        });
        if (yeni.egitim && PERF.EGITIM.indexOf(yeni.egitim) < 0) uyari.push(k.s.kp.ad_soyad + ': mezuniyet "' + yeni.egitim + '" listede yok');
        if ((PERF.MODEL[k.yaka].sayfa !== ws.name) && Object.keys(yeni).length) uyari.push(k.s.kp.ad_soyad + ' ' + ws.name + ' sayfasında ama ' + PERF.MODEL[k.yaka].ad);
        kisi[tc] = Object.assign(kisi[tc] || {}, yeni);
      });
    });
    if (!sayfa) throw new Error('Dosyada "T.C. KİMLİK NO" ve değerlendirme başlıkları olan bir sayfa bulunamadı. Programdan indirilen şablonu kullanın.');
    if (maskeli && !Object.keys(kisi).length && !bulunamayan.length)
      throw new Error('Bu dosyadaki T.C. numaraları maskeli (dosya, T.C. Kimlik No\'yu tam görme yetkisi olmayan bir kullanıcı ' +
                      'tarafından alınmış). Kişiler T.C. ile eşleştirildiği için içeri alınamaz; dosyayı bu yetkiye sahip bir kullanıcıya aldırın.');
    // Değişiklikler
    const degisen = [], liste = [];
    Object.keys(kisi).forEach(tc => {
      const k = bul[tc], eski = k.g, yeni = kisi[tc];
      const alanlar = [];
      Object.keys(yeni).forEach(al => {
        const e = eski[al] == null ? '' : String(eski[al]), y = yeni[al] == null ? '' : String(yeni[al]);
        if (PERF.metinAlan(al) ? e !== y : (PERF.sayi(e) !== PERF.sayi(y))) { alanlar.push(al); liste.push({ tc: tc, alan: al, deger: yeni[al] }); }
      });
      if (alanlar.length) degisen.push({ tc: tc, alanlar: alanlar });
    });
    // Etki: yeni girdilerle çarpanlar
    const yeniG = {}; V.kisiler.forEach(k => { yeniG[k.tc] = Object.assign({}, k.g); });
    liste.forEach(x => { if (x.deger == null) delete yeniG[x.tc][x.alan]; else yeniG[x.tc][x.alan] = x.deger; });
    const yeniS = PERF.hesapla(V.kisiler.map(k => ({ tc: k.tc, yaka: k.yaka, g: yeniG[k.tc] })));
    const etki = V.kisiler.map(k => ({ k: k, eski: k.r ? k.r.carpan : null, yeni: yeniS.kisi[k.tc] ? yeniS.kisi[k.tc].carpan : null,
      puan: yeniS.kisi[k.tc] ? yeniS.kisi[k.tc].puan : null }))
      .filter(x => Math.abs((x.yeni == null ? 1 : x.yeni) - (x.eski == null ? 1 : x.eski)) > 1e-9);
    return { calismaId: c.id, dosya: dosya.name, okunan: Object.keys(kisi).length, degisen, liste, etki,
             bulunamayan, hata, uyari, yeniSay: Object.keys(yeniS.kisi).length };
  }

  function onizlemeHtml(o, yaz) {
    const ad = tc => { const k = APP.calisma() && API.calismaHesapla(o.calismaId).kisiler.find(s => s.kp.tc_kimlik_no === tc); return k ? k.kp.ad_soyad : tc; };
    return `<div class="kart">
      <div class="kart-baslik"><div><h2>İçe alma önizlemesi — ${U.esc(o.dosya)}</h2>
        <div class="kart-aciklama">${o.okunan} kişi okundu · <strong>${o.degisen.length}</strong> kişide ${o.liste.length} alan değişecek ·
          sonrasında ${o.yeniSay} kişi değerlendirilmiş olacak. Onaylamadan hiçbir şey yazılmaz.</div></div>
        <div class="btn-satir"><button class="btn btn-ikincil" id="pfOnVazgec">Vazgeç</button>
          ${yaz ? `<button class="btn" id="pfOnUygula"${o.liste.length && !o.hata.length ? '' : ' disabled'}>İçe al</button>` : ''}</div></div>
      ${o.hata.length ? `<div class="uyari uyari-hata"><span class="ik">⚠</span><div><strong>${o.hata.length} hatalı değer</strong> — dosyayı düzeltip yeniden seçin:
        <ul class="kucuk">${o.hata.slice(0, 30).map(x => `<li>${U.esc(x)}</li>`).join('')}${o.hata.length > 30 ? '<li>…</li>' : ''}</ul></div></div>` : ''}
      ${o.bulunamayan.length ? `<div class="uyari uyari-dikkat"><span class="ik">ℹ</span><div><strong>${o.bulunamayan.length} T.C. bu çalışmada yok</strong> (alınmayacak):
        ${o.bulunamayan.slice(0, 20).map(x => U.esc((x.ad || '') + ' ' + U.tcMaskele(x.tc))).join(', ')}${o.bulunamayan.length > 20 ? '…' : ''}</div></div>` : ''}
      ${o.uyari.length ? `<div class="uyari uyari-dikkat"><span class="ik">ℹ</span><div><ul class="kucuk">${o.uyari.slice(0, 20).map(x => `<li>${U.esc(x)}</li>`).join('')}</ul></div></div>` : ''}
      ${o.etki.length ? `<h3 class="ust-bosluk">Çarpanı değişecek kişiler (${o.etki.length})</h3>
        <div class="tablo-sar"><table class="genis-tablo"><thead><tr><th>Adı soyadı</th><th>Yaka</th><th class="num">Şimdiki çarpan</th>
          <th class="num">Yeni puan</th><th class="num">Yeni çarpan</th></tr></thead><tbody>${o.etki.slice(0, 300).map(x => `<tr>
          <td>${U.esc(x.k.s.kp.ad_soyad)}</td><td>${x.k.yaka}</td><td class="num">${x.eski == null ? '1,000 (yok)' : B.tlDuz(x.eski, 3)}</td>
          <td class="num">${sayi2(x.puan)}</td><td class="num kalin">${x.yeni == null ? '1,000 (yok)' : B.tlDuz(x.yeni, 3)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${o.degisen.length && !o.etki.length ? '<div class="kucuk soluk">Değişiklikler çarpanı etkilemiyor (ad, bölüm adı gibi bilgiler).</div>' : ''}
    </div>`;
  }

  function baglaOnizleme(c) {
    const v = U.el('pfOnVazgec');
    if (v) v.onclick = () => { onizleme = null; APP.tazele(); };
    const u = U.el('pfOnUygula');
    if (u) u.onclick = () => {
      try {
        API.performansGirdiYaz(c.id, onizleme.liste, 'Excel: ' + onizleme.dosya);
        U.bildir(onizleme.degisen.length + ' kişinin değerlendirmesi içe alındı. Çarpanları zam hesabına uygulamayı unutmayın.', 'basari');
        onizleme = null; APP.tazele();
      } catch (e) { U.bildir(e.message, 'hata'); }
    };
  }

  APP.modulKaydet({
    id: 'performans', ad: 'Performans Değerlendirme', ikon: '🎯', grup: 'Bütçe',
    baslik: 'Performans Değerlendirme', altBaslik: 'Amir değerlendirmeleri, bölüm katsayısı ve zam çarpanı',
    yetki: 'zam.oku', calismaGerekli: true, ciz: ciz,
  });
})();
