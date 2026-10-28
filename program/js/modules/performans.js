/* =====================================================================
   PERFORMANS DEĞERLENDİRME — seçili grubun çalışması

   Amir değerlendirmeleri programa elle girilir ya da dışarıda Excel
   şablonunda toplanıp geri alınır; şablon T.C. kimlik numarasıyla eşleşir.
   Değerlendirme kullanmayan grupta ekran boş kalır, herkesin çarpanı 1'dir.

   · Değerlendirme modeli (amirler, kriterler, ağırlıklar, ek puan kuralları)
     yıl bazında bir VERİDİR: bu ekrandaki "Değerlendirme modeli…" penceresinden
     düzenlenir. Ekran, şablon ve içe alma her şeyi derlenmiş modelden okur
     (API.calismaPerformansModeli: onaylı çalışmada onay anındaki model).
   · Kriter alanı = amirin öneki + kriter kodu (ör. 'a2.is_bilgisi'); önek
     amirin kendi alanından gelir, sıradan değil — amir silinse de diğerlerinin
     verisi kaymaz.
   · Girdiler çalışmaya kayıtlıdır (performans_girdi); puan ve çarpan her
     açılışta js/core/performans.js ile hesaplanır.
   · Excel şablonu: her yaka için bir sayfa ve AÇIKLAMA sayfası; sarı hücreler
     doldurulur, satırlar T.C. ile eşleşir. İçe alırken önce değişiklikler gösterilir.
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
  const YAKA_AD = { M: 'Mavi yaka', B: 'Beyaz yaka' };
  const sayi1 = x => x == null ? '<span class="cok-soluk">—</span>' : B.tlDuz(x, 1);
  const sayi2 = x => x == null ? '<span class="cok-soluk">—</span>' : B.tlDuz(x, 2);
  const sy = x => x == null || !isFinite(x) ? '' : B.tlDuz(x, Number.isInteger(Number(x)) ? 0 : 2);   // ağırlık / sınır gösterimi
  const ms = x => String(Math.round(Number(x) * 1000) / 1000).replace('.', ',');                    // Excel metni
  const norm = s => U.normalize(String(s == null ? '' : s)).replace(/\s+/g, ' ').trim();
  const ONEK = /^a\d+\./;       // kriter alanı: <amir öneki><kriter kodu>
  const listeYaz = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' ve ' + l[l.length - 1] : l.join('');

  /* ---------- Modelden okunan yardımcılar (M = derlenmiş model) ---------- */
  /* Excel başlıkları — içe alırken de aynı başlıklarla eşleşir */
  function sutunlar(M, y) {
    const t = M[y];
    const l = [{ alan: 'grup', baslik: 'DEĞERLENDİRME BÖLÜMÜ', metin: true, g: 24 }];
    M.amir.forEach(a => l.push({ alan: a[0], baslik: a[1] + ' ADI', metin: true, g: 20 }));
    M.amir.forEach((a, i) => t.kriter.forEach(k =>
      l.push({ alan: a[3] + k[0], baslik: a[1] + ' - ' + k[1], puan: true, agirlik: k[2], g: 11, amir: i })));
    t.ek.forEach(e => l.push({ alan: e.alan, baslik: e.ad, metin: !!e.metin, liste: e.liste, sinir: e.sinir, g: e.metin ? 16 : 12, ek: e }));
    return l;
  }
  const ekBul = (M, y, alan) => M[y].ek.find(e => e.alan === alan) || null;
  const metinMi = (M, y, alan) => { const e = ekBul(M, y, alan); return e ? !!e.metin : (!ONEK.test(alan) && M.metinAlan(alan)); };
  /* Sayı alanının geçerli aralığı: kriter puanı 0–100; ek alanda modelin giriş sınırı (yoksa sınırsız) */
  const aralik = (M, y, alan) => ONEK.test(alan) ? [0, 100] : ((ekBul(M, y, alan) || {}).sinir || null);
  /* Yıldan yıla taşınan bilgiler: değerlendirme bölümü, amir adları ve modelde "taşınsın" işaretli ek alanlar */
  const kaliciAlanlar = (M, y) => ['grup'].concat(M.amir.map(a => a[0]), M[y].ek.filter(e => e.kalici).map(e => e.alan));
  const kaliciMetin = M => listeYaz(['değerlendirme bölümü', 'amir adları'].concat(
    [...new Set(['M', 'B'].reduce((l, y) => l.concat(M[y].ek.filter(e => e.kalici).map(e => e.ad.toLocaleLowerCase('tr-TR'))), []))]));
  /* Excel sayfa adları: geçersiz karakter atılır, 31 karakteri aşmaz; iki yaka ve AÇIKLAMA çakışmaz */
  function sayfaAdlari(M) {
    const temiz = s => String(s || '').replace(/[\\\/?*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28);
    const ayni = (a, b) => a.toLocaleUpperCase('tr-TR') === b.toLocaleUpperCase('tr-TR');
    const ad = { M: temiz(M.M.sayfa) || 'MAVİ YAKA', B: temiz(M.B.sayfa) || 'BEYAZ YAKA' };
    if (ayni(ad.M, 'AÇIKLAMA')) ad.M += ' 1';
    if (ayni(ad.B, 'AÇIKLAMA') || ayni(ad.B, ad.M)) ad.B += ' 2';
    return ad;
  }
  const sinirMetin = e => e && e.sinir ? sy(e.sinir[0]) + '–' + sy(e.sinir[1]) : '';

  function veri(c) {
    const M = API.calismaPerformansModeli(c.id);
    const h = API.calismaHesapla(c.id);
    const g = API.performansGirdiHarita(c.id);
    const kisiler = h.kisiler.map(s => ({ tc: s.kp.tc_kimlik_no, yaka: s.kp.yaka === 'M' ? 'M' : 'B', g: g[s.kp.tc_kimlik_no] || {}, s: s }));
    const sonuc = PERF.hesapla(kisiler, M);
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
    return { M, h, g, kisiler, sonuc, uygulanmamis };
  }

  function ciz(kap) {
    const c = APP.calisma();
    const V = veri(c), M = V.M;
    const yaz = API.calismaYazilabilir(c) && API.yetkiVar('zam.yaz');
    const excel = API.yetkiVar('excel.aktar');
    const say = { M: 0, B: 0 }, top = { M: 0, B: 0 };
    V.kisiler.forEach(k => { top[k.yaka]++; if (k.r) say[k.yaka]++; });
    const m = M[yaka];
    const modelBilgi = c.durum === 'ONAYLI' ? 'onay anındaki değerlendirme modeli'
      : (API.performansModeliHam(c.yil).varsayilan ? 'varsayılan (örnek) değerlendirme modeli' : c.yil + ' yılına özel değerlendirme modeli');
    const agirlikUyari = ['M', 'B'].filter(y => Math.abs(M.toplamAgirlik(y) - 100) > 1e-9)
      .map(y => `${U.esc(M[y].ad)} kriter ağırlıkları toplamı ${sy(M.toplamAgirlik(y))} (100 değil); amir puanı en çok ${sy(M.toplamAgirlik(y))} olur`);

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
          <div class="kart-aciklama">${c.yil} zammı için ${c.yil - 1} dönemi değerlendirmesi · ${U.esc(c.ad)} · ${modelBilgi}.
            Toplam puan, yakanın ortalamasına bölünerek zam çarpanı olur (ortalama kişi = 1,00).</div></div>
          <div class="btn-satir">
            <button class="btn btn-ikincil" id="pfModel" title="Amirler, kriterler, ağırlıklar ve ek puan kuralları">Değerlendirme modeli…</button>
            ${excel ? '<button class="btn btn-ikincil" id="pfSablon">Excel şablonu indir</button>' : ''}
            ${excel && yaz ? '<label class="btn btn-ikincil">Excel\'den içe al…<input type="file" id="pfDosya" accept=".xlsx" class="gizli"></label>' : ''}
            ${yaz ? `<button class="btn" id="pfUygula"${V.uygulanmamis ? '' : ` disabled title="${say.M + say.B ? 'Uygulanacak fark yok. Çarpan = puan ÷ yakada değerlendirilenlerin ortalaması: tek kişi (ya da hepsi aynı puanda) değerlendirildiyse çarpan 1 çıkar. Ya da hesaplanan çarpanlar zaten uygulanmış.' : 'Henüz değerlendirme girilmedi — herkesin çarpanı 1.'}"`}>Çarpanları zam hesabına uygula</button>` : ''}
          </div></div>
        ${yaz && !V.uygulanmamis && !(say.M + say.B) ? `<div class="uyari uyari-bilgi"><span class="ik">ℹ</span><div>
          <strong>${c.yil} için henüz değerlendirme girilmedi</strong>; herkesin çarpanı 1 olduğu için uygulanacak bir şey yok (düğme bu yüzden kapalı).
          Kişiye tıklayıp değerlendirmeyi buradan girebilir ya da "Excel şablonu indir" ile değerlendirmeyi yapacak amirlere gönderip,
          doldurulunca "Excel'den içe al" ile alabilirsiniz; düğme o zaman açılır.
          ${c.yil - 1} değerlendirmesi taşınmaz: ${c.yil} zammı ${c.yil - 1} dönemi değerlendirmesiyle yapılır
          (şablonda ${U.esc(kaliciMetin(M))} geçen yıldan dolu gelir).</div></div>` : ''}
        ${(say.M && say.M < top.M) || (say.B && say.B < top.B) ? `<div class="uyari uyari-dikkat"><span class="ik">⚠</span><div>
          <strong>Değerlendirme eksik:</strong> ${say.M && say.M < top.M ? `mavi yakada ${top.M - say.M} kişi` : ''}${say.M && say.M < top.M && say.B && say.B < top.B ? ', ' : ''}${say.B && say.B < top.B ? `beyaz yakada ${top.B - say.B} kişi` : ''}
          değerlendirilmedi. Çarpan, yakada <em>değerlendirilenlerin</em> ortalamasına göre hesaplanır (tek kişi girilmişse onun çarpanı 1 çıkar);
          eksikler girildikçe herkesin çarpanı değişir. Uygulamadan önce tamamlamanız önerilir. (Değerlendirme dışı bırakılan yöneticiler gibi
          bilerek boş kalanlar çarpan 1 alır.)</div></div>` : ''}
        ${agirlikUyari.length ? `<div class="uyari uyari-dikkat"><span class="ik">⚠</span><div>${agirlikUyari.join('<br>')}.
          Gerekirse "Değerlendirme modeli…" penceresinden düzeltin.</div></div>` : ''}
        <div class="izgara izgara-4">
          <div class="stat"><div class="kucuk soluk">${U.esc(M.M.ad)} değerlendirilen</div><div class="gosterge">${say.M} / ${top.M}</div>
            <div class="kucuk soluk">ortalama puan ${sayi2(V.sonuc.ort.M)}</div></div>
          <div class="stat"><div class="kucuk soluk">${U.esc(M.B.ad)} değerlendirilen</div><div class="gosterge">${say.B} / ${top.B}</div>
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
            <button class="${yaka === 'M' ? 'etkin' : ''}" data-yaka="M">${U.esc(M.M.ad)}</button>
            <button class="${yaka === 'B' ? 'etkin' : ''}" data-yaka="B">${U.esc(M.B.ad)}</button>
          </div>
          <input id="pfAra" type="search" placeholder="Ad, bölüm ara… (Esc: temizle)" value="${U.esc(arama)}" style="max-width:240px">
          <span class="kucuk soluk">Satıra tıklayınca kişinin değerlendirmesi açılır.</span>
        </div>
        <h3 class="ust-bosluk">Bölüm düzeltme katsayısı — ${U.esc(m.ad)}</h3>
        <div class="kucuk soluk">Katsayı = bölüm ortalamalarının ortalaması (${sayi2((V.sonuc.genel || {})[yaka])}) / bölümün ortalaması.
          Not veren amirlerin cömertlik farkını dengeler.</div>
        <table class="genis-tablo param-tablo ust-bosluk" style="max-width:640px"><thead><tr><th>Değerlendirme bölümü</th>
          <th class="num">Kişi</th><th class="num">Ortalama değerlendirme</th><th class="num">Katsayı</th></tr></thead>
          <tbody>${V.sonuc.grup[yaka].map(g => `<tr><td>${U.esc(g.grup || '(bölüm yazılmamış)')}</td><td class="num">${g.kisi}</td>
            <td class="num">${sayi2(g.ort)}</td><td class="num">${B.tlDuz(g.kats, 4)}</td></tr>`).join('') ||
            '<tr><td colspan="4" class="soluk">Henüz değerlendirme yok.</td></tr>'}</tbody></table>
        <h3 class="ust-bosluk">Kişiler — ${U.esc(m.ad)} (${liste.length})</h3>
        <div class="tablo-sar ust-bosluk"><table class="genis-tablo" id="pfTablo"><thead><tr>
          <th>Adı soyadı</th><th>Bütçe bölümü</th><th>Değerlendirme bölümü</th>
          ${M.amir.map(a => `<th class="num">${U.esc(a[1])}</th>`).join('')}
          <th class="num">Değerlendirme</th><th class="num">Katsayı</th><th class="num">Ek puan</th>
          <th class="num">Toplam puan</th><th class="num">Çarpan</th><th class="num">Zamda uygulanan</th><th class="num">Zam oranı öng.</th>
        </tr></thead><tbody>${liste.map(k => satirHtml(M, k)).join('')}</tbody></table></div>
      </div>`;

    kap.querySelectorAll('[data-yaka]').forEach(b => b.onclick = () => { yaka = b.getAttribute('data-yaka'); APP.tazele(); });
    C.canliArama('pfAra', v => { arama = v; });
    kap.querySelectorAll('#pfTablo tbody tr[data-tc]').forEach(tr => tr.onclick = () =>
      kisiAc(c, V.kisiler.find(k => k.tc === tr.getAttribute('data-tc')), yaz, V));
    U.el('pfModel').onclick = () => modelAc(c);
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

  function satirHtml(M, k) {
    const r = k.r, kp = k.s.kp;
    const uyg = k.uygulanan == null ? '1,000' : B.tlDuz(k.uygulanan, 3);
    return `<tr data-tc="${U.esc(k.tc)}" style="cursor:pointer"${r ? '' : ' class="soluk"'}>
      <td>${U.esc(kp.ad_soyad)}${kp.gorev ? `<div class="kucuk cok-soluk">${U.esc(kp.gorev)}</div>` : ''}</td>
      <td class="kucuk">${U.esc(kp.butce_bolumu || '')}</td>
      <td class="kucuk">${U.esc(k.g.grup || '')}</td>
      ${M.amir.map((a, i) => `<td class="num">${sayi1(r ? r.amir[i] : null)}</td>`).join('')}
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
    const M = V.M, m = M[k.yaka], g = k.g, r = k.r;
    const ro = yaz ? '' : ' disabled';
    const gruplar = [...new Set(V.kisiler.filter(x => x.yaka === k.yaka && x.g.grup).map(x => x.g.grup))].sort((a, b) => a.localeCompare(b, 'tr'));
    const deger = a => g[a] == null ? '' : U.esc(String(g[a]).replace('.', ','));
    const listeSecim = e => {
      const v = String(g[e.alan] == null ? '' : g[e.alan]).toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ').trim();
      const disarda = v && e.liste.indexOf(v) < 0;
      return `<select data-pf="${U.esc(e.alan)}"${ro}><option value=""></option>${e.liste.map(x =>
        `<option${v === x ? ' selected' : ''}>${U.esc(x)}</option>`).join('')}${disarda ? `<option value="${U.esc(v)}" selected>${U.esc(v)} (listede yok)</option>` : ''}</select>`;
    };
    const govde = `
      <div class="izgara izgara-4">
        <div class="alan"><label>Değerlendirme bölümü</label><input data-pf="grup" list="pfGrupListe" value="${U.esc(g.grup || '')}"${ro}>
          <datalist id="pfGrupListe">${gruplar.map(x => `<option value="${U.esc(x)}">`).join('')}</datalist></div>
        ${M.amir.map(a => `<div class="alan"><label>${U.esc(a[1])} adı</label><input data-pf="${a[0]}" value="${U.esc(g[a[0]] || '')}"${ro}></div>`).join('')}
      </div>
      <h3 class="ust-bosluk">Kriter puanları (0–100)</h3>
      <div class="tablo-sar"><table class="genis-tablo"><thead><tr><th>Kriter</th><th class="num">Ağırlık</th>
        ${M.amir.map(a => `<th class="num">${U.esc(a[1])}<div class="kucuk soluk">ağırlık ${sy(a[2])}</div></th>`).join('')}</tr></thead>
        <tbody>${m.kriter.map(kr => `<tr><td>${U.esc(kr[1])}</td><td class="num">${sy(kr[2])}</td>
          ${M.amir.map(a => `<td class="num"><input class="hucre-girdi" style="width:64px" data-pf="${a[3]}${kr[0]}"
            value="${deger(a[3] + kr[0])}"${ro}></td>`).join('')}</tr>`).join('')}
          <tr class="kalin"><td>Amir puanı</td><td class="num" title="Kriter ağırlıkları toplamı">${sy(M.toplamAgirlik(k.yaka))}</td>${M.amir.map((a, i) => `<td class="num">${sayi1(r ? r.amir[i] : null)}</td>`).join('')}</tr>
        </tbody></table></div>
      <h3 class="ust-bosluk">Ek puanlar</h3>
      ${m.ek.length ? `<table class="genis-tablo param-tablo"><tbody>${m.ek.map(e => `<tr><td>${U.esc(e.ad)}<div class="kucuk soluk">${U.esc(e.aciklama)}${e.sinir ? ' · giriş ' + sinirMetin(e) : ''}</div></td>
        <td class="num">${e.liste ? listeSecim(e)
          : `<input class="hucre-girdi" style="width:80px" data-pf="${U.esc(e.alan)}" value="${deger(e.alan)}"${ro}>`}</td>
        <td class="num">${r ? sayi2(r.ek[e.alan]) + ' puan' : ''}</td></tr>`).join('')}</tbody></table>`
        : '<div class="kucuk soluk">Bu yakada ek puan alanı yok.</div>'}
      ${r ? `<div class="uyari uyari-bilgi ust-bosluk"><span class="ik">Σ</span><div>
        Değerlendirme ${sayi2(r.deg)} × bölüm katsayısı ${B.tlDuz(r.kats, 4)} × ${sy(m.degAgirlik)}/100 + ek ${sayi2(r.ekToplam)}
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
          const d = denetle(M, k.yaka, alan, inp.value);
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

  /* Bir alanın değerini yakanın modeline göre denetler → { deger } ya da { hata }.
     Liste türü ek alan büyük harfe çevrilir; listede olup olmadığına içe almada bakılır. */
  function denetle(M, y, alan, ham) {
    const v = ham == null ? '' : (ham instanceof Date ? '' : String(ham).trim());
    if (v === '') return { deger: null };
    if (metinMi(M, y, alan)) {
      const d = v.replace(/\s+/g, ' ');
      const e = ekBul(M, y, alan);
      return { deger: e && e.liste ? d.toLocaleUpperCase('tr-TR') : d };
    }
    const n = PERF.sayi(v);
    const a = aralik(M, y, alan);
    const ad = (sutunlar(M, y).find(s => s.alan === alan) || {}).baslik || alan;
    if (n == null) return { hata: ad + ': "' + v + '" sayı değil' };
    if (a && (n < a[0] || n > a[1])) return { hata: ad + ': ' + v + ' (' + sy(a[0]) + '–' + sy(a[1]) + ' arası olmalı)' };
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
    const M = V.M, SA = sayfaAdlari(M);
    const once = API.performansOncekiDonem(c.id);
    const grupAd = String(c.grup_adi || c.grup_kod).toLocaleUpperCase('tr-TR');
    const kitap = new ExcelJS.Workbook();
    kitap.creator = 'Maaş Bütçe Sistemi'; kitap.created = new Date();
    let onceden = 0;
    ['M', 'B'].forEach(y => {
      const m = M[y], S = sutunlar(M, y);
      // Yıldan yıla değişmeyen bilgiler geçen yılın değerlendirmesinden önceden doldurulur
      const kalici = kaliciAlanlar(M, y);
      const ws = kitap.addWorksheet(SA[y], { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }] });
      const SABIT = [{ b: B_TC, g: 14 }, { b: 'ADI SOYADI', g: 26 }, { b: 'BÜTÇE BÖLÜMÜ', g: 22 }, { b: 'GÖREVİ', g: 24 }, { b: 'İŞE GİRİŞ', g: 11 }];
      const K = SABIT.concat(S.map(s => ({ b: s.baslik, g: s.g, s: s })));
      K.forEach((k, i) => { ws.getColumn(i + 1).width = k.g; });
      ws.getCell('A1').value = `${c.yil} ${grupAd} PERFORMANS DEĞERLENDİRMESİ — ${SA[y]} (dönem ${c.yil - 1})`;
      ws.getCell('A1').font = { bold: true, size: 13, color: { argb: LACIVERT } };
      ws.getCell('A2').value = 'Sarı hücreleri doldurun. Kriter puanları 0–100. T.C. KİMLİK NO sütununu silmeyin; programa alırken satırlar buna göre eşleşir. ' +
        'Sütun başlıklarını değiştirmeyin. Boş bırakılan hücre programda da boşaltılır.';
      ws.getCell('A2').font = { italic: true, size: 9, color: { argb: 'FF7A5210' } };
      // 3. satır: amir grupları
      const ilkKriter = SABIT.length + 1 + 1 + M.amir.length;   // grup + amir adları sonrası
      M.amir.forEach((a, i) => {
        const bas = ilkKriter + i * m.kriter.length, son = bas + m.kriter.length - 1;
        if (son > bas) ws.mergeCells(3, bas, 3, son);
        const h = ws.getCell(3, bas);
        h.value = `${a[1]} (ağırlık ${ms(a[2])})`; h.alignment = { horizontal: 'center' };
        h.font = { bold: true, color: { argb: LACIVERT } }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACIK } };
      });
      const bas = ws.getRow(4);
      K.forEach((k, i) => {
        const h = bas.getCell(i + 1);
        h.value = k.s && k.s.puan ? `${k.b} (${ms(k.s.agirlik)})` : k.b;
        h.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
        h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LACIVERT } };
        h.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
      });
      bas.height = 54;
      const grupListe = [...new Set(V.kisiler.filter(k => k.yaka === y && k.g.grup).map(k => k.g.grup)
        .concat(once ? Object.keys(once.harita).map(t => once.harita[t].grup).filter(Boolean) : []))].sort((a, b) => a.localeCompare(b, 'tr'));
      const listeUygun = l => l && l.length && l.join(',').length < 250 && !l.some(x => /[,"]/.test(x));
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
          if (v != null && v !== '') cell.value = s.metin ? String(v) : (PERF.sayi(v) == null ? String(v) : PERF.sayi(v));
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SARI } };
          cell.border = { left: { style: 'hair', color: { argb: 'FFBBBBBB' } }, bottom: { style: 'hair', color: { argb: 'FFBBBBBB' } } };
          if (s.liste) {
            if (listeUygun(s.liste)) cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + s.liste.join(',') + '"'],
              showErrorMessage: true, errorStyle: 'warning', error: 'Listeden seçin.' };
          } else if (s.alan === 'grup' && listeUygun(grupListe))
            cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + grupListe.join(',') + '"'],
              showErrorMessage: true, errorStyle: 'warning', error: 'Var olan bölümlerden biri değil — yeni bölüm olarak alınır.' };
          else if (!s.metin) {
            const a = aralik(M, y, s.alan);
            cell.dataValidation = a
              ? { type: 'decimal', operator: 'between', allowBlank: true, formulae: [a[0], a[1]],
                  showErrorMessage: true, errorStyle: 'stop', error: ms(a[0]) + ' ile ' + ms(a[1]) + ' arasında bir sayı girin.' }
              : { type: 'decimal', operator: 'between', allowBlank: true, formulae: [-1e9, 1e9],
                  showErrorMessage: true, errorStyle: 'stop', error: 'Bir sayı girin.' };
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
    ekle(['2) Değerlendirme = ' + M.amir.map(x => x[1] + ' ' + ms(x[2])).join(', ') +
          ' ağırlıklı ortalama; puanı olmayan amirin ağırlığı diğerlerine dağıtılır']);
    ekle(['3) Bölüm katsayısı = bölüm ortalamalarının ortalaması / kişinin bölümünün ortalaması']);
    ekle(['4) Toplam puan = değerlendirme × katsayı × (' +
          ['M', 'B'].map(y => M[y].ad.toLocaleLowerCase('tr-TR') + ' ' + ms(M[y].degAgirlik)).join(' / ') +
          ') / 100 + ek puanlar']);
    ekle(['5) Zam çarpanı = toplam puan / yakanın ortalama toplam puanı (değerlendirilmeyen kişi: 1)']);
    ['M', 'B'].forEach(y => {
      const m = M[y];
      a.addRow([]); ekle([SA[y] + ' — kriterler', 'Ağırlık'], true);
      m.kriter.forEach(k => a.addRow([k[1], k[2]]));
      a.addRow(['Toplam', M.toplamAgirlik(y)]).font = { italic: true };
      ekle([SA[y] + ' — ek puanlar', 'Giriş', 'Kural'], true);
      m.ek.forEach(e => a.addRow([e.ad, e.liste ? 'listeden' : (e.sinir ? ms(e.sinir[0]) + '–' + ms(e.sinir[1]) : 'sayı'),
        e.aciklama + (e.kalici ? ' (Önceki dönemden taşınır.)' : '')]));
      if (!m.ek.length) a.addRow(['(ek puan alanı yok)']);
    });
    if (onceden) { a.addRow([]); ekle(['Not'], true);
      a.addRow([`Henüz değerlendirmesi girilmemiş kişilerde ${kaliciMetin(M)} ${once.calisma.yil} değerlendirmesinden önceden dolduruldu; kontrol edin. ` +
                'Taşınan değerler geçen yılın değeridir; zamanla değişenleri (ör. süreye bağlı sayılar) güncelleyin.']); }
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
    const M = V.M, SA = sayfaAdlari(M);
    const kitap = new ExcelJS.Workbook();
    await kitap.xlsx.load(await dosya.arrayBuffer());
    // Başlık → alan, yaka başına (ağırlık eki "(30)" yok sayılır); kişinin yakasına göre okunur
    const harita = { M: {}, B: {} };
    ['M', 'B'].forEach(y => sutunlar(M, y).forEach(s => { harita[y][norm(s.baslik)] = s.alan; }));
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
          if (harita.M[b] || harita.B[b]) sut[i] = b;
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
        const gecerli = new Set(M.alanlar(k.yaka));
        const yeni = {};
        Object.keys(sut).forEach(i => {
          const alan = harita[k.yaka][sut[i]];
          if (!alan || !gecerli.has(alan)) return;
          const d = denetle(M, k.yaka, alan, hucre(row.getCell(Number(i)).value));
          if (d.hata) hata.push(k.s.kp.ad_soyad + ' — ' + d.hata);
          else yeni[alan] = d.deger;
        });
        M[k.yaka].ek.filter(e => e.liste).forEach(e => {
          const v = yeni[e.alan];
          if (v && e.liste.indexOf(v) < 0) uyari.push(`${k.s.kp.ad_soyad}: ${e.ad.toLocaleLowerCase('tr-TR')} "${v}" listede yok (${sy(e.puan(v))} puan sayılır)`);
        });
        if (SA[k.yaka].toLocaleUpperCase('tr-TR') !== String(ws.name).toLocaleUpperCase('tr-TR') && Object.keys(yeni).length)
          uyari.push(k.s.kp.ad_soyad + ' ' + ws.name + ' sayfasında ama ' + M[k.yaka].ad);
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
        if (metinMi(M, k.yaka, al) ? e !== y : (PERF.sayi(e) !== PERF.sayi(y))) { alanlar.push(al); liste.push({ tc: tc, alan: al, deger: yeni[al] }); }
      });
      if (alanlar.length) degisen.push({ tc: tc, alanlar: alanlar });
    });
    // Etki: yeni girdilerle çarpanlar
    const yeniG = {}; V.kisiler.forEach(k => { yeniG[k.tc] = Object.assign({}, k.g); });
    liste.forEach(x => { if (x.deger == null) delete yeniG[x.tc][x.alan]; else yeniG[x.tc][x.alan] = x.deger; });
    const yeniS = PERF.hesapla(V.kisiler.map(k => ({ tc: k.tc, yaka: k.yaka, g: yeniG[k.tc] })), M);
    const etki = V.kisiler.map(k => ({ k: k, eski: k.r ? k.r.carpan : null, yeni: yeniS.kisi[k.tc] ? yeniS.kisi[k.tc].carpan : null,
      puan: yeniS.kisi[k.tc] ? yeniS.kisi[k.tc].puan : null }))
      .filter(x => Math.abs((x.yeni == null ? 1 : x.yeni) - (x.eski == null ? 1 : x.eski)) > 1e-9);
    return { calismaId: c.id, dosya: dosya.name, okunan: Object.keys(kisi).length, degisen, liste, etki,
             bulunamayan, hata, uyari, yeniSay: Object.keys(yeniS.kisi).length };
  }

  function onizlemeHtml(o, yaz) {
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

  /* =====================================================================
     DEĞERLENDİRME MODELİ DÜZENLEYİCİSİ
     Seçili çalışmanın YILININ modeli düzenlenir; o yılın bütün grupları
     kullanır. Onaylı çalışma onay anındaki modelle değerlendirilmeye devam
     eder. Yazma 'parametre.yaz' ister; yetkisi olmayan salt okunur görür.
     Taslak, ham model (PERF.VARSAYILAN biçimi) üzerinde tutulur; "_" ile
     başlayan anahtarlar düzenleyicinin kendi işaretleridir, kaydedilmez.
     Yeni kriter / ek alanın kodu adından üretilir (PERF.kodUret) ve
     kaydedilene kadar adla birlikte değişir; kaydedilmiş kod değişmez
     (girilmiş değerler koda bağlıdır).
     ===================================================================== */
  const hamKopya = o => JSON.parse(JSON.stringify(o, (k, v) => k.charAt(0) === '_' ? undefined : v));
  const gir = x => x == null ? '' : String(x).replace('.', ',');
  const TUR_ALAN = { esik: ['esik', 'puan', 'katsayi'], kademe: ['kademeler'], carpan: ['katsayi', 'enCok'], liste: ['secenek', 'bos'] };
  const TUR_VARS = { esik: { esik: 0, puan: 0, katsayi: 0 }, kademe: { kademeler: [[0, 0]] }, carpan: { katsayi: 1, enCok: null },
                     liste: { secenek: [['', 0]], bos: 0 } };
  const toplam = l => l.reduce((s, x) => s + (typeof x === 'number' && isFinite(x) ? x : 0), 0);

  /* Ek alan kuralının canlı açıklaması (yarım girilmiş değerlerde de hata vermez) */
  function ekAciklama(e) {
    try {
      const s = hamKopya(e);
      ['esik', 'puan', 'katsayi', 'enCok', 'bos'].forEach(k => { if (s[k] != null) s[k] = PERF.sayi(s[k]); });
      if (s.tur === 'esik') ['esik', 'puan', 'katsayi'].forEach(k => { if (s[k] == null) s[k] = 0; });
      if (s.tur === 'carpan' && s.katsayi == null) s.katsayi = 0;
      if (s.kademeler) s.kademeler = s.kademeler.map(k => [PERF.sayi(k[0]) || 0, PERF.sayi(k[1]) || 0]).sort((a, b) => a[0] - b[0]);
      if (s.secenek) s.secenek = s.secenek.filter(x => String(x[0] || '').trim())
        .map(x => [String(x[0]).toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ').trim(), PERF.sayi(x[1]) || 0]);
      if (s.tur === 'liste' && !s.secenek.length) return 'Seçenek girilmedi.';
      if (s.tur === 'kademe' && !s.kademeler.length) return 'Kademe girilmedi.';
      let m = s.tur ? PERF.aciklama(s) : '';
      const sn = Array.isArray(s.sinir) ? s.sinir.map(PERF.sayi) : null;
      if (s.tur !== 'liste' && sn && sn[0] != null && sn[1] != null) m += ` · giriş ${sy(sn[0])}–${sy(sn[1])}`;
      if (s.kalici) m += ' · önceki dönemden taşınır';
      return m || '—';
    } catch (x) { return '—'; }
  }

  /* Kaydedilecek ham modeli hazırlar ve denetler → { ham } ya da { hata } */
  function modelDenetle(T) {
    const ham = hamKopya(T);
    try {
      ['M', 'B'].forEach(y => {
        const t = ham.yaka[y], yad = t.ad || YAKA_AD[y];
        if (!String(t.sayfa || '').trim()) delete t.sayfa;
        t.ek = (t.ek || []).map(e => {
          if (e.tur === 'liste') delete e.sinir;
          if (Array.isArray(e.sinir)) {
            const a = e.sinir.map(x => x == null || x === '' ? null : x);
            if (a[0] == null && a[1] == null) delete e.sinir;
            else if (typeof a[0] !== 'number' || typeof a[1] !== 'number')
              throw new Error(`${yad} — "${e.ad}": giriş sınırının en az ve en çok değeri birlikte, sayı olarak girilmeli.`);
            else if (a[0] > a[1]) throw new Error(`${yad} — "${e.ad}": giriş sınırında en az değer en çok değerden büyük olamaz.`);
          }
          if (!String(e.not || '').trim()) delete e.not; else e.not = String(e.not).trim();
          if (!e.kalici) delete e.kalici;
          if (e.tur === 'carpan' && e.enCok === '') e.enCok = null;
          if (Array.isArray(e.kademeler)) e.kademeler = e.kademeler.filter(k => !(k[0] == null && k[1] == null));
          if (Array.isArray(e.secenek)) e.secenek = e.secenek.filter(s => String(s[0] == null ? '' : s[0]).trim() !== '' || s[1] != null);
          return e;
        });
      });
      PERF.hazirla(ham);
      return { ham: ham };
    } catch (x) { return { hata: x.message }; }
  }

  /* Kayıtlı modelde olup yenisinde olmayan amir / kriter / ek alanlar */
  function kaldirilanlar(eski, yeni) {
    const l = [];
    const ya = new Set(yeni.amirler.map(a => a.alan));
    eski.amirler.forEach(a => { if (!ya.has(a.alan)) l.push('Amir: ' + a.ad); });
    ['M', 'B'].forEach(y => {
      const e = eski.yaka[y], n = yeni.yaka[y], ad = n.ad || YAKA_AD[y];
      const k = new Set(n.kriter.map(x => x.kod));
      e.kriter.forEach(x => { if (!k.has(x.kod)) l.push(ad + ' kriteri: ' + x.ad); });
      const a = new Set((n.ek || []).map(x => x.alan));
      (e.ek || []).forEach(x => { if (!a.has(x.alan)) l.push(ad + ' ek alanı: ' + x.ad); });
    });
    return l;
  }

  function modelAc(c) {
    const yil = c.yil;
    const H = API.performansModeliHam(yil);
    const yaz = API.yetkiVar('parametre.yaz');
    const ro = yaz ? '' : ' disabled';
    const asil = hamKopya(H.model);
    const T = hamKopya(H.model);
    ['M', 'B'].forEach(y => { T.yaka[y].ek = T.yaka[y].ek || []; });
    let sekme = yaka;
    const kip = C.kipAc({
      baslik: `Değerlendirme modeli — ${yil}`,
      altBaslik: (H.varsayilan ? 'Varsayılan (örnek) model' : 'Bu yıla özel model') + (yaz ? '' : ' · salt okunur'),
      genislik: 'genis', govde: '<div data-pm></div>',
      altlik: yaz ? `${H.varsayilan ? '' : '<button class="btn btn-ikincil sol" data-pm-vars>Varsayılan modele dön</button>'}
          <button class="btn btn-ikincil" data-kip-kapat>Vazgeç</button><button class="btn" data-pm-kaydet>Kaydet</button>`
        : '<button class="btn btn-ikincil" data-kip-kapat>Kapat</button>',
    });
    const kok = kip.querySelector('[data-pm]');

    const bul = yol => yol.split('.').reduce((o, k) => o == null ? undefined : o[k], T);
    function yerlestir(yol, v) {
      const p = yol.split('.'); let o = T;
      for (let i = 0; i < p.length - 1; i++) {
        if (o[p[i]] == null) o[p[i]] = /^\d+$/.test(p[i + 1]) ? [] : {};
        o = o[p[i]];
      }
      o[p[p.length - 1]] = v;
    }
    const sayiGir = (yol, v, ek) => `<input class="hucre-girdi" data-sayi data-yol="${yol}" value="${U.esc(gir(v))}"${ek || ''}${ro}>`;
    const kriterToplam = y => toplam(T.yaka[y].kriter.map(k => k.agirlik));
    const sekmeYazi = y => U.esc(T.yaka[y].ad || YAKA_AD[y]) + (Math.abs(kriterToplam(y) - 100) > 1e-9 ? ' ⚠' : '');
    const kriterToplamHtml = () => {
      const t = kriterToplam(sekme);
      return `${sy(t)}${Math.abs(t - 100) > 1e-9 ? ` <span class="rz rz-ongoru" title="Engel değil">100 değil — amir puanı en çok ${sy(t)} olur</span>` : ''}`;
    };

    function satirTablo(p, anahtar, basliklar, satirlar, ilkMetin) {
      return `<table class="genis-tablo param-tablo ust-bosluk" style="max-width:460px"><thead><tr><th>${basliklar[0]}</th>
          <th class="num">${basliklar[1]}</th><th></th></tr></thead><tbody>
        ${(satirlar || []).map((s, r) => `<tr><td>${ilkMetin
            ? `<input data-yol="${p}.${anahtar}.${r}.0" value="${U.esc(s[0] == null ? '' : s[0])}"${ro}>`
            : sayiGir(`${p}.${anahtar}.${r}.0`, s[0])}</td>
          <td class="num">${sayiGir(`${p}.${anahtar}.${r}.1`, s[1])}</td>
          <td>${yaz ? `<button class="ikon-btn satir-sil" data-pm-is="satirSil" data-pm-yol="${p}.${anahtar}" data-i="${r}" title="Satırı sil">🗑</button>` : ''}</td></tr>`).join('')}
        </tbody></table>
        ${yaz ? `<button class="btn btn-ikincil btn-kucuk" data-pm-is="satirEkle" data-pm-yol="${p}.${anahtar}"${ilkMetin ? ' data-metin' : ''}>+ Satır</button>` : ''}`;
    }

    function ekHtml(e, j) {
      const p = `yaka.${sekme}.ek.${j}`;
      const n = (alan, etiket) => `<label>${etiket} ${sayiGir(`${p}.${alan}`, e[alan])}</label>`;
      let tur = '';
      if (e.tur === 'esik') tur = `<div class="satir">${n('esik', 'Eşik')}${n('puan', 'Eşik ve üstü puan')}${n('katsayi', 'Altında: değer ×')}</div>`;
      else if (e.tur === 'carpan') tur = `<div class="satir">${n('katsayi', 'Değer ×')}${n('enCok', 'En çok puan (boş = sınırsız)')}</div>`;
      else if (e.tur === 'kademe') tur = `<div class="kucuk soluk">Değerin ulaştığı en yüksek kademenin puanı verilir.</div>` +
        satirTablo(p, 'kademeler', ['En az değer', 'Puan'], e.kademeler, false);
      else if (e.tur === 'liste') tur = satirTablo(p, 'secenek', ['Seçenek', 'Puan'], e.secenek, true) +
        `<div class="satir ust-bosluk">${n('bos', 'Listede olmayan ya da boş değerin puanı')}</div>`;
      return `<div class="pf-model-ek">
        <div class="pf-model-ek-ust">
          <div class="izgara izgara-3">
            <div class="alan"><label>Alan adı <span class="ipucu">— Excel başlığı</span></label><input data-yol="${p}.ad" value="${U.esc(e.ad || '')}"${ro}></div>
            <div class="alan"><label>Kural türü</label><select data-yol="${p}.tur"${ro}>${C.secenekler(Object.keys(PERF.TURLER).map(k =>
              ({ deger: k, etiket: PERF.TURLER[k] })), e.tur, e.tur ? undefined : '— seçin —')}</select></div>
            <div class="alan"><label>Kod</label><div class="mono kucuk cok-soluk" data-pm-kod="ek.${j}">${U.esc(e.alan || '')}${e._yeni ? ' (yeni)' : ''}</div></div>
          </div>
          ${yaz ? `<button class="ikon-btn satir-sil" data-pm-is="ekSil" data-i="${j}" title="Ek alanı kaldır">🗑</button>` : ''}
        </div>
        ${tur}
        <div class="satir ust-bosluk">
          ${e.tur !== 'liste' ? `<label>Giriş sınırı: en az ${sayiGir(`${p}.sinir.0`, (e.sinir || [])[0])}</label>
            <label>en çok ${sayiGir(`${p}.sinir.1`, (e.sinir || [])[1])}</label>` : ''}
          <label><input type="checkbox" data-yol="${p}.kalici"${e.kalici ? ' checked' : ''}${ro}> Önceki dönemden taşınsın</label>
        </div>
        <div class="alan ust-bosluk"><label>Not <span class="ipucu">— açıklamanın başına eklenir</span></label>
          <input data-yol="${p}.not" value="${U.esc(e.not || '')}"${ro}></div>
        <div class="kucuk soluk">Açıklama: <span data-pm-ack="${j}">${U.esc(ekAciklama(e))}</span></div>
      </div>`;
    }

    function govdeHtml() {
      const t = T.yaka[sekme], p = `yaka.${sekme}`;
      return `
        ${c.durum === 'ONAYLI' ? `<div class="uyari uyari-bilgi"><span class="ik">🔒</span><div>Seçili çalışma onaylı: onay anındaki modelle
          değerlendirilir. Buradaki değişiklik ${yil} yılının taslak / revize çalışmalarına uygulanır.</div></div>` : ''}
        ${yaz ? '' : `<div class="uyari uyari-bilgi"><span class="ik">ℹ</span><div>Modeli değiştirmek için <em>Parametre ve tanımları değiştirir</em>
          yetkisi gerekir; burada yalnız görüntülenir.</div></div>`}
        <div class="kucuk soluk">Model ${yil} yılının bütün gruplarındaki çalışmalarda kullanılır. Kriter puanları 0–100 arasında verilir;
          kriterden ya da ek alandan kaldırılan tanımların girilmiş değerleri silinmez ama artık hesaba girmez.</div>

        <h3 class="ust-bosluk">Amirler</h3>
        <div class="kucuk soluk">Değerlendirme, amir puanlarının bu ağırlıklarla ortalamasıdır; puan vermeyen amirin ağırlığı diğerlerine dağıtılır.
          Ağırlıklar oran olarak kullanılır, toplamın 100 olması gerekmez. En çok 5 amir.</div>
        <table class="genis-tablo param-tablo ust-bosluk" style="max-width:620px"><thead><tr><th>Amir</th><th class="num">Ağırlık</th>
          <th>Kod</th><th></th></tr></thead><tbody>
          ${T.amirler.map((a, i) => `<tr><td><input data-yol="amirler.${i}.ad" value="${U.esc(a.ad || '')}"${ro}></td>
            <td class="num">${sayiGir(`amirler.${i}.agirlik`, a.agirlik)}</td>
            <td class="mono kucuk cok-soluk">${U.esc(a.alan)}</td>
            <td>${yaz && T.amirler.length > 1 ? `<button class="ikon-btn satir-sil" data-pm-is="amirSil" data-i="${i}" title="Amiri kaldır">🗑</button>` : ''}</td></tr>`).join('')}
          <tr class="kalin"><td>Toplam</td><td class="num" data-pm-amirtop>${sy(toplam(T.amirler.map(a => a.agirlik)))}</td><td></td><td></td></tr>
        </tbody></table>
        ${yaz && T.amirler.length < 5 ? '<button class="btn btn-ikincil btn-kucuk ust-bosluk" data-pm-is="amirEkle">+ Amir ekle</button>' : ''}

        <div class="sekme-cubuk ust-bosluk" style="margin-top:22px">${['M', 'B'].map(y =>
          `<button class="btn btn-ikincil btn-kucuk${sekme === y ? ' etkin' : ''}" data-pm-sekme="${y}">${sekmeYazi(y)}</button>`).join('')}</div>
        <div class="izgara izgara-3">
          <div class="alan"><label>Yaka adı</label><input data-yol="${p}.ad" value="${U.esc(t.ad || '')}"${ro}></div>
          <div class="alan"><label>Excel sayfa adı <span class="ipucu">— boşsa yaka adı</span></label>
            <input data-yol="${p}.sayfa" value="${U.esc(t.sayfa || '')}" placeholder="${U.esc(String(t.ad || '').toLocaleUpperCase('tr-TR'))}"${ro}></div>
          <div class="alan"><label>Değerlendirme ağırlığı <span class="ipucu">— toplam puandaki payı (/100)</span></label>
            ${sayiGir(`${p}.degAgirlik`, t.degAgirlik)}</div>
        </div>
        <h3>Kriterler</h3>
        <table class="genis-tablo param-tablo ust-bosluk" style="max-width:760px"><thead><tr><th>Kriter</th><th class="num">Ağırlık</th>
          <th>Kod</th><th></th></tr></thead><tbody>
          ${t.kriter.map((k, j) => `<tr><td><input data-yol="${p}.kriter.${j}.ad" value="${U.esc(k.ad || '')}"${ro}></td>
            <td class="num">${sayiGir(`${p}.kriter.${j}.agirlik`, k.agirlik)}</td>
            <td class="mono kucuk cok-soluk" data-pm-kod="kriter.${j}">${U.esc(k.kod || '')}${k._yeni ? ' (yeni)' : ''}</td>
            <td style="white-space:nowrap">${yaz ? `<button class="ikon-btn" data-pm-is="yukari" data-i="${j}" title="Yukarı"${j ? '' : ' disabled'}>↑</button>
              <button class="ikon-btn" data-pm-is="asagi" data-i="${j}" title="Aşağı"${j < t.kriter.length - 1 ? '' : ' disabled'}>↓</button>
              ${t.kriter.length > 1 ? `<button class="ikon-btn satir-sil" data-pm-is="kriterSil" data-i="${j}" title="Kriteri kaldır">🗑</button>` : ''}` : ''}</td></tr>`).join('')}
          <tr class="kalin"><td>Toplam</td><td class="num" data-pm-kritop colspan="3" style="text-align:left">${kriterToplamHtml()}</td></tr>
        </tbody></table>
        ${yaz ? '<button class="btn btn-ikincil btn-kucuk ust-bosluk" data-pm-is="kriterEkle">+ Kriter ekle</button>' : ''}

        <h3 class="ust-bosluk">Ek puan alanları</h3>
        <div class="kucuk soluk">Toplam puana eklenir (eksi puan da olabilir). Excel şablonunda kriterlerden sonra sütun olarak çıkar.</div>
        ${t.ek.map((e, j) => ekHtml(e, j)).join('') || '<div class="kucuk soluk ust-bosluk">Bu yakada ek puan alanı yok.</div>'}
        ${yaz ? '<button class="btn btn-ikincil btn-kucuk ust-bosluk" data-pm-is="ekEkle">+ Ek alan ekle</button>' : ''}
        <div class="ust-bosluk" data-pm-durum></div>`;
    }

    function durumYaz() {
      const el = kok.querySelector('[data-pm-durum]');
      if (!el || !yaz) return;
      const d = modelDenetle(T);
      el.innerHTML = d.hata
        ? `<div class="uyari uyari-hata"><span class="ik">⚠</span><div>${U.esc(d.hata)}</div></div>`
        : '<div class="uyari uyari-basari"><span class="ik">✓</span><div>Model geçerli; kaydedilebilir.</div></div>';
    }
    function canli() {
      const at = kok.querySelector('[data-pm-amirtop]'); if (at) at.textContent = sy(toplam(T.amirler.map(a => a.agirlik)));
      const kt = kok.querySelector('[data-pm-kritop]'); if (kt) kt.innerHTML = kriterToplamHtml();
      kok.querySelectorAll('[data-pm-sekme]').forEach(b => { b.innerHTML = sekmeYazi(b.getAttribute('data-pm-sekme')); });
      T.yaka[sekme].ek.forEach((e, j) => { const el = kok.querySelector(`[data-pm-ack="${j}"]`); if (el) el.textContent = ekAciklama(e); });
      durumYaz();
    }
    function ciz2(odak) {
      const g = kip.querySelector('.kip-govde'), st = g ? g.scrollTop : 0;
      kok.innerHTML = govdeHtml();
      if (g) g.scrollTop = st;
      durumYaz();
      const el = odak && kok.querySelector(`[data-yol="${odak}"]`);
      if (el) el.focus();
    }
    /* Yeni öğenin kodu adından üretilir (aynı yakadaki diğer kodlarla çakışmaz) */
    function kodYenile(tur, j) {
      const l = T.yaka[sekme][tur], o = l[j];
      if (!o || !o._yeni) return;
      const a = tur === 'kriter' ? 'kod' : 'alan';
      o[a] = PERF.kodUret(o.ad, l.filter((x, i) => i !== j).map(x => x[a]));
      const el = kok.querySelector(`[data-pm-kod="${tur}.${j}"]`);
      if (el) el.textContent = o[a] + ' (yeni)';
    }
    function turDegistir(yol, tur) {
      const e = bul(yol.replace(/\.tur$/, ''));
      if (!e || !TUR_ALAN[tur]) return;
      Object.keys(TUR_ALAN).forEach(t => { if (t !== tur) TUR_ALAN[t].forEach(a => { if (TUR_ALAN[tur].indexOf(a) < 0) delete e[a]; }); });
      Object.keys(TUR_VARS[tur]).forEach(a => { if (e[a] === undefined) e[a] = hamKopya({ v: TUR_VARS[tur][a] }).v; });
      if (tur === 'liste') delete e.sinir;
      e.tur = tur;
    }

    function degisti(el, bitti) {
      const yol = el.getAttribute && el.getAttribute('data-yol');
      if (!yol || !yaz) return;
      if (el.type === 'checkbox') { if (bitti) { yerlestir(yol, el.checked); canli(); } return; }
      if (el.tagName === 'SELECT') { if (bitti) { turDegistir(yol, el.value); ciz2(); } return; }
      if (el.hasAttribute('data-sayi')) {
        const v = el.value.trim(), n = PERF.sayi(v);
        yerlestir(yol, v === '' ? null : (n == null ? v : n));
        el.classList.toggle('hatali', v !== '' && n == null);
      } else yerlestir(yol, el.value);
      const m = /^yaka\.[MB]\.(kriter|ek)\.(\d+)\.ad$/.exec(yol);
      if (m) kodYenile(m[1], Number(m[2]));
      canli();
    }
    kok.addEventListener('input', e => degisti(e.target, false));
    kok.addEventListener('change', e => degisti(e.target, true));
    kok.addEventListener('click', e => {
      const s = e.target.closest('[data-pm-sekme]');
      if (s) { sekme = s.getAttribute('data-pm-sekme'); return ciz2(); }
      const b = e.target.closest('[data-pm-is]');
      if (!b || !yaz) return;
      const is = b.getAttribute('data-pm-is'), i = Number(b.getAttribute('data-i')), t = T.yaka[sekme];
      let odak = null;
      if (is === 'amirEkle') {
        let n = 1; while (T.amirler.some(a => a.alan === 'amir' + n)) n++;
        T.amirler.push({ alan: 'amir' + n, ad: n + '. AMİR', agirlik: null });
        odak = `amirler.${T.amirler.length - 1}.agirlik`;
      } else if (is === 'amirSil') T.amirler.splice(i, 1);
      else if (is === 'kriterEkle') {
        t.kriter.push({ kod: PERF.kodUret('', t.kriter.map(k => k.kod)), ad: '', agirlik: null, _yeni: true });
        odak = `yaka.${sekme}.kriter.${t.kriter.length - 1}.ad`;
      } else if (is === 'kriterSil') t.kriter.splice(i, 1);
      else if (is === 'yukari' && i > 0) t.kriter.splice(i - 1, 0, t.kriter.splice(i, 1)[0]);
      else if (is === 'asagi' && i < t.kriter.length - 1) t.kriter.splice(i + 1, 0, t.kriter.splice(i, 1)[0]);
      else if (is === 'ekEkle') {
        t.ek.push({ alan: PERF.kodUret('', t.ek.map(x => x.alan)), ad: '', tur: 'carpan', katsayi: 1, enCok: null, _yeni: true });
        odak = `yaka.${sekme}.ek.${t.ek.length - 1}.ad`;
      } else if (is === 'ekSil') t.ek.splice(i, 1);
      else if (is === 'satirEkle' || is === 'satirSil') {
        const yol = b.getAttribute('data-pm-yol');
        if (!Array.isArray(bul(yol))) yerlestir(yol, []);
        if (is === 'satirEkle') bul(yol).push(b.hasAttribute('data-metin') ? ['', null] : [null, null]);
        else bul(yol).splice(i, 1);
      } else return;
      ciz2(odak);
    });

    if (yaz) {
      kip.querySelector('[data-pm-kaydet]').onclick = async () => {
        const d = modelDenetle(T);
        if (d.hata) { durumYaz(); return U.bildir(d.hata, 'hata'); }
        const giden = kaldirilanlar(asil, d.ham);
        if (giden.length && !await C.onay({ baslik: 'Kaldırılan tanımlar', evetYazi: 'Kaydet',
          mesaj: `Şunlar modelden kaldırılıyor:<ul class="kucuk">${giden.map(x => `<li>${U.esc(x)}</li>`).join('')}</ul>`,
          detay: 'Bu tanımlara girilmiş değerler silinmez, ama artık hesaba ve Excel şablonuna girmez. Aynı kodla yeniden eklenirse değerler geri gelir.' })) return;
        try {
          API.performansModeliYaz(yil, d.ham);
          C.kipKapat();
          U.bildir(`${yil} değerlendirme modeli kaydedildi; puanlar yeni modelle hesaplanıyor.`, 'basari');
          APP.tazele();
        } catch (x) { U.bildir(x.message, 'hata'); }
      };
      const vb = kip.querySelector('[data-pm-vars]');
      if (vb) vb.onclick = async () => {
        if (!await C.onay({ baslik: 'Varsayılan modele dön', tehlike: true, evetYazi: 'Varsayılana dön',
          mesaj: `${yil} yılına özel model silinecek; bu yıl için varsayılan (örnek) model kullanılacak.`,
          detay: 'Girilmiş değerlendirmeler silinmez; varsayılan modelde olmayan kriter ve alanlar hesaba girmez.' })) return;
        try {
          API.performansModeliYaz(yil, null);
          C.kipKapat();
          U.bildir(`${yil} için varsayılan değerlendirme modeli geçerli.`, 'basari');
          APP.tazele();
        } catch (x) { U.bildir(x.message, 'hata'); }
      };
    }
    ciz2();
  }

  APP.modulKaydet({
    id: 'performans', ad: 'Performans Değerlendirme', ikon: '🎯', grup: 'Bütçe',
    baslik: 'Performans Değerlendirme', altBaslik: 'Amir değerlendirmeleri, bölüm katsayısı ve zam çarpanı',
    yetki: 'zam.oku', calismaGerekli: true, ciz: ciz,
  });
})();
