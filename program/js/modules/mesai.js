/* =====================================================================
   MESAİ ÖNGÖRÜSÜ — seçili grubun çalışması

   Bölüm × ay toplam mesai saati (mavi yaka hafta içi FM1, mavi yaka hafta
   sonu FM2, beyaz yaka hafta sonu FM2) ve bölümün personel sayısı. Kişinin
   aylık mesaisi = bölümün saati / bölümün kişi sayısı; motorda kişinin
   fm1 / fm2 girdisi olur (alan kodları AT / AU).

   · Tablo çalışmaya kayıtlıdır (mesai_ongoru). Kişilerin mesaisini yalnız
     "Mesai öngörüsü açık" iken belirler; kişiye o ay elle girilen mesai
     (Aylık Girdiler) önceliklidir. Tabloyu kullanmayan grupta mesai kişi
     bazında Aylık Girdiler'den girilir.
   · Kişi sayısı boşsa çalışmadaki mevcut kadro sayılır.
   · Excel: programın kendi düzeninde ("MESAİ ÖNGÖRÜSÜ" sayfası) dışa
     aktarılır, aynı düzenden içe alınır; önce önizleme gösterilir.
   · Onaylı çalışmada tablo bilgi amaçlıdır, kişilere işlenmiş mesai değişmez.
   ===================================================================== */
(function () {
  'use strict';

  let sekme = 'MI';
  let gosterim = 'toplam';      // 'toplam' | 'kisi'
  let onizleme = null;

  const SEKME = {
    MI: { yaka: 'M', alan: 'fm1', ad: 'Mavi yaka · hafta içi', kisa: 'HAFTA İÇİ' },
    MS: { yaka: 'M', alan: 'fm2', ad: 'Mavi yaka · hafta sonu', kisa: 'HAFTA SONU' },
    BS: { yaka: 'B', alan: 'fm2', ad: 'Beyaz yaka · hafta sonu', kisa: 'HAFTA SONU' },
  };
  const TAKVIM = [['gun', 'HAFTAİÇİ ÇALIŞMA GÜNÜ'], ['tatil_mesai', 'MESAİLİ ÇALIŞILACAK TATİL GÜNÜ'],
                  ['tatil_tam', 'TAM KADRO ÇALIŞILACAK TATİL GÜNÜ'], ['tatil_yok', 'ÇALIŞILMAYACAK TATİL GÜNÜ']];
  const AYK = U.AYLAR.map(a => a.slice(0, 3));
  const anahtar = b => String(b || '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr-TR');
  const sayi = v => { if (v == null || v === '') return null; const n = Number(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : null; };
  const gos = (x, d) => x == null || x === '' ? '' : B.tlDuz(x, d == null ? (Number.isInteger(Number(x)) ? 0 : 2) : d);

  /* Yakanın bölümleri: tablodakiler + çalışmadaki personelin bölümleri (sıralı) */
  function bolumler(V, yaka) {
    const l = {};
    Object.values(V.M.tablo).filter(t => t.yaka === yaka).forEach(t => { l[anahtar(t.bolum)] = t.bolum; });
    V.personel.filter(kp => (kp.yaka === 'M' ? 'M' : 'B') === yaka && kp.bolum).forEach(kp => { if (!l[anahtar(kp.bolum)]) l[anahtar(kp.bolum)] = kp.bolum; });
    return Object.keys(l).sort((a, b) => a.localeCompare(b, 'tr')).map(k => l[k]);
  }
  const hucre = (V, yaka, bolum, alan, ay) => { const t = V.M.tablo[yaka + '|' + anahtar(bolum)]; return t && t[alan][ay] != null ? t[alan][ay] : null; };

  function veri(c) {
    const personel = API.calismaPersonelListe(c.id);
    const M = API.mesaiOku(c.id);
    const kb = API.mesaiKisiBasi(c.id, personel);
    const aktif = API.calismaAyarOku(c.id)['mesai.ongoru'] === '1';
    return { personel, M, kb, aktif };
  }

  function ciz(kap) {
    const c = APP.calisma();
    const V = veri(c);
    const yaz = API.calismaYazilabilir(c) && API.yetkiVar('aylik.yaz');
    const excel = API.yetkiVar('excel.aktar');
    const h = API.calismaHesapla(c.id);
    const onceki = API.calismaListe().filter(x => x.grup_kod === c.grup_kod && x.yil === c.yil - 1)
      .find(x => Object.keys(API.mesaiOku(x.id).tablo).length);
    const bos = !Object.keys(V.M.tablo).length;

    // Kişilere işlenen mesai ile tablonun uyumu (açık değilken bilgi)
    let uyum = null;
    if (!V.aktif && !bos) {
      let n = 0, es = 0;
      h.kisiler.forEach(s => { for (let m = 1; m <= 12; m++) {
        const o = V.kb(s.kp.yaka, s.kp.bolum, m), g = s.girdi[m];
        n += 2; if (Math.abs((g.fm1 || 0) - o.fm1) < 1e-9) es++; if (Math.abs((g.fm2 || 0) - o.fm2) < 1e-9) es++; } });
      uyum = { n, es };
    }
    // Aylık özet: toplam saat ve brüt mesai
    const ayT = { fm1: Array(13).fill(0), fm2: Array(13).fill(0), bm: Array(13).fill(0) };
    Object.values(V.M.tablo).forEach(t => { for (let m = 1; m <= 12; m++) { if (t.yaka === 'M') ayT.fm1[m] += t.fm1[m] || 0; ayT.fm2[m] += t.fm2[m] || 0; } });
    h.kisiler.forEach(s => { for (let m = 1; m <= 12; m++) ayT.bm[m] += s.yil.aylar[m].BM || 0; });
    const top = a => a.slice(1).reduce((x, y) => x + y, 0);

    const durum = V.aktif
      ? '<span class="rz rz-yesil">Açık — kişilerin mesaisi bu tablodan</span>'
      : '<span class="rz rz-ongoru">Kapalı — kişilerin mesaisi Aylık Girdiler\'den</span>';
    kap.innerHTML = `
      <div class="kart">
        <div class="kart-baslik"><div><h2>Fazla Mesai Planı — ${U.esc(c.grup_adi || c.grup_kod)}</h2>
          <div class="kart-aciklama">${c.yil} · ${U.esc(c.ad)}. Bölüm bazında aylık toplam mesai saati; kişi başı mesai =
            bölümün saati ÷ bölümün kişi sayısı. Kişiye o ay Aylık Girdiler'den mesai yazılmışsa o geçerlidir.</div></div>
          <div class="btn-satir">
            ${excel ? '<button class="btn btn-ikincil" id="msAktar">Excel\'e aktar</button>' : ''}
            ${excel && yaz ? '<label class="btn btn-ikincil">Excel\'den al…<input type="file" id="msDosya" accept=".xlsx" class="gizli"></label>' : ''}
            ${yaz && onceki ? `<button class="btn btn-ikincil" id="msKopya">${onceki.yil} tablosunu kopyala</button>` : ''}
            ${yaz ? `<button class="btn${V.aktif ? ' btn-ikincil' : ''}" id="msAc">${V.aktif ? 'Öngörüyü kapat' : 'Öngörüyü aç'}</button>` : ''}
          </div></div>
        <div class="btn-satir">${durum}
          ${uyum ? `<span class="kucuk soluk">Tablodan hesaplanan kişi başı mesai, kişilere işlenen mesaiyle
            ${uyum.es === uyum.n ? '<strong>birebir aynı</strong>' : `<strong>${uyum.n - uyum.es}</strong> değerde farklı`} (${U.sayi(uyum.n)} değer).</span>` : ''}</div>
        ${c.durum === 'ONAYLI' ? `<div class="uyari uyari-bilgi ust-bosluk"><span class="ik">ℹ</span><div>Onaylı çalışmada tablo bilgi amaçlıdır:
          kişilere işlenmiş mesai onaylandığı hâliyle kalır ve onaylı maliyet değişmez. Yeni yılda "${c.yil} tablosunu kopyala" ile başlangıç yapılabilir.</div></div>` : ''}
        ${bos ? `<div class="uyari uyari-dikkat ust-bosluk"><span class="ik">ℹ</span><div>Bu çalışmada henüz mesai öngörüsü yok.
          ${onceki ? onceki.yil + ' tablosunu kopyalayabilir, ' : ''}programın mesai Excel düzeninde ("Excel'e aktar" ile alınan dosya) hazırlanmış
          bir dosyayı içe alabilir ya da aşağıya yazabilirsiniz. Tabloyu kullanmazsanız mesai kişi bazında Aylık Girdiler'den girilir.</div></div>` : ''}
        <h3 class="ust-bosluk">Aylık özet</h3>
        <div class="tablo-sar"><table class="genis-tablo"><thead><tr><th></th>${AYK.map(a => `<th class="num">${a}</th>`).join('')}<th class="num">Toplam</th></tr></thead>
          <tbody>
            <tr><td>Mavi yaka hafta içi saat</td>${ayT.fm1.slice(1).map(x => `<td class="num">${gos(x, 0)}</td>`).join('')}<td class="num kalin">${gos(top(ayT.fm1), 0)}</td></tr>
            <tr><td>Hafta sonu saat (mavi + beyaz)</td>${ayT.fm2.slice(1).map(x => `<td class="num">${gos(x, 0)}</td>`).join('')}<td class="num kalin">${gos(top(ayT.fm2), 0)}</td></tr>
            <tr class="kalin"><td>Brüt mesai ücreti (çalışmanın hesabı)</td>${ayT.bm.slice(1).map(x => `<td class="num">${B.tlDuz(x)}</td>`).join('')}<td class="num">${B.tlDuz(top(ayT.bm))}</td></tr>
          </tbody></table></div>
      </div>
      <div id="msOnizleme">${onizleme && onizleme.calismaId === c.id ? onizlemeHtml(onizleme, yaz) : ''}</div>
      <div class="kart">
        <div class="suzgec-satir">
          <div class="grup-dugmeler">
            ${Object.keys(SEKME).map(k => `<button class="${sekme === k ? 'etkin' : ''}" data-sekme="${k}">${SEKME[k].ad}</button>`).join('')}
            <button class="${sekme === 'KS' ? 'etkin' : ''}" data-sekme="KS">Kişi sayıları</button>
            <button class="${sekme === 'TK' ? 'etkin' : ''}" data-sekme="TK">Takvim</button>
          </div>
          ${SEKME[sekme] ? `<select id="msGos"><option value="toplam"${gosterim === 'toplam' ? ' selected' : ''}>Bölüm toplam saat</option>
            <option value="kisi"${gosterim === 'kisi' ? ' selected' : ''}>Kişi başı saat</option></select>` : ''}
          ${yaz ? '<span class="kucuk soluk">Hücreye yazıp çıkınca kaydedilir.</span>' : ''}
        </div>
        <div class="tablo-sar ust-bosluk">${SEKME[sekme] ? saatTablo(V, SEKME[sekme], yaz) : sekme === 'KS' ? kisiTablo(V, yaz) : takvimTablo(V, yaz)}</div>
      </div>`;

    kap.querySelectorAll('[data-sekme]').forEach(b => b.onclick = () => { sekme = b.getAttribute('data-sekme'); APP.tazele(); });
    const g = U.el('msGos'); if (g) g.onchange = () => { gosterim = g.value; APP.tazele(); };
    kap.querySelectorAll('input[data-ms]').forEach(inp => inp.onchange = () => {
      const [yaka, alan, ay] = inp.getAttribute('data-ms').split('|');
      const v = inp.value.trim(), n = sayi(v);
      if (v !== '' && (n == null || n < 0)) { U.bildir('Geçersiz değer: ' + v, 'hata'); inp.classList.add('hata'); return; }
      try {
        API.mesaiYaz(c.id, [{ yaka, bolum: inp.getAttribute('data-bolum') || '', ay: Number(ay), alan, deger: v === '' ? null : n }]);
        inp.classList.remove('hata'); inp.classList.add('degisti');
        toplamGuncelle(inp.closest('table'));
      } catch (e) { U.bildir(e.message, 'hata'); }
    });
    const ab = U.el('msAc');
    if (ab) ab.onclick = async () => {
      const ac = !V.aktif;
      if (ac && !await C.onay({ baslik: 'Mesai öngörüsünü aç', evetYazi: 'Aç',
        mesaj: 'Kişilerin aylık mesaisi bölüm tablosundan hesaplanacak (bölümün saati ÷ kişi sayısı). Aylık Girdiler\'de kişiye o ay yazılmış mesai varsa o geçerli kalır.' })) return;
      try { API.mesaiAktifYaz(c.id, ac); APP.tazele(); } catch (e) { U.bildir(e.message, 'hata'); }
    };
    const kb = U.el('msKopya');
    if (kb) kb.onclick = async () => {
      if (!bos && !await C.onay({ baslik: 'Tabloyu kopyala', tehlike: true, evetYazi: 'Kopyala',
        mesaj: `Bu çalışmadaki mesai öngörüsü silinip ${onceki.yil} tablosu kopyalanacak.` })) return;
      try { API.mesaiKopyala(c.id, onceki.id); U.bildir(onceki.yil + ' tablosu kopyalandı.', 'basari'); APP.tazele(); } catch (e) { U.bildir(e.message, 'hata'); }
    };
    const ea = U.el('msAktar');
    if (ea) ea.onclick = () => aktar(c, V).catch(e => { console.error(e); U.bildir('Excel oluşturulamadı: ' + e.message, 'hata'); });
    const d = U.el('msDosya');
    if (d) d.onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { onizleme = await oku(c, V, f); APP.tazele(); } catch (err) { console.error(err); U.bildir(err.message, 'hata'); }
    };
    const ov = U.el('msOnVazgec'); if (ov) ov.onclick = () => { onizleme = null; APP.tazele(); };
    const ou = U.el('msOnUygula');
    if (ou) ou.onclick = () => {
      try { API.mesaiYaz(c.id, onizleme.liste, 'Excel: ' + onizleme.dosya); U.bildir('Mesai öngörüsü içe alındı (' + onizleme.liste.length + ' hücre).', 'basari'); onizleme = null; APP.tazele(); }
      catch (e) { U.bildir(e.message, 'hata'); }
    };
  }

  function toplamGuncelle(tb) {
    if (!tb) return;
    const satirlar = [...tb.querySelectorAll('tbody tr[data-satir]')];
    satirlar.forEach(tr => {
      const t = [...tr.querySelectorAll('input[data-ms]')].reduce((s, i) => s + (sayi(i.value) || 0), 0);
      const h = tr.querySelector('[data-top]'); if (h) h.textContent = gos(t);
    });
    const alt = tb.querySelector('tr[data-alt]');
    if (alt) for (let m = 1; m <= 12; m++) {
      const t = satirlar.reduce((s, tr) => { const i = tr.querySelector(`input[data-ms$="|${m}"]`); return s + (i ? sayi(i.value) || 0 : 0); }, 0);
      const h = alt.querySelector(`[data-ay="${m}"]`); if (h) h.textContent = gos(t);
    }
  }

  function saatTablo(V, S, yaz) {
    const bl = bolumler(V, S.yaka);
    const kisiModu = gosterim === 'kisi';
    const kisiSay = {}; V.personel.forEach(kp => { if ((kp.yaka === 'M' ? 'M' : 'B') === S.yaka) kisiSay[anahtar(kp.bolum)] = (kisiSay[anahtar(kp.bolum)] || 0) + 1; });
    const ayTop = Array(13).fill(0);
    const satir = bl.map(b => {
      let t = 0;
      const hucreler = AYK.map((a, i) => {
        const m = i + 1, v = hucre(V, S.yaka, b, S.alan, m);
        t += v || 0; ayTop[m] += v || 0;
        if (kisiModu) { const o = V.kb(S.yaka, b, m); const x = S.alan === 'fm1' ? o.fm1 : o.fm2; return `<td class="num">${x ? B.tlDuz(x, 2) : '<span class="cok-soluk">—</span>'}</td>`; }
        return `<td class="num"><input class="hucre-girdi" style="width:62px" data-ms="${S.yaka}|${S.alan}|${m}" data-bolum="${U.esc(b)}"
          value="${gos(v)}"${yaz ? '' : ' disabled'}></td>`;
      }).join('');
      const bosBolum = !kisiSay[anahtar(b)];
      return `<tr data-satir><td>${U.esc(b)}${bosBolum ? ' <span class="kucuk cok-soluk" title="Bu çalışmada bu bölümde bu yakadan kişi yok">(kişi yok)</span>' : ''}</td>
        <td class="num kucuk soluk">${kisiSay[anahtar(b)] || 0}</td>${hucreler}<td class="num kalin" data-top>${kisiModu ? '' : gos(t)}</td></tr>`;
    }).join('');
    return `<table class="genis-tablo"><thead><tr><th>Bölüm</th><th class="num" title="Çalışmadaki kişi">Kadro</th>
      ${AYK.map(a => `<th class="num">${a}</th>`).join('')}<th class="num">${kisiModu ? '' : 'Toplam'}</th></tr></thead>
      <tbody>${satir || '<tr><td colspan="15" class="soluk">Bölüm yok.</td></tr>'}
      ${kisiModu ? '' : `<tr data-alt class="toplam-satir"><td>Toplam</td><td></td>${AYK.map((a, i) => `<td class="num" data-ay="${i + 1}">${gos(ayTop[i + 1])}</td>`).join('')}
        <td class="num">${gos(ayTop.reduce((x, y) => x + y, 0))}</td></tr>`}</tbody></table>
      <div class="kucuk soluk ust-bosluk">${kisiModu ? 'Kişi başı saat = bölümün toplam saati ÷ kişi sayısı (Kişi sayıları sekmesi; boşsa kadro).'
        : 'Saatler bölümün o aydaki TOPLAM mesai saatidir.'}</div>`;
  }

  function kisiTablo(V, yaz) {
    return ['M', 'B'].map(y => {
      const bl = bolumler(V, y);
      const kisiSay = {}; V.personel.forEach(kp => { if ((kp.yaka === 'M' ? 'M' : 'B') === y) kisiSay[anahtar(kp.bolum)] = (kisiSay[anahtar(kp.bolum)] || 0) + 1; });
      return `<h3 class="${y === 'B' ? 'ust-bosluk' : ''}">${y === 'M' ? 'Mavi yaka (hafta içi ve hafta sonu)' : 'Beyaz yaka'} — personel sayısı</h3>
        <table class="genis-tablo ust-bosluk"><thead><tr><th>Bölüm</th><th class="num">Kadro</th>${AYK.map(a => `<th class="num">${a}</th>`).join('')}</tr></thead>
        <tbody>${bl.map(b => `<tr><td>${U.esc(b)}</td><td class="num kalin">${kisiSay[anahtar(b)] || 0}</td>${AYK.map((a, i) => {
          const v = hucre(V, y, b, 'kisi', i + 1);
          const fark = v != null && v !== (kisiSay[anahtar(b)] || 0);
          return `<td class="num"><input class="hucre-girdi${fark ? ' uyari-hucre' : ''}" style="width:46px" data-ms="${y}|kisi|${i + 1}" data-bolum="${U.esc(b)}"
            value="${gos(v)}" placeholder="${kisiSay[anahtar(b)] || 0}"${yaz ? '' : ' disabled'} title="${fark ? 'Kadrodan farklı' : ''}"></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
    }).join('') + `<div class="kucuk soluk ust-bosluk">Boş hücre = çalışmadaki kadro (soluk sayı). Kadrodan farklı yazılan sayı sarı görünür;
      bölümün saati bu sayıya bölünür (planlanan kişi sayısı).</div>`;
  }

  function takvimTablo(V, yaz) {
    const T = V.M.takvim;
    const gunSay = m => new Date(APP.yil(), m, 0).getDate();
    return `<table class="genis-tablo"><thead><tr><th></th>${AYK.map(a => `<th class="num">${a}</th>`).join('')}</tr></thead><tbody>
      ${TAKVIM.map(([al, ad]) => `<tr><td>${U.esc(ad)}</td>${AYK.map((a, i) => `<td class="num"><input class="hucre-girdi" style="width:52px"
        data-ms="|${al}|${i + 1}" value="${gos((T[al] || [])[i + 1])}"${yaz ? '' : ' disabled'}></td>`).join('')}</tr>`).join('')}
      <tr class="kalin"><td>Toplam (ayın günü)</td>${AYK.map((a, i) => { const t = TAKVIM.reduce((s, [al]) => s + ((T[al] || [])[i + 1] || 0), 0);
        return `<td class="num${t && t !== gunSay(i + 1) ? ' uyari-hucre' : ''}">${gos(t)} / ${gunSay(i + 1)}</td>`; }).join('')}</tr>
      <tr><td>Hafta sayısı (çalışma günü ÷ 6)</td>${AYK.map((a, i) => `<td class="num">${(T.gun || [])[i + 1] ? B.tlDuz(T.gun[i + 1] / 6, 2) : ''}</td>`).join('')}</tr>
    </tbody></table><div class="kucuk soluk ust-bosluk">Takvim bilgi amaçlıdır; hesaba girmez. Saatleri planlarken kullanılır.</div>`;
  }

  /* ---------- Excel: programın mesai düzeni ----------
     "MESAİ ÖNGÖRÜSÜ" sayfası: 1–6. satır takvim; ardından mavi yaka hafta içi,
     mavi yaka hafta sonu ve beyaz yaka hafta sonu blokları. A sütunu "HAFTA İÇİ" /
     "HAFTA SONU", B sütunu bölüm adı, C–N aylık toplam saat, R–AC aylık kişi sayısı.
     İçe alma aynı düzeni okur. */
  const SAYFA = 'MESAİ ÖNGÖRÜSÜ';
  async function aktar(c, V) {
    if (!window.ExcelJS) throw new Error('Excel kütüphanesi yüklenemedi.');
    API.yetkiIste('excel.aktar');
    const kitap = new ExcelJS.Workbook();
    kitap.creator = 'Ücret Hesaplama'; kitap.created = new Date();
    const ws = kitap.addWorksheet(SAYFA, { views: [{ state: 'frozen', xSplit: 2 }] });
    ws.getColumn(1).width = 11; ws.getColumn(2).width = 40; ws.getColumn(17).width = 40;
    const LAC = 'FF1F3A5F', SARI = 'FFFFF2CC';
    const ay = i => 3 + i, ks = i => 18 + i;            // C..N, R..AC
    const baslik = (r, a, b) => { const row = ws.getRow(r); row.getCell(2).value = a; row.getCell(17).value = b;
      U.AYLAR.forEach((x, i) => { row.getCell(ay(i)).value = x.toLocaleUpperCase('tr-TR'); if (b) row.getCell(ks(i)).value = x.toLocaleUpperCase('tr-TR'); });
      row.eachCell(h => { h.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LAC } }; }); };
    const sari = h => { h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SARI } }; };
    // Takvim 1–6
    ws.getRow(1).getCell(2).value = 'HAFTA SAYISI';
    U.AYLAR.forEach((x, i) => { ws.getRow(1).getCell(ay(i)).value = { formula: `${ws.getColumn(ay(i)).letter}2/6` }; });
    TAKVIM.forEach(([al, ad], j) => { const row = ws.getRow(2 + j); row.getCell(2).value = ad;
      U.AYLAR.forEach((x, i) => { const v = (V.M.takvim[al] || [])[i + 1]; const h = row.getCell(ay(i)); if (v != null) h.value = v; sari(h); }); });
    U.AYLAR.forEach((x, i) => { const L = ws.getColumn(ay(i)).letter; ws.getRow(6).getCell(ay(i)).value = { formula: `SUM(${L}2:${L}5)` }; });
    let r = 7;
    const blok = (S, kisiYaz) => {
      baslik(r, S.yaka === 'M' ? 'MAVİ YAKA' : 'BEYAZ YAKA', (S.yaka === 'M' ? 'MAVİ YAKA' : 'BEYAZ YAKA') + '-PERSONEL SAYILARI');
      const ilk = r + 1;
      bolumler(V, S.yaka).forEach(b => {
        r++; const row = ws.getRow(r);
        row.getCell(1).value = S.kisa; row.getCell(2).value = b; row.getCell(17).value = b;
        U.AYLAR.forEach((x, i) => {
          const v = hucre(V, S.yaka, b, S.alan, i + 1); const h = row.getCell(ay(i)); h.value = v == null ? 0 : v; sari(h);
          const kv = hucre(V, S.yaka, b, 'kisi', i + 1);
          const k = row.getCell(ks(i));
          if (kisiYaz) { k.value = kv == null ? V.kb(S.yaka, b, i + 1).kisi : kv; sari(k); }
          else k.value = { formula: `${ws.getColumn(ks(i)).letter}${r - (blokOfs)}` };
        });
        row.getCell(15).value = { formula: `SUM(C${r}:N${r})` };
        row.getCell(30).value = { formula: `SUM(R${r}:AC${r})` };
        row.getCell(31).value = { formula: `IFERROR(O${r}/AD${r},0)` };
      });
      const son = r; r += 2;
      const row = ws.getRow(r);
      for (let i = 0; i < 12; i++) { const L = ws.getColumn(ay(i)).letter, K = ws.getColumn(ks(i)).letter;
        row.getCell(ay(i)).value = { formula: `SUM(${L}${ilk}:${L}${son})` }; row.getCell(ks(i)).value = { formula: `SUM(${K}${ilk}:${K}${son})` }; }
      row.font = { bold: true };
      r += 2;
      return { ilk, son };
    };
    let blokOfs = 0;
    const b1 = blok(SEKME.MI, true);
    blokOfs = (r + 1) - b1.ilk;                 // hafta sonu satırı, hafta içi kişi sayısına bakar
    blok(SEKME.MS, false);
    blok(SEKME.BS, true);
    ws.getCell('AE7').value = 'KİŞİ BAŞI ORT.';
    ws.getRow(r + 1).getCell(2).value = 'Sarı hücreler doldurulur. Saatler bölümün o aydaki TOPLAM mesai saatidir; kişi başı = saat ÷ personel sayısı. ' +
      'Bölüm adları personel kartındaki bölümle aynı olmalıdır. Mavi yaka hafta sonu kişi sayısı hafta içi tablosundan alınır.';
    ws.getRow(r + 1).getCell(2).font = { italic: true, size: 9, color: { argb: 'FF7A5210' } };
    const buf = await kitap.xlsx.writeBuffer();
    U.indir(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${c.yil} ${String(c.grup_adi || c.grup_kod).toLocaleUpperCase('tr-TR')} MESAİ ÖNGÖRÜSÜ.xlsx`);
    API.log('DISA_AKTAR', 'mesai_ongoru', c.id, 'Excel');
  }

  function deger(v) {
    if (v == null) return null;
    if (typeof v === 'object') {
      if (v instanceof Date) return null;
      if (v.richText) return v.richText.map(t => t.text).join('');
      if ('result' in v) return v.result;
      if (v.text) return v.text;
    }
    return v;
  }
  const bitisik = s => String(s || '').replace(/\s+/g, '').toLocaleUpperCase('tr-TR');

  async function oku(c, V, dosya) {
    if (!window.ExcelJS) throw new Error('Excel kütüphanesi yüklenemedi.');
    const kitap = new ExcelJS.Workbook();
    await kitap.xlsx.load(await dosya.arrayBuffer());
    const ws = kitap.worksheets.find(w => bitisik(w.name) === bitisik(SAYFA));
    if (!ws) throw new Error(`Dosyada "${SAYFA}" sayfası yok.`);
    const S = (r, c2) => deger(ws.getRow(r).getCell(c2).value);
    const n = (r, c2) => { const x = S(r, c2); const v = typeof x === 'number' ? x : sayi(x); return v == null || !isFinite(v) ? null : v; };
    const yeni = [], uyari = [];
    const takvimAd = {}; TAKVIM.forEach(([al, ad]) => { takvimAd[bitisik(ad)] = al; });
    let yaka = null, bolumSay = 0;
    for (let r = 1; r <= ws.rowCount; r++) {
      const A = bitisik(S(r, 1)), Bh = String(S(r, 2) || '').trim(), Bb = bitisik(Bh);
      if (takvimAd[Bb]) { for (let i = 0; i < 12; i++) { const v = n(r, 3 + i); if (v != null) yeni.push(['', '', i + 1, takvimAd[Bb], v]); } continue; }
      if ((Bb === 'MAVİYAKA' || Bb === 'BEYAZYAKA') && bitisik(S(r, 3)) === 'OCAK') { yaka = Bb === 'MAVİYAKA' ? 'M' : 'B'; continue; }
      if (!yaka || !Bh || (A !== 'HAFTAİÇİ' && A !== 'HAFTASONU')) continue;
      const alan = A === 'HAFTAİÇİ' ? 'fm1' : 'fm2';
      if (yaka === 'B' && alan === 'fm1') { uyari.push(Bh + ': beyaz yaka hafta içi mesai hesaba girmez, alınmadı'); continue; }
      bolumSay++;
      for (let i = 0; i < 12; i++) {
        const v = n(r, 3 + i); if (v != null && v !== 0) yeni.push([yaka, Bh, i + 1, alan, v]);
        // Kişi sayısı: mavi yakada hafta içi bloğundan, beyazda kendi bloğundan
        if ((yaka === 'M' && alan === 'fm1') || yaka === 'B') {
          const k = n(r, 18 + i); if (k != null && k !== 0) yeni.push([yaka, Bh, i + 1, 'kisi', k]);
        }
      }
    }
    if (!bolumSay) throw new Error('Sayfada bölüm satırı bulunamadı (A sütununda "HAFTA İÇİ" / "HAFTA SONU", B sütununda bölüm adı olmalı).');
    // Tek kayıt: aynı hücre iki kez geldiyse son değer
    const yeniH = {};
    yeni.forEach(x => { yeniH[x[0] + '|' + anahtar(x[1]) + '|' + x[2] + '|' + x[3]] = x; });
    const eskiH = {};
    Object.values(V.M.tablo).forEach(t => ['fm1', 'fm2', 'kisi'].forEach(al => t[al].forEach((v, m) => { if (v != null) eskiH[t.yaka + '|' + anahtar(t.bolum) + '|' + m + '|' + al] = [t.yaka, t.bolum, m, al, v]; })));
    Object.keys(V.M.takvim).forEach(al => V.M.takvim[al].forEach((v, m) => { if (v != null) eskiH['||' + m + '|' + al] = ['', '', m, al, v]; }));
    const liste = [];
    Object.keys(yeniH).forEach(k => { const y = yeniH[k], e = eskiH[k]; if (!e || Math.abs(e[4] - y[4]) > 1e-9 || e[1] !== y[1]) liste.push({ yaka: y[0], bolum: y[1], ay: y[2], alan: y[3], deger: y[4] }); });
    Object.keys(eskiH).forEach(k => { if (!yeniH[k]) { const e = eskiH[k]; liste.push({ yaka: e[0], bolum: e[1], ay: e[2], alan: e[3], deger: null }); } });
    // Bölüm adı eşleşmeyenler
    const kadro = {}; V.personel.forEach(kp => { kadro[(kp.yaka === 'M' ? 'M' : 'B') + '|' + anahtar(kp.bolum)] = 1; });
    const kisisiz = [...new Set(yeni.filter(x => x[0] && !kadro[x[0] + '|' + anahtar(x[1])] && x[3] !== 'kisi').map(x => (x[0] === 'M' ? 'Mavi' : 'Beyaz') + ': ' + x[1]))];
    const saat = al => yeni.filter(x => x[3] === al).reduce((s, x) => s + x[4], 0);
    return { calismaId: c.id, dosya: dosya.name, liste, uyari, kisisiz, bolumSay,
             ozet: { fm1: saat('fm1'), fm2: saat('fm2') }, silinen: liste.filter(x => x.deger == null).length };
  }

  function onizlemeHtml(o, yaz) {
    return `<div class="kart">
      <div class="kart-baslik"><div><h2>İçe alma önizlemesi — ${U.esc(o.dosya)}</h2>
        <div class="kart-aciklama">${o.bolumSay} bölüm satırı okundu · hafta içi ${B.tlDuz(o.ozet.fm1)} saat, hafta sonu ${B.tlDuz(o.ozet.fm2)} saat ·
          <strong>${o.liste.length}</strong> hücre değişecek${o.silinen ? ` (${o.silinen} hücre dosyada olmadığı için boşalacak)` : ''}. Onaylamadan hiçbir şey yazılmaz.</div></div>
        <div class="btn-satir"><button class="btn btn-ikincil" id="msOnVazgec">Vazgeç</button>
          ${yaz ? `<button class="btn" id="msOnUygula"${o.liste.length ? '' : ' disabled'}>İçe al</button>` : ''}</div></div>
      ${o.kisisiz.length ? `<div class="uyari uyari-dikkat"><span class="ik">⚠</span><div><strong>${o.kisisiz.length} bölümde bu çalışmada kişi yok</strong>
        — bu saatler kimseye dağılmaz. Bölüm adı personel kartındakiyle aynı mı?<div class="kucuk">${o.kisisiz.map(U.esc).join(' · ')}</div></div></div>` : ''}
      ${o.uyari.length ? `<div class="uyari uyari-dikkat"><span class="ik">ℹ</span><div class="kucuk">${o.uyari.map(U.esc).join('<br>')}</div></div>` : ''}
    </div>`;
  }

  APP.modulKaydet({
    id: 'mesai', ad: 'Fazla Mesai Planı', ikon: '⏱', grup: 'Bütçe',
    baslik: 'Fazla Mesai Planı', altBaslik: 'Bölüm bazında aylık mesai saati ve kişi sayısı',
    yetki: 'personel.oku', calismaGerekli: true, ciz: ciz,
  });
})();
