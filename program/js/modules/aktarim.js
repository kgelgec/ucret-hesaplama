/* =====================================================================
   PERSONEL İÇE AKTARMA — Excel / CSV listesindeki ya da ERP / bordro programındaki gerçek maaşları ve
   personel bilgisini çalışmaya alır

   Yeni yıl çalışmasına başlanırken ERP ya da bordro programındaki güncel
   (gerçekleşen) net maaşlar bu çalışmanın "önceki yıl maaşı" olur; zam
   öngörüsü bunların üzerine uygulanır. Önceki yılın gerçekleşen maliyeti
   de karşılaştırma için buradan gelebilir.

   Liste, programdan alınan rapor dosyası (.xlsx / .csv) ya da kopyala-
   yapıştır ile verilir. Doğrudan veritabanı bağlantısı kurulursa yalnız
   kaynak değişir; önizleme ve uygulama (API.erpAktar) adımları aynı kalır.
   ===================================================================== */
(function () {
  'use strict';

  /* Sütun başlığı sözlüğü (alan → olası başlıklar) ve alan adları API'den gelir; kullanıcı
     Tanımlar → İçe Aktarma Başlıkları'ndan değiştirebilir. */
  const sozluk = () => API.aktarimSozluk();

  let durum = null;   // { calismaId, kaynak, sutun, satirlar, onizleme }

  function ciz(kap) {
    const c = APP.calisma();
    if (!API.calismaYazilabilir(c) || !API.yetkiVar('personel.yaz')) {
      kap.innerHTML = '<div class="uyari uyari-dikkat"><span class="ik">ℹ</span><div>Bu grupta aktarım yetkiniz yok ya da çalışma onaylı (kilitli).</div></div>';
      return;
    }
    if (durum && durum.calismaId !== c.id) durum = null;

    kap.innerHTML = `
      <div class="kart">
        <div class="kart-baslik"><div><h2>Personel İçe Aktarma — ${c.yil} · ${U.esc(c.grup_adi)}</h2>
          <div class="kart-aciklama">Elinizdeki personel listesini (Excel, CSV ya da ERP / bordro programı çıktısı) bu bütçeye alın.
            Listedeki net maaşlar bu çalışmanın <strong>${c.yil - 1} maaşı</strong> olur; zam öngörüsü bunun üzerine uygulanır.
            Sütunlar başlık adından tanınır, sıra önemli değildir.</div></div></div>
        <ol class="adimlar">
          <li><strong>Listenizi hazırlayın.</strong> Kendi dosyanızı kullanabilir ya da örnek şablonu indirip doldurabilirsiniz.
            <button class="btn btn-ikincil btn-kucuk" id="sablonBtn">⇩ Örnek Excel şablonunu indir</button></li>
          <li><strong>Dosyayı seçin</strong> ya da tabloyu yapıştırın.</li>
          <li><strong>Önizlemeyi kontrol edin</strong>, eklenecek yeni kişileri işaretleyin ve <em>Aktarımı Uygula</em> deyin.</li>
        </ol>
        <div class="izgara izgara-2">
          <div>
            <div class="alan"><label for="dosya">Personel listesi (.xlsx / .csv)</label><input type="file" id="dosya" accept=".xlsx,.csv,.txt"></div>
            <div class="kucuk soluk">Tanınan başlıklar: ${(E => Object.keys(E).map(k => E[k]).join(', '))(sozluk().etiket)}
              (sütun adları Tanımlar → İçe Aktarma Başlıkları'ndan değiştirilebilir).
              Yalnızca T.C. zorunludur; boş sütunlar mevcut bilgiye dokunmaz.</div>
          </div>
          <div class="alan"><label>…ya da Excel'den kopyalayıp yapıştırın (başlık satırıyla birlikte)</label>
            <textarea id="yapistir" rows="4" placeholder="TC&#9;Ad Soyad&#9;Net Maaş…"></textarea>
            <button class="btn btn-ikincil btn-kucuk ust-bosluk" id="yapistirBtn">Yapıştırılanı oku</button></div>
        </div>
        <div id="sonuc">${durum ? onizlemeHtml(c) : ''}</div>
      </div>`;

    U.el('sablonBtn').onclick = () => sablonIndir(c).catch(err => U.bildir(err.message, 'hata'));
    U.el('dosya').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { oku(c, await TO.dosyaSatirlar(f), f.name); } catch (err) { U.bildir(err.message, 'hata'); }
    };
    U.el('yapistirBtn').onclick = () => {
      try { oku(c, TO.metinSatirlar(U.el('yapistir').value), 'yapıştırılan tablo'); } catch (err) { U.bildir(err.message, 'hata'); }
    };
    bagla(c);
  }

  /* ÖRNEK ŞABLON — ilk sayfa (PERSONEL) yalnız başlıklardır: okuyucu ilk sayfayı alır, şablon olduğu gibi
     yüklenirse kimse eklenmez. Başlıklar programın tanıdığı adlardır (İçe Aktarma Başlıkları değiştirildiyse
     geçerli sözlükten seçilir). İkinci sayfada sütun açıklamaları ve uydurma örnek satırlar durur. */
  const SABLON = [
    ['tc', 'T.C. Kimlik No', 16, 'Zorunlu. 11 hane.', '12345678901'],
    ['ad', 'Ad Soyad', 26, 'Yeni eklenecek kişide zorunlu.', 'ÖRNEK KİŞİ'],
    ['ise_giris', 'İşe Giriş Tarihi', 15, 'GG.AA.YYYY', '01.03.2019'],
    ['isten_ayrilis', 'Çıkış Tarihi', 15, 'GG.AA.YYYY; çalışıyorsa boş.', ''],
    ['bolum', 'Bölüm', 20, 'Kişinin bölümü / departmanı.', 'MUHASEBE'],
    ['gorev', 'Görev', 20, 'Unvan / pozisyon.', 'Uzman'],
    ['ekip', 'Ekip', 14, 'İsteğe bağlı.', ''],
    ['yaka', 'Yaka', 8, 'B = beyaz yaka, M = mavi yaka; boşsa beyaz.', 'B'],
    ['butce_bolumu', 'Bütçe Bölümü', 22, 'Tanımlar → Bütçe Bölümleri\'ndeki ad (numarasız da olur).', ''],
    ['maas', 'Net Maaş', 14, 'Önceki yılın aylık NET maaşı (TL).', '50000'],
    ['maliyet', 'Gerçekleşen Maliyet', 18, 'Önceki yılın yıllık işveren maliyeti (TL); isteğe bağlı, karşılaştırma için.', ''],
  ];
  async function sablonIndir(c) {
    const S = sozluk();
    /* Her başlık geçerli sözlükle tanınmalı; tanınmazsa sözlüğün ilk adayı kullanılır */
    const baslik = SABLON.map(x => {
      const e = TO.eslestir([[x[1]]], { [x[0]]: S.sozluk[x[0]] }, []);
      return e && e.sutun && e.sutun[x[0]] === 0 ? x[1] : (S.sozluk[x[0]] || [x[1]])[0];
    });
    const kitap = new ExcelJS.Workbook();
    const ws = kitap.addWorksheet('PERSONEL', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = SABLON.map((x, i) => ({ header: baslik[i], key: x[0], width: x[2] }));
    const bas = ws.getRow(1);
    bas.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    bas.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    bas.alignment = { vertical: 'middle' }; bas.height = 22;
    ws.getColumn('tc').numFmt = '@';
    ['ise_giris', 'isten_ayrilis'].forEach(k => { ws.getColumn(k).numFmt = 'dd.mm.yyyy'; });
    ['maas', 'maliyet'].forEach(k => { ws.getColumn(k).numFmt = '#,##0.00'; });
    for (let i = 2; i <= 1000; i++) {
      ws.getCell(i, SABLON.findIndex(x => x[0] === 'yaka') + 1).dataValidation =
        { type: 'list', allowBlank: true, formulae: ['"B,M"'], showErrorMessage: true, errorTitle: 'Yaka', error: 'B ya da M yazın.' };
    }
    const ac = kitap.addWorksheet('ÖRNEK VE AÇIKLAMA');
    ac.columns = [{ width: 22 }, { width: 70 }, { width: 18 }];
    ac.addRow(['Personel içe aktarma şablonu']).font = { bold: true, size: 13 };
    ac.addRow(['Doldurulacak sayfa: PERSONEL (ilk sayfa). Bu sayfa okunmaz; yalnız açıklama ve örnektir.']);
    ac.addRow(['Yalnız T.C. zorunludur; boş bırakılan sütun programdaki mevcut bilgiye dokunmaz. Sütun sırası önemli değildir.']);
    ac.addRow([]);
    const h = ac.addRow(['Sütun', 'Açıklama', 'Örnek']);
    h.font = { bold: true }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
    SABLON.forEach((x, i) => ac.addRow([baslik[i], x[3], x[4]]));
    const bolumler = API.butceBolumuListe(c.grup_kod).map(b => b.ad);
    if (bolumler.length) { ac.addRow([]); ac.addRow([c.grup_adi + ' grubunun bütçe bölümleri', bolumler.join(', ')]); }
    ac.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
    const buf = await kitap.xlsx.writeBuffer();
    U.indir(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
            'personel-sablonu-' + c.grup_adi.replace(/[\/:*?"<>|]/g, '').replace(/\s+/g, '-') + '-' + c.yil + '.xlsx');
  }

  function oku(c, ham, kaynak) {
    const e = TO.eslestir(ham, sozluk().sozluk, ['tc']);
    if (!e) throw new Error('Başlık satırında T.C. sütunu bulunamadı.');
    const s = e.sutun, al = (row, a) => s[a] == null ? null : row[s[a]];
    const satirlar = e.veri.map(row => ({
      tc: TO.tc(al(row, 'tc')), ad: al(row, 'ad') ? String(al(row, 'ad')).trim() : null,
      ise_giris: TO.tarih(al(row, 'ise_giris')), isten_ayrilis: TO.tarih(al(row, 'isten_ayrilis')),
      bolum: al(row, 'bolum') ? String(al(row, 'bolum')).trim() : null,
      ekip: al(row, 'ekip') ? String(al(row, 'ekip')).trim() : null,
      gorev: al(row, 'gorev') ? String(al(row, 'gorev')).trim() : null,
      maas: TO.sayi(al(row, 'maas')),
      yaka: al(row, 'yaka') ? String(al(row, 'yaka')).trim().toLocaleUpperCase('tr-TR').charAt(0) : null,
      butce_bolumu: al(row, 'butce_bolumu') ? String(al(row, 'butce_bolumu')).trim() : null,
      maliyet: TO.sayi(al(row, 'maliyet')),
    })).filter(r => r.tc.length === 11);
    if (!satirlar.length) throw new Error('Geçerli T.C. içeren satır bulunamadı.');
    durum = { calismaId: c.id, kaynak: kaynak, sutun: s, basliklar: e.basliklar, satirlar: satirlar, yeni: {} };
    APP.tazele();
  }

  function onizlemeHtml(c) {
    const mevcut = {};
    API.calismaPersonelListe(c.id).forEach(k => { mevcut[k.tc_kimlik_no] = k; });
    const baska = API.tcBaskaGrupta(c.yil, c.grup_kod, durum.satirlar.map(r => r.tc));
    const degisen = [], yeni = [], ayni = [];
    const dosyada = {};
    const ETIKET = sozluk().etiket;
    durum.satirlar.forEach(r => {
      dosyada[r.tc] = 1;
      const k = mevcut[r.tc];
      if (!k) { yeni.push(r); return; }
      const f = [];
      if (r.maas != null && Math.abs(r.maas - (k.maas_eski || 0)) > 0.004) f.push(['Net maaş', B.tlDuz(k.maas_eski, 2), B.tlDuz(r.maas, 2)]);
      if (r.maliyet != null && Math.abs(r.maliyet - (k.maliyet_onceki || 0)) > 0.004) f.push(['Maliyet', B.tlDuz(k.maliyet_onceki || 0), B.tlDuz(r.maliyet)]);
      if (r.ad && U.bicimAd(r.ad) !== k.ad_soyad) f.push(['Ad', k.ad_soyad, r.ad]);
      if (r.ise_giris && r.ise_giris !== k.ise_giris) f.push(['İşe giriş', U.tarihGoster(k.ise_giris), U.tarihGoster(r.ise_giris)]);
      if (r.isten_ayrilis && r.isten_ayrilis !== k.isten_ayrilis) f.push(['Çıkış', U.tarihGoster(k.isten_ayrilis) || '—', U.tarihGoster(r.isten_ayrilis)]);
      if (r.yaka && (r.yaka === 'M' || r.yaka === 'B') && r.yaka !== k.yaka) f.push(['Yaka', k.yaka, r.yaka]);
      ['bolum', 'gorev', 'ekip'].forEach(a => { if (r[a] && r[a] !== (k[a] || '')) f.push([ETIKET[a], k[a] || '—', r[a]]); });
      if (f.length) degisen.push({ r: r, k: k, f: f }); else ayni.push(r);
    });
    const eksik = Object.keys(mevcut).filter(tc => !dosyada[tc]).map(tc => mevcut[tc]);
    durum.onizleme = { degisen: degisen, yeni: yeni };

    return `
      <div class="ayrac"></div>
      <div class="uyari uyari-bilgi"><span class="ik">ℹ</span><div><strong>${U.esc(durum.kaynak)}</strong>: ${durum.satirlar.length} satır okundu.
        Tanınan sütunlar: ${Object.keys(durum.sutun).map(a => `<span class="rz rz-mavi">${sozluk().etiket[a]} ← ${U.esc(durum.basliklar[durum.sutun[a]])}</span>`).join(' ')}
        ${durum.sutun.maas == null ? '<br><strong>Net maaş sütunu tanınmadı</strong> — maaşlar güncellenmeyecek.' : ''}</div></div>
      <div class="izgara izgara-4 ust-bosluk">
        <div class="stat"><div class="kucuk soluk">Güncellenecek</div><div class="gosterge">${degisen.length}</div></div>
        <div class="stat"><div class="kucuk soluk">Değişiklik yok</div><div class="gosterge">${ayni.length}</div></div>
        <div class="stat"><div class="kucuk soluk">Çalışmada yok (yeni)</div><div class="gosterge">${yeni.length}</div></div>
        <div class="stat"><div class="kucuk soluk">Dosyada yok</div><div class="gosterge">${eksik.length}</div></div>
      </div>
      ${degisen.length ? `<h3>Güncellenecekler</h3>${C.tablo([
          { baslik: 'Ad Soyad', deger: x => U.esc(x.k.ad_soyad) },
          { baslik: 'Değişen', deger: x => x.f.map(f => `<span class="kucuk"><strong>${U.esc(f[0])}</strong>: ${U.esc(f[1] || '—')} → <strong>${U.esc(f[2])}</strong></span>`).join('<br>') },
        ], degisen)}` : ''}
      ${yeni.length ? `<h3 class="ust-bosluk">Bu çalışmada olmayanlar (${yeni.length})</h3>
        <div class="kucuk soluk">İşaretlediğiniz kişiler bu gruba eklenir (hesaplama türü SSK, yaka dosyadan ya da beyaz). Başka gruba ait
          personeli işaretlemeyin.</div>
        <label class="satir ust-bosluk"><input type="checkbox" id="yeniHepsi" ${yeni.length && yeni.every(x => durum.yeni[x.tc] || baska[x.tc]) ? 'checked' : ''}>
          Tümünü seç <span class="kucuk soluk">(bu yıl başka bir grupta kayıtlı olanlar hariç)</span></label>
        ${C.tablo([
          { baslik: '', deger: x => `<input type="checkbox" data-yeni="${x.tc}" ${durum.yeni[x.tc] ? 'checked' : ''}>` },
          { baslik: 'T.C.', sinif: 'mono', deger: x => B.tc(x.tc) }, { baslik: 'Ad Soyad', deger: x => U.esc(x.ad || '') },
          { baslik: 'Bölüm', deger: x => U.esc(x.bolum || '') }, { baslik: 'Net Maaş', sinif: 'num', deger: x => B.tl(x.maas) },
          { baslik: '', deger: x => baska[x.tc] ? '<span class="rz rz-sari">bu yıl başka bir grupta kayıtlı</span>' : '' },
        ], yeni)}` : ''}
      ${eksik.length ? `<h3 class="ust-bosluk">Çalışmada olup dosyada olmayanlar</h3>
        <div class="kucuk soluk">Bunlara dokunulmaz. Ayrıldılarsa kişi kartına çıkış tarihi girin.</div>
        <div class="kucuk">${eksik.map(k => U.esc(k.ad_soyad)).join(', ')}</div>` : ''}
      <div class="btn-satir ust-bosluk">
        <button class="btn" id="uygulaBtn" ${degisen.length || yeni.length ? '' : 'disabled'}>Aktarımı Uygula</button>
        <button class="btn btn-ikincil" id="vazgecBtn">Vazgeç</button></div>`;
  }

  function bagla(c) {
    const s = U.el('sonuc');
    if (!s) return;
    s.querySelectorAll('[data-yeni]').forEach(cb => cb.onchange = () => { durum.yeni[cb.getAttribute('data-yeni')] = cb.checked; });
    const hepsi = U.el('yeniHepsi');
    if (hepsi) hepsi.onchange = () => {
      const baska = API.tcBaskaGrupta(c.yil, c.grup_kod, durum.onizleme.yeni.map(x => x.tc));
      durum.onizleme.yeni.forEach(x => { durum.yeni[x.tc] = hepsi.checked && !baska[x.tc]; });
      s.querySelectorAll('[data-yeni]').forEach(cb => { cb.checked = !!durum.yeni[cb.getAttribute('data-yeni')]; });
    };
    const v = U.el('vazgecBtn'); if (v) v.onclick = () => { durum = null; APP.tazele(); };
    const u = U.el('uygulaBtn');
    if (u) u.onclick = async () => {
      const yeniSay = Object.keys(durum.yeni).filter(k => durum.yeni[k]).length;
      const ok = await C.onay({ baslik: 'Personel İçe Aktarma',
        mesaj: `${durum.onizleme.degisen.length} kişi güncellenecek${yeniSay ? `, ${yeniSay} kişi eklenecek` : ''}.`,
        detay: 'Net maaşlar bu çalışmanın önceki yıl maaşı olur; zam ve maliyet yeniden hesaplanır. Önce yedek almanız önerilir.',
        evetYazi: 'Uygula' });
      if (!ok) return;
      try {
        const r = API.erpAktar(c.id, durum.satirlar, durum.yeni);
        U.bildir(`${r.guncel} kişi güncellendi, ${r.eklenen} kişi eklendi.`, 'basari');
        durum = null; APP.git('personel');
      } catch (e) { U.bildir(e.message, 'hata'); }
    };
  }

  APP.modulKaydet({
    id: 'aktarim', ad: 'Personel İçe Aktarma', ikon: '⇩', grup: 'İçe / Dışa Aktarma',
    baslik: 'Personel İçe Aktarma', altBaslik: 'Personel listesini (Excel / CSV ya da ERP / bordro programı çıktısı) bütçeye alın',
    yetki: 'personel.yaz', calismaGerekli: true, ciz: ciz,
  });

  window.AKTARIM_TEST = { oku: (c, ham) => oku(c, ham, 'test') };
})();
