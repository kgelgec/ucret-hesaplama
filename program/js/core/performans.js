/* =====================================================================
   PERFORMANS DEĞERLENDİRME — ÖRNEK MODEL

   Buradaki kriterler, ağırlıklar ve ek puan kuralları bir ÖRNEKTİR;
   kendi değerlendirme politikanıza göre MODEL ve AMIR tablolarını
   değiştirin (alan adları değişirse eski girdiler okunmaz).

   1) Amir puanı      = Σ kriter puanı × kriter ağırlığı / 100
   2) Değerlendirme   = 1. amir, 2. amir, idari amir puanlarının ağırlıklı
                        ortalaması (AMIR tablosundaki ağırlıklarla). Puanı
                        olmayan amirin ağırlığı kalanlara dağıtılır.
   3) Bölüm katsayısı = genel ortalama / bölüm ortalaması (bölümler arası
                        not cömertliği dengelenir; genel ortalama bölüm
                        ortalamalarının ortalamasıdır, kişilerin değil).
   4) Toplam puan     = katsayı × değerlendirme × (yakanın değerlendirme
                        ağırlığı) / 100 + ek puanlar (devamlılık, tutanak,
                        kıdem, eğitim…)
   5) Zam çarpanı     = toplam puan / yakanın ortalama toplam puanı
   Değerlendirilmeyen kişi (hiç amir puanı yok) çarpan almaz → 1.
   ===================================================================== */
window.PERF = (function () {
  'use strict';

  const sayi = v => { if (v == null || v === '') return null; const n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
  const n0 = v => sayi(v) || 0;

  const EGITIM = ['OKUR YAZAR', 'İLK OKUL', 'ORTA OKUL', 'LİSE', 'MESLEK LİSESİ', 'ÖN LİSANS', 'LİSANS', 'YÜKSEK LİSANS', 'DOKTORA'];

  /* Eğitim puanı (iki yaka için aynı ölçek). KIDEM: işyerindeki bütün çalışma dönemlerinin
     toplamı (girip çıkanlarda dönemler toplanır); işe giriş tarihinden hesaplanamaz, elle girilir. */
  const EGITIM_PUAN = { 'OKUR YAZAR': 1, 'İLK OKUL': 2, 'ORTA OKUL': 3, 'LİSE': 4, 'MESLEK LİSESİ': 4,
                        'ÖN LİSANS': 5, 'LİSANS': 6, 'YÜKSEK LİSANS': 7, 'DOKTORA': 8 };
  const egitimNorm = v => String(v || '').toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ').trim();
  const egitimPuan = v => { const e = egitimNorm(v); return EGITIM_PUAN[e] != null ? EGITIM_PUAN[e] : 0; };
  const KIDEM = { alan: 'kidem', ad: 'KIDEM (YIL)', aciklama: 'İşyerindeki bütün çalışma dönemlerinin toplamı (elle girilir; işe giriş tarihinden hesaplanmaz). Yıl başına 1 puan, en çok 5.', puan: v => Math.min(n0(v), 5) };
  const EGITIM_EK = { alan: 'egitim', ad: 'MEZUNİYET', metin: true, liste: EGITIM,
    aciklama: 'Okur yazar 1 · İlk okul 2 · Orta okul 3 · Lise / meslek lisesi 4 · Ön lisans 5 · Lisans 6 · Yüksek lisans 7 · Doktora 8',
    puan: egitimPuan };

  const MODEL = {
    M: {
      ad: 'Mavi yaka', sayfa: 'MAVİ YAKA', degAgirlik: 80,
      kriter: [['is_bilgisi', 'İŞ BİLGİSİ', 25], ['gorev', 'GÖREVLERİNİ YERİNE GETİRME', 25],
               ['kural', 'İŞ GÜVENLİĞİ VE KURALLARA UYMA', 20], ['iletisim', 'İLETİŞİM VE TAKIM ÇALIŞMASI', 15],
               ['gelisim', 'KENDİNİ GELİŞTİRME', 15]],
      ek: [
        { alan: 'devam', ad: 'DEVAMLILIK ORANI (%)', aciklama: '%95 ve üstü 5 puan; altında oran × 0,05',
          puan: v => n0(v) >= 95 ? 5 : n0(v) * 5 / 100 },
        { alan: 'tutanak', ad: 'TUTANAK SAYISI', aciklama: '0 → +2 · 1 → 0 · 2 ve üzeri → −2',
          puan: v => { const t = n0(v); return t < 1 ? 2 : t === 1 ? 0 : -2; } },
        KIDEM, EGITIM_EK,
      ],
    },
    B: {
      ad: 'Beyaz yaka', sayfa: 'BEYAZ YAKA', degAgirlik: 80,
      kriter: [['is_bilgisi', 'İŞ BİLGİSİ', 20], ['kalite', 'İŞ KALİTESİ VE HEDEFLERE ULAŞMA', 20],
               ['planlama', 'PLANLAMA VE PROBLEM ÇÖZME', 20], ['iletisim', 'İLETİŞİM VE TAKIM ÇALIŞMASI', 15],
               ['gelisim', 'KENDİNİ GELİŞTİRME', 10], ['yonetici', 'YÖNETİCİLİK ÖZELLİKLERİ', 15]],
      ek: [KIDEM, EGITIM_EK],
    },
  };
  const AMIR = [['amir1', '1. AMİR', 50], ['amir2', '2. AMİR', 30], ['amir3', 'İDARİ AMİR', 20]];

  /* Kayıtlı alan adları: grup (değerlendirme bölümü), amir1..3 (ad), a1.<kriter> … a3.<kriter>, ek alanlar */
  function alanlar(yaka) {
    const m = MODEL[yaka === 'M' ? 'M' : 'B'];
    const l = ['grup'];
    AMIR.forEach(a => l.push(a[0]));
    AMIR.forEach((a, i) => m.kriter.forEach(k => l.push('a' + (i + 1) + '.' + k[0])));
    m.ek.forEach(e => l.push(e.alan));
    return l;
  }
  const TUM_ALANLAR = new Set([...alanlar('M'), ...alanlar('B')]);
  const alanGecerli = a => TUM_ALANLAR.has(a);
  const metinAlan = a => a === 'grup' || /^amir\d$/.test(a) || a === 'egitim';

  function amirPuani(m, g, i) {
    let t = 0, dolu = false;
    m.kriter.forEach(k => { const v = sayi(g['a' + i + '.' + k[0]]); if (v != null) { dolu = true; t += v * k[2] / 100; } });
    return dolu && t !== 0 ? t : null;
  }

  /* kisiler = [{ tc, yaka, g: {alan: deger} }]
     Dönüş: { kisi: {tc: {amir:[…], deg, grup, kats, ek, puan, carpan}}, grup: {M:[…], B:[…]}, ort: {M, B} } */
  function hesapla(kisiler) {
    const sonuc = { kisi: {}, grup: { M: [], B: [] }, ort: { M: null, B: null } };
    ['M', 'B'].forEach(y => {
      const m = MODEL[y];
      const L = [];
      kisiler.filter(k => (k.yaka === 'M' ? 'M' : 'B') === y).forEach(k => {
        const g = k.g || {};
        const amir = AMIR.map((a, i) => amirPuani(m, g, i + 1));
        const var_ = amir.map((p, i) => p == null ? 0 : AMIR[i][2]);
        const top = var_.reduce((a, b) => a + b, 0);
        if (!top) return;                                   // değerlendirilmemiş
        const deg = amir.reduce((s, p, i) => s + (p || 0) * var_[i], 0) / top;
        const ek = {}; let ekT = 0;
        m.ek.forEach(e => { ek[e.alan] = e.puan(g[e.alan]); ekT += ek[e.alan]; });
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
        k.puan = k.duzDeg * m.degAgirlik / 100 + k.ekToplam;
      });
      const ort = L.length ? L.reduce((s, k) => s + k.puan, 0) / L.length : null;
      sonuc.ort[y] = ort;
      sonuc.genel = sonuc.genel || {}; sonuc.genel[y] = genel;
      L.forEach(k => { k.carpan = ort ? k.puan / ort : 1; sonuc.kisi[k.tc] = k; });
    });
    return sonuc;
  }

  return { MODEL, AMIR, EGITIM, alanlar, alanGecerli, metinAlan, hesapla, sayi };
})();
