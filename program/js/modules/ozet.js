/* =====================================================================
   ÖZET — yaka, grup, bütçe bölümü ve ay kırılımında toplam maliyet,
   bütçe ve zam

   Önceki yıl maliyeti ve bütçelenen maliyet bütçe bölümünden gelir,
   elle girilir. Toplam maliyet ve zam rakamları hesaptan gelir.

   Maaş ve zam tutarları çalışmanın ücret esasındadır (net / brüt). "Tümü"de
   gruplar farklı esastaysa (birlesikHesapla → karisikEsas) maaş ve zam
   TOPLAMLARI gösterilmez ("—"); maliyetler esastan bağımsızdır, gösterilir.
   ===================================================================== */
(function () {
  'use strict';

  const YAKA = [['B', 'Beyaz Yaka'], ['M', 'Mavi Yaka']];

  function ciz(kap) {
    /* Tek grup ya da "Tümü" (yetkili olunan grupların birleşimi) */
    const liste = APP.calismalar();
    const tek = !APP.tumuMu();
    const c = tek ? liste[0] : {
      yil: APP.yil(), grup_adi: 'Tüm Gruplar', ad: liste.map(x => x.grup_adi).join(' + '),
    };
    const h = API.birlesikHesapla(liste);
    const oz = h.ozet;
    /* Karışık esasta maaş / zam toplamı ve ondan türeyen oran yazılmaz */
    const kar = h.karisikEsas, es = kar ? null : (h.esaslar[0] || 'NET');
    const yok = '<span class="cok-soluk" title="' + B.KARISIK_ESAS + '">—</span>';
    const mt = v => kar ? yok : B.tl(v);                       // maaş / zam toplamı
    const mo = (a, b) => kar ? yok : B.oran(b ? a / b : 0);     // toplamlardan oran
    const esEk = es ? ' (' + B.esas(es) + ')' : '';
    const yazabilir = tek && API.calismaYazilabilir(c) && API.yetkiVar('personel.yaz');

    // Yaka bazında toplamlar
    const t = {};
    YAKA.concat([['T', 'Toplam']]).forEach(y => { t[y[0]] = { kisi: 0, maliyet: 0, zam: 0, eski: 0, oranTop: 0, ay: [] }; });
    const bolum = {};
    const grp = {};
    const ayToplam = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    h.kisiler.forEach(s => {
      [s.kp.yaka, 'T'].forEach(y => {
        const a = t[y]; if (!a) return;
        a.kisi++; a.maliyet += s.yil.maliyet; a.zam += s.zam.miktar; a.eski += s.zam.eski; a.oranTop += s.zam.oran;
      });
      // Anahtar grup + bölüm: "Tümü"de farklı grupların aynı adlı bölümleri karışmasın
      const ba = s.calisma.grup_kod + '|' + (s.kp.butce_bolumu || '');
      const b = bolum[ba] = bolum[ba] || { kisi: 0, maliyet: 0, zam: 0, eski: 0, ocak: 0, onceki: 0,
        etiket: (tek ? '' : s.calisma.grup_adi + ' · ') + (API.bolumEtiket(s.calisma.grup_kod, s.kp.butce_bolumu) || '—'),
        sira: [s.calisma.grup_kod, API.bolumSira(s.calisma.grup_kod, s.kp.butce_bolumu)] };
      b.kisi++; b.maliyet += s.yil.maliyet; b.zam += s.zam.miktar; b.eski += s.zam.eski;
      b.ocak += s.yil.aylar[1].DM; b.onceki += s.kp.maliyet_onceki || 0;
      const g = grp[s.calisma.grup_adi] = grp[s.calisma.grup_adi] || { kisi: 0, maliyet: 0, zam: 0, eski: 0, onceki: 0,
        esas: kar ? B.esasKod(s.calisma) : es };
      g.kisi++; g.maliyet += s.yil.maliyet; g.zam += s.zam.miktar; g.eski += s.zam.eski; g.onceki += s.kp.maliyet_onceki || 0;
      for (let m = 1; m <= 12; m++) ayToplam[m] += s.yil.aylar[m].DM;
    });
    const deg = a => oz[a] == null ? null : Number(oz[a]);
    t.T.onceki = (deg('onceki_B') || 0) + (deg('onceki_M') || 0);
    t.T.butce = (deg('butce_B') || 0) + (deg('butce_M') || 0);
    t.B.onceki = deg('onceki_B'); t.M.onceki = deg('onceki_M');
    t.B.butce = deg('butce_B'); t.M.butce = deg('butce_M');

    const girdi = (anahtar, v) => yazabilir
      ? `<input class="ozet-girdi num" data-ozet="${anahtar}" value="${v == null ? '' : B.tlDuz(v, 2)}">`
      : (v == null ? '<span class="cok-soluk">—</span>' : B.tl(v));

    kap.innerHTML = `
      <div class="kart">
        <div class="kart-baslik"><div>
          <h2>${c.yil} · ${U.esc(c.grup_adi)} — Toplam Maliyetler</h2>
          <div class="kart-aciklama">${U.esc(c.ad)} · ${h.kisiler.length} kişi${es ? ' · ' + B.esasRozet(es) : ''}</div>
        </div></div>
        ${kar ? B.karisikEsasUyari() : ''}

        <div class="izgara izgara-4">
          <div class="stat"><div class="kucuk soluk">${c.yil} toplam maliyet</div>
            <div class="gosterge">${B.tlDuz(t.T.maliyet)}</div></div>
          <div class="stat"><div class="kucuk soluk">Bütçelenen</div>
            <div class="gosterge">${t.T.butce ? B.tlDuz(t.T.butce) : '—'}</div>
            ${t.T.butce ? `<div class="kucuk">Fark: ${B.isaretli(t.T.maliyet - t.T.butce)}</div>` : ''}</div>
          <div class="stat"><div class="kucuk soluk">Toplam zam miktarı${esEk}</div>
            <div class="gosterge">${kar ? yok : B.tlDuz(t.T.zam)}</div>
            <div class="kucuk soluk">${kar ? 'Gruplar farklı ücret esasında' : 'Oran ' + B.oran(t.T.eski ? t.T.zam / t.T.eski : 0)}</div></div>
          <div class="stat"><div class="kucuk soluk">Ocak aylık maliyet</div>
            <div class="gosterge">${B.tlDuz(ayToplam[1])}</div></div>
        </div>

        <div class="tablo-sar ust-bosluk"><table class="ozet-tablo">
          <thead><tr><th></th><th class="num">Kişi</th>
            <th class="num">${c.yil - 1} Toplam Maliyet</th><th class="num">${c.yil} Bütçelenen Maliyet</th>
            <th class="num">${c.yil} Toplam Maliyet</th><th class="num">Bütçe Farkı</th>
            <th class="num">Zam Miktarı</th><th class="num">Zam Oranı</th><th class="num">Ortalama Zam</th></tr></thead>
          <tbody>
            ${YAKA.map(y => { const a = t[y[0]]; return `<tr>
              <td class="kalin">${y[1]}</td><td class="num">${a.kisi}</td>
              <td class="num">${girdi('onceki_' + y[0], a.onceki)}</td>
              <td class="num">${girdi('butce_' + y[0], a.butce)}</td>
              <td class="num kalin">${B.tl(a.maliyet)}</td>
              <td class="num">${a.butce ? B.isaretli(a.maliyet - a.butce) : ''}</td>
              <td class="num">${mt(a.zam)}</td>
              <td class="num">${mo(a.zam, a.eski)}</td>
              <td class="num">${kar ? yok : a.kisi ? B.tl(a.zam / a.kisi) : ''}</td></tr>`; }).join('')}
            <tr class="toplam-satir"><td>Toplam</td><td class="num">${t.T.kisi}</td>
              <td class="num">${B.tl(t.T.onceki)}</td><td class="num">${B.tl(t.T.butce)}</td>
              <td class="num">${B.tl(t.T.maliyet)}</td>
              <td class="num">${t.T.butce ? B.isaretli(t.T.maliyet - t.T.butce) : ''}</td>
              <td class="num">${mt(t.T.zam)}</td>
              <td class="num">${mo(t.T.zam, t.T.eski)}</td>
              <td class="num">${kar ? yok : t.T.kisi ? B.tl(t.T.zam / t.T.kisi) : ''}</td></tr>
          </tbody></table></div>
        <div class="kucuk soluk ust-bosluk">Ortalama zam oranı (kişi ortalaması):
          ${B.oran(t.T.kisi ? t.T.oranTop / t.T.kisi : 0)}.
          ${c.yil - 1} maliyeti ve bütçelenen maliyet bütçe bölümünden gelir; hücreye yazıp Enter'a basın.</div>
      </div>

      ${tek ? '' : `<div class="kart">
        <div class="kart-baslik"><div><h2>Gruplara Göre</h2></div></div>
        <div class="tablo-sar"><table>
          <thead><tr><th>Grup</th><th class="num">Kişi</th><th class="num">${c.yil - 1} Maaş${esEk}</th><th class="num">Zam Miktarı</th>
            <th class="num">Zam Oranı</th><th class="num">${c.yil} Maaş${esEk}</th><th class="num">${c.yil - 1} Maliyet</th><th class="num">${c.yil} Maliyet</th><th class="num">Fark</th></tr></thead>
          <tbody>${Object.keys(grp).map(k => { const g = grp[k]; return `<tr><td class="kalin">${U.esc(k)}${kar ? ' ' + B.esasRozet(g.esas) : ''}</td><td class="num">${g.kisi}</td>
            <td class="num">${B.tl(g.eski)}</td><td class="num">${B.tl(g.zam)}</td><td class="num">${B.oran(g.eski ? g.zam / g.eski : 0)}</td><td class="num">${B.tl(g.eski + g.zam)}</td>
            <td class="num">${B.tl(g.onceki)}</td><td class="num kalin">${B.tl(g.maliyet)}</td><td class="num">${B.isaretli(g.maliyet - g.onceki)}</td></tr>`; }).join('')}
          ${toplamSatiri(Object.values(grp), false, kar)}</tbody></table></div>
      </div>`}

      <div class="kart">
        <div class="kart-baslik"><div><h2>Aylık Maliyet</h2>
          <div class="kart-aciklama">İşveren maliyeti; teşvikler düşülmüş.</div></div></div>
        <div class="tablo-sar"><table>
          <thead><tr>${U.AYLAR.map(a => `<th class="num">${a}</th>`).join('')}<th class="num">Toplam</th></tr></thead>
          <tbody><tr>${ayToplam.slice(1).map(v => `<td class="num">${B.tl(v)}</td>`).join('')}
            <td class="num kalin">${B.tl(t.T.maliyet)}</td></tr></tbody></table></div>
      </div>

      <div class="kart">
        <div class="kart-baslik"><div><h2>Bütçe Bölümlerine Göre</h2></div></div>
        <div class="tablo-sar"><table>
          <thead><tr><th>Bütçe Bölümü</th><th class="num">Kişi</th><th class="num">${c.yil - 1} Maaş${esEk}</th>
            <th class="num">Zam Miktarı</th><th class="num">Zam Oranı</th><th class="num">${c.yil} Maaş${esEk}</th><th class="num">Ocak Maliyeti</th>
            <th class="num">${c.yil - 1} Maliyet</th><th class="num">${c.yil} Maliyet</th><th class="num">Fark</th></tr></thead>
          <tbody>${Object.keys(bolum).sort((x, y) => {
              const a = bolum[x].sira, b = bolum[y].sira;
              return a[0] === b[0] ? a[1] - b[1] : a[0].localeCompare(b[0]);
            }).map(k => { const b = bolum[k]; return `<tr>
            <td>${U.esc(b.etiket)}</td><td class="num">${b.kisi}</td><td class="num">${B.tl(b.eski)}</td>
            <td class="num">${B.tl(b.zam)}</td><td class="num">${B.oran(b.eski ? b.zam / b.eski : 0)}</td><td class="num">${B.tl(b.eski + b.zam)}</td>
            <td class="num">${B.tl(b.ocak)}</td><td class="num">${B.tl(b.onceki)}</td>
            <td class="num kalin">${B.tl(b.maliyet)}</td><td class="num">${B.isaretli(b.maliyet - b.onceki)}</td></tr>`; }).join('')}
          ${toplamSatiri(Object.values(bolum), true, kar)}
          </tbody></table></div>
      </div>`;

    kap.querySelectorAll('[data-ozet]').forEach(inp => {
      const kaydet = () => {
        const v = inp.value.trim();
        try {
          API.calismaOzetYaz(c.id, inp.getAttribute('data-ozet'), v === '' ? null : API.trSayi(v));
          APP.tazele();
        } catch (e) { U.bildir(e.message, 'hata'); }
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') kaydet(); });
      inp.addEventListener('change', kaydet);
    });
  }

  /* Bölüm / grup tablolarının toplam satırı. Oran = toplam zam / toplam maaş
     (kişi ortalaması değil — yaka tablosundaki "Zam Oranı" ile aynı tanım).
     karisik: gruplar farklı ücret esasında → maaş / zam toplamları "—" (maliyet toplamı kalır). */
  function toplamSatiri(liste, ocakVar, karisik) {
    const t = { kisi: 0, eski: 0, zam: 0, ocak: 0, onceki: 0, maliyet: 0 };
    liste.forEach(x => Object.keys(t).forEach(k => { t[k] += x[k] || 0; }));
    const yok = '<span class="cok-soluk" title="' + B.KARISIK_ESAS + '">—</span>';
    const mt = v => karisik ? yok : B.tl(v);
    return `<tr class="toplam-satir"><td>Toplam</td><td class="num">${t.kisi}</td><td class="num">${mt(t.eski)}</td>
      <td class="num">${mt(t.zam)}</td><td class="num">${karisik ? yok : B.oran(t.eski ? t.zam / t.eski : 0)}</td><td class="num">${mt(t.eski + t.zam)}</td>
      ${ocakVar ? `<td class="num">${B.tl(t.ocak)}</td>` : ''}<td class="num">${B.tl(t.onceki)}</td>
      <td class="num">${B.tl(t.maliyet)}</td><td class="num">${B.isaretli(t.maliyet - t.onceki)}</td></tr>`;
  }

  APP.modulKaydet({
    id: 'ozet', ad: 'Özet', ikon: '📊', grup: 'Genel',
    baslik: 'Özet', altBaslik: 'Toplam maliyet, bütçe ve zam',
    yetki: 'ozet.oku', calismaGerekli: true, tumuDestek: true, ciz: ciz,
  });
})();
