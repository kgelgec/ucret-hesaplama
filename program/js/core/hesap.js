/* =====================================================================
   HESAP MOTORU — netten brüte aylık bordro + yıllık maliyet
   ---------------------------------------------------------------------
   Alan adları (AM, BB, CV, DM …) motorun iç kısaltmalarıdır; her birinin
   anlamı yanında yazılıdır, tam sözlük docs/02-hesap-motoru.md'dedir.

   Bu dosya veritabanını TANIMAZ. Girdi olarak düz nesneler alır:
     P  — yılın parametreleri   (bkz. parametreHazirla)
     k  — kişinin yıllık bilgisi (yaka, giriş/çıkış ayı, maaşlar…)
     g  — kişinin o ayki girdileri (hesap türü, kanun, mesai, prim…)

   NETTEN BRÜTE: brüt kendi kendisine bağlıdır
   (BB = net + SGK(BB) + GV(BB) + DV(BB)); eşitlik, değişim 1e-9'un
   altına inene kadar tekrar edilerek (sabit nokta) çözülür.

   KURALLAR
     a. Giriş öncesi / çıkış sonrası ayda maaş ve bütün ek ödemeler
        (yol, prim, yakıt, ayni, mesai) 0'dır.
     b. Sakatlık indirimi ÇALIŞAN lehinedir: brüt, indirimin vergi etkisi
        kadar yüksek hesaplanır, çalışan eline fazlasını alır; maliyetten
        DÜŞÜLMEZ.
     c. Ay içinde giren/çıkan (sigorta günü < 30): asgari ücret GV/DV
        istisnası gün oranında (AR/30).
     d. Ayın tamamı fiilî gün sayısıyla girilmişse (Şubat 28, Ocak 31)
        ücret tam ay (30) sayılır.
     e. AR-GE günü sigorta gününü aşamaz; GV teşviki hesaplanan GV'yi, DV
        teşviki hesaplanan DV'yi aşamaz, eksiye düşemez.
     f. 15510 ve 05746'nın 05510 payı SGK tavanıyla, gün oranında sınırlı.
     g. Ayni yardım işçi SGK tavan karşılaştırmasına ve BES matrahına
        girmez; BES tavanı sigorta günüyle.
     h. SGK prim matrahı asgari ücret tabanının altına inmez.
     i. Yakıt yardımının damga vergisi yılın damga oranıyla.
     Mesai NET maaş üzerinden hesaplanır (bütçe net maaşla tutulur).
   ===================================================================== */
window.HESAP = (function () {
  'use strict';

  /* ---------- Yardımcı işlevler ---------- */

  // MROUND: en yakın katına yuvarlar, yarımlarda sıfırdan uzaklaşır.
  function mround(x, kat) {
    if (!kat) return 0;
    const s = x < 0 ? -1 : 1;
    return s * Math.round(Math.abs(x) / kat + 1e-12) * kat;
  }

  // ROUNDDOWN(x, 0)
  function asagiYuvarla(x) { return x < 0 ? Math.ceil(x) : Math.floor(x); }

  // Sonsuz ya da NaN → 0 (sıfıra bölme gibi durumlar)
  function sayiMi(x) { return typeof x === 'number' && isFinite(x); }
  function hata0(x) { return sayiMi(x) ? x : 0; }

  /* ---------- Gelir vergisi tarifesi ----------
     dilimler: [{ust: 190000, oran: 0.15}, …, {ust: null, oran: 0.40}]
     Kümülatif matrah üzerinden toplam vergi. */
  function vergi(matrah, dilimler) {
    let kalan = matrah, alt = 0, t = 0;
    for (let i = 0; i < dilimler.length; i++) {
      const d = dilimler[i];
      const ust = d.ust == null ? Infinity : d.ust;
      if (matrah <= ust) return t + (matrah - alt) * d.oran;
      t += (ust - alt) * d.oran;
      alt = ust;
    }
    return t + (kalan - alt) * dilimler[dilimler.length - 1].oran;
  }

  // Kümülatif matrahın düştüğü dilimin oranı (AN hesabında)
  function dilimOrani(matrah, dilimler) {
    for (let i = 0; i < dilimler.length; i++) {
      const ust = dilimler[i].ust == null ? Infinity : dilimler[i].ust;
      if (matrah <= ust) return dilimler[i].oran;
    }
    return dilimler[dilimler.length - 1].oran;
  }

  /* ---------- Parametreler ----------
     Ham parametrelerden aylık tabloları üretir:
       asgari[m]   o ayın brüt asgari ücreti
       tavan[m]    SGK tavanı (asgari × çarpan)
       istGV[m]    asgari ücret gelir vergisi istisnası
       istDV[m]    asgari ücret damga vergisi istisnası
       gun[m]      ayın gün sayısı
     ham = {
       yil, dilimler, asgariUcret:[{ay:1, brut:…}, …], tavanCarpan: 9,
       dv, besOrani, turler:{KOD:{kol, sgkIsci, issizlikIsci, sgkIsveren,
       issizlikIsveren, gv, dv, istisna}}, tesvik:{…}, argeGun
     } */
  function parametreHazirla(ham) {
    const P = Object.assign({}, ham);
    P.asgari = []; P.tavan = []; P.istGV = []; P.istDV = []; P.gun = []; P.istMatrahDV = [];
    const au = (ham.asgariUcret || []).slice().sort((a, b) => a.ay - b.ay);
    const auAy = m => { let b = au.length ? au[0].brut : 0; au.forEach(x => { if (x.ay <= m) b = x.brut; }); return b; };
    let kum = 0, oncekiVergi = 0;
    for (let m = 1; m <= 12; m++) {
      const b = auAy(m);
      P.asgari[m] = b;
      P.tavan[m] = b * (ham.tavanCarpan || 9);
      /* Asgari ücretin GV matrahı = brüt × (1 − %14 − %1).
         İstisna, kümülatif matrahın vergisindeki aylık artıştır. */
      kum += b * (1 - (ham.istisnaKesinti == null ? 0.15 : ham.istisnaKesinti));
      const v = vergi(kum, ham.dilimler);
      P.istGV[m] = v - oncekiVergi;
      oncekiVergi = v;
      P.istDV[m] = b * ham.dv;
      P.istMatrahDV[m] = b;
      P.gun[m] = new Date(Date.UTC(ham.yil, m, 0)).getUTCDate();
    }
    return P;
  }

  /* ---------- Tek bir ayın hesabı ----------
     k:  { yaka, girisAy, cikisAy, zamAyi, maasEski, maasYeni }
     g:  { tur, sakatlikDerece, ozurluIndirimi, bes, kanun, kanunOran,
           gvTesvik, argeGun, calisilanGun, fm1, fm2, ayni, prim, yol, yakit }
     devreden: önceki ayın kümülatif GV matrahı (CK)
     Dönüş: bütün ara değerler. */
  function ayHesapla(P, k, g, m, devreden) {
    const tur = P.turler[g.tur] || null;          // null = hesap türü seçilmemiş
    const sgkVar = !!(tur && tur.kol !== 'YOK');
    const kol = tur ? tur.kol : 'YOK';
    const oran = tur || { sgkIsci: 0, issizlikIsci: 0, sgkIsveren: 0, issizlikIsveren: 0, gv: 1, dv: 1, istisna: 1 };
    const gvVar = !tur || tur.gv;
    const dvVar = !tur || tur.dv;
    const istVar = !tur || tur.istisna;

    const D = P.dilimler, dvO = P.dv;
    const tavan = P.tavan[m], tavanG = tavan / 30;

    /* Çalışma durumu: girişten önceki ve çıkıştan sonraki aylarda maaş 0;
       çıkış ayı boşsa kişi yıl içinde ayrılmamıştır. */
    const aktif = !(k.cikisAy != null && k.cikisAy < m) && !(k.girisAy > m);
    const zamli = k.zamAyi <= m;
    const pasifSifir = !aktif;                     // (a) çalışmadığı ayda ek ödemeler de 0

    const r = {};
    r.AM = aktif ? (zamli ? k.maasYeni : k.maasEski) : 0;       // NET MAAŞ
    const AF = g.ozurluIndirimi || 0;
    r.AP = g.argeGun != null ? g.argeGun : ((g.gvTesvik || 0) < 0.8 ? 0 : P.argeGun);
    r.AQ = g.calisilanGun != null ? g.calisilanGun : ((k.yaka === 'B' || k.yaka === 'M') ? 30 : 0);
    r.AR = r.AQ === P.gun[m] ? 30 : r.AQ;                        // SİGORTA GÜN
    const AO = pasifSifir ? 0 : (g.yakit || 0), AT = pasifSifir ? 0 : (g.fm1 || 0), AU = pasifSifir ? 0 : (g.fm2 || 0);
    const AW = pasifSifir ? 0 : (g.ayni || 0), AX = pasifSifir ? 0 : (g.prim || 0), AY = pasifSifir ? 0 : (g.yol || 0);
    const AR = r.AR;
    /* (d) ücret günü: ayın tamamı fiilî gün sayısıyla girildiyse 30 */
    const UG = AR;
    /* (e) AR-GE günü sigorta gününü aşamaz */
    const AP = Math.min(r.AP, AR);
    /* (c) kısmi ayda asgari ücret istisnası gün oranında */
    const istOran = Math.min(AR, 30) / 30;
    const istGV = istVar ? P.istGV[m] * istOran : 0;
    const istDV = istVar ? P.istDV[m] * istOran : 0;
    const istMatrahDV = P.istMatrahDV[m] * istOran;

    r.AS = hata0(r.AM / 30 * UG) + AO;                           // TOPLAM ÜCRET ÖDEMESİ
    r.AV = hata0(r.AM / 30 / 7.5 * 1.5 * AT + r.AM / 30 / 7.5 * 2 * AU); // TOPLAM MESAİ
    r.AZ = AY + AX + AO;                                         // TOPLAM EK ÖDEME
    r.BA = r.AZ + r.AV + r.AS;                                   // TOPLAM NET ÖDEME

    const netUcret = hata0(r.AM / 30 * UG);
    /* (h) SGK prim matrahı tabanı: asgari ücretin gün karşılığı */
    const taban = r.AM === 0 ? 0 : P.asgari[m] / 30 * AR;
    const tb = x => x < taban ? taban : x;

    /* SGK işçi payı — ücret için (BC/BD). Tavanı aşan kısım kesilmez. */
    function sgkUcret(brut, o) {
      if (!sgkVar) return 0;
      brut = tb(brut);
      return hata0(brut / AR < tavanG ? brut * o : o * tavan / 30 * AR);
    }
    /* Mesai, ücretin üstüne eklenir; tavana kalan pay kadar kesilir (BN/BO). */
    function sgkMesai(mesai, ucret, oncekiKesinti, o) {
      if (!sgkVar) return 0;
      return hata0((mesai + tb(ucret)) / AR < tavanG ? mesai * o : o * tavan / 30 * AR - oncekiKesinti);
    }
    /* Ek ödeme (CG/CH); (g) ayni yardım tavan karşılaştırmasına girmez. */
    function sgkEk(ek, toplam, oncekiKesinti, o) {
      if (!sgkVar) return 0;
      if (AR === 0) return toplam < tavan ? ek * o : o * tavan;
      return (toplam / AR) < tavanG ? ek * o : o * tavan / 30 * AR - oncekiKesinti;
    }
    /* Kümülatif matrahtaki artışın ortalama oranı (BJ, BU, CC, CN) */
    function ortOran(onceki, sonraki) {
      return hata0((vergi(sonraki, D) - vergi(onceki, D)) / (sonraki - onceki));
    }
    const pos = x => x < 0 ? 0 : x;
    /* GV/DV'nin istisnadan artakalanı: önceki kalemler istisnayı
       tüketmediyse artan kısım bu kaleme düşer (BV, CD, CO, CE, CP, CR). */
    function artakalan(onceki, bu) { return pos(onceki < 0 ? bu + onceki : bu); }

    // Döngüsel değişkenler: brüt ücret, brüt mesai, brüt ayni, brüt ek ödeme, ek ödeme-2
    let BB = 0, BM = 0, BX = 0, CF = 0, CQ = 0, AN = 0;
    let s = {};
    for (let tur_ = 0; tur_ < 2000; tur_++) {
      s = {};
      // --- Ücret ---
      s.BC = sgkUcret(BB, oran.sgkIsci);
      s.BD = sgkUcret(BB, oran.issizlikIsci);
      s.BE = hata0(pos(BB - s.BC - s.BD - (AF / 30 * AR)));
      s.BF = devreden;
      s.BG = s.BE + s.BF;
      s.BH = vergi(s.BF, D); s.BI = vergi(s.BG, D);
      s.BJ = gvVar ? ortOran(s.BF, s.BG) : 0;
      const gvU = hata0(s.BJ * s.BE) - istGV;
      s.BK = pos(gvU);
      const dvU = dvVar ? hata0(BB * dvO) - istDV : -istDV;
      s.BL = dvVar ? pos(dvU) : 0;
      // --- Mesai ---
      s.BN = sgkMesai(BM, BB, s.BC, oran.sgkIsci);
      s.BO = sgkMesai(BM, BB, s.BD, oran.issizlikIsci);
      s.BP = BM - s.BN - s.BO;
      s.BQ = s.BG; s.BR = s.BP + s.BQ;
      s.BU = gvVar ? ortOran(s.BQ, s.BR) : 0;
      s.BV = artakalan(gvU, hata0(s.BU * s.BP));
      const gvM = hata0(s.BU * s.BP) + hata0(s.BJ * s.BE) - istGV;
      s.BW = dvVar ? artakalan(dvU, hata0(BM * dvO)) : 0;
      const dvM = hata0(BM * dvO) + hata0(BB * dvO) - istDV;
      // --- Ayni yardım ---
      s.BY = s.BR; s.BZ = s.BY + BX;
      s.CC = gvVar ? ortOran(s.BY, s.BZ) : 0;
      s.CD = artakalan(gvM, hata0(BX * s.CC));
      const gvA = hata0(BX * s.CC) + gvM;
      s.CE = dvVar ? artakalan(dvM, hata0(BX * dvO)) : 0;
      const dvA = hata0(BX * dvO) + dvM;
      // --- Ek ödeme ---
      const topEk = CF + BM + tb(BB);
      s.CG = sgkEk(CF, topEk, s.BC + s.BN, oran.sgkIsci);
      s.CH = sgkEk(CF, topEk, s.BD + s.BO, oran.issizlikIsci);
      s.CI = CF - s.CG - s.CH;
      s.CJ = s.BZ; s.CK = s.CJ + s.CI;
      s.CN = gvVar ? ortOran(s.CJ, s.CK) : 0;
      s.CO = artakalan(gvA, hata0(s.CN * s.CI));
      s.CP = dvVar ? artakalan(dvA, hata0(CF * dvO)) : 0;
      const dvE = hata0(CF * dvO) + dvA;
      // --- Ek ödeme 2 (yakıt yardımı): yalnızca damga ---
      s.CR = dvVar ? artakalan(dvE, hata0(CQ * dvO)) : 0;
      // --- Sakatlık indiriminin vergi etkisi, çalışana verilir (AN) ---
      const yeniAN = r.AM === 0 ? 0 : hata0(dilimOrani(s.CK, D) * AF / 30 * UG);

      const yBB = hata0(netUcret + s.BC + s.BD + s.BK + s.BL + yeniAN);
      const yBM = hata0(r.AV + s.BN + s.BO + s.BV + s.BW);
      const yBX = hata0(AW + s.CD + s.CE);
      const yCF = hata0(r.AZ - AO + s.CG + s.CH + s.CO + s.CP);
      const yCQ = hata0(AO + s.CR);
      const fark = Math.abs(yBB - BB) + Math.abs(yBM - BM) + Math.abs(yBX - BX) +
                   Math.abs(yCF - CF) + Math.abs(yCQ - CQ) + Math.abs(yeniAN - AN);
      BB = yBB; BM = yBM; BX = yBX; CF = yCF; CQ = yCQ; AN = yeniAN;
      // Göreli tolerans: çok yüksek tutarlarda 1e-9 mutlak fark kayan noktayla yakalanamıyordu
      if (fark < 1e-9 * Math.max(1, Math.abs(BB) + Math.abs(CF))) { r.tur = tur_ + 1; break; }
    }
    if (r.tur == null) r.yakinsamadi = true;   // olmaması gerekir; ekranlar uyarı gösterebilir
    Object.assign(r, s);
    r.AN = AN; r.BB = BB; r.BM = BM; r.BX = BX; r.CF = CF; r.CQ = CQ;

    // --- Toplamlar ---
    r.CV = CF + BB + BX + BM + CQ;               // BRÜT TOPLAM
    r.CW = r.BC + r.CG + r.BN;                   // SSK İŞÇİ
    r.CX = r.BD + r.CH + r.BO;                   // İŞSİZLİK İŞÇİ
    r.CY = r.CO + r.CD + r.BK + r.BV;            // TOPLAM GELİR VERGİSİ
    r.DA = r.CP + r.CE + r.BL + r.BW + r.CR;     // TOPLAM DAMGA VERGİSİ

    // BES (DC): otomatik katılım, SGK tavanına kadar, aşağı yuvarlanır; (g) ayni BES'e girmez
    const besMatrah = BB + CF + BM;
    const besGun = AR;
    r.DC = g.bes === 'EVET'
      ? asagiYuvarla(besGun === 0
          ? (besMatrah < tavan ? besMatrah * P.besOrani : tavan * P.besOrani)
          : (besMatrah / besGun < tavanG ? besMatrah * P.besOrani : tavanG * besGun * P.besOrani))
      : 0;
    r.DD = r.CV - r.CW - r.CX - r.CY - r.DA - AW - r.DC; // NET ÖDEME

    // --- İşveren payları (DE/DF) ---
    function isveren(o) {
      if (!sgkVar) return 0;
      const mat = BM + CF + tb(BB);
      return hata0(AR === 0
        ? (CF > tavan ? tavan * o : o * CF)
        : (mat / AR > tavanG ? tavanG * AR * o : o * mat));
    }
    r.DE = isveren(oran.sgkIsveren);
    r.DF = isveren(oran.issizlikIsveren);

    // --- Teşvikler ---
    const T = P.tesvik, kn = g.kanun || '';
    const sgkMatrah = tb(BB) + CF + BM;
    // (f) SGK tavanıyla sınırlı prim matrahı — teşvikler bunun üzerinden
    const sinirli = AR === 0 ? Math.min(CF, tavan) : Math.min(sgkMatrah, tavanG * AR);
    r.DG = 0; r.DH = 0; r.DI = 0; r.DJ = 0; r.DK = 0; r.DL = 0;
    if (aktif && sgkVar && kol === 'SSK' && kn && kn !== 'YOK') {
      /* 05510 — işveren payı indirimi; SSK'lı her kanunda uygulanır. Oran kanun türünden gelir
         (05510 - %2 imalat dışı / 05510 - %5 imalat); tanımlı değilse yılın parametresi. */
      const o5510 = kn === '05510' && g.kanunOran != null ? g.kanunOran : T.k05510;
      r.DG = sinirli * o5510;
    }
    if (aktif && sgkVar && kol === 'SSK' && kn === '14857') {
      r.DH = P.asgari[m] * T.k14857 / 30 * AR;
    }
    if (aktif && sgkVar && kol === 'SGDP' && kn === '15510') {
      r.DI = sinirli * T.k15510;
    }
    if (aktif && sgkVar && kol === 'SSK' && kn === '05746') {
      const bb = tb(BB);
      r.DJ = hata0(bb / AR < tavanG ? bb * T.k05746 / AR * AP : tavanG * AR * T.k05746 / AR * AP);
    }
    const gvT = g.gvTesvik || 0;
    if (aktif && gvT > 0) {
      r.CM = vergi(r.CK, D);
      const v = hata0(((r.CI + BX + r.BE) * (r.CM - r.BH) / (r.CK - r.BF) / AR * AP - istGV) * gvT);
      const dl = hata0(((BB + BX + CF + CQ) / AR * AP - istMatrahDV) * dvO);
      // (e) teşvik hesaplanan vergiyi aşamaz, eksiye düşemez
      r.DK = Math.min(pos(v), r.CY);
      r.DL = Math.min(pos(dl), r.DA);
    }
    r.CZ = r.CY - r.DK;                          // ÖDENECEK GELİR VERGİSİ
    r.DB = r.DA - r.DL;                          // ÖDENECEK DAMGA VERGİSİ

    // --- Toplam maliyet (DM) ---
    /* (b) Sakatlık indirimi çalışan lehine: brüte eklenen AN çalışana ödenir, maliyetten düşülmez. */
    r.DM = r.CV + r.DE + r.DF - r.DG - r.DH - r.DI - r.DJ - r.DK - r.DL;
    return r;
  }

  /* ---------- Zam hesabı ----------
     z = { yaka, eskiYilda (yıl başından önce girmiş mi), maasEski, duzeltme, carpan }
     Z = { yontem: {kademe:bool, performans:bool}, kademe: {M:{…}, B:{…}},
           yuvarla: {ongoru} (vars. 10) } — çalışmaya özel
     Kademe: alt eşiğin altındaki maaşa üst oran, üst eşiğin üstündekine alt oran,
     arada doğrusal geçiş. Performans açıksa oran kişinin çarpanıyla çarpılır.
     Öngörü yuvarlanır; yönetimin düzeltmesi (duzeltme) öngörüye eklenir. */
  function zamHesapla(Z, z) {
    const eski = z.maasEski || 0;
    const kd = Z.kademe[z.yaka] || null;
    let oran = 0;
    if (kd && z.eskiYilda) {
      let o;
      if (Z.yontem.kademe === false) o = kd.ustOran;
      else if (eski < kd.altEsik) o = kd.ustOran;
      else if (eski > kd.ustEsik) o = kd.altOran;
      else o = kd.ustOran - (eski - kd.altEsik) / (kd.ustEsik - kd.altEsik) * (kd.ustOran - kd.altOran);
      oran = o * (Z.yontem.performans ? (z.carpan == null ? 1 : z.carpan) : 1);
    }
    const yv = Z.yuvarla || {};
    const ongoru = mround(oran * eski, yv.ongoru || 10);
    const miktar = (z.duzeltme || 0) + ongoru;
    return {
      eski: eski, oranOngoru: oran, ongoru: ongoru, miktar: miktar,
      yeni: eski + miktar, oran: eski ? miktar / eski : 0,
    };
  }

  /* ---------- Kişinin yılı ----------
     aylar[m] = ayHesapla sonucu; devreden matrah aydan aya taşınır. */
  function yilHesapla(P, k, aylikGirdi) {
    const aylar = [null];
    let devreden = 0, toplam = 0;
    for (let m = 1; m <= 12; m++) {
      const r = ayHesapla(P, k, aylikGirdi(m), m, devreden);
      aylar.push(r);
      devreden = r.CK;
      toplam += r.DM;
    }
    return { aylar: aylar, maliyet: toplam };
  }

  return { parametreHazirla, ayHesapla, yilHesapla, zamHesapla, vergi, mround };
})();
