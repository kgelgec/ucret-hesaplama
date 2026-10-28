/* =====================================================================
   PERFORMANS DEĞERLENDİRME — MODEL VE HESAP

   Model bir VERİDİR (kod değil): amirler, yaka başına kriterler ve
   ağırlıklar, değerlendirme ağırlığı ve ek puan kuralları. Yıl bazında
   Performans Değerlendirme → "Değerlendirme modeli" ekranından düzenlenir
   ve parametre tablosunda ('perf.model', JSON) saklanır; yeni yıla
   kopyalanır, onaylı çalışmada diğer parametrelerle birlikte dondurulur.
   Kayıt yoksa VARSAYILAN (örnek) model geçerlidir.

   1) Amir puanı      = Σ kriter puanı × kriter ağırlığı / 100
   2) Değerlendirme   = amir puanlarının amir ağırlıklarıyla ağırlıklı
                        ortalaması. Puanı olmayan amirin ağırlığı kalanlara
                        dağıtılır.
   3) Bölüm katsayısı = genel ortalama / bölüm ortalaması (bölümler arası
                        not cömertliği dengelenir; genel ortalama bölüm
                        ortalamalarının ortalamasıdır, kişilerin değil).
   4) Toplam puan     = katsayı × değerlendirme × (yakanın değerlendirme
                        ağırlığı) / 100 + ek puanlar
   5) Zam çarpanı     = toplam puan / yakanın ortalama toplam puanı
   Değerlendirilmeyen kişi (hiç amir puanı yok) çarpan almaz → 1.

   EK PUAN KURALI TÜRLERİ (ek[].tur)
     esik    : değer ≥ esik → puan; altında değer × katsayi   (ör. devamlılık %)
     kademe  : kademeler [[enAz, puan], …] — değerin ulaştığı en yüksek
               kademenin puanı                                 (ör. tutanak sayısı)
     carpan  : değer × katsayi, en çok enCok                   (ör. kıdem yılı)
     liste   : seçenekler [[ad, puan], …]; listede olmayan → bos (ör. mezuniyet)
   Ek alanın isteğe bağlı bilgileri: sinir [en az, en çok] (girişte denetlenir), not (açıklamanın
   başına eklenir), kalici (yeni dönemin şablonuna önceki dönemden taşınır; ör. kıdem, mezuniyet).
   ===================================================================== */
window.PERF = (function () {
  'use strict';

  const sayi = v => { if (v == null || v === '') return null; const n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
  const n0 = v => sayi(v) || 0;
  const norm = v => String(v || '').toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ').trim();
  const tl = x => String(Math.round(x * 1000) / 1000).replace('.', ',');

  const TURLER = {
    esik: 'Eşik (üstü sabit puan, altı orantılı)',
    kademe: 'Kademe (sayıya göre puan)',
    carpan: 'Çarpan (değer × katsayı, üst sınırlı)',
    liste: 'Liste (seçeneğe göre puan)',
  };

  const EGITIM = [['OKUR YAZAR', 1], ['İLK OKUL', 2], ['ORTA OKUL', 3], ['LİSE', 4], ['MESLEK LİSESİ', 4],
                  ['ÖN LİSANS', 5], ['LİSANS', 6], ['YÜKSEK LİSANS', 7], ['DOKTORA', 8]];
  const KIDEM = { alan: 'kidem', ad: 'KIDEM (YIL)', tur: 'carpan', katsayi: 1, enCok: 5, sinir: [0, 99], kalici: true,
    not: 'İşyerindeki bütün çalışma dönemlerinin toplamı (elle girilir; işe giriş tarihinden hesaplanmaz).' };
  const MEZUNIYET = { alan: 'egitim', ad: 'MEZUNİYET', tur: 'liste', secenek: EGITIM, bos: 0, kalici: true };

  /* Örnek model — kurum kendi politikasına göre ekrandan değiştirir */
  const VARSAYILAN = {
    amirler: [{ alan: 'amir1', ad: '1. AMİR', agirlik: 50 }, { alan: 'amir2', ad: '2. AMİR', agirlik: 30 },
              { alan: 'amir3', ad: 'İDARİ AMİR', agirlik: 20 }],
    yaka: {
      M: {
        ad: 'Mavi yaka', sayfa: 'MAVİ YAKA', degAgirlik: 80,
        kriter: [{ kod: 'is_bilgisi', ad: 'İŞ BİLGİSİ', agirlik: 25 }, { kod: 'gorev', ad: 'GÖREVLERİNİ YERİNE GETİRME', agirlik: 25 },
                 { kod: 'kural', ad: 'İŞ GÜVENLİĞİ VE KURALLARA UYMA', agirlik: 20 }, { kod: 'iletisim', ad: 'İLETİŞİM VE TAKIM ÇALIŞMASI', agirlik: 15 },
                 { kod: 'gelisim', ad: 'KENDİNİ GELİŞTİRME', agirlik: 15 }],
        ek: [
          { alan: 'devam', ad: 'DEVAMLILIK ORANI (%)', tur: 'esik', esik: 95, puan: 5, katsayi: 0.05, sinir: [0, 100] },
          { alan: 'tutanak', ad: 'TUTANAK SAYISI', tur: 'kademe', kademeler: [[0, 2], [1, 0], [2, -2]], sinir: [0, 99] },
          KIDEM, MEZUNIYET,
        ],
      },
      B: {
        ad: 'Beyaz yaka', sayfa: 'BEYAZ YAKA', degAgirlik: 80,
        kriter: [{ kod: 'is_bilgisi', ad: 'İŞ BİLGİSİ', agirlik: 20 }, { kod: 'kalite', ad: 'İŞ KALİTESİ VE HEDEFLERE ULAŞMA', agirlik: 20 },
                 { kod: 'planlama', ad: 'PLANLAMA VE PROBLEM ÇÖZME', agirlik: 20 }, { kod: 'iletisim', ad: 'İLETİŞİM VE TAKIM ÇALIŞMASI', agirlik: 15 },
                 { kod: 'gelisim', ad: 'KENDİNİ GELİŞTİRME', agirlik: 10 }, { kod: 'yonetici', ad: 'YÖNETİCİLİK ÖZELLİKLERİ', agirlik: 15 }],
        ek: [KIDEM, MEZUNIYET],
      },
    },
  };
  const kopya = o => JSON.parse(JSON.stringify(o));

  /* Kodlar: kriter ve ek alan kodu küçük harf, rakam, alt çizgi (girdi tablosunda alan adıdır) */
  const KOD = /^[a-z][a-z0-9_]{0,29}$/;
  const AYRILMIS = ['grup'];
  function kodUret(ad, varolan) {
    const tr = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
    let k = String(ad || '').toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, h => tr[h])
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'k$1').slice(0, 24) || 'alan';
    let s = k, i = 2;
    while ((varolan || []).indexOf(s) >= 0 || AYRILMIS.indexOf(s) >= 0 || /^amir\d+$/.test(s)) s = k + '_' + i++;
    return s;
  }

  /* Kuralın ekranda / Excel açıklamasında görünen metni */
  function aciklama(e) {
    let m = '';
    if (e.tur === 'esik') m = `${tl(e.esik)} ve üstü ${tl(e.puan)} puan; altında değer × ${tl(e.katsayi)}`;
    else if (e.tur === 'kademe') m = e.kademeler.map((k, i) => `${tl(k[0])}${i === e.kademeler.length - 1 ? ' ve üzeri' : ''} → ${k[1] > 0 ? '+' : ''}${tl(k[1])}`).join(' · ');
    else if (e.tur === 'carpan') m = `değer × ${tl(e.katsayi)}${e.enCok != null ? ', en çok ' + tl(e.enCok) : ''}`;
    else if (e.tur === 'liste') m = e.secenek.map(s => `${s[0].charAt(0) + s[0].slice(1).toLocaleLowerCase('tr-TR')} ${tl(s[1])}`).join(' · ') +
      (e.bos ? ` · diğer ${tl(e.bos)}` : '');
    if (e.not) m = m.charAt(0).toLocaleUpperCase('tr-TR') + m.slice(1);
    return (e.not ? e.not + ' ' : '') + m;
  }

  function puanIslevi(e) {
    if (e.tur === 'esik') return v => n0(v) >= e.esik ? e.puan : n0(v) * e.katsayi;
    if (e.tur === 'kademe') {
      const k = e.kademeler.slice().sort((a, b) => a[0] - b[0]);
      return v => { const x = n0(v); let p = k.length ? k[0][1] : 0; k.forEach(s => { if (x >= s[0]) p = s[1]; }); return p; };
    }
    if (e.tur === 'carpan') return v => { const p = n0(v) * e.katsayi; return e.enCok != null ? Math.min(p, e.enCok) : p; };
    const tablo = {}; e.secenek.forEach(s => { tablo[norm(s[0])] = s[1]; });
    return v => (tablo[norm(v)] != null ? tablo[norm(v)] : (e.bos || 0));
  }

  /* Ham modeli denetler ve hesapta kullanılan biçime çevirir. Hatalıysa açıklamalı hata atar.
     Dönüş: { ham, amir: [[alan, ad, agirlik, onEk]], M: {ad, sayfa, degAgirlik, kriter: [[kod, ad, agirlik]],
              ek: [{alan, ad, aciklama, puan(v), metin, liste, sinir, tur}]}, B: {…},
              alanlar(yaka), alanGecerli(alan), metinAlan(alan), toplamAgirlik(yaka) } */
  function hazirla(ham) {
    const m = kopya(ham || VARSAYILAN);
    const H = msg => { throw new Error('Değerlendirme modeli: ' + msg); };
    const num = (v, ad) => { const n = sayi(v); if (n == null) H(ad + ' sayı olmalı.'); return n; };
    if (!Array.isArray(m.amirler) || !m.amirler.length) H('en az bir amir tanımlanmalı.');
    if (m.amirler.length > 5) H('en çok 5 amir tanımlanabilir.');
    const amir = m.amirler.map(a => {
      if (!/^amir\d+$/.test(a.alan || '')) H('amir alanı "amir1", "amir2"… biçiminde olmalı.');
      if (!String(a.ad || '').trim()) H('amir adı boş olamaz.');
      const w = num(a.agirlik, a.ad + ' ağırlığı'); if (w < 0) H('ağırlık eksi olamaz.');
      return [a.alan, String(a.ad).trim(), w, 'a' + a.alan.slice(4) + '.'];
    });
    if (new Set(amir.map(a => a[0])).size !== amir.length) H('aynı amir alanı iki kez kullanılmış.');
    if (!amir.some(a => a[2] > 0)) H('en az bir amirin ağırlığı sıfırdan büyük olmalı.');
    const sonuc = { ham: m, amir: amir };
    ['M', 'B'].forEach(y => {
      const t = (m.yaka || {})[y]; if (!t) H((y === 'M' ? 'mavi' : 'beyaz') + ' yaka tanımı yok.');
      const yad = t.ad || (y === 'M' ? 'Mavi yaka' : 'Beyaz yaka');
      if (!Array.isArray(t.kriter) || !t.kriter.length) H(yad + ': en az bir kriter tanımlanmalı.');
      const kodlar = [];
      const kriter = t.kriter.map(k => {
        if (!KOD.test(k.kod || '')) H(yad + ': "' + (k.ad || k.kod) + '" kriterinin kodu geçersiz.');
        if (kodlar.indexOf(k.kod) >= 0) H(yad + ': "' + k.kod + '" kodu iki kez kullanılmış.');
        kodlar.push(k.kod);
        if (!String(k.ad || '').trim()) H(yad + ': kriter adı boş olamaz.');
        const w = num(k.agirlik, k.ad + ' ağırlığı'); if (w < 0) H('ağırlık eksi olamaz.');
        return [k.kod, String(k.ad).trim(), w];
      });
      const alanlar = [];
      const ek = (t.ek || []).map(e => {
        if (!KOD.test(e.alan || '') || AYRILMIS.indexOf(e.alan) >= 0 || /^amir\d+$/.test(e.alan))
          H(yad + ': "' + (e.ad || e.alan) + '" ek alanının kodu geçersiz.');
        if (alanlar.indexOf(e.alan) >= 0) H(yad + ': "' + e.alan + '" ek alanı iki kez tanımlanmış.');
        alanlar.push(e.alan);
        if (!String(e.ad || '').trim()) H(yad + ': ek alan adı boş olamaz.');
        if (!TURLER[e.tur]) H(yad + ': "' + e.ad + '" için kural türü seçilmemiş.');
        if (e.tur === 'esik') { e.esik = num(e.esik, e.ad + ' eşiği'); e.puan = num(e.puan, e.ad + ' puanı'); e.katsayi = num(e.katsayi, e.ad + ' katsayısı'); }
        if (e.tur === 'carpan') { e.katsayi = num(e.katsayi, e.ad + ' katsayısı'); e.enCok = e.enCok == null || e.enCok === '' ? null : num(e.enCok, e.ad + ' üst sınırı'); }
        if (e.tur === 'kademe') {
          if (!Array.isArray(e.kademeler) || !e.kademeler.length) H(e.ad + ': en az bir kademe girilmeli.');
          e.kademeler = e.kademeler.map(k => [num(k[0], e.ad + ' kademe değeri'), num(k[1], e.ad + ' kademe puanı')]).sort((a, b) => a[0] - b[0]);
        }
        if (e.tur === 'liste') {
          if (!Array.isArray(e.secenek) || !e.secenek.length) H(e.ad + ': en az bir seçenek girilmeli.');
          e.secenek = e.secenek.map(s => [norm(s[0]), num(s[1], e.ad + ' seçenek puanı')]).filter(s => s[0]);
          e.bos = sayi(e.bos) || 0;
        }
        const sinir = Array.isArray(e.sinir) && e.sinir.length === 2 && e.sinir.every(x => sayi(x) != null) ? e.sinir.map(Number) : null;
        return { alan: e.alan, ad: String(e.ad).trim(), tur: e.tur, aciklama: aciklama(e), puan: puanIslevi(e),
                 metin: e.tur === 'liste', liste: e.tur === 'liste' ? e.secenek.map(s => s[0]) : null, sinir: sinir,
                 kalici: !!e.kalici };
      });
      sonuc[y] = { ad: yad, sayfa: t.sayfa || yad.toLocaleUpperCase('tr-TR'), degAgirlik: num(t.degAgirlik, yad + ' değerlendirme ağırlığı'),
                   kriter: kriter, ek: ek };
    });
    sonuc.alanlar = yaka => {
      const t = sonuc[yaka === 'M' ? 'M' : 'B'];
      const l = ['grup'];
      amir.forEach(a => l.push(a[0]));
      amir.forEach(a => t.kriter.forEach(k => l.push(a[3] + k[0])));
      t.ek.forEach(e => l.push(e.alan));
      return l;
    };
    const tum = new Set([...sonuc.alanlar('M'), ...sonuc.alanlar('B')]);
    const metinler = new Set(['grup'].concat(amir.map(a => a[0]), ...['M', 'B'].map(y => sonuc[y].ek.filter(e => e.metin).map(e => e.alan))));
    sonuc.alanGecerli = a => tum.has(a);
    sonuc.metinAlan = a => metinler.has(a);
    sonuc.toplamAgirlik = yaka => sonuc[yaka === 'M' ? 'M' : 'B'].kriter.reduce((s, k) => s + k[2], 0);
    return sonuc;
  }

  function amirPuani(t, g, onEk) {
    let s = 0, dolu = false;
    t.kriter.forEach(k => { const v = sayi(g[onEk + k[0]]); if (v != null) { dolu = true; s += v * k[2] / 100; } });
    return dolu && s !== 0 ? s : null;
  }

  /* kisiler = [{ tc, yaka, g: {alan: deger} }]; model = hazirla() sonucu (boşsa varsayılan)
     Dönüş: { kisi: {tc: {amir:[…], deg, grup, kats, ek, puan, carpan}}, grup: {M:[…], B:[…]}, ort: {M, B} } */
  function hesapla(kisiler, model) {
    const MD = model || hazirla(null);
    const sonuc = { kisi: {}, grup: { M: [], B: [] }, ort: { M: null, B: null } };
    ['M', 'B'].forEach(y => {
      const t = MD[y];
      const L = [];
      kisiler.filter(k => (k.yaka === 'M' ? 'M' : 'B') === y).forEach(k => {
        const g = k.g || {};
        const amir = MD.amir.map(a => amirPuani(t, g, a[3]));
        const var_ = amir.map((p, i) => p == null ? 0 : MD.amir[i][2]);
        const top = var_.reduce((a, b) => a + b, 0);
        if (!top) return;                                   // değerlendirilmemiş
        const deg = amir.reduce((s, p, i) => s + (p || 0) * var_[i], 0) / top;
        const ek = {}; let ekT = 0;
        t.ek.forEach(e => { ek[e.alan] = e.puan(g[e.alan]); ekT += ek[e.alan]; });
        L.push({ tc: k.tc, amir: amir, deg: deg, grup: String(g.grup || '').trim(), ek: ek, ekToplam: ekT });
      });
      const gr = {};
      L.forEach(k => { (gr[k.grup] = gr[k.grup] || []).push(k.deg); });
      const grOrt = {};
      Object.keys(gr).forEach(a => { grOrt[a] = gr[a].reduce((s, x) => s + x, 0) / gr[a].length; });
      const adlar = Object.keys(grOrt);
      const genel = adlar.length ? adlar.reduce((s, a) => s + grOrt[a], 0) / adlar.length : 0;
      sonuc.grup[y] = adlar.sort((a, b) => a.localeCompare(b, 'tr')).map(a => ({
        grup: a, kisi: gr[a].length, ort: grOrt[a], kats: grOrt[a] ? genel / grOrt[a] : 1 }));
      L.forEach(k => {
        k.kats = grOrt[k.grup] ? genel / grOrt[k.grup] : 1;
        k.duzDeg = k.kats * k.deg;
        k.puan = k.duzDeg * t.degAgirlik / 100 + k.ekToplam;
      });
      const ort = L.length ? L.reduce((s, k) => s + k.puan, 0) / L.length : null;
      sonuc.ort[y] = ort;
      sonuc.genel = sonuc.genel || {}; sonuc.genel[y] = genel;
      L.forEach(k => { k.carpan = ort ? k.puan / ort : 1; sonuc.kisi[k.tc] = k; });
    });
    return sonuc;
  }

  return { VARSAYILAN: () => kopya(VARSAYILAN), TURLER, hazirla, hesapla, aciklama, kodUret, sayi };
})();
