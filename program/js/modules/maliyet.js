/* =====================================================================
   MALİYET TABLOSU — kişi × ay
   Kişi × ay tablosu; gösterilen tutar seçilebilir. Kişiye tıklanınca
   o kişinin bordro dökümü açılır (motorun bir aylık hesabındaki bütün
   ara değerler, kalem kalem satır olarak).

   Ücret esası: AM (maaş), AV (mesai), AZ (ek ödeme) ve aynî girdi çalışmanın
   esasındadır (net ya da brüt); etiketleri esası izler. Brüt toplam, net
   ödeme, kesintiler ve maliyet her iki esasta aynı anlamdadır. "Tümü"de
   gruplar farklı esastaysa maaş ölçüsünün toplamları gösterilmez.
   ===================================================================== */
(function () {
  'use strict';

  const OLCU = [
    { k: 'DM', ad: 'Toplam Maliyet' },
    { k: 'CV', ad: 'Brüt Toplam' },
    { k: 'DD', ad: 'Net Ödeme' },
    { k: 'AM', ad: 'Maaş', esasli: 1 },        // girilen esasta: "Net Maaş" / "Brüt Maaş"
    { k: 'CW', ad: 'SGK İşçi' },
    { k: 'DE', ad: 'SGK İşveren' },
    { k: 'CZ', ad: 'Ödenecek Gelir Vergisi' },
    { k: 'DB', ad: 'Ödenecek Damga Vergisi' },
    { k: 'TESVIK', ad: 'Teşvikler Toplamı' },
  ];
  let olcu = 'DM', bolumSuz = '';

  function deger(r, k) {
    if (k === 'TESVIK') return r.DG + r.DH + r.DI + r.DJ + r.DK + r.DL;
    return r[k] || 0;
  }

  function ciz(kap) {
    const liste = APP.calismalar();
    const tek = !APP.tumuMu();
    const c = tek ? liste[0] : { yil: APP.yil(), grup_adi: 'Tüm Gruplar' };
    const h = API.birlesikHesapla(liste);
    /* Tek esas → o esasın adı; "Tümü"de karışık esas → maaş ölçüsü kişi bazında kendi esasında, toplamı yok */
    const es = h.karisikEsas ? null : (h.esaslar[0] || 'NET');
    const olcuAd = o => o.esasli ? (es ? B.esasBas(es) + ' ' + o.ad : o.ad + ' (grubun esasında)') : o.ad;
    const toplamYok = olcu === 'AM' && h.karisikEsas;     // farklı esaslar toplanmaz
    const top = v => toplamYok ? '<span class="cok-soluk">—</span>' : B.tl(v);
    // "Tümü"de aynı adlı bölüm farklı gruplarda olabilir; süzgeç ada göre, etiket tek grupta numaralı
    const bolumler = [...new Set(h.kisiler.map(s => s.kp.butce_bolumu || ''))].filter(Boolean)
      .sort((a, b) => tek ? API.bolumSira(c.grup_kod, a) - API.bolumSira(c.grup_kod, b) : a.localeCompare(b, 'tr'));
    if (bolumSuz && bolumler.indexOf(bolumSuz) < 0) bolumSuz = '';
    const satirlar = h.kisiler.filter(s => !bolumSuz || s.kp.butce_bolumu === bolumSuz);
    const ayTop = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let genel = 0;

    kap.innerHTML = `
      <div class="kart">
        <div class="kart-baslik">
          <div><h2>Maliyet Tablosu — ${c.yil} · ${U.esc(c.grup_adi)}</h2>
            <div class="kart-aciklama">Kişinin adına tıklayın: ayların bordro dökümü açılır.
              ${es ? 'Ücret esası: ' + B.esasRozet(es) : ''}</div></div>
          <div class="btn-satir">
            <select id="olcu">${C.secenekler(OLCU.map(o => ({ deger: o.k, etiket: olcuAd(o) })), olcu)}</select>
            <select id="bolumSuz">${C.secenekler(bolumler.map(b => ({ deger: b, etiket: tek ? API.bolumEtiket(c.grup_kod, b) : b })), bolumSuz, 'Tüm bölümler')}</select>
          </div>
        </div>
        ${h.karisikEsas ? B.karisikEsasUyari() : ''}
        <div class="tablo-sar"><table class="genis-tablo">
          <thead><tr><th>Ad Soyad</th>${tek ? '' : '<th>Grup</th>'}<th>Bölüm</th>${U.AYLAR.map(a => `<th class="num">${a.slice(0, 3)}</th>`).join('')}
            <th class="num">Toplam</th></tr></thead>
          <tbody>${satirlar.map(s => {
            let t = 0;
            const hucre = [];
            for (let m = 1; m <= 12; m++) {
              const v = deger(s.yil.aylar[m], olcu);
              t += v; ayTop[m] += v; hucre.push(`<td class="num">${B.tl(v)}</td>`);
            }
            genel += t;
            return `<tr><td><a href="#" data-dokum="${U.esc(s.kp.tc_kimlik_no)}" data-c="${s.calisma.id}">${U.esc(s.kp.ad_soyad)}</a></td>
              ${tek ? '' : `<td class="kucuk">${U.esc(s.calisma.grup_adi)}${h.karisikEsas ? ' ' + B.esasRozet(s.calisma) : ''}</td>`}
              <td class="kucuk">${U.esc(API.bolumEtiket(s.calisma.grup_kod, s.kp.butce_bolumu))}</td>${hucre.join('')}
              <td class="num kalin">${B.tl(t)}</td></tr>`;
          }).join('')}
          <tr class="toplam-satir"><td>Toplam (${satirlar.length})</td>${tek ? '' : '<td></td>'}<td></td>
            ${ayTop.slice(1).map(v => `<td class="num">${top(v)}</td>`).join('')}
            <td class="num">${top(genel)}</td></tr>
          </tbody></table></div>
      </div>`;

    U.el('olcu').onchange = e => { olcu = e.target.value; APP.tazele(); };
    U.el('bolumSuz').onchange = e => { bolumSuz = e.target.value; APP.tazele(); };
    kap.addEventListener('click', e => {
      const a = e.target.closest('[data-dokum]');
      if (!a) return;
      e.preventDefault();
      const s = h.kisiler.find(x => x.kp.tc_kimlik_no === a.getAttribute('data-dokum') && String(x.calisma.id) === a.getAttribute('data-c'));
      if (s) dokumAc(s.calisma, s);
    });
  }

  /* Bordro dökümü — motorun ay hesabındaki alanlar satır olarak.
     [alan kodu, başlık, tür ('g' = aylık girdi, 'o' = oran), vurgu]
     Başlıktaki {Es} / {es} çalışmanın esasıyla doldurulur (girilen esastaki kalemler: maaş, mesai, aynî, ek ödeme).
     AN (net sakatlık indirimi) her zaman nettir; brüt esasta 0'dır (brüt girildiği için ayrıca eklenmez). */
  const DOKUM = [
    ['_', 'Girdiler'],
    ['tur', 'Hesaplama türü', 'g'], ['kanun', 'Kanun', 'g'], ['AR', 'Sigorta günü'], ['AP', 'AR-GE günü'],
    ['AM', '{Es} maaş'], ['AN', 'Net sakatlık indirimi'],
    ['AV', 'Mesai ({es})'], ['ayni', '{Es} ayni yardım', 'g'], ['AZ', 'Toplam ek ödeme ({es})'],
    ['_', 'Ücret'],
    ['BB', 'Brüt ücret', 0, 1], ['BC', 'SGK işçi'], ['BD', 'İşsizlik işçi'], ['BE', 'GV matrahı'],
    ['BF', 'Devreden kümülatif matrah'], ['BJ', 'Gelir vergisi oranı', 'o'], ['BK', 'Gelir vergisi'], ['BL', 'Damga vergisi'],
    ['_', 'Mesai / Ayni / Ek Ödeme'],
    ['BM', 'Brüt mesai'], ['BV', 'Mesai GV'], ['BX', 'Brüt ayni yardım'], ['CD', 'Ayni GV'],
    ['CF', 'Brüt ek ödeme'], ['CO', 'Ek ödeme GV'], ['CQ', 'Brüt ek ödeme-2 (yakıt)'],
    ['CK', 'Kümülatif GV matrahı'],
    ['_', 'Toplamlar'],
    ['CV', 'Brüt toplam', 0, 1], ['CW', 'SGK işçi toplam'], ['CX', 'İşsizlik işçi toplam'],
    ['CY', 'Gelir vergisi toplam'], ['DA', 'Damga vergisi toplam'], ['DC', 'BES kesintisi'],
    ['DD', 'Net ödeme', 0, 1],
    ['_', 'İşveren'],
    ['DE', 'SGK işveren'], ['DF', 'İşsizlik işveren'],
    ['DG', '05510 teşviki'], ['DH', '14857 engelli teşviki'], ['DI', '15510 teşviki'], ['DJ', '05746 AR-GE SGK teşviki'],
    ['DK', 'AR-GE GV teşviki'], ['DL', 'AR-GE DV teşviki'], ['CZ', 'Ödenecek GV'], ['DB', 'Ödenecek DV'],
    ['DM', 'TOPLAM MALİYET', 0, 1],
  ];

  function dokumAc(c, s) {
    const etiket = t => t.replace('{Es}', B.esasBas(c)).replace('{es}', B.esas(c));
    const hucre = (m, sat) => {
      const r = s.yil.aylar[m], g = s.girdi[m];
      if (sat[2] === 'g') { const v = g[sat[0]]; return `<td class="num kucuk">${U.esc(v == null || v === 0 ? '' : v)}</td>`; }
      if (sat[2] === 'o') return `<td class="num">${r[sat[0]] ? B.oran(r[sat[0]]) : ''}</td>`;
      if (sat[0] === 'AR' || sat[0] === 'AP') return `<td class="num">${r[sat[0]] || ''}</td>`;
      return `<td class="num${sat[3] ? ' kalin' : ''}">${B.tl(r[sat[0]], 2)}</td>`;
    };
    const topla = sat => {
      if (sat[2] || sat[0] === 'AR' || sat[0] === 'AP' || sat[0] === 'BF' || sat[0] === 'CK' || sat[0] === 'BE') return '<td></td>';
      let t = 0; for (let m = 1; m <= 12; m++) t += s.yil.aylar[m][sat[0]] || 0;
      return `<td class="num kalin">${B.tl(t, 2)}</td>`;
    };
    C.kipAc({
      baslik: s.kp.ad_soyad + ' — Bordro Dökümü',
      altBaslik: `${c.yil} · ${API.bolumEtiket(c.grup_kod, s.kp.butce_bolumu)} · Zamlı maaş ${B.tlDuz(s.zam.yeni)} (${B.esas(c)}) · Yıllık maliyet ${B.tlDuz(s.yil.maliyet)}`,
      genislik: 'genis',
      govde: `<div class="tablo-sar"><table class="genis-tablo">
        <thead><tr><th>Kalem</th>${U.AYLAR.map(a => `<th class="num">${a.slice(0, 3)}</th>`).join('')}<th class="num">Yıl</th></tr></thead>
        <tbody>${DOKUM.map(sat => sat[0] === '_'
          ? `<tr><td colspan="14" class="kalin" style="background:var(--accent-soft)">${U.esc(sat[1])}</td></tr>`
          : `<tr><td${sat[3] ? ' class="kalin"' : ''}>${U.esc(etiket(sat[1]))}</td>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => hucre(m, sat)).join('')}${topla(sat)}</tr>`).join('')}
        </tbody></table></div>`,
      altlik: '<button class="btn btn-ikincil" data-kip-kapat>Kapat</button>',
    });
  }

  APP.modulKaydet({
    id: 'maliyet', ad: 'Maliyet Tablosu', ikon: '🧮', grup: 'Bütçe',
    baslik: 'Maliyet Tablosu', altBaslik: 'Kişi × ay; bordro dökümü',
    yetki: 'ozet.oku', calismaGerekli: true, tumuDestek: true, ciz: ciz,
  });

  window.MALIYET = { dokumAc: dokumAc };
})();
