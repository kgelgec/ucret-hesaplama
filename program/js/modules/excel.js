/* =====================================================================
   EXCEL — yönetime giden rapor ve geri dönen dosyanın içeri alınması

   Çıktı (3 sayfa):
     ÖZET            yaka ve bütçe bölümü toplamları
     ZAM ÇALIŞMASI   kişi bazında zam; DÜZELTME sütunu (sarı) yönetimin
                     müdahale alanıdır. Zam miktarı / yeni maaş / oran
                     formüldür, Excel'de anında güncellenir.
     AYLIK MALİYET   kişi × ay toplam maliyet
   Maaş tutarları çalışmanın ücret esasındadır (net / brüt); açıklama satırı
   ve maaş sütun başlıkları esası yazar (net esasta başlıklar eskisi gibi).
   İçeri alma: ZAM ÇALIŞMASI sayfası başlık adlarıyla okunur, kişiler
   T.C. ile eşleştirilir. Öncelik: elle yazılmış ZAM ORANI → elle yazılmış
   ZAM MİKTARI → DÜZELTME. Önizleme gösterilmeden hiçbir şey yazılmaz.
   ===================================================================== */
(function () {
  'use strict';

  const LACIVERT = 'FF1F4E79', SARI = 'FFFFF2CC', GRI = 'FFF2F2F2', ACIK = 'FFDDEBF7';
  const SAYI = '#,##0;[Red]-#,##0', ORAN = '0.00%';
  const ZAM_SAYFA = 'ZAM ÇALIŞMASI';
  const MASKELI_TC = 'Bu dosyadaki T.C. numaraları maskeli (dosya, T.C. Kimlik No\'yu tam görme yetkisi olmayan bir kullanıcı ' +
    'tarafından alınmış). Kişiler T.C. ile eşleştirildiği için içeri alınamaz; dosyayı bu yetkiye sahip bir kullanıcıya aldırın.';
  const B_TC = 'T.C. KİMLİK NO', B_DUZ = 'DÜZELTME', B_MIK = 'ZAM MİKTARI', B_ORAN = 'ZAM ORANI',
        B_ONG = 'ÖNGÖRÜLEN ZAM';

  let onizleme = null;

  function ciz(kap) {
    const c = APP.calisma();
    const yaz = API.calismaYazilabilir(c) && API.yetkiVar('zam.yaz');
    kap.innerHTML = `
      <div class="kart">
        <div class="kart-baslik"><div><h2>Excel Raporu</h2>
          <div class="kart-aciklama">${c.yil} · ${U.esc(c.grup_adi)} · ${U.esc(c.ad)}. Tutarlar ${B.esas(c)} maaştır.</div></div>
          <button class="btn" id="aktarBtn">Excel'e Aktar</button></div>
        <ul class="kucuk">
          <li><strong>ZAM ÇALIŞMASI</strong> sayfasında sarı <strong>DÜZELTME</strong> sütunu yönetimin yazacağı yerdir;
            zam miktarı, ${c.yil} maaşı ve zam oranı Excel'de anında güncellenir.</li>
          <li>Yönetim isterse zam miktarını ya da oranını doğrudan da yazabilir; program içeri alırken bunu tanır.</li>
          <li>Maliyet sütunları programın hesabıdır; düzeltmeler içeri alınınca yeniden hesaplanır.</li>
          <li>T.C. sütununu silmeyin, satırların eşleşmesi buna göre yapılır.</li>
        </ul>
      </div>
      ${yaz ? `<div class="kart">
        <div class="kart-baslik"><div><h2>Yönetimden Dönen Excel'i İçeri Al</h2>
          <div class="kart-aciklama">Önce değişiklikler listelenir; onaylamadan hiçbir şey yazılmaz.</div></div>
          <label class="btn btn-ikincil">Dosya seç…<input type="file" id="iceDosya" accept=".xlsx" class="gizli"></label></div>
        <div id="onizleme">${onizleme && onizleme.calismaId === c.id ? onizlemeHtml(onizleme) : ''}</div>
      </div>` : ''}`;

    U.el('aktarBtn').onclick = () => aktar(c).catch(e => { console.error(e); U.bildir('Excel oluşturulamadı: ' + e.message, 'hata'); });
    const d = U.el('iceDosya');
    if (d) d.onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { onizleme = await oku(c, f); APP.tazele(); }
      catch (err) { console.error(err); U.bildir(err.message, 'hata'); }
    };
    const ub = U.el('uygulaBtn');
    if (ub) ub.onclick = () => {
      try {
        API.topluIslem(() => onizleme.degisen.forEach(x => API.calismaPersonelAlanYaz(c.id, x.tc, 'duzeltme', x.yeniDuz)));
        API.log('ICE_AKTAR', 'calisma_personel', c.id, onizleme.dosya + ': ' + onizleme.degisen.length + ' düzeltme');
        U.bildir(onizleme.degisen.length + ' kişinin düzeltmesi güncellendi.', 'basari');
        onizleme = null; APP.git('personel');
      } catch (err) { U.bildir(err.message, 'hata'); }
    };
    const vb = U.el('vazgecBtn'); if (vb) vb.onclick = () => { onizleme = null; APP.tazele(); };
  }

  /* ------------------------------------------------------------------
     ÇIKTI
     ------------------------------------------------------------------ */
  function baslikBicim(r) {
    r.eachCell(h => {
      h.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LACIVERT } };
      h.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      h.border = { bottom: { style: 'thin', color: { argb: 'FF9AA8BC' } } };
    });
    r.height = 34;
  }
  function toplamBicim(r) {
    r.eachCell(h => {
      h.font = { bold: true };
      h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACIK } };
      h.border = { top: { style: 'thin' } };
    });
  }
  function kol(n) { let s = ''; while (n > 0) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); } return s; }

  async function aktar(c, secenek) {
    secenek = secenek || {};
    if (!window.ExcelJS) throw new Error('Excel kütüphanesi yüklenemedi.');
    API.yetkiIste('excel.aktar');
    const h = API.calismaHesapla(c.id);
    const oz = API.calismaOzetOku(c.id);
    const Y = c.yil, O = c.yil - 1;
    const ES = B.esasBuyuk(c), brut = ES === 'BRÜT';
    const kitap = new ExcelJS.Workbook();
    kitap.creator = 'Ücret Hesaplama';
    kitap.created = new Date();
    // Formüller açılışta Excel tarafından yeniden hesaplansın
    kitap.calcProperties = { fullCalcOnLoad: true };
    // Sayfa sırası oluşturma sırasıdır: önce ÖZET (sonra doldurulur)
    const o = kitap.addWorksheet('ÖZET');

    /* ---------- ZAM ÇALIŞMASI (önce kurulur; ÖZET buna formülle bakar) ---------- */
    const z = kitap.addWorksheet(ZAM_SAYFA, { views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }] });
    const K = [
      { b: 'SIRA', g: 6 }, { b: 'BÜTÇE BÖLÜMÜ', g: 30 }, { b: 'ADI SOYADI', g: 28 }, { b: 'M / B', g: 6 },
      { b: 'İŞE GİRİŞ', g: 11 }, { b: 'HESAPLAMA', g: 10 },
    ];
    K.push({ b: O + ' MAAŞ' + (brut ? ' (BRÜT)' : ''), g: 13, s: SAYI, a: 'eski' });
    K.push({ b: 'ÖNGÖRÜ ORANI', g: 10, s: ORAN, a: 'ongOran' });
    K.push({ b: B_ONG, g: 12, s: SAYI, a: 'ong' });
    K.push({ b: B_DUZ, g: 12, s: SAYI, a: 'duz', sari: 1 });
    K.push({ b: Y + ' ' + B_MIK, g: 13, s: SAYI, a: 'mik' });
    K.push({ b: Y + ' MAAŞ' + (brut ? ' (BRÜT)' : ''), g: 13, s: SAYI, a: 'yeni' });
    K.push({ b: B_ORAN, g: 10, s: ORAN, a: 'oran' });
    K.push({ b: Y + ' TOPLAM MALİYET', g: 15, s: SAYI, a: 'mal' });
    K.push({ b: O + ' TOPLAM MALİYET', g: 15, s: SAYI, a: 'malO' });
    K.push({ b: 'MALİYET FARKI', g: 14, s: SAYI, a: 'fark' });
    K.push({ b: B_TC, g: 13, a: 'tc' });
    const idx = {}; K.forEach((k, i) => { if (k.a) idx[k.a] = i + 1; });
    const L = a => kol(idx[a]);

    z.getCell('A1').value = `${Y} ${c.grup_adi.toLocaleUpperCase('tr-TR')} ZAM ÇALIŞMASI`;
    z.getCell('A1').font = { bold: true, size: 14, color: { argb: LACIVERT } };
    z.getCell('A2').value = `${c.ad} · Tutarlar ${ES} · Oluşturma: ${new Date().toLocaleString('tr-TR')}`;
    z.getCell('A2').font = { italic: true, size: 9, color: { argb: 'FF666666' } };
    z.getCell('A3').value = 'Sarı DÜZELTME sütununa müdahalenizi yazın (öngörülen zamma eklenir, eksi olabilir). ' +
                            'Maliyet sütunları, dosya programa geri yüklendiğinde yeniden hesaplanır.';
    z.getCell('A3').font = { size: 9, color: { argb: 'FF7A5210' } };
    z.addRow([]);
    z.getRow(4).values = K.map(k => k.b);
    baslikBicim(z.getRow(4));
    K.forEach((k, i) => { z.getColumn(i + 1).width = k.g; });

    const ilk = 5;
    h.kisiler.forEach((s, i) => {
      const k = s.kp, r = ilk + i;
      const v = [k.sira || i + 1, API.bolumEtiket(c.grup_kod, k.butce_bolumu), k.ad_soyad, k.yaka,
                 k.ise_giris ? new Date(k.ise_giris + 'T00:00:00Z') : null, k.hesap_turu || ''];
      v.push(s.zam.eski);
      v.push(s.zam.oranOngoru);
      v.push(s.zam.ongoru);
      v.push(k.duzeltme || 0);
      v.push({ formula: `${L('ong')}${r}+${L('duz')}${r}`, result: s.zam.miktar });
      v.push({ formula: `${L('eski')}${r}+${L('mik')}${r}`, result: s.zam.yeni });
      v.push({ formula: `IF(${L('eski')}${r}=0,0,${L('mik')}${r}/${L('eski')}${r})`, result: s.zam.oran });
      v.push(s.yil.maliyet);
      v.push(k.maliyet_onceki || 0);
      v.push({ formula: `${L('mal')}${r}-${L('malO')}${r}`, result: s.yil.maliyet - (k.maliyet_onceki || 0) });
      /* T.C. yalnız "T.C. tam görür" yetkisiyle tam yazılır; maskeli dosya içeri alınamaz (eşleşme T.C. ile) */
      v.push(API.yetkiVar('alan.tc') ? k.tc_kimlik_no : U.tcMaskele(k.tc_kimlik_no));
      const row = z.getRow(r);
      row.values = v;
      K.forEach((kk, j) => {
        const h_ = row.getCell(j + 1);
        if (kk.s) h_.numFmt = kk.s;
        if (kk.sari) { h_.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SARI } }; h_.font = { bold: true }; }
        if (kk.a === 'tc') h_.font = { color: { argb: 'FF999999' }, size: 9 };
      });
      row.getCell(5).numFmt = 'dd.mm.yyyy';
    });
    const son = ilk + h.kisiler.length - 1, tRow = son + 1;
    const tv = K.map(() => null);
    tv[2] = 'TOPLAM';
    ['eski', 'ong', 'duz', 'mik', 'yeni', 'mal', 'malO', 'fark'].forEach(a => {
      if (idx[a]) tv[idx[a] - 1] = { formula: `SUBTOTAL(9,${L(a)}${ilk}:${L(a)}${son})` };
    });
    tv[idx.oran - 1] = { formula: `IF(${L('eski')}${tRow}=0,0,${L('mik')}${tRow}/${L('eski')}${tRow})` };
    z.getRow(tRow).values = tv;
    toplamBicim(z.getRow(tRow));
    K.forEach((kk, j) => { if (kk.s) z.getRow(tRow).getCell(j + 1).numFmt = kk.s; });
    z.autoFilter = { from: { row: 4, column: 1 }, to: { row: son, column: K.length } };

    /* ---------- ÖZET ---------- */
    o.getColumn(1).width = 34; for (let i = 2; i <= 9; i++) o.getColumn(i).width = 17;
    o.getCell('A1').value = `${Y} ${c.grup_adi.toLocaleUpperCase('tr-TR')} — MALİYET ÖZETİ`;
    o.getCell('A1').font = { bold: true, size: 14, color: { argb: LACIVERT } };
    o.getCell('A2').value = c.ad + ' · ' + h.kisiler.length + ' kişi' + (brut ? ' · Maaşlar BRÜT' : '');
    o.getCell('A2').font = { italic: true, size: 9, color: { argb: 'FF666666' } };
    o.getRow(4).values = ['', 'KİŞİ', O + ' TOPLAM MALİYET', Y + ' BÜTÇELENEN MALİYET', Y + ' TOPLAM MALİYET',
                          'BÜTÇE FARKI', 'ZAM MİKTARI', 'ZAM ORANI', 'ORTALAMA ZAM'];
    baslikBicim(o.getRow(4));
    const zr = `'${ZAM_SAYFA}'!`;
    const ar = (a) => `${zr}$${L(a)}$${ilk}:$${L(a)}$${son}`;
    const yr = `${zr}$D$${ilk}:$D$${son}`;
    [['BEYAZ YAKA', 'B'], ['MAVİ YAKA', 'M']].forEach((y, i) => {
      const r = 5 + i;
      o.getRow(r).values = [y[0],
        { formula: `COUNTIF(${yr},"${y[1]}")` },
        oz['onceki_' + y[1]] == null ? null : Number(oz['onceki_' + y[1]]),
        oz['butce_' + y[1]] == null ? null : Number(oz['butce_' + y[1]]),
        { formula: `SUMIF(${yr},"${y[1]}",${ar('mal')})` },
        { formula: `IF(D${r}="","",E${r}-D${r})` },
        { formula: `SUMIF(${yr},"${y[1]}",${ar('mik')})` },
        { formula: `IFERROR(G${r}/SUMIF(${yr},"${y[1]}",${ar('eski')}),0)` },
        { formula: `IFERROR(G${r}/B${r},0)` }];
    });
    o.getRow(7).values = ['TOPLAM', { formula: 'SUM(B5:B6)' }, { formula: 'SUM(C5:C6)' }, { formula: 'SUM(D5:D6)' },
      { formula: 'SUM(E5:E6)' }, { formula: 'E7-D7' }, { formula: 'SUM(G5:G6)' },
      { formula: `IFERROR(G7/SUM(${ar('eski')}),0)` }, { formula: 'IFERROR(G7/B7,0)' }];
    toplamBicim(o.getRow(7));
    for (let r = 5; r <= 7; r++) {
      [3, 4, 5, 6, 7, 9].forEach(cc => { o.getRow(r).getCell(cc).numFmt = SAYI; });
      o.getRow(r).getCell(8).numFmt = ORAN;
      o.getRow(r).getCell(1).font = { bold: true };
    }
    o.getCell('A8').value = 'Zam miktarı ve oranı ZAM ÇALIŞMASI sayfasındaki düzeltmelerle anında değişir; maliyet program tarafından yeniden hesaplanır.';
    o.getCell('A8').font = { size: 9, italic: true, color: { argb: 'FF7A5210' } };

    // Bütçe bölümleri
    // A bölüm · B kişi · C önceki maaş · D zam · E oran · F yeni maaş · G önceki maliyet · H maliyet · I fark
    o.getRow(10).values = ['BÜTÇE BÖLÜMÜ', 'KİŞİ', O + ' MAAŞ (' + ES + ')', 'ZAM MİKTARI', 'ZAM ORANI', Y + ' MAAŞ (' + ES + ')',
                           O + ' MALİYET', Y + ' MALİYET', 'FARK'];
    baslikBicim(o.getRow(10));
    const bolumler = [...new Set(h.kisiler.map(s => s.kp.butce_bolumu || ''))]
      .sort((a, b) => API.bolumSira(c.grup_kod, a) - API.bolumSira(c.grup_kod, b)).map(b => API.bolumEtiket(c.grup_kod, b));
    const br = `${zr}$B$${ilk}:$B$${son}`;
    bolumler.forEach((b, i) => {
      const r = 11 + i;
      o.getRow(r).values = [b, { formula: `COUNTIF(${br},A${r})` }, { formula: `SUMIF(${br},A${r},${ar('eski')})` },
        { formula: `SUMIF(${br},A${r},${ar('mik')})` }, { formula: `IFERROR(D${r}/C${r},0)` }, { formula: `C${r}+D${r}` },
        { formula: `SUMIF(${br},A${r},${ar('malO')})` }, { formula: `SUMIF(${br},A${r},${ar('mal')})` }, { formula: `H${r}-G${r}` }];
      [3, 4, 6, 7, 8, 9].forEach(cc => { o.getRow(r).getCell(cc).numFmt = SAYI; });
      o.getRow(r).getCell(5).numFmt = ORAN;
    });
    const bt = 11 + bolumler.length;
    o.getRow(bt).values = ['TOPLAM', { formula: `SUM(B11:B${bt - 1})` }, { formula: `SUM(C11:C${bt - 1})` },
      { formula: `SUM(D11:D${bt - 1})` }, { formula: `IFERROR(D${bt}/C${bt},0)` }, { formula: `C${bt}+D${bt}` },
      { formula: `SUM(G11:G${bt - 1})` }, { formula: `SUM(H11:H${bt - 1})` }, { formula: `H${bt}-G${bt}` }];
    toplamBicim(o.getRow(bt));
    [3, 4, 6, 7, 8, 9].forEach(cc => { o.getRow(bt).getCell(cc).numFmt = SAYI; });
    o.getRow(bt).getCell(5).numFmt = ORAN;

    /* ---------- AYLIK MALİYET ---------- */
    const a = kitap.addWorksheet('AYLIK MALİYET', { views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }] });
    a.getRow(1).values = ['BÜTÇE BÖLÜMÜ', 'ADI SOYADI'].concat(U.AYLAR_BUYUK).concat(['TOPLAM']);
    baslikBicim(a.getRow(1));
    a.getColumn(1).width = 30; a.getColumn(2).width = 28;
    for (let i = 3; i <= 15; i++) a.getColumn(i).width = 13;
    h.kisiler.forEach((s, i) => {
      const r = 2 + i;
      const v = [API.bolumEtiket(c.grup_kod, s.kp.butce_bolumu), s.kp.ad_soyad];
      for (let m = 1; m <= 12; m++) v.push(s.yil.aylar[m].DM);
      v.push({ formula: `SUM(C${r}:N${r})`, result: s.yil.maliyet });
      a.getRow(r).values = v;
      for (let cc = 3; cc <= 15; cc++) a.getRow(r).getCell(cc).numFmt = SAYI;
    });
    const at = 2 + h.kisiler.length;
    const tvA = ['', 'TOPLAM'];
    for (let cc = 3; cc <= 15; cc++) tvA.push({ formula: `SUM(${kol(cc)}2:${kol(cc)}${at - 1})` });
    a.getRow(at).values = tvA;
    toplamBicim(a.getRow(at));
    for (let cc = 3; cc <= 15; cc++) a.getRow(at).getCell(cc).numFmt = SAYI;

    kitap.views = [{ activeTab: 0 }];

    const buf = await kitap.xlsx.writeBuffer();
    if (secenek.sadeceIcerik) return buf;           // test ve önizleme için
    const dosya = `${Y} ${c.grup_adi} Zam Çalışması ${new Date().toISOString().slice(0, 10)}.xlsx`;
    U.indir(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), dosya);
    API.log('DISA_AKTAR', 'calisma', c.id, dosya);
  }

  /* ------------------------------------------------------------------
     İÇERİ ALMA
     ------------------------------------------------------------------ */
  function hucre(v) {
    // { formul: bool, deger: number|string|null }
    if (v == null) return { formul: false, deger: null };
    if (typeof v === 'object') {
      if (v.formula || v.sharedFormula) return { formul: true, deger: v.result == null ? null : v.result };
      if (v.richText) return { formul: false, deger: v.richText.map(t => t.text).join('') };
      if (v instanceof Date) return { formul: false, deger: v };
      if ('result' in v) return { formul: true, deger: v.result };
    }
    return { formul: false, deger: v };
  }
  const sayiMi = x => typeof x === 'number' && isFinite(x);
  const norm = s => U.normalize(String(s || '')).replace(/\s+/g, ' ').trim();

  async function oku(c, dosya) {
    if (!window.ExcelJS) throw new Error('Excel kütüphanesi yüklenemedi.');
    const kitap = new ExcelJS.Workbook();
    await kitap.xlsx.load(await dosya.arrayBuffer());
    const s = kitap.worksheets.find(w => norm(w.name) === norm(ZAM_SAYFA));
    if (!s) throw new Error(`Dosyada "${ZAM_SAYFA}" sayfası yok. Programdan alınmış bir rapor seçin.`);

    // Başlık satırını ve sütunları ada göre bul
    let basSatir = 0; const sut = {};
    s.eachRow((row, rn) => {
      if (basSatir) return;
      const adlar = row.values.map(x => norm(hucre(x).deger));
      if (adlar.some(a => a === norm(B_DUZ)) && adlar.some(a => a === norm(B_TC))) {
        basSatir = rn;
        adlar.forEach((a, i) => {
          if (a === norm(B_TC)) sut.tc = i;
          else if (a === norm(B_DUZ)) sut.duz = i;
          else if (a.endsWith(norm(B_MIK))) sut.mik = i;
          else if (a === norm(B_ORAN)) sut.oran = i;
          else if (a === norm(B_ONG)) sut.ong = i;
          else if (a === norm('ADI SOYADI')) sut.ad = i;
        });
      }
    });
    if (!basSatir || !sut.tc || !sut.duz) throw new Error('Başlık satırı bulunamadı (T.C. KİMLİK NO ve DÜZELTME sütunları gerekli).');

    const h = API.calismaHesapla(c.id);
    const bul = {}; h.kisiler.forEach(k => { bul[k.kp.tc_kimlik_no] = k; });
    const degisen = [], bulunamayan = [], uyari = [];
    let okunan = 0, maskeli = 0;
    s.eachRow((row, rn) => {
      if (rn <= basSatir) return;
      const tcHam = String(hucre(row.getCell(sut.tc).value).deger || '').trim();
      if (/^\d{3}\*+\d{3}$/.test(tcHam)) { maskeli++; return; }   // maskeli T.C. eşleşmez
      const tc = tcHam.replace(/\D/g, '');
      if (tc.length !== 11) return;       // toplam satırı vb.
      okunan++;
      const k = bul[tc];
      if (!k) { bulunamayan.push({ tc: tc, ad: sut.ad ? hucre(row.getCell(sut.ad).value).deger : '' }); return; }
      const duz = hucre(row.getCell(sut.duz).value);
      const mik = sut.mik ? hucre(row.getCell(sut.mik).value) : { formul: true };
      const oran = sut.oran ? hucre(row.getCell(sut.oran).value) : { formul: true };
      const ong = k.zam.ongoru, eski = k.zam.eski;
      let yeni, kaynak;
      if (!oran.formul && sayiMi(oran.deger)) {
        yeni = Math.round(oran.deger * eski) - ong; kaynak = 'oran %' + (oran.deger * 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
      } else if (!mik.formul && sayiMi(mik.deger)) {
        yeni = Math.round(mik.deger) - ong; kaynak = 'zam miktarı';
      } else {
        yeni = sayiMi(duz.deger) ? duz.deger : 0; kaynak = 'düzeltme';
      }
      if (sut.ong) {
        const eo = hucre(row.getCell(sut.ong).value).deger;
        if (sayiMi(eo) && Math.abs(eo - ong) > 0.5)
          uyari.push(`${k.kp.ad_soyad}: dosyadaki öngörü (${B.tlDuz(eo)}) programdakinden (${B.tlDuz(ong)}) farklı — parametreler değişmiş olabilir.`);
      }
      const eskiDuz = k.kp.duzeltme || 0;
      if (Math.abs(yeni - eskiDuz) > 0.004) {
        degisen.push({ tc: tc, ad: k.kp.ad_soyad, bolum: API.bolumEtiket(c.grup_kod, k.kp.butce_bolumu), eskiDuz: eskiDuz, yeniDuz: yeni, kaynak: kaynak,
                       eskiZam: k.zam.miktar, yeniZam: ong + yeni, eskiMaas: eski });
      }
    });
    if (maskeli && !okunan) throw new Error(MASKELI_TC);
    return { calismaId: c.id, dosya: dosya.name, okunan: okunan, degisen: degisen, bulunamayan: bulunamayan, uyari: uyari };
  }

  function onizlemeHtml(o) {
    return `
      <div class="uyari ${o.degisen.length ? 'uyari-bilgi' : 'uyari-basari'}"><span class="ik">ℹ</span>
        <div><strong>${U.esc(o.dosya)}</strong>: ${o.okunan} kişi okundu, <strong>${o.degisen.length}</strong> kişide değişiklik var.
          ${o.bulunamayan.length ? `<br>${o.bulunamayan.length} T.C. bu çalışmada yok: ${o.bulunamayan.map(b => U.esc(b.ad || b.tc)).join(', ')}` : ''}</div></div>
      ${o.uyari.length ? `<div class="uyari uyari-dikkat"><span class="ik">⚠</span><div>${o.uyari.slice(0, 10).map(U.esc).join('<br>')}</div></div>` : ''}
      ${o.degisen.length ? `${C.tablo([
          { baslik: 'Ad Soyad', alan: 'ad' }, { baslik: 'Bölüm', deger: x => `<span class="kucuk">${U.esc(x.bolum || '')}</span>` },
          { baslik: 'Kaynak', deger: x => `<span class="kucuk soluk">${U.esc(x.kaynak)}</span>` },
          { baslik: 'Düzeltme (eski → yeni)', sinif: 'num', deger: x => B.tlDuz(x.eskiDuz) + ' → <strong>' + B.tlDuz(x.yeniDuz) + '</strong>' },
          { baslik: 'Zam (eski → yeni)', sinif: 'num', deger: x => B.tlDuz(x.eskiZam) + ' → <strong>' + B.tlDuz(x.yeniZam) + '</strong>' },
          { baslik: 'Yeni oran', sinif: 'num', deger: x => B.oran(x.eskiMaas ? x.yeniZam / x.eskiMaas : 0) },
        ], o.degisen)}
        <div class="btn-satir ust-bosluk"><button class="btn" id="uygulaBtn">${o.degisen.length} Değişikliği Uygula</button>
          <button class="btn btn-ikincil" id="vazgecBtn">Vazgeç</button></div>` : '<button class="btn btn-ikincil ust-bosluk" id="vazgecBtn">Kapat</button>'}`;
  }

  window.EXCEL_RAPOR = { aktar: aktar, oku: oku };

  APP.modulKaydet({
    id: 'excel', ad: 'Excel Raporu', ikon: '📤', grup: 'İçe / Dışa Aktarma',
    baslik: 'Excel Raporu', altBaslik: 'Bütçeyi Excel olarak alın; yönetimin düzeltmelerini dosyadan geri yükleyin',
    yetki: 'excel.aktar', calismaGerekli: true, ciz: ciz,
  });
})();
