/* =====================================================================
   AYLIK GİRDİLER — kişinin ay ay elle girilen bordro kalemleri

   İki tür alan var:
   - SÜREKLİ (hesaplama türü, kanun, mesai saatleri, AR-GE günü): o aydan
     itibaren geçerlidir, sonraki aylar devralır. Devralınan değer soluk görünür.
   - O AYA ÖZGÜ (ayni yardım, prim, yakıt, çalışılan gün): yalnızca o ay.
   ===================================================================== */
(function () {
  'use strict';

  let ay = 1;
  const TEK = [
    ['ayni', 'Net Ayni Yardım'], ['prim', 'Prim / Diğer (net)'], ['fm1', 'FM1 Mesai (saat)'],
    ['fm2', 'FM2 Mesai (saat)'], ['yakit', 'Yakıt Yardımı'], ['calisilan_gun', 'Çalışılan Gün'],
    /* AR-GE günü: boş = çalışmanın AR-GE günü ayarı (Çalışmalar → ✎), o da yoksa 0 — ayar yalnız GV teşviki %80+
       olanlarda kullanılır. Gün, AR-GE GV/DV teşvikinde ve 05746 SGK teşvikinde kullanılır. */
    ['arge_gun', 'AR-GE Günü'],
  ];
  const TOPLAMSIZ = { calisilan_gun: 1, arge_gun: 1 };
  const DEVREDEN = { fm1: 1, fm2: 1, arge_gun: 1 };

  function ciz(kap) {
    const c = APP.calisma();
    const h = API.calismaHesapla(c.id);
    const har = API.aylikGirdiHarita(c.id);
    const yaz = API.calismaYazilabilir(c);
    const sYaz = yaz && API.yetkiVar('personel.yaz');
    const tYaz = yaz && API.yetkiVar('aylik.yaz');
    const turler = API.hesapTuruListe(c.yil).map(t => ({ deger: t.kod, etiket: t.kod }));
    const kanunlar = API.kanunListe().map(k => ({ deger: k.kod, etiket: k.kod === 'YOK' ? '—' : k.kod }));

    // Ayın toplamları (sekme üstünde)
    const top = {}; TEK.forEach(t => { top[t[0]] = 0; });

    const satir = s => {
      const tc = s.kp.tc_kimlik_no, o = (har[tc] || {})[ay] || {}, g = s.girdi[ay];
      const onceki = ay === 1 ? { tur: s.kp.hesap_turu, kanun: s.kp.kanun } : null;
      // Sürekli alanın bu ayki ham değeri: kaydı varsa o, yoksa devralınan
      const etkinTur = o.hesap_turu !== undefined ? o.hesap_turu : g.tur;
      const etkinKanun = o.kanun !== undefined ? o.kanun : kanunKodu(s, ay, har);
      const sec = (alan, liste, deger, kendi) => sYaz && ay > 1
        ? `<select class="hucre-girdi${kendi ? ' degisti' : ''}" data-alan="${alan}" data-tc="${U.esc(tc)}" style="width:84px">
             ${C.secenekler(liste, deger)}</select>`
        : `<span class="${kendi || ay === 1 ? '' : 'devralan'}">${U.esc(deger || '—')}</span>`;
      // Mesai devreden alandır: toplamda o ayın geçerli (devralınan dâhil) saati sayılır
      TEK.forEach(t => { top[t[0]] += DEVREDEN[t[0]] ? (Number(g[t[0]]) || 0) : (Number(o[t[0]]) || 0); });
      return `<tr>
        <td>${U.esc(s.kp.ad_soyad)}</td>
        <td>${sec('hesap_turu', turler, etkinTur, o.hesap_turu !== undefined)}</td>
        <td>${sec('kanun', kanunlar, etkinKanun, o.kanun !== undefined)}</td>
        ${TEK.map(t => `<td class="num">${tYaz
          ? `<input class="hucre-girdi${o[t[0]] !== undefined ? ' degisti' : ''}" data-alan="${t[0]}" data-tc="${U.esc(tc)}"
                    value="${o[t[0]] !== undefined ? B.tlDuz(o[t[0]], Number(o[t[0]]) % 1 ? 2 : 0) : ''}"
                    placeholder="${t[0] === 'calisilan_gun' ? '30' : t[0] === 'arge_gun' ? (s.yil.aylar[ay].AP ? B.tlDuz(s.yil.aylar[ay].AP, s.yil.aylar[ay].AP % 1 ? 1 : 0) : '—') : (t[0] === 'fm1' || t[0] === 'fm2') && g[t[0]] ? B.tlDuz(g[t[0]], g[t[0]] % 1 ? 1 : 0) : ''}"
                    ${t[0] === 'arge_gun' && o[t[0]] === undefined ? `title="${g.argeGun != null ? 'Önceki aydan devralındı' : s.yil.aylar[ay].AP ? 'Çalışmanın kayıtlı AR-GE günü' : (Number(g.gvTesvik) || 0) >= 0.8 ? 'AR-GE günü girilmedi (varsayılan yok) — Ocak’a girilen gün bütün yıla geçer' : 'AR-GE personeli değil (GV teşviki yok)'}"` : ''}
                    ${(t[0] === 'fm1' || t[0] === 'fm2') && o[t[0]] === undefined && g[t[0]] ? 'title="Önceki aydan devralındı"' : ''}>`
          : B.tl(o[t[0]])}</td>`).join('')}
        <td class="num">${B.tl(s.yil.aylar[ay].DM)}</td>
      </tr>`;
    };
    const govde = h.kisiler.map(satir).join('');

    kap.innerHTML = `
      <div class="kart">
        <div class="kart-baslik">
          <div><h2>Aylık Girdiler — ${U.AYLAR[ay - 1]} ${c.yil}</h2>
            <div class="kart-aciklama">Sarı hücreler bu ay için girilmiş değerdir. Hesaplama türü ve kanun
              Şubat'tan itibaren buradan değiştirilir ve sonraki aylara devreder; Ocak değeri kişi kartındadır.
              <strong>Mesai saatleri ve AR-GE günü de devreder</strong>: girildiği aydan itibaren sonraki aylarda aynen geçerlidir (Ocak'ta girilen AR-GE günü bütün yıl geçerli; hiç girilmemişse çalışmanın AR-GE günü ayarı, o da yoksa 0) (soluk rakam =
              devralınan); değiştirdiğiniz aydan itibaren yeni değer geçerli olur.</div></div>
        </div>
        <div class="sekme-cubuk">${U.AYLAR.map((a, i) =>
          `<button class="btn btn-ikincil btn-kucuk${i + 1 === ay ? ' etkin' : ''}" data-ay="${i + 1}">${a}</button>`).join('')}</div>
        ${tYaz ? `<div class="satir" style="margin-bottom:12px">
          <span class="kucuk soluk">Tüm kişilere:</span>
          <select id="topluAlan">${C.secenekler(TEK.map(t => ({ deger: t[0], etiket: t[1] })), 'ayni')}</select>
          <input id="topluDeger" class="hucre-girdi" placeholder="tutar" style="width:110px">
          <button class="btn btn-ikincil btn-kucuk" id="topluBtn">${U.AYLAR[ay - 1]} ayına uygula</button>
          <span class="kucuk cok-soluk">Boş bırakıp uygularsanız o alan bu ay için temizlenir.</span>
        </div>` : ''}
        <div class="tablo-sar"><table class="genis-tablo">
          <thead><tr><th>Ad Soyad</th><th>Hesaplama</th><th>Kanun</th>
            ${TEK.map(t => `<th class="num">${t[1]}</th>`).join('')}<th class="num">Ay Maliyeti</th></tr></thead>
          <tbody>${govde}
            <tr class="toplam-satir"><td>Toplam</td><td></td><td></td>
              ${TEK.map(t => `<td class="num">${TOPLAMSIZ[t[0]] ? '' : B.tl(top[t[0]])}</td>`).join('')}
              <td class="num">${B.tl(h.kisiler.reduce((a, s) => a + s.yil.aylar[ay].DM, 0))}</td></tr>
          </tbody></table></div>
      </div>`;

    kap.querySelectorAll('[data-ay]').forEach(b => b.onclick = () => { ay = Number(b.getAttribute('data-ay')); APP.tazele(); });

    /* Kaydettikten sonra ekran yeniden çizilir; kaydırma yeri ve imleç korunur (alttaki bir kişiye veri girip
       diğerine geçince sayfa başa sıçramasın). odak = { tc, alan } — yeniden çizimden sonra imlecin gideceği hücre.
       Enter bir alttaki kişinin aynı alanına geçer (hesap tablosundaki gibi). */
    const yenile = odak => {
      const kaydir = [];
      for (let e = kap.parentElement; e; e = e.parentElement) if (e.scrollTop || e.scrollLeft) kaydir.push([e, e.scrollTop, e.scrollLeft]);
      const sayfa = [window.scrollX, window.scrollY];
      const tablolar = [...kap.querySelectorAll('.tablo-sar')].map(t => [t.scrollTop, t.scrollLeft]);
      APP.tazele();
      const yeni = U.el('icerik');
      kaydir.forEach(([e, y, x]) => { e.scrollTop = y; e.scrollLeft = x; });
      window.scrollTo(sayfa[0], sayfa[1]);
      yeni.querySelectorAll('.tablo-sar').forEach((t, i) => { if (tablolar[i]) { t.scrollTop = tablolar[i][0]; t.scrollLeft = tablolar[i][1]; } });
      if (odak && odak.tc) {
        const h = yeni.querySelector(`[data-tc="${CSS.escape(odak.tc)}"][data-alan="${CSS.escape(odak.alan)}"]`);
        if (h) { h.focus({ preventScroll: true }); if (h.select) h.select(); }
      }
    };
    const hucreOdak = el => el && el.getAttribute && el.getAttribute('data-tc')
      ? { tc: el.getAttribute('data-tc'), alan: el.getAttribute('data-alan') } : null;

    kap.querySelectorAll('input[data-alan]').forEach(inp => {
      const eski = inp.value;
      let bitti = false;
      const kaydet = odak => {
        if (bitti || inp.value === eski) return false;
        bitti = true;
        const v = inp.value.trim();
        try {
          API.aylikGirdiYaz(c.id, inp.getAttribute('data-tc'), ay, inp.getAttribute('data-alan'),
                            v === '' ? null : API.trSayi(v));
          yenile(odak);
        } catch (e) { bitti = false; U.bildir(e.message, 'hata'); }
        return true;
      };
      inp.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const ayni = [...kap.querySelectorAll(`input[data-alan="${inp.getAttribute('data-alan')}"]`)];
        const alt = ayni[ayni.indexOf(inp) + 1];
        // Değişiklik yoksa yalnız bir alta geç; varsa kaydet ve yeniden çizimden sonra bir alttakine odaklan
        if (!kaydet(hucreOdak(alt)) && alt) { alt.focus(); alt.select(); }
      });
      inp.addEventListener('blur', e => kaydet(hucreOdak(e.relatedTarget)));
    });

    kap.querySelectorAll('select[data-alan]').forEach(sel => {
      sel.onchange = () => {
        const tc = sel.getAttribute('data-tc'), alan = sel.getAttribute('data-alan');
        const s = h.kisiler.find(x => x.kp.tc_kimlik_no === tc);
        // Önceki ayın etkin değeriyle aynıysa kayıt gereksiz: sil
        const onceki = alan === 'hesap_turu' ? s.girdi[ay - 1].tur : kanunKodu(s, ay - 1, har);
        try {
          API.aylikGirdiYaz(c.id, tc, ay, alan, sel.value === onceki ? null : sel.value);
          yenile({ tc: tc, alan: alan });
        } catch (e) { U.bildir(e.message, 'hata'); }
      };
    });

    const tb = U.el('topluBtn');
    if (tb) tb.onclick = async () => {
      const alan = U.el('topluAlan').value, v = U.el('topluDeger').value.trim();
      const etiket = TEK.find(t => t[0] === alan)[1];
      /* AR-GE günü toplu girilirken yalnız o ay 05746 (AR-GE) kanunlu kişilere yazılır: AR-GE personeli olmayana
         gün yazılmasın. Temizlerken herkese uygulanır: AR-GE'li olmayan kişide kalmış gün de silinsin. */
      const argeMi = alan === 'arge_gun' && v !== '';
      const hedef = argeMi ? h.kisiler.filter(s => s.girdi[ay].kanun === '05746') : h.kisiler;
      if (argeMi && !hedef.length) return U.bildir(U.AYLAR[ay - 1] + ' ayında 05746 (AR-GE) kanunlu kişi yok.', 'uyari');
      const gvAma = argeMi ? h.kisiler.filter(s => s.girdi[ay].kanun !== '05746' && (Number(s.girdi[ay].gvTesvik) || 0) > 0) : [];
      const ok = await C.onay({
        baslik: 'Toplu Giriş',
        mesaj: `${U.AYLAR[ay - 1]} ayı için <strong>${hedef.length} kişinin</strong>${argeMi ? ' (yalnız 05746 AR-GE kanunlu olanlar)' : ''} "${U.esc(etiket)}" alanı
                ${v ? '<strong>' + U.esc(v) + '</strong> yapılacak' : 'temizlenecek'}.` +
               (gvAma.length ? `<br><br>GV teşvik oranı girilmiş ama kanunu 05746 olmayan ${gvAma.length} kişiye yazılmayacak:
                ${gvAma.map(s => U.esc(s.kp.ad_soyad)).join(', ')}.` : ''),
        evetYazi: 'Uygula',
      });
      if (!ok) return;
      try {
        API.aylikGirdiToplu(c.id, ay, alan, v === '' ? null : API.trSayi(v), hedef.map(s => s.kp.tc_kimlik_no));
        APP.tazele();
      } catch (e) { U.bildir(e.message, 'hata'); }
    };
  }

  /* Kanunun ham kodu (motor kural koduyla çalışır; ekranda tanım kodu gerekir):
     o aya kadarki son kayıt, yoksa kişi kartı. */
  function kanunKodu(s, m, har) {
    const o = har[s.kp.tc_kimlik_no] || {};
    let k = s.kp.kanun || 'YOK';
    for (let i = 2; i <= m; i++) if (o[i] && o[i].kanun !== undefined) k = o[i].kanun;
    return k;
  }

  APP.modulKaydet({
    id: 'aylik', ad: 'Aylık Girdiler', ikon: '📅', grup: 'Bütçe',
    baslik: 'Aylık Girdiler', altBaslik: 'Ayni yardım, prim, mesai; yıl içi değişiklikler',
    yetki: 'personel.oku', calismaGerekli: true, ciz: ciz,
  });
})();
