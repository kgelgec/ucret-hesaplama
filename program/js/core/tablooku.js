/* =====================================================================
   TABLO OKUMA — Excel (.xlsx), CSV ya da panodan yapıştırılan tablo
   ---------------------------------------------------------------------
   Sütunlar KONUMLA değil BAŞLIK ADIYLA eşleştirilir: ERP / bordro
   programının raporunda sütun sırası değişse ya da araya sütun eklense
   de aktarım bozulmaz (konumla okuyan bir okuyucu kayan sütunlarda
   yanlış alanı sessizce okur).

   tanim = { alan: ['başlık adı', 'eş anlamlı', …], … }
   Önce birebir eşleşme, sonra "içerir" eşleşmesi denenir.
   ===================================================================== */
window.TO = (function () {
  'use strict';

  const norm = s => U.normalize(String(s == null ? '' : s)).replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();

  function hucre(v) {
    if (v == null) return '';
    if (v instanceof Date) return v;
    if (typeof v === 'object') {
      if (v.richText) return v.richText.map(t => t.text).join('');
      if ('result' in v) return v.result == null ? '' : v.result;
      if (v.text) return v.text;
    }
    return v;
  }

  async function xlsxSatirlar(dosya) {
    if (!window.ExcelJS) throw new Error('Excel kütüphanesi yüklenemedi.');
    const kitap = new ExcelJS.Workbook();
    await kitap.xlsx.load(await dosya.arrayBuffer());
    const s = kitap.worksheets[0];
    if (!s) throw new Error('Dosyada sayfa yok.');
    const satirlar = [];
    s.eachRow({ includeEmpty: false }, row => {
      const v = []; for (let i = 1; i <= row.cellCount; i++) v.push(hucre(row.getCell(i).value));
      satirlar.push(v);
    });
    return satirlar;
  }

  // Sekme (Excel'den kopyala-yapıştır), noktalı virgül ya da virgül ayraçlı metin
  function metinSatirlar(metin) {
    const satir = String(metin || '').replace(/\r/g, '').split('\n').filter(x => x.trim() !== '');
    if (!satir.length) return [];
    const ilk = satir[0];
    const ayrac = ilk.includes('\t') ? '\t' : (ilk.split(';').length >= ilk.split(',').length ? ';' : ',');
    return satir.map(x => x.split(ayrac).map(h => h.replace(/^"|"$/g, '').trim()));
  }

  async function dosyaSatirlar(dosya) {
    if (/\.xlsx$/i.test(dosya.name)) return xlsxSatirlar(dosya);
    if (/\.xls$/i.test(dosya.name)) throw new Error('Eski .xls biçimi okunamıyor. Dosyayı Excel\'de .xlsx olarak kaydedin ya da tabloyu kopyalayıp yapıştırın.');
    return metinSatirlar(await dosya.text());
  }

  /* Başlık satırını bulur (ilk 15 satırda zorunlu alanın başlığı geçen satır)
     ve sütunları eşleştirir. Dönüş: { sutun: {alan: indeks}, basliklar, veri: [[…]] } */
  function eslestir(satirlar, tanim, zorunlu) {
    const adaylar = {};
    Object.keys(tanim).forEach(a => { adaylar[a] = tanim[a].map(norm); });
    for (let r = 0; r < Math.min(15, satirlar.length); r++) {
      const b = satirlar[r].map(norm);
      const sutun = {};
      // 1) birebir
      Object.keys(adaylar).forEach(a => {
        const i = b.findIndex(x => x && adaylar[a].indexOf(x) >= 0);
        if (i >= 0) sutun[a] = i;
      });
      // 2) içerir (henüz eşleşmemiş alanlar, kullanılmamış sütunlar)
      Object.keys(adaylar).forEach(a => {
        if (sutun[a] != null) return;
        const kullanilan = Object.values(sutun);
        const i = b.findIndex((x, j) => x && kullanilan.indexOf(j) < 0 && adaylar[a].some(ad => ad.length > 2 && x.includes(ad)));
        if (i >= 0) sutun[a] = i;
      });
      if ((zorunlu || []).every(a => sutun[a] != null)) {
        return { sutun: sutun, basliklar: satirlar[r].map(x => String(x)), veri: satirlar.slice(r + 1) };
      }
    }
    return null;
  }

  function tarih(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : v.toISOString().slice(0, 10);
    return U.tarihCoz(v) || null;
  }
  function sayi(v) {
    if (v == null || v === '') return null;
    return typeof v === 'number' ? v : API.trSayi(v);
  }
  function tc(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

  return { dosyaSatirlar, metinSatirlar, eslestir, tarih, sayi, tc, norm };
})();
