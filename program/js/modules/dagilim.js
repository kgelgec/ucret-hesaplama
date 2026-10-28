/* =====================================================================
   MAAŞ DAĞILIMI

   Her grup için "hangi maaş aralığında kaç kişi var" tablosu ve maaşların
   küçükten büyüğe sıralı listesi. Sıralı listedeki en küçük ve en büyük
   maaş, zam kademesinin alt / üst eşiğini belirlerken yol gösterir.

   1) Aralık tablosu: her grubun aralıkları kendi maaşlarından OTOMATİK
      seçilir (yelpazeye göre 5 bin, 10 bin… basamak) ya da grup için
      sabitlenir (Aralıkları Düzenle).
   2) Sıralı liste: maaşlar küçükten büyüğe; yaka bazında en küçük / en
      büyük / ortanca. Zam kademesi ÖNCEKİ YIL maaşına uygulandığı için
      varsayılan esas önceki yıl maaşıdır; mevcut kademe eşikleri yanında
      gösterilir.
   Tutarlar NET maaştır.
   ===================================================================== */
(function () {
  'use strict';

  let esas = 'eski';      // 'eski' = önceki yıl maaşı (zam öncesi) | 'yeni' = yeni yıl maaşı
  let yakaSuz = '';       // '' | 'B' | 'M'

  /* Personel eklenip çıkarıldıkça tablo kendiliğinden güncellenir: her açılışta
     çalışmanın GÜNCEL personelinden hesaplanır (kayıtlı bir liste değildir).
     Yıl içinde ayrılan / giren kişi işaretlenir. Onaylı çalışmada onay
     anındaki tarihler esas alınır (bkz. calisma_personel.onay_*). */
  function durumOf(s, yil) {
    const cikis = s.kp.onay_sabit ? s.kp.onay_cikis : s.kp.isten_ayrilis;
    const giris = s.kp.onay_sabit ? s.kp.onay_giris : s.kp.ise_giris;
    if (cikis && Number(String(cikis).slice(0, 4)) === yil) return { kod: 'cikis', ad: 'çıkış ' + U.tarihGoster(cikis) };
    if (giris && Number(String(giris).slice(0, 4)) === yil) return { kod: 'giris', ad: 'yeni giriş' };
    return null;
  }

  const maasOf = s => esas === 'eski' ? s.zam.eski : s.zam.yeni;
  const tl = x => B.tlDuz(Math.round(x));

  function aralikEtiketleri(sinir) {
    const e = [];
    for (let i = 0; i <= sinir.length; i++) {
      if (i === 0) e.push(tl(sinir[0]) + ' altı');
      else if (i === sinir.length) e.push(tl(sinir[i - 1]) + ' ve üzeri');
      else e.push(tl(sinir[i - 1]) + ' – ' + tl(sinir[i]));
    }
    return e;
  }
  function kova(sinir, x) { let b = 0; while (b < sinir.length && x >= sinir[b]) b++; return b; }
  function ortanca(a) {
    if (!a.length) return 0;
    const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /* LİSTEYE KİM GİRER: zam öngörülmeyen kişi dağılımda yer alırsa eşik seçimini
     yanıltır; bu yüzden liste elle daraltılıp genişletilebilir.
       · varsayılan: yıl içinde işe girenler (zam öngörülmez) listede YOK
       · elle: "Çıkar" / "Ekle" — çalışmanın ayarında saklanır
         (dagilim.haric / dagilim.dahil: T.C. listesi). Yeni yıla taşınmaz.
     Bu yalnızca bu tablonun seçimidir; kişi bütçeden silinmez. */
  function secimOku(c) {
    const a = API.calismaAyarOku(c.id);
    const l = k => new Set(String(a[k] || '').split(',').filter(Boolean));
    return { haric: l('dagilim.haric'), dahil: l('dagilim.dahil') };
  }
  function listedeMi(s, c, sec) {
    const tc = String(s.kp.tc_kimlik_no);
    if (sec.dahil.has(tc)) return true;
    if (sec.haric.has(tc)) return false;
    return (durumOf(s, c.yil) || {}).kod !== 'giris';
  }
  function secimYaz(c, tc, listeye) {
    const sec = secimOku(c);
    const s = API.calismaHesapla(c.id).kisiler.find(x => String(x.kp.tc_kimlik_no) === tc);
    const varsayilan = s ? (durumOf(s, c.yil) || {}).kod !== 'giris' : true;
    sec.haric.delete(tc); sec.dahil.delete(tc);
    if (listeye && !varsayilan) sec.dahil.add(tc);
    if (!listeye && varsayilan) sec.haric.add(tc);
    API.calismaAyarYaz(c.id, { 'dagilim.haric': [...sec.haric].join(','), 'dagilim.dahil': [...sec.dahil].join(',') });
  }

  function grupBolumu(c) {
    const h = API.calismaHesapla(c.id);
    const sec = secimOku(c);
    const yazilabilir = API.calismaYazilabilir(c) && API.yetkiVar('personel.yaz');
    /* Ayrılanlar burada ayrıca süzülmez (bütçeden çıkarılmaları Personel ve Zam ekranındadır);
       yıl içinde girenler varsayılan olarak listeye alınmaz (bkz. listedeMi). */
    const butun = h.kisiler.filter(s => (s.zam.eski > 0 || s.zam.yeni > 0));
    const tum = butun.filter(s => listedeMi(s, c, sec));
    const disarida = butun.filter(s => !listedeMi(s, c, sec)).sort((a, b) => maasOf(a) - maasOf(b));
    const kisiler = tum.filter(s => !yakaSuz || s.kp.yaka === yakaSuz);
    const sabit = API.maasAraliklari(c.grup_kod);
    const sinir = sabit || API.aralikOner(tum.map(maasOf));
    const etiket = aralikEtiketleri(sinir);
    const satir = etiket.map(e => ({ ad: e, kisi: 0, B: 0, M: 0, maas: 0, eski: 0, zam: 0, maliyet: 0 }));
    kisiler.forEach(s => {
      const r = satir[kova(sinir, maasOf(s))];
      r.kisi++; r[s.kp.yaka === 'M' ? 'M' : 'B']++;
      r.maas += maasOf(s); r.eski += s.zam.eski; r.zam += s.zam.miktar; r.maliyet += s.yil.maliyet;
    });
    const n = kisiler.length || 1;
    const enCok = Math.max(1, ...satir.map(r => r.kisi));
    const T = satir.reduce((t, r) => { ['kisi', 'B', 'M', 'maas', 'eski', 'zam', 'maliyet'].forEach(k => { t[k] += r[k]; }); return t; },
                           { kisi: 0, B: 0, M: 0, maas: 0, eski: 0, zam: 0, maliyet: 0 });

    // --- Sıralı liste ve eşik özeti ---
    const sirali = [...kisiler].sort((a, b) => maasOf(a) - maasOf(b));
    const isimGor = API.yetkiVar('personel.oku');
    const kademe = API.calismaZamKademe(c, h.P);
    const ozetSatir = [['', 'Tümü', tum], ['B', 'Beyaz yaka', tum.filter(s => s.kp.yaka !== 'M')], ['M', 'Mavi yaka', tum.filter(s => s.kp.yaka === 'M')]]
      .filter(x => x[2].length).map(([y, ad, l]) => {
        const m = l.map(maasOf);
        const k = y ? kademe[y] : null;
        return `<tr><td><strong>${ad}</strong></td><td class="num">${l.length}</td>
          <td class="num"><strong>${tl(Math.min(...m))}</strong></td><td class="num"><strong>${tl(Math.max(...m))}</strong></td>
          <td class="num">${tl(ortanca(m))}</td><td class="num">${tl(m.reduce((a, b) => a + b, 0) / m.length)}</td>
          <td class="num kucuk soluk">${k ? tl(k.altEsik) + ' / ' + tl(k.ustEsik) : ''}</td></tr>`;
      }).join('');
    const minM = sirali.length ? maasOf(sirali[0]) : 0, maxM = sirali.length ? maasOf(sirali[sirali.length - 1]) : 0;
    const esasAd = esas === 'eski' ? (c.yil - 1) + ' maaşı' : c.yil + ' maaşı';

    return `
      <div class="kart">
        <div class="kart-baslik"><div>
          <h2>${c.yil} · ${U.esc(c.grup_adi)} — Maaş Dağılımı</h2>
          <div class="kart-aciklama">${kisiler.length} kişi · esas: <strong>${esasAd}</strong> (net) ·
            aralıklar <strong>${sabit ? 'sabit' : 'otomatik'}</strong>${sabit ? '' : ' (bu grubun maaşlarına göre)'}
            ${disarida.length ? ` · listeye alınmayan <strong>${disarida.length}</strong> kişi (aşağıda)` : ''}</div></div>
          ${API.yetkiVar('parametre.yaz') ? `<button class="btn btn-ikincil btn-kucuk" data-aralik="${U.esc(c.grup_kod)}" data-cal="${c.id}">Aralıkları Düzenle</button>` : ''}
        </div>
        <div class="tablo-sar"><table class="genis-tablo">
          <thead><tr><th>Maaş aralığı</th><th class="num">Kişi</th><th style="min-width:160px">Pay</th>
            <th class="num">Beyaz</th><th class="num">Mavi</th><th class="num">Toplam maaş (aylık)</th><th class="num">Ortalama maaş</th>
            <th class="num">Ort. zam oranı</th><th class="num">${c.yil} yıllık maliyet</th></tr></thead>
          <tbody>${satir.map(r => `<tr${r.kisi ? '' : ' class="soluk"'}>
            <td><strong>${r.ad}</strong></td><td class="num"><strong>${r.kisi}</strong></td>
            <td><div class="dagilim-cubuk"><span style="width:${(r.kisi / enCok * 100).toFixed(1)}%"></span></div>
                <span class="kucuk soluk">${B.oran(r.kisi / n)}</span></td>
            <td class="num">${r.B || ''}</td><td class="num">${r.M || ''}</td>
            <td class="num">${r.kisi ? tl(r.maas) : ''}</td><td class="num">${r.kisi ? tl(r.maas / r.kisi) : ''}</td>
            <td class="num">${r.eski ? B.oran(r.zam / r.eski) : ''}</td><td class="num">${r.kisi ? tl(r.maliyet) : ''}</td></tr>`).join('')}
            <tr class="toplam-satir"><td>Toplam</td><td class="num">${T.kisi}</td><td></td><td class="num">${T.B}</td><td class="num">${T.M}</td>
              <td class="num">${tl(T.maas)}</td><td class="num">${T.kisi ? tl(T.maas / T.kisi) : ''}</td>
              <td class="num">${T.eski ? B.oran(T.zam / T.eski) : ''}</td><td class="num">${tl(T.maliyet)}</td></tr>
          </tbody></table></div>

        <h3 class="ust-bosluk">Küçükten büyüğe — en küçük ve en büyük maaş</h3>
        <div class="kucuk soluk">Zam kademesinin alt ve üst eşiği <strong>önceki yıl maaşına</strong> uygulanır; eşik belirlerken
          esası "${c.yil - 1} maaşı" bırakın. Mevcut eşikler Çalışmalar → ✎ ekranında değiştirilir.</div>
        <div class="tablo-sar ust-bosluk"><table class="genis-tablo">
          <thead><tr><th></th><th class="num">Kişi</th><th class="num">En küçük</th><th class="num">En büyük</th>
            <th class="num">Ortanca</th><th class="num">Ortalama</th><th class="num">Mevcut kademe (alt / üst eşik)</th></tr></thead>
          <tbody>${ozetSatir}</tbody></table></div>
        <details class="ust-bosluk" open><summary class="kucuk"><strong>Sıralı liste (${sirali.length} kişi)</strong>
          ${yazilabilir ? ' — zam almayacak kişiyi <strong>Çıkar</strong> ile listeden çıkarın' : ''}</summary>
          <div class="tablo-sar ust-bosluk" style="max-height:520px"><table class="genis-tablo">
            <thead><tr><th class="num">Sıra</th><th>Ad Soyad</th><th>Yaka</th><th>Bütçe bölümü</th>
              <th class="num">${c.yil - 1} maaşı</th><th class="num">${c.yil} maaşı</th><th class="num">Zam oranı</th>
              ${yazilabilir ? '<th></th>' : ''}</tr></thead>
            <tbody>${sirali.map((s, i) => {
              const m = maasOf(s), uc = m === minM ? 'en küçük' : (m === maxM ? 'en büyük' : '');
              const d = durumOf(s, c.yil);
              return `<tr${uc ? ' class="dagilim-uc"' : ''}>
                <td class="num">${i + 1}</td>
                <td>${isimGor ? U.esc(s.kp.ad_soyad) : '—'}${uc ? ` <span class="rz rz-sari">${uc}</span>` : ''}${d
                  ? ` <span class="rz ${d.kod === 'cikis' ? 'rz-kirmizi' : 'rz-mavi'}">${U.esc(d.ad)}</span>` : ''}</td>
                <td>${s.kp.yaka === 'M' ? 'Mavi' : 'Beyaz'}</td>
                <td class="kucuk">${U.esc(API.bolumEtiket(c.grup_kod, s.kp.butce_bolumu) || '')}</td>
                <td class="num${esas === 'eski' ? ' kalin' : ''}">${tl(s.zam.eski)}</td>
                <td class="num${esas === 'yeni' ? ' kalin' : ''}">${tl(s.zam.yeni)}</td>
                <td class="num">${B.oran(s.zam.oran)}</td>
                ${yazilabilir ? `<td><button class="btn btn-ikincil btn-kucuk" data-cikar="${U.esc(s.kp.tc_kimlik_no)}" data-cal="${c.id}">Çıkar</button></td>` : ''}</tr>`; }).join('')}
            </tbody></table></div>
        </details>
        ${disarida.length ? `
        <details class="ust-bosluk"${disarida.length <= 15 ? ' open' : ''}><summary class="kucuk"><strong>Listeye alınmayanlar (${disarida.length} kişi)</strong>
          — tablo ve en küçük / en büyük hesabına girmez; bütçede yerinde durur</summary>
          <div class="tablo-sar ust-bosluk"><table class="genis-tablo">
            <thead><tr><th>Ad Soyad</th><th>Yaka</th><th>Neden</th><th class="num">${c.yil - 1} maaşı</th><th class="num">${c.yil} maaşı</th>
              ${yazilabilir ? '<th></th>' : ''}</tr></thead>
            <tbody>${disarida.map(s => {
              const d = durumOf(s, c.yil);
              const neden = sec.haric.has(String(s.kp.tc_kimlik_no)) ? 'elle çıkarıldı' : (d && d.kod === 'giris' ? 'yıl içinde giriş — zam yok' : '');
              return `<tr class="soluk"><td>${isimGor ? U.esc(s.kp.ad_soyad) : '—'}</td><td>${s.kp.yaka === 'M' ? 'Mavi' : 'Beyaz'}</td>
                <td class="kucuk">${neden}</td><td class="num">${tl(s.zam.eski)}</td><td class="num">${tl(s.zam.yeni)}</td>
                ${yazilabilir ? `<td><button class="btn btn-ikincil btn-kucuk" data-ekle="${U.esc(s.kp.tc_kimlik_no)}" data-cal="${c.id}">Ekle</button></td>` : ''}</tr>`;
            }).join('')}</tbody></table></div>
        </details>` : ''}
      </div>`;
  }

  function ciz(kap) {
    const liste = APP.calismalar();
    kap.innerHTML = `
      <div class="kart">
        <div class="suzgec-satir">
          <label class="satir">Esas maaş
            <select id="dgEsas">
              <option value="eski"${esas === 'eski' ? ' selected' : ''}>Önceki yıl maaşı (zam öncesi)</option>
              <option value="yeni"${esas === 'yeni' ? ' selected' : ''}>Yeni yıl maaşı (zamlı)</option>
            </select></label>
          <select id="dgYaka">${C.secenekler([{ deger: 'B', etiket: 'Beyaz yaka' }, { deger: 'M', etiket: 'Mavi yaka' }], yakaSuz, 'Tüm yakalar')}</select>
          <span class="kucuk soluk">Aralıklar her grubun kendi maaşlarına göre seçilir; grup bazında sabitlenebilir.</span>
        </div>
      </div>
      ${liste.map(grupBolumu).join('')}`;
    U.el('dgEsas').onchange = e => { esas = e.target.value; APP.tazele(); };
    U.el('dgYaka').onchange = e => { yakaSuz = e.target.value; APP.tazele(); };
    const calBul = id => liste.find(x => x.id === Number(id));
    kap.querySelectorAll('[data-cikar], [data-ekle]').forEach(b => b.onclick = () => {
      const ekle = b.hasAttribute('data-ekle');
      try {
        secimYaz(calBul(b.getAttribute('data-cal')), b.getAttribute(ekle ? 'data-ekle' : 'data-cikar'), ekle);
        APP.tazele();
      } catch (e) { U.bildir(e.message, 'hata'); }
    });
    kap.querySelectorAll('[data-aralik]').forEach(b => b.onclick = () =>
      aralikDuzenle(b.getAttribute('data-aralik'), Number(b.getAttribute('data-cal'))));
  }

  function aralikDuzenle(grupKod, calismaId) {
    const sabit = API.maasAraliklari(grupKod);
    const h = API.calismaHesapla(calismaId);
    const otomatik = API.aralikOner(h.kisiler.filter(s => s.zam.eski > 0 || s.zam.yeni > 0).map(maasOf));
    const yaz = a => (a || []).map(x => B.tlDuz(x)).join('; ');
    const kip = C.kipAc({
      baslik: 'Maaş Aralıkları', altBaslik: (API.grupListe().find(g => g.kod === grupKod) || {}).ad || grupKod,
      govde: `<p class="kucuk">Aralıkların <strong>alt sınırlarını</strong> noktalı virgülle yazın. Örnek:
          <code>50.000; 75.000; 100.000</code> → "50.000 altı", "50.000 – 75.000", "75.000 – 100.000", "100.000 ve üzeri".</p>
        <div class="alan"><label>Sınırlar</label><input id="arSinir" value="${U.esc(yaz(sabit || otomatik))}"></div>
        <div class="kucuk soluk">Şu anki maaşlara göre önerilen: <code>${U.esc(yaz(otomatik))}</code></div>
        <div class="uyari uyari-bilgi kucuk ust-bosluk"><span class="ik">💡</span><div><strong>Otomatik</strong> seçilirse aralıklar her
          yıl maaşlarla birlikte kayar. Yıllar arası karşılaştırma yapacaksanız <strong>sabitleyin</strong>.</div></div>`,
      altlik: `<button class="btn btn-ikincil" data-otomatik>Otomatiğe Dön</button>
               <button class="btn btn-ikincil" data-kip-kapat>Vazgeç</button>
               <button class="btn" data-kaydet>Sabitle</button>`,
    });
    kip.querySelector('[data-otomatik]').onclick = () => {
      try { API.maasAralikYaz(grupKod, null); C.kipKapat(); U.bildir('Aralıklar otomatik.', 'basari'); APP.tazele(); }
      catch (e) { U.bildir(e.message, 'hata'); }
    };
    kip.querySelector('[data-kaydet]').onclick = () => {
      try {
        const s = API.maasAralikYaz(grupKod, U.el('arSinir').value);
        if (!s) throw new Error('Geçerli bir sınır girilmedi.');
        C.kipKapat(); U.bildir(s.length + 1 + ' aralık sabitlendi.', 'basari'); APP.tazele();
      } catch (e) { U.bildir(e.message, 'hata'); }
    };
  }

  APP.modulKaydet({
    id: 'dagilim', ad: 'Maaş Dağılımı', ikon: '📶', grup: 'Genel',
    baslik: 'Maaş Dağılımı', altBaslik: 'Maaş aralıklarına göre kişi sayısı ve sıralı maaş listesi',
    yetki: 'ozet.oku', calismaGerekli: true, tumuDestek: true, ciz: ciz,
  });
})();
