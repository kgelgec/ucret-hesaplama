/* =====================================================================
   PARAMETRELER — yıl bazında yasal oranlar, asgari ücret, gelir vergisi
   tarifesi, sakatlık indirimi, zam öngörüsü ve performans kademeleri.
   Asgari ücret istisnası ve SGK tavanı asgari ücretten ay ay hesaplanır;
   bu aylık tablo elle tutulmaz.
   ===================================================================== */
(function () {
  'use strict';

  let yil = null;

  function ciz(kap) {
    const yillar = API.yillar();
    const c = APP.calisma();
    /* Yıl, üst çubuktaki yılla AYNIDIR (tek kaynak). Sayfanın kendi yıl seçicisi ayrı bir kimlik (prmYilSec)
       taşır ve üst çubuğun seçimini değiştirir; böylece ekranda görülen yıl ile öngörünün yazdığı yıl
       hiçbir zaman ayrışmaz. */
    yil = APP.yil() || yillar[0] || new Date().getFullYear();
    const yaz = API.yetkiVar('parametre.yaz');
    const p = API.parametreOku(yil);
    const dilim = API.dilimListe(yil);
    const au = API.asgariListe(yil);
    const sak = API.sakatlikListe(yil);
    const perf = API.performansListe(yil);
    const ro = yaz ? '' : ' disabled';
    const durum = API.parametreDurumu(yil);

    // Yılın güncel tabloları (onaylı çalışmanın dondurulmuş parametreleri değil: anlik verilmez)
    let tablo = null, hata = '';
    try { tablo = API.hesapParametre(yil); } catch (e) { hata = e.message; }

    // Ondalıklı değerde sondaki sıfırlar atılır; tam sayıya dokunulmaz ("33.030" → "33.03" olmasın)
    const goster = v => v == null || v === '' ? '' :
      (Number(v) % 1 ? B.tlDuz(v, 6).replace(/0+$/, '').replace(/,$/, '') : B.tlDuz(v, 0));
    const sayiGir = (ad, v, gen) => `<input class="hucre-girdi" name="${ad}" value="${goster(v)}"${ro} style="width:${gen || 120}px">`;

    kap.innerHTML = `
      ${yaz ? ongoruKarti(yillar, yil) : ''}
      <div class="kart">
        <div class="kart-baslik">
          <div><h2>Parametreler — ${yil}</h2>
            <div class="kart-aciklama">Değişiklikler o yılın bütün gruplardaki çalışmalarını etkiler.</div></div>
          <div class="btn-satir">
            <select id="prmYilSec">${C.secenekler(yillar.length ? yillar : [yil], yil)}</select>
            ${durum.ongoru ? '<span class="rz rz-ongoru">Öngörü</span>' : '<span class="rz rz-yesil">Resmî</span>'}
            ${yaz && durum.ongoru ? '<button class="btn btn-ikincil" id="resmiBtn">Resmî rakamlar girildi</button>' : ''}
          </div>
        </div>
        ${(() => { const on = API.yilOnayliCalismalar(yil); return on.length ? `<div class="uyari uyari-bilgi"><span class="ik">🔒</span><div>
          <strong>${yil} yılının onaylı çalışmaları kilitli:</strong> ${on.map(x => U.esc(x.grup_adi + ' · ' + x.ad)).join(', ')}.
          Bunlar onay anındaki parametrelerle hesaplanır; burada yapılan değişiklik (örn. Ocak'ta resmî rakamlar) onlara <strong>yansımaz</strong>,
          yalnız taslak ve revize çalışmaları etkiler. Resmî rakamlarla yeni hesap için <strong>Bütçe Çalışmaları → Revize aç</strong>.</div></div>` : ''; })()}
        ${durum.ongoru ? `<div class="uyari uyari-dikkat"><span class="ik">⚠</span><div><strong>${yil} yasal parametreleri öngörüdür.</strong>
          ${durum.kaynakYil} değerlerine %${B.tlDuz((durum.oran || 0) * 100, 1)} artış uygulandı${durum.araOran ? `, ${U.AYLAR[durum.araAy - 1]} ayında %${B.tlDuz(durum.araOran * 100, 1)} ara artış öngörüldü` : ''}.
          Resmî rakamlar açıklanınca aşağıdaki değerleri düzeltip "Resmî rakamlar girildi" düğmesine basın.</div></div>` : ''}
        ${hata ? `<div class="uyari uyari-hata"><span class="ik">⚠</span><div>${U.esc(hata)}
          ${!au.length || !dilim.length || !sak.length ? `<div class="ust-bosluk">${yil} yılının yasal tabloları (asgari ücret ${au.length ? '✓' : 'yok'}, gelir vergisi dilimleri ${dilim.length ? '✓' : 'yok'}, sakatlık indirimi ${sak.length ? '✓' : 'yok'}) eksik. Üstteki <strong>Yeni Yıl Öngörüsü</strong> ile ${yil - 1} → ${yil} oluşturun ya da aşağıya elle girin.</div>` : ''}</div></div>` : ''}

        <div class="izgara izgara-2">
          <div>
            <h3>Genel</h3>
            <table class="genis-tablo param-tablo" id="genel"><tbody>
              ${API.PARAMETRE_TANIM.map(t => `<tr><td>${U.esc(t.ad)}</td>
                <td class="num">${sayiGir(t.anahtar, API.parametreSayi(p, t.anahtar, t.vars))}</td>
                <td class="kucuk soluk">${U.esc(t.birim)}</td></tr>`).join('')}
            </tbody></table>
          </div>
          <div>
            <h3>Asgari Ücret (brüt)</h3>
            <table class="genis-tablo param-tablo" id="asgari"><thead><tr><th>Geçerli olduğu ay</th><th class="num">Brüt</th><th></th></tr></thead>
              <tbody>${au.map(a => `<tr><td><select name="ay"${ro}>${C.aySecenekleri(a.baslangic_ay)}</select></td>
                <td class="num">${sayiGir('brut', a.brut)}</td>
                <td>${yaz && a.baslangic_ay !== 1 ? '<button class="ikon-btn satir-sil" data-satir-sil>🗑</button>' : ''}</td></tr>`).join('')}</tbody></table>
            ${yaz ? `<div class="btn-satir ust-bosluk"><button class="btn btn-ikincil btn-kucuk" id="auEkle">+ 2. dönem ekle</button>
              <button class="btn btn-kucuk" id="auKaydet">Asgari ücreti kaydet</button></div>` : ''}

            <h3 class="ust-bosluk">Sakatlık İndirimi (aylık)</h3>
            <table class="genis-tablo param-tablo" id="sakatlik"><tbody>
              ${[1, 2, 3].map(d => { const s = sak.find(x => x.derece === d); return `<tr><td>${d}. derece</td>
                <td class="num">${sayiGir('d' + d, s ? s.tutar : 0)}</td></tr>`; }).join('')}
            </tbody></table>
            ${yaz ? '<button class="btn btn-kucuk ust-bosluk" id="sakKaydet">Sakatlık tutarlarını kaydet</button>' : ''}
          </div>
        </div>
      </div>

      <div class="kart">
        <div class="kart-baslik"><div><h2>Gelir Vergisi Tarifesi</h2>
          <div class="kart-aciklama">Ücretliler için. Son dilimin üst sınırı yoktur. Kümülatif matrah üzerinden uygulanır.</div></div></div>
        <table class="genis-tablo" id="dilim"><thead><tr><th>Dilim</th><th class="num">Üst sınır (TL)</th><th class="num">Oran (%)</th><th></th></tr></thead>
          <tbody>${dilim.map((d, i) => `<tr><td>${i + 1}.</td>
            <td class="num">${i === dilim.length - 1 ? '<span class="soluk">sınırsız</span><input type="hidden" name="ust" value="">' : sayiGir('ust', d.ust_sinir)}</td>
            <td class="num">${sayiGir('oran', d.oran * 100, 70)}</td>
            <td>${yaz ? '<button class="ikon-btn satir-sil" data-satir-sil>🗑</button>' : ''}</td></tr>`).join('')}</tbody></table>
        ${yaz ? `<div class="btn-satir ust-bosluk"><button class="btn btn-ikincil btn-kucuk" id="dilimEkle">+ Dilim ekle</button>
          <button class="btn btn-kucuk" id="dilimKaydet">Tarifeyi kaydet</button></div>` : ''}
      </div>

      <div class="kart">
        <div class="kart-baslik"><div><h2>Aylık Tablo (hesaplanan)</h2>
          <div class="kart-aciklama">Asgari ücret ve tarifeden her ay için ayrı türetilir; elle girilmez. GV istisnası
            asgari ücretin kümülatif matrahından hesaplandığı için matrah üst dilime geçtikçe aydan aya değişir.</div></div></div>
        ${tablo ? `<div class="tablo-sar"><table class="genis-tablo">
          <thead><tr><th></th>${U.AYLAR.map(a => `<th class="num">${a.slice(0, 3)}</th>`).join('')}</tr></thead>
          <tbody>
            <tr><td>Asgari ücret</td>${ay(tablo.asgari)}</tr>
            <tr><td>SGK tavanı</td>${ay(tablo.tavan)}</tr>
            <tr><td>Asgari ücret GV istisnası</td>${ay(tablo.istGV, 2)}</tr>
            <tr><td>Asgari ücret DV istisnası</td>${ay(tablo.istDV, 2)}</tr>
            <tr><td>Ayın gün sayısı</td>${tablo.gun.slice(1).map(g => `<td class="num">${g}</td>`).join('')}</tr>
          </tbody></table></div>` : ''}
      </div>

      <div class="kart">
        <div class="kart-baslik"><div><h2>Zam Öngörüsü</h2>
          <div class="kart-aciklama">Önceki yıl maaşı (çalışmanın ücret esasında: net ya da brüt) alt eşiğin altındaysa üst oran, üst eşiğin üstündeyse alt oran;
            arada doğrusal azalır. Buradaki değerler yılın <strong>genel</strong> değeridir; her grubun kendi eşik ve oranları
            Bütçe Çalışmaları → ✎ Çalışma Ayarları'ndan girilir (gruplar arasında farklı olabilir). Yöntem (kademe / performans) de orada seçilir.
            Brüt esaslı çalışma bu eşikleri brüt maaşa uygular; o grupta eşikleri Çalışma Ayarları'ndan brüte göre girin.</div></div></div>
        <div class="izgara izgara-2">
          ${[['B', 'Beyaz Yaka'], ['M', 'Mavi Yaka']].map(y => `<div><h3>${y[1]}</h3>
            <table class="genis-tablo param-tablo" data-zam="${y[0]}"><tbody>
              ${API.ZAM_TANIM.map(z => `<tr><td>${U.esc(z.ad)}</td><td class="num">${
                z.anahtar.includes('oran')
                  ? sayiGir(z.anahtar, API.parametreSayi(p, 'zam.' + y[0] + '.' + z.anahtar, z.vars) * 100, 70) + ' %'
                  : sayiGir(z.anahtar, API.parametreSayi(p, 'zam.' + y[0] + '.' + z.anahtar, z.vars))}</td></tr>`).join('')}
            </tbody></table></div>`).join('')}
        </div>
        ${yaz ? '<button class="btn btn-kucuk ust-bosluk" id="zamKaydet">Zam parametrelerini kaydet</button>' : ''}

        <h3 class="ust-bosluk">Performans Kademeleri</h3>
        <div class="kucuk soluk">Kişinin performans puanı bu aralıklara göre çarpana çevrilir (kişi kartında çarpan
          elle girilmişse o kullanılır).</div>
        <table class="genis-tablo param-tablo ust-bosluk" id="perf"><thead><tr><th class="num">Alt puan</th><th class="num">Üst puan</th><th class="num">Çarpan</th><th></th></tr></thead>
          <tbody>${perf.map(x => `<tr><td class="num">${sayiGir('alt', x.alt_puan, 80)}</td><td class="num">${sayiGir('ust', x.ust_puan, 80)}</td>
            <td class="num">${sayiGir('carpan', x.carpan, 80)}</td>
            <td>${yaz ? '<button class="ikon-btn satir-sil" data-satir-sil>🗑</button>' : ''}</td></tr>`).join('')}</tbody></table>
        ${yaz ? `<div class="btn-satir ust-bosluk"><button class="btn btn-ikincil btn-kucuk" id="perfEkle">+ Kademe ekle</button>
          <button class="btn btn-kucuk" id="perfKaydet">Kademeleri kaydet</button></div>` : ''}
      </div>`;

    U.el('prmYilSec').onchange = e => { ongoruDurum = null; APP.secimYap(Number(e.target.value), null); };
    if (!yaz) return;
    const sayi = v => API.trSayi(v);
    const kaydetVe = fn => { try { fn(); U.bildir('Kaydedildi.', 'basari'); APP.tazele(); } catch (e) { U.bildir(e.message, 'hata'); } };

    // Genel parametreler: her hücre ayrı kaydedilir
    U.el('genel').querySelectorAll('input').forEach(inp => {
      const eski = inp.value;
      inp.addEventListener('change', () => { if (inp.value !== eski) kaydetVe(() => API.parametreYaz(yil, inp.name, sayi(inp.value))); });
    });

    kap.addEventListener('click', e => { const b = e.target.closest('[data-satir-sil]'); if (b) b.closest('tr').remove(); });

    U.el('auEkle').onclick = () => {
      U.el('asgari').querySelector('tbody').insertAdjacentHTML('beforeend',
        `<tr><td><select name="ay">${C.aySecenekleri(7)}</select></td><td class="num">${sayiGir('brut', '')}</td>
         <td><button class="ikon-btn satir-sil" data-satir-sil>🗑</button></td></tr>`);
    };
    U.el('auKaydet').onclick = () => kaydetVe(() => API.asgariYaz(yil, [...U.el('asgari').querySelectorAll('tbody tr')].map(tr => ({
      baslangic_ay: Number(tr.querySelector('[name=ay]').value), brut: sayi(tr.querySelector('[name=brut]').value) }))));

    U.el('sakKaydet').onclick = () => kaydetVe(() => API.sakatlikYaz(yil, [1, 2, 3].map(d => ({
      derece: d, tutar: sayi(U.el('sakatlik').querySelector('[name=d' + d + ']').value) }))));

    U.el('dilimEkle').onclick = () => {
      const tb = U.el('dilim').querySelector('tbody');
      tb.insertAdjacentHTML('beforeend', `<tr><td>+</td><td class="num">${sayiGir('ust', '')}</td>
        <td class="num">${sayiGir('oran', '', 70)}</td><td><button class="ikon-btn satir-sil" data-satir-sil>🗑</button></td></tr>`);
    };
    U.el('dilimKaydet').onclick = () => kaydetVe(() => {
      const l = [...U.el('dilim').querySelectorAll('tbody tr')].map(tr => ({
        ust_sinir: tr.querySelector('[name=ust]').value.trim() === '' ? null : sayi(tr.querySelector('[name=ust]').value),
        oran: sayi(tr.querySelector('[name=oran]').value) / 100 }));
      // Sınırı boş olan son dilim sayılır; sıralama üst sınıra göre
      l.sort((a, b) => (a.ust_sinir == null ? Infinity : a.ust_sinir) - (b.ust_sinir == null ? Infinity : b.ust_sinir));
      API.dilimYaz(yil, l);
    });

    U.el('zamKaydet').onclick = () => kaydetVe(() => {
      kap.querySelectorAll('[data-zam]').forEach(t => {
        const y = t.getAttribute('data-zam');
        t.querySelectorAll('input').forEach(inp => {
          let v = sayi(inp.value);
          if (inp.name.includes('oran')) v = v / 100;
          API.parametreYaz(yil, 'zam.' + y + '.' + inp.name, v);
        });
      });
    });

    U.el('perfEkle').onclick = () => {
      U.el('perf').querySelector('tbody').insertAdjacentHTML('beforeend',
        `<tr><td class="num">${sayiGir('alt', '', 80)}</td><td class="num">${sayiGir('ust', '', 80)}</td>
         <td class="num">${sayiGir('carpan', '', 80)}</td><td><button class="ikon-btn satir-sil" data-satir-sil>🗑</button></td></tr>`);
    };
    U.el('perfKaydet').onclick = () => kaydetVe(() => API.performansYaz(yil,
      [...U.el('perf').querySelectorAll('tbody tr')].map(tr => ({
        alt_puan: sayi(tr.querySelector('[name=alt]').value), ust_puan: sayi(tr.querySelector('[name=ust]').value),
        carpan: sayi(tr.querySelector('[name=carpan]').value) }))));

    const rb = U.el('resmiBtn');
    if (rb) rb.onclick = async () => {
      const ok = await C.onay({ baslik: 'Resmî Rakamlar', mesaj: `${yil} yasal parametreleri <strong>resmî</strong> olarak işaretlenecek.`,
        detay: 'Asgari ücret, gelir vergisi dilimleri ve sakatlık indirimini açıklanan resmî rakamlarla düzelttiğinizden emin olun.',
        evetYazi: 'Resmî olarak işaretle' });
      if (ok) kaydetVe(() => API.parametreDurumYaz(yil, 'RESMI'));
    };
    ongoruBagla();
  }

  /* ------------------------------------------------------------------
     YENİ YIL ÖNGÖRÜSÜ
     Bütçe hazırlanırken yeni yılın resmî rakamları henüz yoktur. Tek bir
     artış oranı (piyasa beklentisi) önceki yılın asgari ücretine, gelir
     vergisi dilim sınırlarına ve sakatlık indirimine uygulanır. İstenirse
     kalem bazında farklı oran ve yıl içi ara artış (örn. Temmuz) girilir.
     ------------------------------------------------------------------ */
  let ongoruDurum = null;   // { s: seçenekler, o: önizleme }

  /* Kural: üstte seçilen yıl HEDEF, bir önceki yıl KAYNAK (2027 seçilince 2026 → 2027).
     Önceki yılı olmayan ilk yılda seçili yıl kaynak kalır, hedef bir sonraki yıl olur.
     Onaylı yılın üzerine yazma ongoruUygula'da engellenir. */
  function ongoruKarti(yillar, seciliYil) {
    const varsayilanKaynak = yillar.indexOf(seciliYil - 1) >= 0 ? seciliYil - 1
      : (yillar.indexOf(seciliYil) >= 0 ? seciliYil : (yillar.length ? yillar[yillar.length - 1] : new Date().getFullYear()));
    const kaynak = (ongoruDurum && ongoruDurum.s.kaynakYil) || varsayilanKaynak;
    const s = ongoruDurum ? ongoruDurum.s : { kaynakYil: kaynak, hedefYil: kaynak + 1, oran: 0.30, araAy: 7, araOran: 0,
                                             dilimAdim: 1000, sakatlikAdim: 100 };
    const yuz = v => v == null ? '' : B.tlDuz(v * 100, 2).replace(/,00$/, '');
    const hedefVar = API.parametreDurumu(s.hedefYil).var;
    return `<div class="kart">
      <div class="kart-baslik"><div><h2>Yeni Yıl Öngörüsü</h2>
        <div class="kart-aciklama">Resmî rakamlar açıklanmadan bütçe yapabilmek için: piyasa beklentisine göre bir artış oranı
          girin; önceki yılın asgari ücreti, gelir vergisi dilimleri ve sakatlık indirimi bu oranla artırılır. SGK tavanı ve
          asgari ücret istisnaları asgari ücretten kendiliğinden hesaplanır. Diğer oranlar (SGK primleri, damga vergisi,
          zam kademesi…) önceki yıldan kopyalanır.</div></div></div>
      <div class="izgara izgara-4" id="ongoruForm">
        <div class="alan"><label>Kaynak yıl (esas alınan)</label>
          <select name="kaynakYil">${C.secenekler(yillar, s.kaynakYil)}</select></div>
        <div class="alan"><label>Hedef yıl (bütçe yılı)</label>
          <input name="hedefYil" type="number" value="${s.hedefYil}"></div>
        <div class="alan"><label>Genel artış oranı (%)</label>
          <input name="oran" class="num" value="${yuz(s.oran)}" style="font-weight:700">
          <div class="alan-not">Aşağıdaki kalemlere ayrı oran yazılmazsa hepsine bu uygulanır.</div></div>
        <div class="alan"><label>Ara dönem artışı</label>
          <div class="satir"><select name="araAy">${C.secenekler(U.AYLAR.map((a, i) => ({ deger: i + 1, etiket: a })).slice(1), s.araAy)}</select>
            <input name="araOran" class="num" value="${yuz(s.araOran)}" placeholder="% yok" style="width:80px"></div>
          <div class="alan-not">Yıl içinde asgari ücrete ikinci bir artış beklentisi (boş = yok). Ocak'taki tutar üzerine uygulanır.</div></div>
      </div>
      <details class="ust-bosluk"${ongoruDurum && (s.oranAsgari != null || s.oranDilim != null || s.oranSakatlik != null) ? ' open' : ''}>
        <summary class="kucuk kalin" style="cursor:pointer">Kalem bazında farklı oran ve yuvarlama</summary>
        <div class="izgara izgara-4 ust-bosluk" id="ongoruEk">
          <div class="alan"><label>Asgari ücret artışı (%)</label><input name="oranAsgari" class="num" value="${yuz(s.oranAsgari)}" placeholder="genel oran"></div>
          <div class="alan"><label>GV dilimleri artışı (%)</label><input name="oranDilim" class="num" value="${yuz(s.oranDilim)}" placeholder="genel oran"></div>
          <div class="alan"><label>Sakatlık indirimi artışı (%)</label><input name="oranSakatlik" class="num" value="${yuz(s.oranSakatlik)}" placeholder="genel oran"></div>
          <div class="alan"><label>Yuvarlama</label>
            <div class="satir kucuk">Dilim <select name="dilimAdim">${C.secenekler([{ deger: 1, etiket: '1 TL' }, { deger: 100, etiket: '100 TL' },
              { deger: 1000, etiket: '1.000 TL' }, { deger: 10000, etiket: '10.000 TL' }], s.dilimAdim)}</select>
              Sakatlık <select name="sakatlikAdim">${C.secenekler([{ deger: 1, etiket: '1 TL' }, { deger: 10, etiket: '10 TL' },
              { deger: 100, etiket: '100 TL' }], s.sakatlikAdim)}</select></div></div>
        </div>
      </details>
      <div class="btn-satir ust-bosluk">
        <button class="btn btn-ikincil" id="ongoruOnizle">Önizle</button>
        ${ongoruDurum && ongoruDurum.o ? `<button class="btn" id="ongoruUygula">${s.hedefYil} parametrelerini oluştur</button>` : ''}
        ${hedefVar ? `<span class="kucuk" style="color:var(--warn)">⚠ ${s.hedefYil} parametreleri zaten var; uygularsanız asgari ücret,
          dilimler ve sakatlık tutarları üzerine yazılır (diğer oranlara dokunulmaz).</span>` : ''}
      </div>
      ${ongoruDurum && ongoruDurum.o ? `<div class="tablo-sar ust-bosluk"><table class="genis-tablo">
        <thead><tr><th>Kalem</th><th class="num">${s.kaynakYil}</th><th class="num">${s.hedefYil} (öngörü)</th><th class="num">Artış</th><th></th></tr></thead>
        <tbody>${ongoruDurum.o.satirlar.map(r => `<tr><td>${U.esc(r.kalem)}</td>
          <td class="num">${r.kaynak == null ? '<span class="soluk">sınırsız</span>' : B.tl(r.kaynak, 2)}</td>
          <td class="num kalin">${r.hedef == null ? '<span class="soluk">sınırsız</span>' : B.tl(r.hedef, 2)}</td>
          <td class="num">${r.kaynak && r.hedef ? B.oran(r.hedef / r.kaynak - 1) : ''}</td>
          <td class="kucuk soluk">${U.esc(r.not || '')}</td></tr>`).join('')}</tbody></table></div>` : ''}
    </div>`;
  }

  function ongoruOku() {
    const f = C.formOku(U.el('ongoruForm'));
    const e = C.formOku(U.el('ongoruEk'));
    const yuzde = v => String(v || '').trim() === '' ? null : API.trSayi(v) / 100;
    const s = {
      kaynakYil: Number(f.kaynakYil), hedefYil: Number(f.hedefYil), oran: yuzde(f.oran),
      araAy: Number(f.araAy), araOran: yuzde(f.araOran),
      oranAsgari: yuzde(e.oranAsgari), oranDilim: yuzde(e.oranDilim), oranSakatlik: yuzde(e.oranSakatlik),
      dilimAdim: Number(e.dilimAdim), sakatlikAdim: Number(e.sakatlikAdim),
    };
    if (s.oran == null) throw new Error('Genel artış oranını girin.');
    return s;
  }

  function ongoruBagla() {
    const on = U.el('ongoruOnizle');
    if (!on) return;
    // Kaynak yıl değişince hedef yıl kendiliğinden bir sonraki yıl olur
    const ky = document.querySelector('#ongoruForm [name=kaynakYil]');
    ky.onchange = () => { document.querySelector('#ongoruForm [name=hedefYil]').value = Number(ky.value) + 1; };
    on.onclick = () => {
      try { const s = ongoruOku(); ongoruDurum = { s: s, o: API.ongoruHesapla(s) }; APP.tazele(); }
      catch (e) { U.bildir(e.message, 'hata'); }
    };
    const ub = U.el('ongoruUygula');
    if (ub) ub.onclick = async () => {
      let s;
      try { s = ongoruOku(); } catch (e) { return U.bildir(e.message, 'hata'); }
      const varMi = API.parametreDurumu(s.hedefYil).var;
      const ok = await C.onay({ baslik: s.hedefYil + ' Öngörüsü',
        mesaj: `${s.kaynakYil} yasal parametrelerine <strong>%${B.tlDuz(s.oran * 100, 2)}</strong> artış uygulanarak
                <strong>${s.hedefYil}</strong> parametreleri oluşturulacak${s.araOran ? ` (${U.AYLAR[s.araAy - 1]} ara artışı %${B.tlDuz(s.araOran * 100, 2)})` : ''}.`,
        detay: varMi ? `${s.hedefYil} parametreleri zaten var: asgari ücret, GV dilimleri ve sakatlık tutarlarının üzerine yazılacak.
                        ${s.hedefYil} çalışmalarının bütün hesapları değişir.` : null,
        evetYazi: 'Oluştur' });
      if (!ok) return;
      try {
        API.ongoruUygula(s);
        ongoruDurum = null;
        U.bildir(s.hedefYil + ' parametreleri öngörüyle oluşturuldu.', 'basari');
        APP.secimYap(s.hedefYil, null);          // ekran oluşturulan yılı göstersin
      } catch (e) { U.bildir(e.message, 'hata'); }
    };
  }

  function ay(dizi, ondalik) {
    return dizi.slice(1).map(v => `<td class="num">${B.tl(v, ondalik || 0)}</td>`).join('');
  }

  APP.modulKaydet({
    id: 'parametre', ad: 'Parametreler', ikon: '⚙', grup: 'Tanımlar',
    baslik: 'Parametreler', altBaslik: 'Yıllık oranlar, asgari ücret, vergi tarifesi, zam kademesi',
    yetki: 'parametre.oku', ciz: ciz,
  });
})();
