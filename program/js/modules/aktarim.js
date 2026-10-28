/* =====================================================================
   DIŞ LİSTE AKTARIMI — ERP / bordro programındaki gerçek maaşları ve
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
     Tanımlar → Aktarım Başlıkları'ndan değiştirebilir. */
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
        <div class="kart-baslik"><div><h2>Dış Liste Aktarımı — ${c.yil} · ${U.esc(c.grup_adi)}</h2>
          <div class="kart-aciklama">ERP ya da bordro programından alınan listedeki güncel net maaşlar bu çalışmanın
            <strong>${c.yil - 1} maaşı</strong> olur; zam öngörüsü bunun üzerine uygulanır. Sütunlar başlık adından tanınır,
            sıra önemli değildir.</div></div></div>
        <div class="izgara izgara-2">
          <div>
            <div class="alan"><label>ERP / bordro programı listesi (.xlsx / .csv)</label><input type="file" id="dosya" accept=".xlsx,.csv,.txt"></div>
            <div class="kucuk soluk">Tanınan başlıklar: ${(E => Object.keys(E).map(k => E[k]).join(', '))(sozluk().etiket)}
              (sütun adları Tanımlar → Aktarım Başlıkları'ndan değiştirilebilir).
              Yalnızca T.C. zorunludur; boş sütunlar mevcut bilgiye dokunmaz.</div>
          </div>
          <div class="alan"><label>…ya da Excel'den kopyalayıp yapıştırın (başlık satırıyla birlikte)</label>
            <textarea id="yapistir" rows="4" placeholder="TC&#9;Ad Soyad&#9;Net Maaş…"></textarea>
            <button class="btn btn-ikincil btn-kucuk ust-bosluk" id="yapistirBtn">Yapıştırılanı oku</button></div>
        </div>
        <div id="sonuc">${durum ? onizlemeHtml(c) : ''}</div>
      </div>`;

    U.el('dosya').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { oku(c, await TO.dosyaSatirlar(f), f.name); } catch (err) { U.bildir(err.message, 'hata'); }
    };
    U.el('yapistirBtn').onclick = () => {
      try { oku(c, TO.metinSatirlar(U.el('yapistir').value), 'yapıştırılan tablo'); } catch (err) { U.bildir(err.message, 'hata'); }
    };
    bagla(c);
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
      ${yeni.length ? `<h3 class="ust-bosluk">Bu çalışmada olmayanlar</h3>
        <div class="kucuk soluk">İşaretlediğiniz kişiler bu gruba eklenir (hesaplama türü SSK, yaka dosyadan ya da beyaz). Başka gruba ait
          personeli işaretlemeyin.</div>
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
    const v = U.el('vazgecBtn'); if (v) v.onclick = () => { durum = null; APP.tazele(); };
    const u = U.el('uygulaBtn');
    if (u) u.onclick = async () => {
      const yeniSay = Object.keys(durum.yeni).filter(k => durum.yeni[k]).length;
      const ok = await C.onay({ baslik: 'Dış Liste Aktarımı',
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
    id: 'aktarim', ad: 'Dış Liste Aktarımı', ikon: '⇩', grup: 'Veri',
    baslik: 'Dış Liste Aktarımı', altBaslik: 'ERP / bordro programından gerçek maaşlar ve personel bilgisi',
    yetki: 'personel.yaz', calismaGerekli: true, ciz: ciz,
  });

  window.AKTARIM_TEST = { oku: (c, ham) => oku(c, ham, 'test') };
})();
